// 15,000평(약 50,000㎡: 240m × 210m) 대규모 캠퍼스 확장 모듈 (v114: 통문 직결 정렬 & 고밀도 실내 가구·소품·재질 디테일)
import * as THREE from './vendor/three.module.js';

export const MEGA_CAMPUS_ZONES = [
  { id: 'dorm', name: '청운학사 (기숙사)', x: -88, z: -32, w: 22, d: 14, color: '#4a322c' },
  { id: 'lake', name: '청운호 수변공원 · 호심정', x: -9, z: -86, w: 34, d: 20, color: '#244e58' },
  { id: 'astro', name: '과학천문관 · 관측돔', x: 84, z: -32, w: 20, d: 16, color: '#2c3e54' },
  { id: 'library', name: '중앙학술정보관 (대도서관)', x: 84, z: 39, w: 22, d: 18, color: '#4a3628' },
  { id: 'sports', name: '스포츠단지 (테니스·양궁장)', x: -88, z: 8, w: 22, d: 26, color: '#284a3a' },
  { id: 'union', name: '학생회관 · 동아리관', x: -88, z: 56, w: 22, d: 16, color: '#48382e' },
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

  const addCol = (x1, x2, z1, z2, isWall = true, h = null) => {
    const r = { x1: Math.min(x1, x2), x2: Math.max(x1, x2), z1: Math.min(z1, z2), z2: Math.max(z1, z2) };
    if (h != null) r.h = h;
    F0.col.push(r);
    if (isWall && h == null) F0.walls.push(r);
  };

  // 실내외 벽체 셸 + 실내 투톤 웨인스코팅 허리벽 몰딩 + 걸레받이 + 창문 + 천장 등기구 생성기
  const buildShell = (grp, cx, cz, W, D, H, wallMat, roofMat, doorSide, flMat = woodFloor) => {
    const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2, t = .32, dw = 3.0, dh = 2.6;
    pbox(W, .06, D, flMat, cx, .03, cz, grp, { cast: false });
    pbox(W, .12, D, whiteWall, cx, 3.85, cz, grp, { cast: false });
    pbox(W + .6, .35, D + .6, stoneM, cx, H + .175, cz, grp);
    pbox(W + .3, .45, D + .3, roofMat, cx, H + .55, cz, grp);
    // 실내 웨인스코팅 허리벽 몰딩 (높이 1.1m)
    pbox(W - .1, 1.1, .06, wainscotM, cx, .55, z0 + .04, grp, { cast: false });
    if (doorSide !== 'S') pbox(W - .1, 1.1, .06, wainscotM, cx, .55, z1 - .04, grp, { cast: false });
    if (doorSide !== 'W') pbox(.06, 1.1, D - .1, wainscotM, x0 + .04, .55, cz, grp, { cast: false });
    if (doorSide !== 'E') pbox(.06, 1.1, D - .1, wainscotM, x1 - .04, .55, cz, grp, { cast: false });
    // 북벽
    pbox(W + 2 * t, H, t, wallMat, cx, H / 2, z0 - t / 2, grp); addCol(x0 - t, x1 + t, z0 - t, z0, true);
    // 남벽
    if (doorSide === 'S') {
      const sw = (W - dw) / 2;
      pbox(sw, H, t, wallMat, x0 + sw / 2, H / 2, z1 + t / 2, grp); addCol(x0, cx - dw / 2, z1, z1 + t, true);
      pbox(sw, H, t, wallMat, x1 - sw / 2, H / 2, z1 + t / 2, grp); addCol(cx + dw / 2, x1, z1, z1 + t, true);
      pbox(dw, H - dh, t, wallMat, cx, dh + (H - dh) / 2, z1 + t / 2, grp);
    } else {
      pbox(W + 2 * t, H, t, wallMat, cx, H / 2, z1 + t / 2, grp); addCol(x0 - t, x1 + t, z1, z1 + t, true);
    }
    // 서벽
    if (doorSide === 'W') {
      const sw = (D - dw) / 2;
      pbox(t, H, sw, wallMat, x0 - t / 2, H / 2, z0 + sw / 2, grp); addCol(x0 - t, x0, z0, cz - dw / 2, true);
      pbox(t, H, sw, wallMat, x0 - t / 2, H / 2, z1 - sw / 2, grp); addCol(x0 - t, x0, cz + dw / 2, z1, true);
      pbox(t, H - dh, dw, wallMat, x0 - t / 2, dh + (H - dh) / 2, cz, grp);
    } else {
      pbox(t, H, D, wallMat, x0 - t / 2, H / 2, cz, grp); addCol(x0 - t, x0, z0, z1, true);
    }
    // 동벽
    if (doorSide === 'E') {
      const sw = (D - dw) / 2;
      pbox(t, H, sw, wallMat, x1 + t / 2, H / 2, z0 + sw / 2, grp); addCol(x1, x1 + t, z0, cz - dw / 2, true);
      pbox(t, H, sw, wallMat, x1 + t / 2, H / 2, z1 - sw / 2, grp); addCol(x1, x1 + t, cz + dw / 2, z1, true);
      pbox(t, H - dh, dw, wallMat, x1 + t / 2, dh + (H - dh) / 2, cz, grp);
    } else {
      pbox(t, H, D, wallMat, x1 + t / 2, H / 2, cz, grp); addCol(x1, x1 + t, z0, z1, true);
    }
    // 실내 천장 형광등 하우징 & 발광 튜브 6기
    [[-W * .28, -D * .26], [0, -D * .26], [W * .28, -D * .26], [-W * .28, D * .26], [0, D * .26], [W * .28, D * .26]].forEach(([lx, lz]) => {
      pbox(1.35, .04, .32, darkMetal, cx + lx, 3.78, cz + lz, grp, { cast: false });
      pbox(1.22, .05, .20, lampEm, cx + lx, 3.74, cz + lz, grp, { cast: false });
    });
  };

  // 의자 생성 헬퍼
  const addChair = (grp, x, z, ry = 0, colMat = woodDark) => {
    const cg = new THREE.Group(); cg.position.set(x, 0, z); cg.rotation.y = ry; grp.add(cg);
    pbox(.44, .05, .44, colMat, 0, .44, 0, cg);
    pbox(.44, .42, .05, colMat, 0, .66, -.20, cg);
    [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]].forEach(([lx, lz]) => pbox(.04, .44, .04, darkMetal, lx, .22, lz, cg));
  };

  // ── 5대 내곽 통문 아치 현판 설치 (체육관·수영장과 겹치지 않는 직통 위치!) ──
  [
    [-50, -32, Math.PI / 2, '◀ 서북 캠퍼스 — 청운학사(기숙사) · 스포츠단지'],
    [-50, 56, Math.PI / 2, '◀ 서남 캠퍼스 — 학생회관 · 동아리연합회'],
    [50, -32, -Math.PI / 2, '동북 캠퍼스 — 과학천문관 · 천체관측소 ▶'],
    [50, 39, -Math.PI / 2, '동남 캠퍼스 — 중앙학술정보관 (대도서관) ▶'],
    [-9, -64, 0, '▲ 북측 캠퍼스 — 청운호 생태수변공원 · 호심정'],
  ].forEach(([gx, gz, ry, title]) => {
    const ag = new THREE.Group(); ag.position.set(gx, 0, gz); ag.rotation.y = ry; ag.userData.dynamic = true; OUT.add(ag);
    pbox(7.8, .42, .65, stoneM, 0, 3.45, 0, ag);
    pbox(6.0, .56, .14, darkMetal, 0, 3.85, 0, ag, { cast: false });
    pmesh(new THREE.PlaneGeometry(5.8, .48), new THREE.MeshBasicMaterial({ map: makeSign(title, '#162834', '#f2ead2', 22), side: THREE.DoubleSide }), 0, 3.85, .08, ag, { cast: false });
    pmesh(new THREE.PlaneGeometry(5.8, .48), new THREE.MeshBasicMaterial({ map: makeSign(title, '#162834', '#f2ead2', 22), side: THREE.DoubleSide }), 0, 3.85, -.08, ag, { ry: Math.PI, cast: false });
  });

  /* =========================================================================
     ① 제1확장동: 청운학사 (학생 기숙사 · 사감실 · 심야 정독실) — 서북 (x: -88, z: -32)
     ========================================================================= */
  {
    const cx = -88, cz = -32, W = 22, D = 14, H = 9.6;
    const g = new THREE.Group(); g.name = 'chunk_dorm'; g.userData.dynamic = true; OUT.add(g);
    buildShell(g, cx, cz, W, D, H, brickM, darkMetal, 'E', woodFloor);
    pbox(1.8, .24, 4.4, stoneM, cx + W / 2 + 1.1, 3.1, cz, g);
    [-1.8, 1.8].forEach(dz => pcyl(.16, .18, 3.0, stoneM, cx + W / 2 + 1.7, 1.5, cz + dz, g));
    pbox(.12, .62, 4.2, darkMetal, cx + W / 2 + 2.02, 3.45, cz, g, { cast: false });
    pmesh(new THREE.PlaneGeometry(4.0, .52), new THREE.MeshBasicMaterial({ map: makeSign('청 운 학 사 — 학생기숙사 · 심야정독실', '#1c2d38', '#f4ebd0', 24) }), cx + W / 2 + 2.09, 3.45, cz, g, { ry: Math.PI / 2, cast: false });
    for (let fy of [2.1, 5.4, 8.2]) for (let dz of [-4.8, -2.4, 2.4, 4.8]) {
      pmesh(new THREE.PlaneGeometry(1.5, 1.2), glassM, cx + W / 2 + .34, fy, cz + dz, g, { ry: Math.PI / 2, cast: false });
      pbox(.18, .08, 1.65, stoneM, cx + W / 2 + .38, fy - .62, cz + dz, g, { cast: false });
    }
    // 사감실 코너 (북동쪽 cx + 6.2, cz - 4.6)
    pbox(2.4, .76, .85, woodDark, cx + 6.2, .38, cz - 4.6, g); addCol(cx + 5.0, cx + 7.4, cz - 5.0, cz - 4.1);
    addChair(g, cx + 6.2, cz - 5.4, 0);
    pbox(.45, .38, .35, darkMetal, cx + 5.6, .95, cz - 4.6, g);
    pmesh(new THREE.PlaneGeometry(2.4, .9), new THREE.MeshBasicMaterial({ map: makeSign('사감실 호실 열쇠함 (101호 ~ 308호) | 점호 22:30', '#24342e', '#e8ece4', 20) }), cx + 6.2, 2.05, cz - D / 2 + .06, g, { cast: false });
    world.props.push({ kind: 'robj', k: 'dorm_log', t: 'mega15k', floor: 0, x: cx + 6.2, z: cz - 3.6, y: .9, r: 2.2, label: '기숙사 사감실 점호 일지 조사하기' });

    // 사생실 2층 침대(Bunk Beds: 기둥 4개 + 2단 프레임 + 사다리 + 안전난간 + 매트리스 + 베개 + 이불) 4조
    [-4.5, -1.5, 1.5, 4.5].forEach((dz, bi) => {
      const bx0 = cx - 8.2, bz0 = cz + dz;
      [[-.98, -.48], [.98, -.48], [-.98, .48], [.98, .48]].forEach(([px, pz]) => pbox(.08, 1.85, .08, woodDark, bx0 + px, .925, bz0 + pz, g));
      pbox(2.06, .12, 1.04, woodLight, bx0, .38, bz0, g);
      pbox(2.06, .12, 1.04, woodLight, bx0, 1.28, bz0, g);
      pbox(1.94, .14, .94, mattressM, bx0, .50, bz0, g);
      pbox(1.94, .14, .94, mattressM, bx0, 1.40, bz0, g);
      pbox(1.15, .05, .92, bi % 2 ? blueFabric : redFabric, bx0 + .35, .58, bz0, g);
      pbox(1.15, .05, .92, bi % 2 ? redFabric : blueFabric, bx0 + .35, 1.48, bz0, g);
      pbox(.36, .10, .62, whiteWall, bx0 - .68, .60, bz0, g);
      pbox(.36, .10, .62, whiteWall, bx0 - .68, 1.50, bz0, g);
      // 2층 침대 오르내리는 철제 사다리 & 상단 낙상방지 난간
      pbox(.04, 1.45, .36, chromeM, bx0 + 1.04, .75, bz0, g);
      pbox(1.4, .22, .04, woodDark, bx0 - .2, 1.62, bz0 + .50, g);
      addCol(bx0 - 1.08, bx0 + 1.08, bz0 - .56, bz0 + .56);
    });
    // 기숙사 사물함 4칸 (북벽 중앙)
    for (let k = 0; k < 4; k++) {
      pbox(.66, 1.85, .55, PM(0x5a6872, .5, .4), cx - 3.2 + k * .72, .925, cz - D / 2 + .35, g);
      pbox(.04, .16, .04, chromeM, cx - 3.0 + k * .72, 1.05, cz - D / 2 + .64, g);
    }
    addCol(cx - 3.6, cx - .6, cz - D / 2, cz - D / 2 + .7);
    world.props.push({ kind: 'robj', k: 'dorm_locker', t: 'mega15k', floor: 0, x: cx - 2.1, z: cz - D / 2 + 1.15, y: 1.1, r: 2.2, label: '기숙사 사생 사물함 파밍하기' });

    // 심야 정독실 칸막이 책상 4조 & 의자 4개 & 녹색 스탠드
    [-1.8, -.6, .6, 1.8].forEach(dx => {
      pbox(1.05, .76, .75, woodDark, cx + 4.5 + dx, .38, cz + 4.6, g);
      pbox(1.05, .48, .04, woodLight, cx + 4.5 + dx, 1.0, cz + 4.95, g);
      pbox(.04, .48, .75, woodLight, cx + 4.5 + dx - .51, 1.0, cz + 4.6, g);
      pbox(.18, .22, .18, greenLamp, cx + 4.5 + dx, .88, cz + 4.75, g, { cast: false });
      addChair(g, cx + 4.5 + dx, cz + 3.95, 0);
    });
    addCol(cx + 2.1, cx + 6.9, cz + 3.8, cz + 5.1);
    world.props.push({ kind: 'robj', k: 'dorm_study', t: 'mega15k', floor: 0, x: cx + 4.5, z: cz + 3.3, y: 1.0, r: 2.2, label: '심야 정독실 비밀 수첩 암호 풀기' });
    chunks.push({ id: 'chunk_dorm', g, x: cx, z: cz });
  }

  /* =========================================================================
     ② 제2확장동: 청운호(靑雲湖) 생태수변공원 & 호심정(湖心亭) 팔각정 — 북측 (x: -9, z: -86)
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
     ③ 제3확장동: 서문 과학천문관 & 대형 천체관측 돔 — 동북 (x: 84, z: -32)
     ========================================================================= */
  {
    const cx = 84, cz = -32, W = 20, D = 16, H = 8.8;
    const g = new THREE.Group(); g.name = 'chunk_astro'; g.userData.dynamic = true; OUT.add(g);
    buildShell(g, cx, cz, W, D, H, whiteWall, darkMetal, 'W', tileFloor);
    const silverM = PM(0xc8d2da, .25, .82);
    pmesh(new THREE.SphereGeometry(5.4, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), silverM, cx, H + .6, cz, g);
    pcyl(.42, .48, 3.8, darkMetal, cx - 2.6, H + 3.6, cz, g, { rz: Math.PI / 3.2 });
    pbox(1.8, .24, 4.4, stoneM, cx - W / 2 - 1.1, 3.1, cz, g);
    pbox(.12, .62, 4.4, darkMetal, cx - W / 2 - 2.02, 3.45, cz, g, { cast: false });
    pmesh(new THREE.PlaneGeometry(4.2, .52), new THREE.MeshBasicMaterial({ map: makeSign('서문 과학천문관 · 천체관측소', '#142438', '#d8f0ff', 24) }), cx - W / 2 - 2.09, 3.45, cz, g, { ry: -Math.PI / 2, cast: false });
    // 홀 중앙: 태양계 행성 모형 (Orrery) + 천체투영 링
    pcyl(1.4, 1.6, .85, darkMetal, cx, .425, cz, g, { seg: 16 });
    pmesh(new THREE.SphereGeometry(.48, 16, 14), new THREE.MeshStandardMaterial({ color: 0xffd040, emissive: 0xff9810, emissiveIntensity: .9 }), cx, 1.85, cz, g);
    [1.1, 1.7, 2.3].forEach((r, ri) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .018, 8, 32), chromeM);
      ring.rotation.x = Math.PI / 2; ring.position.set(cx, 1.85, cz); g.add(ring);
      pmesh(new THREE.SphereGeometry(.14 + ri * .04, 12, 10), PM([0x3888ff, 0xe05838, 0xd8b068][ri], .4), cx + Math.cos(ri * 2.1) * r, 1.85, cz + Math.sin(ri * 2.1) * r, g);
    });
    addCol(cx - 1.6, cx + 1.6, cz - 1.6, cz + 1.6);
    // 천체관측 제어 콘솔 & 듀얼 모니터
    pbox(1.4, .85, 3.4, darkMetal, cx + 6.8, .425, cz, g);
    [-0.8, 0.8].forEach(dz => {
      pbox(.38, .42, .55, PM(0x182028, .3, .6), cx + 6.7, 1.05, cz + dz, g);
      pmesh(new THREE.PlaneGeometry(.48, .34), new THREE.MeshBasicMaterial({ color: 0x38d8ff }), cx + 6.5, 1.06, cz + dz, g, { ry: -Math.PI / 2, cast: false });
    });
    addCol(cx + 6.0, cx + 7.6, cz - 1.7, cz + 1.7);
    pmesh(new THREE.PlaneGeometry(3.8, 1.8), new THREE.MeshBasicMaterial({ map: makeSign('1998.10.12 천체 성도 좌표 — 황도 12궁 & 페가수스자리 관측 중', '#0c1828', '#70e8ff', 20) }), cx + W / 2 - .06, 2.25, cz, g, { ry: -Math.PI / 2, cast: false });
    world.props.push({ kind: 'robj', k: 'astro_console', t: 'mega15k', floor: 0, x: cx + 5.4, z: cz, y: 1.1, r: 2.2, label: '천체관측소 성도 주파수 콘솔 조작하기' });

    // 광물·운석 유리 쇼케이스 진열장 (북벽 & 남벽)
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
     ④ 제4확장동: 중앙학술정보관 (별동 대도서관 · 마이크로필름 판독실) — 동남 (x: 84, z: 39)
     ========================================================================= */
  {
    const cx = 84, cz = 39, W = 22, D = 18, H = 9.4;
    const g = new THREE.Group(); g.name = 'chunk_library'; g.userData.dynamic = true; OUT.add(g);
    buildShell(g, cx, cz, W, D, H, brickM, stoneM, 'W', woodFloor);
    pbox(2.2, .28, 6.4, stoneM, cx - W / 2 - 1.2, 3.3, cz, g);
    [-2.6, 2.6].forEach(dz => pcyl(.22, .24, 3.2, stoneM, cx - W / 2 - 2.0, 1.6, cz + dz, g));
    pbox(.14, .68, 5.2, darkMetal, cx - W / 2 - 2.35, 3.68, cz, g, { cast: false });
    pmesh(new THREE.PlaneGeometry(5.0, .56), new THREE.MeshBasicMaterial({ map: makeSign('서문 중앙학술정보관 · 대도서관', '#221a14', '#f4e8c8', 24) }), cx - W / 2 - 2.43, 3.68, cz, g, { ry: -Math.PI / 2, cast: false });
    // 대형 원목 서가 4열 + 다단 선반 + 다채로운 책꽂이 블록들
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
    // 중앙 6인용 원목 열람 테이블 2조 & 독서 의자 8개 & 에메랄드 뱅커스 스탠드
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
    // 동쪽 안쪽: 마이크로필름 판독기 부스 & 사서 대출 데스크
    pbox(1.6, .82, 2.8, woodDark, cx + 8.2, .41, cz, g);
    pbox(.55, .62, .55, darkMetal, cx + 8.1, 1.12, cz - .5, g);
    pmesh(new THREE.PlaneGeometry(.46, .38), new THREE.MeshBasicMaterial({ map: makeSign('1998.10.13 호외 — 서문고 심야 실종 사건 특보', '#101814', '#80ffb8', 18) }), cx + 7.81, 1.15, cz - .5, g, { ry: -Math.PI / 2, cast: false });
    addCol(cx + 7.3, cx + 9.1, cz - 1.5, cz + 1.5);
    world.props.push({ kind: 'robj', k: 'lib_microfilm', t: 'mega15k', floor: 0, x: cx + 6.6, z: cz, y: 1.1, r: 2.2, label: '마이크로필름 판독기로 1998년 신문 기사 복원하기' });
    world.props.push({ kind: 'robj', k: 'lib_desk', t: 'mega15k', floor: 0, x: cx - 3.5, z: cz, y: .9, r: 2.2, label: '대도서관 열람실 미반납 도서함 조사하기' });
    chunks.push({ id: 'chunk_library', g, x: cx, z: cz });
  }

  /* =========================================================================
     ⑤ 제5확장동: 종합 스포츠 콤플렉스 (야외 테니스장 & 양궁 훈련장) — 서중부 (x: -88, z: 8)
     ========================================================================= */
  {
    const cx = -88, cz = 8;
    const g = new THREE.Group(); g.name = 'chunk_sports'; g.userData.dynamic = true; OUT.add(g);
    pbox(22, .04, 26, PM(0x285a3e, .8), cx, .02, cz, g, { cast: false });
    pbox(16, .05, 20, PM(0x225488, .75), cx, .025, cz, g, { cast: false });
    pbox(16, .055, .10, whiteWall, cx, .03, cz - 10, g, { cast: false });
    pbox(16, .055, .10, whiteWall, cx, .03, cz + 10, g, { cast: false });
    pbox(.10, .055, 20, whiteWall, cx - 8, .03, cz, g, { cast: false });
    pbox(.10, .055, 20, whiteWall, cx + 8, .03, cz, g, { cast: false });
    [-8.2, 8.2].forEach(dx => pcyl(.06, .06, 1.1, darkMetal, cx + dx, .55, cz, g));
    pbox(16.4, .85, .04, PM(0x222628, .9), cx, .52, cz, g, { cast: false });
    pbox(16.4, .06, .06, whiteWall, cx, .96, cz, g, { cast: false });
    addCol(cx - 8.3, cx + 8.3, cz - .15, cz + .15);
    [-5.0, 0, 5.0].forEach(dx => {
      pbox(1.2, 1.5, .18, woodLight, cx + dx, .85, cz - 11.8, g);
      pmesh(new THREE.CircleGeometry(.52, 18), PM(0xf0d020, .6), cx + dx, 1.0, cz - 11.68, g, { cast: false });
      pmesh(new THREE.CircleGeometry(.32, 16), PM(0xd82820, .6), cx + dx, 1.0, cz - 11.67, g, { cast: false });
      addCol(cx + dx - .65, cx + dx + .65, cz - 12.1, cz - 11.5);
    });
    pbox(1.2, .16, 4.6, darkMetal, cx + 9.4, 2.5, cz + 4.5, g);
    pbox(.65, .45, 3.8, woodLight, cx + 9.4, .225, cz + 4.5, g);
    pbox(.75, .58, .55, PM(0x2468b8, .4), cx + 9.4, .29, cz + 1.6, g);
    pmesh(new THREE.PlaneGeometry(3.2, .42), new THREE.MeshBasicMaterial({ map: makeSign('서문 체육특기생 훈련장 (테니스 · 양궁)', '#183426', '#eaf4ec', 22) }), cx + 10.1, 2.5, cz + 4.5, g, { ry: Math.PI / 2, cast: false });
    addCol(cx + 8.9, cx + 9.9, cz + 1.2, cz + 6.5);
    world.props.push({ kind: 'robj', k: 'sports_cooler', t: 'mega15k', floor: 0, x: cx + 8.2, z: cz + 1.6, y: .6, r: 2.2, label: '체육부 아이스박스 열기' });
    chunks.push({ id: 'chunk_sports', g, x: cx, z: cz });
  }

  /* =========================================================================
     ⑥ 제6확장동: 학생회관 · 동아리연합회관 (소극장 · 합주실 · 라운지) — 서남 (x: -88, z: 56)
     ========================================================================= */
  {
    const cx = -88, cz = 56, W = 22, D = 16, H = 9.0;
    const g = new THREE.Group(); g.name = 'chunk_union'; g.userData.dynamic = true; OUT.add(g);
    buildShell(g, cx, cz, W, D, H, stoneM, darkMetal, 'E', woodFloor);
    pbox(1.8, .24, 4.6, darkMetal, cx + W / 2 + 1.1, 3.1, cz, g);
    pbox(.12, .64, 4.6, darkMetal, cx + W / 2 + 2.02, 3.45, cz, g, { cast: false });
    pmesh(new THREE.PlaneGeometry(4.4, .54), new THREE.MeshBasicMaterial({ map: makeSign('학생회관 · 동아리연합회 (소극장 · 라운지)', '#281e32', '#f4e8d8', 22) }), cx + W / 2 + 2.09, 3.45, cz, g, { ry: Math.PI / 2, cast: false });
    // 소극장 무대 & 붉은 벨벳 커튼 & 객석 의자 6개 & 음향 콘솔
    pbox(4.2, .32, 11.0, woodDark, cx - 7.8, .16, cz, g);
    addCol(cx - 9.9, cx - 5.7, cz - 5.5, cz + 5.5, false, .30);
    pbox(.22, 3.4, 3.2, redFabric, cx - 9.8, 1.9, cz - 3.6, g);
    pbox(.22, 3.4, 3.2, redFabric, cx - 9.8, 1.9, cz + 3.6, g);
    pmesh(new THREE.PlaneGeometry(5.2, .58), new THREE.MeshBasicMaterial({ map: makeSign('제32회 해교제 연극부·합창부 합동 리허설 무대', '#2c1418', '#f6e4c0', 22) }), cx - 9.7, 3.1, cz, g, { ry: Math.PI / 2, cast: false });
    for (let rz of [-2.4, 0, 2.4]) {
      addChair(g, cx - 3.8, cz + rz, -Math.PI / 2, redFabric);
      addChair(g, cx - 2.8, cz + rz, -Math.PI / 2, redFabric);
    }
    pbox(1.2, .88, 2.2, darkMetal, cx - 1.2, .44, cz, g); addCol(cx - 1.9, cx - .5, cz - 1.2, cz + 1.2);
    world.props.push({ kind: 'robj', k: 'union_console', t: 'mega15k', floor: 0, x: cx + .1, z: cz, y: 1.0, r: 2.2, label: '학생회관 소극장 음향 콘솔 복구하기' });

    // 탁구대 (다리 4개 + 상판 + 흰색 센터라인 + 네트) & 동아리 사물함 4칸
    pbox(2.74, .06, 1.52, PM(0x1b4d88, .5), cx + 4.2, .74, cz - 4.2, g);
    [[-1.2, -.65], [1.2, -.65], [-1.2, .65], [1.2, .65]].forEach(([lx, lz]) => pbox(.06, .74, .06, darkMetal, cx + 4.2 + lx, .37, cz - 4.2 + lz, g));
    pbox(.04, .18, 1.56, whiteWall, cx + 4.2, .85, cz - 4.2, g);
    addCol(cx + 2.7, cx + 5.7, cz - 5.1, cz - 3.3);
    for (let k = 0; k < 4; k++) pbox(.68, 1.85, .55, PM(0x4a5860, .5, .4), cx + 3.0 + k * .74, .925, cz + D / 2 - .38, g);
    addCol(cx + 2.6, cx + 5.8, cz + D / 2 - .75, cz + D / 2);
    world.props.push({ kind: 'robj', k: 'union_locker', t: 'mega15k', floor: 0, x: cx + 4.2, z: cz + D / 2 - 1.2, y: 1.1, r: 2.2, label: '동아리연합회 보관함 파밍하기' });
    chunks.push({ id: 'chunk_union', g, x: cx, z: cz });
  }

  if (megaP && megaP.registerRoomChunk) {
    chunks.forEach(c => megaP.registerRoomChunk(c.id, c.g, new THREE.Vector3(c.x, 0, c.z), 28, 0));
  }
  return chunks;
}
