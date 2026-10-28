// 캠퍼스 구역 재배치 (부하 분산 · 동선 정리): 동쪽 = 스포츠 섹션(수영장 · 체육관 · 농구장 · 테니스/양궁장 · 야구장),
//   서쪽 = 학술 · 생활 섹션(청운학사 · 학생회관 · 역사관 · 과학천문관), 체육관 자리 = 대강당.
//   주차장 · 제2주차장 · 자전거 보관소 · 소각장은 철거한다.
//   시설 재건축(facilityRebuild)이 짓는 건물은 ZONES 좌표만 바꾸면 새 자리에 지어지므로, 여기서는 그 안의 조사 지점 · 문 같은 데이터만 옮긴다.
//   나머지(체육관 외관 · 코트 · 경기장 묶음)는 메시째로 옮긴다: 묶음이 구역 안에 다 들어가면 통째로, 합쳐진(bake) 메시는 삼각형 단위로 나눠서.
import * as THREE from './vendor/three.module.js';

// [이름, 원래 구역 x1, x2, z1, z2, 새 중심으로의 이동 dx, dz, 회전(0 | π: 구역 중심 기준 반 바퀴 — 출입구 방향을 동편 대로 쪽으로)]
export const MOVES = [
  ['체육관', 27.4, 48.6, 11.8, 37.2, 46, -62.5, 0],
  ['야외농구장', 28.2, 44.2, 37.6, 54.2, 22, -39, 0],
  ['테니스 · 양궁장', -99.5, -76.5, -25.5, -6.5, 172, -1, Math.PI],
  ['야구 스타디움', -101.5, -74.5, -0.5, 28.5, 172, -6, Math.PI],
];
// 시설 재건축 건물: 옛 자리 → 새 자리 (facilityRebuild ZONES 와 같은 값)
export const FAC_MOVES = {
  hist: { from: [84, -11], to: [-88, -16], W: 15.6, D: 10.6 },
  astro: { from: [84, -34], to: [-88, 14], W: 20, D: 16 },
  aud: { from: [-25, -48], to: [38, 24], W: 18, D: 26 },
  pool: { from: [-41, 41], to: [58, 35], W: 14, D: 20 },
};
// 철거: 제1주차장 · 제2주차장(스쿨버스 · 정류장) · 자전거 보관소 · 소각장(분리수거장 · 공중전화 포함)
export const REMOVES = [
  ['제1주차장', 14.2, 47.2, 57.2, 69.4],
  ['제2주차장', -99.5, -52.5, 60.6, 70.2],
  ['자전거 보관소', 51.4, 64.6, -7.4, -1.8],
  ['소각장', 77.5, 95.5, 9.4, 23.6],
];
// 철거 구역 안이라도 남기는 조사 지점 (경비실 우편함 · 테이프 #2)
const KEEP_PROP = /우편함|카세트테이프 수거/;

const inR = (r, x, z, m = 0) => x > r[0] - m && x < r[1] + m && z > r[2] - m && z < r[3] + m;

