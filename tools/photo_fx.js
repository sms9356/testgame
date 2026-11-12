// 사진 현상기 (tools/capture_photos.mjs 가 빈 페이지에 넣어 돌린다)
//   게임 3D 장면을 찍은 원본(raw)에 3D 인물 층(photo_people.js) · 만국기 대신 삼각 깃발 · 현수막 · 꽃가지 등을 얹고,
//   시대별 사진 질감을 입힌다: 1968 흑백 인화(물결 테두리) · 80~90년대 컬러 필름(바램 · 색 틀어짐 · 입자 · 주변부 어둠 · 빛샘 ·
//   오렌지 날짜 각인 · 흰 테두리 인화지 스캔) · 2008 디지털 카메라(선명 · 차가운 화이트밸런스 · 센서 노이즈).
//   인물은 게임 캐릭터 모델을 복제한 3D 렌더이며 실제 인물이 아니다.
(() => {
const R = s => { let a = s >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
let rnd = R(1); const rr = (a, b) => a + (b - a) * rnd();
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const cx = c => c.getContext('2d', { willReadFrequently: true });
const clamp = v => v < 0 ? 0 : v > 255 ? 255 : v;
const RAW = {};
window.loadRaws = async raws => { for (const [k, u] of Object.entries(raws)) { const im = new Image(); im.src = u; await im.decode(); RAW[k] = im; } };

// ── 원본 자르기 ──
function frame(src, W, H, crop = [0, 0, 1, 1]) { const im = RAW[src]; if (!im) return null; const c = mk(W, H), g = cx(c);
  g.drawImage(im, crop[0] * im.width, crop[1] * im.height, crop[2] * im.width, crop[3] * im.height, 0, 0, W, H); return c; }

// ── 3D 인물 층 합성 (tools/photo_people.js 가 같은 카메라로 그린 사람 + 접지 그림자, 원본의 2배 해상도 RGBA) ──
function people(c, key, crop = [0, 0, 1, 1], soft = .35) { const im = RAW[key + '_people']; if (!im) return;
  const L = mk(c.width, c.height), g = cx(L); g.imageSmoothingQuality = 'high';
  g.drawImage(im, crop[0] * im.width, crop[1] * im.height, crop[2] * im.width, crop[3] * im.height, 0, 0, c.width, c.height);
  const q = cx(c); q.save(); if (soft) q.filter = `blur(${soft}px)`; q.drawImage(L, 0, 0); q.restore(); }
function bunting(c, lines, seed) {   // 운동장 위 줄 깃발 (단색 삼각기 — 국기 아님)
  const g = cx(c), cols = ['#d23a2a', '#f0c22a', '#2a6ad0', '#2aa04a', '#f4f0e8', '#e06a1a']; rnd = R(seed);
  for (const [x0, y0, x1, y1, sag] of lines) { const W = c.width, H = c.height; g.strokeStyle = 'rgba(40,40,40,.7)'; g.lineWidth = 1; g.beginPath();
    const P = t => [(x0 + (x1 - x0) * t) * W, (y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)) * H]; for (let t = 0; t <= 1.001; t += .02) { const [x, y] = P(t); t ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    const n = 34; for (let i = 0; i < n; i++) { const t = (i + .5) / n, [x, y] = P(t), sz = 6 * (1 - Math.abs(t - .5) * .3); g.fillStyle = cols[i % cols.length]; g.beginPath(); g.moveTo(x - sz * .6, y); g.lineTo(x + sz * .6, y); g.lineTo(x + rr(-1, 1), y + sz * 1.3); g.closePath(); g.fill(); } }
}
function banner(c, x, y, w, h, txt, sub, col = '#b8242a') { const g = cx(c); g.save(); g.fillStyle = col; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.strokeRect(x + 2, y + 2, w - 4, h - 4);
  g.fillStyle = '#fff8e0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${h * .5 | 0}px "Noto Sans KR"`; g.fillText(txt, x + w / 2, y + h * (sub ? .4 : .52), w - 8);
  if (sub) { g.font = `400 ${h * .22 | 0}px "Noto Sans KR"`; g.fillText(sub, x + w / 2, y + h * .78, w - 8); } g.restore(); }
function branches(c, side, kind, seed) {   // 초점 밖 앞쪽 나뭇가지: 벚꽃(spring) · 은행잎(autumn)
  rnd = R(seed); const L = mk(c.width, c.height), g = cx(L), W = c.width, H = c.height, sx = side === 'L' ? 0 : W, dir = side === 'L' ? 1 : -1;
  const pts = []; g.strokeStyle = '#2a1e18'; g.lineCap = 'round';
  const br = (x, y, a, len, w, d) => { const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 + rr(-8, 8), (y + y2) / 2 + rr(-8, 8), x2, y2); g.stroke(); pts.push([x2, y2]);
    if (d > 0) { br(x2, y2, a + rr(-.6, -.15), len * .66, w * .62, d - 1); br(x2, y2, a + rr(.15, .6), len * .62, w * .6, d - 1); } else pts.push([(x + x2) / 2, (y + y2) / 2]); };
  br(sx, H * .06, side === 'L' ? .35 : Math.PI - .35, W * .2, 9, 4);
  for (const [x, y] of pts) for (let k = 0; k < (kind === 'spring' ? 7 : 4); k++) { const r = rr(3, 7); g.fillStyle = kind === 'spring' ? `rgba(${248 + rr(-6, 6) | 0},${214 + rr(-20, 20) | 0},${222 + rr(-10, 10) | 0},.9)` : `rgba(${232 + rr(-10, 10) | 0},${186 + rr(-24, 20) | 0},${40 + rr(-20, 20) | 0},.92)`; g.beginPath(); g.arc(x + rr(-12, 12), y + rr(-10, 10), r, 0, 7); g.fill(); }
  const b = cx(c); b.save(); b.filter = 'blur(3px)'; b.drawImage(L, 0, 0); b.restore();
  if (kind === 'autumn') { const q = cx(c); for (let i = 0; i < 90; i++) { q.fillStyle = `rgba(${226 + rr(-12, 12) | 0},${180 + rr(-30, 20) | 0},40,${rr(.5, .9)})`; q.beginPath(); q.ellipse(rr(0, W), rr(.86, 1) * H, rr(1.5, 3), rr(1, 1.8), rr(0, 3), 0, 7); q.fill(); } }
}

// ── 필름 · 인화 · 디지털 질감 ──
function develop(c, o) {
  rnd = R(o.seed || 7); const W = c.width, H = c.height, g = cx(c);
  if (o.blur) { const b = mk(W, H), q = cx(b); q.filter = `blur(${o.blur}px)`; q.drawImage(c, 0, 0); g.clearRect(0, 0, W, H); g.drawImage(b, 0, 0); }
  if (o.sharpen) { const b = mk(W, H), q = cx(b); q.filter = 'blur(1px)'; q.drawImage(c, 0, 0); const A = g.getImageData(0, 0, W, H), B = q.getImageData(0, 0, W, H), a = A.data, bb = B.data; for (let i = 0; i < a.length; i += 4) for (let k = 0; k < 3; k++) a[i + k] = clamp(a[i + k] + (a[i + k] - bb[i + k]) * o.sharpen); g.putImageData(A, 0, 0); }
  const d = g.getImageData(0, 0, W, H), p = d.data, [sr, sg, sb] = o.shift || [0, 0, 0], fade = o.fade || 0, sat = o.sat ?? 1, sep = o.sepia || 0, con = o.contrast ?? 1, vig = o.vignette ?? .35, gr = o.grain || 0, mono = o.mono, lift = o.lift || [0, 0, 0], bright = o.bright ?? 1;
  const gn = new Float32Array((W >> 1) * (H >> 1) + W); for (let i = 0; i < gn.length; i++) gn[i] = (rnd() + rnd() + rnd() - 1.5);   // 입자 (2px 덩어리)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; let r = p[i] * bright, G = p[i + 1] * bright, b = p[i + 2] * bright;
    const l = r * .3 + G * .59 + b * .11;
    r = l + (r - l) * sat; G = l + (G - l) * sat; b = l + (b - l) * sat;
    if (mono) { r = G = b = l; }
    if (sep) { const sr2 = l * 1.07 + 18, sg2 = l * .95 + 8, sb2 = l * .78 - 4; r += (sr2 - r) * sep; G += (sg2 - G) * sep; b += (sb2 - b) * sep; }
    r = (r - 128) * con + 128 + sr; G = (G - 128) * con + 128 + sg; b = (b - 128) * con + 128 + sb;
    r = r * (1 - fade) + (lift[0] + 60) * fade; G = G * (1 - fade) + (lift[1] + 58) * fade; b = b * (1 - fade) + (lift[2] + 52) * fade;
    const nx = x / W - .5, ny = y / H - .5, v = 1 - vig * Math.pow((nx * nx + ny * ny) * 2.2, 1.4);
    const n = gr * gn[(y >> 1) * (W >> 1) + (x >> 1)] * (1 - Math.abs(l - 128) / 300) + gr * .35 * (rnd() - .5);
    p[i] = clamp(r * v + n); p[i + 1] = clamp(G * v + n * (mono ? 1 : .95)); p[i + 2] = clamp(b * v + n * (mono ? 1 : 1.08)); }
  g.putImageData(d, 0, 0);
  if (o.leak) { const [lx, ly, lr, col] = o.leak; const G = g.createRadialGradient(lx * W, ly * H, 0, lx * W, ly * H, lr * W); G.addColorStop(0, col); G.addColorStop(1, 'rgba(255,120,40,0)'); g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = G; g.fillRect(0, 0, W, H); g.restore(); }
  if (o.dust) { for (let i = 0; i < o.dust; i++) { g.fillStyle = rnd() < .7 ? `rgba(255,255,250,${rr(.3, .8)})` : `rgba(20,16,12,${rr(.3, .7)})`; g.beginPath(); g.ellipse(rr(0, W), rr(0, H), rr(.4, 1.3), rr(.4, 1), rr(0, 3), 0, 7); g.fill(); }
    for (let i = 0; i < (o.scratch || 0); i++) { g.strokeStyle = `rgba(250,248,240,${rr(.15, .4)})`; g.lineWidth = rr(.4, .9); const x = rr(0, W), y = rr(0, H); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + rr(-20, 20), y + rr(10, 40), x + rr(-30, 30), y + rr(30, 90)); g.stroke(); }
    if (o.hair) { g.strokeStyle = 'rgba(20,18,14,.5)'; g.lineWidth = .7; const x = rr(W * .2, W * .8), y = rr(H * .2, H * .8); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 20, y - 15, x + 10, y + 25, x + 34, y + 12); g.stroke(); } }
  if (o.date) { g.save(); g.font = `700 ${Math.round(H * .055)}px "Nanum Gothic Coding", monospace`; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.shadowColor = 'rgba(255,110,20,.9)'; g.shadowBlur = 4; g.fillStyle = 'rgba(255,150,50,.92)'; g.fillText(o.date, W * .93, H * .91); g.shadowBlur = 0; g.fillStyle = 'rgba(255,214,140,.55)'; g.fillText(o.date, W * .93, H * .91); g.restore(); }
  if (o.caption) { const [txt, pos, font] = o.caption; g.save(); g.font = font || `700 ${Math.round(H * .05)}px "Noto Serif KR"`; g.textAlign = 'center'; g.fillStyle = 'rgba(250,246,236,.92)'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 2; g.fillText(txt, W / 2, pos * H); g.restore(); }
  return c;
}
function print(c, o) {   // 인화지 테두리 · 스캔 (white: 90년대 현상소 · deckle: 60년대 물결 테두리 · none)
  if (!o.border || o.border === 'none') return c; rnd = R((o.seed || 1) + 99);
  const b = o.border === 'deckle' ? .07 : .045, W = c.width, H = c.height, T = Math.round(Math.min(W, H) * b), out = mk(W + T * 2, H + T * 2), g = cx(out), OW = out.width, OH = out.height;
  g.fillStyle = '#5a5248'; g.fillRect(0, 0, OW, OH);   // 스캐너 뚜껑 그림자
  g.fillStyle = o.paper || (o.border === 'deckle' ? '#ece2cc' : '#f2efe6'); g.beginPath();
  if (o.border === 'deckle') { const s = 3, e = 2.5; for (let x = 2; x <= OW - 2; x += s) g.lineTo(x, 2 + rr(0, e)); for (let y = 2; y <= OH - 2; y += s) g.lineTo(OW - 2 - rr(0, e), y); for (let x = OW - 2; x >= 2; x -= s) g.lineTo(x, OH - 2 - rr(0, e)); for (let y = OH - 2; y >= 2; y -= s) g.lineTo(2 + rr(0, e), y); }
  else { const r = 4; g.roundRect(1.5, 1.5, OW - 3, OH - 3, r); }
  g.fill(); g.drawImage(c, T, T);
  const d = g.getImageData(0, 0, OW, OH), p = d.data; for (let i = 0; i < p.length; i += 4) { const y = (i / 4 / OW) | 0, x = (i / 4) % OW, edge = Math.min(x, y, OW - x, OH - y) / Math.min(OW, OH);   // 종이 누렇게 바램 (가장자리 더)
    const k = (o.yellow || .08) * (1 - Math.min(1, edge * 6)); p[i + 2] = clamp(p[i + 2] * (1 - k * 1.2)); p[i + 1] = clamp(p[i + 1] * (1 - k * .4)); }
  g.putImageData(d, 0, 0);
  if (o.ink) { g.save(); g.font = `400 ${Math.round(T * .9)}px "Nanum Pen Script"`; g.fillStyle = 'rgba(40,40,70,.75)'; g.textAlign = 'right'; g.fillText(o.ink, OW - T * 1.3, OH - T * .22); g.restore(); }
  return out;
}

