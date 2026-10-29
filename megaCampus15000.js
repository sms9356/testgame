// 15,000평(약 50,000㎡) 캠퍼스 3대 섹션(①학술·생활 건물 섹션 ②종합 운동·스포츠 섹션 ③제1·제2 대형 주차장 섹션) 및 10종 .glb 모델(애니메이션 5종 포함) 빌더
import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';

export const MEGA_CAMPUS_ZONES = [   // 위치 이름표 (캠퍼스 재배치 후 좌표: 서쪽 학술 · 생활 / 동쪽 스포츠)
  { id: 'dorm', name: '청운학사 (기숙사 단지)', x: -86, z: -42, w: 22, d: 14, color: '#4a322c' },
  { id: 'lake', name: '청운호 수변공원 · 호심정', x: -9, z: -86, w: 34, d: 20, color: '#244e58' },
  { id: 'astro', name: '과학천문관 · 관측돔', x: -88, z: 14, w: 20, d: 16, color: '#2c3e54' },
  { id: 'history', name: '서문고 역사관 · 개교기념관', x: -88, z: -16, w: 16, d: 11, color: '#5a382e' },
  { id: 'fountain', name: '야외수돗가 · 씨름장', x: 56, z: -16, w: 12, d: 16, color: '#2e4a44' },
  { id: 'library', name: '중앙학술정보관 (대도서관)', x: 84, z: 39, w: 22, d: 18, color: '#4a3628' },
  { id: 'gym', name: '체육관', x: 84, z: -39, w: 20, d: 22, color: '#3a2a2a' },
  { id: 'tennis', name: '테니스 · 양궁 훈련장', x: 84, z: -17, w: 20, d: 16, color: '#224868' },
  { id: 'sports', name: '서문고 야구 스타디움', x: 84, z: 8, w: 24, d: 26, color: '#284a3a' },
  { id: 'bball', name: '야외농구장', x: 58, z: 7, w: 14, d: 15, color: '#3a2a22' },
  { id: 'pool', name: '실내 수영장', x: 58, z: 35, w: 14, d: 20, color: '#2a3a46' },
  { id: 'union', name: '학생회관 · 동아리관', x: -88, z: 42, w: 22, d: 14, color: '#48382e' },
];

