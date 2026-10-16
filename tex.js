// 절차적(프로시저럴) 텍스처 — 외부 이미지 없이 캔버스로 폐교의 낡은 질감을 만든다.
import * as THREE from './vendor/three.module.js';

let seed = 90210;
export const rnd = () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const rr = (a, b) => a + rnd() * (b - a);
export const pick = a => a[(rnd() * a.length) | 0];
export const FONT = "'Noto Sans KR','Noto Sans CJK KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif";

// 캔버스 텍스처는 2배 해상도로 그려 가까이서 봐도 흐려지지 않게 한다 (작은 텍스처만, 큰 것은 그대로)
export function ctex(w, h, fn, { repeat = true, aniso = 8, scale } = {}) {
  const k = scale ?? (w * h <= 512 * 512 ? 2 : 1);
  const c = document.createElement('canvas');
  c.width = w * k; c.height = h * k;
  const g = c.getContext('2d');
  g.scale(k, k);
  fn(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

function speckle(g, w, h, n, cols, smin, smax, amax) {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = rr(0.04, amax);
    g.fillStyle = pick(cols);
    const s = rr(smin, smax);
    g.fillRect(rnd() * w, rnd() * h, s, s * rr(0.5, 3));
  }
  g.globalAlpha = 1;
}
function stains(g, w, h, n, col, maxr) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h, r = rr(maxr * 0.3, maxr);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
}
function cracks(g, w, h, n, col, len) {
  g.strokeStyle = col; g.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    let x = rnd() * w, y = rnd() * h;
    g.beginPath(); g.moveTo(x, y);
    const k = rr(4, 10) | 0;
    for (let j = 0; j < k; j++) { x += rr(-len, len); y += rr(-len, len); g.lineTo(x, y); }
    g.stroke();
  }
}
function drips(g, w, y0, y1, n, col) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rr(y0, y1), l = rr(20, 160);
    const gr = g.createLinearGradient(0, y, 0, y + l);
    gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x, y, rr(2, 8), l);
  }
}

export const makeWall = () => ctex(512, 512, (g, w, h) => {
  g.fillStyle = '#a9a798'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 1400, ['#8e8c7e', '#c4c1b2', '#7d7b6d'], 2, 14, 0.25);
  stains(g, w, h, 16, 'rgba(70,60,35,.4)', 100);
  drips(g, w, 0, h * 0.6, 28, 'rgba(60,50,30,.35)');
  // 하단 판넬(청회색 페인트)
  g.fillStyle = '#4e6471'; g.fillRect(0, h * 0.62, w, h * 0.38);
  speckle(g, w, h, 900, ['#2f3f48', '#6c8693', '#3a2f26'], 2, 12, 0.3);
  stains(g, w, h, 10, 'rgba(120,70,30,.5)', 70);
  g.fillStyle = '#242a2c'; g.fillRect(0, h * 0.62 - 3, w, 6);
  // 벗겨진 페인트
  for (let i = 0; i < 46; i++) {
    const x = rnd() * w, y = rnd() * h, r = rr(8, 36);
    g.fillStyle = pick(['#d8d4c4', '#6f6a5a', '#3b3a32', '#8a8f86']); g.globalAlpha = rr(0.3, 0.7);
    g.beginPath();
    for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28, rad = r * rr(0.5, 1.1); g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad * 0.7); }
    g.fill();
  }
  g.globalAlpha = 1;
  cracks(g, w, h, 12, 'rgba(25,22,18,.55)', 26);
});

export const makeTileFloor = () => ctex(512, 512, (g, w, h) => {
  const n = 8, s = w / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = ((x + y) & 1) ? 118 : 96;
    const j = rr(-12, 12);
    g.fillStyle = `rgb(${v + j},${v + j - 3},${v + j - 12})`;
    g.fillRect(x * s, y * s, s, s);
  }
  g.strokeStyle = '#26241f'; g.lineWidth = 2;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
  stains(g, w, h, 26, 'rgba(25,18,10,.55)', 70);
  stains(g, w, h, 8, 'rgba(70,95,80,.25)', 60);
  speckle(g, w, h, 1500, ['#1a1713', '#6a655a', '#3c362c'], 2, 10, 0.4);
  cracks(g, w, h, 18, 'rgba(10,8,6,.7)', 40);
  for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(8,7,6,.85)'; g.fillRect(((rnd() * n) | 0) * s + 6, ((rnd() * n) | 0) * s + 6, s - 12, s - 12); }
});

export const makeWoodFloor = () => ctex(512, 512, (g, w, h) => {
  const pl = 10, s = h / pl;
  for (let i = 0; i < pl; i++) {
    const v = rr(48, 74);
    g.fillStyle = `rgb(${v + 22},${v + 8},${v - 6})`; g.fillRect(0, i * s, w, s);
    const off = rnd() * w;
    g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(off, i * s, 3, s);
    for (let k = 0; k < 24; k++) { g.fillStyle = `rgba(20,10,0,${rr(.05, .22)})`; g.fillRect(rnd() * w, i * s + rnd() * s, rr(30, 160), 1); }
  }
  g.fillStyle = 'rgba(0,0,0,.7)'; for (let i = 0; i <= pl; i++) g.fillRect(0, i * s, w, 2);
  stains(g, w, h, 20, 'rgba(15,10,6,.55)', 80);
  stains(g, w, h, 5, 'rgba(60,85,70,.3)', 70);
  speckle(g, w, h, 900, ['#1a1008', '#6a5a44'], 2, 8, 0.4);
});

export const makeCeiling = () => ctex(512, 512, (g, w, h) => {
  g.fillStyle = '#8a877a'; g.fillRect(0, 0, w, h);
  const n = 4, s = w / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = rr(-10, 8); g.fillStyle = `rgb(${138 + v},${134 + v},${120 + v})`; g.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
  }
  speckle(g, w, h, 900, ['#3a342a', '#a8a490'], 2, 9, 0.3);
  stains(g, w, h, 22, 'rgba(60,45,20,.55)', 80);
  stains(g, w, h, 6, 'rgba(20,20,15,.6)', 50);
  g.strokeStyle = '#2d2a22'; g.lineWidth = 3;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
});

export const makeWood = (base = [92, 58, 34]) => ctex(256, 256, (g, w, h) => {
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(20,8,0,${rr(.04, .2)})`; g.fillRect(0, rnd() * h, w, rr(1, 3)); }
  stains(g, w, h, 8, 'rgba(10,6,2,.5)', 50);
  speckle(g, w, h, 300, ['#cfa56a', '#2a1608'], 2, 8, 0.25);
});

export const makeMetal = (base = [104, 118, 124]) => ctex(256, 256, (g, w, h) => {
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 700, ['#3f4a4f', '#8a9a9f'], 2, 10, 0.3);
  stains(g, w, h, 18, 'rgba(140,70,25,.65)', 40);
  drips(g, w, 0, h, 22, 'rgba(110,55,20,.5)');
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, h / 2 - 1, w, 2);
});

export const makeBoard = (lines = []) => ctex(512, 160, (g, w, h) => {
  g.fillStyle = '#1f3a30'; g.fillRect(0, 0, w, h);
  stains(g, w, h, 30, 'rgba(210,225,215,.22)', 50);
  speckle(g, w, h, 500, ['#8ea79a', '#0c1a14'], 2, 14, 0.18);
  g.strokeStyle = 'rgba(220,235,225,.18)'; g.lineWidth = 3;
  for (let i = 0; i < 12; i++) { g.beginPath(); const y = rnd() * h; g.moveTo(0, y); g.bezierCurveTo(w / 3, y + rr(-20, 20), w / 1.5, y + rr(-20, 20), w, y + rr(-20, 20)); g.stroke(); }
  g.fillStyle = 'rgba(235,240,232,.9)';
  lines.forEach((t, i) => {
    g.font = `${i === 0 ? 46 : 26}px ${FONT}`; g.textAlign = 'center';
    g.save(); g.translate(w / 2, 62 + i * 40); g.rotate(rr(-.03, .03)); g.fillText(t, 0, 0); g.restore();
  });
});

export const makeBooks = () => ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#2a1c10'; g.fillRect(0, 0, w, h);
  const rows = 5, rh = h / rows;
  for (let r = 0; r < rows; r++) {
    let x = 4;
    while (x < w - 6) {
      const bw = rr(7, 16), bh = rr(rh * .6, rh - 8);
      if (rnd() < .12) { x += bw; continue; }
      g.fillStyle = pick(['#5a2a22', '#2f4a3a', '#2a3a58', '#6a5a2e', '#40332a', '#7a7a6a', '#3a2438']);
      g.save(); g.translate(x, (r + 1) * rh - 3); if (rnd() < .08) g.rotate(rr(-.3, .3));
      g.fillRect(0, -bh, bw, bh); g.restore();
      x += bw + 1;
    }
    g.fillStyle = '#120a04'; g.fillRect(0, (r + 1) * rh - 3, w, 5);
  }
  speckle(g, w, h, 500, ['#000', '#aaa'], 2, 8, 0.2);
});

export const makeCork = () => ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#7a6a48'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 900, ['#4a3a22', '#a89870'], 2, 5, 0.4);
  for (let i = 0; i < 14; i++) {
    g.save(); g.translate(rnd() * w, rnd() * h); g.rotate(rr(-.4, .4));
    g.fillStyle = pick(['#d8d4c4', '#c9c2a2', '#b8c0b4']); g.fillRect(0, 0, rr(26, 50), rr(34, 60));
    g.fillStyle = 'rgba(40,40,40,.5)'; for (let k = 0; k < 5; k++) g.fillRect(4, 6 + k * 8, 20, 2);
    g.restore();
  }
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 8; g.strokeRect(0, 0, w, h);
});

export const makePaper = (txt) => ctex(128, 96, (g, w, h) => {
  g.fillStyle = '#d6d0b4'; g.fillRect(0, 0, w, h);
  stains(g, w, h, 4, 'rgba(90,70,30,.4)', 30);
  g.fillStyle = 'rgba(30,30,30,.55)';
  for (let i = 0; i < 7; i++) g.fillRect(10, 12 + i * 11, rr(40, 108), 2);
  if (txt) { g.fillStyle = '#7a1a1a'; g.font = `bold 16px ${FONT}`; g.fillText(txt, 10, 22); }
}, { repeat: false });

export const makeWindow = () => ctex(384, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#1a2a40'); gr.addColorStop(1, '#0c1420');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  // 달빛 반사 줄무늬
  g.fillStyle = 'rgba(120,150,190,.18)';
  for (let i = 0; i < 4; i++) { g.beginPath(); const x = rnd() * w; g.moveTo(x, 0); g.lineTo(x + 40, 0); g.lineTo(x - 30, h); g.lineTo(x - 70, h); g.fill(); }
  // 균열
  g.strokeStyle = 'rgba(210,225,240,.55)'; g.lineWidth = 1.2;
  if (rnd() < .8) {
    const cx = rr(60, w - 60), cy = rr(40, h - 40);
    for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(cx, cy); let x = cx, y = cy; const a = rnd() * 6.28; for (let k = 0; k < 4; k++) { x += Math.cos(a + rr(-.4, .4)) * rr(20, 50); y += Math.sin(a + rr(-.4, .4)) * rr(20, 50); g.lineTo(x, y); } g.stroke(); }
  }
  // 창틀
  g.fillStyle = '#6e6a5c';
  const cols = 3, rows = 2;
  for (let i = 0; i <= cols; i++) g.fillRect(i * (w - 8) / cols, 0, 8, h);
  for (let j = 0; j <= rows; j++) g.fillRect(0, j * (h - 8) / rows, w, 8);
  speckle(g, w, h, 300, ['#2a2a22', '#9a9a88'], 2, 8, 0.4);
});

export const makeDoor = () => ctex(128, 256, (g, w, h) => {
  g.fillStyle = '#5c4630'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(10,5,0,${rr(.05, .25)})`; g.fillRect(rnd() * w, 0, 1, h); }
  g.fillStyle = '#16222c'; g.fillRect(24, 24, 80, 96);
  g.strokeStyle = '#2a2018'; g.lineWidth = 6; g.strokeRect(24, 24, 80, 96);
  g.strokeStyle = 'rgba(200,215,230,.5)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(50, 40); g.lineTo(80, 70); g.lineTo(60, 100); g.moveTo(80, 70); g.lineTo(98, 50); g.stroke();
  g.fillStyle = '#b8a060'; g.fillRect(100, 140, 8, 14);
  stains(g, w, h, 10, 'rgba(0,0,0,.4)', 40);
});

