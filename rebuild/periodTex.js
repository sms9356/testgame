// 고증 소품 텍스처 (2008년 밤, 1968~1998 지은 한국 고등학교): 칠판 · 분필 받침 · 철제 사물함 문 · 게시판 코르크 · 교무실 고무 책상 매트 ·
// 인조석(도끼다시) 복도 바닥 · 교실 커튼. 전부 절차 캔버스 1회 생성(≤1024px), 매 프레임 비용 없음. 시드 고정이라 매번 같은 그림.
import * as THREE from '../vendor/three.module.js';

const rng = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
function cv(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
const blob = (g, x, y, r, c0, c1) => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); };

// 녹색 칠판 (4.8 × 1.2m 한 장에 그대로 덮는다): 바탕 얼룩 · 칠판지우개 가로 문지른 자국 · 지우다 만 옛 판서 흔적 · 아래쪽 분필 가루 · 가장자리는 덜 닳아 짙다
export const chalkboard = () => cv(1024, 256, (g, w, h) => {
  const r = rng(4242);
  g.fillStyle = '#2c4636'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { const v = r() < .5 ? '255,255,250' : '8,20,12'; g.fillStyle = `rgba(${v},${r() * .05})`; g.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 4); }
  g.save(); g.globalAlpha = .045; g.fillStyle = '#e8ecdf'; g.font = '22px sans-serif';   // 지운 판서 유령 글씨
  const words = ['x² + 2x − 3 = 0', '∴ f(x)', '수능 D-27', '현재완료 have p.p.', 'sin²θ + cos²θ = 1', '임진왜란 1592', '단원평가', '자습', 'lim n→∞', '①②③④'];
  for (let i = 0; i < 26; i++) { g.save(); g.translate(r() * w, 20 + r() * (h - 40)); g.rotate((r() - .5) * .06); g.fillText(words[(r() * words.length) | 0], 0, 0); g.restore(); }
  g.restore();
  for (let i = 0; i < 70; i++) {   // 지우개 자국: 가로로 긴 반투명 띠, 살짝 휘어짐
    const y = r() * h, x = r() * w, L = 80 + r() * 260, th = 10 + r() * 22, a = .025 + r() * .05;
    g.strokeStyle = `rgba(225,232,220,${a})`; g.lineWidth = th; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + L / 2, y + (r() - .5) * 24, x + L, y + (r() - .5) * 10); g.stroke(); }
  for (let i = 0; i < 18; i++) blob(g, r() * w, r() * h, 30 + r() * 70, 'rgba(210,220,205,.06)', 'rgba(210,220,205,0)');   // 손바닥으로 문지른 뿌연 얼룩
  const gd = g.createLinearGradient(0, h * .72, 0, h); gd.addColorStop(0, 'rgba(225,228,215,0)'); gd.addColorStop(1, 'rgba(225,228,215,.22)'); g.fillStyle = gd; g.fillRect(0, h * .72, w, h * .28);   // 아래쪽 분필 가루
  const ge = g.createLinearGradient(0, 0, 0, h); ge.addColorStop(0, 'rgba(10,22,14,.28)'); ge.addColorStop(.12, 'rgba(10,22,14,0)'); g.fillStyle = ge; g.fillRect(0, 0, w, h);   // 위쪽(손 안 닿는 곳) 짙은 녹색
  [[0, 40], [w - 40, w]].forEach(([a, b]) => { const gs = g.createLinearGradient(a, 0, b, 0); gs.addColorStop(a ? 0 : 1, 'rgba(10,22,14,0)'); gs.addColorStop(a ? 1 : 0, 'rgba(10,22,14,.25)'); g.fillStyle = gs; g.fillRect(a, 0, b - a, h); });
});
// 알루미늄 분필 받침: 헤어라인 + 분필 가루 · 토막 분필 자리
export const chalkTray = () => cv(256, 32, (g, w, h) => {
  const r = rng(77);
  for (let y = 0; y < h; y++) { const v = 168 + r() * 26 | 0; g.fillStyle = `rgb(${v},${v + 2},${v + 4})`; g.fillRect(0, y, w, 1); }
  for (let i = 0; i < 40; i++) blob(g, r() * w, h * (.3 + r() * .7), 4 + r() * 12, 'rgba(245,245,238,.5)', 'rgba(245,245,238,0)');
  ['#f4f2ea', '#f4f2ea', '#e8c840', '#e86a5a'].forEach(c => { g.fillStyle = c; g.fillRect(r() * (w - 20), h * .5, 10 + r() * 14, 5); });   // 몽당 분필
});