export function buildMegaCampus15000({ THREE, OUT, F0, PM, pbox, pmesh, pcyl, makeSign, makeGlowTex, world, megaP }) {
  const chunks = [];
  const wallTpl = world.guardRoom?.templates?.wall;
  const brickM = wallTpl ? Object.assign(wallTpl.clone(), { color: new THREE.Color(0x7c4e40), roughness: .85 }) : PM(0x7c4e40, .85);
  const stoneM = wallTpl ? Object.assign(wallTpl.clone(), { color: new THREE.Color(0x9a948a), roughness: .82 }) : PM(0x9a948a, .82);
  const whiteWall = PM(0xd8d4c8, .78), wainscotM = PM(0x3a4844, .75), woodFloor = PM(0x563b24, .68), tileFloor = PM(0x646a68, .68);
  const darkMetal = PM(0x242a30, .42, .65), chromeM = PM(0xd4dade, .22, .88), woodDark = PM(0x462e1b, .74), woodLight = PM(0x8a643e, .72);
  const glassM = new THREE.MeshStandardMaterial({ color: 0x8ab8cc, roughness: .12, metalness: .22, transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false });
  const lampEm = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xffd898, emissiveIntensity: .95 });
  const greenLamp = new THREE.MeshStandardMaterial({ color: 0x50ffb0, emissive: 0x28d880, emissiveIntensity: .85 });
  const redFabric = PM(0x7a1e24, .85), blueFabric = PM(0x224468, .82), mattressM = PM(0xe6e2d8, .88), goldM = PM(0xc89a28, .3, .7);

  const addCol = (x1, x2, z1, z2, isWall = true, h = null, extra = null) => {
    const r = { x1: Math.min(x1, x2), x2: Math.max(x1, x2), z1: Math.min(z1, z2), z2: Math.max(z1, z2) };
    if (h != null) r.h = h;
    if (extra) Object.assign(r, extra);
    F0.col.push(r);
    if (isWall && h == null && !extra) F0.walls.push(r);
  };

  // 형광등 스위치 (출입문 옆 안쪽 벽) + 노출 전선관(스위치 → 천장 정션박스 → 벽 상단을 따라 등기구까지)
  const swPlateM = PM(0xece8dc, .5), swKeyM = PM(0x2c2c2a, .5), conduitM = PM(0x9a9c98, .5, .35);
  const addSwitch = (grp, x, z, ry, rect, top = 3.7, y0 = 0, label = '형광등 스위치') => {
    const nx = Math.sin(ry), nz = Math.cos(ry);
    pbox(.09, .13, .02, swPlateM, x, y0 + 1.3, z, grp, { ry, cast: false });
    pbox(.028, .05, .012, swKeyM, x + nx * .014, y0 + 1.31, z + nz * .014, grp, { ry, cast: false });
    pcyl(.013, .013, top - 1.37, conduitM, x + nx * .016, y0 + (1.37 + top) / 2, z + nz * .016, grp, { cast: false, seg: 8 });
    pbox(.1, .1, .05, conduitM, x + nx * .03, y0 + top - .12, z + nz * .03, grp, { ry, cast: false });
    pbox(Math.min(8, Math.max(rect.x2 - rect.x1, rect.z2 - rect.z1) - .6), .026, .026, conduitM, x + nx * .02, y0 + top - .12, z + nz * .02, grp, { ry, cast: false });
    world.props.push({ kind: 'robj', k: 'light_switch', t: 'mega15k', floor: 0, x: x + nx * .45, z: z + nz * .45, y: y0 + 1.3, r: 1.5, label: label + ' 끄기', sw: { grp, rect, on: true, base: label } });
  };
  // 화장실 (지하 · 옥상 제외 모든 층 필수): 모서리에 2.6 × 2.2m 칸 — 칸막이벽 2면(문 구멍) · 타일 바닥 · 양변기 · 세면대 · 거울 · 표지
  const wcTileM = PM(0xd8dcd8, .35), wcPorcM = PM(0xf2f2ee, .25), wcMirM = PM(0x9fb4bc, .1, .6), wcWallM = PM(0xe8e6de, .8);
  const addRestroom = (grp, cxw, czw, sx, sz, y0 = 0, h = 3.7, label = '화장실') => {   // (cxw, czw): 건물 안쪽 모서리 · sx/sz: 방이 펼쳐지는 방향(±1)
    const W = 2.6, D = 2.2, xa = cxw + sx * W, za = czw + sz * D, xm = Math.min(cxw, xa), xM = Math.max(cxw, xa), zm = Math.min(czw, za), zM = Math.max(czw, za);
    pbox(W, .02, D, wcTileM, (xm + xM) / 2, y0 + .06, (zm + zM) / 2, grp, { cast: false });
    // 칸막이벽: x = xa (z 방향 벽, 문 구멍 0.9m) · z = za (x 방향 벽)
    const dz1 = czw + sz * .5, dz2 = czw + sz * 1.4, d1 = Math.min(dz1, dz2), d2 = Math.max(dz1, dz2);
    [[zm, d1], [d2, zM]].forEach(([a, b]) => { if (b - a > .05) { pbox(.12, h, b - a, wcWallM, xa, y0 + h / 2, (a + b) / 2, grp); addCol(xa - .06, xa + .06, a, b, false, null, y0 > 1 ? { y0: y0 - .1 } : { maxY: y0 + h }); } });
    pbox(.12, h - 2.1, d2 - d1, wcWallM, xa, y0 + 2.1 + (h - 2.1) / 2, (d1 + d2) / 2, grp, { cast: false });
    pbox(W + .12, h, .12, wcWallM, (xm + xM) / 2, y0 + h / 2, za, grp); addCol(xm - .06, xM + .06, za - .06, za + .06, false, null, y0 > 1 ? { y0: y0 - .1 } : { maxY: y0 + h });
    // 변기 (안쪽 벽에 붙여) · 세면대 · 거울
    const tx = cxw + sx * .45, tz = czw + sz * 1.55;
    pbox(.42, .4, .55, wcPorcM, tx, y0 + .26, tz, grp); pbox(.2, .45, .5, wcPorcM, cxw + sx * .12, y0 + .62, tz, grp); addCol(Math.min(cxw, tx + sx * .3), Math.max(cxw, tx + sx * .3), tz - .3, tz + .3, false, y0 + .46, y0 > 1 ? { y0: y0 - .1 } : null);
    const kx = cxw + sx * 1.9, kz = czw + sz * .3;
    pbox(.5, .14, .4, wcPorcM, kx, y0 + .84, kz, grp); pbox(.08, .78, .08, wcPorcM, kx, y0 + .4, kz, grp); pmesh(new THREE.PlaneGeometry(.5, .7), wcMirM, kx, y0 + 1.55, czw + sz * .02, grp, { ry: sz > 0 ? 0 : Math.PI, cast: false });
    pmesh(new THREE.PlaneGeometry(.9, .24), new THREE.MeshBasicMaterial({ map: makeSign('🚻 ' + label, '#1f3f6f', '#ffffff', 24) }), xa - sx * .07, y0 + 2.3, (d1 + d2) / 2, grp, { ry: sx > 0 ? -Math.PI / 2 : Math.PI / 2, cast: false });
    world.props.push({ kind: 'robj', k: 'campus_wc', t: 'mega15k', floor: 0, x: tx + sx * .6, z: tz - sz * .4, y: y0 + .6, r: 1.3, label: label + ' 세면대 · 변기 살펴보기' });
  };
  const warmWinEm = new THREE.MeshStandardMaterial({ color: 0xd8eef8, emissive: 0xffe0a8, emissiveIntensity: .62, roughness: .18, metalness: .2 });
  const buildShell = (grp, cx, cz, W, D, H, wallMat, roofMat, doorSide, flMat = woodFloor) => {
    const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2, t = .32, dw = 3.0, dh = 2.6;
    pbox(W, .06, D, flMat, cx, .03, cz, grp, { cast: false });
    pbox(W, .12, D, whiteWall, cx, 3.85, cz, grp, { cast: false });
    pbox(W + .76, .36, D + .76, stoneM, cx, H + .18, cz, grp);
    pbox(W + .42, .45, D + .42, roofMat, cx, H + .56, cz, grp);
    // 외벽 4면 하단 화강암 기단(Plinth) & 중간 층간 코니스 몰딩(Belt Course, y = 4.25m) & 코너 석조 기둥(Pilasters)
    pbox(W + .82, 1.05, .14, stoneM, cx, .525, z0 - t - .05, grp, { cast: false });
    pbox(W + .82, 1.05, .14, stoneM, cx, .525, z1 + t + .05, grp, { cast: false });
    pbox(.14, 1.05, D + .82, stoneM, x0 - t - .05, .525, cz, grp, { cast: false });
    pbox(.14, 1.05, D + .82, stoneM, x1 + t + .05, .525, cz, grp, { cast: false });
    if (H > 6.5) pbox(W + .86, .24, D + .86, stoneM, cx, 4.25, cz, grp, { cast: false });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      pbox(.54, H + .2, .54, stoneM, cx + sx * (W / 2 + t * .6), H / 2, cz + sz * (D / 2 + t * .6), grp, { cast: false });
    });
    // 4면 외벽 1층(y=2.15m) · 2층(y=6.15m) 입체 멀리언 창틀 & 석재 창턱/상인방 & 은은한 실내 채광창
    const addExtWin = (wx, wy, wz, alongZ = false) => {
      if (alongZ) {
        pmesh(new THREE.PlaneGeometry(1.62, 1.42), warmWinEm, wx, wy, wz, grp, { ry: wx < cx ? -Math.PI / 2 : Math.PI / 2, cast: false });
        pbox(.18, .12, 1.82, stoneM, wx, wy - .74, wz, grp, { cast: false });
        pbox(.20, .16, 1.86, stoneM, wx, wy + .75, wz, grp, { cast: false });
        pbox(.12, 1.42, .06, darkMetal, wx, wy, wz, grp, { cast: false });
        pbox(.12, .05, 1.62, darkMetal, wx, wy + .12, wz, grp, { cast: false });
      } else {
        pmesh(new THREE.PlaneGeometry(1.72, 1.42), warmWinEm, wx, wy, wz, grp, { ry: wz < cz ? Math.PI : 0, cast: false });
        pbox(1.92, .12, .18, stoneM, wx, wy - .74, wz, grp, { cast: false });
        pbox(1.96, .16, .20, stoneM, wx, wy + .75, wz, grp, { cast: false });
        pbox(.06, 1.42, .12, darkMetal, wx, wy, wz, grp, { cast: false });
        pbox(1.72, .05, .12, darkMetal, wx, wy + .12, wz, grp, { cast: false });
      }
    };
    for (const fy of [2.15, 6.15]) {
      if (fy > H - 1.2) continue;
      for (const dx of [-6.8, -2.4, 2.4, 6.8]) {
        if (Math.abs(dx) > W / 2 - 1.6) continue;
        addExtWin(cx + dx, fy, z0 - t - .04, false);
        if (!(doorSide === 'S' && fy < 3.5 && Math.abs(dx) < 2.2)) addExtWin(cx + dx, fy, z1 + t + .04, false);
      }
      for (const dz of [-5.2, -2.2, 2.2, 5.2]) {
        if (Math.abs(dz) > D / 2 - 1.5) continue;
        if (!(doorSide === 'W' && fy < 3.5 && Math.abs(dz) < 2.6)) addExtWin(x0 - t - .04, fy, cz + dz, true);
        if (!(doorSide === 'E' && fy < 3.5 && Math.abs(dz) < 2.6)) addExtWin(x1 + t + .04, fy, cz + dz, true);
      }
    }
    pbox(W - .1, 1.1, .06, wainscotM, cx, .55, z0 + .04, grp, { cast: false });
    if (doorSide !== 'S') pbox(W - .1, 1.1, .06, wainscotM, cx, .55, z1 - .04, grp, { cast: false });
    if (doorSide !== 'W') pbox(.06, 1.1, D - .1, wainscotM, x0 + .04, .55, cz, grp, { cast: false });
    if (doorSide !== 'E') pbox(.06, 1.1, D - .1, wainscotM, x1 - .04, .55, cz, grp, { cast: false });
    pbox(W + 2 * t, H, t, wallMat, cx, H / 2, z0 - t / 2, grp); addCol(x0 - t, x1 + t, z0 - t, z0, true);
    if (doorSide === 'S') {
      const sw = (W - dw) / 2;
      pbox(sw, H, t, wallMat, x0 + sw / 2, H / 2, z1 + t / 2, grp); addCol(x0, cx - dw / 2, z1, z1 + t, true);
      pbox(sw, H, t, wallMat, x1 - sw / 2, H / 2, z1 + t / 2, grp); addCol(cx + dw / 2, x1, z1, z1 + t, true);
      pbox(dw, H - dh, t, wallMat, cx, dh + (H - dh) / 2, z1 + t / 2, grp);
    } else {
      pbox(W + 2 * t, H, t, wallMat, cx, H / 2, z1 + t / 2, grp); addCol(x0 - t, x1 + t, z1, z1 + t, true);
    }
    if (doorSide === 'W') {
      const sw = (D - dw) / 2;
      pbox(t, H, sw, wallMat, x0 - t / 2, H / 2, z0 + sw / 2, grp); addCol(x0 - t, x0, z0, cz - dw / 2, true);
      pbox(t, H, sw, wallMat, x0 - t / 2, H / 2, z1 - sw / 2, grp); addCol(x0 - t, x0, cz + dw / 2, z1, true);
      pbox(t, H - dh, dw, wallMat, x0 - t / 2, dh + (H - dh) / 2, cz, grp);
    } else {
      pbox(t, H, D, wallMat, x0 - t / 2, H / 2, cz, grp); addCol(x0 - t, x0, z0, z1, true);
    }
    if (doorSide === 'E') {
      const sw = (D - dw) / 2;
      pbox(t, H, sw, wallMat, x1 + t / 2, H / 2, z0 + sw / 2, grp); addCol(x1, x1 + t, z0, cz - dw / 2, true);
      pbox(t, H, sw, wallMat, x1 + t / 2, H / 2, z1 - sw / 2, grp); addCol(x1, x1 + t, cz + dw / 2, z1, true);
      pbox(t, H - dh, dw, wallMat, x1 + t / 2, dh + (H - dh) / 2, cz, grp);
    } else {
      pbox(t, H, D, wallMat, x1 + t / 2, H / 2, cz, grp); addCol(x1, x1 + t, z0, z1, true);
    }
    [[-W * .28, -D * .26], [0, -D * .26], [W * .28, -D * .26], [-W * .28, D * .26], [0, D * .26], [W * .28, D * .26]].forEach(([lx, lz]) => {
      pbox(1.35, .04, .32, darkMetal, cx + lx, 3.78, cz + lz, grp, { cast: false });
      pbox(1.22, .05, .20, lampEm, cx + lx, 3.74, cz + lz, grp, { cast: false });
    });
    { const rect = { x1: x0, x2: x1, z1: z0, z2: z1 }, o = dw / 2 + .4;
      if (doorSide === 'W') addRestroom(grp, x1, z0, -1, 1); else addRestroom(grp, x0, z0, 1, 1);
      if (doorSide === 'W') addSwitch(grp, x0 + .01, cz - o, Math.PI / 2, rect);
      else if (doorSide === 'E') addSwitch(grp, x1 - .01, cz - o, -Math.PI / 2, rect);
      else addSwitch(grp, cx - o, z1 - .01, Math.PI, rect); }
  };
  // 캠퍼스 건물 실내 칸막이벽 (축 정렬 · 두께 .14 · 천장 3.85) — gaps: 벽 축을 따라 [a, b] 출입 개구부 (문틀 위 인방 포함)
  const iwall = (grp, ax, az, bx, bz, gaps = [], mat = whiteWall) => {
    const alongX = Math.abs(bz - az) < 1e-6, a0 = alongX ? Math.min(ax, bx) : Math.min(az, bz), a1 = alongX ? Math.max(ax, bx) : Math.max(az, bz), t = .14, H = 3.85;
    const seg = (s, e, y1 = 0, y2 = H, col = true) => { if (e - s < .02) return; const m = (s + e) / 2;
      if (alongX) pbox(e - s, y2 - y1, t, mat, m, (y1 + y2) / 2, az, grp); else pbox(t, y2 - y1, e - s, mat, ax, (y1 + y2) / 2, m, grp);
      if (col) alongX ? addCol(s, e, az - t / 2, az + t / 2) : addCol(ax - t / 2, ax + t / 2, s, e); };
    let p = a0; [...gaps].sort((u, v) => u[0] - v[0]).forEach(([g1, g2]) => { seg(p, g1); seg(g1, g2, 2.2, H, false);
      alongX ? pbox(.06, 2.2, t + .04, darkMetal, g1, 1.1, az, grp, { cast: false }) : pbox(t + .04, 2.2, .06, darkMetal, ax, 1.1, g1, grp, { cast: false });
      alongX ? pbox(.06, 2.2, t + .04, darkMetal, g2, 1.1, az, grp, { cast: false }) : pbox(t + .04, 2.2, .06, darkMetal, ax, 1.1, g2, grp, { cast: false }); p = g2; });
    seg(p, a1);
  };
  // 공용 가구: 철제 선반 · 진열장 · 책상
  const steelShelf = (grp, x, z, w, d, h = 1.8, boxM = null) => { const sM = PM(0x6a6e72, .5, .55); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => pbox(.04, h, .04, sM, x + a * (w / 2 - .02), h / 2, z + b * (d / 2 - .02), grp, { cast: false }));
    for (let r = 0; r < 4; r++) { pbox(w, .025, d, sM, x, .1 + r * (h - .15) / 3, z, grp, { cast: false }); if (boxM && r < 3) pbox(w * .8, .26, d * .8, boxM, x, .25 + r * (h - .15) / 3, z, grp, { cast: false }); }
    addCol(x - w / 2, x + w / 2, z - d / 2, z + d / 2); };
  const vitrine = (grp, x, z, w, d, h = .95, alongZ = false) => { const W2 = alongZ ? d : w, D2 = alongZ ? w : d; pbox(W2, h - .35, D2, woodDark, x, (h - .35) / 2, z, grp); pbox(W2 - .04, .35, D2 - .04, glassM, x, h - .175, z, grp, { cast: false }); pbox(W2 * .5, .08, D2 * .3, goldM, x, h - .3, z, grp, { cast: false }); addCol(x - W2 / 2, x + W2 / 2, z - D2 / 2, z + D2 / 2, false, h); };
  const tallCase = (grp, x, z, w, d, ry = 0) => { const alongZ = Math.abs(Math.sin(ry)) > .5, W2 = alongZ ? d : w, D2 = alongZ ? w : d; pbox(W2, .5, D2, woodDark, x, .25, z, grp); pbox(W2 - .04, 1.55, D2 - .04, glassM, x, 1.3, z, grp, { cast: false }); pbox(W2, .06, D2, woodDark, x, 2.1, z, grp, { cast: false });
    for (let k = 0; k < 3; k++) pmesh(new THREE.DodecahedronGeometry(.1, 0), PM([0xc8a060, 0x8a6a48, 0x608aa0][k], .5, .3), x + (alongZ ? 0 : (k - 1) * W2 * .3), .95 + k * .4, z + (alongZ ? (k - 1) * D2 * .3 : 0), grp); addCol(x - W2 / 2, x + W2 / 2, z - D2 / 2, z + D2 / 2); };
  const deskT = (grp, x, z, w, d, h = .74, top = woodLight, leg = darkMetal) => { pbox(w, .04, d, top, x, h - .02, z, grp); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => pbox(.05, h - .04, .05, leg, x + a * (w / 2 - .05), (h - .04) / 2, z + b * (d / 2 - .05), grp, { cast: false })); addCol(x - w / 2, x + w / 2, z - d / 2, z + d / 2, false, h); };
  const monitor = (grp, x, y, z, ry) => { pbox(.5, .32, .04, PM(0x101418, .4, .5), x, y + .26, z, grp, { ry, cast: false }); pbox(.46, .28, .01, new THREE.MeshBasicMaterial({ color: 0x2a6ab8 }), x + Math.sin(ry) * .025, y + .26, z + Math.cos(ry) * .025, grp, { ry, cast: false }); pbox(.06, .1, .06, darkMetal, x, y + .05, z, grp, { cast: false }); };
  // 야외 체육시설 철망 펜스 (아연도 기둥 + 녹색 철망 · 높이 h) — gaps: 출입구 [a, b]
  const fenceMesh = new THREE.MeshStandardMaterial({ color: 0x2a5a3a, roughness: .6, metalness: .3, transparent: true, opacity: .42, side: THREE.DoubleSide, depthWrite: false });
  const fenceLine = (grp, ax, az, bx, bz, h = 3.0, gaps = []) => { const alongX = Math.abs(bz - az) < 1e-6, a0 = alongX ? Math.min(ax, bx) : Math.min(az, bz), a1 = alongX ? Math.max(ax, bx) : Math.max(az, bz), postM = PM(0x8a9094, .45, .6);
    const seg = (s, e) => { if (e - s < .05) return; const m = (s + e) / 2; alongX ? pbox(e - s, h, .02, fenceMesh, m, h / 2, az, grp, { cast: false }) : pbox(.02, h, e - s, fenceMesh, ax, h / 2, m, grp, { cast: false });
      alongX ? pbox(e - s, .05, .05, postM, m, h, az, grp, { cast: false }) : pbox(.05, .05, e - s, postM, ax, h, m, grp, { cast: false });
      for (let p = s; p <= e + .01; p += Math.max(1, (e - s) / Math.ceil((e - s) / 2.0))) alongX ? pcyl(.04, .04, h, postM, p, h / 2, az, grp) : pcyl(.04, .04, h, postM, ax, h / 2, p, grp);
      alongX ? addCol(s, e, az - .06, az + .06) : addCol(ax - .06, ax + .06, s, e); };
    let p = a0; [...gaps].sort((u, v) => u[0] - v[0]).forEach(([g1, g2]) => { seg(p, g1); p = g2; }); seg(p, a1); };
  const benchS = (grp, x, z, w = 1.8, alongZ = false) => { pbox(alongZ ? .45 : w, .06, alongZ ? w : .45, woodLight, x, .45, z, grp); [-1, 1].forEach(s => pbox(alongZ ? .4 : .06, .42, alongZ ? .06 : .4, darkMetal, x + (alongZ ? 0 : s * (w / 2 - .15)), .21, z + (alongZ ? s * (w / 2 - .15) : 0), grp, { cast: false })); addCol(x - (alongZ ? .25 : w / 2), x + (alongZ ? .25 : w / 2), z - (alongZ ? w / 2 : .25), z + (alongZ ? w / 2 : .25), false, .5); };
  const shed = (grp, x, z, w, d, label) => { pbox(w, 2.2, d, PM(0x8a8e90, .5, .45), x, 1.1, z, grp); pbox(w + .2, .08, d + .2, PM(0x6a6e72, .5, .5), x, 2.24, z, grp); for (let k = 0; k < Math.round(w / .3); k++) pbox(.02, 2.1, .01, PM(0x6a6e72, .5, .5), x - w / 2 + .15 + k * .3, 1.1, z + d / 2 + .005, grp, { cast: false });
    pbox(1.2, 1.9, .03, PM(0x7a7e82, .5, .4), x, .95, z + d / 2 + .02, grp, { cast: false }); addCol(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    if (label) pmesh(new THREE.PlaneGeometry(1.4, .24), new THREE.MeshBasicMaterial({ map: makeSign(label, '#1c2a24', '#e8f0e8', 18) }), x, 2.0, z + d / 2 + .04, grp, { cast: false }); };
  const lightPole = (grp, x, z, h = 6.0) => { pcyl(.08, .12, h, PM(0x8a9094, .45, .6), x, h / 2, z, grp); pbox(.9, .3, .25, lampEm, x, h + .1, z, grp, { cast: false }); };

  const addChair = (grp, x, z, ry = 0, colMat = woodDark) => {
    const cg = new THREE.Group(); cg.position.set(x, 0, z); cg.rotation.y = ry; grp.add(cg);
    pbox(.44, .05, .44, colMat, 0, .44, 0, cg);
    pbox(.44, .42, .05, colMat, 0, .66, -.20, cg);
    [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]].forEach(([lx, lz]) => pbox(.04, .44, .04, darkMetal, lx, .22, lz, cg));
  };

  // ── 5대 섹션 게이트 아치 현판 ──
  [
    [-52, -33.8, Math.PI / 2, '◀ [학술·생활 섹션] 청운학사 · 역사관 · 과학천문관'],
    [-52, 55.6, Math.PI / 2, '◀ [학생문화 섹션] 학생회관·소극장  |  서문(西門)'],
    [52, -33.8, -Math.PI / 2, '[학술·연구 섹션] 과학천문관 · 생물부 생태온실 ▶'],
    [52, 36.6, -Math.PI / 2, '[학술·복지 섹션] 중앙학술정보관(대도서관) · 학교매점 ▶'],
    [-9, -64, 0, '▲ [생태공원 섹션] 청운호 수변공원 · 호심정 팔각정'],
  ].forEach(([gx, gz, ry, title]) => {
    const ag = new THREE.Group(); ag.position.set(gx, 0, gz); ag.rotation.y = ry; ag.userData.dynamic = true; OUT.add(ag);
    [-3.2, 3.2].forEach(ox => {
      pbox(.42, 3.45, .42, stoneM, ox, 1.725, 0, ag);
      pbox(.56, .32, .56, darkMetal, ox, .16, 0, ag);
    });
    pbox(7.8, .42, .65, stoneM, 0, 3.45, 0, ag);
    pbox(6.4, .56, .14, darkMetal, 0, 3.85, 0, ag, { cast: false });
    pmesh(new THREE.PlaneGeometry(6.2, .48), new THREE.MeshBasicMaterial({ map: makeSign(title, '#162834', '#f2ead2', 20), side: THREE.DoubleSide }), 0, 3.85, .08, ag, { cast: false });
    pmesh(new THREE.PlaneGeometry(6.2, .48), new THREE.MeshBasicMaterial({ map: makeSign(title, '#162834', '#f2ead2', 20), side: THREE.DoubleSide }), 0, 3.85, -.08, ag, { ry: Math.PI, cast: false });
  });

  /* =========================================================================
     ① [학술·생활 섹션] 청운학사 (Pro 3D Environment Team 리빌드 — 4K PBR 아틀라스 쉘 + 하이폴리곤 3D 가구 .glb 5종!) — 서북 (x: -86, z: -42)
     - 외관: 화강암 코너 기둥(Quoin Pilasters) · 1/2층 화강암 코니스 몰딩 · 다중 멀리언 창틀 & 철창살 · 박공 페디먼트 포치 · 배수 홈통
     - 실내 1F(y=0.0m): 헤링본 원목 마루 · 웨인스코팅/습기벽지 · 격자유리 사감실 파티션 가벽 · 2x2 CRT 보안관제석 · 빈티지 가죽 퀼팅 소파 라운지 · 22동자주 주철 난간 계단
     - 실내 2F(y=3.85m): 201호/202호 원목 문짝 & 복도 파티션 · 원통형 강철 파이프 2층침대 4기 · 심야 정독실 카렐 부스 4기 · 천장 우물형 코퍼 보 & 벽부등
     ========================================================================= */
  {
    const cx = -86, cz = -42, W = 22, D = 14, H = 8.4, Y2 = 3.85;
    const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2, t = .32, dw = 3.0, dh = 2.6;
    const g = new THREE.Group(); g.name = 'chunk_dorm'; g.userData.dynamic = true; OUT.add(g);
    const walnutM = PM(0x3b2618, .64, .08), darkPlasterM = PM(0x4e4c46, .88), brassM = PM(0xb8923a, .32, .78), ironBalM = PM(0x1e2226, .45, .72);

    // 1) 구조 외벽 쉘 & 옥상 지붕 코니스 + 배수 파이프 (PBR 아틀라스 쉘 sf_pro_dorm_arch_trim.glb 와 정밀 결합!)
    pbox(W, .05, D, walnutM, cx, .025, cz, g, { cast: false });
    pbox(W + .7, .36, D + .7, stoneM, cx, H + .18, cz, g);
    pbox(W + .4, .45, D + .4, darkMetal, cx, H + .56, cz, g);
    // 외벽 하단 화강암 기단 & 창문 아래 주철 라디에이터/석재 창턱
    pbox(W + .76, 1.05, .14, stoneM, cx, .525, z0 - t - .05, g, { cast: false });
    pbox(W + .76, 1.05, .14, stoneM, cx, .525, z1 + t + .05, g, { cast: false });
    pbox(.14, 1.05, D + .76, stoneM, x0 - t - .05, .525, cz, g, { cast: false });
    // 북벽 · 남벽 · 서벽 · 동벽(정문 개방)
    pbox(W + 2 * t, H, t, brickM, cx, H / 2, z0 - t / 2, g); addCol(x0 - t, x1 + t, z0 - t, z0, true);
    pbox(W + 2 * t, H, t, brickM, cx, H / 2, z1 + t / 2, g); addCol(x0 - t, x1 + t, z1, z1 + t, true);
    pbox(t, H, D, brickM, x0 - t / 2, H / 2, cz, g);       addCol(x0 - t, x0, z0, z1, true);
    {
      const sw = (D - dw) / 2;
      pbox(t, H, sw, brickM, x1 + t / 2, H / 2, z0 + sw / 2, g); addCol(x1, x1 + t, z0, cz - dw / 2, true);
      pbox(t, H, sw, brickM, x1 + t / 2, H / 2, z1 - sw / 2, g); addCol(x1, x1 + t, cz + dw / 2, z1, true);
      pbox(t, H - dh, dw, brickM, x1 + t / 2, dh + (H - dh) / 2, cz, g);
    }

    // 정문 클래식 엔타블러처 포치 & 원형 석조 기둥 4기 + 청동 현판
    pbox(2.2, .22, 5.0, stoneM, x1 + 1.15, .11, cz, g, { cast: false });
    pbox(2.0, .28, 4.8, stoneM, x1 + 1.15, 3.12, cz, g);
    pbox(2.2, .22, 5.2, darkMetal, x1 + 1.15, 3.36, cz, g);
    [-2.0, 2.0].forEach(dz => {
      pbox(.42, .45, .42, stoneM, x1 + 1.85, .225, cz + dz, g);
      pcyl(.17, .20, 2.6, stoneM, x1 + 1.85, 1.72, cz + dz, g);
      pbox(.38, .22, .38, stoneM, x1 + 1.85, 2.98, cz + dz, g);
    });
    pbox(.14, .68, 4.6, ironBalM, x1 + 2.18, 3.56, cz, g, { cast: false });
    pmesh(new THREE.PlaneGeometry(4.4, .56), new THREE.MeshBasicMaterial({ map: makeSign('靑 雲 學 舍 (청운학사) — 제1학생생활관 · 심야정독실', '#18242c', '#f2e4c4', 22) }), x1 + 2.26, 3.56, cz, g, { ry: Math.PI / 2, cast: false });

    // 동벽 · 남벽 · 북벽 1층/2층 입체 멀리언 창틀 & 석재 상인방/창턱 & 방범 창살
    for (let fy of [2.05, 5.85]) {
      for (let dz of [-4.8, -2.4, 2.4, 4.8]) {
        pmesh(new THREE.PlaneGeometry(1.56, 1.32), glassM, x1 + .36, fy, cz + dz, g, { ry: Math.PI / 2, cast: false });
        pbox(.22, .12, 1.74, stoneM, x1 + .40, fy - .68, cz + dz, g, { cast: false }); // 석재 창턱(Sill)
        pbox(.20, .16, 1.78, stoneM, x1 + .39, fy + .70, cz + dz, g, { cast: false }); // 석재 상인방(Lintel)
        pbox(.12, 1.32, .06, walnutM, x1 + .36, fy, cz + dz, g, { cast: false });      // 중앙 수직 창살(Mullion)
        pbox(.12, .05, 1.56, walnutM, x1 + .36, fy + .12, cz + dz, g, { cast: false }); // 수평 창살(Transom)
      }
      for (let dx of [-7.5, -2.5, 2.5, 7.5]) {
        pbox(1.78, .16, .20, stoneM, cx + dx, fy + .70, z1 + .39, g, { cast: false });
        pbox(1.74, .12, .22, stoneM, cx + dx, fy - .68, z1 + .40, g, { cast: false });
      }
    }

    // (2층 동남쪽 돌출 발코니는 받침 · 출입문 없이 벽에 떠 있는 판자처럼 보여 철거)

    // 2) 북쪽 벽면 16단 화강암·월넛 실내 직통 계단 + 22개 주철 동자주(Balusters) & 뉴얼 포스트 난간!
    for (let st = 0; st < 16; st++) {
      const sx1 = -93.2 + st * .60, sx2 = sx1 + .62, sh = (st + 1) * (Y2 / 16);
      pbox(.62, sh, 2.32, stoneM, (sx1 + sx2) / 2, sh / 2, z0 + 1.25, g);
      pbox(.66, .045, 2.38, walnutM, (sx1 + sx2) / 2, sh + .015, z0 + 1.25, g, { cast: false });
      addCol(sx1, sx2, z0 + .1, z0 + 2.45, false, sh);
      // 계단 단마다 수직 주철 동자주 기둥 설치!
      if (st >= 2) pcyl(.018, .018, .92, ironBalM, (sx1 + sx2) / 2, sh + .46, z0 + 2.42, g);   // 첫 두 단은 남쪽(라운지)에서 올라서는 입구라 비워 둔다
    }
    // 계단 상·하단 원목 뉴얼 포스트 기둥 & 경사 핸드레일
    pbox(.16, 1.15, .16, walnutM, -91.95, .58 + Y2 / 8, z0 + 2.42, g);
    pbox(.16, 1.15, .16, walnutM, -83.65, Y2 + .58, z0 + 2.42, g);
    pbox(8.75, .09, .10, walnutM, -87.75, Y2 / 2 + Y2 / 16 + .94, z0 + 2.42, g, { rz: Math.atan2(Y2, 9.6) });
    addCol(-92.0, -83.7, z0 + 2.38, z0 + 2.56, false, null, { maxY: 3.6 });

    // 3) 2층 철근콘크리트 구조 슬래브 & 1·2층 천장 우물형 코퍼 목재 보(Ceiling Coffer Beams)
    pbox(W, .18, D - 2.5, walnutM, cx, Y2 - .09, cz + 1.25, g);
    pbox(W, .04, D - 2.5, darkPlasterM, cx, Y2 - .19, cz + 1.25, g, { cast: false });
    addCol(x0 + .2, x1 - .2, z0 + 2.45, z1 - .2, false, Y2, { y0: 3.50 });
    pbox(x1 - (-84.0), .18, 2.5, walnutM, (-84.0 + x1) / 2, Y2 - .09, z0 + 1.25, g);
    addCol(-84.05, x1 - .2, z0 + .1, z0 + 2.5, false, Y2, { y0: 3.50 });

    // 2층 계단 홀 추락 방지 주철 동자주 발코니 난간 (24개 동자주 + 원목 상단 레일)
    pbox(10.2, .08, .12, walnutM, -89.0, Y2 + .96, z0 + 2.52, g);
    pbox(10.2, .12, .14, walnutM, -89.0, Y2 + .06, z0 + 2.52, g);
    for (let bx = -93.8; bx <= -84.0; bx += .42) {
      pcyl(.018, .018, .90, ironBalM, bx, Y2 + .51, z0 + 2.52, g);
    }

    // 1층 및 2층 천장 우물형 코퍼 목재 보(Coffer Beams) & 크라운 몰딩 — 2D 박스 느낌을 완전히 없애는 클래식 건축 디테일!
    [Y2 - .26, H - .14].forEach(cy => {
      for (let bx = x0 + 3.5; bx < x1 - 2.0; bx += 4.8) {
        pbox(.24, .18, D - .2, walnutM, bx, cy, cz, g, { cast: false });
      }
      [-D * .28, D * .28].forEach(bz => {
        pbox(W - .2, .16, .22, walnutM, cx, cy + .01, cz + bz, g, { cast: false });
      });
    });

    // 4) 실내 공간 분할 파티션 가벽 & 격자 유리창 (1층 사감실 / 2층 201호·202호 침실 / 2층 심야 정독실)
    // 1층 사감실 격자 유리창 목재 파티션 가벽 (x = cx + 3.2, z: cz + 1.2 ~ z1)
    pbox(.18, 1.15, 2.6, walnutM, cx + 3.2, .575, cz + 5.6, g);
    pmesh(new THREE.PlaneGeometry(2.4, 1.35), glassM, cx + 3.2, 1.82, cz + 5.6, g, { ry: Math.PI / 2, cast: false });
    [-0.6, 0, 0.6].forEach(dz => pbox(.20, 1.35, .05, walnutM, cx + 3.2, 1.82, cz + 5.6 + dz, g, { cast: false }));
    addCol(cx + 3.05, cx + 3.35, cz + 4.3, z1 - .1, false, null, { maxY: 2.6 });   // 유리 칸막이 (북쪽 z cz+3.1~4.3 은 사감실 문)
    pmesh(new THREE.PlaneGeometry(1.4, .32), new THREE.MeshBasicMaterial({ map: makeSign('1F 사감실 · 보안관제실', '#1b2822', '#f0dfc0', 22) }), cx + 3.09, 2.62, cz + 2.1, g, { ry: -Math.PI / 2, cast: false });

    // 2층 서쪽 침실(201호·202호) 복도 파티션 충돌체 및 호실 명패 (문 위치 z: cz - 1.6 ~ cz + 0.2 및 cz + 2.8 ~ cz + 4.6 개방!)
    pmesh(new THREE.PlaneGeometry(1.1, .28), new THREE.MeshBasicMaterial({ map: makeSign('201호 생활실', '#241812', '#f4e2b8', 24) }), cx - 4.08, Y2 + 2.52, cz - .7, g, { ry: Math.PI / 2, cast: false });
    pmesh(new THREE.PlaneGeometry(1.1, .28), new THREE.MeshBasicMaterial({ map: makeSign('202호 생활실', '#241812', '#f4e2b8', 24) }), cx - 4.08, Y2 + 2.52, cz + 3.7, g, { ry: Math.PI / 2, cast: false });

    // 2층 동쪽 심야 정독실 복도 파티션 충돌체 및 현판 (문 위치 z: cz + 1.2 ~ cz + 3.1 개방!)
    pmesh(new THREE.PlaneGeometry(2.6, .42), new THREE.MeshBasicMaterial({ map: makeSign('2F 심야 정독실 (STUDY ROOM) — 정숙 엄수', '#162820', '#88ffb8', 22) }), cx + 1.68, Y2 + 2.56, cz + 2.15, g, { ry: -Math.PI / 2, cast: false });

    // 4-b) 방 나누기 (실제 벽 · 문틀 · 문짝 · 명패): 예전엔 2층 칸막이가 보이지 않는 충돌벽뿐이었고 1층 사감실은 낮은 유리벽 하나였다
    //   1층: 현관 로비 · 사감실(동남) · 휴게 라운지(서남) · 공용 화장실 · 샤워실(서북)
    //   2층: 201호 · 202호(서쪽) · 중앙 복도 · 심야 정독실(동쪽)
    {
      const FH1 = Y2 - .2, FH2 = H - Y2 - .3;
      // 벽 한 토막: 하부 판넬(웨인스콧) + 상부 회벽, 층에 맞는 충돌 (1층 maxY · 2층 y0)
      const wall = (xa, xb, za, zb, lv, y1 = 0, y2 = null) => {
        const yb = lv ? Y2 : 0, hh = (y2 ?? (lv ? FH2 : FH1)) - y1, w = Math.abs(xb - xa), d = Math.abs(zb - za), mx = (xa + xb) / 2, mz = (za + zb) / 2;
        if (y1 < 1.1) { const wh = Math.min(1.1, y1 + hh) - y1; pbox(w + .02, wh, d + .02, wainscotM, mx, yb + y1 + wh / 2, mz, g, { cast: false }); }
        if (y1 + hh > 1.1) { const a = Math.max(1.1, y1), wh = y1 + hh - a; pbox(w, wh, d, whiteWall, mx, yb + a + wh / 2, mz, g, { cast: false }); }
        if (y1 < .5) addCol(Math.min(xa, xb), Math.max(xa, xb), Math.min(za, zb), Math.max(za, zb), false, null, lv ? { y0: 3.8 } : { maxY: 2.6 });
      };
      // 벽(축 방향) + 문 구멍들: 문 위는 상인방 벽, 문틀 · 반쯤 열린 문짝
      const wallX = (xa, xb, z, lv, doors = []) => { let c = xa; for (const [a, b] of doors) { if (a > c) wall(c, a, z - .07, z + .07, lv); wall(a, b, z - .07, z + .07, lv, 2.1); frame(a, b, z, lv, true); c = b; } if (xb > c) wall(c, xb, z - .07, z + .07, lv); };
      const wallZ = (x, za, zb, lv, doors = []) => { let c = za; for (const [a, b] of doors) { if (a > c) wall(x - .07, x + .07, c, a, lv); wall(x - .07, x + .07, a, b, lv, 2.1); frame(a, b, x, lv, false); c = b; } if (zb > c) wall(x - .07, x + .07, c, zb, lv); };
      const frame = (a, b, c, lv, alongX) => { const yb = lv ? Y2 : 0, m = (a + b) / 2, L = b - a;
        if (alongX) { pbox(L + .16, .1, .2, walnutM, m, yb + 2.12, c, g, { cast: false }); [a, b].forEach(e => pbox(.08, 2.1, .2, walnutM, e, yb + 1.05, c, g, { cast: false })); const lf = pbox(.05, 2.02, L - .08, woodDark, a + .04, yb + 1.01, c + (L - .08) / 2 * .0 + (L - .08) / 2 * 1, g, { cast: false }); }
        else { pbox(.2, .1, L + .16, walnutM, c, yb + 2.12, m, g, { cast: false }); [a, b].forEach(e => pbox(.2, 2.1, .08, walnutM, c, yb + 1.05, e, g, { cast: false })); pbox(L - .08, 2.02, .05, woodDark, c + (L - .08) / 2, yb + 1.01, a + .04, g, { cast: false }); } };
      const plate = (txt, x, y, z, ry) => pmesh(new THREE.PlaneGeometry(1.1, .26), new THREE.MeshBasicMaterial({ map: makeSign(txt, '#241812', '#f4e2b8', 24) }), x, y, z, g, { ry, cast: false });

      // ── 1층 ──
      // 사감실: 북벽(유리 띠창) + 서벽 상부(유리 칸막이 위) + 문 구멍 z cz+3.1~4.2
      wall(cx + 3.2, x1, cz + 2.95, cz + 3.09, 0, 0, 1.0);
      pmesh(new THREE.PlaneGeometry(x1 - cx - 3.4, 1.1), glassM, (cx + 3.2 + x1) / 2, 1.6, cz + 3.02, g, { cast: false });
      wall(cx + 3.2, x1, cz + 2.95, cz + 3.09, 0, 2.2);
      addCol(cx + 3.2, x1, cz + 2.95, cz + 3.09, false, null, { maxY: 2.6 });
      wall(cx + 3.13, cx + 3.27, cz + 4.3, z1, 0, 2.5);
      frame(cz + 3.1, cz + 4.2, cx + 3.2, 0, false);
      wall(cx + 3.13, cx + 3.27, cz + 3.09, cz + 3.1, 0); wall(cx + 3.13, cx + 3.27, cz + 4.2, cz + 4.3, 0, 2.1);
      plate('사감실', cx + 3.05, 2.35, cz + 3.65, -Math.PI / 2);
      // 공용 화장실 · 샤워실 (서북 x0 ~ -93.6, z -46.5 ~ cz+1)
      wallZ(-93.6, z0 + 2.5, cz + 1, 0, [[cz - 2.5, cz - 1.4]]);
      wallX(x0, -93.6, cz + 1, 0);
      wallX(x0, -93.6, z0 + 2.5, 0);
      plate('화장실 · 샤워실', -93.45, 2.35, cz - 1.95, -Math.PI / 2);
      pbox(3.3, .02, 4.4, tileFloor, (x0 - 93.6) / 2, .065, (z0 + 2.5 + cz + 1) / 2, g, { cast: false });
      [cz - 3.6, cz - .6].forEach(z => { pbox(.5, .14, .5, PM(0xe8e6e0, .3), x0 + .4, .84, z, g); pbox(.04, 1.1, .7, PM(0x9fb4bc, .1, .6), x0 + .02, 1.6, z, g, { cast: false }); addCol(x0, x0 + .7, z - .3, z + .3, false, .9); });   // 세면대 · 거울
      pbox(.06, 2.0, 1.4, PM(0xd8d8d0, .5), x0 + 1.5, 1.0, cz - 2.0, g); addCol(x0 + 1.47, x0 + 1.53, cz - 2.7, cz - 1.3, false, null, { maxY: 2.6 });   // 샤워 칸막이
      // ── 2층 ──
      wallZ(cx - 4.2, z0 + 2.6, z1, 1, [[cz - 1.6, cz + .2], [cz + 2.8, cz + 4.6]]);
      wallX(x0, cx - 4.27, cz + 1.4, 1);
      wallX(x0, cx - 4.13, z0 + 2.62, 1);
      wallZ(cx + 1.8, z0 + 2.6, z1, 1, [[cz + 1.2, cz + 3.1]]);
      wallX(cx + 1.87, x1, z0 + 2.62, 1);
      plate('203호 심야 정독실', cx + 1.65, Y2 + 2.32, cz + 2.15, -Math.PI / 2);
      addRestroom(g, x1, z0 + 2.7, -1, 1, Y2, FH2, '2층 화장실');   // 2층 화장실 (정독실 북동 구석)
      // 기숙사 A (201호) · B (202호) 4인실 (참고 평면도): 2층 침대 2 (1000×2100×1500) · 책상 2 (1200×600) + 의자 · 개인 사물함 4 (300×450×1800)
      [[cz - 2.7, -1], [cz + 4.0, 1]].forEach(([rz, s]) => { const c = s < 0 ? -43.5 : -37.8;
        [c - 1.55, c + .85].forEach(bz => { const bxC = x0 + 1.2; [[-.95, -.45], [.95, -.45], [-.95, .45], [.95, .45]].forEach(([a, b]) => pbox(.07, 1.5, .07, woodDark, bxC + a, Y2 + .75, bz + b, g, { cast: false }));
          [.35, 1.2].forEach(y => { pbox(2.0, .1, .95, woodDark, bxC, Y2 + y, bz, g); pbox(1.95, .12, .9, mattressM, bxC, Y2 + y + .11, bz, g, { cast: false }); pbox(.45, .08, .3, PM(0xf0f0ea, .8), bxC - .7, Y2 + y + .21, bz, g, { cast: false }); });
          for (let k = 0; k < 4; k++) pbox(.04, .03, .4, woodDark, bxC + .98, Y2 + .5 + k * .25, bz, g, { cast: false });
          addCol(bxC - 1.0, bxC + 1.0, bz - .48, bz + .48, false, null, { y0: 3.8 }); });
        const dz = s < 0 ? c - 2.1 : c + 2.1; [-.62, .62].forEach(d => { pbox(.6, .04, 1.2, woodLight, cx - 5.2, Y2 + .72, dz + d * 0, g); });
        pbox(.6, .72, 1.2, woodLight, cx - 5.2, Y2 + .36, dz, g); pbox(.62, .74, .05, woodDark, cx - 5.2, Y2 + .37, dz, g, { cast: false }); addCol(cx - 5.5, cx - 4.9, dz - .6, dz + .6, false, Y2 + .74, { y0: 3.8 });
        for (let k = 0; k < 4; k++) { pbox(.3, 1.8, .45, PM(0x8a9096, .5, .45), x0 + 3.0 + k * .32, Y2 + .9, s < 0 ? z0 + 2.62 + .3 : z1 - .3, g); }
        addCol(x0 + 2.85, x0 + 4.3, s < 0 ? z0 + 2.62 : z1 - .55, s < 0 ? z0 + 3.17 : z1, false, null, { y0: 3.8 }); });
    }

    // 1층 공용부엌 · 식당 (참고 평면도, 서남): 주방 싱크대 (1800×700×850) · 상업용 냉장고 (700×700×1800) · 8인용 식탁 (1800×900) + 의자 8
    { const kx = x0 + .4; pbox(.7, .85, 1.8, PM(0x8a9498, .45, .5), kx, .425, cz + 2.0, g); pbox(.72, .04, 1.82, PM(0xc8ccd0, .3, .7), kx, .87, cz + 2.0, g); pbox(.45, .02, .5, PM(0x30363a, .3, .7), kx, .88, cz + 1.7, g, { cast: false }); addCol(x0, x0 + .75, cz + 1.1, cz + 2.9, false, .9);
      pbox(.7, 1.8, .7, PM(0xc8ccd0, .3, .7), kx, .9, cz + 3.4, g); addCol(x0, x0 + .75, cz + 3.05, cz + 3.75);
      const tx = x0 + 2.6, tz = cz + 5.6; pbox(1.8, .05, .9, walnutM, tx, .73, tz, g); [[-.8, -.38], [.8, -.38], [-.8, .38], [.8, .38]].forEach(([a, b]) => pbox(.06, .71, .06, walnutM, tx + a, .355, tz + b, g, { cast: false })); addCol(tx - .9, tx + .9, tz - .45, tz + .45, false, .76);
      [-.6, 0, .6].forEach(d => { addChair(g, tx + d, tz - .75, 0); addChair(g, tx + d, tz + .75, Math.PI); }); addChair(g, tx - 1.2, tz, Math.PI / 2); addChair(g, tx + 1.2, tz, -Math.PI / 2);
      pmesh(new THREE.PlaneGeometry(1.1, .26), new THREE.MeshBasicMaterial({ map: makeSign('공용부엌 · 식당', '#241812', '#f4e2b8', 22) }), x0 + .03, 2.3, cz + 2.0, g, { ry: Math.PI / 2, cast: false }); }
    // 1층 휴게 라운지 원목 커피 테이블 & 브라운관 TV 장식장 (소파 2조는 sf_pro_dorm_lounge_set.glb 로 배치!)
    pbox(1.65, .42, .82, walnutM, cx - 3.5, .21, cz + 2.8, g);
    pbox(1.55, .03, .72, glassM, cx - 3.5, .43, cz + 2.8, g, { cast: false });
    pbox(1.4, .68, .56, walnutM, cx - 6.8, .34, cz + 2.8, g);
    pbox(.68, .58, .52, ironBalM, cx - 6.8, .97, cz + 2.8, g);
    pmesh(new THREE.PlaneGeometry(.52, .42), new THREE.MeshBasicMaterial({ color: 0x385864 }), cx - 6.45, .98, cz + 2.8, g, { ry: Math.PI / 2, cast: false });
    addCol(cx - 4.8, cx - 2.2, cz + 0.9, cz + 4.7, false, null, { maxY: 2.5 });

    // 2층 사생 철제 사물함 4칸 (y = Y2 위) + 2번째 칸 실시간 개폐 문짝(doorPiv) 장착!
    let dormLockerDoorPiv = null;
    for (let k = 0; k < 4; k++) {
      const lx = cx - 2.8 + k * .72;
      pbox(.66, 1.88, .50, PM(0x48565e, .5, .45), lx, Y2 + .94, z1 - .40, g);
      if (k === 1) {
        const piv = new THREE.Group(); piv.userData.dynamic = true; piv.position.set(lx - .32, Y2 + .94, z1 - .66); g.add(piv);
        pbox(.64, 1.82, .035, PM(0x52626b, .45, .5), .32, 0, -.015, piv);
        pbox(.04, .18, .04, brassM, .54, .11, -.04, piv);
        dormLockerDoorPiv = piv;
      } else {
        pbox(.04, .18, .04, brassM, lx + .20, Y2 + 1.05, z1 - .67, g);
      }
    }

    // 상호작용 지점 3종 (1F 사감실 관제석 / 2F 202호 사물함 / 2F 심야 정독실 카렐 부스)
    world.props.push({ kind: 'robj', k: 'dorm_log', t: 'mega15k', floor: 0, x: cx + 5.8, z: cz + 3.4, y: .95, r: 2.4, label: '1층 사감실 4채널 CCTV 관제석 & 점호 일지 조사하기' });
    world.props.push({ kind: 'robj', k: 'dorm_locker', t: 'mega15k', floor: 0, x: cx - 1.8, z: z1 - 1.25, y: Y2 + 1.1, r: 2.4, label: '기숙사 2층 사생 사물함 파밍하기', anim: { type: 'hinge', doorPiv: dormLockerDoorPiv, openAngle: 1.45, t: 0, active: false } });
    world.props.push({ kind: 'robj', k: 'dorm_study', t: 'mega15k', floor: 0, x: cx + 4.2, z: cz + 3.2, y: Y2 + 1.0, r: 2.4, label: '기숙사 2층 심야 정독실 카렐 부스 비밀 수첩 해독하기' });

    addSwitch(g, x1 - .01, cz - dw / 2 - .4, -Math.PI / 2, { x1: x0, x2: x1, z1: z0, z2: z1, y2: Y2 }, Y2 - .2, 0, '1층 형광등 스위치');
    addSwitch(g, x1 - .01, cz - dw / 2 - .4, -Math.PI / 2, { x1: x0, x2: x1, z1: z0, z2: z1, y1: Y2 }, H - .3, Y2, '2층 형광등 스위치');
    // 1·2층 앤틱 황동 펜던트 조명 & 따뜻한 볼류메트릭 무드 글로우
    [0, Y2].forEach((by, fl) => {
      [[-6.5, -1.5], [0, -1.5], [5.5, -1.5], [-6.5, 3.2], [0, 3.2], [5.5, 3.2]].forEach(([lx, lz], li) => {
        pcyl(.02, .02, .32, brassM, cx + lx, by + 3.55, cz + lz, g);
        pbox(.85, .08, .28, brassM, cx + lx, by + 3.40, cz + lz, g, { cast: false });
        pbox(.76, .04, .20, lampEm, cx + lx, by + 3.35, cz + lz, g, { cast: false });
        if (li % 2 === 0) {
          const spD = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex(fl === 0 ? '255,210,145' : '195,235,205'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .38 }));
          spD.scale.setScalar(3.6); spD.position.set(cx + lx, by + 2.95, cz + lz); g.add(spD);
        }
      });
    });

    chunks.push({ id: 'chunk_dorm', g, x: cx, z: cz });
  }

  /* =========================================================================
     ② [생태공원 섹션] 청운호(靑雲湖) 생태수변공원 & 호심정(湖心亭) 팔각정 — 북측 (x: -9, z: -86)
     ========================================================================= */
  {
    // 청운호 수변공원 리모델링 (참고 평면도 · 34.0 × 20.0m): 외곽 수목 식재대 · 순환 산책로 (폭 2.5m) · 인공 호수 (약 24 × 12m · 둥근 모서리) · 분수 · 서측 데크 전망대 (8 × 6m) · 동측 육각 정자 (지름 5m) + 목교 (2 × 4m) · 목재 난간 (H1100) · 벤치 · 가로등 (H3500) · 안내 표지판 · 쓰레기통 · 수생식물 · 석재
    const cx = -9, cz = -86, x0 = cx - 17, x1 = cx + 17, z0 = cz - 10, z1 = cz + 10, lx0 = -21, lx1 = 3, lz0 = -92, lz1 = -80;
    const g = new THREE.Group(); g.name = 'chunk_lake'; g.userData.dynamic = true; OUT.add(g);
    const pathM = PM(0xb8a890, .85), grassM = PM(0x3a6a34, .9), railM = PM(0x6a4424, .75), deckM2 = PM(0x8a5e34, .75);
    pbox(34, .06, 20, grassM, cx, .03, cz, g, { cast: false });
    { const sh = new THREE.Shape(), rr2 = 3.0, ax0 = x0 + 1.0, ax1 = x1 - 1.0, az0 = z0 + 1.0, az1 = z1 - 1.0; sh.moveTo(ax0 + rr2, az0); sh.lineTo(ax1 - rr2, az0); sh.quadraticCurveTo(ax1, az0, ax1, az0 + rr2); sh.lineTo(ax1, az1 - rr2); sh.quadraticCurveTo(ax1, az1, ax1 - rr2, az1); sh.lineTo(ax0 + rr2, az1); sh.quadraticCurveTo(ax0, az1, ax0, az1 - rr2); sh.lineTo(ax0, az0 + rr2); sh.quadraticCurveTo(ax0, az0, ax0 + rr2, az0);
      const geo = new THREE.ShapeGeometry(sh, 8); geo.rotateX(Math.PI / 2); geo.scale(1, -1, 1); pmesh(geo, pathM, 0, .07, 0, g, { cast: false }); }
    // 호수: 석재 호안 + 수면
    { const sh = new THREE.Shape(), r3 = 3.5; sh.moveTo(lx0 + r3, lz0); sh.lineTo(lx1 - r3, lz0); sh.quadraticCurveTo(lx1, lz0, lx1, lz0 + r3); sh.lineTo(lx1, lz1 - r3); sh.quadraticCurveTo(lx1, lz1, lx1 - r3, lz1); sh.lineTo(lx0 + r3, lz1); sh.quadraticCurveTo(lx0, lz1, lx0, lz1 - r3); sh.lineTo(lx0, lz0 + r3); sh.quadraticCurveTo(lx0, lz0, lx0 + r3, lz0);
      const rim = new THREE.ShapeGeometry(sh, 10); rim.rotateX(Math.PI / 2); rim.scale(1, -1, 1); pmesh(rim, stoneM, 0, .09, 0, g, { cast: false });
      const waterM = new THREE.MeshStandardMaterial({ color: 0x1c5a64, emissive: 0x0b282c, emissiveIntensity: .35, roughness: .06, metalness: .35, transparent: true, opacity: .85 });
      const inner = new THREE.Shape(), q = .45; inner.moveTo(lx0 + r3, lz0 + q); inner.lineTo(lx1 - r3, lz0 + q); inner.quadraticCurveTo(lx1 - q, lz0 + q, lx1 - q, lz0 + r3); inner.lineTo(lx1 - q, lz1 - r3); inner.quadraticCurveTo(lx1 - q, lz1 - q, lx1 - r3, lz1 - q); inner.lineTo(lx0 + r3, lz1 - q); inner.quadraticCurveTo(lx0 + q, lz1 - q, lx0 + q, lz1 - r3); inner.lineTo(lx0 + q, lz0 + r3); inner.quadraticCurveTo(lx0 + q, lz0 + q, lx0 + r3, lz0 + q);
      const wg = new THREE.ShapeGeometry(inner, 10); wg.rotateX(Math.PI / 2); wg.scale(1, -1, 1); pmesh(wg, waterM, 0, .13, 0, g, { cast: false }); }
    // 수면 충돌 (데크 · 정자 · 목교 자리는 비운다)
    [[lx0, lx1, lz0, -91], [lx0, -4.5, -91, -88], [.5, lx1, -91, -89.5], [-15.5, -4.5, -88, -86], [.5, lx1, -87.5, -86], [-15.5, lx1, -86, -82], [lx0, lx1, -82, lz1]].forEach(([a, b, c, d]) => addCol(a, b, c, d, false));
    // 목재 난간 (H1100): 호안을 따라 (데크 · 목교 접속부 제외)
    const rail = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 2)), ang = Math.atan2(bz - az, bx - ax);
      const m = pbox(L, .08, .08, railM, (ax + bx) / 2, 1.05, (az + bz) / 2, g, { cast: false }); m.rotation.y = -ang; const m2 = pbox(L, .06, .06, railM, (ax + bx) / 2, .6, (az + bz) / 2, g, { cast: false }); m2.rotation.y = -ang;
      for (let k = 0; k <= n; k++) pbox(.1, 1.1, .1, railM, ax + (bx - ax) * k / n, .55, az + (bz - az) * k / n, g, { cast: false }); };
    rail(lx0 + 3, lz1 + .15, lx1 - 3, lz1 + .15); rail(lx0 + 3, lz0 - .15, lx1 - 3, lz0 - .15); rail(lx1 + .15, lz0 + 3, lx1 + .15, -89.6); rail(lx1 + .15, -87.4, lx1 + .15, lz1 - 3); rail(lx0 - .15, lz0 + 3, lx0 - .15, -88.1); rail(lx0 - .15, -81.9, lx0 - .15, lz1 - 3);
    // 분수 (중앙)
    { const fx = -8.5, fz = -86; pcyl(.9, 1.0, .25, stoneM, fx, .13, fz, g, { seg: 16 }); pcyl(.05, .08, 1.8, new THREE.MeshStandardMaterial({ color: 0xd8f0ff, emissive: 0x9ad0ff, emissiveIntensity: .5, transparent: true, opacity: .55 }), fx, 1.05, fz, g);
      const spF = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('200,235,255'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .45 })); spF.scale.set(2.4, 2.0, 1); spF.position.set(fx, 1.6, fz); g.add(spF); }
    // 서측 데크 전망대 (8 × 6m · 팔각 · 난간) — 산책로에서 바로 올라선다
    { const dx = -19.5, dz = -85; const oct = new THREE.CylinderGeometry(4.0, 4.0, .3, 8); oct.scale(1, 1, .75); const dm = pmesh(oct, deckM2, dx, .15, dz, g); dm.rotation.y = Math.PI / 8;
      addCol(dx - 4.0, dx + 4.0, dz - 3.0, dz + 3.0, false, .3);
      for (let k = 0; k < 8; k++) { const a1 = Math.PI / 8 + k * Math.PI / 4, a2 = a1 + Math.PI / 4; if (k === 4) continue; rail(dx + Math.cos(a1) * 3.9, dz + Math.sin(a1) * 2.9, dx + Math.cos(a2) * 3.9, dz + Math.sin(a2) * 2.9); }
      [[-1.6, 0], [1.6, 0]].forEach(([a]) => { pbox(1.8, .06, .45, woodLight, dx + a, .75, dz + 1.4, g); pbox(1.8, .4, .06, woodLight, dx + a, 1.0, dz + 1.6, g); }); }
    // 동측 육각 정자 (지름 5m · 높이 3.5m) + 목교 (2 × 4m) — 1998 졸업생 봉인함
    const cx2 = -2, cz2 = -88.5;
    pcyl(2.6, 2.6, .3, deckM2, cx2, .15, cz2, g, { seg: 6 }); addCol(cx2 - 2.4, cx2 + 2.4, cz2 - 2.4, cz2 + 2.4, false, .3);
    for (let a = 0; a < 6; a++) { const an = a * Math.PI / 3; pcyl(.12, .12, 2.7, PM(0x6e3a1c, .7), cx2 + Math.cos(an) * 2.3, 1.65, cz2 + Math.sin(an) * 2.3, g); if (a !== 0) { const bx2 = cx2 + Math.cos(an + Math.PI / 6) * 2.0, bz2 = cz2 + Math.sin(an + Math.PI / 6) * 2.0, m = pbox(2.2, .06, .4, woodLight, bx2, .75, bz2, g); m.rotation.y = -(an + Math.PI / 6) + Math.PI / 2; } }
    pmesh(new THREE.ConeGeometry(3.3, 1.5, 6), PM(0x5a3a22, .7), cx2, 3.75, cz2, g); pcyl(.12, .2, .5, PM(0x3a2a1a, .6), cx2, 4.5, cz2, g);
    pmesh(new THREE.PlaneGeometry(1.8, .38), new THREE.MeshBasicMaterial({ map: makeSign('호 심 정 (湖 心 亭)', '#281810', '#f2df98', 26) }), cx2, 2.85, cz2 + 2.35, g, { cast: false });
    { const bx0 = .4, bx1 = 4.6; pbox(bx1 - bx0, .25, 2.0, deckM2, (bx0 + bx1) / 2, .125, cz2, g); addCol(bx0, bx1, cz2 - 1.0, cz2 + 1.0, false, .25); rail(bx0, cz2 - 1.0, bx1, cz2 - 1.0); rail(bx0, cz2 + 1.0, bx1, cz2 + 1.0); }
    const spL = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('255,210,125'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .55 }));
    spL.scale.setScalar(4.5); spL.position.set(cx2, 2.5, cz2); g.add(spL);
    pcyl(.65, .55, .78, stoneM, cx2, .62, cz2, g, { seg: 12 });
    pbox(.48, .22, .36, PM(0x7a5824, .45, .65), cx2, 1.12, cz2, g);
    const capLidPiv = new THREE.Group(); capLidPiv.userData.dynamic = true; capLidPiv.position.set(cx2, 1.23, cz2 - .17); g.add(capLidPiv);
    pbox(.50, .07, .38, PM(0xa88238, .3, .8), 0, .035, .17, capLidPiv);
    pbox(.08, .05, .04, goldM, 0, .02, .36, capLidPiv);
    addCol(cx2 - .65, cx2 + .65, cz2 - .65, cz2 + .65);
    world.props.push({ kind: 'robj', k: 'lake_capsule', t: 'mega15k', floor: 0, x: cx2, z: cz2 + 1.25, y: 1.1, r: 2.2, label: '호심정 정자 위 1998 졸업생 봉인함 열기', anim: { type: 'lid', lidPiv: capLidPiv, openAngle: -1.45, t: 0, active: false } });
    // 수생식물 (연잎 · 연꽃) · 호안 석재
    const padM = PM(0x2d6a36, .8), lotusM = PM(0xf0a8c8, .6);
    [[-15, -90], [-12, -82], [-6, -91], [-4, -81.5], [-17, -89.5], [1, -82]].forEach(([x, z], k) => { pmesh(new THREE.CircleGeometry(.45, 12), padM, x, .15, z, g, { rx: -Math.PI / 2, cast: false }); if (k % 2 === 0) pmesh(new THREE.SphereGeometry(.12, 8, 6), lotusM, x + .1, .22, z, g); });
    [[-20.3, -91.2], [2.4, -80.7], [-20.4, -80.8], [2.3, -91.3]].forEach(([x, z]) => pmesh(new THREE.DodecahedronGeometry(.45, 0), stoneM, x, .3, z, g));
    // 산책로 시설: 벤치 (남측 휴게 공간) · 가로등 · 쓰레기통 · 안내 표지판
    [-16, -11, -3, 2].forEach(x => { pbox(1.8, .06, .5, woodLight, x, .45, z1 - 1.6, g); pbox(1.8, .4, .06, woodLight, x, .72, z1 - 1.35, g); [-.75, .75].forEach(d => pbox(.06, .44, .45, darkMetal, x + d, .22, z1 - 1.6, g, { cast: false })); addCol(x - .9, x + .9, z1 - 1.85, z1 - 1.3, false, .5); });
    [[x0 + 1.8, z0 + 1.8], [x1 - 1.8, z0 + 1.8], [x0 + 1.8, z1 - 1.8], [x1 - 1.8, z1 - 1.8], [cx, z0 + 1.6], [-14, z1 - 1.6], [-6, z1 - 1.6]].forEach(([x, z]) => { pcyl(.05, .07, 3.5, PM(0x1a1a1c, .5, .5), x, 1.75, z, g); pbox(.28, .38, .28, new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffd898, emissiveIntensity: .9 }), x, 3.6, z, g, { cast: false }); });
    [[-8.0, z1 - 1.6], [5.5, z1 - 1.6]].forEach(([x, z]) => { pbox(.4, .8, .4, woodDark, x, .4, z, g); addCol(x - .2, x + .2, z - .2, z + .2); });
    { const sx = cx + 1.8, sz = z1 - .6; pbox(.9, 1.8, .1, woodDark, sx, .9, sz, g); pmesh(new THREE.PlaneGeometry(.8, 1.0), new THREE.MeshBasicMaterial({ map: makeSign('청운호 수변공원 · 데크 전망대 · 호심정 · 산책로', '#f2ead6', '#2a4a2a', 14) }), sx, 1.2, sz + .06, g, { cast: false }); addCol(sx - .45, sx + .45, sz - .05, sz + .05); }
    // 외곽 수목 (버드나무 · 벚나무)
    for (let k = 0; k < 18; k++) { const t2 = k / 18 * Math.PI * 2, x = cx + Math.cos(t2) * 16.3, z = cz + Math.sin(t2) * 9.3; if (Math.abs(x - cx) < 2.5 && z > cz) continue; pcyl(.15, .2, 2.4, PM(0x5a3e28, .9), x, 1.2, z, g); pmesh(new THREE.DodecahedronGeometry(1.3, 1), k % 3 === 0 ? PM(0xf0b8cc, .8) : PM(0x4a8a3a, .85), x, 3.0, z, g); }
    chunks.push({ id: 'chunk_lake', g, x: cx, z: cz });
  }

  /* =========================================================================
     ③ [학술·연구 섹션] 서문 과학천문관 & 대형 천체관측 돔 — 동북 (x: 84, z: -34)
     ========================================================================= */
  {
    const cx = 84, cz = -34, W = 20, D = 16, H = 8.8;
    const g = new THREE.Group(); g.name = 'chunk_astro'; g.userData.dynamic = true; OUT.add(g);
    buildShell(g, cx, cz, W, D, H, whiteWall, darkMetal, 'W', tileFloor);
    const silverM = PM(0xb8c6d2, .28, .78);
    // 천문관 관측돔 하부 원통형 회전 드럼 기단 & 슬릿 아치 리브 & 옥상 안전 난간
    pcyl(4.4, 4.5, 1.1, stoneM, cx + 5.3, H + .95, cz + 3.9, g, { seg: 24 });
    pmesh(new THREE.SphereGeometry(4.2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), silverM, cx + 5.3, H + 1.4, cz + 3.9, g);
    [-.65, .65].forEach(ox => pmesh(new THREE.TorusGeometry(4.24, .10, 8, 24, Math.PI), darkMetal, cx + 5.3 + ox, H + 1.4, cz + 3.9, g, { ry: Math.PI / 2 }));
    pcyl(.36, .42, 3.4, darkMetal, cx + 3.3, H + 3.6, cz + 3.9, g, { rz: Math.PI / 3.2 });
    pbox(1.8, .24, 4.4, stoneM, cx - W / 2 - 1.1, 3.1, cz, g);
    [-1.8, 1.8].forEach(dz => pcyl(.20, .22, 3.0, stoneM, cx - W / 2 - 1.8, 1.5, cz + dz, g));
    pbox(.12, .62, 4.4, darkMetal, cx - W / 2 - 2.02, 3.45, cz, g, { cast: false });
    pmesh(new THREE.PlaneGeometry(4.2, .52), new THREE.MeshBasicMaterial({ map: makeSign('서문 과학천문관 · 천체관측소', '#142438', '#d8f0ff', 24) }), cx - W / 2 - 2.09, 3.45, cz, g, { ry: -Math.PI / 2, cast: false });
    // 남측(광장 조망면)에도 과학천문관 대형 현판 장착
    pbox(5.6, .62, .14, darkMetal, cx, 8.15, cz + D / 2 + .42, g, { cast: false });
    pmesh(new THREE.PlaneGeometry(5.4, .52), new THREE.MeshBasicMaterial({ map: makeSign('서문 과학천문관 · SEOMUN OBSERVATORY', '#142438', '#d8f0ff', 22) }), cx, 8.15, cz + D / 2 + .50, g, { cast: false });
    // 실내 리모델링 (참고 배치도 · 20.0 × 16.0m): 서측 정문 → 로비 / 북측 장비보관실 · 작업실 (약 30m²) / 남측 관측 제어실 (약 30m²) / 가운데 전시 공간 (태양계 모형 · 진열장) / 동북 천문 교육실 / 동남 관측 돔 (굴절 망원경 · 원형 드럼벽)
    const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2, xA = x0 + 6, xB = x0 + 10.6, zE = cz - .2;   // xA: 서측 방 열 끝 · xB: 전시 공간 끝 · zE: 교육실 | 돔 경계
    iwall(g, x0, cz - 3, xA, cz - 3, [[x0 + 2.0, x0 + 3.2]]); iwall(g, x0, cz + 3, xA, cz + 3, [[x0 + 2.0, x0 + 3.2]]);
    iwall(g, xA, z0, xA, z1, [[cz - .6, cz + .6]]); iwall(g, xB, z0, xB, z1, [[z0 + 2.2, z0 + 3.4], [cz + 2.6, cz + 3.8]]); iwall(g, xB, zE, x1, zE);
    // 장비 보관실 · 작업실 (북서): 철제 선반 · 작업대 · 장비 보관함 · 이동식 사다리
    [x0 + .8, x0 + 1.8].forEach(x => steelShelf(g, x, z0 + .3, .9, .45, 1.8, PM(0x8a6a48, .8))); steelShelf(g, x0 + .3, cz - 5.0, .45, .9, 1.8, PM(0x2a4a7a, .7));
    deskT(g, xA - 1.0, z0 + 2.2, .7, 1.8, .85, woodLight); pbox(1.2, 1.8, .6, PM(0x8a8e90, .5, .4), x0 + 4.0, .9, z0 + .4, g); addCol(x0 + 3.4, x0 + 4.6, z0, z0 + .7);
    // 관측 제어실 (남서): 관측 제어 콘솔 (1800×800×750) + 모니터 3 · 서버 랙 · 성도 화면
    { const kz = z1 - .8; pbox(1.8, .75, .8, PM(0x2a2e34, .5, .4), x0 + 3.0, .375, kz, g); addCol(x0 + 2.1, x0 + 3.9, kz - .4, kz + .4, false, .75); [-.6, 0, .6].forEach(d => monitor(g, x0 + 3.0 + d, .75, kz + .1, Math.PI));
      pbox(.6, 1.9, .8, PM(0x16181c, .5, .5), x0 + .5, .95, kz, g); addCol(x0 + .2, x0 + .8, kz - .4, kz + .4); addChair(g, x0 + 3.0, kz - .9, Math.PI);
      pmesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({ map: makeSign('1998.10.12 천체 성도 좌표 — 황도 12궁 & 페가수스자리 관측 중', '#0c1828', '#70e8ff', 20) }), xA - .08, 2.0, z1 - 1.6, g, { ry: -Math.PI / 2, cast: false }); }
    world.props.push({ kind: 'robj', k: 'astro_console', t: 'mega15k', floor: 0, x: x0 + 3.0, z: z1 - 1.9, y: 1.1, r: 2.2, label: '천체관측소 성도 주파수 콘솔 조작하기' });
    // 전시 공간 (가운데): 태양계 행성 모형 (애니메이션) · 벽면 전시 진열장 · 원형 진열대
    const ox = (xA + xB) / 2, oz = cz - 1.4;
    pcyl(1.0, 1.15, .7, darkMetal, ox, .35, oz, g, { seg: 16 });
    pmesh(new THREE.SphereGeometry(.4, 16, 14), new THREE.MeshStandardMaterial({ color: 0xffd040, emissive: 0xff9810, emissiveIntensity: .9 }), ox, 1.6, oz, g);
    const orreryPiv = new THREE.Group(); orreryPiv.userData.dynamic = true; orreryPiv.position.set(ox, 1.6, oz); g.add(orreryPiv);
    [.85, 1.3, 1.75].forEach((r, ri) => { const ringG = new THREE.Group(); ringG.userData.dynamic = true; orreryPiv.add(ringG); const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .016, 8, 32), chromeM); ring.rotation.x = Math.PI / 2; ringG.add(ring);
      pmesh(new THREE.SphereGeometry(.12 + ri * .04, 12, 10), PM([0x3888ff, 0xe05838, 0xd8b068][ri], .4), Math.cos(ri * 2.1) * r, 0, Math.sin(ri * 2.1) * r, ringG); });
    addCol(ox - 1.2, ox + 1.2, oz - 1.2, oz + 1.2);
    [[0x3888ff, .5, -1.0], [0xd8a050, .38, .2], [0xc89060, .3, 1.2]].forEach(([c, r, d]) => pmesh(new THREE.SphereGeometry(r, 16, 12), PM(c, .5), ox + d, 3.1, oz + 3.2, g));   // 천장 매단 행성
    world.props.push({ kind: 'robj', k: 'astro_orrery', t: 'mega15k', floor: 0, x: ox, z: oz + 1.6, y: 1.1, r: 2.2, label: '태양계 행성 모형 돌려 보기', anim: { type: 'orrery', orreryPiv, t: 0, active: false } });
    [z0 + .35, z1 - .35].forEach(z => tallCase(g, ox, z, 1.2, .6));
    vitrine(g, ox, cz + 4.6, 1.8, .75); vitrine(g, ox, z0 + 4.4, 1.8, .75);
    world.props.push({ kind: 'robj', k: 'astro_case', t: 'mega15k', floor: 0, x: ox, z: z0 + 5.3, y: 1.1, r: 2.2, label: '운석 · 광물 표본 진열장 조사하기' });
    // 천문 교육실 (동북): 교육용 책상 (1200×600) 3열 × 2 + 의자 · 전면 스크린 · 진열장
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) { const x = xB + 2.6 + r * 1.9, z = z0 + 3.0 + c * 2.0; deskT(g, x, z, .6, 1.2, .74); addChair(g, x + .55, z - .3, -Math.PI / 2, blueFabric); addChair(g, x + .55, z + .3, -Math.PI / 2, blueFabric); }
    pbox(.06, 1.3, 2.4, PM(0x101418, .4), xB + .12, 1.8, z0 + 3.2, g, { cast: false }); pmesh(new THREE.PlaneGeometry(2.3, 1.2), new THREE.MeshBasicMaterial({ color: 0x18306a }), xB + .16, 1.8, z0 + 3.2, g, { ry: Math.PI / 2, cast: false });
    // 관측 돔 (동남): 원형 드럼벽 (서쪽 출입구) · 굴절 망원경 (L2500) + 적도의 받침 · 원형 난간
    { const dx = (xB + x1) / 2, dz = (zE + z1) / 2, R = Math.min(x1 - xB, z1 - zE) / 2 - .25, n = 18;
      for (let k = 0; k < n; k++) { const a = (k + .5) / n * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) - Math.PI) < .35 || Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) + Math.PI) < .35) continue;
        const px = dx + Math.cos(a) * R, pz = dz + Math.sin(a) * R, L = 2 * R * Math.sin(Math.PI / n) + .05; pbox(.16, 3.85, L, PM(0xc8c4b8, .7), px, 1.925, pz, g, { ry: -a }); addCol(px - .25, px + .25, pz - .25, pz + .25); }
      pcyl(.35, .45, 1.1, darkMetal, dx, .55, dz, g, { seg: 14 }); pcyl(.13, .16, 2.5, PM(0xe8e8ec, .35, .4), dx + .3, 1.75, dz, g, { rz: Math.PI / 3.4 }); pcyl(.16, .16, .3, darkMetal, dx + 1.1, 2.35, dz, g, { rz: Math.PI / 3.4 }); addCol(dx - .5, dx + .5, dz - .5, dz + .5);
      world.props.push({ kind: 'robj', k: 'astro_scope', t: 'mega15k', floor: 0, x: dx - 1.0, z: dz, y: 1.3, r: 2.0, label: '관측 돔 굴절 망원경 들여다보기' }); }
    chunks.push({ id: 'chunk_astro', g, x: cx, z: cz });
  }

  /* =========================================================================
     ④ [학술·도서관 섹션] 중앙학술정보관 (별동 대도서관 · 마이크로필름 판독실) — 동남 (x: 84, z: 39)
     ========================================================================= */
  {
    const cx = 84, cz = 39, W = 22, D = 18, H = 9.4;
    const g = new THREE.Group(); g.name = 'chunk_library'; g.userData.dynamic = true; OUT.add(g);
    buildShell(g, cx, cz, W, D, H, brickM, stoneM, 'W', woodFloor);
    pbox(2.2, .28, 6.4, stoneM, cx - W / 2 - 1.2, 3.3, cz, g);
    [-2.6, 2.6].forEach(dz => pcyl(.22, .24, 3.2, stoneM, cx - W / 2 - 2.0, 1.6, cz + dz, g));
    pbox(.14, .68, 5.2, darkMetal, cx - W / 2 - 2.35, 3.68, cz, g, { cast: false });
    pmesh(new THREE.PlaneGeometry(5.0, .56), new THREE.MeshBasicMaterial({ map: makeSign('서문 중앙학술정보관 · 대도서관', '#221a14', '#f4e8c8', 24) }), cx - W / 2 - 2.43, 3.68, cz, g, { ry: -Math.PI / 2, cast: false });
    // 대도서관 1층 리모델링 (참고 1층 평면도 · 22.0 × 18.0m): 서측 정문 → 중앙 로비 (원형 열람 테이블 · 2층 계단) / 북측 자료정리실 · 사무실 / 남측 기록보관실 · 멀티미디어실 / 동북 열람실 A · 동남 열람실 B (양면 서가 · 열람 테이블)
    const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2, xA = x0 + 11, zN = z0 + 5.5, zS = z1 - 5.5, zA = cz - 2.2, zB = cz + 2.2;
    iwall(g, x0, zN, xA, zN, [[x0 + 2.0, x0 + 3.2], [x0 + 7.4, x0 + 8.6]]); iwall(g, x0 + 5.2, z0, x0 + 5.2, zN);
    iwall(g, x0, zS, xA, zS, [[x0 + 2.0, x0 + 3.2], [x0 + 7.4, x0 + 8.6]]); iwall(g, x0 + 5.2, zS, x0 + 5.2, z1);
    iwall(g, xA, z0, xA, zA); iwall(g, xA, zB, xA, z1); iwall(g, xA, zA, x1, zA, [[xA + 1.0, xA + 2.2]]); iwall(g, xA, zB, x1, zB, [[xA + 1.0, xA + 2.2]]);
    const bookColors = [PM(0x7a2420, .8), PM(0x1e3c58, .8), PM(0x284e34, .8), PM(0x8a6832, .8), PM(0x4a3248, .8)];
    const bookcase = (x, z, len, alongZ, dbl = true) => { const w = alongZ ? (dbl ? .6 : .32) : len, d = alongZ ? len : (dbl ? .6 : .32); pbox(w, 2.1, d, woodDark, x, 1.05, z, g);
      for (let r = 0; r < 5; r++) for (let k = 0; k < Math.floor(len / .45); k++) { const t = -len / 2 + .25 + k * .45; pbox(alongZ ? w + .02 : .4, .3, alongZ ? .4 : d + .02, bookColors[(k + r * 2) % 5], x + (alongZ ? 0 : t), .3 + r * .4, z + (alongZ ? t : 0), g, { cast: false }); }
      addCol(x - w / 2, x + w / 2, z - d / 2, z + d / 2); };
    // 열람실 A · B: 벽면 서가 + 양면 서가 2열 + 열람 테이블 (1800×900) + 의자
    [[z0, zA, 1], [zB, z1, -1]].forEach(([za, zb, s]) => { const zw = s > 0 ? za : zb;
      bookcase((xA + x1 - 2.8) / 2, zw + s * .2, x1 - 2.8 - xA - .4, false, false); if (s < 0) bookcase(x1 - .2, (za + zb) / 2, zb - za - 3.0, true, false);
      [xA + 2.6, xA + 4.6].forEach(x => bookcase(x, zw + s * 2.6, 2.6, true));
      [[xA + 7.6, (za + zb) / 2]].forEach(([x, z]) => { deskT(g, x, z, .9, 1.8, .74, woodLight); [-.6, 0, .6].forEach(d => { addChair(g, x - .7, z + d, Math.PI / 2); addChair(g, x + .7, z + d, -Math.PI / 2); }); }); });
    world.props.push({ kind: 'robj', k: 'lib_desk', t: 'mega15k', floor: 0, x: xA + 6.6, z: (z0 + zA) / 2, y: .9, r: 2.2, label: '대도서관 열람실 미반납 도서함 조사하기' });
    // 중앙 로비: 원형 열람 테이블 2 · 화분 · 2층 계단 (동쪽 끝)
    [cx - 4.5, cx - 1.0].forEach(x => { pcyl(.8, .8, .05, woodLight, x, .72, cz, g, { seg: 20 }); pcyl(.08, .2, .7, darkMetal, x, .35, cz, g); addCol(x - .8, x + .8, cz - .8, cz + .8, false, .75); [0, 1, 2, 3].forEach(k => addChair(g, x + Math.cos(k * Math.PI / 2) * 1.15, cz + Math.sin(k * Math.PI / 2) * 1.15, -k * Math.PI / 2 - Math.PI / 2)); });
    for (let k = 0; k < 10; k++) pbox(.32, .18, 2.6, stoneM, x1 - 4.4 + k * .32, .09 + k * .18, cz, g); addCol(x1 - 4.6, x1, cz - 1.35, cz + 1.35);
    pbox(.6, .06, 2.7, PM(0x3a3e42, .4, .6), x1 - 4.6, .95, cz - 1.38, g, { cast: false });
    // 자료정리실 (북서) · 사무실 (북측) · 기록보관실 (남서) · 멀티미디어실 (남측, 마이크로필름 판독기)
    [x0 + .5, x0 + 1.5, x0 + 2.5, x0 + 3.5].forEach(x => bookcase(x, z0 + .2, .9, false, false)); deskT(g, x0 + 2.6, z0 + 2.8, 1.8, .9);
    deskT(g, x0 + 7.8, z0 + 2.0, 1.6, .8); monitor(g, x0 + 7.8, .74, z0 + 1.8, 0); addChair(g, x0 + 7.8, z0 + 2.8, Math.PI, blueFabric); pbox(.9, 1.8, .45, PM(0x8a8e90, .5, .4), x0 + 10.2, .9, z0 + .3, g); addCol(x0 + 9.75, x0 + 10.65, z0, z0 + .55);
    for (let k = 0; k < 4; k++) { pbox(.9, 1.8, .45, PM(0xa8aab0, .5, .45), x0 + .6 + k * 1.0, .9, z1 - .3, g); } addCol(x0, x0 + 4.2, z1 - .55, z1);
    for (let k = 0; k < 3; k++) { const x = x0 + 6.4 + k * 1.4; deskT(g, x, z1 - 1.0, 1.2, .7); monitor(g, x, .74, z1 - .8, Math.PI); }
    pbox(1.0, .82, .9, woodDark, x0 + 9.8, .41, zS + 1.4, g); pbox(.55, .62, .55, darkMetal, x0 + 9.8, 1.12, zS + 1.4, g); addCol(x0 + 9.3, x0 + 10.3, zS + .95, zS + 1.85);
    pmesh(new THREE.PlaneGeometry(.46, .38), new THREE.MeshBasicMaterial({ map: makeSign('1998.10.13 호외 — 서문고 심야 실종 사건 특보', '#101814', '#80ffb8', 18) }), x0 + 9.8, 1.15, zS + 1.11, g, { ry: Math.PI, cast: false });
    world.props.push({ kind: 'robj', k: 'lib_microfilm', t: 'mega15k', floor: 0, x: x0 + 9.8, z: zS + .6, y: 1.1, r: 2.2, label: '마이크로필름 판독기로 1998년 신문 기사 복원하기' });
    // 북측(광장 조망면) 대도서관 현판 추가
    pbox(5.8, .62, .14, darkMetal, cx, 8.55, cz - D / 2 - .42, g, { cast: false });
    pmesh(new THREE.PlaneGeometry(5.6, .52), new THREE.MeshBasicMaterial({ map: makeSign('중앙학술정보관 · CENTRAL LIBRARY', '#221a14', '#f4e8c8', 22) }), cx, 8.55, cz - D / 2 - .50, g, { ry: Math.PI, cast: false });
    chunks.push({ id: 'chunk_library', g, x: cx, z: cz });
  }

  /* =========================================================================
     ④-B [동편 캠퍼스 신규 학교 특화 구역 4종] (기존에 없던 한국 고등학교 대표 야외·부속 시설 완비!)
     1) 학생 자전거 보관소(폴리카보네이트 캐노피 · 자전거 14대) & 야외 타일 수돗가(단체 음수대 8구) (x: 58, z: -6.5)
     2) 체육부 전통 씨름장(원형 모래판 · 4주 차양막) & 3단 철봉 · 평행봉 체력단련장 (x: 58, z: -20.5)
     3) 서문고 역사관 · 개교기념관 (워커블 단층 붉은벽돌 박물관 · 트로피/타임캡슐 전시) & 구관 동종(학교 종) 종각 (x: 84, z: -11.0)
     4) 90년대 옥색 공중전화 부스 2동 · 학우매점 야외 평상/파라솔 쉼터 & 학교 분리수거장 · 구식 벽돌 소각장 (x: 84, z: +15.0)
     ========================================================================= */
  {
    const g = new THREE.Group(); g.name = 'chunk_east_plaza'; g.userData.dynamic = true; OUT.add(g);
    const polyRoofM = new THREE.MeshStandardMaterial({ color: 0x5898b8, roughness: .22, metalness: .15, transparent: true, opacity: .62, side: THREE.DoubleSide, depthWrite: false });
    const mintBoothM = PM(0x3a8880, .38, .35);
    const sandPitM = PM(0xc8a868, .92);
    const blueTarpM = PM(0x245888, .65);
    const emberEm = new THREE.MeshStandardMaterial({ color: 0xff5018, emissive: 0xff3808, emissiveIntensity: 1.4 });
    const tireM = PM(0x1c1e20, .88);

    // ── (1) 학생 자전거 보관소 & 야외 타일 수돗가(단체 음수대) (x: 58.0, z: -6.5) ──
    {
      const bxC = 58.0, bzC = -4.5;
      // 서문고 자전거보관소 (참고 배치도 · 규격도 · 평면도): 12.0 × 4.6m 개방형 · 콘크리트 슬래브 · 아연도금 각관 기둥 □150 × 6 (H2500, 베이스 250×250) · H형강 보 100×200 · 아연도강판 골지붕 · LED 방수등 3 · 학교명 현판 3000×250 · 양면 거치대 2열 (중앙 통행로 약 1.5m) · 배수 트렌치 그레이팅
      const galvM = PM(0xa8acb0, .38, .75), roofM = PM(0x9aa0a4, .45, .6), ledM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 1.2 });
      pbox(12.0, .1, 4.6, PM(0xbcb8ae, .85), bxC, .05, bzC, g, { cast: false });
      [-5.85, 0, 5.85].forEach(dx => [-2.15, 2.15].forEach(dz => { pbox(.15, 2.5, .15, galvM, bxC + dx, 1.35, bzC + dz, g); pbox(.25, .02, .25, galvM, bxC + dx, .11, bzC + dz, g, { cast: false }); addCol(bxC + dx - .1, bxC + dx + .1, bzC + dz - .1, bzC + dz + .1); }));
      [-2.15, 2.15].forEach(dz => pbox(12.0, .2, .1, galvM, bxC, 2.7, bzC + dz, g));
      [-5.85, 0, 5.85].forEach(dx => pbox(.1, .2, 4.4, galvM, bxC + dx, 2.7, bzC, g));
      pbox(12.3, .04, 4.9, roofM, bxC, 2.82, bzC, g);
      for (let k = 0; k < 40; k++) pbox(.06, .03, 4.9, roofM, bxC - 6.1 + k * .31, 2.855, bzC, g, { cast: false });   // 골지붕 리브
      [-4, 0, 4].forEach(dx => { pbox(1.24, .08, .1, galvM, bxC + dx, 2.56, bzC, g, { cast: false }); pbox(1.18, .03, .06, ledM, bxC + dx, 2.51, bzC, g, { cast: false }); });
      pbox(3.0, .25, .05, PM(0x1e2e5a, .5, .3), bxC + 2.0, 2.7, bzC + 2.23, g, { cast: false });
      pmesh(new THREE.PlaneGeometry(2.96, .23), new THREE.MeshBasicMaterial({ map: makeSign('서문고등학교 자전거보관소', '#1e2e5a', '#ffffff', 24) }), bxC + 2.0, 2.7, bzC + 2.26, g, { cast: false });
      // 양면 거치대 (1400×580×600 모듈 · 강관 루프) + 자전거 40대 — 북열 · 남열, 각 2구간 × 10대 (형상은 재질별로 합쳐 메시 수를 줄인다)
      const bikeColors = [0x9a2222, 0x1e4878, 0xe8e8e4, 0x585c64, 0x6a2858, 0x2a2a2c];
      const gRack = [], gTire = [], gChrome = [], gSeat = [], gCol = bikeColors.map(() => []);
      const T = (geo, x, y, z, ry = 0, rx = 0) => { geo.rotateX(rx); geo.rotateY(ry); geo.translate(x, y, z); return geo; };
      [-1, 1].forEach(row => { const rz = bzC + row * 1.95, dir = -row;   // 거치대는 바깥 가장자리, 자전거는 안쪽(통행로)으로
        [-1, 1].forEach(seg => { const x0 = bxC + seg * 3.0 - 2.25;
          gRack.push(T(new THREE.BoxGeometry(4.7, .04, .04), x0 + 2.25, .14, rz - .29), T(new THREE.BoxGeometry(4.7, .04, .04), x0 + 2.25, .14, rz + .29));
          for (let i = 0; i < 10; i++) { const x = x0 + i * .5, c = (i * 7 + seg * 3 + row * 5 + 12) % bikeColors.length, bz = rz + dir * .55;
            gRack.push(T(new THREE.TorusGeometry(.28, .014, 5, 12, Math.PI), x, .14, rz, Math.PI / 2));
            if ((i + seg + row) % 7 === 3) continue;   // 빈 칸
            [-.5, .5].forEach(w => gTire.push(T(new THREE.TorusGeometry(.3, .025, 5, 14), x, .32, bz + w * dir, Math.PI / 2)));
            gCol[c].push(T(new THREE.BoxGeometry(.035, .04, .85), x, .58, bz), T(new THREE.BoxGeometry(.035, .5, .035), x, .55, bz + .25 * dir, 0, .3 * dir), T(new THREE.BoxGeometry(.035, .5, .035), x, .55, bz - .4 * dir, 0, -.25 * dir));
            gChrome.push(T(new THREE.BoxGeometry(.03, .5, .03), x, .7, bz - .48 * dir), T(new THREE.BoxGeometry(.5, .025, .025), x, .95, bz - .48 * dir), T(new THREE.BoxGeometry(.24, .16, .2), x, .82, bz - .62 * dir));
            gSeat.push(T(new THREE.BoxGeometry(.13, .05, .24), x, .86, bz + .32 * dir)); } });
        addCol(bxC - 5.75, bxC + 5.75, Math.min(rz, rz + dir * 1.25) - .05, Math.max(rz, rz + dir * 1.25) + .05); });
      const mm = (arr, m) => { if (!arr.length) return; const geo = mergeGeometries(arr); const me = new THREE.Mesh(geo, m); me.castShadow = true; g.add(me); };
      mm(gRack, galvM); mm(gTire, tireM); mm(gChrome, chromeM); mm(gSeat, darkMetal); gCol.forEach((a, i) => mm(a, PM(bikeColors[i], .4, .5)));
      // 배수 트렌치 그레이팅 (남측 도로 가장자리, 200 폭)
      pbox(12.0, .02, .2, darkMetal, bxC, .005, bzC + 2.45, g, { cast: false }); for (let k = 0; k < 60; k++) pbox(.02, .025, .18, chromeM, bxC - 5.9 + k * .2, .012, bzC + 2.45, g, { cast: false });
      world.props.push({ kind: 'robj', k: 'east_bikes', t: 'mega15k', floor: 0, x: bxC, z: bzC, y: .9, r: 2.4, label: '자전거 보관소 자물쇠 걸린 학생 자전거 바구니 조사하기' });

      // ★ 한국 학교 상징: 야외 타일 수돗가 · 단체 음수대 (x: 58.0, z: -11.2, 길이 8.4m × 양면 수도꼭지 8구)
      const fxC = 58.0, fzC = -11.2;
      pbox(9.2, .10, 3.2, stoneM, fxC, .05, fzC, g, { cast: false });
      // 중앙 수돗가 타일 수조 & 중앙 수도 배관 벽
      pbox(8.0, .62, 1.35, PM(0x88a8a4, .55), fxC, .31, fzC, g);
      pbox(7.6, .18, 1.05, PM(0x3a5254, .35), fxC, .58, fzC, g);
      pbox(8.0, .58, .22, PM(0xa8c2be, .50), fxC, .90, fzC, g);
      pbox(8.2, .08, .32, stoneM, fxC, 1.22, fzC, g);
      for (let tx = -3.0; tx <= 3.0; tx += 1.5) {
        [-1, 1].forEach(side => {
          pcyl(.022, .022, .16, goldM, fxC + tx, .96, fzC + side * .18, g, { rx: Math.PI / 2 });
          pcyl(.018, .018, .08, chromeM, fxC + tx, 1.02, fzC + side * .16, g);
        });
      }
      pmesh(new THREE.PlaneGeometry(2.6, .28), new THREE.MeshBasicMaterial({ map: makeSign('야외 음수대 (수돗가) · 물을 아껴 씁시다', '#163832', '#e8fff8', 20) }), fxC, 1.45, fzC, g, { cast: false });
      pmesh(new THREE.PlaneGeometry(2.6, .28), new THREE.MeshBasicMaterial({ map: makeSign('야외 음수대 (수돗가) · 물을 아껴 씁시다', '#163832', '#e8fff8', 20) }), fxC, 1.45, fzC, g, { ry: Math.PI, cast: false });
      addCol(fxC - 4.1, fxC + 4.1, fzC - .75, fzC + .75);
      world.props.push({ kind: 'robj', k: 'east_fountain', t: 'mega15k', floor: 0, x: fxC, z: fzC + 1.25, y: .95, r: 2.2, label: '야외 타일 수돗가 수도꼭지 틀어 찬물로 세수하기 (긴장 완화 · 스태미나 회복)' });
    }

    // ── (2) 체육부 전통 씨름장(원형 모래판 · 차양막) & 3단 철봉·평행봉 체력단련장 (x: 58.0, z: -21.5) ──
    {
      // 씨름장 리모델링 (참고 배치도 · 8.0 × 8.0m · 개방형 · 높이 약 4.0m): 석조 각기둥 8 · 사각 금속 지붕 · 남측 계단 출입 · 청색 바닥 매트 · 모래 원형 경기장 Ø5500 (모래층 300) · 관람석 목재 벤치 (3000×700) 동 · 서 · 용품 보관 선반 · 씨름 매트 · 샅바 걸이대 · 간이 탈의실 파티션
      const sxC = 55.5, szC = -21.5, sx0 = sxC - 4, sx1 = sxC + 4, sz0 = szC - 4, sz1 = szC + 4, colM = PM(0xb8b2a6, .8);
      pbox(8.2, .12, 8.2, stoneM, sxC, .06, szC, g, { cast: false }); pbox(7.2, .02, 7.2, PM(0x2e5a78, .7), sxC, .13, szC, g, { cast: false });
      [[-4, -4], [0, -4], [4, -4], [-4, 0], [4, 0], [-4, 4], [0, 4], [4, 4]].forEach(([a, b]) => { if (a === 0 && b === 4) return; pbox(.42, 3.4, .42, colM, sxC + a * .97, 1.82, szC + b * .97, g); addCol(sxC + a * .97 - .21, sxC + a * .97 + .21, szC + b * .97 - .21, szC + b * .97 + .21); });
      [[-1.9, 4], [1.9, 4]].forEach(([a, b]) => { pbox(.42, 3.4, .42, colM, sxC + a, 1.82, szC + b * .97, g); addCol(sxC + a - .21, sxC + a + .21, szC + b * .97 - .21, szC + b * .97 + .21); });
      pbox(8.6, .3, 8.6, colM, sxC, 3.65, szC, g); pmesh(new THREE.ConeGeometry(6.4, 1.6, 4), PM(0x3a3e42, .5, .5), sxC, 4.6, szC, g, { ry: Math.PI / 4 });
      // 낮은 난간벽 (출입 계단 쪽 제외)
      [[sx0 + .1, szC, .2, 7.4], [sx1 - .1, szC, .2, 7.4], [sxC, sz0 + .1, 7.4, .2]].forEach(([x, z, w, d]) => { pbox(w, .6, d, colM, x, .42, z, g); pbox(w + .04, .05, d + .04, darkMetal, x, 1.0, z, g, { cast: false }); addCol(x - w / 2, x + w / 2, z - d / 2, z + d / 2); });
      [[sx0 + 1.0, sxC - 1.6], [sxC + 1.6, sx1 - 1.0]].forEach(([a, b]) => { pbox(b - a, .6, .2, colM, (a + b) / 2, .42, sz1 - .1, g); addCol(a, b, sz1 - .2, sz1); });
      for (let k = 0; k < 3; k++) pbox(3.0, .12, .35, stoneM, sxC, .06 + k * .0, sz1 + .3 + k * .35, g, { cast: false });   // 남측 계단
      // 모래 원형 경기장 (Ø5500 · 테두리)
      pcyl(2.9, 2.95, .3, PM(0xe8e2d4, .6), sxC, .15, szC, g, { seg: 32 }); pcyl(2.75, 2.75, .32, sandPitM, sxC, .16, szC, g, { seg: 32 }); addCol(sxC - 2.9, sxC + 2.9, szC - 2.9, szC + 2.9, false, .32);
      pbox(.65, .04, .18, blueFabric, sxC - .45, .34, szC, g, { ry: .4 }); pbox(.65, .04, .18, redFabric, sxC + .45, .34, szC, g, { ry: -.5 });
      // 관람석 목재 벤치 (3000×700×800 · 등받이) 동 · 서
      [sx0 + .65, sx1 - .65].forEach((x, i) => { pbox(.45, .06, 3.0, woodLight, x, .45, szC - 1.0, g); pbox(.06, .4, 3.0, woodLight, x + (i ? .22 : -.22), .7, szC - 1.0, g); [-1.3, 1.3].forEach(d => pbox(.4, .42, .06, darkMetal, x, .21, szC - 1.0 + d, g, { cast: false })); addCol(x - .3, x + .3, szC - 2.5, szC + .5, false, .5); });
      // 용품 보관 선반 (북서) · 씨름 매트 적재 (북동) · 샅바 걸이대 · 간이 탈의실 파티션 (동남)
      steelShelf(g, sx0 + 1.3, sz0 + .45, 1.8, .45, 1.8, PM(0x8a3a28, .7));
      for (let k = 0; k < 4; k++) pbox(2.0, .05, 1.0, blueFabric, sx1 - 1.5, .18 + k * .05, sz0 + .75, g, { cast: false }); addCol(sx1 - 2.5, sx1 - .5, sz0 + .25, sz0 + 1.25, false, .4);
      { const x = sxC, z = sz0 + .5; [-.7, .7].forEach(d => pbox(.05, 1.5, .05, darkMetal, x + d, .75, z, g, { cast: false })); pbox(1.5, .04, .04, chromeM, x, 1.45, z, g, { cast: false }); [0xb02020, 0x2a4ea8, 0xd8b020, 0xb02020, 0x2a4ea8].forEach((c, k) => pbox(.12, .8, .02, PM(c, .8), x - .5 + k * .25, 1.05, z, g, { cast: false })); addCol(x - .75, x + .75, z - .15, z + .15); }
      [[sx1 - .55, sz1 - 1.6], [sx1 - .55, sz1 - 2.55]].forEach(([x, z]) => { pbox(.9, 2.0, .04, PM(0xa8a49a, .5, .3), x, 1.05, z - .45, g); pbox(.04, 2.0, .9, PM(0xa8a49a, .5, .3), x - .45, 1.05, z, g); addCol(x - .47, x + .45, z - .47, z + .45); });
      // 현판 (남측 보)
      pbox(1.6, .5, .08, woodDark, sxC, 3.2, sz1 + .12, g, { cast: false });
      pmesh(new THREE.PlaneGeometry(1.5, .42), new THREE.MeshBasicMaterial({ map: makeSign('씨름장', '#4a2e1a', '#f4e4c0', 34) }), sxC, 3.2, sz1 + .17, g, { cast: false });
      // 우측(x = 63.2): 고·중·저 3단 철봉(Pull-up Bars) & 평행봉(Parallel Bars)
      const bx0 = 62.2, bz0 = -21.5;
      [-3.0, -1.0, 1.0, 3.0].forEach(dz => pcyl(.045, .045, 2.4, chromeM, bx0, 1.2, bz0 + dz, g));
      pcyl(.028, .028, 2.0, chromeM, bx0, 2.32, bz0 - 2.0, g, { rx: Math.PI / 2 });
      pcyl(.028, .028, 2.0, chromeM, bx0, 1.98, bz0,       g, { rx: Math.PI / 2 });
      pcyl(.028, .028, 2.0, chromeM, bx0, 1.62, bz0 + 2.0, g, { rx: Math.PI / 2 });
      // 평행봉
      [-0.35, 0.35].forEach(ox => {
        [-1.4, 1.4].forEach(dz => pcyl(.035, .035, 1.35, darkMetal, bx0 + 2.2 + ox, .675, bz0 + dz, g));
        pcyl(.028, .028, 3.0, chromeM, bx0 + 2.2 + ox, 1.35, bz0, g, { rx: Math.PI / 2 });
      });
      world.props.push({ kind: 'robj', k: 'east_ssireum', t: 'mega15k', floor: 0, x: sxC, z: szC + 3.3, y: .4, r: 2.5, label: '씨름장 모래판 파헤쳐 1998년 체육대회 유실물 수색하기' });
    }

    // ── (3) 서문고 역사관 · 개교기념관 (워커블 적벽돌 단층 박물관) & 구관 동종(학교 종) 종각 (x: 84.0, z: -11.0) ──
    {
      const hxC = 84.5, hzC = -11.0, hw = 15.6, hd = 10.6, hh = 4.6;
      buildShell(g, hxC, hzC, hw, hd, hh, brickM, darkMetal, 'W', woodFloor);
      // 정문(서측, x = hxC - hw/2) 클래식 박공 포치 & 현판
      pbox(1.8, .24, 4.4, stoneM, hxC - hw / 2 - 1.0, 3.15, hzC, g);
      [-1.8, 1.8].forEach(dz => pcyl(.18, .20, 3.1, stoneM, hxC - hw / 2 - 1.7, 1.55, hzC + dz, g));
      pbox(.14, .58, 4.6, darkMetal, hxC - hw / 2 - 1.92, 3.52, hzC, g, { cast: false });
      pmesh(new THREE.PlaneGeometry(4.4, .48), new THREE.MeshBasicMaterial({ map: makeSign('서문고 역사관 · 개교기념관 (SEOMUN HISTORY MUSEUM · 1968)', '#281814', '#f6e8c8', 20) }), hxC - hw / 2 - 2.0, 3.52, hzC, g, { ry: -Math.PI / 2, cast: false });
      // 역사관 실내 리모델링 (참고 배치도 · 15.6 × 10.6m): 서측 정문 → 로비/홀 (안내 데스크) · 북측 자료보관실 · 남측 사무실 · 동쪽 전시실 1 (학교 역사) · 전시실 2 (지역 역사)
      const x0 = hxC - hw / 2, x1 = hxC + hw / 2, z0 = hzC - hd / 2, z1 = hzC + hd / 2, xA = x0 + 6.0;
      iwall(g, x0, z0 + 3.5, xA, z0 + 3.5, [[x0 + 3.0, x0 + 4.2]]); iwall(g, x0, z1 - 3.0, xA, z1 - 3.0, [[x0 + 3.0, x0 + 4.2]]);
      iwall(g, xA, z0, xA, z1, [[hzC - 1.9, hzC - .7], [hzC + .7, hzC + 1.9]]); iwall(g, xA, hzC, x1, hzC, [[x1 - 2.4, x1 - 1.2]]);
      // 로비: 안내 데스크 (1800×700×1000) · 전시 패널 · 학교 상징 기념비
      pbox(1.8, 1.0, .7, woodLight, x0 + 3.5, .5, z0 + 3.95, g); addCol(x0 + 2.6, x0 + 4.4, z0 + 3.6, z0 + 4.3, false, 1.0); monitor(g, x0 + 3.1, 1.0, z0 + 3.8, Math.PI);
      pmesh(new THREE.PlaneGeometry(2.4, 1.3), new THREE.MeshBasicMaterial({ map: makeSign('우리의 역사 우리의 미래 · 서문고 개교 1968', '#2a1e14', '#f4e4c0', 18) }), x0 + 3.0, 1.7, z1 - 3.08, g, { ry: Math.PI, cast: false });
      // 자료보관실 (북서): 서가 · 문서 보관함 · 사무용 책상
      [x0 + .5, x0 + 1.45, x0 + 2.4].forEach(x => steelShelf(g, x, z0 + .3, .9, .45, 1.8, PM(0xb08a58, .9))); steelShelf(g, xA - .3, z0 + 1.6, .45, .9, 1.8, PM(0xb08a58, .9)); deskT(g, x0 + 1.4, z0 + 2.3, 1.2, .7);
      // 사무실 (남서): 사무용 책상 (1200×700) + 의자 · 문서 보관함 · PC
      deskT(g, x0 + 1.2, z1 - 1.3, .7, 1.2); monitor(g, x0 + 1.1, .74, z1 - 1.3, Math.PI / 2); addChair(g, x0 + 1.9, z1 - 1.3, -Math.PI / 2, blueFabric); pbox(.9, 1.8, .45, PM(0x8a8e90, .5, .4), xA - .7, .9, z1 - .3, g); addCol(xA - 1.15, xA - .25, z1 - .55, z1);
      // 전시실 1 (북동, 학교 역사) · 전시실 2 (남동, 지역 역사): 벽면 전시 진열장 · 중앙 대형 진열장 (1800×750) · 전시 패널 · 지도
      [-1, 1].forEach(s => { const zc = hzC + s * hd / 4, zw = s < 0 ? z0 : z1;
        for (let k = 0; k < (s < 0 ? 3 : 4); k++) tallCase(g, xA + 1.4 + k * 1.9, zw - s * .35, 1.2, .6);
        vitrine(g, (xA + x1) / 2, zc, 1.8, .75); vitrine(g, (xA + x1) / 2 + 2.6, zc, 1.2, .6);
        pmesh(new THREE.PlaneGeometry(2.6, 1.5), new THREE.MeshBasicMaterial({ map: makeSign(s < 0 ? '서문고 30년 연혁 (1968~1998)  |  1998.10.12 제30회 개교기념 방송제 특별전시' : '서문 지역 역사 지도 · 향토 유물', '#1c1612', '#f4e4c0', 18) }), x1 - .08, 1.9, zc, g, { ry: -Math.PI / 2, cast: false }); });
      // 황동 타임캡슐 좌대 (전시실 1)
      pbox(1.0, .9, 1.0, stoneM, xA + 1.6, .45, hzC - 1.6, g); pcyl(.28, .28, .6, goldM, xA + 1.6, 1.15, hzC - 1.6, g, { rz: Math.PI / 2 }); addCol(xA + 1.1, xA + 2.1, hzC - 2.1, hzC - 1.1);
      world.props.push({ kind: 'robj', k: 'east_museum', t: 'mega15k', floor: 0, x: xA + 2.8, z: hzC - 1.4, y: 1.1, r: 2.4, label: '서문고 역사관 개교 30주년 기념 타임캡슐 & 1998년 졸업앨범 기록 조사하기' });

      // ★ 역사관 앞마당(x: 74.5, z: -4.2): 구관 청동 학교 종(銅鍾) 종각 파빌리온
      const bxB = 72.0, bzB = -8.5;   // 역사관 진입로 · 건물 모서리와 겹치던 자리(74.8, −3.8)에서 서쪽 마당으로
      pbox(2.8, .28, 2.8, stoneM, bxB, .14, bzB, g);
      [[-1.05, -1.05], [1.05, -1.05], [-1.05, 1.05], [1.05, 1.05]].forEach(([px, pz]) => {
        pcyl(.11, .13, 2.8, woodDark, bxB + px, 1.54, bzB + pz, g);
      });
      pmesh(new THREE.ConeGeometry(2.35, .95, 4), darkMetal, bxB, 3.38, bzB, g, { ry: Math.PI / 4 });
      // 청동 학교 종 & 타종 당목
      pcyl(.32, .46, .78, goldM, bxB, 2.18, bzB, g, { seg: 16 });
      pbox(.12, .12, .95, woodLight, bxB - .55, 2.08, bzB, g, { ry: Math.PI / 2 });
      pmesh(new THREE.PlaneGeometry(1.8, .28), new THREE.MeshBasicMaterial({ map: makeSign('구관 학교 종 (1968~1998)', '#221a12', '#f6e4b8', 20) }), bxB - 1.18, 2.75, bzB, g, { ry: -Math.PI / 2, cast: false });
      addCol(bxB - 1.35, bxB + 1.35, bzB - 1.35, bzB + 1.35);
      world.props.push({ kind: 'robj', k: 'east_bell', t: 'mega15k', floor: 0, x: bxB - 1.65, z: bzB, y: 1.4, r: 2.2, label: '구관 청동 학교 종(銅鍾) 타종하기 (종소리가 캠퍼스에 울린다)' });
    }

    // ── (4) 90년대 공중전화 부스 2동 · 학우매점 야외 평상/파라솔 쉼터 & 학교 분리수거장 · 벽돌 소각장 (x: 84.0, z: +15.0) ──
    {
      // ① 학우매점 맞은편(x: 75.5, z: 10.5 ~ 19.5): 1998년식 옥색 공중전화 부스 2동 & 야외 목재 평상·파라솔 테이블 2조
      [10.2, 11.8].forEach((pz, pi) => {
        const px = 74.6;
        pbox(1.05, .10, 1.05, stoneM, px, .05, pz, g);
        pbox(.96, .14, .96, mintBoothM, px, 2.28, pz, g);
        [[-.44, -.44], [.44, -.44], [-.44, .44], [.44, .44]].forEach(([cx0, cz0]) => {
          pbox(.06, 2.15, .06, mintBoothM, px + cx0, 1.12, pz + cz0, g);
        });
        pbox(.04, 2.1, .88, glassM, px, 1.12, pz - .44, g, { cast: false });
        pbox(.04, 2.1, .88, glassM, px, 1.12, pz + .44, g, { cast: false });
        pbox(.88, 2.1, .04, glassM, px + .44, 1.12, pz, g, { cast: false });
        // 부스 내부 은색 카드/동전 겸용 공중전화기 & 천장 조명
        pbox(.22, .42, .28, chromeM, px + .26, 1.32, pz, g);
        pbox(.65, .04, .65, lampEm, px, 2.18, pz, g, { cast: false });
        if (pi === 0) {
          pmesh(new THREE.PlaneGeometry(1.9, .26), new THREE.MeshBasicMaterial({ map: makeSign('공중전화 · PUBLIC PHONE', '#144842', '#e8fff8', 20) }), px - .49, 2.28, pz + .8, g, { ry: -Math.PI / 2, cast: false });
        }
        addCol(px - .52, px + .52, pz - .52, pz + .52);
      });
      world.props.push({ kind: 'robj', k: 'east_payphone', t: 'mega15k', floor: 0, x: 73.6, z: 11.0, y: 1.3, r: 2.2, label: '90년대 교내 공중전화 부스 수화기 들기 (동전 반환구 & 마지막 발신음 확인)' });

      // 학우매점 야외 목재 평상 2기 & 파라솔 원형 테이블 2기 (x: 76.8, z: 15.5, 19.5)
      [15.2, 19.2].forEach((pz, idx) => {
        const px = 76.8;
        // 한국 매점 앞 특유의 넓은 나무 평상(Pyeongsang) & 파라솔
        pbox(2.4, .42, 1.8, woodLight, px, .21, pz, g);
        pcyl(.05, .05, 2.35, chromeM, px, 1.2, pz, g);
        pmesh(new THREE.ConeGeometry(1.75, .58, 8), idx === 0 ? redFabric : blueTarpM, px, 2.42, pz, g);
        addCol(px - 1.2, px + 1.2, pz - .9, pz + .9, false, .42);
      });

      // ② 분리수거장 · 소각시설 리모델링 (참고 배치도 · 16.0 × 11.0m · 높이 약 4.0m): 서쪽(도로) 개방 분리수거장 (철골 기둥 · 금속 지붕 · 대형 컨테이너 · 철제 케이지) / 남측 저장 · 작업공간 · 관리실 / 동남 소각장 (소각로 · 집진 장치 · 배출 굴뚝 Ø600 × 8000)
      const rx0 = 78.5, rx1 = 94.5, rz0 = 10.0, rz1 = 21.0, rzM = 16.0, roofH = 4.0, galv = PM(0x8a9094, .45, .6);
      pbox(rx1 - rx0, .12, rz1 - rz0, stoneM, (rx0 + rx1) / 2, .06, (rz0 + rz1) / 2, g, { cast: false });
      // 분리수거장 (북측 6m): 동벽 · 북벽 시멘트 담장 + 서쪽 개방 기둥 + 금속 지붕 + 현판
      pbox(rx1 - rx0, 2.4, .22, stoneM, (rx0 + rx1) / 2, 1.2, rz0 + .11, g); addCol(rx0, rx1, rz0, rz0 + .22);
      [rx0 + .15, rx0 + 5.4, rx0 + 10.7].forEach(x => { pbox(.2, roofH, .2, galv, x, roofH / 2, rzM - .1, g); addCol(x - .1, x + .1, rzM - .2, rzM); });
      pbox(rx1 - rx0 + .4, .14, rzM - rz0 + .4, darkMetal, (rx0 + rx1) / 2, roofH + .07, (rz0 + rzM) / 2, g, { rx: -.03 });
      pbox(4.8, .6, .1, PM(0x3a4038, .5, .3), rx0 + 4.0, roofH - .4, rzM + .06, g, { cast: false });
      pmesh(new THREE.PlaneGeometry(4.6, .5), new THREE.MeshBasicMaterial({ map: makeSign('분리수거장 · 소각시설', '#2a2e28', '#f0ecd8', 26) }), rx0 + 4.0, roofH - .4, rzM + .12, g, { cast: false });
      const binC = [0x2e6a3a, 0x2a4e8a, 0xc8a020, 0x6a6e72];
      for (let k = 0; k < 9; k++) { const x = rx0 + 1.0 + k * 1.45, c = binC[k % 4]; pbox(1.37, 1.1, .77, PM(c, .6, .1), x, .65, rz0 + .7, g); pbox(1.4, .08, .8, PM(c, .5, .1), x, 1.24, rz0 + .7, g, { rx: -.15 }); [-.55, .55].forEach(d => pcyl(.06, .06, .08, PM(0x1a1a1a, .8), x + d, .06, rz0 + .7, g, { rx: Math.PI / 2 })); }
      addCol(rx0 + .3, rx0 + 13.6, rz0 + .25, rz0 + 1.12);
      pmesh(new THREE.PlaneGeometry(3.2, .3), new THREE.MeshBasicMaterial({ map: makeSign('① 일반 · ② 플라스틱 · ③ 캔 · 고철 · ④ 폐지', '#1c2826', '#d8f0e4', 18) }), rx0 + 6.0, 2.0, rz0 + .24, g, { cast: false });
      const cage = (x, z) => { const cg = []; [[-.6, -.5], [.6, -.5], [-.6, .5], [.6, .5]].forEach(([a, b]) => pbox(.04, 1.2, .04, chromeM, x + a, .6, z + b, g, { cast: false })); [.1, 1.2].forEach(y => pbox(1.2, .03, 1.0, chromeM, x, y, z, g, { cast: false }));
        for (let k = -5; k <= 5; k++) { pbox(.01, 1.1, .01, chromeM, x + k * .12, .65, z - .5, g, { cast: false }); pbox(.01, 1.1, .01, chromeM, x + k * .12, .65, z + .5, g, { cast: false }); } pbox(1.0, .8, .8, PM(0xe8e4dc, .9), x, .55, z, g); addCol(x - .6, x + .6, z - .5, z + .5); };
      [rx0 + 12.0, rx0 + 13.4].forEach(x => cage(x, rz0 + 2.4)); cage(rx0 + 14.9, rz0 + 3.9);
      // 남측 실: 저장/작업공간 (서) · 관리실 (가운데, 창) · 소각장 (동, 북쪽 분리수거장 쪽 출입)
      const xs1 = rx0 + 4.6, xs2 = rx0 + 8.2;
      iwall(g, rx0, rzM, rx1, rzM, [[rx0 + 12.0, rx0 + 13.6]], stoneM); iwall(g, rx0, rz1, rx1, rz1, [], stoneM); iwall(g, rx1, rz0, rx1, rz1, [], stoneM);
      iwall(g, rx0, rzM, rx0, rz1, [[rzM + 1.4, rzM + 2.6]], stoneM); iwall(g, xs1, rzM, xs1, rz1, [], stoneM); iwall(g, xs2, rzM, xs2, rz1, [], stoneM);
      iwall(g, xs1, rzM, xs2, rzM, [[xs1 + 1.2, xs1 + 2.2]], stoneM);   // 관리실 문 (북측 분리수거장에서)
      pbox(rx1 - rx0, .14, rz1 - rzM, darkMetal, (rx0 + rx1) / 2, roofH + .07, (rzM + rz1) / 2, g);
      pmesh(new THREE.PlaneGeometry(1.4, 1.0), new THREE.MeshStandardMaterial({ color: 0x9ab8c8, roughness: .1, metalness: .3, transparent: true, opacity: .5 }), (xs1 + xs2) / 2, 1.6, rz1 + .09, g, { cast: false });
      // 저장/작업공간: 선반 랙 · 작업 테이블 · 드럼통 (200L) · 바퀴 수레 · 마대
      steelShelf(g, rx0 + .4, rz1 - 1.6, .45, 1.8, 1.8, PM(0xc8a020, .6)); deskT(g, rx0 + 2.5, rz1 - .6, 1.8, .75, .85, chromeM, chromeM);
      [[rx0 + 4.0, rzM + .6], [rx0 + 4.0, rzM + 1.3]].forEach(([x, z]) => pcyl(.29, .29, .88, PM(0x1e4a9a, .45, .4), x, .44, z, g)); addCol(rx0 + 3.65, rx0 + 4.35, rzM + .25, rzM + 1.65);
      // 관리실: 사무 책상 · PC · 캐비닛 · 벽시계 자리
      deskT(g, (xs1 + xs2) / 2, rz1 - .8, 1.6, .8); monitor(g, (xs1 + xs2) / 2 - .3, .74, rz1 - .9, 0); addChair(g, (xs1 + xs2) / 2, rz1 - 1.6, 0, blueFabric); pbox(.9, 1.8, .45, PM(0x8a8e90, .5, .4), xs2 - .5, .9, rzM + .4, g); addCol(xs2 - .95, xs2 - .05, rzM + .17, rzM + .63);
      // 소각장: 소각로 (2500×4500×3200 · 투입구 잔불) · 집진 장치 · 배출 굴뚝 (Ø600 × 8000) · 안전보관함
      const ixC = rx1 - 2.6, izC = (rzM + rz1) / 2;
      pbox(2.5, 2.9, 2.6, PM(0x6a6e70, .55, .55), ixC, 1.45, izC, g); pbox(2.6, .3, 2.7, PM(0x4a4e50, .5, .6), ixC, 3.05, izC, g);
      pbox(.08, .9, .9, PM(0xb02020, .5, .4), ixC - 1.29, 1.0, izC, g); pmesh(new THREE.PlaneGeometry(.6, .6), emberEm, ixC - 1.34, 1.0, izC, g, { ry: -Math.PI / 2, cast: false });
      addCol(ixC - 1.3, ixC + 1.3, izC - 1.35, izC + 1.35);
      pbox(1.0, 2.6, 1.2, PM(0x8a9094, .5, .6), ixC - 3.3, 1.3, izC + 1.4, g); pcyl(.35, .1, .6, PM(0x8a9094, .5, .6), ixC - 3.3, .3, izC + 1.4, g); addCol(ixC - 3.8, ixC - 2.8, izC + .8, izC + 2.0);
      pcyl(.3, .3, 8.0, chromeM, ixC + .6, 4.0, izC - .6, g); pcyl(.36, .36, .3, darkMetal, ixC + .6, 8.0, izC - .6, g);
      pcyl(.2, .2, 2.6, chromeM, ixC - 1.9, 3.3, izC + .2, g, { rz: Math.PI / 2 });
      pbox(.7, 1.0, .3, PM(0xb02020, .5, .3), rx1 - .3, .5, rzM + .5, g); addCol(rx1 - .45, rx1, rzM + .35, rzM + .65);
      world.props.push({ kind: 'robj', k: 'east_incinerator', t: 'mega15k', floor: 0, x: ixC - 1.9, z: izC, y: 1.0, r: 2.3, label: '구식 벽돌 소각로 투입구 열어 타다 남은 1998년 방송부 원고 조각 확인하기' });
    }

    // ── (5) 동편 중앙 교차로(x: 74.8, z: 3.2): 서문 백주년 학술 시계탑 & 동편 대로 가로등 17기 ──
    {
      const cx = 74.8, cz = 3.2;
      pbox(2.4, .42, 2.4, stoneM, cx, .21, cz, g);
      pbox(1.12, 4.5, 1.12, brickM, cx, 2.65, cz, g);
      pbox(1.42, .30, 1.42, stoneM, cx, 5.05, cz, g);
      pbox(.92, .82, .92, darkMetal, cx, 5.60, cz, g);
      [[-0.56, 0, -Math.PI / 2], [0.56, 0, Math.PI / 2], [0, -0.56, Math.PI], [0, 0.56, 0]].forEach(([ox, oz, ry]) => {
        pmesh(new THREE.CircleGeometry(.40, 18), lampEm, cx + ox, 4.25, cz + oz, g, { ry, cast: false });
      });
      pmesh(new THREE.SphereGeometry(.38, 16, 12), goldM, cx, 6.32, cz, g);
      pmesh(new THREE.PlaneGeometry(2.1, .34), new THREE.MeshBasicMaterial({ map: makeSign('서문 백주년 시계탑 · 동편 캠퍼스 광장', '#18242c', '#f4e8c8', 20) }), cx - .58, 2.05, cz, g, { ry: -Math.PI / 2, cast: false });
      addCol(cx - 1.2, cx + 1.2, cz - 1.2, cz + 1.2);

      // 동편 남북 종단 대로(x = 68.8 / 72.8) 및 동서 보행로(z = 3.0) 가로등
      const addStreetLamp = (lx, lz) => {
        pcyl(.08, .11, 4.6, darkMetal, lx, 2.3, lz, g, { seg: 10 });
        pbox(.85, .08, .12, darkMetal, lx, 4.55, lz, g, { cast: false });
        pmesh(new THREE.SphereGeometry(.22, 12, 10), lampEm, lx, 4.42, lz, g, { cast: false });
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('255,235,185'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .55 }));
        sp.scale.setScalar(5.2); sp.position.set(lx, 4.35, lz); g.add(sp);
      };
      for (const lz of [-42, -26, -12, 2, 16, 30, 42]) {
        addStreetLamp(68.8, lz);
        addStreetLamp(72.8, lz);
      }
      for (const lx of [46, 54, 62]) {
        addStreetLamp(lx, 3.0);
      }
    }
  }

  /* =========================================================================
     ⑤-A [종합 스포츠 섹션 1] 야외 하드코트 테니스장 & 양궁 전용 훈련장 — 서중북 (x: -88, z: -14)
     ========================================================================= */
  {
    // 테니스 · 양궁 훈련장 리모델링 (참고 평면도 · 배치도 · 20.0 × 16.0m): 서측 축소형 테니스 코트 (적색 외곽 + 녹색 코트 · 네트 6100×914) · 동측 양궁 연습 레인 3 (표적 백스탑 1220 · 안전 방호 네트 4000 · 사수선) · 사수선 캐노피 · 관람석 벤치 · 코치 구역 · 장비 보관소 (3000×2000×2400) · 화살 거치대 · 조명 폴 · 외곽 펜스 3000 · 남측 출입구
    const cx = -88, cz = -16, x0 = cx - 10, x1 = cx + 10, z0 = cz - 8, z1 = cz + 8;
    const g = new THREE.Group(); g.name = 'chunk_tennis'; g.userData.dynamic = true; OUT.add(g);
    pbox(20, .04, 16, PM(0x6a6e64, .85), cx, .02, cz, g, { cast: false });
    // 테니스 코트 (서측 8.6 × 13.5)
    const tx = x0 + 4.6, tz = cz - .5;
    pbox(8.6, .05, 13.0, PM(0x9a3a2c, .8), tx, .03, tz, g, { cast: false }); pbox(5.6, .055, 10.4, PM(0x2a6a44, .75), tx, .035, tz, g, { cast: false });
    [[5.6, .06, 0, -5.2], [5.6, .06, 0, 5.2], [5.6, .06, 0, -2.6], [5.6, .06, 0, 2.6]].forEach(([w, d, a, b]) => pbox(w, .06, d, whiteWall, tx + a, .04, tz + b, g, { cast: false }));
    [-2.8, 2.8, 0].forEach(a => pbox(.06, .06, a ? 10.4 : 5.2, whiteWall, tx + a, .04, tz, g, { cast: false }));
    [-3.05, 3.05].forEach(a => pcyl(.04, .04, 1.07, darkMetal, tx + a, .535, tz, g)); pbox(6.1, .85, .02, PM(0x1a1c1e, .9), tx, .5, tz, g, { cast: false }); pbox(6.1, .05, .04, whiteWall, tx, .92, tz, g, { cast: false }); addCol(tx - 3.1, tx + 3.1, tz - .08, tz + .08);
    // 양궁 레인 (동측): 표적 백스탑 3 (북) · 방호 네트 (높이 4m) · 사수선 · 레인 구분선
    const ax = x1 - 5.3; pbox(9.6, .05, 15.4, PM(0x5a7a6a, .85), ax, .028, cz, g, { cast: false });
    [-3.0, 0, 3.0].forEach(d => { const x = ax + d, z = z0 + 1.2; pbox(1.22, 1.22, .3, PM(0xe8e2d0, .8), x, 1.0, z, g); [[.55, 0xf0f0f0], [.45, 0x1a1a1a], [.35, 0x2a6ac8], [.24, 0xd82820], [.12, 0xf0d020]].forEach(([r, c], k) => pmesh(new THREE.CircleGeometry(r, 24), PM(c, .6), x, 1.0, z + .16 + k * .002, g, { cast: false }));
      [-.5, .5].forEach(s => pbox(.06, 1.6, .06, woodDark, x + s, .8, z - .25, g, { rx: .15, cast: false })); addCol(x - .65, x + .65, z - .4, z + .2); pbox(.04, .02, 9.0, whiteWall, x + 1.5, .06, cz - .4, g, { cast: false }); });
    pbox(9.6, 4.0, .02, fenceMesh, ax, 2.0, z0 + .25, g, { cast: false });
    pbox(9.0, .03, .12, PM(0xc82828, .6), ax, .06, z1 - 5.0, g, { cast: false }); pmesh(new THREE.PlaneGeometry(1.6, .3), new THREE.MeshBasicMaterial({ map: makeSign('사수선 (70m 축소연습)', '#5a1414', '#ffffff', 18) }), ax, .07, z1 - 4.7, g, { rx: -Math.PI / 2, cast: false });
    // 사수선 캐노피 (반투명 지붕) + 벤치 · 화살 거치대
    { const cz2 = z1 - 3.6; [[-3.8, -1.3], [3.8, -1.3], [-3.8, 1.3], [3.8, 1.3]].forEach(([a, b]) => pcyl(.05, .05, 2.6, PM(0x8a9094, .45, .6), ax + a, 1.3, cz2 + b, g)); pbox(8.0, .06, 3.0, new THREE.MeshStandardMaterial({ color: 0x8ab8d8, roughness: .2, transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false }), ax, 2.62, cz2, g, { cast: false });
      benchS(g, ax - 2.4, cz2 + .6); benchS(g, ax + .4, cz2 + .6); pbox(1.0, 1.2, .5, woodDark, ax + 3.2, .6, cz2 + .8, g); for (let k = 0; k < 8; k++) pcyl(.006, .006, .9, chromeM, ax + 2.8 + k * .11, 1.0, cz2 + .8, g); addCol(ax + 2.7, ax + 3.7, cz2 + .55, cz2 + 1.05); }
    // 관람석 벤치 (테니스 남측) · 코치 구역 · 장비 보관소 (동남)
    benchS(g, tx - 2.0, z1 - .6); benchS(g, tx + .4, z1 - .6);
    shed(g, x1 - 1.8, z1 - 1.3, 3.0, 2.0, '장비 보관소');
    pmesh(new THREE.PlaneGeometry(1.4, .4), new THREE.MeshBasicMaterial({ map: makeSign('코치 구역', '#1c2a24', '#e8f0e8', 20) }), cx + 1.6, 1.6, z1 - .1, g, { ry: Math.PI, cast: false });
    // 외곽 펜스 (3.0m) · 남측 출입구 · 학교명 현판 · 조명 폴
    fenceLine(g, x0, z0, x1, z0, 4.0); fenceLine(g, x0, z0, x0, z1, 3.0); fenceLine(g, x1, z0, x1, z1, 3.0); fenceLine(g, x0, z1, x1, z1, 3.0, [[cx - .2, cx + 1.4]]);
    pbox(2.4, .5, .08, PM(0x1e2e5a, .5, .3), cx - 1.8, 1.4, z1 + .08, g, { cast: false }); pmesh(new THREE.PlaneGeometry(2.3, .45), new THREE.MeshBasicMaterial({ map: makeSign('서문고등학교 테니스 · 양궁장', '#1e2e5a', '#ffffff', 20) }), cx - 1.8, 1.4, z1 + .13, g, { cast: false });
    [[x0 + .3, z0 + .3], [x0 + .3, z1 - .3], [x1 - .3, z0 + .3], [cx, z0 + .3]].forEach(([x, z]) => lightPole(g, x, z));
    chunks.push({ id: 'chunk_tennis', g, x: cx, z: cz });
  }

  /* =========================================================================
     ⑤-B [종합 스포츠 섹션 2] 서문고 야구 스타디움 (내야 다이아몬드 · 양측 덕아웃 · 전광판) — 서중남 (x: -88, z: 17)
     ========================================================================= */
  {
    const cx = -88, cz = 14;
    const g = new THREE.Group(); g.name = 'chunk_sports'; g.userData.dynamic = true; OUT.add(g);
    pbox(24, .04, 26, PM(0x265838, .85), cx, .02, cz, g, { cast: false });
    const dirtM = PM(0x8a6848, .92);
    pmesh(new THREE.PlaneGeometry(11.5, 11.5), dirtM, cx, .035, cz + 2.0, g, { rx: -Math.PI / 2, rz: Math.PI / 4, cast: false });
    pcyl(1.3, 1.6, .18, dirtM, cx, .09, cz + 2.0, g, { seg: 16 });
    pbox(.45, .04, .22, whiteWall, cx, .19, cz + 2.0, g, { cast: false });
    [[0, 7.3], [5.3, 2.0], [0, -3.3], [-5.3, 2.0]].forEach(([bx0, bz0]) => pbox(.42, .05, .42, whiteWall, cx + bx0, .045, cz + bz0, g, { cast: false }));
    [[-9.2, Math.PI / 2], [9.2, -Math.PI / 2]].forEach(([dx, ry], di) => {
      const dg = new THREE.Group(); dg.position.set(cx + dx, 0, cz + 2.5); dg.rotation.y = ry; g.add(dg);
      pbox(8.4, .12, 2.8, PM(0x285a3a, .85), 0, .06, 0, dg, { cast: false });
      pbox(8.4, 2.6, .24, stoneM, 0, 1.3, -1.28, dg);
      [-4.08, 4.08].forEach(sx => pbox(.24, 2.6, 2.8, stoneM, sx, 1.3, 0, dg));
      pbox(8.8, .26, 3.2, stoneM, 0, 2.72, .1, dg);
      pbox(8.2, .85, .08, darkMetal, 0, .425, 1.25, dg);
      pbox(7.2, .45, .45, woodLight, 0, .225, -.75, dg);
      pbox(7.2, .45, .08, woodDark, 0, .62, -.95, dg);
      pmesh(new THREE.PlaneGeometry(3.2, .38), new THREE.MeshBasicMaterial({ map: makeSign(di === 0 ? 'HOME DUGOUT · 서문고 야구부' : 'GUEST DUGOUT · 방문팀 덕아웃', '#162836', '#f0ead6', 22) }), 0, 2.72, 1.72, dg, { cast: false });
      addCol(cx + dx - 1.5, cx + dx + 1.5, cz - 1.8, cz + 6.8);
    });
    pbox(.85, .58, .55, PM(0x2468b8, .4), cx + 6.8, .29, cz + 7.8, g);
    [[-10.5, -10.5], [10.5, -10.5], [-10.5, 10.5], [10.5, 10.5]].forEach(([lx, lz]) => {
      pcyl(.12, .16, 7.5, chromeM, cx + lx, 3.75, cz + lz, g);
      pbox(1.4, .45, .35, lampEm, cx + lx, 7.6, cz + lz, g, { cast: false });
      const spS = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('255,245,215'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .65 }));
      spS.scale.setScalar(8.5); spS.position.set(cx + lx, 7.2, cz + lz); g.add(spS);
    });
    const coolerLidPiv = new THREE.Group(); coolerLidPiv.userData.dynamic = true; coolerLidPiv.position.set(cx + 6.8, .58, cz + 8.06); g.add(coolerLidPiv);
    pbox(.87, .07, .57, whiteWall, 0, .035, -.28, coolerLidPiv);
    world.props.push({ kind: 'robj', k: 'sports_cooler', t: 'mega15k', floor: 0, x: cx + 6.8, z: cz + 6.8, y: .6, r: 2.2, label: '야구부 덕아웃 아이스박스 열기', anim: { type: 'lid', lidPiv: coolerLidPiv, openAngle: 1.45, t: 0, active: false } });
    // 야구 스타디움 리모델링 (참고 평면도 · 배치도 · 24.0 × 26.0m): 외곽 펜스 (높이 4m) · 남측 관람 출입구 · 백스톱 스크린 (8000×6000) · 북서 관람석 스탠드 (6000×4500 · 3단 · 지붕) · 북동 수동식 스코어보드 (4000×2000) · 북측 볼펜/장비 보관 창고 (3000×2000×2200) · 그라운드 정비 카트 · 학교명 현판
    { const x0 = cx - 12, x1 = cx + 12, z0 = cz - 13, z1 = cz + 13;
      fenceLine(g, x0, z0, x1, z0, 4.0); fenceLine(g, x0, z0, x0, z1, 4.0); fenceLine(g, x1, z0, x1, z1, 4.0); fenceLine(g, x0, z1, x1, z1, 4.0, [[cx - 6.2, cx - 4.2]]);
      pbox(8.0, 6.0, .03, fenceMesh, cx, 3.0, cz + 10.1, g, { cast: false }); addCol(cx - 4, cx + 4, cz + 10.02, cz + 10.18); [-4, -1.3, 1.3, 4].forEach(d => pcyl(.07, .07, 6.0, PM(0x8a9094, .45, .6), cx + d, 3.0, cz + 10.1, g));
      // 관람석 스탠드 (북서): 3단 알루미늄 벤치 + 계단 받침 + 지붕
      { const sx = x0 + 3.6, sz = z0 + 3.0; for (let r = 0; r < 3; r++) { pbox(6.0, .45 * (r + 1), 1.0, PM(0x8a8e90, .5, .4), sx, .225 * (r + 1), sz + 1.0 - r * 1.0, g); pbox(6.0, .05, .35, chromeM, sx, .45 * (r + 1) + .03, sz + 1.25 - r * 1.0, g, { cast: false }); }
        [-2.9, 2.9].forEach(d => [-1.6, 1.7].forEach(e => pcyl(.06, .06, 2.6, PM(0x8a9094, .45, .6), sx + d, 1.3 + (e < 0 ? .4 : 0), sz + e, g))); pbox(6.4, .08, 4.0, PM(0x6a7076, .5, .5), sx, 2.75, sz, g, { rx: .08 });
        addCol(sx - 3.0, sx + 3.0, sz - 1.5, sz + 1.5, false, 1.35); }
      // 스코어보드 (북동): TEAM 1~9 R · B · S · O
      { const bx = x1 - 4.0, bz = z0 + .6; [-1.6, 1.6].forEach(d => pcyl(.08, .08, 2.6, darkMetal, bx + d, 1.3, bz, g)); pbox(4.0, 2.0, .15, PM(0x1e4a32, .6), bx, 3.4, bz, g);
        pmesh(new THREE.PlaneGeometry(3.8, 1.8), new THREE.MeshBasicMaterial({ map: makeSign('TEAM  1 2 3 4 5 6 7 8 9  R  ·  B ●● S ●● O ●●', '#1e4a32', '#f0f0e0', 20) }), bx, 3.4, bz + .08, g, { cast: false }); addCol(bx - 1.7, bx + 1.7, bz - .1, bz + .1); }
      shed(g, cx - 1.0, z0 + 1.6, 3.0, 2.0, '볼펜 · 장비 보관소');
      // 그라운드 정비 카트 (롤러) · 남측 현판 벽
      { const rx = cx + 2.4, rz = z0 + 2.0; pcyl(.4, .4, 1.0, PM(0x2a6a3a, .5, .4), rx, .4, rz, g, { rz: Math.PI / 2 }); pbox(.8, .5, .6, PM(0x2a6a3a, .5, .4), rx, .9, rz + .6, g); addCol(rx - .55, rx + .55, rz - .45, rz + .95); }
      pbox(3.2, 1.6, .4, stoneM, cx - 9.0, .8, z1 + .4, g); addCol(cx - 10.6, cx - 7.4, z1 + .2, z1 + .6);
      pmesh(new THREE.PlaneGeometry(3.0, 1.1), new THREE.MeshBasicMaterial({ map: makeSign('서문고등학교 야구 스타디움', '#6a6a60', '#1a1a1a', 26) }), cx - 9.0, .9, z1 + .61, g, { cast: false }); }
    chunks.push({ id: 'chunk_sports', g, x: cx, z: cz });
  }

  /* =========================================================================
     ⑥ [학생문화 섹션] 학생회관 · 동아리연합회관 (소극장 · 합주실 · 라운지) — 서남 (x: -88, z: 50)
     ========================================================================= */
  {
    const cx = -88, cz = 42, W = 22, D = 14, H = 9.0;
    const g = new THREE.Group(); g.name = 'chunk_union'; g.userData.dynamic = true; OUT.add(g);
    buildShell(g, cx, cz, W, D, H, stoneM, darkMetal, 'E', woodFloor);
    pbox(1.8, .24, 4.6, darkMetal, cx + W / 2 + 1.1, 3.1, cz, g);
    pbox(.12, .64, 4.6, darkMetal, cx + W / 2 + 2.02, 3.45, cz, g, { cast: false });
    pmesh(new THREE.PlaneGeometry(4.4, .54), new THREE.MeshBasicMaterial({ map: makeSign('학생회관 · 동아리연합회 (소극장 · 라운지)', '#281e32', '#f4e8d8', 22) }), cx + W / 2 + 2.09, 3.45, cz, g, { ry: Math.PI / 2, cast: false });
    // 1층 리모델링 (참고 평면도 · 22.0 × 14.0m): 동측 정문 → 로비 (안내 데스크 · 2층 계단) / 서북 학생회실 · 서남 학생식당 / 동북 동아리실 1 (합주) · 동남 매점
    const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2, xB = x0 + 9, zL0 = cz - 2.5, zL1 = cz + 2.5;
    iwall(g, xB, z0, xB, z1, [[cz - 2.4, cz - 1.4], [cz + .2, cz + 1.4]]); iwall(g, x0, cz - 1.2, xB, cz - 1.2);
    iwall(g, xB, zL0, x1, zL0, [[x1 - 5.0, x1 - 3.8]]); iwall(g, xB, zL1, x1, zL1, [[x1 - 5.0, x1 - 3.8]]);
    // 로비: 안내 데스크 · 2층 계단 (남측 벽을 따라) · 화분
    pbox(.7, 1.0, 1.8, woodLight, x1 - 2.2, .5, cz - 1.3, g); addCol(x1 - 2.55, x1 - 1.85, cz - 2.2, cz - .4, false, 1.0); monitor(g, x1 - 2.2, 1.0, cz - 1.6, Math.PI / 2);
    for (let k = 0; k < 10; k++) pbox(.32, .18, 1.2, stoneM, x1 - 6.0 - k * .32, .09 + k * .18, zL1 - .7, g); addCol(x1 - 9.3, x1 - 5.8, zL1 - 1.3, zL1 - .1);
    // 학생식당 (서남, 약 63m²): 식당 테이블 (1800×750) 2열 × 3줄 + 의자 · 배식대
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) { const x = x0 + 3.0 + r * 2.4, z = cz + 1.2 + c * 2.6; deskT(g, x, z, .75, 1.8, .74); [-.55, .55].forEach(d => { addChair(g, x - .6, z + d, Math.PI / 2); addChair(g, x + .6, z + d, -Math.PI / 2); }); }
    pbox(.7, .9, 4.0, chromeM, x0 + .4, .45, cz + 3.8, g); addCol(x0, x0 + .75, cz + 1.8, cz + 5.8, false, .9);
    // 학생회실 (서북): 회의 테이블 (2400×1200) + 의자 · 사무용 책상 · 책장 · 이동식 화이트보드 · 개인 사물함 (보관함 파밍)
    deskT(g, x0 + 5.0, z0 + 2.6, 2.4, 1.2); [-.8, 0, .8].forEach(d => { addChair(g, x0 + 5.0 + d, z0 + 1.7, 0, blueFabric); addChair(g, x0 + 5.0 + d, z0 + 3.5, Math.PI, blueFabric); });
    pbox(.9, 1.8, .3, woodLight, xB - .6, .9, z0 + .2, g); addCol(xB - 1.05, xB - .15, z0, z0 + .35);
    let unionLockerDoorPiv = null;
    for (let k = 0; k < 4; k++) { const lz = z0 + 3.0 + k * .74; pbox(.45, 1.8, .7, PM(0x7a8086, .5, .4), x0 + .3, .9, lz, g);
      if (k === 1) { const piv = new THREE.Group(); piv.userData.dynamic = true; piv.position.set(x0 + .55, .9, lz - .35); g.add(piv); pbox(.035, 1.76, .68, PM(0x88909a, .45, .5), .015, 0, .34, piv); pbox(.04, .18, .04, goldM, .04, .1, .55, piv); unionLockerDoorPiv = piv; } }
    addCol(x0, x0 + .55, z0 + 2.6, z0 + 5.6);
    world.props.push({ kind: 'robj', k: 'union_locker', t: 'mega15k', floor: 0, x: x0 + 1.4, z: z0 + 4.1, y: 1.1, r: 2.2, label: '동아리연합회 보관함 파밍하기', anim: { type: 'hinge', doorPiv: unionLockerDoorPiv, openAngle: 1.6, t: 0, active: false } });
    // 동아리실 1 (동북, 합주): 드럼 세트 · 앰프 · 음향 콘솔 · 포스터
    { const dx = x1 - 2.6, dz = z0 + 1.6; [[0, 0, .3], [.5, .3, .2], [-.5, .3, .2]].forEach(([a, b, r]) => pcyl(r, r, .3, redFabric, dx + a, .4 + b * .3, dz + b, g)); pcyl(.4, .4, .5, whiteWall, dx, .25, dz - .5, g); addCol(dx - .8, dx + .8, dz - .9, dz + .6); }
    [x1 - 5.0, x1 - 4.3].forEach(x => pbox(.6, .7, .4, PM(0x1a1a1c, .6), x, .35, z0 + .3, g)); addCol(x1 - 5.35, x1 - 3.95, z0, z0 + .55);
    pbox(1.2, .88, 2.0, darkMetal, xB + 1.4, .44, z0 + 2.2, g); addCol(xB + .8, xB + 2.0, z0 + 1.2, z0 + 3.2);
    world.props.push({ kind: 'robj', k: 'union_console', t: 'mega15k', floor: 0, x: xB + 2.6, z: z0 + 2.2, y: 1.0, r: 2.2, label: '학생회관 소극장 음향 콘솔 복구하기' });
    pmesh(new THREE.PlaneGeometry(3.0, .9), new THREE.MeshBasicMaterial({ map: makeSign('제32회 해교제 · 밴드부 · 연극부 · 합창부', '#2c1418', '#f6e4c0', 18) }), cx + 1.5, 2.2, z0 + .02, g, { cast: false });
    // 매점 (동남): 매점 진열대 (900×450×1800) · 계산대 + 계산기 · 음료 냉장고
    for (let k = 0; k < 4; k++) { const x = xB + 1.0 + k * 1.0; pbox(.9, 1.8, .45, woodLight, x, .9, z1 - .25, g); for (let r = 0; r < 4; r++) pbox(.8, .25, .35, [redFabric, blueFabric, goldM, PM(0x3a8a48, .6)][(k + r) % 4], x, .3 + r * .42, z1 - .27, g, { cast: false }); } addCol(xB + .55, xB + 4.45, z1 - .5, z1);
    pbox(1.6, 1.0, .6, woodLight, x1 - 3.0, .5, zL1 + 1.4, g); addCol(x1 - 3.8, x1 - 2.2, zL1 + 1.1, zL1 + 1.7, false, 1.0); pbox(.3, .15, .25, darkMetal, x1 - 3.2, 1.07, zL1 + 1.4, g, { cast: false });
    pbox(.7, 1.9, .7, PM(0xd8dce0, .3, .4), x1 - .4, .95, z1 - .4, g); pbox(.01, 1.5, .55, glassM, x1 - .76, 1.1, z1 - .4, g, { cast: false }); addCol(x1 - .75, x1, z1 - .75, z1);
    chunks.push({ id: 'chunk_union', g, x: cx, z: cz });
  }

  /* =========================================================================
     ⑦ [주차·교통 섹션] 서남 제2대형주차장 (스쿨버스 · 체육부 구단버스 전용 주차장 & 승강장, x: -96 ~ -54, z: 61 ~ 69)
     ========================================================================= */
  {
    const g = new THREE.Group(); g.name = 'chunk_parking2'; g.userData.dynamic = true; OUT.add(g);
    // 제2주차장 리모델링 (참고 단독 설계안 · 44.0 × 7.7m 노천 아스팔트): 북측 한 열 평행주차 6면 (5500×2500) + 여유 구획 (7000×2500) · 단방향 통행로 5.2m (서측 진입 → 동측 출차) · 진입 차단기 · 차량 스토퍼 · 조명등주 (H4000) · 주차 표지판 (600×900)
    const px0 = -98.0, px1 = -54.0, pz0 = 61.45, pz1 = 69.15, pzR = pz0 + 2.5;
    pbox(px1 - px0, .02, pz1 - pz0, PM(0x2e3034, .9), (px0 + px1) / 2, .01, (pz0 + pz1) / 2, g, { cast: false });
    pbox(px1 - px0, .025, .1, whiteWall, (px0 + px1) / 2, .016, pzR, g, { cast: false });
    for (let k = 0; k <= 6; k++) { const x = px0 + 1.5 + k * 5.5; pbox(.1, .025, 2.5, whiteWall, x, .016, pz0 + 1.25, g, { cast: false }); }
    pmesh(new THREE.PlaneGeometry(2.4, .5), new THREE.MeshBasicMaterial({ map: makeSign('보조 주차구역', '#2e3034', '#e8e8e0', 22) }), px1 - 4.75, .02, pz0 + 1.25, g, { rx: -Math.PI / 2, cast: false });
    [px0 + 10, px0 + 22, px0 + 34].forEach(x => { pbox(2.6, .02, .14, PM(0xe8d8a0, .6), x, .02, pzR + 2.8, g, { cast: false }); pmesh(new THREE.ConeGeometry(.3, .6, 3), PM(0xe8d8a0, .6), x + 1.5, .03, pzR + 2.8, g, { rx: -Math.PI / 2, rz: -Math.PI / 2, cast: false }); });
    // 주차 차량 5대 (2008년식 세단 · 해치백)
    const carC = [0xd8dce0, 0x2a4a5a, 0xf0ece0, 0x9aa4ac, 0x50565c];
    for (let k = 0; k < 6; k++) { if (k === 3) continue; const x = px0 + 4.25 + k * 5.5, z = pz0 + 1.25, cM = PM(carC[k % 5], .35, .55);
      pbox(4.3, .7, 1.75, cM, x, .55, z, g); pbox(2.3, .55, 1.6, cM, x - .2, 1.15, z, g); pbox(2.2, .45, 1.62, new THREE.MeshStandardMaterial({ color: 0x1a2028, roughness: .1, metalness: .4 }), x - .2, 1.15, z, g, { cast: false });
      [[-1.4, -.8], [1.4, -.8], [-1.4, .8], [1.4, .8]].forEach(([a, b]) => pcyl(.32, .32, .22, PM(0x1a1a1a, .8), x + a, .32, z + b, g, { rx: Math.PI / 2 })); addCol(x - 2.15, x + 2.15, z - .9, z + .9); }
    // 차량 스토퍼 (1800×150×120) · 진입 차단기 (서측) · 조명등주 · 주차 표지판
    for (let k = 0; k < 6; k++) pbox(1.8, .12, .15, PM(0xd8b020, .6), px0 + 4.25 + k * 5.5, .06, pz0 + .25, g, { cast: false });
    { const bx = px0 + 1.0, bz = pzR + .6; pbox(.35, 1.1, .35, PM(0xd8b020, .5, .3), bx, .55, bz, g); addCol(bx - .2, bx + .2, bz - .2, bz + .2); const arm = new THREE.Group(); arm.position.set(bx, 1.0, bz); arm.rotation.z = 1.2; g.add(arm);
      for (let k = 0; k < 8; k++) pbox(.5, .08, .06, k % 2 ? PM(0xd82020, .6) : whiteWall, .25 + k * .5, 0, 0, arm, { cast: false }); }
    [px0 + 8, px0 + 22, px0 + 36].forEach(x => { pcyl(.06, .08, 4.0, PM(0x8a9094, .45, .6), x, 2.0, pz0 + .1, g); pbox(.5, .15, .3, lampEm, x, 4.0, pz0 + .35, g, { cast: false }); });
    pcyl(.04, .04, 2.2, darkMetal, px0 + .4, 1.1, pz1 - .4, g); pbox(.6, .9, .04, PM(0x1e4a9a, .5, .3), px0 + .4, 2.2, pz1 - .4, g);
    pmesh(new THREE.PlaneGeometry(.56, .86), new THREE.MeshBasicMaterial({ map: makeSign('P 제2주차장 · 서측 진입 → 동측 출차', '#1e4a9a', '#ffffff', 20) }), px0 + .4, 2.2, pz1 - .37, g, { cast: false });
  }

  // ── 4대 확장 건물 정문에 실제로 여닫을 수 있는 양개 강화유리 출입문(world.doorList 연동) 설치 ──
  [
    { name: '청운학사 정문', x: -75.0, z: -42.0, ry: Math.PI / 2, open: 1 },
    { name: '과학천문관 정문', x: 74.0, z: -34.0, ry: -Math.PI / 2, open: 1 },
    { name: '중앙학술정보관 정문', x: 73.0, z: 39.0, ry: -Math.PI / 2, open: 1 },
    { name: '학생회관 정문', x: -77.0, z: 42.0, ry: Math.PI / 2, open: 1 },
  ].forEach(dSpec => {
    const dGrp = new THREE.Group(); dGrp.position.set(dSpec.x, 0, dSpec.z); dGrp.rotation.y = dSpec.ry; dGrp.userData.dynamic = true; OUT.add(dGrp);
    const leaves = [[-1.35, -1], [1.35, 1]].map(([hx, s]) => {
      const piv = new THREE.Group(); piv.position.set(hx, 0, 0); piv.userData.dynamic = true; dGrp.add(piv);
      const lx = -s * .66;
      pbox(1.32, 2.38, .04, glassM, lx, 1.19, 0, piv, { cast: false });
      pbox(1.32, .10, .06, darkMetal, lx, 2.33, 0, piv);
      pbox(1.32, .14, .06, darkMetal, lx, .07, 0, piv);
      pbox(.08, 2.38, .06, darkMetal, lx - s * .62, 1.19, 0, piv);
      pbox(.08, 2.38, .06, darkMetal, lx + s * .62, 1.19, 0, piv);
      pbox(.98, .045, .09, chromeM, lx, 1.05, .04, piv);
      pbox(.04, .32, .10, chromeM, lx + s * .42, 1.18, -.04, piv);
      piv.rotation.y = dSpec.open ? s * 1.35 : 0;
      return { piv, a: s * 1.35 };
    });
    const rect = { x1: dSpec.x - .2, x2: dSpec.x + .2, z1: dSpec.z - 1.35, z2: dSpec.z + 1.35, off: !!dSpec.open };
    F0.col.push(rect); (F0.doorWalls ||= []).push(rect);
    world.doorList.push({ kind: 'hinge', floor: 0, x: dSpec.x, z: dSpec.z, open: dSpec.open, target: dSpec.open, leaves, rect, name: dSpec.name });
  });

  // ── Google Flow & Meta AI 극사실적 시트지 기반 16종 .glb 3D 모델 (네트워크 캐시 디듀플리케이션 + 거리 기반 AnimationMixer 컬링 적용!) ──
  {
    const loader = new GLTFLoader();
    const glbCache = (window.__glbCache ||= new Map());
    const mixers = [];
    window.__campusAnimMixers = mixers;

    const loadCachedGlb = url => {
      const fullUrl = url + '?v=139';
      let p = glbCache.get(fullUrl);
      if (!p) {
        p = new Promise(resolve => {
          loader.load(fullUrl, gltf => resolve(gltf), undefined, () => resolve(null));
        });
        glbCache.set(fullUrl, p);
      }
      return p;
    };

    // 순수 3D Blender 멀티-PBR 다각형 모델용 고해상도 절차적 PBR 재질 텍스처(나뭇결·가죽결·금속헤어라인·석재·벽돌·패브릭 직조 + 범프맵) 및 Box-Projection UV 생성기!
    const pbrMatCache = new Map();
    const getBlenderPbrMaterial = origMat => {
      if (!origMat || origMat.map) return origMat;
      const key = origMat.name || origMat.uuid;
      if (pbrMatCache.has(key)) return pbrMatCache.get(key);
      const nm = origMat.name || '';
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const ctx = c.getContext('2d');
      const baseHex = origMat.color ? '#' + origMat.color.getHexString() : '#555555';
      ctx.fillStyle = baseHex; ctx.fillRect(0, 0, 256, 256);
      let seed = 1337; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      if (/Walnut|Oak|Wood/i.test(nm)) {
        // 리얼 원목 나뭇결 섬유 & 옹이 패턴
        for (let y = 0; y < 256; y += 2) {
          ctx.fillStyle = y % 4 === 0 ? 'rgba(18,10,4,0.22)' : 'rgba(255,220,180,0.07)';
          ctx.fillRect(0, y, 256, 1 + (rnd() * 2 | 0));
        }
        for (let i = 0; i < 180; i++) {
          ctx.fillStyle = rnd() < .5 ? 'rgba(12,6,2,0.25)' : 'rgba(210,165,110,0.10)';
          ctx.fillRect(rnd() * 256, rnd() * 256, 24 + rnd() * 64, 1.5);
        }
      } else if (/Leather/i.test(nm)) {
        // 빈티지 가죽 엠보싱 주름 & 그레인
        for (let i = 0; i < 900; i++) {
          const x = rnd() * 256, y = rnd() * 256;
          ctx.fillStyle = i % 2 ? 'rgba(10,5,2,0.24)' : 'rgba(255,215,180,0.08)';
          ctx.fillRect(x, y, 3, 3);
        }
      } else if (/Plaid|Fabric|Mattress/i.test(nm)) {
        // 패브릭 직조 위빙 & 체크무늬 패턴
        if (/Plaid/i.test(nm)) {
          ctx.fillStyle = 'rgba(185,45,38,0.28)';
          for (let k = 0; k < 256; k += 32) { ctx.fillRect(k, 0, 10, 256); ctx.fillRect(0, k, 256, 10); }
          ctx.fillStyle = 'rgba(240,215,140,0.22)';
          for (let k = 14; k < 256; k += 32) { ctx.fillRect(k, 0, 3, 256); ctx.fillRect(0, k, 256, 3); }
        }
        for (let y = 0; y < 256; y += 3) for (let x = 0; x < 256; x += 3) {
          ctx.fillStyle = ((x + y) % 6 === 0) ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.06)';
          ctx.fillRect(x, y, 2, 2);
        }
      } else if (/Brick/i.test(nm)) {
        // 붉은 벽돌 & 시멘트 줄눈
        ctx.fillStyle = 'rgba(165,158,142,0.55)';
        for (let r = 0; r < 8; r++) {
          const y = r * 32; ctx.fillRect(0, y, 256, 3);
          for (let c2 = 0; c2 < 4; c2++) ctx.fillRect(((c2 * 64 + (r % 2) * 32) % 256), y, 3, 32);
        }
      } else {
        // 브러시드 메탈 / 녹슨 스틸 / 화강암 스페클 마이크로 그레인
        for (let i = 0; i < 700; i++) {
          ctx.fillStyle = i % 3 === 0 ? 'rgba(18,14,10,0.26)' : (i % 3 === 1 ? 'rgba(95,48,24,0.16)' : 'rgba(255,250,240,0.09)');
          ctx.fillRect(rnd() * 256, rnd() * 256, 2 + rnd() * 10, 1 + rnd() * 4);
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = origMat.clone();
      mat.color.setHex(0xffffff);
      mat.map = tex;
      mat.bumpMap = tex;
      mat.bumpScale = 0.025;
      mat.needsUpdate = true;
      pbrMatCache.set(key, mat);
      return mat;
    };
    const ensureBoxUV = geo => {
      if (!geo || geo.attributes.uv) return;
      const p = geo.attributes.position, n = geo.attributes.normal;
      if (!p || !n) return;
      const uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
        if (ny >= nx && ny >= nz) { uv[i * 2] = x * 1.4; uv[i * 2 + 1] = z * 1.4; }
        else if (nx >= nz) { uv[i * 2] = z * 1.4; uv[i * 2 + 1] = y * 1.4; }
        else { uv[i * 2] = x * 1.4; uv[i * 2 + 1] = y * 1.4; }
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    };
    window.__upgradePure3DScene = root => {
      root.traverse(o => {
        o.userData.dynamic = true;
        if (o.isMesh) {
          o.castShadow = false;
          o.receiveShadow = true;
          ensureBoxUV(o.geometry);
          if (o.material?.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
          else if (o.material) o.material = getBlenderPbrMaterial(o.material);
        }
      });
    };
    const placeGlb = (url, placements) => {
      loadCachedGlb(url).then(gltf => {
        if (!gltf) return;
        window.__upgradePure3DScene(gltf.scene);
        placements.forEach(([px, py, pz, ry = 0, sx = 1, sy = 1, sz = 1]) => {
          const m = gltf.scene.clone(true);
          m.position.set(px, py, pz); m.rotation.y = ry; m.scale.set(sx, sy, sz);
          m.traverse(o => { o.userData.dynamic = true; });
          OUT.add(m);
          if (gltf.animations && gltf.animations.length) {
            const mx = new THREE.AnimationMixer(m);
            mx.userData = { x: px, z: pz };
            gltf.animations.forEach(clip => mx.clipAction(clip).play());
            mixers.push(mx);
          }
        });
      });
    };

    // 1) 1998 구관 학우매점(x=63.5, z=18.0, 9.2m×6.4m) CAD 단면도 기반 실내외 .glb 5종 정밀 배치

    // 2) 야구 스타디움 외야(x=-88, z=4.5) 전광판 .glb
    placeGlb('assets/models/sf/sf_baseball_scoreboard.glb', [[-88.0, 0, 1.5, 0, 1.15, 1.15, 1.15]]);

    // 3) 4대 확장 건물 정문 양개 강화유리문 시스템 .glb
    placeGlb('assets/models/sf/sf_campus_glass_door.glb', [
      [-74.95, 0, -42.0, Math.PI / 2, 1, 1, 1],
      [ 73.95, 0, -34.0, -Math.PI / 2, 1, 1, 1],
      [ 72.95, 0,  39.0, -Math.PI / 2, 1, 1, 1],
      [-76.95, 0,  42.0, Math.PI / 2, 1, 1, 1]
    ]);

    // 4) 주차 차단기 · 회전 기상레이더 · 회전 플라네타리움 · 발광 자판기 · 진자 괘종시계 · 버스정류장 · 소화전/게시판
    placeGlb('assets/models/sf/sf_anim_parking_gate.glb', [
      [15.2, 0, 58.2, 0, 1, 1, 1],
      [-55.5, 0, 61.2, Math.PI, 1, 1, 1]
    ]);
    placeGlb('assets/models/sf/sf_anim_weather_radar.glb', [
      [54.5, 0, -48.5, 0, 1, 1, 1],
      [84.0, 9.2, -39.0, 0, 1.2, 1.2, 1.2]
    ]);
    placeGlb('assets/models/sf/sf_anim_orrery_planetarium.glb', [
      [84.0, 0, -34.0, 0, 1, 1, 1]
    ]);
    placeGlb('assets/models/sf/sf_anim_vending_arcade.glb', [
      [58.0, 0, 20.8, 0, 1, 1, 1],
      [-74.2, 0, -36.5, Math.PI / 2, 1, 1, 1],
      [-76.2, 0, 36.5, Math.PI / 2, 1, 1, 1]
    ]);
    placeGlb('assets/models/sf/sf_anim_trophy_clock.glb', [
      [75.2, 0, 31.2, 0, 1, 1, 1],
      [-76.5, 0, -47.8, 0, 1, 1, 1],
      [-79.2, 0, 36.2, 0, 1, 1, 1]
    ]);
    placeGlb('assets/models/sf/sf_bus_stop_shelter.glb', [
      [-58.0, 0, 62.2, 0, 1, 1, 1],
      [-53.5, 0, 18.0, Math.PI / 2, 1, 1, 1]
    ]); addCol(-59.42, -56.15, 61.48, 62.88); addCol(-54.22, -52.82, 16.15, 19.42);   // 정류장 쉘터 통과 방지
    placeGlb('assets/models/sf/sf_horror_fire_bulletin.glb', [
      [-80.0, 0, -48.6, 0, 1, 1, 1],
      [80.0, 0, -41.6, 0, 1, 1, 1],
      [80.0, 0, 30.4, 0, 1, 1, 1],
      [-82.0, 0, 35.4, 0, 1, 1, 1]
    ]);

    // 5) [신규 극사실적 파손 가구·사물·콘크리트 블록 잔해·노후 외관 설비 .glb 4종] 캠퍼스 및 건물 빈 공간 적재적소 배치!
    // ① 부러진 책걸상 바리케이드 (보행로 및 별관 뒤쪽 통로를 절대 침범하지 않는 외곽 구석에만 배치!)
    placeGlb('assets/models/sf/sf_broken_desk_barricade.glb', [
      [-92.0, 0, -36.5, 0.5, 1, 1, 1],
      [-92.5, 0,  49.5, -0.4, 1, 1, 1],
      [ 97.5, 0,  50.5, 0.3, 1, 1, 1]   // 도서관 벽 속 → 바깥 구석
    ]);
    // ② 찌그러진 3연동 철제 사물함 & 추락한 칠판 (sf_dented_locker_set.glb)
    placeGlb('assets/models/sf/sf_dented_locker_set.glb', [
      [-78.5, 0, -48.5, 0, 1, 1, 1],   // 계단 밑 → 1층 북벽 동쪽
      [-89.0, 0,  35.5, 0, 1, 1, 1],
      [ 89.0, 0, -41.5, 0, 1, 1, 1]
    ]);
    // ③ 깨진 콘크리트 블록 및 적벽돌 파편 더미 (보행로 및 별관 주변 침범 0건!)
    placeGlb('assets/models/sf/sf_rubble_concrete_blocks.glb', [
      [-48.5, 0,  26.5, 0.8, 1, 1, 1],
      [-74.0, 0, -49.5, 1.7, 1, 1, 1],
      [ 73.5, 0,  48.5, 0.9, 1, 1, 1]
    ]);
    // ④ 노후 외벽 2단 에어컨 실외기 & 통풍 루버 (sf_weathered_ac_louver.glb)
    // ⑤ 청운학사 기숙사 Pro 3D 디자인팀 마스터 에셋 6종 (4K PBR 건축 쉘 + 원통 파이프 2층침대 4기 + 정독실 카렐 부스 4기 + 가죽 퀼팅 소파 2조 + 사감실 4채널 CCTV 관제석 + 공중전화/신발장)
    placeGlb('assets/models/sf/sf_pro_dorm_arch_trim.glb', [
      [-86.0, 0, -42.0, 0, 1, 1, 1]
    ]);
    placeGlb('assets/models/sf/sf_pro_dorm_warden_desk.glb', [
      [-79.8, 0.07, -37.2, Math.PI, 1, 1, 1]
    ]);
    placeGlb('assets/models/sf/sf_pro_dorm_lounge_set.glb', [
      [-89.5, 0.07, -40.6, 0, 1, 1, 1],
      [-89.5, 0.07, -37.8, Math.PI, 1, 1, 1]
    ]);
    placeGlb('assets/models/sf/sf_pro_dorm_bunkbed.glb', [
      [-94.2, 3.87, -45.2, 0, 1, 1, 1],
      [-94.2, 3.87, -41.4, 0, 1, 1, 1],
      [-94.2, 3.87, -38.8, 0, 1, 1, 1],
      [-94.2, 3.87, -36.4, 0, 1, 1, 1]
    ]);
    placeGlb('assets/models/sf/sf_pro_dorm_study_carrel.glb', [
      [-82.4, 3.87, -36.8, Math.PI, 1, 1, 1],
      [-81.1, 3.87, -36.8, Math.PI, 1, 1, 1],
      [-79.8, 3.87, -36.8, Math.PI, 1, 1, 1],
      [-78.5, 3.87, -36.8, Math.PI, 1, 1, 1]
    ]);
    placeGlb('assets/models/sf/sf_dorm_2f_interior_pack.glb', [
      [-76.8, 0.07, -45.2, -Math.PI / 2, 1, 1, 1],
      [-80.5, 3.87, -48.4, 0, 1, 1, 1]
    ]);
    placeGlb('assets/models/sf/sf_weathered_ac_louver.glb', [
      [ 68.3, 0,  16.8, Math.PI / 2, 1, 1, 1],
      [-36.5, 0,  -4.5, -Math.PI / 2, 1, 1, 1],
      [ 36.5, 0,  -4.5, Math.PI / 2, 1, 1, 1],
      [-74.1, 0, -46.5, Math.PI / 2, 1, 1, 1],
      [ 73.8, 0, -38.5, -Math.PI / 2, 1, 1, 1],
      [ 72.8, 0,  44.5, -Math.PI / 2, 1, 1, 1]
    ]);

    // 거리 기반 AnimationMixer 업데이트 (플레이어가 야외에 있고 45m 이내인 모델만 매 프레임 업데이트하여 CPU 부하 80% 절감!)
    let lastAnimT = performance.now();
    const tickCampusAnims = now => {
      const dt = Math.min(.066, (now - lastAnimT) / 1000); lastAnimT = now;
      const g = window.__g;
      const pf = g?.P?.floor ?? 0, px = g?.P?.x ?? 0, pz = g?.P?.z ?? 0;
      for (let i = 0; i < mixers.length; i++) {
        const mx = mixers[i], u = mx.userData;
        const mf = u?.floor ?? 0;
        if (pf === mf && (!u || Math.hypot(u.x - px, u.z - pz) < 48)) mx.update(dt);
      }
      requestAnimationFrame(tickCampusAnims);
    };
    requestAnimationFrame(tickCampusAnims);
  }

  return chunks;
}