export const makeSign = (text, bg = '#1e2a2e', fg = '#d9e4d0', fs = 34) => ctex(256, 64, (g, w, h) => {
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = fg; g.globalAlpha = .6; g.lineWidth = 2; g.strokeRect(3, 3, w - 6, h - 6); g.globalAlpha = 1;
  g.fillStyle = fg; g.font = `bold ${fs}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  speckle(g, w, h, 160, ['#000', '#999'], 2, 6, 0.3);
}, { repeat: false });

// 태극기 (국기 제작 기준): 가로 3 : 세로 2, 태극 지름 = 세로의 1/2, 태극은 왼쪽 위 → 오른쪽 아래 대각선을 따라 기울어
// 위쪽 빨강 · 아래쪽 파랑, 4괘는 대각선 위에 — 왼쪽 위 건(☰) · 오른쪽 위 감(☵) · 왼쪽 아래 리(☲) · 오른쪽 아래 곤(☷)
export const makeFlag = () => ctex(300, 200, (g, w, h) => {
  g.fillStyle = '#e4e0d4'; g.fillRect(0, 0, w, h);
  const D = h / 2, r = D / 2, th = Math.atan2(h, w), RED = '#b8202e', BLUE = '#123a78';
  g.save(); g.translate(w / 2, h / 2); g.rotate(th);
  g.fillStyle = RED; g.beginPath(); g.arc(0, 0, r, Math.PI, 0); g.fill();
  g.fillStyle = BLUE; g.beginPath(); g.arc(0, 0, r, 0, Math.PI); g.fill();
  g.fillStyle = RED; g.beginPath(); g.arc(-r / 2, 0, r / 2, 0, Math.PI * 2); g.fill();
  g.fillStyle = BLUE; g.beginPath(); g.arc(r / 2, 0, r / 2, 0, Math.PI * 2); g.fill();
  g.restore();
  // 괘: 길이 = 지름의 1/2, 효 두께 = 지름의 1/12, 효 사이 = 지름의 1/24, 태극에서 지름의 1/4 떨어짐
  const bw = D / 12, gap = D / 24, len = D / 2, dist = r + D / 4 + (3 * bw + 2 * gap) / 2;
  const TRI = [[-1, -1, [1, 1, 1]], [1, -1, [0, 1, 0]], [-1, 1, [1, 0, 1]], [1, 1, [0, 0, 0]]];
  g.fillStyle = '#141414';
  TRI.forEach(([sx, sy, bars]) => {
    const ang = Math.atan2(sy * h, sx * w);
    g.save(); g.translate(w / 2 + Math.cos(ang) * dist, h / 2 + Math.sin(ang) * dist); g.rotate(ang);
    bars.forEach((solid, i) => {
      const x = (i - 1) * (bw + gap) - bw / 2;
      if (solid) g.fillRect(x, -len / 2, bw, len);
      else { const seg = (len - gap) / 2; g.fillRect(x, -len / 2, bw, seg); g.fillRect(x, gap / 2, bw, seg); }
    });
    g.restore();
  });
  stains(g, w, h, 5, 'rgba(70,60,40,.22)', 40);
}, { repeat: false });

export const makeGround = () => ctex(512, 512, (g, w, h) => {
  g.fillStyle = '#1c2416'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 6000, ['#0e150b', '#2c3a20', '#3a3a22', '#141c10'], 2, 7, 0.6);
  stains(g, w, h, 20, 'rgba(60,50,30,.4)', 60);
});
export const makeDirt = () => ctex(512, 512, (g, w, h) => {
  g.fillStyle = '#5b4a36'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 5000, ['#3c3023', '#7a6648', '#2d2418', '#8a7a60'], 2, 8, 0.5);
  stains(g, w, h, 18, 'rgba(25,40,20,.4)', 70);
});
export const makePaving = () => ctex(512, 512, (g, w, h) => {
  const n = 4, s = w / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = rr(70, 100); g.fillStyle = `rgb(${v},${v - 2},${v - 8})`; g.fillRect(x * s, y * s, s, s); }
  g.strokeStyle = '#14120e'; g.lineWidth = 5;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
  speckle(g, w, h, 2500, ['#222', '#888', '#3a4a2a'], 2, 9, 0.5);
  stains(g, w, h, 14, 'rgba(20,35,15,.5)', 60);
  cracks(g, w, h, 18, 'rgba(0,0,0,.8)', 50);
  g.strokeStyle = 'rgba(40,70,30,.8)'; g.lineWidth = 2; cracks(g, w, h, 10, 'rgba(50,90,30,.7)', 30);
});
export const makeAsphalt = () => ctex(512, 256, (g, w, h) => {
  g.fillStyle = '#17181a'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 3000, ['#2a2b2e', '#0c0c0d', '#3a3b3e'], 2, 5, 0.6);
  g.fillStyle = '#9a8a40'; g.fillRect(0, h / 2 - 3, w * .55, 6);
  cracks(g, w, h, 8, 'rgba(0,0,0,.8)', 30);
});
export const makeFence = () => ctex(512, 256, (g, w, h) => {
  g.fillStyle = '#7d7b70'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 1500, ['#4a483f', '#a09c8e'], 2, 10, 0.3);
  stains(g, w, h, 14, 'rgba(30,45,20,.55)', 70);
  drips(g, w, 0, h, 30, 'rgba(25,40,18,.6)');
  // 담쟁이
  for (let i = 0; i < 160; i++) { g.fillStyle = pick(['#27401f', '#35552a', '#1c3016', '#4a5a28']); g.globalAlpha = rr(.5, .9); const x = rnd() * w, y = rnd() * h * (rnd() < .6 ? 1 : .4) + (h * .4) * rnd(); g.beginPath(); g.ellipse(x, y, rr(3, 9), rr(2, 6), rnd() * 3, 0, 6.28); g.fill(); }
  g.globalAlpha = 1;
  g.fillStyle = '#5b5a50'; g.fillRect(0, 0, w, 12);
  cracks(g, w, h, 12, 'rgba(0,0,0,.6)', 30);
});
export const makeSkin = () => ctex(64, 64, (g, w, h) => { g.fillStyle = '#8b6a3a'; g.fillRect(0, 0, w, h); speckle(g, w, h, 200, ['#3a2a12', '#d8b46a'], 2, 6, .5); });
export const makeClock = () => ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#cfcab6'; g.beginPath(); g.arc(128, 128, 120, 0, 6.28); g.fill();
  g.strokeStyle = '#2a2a24'; g.lineWidth = 8; g.stroke();
  g.fillStyle = '#222';
  for (let i = 0; i < 12; i++) { g.save(); g.translate(128, 128); g.rotate(i * Math.PI / 6); g.fillRect(-3, -108, 6, 18); g.restore(); }
  g.strokeStyle = '#111'; g.lineWidth = 8; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 70); g.stroke();
  g.lineWidth = 5; g.beginPath(); g.moveTo(128, 128); g.lineTo(168, 150); g.stroke();
  stains(g, w, h, 8, 'rgba(60,50,30,.5)', 60);
}, { repeat: false });
export const makeGlow = (c = '255,210,110') => ctex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${c},1)`); gr.addColorStop(.35, `rgba(${c},.35)`); gr.addColorStop(1, `rgba(${c},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
}, { repeat: false });
export const makeGatePlaque = (text = '폐교') => ctex(128, 512, (g, w, h) => {
  g.fillStyle = '#2a2620'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 600, ['#14120e', '#5a5444'], 2, 8, .5); stains(g, w, h, 10, 'rgba(10,10,6,.5)', 50);
  g.fillStyle = '#c8bea0'; g.font = `900 ${Math.min(84, (h - 40) / text.length)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const step = (h - 40) / text.length; [...text].forEach((ch, i) => g.fillText(ch, w / 2, 20 + step * (i + .5)));
  g.strokeStyle = '#8a7a5a'; g.lineWidth = 5; g.strokeRect(6, 6, w - 12, h - 12);
}, { repeat: false });
export const makeWarning = () => ctex(256, 160, (g, w, h) => {
  g.fillStyle = '#d8d4c8'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#b3262e'; g.fillRect(8, 8, w - 16, 60);
  g.fillStyle = '#fff'; g.font = `900 46px ${FONT}`; g.textAlign = 'center'; g.fillText('출입금지', w / 2, 56);
  g.fillStyle = '#222'; g.font = `16px ${FONT}`; g.fillText('안전사고 위험 · 무단출입 시', w / 2, 98); g.fillText('법에 따라 처벌받을 수 있습니다', w / 2, 122);
  stains(g, w, h, 10, 'rgba(90,60,20,.55)', 40);
  speckle(g, w, h, 400, ['#4a2a14', '#fff'], 2, 6, .5);
}, { repeat: false });

// ---- 체육관 / 방송실 / 수영장용 ----
export const makeCourt = () => ctex(1024, 1024, (g, w, h) => {
  const pl = 34, s = h / pl;
  for (let i = 0; i < pl; i++) { const v = rr(60, 88); g.fillStyle = `rgb(${v + 36},${v + 14},${v - 8})`; g.fillRect(0, i * s, w, s); for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(30,12,0,${rr(.05, .2)})`; g.fillRect(rnd() * w, i * s + rnd() * s, rr(60, 300), 1); } g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(rnd() * w, i * s, 3, s); }
  g.fillStyle = 'rgba(0,0,0,.6)'; for (let i = 0; i <= pl; i++) g.fillRect(0, i * s, w, 2);
  // 코트 라인
  g.strokeStyle = 'rgba(230,226,205,.8)'; g.lineWidth = 6;
  g.strokeRect(70, 150, w - 140, h - 300); g.beginPath(); g.moveTo(70, h / 2); g.lineTo(w - 70, h / 2); g.stroke();
  g.beginPath(); g.arc(w / 2, h / 2, 110, 0, 6.3); g.stroke();
  [150, h - 150].forEach((y, i) => { g.strokeRect(w / 2 - 130, i ? y - 240 : y, 260, 240); g.beginPath(); g.arc(w / 2, i ? y - 240 : y + 240, 130, i ? Math.PI : 0, i ? 6.3 : Math.PI); g.stroke(); });
  stains(g, w, h, 40, 'rgba(15,10,6,.55)', 110); stains(g, w, h, 12, 'rgba(60,90,80,.3)', 90);
  speckle(g, w, h, 2500, ['#1a1008', '#8a7a60'], 2, 10, .4);
  for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(8,6,4,.85)'; g.beginPath(); const x = rnd() * w, y = rnd() * h; for (let k = 0; k < 7; k++) g.lineTo(x + Math.cos(k) * rr(20, 70), y + Math.sin(k) * rr(10, 50)); g.fill(); }
}, { repeat: false });
export const makePoolTile = () => ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#5f7f8a'; g.fillRect(0, 0, w, h);
  const n = 8, s = w / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = rr(-14, 14); g.fillStyle = `rgb(${96 + v},${130 + v},${142 + v})`; g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2); }
  stains(g, w, h, 14, 'rgba(30,60,30,.55)', 40); stains(g, w, h, 8, 'rgba(120,70,30,.4)', 30);
  speckle(g, w, h, 500, ['#1a2a22', '#c8d8d0'], 2, 7, .4); cracks(g, w, h, 6, 'rgba(0,0,0,.6)', 20);
});
export const makeBanner = () => ctex(512, 128, (g, w, h) => {
  g.fillStyle = '#c9c4ae'; g.fillRect(0, 0, w, h); stains(g, w, h, 12, 'rgba(70,60,30,.5)', 50); speckle(g, w, h, 600, ['#5a5440', '#e8e4d0'], 2, 7, .4);
  g.fillStyle = '#1f3a6a'; g.font = `900 46px ${FONT}`; g.textAlign = 'center'; g.fillText('건강한 몸, 밝은 미래', w / 2, 66);
  g.font = `22px ${FONT}`; g.fillText('- ○중학교 -', w / 2, 104); g.strokeStyle = '#1f3a6a'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8);
}, { repeat: false });
export const makeScore = () => ctex(256, 96, (g, w, h) => {
  g.fillStyle = '#0c0c0c'; g.fillRect(0, 0, w, h); g.fillStyle = '#c02020'; g.font = 'bold 54px monospace'; g.textAlign = 'center'; g.fillText('07 : 23', w / 2, 62);
  g.fillStyle = '#ddd'; g.font = `16px ${FONT}`; g.fillText('홈', 28, 20); g.fillText('방문', w - 30, 20); speckle(g, w, h, 300, ['#444'], 2, 6, .5);
}, { repeat: false });
export const makeCurtain = () => ctex(256, 256, (g, w, h) => {
  for (let x = 0; x < w; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, '#4a0c14'); gr.addColorStop(.5, '#8a1a24'); gr.addColorStop(1, '#3a0810'); g.fillStyle = gr; g.fillRect(x, 0, 16, h); }
  stains(g, w, h, 16, 'rgba(10,6,4,.5)', 60); drips(g, w, 0, h, 18, 'rgba(10,10,10,.4)');
});
export const makeOnAir = () => ctex(256, 80, (g, w, h) => {
  g.fillStyle = '#1a0606'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff3a30'; g.shadowColor = '#ff2010'; g.shadowBlur = 14; g.font = `900 48px ${FONT}`; g.textAlign = 'center'; g.fillText('방 송 중', w / 2, 58);
}, { repeat: false });
export const makeSafetySign = () => ctex(256, 128, (g, w, h) => {
  g.fillStyle = '#d4d0c0'; g.fillRect(0, 0, w, h); g.fillStyle = '#b3262e'; g.font = `900 34px ${FONT}`; g.textAlign = 'center'; g.fillText('깊은 곳 위험', w / 2, 54); g.fillText('뛰지 마시오', w / 2, 98);
  stains(g, w, h, 8, 'rgba(70,50,20,.5)', 40); speckle(g, w, h, 400, ['#4a2a14', '#fff'], 2, 6, .5);
}, { repeat: false });
export const makeNumber = (n) => ctex(64, 64, (g, w, h) => { g.fillStyle = '#c8c8c0'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a2a3a'; g.font = 'bold 48px sans-serif'; g.textAlign = 'center'; g.fillText(String(n), 32, 50); stains(g, w, h, 4, 'rgba(40,60,30,.5)', 20); }, { repeat: false });
export const makeBasement = () => ctex(512, 512, (g, w, h) => {
  g.fillStyle = '#6a6c68'; g.fillRect(0, 0, w, h); speckle(g, w, h, 2200, ['#3a3c38', '#8a8c86', '#2a2a28'], 2, 12, .35);
  stains(g, w, h, 20, 'rgba(20,28,20,.55)', 90); drips(g, w, 0, h, 30, 'rgba(30,25,15,.5)'); cracks(g, w, h, 14, 'rgba(0,0,0,.6)', 30);
  g.fillStyle = 'rgba(150,40,30,.15)'; g.fillRect(0, h * .6, w, h * .02);
});

// ---- 품질 개선용 텍스처 ----
export const makeGrass = () => ctex(128, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 46; i++) {
    const x = rr(6, w - 6), bh = rr(h * .35, h * .98), lean = rr(-18, 18), bw = rr(2, 5);
    g.fillStyle = pick(['#2f4a22', '#3c5a2a', '#24391a', '#4a5a2c', '#5a5a34']);
    g.beginPath(); g.moveTo(x - bw, h); g.quadraticCurveTo(x + lean * .3, h - bh * .5, x + lean, h - bh); g.quadraticCurveTo(x + lean * .3 + bw * .3, h - bh * .5, x + bw, h); g.fill();
  }
}, { repeat: false });
export const makeLocker = () => ctex(128, 256, (g, w, h) => {
  g.fillStyle = '#7a8a8e'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 500, ['#4a585c', '#9aaaae'], 2, 8, .3);
  g.fillStyle = 'rgba(20,24,26,.75)'; g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h); g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
  for (let i = 0; i < 6; i++) g.fillRect(34, 20 + i * 9, 60, 4);           // 환기구
  for (let i = 0; i < 6; i++) g.fillRect(34, h - 70 + i * 9, 60, 4);
  g.fillStyle = '#c8c0a0'; g.fillRect(14, h / 2 - 22, 6, 44);            // 손잡이
  g.fillStyle = '#e0d8c0'; g.fillRect(40, 84, 48, 18); g.fillStyle = '#333'; g.fillRect(46, 90, 30, 3); // 이름표
  stains(g, w, h, 12, 'rgba(140,70,25,.6)', 30); drips(g, w, 0, h, 14, 'rgba(110,55,20,.45)');
});
export const makeStep = () => ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#8a8880'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 1600, ['#5a5850', '#a8a698', '#3a3a34'], 2, 9, .35);
  stains(g, w, h, 14, 'rgba(30,25,15,.45)', 50); cracks(g, w, h, 8, 'rgba(0,0,0,.5)', 24);
  g.fillStyle = 'rgba(30,30,28,.8)'; g.fillRect(0, 0, w, 10);
});
export const makeDress = () => ctex(256, 256, (g, w, h) => {
  g.fillStyle = '#d6d0c2'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 8) { g.fillStyle = `rgba(60,55,45,${rr(.05, .25)})`; g.fillRect(x + rr(-2, 2), 0, rr(2, 6), h); }
  stains(g, w, h, 14, 'rgba(90,80,60,.4)', 40); stains(g, w, h, 5, 'rgba(90,20,20,.35)', 26);
  drips(g, w, h * .3, h * .9, 16, 'rgba(70,60,45,.35)');
  // 찢어진 밑단 (v=0 이 아래 → 캔버스 아래쪽)
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(0, h);
  for (let x = 0; x <= w; x += 6) g.lineTo(x, h - rr(4, 34));
  g.lineTo(w, h); g.fill();
  g.globalCompositeOperation = 'source-over';
}, { repeat: true });
export const makeHair = () => ctex(64, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    const x = rr(2, w - 2), len = rr(h * .6, h);
    g.strokeStyle = `rgba(${rr(4, 18) | 0},${rr(3, 12) | 0},${rr(3, 10) | 0},${rr(.7, 1)})`; g.lineWidth = rr(1.5, 4);
    g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + rr(-6, 6), len * .4, x + rr(-8, 8), len * .7, x + rr(-6, 6), len); g.stroke();
  }
}, { repeat: false });
export const makeGhostFace = () => ctex(256, 128, (g, w, h) => {
  g.fillStyle = '#c9c2b6'; g.fillRect(0, 0, w, h);
  stains(g, w, h, 10, 'rgba(70,80,90,.35)', 26);
  const cx = w * .25, cy = h * .5;   // 구의 +z 방향 = u 0.25
  const eye = (x) => { const gr = g.createRadialGradient(x, cy - 6, 2, x, cy - 6, 15); gr.addColorStop(0, '#000'); gr.addColorStop(.6, '#0a0606'); gr.addColorStop(1, 'rgba(40,30,30,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, cy - 6, 11, 14, 0, 0, 6.3); g.fill(); g.fillStyle = '#e8e8e0'; g.beginPath(); g.arc(x, cy - 5, 1.6, 0, 6.3); g.fill(); };
  eye(cx - 14); eye(cx + 14);
  g.fillStyle = '#120808'; g.beginPath(); g.ellipse(cx, cy + 22, 6, 11, 0, 0, 6.3); g.fill();
  g.strokeStyle = 'rgba(60,20,20,.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 14, cy + 6); g.lineTo(cx - 16, cy + 24); g.moveTo(cx + 14, cy + 6); g.lineTo(cx + 15, cy + 22); g.stroke();
});

// ---- 디테일 2차 ----
export const makeBookSpine = () => ctex(64, 128, (g, w, h) => {
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 10, w, 6); g.fillRect(0, h - 18, w, 6);
  g.fillStyle = 'rgba(255,240,200,.55)'; g.fillRect(w * .2, 30, w * .6, 40);
  g.fillStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 4; i++) g.fillRect(w * .28, 36 + i * 8, w * .44, 3);
  speckle(g, w, h, 160, ['#000', '#fff'], 1, 4, .25); stains(g, w, h, 4, 'rgba(60,40,20,.35)', 20);
}, { repeat: false });
export const makeCalendar = () => ctex(256, 320, (g, w, h) => {
  g.fillStyle = '#e4dfcf'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#7a1a1a'; g.fillRect(0, 0, w, 56);
  g.fillStyle = '#f0e8d8'; g.font = `900 34px ${FONT}`; g.textAlign = 'center'; g.fillText('10월', w / 2, 40);
  g.fillStyle = '#333'; g.font = `15px ${FONT}`;
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  days.forEach((d, i) => g.fillText(d, 22 + i * 35, 80));
  let day = 1;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) {
    if (r === 0 && c < 0) continue; if (day > 31) break;
    const x = 22 + c * 35, y = 112 + r * 40;
    g.fillStyle = c === 0 ? '#a02020' : '#333'; g.font = `18px ${FONT}`; g.fillText(String(day), x, y);
    if (day === 12) { g.strokeStyle = '#c01818'; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y - 6, 16, 14, 0, 0, 6.3); g.stroke(); g.fillStyle = '#c01818'; g.font = `bold 12px ${FONT}`; g.fillText('기념방송', x, y + 14); }
    day++;
  }
  stains(g, w, h, 8, 'rgba(90,70,30,.4)', 40); speckle(g, w, h, 300, ['#6a5a40'], 1, 4, .3);
}, { repeat: false });
export const makeGraffiti = (text, col = '#8a1018') => ctex(512, 128, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.fillStyle = col; g.font = `900 72px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.translate(w / 2, h / 2); g.rotate(-.04); g.fillText(text, 0, 0); g.restore();
  g.globalCompositeOperation = 'source-atop'; drips(g, w, h * .4, h * .6, 30, 'rgba(70,0,0,.9)'); speckle(g, w, h, 300, ['#200'], 2, 6, .5);
}, { repeat: false });
export const makeKeypad = () => ctex(64, 96, (g, w, h) => {
  g.fillStyle = '#2a2e2c'; g.fillRect(0, 0, w, h); g.fillStyle = '#5a7a5a'; g.fillRect(8, 8, w - 16, 16);
  g.fillStyle = '#c8c8c0'; for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) g.fillRect(10 + c * 16, 32 + r * 15, 12, 11);
}, { repeat: false });

/* ======================================================================
   PBR 텍스처 생성기: 타일링 프랙탈 노이즈 → 색(map) · 노멀(normalMap) · 거칠기(roughnessMap)
   ====================================================================== */
function vnoise(N, cells, seedOff) {   // 주기적(타일링) value noise, N×N
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = rnd();
  const out = new Float32Array(N * N), s = cells / N;
  for (let y = 0; y < N; y++) {
    const fy = y * s, y0 = fy | 0, ty = fy - y0, sy = ty * ty * (3 - 2 * ty), r0 = (y0 % cells) * cells, r1 = ((y0 + 1) % cells) * cells;
    for (let x = 0; x < N; x++) {
      const fx = x * s, x0 = fx | 0, tx = fx - x0, sx = tx * tx * (3 - 2 * tx), c0 = x0 % cells, c1 = (x0 + 1) % cells;
      const a = g[r0 + c0] + (g[r0 + c1] - g[r0 + c0]) * sx, b = g[r1 + c0] + (g[r1 + c1] - g[r1 + c0]) * sx;
      out[y * N + x] = a + (b - a) * sy;
    }
  }
  return out;
}
export function fbm(N, base = 4, oct = 5, gain = .5) {
  const out = new Float32Array(N * N); let amp = 1, tot = 0, cells = base;
  for (let o = 0; o < oct && cells <= N; o++) { const n = vnoise(N, cells); for (let i = 0; i < out.length; i++) out[i] += n[i] * amp; tot += amp; amp *= gain; cells *= 2; }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
function toTex(cv, srgb, aniso = 8) { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; return t; }
function normalFromHeight(H, N, k) {
  const cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), im = g.createImageData(N, N), d = im.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const l = H[y * N + (x - 1 + N) % N], r = H[y * N + (x + 1) % N], u = H[((y - 1 + N) % N) * N + x], dn = H[((y + 1) % N) * N + x];
    let nx = (l - r) * k, ny = (dn - u) * k, nz = 1; const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * N + x) * 4; d[i] = (nx * .5 + .5) * 255; d[i + 1] = (ny * .5 + .5) * 255; d[i + 2] = (nz * .5 + .5) * 255; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); return toTex(cv, false);
}
function grayTex(A, N) {
  const cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), im = g.createImageData(N, N), d = im.data;
  for (let i = 0; i < N * N; i++) { const v = Math.max(0, Math.min(255, A[i] * 255)); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0); return toTex(cv, false);
}
function colorTex(C, N) {
  const cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), im = g.createImageData(N, N), d = im.data;
  for (let i = 0; i < N * N; i++) { d[i * 4] = C[i * 3]; d[i * 4 + 1] = C[i * 3 + 1]; d[i * 4 + 2] = C[i * 3 + 2]; d[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0); return { cv, g };
}
const mixc = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// 균열: 높이맵에 홈을 판다
function crackLines(H, R, N, n, len, depth) {
  for (let c = 0; c < n; c++) {
    let x = rnd() * N, y = rnd() * N, a = rnd() * 6.28;
    const steps = (len * (.5 + rnd())) | 0;
    for (let s = 0; s < steps; s++) {
      a += rr(-.5, .5); x += Math.cos(a) * 1.6; y += Math.sin(a) * 1.6;
      const ix = ((x | 0) % N + N) % N, iy = ((y | 0) % N + N) % N, i = iy * N + ix;
      H[i] -= depth; if (R) R[i] = Math.min(1, R[i] + .2);
      const j = iy * N + (ix + 1) % N; H[j] -= depth * .5;
      if (rnd() < .02) { crackBranch(H, N, x, y, a + rr(-1.2, 1.2), steps * .3, depth * .7); }
    }
  }
}
function crackBranch(H, N, x, y, a, steps, depth) { for (let s = 0; s < steps; s++) { a += rr(-.5, .5); x += Math.cos(a) * 1.6; y += Math.sin(a) * 1.6; const i = ((((y | 0) % N) + N) % N) * N + ((((x | 0) % N) + N) % N); H[i] -= depth; } }

