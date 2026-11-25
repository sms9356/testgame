// 생활감 소품(clutter) 공용 도구 + 앉을 자리 등록부
//   - clutterKit(): 정점 색 상자 · 원기둥 · 구를 모아 메시 하나(재질 하나, 그림자 없음)로 합친다 → 공간(층 · 건물)마다 드로콜 1개.
//     좌표 규칙은 world.js add() 와 같다: (x, y, z) = 바닥 가운데 (y = 밑면). ry/rz 는 물건 중심 기준 회전.
//     내장 GPU 프리셋(LITE)이면 아무것도 만들지 않는다 (호출 쪽에서 kit.lite 로 건너뛰어도 된다).
//   - hsh(x, z, k): 위치 해시 0..1 (같은 자리는 늘 같은 모습 — 시드 고정 변주)
//
// ── 앉을 자리 등록부 (window.__seats · RBG.seats) ──
//   다른 모듈(민아 앉기 등)이 쓰는 앉을 수 있는 자리 목록. 원소 하나:
//     { x, y, z, floor, yaw, kind, building, wy, src }
//       x, z   : 월드 좌표 — 앉은 사람 엉덩이(좌판 가운데)
//       y      : 좌판 윗면 높이. 그 층(floor)의 플레이어 높이 기준 = 재건축 본관 · 별관 · 신축 시설은 floor 0 위 절대 높이(층 × 3.6 + 좌판),
//                독립 공간(체육관 5 · 수영장 6 · 급식실 7)은 그 공간 바닥 기준(좌판 높이 그대로)
//       wy     : 렌더 월드 y (독립 공간은 공간 원점 y0 를 더한 값) — 메시를 바로 놓을 때
//       floor  : 게임 층 번호 (world.floors 인덱스 — 0 땅 · 5 체육관 · 6 수영장 · 7 급식실 …)
//       yaw    : 앉은 사람이 바라보는 방향 (게임 yaw 규칙: 바라보는 벡터 = (-sin yaw, -cos yaw), P.yaw 와 같다)
//       kind   : 'classChair' | 'chair' | 'officeChair' | 'bench' | 'sofa' | 'cafeBench' | 'loungeChair' | 'stool' | 'bleacher' | 'libraryChair' | 'auditorium' …
//       building: '본관' | '별관' | '체육관' | '수영장' | '급식실' | 시설 이름 …
//       src    : 등록한 묶음 키 (다시 지으면 같은 키 묶음을 통째로 바꾼다)
//   setSeats(src, list) 로 묶음을 넣고/바꾼다 (가구를 다시 지으면 같은 src 로 다시 부르면 된다). 배열 자체(window.__seats)는 늘 같은 객체라 참조를 들고 있어도 된다.
//   window.__seatsVersion 은 바뀔 때마다 +1, 'seats-changed' 이벤트(window)도 쏜다.
import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';

export const LITE = (() => { try { return /[?&]igpu\b/.test(location.search) || JSON.parse(localStorage.getItem('haegyo_set') || '{}').quality === 'igpu'; } catch (e) { return false; } })();
export const hsh = (x, z, k = 0) => { const v = Math.sin(x * 12.9898 + z * 78.233 + k * 37.719) * 43758.5453; return v - Math.floor(v); };
export const shade = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return c; };

let MAT = null;
const clutterMat = () => MAT || (MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, metalness: 0 }));

export function clutterKit(name = 'clutter') {
  const list = [];
  const put = (g, col, x, y, z, ry = 0, rz = 0, rx = 0) => {
    if (LITE) return; if (g.index) g = g.toNonIndexed();
    if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); if (ry) g.rotateY(ry); g.translate(x, y, z);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const c = col && col.isColor ? col : new THREE.Color(col), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); list.push(g); };
  const K = {
    lite: LITE, get n() { return list.length; },
    geo: put,
    box: (w, h, d, col, x, y, z, ry = 0, rz = 0, rx = 0) => put(new THREE.BoxGeometry(w, h, d), col, x, y + h / 2, z, ry, rz, rx),
    cyl: (rt, rb, h, col, x, y, z, seg = 10, ry = 0, rz = 0, rx = 0) => put(new THREE.CylinderGeometry(rt, rb, h, seg), col, x, y + h / 2, z, ry, rz, rx),
    // 눕힌 원기둥 (축 = x 또는 z): (x, y, z) = 원기둥 중심
    cylX: (r, L, col, x, y, z, seg = 10) => put(new THREE.CylinderGeometry(r, r, L, seg), col, x, y, z, 0, Math.PI / 2),
    cylZ: (r, L, col, x, y, z, seg = 10) => put(new THREE.CylinderGeometry(r, r, L, seg), col, x, y, z, 0, 0, Math.PI / 2),
    sph: (r, col, x, y, z, ws = 8, hs = 6) => put(new THREE.SphereGeometry(r, ws, hs), col, x, y, z),
    torus: (R, r, col, x, y, z, rx = 0, ry = 0, seg = 16) => put(new THREE.TorusGeometry(R, r, 6, seg), col, x, y, z, ry, 0, rx),
    // 합쳐서 parent 에 붙인다 (없으면 메시만 돌려준다). 그림자 끔 · dynamic (bakeStatic 이 다시 묶지 않게)
    finish(parent) { if (!list.length) return null; const g = mergeGeometries(list, false); list.length = 0; if (!g) return null; g.computeBoundingSphere();
      const m = new THREE.Mesh(g, clutterMat()); m.name = name; m.castShadow = false; m.receiveShadow = true; m.userData.dynamic = true; m.userData.clutter = true; if (parent) parent.add(m); return m; },
  };
  return K;
}

