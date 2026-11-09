// Poly Haven 학교 책걸상(미국식 파란 플라스틱 의자)을 2000년대 한국 고교 책걸상으로 고증 보정 — 색 아틀라스를 로드 때 한 번만 다시 칠한다.
//   의자: 파란 플라스틱 좌판 · 등판 → 니스 칠 너도밤나무 합판(결 · 모서리 닳음), 쇠파이프 다리 → 회녹색 도장
//   책상: 상판 합판에 볼펜 낙서 · 수정액 · 컴퍼스로 판 자국 · 연필 자국, 상판 옆 띠(에지 밴드)는 짙은 갈색
// 1024² 캔버스 1장씩(원본과 같은 크기 → 텍스처 메모리 증가 없음, 원본은 버린다). 매 프레임 비용 없음.
import * as THREE from '../vendor/three.module.js';

const rng = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
function repaint(mat, fn) {
  const t = mat && mat.map, img = t && t.image; if (!img || !img.width) return;
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0); fn(g, c.width, c.height);
  const n = new THREE.CanvasTexture(c); n.flipY = t.flipY; n.colorSpace = t.colorSpace; n.wrapS = t.wrapS; n.wrapT = t.wrapT; n.channel = t.channel; n.anisotropy = 8;
  mat.map = n; mat.needsUpdate = true; if (t.dispose) t.dispose();
}
function chair(g, w, h) {
  const d = g.getImageData(0, 0, w, h), p = d.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, r = p[i], gg = p[i + 1], b = p[i + 2];
    if (b > r + 18 && b > gg + 6) {   // 파란 플라스틱 → 너도밤나무 합판 (원래 명암을 살려 결 · 그늘 유지)
      const L = (r + gg + b) / 3 / 52, grain = .9 + .1 * Math.sin(y * .09 + Math.sin(x * .013) * 6) + .05 * Math.sin(y * .7 + x * .05), k = Math.min(1.08, L * grain);
      p[i] = 186 * k; p[i + 1] = 138 * k; p[i + 2] = 90 * k;
    } else if (Math.abs(r - b) < 14 && r > 90) {   // 크롬 쇠파이프 → 회녹색 도장
      p[i] = r * .78; p[i + 1] = gg * .86; p[i + 2] = b * .8; }
  }
  g.putImageData(d, 0, 0);
}
function desk(g, w, h) {
  const d = g.getImageData(0, 0, w, h), p = d.data;
  for (let y = 0; y < h; y++) for (let x = Math.floor(w * .8); x < w; x++) { const i = (y * w + x) * 4, r = p[i], gg = p[i + 1], b = p[i + 2];   // 상판 옆면 띠: 짙은 갈색 에지 밴드
    if (r > gg + 25 && gg > b + 10) { p[i] = r * .62; p[i + 1] = gg * .52; p[i + 2] = b * .46; } }
  g.putImageData(d, 0, 0);
  const r = rng(2008);
  // 상판 두 면(아틀라스 왼쪽 아래 두 칸)에 낙서
  for (const [ax, ay, aw, ah] of [[0, .39, .4, .295], [0, .69, .4, .305]]) {
    const X = ax * w, Y = ay * h, W = aw * w, H = ah * h; g.save(); g.beginPath(); g.rect(X + 6, Y + 6, W - 12, H - 12); g.clip();
    for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(30,20,10,${.18 + r() * .2})`; g.lineWidth = .8; g.beginPath(); const sx = X + r() * W, sy = Y + r() * H; g.moveTo(sx, sy); g.lineTo(sx + (r() - .5) * 60, sy + (r() - .5) * 20); g.stroke(); }   // 컴퍼스 · 칼 긁힘
    const ink = ['rgba(30,50,140,.45)', 'rgba(20,20,25,.4)', 'rgba(150,30,40,.35)'], words = ['수능 D-100', '졸려…', '♡', 'JH♡SY', '3-2 짱', '집에 가고싶다', '1+1=2?', '★', 'ㅋㅋㅋ', '2008'];
    for (let i = 0; i < 5; i++) { g.save(); g.translate(X + 20 + r() * (W - 50), Y + 15 + r() * (H - 25)); g.rotate((r() - .5) * 1.2); g.scale(-1, 1); g.fillStyle = ink[(r() * 3) | 0]; g.font = `${7 + (r() * 4 | 0)}px sans-serif`; g.fillText(words[(i * 3 + (ay > .5 ? 5 : 0)) % words.length], 0, 0); g.restore(); }   // 볼펜 낙서
    for (let i = 0; i < 3; i++) { g.strokeStyle = ink[0]; g.lineWidth = 1.2; g.beginPath(); let px = X + r() * W, py = Y + r() * H; g.moveTo(px, py); for (let k = 0; k < 14; k++) { px += (r() - .5) * 8; py += (r() - .5) * 6; g.lineTo(px, py); } g.stroke(); }   // 끄적인 선
    for (let i = 0; i < 2; i++) { g.fillStyle = 'rgba(245,244,236,.85)'; g.beginPath(); g.ellipse(X + r() * W, Y + r() * H, 3 + r() * 4, 1.5 + r() * 2, r() * 3, 0, 7); g.fill(); }   // 수정액
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(60,60,60,.12)'; g.fillRect(X + r() * W, Y + r() * H, 20 + r() * 40, 2); }   // 연필 자국
    const ge = g.createRadialGradient(X + W / 2, Y + H / 2, Math.min(W, H) * .2, X + W / 2, Y + H / 2, Math.max(W, H) * .7); ge.addColorStop(0, 'rgba(60,40,20,0)'); ge.addColorStop(1, 'rgba(60,40,20,.18)'); g.fillStyle = ge; g.fillRect(X, Y, W, H);   // 손때 · 가장자리 그늘
    { const sx = X + W * .12, sy = Y + H * (ay > .5 ? .7 : .12); g.save(); g.translate(sx, sy); g.scale(-1, 1); g.fillStyle = 'rgba(250,248,238,.92)'; g.fillRect(-46, 0, 46, 13); g.strokeStyle = 'rgba(40,80,160,.6)'; g.lineWidth = 1; g.strokeRect(-46, 0, 46, 13);   // 이름 스티커 (반 · 번호 · 이름, 모서리 들뜸)
      g.fillStyle = '#1a2a6a'; g.font = '8px sans-serif'; g.fillText(ay > .5 ? '3-2 14 박준혁' : '3-2 07 이지은', -44, 10); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(-46, 11, 8, 2); g.restore(); }
    for (let i = 0; i < 2; i++) { const gx = X + r() * W, gy = Y + r() * H, gr = 2.5 + r() * 2.5; g.fillStyle = ['rgba(210,120,150,.85)', 'rgba(150,150,140,.85)'][i]; g.beginPath(); g.ellipse(gx, gy, gr, gr * .8, r() * 3, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(gx - 1, gy - 1, 1.5, 1); }   // 눌어붙은 껌
    g.restore(); }
}
const JOBS = { SchoolChair_01: chair, SchoolDesk_01: desk };
export function retexSchoolModel(name, scene) {
  const fn = JOBS[name]; if (!fn || typeof document === 'undefined') return;
  const seen = new Set(); scene.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && !seen.has(m)) { seen.add(m); try { repaint(m, fn); } catch (e) { console.warn('[retex]', name, e && e.message); } } });
}
