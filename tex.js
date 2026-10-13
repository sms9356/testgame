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
  g.fillStyle = '#0c0c0c'; g.fillRect(0, 0, w, h); g.fillStyle = '#c02020'; g.font = 'bold 54px monospace'; g.textAlign = 'center'; g.fillText('18 : 88', w / 2, 62);
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
    if (day === 12) { g.strokeStyle = '#c01818'; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y - 6, 16, 14, 0, 0, 6.3); g.stroke(); g.fillStyle = '#c01818'; g.font = `bold 12px ${FONT}`; g.fillText('졸업식', x, y + 14); }
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
