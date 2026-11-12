// 절차 미술 화가 (브라우저 캔버스) — tools/gen_art.mjs 가 헤드리스 Chromium 에서 부른다
//   유화(산 · 한옥 마을 · 바다) · 역대 교장 초상 · 졸업 단체사진 · 1998 방송부 사진 · 교훈 붓글씨 · 상장 · 학생 작품(수채 · 정물 · 소묘 · 2008 포스터)
//   실존 인물 · 상표 · 저작물 없음: 얼굴은 흐린 덩어리, 이름은 지어낸 것 (제9대 교장만 story.js 와 맞춘다)
(() => {
const R = s => { let a = s >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
let rnd = R(1); const rr = (a, b) => a + (b - a) * rnd(); const ri = (a, b) => Math.floor(rr(a, b + 1)); const pick = a => a[Math.floor(rnd() * a.length)];
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const ctx = c => c.getContext('2d', { willReadFrequently: true });
const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v;
const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// 값 노이즈 + fbm
function noise(seed) { const r = R(seed), N = 256, P = new Float32Array(N * N); for (let i = 0; i < P.length; i++) P[i] = r();
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = P[(yi & 255) * N + (xi & 255)], b = P[(yi & 255) * N + (xi + 1 & 255)], c = P[(yi + 1 & 255) * N + (xi & 255)], d = P[(yi + 1 & 255) * N + (xi + 1 & 255)];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }; }
const fbm = (n, x, y, o = 4) => { let s = 0, a = .5, f = 1, t = 0; for (let i = 0; i < o; i++) { s += a * n(x * f, y * f); t += a; a *= .5; f *= 2.03; } return s / t; };
function grad(g, x0, y0, x1, y1, stops) { const G = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, c]) => G.addColorStop(t, c)); return G; }
function eachPx(c, fn) { const g = ctx(c), d = g.getImageData(0, 0, c.width, c.height), p = d.data, W = c.width; for (let i = 0, n = p.length / 4; i < n; i++) fn(p, i * 4, i % W, (i / W) | 0); g.putImageData(d, 0, 0); }

// ── 유화: 참조 그림을 붓 터치로 다시 칠하고 물감 두께(높이)로 임파스토 하이라이트 ──
function paintify(ref, o = {}) {
  const W = ref.width, H = ref.height, out = mk(W, H), g = ctx(out), hc = mk(W, H), hg = ctx(hc);
  const sizes = o.sizes || [16, 9, 5, 2.6], dens = o.density || 1, lenK = o.len || 2.4, jit = o.jitter ?? 14;
  const src = ctx(ref).getImageData(0, 0, W, H).data, L = i => src[i] * .3 + src[i + 1] * .59 + src[i + 2] * .11;
  g.filter = 'blur(3px)'; g.drawImage(ref, 0, 0); g.filter = 'none';   // 밑칠
  hg.fillStyle = '#000'; hg.fillRect(0, 0, W, H);
  for (const s of sizes) {
    const n = Math.round(dens * W * H / (s * s) * 1.3);
    for (let k = 0; k < n; k++) {
      const x = rnd() * W, y = rnd() * H, xi = x | 0, yi = y | 0, i = (yi * W + xi) * 4;
      const xa = Math.min(W - 2, Math.max(1, xi)), ya = Math.min(H - 2, Math.max(1, yi)), j = (ya * W + xa) * 4;
      const gx = L(j + 4) - L(j - 4), gy = L(j + W * 4) - L(j - W * 4), gm = Math.hypot(gx, gy);
      let a = o.angle ? o.angle(x, y) : 0; if (gm > (o.edge ?? 18) && o.follow !== false) a = Math.atan2(gy, gx) + Math.PI / 2;
      a += (rnd() - .5) * (o.wobble ?? .5);
      const jj = (rnd() - .5) * jit, c = [clamp(src[i] + jj + (rnd() - .5) * 8), clamp(src[i + 1] + jj + (rnd() - .5) * 8), clamp(src[i + 2] + jj + (rnd() - .5) * 8)];
      const len = s * lenK * (.6 + rnd() * .8), wd = s * (.7 + rnd() * .5);
      g.save(); g.translate(x, y); g.rotate(a); g.globalAlpha = o.alpha ?? .8; g.fillStyle = rgb(c);
      g.beginPath(); g.ellipse(0, 0, len / 2, wd / 2, 0, 0, 7); g.fill();
      g.globalAlpha = .18; for (let b = 0; b < 3; b++) { const yy = (rnd() - .5) * wd * .8; g.strokeStyle = rnd() < .5 ? rgb(mix(c, [0, 0, 0], .35)) : rgb(mix(c, [255, 255, 255], .3)); g.lineWidth = Math.max(.5, s * .12); g.beginPath(); g.moveTo(-len * .45, yy); g.lineTo(len * .45, yy + (rnd() - .5) * 1.5); g.stroke(); }
      g.restore();
      hg.save(); hg.translate(x, y); hg.rotate(a); hg.globalAlpha = .22; hg.fillStyle = '#fff'; hg.beginPath(); hg.ellipse(0, 0, len / 2, wd / 2, 0, 0, 7); hg.fill();
      hg.globalAlpha = .25; hg.strokeStyle = '#000'; hg.lineWidth = Math.max(.6, s * .1); for (let b = 0; b < 2; b++) { const yy = (rnd() - .5) * wd * .7; hg.beginPath(); hg.moveTo(-len * .45, yy); hg.lineTo(len * .45, yy); hg.stroke(); } hg.restore();
    }
  }
  // 임파스토: 왼쪽 위 빛
  const hd = hg.getImageData(0, 0, W, H).data, k = o.impasto ?? 1.1;
  eachPx(out, (p, i, x, y) => { if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) return; const a = hd[i - (W + 1) * 4], b = hd[i + (W + 1) * 4], d = (a - b) * k * .5;
    const weave = ((x % 3 === 0) ^ (y % 3 === 0)) ? -2 : 1; p[i] = clamp(p[i] + d + weave); p[i + 1] = clamp(p[i + 1] + d + weave); p[i + 2] = clamp(p[i + 2] + d * .9 + weave); });
  return out;
}
// 니스 황변 · 비네팅 · (선택) 균열
function ageOil(c, o = {}) { const g = ctx(c), W = c.width, H = c.height;
  g.globalCompositeOperation = 'multiply'; g.fillStyle = o.tint || 'rgba(255,236,196,.55)'; g.fillRect(0, 0, W, H);
  const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75); v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(1, `rgba(${o.vig || '120,100,80'},1)`); g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  if (o.crack) { g.strokeStyle = 'rgba(20,12,6,.22)'; g.lineWidth = .6; for (let k = 0; k < o.crack; k++) { let x = rnd() * W, y = rnd() * H; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (rnd() - .5) * 18; y += (rnd() - .5) * 18; g.lineTo(x, y); } g.stroke(); } }
  return c; }

// ── 풍경 유화 참조 ──
function ridgePath(g, W, H, base, amp, n, f, col, o2 = 3) { g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 2) g.lineTo(x, base - amp * (fbm(n, x * f, o2 * 7.3, 5) - .3) * 2.2); g.lineTo(W, H); g.closePath(); g.fill(); }
const ridgeY = (W, base, amp, n, f, o2 = 3) => x => base - amp * (fbm(n, x * f, o2 * 7.3, 5) - .3) * 2.2;
function pine(g, x, y, h, col) { g.strokeStyle = '#3a2a1c'; g.lineWidth = Math.max(1.5, h * .05); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + h * .15 * (rnd() - .5), y - h * .5, x + h * (rnd() - .5) * .25, y - h); g.stroke();
  for (let k = 0; k < 6; k++) { const t = .35 + k * .12, cx = x + (rnd() - .5) * h * .4, cy = y - h * t; g.fillStyle = rgb(mix(col, [0, 0, 0], rnd() * .3)); g.beginPath(); g.ellipse(cx, cy, h * (.32 - k * .03), h * .07, (rnd() - .5) * .3, 0, 7); g.fill(); } }