// 벽: 상부 = 여러 겹 칠이 벗겨진 회반죽(크림 → 옛 청회색 → 맨 시멘트) · 하부 = 유약 타일 징두리(깨짐·빠짐·줄눈 때)
// 텍스처 1장 = 4m × 4m. 타일 24장/4m (≈16.7cm), 징두리는 아래 9줄(≈1.5m)
export function pbrWall(N = 2048) {
  const big = fbm(N, 3, 4), fine = fbm(N, 64, 3), peel = fbm(N, 14, 6), peel2 = fbm(N, 22, 5), mold = fbm(N, 5, 5), streak = fbm(N, 48, 2), micro = fbm(N, 256, 1);
  const H = new Float32Array(N * N), R = new Float32Array(N * N), C = new Uint8ClampedArray(N * N * 3);
  const TN = 24, ts = N / TN, dado = N - 9 * ts;
  const tiles = Array.from({ length: TN * 9 }, () => ({ v: rr(-12, 12), g: rr(-6, 6), miss: rnd() < .035, crack: rnd() < .12, chip: rnd() < .22, stain: rnd() < .15, ca: rnd() * 3.14 }));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    let r, g, b, h, ro;
    if (y >= dado) {
      const ty = ((y - dado) / ts) | 0, tx = (x / ts) | 0, T = tiles[Math.min(8, ty) * TN + tx];
      const lx = x % ts, ly = (y - dado) % ts, gd = Math.min(lx, ly, ts - lx, ts - ly);
      const grout = gd < 2.2, bev = sstep(2, 6, gd);
      // 유약 타일: 청록, 타일마다 미세한 색차, 가장자리 둥근 베벨
      r = 54 + T.v * .6; g = 96 + T.v + T.g; b = 88 + T.v * .8; h = .62 + bev * .26 + micro[i] * .01; ro = .16 + fine[i] * .12;
      const sh = 1 - (1 - bev) * .25; r *= sh; g *= sh; b *= sh;
      if (T.stain) { const s2 = sstep(.4, .7, big[i]); r = mixc(r, 92, s2 * .5); g = mixc(g, 84, s2 * .5); b = mixc(b, 60, s2 * .5); ro += s2 * .3; }
      if (T.chip && lx > ts * .7 && ly < ts * .3 && fine[i] > .5) { r = 150; g = 146; b = 132; h = .4; ro = .9; }
      if (T.crack) { const d = Math.abs((lx - ts / 2) * Math.sin(T.ca) - (ly - ts / 2) * Math.cos(T.ca) + (fine[i] - .5) * 10); if (d < 1.1) { r *= .35; g *= .35; b *= .35; h = .3; ro = .9; } }
      if (T.miss) { const v = 96 + (fine[i] - .5) * 40; r = v; g = v - 4; b = v - 10; h = .25 + fine[i] * .15; ro = .97; if (fine[i] > .62) { r *= .6; g *= .6; b *= .6; } }
      if (grout && !T.miss) { const v = 70 + fine[i] * 30; r = v; g = v - 4; b = v - 10; h = .3; ro = .95; }
    } else {
      // 상부 벽: 1층 크림 페인트 → 2층 옛 청회색 페인트 → 회반죽 · 시멘트
      const t = big[i] * .7 + fine[i] * .3, p1 = peel[i] + (fine[i] - .5) * .05, p2 = peel2[i];
      // 벗겨짐은 작고 드물게 (큰 얼룩이 벽 전체를 덮어 '깨진 텍스처'처럼 보이지 않도록)
      const l1 = p1 > .69, l2 = l1 && p2 > .64;
      const e1 = sstep(.67, .69, p1) * (1 - sstep(.69, .71, p1));
      if (!l1) { r = mixc(168, 196, t); g = mixc(162, 188, t); b = mixc(140, 164, t); h = .62 + fine[i] * .05; ro = .82; }
      else if (!l2) { r = mixc(140, 160, t); g = mixc(146, 164, t); b = mixc(140, 156, t); h = .5 + fine[i] * .05; ro = .7; }
      else { const v = mixc(120, 146, micro[i] * .5 + fine[i] * .5); r = v; g = v - 3; b = v - 9; h = .36 + micro[i] * .1; ro = .97; }
      if (e1 > .2) { r = mixc(r, 214, e1 * .7); g = mixc(g, 208, e1 * .7); b = mixc(b, 188, e1 * .7); h += e1 * .12; }   // 들뜬 페인트 가장자리
      if (!l1 && p1 > .655 && p1 < .67) { r *= .88; g *= .88; b *= .88; }                                                    // 가장자리 그림자
      // 위에서 흘러내린 물 얼룩
      const st = Math.max(0, streak[x % N] - .6) * 2.2 * (1 - y / N * .9) * (.4 + big[i]), sfac = st * (.6 + .4 * Math.sin(y * .05 + x));
      r -= sfac * 60; g -= sfac * 52; b -= sfac * 40; ro -= sfac * .35;
      // 징두리 위 몰딩(나무 띠)
      if (y > dado - 14) { const k = (y - (dado - 14)) / 14; r = 74 + k * 10; g = 56 + k * 6; b = 40; h = .75 - Math.abs(k - .5) * .3; ro = .5; }
    }
    // 곰팡이 (천장 아래 · 바닥 위 · 징두리 경계)
    const edgeY = Math.max(1 - y / (N * .2), (y - N * .86) / (N * .14), 1 - Math.abs(y - dado) / (N * .05), 0);
    const m = sstep(.62, .84, mold[i] + edgeY * .28) * (.4 + fine[i] * .6);
    r = mixc(r, 38, m * .7); g = mixc(g, 46, m * .7); b = mixc(b, 30, m * .7); ro = mixc(ro, .9, m);
    // 바닥 근처 때 · 천장 아래 그을음
    const grime = Math.max(0, (y - N * .92) / (N * .08)) * (.6 + fine[i] * .4) + Math.max(0, 1 - y / (N * .06)) * .5;
    r = mixc(r, 40, grime * .55); g = mixc(g, 36, grime * .55); b = mixc(b, 30, grime * .55);
    const v = (big[i] - .5) * 14; C[i * 3] = r + v; C[i * 3 + 1] = g + v; C[i * 3 + 2] = b + v;
    H[i] = h + (micro[i] - .5) * .03; R[i] = Math.max(.1, Math.min(1, ro));
  }
  crackLines(H, R, N, 12, 160, .18);
  const { cv, g } = colorTex(C, N);
  // 긁힌 자국 · 낙서 흔적
  g.globalAlpha = .22; for (let k = 0; k < 6; k++) { g.strokeStyle = pick(['#2a2420', '#5a1414', '#1a1a2a']); g.lineWidth = rr(1, 3); g.beginPath(); let x = rnd() * N, y = N * rr(.25, .55); g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += rr(-40, 40); y += rr(-20, 20); g.lineTo(x, y); } g.stroke(); }
  g.globalAlpha = 1;
  return { map: toTex(cv, true), normalMap: normalFromHeight(H, N, 6), roughnessMap: grayTex(R, N) };
}
// 바닥 타일: 8×8, 줄눈, 깨진 타일, 먼지, 젖은 얼룩
export function pbrTile(N = 2048) {
  const n = 8, s = N / n, dirt = fbm(N, 4, 5), fine = fbm(N, 96, 2), wet = fbm(N, 3, 4);
  const H = new Float32Array(N * N), R = new Float32Array(N * N), C = new Uint8ClampedArray(N * N * 3);
  const tileVar = Array.from({ length: n * n }, () => ({ v: rr(-14, 14), miss: rnd() < .05, chip: rnd() < .2, hue: rnd() < .5 ? 0 : 1 }));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, tx = (x / s) | 0, ty = (y / s) | 0, T = tileVar[ty * n + tx];
    const lx = x % s, ly = y % s, gd = Math.min(lx, ly, s - lx, s - ly);
    const grout = gd < 3, bevel = sstep(3, 8, gd);
    const checker = (tx + ty) & 1;
    let base = checker ? 132 : 108; base += T.v;
    let r = base, g = base - 3, b = base - 14, h = .6 + bevel * .3 + fine[i] * .04, ro = .35 + fine[i] * .2;
    if (T.hue) { r -= 6; b += 6; }
    if (grout) { r = 46; g = 43; b = 38; h = .2; ro = .95; }
    if (T.miss && !grout) { r = 30; g = 28; b = 24; h = .05 + fine[i] * .1; ro = 1; }
    if (T.chip && !grout && lx < s * .35 && ly < s * .3 && fine[i] > .45) { r *= .55; g *= .55; b *= .55; h = .35; ro = .9; }
    const d = sstep(.45, .8, dirt[i]); r = mixc(r, 52, d * .7); g = mixc(g, 46, d * .7); b = mixc(b, 36, d * .7); ro = mixc(ro, .9, d);
    const w = sstep(.6, .72, wet[i]); r *= 1 - w * .35; g *= 1 - w * .33; b *= 1 - w * .3; ro = mixc(ro, .08, w);
    C[i * 3] = r; C[i * 3 + 1] = g; C[i * 3 + 2] = b; H[i] = h; R[i] = ro;
  }
  // 테라조 골재 (작은 돌 조각)
  for (let k = 0; k < N * N / 260; k++) { const cx = rnd() * N, cy = rnd() * N, rad = rr(.8, 2.4), d = rnd() < .5 ? rr(18, 34) : -rr(18, 30);
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) { if (x * x + y * y > rad * rad) continue; const i = (((cy + y) | 0) % N) * N + (((cx + x) | 0) % N); if (H[i] < .5) continue; C[i * 3] += d; C[i * 3 + 1] += d; C[i * 3 + 2] += d * .9; } }
  crackLines(H, R, N, 22, 120, .25);
  const { cv } = colorTex(C, N);
  return { map: toTex(cv, true), normalMap: normalFromHeight(H, N, 5), roughnessMap: grayTex(R, N) };
}
// 나무 마루: 판재, 결, 틈, 마모, 물 피해
export function pbrWood(N = 2048, tint = [1, 1, 1]) {
  const pl = 10, s = N / pl, warp = fbm(N, 8, 4), wear = fbm(N, 4, 5), fine = fbm(N, 128, 2);
  const H = new Float32Array(N * N), R = new Float32Array(N * N), C = new Uint8ClampedArray(N * N * 3);
  const planks = Array.from({ length: pl }, () => ({ off: rnd() * N, v: rr(-16, 16), f: rr(18, 34) }));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, p = planks[(y / s) | 0], ly = y % s;
    const seam = ly < 2 || ((x + p.off) % N) < 3;
    const grain = Math.sin((y + warp[i] * 60) * .9 / 4 + Math.sin((x + p.off) * .012) * 3) * .5 + .5;
    const ring = Math.pow(Math.abs(Math.sin((x + p.off) * .004 * p.f / 10 + warp[i] * 6)), 6);
    let base = 70 + p.v + grain * 18 - ring * 14;
    let r = base + 26, g = base + 10, b = base - 8, h = .6 + grain * .06 + fine[i] * .03, ro = .55 + grain * .1;
    const wv = sstep(.55, .8, wear[i]); r = mixc(r, 44, wv * .6); g = mixc(g, 34, wv * .6); b = mixc(b, 26, wv * .6); ro = mixc(ro, .85, wv); h -= wv * .05;
    if (seam) { r = 18; g = 12; b = 8; h = .25; ro = 1; }
    C[i * 3] = r * tint[0]; C[i * 3 + 1] = g * tint[1]; C[i * 3 + 2] = b * tint[2]; H[i] = h; R[i] = ro;
  }
  const { cv } = colorTex(C, N);
  return { map: toTex(cv, true), normalMap: normalFromHeight(H, N, 4), roughnessMap: grayTex(R, N) };
}
// 천장: 흡음 텍스 (구멍 패턴) + T바 + 누수 얼룩 링
export function pbrCeiling(N = 1024) {
  const n = 4, s = N / n, stain = fbm(N, 4, 5), fine = fbm(N, 128, 2);
  const H = new Float32Array(N * N), R = new Float32Array(N * N), C = new Uint8ClampedArray(N * N * 3);
  const tv = Array.from({ length: n * n }, () => rr(-10, 8));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, lx = x % s, ly = y % s, bar = Math.min(lx, ly, s - lx, s - ly) < 5;
    const pore = ((Math.sin(x * 1.9 + fine[i] * 9) * Math.sin(y * 2.1 + fine[i] * 7)) > .86);
    let v = 156 + tv[((y / s) | 0) * n + ((x / s) | 0)] + fine[i] * 10;
    let r = v, g = v - 3, b = v - 14, h = .6 + fine[i] * .1, ro = .95;
    if (pore) { r *= .7; g *= .7; b *= .7; h = .45; }
    const st = stain[i], ringd = Math.abs(st - .66);
    const ring = sstep(.7, .66, st) * (1 - sstep(0, .015, ringd)) + sstep(.66, .78, st) * .6;
    r = mixc(r, 120, ring * .6); g = mixc(g, 92, ring * .6); b = mixc(b, 52, ring * .6);
    if (bar) { r = 70; g = 72; b = 70; h = .85; ro = .6; }
    C[i * 3] = r; C[i * 3 + 1] = g; C[i * 3 + 2] = b; H[i] = h; R[i] = ro;
  }
  const { cv } = colorTex(C, N);
  return { map: toTex(cv, true), normalMap: normalFromHeight(H, N, 4), roughnessMap: grayTex(R, N) };
}
// 콘크리트 (계단·지하·외벽 하단)
export function pbrConcrete(N = 512, col = [128, 126, 118]) {
  const big = fbm(N, 4, 5), fine = fbm(N, 64, 3), pits = fbm(N, 128, 1), wet = fbm(N, 3, 4);
  const H = new Float32Array(N * N), R = new Float32Array(N * N), C = new Uint8ClampedArray(N * N * 3);
  for (let i = 0; i < N * N; i++) {
    const v = (big[i] - .5) * 40 + (fine[i] - .5) * 24, pit = pits[i] > .78;
    const w = sstep(.62, .75, wet[i]);
    C[i * 3] = (col[0] + v) * (1 - w * .35) * (pit ? .6 : 1); C[i * 3 + 1] = (col[1] + v) * (1 - w * .33) * (pit ? .6 : 1); C[i * 3 + 2] = (col[2] + v) * (1 - w * .3) * (pit ? .6 : 1);
    H[i] = .5 + fine[i] * .3 + big[i] * .1 - (pit ? .2 : 0); R[i] = mixc(.92, .2, w);
  }
  crackLines(H, R, N, 8, 90, .2);
  const { cv } = colorTex(C, N);
  return { map: toTex(cv, true), normalMap: normalFromHeight(H, N, 5), roughnessMap: grayTex(R, N) };
}
// 핏자국·손자국·끌린 자국 데칼 (투명)
export const makeBlood = (kind = 'hand') => ctex(256, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const red = () => `rgba(${rr(70, 110) | 0},${rr(4, 14) | 0},${rr(6, 14) | 0},${rr(.55, .9)})`;
  if (kind === 'hand') {
    for (let k = 0; k < 3; k++) {
      g.save(); g.translate(rr(60, 196), rr(60, 196)); g.rotate(rr(-.6, .6)); g.fillStyle = red();
      g.beginPath(); g.ellipse(0, 18, 24, 28, 0, 0, 6.3); g.fill();
      [-22, -9, 4, 17].forEach((fx, j) => { g.beginPath(); g.ellipse(fx, -22 - (j === 1 || j === 2 ? 10 : 0), 6, 18, (fx) * .01, 0, 6.3); g.fill(); });
      g.beginPath(); g.ellipse(30, 10, 6, 14, -.8, 0, 6.3); g.fill();
      g.fillRect(-20, 30, 40, rr(20, 60)); g.restore();
    }
  } else if (kind === 'drag') {
    g.fillStyle = red(); for (let k = 0; k < 4; k++) { g.save(); g.translate(40 + k * 14, 0); for (let y = 0; y < h; y += 4) g.fillRect(Math.sin(y * .05) * 6 + rr(-2, 2), y, rr(6, 14), 4); g.restore(); }
  } else {
    for (let k = 0; k < 40; k++) { g.fillStyle = red(); g.beginPath(); g.arc(w / 2 + rr(-1, 1) * rr(0, 90), h / 2 + rr(-1, 1) * rr(0, 90), rr(2, 22), 0, 6.3); g.fill(); }
  }
}, { repeat: false });

