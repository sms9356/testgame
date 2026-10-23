// 재건축 본관 (2008년 한국 공립 고등학교 표준 설계 기준)
//   남향 교실 + 북측 편복도, 철근콘크리트 라멘조(기둥 9m 간격), 층고 3.6m · 반자높이 2.7m
//   교실 9.0m × 7.5m, 복도 폭 2.7m, 양 끝 U자 계단실(6m × 9m), 중앙 화장실 · 세면대 코어
//   전기(분전반 · 2등용 형광등 · 콘센트 · 스위치) · 소방(소화전함 · 소화기 · 감지기 · 유도등 · 방화문) · 수도(세면대 · 배관)
import * as THREE from '../vendor/three.module.js';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';

export const SPEC = {
  floors: 4, FH: 3.6, CEIL: 2.7, slab: .25,
  bay: 9, classDepth: 7.5, corridor: 2.7, wall: .2, outer: .3,
  stairW: 6, coreW: 9,           // 계단실 폭, 중앙 화장실 코어 폭
  classesPerSide: 4,              // 중앙 코어 좌우로 4교실씩 = 층당 8교실
};

// 배치: x 서→동  [계단 6][교실 ×4][코어 9][교실 ×4][계단 6] = 6+36+9+36+6 = 93m
export function layout(S = SPEC) {
  const rooms = [], L = S.stairW * 2 + S.coreW + S.bay * S.classesPerSide * 2;
  let x = -L / 2;
  const push = (kind, w) => { rooms.push({ kind, x1: x, x2: x + w }); x += w; };
  push('stair', S.stairW);
  for (let i = 0; i < S.classesPerSide; i++) push('class', S.bay);
  push('core', S.coreW);
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

export function buildMainBuilding(opt = {}) {
  const S = SPEC, LY = layout(S), root = new THREE.Group(); root.name = 'REBUILD_MAIN';
  const col = [];      // 충돌 AABB {x1,x2,z1,z2,y1,y2}
  const walk = [];     // 보행면 {x1,x2,z1,z2, h:(x,z)=>y}
  const props = [];    // 상호작용 지점 {kind,label,x,y,z,floor}
  const lights = [];   // 형광등 위치 (게임 쪽 조명 예산이 고른다)
  const geo = new Map();  // 재질키 → 지오메트리 목록 (끝에서 병합 → 드로콜 최소화)
  const mats = {}, stairwells = [];
  const M = (key, make) => mats[key] || (mats[key] = make());
  const mat = {
    wood: M('wood', () => new THREE.MeshStandardMaterial({ map: TEX.woodFloor(), roughness: .55 })),
    terr: M('terr', () => new THREE.MeshStandardMaterial({ map: TEX.terrazzo(), roughness: .35, metalness: .02 })),
    ceil: M('ceil', () => new THREE.MeshStandardMaterial({ map: TEX.ceiling(), roughness: .95 })),
    wall: M('wall', () => new THREE.MeshStandardMaterial({ map: TEX.wall(), roughness: .9 })),
    wain: M('wain', () => new THREE.MeshStandardMaterial({ map: TEX.wainscot(), roughness: .55 })),
    conc: M('conc', () => new THREE.MeshStandardMaterial({ map: TEX.concrete(), roughness: .92 })),
    brick: M('brick', () => new THREE.MeshStandardMaterial({ map: TEX.brick(), roughness: .85 })),
    board: M('board', () => new THREE.MeshStandardMaterial({ map: TEX.board(), roughness: .8 })),
    alu: M('alu', () => new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: .35, metalness: .7 })),
    glass: M('glass', () => new THREE.MeshPhysicalMaterial({ color: 0xbfd6dc, roughness: .05, transmission: .85, transparent: true, opacity: .28, depthWrite: false })),
    steelG: M('steelG', () => new THREE.MeshStandardMaterial({ color: 0x6f7f75, roughness: .5, metalness: .5 })),
    red: M('red', () => new THREE.MeshStandardMaterial({ color: 0xb2201c, roughness: .45, metalness: .2 })),
    white: M('white', () => new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: .6 })),
    lamp: M('lamp', () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f6ff, emissiveIntensity: .9 })),
    exitG: M('exitG', () => new THREE.MeshStandardMaterial({ color: 0x1fa64a, emissive: 0x1fa64a, emissiveIntensity: 1.2 })),
    deskTop: M('deskTop', () => new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: .5 })),
    deskLeg: M('deskLeg', () => new THREE.MeshStandardMaterial({ color: 0x3d4a44, roughness: .45, metalness: .6 })),
    porc: M('porc', () => new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: .2 })),
    tile: M('tile', () => new THREE.MeshStandardMaterial({ color: 0xd6dcd8, roughness: .3 })),
    rubber: M('rubber', () => new THREE.MeshStandardMaterial({ color: 0x3a3a38, roughness: .8 })),
    lockerM: M('lockerM', () => new THREE.MeshStandardMaterial({ color: 0x8b6a45, roughness: .6 })),
  };
  const uvBox = (w, h, d, u = 1) => { const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv, n = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)); const sw = ax > .5 ? d : w, sh = ay > .5 ? d : h; uv.setXY(i, uv.getX(i) * sw / u, uv.getY(i) * sh / u); } return g; };
  const box = (key, x1, x2, y1, y2, z1, z2, { solid = false, u = 1 } = {}) => {
    const w = x2 - x1, h = y2 - y1, d = z2 - z1; if (w <= 0 || h <= 0 || d <= 0) return;
    const g = uvBox(w, h, d, u); g.translate((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    (geo.get(key) || geo.set(key, []).get(key)).push(g);
    if (solid) col.push({ x1, x2, z1, z2, y1, y2 });
  };
  const yf = f => f * S.FH;

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
  for (let f = 0; f < S.floors; f++) {
    const y0 = yf(f), top = y0 + S.FH;
    // 슬래브 (구조) + 바닥 마감 + 반자(천장) + 보
    // 계단실(층 참 남쪽 zA~zS)은 슬래브 · 반자 · 보행면을 비워 둔다 → 위아래 계단이 이어져 보인다
    const zA = zN + 2.8, cuts = LY.rooms.filter(r => r.kind === 'stair');
    const spans = []; { let cx = -LY.L / 2 - T; cuts.forEach(r => { spans.push([cx, r.x1]); cx = r.x2; }); spans.push([cx, LY.L / 2 + T]); }
    spans.forEach(([a, b]) => { if (b - a < .01) return;
      box('conc', a, b, y0 - S.slab, y0, zN - T, zS + T);
      box('ceil', Math.max(a, -LY.L / 2), Math.min(b, LY.L / 2), y0 + S.CEIL, y0 + S.CEIL + .02, zN, zS);
      walk.push({ x1: Math.max(a, -LY.L / 2), x2: Math.min(b, LY.L / 2), z1: zN, z2: zS, h: () => y0, f }); });
    cuts.forEach(r => { box('conc', r.x1, r.x2, y0 - S.slab, y0, zN - T, zA); walk.push({ x1: r.x1, x2: r.x2, z1: zN, z2: zA, h: () => y0, f }); if (f === 0) box('conc', r.x1, r.x2, y0 - S.slab, y0, zA, zS + T); box('ceil', r.x1, r.x2, y0 + S.CEIL, y0 + S.CEIL + .02, zN, zA); });
    // 기둥 (500×500) — 교실 경계마다 외벽 · 복도벽 라인에
    LY.rooms.forEach(r => [r.x1, r.x2].forEach(x => [zS + T / 2, 0].forEach(z => box('conc', x - .25, x + .25, y0, top - S.slab, z - .25, z + .25, { solid: true }))));
    // 외벽: 남측(교실 창 띠) · 북측(복도 창) · 동서 마구리
    const winsS = [], winsN = [];
    LY.rooms.forEach(r => {
      if (r.kind === 'class') { winsS.push({ a: r.x1 + .6, b: r.x2 - .6, y1: .9, y2: 2.4 }); winsN.push({ a: r.x1 + 1.5, b: r.x2 - 1.5, y1: 1.1, y2: 2.3 }); }
      else if (r.kind === 'stair') winsS.push({ a: r.x1 + 1.5, b: r.x2 - 1.5, y1: f === 0 ? 2.6 : .3 + 1.8, y2: 3.0 });
      else winsN.push({ a: r.x1 + 1.5, b: r.x2 - 1.5, y1: 1.5, y2: 2.3 });
    });
    // 1층 중앙 현관 (북측 = 운동장 반대편 주출입구, 남측은 교실)
    const core = LY.rooms.find(r => r.kind === 'core');
    if (f === 0) winsN.push({ a: core.x1 + 2.7, b: core.x2 - 2.7, y1: 0, y2: 2.6, door: true });
    wallX('brick', -LY.L / 2 - T, LY.L / 2 + T, zS, zS + T, y0, winsS, { u: 1.5 });
    wallX('brick', -LY.L / 2 - T, LY.L / 2 + T, zN - T, zN, y0, winsN.filter(w => !(w.a > core.x1 && w.b < core.x2 && !w.door && f === 0)), { u: 1.5 });
    finishX(-LY.L / 2, LY.L / 2, zN, 1, y0, winsN);
    finishZ(-LY.L / 2, 1, zN, zS, y0); finishZ(LY.L / 2, -1, zN, zS, y0);
    LY.rooms.filter(r => r.kind === 'stair').forEach(r => finishX(r.x1, r.x2, zS, -1, y0, winsS.filter(w => w.a >= r.x1 && w.b <= r.x2), S.FH - S.slab));   // 복도 쪽 외벽 안쪽 마감 (벽돌이 실내에 드러나지 않게)
    wallZ('brick', -LY.L / 2 - T, -LY.L / 2, zN - T, zS + T, y0, [], { u: 1.5 });
    wallZ('brick', LY.L / 2, LY.L / 2 + T, zN - T, zS + T, y0, [], { u: 1.5 });
    // 창호 (알루미늄 미서기창 + 유리)
    [[winsS, zS + T / 2], [winsN, zN - T / 2]].forEach(([ws, z]) => ws.forEach(w => { if (w.door) return;
      box('alu', w.a, w.b, y0 + w.y1, y0 + w.y1 + .06, z - .06, z + .06); box('alu', w.a, w.b, y0 + w.y2 - .06, y0 + w.y2, z - .06, z + .06);
      for (let x = w.a; x <= w.b + .01; x += (w.b - w.a) / Math.max(1, Math.round((w.b - w.a) / 1.6))) box('alu', x - .03, x + .03, y0 + w.y1, y0 + w.y2, z - .05, z + .05);
      box('glass', w.a, w.b, y0 + w.y1 + .06, y0 + w.y2 - .06, z - .01, z + .01); }));
    if (f === 0) {   // 현관 유리문 2짝 + 바람막이 캐노피
      const d = { a: core.x1 + 2.7, b: core.x2 - 2.7 };
      box('alu', d.a, d.b, 2.5, 2.6, zN - .2, zN - .1); [d.a, (d.a + d.b) / 2, d.b].forEach(x => box('alu', x - .04, x + .04, 0, 2.5, zN - .2, zN - .1));
      box('glass', d.a, d.b, .1, 2.5, zN - .16, zN - .14);
      box('conc', d.a - 1, d.b + 1, 3.0, 3.2, zN - 3.2, zN - T);
      props.push({ kind: 'mainDoor', label: '현관 유리문', x: (d.a + d.b) / 2, y: 1.1, z: zN - .15, floor: 0 });
    }
    // 복도벽(교실 ↔ 복도): 교실마다 앞 · 뒤 미닫이문 + 상부 고창
    LY.rooms.forEach(r => {
      if (r.kind === 'class') {
        const ops = [{ a: r.x1 + .7, b: r.x1 + 1.7, y1: 0, y2: 2.1 }, { a: r.x2 - 1.7, b: r.x2 - .7, y1: 0, y2: 2.1 }, { a: r.x1 + 2.4, b: r.x2 - 2.4, y1: 1.6, y2: 2.4 }];
        wallX('wall', r.x1, r.x2, -S.wall / 2, S.wall / 2, y0, ops);
        finishX(r.x1, r.x2, S.wall / 2, 1, y0, ops); finishX(r.x1, r.x2, -S.wall / 2, -1, y0, ops);
        ops.slice(0, 2).forEach((o, k) => { box('alu', o.a - .05, o.a, y0, y0 + 2.15, -.12, .12); box('alu', o.b, o.b + .05, y0, y0 + 2.15, -.12, .12); box('alu', o.a, o.b, y0 + 2.1, y0 + 2.15, -.12, .12);
          props.push({ kind: 'classDoor', label: `${f + 1}-${LY.rooms.filter(q => q.kind === 'class').indexOf(r) + 1} 교실 ${k ? '뒷문' : '앞문'}`, x: (o.a + o.b) / 2, y: y0 + 1, z: 0, floor: f, open: { a: o.a, b: o.b } }); });
        box('glass', r.x1 + 2.4, r.x2 - 2.4, y0 + 1.6, y0 + 2.4, -.01, .01);
        // 교실 사이 칸막이벽 (동측) — 마지막 교실은 코어 · 계단실 벽이 대신한다
        { const nx = LY.rooms[LY.rooms.indexOf(r) + 1]; if (nx && nx.kind === 'class') wallZ('wall', r.x2 - S.wall / 2, r.x2 + S.wall / 2, 0, zS, y0); }
        classroom(r, f, y0);
      } else if (r.kind === 'stair') {
        { const xi = r.x1 < 0 ? r.x2 : r.x1; wallZ('conc', xi - S.wall / 2, xi + S.wall / 2, zN, zS, y0, [{ a: zN + .1, b: zN + 2.6, y1: 0, y2: 2.2 }]); }   // 복도 쪽 벽만 (바깥쪽은 외벽), 방화문 개구부
        stair(r, f, y0);
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
  }
  // 옥상 슬래브 + 파라펫
  const yr = yf(S.floors);
  box('conc', -LY.L / 2 - T, LY.L / 2 + T, yr - S.slab, yr, zN - T, zS + T);
  box('brick', -LY.L / 2 - T, LY.L / 2 + T, yr, yr + 1.1, zS, zS + T, { u: 1.5 }); box('brick', -LY.L / 2 - T, LY.L / 2 + T, yr, yr + 1.1, zN - T, zN, { u: 1.5 });
  // 층간 띠 (외관 수평선)
  for (let f = 1; f <= S.floors; f++) { box('conc', -LY.L / 2 - T - .05, LY.L / 2 + T + .05, yf(f) - .3, yf(f), zS + T, zS + T + .08); }

  // ── 교실 ──
  function classroom(r, f, y0) {
    const x1 = r.x1 + S.wall / 2, x2 = r.x2 - S.wall / 2, z1 = S.wall / 2, z2 = zS;
    box('wood', x1, x2, y0, y0 + .02, z1, z2, { u: 2 });
    // 교단(높이 0.2) + 녹색 칠판 4.8m + 분필 받침 — 앞쪽(서측 벽)
    box('wood', x1, x1 + 1.2, y0, y0 + .2, z1 + 1.2, z2 - 1.2, { solid: false });
    walk.push({ x1, x2: x1 + 1.2, z1: z1 + 1.2, z2: z2 - 1.2, h: () => y0 + .2, f });
    box('board', x1 + .01, x1 + .04, y0 + .95, y0 + 2.15, (z1 + z2) / 2 - 2.4, (z1 + z2) / 2 + 2.4);
    box('alu', x1 + .04, x1 + .12, y0 + .9, y0 + .94, (z1 + z2) / 2 - 2.4, (z1 + z2) / 2 + 2.4);
    finishX(x1, x2, z2 - .001, -1, y0, [{ a: x1 + .4, b: x2 - .4, y1: .9, y2: 2.4 }]);
    // 교탁
    box('deskTop', x1 + 1.5, x1 + 2.1, y0, y0 + 1.05, (z1 + z2) / 2 - .45, (z1 + z2) / 2 + .45, { solid: true });
    // 학생 책상 · 의자 6열 × 6줄 = 36석 (1인용 650×500, 통로 0.6m)
    const cols = 6, rows = 6, dx = (x2 - x1 - 3.4) / rows, dz = (z2 - z1 - 1.4) / cols;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const cx = x1 + 2.9 + i * dx, cz = z1 + .75 + dz * (j + .5);
      box('deskTop', cx - .25, cx + .25, y0 + .70, y0 + .73, cz - .33, cz + .33);
      box('deskLeg', cx - .23, cx + .23, y0 + .55, y0 + .58, cz - .3, cz + .3);
      [[-.22, -.3], [-.22, .3], [.22, -.3], [.22, .3]].forEach(([a, b]) => box('deskLeg', cx + a - .015, cx + a + .015, y0, y0 + .7, cz + b - .015, cz + b + .015));
      col.push({ x1: cx - .25, x2: cx + .25, z1: cz - .33, z2: cz + .33, y1: y0, y2: y0 + .73 });
      const sx = cx + .42; box('deskTop', sx - .18, sx + .18, y0 + .42, y0 + .45, cz - .19, cz + .19); box('deskTop', sx + .16, sx + .19, y0 + .45, y0 + .82, cz - .19, cz + .19);
      [[-.15, -.16], [-.15, .16], [.15, -.16], [.15, .16]].forEach(([a, b]) => box('deskLeg', sx + a - .012, sx + a + .012, y0, y0 + .42, cz + b - .012, cz + b + .012));
    }
    // 뒤쪽 사물함 (36칸, 높이 1.2) + 게시판
    box('lockerM', x2 - .45, x2 - .02, y0, y0 + 1.2, z1 + .3, z2 - .3, { solid: true });
    for (let k = 0; k <= 12; k++) box('deskLeg', x2 - .46, x2 - .45, y0, y0 + 1.2, z1 + .3 + k * (z2 - z1 - .6) / 12 - .005, z1 + .3 + k * (z2 - z1 - .6) / 12 + .005);
    box('rubber', x2 - .03, x2 - .01, y0 + 1.4, y0 + 2.4, z1 + 1, z2 - 1);
    // 남측 창 아래 라디에이터, 천장 2등용 형광등 3×3, 선풍기 2, 스피커 · 시계 · 태극기 액자, 콘센트 · 스위치
    for (let k = 0; k < 4; k++) box('white', x1 + 1 + k * 2, x1 + 2.2 + k * 2, y0 + .15, y0 + .75, z2 - .2, z2 - .08);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) fluor(x1 + 1.6 + i * 2.9, y0 + S.CEIL - .05, z1 + 1.3 + j * 2.4, false);
    box('white', x1 + .02, x1 + .08, y0 + 2.25, y0 + 2.55, (z1 + z2) / 2 - .35, (z1 + z2) / 2 + .35);   // 태극기 액자
    box('white', x1 + .02, x1 + .06, y0 + 2.3, y0 + 2.6, z1 + .5, z1 + .8);   // 스피커
    box('rubber', x2 - .05, x2 - .01, y0 + 2.25, y0 + 2.55, (z1 + z2) / 2 - .15, (z1 + z2) / 2 + .15);   // 시계
    box('white', x1 + .3, x1 + .38, y0 + 1.2, y0 + 1.32, z1 + .01, z1 + .03);   // 스위치 박스
    detector((x1 + x2) / 2, y0 + S.CEIL, (z1 + z2) / 2);
    props.push({ kind: 'classroom', label: `${f + 1}학년 ${LY.rooms.filter(q => q.kind === 'class').indexOf(r) + 1}반`, x: (x1 + x2) / 2, y: y0, z: (z1 + z2) / 2, floor: f, x1, x2, z1, z2 });
  }
  // ── U자 계단 (층마다 2개 비행 + 중간 참) ──
  function stair(r, f, y0) {
    const w = (r.x2 - r.x1 - .3) / 2, xa = r.x1 + .15, xb = xa + w + .3, zA = zN + 2.8, zB = zS - 1.5, run = zB - zA, H = S.FH, n = 12, rise = H / 2 / n, tr = run / n;
    box('terr', r.x1, r.x2, y0, y0 + .02, zN, zA);   // 층 참 (보행면은 슬래브 쪽에서)
    if (f < S.floors - 1) {
      // 1비행: 서측 반, 남쪽으로 올라감 / 중간참: 남쪽 끝 / 2비행: 동측 반, 북쪽으로 올라감
      for (let i = 0; i < n; i++) { box('terr', xa, xa + w, y0, y0 + rise * (i + 1), zA + i * tr, zA + (i + 1) * tr); }
      walk.push({ x1: xa, x2: xa + w, z1: zA, z2: zB, h: (x, z) => y0 + Math.min(n, Math.max(0, Math.ceil((z - zA) / tr))) * rise, f, stair: true });
      box('terr', r.x1, r.x2, y0 + H / 2 - .25, y0 + H / 2, zB, zS);
      walk.push({ x1: r.x1, x2: r.x2, z1: zB, z2: zS, h: () => y0 + H / 2, f });
      {
        for (let i = 0; i < n; i++) box('terr', xb, xb + w, y0 + H / 2, y0 + H / 2 + rise * (i + 1), zB - (i + 1) * tr, zB - i * tr);
        walk.push({ x1: xb, x2: xb + w, z1: zA, z2: zB, h: (x, z) => y0 + H / 2 + Math.min(n, Math.max(0, Math.ceil((zB - z) / tr))) * rise, f, stair: true });
      }
      // 계단 난간: 중앙 칸막이벽(1.1m) + 핸드레일
      box('wain', xa + w, xb, y0, y0 + H / 2 + 1.1, zA, zB, { solid: true });
      box('deskLeg', xa + w - .02, xb + .02, y0 + H / 2 + 1.1, y0 + H / 2 + 1.15, zA, zB);
      // 계단 밑면(경사 슬래브)은 아래층 천장에서 보이지 않게 계단실 반자 제거
    }
    // 계단실은 반자 없음: 위층 슬래브에 2비행 구멍 (구멍은 슬래브를 다시 쪼개는 대신 계단실 위 슬래브를 생략)
    stairwells.push({ x1: r.x1, x2: r.x2, z1: zA, z2: zS, f });
    exitSign((r.x1 + r.x2) / 2, y0 + 2.35, zN + .05);
    extinguisher(r.x2 - .4, y0, zN + .4, 0);
    // 방화문 (계단실 ↔ 복도) 표시
    props.push({ kind: 'fireDoor', label: '계단실 방화문', x: r.x1 < 0 ? r.x2 : r.x1, y: y0 + 1, z: zN + 1.35, floor: f });
  }
  // ── 중앙 코어: 남녀 화장실 · 복도 세면대 · 층별 분전반 · 교무실(1층) ──
  function coreRoom(r, f, y0) {
    const xm = (r.x1 + r.x2) / 2;
    wallZ('wall', r.x1 - S.wall / 2, r.x1 + S.wall / 2, 0, zS, y0); wallZ('wall', r.x2 - S.wall / 2, r.x2 + S.wall / 2, 0, zS, y0);
    wallZ('wall', xm - .1, xm + .1, 0, zS, y0);
    const ops = [{ a: r.x1 + 1, b: r.x1 + 2, y1: 0, y2: 2.1 }, { a: r.x2 - 2, b: r.x2 - 1, y1: 0, y2: 2.1 }];
    wallX('wall', r.x1, r.x2, -S.wall / 2, S.wall / 2, y0, ops); finishX(r.x1, r.x2, -S.wall / 2, -1, y0, ops);
    [[r.x1, xm, '남'], [xm, r.x2, '여']].forEach(([a, b, g]) => {
      box('tile', a + .1, b - .1, y0, y0 + .02, .1, zS);
      for (let k = 0; k < 3; k++) { const sz = 2.4 + k * 1.6; box('white', a + .2, b - .2, y0, y0 + 2.0, sz - .02, sz + .02, { solid: true }); box('porc', b - 1.1, b - .5, y0, y0 + .4, sz + .3, sz + .9, { solid: true }); }
      for (let k = 0; k < 3; k++) box('porc', a + .25, a + .65, y0 + .75, y0 + .9, .6 + k * .7, 1.1 + k * .7);
      props.push({ kind: 'toilet', label: `${g}자 화장실`, x: (a + b) / 2, y: y0, z: 1.2, floor: f });
    });
    // 복도측 세면대 (수도 · 배관)
    for (let k = 0; k < 4; k++) { const x = r.x1 + 3 + k * 1; box('porc', x - .3, x + .3, y0 + .75, y0 + .9, zN + .05, zN + .55, { solid: true }); box('alu', x - .02, x + .02, y0 + .9, y0 + 1.1, zN + .08, zN + .12); }
    box('alu', r.x1 + 2.6, r.x1 + 6.4, y0 + .3, y0 + .35, zN + .02, zN + .06);   // 급수관
    props.push({ kind: 'sink', label: '복도 세면대', x: r.x1 + 4.5, y: y0 + .9, z: zN + .4, floor: f });
    // 층 분전반 (EPS)
    box('steelG', r.x2 - 1.4, r.x2 - .6, y0 + .6, y0 + 2.0, zN + .02, zN + .25, { solid: true });
    props.push({ kind: 'panel', label: `${f + 1}층 분전반`, x: r.x2 - 1, y: y0 + 1.3, z: zN + .3, floor: f });
  }
  function fluor(x, y, z, alongX) {   // 2등용 매입 형광등 (1200 × 300)
    const [a, b] = alongX ? [.6, .15] : [.15, .6];
    box('lamp', x - a, x + a, y - .02, y, z - b, z + b); lights.push({ x, y: y - .1, z });
  }
  function detector(x, y, z) { const g = new THREE.CylinderGeometry(.06, .07, .04, 12); g.translate(x, y - .02, z); (geo.get('white') || geo.set('white', []).get('white')).push(g); }
  function exitSign(x, y, z) { box('exitG', x - .2, x + .2, y, y + .14, z - .03, z + .03); }
  function extinguisher(x, y0, z) { const g = new THREE.CylinderGeometry(.08, .08, .5, 14); g.translate(x, y0 + .27, z); (geo.get('red') || geo.set('red', []).get('red')).push(g); props.push({ kind: 'extinguisher', label: '소화기', x, y: y0 + .3, z }); }
  function hydrant(x, y0, z) { box('red', x - .4, x + .4, y0 + .6, y0 + 1.8, z, z + .22, { solid: true }); props.push({ kind: 'hydrant', label: '옥내소화전', x, y: y0 + 1.2, z: z + .3 }); }

  // 계단실 위 슬래브 · 반자 구멍: 해당 층 위 슬래브에서 계단실 영역을 뺀다 — 단순화: 계단실 영역 위 반자 제거용 표시만 남긴다
  // 병합
  for (const [key, list] of geo) { const g = mergeGeometries(list, false); const m = new THREE.Mesh(g, mat[key]); m.castShadow = key !== 'glass' && key !== 'lamp'; m.receiveShadow = true; m.name = 'RB_' + key; root.add(m); }
  // 바닥 높이 조회 (계단 포함): 발 높이 기준으로 올라설 수 있는 가장 높은 면
  const groundAt = (x, z, feet) => { let best = null; for (const w of walk) { if (x < w.x1 || x > w.x2 || z < w.z1 || z > w.z2) continue; const h = w.h(x, z); if (h <= feet + .45 && (best == null || h > best)) best = h; } return best; };
  return { root, col, walk, props, lights, groundAt, layout: LY, spec: S, stairwells };
}
