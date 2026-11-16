// 텍스처 없는 단색 가구 · 장식 · 시설 재질에 가벼운 표면 디테일을 입힌다 (깨진 블록처럼 보이던 민무늬 면 보완)
// 256px 캔버스 텍스처 5종을 한 번만 만들어 모든 재질이 공유한다 — 색은 재질 color 가 곱해지므로 텍스처는 밝은 회색 계열
import * as THREE from './vendor/three.module.js';
import { makePMREM } from './engine.js?v=436';

const TEX = {};
const rnd = (() => { let s = 9; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
function canvas(draw) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); draw(g, 256);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const KINDS = {
  // 분체 도장 · 페인트: 얼룩진 농담 + 미세 반점 + 드문 긁힘
  paint: (g, n) => { g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 70; i++) { const v = 222 + rnd() * 30 | 0; g.fillStyle = `rgba(${v},${v},${v},.35)`; g.beginPath(); g.arc(rnd() * n, rnd() * n, 8 + rnd() * 34, 0, 7); g.fill(); }
    for (let i = 0; i < 2600; i++) { const v = 205 + rnd() * 50 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd() * n, rnd() * n, 1, 1); }
    g.strokeStyle = 'rgba(150,150,150,.35)'; for (let i = 0; i < 6; i++) { g.beginPath(); const x = rnd() * n, y = rnd() * n; g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 40, y + (rnd() - .5) * 12); g.stroke(); } },
  // 헤어라인 금속
  brushed: (g, n) => { for (let y = 0; y < n; y++) { const v = 214 + rnd() * 36 | 0; g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(0, y, n, 1); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(170,170,170,.25)'; g.fillRect(rnd() * n, rnd() * n, 20 + rnd() * 80, 1); } },
  // 나뭇결
  wood: (g, n) => { g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y += 1) { const v = 205 + 40 * (.5 + .5 * Math.sin(y * .21 + Math.sin(y * .043) * 3)) * (.75 + rnd() * .25) | 0; g.fillStyle = `rgba(${v},${v},${v},.55)`; g.fillRect(0, y, n, 1); }
    for (let i = 0; i < 5; i++) { g.strokeStyle = 'rgba(150,150,150,.4)'; g.beginPath(); g.ellipse(rnd() * n, rnd() * n, 10 + rnd() * 10, 3 + rnd() * 3, 0, 0, 7); g.stroke(); } },
  // 유약 · 매끈한 플라스틱: 아주 옅은 지문 · 물자국
  glaze: (g, n) => { g.fillStyle = '#f6f6f6'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(200,200,200,.18)'; g.beginPath(); g.arc(rnd() * n, rnd() * n, 4 + rnd() * 20, 0, 7); g.fill(); } },
  // 거친 면 (콘크리트 · 고무 · 코르크 · 천)
  rough: (g, n) => { g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 9000; i++) { const v = 175 + rnd() * 80 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd() * n, rnd() * n, 1 + (rnd() < .1), 1 + (rnd() < .1)); }
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(185,185,185,.3)'; g.beginPath(); g.arc(rnd() * n, rnd() * n, 6 + rnd() * 22, 0, 7); g.fill(); } },
};
const tex = k => TEX[k] || (TEX[k] = canvas(KINDS[k]));
const SKIP = /window|screen|lamp|glass|sky(?!bridge)|water|exit|sign|light|glow|ghost|mina|guard|char|hair|skin|eye|fx|particle|flame|fog|led|bulb/i;

function kindOf(m) {
  if (m.metalness >= .5) return 'brushed';
  if (m.roughness < .25) return 'glaze';
  const c = m.color, hsl = {}; c.getHSL(hsl);
  if (hsl.h > .03 && hsl.h < .12 && hsl.s > .25 && hsl.l < .55 && hsl.l > .08) return 'wood';
  if (m.roughness >= .85) return 'rough';
  return 'paint';
}
// 재질 하나에 디테일 (이미 맵이 있거나 투명 · 발광 · 특수 재질이면 그대로)
// 같은 256px 무늬가 큰 면(벤치 · 덤불 · 마당 판)에 한 장으로 늘어나 20~50px/m 로 뭉개지던 것 → 재질이 덮는 가장 큰 크기에 맞춰 반복 (≥ ~110px/m)
//   반복 단계별 사본은 원본 이미지(Source)를 공유한다 — GPU 메모리 · 업로드는 한 벌
const REP = {};
const texRep = (k, rep) => { if (rep <= 1) return tex(k); const key = k + rep; if (REP[key]) return REP[key]; const t = tex(k).clone(); t.repeat.set(rep, rep); t.needsUpdate = true; return (REP[key] = t); };
const repFor = m => m <= 2.4 ? 1 : Math.min(16, 2 ** Math.round(Math.log2(m / 2.3)));   // m: UV 한 단위의 월드 길이 → 256px 한 장이 ≤ ~2.3m 를 덮게
export function detailize(m, name = '', rep = 1) {
  if (!m || !m.isMeshStandardMaterial || m.map || m.userData.noDetail || m.userData.detailed) return false;
  if (m.transparent || m.opacity < 1 || m.wireframe || m.vertexColors) return false;
  if (m.emissive && m.emissiveIntensity > .2 && m.emissive.getHex() !== 0) return false;
  if (SKIP.test(name) || SKIP.test(m.name || '')) return false;
  const k = kindOf(m), t = texRep(k, rep); m.map = t;
  if (k !== 'glaze') { m.bumpMap = t; m.bumpScale = k === 'rough' ? .9 : .35; m.roughnessMap = t; }   // 결 · 얼룩 따라 광택도 달라진다
  m.userData.detailed = true; m.needsUpdate = true; return true;
}
// 장면(또는 그룹)을 훑어 UV 가 있는 민무늬 메시 재질에 디테일 — 같은 재질은 한 번만
const _ws = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
// UV 한 단위가 덮는 월드 길이(m): 삼각형 월드 넓이 ÷ UV 넓이 (상자 · 구 · 원기둥 · 병합 묶음 모두 같은 식) — 표본 ≤400개
function uvMetres(o) {
  const g = o.geometry, p = g.attributes.position, uv = g.attributes.uv, ix = g.index, n = ix ? ix.count : p.count; o.getWorldScale(_ws);
  const st = Math.max(3, Math.floor(n / 3 / 400) * 3); let A = 0, U = 0;
  for (let t = 0; t + 2 < n; t += st) { const i0 = ix ? ix.getX(t) : t, i1 = ix ? ix.getX(t + 1) : t + 1, i2 = ix ? ix.getX(t + 2) : t + 2;
    _a.fromBufferAttribute(p, i0).multiply(_ws); _b.fromBufferAttribute(p, i1).multiply(_ws).sub(_a); _c.fromBufferAttribute(p, i2).multiply(_ws).sub(_a); A += _b.cross(_c).length() / 2;
    const u0 = uv.getX(i0), v0 = uv.getY(i0); U += Math.abs((uv.getX(i1) - u0) * (uv.getY(i2) - v0) - (uv.getX(i2) - u0) * (uv.getY(i1) - v0)) / 2; }
  return U > 1e-9 ? Math.sqrt(A / U) : 0; }