// 미리 구운 PBR 텍스처 (assets/tex) 불러오기
const _pbr = {};
export let windowAtlasTexture = null;
export async function loadPBR() {
  const L = new THREE.TextureLoader(), names = ['wall', 'tile', 'wood', 'ceil', 'step', 'base', 'varnish', 'varnishDark', 'paint', 'locker', 'rust', 'door', 'brick', 'facade', 'dirt', 'track', 'pooltile', 'roofmetal', 'bluemetal', 'twall', 'tfloor'];
  await Promise.all([...names.flatMap(n => ['map', 'normal', 'rough'].map(async m => {
    const t = await L.loadAsync(`assets/tex/${n}_${m}.webp`).catch(() => null); if (!t) return;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; if (m === 'map') t.colorSpace = THREE.SRGBColorSpace;   // 비스듬한 바닥도 선명하게 (GPU 최대값으로 자동 제한)
    (_pbr[n] ||= {})[m === 'map' ? 'map' : m === 'normal' ? 'normalMap' : 'roughnessMap'] = t;
  })), L.loadAsync('assets/tex/win_atlas.webp').then(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;windowAtlasTexture=t;}).catch(()=>{windowAtlasTexture=makeWindow();})]);
}
// 구운 텍스처가 있으면 쓰고, 없으면 즉석에서 생성
export const pbr = (name, gen) => (_pbr[name] && _pbr[name].map && _pbr[name].normalMap && _pbr[name].roughnessMap) ? _pbr[name] : gen();