// ── 사진 목록 ──
const L = [];
const add = (name, src, fn) => L.push({ name, src, fn });
const gradYear = (y, crop, seed, src) => add(`photo_grad_${y}`, src, () => { rnd = R(seed); const c = frame(src, 512, 340, crop); if (!c) return null;
  people(c, `grad_${y}`, crop, y < 1992 ? .55 : .35);
  const n = y - 1970, old = y < 1992, mid = y < 2002;
  develop(c, { seed, bright: old ? 1.3 : 1.12, blur: old ? .8 : .5, sat: old ? .55 : mid ? .82 : 1, fade: old ? .3 : mid ? .18 : .06, sepia: old ? .35 : 0, shift: old ? [10, 2, -14] : mid ? [8, 0, -6] : [0, 0, 4], contrast: old ? .9 : 1.04, grain: old ? 24 : mid ? 15 : 7, vignette: old ? .5 : .3, dust: old ? 70 : mid ? 30 : 0, scratch: old ? 5 : 1,
    caption: [`제${n}회 졸업기념  ${y}. 2.`, .1, `700 ${y < 2000 ? 19 : 17}px "${y < 2000 ? 'Noto Serif KR' : 'Noto Sans KR'}"`], leak: y === 1993 ? [1, .1, .5, 'rgba(255,120,40,.35)'] : null });
  return print(c, { border: y < 2004 ? 'white' : 'none', seed, yellow: old ? .16 : .07 }); });
