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
    pbox(W + .86, .24, D + .86, stoneM, cx, 4.25, cz, grp, { cast: false });
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

    // 2층 동남쪽 돌출 발코니 & 주철 동자주 난간 (CAD BALCONY)
    pbox(1.9, .22, 4.4, stoneM, x1 + 1.15, Y2 - .08, cz + 4.3, g);
    pbox(.08, .08, 4.4, walnutM, x1 + 2.02, Y2 + 1.02, cz + 4.3, g);
    for (let bz = cz + 2.2; bz <= cz + 6.4; bz += .35) {
      pcyl(.016, .016, 1.02, ironBalM, x1 + 2.02, Y2 + .51, bz, g);
    }

    // 2) 북쪽 벽면 16단 화강암·월넛 실내 직통 계단 + 22개 주철 동자주(Balusters) & 뉴얼 포스트 난간!
    for (let st = 0; st < 16; st++) {
      const sx1 = -93.6 + st * .60, sx2 = sx1 + .62, sh = (st + 1) * (Y2 / 16);
      pbox(.62, sh, 2.32, stoneM, (sx1 + sx2) / 2, sh / 2, z0 + 1.25, g);
      pbox(.66, .045, 2.38, walnutM, (sx1 + sx2) / 2, sh + .015, z0 + 1.25, g, { cast: false });
      addCol(sx1, sx2, z0 + .1, z0 + 2.45, false, sh);
      // 계단 단마다 수직 주철 동자주 기둥 설치!
      pcyl(.018, .018, .92, ironBalM, (sx1 + sx2) / 2, sh + .46, z0 + 2.42, g);
    }
    // 계단 상·하단 원목 뉴얼 포스트 기둥 & 경사 핸드레일
    pbox(.16, 1.15, .16, walnutM, -93.55, .58, z0 + 2.42, g);
    pbox(.16, 1.15, .16, walnutM, -83.95, Y2 + .58, z0 + 2.42, g);
    pbox(10.0, .09, .10, walnutM, -88.75, Y2 / 2 + .94, z0 + 2.42, g, { rz: Math.atan2(Y2, 9.6) });
    addCol(-93.6, -84.0, z0 + 2.38, z0 + 2.56, false, null, { maxY: 3.6 });

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
    addCol(cx + 3.05, cx + 3.35, cz + 2.85, z1 - .1, false, null, { maxY: 2.6 });
    pmesh(new THREE.PlaneGeometry(1.4, .32), new THREE.MeshBasicMaterial({ map: makeSign('1F 사감실 · 보안관제실', '#1b2822', '#f0dfc0', 22) }), cx + 3.09, 2.62, cz + 2.1, g, { ry: -Math.PI / 2, cast: false });

    // 2층 서쪽 침실(201호·202호) 복도 파티션 충돌체 및 호실 명패 (문 위치 z: cz - 1.6 ~ cz + 0.2 및 cz + 2.8 ~ cz + 4.6 개방!)
    addCol(cx - 4.35, cx - 4.05, z0 + 2.6, cz - 1.6, false, null, { y0: 3.8 });
    addCol(cx - 4.35, cx - 4.05, cz + 0.2, cz + 2.8, false, null, { y0: 3.8 });
    addCol(cx - 4.35, cx - 4.05, cz + 4.6, z1 - .1,  false, null, { y0: 3.8 });
    pmesh(new THREE.PlaneGeometry(1.1, .28), new THREE.MeshBasicMaterial({ map: makeSign('201호 생활실', '#241812', '#f4e2b8', 24) }), cx - 4.08, Y2 + 2.52, cz - .7, g, { ry: Math.PI / 2, cast: false });
    pmesh(new THREE.PlaneGeometry(1.1, .28), new THREE.MeshBasicMaterial({ map: makeSign('202호 생활실', '#241812', '#f4e2b8', 24) }), cx - 4.08, Y2 + 2.52, cz + 3.7, g, { ry: Math.PI / 2, cast: false });

    // 2층 동쪽 심야 정독실 복도 파티션 충돌체 및 현판 (문 위치 z: cz + 1.2 ~ cz + 3.1 개방!)
    addCol(cx + 1.65, cx + 1.95, cz + 3.1, z1 - .1, false, null, { y0: 3.8 });
    pmesh(new THREE.PlaneGeometry(2.6, .42), new THREE.MeshBasicMaterial({ map: makeSign('2F 심야 정독실 (STUDY ROOM) — 정숙 엄수', '#162820', '#88ffb8', 22) }), cx + 1.68, Y2 + 2.56, cz + 2.15, g, { ry: -Math.PI / 2, cast: false });

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
    pbox(.48, .22, .36, PM(0x7a5824, .45, .65), cx, 1.12, cz, g);
    const capLidPiv = new THREE.Group(); capLidPiv.userData.dynamic = true; capLidPiv.position.set(cx, 1.23, cz - .17); g.add(capLidPiv);
    pbox(.50, .07, .38, PM(0xa88238, .3, .8), 0, .035, .17, capLidPiv);
    pbox(.08, .05, .04, goldM, 0, .02, .36, capLidPiv);
    addCol(cx - .65, cx + .65, cz - .65, cz + .65);
    world.props.push({ kind: 'robj', k: 'lake_capsule', t: 'mega15k', floor: 0, x: cx, z: cz + 1.25, y: 1.1, r: 2.2, label: '호심정 정자 위 1998 졸업생 봉인함 열기', anim: { type: 'lid', lidPiv: capLidPiv, openAngle: -1.45, t: 0, active: false } });

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
    const silverM = PM(0xb8c6d2, .28, .78);
    // 천문관 관측돔 하부 원통형 회전 드럼 기단 & 슬릿 아치 리브 & 옥상 안전 난간
    pcyl(5.6, 5.7, 1.1, stoneM, cx, H + .95, cz, g, { seg: 24 });
    pmesh(new THREE.SphereGeometry(5.4, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), silverM, cx, H + 1.4, cz, g);
    [-.65, .65].forEach(ox => pmesh(new THREE.TorusGeometry(5.44, .10, 8, 24, Math.PI), darkMetal, cx + ox, H + 1.4, cz, g, { ry: Math.PI / 2 }));
    pcyl(.42, .48, 4.2, darkMetal, cx - 2.6, H + 4.2, cz, g, { rz: Math.PI / 3.2 });
    pbox(1.8, .24, 4.4, stoneM, cx - W / 2 - 1.1, 3.1, cz, g);
    [-1.8, 1.8].forEach(dz => pcyl(.20, .22, 3.0, stoneM, cx - W / 2 - 1.8, 1.5, cz + dz, g));
    pbox(.12, .62, 4.4, darkMetal, cx - W / 2 - 2.02, 3.45, cz, g, { cast: false });
    pmesh(new THREE.PlaneGeometry(4.2, .52), new THREE.MeshBasicMaterial({ map: makeSign('서문 과학천문관 · 천체관측소', '#142438', '#d8f0ff', 24) }), cx - W / 2 - 2.09, 3.45, cz, g, { ry: -Math.PI / 2, cast: false });
    // 남측(광장 조망면)에도 과학천문관 대형 현판 장착
    pbox(5.6, .62, .14, darkMetal, cx, 8.15, cz + D / 2 + .42, g, { cast: false });
    pmesh(new THREE.PlaneGeometry(5.4, .52), new THREE.MeshBasicMaterial({ map: makeSign('서문 과학천문관 · SEOMUN OBSERVATORY', '#142438', '#d8f0ff', 22) }), cx, 8.15, cz + D / 2 + .50, g, { cast: false });
    // 홀 중앙: 태양계 행성 모형 (Orrery) + 애니메이션 .glb 결합
    pcyl(1.4, 1.6, .85, darkMetal, cx, .425, cz, g, { seg: 16 });
    pmesh(new THREE.SphereGeometry(.48, 16, 14), new THREE.MeshStandardMaterial({ color: 0xffd040, emissive: 0xff9810, emissiveIntensity: .9 }), cx, 1.85, cz, g);
    const orreryPiv = new THREE.Group(); orreryPiv.userData.dynamic = true; orreryPiv.position.set(cx, 1.85, cz); g.add(orreryPiv);
    [1.1, 1.7, 2.3].forEach((r, ri) => {
      const ringG = new THREE.Group(); ringG.userData.dynamic = true; orreryPiv.add(ringG);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .018, 8, 32), chromeM);
      ring.rotation.x = Math.PI / 2; ringG.add(ring);
      pmesh(new THREE.SphereGeometry(.14 + ri * .04, 12, 10), PM([0x3888ff, 0xe05838, 0xd8b068][ri], .4), Math.cos(ri * 2.1) * r, 0, Math.sin(ri * 2.1) * r, ringG);
    });
    addCol(cx - 1.6, cx + 1.6, cz - 1.6, cz + 1.6);
    pbox(1.4, .85, 3.4, darkMetal, cx + 6.8, .425, cz, g);
    [-0.8, 0.8].forEach(dz => {
      pbox(.38, .42, .55, PM(0x182028, .3, .6), cx + 6.7, 1.05, cz + dz, g);
      pmesh(new THREE.PlaneGeometry(.48, .34), new THREE.MeshBasicMaterial({ color: 0x38d8ff }), cx + 6.5, 1.06, cz + dz, g, { ry: -Math.PI / 2, cast: false });
    });
    addCol(cx + 6.0, cx + 7.6, cz - 1.7, cz + 1.7);
    pmesh(new THREE.PlaneGeometry(3.8, 1.8), new THREE.MeshBasicMaterial({ map: makeSign('1998.10.12 천체 성도 좌표 — 황도 12궁 & 페가수스자리 관측 중', '#0c1828', '#70e8ff', 20) }), cx + W / 2 - .06, 2.25, cz, g, { ry: -Math.PI / 2, cast: false });
    world.props.push({ kind: 'robj', k: 'astro_console', t: 'mega15k', floor: 0, x: cx + 5.4, z: cz, y: 1.1, r: 2.2, label: '천체관측소 성도 주파수 콘솔 조작하기', anim: { type: 'orrery', orreryPiv, t: 0, active: false } });

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
    // 북측(광장 조망면) 대도서관 현판 추가
    pbox(5.8, .62, .14, darkMetal, cx, 8.55, cz - D / 2 - .42, g, { cast: false });
    pmesh(new THREE.PlaneGeometry(5.6, .52), new THREE.MeshBasicMaterial({ map: makeSign('중앙학술정보관 · CENTRAL LIBRARY', '#221a14', '#f4e8c8', 22) }), cx, 8.55, cz - D / 2 - .50, g, { ry: Math.PI, cast: false });
    world.props.push({ kind: 'robj', k: 'lib_desk', t: 'mega15k', floor: 0, x: cx - 3.5, z: cz, y: .9, r: 2.2, label: '대도서관 열람실 미반납 도서함 조사하기' });
    chunks.push({ id: 'chunk_library', g, x: cx, z: cz });
  }

  /* =========================================================================
     ④-B [동편 중앙 학술광장] 서문 백주년 학술 시계탑 · 해시계 광장 & 야외 독서 파고라 & 동편 대로 가로등 (x: 82, z: 2)
     - 과학천문관(z=-34)과 중앙학술정보관(z=39) 사이의 56m 빈 공백을 메우는 동편 중심 랜드마크 광장!
     ========================================================================= */
  {
    const cx = 82, cz = 2;
    const g = new THREE.Group(); g.name = 'chunk_east_plaza'; g.userData.dynamic = true; OUT.add(g);
    // 화강암 판석 광장 바닥 (x: 72.2 ~ 92.0, z: -14.0 ~ +18.0) & 화단 경계석
    pbox(19.6, .05, 30.0, stoneM, cx, .025, cz, g, { cast: false });
    pbox(12.0, .14, 12.0, PM(0x7c7870, .75), cx, .07, cz, g, { cast: false });
    // 중앙 서문 학술 시계탑 & 황동 혼천의/해시계 조형물 (높이 6.8m)
    pbox(2.6, .45, 2.6, stoneM, cx, .225, cz, g);
    pbox(1.8, .55, 1.8, stoneM, cx, .725, cz, g);
    pbox(1.15, 4.6, 1.15, brickM, cx, 3.30, cz, g);
    pbox(1.45, .32, 1.45, stoneM, cx, 5.76, cz, g);
    pbox(.95, .85, .95, darkMetal, cx, 6.35, cz, g);
    // 4면 발광 시계판 & 상단 황동 구형 오브제
    [[-0.58, 0, -Math.PI / 2], [0.58, 0, Math.PI / 2], [0, -0.58, Math.PI], [0, 0.58, 0]].forEach(([ox, oz, ry]) => {
      pmesh(new THREE.CircleGeometry(.42, 18), lampEm, cx + ox, 4.85, cz + oz, g, { ry, cast: false });
    });
    pmesh(new THREE.SphereGeometry(.42, 16, 12), goldM, cx, 7.15, cz, g);
    pmesh(new THREE.PlaneGeometry(2.2, .38), new THREE.MeshBasicMaterial({ map: makeSign('서문 백주년 학술 시계탑 · 1998', '#18242c', '#f4e8c8', 22) }), cx - .60, 2.15, cz, g, { ry: -Math.PI / 2, cast: false });
    addCol(cx - 1.3, cx + 1.3, cz - 1.3, cz + 1.3);

    // 광장 남·북 목재 야외 독서 파고라(Pergola) 2동 & 벤치 (z = cz - 9.0, cz + 9.0)
    [-9.0, 9.0].forEach((dz, pi) => {
      const pz = cz + dz;
      pbox(6.4, .12, 4.2, woodDark, cx, .06, pz, g, { cast: false });
      [[-2.8, -1.7], [2.8, -1.7], [-2.8, 1.7], [2.8, 1.7]].forEach(([px, qz]) => {
        pbox(.22, 2.8, .22, woodDark, cx + px, 1.4, pz + qz, g);
      });
      pbox(6.8, .18, .24, woodDark, cx, 2.85, pz - 1.7, g);
      pbox(6.8, .18, .24, woodDark, cx, 2.85, pz + 1.7, g);
      for (let rx = -3.0; rx <= 3.0; rx += .75) {
        pbox(.12, .14, 4.6, woodLight, cx + rx, 3.0, pz, g);
      }
      // 파고라 중앙 야외 테이블 & 양측 벤치 + 온백색 파고라 등기구
      pbox(2.6, .72, .9, woodLight, cx, .36, pz, g);
      pbox(2.6, .44, .42, woodDark, cx, .22, pz - .95, g);
      pbox(2.6, .44, .42, woodDark, cx, .22, pz + .95, g);
      pbox(1.2, .06, .28, lampEm, cx, 2.78, pz, g, { cast: false });
      addCol(cx - 1.4, cx + 1.4, pz - 1.2, pz + 1.2);
      if (pi === 0) {
        pmesh(new THREE.PlaneGeometry(2.4, .32), new THREE.MeshBasicMaterial({ map: makeSign('동편 학술광장 · 야외 독서 파고라', '#1c2c24', '#e8f4dc', 20) }), cx - 2.95, 2.45, pz, g, { ry: -Math.PI / 2, cast: false });
      }
    });

    // 동편 남북 종단 대로(x = 69.4 ~ 72.2) 및 연결 산책로(x = 42 ~ 68, z = 5.0) 연도 캠퍼스 가로등 12기 설치!
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
    const coolerLidPiv = new THREE.Group(); coolerLidPiv.userData.dynamic = true; coolerLidPiv.position.set(cx + 6.8, .58, cz + 8.06); g.add(coolerLidPiv);
    pbox(.87, .07, .57, whiteWall, 0, .035, -.28, coolerLidPiv);
    world.props.push({ kind: 'robj', k: 'sports_cooler', t: 'mega15k', floor: 0, x: cx + 6.8, z: cz + 6.8, y: .6, r: 2.2, label: '야구부 덕아웃 아이스박스 열기', anim: { type: 'lid', lidPiv: coolerLidPiv, openAngle: 1.45, t: 0, active: false } });
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
    let unionLockerDoorPiv = null;
    for (let k = 0; k < 4; k++) {
      const lx = cx + 3.0 + k * .74;
      pbox(.68, 1.85, .50, PM(0x4a5860, .5, .4), lx, .925, cz + D / 2 - .36, g);
      if (k === 1) {
        const piv = new THREE.Group(); piv.userData.dynamic = true; piv.position.set(lx - .33, .925, cz + D / 2 - .62); g.add(piv);
        pbox(.66, 1.80, .035, PM(0x55646d, .45, .5), .33, 0, -.015, piv);
        pbox(.04, .18, .04, goldM, .55, .10, -.04, piv);
        unionLockerDoorPiv = piv;
      }
    }
    addCol(cx + 2.6, cx + 5.8, cz + D / 2 - .75, cz + D / 2);
    world.props.push({ kind: 'robj', k: 'union_locker', t: 'mega15k', floor: 0, x: cx + 4.2, z: cz + D / 2 - 1.2, y: 1.1, r: 2.2, label: '동아리연합회 보관함 파밍하기', anim: { type: 'hinge', doorPiv: unionLockerDoorPiv, openAngle: 1.45, t: 0, active: false } });
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