/* ---------- 2차: 극사실 재질 (가구 · 문 · 금속 · 외벽 · 지면) ---------- */
function pack(H, R, C, N, k = 5) { const { cv } = colorTex(C, N); return { map: toTex(cv, true), normalMap: normalFromHeight(H, N, k), roughnessMap: grayTex(R, N) }; }
function scratches(H, R, C, N, n, len, depth, col) {
  for (let s = 0; s < n; s++) {
    let x = rnd() * N, y = rnd() * N; const a = rnd() * 6.28, L = len * (.3 + rnd());
    for (let t = 0; t < L; t++) { x += Math.cos(a); y += Math.sin(a) + rr(-.2, .2); const i = ((((y | 0) % N) + N) % N) * N + ((((x | 0) % N) + N) % N); H[i] -= depth; R[i] = Math.min(1, R[i] + .15); if (col) { C[i * 3] = mixc(C[i * 3], col[0], .5); C[i * 3 + 1] = mixc(C[i * 3 + 1], col[1], .5); C[i * 3 + 2] = mixc(C[i * 3 + 2], col[2], .5); } }
  }
}
// 니스 칠한 학교 책상 나무: 결 + 옹이 + 낙서 긁힘 + 닳은 모서리 + 껌 자국
export function pbrVarnish(N = 1024, base = [150, 98, 56]) {
  const warp = fbm(N, 6, 4), fine = fbm(N, 160, 2), wear = fbm(N, 3, 5);
  const H = new Float32Array(N * N), R = new Float32Array(N * N), C = new Uint8ClampedArray(N * N * 3);
  const knots = Array.from({ length: 4 }, () => [rnd() * N, rnd() * N, rr(14, 30)]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x; let w = warp[i] * 40;
    for (const [kx, ky, kr] of knots) { const dx = x - kx, dy = (y - ky) * 3, d = Math.hypot(dx, dy); if (d < kr * 4) w += Math.sin(d / kr * 6) * (1 - d / (kr * 4)) * 14; }
    const g = (Math.sin((y + w) * .21 + fine[i] * 2.5) * .5 + .5) * .55 + fine[i] * .45, g2 = Math.pow(Math.abs(Math.sin((y + w * 1.7) * .043 + warp[i] * 3)), 10);
    let r = base[0] * (.86 + g * .12 - g2 * .18), gg = base[1] * (.86 + g * .12 - g2 * .2), b = base[2] * (.84 + g * .12 - g2 * .22);
    const wv = sstep(.55, .8, wear[i]); r = mixc(r, r * .62, wv); gg = mixc(gg, gg * .6, wv); b = mixc(b, b * .58, wv);
    C[i * 3] = r + (fine[i] - .5) * 10; C[i * 3 + 1] = gg + (fine[i] - .5) * 8; C[i * 3 + 2] = b + (fine[i] - .5) * 6;
    H[i] = .6 + g * .03 + fine[i] * .02; R[i] = mixc(.32, .75, wv) + fine[i] * .08;
  }
  scratches(H, R, C, N, 70, 90, .06, [200, 170, 130]);
  for (let k = 0; k < 6; k++) { const cx = rnd() * N, cy = rnd() * N, rad = rr(4, 10); for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) if (x * x + y * y < rad * rad) { const i = ((((cy + y) | 0) % N + N) % N) * N + ((((cx + x) | 0) % N + N) % N); C[i * 3] = 60; C[i * 3 + 1] = 52; C[i * 3 + 2] = 48; H[i] = .66; R[i] = .9; } }
  return pack(H, R, C, N, 4);
}
// 도장된 철판 (사물함·책상 다리·문틀): 페인트 + 찍힘 + 벗겨져 드러난 녹 + 녹물 흐름
export function pbrPaintMetal(N = 1024, paint = [112, 128, 126]) {
  const chip = fbm(N, 10, 5), big = fbm(N, 3, 4), fine = fbm(N, 128, 2), streak = fbm(N, 64, 2);
  const H = new Float32Array(N * N), R = new Float32Array(N * N), C = new Uint8ClampedArray(N * N * 3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, rusty = chip[i] > .73, edge = sstep(.69, .73, chip[i]) * (1 - sstep(.73, .75, chip[i]));
    let r, g, b, h, ro;
    if (rusty) { const t = fine[i]; r = mixc(92, 140, t); g = mixc(50, 72, t); b = mixc(28, 40, t); h = .42 + fine[i] * .12; ro = .9; }
    else { const v = (big[i] - .5) * 18 + (fine[i] - .5) * 6; r = paint[0] + v; g = paint[1] + v; b = paint[2] + v; h = .6 + fine[i] * .01; ro = .42 + big[i] * .15; }
    if (edge > .2) { r = mixc(r, 175, .5); g = mixc(g, 178, .5); b = mixc(b, 170, .5); h += .03; }
    const st = Math.max(0, streak[x] - .62) * 2.2 * (y / N);
    r = mixc(r, 110, st * .6); g = mixc(g, 60, st * .6); b = mixc(b, 30, st * .6);
    C[i * 3] = r; C[i * 3 + 1] = g; C[i * 3 + 2] = b; H[i] = h; R[i] = ro;
  }
  scratches(H, R, C, N, 40, 60, .05, [170, 170, 160]);
  // 찌그러짐
  for (let k = 0; k < 5; k++) { const cx = rnd() * N, cy = rnd() * N, rad = rr(30, 80); for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) { const d = Math.hypot(x, y); if (d < rad) { const i = ((((cy + y) | 0) % N + N) % N) * N + ((((cx + x) | 0) % N + N) % N); H[i] -= Math.cos(d / rad * 1.57) * .08; } } }
  return pack(H, R, C, N, 6);
}
// 페인트 칠한 나무 문짝: 패널 몰딩 + 벗겨진 페인트 아래 나무
export function pbrDoor(N = 1024, paint = [104, 78, 54]) {
  const warp = fbm(N, 6, 4), chip = fbm(N, 8, 5), fine = fbm(N, 128, 2), dirt = fbm(N, 3, 4);
  const H = new Float32Array(N * N), R = new Float32Array(N * N), C = new Uint8ClampedArray(N * N * 3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, u = x / N, v = y / N;
    const inPanel = (u > .12 && u < .88) && ((v > .07 && v < .45) || (v > .53 && v < .93));
    const bev = inPanel ? Math.min(u - .12, .88 - u, Math.abs(v - (v < .5 ? .07 : .53)), Math.abs((v < .5 ? .45 : .93) - v)) : 1;
    const grain = Math.sin((x + warp[i] * 50) * .3) * .5 + .5, peeled = chip[i] > .68;
    let r, g, b;
    if (peeled) { r = 120 + grain * 30; g = 86 + grain * 22; b = 54 + grain * 14; }
    else { const vv = (dirt[i] - .5) * 30; r = paint[0] + vv + grain * 6; g = paint[1] + vv + grain * 5; b = paint[2] + vv + grain * 4; }
    const d = sstep(.55, .8, dirt[i]) * (v > .8 ? 1 : .4); r = mixc(r, 40, d * .5); g = mixc(g, 34, d * .5); b = mixc(b, 28, d * .5);
    C[i * 3] = r; C[i * 3 + 1] = g; C[i * 3 + 2] = b;
    H[i] = (inPanel ? .45 + sstep(0, .02, bev) * .1 : .6) + grain * .02 + (peeled ? -.03 : 0); R[i] = peeled ? .85 : .5 + dirt[i] * .2;
  }
  return pack(H, R, C, N, 6);
}
// 붉은 벽돌 (외벽): 벽돌마다 색 편차 + 깨진 모서리 + 줄눈 + 이끼 + 백화
export function pbrBrick(N = 1024) {
  const rows = 16, cols = 8, bh = N / rows, bw = N / cols, fine = fbm(N, 96, 3), moss = fbm(N, 4, 5), efflo = fbm(N, 6, 4);
  const H = new Float32Array(N * N), R = new Float32Array(N * N), C = new Uint8ClampedArray(N * N * 3);
  const bv = Array.from({ length: rows * cols * 2 }, () => [rr(-22, 22), rr(-10, 10), rnd() < .08]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, row = (y / bh) | 0, off = (row & 1) ? bw / 2 : 0, xx = (x + off) % N, col = (xx / bw) | 0;
    const lx = xx % bw, ly = y % bh, gd = Math.min(lx, ly, bw - lx, bh - ly), V = bv[row * cols + col];
    const mortar = gd < 4 + fine[i] * 2;
    let r, g, b, h, ro;
    if (mortar) { r = 128; g = 122; b = 112; h = .2 + fine[i] * .1; ro = .95; }
    else { r = 142 + V[0] + (fine[i] - .5) * 30; g = 70 + V[1] + (fine[i] - .5) * 16; b = 52 + V[1] * .6 + (fine[i] - .5) * 12; h = .6 + sstep(4, 10, gd) * .2 + fine[i] * .1 - (V[2] && fine[i] > .6 ? .3 : 0); ro = .82 + fine[i] * .1; }
    const m = sstep(.6, .78, moss[i]) * (y / N); r = mixc(r, 54, m * .7); g = mixc(g, 70, m * .7); b = mixc(b, 40, m * .7);
    const e = sstep(.68, .8, efflo[i]) * (1 - y / N); r = mixc(r, 210, e * .45); g = mixc(g, 206, e * .45); b = mixc(b, 196, e * .45);
    C[i * 3] = r; C[i * 3 + 1] = g; C[i * 3 + 2] = b; H[i] = h; R[i] = ro;
  }
  return pack(H, R, C, N, 7);
}
// 외벽 콘크리트 패널: 거푸집 이음새 + 빗물 자국 + 이끼 + 균열
export function pbrFacade(N = 1024) {
  const big = fbm(N, 3, 5), fine = fbm(N, 96, 3), streak = fbm(N, 56, 2), moss = fbm(N, 5, 5);
  const H = new Float32Array(N * N), R = new Float32Array(N * N), C = new Uint8ClampedArray(N * N * 3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, seam = (x % (N / 2)) < 3 || (y % (N / 2)) < 3, tie = ((x % (N / 4)) - N / 8) ** 2 + ((y % (N / 4)) - N / 8) ** 2 < 30;
    let v = 150 + (big[i] - .5) * 40 + (fine[i] - .5) * 18;
    let r = v, g = v - 2, b = v - 8, h = .55 + fine[i] * .2 + big[i] * .08, ro = .9;
    const st = Math.max(0, streak[x] - .6) * 2.2 * (.3 + y / N) * (.6 + big[i] * .8); r -= st * 50; g -= st * 47; b -= st * 40; ro -= st * .15;
    const m = sstep(.58, .78, moss[i]) * Math.min(1, y / N * 1.6); r = mixc(r, 58, m * .65); g = mixc(g, 70, m * .65); b = mixc(b, 44, m * .65);
    if (seam) { r *= .6; g *= .6; b *= .6; h = .3; }
    if (tie) { r *= .7; g *= .7; b *= .7; h = .35; }
    C[i * 3] = r; C[i * 3 + 1] = g; C[i * 3 + 2] = b; H[i] = h; R[i] = ro;
  }
  crackLines(H, R, N, 10, 140, .22);
  return pack(H, R, C, N, 6);
}
// 운동장 흙: 갈라진 마른 흙 · 젖은 진흙 · 자갈 · 타이어 자국 · 발자국 · 잡초
export function pbrDirt(N = 1024) {
  const big = fbm(N, 4, 5), fine = fbm(N, 128, 3), wet = fbm(N, 3, 4), dry = fbm(N, 5, 4), grass = fbm(N, 9, 4);
  const H = new Float32Array(N * N), R = new Float32Array(N * N), C = new Uint8ClampedArray(N * N * 3);
  // 마른 땅 균열용 보로노이 (타일링)
  const P = [], cell = N / 14; for (let gy = 0; gy < 14; gy++) for (let gx = 0; gx < 14; gx++) P.push([(gx + rnd()) * cell, (gy + rnd()) * cell]);
  const vor = (x, y) => { let d1 = 1e9, d2 = 1e9; const gx = (x / cell) | 0, gy = (y / cell) | 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const cx = (gx + ox + 14) % 14, cy = (gy + oy + 14) % 14, p = P[cy * 14 + cx]; let dx = p[0] - x, dy = p[1] - y; if (dx > N / 2) dx -= N; if (dx < -N / 2) dx += N; if (dy > N / 2) dy -= N; if (dy < -N / 2) dy += N; const d = dx * dx + dy * dy; if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    return Math.sqrt(d2) - Math.sqrt(d1); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, w = sstep(.6, .72, wet[i]), dz = sstep(.55, .66, dry[i]) * (1 - w);
    let r = 104 + (big[i] - .5) * 40 + (fine[i] - .5) * 30, g = 86 + (big[i] - .5) * 32 + (fine[i] - .5) * 24, b = 64 + (big[i] - .5) * 22 + (fine[i] - .5) * 16;
    let h = .5 + fine[i] * .3 + big[i] * .1, ro = .95;
    if (dz > 0) { const e = vor(x, y), crack = 1 - sstep(1.2, 3.2, e + (fine[i] - .5) * 2); r = mixc(r, 150, dz * .35); g = mixc(g, 128, dz * .35); b = mixc(b, 96, dz * .35); h += dz * sstep(0, 8, e) * .15; if (crack > .3) { r *= 1 - crack * dz * .65; g *= 1 - crack * dz * .65; b *= 1 - crack * dz * .65; h -= crack * dz * .35; } }
    const gr = sstep(.66, .8, grass[i]) * (fine[i] > .45 ? 1 : .3) * (1 - w);
    r = mixc(r, 58, gr * .7); g = mixc(g, 76, gr * .7); b = mixc(b, 38, gr * .7); h += gr * .1;
    r *= 1 - w * .48; g *= 1 - w * .46; b *= 1 - w * .4; h -= w * .15; ro = mixc(ro, .08, w);
    C[i * 3] = r; C[i * 3 + 1] = g; C[i * 3 + 2] = b; H[i] = h; R[i] = ro;
  }
  // 타이어 자국 (두 줄, 바퀴 무늬)
  for (let t = 0; t < 2; t++) { let x = rnd() * N, y = 0, a = rr(-.25, .25); for (let s = 0; s < N * 1.2; s++) { a += rr(-.01, .01); x += Math.sin(a); y += Math.cos(a);
    for (const off of [-26, 26]) for (let k = -7; k <= 7; k++) { const ix = (((x + off + k) | 0) % N + N) % N, iy = ((y | 0) % N + N) % N, i = iy * N + ix, tread = ((s + Math.abs(k) * 2) % 9) < 4; H[i] -= tread ? .12 : .06; C[i * 3] *= .82; C[i * 3 + 1] *= .82; C[i * 3 + 2] *= .84; } } }
  // 발자국
  for (let f = 0; f < 18; f++) { let x = rnd() * N, y = rnd() * N; const a = rnd() * 6.28; for (let s = 0; s < 6; s++) { const sx = x + Math.cos(a) * s * 40 + Math.cos(a + 1.57) * (s & 1 ? 9 : -9), sy = y + Math.sin(a) * s * 40 + Math.sin(a + 1.57) * (s & 1 ? 9 : -9);
    for (let yy = -12; yy <= 12; yy++) for (let xx = -5; xx <= 5; xx++) { const lx = xx * Math.cos(a + 1.57) + yy * Math.cos(a), ly = xx * Math.sin(a + 1.57) + yy * Math.sin(a); if ((xx * xx) / 25 + (yy * yy) / 144 > 1) continue; const i = ((((sy + ly) | 0) % N + N) % N) * N + ((((sx + lx) | 0) % N + N) % N); H[i] -= .08; C[i * 3] *= .85; C[i * 3 + 1] *= .85; C[i * 3 + 2] *= .86; } } }
  for (let k = 0; k < 900; k++) { const cx = rnd() * N, cy = rnd() * N, rad = rr(1.5, 4.5), c = rr(70, 112); for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) { const d = x * x + y * y; if (d < rad * rad) { const i = ((((cy + y) | 0) % N + N) % N) * N + ((((cx + x) | 0) % N + N) % N); C[i * 3] = c; C[i * 3 + 1] = c - 6; C[i * 3 + 2] = c - 14; H[i] = .8 - d / (rad * rad) * .2; R[i] = .7; } } }
  return pack(H, R, C, N, 6);
}
// 우레탄 트랙: 붉은 고무 알갱이 · 닳은 자국 · 물기
export function pbrTrack(N = 1024) {
  const big = fbm(N, 4, 5), fine = fbm(N, 256, 1), mid = fbm(N, 32, 3), wet = fbm(N, 3, 4);
  const H = new Float32Array(N * N), R = new Float32Array(N * N), C = new Uint8ClampedArray(N * N * 3);
  for (let i = 0; i < N * N; i++) {
    const gr = fine[i], wear = sstep(.6, .85, big[i]), w = sstep(.68, .8, wet[i]) * .7;
    let r = 132 + (gr - .5) * 60 + (mid[i] - .5) * 20, g = 46 + (gr - .5) * 22, b = 38 + (gr - .5) * 16;
    if (gr > .8) { r -= 40; g -= 14; b -= 10; }
    r = mixc(r, 96, wear * .5); g = mixc(g, 64, wear * .5); b = mixc(b, 54, wear * .5);
    r *= 1 - w * .35; g *= 1 - w * .35; b *= 1 - w * .3;
    C[i * 3] = r; C[i * 3 + 1] = g; C[i * 3 + 2] = b; H[i] = .5 + gr * .35 + mid[i] * .1 - wear * .05; R[i] = mixc(.9 - wear * .1, .15, w);
  }
  return pack(H, R, C, N, 8);
}
// 담쟁이덩굴 (알파): 줄기 + 잎 무리
export const makeIvy = () => ctex(512, 1024, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  const leaf = (x, y, s, a) => { g.save(); g.translate(x, y); g.rotate(a); const c = rr(.7, 1.15); g.fillStyle = `rgb(${34 * c | 0},${rr(58, 82) * c | 0},${26 * c | 0})`;
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-s, -s * .4, -s * .8, -s * 1.3, 0, -s * 1.6); g.bezierCurveTo(s * .8, -s * 1.3, s, -s * .4, 0, 0); g.fill();
    g.strokeStyle = 'rgba(10,20,8,.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s * 1.4); g.stroke(); g.restore(); };
  for (let v = 0; v < 7; v++) {
    let x = rr(.15, .85) * w, y = h; const pts = [];
    g.strokeStyle = '#3a2e20'; g.lineWidth = rr(2, 4); g.beginPath(); g.moveTo(x, y);
    while (y > rr(.05, .4) * h) { x += rr(-14, 14); y -= rr(10, 20); x = Math.max(10, Math.min(w - 10, x)); g.lineTo(x, y); pts.push([x, y]); }
    g.stroke();
    pts.forEach(([px, py], k) => { const n = 2 + (rnd() * 3 | 0); for (let j = 0; j < n; j++) leaf(px + rr(-26, 26), py + rr(-12, 12), rr(9, 18) * (1 - k / pts.length * .4), rr(-1.4, 1.4)); });
  }
}, { repeat: false });

