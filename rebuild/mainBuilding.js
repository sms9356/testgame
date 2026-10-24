// 재건축 본관 (2008년 한국 공립 고등학교 표준 설계 기준)
//   남향 교실 + 북측 편복도, 철근콘크리트 라멘조(기둥 9m 간격), 층고 3.6m · 반자높이 2.7m
//   교실 9.0m × 7.5m, 복도 폭 2.7m, 양 끝 U자 계단실(6m × 9m), 중앙 화장실 · 세면대 코어
//   전기(분전반 · 2등용 형광등 · 콘센트 · 스위치) · 소방(소화전함 · 소화기 · 감지기 · 유도등 · 방화문) · 수도(세면대 · 배관)
import * as THREE from '../vendor/three.module.js';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';

export const DESK_RY = Math.PI / 2, CHAIR_RY = Math.PI / 2;   // 모델 정면 보정 (스크린샷으로 맞춘다)
export const SPEC = {
  floors: 4, FH: 3.6, CEIL: 2.7, slab: .25,
  bay: 9, classDepth: 10, corridor: 3.6, wall: .2, outer: .3,   // 교실 9×10m · 복도 3.6m (건물 깊이 14m)
  stairW: 6, coreW: 9,           // 계단실 폭, 중앙 화장실 코어 폭
  classesPerSide: 4,              // 중앙 코어 좌우로 4교실씩 = 층당 8교실
};

// 배치: x 서→동  [계단 6][교실 ×4][코어 9][교실 ×4][계단 6] = 6+36+9+36+6 = 93m
// 층별 실 배치 (교실 칸 8개, 서→동). 1층 관리동 · 4층 특별실
export const ROOM_PLAN = [
  ['admin', 'principal', 'staff', 'staff', 'nurse', 'counsel', 'class', 'class'],
  ['class', 'class', 'class', 'class', 'class', 'class', 'class', 'class'],
  ['class', 'class', 'class', 'class', 'class', 'class', 'class', 'class'],
  ['bcast', 'bcast', 'science', 'class', 'class', 'class', 'library', 'library'],   // bcast 두 칸 = 칸막이 없는 18m 방송실 (예전 본관 방송실 설비를 그대로 옮겨 온다)
];
const ROOM_NAME = { bcast: '방송실', admin: '행정실', principal: '교장실', staff: '교무실', nurse: '보건실', counsel: '상담실', broadcast: '방송실', science: '과학실', library: '도서실', music: '음악실', art: '미술실', computer: '컴퓨터실', home: '가정실', study: '자율학습실' };
// 별관 (3층 · 층당 4실): 1층 예체능 · 2층 실습 · 3층 3학년 교실
export const ANNEX_SPEC = { floors: 3, classesPerSide: 2 };
export const ANNEX_PLAN = [
  ['music', 'art', 'computer', 'home'],
  ['science', 'science', 'library', 'study'],
  ['class', 'class', 'class', 'class'],
];
export function layout(S = SPEC, cs = null) {   // cs: 중앙 계단실을 코어 'east' / 'west' 옆에
  const rooms = [], L = S.stairW * 2 + S.coreW + S.bay * S.classesPerSide * 2 + (cs ? S.stairW : 0);
  let x = -L / 2;
  const push = (kind, w) => { rooms.push({ kind, x1: x, x2: x + w }); x += w; };
  push('stair', S.stairW);
  for (let i = 0; i < S.classesPerSide; i++) push('class', S.bay);
  if (cs === 'west') push('cstair', S.stairW); push('core', S.coreW); if (cs === 'east') push('cstair', S.stairW);
  for (let i = 0; i < S.classesPerSide; i++) push('class', S.bay);
  push('stair', S.stairW);
  const zS = S.classDepth, zC = 0, zN = -S.corridor;   // 교실: z 0..7.5 (남), 복도: z -2.7..0 (북)
  return { L, rooms, zS, zC, zN, depth: S.classDepth + S.corridor };
}

