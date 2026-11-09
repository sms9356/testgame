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
