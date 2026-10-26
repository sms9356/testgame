// 성능 안정화 (perfStabilizer)
// 1) 점조명 고정 풀: 보이는 점조명 수가 1~5개로 바뀔 때마다 Three.js 가 모든 재질(400여 종) 셰이더를 다시 만들어
//    현관 · 계단 근처에서 화면이 몇 초씩 멈췄다. 원래 점조명은 카메라 레이어에서 빼고, 항상 켜진 6개 풀에 가까운 순서로 값을 복사한다.
// 2) 거리 컬링: 안개 너머(실내 ~24m)의 소품 · 가구는 그리지 않는다 (visible 은 건드리지 않고 레이어만 바꾼다 — 게임 로직과 충돌 없음).
//    인스턴스 가구는 가까운 인스턴스만 앞으로 모아 count 를 줄인다.
// 3) 적응형: 프레임이 무거우면 컬링 거리를 줄이고, 여유가 생기면 다시 늘린다.
const POOL = 6, HIDE = 7;
let C = null;

export function installPerf(ctx) {
  const { THREE, scene } = ctx;
  const rig = new THREE.Group(); rig.name = 'perfLightPool'; rig.userData.dynamic = true; scene.add(rig);
  const pool = Array.from({ length: POOL }, () => { const l = new THREE.PointLight(0xffffff, 0, 10, 2); l.userData.perfPool = true; rig.add(l); return l; });
  C = { ...ctx, pool, src: [], units: [], ims: [], seen: new WeakSet(), seenIm: new WeakSet(), R: 24, avg: 33, t: 0, rebuildT: 0, v: new THREE.Vector3(), b: new THREE.Box3(), s: new THREE.Sphere(), indoors: false };
  rebuild();
  return C;
}

// 나중에 생긴 점조명(보조 귀신 · 패치 소품 · 이벤트 조명)도 풀로 흡수 — 빠지면 조명 수가 바뀌어 전체 셰이더 재컴파일(수백 ms 멈춤)
function scanLights() {
  const seen = new Set(C.src); C.src = C.src.filter(o => o.parent);
  C.scene.traverse(o => { if (o.isPointLight && !o.userData.perfPool) { if (o.layers.test(C.camera.layers)) { o.layers.disable(0); o.layers.enable(HIDE); } if (!seen.has(o)) C.src.push(o); } });
}
function rebuild() {
  const { scene, floors, world } = C;
  // 점조명 (풀 제외) — 카메라 레이어에서 빼 조명 개수 계산에 들어가지 않게
  C.src = [];
  scanLights();
  const roots = [...floors.filter(f => f && f.interior).map(f => [f.interior, 'in']), [world.OUT, 'out'],
    ...scene.children.filter(c => /^(REBUILD|FAC_)/.test(c.name)).map(c => [c, 'in'])];   // 재건축 본관 · 별관 · 신축 시설은 씬에 바로 붙어 거리 컬링에서 빠져 있었다
  for (const [root, kind] of roots) visit(root, kind, 0);
}
function visit(o, kind, depth) {
  for (const c of o.children) {
    if (c.isInstancedMesh) { if (c.count >= 1 && c.count <= 600 && kind === 'in' && !C.seenIm.has(c)) addIm(c, kind); continue; }   // 실내 가구만 (풀 · 나무 같은 수천 개 야외 인스턴스는 제외 — 매번 다시 올리는 비용이 더 컸다)
    if (c.isLight || c.isSprite || c.isPoints || c.userData.noCull) continue;
    if (C.seen.has(c)) { if (c.userData.perfSplit) visit(c, kind, depth + 1); continue; }
    C.b.setFromObject(c); if (C.b.isEmpty()) continue; if (kind === 'out' && C.b.max.y <= 0.38 && (C.b.max.y - C.b.min.y) < 0.55) continue; C.b.getBoundingSphere(C.s);
    let hasIm = false; if (C.s.radius < 5) c.traverse(m => { if (m.isInstancedMesh && m.count >= 1) hasIm = true; });
    if (C.s.radius < 5 && !hasIm) { const ms = []; c.traverse(m => { if (m.isMesh && !m.isInstancedMesh) ms.push(m); }); C.units.push({ c: C.s.center.clone(), r: C.s.radius, ms, kind, far: false }); C.seen.add(c); }
    else if (depth < 6) { c.userData.perfSplit = true; C.seen.add(c); visit(c, kind, depth + 1); }
  }
}
function addIm(im, kind) {
  C.seenIm.add(im);
  if (!im.geometry.boundingSphere) im.geometry.computeBoundingSphere();
  const n = im.count;
  C.ims.push({ im, kind, n, src: im.instanceMatrix.array.slice(0, n * 16), col: im.instanceColor ? im.instanceColor.array.slice(0, n * 3) : null, r: im.geometry.boundingSphere.radius, k: n });
}