// ── 앉을 자리 ──
const SEATS = (typeof window !== 'undefined' && Array.isArray(window.__seats)) ? window.__seats : [];
const GROUPS = new Map();
if (typeof window !== 'undefined') { window.__seats = SEATS; window.__seatsVersion = window.__seatsVersion || 0; }
export function setSeats(src, list) {
  GROUPS.set(src, list.map(s => ({ ...s, src })));
  SEATS.length = 0; for (const L of GROUPS.values()) for (const s of L) SEATS.push(s);
  if (typeof window !== 'undefined') { window.__seatsVersion++; try { window.dispatchEvent(new Event('seats-changed')); } catch (e) {} }
  return SEATS;
}
export const allSeats = () => SEATS;
// ── 캔버스 판 ──
const FONT = "'Noto Sans KR','Noto Sans CJK KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif";
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
// 급식실 주간 식단 칠판 (2008년 10월 넷째 주 — 10/20 월 ~ 10/24 금)
let MENU = null;
export function cafeMenuTexture() {
  return MENU || (MENU = canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = '#23352a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8b890'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#f4f0d8'; g.textAlign = 'center'; g.font = `bold 30px ${FONT}`; g.fillText('이번 주 식단 (10월 20일 ~ 24일)', w / 2, 46);
    const D = [['월', '흑미밥 · 미역국 · 돈육장조림 · 깍두기'], ['화', '카레라이스 · 계란국 · 단무지무침 · 배추김치'], ['수', '잡곡밥 · 된장찌개 · 고등어구이 · 시금치나물'], ['목', '자장면 · 짬뽕국 · 군만두 · 요구르트'], ['금', '비빔밥 · 콩나물국 · 동그랑땡 · 사과']];
    g.textAlign = 'left'; D.forEach(([d, m], i) => { const y = 100 + i * 56; g.fillStyle = i === 3 ? '#ffd860' : '#f0e8c8'; g.font = `bold 26px ${FONT}`; g.fillText(d, 26, y); g.font = `22px ${FONT}`; g.fillStyle = '#e8e4d4'; g.fillText(m, 70, y); });
    g.fillStyle = '#e8b8a0'; g.font = `18px ${FONT}`; g.fillText('* 우유는 2교시 후 · 알레르기 표시 확인', 26, h - 20);
  }));
}
// 세로 현수막 여러 장을 텍스처 한 장에: bannerAtlas([[글, 바탕, 글색], …]) → { mat, geo(i, w, h) } (평면 하나 = UV 칸 하나 → 합쳐서 메시 하나)
export function bannerAtlas(list) {
  const n = list.length, cw = 128, ch = 512;
  const map = canvasTex(cw * n, ch, (g) => { list.forEach(([txt, bg, fg], i) => { const x0 = i * cw; g.fillStyle = bg; g.fillRect(x0, 0, cw, ch); g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(x0 + 8, 8, cw - 16, ch - 16);
    g.fillStyle = fg; g.textAlign = 'center'; const chars = [...txt], fs = Math.min(64, (ch - 60) / chars.length); g.font = `bold ${fs | 0}px ${FONT}`; chars.forEach((c, k) => g.fillText(c, x0 + cw / 2, 40 + fs * .85 + k * fs)); }); });
  const mat = new THREE.MeshStandardMaterial({ map, roughness: .9, side: THREE.DoubleSide });
  return { mat, geo(i, w, h) { const gg = new THREE.PlaneGeometry(w, h), uv = gg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / n); return gg; } };
}
// 가장 가까운 빈 자리 찾기 (도우미): taken(seat) 이 true 면 건너뛴다
export function nearestSeat(x, z, floor, { maxDist = 30, kind = null, taken = null } = {}) {
  let best = null, bd = maxDist;
  for (const s of SEATS) { if (s.floor !== floor || (kind && s.kind !== kind) || (taken && taken(s))) continue; const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } }
  return best;
}
