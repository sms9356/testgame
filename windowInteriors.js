// 외벽 창 너머로 보이는 입체감 있는 교실 · 현관 로비 내부 (전기가 들어온 폐교 설정: 천장 형광등 점등 + 칠판/게시판/책걸상/사물함).
import * as THREE from './vendor/three.module.js';

const VARIANTS = 5; // 0..3: 교실 변형 4종, 4: 중앙현관 로비
function paintRoom(v) {
  const W = 512, H = 384, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let s = 1234 + v * 977; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const vx = W * (v === 4 ? .5 : (.43 + (v & 3) * .045)), vy = H * .48;
  const bx0 = W * .15, bx1 = W * .85, by0 = H * .18, by1 = H * .74;
  const poly = (pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fillStyle = fill; g.fill(); };
  const dim = v === 1;
  poly([[0, 0], [W, 0], [bx1, by0], [bx0, by0]], dim ? '#626862' : '#969c92');
  poly([[0, H], [W, H], [bx1, by1], [bx0, by1]], v === 4 ? '#6e726c' : (dim ? '#4c3a2a' : '#6e543c'));
  poly([[0, 0], [bx0, by0], [bx0, by1], [0, H]], dim ? '#6a746c' : '#9ea89a');
  poly([[W, 0], [bx1, by0], [bx1, by1], [W, H]], dim ? '#646e66' : '#949e90');
  poly([[0, H * .64], [bx0, by0 + (by1 - by0) * .62], [bx0, by1], [0, H]], dim ? '#3d524c' : '#4e6a64');
  poly([[W, H * .64], [bx1, by0 + (by1 - by0) * .62], [bx1, by1], [W, H]], dim ? '#3a4e48' : '#4a645e');
  g.fillStyle = dim ? '#747e74' : '#adb6a6'; g.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
  g.fillStyle = dim ? '#405650' : '#526e68'; g.fillRect(bx0, by0 + (by1 - by0) * .60, bx1 - bx0, (by1 - by0) * .40);

  for (let k = 0; k < 3; k++) {
    const t = .22 + k * .26, y = by0 * (1 - t) * .92 + 6;
    const x0 = vx - (vx - W * .18) * (1 - t) - 16, x1 = vx + (W * .82 - vx) * (1 - t) + 16;
    const gw = g.createLinearGradient(0, y - 10, 0, y + 18);
    gw.addColorStop(0, 'rgba(220,245,255,0)'); gw.addColorStop(.5, dim ? 'rgba(200,230,220,.35)' : 'rgba(235,250,255,.65)'); gw.addColorStop(1, 'rgba(220,245,255,0)');
    g.fillStyle = gw; g.fillRect(x0 - 12, y - 10, (x1 - x0) + 24, 28);
    g.fillStyle = dim && k === 1 ? '#9aa8a0' : '#f4fbff';
    g.fillRect(x0, y, (x1 - x0) * .42, 5 + (1 - t) * 5);
    g.fillRect(x1 - (x1 - x0) * .42, y, (x1 - x0) * .42, 5 + (1 - t) * 5);
  }

  if (v === 4) {
    g.fillStyle = '#20342c'; g.fillRect(bx0 + 40, by0 + 14, bx1 - bx0 - 80, 34);
    g.strokeStyle = '#9ec4b0'; g.lineWidth = 2; g.strokeRect(bx0 + 42, by0 + 16, bx1 - bx0 - 84, 30);
    g.fillStyle = '#1c3b64'; g.fillRect(bx0 + 18, by0 + 56, 58, by1 - by0 - 56);
    g.fillStyle = '#b8ecff'; g.fillRect(bx0 + 24, by0 + 66, 46, 54);
    g.fillStyle = '#4e3622'; g.fillRect(bx1 - 76, by0 + 52, 58, by1 - by0 - 52);
    g.fillStyle = 'rgba(180,220,235,.45)'; g.fillRect(bx1 - 70, by0 + 62, 46, 68);
  } else {
    g.fillStyle = '#4e3a26'; g.fillRect(bx0 + 28, by0 + 20, (bx1 - bx0) * .56 + 8, 74);
    g.fillStyle = '#1e3c2d'; g.fillRect(bx0 + 32, by0 + 24, (bx1 - bx0) * .56, 66);
    g.strokeStyle = 'rgba(235,242,235,.48)'; g.lineWidth = 2;
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(bx0 + 48 + r() * 30, by0 + 42 + k * 15); g.lineTo(bx0 + 120 + r() * 90, by0 + 42 + k * 15); g.stroke(); }
    g.fillStyle = '#8e7448'; g.fillRect(bx1 - 88, by0 + 24, 64, 58);
    for (let k = 0; k < 6; k++) { g.fillStyle = ['#ece4cc', '#d8cfa8', '#e4dcd0'][k % 3]; g.fillRect(bx1 - 82 + (k % 3) * 18, by0 + 30 + (k / 3 | 0) * 24, 14, 18); }
    g.fillStyle = '#6c7c80'; g.fillRect(bx0 + 16, by1 - 54, bx1 - bx0 - 32, 52);
    g.strokeStyle = '#384246'; g.lineWidth = 1.5;
    for (let k = 0; k <= 8; k++) { const lx = bx0 + 16 + k * (bx1 - bx0 - 32) / 8; g.beginPath(); g.moveTo(lx, by1 - 54); g.lineTo(lx, by1 - 2); g.stroke(); }
    const rows = 4, cols = 5;
    for (let i = rows - 1; i >= 0; i--) {
      const t = (i + .55) / (rows + .55), y = by1 + (H - by1) * t, sc = .4 + t * .95;
      for (let j = 0; j < cols; j++) {
        if (v === 3 && r() < .2) continue;
        const xf = (j + .5) / cols, x = bx0 + (bx1 - bx0) * xf + (xf - .5) * W * t * .68, w = 48 * sc, h = 13 * sc;
        g.save(); g.translate(x, y);
        g.fillStyle = '#8c623c'; g.fillRect(-w / 2, -h - 26 * sc, w, h);
        g.fillStyle = '#2c3032'; g.fillRect(-w / 2 + 2, -26 * sc, 3.5 * sc, 26 * sc); g.fillRect(w / 2 - 5 * sc, -26 * sc, 3.5 * sc, 26 * sc);
        g.fillStyle = '#6c4a2c'; g.fillRect(-w * .32, -h - 46 * sc, w * .64, 16 * sc);
        g.restore();
      }
    }
  }
  const gr = g.createRadialGradient(vx, vy, 60, vx, vy, W * .78);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.32)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