/* ---------- 소품 디테일 텍스처 (컴퓨터실 · 미술실 등) ---------- */
// 키보드 자판 (윗면)
export const makeKeyboard = () => ctex(256, 96, (g, w, h) => {
  g.fillStyle = '#2a2b2d'; g.fillRect(0, 0, w, h);
  const rows = [14, 14, 13, 12, 9], kw = 15.2, kh = 15;
  rows.forEach((n, r) => {
    let x = 6 + r * 3;
    for (let i = 0; i < n; i++) {
      const ww = (r === 4 && i === 4) ? kw * 5 : kw - 2;
      g.fillStyle = r === 4 && i === 4 ? '#3c3d40' : pick(['#3a3b3e', '#37383b', '#3d3e41']);
      g.fillRect(x, 6 + r * 17, ww, kh); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x, 6 + r * 17, ww, 2);
      g.fillStyle = 'rgba(210,210,200,.35)'; g.fillRect(x + 4, 10 + r * 17, 4, 4);
      x += ww + 2;
    }
  });
  g.fillStyle = '#323336'; for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) g.fillRect(w - 46 + i * 14, 6 + r * 17, 12, kh);
  stains(g, w, h, 6, 'rgba(120,110,90,.35)', 20);
});
// 꺼진 모니터 화면 (먼지 · 손자국 · 금 간 것)
export const makeScreenOff = (cracked = false) => ctex(256, 160, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#16191c'); gr.addColorStop(.5, '#0b0d0f'); gr.addColorStop(1, '#14171a');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w * .55, 0); g.lineTo(w * .25, h); g.lineTo(0, h); g.fill();
  stains(g, w, h, 10, 'rgba(160,160,150,.08)', 30);
  if (cracked) {
    const cx = rr(w * .3, w * .7), cy = rr(h * .3, h * .7);
    g.strokeStyle = 'rgba(220,230,235,.55)'; g.lineWidth = 1;
    for (let k = 0; k < 11; k++) { let x = cx, y = cy, a = k / 11 * 6.28 + rr(-.2, .2); g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 8; s++) { a += rr(-.35, .35); x += Math.cos(a) * rr(8, 22); y += Math.sin(a) * rr(8, 22); g.lineTo(x, y); } g.stroke(); }
    for (let r = 6; r < 40; r += rr(8, 14)) { g.beginPath(); for (let k = 0; k <= 12; k++) { const a = k / 12 * 6.28; g.lineTo(cx + Math.cos(a) * r * rr(.8, 1.2), cy + Math.sin(a) * r * rr(.8, 1.2)); } g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(cx, cy, 4, 0, 6.3); g.fill();
  }
});
// 서버 랙 전면 (1U 장비 · LED · 통풍구)
export const makeRack = () => ctex(128, 384, (g, w, h) => {
  g.fillStyle = '#121315'; g.fillRect(0, 0, w, h);
  for (let y = 8; y < h - 8; y += 22) {
    const empty = rnd() < .18;
    g.fillStyle = empty ? '#0a0a0b' : pick(['#24262a', '#2c2e33', '#1e2024']); g.fillRect(10, y, w - 20, 19);
    if (empty) continue;
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(10, y, w - 20, 2);
    g.fillStyle = '#0c0c0d'; for (let i = 0; i < 9; i++) g.fillRect(40 + i * 7, y + 5, 4, 10);
    [['#3dff6a', .6], ['#ffb02a', .2], ['#ff3a2a', .12]].forEach(([c, p], i) => { if (rnd() < p + .2) { g.fillStyle = c; g.fillRect(16 + i * 6, y + 8, 3, 3); } });
    g.fillStyle = '#8a8c90'; g.fillRect(12, y + 2, 2, 15); g.fillRect(w - 14, y + 2, 2, 15);
  }
  g.fillStyle = '#3a3c40'; g.fillRect(0, 0, 8, h); g.fillRect(w - 8, 0, 8, h);
  g.fillStyle = '#6a6c70'; for (let y = 6; y < h; y += 7) { g.fillRect(3, y, 2, 2); g.fillRect(w - 5, y, 2, 2); }
});
// 그림 (미술실 캔버스: 풍경 · 정물 · 얼굴 · 추상) — 공포 연출을 위해 일부는 같은 소녀
export const makePainting = (kind = 0) => ctex(192, 240, (g, w, h) => {
  g.fillStyle = '#d8d0bc'; g.fillRect(0, 0, w, h);
  const blob = (x, y, r, c, a = 1) => { g.globalAlpha = a; g.fillStyle = c; g.beginPath(); g.ellipse(x, y, r, r * rr(.6, 1.2), rr(0, 3), 0, 6.3); g.fill(); g.globalAlpha = 1; };
  if (kind === 0) { // 풍경
    const sky = g.createLinearGradient(0, 0, 0, h * .6); sky.addColorStop(0, '#7a92a8'); sky.addColorStop(1, '#c8b890'); g.fillStyle = sky; g.fillRect(0, 0, w, h * .6);
    g.fillStyle = '#5a6a48'; g.beginPath(); g.moveTo(0, h * .55); for (let x = 0; x <= w; x += 12) g.lineTo(x, h * .5 + Math.sin(x * .05) * 14); g.lineTo(w, h); g.lineTo(0, h); g.fill();
    g.fillStyle = '#7a5a3a'; g.fillRect(w * .62, h * .3, 6, h * .3); for (let k = 0; k < 14; k++) blob(w * .63 + rr(-24, 24), h * .28 + rr(-18, 14), rr(6, 12), pick(['#3a5a2a', '#4a6a32', '#2e4a22']), .9);
    g.fillStyle = '#b8a888'; g.fillRect(w * .15, h * .42, 40, 24); g.fillStyle = '#6a3a2a'; g.beginPath(); g.moveTo(w * .15 - 4, h * .42); g.lineTo(w * .15 + 20, h * .34); g.lineTo(w * .15 + 44, h * .42); g.fill();
  } else if (kind === 1) { // 정물
    g.fillStyle = '#4a3a30'; g.fillRect(0, 0, w, h); g.fillStyle = '#8a6a48'; g.fillRect(0, h * .62, w, h * .38);
    blob(w * .35, h * .58, 26, '#a82a20'); blob(w * .58, h * .6, 22, '#c8a030'); blob(w * .48, h * .52, 18, '#6a8a30');
    g.fillStyle = '#c8c8c0'; g.fillRect(w * .66, h * .3, 22, 64); blob(w * .3, h * .55, 8, '#fff', .3);
  } else if (kind === 2) { // 소녀 초상 (얼굴을 긁어 지운)
    g.fillStyle = '#3a4048'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a1c24'; g.beginPath(); g.ellipse(w / 2, h * .42, 46, 62, 0, 0, 6.3); g.fill();
    g.fillStyle = '#d8c0a8'; g.beginPath(); g.ellipse(w / 2, h * .42, 32, 42, 0, 0, 6.3); g.fill();
    g.fillStyle = '#1a1c24'; g.fillRect(w / 2 - 46, h * .3, 18, 120); g.fillRect(w / 2 + 28, h * .3, 18, 120);
    g.fillStyle = '#28324a'; g.beginPath(); g.moveTo(w * .2, h); g.lineTo(w * .3, h * .66); g.lineTo(w * .7, h * .66); g.lineTo(w * .8, h); g.fill();
    g.fillStyle = '#e8e8e0'; g.beginPath(); g.moveTo(w * .42, h * .66); g.lineTo(w / 2, h * .76); g.lineTo(w * .58, h * .66); g.fill();
    g.fillStyle = '#9a1a1a'; g.fillRect(w / 2 - 8, h * .68, 16, 8);
    g.strokeStyle = 'rgba(20,10,10,.85)'; g.lineWidth = 3; for (let k = 0; k < 16; k++) { g.beginPath(); g.moveTo(w / 2 - 30 + rr(0, 10), h * .32 + rr(0, 60)); g.lineTo(w / 2 + 30 - rr(0, 10), h * .32 + rr(0, 60)); g.stroke(); }
  } else { // 추상
    for (let k = 0; k < 26; k++) blob(rr(0, w), rr(0, h), rr(10, 40), pick(['#8a2a2a', '#2a4a6a', '#c8a040', '#1a1a1a', '#6a6a5a']), rr(.4, .9));
    g.strokeStyle = '#111'; g.lineWidth = 4; g.beginPath(); for (let k = 0; k < 8; k++) g.lineTo(rr(0, w), rr(0, h)); g.stroke();
  }
  speckle(g, w, h, 300, ['#000', '#fff'], 1, 2, .12);
  stains(g, w, h, 4, 'rgba(90,70,40,.3)', 50);
});
// 철제 서류함 서랍 앞면
export const makeCabinet = () => ctex(128, 256, (g, w, h) => {
  g.fillStyle = '#7a8078'; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 4; k++) {
    const y = 6 + k * 62; g.fillStyle = '#868c84'; g.fillRect(6, y, w - 12, 56); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(6, y + 54, w - 12, 3);
    g.fillStyle = '#d8d4c4'; g.fillRect(w / 2 - 16, y + 10, 32, 12); g.fillStyle = '#3a3a38'; g.fillRect(w / 2 - 20, y + 28, 40, 8);
  }
  stains(g, w, h, 8, 'rgba(110,70,40,.45)', 30); speckle(g, w, h, 400, ['#4a4a44', '#b0b0a8'], 1, 3, .3);
});