function mountains(seed, mood) {
  rnd = R(seed); const W = 512, H = 368, c = mk(W, H), g = ctx(c), n = noise(seed);
  const sky = mood === 'dawn' ? ['#f2cfa2', '#d9a88c', '#8fa2b8'] : mood === 'autumn' ? ['#dfe6e6', '#b8cad6', '#7f9cb8'] : ['#eef0e6', '#c5d6dd', '#86a8c4'];
  g.fillStyle = grad(g, 0, H * .62, 0, 0, [[0, sky[0]], [.5, sky[1]], [1, sky[2]]]); g.fillRect(0, 0, W, H);
  if (mood === 'dawn') { g.fillStyle = 'rgba(255,230,190,.7)'; g.beginPath(); g.arc(W * .7, H * .3, 22, 0, 7); g.fill(); }
  for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(rr(0, W), rr(20, 120), rr(40, 110), rr(6, 14), 0, 0, 7); g.fill(); }
  const far = hex(mood === 'dawn' ? '#9a8fa6' : '#8ea4b6'), near = hex(mood === 'autumn' ? '#4a3a22' : '#203626');
  for (let L = 0; L < 5; L++) { const t = L / 4, col = mix(far, near, t * t);
    if (mood === 'autumn' && L >= 2) { const a = hex(pick(['#8a4a22', '#9c6a2a', '#6a5a2a'])); col.splice(0, 3, ...mix(col, a, .5)); }
    ridgePath(g, W, H, H * (.38 + L * .11), H * (.2 - L * .02), n, .006 + L * .003, rgb(col), L);
    g.fillStyle = grad(g, 0, H * (.4 + L * .11), 0, H * (.52 + L * .11), [[0, 'rgba(240,240,236,0)'], [1, `rgba(236,236,230,${.45 - L * .08})`]]); g.fillRect(0, H * (.3 + L * .11), W, H * .25); }   // 운해
  const fy = ridgeY(W, H * .86, H * .1, n, .02, 4); for (let k = 0; k < 7; k++) { const x = rr(0, W); pine(g, x, fy(x) + 6, rr(50, 110), hex('#1c3320')); }
  if (mood !== 'dawn') { const x = W * rr(.6, .8), y = fy(x) - 6; g.fillStyle = '#5a2a20'; g.fillRect(x - 14, y - 18, 3, 18); g.fillRect(x + 11, y - 18, 3, 18); g.fillStyle = '#2c2a2a'; g.beginPath(); g.moveTo(x - 24, y - 16); g.quadraticCurveTo(x, y - 22, x + 24, y - 16); g.lineTo(x + 12, y - 30); g.lineTo(x - 12, y - 30); g.closePath(); g.fill(); }   // 정자
  return ageOil(paintify(c, { sizes: [14, 8, 4.5, 2.4], angle: () => 0, wobble: .35 }), { crack: 30 });
}
function hanokRoof(g, x, y, w, h, col) {   // 처마가 들린 기와지붕 + 흰 벽 + 기둥
  const wallH = h * .55; g.fillStyle = '#e6dcc4'; g.fillRect(x + w * .1, y, w * .8, wallH); g.fillStyle = '#6a4228';
  for (let k = 0; k <= 4; k++) g.fillRect(x + w * .1 + k * w * .2 - 2, y, 4, wallH); g.fillRect(x + w * .1, y + wallH * .55, w * .8, 3);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + w * .1, y, w * .8, wallH * .2);
  g.fillStyle = col; g.beginPath(); g.moveTo(x - w * .06, y - h * .32); g.quadraticCurveTo(x + w * .5, y - h * .02, x + w * 1.06, y - h * .32); g.lineTo(x + w * .86, y - h * .62); g.quadraticCurveTo(x + w * .5, y - h * .56, x + w * .14, y - h * .62); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(200,200,200,.25)'; g.lineWidth = 1; for (let k = 1; k < 14; k++) { const t = k / 14; g.beginPath(); g.moveTo(x + w * (.14 + .72 * t), y - h * .6); g.lineTo(x + w * (-.04 + 1.08 * t), y - h * (.3 - Math.abs(t - .5) * 0)); g.stroke(); }
  g.fillStyle = '#2a2a2c'; g.fillRect(x + w * .12, y - h * .66, w * .76, h * .06); }
