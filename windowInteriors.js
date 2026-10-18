// 외벽 창 너머로 보이는 깊이감 있는 폐교 교실 내부 원근 임포스터 (어두운 실내 음영 · 반쯤 내려온 블라인드 · 창유리 반사광)
import * as THREE from './vendor/three.module.js';

const VARIANTS = 5;
function paintRoom(v) {
  const W = 512, H = 384, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let s = 1234 + v * 977; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const vx = W * (.42 + (v & 3) * .05), vy = H * .46;
  const bx0 = W * .14, bx1 = W * .86, by0 = H * .16, by1 = H * .76;
  const poly = (pts, fill) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fillStyle = fill; g.fill(); };
  const lit = v === 0 || v === 2;

  poly([[0, 0], [W, 0], [bx1, by0], [bx0, by0]], lit ? '#252b2e' : '#15181c');
  poly([[0, H], [W, H], [bx1, by1], [bx0, by1]], lit ? '#1e1915' : '#110f0d');
  poly([[0, 0], [bx0, by0], [bx0, by1], [0, H]], lit ? '#282e30' : '#171b1e');
  poly([[W, 0], [bx1, by0], [bx1, by1], [W, H]], lit ? '#242a2c' : '#14181b');
  g.fillStyle = lit ? '#2b3234' : '#181c20'; g.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
  g.fillStyle = lit ? '#1b2424' : '#101517'; g.fillRect(bx0, by0 + (by1 - by0) * .58, bx1 - bx0, (by1 - by0) * .42);

  for (let k = 0; k < 2; k++) {
    const t = .28 + k * .34, y = by0 * (1 - t) * .9 + 8;
    const x0 = vx - (vx - W * .20) * (1 - t), x1 = vx + (W * .80 - vx) * (1 - t);
    if (lit && k === 0) {
      const gw = g.createLinearGradient(0, y - 14, 0, y + 26);
      gw.addColorStop(0, 'rgba(180,210,205,0)'); gw.addColorStop(.5, 'rgba(180,215,210,.22)'); gw.addColorStop(1, 'rgba(180,210,205,0)');
      g.fillStyle = gw; g.fillRect(x0 - 16, y - 14, (x1 - x0) + 32, 40);
      g.fillStyle = 'rgba(215,235,230,.55)';
    } else {
      g.fillStyle = '#2a3034';
    }
    g.fillRect(x0, y, (x1 - x0) * .40, 4);
    g.fillRect(x1 - (x1 - x0) * .40, y, (x1 - x0) * .40, 4);
  }

  g.fillStyle = '#121818'; g.fillRect(bx0 + 34, by0 + 22, (bx1 - bx0) * .54, 58);
  g.strokeStyle = 'rgba(120,135,130,.22)'; g.lineWidth = 2; g.strokeRect(bx0 + 34, by0 + 22, (bx1 - bx0) * .54, 58);
  g.fillStyle = '#1c2226'; g.fillRect(bx1 - 92, by0 + 20, 68, by1 - by0 - 28);

  for (let i = 2; i >= 0; i--) {
    const t = (i + .5) / 3.5, y = by1 + (H - by1) * t, sc = .45 + t * .85;
    for (let j = 0; j < 4; j++) {
      if (r() < .25) continue;
      const xf = (j + .5) / 4, x = bx0 + (bx1 - bx0) * xf + (xf - .5) * W * t * .55, w = 52 * sc, h = 10 * sc;
      g.fillStyle = '#1b1612'; g.fillRect(x - w / 2, y - h - 22 * sc, w, h);
      g.fillStyle = '#111315'; g.fillRect(x - w * .34, y - h - 38 * sc, w * .68, 14 * sc);
    }
  }

  const blindH = [0.22, 0.48, 0.12, 0.62, 0.18][v % 5] * H;
  if (blindH > 20) {
    const bg = g.createLinearGradient(0, 0, 0, blindH);
    bg.addColorStop(0, 'rgba(42,46,48,.92)'); bg.addColorStop(1, 'rgba(32,36,38,.86)');
    g.fillStyle = bg; g.fillRect(0, 0, W, blindH);
    g.strokeStyle = 'rgba(15,18,20,.45)'; g.lineWidth = 1.5;
    for (let y = 10; y < blindH; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.fillStyle = 'rgba(65,70,72,.8)'; g.fillRect(0, blindH - 4, W, 4);
  }

  const refl = g.createLinearGradient(0, 0, W, H);
  refl.addColorStop(0, 'rgba(170,195,215,.14)');
  refl.addColorStop(.35, 'rgba(170,195,215,.03)');
  refl.addColorStop(.5, 'rgba(200,220,235,.10)');
  refl.addColorStop(1, 'rgba(10,14,18,.35)');
  g.fillStyle = refl; g.fillRect(0, 0, W, H);

  const gr = g.createRadialGradient(W * .5, H * .5, 40, W * .5, H * .5, W * .72);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(4,6,10,.68)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);

  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

let MATS = null;
function mats() {
  if (!MATS) MATS = Array.from({ length: VARIANTS }, (_, v) => new THREE.MeshBasicMaterial({ map: paintRoom(v), color: 0x8a969e, side: THREE.DoubleSide, fog: true }));
  return MATS;
}

export function buildWindowFakes(slots, seed = 0) {
  const g = new THREE.Group(); g.name = 'windowFakes'; g.userData.dynamic = true;
  const per = Array.from({ length: VARIANTS }, () => []);
  slots.forEach((s, i) => {
    const [x, w, z, yc = 1.7, hw2 = 1.6, variant] = s;
    if (variant === 4) return;
    const v = variant != null ? variant : ((i * 7 + seed * 3 + (Math.abs(x) * 13 | 0)) & 3);
    per[v].push([x, w, z, yc, hw2]);
  });
  per.forEach((list, v) => {
    if (!list.length) return;
    const pos = [], uv = [], idx = [];
    list.forEach(([x, w, z, yc, hw2], k) => {
      const hw = w / 2 + .02, y0 = yc - hw2 / 2 - .02, y1 = yc + hw2 / 2 + .02;
      const zz = z >= 0 ? z - .12 : z + .12, b = k * 4;
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
  const v = .45 + .45 * Math.max(0, Math.min(1, dk));
  MATS.forEach(m => m.color.setRGB(v * .88, v * .94, v));
}