// 철제 사물함 문 8 × 2 변형 (1024 × 512, 한 칸 = 128 × 256px): 회색 소부 도장 · 문 틈 · 환기 갤러리 · 명찰 꽂이(이름표) · 잠금 고리 · 찌그러짐 · 긁힘 · 녹 · 아래 신발 자국
const NAMES = ['김민수', '이지은', '박준혁', '최유진', '정현우', '강서연', '조성민', '윤하늘', '장동건', '임수빈', '한지민', '오세훈', '서지호', '신예린', '권나연', '황태민'];
export const lockerDoors = () => cv(1024, 512, (g, W, H) => {
  const r = rng(9001), cw = 128, ch = 256;
  for (let row = 0; row < 2; row++) for (let col = 0; col < 8; col++) {
    const x0 = col * cw, y0 = row * ch, v = 150 + (r() * 14 - 7) | 0;
    g.fillStyle = `rgb(${v},${v + 4},${v + 2})`; g.fillRect(x0, y0, cw, ch);   // 회녹색 기 도는 회색 소부 도장
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${r() < .5 ? '255,255,255' : '30,34,32'},${r() * .06})`; g.fillRect(x0 + r() * cw, y0 + r() * ch, 1 + r() * 3, 1 + r() * 3); }
    const gl = g.createLinearGradient(x0, y0, x0, y0 + ch); gl.addColorStop(0, 'rgba(255,255,255,.06)'); gl.addColorStop(1, 'rgba(0,0,0,.10)'); g.fillStyle = gl; g.fillRect(x0, y0, cw, ch);
    g.fillStyle = 'rgba(20,22,22,.85)'; g.fillRect(x0 + cw - 3, y0, 3, ch); g.fillRect(x0, y0 + ch - 3, cw, 3);   // 문 틈
    g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(x0 + 3, y0 + 3, cw - 8, 2); g.fillRect(x0 + 3, y0 + 3, 2, ch - 8);   // 접은 테두리 하이라이트
    g.strokeStyle = 'rgba(40,44,42,.35)'; g.lineWidth = 1.5; g.strokeRect(x0 + 8, y0 + 8, cw - 19, ch - 19);   // 프레스 테두리
    for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(18,20,20,.85)'; g.fillRect(x0 + 34, y0 + 20 + k * 9, 52, 3); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x0 + 34, y0 + 23 + k * 9, 52, 1); }   // 환기 갤러리
    const lx = x0 + 28, ly = y0 + 70; g.fillStyle = '#b8bcbe'; g.fillRect(lx - 3, ly - 3, 66, 30); g.fillStyle = '#f0ead6'; g.fillRect(lx, ly, 60, 24);   // 명찰 꽂이 + 종이
    if (r() > .18) { g.fillStyle = r() < .6 ? '#1a2a6a' : '#222'; g.font = `${13 + (r() * 3 | 0)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${1 + (r() * 36 | 0)}. ${NAMES[(row * 8 + col) % NAMES.length]}`, lx + 30, ly + 13); }
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(lx, ly, 60, 3);   // 비닐 덮개 반사
    const hx = x0 + cw - 26, hy = y0 + 128; g.fillStyle = '#5a5e60'; g.fillRect(hx, hy - 16, 12, 32); g.fillStyle = '#25282a'; g.fillRect(hx + 3, hy - 4, 6, 8);   // 잠금 고리 · 열쇠 구멍
    for (let i = 0; i < 2 + (r() * 3 | 0); i++) { const dx = x0 + 15 + r() * (cw - 30), dy = y0 + 40 + r() * (ch - 60), rr = 6 + r() * 16;   // 찌그러짐: 한쪽 밝고 한쪽 어두운 둥근 그늘
      blob(g, dx - rr * .3, dy - rr * .3, rr, 'rgba(255,255,255,.10)', 'rgba(255,255,255,0)'); blob(g, dx + rr * .3, dy + rr * .3, rr, 'rgba(0,0,0,.16)', 'rgba(0,0,0,0)'); }
    for (let i = 0; i < 6; i++) { g.strokeStyle = `rgba(${r() < .5 ? '235,235,230' : '60,60,58'},${.25 + r() * .3})`; g.lineWidth = .8; g.beginPath(); const sx = x0 + r() * cw, sy = y0 + r() * ch; g.moveTo(sx, sy); g.lineTo(sx + (r() - .5) * 40, sy + (r() - .5) * 14); g.stroke(); }   // 긁힘
    for (let i = 0; i < 5; i++) blob(g, x0 + r() * cw, y0 + ch - 20 + r() * 16, 2 + r() * 5, 'rgba(120,70,35,.55)', 'rgba(120,70,35,0)');   // 아래 모서리 녹
    if (r() < .5) { g.fillStyle = 'rgba(25,25,25,.18)'; g.fillRect(x0 + 20 + r() * 50, y0 + ch - 40 + r() * 15, 30, 10); }   // 신발 자국
    if (r() < .35) { g.save(); g.translate(x0 + 30 + r() * 60, y0 + 175 + r() * 40); g.rotate((r() - .5) * .5); g.fillStyle = ['#e8d040', '#f080a0', '#60b0e0'][(r() * 3) | 0]; g.fillRect(-12, -9, 24, 18); g.restore(); }   // 스티커
  }
});

// 게시판 코르크: 알갱이 · 압정 구멍 · 햇빛 바랜 얼룩 · 떼어낸 테이프 자국
export const cork = () => cv(512, 512, (g, w, h) => {
  const r = rng(321);
  g.fillStyle = '#a77d4c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26000; i++) { const v = r(); g.fillStyle = v < .45 ? `rgba(80,50,25,${.25 + r() * .3})` : v < .85 ? `rgba(200,160,110,${.2 + r() * .3})` : `rgba(50,30,15,${.4})`; g.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5); }
  for (let i = 0; i < 10; i++) blob(g, r() * w, r() * h, 40 + r() * 80, 'rgba(225,200,160,.12)', 'rgba(225,200,160,0)');
  for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(30,18,8,.7)'; g.beginPath(); g.arc(r() * w, r() * h, .8 + r() * .8, 0, 7); g.fill(); }   // 압정 구멍
  for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(235,225,190,.35)'; g.save(); g.translate(r() * w, r() * h); g.rotate((r() - .5) * .4); g.fillRect(-14, -5, 28, 10); g.restore(); }   // 테이프 자국
});

// 교무실 책상 고무 매트(짙은 녹색) + 위에 얹은 유리 아래 끼운 시간표 · 메모 · 사진
export const deskMat = () => cv(512, 256, (g, w, h) => {
  const r = rng(555);
  g.fillStyle = '#284636'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${r() < .5 ? '255,255,255' : '0,0,0'},${r() * .05})`; g.fillRect(r() * w, r() * h, 2, 2); }
  g.strokeStyle = 'rgba(15,30,22,.6)'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  g.fillStyle = '#efeadb'; g.fillRect(24, 24, 180, 120); g.strokeStyle = '#555'; g.lineWidth = 1;   // 시간표
  for (let i = 0; i <= 6; i++) { g.beginPath(); g.moveTo(24 + i * 30, 24); g.lineTo(24 + i * 30, 144); g.stroke(); } for (let j = 0; j <= 7; j++) { g.beginPath(); g.moveTo(24, 24 + j * 17); g.lineTo(204, 24 + j * 17); g.stroke(); }
  g.fillStyle = '#334'; for (let i = 0; i < 25; i++) g.fillRect(28 + (r() * 6 | 0) * 30, 28 + (r() * 7 | 0) * 17, 18, 6);
  g.save(); g.translate(300, 70); g.rotate(-.08); g.fillStyle = '#f6ec8a'; g.fillRect(0, 0, 70, 60); g.fillStyle = '#335'; for (let k = 0; k < 4; k++) g.fillRect(8, 12 + k * 11, 40 + r() * 15, 2); g.restore();   // 메모
  g.save(); g.translate(400, 150); g.rotate(.06); g.fillStyle = '#fff'; g.fillRect(0, 0, 70, 50); g.fillStyle = '#6a7e94'; g.fillRect(4, 4, 62, 42); g.restore();   // 사진
  g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(0, h); g.lineTo(w * .35, 0); g.lineTo(w * .5, 0); g.lineTo(w * .15, h); g.fill();   // 유리 반사 띠
});