const GA = [.12, .3, .76, .62], GB = [.08, .24, .72, .66];   // 단체가 화면을 채우게 자른다 (grad_a = 현관 앞 · grad_b = 운동장 쪽에서 본 본관)
gradYear(1989, GB, 189, 'grad_b'); gradYear(1993, GA, 193, 'grad_a'); gradYear(1997, GB, 197, 'grad_b');
gradYear(2001, GA, 201, 'grad_a'); gradYear(2004, GA, 204, 'grad_a'); gradYear(2007, GB, 207, 'grad_b');

add('photo_opening_1968', 'grad_b', () => { rnd = R(68); const OC = [.06, .14, .86, .76], c = frame('grad_b', 512, 352, OC); if (!c) return null;
  people(c, 'opening_1968', OC, .8);
  develop(c, { seed: 68, bright: 1.3, blur: 1.2, mono: true, sepia: .55, contrast: .95, fade: .22, grain: 30, vignette: .55, dust: 110, scratch: 9, hair: 1, caption: ['서린고등학교 개교 기념  1968. 3. 2.', .1, '700 19px "Nanum Myeongjo"'] });
  return print(c, { border: 'deckle', seed: 68, yellow: .22 }); });
add('photo_aerial_campus', 'aerial', () => { const c = frame('aerial', 1024, 704, [.04, .12, .92, .88]); if (!c) return null;
  develop(c, { seed: 3, sharpen: .4, sat: 1.08, contrast: 1.06, shift: [4, 4, 0], grain: 6, vignette: .22, bright: 1.05, caption: null });
  const g = cx(c); g.fillStyle = 'rgba(250,250,245,.85)'; g.font = '700 22px "Noto Sans KR"'; g.textAlign = 'left'; g.fillText('서린고등학교 전경 · 2007. 10.', 22, 690); return c; });
