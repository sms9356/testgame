import * as THREE from './vendor/three.module.js';

// 멀리서 본 외벽 창 너머 교실 (원근 그림 한 장). 실제 실내(interior)는 멀면 그리지 않으므로
// 그 층 실내가 꺼져 있을 때만 이 판을 보여 준다 (층마다 그림 종류별 1 draw call).
const VARIANTS = 4;
function paintRoom(v) {
  const W = 256, H = 192, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let s = 1234 + v * 977; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const vx = W * (.42 + v * .05), vy = H * .5, bx0 = W * .18, bx1 = W * .82, by0 = H * .2, by1 = H * .72;   // 소실점 · 뒷벽
  const poly = (pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fillStyle = fill; g.fill(); };
  const dark = v === 1;
  poly([[0, 0], [W, 0], [bx1, by0], [bx0, by0]], dark ? '#2a2c2a' : '#7c8078');            // 천장
  poly([[0, H], [W, H], [bx1, by1], [bx0, by1]], dark ? '#241e18' : '#5e4a36');            // 나무 바닥
  poly([[0, 0], [bx0, by0], [bx0, by1], [0, H]], dark ? '#2e332f' : '#8e9a8c');            // 왼쪽 벽
  poly([[W, 0], [bx1, by0], [bx1, by1], [W, H]], dark ? '#2b302c' : '#86917f');            // 오른쪽 벽
  g.fillStyle = dark ? '#343a35' : '#a3ad9c'; g.fillRect(bx0, by0, bx1 - bx0, by1 - by0); // 뒷벽
  g.fillStyle = dark ? '#2a3229' : '#5f7660'; g.fillRect(bx0, by0 + (by1 - by0) * .62, bx1 - bx0, (by1 - by0) * .38);   // 허리 벽
  // 칠판 + 게시판
  g.fillStyle = '#5a4630'; g.fillRect(bx0 + 18, by0 + 12, (bx1 - bx0) * .58 + 4, 38);
  g.fillStyle = dark ? '#16241c' : '#24402f'; g.fillRect(bx0 + 20, by0 + 14, (bx1 - bx0) * .58, 34);
  g.strokeStyle = 'rgba(220,225,215,.35)'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(bx0 + 28 + r() * 20, by0 + 22 + k * 8); g.lineTo(bx0 + 60 + r() * 50, by0 + 22 + k * 8 + r() * 3); g.stroke(); }
  g.fillStyle = dark ? '#3c3324' : '#9c8456'; g.fillRect(bx1 - 40, by0 + 14, 28, 30);
  for (let k = 0; k < 5; k++) { g.fillStyle = ['#d8d0b8', '#c8b890', '#e0d8c8'][k % 3]; g.globalAlpha = dark ? .3 : .8; g.fillRect(bx1 - 38 + (k % 3) * 9, by0 + 16 + (k / 3 | 0) * 13, 7, 10); } g.globalAlpha = 1;
  // 형광등 (원근으로 줄어드는 줄)
  for (let k = 0; k < 3; k++) { const t = .25 + k * .25, y = by0 * (1 - t) * .9 + 4, x0 = vx - (vx - W * .2) * (1 - t) - 10, x1 = vx + (W * .8 - vx) * (1 - t) + 10; g.fillStyle = dark ? '#444' : (v === 2 && k === 1 ? '#8a8a80' : '#e8ecdf'); g.fillRect(x0, y, x1 - x0, 3 + (1 - t) * 4); }
  // 책상 · 의자 줄 (원근)
  const rows = 4, cols = 5;
  for (let i = rows - 1; i >= 0; i--) {
    const t = (i + .6) / (rows + .6), y = by1 + (H - by1) * t, sc = .35 + t * .9;
    for (let j = 0; j < cols; j++) {
      if (v === 3 && r() < .25) continue;   // 빈자리
      const xf = (j + .5) / cols, x = bx0 + (bx1 - bx0) * xf + (xf - .5) * W * t * .7, w = 26 * sc, h = 7 * sc;
      const tilt = v === 2 && r() < .3;
      g.save(); g.translate(x, y); if (tilt) g.rotate((r() - .5) * .9);
      g.fillStyle = dark ? '#1c1814' : '#7a5636'; g.fillRect(-w / 2, -h - 14 * sc, w, h);          // 상판
      g.fillStyle = dark ? '#111' : '#2c2c2a'; g.fillRect(-w / 2 + 1, -14 * sc, 2 * sc, 14 * sc); g.fillRect(w / 2 - 3 * sc, -14 * sc, 2 * sc, 14 * sc);
      g.fillStyle = dark ? '#18140f' : '#5e4228'; g.fillRect(-w * .3, -h - 26 * sc, w * .6, 9 * sc);   // 의자 등받이
      g.restore();
    }
  }
  // 그늘 · 먼지 비네트
  const gr = g.createRadialGradient(vx, vy, 20, vx, vy, W * .75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 900; k++) { g.fillStyle = 'rgba(' + (r() < .5 ? '0,0,0' : '255,255,240') + ',' + (r() * .06).toFixed(3) + ')'; g.fillRect(r() * W, r() * H, 2, 2); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
let MATS = null;
function mats() {
  if (!MATS) MATS = Array.from({ length: VARIANTS }, (_, v) => new THREE.MeshBasicMaterial({ map: paintRoom(v), color: 0x666666, fog: true }));
  return MATS;
}
// slots: [x, w, zInner] — 창 중심 x · 폭 · 실내 쪽 벽면 z (층 shell 로컬 좌표, 창 중심 높이 1.7 · 높이 1.6)
export function buildWindowFakes(slots, seed = 0) {
  const g = new THREE.Group(); g.name = 'windowFakes'; g.userData.dynamic = true;
  const per = Array.from({ length: VARIANTS }, () => []);
  slots.forEach(([x, w, z], i) => per[(i * 7 + seed * 3 + (x * 13 | 0)) & 3].push([x, w, z]));
  per.forEach((list, v) => {
    if (!list.length) return;
    const pos = [], uv = [], idx = [];
    list.forEach(([x, w, z], k) => {
      const hw = w / 2 + .05, y0 = .88, y1 = 2.52, zz = z - .03, b = k * 4;
      pos.push(x - hw, y0, zz, x + hw, y0, zz, x + hw, y1, zz, x - hw, y1, zz);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1); idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, mats()[v]); m.userData.dynamic = true; m.castShadow = m.receiveShadow = false; m.renderOrder = -1; g.add(m);
  });
  return g;
}
// 낮밤 밝기 (dk: 0 밤 · 1 낮)
export function updateWindowFakes(dk) {
  if (!MATS) return;
  const v = .3 + .7 * Math.max(0, Math.min(1, dk));
  MATS.forEach(m => m.color.setScalar(v));
}