// 인조석 물갈기(도끼다시) 2.4m 한 장: 회백 시멘트 바탕 + 백 · 흑 · 회 · 담녹 · 담홍 쇄석 + 1.2m 마다 황동 줄눈 + 왁스 얼룩
export const terrazzo = () => cv(1024, 1024, (g, w, h) => {
  const r = rng(2468);
  g.fillStyle = '#9a948a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) { const v = 150 + r() * 50; g.fillStyle = `rgba(${v},${v * .97},${v * .92},.35)`; g.fillRect(r() * w, r() * h, 3, 3); }   // 시멘트 바탕 얼룩
  for (let i = 0; i < 26000; i++) { const t = r(), s = .8 + r() * r() * 5;   // 각진 쇄석 (작은 것이 대부분, 가끔 큰 돌)
    g.fillStyle = t < .35 ? `rgba(222,218,206,${.45 + r() * .35})` : t < .6 ? `rgba(70,68,64,${.5 + r() * .5})` : t < .85 ? 'rgba(150,146,138,.8)' : t < .93 ? 'rgba(120,140,118,.8)' : 'rgba(170,120,104,.8)';
    const x = r() * w, y = r() * h; g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 + r() * .6, rr = s * (.55 + r() * .6); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); }
  for (let i = 0; i < 14; i++) blob(g, r() * w, r() * h, 80 + r() * 180, 'rgba(90,82,66,.08)', 'rgba(90,82,66,0)');   // 왁스 · 때 얼룩
  g.fillStyle = '#8a7240'; [0, w / 2].forEach(p => { g.fillRect(p, 0, 3, h); g.fillRect(0, p, w, 3); });   // 황동 줄눈 (1.2m)
});
export const terrazzoRough = () => cv(256, 256, (g, w, h) => {   // 왁스 광택 얼룩 (밝을수록 거침): 발길 닿는 곳은 매끈, 구석은 탁함
  const r = rng(1357); g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 30; i++) blob(g, r() * w, r() * h, 20 + r() * 50, `rgba(${r() < .5 ? '40,40,40' : '200,200,200'},.25)`, 'rgba(128,128,128,0)');
}, false);

