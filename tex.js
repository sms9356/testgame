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

export function ctex(w, h, fn, { repeat = true, aniso = 4 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
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

export const makeFlag = () => ctex(256, 170, (g, w, h) => {
  g.fillStyle = '#ddd8c8'; g.fillRect(0, 0, w, h);
  g.save(); g.translate(w / 2, h / 2);
  g.fillStyle = '#9a2a2c'; g.beginPath(); g.arc(0, 0, 34, Math.PI, 0); g.fill();
  g.fillStyle = '#2a3f78'; g.beginPath(); g.arc(0, 0, 34, 0, Math.PI); g.fill();
  g.fillStyle = '#9a2a2c'; g.beginPath(); g.arc(-17, 0, 17, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2a3f78'; g.beginPath(); g.arc(17, 0, 17, 0, Math.PI * 2); g.fill();
  g.restore();
  g.fillStyle = '#1a1a1a';
  [[28, 22], [w - 28, 22], [28, h - 22], [w - 28, h - 22]].forEach(([x, y]) => { for (let i = -1; i <= 1; i++) g.fillRect(x - 14, y + i * 6 - 1, 28, 3); });
  stains(g, w, h, 8, 'rgba(60,50,30,.5)', 40);
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
export const makeGatePlaque = () => ctex(128, 256, (g, w, h) => {
  g.fillStyle = '#c9c2a4'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 400, ['#6a6248', '#e8e2c8'], 2, 8, .4);
  stains(g, w, h, 8, 'rgba(60,50,30,.5)', 40);
  g.fillStyle = '#1c1812'; g.font = `900 78px ${FONT}`; g.textAlign = 'center';
  g.fillText('폐', w / 2, 100); g.fillText('교', w / 2, 200);
  g.strokeStyle = '#4a3a22'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
}, { repeat: false });
export const makeWarning = () => ctex(256, 160, (g, w, h) => {
  g.fillStyle = '#d8d4c8'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#b3262e'; g.fillRect(8, 8, w - 16, 60);
  g.fillStyle = '#fff'; g.font = `900 46px ${FONT}`; g.textAlign = 'center'; g.fillText('출입금지', w / 2, 56);
  g.fillStyle = '#222'; g.font = `16px ${FONT}`; g.fillText('안전사고 위험 · 무단출입 시', w / 2, 98); g.fillText('법에 따라 처벌받을 수 있습니다', w / 2, 122);
  stains(g, w, h, 10, 'rgba(90,60,20,.55)', 40);
  speckle(g, w, h, 400, ['#4a2a14', '#fff'], 2, 6, .5);
}, { repeat: false });