add('photo_gate_1994', 'gate', () => { rnd = R(94); const c = frame('gate', 512, 352); if (!c) return null; branches(c, 'R', 'spring', 94);
  develop(c, { seed: 94, blur: .8, sat: .85, fade: .2, shift: [12, 4, -8], contrast: .96, grain: 18, vignette: .45, leak: [0, .9, .6, 'rgba(255,90,30,.45)'], dust: 30, scratch: 1, date: "'94 4 12" });
  return print(c, { border: 'white', seed: 94, yellow: .1 }); });
add('photo_gate_autumn_1996', 'gate_in', () => { rnd = R(96); const c = frame('gate_in', 512, 352); if (!c) return null; branches(c, 'L', 'autumn', 96);
  develop(c, { seed: 96, blur: .7, sat: .9, fade: .16, shift: [16, 6, -14], contrast: 1, grain: 16, vignette: .42, dust: 24, date: "'96 10 21" });
  return print(c, { border: 'white', seed: 96 }); });
add('photo_sports_1997', 'field', () => { rnd = R(97); const SC = [.18, .26, .62, .62], c = frame('field', 512, 352, SC); if (!c) return null;
  bunting(c, [[0, .05, 1, .14, .1], [0, .2, .8, .02, .08]], 97);
  people(c, 'sports_1997', SC, .35);
  develop(c, { seed: 97, blur: .7, sat: .92, fade: .15, shift: [10, 2, -8], contrast: 1.02, grain: 16, vignette: .4, dust: 20, leak: [1, 0, .45, 'rgba(255,140,50,.3)'], date: "'97 5 3" });
  return print(c, { border: 'white', seed: 97 }); });