// 교실 커튼(누렇게 바랜 미색 면 · 1998 납품): 세로 주름 명암 + 아래쪽 손때 · 햇빛 바램 줄
export const curtain = () => cv(256, 256, (g, w, h) => {
  const r = rng(808);
  for (let x = 0; x < w; x++) { const v = 196 + Math.sin(x / w * Math.PI * 6) * 18 + (r() - .5) * 6; g.fillStyle = `rgb(${v | 0},${v * .955 | 0},${v * .82 | 0})`; g.fillRect(x, 0, 1, h); }
  for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(0,0,0,${r() * .03})`; g.fillRect(0, y, w, 1); }   // 직조 결
  const gb = g.createLinearGradient(0, h * .7, 0, h); gb.addColorStop(0, 'rgba(90,75,50,0)'); gb.addColorStop(1, 'rgba(90,75,50,.22)'); g.fillStyle = gb; g.fillRect(0, h * .7, w, h * .3);
});

// 옥상 녹색 방수 페인트(우레탄 상도) 4m 한 장: 덧칠 경계 · 갈라짐 · 고인 물 마른 테 · 벗겨진 자리 · 파라펫 밑 이끼 · 발길 통로
export const roofCoat = () => cv(1024, 1024, (g, w, h) => {
  const r = rng(6060);
  g.fillStyle = '#58745c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 12; i++) { const x = r() * w, y = r() * h, ww = 200 + r() * 400, hh = 150 + r() * 300, v = r() < .5 ? '96,128,98' : '70,92,72';   // 덧칠한 네모 (색이 조금 다름)
    g.fillStyle = `rgba(${v},${.25 + r() * .25})`; g.fillRect(x - ww / 2, y - hh / 2, ww, hh); }
  for (let i = 0; i < 14000; i++) { g.fillStyle = `rgba(${r() < .5 ? '230,240,225' : '20,30,20'},${r() * .08})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); }
  for (let i = 0; i < 16; i++) { const x = r() * w, y = r() * h, rr = 60 + r() * 160;   // 물 고였다 마른 테
    const gr = g.createRadialGradient(x, y, rr * .55, x, y, rr); gr.addColorStop(0, 'rgba(120,110,80,.10)'); gr.addColorStop(.9, 'rgba(95,85,60,.28)'); gr.addColorStop(1, 'rgba(95,85,60,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rr, rr * (.5 + r() * .5), r() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(30,36,28,${.35 + r() * .3})`; g.lineWidth = .8 + r(); g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 10; k++) { x += (r() - .5) * 40; y += (r() - .5) * 40; g.lineTo(x, y); } g.stroke(); }   // 갈라짐
  for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h, rr = 3 + r() * 9; g.fillStyle = 'rgba(150,150,130,.55)'; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill(); g.strokeStyle = 'rgba(40,48,38,.5)'; g.lineWidth = 1; g.stroke(); }   // 벗겨져 회색 바탕 드러남
  for (let i = 0; i < 6; i++) blob(g, r() * w, r() < .5 ? r() * 60 : h - r() * 60, 90 + r() * 120, 'rgba(45,60,30,.35)', 'rgba(45,60,30,0)');   // 파라펫 밑 이끼 · 흙때
  g.fillStyle = 'rgba(30,30,26,.07)'; for (let y = 0; y < h; y += 14) g.fillRect(w * .45 + Math.sin(y * .02) * 30, y, 14, 7);   // 발길 닿는 통로
});
export const roofRough = () => cv(256, 256, (g, w, h) => { const r = rng(6161); g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, h);   // 밝을수록 거침: 고인 물 자리는 매끈
  for (let i = 0; i < 24; i++) blob(g, r() * w, r() * h, 15 + r() * 40, `rgba(${r() < .6 ? '120,120,120' : '250,250,250'},.35)`, 'rgba(200,200,200,0)'); }, false);