function cullStep() {
  const p = C.camera.getWorldPosition(C.v), R = C.R, ind = C.indoors;
  const lim = kind => kind === 'out' ? (ind ? R * .8 : 75) : (ind ? R : R * .8);
  for (const u of C.units) {
    const far = u.c.distanceTo(p) - u.r > lim(u.kind) * (u.r > 2 ? 1.4 : 1);
    if (far === u.far) continue; u.far = far;
    for (const m of u.ms) { if (far) { m.layers.disable(0); m.layers.enable(HIDE); } else m.layers.enable(0); }
  }
  for (const e of C.ims) {
    const { im, src, col, n, r } = e, L = lim(e.kind), arr = im.instanceMatrix.array, w = im.matrixWorld.elements;
    let k = 0, changed = false;
    for (let i = 0; i < n; i++) {
      const o = i * 16, lx = src[o + 12], ly = src[o + 13], lz = src[o + 14];
      const dx = w[0] * lx + w[4] * ly + w[8] * lz + w[12] - p.x, dy = w[1] * lx + w[5] * ly + w[9] * lz + w[13] - p.y, dz = w[2] * lx + w[6] * ly + w[10] * lz + w[14] - p.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) - r < L) {
        if (arr[k * 16 + 12] !== lx || arr[k * 16 + 14] !== lz || arr[k * 16 + 13] !== ly) { arr.set(src.subarray(o, o + 16), k * 16); if (col) im.instanceColor.array.set(col.subarray(i * 3, i * 3 + 3), k * 3); changed = true; }
        k++;
      }
    }
    if (k !== e.k || changed) { e.k = k; im.count = k; im.instanceMatrix.needsUpdate = true; if (col) im.instanceColor.needsUpdate = true; }
  }
}

function lightStep() {
  const p = C.camera.getWorldPosition(C.v), cand = [];
  for (const l of C.src) {
    if (!l.visible || l.intensity <= 0) continue;
    let vis = true; for (let a = l.parent; a; a = a.parent) if (!a.visible) { vis = false; break; }
    if (!vis || !l.parent) continue;
    const wp = (l._wp ||= new C.THREE.Vector3()); l.getWorldPosition(wp); const d = wp.distanceTo(p);
    if (l.distance > 0 && d > l.distance + 30) continue;
    cand.push([d, l, wp]);
  }
  cand.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < POOL; i++) {
    const q = C.pool[i], c = cand[i];
    if (!c) { q.intensity = 0; continue; }
    const l = c[1]; q.position.copy(c[2]); q.color.copy(l.color); q.intensity = l.intensity; q.distance = l.distance; q.decay = l.decay;
  }
}

export function perfTick(dt, indoors) {
  if (!C) return;
  C.indoors = !!indoors;
  lightStep();
  const ms = Math.min(250, dt * 1000); C.avg += (ms - C.avg) * .05;
  C.t += dt; C.rebuildT += dt;
  C.rbN ||= 0; if (C.rebuildT > [4, 15, 40][C.rbN] && C.rbN < 3) { C.rbN++; rebuild(); }   // 늦게 불러오는 소품 GLB 도 컬링에 넣는다
  C.lightT = (C.lightT || 0) + dt; if (C.lightT > 1.5) { C.lightT = 0; scanLights(); }
  if (C.t > .25) {
    C.t = 0; const t0 = performance.now();
    if (C.avg > 45) C.R = Math.max(14, C.R - 1); else if (C.avg < 24) C.R = Math.min(30, C.R + .5);
    cullStep(); C.cullMs = Math.round(performance.now() - t0);
  }
}
export function perfInfo() { return C ? { R: C.R, avg: Math.round(C.avg), units: C.units.length, ims: C.ims.length, lights: C.src.length, cullMs: C.cullMs, rebuildMs: C.rebuildMs } : null; }

// 백그라운드 셰이더 준비: 시작 후 늦게 불러오는 모델(문 · 소품 GLB)은 로딩 때 warmUp 에 빠져, 처음 보는 순간
// 셰이더를 만드느라 1~2초 멈췄다. 층마다 잠깐 visible 로 두고 compileAsync (병렬 컴파일 확장이 없으면 건너뜀).
// 셰이더 예열: 처음 보는 구역마다 새 셰이더를 만드느라 0.1~0.5초씩 멈추던 문제 (측정: 구역 이동마다 87 → 271개 생성).
// 예전처럼 층마다 23번 따로 돌리지 않고, 타이틀 화면에서 씬 전체를 한 번에 컴파일한다.
export async function prewarmFloors(force = false, rt = null) {
  if (!C || (C.prewarm && (!force || C.prewarm.pending))) return;
  const { renderer, scene, camera } = C;
  C.prewarm = { pending: true };
  const t0 = performance.now(), p0 = renderer.info.programs.length, shown = [], hid = [];
  scene.traverse(o => { if (!o.visible && !o.isLight) { o.visible = true; shown.push(o); } if (o.isMesh && !o.layers.test(camera.layers)) { o.layers.enable(0); hid.push(o); } });
  const restore = () => { shown.forEach(o => { o.visible = false; }); hid.forEach(o => o.layers.disable(0)); };
  // 실제 화면은 후처리 렌더 타깃에 그린다 → 톤매핑 · 색공간이 달라 셰이더가 따로 생긴다. 화면 직접 · 렌더 타깃 두 경우 모두 예열
  const prevRT = renderer.getRenderTarget(), targets = [null, ...(rt ? [rt] : [])], pend = [];
  try {
    const par = renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile');
    for (const t of targets) { renderer.setRenderTarget(t); if (par) pend.push(renderer.compileAsync(scene, camera)); else renderer.compile(scene, camera); }
    renderer.setRenderTarget(prevRT); restore(); await Promise.all(pend);
  } catch (e) { renderer.setRenderTarget(prevRT); restore(); }
  C.prewarm = { ms: Math.round(performance.now() - t0), progs: renderer.info.programs.length - p0 }; (window.__prewarm ||= []).push(C.prewarm);
}

// CCTV captures need their own culling/light selection, then restore the player budget.
export function withPerfCamera(camera, indoors, render) {
  if (!C) return render();
  const previousCamera=C.camera, previousIndoors=C.indoors;
  C.camera=camera;C.indoors=!!indoors;
  try {lightStep();cullStep();return render();}
  finally {C.camera=previousCamera;C.indoors=previousIndoors;lightStep();cullStep();}
}
