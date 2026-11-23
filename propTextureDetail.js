// Prop wear maps: lockers, whiteboards/chalkboards, vending machines, benches, desks/chairs and pickups that read blurry or flat.
// Adds ONE small shared grayscale canvas per kind (256px) as bump + roughness map on materials that lack them.
// It never replaces an existing colour map and reuses nothing from furnitureTextureDetail / surfaceMacro / surfaceDetail (those handle
// authored PBR packs, big flat surfaces and map-less solid colours). Skipped by the caller on the 'igpu' preset.
import * as THREE from './vendor/three.module.js';

const rng = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const KINDS = {
  // 사물함: 세로 도장 결 + 문짝 긁힘 + 움푹한 눌림
  locker: (g, n, r) => { g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, n, n);
    for (let x = 0; x < n; x++) { const v = 188 + r() * 50 | 0; g.fillStyle = `rgba(${v},${v},${v},.5)`; g.fillRect(x, 0, 1, n); }
    for (let i = 0; i < 46; i++) { g.strokeStyle = `rgba(${r() < .5 ? 90 : 245},${r() < .5 ? 90 : 245},${r() < .5 ? 90 : 245},.35)`; g.lineWidth = .7; const x = r() * n, y = r() * n; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 70, y + (r() - .5) * 8); g.stroke(); }
    for (let i = 0; i < 6; i++) { const x = r() * n, y = r() * n, rad = 12 + r() * 26, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(90,90,90,.55)'); gr.addColorStop(1, 'rgba(90,90,90,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); } },
  // 칠판 · 화이트보드: 지우개 쓸린 호 + 희미한 마커 잔상 + 하단 분필 · 마커 가루
  board: (g, n, r) => { g.fillStyle = '#e2e2e2'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 26; i++) { const y = r() * n, a = .02 + r() * .05; g.strokeStyle = `rgba(120,120,120,${a})`; g.lineWidth = 6 + r() * 16; g.beginPath(); g.moveTo(-10, y); g.bezierCurveTo(n * .3, y + 18 * (r() - .5), n * .7, y + 26 * (r() - .5), n + 10, y + 10 * (r() - .5)); g.stroke(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(150,150,150,${.1 + r() * .2})`; g.fillRect(r() * n, r() * n, 6 + r() * 30, 1); }
    g.fillStyle = 'rgba(110,110,110,.28)'; g.fillRect(0, n - 10, n, 10); },
  // 자판기: 판금 헤어라인 + 손때 얼룩 + 모서리 긁힘
  vending: (g, n, r) => { g.fillStyle = '#d6d6d6'; g.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y++) { const v = 226 + r() * 22 | 0; g.fillStyle = `rgba(${v},${v},${v},.5)`; g.fillRect(0, y, n, 1); }
    for (let i = 0; i < 14; i++) { const x = r() * n, y = r() * n, rad = 8 + r() * 22, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(150,150,150,.32)'); gr.addColorStop(1, 'rgba(150,150,150,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
    for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(80,80,80,.35)'; g.lineWidth = .8; const x = r() * n, y = r() * n; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 40, y + (r() - .5) * 30); g.stroke(); } },
  // 나무(벤치 · 책걸상 상판): 긴 결 + 옹이 + 마른 균열
  wood: (g, n, r) => { g.fillStyle = '#d4d4d4'; g.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y++) { const v = 170 + 70 * (.5 + .5 * Math.sin(y * .17 + Math.sin(y * .05) * 3)) * (.7 + r() * .3) | 0; g.fillStyle = `rgba(${v},${v},${v},.6)`; g.fillRect(0, y, n, 1); }
    for (let i = 0; i < 4; i++) { g.strokeStyle = 'rgba(100,100,100,.45)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(r() * n, r() * n, 8 + r() * 10, 3 + r() * 3, 0, 0, 7); g.stroke(); }
    for (let i = 0; i < 5; i++) { g.strokeStyle = 'rgba(70,70,70,.4)'; g.lineWidth = .8; const x = r() * n, y = r() * n; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 30 + r() * 60, y + (r() - .5) * 4); g.stroke(); } },
  // 주울 수 있는 소품: 가벼운 닳음 알갱이
  pickup: (g, n, r) => { g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 4200; i++) { const v = 170 + r() * 85 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * n, r() * n, 1, 1); }
    for (let i = 0; i < 12; i++) { g.strokeStyle = 'rgba(110,110,110,.3)'; g.lineWidth = .7; const x = r() * n, y = r() * n; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 30, y + (r() - .5) * 30); g.stroke(); } },
};
const TEX = {};
function tex(kind) {
  if (TEX[kind]) return TEX[kind];
  const c = document.createElement('canvas'); c.width = c.height = 256; KINDS[kind](c.getContext('2d'), 256, rng(7 + kind.length * 31));
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace; t.userData.propDetail = kind;
  return (TEX[kind] = t);
}
const SKIP = /window|screen|glass|lamp|light|glow|ghost|mina|guard|char|hair|skin|eye|fx|flame|fog|led|bulb|exit|sign|water/i;
// 이름(자신 + 부모 3단계)과 재질 이름으로 종류를 고른다
export function propKind(name) {
  const s = String(name || '');
  if (/locker|사물함/i.test(s)) return 'locker';
  if (/whiteboard|chalkboard|blackboard|칠판|^(RB_)?board|_BOARD$|BOARD/.test(s) && !/INV_BOARD|scoreboard|bulletin|notice/i.test(s)) return 'board';
  if (/vending|자판기/i.test(s)) return 'vending';
  if (/bench|벤치/i.test(s)) return 'wood';
  if (/(^|_)(desk|chair)(top|leg|_|$)|SchoolDesk|SchoolChair|책상|의자/i.test(s)) return 'wood';
  return null;
}
function patch(m, kind) {
  if (!m || !m.isMeshStandardMaterial || m.userData.propDetail || m.userData.noDetail) return false;
  if (m.transparent || m.opacity < 1 || m.wireframe || m.vertexColors || SKIP.test(m.name || '')) return false;
  if (m.emissive && m.emissiveIntensity > .2 && m.emissive.getHex() !== 0) return false;
  const t = tex(kind); let ch = 0;
  if (!m.bumpMap) { m.bumpMap = t; m.bumpScale = kind === 'locker' || kind === 'vending' ? 2.2 : kind === 'board' ? 1 : 1.6; ch++; }
  if (!m.map) { m.map = t; m.color.multiplyScalar(1.18); ch++; }   // 민무늬 단색 면에는 얼룩 · 긁힘을 색에도 (이미 맵이 있으면 그대로 둔다)
  if (!m.roughnessMap) { m.roughnessMap = t; ch++; }
  m.userData.propDetail = kind; if (ch) m.needsUpdate = true; return !!ch;
}
// 장면을 훑어 해당 소품의 재질에만 붙인다 (재질당 한 번). 반환: { n, kinds }
export function applyPropDetail(root, { items = [] } = {}) {
  const kinds = {}; let n = 0;
  const go = (m, kind) => { if (patch(m, kind)) { n++; kinds[kind] = (kinds[kind] || 0) + 1; } };
  root.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || !o.geometry || !o.geometry.attributes.uv || !o.geometry.attributes.normal) return;
    let nm = '', a = o; for (let i = 0; i < 4 && a; i++, a = a.parent) nm += ' ' + (a.name || '');
    const kind = propKind(nm); if (!kind) return;
    for (const m of [].concat(o.material)) go(m, kind);
  });
  for (const it of items) if (it && it.mesh) it.mesh.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && o.geometry?.attributes.uv && o.geometry.attributes.normal) for (const m of [].concat(o.material)) go(m, 'pickup'); });
  return { n, kinds };
}