// 화장실 벽 흰 자기질 타일 200 × 200 (1.2m 한 장 = 6 × 6장): 장마다 미세 색차 · 유약 광 · 회색 줄눈 · 아래로 갈수록 때 · 금 간 장 · 녹물 줄
export const toiletTile = () => cv(512, 512, (g, w, h) => {
  const r = rng(2020), n = 6, s = w / n;
  g.fillStyle = '#9c9a92'; g.fillRect(0, 0, w, h);   // 줄눈
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const v = 238 + (r() * 10 - 5) | 0, x = i * s + 2, y = j * s + 2, q = s - 4;
    g.fillStyle = `rgb(${v},${v},${v - 4})`; g.fillRect(x, y, q, q);
    const gl = g.createLinearGradient(x, y, x + q, y + q); gl.addColorStop(0, 'rgba(255,255,255,.35)'); gl.addColorStop(.5, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,.05)'); g.fillStyle = gl; g.fillRect(x, y, q, q);
    if (r() < .05) { g.strokeStyle = 'rgba(80,80,76,.55)'; g.lineWidth = .8; g.beginPath(); g.moveTo(x + r() * q, y); g.lineTo(x + r() * q, y + q * .5); g.lineTo(x + r() * q, y + q); g.stroke(); } }   // 금 간 장
  const gd = g.createLinearGradient(0, 0, 0, h); gd.addColorStop(0, 'rgba(110,100,80,0)'); gd.addColorStop(1, 'rgba(110,100,80,.12)'); g.fillStyle = gd; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 3; i++) { const x = r() * w, gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(150,90,40,.18)'); gr.addColorStop(1, 'rgba(150,90,40,0)'); g.fillStyle = gr; g.fillRect(x, 0, 3 + r() * 4, h * (.4 + r() * .5)); }   // 녹물 줄
});