add('photo_seorinje_2007', 'aud', () => { rnd = R(207); const c = frame('aud', 512, 352); if (!c) return null;
  banner(c, 152, 120, 160, 34, '제40회 서린제', '2007. 10. 19 ~ 20 · 대강당');
  people(c, 'seorinje_2007', [0, 0, 1, 1], .25);
  develop(c, { seed: 207, sharpen: .6, sat: 1.12, contrast: 1.06, shift: [-2, 0, 8], grain: 7, vignette: .15, bright: 1.06 }); return c; });
add('photo_bcast_1998', 'bcast', () => { rnd = R(198); const BC = [.3, .2, .62, .66], c = frame('bcast', 500, 392, BC); if (!c) return null;
  people(c, 'bcast_1998', BC, .45);
  { const q = cx(c), G = q.createRadialGradient(250, 210, 20, 250, 210, 260); G.addColorStop(0, 'rgba(255,240,220,.10)'); G.addColorStop(1, 'rgba(255,240,220,0)'); q.save(); q.globalCompositeOperation = 'screen'; q.fillStyle = G; q.fillRect(0, 0, 500, 392); q.restore(); }   // 플래시 빛 퍼짐
  develop(c, { seed: 198, bright: 1.7, blur: .9, sat: .82, fade: .26, shift: [14, -2, 6], contrast: .95, grain: 22, vignette: .5, leak: [0, .15, .55, 'rgba(255,80,40,.4)'], dust: 46, scratch: 2, date: "'98 9 25" });
  return print(c, { border: 'white', seed: 198, yellow: .12 }); });
