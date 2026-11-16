// 부속시설 2차 디테일 (2008 · 장식 전용): 체육관(5) · 수영장(6) · 급식실(7) 식당 쪽 · B1(4) 복도 설비 · 경비실 벽 소품 · 구령대
//   이야기 장치 · 문 · 스위치 · 조명 · 충돌 판정은 건드리지 않는다. 새 광원 · 그림자 없음 — 층(그룹)마다 재질별로 합친 메시만 더한다.
//   벽에 붙는 판(두께 ≤ 0.12m)은 기존 벽 충돌 안쪽이라 충돌을 더하지 않고, 바닥에 서는 큰 물건(공 수레 · 감시탑 의자 · 잔반통)만 충돌 상자를 둔다.
import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';

const MAT = {};
const M = (k, c, r = .6, m = 0, o = {}) => MAT[k] || (MAT[k] = new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...o }));
const P = {
  steel: () => M('steel', 0x8a9296, .4, .7), dark: () => M('dark', 0x22262a, .5, .4), pad: () => M('pad', 0x1e3f66, .75), padW: () => M('padW', 0x2a5084, .85),
  wood: () => M('wood', 0x9a6a3c, .55), rope: () => M('rope', 0xc8b88a, .95), black: () => M('black', 0x121416, .5, .2), red: () => M('red', 0xa81c18, .5, .2),
  yellow: () => M('yellow', 0xd8b020, .55), white: () => M('white', 0xe8e6e0, .55), velvet: () => M('velvet', 0x5a0e16, .95), orange: () => M('orange', 0xc05a1c, .7),
  amber: () => M('amber', 0x3a1a08, .3, 0, { emissive: 0xff7a18, emissiveIntensity: .9 }), puddle: () => M('puddle', 0x0e1012, .04, .3), stain: () => M('stain', 0x3a3228, .95),
  pipeR: () => M('pipeR', 0x8a2018, .5, .4), pipeB: () => M('pipeB', 0x2a4a7a, .5, .4), pipeG: () => M('pipeG', 0x5a6a5a, .5, .4), blue: () => M('blue', 0x2a5aa8, .6),
  grate: () => M('grate', 0x2a2c2e, .4, .7), conc: () => M('conc', 0x9a9890, .9), lineW: () => M('lineW', 0xf2f0e6, .6),
};
const SIGN = {};
function signMat(text, sub, bg, fg, w = 512, h = 160) {
  const key = [text, sub, bg, fg, w, h].join('|'); if (SIGN[key]) return SIGN[key];
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.globalAlpha = .6; g.lineWidth = 5; g.strokeRect(8, 8, w - 16, h - 16); g.globalAlpha = 1;
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(h * (sub ? .36 : .5))}px "Noto Sans KR", sans-serif`; g.fillText(text, w / 2, sub ? h * .38 : h / 2, w - 30);
  if (sub) { g.font = `500 ${Math.round(h * .2)}px "Noto Sans KR", sans-serif`; g.fillText(sub, w / 2, h * .76, w - 30); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (SIGN[key] = new THREE.MeshBasicMaterial({ map: t, color: 0xd8d6cc }));
}

class Kit {
  constructor(parent, col) { this.parent = parent; this.col = col; this.b = {}; }
  put(k, g, x, y, z, rx = 0, ry = 0, rz = 0) { g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1))); (this.b[k] ||= []).push(g.index ? g.toNonIndexed() : g); }
  box(k, w, h, d, x, y, z, rx, ry, rz) { this.put(k, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz); }
  cyl(k, r1, r2, h, x, y, z, rx, ry, rz, seg = 10) { this.put(k, new THREE.CylinderGeometry(r1, r2, h, seg), x, y, z, rx, ry, rz); }
  tor(k, R, r, x, y, z, rx, ry) { this.put(k, new THREE.TorusGeometry(R, r, 5, 16), x, y, z, rx, ry); }
  sign(text, sub, bg, fg, w, h, x, y, z, ry, rx = 0) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signMat(text, sub, bg, fg)); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.userData.dynamic = true; this.parent.add(m); }
  done() { for (const [k, list] of Object.entries(this.b)) { const g = mergeGeometries(list.map(q => { const n = q.clone(); for (const a of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(a)) n.deleteAttribute(a); return n; }), false); if (!g) continue; g.computeBoundingSphere();
    const m = new THREE.Mesh(g, P[k]()); m.userData.dynamic = true; m.receiveShadow = true; m.name = 'fd2_' + k; this.parent.add(m); } this.b = {}; }
}
const addCol = (F, x1, x2, z1, z2, h) => { const r = { x1, x2, z1, z2 }; if (h != null) r.h = h; F.col.push(r); return r; };

function gym(F) {   // 5층 공간: x 28 ~ 48, z 8 ~ 30, 천장 8m · 무대 북측(z 8.3 ~ 12.3) · 동측 관람석 · 남측 출입문 36.5 ~ 39.5
  const K = new Kit(F.interior);
  // 무대 앞면 안전 쿠션 (북쪽 골대 밑) · 이음 띠
  for (let x = 34.6; x <= 41.4; x += 1.4) { K.box('pad', 1.34, .9, .07, x, .55, 12.34); K.box('padW', 1.34, .04, .072, x, .98, 12.34); }
  // 서쪽 벽 늑목 (z 20.6 ~ 24.2): 기둥 + 가로대 16
  for (let z = 20.6; z <= 24.21; z += .9) K.box('wood', .08, 2.6, .08, 28.36, 1.3, z);
  for (let k = 0; k < 16; k++) [20.6, 21.5, 22.4, 23.3].forEach(z => K.cyl('wood', .018, .018, .82, 28.38, .2 + k * .15, z + .45, Math.PI / 2));
  // 천장 트러스(z 22)에서 내린 오르기 밧줄 3 · 끝 매듭
  [30.9, 31.5, 32.1].forEach(x => { K.cyl('rope', .022, .022, 7.0, x, 3.95, 22); K.cyl('rope', .04, .03, .14, x, .48, 22); K.box('steel', .12, .06, .12, x, 7.42, 22); });
  // 전광 점수판 (남벽 출입문 위): 함체 · HOME / GUEST 숫자 칸(호박색) · 가운데 시계
  K.box('black', 2.6, 1.15, .12, 38, 5.7, 29.62); K.box('steel', 2.7, .06, .14, 38, 6.3, 29.62);
  [[-.85, 0], [.85, 0]].forEach(([dx]) => { for (let d = 0; d < 2; d++) K.box('amber', .26, .42, .01, 38 + dx + (d - .5) * .32, 5.55, 29.555); }); for (let d = 0; d < 4; d++) K.box('amber', .14, .24, .01, 38 - .3 + d * .2, 5.95, 29.555);
  K.sign('HOME', '', '#121416', '#f0e4c0', .6, .14, 37.15, 5.95, 29.55, Math.PI); K.sign('GUEST', '', '#121416', '#f0e4c0', .6, .14, 38.85, 5.95, 29.55, Math.PI);
  // 공 수레 (남서쪽 · 쿠션 앞): 철망 바구니 + 바퀴 + 농구공 · 배구공
  { const x = 33.0, z = 29.15; K.box('steel', .9, .03, .52, x, .3, z); [-1, 1].forEach(s => { K.box('steel', .9, .5, .02, x, .55, z + s * .26); K.box('steel', .02, .5, .52, x + s * .45, .55, z); });
    for (let i = 0; i < 4; i++) K.box('steel', .02, .5, .52, x - .3 + i * .2, .55, z); [[-.4, -.22], [.4, -.22], [-.4, .22], [.4, .22]].forEach(([a, b]) => K.cyl('black', .05, .05, .04, x + a, .05, z + b, Math.PI / 2));
    for (let i = 0; i < 6; i++) K.put(i % 2 ? 'orange' : 'white', new THREE.SphereGeometry(.12, 10, 8), x - .3 + (i % 3) * .3, .45 + (i > 2 ? .22 : 0), z + (i % 2 ? .08 : -.08)); addCol(F, x - .48, x + .48, z - .3, z + .3, .82); }
  // 무대 커튼 주름 (세로 접힘 · 커튼 판 앞 8cm)
  [[29.4, 35.6], [40.4, 46.6]].forEach(([a, b]) => { for (let x = a; x <= b; x += .42) K.box('velvet', .26, 5.1, .08, x, 3.7, 8.52 + ((Math.round(x * 10) % 2) ? .03 : 0)); });
  // 코트 선 닳음: 자주 밟는 자리(골밑 · 중앙)의 바랜 흰 칠 조각
  for (let k = 0; k < 18; k++) { const x = 32 + (k * 3.7) % 12, z = 14 + (k * 5.3) % 13; K.box('lineW', .3 + (k % 4) * .12, .002, .05, x, .012, z, 0, (k % 5) * .6); }
  K.done();
}

function pool(F) {   // 6층 공간: x -50 ~ -34, z 20 ~ 58 · 수조 x -45.6 ~ -37.4, z 32 ~ 45.5 · 동벽 출입문 z 37 ~ 39 · 서측 관람석 z 37.4 ~ 46.6
  const K = new Kit(F.interior);
  // 천장 철골 트러스 (경간 16m · 4m 간격) + 사재
  for (let z = 22; z <= 56; z += 4) { K.box('steel', 15.4, .22, .16, -42, 6.1, z); K.box('steel', 15.4, .08, .08, -42, 5.65, z); for (let x = -49; x < -34.5; x += 1.4) K.box('steel', .05, .52, .05, x, 5.88, z, 0, 0, .7); }
  // 수조 바닥 레인 끝 T 표시 (출발벽 쪽)
  const LW = 8.2 / 4; for (let k = 0; k < 4; k++) { const x = -45.6 + (k + .5) * LW; [32.9, 44.6].forEach(z => K.box('black', 1.0, .01, .16, x, -1.585, z)); }
  // 데크 가장자리 수심 표시 (빨강 숫자 타일) · 동벽 수심 표시판
  [[32.3, '1.2m'], [45.2, '1.6m']].forEach(([z, d]) => { [-45.9, -37.1].forEach(x => K.sign(d, '', '#efeee8', '#b01818', .34, .16, x, .012, z, 0, -Math.PI / 2)); K.sign('수심 ' + d, 'DEPTH', '#efeee8', '#b01818', .7, .34, -34.68, 1.25, z, -Math.PI / 2); });
  // 미끄럼 주의 · 뛰지 마시오 (동벽 · 남벽)
  K.sign('미끄럼 주의', '젖은 바닥 · 뛰지 마시오', '#f2d21a', '#1a1a1a', 1.2, .5, -34.68, 2.1, 42.5, -Math.PI / 2);
  K.sign('수영장 안전수칙', '준비운동 · 샤워 후 입수 · 다이빙 금지', '#e8f0f4', '#1a3a6a', 1.6, .7, -45.0, 2.0, 20.32, 0);
  // 데크 배수구 그레이팅 (모서리 · 샤워 쪽)
  [[-47.0, 30.5], [-36.0, 30.5], [-36.0, 47.0], [-47.0, 47.2], [-42, 51.5]].forEach(([x, z]) => { K.box('grate', .5, .012, .5, x, .014, z); for (let i = 0; i < 6; i++) K.box('black', .44, .014, .02, x, .016, z - .2 + i * .08); });
  K.done();
}

function cafe(F) {   // 7층 공간: x -48 ~ -30, z 8 ~ 22 · 식당 z 12.4 ~ 22 · 남벽 출입문 x -39
  const K = new Kit(F.interior);
  // 남벽 게시물: 영양 포스터 · 급식 예절 · 10월 식단표
  K.sign('골고루 먹어요', '탄수화물 · 단백질 · 채소 · 우유', '#f4ecd8', '#2a5a2a', 1.0, .7, -44.6, 1.75, 21.68, Math.PI);
  K.sign('급식 예절', '줄 서기 · 남기지 않기 · 식판 정리', '#e8f0f4', '#1a3a6a', 1.0, .7, -34.0, 1.75, 21.68, Math.PI);
  K.sign('2008년 10월 식단', '쌀밥 · 국 · 김치 · 반찬 2 · 우유', '#fbfaf4', '#3a2416', 1.2, .8, -32.2, 1.75, 21.68, Math.PI);
  [-44.6, -34.0, -32.2].forEach(x => K.box('dark', x === -32.2 ? 1.26 : 1.06, x === -32.2 ? .86 : .76, .02, x, 1.75, 21.70));
  // 잔반통 (퇴식구 옆 · 파란 플라스틱 통 + 뚜껑 + 국자) · 바닥 얼룩
  { const x = -30.85, z = 19.55; K.cyl('blue', .28, .25, .62, x, .31, z, 0, 0, 0, 16); K.cyl('blue', .3, .3, .04, x, .64, z, 0, 0, 0, 16); K.cyl('steel', .012, .012, .5, x - .1, .8, z, 0, 0, .4); addCol(F, x - .3, x + .3, z - .3, z + .3, .66);
    K.sign('잔반', '', '#2a5aa8', '#ffffff', .3, .12, x, .45, z - .262, Math.PI); }
  [[-31.2, 13.9], [-31.0, 17.5], [-36.5, 13.2]].forEach(([x, z], k) => K.cyl('stain', .3 + k * .08, .3 + k * .08, .003, x, .021, z, 0, 0, 0, 14));
  K.done();
}

function basement(F) {   // B1 복도 (x ±36 · 북벽 z -1.43 · 천장 3.6): 케이블 트레이 · 배관 + 밸브 · 표지 띠 · 물웅덩이
  const K = new Kit(F.interior);
  K.box('steel', 60, .03, .3, 0, 3.22, -1.18); [-1, 1].forEach(s => K.box('steel', 60, .08, .02, 0, 3.26, -1.18 + s * .15)); for (let x = -29; x <= 29; x += 1.5) K.box('steel', .03, .3, .03, x, 3.42, -1.18);
  for (let x = -29; x <= 29; x += .9) K.box('black', .6, .03, .04, x, 3.255, -1.18 + ((x * 7) % 3 - 1) * .06, 0, .1);   // 트레이 위 케이블 묶음
  [['pipeR', 3.35], ['pipeB', 3.18], ['pipeG', 3.0]].forEach(([k, y], i) => { K.cyl(k, .055, .055, 60, 0, y, 1.22 - i * .02, 0, 0, Math.PI / 2, 12);
    for (let x = -27; x <= 27; x += 6) { K.cyl('steel', .072, .072, .06, x, y, 1.22 - i * .02, 0, 0, Math.PI / 2); } });
  for (let x = -24; x <= 24; x += 12) { [['pipeR', 3.35, '소화', '#a01818'], ['pipeB', 3.18, '급수', '#1a3a7a'], ['pipeG', 3.0, '난방', '#3a5a3a']].forEach(([k, y, t, c]) => K.sign(t + ' →', '', c, '#ffffff', .3, .1, x + .5, y, 1.155, Math.PI));
    K.cyl('steel', .012, .012, .14, x, 3.22, 1.12, Math.PI / 2); K.tor('red', .09, .012, x, 3.22, 1.05, 0, 0); }
  [[-18, .2, .9], [-4, -.4, .6], [9, .3, 1.1], [22, -.2, .7]].forEach(([x, z, r]) => { K.put('puddle', new THREE.CircleGeometry(r, 18), x, .013, z, -Math.PI / 2); K.put('stain', new THREE.CircleGeometry(r * 1.25, 18), x + .1, .011, z, -Math.PI / 2); });
  K.done();
}

function guard(G) {   // 당직실 벽 소품만 (금고 · CCTV · 문 · 무전기 · 일지 동작은 그대로): 출입문 안 매트 (동벽 열쇠함은 기존 보관함과 겹쳐 뺐다)
  if (!G) return; const K = new Kit(G);
  K.box('grate', .78, .012, .5, 6.97, .028, 67.45);
  K.done();
}

function grounds(OUT) {   // 구령대 (x -11 · z 18.6 · 6 × 3 × 1.1m): 계단 미끄럼방지 노란 띠 · 앞면 화강석 띠 · 교훈 판 · 빗물 얼룩
  if (!OUT) return; const K = new Kit(OUT); const x0 = -11, z0 = 18.6, W = 6, D = 3, H = 1.1, sx = x0 + W / 2 - 1.0;
  for (let k = 0; k < 5; k++) { const h = (k + 1) * H / 5, zf = z0 + D / 2 + (4 - k) * .32; K.box('yellow', 1.6, .012, .05, sx, h + .006, zf - .04); }
  K.box('conc', W + .04, .08, .06, x0, H - .04, z0 + D / 2 + .02); K.box('conc', W + .04, .12, .06, x0, .06, z0 + D / 2 + .02);
  K.sign('성실 · 창의 · 봉사', '서린고등학교 교훈', '#2a2420', '#d8c890', 1.4, .4, x0 - 1.9, H / 2, z0 + D / 2 + .012, 0);
  for (let k = 0; k < 5; k++) K.box('stain', .3 + k * .07, .5, .004, x0 - 2.6 + k * 1.3, .45, z0 + D / 2 + .052);
  K.done();
}

export function installFacilityDetail2({ scene, floors, world }) {
  const t0 = performance.now(), ran = [];
  const run = (n, f) => { try { f(); ran.push(n); } catch (e) { console.warn('[facility detail2]', n, e); } };
  if (floors[5]) run('gym', () => gym(floors[5])); if (floors[6]) run('pool', () => pool(floors[6])); if (floors[7]) run('cafe', () => cafe(floors[7])); if (floors[4]) run('b1', () => basement(floors[4]));
  run('guard', () => guard(scene.getObjectByName('GUARD_ANNEX')));
  run('grounds', () => { const g = new THREE.Group(); g.name = 'FD2_GROUNDS'; g.userData.facKeep = true; scene.add(g); grounds(g); });
  window.__facilityDetail2 = { ran, ms: Math.round(performance.now() - t0) };
}