function hanok(seed) {
  rnd = R(seed); const W = 512, H = 360, c = mk(W, H), g = ctx(c), n = noise(seed);
  g.fillStyle = grad(g, 0, H * .5, 0, 0, [[0, '#f0e2c4'], [1, '#9db6c8']]); g.fillRect(0, 0, W, H);
  ridgePath(g, W, H, H * .36, H * .14, n, .008, '#7d8f86', 1); ridgePath(g, W, H, H * .46, H * .1, n, .012, '#4e6648', 2);
  const roofs = [];
  for (let row = 0; row < 3; row++) for (let k = 0; k < 4 - row; k++) roofs.push([rr(-30, W - 60) , H * (.52 + row * .14), 110 + row * 40]);
  roofs.sort((a, b) => a[1] - b[1]).forEach(([x, y, w]) => hanokRoof(g, x, y, w, w * .45, pick(['#3d4044', '#45484c', '#36393c'])));
  g.fillStyle = '#7a705e'; g.fillRect(0, H * .9, W, H * .1); for (let k = 0; k < 140; k++) { g.fillStyle = rgb(mix(hex('#9a9282'), hex('#5a5448'), rnd())); g.beginPath(); g.ellipse(rr(0, W), rr(H * .88, H), rr(6, 12), rr(4, 7), 0, 0, 7); g.fill(); }   // 돌담
  const tx = W * rr(.1, .3); g.strokeStyle = '#3a2a1e'; for (let k = 0; k < 9; k++) { g.lineWidth = 5 - k * .4; g.beginPath(); g.moveTo(tx, H); g.quadraticCurveTo(tx + rr(-40, 40), H * .7, tx + rr(-90, 90), H * rr(.35, .6)); g.stroke(); }   // 감나무
  for (let k = 0; k < 60; k++) { g.fillStyle = rnd() < .7 ? '#e0742a' : '#9a7a3a'; g.beginPath(); g.arc(tx + rr(-90, 90), H * rr(.38, .7), rr(2.5, 4.5), 0, 7); g.fill(); }
  return ageOil(paintify(c, { sizes: [12, 7, 4, 2.2], angle: () => 0 }), { crack: 20 });
}
function seaDusk(seed) {
  rnd = R(seed); const W = 512, H = 340, c = mk(W, H), g = ctx(c), n = noise(seed), hz = H * rr(.5, .58);
  g.fillStyle = grad(g, 0, 0, 0, hz, [[0, '#3c3a64'], [.45, '#b4607a'], [.8, '#f0a060'], [1, '#f8d498']]); g.fillRect(0, 0, W, hz);
  for (let k = 0; k < 7; k++) { g.fillStyle = `rgba(${ri(120, 200)},${ri(70, 110)},${ri(100, 140)},.5)`; g.beginPath(); g.ellipse(rr(0, W), rr(20, hz * .7), rr(50, 150), rr(5, 12), 0, 0, 7); g.fill(); }
  const sx = W * rr(.35, .65); g.fillStyle = '#ffe2a4'; g.beginPath(); g.arc(sx, hz - 8, 16, 0, 7); g.fill();
  g.fillStyle = grad(g, 0, hz, 0, H, [[0, '#c87a62'], [.3, '#5a4a6a'], [1, '#1e2238']]); g.fillRect(0, hz, W, H - hz);
  for (let y = hz; y < H; y += 3) { const t = (y - hz) / (H - hz); for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(255,${ri(170, 220)},140,${.5 * (1 - t)})`; const w = rr(4, 30) * (1 + t * 2); g.fillRect(sx + (rnd() - .5) * (30 + t * 160) - w / 2, y, w, 1.5); } }
  ridgePath(g, W * .45, hz + 2, hz + 2, 34, n, .02, '#2a2436', 1); { g.save(); g.translate(W * .7, 0); ridgePath(g, W * .3, hz + 2, hz + 2, 18, n, .03, '#30283c', 4); g.restore(); }
  { const bx = W * rr(.55, .8), by = hz + 30; g.fillStyle = '#1a1620'; g.beginPath(); g.moveTo(bx - 20, by); g.lineTo(bx + 22, by); g.lineTo(bx + 16, by + 6); g.lineTo(bx - 16, by + 6); g.fill(); g.fillRect(bx - 2, by - 22, 2, 22); g.fillRect(bx + 4, by - 8, 10, 8); }
  g.fillStyle = '#17141c'; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W * .3; x += 4) g.lineTo(x, H - 40 - 50 * fbm(n, x * .03, 9) * (1 - x / (W * .3))); g.lineTo(W * .3, H); g.fill();   // 앞 갯바위
  return ageOil(paintify(c, { sizes: [13, 7, 4, 2.2], angle: () => 0, wobble: .25, follow: false }), { crack: 15, tint: 'rgba(255,240,214,.5)' });
}
// ── 역대 교장 초상 (어두운 유화 · 얼굴은 흐린 덩어리 · 아래 황동 명판) ──
function portrait(seed, title, name, years, o = {}) {
  rnd = R(seed); const W = 384, P = 448, H = P + 64, c = mk(W, P), g = ctx(c);
  const bg = hex(pick(['#3a2a1c', '#2c2a22', '#3a2c2c', '#262a2a']));
  g.fillStyle = grad(g, 0, 0, W, P, [[0, rgb(mix(bg, [140, 110, 80], .25))], [1, rgb(mix(bg, [0, 0, 0], .5))]]); g.fillRect(0, 0, W, P);
  const cx = W / 2 + rr(-10, 10), hy = P * .36, hw = rr(52, 62), hh = hw * 1.3, suit = hex(pick(['#1e2228', '#2a2622', '#22262e', '#30302c']));
  g.fillStyle = rgb(suit); g.beginPath(); g.moveTo(cx - 170, P); g.bezierCurveTo(cx - 160, P * .68, cx - 120, P * .62, cx - 40, P * .58); g.lineTo(cx + 40, P * .58); g.bezierCurveTo(cx + 120, P * .62, cx + 160, P * .68, cx + 170, P); g.fill();
  g.fillStyle = '#e4e0d4'; g.beginPath(); g.moveTo(cx - 34, P * .58); g.lineTo(cx, P * .78); g.lineTo(cx + 34, P * .58); g.fill();
  g.fillStyle = pick(['#5a1e22', '#22304a', '#3a3a3e', '#4a3a22']); g.beginPath(); g.moveTo(cx - 8, P * .6); g.lineTo(cx + 8, P * .6); g.lineTo(cx + 12, P * .82); g.lineTo(cx, P * .86); g.lineTo(cx - 12, P * .82); g.fill();
  g.strokeStyle = rgb(mix(suit, [255, 255, 255], .12)); g.lineWidth = 3; g.beginPath(); g.moveTo(cx - 36, P * .58); g.lineTo(cx - 10, P * .9); g.moveTo(cx + 36, P * .58); g.lineTo(cx + 10, P * .9); g.stroke();
  if (o.badge) { g.fillStyle = '#c8a040'; g.beginPath(); g.arc(cx - 70, P * .72, 5, 0, 7); g.fill(); }
  const skin = hex(pick(['#c09070', '#b88a68', '#c8987a'])), hair = o.grey ? hex('#8a8680') : hex('#1c1a18');
  g.fillStyle = rgb(mix(skin, [60, 40, 30], .35)); g.fillRect(cx - hw * .42, hy + hh * .55, hw * .84, hh * .55);   // 목
  if (!o.bald) { g.fillStyle = rgb(hair); g.beginPath(); g.ellipse(cx, hy - hh * .12, hw * 1.08, hh * 1.0, 0, 0, 7); g.fill(); }
  [-1, 1].forEach(s => { g.fillStyle = rgb(mix(skin, [60, 40, 30], .2)); g.beginPath(); g.ellipse(cx + s * hw * .95, hy + hh * .05, hw * .14, hh * .2, 0, 0, 7); g.fill(); });   // 귀
  const fg = g.createRadialGradient(cx - hw * .3, hy - hh * .2, 5, cx, hy, hh * 1.1); fg.addColorStop(0, rgb(mix(skin, [255, 230, 200], .25))); fg.addColorStop(1, rgb(mix(skin, [40, 25, 20], .55)));
  g.fillStyle = fg; g.beginPath(); g.ellipse(cx, hy + hh * .08, hw * .9, hh * .95, 0, 0, 7); g.fill();
  g.fillStyle = rgb(hair); if (o.bald) { [-1, 1].forEach(s => { g.beginPath(); g.ellipse(cx + s * hw * .82, hy - hh * .15, hw * .2, hh * .32, 0, 0, 7); g.fill(); }); }
  else { g.beginPath(); g.ellipse(cx + hw * .1, hy - hh * .55, hw * .95, hh * .42, -.08, Math.PI, 0); g.fill(); }
  g.filter = 'blur(4px)'; g.fillStyle = 'rgba(60,36,28,.45)'; [-1, 1].forEach(s => { g.beginPath(); g.ellipse(cx + s * hw * .36, hy - hh * .02, hw * .17, hh * .06, 0, 0, 7); g.fill(); });
  g.fillStyle = 'rgba(70,44,34,.4)'; g.beginPath(); g.ellipse(cx + 3, hy + hh * .3, hw * .09, hh * .14, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(100,46,44,.35)'; g.beginPath(); g.ellipse(cx, hy + hh * .58, hw * .24, hh * .045, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(40,24,18,.3)'; g.beginPath(); g.ellipse(cx, hy + hh * .95, hw * .7, hh * .12, 0, 0, 7); g.fill(); g.filter = 'none';
  if (o.glasses) { g.strokeStyle = 'rgba(30,24,20,.7)'; g.lineWidth = 2.5; [-1, 1].forEach(s => { g.beginPath(); g.ellipse(cx + s * hw * .4, hy - hh * .02, hw * .27, hh * .13, 0, 0, 7); g.stroke(); }); }
  const lit = g.createRadialGradient(cx - 60, hy - 60, 10, cx, P * .5, W * .8); lit.addColorStop(0, 'rgba(255,230,190,.12)'); lit.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = lit; g.fillRect(0, 0, W, P);
  const oil = ageOil(paintify(c, { sizes: [10, 6, 3.4, 2], len: 2, density: 1.1 }), { crack: 60, tint: 'rgba(250,226,180,.6)', vig: '60,46,34' });
  const out = mk(W, H), q = ctx(out); q.drawImage(oil, 0, 0);
  q.fillStyle = grad(q, 0, P, 0, H, [[0, '#2a1a10'], [1, '#160d08']]); q.fillRect(0, P, W, H - P);
  q.fillStyle = grad(q, 0, P + 12, 0, P + 52, [[0, '#e8cc84'], [.5, '#b08a40'], [1, '#d8b870']]); q.fillRect(W / 2 - 120, P + 12, 240, 40); q.strokeStyle = '#6a5020'; q.lineWidth = 2; q.strokeRect(W / 2 - 118, P + 14, 236, 36);
  q.fillStyle = '#2a1e0c'; q.textAlign = 'center'; q.font = '700 17px "Nanum Myeongjo"'; q.fillText(`${title}  ${name}`, W / 2, P + 32); q.font = '400 12px "Nanum Myeongjo"'; q.fillText(years, W / 2, P + 46);
  return out;
}
// ── 사진: 흐림 · 바램 · 입자 · 긁힘 ──
function photoAge(c, o) { const g = ctx(c), W = c.width, H = c.height, n = noise(o.seed || 3);
  const tmp = mk(W, H), t = ctx(tmp); t.filter = `blur(${o.blur ?? 1}px)`; t.drawImage(c, 0, 0); g.clearRect(0, 0, W, H); g.drawImage(tmp, 0, 0);
  const sep = o.sepia ?? 0, fade = o.fade ?? .2, sh = o.shift || [0, 0, 0];
  eachPx(c, (p, i, x, y) => { let r = p[i], gg = p[i + 1], b = p[i + 2]; const l = r * .3 + gg * .59 + b * .11;
    r = r + (l * 1.07 - r) * sep + 18 * sep; gg = gg + (l * .95 - gg) * sep + 6 * sep; b = b + (l * .78 - b) * sep;
    r = r * (1 - fade) + 235 * fade * .55 + sh[0]; gg = gg * (1 - fade) + 225 * fade * .55 + sh[1]; b = b * (1 - fade) + 205 * fade * .55 + sh[2];
    const gr = (rnd() - .5) * (o.grain ?? 26) + (fbm(n, x * .05, y * .05, 2) - .5) * 18; const vx = (x / W - .5), vy = (y / H - .5), v = 1 - (vx * vx + vy * vy) * (o.vig ?? .9);
    p[i] = clamp((r + gr) * v); p[i + 1] = clamp((gg + gr) * v); p[i + 2] = clamp((b + gr) * v); });
  g.strokeStyle = 'rgba(255,255,250,.35)'; g.lineWidth = .7; for (let k = 0; k < (o.scratch ?? 6); k++) { const x = rr(0, W); g.beginPath(); g.moveTo(x, 0); g.lineTo(x + rr(-20, 20), H); g.stroke(); }
  for (let k = 0; k < (o.dust ?? 40); k++) { g.fillStyle = rnd() < .5 ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.4)'; g.fillRect(rr(0, W), rr(0, H), rr(.6, 2), rr(.6, 2)); }
  return c; }
function figure(g, x, y, s, o) {   // y = 어깨선, s = 머리 반지름
  const body = hex(o.body), skin = hex(o.skin || '#caa080');
  g.fillStyle = rgb(body); g.beginPath(); g.moveTo(x - s * 1.9, y + s * 5); g.quadraticCurveTo(x - s * 2.1, y + s * .4, x - s * .9, y); g.lineTo(x + s * .9, y); g.quadraticCurveTo(x + s * 2.1, y + s * .4, x + s * 1.9, y + s * 5); g.fill();
  if (o.collar) { g.fillStyle = o.collar; g.beginPath(); g.moveTo(x - s * .6, y); g.lineTo(x, y + s * 1.1); g.lineTo(x + s * .6, y); g.fill(); }
  if (o.tie) { g.fillStyle = o.tie; g.fillRect(x - s * .14, y + s * .2, s * .28, s * 1.2); }
  g.fillStyle = rgb(mix(skin, [50, 30, 20], .25)); g.fillRect(x - s * .35, y - s * .5, s * .7, s * .6);
  g.fillStyle = rgb(skin); g.beginPath(); g.ellipse(x, y - s * 1.15, s * .82, s, 0, 0, 7); g.fill();
  g.fillStyle = o.hair || '#141210'; g.beginPath(); if (o.long) { g.ellipse(x, y - s * 1.2, s * .98, s * 1.15, 0, Math.PI * .95, Math.PI * 2.05); g.fill(); g.fillRect(x - s * .98, y - s * 1.3, s * .3, s * 1.5); g.fillRect(x + s * .68, y - s * 1.3, s * .3, s * 1.5); } else { g.ellipse(x, y - s * 1.45, s * .88, s * .72, 0, Math.PI, 0); g.fill(); }
  g.fillStyle = 'rgba(60,30,20,.25)'; g.fillRect(x - s * .45, y - s * 1.25, s * .9, s * .18); }
function gradPhoto(seed, year) {
  rnd = R(seed); const W = 512, H = 344, c = mk(W, H), g = ctx(c), n = noise(seed), no = year - 1970;
  g.fillStyle = grad(g, 0, 0, 0, H * .35, [[0, '#b8c8d0'], [1, '#d8dcd4']]); g.fillRect(0, 0, W, H);
  g.fillStyle = '#d6cfc0'; g.fillRect(0, H * .08, W, H * .42); g.fillStyle = '#8a9aa0'; for (let r = 0; r < 3; r++) for (let k = 0; k < 14; k++) g.fillRect(8 + k * 37, H * (.12 + r * .12), 26, H * .07);
  for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(70,90,60,.9)'; g.beginPath(); g.ellipse(rr(0, W), H * .42, rr(20, 50), rr(18, 30), 0, 0, 7); g.fill(); }
  g.fillStyle = '#9a968c'; g.fillRect(0, H * .45, W, H * .55); for (let r = 0; r < 6; r++) { g.fillStyle = r % 2 ? '#8a867c' : '#a4a094'; g.fillRect(0, H * (.45 + r * .09), W, H * .045); }
  const boys = year < 2000, uni = year < 1995 ? '#1a1c22' : pick(['#1e2a44', '#2a2a2e', '#283040']);
  for (let row = 0; row < 5; row++) { const s = 7 + row * .9, y = H * (.4 + row * .1), N = Math.floor((W - 30) / (s * 3.3));
    for (let k = 0; k < N; k++) { const x = 20 + k * (W - 40) / (N - 1) + rr(-2, 2); const girl = !boys || (year >= 1996 && rnd() < .45);
      if (row === 4 && Math.abs(x - W / 2) < W * .22) figure(g, x, y + rr(-1, 1), s, { body: pick(['#3a3a3c', '#4a4238', '#2a2c30']), collar: '#e8e4dc', tie: '#5a2a2a', hair: rnd() < .4 ? '#6a6660' : '#1a1816' });
      else figure(g, x, y + rr(-2, 2), s, { body: uni, collar: girl && year >= 2000 ? '#e8e8e8' : (year < 1990 ? null : '#dcdcdc'), tie: year >= 2000 ? '#7a2030' : null, long: girl && rnd() < .5 }); } }
  g.fillStyle = '#f4f0e4'; g.font = '700 15px "Nanum Myeongjo"'; g.textAlign = 'left'; g.fillText(`서린고등학교 제${no}회 졸업기념  ${year}. 2.`, 14, 24);
  photoAge(c, { seed, blur: 1.1, sepia: year < 1992 ? .9 : year < 2000 ? .35 : .1, fade: year < 2000 ? .32 : .15, shift: year < 2000 ? [8, 0, -10] : [0, 2, 4], grain: year < 2000 ? 34 : 18, scratch: year < 2000 ? 3 : 1 });
  const out = mk(W + 24, H + 24), q = ctx(out); q.fillStyle = year < 2000 ? '#ece2c8' : '#f4f2ea'; q.fillRect(0, 0, out.width, out.height); q.drawImage(c, 12, 12); return out;
}
function bcastPhoto(seed) {   // 1998 방송부 (바랜 컬러 · 오렌지 날짜 각인 · 빛샘)
  rnd = R(seed); const W = 480, H = 336, c = mk(W, H), g = ctx(c);
  g.fillStyle = '#b8b0a0'; g.fillRect(0, 0, W, H); g.fillStyle = '#d8d0bc'; for (let y = 6; y < H * .55; y += 10) for (let x = 6; x < W; x += 10) { g.fillStyle = 'rgba(80,70,60,.25)'; g.fillRect(x, y, 2, 2); }   // 흡음 타공판
  g.fillStyle = '#e8e4d0'; g.fillRect(W * .66, H * .06, W * .28, H * .3); g.fillStyle = 'rgba(120,120,110,.6)'; for (let y = H * .06; y < H * .36; y += 5) g.fillRect(W * .66, y, W * .28, 1.5);   // 블라인드
  g.fillStyle = '#2a4a8a'; g.fillRect(W * .08, H * .08, W * .3, H * .1); g.fillStyle = '#f4f0e0'; g.font = '700 22px "Nanum Pen Script"'; g.fillText('ON AIR  서린 방송부', W * .1, H * .155);
  [[.2, '#1c1c24', 1], [.36, '#22222a', 0], [.52, '#1c1c24', 1], [.68, '#262630', 0], [.82, '#1c1c24', 1]].forEach(([fx, b, long], k) => figure(g, W * fx + rr(-6, 6), H * (.5 + (k % 2) * .03), 21, { body: b, collar: '#e0e0dc', tie: '#6a2030', long: !!long, skin: '#d4a888' }));
  g.fillStyle = '#7a7a78'; g.fillRect(0, H * .72, W, H * .28); g.fillStyle = '#4a4a4c'; g.fillRect(W * .05, H * .74, W * .9, H * .2);
  for (let k = 0; k < 16; k++) { const x = W * .08 + k * W * .052; g.fillStyle = '#2a2a2a'; g.fillRect(x, H * .78, 4, 34); g.fillStyle = '#d8d8d0'; g.fillRect(x - 3, H * .78 + rr(0, 28), 10, 6); g.fillStyle = pick(['#c03030', '#e0e0d0', '#3060c0']); g.beginPath(); g.arc(x + 2, H * .76, 3, 0, 7); g.fill(); }
  g.fillStyle = '#2a2a2c'; g.fillRect(W * .7, H * .62, W * .2, H * .1); g.fillStyle = '#5a5a5c'; [.74, .84].forEach(f => { g.beginPath(); g.arc(W * f, H * .67, 10, 0, 7); g.fill(); });   // 카세트 데크
  photoAge(c, { seed, blur: 1.3, sepia: .15, fade: .3, shift: [14, -4, 6], grain: 30, scratch: 4, dust: 60 });
  const lk = g.createRadialGradient(W, 0, 10, W, 0, W * .5); lk.addColorStop(0, 'rgba(255,140,60,.55)'); lk.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = lk; g.fillRect(0, 0, W, H);
  g.font = '700 16px "Nanum Gothic Coding"'; g.fillStyle = 'rgba(255,150,40,.9)'; g.textAlign = 'right'; g.fillText("'98  9  25", W - 14, H - 12);
  const out = mk(W + 20, H + 56), q = ctx(out); q.fillStyle = '#efe8d4'; q.fillRect(0, 0, out.width, out.height); q.drawImage(c, 10, 10);
  q.fillStyle = '#20284a'; q.font = '400 26px "Nanum Pen Script"'; q.textAlign = 'left'; q.fillText('방송부 1998 가을 — 다 같이!', 18, H + 42); return out;
}
// ── 붓글씨 · 상장 ──
function hanji(W, H, seed) { const c = mk(W, H), g = ctx(c), n = noise(seed); g.fillStyle = '#efe6d0'; g.fillRect(0, 0, W, H);
  eachPx(c, (p, i, x, y) => { const v = (fbm(n, x * .03, y * .03, 3) - .5) * 26 + (rnd() - .5) * 8; p[i] = clamp(p[i] + v); p[i + 1] = clamp(p[i + 1] + v); p[i + 2] = clamp(p[i + 2] + v * .9); });
  g.strokeStyle = 'rgba(160,140,110,.25)'; for (let k = 0; k < 160; k++) { const x = rr(0, W), y = rr(0, H); g.lineWidth = .5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + rr(-10, 10), y + rr(-10, 10), x + rr(-18, 18), y + rr(-18, 18)); g.stroke(); } return c; }
function inkText(g, W, H, draw, seed) { const m = mk(W, H), q = ctx(m); q.fillStyle = '#000'; draw(q); const n = noise(seed);
  const b = mk(W, H), bq = ctx(b); bq.filter = 'blur(1.6px)'; bq.globalAlpha = .45; bq.drawImage(m, 0, 0); bq.filter = 'none'; bq.globalAlpha = 1; bq.drawImage(m, 0, 0);
  eachPx(b, (p, i, x, y) => { const a = p[i + 3]; if (!a) return; const dry = fbm(n, x * .02, y * .5, 3); const k = dry > .62 ? .25 : 1; p[i] = 18; p[i + 1] = 16; p[i + 2] = 14; p[i + 3] = a * k * (.85 + rnd() * .15); });
  g.drawImage(b, 0, 0); }
function seal(g, x, y, s, txt) { g.save(); g.translate(x, y); g.rotate(rr(-.05, .05)); g.fillStyle = 'rgba(180,30,30,.85)'; g.fillRect(-s / 2, -s / 2, s, s); g.fillStyle = '#efe6d0'; g.font = `700 ${s * .36}px "Noto Serif KR"`; g.textAlign = 'center';
  [...txt].forEach((ch, k) => g.fillText(ch, (k % 2 ? -1 : 1) * s * .2, -s * .06 + Math.floor(k / 2) * s * .4)); g.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 40; k++) g.fillRect(rr(-s / 2, s / 2), rr(-s / 2, s / 2), rr(1, 3), rr(1, 3)); g.restore(); }
function motto(seed) { rnd = R(seed); const W = 512, H = 208, c = hanji(W, H, seed), g = ctx(c);
  inkText(g, W, H, q => { q.font = '400 112px "East Sea Dokdo"'; q.textAlign = 'center'; q.fillText('성실 정직 봉사', W / 2 - 18, H * .66); q.font = '400 26px "East Sea Dokdo"'; q.save(); q.translate(W - 34, 24); ['무', '자', '년', '가', '을'].forEach((ch, k) => q.fillText(ch, 0, k * 24)); q.restore(); }, seed);
  seal(g, W - 34, H - 34, 30, '서린'); return c; }
function scroll(seed) { rnd = R(seed); const W = 220, H = 512, c = hanji(W, H, seed), g = ctx(c);
  inkText(g, W, H, q => { q.font = '400 84px "East Sea Dokdo"'; q.textAlign = 'center'; ['배', '우', '고', '익', '히', '다'].forEach((ch, k) => q.fillText(ch, W / 2 + 10, 86 + k * 70)); q.font = '400 22px "East Sea Dokdo"'; ['서', '문', '고', '개', '교', '40', '주', '년'].forEach((ch, k) => q.fillText(ch, 24, 70 + k * 22)); }, seed);
  seal(g, 24, 270, 24, '서린'); seal(g, 24, 300, 24, '학이'); return c; }
function certificate(seed, o) { rnd = R(seed); const W = 362, H = 512, c = mk(W, H), g = ctx(c), n = noise(seed);
  g.fillStyle = '#f6f0dc'; g.fillRect(0, 0, W, H); eachPx(c, (p, i, x, y) => { const v = (fbm(n, x * .02, y * .02, 3) - .5) * 14; p[i] = clamp(p[i] + v); p[i + 1] = clamp(p[i + 1] + v); p[i + 2] = clamp(p[i + 2] + v - 4); });
  const bc = o.border || '#3a6a4a'; g.strokeStyle = bc; g.lineWidth = 6; g.strokeRect(16, 16, W - 32, H - 32); g.lineWidth = 1.5; g.strokeRect(26, 26, W - 52, H - 52);
  g.fillStyle = bc; for (let k = 0; k < 18; k++) { [[30 + k * (W - 60) / 17, 21], [30 + k * (W - 60) / 17, H - 21]].forEach(([x, y]) => { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-3, -3, 6, 6); g.restore(); }); }
  for (let k = 0; k < 26; k++) { [[21, 30 + k * (H - 60) / 25], [W - 21, 30 + k * (H - 60) / 25]].forEach(([x, y]) => { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-3, -3, 6, 6); g.restore(); }); }
  if (/서린고등학교장/.test(o.by)) { emblem(g, W / 2, H / 2 + 30, 120, { alpha: .07 }); emblem(g, W - 62, 62, 18); }
  g.fillStyle = '#1a1a1a'; g.textAlign = 'left'; g.font = '400 12px "Nanum Myeongjo"'; g.fillText(o.no, 44, 58);
  g.textAlign = 'center'; g.font = '700 46px "Nanum Myeongjo"'; g.fillText(o.title || '상  장', W / 2, 120);
  g.font = '700 18px "Nanum Myeongjo"'; g.fillText(o.prize, W / 2, 168); g.font = '400 15px "Nanum Myeongjo"'; g.fillText(o.who, W / 2, 196);
  g.font = '400 15px "Nanum Myeongjo"'; g.textAlign = 'left'; let y = 248; const words = o.body.split(' '); let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > W - 96) { g.fillText(line, 48, y); y += 28; line = w; } else line = t; } g.fillText(line, 48, y);
  g.textAlign = 'center'; g.fillText(o.date, W / 2, H - 132); g.font = '700 22px "Nanum Myeongjo"'; g.fillText(o.by, W / 2 - 10, H - 84); seal(g, W / 2 + g.measureText(o.by).width / 2 + 10, H - 92, 34, '직인');
  return c; }
// ── 학생 작품 ──
function paperTex(c, seed, k = 18) { const n = noise(seed); eachPx(c, (p, i, x, y) => { const v = (fbm(n, x * .08, y * .08, 3) - .5) * k; p[i] = clamp(p[i] + v); p[i + 1] = clamp(p[i + 1] + v); p[i + 2] = clamp(p[i + 2] + v); }); return c; }
function wash(g, pts, col, a = .35, passes = 4) { for (let k = 0; k < passes; k++) { g.fillStyle = rgb(col, a / passes * 1.6); g.beginPath(); pts.forEach(([x, y], i) => { const X = x + rr(-3, 3), Y = y + rr(-3, 3); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); g.fill(); g.strokeStyle = rgb(mix(col, [0, 0, 0], .25), a * .5); g.lineWidth = 1; g.stroke(); } }
const blob = (cx, cy, rx, ry, n = 18, j = .2) => Array.from({ length: n }, (_, k) => { const a = k / n * Math.PI * 2, r = 1 + (rnd() - .5) * j; return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]; });
function sign2008(g, W, H, txt) { g.fillStyle = 'rgba(40,40,60,.75)'; g.font = '400 18px "Nanum Pen Script"'; g.textAlign = 'right'; g.fillText(txt, W - 12, H - 10); }
function watercolorSchool(seed) { rnd = R(seed); const W = 480, H = 352, c = mk(W, H), g = ctx(c); g.fillStyle = '#f7f4ea'; g.fillRect(0, 0, W, H);
  wash(g, [[0, 0], [W, 0], [W, H * .45], [0, H * .5]], hex('#8ab8de'), .5, 5); for (let k = 0; k < 4; k++) wash(g, blob(rr(0, W), rr(20, 90), rr(30, 70), rr(10, 20)), hex('#ffffff'), .6, 2);
  wash(g, [[W * .12, H * .3], [W * .88, H * .3], [W * .88, H * .7], [W * .12, H * .7]], hex('#e8dcc4'), .6, 4);
  for (let r = 0; r < 4; r++) for (let k = 0; k < 10; k++) wash(g, [[W * .15 + k * W * .072, H * (.34 + r * .085)], [W * .15 + k * W * .072 + 20, H * (.34 + r * .085)], [W * .15 + k * W * .072 + 20, H * (.34 + r * .085) + 14], [W * .15 + k * W * .072, H * (.34 + r * .085) + 14]], hex('#6a8aa8'), .5, 2);
  wash(g, [[0, H * .7], [W, H * .68], [W, H], [0, H]], hex('#c8a870'), .5, 4);
  for (let k = 0; k < 7; k++) { const x = rr(0, W); wash(g, blob(x, H * .62, rr(22, 40), rr(28, 50)), hex(pick(['#5a9a4a', '#7aaa3a', '#3a7a4a'])), .55, 4); wash(g, [[x - 3, H * .66], [x + 3, H * .66], [x + 3, H * .8], [x - 3, H * .8]], hex('#6a4a2a'), .6, 2); }
  g.strokeStyle = 'rgba(90,90,90,.35)'; g.lineWidth = .7; g.strokeRect(W * .12, H * .3, W * .76, H * .4);
  paperTex(c, seed, 22); sign2008(g, W, H, '2-1 미술 수행평가 · 2008.4'); return c; }
function watercolorFlowers(seed) { rnd = R(seed); const W = 360, H = 480, c = mk(W, H), g = ctx(c); g.fillStyle = '#f6f2e6'; g.fillRect(0, 0, W, H);
  wash(g, [[0, 0], [W, 0], [W, H], [0, H]], hex('#e8d8c8'), .25, 3);
  wash(g, [[W * .35, H * .55], [W * .65, H * .55], [W * .7, H * .9], [W * .3, H * .9]], hex('#4a7aa8'), .6, 5);
  for (let k = 0; k < 14; k++) { const x = W * .5 + rr(-30, 30), y = H * .55; g.strokeStyle = 'rgba(70,120,60,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); const ex = W * .5 + rr(-140, 140), ey = rr(H * .1, H * .45); g.quadraticCurveTo((x + ex) / 2 + rr(-30, 30), (y + ey) / 2, ex, ey); g.stroke();
    const col = hex(pick(['#e8709a', '#f0a0c0', '#ffffff', '#c03a6a'])); for (let p = 0; p < 8; p++) { const a = p / 8 * Math.PI * 2; wash(g, blob(ex + Math.cos(a) * 12, ey + Math.sin(a) * 12, 10, 6, 10, .3), col, .5, 2); } wash(g, blob(ex, ey, 5, 5), hex('#e8b830'), .8, 2); }
  paperTex(c, seed, 22); sign2008(g, W, H, '코스모스 — 1-3'); return c; }
function stillLife(seed) { rnd = R(seed); const W = 480, H = 360, c = mk(W, H), g = ctx(c);
  g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#5a6a72'], [.6, '#3a444a'], [.6, '#d8cfc0'], [1, '#a89a88']]); g.fillRect(0, 0, W, H);
  g.fillStyle = '#e8e0d0'; g.beginPath(); g.moveTo(W * .1, H * .6); g.quadraticCurveTo(W * .5, H * .5, W * .95, H * .62); g.lineTo(W, H); g.lineTo(0, H); g.fill();
  const bx = W * .62; g.fillStyle = grad(g, bx - 30, 0, bx + 30, 0, [[0, '#1a3a24'], [.3, '#4a8a5a'], [1, '#12281a']]); g.beginPath(); g.moveTo(bx - 30, H * .7); g.lineTo(bx - 30, H * .38); g.quadraticCurveTo(bx - 30, H * .3, bx - 10, H * .26); g.lineTo(bx - 9, H * .12); g.lineTo(bx + 9, H * .12); g.lineTo(bx + 10, H * .26); g.quadraticCurveTo(bx + 30, H * .3, bx + 30, H * .38); g.lineTo(bx + 30, H * .7); g.fill();
  [[.3, '#c02a22'], [.42, '#d84a2a'], [.8, '#c8b040']].forEach(([fx, col]) => { const x = W * fx, y = H * .68, r = 30; const G = g.createRadialGradient(x - 10, y - 12, 3, x, y, r); G.addColorStop(0, '#fff0d0'); G.addColorStop(.25, col); G.addColorStop(1, rgb(mix(hex(col), [0, 0, 0], .6))); g.fillStyle = G; g.beginPath(); g.ellipse(x, y, r, r * .9, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x + 8, y + r * .9, r, 6, 0, 0, 7); g.fill(); });
  const o = paintify(c, { sizes: [10, 6, 3.2], len: 1.8, alpha: .85 }); sign2008(ctx(o), W, H, '정물 · 2-2 · 08'); return o; }
function plasterSketch(seed) { rnd = R(seed); const W = 360, H = 480, c = mk(W, H), g = ctx(c); g.fillStyle = '#efece4'; g.fillRect(0, 0, W, H);
  const cx = W * .5, cy = H * .42; g.lineCap = 'round';
  for (let k = 0; k < 2600; k++) { const a = rr(0, Math.PI * 2), r = Math.sqrt(rnd()), x = cx + Math.cos(a) * r * 95, y = cy + Math.sin(a) * r * 130; const lightness = (x - cx) * .9 + (y - cy) * .4; if (lightness < -40 && rnd() < .6) continue;
    const t = Math.max(0, Math.min(1, (lightness + 60) / 160)); g.strokeStyle = `rgba(40,40,44,${.08 + t * .22})`; g.lineWidth = .7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 9, y - 14); g.stroke(); }
  g.strokeStyle = 'rgba(30,30,34,.5)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(cx, cy, 95, 130, 0, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(cx - 70, cy + 110); g.quadraticCurveTo(cx - 40, H * .82, cx - 120, H * .92); g.moveTo(cx + 70, cy + 110); g.quadraticCurveTo(cx + 50, H * .82, cx + 130, H * .92); g.stroke();
  for (let k = 0; k < 900; k++) { const x = rr(cx - 140, cx + 140), y = rr(H * .78, H * .95); g.strokeStyle = 'rgba(40,40,44,.12)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y - 12); g.stroke(); }
  g.filter = 'blur(.6px)'; g.drawImage(c, 0, 0); g.filter = 'none'; paperTex(c, seed, 14); sign2008(g, W, H, '석고 소묘 3-1'); return c; }
function poster(seed, o) { rnd = R(seed); const W = 362, H = 512, c = mk(W, H), g = ctx(c);
  g.fillStyle = grad(g, 0, 0, 0, H, [[0, o.bg[0]], [1, o.bg[1]]]); g.fillRect(0, 0, W, H);
  o.art(g, W, H);
  g.textAlign = 'center'; g.lineJoin = 'round'; g.font = `400 ${o.size || 64}px "Nanum Pen Script"`; o.lines.forEach((t, k) => { const y = H * .76 + k * (o.size || 64) * .82; g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.strokeText(t, W / 2, y); g.fillStyle = o.ink; g.fillText(t, W / 2, y); });
  paperTex(c, seed, 12);
  g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(W - 150, H - 34, 140, 24); g.fillStyle = '#222'; g.font = '400 11px "Noto Sans KR"'; g.fillText(o.tag, W - 80, H - 18);
  if (o.prize) { g.fillStyle = '#d8b030'; g.beginPath(); g.arc(46, 46, 30, 0, 7); g.fill(); g.strokeStyle = '#a07a10'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#5a3a00'; g.font = '700 18px "Noto Sans KR"'; g.fillText(o.prize, 46, 53); }
  return c; }
const POSTERS = [
  { name: 'poster_water', bg: ['#bfe4f4', '#4a9ad0'], ink: '#0a3a7a', lines: ['한 방울의 물도', '소중하게'], size: 54, tag: '2008 환경 포스터 · 2-4', prize: '금상',
    art: (g, W, H) => { g.fillStyle = '#2a7ac8'; g.beginPath(); g.moveTo(W / 2, H * .1); g.bezierCurveTo(W * .2, H * .42, W * .26, H * .62, W / 2, H * .62); g.bezierCurveTo(W * .74, H * .62, W * .8, H * .42, W / 2, H * .1); g.fill(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(W * .42, H * .44, 12, 26, -.3, 0, 7); g.fill(); g.strokeStyle = '#5a5a5a'; g.lineWidth = 14; g.beginPath(); g.moveTo(W * .1, H * .08); g.lineTo(W * .42, H * .08); g.stroke(); } },
  { name: 'poster_energy', bg: ['#fff4b0', '#f0a030'], ink: '#7a2a00', lines: ['쓰지 않는 불은', '끄고 다녀요'], size: 54, tag: '2008 에너지 절약 · 1-2', prize: '은상',
    art: (g, W, H) => { const x = W / 2, y = H * .34; for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.strokeStyle = '#fff8d0'; g.lineWidth = 6; g.beginPath(); g.moveTo(x + Math.cos(a) * 95, y + Math.sin(a) * 95); g.lineTo(x + Math.cos(a) * 130, y + Math.sin(a) * 130); g.stroke(); }
      g.fillStyle = '#fff2a0'; g.beginPath(); g.arc(x, y, 80, 0, 7); g.fill(); g.strokeStyle = '#c87a00'; g.lineWidth = 5; g.stroke(); g.fillStyle = '#8a8a90'; g.fillRect(x - 36, y + 70, 72, 50); g.fillStyle = '#5a5a60'; for (let k = 0; k < 4; k++) g.fillRect(x - 36, y + 78 + k * 11, 72, 4); } },
  { name: 'poster_book', bg: ['#e4f4d4', '#7ab85a'], ink: '#1a4a1a', lines: ['책 속에 길이', '있어요'], size: 58, tag: '2008 독서 포스터 · 3-5', prize: '동상',
    art: (g, W, H) => { const y = H * .42; g.fillStyle = '#f8f4e8'; g.beginPath(); g.moveTo(W / 2, y); g.quadraticCurveTo(W * .3, y - 30, W * .1, y - 10); g.lineTo(W * .1, y + 90); g.quadraticCurveTo(W * .3, y + 70, W / 2, y + 100); g.quadraticCurveTo(W * .7, y + 70, W * .9, y + 90); g.lineTo(W * .9, y - 10); g.quadraticCurveTo(W * .7, y - 30, W / 2, y); g.fill(); g.strokeStyle = '#4a3a2a'; g.lineWidth = 3; g.stroke();
      g.strokeStyle = '#3a6a2a'; g.lineWidth = 8; g.beginPath(); g.moveTo(W / 2, y); g.bezierCurveTo(W * .45, y - 80, W * .6, y - 120, W * .55, y - 170); g.stroke(); for (let k = 0; k < 6; k++) { g.fillStyle = '#4a9a3a'; g.beginPath(); g.ellipse(W * (.5 + (k % 2 ? .08 : -.06)), y - 40 - k * 22, 22, 10, k % 2 ? -.5 : .5, 0, 7); g.fill(); } } },
  { name: 'poster_peace', bg: ['#fde4ea', '#e46a8a'], ink: '#5a0a2a', lines: ['친구야,', '먼저 손 내밀게'], size: 50, tag: '2008 학교폭력 예방 · 2-1', prize: '장려',
    art: (g, W, H) => { [[-1, '#f4c8a0'], [1, '#e0b088']].forEach(([s, col]) => { g.fillStyle = col; g.beginPath(); g.ellipse(W / 2 + s * 46, H * .38, 60, 34, s * .4, 0, 7); g.fill(); g.strokeStyle = '#8a5a3a'; g.lineWidth = 3; g.stroke(); });
      g.fillStyle = '#e8304a'; const x = W / 2, y = H * .16; g.beginPath(); g.moveTo(x, y + 30); g.bezierCurveTo(x - 50, y - 5, x - 20, y - 35, x, y - 10); g.bezierCurveTo(x + 20, y - 35, x + 50, y - 5, x, y + 30); g.fill(); } },
  { name: 'poster_choir', bg: ['#2a2a5a', '#0a0a24'], ink: '#d8b040', lines: ['2008 서린 합창제', '10. 24 (금) 대강당'], size: 40, tag: '음악부 제작 · 2008',
    art: (g, W, H) => { g.fillStyle = '#d8b040'; for (let k = 0; k < 5; k++) g.fillRect(W * .1, H * .2 + k * 16, W * .8, 1.5); [[.25, 0], [.4, 2], [.55, 1], [.7, 3]].forEach(([fx, l]) => { const x = W * fx, y = H * .2 + l * 16 + 8; g.beginPath(); g.ellipse(x, y, 10, 7, -.4, 0, 7); g.fill(); g.fillRect(x + 8, y - 54, 3, 54); });
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,255,220,${rr(.2, .9)})`; g.fillRect(rr(0, W), rr(0, H * .7), 2, 2); } } },
];

