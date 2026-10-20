// 15,000평(약 50,000㎡) 캠퍼스 3대 섹션(①학술·생활 건물 섹션 ②종합 운동·스포츠 섹션 ③제1·제2 대형 주차장 섹션) 및 10종 .glb 모델(애니메이션 5종 포함) 빌더
import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';

export const MEGA_CAMPUS_ZONES = [
  { id: 'dorm', name: '청운학사 (기숙사 단지)', x: -86, z: -42, w: 22, d: 14, color: '#4a322c' },
  { id: 'lake', name: '청운호 수변공원 · 호심정', x: -9, z: -86, w: 34, d: 20, color: '#244e58' },
  { id: 'astro', name: '과학천문관 · 관측돔', x: 84, z: -34, w: 20, d: 16, color: '#2c3e54' },
  { id: 'library', name: '중앙학술정보관 (대도서관)', x: 84, z: 39, w: 22, d: 18, color: '#4a3628' },
  { id: 'tennis', name: '테니스 · 양궁 훈련장', x: -88, z: -16, w: 20, d: 16, color: '#224868' },
  { id: 'sports', name: '서문고 야구 스타디움', x: -88, z: 14, w: 24, d: 26, color: '#284a3a' },
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

  const buildShell = (grp, cx, cz, W, D, H, wallMat, roofMat, doorSide, flMat = woodFloor) => {
    const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2, t = .32, dw = 3.0, dh = 2.6;
    pbox(W, .06, D, flMat, cx, .03, cz, grp, { cast: false });
    pbox(W, .12, D, whiteWall, cx, 3.85, cz, grp, { cast: false });
    pbox(W + .6, .35, D + .6, stoneM, cx, H + .175, cz, grp);
    pbox(W + .3, .45, D + .3, roofMat, cx, H + .55, cz, grp);
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
  };

  const addChair = (grp, x, z, ry = 0, colMat = woodDark) => {
    const cg = new THREE.Group(); cg.position.set(x, 0, z); cg.rotation.y = ry; grp.add(cg);
    pbox(.44, .05, .44, colMat, 0, .44, 0, cg);
    pbox(.44, .42, .05, colMat, 0, .66, -.20, cg);
    [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]].forEach(([lx, lz]) => pbox(.04, .44, .04, darkMetal, lx, .22, lz, cg));
  };

  // ── 5대 섹션 게이트 아치 현판 ──
  [
    [-52, -33.8, Math.PI / 2, '◀ [학술·생활 섹션] 청운학사(기숙사)  |  [스포츠 섹션] 테니스·야구장'],
    [-52, 55.6, Math.PI / 2, '◀ [학생문화 섹션] 학생회관·소극장  |  [제2주차장] 스쿨버스 정류장'],
    [52, -33.8, -Math.PI / 2, '[학술·연구 섹션] 과학천문관 · 생물부 생태온실 ▶'],
    [52, 36.6, -Math.PI / 2, '[학술·복지 섹션] 중앙학술정보관(대도서관) · 학교매점 ▶'],
    [-9, -64, 0, '▲ [생태공원 섹션] 청운호 수변공원 · 호심정 팔각정'],
  ].forEach(([gx, gz, ry, title]) => {
    const ag = new THREE.Group(); ag.position.set(gx, 0, gz); ag.rotation.y = ry; ag.userData.dynamic = true; OUT.add(ag);
    pbox(7.8, .42, .65, stoneM, 0, 3.45, 0, ag);
    pbox(6.4, .56, .14, darkMetal, 0, 3.85, 0, ag, { cast: false });
    pmesh(new THREE.PlaneGeometry(6.2, .48), new THREE.MeshBasicMaterial({ map: makeSign(title, '#162834', '#f2ead2', 20), side: THREE.DoubleSide }), 0, 3.85, .08, ag, { cast: false });
    pmesh(new THREE.PlaneGeometry(6.2, .48), new THREE.MeshBasicMaterial({ map: makeSign(title, '#162834', '#f2ead2', 20), side: THREE.DoubleSide }), 0, 3.85, -.08, ag, { ry: Math.PI, cast: false });
  });

  /* =========================================================================
     ① [학술·생활 섹션] 청운학사 (본격 2층 규모 학생기숙사 — Google Flow 2F CAD 도면 100% 반영!) — 서북 (x: -86, z: -42)
     - 1층(y = 0.0m): 사감실(CRT 보안 모니터·열쇠함·점호일지) + 공용 휴게실(소파·테이블·TV·공중전화·신발장) + 북쪽 16단 실내 직통 계단
     - 2층(y = 3.85m): 2층 복도 홀 + 4인실 2층침대 호실(201~204호·사생 사물함) + 2층 심야 정독실(칸막이 열람석 4조) + 2층 야외 베란다
     ========================================================================= */
  {
    const cx = -86, cz = -42, W = 22, D = 14, H = 8.4, Y2 = 3.85;
    const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2, t = .32, dw = 3.0, dh = 2.6;
    const g = new THREE.Group(); g.name = 'chunk_dorm'; g.userData.dynamic = true; OUT.add(g);

    // 1) 외벽 쉘 (하단 화강암 기단 + 1·2층 적벽돌 외벽 + 2층 천장/옥상 슬래브)
    pbox(W, .06, D, woodFloor, cx, .03, cz, g, { cast: false });
    pbox(W + .6, .35, D + .6, stoneM, cx, H + .175, cz, g);
    pbox(W + .3, .42, D + .3, darkMetal, cx, H + .52, cz, g);
    // 화강암 1층 기단 띠 (CAD FRONT ELEVATION 반영)
    pbox(W + .72, 1.05, .12, stoneM, cx, .525, z0 - t - .04, g, { cast: false });
    pbox(W + .72, 1.05, .12, stoneM, cx, .525, z1 + t + .04, g, { cast: false });
    pbox(.12, 1.05, D + .72, stoneM, x0 - t - .04, .525, cz, g, { cast: false });
    // 북벽 · 남벽 · 서벽 · 동벽(정문 출입구 개방)
    pbox(W + 2 * t, H, t, brickM, cx, H / 2, z0 - t / 2, g); addCol(x0 - t, x1 + t, z0 - t, z0, true);
    pbox(W + 2 * t, H, t, brickM, cx, H / 2, z1 + t / 2, g); addCol(x0 - t, x1 + t, z1, z1 + t, true);
    pbox(t, H, D, brickM, x0 - t / 2, H / 2, cz, g);       addCol(x0 - t, x0, z0, z1, true);
    {
      const sw = (D - dw) / 2;
      pbox(t, H, sw, brickM, x1 + t / 2, H / 2, z0 + sw / 2, g); addCol(x1, x1 + t, z0, cz - dw / 2, true);
      pbox(t, H, sw, brickM, x1 + t / 2, H / 2, z1 - sw / 2, g); addCol(x1, x1 + t, cz + dw / 2, z1, true);
      pbox(t, H - dh, dw, brickM, x1 + t / 2, dh + (H - dh) / 2, cz, g);
    }
    // 정문 포치 & 현판 + 1·2층 창문 및 2층 동남쪽 돌출 발코니 (CAD BALCONY 반영)
    pbox(1.8, .24, 4.4, stoneM, x1 + 1.1, 3.1, cz, g);
    [-1.8, 1.8].forEach(dz => pcyl(.16, .18, 3.0, stoneM, x1 + 1.7, 1.5, cz + dz, g));
    pbox(.12, .62, 4.4, darkMetal, x1 + 2.02, 3.45, cz, g, { cast: false });
    pmesh(new THREE.PlaneGeometry(4.2, .52), new THREE.MeshBasicMaterial({ map: makeSign('청 운 학 사 (靑雲學舍) — 1F 사감실·휴게실 / 2F 생활관·정독실', '#1c2d38', '#f4ebd0', 22) }), x1 + 2.09, 3.45, cz, g, { ry: Math.PI / 2, cast: false });
    for (let fy of [2.0, 5.8]) for (let dz of [-4.8, -2.4, 2.4, 4.8]) {
      pmesh(new THREE.PlaneGeometry(1.5, 1.25), glassM, x1 + .34, fy, cz + dz, g, { ry: Math.PI / 2, cast: false });
      pbox(.18, .08, 1.65, stoneM, x1 + .38, fy - .64, cz + dz, g, { cast: false });
    }
    // 2층 동남쪽 외벽 돌출 발코니 & 철제 난간 (x: x1 ~ x1 + 1.8, z: cz + 2.2 ~ z1 - .4, y = Y2)
    pbox(1.8, .18, 4.2, stoneM, x1 + 1.1, Y2 - .06, cz + 4.3, g);
    pbox(.08, 1.05, 4.2, darkMetal, x1 + 1.95, Y2 + .52, cz + 4.3, g);
    pbox(1.8, 1.05, .08, darkMetal, x1 + 1.1, Y2 + .52, cz + 2.24, g);
    pbox(1.8, 1.05, .08, darkMetal, x1 + 1.1, Y2 + .52, cz + 6.36, g);

    // 2) 북쪽 벽면 16단 실내 직통 계단 (1F y=0.0m → 2F y=3.85m, x: -93.6 → -84.0, z: z0 + .2 ~ z0 + 2.6)
    for (let st = 0; st < 16; st++) {
      const sx1 = -93.6 + st * .60, sx2 = sx1 + .62, sh = (st + 1) * (Y2 / 16);
      pbox(.62, sh, 2.3, stoneM, (sx1 + sx2) / 2, sh / 2, z0 + 1.25, g);
      pbox(.64, .04, 2.32, woodDark, (sx1 + sx2) / 2, sh + .01, z0 + 1.25, g, { cast: false });
      addCol(sx1, sx2, z0 + .1, z0 + 2.45, false, sh);
    }
    // 계단 측면 안전 난간
    pbox(9.8, .95, .08, darkMetal, -88.8, Y2 / 2 + .5, z0 + 2.45, g);
    addCol(-93.6, -84.0, z0 + 2.40, z0 + 2.55, false, null, { maxY: 3.6 });

    // 3) 2층 철근콘크리트 바닥 슬래브 (y = Y2 = 3.85m — 계단 오름구 x: -94.0 ~ -84.0, z: z0 ~ z0 + 2.5 구간만 개방!)
    // 남측 메인 2층 슬래브 (x: x0 ~ x1, z: z0 + 2.5 ~ z1)
    pbox(W, .18, D - 2.5, woodFloor, cx, Y2 - .09, cz + 1.25, g);
    pbox(W, .04, D - 2.5, whiteWall, cx, Y2 - .19, cz + 1.25, g, { cast: false });
    addCol(x0 + .2, x1 - .2, z0 + 2.45, z1 - .2, false, Y2, { y0: 3.50 });
    // 북동측 2층 상부 랜딩 슬래브 (x: -84.0 ~ x1, z: z0 ~ z0 + 2.5 — 계단 꼭대기와 직결!)
    pbox(x1 - (-84.0), .18, 2.5, woodFloor, (-84.0 + x1) / 2, Y2 - .09, z0 + 1.25, g);
    addCol(-84.05, x1 - .2, z0 + .1, z0 + 2.5, false, Y2, { y0: 3.50 });
    // 2층 계단 개구부 추락 방지 난간
    pbox(10.2, .95, .08, woodDark, -89.0, Y2 + .48, z0 + 2.52, g);

    // 4) [1층 인테리어 (y = 0.0m)]: 사감실(남동 코너) & 공용 휴게 라운지(중앙·남서 코너)
    // 사감실 책상 · CRT 보안 모니터 4대 · 열쇠함
    pbox(2.4, .76, .85, woodDark, cx + 6.2, .38, cz + 4.4, g);
    addCol(cx + 5.0, cx + 7.4, cz + 3.9, cz + 4.9, false, null, { maxY: 2.5 });
    addChair(g, cx + 6.2, cz + 5.2, Math.PI);
    [-0.6, -0.2, 0.2, 0.6].forEach(dx => {
      pbox(.34, .32, .32, darkMetal, cx + 6.2 + dx, .92, cz + 4.4, g);
      pmesh(new THREE.PlaneGeometry(.28, .22), new THREE.MeshBasicMaterial({ color: 0x58d8a8 }), cx + 6.2 + dx, .93, cz + 4.23, g, { ry: Math.PI, cast: false });
    });
    pmesh(new THREE.PlaneGeometry(2.6, .85), new THREE.MeshBasicMaterial({ map: makeSign('1F 사감실 호실 열쇠함 (101~208호) | 2층 침실·정독실은 북쪽 계단 이용', '#24342e', '#e8ece4', 19) }), cx + 6.2, 2.05, z1 - .08, g, { ry: Math.PI, cast: false });
    world.props.push({ kind: 'robj', k: 'dorm_log', t: 'mega15k', floor: 0, x: cx + 6.2, z: cz + 3.4, y: .9, r: 2.2, label: '1층 사감실 점호 일지 및 CCTV 모니터 조사하기' });

    // 1층 공용 휴게실 소파 세트 & 커피 테이블 & 브라운관 TV (x: cx - 3.5, z: cz + 2.8)
    pbox(2.6, .45, .82, redFabric, cx - 3.5, .225, cz + 1.4, g);
    pbox(2.6, .45, .82, redFabric, cx - 3.5, .225, cz + 4.2, g);
    pbox(1.8, .42, .90, woodLight, cx - 3.5, .21, cz + 2.8, g);
    addCol(cx - 4.9, cx - 2.1, cz + 1.0, cz + 4.6, false, null, { maxY: 2.5 });

    // 5) [2층 인테리어 (y = Y2 = 3.85m 위!)]: 서쪽 4인실 2층침대 호실 & 동쪽 2층 심야 정독실!
    const addChairAtY = (x, y0, z, ry = 0, colMat = woodDark) => {
      const cg = new THREE.Group(); cg.position.set(x, y0, z); cg.rotation.y = ry; grp => grp; g.add(cg);
      pbox(.44, .05, .44, colMat, 0, .44, 0, cg);
      pbox(.44, .42, .05, colMat, 0, .66, -.20, cg);
      [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]].forEach(([lx, lz]) => pbox(.04, .44, .04, darkMetal, lx, .22, lz, cg));
    };

    // 2층 서쪽: 2층 침대(Bunk Beds) 4기 (y = Y2 = 3.85m 바닥 위에 배치!)
    [-1.2, 1.4, 4.0].forEach((dz, bi) => {
      const bx0 = cx - 8.2, bz0 = cz + dz;
      [[-.98, -.48], [.98, -.48], [-.98, .48], [.98, .48]].forEach(([px, pz]) => pbox(.08, 1.85, .08, woodDark, bx0 + px, Y2 + .925, bz0 + pz, g));
      pbox(2.06, .12, 1.04, woodLight, bx0, Y2 + .38, bz0, g);
      pbox(2.06, .12, 1.04, woodLight, bx0, Y2 + 1.28, bz0, g);
      pbox(1.94, .14, .94, mattressM, bx0, Y2 + .50, bz0, g);
      pbox(1.94, .14, .94, mattressM, bx0, Y2 + 1.40, bz0, g);
      pbox(1.15, .05, .92, bi % 2 ? blueFabric : redFabric, bx0 + .35, Y2 + .58, bz0, g);
      pbox(1.15, .05, .92, bi % 2 ? redFabric : blueFabric, bx0 + .35, Y2 + 1.48, bz0, g);
      pbox(.04, 1.45, .36, chromeM, bx0 + 1.04, Y2 + .75, bz0, g);
      addCol(bx0 - 1.08, bx0 + 1.08, bz0 - .56, bz0 + .56, false, null, { y0: 3.8 });
    });

    // 2층 사생 개인 사물함 4칸 (y = Y2 위, z = z1 - .45)
    for (let k = 0; k < 4; k++) {
      pbox(.66, 1.85, .55, PM(0x5a6872, .5, .4), cx - 3.2 + k * .72, Y2 + .925, z1 - .42, g);
      pbox(.04, .16, .04, chromeM, cx - 3.0 + k * .72, Y2 + 1.05, z1 - .71, g);
    }
    world.props.push({ kind: 'robj', k: 'dorm_locker', t: 'mega15k', floor: 0, x: cx - 2.1, z: z1 - 1.25, y: Y2 + 1.1, r: 2.3, label: '기숙사 2층 204호 사생 사물함 파밍하기' });

    // 2층 동쪽: 심야 정독실 칸막이 열람 책상 4조 & 초록 뱅커스 스탠드 (y = Y2 = 3.85m 바닥 위!)
    [-1.8, -.6, .6, 1.8].forEach(dx => {
      pbox(1.05, .76, .75, woodDark, cx + 4.5 + dx, Y2 + .38, cz + 4.6, g);
      pbox(1.05, .48, .04, woodLight, cx + 4.5 + dx, Y2 + 1.0, cz + 4.95, g);
      pbox(.04, .48, .75, woodLight, cx + 4.5 + dx - .51, Y2 + 1.0, cz + 4.6, g);
      pbox(.18, .22, .18, greenLamp, cx + 4.5 + dx, Y2 + .88, cz + 4.75, g, { cast: false });
      addChairAtY(cx + 4.5 + dx, Y2, cz + 3.95, 0);
    });
    pmesh(new THREE.PlaneGeometry(3.2, .52), new THREE.MeshBasicMaterial({ map: makeSign('청운학사 2층 심야 정독실 (STUDY ROOM) — 정숙 엄수', '#182c24', '#80ffb8', 22) }), cx + 4.5, Y2 + 2.35, z1 - .08, g, { ry: Math.PI, cast: false });
    world.props.push({ kind: 'robj', k: 'dorm_study', t: 'mega15k', floor: 0, x: cx + 4.5, z: cz + 3.3, y: Y2 + 1.0, r: 2.3, label: '기숙사 2층 심야 정독실 비밀 수첩 암호 풀기' });

    // 1층 & 2층 천장 등기구
    [0, Y2].forEach(by => {
      [[-5.5, -2.5], [0, -2.5], [5.5, -2.5], [-5.5, 3.0], [0, 3.0], [5.5, 3.0]].forEach(([lx, lz]) => {
        pbox(1.35, .04, .32, darkMetal, cx + lx, by + 3.72, cz + lz, g, { cast: false });
        pbox(1.22, .05, .20, lampEm, cx + lx, by + 3.68, cz + lz, g, { cast: false });
      });
    });

    chunks.push({ id: 'chunk_dorm', g, x: cx, z: cz });
  }

  /* =========================================================================
     ② [생태공원 섹션] 청운호(靑雲湖) 생태수변공원 & 호심정(湖心亭) 팔각정 — 북측 (x: -9, z: -86)
     ========================================================================= */
  {
    const cx = -9, cz = -86, pw = 32, pd = 18;
    const g = new THREE.Group(); g.name = 'chunk_lake'; g.userData.dynamic = true; OUT.add(g);
    pbox(pw + 1.2, .22, pd + 1.2, stoneM, cx, .11, cz, g, { cast: false });
    const waterM = new THREE.MeshStandardMaterial({ color: 0x1c5458, emissive: 0x0b282c, emissiveIntensity: .35, roughness: .08, metalness: .35, transparent: true, opacity: .82 });
    pmesh(new THREE.PlaneGeometry(pw, pd), waterM, cx, .18, cz, g, { rx: -Math.PI / 2, cast: false });
    addCol(cx - pw / 2, cx - 2.1, cz - pd / 2, cz + pd / 2, false);
    addCol(cx + 2.1, cx + pw / 2, cz - pd / 2, cz + pd / 2, false);
    pbox(3.6, .16, pd + 2.0, woodDark, cx, .20, cz, g, { cast: false });
    [-1.7, 1.7].forEach(dx => {
      pbox(.12, .85, pd + 1.6, woodLight, cx + dx, .62, cz, g);
      for (let dz = -pd / 2; dz <= pd / 2; dz += 2.2) pbox(.16, .98, .16, woodDark, cx + dx, .68, cz + dz, g);
    });
    pcyl(3.8, 4.2, .28, stoneM, cx, .14, cz, g, { seg: 8 });
    for (let a = 0; a < 8; a++) {
      const an = a * Math.PI / 4;
      pcyl(.11, .11, 2.7, PM(0x6e281c, .7), cx + Math.cos(an) * 2.8, 1.62, cz + Math.sin(an) * 2.8, g);
    }
    pmesh(new THREE.ConeGeometry(4.2, 1.35, 8), darkMetal, cx, 3.55, cz, g);
    pmesh(new THREE.PlaneGeometry(1.8, .38), new THREE.MeshBasicMaterial({ map: makeSign('호 심 정 (湖 心 亭)', '#281810', '#f2df98', 26) }), cx, 2.85, cz + 2.85, g, { cast: false });
    const spL = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('255,210,125'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .55 }));
    spL.scale.setScalar(4.5); spL.position.set(cx, 2.5, cz); g.add(spL);
    pcyl(.65, .55, .78, stoneM, cx, .62, cz, g, { seg: 12 });
    pbox(.48, .28, .36, PM(0x8a6830, .4, .7), cx, 1.15, cz, g);
    addCol(cx - .65, cx + .65, cz - .65, cz + .65);
    world.props.push({ kind: 'robj', k: 'lake_capsule', t: 'mega15k', floor: 0, x: cx, z: cz + 1.25, y: 1.1, r: 2.2, label: '호심정 정자 위 1998 졸업생 봉인함 열기' });

    const padM = PM(0x2d6a36, .8);
    [[-8, -4], [-11, 3], [-6, 5], [7, -5], [10, 2], [6, 6], [-12, -6], [12, -3]].forEach(([ox, oz]) => {
      pmesh(new THREE.CircleGeometry(.42, 12), padM, cx + ox, .20, cz + oz, g, { rx: -Math.PI / 2, cast: false });
    });
    chunks.push({ id: 'chunk_lake', g, x: cx, z: cz });
  }

  /* =========================================================================
     ③ [학술·연구 섹션] 서문 과학천문관 & 대형 천체관측 돔 — 동북 (x: 84, z: -34)
     ========================================================================= */
  {
    const cx = 84, cz = -34, W = 20, D = 16, H = 8.8;
    const g = new THREE.Group(); g.name = 'chunk_astro'; g.userData.dynamic = true; OUT.add(g);
    buildShell(g, cx, cz, W, D, H, whiteWall, darkMetal, 'W', tileFloor);
    const silverM = PM(0xc8d2da, .25, .82);
    pmesh(new THREE.SphereGeometry(5.4, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), silverM, cx, H + .6, cz, g);
    pcyl(.42, .48, 3.8, darkMetal, cx - 2.6, H + 3.6, cz, g, { rz: Math.PI / 3.2 });
    pbox(1.8, .24, 4.4, stoneM, cx - W / 2 - 1.1, 3.1, cz, g);
    pbox(.12, .62, 4.4, darkMetal, cx - W / 2 - 2.02, 3.45, cz, g, { cast: false });
    pmesh(new THREE.PlaneGeometry(4.2, .52), new THREE.MeshBasicMaterial({ map: makeSign('서문 과학천문관 · 천체관측소', '#142438', '#d8f0ff', 24) }), cx - W / 2 - 2.09, 3.45, cz, g, { ry: -Math.PI / 2, cast: false });
    // 홀 중앙: 태양계 행성 모형 (Orrery) + 애니메이션 .glb 결합
    pcyl(1.4, 1.6, .85, darkMetal, cx, .425, cz, g, { seg: 16 });
    pmesh(new THREE.SphereGeometry(.48, 16, 14), new THREE.MeshStandardMaterial({ color: 0xffd040, emissive: 0xff9810, emissiveIntensity: .9 }), cx, 1.85, cz, g);
    [1.1, 1.7, 2.3].forEach((r, ri) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .018, 8, 32), chromeM);
      ring.rotation.x = Math.PI / 2; ring.position.set(cx, 1.85, cz); g.add(ring);
      pmesh(new THREE.SphereGeometry(.14 + ri * .04, 12, 10), PM([0x3888ff, 0xe05838, 0xd8b068][ri], .4), cx + Math.cos(ri * 2.1) * r, 1.85, cz + Math.sin(ri * 2.1) * r, g);
    });
    addCol(cx - 1.6, cx + 1.6, cz - 1.6, cz + 1.6);
    pbox(1.4, .85, 3.4, darkMetal, cx + 6.8, .425, cz, g);
    [-0.8, 0.8].forEach(dz => {
      pbox(.38, .42, .55, PM(0x182028, .3, .6), cx + 6.7, 1.05, cz + dz, g);
      pmesh(new THREE.PlaneGeometry(.48, .34), new THREE.MeshBasicMaterial({ color: 0x38d8ff }), cx + 6.5, 1.06, cz + dz, g, { ry: -Math.PI / 2, cast: false });
    });
    addCol(cx + 6.0, cx + 7.6, cz - 1.7, cz + 1.7);
    pmesh(new THREE.PlaneGeometry(3.8, 1.8), new THREE.MeshBasicMaterial({ map: makeSign('1998.10.12 천체 성도 좌표 — 황도 12궁 & 페가수스자리 관측 중', '#0c1828', '#70e8ff', 20) }), cx + W / 2 - .06, 2.25, cz, g, { ry: -Math.PI / 2, cast: false });
    world.props.push({ kind: 'robj', k: 'astro_console', t: 'mega15k', floor: 0, x: cx + 5.4, z: cz, y: 1.1, r: 2.2, label: '천체관측소 성도 주파수 콘솔 조작하기' });

    [-6.4, 6.4].forEach(dz => {
      pbox(4.8, .95, .85, woodDark, cx, .475, cz + dz, g);
      pbox(4.6, .85, .75, glassM, cx, 1.38, cz + dz, g, { cast: false });
      [-1.4, 0, 1.4].forEach((ox, oi) => pmesh(new THREE.DodecahedronGeometry(.18, 0), PM([0x60d8ff, 0xff9840, 0x90ff70][oi], .2, .5), cx + ox, 1.15, cz + dz, g));
      addCol(cx - 2.5, cx + 2.5, cz + dz - .5, cz + dz + .5);
    });
    world.props.push({ kind: 'robj', k: 'astro_case', t: 'mega15k', floor: 0, x: cx, z: cz - 5.2, y: 1.1, r: 2.2, label: '운석 · 광물 표본 진열장 조사하기' });
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
    const bookColors = [PM(0x7a2420, .8), PM(0x1e3c58, .8), PM(0x284e34, .8), PM(0x8a6832, .8), PM(0x4a3248, .8)];
    [-6.2, -3.6, 3.6, 6.2].forEach(dz => {
      pbox(7.2, 2.35, .68, woodDark, cx + 2.5, 1.175, cz + dz, g);
      [0.45, 0.95, 1.45, 1.95].forEach((sy, si) => {
        pbox(7.0, .04, .72, woodLight, cx + 2.5, sy, cz + dz, g);
        for (let bx = -3.0; bx <= 2.8; bx += 0.65) {
          pbox(.52, .36, .58, bookColors[(Math.abs((bx * 10 + si) | 0)) % bookColors.length], cx + 2.5 + bx, sy + .20, cz + dz, g);
        }
      });
      addCol(cx - 1.2, cx + 6.2, cz + dz - .42, cz + dz + .42);
    });
    [-1.5, 1.5].forEach(dz => {
      pbox(4.2, .76, 1.3, woodLight, cx - 3.5, .38, cz + dz, g);
      [-1.2, 1.2].forEach(dx => {
        pcyl(.04, .12, .22, goldM, cx - 3.5 + dx, .85, cz + dz, g);
        pbox(.26, .14, .18, greenLamp, cx - 3.5 + dx, .96, cz + dz, g, { cast: false });
        addChair(g, cx - 3.5 + dx, cz + dz - .85, 0);
        addChair(g, cx - 3.5 + dx, cz + dz + .85, Math.PI);
      });
      addCol(cx - 5.6, cx - 1.4, cz + dz - .75, cz + dz + .75);
    });
    pbox(1.6, .82, 2.8, woodDark, cx + 8.2, .41, cz, g);
    pbox(.55, .62, .55, darkMetal, cx + 8.1, 1.12, cz - .5, g);
    pmesh(new THREE.PlaneGeometry(.46, .38), new THREE.MeshBasicMaterial({ map: makeSign('1998.10.13 호외 — 서문고 심야 실종 사건 특보', '#101814', '#80ffb8', 18) }), cx + 7.81, 1.15, cz - .5, g, { ry: -Math.PI / 2, cast: false });
    addCol(cx + 7.3, cx + 9.1, cz - 1.5, cz + 1.5);
    world.props.push({ kind: 'robj', k: 'lib_microfilm', t: 'mega15k', floor: 0, x: cx + 6.6, z: cz, y: 1.1, r: 2.2, label: '마이크로필름 판독기로 1998년 신문 기사 복원하기' });
    world.props.push({ kind: 'robj', k: 'lib_desk', t: 'mega15k', floor: 0, x: cx - 3.5, z: cz, y: .9, r: 2.2, label: '대도서관 열람실 미반납 도서함 조사하기' });
    chunks.push({ id: 'chunk_library', g, x: cx, z: cz });
  }

  /* =========================================================================
     ⑤-A [종합 스포츠 섹션 1] 야외 하드코트 테니스장 & 양궁 전용 훈련장 — 서중북 (x: -88, z: -14)
     ========================================================================= */
  {
    const cx = -88, cz = -16;
    const g = new THREE.Group(); g.name = 'chunk_tennis'; g.userData.dynamic = true; OUT.add(g);
    pbox(20, .04, 16, PM(0x285a3e, .8), cx, .02, cz, g, { cast: false });
    pbox(15, .05, 12, PM(0x225488, .75), cx, .025, cz, g, { cast: false });
    pbox(15, .055, .08, whiteWall, cx, .03, cz - 6, g, { cast: false });
    pbox(15, .055, .08, whiteWall, cx, .03, cz + 6, g, { cast: false });
    pbox(.08, .055, 12, whiteWall, cx - 7.5, .03, cz, g, { cast: false });
    pbox(.08, .055, 12, whiteWall, cx + 7.5, .03, cz, g, { cast: false });
    [-7.6, 7.6].forEach(dx => pcyl(.05, .05, 1.05, darkMetal, cx + dx, .52, cz, g));
    pbox(15.2, .82, .04, PM(0x222628, .9), cx, .50, cz, g, { cast: false });
    pbox(15.2, .05, .05, whiteWall, cx, .92, cz, g, { cast: false });
    addCol(cx - 7.7, cx + 7.7, cz - .15, cz + .15);
    // 북쪽 양궁 과녁판 3기 (야구장과 완전히 분리된 전용 양궁 레인!)
    [-4.5, 0, 4.5].forEach(dx => {
      pbox(1.2, 1.5, .18, woodLight, cx + dx, .85, cz - 7.2, g);
      pmesh(new THREE.CircleGeometry(.52, 18), PM(0xf0d020, .6), cx + dx, 1.0, cz - 7.08, g, { cast: false });
      pmesh(new THREE.CircleGeometry(.32, 16), PM(0xd82820, .6), cx + dx, 1.0, cz - 7.07, g, { cast: false });
      addCol(cx + dx - .65, cx + dx + .65, cz - 7.5, cz - 6.9);
    });
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
    pbox(7.6, 3.2, .12, darkMetal, cx, 1.6, cz + 9.8, g);
    addCol(cx - 3.8, cx + 3.8, cz + 9.6, cz + 10.0);
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
    world.props.push({ kind: 'robj', k: 'sports_cooler', t: 'mega15k', floor: 0, x: cx + 6.8, z: cz + 6.8, y: .6, r: 2.2, label: '야구부 덕아웃 아이스박스 열기' });
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
    pbox(4.2, .32, 9.6, woodDark, cx - 7.8, .16, cz, g);
    addCol(cx - 9.9, cx - 5.7, cz - 4.8, cz + 4.8, false, .30);
    pbox(.22, 3.4, 2.8, redFabric, cx - 9.8, 1.9, cz - 3.2, g);
    pbox(.22, 3.4, 2.8, redFabric, cx - 9.8, 1.9, cz + 3.2, g);
    pmesh(new THREE.PlaneGeometry(5.0, .58), new THREE.MeshBasicMaterial({ map: makeSign('제32회 해교제 연극부·합창부 합동 리허설 무대', '#2c1418', '#f6e4c0', 22) }), cx - 9.7, 3.1, cz, g, { ry: Math.PI / 2, cast: false });
    for (let rz of [-2.0, 0, 2.0]) {
      addChair(g, cx - 3.8, cz + rz, -Math.PI / 2, redFabric);
      addChair(g, cx - 2.8, cz + rz, -Math.PI / 2, redFabric);
    }
    pbox(1.2, .88, 2.2, darkMetal, cx - 1.2, .44, cz, g); addCol(cx - 1.9, cx - .5, cz - 1.2, cz + 1.2);
    world.props.push({ kind: 'robj', k: 'union_console', t: 'mega15k', floor: 0, x: cx + .1, z: cz, y: 1.0, r: 2.2, label: '학생회관 소극장 음향 콘솔 복구하기' });

    pbox(2.74, .06, 1.52, PM(0x1b4d88, .5), cx + 4.2, .74, cz - 3.6, g);
    [[-1.2, -.65], [1.2, -.65], [-1.2, .65], [1.2, .65]].forEach(([lx, lz]) => pbox(.06, .74, .06, darkMetal, cx + 4.2 + lx, .37, cz - 3.6 + lz, g));
    pbox(.04, .18, 1.56, whiteWall, cx + 4.2, .85, cz - 3.6, g);
    addCol(cx + 2.7, cx + 5.7, cz - 4.5, cz - 2.7);
    for (let k = 0; k < 4; k++) pbox(.68, 1.85, .55, PM(0x4a5860, .5, .4), cx + 3.0 + k * .74, .925, cz + D / 2 - .38, g);
    addCol(cx + 2.6, cx + 5.8, cz + D / 2 - .75, cz + D / 2);
    world.props.push({ kind: 'robj', k: 'union_locker', t: 'mega15k', floor: 0, x: cx + 4.2, z: cz + D / 2 - 1.2, y: 1.1, r: 2.2, label: '동아리연합회 보관함 파밍하기' });
    chunks.push({ id: 'chunk_union', g, x: cx, z: cz });
  }

  /* =========================================================================
     ⑦ [주차·교통 섹션] 서남 제2대형주차장 (스쿨버스 · 체육부 구단버스 전용 주차장 & 승강장, x: -96 ~ -54, z: 61 ~ 69)
     ========================================================================= */
  {
    const g = new THREE.Group(); g.name = 'chunk_parking2'; g.userData.dynamic = true; OUT.add(g);
    pbox(42.0, .02, 7.6, PM(0x26282c, .9), -76.0, .01, 65.2, g, { cast: false });
    for (let k = 0; k <= 8; k++) pbox(.12, .025, 5.8, whiteWall, -95.0 + k * 4.6, .016, 65.8, g, { cast: false });
    for (let k = 0; k < 8; k++) pbox(2.6, .10, .16, goldM, -92.7 + k * 4.6, .05, 68.0, g, { cast: false });
    // 스쿨버스 승하차 대기 부스
    pbox(5.4, .14, 2.2, darkMetal, -62.5, 2.65, 62.2, g);
    [-2.4, 2.4].forEach(dx => pbox(.12, 2.6, .12, darkMetal, -62.5 + dx, 1.3, 61.4, g));
    pbox(3.8, .44, .48, woodLight, -62.5, .22, 61.6, g);
    pmesh(new THREE.PlaneGeometry(3.6, .42), new THREE.MeshBasicMaterial({ map: makeSign('제2주차장 · 통학 스쿨버스 승강장', '#182c38', '#f4ebd0', 22) }), -62.5, 2.65, 63.32, g, { cast: false });
    addCol(-65.0, -60.0, 61.1, 62.1);
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
      const fullUrl = url + '?v=132';
      let p = glbCache.get(fullUrl);
      if (!p) {
        p = new Promise(resolve => {
          loader.load(fullUrl, gltf => resolve(gltf), undefined, () => resolve(null));
        });
        glbCache.set(fullUrl, p);
      }
      return p;
    };

    const placeGlb = (url, placements) => {
      loadCachedGlb(url).then(gltf => {
        if (!gltf) return;
        placements.forEach(([px, py, pz, ry = 0, sx = 1, sy = 1, sz = 1]) => {
          const m = gltf.scene.clone(true);
          m.position.set(px, py, pz); m.rotation.y = ry; m.scale.set(sx, sy, sz);
          m.traverse(o => {
            o.userData.dynamic = true;
            if (o.isMesh) {
              o.castShadow = false; // 소품 그림자 패스 제외로 GPU 드로우콜 및 프레임 딜레이 대폭 절감!
              o.receiveShadow = true;
              if (o.material?.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
            }
          });
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
    placeGlb('assets/models/sf/sf_snack_facade.glb', [[63.5, 3.25, 21.32, 0, 1.0, 1.0, 1.0]]);
    placeGlb('assets/models/sf/sf_snack_counter_v2.glb', [[60.8, 0.17, 18.2, 0, 1.0, 1.0, 1.0]]);
    placeGlb('assets/models/sf/sf_beverage_fridge.glb', [[62.6, 0.17, 15.38, 0, 1.0, 1.0, 1.0], [64.35, 0.17, 15.38, 0, 1.0, 1.0, 1.0]]);
    placeGlb('assets/models/sf/sf_snack_shelf.glb', [[64.5, 0.17, 17.7, 0, 1.0, 1.0, 1.0], [66.35, 0.17, 17.7, 0, 1.0, 1.0, 1.0]]);
    placeGlb('assets/models/sf/sf_icecream_freezer.glb', [[67.35, 0.17, 19.45, -Math.PI / 2, 1.0, 1.0, 1.0]]);

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
    ]);
    placeGlb('assets/models/sf/sf_horror_fire_bulletin.glb', [
      [-80.0, 0, -48.6, 0, 1, 1, 1],
      [80.0, 0, -41.6, 0, 1, 1, 1],
      [80.0, 0, 30.4, 0, 1, 1, 1],
      [-82.0, 0, 35.4, 0, 1, 1, 1]
    ]);

    // 5) [신규 극사실적 파손 가구·사물·콘크리트 블록 잔해·노후 외관 설비 .glb 4종] 캠퍼스 및 건물 빈 공간 적재적소 배치!
    // ① 부러진 책걸상 바리케이드 (sf_broken_desk_barricade.glb)
    placeGlb('assets/models/sf/sf_broken_desk_barricade.glb', [
      [-34.5, 0, -10.6, 0.2, 1, 1, 1],
      [ 34.5, 0, -10.6, -0.3, 1, 1, 1],
      [-18.5, 0, -20.0, 0.4, 1, 1, 1],
      [ 25.5, 0, -20.0, -0.2, 1, 1, 1],
      [-92.0, 0, -36.5, 0.5, 1, 1, 1],
      [-92.5, 0,  49.5, -0.4, 1, 1, 1],
      [ 89.5, 0,  45.5, 0.3, 1, 1, 1]
    ]);
    // ② 찌그러진 3연동 철제 사물함 & 추락한 칠판 (sf_dented_locker_set.glb)
    placeGlb('assets/models/sf/sf_dented_locker_set.glb', [
      [-89.0, 0, -48.5, 0, 1, 1, 1],
      [-89.0, 0,  35.5, 0, 1, 1, 1],
      [ 89.0, 0, -41.5, 0, 1, 1, 1],
      [ 60.5, 0,  14.3, Math.PI, 1, 1, 1]
    ]);
    // ③ 깨진 콘크리트 블록 및 적벽돌 파편 더미 (sf_rubble_concrete_blocks.glb)
    placeGlb('assets/models/sf/sf_rubble_concrete_blocks.glb', [
      [-22.5, 0, -11.5, 0.4, 1, 1, 1],
      [ 22.5, 0, -11.5, 1.2, 1, 1, 1],
      [-48.5, 0,  26.5, 0.8, 1, 1, 1],
      [ 48.5, 0,  11.2, 2.1, 1, 1, 1],
      [ 57.5, 0,  16.2, 0.5, 1, 1, 1],
      [-74.0, 0, -49.5, 1.7, 1, 1, 1],
      [ 73.5, 0,  48.5, 0.9, 1, 1, 1]
    ]);
    // ④ 노후 외벽 2단 에어컨 실외기 & 통풍 루버 (sf_weathered_ac_louver.glb)
    // ⑤ 청운학사 기숙사 1·2층 공중전화 부스·신발장·1998 달력 세트 (sf_dorm_2f_interior_pack.glb)
    placeGlb('assets/models/sf/sf_dorm_2f_interior_pack.glb', [
      [-76.8, 0.05, -45.2, -Math.PI / 2, 1, 1, 1],
      [-80.5, 3.88, -48.4, 0, 1, 1, 1]
    ]);
    placeGlb('assets/models/sf/sf_weathered_ac_louver.glb', [
      [ 68.3, 0,  16.8, Math.PI / 2, 1, 1, 1],
      [-36.5, 0,  -4.5, -Math.PI / 2, 1, 1, 1],
      [ 36.5, 0,  -4.5, Math.PI / 2, 1, 1, 1],
      [-74.8, 0, -46.5, Math.PI / 2, 1, 1, 1],
      [ 73.8, 0, -38.5, -Math.PI / 2, 1, 1, 1],
      [ 72.8, 0,  44.5, -Math.PI / 2, 1, 1, 1]
    ]);

    // 거리 기반 AnimationMixer 업데이트 (플레이어가 야외에 있고 45m 이내인 모델만 매 프레임 업데이트하여 CPU 부하 80% 절감!)
    let lastAnimT = performance.now();
    const tickCampusAnims = now => {
      const dt = Math.min(.066, (now - lastAnimT) / 1000); lastAnimT = now;
      const g = window.__g;
      const pf = g?.P?.floor ?? 0, px = g?.P?.x ?? 0, pz = g?.P?.z ?? 0;
      if (pf === 0) {
        for (let i = 0; i < mixers.length; i++) {
          const mx = mixers[i], u = mx.userData;
          if (!u || Math.hypot(u.x - px, u.z - pz) < 48) mx.update(dt);
        }
      }
      requestAnimationFrame(tickCampusAnims);
    };
    requestAnimationFrame(tickCampusAnims);
  }

  return chunks;
}