export function relayoutCampus({ scene, floors, world }) {
  const pave = world.OUT && world.OUT.userData.pave;   // 옛 보도블록: 옮기지 않고 걷는다 (인도는 새 동선으로 다시 깐다)
  const t0 = performance.now(), F0 = floors[0];
  const inner = new Set(); floors.forEach((F, i) => { if (F && i !== 0) { inner.add(F.interior); if (F.shell) inner.add(F.shell); } });
  const moves = MOVES.map(([name, x1, x2, z1, z2, dx, dz, rot]) => ({ name, r: [x1, x2, z1, z2], dx, dz, rot, cx: (x1 + x2) / 2, cz: (z1 + z2) / 2 }));
  // 구역 중심 기준 회전 → 이동 (월드 x, z)
  const xf = (m, x, z) => { let px = x - m.cx, pz = z - m.cz; if (m.rot) { px = -px; pz = -pz; } return [m.cx + px + m.dx, m.cz + pz + m.dz]; };
  const mat = m => { const M = new THREE.Matrix4().makeTranslation(m.cx + m.dx, 0, m.cz + m.dz); if (m.rot) M.multiply(new THREE.Matrix4().makeRotationY(m.rot)); return M.multiply(new THREE.Matrix4().makeTranslation(-m.cx, 0, -m.cz)); };
  const stats = { whole: 0, split: 0, inst: 0, lights: 0, removed: 0, cols: 0, props: 0 };

  // ── 1) 메시 수집 (모든 구역을 먼저 판정한 뒤 한꺼번에 옮긴다 — 서로 자리를 바꾸는 구역끼리 두 번 옮기지 않게) ──
  const bb = new THREE.Box3(), c = new THREE.Vector3(), sz = new THREE.Vector3(), v = new THREE.Vector3();
  const live = new Set(); [...(world.props || []), ...(world.items || [])].forEach(p => { if (p.mesh) p.mesh.traverse(o => live.add(o)); });
  const jobs = [];   // { kind: 'whole'|'split'|'inst'|'light', o, m (move) | rm (remove) }
  const zones = [...moves.map(m => ({ r: m.r, m })), ...REMOVES.map(([name, ...r]) => ({ r, rm: name }))];
  const zoneOf = (x, z) => zones.find(Z => inR(Z.r, x, z));
  scene.updateMatrixWorld(true);
  const walk = o => {
    if (inner.has(o) || o.isCamera || o.isSkinnedMesh || o.userData.relaid) return;
    if (o.isLight) { if (o.isAmbientLight || o.isHemisphereLight || o.isDirectionalLight) return; o.getWorldPosition(v); const Z = zoneOf(v.x, v.z); if (Z && v.y > -1 && v.y < 16) jobs.push({ kind: 'light', o, ...Z }); return; }
    if (o.isInstancedMesh) { jobs.push({ kind: 'inst', o }); return; }
    bb.setFromObject(o); if (bb.isEmpty()) return; bb.getSize(sz);
    if (bb.max.y < -1 || bb.min.y > 40) return;
    if (bb.max.y < .06 && Math.max(sz.x, sz.z) > 60) return;   // 캠퍼스 바닥 · 잔디 · 큰 도로
    // 통째로: 상자 전체가 한 구역 안 (조금 여유)
    const Z = zones.find(Z => bb.min.x > Z.r[0] - .6 && bb.max.x < Z.r[1] + .6 && bb.min.z > Z.r[2] - .6 && bb.max.z < Z.r[3] + .6);
    if (Z) { if (Z.rm && live.has(o)) return; if (Z.rm && o.children.length && [...live].some(l => { for (let a = l; a; a = a.parent) if (a === o) return true; return false; })) { o.children.slice().forEach(walk); return; }
      jobs.push({ kind: 'whole', o, ...Z }); return; }
    if (!zones.some(Z => bb.max.x > Z.r[0] && bb.min.x < Z.r[1] && bb.max.z > Z.r[2] && bb.min.z < Z.r[3])) return;
    if (o.isMesh) { if (!live.has(o) && o.geometry && o.geometry.attributes.position && !Array.isArray(o.material)) jobs.push({ kind: 'split', o }); return; }
    o.children.slice().forEach(walk);
  };
  scene.children.slice().forEach(walk);

  // ── 2) 적용 ──
  const parentInv = new THREE.Matrix4();
  const place = (o, M) => { o.updateMatrixWorld(true); const W = M.clone().multiply(o.matrixWorld); parentInv.copy(o.parent.matrixWorld).invert(); W.premultiply(parentInv); W.decompose(o.position, o.quaternion, o.scale); o.updateMatrixWorld(true); o.userData.relaid = true; o.userData.facKeep = true; };
  const kill = o => { if (o.parent) o.parent.remove(o); stats.removed++; };
  for (const j of jobs) {
    if (j.kind === 'light') { if (j.rm) { j.o.visible = false; j.o.intensity = 0; } else place(j.o, mat(j.m)); stats.lights++; continue; }
    if (j.kind === 'whole') { if (j.rm) kill(j.o); else { place(j.o, mat(j.m)); stats.whole++; } continue; }
    if (j.kind === 'inst') { splitInstances(j.o); continue; }
    if (j.kind === 'split') splitMesh(j.o);
  }
  function splitInstances(o) {
    const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), W = new THREE.Matrix4(), inv = new THREE.Matrix4().copy(o.matrixWorld).invert(); let hit = 0;
    const e = window.__perfInst && window.__perfInst(o), arr = e ? e.src : null, n = e ? e.n : o.count;
    for (let i = 0; i < n; i++) {
      if (arr) m4.fromArray(arr, i * 16); else o.getMatrixAt(i, m4);
      if (m4.elements[0] === 0 && m4.elements[5] === 0 && m4.elements[10] === 0) continue;
      W.multiplyMatrices(o.matrixWorld, m4); p.setFromMatrixPosition(W); if (p.y < -1 || p.y > 30) continue;
      const Z = zoneOf(p.x, p.z); if (!Z) continue;
      if (Z.rm) m4.makeScale(0, 0, 0); else m4.multiplyMatrices(inv, mat(Z.m).multiply(W));
      if (arr) m4.toArray(arr, i * 16); o.setMatrixAt(i, m4); hit++;
    }
    if (hit) { o.instanceMatrix.needsUpdate = true; if (o.boundingSphere) o.computeBoundingSphere(); if (o.boundingBox) o.computeBoundingBox(); stats.inst += hit; }
  }
  // 합쳐진 메시: 삼각형 무게중심이 든 구역별로 떼어 낸다 (옮길 것은 새 메시로, 철거할 것은 버림)
  function splitMesh(o) {
    let g = o.geometry; g = g.index ? g.toNonIndexed() : g.clone();
    const pos = g.attributes.position, n = pos.count / 3, M = o.matrixWorld, a = new THREE.Vector3(), b2 = new THREE.Vector3(), c2 = new THREE.Vector3();
    const tag = new Int16Array(n).fill(-1); let any = false;
    for (let t = 0; t < n; t++) { a.fromBufferAttribute(pos, t * 3).applyMatrix4(M); b2.fromBufferAttribute(pos, t * 3 + 1).applyMatrix4(M); c2.fromBufferAttribute(pos, t * 3 + 2).applyMatrix4(M);
      const x = (a.x + b2.x + c2.x) / 3, y = (a.y + b2.y + c2.y) / 3, z = (a.z + b2.z + c2.z) / 3; if (y < -1 || y > 30) continue;
      const Z = zones.findIndex(Z => inR(Z.r, x, z)); if (Z >= 0) { tag[t] = Z; any = true; } }
    if (!any) return;
    const pick = sel => { const out = new THREE.BufferGeometry(); for (const [k, at] of Object.entries(g.attributes)) { const s = at.itemSize, src = at.array, dst = new src.constructor(sel.length * 3 * s); sel.forEach((t, i) => dst.set(src.subarray(t * 3 * s, (t + 1) * 3 * s), i * 3 * s)); out.setAttribute(k, new THREE.BufferAttribute(dst, s, at.normalized)); } return out; };
    const keep = []; const by = new Map(); for (let t = 0; t < n; t++) { if (tag[t] < 0) keep.push(t); else { if (!by.has(tag[t])) by.set(tag[t], []); by.get(tag[t]).push(t); } }
    const ng = pick(keep); ng.computeBoundingSphere(); ng.computeBoundingBox(); o.geometry = ng;
    for (const [zi, list] of by) { const Z = zones[zi]; if (Z.rm || o.material === pave) { stats.removed += list.length; continue; }
      const mg = pick(list); mg.applyMatrix4(M); mg.applyMatrix4(mat(Z.m)); mg.computeBoundingSphere(); mg.computeBoundingBox();
      const mm = new THREE.Mesh(mg, o.material); mm.castShadow = o.castShadow; mm.receiveShadow = o.receiveShadow; mm.renderOrder = o.renderOrder; mm.name = (o.name || 'baked') + '_relaid';
      mm.userData.relaid = true; mm.userData.facKeep = true; mm.userData.rbKeep = true; mm.layers.mask = o.layers.mask; scene.add(mm); stats.split += list.length; }
  }

  // ── 3) 데이터: 충돌 상자 · 조사 지점 · 아이템 · 문 · 숨는 곳 — 모두 원래 좌표로 먼저 판정한 뒤 옮긴다 (옮긴 자리가 다른 구역에 들어가 두 번 옮겨지지 않게) ──
  //   시설 재건축 건물(FAC_MOVES)은 데이터만 평행 이동, 나머지 구역은 회전 포함 변환
  const facR = Object.values(FAC_MOVES).map(fm => ({ r: [fm.from[0] - fm.W / 2 - 2.5, fm.from[0] + fm.W / 2 + 2.5, fm.from[1] - fm.D / 2 - 2.5, fm.from[1] + fm.D / 2 + 2.5], dx: fm.to[0] - fm.from[0], dz: fm.to[1] - fm.from[1] }));
  const judge = (x, z) => { const Z = zoneOf(x, z); if (Z) return Z; const f = facR.find(f => inR(f.r, x, z)); return f ? { fac: f } : null; };
  const to = (J, x, z) => J.fac ? [x + J.fac.dx, z + J.fac.dz] : xf(J.m, x, z);
  const ops = [];
  for (const k of ['col', 'walls', 'doorWalls']) { const L = F0[k]; if (!L) continue;
    F0[k] = L.filter(rr => { if (rr.x1 == null || rr._rl) return true; const J = judge((rr.x1 + rr.x2) / 2, (rr.z1 + rr.z2) / 2); if (!J) return true; if (J.rm) return false; if (J.fac) return true;   // 시설 옛 터 충돌은 재건축이 걷는다
      rr._rl = true; ops.push(() => { const [ax, az] = to(J, rr.x1, rr.z1), [bx, bz] = to(J, rr.x2, rr.z2); rr.x1 = Math.min(ax, bx); rr.x2 = Math.max(ax, bx); rr.z1 = Math.min(az, bz); rr.z2 = Math.max(az, bz); rr.facKeep = true; stats.cols++; }); return true; }); }
  const meshMoved = o => { for (let a = o; a; a = a.parent) if (a.userData.relaid) return true; return false; };
  const shift = (mesh, J) => { if (!mesh || meshMoved(mesh)) return; if (J.fac) { mesh.position.x += J.fac.dx; mesh.position.z += J.fac.dz; } else place(mesh, mat(J.m)); };
  world.props = (world.props || []).filter(p => { if (p.floor !== 0) return true; const J = judge(p.x, p.z); if (!J) return true; if (J.rm) return KEEP_PROP.test(p.label || '');
    ops.push(() => { [p.x, p.z] = to(J, p.x, p.z); if (p.bx != null) [p.bx, p.bz] = to(J, p.bx, p.bz); shift(p.mesh, J); stats.props++; }); return true; });
  (world.items || []).forEach(it => { if (it.floor !== 0 || !it.pos) return; const J = judge(it.pos.x, it.pos.z); if (!J || J.rm) return; ops.push(() => { [it.pos.x, it.pos.z] = to(J, it.pos.x, it.pos.z); shift(it.mesh, J); }); });
  (world.lockers || []).forEach(l => { if (l.floor !== 0) return; const J = judge(l.x, l.z); if (!J || J.rm) return; ops.push(() => { [l.x, l.z] = to(J, l.x, l.z); if (l.dir && J.m && J.m.rot) { l.dir.x = -l.dir.x; l.dir.z = -l.dir.z; } }); });
  (world.doors || []).forEach(d => { if (d.floor === 0) { const J = judge(d.x, d.z); if (J && !J.rm) ops.push(() => { [d.x, d.z] = to(J, d.x, d.z); }); }
    if (d.to && d.to.floor === 0) { const J = judge(d.to.x, d.to.z); if (J && !J.rm) ops.push(() => { [d.to.x, d.to.z] = to(J, d.to.x, d.to.z); if (J.m && J.m.rot && d.to.yaw != null) d.to.yaw += Math.PI; }); } });
  ops.forEach(f => f());
  const out = { ...stats, jobs: jobs.length, ms: Math.round(performance.now() - t0) };
  window.__relayout = out;
  // 나중에 불러오는 모델(GLB): 옛 구역에 새로 나타난 것만 다시 옮기거나 걷는다
  const seen = new WeakSet(); scene.traverse(o => seen.add(o));
  const again = () => { const fresh = []; scene.traverse(o => { if (seen.has(o)) return; seen.add(o); if (o.isMesh && !o.isSkinnedMesh && !o.userData.relaid && !live.has(o)) fresh.push(o); });
    scene.updateMatrixWorld(true);
    fresh.forEach(o => { let rel = false; for (let a = o.parent; a; a = a.parent) if (a.userData.relaid || inner.has(a)) rel = true; if (rel) return; bb.setFromObject(o); if (bb.isEmpty()) return; bb.getCenter(c); const Z = zoneOf(c.x, c.z); if (!Z || bb.max.y < -1) return;
      bb.getSize(sz); if (Math.max(sz.x, sz.z) > 40) return; if (Z.rm) kill(o); else place(o, mat(Z.m)); }); };
  [4000, 12000, 30000, 70000].forEach(ms => setTimeout(again, ms));
  return out;
}