// ── 서린고 교표 (원 + 방패 · 세 그루 소나무 숲 · 물결 · 금빛 '서린' · 둘레 글자) ──
function emblem(g, x, y, Rr, o = {}) { const gold = o.gold || '#c8a24a', navy = o.navy || '#1c2a52', green = o.green || '#2e6a44', a = o.alpha ?? 1;
  g.save(); g.globalAlpha = a; g.translate(x, y);
  g.fillStyle = navy; g.beginPath(); g.arc(0, 0, Rr, 0, 7); g.fill(); g.strokeStyle = gold; g.lineWidth = Rr * .05; g.beginPath(); g.arc(0, 0, Rr * .95, 0, 7); g.stroke(); g.lineWidth = Rr * .02; g.beginPath(); g.arc(0, 0, Rr * .7, 0, 7); g.stroke();
  const ring = (txt, r, a0, a1, sz, flip) => { g.font = `700 ${sz}px "Noto Serif KR"`; g.fillStyle = gold; g.textAlign = 'center'; g.textBaseline = 'middle'; const n = txt.length;
    for (let i = 0; i < n; i++) { const t = a0 + (a1 - a0) * (n === 1 ? .5 : i / (n - 1)); g.save(); g.rotate(t); g.translate(0, flip ? r : -r); g.fillText(txt[i], 0, 0); g.restore(); } };
  if (Rr > 40) { ring('SEORIN HIGH SCHOOL', Rr * .83, -1.15, 1.15, Rr * .12 | 0, false); ring('1968', Rr * .83, .3, -.3, Rr * .12 | 0, true);
    g.fillStyle = gold; [-1.42, 1.42].forEach(t => { g.save(); g.rotate(t); g.translate(0, -Rr * .83); g.beginPath(); g.arc(0, 0, Rr * .025, 0, 7); g.fill(); g.restore(); }); }
  const S = Rr * .62, sh = new Path2D(); sh.moveTo(-S * .78, -S * .82); sh.lineTo(S * .78, -S * .82); sh.lineTo(S * .78, S * .05); sh.quadraticCurveTo(S * .7, S * .7, 0, S * 1.02); sh.quadraticCurveTo(-S * .7, S * .7, -S * .78, S * .05); sh.closePath();
  g.fillStyle = green; g.fill(sh); g.strokeStyle = gold; g.lineWidth = Rr * .035; g.stroke(sh);
  g.save(); g.clip(sh);
  g.fillStyle = '#f4efe0'; [[-S * .36, S * .32, .82], [0, S * .26, 1], [S * .36, S * .32, .82]].forEach(([tx, ty, k]) => { for (let j = 0; j < 3; j++) { const w = S * (.34 - j * .08) * k, top = ty - S * (.32 + j * .2) * k; g.beginPath(); g.moveTo(tx, top - S * .14 * k); g.lineTo(tx + w, top + S * .14 * k); g.lineTo(tx - w, top + S * .14 * k); g.closePath(); g.fill(); } g.fillRect(tx - S * .03, ty, S * .06, S * .12); });
  g.strokeStyle = '#9cc4e4'; g.lineWidth = S * .05; for (let k = 0; k < 2; k++) { g.beginPath(); for (let t = -S; t <= S; t += 2) g.lineTo(t, S * (.55 + k * .14) + Math.sin(t / S * 9) * S * .04); g.stroke(); }
  g.restore();
  g.fillStyle = gold; g.font = `700 ${S * .44 | 0}px "Nanum Myeongjo"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('서린', 0, -S * .58);
  g.restore(); }
function emblemFrame(seed) { rnd = R(seed); const W = 400, H = 512, c = mk(W, H), g = ctx(c), n = noise(seed);
  g.fillStyle = '#1a2340'; g.fillRect(0, 0, W, H); eachPx(c, (p, i, x, y) => { const v = (fbm(n, x * .3, y * .3, 2) - .5) * 16; p[i] = clamp(p[i] + v); p[i + 1] = clamp(p[i + 1] + v); p[i + 2] = clamp(p[i + 2] + v); });   // 벨벳
  g.strokeStyle = '#c8a24a'; g.lineWidth = 2; g.strokeRect(18, 18, W - 36, H - 36);
  g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 14; g.shadowOffsetY = 5; emblem(g, W / 2, 210, 140); g.shadowColor = 'transparent';
  g.fillStyle = '#d8b65a'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.font = '700 34px "Nanum Myeongjo"'; g.fillText('서 린 고 등 학 교', W / 2, 410); g.font = '400 15px "Noto Serif KR"'; g.fillStyle = '#b8a070'; g.fillText('교표  ·  숲처럼 푸르게, 물처럼 맑게', W / 2, 446);
  return c; }
function schoolSong(seed) { rnd = R(seed); const W = 362, H = 512, c = hanji(W, H, seed), g = ctx(c);
  emblem(g, W / 2, 52, 28); g.textBaseline = 'alphabetic';
  g.fillStyle = '#1a1612'; g.textAlign = 'center'; g.font = '700 26px "Nanum Myeongjo"'; g.fillText('서린고등학교 교가', W / 2, 112);
  const V = [['1.', '푸른 산 정기 받아 우뚝 선 배움터', '서린의 숲 우거져 그늘도 깊다', '슬기를 갈고 닦아 내일을 여는', '아아 우리 서린 영원하여라'], ['2.', '맑은 물 굽이굽이 흘러가듯이', '성실 정직 봉사로 함께 걸으리', '겨레의 빛이 되어 세상에 서는', '아아 우리 서린 영원하여라']];
  let y = 156; g.font = '400 16px "Nanum Myeongjo"';
  for (const v of V) { g.textAlign = 'left'; g.fillText(v[0], 40, y); for (let i = 1; i < v.length; i++) { g.fillText(v[i], 64, y); y += 30; } y += 18; }
  g.textAlign = 'center'; g.font = '400 13px "Nanum Myeongjo"'; g.fillStyle = '#4a4036'; g.fillText('1968년 개교와 함께 제정', W / 2, H - 46);
  return c; }

const LIST = [];
const add = (name, fn) => LIST.push({ name, fn });
add('oil_mountain_mist', () => mountains(11, 'mist')); add('oil_mountain_dawn', () => mountains(23, 'dawn')); add('oil_mountain_autumn', () => mountains(37, 'autumn'));
add('oil_hanok_village', () => hanok(41)); add('oil_hanok_village2', () => hanok(58));
add('oil_sea_dusk', () => seaDusk(61)); add('oil_sea_dusk2', () => seaDusk(77));
[[6, '오병철', '1981 ~ 1986', { glasses: 1 }], [7, '윤재덕', '1986 ~ 1991', { bald: 1, grey: 1 }], [8, '서동만', '1991 ~ 1996', { glasses: 1, grey: 1 }], [9, '한석규', '1996 ~ 1999', { badge: 1 }], [10, '임정길', '1999 ~ 2003', { glasses: 1 }], [11, '차상호', '2003 ~ 2007', { grey: 1, badge: 1 }]]
  .forEach(([n, nm, y, o]) => add(`portrait_p${n}`, () => portrait(100 + n, `제${n}대 교장`, nm, y, o)));
// 사진(photo_*)은 tools/capture_photos.mjs 가 실제 3D 장면을 찍어 만든다
add('emblem_seorin', () => emblemFrame(7)); add('callig_school_song', () => schoolSong(8));
add('callig_motto', () => motto(5)); add('callig_scroll', () => scroll(6));
add('cert_science_2007', () => certificate(301, { no: '제 2007-112 호', prize: '최우수상', who: '제2학년 3반  정 하 율', body: '위 학생은 2007학년도 교내 과학탐구대회에서 탁월한 성적을 거두었으므로 이 상장을 수여합니다.', date: '2007년 10월 26일', by: '서린고등학교장' }));
add('cert_choir_2006', () => certificate(302, { no: '제 2006-41 호', prize: '대  상', who: '제2학년 5반', border: '#6a3a5a', body: '위 학급은 2006학년도 서린 합창제에서 아름다운 화음과 협동심으로 으뜸이 되었기에 이 상장을 수여합니다.', date: '2006년 10월 20일', by: '서린고등학교장' }));
add('cert_school_2005', () => certificate(303, { no: '제 2005-7 호', title: '표 창 장', prize: '환경 가꾸기 우수학교', who: '서린고등학교', border: '#2a4a7a', body: '귀교는 학교 숲 가꾸기와 자원 재활용 교육에 힘써 학생들의 환경 의식을 높이는 데 이바지하였으므로 이에 표창합니다.', date: '2005년 12월 9일', by: '교 육 감' }));
add('cert_bcast_2008', () => certificate(304, { no: '제 2008-58 호', prize: '우수상', who: '방송부', border: '#7a4a1a', body: '위 동아리는 2008학년도 교내 영상 · 방송 제작 발표회에서 성실한 준비로 좋은 작품을 만들었으므로 이 상장을 수여합니다.', date: '2008년 7월 11일', by: '서린고등학교장' }));
add('art_wc_school', () => watercolorSchool(401)); add('art_wc_cosmos', () => watercolorFlowers(402)); add('art_still_life', () => stillLife(403)); add('art_plaster_sketch', () => plasterSketch(404));
POSTERS.forEach((p, k) => add(p.name, () => poster(500 + k, p)));

window.ART_LIST = LIST.map(x => x.name);
window.paintOne = (name, q = .8) => { const e = LIST.find(x => x.name === name); const c = e.fn(); const s = Math.min(1, 512 / Math.max(c.width, c.height));
  let o = c; if (s < 1) { o = mk(Math.round(c.width * s), Math.round(c.height * s)); ctx(o).drawImage(c, 0, 0, o.width, o.height); }
  window.__last = o; return { w: o.width, h: o.height, url: o.toDataURL('image/webp', q) }; };
window.contactSheet = async (urls) => { const cols = 6, cw = 220, ch = 200, rows = Math.ceil(urls.length / cols), c = mk(cols * cw, rows * ch), g = ctx(c); g.fillStyle = '#333'; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < urls.length; i++) { const im = new Image(); im.src = urls[i].url; await im.decode(); const s = Math.min((cw - 10) / im.width, (ch - 28) / im.height), w = im.width * s, h = im.height * s, x = (i % cols) * cw + (cw - w) / 2, y = Math.floor(i / cols) * ch + 4;
    g.drawImage(im, x, y, w, h); g.fillStyle = '#eee'; g.font = '12px sans-serif'; g.textAlign = 'center'; g.fillText(urls[i].name, (i % cols) * cw + cw / 2, Math.floor(i / cols) * ch + ch - 8); }
  return c.toDataURL('image/png'); };
})();