add('photo_gym_2005', 'gym', () => { const c = frame('gym', 512, 352); if (!c) return null; develop(c, { seed: 205, sharpen: .4, sat: 1.04, contrast: 1.05, shift: [6, 2, -4], grain: 9, vignette: .25, bright: 1.08 }); return c; });
add('photo_library_2008', 'library', () => { const c = frame('library', 512, 352); if (!c) return null; develop(c, { seed: 208, sharpen: .5, sat: 1.05, contrast: 1.04, shift: [-2, 0, 6], grain: 8, vignette: .18, bright: 1.08 }); return c; });
add('photo_classroom_2006', 'classroom', () => { const c = frame('classroom', 512, 352); if (!c) return null; develop(c, { seed: 206, sharpen: .5, sat: 1.02, contrast: 1.04, shift: [0, 2, 6], grain: 9, vignette: .2, bright: 1.06 }); return c; });
add('photo_spring_1999', 'facade', () => { rnd = R(99); const c = frame('facade', 512, 352, [.06, .02, .9, .92]); if (!c) return null; branches(c, 'L', 'spring', 99);
  develop(c, { seed: 99, blur: .7, sat: .95, fade: .14, shift: [8, 6, -2], contrast: 1, grain: 15, vignette: .38, dust: 18, date: "'99 4 8", lift: [10, 4, 8] });
  return print(c, { border: 'white', seed: 99 }); });
add('photo_autumn_2006', 'steps', () => { rnd = R(106); const c = frame('steps', 512, 352, [.1, 0, .9, 1]); if (!c) return null; branches(c, 'R', 'autumn', 106);
  develop(c, { seed: 106, sharpen: .5, sat: 1.1, contrast: 1.05, shift: [10, 4, -8], grain: 7, vignette: .2, bright: 1.04 }); return c; });

window.PHOTO_LIST = L.map(x => x.name);
window.developOne = (name, q = .82) => { const e = L.find(x => x.name === name); const c = e.fn(); if (!c) return null; const s = Math.min(1, (name === 'photo_aerial_campus' ? 768 : 512) / Math.max(c.width, c.height));
  let o = c; if (s < 1) { o = mk(Math.round(c.width * s), Math.round(c.height * s)); const g = cx(o); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, o.width, o.height); }
  return { url: o.toDataURL('image/webp', q), w: o.width, h: o.height }; };
window.contactSheet = async urls => { const cols = 5, cw = 300, ch = 250, rows = Math.ceil(urls.length / cols), c = mk(cols * cw, rows * ch), g = cx(c); g.fillStyle = '#333'; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < urls.length; i++) { const im = new Image(); im.src = urls[i].url; await im.decode(); const s = Math.min((cw - 12) / im.width, (ch - 34) / im.height), w = im.width * s, h = im.height * s, x = (i % cols) * cw + (cw - w) / 2, y = Math.floor(i / cols) * ch + 6;
    g.drawImage(im, x, y, w, h); g.fillStyle = '#ddd'; g.font = '12px sans-serif'; g.textAlign = 'center'; g.fillText(urls[i].name, (i % cols) * cw + cw / 2, Math.floor(i / cols) * ch + ch - 10); }
  return c.toDataURL('image/png'); };
})();