export function autoDetail(root) {
  let n = 0;
  root.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh && o.userData.noDetail || !o.geometry || !o.geometry.attributes.uv) return;
    let nm = '', a = o; for (let i = 0; i < 4 && a; i++, a = a.parent) nm += ' ' + (a.name || '');
    const ms = [].concat(o.material), size = ms.some(m => m && m.isMeshStandardMaterial && !m.map && !m.userData.detailed) ? uvMetres(o) : 0;
    for (const m of ms) if (detailize(m, nm, repFor(size))) n++;
  });
  return n;
}
// 실내 반사 환경광 (IBL): 형광등 패널이 달린 회색 방을 PMREM 으로 한 번 구워 장면 환경맵으로 — 금속 · 유약 · 니스 면에 은은한 반사
export function setupEnv(renderer, scene, intensity = .32) {
  if (scene.userData.envReady) return; scene.userData.envReady = true;
  const env = new THREE.Scene(), room = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 12), new THREE.MeshBasicMaterial({ color: 0x3a3c3e, side: THREE.BackSide })); room.position.y = 2; env.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ color: 0x241e18 })); floor.rotation.x = -Math.PI / 2; floor.position.y = .01; env.add(floor);
  const panel = new THREE.MeshBasicMaterial({ color: 0xe8eef4 });
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3], [0, 0]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.4, .35), panel); p.rotation.x = Math.PI / 2; p.position.set(x, 3.98, z); env.add(p); }
  const win = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.6), new THREE.MeshBasicMaterial({ color: 0x5a6a80 })); win.position.set(0, 2, -5.98); env.add(win);
  const pm = makePMREM(renderer), rt = pm.fromScene(env, .04); pm.dispose();
  scene.environment = rt.texture; scene.environmentIntensity = intensity;
  env.traverse(o => { if (o.geometry) o.geometry.dispose(); });
}

// 바닥 · 벽처럼 비스듬히 보는 면이 흐려지지 않게 모든 텍스처 이방성 필터를 올린다 (GPU 비용 거의 없음)
export function sharpenTextures(root, renderer, level = 8) {
  const max = Math.min(level, renderer.capabilities.getMaxAnisotropy?.() || 1), seen = new Set(); let n = 0;
  root.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { if (!m) continue; for (const k of ['map', 'normalMap', 'roughnessMap']) { const t = m[k]; if (!t || seen.has(t)) continue; seen.add(t); if ((t.anisotropy || 1) < max) { t.anisotropy = max; t.needsUpdate = true; n++; } } } });
  return n;
}
// 과도한 고폴리 소품 경량화: 상자처럼 단순한 모양인데 수십만 삼각형인 스캔 모델(골판지 상자 등) → 같은 크기 · 재질의 상자 지오메트리
export function slimHeavyProps(root, names = /cardboard_box/i, maxTris = 3000) {
  let n = 0, saved = 0;
  root.traverse(o => {
    if (!o.isMesh || !o.geometry) return; let nm = '', a = o; for (let i = 0; i < 5 && a; i++, a = a.parent) nm += ' ' + (a.name || ''); if (!names.test(nm)) return;
    const g = o.geometry, tris = (g.index ? g.index.count : g.attributes.position.count) / 3; if (tris <= maxTris) return;
    g.computeBoundingBox(); const bb = g.boundingBox, s = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const box = new THREE.BoxGeometry(Math.max(s.x, .001), Math.max(s.y, .001), Math.max(s.z, .001)); box.translate(c.x, c.y, c.z);
    o.geometry = box; g.dispose(); n++; saved += tris - 12;
  });
  return { n, saved };
}