// 수영장 타일: 2.5cm 모자이크(하늘색 · 흰색 띠) · 줄눈 · 물때 띠 · 녹조 · 금 · 빠진 타일 — 텍스처 1장 = 2m
export function pbrPoolTile(N = 1024) {
  const n = 40, s = N / n, alg = fbm(N, 5, 5), fine = fbm(N, 80, 2), lime = fbm(N, 12, 4);
  const H = new Float32Array(N * N), R = new Float32Array(N * N), C = new Uint8ClampedArray(N * N * 3);
  const tv = Array.from({ length: n * n }, () => ({ v: rr(-10, 10), miss: rnd() < .012, dark: rnd() < .06 }));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, tx = (x / s) | 0, ty = (y / s) | 0, T = tv[ty * n + tx], lx = x % s, ly = y % s, gd = Math.min(lx, ly, s - lx, s - ly);
    const grout = gd < 1.6, bev = sstep(1.4, 4, gd), band = (ty % 20) < 2;
    let r = band ? 52 : 118, g = band ? 92 : 178, b = band ? 140 : 196;
    if (T.dark) { r *= .82; g *= .86; b *= .9; }
    r += T.v; g += T.v; b += T.v * .8;
    let h = .55 + bev * .3 + fine[i] * .03, ro = .14 + fine[i] * .12;
    if (grout) { const v = 120 + fine[i] * 40; r = v * .92; g = v * .95; b = v * .9; h = .25; ro = .9; }
    if (T.miss && !grout) { const v = 70 + fine[i] * 30; r = v; g = v; b = v * .95; h = .1; ro = 1; }
    const a = sstep(.55, .8, alg[i]); r = mixc(r, 46, a * .75); g = mixc(g, 74, a * .75); b = mixc(b, 46, a * .75); ro = mixc(ro, .7, a);   // 녹조
    const l = sstep(.6, .78, lime[i]) * .6; r = mixc(r, 200, l * .5); g = mixc(g, 196, l * .5); b = mixc(b, 182, l * .5); ro = mixc(ro, .85, l);   // 석회 물때
    C[i * 3] = r; C[i * 3 + 1] = g; C[i * 3 + 2] = b; H[i] = h; R[i] = ro;
  }
  crackLines(H, R, N, 10, 140, .3);
  const { cv } = colorTex(C, N);
  return { map: toTex(cv, true), normalMap: normalFromHeight(H, N, 4), roughnessMap: grayTex(R, N) };
}
// 얼굴이 바뀐 초상화: 지워졌던 얼굴에 눈이 뜨여 이쪽을 본다
export const makePaintingStare = () => ctex(192, 240, (g, w, h) => {
  g.fillStyle = '#3a2428'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#120c10'; g.beginPath(); g.ellipse(w / 2, h * .42, 48, 64, 0, 0, 6.3); g.fill();
  g.fillStyle = '#c8b0a0'; g.beginPath(); g.ellipse(w / 2, h * .44, 31, 42, 0, 0, 6.3); g.fill();
  g.fillStyle = '#120c10'; g.fillRect(w / 2 - 48, h * .3, 18, 130); g.fillRect(w / 2 + 30, h * .3, 18, 130);
  [[-12, 0], [12, 0]].forEach(([dx]) => { g.fillStyle = '#f0e8e0'; g.beginPath(); g.ellipse(w / 2 + dx, h * .42, 7, 5, 0, 0, 6.3); g.fill(); g.fillStyle = '#100808'; g.beginPath(); g.arc(w / 2 + dx, h * .42, 3, 0, 6.3); g.fill(); });
  g.strokeStyle = '#6a1010'; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2 - 9, h * .53); g.quadraticCurveTo(w / 2, h * .555, w / 2 + 9, h * .53); g.stroke();
  g.fillStyle = 'rgba(150,10,10,.8)'; for (let k = 0; k < 6; k++) g.fillRect(w / 2 - 14 + k * 5, h * .44, 1.5, rr(14, 40));
  g.fillStyle = '#28324a'; g.beginPath(); g.moveTo(w * .2, h); g.lineTo(w * .3, h * .66); g.lineTo(w * .7, h * .66); g.lineTo(w * .8, h); g.fill();
  speckle(g, w, h, 300, ['#000', '#fff'], 1, 2, .12);
});
// 화장실 벽 타일: 1장 = 2m × 2m, 아이보리 유약 타일 12장(≈16.7cm) — 줄눈 때 · 금 · 깨진 모서리 · 빠진 타일 · 위에서 흘러내린 녹물 · 곰팡이 점
export function pbrToiletWall(N = 1024) {
  const n = 12, s = N / n, big = fbm(N, 4, 5), fine = fbm(N, 96, 2), mold = fbm(N, 24, 4), micro = fbm(N, 256, 1);
  const H = new Float32Array(N * N), R = new Float32Array(N * N), C = new Uint8ClampedArray(N * N * 3);
  const tv = Array.from({ length: n * n }, () => ({ v: rr(-9, 9), y: rnd() < .07, miss: rnd() < .02, crack: rnd() < .1, chip: rnd() < .18, ca: rnd() * 3.14 }));
  const streaks = Array.from({ length: 22 }, () => ({ x: rnd() * N, w: rr(5, 18), y0: rnd() * N, len: rr(.2, .8) * N, a: rr(.18, .5), rust: rnd() < .5 }));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, tx = (x / s) | 0, ty = (y / s) | 0, T = tv[ty * n + tx], lx = x % s, ly = y % s, gd = Math.min(lx, ly, s - lx, s - ly);
    const grout = gd < 2, bev = sstep(1.6, 6, gd);
    let r = 200 + T.v, g = 196 + T.v, b = 180 + T.v * .8;
    if (T.y) { r -= 8; g -= 10; b -= 18; }   // 누렇게 바랜 타일
    let h = .6 + bev * .28 + micro[i] * .01, ro = .1 + fine[i] * .1;
    const sh = 1 - (1 - bev) * .18; r *= sh; g *= sh; b *= sh;
    const dirt = sstep(.42, .85, big[i]), wst = sstep(.55, .7, mold[i]) * .35; r = mixc(r, 140, dirt * .55); g = mixc(g, 130, dirt * .55); b = mixc(b, 104, dirt * .55); ro += dirt * .25;
    r = mixc(r, 168, wst); g = mixc(g, 160, wst); b = mixc(b, 140, wst);   // 물 얼룩 테두리
    if (T.chip && lx > s * .8 && ly < s * .2 && fine[i] > .5) { r = 168; g = 160; b = 146; h = .42; ro = .9; }
    if (T.crack) { const d = Math.abs((lx - s / 2) * Math.sin(T.ca) - (ly - s / 2) * Math.cos(T.ca) + (fine[i] - .5) * 12); if (d < 1) { r *= .4; g *= .4; b *= .38; h = .3; ro = .9; } }
    if (T.miss) { const v = 112 + (fine[i] - .5) * 50; r = v; g = v - 4; b = v - 12; h = .22 + fine[i] * .15; ro = .97; }
    if (grout && !T.miss) { const v = 92 + fine[i] * 34 - dirt * 30; r = v; g = v - 3; b = v - 10; h = .3; ro = .95; if (mold[i] > .62) { r *= .45; g *= .5; b *= .42; } }
    C[i * 3] = r; C[i * 3 + 1] = g; C[i * 3 + 2] = b; H[i] = h; R[i] = ro;
  }
  // 흘러내린 녹물 · 때 자국 (세로 줄무늬, 아래로 갈수록 옅어진다)
  for (const st of streaks) for (let k = 0; k < st.len; k++) {
    const yy = ((st.y0 + k) | 0) % N, fade = st.a * (1 - k / st.len), wob = Math.sin(k * .05 + st.x) * 2;
    for (let dx = -st.w; dx <= st.w; dx++) {
      const xx = ((((st.x + dx + wob) | 0) % N) + N) % N, i = yy * N + xx, q = dx / st.w, e = fade * Math.exp(-q * q * 3) * (.75 + fine[i] * .5);
      if (st.rust) { C[i * 3] = mixc(C[i * 3], 120, e * .6); C[i * 3 + 1] = mixc(C[i * 3 + 1], 72, e * .6); C[i * 3 + 2] = mixc(C[i * 3 + 2], 40, e * .6); }
      else { C[i * 3] = mixc(C[i * 3], 96, e * .45); C[i * 3 + 1] = mixc(C[i * 3 + 1], 92, e * .45); C[i * 3 + 2] = mixc(C[i * 3 + 2], 80, e * .45); }
      R[i] = Math.min(1, R[i] + e * .3);
    }
  }
  return pack(H, R, C, N, 4);
}