// 계단 논슬립(디딤판 앞 코): 홈 파인 검정 고무 + 양쪽 알루미늄 테 + 닳은 먼지
export const nonSlip = () => cv(256, 32, (g, w, h) => {
  const r = rng(31); g.fillStyle = '#9ea2a4'; g.fillRect(0, 0, w, h); g.fillStyle = '#242424'; g.fillRect(0, 6, w, h - 12);
  g.fillStyle = 'rgba(0,0,0,.6)'; for (let y = 9; y < h - 8; y += 4) g.fillRect(0, y, w, 1.5);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(200,195,180,${r() * .25})`; g.fillRect(r() * w, 6 + r() * (h - 12), 2 + r() * 8, 1); }
});

// ── 라운드 2: 교실 데코타일 · 걸레받이 · 외벽 풍화 ──
// 같은 텍스처 · 재질을 본관 · 별관 · 시설이 함께 쓴다 (건물마다 캔버스를 다시 그리지 않게 모듈 단위 캐시)
const SHARED = {};
export const shared = (key, make) => SHARED[key] || (SHARED[key] = make());

// PVC 데코타일 300 × 300 (2.4m 한 장 = 8 × 8장): 미색 · 회 두 톤 엇갈림 · 장마다 색차 · 칩 무늬 · 검은 줄눈 · 굽 자국 · 의자 끌린 긁힘
export const decoTile = () => cv(1024, 1024, (g, w, h) => {
  const r = rng(3003), n = 8, s = w / n;
  g.fillStyle = '#4a4740'; g.fillRect(0, 0, w, h);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = i * s + 1, y = j * s + 1, q = s - 2, alt = (i + j) % 2, d = (r() - .5) * 10;
    const b = alt ? [206, 200, 186] : [188, 186, 178]; g.fillStyle = `rgb(${b[0] + d | 0},${b[1] + d | 0},${b[2] + d | 0})`; g.fillRect(x, y, q, q);
    for (let k = 0; k < 260; k++) { const v = r() < .5 ? '120,116,106' : '235,232,222'; g.fillStyle = `rgba(${v},${.15 + r() * .3})`; g.fillRect(x + r() * q, y + r() * q, 1 + r() * 2.5, 1 + r() * 2.5); }   // 칩 무늬
    g.strokeStyle = `rgba(110,104,92,${.12 + r() * .1})`; g.lineWidth = 1 + r() * 2; g.beginPath(); let px = x + r() * q, py = y; g.moveTo(px, py);   // 옅은 대리석 결
    for (let k = 0; k < 6; k++) { px += (r() - .3) * q * .3; py += q / 6; g.lineTo(Math.min(x + q, Math.max(x, px)), py); } g.stroke();
    if (r() < .12) { g.fillStyle = 'rgba(250,248,240,.18)'; g.fillRect(x, y, q, q); }   // 나중에 갈아 끼운 새 장
    if (r() < .08) { g.fillStyle = 'rgba(40,36,30,.35)'; g.fillRect(x + (r() < .5 ? 0 : q - 3), y, 3, q); }   // 벌어진 이음
  }
  for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(25,22,20,${.18 + r() * .3})`; g.lineWidth = 1.5 + r() * 2.5; const x = r() * w, y = r() * h, a = r() * 6.28, L = 6 + r() * 22;   // 고무 굽 자국
    g.beginPath(); g.arc(x, y, L, a, a + .6 + r()); g.stroke(); }
  for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(80,74,64,${.08 + r() * .14})`; g.lineWidth = .7; const x = r() * w, y = r() * h, L = 20 + r() * 70; g.beginPath(); g.moveTo(x, y); g.lineTo(x + L, y + (r() - .5) * 8); g.stroke(); }   // 의자 끌린 긁힘
  for (let i = 0; i < 10; i++) blob(g, r() * w, r() * h, 60 + r() * 140, 'rgba(110,98,74,.07)', 'rgba(110,98,74,0)');   // 왁스 때 얼룩
});
export const decoRough = () => cv(256, 256, (g, w, h) => { const r = rng(3004); g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) blob(g, r() * w, r() * h, 15 + r() * 40, `rgba(${r() < .5 ? '70,70,70' : '210,210,210'},.3)`, 'rgba(150,150,150,0)'); }, false);

// 교실 한 칸 전체(바닥 x · z 를 0~1 로)에 덮는 닳은 동선: lanes = [[z0,z1]] 분단 사이 통로 · front = [x0,x1] 교탁 앞 띠
//   캔버스 x = 방의 x(칠판 → 뒤), 캔버스 y = 방의 z(복도 → 창). 투명 바탕 위에 회갈색 때
export const decoWear = (lanes, front) => cv(512, 512, (g, w, h) => {
  const r = rng(3005);
  const band = (x0, x1, y0, y1, a) => { for (let k = 0; k < 900; k++) { const x = x0 + r() * (x1 - x0), y = y0 + (y1 - y0) * (.5 + (r() + r() + r() - 1.5) * .45), rr = 3 + r() * 10;
    g.fillStyle = `rgba(92,82,66,${a * (.4 + r() * .6)})`; g.beginPath(); g.ellipse(x, y, rr * 1.8, rr, 0, 0, 7); g.fill(); } };
  lanes.forEach(([a, b]) => band(front[1] * w, w * .97, a * h, b * h, .05));
  band(front[0] * w, front[1] * w, h * .08, h * .92, .035);   // 교탁 앞 · 칠판 앞 가로 동선
  band(0, w, 0, h * .1, .06);   // 복도 쪽 앞 · 뒷문 동선 (가장 많이 밟힘)
  for (let i = 0; i < 50; i++) { g.strokeStyle = `rgba(20,18,16,${.12 + r() * .2})`; g.lineWidth = 1 + r() * 1.5; const [a, b] = lanes[(r() * lanes.length) | 0] || [0, .1];   // 통로 굽 자국
    const x = front[1] * w + r() * (1 - front[1]) * w, y = (a + r() * (b - a)) * h; g.beginPath(); g.arc(x, y, 3 + r() * 8, r() * 6, r() * 6 + 1); g.stroke(); }
});

// 외벽 빗물 자국 (창대 밑 한 장, 위 → 아래로 옅어짐): 투명 바탕 위 세로 줄
export const rainStreak = () => cv(256, 256, (g, w, h) => {
  const r = rng(4004);
  for (let i = 0; i < 26; i++) { const x = r() * w, ww = 2 + r() * 12, L = h * (.35 + r() * .65), a = .06 + r() * .14, gr = g.createLinearGradient(0, 0, 0, L);
    gr.addColorStop(0, `rgba(70,66,56,${a})`); gr.addColorStop(1, 'rgba(70,66,56,0)'); g.fillStyle = gr; g.fillRect(x, 0, ww, L); }
  const top = g.createLinearGradient(0, 0, 0, h * .18); top.addColorStop(0, 'rgba(60,56,48,.16)'); top.addColorStop(1, 'rgba(60,56,48,0)'); g.fillStyle = top; g.fillRect(0, 0, w, h * .18);   // 창대 바로 밑 고인 때
});
// 건물 밑동 때 + 벽돌 백화 (높이 한 장, 가로 2m 반복): 아래 짙은 흙탕 튄 자국 · 그 위 흰 소금꽃 얼룩
export const baseGrime = () => cv(512, 256, (g, w, h) => {
  const r = rng(5005);
  const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(48,42,32,.42)'); gr.addColorStop(.35, 'rgba(60,54,42,.14)'); gr.addColorStop(1, 'rgba(60,54,42,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) { const y = h - Math.pow(r(), 2.2) * h * .6; g.fillStyle = `rgba(52,44,34,${.08 + r() * .2})`; g.fillRect(r() * w, y, 1 + r() * 2.5, 1 + r() * 2.5); }   // 빗물 튄 흙
  for (let i = 0; i < 5; i++) { const x = r() * w, y = h * (.45 + r() * .35), rr = 10 + r() * 30;   // 백화 (흰 소금꽃)
    g.save(); g.translate(x, y); g.scale(1.6, 1); blob(g, 0, 0, rr, 'rgba(236,234,226,.16)', 'rgba(236,234,226,0)'); g.restore();
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(245,244,238,${.08 + r() * .16})`; g.fillRect(x + (r() - .5) * rr * 2.4, y + (r() - .5) * rr, 1 + r() * 2, 1 + r() * 2); } }
});
// 공용 재질 (투명 덧칠 · 데코타일 · 걸레받이)
const decal = map => new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: .95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
export const MAT = {
  deco: () => shared('m_deco', () => new THREE.MeshStandardMaterial({ map: decoTile(), roughnessMap: decoRough(), roughness: .62, metalness: 0 })),
  skirt: () => shared('m_skirt', () => new THREE.MeshStandardMaterial({ color: 0x34403a, roughness: .5, metalness: .05 })),   // 진회녹색 PVC 걸레받이 (반광)
  streak: () => shared('m_streak', () => decal(rainStreak())),
  grime: () => shared('m_grime', () => decal(baseGrime())),
  wear: (lanes, front) => { const L = lanes.map(q => q.map(v => +v.toFixed(3))), F = front.map(v => +v.toFixed(3)); return shared('m_wear' + JSON.stringify([L, F]), () => decal(decoWear(L, F))); },
};