let MATS = null;
function mats() {
  if (!MATS) MATS = Array.from({ length: VARIANTS }, (_, v) => new THREE.MeshBasicMaterial({ map: paintRoom(v), color: 0xd0dcd6, side: THREE.DoubleSide, fog: true }));
  return MATS;
}

export function buildWindowFakes(slots, seed = 0) {
  const g = new THREE.Group(); g.name = 'windowFakes'; g.userData.dynamic = true;
  const per = Array.from({ length: VARIANTS }, () => []);
  slots.forEach((s, i) => {
    const [x, w, z, yc = 1.7, hw2 = 1.6, variant] = s;
    const v = variant != null ? variant : ((i * 7 + seed * 3 + (Math.abs(x) * 13 | 0)) & 3);
    per[v].push([x, w, z, yc, hw2]);
  });
  per.forEach((list, v) => {
    if (!list.length) return;
    const pos = [], uv = [], idx = [];
    list.forEach(([x, w, z, yc, hw2], k) => {
      const hw = w / 2 + .06, y0 = yc - hw2 / 2 - .04, y1 = yc + hw2 / 2 + .04;
      const zz = z >= 0 ? z - .08 : z + .08, b = k * 4;
      if (z >= 0) {
        pos.push(x - hw, y0, zz, x + hw, y0, zz, x + hw, y1, zz, x - hw, y1, zz);
      } else {
        pos.push(x + hw, y0, zz, x - hw, y0, zz, x - hw, y1, zz, x + hw, y1, zz);
      }
      uv.push(0, 0, 1, 0, 1, 1, 0, 1); idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const m = new THREE.Mesh(geo, mats()[v]); m.userData.dynamic = true; m.castShadow = m.receiveShadow = false; m.renderOrder = -1;
    g.add(m);
  });
  return g;
}

export function updateWindowFakes(dk) {
  if (!MATS) return;
  const v = .78 + .22 * Math.max(0, Math.min(1, dk));
  MATS.forEach(m => m.color.setRGB(v * .94, v * .98, v * .95));
}