// ── 절차 텍스처 ──
function canvasTex(w, h, draw, rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const rnd = (() => { let s = 1234567; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const TEX = {
  woodFloor: () => canvasTex(512, 512, (g, w, h) => {   // 교실 마루 (참나무 플로어링, 폭 7.5cm 판)
    for (let y = 0; y < h; y += 32) { for (let x = -((y / 32) % 3) * 90; x < w; x += 270) {
      const v = 120 + rnd() * 40; g.fillStyle = `rgb(${v + 30},${v * .72 + 10},${v * .45})`; g.fillRect(x, y, 268, 30);
      g.strokeStyle = 'rgba(40,24,10,.12)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(x, y + 4 + k * 4 + rnd() * 2); g.bezierCurveTo(x + 90, y + rnd() * 30, x + 180, y + rnd() * 30, x + 268, y + 4 + k * 4); g.stroke(); } } }
    g.fillStyle = 'rgba(20,12,6,.55)'; for (let y = 30; y < h; y += 32) g.fillRect(0, y, w, 2);
  }),
  terrazzo: () => canvasTex(512, 512, (g, w, h) => {   // 복도 인조석 물갈기 (도끼다시) + 황동 줄눈
    g.fillStyle = '#b9b2a4'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 60 + rnd() * 160; g.fillStyle = `rgba(${v},${v * .95},${v * .88},${.5 + rnd() * .5})`; g.beginPath(); g.arc(rnd() * w, rnd() * h, .6 + rnd() * 2.4, 0, 7); g.fill(); }
    g.fillStyle = '#a08850'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
  }),
  ceiling: () => canvasTex(256, 256, (g, w, h) => {   // 600각 텍스 천장 (흡음 타공)
    g.fillStyle = '#e4e1d8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(90,85,75,${.15 + rnd() * .25})`; g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
    g.fillStyle = '#c8c4b8'; g.fillRect(0, 0, w, 4); g.fillRect(0, 0, 4, h);
  }),
  wall: () => canvasTex(256, 256, (g, w, h) => {   // 수성페인트 미장 벽 (상부 아이보리)
    g.fillStyle = '#e8e2d2'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { const v = 200 + rnd() * 40; g.fillStyle = `rgba(${v},${v - 6},${v - 18},.25)`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
  }),
  wainscot: () => canvasTex(256, 256, (g, w, h) => {   // 하부 1.2m 녹색 유성페인트 (징두리)
    g.fillStyle = '#5f7a62'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(30,50,35,${rnd() * .2})`; g.fillRect(rnd() * w, rnd() * h, 2, 3); }
  }),
  board: () => canvasTex(512, 256, (g, w, h) => {   // 녹색 칠판 + 분필 자국
    g.fillStyle = '#2f4a3a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 80; i++) { g.strokeStyle = `rgba(230,230,220,${rnd() * .08})`; g.lineWidth = 6 + rnd() * 18; g.beginPath(); g.moveTo(rnd() * w, rnd() * h); g.lineTo(rnd() * w, rnd() * h); g.stroke(); }
    g.fillStyle = 'rgba(240,240,230,.75)'; g.font = 'bold 34px serif'; g.fillText('10월 12일 (목)  주번: 윤하늘', 24, 52);
  }),
  concrete: () => canvasTex(256, 256, (g, w, h) => {   // 외벽 · 계단 노출 콘크리트
    g.fillStyle = '#a7a39a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { const v = 120 + rnd() * 80; g.fillStyle = `rgba(${v},${v},${v - 6},.3)`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
  }),
  brick: () => canvasTex(512, 256, (g, w, h) => {   // 외벽 적벽돌 치장쌓기
    g.fillStyle = '#d8d0c0'; g.fillRect(0, 0, w, h);
    for (let y = 0, r = 0; y < h; y += 16, r++) for (let x = (r % 2) * -32; x < w; x += 64) { const v = 120 + rnd() * 40; g.fillStyle = `rgb(${v + 40},${v * .55},${v * .4})`; g.fillRect(x + 1, y + 1, 62, 14); }
  }),
};

// ── 실사 PBR 재질 (assets/tex: Poly Haven CC0 스캔 + 구운 원본, map · normal · roughness) ──
const TL = new THREE.TextureLoader(), TCACHE = {};
function tx(file, srgb) {
  if (TCACHE[file]) return TCACHE[file];
  const t = TL.load(new URL('../assets/tex/' + file, import.meta.url).href); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; return (TCACHE[file] = t);
}
// name: 텍스처 세트, own: 색 맵도 실사로 쓸지 (false 면 절차 색 + 실사 노멀 · 거칠기만)
function pbr(name, { own = true, map = null, color = 0xffffff, nScale = 1, rough = 1, metal = 0 } = {}) {
  return new THREE.MeshStandardMaterial({ map: own ? tx(name + '_map.webp', true) : map, normalMap: tx(name + '_normal.webp'), normalScale: new THREE.Vector2(nScale, nScale),
    roughnessMap: tx(name + '_rough.webp'), roughness: rough, metalness: metal, color });
}
// 재질별 텍스처 1장이 덮는 실제 크기(m) — 상자 UV 를 이 값으로 나눈다
const UVM = { deskTop: 3, wood: 2.2, terr: 2.4, ceil: 1.2, wall: 2.5, wain: 2.5, conc: 2.5, brick: 1.6, stepc: 1.6, tile: 1.2, twall: 1.2, lockerM: 1.2, door: 1.0, steelG: 1.2, facade: 3 };

export function buildMainBuilding(opt = {}) {
  const S = { ...SPEC, ...(opt.spec || {}) }, PLAN = opt.plan || ROOM_PLAN, LY = layout(S, opt.centerStair || null), root = new THREE.Group(); root.name = opt.name || 'REBUILD_MAIN';
  const csR = LY.rooms.find(r => r.kind === 'cstair'), ELX = csR ? (csR.x1 + csR.x2) / 2 : 3.7;   // 엘리베이터: 중앙 계단실 앞 (없으면 x 3.7)
  const OX = opt.x || 0, OZ = opt.z || 0, RY = opt.ry || 0, cR = Math.cos(RY), sR = Math.sin(RY);
  root.position.set(OX, 0, OZ); root.rotation.y = RY;
  const col = [];      // 충돌 AABB {x1,x2,z1,z2,y1,y2}
  const walk = [];     // 보행면 {x1,x2,z1,z2, h:(x,z)=>y}
  const props = [];    // 상호작용 지점 {kind,label,x,y,z,floor}
  const lights = [];   // 형광등 위치 (게임 쪽 조명 예산이 고른다)
  const geo = new Map();  // 재질키 → 지오메트리 목록 (끝에서 병합 → 드로콜 최소화)
  const mats = {}, stairwells = [], doors = [], models = []; let s_sci = 0, s_lib = 0, s_staff = 0; let y_ = 0, rmx = 0, rmz = 0, bseed = 7; const br = () => (bseed = (bseed * 16807) % 2147483647) / 2147483647;   // rmx/rmz: 지금 꾸미는 방의 중심
  const mdl = (name, x, y, z, ry = 0, o = {}) => models.push({ name, x, y, z, ry, ...o });
  const M = (key, make) => mats[key] || (mats[key] = make());
  const mat = {
    wood: M('wood', () => pbr('wood', { rough: .9 })),                                   // 노후 참나무 마루 (실사)
    terr: M('terr', () => pbr('tile', { rough: .8 })),                                   // 인조석 물갈기 · 모자이크 (실사)
    ceil: M('ceil', () => pbr('ceil', { own: false, map: TEX.ceiling(), nScale: .6 })),  // 텍스 천장: 색은 밝게, 요철은 실사
    wall: M('wall', () => pbr('paint', { own: false, map: TEX.wall(), nScale: .5, rough: 1 })),       // 아이보리 수성 페인트 + 실사 요철
    wain: M('wain', () => pbr('d2_tex_paint', { own: false, map: TEX.wainscot(), nScale: .7, rough: .75 })),   // 녹색 유성 페인트 (벗겨진 요철)
    conc: M('conc', () => pbr('step', { rough: 1 })),                                   // 콘크리트 (실사)
    brick: M('brick', () => pbr('brick', { rough: .95 })),                              // 적벽돌 (실사)
    board: M('board', () => new THREE.MeshStandardMaterial({ map: TEX.board(), roughness: .8 })),
    alu: M('alu', () => new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: .35, metalness: .7 })),
    glass: M('glass', () => new THREE.MeshStandardMaterial({ color: 0xbfd6dc, roughness: .08, metalness: .1, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide })),   // 투과(transmission) 굴절은 장면을 한 번 더 그리고 흐릿한 바닥 번짐을 만든다 → 반투명 유리
    steelG: M('steelG', () => pbr('d2_tex_paint', { color: 0xa8b8ac, rough: .7, metal: .35 })),   // 도장 철판 (분전반 · 방화문 · 캐비닛)
    red: M('red', () => new THREE.MeshStandardMaterial({ color: 0xb2201c, roughness: .45, metalness: .2 })),
    white: M('white', () => new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: .6 })),
    lamp: M('lamp', () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f6ff, emissiveIntensity: 1.4 })),
    exitG: M('exitG', () => new THREE.MeshStandardMaterial({ color: 0x1fa64a, emissive: 0x1fa64a, emissiveIntensity: 1.2 })),
    deskTop: M('deskTop', () => new THREE.MeshStandardMaterial({ map: tx('d2_th102_wood_edge_BaseColor.webp', true), normalMap: tx('d2_th102_wood_edge_Normal.webp'), normalScale: new THREE.Vector2(.35, .35), roughness: .62, color: 0xffd9a8 })),   // 합판 상판
    deskLeg: M('deskLeg', () => new THREE.MeshStandardMaterial({ color: 0x3d4a44, roughness: .45, metalness: .6 })),
    book0: M('book0', () => new THREE.MeshStandardMaterial({ color: 0x7a2a22, roughness: .8 })), book1: M('book1', () => new THREE.MeshStandardMaterial({ color: 0x23406a, roughness: .8 })),
    book2: M('book2', () => new THREE.MeshStandardMaterial({ color: 0x2f5a36, roughness: .8 })), book3: M('book3', () => new THREE.MeshStandardMaterial({ color: 0xc8b48a, roughness: .85 })),
    crt: M('crt', () => new THREE.MeshStandardMaterial({ color: 0xd2cab4, roughness: .55 })), screen: M('screen', () => new THREE.MeshStandardMaterial({ color: 0x0c1014, roughness: .15, metalness: .2 })),
    cork: M('cork', () => new THREE.MeshStandardMaterial({ color: 0x9a7448, roughness: 1 })),
    curtain: M('curtain', () => new THREE.MeshStandardMaterial({ color: 0x9fbfb6, roughness: .95, side: THREE.DoubleSide })),
    porc: M('porc', () => new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: .15 })),
    tile: M('tile', () => pbr('tfloor', { rough: .7 })),                                // 화장실 바닥 타일 (실사)
    rubber: M('rubber', () => new THREE.MeshStandardMaterial({ color: 0x3a3a38, roughness: .8 })),
    lockerM: M('lockerM', () => pbr('varnish', { rough: .8 })),                          // 니스 칠 나무 (사물함 · 문 · 서가)
  };
  const uvBox = (w, h, d, u = 1) => { const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv, n = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)); const sw = ax > .5 ? d : w, sh = ay > .5 ? d : h; uv.setXY(i, uv.getX(i) * sw / u, uv.getY(i) * sh / u); } return g; };
  const box = (key, x1, x2, y1, y2, z1, z2, { solid = false, u = UVM[key] || 1 } = {}) => {
    const w = x2 - x1, h = y2 - y1, d = z2 - z1; if (w <= 0 || h <= 0 || d <= 0) return;
    const g = uvBox(w, h, d, u); g.translate((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    (geo.get(key) || geo.set(key, []).get(key)).push(g);
    if (solid) col.push({ x1, x2, z1, z2, y1, y2 });
  };
  const yf = f => f * S.FH;
  // ── 세부 형상 빌더: 상자 하나로 때우던 가구를 실제 부품(문짝 · 손잡이 · 다리 · 리브)으로 짓는다 ──
  const G = (key, g) => (geo.get(key) || geo.set(key, []).get(key)).push(g);
  const cyl = (key, x, y, z, r, h, r2 = r, seg = 12) => { const g = new THREE.CylinderGeometry(r2, r, h, seg); g.translate(x, y + h / 2, z); G(key, g); };
  // 라디에이터: 세로 리브 + 상하 헤더관 + 받침다리
  const radiator = (xa, xb, y, za, zb) => { for (let x = xa; x <= xb; x += .065) box('white', x - .022, x + .022, y + .05, y + .58, za, zb); box('white', xa, xb, y + .55, y + .6, za + .01, zb - .01); box('white', xa, xb, y + .03, y + .08, za + .01, zb - .01); [xa + .05, xb - .05].forEach(x => box('alu', x - .015, x + .015, y - .15, y + .03, (za + zb) / 2 - .015, (za + zb) / 2 + .015)); };
  // 캐비닛: 받침 + 몸체 + 문짝 2~4(틈) + 손잡이 + 상판 — front: 앞면 방향 ('x+','x-','z+','z-')
  const cabinetD = (x1, x2, z1, z2, y, h, key, front, glassTop = false) => {
    box(key, x1 + .01, x2 - .01, y + .08, y + h - .03, z1 + .01, z2 - .01, { solid: true }); box('rubber', x1 + .03, x2 - .03, y, y + .08, z1 + .03, z2 - .03); box(key, x1, x2, y + h - .03, y + h, z1, z2);
    const alongX = front[0] === 'z', len = alongX ? x2 - x1 : z2 - z1, n = Math.max(2, Math.round(len / .5)), fs = front[1] === '+' ? 1 : -1;
    const fx = front[0] === 'x' ? (fs > 0 ? x2 : x1) : 0, fz = front[0] === 'z' ? (fs > 0 ? z2 : z1) : 0;
    for (let k = 0; k <= n; k++) { const t = (alongX ? x1 : z1) + k * len / n;   // 문짝 틈 (어두운 줄)
      if (alongX) box('rubber', t - .004, t + .004, y + .1, y + h - .05, Math.min(fz, fz + fs * .006), Math.max(fz, fz + fs * .006)); else box('rubber', Math.min(fx, fx + fs * .006), Math.max(fx, fx + fs * .006), y + .1, y + h - .05, t - .004, t + .004); }
    box('rubber', alongX ? x1 : Math.min(fx, fx + fs * .006), alongX ? x2 : Math.max(fx, fx + fs * .006), y + h * .45 - .004, y + h * .45 + .004, alongX ? Math.min(fz, fz + fs * .006) : z1, alongX ? Math.max(fz, fz + fs * .006) : z2);   // 상 · 하 칸 나눔
    for (let k = 0; k < n; k++) { const t = (alongX ? x1 : z1) + (k + .5) * len / n + (k % 2 ? -.12 : .12) * len / n;   // 손잡이
      [y + h * .45 + .12, y + h * .45 - .12].forEach(hy => alongX ? box('alu', t - .01, t + .01, hy - .05, hy + .05, Math.min(fz, fz + fs * .03), Math.max(fz, fz + fs * .03)) : box('alu', Math.min(fx, fx + fs * .03), Math.max(fx, fx + fs * .03), hy - .05, hy + .05, t - .01, t + .01)); }
    if (glassTop) alongX ? box('glass', x1 + .03, x2 - .03, y + h * .48, y + h - .06, Math.min(fz, fz + fs * .01), Math.max(fz, fz + fs * .01)) : box('glass', Math.min(fx, fx + fs * .01), Math.max(fx, fx + fs * .01), y + h * .48, y + h - .06, z1 + .03, z2 - .03);
  };
  // 교실 뒤 개인 사물함: 3단 × n열 칸 · 칸마다 문 틈 · 이름표 · 손잡이
  const lockerWall = (x, zA, zB, y, h, faceX) => { const n = Math.round((zB - zA) / .36); box('lockerM', x - .42, x, y, y + h, zA, zB, { solid: true });
    for (let r = 0; r < 3; r++) for (let k = 0; k < n; k++) { const za = zA + k * (zB - zA) / n, zb = za + (zB - zA) / n, ya = y + r * h / 3, yb = ya + h / 3, fx = x - .42;
      box('rubber', fx - .006, fx, ya, ya + .006, za, zb); box('rubber', fx - .006, fx, ya, yb, zb - .005, zb); box('white', fx - .008, fx, yb - .1, yb - .06, za + .05, za + .14); box('alu', fx - .025, fx, ya + h / 6 - .02, ya + h / 6 + .02, zb - .07, zb - .05); } };
  // 교탁: 앞판 · 옆판 · 경사 상판 · 안쪽 선반
  const lectern = (x, z, y) => { box('lockerM', x - .3, x + .3, y, y + .95, z - .45, z - .42, { solid: true }); box('lockerM', x - .3, x + .3, y, y + .95, z + .42, z + .45); box('lockerM', x - .33, x - .3, y, y + .98, z - .45, z + .45); box('lockerM', x - .3, x + .3, y + .45, y + .48, z - .42, z + .42);
    const g = new THREE.BoxGeometry(.66, .04, .96); g.rotateZ(-.12); g.translate(x, y + 1.0, z); G('lockerM', g); col.push({ x1: x - .33, x2: x + .33, z1: z - .45, z2: z + .45, y1: y, y2: y + 1.05 }); };
  // 사무용 회전의자: 쿠션 · 등받이 · 가스 실린더 · 5발 받침 · 바퀴
  const officeChair = (x, z, y, face = 0) => { box('rubber', x - .23, x + .23, y + .42, y + .5, z - .23, z + .23); const bz = z + (face >= 0 ? .2 : -.2); box('rubber', x - .21, x + .21, y + .55, y + .95, Math.min(bz, bz + .05), Math.max(bz, bz + .05)); box('alu', x - .02, x + .02, y + .48, y + .6, bz - .02, bz + .02);
    cyl('alu', x, y + .08, z, .025, .34); for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5, g = new THREE.BoxGeometry(.3, .03, .04); g.translate(.15, 0, 0); g.rotateY(a); g.translate(x, y + .08, z); G('rubber', g); cyl('rubber', x + Math.cos(a) * .29, y, z - Math.sin(a) * .29, .025, .05); } };
  // 침대: 철제 프레임 다리 · 매트리스 · 베개 · 머리 쪽 파이프
  const bed = (x1, x2, z, y) => { [[x1 + .05, z - .42], [x1 + .05, z + .42], [x2 - .05, z - .42], [x2 - .05, z + .42]].forEach(([x, zz]) => cyl('alu', x, y, zz, .02, .4)); box('alu', x1, x2, y + .36, y + .4, z - .44, z + .44);
    box('white', x1 + .02, x2 - .02, y + .4, y + .56, z - .43, z + .43, { solid: true }); box('porc', x2 - .45, x2 - .1, y + .56, y + .66, z - .3, z + .3); box('alu', x2 - .03, x2, y + .4, y + .95, z - .44, z + .44); box('alu', x2 - .03, x2, y + .9, y + .95, z - .44, z + .44); col.push({ x1, x2, z1: z - .45, z2: z + .45, y1: y, y2: y + .6 }); };
  // 과학 실험대: 하부장(문짝) · 검은 레진 상판 · 개수대 · 꺾인 수전 · 가스 꼭지
  const labTable = (x, z, y) => { cabinetD(x - .7, x + .7, z - .9, z + .9, y, .85, 'white', 'x+'); box('rubber', x - .72, x + .72, y + .85, y + .9, z - .92, z + .92); box('screen', x - .2, x + .2, y + .86, y + .905, z - .2, z + .2);
    cyl('alu', x, y + .9, z + .32, .015, .3); box('alu', x - .015, x + .015, y + 1.17, y + 1.2, z + .1, z + .33); [-.45, .45].forEach(dz => cyl('red', x + .5, y + .9, z + dz, .02, .06)); };
  // 업라이트 피아노: 몸체 · 건반대 · 흰/검은 건반 · 뚜껑 · 다리
  const upright = (x, z, y, front) => { const fs = front; box('screen', x - .3, x + .3, y, y + 1.25, z - .75, z + .75, { solid: true }); box('screen', x - .3 + (fs > 0 ? .3 : -.1), x + .3 + (fs > 0 ? .1 : -.3), y + .7, y + .78, z - .72, z + .72);
    for (let k = 0; k < 36; k++) { const kz = z - .7 + k * .039; box('white', fs > 0 ? x + .3 : x - .45, fs > 0 ? x + .45 : x - .3, y + .78, y + .8, kz, kz + .035); if ([1, 2, 4, 5, 6].includes(k % 7)) box('screen', fs > 0 ? x + .3 : x - .38, fs > 0 ? x + .38 : x - .3, y + .8, y + .83, kz - .01, kz + .012); }
    box('screen', x - .32, x + .32, y + 1.25, y + 1.28, z - .77, z + .77); [-.7, .7].forEach(dz => box('screen', fs > 0 ? x + .3 : x - .45, fs > 0 ? x + .45 : x - .3, y, y + .7, z + dz - .03, z + dz + .03)); };
  // 양변기: 받침 · 도기 몸통 · 시트 · 물탱크 — 벽(+x 또는 -x)에 붙는다
  const toilet = (x, z, y, wallSide) => { const s = wallSide; cyl('porc', x, y, z, .17, .4, .2, 16); box('rubber', x - .2, x + .2, y + .4, y + .43, z - .2, z + .2); box('porc', x + s * .2, x + s * .38, y + .4, y + .8, z - .2, z + .2); box('alu', x + s * .25, x + s * .3, y + .8, y + .82, z + .1, z + .15); col.push({ x1: x - .22, x2: x + .22, z1: z - .22, z2: z + .22, y1: y, y2: y + .5 }); };
  // 세면대: 도기 볼 + 받침 기둥 + 수전 + 거울
  const sinkPed = (x, z, y, wallZ, mirror = true) => { const s = Math.sign(z - wallZ) || 1; cyl('porc', x, y, z, .07, .7, .09, 12); box('porc', x - .28, x + .28, y + .72, y + .86, Math.min(wallZ, z + s * .22), Math.max(wallZ, z + s * .22)); box('screen', x - .2, x + .2, y + .82, y + .861, Math.min(z - .12, z + .12), Math.max(z - .12, z + .12));
    cyl('alu', x, y + .86, wallZ + s * .06, .015, .16); box('alu', x - .012, x + .012, y + 1.0, y + 1.02, Math.min(wallZ + s * .06, wallZ + s * .16), Math.max(wallZ + s * .06, wallZ + s * .16)); if (mirror) box('glass', x - .3, x + .3, y + 1.15, y + 1.75, Math.min(wallZ, wallZ + s * .01), Math.max(wallZ, wallZ + s * .01)); col.push({ x1: x - .3, x2: x + .3, z1: Math.min(wallZ, z + s * .25), z2: Math.max(wallZ, z + s * .25), y1: y, y2: y + .9 }); };
  // 복사기: 하부 급지 서랍 2단 · 본체 · 원고 덮개 · 조작판
  const copier = (x1, x2, z1, z2, y) => { box('white', x1, x2, y, y + .5, z1, z2, { solid: true }); for (let k = 1; k <= 2; k++) box('rubber', x1 - .005, x2 + .005, y + k * .17 - .005, y + k * .17, z1 - .005, z2 + .005); box('white', x1 + .03, x2 - .03, y + .5, y + .95, z1 + .03, z2 - .03); box('rubber', x1, x2, y + .95, y + 1.0, z1, z2); box('screen', x1 + .05, x1 + .3, y + .92, y + .96, z1 - .03, z1 + .1); box('rubber', x1 + .05, x2 - .05, y + .62, y + .64, z1 + .03 - .1, z1 + .03); };
  // ── 단서 배치: 쪽지(story.js NOTES id) · 증언 카세트(voice/<id>.mp3) — 실제 놓인 표면 높이(y) 위에 ──
  const clueNote = (id, x, y, z, f, ry = 0) => { const g = new THREE.BoxGeometry(.21, .004, .3); g.rotateY(ry); g.translate(x, y + .004, z); G('white', g); props.push({ kind: 'note', id, label: '쪽지 읽기', x, y: y + .1, z, floor: f }); };
  const clueTape = (id, x, y, z, f) => { box('screen', x - .13, x + .13, y, y + .07, z - .075, z + .075); box('red', x + .03, x + .07, y + .07, y + .085, z + .03, z + .06); props.push({ kind: 'tape', id, label: '녹음기 재생', x, y: y + .1, z, floor: f }); };
  // 코르크 게시판: 알루미늄 테두리 + 압정으로 꽂힌 공지 · 시간표 종이 (x 방향 벽용 / z 방향 벽용)
  const corkBoard = (xa, xb, ya, yb, z, side) => { const t = .02, zz = side > 0 ? [z, z + t] : [z - t, z]; box('cork', xa, xb, ya, yb, ...zz); box('alu', xa - .03, xb + .03, ya - .03, ya, zz[0], zz[1] + .01); box('alu', xa - .03, xb + .03, yb, yb + .03, zz[0], zz[1] + .01); box('alu', xa - .03, xa, ya, yb, zz[0], zz[1] + .01); box('alu', xb, xb + .03, ya, yb, zz[0], zz[1] + .01);
    for (let k = 0, x = xa + .15; x < xb - .3; k++, x += .32 + br() * .25) { const w = .21, h = .28 + br() * .05, y = ya + .15 + br() * (yb - ya - .55), zf = side > 0 ? zz[1] : zz[0] - .003; box(k % 5 === 2 ? 'book3' : 'white', x, x + w, y, y + h, Math.min(zf, zf + side * .003), Math.max(zf, zf + side * .003)); box('red', x + w / 2 - .01, x + w / 2 + .01, y + h - .03, y + h - .01, Math.min(zf, zf + side * .008), Math.max(zf, zf + side * .008)); } };
  const corkBoardZ = (x, side, za, zb, ya, yb) => { const t = .02, xx = side > 0 ? [x, x + t] : [x - t, x]; box('cork', ...xx, ya, yb, za, zb); [[ya - .03, ya], [yb, yb + .03]].forEach(([a, b]) => box('alu', xx[0], xx[1] + .01, a, b, za - .03, zb + .03));
    for (let k = 0, z = za + .15; z < zb - .3; k++, z += .32 + br() * .25) { const w = .21, h = .28 + br() * .05, y = ya + .15 + br() * (yb - ya - .55), xf = side > 0 ? xx[1] : xx[0] - .003; box(k % 4 === 1 ? 'book3' : 'white', Math.min(xf, xf + side * .003), Math.max(xf, xf + side * .003), y, y + h, z, z + w); } };
  // 응접 소파: 좌판 쿠션 · 등받이 · 팔걸이 · 다리
  const sofa = (x1, x2, z1, z2, y, backSide) => { box('rubber', x1, x2, y + .12, y + .42, z1, z2, { solid: true }); [x1, x2 - .14].forEach(x => box('rubber', x, x + .14, y + .12, y + .62, z1, z2)); const bz = backSide > 0 ? z2 - .16 : z1; box('rubber', x1, x2, y + .42, y + .82, bz, bz + .16); for (let k = 1; k < 3; k++) { const x = x1 + k * (x2 - x1) / 3; box('screen', x - .004, x + .004, y + .42, y + .45, z1 + .02, z2 - .02); } [[x1 + .05, z1 + .05], [x2 - .05, z1 + .05], [x1 + .05, z2 - .05], [x2 - .05, z2 - .05]].forEach(([x, z]) => cyl('screen', x, y, z, .02, .12)); };

  // 벽 + 개구부 (x 방향 벽): 개구부 목록 [{a,b,y1,y2}] 사이만 채운다
  const wallX = (key, xa, xb, z1, z2, y0, ops = [], o = {}) => {
    const H = S.FH - S.slab; let cur = xa; ops = ops.slice().sort((p, q) => p.a - q.a);
    for (const op of ops) { box(key, cur, op.a, y0, y0 + H, z1, z2, { solid: true, ...o }); box(key, op.a, op.b, y0, y0 + op.y1, z1, z2, { solid: op.y1 > .3, ...o }); box(key, op.a, op.b, y0 + op.y2, y0 + H, z1, z2, o); cur = op.b; }
    box(key, cur, xb, y0, y0 + H, z1, z2, { solid: true, ...o });
  };
  const wallZ = (key, x1, x2, za, zb, y0, ops = [], o = {}) => {
    const H = S.FH - S.slab; let cur = za; ops = ops.slice().sort((p, q) => p.a - q.a);
    for (const op of ops) { box(key, x1, x2, y0, y0 + H, cur, op.a, { solid: true, ...o }); box(key, x1, x2, y0, y0 + op.y1, op.a, op.b, { solid: op.y1 > .3, ...o }); box(key, x1, x2, y0 + op.y2, y0 + H, op.a, op.b, o); cur = op.b; }
    box(key, x1, x2, y0, y0 + H, cur, zb, { solid: true, ...o });
  };
  // 내부 벽 마감: 하부 1.2m 녹색 징두리 + 상부 아이보리 (얇은 판을 벽 앞에 붙인다)
  const finishX = (xa, xb, z, side, y0, ops = [], HI = S.CEIL) => {
    const t = .012, z1 = side > 0 ? z : z - t, z2 = side > 0 ? z + t : z;
    let cur = xa; ops = ops.slice().sort((p, q) => p.a - q.a);
    const seg = (a, b, lo, hi) => { if (hi > 1.2) { box('wall', a, b, y0 + Math.max(lo, 1.2), y0 + hi, z1, z2); } if (lo < 1.2) box('wain', a, b, y0 + lo, y0 + Math.min(1.2, hi), z1, z2); };
    for (const op of ops) { seg(cur, op.a, 0, HI); seg(op.a, op.b, 0, op.y1); seg(op.a, op.b, op.y2, HI); cur = op.b; }
    seg(cur, xb, 0, HI);
    box('rubber', xa, xb, y0, y0 + .1, side > 0 ? z + t : z - t - .015, side > 0 ? z + t + .015 : z - t);   // 걸레받이
  };

  const finishZ = (x, side, za, zb, y0) => {   // z 방향 벽 내부 마감
    const t = .012, x1 = side > 0 ? x : x - t, x2 = side > 0 ? x + t : x;
    box('wall', x1, x2, y0 + 1.2, y0 + S.FH - S.slab, za, zb); box('wain', x1, x2, y0, y0 + 1.2, za, zb);
    box('rubber', side > 0 ? x + t : x - t - .015, side > 0 ? x + t + .015 : x - t, y0, y0 + .1, za, zb);
  };
  const { zS, zN } = LY, T = S.outer;
  const isSt = r => r.kind === 'stair' || r.kind === 'cstair';
  const SG = r => { const zA = r.kind === 'cstair' ? .45 : zN + 2.8, zB = zA + 12 * .3; return { zA, zB, zL: Math.min(zS, zB + 1.6) }; };   // 계단 한 비행 12단 (단 너비 0.3m) · 중간참 1.6m
  for (let f = 0; f < S.floors; f++) {
    const y0 = yf(f), top = y0 + S.FH;
    // 슬래브 (구조) + 바닥 마감 + 반자(천장) + 보
    // 계단실(층 참 남쪽 zA~zS)은 슬래브 · 반자 · 보행면을 비워 둔다 → 위아래 계단이 이어져 보인다
    const cuts = LY.rooms.filter(isSt);
    const spans = []; { let cx = -LY.L / 2 - T; cuts.forEach(r => { spans.push([cx, r.x1]); cx = r.x2; }); spans.push([cx, LY.L / 2 + T]); }
    spans.forEach(([a, b]) => { if (b - a < .01) return;
      box('conc', a, b, y0 - S.slab, y0, zN - T, zS + T);
      box('ceil', Math.max(a, -LY.L / 2), Math.min(b, LY.L / 2), y0 + S.CEIL, y0 + S.CEIL + .02, zN, zS);
      walk.push({ x1: Math.max(a, -LY.L / 2), x2: Math.min(b, LY.L / 2), z1: zN, z2: zS, h: () => y0, f }); });
    cuts.forEach(r => { const { zA, zL } = SG(r); box('conc', r.x1, r.x2, y0 - S.slab, y0, zN - T, zA); walk.push({ x1: r.x1, x2: r.x2, z1: zN, z2: zA, h: () => y0, f }); if (f === 0) box('conc', r.x1, r.x2, y0 - S.slab, y0, zA, zL);
      if (zL < zS) { box('conc', r.x1, r.x2, y0 - S.slab, y0, zL, zS + T); box('ceil', r.x1, r.x2, y0 + S.CEIL, y0 + S.CEIL + .02, zL, zS); walk.push({ x1: r.x1, x2: r.x2, z1: zL, z2: zS, h: () => y0, f }); }
      box('ceil', r.x1, r.x2, y0 + S.CEIL, y0 + S.CEIL + .02, zN, zA); });
    // 기둥 (500×500) — 교실 경계마다 외벽 · 복도벽 라인에
    LY.rooms.forEach(r => [r.x1, r.x2].forEach(x => [zS + T / 2, 0].forEach(z => box('conc', x - .25, x + .25, y0, top - S.slab, z - .25, z + .25, { solid: true }))));
    // 외벽: 남측(교실 창 띠) · 북측(복도 창) · 동서 마구리
    const winsS = [], winsN = [];
    LY.rooms.forEach(r => {
      if (r.kind === 'class') { winsS.push({ a: r.x1 + .6, b: r.x2 - .6, y1: .9, y2: 2.4 }); winsN.push({ a: r.x1 + 1.5, b: r.x2 - 1.5, y1: 1.1, y2: 2.3 }); }
      else if (isSt(r)) winsS.push({ a: r.x1 + 1.5, b: r.x2 - 1.5, y1: f === 0 ? 2.6 : .3 + 1.8, y2: 3.0 });
      else if (r.kind === 'core' && f === 1 && opt.bridge) {}   // 2층 코어 북쪽: 구름다리 출입구
      else winsN.push({ a: r.x1 + 1.5, b: r.x2 - 1.5, y1: 1.5, y2: 2.3 });
    });
    // 1층 중앙 현관 (북측 = 운동장 반대편 주출입구, 남측은 교실)
    const core = LY.rooms.find(r => r.kind === 'core');
    if (f === 0) winsN.push({ a: core.x1 + 2.7, b: core.x2 - 2.7, y1: 0, y2: 2.6, door: true });
    winsN.push({ a: ELX - .62, b: ELX + .62, y1: 0, y2: 2.15, door: true, elev: true });   // 엘리베이터 승강장 출입구
    if (f === 1 && opt.bridge) { winsN.push({ a: core.x1 + 2.6, b: core.x2 - 2.6, y1: 0, y2: 2.4, door: true }); walk.push({ x1: core.x1 + 2.6, x2: core.x2 - 2.6, z1: zN - T - .05, z2: zN, h: () => y0, f }); }   // 구름다리 출입구 (2층)   // 엘리베이터 승강장 출입구 (rebuildGame 승강로)
    if (f === 0 && opt.southEntry) winsS.push({ a: core.x1 + 2.7, b: core.x2 - 2.7, y1: 0, y2: 2.6, door: true });   // 운동장 · 정문 쪽 주출입구
    wallX('brick', -LY.L / 2 - T, LY.L / 2 + T, zS, zS + T, y0, winsS);
    wallX('brick', -LY.L / 2 - T, LY.L / 2 + T, zN - T, zN, y0, winsN.filter(w => !(w.a > core.x1 && w.b < core.x2 && !w.door && f === 0)));
    finishX(-LY.L / 2, LY.L / 2, zN, 1, y0, winsN);
    finishZ(-LY.L / 2, 1, zN, zS, y0); finishZ(LY.L / 2, -1, zN, zS, y0);
    LY.rooms.filter(isSt).forEach(r => finishX(r.x1, r.x2, zS, -1, y0, winsS.filter(w => w.a >= r.x1 && w.b <= r.x2), S.FH - S.slab));   // 복도 쪽 외벽 안쪽 마감 (벽돌이 실내에 드러나지 않게)
    const exitOps = f === 0 && opt.endExits ? [{ a: zN + .3, b: zN + 1.6, y1: 0, y2: 2.2 }] : [];
    wallZ('brick', -LY.L / 2 - T, -LY.L / 2, zN - T, zS + T, y0, exitOps);
    wallZ('brick', LY.L / 2, LY.L / 2 + T, zN - T, zS + T, y0, exitOps);
    if (exitOps.length) [-1, 1].forEach(sx => {   // 별관 양 끝 비상구: 바깥으로 열린 녹색 철문 · 비상구 유도등 · 문턱
      const xw = sx * (LY.L / 2 + T / 2);
      box('steelG', xw - .16, xw + .16, 2.2, 2.28, zN + .25, zN + 1.65); [zN + .3, zN + 1.6].forEach(z => box('steelG', xw - .16, xw + .16, 0, 2.2, z - .04, z + .04));
      box('wain', xw + sx * .16, xw + sx * 1.4, 0, 2.15, zN + 1.6, zN + 1.65);
      box('lamp', xw - sx * .2 - .2, xw - sx * .2 + .2, 2.32, 2.5, zN + .75, zN + 1.15); exitSign(sx * (LY.L / 2 - .05), y0 + 2.4, zN + .95);
      walk.push({ x1: Math.min(xw - .2, xw + sx * .2) - .2, x2: Math.max(xw - .2, xw + sx * .2) + .2, z1: zN + .3, z2: zN + 1.6, h: () => 0, f: 0 });
      props.push({ kind: 'room', label: '비상구', x1: sx < 0 ? -LY.L / 2 : LY.L / 2 - .5, x2: sx < 0 ? -LY.L / 2 + .5 : LY.L / 2, z1: zN + .3, z2: zN + 1.6, floor: 0, exit: true }); });
    // 창호 (알루미늄 미서기창 + 유리)
    [[winsS, zS + T / 2], [winsN, zN - T / 2]].forEach(([ws, z]) => ws.forEach(w => { if (w.door) return;
      box('alu', w.a, w.b, y0 + w.y1, y0 + w.y1 + .06, z - .06, z + .06); box('alu', w.a, w.b, y0 + w.y2 - .06, y0 + w.y2, z - .06, z + .06);
      for (let x = w.a; x <= w.b + .01; x += (w.b - w.a) / Math.max(1, Math.round((w.b - w.a) / 1.6))) box('alu', x - .03, x + .03, y0 + w.y1, y0 + w.y2, z - .05, z + .05);
      box('glass', w.a, w.b, y0 + w.y1 + .06, y0 + w.y2 - .06, z - .01, z + .01);
      // 바깥 콘크리트 창대 (물끊기) · 상인방
      const out = z > 0 ? 1 : -1, zo = z + out * (T / 2);
      box('conc', w.a - .08, w.b + .08, y0 + w.y1 - .06, y0 + w.y1, Math.min(zo, zo + out * .12), Math.max(zo, zo + out * .12));
      box('conc', w.a - .05, w.b + .05, y0 + w.y2, y0 + w.y2 + .12, Math.min(zo, zo + out * .04), Math.max(zo, zo + out * .04)); }));
    if (f === 0) {   // 현관 유리문 2짝 + 바람막이 캐노피
      const d = { a: core.x1 + 2.7, b: core.x2 - 2.7 };
      box('alu', d.a, d.b, 2.5, 2.6, zN - .2, zN - .1); [d.a, (d.a + d.b) / 2, d.b].forEach(x => box('alu', x - .04, x + .04, 0, 2.5, zN - .2, zN - .1));
      { const w = (d.b - d.a) / 2; [[d.a, 1], [d.b, -1]].forEach(([hx, sx]) => doors.push({ kind: 'swing', mat: 'alu', win: false, w, h: 2.45, t: .05, px: hx, py: 0, pz: zN - .15, ox: sx * w / 2, oz: 0, dir: sx, open: false,
          cx1: Math.min(hx, hx + sx * w), cx2: Math.max(hx, hx + sx * w), cz1: zN - .2, cz2: zN - .1, mx: (d.a + d.b) / 2, mz: zN - .2, label: '현관 유리문', floor: 0, glassLeaf: true })); }
      if (!opt.bridge) box('conc', d.a - 1, d.b + 1, 3.0, 3.2, zN - 3.2, zN - T);   // 구름다리가 있으면 그것이 차양
      // 현관 위 교명판 · 출입등 2개
      { const c = document.createElement('canvas'); c.width = 1024; c.height = 160; const g = c.getContext('2d'); g.fillStyle = '#2a2622'; g.fillRect(0, 0, 1024, 160); g.fillStyle = '#d8c9a0'; g.font = 'bold 92px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(opt.signText || '서 문 고 등 학 교', 512, 84);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sg = new THREE.Mesh(new THREE.PlaneGeometry(4.6, .72), new THREE.MeshStandardMaterial({ map: t, roughness: .6, metalness: .3 })); sg.position.set((core.x1 + core.x2) / 2, opt.bridge ? 2.95 : 3.75, zN - T - .02); if (opt.bridge) sg.scale.set(.62, .5, 1); /* 구름다리 밑: 문 위 낮게 */ sg.rotation.y = Math.PI; root.add(sg); }
      [d.a - .6, d.b + .6].forEach(x => { box('alu', x - .1, x + .1, 2.55, 2.85, zN - T - .14, zN - T); box('lamp', x - .08, x + .08, 2.58, 2.82, zN - T - .16, zN - T - .14); lights.push({ x, y: 2.6, z: zN - T - .6 }); });
      props.push({ kind: 'mainDoor', label: '현관 유리문', x: (d.a + d.b) / 2, y: 1.1, z: zN - .15, floor: 0 });
      walk.push({ x1: d.a, x2: d.b, z1: zN - T - .05, z2: zN, h: () => 0, f: 0 });   // 현관 문턱 (벽 두께)
    }
    if (f === 0 && opt.southEntry) {   // 남쪽 정문 현관 (운동장 · 정문을 마주 본다): 유리문 2짝 · 캐노피 · 교명판 · 출입등
      const d = { a: core.x1 + 2.7, b: core.x2 - 2.7 }, zd = zS + T;
      box('alu', d.a, d.b, 2.5, 2.6, zS + .1, zS + .2); [d.a, (d.a + d.b) / 2, d.b].forEach(x => box('alu', x - .04, x + .04, 0, 2.5, zS + .1, zS + .2));
      { const w = (d.b - d.a) / 2; [[d.a, 1], [d.b, -1]].forEach(([hx, sx]) => doors.push({ kind: 'swing', mat: 'alu', win: false, w, h: 2.45, t: .05, px: hx, py: 0, pz: zS + .15, ox: sx * w / 2, oz: 0, dir: -sx, open: false,
          cx1: Math.min(hx, hx + sx * w), cx2: Math.max(hx, hx + sx * w), cz1: zS + .1, cz2: zS + .2, mx: (d.a + d.b) / 2, mz: zS + .2, label: '정문 현관 유리문', floor: 0, glassLeaf: true })); }
      box('conc', d.a - 1, d.b + 1, 3.0, 3.2, zd, zd + 3.0);   // 캐노피
      [d.a - .9, d.b + .9].forEach(x => box('conc', x - .15, x + .15, 0, 3.0, zd + 2.6, zd + 2.9, { solid: true }));   // 캐노피 기둥
      box('conc', d.a - 1, d.b + 1, -.02, .03, zd, zd + 3.0);   // 현관 앞 포치
      { const c = document.createElement('canvas'); c.width = 1024; c.height = 160; const g = c.getContext('2d'); g.fillStyle = '#2a2622'; g.fillRect(0, 0, 1024, 160); g.fillStyle = '#d8c9a0'; g.font = 'bold 92px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(opt.signText || '서 문 고 등 학 교', 512, 84);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sg = new THREE.Mesh(new THREE.PlaneGeometry(4.6, .72), new THREE.MeshStandardMaterial({ map: t, roughness: .6, metalness: .3 })); sg.position.set((core.x1 + core.x2) / 2, 3.75, zd + .02); root.add(sg); }
      [d.a - .6, d.b + .6].forEach(x => { box('alu', x - .1, x + .1, 2.55, 2.85, zd, zd + .14); box('lamp', x - .08, x + .08, 2.58, 2.82, zd + .14, zd + .16); lights.push({ x, y: 2.6, z: zd + .6 }); });
      props.push({ kind: 'mainDoor', label: '정문 현관 유리문', x: (d.a + d.b) / 2, y: 1.1, z: zS + .15, floor: 0 });
      walk.push({ x1: d.a, x2: d.b, z1: zS, z2: zd + .05, h: () => 0, f: 0 });   // 현관 문턱 (벽 두께)
    }
    // 복도벽(교실 ↔ 복도): 교실마다 앞 · 뒤 미닫이문 + 상부 고창
    LY.rooms.forEach(r => {
      if (r.kind === 'class') {
        const ops = [{ a: r.x1 + .7, b: r.x1 + 1.7, y1: 0, y2: 2.1 }, { a: r.x2 - 1.7, b: r.x2 - .7, y1: 0, y2: 2.1 }, { a: r.x1 + 2.4, b: r.x2 - 2.4, y1: 1.6, y2: 2.4 }];
        wallX('wall', r.x1, r.x2, -S.wall / 2, S.wall / 2, y0, ops);
        finishX(r.x1, r.x2, S.wall / 2, 1, y0, ops); finishX(r.x1, r.x2, -S.wall / 2, -1, y0, ops);
        const idx = LY.rooms.filter(q => q.kind === 'class').indexOf(r), type = PLAN[f][idx], name = roomName(f, idx);
        ops.slice(0, 2).forEach((o, k) => { box('alu', o.a - .05, o.a, y0, y0 + 2.15, -.12, .12); box('alu', o.b, o.b + .05, y0, y0 + 2.15, -.12, .12); box('alu', o.a, o.b, y0 + 2.1, y0 + 2.15, -.12, .12);
          // 미서기 나무문 (복도 쪽 레일, 벽 안쪽으로 밀려 들어간다) + 문 위 실명판
          const w = o.b - o.a; doors.push({ kind: 'slide', mat: 'lockerM', win: true, w, h: 2.08, t: .04, px: (o.a + o.b) / 2, py: y0, pz: -.14, ox: 0, oz: 0, dir: k ? -1 : 1, open: (f + idx + k) % 3 === 0,
            cx1: o.a, cx2: o.b, cz1: -.18, cz2: -.1, mx: (o.a + o.b) / 2, mz: -.5, label: `${name} ${k ? '뒷문' : '앞문'}`, floor: f });
          if (!k) box('white', o.a, o.b + .3, y0 + 2.2, y0 + 2.4, -.16, -.12); });
        box('glass', r.x1 + 2.4, r.x2 - 2.4, y0 + 1.6, y0 + 2.4, -.01, .01);
        // 교실 사이 칸막이벽 (동측) — 마지막 교실은 코어 · 계단실 벽이 대신한다
        { const nx = LY.rooms[LY.rooms.indexOf(r) + 1]; if (nx && nx.kind === 'class') { if (type === 'bcast' && PLAN[f][idx + 1] === 'bcast') box('wood', r.x2 - S.wall / 2 - .01, r.x2 + S.wall / 2 + .01, y0, y0 + .02, S.wall / 2, zS); else wallZ('wall', r.x2 - S.wall / 2, r.x2 + S.wall / 2, 0, zS, y0); } }
        classroom(r, f, y0, type, name);
      } else if (r.kind === 'stair') {
        { const xi = r.x1 < 0 ? r.x2 : r.x1; wallZ('conc', xi - S.wall / 2, xi + S.wall / 2, zN, zS, y0, [{ a: zN + .1, b: zN + 2.6, y1: 0, y2: 2.2 }]);
          // 갑종 방화문 양개 (평소 자석으로 열어 둔 상태 — 계단실 쪽으로 젖혀진다)
          const w = 1.25, sx = r.x1 < 0 ? -1 : 1;
          [[zN + .1, 1], [zN + 2.6, -1]].forEach(([hz, sz]) => doors.push({ kind: 'swing', axisZ: true, mat: 'steelG', win: true, w, h: 2.18, t: .05, px: xi, py: y0, pz: hz, ox: 0, oz: sz * w / 2, dir: sx * sz, open: true,
            cx1: xi - .1, cx2: xi + .1, cz1: Math.min(hz, hz + sz * w), cz2: Math.max(hz, hz + sz * w), mx: xi + (r.x1 < 0 ? .6 : -.6), mz: zN + 1.35, label: '계단실 방화문', floor: f })); }   // 복도 쪽 벽만 (바깥쪽은 외벽), 방화문 개구부
        { const xi = r.x1 < 0 ? r.x2 : r.x1, sd = r.x1 < 0 ? -1 : 1;
          finishZ(xi - sd * S.wall / 2, -sd, zN + 2.6, zS, y0); finishZ(xi + sd * S.wall / 2, sd, zN + 2.6, zS, y0); }   // 계단실 칸막이벽 양면 마감 (문 개구부 남쪽)
        if (f > 0) box('terr', r.x1, r.x2, y0 - S.slab, y0 + .02, zN + 2.77, zN + 2.8);   // 층 참 슬래브 끝 마감 (노출 콘크리트 단면 가리기)
        stair(r, f, y0);
      } else if (r.kind === 'cstair') {
        centerStair(r, f, y0);
      } else if (r.kind === 'core') {
        coreRoom(r, f, y0);
      }
    });
    // 복도: 형광등 · 감지기 · 유도등 · 소화전함 · 소화기
    for (let x = -LY.L / 2 + 3; x < LY.L / 2 - 2; x += 4.5) { fluor(x, y0 + S.CEIL - .05, zN / 2, true); }
    LY.rooms.filter(r => r.kind === 'class').forEach((r, i) => {
      extinguisher(r.x1 + .35, y0, -.32, Math.PI); if (i % 2 === 0) hydrant(r.x1 + 4.5, y0, zN + .05);
      detector(r.x1 + 4.5, y0 + S.CEIL, zN / 2);
    });
    LY.rooms.filter(r => r.kind === 'stair').forEach(r => exitSign((r.x1 + r.x2) / 2 + (r.x1 < 0 ? 3 : -3), y0 + 2.35, zN / 2));
    // 복도 실사 소품: 발신기(화재경보) · 복도 끝 CCTV · 계단실 앞 화분 · 화장실 앞 미끄럼 주의 표지
    LY.rooms.filter(r => r.kind === 'class').forEach((r, i) => { if (i % 2 === 0) mdl('fire_alarm', r.x1 + 5.4, y0 + 1.45, zN + .01); });
    [-1, 1].forEach(sx => mdl('security_camera_01', sx * (LY.L / 2 - .5), y0 + S.CEIL - .15, zN + .35, sx > 0 ? -Math.PI / 2 : Math.PI / 2));
    LY.rooms.filter(r => r.kind === 'stair').forEach(r => { const x = r.x1 < 0 ? r.x2 + .5 : r.x1 - .5; mdl('potted_plant_04', x, y0, zN + .35, 0, { s: 2.6 }); });
    { const c = LY.rooms.find(r => r.kind === 'core'); if ((f + 1) % 2) mdl('WetFloorSign_01', c.x1 + 1.5, y0, -.9, .6); }
  }
  // 옥상 슬래브 + 파라펫
  const yr = yf(S.floors), eSt = opt.roofStair ? LY.rooms.filter(r => r.kind === 'stair').pop() : null, zA_ = zN + 2.8, zL_ = eSt ? SG(eSt).zL : zS;
  if (eSt) {   // 옥탑 계단실 아래(2비행 자리)는 슬래브를 뚫는다
    box('conc', -LY.L / 2 - T, eSt.x1, yr - S.slab, yr, zN - T, zS + T); box('conc', eSt.x2, LY.L / 2 + T, yr - S.slab, yr, zN - T, zS + T);
    box('conc', eSt.x1, eSt.x2, yr - S.slab, yr, zN - T, zA_); box('conc', eSt.x1, eSt.x2, yr - S.slab, yr, zL_, zS + T);
  } else box('conc', -LY.L / 2 - T, LY.L / 2 + T, yr - S.slab, yr, zN - T, zS + T);
  box('brick', -LY.L / 2 - T, LY.L / 2 + T, yr, yr + 1.1, zS, zS + T, { solid: true }); box('brick', -LY.L / 2 - T, LY.L / 2 + T, yr, yr + 1.1, zN - T, zN, { solid: true });
  if (opt.roofStair) {
    // ── 옥상 리모델링: 우레탄 방수 바닥 · 사방 파라펫 + 안전 난간 · 실외기 · 물탱크 · 통신 철탑 · 투광등 · 버려진 옥상 텃밭 ──
    mat.roofCoat = M('roofCoat', () => new THREE.MeshStandardMaterial({ color: 0x56705a, roughness: .88, metalness: .02 }));
    mat.roofLine = M('roofLine', () => new THREE.MeshStandardMaterial({ color: 0xd8c860, roughness: .7 }));
    const X1 = -LY.L / 2, X2 = LY.L / 2, P = .02;
    box('roofCoat', X1, eSt.x1 - .2, yr, yr + P, zN, zS); box('roofCoat', eSt.x1 - .2, X2, yr, yr + P, zL_ + .2, zS);
    walk.push({ x1: X1, x2: eSt.x1 - .2, z1: zN, z2: zS, h: () => yr + P, f: S.floors }); walk.push({ x1: eSt.x1 - .2, x2: X2, z1: zL_ + .2, z2: zS, h: () => yr + P, f: S.floors });
    box('brick', X1 - T, X1, yr, yr + 1.1, zN - T, zS + T, { solid: true }); box('brick', X2, X2 + T, yr, yr + 1.1, zN - T, zS + T, { solid: true });
    box('conc', X1 - T - .04, X2 + T + .04, yr + 1.1, yr + 1.18, zS - .04, zS + T + .04); box('conc', X1 - T - .04, X2 + T + .04, yr + 1.1, yr + 1.18, zN - T - .04, zN + .04);
    box('conc', X1 - T - .04, X1 + .04, yr + 1.1, yr + 1.18, zN, zS); box('conc', X2 - .04, X2 + T + .04, yr + 1.1, yr + 1.18, zN, zS);
    for (let x = X1 + 1; x < X2; x += 2.4) [zN + .12, zS - .12].forEach(z => box('deskLeg', x - .02, x + .02, yr + 1.18, yr + 1.75, z - .02, z + .02));   // 파라펫 위 안전 난간
    [zN + .12, zS - .12].forEach(z => box('deskLeg', X1, X2, yr + 1.72, yr + 1.77, z - .025, z + .025));
    // 노란 보행 안내선 (옥탑 출입문 → 서쪽)
    box('roofLine', X1 + 2, eSt.x1 - .3, yr + P, yr + P + .005, 1.95, 2.05); box('roofLine', X1 + 2, eSt.x1 - .3, yr + P, yr + P + .005, 3.95, 4.05);
    // 루프 드레인
    for (let x = X1 + 4; x < X2 - 8; x += 12) { box('rubber', x - .15, x + .15, yr + P, yr + P + .03, zS - .55, zS - .25); box('rubber', x - .15, x + .15, yr + P, yr + P + .03, zN + .25, zN + .55); }
    // 에어컨 실외기 8대 (팬 격자 + 받침) — 남쪽 파라펫 따라
    for (let k = 0; k < 8; k++) { const x = X1 + 8 + k * 3.2, z = zS - 1.0;
      box('rubber', x - .5, x + .5, yr, yr + .12, z - .4, z + .4); box('steelG', x - .45, x + .45, yr + .12, yr + .82, z - .32, z + .32, { solid: true });
      box('rubber', x - .3, x + .3, yr + .2, yr + .74, z - .33, z - .325); box('rubber', x - .02, x + .02, yr + .2, yr + .74, z - .336, z - .33); box('rubber', x - .3, x + .3, yr + .45, yr + .49, z - .336, z - .33);
      if (k % 2 === 0) box('deskLeg', x + .3, x + .35, yr + .5, yr + 1.0, z + .32, z + .36); }   // 냉매관
    // 물탱크 2기 (서쪽) — 원통 + 받침 철골 + 사다리
    [[X1 + 4, 1.6], [X1 + 4, 5.2]].forEach(([x, z]) => { const tk = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 2.4, 24), mat.steelG); tk.position.set(x, yr + 1.0 + 1.2, z); root.add(tk);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.32, .08, 24), mat.rubber); lid.position.set(x, yr + 3.44, z); root.add(lid);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box('deskLeg', x + dx * .9 - .05, x + dx * .9 + .05, yr, yr + 1.0, z + dz * .9 - .05, z + dz * .9 + .05);
      box('steelG', x - 1.3, x + 1.3, yr + .95, yr + 1.0, z - 1.3, z + 1.3); col.push({ x1: x - 1.35, x2: x + 1.35, z1: z - 1.35, z2: z + 1.35, y1: yr, y2: yr + 3.5 });
      for (let k = 0; k < 9; k++) box('deskLeg', x + 1.3, x + 1.36, yr + .3 + k * .35, yr + .33 + k * .35, z - .25, z + .25); box('deskLeg', x + 1.3, x + 1.36, yr, yr + 3.4, z - .27, z - .23); box('deskLeg', x + 1.3, x + 1.36, yr, yr + 3.4, z + .23, z + .27); });
    // 통신 철탑 (옥탑 서쪽) + 피뢰침 + 경고등
    { const x = eSt.x1 - 3, z = zN + 1.2; for (const [dx, dz] of [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]]) box('deskLeg', x + dx - .04, x + dx + .04, yr, yr + 7, z + dz - .04, z + dz + .04);
      for (let y = yr + .8; y < yr + 7; y += 1.1) { box('deskLeg', x - .44, x + .44, y, y + .04, z - .44, z - .4); box('deskLeg', x - .44, x + .44, y, y + .04, z + .4, z + .44); box('deskLeg', x - .44, x - .4, y, y + .04, z - .44, z + .44); box('deskLeg', x + .4, x + .44, y, y + .04, z - .44, z + .44); }
      box('deskLeg', x - .015, x + .015, yr + 7, yr + 8.4, z - .015, z + .015); box('lamp', x - .08, x + .08, yr + 7.05, yr + 7.2, z - .08, z + .08);
      const dish = new THREE.Mesh(new THREE.SphereGeometry(.55, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3), mat.steelG); dish.position.set(x + .5, yr + 4.6, z + .2); dish.rotation.set(-1.2, 0, .4); root.add(dish);
      col.push({ x1: x - .5, x2: x + .5, z1: z - .5, z2: z + .5, y1: yr, y2: yr + 7 }); }
    // 투광등 4기 (파라펫 모서리)
    [[X1 + .5, zN + .5], [X1 + .5, zS - .5], [eSt.x1 - 1, zS - .5], [0, zN + .5]].forEach(([x, z]) => { box('deskLeg', x - .04, x + .04, yr, yr + 2.6, z - .04, z + .04); box('steelG', x - .22, x + .22, yr + 2.5, yr + 2.8, z - .12, z + .12); box('lamp', x - .18, x + .18, yr + 2.52, yr + 2.56, z - .1, z + .1); lights.push({ x, y: yr + 2.4, z }); });
    // 버려진 옥상 텃밭 (스티로폼 상자 + 마른 흙) · 낡은 벤치 · 빨랫줄
    for (let k = 0; k < 6; k++) { const x = -6 + k * 1.1; box('white', x - .45, x + .45, yr, yr + .35, zS - 2.6, zS - 2.0, { solid: true }); box('wood', x - .42, x + .42, yr + .3, yr + .34, zS - 2.57, zS - 2.03); }
    box('wood', 4, 6, yr + .42, yr + .47, zN + .6, zN + 1.0); [4.2, 5.8].forEach(x => box('deskLeg', x - .04, x + .04, yr, yr + .42, zN + .62, zN + .98)); box('wood', 4, 6, yr + .47, yr + .9, zN + .58, zN + .62);
    col.push({ x1: 4, x2: 6, z1: zN + .55, z2: zN + 1.05, y1: yr, y2: yr + .9 });
    [-14, -4].forEach(x => box('deskLeg', x - .03, x + .03, yr, yr + 1.9, 1.0, 1.06)); box('deskLeg', -14, -4, yr + 1.85, yr + 1.87, 1.02, 1.04);
    // 서쪽 계단실 위 옥탑 (닫힌 기계실)
    { const w = LY.rooms.find(r => r.kind === 'stair'); box('conc', w.x1 - .2, w.x2 + .2, yr, yr + 2.6, zN - .2, zN + 3.2, { solid: true }); box('conc', w.x1 - .3, w.x2 + .3, yr + 2.6, yr + 2.8, zN - .3, zN + 3.3); box('steelG', w.x2 + .2, w.x2 + .23, yr, yr + 2.0, zN + .8, zN + 1.8); }
  }
  // 층간 띠 (외관 수평선)
  for (let f = 1; f <= S.floors; f++) { box('conc', -LY.L / 2 - T - .05, LY.L / 2 + T + .05, yf(f) - .3, yf(f), zS + T, zS + T + .08); }

  // ── 교실 ──
  function roomName(f, idx) { const t = PLAN[f][idx]; if (t !== 'class') return (opt.prefix || '') + ROOM_NAME[t]; const n = PLAN[f].slice(0, idx + 1).filter(q => q === 'class').length; if (opt.classLabel) return opt.classLabel(f, n); return `${f === 0 ? 1 : f}학년 ${f === 0 ? n + 8 : n}반`; }
  function classroom(r, f, y0, type = 'class', name = '') {
    const x1 = r.x1 + S.wall / 2, x2 = r.x2 - S.wall / 2, z1 = S.wall / 2, z2 = zS;
    box('wood', x1, x2, y0, y0 + .02, z1, z2);
    finishX(x1, x2, z2 - .001, -1, y0, [{ a: x1 + .4, b: x2 - .4, y1: .9, y2: 2.4 }]);
    for (let k = 0; k < 4; k++) radiator(x1 + 1 + k * 2, x1 + 2.2 + k * 2, y0 + .15, z2 - .2, z2 - .08);   // 창 아래 주물 라디에이터
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) fluor(x1 + 1.6 + i * 2.9, y0 + S.CEIL - .05, z1 + 1.3 + j * 2.4, false);
    box('white', x1 + .3, x1 + .38, y0 + 1.2, y0 + 1.32, z1 + .01, z1 + .03);   // 스위치 박스
    detector((x1 + x2) / 2, y0 + S.CEIL, (z1 + z2) / 2);
    props.push({ kind: 'room', type, label: name, x: (x1 + x2) / 2, y: y0, z: (z1 + z2) / 2, floor: f, x1, x2, z1, z2 });
    if (type === 'bcast') { const ci = LY.rooms.filter(q => q.kind === 'class').indexOf(r); if (PLAN[f][ci + 1] === 'bcast') special(type, x1, x2 + S.bay, z1, z2, y0, f); return; }   // 두 칸 방송실: 첫 칸에서 18m 로 한 번에
    if (type !== 'class') { special(type, x1, x2, z1, z2, y0, f); return; }
    // 교단(높이 0.2) + 녹색 칠판 4.8m + 분필 받침 — 앞쪽(서측 벽)
    box('wood', x1, x1 + 1.2, y0, y0 + .2, z1 + 1.2, z2 - 1.2, { solid: false });
    walk.push({ x1, x2: x1 + 1.2, z1: z1 + 1.2, z2: z2 - 1.2, h: () => y0 + .2, f });
    box('board', x1 + .01, x1 + .04, y0 + .95, y0 + 2.15, (z1 + z2) / 2 - 2.4, (z1 + z2) / 2 + 2.4);
    box('alu', x1 + .04, x1 + .12, y0 + .9, y0 + .94, (z1 + z2) / 2 - 2.4, (z1 + z2) / 2 + 2.4);
    // 교탁
    lectern(x1 + 1.8, (z1 + z2) / 2, y0);
    // 학생 책상 · 의자 6열 × 4줄 = 24석 (줄 사이 0.5m 이상 — 책상 사이로 지나다닐 수 있다) (1인용 650×500, 통로 0.6m)
    // 복도 쪽 1.25m는 앞 · 뒷문 동선으로 비우고, 맨 뒷줄은 뒷문 앞을 막지 않게 1.5m 띄운다
    // 3분단 × 짝꿍 2열: 분단 사이 통로(약 0.7m)로 교실 안 어디든 걸어갈 수 있다
    const cols = 6, rows = 4, dx = (x2 - x1 - 4.4) / (rows - 1), zz0 = z1 + 1.45, PW = 1.44, AIS = (z2 - .3 - zz0 - PW * 3) / 2;   // 교탁 앞 0.9m · 복도 쪽 1.45m 통로
    const colZ = j => zz0 + ((j / 2) | 0) * (PW + AIS) + (j % 2 ? 1.08 : .36);
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const cx = x1 + 3.0 + i * dx, cz = colZ(j);
      // 실사 학교 책걸상 모델 (Poly Haven SchoolDesk_01 · SchoolChair_01) — 칠판(서쪽)을 바라본다, 조금씩 흐트러진 폐교 배치
      const jx = ((i * 7 + j * 13 + f * 5) % 7 - 3) * .012, jr = ((i * 5 + j * 3 + f) % 5 - 2) * .025;
      mdl('SchoolDesk_01', cx + jx, y0, cz, DESK_RY + jr);
      col.push({ x1: cx - .28, x2: cx + .28, z1: cz - .36, z2: cz + .36, y1: y0, y2: y0 + .76 });
      const sx = cx + .5 + jx * 2; mdl('SchoolChair_01', sx, y0, cz, CHAIR_RY - jr * 2);
    }
    // 뒤쪽 사물함 (36칸, 높이 1.2) + 게시판
    lockerWall(x2 - .02, z1 + .3, z2 - .3, y0, 1.2);
    corkBoardZ(x2 - .02, -1, z1 + 1, z2 - 1, y0 + 1.4, y0 + 2.4);   // 뒷벽 학급 게시판
    // 3학년 2반(윤하늘의 반): 교탁 위 담임 수첩 · 교환일기 · 개근 스티커판 · 첫 번째 메모
    if (name === '3학년 2반' && !opt.noClues) { clueNote('n27', x1 + 1.8, y0 + 1.0, (z1 + z2) / 2, f, .2); clueNote('n28', x1 + 3.0, y0 + .74, zz0 + .36, f, -.3); clueNote('q1a', x2 - .03 - .05, y0 + 1.3, z1 + 2.0, f); clueNote('n29', x1 + 3.0, y0 + .74, zz0 + 1.08, f, .5); }
    // 태극기 액자 · 스피커 · 시계
    box('white', x1 + .02, x1 + .08, y0 + 2.25, y0 + 2.55, (z1 + z2) / 2 - .35, (z1 + z2) / 2 + .35);   // 태극기 액자
    box('white', x1 + .02, x1 + .06, y0 + 2.3, y0 + 2.6, z1 + .5, z1 + .8);   // 스피커
    mdl('wall_clock', x2 - .03, y0 + 2.4, (z1 + z2) / 2, -Math.PI / 2);   // 뒷벽 벽시계 (실사)
    mdl('ceiling_fan', x1 + 3.4, y0 + S.CEIL, (z1 + z2) / 2 - 1.8); mdl('ceiling_fan', x1 + 6.6, y0 + S.CEIL, (z1 + z2) / 2 + 1.8);   // 천장 선풍기 2대
    mdl('metal_trash_can', x2 - .8, y0, z2 - .65, .4); col.push({ x1: x2 - 1.1, x2: x2 - .5, z1: z2 - .95, z2: z2 - .35, y1: y0, y2: y0 + .9 });   // 창가 뒤 구석 쓰레기통
  }
  // ── 특별실 집기 ──
  function desk(x, z, w = 1.4, d = .7, h = .74, key = 'deskTop') { box(key, x - w / 2, x + w / 2, y_ + h - .04, y_ + h, z - d / 2, z + d / 2); box('steelG', x - w / 2 + .02, x - w / 2 + .45, y_, y_ + h - .04, z - d / 2 + .02, z + d / 2 - .02); box('deskLeg', x + w / 2 - .05, x + w / 2 - .02, y_, y_ + h - .04, z - d / 2 + .02, z + d / 2 - .02); box('deskLeg', x - w / 2 + .45, x + w / 2 - .05, y_ + h - .2, y_ + h - .04, z + d / 2 - .04, z + d / 2 - .02);   // 앞가림판
    for (const sz of [-1, 1]) { const fz = z + sz * (d / 2 - .02); for (let k = 1; k < 3; k++) box('rubber', x - w / 2 + .03, x - w / 2 + .44, y_ + k * (h - .04) / 3 - .004, y_ + k * (h - .04) / 3, Math.min(fz, fz + sz * .006), Math.max(fz, fz + sz * .006));   // 서랍 3단 틈
      for (let k = 0; k < 3; k++) box('alu', x - w / 2 + .17, x - w / 2 + .31, y_ + (k + .5) * (h - .04) / 3 - .01, y_ + (k + .5) * (h - .04) / 3 + .01, Math.min(fz, fz + sz * .025), Math.max(fz, fz + sz * .025)); }   // 서랍 손잡이
    col.push({ x1: x - w / 2, x2: x + w / 2, z1: z - d / 2, z2: z + d / 2, y1: y_, y2: y_ + h }); }
  // 책장 한 칸마다 책 줄 (높이 · 두께 · 색이 제각각, 가끔 비스듬히 쓰러진 책 · 빈칸)
  function books(xf, zc, y, side) {
    for (const ly of [.12, .52, .92, 1.32, 1.72]) { let z = zc - .64; while (z < zc + .62) { const t = .025 + br() * .04, h = .2 + br() * .12, dpt = .17 + br() * .05;
      if (br() < .08) { z += .12; continue; }   // 빠진 책 자리
      const key = 'book' + ((br() * 4) | 0); box(key, xf - side * dpt, xf, y + ly, y + ly + h, Math.min(z, z + t), z + t); z += t + .003; } }
  }
  function chairAt(x, z) { officeChair(x, z, y_, 1); }
  function chairAtOld(x, z) { box('rubber', x - .22, x + .22, y_ + .42, y_ + .5, z - .22, z + .22); box('rubber', x - .22, x + .22, y_ + .5, y_ + .95, z + .18, z + .24); box('deskLeg', x - .02, x + .02, y_ + .05, y_ + .42, z - .02, z + .02); }
  function cabinet(x1, x2, z1, z2, h = 1.8, key = 'steelG', glassTop = false) { const narrowX = x2 - x1 < z2 - z1, front = narrowX ? (rmx > (x1 + x2) / 2 ? 'x+' : 'x-') : (rmz > (z1 + z2) / 2 ? 'z+' : 'z-'); cabinetD(x1, x2, z1, z2, y_, h, key, front, glassTop); }
  function special(type, x1, x2, z1, z2, y0, f) {
    y_ = y0; const zm = (z1 + z2) / 2, xm = (x1 + x2) / 2; rmx = xm; rmz = zm;
    if (x2 - x1 > 6) corkBoard(x1 + 2.5, x2 - 2.5, y0 + .9, y0 + 1.5, z1 + .02, 1);   // 복도 쪽 코르크 게시판 (문 · 채광창 사이 벽면만)
    if (type === 'staff' || type === 'admin') {   // 교무실 · 행정실: 사무용 책상 섬 3개 × 6석, 캐비닛, 복사기
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 3; k++) { const x = x1 + 1.6 + i * 2.5, z = z1 + 2.1 + k * 1.5 + j * .72; desk(x, z, 1.2, .7); chairAt(x, z + (j ? .55 : -.55)); { const sd = j ? 1 : -1, zc = z - sd * .12; box('crt', x - .17, x + .17, y0 + .79, y0 + 1.08, zc - .1, zc + .1); box('crt', x - .1, x + .1, y0 + .82, y0 + 1.03, zc - sd * .1 - .06, zc - sd * .1 + .06); box('screen', x - .14, x + .14, y0 + .82, y0 + 1.05, zc + sd * .1 - .005, zc + sd * .1 + .005); box('crt', x - .09, x + .09, y0 + .74, y0 + .79, zc - .08, zc + .08); box('crt', x - .2, x + .2, y0 + .74, y0 + .76, zc + sd * .2 - .07, zc + sd * .2 + .07); } }
      cabinet(x2 - .5, x2 - .05, z1 + .3, z1 + 3.5); cabinet(x1 + .05, x1 + .5, z1 + .3, z2 - 1.9, 1.2);   // 남쪽 끝 1.9m 는 키 큰 장이 선다 (겹치지 않게)
      copier(x2 - 1.2, x2 - .3, z2 - 1.2, z2 - .5, y0);   // 복사기
      if (type === 'staff' && !opt.noClues && !s_staff++) { clueNote('n3', x1 + 1.6, y0 + .74, z1 + 2.1, f, .3); clueNote('n22', x1 + 4.1, y0 + .74, z1 + 3.6, f, -.2); clueTape('ts_vice', x1 + 6.6, y0 + .74, z1 + 5.1, f); }
      if (type === 'admin' && !opt.noClues) clueNote('n21', x1 + 4.1, y0 + .74, z1 + 2.1, f, .1);
      props.push({ kind: 'search', label: type === 'staff' ? '교무실 서류함 뒤지기' : '행정실 장부 확인', x: x2 - .6, y: y0 + 1, z: z1 + 1.9, floor: f });
      mdl('drawer_cabinet', x1 + .32, y0, z2 - 1.2, Math.PI / 2); col.push({ x1: x1 + .05, x2: x1 + .6, z1: z2 - 1.8, z2: z2 - .6, y1: y0, y2: y0 + 1.9 });
      mdl('wall_clock', x1 + .03, y0 + 2.4, zm, Math.PI / 2); mdl('potted_plant_04', x2 - .4, y0, z2 - .4, 0, { s: 2.2 });
    } else if (type === 'principal') {   // 교장실: 대형 책상 · 응접 소파 · 진열장 · 태극기
      desk(xm + 2.2, zm, 1.9, .9, .76, 'lockerM'); chairAt(xm + 3, zm);
      sofa(xm - 2.6, xm - .4, z1 + 1.2, z1 + 1.9, y0, -1); sofa(xm - 2.6, xm - .4, z2 - 1.9, z2 - 1.2, y0, 1);
      box('lockerM', xm - 2, xm - 1, y0, y0 + .42, zm - .5, zm + .5, { solid: true });
      cabinet(x1 + .05, x1 + .5, z1 + .5, z2 - .5, 2.0, 'lockerM', true);   // 유리문 진열장
      if (!opt.noClues) { clueNote('h1', xm + 2.0, y0 + .76, zm - .15, f, .2); clueNote('h4', xm + 2.5, y0 + .76, zm + .2, f, -.3); }
      props.push({ kind: 'search', label: '교장실 진열장 살펴보기', x: x1 + .8, y: y0 + 1.2, z: zm, floor: f });
    } else if (type === 'nurse') {   // 보건실: 침대 3 · 칸막이 커튼 · 약품장 · 세면대
      for (let k = 0; k < 3; k++) { const z = z1 + 2.0 + k * 1.9; bed(x2 - 2.1, x2 - .2, z, y0); box('curtain', x2 - 2.1, x2 - .2, y0 + .25, y0 + 1.95, z + .6, z + .62); box('alu', x2 - 2.1, x2 - .2, y0 + 1.96, y0 + 1.99, z + .58, z + .64); }   // 침대 사이 커튼 + 레일
      cabinet(x1 + .05, x1 + .5, z1 + .5, z1 + 2.5, 1.9, 'white', true);   // 유리문 약품장
      desk(x1 + 2, z2 - 1.2); chairAt(x1 + 2, z2 - .6);
      sinkPed(x1 + .35, z2 - 2.3, y0, z2 - .02);
      props.push({ kind: 'search', label: '보건실 약품장 열기', x: x1 + .8, y: y0 + 1.2, z: z1 + 1.5, floor: f });
      mdl('medical_box', x1 + 2, y0 + .74, z2 - 1.2, .3); if (!opt.noClues) { clueNote('n2', x1 + 1.7, y0 + .74, z2 - 1.35, f, -.4); clueTape('ts_paramedic', x1 + 2.45, y0 + .74, z2 - 1.05, f); } mdl('wheelchair_01', x1 + 3.6, y0, z2 - .9, 2.4); col.push({ x1: x1 + 3.2, x2: x1 + 4.0, z1: z2 - 1.3, z2: z2 - .5, y1: y0, y2: y0 + 1 });
    } else if (type === 'counsel') {   // 상담실: 원탁 · 의자 4 · 책장 · 칸막이
      box('lockerM', xm - .6, xm + .6, y0 + .7, y0 + .74, zm - .6, zm + .6); col.push({ x1: xm - .6, x2: xm + .6, z1: zm - .6, z2: zm + .6, y1: y0, y2: y0 + .74 });
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([a, b]) => chairAt(xm + a * .95, zm + b * .95));
      mdl('wooden_bookshelf_worn', x2 - .32, y0, zm, -Math.PI / 2); col.push({ x1: x2 - .62, x2: x2 - .02, z1: zm - .72, z2: zm + .72, y1: y0, y2: y0 + 2.1 });
      mdl('potted_plant_04', x1 + .5, y0, z2 - .5, 0, { s: 2.4 });
    } else if (type === 'bcast') {   // 18m 방송실 (두 칸): 서쪽 주조정실 | 유리 칸막이 | 동쪽 녹음 스튜디오 — 2008년 고교 방송실 표준 배치
      {
      const X1 = x1, X2 = x1 + 17.8, XP = X1 + 9;   // XP: 유리 칸막이
      // 주조정실 — 서쪽 벽 모니터 월 + 평행 콘솔 (콘솔 앞에 의자 3)
      box('screen', X1 + .02, X1 + .1, y0 + 1.0, y0 + 2.3, z1 + 1.4, z1 + 5.6);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) box('crt', X1 + .1, X1 + .14, y0 + 1.1 + j * .62, y0 + 1.62 + j * .62, z1 + 1.5 + i * 1.38, z1 + 2.78 + i * 1.38);
      cabinetD(X1 + 1.0, X1 + 1.8, z1 + 1.6, z1 + 5.4, y0, .78, 'steelG', 'x-');
      { const g = new THREE.BoxGeometry(.9, .06, 3.8); g.rotateZ(-.18); g.translate(X1 + 1.4, y0 + .84, z1 + 3.5); G('rubber', g);
        for (let k = 0; k < 24; k++) { const fz = z1 + 1.8 + k * .14; box('alu', X1 + 1.25, X1 + 1.5, y0 + .88, y0 + .9, fz - .012, fz + .012); box('white', X1 + 1.3 + (k * 37 % 7) * .025, X1 + 1.33 + (k * 37 % 7) * .025, y0 + .9, y0 + .93, fz - .02, fz + .02); } }
      for (let k = 0; k < 3; k++) chairAt(X1 + 2.4, z1 + 2.3 + k * 1.2);
      // 19인치 장비랙 4대 (복도 쪽 북벽, 두 문 사이) · 카세트 데크 · 앰프
      for (let k = 0; k < 4; k++) { const rx = X1 + 2.4 + k * .75; cabinet(rx, rx + .6, z1 + .05, z1 + .7, 2.0, 'rubber'); for (let j = 0; j < 6; j++) box(j % 2 ? 'alu' : 'screen', rx + .04, rx + .56, y0 + .3 + j * .27, y0 + .5 + j * .27, z1 + .7, z1 + .72); }
      box('steelG', X1 + 6.0, X1 + 8.6, y0, y0 + .75, z1 + 6.6, z2 - .1, { solid: true }); box('screen', X1 + 6.2, X1 + 7.0, y0 + .75, y0 + .9, z1 + 6.7, z1 + 7.1);   // 창가 작업대 · 편집용 VCR
      chairAt(X1 + 7.3, z1 + 6.2);
      // 유리 칸막이 (가운데 출입문)
      box('wall', XP - .07, XP + .07, y0, y0 + S.CEIL, z1, z1 + 3.0, { solid: true }); box('wall', XP - .07, XP + .07, y0, y0 + S.CEIL, z1 + 4.0, z2, { solid: true });
      box('glass', XP - .075, XP + .075, y0 + .9, y0 + 2.1, z1 + .4, z1 + 2.7); box('glass', XP - .075, XP + .075, y0 + .9, y0 + 2.1, z1 + 4.3, z2 - .4);
      box('wall', XP - .07, XP + .07, y0 + 2.15, y0 + S.CEIL, z1 + 3.0, z1 + 4.0);
      box('red', XP + .08, XP + .1, y0 + 2.18, y0 + 2.38, z1 + 3.2, z1 + 3.8);   // ON AIR 등
      // 녹음 스튜디오 — 흡음판 · 원탁 + 마이크 4 · 테이프 보관장
      for (let k = 0; k < 6; k++) box('curtain', X2 - .08, X2 - .02, y0 + .6, y0 + 2.3, z1 + .5 + k * 1.15, z1 + 1.5 + k * 1.15);
      for (let k = 0; k < 6; k++) box('curtain', XP + .8 + k * 1.3, XP + 1.9 + k * 1.3, y0 + 1.0, y0 + 2.3, z2 - .08, z2 - .03);
      const tx = XP + 4.5, tz = z1 + 3.9; cyl('wood', tx, y0 + .72, tz, .9, .05, .9, 24); cyl('alu', tx, y0, tz, .06, .72); col.push({ x1: tx - .9, x2: tx + .9, z1: tz - .9, z2: tz + .9, y1: y0, y2: y0 + .77 });
      [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([a, b]) => { chairAt(tx + a * 1.25, tz + b * 1.25); cyl('alu', tx + a * .55, y0 + .77, tz + b * .55, .012, .35); box('screen', tx + a * .55 - .03, tx + a * .55 + .03, y0 + 1.1, y0 + 1.2, tz + b * .55 - .03, tz + b * .55 + .03); });
      cabinet(XP + .4, XP + 2.6, z1 + .05, z1 + .6, 1.9, 'wood', true);   // 마스터 테이프 보관장
      cabinet(X2 - 2.2, X2 - .3, z1 + .05, z1 + .6, 1.2, 'steelG');
      if (!opt.noClues) { clueNote('n8', X1 + 1.5, y0 + .96, z1 + 5.0, f, .1); clueTape('ts_mina', XP + 4.2, y0 + .78, tz - .3, f); }
      }
    } else if (type === 'broadcast') {   // 방송실: 주조정 콘솔 · 녹음 부스 유리벽 · 장비랙
      cabinetD(x1 + 2.1, x1 + 4.4, z1 + 2.2, z1 + 3.0, y0, .78, 'steelG', 'z+');   // 콘솔 하부장
      { const g = new THREE.BoxGeometry(2.3, .06, .8); g.rotateX(.18); g.translate(x1 + 3.25, y0 + .84, z1 + 2.6); G('rubber', g);   // 경사 믹서 상판
        for (let k = 0; k < 16; k++) { const fx = x1 + 2.25 + k * .13; box('alu', fx - .012, fx + .012, y0 + .87, y0 + .9, z1 + 2.62, z1 + 2.8); box('white', fx - .02, fx + .02, y0 + .89, y0 + .92, z1 + 2.66 + (k * 37 % 9) * .012, z1 + 2.68 + (k * 37 % 9) * .012); cyl('red', fx, y0 + .87, z1 + 2.45, .012, .03); cyl('white', fx, y0 + .86, z1 + 2.33, .012, .03); } }
      for (let k = 0; k < 3; k++) box('rubber', x1 + 2.3 + k * .7, x1 + 2.8 + k * .7, y0 + .95, y0 + 1.35, z1 + 2.9, z1 + 2.95);
      box('wall', x1 + 4.6, x1 + 4.75, y0, y0 + S.CEIL, z1, z2 - 2.4, { solid: true }); box('glass', x1 + 4.6, x1 + 4.75, y0 + .9, y0 + 2.1, z1 + 1, z2 - 3);
      for (let k = 0; k < 3; k++) cabinet(x2 - .7, x2 - .1, z1 + .4 + k * .7, z1 + 1 + k * .7, 2.0, 'rubber');
      chairAt(x1 + 3.2, z1 + 3.6);
      if (!opt.noClues) { clueNote('n8', x1 + 2.8, y0 + .96, z1 + 2.35, f, .1); clueTape('ts_mina', x1 + 3.9, y0 + .96, z1 + 2.3, f); }
      props.push({ kind: 'console', label: '방송 송출 콘솔', x: x1 + 3.2, y: y0 + 1, z: z1 + 2.6, floor: f });
    } else if (type === 'science') {   // 과학실: 실험대 6 (싱크 · 가스꼭지) · 약품장 · 흄후드
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const x = x1 + 1.9 + i * 2.2, z = z1 + 2.6 + j * 2.8; labTable(x, z, y0); }
      cabinet(x2 - .5, x2 - .05, z1 + .5, z2 - .5, 1.9, 'lockerM', true);
      if (!opt.noClues && !opt.noSciLib && !s_sci++) { clueNote('n5', x1 + 1.9, y0 + .9, z1 + 3.2, f, .2); clueNote('q7a', x1 + 4.1, y0 + .9, z1 + 2.0, f, -.3); clueTape('ts_electric', x1 + 6.3, y0 + .9, z1 + 3.1, f); }
      props.push({ kind: 'search', label: '과학실 약품장', x: x2 - .8, y: y0 + 1.2, z: zm, floor: f });
    } else if (type === 'music') {   // 음악실: 피아노 · 계단식 합창단 3단 · 악보대 · 악기장
      upright(xm + 2.6, z1 + 1.95, y0, -1);   // 업라이트 피아노 (건반이 방 안쪽)
      for (let k = 0; k < 3; k++) { box('wood', x1 + .6 + k * .9, x1 + 1.5 + k * .9, y0, y0 + .2 * (3 - k), z1 + .8, z2 - .8); walk.push({ x1: x1 + .6 + k * .9, x2: x1 + 1.5 + k * .9, z1: z1 + .8, z2: z2 - .8, h: () => y0 + .2 * (3 - k), f }); }
      for (let k = 0; k < 6; k++) box('deskLeg', xm - .3 + (k % 3) * .7, xm - .27 + (k % 3) * .7, y0, y0 + 1.1, zm - 1 + ((k / 3) | 0) * 1.6, zm - .98 + ((k / 3) | 0) * 1.6);
      cabinet(x2 - .55, x2 - .05, z1 + .5, z2 - .5, 1.9, 'lockerM');
      if (!opt.noClues) { clueNote('n18', xm + 2.6, y0 + 1.28, z1 + 1.6, f, 0); clueTape('ts_music', x2 - .3, y0 + 1.9, zm, f); }
      props.push({ kind: 'piano', label: '음악실 피아노 건반 누르기', x: xm + 2, y: y0 + 1, z: z1 + 2, floor: f });
    } else if (type === 'art') {   // 미술실: 큰 작업대 · 이젤 · 석고상 받침 · 수채 개수대
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) desk(x1 + 2.6 + i * 3, z1 + 2 + j * 3, 2.2, 1.2, .8, 'lockerM');
      // 이젤 5개: 세 다리(앞 둘 · 뒤 하나 비스듬히) + 캔버스 받침 + 그리다 만 캔버스
      for (let k = 0; k < 5; k++) { const x = x1 + 1 + k * 1.5, z = z2 - 1.0;
        [[-.28, .12], [.28, .12]].forEach(([dx, dz]) => { const g = new THREE.CylinderGeometry(.018, .022, 1.75, 6); g.rotateX(-.12); g.translate(x + dx, y0 + .86, z + dz); (geo.get('lockerM') || geo.set('lockerM', []).get('lockerM')).push(g); });
        { const g = new THREE.CylinderGeometry(.018, .022, 1.7, 6); g.rotateX(.42); g.translate(x, y0 + .8, z - .3); (geo.get('lockerM') || geo.set('lockerM', []).get('lockerM')).push(g); }
        box('lockerM', x - .36, x + .36, y0 + .78, y0 + .82, z + .08, z + .18);
        box('white', x - .32, x + .32, y0 + .82, y0 + 1.62, z + .12, z + .14); col.push({ x1: x - .35, x2: x + .35, z1: z - .4, z2: z + .2, y1: y0, y2: y0 + 1.7 }); }
      box('white', x1 + .3, x1 + .9, y0, y0 + 1.1, zm - .3, zm + .3, { solid: true }); box('porc', x2 - .7, x2 - .1, y0 + .8, y0 + .95, zm - .5, zm + .5, { solid: true });
      mdl('standing_chalkboard_01', x1 + .8, y0, zm + 1.25, Math.PI / 2); col.push({ x1: x1 + .4, x2: x1 + 1.2, z1: zm + .75, z2: zm + 1.75, y1: y0, y2: y0 + 1.8 });   // 앞문 동선 밖, 앞쪽 벽 중앙
      if (!opt.noClues) clueTape('ts_art', x1 + 2.6, y0 + .8, z1 + 2.2, f);
      props.push({ kind: 'search', label: '미술실 이젤 뒤 살펴보기', x: x1 + 4, y: y0 + 1, z: z2 - 1.3, floor: f });
    } else if (type === 'computer') {   // 컴퓨터실: PC 책상 3열 × 4줄(CRT 모니터 2대씩) · 서버 랙
      for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { const x = x1 + 2.2 + i * 2.2, z = z1 + 1 + j * 1.6; desk(x, z, 1.6, .7, .74); [x - .4, x + .4].forEach(mx => { // 2008년식 베이지 CRT 모니터: 뒤가 좁은 몸체 + 앞 베젤 + 볼록 화면 + 받침 · 키보드
        box('crt', mx - .19, mx + .19, y0 + .79, y0 + 1.12, z - .17, z + .03); box('crt', mx - .12, mx + .12, y0 + .83, y0 + 1.06, z + .03, z + .22);
        box('screen', mx - .15, mx + .15, y0 + .82, y0 + 1.08, z - .175, z - .165); box('crt', mx - .1, mx + .1, y0 + .74, y0 + .79, z - .08, z + .12);
        box('crt', mx - .21, mx + .21, y0 + .74, y0 + .76, z - .38, z - .24); }); }
      cabinet(x2 - .7, x2 - .1, z1 + .4, z1 + 1.1, 2.0, 'rubber');
      props.push({ kind: 'search', label: '교사용 PC 켜 보기', x: x1 + 1, y: y0 + 1, z: zm, floor: f });
    } else if (type === 'home' || type === 'study') {   // 가정실(조리대 4조) · 자율학습실(칸막이 열람석)
      if (type === 'home') for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const x = x1 + 2.4 + i * 3.2, z = z1 + 2 + j * 3; cabinetD(x - .9, x + .9, z - .6, z + .6, y0, .85, 'white', 'z+'); box('rubber', x - .92, x + .92, y0 + .85, y0 + .88, z - .62, z + .62); [[-.4, -.15], [-.15, -.15], [-.4, .12], [-.15, .12]].forEach(([dx, dz]) => cyl('screen', x + dx, y0 + .88, z + dz, .08, .015, .09, 16)); box('screen', x + .2, x + .65, y0 + .86, y0 + .885, z - .3, z + .15); cyl('alu', x + .42, y0 + .88, z + .3, .012, .28); }   // 조리대: 하부장 · 가스레인지 4구 · 개수대 · 수전
      else for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const x = x1 + 1.6 + i * 1.8, z = z1 + 2.2 + j * 1.3; desk(x, z, 1.0, .6, .74); box('lockerM', x - .5, x + .5, y0 + .74, y0 + 1.25, z - .32, z - .3); }
      props.push({ kind: 'search', label: type === 'home' ? '가정실 찬장 열기' : '자율학습실 사물함', x: x2 - .6, y: y0 + 1, z: zm, floor: f });
    } else if (type === 'library') {   // 도서실: 서가 열 · 열람 테이블 · 대출 데스크
      for (let i = 0; i < 3; i++) { const x = x1 + 2.4 + i * 2.0; [z1 + 2.4, z1 + 3.78].forEach(z => { mdl('wooden_bookshelf_worn', x + .15, y0, z, Math.PI / 2); mdl('wooden_bookshelf_worn', x - .15, y0, z, -Math.PI / 2); books(x + .3, z, y0, 1); books(x - .3, z, y0, -1); }); col.push({ x1: x - .45, x2: x + .45, z1: z1 + 1.7, z2: z1 + 4.48, y1: y0, y2: y0 + 2.1 }); }   // 양면 서가 (실사 책장 2개 등맞댐)
      for (let k = 0; k < 2; k++) { const x = x1 + 2.2 + k * 3; desk(x, z2 - 1.8, 2.2, .9, .74, 'lockerM'); chairAt(x - .6, z2 - 1.1); chairAt(x + .6, z2 - 1.1); }
      desk(x2 - 1.1, zm + .6, 1.6, .7, .9, 'lockerM');
      if (!opt.noClues && !opt.noSciLib && !s_lib++) { clueNote('n4', x2 - 1.4, y0 + .9, zm + .6, f, .2); clueNote('n25', x2 - .8, y0 + .9, zm + .5, f, -.2); clueNote('q8a', x1 + 2.0, y0 + .74, z2 - 1.8, f, .4); clueTape('ts_reporter2', x1 + 5.4, y0 + .74, z2 - 1.75, f); }
      props.push({ kind: 'search', label: '대출 데스크 서랍', x: x2 - 1.1, y: y0 + 1, z: zm + 1.1, floor: f });
      [z2 - 2.4, z2 - .9].forEach(z => { mdl('wooden_bookshelf_worn', x1 + .32, y0, z, Math.PI / 2); col.push({ x1: x1 + .02, x2: x1 + .62, z1: z - .72, z2: z + .72, y1: y0, y2: y0 + 2.1 }); });   // 창가 벽 서가 (실사)
    }
  }
  // ── 중앙 계단실 (본관 코어 옆): 복도에서 바로 오르는 U자 계단 · 양쪽 벽 · 난간 ──
  function centerStair(r, f, y0) {
    const core = LY.rooms.find(q => q.kind === 'core'), far = Math.abs(r.x1 - core.x2) < .01 ? r.x2 : r.x1;   // 코어와 맞닿지 않은 쪽 벽
    wallZ('wall', far - S.wall / 2, far + S.wall / 2, 0, zS, y0); finishZ(far + (far === r.x2 ? -1 : 1) * S.wall / 2, far === r.x2 ? -1 : 1, 0, zS, y0);
    const ops = [{ a: r.x1 + .4, b: r.x2 - .4, y1: 0, y2: 2.5 }]; wallX('wall', r.x1, r.x2, -S.wall / 2, S.wall / 2, y0, ops); finishX(r.x1, r.x2, -S.wall / 2, -1, y0, ops);
    box('terr', r.x1 + .1, r.x2 - .1, y0, y0 + .02, .1, .45);
    { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#1e3a2a'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#e8f0e0'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`중앙 계단 ${f + 1}F`, 128, 34);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .3), new THREE.MeshBasicMaterial({ map: t })); m.position.set((r.x1 + r.x2) / 2, y0 + 2.62, -.12); m.rotation.y = Math.PI; root.add(m); }
    if (f > 0) box('terr', r.x1, r.x2, y0 - S.slab, y0 + .02, .42, .45);
    stair(r, f, y0);
    props.push({ kind: 'room', label: '중앙 계단', x1: r.x1, x2: r.x2, z1: 0, z2: zS, floor: f });
  }
  // ── U자 계단 (층마다 2개 비행 + 중간 참) ──
  function stair(r, f, y0) {
    const w = (r.x2 - r.x1 - .3) / 2, xa = r.x1 + .15, xb = xa + w + .3, { zA, zB, zL } = SG(r), run = zB - zA, H = S.FH, n = 12, rise = H / 2 / n, tr = run / n;
    box('terr', r.x1, r.x2, y0, y0 + .02, zN, zA);   // 층 참 (보행면은 슬래브 쪽에서)
    const roofUp = opt.roofStair && f === S.floors - 1 && r.x1 > 0;   // 맨 위층 동쪽 계단실: 옥상까지 이어지는 계단 + 옥탑 계단실
    // 벽 쪽 핸드레일 (비행마다 기울어진 봉 + 받침대)
    const rail = (x, za, zb, ya, yb) => { const len = Math.hypot(zb - za, yb - ya), m = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, len, 8), mats.deskLeg); m.position.set(x, (ya + yb) / 2 + .9, (za + zb) / 2); m.rotation.x = Math.atan2(zb - za, yb - ya); root.add(m);
      for (let k = 0; k <= 3; k++) { const t = k / 3; box('deskLeg', x - .015, x + .015, ya + (yb - ya) * t + .05, ya + (yb - ya) * t + .9, za + (zb - za) * t - .015, za + (zb - za) * t + .015); } };
    if (f < S.floors - 1 || roofUp) { rail(r.x1 + .2, zA, zB, y0, y0 + H / 2); rail(r.x2 - .2, zB, zA, y0 + H / 2, y0 + H); }
    if (f === S.floors - 1 && !roofUp) {   // 맨 위층: 아래층 1비행 위로 뚫린 곳에 안전 난간
      box('steelG', xa, xa + w, y0, y0 + 1.05, zA - .03, zA + .03, { solid: true }); box('deskLeg', xa, xa + w, y0 + 1.05, y0 + 1.1, zA - .04, zA + .04);
      for (let k = 0; k <= 4; k++) box('deskLeg', xa + k * w / 4 - .02, xa + k * w / 4 + .02, y0, y0 + 1.05, zA - .02, zA + .02); }
    if (roofUp) {   // 옥탑: 옥상 높이 층 참 + 벽 + 지붕 (옥상 출입문은 북쪽 벽)
      const yr = y0 + H, ph = 2.8;
      box('terr', r.x1, r.x2, yr - .25, yr, zN, zA); walk.push({ x1: r.x1, x2: r.x2, z1: zN, z2: zA, h: () => yr, f: f + 1 });
      box('conc', r.x1 - .2, r.x2 + .2, yr, yr + ph, zN - .2, zN, { solid: true }); box('conc', r.x1 - .2, r.x2 + .2, yr, yr + ph, zL, zL + .2, { solid: true });
      box('conc', r.x1 - .2, r.x1, yr, yr + ph, zN + 1.55, zL, { solid: true }); box('conc', r.x1 - .2, r.x1, yr, yr + .02, zN, zN + .2, { solid: true }); box('conc', r.x1 - .2, r.x1, yr, yr + ph, zN, zN + .2, { solid: true }); box('conc', r.x1 - .2, r.x1, yr + 2.1, yr + ph, zN + .2, zN + 1.55);   // 서벽: 옥상 쪽 출입구 (z zN+.2 ~ zN+1.55)
      box('steelG', r.x1 - .2, r.x1 - .15, yr + 2.05, yr + 2.12, zN + .15, zN + 1.6); box('steelG', r.x1 - .22, r.x1 + .02, yr, yr + 2.1, zN + .15, zN + .2); box('steelG', r.x1 - .22, r.x1 + .02, yr, yr + 2.1, zN + 1.55, zN + 1.6);   // 문틀
      box('steelG', r.x1 - 1.3, r.x1 - .2, yr, yr + 2.05, zN + 1.55, zN + 1.6);   // 바깥으로 열어 둔 철문 짝
      walk.push({ x1: r.x1 - .3, x2: r.x1 + .1, z1: zN + .2, z2: zN + 1.55, h: () => yr, f: f + 1 });   // 출입문 문턱
      box('conc', r.x2, r.x2 + .2, yr, yr + ph, zN, zL, { solid: true });
      box('conc', r.x1 - .3, r.x2 + .3, yr + ph, yr + ph + .2, zN - .3, zL + .5);

      box('lamp', (r.x1 + r.x2) / 2 - .3, (r.x1 + r.x2) / 2 + .3, yr + 2.4, yr + 2.45, zN + .05, zN + .2); lights.push({ x: (r.x1 + r.x2) / 2, y: yr + 2.3, z: zN + .8 });
      box('lamp', r.x1 - .45, r.x1 - .25, yr + 2.25, yr + 2.32, zN + .7, zN + 1.0);   // 출입문 바깥 벽등
      box('steelG', xa, xa + w, yr, yr + 1.05, zA - .03, zA + .03, { solid: true });   // 옥상 층 참: 2비행 쪽만 열려 있게 1비행 위 난간
    }
    if (f < S.floors - 1 || roofUp) {
      // 1비행: 서측 반, 남쪽으로 올라감 / 중간참: 남쪽 끝 / 2비행: 동측 반, 북쪽으로 올라감
      for (let i = 0; i < n; i++) { box('terr', xa, xa + w, Math.max(y0, y0 + rise * (i + 1) - .3), y0 + rise * (i + 1), zA + i * tr, zA + (i + 1) * tr); }
      walk.push({ x1: xa, x2: xa + w, z1: zA, z2: zB, h: (x, z) => y0 + Math.min(n, Math.max(0, Math.ceil((z - zA) / tr))) * rise, f, stair: true });
      box('terr', r.x1, r.x2, y0 + H / 2 - .25, y0 + H / 2, zB, zL);
      walk.push({ x1: r.x1, x2: r.x2, z1: zB, z2: zL, h: () => y0 + H / 2, f });
      {
        for (let i = 0; i < n; i++) box('terr', xb, xb + w, y0 + H / 2 + rise * (i + 1) - .3, y0 + H / 2 + rise * (i + 1), zB - (i + 1) * tr, zB - i * tr);
        walk.push({ x1: xb, x2: xb + w, z1: zA, z2: zB, h: (x, z) => y0 + H / 2 + Math.min(n, Math.max(0, Math.ceil((zB - z) / tr))) * rise, f, stair: true });
      }
      // 계단 난간: 중앙 칸막이벽(1.1m) + 핸드레일
      box('wain', xa + w, xb, y0, y0 + H / 2 + 1.1, zA, zB, { solid: true });
      box('deskLeg', xa + w - .02, xb + .02, y0 + H / 2 + 1.1, y0 + H / 2 + 1.15, zA, zB);
      // 계단 밑면(경사 슬래브)은 아래층 천장에서 보이지 않게 계단실 반자 제거
    }
    // 계단실은 반자 없음: 위층 슬래브에 2비행 구멍 (구멍은 슬래브를 다시 쪼개는 대신 계단실 위 슬래브를 생략)
    stairwells.push({ x1: r.x1, x2: r.x2, z1: zA, z2: zL, f });
    if (zL < zS - .05) { box('conc', r.x1, r.x2, y0, y0 + H - S.slab, zL, zL + .2, { solid: true }); }   // 중간참 남쪽은 막힌 계단실 창고
    box('lamp', (r.x1 + r.x2) / 2 - .3, (r.x1 + r.x2) / 2 + .3, y0 + 2.6, y0 + 2.65, zN + .05, zN + .2); lights.push({ x: (r.x1 + r.x2) / 2, y: y0 + 2.5, z: zN + .8 });   // 층 참 벽등
    if (f < S.floors - 1) { box('lamp', (r.x1 + r.x2) / 2 - .3, (r.x1 + r.x2) / 2 + .3, y0 + H / 2 + 2.3, y0 + H / 2 + 2.35, zL - .2, zL - .05); lights.push({ x: (r.x1 + r.x2) / 2, y: y0 + H / 2 + 2.2, z: zL - .8 }); }   // 중간참 벽등
    exitSign((r.x1 + r.x2) / 2, y0 + 2.35, zN + .05);
    extinguisher(r.x2 - .4, y0, zN + .4, 0);
    // 방화문 (계단실 ↔ 복도) 표시
    props.push({ kind: 'fireDoor', label: '계단실 방화문', x: r.x1 < 0 ? r.x2 : r.x1, y: y0 + 1, z: zN + 1.35, floor: f });
  }
  // ── 중앙 코어: 남녀 화장실 · 복도 세면대 · 층별 분전반 · 교무실(1층) ──
  function coreRoom(r, f, y0) {
    const xm = (r.x1 + r.x2) / 2;
    wallZ('wall', r.x1 - S.wall / 2, r.x1 + S.wall / 2, 0, zS, y0); wallZ('wall', r.x2 - S.wall / 2, r.x2 + S.wall / 2, 0, zS, y0);
    if (f === 0 && opt.southEntry) {   // 1층 코어 = 정문 현관 홀 (화장실은 2층부터)
      const ops = [{ a: xm - 2.2, b: xm + 2.2, y1: 0, y2: 2.6 }];
      wallX('wall', r.x1, r.x2, -S.wall / 2, S.wall / 2, y0, ops); finishX(r.x1, r.x2, -S.wall / 2, -1, y0, ops); finishX(r.x1, r.x2, S.wall / 2, 1, y0, ops);
      finishZ(r.x1 + S.wall / 2, 1, 0, zS, y0); finishZ(r.x2 - S.wall / 2, -1, 0, zS, y0); finishX(r.x1, r.x2, zS, -1, y0, [{ a: r.x1 + 2.7, b: r.x2 - 2.7, y1: 0, y2: 2.6 }]);
      box('terr', r.x1 + .1, r.x2 - .1, y0, y0 + .02, .1, zS);
      for (const sx of [-1, 1]) { const x0 = sx < 0 ? r.x1 + .15 : r.x2 - .55;   // 신발장 (양 벽)
        for (let k = 0; k < 3; k++) { const z = 1.2 + k * 1.3; box('lockerM', x0, x0 + .4, y0, y0 + 1.6, z, z + 1.2, { solid: true }); for (let j = 1; j < 5; j++) box('alu', x0 - .005, x0 + .405, y0 + j * .32, y0 + j * .32 + .015, z, z + 1.2); } }
      box('steelG', r.x1 + .3, r.x1 + 1.1, y0 + .6, y0 + 2.0, zN + .02, zN + .25, { solid: true });
      props.push({ kind: 'panel', label: `${f + 1}층 분전반`, x: r.x1 + .7, y: y0 + 1.3, z: zN + .3, floor: f });
      props.push({ kind: 'room', label: '중앙 현관', x1: r.x1, x2: r.x2, z1: 0, z2: zS, floor: f });
      return;
    }
    wallZ('wall', xm - .1, xm + .1, 0, zS, y0);
    const ops = [{ a: r.x1 + 1, b: r.x1 + 2, y1: 0, y2: 2.1 }, { a: r.x2 - 2, b: r.x2 - 1, y1: 0, y2: 2.1 }];
    wallX('wall', r.x1, r.x2, -S.wall / 2, S.wall / 2, y0, ops); finishX(r.x1, r.x2, -S.wall / 2, -1, y0, ops);
    [[r.x1, xm, '남'], [xm, r.x2, '여']].forEach(([a, b, g]) => {
      box('tile', a + .1, b - .1, y0, y0 + .02, .1, zS);
      for (let k = 0; k < 4; k++) { const sz = 2.4 + k * 1.6; box('white', b - 1.6, b - .1, y0 + .12, y0 + 2.0, sz - .02, sz + .02, { solid: true }); box('alu', b - 1.62, b - 1.58, y0, y0 + 2.0, sz - .03, sz + .03); }   // 칸막이 (벽에서 1.5m)
      for (let k = 0; k < 3; k++) { const sz = 2.4 + k * 1.6; toilet(b - .6, sz + .8, y0, 1);
        box('white', b - 1.62, b - 1.58, y0 + .12, y0 + 2.0, sz + .02, sz + .35, { solid: true }); box('white', b - 1.62, b - 1.58, y0 + .12, y0 + 2.0, sz + 1.25, sz + 1.58, { solid: true });   // 칸 앞판
        box('white', b - 1.6 - .55, b - 1.6, y0 + .12, y0 + 2.0, sz + 1.22, sz + 1.25); box('alu', b - 1.72, b - 1.62, y0 + .95, y0 + 1.0, sz + 1.2, sz + 1.22);   // 반쯤 열린 칸 문
        box('alu', b - .15, b - .08, y0 + .75, y0 + .87, sz + .35, sz + .45); }   // 휴지걸이
      box('tile', a + .1, a + .112, y0, y0 + 1.5, .1, zS); box('tile', b - .112, b - .1, y0, y0 + 1.5, .1, zS); box('tile', a + .1, b - .1, y0, y0 + 1.5, zS - .012, zS); box('white', a + .1, b - .1, y0 + 1.5, y0 + S.FH - S.slab, zS - .012, zS);   // 벽 타일 (허리 높이)
      if (g === '남') for (let k = 0; k < 3; k++) { const z = 3.0 + k * .9; box('porc', a + .1, a + .4, y0 + .45, y0 + 1.15, z - .2, z + .2, { solid: true }); box('alu', a + .1, a + .14, y0 + 1.15, y0 + 1.35, z - .02, z + .02); }   // 소변기
      for (let k = 0; k < 2; k++) { const z = .75 + k * .75; box('porc', a + .1, a + .55, y0 + .78, y0 + .9, z - .28, z + .28, { solid: true }); box('screen', a + .18, a + .45, y0 + .86, y0 + .901, z - .18, z + .18); cyl('alu', a + .14, y0 + .9, z, .012, .14); box('glass', a + .1, a + .11, y0 + 1.15, y0 + 1.75, z - .3, z + .3); }   // 화장실 세면대 + 거울
      props.push({ kind: 'toilet', label: `${g}자 화장실`, x: (a + b) / 2, y: y0, z: 1.2, floor: f });
      props.push({ kind: 'room', type: 'toilet', label: `${g}자 화장실`, x: (a + b) / 2, y: y0, z: zS / 2, floor: f, x1: a + .1, x2: b - .1, z1: .1, z2: zS });   // 화장실 괴담 · 방 판정용
    });
    // 복도측 세면대 (수도 · 배관)
    // 세면대는 화장실 벽(복도 남쪽) 두 문 사이에 — 1층 현관 앞(북쪽 벽)을 막지 않게
    for (let k = 0; k < 4; k++) { const x = xm - 1.5 + k * 1; box('porc', x - .3, x + .3, y0 + .75, y0 + .9, -.65, -.6, { solid: true }); box('porc', x - .3, x + .3, y0 + .75, y0 + .9, -.2, -.15); box('porc', x - .3, x - .25, y0 + .75, y0 + .9, -.6, -.2); box('porc', x + .25, x + .3, y0 + .75, y0 + .9, -.6, -.2); box('porc', x - .25, x + .25, y0 + .75, y0 + .78, -.6, -.2); box('alu', x - .03, x + .03, y0 + .77, y0 + .781, -.43, -.37); box('porc', x - .07, x + .07, y0 + .3, y0 + .75, -.35, -.17); box('alu', x - .02, x + .02, y0 + .9, y0 + 1.02, -.19, -.15); box('alu', x - .015, x + .015, y0 + 1.0, y0 + 1.02, -.3, -.15); box('alu', x - .04, x + .04, y0 + 1.03, y0 + 1.06, -.19, -.15); box('glass', x - .28, x + .28, y0 + 1.25, y0 + 1.75, -.14, -.12); }
    box('alu', xm - 1.9, xm + 1.9, y0 + .3, y0 + .35, -.16, -.12);   // 급수관
    props.push({ kind: 'sink', label: '복도 세면대', x: xm, y: y0 + .9, z: -.4, floor: f });
    // 층 분전반 (EPS)
    box('steelG', r.x1 + .3, r.x1 + 1.1, y0 + .6, y0 + 2.0, zN + .02, zN + .25, { solid: true });   // 코어 서쪽 (동쪽은 엘리베이터 승강장)
    props.push({ kind: 'panel', label: `${f + 1}층 분전반`, x: r.x1 + .7, y: y0 + 1.3, z: zN + .3, floor: f });
  }
  function fluor(x, y, z, alongX) {   // 2등용 매입 형광등 (1200 × 300)
    const [a, b] = alongX ? [.6, .15] : [.15, .6];
    box('lamp', x - a, x + a, y - .02, y, z - b, z + b); lights.push({ x, y: y - .1, z });
  }
  function detector(x, y, z) { const g = new THREE.CylinderGeometry(.06, .07, .04, 12); g.translate(x, y - .02, z); (geo.get('white') || geo.set('white', []).get('white')).push(g); }
  function exitSign(x, y, z) { box('exitG', x - .2, x + .2, y, y + .14, z - .03, z + .03); }
  // 실사 한국식 분말 소화기
  function extinguisher(x, y0, z, ry = 0) { mdl('korean_fire_extinguisher_01', x, y0, z, ry); props.push({ kind: 'extinguisher', label: '소화기', x, y: y0 + .3, z }); }
  function hydrant(x, y0, z) { box('red', x - .4, x + .4, y0 + .6, y0 + 1.8, z, z + .22, { solid: true }); props.push({ kind: 'hydrant', label: '옥내소화전', x, y: y0 + 1.2, z: z + .3 }); }

  // 계단실 위 슬래브 · 반자 구멍: 해당 층 위 슬래브에서 계단실 영역을 뺀다 — 단순화: 계단실 영역 위 반자 제거용 표시만 남긴다
  // 병합
  for (const [key, list] of geo) { const g = mergeGeometries(list, false); const m = new THREE.Mesh(g, mat[key]); m.castShadow = key !== 'glass' && key !== 'lamp'; m.receiveShadow = true; m.name = 'RB_' + key; root.add(m); }
  // 바닥 높이 조회 (계단 포함): 발 높이 기준으로 올라설 수 있는 가장 높은 면
  const groundAt = (x, z, feet) => { let best = null; for (const w of walk) { if (x < w.x1 || x > w.x2 || z < w.z1 || z > w.z2) continue; const h = w.h(x, z); if (h <= feet + .45 && (best == null || h > best)) best = h; } return best; };
  // 문짝: 병합하지 않은 개별 메시 (열고 닫는 애니메이션 · 닫혔을 때만 충돌)
  for (const d of doors) {
    const g = new THREE.Group(); g.position.set(d.px, d.py, d.pz); root.add(g); d.group = g;
    const leaf = new THREE.Mesh(d.axisZ ? uvBox(d.t, d.h, d.w) : uvBox(d.w, d.h, d.t), d.glassLeaf ? mat.glass : mat[d.mat]); if (d.glassLeaf) { const fr = new THREE.Mesh(new THREE.BoxGeometry(d.w, .08, d.t + .01), mat.alu); fr.position.set(d.ox, .04, 0); g.add(fr); const fr2 = fr.clone(); fr2.position.y = d.h - .04; g.add(fr2); } leaf.position.set(d.ox, d.h / 2, d.oz); g.add(leaf);
    if (d.win) { const gw = d.kind === 'swing' ? d.w * .5 : .5; const gl = new THREE.Mesh(d.axisZ ? new THREE.BoxGeometry(d.t + .004, .7, gw) : new THREE.BoxGeometry(gw, .7, d.t + .004), mat.glass); gl.position.set(d.ox, d.h * .7, d.oz); g.add(gl); }
    { const hd = new THREE.Mesh(d.axisZ ? new THREE.BoxGeometry(d.t + .06, .12, .03) : new THREE.BoxGeometry(.03, .12, d.t + .06), mat.alu); const k = d.kind === 'swing' ? .42 : -.4; hd.position.set(d.ox * (d.axisZ ? 1 : 1) + (d.axisZ ? 0 : Math.sign(d.ox || 1) * d.w * Math.abs(k) * (d.kind === 'swing' ? 1 : -1)), 1.0, d.oz + (d.axisZ ? Math.sign(d.oz) * d.w * .42 : 0)); g.add(hd); }
    d.col = { x1: d.cx1, x2: d.cx2, z1: d.cz1, z2: d.cz2, y1: d.py, y2: d.py + d.h, door: d }; col.push(d.col);
    d.t01 = d.open ? 1 : 0; d.target = d.t01; applyDoor(d);
  }
  function applyDoor(d) {
    if (d.kind === 'slide') d.group.position.x = d.px + d.dir * d.w * .95 * d.t01;
    else d.group.rotation.y = d.dir * d.t01 * Math.PI * .5;
    d.col.off = d.t01 > .25;
  }
  const tickDoors = dt => { for (const d of doors) if (d.t01 !== d.target) { d.t01 += Math.sign(d.target - d.t01) * Math.min(Math.abs(d.target - d.t01), dt * 2.2); applyDoor(d); } };
  const nearDoor = (x, z, y, r = 1.6) => { let best = null, bd = r; for (const d of doors) { if (Math.abs(d.py - y) > 1) continue; const dd = Math.hypot(d.mx - x, d.mz - z); if (dd < bd) { bd = dd; best = d; } } return best; };
  // 세계 ↔ 건물 좌표 (건물은 원점 기준으로 지은 뒤 통째로 옮기고 돌린다)
  const toLocal = (x, z) => { const dx = x - OX, dz = z - OZ; return [dx * cR - dz * sR, dx * sR + dz * cR]; };
  const toWorld = (x, z) => [OX + x * cR + z * sR, OZ - x * sR + z * cR];
  return { elevX: ELX, mats, root, col, walk, props, lights, groundAt, layout: LY, spec: S, stairwells, doors, tickDoors, nearDoor, models, toLocal, toWorld, name: opt.label || '본관' };
}

// 본관 ↔ 별관 1층 연결 통로 (유리 커튼월 복도, 천장 2.9m)
export function buildWalkway({ x1, x2, z1, z2, y = 0 }) {   // y: 바닥 높이 (2층 구름다리면 층 높이)
  const root = new THREE.Group(); root.name = 'REBUILD_WALKWAY'; const col = [], walk = [{ x1, x2, z1, z2, h: () => y, f: y > .5 ? 1 : 0 }], lights = [];
  const mat = { terr: pbr('tile', { rough: .8 }), conc: pbr('step', { rough: 1 }), alu: new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: .35, metalness: .7 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfd6dc, roughness: .08, metalness: .1, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide }), lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f6ff, emissiveIntensity: 1.4 }) };
  const uvb = (w, h, d, u) => { const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, n = g.attributes.normal; for (let i = 0; i < uv.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)); uv.setXY(i, uv.getX(i) * (ax > .5 ? d : w) / u, uv.getY(i) * (ay > .5 ? d : h) / u); } return g; };
  const add = (m, a, b, y1, y2, c, d, solid, par = root) => { const g = new THREE.Mesh(uvb(b - a, y2 - y1, d - c, m === mat.terr ? 2.4 : 2.5), m); g.position.set((a + b) / 2, (y1 + y2) / 2, (c + d) / 2); g.receiveShadow = true; g.castShadow = true; par.add(g); if (solid) col.push({ x1: a, x2: b, z1: c, z2: d, y1, y2 }); };
  add(mat.terr, x1, x2, y - .25, y, z1, z2); add(mat.conc, x1 - .2, x2 + .2, y + 2.9, y + 3.15, z1, z2);
  [x1 - .1, x2].forEach(x => { add(mat.conc, x, x + .1, y, y + .6, z1, z2, true); add(mat.glass, x + .04, x + .06, y + .6, y + 2.85, z1, z2, true); const n = Math.round((z2 - z1) / 2); for (let k = 0; k <= n; k++) { const z = z1 + k * (z2 - z1) / n; add(mat.alu, x, x + .1, y + .6, y + 2.9, z - .04, z + .04); } });
  for (let z = z1 + 1.5; z < z2 - 1; z += 3) { add(mat.lamp, (x1 + x2) / 2 - .6, (x1 + x2) / 2 + .6, y + 2.86, y + 2.9, z - .15, z + .15); lights.push({ x: (x1 + x2) / 2, y: y + 2.7, z }); }
  // 구름다리 구조: 바닥 밑 보 · 기둥 (늘 보이게 따로 묶는다 — 실내 겉모습을 다른 것으로 바꿔도 남는다)
  const support = new THREE.Group(); support.name = 'REBUILD_BRIDGE_SUPPORT';
  if (y > .5) { add(mat.conc, x1 - .3, x2 + .3, y - .6, y - .25, z1, z2, false, support);
    for (const z of [z1 + 1.2, (z1 + z2) / 2, z2 - 1.2]) for (const x of [x1 - .1, x2 + .1]) add(mat.conc, x - .22, x + .22, 0, y - .6, z - .22, z + .22, true, support); }
  const id = (x, z) => [x, z];
  return { root, support, col, walk, lights, toLocal: id, toWorld: id, groundAt: (x, z, feet) => (x >= x1 && x <= x2 && z >= z1 && z <= z2 && Math.abs(feet - y) < .5) ? y : null, props: [], doors: [], tickDoors() {}, nearDoor() { return null; }, models: [], name: '연결 통로' };
}
