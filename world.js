// 폐교 월드 빌더 — 레퍼런스(배치도/정문/교실/소품 시트)를 기반으로 학교 전체를 절차적으로 생성한다.
import * as THREE from './vendor/three.module.js';
import * as T from './tex.js';
import { rnd, rr, pick } from './tex.js';
import { bakeStatic } from './bake.js';
import { GUARD_LAYOUT, GUARD_SPUR, GUARD_NODES, guardCollisionRects } from './guardRoomLayout.js';
import { buildGuardAnnex, buildDutyRoom, ANNEX as GANX } from './guardAnnex.js?v=223';
import { NOTES } from './story.js?v=223';
import { buildCampusDesign, turfMaterial } from './campusVisuals.js';
import { elevatorBay } from './elevatorLayout.js';
import { removeDuplicateModels } from './placement.js';
import { loadSurfaceTexture } from './materialTextures.js'; import { buildWindowFakes } from './windowInteriors.js?v=223';

export const FH = 4, CH = 3.6;
export const SLOTS = [-32, -24, -16, -8, 0, 8, 16, 24, 32];
// 층별 교실 배치 (레퍼런스 평면도 기준)
export const LAYOUT = [
  { types: ['toilet', 'counsel', 'class', 'office', 'stair', 'class', 'class', 'class', 'class'],
    names: ['화장실', '상담실', '1-5', '교무실', '중앙계단', '1-1', '1-2', '1-3', '1-4'] },
  { types: ['toilet', 'class', 'class', 'class', 'stair', 'class', 'class', 'reading', 'smart'],
    names: ['화장실', '2-1', '2-2', '2-3', '중앙계단', '2-4', '2-5', '2학년 정독실', '멀티미디어실'] },
  { types: ['broadcast', 'broadcast', 'class', 'class', 'stair', 'class', 'class', 'reading', 'student'],
    names: ['방송편집실', '방송실', '3-1', '3-3', '중앙계단', '3-4', '3-5', '3학년 정독실', '진학상담실'] },
  null,
  { types: ['exit', 'boiler', 'electric', 'storage', 'stair', 'records', 'cleaning', 'generator', 'pump'],
    names: ['소방시설실', '기계실 (보일러)', '유지보수실 · 전기실', '창고', '진입 계단실', '문서 보관실', '청소도구실', '기계실 (발전기)', '펌프실'] },   // 지하 1층: 기계실 · 펌프실 · 유지보수실 · 문서보관실 · 창고 · 소방시설 · 방공호(벙커)
];
// 본관 남쪽 방 줄 (1층 중앙현관 옆은 보건실, 3층 방송편집실은 확장된 3층 방송실 내부로 통합하고 3층 동측은 여자화장실·남자화장실 나란히 배치)
export const LAYOUT_S = [
  { types: ['reading', 'archive', 'staff', 'nurse', 'lobby', 'print', 'student', 'av', 'toilet'], names: ['1학년 정독실', '학적기록실', '교사 휴게실', '보건실', '중앙현관', '인쇄실', '학생자치실', '시청각자료실', '화장실'] },
  { types: ['archive', 'toilet', 'principal', 'meeting', 'hall', 'staff', 'counselS', 'club', 'av'], names: ['교과자료실', '화장실', '교장실', '회의실', '2층 홀', '교사 휴게실', '상담실', '진로진학실', '어학청취실'] },
  { types: ['archive', 'class', 'reading', 'club', 'hall', 'counselS', 'staff', 'toilet', 'toilet'], names: ['졸업앨범실', '3-2', '논술지도실', '문예창작실', '3층 홀', '상담실', '교사 휴게실', '여자화장실', '남자화장실'] },
];
// 별관 남쪽 방 줄 (본관에서 분리된 특별실 전부 수용 · 창고 제거)
export const ANNEX_S = [
  { types: ['sick', 'tool', 'lobbyA', 'print', 'counsel'], names: ['보건실 보조', '공구실', '별관 현관', '인쇄실', '진로상담실 (104)'] },
  { types: ['prepS', 'digital', 'lobbyA', 'archive', 'club'], names: ['과학 준비실', '디지털실습실', '2층 연결 홀', '기록 보관실', '동아리실 (204)'] },
  { types: ['av', 'student', 'lobbyA', 'gallery', 'reading'], names: ['시청각실', '학생회실', '3층 연결 홀', '전시 공간', '열람실'] },
];
export const MAIN_ZS = 9.9;
// 본관 1층 계단실 북쪽 문 ↔ 별관 현관을 잇는 연결 통로 (본관 북벽 z -9.9 ~ 별관 남벽 z -20.5)
// 별관 외관(바깥 건물 상자)은 ANNEX_DZ 만큼 북쪽으로 물려 통로를 10.6m 로 늘렸다 (예전 3.6m — 너무 짧았다). 별관 실내(8~10층)는 따로 된 좌표라 그대로
export const ANNEX_DZ = 7;
const ANNEX_EXIT_Z = -19.25 - ANNEX_DZ;   // 별관 서쪽 비상구 (바깥 외벽 z 가운데)
// 메가 익스팬션: 별관 뒤로 캠퍼스를 넓혀 대강당(실내체육관) · 중앙 중정이 들어간다 (예전 담장 z −33 → −64)
export const NORTH_Z = -64;   // 학교 북쪽 담장
export const MEGA = { gym: { x: -25, z: -48, w: 18, d: 26 }, court: { x: 3, z: -52, w: 16, d: 16 } };
export const WALKWAY = { x1: -1.6, x2: 3.6, z1: -13.5 - ANNEX_DZ, z2: -9.9 };   // 본관 남쪽 외벽 바깥면 (남쪽 방: z 1.75 ~ 9.6)
export const ANNEX = { slots: [-16, -8, 0, 8, 16], floors: [
  { types: ['stair', 'counsel', 'cooking', 'tech', 'library'], names: ['계단', '상담실', '요리실', '기술·가정실 (102)', '도서실'] },
  { types: ['stair', 'computer', 'lang', 'smart', 'lab'], names: ['계단', '컴퓨터실', '언어실 (202)', '스마트교실 (203)', '과학실'] },
  { types: ['stair', 'music', 'art', 'craft', 'fusion'], names: ['계단', '음악실', '미술실', '공예실', '창의융합실 (103)'] }] };
export const GATE_Z = 70;
export const KEY_NAMES = ['교무실', '도서실', '과학실', '체육관', '수영장'];
export const KEY_ROOMS = [{ f: 0, x: -8, z: -5.5 }, { f: 8, x: 16, z: -5.5 }, { f: 9, x: 16, z: -5.5 }, { f: 5, x: 29.5, z: 20.5 }, { f: 6, x: -35.8, z: 44 }];
export const AREA_NAMES = { 0: '1F', 1: '2F', 2: '3F', 3: 'RF', 4: 'B1', 5: '체육관', 6: '수영장', 7: '급식실', 8: '별관 1F', 9: '별관 2F', 10: '별관 3F' };
export const ROOF_Y = 12.4;


export function buildWorld(scene) {
  /* ---------- 재질 ---------- */
  // 단색 재질은 같은 설정끼리 공유한다 (배칭 효율 ↑)
  const _solid = new Map();
  // 단색 재질에 공통 '사용감' 디테일: 거의 흰 바탕의 얼룩 · 긁힘 · 모서리 때 (색은 재질 color 로 곱해진다) + 도장면 노멀
  // — 예전에는 95곳의 단색 상자가 텍스처 없이 '블록'처럼 보였다
  const detailMap = (() => {
    const N = 512, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
    g.fillStyle = '#efefef'; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 260; i++) { const x = rnd() * N, y = rnd() * N, r = 8 + rnd() * 60, a = .02 + rnd() * .06; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(70,62,50,${a})`); gr.addColorStop(1, 'rgba(70,62,50,0)'); g.fillStyle = gr; for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { g.save(); g.translate(ox, oy); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); } }
    g.strokeStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 90; i++) { const x = rnd() * N, y = rnd() * N, a = rnd() * 6.3, l = 6 + rnd() * 30; g.lineWidth = .6 + rnd(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    g.strokeStyle = 'rgba(40,34,26,.12)'; for (let i = 0; i < 60; i++) { const x = rnd() * N; g.lineWidth = 1 + rnd() * 3; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + rnd() * 6 - 3, N * (.2 + rnd() * .5)); g.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  })();
  let detailNormal = null;
  const S = (map, o = {}) => {
    if (map) return new THREE.MeshStandardMaterial({ map, roughness: .92, metalness: 0, ...o });
    const k = JSON.stringify(o);
    if (!_solid.has(k)) { const m = new THREE.MeshStandardMaterial({ roughness: .92, metalness: 0, map: o.map === undefined && !o.transparent ? detailMap : null, ...o }); if (detailNormal && !o.transparent) { m.normalMap = detailNormal; m.normalScale = new THREE.Vector2(.45, .45); } _solid.set(k, m); }
    return _solid.get(k);
  };
  // PBR 재질 (색 + 노멀 + 거칠기)
  const P = (t, o = {}) => new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, metalness: 0, ...o });
  // 1998년 감성 한국 고등학교 복도·계단실 벽면 PBR (화장실 타일 느낌을 완전히 제거하고 상단 크림 아이보리 수성페인트 + 중간 진갈색 원목 허리몰딩 + 하단 1998 레트로 베이지/세이지 반광 유성페인트 웨인스코팅 루바 + 하단 걸레받이 구현!)
  const build1998SchoolWallPBR = () => {
    const N = 512;
    const cCol = document.createElement('canvas'); cCol.width = cCol.height = N;
    const g = cCol.getContext('2d');
    // 상단 (0 ~ 64%): 1998년 학교 특유의 따뜻한 크림 아이보리 수성페인트 회벽
    const topGr = g.createLinearGradient(0, 0, 0, N * 0.64);
    topGr.addColorStop(0, '#dcd5c4'); topGr.addColorStop(0.85, '#e2dccb'); topGr.addColorStop(1, '#d2cab6');
    g.fillStyle = topGr; g.fillRect(0, 0, N, N * 0.64);
    // 중간 허리띠 몰딩 (64% ~ 68%): 클래식 다크 월넛 원목 몰딩 (Wood Chair Rail)
    const railY = Math.round(N * 0.64), railH = Math.round(N * 0.042);
    const railGr = g.createLinearGradient(0, railY, 0, railY + railH);
    railGr.addColorStop(0, '#5c3d24'); railGr.addColorStop(0.45, '#422a17'); railGr.addColorStop(1, '#26170b');
    g.fillStyle = railGr; g.fillRect(0, railY, N, railH);
    // 하단 허리벽 (68% ~ 95%): 1998년 감성의 따뜻한 올리브 베이지 반광 유성페인트 & 세로 웨인스코팅 루바 홈
    const wainY = railY + railH, baseH = Math.round(N * 0.055), wainH = N - wainY - baseH;
    const wainGr = g.createLinearGradient(0, wainY, 0, wainY + wainH);
    wainGr.addColorStop(0, '#9ba088'); wainGr.addColorStop(0.5, '#929880'); wainGr.addColorStop(1, '#828870');
    g.fillStyle = wainGr; g.fillRect(0, wainY, N, wainH);
    // 세로 웨인스코팅 루바 패널 홈 (16등분)
    for (let x = 0; x < N; x += 32) {
      g.fillStyle = 'rgba(42,46,35,0.32)'; g.fillRect(x, wainY + 4, 2, wainH - 8);
      g.fillStyle = 'rgba(235,238,220,0.18)'; g.fillRect(x + 2, wainY + 4, 2, wainH - 8);
    }
    // 최하단 걸레받이 (95% ~ 100%): 다크 브라운 원목/고무 걸레받이
    g.fillStyle = '#2d241c'; g.fillRect(0, N - baseH, N, baseH);
    // 세월의 흔적 (미세 롤러 입자 & 은은한 얼룩)
    for (let i = 0; i < 180; i++) {
      const rx = (Math.sin(i * 17.3) * 0.5 + 0.5) * N, ry = (Math.cos(i * 31.7) * 0.5 + 0.5) * N;
      const rad = 6 + (i % 28);
      const st = g.createRadialGradient(rx, ry, 0, rx, ry, rad);
      st.addColorStop(0, i % 2 ? 'rgba(65,58,45,0.035)' : 'rgba(255,252,242,0.03)');
      st.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = st; g.fillRect(rx - rad, ry - rad, rad * 2, rad * 2);
    }
    // 탄젠트 노멀맵 & 거칠기 맵
    const cNor = document.createElement('canvas'); cNor.width = cNor.height = N;
    const gn = cNor.getContext('2d'); gn.fillStyle = '#8080ff'; gn.fillRect(0, 0, N, N);
    gn.fillStyle = '#80c8ff'; gn.fillRect(0, railY, N, 4);
    gn.fillStyle = '#8038ff'; gn.fillRect(0, railY + railH - 4, N, 4);
    for (let x = 0; x < N; x += 32) {
      gn.fillStyle = '#5880ff'; gn.fillRect(x, wainY + 4, 2, wainH - 8);
      gn.fillStyle = '#a880ff'; gn.fillRect(x + 2, wainY + 4, 2, wainH - 8);
    }
    const cRough = document.createElement('canvas'); cRough.width = cRough.height = N;
    const gr = cRough.getContext('2d');
    gr.fillStyle = '#e0e0e0'; gr.fillRect(0, 0, N, railY); // 상단 수성페인트 무광(0.88)
    gr.fillStyle = '#787878'; gr.fillRect(0, railY, N, railH); // 원목 몰딩 반광(0.47)
    gr.fillStyle = '#969696'; gr.fillRect(0, wainY, N, wainH); // 하단 유성페인트 반광(0.58)
    gr.fillStyle = '#686868'; gr.fillRect(0, N - baseH, N, baseH);
    const wrap = cv => { const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; return t; };
    const map = wrap(cCol); map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map, normalMap: wrap(cNor), roughnessMap: wrap(cRough), normalScale: new THREE.Vector2(0.35, 0.35), roughness: 1, metalness: 0 });
  };
  const mWall = build1998SchoolWallPBR();
  // 1998년 대한민국 학교 정통 다층 3D 벽면·골조·전선관 전용 PBR 재질 세트
  const mPlaster98 = (() => {
    const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N;
    const g = cv.getContext('2d');
    g.fillStyle = '#e2dccb'; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 240; i++) {
      g.fillStyle = i % 2 ? 'rgba(255,252,244,0.06)' : 'rgba(130,120,100,0.05)';
      g.fillRect((i * 37) % N, (i * 53) % N, 6 + (i % 12), 6 + ((i * 3) % 12));
    }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.88, metalness: 0.0 });
  })();
  const mWainscot98 = (() => {
    const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N;
    const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, N);
    gr.addColorStop(0, '#969b84'); gr.addColorStop(0.5, '#8e947c'); gr.addColorStop(1, '#828870');
    g.fillStyle = gr; g.fillRect(0, 0, N, N);
    for (let x = 0; x < N; x += 16) {
      g.fillStyle = 'rgba(38,42,32,0.28)'; g.fillRect(x, 0, 2, N);
      g.fillStyle = 'rgba(235,240,222,0.14)'; g.fillRect(x + 2, 0, 1, N);
    }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.56, metalness: 0.04 });
  })();
  const mChairRail98 = new THREE.MeshStandardMaterial({ color: 0x4a2e1b, roughness: 0.42, metalness: 0.06 });
  const mBaseboard98 = new THREE.MeshStandardMaterial({ color: 0x2c241d, roughness: 0.55, metalness: 0.05 });
  const mConduit98 = new THREE.MeshStandardMaterial({ color: 0x8d9398, roughness: 0.36, metalness: 0.72 });
  const mJBox98 = new THREE.MeshStandardMaterial({ color: 0x6c7278, roughness: 0.42, metalness: 0.68 });
  const mToiletWall = P(T.pbr('wall', () => T.pbrWall()));
  const mFloorTile = P(T.pbr('tile', () => T.pbrTile()));
  const mFloorWood = P(T.pbr('wood', () => T.pbrWood()));
  const mCeil = P(T.pbr('ceil', () => T.pbrCeiling()));
  const PB = (name, gen, o = {}) => { const t = T.pbr(name, gen); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, metalness: 0, ...o }); };
  const mWood = PB('varnish', () => T.pbrVarnish(512));
  const mWoodDark = PB('varnishDark', () => T.pbrVarnish(512, [92, 58, 34]));
  const mMetal = PB('paint', () => T.pbrPaintMetal(512), { metalness: .35 });
  [mWood,mWoodDark,mMetal].forEach(m => m.normalScale.set(.25,.25));
  // 캔버스 금속 재질에 PBR 도장 금속의 노멀 · 거칠기를 덧씌워 평평한 단색 판이 실제 철판처럼 보이게 한다
  const _paint = T.pbr('paint', () => T.pbrPaintMetal(512));
  detailNormal = _paint.normalMap;
  const grunge = m => { m.normalMap = _paint.normalMap; m.roughnessMap = _paint.roughnessMap; m.normalScale = new THREE.Vector2(.6, .6); return m; };
  const mRust = PB('rust', () => T.pbrPaintMetal(256, [120, 72, 44]), { metalness: .3 });
  mRust.color.setRGB(.62, .55, .5);
  const mLocker = grunge(S(T.makeMetal([120, 134, 138]), { roughness: .55, metalness: .4 }));
  const mLockerT = S(T.makeLocker(), { roughness: 1, metalness: .35 });
  { const lk = T.pbr('locker', () => T.pbrPaintMetal(256)); mLockerT.normalMap = lk.normalMap; mLockerT.roughnessMap = lk.roughnessMap; }
  mLockerT.userData.locker = true;   // 사물함 상자: 3D 철제 캐비닛 패치(game.js)가 이 목록으로 외형을 바꾼다
  const POOL = { water: null }, DESKS = [];   // 수영장 고인 물 — 수영장 패치(game.js)가 청록 수면으로 바꾼다
  const LOCKER_BOXES = [], CHAIRS = [];   // CHAIRS: 교실 학생 의자 · 교탁 의자 (교실 리모델링 패치 — 의자에 앉기)
  const B_BOIL = { b: null, cx: 0, m: [] }, keepB = m => { m.userData.dynamic = true; B_BOIL.m.push(m); return m; };   // B1 보일러 본체 — 보일러실 패치(game.js)가 같은 자리에 녹슨 보일러로 바꾼다
  const mStep = P(T.pbr('step', () => T.pbrConcrete(512)));
  const mBooks = S(T.makeBooks());
  const mCork = S(T.makeCork());
  const mFlag = S(T.makeFlag());
  const mDoor = S(T.makeDoor(), { side: THREE.DoubleSide });
  const mDoorP = PB('door', () => T.pbrDoor(512)); mDoorP.color.setScalar(.72);   // 밝은 베이지 문짝이 손전등에 하얗게 뜨지 않게
  // 창 유리: 반투명 — 안에서 밖(달빛 · 운동장 · 맞은편 건물)이, 밖에서 안(어두운 교실)이 보인다. 먼지 · 금 간 무늬는 유리 위에 옅게
  const mWin = new THREE.MeshStandardMaterial({ color: 0xa8cce4, roughness: .08, metalness: .22, side: THREE.DoubleSide, transparent: true, opacity: .12, depthWrite: false });
  const mWinIn = new THREE.MeshStandardMaterial({ color: 0xa8cce4, roughness: .08, metalness: .22, side: THREE.DoubleSide, transparent: true, opacity: .12, depthWrite: false });
  const winAtlas = T.windowAtlasTexture || T.makeWindow();
  const winMats = Array.from({ length: 12 }, (_, i) => {
    return new THREE.MeshStandardMaterial({ roughness: .08, metalness: .24, color: 0xa8cce4, emissive: i === 9 ? 0xffdfa8 : 0x101c24, emissiveIntensity: i === 9 ? .12 : .03, transparent: true, opacity: .12, depthWrite: false, side: THREE.DoubleSide });
  });
  const WIN_W = [10, 9, 6, 4, 3, 5, 4, 5, 6, 9, 5, 4];   // 변형별 빈도 (밤에 불이 비치는 창 약 13%)
  const pickWin = () => { let r = rnd() * WIN_W.reduce((a, b) => a + b); for (let i = 0; i < 12; i++) { r -= WIN_W[i]; if (r < 0) return winMats[i]; } return winMats[0]; };
  const mWhite = S(null, { color: 0xb8b4a8 });
  const mBlack = S(null, { color: 0x0e0e10, roughness: .35, metalness: .3 });
  const mFabric = S(null, { color: 0x4a2e22, roughness: .8 });
  const mBlue = S(null, { color: 0x2d5568, roughness: .5 });
  const mGlass = new THREE.MeshStandardMaterial({ color: 0x9ec4c8, transparent: true, opacity: .28, roughness: .1 });
  const mLiquid = new THREE.MeshStandardMaterial({ color: 0x3a9a6a, transparent: true, opacity: .6, emissive: 0x0a3a20 });
  const mDirtPaper = new THREE.MeshStandardMaterial({ map: T.makePaper(), roughness: 1, side: THREE.DoubleSide });
  const mPaperN = new THREE.MeshStandardMaterial({ map: T.makePaper(), roughness: 1, emissive: 0x3a3626, side: THREE.DoubleSide });
  const mFence = S(T.makeFence());
  const mRoofRed = S(T.makeMetal([120, 50, 38]), { roughness: .8 });
  const mRoofMetal = PB('roofmetal', () => T.pbrPaintMetal(512, [120, 128, 132]), { metalness: .45 });   // 체육관 · 수영장 아치 골강판 지붕 (Poly Haven CC0)
  const mBlueMetal = PB('bluemetal', () => T.pbrPaintMetal(512, [52, 84, 120]), { metalness: .3 });     // 수영장 외벽 (Poly Haven CC0)
  // 범프 맵: 같은 텍스처의 명암으로 표면 요철을 만들어 평평한 박스가 실제 재질처럼 보이게 한다
  [[mFence, .015], [mDoor, .008]]
    .forEach(([m, k]) => { m.bumpMap = m.map; m.bumpScale = k; });

  // 레퍼런스 이미지 텍스처 (assets/img)
  const texLoader = new THREE.TextureLoader();
  const imgTex = k => { const t = texLoader.load(`assets/img/${k}.webp`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const imgMat = (k, o = {}) => new THREE.MeshStandardMaterial({ map: imgTex(k), roughness: .75, ...o });

  /* ---------- 지오메트리 도구 ---------- */
  const unit = new THREE.BoxGeometry(1, 1, 1);
  // 실제 크기에 맞춘 UV (텍스처 1장 = t 미터) — 늘어나 보이지 않게
  function uvBox(g, w, h, d, t) {
    const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / t, uv.getY(i) * dims[f][1] / t); }
    return g;
  }
  const bx = (w, h, d, x, y, z, t = 1) => { const g = uvBox(new THREE.BoxGeometry(w, h, d), w, h, d, t); g.translate(x, y, z); return g; };
  const bxF = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
  const _boxCache = new Map();
  const boxGeo = (w, h, d, full) => { const k = `${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)},${full ? 1 : 0}`; if (!_boxCache.has(k)) _boxCache.set(k, full ? new THREE.BoxGeometry(w, h, d) : uvBox(new THREE.BoxGeometry(w, h, d), w, h, d, 1)); return _boxCache.get(k); };
  function merge(list) {
    const pos = [], nor = [], uv = [], idx = []; let off = 0;
    for (const g of list) {
      const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(u.getX(i), u.getY(i)); }
      for (const k of g.index.array) idx.push(k + off);
      off += p.count;
    }
    const m = new THREE.BufferGeometry();
    m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    m.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    m.setIndex(idx); return m;
  }
  const _o = new THREE.Object3D();
  const MX = (x, y, z, ry = 0, rz = 0, rx = 0) => { _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz); _o.scale.set(1, 1, 1); _o.updateMatrix(); return _o.matrix.clone(); };
  function inst(parent, geo, mat, mats) {
    const im = new THREE.InstancedMesh(geo, mat, mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; parent.add(im); return im;
  }
  // 월드좌표 UV 타일링 박스 (벽용)
  function boxMesh(x1, x2, y1, y2, z1, z2, mat, tile = 4) {
    const w = x2 - x1, h = y2 - y1, d = z2 - z1;
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const dims = [[d, h, z1], [d, h, z1], [w, d, x1], [w, d, x1], [w, h, x1], [w, h, x1]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      const side = f !== 2 && f !== 3;
      uv.setXY(k, uv.getX(k) * dims[f][0] / tile + dims[f][2] / tile, uv.getY(k) * dims[f][1] / tile + (side ? y1 / tile : z1 / tile));
    }
    const m = new THREE.Mesh(g, mat);
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    return m;
  }
  function plane(parent, mat, w, h, x, y, z, ry = 0, rx = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); parent.add(m); return m;
  }
  function flat(parent, mat, x1, x2, z1, z2, y, tile = 4, up = true) {
    const w = x2 - x1, d = z2 - z1;
    const g = new THREE.PlaneGeometry(w, d); g.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile);
    const m = new THREE.Mesh(g, mat); m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); parent.add(m); return m;
  }

  /* ---------- 층 데이터 ---------- */
  const floors = []; const guardRoom = {}; let guardAnnex = null;
  let cur = null;
  const items = [], lockers = [], flickerMats = [], doors = []; const INFIRMARY_SLOTS = [];
  const mFacade = PB('facade', () => T.pbrFacade(512)); const mFacadeTrim = S(null, { color: 0xb6b3a5, roughness: .85 }); const mCanopy = S(null, { color: 0x37484b, roughness: .6, metalness: .15 });
  const mBase = P(T.pbr('base', () => T.pbrConcrete(1024, [104, 110, 102])));
  let curWall = mWall;
  const matLampOn = new THREE.MeshBasicMaterial({ color: 0xdfeaff });
  const matLampDead = new THREE.MeshBasicMaterial({ color: 0x2b2b28 });
  for (let i = 0; i < 4; i++) flickerMats.push(new THREE.MeshBasicMaterial({ color: 0xdfeaff }));
  const lampHousing = S(null, { color: 0x555550, roughness: .7 });
  const mSwitchPlate = S(null, { color: 0xd8d4c8, roughness: .5 }), mSwitchKey = S(null, { color: 0xeeeae0, roughness: .4 });

  // h: 윗면 높이 (점프로 올라설 수 있는 가구). 없으면 벽처럼 막힌다
  function col(x1, x2, z1, z2, wall = false, h) { const r = { x1, x2, z1, z2 }; if (h != null && !wall) r.h = h; cur.col.push(r); if (wall) cur.walls.push(r); }
  // 가구: y는 바닥 기준 하단
  function add(mat, w, h, d, x, y, z, o = {}) {
    const m = new THREE.Mesh(boxGeo(w, h, d, mat === mLockerT || !mat.map || mat.map.wrapS !== THREE.RepeatWrapping), mat); m.position.set(x, y + h / 2, z);
    if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    (o.parent || cur.interior).add(m);
    if (mat.userData.locker) { m.userData.dynamic = true; LOCKER_BOXES.push({ mesh: m, f: cur.f, w, h, d, x, y, z, ry: o.ry || 0 }); }   // 합치지 않는다 (나중에 3D 캐비닛으로 교체)
    if (o.col) { const sw = (o.ry && Math.abs(Math.sin(o.ry)) > .7) ? d : w, sd = (o.ry && Math.abs(Math.sin(o.ry)) > .7) ? w : d; col(x - sw / 2, x + sw / 2, z - sd / 2, z + sd / 2, false, y + h <= 1.25 ? y + h : undefined); }   // 낮은 가구는 올라설 수 있다
    return m;
  }
  // 다리 달린 탁자 (add 와 같은 인자 · 같은 충돌): 상판 + 테두리(에이프런) + 다리 4개 (+ 아래 선반). 통짜 나무 상자 대신 쓴다
  function tbl(mat, w, h, d, x, y, z, o = {}) {
    const t = .045, lw = o.leg || .055, inW = w / 2 - lw / 2 - .04, inD = d / 2 - lw / 2 - .04, lh = h - t;
    const top = [bx(w, t, d, 0, h - t / 2, 0), bx(w - .1, .09, .022, 0, h - t - .045, d / 2 - .06), bx(w - .1, .09, .022, 0, h - t - .045, -d / 2 + .06), bx(.022, .09, d - .1, w / 2 - .06, h - t - .045, 0), bx(.022, .09, d - .1, -w / 2 + .06, h - t - .045, 0)];
    if (o.shelf) top.push(bx(w - .12, .03, d - .12, 0, .16, 0));
    const legs = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) legs.push(bx(lw, lh, lw, sx * inW, lh / 2, sz * inD));
    if (w > 2.6) for (const sz of [-1, 1]) legs.push(bx(lw, lh, lw, 0, lh / 2, sz * inD));   // 긴 탁자는 가운데 다리 한 쌍 더
    const g = new THREE.Group(); g.position.set(x, y, z); if (o.ry) g.rotation.y = o.ry;
    g.add(new THREE.Mesh(merge(top), mat)); g.add(new THREE.Mesh(merge(legs), o.legMat || mat));
    (o.parent || cur.interior).add(g);
    if (o.col) { const sw = (o.ry && Math.abs(Math.sin(o.ry)) > .7) ? d : w, sd = (o.ry && Math.abs(Math.sin(o.ry)) > .7) ? w : d; col(x - sw / 2, x + sw / 2, z - sd / 2, z + sd / 2, false, y + h <= 1.25 ? y + h : undefined); }
    return g;
  }
  // 외벽 마감: 바깥쪽 면에 콘크리트 패널 텍스처를 덧댄다
  function facade(x1, x2, z1, z2, y1, y2) {
    if (cur.basement) return;
    const T3 = 3, mk = (w, h, px, py, pz, ry) => { const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w + (ry === 0 || ry === Math.PI ? x1 : z1)) / T3, (uv.getY(i) * h + y1) / T3); const m = new THREE.Mesh(g, mFacade); m.position.set(px, py, pz); m.rotation.y = ry; cur.shell.add(m); };
    const cy = (y1 + y2) / 2, h = y2 - y1;
    if (z2 >= 1.75) mk(x2 - x1, h, (x1 + x2) / 2, cy, z2 + .006, 0);
    if (z1 <= -9.9) mk(x2 - x1, h, (x1 + x2) / 2, cy, z1 - .006, Math.PI);
    if (x1 <= -36.3) mk(z2 - z1, h, x1 - .006, cy, (z1 + z2) / 2, -Math.PI / 2);
    if (x2 >= 36.3) mk(z2 - z1, h, x2 + .006, cy, (z1 + z2) / 2, Math.PI / 2);
  }
  function buildLayered1998Wall(targetGrp, x1, x2, z1, z2, y1, y2, mat) {
    if (mat === mBase || mat !== mWall) {
      targetGrp.add(boxMesh(x1, x2, y1, y2, z1, z2, mat));
      return;
    }
    const baseY = Math.floor((y1 + 0.05) / FH) * FH;
    const splitY = baseY + 1.12, ceilY = baseY + CH, pad = 0.012;
    if (y1 < splitY) {
      const yb = Math.min(y2, splitY);
      targetGrp.add(boxMesh(x1, x2, y1, yb, z1, z2, mWainscot98, 2));
    }
    if (y2 > splitY) {
      const ya = Math.max(y1, splitY);
      targetGrp.add(boxMesh(x1, x2, ya, y2, z1, z2, mPlaster98, 3));
    }
    // 하단 3D 걸레받이 (baseY ~ baseY + 0.095m)
    if (y1 <= baseY + 0.05 && y2 >= baseY + 0.12) {
      targetGrp.add(boxMesh(x1 - pad, x2 + pad, y1, Math.min(y2, baseY + 0.095), z1 - pad, z2 + pad, mBaseboard98, 2));
    }
    // 중단 3D 원목 허리몰딩 (Chair Rail, splitY - 0.025 ~ splitY + 0.035m)
    if (y1 <= splitY && y2 >= splitY + 0.04) {
      targetGrp.add(boxMesh(x1 - pad * 1.3, x2 + pad * 1.3, splitY - 0.025, splitY + 0.035, z1 - pad * 1.3, z2 + pad * 1.3, mChairRail98, 2));
    }
    // 상단 3D 천장 몰딩 (Crown Trim, ceilY - 0.045 ~ ceilY)
    if (y2 >= ceilY - 0.05 && y2 <= ceilY + 0.45 && y1 < ceilY - 0.1) {
      targetGrp.add(boxMesh(x1 - pad, x2 + pad, ceilY - 0.045, ceilY, z1 - pad, z2 + pad, mChairRail98, 2));
    }
  }
  function wallSeg(x1, x2, z1, z2, y1, y2, shell = false) {
    if (shell) facade(x1, x2, z1, z2, y1, y2);
    buildLayered1998Wall(shell ? cur.shell : cur.interior, x1, x2, z1, z2, y1, y2, curWall);
    if (y1 < 1) col(x1, x2, z1, z2, true);
  }
  function addNote(id, x, y, z, ry = 0) {
    if (items.some(i => i.kind === 'note' && i.id === id)) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.3, .22), mPaperN);
    m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, y + .01, z); m.userData.dynamic = true; cur.interior.add(m);
    items.push({ kind: 'note', id, floor: cur.f, pos: new THREE.Vector3(x, cur.y0 + y, z), mesh: m, title: NOTES[id].title, text: NOTES[id].text, taken: false, label: '쪽지 읽기' });
  }
  function addBattery(x, y, z) {
    const g = new THREE.Group();
    const mBlk = S(null, { color: 0x181c20, roughness: .35, metalness: .45 });
    const mGld = S(null, { color: 0xd89e28, emissive: 0x241804, roughness: .28, metalness: .78 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.036, .036, .11, 14), mBlk); body.rotation.z = Math.PI / 2; body.position.x = -.02; g.add(body);
    const capG = new THREE.Mesh(new THREE.CylinderGeometry(.0365, .0365, .05, 14), mGld); capG.rotation.z = Math.PI / 2; capG.position.x = .055; g.add(capG);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(.034, .034, .012, 12), mChrome); ring.rotation.z = Math.PI / 2; ring.position.x = -.078; g.add(ring);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .024, 10), mChrome); tip.rotation.z = Math.PI / 2; tip.position.x = .09; g.add(tip);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexG, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
    sp.scale.set(.68, .68, .68); g.add(sp);
    g.position.set(x, y + .1, z); g.userData.dynamic = true; cur.interior.add(g);
    items.push({ kind: 'battery', floor: cur.f, pos: new THREE.Vector3(x, cur.y0 + y + .1, z), mesh: g, taken: false, label: '건전지 줍기', baseY: y + .1 });
  }
  function addMedkit(x, y, z) {
    const g = new THREE.Group();
    const mCase = S(null, { color: 0xedeae2, roughness: .42, metalness: .08 });
    const red = S(null, { color: 0xc82222, emissive: 0x280404, roughness: .38 });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(.30, .18, .11), mCase));
    const rim = new THREE.Mesh(new THREE.BoxGeometry(.31, .02, .12), mChrome); g.add(rim);
    [-0.09, 0.09].forEach(lx => { const lt = new THREE.Mesh(new THREE.BoxGeometry(.028, .045, .125), mChrome); lt.position.set(lx, .06, 0); g.add(lt); });
    const hdl = new THREE.Mesh(new THREE.BoxGeometry(.11, .025, .03), mDarkMetal); hdl.position.set(0, .105, 0); g.add(hdl);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(.14, .042, .118), red));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(.042, .13, .118), red));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexR, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.set(.78, .78, .78); g.add(sp);
    g.position.set(x, y + .12, z); g.userData.dynamic = true; cur.interior.add(g);
    items.push({ kind: 'medkit', floor: cur.f, pos: new THREE.Vector3(x, cur.y0 + y + .12, z), mesh: g, taken: false, label: '응급 구급상자 줍기', baseY: y + .12 });
  }
  const glowTexR = T.makeGlow('255,90,90');
  const glowTexY = T.makeGlow('255,200,90'), glowTexG = T.makeGlow('90,255,140');
  function addKey(id, idx, x, y, z) {
    const g = new THREE.Group();
    const gold = S(null, { color: 0xe0b44a, emissive: 0x6a4a10, roughness: .35, metalness: .7 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.05, .014, 8, 16), gold); ring.position.x = -.08; g.add(ring);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(.18, .02, .02), gold); g.add(shaft);
    [.05, .08].forEach(px => { const t = new THREE.Mesh(new THREE.BoxGeometry(.015, .05, .02), gold); t.position.set(px, -.03, 0); g.add(t); });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexY, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.set(1.2, 1.2, 1.2); g.add(sp);
    g.position.set(x, y + .12, z); g.userData.dynamic = true; cur.interior.add(g);
    items.push({ kind: 'key', idx, floor: cur.f, pos: new THREE.Vector3(x, cur.y0 + y + .12, z), mesh: g, taken: false, label: `학교 비밀 증거 조각 확보하기 (${KEY_NAMES[idx]})`, baseY: y + .12 });
  }
  function papers(cx, z1, z2, n, spread = 3.4) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(.28, .2), mDirtPaper);
      m.rotation.set(-Math.PI / 2, 0, rnd() * 6.28); m.position.set(cx + rr(-spread, spread), .015 + rnd() * .01, rr(z1, z2)); cur.interior.add(m);
    }
  }

  /* ---------- 학생 책상/의자 (인스턴싱) ---------- */
  // 튜브(파이프) 지오메트리: 두 점 사이 원기둥
  const tube_ = (x1, y1, z1, x2, y2, z2) => tube(.006, x1, y1, z1, x2, y2, z2);
  const tube = (r, x1, y1, z1, x2, y2, z2) => {
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1, L = Math.hypot(dx, dy, dz);
    const g = new THREE.CylinderGeometry(r, r, L, 6); g.translate(0, L / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / L, dy / L, dz / L));
    g.applyQuaternion(q); g.translate(x1, y1, z1); return g;
  };
  // 학생 책상: 원점 = 책상 바닥 중심, 학생은 +z 쪽에 앉아 -z(칠판)를 본다
  const deskTopG = merge([bx(.68, .03, .48, 0, .735, 0), bx(.68, .012, .02, 0, .713, .23), bx(.68, .012, .02, 0, .713, -.23)]);
  const deskLegG = merge([
    ...[[-.31, -.21], [.31, -.21], [-.31, .21], [.31, .21]].map(([x, z]) => tube(.014, x, 0, z, x, .72, z)),
    tube(.012, -.31, .1, -.21, -.31, .1, .21), tube(.012, .31, .1, -.21, .31, .1, .21), tube(.012, -.31, .1, 0, .31, .1, 0),
    bx(.6, .012, .36, 0, .6, -.02), bx(.6, .12, .012, 0, .66, -.2), bx(.012, .12, .36, -.3, .66, -.02), bx(.012, .12, .36, .3, .66, -.02),
  ]);
  // 학생 의자: 원점 = 의자 바닥 중심, 등받이는 +z
  const seatG = merge([bx(.38, .022, .36, 0, .435, 0), bx(.38, .17, .018, 0, .72, .19)]);
  const chairLegG = merge([
    tube(.012, -.17, 0, -.16, -.17, .43, -.16), tube(.012, .17, 0, -.16, .17, .43, -.16),
    tube(.012, -.17, 0, .16, -.17, .82, .19), tube(.012, .17, 0, .16, .17, .82, .19),
    tube(.01, -.17, .12, -.16, -.17, .12, .16), tube(.01, .17, .12, -.16, .17, .12, .16), tube(.01, -.17, .43, -.16, .17, .43, -.16),
  ]);
  // V4 실사 모델 (사용자 제작 지시서 R02-01 책상 · R02-02 의자 · R02-03 교탁, Blender 제작 · Poly Haven CC0 2K PBR + AO): 일반 교실 전부 — ?v4=0 이면 예전 절차 가구
  const V4_PILOT = !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('v4') === '0');
  function deskGrid(cx, offs, rows, miss = .15, v4 = false, o = {}) {
    const tops = [], legs = [], seats = [], cl = [], keep = o.keep || [], knock = o.knock ?? .1;
    for (const dx of offs) for (const z of rows) {
      if (rnd() < miss && !keep.some(([kx, kz]) => Math.abs(kx - cx - dx) < .5 && Math.abs(kz - z) < .4)) continue;   // keep: 위에 소품이 놓인 책상은 빼지 않는다
      const x = cx + dx + rr(-.05, .05), ry = rr(-.06, .06);
      if (v4) model('v4_R02-01', x, 0, z, ry); else { tops.push(MX(x, 0, z, ry)); legs.push(MX(x, 0, z, ry)); }
      DESKS.push({ f: cur.f, x, z, top: v4 ? .73 : .76 });   /* 책상 위 소품을 실제 책상 위로 맞추는 데 쓴다 */
      col(x - .35, x + .35, z - .25, z + .25, false, v4 ? .73 : .76);   // 책상 윗면 — 점프로 올라설 수 있다
      const r = rnd();
      if (r < knock) { const px = x + rr(-.1, .1), pry = rr(-1, 1); if (v4) model('v4_R02-02', px, .218, z + .62, pry, { rz: Math.PI / 2 }); else { const m = MX(px, .2, z + .62, pry, Math.PI / 2); seats.push(m); cl.push(m); } }   // 옆으로 쓰러진 의자 (통로를 막지 않게 충돌 없음)
      else if (r < .85) { const tidy = o.tidy, px = x + rr(-.08, .08), pz = z + (tidy ? .38 : .5 + rr(-.05, .2)), pry = tidy ? rr(-.05, .05) : rr(-.35, .35); if (v4) model('v4_R02-02', px, 0, pz, pry); else { const m = MX(px, 0, pz, pry); seats.push(m); cl.push(m); } CHAIRS.push({ f: cur.f, x: px, z: pz, ry: pry, room: o.room }); }
    }
    if (!tops.length && !v4) return;
    if (tops.length) { inst(cur.interior, deskTopG, mWood, tops); inst(cur.interior, deskLegG, mMetal, legs); }
    if (seats.length) { inst(cur.interior, seatG, mWood, seats); inst(cur.interior, chairLegG, mMetal, cl); }
    for (const dx of [-1.5, 0, 1.5]) for (const z of rows) if (rnd() < .14) backpack(cx + dx + .54 * (dx < 0 ? -1 : 1), z - .02, rnd() * 6, false);
  }

  /* ---------- 디테일 소품 (3D) ---------- */
  const mFrame = grunge(S(T.makeMetal([150, 158, 150]), { roughness: .6, metalness: .3 }));
  const mPorc = new THREE.MeshStandardMaterial({ color: 0xc8c4b8, roughness: .25, metalness: .05 });
  const mChrome = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: .25, metalness: .9 });
  const mCloth = S(T.makeDress(), { color: 0x8a8068, side: THREE.DoubleSide, alphaTest: .4 });
  const mGreenSign = new THREE.MeshBasicMaterial({ map: T.makeSign('비 상 구', '#0a3a1a', '#7dffa0', 30) });
  const glowGreen = T.makeGlow('80,255,140');
  const dyn = o => { o.userData.dynamic = true; return o; };
  const meshAt = (geo, mat, x, y, z, ry = 0, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; (parent || cur.interior).add(m); return m; };

  // 3D 창문: 텍스처 유리 + 실제 창틀/중간살/창턱
  function win3D(parent, w, h, x, y, z, ry = 0, outMat = null) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(w - .06, h - .06), outMat || mWin));
    const bars = [
      bx(.07, h + .04, .14, -w / 2, 0, 0), bx(.07, h + .04, .14, w / 2, 0, 0),
      bx(w + .06, .07, .14, 0, -h / 2, 0), bx(w + .06, .07, .14, 0, h / 2, 0),
      bx(.045, h - .04, .09, 0, 0, .015),
      bx(.035, h - .04, .06, -w / 4, 0, -.01), bx(.035, h - .04, .06, w / 4, 0, .01),
      bx(w - .04, .04, .08, 0, -h * .18, 0),
      bx(w + .18, .06, .26, 0, -h / 2 - .05, .05)
    ];
    g.add(new THREE.Mesh(merge(bars), mFrame));
    return g;
  }
  // 라디에이터 (1m 기준, x 로 늘림)
  const radG = merge([...Array.from({ length: 12 }, (_, i) => bx(.035, .55, .1, -.46 + i * .084, .32, 0)), tube(.022, -.5, .1, 0, .5, .1, 0), tube(.022, -.5, .56, 0, .5, .56, 0), tube(.015, -.5, .05, 0, -.5, .1, 0), tube(.015, .5, .05, 0, .5, .1, 0)]);
  const mRad = grunge(S(T.makeMetal([168, 162, 140]), { roughness: .7, metalness: .25 }));
  function radiator(x, z, ry, len = 1) { const m = meshAt(radG, mRad, x, 0, z, ry); m.scale.x = len; }
  // 천장 선풍기
  const fanG = merge([new THREE.CylinderGeometry(.02, .02, .35, 6).translate(0, -.175, 0), new THREE.CylinderGeometry(.11, .13, .12, 14).translate(0, -.4, 0),
    ...[0, 2.09, 4.19].map(a => bx(.62, .012, .11, .38, -.43, 0).rotateY(a))]);
  function fan(x, z) { model('ceiling_fan', x, CH, z, rnd() * 6, { rz: rnd() < .3 ? rr(.05, .14) : 0 }); }
  // 커튼 (주름 + 찢어진 밑단)
  function curtain(x, y, z, w, h, ry = 0) {
    const g = new THREE.PlaneGeometry(w, h, 10, 6), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 22) * .035 + Math.sin(p.getY(i) * 3) * .01);
    g.computeVertexNormals(); meshAt(g, mCloth, x, y, z, ry);
  }
  // 교사용 책상
  function teacherDesk(x, z) {
    const parts = [bx(1.36, .04, .7, 0, .74, 0), bx(.42, .72, .64, -.45, .36, 0), bx(.03, .72, .64, .66, .36, 0), bx(1.3, .45, .02, 0, .45, .32)];
    meshAt(merge(parts), mWood, x, 0, z);
    const fr = []; for (let i = 0; i < 3; i++) fr.push(bx(.38, .2, .015, -.45, .14 + i * .23, -.33), bx(.12, .02, .03, -.45, .2 + i * .23, -.35));
    meshAt(merge(fr), mWoodDark, x, 0, z);
    col(x - .7, x + .7, z - .36, z + .36);
    add(mBlack, .4, .04, .4, x, .44, z + .75); add(mMetal, .04, .44, .04, x, 0, z + .75);
  }
  // 교탁
  function lectern(x, z) {
    if (V4_PILOT) { model('v4_R02-03', x, 0, z, 0); col(x - .6, x + .6, z - .3, z + .3); return; }   // V4 교탁 1.2 × 0.6 × 0.85
    meshAt(merge([bx(.62, .88, .46, 0, .44, 0), bx(.5, .02, .4, 0, .55, .02)]), mWood, x, 0, z);
    const top = meshAt(new THREE.BoxGeometry(.72, .04, .56), mWoodDark, x, 1.0, z + .02); top.rotation.x = .18;
    col(x - .36, x + .36, z - .28, z + .28);
  }
  // 칠판 프레임 + 분필/지우개
  function boardDetail(cx, zN) {
    meshAt(merge([bx(4.08, .055, .065, 0, 2.44, 0), bx(4.08, .055, .065, 0, 1.17, 0), bx(.055, 1.32, .065, -2.01, 1.805, 0), bx(.055, 1.32, .065, 2.01, 1.805, 0)]), mFrame, cx, 0, zN + .072);
    ['#eee', '#e8d060', '#d05050', '#78c8f0'].forEach((c, i) => { const ch = meshAt(new THREE.CylinderGeometry(.007, .007, .075, 8), S(null, { color: c }), cx - 1.1 + i * .14, 1.195, zN + .135); ch.rotation.z = Math.PI / 2; });
    meshAt(new THREE.BoxGeometry(.14, .04, .055), mFabric, cx + .95, 1.20, zN + .135);
  }
  // 쓰레기통
  function bin(x, z) { meshAt(merge([new THREE.CylinderGeometry(.19, .15, .48, 14, 1, true).translate(0, .24, 0), new THREE.CircleGeometry(.15, 14).rotateX(-Math.PI / 2).translate(0, .01, 0)]), mBlue, x, 0, z); }
  // 실제 3D 책장: 프레임 + 인스턴스 책 (층마다 하나의 InstancedMesh 로 합침)
  const bookColors = [0x6a2a22, 0x2f4a3a, 0x2a3a58, 0x7a6a3e, 0x4a3a2a, 0x8a8a7a, 0x4a2a48, 0x2a2a2a, 0x8a4a2a, 0x3a5a6a];
  function shelf3D(x, z, ry, w, h, d, rows = 5, fill = .85) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; cur.interior.add(g);
    const sp = (h - .08) / rows, parts = [bx(.03, h, d, -w / 2, h / 2, 0), bx(.03, h, d, w / 2, h / 2, 0), bx(w, .03, d, 0, h, 0), bx(w, .015, d, 0, h / 2, -d / 2 + .008)];
    for (let r = 0; r <= rows; r++) parts.push(bx(w, .025, d, 0, .05 + r * sp, 0));
    g.add(new THREE.Mesh(merge(parts), mWoodDark));
    g.updateMatrix();
    const wm = g.matrix.clone(), col2 = new THREE.Color(), loc = new THREE.Object3D();
    for (let r = 0; r < rows; r++) {
      let px = -w / 2 + .03;
      while (px < w / 2 - .06) {
        const bw = rr(.025, .065); if (rnd() > fill) { px += rr(.05, .2); continue; }
        const bh = rr(sp * .55, sp - .04), bd = rr(d * .6, d * .9), lean = rnd() < .08 ? rr(-.35, .35) : 0;
        loc.position.set(px + bw / 2, .06 + r * sp + bh / 2, d / 2 - bd / 2 - .01); loc.rotation.set(0, 0, lean); loc.scale.set(bw, bh, bd); loc.updateMatrix();
        (cur.books ||= []).push({ m: new THREE.Matrix4().multiplyMatrices(wm, loc.matrix), c: col2.setHex(pick(bookColors)).multiplyScalar(rr(.6, 1.15)).clone() });
        px += bw + rr(0, .006);
      }
    }
    const s = Math.abs(Math.sin(ry)) > .7; const hw = (s ? d : w) / 2, hd = (s ? w : d) / 2;
    col(x - hw, x + hw, z - hd, z + hd);
    return g;
  }
  function scatterBooks(x, z, n) { const loc = new THREE.Object3D(); for (let i = 0; i < n; i++) { loc.position.set(x + rr(-.6, .6), .02, z + rr(-.5, .5)); loc.rotation.set(0, rnd() * 6, Math.PI / 2 * (rnd() < .5 ? 1 : 0)); loc.scale.set(.04, rr(.18, .26), rr(.13, .18)); loc.position.y = loc.rotation.z ? .02 : .1; loc.updateMatrix(); (cur.books ||= []).push({ m: loc.matrix.clone(), c: new THREE.Color(pick(bookColors)) }); } }
  // 변기 / 소변기 / 세면대
  const toiletG = merge([new THREE.LatheGeometry([[.0, 0], [.12, 0], [.14, .2], [.2, .36], [.21, .4], [.15, .41]].map(p => new THREE.Vector2(p[0], p[1])), 16).scale(1, 1, 1.3), bx(.4, .38, .17, 0, .58, -.27)]);
  function toiletAt(x, z) { meshAt(toiletG, mPorc, x, 0, z); col(x - .22, x + .22, z - .38, z + .28); }
  const urinalG = merge([new THREE.SphereGeometry(.2, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1.8, .7).translate(0, .75, .02), tube(.012, 0, 1.15, -.02, 0, 1.4, -.02)]);
  // 비상구 표시등
  function exitSign(x, y, z, ry = 0) { model('sf_exit_sign', x, y - .1, z, ry); const m = new THREE.Group(); m.position.set(x, y, z); m.rotation.y = ry; cur.interior.add(m); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowGreen, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .58 })); sp.scale.set(.95, .52, 1); sp.position.z = .1; m.add(sp); }
  // 소화기
  const extG = merge([new THREE.CylinderGeometry(.075, .075, .45, 12).translate(0, .225, 0), new THREE.CylinderGeometry(.03, .04, .08, 8).translate(0, .485, 0), tube(.01, 0, .505, 0, .08, .425, .04)]);   /* 바닥에 닿게 (예전엔 7.5cm 떠 있었다) */
  function extinguisher(x, z) { meshAt(extG, S(null, { color: 0xa01818, roughness: .4, metalness: .2 }), x, 0, z); }
  // 천장 손상: 빠진 타일 구멍, 떨어진 타일, 늘어진 전선
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  function ceilingDamage(x1, x2, z1, z2, n) {
    // 공중과 바닥에 깨진 사각 블록처럼 떠 있던 천장 타일 파편들을 제거하고 깔끔한 천장 마감 유지
  }
  const pipeMat = S(T.makeMetal([96, 104, 98]), { roughness: .6, metalness: .4 });
  // 실사 스캔 소품 (Poly Haven CC0, assets/models) — 배치만 기록하고 game.js 가 인스턴싱으로 불러온다
  const MODELS = [];
  const CCTV_CAMERAS = [];
  function model(name, x, y, z, ry = 0, o = {}) {
    MODELS.push({ model: name, f: o.out ? 'out' : cur.f, x, y, z, ry, rx: o.rx || 0, rz: o.rz || 0, s: o.s || 1 });
    if (o.col) { const [w, d] = o.col, sw = Math.abs(Math.sin(ry)) > .7; const hw = (sw ? d : w) / 2, hd = (sw ? w : d) / 2; o.out ? col(x - hw, x + hw, z - hd, z + hd) : col(x - hw, x + hw, z - hd, z + hd); }
  }
  // 비상 조명등 (복도 벽 위): 정전 · 전압 강하 때 두 개의 등이 켜진다 — 재질 · 빛무리는 공유해서 한 번에 켜고 끈다
  const matEmBox = S(null, { color: 0xd8d4c4, roughness: .6 }), matEmHead = new THREE.MeshBasicMaterial({ color: 0x2a2a26 });
  const spEm = new THREE.SpriteMaterial({ map: T.makeGlow('255,236,200'), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const matEmLed = new THREE.MeshBasicMaterial({ color: 0x30ff60 });
  function emergLight(x, y, z, ry = 0) {
    const g = dyn(new THREE.Group()); g.position.set(x, y, z); g.rotation.y = ry; cur.interior.add(g);
    const bxm = new THREE.Mesh(new THREE.BoxGeometry(.34, .14, .1), matEmBox); bxm.position.z = .05; g.add(bxm);
    const led = new THREE.Mesh(new THREE.BoxGeometry(.02, .02, .01), matEmLed); led.position.set(.12, .02, .105); g.add(led);
    [-.12, .12].forEach(dx => { const h = new THREE.Mesh(new THREE.SphereGeometry(.055, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), matEmHead); h.rotation.x = Math.PI / 2 + .5; h.position.set(dx, -.1, .12); g.add(h);
      const sp = new THREE.Sprite(spEm); sp.scale.set(.8, .8, .8); sp.position.set(dx, -.14, .2); g.add(sp); });
  }
  function corridorPipes(x1, x2) {
    const p = [tube(.055, x1, CH - .16, 1.25, x2, CH - .16, 1.25), tube(.032, x1, CH - .12, 1.05, x2, CH - .12, 1.05)];
    for (let x = x1 + 2; x < x2; x += 4) p.push(bx(.04, .16, .3, x, CH - .08, 1.15));
    cur.interior.add(new THREE.Mesh(merge(p), pipeMat));

    // 1998년 학교 복도 노출 강제 전선관(Conduit) 주 간선 회로망 & 분기 정션박스(Junction Box) & 새들 클램프
    const condGeo = [], jboxGeo = [];
    for (const wz of [-1.435, 1.435]) {
      // 상단 2열 수평 주 간선 전선관 (전등 회로 3.18m / 비상·통신 회로 3.26m)
      condGeo.push(
        tube(.011, x1 + .2, 3.18, wz, x2 - .2, 3.18, wz),
        tube(.009, x1 + .2, 3.26, wz, x2 - .2, 3.26, wz)
      );
      // 2.0m 간격 전선관 고정 새들 클램프 (Saddle Clamp)
      for (let x = x1 + 1.5; x < x2 - 0.5; x += 2.0) {
        condGeo.push(bx(.024, .14, .026, x, 3.22, wz));
      }
      // 8m 슬롯마다 8각 금속 분기 정션박스 (Junction Box) + 천장 형광등 인입 배선관
      for (let x = x1 + 4; x <= x2 - 4; x += 8) {
        jboxGeo.push(
          bx(.11, .11, .042, x + 1.4, 3.18, wz),
          bx(.09, .09, .038, x - 1.4, 3.22, wz)
        );
        // 정션박스 -> 복도 중앙 천장 형광등으로 이어지는 천장 횡단 전선관
        if (wz < 0) {
          condGeo.push(
            tube(.008, x + 1.4, 3.18, wz, x + 1.4, CH - .02, wz),
            tube(.008, x + 1.4, CH - .02, wz, x + 1.4, CH - .02, 0),
            tube(.008, x + 1.4, CH - .02, 0, x, CH - .02, 0)
          );
        }
      }
    }
    if (condGeo.length) cur.interior.add(new THREE.Mesh(merge(condGeo), mConduit98));
    if (jboxGeo.length) cur.interior.add(new THREE.Mesh(merge(jboxGeo), mJBox98));

    // 1998년 철근콘크리트(RC) 라멘조 학교 골조: 슬롯 경계마다 복도 기둥(Pilaster) & 천장 가로보(Cross Beam) 시공
    const beamGeo = [], pilUpper = [], pilLower = [], pilTrim = [];
    for (let x = x1 + 8; x <= x2 - 8; x += 8) {
      // 천장 가로보 (폭 0.22m, 높이 0.16m, 복도 횡단 -1.45 ~ 1.45)
      beamGeo.push(bx(.22, .16, 2.90, x, CH - .08, 0));
      for (const pz of [-1.45, 1.45]) {
        pilLower.push(bx(.24, 1.12, .08, x, 0.56, pz));
        pilUpper.push(bx(.24, CH - 1.12, .08, x, 1.12 + (CH - 1.12) / 2, pz));
        pilTrim.push(bx(.26, .06, .10, x, 1.125, pz), bx(.26, .095, .10, x, 0.0475, pz));
      }
    }
    if (beamGeo.length) cur.interior.add(new THREE.Mesh(merge(beamGeo), curWall === mBase ? mBase : mPlaster98));
    if (pilLower.length && curWall !== mBase) {
      cur.interior.add(
        new THREE.Mesh(merge(pilLower), mWainscot98),
        new THREE.Mesh(merge(pilUpper), mPlaster98),
        new THREE.Mesh(merge(pilTrim), mChairRail98)
      );
    }
  }
  function graffiti(text, x, y, z, ry = 0, w = 2.4) { const m = new THREE.MeshBasicMaterial({ map: T.makeGraffiti(text), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); plane(cur.interior, m, w, w / 4, x, y, z, ry); }

  const mPiano = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: .18, metalness: .2 });
  const mPianoLid = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: .18, metalness: .2, side: THREE.DoubleSide });
  function grandPiano(x, z) {
    const sh = new THREE.Shape(); sh.moveTo(-.75, 0); sh.lineTo(.75, 0); sh.lineTo(.75, -.9); sh.bezierCurveTo(.75, -1.6, .2, -1.4, .05, -1.9); sh.bezierCurveTo(-.1, -2.2, -.75, -2.2, -.75, -1.6); sh.lineTo(-.75, 0);
    const body = new THREE.ExtrudeGeometry(sh, { depth: .32, bevelEnabled: true, bevelSize: .015, bevelThickness: .015, bevelSegments: 2, curveSegments: 18 });
    body.rotateX(Math.PI / 2); body.translate(0, .98, .85);
    const lidG = new THREE.ShapeGeometry(sh, 18); lidG.rotateX(Math.PI / 2); lidG.translate(.75, 0, 0);
    const g = new THREE.Group(); g.position.set(x, 0, z); cur.interior.add(g);
    g.add(new THREE.Mesh(body, mPiano));
    const lid = new THREE.Mesh(lidG, mPianoLid); lid.position.set(-.75, 1.0, .85); lid.rotation.z = .62; g.add(lid);
    g.add(new THREE.Mesh(merge([tube(.04, -.6, 0, .7, -.6, .66, .7), tube(.04, .6, 0, .7, .6, .66, .7), tube(.04, -.2, 0, -1.6, -.2, .66, -1.6), tube(.015, .62, .99, -.4, .62, 1.75, -.4)]), mPiano));
    const keys = [bx(1.36, .03, .16, 0, .9, .95)], blacks = [];
    for (let i = 0; i < 26; i++) keys.push(bx(.048, .012, .15, -.65 + i * .052, .915, .95));
    for (let i = 0; i < 25; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) blacks.push(bx(.028, .03, .09, -.624 + i * .052, .93, .92));
    g.add(new THREE.Mesh(merge(keys), mPorc)); g.add(new THREE.Mesh(merge(blacks), mPiano));
    g.add(new THREE.Mesh(bx(1.4, .1, .2, 0, .86, .97), mPiano));
    g.add(new THREE.Mesh(merge([bx(.8, .05, .35, 0, .45, 1.55), tube(.025, -.35, 0, 1.45, -.35, .45, 1.45), tube(.025, .35, 0, 1.45, .35, .45, 1.45), tube(.025, -.35, 0, 1.65, -.35, .45, 1.65), tube(.025, .35, 0, 1.65, .35, .45, 1.65)]), mPiano));
    col(x - .78, x + .78, z - 1.4, z + 1.05);
  }
  const boardRefs = {};

  /* ---------- 시트 2차: 상호작용 오브젝트 · 소품 ---------- */
  const TAPES = {
    tape1: { title: '녹음 테이프 — 보건교사 임소연 선생님', spk: '보건교사 임소연', fx: 'radio' },
    tape2: { title: '녹음 테이프 — 방송부 민아 선배', spk: '선배 박민아', fx: 'radio' },
    tape3: { title: '녹음 테이프 — 교무부장 권오현 (5인 은폐 회의)', spk: '교무부장 권오현', fx: 'radio' },
    tape4: { title: '녹음 테이프 — 3-2 윤하늘 하교 방송 리허설', spk: '3-2 윤하늘', fx: 'radio' },
    tape5: { title: '녹음 테이프 — 교무부장의 마지막 참회록', spk: '교무부장 권오현', fx: 'radio' },
    tape_homeroom: { title: '녹음 테이프 — 3-2 담임 정은수 선생님', spk: '3-2 담임 정은수', fx: 'radio', minSh: 0 },
    tape_science: { title: '녹음 테이프 — 과학부장 최동혁 선생님', spk: '과학부장 최동혁', fx: 'radio', minSh: 0 },
    tape_pe: { title: '녹음 테이프 — 체육부장 강태식 선생님 (기록석)', spk: '체육부장 강태식', fx: 'radio', minSh: 0 },
    // 2008년 민아가 모은 증언 카세트 — 서로 엇갈리는 진술을 맞춰 보며 가설을 검증한다
    ts_junho: { title: '증언 카세트 — 방송부 3학년 이준호 (2008 인터뷰)', spk: '이준호 (전 방송부 3학년)', fx: 'radio', minSh: 0 },
    ts_snack: { title: '증언 카세트 — 학우매점 아주머니', spk: '매점 아주머니 최순덕', fx: 'radio', minSh: 0 },
    ts_snack2: { title: '증언 카세트 — 매점 외상 장부', spk: '매점 아주머니 최순덕', fx: 'radio', minSh: 0 },
    ts_cook: { title: '증언 카세트 — 급식실 조리실장', spk: '조리실장 하정숙', fx: 'radio', minSh: 0 },
    ts_music: { title: '증언 카세트 — 음악교사 윤서경', spk: '음악교사 윤서경', fx: 'radio', minSh: 0 },
    ts_art: { title: '증언 카세트 — 미술교사 박정우', spk: '미술교사 박정우', fx: 'radio', minSh: 0 },
    ts_janitor: { title: '증언 카세트 — 청소 담당 김순례', spk: '환경미화원 김순례', fx: 'radio', minSh: 0 },
    ts_paramedic: { title: '증언 카세트 — 서문소방서 구급대 출동 기록', spk: '구급대원 오석진', fx: 'radio', minSh: 0 },
    ts_mother: { title: '증언 카세트 — 윤하늘 어머니', spk: '윤하늘 어머니', fx: 'radio', minSh: 0 },
    ts_vice: { title: '증언 카세트 — 교감 노태수 (취재 녹취)', spk: '교감 노태수', fx: 'radio', minSh: 0 },
    ts_dorm: { title: '증언 카세트 — 청운학사 사감 선생님', spk: '청운학사 사감 문정희', fx: 'radio', minSh: 0 },
    ts_lib2: { title: '증언 카세트 — 중앙학술정보관 사서 (2008)', spk: '대도서관 사서 정미란', fx: 'radio', minSh: 0 },
    ts_astro: { title: '증언 카세트 — 과학천문관 지도교사', spk: '천문부 지도교사 서재훈', fx: 'radio', minSh: 0 },
    ts_history: { title: '증언 카세트 — 역사관 전시 관리인', spk: '역사관 관리인 최만석', fx: 'radio', minSh: 0 },
    ts_union: { title: '증언 카세트 — 2008 학생회장 인터뷰', spk: '2008 학생회장 한유리', fx: 'radio', minSh: 0 },
    ts_auditor: { title: '증언 카세트 — 대강당 음향 담당 (1998)', spk: '방송부 음향 담당 이준호', fx: 'radio', minSh: 0 },
    ts_lake: { title: '증언 카세트 — 호심정 산책하던 주민', spk: '인근 주민 송경자', fx: 'radio', minSh: 0 },
    ts_pool2: { title: '증언 카세트 — 수영부 코치 (기계실 기록)', spk: '수영부 코치 강태식', fx: 'radio', minSh: 0 },
    ts_bunker: { title: '증언 카세트 — 방공호 서고 봉인 기록', spk: '교무부장 권오현 (봉인 녹취)', fx: 'radio', minSh: 0 },
    ts_incin: { title: '증언 카세트 — 소각장 용역 기사', spk: '소각장 용역 기사 김덕배', fx: 'radio', minSh: 0 },
    ts_green: { title: '증언 카세트 — 생물부 후배의 고백', spk: '생물부 1학년 오세린', fx: 'radio', minSh: 0 },
    ts_electric: { title: '증언 카세트 — 학교 전기 기사', spk: '전기 기사 배만수', fx: 'radio', minSh: 0 },
    ts_pe2: { title: '증언 카세트 — 체육부장 강태식 (두 번째 테이프)', spk: '체육부장 강태식', fx: 'radio', minSh: 0 },
    ts_reporter2: { title: '증언 카세트 — 서문일보 한진우 기자', spk: '서문일보 기자 한진우', fx: 'radio', minSh: 0 },
    gd_radio1: { title: '경비 무전 교신 ① 22:15 — 펌프실 쪽 철문 두드리는 소리', spk: '당직 경비원 박종철', fx: 'radio' },
    gd_radio2: { title: '경비 무전 교신 ② 23:05 — “아침에 열라고유?”', spk: '당직 경비원 박종철', fx: 'radio' },
    gd_radio3: { title: '경비 무전 교신 ③ 23:20 — 정전, 지하의 소리가 멎다', spk: '당직 경비원 박종철', fx: 'radio' },
    gd_log1: { title: '경비 근무 일지 — 1998.10.12 (교대 기록)', spk: '당직 경비원 박종철', fx: 'none' },
    gd_log2: { title: '경비 근무 일지 — 1998.10.13 새벽 (찢으라던 장)', spk: '당직 경비원 박종철', fx: 'none' },
    gd_log3: { title: '경비 근무 일지 — 1999.2 마지막 근무', spk: '당직 경비원 박종철', fx: 'none' },
    ts_guard: { title: '증언 카세트 — 전 당직 경비원 박종철 (2008, 민아 녹음)', spk: '전 경비원 박종철', fx: 'radio', minSh: 0 },
    ts_mina: { title: '증언 카세트 — 민아의 취재 녹음 (셋째 날)', spk: '선배 박민아', fx: 'radio', minSh: 0 },
    tape_librarian: { title: '녹음 테이프 — 방송부 후배 서다은의 눈물의 참회록', spk: '방송부 2학년 서다은', fx: 'radio', minSh: 0 },
    tape_counselor: { title: '녹음 테이프 — 상담교사 오유진 선생님', spk: '상담교사 오유진', fx: 'radio', minSh: 0 },
  };
  const mTape = S(null, { color: 0x2a2a2c, roughness: .5, metalness: .3 });
  function tapeRecorder(id, x, y, z, ry = 0) {
    if (props.some(p => p.kind === 'tape' && p.id === id)) return;   // 같은 방 빌더가 여러 층에서 돌아도 증언 테이프는 하나만
    const g = dyn(new THREE.Group()); g.position.set(x, y, z); g.rotation.y = ry; cur.interior.add(g);
    g.add(new THREE.Mesh(merge([bx(.26, .07, .15, 0, .035, 0), bx(.035, .015, .025, .09, .075, .05)]), mTape));
    const playBtn = dyn(new THREE.Mesh(new THREE.BoxGeometry(.038, .018, .026), S(null, { color: 0xb83228, roughness: .4 })));
    playBtn.position.set(.045, .076, .05); g.add(playBtn);
    const win = new THREE.Mesh(new THREE.BoxGeometry(.12, .005, .075), new THREE.MeshStandardMaterial({ color: 0x4a3e2d, roughness: .25 })); win.position.set(-.045, .072, -.01); g.add(win);
    const mkReel = rx => {
      const r = dyn(new THREE.Group()); r.position.set(rx, .076, -.01);
      r.add(new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .006, 12), mWhite));
      r.add(new THREE.Mesh(new THREE.BoxGeometry(.038, .008, .006), mDarkMetal));
      r.add(new THREE.Mesh(new THREE.BoxGeometry(.006, .008, .038), mDarkMetal));
      g.add(r); return r;
    };
    const reelL = mkReel(-.075), reelR = mkReel(-.015);
    const led = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowRed, blending: THREE.AdditiveBlending, depthWrite: false })); led.scale.setScalar(.12); led.position.set(.11, .08, .07); g.add(led);
    props.push({ kind: 'tape', id, floor: cur.f, x, z, y, label: '녹음기 재생', ...TAPES[id], anim: { type: 'tape', g, reelL, reelR, playBtn, led, playT: 0 } });
  }
  const PHOTOS = {
    p1: { img: 'old_class', title: '사진 — 3학년 2반', text: '칠판에 “다시, 여기서.” 라고 적힌 교실 사진.<br>뒷면: <b>“10.12 마지막 수업”</b>' },
    p2: { img: 'gym_stage', title: '사진 — 기념 방송 리허설', text: '무대 커튼 뒤에 흐릿한 형체가 찍혀 있다.<br>뒷면: “이 사진, 버려 줘.”' },
    p3: { img: 'v_corridor', title: '사진 — 3층 복도', text: '복도 끝에 누군가 서 있다.<br>찍힌 날짜가 <b>오늘</b>이다.' },
  };
  const photoTex = {};
  function addPhoto(id, x, y, z, ry = 0) {
    const P = PHOTOS[id]; photoTex[id] ||= imgMat(P.img, { emissive: 0x111111 });
    const g = dyn(new THREE.Group()); g.position.set(x, y + .01, z); cur.interior.add(g);
    const back = new THREE.Mesh(new THREE.BoxGeometry(.2, .004, .15), mWhite); g.add(back);
    const ph = new THREE.Mesh(new THREE.PlaneGeometry(.18, .12), photoTex[id]); ph.rotation.x = -Math.PI / 2; ph.position.y = .003; g.add(ph); g.rotation.y = ry;
    items.push({ kind: 'photo', id, floor: cur.f, pos: new THREE.Vector3(x, cur.y0 + y, z), mesh: g, taken: false, label: '사진 줍기', ...P });
  }
  // 비상벨 (누르면 학교에 울려 유령을 끌어들인다)
  function alarmBell(x, z, ry = 0) {
    const g = new THREE.Group(); g.position.set(x, 1.55, z); g.rotation.y = ry; cur.interior.add(g);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .07, 20).rotateX(Math.PI / 2), S(null, { color: 0xb01a1a, roughness: .4 })));
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(.2, .26, .05), S(null, { color: 0xc02020, roughness: .45 })); b2.position.set(0, -.3, 0); g.add(b2);
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .03, 14).rotateX(Math.PI / 2), mPorc); btn.position.set(0, -.3, .035); g.add(btn);
    const dz = Math.cos(ry) * .6, dx = Math.sin(ry) * .6;
    props.push({ kind: 'bell', floor: cur.f, x: x + dx, z: z + dz, bx: x, bz: z, label: '비상벨 누르기 (유령 유인)', cd: 0 });
  }
  // CCTV 카메라 (빨간 LED)
  const camG = merge([bx(.06, .2, .06, 0, -.1, 0), bx(.14, .12, .3, 0, -.24, .1), new THREE.CylinderGeometry(.045, .05, .06, 14).rotateX(Math.PI / 2).translate(0, -.24, .27)]);
  function cctv(x, y, z, ry, cfg = {}) {
    const f = cfg.floor ?? cur.f, parent = cfg.parent || cur.interior;
    const mountY = cfg.mountY ?? (CH - .012), g = new THREE.Group();
    g.name = 'CCTV_' + f + '_' + CCTV_CAMERAS.length;
    g.userData.dynamic = true; g.userData.cctv = true;
    g.position.set(x, mountY, z);
    if (cfg.target) ry = Math.atan2(cfg.target[0] - x, cfg.target[2] - z);
    g.rotation.y = ry; parent.add(g);
    const m = new THREE.Mesh(camG, mWhite); m.name = g.name + '_BODY';
    m.rotation.x = cfg.target ? Math.atan2(mountY - .30 - cfg.target[1], Math.hypot(cfg.target[0] - x, cfg.target[2] - z)) : (cfg.pitch ?? .35); g.add(m);
    const lensGlass=new THREE.Mesh(new THREE.CircleGeometry(.041,12),new THREE.MeshBasicMaterial({color:0x080e12})); lensGlass.name=g.name+'_LENS'; lensGlass.position.set(0,-.24,.306); m.add(lensGlass);
    const led = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowRed, blending: THREE.AdditiveBlending, depthWrite: false })); led.scale.setScalar(.10); led.position.set(.05, -.18, .2); m.add(led);
    if (cfg.wallMount) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.20,.05,.06),mWhite);
      arm.rotation.y = -ry; arm.position.copy(new THREE.Vector3(.09,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),-ry)); g.add(arm);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(.035,.16,.13),mWhite);
      plate.rotation.y = -ry; plate.position.copy(new THREE.Vector3(.18,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),-ry)); g.add(plate);
    }
    g.traverse(n => { n.userData.dynamic = true; });
    CCTV_CAMERAS.push({id:g.name,label:cfg.label || AREA_NAMES[f] + ' · CCTV ' + (CCTV_CAMERAS.length+1),floor:f,outdoor:!!cfg.outdoor,mesh:g,lens:m,eye:[0,-.24,.312],target:cfg.target || null,parent});
    return g;
  }
  // 가방 · 농구공 · 식판 · 대걸레 · 양동이
  const mBag = [S(null, { color: 0x2a3a5a, roughness: .9 }), S(null, { color: 0x5a2a2a, roughness: .9 }), S(null, { color: 0x2a4a3a, roughness: .9 }), S(null, { color: 0x3a3a3a, roughness: .9 })];
  const bagG = merge([new THREE.SphereGeometry(.18, 12, 10).scale(.9, 1.15, .55).translate(0, .2, 0), new THREE.SphereGeometry(.1, 10, 8).scale(1.1, .8, .5).translate(0, .14, .1), tube(.012, -.08, .38, -.06, -.08, .05, -.1), tube(.012, .08, .38, -.06, .08, .05, -.1)]);
  function backpack(x, z, ry, tip) { const m = meshAt(bagG, pick(mBag), x, 0, z, ry); if (tip) { m.rotation.x = -1.4; m.updateMatrix(); if (!bagG.boundingBox) bagG.computeBoundingBox(); const bb = bagG.boundingBox.clone().applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(m.rotation)); m.position.y = -bb.min.y; } }   /* 쓰러진 가방이 바닥에 파묻히지 않게 */
  const ballTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#b4521e'; g.fillRect(0, 0, 128, 64); g.strokeStyle = '#1a0a04'; g.lineWidth = 2; [0, 32, 64, 96].forEach(x => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); }); g.beginPath(); g.moveTo(0, 32); g.lineTo(128, 32); g.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const mBall = new THREE.MeshStandardMaterial({ map: ballTex, roughness: .7 });
  const trayG = merge([bx(.42, .015, .3, 0, .008, 0), bx(.42, .03, .012, 0, .02, .145), bx(.42, .03, .012, 0, .02, -.145), bx(.012, .03, .3, .205, .02, 0), bx(.012, .03, .3, -.205, .02, 0), bx(.012, .025, .14, 0, .02, -.07), bx(.2, .025, .012, -.1, .02, .0)]);
  function tray(x, y, z, ry) { meshAt(trayG, mChrome, x, y, z, ry); }
  const bucketG = merge([new THREE.CylinderGeometry(.17, .14, .32, 16, 1, true).translate(0, .16, 0), new THREE.CircleGeometry(.14, 16).rotateX(-Math.PI / 2).translate(0, .01, 0), new THREE.TorusGeometry(.17, .008, 6, 20, Math.PI).translate(0, .32, 0)]);
  const mopG = merge([tube(.015, 0, 0, 0, .05, 1.35, .02), ...Array.from({ length: 14 }, (_, i) => tube(.012, 0, .02, 0, Math.cos(i * .45) * .18, -.0, Math.sin(i * .45) * .18))]);
  function mopBucket(x, z) { meshAt(bucketG, S(null, { color: 0x2a5aa0, roughness: .5, side: THREE.DoubleSide }), x, 0, z); const m = meshAt(mopG, S(null, { color: 0x8a8070, roughness: 1 }), x + .25, .02, z + .05); m.rotation.z = .25; col(x - .2, x + .2, z - .2, z + .2); }
  // 핏자국 데칼
  const bloodM = {}; ['hand', 'drag', 'splat'].forEach(k => { bloodM[k] = new THREE.MeshStandardMaterial({ map: T.makeBlood(k), transparent: true, depthWrite: false, roughness: .3, polygonOffset: true, polygonOffsetFactor: -3 }); });
  function blood(kind, x, y, z, w, ry = 0, floor = false) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), bloodM[kind]); m.position.set(x, y, z); if (floor) { m.rotation.x = -Math.PI / 2; m.rotation.z = ry; } else m.rotation.y = ry; cur.interior.add(m); }

  /* ---------- 상호작용 문 ---------- */
  const doorList = [], props = [];
  const panelG = merge([bxF(.98, 2.25, .045, 0, 1.125, 0)]);
  const handleG = merge([bx(.03, .16, .03, 0, 0, 0)]);
  function slidingDoors(cx, zW = -1.4) {
    add(mWoodDark, 2.2, .05, .08, cx, 2.3, zW + .02);
    const open = rnd() < .35, rect = { x1: cx - 1, x2: cx + 1, z1: -1.75, z2: zW + .03, off: open };   // 대부분 닫힌 채 시작 (열린 미닫이는 벽에 붙어 '문이 없는' 것처럼 보였다)
    const leaves = hingeLeaves(cx, zW);
    const d = { kind: 'slide', floor: cur.f, x: cx, z: -1.5, open: open ? 1 : 0, target: open ? 1 : 0, panels: [], leaves, rect, name: '문' };
    leaves.forEach(l => { l.piv.rotation.y = l.a * d.open; });
    cur.col.push(rect); (cur.doorWalls ||= []).push(rect); doorList.push(d);
    return d;
  }
  // 교실 문: 양쪽 여닫이 두 짝 — 문틀 양 끝 경첩에 달려 방 안쪽으로 열린다 (예전 미닫이는 열리면 벽 쪽으로 밀려 복도 창과 겹쳤다)
  function hingeLeaves(cx, zW) {
    const into = zW < 0 ? -1 : 1;   // 방 쪽 (북쪽 방은 −z, 남쪽 방은 +z)
    return [-1, 1].map(s => {
      const piv = dyn(new THREE.Group()); piv.position.set(cx + s * .99, 0, zW); cur.interior.add(piv);
      const leaf = new THREE.Mesh(panelG, mDoorP); leaf.position.x = -s * .49; piv.add(leaf);
      [-1, 1].forEach(f => { const h = new THREE.Mesh(handleG, mChrome); h.position.set(-s * .88, 1.0, f * .035); piv.add(h); });
      return { piv, a: -s * into * 1.45 };   // 열린 각도 (약 83°)
    });
  }
  function hingeDoor(px, z, w, h, y, angOpen, startOpen, mat, name) {
    const piv = dyn(new THREE.Group()); piv.position.set(px, 0, z); cur.interior.add(piv);
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, .04), mat); p.position.set(w / 2, y + h / 2, 0); piv.add(p);
    const hd = new THREE.Mesh(handleG, mChrome); hd.position.set(w - .1, y + h * .5, .03); piv.add(hd);
    const rect = { x1: px, x2: px + w, z1: z - .03, z2: z + .03, off: startOpen };
    const d = { kind: 'hinge', floor: cur.f, x: px + w / 2, z: z + .35, open: startOpen ? 1 : 0, target: startOpen ? 1 : 0, piv, angOpen, rect, name };
    piv.rotation.y = d.open * angOpen;
    cur.col.push(rect); doorList.push(d);
    return d;
  }


  /* ---------- 방 가구 ---------- */
  const boardTexts = [
    ['다시, 여기서…', '아직 수업이 끝나지 않았어'],
    ['왜 나만 두고 갔어…', '지하가 너무 어두워'],
    ['모두 어디 갔니…', '11시 40분 하교 방송'],
    ['돌 아 와…', '내 자리 지우지 마'],
    ['출 석 확 인', '3학년 2반 윤하늘 — 현 재'],
    ['뒤 를  돌 아 보 지  마', '바로 네 뒤에 서 있어']
  ];
  const OFFICERS_BY_SEED = [
    { pres: '이 준 호', vpres: '김 민 지', noisy: ['박 철 수  正', '김 영 호  ㅜ', '최 진 우  ㅡ'], duty: '12번 · 27번' },
    { pres: '정 태 현', vpres: '서 다 은', noisy: ['한 동 민  正', '박 세 진  ㅜ', '조 성 훈  ㅡ'], duty: '05번 · 19번' },
    { pres: '강 민 수', vpres: '이 수 아', noisy: ['김 태 우  正', '배 준 형  ㅡ', '오 지 훈  ㅜ'], duty: '08번 · 24번' },
  ];
  function makeClassroomBoard98(lines = [], opts = {}) {
    const W = 1024, H = 320;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    // 1) 1998년 정통 진녹색 칠판 바탕 (#173526)
    const bgGr = g.createLinearGradient(0, 0, 0, H);
    bgGr.addColorStop(0, '#163324'); bgGr.addColorStop(0.5, '#1b3c2b'); bgGr.addColorStop(1, '#142d20');
    g.fillStyle = bgGr; g.fillRect(0, 0, W, H);

    // 2) 리얼한 칠판 지우개 분필자국 (가로·대각선 방향 둥근 지우개 결 & 분필 가루 구름)
    g.save();
    for (let i = 0; i < 28; i++) {
      const x = ((i * 73) % (W - 120)) + 60, y = ((i * 47) % (H - 60)) + 30, rad = 45 + (i % 4) * 28;
      const rg = g.createRadialGradient(x, y, 4, x, y, rad);
      rg.addColorStop(0, 'rgba(225, 238, 228, 0.13)');
      rg.addColorStop(0.6, 'rgba(210, 228, 215, 0.06)');
      rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = rg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    g.strokeStyle = 'rgba(230, 240, 232, 0.14)'; g.lineWidth = 22; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const y0 = 38 + i * 30;
      g.beginPath();
      g.moveTo(190 + (i % 3) * 35, y0);
      g.bezierCurveTo(380, y0 - 18 + (i % 2) * 36, 580, y0 + 18 - (i % 2) * 36, 760 - (i % 3) * 25, y0 + 6);
      g.stroke();
    }
    g.restore();

    // 3) 좌측 구획 (일자 · 주번 · 시간표/전달사항) & 우측 구획 (반장 · 부반장 · 떠든이) — 분필 실선 구획
    const idx = Math.abs((opts.seed || 0)) % OFFICERS_BY_SEED.length;
    const info = OFFICERS_BY_SEED[idx];
    g.strokeStyle = 'rgba(235, 242, 235, 0.55)'; g.lineWidth = 2.5;
    // 좌측 세로선 (x = 210) & 우측 세로선 (x = 785)
    g.beginPath();
    g.moveTo(210, 14); g.lineTo(210, H - 14);
    g.moveTo(785, 14); g.lineTo(785, H - 14);
    g.moveTo(785, 148); g.lineTo(W - 16, 148);
    g.stroke();

    // 좌측 분필 필기: 날짜 · 주번 · 공지
    g.fillStyle = 'rgba(240, 245, 238, 0.88)';
    g.font = `bold 20px ${T.FONT}`; g.textAlign = 'left';
    g.fillText('10월 12일 (목)', 22, 42);
    g.font = `bold 17px ${T.FONT}`;
    g.fillStyle = 'rgba(245, 232, 168, 0.90)';
    g.fillText('[일일 주번]', 22, 82);
    g.fillStyle = 'rgba(240, 245, 238, 0.86)';
    g.fillText('  ' + info.duty, 22, 108);
    g.fillStyle = 'rgba(185, 228, 245, 0.88)';
    g.fillText('[오늘의 전달]', 22, 152);
    g.fillStyle = 'rgba(235, 240, 234, 0.82)';
    g.font = `15px ${T.FONT}`;
    g.fillText('• 야간자율학습 정숙', 22, 180);
    g.fillText('• 방송제 리허설 22시', 22, 206);
    g.fillText('• 창문·소등 철저 확인', 22, 232);

    // 우측 상단 분필 필기: 반장 · 부반장
    g.fillStyle = 'rgba(248, 234, 165, 0.94)';
    g.font = `bold 19px ${T.FONT}`;
    g.fillText('■ 학급 임원', 802, 40);
    g.fillStyle = 'rgba(242, 247, 240, 0.92)';
    g.font = `bold 20px ${T.FONT}`;
    g.fillText('반   장 : ' + info.pres, 802, 76);
    g.fillText('부반장 : ' + info.vpres, 802, 110);

    // 우측 하단 분필 필기: 떠든 사람 (떠든이) + 바를 정(正) 체크!
    g.fillStyle = 'rgba(255, 195, 155, 0.94)';
    g.font = `bold 19px ${T.FONT}`;
    g.fillText('■ 떠 든 이 (정숙!)', 802, 180);
    g.fillStyle = 'rgba(244, 248, 242, 0.90)';
    g.font = `bold 20px ${T.FONT}`;
    info.noisy.forEach((nm, k) => {
      g.fillText(nm, 806, 214 + k * 32);
    });

    // 4) 중앙 영역 (x: 220 ~ 775): 초자연 현상으로 실시간 써지는 분필 글씨!
    const arr = Array.isArray(lines) ? lines.filter(Boolean) : (lines ? [String(lines)] : []);
    if (arr.length) {
      arr.forEach((t, i) => {
        const isRed = /죽|피|뒤|나가지|갇혔/.test(t);
        g.fillStyle = isRed ? 'rgba(245, 95, 85, 0.94)' : 'rgba(246, 250, 244, 0.94)';
        g.font = `bold ${i === 0 ? 52 : 34}px ${T.FONT}`;
        g.textAlign = 'center';
        g.save();
        g.translate(498, (arr.length === 1 ? 165 : 132 + i * 68));
        g.rotate((i % 2 ? 1 : -1) * 0.015);
        g.shadowColor = 'rgba(255, 255, 255, 0.28)';
        g.shadowBlur = 6;
        g.fillText(t, 0, 0);
        g.restore();
      });
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  function frontWall(cx, zN, withBoard = true, lines) {
    if (withBoard) {
      // 2008년식 알루미늄 프레임 곡면 녹색 법랑 칠판 (폭 4.24m × 높이 1.36m, 하단 대형 알루미늄 분필받이 & 주황색 전동 분필지우개 털이기 장착!)
      const mAlum08 = S(null, { color: 0xc8cdd2, roughness: .32, metalness: .72 });
      const mChalkTray08 = S(null, { color: 0xb2b8be, roughness: .38, metalness: .65 });
      const mVacOrange = S(null, { color: 0xd85a22, roughness: .42 });
      add(mAlum08, 4.26, 1.38, .045, cx, 1.13, zN + .028);
      add(mWoodDark, 4.18, 1.30, .052, cx, 1.17, zN + .032);
      const initLines = lines || [];
      const bm = new THREE.MeshStandardMaterial({ map: makeClassroomBoard98(initLines, { seed: Math.round(cx + cur.f * 17) }), roughness: .74 });
      plane(cur.interior, bm, 4.04, 1.24, cx, 1.82, zN + .072);
      // 상단 알루미늄 몰딩 & 정중앙 유리 액자형 태극기 (y = 2.86m)
      add(mAlum08, .74, .50, .032, cx, 2.61, zN + .035);
      plane(cur.interior, mFlag, .66, .44, cx, 2.86, zN + .056);
      // 하단 대형 알루미늄 분필받이 레일 (y = 1.14m) + 좌측 2008년식 전동 분필지우개 털이기(진공 흡입기)
      add(mChalkTray08, 4.24, .05, .13, cx, 1.12, zN + .115);
      add(mVacOrange, .22, .16, .15, cx - 1.82, 1.17, zN + .125);
      add(mDarkMetal, .18, .035, .11, cx - 1.82, 1.33, zN + .125);
      boardDetail(cx, zN);
      frontWall.last = bm;
    }
    [-3.05, 3.05].forEach(dx => {
      win3D(cur.interior, 1.3, 1.45, cx + dx, 1.75, zN + .02);
      radiator(cx + dx, zN + .14, 0, 1.15);
      // 2008년식 상부 알루미늄 버티컬 블라인드 헤드레일 & 아이보리 블라인드 슬랫
      add(S(null, { color: 0xd0d4d8, roughness: .35, metalness: .6 }), 1.42, .055, .08, cx + dx, 2.48, zN + .10);
      curtain(cx + dx - .68, 1.75, zN + .10, .38, 1.72);
    });
  }
  // 교실 상세 배치 (22개 교실 시트 · 소품 좌표 CSV: 방 8.0 × 7.5m, X = 서→동, Y = 칠판→뒤쪽)
  // 소모품: [노트·교과서, 필통·연필, 물병·종이컵, 쓰레기·파손물] · 단서: [이름, 상태, X, Y]
  const CLS = {
    '1-1': { c: [[6.09, 5.32], [1.45, 2.88], [2.52, 4.86], [5.31, 4.65]], clue: ['출석부', '사라진 첫 출석부', 3.87, 4.89] },
    '1-2': { c: [[3.62, 3.77], [6.3, 4.82], [5.57, 2.35], [3.71, 2.84]], clue: ['찢어진 공지', '벽에 남은 낙서', 3.39, 4.95] },
    '1-3': { c: [[5.9, 5.14], [6.12, 2.01], [1.33, 3.25], [6.19, 5.9]], clue: ['졸업사진', '오래된 사진', 5.55, 5.35] },
    '2-1': { c: [[2.4, 3.1], [5.2, 4.4], [6.4, 2.6], [3.1, 5.6]], clue: ['시험지', '멈춘 시험 시간', 3.39, 4.95] },
    '2-3': { c: [[5.1, 2.7], [1.9, 4.6], [4.4, 5.5], [6.5, 3.6]], clue: ['수학 노트', '풀리지 않은 문제', 3.04, 2.76] },
    '2-4': { c: [[2.2, 2.4], [4.8, 3.3], [6.2, 5.0], [1.6, 5.9]], clue: ['빈 사진 액자', '바뀐 교실 번호', 5.23, 5.81] },
    '2-5': { c: [[5.7, 4.1], [3.3, 5.2], [1.8, 2.6], [4.6, 2.2]], clue: ['사진 필름', '빛바랜 필름', 2.69, 3.02] },
    '3-3': { c: [[2.6, 4.2], [5.9, 3.0], [4.1, 5.7], [6.6, 4.9]], clue: ['학생 이름표', '사라진 명찰', 5.23, 5.81] },
    '3-4': { c: [[5.4, 2.5], [2.1, 3.9], [3.6, 5.4], [1.4, 2.2]], clue: ['방송 메모', '방송이 끊긴 순간', 2.69, 3.02] },
    '3-5': { c: [[1.9, 4.4], [4.9, 2.4], [6.1, 4.5], [3.9, 3.7]], clue: ['연필 스케치', '찢긴 그림', 3.34, 2.84] },
    '1-4': { c: [[1.92, 4.43], [5.37, 2.25], [4.24, 5.5], [6.46, 3.95]], clue: ['녹슨 열쇠', '닫힌 서랍', 3.04, 2.76] },
    '1-5': { c: [[4.47, 2.58], [6.3, 3.71], [3.62, 4.44], [5.78, 3.55]], clue: ['낡은 학교지도', '비어 있는 교실', 5.23, 5.81] },
    '2-2': { c: [[5.9, 5.14], [6.12, 2.01], [1.33, 3.25], [6.19, 5.9]], clue: ['카세트테이프', '녹음된 속삭임', 5.55, 5.35] },
    '3-1': { c: [[5.9, 5.14], [6.12, 2.01], [1.33, 3.25], [6.19, 5.9]], clue: ['마지막 시간표', '마지막 정규 수업', 5.55, 5.35] },
    '3-2': { c: [[1.92, 4.43], [5.37, 2.25], [4.24, 5.5], [6.46, 3.95]], clue: ['손상된 휴대전화', '연결되지 않는 전화', 3.04, 2.76] },
    '3-6': { c: [[5.65, 5.49], [2.21, 3.19], [3.78, 2.64], [3.0, 5.26]], clue: ['잠긴 서랍', '잠긴 모임 장소', 1.61, 5.58] },
    '3-7': { c: [[5.02, 5.3], [6.33, 4.47], [2.3, 5.8], [3.69, 4.59]], clue: ['수첩 낱장', '남겨진 기록', 6.24, 4.9] },
    '3-8': { c: [[6.48, 3.53], [1.99, 5.79], [5.51, 4.44], [1.34, 5.34]], clue: ['붉은 명단', '잠금된 마지막 교실', 6.16, 5.1] },
    'C-01': { c: [], clue: ['로그 기록 USB', '전원이 꺼진 마지막 접속', 3.5, 6.6] }, 'M-01': { c: [], clue: ['찢어진 악보', '새벽 방송과 악보', 3.5, 6.6] },
    'A-01': { c: [], clue: ['붉은 초상 스케치', '지워진 그림 속 인물', 3.5, 6.6] }, 'S-01': { c: [], clue: ['과거 실험일지', '실험 기록과 유리병', 3.5, 6.6] },
  };
  const csvXZ = (cx, X, Y) => [cx - 4 + X, -9.6 + Y * 7.85 / 7.5];
  const mProj = S(null, { color: 0xd8d8d0, roughness: .45 }), mScreenR = S(null, { color: 0xeeeeea, roughness: .8 });
  const mPlant = S(null, { color: 0x3a5a2a, roughness: .9 }), mPot = S(null, { color: 0x8a4a2a, roughness: .8 });
  const mRecy = [S(null, { color: 0x2a5ab0, roughness: .6 }), S(null, { color: 0x8a8a84, roughness: .6 }), S(null, { color: 0x3a7a3a, roughness: .6 })];
  function potPlant(x, y, z, dead = rnd() < .6) {
    meshAt(new THREE.CylinderGeometry(.09, .07, .14, 10).translate(0, .07, 0), mPot, x, y, z);
    for (let k = 0; k < 5; k++) { const l = meshAt(new THREE.ConeGeometry(.03, .22, 4).translate(0, .11, 0), dead ? S(null, { color: 0x6a5a30, roughness: 1 }) : mPlant, x, y + .12, z, k * 1.3); l.rotation.z = (dead ? 1.1 : .4) * (k % 2 ? 1 : -1); }
  }
  // 교실 단서: 조사하면 짧은 기록이 나오고, 모으면 보급품 보상 (교실의 기억)
  function classClue(cx, name) {
    const d = CLS[name]; if (!d) return; const [title, state, X, Y] = d.clue, [x, z] = csvXZ(cx, X, Y);
    const g = dyn(new THREE.Group()); g.position.set(x, .02, z); g.rotation.y = rnd() * 6; cur.interior.add(g);   // 책상 밑 바닥에 떨어져 있다
    const look = { '출석부': 'book', '수학 노트': 'book', '졸업사진': 'photo', '빈 사진 액자': 'frame', '사진 필름': 'film' }[title] || 'paper';
    if (look === 'book') g.add(new THREE.Mesh(new THREE.BoxGeometry(.22, .03, .3), S(null, { color: 0x3a2a5a, roughness: .8 })));
    else if (look === 'frame') { const f2 = new THREE.Mesh(new THREE.BoxGeometry(.24, .02, .3), mWoodDark); g.add(f2); }
    else if (look === 'film') g.add(new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .04, 14), S(null, { color: 0x1a1a1a, roughness: .4 })));
    else { const pp = new THREE.Mesh(new THREE.PlaneGeometry(.22, .29), look === 'photo' ? mPaints[2] : mPaperN); pp.rotation.x = -Math.PI / 2; pp.position.y = .006; pp.rotation.z = rnd(); g.add(pp); }
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexG, color: 0xffb0a0, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .5 })); gl.scale.setScalar(.45); gl.position.y = .05; g.add(gl);
    props.push({ kind: 'clue', id: 'cls' + name, floor: cur.f, x, z, y: .35, mesh: g, title, state, room: name, label: `${title} 조사하기` });
  }
  // 교실 배치 시드 (교실 리모델링 패치 — 비반복 배치): 1 기본 · 2 가지런한 줄 + 교탁 · 게시판 좌우 반전 · 3 폐허(의자 쓰러짐 · 책상 빠짐 · 넘어진 책상)
  //   책상 자리는 그대로 둔다 (책상 위 노트 · 필통 같은 소품이 공중에 뜨지 않게) — 대신 위에 소품이 있는 책상은 빠지지 않는다
  const classSeed = (cx, name) => { let h = cur.f * 31 + (curSouth ? 7 : 0); for (const ch of String(name)) h = h * 33 + ch.charCodeAt(0); return Math.abs(h) % 3 + 1; };
  function classroom(cx, name) {
    const zN = -9.6, seed = classSeed(cx, name), mir = seed === 2 ? -1 : 1;
    const ghostLines = name === '3-3' ? ['자 습 중', '뒤 를  돌 아 봐'] : boardTexts[Math.abs(seed + cur.f * 3 + (cx | 0)) % boardTexts.length];
    frontWall(cx, zN, true, []);
    const bKey = 'cls' + cur.f + ':' + cx + (curSouth ? 's' : '');
    boardRefs[bKey] = {
      mat: frontWall.last, floor: cur.f, cx, south: !!curSouth, name,
      seed: Math.round(cx + cur.f * 17),
      targetLines: ghostLines,
      writtenChars: 0, writing: false, done: false, timer: 0
    };
    if (name === '3-3') boardRefs.b33 = boardRefs[bKey];

    // ── [2008년식 리모델링 ①] 뼈대 벽(노출 콘크리트 기둥 · 상부 보 · 알루미늄 줄눈 몰딩) & 바닥(너도밤나무 마루 패턴 · 출입구 매트 · 알루미늄 논슬립 단상) ──
    const mPillar08 = S(null, { color: 0xdcd8ce, roughness: .78 });
    const mAlum08   = S(null, { color: 0xc4cad0, roughness: .32, metalness: .72 });
    const mPVC08    = S(null, { color: 0xf0eee8, roughness: .42 });
    const mACWhite  = S(null, { color: 0xeeece6, roughness: .36 });
    const mLCDFrame = S(null, { color: 0x1e2226, roughness: .32, metalness: .45 });
    const mLCDScreen= new THREE.MeshStandardMaterial({ color: 0x101822, roughness: .18, metalness: .25, emissive: 0x0a1828, emissiveIntensity: .35 });
    const mLedGreen = new THREE.MeshBasicMaterial({ color: 0x30ff88 });
    const mLedBlue  = new THREE.MeshBasicMaterial({ color: 0x38a8ff });

    // 4모서리 및 중앙 내력 기둥(뼈대) + 천장 가로보(Cross-Beam)
    cur.interior.add(new THREE.Mesh(merge([
      bx(.18, CH, .18, cx - 3.76, CH / 2, zN + .10),
      bx(.18, CH, .18, cx + 3.76, CH / 2, zN + .10),
      bx(.18, CH, .18, cx - 3.76, CH / 2, -1.85),
      bx(.18, CH, .18, cx + 3.76, CH / 2, -1.85)   // 교실 한가운데를 가로지르던 기둥 2개 · 낮은 보는 뺐다 (방 안에 틀이 서 있는 것처럼 보였다)
    ]), mPillar08));

    // 출입문 바닥 다크그레이 신발털이 매트 & 알루미늄 도어실
    add(S(null, { color: 0x2c3034, roughness: .92 }), 1.45, .012, .68, cx, .002, -2.18);
    add(mAlum08, 1.50, .016, .04, cx, .002, -1.82);

    // 정중앙 2008년식 교단 단상 (폭 3.6m × 깊이 1.14m × 높이 12cm + 알루미늄 논슬립 전면 몰딩) & 2008년식 멀티미디어 전자교탁(cx, zN + 0.86)
    add(mWoodDark, 3.6, .12, 1.14, cx, 0, zN + .64);
    add(mAlum08, 3.64, .03, .04, cx, .105, zN + 1.21);
    meshAt(merge([
      bx(.84, .86, .56, 0, .55, 0),
      bx(.90, .05, .62, 0, .99, .01),
      bx(.90, .08, .04, 0, 1.04, -.27),
      bx(.70, .58, .02, 0, .56, -.285)
    ]), mWoodDark, cx, 0, zN + .86);
    // 전자교탁 상판 내장 서브 터치스크린 & 구즈넥 마이크
    plane(cur.interior, mLCDScreen, .34, .22, cx - .16, 1.022, zN + .88, 0, -Math.PI / 2);
    cur.interior.add(new THREE.Mesh(merge([
      tube(.007, cx + .22, 1.02, zN + .72, cx + .22, 1.24, zN + .76),
      tube(.006, cx + .22, 1.24, zN + .76, cx + .18, 1.32, zN + .88)
    ]), mDarkMetal));
    col(cx - .46, cx + .46, zN + .54, zN + 1.18);

    // 칠판 상단(y = 2.86m) 좌·우: 2008년식 급훈 & 학급 현황판/수능 D-Day 보드 + 양끝 PA 학내방송 스피커
    add(mWoodDark, 1.44, .28, .03, cx - 1.26, 2.72, zN + .04);
    plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('급훈 : 미래를 여는 창의인 · 성실과 책임', '#162c22', '#f2e8c8', 22) }), 1.36, .22, cx - 1.26, 2.86, zN + .06);
    add(mWoodDark, 1.44, .28, .03, cx + 1.26, 2.72, zN + .04);
    const rightSignTxt = cur.f === 2 ? ('2009 대학수학능력시험 D-30  |  제 ' + name + ' 반') : ('2008학년도 제 ' + name + ' 학급 (정원 35명)');
    plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign(rightSignTxt, '#1e242c', '#e8f0f8', 21) }), 1.36, .22, cx + 1.26, 2.86, zN + .06);
    [-2.22, 2.22].forEach(sx => {
      add(mACWhite, .22, .30, .14, cx + sx, 2.72, zN + .08);
      add(mDarkMetal, .18, .24, .02, cx + sx, 2.75, zN + .15);
    });

    // ── [2008년식 리모델링 ②] 전기설비 · 천장형 4-Way 시스템 에어컨 · DLP 빔프로젝터 & 전동 롤스크린 · 좌측 상단 브래킷 32인치 와이드 TV ──
    // 1) 천장 중앙 2008년형 4-Way 시스템 에어컨 카세트 (cx, y = CH - 0.06, z = -5.65)
    add(mACWhite, .96, .07, .96, cx, CH - .07, -5.65);
    add(mDarkMetal, .62, .015, .62, cx, CH - .078, -5.65);
    [-0.38, 0.38].forEach(d => {
      add(mAlum08, .58, .018, .05, cx, CH - .076, -5.65 + d);
      add(mAlum08, .05, .018, .58, cx + d, CH - .076, -5.65);
    });
    plane(cur.interior, mLedGreen, .04, .018, cx + .32, CH - .079, -5.28, 0, Math.PI / 2);

    // 2) 천장 브래킷 고정형 2008년식 DLP 빔프로젝터 (cx, y = CH - 0.44, z = -6.25) & 칠판 좌측 상단 전동 롤스크린 경통
    cur.interior.add(new THREE.Mesh(merge([
      bx(.14, .03, .14, cx, CH - .02, -6.25),
      tube(.018, cx, CH - .03, -6.25, cx, CH - .36, -6.25),
      bx(.34, .11, .28, cx, CH - .40, -6.25)
    ]), mACWhite));
    cyl(mDarkMetal, .042, .06, cx - .06, CH - .40, -6.41, 12);
    plane(cur.interior, mLedBlue, .02, .02, cx + .11, CH - .40, -6.10);
    // 칠판 좌측 상단 롤스크린 경통 (폭 1.85m) + 반쯤 내려온 프로젝터 스크린
    add(mAlum08, 1.88, .07, .07, cx - 1.05, 2.52, zN + .13);
    add(mScreenR, 1.78, .92, .012, cx - 1.05, 1.60, zN + .135);
    add(mDarkMetal, 1.82, .025, .025, cx - 1.05, 1.59, zN + .135);

    // 3) 교실 좌측 상단 모서리 천장 브래킷 거치형 2008년식 32인치 와이드 LCD 학내방송 TV (cx - 3.25, y = 2.42, z = zN + 0.62)
    {
      const tvG = new THREE.Group();
      tvG.position.set(cx - 3.25, 2.42, zN + .62);
      tvG.rotation.y = .52;
      cur.interior.add(tvG);
      tvG.add(
        new THREE.Mesh(bx(.04, .75, .04, 0, .55, 0), mDarkMetal),
        new THREE.Mesh(bx(.82, .52, .07, 0, 0, 0), mLCDFrame),
        new THREE.Mesh(bx(.74, .42, .015, 0, .02, .032), mLCDScreen),
        new THREE.Mesh(bx(.82, .05, .075, 0, -.23, .005), mAlum08),
        new THREE.Mesh(bx(.02, .012, .01, .34, -.23, .045), new THREE.MeshBasicMaterial({ color: 0xff2820 }))
      );
    }

    // 4) 2008년식 백색 PVC 사각 전선 몰딩(쫄대) & 벽면 220V 2구 접지 콘센트 · 학내망(LAN) 단자함 · 유선 에어컨 온도조절기
    cur.interior.add(new THREE.Mesh(merge([
      bx(4.8, .028, .018, cx, 3.02, zN + .02),
      bx(.028, 2.65, .018, cx - 1.82, 1.70, zN + .02),
      bx(.028, 2.55, .018, cx + 2.35, 1.65, zN + .02),
      bx(.10, .14, .022, cx + 2.35, .38, zN + .025),
      bx(.10, .14, .022, cx - 1.82, .38, zN + .025),
      bx(.03, .02, 4.8, cx, CH - .02, -3.85),
      bx(.12, .18, .025, cx - 1.22, 1.38, -1.77),
      bx(.09, .13, .022, cx + 1.22, 1.38, -1.77)
    ]), mPVC08));
    plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('LG WHISEN · 22°C 운전중', '#142820', '#70ffaa', 18) }), .09, .06, cx - 1.22, 1.41, -1.785, Math.PI);

    // ── [2008년식 리모델링 ③] 우측 교사용 멀티미디어 PC 데스크 (19인치 평면 LCD 모니터 + 슬림 블랙 PC 본체 + 광마우스 + 출석부) ──
    teacherDesk(cx + 2.6, zN + 1.0);
    CHAIRS.push({ f: cur.f, x: cx + 2.6, z: zN + 1.65, ry: 0, room: name, teacher: true });
    monitor(cx + 2.16, .76, zN + .82, .18, { crt: false, cracked: false });
    keyboard(cx + 2.22, .76, zN + 1.12, .05);
    mouse(cx + 2.46, .76, zN + 1.12, .05);
    pcTower(cx + 2.02, .02, zN + .96, 0);
    // 교탁 위/교사용 책상 위 2008학년도 출석부 바인더
    add(S(null, { color: 0x1c3458, roughness: .6 }), .22, .022, .30, cx - .24, .762, zN + .84, { ry: -.08 });

    fan(cx - 1.85, -6.8); fan(cx + 1.85, -3.9);
    // 후면 벽시계 (문 위 인방 중앙)
    { const ck = new THREE.Mesh(new THREE.CircleGeometry(.22, 24), mClockM); ck.position.set(cx, 2.72, -1.76); ck.rotation.y = Math.PI; cur.interior.add(ck); }
    cctv(cx - 3.75, CH, -2.0, Math.PI * .75, {label:AREA_NAMES[cur.f] + ' · ' + name});
    potPlant(cx - 3.55, 0, zN + .35);

    // ── [2008년식 리모델링 ④] 측면 코르크 게시판 & 후면 2단 스틸 사물함 · 청소도구함 · 학급 환경미화 게시판 · 우산꽂이 · 3색 분리수거함 ──
    add(mAlum08, .025, 1.22, 2.48, cx + 3.81 * mir, 1.07, -5.4);
    plane(cur.interior, mCork, 2.4, 1.15, cx + 3.795 * mir, 1.68, -5.4, -Math.PI / 2 * mir);
    for (let k = 0; k < 6; k++) { const pp = new THREE.Mesh(new THREE.PlaneGeometry(.26, .34), mPaperN); pp.position.set(cx + 3.78 * mir, 1.45 + (k % 2) * .38 + rr(-.04, .04), -6.2 + k * .34); pp.rotation.set(0, -Math.PI / 2 * mir, rr(-.12, .12)); cur.interior.add(pp); }

    // [후면 좌측 벽 구간: cx - 3.75 ~ cx - 1.25] (철제 청소도구함 + 2008년식 2단 개인 사물함 + 환경미화 게시판)
    add(mPanelG, .48, 1.86, .42, cx - 3.55, 0, -2.00, { col: true });
    for (let k = 0; k < 4; k++) {
      add(mLockerT, .44, 1.22, .40, cx - 3.04 + k * .46, 0, -1.98, { ry: Math.PI });
    }
    col(cx - 3.30, cx - 1.38, -2.20, -1.75);
    add(mAlum08, 1.96, .76, .03, cx - 2.34, 1.48, -1.79);
    plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('2008학년도 학급 환경미화 게시판  |  이달의 독서 · 주번/청소당번표', '#163424', '#f0ece0', 19) }), 1.86, .66, cx - 2.34, 1.86, -1.81, Math.PI);

    // [후면 우측 벽 구간: cx + 1.25 ~ cx + 3.75] (2단 개인 사물함 + 수행평가/시간표 게시판 + 스테인리스 우산꽂이 + 3색 분리수거함)
    for (let k = 0; k < 3; k++) {
      add(mLockerT, .44, 1.22, .40, cx + 1.52 + k * .46, 0, -1.98, { ry: Math.PI });
    }
    col(cx + 1.28, cx + 2.72, -2.20, -1.75);
    add(mAlum08, 1.56, .76, .03, cx + 2.02, 1.48, -1.79);
    plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('2008학년도 학급 시간표 · 수행평가 일정 · 가정통신문', '#1a2c38', '#e8f0f8', 19) }), 1.46, .66, cx + 2.02, 1.86, -1.81, Math.PI);
    // 출입문 우측 스테인리스 우산꽂이
    add(mAlum08, .26, .52, .22, cx + 1.18, 0, -1.95);
    extinguisher(cx + 2.92, -1.98);
    [0, 1].forEach(k => add(mRecy[k], .34, .58, .34, cx + 3.22 + k * .36, 0, -1.98, { col: k === 1 }));

    // ── [2008년식 리모델링 ⑤] 3분단 × 2열 짝꿍 × 6행 = 36석 2008년식 책걸상 행렬 & 책상 위 EBS 교재·텀블러·필통 소품 ──
    const dCls = CLS[name], keep = dCls && dCls.c.length ? dCls.c.map(([X, Y]) => csvXZ(cx, X, Y)) : [];
    deskGrid(
      cx,
      [-2.94, -2.26, -0.34, 0.34, 2.26, 2.94],
      [-7.0, -6.0, -5.0, -4.0, -3.0],   // 5줄 · 줄 간격 1.0m · 맨 뒷줄 의자와 뒤쪽 사물함 사이 0.2m (예전 0.8m는 의자가 뒷줄 책상에 박혀 책상이 붙어 보였다)
      0.03,
      false,
      { keep, tidy: true, knock: 0, room: name }
    );
    const d = CLS[name];
    if (d && d.c.length) {
      const [nb0, pc0, wb0, tr] = d.c.map(([X, Y]) => csvXZ(cx, X, Y));
      const used = new Set(), onDesk = ([x, z], ox, oz) => { let best = null, bd = 1.6; for (const k of DESKS) { if (k.f !== cur.f || used.has(k) || Math.abs(k.x - cx) > 4) continue; const dd = Math.hypot(k.x - x, k.z - z); if (dd < bd) { bd = dd; best = k; } }
        if (!best) return [x, z, .005]; used.add(best); return [best.x + ox, best.z + oz, best.top + .01]; };
      const nb = onDesk(nb0, -.12, .02), pc = onDesk(pc0, .14, -.06), wb = onDesk(wb0, .16, .06);
      add(S(null, { color: pick([0x1e4a7a, 0x8a2828, 0x246242]), roughness: .75 }), .21, .025, .29, nb[0], nb[2], nb[1], { ry: rr(-.5, .5) }); add(mPaperN, .2, .01, .28, nb[0] + .05, nb[2] + .025, nb[1], { ry: rr(-.5, .5) });
      add(S(null, { color: pick([0x2e3446, 0x985a7a, 0x22262a]), roughness: .65 }), .2, .05, .07, pc[0], pc[2], pc[1], { ry: rr(-1, 1) }); for (let k = 0; k < 3; k++) add(S(null, { color: 0xd8b030 }), .14, .008, .008, pc[0] + rr(-.1, .1), pc[2] + .005, pc[1] + .08, { ry: rr(-1, 1) });
      cyl(S(null, { color: 0xb8c4cc, roughness: .25, metalness: .65 }), .036, .21, wb[0], wb[2], wb[1], 12); cyl(S(null, { color: 0xeeeeea, roughness: .6 }), .035, .09, wb[0] + .12, wb[2], wb[1] + .05, 10);
      for (let k = 0; k < 4; k++) { const pp = new THREE.Mesh(new THREE.PlaneGeometry(.2, .15), mDirtPaper); pp.rotation.set(-Math.PI / 2, 0, rnd() * 6); pp.position.set(tr[0] + rr(-.4, .4), .016, tr[1] + rr(-.4, .4)); cur.interior.add(pp); }
      classClue(cx, name);
    }
    papers(cx, -8, -2.4, 7);
  }
  function office(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    const matDeskPad = S(null, { color: 0x1e4d38, roughness: .55 });
    const matBinderBlue = S(null, { color: 0x1e385c, roughness: .65 });
    const matBinderRed  = S(null, { color: 0x6e2220, roughness: .65 });
    const matTrayMetal  = S(null, { color: 0x424a50, roughness: .4, metalness: .6 });

    // ① 북쪽 벽면: 교무실 학급별 출석부 보관함(18칸 Pigeonhole Rack) & 생활기록부 보존 서가 3동
    for (let k = 0; k < 3; k++) shelf3D(cx + (k - 1) * 1.45, zN + .26, 0, 1.25, 2.15, .42, 6, .85);
    // 동쪽 벽면: 대형 『1998학년도 2학기 주간 학사일정 및 교직원 담당 현황판』 칠판 & 달력
    add(mWoodDark, .05, 1.28, 3.2, cx + 3.82, 1.15, -5.6);
    plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('1998학년도 2학기 주간 학사일정표  |  10.12 방송부 30주년 기념방송  |  교무부 · 학생부 · 연구부', '#162c22', '#f2ead4', 20) }), 3.08, 1.16, cx + 3.79, 1.79, -5.6, -Math.PI / 2);
    plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeCalendar(), roughness: .9 }), .52, .65, cx + 3.82, 1.78, -8.1, -Math.PI / 2);

    // ② 북쪽 중앙 상석: 교감 · 교무부장 헤드 데스크 (z = -7.85, 남쪽을 바라봄)
    {
      const hx = cx + 0.15, hz = -7.85;
      meshAt(merge([bx(1.75, .05, .82, 0, .75, 0), bx(.45, .73, .78, -.62, .365, 0), bx(.45, .73, .78, .62, .365, 0), bx(1.65, .52, .03, 0, .44, .39)]), mWoodDark, hx, 0, hz);
      add(matDeskPad, .72, .008, .46, hx, .775, hz);
      add(mWoodDark, .24, .07, .06, hx - .48, .775, hz + .26); // '교무부장' 삼각 명패
      add(matTrayMetal, .28, .18, .34, hx + .56, .775, hz - .12); // 3단 결재 서류함
      add(mPaperN, .24, .06, .30, hx + .56, .82, hz - .12);
      officeChair(hx, hz - .56, 0, true);
      col(hx - .88, hx + .88, hz - .45, hz + .45);
    }

    // ③ 좌·우 4인 1조 마주보기 아일랜드 교사 책상 클러스터 2조 (컴퓨터 일렬 배치를 없애고 진짜 한국 교무실처럼 좌우 마주보기 배치!)
    //    ※ 첫 번째 단서 노트 n3 위치(cx - 2.5, .76, -5.4)를 정확히 받쳐주도록 서쪽 클러스터를 cx - 2.05, z = -5.4 중심으로 배치!
    [
      { gx: cx - 1.95, gz: -5.45, names: ['3-2 담임 정은수', '3-1 담임', '2학년부', '1학년부'] },
      { gx: cx + 1.85, gz: -5.45, names: ['학생부장', '연구부장', '생활지도부', '체육부장'] }
    ].forEach((cl, ci) => {
      // 중앙 낮은 파티션 보드 (동-서 방향 마주보기 구분)
      add(S(null, { color: 0x3d5248, roughness: .85 }), .04, 1.18, 2.52, cl.gx, 0, cl.gz);
      add(mChrome, .05, .03, 2.54, cl.gx, 1.18, cl.gz);
      [-0.42, 0.42].forEach((ox, sideIdx) => {
        [-0.64, 0.64].forEach((oz, rowIdx) => {
          const dx = cl.gx + ox, dz = cl.gz + oz;
          const idx = sideIdx * 2 + rowIdx;
          // 교사 양수 철제/원목 책상
          meshAt(merge([bx(.80, .04, 1.24, 0, .74, 0), bx(.76, .72, .38, 0, .36, -.41), bx(.76, .72, .03, 0, .36, .60)]), mWood, dx, 0, dz);
          // 초록색 교무실 고무 데스크 매트
          add(matDeskPad, .46, .006, .68, dx + (ox < 0 ? -.06 : .06), .762, dz);
          // 출석부 · 생활기록부 바인더 4권 세우기
          for (let b = 0; b < 4; b++) {
            add(b % 2 ? matBinderBlue : matBinderRed, .22, .28, .045, dx + (ox < 0 ? .22 : -.22), .76, dz - .36 + b * .065);
          }
          // 3단 결재 트레이 & 서류 더미 & 삼각 명패
          add(matTrayMetal, .24, .14, .28, dx + (ox < 0 ? .18 : -.18), .76, dz + .34);
          add(mPaperN, .20, .05, .24, dx + (ox < 0 ? -.08 : .08), .765, dz - .18, { ry: rr(-.2, .2) });
          add(mWoodDark, .06, .06, .20, dx + (ox < 0 ? -.26 : .26), .76, dz + .22);
          // 전산 담당 1석에만 모니터 배치, 나머지는 유선 행정 전화기 & 스탠드 배치!
          if (ci === 1 && idx === 0) {
            monitor(dx - .14, .76, dz - .22, Math.PI / 2, { crt: true });
          } else {
            add(mBeige, .16, .09, .20, dx + (ox < 0 ? .16 : -.16), .76, dz + .02); // 행정 내선 전화기
          }
          officeChair(dx + (ox < 0 ? -.54 : .54), dz, ox < 0 ? -Math.PI / 2 : Math.PI / 2, false);
        });
      });
      col(cl.gx - .86, cl.gx + .86, cl.gz - 1.28, cl.gz + 1.28);
    });

    // ④ 남동쪽 코너: 학부모 · 학생 상담용 응접 가죽 소파 & 다탁 세트
    add(S(null, { color: 0x261e1a, roughness: .55 }), 1.55, .72, .62, cx + 2.2, 0, -2.45, { col: true });
    add(mWoodDark, 1.10, .42, .55, cx + 2.2, 0, -3.25, { col: true });
    cyl(mPorc, .04, .09, cx + 2.05, .42, -3.25, 10); cyl(mPorc, .04, .09, cx + 2.35, .42, -3.25, 10);

    fileCabinet(cx + 3.6, -8.95, -Math.PI / 2); fileCabinet(cx + 3.6, -8.05, -Math.PI / 2, true);
    model('sf_water_cooler', cx - 3.55, 0, -2.5, Math.PI / 2, { col: [.45, .45] }); glowAt(cx - 3.38, .92, -2.45, .11, glowRed); glowAt(cx - 3.38, .92, -2.55, .11, glowGreen);
    model('wooden_bookshelf_worn', cx - 2.15, 0, -2.02, Math.PI, { col: [.9, .42] });

    // ⑤ 금고 (비밀번호: 그날의 날짜 MMDD = 1012)
    { const sx = cx - 3.5, sz = -8.6;
      meshAt(merge([bx(.08, .8, .66, -.27, .4, 0), bx(.62, .8, .04, 0, .4, -.31), bx(.62, .8, .04, 0, .4, .31), bx(.62, .04, .66, 0, .02, 0), bx(.62, .04, .66, 0, .78, 0), bx(.5, .02, .55, 0, .36, 0)]), S(T.makeMetal([60, 74, 64]), { roughness: .5, metalness: .5 }), sx, 0, sz);
      const piv = dyn(new THREE.Group()); piv.position.set(sx + .31, 0, sz - .31); cur.interior.add(piv);
      const door = new THREE.Mesh(new THREE.BoxGeometry(.05, .76, .62), S(T.makeMetal([70, 86, 74]), { roughness: .45, metalness: .55 })); door.position.set(0, .4, .31); piv.add(door);
      const kp = new THREE.Mesh(new THREE.PlaneGeometry(.12, .18), new THREE.MeshBasicMaterial({ map: T.makeKeypad() })); kp.position.set(.03, .5, .45); kp.rotation.y = Math.PI / 2; piv.add(kp);
      const hd = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .03, 12), mChrome); hd.rotation.z = Math.PI / 2; hd.position.set(.04, .4, .2); piv.add(hd);
      col(sx - .32, sx + .35, sz - .34, sz + .34);
      addKey('office', 0, sx, .38, sz); const key = items[items.length - 1]; key.locked = true; key.mesh.visible = false;
      props.push({ kind: 'safe', floor: cur.f, x: sx + .9, z: sz, piv, key, open: 0, label: '금고 조사하기' }); }
    addNote('n3', cx - 2.35, .77, -5.4); tapeRecorder('tape_homeroom', cx - 1.95, .77, -5.15, .25); if (!cur.annex && cur.f === 0) { tapeRecorder('ts_vice', cx + 2.62, .42, -3.22, -.3); tapeRecorder('ts_mother', cx + 1.78, .42, -3.28, .5); }
    papers(cx, -8, -2.4, 14);
  }
    function infirmarySlot(id, kind, x, z, parts, yaw = 0) { const holder = new THREE.Group(), fallback = new THREE.Group(); holder.name = id; holder.userData.dynamic = fallback.userData.dynamic = true; holder.position.set(x, 0, z); holder.rotation.y = yaw; holder.add(fallback); cur.interior.add(holder); holder.updateWorldMatrix(true, true); parts.forEach(p => fallback.attach(p)); INFIRMARY_SLOTS.push({ id, kind, holder, fallback }); return holder; } function nurse(cx) {
    const zN = -9.6;
    if (!curSouth) frontWall(cx, zN, false);
    [-2.4, 2.4].forEach(dx => { const parts = [add(mMetal, 1.0, .5, 2.0, cx + dx, 0, zN + 1.2, { col: true }), add(mWhite, .95, .14, 1.9, cx + dx, .5, zN + 1.2), add(mWhite, .5, .1, .35, cx + dx, .64, zN + .4)]; infirmarySlot(`nurse-${cur.f}-bed-${dx < 0 ? "west" : "east"}`, "bed", cx + dx, zN + 1.2, parts); });
    { const parts = [add(mLockerT, .9, 1.7, .4, cx + 3.6, 0, -6.5, { ry: Math.PI / 2, col: true }), add(mGlass, .9, 1.7, .44, cx + 3.6, 0, -6.5, { ry: Math.PI / 2 })]; infirmarySlot(`nurse-${cur.f}-cabinet`, "cabinetClosed", cx + 3.6, -6.5, parts, -Math.PI / 2); }
    tbl(mWood, 1.2, .75, .6, cx - 3.2, 0, -5.4, { col: true, ry: Math.PI / 2, legMat: mLegMetal });
    addNote('n2', cx - 3.2, .75, -5.4);
    tapeRecorder('tape1', cx - 3.2, .75, -4.95, .4); tapeRecorder('ts_paramedic', cx - 3.2, .75, -5.8, -.3);
    blood('splat', cx + 2.4, .02, -6.0, 1.2, 0, true);
    addBattery(cx + 2.4, .5, -8.4); addMedkit(cx + 2.4, .66, -7.6);
    model('wheelchair_01', cx + 1.2, 0, -4.4, -.7, { col: [.85, 1.1] }); model('medical_box', cx + 3.86, 1.5, -4.0, -Math.PI / 2);
    papers(cx, -8, -2.4, 7);
  }
  function counsel(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    sofa(cx, -8.8, 0, 2.0); model('wooden_bookshelf_worn', cx - 3.55, 0, -4.2, Math.PI / 2, { col: [.9, .45] });
    add(mWood, 1.0, .4, .6, cx, 0, -7.4, { col: true });
    add(mFabric, .8, .45, .8, cx - 2.4, 0, -6.4, { ry: Math.PI / 2, col: true });
    shelf3D(cx + 3.55, -6.0, -Math.PI / 2, 1.4, 2.0, .45, 5, .75);
    addBattery(cx + .05, .4, -7.6); if (!cur.annex && cur.f === 0 && !curSouth) { tapeRecorder('tape_counselor', cx - 0.25, .40, -7.35, .2); }
    papers(cx, -8, -2.4, 5);
  }
  function library(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    [-2.9, 2.9].forEach(dx => [-8.2, -6.0, -3.8].forEach(z => {
      shelf3D(cx + dx, z, dx < 0 ? Math.PI / 2 : -Math.PI / 2, 2.0, 2.1, .5, 6, .9);
    }));
    // 독서 테이블 + 열쇠
    tbl(mWood, 2.4, .75, .9, cx, 0, -8.6, { col: true });
    [-.8, .8].forEach(dx => add(mWoodDark, .4, .45, .4, cx + dx, 0, -7.7));
    addKey('library', 1, cx + .6, .75, -8.6);
    addNote('n4', cx - .6, .75, -8.6); tapeRecorder('tape_librarian', cx - 0.98, .75, -8.45, .3);
    papers(cx, -8, -2.4, 10);
    // 쓰러진 책장
    { const g = shelf3D(cx + 1.6, -3.55, 0, 1.6, .5, .45, 1, 0); g.rotation.set(-Math.PI / 2 + .12, .35, 0); g.position.y = .25; }
    scatterBooks(cx + 1.4, -3.0, 18);
  }
  function lab(cx) {
    const zN = -9.6;
    frontWall(cx, zN, true, ['불을 끄지 마']);
    [-2.4, 2.4].forEach(dx => [-7.4, -4.8].forEach(z => {
      add(mBlack, 1.0, .06, 2.0, cx + dx, .86, z); add(mMetal, .9, .86, 1.9, cx + dx, 0, z, { col: true });
      [-.5, .5].forEach(dz => stool(cx + dx + (dx < 0 ? .88 : -.88), z + dz, false));
      add(mChrome, .03, .3, .03, cx + dx, .92, z - .8); add(mChrome, .14, .03, .03, cx + dx + .06, 1.2, z - .8);
    }));
    // 플라스크
    [[-2.4, -7.6], [-2.2, -7.1], [2.4, -4.6]].forEach(([dx, z]) => { const f = new THREE.Mesh(new THREE.CylinderGeometry(.06, .1, .22, 10), mLiquid); f.position.set(cx + dx, .98, z); cur.interior.add(f); });
    // 인체 골격 모형 · 현미경 · 비커 세트 (3D 소품 133종 팩: SCI-007 · SCI-005 · SCI-006)
    model('h133/SCI-007', cx + 3.3, 0, -9.0, -.35); add(mMetal, .5, .04, .5, cx + 3.3, 0, -9.0); col(cx + 3.0, cx + 3.6, -9.3, -8.7);
    model('h133/SCI-005', cx + 2.45, .92, -7.95, -.4); model('h133/SCI-005', cx - 2.35, .92, -4.15, .5); model('h133/SCI-006', cx + 2.35, .92, -5.35, Math.PI / 2);
    add(mMetal, .5, .5, .5, cx + 3.45, 0, -2.45, { col: true });   // 문 쪽 구석 (예전 -4.2 자리는 실험대와 0.3m 틈만 남아 북동쪽 구석이 갇혔다)
    if (!items.some(i => i.kind === 'key' && i.idx === 2)) addKey('lab', 2, cx - 2.4, .92, -4.8);
    addNote('n5', cx + 2.4, .92, -7.4); tapeRecorder('tape_science', cx + 2.15, .92, -6.85, -.25);
    papers(cx, -8, -2.4, 8);
    if (cur.annex) classClue(cx, 'S-01');
  }
  function computer(cx) {
    const zN = -9.6;
    frontWall(cx, zN, true, ['시스템 오류']);
    const scr = cur.pcScreens ||= [];
    // 학생용 PC 책상: 좌우 3줄 × 2대 (가운데 통로), 모두 칠판(-z)을 향한다
    const deskG = merge([bx(1.5, .04, .72, 0, .74, 0), bx(.04, .72, .68, -.73, .36, 0), bx(.04, .72, .68, .73, .36, 0), bx(1.42, .3, .02, 0, .55, -.34), bx(1.42, .02, .5, 0, .2, -.08)]);
    [-1, 1].forEach(side => [-7.2, -5.6, -4.0].forEach((z, r) => {
      const dx = side * 2.35;
      meshAt(deskG, mWood, cx + dx, 0, z); col(cx + dx - .76, cx + dx + .76, z - .37, z + .37);
      [-.36, .36].forEach((o, k) => {
        const x = cx + dx + o, broken = rnd() < .22, fallen = rnd() < .08;
        scr.push(monitor(x, .76, z - .14, 0, { cracked: broken, fallen, crt: cur.annex && rnd() < .5 }));
        pcTower(x + (o < 0 ? -.2 : .2), .2, z - .02, 0);
        if (rnd() < .85) keyboard(x + rr(-.03, .03), .76, z + .14, rr(-.08, .08));
        if (rnd() < .7) mouse(x + .27, .77, z + .16, rr(-.4, .4));
        cable([[x, .76, z - .3], [x + .05, .5, z - .36], [x + rr(-.1, .1), .01, z - .3]]);
        officeChair(x, z + .68, Math.PI + rr(-.15, .15), false);
      });
    }));
    // 교사용 책상 + PC, 서버 랙, 프린터, 서류함
    teacherDesk(cx + 2.6, -8.75);
    monitor(cx + 2.4, .78, -8.95, 0, {});
    keyboard(cx + 2.4, .78, -8.6, 0);
    printer(cx + 3.05, .78, -8.85, -.2);
    serverRack(cx - 3.45, -9.1, 0);
    cable([[cx - 3.45, .1, -8.7], [cx - 3.0, .01, -8.5], [cx - 1.6, .01, -8.3], [cx - 1, .01, -7.9]]);
    fileCabinet(cx + 3.62, -2.5, -Math.PI / 2, true);
    add(mMetal, .5, .9, 1.2, cx - 3.62, 0, -2.6, { col: true });
    printer(cx - 3.62, .9, -2.6, Math.PI / 2);
    plane(cur.interior, mDirtPaper, .21, .29, cx - 3.2, .012, -3.1, 0, -Math.PI / 2);
    addBattery(cx - 2.35, .78, -3.85);
    if (!props.some(p => p.id === 'clsC-01')) classClue(cx, 'C-01');
    papers(cx, -8, -2.4, 6);
  }
  function music(cx) {
    const zN = -9.6;
    frontWall(cx, zN, true, ['도 레 미 파']);
    // 그랜드 피아노
    grandPiano(cx + 2.0, -7.75); (cur.furnOcc ||= []).push({ x: cx + 2.0, z: -7.0, w: 1.8, d: 3.2 });
    boardRefs['piano' + cur.f] = { floor: cur.f, x: cx + 2.0, z: -7.75 };
    addBattery(cx + 2.0, .98, -7.0);
    deskChair(cx - 2.4, -7.75, .4); addNote('n6', cx - 2.4, .46, -7.75);
    // 보면대/의자
    [-2.6, -1.3, 0].forEach((dx, k) => {
      const x = cx - 1.1 + dx, z = -5.2 + k * .2;
      meshAt(merge([tube(.01, 0, 0, 0, 0, 1.0, 0), tube(.008, 0, .02, 0, .2, 0, .12), tube(.008, 0, .02, 0, -.2, 0, .12), tube(.008, 0, .02, 0, 0, 0, -.22)]), mFrame, x, 0, z);
      const st = meshAt(new THREE.BoxGeometry(.42, .3, .01), mFrame, x, 1.1, z + .02); st.rotation.x = -.3;
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(.38, .26), mDirtPaper); sh.position.z = .007; st.add(sh);
      deskChair(x, z + .8); (cur.furnOcc ||= []).push({ x, z: z + .4, w: .7, d: 1.4 });
    });
    // 드럼 세트 + 기타
    { const dx = cx - 3.1, dz = -8.85, mDrum = S(null, { color: 0x6a1a1a, roughness: .35, metalness: .2 });
      const bd = cyl(mDrum, .26, .4, dx, .26, dz); bd.rotation.x = Math.PI / 2; bd.position.y = .27;
      [[-.35, .55, .25], [.35, .55, .2]].forEach(([ox, y, r]) => { cyl(mDrum, r, .16, dx + ox, y, dz + .25); cyl(mChrome, .012, y, dx + ox, 0, dz + .25, 6); });
      [[-.55, 1.0], [.6, 1.1]].forEach(([ox, y]) => { cyl(S(null, { color: 0xb8902a, roughness: .3, metalness: .8 }), .2, .01, dx + ox, y, dz - .1); cyl(mChrome, .01, y, dx + ox, 0, dz - .1, 6); });
      col(dx - .7, dx + .7, dz - .4, dz + .5);
      const gt = new THREE.Group(); gt.position.set(cx - 3.75, 0, -6.4); gt.rotation.set(0, Math.PI / 2, -.22); cur.interior.add(gt);
      gt.add(new THREE.Mesh(merge([new THREE.CylinderGeometry(.17, .17, .08, 16).rotateX(Math.PI / 2).translate(0, .25, 0), new THREE.CylinderGeometry(.13, .13, .08, 16).rotateX(Math.PI / 2).translate(0, .5, 0)]), mWood));
      gt.add(new THREE.Mesh(merge([bx(.05, .55, .025, 0, .9, 0), bx(.08, .14, .03, 0, 1.23, 0)]), mWoodDark)); }
    // 벽면 음악가 초상 대신 오선지 게시판
    plane(cur.interior, mCork, 1.6, .9, cx + 3.85, 1.7, -5.2, -Math.PI / 2);
    papers(cx, -8, -2.4, 12);
    if (!props.some(p => p.id === 'clsM-01')) classClue(cx, 'M-01');
  }
  // 미술실 (미술실 3D 렌더링 뷰 · 가구/소품 상세 시트): 서쪽 벽 = 싱크대 · 오픈 선반 · 사물함, 동쪽 벽 = 석고상 진열대 · 재료 캐비닛 · 작품 건조대 · 이동 카트,
  // 북쪽(창가) = 정물대 + 게시판, 가운데 = 학생 작업 테이블, 남쪽(문 옆) = 교사 책상 · 기대 놓은 캔버스
  let AM = null;
  const artMats = () => {
    if (AM) return AM;
    const cv = (w, h, draw, alpha) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    const COLS = ['#b8322a', '#2f58a8', '#d8b83a', '#2e8a4c', '#e8e4d8', '#7a3a8a', '#d87a2a', '#1e1e22'];
    const splat = (g, w, h, n, a = .8) => { for (let i = 0; i < n; i++) { g.globalAlpha = a * (.4 + rnd() * .6); g.fillStyle = pick(COLS); const x = rnd() * w, y = rnd() * h, r = 2 + rnd() * rnd() * 22; g.beginPath(); g.ellipse(x, y, r, r * (.5 + rnd() * .6), rnd() * 3, 0, 7); g.fill(); for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + (rnd() - .5) * r * 4, y + (rnd() - .5) * r * 4, 1 + rnd() * 2.5, 0, 7); g.fill(); } } g.globalAlpha = 1; };
    const grime = (g, w, h, n, c = '40,30,20') => { for (let i = 0; i < n; i++) { const x = rnd() * w, y = rnd() * h, r = 10 + rnd() * 80, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},${.05 + rnd() * .12})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } };
    // 물감 얼룩진 작업 테이블 상판
    const top = cv(512, 300, (g, w, h) => { g.fillStyle = '#6e5238'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(30,18,8,.35)'; for (let i = 0; i < 40; i++) { g.lineWidth = .5 + rnd() * 1.5; g.beginPath(); const y = rnd() * h; g.moveTo(0, y); g.bezierCurveTo(w * .3, y + rnd() * 8 - 4, w * .6, y + rnd() * 8 - 4, w, y + rnd() * 6 - 3); g.stroke(); } grime(g, w, h, 30); splat(g, w, h, 70); g.strokeStyle = 'rgba(230,220,200,.25)'; for (let i = 0; i < 25; i++) { g.lineWidth = 1; g.beginPath(); const x = rnd() * w, y = rnd() * h; g.moveTo(x, y); g.lineTo(x + rnd() * 40 - 20, y + rnd() * 10 - 5); g.stroke(); } });
    // 미술실 게시판: 초록 펠트 + 공지 · 스케치 · 색상환 · 압정
    const board = cv(1024, 512, (g, w, h) => {
      g.fillStyle = '#2b3a31'; g.fillRect(0, 0, w, h); grime(g, w, h, 60, '10,14,10');
      const paper = (x, y, pw, ph, rot, fill, draw) => { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-pw / 2 + 4, -ph / 2 + 5, pw, ph); g.fillStyle = fill; g.fillRect(-pw / 2, -ph / 2, pw, ph); draw && draw(pw, ph); g.fillStyle = '#b02a22'; g.beginPath(); g.arc(0, -ph / 2 + 10, 5, 0, 7); g.fill(); g.restore(); };
      const lines = (pw, ph, n) => { g.fillStyle = 'rgba(40,36,30,.55)'; for (let i = 0; i < n; i++) g.fillRect(-pw / 2 + 12, -ph / 2 + 30 + i * 13, (pw - 24) * (.5 + rnd() * .5), 3); };
      paper(110, 110, 150, 110, -.04, '#e6dcc4', (pw, ph) => { g.fillStyle = '#2a2420'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.fillText('미술실 게시판', 0, -ph / 2 + 36); lines(pw, ph + 30, 4); });
      paper(290, 150, 120, 170, .05, '#efe8d6', (pw, ph) => lines(pw, ph, 9));
      paper(450, 120, 140, 110, -.03, '#e8d898', (pw, ph) => { g.fillStyle = '#3a2a20'; g.font = '18px sans-serif'; g.textAlign = 'center'; g.fillText('실기 평가 일정', 0, -ph / 2 + 34); lines(pw, ph + 20, 4); });
      paper(150, 330, 170, 200, .06, '#ddd4bc', (pw, ph) => { g.strokeStyle = 'rgba(30,26,22,.7)'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, -10, 40, 52, 0, 0, 7); g.stroke(); g.beginPath(); g.moveTo(-50, 70); g.quadraticCurveTo(0, 30, 50, 70); g.stroke(); for (let i = 0; i < 30; i++) { g.lineWidth = .6; g.beginPath(); const a = rnd() * 6.3; g.moveTo(Math.cos(a) * 38, -10 + Math.sin(a) * 50); g.lineTo(Math.cos(a) * 46, -10 + Math.sin(a) * 58); g.stroke(); } });
      paper(360, 360, 150, 150, -.05, '#e9e2cf', (pw, ph) => { g.strokeStyle = 'rgba(30,26,22,.65)'; g.lineWidth = 2; g.strokeRect(-40, -10, 80, 60); g.beginPath(); g.ellipse(-15, 5, 14, 22, 0, 0, 7); g.stroke(); g.beginPath(); g.arc(20, 25, 16, 0, 7); g.stroke(); });
      paper(570, 300, 210, 270, .02, '#e6dfcc', (pw, ph) => { const R = 80; for (let i = 0; i < 12; i++) { g.fillStyle = `hsl(${i * 30},55%,45%)`; g.beginPath(); g.moveTo(0, 10); g.arc(0, 10, R, i * Math.PI / 6, (i + 1) * Math.PI / 6); g.fill(); } g.fillStyle = '#e6dfcc'; g.beginPath(); g.arc(0, 10, 28, 0, 7); g.fill(); g.fillStyle = '#2a2420'; g.font = '16px sans-serif'; g.textAlign = 'center'; g.fillText('색상환', 0, ph / 2 - 18); });
      paper(770, 140, 160, 190, -.06, '#d9cfb6', (pw, ph) => { g.fillStyle = 'rgba(120,30,24,.85)'; g.font = 'bold 20px serif'; g.textAlign = 'center'; g.fillText('다시, 여기서.', 0, 0); g.fillText('다시, 여기서.', 4, 28); });
      paper(800, 370, 180, 150, .04, '#ece6d4', (pw, ph) => lines(pw, ph, 7));
      paper(950, 250, 110, 140, -.08, '#e1d7bd', (pw, ph) => { g.strokeStyle = 'rgba(30,26,22,.6)'; g.lineWidth = 1.5; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-40, -50 + i * 18); g.quadraticCurveTo(0, -60 + i * 18 + rnd() * 20, 40, -50 + i * 18); g.stroke(); } });
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 10; g.strokeRect(0, 0, w, h);
    });
    // 제23회 교내 미술전 포스터
    const poster = cv(512, 724, (g, w, h) => {
      g.fillStyle = '#d9ceb2'; g.fillRect(0, 0, w, h); grime(g, w, h, 50);
      g.fillStyle = '#2a2420'; g.font = 'bold 44px serif'; g.fillText('제23회', 40, 90); g.font = 'bold 56px serif'; g.fillText('교내 미술전', 40, 160);
      g.strokeStyle = 'rgba(40,34,28,.75)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(250, 400, 90, 120, 0, 0, 7); g.stroke(); g.beginPath(); g.moveTo(130, 600); g.quadraticCurveTo(250, 500, 370, 600); g.stroke();
      for (let i = 0; i < 80; i++) { g.lineWidth = .7; g.beginPath(); const x = 160 + rnd() * 180, y = 290 + rnd() * 230; g.moveTo(x, y); g.lineTo(x + 8, y + 12); g.stroke(); }
      g.fillStyle = '#3a2a22'; g.font = '24px serif'; g.fillText('예술은,', 40, 230); g.fillText('언젠가 다시 피어나니까.', 40, 262);
      g.fillStyle = 'rgba(90,60,30,.25)'; g.fillRect(0, h - 40, w, 40); g.fillStyle = '#2a2420'; g.font = '18px sans-serif'; g.fillText('1 9 9 8 . 1 0 . 1 2  ·  별관 3층 미술실', 40, h - 14);
      g.fillStyle = 'rgba(60,40,20,.35)'; g.beginPath(); g.moveTo(w, 0); g.lineTo(w - 70, 0); g.lineTo(w, 90); g.fill();
    });
    // 바닥 물감 얼룩 데칼 · 팔레트 · 앞치마
    const spill = cv(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); const c = pick(COLS); g.fillStyle = c; g.globalAlpha = .85; g.beginPath(); g.ellipse(128, 128, 70, 46, rnd() * 3, 0, 7); g.fill(); for (let i = 0; i < 22; i++) { g.beginPath(); g.arc(128 + (rnd() - .5) * 220, 128 + (rnd() - .5) * 220, 2 + rnd() * 9, 0, 7); g.fill(); } }, true);
    const palette = cv(256, 200, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#8a6a44'; g.beginPath(); g.ellipse(128, 100, 124, 96, 0, 0, 7); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.ellipse(200, 130, 16, 20, 0, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over'; COLS.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.ellipse(50 + (i % 4) * 40, 60 + (i / 4 | 0) * 70 + rnd() * 10, 14, 11, rnd() * 3, 0, 7); g.fill(); }); splat(g, w, h, 30, .5); }, true);
    const apron = cv(256, 320, (g, w, h) => { g.fillStyle = '#cfc3a6'; g.fillRect(0, 0, w, h); grime(g, w, h, 30); splat(g, w, h, 60); g.strokeStyle = 'rgba(60,50,40,.4)'; g.lineWidth = 3; g.strokeRect(60, 150, 136, 90); });
    const M = o => S(null, o);
    AM = {
      top: new THREE.MeshStandardMaterial({ map: top, roughness: .7 }),
      board: new THREE.MeshStandardMaterial({ map: board, roughness: .9 }),
      poster: new THREE.MeshStandardMaterial({ map: poster, roughness: .95 }),
      spill: new THREE.MeshStandardMaterial({ map: spill, transparent: true, depthWrite: false, roughness: .4, polygonOffset: true, polygonOffsetFactor: -2 }),
      palette: new THREE.MeshStandardMaterial({ map: palette, alphaTest: .5, roughness: .6, side: THREE.DoubleSide }),
      apron: new THREE.MeshStandardMaterial({ map: apron, roughness: .95, side: THREE.DoubleSide }),
      steel: grunge(S(T.makeMetal([136, 140, 138]), { roughness: .42, metalness: .55 })),
      basin: M({ color: 0x2a2c2a, roughness: .3, metalness: .6 }),
      plaster: M({ color: 0xdad6cc, roughness: .85 }),
      rag: M({ color: 0xa89c84, roughness: 1, side: THREE.DoubleSide }),
      tubes: COLS.slice(0, 7).map(c => M({ color: c, roughness: .45, metalness: .2 })),
      jar: new THREE.MeshStandardMaterial({ color: 0x7a8a7a, transparent: true, opacity: .55, roughness: .15 }),
      water: new THREE.MeshStandardMaterial({ color: 0x5a6a5a, transparent: true, opacity: .7, roughness: .1 }),
      wire: (() => { const t = cv(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = '#c8ccc8'; g.lineWidth = 3; for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 6); return new THREE.MeshStandardMaterial({ map: t, alphaTest: .4, side: THREE.DoubleSide, roughness: .4, metalness: .6 }); })(),
      clay: M({ color: 0xa88a66, roughness: .95 }), bristle: M({ color: 0x3a2c1e, roughness: .9 }), tape: M({ color: 0xd8cca8, roughness: .8 }),
    };
    return AM;
  };
  const bustG = merge([new THREE.CylinderGeometry(.1, .13, .1, 14).translate(0, .05, 0), new THREE.SphereGeometry(.15, 14, 10).scale(1, .45, .65).translate(0, .14, 0), new THREE.CylinderGeometry(.04, .05, .12, 10).translate(0, .24, 0), new THREE.SphereGeometry(.085, 16, 12).scale(.9, 1.12, 1).translate(0, .36, .005), new THREE.SphereGeometry(.03, 8, 6).translate(0, .35, .08)]);
  function bust(x, y, z, ry, s = 1) { const m = meshAt(bustG, artMats().plaster, x, y, z, ry); m.scale.setScalar(s); return m; }
  // 붓 꽂힌 물통 · 물감 튜브 · 팔레트 · 마스킹 테이프 (테이블 · 카트 위 소품)
  function brushJar(x, y, z) {
    const A = artMats(); cyl(A.jar, .05, .14, x, y, z, 12); cyl(A.water, .046, .07, x, y + .005, z, 12);
    const st = []; for (let i = 0; i < 6; i++) { const a = rnd() * 6.3, r = .025; st.push(tube(.005, x + Math.cos(a) * r * .4, y + .05, z + Math.sin(a) * r * .4, x + Math.cos(a) * r * 2.4, y + .3 + rnd() * .08, z + Math.sin(a) * r * 2.4)); }
    meshAt(merge(st), mWoodDark, 0, 0, 0);
  }
  function paintTubes(x, y, z, n = 5) { const A = artMats(); for (let i = 0; i < n; i++) { const m = meshAt(new THREE.CylinderGeometry(.013, .016, .11, 8).rotateZ(Math.PI / 2), pick(A.tubes), x + rr(-.12, .12), y + .015, z + rr(-.08, .08), rnd() * 6); m.rotation.x = rr(-.1, .1); } }
  function palette(x, y, z) { const p = meshAt(new THREE.PlaneGeometry(.32, .25), artMats().palette, x, y + .006, z); p.rotation.x = -Math.PI / 2; p.rotation.z = rnd() * 6; }
  function art(cx) {
    const zN = -9.6, A = artMats(), W0 = cx - 3.85, E0 = cx + 3.85;
    frontWall(cx, zN, false);
    // 창가: 게시판 (W2400 × H1200)
    meshAt(merge([bx(2.56, 1.34, .05, 0, 1.95, 0)]), mWoodDark, cx, 0, zN + .03); plane(cur.interior, A.board, 2.42, 1.2, cx, 1.95, zN + .062);
    // 정물대 (석고상 · 천 커버 · 병 · 사과) + 받침대 위 석고 흉상
    meshAt(merge([bx(.9, .7, .8, 0, .35, 0)]), A.plaster, cx, 0, -8.45); col(cx - .45, cx + .45, -8.85, -8.05, false, .7);
    curtain(cx, .42, -8.03, .96, .56); curtain(cx - .46, .42, -8.45, .8, .56, Math.PI / 2);
    bust(cx - .2, .7, -8.55, .3, .85);
    cyl(new THREE.MeshStandardMaterial({ color: 0x2a5a3a, transparent: true, opacity: .8, roughness: .1 }), .04, .26, cx + .18, .7, -8.6, 12);
    meshAt(new THREE.SphereGeometry(.05, 12, 10), S(null, { color: 0xa82a20, roughness: .5 }), cx + .26, .75, -8.3); meshAt(new THREE.SphereGeometry(.045, 12, 10), S(null, { color: 0x8a9a2a, roughness: .5 }), cx + .12, .745, -8.25);
    add(A.plaster, .42, 1.0, .42, cx + 1.55, 0, -9.0, { col: true }); bust(cx + 1.55, 1.0, -9.0, .2);
    [[cx + 1.1, -8.5], [cx + 1.25, -8.3], [cx + .95, -8.25]].forEach(([x, z]) => meshAt(new THREE.DodecahedronGeometry(.04 + rnd() * .04, 0), A.plaster, x, .03, z, rnd() * 6));   // 깨진 석고 파편
    // 이젤 존: 정물대를 바라보는 이젤 4개 + 뒤에 스툴
    const TZ = -8.45;
    [[-1.95, -6.75], [-.7, -6.2], [.7, -6.2], [1.95, -6.75]].forEach(([dx, z], k) => {
      easel(cx + dx, z, Math.atan2(-dx, -(TZ - z)) + Math.PI, k);
      const L = Math.hypot(dx, z - TZ); stool(cx + dx + dx / L * .78, z + (z - TZ) / L * .78, false);
    });
    // 서쪽 벽 ① 수채화용 싱크대 (W1800 × D700 × H850) — 수전 2개 · 걸레 · 양동이
    const sx = W0 + .35, sz = -8.4;
    meshAt(merge([bx(.7, .06, 1.8, 0, .82, 0), bx(.04, .3, 1.8, -.33, 1.0, 0), bx(.62, .03, 1.7, 0, .22, 0), bx(.03, .22, 1.8, .335, .7, 0),
      ...[[-.3, -.85], [.3, -.85], [-.3, .85], [.3, .85]].map(([a, b]) => bx(.04, .82, .04, a, .41, b))]), A.steel, sx, 0, sz);
    [-.45, .45].forEach(dz => { plane(cur.interior, A.basin, .48, .62, sx + .02, .853, sz + dz, 0, -Math.PI / 2); meshAt(merge([tube(.014, -.3, .85, 0, -.3, 1.08, 0), tube(.014, -.3, 1.08, 0, -.12, 1.08, 0), tube(.012, -.12, 1.08, 0, -.12, 1.0, 0)]), mChrome, sx, 0, sz + dz); });
    plane(cur.interior, A.rag, .3, .42, sx + .36, .62, sz + .55, Math.PI / 2);
    cyl(mBlue, .13, .22, sx - .05, .235, sz - .5, 14); cyl(S(null, { color: 0xc8a030, roughness: .6 }), .11, .2, sx, .235, sz + .2, 14);
    cyl(A.jar, .045, .16, sx + .1, .85, sz - .05, 10); cyl(A.jar, .05, .12, sx - .12, .85, sz + .1, 10);
    col(W0, W0 + .7, sz - .9, sz + .9, false, .85);
    // ② 오픈 선반 (W1200 × D400 × H1800) — 물감 병 · 재료 상자 · 앞치마
    const ox = W0 + .2, oz = -6.55;
    meshAt(merge([...[-.58, .58].map(b => bx(.4, 1.8, .03, 0, .9, b)), ...[.04, .44, .84, 1.24, 1.64].map(y => bx(.4, .03, 1.16, 0, y, 0))]), mWoodDark, ox, 0, oz);
    [.06, .46, .86, 1.26].forEach((y, r) => { for (let i = 0; i < 5; i++) { const z = oz - .45 + i * .22 + rr(-.03, .03); if (r % 2 && i % 2) add(mCardboard, .3, .2 + rnd() * .1, .2, ox, y, z, { ry: rr(-.2, .2) }); else cyl(rnd() < .5 ? A.jar : pick(A.tubes), .05 + rnd() * .03, .12 + rnd() * .12, ox + rr(-.06, .06), y, z, 10); } });
    plane(cur.interior, A.apron, .42, .62, ox + .215, 1.05, oz + .25, Math.PI / 2);
    col(W0, W0 + .4, oz - .6, oz + .6);
    // ③ 학생 사물함 4칸 (W300 × D450 × H1800)
    const lz = -4.95;
    meshAt(merge([bx(.45, 1.8, 1.2, 0, .9, 0)]), mLocker, W0 + .225, 0, lz);
    for (let i = 0; i < 4; i++) { plane(cur.interior, mLockerT, .28, 1.72, W0 + .452, .9, lz - .45 + i * .3, Math.PI / 2); if (rnd() < .5) plane(cur.interior, mPaperN, .1, .1, W0 + .456, 1.3 + rnd() * .2, lz - .45 + i * .3 + rr(-.05, .05), Math.PI / 2); }
    col(W0, W0 + .45, lz - .6, lz + .6);
    // 서쪽 벽 포스터 · 걸린 스케치
    plane(cur.interior, A.poster, .62, .88, W0 + .015, 1.75, -3.25, Math.PI / 2);
    [[-2.55, 1.9], [-3.75, 2.5]].forEach(([z, y], k) => { const p = plane(cur.interior, mPaints[(k + 1) % 4], .38, .48, W0 + .02, y, z, Math.PI / 2); p.rotation.z = rr(-.08, .08); });
    mopBucket(W0 + .4, -2.25);
    // 동쪽 벽 ① 석고상 진열대 (W1200 × D400 × H1800)
    const ex = E0 - .2, ez = -8.7;
    meshAt(merge([...[-.58, .58].map(b => bx(.4, 1.8, .03, 0, .9, b)), ...[.04, .6, 1.16, 1.72].map(y => bx(.4, .03, 1.16, 0, y, 0))]), mWoodDark, ex, 0, ez);
    [[.62, -.34], [.62, .34], [1.18, 0], [1.74, -.28]].forEach(([y, dz], k) => bust(ex - .02, y, ez + dz, -Math.PI / 2, .75));
    col(E0 - .4, E0, ez - .6, ez + .6);
    // ② 재료 보관 캐비닛 (W900 × D450 × H1800, 유리문)
    const kx = E0 - .225, kz = -7.4;
    meshAt(merge([bx(.45, .04, .9, 0, .02, 0), bx(.45, .04, .9, 0, 1.78, 0), bx(.03, 1.8, .9, .21, .9, 0), bx(.45, 1.8, .03, 0, .9, -.435), bx(.45, 1.8, .03, 0, .9, .435), bx(.4, .02, .84, .02, .62, 0), bx(.4, .02, .84, .02, 1.2, 0), bx(.03, 1.74, .03, -.21, .9, 0)]), A.steel, kx, 0, kz);
    [-.215, .215].forEach(dz => plane(cur.interior, mGlass, .41, 1.7, kx - .226, .9, kz + dz, -Math.PI / 2));
    [.64, 1.22].forEach(y => { for (let i = 0; i < 5; i++) cyl(rnd() < .5 ? A.jar : pick(A.tubes), .04 + rnd() * .03, .1 + rnd() * .14, kx + rr(-.08, .1), y, kz - .32 + i * .16, 10); });
    for (let i = 0; i < 3; i++) add(mCardboard, .3, .18, .25, kx + .03, .04, kz - .28 + i * .28, { ry: rr(-.1, .1) });
    col(E0 - .45, E0, kz - .45, kz + .45);
    // ③ 작품 건조대 (W1000 × D600 × H1500) — 철망 선반에 마르는 그림
    const dx0 = E0 - .3, dz0 = -6.05;
    meshAt(merge([...[[-.28, -.48], [.28, -.48], [-.28, .48], [.28, .48]].map(([a, b]) => tube(.012, a, 0, b, a, 1.5, b)), ...Array.from({ length: 12 }, (_, i) => bx(.58, .012, .012, 0, .14 + i * .125, -.48)), ...Array.from({ length: 12 }, (_, i) => bx(.58, .012, .012, 0, .14 + i * .125, .48))]), mChrome, dx0, 0, dz0);
    for (let i = 0; i < 11; i++) plane(cur.interior, A.wire, .56, .96, dx0, .14 + i * .125, dz0, 0, -Math.PI / 2);
    for (let i = 0; i < 11; i++) if (rnd() < .7) { const p = plane(cur.interior, rnd() < .4 ? mPaints[i % 4] : mDirtPaper, .44, .34, dx0 + rr(-.04, .04), .15 + i * .125, dz0 + rr(-.2, .2), 0, -Math.PI / 2); p.rotation.order = 'YXZ'; p.rotation.y = rr(-.2, .2); }
    col(E0 - .6, E0, dz0 - .5, dz0 + .5);
    // ④ 이동식 작업 카트 (W800 × D450 × H850)
    const cx2 = E0 - .3, cz2 = -4.45;
    meshAt(merge([...[[-.2, -.38], [.2, -.38], [-.2, .38], [.2, .38]].map(([a, b]) => tube(.012, a, .06, b, a, .85, b)), ...[.18, .5, .82].map(y => bx(.44, .02, .8, 0, y, 0))]), mChrome, cx2, 0, cz2);
    [[-.2, -.38], [.2, -.38], [-.2, .38], [.2, .38]].forEach(([a, b]) => meshAt(new THREE.CylinderGeometry(.035, .035, .025, 10).rotateZ(Math.PI / 2), mBlack, cx2 + a, .035, cz2 + b));
    brushJar(cx2, .83, cz2 - .2); paintTubes(cx2, .83, cz2 + .15, 4); paintTubes(cx2, .51, cz2, 5); add(mCardboard, .3, .14, .3, cx2, .19, cz2 + .1);
    col(E0 - .52, E0 - .08, cz2 - .4, cz2 + .4, false, .85);
    // 가운데: 학생 작업 테이블 2개 (W1200 × D700 × H750) + 스툴
    const tz = -4.1;
    [-1.2, 0].forEach((dx, k) => {
      const x = cx + dx - .0;
      meshAt(merge([...[[-.55, -.3], [.55, -.3], [-.55, .3], [.55, .3]].map(([a, b]) => bx(.05, .72, .05, a, .36, b)), bx(1.1, .04, .04, 0, .2, -.3), bx(1.1, .04, .04, 0, .2, .3)]), mMetal, x, 0, tz);
      meshAt(merge([bx(1.2, .045, .7, 0, .728, 0)]), A.top, x, 0, tz);
      palette(x + (k ? .25 : -.2), .75, tz + rr(-.15, .1)); brushJar(x + (k ? -.35 : .35), .75, tz - .18); paintTubes(x, .75, tz + .12, 4 + k);
      cyl(A.water, .045, .1, x + (k ? .45 : -.45), .75, tz - .2, 10);
    });
    meshAt(merge([bx(.26, .025, .34, 0, 0, 0)]), S(null, { color: 0x5a4632, roughness: .9 }), cx - .9, .765, tz + .05, .3);   // 스케치북
    plane(cur.interior, mPaints[1], .24, .32, cx - .9, .78, tz + .05, 0, -Math.PI / 2).rotation.z = -.3;
    meshAt(merge([bx(.12, .06, .08, 0, 0, 0)]), A.clay, cx + .4, .78, tz + .2, .5);   // 점토 덩어리
    meshAt(new THREE.TorusGeometry(.035, .015, 6, 14).rotateX(Math.PI / 2), A.tape, cx - .1, .765, tz - .22);   // 마스킹 테이프
    col(cx - 1.8, cx + .6, tz - .35, tz + .35, false, .75);
    [[-1.5, -.62], [-.3, -.6], [-1.3, .62], [.15, .6]].forEach(([dx, dz], k) => stool(cx + dx, tz + dz, k === 3 && rnd() < .3));
    // 남쪽(문 옆): 교사 책상 + 책상 위 소품, 벽 작품, 기대 놓은 캔버스
    teacherDesk(cx + 2.55, -3.15);
    brushJar(cx + 2.05, .78, -3.25); add(mBooks, .3, .12, .22, cx + 3.0, .78, -3.2); bust(cx + 2.6, .78, -3.32, Math.PI, .55);
    meshAt(merge([bx(.22, .02, .3, 0, 0, 0)]), mPaperN, cx + 2.45, .785, -3.0, .2);
    [[-3.0, 1.95, .5, .62], [-2.15, 1.7, .42, .52], [2.55, 2.05, .62, .48], [3.35, 1.7, .34, .44]].forEach(([dx, y, w, h], k) => {
      meshAt(merge([bx(w + .06, h + .06, .03, 0, 0, 0)]), mWoodDark, cx + dx, y, -1.77, Math.PI); plane(cur.interior, mPaints[(k + 2) % 4], w, h, cx + dx, y, -1.79, Math.PI);
    });
    [0, 1, 2].forEach(k => { const c = add(k === 1 ? mWoodDark : mWhite, .6 - k * .08, .8 - k * .1, .025, cx - 2.55 + k * .05, 0, -1.9 - k * .05); c.rotation.x = -.18; c.position.y = .38 - k * .05; });
    col(cx - 2.9, cx - 2.2, -2.05, -1.75);
    bin(cx - 1.5, -2.05);
    // 바닥: 물감 얼룩 · 떨어진 종이 · 걸레
    [[-1.0, -5.2], [1.3, -4.9], [-2.6, -7.8], [.4, -7.3], [2.3, -2.4]].forEach(([dx, z]) => { const s = plane(cur.interior, A.spill, .5 + rnd() * .4, .5 + rnd() * .4, cx + dx, .011, z, 0, -Math.PI / 2); s.rotation.z = rnd() * 6; s.renderOrder = 1; });
    curtain(cx + 1.0, .02, -5.4, .4, .3); cur.interior.children[cur.interior.children.length - 1].rotation.x = -Math.PI / 2;
    addBattery(sx, .85, sz + .2);
    papers(cx, -7.6, -2.4, 10);
    if (!props.some(p => p.id === 'clsA-01')) classClue(cx, 'A-01');
  }
  /* ---------- 화장실 (1990~2000년대 학교 화장실) ----------
     북벽 칸 4개(화변기 2 · 양변기 2) · 서벽 소변기 4 + 가림판 · 동벽 벽걸이 세면대 4 + 긴 거울 · 북동 청소 구역 · 복도벽 청소도구함 · 핸드 드라이어
     벽은 1.8m 높이까지 아이보리 유약 타일 + 청색 띠 타일, 바닥은 낡은 타일 (Poly Haven CC0 Worn Tile Floor) */
  const mTWall = PB('twall', () => T.pbrToiletWall(512));
  const mTBand = (() => { const m = mTWall.clone(); m.color = new THREE.Color(0x5f86ae); return m; })();
  const mTFloor = PB('tfloor', () => T.pbrTile(512), { color: 0xb8b4ac });
  const mStall = (() => { const m = PB('paint', () => T.pbrPaintMetal(512), { metalness: .12 }); m.color = new THREE.Color(0xa9bdb2); return m; })();
  const mStallDoor = (() => { const m = mStall.clone(); m.color = new THREE.Color(0x8fa6b8); return m; })();
  const mAlu = S(null, { color: 0xc2c6c4, roughness: .35, metalness: .3 });
  const mTap = S(null, { color: 0xd4d8d8, roughness: .22, metalness: .35 });
  const mHoleW = new THREE.MeshStandardMaterial({ color: 0x15140f, roughness: .05, metalness: .1 });
  const mSeat = S(null, { color: 0x1e1e1c, roughness: .45 });
  const mPorcIn = S(null, { color: 0xb4b0a4, roughness: .2, side: THREE.DoubleSide });
  const mPipe = S(null, { color: 0x6c7470, roughness: .55, metalness: .45 });
  const mTrim = S(null, { color: 0xd8d2c0, roughness: .35 });
  const mGrime = new THREE.MeshStandardMaterial({ roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    map: T.ctex(16, 128, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(30,26,18,.85)'); gr.addColorStop(.35, 'rgba(40,34,22,.35)'); gr.addColorStop(1, 'rgba(40,34,22,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }) });
  const mPuddle = new THREE.MeshStandardMaterial({ color: 0x1a1c1a, roughness: .04, metalness: .2, transparent: true, opacity: .55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3,
    alphaMap: T.ctex(128, 128, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9; i++) { const x = 30 + rnd() * 68, y = 30 + rnd() * 68, r = 14 + rnd() * 26, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(.7, '#ddd'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } }, { repeat: false }) });
  const mStainU = new THREE.MeshStandardMaterial({ roughness: .8, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3,
    map: T.ctex(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); for (let i = 0; i < 6; i++) { const x = 40 + rnd() * 48, y = 40 + rnd() * 48, r = 20 + rnd() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(120,98,40,.35)'); gr.addColorStop(1, 'rgba(120,98,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } }, { repeat: false }) });
  // 낡은 거울: 어두운 반사 톤 + 가장자리 은박 벗겨짐(검은 점) + 물때 + 한쪽 금
  const mMirrorT = new THREE.MeshStandardMaterial({ roughness: .1, metalness: .15, emissive: 0x101414,
    map: T.ctex(512, 160, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w * .3, h); gr.addColorStop(0, '#9aa6a6'); gr.addColorStop(.45, '#6c7878'); gr.addColorStop(1, '#4a5454'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(200,210,205,.05)'; for (let i = 0; i < 14; i++) { const x = rnd() * w; g.fillRect(x, 0, 8 + rnd() * 30, h); }
      for (let i = 0; i < 700; i++) { const e = rnd(), x = e < .5 ? (rnd() < .5 ? rnd() * 22 : w - rnd() * 22) : rnd() * w, y = e < .5 ? rnd() * h : (rnd() < .5 ? rnd() * 12 : h - rnd() * 12); g.fillStyle = `rgba(8,8,6,${.3 + rnd() * .6})`; g.beginPath(); g.arc(x, y, .6 + rnd() * 2.6, 0, 6.3); g.fill(); }
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(190,190,170,.08)'; g.beginPath(); g.arc(rnd() * w, h * (.55 + rnd() * .45), 2 + rnd() * 6, 0, 6.3); g.fill(); }
      g.strokeStyle = 'rgba(230,235,230,.55)'; g.lineWidth = 1.2; const cx0 = w * .86, cy0 = h * .38;
      for (let k = 0; k < 7; k++) { let x = cx0, y = cy0, a = k * .9 + rnd() * .5; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 9; j++) { a += (rnd() - .5) * .5; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); } g.stroke(); }
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 3; g.strokeRect(1, 1, w - 2, h - 2);
    }, { repeat: false }) });
  // 벽 마감 (wall: 'n' 북 · 's' 복도벽 · 'w' 서 · 'e' 동). 텍스처 1장 = 2m
  function clad(wall, a, b, y1, y2, mat, X0, X1, Z0, Z1) {
    const w = b - a, h = y2 - y1, g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w + a) / 2, (uv.getY(i) * h + y1) / 2);
    const m = new THREE.Mesh(g, mat), c = (a + b) / 2, y = (y1 + y2) / 2, e = .012;
    if (wall === 'n') { m.position.set(c, y, Z0 + e); }
    else if (wall === 's') { m.position.set(c, y, Z1 - e); m.rotation.y = Math.PI; }
    else if (wall === 'w') { m.position.set(X0 + e, y, c); m.rotation.y = Math.PI / 2; }
    else { m.position.set(X1 - e, y, c); m.rotation.y = -Math.PI / 2; }
    cur.interior.add(m); return m;
  }
  const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);
  // 화변기(쪼그려 앉는 변기): 타원 접시 + 앞쪽 덮개 — 바닥 단 위에 묻힌다
  const squatG = (() => { const bowl = lathe([[.2, 0], [.19, -.01], [.17, -.04], [.14, -.075], [.08, -.105], [0, -.11]], 20).scale(1, 1, 1.75); const hood = new THREE.SphereGeometry(.17, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, .55, .5).translate(0, 0, -.27); return merge([bowl, hood]); })();
  const squatTopG = (() => { const w = 1.03, d = 1.05, sh = new THREE.Shape(); sh.moveTo(-w / 2, -d / 2); sh.lineTo(w / 2, -d / 2); sh.lineTo(w / 2, d / 2); sh.lineTo(-w / 2, d / 2); sh.lineTo(-w / 2, -d / 2); const h = new THREE.Path(); h.absellipse(0, -.1, .2, .35, 0, Math.PI * 2, true); sh.holes.push(h); return new THREE.ShapeGeometry(sh, 24).rotateX(-Math.PI / 2); })();
  // 양변기: 받침 + 볼 + 탱크 + 탱크 뚜껑
  const wcBowlG = merge([lathe([[0, 0], [.11, 0], [.12, .04], [.13, .2], [.17, .3], [.2, .38], [.205, .4], [.17, .405], [.12, .3], [0, .26]], 22).scale(1, 1, 1.32).translate(0, 0, .04), bx(.36, .36, .16, 0, .6, -.27), bx(.38, .03, .18, 0, .795, -.27)]);
  const wcSeatG = merge([new THREE.TorusGeometry(.15, .025, 8, 22).scale(1, 1.32, 1).rotateX(-Math.PI / 2).translate(0, .43, .05)]);
  const wcLidG = new THREE.CylinderGeometry(.17, .17, .02, 22).scale(1, 1, 1.3);
  // 벽걸이 세면대: 둥근 볼 + 수전 + 배수 트랩
  const basinG = lathe([[0, -.12], [.1, -.12], [.18, -.09], [.23, -.03], [.255, .02], [.26, .04], [.24, .045], [.22, .01], [.17, -.05], [.08, -.08], [0, -.085]], 22).scale(1, 1, .78);
  const tapG = merge([new THREE.CylinderGeometry(.022, .026, .1, 10).translate(0, .05, 0), tube(.012, 0, .09, 0, 0, .11, .1), tube(.011, 0, .11, .1, 0, .07, .13), bx(.09, .016, .02, 0, .115, -.02)]);
  const trapG = merge([tube(.018, 0, 0, 0, 0, -.16, 0), new THREE.TorusGeometry(.05, .018, 6, 12, Math.PI).rotateY(Math.PI / 2).translate(0, -.16, -.05), tube(.018, 0, -.16, -.1, 0, -.1, -.22)]);
  // 소변기: 세로로 긴 반구형 몸체 + 플러시 밸브
  const urinal2G = merge([new THREE.SphereGeometry(.19, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 2.1, .85).translate(0, .8, 0), bx(.32, .05, .1, 0, 1.2, .04)]);
  const flushG = merge([tube(.016, 0, 1.22, .05, 0, 1.46, .05), tube(.016, 0, 1.46, .05, 0, 1.46, 0), new THREE.CylinderGeometry(.035, .035, .08, 12).translate(0, 1.38, .05), bx(.02, .02, .06, 0, 1.38, .1)]);
  const binSmallG = merge([new THREE.CylinderGeometry(.11, .1, .3, 14).translate(0, .15, 0), new THREE.CylinderGeometry(.115, .115, .025, 14).translate(0, .31, 0)]);
  const rollG = new THREE.CylinderGeometry(.055, .055, .1, 14).rotateZ(Math.PI / 2);
  const mPaperRoll = S(null, { color: 0xe8e4d8, roughness: .95 });
  const STALL_SCRIBBLE = [['3번 칸 열지 마', '#2a3a8a'], ['빨간 휴지 줄까?', '#8a1018'], ['파란 휴지 줄까?', '#1a3a9a'], ['민아 ♥ 하늘', '#3a3a3a'], ['여기 누가 있어', '#2a2a2a'], ['10.12 11:40', '#5a1010'], ['선생님 미워', '#2a4a2a'], ['문 두드리지 마', '#3a2a5a']];
  // 남 / 여 화장실: 본관 북쪽 = 남자(3층은 여자), 남쪽 = 여자, 별관은 1 · 3층 남자 · 2층 여자
  const toiletGender = (f, south, annex, cx = 0, name = '') => {
    if (name && name.includes('여자')) return 'f';
    if (name && name.includes('남자')) return 'm';
    if (f === 2 && south) return cx === 24 ? 'f' : 'm';
    return annex ? (f === 9 ? 'f' : 'm') : (south || f === 2) ? 'f' : 'm';
  };
  function toilet(cx, name = '') {
    const X0 = cx - 3.85, X1 = cx + 3.85, Z0 = -9.6, Z1 = -1.75, TH = 1.8;
    const G = toiletGender(cur.f, curSouth, cur.annex, cx, name), N = G === 'm' ? 2 : 3;   // 남: 양변기 2칸 + 소변기 3 · 여: 양변기 3칸 (3번 칸은 안에서 잠김)
    // 복도 쪽 아크릴 명패 (낡고 먼지 낀)
    { const sm = new THREE.MeshStandardMaterial({ map: T.makeSign(G === 'm' ? '남자화장실  MAN' : '여자화장실  WOMAN', G === 'm' ? '#c8d8ea' : '#ecd0cc', G === 'm' ? '#1a4a9a' : '#a01a1a', 24), roughness: .35, metalness: .1 });
      plane(cur.interior, sm, .9, .24, cx - 1.75, 2.05, -1.37); add(S(null, { color: 0x6a6a64, roughness: .6 }), .94, .28, .015, cx - 1.75, 1.91, -1.385); }
    // 바닥 · 벽 마감
    flat(cur.interior, mTFloor, X0, X1, Z0, Z1, .006, 2);
    [['n', X0, X1], ['w', Z0, Z1], ['e', Z0, Z1], ['s', X0, cx - 1.08], ['s', cx + 1.08, X1]].forEach(([w, a, b]) => {
      clad(w, a, b, 0, TH, mTWall, X0, X1, Z0, Z1); clad(w, a, b, TH, TH + .15, mTBand, X0, X1, Z0, Z1); clad(w, a, b, 0, .16, mGrime, X0, X1, Z0, Z1);
      const L = b - a, c = (a + b) / 2, t = w === 'n' || w === 's';   // 띠 위 마감 몰딩
      add(mTrim, t ? L : .035, .035, t ? .035 : L, t ? c : (w === 'w' ? X0 + .02 : X1 - .02), TH + .15, t ? (w === 'n' ? Z0 + .02 : Z1 - .02) : c);
    });
    // ── 칸막이 4칸 (x X0 ~ cx+.55, 깊이 1.9m) ──
    const zF = -7.7, xs = i => X0 + i * 1.1;
    for (let k = 1; k <= N; k++) { const xp = xs(k); add(mStall, .03, 1.85, 1.88, xp, .13, (Z0 + zF) / 2); col(xp - .03, xp + .03, Z0, zF); meshAt(new THREE.CylinderGeometry(.018, .018, .13, 8).translate(0, .065, 0), mAlu, xp, 0, zF + .05); }
    for (let k = 0; k <= N; k++) { const a = k === 0 ? X0 : xs(k) - .06, b = k === N ? xs(N) + .03 : k === 0 ? X0 + .1 : xs(k) + .06; add(mStall, b - a, 1.85, .035, (a + b) / 2, .13, zF); col(a, b, zF - .03, zF + .03); }
    add(mAlu, xs(N) - X0 + .03, .04, .05, (X0 + xs(N)) / 2, 1.98, zF);   // 상부 레일
    for (let k = 1; k <= N; k++) add(mAlu, .04, .03, 1.9, xs(k), 1.98, (Z0 + zF) / 2);
    meshAt(tube(.025, X0, 2.62, Z0 + .08, X1, 2.62, Z0 + .08), mPipe, 0, 0, 0);   // 북벽 급수관
    for (let i = 0; i < N; i++) {
      const a = xs(i) + (i === 0 ? .1 : .06), b = xs(i + 1) - .06, xc = (xs(i) + xs(i + 1)) / 2, w = b - a, locked = G === 'f' && i === 2;
      const d = hingeDoor(a, zF, w, 1.75, .13, 1.35, !locked, mStallDoor, '칸막이 문'); d.stall = true; d.stallNo = i + 1; if (locked) d.locked = true;
      if (!locked) { lockers.push({ floor: cur.f, x: xc, z: -8.15, y: cur.y0, dir: { x: 0, z: 1 }, stallDoor: d, label: '칸막이 안에 숨기 (문을 닫는다)' }); props.push({ kind: 'flush', floor: cur.f, x: xc, z: -9.05, y: .55, label: '변기 물 내리기 — 큰 소리 (그것이 22m 안에서 몰려온다)' }); }
      else {   // 잠긴 3번 칸: 문 아래 15cm 틈으로 피 묻은 실내화 두 짝
        const wsh = S(null, { color: 0xd8d0c4, roughness: .7 }), rsh = S(null, { color: 0x6a0c0c, roughness: .4 });
        [-.09, .09].forEach(dx => { add(wsh, .09, .06, .24, xc + dx, 0, -7.86); add(rsh, .092, .015, .1, xc + dx, .06, -7.8); }); blood('splat', xc, .012, -7.95, .7, 0, true);
      }
      const num = new THREE.Mesh(new THREE.PlaneGeometry(.12, .12), new THREE.MeshBasicMaterial({ map: T.makeNumber(i + 1), color: 0x9a9a92 })); num.position.set(w / 2, 1.62, .025); d.piv.add(num);
      const ind = new THREE.Mesh(new THREE.BoxGeometry(.06, .025, .012), S(null, { color: locked ? 0x8a1a14 : 0x2a6a2a, roughness: .4 })); ind.position.set(w - .1, 1.12, .026); d.piv.add(ind);
      const hook = new THREE.Mesh(merge([tube(.006, 0, 0, 0, 0, 0, -.05), tube(.006, 0, 0, -.05, 0, .04, -.06)]), mAlu); hook.position.set(w / 2, 1.55, -.02); d.piv.add(hook);
      if (locked) { const sc = new THREE.Mesh(new THREE.PlaneGeometry(.7, .175), new THREE.MeshBasicMaterial({ map: T.makeGraffiti('열지 마', '#2a3a8a'), transparent: true, depthWrite: false })); sc.position.set(w / 2, 1.3, .024); d.piv.add(sc); }
      if (false) {   // 화변기 + 단 (지금은 남녀 모두 양변기 — 형상은 남겨 둔다)
        meshAt(squatTopG, mTFloor, xc, .12, Z0 + .525); add(mTFloor, 1.03, .12, .02, xc, 0, Z0 + 1.04);   // 단 윗면(변기 구멍) + 앞면
        meshAt(squatG, mPorc, xc, .12, Z0 + .525 + .1); meshAt(new THREE.CircleGeometry(.07, 14).scale(1, 1.4, 1).rotateX(-Math.PI / 2), mHoleW, xc, .015, Z0 + .525 + .2);   // 물 고인 배수 구멍
        if (i === 0) { add(mPorc, .46, .3, .2, xc, 1.95, Z0 + .1); meshAt(tube(.018, 0, 1.95, 0, 0, .14, .0), mPipe, xc + .12, 0, Z0 + .07); meshAt(merge([tube(.004, 0, 1.95, 0, 0, 1.45, 0), new THREE.CylinderGeometry(.018, .018, .06, 8).translate(0, 1.43, 0)]), mAlu, xc - .16, 0, Z0 + .22); }
        else { meshAt(merge([tube(.02, 0, 2.62, 0, 0, .14, 0), new THREE.CylinderGeometry(.04, .04, .12, 12).translate(0, 1.05, .03), bx(.02, .14, .02, .06, 1.08, .06)]), mAlu, xc + .12, 0, Z0 + .07); }
      } else {       // 양변기
        meshAt(wcBowlG, mPorc, xc, 0, -9.2); meshAt(wcSeatG, mSeat, xc, 0, -9.2);
        const lid = meshAt(wcLidG, mSeat, xc, .78, -9.38); lid.rotation.x = -1.32;
        meshAt(merge([bx(.05, .02, .02, .14, .72, 0)]), mAlu, xc, 0, -9.47);
        col(xc - .21, xc + .21, Z0, -8.68);
      }
      model('h133/WC-006', xs(i) + (i === 0 ? .03 : .045), .62, -8.75, Math.PI / 2);   // 휴지걸이
      meshAt(binSmallG, mWhite, b - .16, 0, Z0 + .2);
      const [txt, colr] = STALL_SCRIBBLE[(i * 3 + cur.f) % STALL_SCRIBBLE.length];
      const gm = new THREE.MeshBasicMaterial({ map: T.makeGraffiti(txt, colr), transparent: true, depthWrite: false, opacity: .8 }); plane(cur.interior, gm, .7, .175, xs(i + 1) - .02, 1.35, -8.6 + rr(-.3, .3), -Math.PI / 2);
    }
    { const r = meshAt(rollG, mPaperRoll, xs(1) + .4, .055, -8.0); r.rotation.y = .6; const st = plane(cur.interior, mPaperRoll, .1, .9, xs(1) + .65, .008, -7.45, 0, -Math.PI / 2); st.rotation.z = .5; }
    // ── 화장실 보강 ①: 입구 에티켓 시선차단 타일 가벽 & 전신 거울(WC-004) & 화장실 문화 캠페인 액자 ──
    {
      const px = cx - 1.15, pz = Z1 - .82;
      add(mTWall, .12, 1.95, .78, px, 0, pz);
      add(mTBand, .13, .14, .80, px, 1.82, pz);
      add(mAlu,   .14, 2.02, .05, px, 0, pz - .40);
      model('h133/WC-004', px + .07, .85, pz, Math.PI / 2);
      plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign(G === 'm' ? '남자화장실 · 금연구역' : '여자화장실 · 에티켓존', G === 'm' ? '#1a3858' : '#582032', '#f2eee4', 22), roughness: .5 }), .62, .18, px + .065, 1.68, pz, Math.PI / 2);
    }
    // 칸막이 부스 상단 간접 조명 바 & 칸막이 옆 다용도 수납 선반 보강
    add(new THREE.MeshStandardMaterial({ color: 0xf6f2e4, emissive: 0xffe8b8, emissiveIntensity: .85 }), xs(N) - X0 - .1, .03, .06, (X0 + xs(N)) / 2, 2.38, -8.65);
    // ── 소변기 3 (서벽) + 강화유리 가림판 + 상부 대리석 선반 + 적외선 센서 / 여자화장실 파우더룸 화장대 보강 ──
    const UZ = G === 'm' ? [-5.9, -5.0, -4.1] : [];   // 남자화장실만 소변기 3 (1번 칸 문 앞 1m 를 비운다)
    if (G === 'm') {
      add(mTFloor, .52, .06, 2.86, X0 + .26, 0, -5.0); col(X0, X0 + .5, -6.35, -3.65);
      // 소변기 상부 화강암 선반 (우산·소지품 거치 선반)
      add(S(null, { color: 0x8a8e92, roughness: .35, metalness: .15 }), .26, .04, 2.82, X0 + .13, 1.36, -5.0);
      meshAt(new THREE.CircleGeometry(.11, 14).scale(1, 1.5, 1), S(null, { color: 0x14100a, roughness: .05 }), X0 + .12, .55, UZ[1], Math.PI / 2);   // 막힌 가운데 소변기: 검은 오물
      props.push({ kind: 'search', floor: cur.f, x: X0 + .2, z: UZ[1], y: .8, label: '막힌 소변기 뒤지기', loot: { item: 'tape' }, where: '화장실', id: 'urinal' });
    } else {   // 여자화장실 서벽: 파우더룸 화장대 + 3D 거울(WC-004) 2기 + 간접조명 + 위생용품 자판기 + 전신거울
      add(mAlu, .03, .86, 1.7, X0 + .015, 1.1, -5.2); plane(cur.interior, mMirrorT, 1.62, .8, X0 + .035, 1.53, -5.2, Math.PI / 2);
      model('h133/WC-004', X0 + .04, .95, -5.65, Math.PI / 2);
      model('h133/WC-004', X0 + .04, .95, -4.75, Math.PI / 2);
      add(new THREE.MeshStandardMaterial({ color: 0xfff0e0, emissive: 0xffd0a8, emissiveIntensity: .95 }), .04, .04, 1.68, X0 + .05, 2.02, -5.2);
      tbl(mWood, 1.6, .74, .4, X0 + .2, 0, -5.2, { col: true, ry: Math.PI / 2, legMat: mAlu });
      // 파우더룸 화장대 위 각티슈 케이스 & 핸드워시
      add(S(null, { color: 0xf4e8ec, roughness: .5 }), .14, .08, .24, X0 + .22, .74, -5.45);
      add(S(null, { color: 0xffffff, roughness: .8 }), .08, .05, .14, X0 + .22, .82, -5.45);
      add(S(null, { color: 0xe8e2d6, roughness: .4 }), .2, .45, .32, X0 + .1, 1.0, -3.3);
      plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('위생용품', '#f0e8e8', '#a03050', 22), roughness: .6 }), .26, .07, X0 + .205, 1.36, -3.3, Math.PI / 2);
      col(X0, X0 + .3, -3.5, -3.1);
    }
    UZ.forEach((z, i) => {
      meshAt(urinal2G, mPorc, X0, 0, z, Math.PI / 2); meshAt(new THREE.CircleGeometry(.03, 10), mTap, X0 + .13, .5, z, Math.PI / 2); meshAt(flushG, mTap, X0, 0, z, Math.PI / 2);
      // 자동 감지 센서 박스
      add(mDarkMetal, .03, .08, .08, X0 + .02, 1.28, z);
      meshAt(tube(.018, .0, .45, 0, -.06, .45, 0), mAlu, X0 + .06, 0, z);
      plane(cur.interior, mStainU, .6, .6, X0 + .7, .009, z + rr(-.1, .1), 0, -Math.PI / 2);
      if (i < UZ.length - 1) add(mStall, .52, .92, .035, X0 + .26, .45, z + .45);
    });
    if (G === 'm') plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('한 걸음 앞으로 · 아름다운 화장실 문화', '#e8e4d0', '#1a4a8a', 22), roughness: .7 }), .58, .12, X0 + .015, 1.66, -5.0, Math.PI / 2);
    // ── 세면대 4 + 화강암 일체형 카운터 상판 + 3D 세면기(WC-001) + 대형 거울 & 상부 간접조명 (동벽) ──
    const SZ = [-6.9, -6.0, -5.1, -4.2];
    // 화강암 세면대 일체형 카운터 상판 & 하부 에이프런 가림막
    add(S(null, { color: 0x7a8084, roughness: .32, metalness: .18 }), .52, .06, 3.46, X1 - .26, .80, -5.55);
    add(S(null, { color: 0x5c6266, roughness: .45, metalness: .12 }), .04, .24, 3.46, X1 - .50, .62, -5.55);
    SZ.forEach((z, i) => {
      const bwl = meshAt(basinG, mPorc, X1 - .26, .86, z); bwl.material = mPorc;
      model('h133/WC-001', X1 - .26, 0, z, -Math.PI / 2, { s: .84 });
      meshAt(new THREE.CircleGeometry(.03, 10).rotateX(-Math.PI / 2), mChrome, X1 - .26, .775, z);
      meshAt(tapG, mTap, X1 - .08, .9, z, -Math.PI / 2); props.push({ kind: 'sink', floor: cur.f, x: X1 - .3, z, y: .95, sinkNo: i, label: '세면대 수도꼭지 틀기 (세수 · 물소리로 유인)' });
      meshAt(trapG, mTap, X1 - .26, .76, z, -Math.PI / 2);
      add(mAlu, .3, .04, .04, X1 - .15, .74, z);   // 받침 브래킷
      // 세면대 사이 물비누 디스펜서 & 고체 비누 받침
      if (i < 3) {
        meshAt(new THREE.CylinderGeometry(.032, .032, .13, 10).translate(0, .065, 0), S(null, { color: i % 2 ? 0x2a7a4a : 0x3a6a9a, roughness: .28 }), X1 - .08, 1.112, z + .45);
      }
    });
    col(X1 - .55, X1, -7.3, -3.85);
    add(mAlu, .03, 1.06, 3.5, X1 - .015, 1.12, -5.55);   // 거울 틀
    plane(cur.interior, mMirrorT, 3.42, 1.0, X1 - .035, 1.65, -5.55, -Math.PI / 2);
    // 세면대 거울 상부 간접조명 바 (거울과 세면대가 환하고 입체감 있게 보이도록 보강!)
    add(new THREE.MeshStandardMaterial({ color: 0xf8f4e8, emissive: 0xffe4b0, emissiveIntensity: 1.05 }), .05, .04, 3.48, X1 - .05, 2.20, -5.55);
    add(new THREE.MeshStandardMaterial({ color: 0xbfd0cc, roughness: .05, transparent: true, opacity: .35 }), .12, .012, 3.3, X1 - .09, 1.1, -5.55);   // 유리 선반
    plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('물을 아껴 씁시다 · 깨끗한 손씻기', '#e8e4d0', '#2a2a2a', 24), roughness: .7 }), .68, .13, X1 - .02, 2.34, -5.55, -Math.PI / 2);
    // 핸드 드라이어(전원 표시등) · 페이퍼타월 디스펜서 · 분리수거 휴지통 (동벽 복도 쪽)
    add(S(null, { color: 0xd8d4c8, roughness: .35 }), .14, .30, .28, X1 - .07, 1.15, -3.2);
    plane(cur.interior, new THREE.MeshBasicMaterial({ color: 0x30ff88 }), .02, .04, X1 - .142, 1.36, -3.2, -Math.PI / 2);
    meshAt(new THREE.CylinderGeometry(.03, .04, .06, 10), mChrome, X1 - .15, 1.13, -3.2);
    add(S(null, { color: 0xc8c4b8, roughness: .5 }), .14, .38, .3, X1 - .08, 1.2, -2.5);
    bin(X1 - .3, -2.5); col(X1 - .5, X1, -2.75, -2.25);
    // ── 북동 청소 구역: 청소용 개수대 · 대걸레(WC-007) 2자루 · 선반 · 양동이 · 미끄럼 주의 표지 ──
    add(mTWall, .7, .42, .55, X1 - .4, 0, Z0 + .3); add(mPorcIn, .6, .004, .45, X1 - .4, .421, Z0 + .3);
    meshAt(tapG, mTap, X1 - .4, .78, Z0 + .03);
    meshAt(tube(.016, X1 - .4, .78, Z0 + .03, X1 - .4, 2.62, Z0 + .03), mPipe, 0, 0, 0);
    col(X1 - .78, X1, Z0, Z0 + .6);
    model('h133/WC-007', X1 - .25, .05, Z0 + .22, .25);
    model('h133/WC-007', X1 - .55, .05, Z0 + .24, -.18);
    add(mWoodDark, 1.0, .03, .26, X1 - .55, 1.45, Z0 + .13); add(mWoodDark, .03, .12, .26, X1 - 1.02, 1.36, Z0 + .13);
    model('bleach_bottle', X1 - .82, 1.48, Z0 + .13, .3); model('multi_cleaner_bottle', X1 - .55, 1.48, Z0 + .12, -.4); model('bleach_bottle', X1 - .3, 1.48, Z0 + .14, 1.2);
    model('plunger', X1 - .95, 0, Z0 + .25, .4);
    mopBucket(X1 - 1.4, -9.0);
    model('WetFloorSign_01', X1 - 1.9, 0, -7.2, .8, { col: [.36, .3] });
    meshAt(new THREE.TorusGeometry(.18, .025, 6, 20), S(null, { color: 0x2a5a3a, roughness: .6 }), X1 - .02, 1.75, -8.6, Math.PI / 2);   // 걸린 호스
    // ── 복도벽 서쪽: 청소도구함 ──
    add(mLocker, .9, 1.9, .42, X0 + .55, 0, Z1 - .24); col(X0 + .08, X0 + 1.02, Z1 - .46, Z1);
    add(mBlack, .9, .012, .02, X0 + .55, 1.55, Z1 - .45); add(mBlack, .9, .012, .02, X0 + .55, 1.6, Z1 - .45);
    plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('청소 도구함', '#e0dccc', '#2a2a2a', 28), roughness: .8 }), .5, .12, X0 + .55, 1.75, Z1 - .449, Math.PI);
    // ── 천장: 환풍구 2 · 배수관 ──
    [[cx - .5, -5.4], [cx - 2.2, -8.6]].forEach(([x, z]) => { const v = merge([bx(.46, .03, .46, 0, 0, 0), ...Array.from({ length: 7 }, (_, k) => bx(.42, .012, .02, 0, -.02, -.18 + k * .06))]); meshAt(v, mAlu, x, CH - .02, z); });
    // ── 바닥: 배수구 · 물웅덩이 · 깨진 타일 ──
    model('h133/WC-008', cx - .6, 0, -5.6, 0);
    [[cx - .4, -5.3, 1.6], [X1 - .8, -5.6, 1.3], [cx - 2.4, -7.2, .9]].forEach(([x, z, s]) => { const pd = plane(cur.interior, mPuddle, s, s * .8, x, .012, z, 0, -Math.PI / 2); pd.rotation.z = rnd() * 6; });
    for (let k = 0; k < 6; k++) { const sh = add(mTWall, rr(.05, .12), .012, rr(.04, .1), cx + 1.6 + rr(-.3, .3), 0, -6.6 + rr(-.3, .3)); sh.rotation.y = rnd() * 6; }
    if (cur.f === 1) blood('hand', X1 - .045, 1.55, -6.6, .6, -Math.PI / 2);
    papers(cx, -7, -3, 5);
  }
  // 계단실 천장: 2번 계단 위로 뚫린 개구부 + 어두운 계단 통로
  const mShaft = (() => { const m = mStep.clone(); m.color = new THREE.Color(0x8a8780); return m; })();   // 개구부 가장자리 (슬래브 단면)
  // 계단실 천장: 2번 계단 위 개구부 (open=false 면 막힌 천장 — 위층이 없는 별관 3층). 개구부 너머는 stairRoom 이 그린다
  // 계단 코어(두 계단 + 층참, x cx-3.85~cx-1.2 · z -9.6~-2.9) 위는 반자 천장 없이 위층 계단 밑면(FH)까지 트여 있다 — 층참(2.0m)에서도 머리 위가 2m
  function ceilHole(P, X0, X1, Z0, Z1, cx) {
    const hx1 = cx - 3.85, hx2 = cx - 1.2, hz1 = -9.6, hz2 = -2.9;
    flat(P, mCeil, X0, hx1, Z0, Z1, CH, 4, false); flat(P, mCeil, hx2, X1, Z0, Z1, CH, 4, false);
    flat(P, mCeil, hx1, hx2, Z0, hz1, CH, 4, false); flat(P, mCeil, hx1, hx2, hz2, Z1, CH, 4, false);
  }
  // 방마다 고유 오브젝트 (출입문 쪽 벽, 방 안을 향함) — 조사하면 선택 화면이 열리고 효과가 있다 (game.js ROBJ)
  const ROBJ_OF = { nurse: 'med', sick: 'med', office: 'phone', staff: 'phone', principal: 'phone', meeting: 'phone', toilet: 'mirror', library: 'cards', reading: 'cards', archive: 'cards', records: 'cards',
    computer: 'term', digital: 'term', av: 'term', lab: 'chem', prepS: 'chem', cooking: 'snack', counsel: 'emo', counselS: 'emo', print: 'copier', wash: 'water', student: 'ballot', tool: 'radio', equip: 'radio' };
  const ROBJ_LABEL = { med: '약품함 열기', phone: '수화기 들기', mirror: '거울 보기', cards: '대출 카드함 뒤지기', term: '단말기 켜기', chem: '약품 선반 살피기', snack: '간식 바구니 뒤지기', emo: '감정 카드 고르기', copier: '복사 카운터 누르기', water: '수도꼭지 틀기', ballot: '투표함 열기', radio: '무전기 켜기' };
  const mRedCross = new THREE.MeshBasicMaterial({ color: 0xb02020 }), mTermScr = new THREE.MeshBasicMaterial({ color: 0x38c070 }), mBeige = S(null, { color: 0xc8bc9c, roughness: .6 });
  function roomObj(t, cx) {
    const k = ROBJ_OF[t]; if (!k) return;
    if (t === 'toilet') return;
    const x = cx - 2.7, z = -1.8, g = dyn(new THREE.Group()); g.position.set(x, 1.35, z); g.rotation.y = Math.PI; cur.interior.add(g);
    const B = (m, w, h, d, px = 0, py = 0, pz = 0, parent = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(px, py, pz); parent.add(o); return o; };
    const anim = { type: k, g, t: 0, active: false };
    if (k === 'med') {
      B(mWhite, .5, .62, .13, 0, 0, .065);
      B(S(null, { color: 0x3a8866, roughness: .3 }), .12, .16, .06, -.1, -.08, .09);
      B(S(null, { color: 0xd86030, roughness: .3 }), .10, .14, .06, .08, -.09, .09);
      const doorPiv = dyn(new THREE.Group()); doorPiv.position.set(-.25, 0, .14); g.add(doorPiv);
      B(mWhite, .5, .62, .025, .25, 0, .01, doorPiv);
      B(mRedCross, .2, .06, .01, .25, .05, .026, doorPiv);
      B(mRedCross, .06, .2, .01, .25, .05, .026, doorPiv);
      B(mChrome, .03, .1, .02, .45, -.1, .03, doorPiv);
      anim.doorPiv = doorPiv;
    }
    else if (k === 'phone') {
      B(mBeige, .2, .3, .08, 0, 0, .04);
      for (let i = 0; i < 9; i++) B(mBlack, .03, .03, .01, -.03 + (i % 3) * .05, .06 - ((i / 3) | 0) * .05, .085);
      const handset = dyn(new THREE.Group()); handset.position.set(-.13, 0, .09); g.add(handset);
      B(mBeige, .07, .26, .07, 0, 0, 0, handset);
      anim.handset = handset;
    }
    else if (k === 'mirror') {
      B(mChrome, .56, .76, .03, 0, .15, .015);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(.5, .7), new THREE.MeshStandardMaterial({ color: 0x8a969a, roughness: .05, metalness: .95 })); m.position.set(0, .15, .032); g.add(m);
      anim.mirror = m;
    }
    else if (k === 'cards') {
      B(mWood, .6, .4, .3, 0, -.15, .15);
      for (let i = 0; i < 6; i++) {
        const dx = -.19 + (i % 3) * .19, dy = -.06 - ((i / 3) | 0) * .16;
        if (i === 1) {
          const drw = dyn(new THREE.Group()); drw.position.set(dx, dy, .305); g.add(drw);
          B(mWoodDark, .17, .1, .18, 0, 0, -.08, drw);
          B(mWhite, .13, .08, .12, 0, .02, -.07, drw);
          B(mChrome, .05, .015, .02, 0, -.02, .01, drw);
          anim.drawer = drw;
        } else {
          B(mWoodDark, .17, .1, .01, dx, dy, .305);
          B(mChrome, .05, .015, .02, dx, dy - .02, .31);
        }
      }
    }
    else if (k === 'term') {
      B(mDarkMetal, .42, .32, .1, 0, 0, .05);
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(.34, .22), mTermScr.clone()); sc.position.set(0, .02, .102); g.add(sc);
      anim.screen = sc;
    }
    else if (k === 'chem') {
      B(mWood, .7, .03, .2, 0, -.1, .1);
      anim.flasks = [[0x3060d0, -.2], [0xd0c030, 0], [0xb02020, .2]].map(([c, dx]) => {
        const f = dyn(new THREE.Mesh(new THREE.CylinderGeometry(.035, .06, .18, 10), new THREE.MeshStandardMaterial({ color: c, roughness: .1, transparent: true, opacity: .82, emissive: c, emissiveIntensity: .18 })));
        f.position.set(dx, .0, .1); g.add(f); return f;
      });
    }
    else if (k === 'snack') {
      B(mWood, .6, .03, .25, 0, -.12, .12);
      const box = dyn(new THREE.Group()); box.position.set(0, -.03, .12); g.add(box);
      B(mCardboard, .4, .14, .2, 0, 0, 0, box);
      [0xd04030, 0x3080c0, 0xe0b030].forEach((c, i) => B(S(null, { color: c, roughness: .5 }), .08, .1, .04, -.12 + i * .12, .10, 0, box));
      anim.box = box;
    }
    else if (k === 'emo') {
      B(mCork, .6, .45, .02, 0, 0, .01);
      anim.cards = [0xe0d070, 0x80b0e0, 0xe09090, 0xa0d0a0].map((c, i) => B(S(null, { color: c, roughness: .8 }), .12, .16, .005, -.2 + i * .13, (i % 2) * .06 - .02, .025));
    }
    else if (k === 'copier') {
      B(mBeige, .34, .3, .14, 0, 0, .07);
      B(mBlack, .22, .06, .01, 0, .07, .142);
      B(mRedCross, .04, .04, .01, .09, -.07, .142);
      const scanBar = dyn(new THREE.Mesh(new THREE.BoxGeometry(.02, .055, .015), new THREE.MeshBasicMaterial({ color: 0x50ff90 }))); scanBar.position.set(-.09, .07, .146); scanBar.visible = false; g.add(scanBar);
      const paperOut = dyn(new THREE.Mesh(new THREE.BoxGeometry(.16, .006, .12), mWhite)); paperOut.position.set(0, -.11, .12); paperOut.visible = false; g.add(paperOut);
      anim.scanBar = scanBar; anim.paperOut = paperOut;
    }
    else if (k === 'water') {
      B(mPorc, .5, .14, .3, 0, -.45, .15);
      B(mChrome, .03, .03, .14, 0, -.25, .07);
      const tap = B(mChrome, .1, .03, .03, 0, -.2, .02);
      const stream = dyn(new THREE.Mesh(new THREE.CylinderGeometry(.012, .018, .22, 8), new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: .75 })));
      stream.position.set(0, -.33, .13); stream.visible = false; g.add(stream);
      anim.tap = tap; anim.stream = stream;
    }
    else if (k === 'ballot') {
      B(mWood, .5, .03, .25, 0, -.18, .12);
      const box = dyn(new THREE.Group()); box.position.set(0, -.01, .12); g.add(box);
      B(S(null, { color: 0xd8d2c4, roughness: .3, transparent: true, opacity: .55 }), .36, .3, .22, 0, 0, 0, box);
      B(mBlack, .14, .01, .02, 0, .155, 0, box);
      anim.box = box;
    }
    else if (k === 'radio') {
      B(mDarkMetal, .14, .26, .07, 0, 0, .04);
      const ant = B(mBlack, .015, .22, .015, .04, .22, .04);
      const scr = B(mTermScr.clone(), .08, .04, .005, 0, .06, .078);
      anim.ant = ant; anim.screen = scr;
    }
    props.push({ kind: 'robj', k, t, floor: cur.f, x, z, y: 1.35, cx, label: ROBJ_LABEL[k], anim });
  }
  // 엘리베이터 (계단실 동쪽 벽): 철문 · 층 표시 · 호출 버튼 — 실제 객실에 걸어 들어간다
  const EL_LABEL = { 4: 'B1', 0: '1F', 1: '2F', 2: '3F', 8: '1F', 9: '2F', 10: '3F' };
  function elevator(cx) {
    const bay=elevatorBay(cx),x=bay.doorX,z=bay.doorZ;cur.elevatorBay=bay;
    // A continuous full-height wall reserves a shaft, rather than a freestanding cabin in the landing.
    wallSeg(bay.front,bay.front+.2,bay.z1,z-bay.halfOpening,0,FH);
    wallSeg(bay.front,bay.front+.2,z+bay.halfOpening,bay.z2,0,FH);
    wallSeg(bay.front,bay.front+.2,z-bay.halfOpening,z+bay.halfOpening,2.4,FH);
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -Math.PI / 2; cur.interior.add(g);
    const fr = new THREE.Mesh(merge([bx(.14, 2.4, .1, -.87, 1.2, 0), bx(.14, 2.4, .1, .87, 1.2, 0), bx(1.88, .16, .1, 0, 2.44, 0)]), mChrome); fr.position.z=.08;g.add(fr);
    const hall = []; [-.4, .4].forEach(dx => { const d = dyn(new THREE.Mesh(new THREE.BoxGeometry(.8, 2.36, .04), mMetal)); d.position.set(dx, 1.18, .0); g.add(d); hall.push(d); });
    // Real cabin is docked here by game.js; no flat cabin picture or solid seam.
    const cab = null;
    const doorBlock = {x1:x-.05,x2:x+.05,z1:z-.8,z2:z+.8,off:false};cur.col.push(doorBlock);cur.walls.push(doorBlock);
    col(x,x+1.68,z-.9,z-.84,true);col(x,x+1.68,z+.84,z+.9,true);col(x+1.62,x+1.7,z-.9,z+.9,true);
    const ind = new THREE.Mesh(new THREE.PlaneGeometry(.5, .2), new THREE.MeshBasicMaterial({ map: T.makeSign(EL_LABEL[cur.f] || '', '#120806', '#ff5a2a', 34), color: 0xffb090 })); ind.position.set(0, 2.72, .09); g.add(ind);
    const pnl = new THREE.Mesh(new THREE.BoxGeometry(.14, .3, .03), mChrome); pnl.position.set(1.15, 1.25, .085); g.add(pnl);
    [.06, -.06].forEach((dy, k) => { const b = dyn(new THREE.Mesh(new THREE.CircleGeometry(.025, 12), new THREE.MeshBasicMaterial({ color: 0xffa040 }))); b.position.set(1.15, 1.25 + dy, .106); g.add(b);
      const ph = k * 1.3; b.onBeforeRender = () => b.material.color.setHex(Math.sin(performance.now() / 900 + ph) > .6 ? 0xffb050 : 0x3a1a08); });
    plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('승강기 · 정원 9명', '#d8d4c8', '#2a2a2a', 20), roughness: .8 }), .6, .14, bay.front - .015, 1.75, z - 1.15, -Math.PI / 2);
    props.push({ kind: 'elevator', floor: cur.f, x: x - .5, z, y: 1.25, px: x, pz: z, cx, hall, cab, doorBlock, label: '엘리베이터 호출' });
  }
  const mStairPlate = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#5a5c58'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#7a7c76'; for (let y = 0; y < 128; y += 16) for (let x = (y / 16 % 2) * 8; x < 128; x += 16) { g.save(); g.translate(x + 4, y + 8); g.rotate(.7); g.fillRect(-5, -1.5, 10, 3); g.restore(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return grunge(new THREE.MeshStandardMaterial({ map: t, roughness: .5, metalness: .6 })); })();   // 줄무늬(체커) 철판
  const mStairNose = S(null, { color: 0xc8a030, roughness: .7 }), mRailSteel = grunge(S(T.makeMetal([70, 78, 74]), { roughness: .5, metalness: .5 }));
  function stairRoom(cx) {
    // ㄷ자 계단 — 층고 FH(4m) = 1번 계단 10단(0.2m) 2.0m + 층참 + 2번 계단 10단 2.0m.
    // 계단 하부(지하면/천장면)에 단차 블록이 절대 튀어나오지 않도록 L자형 디딤판(Tread 4cm) + 챌판(Riser 4cm) + 매끄러운 경사 슬래브(Soffit) 구조로 정밀 시공!
    const W = 1.3, xa = cx - 3.15, xb = cx - 1.85, n = 10, run = .48, LND = FH / 2, rise = LND / n, z0 = -3.0, zl = z0 - n * run;
    const hx1 = cx - 2.55, hx2 = cx - 1.2, hz1 = zl - .1, hz2 = -3.0;
    const hasDown = cur.annex ? cur.f > 8 : !cur.basement, hasUp = cur.annex ? cur.f < 10 : true;
    const L = Math.hypot(n * run, LND), th = Math.atan2(LND, n * run);
    const mUnderSlab = S(null, { color: 0xd8d2c4, roughness: .85 });

    const core = (dy, guard, top = false) => {
      const ci = cx - 2.5, co = cx - 1.22, H = .95;
      const hr = [], bal = [], P = (x, y1, z, y2 = y1 + H) => bal.push(tube(.012, x, y1, z, x, y2, z));

      if (top) {
        if (guard) {
          hr.push(
            tube(.03, co, dy + 1.0, -9.55, co, dy + 1.0, z0),
            tube(.03, cx - 3.82, dy + 1.0, z0, ci, dy + 1.0, z0)
          );
          for (let k = 0; k <= 16; k++) P(co, dy, -9.55 + k * (z0 + 9.55) / 16, dy + 1.0);
          for (let k = 0; k <= 4; k++) P(cx - 3.82 + k * (ci - (cx - 3.82)) / 4, dy, z0, dy + 1.0);
          bal.push(tube(.032, co, dy, z0, co, dy + 1.04, z0), tube(.032, ci, dy, z0, ci, dy + 1.04, z0));
          cur.interior.add(new THREE.Mesh(merge(hr), mWoodDark), new THREE.Mesh(merge(bal), mRailSteel));
        }
        return;
      }

      // 1구간(xa: dy -> dy+LND) 매끄러운 일체형 경사 하부 슬래브 & L자형 디딤판/챌판 (하부 돌출 0.0mm!)
      {
        const sof1 = new THREE.Mesh(new THREE.BoxGeometry(W + .02, .14, L), mUnderSlab);
        sof1.rotation.x = th;
        sof1.position.set(xa, dy + LND * .5 - .12, (z0 + zl) * .5);
        cur.interior.add(sof1);
        for (let i = 0; i < n; i++) {
          const syTop = dy + (i + 1) * rise, sz = z0 - run * (i + .5), zFront = z0 - run * i;
          add(mStep, W, .04, run + .02, xa, syTop - .04, sz);
          add(mStep, W, rise, .04, xa, syTop - rise, zFront - .02);
        }
      }
      // 중간 층참(Landing, y = dy + LND) 매끄러운 하부 슬래브 & 상부 디딤 마감
      add(mUnderSlab, 2.62, .20, 9.55 + zl + .06, cx - 2.5, dy + LND - .22, (zl - 9.55) / 2);
      add(mStep, 2.6, .04, 9.55 + zl + .04, cx - 2.5, dy + LND - .02, (zl - 9.55) / 2);

      // 2구간(xb: dy+LND -> dy+FH) 매끄러운 일체형 경사 하부 슬래브 & L자형 디딤판/챌판 (하부 돌출 0.0mm!)
      {
        const sof2 = new THREE.Mesh(new THREE.BoxGeometry(W + .02, .14, L), mUnderSlab);
        sof2.rotation.x = -th;
        sof2.position.set(xb, dy + LND * 1.5 - .12, (z0 + zl) * .5);
        if (dy < 0) sof2.userData.dynamic = true;
        cur.interior.add(sof2);
        for (let i = 0; i < n; i++) {
          const stTop = dy + LND + (i + 1) * rise, sz = zl + run * (i + .5), zFront = zl + run * i;
          const t1 = add(mStep, W, .04, run + .02, xb, stTop - .04, sz);
          const t2 = add(mStep, W, rise, .04, xb, stTop - rise, zFront + .02);
          if (dy < 0) { t1.userData.dynamic = true; t2.userData.dynamic = true; }
        }
      }

      // 1구간과 2구간 사이의 중앙 코어 마감 가벽 (계단 옆면 빈틈으로 어두운 뒷면이 보이지 않도록 깔끔히 마감)
      add(mUnderSlab, .06, LND, n * run, ci, dy, (z0 + zl) * .5);

      const nos = [];
      for (let i = 0; i < n; i++) {
        nos.push(
          bx(W - .06, .016, .065, xa, dy + (i + 1) * rise + .008, z0 - run * i - .04),
          bx(W - .06, .045, .014, xa, dy + (i + 1) * rise - .02, z0 - run * i - .004),
          bx(W - .06, .016, .065, xb, dy + LND + (i + 1) * rise + .008, zl + run * i + .04),
          bx(W - .06, .045, .014, xb, dy + LND + (i + 1) * rise - .02, zl + run * i + .004)
        );
      }
      meshAt(merge(nos), mStairNose, 0, 0, 0);

      // 난간
      hr.push(tube(.03, ci, dy + H, z0, ci, dy + LND + H, zl));
      for (let k = 0; k <= 20; k++) {
        const t = k / 20;
        P(ci, dy + t * LND, z0 - t * n * run);
        if (k) P(ci, dy + LND + t * LND, zl + t * n * run);
      }
      bal.push(
        tube(.035, ci, dy + LND - .05, zl, ci, dy + LND + H + .05, zl),
        tube(.032, ci, dy, z0, ci, dy + H + .04, z0)
      );
      hr.push(tube(.03, co, dy + LND + H, -9.5, co, dy + LND + H, zl));
      for (let k = 0; k <= 7; k++) P(co, dy + LND, -9.5 + k * (zl + 9.5) / 7);
      bal.push(tube(.016, ci, dy + .1, z0, ci, dy + LND + .1, zl));
      hr.push(tube(.03, ci, dy + LND + H, zl, ci, dy + FH + H, z0), tube(.03, co, dy + LND + H, zl, co, dy + FH + H, z0));
      for (let k = 1; k <= 20; k++) { const t = k / 20; P(co, dy + LND + t * LND, zl + t * n * run); }
      bal.push(tube(.016, ci, dy + LND + .1, zl, ci, dy + FH + .1, z0), tube(.016, co, dy + LND + .1, zl, co, dy + FH + .1, z0));

      if (guard) {
        hr.push(tube(.03, co, dy + 1.0, -9.55, co, dy + 1.0, z0));
        for (let k = 0; k <= 16; k++) P(co, dy, -9.55 + k * (z0 + 9.55) / 16, dy + 1.0);
        bal.push(tube(.032, co, dy, z0, co, dy + 1.04, z0));
      }
      hr.push(tube(.022, cx - 3.8, dy + .9, z0, cx - 3.8, dy + LND + .9, zl));
      for (let k = 0; k <= 3; k++) { const t = k / 3; bal.push(tube(.012, cx - 3.86, dy + .82 + t * LND, z0 - t * n * run, cx - 3.8, dy + .88 + t * LND, z0 - t * n * run)); }
      cur.interior.add(new THREE.Mesh(merge(hr), mWoodDark), new THREE.Mesh(merge(bal), mRailSteel));
    };

    const floorPiece = (x1, x2, z1, z2, y) => { const m = flat(cur.interior, mFloorTile, x1, x2, z1, z2, y); const uv = m.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + x1 / 4, uv.getY(i) - z2 / 4); return m; };
    const cw = cx - 3.85;
    if (hasDown) { floorPiece(cx - 4, cw, -9.6, -1.75, 0); floorPiece(hx2, cx + 4, -9.6, -1.75, 0); floorPiece(cw, hx2, hz2, -1.75, 0); }
    else floorPiece(cx - 4, cx + 4, -9.6, -1.75, 0);
    core(0, hasDown, !hasUp);

    const liner = (y1, y2) => {
      const h = y2 - y1, y = (y1 + y2) / 2;
      meshAt(merge([
        bx(.04, h, hz2 + 9.6, hx2 + .02, y, (hz2 - 9.6) / 2),
        bx(hx2 - cw, h, .04, (cw + hx2) / 2, y, hz2 + .02)
      ]), mUnderSlab, 0, 0, 0);
    };

    const room = (dy) => {
      const wMat = mWall;
      const tf = dy > 0 ? (cur.f === 4 ? 0 : cur.f + 1) : (cur.f === 0 ? 4 : cur.f - 1);
      const hasNorthPass = !cur.annex && tf >= 0 && tf <= 2;
      buildLayered1998Wall(cur.interior, cx - 4.15, cx - 3.85, -9.9, -1.75, dy, dy + FH, wMat);
      if (hasNorthPass) {
        buildLayered1998Wall(cur.interior, cx - 4.15, cx + .05, -9.9, -9.6, dy, dy + FH, wMat);
        buildLayered1998Wall(cur.interior, cx + 1.55, cx + 4.15, -9.9, -9.6, dy, dy + FH, wMat);
        buildLayered1998Wall(cur.interior, cx + .05, cx + 1.55, -9.9, -9.6, dy + 2.45, dy + FH, wMat);
        add(mWoodDark, .12, 2.45, .28, cx + .05, dy, -9.75);
        add(mWoodDark, .12, 2.45, .28, cx + 1.55, dy, -9.75);
        add(mWoodDark, 1.62, .12, .28, cx + .8, dy + 2.45, -9.75);
        flat(cur.interior, mFloorTile, cx + .05, cx + 1.55, -10.2, -9.5, dy + .012);
        const lbl = tf === 0 ? '후문 · 필로티 광장 (별관 1F 직결) ↑' : (tf + 1) + '층 구름다리 통로 (별관 ' + (tf + 1) + 'F 직결) ↑';
        plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign(lbl, '#182c38', '#d8f0e8', 22), color: 0x9aa59a }), 1.85, .32, cx + .8, dy + 2.75, -9.56);
      } else if (cur.annex && tf >= 8) {
        buildLayered1998Wall(cur.interior, cx - 4.15, cx + .15, -9.9, -9.6, dy, dy + FH, wMat);
        buildLayered1998Wall(cur.interior, cx + 1.85, cx + 4.15, -9.9, -9.6, dy, dy + FH, wMat);
        buildLayered1998Wall(cur.interior, cx + .15, cx + 1.85, -9.9, -9.6, dy, dy + 1.0, wMat);
        buildLayered1998Wall(cur.interior, cx + .15, cx + 1.85, -9.9, -9.6, dy + 2.8, dy + FH, wMat);
        win3D(cur.interior, 1.7, 1.8, cx + 1.0, dy + 1.9, -9.58);
      } else {
        buildLayered1998Wall(cur.interior, cx - 4.15, cx + 4.15, -9.9, -9.6, dy, dy + FH, wMat);
      }
      buildLayered1998Wall(cur.interior, cx + 3.85, cx + 4.15, -9.9, -1.75, dy, dy + FH, wMat);
      // 위/아래층 계단실에서도 엘리베이터 샤프트 전면벽 및 출입문이 끊기지 않고 일체형으로 보이도록 시공!
      {
        const bay = elevatorBay(cx), ex = bay.doorX, ez = bay.doorZ;
        buildLayered1998Wall(cur.interior, bay.front, bay.front + .2, bay.z1, ez - bay.halfOpening, dy, dy + FH, wMat);
        buildLayered1998Wall(cur.interior, bay.front, bay.front + .2, ez + bay.halfOpening, bay.z2, dy, dy + FH, wMat);
        buildLayered1998Wall(cur.interior, bay.front, bay.front + .2, ez - bay.halfOpening, ez + bay.halfOpening, dy + 2.4, dy + FH, wMat);
        const eg = new THREE.Group(); eg.position.set(ex, dy, ez); eg.rotation.y = -Math.PI / 2; cur.interior.add(eg);
        const efr = new THREE.Mesh(merge([bx(.14, 2.4, .1, -.87, 1.2, 0), bx(.14, 2.4, .1, .87, 1.2, 0), bx(1.88, .16, .1, 0, 2.44, 0)]), mChrome); efr.position.z = .08; eg.add(efr);
        [-.4, .4].forEach(dx => { const ed = new THREE.Mesh(new THREE.BoxGeometry(.8, 2.36, .04), mMetal); ed.position.set(dx, 1.18, 0); eg.add(ed); });
        const eind = new THREE.Mesh(new THREE.PlaneGeometry(.5, .2), new THREE.MeshBasicMaterial({ map: T.makeSign(EL_LABEL[tf] || '', '#120806', '#ff5a2a', 34), color: 0xffb090 })); eind.position.set(0, 2.72, .09); eg.add(eind);
        const epnl = new THREE.Mesh(new THREE.BoxGeometry(.14, .3, .03), mChrome); epnl.position.set(1.15, 1.25, .085); eg.add(epnl);
        plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('승강기 · 정원 9명', '#d8d4c8', '#2a2a2a', 20), roughness: .8 }), .6, .14, bay.front - .015, dy + 1.75, ez - 1.15, -Math.PI / 2);
      }
      // 위/아래층 계단실 서쪽 벽 표지판 · 소화기 · 형광등 등기구도 동일하게 배치하여 층 전환 순간 팝인(Pop-in) 완전 제거!
      if (tf === 0 || tf === 4) {
        plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign(tf === 0 ? '↓ B1 지하층' : 'B1 지하층  ↑ 1층', '#1a1a1a', '#e8d070', 26), color: 0xb0a890 }), 1.2, .3, cx - 3.83, dy + 2.3, -4.2, Math.PI / 2);
      }
      {
        const sgTxt = tf === 4 ? '▲ 1층 올라가는 계단' : (tf === 10 ? '▼ 아래층 내려가는 계단' : '▲ 위층   ▼ 아래층');
        plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign(sgTxt, '#1e2a2e', '#d9e4d0', 24), color: 0x9aa59a }), 1.25, .32, cx - 3.83, dy + 2.35, -2.35, Math.PI / 2);
      }
      const dxOff = dy > 0 ? .015 : -.015;
      model('korean_fire_extinguisher_01', cx + 1.65 + dxOff, dy, -3.0, -Math.PI / 2);
      model('korean_fire_extinguisher_01', cx + 1.65 + dxOff, dy, -3.4, -Math.PI / 2 + .3);
      {
        const lt = new THREE.Mesh(new THREE.BoxGeometry(1.3, .035, .12), matLampOn); lt.position.set(cx + .9, dy + CH - .07, -5.6); lt.rotation.y = Math.PI / 2; cur.interior.add(lt);
        const lhs = new THREE.Mesh(new THREE.BoxGeometry(1.4, .04, .22), lampHousing); lhs.position.set(cx + .9, dy + CH - .02, -5.6); lhs.rotation.y = Math.PI / 2; cur.interior.add(lhs);
      }
      buildLayered1998Wall(cur.interior, cx - 10, cx - 1, -1.75, -1.45, dy, dy + CH, wMat);
      buildLayered1998Wall(cur.interior, cx + 1, cx + 10, -1.75, -1.45, dy, dy + CH, wMat);
      buildLayered1998Wall(cur.interior, cx - 1, cx + 1, -1.75, -1.45, dy + 2.4, dy + CH, wMat);
      if (hasNorthPass) {
        buildLayered1998Wall(cur.interior, cx - 10, cx - 3.2, 1.45, 1.75, dy, dy + CH, wMat);
        buildLayered1998Wall(cur.interior, cx + 3.2, cx + 10, 1.45, 1.75, dy, dy + CH, wMat);
        buildLayered1998Wall(cur.interior, cx - 3.2, cx + 3.2, 1.45, 1.75, dy + 2.4, dy + CH, wMat);
        buildLayered1998Wall(cur.interior, cx - 4.15, cx - 3.85, 1.75, 9.6, dy, dy + CH, wMat);
        buildLayered1998Wall(cur.interior, cx + 3.85, cx + 4.15, 1.75, 9.6, dy, dy + CH, wMat);
        floorPiece(cx - 4, cx + 4, 1.45, 9.6, dy);
        flat(cur.interior, mCeil, cx - 4, cx + 4, 1.45, 9.6, dy + CH, 4, false);
      } else {
        buildLayered1998Wall(cur.interior, cx - 10, cx + 10, 1.45, 1.75, dy, dy + CH, wMat);
      }
      add(mWoodDark, .1, 2.4, .36, cx - 1.0, dy, -1.6); add(mWoodDark, .1, 2.4, .36, cx + 1.0, dy, -1.6);
      flat(cur.interior, mCeil, cx - 10, cx + 10, -1.75, 1.45, dy + CH, 4, false);
      floorPiece(cx - 10, cx + 10, -1.45, 1.45, dy);
      if (dy > 0) {
        floorPiece(cx - 4, cw, -9.6, -1.75, dy);
        floorPiece(hx2, cx + 4, -9.6, -1.75, dy);
        floorPiece(cw, hx2, hz2, -1.75, dy);
      }
      // 위/아래층 계단실 천장 조명 추가 (계단 이동 중에도 위/아래층 계단참 바닥이 어둡게 묻히지 않고 환하게 비춰지도록 보장!)
      cur.lamps.push({ x: cx + .9, y: cur.y0 + dy + CH - .5, z: -5.6, kind: 'on', mat: matLampOn });
    };

    { const cx1 = cx - 3.85; meshAt(merge([bx(.04, FH - CH, -3.0 + 9.6, hx2 + .02, (CH + FH) / 2, (-9.6 - 3.0) / 2), bx(hx2 - cx1, FH - CH, .04, (cx1 + hx2) / 2, (CH + FH) / 2, -2.98)]), mUnderSlab, 0, 0, 0); }
    cur.interior.add(boxMesh(cx - 4.15, cx - 3.85, CH, FH, -9.9, -1.75, mPlaster98), boxMesh(cx - 4.15, cx + 4.15, CH, FH, -9.9, -9.6, mPlaster98), boxMesh(cx - 4.15, cx - 1, CH, FH, -1.75, -1.45, mPlaster98));
    if (hasUp && !cur.annex && cur.f === 2) {
      const TH = 2.8, zs = -2.85, wm = mPlaster98;
      cur.interior.add(boxMesh(cx - 4.15, cx - 3.85, FH, FH + TH, -9.9, zs + .2, wm), boxMesh(cx - 4.15, hx2 + .2, FH, FH + TH, -9.9, -9.6, wm), boxMesh(hx2, hx2 + .2, FH - (FH - CH), FH + TH, -9.9, zs + .2, wm),
        boxMesh(cx - 3.85, cx - 2.5, FH, FH + TH, zs, zs + .2, wm), boxMesh(cx - 2.5, hx2, FH + 2.25, FH + TH, zs, zs + .2, wm), boxMesh(cx - 4.15, hx2 + .2, FH + TH, FH + TH + .2, -9.9, zs + .2, mUnderSlab));
      const rl = [tube(.03, cx - 2.5, FH + .95, zs, cx - 2.5, FH + .95, zl)]; for (let k = 0; k <= 8; k++) rl.push(tube(.012, cx - 2.5, FH, zs - k * (zs - zl) / 8, cx - 2.5, FH + .95, zs - k * (zs - zl) / 8));
      cur.interior.add(new THREE.Mesh(merge(rl), mRailSteel));
    } else if (hasUp) { core(FH, true, !!cur.annex && cur.f === 9); room(FH); flat(cur.interior, mCeil, cx - 4, cx + 4, -9.6, -1.75, FH + CH, 4, false); }
    else flat(cur.interior, mCeil, cx - 4, cx + 4, -9.6, -1.75, CH, 4, false);
    if (hasDown) { liner(-(FH - CH), 0); core(-FH, false, false); room(-FH); floorPiece(cx - 4, cx + 4, -9.6, -1.75, -FH); }
    if (!hasUp) {
      col(cx - 3.85, cx - 2.45, -9.6, z0 + .15);
    }
    if (cur.stairCx == null) cur.stairCx = cx;
    col(cx - 2.56, cx - 2.44, -7.7, z0 + .1); col(cx - 1.25, cx - 1.15, -9.6, z0 + .1);
    elevator(cx);
    if (cur.f === 0 || cur.f === 4) plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign(cur.f === 0 ? '↓ B1 지하층' : 'B1 지하층  ↑ 1층', '#1a1a1a', '#e8d070', 26), color: 0xb0a890 }), 1.2, .3, cx - 3.83, 2.3, -4.2, Math.PI / 2);
    if (cur.f <= 2 && !cur.annex && !cur.basement) {
      add(mWoodDark, .12, 2.45, .28, cx + .05, 0, -9.75); add(mWoodDark, .12, 2.45, .28, cx + 1.55, 0, -9.75); add(mWoodDark, 1.62, .12, .28, cx + .8, 2.45, -9.75);
      flat(cur.interior, mFloorTile, cx + .05, cx + 1.55, -10.2, -9.5, .012);
      const lbl = cur.f === 0 ? '후문 · 필로티 광장 (별관 1F 직결) ↑' : (cur.f + 1) + '층 구름다리 통로 (별관 ' + (cur.f + 1) + 'F 직결) ↑';
      plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign(lbl, '#182c38', '#d8f0e8', 22), color: 0x9aa59a }), 1.85, .32, cx + .8, 2.75, -9.56);
    } else if (!cur.basement) win3D(cur.interior, 1.7, 1.8, cx + 1.0, 1.9, -9.58);
    const sg2 = new THREE.MeshBasicMaterial({ map: T.makeSign(cur.f === 4 ? '▲ 1층 올라가는 계단' : (cur.f === 10 ? '▼ 아래층 내려가는 계단' : '▲ 위층   ▼ 아래층'), '#1e2a2e', '#d9e4d0', 24), color: 0x9aa59a });
    plane(cur.interior, sg2, 1.25, .32, cx - 3.83, 2.35, -2.35, Math.PI / 2);
    model('korean_fire_extinguisher_01', cx + 1.65, 0, -3.0, -Math.PI / 2); model('korean_fire_extinguisher_01', cx + 1.65, 0, -3.4, -Math.PI / 2 + .3);
    if (cur.basement) {
      plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('B1  설비 · 창고 · 기록', '#1e2a2e', '#d9e4d0', 22), roughness: .8 }), 1.4, .35, cx + 2.025, 1.7, -4.5, -Math.PI / 2);
      plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('B1', '#c8a020', '#1a1a1a', 40), roughness: .8 }), .5, .3, cx - 2.5, 2.6, -9.56);
      cctv(cx + 1.85, CH, -9.3, -Math.PI * .25, {label:'B1 · 진입 계단실'});
    }
  }

  /* ---------- 방송실 · 지하층 방 가구 ---------- */
  const mScreen = new THREE.MeshBasicMaterial({ map: imgTex('v_corridor'), color: 0x8fb4c8 });   // CRT: 복도 CCTV 화면
  const mBigScreen = new THREE.MeshBasicMaterial({ map: imgTex('old_class'), color: 0xa8b0b8 });  // 전자칠판: 그 교실 사진
  const mPlanMap = imgMat('map_old');
  // 벽 액자 (레퍼런스 이미지)
  function framed(k, w, h, x, y, z, ry = 0, mat) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w + .14, h + .14, .05), mWoodDark); fr.position.z = -.005; g.add(fr);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat || imgMat(k, { emissive: 0x0b0b0b })); p.position.z = .03; g.add(p);
    cur.interior.add(g); return g;
  }
  const mOnAir = new THREE.MeshBasicMaterial({ map: T.makeOnAir() });
  const mWarnS = new THREE.MeshStandardMaterial({ map: T.makeWarning(), roughness: .8 });
  const mClockM = new THREE.MeshStandardMaterial({ map: T.makeClock(), roughness: .8, emissive: 0x151410 });
  const glowRed = T.makeGlow('255,40,30');
  function glowAt(x, y, z, s, map) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.set(s, s, s); sp.position.set(x, y, z); cur.interior.add(sp); return sp; }
  function crt(x, y, z, ry = 0) { model('sf_crt_tv', x, y, z, ry); glowAt(x + Math.cos(ry) * .16 + Math.sin(ry) * .12, y + .08, z - Math.sin(ry) * .16 + Math.cos(ry) * .12, .08, glowRed); }
  function cyl(mat, r, h, x, y, z, seg = 14) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.position.set(x, y + h / 2, z); cur.interior.add(m); return m; }

  /* ---------- 상세 소품 라이브러리 (컴퓨터실 · 사무실 · 미술실 · 과학실 등) ---------- */
  const mPlastic = S(null, { color: 0xc9c4b4, roughness: .55 });          // 누렇게 바랜 베이지 플라스틱
  const mPlasticD = S(null, { color: 0x2a2b2e, roughness: .45, metalness: .1 });
  const mSeatFab = S(null, { color: 0x1e2226, roughness: .95 });
  const mKeys = new THREE.MeshStandardMaterial({ map: T.makeKeyboard(), roughness: .6 });
  const mScrOff = new THREE.MeshStandardMaterial({ map: T.makeScreenOff(false), roughness: .12, metalness: .2 });
  const mScrCrack = new THREE.MeshStandardMaterial({ map: T.makeScreenOff(true), roughness: .15, metalness: .2 });
  const mRack = new THREE.MeshStandardMaterial({ map: T.makeRack(), roughness: .5, metalness: .3, emissive: 0xffffff, emissiveMap: null });
  mRack.emissiveMap = mRack.map; mRack.emissiveIntensity = .08;
  const mCabinet = grunge(S(T.makeCabinet(), { roughness: .55, metalness: .35 }));
  const mPaints = [0, 1, 2, 3].map(k => new THREE.MeshStandardMaterial({ map: T.makePainting(k), roughness: .85 }));
  const mCable = S(null, { color: 0x151515, roughness: .6 });
  // 사무용 의자: 5발 바퀴 받침 + 가스 실린더 + 쿠션 + 등받이
  const ocBase = merge([...[0, 1, 2, 3, 4].map(k => bx(.32, .03, .045, .16, .06, 0).rotateY(k * 1.2566)), ...[0, 1, 2, 3, 4].map(k => new THREE.SphereGeometry(.028, 6, 4).translate(.3, .03, 0).rotateY(k * 1.2566))]);
  const ocPost = new THREE.CylinderGeometry(.025, .03, .36, 8).translate(0, .25, 0);
  const ocSeat = merge([bx(.46, .07, .44, 0, .46, 0), bx(.42, .42, .06, 0, .78, .23), bx(.06, .18, .06, 0, .56, .23).rotateX(-.15)]);
  const ocArm = merge([bx(.04, .2, .04, -.24, .58, -.02), bx(.04, .2, .04, .24, .58, -.02), bx(.05, .03, .26, -.24, .69, -.02), bx(.05, .03, .26, .24, .69, -.02)]);
  function officeChair(x, z, ry, tipped = false) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; cur.interior.add(g);
    g.add(new THREE.Mesh(ocBase, mPlasticD), new THREE.Mesh(ocPost, mChrome), new THREE.Mesh(ocSeat, mSeatFab), new THREE.Mesh(ocArm, mPlasticD));
    if (tipped) { g.rotation.z = Math.PI / 2 - .1; g.position.y = .32; }
    else col(x - .28, x + .28, z - .28, z + .28);
    return g;
  }
  // 모니터 (LCD: 얇은 베젤 + 목 + 받침 / CRT: 뒤가 불룩한 브라운관). 화면 위치를 돌려준다
  const lcdBody = merge([bx(.52, .34, .035, 0, .27, 0), bx(.06, .14, .03, 0, .08, -.04), bx(.22, .015, .16, 0, .008, -.02)]);
  const crtBody = merge([bx(.42, .36, .34, 0, .2, 0), bx(.3, .26, .14, 0, .19, -.22), bx(.24, .03, .24, 0, .015, -.05)]);
  function monitor(x, y, z, ry, o = {}) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; cur.interior.add(g);
    const crtT = !!o.crt;
    g.add(new THREE.Mesh(crtT ? crtBody : lcdBody, crtT ? mPlastic : mPlasticD));
    const sw = crtT ? .34 : .47, sh = crtT ? .27 : .29, sy = crtT ? .21 : .275, sz = crtT ? .171 : .018;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), o.cracked ? mScrCrack : mScrOff); s.position.set(0, sy, sz); g.add(s);
    if (o.fallen) { g.rotation.x = -1.45; g.position.y = y + .03; }
    const wp = new THREE.Vector3(0, sy, sz + .004); g.updateMatrixWorld(true); const v = wp.applyMatrix4(g.matrix);
    return { x: v.x, y: v.y, z: v.z, ry, w: sw * .96, h: sh * .94 };
  }
  const towerG = merge([bx(.19, .42, .44, 0, .21, 0), bx(.17, .015, .02, 0, .36, .221), bx(.17, .015, .02, 0, .32, .221)]);
  function pcTower(x, y, z, ry) { const m = meshAt(towerG, mPlastic, x, y, z, ry); const l = meshAt(new THREE.BoxGeometry(.012, .012, .005), S(null, { color: 0x305a30 }), 0, .26, .222, 0, m); l.position.x = .05; return m; }
  function keyboard(x, y, z, ry) { const kb = meshAt(new THREE.BoxGeometry(.44, .022, .15), mPlasticD, x, y + .011, z, ry); const top = new THREE.Mesh(new THREE.PlaneGeometry(.43, .14), mKeys); top.rotation.x = -Math.PI / 2; top.position.y = .0115; kb.add(top); kb.rotation.x = .06; return kb; }
  function mouse(x, y, z, ry) { const m = meshAt(new THREE.SphereGeometry(.035, 10, 6, 0, 6.3, 0, 1.6).scale(.85, .5, 1.3), mPlasticD, x, y, z, ry); return m; }
  // 바닥을 따라 늘어진 케이블
  function cable(pts) { const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z))); cur.interior.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, .008, 5), mCable)); }
  // 서버 랙 (전면 장비 · LED)
  function serverRack(x, z, ry) {
    const g = meshAt(merge([bx(.62, 1.9, .08, 0, .95, -.37), bx(.04, 1.9, .8, -.29, .95, 0), bx(.04, 1.9, .8, .29, .95, 0), bx(.62, .04, .8, 0, 1.88, 0), bx(.62, .08, .8, 0, .04, 0)]), mPlasticD, x, 0, z, ry);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(.54, 1.78), mRack); face.position.set(0, .96, .3); g.add(face);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(.56, 1.82), mGlass); door.position.set(0, .96, .4); g.add(door);
    col(x - .35, x + .35, z - .42, z + .42); return g;
  }
  // 레이저 프린터
  function printer(x, y, z, ry) {
    const g = meshAt(merge([bx(.44, .26, .38, 0, .13, 0), bx(.36, .02, .2, 0, .27, .02), bx(.3, .015, .16, 0, .17, .26)]), mPlastic, x, y, z, ry);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(.21, .28), mDirtPaper); p.rotation.x = -Math.PI / 2 + .2; p.position.set(0, .2, .3); g.add(p);
    meshAt(new THREE.BoxGeometry(.1, .04, .01), mPlasticD, .12, .2, .192, 0, g); return g;
  }
  // 철제 4단 서류함
  function fileCabinet(x, z, ry, open = false) {
    const g = meshAt(new THREE.BoxGeometry(.46, 1.32, .6).translate(0, .66, 0), mCabinet, x, 0, z, ry);
    if (open) { const d = meshAt(merge([bx(.4, .26, .5, 0, 0, 0)]), mMetal, 0, .95, .32, 0, g); d.position.z = .3; }
    col(x - .28, x + .28, z - .3, z + .3); return g;
  }
  // 이젤 (A 프레임 + 받침대 + 캔버스)
  function easel(x, z, ry, paint) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; cur.interior.add(g);
    const legs = merge([tube(.018, -.3, 0, .12, -.05, 1.7, 0), tube(.018, .3, 0, .12, .05, 1.7, 0), tube(.018, 0, 0, -.45, 0, 1.55, -.02), bx(.66, .04, .07, 0, .78, .1), bx(.1, .04, .06, 0, 1.58, .05)]);
    g.add(new THREE.Mesh(legs, mWood));
    const cv = new THREE.Mesh(new THREE.BoxGeometry(.6, .75, .025), mWhite); cv.position.set(0, 1.18, .11); cv.rotation.x = -.08; g.add(cv);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(.58, .73), mPaints[paint % 4]); pic.position.z = .0135; cv.add(pic);
    if (paint === 2 && !boardRefs.portrait) boardRefs.portrait = { mesh: pic, floor: cur.f, x, z };
    col(x - .35, x + .35, z - .35, z + .35); return g;
  }
  // 학생 의자 한 개 (인스턴싱 없이)
  function deskChair(x, z, ry = Math.PI) { (cur.furnOcc ||= []).push({ x, z, w: .55, d: .55 }); const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry + Math.PI; g.add(new THREE.Mesh(seatG, mWood), new THREE.Mesh(chairLegG, mMetal)); cur.interior.add(g); return g; }
  // 둥근 의자 (과학실 · 미술실)
  const stoolG = merge([new THREE.CylinderGeometry(.16, .16, .04, 14).translate(0, .62, 0), ...[0, 1, 2, 3].map(k => tube(.012, Math.cos(k * 1.57 + .78) * .1, .6, Math.sin(k * 1.57 + .78) * .1, Math.cos(k * 1.57 + .78) * .18, 0, Math.sin(k * 1.57 + .78) * .18)), new THREE.TorusGeometry(.14, .008, 4, 14).rotateX(Math.PI / 2).translate(0, .22, 0)]);
  function stool(x, z, tipped = false) { const m = meshAt(stoolG, mMetal, x, 0, z, rnd() * 6); const s = new THREE.Mesh(new THREE.CylinderGeometry(.165, .165, .03, 14), mWoodDark); s.position.y = .655; m.add(s); if (tipped) { m.rotation.z = 1.5; m.position.y = .17; } }
  // 식당 벤치 테이블 (테이블 + 양쪽 일체형 벤치)
  function benchTable(x, z, len = 3.2) {
    meshAt(merge([bx(len, .05, .8, 0, .74, 0), bx(len, .04, .3, 0, .44, -.65), bx(len, .04, .3, 0, .44, .65)]), mWood, x, 0, z);
    const fr = []; for (const dx of [-len / 2 + .25, len / 2 - .25]) { fr.push(tube(.022, dx, 0, -.75, dx, .72, 0), tube(.022, dx, 0, .75, dx, .72, 0), tube(.02, dx, .42, -.75, dx, .42, .75)); }
    meshAt(merge(fr), mChrome, x, 0, z);
    col(x - len / 2, x + len / 2, z - .82, z + .82);
  }
  // 책상 위 잡동사니
  function deskClutter(x, y, z) {
    const r = rnd();
    if (r < .3) { const c = cyl(S(null, { color: pick([0xe8e0d0, 0x2a4a6a, 0x8a2a20]), roughness: .4 }), .04, .1, x, y, z, 10); }
    else if (r < .55) { const b = meshAt(new THREE.BoxGeometry(.22, .03, .3), S(null, { color: pick([0x6a2a22, 0x2a3a58, 0x4a5a3a]) }), x, y + .015, z, rr(-.6, .6)); }
    else if (r < .75) { const p = new THREE.Mesh(new THREE.PlaneGeometry(.21, .29), mDirtPaper); p.rotation.set(-Math.PI / 2, 0, rr(-.8, .8)); p.position.set(x, y + .003, z); cur.interior.add(p); }
  }
  // 방송실 (방송실 내부 배치 시트 · 방송실 상세 배치도): 북서 녹음 부스 · 북쪽 메인 콘솔 + 모니터 벽 · 북동 장비실(랙 · 케이블) ·
  // 서쪽 크로마키 + 삼각대 카메라 · 남쪽 마이크 데스크 · 동쪽 보관함 · 릴 테이프 레코더
  let BM = null;
  const bcMats = () => {
    if (BM) return BM;
    const cv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    const dust = (g, w, h, n) => { for (let i = 0; i < n; i++) { const x = rnd() * w, y = rnd() * h, r = 6 + rnd() * 50, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(150,140,120,${.04 + rnd() * .1})`); gr.addColorStop(1, 'rgba(150,140,120,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } };
    // 믹서 상판: 채널 스트립 24 + 마스터 (노브 · 버튼 · 페이더)
    const mixer = cv(1024, 400, (g, w, h) => {
      g.fillStyle = '#2b2d2f'; g.fillRect(0, 0, w, h);
      const N = 22, sw = 40;
      for (let c = 0; c < N; c++) { const x0 = 10 + c * sw; g.fillStyle = c % 2 ? '#303235' : '#2a2c2e'; g.fillRect(x0, 0, sw - 2, h);
        for (let k = 0; k < 6; k++) { const y = 24 + k * 30; g.fillStyle = '#111'; g.beginPath(); g.arc(x0 + 19, y, 10, 0, 7); g.fill(); g.fillStyle = ['#c8c8c0', '#c8c8c0', '#4a7ad0', '#4a7ad0', '#d0c040', '#c84a3a'][k]; g.beginPath(); g.arc(x0 + 19, y, 7, 0, 7); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 2; const a = rnd() * 5 - 2.5; g.beginPath(); g.moveTo(x0 + 19, y); g.lineTo(x0 + 19 + Math.sin(a) * 7, y - Math.cos(a) * 7); g.stroke(); }
        for (let k = 0; k < 2; k++) { g.fillStyle = rnd() < .3 ? '#d84a30' : '#8a8a84'; g.fillRect(x0 + 8, 205 + k * 16, 22, 10); }
        g.fillStyle = '#0b0b0c'; g.fillRect(x0 + 17, 245, 4, 140); const fy = 260 + rnd() * 100; g.fillStyle = '#d8d6cc'; g.fillRect(x0 + 8, fy, 22, 16); g.fillStyle = '#222'; g.fillRect(x0 + 8, fy + 7, 22, 2);
        g.fillStyle = '#e8e2c8'; g.fillRect(x0 + 4, 232, 30, 8); }
      const mx = 10 + N * sw + 6; g.fillStyle = '#25272a'; g.fillRect(mx, 0, w - mx, h);
      for (let k = 0; k < 4; k++) { g.fillStyle = '#111'; g.fillRect(mx + 14 + k * 30, 250, 4, 130); g.fillStyle = k > 1 ? '#c84a3a' : '#d8d6cc'; g.fillRect(mx + 5 + k * 30, 280 + k * 12, 22, 16); }
      for (let k = 0; k < 8; k++) { g.fillStyle = '#111'; g.beginPath(); g.arc(mx + 30 + (k % 4) * 30, 40 + (k / 4 | 0) * 40, 11, 0, 7); g.fill(); g.fillStyle = '#9a9a92'; g.beginPath(); g.arc(mx + 30 + (k % 4) * 30, 40 + (k / 4 | 0) * 40, 8, 0, 7); g.fill(); }
      g.fillStyle = '#e8e2c8'; g.font = 'bold 14px sans-serif'; g.fillText('MASTER', mx + 30, 140);
      dust(g, w, h, 90); g.fillStyle = 'rgba(20,16,12,.35)'; for (let i = 0; i < 30; i++) g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 30, 1 + rnd() * 3);
    });
    // 미터 브리지: 호박색 VU 미터 8개
    const vu = cv(1024, 96, (g, w, h) => { g.fillStyle = '#1c1d1f'; g.fillRect(0, 0, w, h); for (let k = 0; k < 8; k++) { const x = 20 + k * 126; g.fillStyle = '#e8b048'; g.fillRect(x, 12, 110, 70); g.strokeStyle = '#3a2810'; g.lineWidth = 2; g.beginPath(); g.arc(x + 55, 92, 62, -2.4, -.75); g.stroke(); for (let t = 0; t < 9; t++) { const a = -2.4 + t * .206; g.beginPath(); g.moveTo(x + 55 + Math.cos(a) * 58, 92 + Math.sin(a) * 58); g.lineTo(x + 55 + Math.cos(a) * 66, 92 + Math.sin(a) * 66); g.stroke(); } g.fillStyle = '#b02a20'; g.fillRect(x + 82, 26, 18, 4); const a = -2.3 + rnd() * .6; g.strokeStyle = '#111'; g.beginPath(); g.moveTo(x + 55, 88); g.lineTo(x + 55 + Math.cos(a) * 64, 88 + Math.sin(a) * 64); g.stroke(); g.fillStyle = '#3a2810'; g.font = '11px sans-serif'; g.fillText('VU', x + 48, 76); } dust(g, w, h, 20); });
    // 장비 랙 전면 (랙 유닛: 패널 · 통풍구 · 노브 · LED · 표시창) + 같은 좌표의 발광 마스크
    const rack = seed => { const c = document.createElement('canvas'), e = document.createElement('canvas'); c.width = e.width = 256; c.height = e.height = 1024; const g = c.getContext('2d'), q = e.getContext('2d');
      g.fillStyle = '#141516'; g.fillRect(0, 0, 256, 1024); q.fillStyle = '#000'; q.fillRect(0, 0, 256, 1024);
      g.fillStyle = '#2a2b2d'; g.fillRect(0, 0, 16, 1024); g.fillRect(240, 0, 16, 1024); for (let y = 8; y < 1024; y += 22) { g.fillStyle = '#0a0a0a'; g.fillRect(5, y, 6, 6); g.fillRect(245, y, 6, 6); }
      let y = 30; while (y < 990) { const u = pick([1, 1, 2, 2, 3, 4]), hh = u * 44 - 4; if (rnd() < .15) { y += u * 44; continue; }
        g.fillStyle = pick(['#2c2d30', '#1e1f21', '#3a3b3d', '#8a8c88', '#262729']); g.fillRect(18, y, 220, hh); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(18, y, 220, 2);
        g.fillStyle = '#0a0a0a'; [24, 228].forEach(sx => { g.beginPath(); g.arc(sx, y + 8, 3, 0, 7); g.fill(); });
        const kind = rnd(); if (kind < .3) { for (let k = 0; k < 14; k++) { g.fillStyle = '#0b0b0b'; g.fillRect(40 + k * 13, y + 8, 6, hh - 16); } }
        else if (kind < .6) { for (let k = 0; k < 6; k++) { g.fillStyle = '#0d0d0d'; g.beginPath(); g.arc(50 + k * 30, y + hh / 2, 9, 0, 7); g.fill(); g.fillStyle = '#9a9a96'; g.beginPath(); g.arc(50 + k * 30, y + hh / 2, 6, 0, 7); g.fill(); } }
        else { g.fillStyle = '#0a140c'; g.fillRect(40, y + hh / 2 - 9, 70, 18); q.fillStyle = pick(['#30ff70', '#ffb030', '#40c0ff']); q.font = 'bold 14px monospace'; q.fillText(pick(['-12dB', '48.0k', 'CH 04', 'LINK', '88.2']), 44, y + hh / 2 + 5); g.fillStyle = '#103018'; g.font = 'bold 14px monospace'; g.fillText('88.8', 44, y + hh / 2 + 5); }
        for (let k = 0; k < 4 + (rnd() * 6 | 0); k++) { const lx = 140 + k * 10, ly = y + 8 + (k % 2) * 8; g.fillStyle = '#300'; g.fillRect(lx, ly, 5, 5); if (rnd() < .6) { q.fillStyle = pick(['#ff3020', '#30ff60', '#ffb020']); q.fillRect(lx, ly, 5, 5); } }
        y += u * 44; }
      for (let i = 0; i < 50; i++) { const x = rnd() * 256, yy = rnd() * 1024, r = 10 + rnd() * 50, gr = g.createRadialGradient(x, yy, 0, x, yy, r); gr.addColorStop(0, `rgba(150,140,120,${.05 + rnd() * .1})`); gr.addColorStop(1, 'rgba(150,140,120,0)'); g.fillStyle = gr; g.fillRect(x - r, yy - r, r * 2, r * 2); }
      const t = new THREE.CanvasTexture(c), te = new THREE.CanvasTexture(e); t.colorSpace = te.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      return new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: te, emissiveIntensity: .9, roughness: .5, metalness: .35 }); };
    // 흡음재 (피라미드 폼)
    const foam = cv(256, 256, (g, w, h) => { const n = 4, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const x = i * s, y = j * s, cx = x + s / 2, cy = y + s / 2; [['#2e2e33', [x, y, x + s, y]], ['#1d1d20', [x + s, y, x + s, y + s]], ['#121214', [x + s, y + s, x, y + s]], ['#26262a', [x, y + s, x, y]]].forEach(([c, p]) => { g.fillStyle = c; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[2], p[3]); g.lineTo(cx, cy); g.fill(); }); } dust(g, w, h, 25); });
    foam.wrapS = foam.wrapT = THREE.RepeatWrapping;
    // 스피커 정면
    const spk = cv(128, 192, (g, w, h) => { g.fillStyle = '#18181a'; g.fillRect(0, 0, w, h); const ring = (x, y, r) => { for (let k = 0; k < 4; k++) { g.fillStyle = ['#2a2a2c', '#0c0c0d', '#1e1e20', '#3a3a3c'][k]; g.beginPath(); g.arc(x, y, r * (1 - k * .24), 0, 7); g.fill(); } }; ring(64, 128, 50); ring(64, 42, 20); dust(g, w, h, 12); });
    // '교내방송' 포스터
    const poster = cv(384, 540, (g, w, h) => { g.fillStyle = '#d6cbb0'; g.fillRect(0, 0, w, h); dust(g, w, h, 30); g.fillStyle = '#20304a'; g.fillRect(0, 0, w, 120); g.fillStyle = '#e8e2d0'; g.font = 'bold 54px serif'; g.fillText('교내방송', 40, 82); g.fillStyle = '#2a2420'; g.font = 'bold 34px serif'; g.fillText('함께 만드는', 40, 200); g.fillText('우리의 학교', 40, 248); g.strokeStyle = '#b03028'; g.lineWidth = 6; for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(190, 400, k * 32, -2.4, -.75); g.stroke(); } g.fillStyle = '#b03028'; g.beginPath(); g.arc(190, 400, 14, 0, 7); g.fill(); g.fillStyle = '#2a2420'; g.font = '20px sans-serif'; g.fillText('방송부원 모집 · 3층 방송실', 40, h - 30); g.fillStyle = 'rgba(70,50,30,.3)'; g.beginPath(); g.moveTo(0, h); g.lineTo(80, h); g.lineTo(0, h - 100); g.fill(); });
    const M = o => S(null, o);
    BM = {
      mixer: new THREE.MeshStandardMaterial({ map: mixer, roughness: .55, metalness: .25 }),
      vu: new THREE.MeshStandardMaterial({ map: vu, emissive: 0xffffff, emissiveMap: vu, emissiveIntensity: .35, roughness: .4 }),
      racks: [0, 1, 2].map(rack),
      foam: new THREE.MeshStandardMaterial({ map: foam, roughness: 1 }),
      spk: new THREE.MeshStandardMaterial({ map: spk, roughness: .8 }),
      poster: new THREE.MeshStandardMaterial({ map: poster, roughness: .95 }),
      green: M({ color: 0x1f7a3e, roughness: .95, side: THREE.DoubleSide }),
      glass: new THREE.MeshStandardMaterial({ color: 0x8aa4a8, transparent: true, opacity: .22, roughness: .08, side: THREE.DoubleSide, depthWrite: false }),
      plast: M({ color: 0x3a3a38, roughness: .55 }), beige: M({ color: 0xb8ae94, roughness: .55 }), seat: M({ color: 0x2a2a30, roughness: .95 }),
      cable: [M({ color: 0x9a2018, roughness: .5 }), M({ color: 0x1e3a8a, roughness: .5 }), M({ color: 0x141414, roughness: .5 })],
      lamp: new THREE.MeshStandardMaterial({ color: 0x8a1010, emissive: 0xff2010, emissiveIntensity: .9, roughness: .3 }),
      led: new THREE.MeshBasicMaterial({ color: 0xd8d4c8 }),
    };
    return BM;
  };
  // 사무용 의자 (오염된 패브릭 · 5발 다리)
  function bcChair(x, z, ry = 0) {
    const B = bcMats(), legs = []; for (let k = 0; k < 5; k++) legs.push(new THREE.BoxGeometry(.04, .03, .3).translate(0, .07, .15).rotateY(k * 1.2566), new THREE.SphereGeometry(.025, 6, 4).translate(0, .025, .29).rotateY(k * 1.2566));
    meshAt(merge([...legs, new THREE.CylinderGeometry(.025, .03, .38, 8).translate(0, .27, 0), bx(.05, .04, .3, .26, .68, 0), bx(.05, .04, .3, -.26, .68, 0), bx(.03, .2, .03, .26, .56, .05), bx(.03, .2, .03, -.26, .56, .05)]), mDarkMetal, x, 0, z, ry);
    meshAt(merge([bx(.5, .09, .48, 0, .49, 0), bx(.48, .56, .08, 0, .86, -.24)]), B.seat, x, 0, z, ry);
    col(x - .28, x + .28, z - .28, z + .28);
  }
  function headphones(x, y, z, ry = 0) { const m = meshAt(merge([new THREE.TorusGeometry(.09, .012, 6, 16, Math.PI), new THREE.CylinderGeometry(.045, .045, .035, 14).rotateZ(Math.PI / 2).translate(.09, 0, 0), new THREE.CylinderGeometry(.045, .045, .035, 14).rotateZ(Math.PI / 2).translate(-.09, 0, 0)]), mBlack, x, y + .045, z, ry); m.rotation.x = -Math.PI / 2; m.rotation.order = 'YXZ'; return m; }
  function crt2(x, y, z, ry = 0, beige = false) {
    const B = bcMats(), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; cur.interior.add(g);
    g.add(new THREE.Mesh(merge([bx(.46, .4, .3, 0, .2, 0), bx(.34, .3, .2, 0, .2, -.24), bx(.2, .03, .2, 0, .015, -.05)]), beige ? B.beige : B.plast));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(.36, .28), mScreen); s.position.set(0, .21, .152); g.add(s);
    const led = new THREE.Mesh(new THREE.PlaneGeometry(.015, .008), MATLED[1]); led.position.set(.19, .03, .152); g.add(led);
    return g;
  }
  function speaker(x, y, z, ry = 0, w = .3, h = .45) { const B = bcMats(), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; cur.interior.add(g); g.add(new THREE.Mesh(bxF(w, h, .28, 0, h / 2, 0), mBlack)); const f = new THREE.Mesh(new THREE.PlaneGeometry(w * .94, h * .94), B.spk); f.position.set(0, h / 2, .141); g.add(f); return g; }
  // 케이블: 아래로 처진 곡선 (TubeGeometry) 여러 가닥을 색별로 합친다
  function cables(list) { const B = bcMats(), by = [[], [], []]; list.forEach(([pts, c]) => by[c].push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 24, .011, 5, false))); by.forEach((gs, c) => gs.length && meshAt(merge(gs), B.cable[c], 0, 0, 0)); }
  function broadcast(cx) {
    // 3층 서측 화장실(cx=-32) 철거 및 격벽(x=-28) 해체를 통해 통합 확장된 32평형(16.0m × 7.85m, x: -35.85 ~ -20.15, z: -9.6 ~ -1.75)
    // 2008년 한국 고등학교 방송실 (서편: 방송편집실 · 주조정실 / 동편: 레코딩 스튜디오 · 오픈 19인치 장비랙)
    if (cx === -32) return; // cx = -24 호출 시 서편(cx=-32, 방송편집실)과 동편(cx=-24, 방송실 스튜디오) 16m 전 구간을 일괄 시공!
    const zN = -9.6, zS = -1.75, B = bcMats();
    const W_EXT = -35.85, PART_X = -28.0, E_EXT = -20.15;
    const mAcousticCharcoal = S(null, { color: 0x1a1e24, roughness: .86 });
    const mAcousticPanel = S(null, { color: 0x262c34, roughness: .82 });
    const mSlatWalnut = S(null, { color: 0x784e2e, roughness: .50 });
    const mBeechDesk = S(null, { color: 0xb88c58, roughness: .46 });
    const mAlum08 = S(null, { color: 0xc4cad0, roughness: .30, metalness: .74 });
    const mTruss = S(null, { color: 0x181c22, roughness: .32, metalness: .78 });
    const mTrayGalv = S(null, { color: 0x8a929a, roughness: .38, metalness: .72 });
    const mSpotLight = new THREE.MeshStandardMaterial({ color: 0xfff4d8, emissive: 0xffc870, emissiveIntensity: 1.65 });
    const mTallyRed  = new THREE.MeshStandardMaterial({ color: 0xff2820, emissive: 0xff1810, emissiveIntensity: 2.2 });
    const mLedBlue   = new THREE.MeshBasicMaterial({ color: 0x38b8ff });
    const mLedGreen  = new THREE.MeshBasicMaterial({ color: 0x30ff88 });
    const mLedAmber  = new THREE.MeshBasicMaterial({ color: 0xffb830 });
    const mChairBlue = S(null, { color: 0x244262, roughness: .78 });

    // 2008년식 회전 사무/편집 의자 (5발 캐스터 + 가스 리프트 + 패브릭 좌판/등받이 + 착석 가능 등록!)
    const swivelChair08 = (x, z, ry = 0, roomLabel = '방송실') => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; cur.interior.add(g);
      const star = [0, 1, 2, 3, 4].map(k => tube(.014, 0, .08, 0, Math.cos(k * 1.256) * .25, .04, Math.sin(k * 1.256) * .25));
      g.add(new THREE.Mesh(merge([...star, new THREE.CylinderGeometry(.026, .026, .38, 10).translate(0, .22, 0)]), mDarkMetal));
      g.add(new THREE.Mesh(merge([
        bx(.46, .055, .44, 0, .44, 0),
        bx(.44, .44, .055, 0, .70, -.19),
        bx(.04, .20, .28, -.23, .56, -.03),
        bx(.04, .20, .28,  .23, .56, -.03)
      ]), mChairBlue));
      CHAIRS.push({ f: cur.f, x, z, ry, room: roomLabel });
      return g;
    };

    // 2008년식 NLE 편집 모니터 / 4:3 CRT 방송 모니터 캔버스 텍스처 생성기
    const makeScreenTex = (kind, title, sub, colHex = '#38b8ff') => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 192;
      const g = c.getContext('2d');
      g.fillStyle = '#0c1218'; g.fillRect(0, 0, 256, 192);
      if (kind === 'bars') {
        const cols = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
        cols.forEach((cl, i) => { g.fillStyle = cl; g.fillRect(i * 36.5, 0, 37, 128); });
        g.fillStyle = '#101820'; g.fillRect(0, 128, 256, 64);
      } else if (kind === 'nle') {
        g.fillStyle = '#18222c'; g.fillRect(6, 6, 118, 86); g.fillRect(130, 6, 120, 86);
        g.fillStyle = '#243442'; g.fillRect(6, 98, 244, 88);
        ['#2a78b8', '#38a868', '#b8682a', '#7858b8'].forEach((tc, ti) => {
          g.fillStyle = tc; g.fillRect(36, 106 + ti * 19, 180 - (ti % 2) * 35, 14);
        });
        g.strokeStyle = '#ff3830'; g.lineWidth = 2; g.beginPath(); g.moveTo(118, 98); g.lineTo(118, 186); g.stroke();
      } else {
        g.fillStyle = '#142028'; g.fillRect(10, 10, 236, 132);
        g.strokeStyle = colHex; g.lineWidth = 2; g.beginPath();
        for (let x = 14; x < 240; x += 6) {
          const y = 76 + Math.sin(x * .12) * 24 + Math.cos(x * .27) * 12;
          x === 14 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.72)'; g.fillRect(0, 152, 256, 40);
      g.fillStyle = colHex; g.font = 'bold 18px monospace'; g.fillText(title, 10, 171);
      g.fillStyle = '#d8e4ec'; g.font = '13px sans-serif'; g.fillText(sub, 10, 187);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshBasicMaterial({ map: t });
    };

    const animRoot = new THREE.Group(); animRoot.name = 'broadcast2008_anim'; animRoot.userData.dynamic = true;
    cur.interior.add(animRoot);
    const animState = { reels: [], tallyMats: [mTallyRed], vuBars: [], tBar: null, tBarPhase: 0, spotMat: mSpotLight };
    if (typeof window !== 'undefined') window.__broadcastAnims = animState;

    // ── [1] 전체 뼈대(16m 통합 바닥 · 방음 우드 슬랫 & 어쿠스틱 패브릭 월 · 중앙 방음 이중유리 관측창 격벽 · 천장 전기 케이블 트레이) ──
    // 서편 편집·조정실 정전기 방지 억세스 플로어(x: -35.82 ~ -28.0) & 동편 레코딩 스튜디오 차콜 방음 플로어(x: -28.0 ~ -20.18)
    add(S(null, { color: 0x222a34, roughness: .76 }), 7.80, .014, 7.76, -31.92, .002, -5.68);
    add(S(null, { color: 0x1a2028, roughness: .84 }), 7.80, .014, 7.76, -24.08, .002, -5.68);
    // 바닥 노란/검정 방송 케이블 보호 램프(Cable Protector) 2라인
    add(S(null, { color: 0xd8a818, roughness: .48 }), 4.6, .020, .22, -28.2, .004, -3.20);
    add(S(null, { color: 0xd8a818, roughness: .48 }), .22, .020, 3.8, -23.6, .004, -6.65);

    // 외곽 3면(북벽 z=-9.56, 서벽 x=-35.82, 동벽 x=-20.18) 방음 패브릭 & 원목 루버 슬랫 마감
    add(mAcousticCharcoal, 15.64, 3.48, .04, -28.0, .04, zN + .03);
    add(mAcousticCharcoal, .04, 3.48, 7.72, W_EXT + .03, .04, -5.68);
    add(mAcousticCharcoal, .04, 3.48, 7.72, E_EXT - .03, .04, -5.68);
    for (let x = -35.2; x <= -20.6; x += .32) {
      add(mSlatWalnut, .055, 2.68, .05, x, .42, zN + .048);
    }
    // 서벽·동벽 피라미드 흡음폼 패널 & 알루미늄 몰딩
    B.foam.map.repeat.set(6, 3);
    plane(cur.interior, B.foam, 6.8, 2.1, W_EXT + .06, 1.65, -5.68, Math.PI / 2);
    plane(cur.interior, B.foam, 6.8, 2.1, E_EXT - .06, 1.65, -5.68, -Math.PI / 2);
    add(mAlum08, 15.64, .04, .05, -28.0, .92, zN + .055);

    // ★ 중앙 방음 격벽 (x = -28.0, z: -9.6 ~ -1.75):
    // 북측(z: -9.6 ~ -4.15)은 하단 방음벽 + 대형 이중유리 스튜디오 관측창(z: -9.05 ~ -4.35, y: 0.92 ~ 2.38m)
    // 남측(z: -3.95 ~ -2.45)은 폭 1.5m 개방형 방음 스튜디오 출입구 (편집실 ↔ 스튜디오 자유 보행!)
    add(mAcousticPanel, .18, .92, 5.45, PART_X, 0, -6.875);
    add(mAcousticPanel, .18, 1.18, 5.45, PART_X, 2.38, -6.875);
    add(mAcousticPanel, .18, 3.52, .45, PART_X, 0, -9.375);
    add(mAcousticPanel, .18, 3.52, .30, PART_X, 0, -4.10);
    add(mAcousticPanel, .18, 3.52, .70, PART_X, 0, -2.10);
    add(mAcousticPanel, .18, 1.18, 1.50, PART_X, 2.38, -3.20);
    // 방음 이중유리 관측창 프레임 & 2중 유리면 & 원목 창턱
    add(mWoodDark, .28, .05, 4.76, PART_X, .90, -6.70);
    add(mAlum08, .20, .06, 4.72, PART_X, 2.36, -6.70);
    [-9.04, -7.48, -5.92, -4.36].forEach(pz => add(mAlum08, .20, 1.46, .06, PART_X, .92, pz));
    plane(cur.interior, B.glass, 4.66, 1.40, PART_X - .055, 1.65, -6.70, -Math.PI / 2);
    plane(cur.interior, B.glass, 4.66, 1.40, PART_X + .055, 1.65, -6.70,  Math.PI / 2);
    // 스튜디오 방음 출입문 (z: -3.95 ~ -2.45 개방, 문짝은 북쪽으로 열려 고정) & 양면 [ON AIR] 탈리 램프
    {
      const dLeaf = add(mDoorP, .92, 2.28, .06, PART_X + .42, 0, -4.02, { ry: .32 });
      const winM = new THREE.Mesh(new THREE.PlaneGeometry(.28, .42), B.glass); winM.position.set(0, 1.45, .035); dLeaf.add(winM);
    }
    add(mTallyRed, .08, .26, .88, PART_X - .10, 2.48, -3.20);
    add(mTallyRed, .08, .26, .88, PART_X + .10, 2.48, -3.20);
    plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('ON AIR · STUDIO A 녹화중', '#7a0c0c', '#ffffff', 24) }), .84, .22, PART_X - .145, 2.61, -3.20, -Math.PI / 2);
    plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('ON AIR · EDITING & MCR', '#162838', '#90e8ff', 24) }), .84, .22, PART_X + .145, 2.61, -3.20,  Math.PI / 2);
    col(PART_X - .12, PART_X + .12, -9.6, -4.02, true);
    col(PART_X - .12, PART_X + .12, -2.42, -1.75, true);

    // 천장 전기 설비: 용융아연도금 사다리형 케이블 트레이(Cable Tray) & 220V 분전반/AVR
    [-8.65, -5.20].forEach(tz => {
      add(mTrayGalv, 14.6, .04, .34, -28.0, 3.26, tz);
      for (let x = -35.0; x <= -21.0; x += 1.4) add(mTrayGalv, .04, .34, .34, x, 3.26, tz);
    });
    [-34.6, -29.3, -22.3].forEach(tx => add(mTrayGalv, .32, .04, 3.45, tx, 3.24, -6.92));
    // 동벽 220V 방송 주분전반(sf_fuse_box) & 자동전압조정기(AVR)
    model('sf_fuse_box', E_EXT - .28, 1.32, -6.15, -Math.PI / 2);
    add(mDarkMetal, .38, .68, .54, E_EXT - .22, 0, -6.15, { col: true });
    plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('방송실 주분전반 · AVR 220.4V / 60Hz', '#10241c', '#68ffb0', 20) }), .50, .16, E_EXT - .42, .52, -6.15, -Math.PI / 2);
    glowAt(E_EXT - .38, 1.55, -6.15, .18, glowGreen);

    // ── [2] 서편 구역 (x: -35.85 ~ -28.0): 방송편집실 & 주조정실 (01, 02, 03, 05번 도면 완벽 구현!) ──
    // (01) 6인 방송부 회의·편집 테이블 & 패브릭 회전의자 6석 (x = -32.25, z = -4.15)
    {
      const tx = -32.25, tz = -4.15, tw = 2.56, td = 1.16;
      add(mBeechDesk, tw, .045, td, tx, .72, tz);
      add(mDarkMetal, tw - .12, .04, td - .12, tx, .68, tz);
      [[-1.18, -.50], [1.18, -.50], [-1.18, .50], [1.18, .50], [0, -.50], [0, .50]].forEach(([dx, dz]) => {
        add(mAlum08, .05, .72, .05, tx + dx, 0, tz + dz);
      });
      // 테이블 중앙 배선 캡(Grommet) 2개 & 방송 큐시트·콘티 바인더·MiniDV 테이프 케이스
      [-0.55, 0.55].forEach(gx => cyl(mDarkMetal, .045, .01, tx + gx, .766, tz, 12));
      add(mPaperN, .32, .015, .24, tx - .75, .766, tz - .25, { ry: .08 });
      add(mPaperN, .30, .015, .22, tx + .15, .766, tz + .22, { ry: -.12 });
      add(S(null, { color: 0x22384c, roughness: .5 }), .26, .04, .32, tx - .15, .766, tz - .28, { ry: .2 });
      monitor(tx + .72, .765, tz - .12, -.25, { crt: false, cracked: false });
      keyboard(tx + .72, .765, tz + .18, -.25);
      col(tx - tw / 2, tx + tw / 2, tz - td / 2, tz + td / 2, false, .76);
      [-0.85, 0, 0.85].forEach(ox => {
        swivelChair08(tx + ox, tz - .82, 0, '방송편집실');
        swivelChair08(tx + ox, tz + .82, Math.PI, '방송편집실');
      });
    }

    // (02) 2008년형 비선형 영상편집(NLE) PC 워크스테이션 3석 (서벽 x = -35.05, z = -8.35, -6.55, -4.75)
    [-8.35, -6.55, -4.75].forEach((wz, idx) => {
      const wx = -35.05;
      model('h133/BRO-006', wx, 0, wz, Math.PI / 2, { col: [.65, 1.2] });
      // 2008년식 실버/블랙 미드타워 데스크톱 PC 본체 (DVD-RW 드라이브 2단 + 전면 IEEE1394/USB 포트 + 전원 LED)
      const pcX = wx - .12, pcZ = wz - .46;
      add(mDarkMetal, .42, .44, .19, pcX, .75, pcZ);
      add(mAlum08, .015, .42, .17, pcX + .21, .76, pcZ);
      add(mBlack, .02, .04, .14, pcX + .215, 1.10, pcZ);
      add(mBlack, .02, .04, .14, pcX + .215, 1.04, pcZ);
      plane(cur.interior, mLedBlue, .018, .018, pcX + .22, .92, pcZ - .04, Math.PI / 2);
      plane(cur.interior, mLedGreen, .018, .018, pcX + .22, .89, pcZ - .04, Math.PI / 2);
      // 듀얼 4:3 LCD 편집 모니터 (타임라인 & 프리뷰 화면)
      [wz - .16, wz + .22].forEach((mz, mi) => {
        add(mDarkMetal, .06, .32, .38, wx - .10, .84, mz);
        add(mAlum08, .08, .10, .08, wx - .12, .75, mz);
        plane(cur.interior, makeScreenTex(mi === 0 ? 'nle' : 'wave', 'NLE EDIT #' + (idx + 1), mi === 0 ? 'Premiere Timeline 01:11:40' : 'DV-AVI Audio Ch1/2'), .34, .26, wx - .068, 1.00, mz, Math.PI / 2);
      });
      keyboard(wx + .16, .75, wz + .04, Math.PI / 2);
      mouse(wx + .16, .75, wz - .24, Math.PI / 2);
      model('h133/BRO-007', wx + .12, .70, wz + .42, .4, { s: .65 });
      swivelChair08(wx + .72, wz, -Math.PI / 2, '방송편집실');
    });

    // 북서측 마스터 테이프 아카이브 캐비닛 & 방송실 벽시계(BRO-008) & 게시판
    trophyCase(-32.8, -9.22, 0, 1.8);
    plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('1998~2008 방송부 마스터 테이프 보관함 (DVCAM · S-VHS · 릴테이프)', '#162430', '#d8f0ff', 20) }), 1.72, .22, -32.8, 1.98, -8.98);
    model('h133/BRO-008', -32.8, 2.45, zN + .06, 0);
    noticeBoard(-30.4, 1.65, zN + .08, 0, 1.6);

    // (03 & 05) 주조정실(MCR) 메인 콘솔 데스크 (x = -29.25, z: -8.65 ~ -4.85 — 관측창 x=-28.0 정면 배치!)
    //   - 4:3 CRT 브라운관 프리뷰 모니터 브리지 (sf_crt_tv 4기 + 상단 멀티뷰 브리지)
    //   - SD 아날로그 비디오 스위처 (PGM/PST 버스 버튼 & T-Bar 전환 레버)
    //   - 24채널 아날로그 오디오 믹서 (h133/BRO-004 + VU 미터 브리지)
    //   - 구즈넥/유선 다이내믹 마이크 (h133/BRO-003) & 모니터 스피커 (h133/BRO-001) & 헤드폰 (h133/BRO-007)
    {
      const cxM = -29.25, czM = -6.75;
      add(mWoodDark, .96, .75, 3.76, cxM, 0, czM, { col: true });
      add(mBeechDesk, 1.02, .045, 3.82, cxM, .75, czM);
      add(mDarkMetal, .42, .28, 3.72, cxM + .26, .79, czM);
      // 4:3 브라운관 CRT 방송용 모니터 4기 (sf_crt_tv + 전면 컬러바/카메라 피드 화면 & 적색 탈리 LED)
      [
        [-8.15, 'CAM 1 · STUDIO', 'ANCHOR TWO-SHOT', '#ff5850', 'wave'],
        [-7.22, 'CAM 2 · GREEN', 'CHROMA KEY LIVE', '#50ff98', 'wave'],
        [-6.28, 'VTR 1 · DVCAM', 'TC 01:11:40:12', '#58c8ff', 'nle'],
        [-5.35, 'PGM · ON AIR', 'SMPTE COLOR BARS', '#ffd048', 'bars']
      ].forEach(([mz, title, sub, hex, kind], i) => {
        model('sf_crt_tv', cxM + .25, 1.07, mz, -Math.PI / 2, { s: .82 });
        add(mDarkMetal, .36, .34, .42, cxM + .25, 1.07, mz);
        plane(cur.interior, makeScreenTex(kind, title, sub, hex), .34, .26, cxM + .035, 1.24, mz, -Math.PI / 2);
        const tl = add(i === 0 || i === 3 ? mTallyRed : mLedGreen, .02, .025, .08, cxM + .04, 1.42, mz);
        if (i === 0) animState.tallyMats.push(tl.material);
      });
      // 콘솔 좌우 니어필드 스튜디오 모니터 스피커 (h133/BRO-001)
      model('h133/BRO-001', cxM + .24, 1.07, -8.52, -Math.PI / 2);
      model('h133/BRO-001', cxM + .24, 1.07, -4.98, -Math.PI / 2);

      // (03) SD 아날로그 비디오 스위처 (PGM/PST 일루미네이션 버튼 행렬 & T-Bar 페이더 바)
      const swZ = -7.55;
      add(mDarkMetal, .44, .06, .74, cxM - .18, .79, swZ);
      for (let r = 0; r < 3; r++) {
        for (let b = 0; b < 8; b++) {
          const bm = r === 0 ? mTallyRed : r === 1 ? mLedAmber : mLedGreen;
          add(bm, .028, .018, .042, cxM - .30 + r * .08, .852, swZ - .28 + b * .065);
        }
      }
      // 애니메이션 가능한 T-Bar 레버
      const tBarGrp = new THREE.Group();
      tBarGrp.position.set(cxM - .14, .855, swZ + .26);
      tBarGrp.add(
        new THREE.Mesh(bx(.02, .09, .016, 0, .045, 0), mChrome),
        new THREE.Mesh(bx(.035, .024, .09, 0, .09, 0), mBlack)
      );
      animRoot.add(tBarGrp);
      animState.tBar = tBarGrp;

      // (05) 24채널 아날로그 오디오 믹서 (h133/BRO-004 2연장 + VU 레벨 미터 브리지)
      model('h133/BRO-004', cxM - .16, .795, -6.45, -Math.PI / 2);
      model('h133/BRO-004', cxM - .16, .795, -5.65, -Math.PI / 2);
      add(mDarkMetal, .12, .16, 1.48, cxM + .02, .88, -6.05);
      for (let v = 0; v < 12; v++) {
        const vb = new THREE.Mesh(bx(.012, .09, .06, 0, .045, 0), v % 3 === 0 ? mLedAmber : mLedGreen);
        vb.position.set(cxM - .045, .90, -6.70 + v * .118);
        animRoot.add(vb);
        animState.vuBars.push(vb);
      }
      // 구즈넥 토크백 마이크(BRO-003) & 모니터링 헤드폰(BRO-007)
      model('h133/BRO-003', cxM - .22, .795, -8.25, -Math.PI / 2, { s: .55 });
      model('h133/BRO-007', cxM - .24, .74, -5.12, -Math.PI / 2, { s: .72 });
      swivelChair08(cxM - .88, -7.35, Math.PI / 2, '방송편집실');
      swivelChair08(cxM - .88, -5.85, Math.PI / 2, '방송편집실');
    }

    // ── [3] 동편 구역 (x: -28.0 ~ -20.15): 레코딩 스튜디오 & 오픈형 19인치 장비랙 (04, 06, 07, 08번 도면 완벽 구현!) ──
    // ★ 블록 처리되어 있던 구 장비실 콘크리트 가벽을 완전 철거하고, 08번 도면의 오픈형 19인치 VTR/네트워크/전관방송 장비랙 3기를 개방 배치!
    {
      const rackXs = [-23.15, -22.35, -21.55], rz = -9.12;
      rackXs.forEach((rx, ri) => {
        // 19인치 오픈 프레임 랙 기둥 4주 & 상·하단 베이스
        meshAt(merge([
          bx(.64, .06, .58, 0, .03, 0),
          bx(.64, .05, .58, 0, 2.04, 0),
          bx(.045, 2.04, .045, -.29, 1.02, -.26),
          bx(.045, 2.04, .045,  .29, 1.02, -.26),
          bx(.045, 2.04, .045, -.29, 1.02,  .26),
          bx(.045, 2.04, .045,  .29, 1.02,  .26)
        ]), mDarkMetal, rx, 0, rz);
        // 랙 내부 장착 3D 앰프/VTR 유닛 (h133/BRO-002 & BRO-005)
        model(ri % 2 === 0 ? 'h133/BRO-002' : 'h133/BRO-005', rx, .18, rz, 0);
        model(ri % 2 === 0 ? 'h133/BRO-005' : 'h133/BRO-002', rx, .62, rz, 0);
        // 상단 VTR 데크 & 10/100Mbps 네트워크 스위치 & BNC/Cat5e 패치패널 & 학급별 스피커 셀렉터
        add(mBlack, .56, .82, .48, rx, 1.06, rz);
        plane(cur.interior, B.racks[ri % 3], .54, .78, rx, 1.47, rz + .245);
        plane(cur.interior, ri === 1 ? mLedBlue : mLedGreen, .22, .032, rx - .10, 1.82, rz + .248);
        plane(cur.interior, mTallyRed, .12, .028, rx + .14, 1.64, rz + .248);
        // 랙 상단 회전 릴/테이프 스풀 애니메이션
        if (ri === 0 || ri === 2) {
          [-0.13, 0.13].forEach((ox, si) => {
            const sp = new THREE.Mesh(
              merge([
                new THREE.CylinderGeometry(.075, .075, .016, 18).rotateX(Math.PI / 2),
                bx(.13, .012, .02, 0, 0, 0),
                bx(.012, .13, .02, 0, 0, 0)
              ]),
              mChrome
            );
            sp.position.set(rx + ox, 1.94, rz + .255);
            animRoot.add(sp);
            animState.reels.push({ mesh: sp, dir: si === 0 ? 1 : -1 });
          });
        }
      });
      col(-23.52, -21.18, -9.48, -8.78);
      plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('19" VTR · PA 전관방송 · Cat5e 패치랙', '#12222c', '#98f4d8', 22) }), 1.85, .24, -22.35, 2.28, -8.82);

      // (08) 천장 케이블 트레이에서 19인치 랙과 주조정실로 내려오는 컬러 패치케이블(BNC 노랑 / Cat5e 파랑 / XLR 검정) 다발
      const cl = [];
      for (let k = 0; k < 9; k++) {
        const x = -23.35 + k * .25, y = .85 + (k % 3) * .35;
        cl.push([[[x, 3.22, -8.65], [x + .04, 2.15, -8.85], [x, y, -8.86], [x + .12, y - .22, -8.82]], k % 3]);
      }
      for (let k = 0; k < 4; k++) {
        const z = -8.2 + k * .75;
        cl.push([[[-29.25, 3.22, z], [-29.05, 2.1, z], [-28.95, 1.05, z]], k % 3]);
      }
      cables(cl);
    }

    // (07) 크로마키 그린스크린 호리존(북서 스튜디오 배경, x = -25.65, z = -9.28) & 2인 앵커 뉴스 녹화테이블 (x = -25.65, z = -7.55)
    {
      const gx = -25.65, gz = -9.28, gw = 3.6, gh = 2.45;
      const gPlane = new THREE.PlaneGeometry(gw, gh, 18, 8), pos = gPlane.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 8) * .02 + Math.cos(pos.getY(i) * 4) * .01);
      gPlane.computeVertexNormals();
      meshAt(gPlane, B.green, gx, 1.32, gz);
      // 바닥으로 자연스럽게 이어지는 크로마키 호리존 매트
      plane(cur.interior, B.green, gw, 1.35, gx, .012, gz + .68, 0, -Math.PI / 2);
      // 그린스크린 알루미늄 스탠드 프레임
      meshAt(merge([
        bx(.04, 2.62, .04, gx - gw / 2, 1.31, gz - .03),
        bx(.04, 2.62, .04, gx + gw / 2, 1.31, gz - .03),
        bx(gw + .1, .04, .04, gx, 2.60, gz - .03),
        bx(.04, .03, .48, gx - gw / 2, .015, gz + .12),
        bx(.04, .03, .48, gx + gw / 2, .015, gz + .12)
      ]), mChrome, 0, 0, 0);

      // 2인 앵커 녹화 데스크 (x = -25.65, z = -7.55)
      const mx = -25.65, mz = -7.55;
      meshAt(merge([
        bx(2.10, .048, .78, 0, .74, 0),
        bx(2.02, .70, .04, 0, .36, .36),
        bx(.05, .72, .72, -.98, .36, 0),
        bx(.05, .72, .72,  .98, .36, 0)
      ]), mWood, mx, 0, mz);
      add(mAcousticCharcoal, 1.86, .52, .02, mx, .12, mz + .385);
      plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('MBS 서문고 교육방송국 · ON AIR', '#102034', '#e8f4ff', 22) }), 1.24, .32, mx, .42, mz + .40);
      col(mx - 1.05, mx + 1.05, mz - .40, mz + .40, false, .76);
      // 앵커석 유선 다이내믹 마이크 2기(BRO-003) & 헤드폰(BRO-007) & 대본 & 민아 녹음기(tape2) & 쪽지(n8)
      model('h133/BRO-003', mx - .48, .76, mz + .05, 0, { s: .52 });
      model('h133/BRO-003', mx + .48, .76, mz + .05, 0, { s: .52 });
      model('h133/BRO-007', mx - .78, .71, mz - .08, .35, { s: .65 });
      meshAt(new THREE.BoxGeometry(.24, .014, .32), mPaperN, mx - .45, .768, mz - .12, .08);
      meshAt(new THREE.BoxGeometry(.24, .014, .32), mPaperN, mx + .45, .768, mz - .12, -.08);
      tapeRecorder('tape2', mx + .02, .765, mz + .08, -.2); tapeRecorder('ts_mina', mx + .84, .765, mz + .1, .25);
      addNote('n8', mx - .18, .765, mz - .15);
      swivelChair08(mx - .50, mz - .68, 0, '방송실');
      swivelChair08(mx + .50, mz - .68, 0, '방송실');
      // 메인 스토리 방송 송출 상호작용 지점 (기존 좌표 x: -25.1, z: -7.0 완벽 유지!)
      props.push({ kind: 'console', floor: cur.f, x: -25.1, z: -7.0, label: '방송 장비 사용' });
    }

    // (04) SD MiniDV/DVCAM 캠코더 & 유압 삼각대 2기 (x = -26.35, -24.65, z = -4.85 — 앵커 녹화석 정면 조준!)
    const buildDVCamcorderTripod = (x, z, yaw, camLabel) => {
      const h = 1.36;
      const legs = [0, 1, 2].map(k => tube(.014, x, h - .12, z, x + Math.cos(k * 2.094 + .5) * .42, 0, z + Math.sin(k * 2.094 + .5) * .42));
      const spreader = [0, 1, 2].map(k => tube(.008, x, .45, z, x + Math.cos(k * 2.094 + .5) * .28, .45, z + Math.sin(k * 2.094 + .5) * .28));
      meshAt(merge([...legs, ...spreader, tube(.020, x, h - .25, z, x, h + .04, z)]), mDarkMetal, 0, 0, 0);
      const cg = new THREE.Group(); cg.position.set(x, h + .08, z); cg.rotation.y = yaw; cur.interior.add(cg);
      // 2008년식 DVCAM 바디 + 사각 매트박스 렌즈후드 + 상단 샷건마이크 + 팬 핸들 + 플립아웃 4:3 LCD 뷰파인더
      cg.add(new THREE.Mesh(merge([
        bx(.16, .16, .32, 0, 0, 0),
        bx(.18, .14, .08, 0, 0, -.20),
        bx(.05, .06, .22, 0, .11, -.02),
        new THREE.CylinderGeometry(.016, .016, .20, 10).rotateX(Math.PI / 2).translate(0, .14, -.10),
        tube(.009, .06, -.04, .12, .16, -.18, .32)
      ]), mBlack));
      const lcd = new THREE.Mesh(bx(.13, .09, .014, -.14, .02, .04), mDarkMetal);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(.11, .072), makeScreenTex('wave', camLabel, 'DVCAM SP 48kHz', '#50ff98'));
      scr.position.set(-.14, .02, .049);
      const tally = new THREE.Mesh(bx(.03, .022, .022, 0, .15, -.14), mTallyRed);
      cg.add(lcd, scr, tally);
      col(x - .34, x + .34, z - .34, z + .34);
    };
    buildDVCamcorderTripod(-26.35, -4.85, -.08, 'CAM 1');
    buildDVCamcorderTripod(-24.65, -4.85,  .10, 'CAM 2');

    // (06) 텅스텐/할로겐 스튜디오 조명 스탠드(4엽 반도어 장착) 2기 & 천장 바튼 조명 그리드
    const buildHalogenStand = (x, z, yaw) => {
      const h = 1.82;
      const legs = [0, 1, 2].map(k => tube(.012, x, .38, z, x + Math.cos(k * 2.094) * .38, 0, z + Math.sin(k * 2.094) * .38));
      meshAt(merge([...legs, tube(.016, x, .15, z, x, h, z)]), mBlack, 0, 0, 0);
      const lg = new THREE.Group(); lg.position.set(x, h, z); lg.rotation.y = yaw; cur.interior.add(lg);
      lg.add(new THREE.Mesh(merge([
        bx(.26, .22, .24, 0, 0, 0),
        bx(.28, .08, .12, 0, .14, -.14),
        bx(.28, .08, .12, 0, -.14, -.14),
        bx(.08, .24, .12, -.16, 0, -.14),
        bx(.08, .24, .12,  .16, 0, -.14)
      ]), mDarkMetal));
      const bulb = new THREE.Mesh(new THREE.PlaneGeometry(.22, .18), mSpotLight);
      bulb.position.set(0, 0, -.122); bulb.rotation.y = Math.PI;
      lg.add(bulb);
      col(x - .32, x + .32, z - .32, z + .32);
    };
    buildHalogenStand(-27.15, -4.55, -.35);
    buildHalogenStand(-23.55, -4.55,  .35);

    // 천장 알루미늄 조명 바튼 파이프 그리드 & 할로겐 프레넬 스포트라이트 8기 & 천장형 냉난방기 2기
    [-7.9, -5.6, -3.4].forEach(tz => {
      add(mTruss, 13.8, .06, .06, -28.0, CH - .26, tz);
      [-33.2, -30.2, -26.2, -23.2].forEach(tx => {
        add(mTruss, .16, .22, .24, tx, CH - .46, tz);
        add(mSpotLight, .14, .14, .04, tx, CH - .46, tz - .13);
      });
    });
    [-32.0, -24.2].forEach(ax => add(S(null, { color: 0xeeece6, roughness: .36 }), .92, .06, .92, ax, CH - .06, -5.4));

    // 스튜디오 남동측: 오실로스코프 수신기 테이블(x = -20.55, z = -2.72) & 방송부원 사물함 & 장비 플라이트 케이스
    add(mDarkMetal, .62, .70, .68, -20.55, 0, -2.72, { col: true });
    meshAt(merge([bx(.45, 1.82, 1.24, 0, .91, 0)]), mLocker, E_EXT - .24, 0, -4.45);
    for (let i = 0; i < 4; i++) plane(cur.interior, mLockerT, .28, 1.72, E_EXT - .47, .91, -4.90 + i * .30, -Math.PI / 2);
    col(E_EXT - .48, E_EXT, -5.10, -3.80);
    addMedkit(-22.8, 0, -8.35);
    addBattery(-34.6, .76, -4.35);
    extinguisher(-27.55, -1.95);
    plane(cur.interior, B.poster, .55, .78, -26.6, 1.65, -1.79, Math.PI);
    plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('서문고등학교 교육방송국 (MBS) · 2008 방송편집실 & 레코딩 스튜디오', '#101c2e', '#f8e4a8', 21) }), 3.2, .52, -25.4, 2.38, -1.80, Math.PI);
    cctv(W_EXT + .12, CH, -2.0, Math.PI * .75, { label: '3F · 방송실' });


  }
  const MATLED = [new THREE.MeshBasicMaterial({ color: 0xff3030 }), new THREE.MeshBasicMaterial({ color: 0x30ff60 }), new THREE.MeshBasicMaterial({ color: 0xffc030 })];
  /* ---------- 지하층 B1 (B1 상세 소품 배치 시트 A01~A10) ----------
     시트의 방 좌표(u, v: 방 왼쪽 위 기준 m, v=0 이 안쪽 벽)를 우리 방(가로 8m × 깊이 7.85m, 문은 복도 쪽)으로 비례 변환해 배치한다. */
  const sheetRoom = (cx, W, D, south = false) => {
    const sx = 8 / W, sz = 7.85 / D;
    // 상자: 시트 (u, v, w, d) → 중심 · 크기
    return (u, v, w, d) => ({ x: cx - 4 + (u + w / 2) * sx, z: south ? 9.9 - (v + d / 2) * sz : -9.6 + (v + d / 2) * sz, w: w * sx, d: d * sz });
  };
  const mPanelG = grunge(S(T.makeCabinet(), { color: 0x9aa098, roughness: .55, metalness: .4 }));
  const mDarkMetal = S(null, { color: 0x34383a, roughness: .5, metalness: .6 });
  const mLegMetal = S(null, { color: 0x4a4e4c, roughness: .45, metalness: .5 });
  const mRedV = S(null, { color: 0x9a1a14, roughness: .5, metalness: .4 });
  const mBlueP = S(null, { color: 0x2a4a7a, roughness: .5, metalness: .4 });
  const mRubber = S(null, { color: 0x151515, roughness: .95 });
  const mCardboard = S(null, { color: 0x8a6a42, roughness: .95 });
  const mDrumB = S(null, { color: 0x2a4a6a, roughness: .5, metalness: .4 });
  const mBagB = S(null, { color: 0x111214, roughness: .35, metalness: .1 });
  const mTankG = grunge(S(T.makeMetal([96, 138, 132]), { roughness: .6, metalness: .45 }));
  // 사용자 제공 3D 소품 133종 팩(assets/models/h133): GLB 에 재질 · UV 가 없고 정점 색만 있어서, 부품 이름으로 게임의 PBR 재질을 고른다 (game.js loadModels 가 UV 를 만든다)
  const mBone = S(null, { color: 0xd8d0bc, roughness: .55 }), mGlassP = new THREE.MeshStandardMaterial({ color: 0xa8c4bc, transparent: true, opacity: .42, roughness: .06, metalness: .1, depthWrite: false });
  const mEnamel = S(null, { color: 0x24282c, roughness: .35, metalness: .3 }), mPoleW = grunge(S(T.makeMetal([196, 198, 192]), { roughness: .45, metalness: .35 })), mMatBlue = S(null, { color: 0x24406a, roughness: .9 }), mPaperW = S(null, { color: 0xe8e4d8, roughness: .9 });
  const mRope = S(null, { color: 0xb8b2a0, roughness: .95 });
  const H133_MAT = {
    'SCI-007': () => mBone,
    'SCI-005': n => /knob|turret|lens/i.test(n) ? mChrome : mEnamel,
    'SCI-006': () => mGlassP,
    'GYM-007': n => /spool/i.test(n) ? mChrome : mPoleW,
    'GYM-008': () => mMatBlue,
    'SAF-005': n => /bulb/i.test(n) ? new THREE.MeshStandardMaterial({ color: 0xc02818, emissive: 0x300400, transparent: true, opacity: .8, roughness: .1 }) : mChrome,
    'EXT-003': () => mDarkMetal,
    'EXT-004': n => /top/i.test(n) ? mWood : mRust,
    'WC-001': n => /faucet/i.test(n) ? mChrome : mPorc,
    'WC-002': n => /lid/i.test(n) ? mWhite : mPorc,
    'WC-003': n => /lid/i.test(n) ? mWhite : mPorc,
    'WC-004': n => /glass/i.test(n) ? mGlassP : mDarkMetal,
    'WC-005': n => /handle/i.test(n) ? mChrome : /glass/i.test(n) ? mGlassP : mWoodDark,
    'WC-006': n => /roll/i.test(n) ? mPaperW : mChrome,
    'WC-007': n => /head/i.test(n) ? mPaperW : mWoodDark,
    'WC-008': () => mChrome,
    'BSM-003': n => /valve/i.test(n) ? mRedV : mRust,
    'BSM-004': () => mRust,
    'BRO-001': n => /grille/i.test(n) ? mBlack : /woofer|tweeter/i.test(n) ? mChrome : mDarkMetal,
    'BRO-002': n => /knob/i.test(n) ? mChrome : /meter/i.test(n) ? mMatBlue : /front/i.test(n) ? mBlack : mDarkMetal,
    'BRO-003': n => /arm/i.test(n) ? mChrome : /head/i.test(n) ? mBlack : mDarkMetal,
    'BRO-004': n => /fader/i.test(n) ? mRedV : /knob/i.test(n) ? mChrome : mDarkMetal,
    'BRO-005': n => /knob/i.test(n) ? mChrome : /meter/i.test(n) ? mMatBlue : /front/i.test(n) ? mBlack : mDarkMetal,
    'BRO-006': n => /wood|top/i.test(n) ? mWood : /shelf/i.test(n) ? mWoodDark : mDarkMetal,
    'BRO-007': n => /band/i.test(n) ? mChrome : mBlack,
    'BRO-008': n => /dial/i.test(n) ? mPaperW : /hand|tick/i.test(n) ? mBlack : mDarkMetal,
  };
  const h133Mat = (id, part = '') => {
    if (H133_MAT[id]) return H133_MAT[id](part);
    if (/glass|lens/i.test(part)) return mGlassP;
    if (/wood|plywood|desk_top|shelf_board/i.test(part)) return mWood;
    if (/paper|card|page|label/i.test(part)) return mPaperW;
    if (/rubber|wheel|cable|black|screen/i.test(part)) return mRubber;
    if (/fabric|cloth|cushion|seat_pad/i.test(part)) return mMatBlue;
    if (/brass|copper/i.test(part)) return mChrome;
    return /rust/i.test(part) ? mRust : mMetal;
  };
  // 요리실 101 팩: GLB 재질 이름 → 게임 PBR 재질 (팩 GLB 에는 텍스처 · UV · 법선이 없다 — 로더가 법선 · 상자 투영 UV 를 만든다)
  // 헤어라인(브러시드) 스테인리스: 가로 결 + 얼룩 · 물때 · 드문 녹 점 (시트의 '조리대 · 곰솥' 재질)
  const brushed = (base, grime) => { const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
    g.fillStyle = `rgb(${base},${base + 3},${base + 5})`; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2200; i++) { const y = rnd() * 512, v = (rnd() - .5) * 26; g.strokeStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 255})`; g.lineWidth = .6 + rnd(); g.beginPath(); const x = rnd() * 512; g.moveTo(x, y); g.lineTo(x + 40 + rnd() * 220, y + (rnd() - .5) * 1.5); g.stroke(); }
    for (let i = 0; i < 26 * grime; i++) { const x = rnd() * 512, y = rnd() * 512, r = 14 + rnd() * 70, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(48,40,30,${.06 + rnd() * .1})`); gr.addColorStop(1, 'rgba(48,40,30,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 9 * grime; i++) { const x = rnd() * 512, y = rnd() * 512; g.fillStyle = `rgba(${120 + rnd() * 40},${60 + rnd() * 20},30,${.25 + rnd() * .35})`; g.beginPath(); g.ellipse(x, y, 1 + rnd() * 5, 1 + rnd() * 3, rnd() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 14 * grime; i++) { const x = rnd() * 512; g.strokeStyle = 'rgba(70,64,52,.12)'; g.lineWidth = 2 + rnd() * 6; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (rnd() - .5) * 8, 60 + rnd() * 200); g.stroke(); }   // 물때 흐른 자국
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const mStainless = new THREE.MeshStandardMaterial({ map: brushed(178, 1), roughness: .28, metalness: .85, normalMap: _paint.normalMap, normalScale: new THREE.Vector2(.15, .15) });
  const mStainlessD = new THREE.MeshStandardMaterial({ map: brushed(138, 3), roughness: .48, metalness: .72, normalMap: _paint.normalMap, normalScale: new THREE.Vector2(.25, .25) });
  const CR_MAT = { steel: mStainless, steel_dirty: mStainlessD, rust: mRust, black: mDarkMetal, wood_dark: mWoodDark, wood: mWood, green: mCork, paper: mPaperN,
    blue: S(null, { color: 0x2a5aa0, roughness: .4 }), red: S(null, { color: 0xa82a20, roughness: .4 }), light: new THREE.MeshBasicMaterial({ color: 0xe8f0ff }), glass: mGlass };
  const crMat = name => CR_MAT[name] || mStainlessD;
  // 학교 전체 V2 팩: 부품 이름의 재질 표기(darksteel · blue · steel · rust · brass)
  const mBrassV2 = S(null, { color: 0x9a7a3a, roughness: .35, metalness: .85 });
  const v2Mat = nm => { const s = (nm || '').toLowerCase(); return s.includes('darksteel') ? mDarkMetal : s.includes('blue') ? mBlueP : s.includes('brass') ? mBrassV2 : s.includes('rust') ? mRust : s.includes('steel') ? mStainlessD : mDarkMetal; };
  // 인쇄실 팩: 부품 이름 끝의 재질 표기 → 팩 1K PBR (BaseColor · NormalGL · Roughness · AO) 4종 + 단색 재질
  const PR_MAT = {}, prTex = new THREE.TextureLoader();
  const prPBR = (fam, met, rough) => PR_MAT[fam] || (PR_MAT[fam] = (() => { const L = k => loadSurfaceTexture(prTex,`assets/models/pr/tex/${fam}/${k}.webp`,k);
    return new THREE.MeshStandardMaterial({ map: L('BaseColor'), normalMap: L('NormalGL'), roughnessMap: L('Roughness'), aoMap: L('AO'), roughness: rough, metalness: met }); })());
  const mPrRubber = S(null, { color: 0x1a1a1c, roughness: .85 }), mPrBlue = new THREE.MeshStandardMaterial({ color: 0x3a6aa8, emissive: 0x0a1830, roughness: .3 });
  const mPrLed = { red: new THREE.MeshBasicMaterial({ color: 0xd02018 }), green: new THREE.MeshBasicMaterial({ color: 0x30a048 }), yellow: S(null, { color: 0xd8b030, roughness: .5 }) };
  const prMat = nm => { const s = (nm || '').toLowerCase();
    if (s.includes('paper')) return prPBR('aged_ream_paper', 0, .95);
    if (s.includes('ivory') || s.includes('aged_white')) { const m = prPBR('copier_ivory', 0, .75); if (!m.userData.tinted) { m.userData.tinted = true; m.map = detailMap; m.color.set(0xcfc7b0); m.normalScale.set(.35, .35); } return m; }   // 팩 BaseColor 가 화강암처럼 얼룩덜룩 — 누렇게 바랜 플라스틱색 + 팩 노멀 · 거칠기 · AO
    if (s.includes('wood')) return prPBR('aged_wood_counter', 0, .8);
    if (s.includes('stainless')) return mStainlessD;
    if (s.includes('glass')) return mGlass;
    if (s.includes('steel') || s.includes('rust')) return prPBR('painted_rust_steel', .55, .7);
    if (s.includes('blue')) return mPrBlue;
    for (const k of ['red', 'green', 'yellow']) if (s.endsWith(k)) return mPrLed[k];
    return mPrRubber; };
  // 기술·가정실 102 팩: GLB 재질 PBR_<이름> → 팩의 공유 PBR 텍스처 (BaseColor · Normal(OpenGL) · Roughness 512px)
  const TH_MAT = {}, thTex = new THREE.TextureLoader();
  const TH_PROPS = { stainless: [.85, .3], painted_steel: [.45, .5], dark_metal: [.7, .45], copper: [.9, .35], rust: [.3, .9], blue_glass: [.1, .08] };
  const thMat = raw => { const n = (raw || '').replace(/^PBR_/, ''); if (TH_MAT[n]) return TH_MAT[n];
    const L = k => loadSurfaceTexture(thTex,`assets/models/th102/tex/${n}_${k}.webp`,k);
    const [met, rough] = TH_PROPS[n] || [0, 1];
    const m = new THREE.MeshStandardMaterial({ map: L('BaseColor'), normalMap: L('Normal'), roughnessMap: L('Roughness'), roughness: Math.max(.14, rough), metalness: met, normalScale: new THREE.Vector2(.7, .7) });
    if (n === 'blue_glass') { m.transparent = true; m.opacity = .4; m.depthWrite = false; }
    if (n === 'old_wood' || n === 'wood_edge') m.color.setRGB(.72, .62, .52);   // 팩 목재 텍스처가 너무 주황 — 오래된 실습대 색으로 낮춤
    return TH_MAT[n] = m; };
  const valveWheel = (x, y, z, ry = 0, r = .16) => { const w = new THREE.Mesh(merge([new THREE.TorusGeometry(r, .02, 6, 18), bx(r * 2, .025, .025, 0, 0, 0), bx(.025, r * 2, .025, 0, 0, 0)]), mRedV); w.position.set(x, y, z); w.rotation.y = ry; cur.interior.add(w); return w; };
  const gauge = (x, y, z, ry = 0) => { const g = meshAt(new THREE.CylinderGeometry(.1, .1, .05, 16).rotateX(Math.PI / 2), mChrome, x, y, z, ry); const f = new THREE.Mesh(new THREE.CircleGeometry(.085, 16), mWhite); f.position.z = .027; g.add(f); const n = new THREE.Mesh(new THREE.BoxGeometry(.01, .07, .003), mRedV); n.position.set(.015, .01, .03); n.rotation.z = -.7; g.add(n); return g; };
  const wetSpot = (x, z, r) => { const p = new THREE.Mesh(new THREE.CircleGeometry(r, 18), new THREE.MeshStandardMaterial({ color: 0x141c1e, roughness: .04, metalness: .2, transparent: true, opacity: .6, depthWrite: false })); p.rotation.x = -Math.PI / 2; p.position.set(x, .018, z); p.scale.y = .7; cur.interior.add(p); };
  // 판넬 벽(분전반 · UPS): 정면 방향 ry 로 길게 늘어선 캐비닛 줄
  function cabinetRow(x, z, len, ry, h = 2.0, dep = .55, mat = mPanelG) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; cur.interior.add(g);
    const n = Math.max(1, Math.round(len / .8)), w = len / n;
    for (let k = 0; k < n; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(w - .02, h, dep), mat); c.position.set(-len / 2 + w * (k + .5), h / 2, 0); g.add(c);
      const h2 = new THREE.Mesh(new THREE.BoxGeometry(.03, .14, .03), mChrome); h2.position.set(-len / 2 + w * (k + .5) + w * .32, h * .55, dep / 2 + .02); g.add(h2);
      if (k % 2 === 0) { const ws = new THREE.Mesh(new THREE.PlaneGeometry(.3, .18), mWarnS); ws.position.set(-len / 2 + w * (k + .5), h * .8, dep / 2 + .005); g.add(ws); } }
    return g;
  }
  // 철제 선반 (상자 · 통 적재) — 길이 len 을 ry 방향으로
  function rackShelf(x, z, len, ry, dep = .7, h = 2.1, fill = .7) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; cur.interior.add(g);
    const parts = []; [-len / 2, len / 2].forEach(px => [-dep / 2, dep / 2].forEach(pz => parts.push(bx(.05, h, .05, px, h / 2, pz))));
    for (let r = 0; r < 4; r++) parts.push(bx(len, .03, dep, 0, .15 + r * .62, 0));
    g.add(new THREE.Mesh(merge(parts), mMetal));
    for (let r = 0; r < 4; r++) for (let px = -len / 2 + .3; px < len / 2 - .2; px += rr(.4, .6)) { if (rnd() > fill) continue;
      const bw = rr(.3, .5), bh = rr(.2, .42), m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, dep * rr(.6, .9)), pick([mCardboard, mCardboard, mDrumB, mDarkMetal])); m.position.set(px, .165 + r * .62 + bh / 2, 0); m.rotation.y = rr(-.1, .1); g.add(m); }
    return g;
  }
  // B1 공용 (참고 리모델링 시트): 색 배관 다발 · 바닥 배수로 그레이팅 · 노란 안전선 · 콘크리트 받침
  const b1M = {}; const b1m = (k, c, r = .6, m = .3) => b1M[k] || (b1M[k] = S(null, { color: c, roughness: r, metalness: m }));
  function b1Pipes(list, mat) { const g = list.map(a => tube(...a)); if (g.length) meshAt(merge(g), mat, 0, 0, 0); }
  function b1Trench(x1, x2, z1, z2) { flat(cur.interior, S(null, { color: 0x0e1214, roughness: .2, metalness: .3 }), x1, x2, z1, z2, .008, 1); const alongX = x2 - x1 > z2 - z1, bars = [];
    if (alongX) for (let x = x1 + .06; x < x2; x += .09) bars.push(bx(.025, .02, z2 - z1, x, .02, (z1 + z2) / 2)); else for (let z = z1 + .06; z < z2; z += .09) bars.push(bx(x2 - x1, .02, .025, (x1 + x2) / 2, .02, z));
    meshAt(merge(bars), mDarkMetal, 0, 0, 0); }
  function b1Line(x1, x2, z1, z2) { const y = b1m('yl', 0xd8b020, .7, 0), w = .06; [[x1, x2, z1, z1 + w], [x1, x2, z2 - w, z2], [x1, x1 + w, z1, z2], [x2 - w, x2, z1, z2]].forEach(([a, b, c, d]) => add(y, b - a, .004, d - c, (a + b) / 2, .006, (c + d) / 2)); }
  function b1Plinth(x1, x2, z1, z2, h = .15) { add(b1m('conc', 0x6e6c66, .95, 0), x2 - x1, h, z2 - z1, (x1 + x2) / 2, 0, (z1 + z2) / 2, { col: true }); }
  // 수직 다단 펌프 (주펌프 유닛용): 모터 + 몸체 + 플랜지
  function vPump(x, z, y, mat) { meshAt(merge([new THREE.CylinderGeometry(.16, .16, .9, 14).translate(0, .45, 0), new THREE.CylinderGeometry(.2, .2, .45, 14).translate(0, 1.12, 0), new THREE.CylinderGeometry(.12, .12, .1, 12).translate(0, 1.4, 0), bx(.5, .06, .5, 0, .03, 0)]), mat, x, y, z); }
  // 가로형 순환 펌프 (모터 + 볼류트 + 받침)
  function hPump(x, z, ry, mat) { meshAt(merge([bx(.42, .12, .8, 0, .06, 0), new THREE.CylinderGeometry(.17, .17, .42, 14).rotateX(Math.PI / 2).translate(0, .38, -.12), new THREE.SphereGeometry(.2, 12, 10).translate(0, .4, .24), new THREE.CylinderGeometry(.07, .07, .35, 10).translate(0, .62, .24)]), mat, x, 0, z, ry); col(x - .25, x + .25, z - .42, z + .42, false, .75); }
  // A06 보일러실 (참고 시트 7.70 × 7.85m): 노통연관 보일러 2대 (1800×3200×2200, 남쪽 버너) · 순환펌프 4 · 팽창탱크 · 급수탱크 · 제어반 2 · 색 배관 (급수 · 온수 · 가스 · 배기) · 바닥 배수로
  function boiler(cx) {
    const navy = b1m('navy', 0x23344e, .5, .4), red = b1m('burner', 0xb81e1e, .45, .3), teal = b1m('teal', 0x1f6f68, .45, .4), yel = b1m('gasY', 0xd0a820, .55, .3), silver = b1m('silv', 0xb8bcc0, .35, .75);
    const N = -9.6, bz = -7.15, bd = 3.5;
    [cx - 1.45, cx + 1.6].forEach((x, i) => {
      const b = { x, z: bz, w: 1.8, d: bd }; if (!i) { B_BOIL.b = b; B_BOIL.cx = cx; } else B_BOIL.b2 = b;
      keepB(meshAt(merge([new THREE.CylinderGeometry(.95, .95, 3.2, 24).rotateX(Math.PI / 2).translate(0, 1.2, 0), ...[-1.2, -.4, .4, 1.2].map(k => new THREE.TorusGeometry(.97, .03, 6, 24).translate(0, 1.2, k))]), navy, x, 0, bz));
      keepB(meshAt(merge([bx(.62, .7, .55, 0, .95, 0), new THREE.CylinderGeometry(.14, .14, .4, 12).rotateX(Math.PI / 2).translate(0, .95, .45)]), red, x, 0, bz + 1.85));   // 버너
      b1Plinth(x - 1.0, x + 1.0, bz - 1.75, bz + 1.75, .12); b1Line(x - 1.25, x + 1.25, bz - 1.9, bz + 2.45);
      gauge(x + .5, 1.9, bz + 1.62, 0); gauge(x - .5, 1.95, bz + 1.62, 0);
      col(x - .98, x + .98, bz - 1.75, bz + 2.2);
      b1Pipes([[.2, x, 2.15, bz - 1.2, x, CH, bz - 1.2]], silver);   // 배기 연도 → 천장
    });
    b1Pipes([[.2, cx - 1.45, CH - .25, bz - 1.2, cx + 3.6, CH - .25, bz - 1.2]], silver);
    // 순환 펌프 4 (서쪽 벽, 2조) + 급수 탱크 (Ø1000 × 2000) + 소형 제어반
    [-5.4, -4.5, -3.7].forEach((z, k) => hPump(cx - 3.3, z, Math.PI / 2, teal));
    cyl(silver, .5, 1.9, cx - 3.2, 0, -8.9, 20); meshAt(new THREE.SphereGeometry(.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), silver, cx - 3.2, 1.9, -8.9); col(cx - 3.75, cx - 2.65, -9.45, -8.35);
    cabinetRow(cx - 3.55, -7.4, .8, Math.PI / 2, 2.0, .6); col(cx - 3.85, cx - 3.25, -7.8, -7.0);
    // 팽창탱크 (Ø800 × 1600, 빨강) · 동쪽 벽 제어반 2 · 수처리 배관
    cyl(red, .4, 1.4, cx + 3.25, 0, -8.95, 20); meshAt(new THREE.SphereGeometry(.4, 16, 8), red, cx + 3.25, 1.4, -8.95); col(cx + 2.8, cx + 3.7, -9.4, -8.5);
    cabinetRow(cx + 3.5, -5.6, 1.6, -Math.PI / 2, 2.0, .6); col(cx + 3.2, cx + 3.85, -6.4, -4.8);
    // 배관: 급수(파랑) · 온수/난방(빨강) · 가스(노랑) — 북벽 · 서벽 수직 + 천장 아래 수평
    const P = (dx, r) => [r, cx + dx, 0, N + .2, cx + dx, CH, N + .2];
    b1Pipes([P(-.1, .07), P(2.9, .06), [.06, cx - 3.7, 2.9, -9.0, cx - 3.7, 2.9, -3.4], [.07, cx - 3.6, CH - .5, N + .25, cx + 3.6, CH - .5, N + .25], [.05, cx - 3.3, .55, -5.4, cx - 3.6, .55, -5.4]], mBlueP);
    b1Pipes([P(.1, .08), P(-2.6, .07), [.08, cx - 3.5, CH - .7, N + .35, cx + 3.6, CH - .7, N + .35], [.07, cx - 1.45, 1.8, bz - 1.6, cx - 1.45, CH - .7, N + .35], [.07, cx + 1.6, 1.8, bz - 1.6, cx + 1.6, CH - .7, N + .35], [.06, cx + 3.7, .4, -8.4, cx + 3.7, CH, -8.4]], mRedV);
    b1Pipes([[.035, cx - 2.3, 0, N + .2, cx - 2.3, 2.6, N + .2], [.035, cx - 2.3, 2.6, N + .2, cx + 1.6, 2.6, N + .2], [.035, cx + 1.6, 2.6, N + .2, cx + 1.6, .95, bz + 1.6]], yel);
    [[cx - .1, 1.2], [cx + .1, 1.0], [cx + 2.9, 1.3]].forEach(([x, y]) => valveWheel(x, y, N + .32, 0, .12));
    b1Trench(cx - 3.7, cx + 3.7, -3.15, -2.85);
    // 점검표 탁자 (+ 쪽지) · 누수 지점 · 배터리
    tbl(mWood, .7, .75, .5, cx + 3.3, 0, -2.35, { col: true, legMat: mLegMetal }); addNote('n11', cx + 3.3, .77, -2.35);
    wetSpot(cx - 2.4, -3.5, .7); blood('drag', cx - 2.2, .02, -3.6, 1.0, 1.4, true);
    addBattery(cx - 3.0, 0, -2.5); papers(cx, -8, -2.4, 6);
  }
  // A04 유지보수실 · 전기실 (참고 시트 7.70 × 7.85m): 북벽 철제 작업대 (1800×750×850) + 공구 타공판 · 예비 부품함 · 동벽 분전반/제어반 3 (1200×400×1900, 주 차단기) · 서벽 철제 선반 · 사다리 보관 · 공구 보관장 (락커) · 이동 공구 카트 · 작업 스툴 · 소화기함
  function electric(cx) {
    const W = cx - 3.85, E = cx + 3.85, N = -9.6, green = b1m('mGreen', 0x3a5a3e, .55, .35), red = b1m('cartR', 0xb02020, .45, .4);
    // 북벽: 작업대 + 타공판 (공구) · 예비 부품 서랍장
    { const x = W + 1.3; meshAt(merge([bx(1.8, .05, .75, 0, .85, 0), bx(.45, .8, .7, -.65, .4, 0), bx(.05, .8, .7, .87, .4, 0), bx(1.7, .03, .6, 0, .2, 0)]), green, x, 0, N + .42); add(mWood, 1.8, .02, .75, x, .875, N + .42); col(x - .9, x + .9, N, N + .8);
      add(b1m('peg', 0xc8a878, .8, 0), 1.8, .9, .02, x, 1.1, N + .02); for (let k = 0; k < 14; k++) add(k % 3 ? mChrome : red, .03, .2 + (k % 4) * .04, .03, x - .8 + k * .12, 1.3 + (k % 2) * .3, N + .05);
      cyl(mBlack, .17, .45, x + .2, 0, N + 1.1, 14); }
    { const x = cx + 2.1; add(mDarkMetal, .9, .88, .3, x, 0, N + .15, { col: true }); for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) add(k % 2 ? b1m('binB', 0x2a4a8a, .6, 0) : b1m('binY', 0xc8a020, .6, 0), .13, .17, .02, x - .37 + k * .15, .06 + r * .21, N + .31); }
    // 동벽: 분전반/제어반 3 + 주 차단기 (가운데 판넬 정면) + 절연 매트
    cabinetRow(E - .2, -6.0, 3.6, -Math.PI / 2, 1.9, .4); col(E - .4, E, -7.8, -4.2);
    for (let k = 0; k < 3; k++) glowAt(E - .42, 1.55, -7.2 + k * 1.2, .15, k === 1 ? glowRed : glowGreen);
    add(mRubber, 1.0, .015, 3.4, E - .95, 0, -6.0);
    meshAt(merge([bx(.12, 1.0, .8, 0, 1.4, 0), bx(.04, .9, .7, -.07, 1.4, 0)]), S(T.makeMetal([110, 116, 112]), { roughness: .6, metalness: .4 }), E - .46, 0, -6.0);
    plane(cur.interior, mWarnS, .45, .28, E - .53, 2.05, -6.0, -Math.PI / 2);
    { const pv = new THREE.Group(); pv.position.set(E - .58, 1.4, -6.0); pv.rotation.y = Math.PI; cur.interior.add(pv); const lev = dyn(new THREE.Group()); pv.add(lev);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.04, .32, .05), mBlack); arm.position.y = .16; lev.add(arm);
      const knob = new THREE.Mesh(new THREE.BoxGeometry(.12, .05, .05), S(null, { color: 0xb02020 })); knob.position.y = .32; lev.add(knob); lev.rotation.z = -2.4;
      props.push({ kind: 'breaker', floor: cur.f, x: E - 1.3, z: -6.0, lev, on: false, label: '주 차단기 올리기' }); }
    // 서벽: 철제 선반 2 (1200×450×1800) · 사다리 보관 · 공구 보관장 (락커 900×515×1790 × 2)
    rackShelf(W + .25, -8.4, 2.4, Math.PI / 2, .45, 1.8, .8); col(W, W + .5, -9.6, -7.2);
    [0, 1].forEach(k => { const L = [tube(.02, -.25, 0, 0, -.25, 1.8, -.25), tube(.02, .25, 0, 0, .25, 1.8, -.25)]; for (let s = 1; s < 6; s++) L.push(tube(.014, -.25, s * .3, -s * .3 * .14, .25, s * .3, -s * .3 * .14)); meshAt(merge(L), mChrome, W + .2 + k * .12, 0, -6.4 + k * .5, Math.PI / 2); });
    col(W, W + .5, -6.8, -5.5);
    cabinetRow(W + .27, -3.7, 1.8, Math.PI / 2, 1.79, .515, green); col(W, W + .55, -4.6, -2.8);
    // 이동 공구 카트 (700×450×850) · 공구 가방 + 전기 기사 증언 테이프 · 구급함 · 소화기함
    { const x = cx + .4, z = -5.4; add(red, .7, .75, .45, x, .1, z); for (let k = 0; k < 4; k++) add(mChrome, .6, .015, .02, x, .25 + k * .15, z + .23); [[-.3, -.18], [.3, -.18], [-.3, .18], [.3, .18]].forEach(([a, b]) => cyl(mBlack, .05, .1, x + a, 0, z + b, 10)); col(x - .35, x + .35, z - .23, z + .23); }
    { const x = cx + 2.0, z = -3.2; tapeRecorder('ts_electric', x - .45, 0, z - .2, .4);
      meshAt(merge([bx(.5, .26, .25, 0, .13, 0), tube(.012, -.15, .26, 0, -.1, .38, 0), tube(.012, .15, .26, 0, .1, .38, 0), tube(.012, -.1, .38, 0, .1, .38, 0)]), mBagB, x, 0, z, .3); addMedkit(x + .45, 0, z); }
    add(b1m('fireBox', 0xb81e1e, .5, .2), .25, .6, .2, E - .15, .9, -2.3);
    papers(cx, -8, -2.4, 4);
  }
  // A02 지하 창고 (참고 시트 7.70 × 7.85m): 벽면 경량 선반 (900×450×1800) ㄷ자 · 철제 수납장 4 · 이동식 칠판 · 적재 책걸상 · 접이식 의자 · 접이식 테이블 · 사다리 · 라바콘 · 청소기 — 가운데는 비운다
  function storage(cx) {
    const W = cx - 3.85, E = cx + 3.85, N = -9.6;
    rackShelf(W + .25, -6.2, 6.0, Math.PI / 2, .45, 1.8, .85); col(W, W + .5, -9.2, -3.2);   // 서쪽 벽
    rackShelf(E - .25, -6.9, 4.6, Math.PI / 2, .45, 1.8, .85); col(E - .5, E, -9.2, -4.6);   // 동쪽 벽
    rackShelf(W + 1.2, N + .25, 1.8, 0, .45, 1.8, .8); col(W + .3, W + 2.1, N, N + .5);   // 북쪽 서측 선반
    cabinetRow(cx + .3, N + .25, 3.4, 0, 1.8, .45, b1m('locker', 0x8a8e90, .55, .4)); col(cx - 1.4, cx + 2.0, N, N + .5);   // 철제 수납장 4
    { const x = E - 1.2, z = N + .5; add(b1m('chalk', 0x1f3d2c, .8, 0), 1.8, 1.2, .04, x - .25, .7, z); add(mWood, 1.86, .05, .07, x - .25, .66, z); [-1.1, .6].forEach(d => add(mLegMetal, .04, 1.9, .04, x + d, 0, z)); col(x - 1.2, x + .7, z - .15, z + .15); }   // 이동식 칠판
    // 적재 책걸상 (동쪽 남측) · 접이식 의자 묶음 · 접이식 테이블 세움
    for (let s = 0; s < 2; s++) { const x = E - .45, z = -4.0 + s * .7; for (let k = 0; k < 3; k++) { add(mWood, .65, .03, .45, x, .72 + k * .06 - .06 * (k > 0), z); } add(mLegMetal, .6, .7, .4, x, 0, z); col(x - .35, x + .35, z - .25, z + .25); }
    for (let k = 0; k < 8; k++) add(b1m('fchair', 0x4a4e52, .5, .5), .44, .82, .03, E - .9 - .015 * k, 0, -2.4 - k * .045, { rz: .12 });
    col(E - 1.15, E - .7, -2.75, -2.25);
    for (let k = 0; k < 3; k++) add(b1m('ftbl', 0xd8d0b8, .7, 0), .04, .74, 1.8, W + .6 + k * .05, 0, -2.5, { rz: -.05 });
    // 사다리 (서쪽 선반에 기대) · 라바콘 2 · 업소용 청소기
    { const L = [tube(.02, -.2, 0, 0, -.2, 2.2, -.35), tube(.02, .2, 0, 0, .2, 2.2, -.35)]; for (let k = 1; k < 7; k++) L.push(tube(.015, -.2, k * .3, -k * .3 * .16, .2, k * .3, -k * .3 * .16)); meshAt(merge(L), mChrome, W + .75, 0, -7.5, Math.PI / 2); }
    [[W + 1.2, -2.3], [W + 1.6, -2.1]].forEach(([x, z]) => { meshAt(merge([new THREE.ConeGeometry(.15, .7, 12).translate(0, .35, 0), bx(.36, .03, .36, 0, .015, 0)]), b1m('cone', 0xe85010, .6, 0), x, 0, z); });
    cyl(mChrome, .2, .45, E - 1.0, 0, -3.3, 14);
    // 상자 위 배터리 (기존 단서)
    add(mCardboard, .5, .45, .45, W + 1.0, 0, -3.0, { col: true }); addBattery(W + 1.0, .45, -3.0);
    papers(cx, -8, -2.4, 7);
  }
  // A08 문서 보관실 (참고 시트 7.70 × 7.85m): 벽면 철제 문서 서가 ㄷ자 · 중앙 양면 서가 3열 (남북 방향) · 작업 테이블 (1800×750) + 접이식 의자 · 철제 / 파일 캐비닛 · 문서 운반 카트 · 이동 사다리 · 제습기
  function records(cx) {
    const W = cx - 3.85, E = cx + 3.85, N = -9.6;
    shelf3D(cx, N + .25, 0, 7.2, 1.8, .45, 6, .85); col(W, E, N, N + .5);   // 북쪽 벽 서가
    shelf3D(W + .25, -7.1, Math.PI / 2, 3.6, 1.8, .45, 6, .85); col(W, W + .5, -8.9, -5.3);   // 서쪽 벽 서가
    shelf3D(E - .25, -7.1, -Math.PI / 2, 3.6, 1.8, .45, 6, .85); col(E - .5, E, -8.9, -5.3);   // 동쪽 벽 서가
    [cx - 1.4, cx + .2, cx + 1.8].forEach(x => { shelf3D(x - .22, -6.8, -Math.PI / 2, 3.0, 1.8, .44, 6, .85); shelf3D(x + .22, -6.8, Math.PI / 2, 3.0, 1.8, .44, 6, .85); col(x - .45, x + .45, -8.3, -5.3); });   // 중앙 양면 서가
    // 작업 테이블 (서쪽 벽 남측) + 접이식 의자 + 스탠드 · 기존 단서 (쪽지 · 증언 테이프)
    { const x = W + .45, z = -3.7; tbl(mWood, .75, .74, 1.8, x, 0, z, { col: true, legMat: mLegMetal }); deskChair(x + .75, z - .2, Math.PI / 2);
      meshAt(merge([new THREE.CylinderGeometry(.08, .1, .03, 12).translate(0, .015, 0), tube(.01, 0, 0, 0, .08, .35, 0), new THREE.ConeGeometry(.1, .12, 12, 1, true).translate(.1, .32, 0)]), mDarkMetal, x - .2, .74, z - .75);
      addNote('n12', x, .76, z - .4); tapeRecorder('tape3', x + .05, .76, z + .05, .2); tapeRecorder('ts_junho', x + .05, .76, z + .45, -.2); tapeRecorder('ts_reporter2', x + .05, .76, z + .8, .3); }
    // 동쪽 남측: 철제 캐비닛 · 파일 캐비닛 2 (잠긴 서랍) · 제습기
    cabinetRow(E - .25, -4.6, .9, -Math.PI / 2, 1.8, .45, b1m('locker', 0x8a8e90, .55, .4)); col(E - .5, E, -5.05, -4.15);
    fileCabinet(E - .3, -3.75, -Math.PI / 2); fileCabinet(E - .3, -3.15, -Math.PI / 2); meshAt(new THREE.TorusGeometry(.04, .012, 6, 12), mChrome, E - .6, 1.0, -3.45);
    add(S(null, { color: 0xe8e8e4, roughness: .5 }), .35, .6, .5, E - .3, 0, -2.3, { col: true });
    // 문서 운반 카트 · 이동 사다리
    { const x = cx + 1.0, z = -4.5; const g = [bx(.9, .03, .6, 0, .85, 0), bx(.9, .03, .6, 0, .3, 0)]; [[-.42, -.27], [.42, -.27], [-.42, .27], [.42, .27]].forEach(([a, b]) => g.push(bx(.025, .85, .025, a, .425, b))); meshAt(merge(g), mDarkMetal, x, 0, z);
      [[-.2, 0], [.22, 0], [0, .1]].forEach(([a, b], k) => add(mCardboard, .33, .28, .45, x + a, .315 + (k > 1 ? .28 : 0), z + b)); col(x - .45, x + .45, z - .3, z + .3); }
    { const x = cx - 1.2, z = -4.3; const g = []; [-.25, .25].forEach(a => { g.push(tube(.02, a, 0, .45, a, 1.7, 0)); g.push(tube(.02, a, 0, -.45, a, 1.4, -.1)); }); for (let k = 1; k < 5; k++) g.push(bx(.5, .03, .2, 0, k * .33, .45 - k * .1)); meshAt(merge(g), mChrome, x, 0, z, Math.PI / 2); col(x - .45, x + .45, z - .3, z + .3); }
    scatterBooks(cx - .5, -4.8, 6); papers(cx, -8, -2.4, 12);
  }
  // A07 청소도구실 (참고 시트 7.70 × 7.85m): 북벽 철제 선반 (900×450×1800 × 4, 청소함 · 상자) · 서벽 선반 + 밀대/걸레 보관대 · 청소 카트 · 업소용 청소기 · 동벽 락커 (청소용품 900×450×1800 × 3) · 사다리 · 바닥 배수로 — 가운데(대걸레 자루 자리)는 비운다
  function cleaning(cx) {
    const W = cx - 3.85, E = cx + 3.85, N = -9.6, blue = b1m('binB', 0x2a4a8a, .6, 0), yel = b1m('binY', 0xc8a020, .6, 0);
    const binShelf = (x, z, len, ry) => { rackShelf(x, z, len, ry, .45, 1.8, 0); const n = Math.round(len / .65), alongX = Math.abs(Math.sin(ry)) < .5;
      for (let r = 0; r < 3; r++) for (let k = 0; k < n; k++) { const t = -len / 2 + (k + .5) * len / n, m = (r + k) % 3 === 2 ? mCardboard : (r + k) % 2 ? blue : yel; add(m, alongX ? .55 : .38, .3, alongX ? .38 : .55, x + (alongX ? t : 0), .18 + r * .62, z + (alongX ? 0 : t)); } };
    binShelf(cx - .5, N + .25, 3.6, 0); col(cx - 2.3, cx + 1.3, N, N + .5);
    binShelf(E - .25, -8.6, 1.8, Math.PI / 2); col(E - .5, E, -9.5, -7.7);
    binShelf(W + .25, -8.2, 2.4, Math.PI / 2); col(W, W + .5, -9.4, -7.0);
    // 서벽: 밀대/걸레 보관대 · 청소 카트 (노랑/빨강 통) · 업소용 청소기 · 큰 청소함 (파랑)
    { const x = W + .35, z = -6.2; add(blue, .6, .12, .5, x, 0, z); for (let k = 0; k < 7; k++) meshAt(merge([tube(.013, 0, .1, 0, 0, 1.75, 0), bx(.28, .05, .08, 0, .1, 0)]), S(null, { color: k % 2 ? 0x8a6a40 : 0x3a6ab0 }), x - .2 + (k % 4) * .13, 0, z - .15 + (k >> 2) * .25); col(W, W + .65, z - .3, z + .3); }
    { const x = W + .5, z = -4.9; add(yel, .4, .5, .45, x - .15, .15, z); add(b1m('cartR', 0xb02020, .45, .4), .3, .45, .45, x + .22, .15, z); add(mDarkMetal, .7, .03, .5, x, .12, z); [[-.3, -.2], [.3, -.2], [-.3, .2], [.3, .2]].forEach(([a, b]) => cyl(mBlack, .05, .1, x + a, 0, z + b, 10)); col(x - .35, x + .35, z - .25, z + .25); }
    cyl(b1m('vac', 0xb8bcc0, .4, .7), .2, .55, W + .4, 0, -3.9, 14); add(blue, .55, .9, .5, W + .35, 0, -3.1, { col: true });
    mopBucket(W + 1.1, -3.3);
    // 동벽: 락커 3 · 사다리 · 폐기물 드럼 (구석)
    cabinetRow(E - .23, -5.6, 2.7, -Math.PI / 2, 1.8, .45, b1m('locker', 0x8a8e90, .55, .4)); col(E - .45, E, -6.95, -4.25);
    { const L = [tube(.02, -.25, 0, 0, -.25, 1.8, -.3), tube(.02, .25, 0, 0, .25, 1.8, -.3)]; for (let s = 1; s < 6; s++) L.push(tube(.014, -.25, s * .3, -s * .3 * .17, .25, s * .3, -s * .3 * .17)); meshAt(merge(L), mChrome, E - .2, 0, -3.7, -Math.PI / 2); col(E - .5, E, -4.05, -3.35); }
    cyl(mDrumB, .3, .9, E - .45, 0, -2.6, 16); col(E - .8, E - .1, -2.95, -2.25);
    b1Trench(cx - 3.0, cx + 3.0, -2.25, -2.05);
    addBattery(cx + 2.6, 0, -3.0); papers(cx, -8, -2.4, 8);
  }
  // A03 기계실 (발전기) (참고 시트 7.70 × 7.85m): 비상 디젤 발전기 (3000×1500×1800) 콘크리트 받침 + 안전선 · 제어반/분전반 (서벽) · 축전지 선반 · 연료탱크 (경유 2000×1000×1600) · 배기 소음기 + 연도 · 흡배기 루버 · 소화기함 · 바닥 배수로
  function generator(cx) {
    const W = cx - 3.85, E = cx + 3.85, N = -9.6, green = b1m('genG', 0x1e5a3a, .45, .45), steel = b1m('tankS', 0x6a7078, .5, .5);
    // 발전기 본체: 엔진 블록 · 라디에이터 (서쪽) · 제어 박스 (동쪽) · 받침
    { const x = cx + .1, z = -6.4; b1Plinth(x - 1.85, x + 1.85, z - 1.0, z + 1.0, .2); add(b1m('hz', 0xd8b020, .6, 0), 3.7, .02, .08, x, .2, z + 1.0);
      meshAt(merge([bx(3.0, .15, 1.3, 0, .28, 0), bx(1.8, .9, 1.1, .1, .8, 0), bx(1.6, .25, .7, .1, 1.38, 0), ...[-.6, -.2, .2, .6].map(d => bx(.12, .2, .9, .1 + d, 1.6, 0))]), green, x, 0, z);
      add(mBlack, .35, 1.5, 1.3, x - 1.3, .35, z); add(b1m('grill', 0x2a2c2e, .7, .5), .02, 1.2, 1.1, x - 1.49, .5, z);   // 라디에이터
      add(green, .5, 1.1, .8, x + 1.2, .35, z + .1); add(mBlack, .02, .3, .4, x + 1.46, 1.05, z + .1); glowAt(x + 1.47, 1.2, z + .1, .12, glowGreen);
      col(x - 1.55, x + 1.5, z - .7, z + .7);
      b1Pipes([[.12, x + .4, 1.7, z, x + .4, CH - .35, z], [.12, x + .4, CH - .35, z, E - .4, CH - .35, z]], mChrome);
      cyl(mChrome, .25, .9, E - .9, CH - .7, z - .55, 16).rotation.z = Math.PI / 2; }   // 배기 소음기 (천장)
    b1Trench(cx - 2.2, cx + 2.4, -5.15, -4.95); b1Trench(cx - 2.2, cx + 2.4, -7.85, -7.65);
    // 서쪽 벽: 제어반 · 분전반 (1200×600×2000 × 2) · 축전지 선반 (1200×600×1200)
    cabinetRow(W + .3, -7.6, 2.4, Math.PI / 2, 2.0, .6); col(W, W + .6, -8.8, -6.4);
    { const x = W + .3, z = -4.9; rackShelf(x, z, 1.2, Math.PI / 2, .55, 1.2, 0); for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) add(mBlack, .22, .24, .3, x, .18 + r * .62, z - .45 + k * .3); col(W, W + .6, z - .65, z + .65); }
    // 동쪽 벽: 연료탱크 (가로형 원통 2000×1000×1600 + 받침) · 북벽 흡배기 루버 · 소화기함 (문 옆)
    { const x = E - .6, z = -3.6; meshAt(new THREE.CylinderGeometry(.5, .5, 2.0, 20).rotateX(Math.PI / 2).translate(0, .9, 0), steel, x, 0, z); [-.7, .7].forEach(d => add(mDarkMetal, .8, .4, .12, x, 0, z + d)); col(x - .55, x + .55, z - 1.0, z + 1.0); b1Pipes([[.04, x, 1.4, z - .8, x, 1.4, -6.0], [.04, x, 1.4, -6.0, cx + 1.6, .6, -6.0]], mDarkMetal); }
    add(b1m('louv', 0x8a8e90, .5, .5), 1.2, .8, .05, cx - 1.0, 2.2, N + .03); for (let k = 0; k < 6; k++) add(mDarkMetal, 1.15, .02, .06, cx - 1.0, 2.25 + k * .13, N + .07);
    add(b1m('fireBox', 0xb81e1e, .5, .2), .5, 1.0, .25, cx + 1.8, .5, -1.9); papers(cx, -8, -2.4, 5);
  }
  // A10 펌프실 (참고 시트 7.85 × 7.85m): 주펌프 유닛 (급수 3연 수직펌프 2400×1200) · 보조펌프 · 압력(팽창)탱크 · 제어반 3 · 소화/급수 배관 매니폴드 · 바닥 배수로 (남북) · 소화기함 — 수영장 정비 사다리 · 비밀 자료실 철제 덮개 · 폴리스라인 유지
  function pump(cx) {
    const W = cx - 3.85, E = cx + 4.0, N = -9.6, blue = b1m('pumpB', 0x24508e, .45, .5), tankB = b1m('tankB', 0x2a62b0, .4, .4);
    (cur.furnOcc ||= []).push({ x: cx, z: -5.6, w: 6.8, d: 6.8 });
    // 주펌프 유닛: 콘크리트 받침 (1200×2400) + 수직펌프 4 + 헤더 배관
    { const x = W + 1.3, z0 = -8.4; b1Plinth(x - .6, x + .6, z0, z0 + 2.6, .25); [0, 1, 2, 3].forEach(k => vPump(x, z0 + .35 + k * .63, .25, blue));
      b1Pipes([[.1, x - .35, .5, z0 + .1, x - .35, .5, z0 + 2.5], [.1, x + .35, 1.5, z0 + .1, x + .35, 1.5, z0 + 2.5]], mBlueP); col(x - .6, x + .6, z0, z0 + 2.6); }
    // 서쪽 벽 소화 배관 (빨강) 매니폴드 · 수직 급수관
    b1Pipes([[.14, W + .25, 0, -8.9, W + .25, CH, -8.9], [.14, W + .25, .9, -8.9, W + .25, .9, -5.4], [.11, W + .25, 1.8, -8.6, W + .25, 1.8, -5.4], [.11, W + .25, CH - .4, -9.2, E - .3, CH - .4, -9.2]], mRedV);
    b1Pipes([[.1, W + .5, 0, -9.3, W + .5, CH, -9.3], [.08, W + .5, CH - .6, -9.3, E - .3, CH - .6, -9.3]], mBlueP);
    [[-8.0, .9], [-6.4, .9], [-7.2, 1.8]].forEach(([z, y]) => valveWheel(W + .38, y, z, Math.PI / 2, .14));
    // 압력탱크 (Ø1000 × 2000, 파랑) · 제어반 3 (북벽) · 수위/압력 제어기
    cyl(tankB, .5, 1.6, cx - .2, 0, -8.85, 20); meshAt(new THREE.SphereGeometry(.5, 16, 8), tankB, cx - .2, 1.6, -8.85); col(cx - .75, cx + .35, -9.4, -8.3);
    cabinetRow(cx + 1.9, N + .3, 1.8, 0, 2.0, .6, b1m('panelB', 0xc8c0a8, .6, .2)); col(cx + 1.0, cx + 2.8, N, N + .6);
    add(b1m('panelB', 0xc8c0a8, .6, .2), .6, .6, .2, E - .15, 1.1, -7.0); gauge(E - .26, 1.6, -7.2, -Math.PI / 2);
    // 보조펌프 2 (동쪽 받침 1200×800) + 동쪽 벽 배관
    [-7.4, -5.6].forEach(z => { const x = E - .9; b1Plinth(x - .6, x + .4, z - .4, z + .4, .2); hPump(x - .1, z, 0, blue); b1Pipes([[.06, x - .1, .62, z + .25, E - .2, .62, z + .25], [.06, E - .2, .62, z + .25, E - .2, CH, z + .25]], mDarkMetal); });
    // 바닥 배수로 (남북 방향, 300 폭)
    b1Trench(cx + .55, cx + .85, -9.0, -3.9);
    // 4 정비 사다리 (수영장 기계실로) — 서쪽 벽 남측
    { const z = -2.7, L = [tube(.025, -.25, 0, 0, -.25, CH, 0), tube(.025, .25, 0, 0, .25, CH, 0)]; for (let k = 1; k < 9; k++) L.push(tube(.018, -.25, k * .38, 0, .25, k * .38, 0));
      meshAt(merge(L), mChrome, W + .1, 0, z, Math.PI / 2); meshAt(new THREE.BoxGeometry(.9, .02, .9), mBlack, W + .35, CH - .01, z);
      doors.push({ floor: cur.f, x: W + .55, z, r: 1.4, label: '사다리 오르기 (수영장 기계실)', to: { floor: 6, x: -39.4, z: 55.4, yaw: 0 } }); }
    // 5 철제 덮개 → 비밀 자료실 (전원 필요)
    { const x = cx + 2.2, z = -2.8; add(mDarkMetal, 1.0, .05, .8, x, 0, z); for (let k = 0; k < 4; k++) add(mRust, .9, .012, .03, x, .052, z - .3 + k * .2);
      meshAt(new THREE.TorusGeometry(.06, .012, 6, 12).rotateX(Math.PI / 2), mChrome, x + .35, .06, z);
      doors.push({ floor: cur.f, x, z, r: 1.1, needPower: true, label: '철제 덮개 들어 올리기 (좁은 통로)', to: { floor: cur.f, x: cx - 2.2, z: 3.1, yaw: Math.PI } }); }
    // 6 폴리스라인 (3D 씬은 game.js 가 이 방 중앙에 놓는다) · 1998 『서문일보』 호외 + 실제 획득 문서
    { const mPaper = new THREE.MeshBasicMaterial({ map: T.makeSign('서 문 일 보 (호외) | 1998.10.13 — 서문고 심야 실종 사건, 지하 펌프실 통제', '#e8dfc8', '#181614', 20), side: THREE.DoubleSide });
      plane(cur.interior, mPaper, .82, .54, cx - .15, .022, -3.85, -Math.PI / 2); addNote('n_seomun_ilbo', cx + .35, .03, -3.75); }
    add(b1m('fireBox', 0xb81e1e, .5, .2), .7, 1.2, .25, E - .5, .3, -1.9);
    wetSpot(cx - .4, -5.0, .9); papers(cx, -8, -2.4, 4);
    secretRoom(cx);
  }
  // A09 비밀 자료실 (숨겨진 과거 사건의 방) — 복도 남쪽 벽 너머, 배수실의 철제 덮개로만 들어올 수 있다
  function secretRoom(cx) {
    const z0 = 2.05, z1 = 9.9, x0 = cx - 4, x1 = cx + 4, A = sheetRoom(cx, 9, 11, true), mW = curWall;
    flat(cur.interior, mFloorTile, x0, x1, z0, z1, 0); flat(cur.interior, mCeil, x0, x1, z0, z1, CH, 4, false);
    [[x0 - .3, x0, z0, z1], [x1, x1 + .3, z0, z1], [x0, x1, z1, z1 + .3]].forEach(([a, b, c, d]) => { cur.interior.add(boxMesh(a, b, 0, CH, c, d, mW)); col(a, b, c, d, true); });
    cur.interior.add(boxMesh(x0, x1, 0, CH, 1.75, z0, mW));
    const d1 = A(1.1, 3.4, 3, 2.3);   // 1 낡은 책상 (스탠드 · 서류 · 찻잔)
    meshAt(merge([bx(2.4, .05, 1.1, 0, .76, 0), bx(.05, .74, 1.0, -1.15, .37, 0), bx(.05, .74, 1.0, 1.15, .37, 0), bx(.6, .5, 1.0, .85, .5, 0)]), mWoodDark, d1.x, 0, d1.z); col(d1.x - 1.2, d1.x + 1.2, d1.z - .55, d1.z + .55);
    meshAt(merge([new THREE.CylinderGeometry(.08, .1, .03, 12).translate(0, .015, 0), tube(.01, 0, 0, 0, .08, .35, 0), new THREE.ConeGeometry(.1, .12, 12, 1, true).translate(.1, .32, 0)]), mDarkMetal, d1.x - .8, .79, d1.z - .2);
    glowAt(d1.x - .7, .95, d1.z - .2, .9, T.makeGlow('255,200,120'));
    cyl(mPorc, .04, .08, d1.x + .3, .79, d1.z + .25, 10); for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(.21, .29), mDirtPaper); p.rotation.set(-Math.PI / 2, 0, rr(-.5, .5)); p.position.set(d1.x - .2 + k * .18, .792 + k * .002, d1.z + rr(-.2, .2)); cur.interior.add(p); }
    deskChair(d1.x, d1.z - .9, 0);
    const c2 = A(1.0, .6, 4.2, 1.5);  // 2 철제 캐비닛 (잠김 · 사슬)
    cabinetRow(c2.x, z1 - .3, c2.w, Math.PI, 1.8, .45, mPanelG); col(c2.x - c2.w / 2, c2.x + c2.w / 2, z1 - .55, z1);
    meshAt(new THREE.TorusGeometry(.12, .02, 6, 14), mRust, c2.x, 1.0, z1 - .55); add(S(null, { color: 0x6a5a30, metalness: .8, roughness: .4 }), .1, .12, .05, c2.x, .82, z1 - .56);
    const b3 = A(6.7, 1.1, 1.5, 3.4); // 3 사진 게시판 (사진 · 빨간 실 · 메모)
    plane(cur.interior, mCork, b3.d, 1.2, x1 - .02, 1.6, b3.z, -Math.PI / 2);
    { const pins = []; for (let k = 0; k < 9; k++) { const pz = b3.z - b3.d / 2 + .3 + (k % 5) * (b3.d - .6) / 4, py = 1.25 + ((k / 5) | 0) * .45 + rr(-.08, .08); pins.push([pz, py]);
        const ph = new THREE.Mesh(new THREE.PlaneGeometry(.22, .17), k % 3 === 0 ? mPaints[2] : mDirtPaper); ph.position.set(x1 - .03, py, pz); ph.rotation.set(0, -Math.PI / 2, rr(-.12, .12)); cur.interior.add(ph); }
      const red = new THREE.LineBasicMaterial({ color: 0xc01818 }); const pts = [];
      for (let k = 0; k < pins.length - 1; k += 1) pts.push(new THREE.Vector3(x1 - .035, pins[k][1], pins[k][0]), new THREE.Vector3(x1 - .035, pins[(k + 3) % pins.length][1], pins[(k + 3) % pins.length][0]));
      cur.interior.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), red)); }
    graffiti('그날 밤을 기억해', cx, 2.5, z1 - .02, Math.PI, 2.2);
    const t4 = A(4.3, 7.3, 1.4, 1.1); // 4 녹음 테이프 (교무부장의 마지막 녹음)
    add(mCardboard, .6, .45, .45, t4.x, 0, t4.z, { col: true }); tapeRecorder('tape5', t4.x, .45, t4.z, .3);
    const p5 = A(7.9, 5.2, .8, 2.4); // 5 은닉 통로 (배수실로 돌아가는 좁은 틈)
    add(mBlack, .05, 1.8, .9, x1 - .03, 0, p5.z); add(mWoodDark, .1, 1.9, .08, x1 - .06, 0, p5.z - .5); add(mWoodDark, .1, 1.9, .08, x1 - .06, 0, p5.z + .5);
    doors.push({ floor: cur.f, x: x1 - .6, z: p5.z, r: 1.2, label: '좁은 통로로 나가기 (배수실)', to: { floor: cur.f, x: cx + 1.2, z: -3.9, yaw: Math.PI } });
    // 남측 별실 리모델링 (참고 시트 8.00 × 7.85m · 다목적 작업/보관실): 가운데 회의/작업 테이블 (1800×900×720) + 접이식 의자 6 · 서벽 철제 선반 · 철제 캐비닛 2 · 동벽 철제 선반 (1200×450×1800) · 이동식 화이트보드 · 청소도구 · 작업용 사다리 · 수납 박스
    { const tx = cx + .9, tz = 6.1; tbl(mWood, .9, .72, 1.8, tx, 0, tz, { col: true, legMat: mLegMetal });
      [-.6, 0, .6].forEach(d => [-1, 1].forEach(s => { const x = tx + s * .7, z = tz + d; add(b1m('fchair', 0x2a2c2e, .5, .4), .44, .04, .44, x, .45, z); add(b1m('fchair', 0x2a2c2e, .5, .4), .04, .4, .4, x + s * .2, .47, z); [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]].forEach(([a, b]) => add(mLegMetal, .02, .45, .02, x + a, 0, z + b)); }));
      add(mDirtPaper, .3, .005, .42, tx - .1, .725, tz - .3); cyl(mDarkMetal, .04, .12, tx + .2, .72, tz + .4, 10); }
    rackShelf(x0 + .25, z0 + .9, 1.2, Math.PI / 2, .45, 1.8, .8); col(x0, x0 + .5, z0 + .25, z0 + 1.55);
    cabinetRow(x0 + .25, z0 + 2.6, 1.8, Math.PI / 2, 1.8, .45, b1m('locker', 0x8a8e90, .55, .4)); col(x0, x0 + .5, z0 + 1.7, z0 + 3.5);
    rackShelf(x1 - .25, z0 + 1.4, 2.4, Math.PI / 2, .45, 1.8, .8); col(x1 - .5, x1, z0 + .2, z0 + 2.6);
    { const x = cx + 1.6, z = z0 + .6; add(S(null, { color: 0xf4f4f0, roughness: .4 }), 1.8, .9, .03, x, .9, z); add(mChrome, 1.84, .04, .05, x, .88, z); [-.9, .9].forEach(d => add(mChrome, .03, 1.8, .03, x + d, 0, z)); col(x - 1.0, x + 1.0, z - .2, z + .2); }
    { const x = x1 - .5, z = z1 - .5; add(b1m('binB', 0x2a4a8a, .6, 0), .5, .45, .4, x, 0, z); for (let k = 0; k < 3; k++) meshAt(merge([tube(.013, 0, 0, 0, .05, 1.5, .05), bx(.28, .05, .08, 0, .03, 0)]), S(null, { color: 0x8a6a40 }), x - .4 + k * .15, 0, z + .1); col(x - .6, x + .3, z - .3, z + .3); }
    { const L = [tube(.02, -.25, 0, 0, -.25, 1.2, -.2), tube(.02, .25, 0, 0, .25, 1.2, -.2)]; for (let s = 1; s < 4; s++) L.push(tube(.014, -.25, s * .3, -s * .3 * .17, .25, s * .3, -s * .3 * .17)); meshAt(merge(L), mChrome, x0 + .25, 0, z1 - 1.6, Math.PI / 2); }
    [[x0 + .4, z1 - .4], [x0 + .4, z1 - .85]].forEach(([x, z]) => add(b1m('box2', 0x6a6e72, .6, .2), .6, .32, .4, x, 0, z, { col: true }));
    papers(cx, z0 + .5, z1 - .5, 8);
  }
  // A05 소방시설실 (옛 비상 계단실 자리 · 참고 시트 7.70 × 7.85m): 소방 펌프 (1800×1200×1500) · 소화수조/압력탱크 (Ø1200 × 2000) · 소방 제어반 (1000×400×2000 × 2) · 소화 배관 (Ø100~300) · 소화기함 — 북벽 잠긴 비상 철문 (탈출 조건) 유지
  function exitRoom(cx) {
    const W = cx - 3.85, E = cx + 3.85, N = -9.6, fr = b1m('fireR', 0xb01818, .4, .45), fr2 = b1m('fireR2', 0x8a1010, .5, .4);
    // 소방 펌프 2 (서북쪽 받침 위): 모터 + 볼류트 + 배관
    [-8.4, -6.6].forEach(z => { const x = W + 1.3; b1Plinth(x - .9, x + .9, z - .6, z + .6, .15);
      meshAt(merge([new THREE.CylinderGeometry(.3, .3, .9, 16).rotateZ(Math.PI / 2).translate(-.35, .6, 0), new THREE.SphereGeometry(.38, 14, 10).scale(1, 1, .8).translate(.4, .6, 0), new THREE.CylinderGeometry(.12, .12, .9, 12).translate(.4, 1.3, 0), bx(1.6, .12, .8, 0, .21, 0)]), fr, x, 0, z); gauge(x + .4, 1.5, z + .3); col(x - .9, x + .9, z - .6, z + .6); });
    // 압력탱크 (북동, 비상문 옆) · 소방 제어반 2 (서벽 남측) · 소화기함 (동벽)
    cyl(fr, .6, 1.5, E - .75, 0, N + .75, 22); meshAt(new THREE.SphereGeometry(.6, 18, 9), fr, E - .75, 1.5, N + .75); col(E - 1.4, E - .1, N + .1, N + 1.4);
    cabinetRow(W + .22, -4.0, 2.0, Math.PI / 2, 2.0, .4, fr); col(W, W + .45, -5.0, -3.0);
    [-6.4, -4.2].forEach(z => { add(fr, .25, 1.0, .7, E - .13, .3, z); add(b1m('glassR', 0xe8e0d8, .3, .1), .01, .5, .5, E - .26, .6, z); });
    // 소화 배관: 서벽 · 북벽 수직 + 천장 아래 주배관 + 동벽 하강관 · 밸브
    b1Pipes([[.15, W + .25, 0, N + .3, W + .25, CH, N + .3], [.12, W + 2.3, 1.3, -8.4, W + 2.3, CH - .3, -8.4], [.12, W + 2.3, 1.3, -6.6, W + 2.3, CH - .3, -6.6], [.15, W + .25, CH - .3, N + .3, E - .3, CH - .3, N + .3], [.12, W + .3, CH - .3, N + .3, W + .3, CH - .3, -3.0],
      [.1, E - .25, CH - .3, N + .3, E - .25, CH - .3, -3.5], [.1, E - .25, .4, -3.5, E - .25, CH - .3, -3.5], [.08, E - .75, 1.5, N + .75, E - .75, CH - .3, N + .75], [.1, W + 2.3, CH - .3, -8.4, W + 2.3, CH - .3, -6.6]], fr2);
    [[W + .4, 1.2, N + .3, 0], [E - .38, 1.0, -3.5, -Math.PI / 2], [W + 2.3, 2.2, -7.5, Math.PI / 2]].forEach(([x, y, z, ry]) => valveWheel(x, y, z, ry, .15));
    b1Trench(cx - 3.0, cx + 3.0, -2.95, -2.75);
    // 북벽 잠긴 비상 철문 (정문 열쇠 필요 → 탈출)
    plane(cur.interior, mDoor, 1.3, 2.3, cx + 1.4, 1.15, -9.57);
    add(mDarkMetal, 1.5, .12, .1, cx + 1.4, 2.3, -9.55); meshAt(new THREE.TorusGeometry(.12, .025, 6, 14), mRust, cx + 1.4, 1.1, -9.48); add(S(null, { color: 0x6a5a30, metalness: .8, roughness: .4 }), .14, .16, .06, cx + 1.4, .9, -9.45);
    plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('비 상 구', '#0a3a1a', '#7dffa0', 30) }), 1.2, .3, cx + 1.4, 2.65, -9.56);
    exitSign(cx + 3.8, 2.6, -5.0, -Math.PI / 2);
    glowAt(cx + 1.4, 1.4, -8.6, 4, glowRed);
    { const x = cx - .4, z = -2.4;   // 휴대 비상등 (건전지)
      meshAt(merge([bx(.25, .16, .12, 0, .08, 0), tube(.01, -.08, .16, 0, .08, .16, 0)]), S(null, { color: 0xd8b020, roughness: .5 }), x, 0, z, .4); glowAt(x, .12, z + .1, .35, T.makeGlow('255,230,160')); addBattery(x + .35, 0, z); }
    doors.push({ floor: cur.f, x: cx + 1.4, z: -8.5, r: 1.9, label: '비상 통로 (정문 방향)', need: KEY_NAMES.length, to: { floor: 0, x: -12, z: 67.5, yaw: Math.PI } });
    papers(cx, -8, -2.4, 6);
  }

  /* ---------- 본관 남쪽 방 줄 (3D 프로토타입: 복도 양쪽에 방) ----------
     남쪽 방은 북쪽 방과 같은 빌더로 짓고, 방 중심(cx, 0)을 축으로 180° 돌려 복도 남쪽에 놓는다.
     빌더가 기록한 충돌 · 문 · 소품 · 아이템 · 사물함 좌표도 같은 변환을 적용한다. */
  let curSouth = false;
  function southRoom(cx, fn) {
    const F = cur, real = F.interior, g = new THREE.Group(); g.position.x = 2 * cx; g.rotation.y = Math.PI; real.add(g);
    const n = { models: MODELS.length, col: F.col.length, walls: F.walls.length, dw: (F.doorWalls || []).length, props: props.length, items: items.length, doors: doors.length, dl: doorList.length, lockers: lockers.length, books: (F.books || []).length, sparks: (F.sparks || []).length, chairs: CHAIRS.length, fo: (F.furnOcc || []).length };
    const refKeys = new Set(Object.keys(boardRefs));
    F.interior = g; curSouth = true;
    try { fn(); } finally { F.interior = real; curSouth = false; }
    const done = new Set(), mx = x => 2 * cx - x;
    const tr = o => {
      if (!o || typeof o !== 'object' || done.has(o)) return; done.add(o);
      if (o.model) o.ry += Math.PI;
      if (typeof o.x1 === 'number' && typeof o.x2 === 'number') { const a = mx(o.x2), b = mx(o.x1), c = -o.z2, d = -o.z1; o.x1 = a; o.x2 = b; o.z1 = c; o.z2 = d; }
      if (typeof o.x === 'number' && typeof o.z === 'number') { o.x = mx(o.x); o.z = -o.z; }
      if (typeof o.px === 'number') { o.px = mx(o.px); o.pz = -o.pz; }
      if (o.pos && o.pos.isVector3) { o.pos.x = mx(o.pos.x); o.pos.z = -o.pos.z; }
      if (o.dir) o.dir = { x: -o.dir.x, z: -o.dir.z };
      if (o.rect) tr(o.rect);
    };
    [MODELS.slice(n.models), F.col.slice(n.col), F.walls.slice(n.walls), (F.doorWalls || []).slice(n.dw), props.slice(n.props), items.slice(n.items), doors.slice(n.doors), doorList.slice(n.dl), lockers.slice(n.lockers), (F.sparks || []).slice(n.sparks), CHAIRS.slice(n.chairs), (F.furnOcc || []).slice(n.fo)].forEach(l => l.forEach(tr));   /* 의자(앉기)도 남쪽 방 좌표로 */
    Object.keys(boardRefs).filter(k => !refKeys.has(k)).forEach(k => tr(boardRefs[k]));
    if (F.books) { g.updateMatrix(); F.books.slice(n.books).forEach(b => b.m.premultiply(g.matrix)); }
  }
  // 남쪽 방 미닫이문 (복도 남벽, 실제 좌표)
  function slidingDoorsS(cx) {
    const zW = 1.4; add(mWoodDark, 2.2, .05, .08, cx, 2.3, zW - .02);
    const open = rnd() < .35, rect = { x1: cx - 1, x2: cx + 1, z1: zW - .03, z2: 1.75, off: open };
    const leaves = hingeLeaves(cx, zW);
    const d = { kind: 'slide', floor: cur.f, x: cx, z: 1.5, open: open ? 1 : 0, target: open ? 1 : 0, panels: [], leaves, rect, name: '문' };
    leaves.forEach(l => { l.piv.rotation.y = l.a * d.open; });
    cur.col.push(rect); (cur.doorWalls ||= []).push(rect); doorList.push(d);
    return d;
  }
  // 공통 소품
  const sofa = (x, z, ry, w = 1.8, mat = mFabric) => { model('sf_sofa', x, 0, z, ry, { s: w / 1.95 }); const sw = Math.abs(Math.sin(ry)) > .7; col(x - (sw ? .45 : w / 2), x + (sw ? .45 : w / 2), z - (sw ? w / 2 : .45), z + (sw ? w / 2 : .45)); };
  const trophyCase = (x, z, ry, w = 1.6) => { const frame = [bx(w, .12, .46, 0, .06, 0), bx(w, .1, .46, 0, 1.88, 0), bx(w, 1.82, .04, 0, .95, -.21), bx(.05, 1.82, .46, -w / 2 + .025, .95, 0), bx(.05, 1.82, .46, w / 2 - .025, .95, 0), bx(w - .08, .52, .44, 0, .32, 0), bx(w - .1, .025, .38, 0, 1.05, 0), bx(w - .1, .025, .38, 0, 1.45, 0)]; const g = meshAt(merge(frame), mWoodDark, x, 0, z, ry); const gl = new THREE.Mesh(new THREE.PlaneGeometry(w - .1, 1.24), mWinIn); gl.position.set(0, 1.22, .225); g.add(gl); const trim = new THREE.Mesh(merge([bx(.025, 1.24, .02, 0, 1.22, .228), bx(.04, .14, .03, -.04, 1.15, .238), bx(.04, .14, .03, .04, 1.15, .238)]), mChrome); g.add(trim); for (let k = 0; k < 6; k++) { const shY = k < 3 ? 1.065 : 1.465, tx = -w * .32 + (k % 3) * (w * .32); const t = new THREE.Mesh(merge([new THREE.CylinderGeometry(.055, .07, .05, 12).translate(0, .025, 0), new THREE.CylinderGeometry(.016, .016, .13, 8).translate(0, .11, 0), new THREE.CylinderGeometry(.075, .038, .14, 14, 1, true).translate(0, .24, 0)]), S(null, { color: k % 2 ? 0xd4a838 : 0xc0c6cc, metalness: .85, roughness: .22 })); t.position.set(tx, shY, 0); g.add(t); } glowAt(x + Math.sin(ry) * .12, 1.72, z + Math.cos(ry) * .12, .55, T.makeGlow('255,230,170')); const sw = Math.abs(Math.sin(ry)) > .7; col(x - (sw ? .25 : w / 2), x + (sw ? .25 : w / 2), z - (sw ? w / 2 : .25), z + (sw ? w / 2 : .25)); };
  const noticeBoard = (x, y, z, ry, w = 1.6) => { model('sf_bulletin_board', x, y - .55, z, ry, { s: w / 1.8 }); };
  // 교장실
  function principal(cx) {
    const zN = -9.6;
    meshAt(merge([bx(1.9, .05, .9, 0, .76, 0), bx(1.8, .74, .05, 0, .37, .4), bx(.5, .74, .8, -.65, .37, 0), bx(.5, .74, .8, .65, .37, 0)]), mWoodDark, cx, 0, -7.9); col(cx - .95, cx + .95, -8.35, -7.45);
    officeChair(cx, -8.7, 0); add(mBlack, .45, .3, .02, cx - .5, .79, -8.05); plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('교 장', '#2a2016', '#d8c8a0', 30), roughness: .6 }), .5, .12, cx, .86, -7.44);
    plane(cur.interior, mFlag, .9, .6, cx, 2.3, zN + .04);
    [-1.3, 1.3].forEach(dx => { const fr = new THREE.Mesh(new THREE.BoxGeometry(.5, .65, .03), mWoodDark); fr.position.set(cx + dx, 2.3, zN + .03); cur.interior.add(fr); const pic = new THREE.Mesh(new THREE.PlaneGeometry(.4, .55), mPaints[1]); pic.position.set(cx + dx, 2.3, zN + .05); cur.interior.add(pic); });
    plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('성실 · 정직 · 배려', '#e8e2d2', '#3a2a1a', 26), roughness: .8 }), 2.0, .45, cx, 3.0, zN + .04);
    sofa(cx - 2.6, -4.5, Math.PI / 2); sofa(cx + 2.6, -4.5, -Math.PI / 2); add(mWood, 1.2, .4, .6, cx, 0, -4.5, { col: true }); cyl(mPorc, .05, .09, cx + .2, .4, -4.5, 10);
    // 교장 집무 책상 위: 동적 3D 마이크로카세트 녹취기 (실시간 회전 릴 2개 · 가동 버튼 · 점멸 LED)
    { const rg = dyn(new THREE.Group()); rg.position.set(cx + .45, .78, -7.85); cur.interior.add(rg);
      const body = new THREE.Mesh(new THREE.BoxGeometry(.32, .06, .22), mDarkMetal); body.position.y = .03; rg.add(body);
      const playBtn = dyn(new THREE.Mesh(new THREE.BoxGeometry(.07, .022, .045), S(null, { color: 0xc82820, roughness: .35 }))); playBtn.position.set(-.06, .068, .08); rg.add(playBtn);
      const mkR = rx => { const r = dyn(new THREE.Group()); r.position.set(rx, .066, -.01); r.add(new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .012, 14), mWhite)); r.add(new THREE.Mesh(new THREE.BoxGeometry(.076, .015, .012), mDarkMetal)); r.add(new THREE.Mesh(new THREE.BoxGeometry(.012, .015, .076), mDarkMetal)); rg.add(r); return r; };
      const reelL = mkR(-.07), reelR = mkR(.07);
      const led = dyn(new THREE.Mesh(new THREE.SphereGeometry(.014, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff3020 }))); led.position.set(.12, .068, .06); rg.add(led);
      props.push({ kind: 'robj', k: 'principal_recorder', t: 'principal', floor: cur.f, x: cx + .45, z: -7.45, y: .88, r: 2.3, label: '교장실 비밀 녹취기 재생 — 교장선생님 육성 녹음 듣기', anim: { type: 'tape', g: rg, reelL, reelR, playBtn, led, playT: 0 } }); }
    trophyCase(cx + 3.55, -7.9, -Math.PI / 2, 1.6); shelf3D(cx - 3.62, -7.6, Math.PI / 2, 1.6, 2.0, .4, 5, .8);
    potPlant(cx + 3.3, 0, -2.4, false); papers(cx, -8, -2.4, 6);
  }
  // 회의실
  function meeting(cx) {
    const zN = -9.6;
    meshAt(merge([bx(4.6, .05, 1.3, 0, .74, 0), bx(.08, .72, .08, -2.1, .36, -.5), bx(.08, .72, .08, 2.1, .36, -.5), bx(.08, .72, .08, -2.1, .36, .5), bx(.08, .72, .08, 2.1, .36, .5)]), mWood, cx, 0, -5.8); col(cx - 2.3, cx + 2.3, -6.45, -5.15);
    for (let k = 0; k < 5; k++) [-1, 1].forEach(s => { officeChair(cx - 2.0 + k * 1.0, -5.8 + s * 1.08, s > 0 ? Math.PI : 0, false); }); (cur.furnOcc ||= []).push({ x: cx, z: -5.8, w: 6.2, d: 3.4 });
    add(mWhite, 2.4, 1.2, .04, cx, 1.0, zN + .05); add(mBlack, .3, .05, .3, cx, CH - .5, -6.0);
    for (let k = 0; k < 6; k++) { const pp = new THREE.Mesh(new THREE.PlaneGeometry(.21, .29), mDirtPaper); pp.rotation.set(-Math.PI / 2, 0, rr(-.6, .6)); pp.position.set(cx - 2 + k * .8, .77, -5.8 + rr(-.4, .4)); cur.interior.add(pp); }
    model('sf_water_cooler', cx + 3.5, 0, -8.9, 0, { col: [.45, .45] }); glowAt(cx + 3.45, .92, -8.74, .11, glowRed); glowAt(cx + 3.55, .92, -8.74, .11, glowGreen);
    noticeBoard(cx - 3.84, 1.6, -5.8, Math.PI / 2, 1.8); papers(cx, -8, -2.4, 6);
  }
  // 중앙현관 (밖에서 들어오는 첫 공간): 신발장 · 트로피 진열장 · 안내판 · 교내 지도 · 우산꽂이
  function lobby(cx) {
    for (let k = 0; k < 4; k++) [-1, 1].forEach(s => { meshAt(merge([...Array.from({ length: 5 }, (_, r) => bx(1.0, .02, .35, 0, .05 + r * .38, 0)), bx(.02, 1.6, .35, -.5, .8, 0), bx(.02, 1.6, .35, .5, .8, 0)]), mWood, cx + s * 3.6, 0, -8.6 + k * 1.05, s > 0 ? -Math.PI / 2 : Math.PI / 2); });
    col(cx - 3.85, cx - 3.4, -9.2, -4.9); col(cx + 3.4, cx + 3.85, -9.2, -4.9);
    for (let k = 0; k < 14; k++) add(S(null, { color: pick([0xe8e6e0, 0x2a2a30, 0x3a5aa0, 0x8a2a2a]) }), .26, .08, .1, cx + (k % 2 ? 3.55 : -3.55), .07 + ((k / 4) | 0) * .38, -8.8 + (k % 4) * 1.05 + rr(-.1, .1), { ry: Math.PI / 2 + rr(-.3, .3) });
    // 복도 쪽은 6m 개구부(벽 없음)라 진열장 · 게시판은 옆벽에 붙인다 (예전엔 개구부 한가운데 떠 있었다)
    trophyCase(cx - 3.62, -3.15, Math.PI / 2, 1.8); noticeBoard(cx + 3.83, 1.6, -3.15, -Math.PI / 2, 1.8);
    plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('환영합니다 · 서문고등학교', '#20302a', '#d8e8d0', 22), roughness: .8 }), 3.0, .45, cx, 3.1, -1.77, Math.PI);   // 개구부 위 인방(2.7~3.6m)에 붙임
    cyl(mBlue, .18, .5, cx + 2.2, 0, -8.9, 12); for (let k = 0; k < 3; k++) { const u = meshAt(new THREE.CylinderGeometry(.012, .012, .9, 6).translate(0, .45, 0), mBlack, cx + 2.2 + rr(-.08, .08), 0, -8.9 + rr(-.08, .08)); u.rotation.z = rr(-.2, .2); }
    potPlant(cx - 2.4, 0, -9.1, true); potPlant(cx + 2.9, 0, -9.1, true);
    add(mStep, 3.4, .02, 1.2, cx, 0, -9.0);   // 현관 매트 자리
    model('potted_plant_04', cx - 3.35, 0, -8.85, 0); model('potted_plant_04', cx + 3.35, 0, -8.85, 1);
    papers(cx, -8, -2.4, 10);
  }
  // 인쇄실
  // 인쇄실 — 사용자 제공 'PrintRoom AAA' 팩의 실제 GLB (assets/models/pr) + 팩 1K PBR 4종. 팩 배치표(문 y -3.05 · 뒷벽 y 3.04)를 게임 방 깊이로 비례 변환,
  // 벽에 붙는 가구는 벽에 맞춰 붙인다. 문 · 표지판 · 형광등 · 창 · 벽 패널 GLB 는 기존 건축 · 조명과 겹쳐 쓰지 않는다 (남쪽 방이라 southRoom 이 통째로 돌린다)
  function print(cx) {
    const zN = -9.6, Z = y => -1.75 - (y + 3.05) * 1.287;
    const pr = (id, x, z, y = 0, ry = 0, fb) => { model('pr/' + id, x, y, z, ry); if (fb) crFallback(id, fb[0], fb[1], fb[2], fb[3], x, y, z, ry); };
    // 뒷벽: 복사기 2대 (스캐너 뚜껑 열림 · 배출 트레이) · 유틸리티 싱크대 · 휴지통
    [[-.68, 0], [.85, 0]].forEach(([x], k) => { pr('PR-005', cx + x * 1.2, zN + .45, 0, 0, [mPlastic, .9, .91, .72]); col(cx + x * 1.2 - .45, cx + x * 1.2 + .45, zN + .05, zN + .85, false, .91); });
    pr('PR-007', cx + 2.75, zN + .3, 0, 0, [mPorc, .62, .85, .46]); col(cx + 2.44, cx + 3.06, zN, zN + .55);
    model('pr/PR-014', cx + 2.0, 0, zN + .45, .3); col(cx + 1.84, cx + 2.16, zN + .29, zN + .61);
    // 서쪽 벽: 철제 수납 선반 (상자 · 용지 더미) + 바닥 보관 상자
    pr('PR-008', cx - 3.62, Z(-.6), 0, Math.PI / 2, [mMetal, 1.75, 1.86, .42]); col(cx - 3.85, cx - 3.4, Z(-.6) - .9, Z(-.6) + .9);
    model('pr/PR-009', cx - 3.0, 0, -8.6, .2); model('pr/PR-010', cx - 2.85, 0, -7.9, -.3); model('pr/PR-009', cx - 3.0, .2, -8.6, -.1); col(cx - 3.3, cx - 2.55, -8.9, -7.65, false, .4);
    // 동쪽 벽: 용지 카운터 + 재단기 + A4 용지 더미 3, 벽부 전기 제어함
    const kx = cx + 3.85 - .34, kz = Z(-.4);
    pr('PR-012', kx, kz, 0, -Math.PI / 2, [mWood, 1.84, .77, .66]); col(kx - .34, cx + 3.85, kz - .93, kz + .93, false, .77);
    model('pr/PR-006', kx - .02, .77, kz - .58, -Math.PI / 2); [.22, .56, .88].forEach((d, k) => model('pr/PR-011', kx, .77, kz + d, -Math.PI / 2 + k * .12));
    model('pr/PR-013', cx + 3.84, 1.25, -8.3, -Math.PI / 2);
    // 바닥 종이
    [[-1.1, -.4, 0], [.7, -.3, .4], [.2, 1.2, -.26]].forEach(([x, y, r]) => model('pr/PR-015', cx + x, .006, Z(y), r));
    papers(cx, -8, -2.4, 10);
  }
  // 창고 · 보관실
  function storeS(cx) {
    rackShelf(cx - 2.9, -6.0, 6.0, Math.PI / 2, .8, 2.1, .8); col(cx - 3.3, cx - 2.5, -9.0, -3.0);
    rackShelf(cx + 2.9, -6.0, 6.0, Math.PI / 2, .8, 2.1, .8); col(cx + 2.5, cx + 3.3, -9.0, -3.0);
    for (let k = 0; k < 4; k++) { const g = new THREE.Group(); g.position.set(cx + rr(-.6, .6), k * .78, -8.6); g.rotation.y = rr(-.2, .2); g.rotation.z = k % 2 ? Math.PI : 0; if (k % 2) g.position.y += .76; g.add(new THREE.Mesh(deskTopG, mWood), new THREE.Mesh(deskLegG, mMetal)); cur.interior.add(g); }
    col(cx - .8, cx + .8, -9.0, -8.2); [[-1.1, -6.8], [-.3, -6.9], [.6, -6.7], [1.2, -5.8]].forEach(([ox, z]) => add(mCardboard, .46, .38, .46, cx + ox, 0, z, { ry: rr(-.12, .12) }));
    model('cardboard_box_01', cx - .9, 0, -4.6, .2, { col: [.45, .55] }); model('cardboard_box_01', cx - .9, .34, -4.6, -.15); model('cardboard_box_01', cx - .3, 0, -4.2, .9, { col: [.5, .5] });
    papers(cx, -8, -2.4, 6);
  }
  // 보건실 보조 (침대 · 커튼 · 약품장)
  function sick(cx) {
    [-2.3, .2].forEach(dx => { add(mMetal, .95, .5, 2.0, cx + dx, 0, -8.3, { col: true }); add(mWhite, .9, .14, 1.9, cx + dx, .5, -8.3); add(mWhite, .5, .1, .35, cx + dx, .64, -9.0); curtain(cx + dx + 1.05, 1.3, -8.0, 1.8, 2.4, Math.PI / 2); });
    add(mLockerT, .9, 1.7, .4, cx + 3.55, 0, -6.4, { ry: Math.PI / 2, col: true }); add(mGlass, .9, 1.7, .44, cx + 3.55, 0, -6.4, { ry: Math.PI / 2 });
    meshAt(merge([bx(.4, .08, .45, 0, .04, 0), tube(.025, 0, .08, -.15, 0, 1.2, -.18)]), mWhite, cx + 3.2, 0, -3.0);
    model('wheelchair_01', cx - 1.2, 0, -4.2, 2.6, { col: [.85, 1.1] });
    papers(cx, -8, -2.4, 6);
  }
  // 교사 휴게실
  function staff(cx) {
    const zN = -9.6;
    sofa(cx - 2.2, -8.8, 0, 2.2); add(mWood, 1.2, .4, .6, cx - 2.2, 0, -7.6, { col: true }); cyl(mPorc, .05, .09, cx - 2.0, .4, -7.6, 10); cyl(mPorc, .05, .09, cx - 2.5, .4, -7.5, 10);
    add(mWood, 2.6, .9, .6, cx + 2.4, 0, zN + .35, { col: true }); add(S(null, { color: 0xd8d4c8, roughness: .5 }), .5, .3, .35, cx + 3.2, .9, zN + .35); cyl(mChrome, .08, .22, cx + 1.6, .9, zN + .35, 12);
    model('sf_water_cooler', cx + 3.5, 0, -7.6, -Math.PI / 2, { col: [.45, .45] }); glowAt(cx + 3.33, .92, -7.55, .11, glowRed); glowAt(cx + 3.33, .92, -7.65, .11, glowGreen); crt(cx + 2.1, .92, zN + .35, 0);
    for (let k = 0; k < 4; k++) add(mLockerT, .5, 1.8, .45, cx - 3.55, 0, -5.8 + k * .52, { ry: Math.PI / 2, col: true });
    tbl(mWood, 1.4, .74, .8, cx + .8, 0, -4.6, { col: true }); [-1, 1].forEach(s => deskChair(cx + .8 + s * .5, -3.8, Math.PI));
    noticeBoard(cx + 3.84, 1.6, -4.2, -Math.PI / 2, 1.4); papers(cx, -8, -2.4, 6);
    model('ceiling_fan', cx, CH - .52, -6.2, .3);
  }
  // 기록 보관실
  function archive(cx) {
    [-2.6, 0, 2.6].forEach(dx => { shelf3D(cx + dx, -6.6, Math.PI / 2, 4.6, 2.1, .6, 6, .9); });
    fileCabinet(cx - 3.5, -3.0, Math.PI / 2, true); fileCabinet(cx + 3.5, -3.0, -Math.PI / 2);
    scatterBooks(cx - 1.3, -3.2, 12); papers(cx, -8, -2.4, 12);
  }
  // 층 홀 (2 · 3층 남쪽 가운데): 벤치 · 진열장 · 게시판 · 자판기 · 화분 — 넓은 창이 있는 휴게 공간
  function hall(cx) {
    [-2.4, 2.4].forEach(dx => { meshAt(merge([bx(1.8, .05, .4, 0, .44, 0), bx(.06, .42, .35, -.8, .21, 0), bx(.06, .42, .35, .8, .21, 0)]), mWood, cx + dx, 0, -8.7); col(cx + dx - .9, cx + dx + .9, -8.9, -8.5); });
    trophyCase(cx - 3.55, -5.0, Math.PI / 2, 1.6); noticeBoard(cx + 3.84, 1.6, -5.0, -Math.PI / 2, 2.0);
    model('sf_vending', cx - 3.35, 0, -2.6, Math.PI / 2, { col: [.6, .95] }); glowAt(cx - 3.0, 1.15, -2.6, .9, glowGreen);
    potPlant(cx - 3.3, 0, -9.0, true); potPlant(cx + 3.3, 0, -9.0, false);
    [[-1.0, -6.0, .4], [0, -6.4, -.2], [1.0, -5.8, 2.6]].forEach(([dx, z, r]) => model('plastic_monobloc_chair_01', cx + dx, 0, z, r, { col: [.6, .6] }));
    model('standing_chalkboard_01', cx + 1.9, 0, -7.6, -.5, { col: [.9, .7] }); model('potted_plant_04', cx - 2.9, 0, -3.0, 0);
    papers(cx, -8, -2.4, 8);
  }
  // 열람실
  function reading(cx) {
    [-1.6, 1.6].forEach(dx => [-7.6, -5.0].forEach(z => { tbl(mWood, 2.0, .74, 1.0, cx + dx, 0, z, { col: true }); [-.55, .55].forEach(o => [-1, 1].forEach(s => deskChair(cx + dx + o, z + s * .8, s > 0 ? Math.PI : 0))); }));
    shelf3D(cx - 3.62, -4.0, Math.PI / 2, 2.4, 2.0, .4, 5, .85); shelf3D(cx + 3.62, -4.0, -Math.PI / 2, 2.4, 2.0, .4, 5, .85);
    scatterBooks(cx, -3.2, 8); papers(cx, -8, -2.4, 6);
  }
  // 시청각실 (계단식 좌석 · 큰 스크린 · 스피커)
  function av(cx) {
    const zN = -9.6;
    add(mBlack, 3.4, 1.9, .06, cx, .9, zN + .05); const sc = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.75), mScrOff); sc.position.set(cx, 1.85, zN + .09); cur.interior.add(sc);
    [-3.4, 3.4].forEach(dx => add(mBlack, .4, .7, .35, cx + dx, 1.8, zN + .25));
    for (let r = 0; r < 3; r++) { add(mStep, 7.6, .2 * r, 1.2, cx, 0, -6.6 + r * 1.3); for (let k = 0; k < 6; k++) deskChair(cx - 2.8 + k * 1.1, -6.4 + r * 1.3, Math.PI).position.y = .2 * r; }
    papers(cx, -8, -2.4, 6);
  }
  // 상담실
  function counselS(cx) {
    sofa(cx - 1.2, -8.6, 0, 2.0); add(mWood, 1.0, .4, .6, cx - 1.2, 0, -7.4, { col: true }); sofa(cx - 1.2, -6.2, Math.PI, 2.0);
    shelf3D(cx + 3.6, -6.0, -Math.PI / 2, 1.4, 2.0, .4, 5, .75);
    potPlant(cx + 3.3, 0, -9.0, false); cyl(S(null, { color: 0xc8a060, roughness: .6 }), .04, .2, cx - 1.0, .4, -7.4, 8);
    papers(cx, -8, -2.4, 5);
  }
  // 학생회실
  function student(cx) {
    const zN = -9.6;
    cyl(mWood, .9, .05, cx, .72, -6.0, 24); cyl(mMetal, .08, .72, cx, 0, -6.0, 8); col(cx - .9, cx + .9, -6.9, -5.1);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; deskChair(cx + Math.sin(a) * 1.35, -6.0 + Math.cos(a) * 1.35, a); }
    plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('제 32회 서문제 — 방송부 기념 방송', '#7a1a1a', '#f0e0c0', 20), roughness: .9, side: THREE.DoubleSide }), 3.4, .7, cx, 2.8, zN + .05);
    trophyCase(cx + 3.55, -7.6, -Math.PI / 2, 1.4); for (let k = 0; k < 4; k++) add(mCardboard, .5, .4, .4, cx - 3.2 + rr(-.2, .2), k % 2 ? .4 : 0, -8.6 + ((k / 2) | 0) * .6, { ry: rr(-.3, .3) });
    noticeBoard(cx - 3.84, 1.6, -5.0, Math.PI / 2, 1.8); papers(cx, -8, -2.4, 10);
  }
  // 3-2: 하늘의 교실 — 그해 겨울 창고가 되었다. 책상은 벽으로 밀려 쌓여 있고, 가운데 한 자리만 남았다
  function classroom32(cx) {
    const zN = -9.6;
    const mAlum08 = S(null, { color: 0xc4cad0, roughness: .32, metalness: .72 });
    const mACWhite = S(null, { color: 0xeeece6, roughness: .36 });
    frontWall(cx, zN, true, ['']); const bm = frontWall.last; boardRefs['cls' + cur.f + ':' + cx + (curSouth ? 's' : '')] = { mat: bm, floor: cur.f, cx, name: '3-2' };
    curtain(cx, 1.15, zN + .14, 3.8, 1.5);   // 칠판을 덮은 천
    // 2008년식 천장 시스템 에어컨 & 교단 단상
    add(mACWhite, .96, .07, .96, cx, CH - .07, -5.65);
    add(mDarkMetal, .62, .015, .62, cx, CH - .078, -5.65);
    add(mWoodDark, 3.4, .12, 1.10, cx, 0, zN + .62);
    add(mAlum08, 3.44, .03, .04, cx, .105, zN + 1.18);
    for (let k = 0; k < 10; k++) { const g = new THREE.Group(); const side = k < 5 ? -1 : 1, j = k % 5; g.position.set(cx + side * 3.3, ((j / 2) | 0) * .76, -8.6 + (j % 2) * .9 + (k > 6 ? 2 : 0)); g.rotation.y = Math.PI / 2 + rr(-.2, .2); if (j >= 2) { g.rotation.z = Math.PI; g.position.y += .76; } g.add(new THREE.Mesh(deskTopG, mWood), new THREE.Mesh(deskLegG, mMetal)); cur.interior.add(g); }
    col(cx - 3.85, cx - 2.9, -9.2, -5.4); col(cx + 2.9, cx + 3.85, -9.2, -5.4);
    // 가운데 남은 한 자리: 국화 · 이름표 · 먼지
    const g = new THREE.Group(); g.position.set(cx, 0, -5.6); g.add(new THREE.Mesh(deskTopG, mWood), new THREE.Mesh(deskLegG, mMetal)); cur.interior.add(g); col(cx - .36, cx + .36, -5.86, -5.34);
    deskChair(cx, -5.0, Math.PI);
    cyl(mGlass, .05, .22, cx + .15, .75, -5.65, 10); for (let k = 0; k < 3; k++) { meshAt(new THREE.SphereGeometry(.045, 8, 6), S(null, { color: 0xe8e4d0, roughness: .7 }), cx + .15 + rr(-.05, .05), .99 + rr(0, .06), -5.65 + rr(-.05, .05)); }
    plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('3-2 윤하늘', '#e8e4d8', '#2a2a2a', 30), roughness: .8 }), .2, .06, cx - .15, .757, -5.5, 0, -Math.PI / 2);
    graffiti('집에 가고 싶어', cx - 2.2, 1.6, -1.765, Math.PI, 2.0);
    for (let k = 0; k < 4; k++) add(mCardboard, rr(.4, .6), rr(.3, .5), rr(.4, .6), cx + rr(-2.4, 2.4), 0, -3.0 + rr(-.4, .3), { ry: rr(-.5, .5) });
    classClue(cx, '3-2'); papers(cx, -8, -2.4, 10);
  }
  // --- 별관 남쪽 방 ---
  const winsFar = cx => [-3.05, 3.05].forEach(dx => { win3D(cur.interior, 1.3, 1.45, cx + dx, 1.75, -9.58); radiator(cx + dx, -9.46, 0, 1.15); curtain(cx + dx - .78, 1.75, -9.48, .38, 1.85); });
  // 실습 · 과학 준비실: 약품장 · 개수대 · 유리기구 선반
  function prepS(cx) {
    winsFar(cx);
    add(mWhite, 3.0, .9, .65, cx - 1.6, 0, -9.2, { col: true }); add(mBlack, 3.0, .04, .65, cx - 1.6, .9, -9.2); [-2.6, -1.2].forEach(dx => meshAt(merge([bx(.5, .02, .4, 0, .0, 0), tube(.012, 0, 0, -.15, 0, .3, -.15), tube(.012, 0, .3, -.15, 0, .3, 0)]), mChrome, cx + dx, .92, -9.2));
    add(mLockerT, 1.0, 1.9, .45, cx + 3.5, 0, -7.5, { ry: -Math.PI / 2, col: true }); add(mGlass, 1.0, 1.9, .48, cx + 3.5, 0, -7.5, { ry: -Math.PI / 2 });
    shelf3D(cx + 3.6, -4.6, -Math.PI / 2, 1.8, 1.8, .4, 4, 0);
    for (let k = 0; k < 9; k++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(.04, .07, .18, 10), k % 3 ? mGlass : mLiquid); f.position.set(cx + 3.55, .25 + (k % 3) * .45, -5.2 + ((k / 3) | 0) * .5); cur.interior.add(f); }
    tbl(mWood, 1.6, .8, .8, cx - .4, 0, -5.4, { col: true, legMat: mLegMetal, shelf: true }); stool(cx - 1.4, -5.4); papers(cx, -8, -2.4, 6);
  }
  // 공구실: 작업대 · 타공판 공구 · 공구함 · 자재
  function tool(cx) {
    winsFar(cx);
    add(mWood, 3.2, .85, .8, cx - 1.6, 0, -9.1, { col: true }); add(mBlack, 3.2, 1.2, .03, cx - 1.6, 1.15, -9.57);
    for (let k = 0; k < 10; k++) add(mChrome, .03, rr(.18, .32), .02, cx - 3.0 + k * .3, 1.45 + rr(-.1, .1), -9.53);
    model('metal_tool_chest', cx + 2.8, 0, -9.15, 0, { col: [.7, .45] });
    rackShelf(cx + 3.4, -5.4, 3.0, Math.PI / 2, .7, 2.0, .7); col(cx + 3.0, cx + 3.8, -7.0, -3.8);
    for (let k = 0; k < 6; k++) add(mWood, rr(1.2, 2.2), .06, .12, cx - 2.6 + rr(-.3, .3), .02 + k * .06, -5.0 + rr(-.2, .2), { ry: rr(-.2, .2) });
    papers(cx, -8, -2.4, 6);
  }
  // 세척실: 개수대 줄 · 건조대 · 양동이
  function wash(cx) {
    winsFar(cx);
    for (let k = 0; k < 4; k++) { meshAt(merge([bx(.9, .18, .6, 0, .85, 0), bx(.12, .8, .12, 0, .4, 0)]), mPorc, cx - 2.7 + k * 1.2, 0, -9.2); meshAt(merge([tube(.012, 0, .95, -.2, 0, 1.1, -.2), tube(.012, 0, 1.1, -.2, 0, 1.1, -.05)]), mChrome, cx - 2.7 + k * 1.2, 0, -9.2); }
    col(cx - 3.2, cx + 1.2, -9.6, -8.9);
    meshAt(merge([...Array.from({ length: 4 }, (_, r) => bx(1.6, .02, .5, 0, .3 + r * .4, 0)), bx(.03, 1.8, .5, -.8, .9, 0), bx(.03, 1.8, .5, .8, .9, 0)]), mChrome, cx + 2.9, 0, -6.0, Math.PI / 2); col(cx + 2.6, cx + 3.2, -6.8, -5.2);
    mopBucket(cx - 2.8, -4.0); mopBucket(cx + 1.0, -3.2); wetSpot(cx - 1, -6.5, 1.1); papers(cx, -8, -2.4, 4);
  }
  // 디지털실습실: PC 두 줄
  function digital(cx) {
    winsFar(cx);
    // 책상 줄은 폭 5.4m 로 서쪽에 붙이고 동쪽에 1.6m 통로 (예전 6.4m 는 벽까지 0.65m 라 방 뒤쪽으로 걸어 들어갈 수 없었다)
    [-6.8, -4.6].forEach(z => { tbl(mWood, 5.4, .74, .7, cx - .5, 0, z, { col: true, legMat: mLegMetal }); for (let k = 0; k < 4; k++) { const x = cx - 2.6 + k * 1.4; monitor(x, .76, z - .14, 0, { cracked: rnd() < .2 }); keyboard(x, .76, z + .14, 0); officeChair(x, z + .68, Math.PI + rr(-.15, .15), false); } });
    termLed(cx + 1.95, .8, -6.95);
    papers(cx, -8, -2.4, 6);
  }
  // 작업실: 바이스가 달린 작업대 · 나무 부품 · 톱밥
  function work(cx) {
    winsFar(cx);
    [-2, 2].forEach(dx => [-7.4, -4.8].forEach(z => { tbl(mWood, 2.2, .85, 1.0, cx + dx, 0, z, { col: true, legMat: mLegMetal, shelf: true, leg: .07 }); add(mDarkMetal, .25, .18, .2, cx + dx - .9, .85, z - .35); for (let k = 0; k < 3; k++) add(mWood, rr(.3, .7), .04, rr(.1, .2), cx + dx + rr(-.6, .6), .87, z + rr(-.3, .3), { ry: rr(0, 3) }); }));
    wetSpot(cx, -6.1, .8); papers(cx, -8, -2.4, 10);
  }
  // 기자재실: 선반 위 영사기 · 삼각대 · 스피커 상자
  function equip(cx) {
    winsFar(cx);
    rackShelf(cx - 2.9, -6.0, 6.0, Math.PI / 2, .8, 2.1, .9); col(cx - 3.3, cx - 2.5, -9.0, -3.0);
    for (let k = 0; k < 3; k++) { const x = cx + 1.0 + k * .9; meshAt(merge([tube(.015, 0, 0, .25, 0, 1.4, 0), tube(.015, .22, 0, -.12, 0, 1.4, 0), tube(.015, -.22, 0, -.12, 0, 1.4, 0), bx(.3, .2, .25, 0, 1.5, 0)]), mDarkMetal, x, 0, -8.6, rnd()); }
    for (let k = 0; k < 4; k++) add(mBlack, .45, .6, .4, cx + 2.4 + (k % 2) * .5, ((k / 2) | 0) * .6, -4.4);
    papers(cx, -8, -2.4, 6);
  }
  // 전시 공간: 액자 작품 · 받침대 위 조형물 · 구겨진 포스터
  function gallery(cx) {
    const zN = -9.6;
    [-2.6, 0, 2.6].forEach((dx, k) => { const fr = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.25, .04), mWoodDark); fr.position.set(cx + dx, 1.7, zN + .03); cur.interior.add(fr); const pic = new THREE.Mesh(new THREE.PlaneGeometry(.88, 1.12), mPaints[(k + 1) % 4]); pic.position.set(cx + dx, 1.7, zN + .06); cur.interior.add(pic); });
    [-5.0, -6.8].forEach((z, k) => { const fr = new THREE.Mesh(new THREE.BoxGeometry(.04, .9, .7), mWoodDark); fr.position.set(cx + 3.84, 1.6, z); cur.interior.add(fr); const pic = new THREE.Mesh(new THREE.PlaneGeometry(.62, .82), mPaints[k * 3 % 4]); pic.position.set(cx + 3.81, 1.6, z); pic.rotation.y = -Math.PI / 2; cur.interior.add(pic); });
    [-1.6, 1.6].forEach(dx => { add(mWhite, .5, 1.0, .5, cx + dx, 0, -5.6, { col: true }); meshAt(new THREE.IcosahedronGeometry(.18, 0), mPorc, cx + dx, 1.2, -5.6, rnd()); });
    for (let k = 0; k < 4; k++) { const pp = new THREE.Mesh(new THREE.PlaneGeometry(.42, .6), mPaperN); pp.rotation.set(-Math.PI / 2, 0, rnd() * 6); pp.position.set(cx + rr(-3, 3), .015, rr(-8, -3)); pp.scale.y = rr(.6, 1); cur.interior.add(pp); }
    plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('제 20회 서문 미술 · 공예 전시', '#2a2016', '#d8c8a0', 22), roughness: .8 }), 3.0, .45, cx, 2.9, zN + .04);
    papers(cx, -8, -2.4, 4);
  }
  // 분실물 상자 (캠퍼스 PBR 모델의 lost_box 위치): 열린 상자 + 안에 든 보급품
  function lostBox(x, z, med = false) {
    add(mCardboard, .7, .42, .5, x, 0, z, { col: true }); add(mCardboard, .7, .02, .3, x, .5, z - .32, { ry: .0 });
    plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('분실물', '#d8cfa8', '#3a2a18', 30), roughness: .9 }), .4, .14, x, .26, z + .255);
    med ? addMedkit(x + .12, .43, z) : addBattery(x - .1, .43, z);
  }
  // 단말기 표시등 (terminal_indicator): 꺼진 PC 옆에서 혼자 깜빡이는 초록 불
  function termLed(x, y, z) {
    const l = dyn(new THREE.Mesh(new THREE.SphereGeometry(.025, 8, 6), new THREE.MeshBasicMaterial({ color: 0x30ff60 }))); l.position.set(x, y, z); cur.interior.add(l);
    const ph = rnd() * 3; l.onBeforeRender = () => l.material.color.setHex(Math.sin(performance.now() / 260 + ph) > .3 ? 0x40ff70 : 0x062a10);
  }
  // 별관 현관 (1F 남쪽 가운데): 바깥으로 나가는 문 · 신발장 · 안내판
  function lobbyA(cx) {
    const zN = -9.6;
    for (let k = 0; k < 3; k++) [-1, 1].forEach(s => meshAt(merge([...Array.from({ length: 5 }, (_, r) => bx(1.0, .02, .35, 0, .05 + r * .38, 0)), bx(.02, 1.6, .35, -.5, .8, 0), bx(.02, 1.6, .35, .5, .8, 0)]), mWood, cx + s * 3.6, 0, -8.4 + k * 1.05, s > 0 ? -Math.PI / 2 : Math.PI / 2));
    col(cx - 3.85, cx - 3.4, -9.0, -5.8); col(cx + 3.4, cx + 3.85, -9.0, -5.8);
    // 오픈 게이트 문틀 & 상단 현판 (southRoom 회전 시 world x = -0.85 ~ +2.45 구름다리 폭과 정확히 일치하도록 local x = -0.80 중심, 폭 3.30m 로 정렬!)
    [-2.45, 0.85].forEach(x => add(mWoodDark, .14, 2.65, .38, cx + x, 0, zN + .05));
    add(mWoodDark, 3.44, .14, .38, cx - .80, 2.65, zN + .05);
    plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign(cur.f === 8 ? '별관 1층 중앙 연결 홀 (본관 1F 직결)' : `별관 ${cur.f - 7}층 구름다리 연결 홀 (본관 ${cur.f - 7}F 직결)`, '#182c38', '#d8f0e8', 22), color: 0x9aa59a }), 2.3, .34, cx - .80, 2.82, zN + .22);
    noticeBoard(cx - 3.83, 1.6, -3.9, Math.PI / 2, 1.6); potPlant(cx + 3.45, 0, -5.4, true);
    papers(cx, -8, -2.4, 4);
  }
  const mWhiteP2 = S(null, { color: 0xd8d6cc, roughness: .5 });
  const SOUTH_FN = { class: (cx, n) => n === '3-2' ? classroom32(cx) : classroom(cx, n), principal, meeting, lobby, print, storeS, sick, toilet, staff, archive, hall, reading, av, counsel, counselS, student, prepS, tool, wash, digital, work, equip, gallery, lobbyA, club, nurse, library, cooking, tech, fusion, computer, lang, smart, lab, music, art, craft };

  /* ---------- 층 빌드 ---------- */
  const mDeskSign = {};
  function buildFloor(f, o = {}) {
    curWall = o.basement ? mBase : mWall;
    const F = { f, y0: o.y0 ?? f * FH, basement: !!o.basement, interior: new THREE.Group(), shell: new THREE.Group(), col: [], walls: [], lamps: [], nodes: [], edges: [] };
    F.interior.position.y = F.y0; F.shell.position.y = F.y0;
    scene.add(F.interior, F.shell); floors.push(F); cur = F;
    const LS = !o.basement && LAYOUT_S[f];   // 남쪽 방 줄
    const Z0 = -9.9, Z1 = LS ? MAIN_ZS : 1.75, X0 = -36.3, X1 = 36.3;
    const lay = o.lay || LAYOUT[f];

    // 바닥/천장
    flat(F.interior, mFloorTile, X0, X1, -1.75, 1.75, 0);
    if (LS) SLOTS.forEach((cx, i) => { const t = LS.types[i]; flat(F.interior, ['class', 'principal', 'meeting', 'staff', 'reading', 'counselS', 'student', 'av', 'nurse'].includes(t) ? mFloorWood : mFloorTile, cx - 4, cx + 4, 1.75, 9.6, 0); });
    ceilHole(F.interior, X0, X1, Z0, Z1, 0);
    SLOTS.forEach((cx, i) => {
      const t = lay.types[i];
      const wood = ['class', 'office', 'library', 'music', 'art', 'counsel', 'nurse'].includes(t);
      if (t !== 'stair') flat(F.interior, wood ? mFloorWood : mFloorTile, cx - 4, cx + 4, -9.6, -1.75, 0);   // 계단실 바닥은 stairRoom 이 (아래층 계단 개구부를 비우고) 깐다
    });

    // 외벽(shell): 북벽도 창문 · 통로 문 자리를 실제로 뚫어 안에서 밖이 보이고 밖에서 안이 보이게 한다
    if (o.basement) wallSeg(X0, X1, Z0, -9.6, 0, FH, true);
    else {
      const nOps = [];
      SLOTS.forEach((cx, i) => {
        const t = lay.types[i];
        if (t === 'toilet' || t === 'broadcast') return;
        if (t === 'stair') {
          if (f <= 2) nOps.push({ x: cx + .8, w: 1.5, y0: 0, y1: 2.45, door: true });
          else nOps.push({ x: cx + 1.0, w: 1.7, y0: 1.0, y1: 2.8 });
        } else if (t === 'cooking') nOps.push({ x: cx - 3.05, w: 1.3, y0: 1.02, y1: 2.48 });
        else nOps.push({ x: cx - 3.05, w: 1.3, y0: 1.02, y1: 2.48 }, { x: cx + 3.05, w: 1.3, y0: 1.02, y1: 2.48 });
      });
      nOps.sort((a, b) => a.x - b.x);
      let curN = X0;
      for (const nw of nOps) {
        const na = nw.x - nw.w / 2, nb = nw.x + nw.w / 2;
        if (na > curN) wallSeg(curN, na, Z0, -9.6, 0, FH, true);
        if (nw.y0 > 0) wallSeg(na, nb, Z0, -9.6, 0, nw.y0, true);
        if (nw.y1 < FH) wallSeg(na, nb, Z0, -9.6, nw.y1, FH, true);
        if (!nw.door) {
          win3D(F.shell, nw.w, nw.y1 - nw.y0, nw.x, (nw.y0 + nw.y1) / 2, Z0 + .12, 0, pickWin());
          add(mWoodDark, nw.w + .2, .06, .3, nw.x, nw.y0 - .02, Z0 + .15, { parent: F.shell });
          (F.winSlots ||= []).push([nw.x, nw.w, -9.6, (nw.y0 + nw.y1) / 2, nw.y1 - nw.y0]);
        }
        curN = nb;
      }
      if (curN < X1) wallSeg(curN, X1, Z0, -9.6, 0, FH, true);
    }
    wallSeg(X0, -36, Z0, Z1, 0, FH, true);        // 서
    wallSeg(36, X1, Z0, Z1, 0, FH, true);         // 동
    // 남쪽 벽: 창문 + 현관
    const wins = [];
    if (LS) SLOTS.forEach(cx => { if (f === 0 && cx === 0) return; wins.push(cx - 3.05, cx + 3.05); });
    else for (let x = -34; x <= 34; x += 4) { if (o.basement || (f === 0 && Math.abs(x) < 3)) continue; wins.push(x); }
    const ops = wins.map(x => ({ x, w: LS ? 1.3 : 2.4, type: 'win' }));
    if (f === 0) ops.push({ x: 0, w: 3.0, type: 'door' });
    ops.sort((a, b) => a.x - b.x);
    let cursor = -36;
    const zs0 = Z1 - .3, zs1 = Z1;
    for (const o of ops) {
      const a = o.x - o.w / 2, b = o.x + o.w / 2;
      if (a > cursor) wallSeg(cursor, a, zs0, zs1, 0, FH, true);
      if (o.type === 'win') {
        wallSeg(a, b, zs0, zs1, 0, .9, true); wallSeg(a, b, zs0, zs1, 2.5, FH, true);
        win3D(F.shell, o.w, 1.6, o.x, 1.7, zs0 + .15, Math.PI, pickWin()); (F.winSlots ||= []).push([o.x, o.w, zs0]);
        if (!o.base && !LS) { const r = new THREE.Mesh(radG, mRad); r.position.set(o.x, 0, zs0 - .12); r.rotation.y = Math.PI; r.scale.x = 1.6; F.interior.add(r); }
        /* 남쪽 외벽 중복 나무 창턱 제거 (콘크리트 창턱 및 win3D 기본 창턱과 겹침 방지) */
      } else {
        wallSeg(a, b, zs0, zs1, 2.7, FH, true);
        add(mWoodDark, .12, 2.7, .4, a, 0, zs0 + .15, { parent: F.shell }); add(mWoodDark, .12, 2.7, .4, b, 0, zs0 + .15, { parent: F.shell });
        // 현관 유리문 두 짝: 알루미늄 프레임 + 투명 강화유리 + 스테인리스 패닉바 (schoolDoors.js 가 sf_entrance_door 3D 모델로 한 번 더 업그레이드)
        { const zD = zs0 + .25, frG = merge([bx(1.48, .09, .06, 0, 2.355, 0), bx(1.48, .14, .06, 0, .07, 0), bx(1.48, .07, .06, 0, 1.05, 0), bx(.08, 2.4, .06, -.70, 1.2, 0), bx(.08, 2.4, .06, .70, 1.2, 0)]), barG = merge([bx(1.18, .045, .09, 0, 1.05, 0), bx(.04, .28, .11, .56, 1.18, 0)]); const leaves = [[a, -1], [b, 1]].map(([hx, s]) => { const piv = dyn(new THREE.Group()); piv.position.set(hx, 0, zD); const dg = new THREE.Mesh(new THREE.BoxGeometry(1.48, 2.4, .02), mWinIn); dg.position.set(-s * .74, 1.2, 0); piv.add(dg); const fm = new THREE.Mesh(frG, mDarkMetal); fm.position.set(-s * .74, 0, 0); piv.add(fm); const bm = new THREE.Mesh(barG, mChrome); bm.position.set(-s * .74, 0, 0); bm.scale.x = -s; piv.add(bm); F.shell.add(piv); return { piv, a: s * 1.3 }; });           const rect = { x1: a, x2: b, z1: zD - .04, z2: zD + .04, off: false };           doorList.push({ kind: 'hinge', floor: F.f ?? f, x: 0, z: zD, open: 0, target: 0, leaves, rect, name: '현관문' }); F.col.push(rect); (F.doorWalls ||= []).push(rect); }
      }
      cursor = b;
    }
    if (cursor < 36.3) wallSeg(cursor, 36.3, zs0, zs1, 0, FH, true);
    // 층간 콘크리트 띠 + 바깥 창턱
    if (!o.basement && f < 2) F.shell.add(boxMesh(-36.6, 36.6, FH - .14, FH + .14, zs1, zs1 + .2, mFacade, 3));
    if (!o.basement) wins.forEach(x => F.shell.add(boxMesh(x - (LS ? .8 : 1.35), x + (LS ? .8 : 1.35), .82, .9, zs1, zs1 + .17, mFacade, 3))); if (!o.basement && F.winSlots && F.winSlots.length) F.shell.add(F.winFake = buildWindowFakes(F.winSlots, f));   // 멀리서 보이는 창 너머 교실 (실내가 꺼져 있을 때만)
    if (f === 0) {   // 현관: 계단 + 캐노피 + 기둥 + 교명 간판
      F.shell.add(boxMesh(-3.2, 3.2, 0, .06, zs1, zs1 + 1.65, mStep, 2)); F.shell.add(boxMesh(-3.25, 3.25, 0, .03, zs1 + 1.65, zs1 + 1.8, mStep, 2)); col(-3.2, 3.2, zs1, zs1 + 1.8, false, .06);   // 현관 앞 포치: 실내 바닥과 바깥 광장이 같은 높이라 계단 없이 얕은 판 하나 (예전 3단은 문 앞에서 올라갔다 내려가는 단차가 생겼다)   // 걸어 오르는 현관 계단 (한 단 0.12m)
      F.shell.add(boxMesh(-1.5, 1.5, 0, .06, zs0, zs1, mStep, 2));   // 현관 문턱 (충돌은 아래 '충돌 보정' 뒤에)
      F.shell.add(boxMesh(-3.0, 3.0, 2.95, 3.2, zs1, zs1 + 2.85, mCanopy, 3)); F.shell.add(boxMesh(-3.05, 3.05, 3.02, 3.18, zs1 + 2.85, zs1 + 2.94, mFacadeTrim, 3)); for (let k = 0; k < 6; k++) F.shell.add(boxMesh(-2.8, 2.8, 2.91, 2.95, zs1 + .22 + k * .45, zs1 + .29 + k * .45, mCanopy, 3));
      [-2.6, 2.6].forEach(x => F.shell.add(boxMesh(x - .18, x + .18, 0, 2.95, zs1 + 2.3, zs1 + 2.66, mFacadeTrim, 3)));
      // campusDesign owns the school sign.
    }
    // 충돌 보정: 창문 구간도 벽이므로 단일 충돌체로 대체 (현관 제외)
    F.col = F.col.filter(r => !(r.z1 === zs0 && r.z2 === zs1) && !(r.z1 === Z0 && r.z2 === -9.6));
    F.walls = F.walls.filter(r => !(r.z1 === zs0 && r.z2 === zs1) && !(r.z1 === Z0 && r.z2 === -9.6));
    if (f <= 2 && !o.basement) { col(X0, .05, Z0, -9.6, true); col(1.55, X1, Z0, -9.6, true); } else col(X0, X1, Z0, -9.6, true);
    if (f === 0) { col(-36.3, -1.5, zs0, zs1, true); col(1.5, 36.3, zs0, zs1, true); col(-1.5, 1.5, zs0, zs1, false, .06); }   // 현관 문턱: 실내 바닥 0 ↔ 계단 꼭대기 0.36 사이 한 단 (걸어서 넘는다)
    else col(-36.3, 36.3, zs0, zs1, true);

    // 지붕 / 시계탑
    if (f === 2) {
      F.shell.add(boxMesh(X0 - .3, X1 + .3, FH, FH + .4, Z0 - .3, Z1 + .3, mFacade, 3));
      F.shell.add(boxMesh(X0 - .3, X1 + .3, FH + .4, FH + 1.0, Z1, Z1 + .2, mFacade, 3));
      F.shell.add(boxMesh(-5, 5, FH, FH + 3.2, -4.5, 1.9, mFacade, 3));
      F.shell.add(boxMesh(-5.4, 5.4, FH + 3.2, FH + 3.6, -4.9, 2.3, mFacade, 3));
      const cm = new THREE.MeshStandardMaterial({ map: T.makeClock(), roughness: .8, emissive: 0x151410 });
      plane(F.shell, cm, 2.0, 2.0, 0, FH + 1.8, 1.93);
    }

    // 복도 북벽(교실 문)
    SLOTS.forEach((cx, i) => {
      wallSeg(cx - 4, cx - 1, -1.75, -1.45, 0, CH);
      wallSeg(cx + 1, cx + 4, -1.75, -1.45, 0, CH);
      wallSeg(cx - 1, cx + 1, -1.75, -1.45, 2.4, CH);
      // 문틀 & 문짝
      add(mWoodDark, .1, 2.4, .36, cx - 1.0, 0, -1.6); add(mWoodDark, .1, 2.4, .36, cx + 1.0, 0, -1.6);
      if (lay.types[i] !== 'stair') slidingDoors(cx).rt = lay.types[i];
      // 교실 명패
      const sg = new THREE.MeshBasicMaterial({ map: T.makeSign(lay.names[i], '#1e2a2e', '#d9e4d0', lay.names[i].length > 3 ? 28 : 36), color: 0x9aa59a });
      plane(F.interior, sg, 1.0, .25, cx, 2.62, -1.43);
    });
    for (const b of [-28, -20, -12, -4, 4, 12, 20, 28]) { if (f === 2 && b === -28) continue; wallSeg(b - .15, b + .15, -9.6, -1.75, 0, CH); }
    // 복도 남벽 + 남쪽 방 (현관 · 홀은 넓은 개구부)
    if (LS) {
      SLOTS.forEach((cx, i) => {
        const t = LS.types[i], open = t === 'lobby' || t === 'hall';
        if (open) { wallSeg(cx - 4, cx - 3, 1.45, 1.75, 0, CH); wallSeg(cx + 3, cx + 4, 1.45, 1.75, 0, CH); wallSeg(cx - 3, cx + 3, 1.45, 1.75, 2.7, CH); [-3, 3].forEach(dx => add(mWoodDark, .12, 2.7, .36, cx + dx, 0, 1.6)); }
        else {
          wallSeg(cx - 4, cx - 1, 1.45, 1.75, 0, CH); wallSeg(cx + 1, cx + 4, 1.45, 1.75, 0, CH); wallSeg(cx - 1, cx + 1, 1.45, 1.75, 2.4, CH);
          add(mWoodDark, .1, 2.4, .36, cx - 1.0, 0, 1.6); add(mWoodDark, .1, 2.4, .36, cx + 1.0, 0, 1.6); slidingDoorsS(cx).rt = t;
        }
        const sg = new THREE.MeshBasicMaterial({ map: T.makeSign(LS.names[i], '#1e2a2e', '#d9e4d0', LS.names[i].length > 3 ? 28 : 36), color: 0x9aa59a });
        plane(F.interior, sg, 1.0, .25, cx, 2.62, 1.43, Math.PI);
      });
      for (const b of [-28, -20, -12, -4, 4, 12, 20, 28]) wallSeg(b - .15, b + .15, 1.75, 9.6, 0, CH);
    }

    // 방별 가구
    SLOTS.forEach((cx, i) => {
      const t = lay.types[i];
      roomObj(t, cx);
      ({ class: classroom, office, nurse, counsel, library, lab, computer, music, art, toilet, stair: stairRoom, cooking, craft, broadcast, boiler, electric, storage, records, cleaning, generator, pump, exit: exitRoom, reading, smart, student, archive, club, av, print, counselS })[t](cx, lay.names[i]);
    });
    if (LS) SLOTS.forEach((cx, i) => southRoom(cx, () => { SOUTH_FN[LS.types[i]](cx, LS.names[i]); roomObj(LS.types[i], cx); }));
    if (f === 2) addMedkit(SLOTS[3] + 2.6, .77, -8.6);
    if (f === 1) addMedkit(SLOTS[1] + 2.6, .77, -8.6);
    if (f === 0) { framed('map_aerial', 2.2, 1.2, -2.6, 1.75, -1.42); framed('map_floors', 1.6, 1.17, 2.6, 1.75, -1.42); }
    if (f === 2) plane(F.interior, mCork, 1.6, .9, SLOTS[1] - 2.6, 1.75, -1.42);
    if (f === 0) addNote('n1', SLOTS[5] + 2.6, .77, -8.6, 0.3);

    // 조명 (형광등) — 복도 + 각 방
    const addLamp = (x, z, ang, room = null) => {
      // 방 형광등은 스위치로 켜고 끈다: 고장(dead)은 드물게, 깜빡임은 일부만
      const r = rnd(); const kind = room ? (r < .62 ? 'on' : r < .85 ? 'flick' : 'dead') : (r < .5 ? 'on' : r < .78 ? 'flick' : 'dead');
      const m = kind === 'on' ? matLampOn : kind === 'dead' ? matLampDead : flickerMats[(rnd() * 4) | 0];
      const tube = dyn(new THREE.Mesh(new THREE.BoxGeometry(1.3, .05, .12), m)); tube.position.set(x, CH - .1, z); tube.rotation.y = ang; F.interior.add(tube);
      const hs = new THREE.Mesh(new THREE.BoxGeometry(1.4, .04, .22), lampHousing); hs.position.set(x, CH - .04, z); hs.rotation.y = ang; F.interior.add(hs);
      if (kind === 'dead' && rnd() < .4) { tube.rotation.x = rr(.5, .9); tube.position.y = CH - .45; meshAt(tube_(x - .5, CH - .05, z, x - .5, CH - .5, z), mBlack, 0, 0, 0); (F.sparks ||= []).push({ x: x - .5, y: CH - .5, z }); }
      F.lamps.push({ x, y: F.y0 + CH - .5, z, kind, mat: m, mesh: tube, room });
    };
    for (let x = -28; x <= 28; x += 8) addLamp(x + 4 * 0, 0, 0);
    addLamp(-34, 0, 0); addLamp(34, 0, 0);
    // 현관 근처 1F 램프는 반드시 켜짐
    SLOTS.forEach((cx, i) => { const rk = `${f}:${cx}`; if (lay.types[i] !== 'stair') addLamp(cx - 2, -5.6, 0, rk); addLamp(cx + (lay.types[i]==='stair'?.9:2), -5.6, 0, rk); lightSwitch(cx + 1.4, -1.78, Math.PI, rk, lay.names[i]); });
    if (LS) SLOTS.forEach((cx, i) => { const rk = `${f}:${cx}s`, open = ['lobby', 'hall'].includes(LS.types[i]); addLamp(cx - 2, 5.6, 0, rk); addLamp(cx + 2, 5.6, 0, rk); lightSwitch(cx + (open ? -3.25 : -1.4), 1.78, 0, rk, LS.names[i]); });
    if (f === 0) { const a = F.lamps.find(l => Math.abs(l.x) < 5 && Math.abs(l.z) < .1); if (a) { a.kind = 'on'; a.mat = matLampOn; } }

    // 복도 디테일: 배관, 천장 손상, 비상구, 소화기, 낙서
    corridorPipes(-36, 36);
    [-30, -10, 10, 30].forEach(x => emergLight(x + 2.2, 2.85, -1.44));
    // 복도 실사 소품: 소화기 · 화재 경보기 · 감시 카메라 · 분리수거함 · 끝 쪽에 쌓인 책걸상
    if (o.basement) { [[-20.2, 'BSM-003'], [3.8, 'BSM-003'], [-28.2, 'BSM-004'], [27.8, 'BSM-004']].forEach(([x, id]) => model('h133/' + id, x, 0, -1.32, 0, { col: [.56, .42] }));   // 복도 벽 배관 · 밸브 (문틀과 겹치지 않는 기둥 사이 벽)
      model('portable_generator', 20.5, 0, 1.0, 0, { col: [.85, .6] }); model('power_box_01', -12.8, 1.0, -1.44, 0); model('power_box_01', 6.8, 1.0, -1.44, 0); }
    if (LS) [-32, -8, 16].forEach(cx => model('korean_fire_extinguisher_01', cx + 3.3, 0, 1.36, Math.PI));
    else [-28.8, -11.2, 12.8].forEach(x => model('korean_fire_extinguisher_01', x, 0, -1.3, 0));
    [-24, 0, 24].forEach(cx => model('fire_alarm', cx + 3.2, 1.45, -1.44, 0)); [-16, 16].forEach(cx => { model('sf_fuse_box', cx - 3.1, 1.32, -1.42, 0); glowAt(cx - 3.0, 1.68, -1.32, .09, glowGreen); });
    if (!o.basement) for (let x = -33; x <= 33; x += 6) model('h133/SAF-005', x + 1.5, CH - .29, .35, 0);   // 복도 천장 스프링클러 헤드 (SAF-005)
    // Imported corridor camera duplicates removed: mounted cameras below provide actual feeds.
    model('metal_trash_can', 35.82, 0, 0, -Math.PI / 2, { col: [.52, .38] });
    if (f <= 2) model('WetFloorSign_01', -30.0, 0, -.55, .5);
    model('SchoolDesk_01', -35.55, 0, .95, Math.PI / 2, { col: [.55, .45] }); model('SchoolDesk_01', -35.55, 0, -.98, Math.PI / 2, { col: [.55, .45] });
    ceilingDamage(-34, 34, -1.2, 1.2, 9); SLOTS.forEach(cx => { if (rnd() < .5) ceilingDamage(cx - 3, cx + 3, -8.5, -2.5, 1); });
    exitSign(0, 2.95, -1.43); exitSign(-35, 2.9, 0, Math.PI / 2); exitSign(35, 2.9, 0, -Math.PI / 2);
    extinguisher(-1.6, -1.25); extinguisher(33.5, 1.2);
    graffiti(pick(['다시, 여기서', '나가지 마', '뒤를 봐', '같이 놀자']), SLOTS[2] + 2.5, 1.6, -1.44, 0, 2.6);
    [-26, 6, 22].forEach(x => bin(x, 1.15));
    if (!o.basement || f === 4) { alarmBell(-12.5, -1.43, 0); cctv(-35.6, CH, -1.2, 0, {target:[0,1.5,0],label:AREA_NAMES[f]+' · 복도 서쪽'}); cctv(35.6, CH, -1.2, 0, {target:[0,1.5,0],label:AREA_NAMES[f]+' · 복도 동쪽'}); }
    if (f === 0) { addPhoto('p1', SLOTS[6] + 2.6, .76, -8.7, .2); blood('drag', -3, .015, -.4, 1.8, 1.5, true); }
    if (f === 2) { addPhoto('p3', 20, 0, .8, .8); blood('hand', SLOTS[3] + 1.6, 1.4, -1.44, .8, 0); }
    if (f === 4) { blood('drag', 10, .015, .2, 2, 1.57, true); blood('splat', -20, .015, -.5, 1.4, 0, true); }
    // 사물함(숨는 곳)
    const lockSlots = [1, 3, 6, 8];
    lockSlots.forEach(i => {
      const cx = SLOTS[i];
      for (let k = 0; k < 3; k++) {
        add(mLockerT, .62, 1.85, .5, cx + 2.35 + k * .66, 0, -1.2, { col: true });
        const lx = cx + 2.35 + k * .66;
        const sl = plane(F.interior, new THREE.MeshBasicMaterial({ color: 0x0a0a0a }), .06, .35, lx + .12, 1.35, -.94); if (sl) { sl.userData.dynamic = true; LOCKER_BOXES.push({ slot: sl, f, x: lx }); }
      }
      lockers.push({ floor: f, x: cx + 3.01, z: -1.2, y: F.y0, dir: { x: 0, z: 1 } });
    });

    // 복도 잡동사니
    for (let k = 0; k < 40; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(.28, .2), mDirtPaper);
      m.rotation.set(-Math.PI / 2, 0, rnd() * 6.28); m.position.set(rr(-34, 34), .012, rr(-1.2, 1.3)); F.interior.add(m);
    }
    /* 복도 바닥에 깨진 블록처럼 놓여 있던 벽체 파편 7개 제거 */

    // 그래프 노드(유령 경로): 복도 노드는 교실 문 정면(슬롯 x)에 맞춘다.
    const nid = (x, z) => { F.nodes.push({ x, z }); return F.nodes.length - 1; };
    const xs = new Set(SLOTS); for (let x = -34; x <= 34; x += 4) xs.add(x);
    const arr = [...xs].sort((p, q) => p - q);
    const cn = arr.map(x => nid(x, 0));
    for (let i = 0; i < cn.length - 1; i++) F.edges.push([cn[i], cn[i + 1]]);
    const rNodes = {}; SLOTS.forEach(cx => { const r = nid(cx, -5.5); rNodes[cx] = r; F.edges.push([cn[arr.indexOf(cx)], r]); }); if (f === 2 && rNodes[-32] != null && rNodes[-24] != null) F.edges.push([rNodes[-32], rNodes[-24]]);
    if (LS) SLOTS.forEach((cx, i) => { if (f === 0 && LS.types[i] === 'lobby') return; const r = nid(cx, 5.2); F.edges.push([cn[arr.indexOf(cx)], r]); });
    if (f === 0) { const e = nid(0, LS ? 6.5 : 3.6); F.edges.push([cn[arr.indexOf(0)], e]); F.entrance = e; }
    F.adj = F.nodes.map(() => []);
    F.edges.forEach(([p, q]) => { F.adj[p].push(q); F.adj[q].push(p); });
    return F;
  }
  for (let f = 0; f < 3; f++) buildFloor(f);


  /* ---------- 옥상 (floor 3) ---------- */
  {
    const R = { f: 3, y0: ROOF_Y, interior: new THREE.Group(), shell: new THREE.Group(), col: [], walls: [], lamps: [], nodes: [], edges: [], adj: [] };
    R.interior.position.y = ROOF_Y; scene.add(R.interior); floors.push(R); cur = R;
    const X0 = -36.3, X1 = 36.3, Z0 = -9.9, Z1 = MAIN_ZS;
    flat(R.interior, mFloorTile, X0, X1, Z0, Z1, .01, 4);
    const rw = (a, b, c, d, h) => { R.interior.add(boxMesh(a, b, 0, h, c, d, mWall)); col(a, b, c, d, true); };
    rw(X0 - .3, X1 + .3, Z0 - .3, Z0, 1.15); rw(X0 - .3, X0, Z0, Z1 + .3, 1.15); rw(X1, X1 + .3, Z0, Z1 + .3, 1.15); rw(X0, X1, Z1, Z1 + .3, 1.15);
    col(X0 - 2, X1 + 2, Z0 - 2, Z0 - .3); col(X0 - 2, X0 - .3, Z0, Z1 + 2); col(X1 + .3, X1 + 2, Z0, Z1 + 2); col(X0, X1, Z1 + .3, Z1 + 2);
    // 철망 난간
    const rails = [], post = new THREE.BoxGeometry(.04, 1.2, .04); post.translate(0, 1.75, 0);
    for (let x = X0; x <= X1; x += 1.2) { rails.push(MX(x, 0, Z0 - .15), MX(x, 0, Z1 + .15)); }
    for (let z = Z0; z <= Z1; z += 1.2) { rails.push(MX(X0 - .15, 0, z), MX(X1 + .15, 0, z)); }
    inst(R.interior, post, mRust, rails);
    add(mRust, X1 - X0, .05, .05, 0, 2.3, Z0 - .15); add(mRust, X1 - X0, .05, .05, 0, 2.3, Z1 + .15);
    // 계단실(탑) 출입문
    col(-5, 5, -4.5, 1.9, true);
    plane(R.interior, mDoor, 1.3, 2.3, 0, 1.15, -4.52, Math.PI);
    add(mWoodDark, 1.5, .15, .2, 0, 2.3, -4.6);
    // 물탱크
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.2, 14), mRust); tank.position.set(-20, 2.2, -6); R.interior.add(tank);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => add(mMetal, .15, 1.1, .15, -20 + a * 1.1, 0, -6 + b * 1.1));
    col(-21.6, -18.4, -7.6, -4.4);
    // 안테나
    add(mMetal, .16, 9, .16, 22, 0, -6, { col: true }); add(mMetal, 2.4, .08, .08, 22, 7.5, -6); add(mMetal, 1.8, .08, .08, 22, 8.4, -6); add(mMetal, .08, .08, 2.0, 22, 6.8, -6);
    // 관리실(창고)
    rw(26, 33, -9.4, -5.4, 2.7); plane(R.interior, mDoor, 1.2, 2.2, 29, 1.1, -5.38, 0);
    add(mWall, 7.4, .3, 4.4, 29.5, 2.7, -7.4);
    // 상자/에어컨 실외기
    [[-14, -3], [8, -8], [-30, -6]].forEach(([x, z]) => add(mWood, 1, .8, 1, x, 0, z, { col: true, ry: rnd() }));
    [[14, -8.6], [-8, -8.6]].forEach(([x, z]) => model('exterior_aircon_unit', x, 0, z, 0, { col: [1.8, .4] }));
    // 남쪽 옥상 (맵 통합 설계집 RF): 태양광 패널 · 환기 설비 · 통신 장비함(경고등) · 휴게 벤치 · 옥상 배관
    const mSolar = S(null, { color: 0x1c2c48, roughness: .18, metalness: .55 }), mCell = new THREE.MeshBasicMaterial({ color: 0x7a90b0, transparent: true, opacity: .25 });
    [[-6, 3.4], [6, 3.4], [-6, 5.0], [6, 5.0]].forEach(([x, z]) => {
      meshAt(merge([bx(3.6, .05, .3, 0, .78, .35), bx(3.6, .05, .3, 0, 1.2, -.35), bx(.06, .9, .06, -1.7, .45, .35), bx(.06, .9, .06, 1.7, .45, .35), bx(.06, .55, .06, -1.7, .27, -.35), bx(.06, .55, .06, 1.7, .27, -.35)]), mMetal, x, 0, z);
      const pn = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 1.05), mSolar); pn.rotation.x = -Math.PI / 2 + .45; pn.position.set(x, .99, z); R.interior.add(pn);
      for (let q = 1; q < 6; q++) { const ln = new THREE.Mesh(new THREE.PlaneGeometry(.015, 1.0), mCell); ln.rotation.x = -Math.PI / 2 + .45; ln.position.set(x - 1.75 + q * .583, 1.0, z); R.interior.add(ln); }
      col(x - 1.8, x + 1.8, z - .5, z + .5);
    });
    [[-27, 8.7], [27, 8.7], [-20, 8.7]].forEach(([x, z]) => {
      add(mMetal, 1.8, 1.3, 1.1, x, 0, z, { col: true });
      const fan = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .06, 16), mDarkMetal); fan.position.set(x - .4, 1.33, z); R.interior.add(fan);
      const fan2 = fan.clone(); fan2.position.x = x + .4; R.interior.add(fan2);
      add(mRust, .25, .25, 1.6, x, .9, z - 1.3);
    });
    // 통신 장비함 + 깜빡이는 경고등
    add(mDarkMetal, 1.0, 1.6, .6, 33.6, 0, 4.2, { col: true }); add(mMetal, .9, .02, .02, 33.6, 1.2, 3.88);
    plane(R.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('⚠ 고압 · 통신', '#d8b020', '#1a1a1a', 22), roughness: .7 }), .7, .22, 33.6, 1.35, 3.89, Math.PI);
    { const wl = dyn(new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2020 }))); wl.position.set(33.6, 1.7, 4.2); R.interior.add(wl);
      wl.onBeforeRender = () => wl.material.color.setHex(((performance.now() / 700) | 0) % 2 ? 0xff2a1a : 0x2a0604); }
    // 휴게 벤치 · 재떨이 · 화분
    [[-12, 9.15], [-3, 9.15], [12, 9.15]].forEach(([x, z]) => {
      meshAt(merge([bx(1.8, .06, .45, 0, .45, 0), bx(1.8, .4, .05, 0, .7, .2), bx(.06, .45, .4, -.8, .22, 0), bx(.06, .45, .4, .8, .22, 0)]), mWood, x, 0, z, Math.PI); col(x - .9, x + .9, z - .25, z + .25);
    });
    cyl(mMetal, .18, .7, -7.4, 0, 9.3); potPlant(-1, 0, 9.3, true); potPlant(14.2, 0, 9.3, false);
    // 옥상 배관 (바닥을 따라 남쪽 난간 앞으로)
    add(mRust, 64, .14, .14, 0, .25, 9.68); add(mMetal, 64, .1, .1, 0, .5, 9.72);
    for (let x = -30; x <= 30; x += 6) add(mMetal, .1, .26, .3, x, 0, 9.7);
    add(mRust, .14, .14, 5.2, 33.0, .25, 7.1);
    addNote('n7', -14, .82, -3);
    addBattery(-20, 0, -3.6); addMedkit(-30, .82, -6);
    papers(0, -9, 1, 14, 34);
    // 유령 경로 노드
    const nid = (x, z) => { R.nodes.push({ x, z }); return R.nodes.length - 1; };
    const A = [], B = {};
    for (let x = -30; x <= 30; x += 6) A.push(nid(x, -7));
    for (let i = 0; i < A.length - 1; i++) R.edges.push([A[i], A[i + 1]]);
    let prevB = null;
    for (let x = -30; x <= 30; x += 6) { if (Math.abs(x) >= 12) { B[x] = nid(x, 0); } }
    const bx2 = Object.keys(B).map(Number).sort((a, b) => a - b);
    for (let i = 0; i < bx2.length - 1; i++) if (Math.abs(bx2[i + 1] - bx2[i]) === 6) R.edges.push([B[bx2[i]], B[bx2[i + 1]]]);
    [-12, 12].forEach(x => R.edges.push([A[(x + 30) / 6], B[x]]));
    const Cn = {}; for (let x = -30; x <= 30; x += 6) Cn[x] = nid(x, 6.5);   // 남쪽으로 넓어진 옥상
    for (let x = -30; x < 30; x += 6) R.edges.push([Cn[x], Cn[x + 6]]);
    Object.keys(B).forEach(k => R.edges.push([B[k], Cn[k]]));
    R.adj = R.nodes.map(() => []); R.edges.forEach(([p, q]) => { R.adj[p].push(q); R.adj[q].push(p); });
  }

  /* ---------- 급식실 (7) ---------- */
  // 요리실 (사용자 제공 '요리실 101' 실제 3D 모델 팩 — assets/models/cr101): 뒷벽 개수대 + 가스레인지 조리대, 가운데 아일랜드 조리대 + 곰솥 2개 + 배기 후드,
  // 앞쪽 바닥 배수 트렌치, 동쪽 벽 보조 조리대(세제 · 그릇), 출입문 옆 게시판. 문 · 창 · 표지판 · 형광등 · 방 껍데기 GLB 는 게임에 이미 있는 건축 · 문 시스템과 겹쳐 쓰지 않는다
  // 각 자리에 GLB 와 같은 크기의 절차적 대체 메시를 두고(userData.cr), GLB 가 로드되면 숨긴다 — 파일이 없어도 방이 비지 않는다
  function crFallback(id, mat, w, h, d, x, y, z, ry = 0) { const m = dyn(meshAt(merge([bx(w, h, d, 0, h / 2, 0)]), mat, x, y, z, ry)); m.userData.cr = id; return m; }   // (함수 선언 — 층 생성이 이 줄보다 먼저 돈다)
  function cooking(cx) {
    const zN = -9.6;
    // 뒷벽: 개수대 (창 아래) · 가스레인지 조리대 — 앞면이 방 안(+z)을 향한다
    model('cr101/CR-007', cx - 2.55, 0, zN + .34, 0); crFallback('CR-007', mStainlessD, 1.9, .86, .66, cx - 2.55, 0, zN + .34); col(cx - 3.5, cx - 1.6, zN, zN + .68, false, .9);
    model('cr101/CR-006', cx + 1.0, 0, zN + .36, 0); crFallback('CR-006', mStainlessD, 2.44, .9, .69, cx + 1.0, 0, zN + .36); col(cx - .22, cx + 2.22, zN, zN + .7, false, .92);
    // 가운데: 아일랜드 조리대 + 곰솥 2개 + 천장에 매단 배기 후드
    const iz = -6.0;
    model('cr101/CR-004', cx, 0, iz, 0); crFallback('CR-004', mStainlessD, 2.7, .87, 1.28, cx, 0, iz); col(cx - 1.35, cx + 1.35, iz - .64, iz + .64, false, .87);
    [[-.62, .1, .2], [.68, -.12, -.5]].forEach(([dx, dz, r]) => { model('cr101/CR-005', cx + dx, .885, iz + dz, r); crFallback('CR-005', mStainless, .5, .39, .5, cx + dx, .885, iz + dz); });
    model('cr101/CR-011', cx, 2.15, iz, 0); crFallback('CR-011', mStainless, 1.9, .5, 1.12, cx, 2.5, iz);
    meshAt(merge([tube(.008, cx - .8, 3.0, iz - .4, cx - .8, CH, iz - .4), tube(.008, cx + .8, 3.0, iz - .4, cx + .8, CH, iz - .4), tube(.008, cx - .8, 3.0, iz + .4, cx - .8, CH, iz + .4), tube(.008, cx + .8, 3.0, iz + .4, cx + .8, CH, iz + .4)]), mChrome, 0, 0, 0);   // 후드 매다는 줄
    // 바닥 배수 트렌치 (아일랜드 앞) · 동쪽 보조 조리대 + 세제 · 그릇 · 쟁반 · 게시판
    model('cr101/CR-010', cx, 0, -4.15, 0);
    meshAt(merge([bx(.7, .82, 2.2, 0, .41, 0), bx(.74, .04, 2.24, 0, .84, 0)]), mStainlessD, cx + 3.48, 0, -6.4); col(cx + 3.1, cx + 3.85, -7.5, -5.3, false, .86);
    model('cr101/CR-012', cx + 3.45, .86, -6.4, -Math.PI / 2);
    model('cr101/CR-009', cx + 2.55, 1.15, -1.78, Math.PI); crFallback('CR-009', mCork, 1.84, .92, .04, cx + 2.55, 1.15, -1.78);
    plane(cur.interior, mWin, 1.3, 1.45, cx - 3.05, 1.75, zN + .02);
    addBattery(cx - 3, 0, -3.4); papers(cx, -8, -2.4, 6);
  }
  function craft(cx) {
    const zN = -9.6;
    [-2.2, 2.2].forEach(dx => [-7.2, -4.6].forEach(z => tbl(mWood, 2.2, .85, 1.0, cx + dx, 0, z, { col: true, legMat: mLegMetal, shelf: true, leg: .07 })));
    shelf3D(cx, zN + .3, 0, 3.6, 2.0, .45, 5, .6);
    [-3.2, 3.2].forEach(dx => { add(mWoodDark, .08, 1.7, .08, cx + dx, 0, -3.2); add(mWhite, .7, .8, .04, cx + dx, .8, -3.2); });
    papers(cx, -8, -2.4, 10);
  }
  function buildCafeteria() {
    const F = areaFloor(7, 140), x0 = -48, x1 = -30, z0 = 8, z1 = 22, H = 4.5, t = .3;
    flat(F.interior, mFloorTile, x0, x1, z0, z1, .01, 3);
    flat(F.interior, mCeil, x0, x1, z0, z1, H - .1, 4, false);
    awall(x0, x0 + t, z0, z1, H); awall(x1 - t, x1, z0, z1, H); awall(x0, x1, z0, z0 + t, H);
    awall(x0, -40.5, z1 - t, z1, H); awall(-37.5, x1, z1 - t, z1, H); awall(-40.5, -37.5, z1 - t, z1, H, 3.1); exitDoors(-40.5, -37.5, z1 - t, z1, true, 3.05);   // 출입문 폭 3m · 높이 3m (예전 2m × 2.5m 는 사람 키에 비해 낮았다)
    [-40.5, -37.5].forEach(x => add(mWoodDark, .12, 3.1, .4, x, 0, z1 - .15)); add(mWoodDark, 3.12, .12, .4, -39, 3.04, z1 - .15);
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('비상구', '#0a3a1a', '#7dffa0', 30) }), 1.4, .35, -39, 3.5, z1 - t - .02, Math.PI);
    [11, 15, 19].forEach(z => win3D(F.interior, 2.4, 1.6, x0 + t + .02, 2.4, z, Math.PI / 2));
    restroomWC(x1 - t, z1 - t, -1, -1, H, '급식실 화장실');   // 동남 구석 (손 씻는 곳 옆)
    [-45, -34].forEach(x => plane(F.interior, mWin, 3, 1.6, x, 2.4, z1 - t - .02, Math.PI));
    // ── 급식실 리모델링 (참고 배치도 · 3D 평면도 · 가구 규격도, 18 × 14m) ──
    //   북쪽 2.8m: 조리실(주방) · 관계자 출입구(서) · 식기 보관/배식 보조(동) | 배식대 7.2m | 식사 공간 6인 식탁 16개(4×4) 96석
    //   동쪽 벽: 퇴식구(식판 반납대) · 분리수거함 · 손 씻는 곳 · 알림마당 / 서쪽 창가: 창가 하부장 · 정수기 / 남쪽: 입구 · 출구
    const mSS = S(null, { color: 0xb8bcbe, roughness: .28, metalness: .85 }), mSSd = S(null, { color: 0x8a8e90, roughness: .35, metalness: .8 }), mDkW = S(null, { color: 0x3a2618, roughness: .4 }), mTop = S(null, { color: 0xe8e6e0, roughness: .35 });
    const mPly = S(null, { color: 0x7a4a24, roughness: .5 }), mLeg = S(null, { color: 0x8a9094, roughness: .35, metalness: .75 });
    flat(F.interior, S(T.makeWood ? T.makeWood() : null, { color: 0x4a2c1c, roughness: .35 }), x0 + t, x1 - t, z0 + 3.3, z1 - t, .015, 2);   // 다크 우드 마루 (식사 공간)
    // 조리실 벽 (배식 창 · 문): z = z0 + 2.8 선
    const kz = z0 + 3.3;   // 조리실 깊이 3.3m (냉동고 · 가스 화구 · 국솥 미션이 그 안에 있다) · 서쪽 5.7m 는 관계자 통로로 열어 둔다
    awall(-42.0, -41.4, kz - .1, kz + .1, H); awall(-34.2, x1 - t, kz - .1, kz + .1, H); awall(-41.4, -34.2, kz - .1, kz + .1, H, 2.4);   // 배식 창 위 상부벽
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('서문고등학교 급식실', '#3a2416', '#f0e4c8', 30), color: 0xc8c0b0 }), 4.2, .55, -37.8, 3.3, kz + .11);
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('오늘의 메뉴 — 잡곡밥 · 김치찌개 · 제육볶음 · 콩나물무침 · 우유', '#f2ece0', '#2a2a2a', 18), color: 0xd8d4c8 }), 5.8, .45, -37.8, 2.65, kz + .11);
    // 배식대 (W7200 D900 H900): 스테인리스 하부장 · 배식 웰 6 · 유리 가림막 · 위 선반
    add(mSS, 7.2, .9, .9, -37.8, 0, kz + .55, { col: true }); for (let k = 0; k < 6; k++) { add(mSSd, 1.0, .02, .55, -40.8 + k * 1.2, .9, kz + .5); add(mSS, .06, .06, .06, -40.8 + k * 1.2, .93, kz + .82); }
    add(mGlass, 7.0, .45, .03, -37.8, 1.25, kz + .85); for (let k = 0; k <= 6; k++) add(mSS, .03, .5, .03, -41.3 + k * 1.16, .9, kz + .85); add(mSS, 7.2, .03, .35, -37.8, 1.45, kz + .7);
    add(mSS, 7.2, .04, .25, -37.8, .9, kz + 1.12);   // 식판 레일
    // 주방 안 (배식대 뒤): 조리대 · 국솥 · 오븐 · 냉장고 · 식기 보관대
    add(mMetal, 3, .9, 1, -45, 0, 10, { col: true }); add(mMetal, 2.4, .9, 1, -41, 0, 10, { col: true }); add(mMetal, 2.6, .5, 1.2, -41, 3.0, 10);   // 조리대 · 가스 화구대 · 후드 (미션 위치 그대로)
    cyl(mMetal, .35, .45, -45, .9, 10); cyl(mMetal, .3, .4, -41.5, .9, 10); add(mMetal, 1.2, 1.3, 1.0, -46.9, 0, 11.6, { col: true });
    add(mSS, 1.0, 1.9, .7, x0 + 2.6, 0, z0 + .55, { col: true }); add(mSS, 1.0, 1.9, .7, x0 + 3.7, 0, z0 + .55, { col: true });   // 업소용 냉장고
    add(mSS, 2.6, .9, .7, -31.9, 0, z0 + .5, { col: true }); for (let k = 0; k < 4; k++) add(mSS, 2.6, .03, .6, -31.9, 1.2 + k * .35, z0 + .45);   // 식기 보관 / 배식 보조
    awall(-33.0, -32.9, z0 + t, kz - .1, H);   // 식기 보관실 칸막이
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('관계자 외 출입금지 →', '#a01818', '#fff', 22), color: 0xd0c8c0 }), .9, .22, -41.7, 2.3, kz + .11);
    // 6인 식탁 (W1800 D750 H740) × 16 · 학생 의자 (W420 D480 H760) 96
    const tableC = (cx, cz) => { add(mTop, 1.8, .03, .75, cx, .71, cz, { col: true }); [[-.82, -.3], [.82, -.3], [-.82, .3], [.82, .3]].forEach(([dx, dz]) => add(mLeg, .04, .71, .04, cx + dx, 0, cz + dz)); add(mLeg, 1.6, .03, .03, cx, .15, cz);
      for (const sd of [-1, 1]) for (let k = -1; k <= 1; k++) { const x = cx + k * .58, z = cz + sd * .62; add(mPly, .42, .03, .4, x, .44, z); add(mPly, .4, .32, .02, x, .52, z + sd * .2); [[-.18, -.17], [.18, -.17], [-.18, .17], [.18, .17]].forEach(([a, b]) => add(mLeg, .025, .44, .025, x + a, 0, z + b)); } };
    const TX = [-45.4, -41.9, -38.4, -34.9], TZ = [13.9, 15.95, 18.0, 20.05];
    TX.forEach(x => TZ.forEach(z => tableC(x, z)));
    TX.forEach(x => TZ.forEach(z => { for (let k = 0; k < 2; k++) if (rnd() < .45) tray(x - .5 + k + rr(-.1, .1), .74, z + (rnd() < .5 ? -.2 : .2), rr(-.3, .3)); }));
    // 동쪽 벽: 퇴식구 (식판 반납대 W2400 D700 H900) · 분리수거 (W1800 D600 H900) · 손세정대 (W1800 D600 H850) · 알림마당 (W1500 H1200)
    add(mSS, .7, .9, 2.4, x1 - t - .35, 0, 13.0, { col: true }); for (let k = 0; k < 4; k++) for (let q = 0; q < 8; q++) tray(x1 - t - .35, .91 + q * .025, 12.1 + k * .6, 0);
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('퇴식구 · 식판 반납', '#2a2a2a', '#f0f0f0', 22), color: 0xc8c8c8 }), 1.6, .3, x1 - t - .02, 1.9, 13.0, -Math.PI / 2);
    [['일반쓰레기', '#2a4a7a'], ['음식물', '#b06a1a'], ['재활용', '#2a6a3a']].forEach(([n, c], k) => { const z = 14.9 + k * .6; add(mSS, .6, .9, .58, x1 - t - .3, 0, z, { col: true }); plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign(n, c, '#fff', 20), color: 0xd0d0d0 }), .48, .16, x1 - t - .61, .72, z, -Math.PI / 2); });
    add(mSS, .6, .85, 1.8, x1 - t - .3, 0, 17.6, { col: true }); [-.55, 0, .55].forEach(dz => { add(mSSd, .4, .02, .4, x1 - t - .3, .86, 17.6 + dz); cyl(mSS, .015, .25, x1 - t - .5, .86, 17.6 + dz); });
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('손 씻는 곳', '#1a4a6a', '#fff', 22), color: 0xd0d0d0 }), .9, .22, x1 - t - .02, 1.45, 17.6, -Math.PI / 2);
    plane(F.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('알림마당 — 10월 식단표 · 급식 안내 · 건강한 학교생활', '#1e4a34', '#e8f0e0', 16), roughness: .7 }), 1.5, 1.2, x1 - t - .02, 1.75, 15.6, -Math.PI / 2);
    // 서쪽 창가: 창가 하부장 (W3600 D450 H850) 2 · 정수기/음수대 (W900 D500 H1300) · 화분 · 라디에이터
    [13.9, 19.0].forEach(z => { add(mDkW, .45, .85, 3.6, x0 + t + .23, 0, z, { col: true }); add(mSS, .47, .02, 3.6, x0 + t + .23, .85, z); });
    add(mSS, .5, 1.3, .9, x0 + t + .25, 0, 16.45, { col: true }); for (let k = 0; k < 3; k++) cyl(mSSd, .02, .06, x0 + t + .52, .95, 16.15 + k * .3);
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('정수기', '#1a3a5a', '#fff', 22), color: 0xd0d0d0 }), .5, .15, x0 + t + .51, 1.2, 16.45, Math.PI / 2);
    // 기둥 (식사 공간 가운데) · 벽시계 · 문구 액자
    add(mWhite, .6, H, .6, -38.4 + 1.75, 0, 16.98, { col: true }); add(mDkW, .62, 1.0, .62, -38.4 + 1.75, 0, 16.98);
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('건강한 식사 · 행복한 하루', '#f2ece0', '#3a2416', 18), color: 0xd8d4c8 }), .9, .6, -45.0, 2.6, kz + .11);
    addMedkit(x1 - t - .3, .87, 18.35); addNote('n13', -41.9, .74, 15.95); tapeRecorder('ts_cook', -41.2, .74, 16.0, .4);
    addBattery(-34.9, .74, 20.05);
    for (let k = 0; k < 8; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.28, .2), mDirtPaper); m.rotation.set(-Math.PI / 2, 0, rnd() * 6); m.position.set(rr(-46, -33), .02, rr(12.5, 21)); F.interior.add(m); }
    add(mLockerT, .62, 1.85, .55, -47.2, 0, 21.2, { col: true }); add(mLockerT, .62, 1.85, .55, -46.54, 0, 21.2, { col: true });
    lockers.push({ floor: 7, x: -47.2, z: 20.6, y: 140, dir: { x: 0, z: -1 } });
    [-44, -39, -34].forEach(x => [10, 15, 20].forEach(z => areaLamp(x, z, H - .6, 'cafe'))); lightSwitch(-40.6, z1 - t - .02, Math.PI, 'cafe', '급식실');
    [[-43.65, 14.5], [-40.15, 14.5], [-36.65, 14.5], [-43.65, 18.9], [-36.65, 18.9], [-40.15, 21.2], [-32.4, 13.5], [-32.4, 12.2], [-39.5, 12.8]].forEach(([x, z]) => F.nodes.push({ x, z }));   // 식탁 사이 통로
    F.entrance = 5;
    [[0, 1], [1, 2], [0, 3], [2, 4], [1, 5], [3, 5], [4, 5], [2, 6], [6, 7], [7, 8]].forEach(e => F.edges.push(e));
    F.spawns = [{ x: -43.65, z: 14.5 }, { x: -32.4, z: 12.2 }, { x: -43.65, z: 18.9 }];
    finishGraph(F);
    doors.push({ floor: 7, x: -39, z: 21.2, r: 1.8, label: '급식실 나가기', to: { floor: 0, x: -39, z: 26.6, yaw: Math.PI } });
  }

  /* ---------- 별관 방 가구 ---------- */
  function smart(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    add(mBlack, 3.2, 1.6, .08, cx, .9, zN + .1); const sc = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.4), mBigScreen); sc.position.set(cx, 1.7, zN + .15); cur.interior.add(sc);
    add(mWood, .7, 1.0, .5, cx + 2.8, 0, zN + 1.4, { col: true });
    [[-2.3, -6.6], [2.3, -6.6], [-2.3, -4.2], [2.3, -4.2]].forEach(([dx, z]) => { tbl(mWood, 2.0, .75, .9, cx + dx, 0, z, { col: true }); [-.6, .6].forEach(k => add(mBlack, .4, .45, .4, cx + dx + k, 0, z + .8)); });
    addNote('n15', cx - 2.3, .77, -6.6); papers(cx, -8, -2.4, 8);
  }
  function fusion(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    [-3.0, 3.0].forEach(dx => [-8.0, -6.4, -4.8, -3.3].forEach(z => { tbl(mWood, .7, .74, 1.3, cx + dx, 0, z, { col: true, legMat: mLegMetal }); crt(cx + dx, .74, z - .1); }));
    add(mMetal, 1.0, .9, .8, cx, 0, -8.8, { col: true }); add(mGlass, .9, .6, .7, cx, .9, -8.8); add(mBlack, .3, .1, .3, cx, 1.5, -8.8);
    add(mWhite, .4, .9, .3, cx + .1, 0, -5.2); add(mWhite, .3, .3, .3, cx + .1, .9, -5.2); col(cx - .1, cx + .3, -5.35, -5.05);
    addMedkit(cx, .9, -8.2); papers(cx, -8, -2.4, 8);
  }
  function lang(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    [-2.6, 2.6].forEach(dx => [-8, -6.4, -4.8].forEach(z => { tbl(mWood, 1.6, .75, .8, cx + dx, 0, z, { col: true, legMat: mLegMetal }); add(mWoodDark, 1.6, 1.3, .05, cx + dx, 0, z - .45); add(mBlack, .3, .1, .3, cx + dx, .75, z); add(mBlack, .4, .45, .4, cx + dx, 0, z + .75); }));
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), mBigScreen); sc.position.set(cx, 1.9, zN + .15); cur.interior.add(sc);
    addBattery(cx - 3.2, 0, -3.2); papers(cx, -8, -2.4, 7);
  }
  function club(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    tbl(mWood, 4.2, .75, 1.2, cx, 0, -6.4, { col: true });
    [-1.6, -.5, .6, 1.7].forEach(dx => [-1, 1].forEach(s => { add(mBlack, .4, .45, .4, cx + dx, 0, -6.4 + s * 1.0); (cur.furnOcc ||= []).push({ x: cx + dx, z: -6.4 + s * 1.0, w: .5, d: .5 }); }));
    shelf3D(cx - 3.6, -6.4, Math.PI / 2, 3.2, 2.0, .42, 5, .7);
    add(mFabric, 2.0, .45, .8, cx + 2.4, 0, -3.0, { col: true }); add(mFabric, 2.0, .5, .2, cx + 2.4, .45, -2.7);
    [[cx + 3.3, -9.2], [cx - 3.3, -2.6]].forEach(([x, z]) => cyl(S(null, { color: 0x2a4a22, roughness: 1 }), .22, .7, x, 0, z));
    addNote('n14', cx, .77, -6.4); addMedkit(cx + 3.2, 0, -8.6); papers(cx, -8, -2.4, 9);
  }
  // 기술·가정실 (102) — 사용자 제공 'Room102 Actual3D' 팩의 실제 GLB (assets/models/th102) + 팩의 공유 PBR 텍스처 14종.
  // 팩 배치표(문 = y 0 · 뒷벽 = y 6.5m, 8.4m 폭)를 게임 방(문 z -1.75 · 뒷벽 z -9.6, 폭 8m)으로 비례 변환. 문 · 명패 · 형광등 · 창 · 벽/바닥/천장 모듈은
  // 게임의 기존 건축 · 미닫이문 · 조명 시스템과 겹치므로 쓰지 않는다. GLB 를 못 불러오면 같은 크기의 절차적 대체 메시가 남는다
  function tech(cx) {
    const zN = -9.6, X = x => cx + x * .92, Z = y => -1.75 - y * 1.19;
    frontWall(cx, zN, false);
    const th = (id, x, y, h, ry = 0, fb) => { model('th102/' + id, X(x), h, Z(y), ry); if (fb) crFallback(id, fb[0], fb[1], fb[2], fb[3], X(x), h, Z(y), ry); };
    // 실습대 4 (+ 스툴 · 재봉틀 · 공구 케이스 · 재봉 도구 · 바이스 · 회로 키트)
    [[-1.65, 1.8], [1.65, 1.8], [-1.65, 4.35], [1.65, 4.35]].forEach(([x, y], k) => {
      th('TH-007', x, y, 0, 0, [mWood, 1.55, .84, .96]); col(X(x) - .78, X(x) + .78, Z(y) - .5, Z(y) + .5, false, .84);
      th('TH-015', x, y - .79, 0, rnd() * 6, [mMetal, .42, .52, .42]);
      // 재봉틀/원단과 공구 매트가 같은 실습대 위에서 관통하지 않도록 분리.
      if (k === 0) th('TH-017', x + .38, y - .12, .85);
    });
    th('TH-014', -2.05, 1.95, .85); th('TH-014', 1.18, 4.48, .85); th('TH-008', 1.25, 1.95, .85); th('TH-008', -2.02, 4.48, .85);
    th('TH-019', -1.35, 4.25, .85); th('TH-021', 1.88, 4.22, .85); th('TH-020', 1.98, 1.72, .85, .4);
    // 벽: 서쪽 이중 싱크대 · 동쪽 유리문 재료장 · 동쪽 공구 타공판 · 뒷벽 화이트보드 (창 사이)
    th('TH-010', -4.15, 4.92, 0, -Math.PI / 2, [mStainlessD, 1.58, 1.2, .67]); col(cx - 3.85, cx - 3.15, Z(4.92) - .8, Z(4.92) + .8, false, .86);
    th('TH-016', 4.24, 5.3, 0, Math.PI / 2, [mMetal, 1.22, 1.95, .47]); col(cx + 3.38, cx + 3.85, Z(5.3) - .62, Z(5.3) + .62);
    model('th102/TH-018', cx + 3.83, 1.1, Z(2.2), -Math.PI / 2);
    model('th102/TH-022', cx, 1.15, zN + .12, 0);
    model('th102/TH-012', X(-.15), .005, Z(2.95), .3);
    addNote('n16', X(-1.65) + .35, .85, Z(4.35) + .1); addBattery(cx - 3.2, 0, -3.2); papers(cx, -8, -2.4, 6);
  }

  /* ---------- 별관 (8,9,10) ---------- */
  function buildAnnexFloor(k) {
    const spec = ANNEX.floors[k], f = 8 + k, y0 = 180 + k * 40, sl = ANNEX.slots;
    const F = areaFloor(f, y0); F.annex = true; F.stairZone = { x1: -17, x2: -12, z1: -9.3, z2: -2, spawn: { x: -15.2, z: -5.2 } };
    // 별관 남쪽 정중앙(cx = 0)은 본관 연결 통로(1F 필로티 · 2F/3F 구름다리)가 직결되는 오픈 연결 홀로 비우고,
    // 기존에 cx = 0 에 있던 2층 '교재 창고'(storeS)와 3층 '기자재실'(equip)은 동쪽 확장 슬롯(cx = 24, x: 20~28)으로 재배치한다!
    const AS = ANNEX_S[k], X0 = -20.3, X1 = 28.3, Z0 = -9.9, Z1 = MAIN_ZS;
    const extraSouthTypes = ['wash', 'toilet', 'work'], extraSouthNames = ['세척실', '화장실', '작업실'];
    const slSouth = [...sl, 24];
    const sTypes = [...AS.types, extraSouthTypes[k]];
    const sNames = [...AS.names, extraSouthNames[k]];
    const woodT = ['nurse', 'library', 'music', 'art', 'craft', 'counsel', 'club', 'fusion'];
    flat(F.interior, mFloorTile, X0, X1, -1.75, 1.75, 0);
    slSouth.forEach((cx, i) => flat(F.interior, ['counsel', 'counselS', 'gallery', 'work', 'staff', 'av', 'student', 'reading', 'archive'].includes(sTypes[i]) ? mFloorWood : mFloorTile, cx - 4, cx + 4, 1.75, 9.6, 0));
    // 별관 남쪽 바깥벽: 정중앙 구름다리/필로티 직결 구간(x: -0.85 ~ +2.45, 중심 0.8, 폭 3.3m)은 1·2·3층 모두 오픈 출입구로 뚫고, 남쪽 벽 충돌체도 해당 구간을 비운다!
    { const sOps = [];
      slSouth.forEach((cx, i) => {
        const t = sTypes[i];
        if (cx === 0) sOps.push({ x: .8, w: 3.3, y0: 0, y1: 2.85, door: true });
        else if (!['storeS', 'toilet', 'gallery'].includes(t)) sOps.push({ x: cx - 3.05, w: 1.3, y0: 1.02, y1: 2.48 }, { x: cx + 3.05, w: 1.3, y0: 1.02, y1: 2.48 });
      });
      sOps.sort((a, b) => a.x - b.x); let curS = X0;
      for (const sw of sOps) { const sa = sw.x - sw.w / 2, sb = sw.x + sw.w / 2; if (sa > curS) F.interior.add(boxMesh(curS, sa, 0, CH, 9.6, Z1, mWall)); if (sw.y0 > 0) F.interior.add(boxMesh(sa, sb, 0, sw.y0, 9.6, Z1, mWall)); if (sw.y1 < CH) F.interior.add(boxMesh(sa, sb, sw.y1, CH, 9.6, Z1, mWall)); curS = sb; }
      if (curS < X1) F.interior.add(boxMesh(curS, X1, 0, CH, 9.6, Z1, mWall));
      sOps.forEach(sw => { if (!sw.door) win3D(F.interior, sw.w, nwH(sw), sw.x, (sw.y0 + sw.y1) / 2, 9.62, Math.PI); });
      col(X0, -.85, 9.6, Z1, true); col(2.45, X1, 9.6, Z1, true);
    }
    function nwH(sw) { return sw.y1 - sw.y0; }
    sl.forEach((cx, i) => { if (spec.types[i] !== 'stair') flat(F.interior, woodT.includes(spec.types[i]) ? mFloorWood : mFloorTile, cx - 4, cx + 4, -9.6, -1.75, 0); });
    flat(F.interior, mFloorTile, 20, X1, -9.6, -1.75, 0);
    ceilHole(F.interior, X0, X1, Z0, Z1, -16);
    { const nOps = []; sl.forEach((cx, i) => { const t = spec.types[i]; if (t === 'stair') nOps.push({ x: cx + 1.0, w: 1.7, y0: 1.0, y1: 2.8 }); else if (t === 'cooking') nOps.push({ x: cx - 3.05, w: 1.3, y0: 1.02, y1: 2.48 }); else nOps.push({ x: cx - 3.05, w: 1.3, y0: 1.02, y1: 2.48 }, { x: cx + 3.05, w: 1.3, y0: 1.02, y1: 2.48 }); });
      nOps.sort((a, b) => a.x - b.x); let curN = X0;
      for (const nw of nOps) { const na = nw.x - nw.w / 2, nb = nw.x + nw.w / 2; if (na > curN) F.interior.add(boxMesh(curN, na, 0, CH, Z0, -9.6, mWall)); if (nw.y0 > 0) F.interior.add(boxMesh(na, nb, 0, nw.y0, Z0, -9.6, mWall)); if (nw.y1 < CH) F.interior.add(boxMesh(na, nb, nw.y1, CH, Z0, -9.6, mWall)); curN = nb; }
      if (curN < X1) F.interior.add(boxMesh(curN, X1, 0, CH, Z0, -9.6, mWall));
      nOps.forEach(nw => { if (!nw.door) win3D(F.interior, nw.w, nw.y1 - nw.y0, nw.x, (nw.y0 + nw.y1) / 2, -9.62, 0); });
      col(X0, X1, Z0, -9.6, true); }
    awall(X0, -20, -9.6, Z1, CH); awall(28, X1, -9.6, Z1, CH); awall(20, 28, -1.75, -1.45, CH);
    // 별관 연결 홀(cx = 0, z = 4.5, 8.2) 천장 조명 추가
    F.lamps.push({ x: .8, y: F.y0 + CH - .5, z: 7.5, kind: 'on', mat: matLampOn }, { x: 0, y: F.y0 + CH - .5, z: 3.5, kind: 'on', mat: matLampOn }, { x: .8, y: F.y0 + 2.75, z: 13.5, kind: 'on', mat: matLampOn });
    // 별관 남쪽 문(z = 9.6) 너머로 이어지는 구름다리/필로티 통로(z: 9.62 ~ 20.2) 및 본관 북측 외관·중앙계단실(z: 20.2 ~ 28.0) 구축!
    // (모든 외부 지형과 통로는 반드시 별관 외벽 바깥 z > 9.62 및 z < -9.95 에만 배치하여 별관 실내 바닥 z: -9.6~9.6 과 겹침 0.0mm 보장!)
    {
      const gy = -k * FH - .04, mOutGnd = new THREE.MeshBasicMaterial({ map: T.makeGround(), color: 0x485846 });
      // 별관 건물 바닥(x: -20.4 ~ 28.4, z: -10.0 ~ 20.5)을 완전히 비운 외부 지면
      flat(F.interior, mOutGnd, -80, 80, -70, -10.0, gy, 6);
      flat(F.interior, mOutGnd, -80, -20.4, -10.0, 65, gy, 6);
      flat(F.interior, mOutGnd, 28.4, 80, -10.0, 65, gy, 6);
      flat(F.interior, mOutGnd, -20.4, -.95, 9.95, 20.2, gy, 3);
      flat(F.interior, mOutGnd, 2.55, 28.4, 9.95, 20.2, gy, 3);
      // 구름다리 통로 바닥 · 천장 · 투톤 허리벽 · 유리창 (x: -0.85 ~ +2.45, z: 9.62 ~ 20.2)
      flat(F.interior, mFloorTile, -.85, 2.45, 9.62, 23.5, .005);
      flat(F.interior, mCeil, -.85, 2.45, 9.62, 23.5, 2.92, 2, false);
      [-.85, 2.45].forEach(px => {
        F.interior.add(
          boxMesh(px - .05, px + .05, 0, 1.0, 9.62, 20.2, mWainscot98),
          boxMesh(px - .06, px + .06, 1.0, 1.06, 9.62, 20.2, mChairRail98),
          boxMesh(px - .05, px + .05, 2.3, 2.92, 9.62, 20.2, mPlaster98)
        );
        [10.2, 13.5, 16.8, 19.8].forEach(pz => F.interior.add(boxMesh(px - .05, px + .05, 1.0, 2.3, pz - .25, pz + .25, mPlaster98)));
        win3D(F.interior, 2.8, 1.25, px, 1.65, 11.85, Math.PI / 2);
        win3D(F.interior, 2.8, 1.25, px, 1.65, 15.15, Math.PI / 2);
        win3D(F.interior, 2.8, 1.25, px, 1.65, 18.30, Math.PI / 2);
      });
      // 구름다리 남단 본관 외벽(z: 20.2 ~ 20.5) 및 본관 중앙계단실 내부(z: 20.5 ~ 26.0)
      const mainY0 = -k * FH;
      F.interior.add(
        boxMesh(-36.3, -.85, mainY0, mainY0 + 12.4, 20.2, 20.5, mFacade, 3),
        boxMesh(2.45, 36.3, mainY0, mainY0 + 12.4, 20.2, 20.5, mFacade, 3),
        boxMesh(-.85, 2.45, 2.55, 3.6, 20.2, 20.5, mFacade, 2),
        boxMesh(-3.85, 3.85, 0, 3.6, 25.8, 26.1, mPlaster98),
        boxMesh(-4.15, -3.85, 0, 3.6, 20.2, 26.1, mPlaster98),
        boxMesh(3.85, 4.15, 0, 3.6, 20.2, 26.1, mPlaster98)
      );
      add(mWoodDark, .12, 2.55, .32, -.85, 0, 20.35);
      add(mWoodDark, .12, 2.55, .32, 2.45, 0, 20.35);
      add(mWoodDark, 3.42, .12, .32, .80, 2.55, 20.35);
      plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign(`본관 ${k + 1}층 중앙계단 직결 ↓`, '#182c38', '#d8f0e8', 22), color: 0x9aa59a }), 1.85, .32, .8, 2.75, 20.16, Math.PI);
      for (let mf = 0; mf < 3; mf++) {
        SLOTS.forEach(mcx => {
          if (mcx === 0) return;
          [-3.05, 3.05].forEach(dx => win3D(F.interior, 1.3, 1.45, mcx + dx, mainY0 + mf * FH + 1.75, 20.18, Math.PI));
        });
      }
      col(-1.85, -.82, 9.6, 20.2, true); col(2.42, 3.45, 9.6, 20.2, true);
    }
    // 복도 남벽: 중앙(cx = 0)은 1·2·3층 모두 문 없는 6m 광폭 개구부, 동쪽 확장 슬롯(cx = 24)을 포함한 나머지 방은 미닫이문!
    slSouth.forEach((cx, i) => {
      if (sTypes[i] === 'lobbyA') { awall(cx - 4, cx - 3, 1.45, 1.75, CH); awall(cx + 3, cx + 4, 1.45, 1.75, CH); awall(cx - 3, cx + 3, 1.45, 1.75, CH, 2.7); [-3, 3].forEach(dx => add(mWoodDark, .12, 2.7, .36, cx + dx, 0, 1.6)); }
      else { awall(cx - 4, cx - 1, 1.45, 1.75, CH); awall(cx + 1, cx + 4, 1.45, 1.75, CH); awall(cx - 1, cx + 1, 1.45, 1.75, CH, 2.4); add(mWoodDark, .1, 2.4, .36, cx - 1.0, 0, 1.6); add(mWoodDark, .1, 2.4, .36, cx + 1.0, 0, 1.6); slidingDoorsS(cx).rt = sTypes[i]; }
      plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign(sNames[i], '#1e2a2e', '#d9e4d0', sNames[i].length > 6 ? 22 : 28), color: 0x9aa59a }), 1.4, .35, cx, 2.62, 1.43, Math.PI);
    });
    [-12, -4, 4, 12, 20].forEach(b => awall(b - .15, b + .15, 1.75, 9.6, CH));
    [-10, 10, 22].forEach(x => emergLight(x + 2.2, 2.85, -1.44));
    corridorPipes(-20, 28); ceilingDamage(-19, 27, -1.2, 1.2, 4); exitSign(-20.2, 2.9, 0, Math.PI / 2);
    sl.forEach((cx, i) => {
      awall(cx - 4, cx - 1, -1.75, -1.45, CH); awall(cx + 1, cx + 4, -1.75, -1.45, CH); awall(cx - 1, cx + 1, -1.75, -1.45, CH, 2.4);
      add(mWoodDark, .1, 2.4, .36, cx - 1.0, 0, -1.6); add(mWoodDark, .1, 2.4, .36, cx + 1.0, 0, -1.6);
      if (spec.types[i] !== 'stair') slidingDoors(cx).rt = spec.types[i];
      plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign(spec.names[i], '#1e2a2e', '#d9e4d0', spec.names[i].length > 6 ? 22 : 28), color: 0x9aa59a }), 1.4, .35, cx, 2.62, -1.43);
    });
    [-12, -4, 4, 12, 20].forEach(b => awall(b - .15, b + .15, -9.6, -1.75, CH));
    const fn = { stair: stairRoom, nurse, library, cooking, tech, fusion, counsel, computer, lang, smart, club, music, art, craft, lab };
    sl.forEach((cx, i) => fn[spec.types[i]](cx, spec.names[i]));
    sl.forEach((cx, i) => roomObj(spec.types[i], cx));
    slSouth.forEach((cx, i) => southRoom(cx, () => { SOUTH_FN[sTypes[i]](cx, sNames[i]); roomObj(sTypes[i], cx); if (sTypes[i] === 'storeS') lostBox(cx + 1.8, -3.4, k === 1 && cx === 24); }));
    [-12, -4, 4, 12, 22].forEach(x => areaLamp(x, 0, CH - .1)); sl.forEach((cx, i) => { const rk = `${f}:${cx}`; if (spec.types[i] !== 'stair') areaLamp(cx - 2, -5.6, CH - .1, rk); areaLamp(cx + (spec.types[i]==='stair'?.9:2), -5.6, CH - .1, rk); lightSwitch(cx + 1.4, -1.78, Math.PI, rk, spec.names[i]); });
    slSouth.forEach((cx, i) => { const rk = `${f}:${cx}s`; areaLamp(cx - 2, 5.6, CH - .1, rk); areaLamp(cx + 2, 5.6, CH - .1, rk); lightSwitch(cx + (sTypes[i] === 'lobbyA' ? -3.25 : -1.4), 1.78, 0, rk, sNames[i]); });
    [2, 3].forEach(i => { const cx = sl[i]; for (let q = 0; q < 3; q++) add(mLockerT, .62, 1.85, .5, cx + 2.35 + q * .66, 0, -1.2, { col: true }); lockers.push({ floor: f, x: cx + 3.01, z: -1.2, y: y0, dir: { x: 0, z: 1 } }); });
    for (let q = 0; q < 24; q++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.28, .2), mDirtPaper); m.rotation.set(-Math.PI / 2, 0, rnd() * 6.28); m.position.set(rr(-19, 19), .012, rr(-1.2, 1.3)); F.interior.add(m); }
    const xs = new Set(slSouth); for (let x = -20; x <= 24; x += 4) xs.add(x);
    const arr = [...xs].sort((p, q) => p - q), cn = arr.map(x => { F.nodes.push({ x, z: 0 }); return F.nodes.length - 1; });
    for (let q = 0; q < cn.length - 1; q++) F.edges.push([cn[q], cn[q + 1]]);
    sl.forEach(cx => { F.nodes.push({ x: cx, z: -5.5 }); F.edges.push([cn[arr.indexOf(cx)], F.nodes.length - 1]); });
    slSouth.forEach((cx, i) => { if (sTypes[i] === 'lobbyA') return; F.nodes.push({ x: cx, z: 5.2 }); F.edges.push([cn[arr.indexOf(cx)], F.nodes.length - 1]); });
    F.spawns = [{ x: 18, z: 0 }, { x: -18, z: 0 }, { x: 8, z: -5.5 }];
    finishGraph(F);
    if (k === 0) plane(F.interior, mCork, 2.0, 1.0, -5.5, 1.8, -1.42);
    // 1·2·3층 모두 남쪽 중앙 홀(cx = 0, z = 9.6)이 열려 있어 걸어서 바로 나가면 본관 연결통로로 연속 보행(Seamless Walk-Through)된다!
    doors.push({ floor: f, x: 0, z: 9.2, r: 1.8, seamless: true, label: k === 0 ? '필로티 광장 (본관 1F 방향)' : `${k + 1}층 구름다리 (본관 ${k + 1}F 방향)`, to: { floor: k, x: .8, z: WALKWAY.z1 + 1.0, yaw: Math.PI } });
    if (k === 0) {
      annexExitDoor(F.interior, -19.95, Math.PI / 2);
      doors.push({ floor: 8, x: -19.4, z: 0, r: 1.3, label: '비상구 — 밖으로 나가기', to: { floor: 0, x: -21.4, z: ANNEX_EXIT_Z, yaw: Math.PI / 2 } });
    }
  }
  // 비상구 철문 (두 짝 · 푸시바 · 초록 비상구 표시등) — 벽면(x)에 붙여 세운다
  function annexExitDoor(grp, x, ry) {
    const g = new THREE.Group(); g.position.set(x, 0, ry > 0 ? 0 : ANNEX_EXIT_Z); g.rotation.y = ry; grp.add(g);
    const fr = new THREE.Mesh(merge([bx(.12, 2.3, .14, -.98, 1.15, 0), bx(.12, 2.3, .14, .98, 1.15, 0), bx(2.08, .12, .14, 0, 2.3, 0)]), mWoodDark); g.add(fr);
    const dm = S(T.makeMetal([60, 92, 78]), { roughness: .55, metalness: .5 });
    [-.46, .46].forEach(dx => { const d = new THREE.Mesh(new THREE.BoxGeometry(.9, 2.22, .05), dm); d.position.set(dx, 1.11, .02); g.add(d);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(.7, .06, .06), mChrome); bar.position.set(dx, 1.0, .08); g.add(bar); });
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(.6, .22), new THREE.MeshBasicMaterial({ map: T.makeSign('비상구 EXIT', '#0c6a2a', '#e8ffe8', 26) })); sg.position.set(0, 2.55, .05); g.add(sg);
    g.traverse(o => { o.userData.dynamic = true; });
  }

  /* ---------- 독립 공간: 체육관(5) / 수영장(6) ---------- */
  function areaFloor(f, y0) {
    const F = { f, y0, interior: new THREE.Group(), shell: new THREE.Group(), col: [], walls: [], lamps: [], nodes: [], edges: [], adj: [], spawns: [], area: true };
    F.interior.position.y = y0; scene.add(F.interior); floors.push(F); cur = F; return F;
  }
  // 독립 공간(체육관 · 수영장 · 급식실)의 바깥 출입구: 예전에는 구멍만 있어 걸어 나가면 맵 밖(허공)으로 빠졌다 → 닫힌 양여닫이 문 + 충돌
  function exitDoors(a, b, c, d, alongX, h = 2.5) {
    col(Math.min(a, b), Math.max(a, b), Math.min(c, d), Math.max(c, d), true);
    const w = Math.abs(b - a) / 2 - .02, mid = (c + d) / 2;
    [0, 1].forEach(k => {
      const cpos = a + (k + .5) * (b - a) / 2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(alongX ? w : .06, h, alongX ? .06 : w), mDoor);
      alongX ? m.position.set(cpos, h / 2, mid) : m.position.set(mid, h / 2, cpos); cur.interior.add(m);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(alongX ? w * .8 : .08, .06, alongX ? .08 : w * .8), mChrome);
      alongX ? bar.position.set(cpos, 1.05, mid) : bar.position.set(mid, 1.05, cpos); cur.interior.add(bar);
    });
  }
  const finishGraph = F => { F.adj = F.nodes.map(() => []); F.edges.forEach(([p, q]) => { F.adj[p].push(q); F.adj[q].push(p); }); };
  const awall = (x1, x2, z1, z2, h, y1 = 0, mat = mWall) => { buildLayered1998Wall(cur.interior, x1, x2, z1, z2, y1, h, mat); if (y1 < 1) col(x1, x2, z1, z2, true); };
  // 화장실 칸 (지하 · 옥상 제외 모든 층 필수): 안쪽 모서리 (cxw, czw)에서 sx · sz 방향으로 2.6 × 2.2m — 문 구멍 칸막이 · 타일 · 변기 · 세면대 · 거울 · 표지
  const restroomWC = (cxw, czw, sx, sz, h, label = '화장실') => {
    const W = 2.6, D = 2.2, xa = cxw + sx * W, za = czw + sz * D, xm = Math.min(cxw, xa), xM = Math.max(cxw, xa), zm = Math.min(czw, za), zM = Math.max(czw, za);
    const porc = S(null, { color: 0xf2f2ee, roughness: .25 }), tile = S(null, { color: 0xd8dcd8, roughness: .35 });
    flat(cur.interior, tile, xm, xM, zm, zM, .03, 2);
    const d1 = Math.min(czw + sz * .5, czw + sz * 1.4), d2 = Math.max(czw + sz * .5, czw + sz * 1.4);
    awall(xa - .06, xa + .06, zm, d1, h); awall(xa - .06, xa + .06, d2, zM, h); awall(xa - .06, xa + .06, d1, d2, h, 2.1);
    awall(xm - .06, xM + .06, za - .06, za + .06, h);
    const tx = cxw + sx * .45, tz = czw + sz * 1.55; add(porc, .42, .4, .55, tx, 0, tz, { col: true }); add(porc, .2, .45, .5, cxw + sx * .12, .45, tz);
    const kx = cxw + sx * 1.9, kz = czw + sz * .3; add(porc, .5, .14, .4, kx, .78, kz); add(porc, .08, .78, .08, kx, 0, kz);
    plane(cur.interior, S(null, { color: 0x9fb4bc, roughness: .1, metalness: .6 }), .5, .7, kx, 1.55, czw + sz * .02, sz > 0 ? 0 : Math.PI);
    plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('🚻 ' + label, '#1f3f6f', '#ffffff', 26) }), .9, .24, xa - sx * .08, 2.3, (d1 + d2) / 2, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
    props.push({ kind: 'robj', k: 'campus_wc', floor: cur.f, x: tx + sx * .6, z: tz - sz * .4, y: .6, r: 1.3, label: label + ' 세면대 · 변기 살펴보기' });
  };
  function areaLamp(x, z, y, room = null) {
    const r = rnd(); const kind = room ? (r < .62 ? 'on' : r < .85 ? 'flick' : 'dead') : (r < .45 ? 'on' : r < .75 ? 'flick' : 'dead');
    const m = kind === 'on' ? matLampOn : kind === 'dead' ? matLampDead : flickerMats[(rnd() * 4) | 0];
    const t = dyn(new THREE.Mesh(new THREE.BoxGeometry(1.3, .05, .12), m)); t.position.set(x, y, z); cur.interior.add(t);
    const hs = new THREE.Mesh(new THREE.BoxGeometry(1.4, .04, .22), lampHousing); hs.position.set(x, y + .06, z); cur.interior.add(hs);
    cur.lamps.push({ x, y: cur.y0 + y - .4, z, kind, mat: m, mesh: t, room });
  }
  // 벽 형광등 스위치: 같은 room 키를 가진 형광등을 켜고 끈다 (방에 들어서면 문 옆 벽에 있다)
  function lightSwitch(x, z, ry, room, name = '') {
    const g = dyn(new THREE.Group()); g.position.set(x, 1.3, z); g.rotation.y = ry; cur.interior.add(g);
    // 1998년식 아이보리 2구 스위치 플레이트 & 스틸 백박스
    g.add(new THREE.Mesh(new THREE.BoxGeometry(.096, .146, .016), mJBox98));
    const pl = new THREE.Mesh(new THREE.BoxGeometry(.088, .138, .008), mSwitchPlate); pl.position.z = .010; g.add(pl);
    const key = new THREE.Mesh(new THREE.BoxGeometry(.032, .042, .018), mSwitchKey); key.position.set(0, .018, .015); g.add(key);
    const key2 = new THREE.Mesh(new THREE.BoxGeometry(.032, .042, .016), mSwitchKey); key2.position.set(0, -.032, .014); g.add(key2);
    const led = new THREE.Mesh(new THREE.BoxGeometry(.014, .010, .005), new THREE.MeshBasicMaterial({ color: 0x40ff80 })); led.position.set(0, .052, .015); g.add(led);
    // 상단 분기 정션박스(y=3.18m) -> 수직 금속 전선관(새들 클램프 4개) -> 스위치 -> 하단 220V 2구 콘센트(y=0.38m) + 천장 조명 분기 배선관
    const topH = CH - 1.3;
    const condParts = [
      // 상단 분기 정션박스 (y = 3.15m = local +1.85m)
      bx(.095, .095, .036, 0, 1.85, .014),
      // 천장까지 이어지는 2가닥 수직 전선관 (전등 스위치선 + 콘센트 전원선)
      tube(.0085, -.016, .07, .010, -.016, topH, .010),
      tube(.0075,  .018, -.07, .010,  .018, topH, .010),
      // 스위치에서 하단 220V 콘센트(local y = -0.92m -> world y = 0.38m)로 내려가는 전선관
      tube(.0075, .018, -.07, .010, .018, -.92, .010),
      // 전선관 고정 새들 클램프 (Saddle Clamps)
      bx(.052, .016, .018, 0, .45, .010),
      bx(.052, .016, .018, 0, .95, .010),
      bx(.052, .016, .018, 0, 1.45, .010),
      bx(.032, .016, .018, .018, -.45, .010),
      // 하단 220V 2구 접지 콘센트 백박스
      bx(.086, .126, .022, .018, -.92, .011),
      // 천장면을 따라 방 안쪽 등기구 방향으로 뻗어나가는 실내 조명 분기 전선관 (2.2m)
      tube(.008, -.016, topH - .02, .010, -.016, topH - .02, 2.2)
    ];
    g.add(new THREE.Mesh(merge(condParts), mConduit98));
    // 하단 220V 콘센트 아이보리 커버 & 2구 소켓 홈
    const outPl = new THREE.Mesh(new THREE.BoxGeometry(.078, .118, .006), mSwitchPlate); outPl.position.set(.018, -.92, .024); g.add(outPl);
    const holeGeo = merge([
      bx(.036, .036, .004, .018, -.892, .027),
      bx(.036, .036, .004, .018, -.948, .027)
    ]);
    g.add(new THREE.Mesh(holeGeo, mBlack));
    const on = rnd() < .55, fx = Math.sin(ry) * .55, fz = Math.cos(ry) * .55;
    props.push({ kind: 'switch', floor: cur.f, x: x + fx, z: z + fz, px: x, pz: z, y: 1.3, room, on, key, led, name, label: '형광등 스위치' });
  }
  function ball(x, z, mat) { const b = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), mat); b.position.set(x, .12, z); cur.interior.add(b); }

  function buildGym() {
    const F = areaFloor(5, 60), x0 = 28, x1 = 48, z0 = 8, z1 = 30, H = 8, t = .3;
    const mCourt = new THREE.MeshStandardMaterial({ map: T.makeCourt(), roughness: .42, metalness: .06 });
    const mBall = S(null, { color: 0xb04a20 }), mGreen = S(null, { color: 0x244838 }), mScore = new THREE.MeshBasicMaterial({ map: T.makeScore() });
    const mBanner = new THREE.MeshStandardMaterial({ map: T.makeBanner(), roughness: .85 });
    const mCurt = S(T.makeCurtain(), { side: THREE.DoubleSide });
    const mPadBlue = S(null, { color: 0x1e3f66, roughness: .75 }), mPadGold = S(null, { color: 0xc89a28, roughness: .6 });
    plane(F.interior, mCourt, x1 - x0 - 2 * t, z1 - z0 - 2 * t, 38, .01, 19, 0, -Math.PI / 2);
    flat(F.interior, mCeil, x0, x1, z0, z1, H - .1, 4, false);
    // 서쪽 벽: z 17.2 ~ 19.6 구간을 개방하여 신설 확장 구역(체육교사실 · 용구보관실 x: 20~28, z: 12~26)과 연결!
    awall(x0, x0 + t, z0, 17.2, H); awall(x0, x0 + t, 19.6, z1, H); awall(x0, x0 + t, 17.2, 19.6, H, 2.55);
    restroomWC(x0 + t, z1 - t, 1, -1, 3.2, '체육관 화장실');
    add(mWoodDark, .38, 2.55, .12, x0 + .15, 0, 17.2); add(mWoodDark, .38, 2.55, .12, x0 + .15, 0, 19.6); add(mWoodDark, .38, .12, 2.52, x0 + .15, 2.55, 18.4);
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('← 체육교사실 · 용구보관실', '#1e2e26', '#e4ecd8', 24) }), 1.8, .34, x0 + t + .03, 2.85, 18.4, Math.PI / 2);

    awall(x1 - t, x1, z0, z1, H); awall(x0, x1, z0, z0 + t, H);
    awall(x0, 36.5, z1 - t, z1, H); awall(39.5, x1, z1 - t, z1, H); awall(36.5, 39.5, z1 - t, z1, H, 3.3); exitDoors(36.5, 39.5, z1 - t, z1, true, 3.25);
    add(mWoodDark, .12, 3.3, .4, 36.5, 0, z1 - .15); add(mWoodDark, .12, 3.3, .4, 39.5, 0, z1 - .15); add(mWoodDark, 3.12, .12, .4, 38, 3.24, z1 - .15);
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('비상구', '#0a3a1a', '#7dffa0', 30) }), 1.4, .35, 38, 3.7, z1 - t - .02, Math.PI);
    plane(F.interior, mClockM, .9, .9, 43, 5.4, z1 - t - .02, Math.PI);
    plane(F.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('제 32회 서문 체육대회 · 학예제', '#1b2c46', '#f0e4b8', 22), roughness: .85 }), 3.8, .85, 33, 3.6, z1 - t - .03, Math.PI);
    // 벽면 충격방지 안전 쿠션 매트 (코트 남벽·서벽 하단)
    for (let x = 29.2; x <= 35.4; x += 1.55) add(mPadBlue, 1.42, 1.65, .08, x, .15, z1 - t - .05);
    for (let x = 40.6; x <= 42.4; x += 1.55) add(mPadBlue, 1.42, 1.65, .08, x, .15, z1 - t - .05);
    for (let z = 12.8; z <= 16.0; z += 1.55) add(mPadBlue, .08, 1.65, 1.42, x0 + t + .05, .15, z);
    [11, 15, 19, 23, 27].forEach(z => win3D(F.interior, 2.4, 1.8, x0 + t + .02, 5.2, z, Math.PI / 2));
    [11, 15, 19, 23].forEach(z => win3D(F.interior, 2.4, 1.8, x1 - t - .02, 5.2, z, -Math.PI / 2));
    // 천장 입체 철골 트러스 & 음향 어레이 스피커
    for (let z = 10; z <= 28; z += 4) {
      add(mMetal, 19.4, .28, .22, 38, H - .6, z);
      add(mMetal, 19.4, .12, .12, 38, H - 1.05, z);
    }
    // 무대 (단상 + 양쪽 계단 + 강연대 + 그랜드 피아노 + 벨벳 커튼 + 현수막)
    add(mWoodDark, 19.4, 1.1, 4.0, 38, 0, z0 + t + 2, { col: true });
    // 무대 양옆으로 직접 걸어 올라갈 수 있는 계단 (서쪽 x 29.2~31.0, 동쪽 x 45.0~46.8)
    for (let s = 0; s < 4; s++) {
      const sy = (s + 1) * .275, sz0 = z0 + t + 4.0 + (3 - s) * .36, sz1 = sz0 + .36;
      add(mWoodDark, 1.8, sy, .36, 30.1, 0, (sz0 + sz1) / 2); col(29.2, 31.0, sz0, sz1, false, sy);
    }
    // 무대 위 강연대(훈화 단상) & 스포트라이트 빔
    add(mWoodDark, .85, 1.15, .55, 38, 1.1, z0 + t + 3.2); add(mPadGold, .75, .22, .04, 38, 1.95, z0 + t + 3.49);
    plane(F.interior, mCurt, 6.5, 5.2, 32.5, 3.7, z0 + t + .12); plane(F.interior, mCurt, 6.5, 5.2, 43.5, 3.7, z0 + t + .12); plane(F.interior, mCurt, 19.4, .9, 38, 6.45, z0 + t + .14);
    plane(F.interior, mBanner, 7.6, 1.8, 38, 7.0, z0 + t + .05);
    // 농구 골대 2기
    [[13.0, 1], [27.2, -1]].forEach(([z, d]) => {
      add(mMetal, .2, 3.2, .2, 38, 0, z - d * .3, { col: true });
      add(S(null, { color: 0xe6eaec, roughness: .35, metalness: .15 }), 1.8, 1.05, .05, 38, 2.5, z); add(mRust, .5, .36, .052, 38, 2.62, z);
      add(mMetal, .12, .12, Math.abs(.3) + .05, 38, 2.9, z - d * .15); const rim = new THREE.Mesh(new THREE.TorusGeometry(.23, .02, 6, 14), mRust); rim.rotation.x = Math.PI / 2; rim.position.set(38, 2.95, z + d * .35); cur.interior.add(rim);
    });
    // 배구 지주 2개 + 그물 (GYM-007) · 쌓인 체육 매트 (GYM-008)
    model('h133/GYM-007', 31.4, 0, 20, 0, { col: [.26, .26] }); model('h133/GYM-007', 41.6, 0, 20, 0, { col: [.26, .26] });
    { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.strokeStyle = '#d8d8d0'; g.lineWidth = 3; for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); }
      const t2 = new THREE.CanvasTexture(c); t2.wrapS = t2.wrapT = THREE.RepeatWrapping; t2.repeat.set(70, 6); const net = plane(F.interior, new THREE.MeshStandardMaterial({ map: t2, alphaTest: .45, side: THREE.DoubleSide, roughness: .9 }), 10.0, .95, 36.5, 1.95, 20);
      add(S(null, { color: 0xe8e4d8, roughness: .8 }), 10.0, .06, .02, 36.5, 2.4, 20); net.material.map.colorSpace = THREE.SRGBColorSpace; }
    [0, 1, 2].forEach(k => model('h133/GYM-008', 30.2 + k * .04, k * .085, 28.4, Math.PI / 2 + k * .05)); col(29.8, 30.6, 27.6, 29.2, false, .26);

    /* ── 동쪽 관람석 (z: 14.4 ~ 25.2 — 북쪽 무대 z 8.3~12.3 과 완전히 분리!) & 남동쪽 상단 「방송 · 조명 제어실」 (z: 25.2 ~ 29.6) ── */
    for (let k = 0; k < 5; k++) {
      const sx0 = 43.2 + k * .65, sx1 = sx0 + .65, sy = (k + 1) * .32;
      add(mStep, 46.45 - sx0, sy, 10.8, (sx0 + 46.45) / 2, 0, 19.8);
      add(mBlue, .42, .06, 9.2, sx0 + .32, sy, 19.8);
      col(sx0, sx1, 14.4, 25.2, false, sy);
    }
    // 관람석 최상단 회랑 데크 (x: 46.45 ~ 47.68, z: 14.4 ~ 25.2, 높이 1.6m)
    add(mStep, 1.25, 1.6, 10.8, 47.06, 0, 19.8);
    col(46.45, 47.68, 14.4, 25.2, false, 1.6);
    // 관람석 북쪽 끝 안전 난간 (z = 14.45)
    add(mDarkMetal, 4.4, .85, .08, 45.4, 1.6, 14.45);

    // 관람석 남동쪽 코너 상단: 「체육관 방송 · 조명 제어실」 (x: 43.6 ~ 47.68, z: 25.2 ~ 29.65, 바닥 높이 1.6m ~ 천장 4.1m)
    const mBoothWall = S(null, { color: 0x2c343c, roughness: .65, metalness: .25 });
    const mBoothTrim = S(null, { color: 0x1c2228, roughness: .4, metalness: .6 });
    add(mStep, 4.08, 1.6, 4.45, 45.64, 0, 27.42);
    col(43.6, 47.68, 25.2, 29.65, false, 1.6);
    // 부스 천장 지붕 슬래브 (y = 4.05 ~ 4.22m — 동벽 창문 y=5.2 아래에 깔끔하게 마감!)
    add(mBoothTrim, 4.16, .18, 4.5, 45.62, 4.05, 27.42);
    // 부스 북벽 (z = 25.2: 서쪽 2.6m는 무대를 정면으로 바라보는 조망창, 동쪽 x 46.3~47.6 은 관람석 최상단에서 들어오는 출입구!)
    add(mBoothWall, 2.6, 1.0, .16, 44.9, 1.6, 25.28);
    add(mBoothWall, 2.6, .45, .16, 44.9, 3.6, 25.28);
    add(mBoothTrim, 1.4, .35, .16, 46.9, 3.7, 25.28); // 출입구 상인방
    plane(F.interior, mWinIn, 2.4, 1.0, 44.9, 3.1, 25.28, Math.PI); // 무대를 정면으로 바라보는 북쪽 통유리창
    // 부스 서벽 (x = 43.68, z: 25.2 ~ 29.65: 코트를 내려다보는 파노라마 조망창 + 다크메탈 창틀)
    add(mBoothWall, .16, 1.0, 4.45, 43.68, 1.6, 27.42);
    add(mBoothWall, .16, .45, 4.45, 43.68, 3.6, 27.42);
    [25.28, 27.42, 29.55].forEach(pz => add(mBoothTrim, .18, 2.45, .14, 43.68, 1.6, pz));
    plane(F.interior, mWinIn, 4.2, 1.0, 43.68, 3.1, 27.42, -Math.PI / 2); // 코트를 내려다보는 서쪽 통유리창
    // 부스 현판 (서벽 상단 코트 방향 & 북벽 출입구 위)
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('방송 · 조명 제어실', '#14222e', '#e4f0f8', 24) }), 1.8, .34, 43.58, 3.82, 27.42, -Math.PI / 2);
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('방송 · 조명 제어실', '#14222e', '#e4f0f8', 22) }), 1.5, .30, 46.2, 3.82, 25.18, Math.PI);
    // 부스 내부 오디오 믹서 콘솔 · 릴테이프 데크 · 스포트라이트 제어반 (x = 44.8, z = 26.8, y = 1.6m)
    add(mWoodDark, 1.8, .78, .75, 44.9, 1.6, 26.4);
    add(mBlack, .65, .18, .42, 44.6, 2.38, 26.35); add(mBlack, .55, .32, .35, 45.3, 2.38, 26.35);

    /* ── 서쪽 신설 확장 구역: 「체육교사실 · 체육용구 보관실」 (x: 20 ~ 28, z: 12 ~ 26) ── */
    const gx0 = 20.0, gx1 = 28.0, gz0 = 12.0, gz1 = 26.0, gH = 4.2;
    flat(F.interior, mFloorWood, gx0, gx1, gz0, gz1, .01, 2);
    flat(F.interior, mCeil, gx0, gx1, gz0, gz1, gH - .08, 2, false);
    awall(gx0, gx0 + t, gz0, gz1, gH); awall(gx0, gx1, gz0, gz0 + t, gH); awall(gx0, gx1, gz1 - t, gz1, gH);
    // 가운데 칸막이 벽 (북쪽: 체육교사실 z 12~19 / 남쪽: 체육용구 보관실 z 19~26, 가운데 통로 x 23.2~25.2)
    awall(gx0 + t, 23.2, 19.8, 20.05, gH); awall(25.2, gx1, 19.8, 20.05, gH); awall(23.2, 25.2, 19.8, 20.05, gH, 2.4);
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('체육교사실', '#1e2a2e', '#d9e4d0', 26) }), 1.2, .28, 26.2, 2.65, 19.78, Math.PI);
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('체육용구 보관실', '#1e2a2e', '#d9e4d0', 26) }), 1.4, .28, 26.2, 2.65, 20.08, 0);
    // 체육교사실 가구: 교사 책상 2조 · 회전의자 · 작전판 칠판 · 트로피 진열장 · 철제 캐비닛 사물함
    tbl(mWoodDark, 1.6, .75, .8, 22.2, 0, 14.2, { col: true }); deskChair(22.2, 13.3, 0); crt(21.8, .76, 14.1);
    tbl(mWoodDark, 1.6, .75, .8, 25.4, 0, 14.2, { col: true }); deskChair(25.4, 13.3, 0);
    trophyCase(20.6, 16.5, Math.PI / 2, 1.8);
    plane(F.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('제32회 체육대회 결승 대진표  |  계주 마지막 주자: 3-2 윤하늘', '#f0eee6', '#1e2830', 20), roughness: .4 }), 2.8, 1.2, 24.0, 1.75, gz0 + t + .03, 0);
    for (let k = 0; k < 4; k++) add(mLockerT, .62, 1.85, .52, 21.2 + k * .66, 0, 19.45, { col: true, ry: Math.PI });
    // 체육용구 보관실 가구: 대형 용구 선반 2열 · 뜀틀(Vaulting Box) · 농구공 바구니 카트 · 줄다리기 밧줄 · 평균대
    shelf3D(20.6, 22.8, Math.PI / 2, 2.8, 2.1, .55, 4, 0);
    // 5단 뜀틀
    for (let v = 0; v < 5; v++) add(v === 4 ? S(null, { color: 0xc8b898, roughness: .8 }) : mWood, 1.1 - v * .06, .16, .7 - v * .04, 23.2, v * .16, 24.4);
    col(22.5, 23.9, 23.9, 24.9);
    // 농구공 보관 철제 카트
    add(mMetal, 1.3, .85, .8, 26.2, 0, 24.2, { col: true });
    for (let b = 0; b < 6; b++) ball(25.8 + (b % 3) * .38, 24.0 + ((b / 3) | 0) * .35, mBall);
    areaLamp(24, 15.5, gH - .3, 'gym'); areaLamp(24, 23.0, gH - .3, 'gym');

    // 기록석, 전광판 (코트 서쪽)
    add(mWoodDark, 1.2, .8, 2.6, 29.3, 0, 21.4, { col: true }); add(mBlack, .45, .45, .45, 30.4, 0, 22.8);
    plane(F.interior, mScore, 3, 1.1, x0 + t + .03, 3.2, 21.4, Math.PI / 2);
    addKey('gym', 3, 29.3, .8, 21.8); addNote('n9', 29.3, .82, 20.4); tapeRecorder('tape_pe', 29.3, .82, 19.35, Math.PI / 2); tapeRecorder('ts_pe2', 29.1, .82, 22.35, Math.PI / 2);
    cur.photoHere = true; addPhoto('p2', 36.2, 1.1, 11.9, .3);
    for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.12, 16, 12), mBall); b.position.set(rr(31, 42), .12, rr(14, 27)); b.rotation.set(rnd() * 3, rnd() * 3, 0); cur.interior.add(b); }
    // 코트 주변 기구
    add(mMetal, 1, .9, .8, 30.4, 0, 14.5, { col: true }); [0, 1, 2].forEach(k => ball(30.1 + k * .3, 14.5, mBall));
    add(mBlue, 1.6, .5, .8, 25.8, 0, 21.4, { col: true }); add(mGreen, 1.5, .4, .8, 25.8, .5, 21.4);
    add(mWood, .8, .5, .5, 31.5, 0, 25.5, { col: true }); add(mWood, .8, .3, .5, 31.5, .5, 25.5);
    add(mWood, .4, .45, 2.2, 33.5, 0, 28.3, { col: true });
    add(mBlack, .5, .8, .4, x0 + t + .3, 4.8, 12); add(mBlack, .5, .8, .4, x1 - t - .3, 4.8, 12);
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(.15, .45, 8), S(null, { color: 0xc05a20 })); c.position.set(rr(32, 42), .22, rr(15, 26)); cur.interior.add(c); }
    const pud = new THREE.MeshStandardMaterial({ color: 0x2a3640, roughness: .12, metalness: 0, transparent: true, opacity: .55, depthWrite: false });
    [[35, 18], [41, 23], [37, 15]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.CircleGeometry(rr(.8, 1.6), 18), pud); p.rotation.x = -Math.PI / 2; p.position.set(x, .03, z); cur.interior.add(p); });
    papers(38, 12, 28, 18, 8);
    // 기구함 사물함 (파밍용)
    for (let k = 0; k < 3; k++) add(mLockerT, .55, 1.85, .62, x0 + t + .28, 0, 24.2 + k * .66, { col: true });
    lockers.push({ floor: 5, x: x0 + t + .28, z: 24.86, y: 60, dir: { x: 1, z: 0 } });
    addMedkit(25.8, .92, 21.4); addBattery(42.5, 0, 28.4);
    [33, 38, 43].forEach(x => [12, 17, 22, 27].forEach(z => areaLamp(x, z, H - .9, 'gym'))); lightSwitch(39.6, z1 - t - .02, Math.PI, 'gym', '체육관');
    const xs = [33, 38, 41], zs = [14, 20, 26];
    xs.forEach(x => zs.forEach(z => F.nodes.push({ x, z })));
    F.nodes.push({ x: 38, z: 28.4 }); F.entrance = 9;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const k = i * 3 + j; if (j < 2) F.edges.push([k, k + 1]); if (i < 2) F.edges.push([k, k + 3]); }
    F.edges.push([7, 9]);
    F.spawns = [{ x: 33, z: 14.5 }, { x: 41, z: 14.5 }, { x: 33, z: 26 }];
    finishGraph(F);
    doors.push({ floor: 5, x: 38, z: 28.9, r: 1.8, label: '체육관 나가기', to: { floor: 0, x: 38, z: 36.5, yaw: Math.PI } });
  }

  // 수영장 (디자인 시트 5종: 메인 풀 홀 · 안전/관리 구역 · 장비창고/기계실 · 탈의실/락커룸 · 샤워실)
  // 내부는 외관보다 넓게 지어도 된다 (독립 공간). 홀 x -50~-34 · z 30~50, 탈의실/샤워실 z 20~30, 장비창고/기계실 z 50~58
  function buildPool() {
    const F = areaFloor(6, 100), x0 = -50, x1 = -34, z0 = 20, z1 = 58, zh = 50, H = 6.4, t = .3, wz = 30.0;
    const mPool = PB('pooltile', () => T.pbrPoolTile(1024));
    const mSafety = new THREE.MeshStandardMaterial({ map: T.makeSafetySign(), roughness: .8 });
    const mRed = S(null, { color: 0xb02020, roughness: .45 }), mYellow = S(null, { color: 0xd8a818, roughness: .5 }), mWhiteP = S(null, { color: 0xd8d6cc, roughness: .5 });
    const mBlueL = mLockerT.clone(); mBlueL.color.setHex(0x86a8d0);
    const mSteel = S(null, { color: 0x9aa4a8, roughness: .3, metalness: .8 }), mTank = grunge(S(T.makeMetal([96, 138, 132]), { roughness: .6, metalness: .45 }));
    const mPipeR = S(null, { color: 0x8a2018, roughness: .5, metalness: .4 }), mPipeB = S(null, { color: 0x2a4a7a, roughness: .5, metalness: .4 }), mPipeG = S(null, { color: 0x5a6060, roughness: .5, metalness: .6 });
    const mMat = S(null, { color: 0x2a5ab0, roughness: .8 }), mDrain = S(null, { color: 0x2a2c2e, roughness: .4, metalness: .7 });
    const sign = (txt, bg, fg, fs, w, h, x, y, z, ry = 0) => plane(F.interior, new THREE.MeshStandardMaterial({ map: T.makeSign(txt, bg, fg, fs), roughness: .85 }), w, h, x, y, z, ry);
    const wallSignH = (txt, x, y, z, ry, w = 2.6) => sign(txt, '#e8e2d2', '#b01818', 30, w, w * .3, x, y, z, ry);
    // 바닥 (수조 위는 비움) · 천장
    const bx0 = -45.6, bx1 = -37.4, bz0 = 32.0, bz1 = 45.5, D = 1.6, WL = -1.3;
    flat(F.interior, mFloorTile, x0, x1, z0, bz0 - .3, .01, 3); flat(F.interior, mFloorTile, x0, x1, bz1 + .3, z1, .01, 3);
    flat(F.interior, mFloorTile, x0, bx0 - .3, bz0 - .3, bz1 + .3, .01, 3); flat(F.interior, mFloorTile, bx1 + .3, x1, bz0 - .3, bz1 + .3, .01, 3);
    flat(F.interior, mCeil, x0, x1, z0, z1, H - .1, 4, false);
    restroomWC(x1 - t, z0 + t, -1, 1, 3.2, '수영장 화장실');
    // 외벽 (서벽 x0 는 체온유지실 통로 z 24.2~26.2 및 수질관리실·다이빙풀 통로 z 34.0~36.6 을 열어 공간 확장과 연결한다!)
    awall(x0, x0 + t, z0, 24.2, H); awall(x0, x0 + t, 26.2, 34.0, H); awall(x0, x0 + t, 36.6, z1, H);
    awall(x0, x0 + t, 24.2, 26.2, H, 2.4); awall(x0, x0 + t, 34.0, 36.6, H, 2.5);
    awall(x0, x1, z0, z0 + t, H); awall(x0, x1, z1 - t, z1, H);
    awall(x1 - t, x1, z0, 37, H); awall(x1 - t, x1, 39, z1, H); awall(x1 - t, x1, 37, 39, H, 2.6); exitDoors(37, 39, x1 - t, x1, false);
    [37, 39].forEach(z => add(mWoodDark, .4, 2.6, .12, x1 - .15, 0, z));
    exitSign(x1 - t - .05, 2.85, 38, -Math.PI / 2);
    sign('← 체육관 복도', '#20302a', '#d8e8d0', 26, 1.5, .38, x1 - t - .02, 3.4, 35.6, -Math.PI / 2);
    // 높은 창 (덩굴 · 깨진 유리)
    [33, 37.5, 42, 46.5].forEach(z => win3D(F.interior, 3.0, 2.4, x0 + t + .02, 4.3, z, Math.PI / 2));
    [-46, -42, -38].forEach(x => win3D(F.interior, 2.4, 1.4, x, 4.9, z1 - t - .02, Math.PI));

    /* ----- 메인 풀: 수조 · 고인 물 · 레인 줄 · 출발대 · 사다리 ----- */
    flat(F.interior, mPool, bx0, bx1, bz0, bz1, -D, 2);
    F.interior.add(boxMesh(bx0 - .3, bx0, -D, 0, bz0 - .3, bz1 + .3, mPool, 2)); F.interior.add(boxMesh(bx1, bx1 + .3, -D, 0, bz0 - .3, bz1 + .3, mPool, 2));
    F.interior.add(boxMesh(bx0, bx1, -D, 0, bz0 - .3, bz0, mPool, 2)); F.interior.add(boxMesh(bx0, bx1, -D, 0, bz1, bz1 + .3, mPool, 2));
    const lane = new THREE.MeshBasicMaterial({ color: 0x0a1218 }), LW = (bx1 - bx0) / 4;   // 4레인 (참고 계획안)
    for (let k = 0; k < 4; k++) flat(F.interior, lane, bx0 + (k + .5) * LW - .08, bx0 + (k + .5) * LW + .08, bz0 + 1, bz1 - 1, -D + .01, 1);
    // 가장자리 넘침 홈 (그레이팅)
    [[bx0 - .55, bx0 - .3, bz0 - .55, bz1 + .55], [bx1 + .3, bx1 + .55, bz0 - .55, bz1 + .55]].forEach(([a, b, c, d]) => flat(F.interior, mDrain, a, b, c, d, .015, .3));
    // 고인 물: 탁한 녹색, 낙엽 · 부유물
    const water = new THREE.Mesh(new THREE.PlaneGeometry(bx1 - bx0, bz1 - bz0), new THREE.MeshStandardMaterial({ color: 0x1e3c34, roughness: .04, metalness: .35, transparent: true, opacity: .74, depthWrite: false }));
    water.rotation.x = -Math.PI / 2; water.position.set((bx0 + bx1) / 2, WL, (bz0 + bz1) / 2); F.interior.add(water); water.userData.dynamic = true; POOL.water = water;
    { const leafG = new THREE.CircleGeometry(.07, 5); leafG.rotateX(-Math.PI / 2); const lm = [];
      for (let k = 0; k < 160; k++) lm.push(MX(rr(bx0 + .1, bx1 - .1), WL + .005, rr(bz0 + .1, bz1 - .1), rnd() * 6));
      const im = inst(F.interior, leafG, S(null, { color: 0xffffff, roughness: .9, side: THREE.DoubleSide }), lm); lm.forEach((_, i) => im.setColorAt(i, new THREE.Color(pick([0x7a6a30, 0x5a4a22, 0x8a5a2a, 0x4a5a2a])))); }
    // 레인 줄: 빨강 · 흰색 · 파랑 부표 (물 위에 뜨고, 일부는 끊어져 가라앉음)
    { const fg = new THREE.SphereGeometry(.07, 8, 6); fg.scale(1, .8, 1.4); const ms = [], cols = [];
      for (let k = 1; k < 4; k++) { const x = bx0 + k * LW, broken = k === 2;
        for (let z = bz0 + .15, i = 0; z < bz1 - .1; z += .19, i++) {
          if (broken && z > 37 && z < 40) continue;
          const sag = broken && z > 40 && z < 41.2 ? -.18 * Math.sin((z - 40) / 1.2 * Math.PI) : 0;
          ms.push(MX(x + Math.sin(z * 1.7 + k) * .03, WL + .03 + sag, z)); const end = z < bz0 + 4.6 || z > bz1 - 4.6;
          cols.push(end ? (i % 2 ? 0xc02020 : 0xd8b020) : (i % 4 < 2 ? 0x2048a0 : 0xd8b020)); } }
      const im = inst(F.interior, fg, S(null, { roughness: .45 }), ms); cols.forEach((c, i) => im.setColorAt(i, new THREE.Color(c))); }
    // 출발대 1~6 (남쪽 끝)
    // 남쪽 끝은 벽과 수조 사이 통로가 좁아 출발대가 길을 막았다 → 넓은 북쪽 데크로 (사다리 자리 1 · 6 레인은 비움)
    for (let k = 0; k < 4; k++) { const x = bx0 + (k + .5) * LW;
      meshAt(merge([bx(.55, .7, .5, 0, .35, 0), bx(.6, .06, .62, 0, .73, .04), tube(.012, -.22, .76, .3, -.22, .9, .32), tube(.012, .22, .76, .3, .22, .9, .32)]), mWhiteP, x, 0, bz1 + .27, Math.PI);
      plane(F.interior, S(T.makeNumber(k + 1)), .34, .34, x, .42, bz1 + .53, 0); col(x - .28, x + .28, bz1, bz1 + .52); }
    // 배영 표시 깃발 줄 (양 끝 5m)
    [bz0 + 5, bz1 - 5].forEach(z => { meshAt(merge([tube(.006, bx0 - .4, 1.9, z, bx1 + .4, 1.9, z), tube(.03, bx0 - .4, 0, z, bx0 - .4, 2.0, z), tube(.03, bx1 + .4, 0, z, bx1 + .4, 2.0, z)]), mSteel, 0, 0, 0); for (let k = 0; k < 16; k++) { const fl = new THREE.Mesh(new THREE.ConeGeometry(.12, .25, 3), S(null, { color: [0xc02020, 0x2048a0, 0xd8b020][k % 3], roughness: .6 })); fl.rotation.z = Math.PI; fl.position.set(bx0 - .2 + k * (bx1 - bx0 + .4) / 15, 1.76, z); F.interior.add(fl); } col(bx0 - .45, bx0 - .35, z - .05, z + .05); col(bx1 + .35, bx1 + .45, z - .05, z + .05); });
    // 풀 사다리 (스테인리스)
    [[bx0 + .9, bz0, -1], [bx1 - .9, bz0, -1]].forEach(([x, z, s]) => {   // 북쪽 끝은 출발대 4개 (사다리는 남쪽 끝)
      const L = []; [-.25, .25].forEach(dx => { L.push(tube(.022, dx, -D, -s * .12, dx, .2, -s * .12), tube(.022, dx, .2, -s * .12, dx, .95, s * .25), tube(.022, dx, .95, s * .25, dx, 0, s * .45)); });
      for (let r = 0; r < 4; r++) L.push(bx(.5, .03, .08, 0, -D + .3 + r * .4, -s * .1));
      meshAt(merge(L), mSteel, x, 0, z); });
    // 경고 표지 · 배너
    wallSignH('깊은 곳 위험  뛰지 마시오', -40.5, 3.0, zh - t - .02, Math.PI, 3.4);
    sign('안전한 수영 우리의 약속입니다', '#eeeae0', '#a82020', 26, 3.6, .9, x1 - t - .02, 2.9, 44.2, -Math.PI / 2);
    [[-46.6, 31.0], [-36.3, 46.9]].forEach(([x, z]) => meshAt(merge([bx(.36, .6, .02, 0, .3, .1).rotateX(-.25), bx(.36, .6, .02, 0, .3, -.1).rotateX(.25)]), mYellow, x, 0, z, rnd()));   // 미끄럼 주의 A 보드
    plane(F.interior, mSafety, 1.6, .8, x0 + t + .03, 2.2, 40.6, Math.PI / 2);
    // 만국기 줄 (홀을 가로지르는 삼각 깃발)
    { const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-.14, 0, 0, .14, 0, 0, 0, -.3, 0], 3)); tri.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
      const fm = [], fc = []; [35, 41, 47].forEach(z => { for (let x = x0 + .6; x < x1 - .6; x += .42) { const u = (x - x0) / (x1 - x0); fm.push(MX(x, 5.4 - Math.sin(u * Math.PI) * .9, z, 0, rr(-.1, .1))); fc.push(pick([0xb02424, 0x2448a0, 0xe8d8b0, 0xc89a20, 0x2a7a4a])); } });
      const im = inst(F.interior, tri, S(null, { roughness: .9, side: THREE.DoubleSide }), fm); fc.forEach((c, i) => im.setColorAt(i, new THREE.Color(c))); }
    // 전광판(레인 · 기록 · 순위) + 벽시계 (북쪽 벽)
    { const sb = T.ctex(256, 200, (g, w, h) => { g.fillStyle = '#0c1210'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a4a40'; g.lineWidth = 2; g.strokeRect(4, 4, w - 8, h - 8);
        g.fillStyle = '#c8d8c0'; g.font = `bold 20px ${T.FONT}`; g.textAlign = 'center'; ['레인', '기록', '순위'].forEach((s2, i) => g.fillText(s2, [40, 130, 215][i], 30));
        g.font = 'bold 20px monospace'; for (let k = 1; k <= 6; k++) { g.fillStyle = '#e8e0c0'; g.fillText(String(k), 40, 30 + k * 26); g.fillStyle = k === 4 ? '#ff4030' : '#3a4a40'; g.fillText(k === 4 ? '--:--.--' : '00:00.00', 130, 30 + k * 26); } }, { repeat: false });
      add(mBlack, 3.0, 2.4, .12, -42.3, 2.9, zh - t - .06); plane(F.interior, new THREE.MeshBasicMaterial({ map: sb, color: 0x9aa89a }), 2.8, 2.2, -42.3, 4.1, zh - t - .125, Math.PI);
      plane(F.interior, mClockM, .9, .9, -38.6, 4.6, zh - t - .02, Math.PI); }
    // 서쪽 관람석 (통로 z 34.0~36.6 을 비우고 z 37.4~46.6 구간에 깔끔하게 재배치)
    for (let k = 0; k < 3; k++) { add(mStep, 2.2 - k * .7, .42 * (k + 1), 9.2, x0 + t + (2.2 - k * .7) / 2, 0, 42.0); add(mWood, .35, .05, 8.8, x0 + t + 2.2 - k * .7 - .24, .42 * (k + 1) + .02, 42.0); }
    col(x0, x0 + 2.55, 37.4, 46.6);
    meshAt(merge([tube(.025, x0 + 2.65, 1.0, 37.4, x0 + 2.65, 1.0, 46.6), ...[37.4, 39.7, 42.0, 44.3, 46.6].map(z => tube(.02, x0 + 2.65, 0, z, x0 + 2.65, 1.0, z)), tube(.018, x0 + 2.65, .5, 37.4, x0 + 2.65, .5, 46.6)]), mRust, 0, 0, 0);
    // 천장 대형 채광 스카이라이트 트러스 빔
    for (let z = 33; z <= 47; z += 3.5) add(mSteel, x1 - x0 - .6, .22, .18, (x0 + x1) / 2, H - .22, z);

    /* ----- 신설 확장 구역 1: 체온유지실 · 건식 사우나실 (x -57.5 ~ -50, z 21 ~ 29.5) ----- */
    { const sx0 = -57.5, sx1 = -50.0, sz0 = 21.0, sz1 = 29.5, sH = 3.8, mHinoki = S(null, { color: 0xb88a58, roughness: .72 });
      flat(F.interior, mHinoki, sx0, sx1, sz0, sz1, .01, 2);
      flat(F.interior, mHinoki, sx0, sx1, sz0, sz1, sH - .08, 2, false);
      awall(sx0, sx0 + t, sz0, sz1, sH, 0, mHinoki); awall(sx0, sx1, sz0, sz0 + t, sH, 0, mHinoki); awall(sx0, sx1, sz1 - t, sz1, sH, 0, mHinoki);
      sign('← 체온유지실 · 사우나', '#3a2414', '#f2e0c0', 24, 1.5, .34, x0 + t + .03, 2.65, 25.2, Math.PI / 2);
      sign('체온유지실 — 저체온증 예방', '#3a2414', '#f2e0c0', 24, 2.2, .38, -53.8, 2.75, sz1 - t - .03, Math.PI);
      // 2단 편백나무 사우나 벤치 (서벽 · 북벽)
      add(mHinoki, 1.1, .42, 6.8, sx0 + t + .55, 0, 25.2, { col: true }); add(mHinoki, .55, .82, 6.8, sx0 + t + .28, 0, 25.2);
      add(mHinoki, 4.2, .42, .9, -53.6, 0, sz1 - t - .45, { col: true });
      // 사우나 맥반석 발열 스토브 & 열기 글로우
      add(mSteel, .85, .95, .85, -55.6, 0, 22.4, { col: true });
      add(S(null, { color: 0x3a1810, emissive: 0xff4818, emissiveIntensity: .65, roughness: .9 }), .68, .12, .68, -55.6, .92, 22.4);
      glowAt(-55.6, 1.25, 22.4, 1.2, T.makeGlow('255,110,50'));
      // 온수 족욕조 (남동쪽)
      add(mPool, 2.2, .38, 1.2, -52.4, 0, 22.3, { col: true });
      plane(F.interior, new THREE.MeshStandardMaterial({ color: 0x389890, transparent: true, opacity: .72, roughness: .1 }), 1.9, .9, -52.4, .34, 22.3, 0, -Math.PI / 2);
      areaLamp(-53.8, 25.2, sH - .25, 'poolLocker');
    }

    /* ----- 신설 확장 구역 2: 수질관리실 · 다이빙 보조풀 (x -58.5 ~ -50, z 32.0 ~ 48.0) ----- */
    { const dx0 = -58.5, dx1 = -50.0, dz0 = 32.0, dz1 = 48.0, dH = 6.0;
      // 다이빙 보조 수조 (x -56.8 ~ -52.0, z 38.5 ~ 46.2) 주변 데크 바닥
      flat(F.interior, mFloorTile, dx0, dx1, dz0, 38.5, .01, 2);
      flat(F.interior, mFloorTile, dx0, dx1, 46.2, dz1, .01, 2);
      flat(F.interior, mFloorTile, dx0, -56.8, 38.5, 46.2, .01, 2);
      flat(F.interior, mFloorTile, -52.0, dx1, 38.5, 46.2, .01, 2);
      flat(F.interior, mCeil, dx0, dx1, dz0, dz1, dH - .1, 3, false);
      awall(dx0, dx0 + t, dz0, dz1, dH); awall(dx0, dx1, dz0, dz0 + t, dH); awall(dx0, dx1, dz1 - t, dz1, dH);
      sign('← 수질관리실 · 다이빙 풀', '#183238', '#d8f4f0', 24, 1.8, .36, x0 + t + .03, 2.75, 35.3, Math.PI / 2);
      // 다이빙 보조 수조 (깊이 2.4m) + 수면 + 안전 난간
      flat(F.interior, mPool, -56.8, -52.0, 38.5, 46.2, -2.2, 2);
      F.interior.add(boxMesh(-57.0, -56.8, -2.2, 0, 38.3, 46.4, mPool, 2), boxMesh(-52.0, -51.8, -2.2, 0, 38.3, 46.4, mPool, 2), boxMesh(-56.8, -52.0, -2.2, 0, 38.3, 38.5, mPool, 2), boxMesh(-56.8, -52.0, -2.2, 0, 46.2, 46.4, mPool, 2));
      col(-56.8, -52.0, 38.5, 46.2); // 수조 추락 방지 충돌
      // 스프링보드 다이빙대 (북쪽 끝 z 46.3 → 남쪽 수조로 돌출)
      add(mWhiteP, .9, 1.45, .8, -54.4, 0, 46.6, { col: true });
      add(S(null, { color: 0x2868b8, roughness: .4 }), .52, .08, 2.4, -54.4, 1.48, 45.4);
      // 남쪽 수질관리 실험대 · 시약 선반 · 3연동 배수 밸브 제어반 (z 32.5 ~ 37.2)
      tbl(mWhiteP, 2.6, .85, .75, -54.5, 0, 33.0, { col: true });
      shelf3D(-57.8, 35.2, Math.PI / 2, 2.2, 1.9, .45, 4, 0);
      add(mPipeG, 1.2, 1.5, .35, -51.6, .4, 32.6, { col: true });
      sign('수질 측정 · 다이빙 풀 배수 제어반', '#1e2e34', '#d8f0e8', 22, 1.8, .32, -51.6, 2.25, 32.45, 0);
      areaLamp(-54.2, 35.5, dH - .4, 'poolHall'); areaLamp(-54.2, 42.5, dH - .4, 'poolHall');
    }
    // 남쪽 벤치 존
    // (탈의실 · 샤워실 출입구 앞은 비워 둔다)
    [[-42.2, 1.4], [-35.6, 1.3]].forEach(([x, w]) => { meshAt(merge([bx(w, .05, .38, 0, .44, 0), bx(.06, .42, .3, -w / 2 + .12, .21, 0), bx(.06, .42, .3, w / 2 - .12, .21, 0)]), mWood, x, 0, 30.95); col(x - w / 2, x + w / 2, 30.75, 31.15); });

    /* ----- 안전 / 관리 구역 (동쪽 · 출입구 옆) ----- */
    // 감시대 (빨간 라이프가드 의자 · 사다리)
    { const L = [], h = 1.6; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => L.push(tube(.03, -35.8 + a * .34, 0, 44 + b * .34, -35.8 + a * .26, h, 44 + b * .2)));
      for (let r = 1; r < 5; r++) L.push(tube(.018, -35.8 - .33 + r * .005, r * .32, 44 - .33, -35.8 + .33 - r * .005, r * .32, 44 - .33));
      meshAt(merge(L), mRed, 0, 0, 0); add(mRed, .7, .08, .6, -35.8, h, 44); add(mRed, .7, .55, .06, -35.8, h + .08, 44.3);
      [-1, 1].forEach(s => add(mRed, .05, .04, .5, -35.8 + s * .34, h + .35, 44.05)); col(-36.2, -35.4, 43.6, 44.4); }
    addKey('pool', 4, -35.8, 1.68, 44);
    // 구명 튜브(벽) · 구급함 · 방송 스피커 · 비상 전화 · 소화기 · 안전요원 의자
    const ringG = new THREE.TorusGeometry(.28, .08, 10, 20), ringM = S(null, { color: 0xe05a20, roughness: .55 });
    [[x1 - t - .1, 1.6, 41.6], [x0 + t + .1, 1.6, 31.6]].forEach(([x, y, z]) => meshAt(ringG, ringM, x, y, z, Math.PI / 2));
    { const fa = new THREE.MeshStandardMaterial({ map: T.makeSign('응급처치', '#e8e8e0', '#c01818', 34), roughness: .6 });
      add(mWhiteP, .6, .7, .2, x1 - t - .1, 1.2, 42.9); plane(F.interior, fa, .5, .14, x1 - t - .205, 1.75, 42.9, -Math.PI / 2);
      const cr = new THREE.MeshBasicMaterial({ color: 0xc01818 }); plane(F.interior, cr, .22, .07, x1 - t - .205, 1.5, 42.9, -Math.PI / 2); plane(F.interior, cr, .07, .22, x1 - t - .206, 1.5, 42.9, -Math.PI / 2); }
    [[x1 - t - .25, 4.6, 33.5], [x0 + t + .25, 4.6, 44], [-42, 4.8, zh - t - .25]].forEach(([x, y, z], i) => { const sp = meshAt(merge([new THREE.CylinderGeometry(.06, .2, .32, 14, 1, true).rotateX(Math.PI / 2), new THREE.CylinderGeometry(.07, .07, .12, 10).rotateX(Math.PI / 2).translate(0, 0, -.2)]), mWhiteP, x, y, z, [Math.PI / 2 + Math.PI, Math.PI / 2, 0][i]); sp.rotation.x = .3; });
    add(mRed, .26, .5, .18, x1 - t - .1, 1.1, 46.2); extinguisher(x1 - t - .25, 46.9); extinguisher(x0 + t + .25, 48.6);
    plane(F.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('비상전화', '#b01818', '#f0e0d0', 28), roughness: .7 }), .26, .1, x1 - t - .205, 1.7, 46.2, -Math.PI / 2);
    // 관리 / 매표 데스크 + 회전식 출입 게이트 + 신발장
    meshAt(merge([bx(1.9, .9, .6, 0, .45, 0), bx(2.0, .04, .7, 0, .92, -.05)]), mWoodDark, -35.4, 0, 34.6, Math.PI / 2); col(-35.75, -35.05, 33.6, 35.6);
    crt(-35.3, .97, 34.2); plane(F.interior, mDirtPaper, .3, .22, -35.4, .955, 35.0, 0, -Math.PI / 2); deskChair(-34.75, 34.9, Math.PI / 2);
    { const tg = merge([bx(.25, .95, .5, 0, .475, 0), new THREE.CylinderGeometry(.06, .06, .12, 10).translate(0, .95, 0), ...[0, 2.09, 4.19].map(a => tube(.018, 0, .95, 0, Math.cos(a) * .45, .95, Math.sin(a) * .45))]);
      meshAt(tg, mSteel, -36.6, 0, 36.6); meshAt(tg, mSteel, -36.6, 0, 39.4, Math.PI); col(-36.75, -36.45, 36.3, 36.9); col(-36.75, -36.45, 39.1, 39.7); }
    meshAt(merge([...Array.from({ length: 4 }, (_, r) => bx(1.2, .02, .35, 0, .05 + r * .32, 0)), bx(.02, 1.2, .35, -.6, .6, 0), bx(.02, 1.2, .35, .6, .6, 0), bx(1.2, 1.2, .02, 0, .6, -.17)]), mWood, x1 - t - .2, 0, 32.2, -Math.PI / 2); col(x1 - t - .4, x1 - t, 31.6, 32.8);
    for (let k = 0; k < 7; k++) meshAt(new THREE.BoxGeometry(.1, .06, .26), S(null, { color: pick([0x2a2a30, 0x3a5aa0, 0x8a2a2a, 0xd8d0c0]), roughness: .6 }), x1 - t - .2, .09 + ((k / 2) | 0) * .32, 31.8 + (k % 2) * .25, Math.PI / 2 + rr(-.3, .3));
    // 안전요원 의자 (플라스틱)
    const chairP = merge([bx(.42, .04, .42, 0, .44, 0), bx(.42, .4, .03, 0, .66, .2), ...[[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]].map(([a, b]) => tube(.016, a, 0, b, a, .44, b))]);
    [[-36.9, 45.6, 2.6], [-47.6, 31.3, .3]].forEach(([x, z, r]) => meshAt(chairP, mWhiteP, x, 0, z, r));
    add(mWood, .5, .45, 2.2, -35.2, 0, 40.4, { col: true }); addNote('n10', -35.2, .47, 40.0); addMedkit(-35.2, .47, 41.0);
    blood('drag', -41.5, .02, 46.8, 1.6, .3, true);
    // 수영장 장비 보관함 (북서쪽: 킥보드 · 레인 줄 릴 · 구명 튜브 'GUARD')
    { const sx = -48.3, sz = 48.6; shelf3D(sx, sz, Math.PI / 2, 2.2, 1.9, .5, 4, 0);
      for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) add(S(null, { color: [0x2a60c0, 0xd8b020, 0xc02828][(k + r) % 3], roughness: .55 }), .05, .38, .28, sx + .05, .08 + r * .47, sz - .8 + k * .52, { ry: Math.PI / 2 + rr(-.2, .2) });
      const tubeM = S(T.makeSign('GUARD', '#c01818', '#f0e8e0', 40), { roughness: .5 }); [[-47.6, 47.3], [-47.4, 49.9]].forEach(([x, z]) => add(tubeM, .9, .16, .22, x, .0, z, { ry: rr(-.4, .4) })); }

    /* ----- 장비창고 / 기계실 (북쪽, z 50~58) ----- */
    awall(x0, -41, zh, zh + t, H); awall(-39, x1, zh, zh + t, H); awall(-41, -39, zh, zh + t, H, 2.5);
    [-41, -39].forEach(x => add(mWoodDark, .12, 2.5, .4, x, 0, zh + .15));
    sign('기계실 · 장비창고', '#3a2a1a', '#e0d0b0', 26, 1.6, .4, -40, 2.85, zh - .02, Math.PI);
    awall(-43.5, -43.2, zh + t, 53, H); awall(-43.5, -43.2, 54.6, z1 - t, H); awall(-43.5, -43.2, 53, 54.6, H, 2.4);   // 창고 | 기계실 칸막이 (가운데 출입구)
    flat(F.interior, mDrain, -41.2, -38.8, 53.8, 54.2, .015, .4);   // 바닥 트렌치
    // 장비창고 (서쪽): 철제 선반 · 레인 줄 릴 · 킥보드 · 작업대 · 공구함 · 청소 카트
    shelf3D(x0 + t + .3, 54, Math.PI / 2, 3.6, 2.2, .55, 4, 0);
    { const fg = new THREE.SphereGeometry(.09, 8, 6), ms = [], cs = [];
      for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) { const cx2 = x0 + t + .32, cz = 52.9 + k * 1.9, cy = .38 + r * .54;
        for (let a = 0; a < 18; a++) { const an = a / 18 * 6.28; ms.push(MX(cx2, cy + Math.sin(an) * .2, cz + Math.cos(an) * .5)); cs.push([0xc02020, 0xe8e8e0, 0x2448a0][(a + r) % 3]); } }
      const im = inst(F.interior, fg, S(null, { roughness: .45 }), ms); cs.forEach((c, i) => im.setColorAt(i, new THREE.Color(c))); }
    add(mWood, 2.2, .85, .7, -46.3, 0, z1 - t - .4, { col: true }); add(mBlack, 2.2, 1.0, .03, -46.3, 1.05, z1 - t - .02);
    for (let k = 0; k < 7; k++) add(mSteel, .03, rr(.18, .3), .02, -47.2 + k * .3, 1.35, z1 - t - .05);
    add(mRed, .5, .35, .3, -47.0, .85, z1 - t - .4); add(mRed, .55, .8, .45, -44.3, 0, z1 - t - .3, { col: true });
    for (let k = 0; k < 3; k++) add(mRed, .5, .02, .4, -44.3, .2 + k * .25, z1 - t - .52);
    mopBucket(-44.3, 51.4);
    { const nm = new THREE.Mesh(new THREE.TorusGeometry(.18, .012, 6, 18), mSteel); nm.position.set(-48.9, 1.5, 51.2); nm.rotation.y = Math.PI / 2; F.interior.add(nm); add(mSteel, .02, 1.6, .02, -48.9, 0, 51.2, { rz: .1 }); }
    for (let k = 0; k < 3; k++) cyl(S(null, { color: 0xe8e8e0, roughness: .4 }), .12, .32, -45.6 + k * .3, 0, 51.0, 12);
    meshAt(merge([tube(.02, -.3, 0, 0, -.2, 1.8, .2), tube(.02, .3, 0, 0, .2, 1.8, .2), ...[.4, .8, 1.2, 1.6].map(y => tube(.015, -.28 + y * .045, y, y * .11, .28 - y * .045, y, y * .11))]), mSteel, -43.9, 0, 55.4, -Math.PI / 2);
    // 기계실 (동쪽): 여과 필터 탱크 2기 · 순환 펌프 · 배관/밸브 · 제어 패널 · 약품 보관함
    [[-41.85, 55.3], [-36.2, 52.6]].forEach(([x, z]) => {
      meshAt(merge([new THREE.CylinderGeometry(.75, .75, 1.6, 20).translate(0, 1.0, 0), new THREE.SphereGeometry(.75, 20, 10, 0, 6.3, 0, Math.PI / 2).scale(1, .55, 1).translate(0, 1.8, 0), new THREE.SphereGeometry(.75, 20, 10, 0, 6.3, Math.PI / 2, Math.PI / 2).scale(1, .45, 1).translate(0, .2, 0)]), mTank, x, 0, z);
      meshAt(merge([0, 1.57, 3.14, 4.71].map(a => tube(.035, Math.cos(a) * .55, 0, Math.sin(a) * .55, Math.cos(a) * .6, .3, Math.sin(a) * .6))), mPipeG, x, 0, z);
      const gg = meshAt(new THREE.CylinderGeometry(.09, .09, .04, 16).rotateX(Math.PI / 2), mWhiteP, x, 1.5, z - .78); gg.rotation.y = 0;
      col(x - .8, x + .8, z - .8, z + .8); });
    [[-38.6, 56.6], [-37.4, 56.6]].forEach(([x, z]) => { meshAt(merge([bx(.7, .12, .4, 0, .06, 0), new THREE.CylinderGeometry(.18, .18, .5, 14).rotateZ(Math.PI / 2).translate(-.05, .36, 0), new THREE.CylinderGeometry(.14, .14, .22, 12).rotateZ(Math.PI / 2).translate(.3, .36, 0)]), mPipeB, x, 0, z); col(x - .4, x + .4, z - .25, z + .25); });
    { const P2 = [], PR = [], PB = [], val = [];
      PR.push(tube(.08, -40.9, 2.25, 56.3, -40.9, 2.9, 56.3), tube(.08, -40.9, 2.9, 56.3, -36.2, 2.9, 56.3), tube(.08, -36.2, 2.9, 56.3, -36.2, 2.2, 52.6), tube(.08, -38.6, .36, 56.6, -38.6, 2.9, 56.6));
      PB.push(tube(.07, -42.8, .4, 57.4, -35, .4, 57.4), tube(.07, -35, .4, 57.4, -35, 3.4, 57.4), tube(.07, -42.8, 3.4, 57.4, -35, 3.4, 57.4), tube(.06, -37.4, .36, 56.6, -37.4, .36, 57.4));
      P2.push(tube(.05, -42.8, 2.6, 51, -42.8, 2.6, 57.5), tube(.05, x1 - t - .15, .6, 51, x1 - t - .15, .6, 57.5), tube(.05, x1 - t - .15, .6, 51, x1 - t - .15, 3.5, 51));
      meshAt(merge(PR), mPipeR, 0, 0, 0); meshAt(merge(PB), mPipeB, 0, 0, 0); meshAt(merge(P2), mPipeG, 0, 0, 0);
      [[-40.9, 2.6, 56.3, 0], [-38.6, 1.6, 56.6, 0], [-36.2, 2.6, 54.5, Math.PI / 2], [-39, .4, 57.25, 0], [-35.15, 1.8, 57.4, Math.PI / 2]].forEach(([x, y, z, r]) => { const w = new THREE.Mesh(merge([new THREE.TorusGeometry(.17, .022, 6, 18), bx(.32, .025, .025, 0, 0, 0), bx(.025, .32, .025, 0, 0, 0)]), mPipeR); w.position.set(x, y, z - (r ? 0 : .12)); w.rotation.y = r; F.interior.add(w); }); }
    { const pnl = T.ctex(128, 192, (g, w, h) => { g.fillStyle = '#9a9e98'; g.fillRect(0, 0, w, h); g.fillStyle = '#6a6e68'; g.fillRect(6, 6, w - 12, h - 12); for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) { g.fillStyle = ['#3dff6a', '#ffb02a', '#ff3a2a', '#2a2a2a'][(r + k * 2) % 4]; g.beginPath(); g.arc(28 + k * 36, 30 + r * 26, 7, 0, 6.3); g.fill(); } g.fillStyle = '#222'; for (let k = 0; k < 4; k++) g.fillRect(18 + k * 24, 140, 12, 26); g.fillStyle = '#e8d020'; g.fillRect(14, 172, 100, 10); g.fillStyle = '#111'; g.font = `bold 9px ${T.FONT}`; g.fillText('순환 펌프 제어', 22, 180); }, { repeat: false });
      add(mPipeG, .9, 1.4, .3, -38.0, .5, z1 - t - .16); plane(F.interior, new THREE.MeshStandardMaterial({ map: pnl, roughness: .5, emissive: 0xffffff, emissiveMap: pnl, emissiveIntensity: .12 }), .86, 1.36, -38.0, 1.2, z1 - t - .31 - .005, Math.PI);
      add(mPipeG, .7, 1.0, .25, x1 - t - .14, .9, 54.5, { ry: Math.PI / 2 }); }
    wallSignH('염소약품  취급주의', -36.3, 2.2, zh + t + .02, 0, 1.8);
    add(mWhiteP, .9, 1.2, .5, -35.0, 0, 51.2, { col: true }); [-.25, 0, .25].forEach(dx => cyl(S(null, { color: 0xeeeeee, roughness: .4 }), .1, .3, -35.0 + dx, 1.2, 51.2, 12));
    // 지하 펌프실로 내려가는 사다리 (바닥 해치)
    { const hx = -40.2, hz = 57.1; add(mDrain, 1.0, .06, .9, hx, 0, hz); add(mBlack, .8, .01, .7, hx, .06, hz);
      meshAt(merge([tube(.02, -.3, .07, 0, -.3, 1.1, -.1), tube(.02, .3, .07, 0, .3, 1.1, -.1)]), mSteel, hx, 0, hz - .3); col(hx - .5, hx + .5, hz - .45, hz + .45); }
    sign('▼ 지하 펌프실', '#3a1a1a', '#e0c8a8', 28, 1.0, .26, -40.2, 2.0, z1 - t - .02, Math.PI);

    /* ----- 탈의실 / 락커룸 (남서, x -50~-41.65 · z 20~30) ----- */
    const signM = n => new THREE.MeshBasicMaterial({ map: T.makeSign(n, '#1e2a2e', '#d9e4d0', 28), color: 0x9aa59a });
    // 출입구 폭 1.5m (탈의실 -45.25~-43.75 · 샤워실 -38.25~-36.75)
    awall(x0 + t, -45.25, wz, wz + t, H); awall(-43.75, -41.65, wz, wz + t, H); awall(-41.65, -41.35, z0 + t, wz, H);
    awall(-41.35, -38.25, wz, wz + t, H); awall(-36.75, x1 - t, wz, wz + t, H);
    awall(-45.25, -43.75, wz, wz + t, H, 2.4); awall(-38.25, -36.75, wz, wz + t, H, 2.4);
    [-45.25, -43.75, -38.25, -36.75].forEach(x => add(mWoodDark, .1, 2.4, .4, x, 0, wz + t / 2));
    plane(F.interior, signM('탈의실'), 1.4, .35, -44.5, 2.7, wz + t + .02, 0); plane(F.interior, signM('샤워실'), 1.4, .35, -37.5, 2.7, wz + t + .02, 0);
    // 파란 철제 락커 (북벽 · 서벽 · 가운데 등 맞댄 줄)
    for (let k = 0; k < 4; k++) add(mBlueL, .62, 1.85, .55, -49.4 + k * .66, 0, wz - .3, { col: true, ry: Math.PI });
    [21.2, 21.86, 22.52, 27.0, 27.66, 28.32].forEach(lz => add(mBlueL, .62, 1.85, .55, x0 + t + .3, 0, lz, { col: true, ry: Math.PI / 2 }));
    for (let k = 0; k < 5; k++) { add(mBlueL, .6, 1.85, .5, -47.3 + k * .62, 0, 24.75, { col: true }); add(mBlueL, .6, 1.85, .5, -47.3 + k * .62, 0, 24.25, { col: true, ry: Math.PI }); }
    lockers.push({ floor: 6, x: -47.3 + 2 * .62, z: 25.0, y: 100, dir: { x: 0, z: 1 } }, { floor: 6, x: -49.4 + 2 * .66, z: wz - .3, y: 100, dir: { x: 0, z: -1 } });
    { const doorOpen = new THREE.Mesh(new THREE.BoxGeometry(.58, 1.8, .03), mBlueL); doorOpen.position.set(-46.75, .93, 25.35); doorOpen.rotation.y = -1.1; F.interior.add(doorOpen); }
    // 나무 벤치 2줄 · 빨간 플라스틱 의자 · 바구니 · 옷걸이 · 수건
    const benchG = merge([bx(2.6, .05, .36, 0, .44, 0), bx(.3, .42, .3, -1.05, .21, 0), bx(.3, .42, .3, 1.05, .21, 0)]);
    [[-46.1, 27.6], [-46.1, 22.4]].forEach(([x, z]) => { meshAt(benchG, mWood, x, 0, z); col(x - 1.3, x + 1.3, z - .2, z + .2); });
    const stoolR = merge([new THREE.CylinderGeometry(.16, .14, .03, 12).translate(0, .4, 0), ...[0, 1.57, 3.14, 4.71].map(a => tube(.02, Math.cos(a + .78) * .1, .4, Math.sin(a + .78) * .1, Math.cos(a + .78) * .16, 0, Math.sin(a + .78) * .16))]);
    [[-48.8, 26.4], [-43.2, 21.4], [-42.6, 28.8]].forEach(([x, z]) => meshAt(stoolR, S(null, { color: 0xc02020, roughness: .5 }), x, 0, z, rnd()));
    const basketG = merge([bx(.5, .02, .36, 0, .01, 0), bx(.5, .28, .02, 0, .15, .17), bx(.5, .28, .02, 0, .15, -.17), bx(.02, .28, .36, .24, .15, 0), bx(.02, .28, .36, -.24, .15, 0)]);
    [[-44.6, 22.0, 0x2a5ab0], [-48.4, 28.9, 0xc02828], [-46.9, 27.6, 0x2a5ab0]].forEach(([x, z, c], i) => meshAt(basketG, S(null, { color: c, roughness: .6 }), x, i === 2 ? .47 : 0, z, rnd()));
    for (let k = 0; k < 5; k++) { add(mSteel, .03, .03, .12, -43.0 + k * .3, 1.7, z0 + t + .06); if (rnd() < .6) { const tw = new THREE.Mesh(new THREE.PlaneGeometry(.22, .5), S(null, { color: pick([0xd8d0c0, 0x5a7aa0, 0xa86a6a]), side: THREE.DoubleSide })); tw.position.set(-43.0 + k * .3, 1.45, z0 + t + .13); F.interior.add(tw); } }
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(.5, .5), mCloth); c.rotation.set(-Math.PI / 2, 0, rnd() * 6); c.position.set(rr(-48, -43), .015, rr(21, 29)); F.interior.add(c); }
    // 세면대 · 거울 · 헤어드라이어 (남벽)
    for (let k = 0; k < 3; k++) { const x = -48.6 + k * 1.1; meshAt(merge([bx(.55, .16, .45, 0, .85, 0), bx(.12, .78, .12, 0, .39, -.1)]), mPorc, x, 0, z0 + t + .25); plane(F.interior, mGlass, .8, .7, x, 1.55, z0 + t + .01); meshAt(merge([tube(.01, 0, .93, -.15, 0, 1.03, -.15), tube(.01, 0, 1.03, -.15, 0, 1.03, -.05)]), mChrome, x, 0, z0 + t + .25); }
    col(-49.2, -46.1, z0, z0 + t + .5);
    add(mWhiteP, .2, .25, .12, -45.6, 1.4, z0 + t + .06); add(mWhiteP, .2, .25, .12, -45.2, 1.4, z0 + t + .06);
    // 체중계 · 청소 카트 · 쓰레기통 · 신발장 · 안내판
    meshAt(merge([bx(.4, .08, .45, 0, .04, 0), tube(.025, 0, .08, -.15, 0, 1.2, -.18), new THREE.CylinderGeometry(.16, .16, .05, 18).rotateX(Math.PI / 2).translate(0, 1.28, -.18)]), mWhiteP, -42.4, 0, 22.0);
    meshAt(merge([bx(.7, .5, .45, 0, .45, 0), new THREE.CylinderGeometry(.06, .06, .04, 10).rotateZ(Math.PI / 2).translate(-.3, .06, .2), new THREE.CylinderGeometry(.06, .06, .04, 10).rotateZ(Math.PI / 2).translate(.3, .06, .2)]), mYellow, -42.4, 0, 26.0, Math.PI / 2); col(-42.7, -42.1, 25.6, 26.4);
    bin(-49.3, 21.0);
    sign('물기를 꼭 닦고 이용합시다', '#e8e2d2', '#a82020', 24, 2.2, .5, -46.4, 2.6, z0 + t + .02);
    // 개인 물품 보관함 (사물함 칸)
    meshAt(merge([...Array.from({ length: 4 }, (_, r) => bx(1.4, .02, .35, 0, .1 + r * .3, 0)), ...Array.from({ length: 5 }, (_, c) => bx(.02, 1.0, .35, -.7 + c * .35, .55, 0))]), mWood, -43.0, 0, wz - .25, Math.PI);
    // (머리핀은 game.js 가 샤워실 벤치 위에 둔다)

    /* ----- 샤워실 (남동, x -41.35~-34 · z 20~30) ----- */
    // 칸막이 샤워 부스 6칸 (남벽) · 샤워 헤드 · 노출 배관
    for (let k = 0; k <= 6; k++) add(mSteel, .04, 1.9, 1.1, -41.0 + k * 1.05, 0, z0 + t + .55, { col: k === 0 || k === 6 });
    for (let k = 0; k < 6; k++) { const x = -40.5 + k * 1.05;
      meshAt(merge([tube(.015, 0, 2.05, 0, 0, 2.05, .25), new THREE.CylinderGeometry(.08, .04, .06, 12).translate(0, 2.0, .28), tube(.012, -.1, 1.1, 0, .1, 1.1, 0)]), mChrome, x, 0, z0 + t + .02);
      add(mMat, .9, .02, .9, x, .01, z0 + t + .6); }
    meshAt(tube(.03, -41.2, 2.25, z0 + t + .05, x1 - t - .1, 2.25, z0 + t + .05), mRust, 0, 0, 0);
    col(-41.0, -34.7, z0 + t, z0 + t + .3);
    // 배수로 트렌치 · 고무 매트 · 벤치 · 세면대/거울 (칸막이벽 쪽) · 환기팬 · 청소 도구
    flat(F.interior, mDrain, -41.2, -34.6, 22.6, 22.9, .015, .3);
    [[-39.8, 26.0], [-37.4, 25.4], [-35.6, 27.2]].forEach(([x, z]) => add(mMat, .9, .02, .9, x, .005, z, { ry: rnd() }));
    meshAt(benchG, mWood, -37.6, 0, 28.3); col(-38.9, -36.3, 28.1, 28.5);
    for (let k = 0; k < 3; k++) { const z = 23.6 + k * 1.2; meshAt(merge([bx(.45, .16, .55, 0, .85, 0), bx(.12, .78, .12, -.1, .39, 0)]), mPorc, -41.05, 0, z); plane(F.interior, mGlass, .7, .8, -41.33, 1.6, z, Math.PI / 2); }
    col(-41.35, -40.8, 23.2, 26.4);
    { const fanM = meshAt(merge([new THREE.CylinderGeometry(.3, .3, .08, 18).rotateZ(Math.PI / 2), ...[0, 1.57, 3.14, 4.71].map(a => bx(.02, .24, .07, 0, Math.cos(a) * .13, Math.sin(a) * .13).rotateX(a))]), mPipeG, x1 - t - .05, 3.6, 25); fanM.rotation.y = 0; }
    meshAt(merge([bx(.3, .02, .02, 0, 0, 0), tube(.012, 0, 0, 0, .05, 1.3, .05)]), S(null, { color: 0x8a6a40 }), -34.6, 0, 29.4); mopBucket(-35.2, 29.0);
    meshAt(basketG, S(null, { color: 0x2a5ab0, roughness: .6 }), -36.5, 0, 21.9, .3); meshAt(basketG, S(null, { color: 0xc02828, roughness: .6 }), -35.9, 0, 21.8, -.2);
    wallSignH('미끄럼 주의  뛰지 마시오', x1 - t - .02, 2.4, 26.8, -Math.PI / 2, 1.8);
    for (let k = 0; k < 3; k++) add(mBlueL, .6, 1.85, .5, -36.2 + k * .62, 0, wz - .3, { col: true, ry: Math.PI });
    tapeRecorder('tape4', -38.2, .45, 28.3, .5);

    // 바닥 물웅덩이 (젖은 반사)
    const pud = new THREE.MeshStandardMaterial({ color: 0x1a2428, roughness: .05, metalness: .2, transparent: true, opacity: .55, depthWrite: false });
    [[-47.5, 37], [-36.2, 31.5], [-40.5, 47.8], [-38.5, 52.5], [-45.5, 26.5], [-38.5, 24.5]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.CircleGeometry(rr(.6, 1.2), 18), pud); p.rotation.x = -Math.PI / 2; p.position.set(x, .02, z); p.scale.set(1, rr(.6, 1), 1); F.interior.add(p); });
    addBattery(-46.8, 0, 48.8);
    [-46, -41.5, -37].forEach(x => [33, 38.5, 44].forEach(z => areaLamp(x, z, H - .7, 'poolHall'))); lightSwitch(x1 - t - .02, 36.3, -Math.PI / 2, 'poolHall', '수영장 홀');
    [[-46, 25, 'poolLocker'], [-37.8, 25, 'poolShower'], [-46.5, 54, 'poolMech'], [-38.5, 54, 'poolMech']].forEach(([x, z, k]) => areaLamp(x, z, H - .7, k));
    lightSwitch(-43.5, wz - .02, Math.PI, 'poolLocker', '탈의실'); lightSwitch(-36.5, wz - .02, Math.PI, 'poolShower', '샤워실'); lightSwitch(-38.7, zh + t + .02, 0, 'poolMech', '기계실');
    papers(-41, 21, 57, 14, 7);
    // 유령 경로 (홀 둘레 · 탈의실 · 샤워실 · 기계실)
    const pts = [[-46.7, 31], [-41.5, 31], [-35.9, 31], [-35.9, 38], [-35.9, 47.6], [-41.5, 47.6], [-46.7, 47.6], [-46.7, 38], [-34.9, 38],
      [-44.5, 31], [-44.5, 27.5], [-37.5, 31], [-37.5, 26.5], [-40, 49], [-40, 52.2], [-46.2, 52.6], [-38.6, 54.4], [-48.0, 22.5], [-36.5, 24.5]];
    pts.forEach(([x, z]) => F.nodes.push({ x, z }));
    for (let k = 0; k < 8; k++) F.edges.push([k, (k + 1) % 8]);
    F.edges.push([3, 8], [0, 9], [9, 1], [1, 11], [11, 2], [9, 10], [11, 12], [5, 13], [13, 14], [14, 15], [14, 16], [10, 17], [12, 18]);
    F.spawns = [{ x: -46.7, z: 47.2 }, { x: -38.6, z: 54.4 }, { x: -46.7, z: 38 }];
    finishGraph(F);
    doors.push({ floor: 6, x: -35.2, z: 38, r: 1.8, label: '수영장 나가기', to: { floor: 0, x: -32.2, z: 41, yaw: -Math.PI / 2 } });
    doors.push({ floor: 6, x: -40.2, z: 56.4, r: 1.3, label: '사다리 내려가기 (지하 펌프실)', to: { floor: 4, x: 32, z: -4.4, yaw: Math.PI } });
  }

  buildFloor(4, { y0: -30, lay: LAYOUT[4], basement: true });
  buildGym();
  buildPool();
  buildCafeteria();
  for (let k = 0; k < 3; k++) buildAnnexFloor(k);

  /* ---------- 야외 ---------- */
  cur = floors[0];
  const OUT = new THREE.Group(); scene.add(OUT);
  const g0 = floors[0];
  const mBrick = PB('brick', () => T.pbrBrick(512));
  const addO = (mat, w, h, d, x, y, z, o = {}) => add(mat, w, h, d, x, y, z, { ...o, parent: OUT });
  const outWall = (x1, x2, z1, z2, h, mat, wall = true) => { const m = boxMesh(x1, x2, 0, h, z1, z2, mat); OUT.add(m); col(x1, x2, z1, z2, wall); };

  // 지면: 본관(-36.0~36.0, -9.6~9.6)과 별관(-28.0~28.0, -32.0~-20.5) 실내 바닥 영역을 모두 비우고 분할 시공하여 실내외 바닥 겹침(Z-fighting) 원천 차단!
  const groundMat = S(T.makeGround());
  flat(OUT, groundMat, -320, 320, -260, -31.68, -.06, 8);
  flat(OUT, groundMat, -320, -19.6, -31.68, -20.5, -.06, 6);
  flat(OUT, groundMat, 27.6, 320, -31.68, -20.5, -.06, 6);
  flat(OUT, groundMat, -320, 320, -20.5, -9.6, -.06, 6);
  flat(OUT, groundMat, -320, 320, 9.6, 320, -.06, 8);
  flat(OUT, groundMat, -320, -36.0, -9.6, 9.6, -.06, 8);
  flat(OUT, groundMat, 36.0, 320, -9.6, 9.6, -.06, 8);
  OUT.add(
    boxMesh(-130, 130, -.45, -.018, -120, -31.68, groundMat, 8),
    boxMesh(-130, -19.6, -.45, -.018, -31.68, -20.5, groundMat, 6),
    boxMesh(27.6, 130, -.45, -.018, -31.68, -20.5, groundMat, 6),
    boxMesh(-130, 130, -.45, -.018, -20.5, -9.6, groundMat, 6),
    boxMesh(-130, 130, -.45, -.018, 9.6, 100, groundMat, 8),
    boxMesh(-130, -36.0, -.45, -.018, -9.6, 9.6, groundMat, 8),
    boxMesh(36.0, 130, -.45, -.018, -9.6, 9.6, groundMat, 8)
  );
  const dirtMat = turfMaterial(); flat(OUT, dirtMat, -27, 27, 15, 59, 0, 2);   // 잔디 운동장: 트랙과 흰 경기선은 위에 유지
  // 운동장 (재배치): 동서로 긴 200m 급 우레탄 트랙 — 체육관(x 28) · 수영장(x -34) · 급식실과 3m 이상 띄움. 안쪽은 흙 축구장 (선 · 골대 · 그물)
  const PG = { CZ: 40, SX: 11, R0: 9.6, R1: 13.2 };
  const mNet = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.strokeStyle = '#e8e8e0'; g.lineWidth = 3; for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); } const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, alphaTest: .45, side: THREE.DoubleSide, roughness: .9 }); })();
  { const trM = PB('track', () => T.pbrTrack(512)); trM.polygonOffset = true; trM.polygonOffsetFactor = -1;
    const lineM = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: .8, transparent: true, opacity: .8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const { CZ, SX, R0, R1 } = PG, Y = .013, LW = (R1 - R0) / 4;
    const uvPlanar = (geo, sc) => { const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / sc, p.getY(i) / sc); return geo; };
    const line = (w, d, x, z, ry = 0) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineM); l.rotation.set(-Math.PI / 2, 0, ry); l.position.set(x, Y + .004, z); OUT.add(l); };
    const arc = (r, x, z, a0, len, w = .07) => { const c = new THREE.Mesh(new THREE.RingGeometry(r - w / 2, r + w / 2, 56, 1, a0, len), lineM); c.rotation.x = -Math.PI / 2; c.position.set(x, Y + .004, z); OUT.add(c); };
    [-1, 1].forEach(sd => {
      const st = new THREE.Mesh(uvPlanar(new THREE.PlaneGeometry(SX * 2, R1 - R0), 4), trM); st.rotation.x = -Math.PI / 2; st.position.set(0, Y, CZ + sd * (R0 + R1) / 2); OUT.add(st);
      const ring = new THREE.Mesh(uvPlanar(new THREE.RingGeometry(R0, R1, 64, 1, sd > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI), 4), trM); ring.rotation.x = -Math.PI / 2; ring.position.set(sd * SX, Y, CZ); OUT.add(ring);
      for (let k = 0; k <= 4; k++) { const r = R0 + k * LW; line(SX * 2, .07, 0, CZ + sd * r); arc(r, sd * SX, CZ, sd > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI); }
    });
    for (let k = 0; k <= 4; k++) line(.07, R1 - R0, -6 + k * .6, CZ + (R0 + R1) / 2);   // 출발선
    for (let k = 0; k < 4; k++) { const t = new THREE.Mesh(new THREE.PlaneGeometry(.5, .5), new THREE.MeshBasicMaterial({ map: T.makeSign(String(k + 1), 'rgba(0,0,0,0)', '#e8e4d8', 60), transparent: true, depthWrite: false })); t.rotation.x = -Math.PI / 2; t.position.set(-7, Y + .006, CZ + R0 + LW * (k + .5)); OUT.add(t); }
    // 축구장 선: 중앙선 · 센터서클 · 양쪽 골 에어리어 · 페널티 에어리어
    line(.08, R0 * 2 - .4, 0, CZ); arc(3, 0, CZ, 0, Math.PI * 2, .08);
    const cFlagM = S(null, { color: 0xd43828, roughness: .75, side: THREE.DoubleSide });
    [-1, 1].forEach(sd => { const gx = sd * 19.2;
      line(.08, 14, gx - sd * 5, CZ); line(5, .08, gx - sd * 2.5, CZ - 7); line(5, .08, gx - sd * 2.5, CZ + 7);   // 페널티 에어리어
      line(.08, 8, gx - sd * 2, CZ); line(2, .08, gx - sd * 1, CZ - 4); line(2, .08, gx - sd * 1, CZ + 4);         // 골 에어리어
      arc(1.8, gx - sd * 3.6, CZ, sd > 0 ? Math.PI * .65 : -Math.PI * .35, Math.PI * .7, .07);                    // 페널티 아크
      // 골대: Sketchfab 실사 축구 골대(sf_soccer_goal) + 물리 충돌 및 코너 플래그
      model('sf_soccer_goal', gx + sd * .85, 0, CZ, sd > 0 ? -Math.PI / 2 : Math.PI / 2, { out: true });
      const gp = [tube(.06, gx, 0, CZ - 3.66, gx, 2.44, CZ - 3.66), tube(.06, gx, 0, CZ + 3.66, gx, 2.44, CZ + 3.66), tube(.06, gx, 2.44, CZ - 3.66, gx, 2.44, CZ + 3.66),
        tube(.025, gx, 2.44, CZ - 3.66, gx + sd * 1.6, 0, CZ - 3.66), tube(.025, gx, 2.44, CZ + 3.66, gx + sd * 1.6, 0, CZ + 3.66), tube(.025, gx + sd * 1.6, 0, CZ - 3.66, gx + sd * 1.6, 0, CZ + 3.66)];
      OUT.add(new THREE.Mesh(merge(gp), mPoleW));
      [-9.2, 9.2].forEach(dz => {
        OUT.add(new THREE.Mesh(tube(.018, gx, 0, CZ + dz, gx, 1.35, CZ + dz), mPoleW));
        const fg = new THREE.Mesh(new THREE.PlaneGeometry(.34, .22), cFlagM); fg.position.set(gx - sd * .17, 1.22, CZ + dz); OUT.add(fg);
      });
      col(gx - .08, gx + .08, CZ - 3.74, CZ - 3.58, true); col(gx - .08, gx + .08, CZ + 3.58, CZ + 3.74, true); col(Math.min(gx, gx + sd * 1.6), Math.max(gx, gx + sd * 1.6), CZ - 3.7, CZ + 3.7);
    });
    // 운동장 잔디 위 축구공 & 체육 수업용 드리블 라바콘
    [[-1.4, 39.2, .4], [14.8, 41.5, 1.7], [-17.6, 38.4, 2.5], [-24.2, 56.4, .9]].forEach(([bx0, bz0, bry]) => model('sf_soccer_ball', bx0, 0, bz0, bry, { out: true }));
    [[-12.5, 29.8], [-11.3, 29.8], [-10.1, 29.8], [-8.9, 29.8], [27.8, 40.5], [27.8, 42.0]].forEach(([cx0, cz0], ci) => model('sf_traffic_cone', cx0, 0, cz0, ci * .5, { out: true }));
  }
  // 조회대 (본관 쪽 · 운동장을 바라봄): 콘크리트 단 + 계단 + 난간 · 국기게양대 3개
  { const x0 = -11, z0 = 18.6, W = 6, D = 3, H = 1.1, g = [];
    g.push(bx(W, H, D, x0, H / 2, z0, 2)); const sx = x0 + W / 2 - 1.0; for (let k = 0; k < 4; k++) { const h = (k + 1) * H / 5, zf = z0 + D / 2 + (4 - k) * .32; g.push(bx(1.6, h, zf - z0 - D / 2, sx, h / 2, (z0 + D / 2 + zf) / 2, 2)); col(sx - .8, sx + .8, z0 + D / 2, zf, false, h); }   // 계단 5단(한 단 0.22m)
    OUT.add(new THREE.Mesh(merge(g), mStep));
    meshAt(merge([tube(.03, x0 - W / 2 + .1, H, z0 - D / 2 + .1, x0 - W / 2 + .1, H + 1, z0 - D / 2 + .1), tube(.03, x0 + W / 2 - .1, H, z0 - D / 2 + .1, x0 + W / 2 - .1, H + 1, z0 - D / 2 + .1), tube(.03, x0 - W / 2 + .1, H + 1, z0 - D / 2 + .1, x0 + W / 2 - .1, H + 1, z0 - D / 2 + .1), tube(.03, x0 - W / 2 + .1, H, z0 + D / 2 - .1, x0 - W / 2 + .1, H + 1, z0 + D / 2 - .1), tube(.03, x0 - W / 2 + .1, H + 1, z0 - D / 2 + .1, x0 - W / 2 + .1, H + 1, z0 + D / 2 - .1)]), mRailSteel, 0, 0, 0, 0, OUT);
    meshAt(merge([bx(.9, 1.1, .5, 0, .55, 0)]), mWoodDark, x0, H, z0 - .4, 0, OUT);   // 연설대
    plane(OUT, new THREE.MeshStandardMaterial({ map: T.makeSign('조 회 대', '#2a2420', '#d8d0b8', 30), roughness: .9 }), 1.6, .35, x0, H / 2, z0 + D / 2 + .01);
    col(x0 - W / 2, x0 + W / 2, z0 - D / 2, z0 + D / 2, false, H);
    col(x0 - W / 2, x0 + W / 2, z0 - D / 2, z0 - D / 2 + .16, false, H + 1); col(x0 - W / 2, x0 - W / 2 + .16, z0 - D / 2, z0 + D / 2, false, H + 1);   // 뒤 · 서쪽 난간 (위에서 떨어지지 않게)
    for (let k = 0; k < 3; k++) { const fx = x0 - W / 2 - 1.6 - k * 1.2, fh = [8, 9, 7.4][k]; OUT.add(new THREE.Mesh(merge([new THREE.CylinderGeometry(.05, .08, fh, 10).translate(fx, fh / 2, z0 - .6), new THREE.SphereGeometry(.1, 10, 8).translate(fx, fh + .05, z0 - .6), new THREE.CylinderGeometry(.35, .4, .3, 12).translate(fx, .15, z0 - .6)]), mPoleW)); col(fx - .4, fx + .4, z0 - 1, z0 - .2); }
    // 깃발 (사용자 제공 이미지): 가운데 높은 기둥 = 태극기(서쪽으로 펄럭), 조회대 쪽 기둥 = 교기(동쪽으로), 세 번째 기둥은 빈 줄만
    // 기둥 쪽 끝은 고정, 바깥으로 갈수록 크게 물결친다 — 보일 때만 정점을 갱신
    [[x0 - W / 2 - 1.6 - 1.2, 9, 'flag_korea', 1.8, 1.18, -1, 0], [x0 - W / 2 - 1.6, 8, 'flag_school', 1.7, 1.16, 1, 1.4]].forEach(([fx, fh, img, fw, fhh, dir, ph]) => {
      const g = new THREE.PlaneGeometry(fw, fhh, 20, 12); g.translate(fw / 2, 0, 0); if (dir < 0) { g.scale(-1, 1, 1); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); g.index.array.reverse(); }
      const base = Float32Array.from(g.attributes.position.array);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: imgTex(img), side: THREE.DoubleSide, roughness: .85 }));
      m.position.set(fx + dir * .06, fh - .12 - fhh / 2, z0 - .6); m.userData.dynamic = true; m.castShadow = true; m.frustumCulled = false;
      let last = 0; m.onBeforeRender = () => { const t = performance.now() / 1000; if (t - last < .033) return; last = t; const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const ax = Math.abs(base[i * 3]), y = base[i * 3 + 1], k = Math.min(1, ax / fw);
          p.setZ(i, (Math.sin(ax * 3.8 - t * 3.2 + ph) * .1 + Math.cos(y * 2.5 - t * 2.1 + ph) * .035) * k); p.setX(i, base[i * 3] * (1 - .04 * k * (.5 + .5 * Math.sin(t * 1.3 + ph)))); }
        p.needsUpdate = true; g.computeVertexNormals(); };
      OUT.add(m);
    });
    for (let k = 0; k < 3; k++) { const fx = x0 - W / 2 - 1.6 - k * 1.2, fh = [8, 9, 7.4][k]; meshAt(tube(.006, fx + .07, 1.1, z0 - .6, fx + .07, fh - .05, z0 - .6), mRope, 0, 0, 0, 0, OUT); meshAt(new THREE.CylinderGeometry(.025, .025, .12, 8), mPoleW, fx + .07, 1.1, z0 - .6, 0, OUT); }   // 깃줄 · 줄걸이
  }
  // 스탠드 (본관 쪽 동편): 운동장을 바라보는 콘크리트 계단식 관람석 4단 + 차양 캐노피 지붕 · 측면 안전 난간
  { const x1 = 5, x2 = 22, z0 = 13.4; for (let k = 0; k < 4; k++) { const zf = z0 + (3 - k) * .8; OUT.add(boxMesh(x1, x2, 0, (k + 1) * .22, z0, zf + .8, mStep, 2)); col(x1, x2, z0, zf + .8, false, (k + 1) * .22); }
    const stSteel = [], stRoof = [];
    for (let sx = x1 + .6; sx <= x2 - .5; sx += 4.0) {
      stSteel.push(tube(.055, sx, .88, z0 + .18, sx, 3.15, z0 + .18), tube(.04, sx, 3.12, z0 + .15, sx, 3.38, z0 + 2.45), tube(.03, sx, 2.45, z0 + .18, sx, 3.22, z0 + 1.15));
    }
    stSteel.push(tube(.045, x1 + .4, 3.12, z0 + .18, x2 - .4, 3.12, z0 + .18), tube(.045, x1 + .4, 3.36, z0 + 2.35, x2 - .4, 3.36, z0 + 2.35));
    [x1 + .08, x2 - .08].forEach(rx => stSteel.push(tube(.03, rx, .88, z0 + .15, rx, 1.55, z0 + .15), tube(.03, rx, .22, z0 + 3.05, rx, .92, z0 + 3.05), tube(.03, rx, 1.55, z0 + .15, rx, .92, z0 + 3.05)));
    OUT.add(new THREE.Mesh(merge(stSteel), mRailSteel));
    const canopyG = bx(x2 - x1 + .4, .06, 2.45, 0, 0, 0, 2); canopyG.rotateX(-.11); canopyG.translate((x1 + x2) / 2, 3.28, z0 + 1.3);
    stRoof.push(canopyG); OUT.add(new THREE.Mesh(merge(stRoof), mBlueMetal));
    model('sf_bleacher', -21.5, 0, 18.6, 0, { out: true, col: [3.8, 2.1] });
  }
  // 운동장 리모델링 (참고 평면도 · 54.0 × 44.0m): 우레탄 트랙 4레인 · 인조잔디 축구장 (기존) + 조명탑 4 (H12m · LED 투광등) · 동 · 서 철망 펜스 (H4.0, 남 · 북은 정문 · 본관 동선으로 개방) · 선수 대기석 2 (5000 × 1500 × 2200 · 차양) · 스탠드 본부석 현판
  { const postM = S(null, { color: 0x8a9094, roughness: .45, metalness: .6 }), fenceM = new THREE.MeshStandardMaterial({ color: 0x2a5a3a, roughness: .6, metalness: .3, transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false });
    [[-26, 16.5], [23.6, 16.5], [-26, 54], [23.6, 54]].forEach(([x, z]) => { meshAt(merge([tube(.18, 0, 0, 0, 0, 12, 0), bx(2.4, .12, .4, 0, 12, 0), bx(.1, 1.0, .1, -1.0, 12.5, 0), bx(.1, 1.0, .1, 1.0, 12.5, 0), bx(2.4, .1, .3, 0, 13.0, 0)]), postM, x, 0, z, 0, OUT);
      [-.8, 0, .8].forEach(d => [12.5, 13.3].forEach(y => meshAt(bx(.5, .4, .25, 0, 0, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: .9 }), x + d, y, z, 0, OUT))); col(x - .25, x + .25, z - .25, z + .25); });
    [[-26.9, 15, 55], [24.7, 15, 57]].forEach(([x, za, zb]) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(zb - za, 4.0), fenceM); p.rotation.y = Math.PI / 2; p.position.set(x, 2.0, (za + zb) / 2); OUT.add(p);
      const P = []; for (let z = za; z <= zb + .01; z += 2.5) P.push(tube(.045, x, 0, z, x, 4.0, z)); P.push(tube(.035, x, 4.0, za, x, 4.0, zb), tube(.03, x, 1.3, za, x, 1.3, zb)); meshAt(merge(P), postM, 0, 0, 0, 0, OUT); col(x - .06, x + .06, za, zb, true); });
    [-7, 7].forEach(x => { const z = 54.8, d = new THREE.Group(); d.position.set(x, 0, z); OUT.add(d);
      const roofG = new THREE.CylinderGeometry(1.2, 1.2, 5.0, 16, 1, true, 0, Math.PI); roofG.rotateZ(Math.PI / 2); roofG.rotateX(Math.PI / 2); const rf = new THREE.Mesh(roofG, new THREE.MeshStandardMaterial({ color: 0xc8dce8, roughness: .2, transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false })); rf.position.set(0, 1.05, 0); rf.rotation.y = Math.PI / 2; d.add(rf);
      d.add(new THREE.Mesh(merge([bx(5.0, .06, .5, 0, .45, .2), bx(5.0, .4, .06, 0, .7, .45), ...[-2.4, 2.4].map(a => bx(.06, 2.2, 1.4, a, 1.1, 0))]), S(null, { color: 0x2a4a8a, roughness: .5 })));
      col(x - 2.5, x + 2.5, z - .1, z + .5, false, .5); });
    plane(OUT, new THREE.MeshStandardMaterial({ map: T.makeSign('본 부 석', '#1e2a3a', '#f0ead6', 30), roughness: .8 }), 2.4, .45, 13.5, 3.0, 13.4 + 2.5, 0);
  }
  // 철봉 3단 · 평행봉 · 구름사다리 · 야외 체육기구 (서남쪽 모래밭 단련장)
  { const bars = [], posts = [], curbs = [];
    [[1.2, -29], [1.6, -27.6], [2.0, -26.2]].forEach(([h, x]) => { posts.push(tube(.045, x - .6, 0, 58, x - .6, h + .05, 58), tube(.045, x + .6, 0, 58, x + .6, h + .05, 58)); bars.push(tube(.02, x - .6, h, 58, x + .6, h, 58)); col(x - .7, x + .7, 57.9, 58.1); });
    [-.25, .25].forEach(d => { posts.push(tube(.045, -22.6, 0, 57 + d, -22.6, 1.3, 57 + d), tube(.045, -20.4, 0, 57 + d, -20.4, 1.3, 57 + d)); bars.push(tube(.025, -22.8, 1.3, 57 + d, -20.2, 1.3, 57 + d)); });
    // 구름사다리 (Monkey bars)
    [-25.0, -23.2].forEach(mx => [-.32, .32].forEach(dz => posts.push(tube(.04, mx, 0, 59.2 + dz, mx, 2.15, 59.2 + dz))));
    [-.32, .32].forEach(dz => bars.push(tube(.03, -25.0, 2.15, 59.2 + dz, -23.2, 2.15, 59.2 + dz)));
    for (let rx = -24.85; rx <= -23.35; rx += .3) bars.push(tube(.018, rx, 2.15, 58.88, rx, 2.15, 59.52));
    col(-22.8, -20.2, 56.7, 57.3); col(-25.1, -23.1, 58.8, 59.6);
    OUT.add(new THREE.Mesh(merge(posts), mRust), new THREE.Mesh(merge(bars), mChrome));
    // 모래밭 콘크리트 경계 연석
    curbs.push(bx(10.8, .12, .16, -24.9, .06, 55.55, 2), bx(10.8, .12, .16, -24.9, .06, 60.25, 2), bx(.16, .12, 4.86, -30.25, .06, 57.9, 2), bx(.16, .12, 4.86, -19.55, .06, 57.9, 2));
    OUT.add(new THREE.Mesh(merge(curbs), mStep));
    flat(OUT, S(null, { color: 0x8a7a5a, roughness: 1 }), -30.2, -19.6, 55.6, 60.2, .008, 2);   // 모래밭
    model('sf_outdoor_gym', -18.0, 0, 57.6, 0, { out: true, col: [1.35, 1.5] });
    model('sf_outdoor_gym', -16.1, 0, 57.6, Math.PI, { out: true, col: [1.35, 1.5] });
  }
  // 야외 농구장 리모델링 (참고 평면도 · 14.0 × 15.0m · 아크릴 하드코트 녹색/적색): 녹색 코트 + 적색 외곽 띠 · 코트 라인 · 지면 고정식 농구 골대 2 (아크릴 백보드) · 펜스 (H4000) + 북측 양개 출입문 · 관람 벤치 4 · 공 보관함 · 쓰레기통 · 조명 폴 (H6000) 4 · 안내 표지판
  { const cx = 36, cz = 46, cw = 14, cd = 15, x0 = cx - cw / 2, x1 = cx + cw / 2, z0 = cz - cd / 2, z1 = cz + cd / 2;
    const redC = S(null, { color: 0x9a3a2c, roughness: .8 }), greenC = S(null, { color: 0x2a6a4c, roughness: .75 }), postM = S(null, { color: 0x2a4a34, roughness: .5, metalness: .5 });
    flat(OUT, redC, x0, x1, z0, z1, .006, 3); flat(OUT, greenC, cx - 5.6, cx + 5.6, cz - 6.2, cz + 6.2, .008, 3);
    const lm = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: .8, transparent: true, opacity: .85, depthWrite: false });
    const ln = (w, d, x, z) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lm); l.rotation.x = -Math.PI / 2; l.position.set(x, .012, z); OUT.add(l); };
    const cArc = (r, x, z, a0, len) => { const c = new THREE.Mesh(new THREE.RingGeometry(r - .035, r + .035, 40, 1, a0, len), lm); c.rotation.x = -Math.PI / 2; c.position.set(x, .013, z); OUT.add(c); };
    ln(11.2, .07, cx, cz - 6.2); ln(11.2, .07, cx, cz + 6.2); ln(.07, 12.4, cx - 5.6, cz); ln(.07, 12.4, cx + 5.6, cz); ln(11.2, .07, cx, cz); cArc(1.5, cx, cz, 0, Math.PI * 2);
    [-1, 1].forEach(sd => { const kz = cz + sd * 4.3; flat(OUT, redC, cx - 1.6, cx + 1.6, Math.min(kz - sd * 1.9, cz + sd * 6.2), Math.max(kz - sd * 1.9, cz + sd * 6.2), .01, 3);
      ln(3.2, .07, cx, kz - sd * 1.9); ln(.07, 3.8, cx - 1.6, kz); ln(.07, 3.8, cx + 1.6, kz); cArc(1.5, cx, kz - sd * 1.9, sd > 0 ? 0 : Math.PI, Math.PI); cArc(4.6, cx, cz + sd * 5.6, sd > 0 ? Math.PI + .25 : .25, Math.PI - .5);
      const hz = cz + sd * 6.9; model('sf_basketball_hoop', cx, 0, hz, sd > 0 ? Math.PI : 0, { out: true }); col(cx - .3, cx + .3, hz - .3, hz + .3); });
    // 펜스 (H4.0) — 북측 서쪽에 양개 출입문 (보행로 쪽)
    const fenceM = new THREE.MeshStandardMaterial({ color: 0x2a5a3a, roughness: .6, metalness: .3, transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false }), FH = 4.0;
    const fenceSeg = (ax, az, bx2, bz) => { const L = Math.hypot(bx2 - ax, bz - az), alongX = Math.abs(bz - az) < .01; const p = new THREE.Mesh(new THREE.PlaneGeometry(L, FH), fenceM); p.position.set((ax + bx2) / 2, FH / 2, (az + bz) / 2); if (!alongX) p.rotation.y = Math.PI / 2; OUT.add(p);
      const P = []; const n = Math.ceil(L / 2.5); for (let k = 0; k <= n; k++) P.push(tube(.04, ax + (bx2 - ax) * k / n, 0, az + (bz - az) * k / n, ax + (bx2 - ax) * k / n, FH, az + (bz - az) * k / n)); P.push(tube(.03, ax, FH, az, bx2, FH, bz), tube(.025, ax, 1.2, az, bx2, 1.2, bz)); meshAt(merge(P), postM, 0, 0, 0, 0, OUT);
      col(Math.min(ax, bx2) - .05, Math.max(ax, bx2) + .05, Math.min(az, bz) - .05, Math.max(az, bz) + .05, true); };
    fenceSeg(x0, z1, x1, z1); fenceSeg(x0, z0, x0, z1); fenceSeg(x1, z0, x1, z1); fenceSeg(x0, z0, x0 + 1.0, z0); fenceSeg(x0 + 4.0, z0, x1, z0);
    [x0 + 1.0, x0 + 4.0].forEach((hx, i) => { const lf = new THREE.Group(); lf.position.set(hx, 0, z0); lf.rotation.y = i ? -1.3 : 1.3; OUT.add(lf); const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 2.2), fenceM); pl.position.set(i ? -.75 : .75, 1.1, 0); lf.add(pl); lf.add(new THREE.Mesh(merge([tube(.03, 0, 0, 0, 0, 2.2, 0), tube(.03, i ? -1.5 : 1.5, 0, 0, i ? -1.5 : 1.5, 2.2, 0), tube(.03, 0, 2.2, 0, i ? -1.5 : 1.5, 2.2, 0)]), postM)); });
    plane(OUT, new THREE.MeshStandardMaterial({ map: T.makeSign('서문고 야외농구장 · 방과 후 개방', '#1e3a2a', '#f0f0e0', 22), roughness: .8 }), 2.4, .5, x0 + 6.5, 2.2, z0 - .06, Math.PI);
    // 관람 벤치 4 (동 · 서 적색 띠 위) · 공 보관함 · 쓰레기통 · 조명 폴 4
    [[x0 + .5, cz - 3.2, Math.PI / 2], [x0 + .5, cz + 3.2, Math.PI / 2], [x1 - .5, cz - 3.2, -Math.PI / 2], [x1 - .5, cz + 3.2, -Math.PI / 2]].forEach(([x, z, ry]) => model('sf_park_bench', x, 0, z, ry, { out: true, col: [1.85, .64] }));
    { const bx2 = x1 - .7, bz2 = z0 + .6; meshAt(merge([bx(1.0, .06, .6, 0, .03, 0), bx(1.0, .06, .6, 0, 1.0, 0), ...[[-.48, -.28], [.48, -.28], [-.48, .28], [.48, .28]].map(([a, b]) => bx(.04, 1.0, .04, a, .5, b))]), postM, bx2, 0, bz2, 0, OUT);
      for (let k = 0; k < 6; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 10), S(null, { color: 0xd86a20, roughness: .7 })); b.position.set(bx2 - .3 + (k % 3) * .3, .2 + ((k / 3) | 0) * .25, bz2 + (k % 2 ? .1 : -.1)); OUT.add(b); } col(bx2 - .5, bx2 + .5, bz2 - .3, bz2 + .3); }
    meshAt(bx(.4, .8, .4, 0, .4, 0), mWoodDark, x0 + .5, 0, z1 - .5, 0, OUT); col(x0 + .3, x0 + .7, z1 - .7, z1 - .3);
    [[x0 + .25, z0 + .25], [x1 - .25, z0 + .25], [x0 + .25, z1 - .25], [x1 - .25, z1 - .25]].forEach(([x, z]) => { meshAt(tube(.07, x, 0, z, x, 6.0, z), postM, 0, 0, 0, 0, OUT); meshAt(bx(.7, .3, .3, 0, 0, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: .9 }), x, 6.1, z, 0, OUT); });
  }
  const pave = S(T.makePaving()); flat(OUT, pave, -3.2, 3.2, MAIN_ZS, PG.CZ - PG.R1 - .2, .01, 4); flat(OUT, pave, -3.2, 3.2, PG.CZ + PG.R1 + .2, 69.5, .01, 4); flat(OUT, pave, -16, 16, MAIN_ZS, 11, .01, 4);   // 정문 길은 운동장(트랙 · 흙)을 가로지른다
  // 진입로 가로등 · 현관 앞 & 운동장 가장자리 캠퍼스 벤치 (sf_park_bench)
  [[-25.8, 24.0, Math.PI / 2], [-25.8, 48.0, Math.PI / 2], [24.0, 56.5, Math.PI]].forEach(([x, z, ry]) => model('sf_park_bench', x, 0, z, ry, { out: true, col: [1.85, .64] }));
  flat(OUT, pave, -46, 46, 11, 14, .005, 4);
  const asph = S(T.makeAsphalt()); flat(OUT, asph, -120, 120, 73, 82, 0.005, 8);
  // 웅덩이
  const puddle = new THREE.MeshStandardMaterial({ color: 0x2a3640, roughness: .12, metalness: 0, transparent: true, opacity: .55, depthWrite: false });
  [[0, 12.5], [-2, 30], [1.5, 50], [-20, 40], [14, 30], [-9, 46], [22, 44], [-26, 26], [8, 20], [27, 52], [-14, 18], [5, 62]].forEach(([x, z]) => {
    const geo = new THREE.CircleGeometry(1, 28), pp = geo.attributes.position; for (let i = 1; i < pp.count; i++) { const k = .7 + rnd() * .5; pp.setXY(i, pp.getX(i) * k, pp.getY(i) * k * rr(.6, 1)); }
    const p = new THREE.Mesh(geo, puddle); p.rotation.x = -Math.PI / 2; p.rotation.z = rnd() * 6; p.scale.setScalar(rr(.9, 2.3)); p.position.set(x, .022, z); OUT.add(p); });
  // 담쟁이덩굴 (본관 정면 · 담장 · 별관)
  { const ivyM = new THREE.MeshStandardMaterial({ map: T.makeIvy(), alphaTest: .45, side: THREE.DoubleSide, roughness: .75 });
    const ivy = (x, z, w, h, ry, y0 = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ivyM); m.position.set(x, y0 + h / 2, z); m.rotation.y = ry; OUT.add(m); };
    /* 본관 남쪽 정면 외벽 창문을 가리던 2D 평면 담쟁이덩굴 제거 */
    [[-40, 3], [-28, 2.6], [-16, 2.8], [12, 2.7], [24, 2.6], [38, 2.9]].forEach(([x, h]) => ivy(x, GATE_Z - .3, rr(2.5, 3.5), h, Math.PI));
    [[-49.7, 10, 3], [-49.7, 50, 2.8], [-49.7, -10, 2.7]].forEach(([x, z, h]) => ivy(x, z, 3, h, Math.PI / 2));
  }

  // 외곽 담장 & 서쪽 끝 외곽 경계(x = -114.0, z = 55.6 — 2번 사진 위치!)로 이전된 『서문고등학교 서문 (西門)』
  const fenceH = 2.8;
  const brick = mBrick;
  // 남쪽 정문 좌·우 외곽 담장 (정문 x: -4.5 ~ +4.5 개방, x: -114.5 ~ +114.5 전체 연결)
  outWall(-114.5, -4.5, GATE_Z - .25, GATE_Z + .25, fenceH, mFence);
  outWall(4.5, 114.5, GATE_Z - .25, GATE_Z + .25, fenceH, mFence);

  // 『서문고등학교 서문 (西門)』 — 2번 사진 위치(서쪽 끝 외곽 경계 x = -114.0, z = 55.6)에 아치 기둥·상인방·쇠사슬 철문 설치!
  OUT.add(
    boxMesh(-114.6, -113.4, 0, 4.0, 51.4, 52.5, brick),
    boxMesh(-114.6, -113.4, 0, 4.0, 58.7, 59.8, brick),
    boxMesh(-114.7, -113.3, 3.6, 4.25, 51.2, 60.0, mFacade),
    boxMesh(-114.2, -113.8, 0, 2.6, 52.5, 58.7, mRust)
  );
  col(-114.6, -113.4, 51.4, 59.8, true);
  for (let k = 0; k < 15; k++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(.07, 2.7, .07), mRust);
    b.position.set(-114.0, 1.35, 52.8 + k * .4);
    OUT.add(b);
  }
  plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('서 문 고 등 학 교  서 문 (西 門)', '#1c1812', '#e8dfc0', 26), color: 0xb0aa98 }), 4.2, .58, -113.25, 3.92, 55.6, Math.PI / 2);
  doors.push({ floor: 0, x: -112.4, z: 55.6, r: 2.8, label: '서문 (쇠사슬)', win: true, locked: '녹슨 쇠사슬로 단단히 묶여 있다. 열쇠 조각을 모두 모으면 풀릴지도 모른다.' });

  // 서문 바깥쪽 서쪽 외곽 대로(x: -126 ~ -114.8) / 횡단보도 / 가로등 & 제2주차장 내 통학버스 배치
  const mYellow = new THREE.MeshBasicMaterial({ color: 0x9a8a30 }), mWhiteL = new THREE.MeshBasicMaterial({ color: 0xaaa89c });
  flat(OUT, S(T.makeAsphalt()), -126, -115.5, -90, 88, .004, 8);
  flat(OUT, S(T.makePaving()), -115.5, -114.4, -90, 88, .006, 3);
  for (let z = -85; z < 85; z += 5) flat(OUT, mYellow, -120.85, -120.55, z, z + 2.5, .012, 1);
  for (let k = 0; k < 7; k++) flat(OUT, mWhiteL, -124.8 + k * 1.3, -124.2 + k * 1.3, 53.0, 58.2, .015, 1);
  const mCar = c => S(T.makeMetal(c), { roughness: .7, metalness: .3 });
  const car = (x, z, ry, c) => {
    const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, .7, 4.3), mCar(c)); b.position.y = .75; g.add(b);
    const t = new THREE.Mesh(new THREE.BoxGeometry(1.7, .6, 2.3), mBlack); t.position.set(0, 1.4, -.1); g.add(t);
    [[-.9, 1.4], [.9, 1.4], [-.9, -1.4], [.9, -1.4]].forEach(([wx, wz]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .25, 10), mBlack); w.rotation.z = Math.PI / 2; w.position.set(wx, .38, wz); g.add(w); });
    g.position.set(x, 0, z); g.rotation.y = ry; OUT.add(g);
  };
  // 차량들은 캠퍼스 통로나 인도를 막지 않도록 서문 바깥 도로와 제2주차장 주차칸 안에 정렬!
  car(-123.0, 44.0, 0, [90, 40, 40]); car(-118.0, 66.0, 0, [60, 70, 90]);
  car(-88.0, 65.5, 0, [55, 65, 75]);  car(-83.4, 65.5, 0, [80, 75, 65]);
  const bus = new THREE.Group(); const bb = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 10.5), mCar([170, 134, 30])); bb.position.y = 1.7; bus.add(bb);
  for (let k = 0; k < 6; k++) [-1, 1].forEach(sd => { const w = new THREE.Mesh(new THREE.BoxGeometry(.05, .8, 1.2), mBlack); w.position.set(sd * 1.31, 2.1, -4.2 + k * 1.65); bus.add(w); });
  [[-1.3, 3.2], [1.3, 3.2], [-1.3, -3.2], [1.3, -3.2]].forEach(([wx, wz]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .3, 12), mBlack); w.rotation.z = Math.PI / 2; w.position.set(wx, .5, wz); bus.add(w); });
  bus.position.set(-74.0, 0, 65.5); bus.rotation.y = Math.PI / 2; OUT.add(bus); // 제2주차장 대형버스 구획 안에 반듯하게 주차!
  for (let z = -30; z <= 66; z += 16) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 5, 6), mMetal); p.position.set(-115.2, 2.5, z); OUT.add(p);
    const h = new THREE.Mesh(new THREE.BoxGeometry(1.2, .1, .3), mMetal); h.position.set(-115.7, 5, z); OUT.add(h);
  }
  // 별관(특별교실동) 외관 및 1·2·3층 직통 연결 홀 — 야외 캠퍼스 부지(z: -32.0 ~ -20.5)에 정확히 맞춰 북부 보행로(z=-32.4~-35.2) 및 대강당(z=-35~-61)과 맵 충돌 0건!
  {
    const zN_A = -25 - ANNEX_DZ, zS_A = -13.5 - ANNEX_DZ;
    OUT.add(
      boxMesh(-20, -19.6, 0, 12.4, zN_A, zS_A, mBrick, 2.5),
      boxMesh(27.6, 28, 0, 12.4, zN_A, zS_A, mBrick, 2.5)
    );
    // 층간 가로 벽돌 스팬드럴(Spandrels: y 0~1.05, 2.55~5.05, 6.55~9.05, 10.55~12.4)
    [[0, 1.05], [2.55, 5.05], [6.55, 9.05], [10.55, 12.4]].forEach(([y0, y1]) => {
      OUT.add(
        boxMesh(-20, -.85, y0, y1, zS_A - .32, zS_A, mBrick, 2.5),
        boxMesh(2.45, 28, y0, y1, zS_A - .32, zS_A, mBrick, 2.5),
        boxMesh(-20, 28, y0, y1, zN_A, zN_A + .32, mBrick, 2.5)
      );
    });
    // 구름다리/필로티 연결 홀 좌·우 외벽 마감 기둥
    OUT.add(
      boxMesh(-3.15, -.85, 0, 12.4, zS_A - .35, zS_A, mBrick, 2.5),
      boxMesh(2.45, 4.95, 0, 12.4, zS_A - .35, zS_A, mBrick, 2.5),
      boxMesh(-3.15, 4.95, 0, 12.4, zN_A, zN_A + .35, mBrick, 2.5)
    );
    // 창문 사이 세로 벽돌 기둥(Piers)
    for (let x = -20; x <= 28; x += 4) {
      if (x > -3.5 && x < 4.5) continue;
      OUT.add(
        boxMesh(x - .92, x + .92, 1.05, 10.55, zS_A - .32, zS_A, mBrick, 2.5),
        boxMesh(x - .92, x + .92, 1.05, 10.55, zN_A, zN_A + .32, mBrick, 2.5)
      );
    }
    // 구름다리/필로티에서 북쪽을 바라볼 때 보이는 별관 1·2·3층 내부 연결 홀 및 복도 (z: -20.5 ~ -31.7, 야외 도로 침범 0건!)
    for (let k = 0; k < 3; k++) {
      const fy = k * FH;
      flat(OUT, mFloorTile, -19.6, 27.6, zN_A + .32, zS_A, fy + .018);
      flat(OUT, mCeil, -19.6, 27.6, zN_A + .32, zS_A, fy + CH, 4, false);
      // 연결 홀 좌·우 벽(x = -4.0, +4.0) 및 동서 복도 벽(z = -26.5, -29.8)
      buildLayered1998Wall(OUT, -4.15, -3.85, -26.5, zS_A, fy, fy + CH, mWall);
      buildLayered1998Wall(OUT,  3.85,  4.15, -26.5, zS_A, fy, fy + CH, mWall);
      buildLayered1998Wall(OUT, -19.6, -3.0, -26.8, -26.5, fy, fy + CH, mWall);
      buildLayered1998Wall(OUT,  3.0,  27.6, -26.8, -26.5, fy, fy + CH, mWall);
      buildLayered1998Wall(OUT, -3.0,   3.0, -26.8, -26.5, fy + 2.7, fy + CH, mWall);
      buildLayered1998Wall(OUT, -19.6, 27.6, -31.68, -31.38, fy, fy + CH, mWall);
      add(mWoodDark, .14, 2.65, .38, -.85, fy, zS_A - .15, { parent: OUT });
      add(mWoodDark, .14, 2.65, .38, 2.45, fy, zS_A - .15, { parent: OUT });
      add(mWoodDark, 3.44, .14, .38, .80, fy + 2.65, zS_A - .15, { parent: OUT });
      const hallLbl = k === 0 ? '별관 1층 중앙 연결 홀 (본관 1F 직결)' : `별관 ${k + 1}층 구름다리 연결 홀 (본관 ${k + 1}F 직결)`;
      plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign(hallLbl, '#182c38', '#d8f0e8', 22), color: 0x9aa59a }), 2.3, .34, .80, fy + 2.82, zS_A - .32);
      const roomLbl = ['기술·가정실 (102)', '언어실 (202)', '공예실'][k];
      plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign(roomLbl, '#1e2a2e', '#d9e4d0', 24), color: 0x9aa59a }), 1.2, .26, .80, fy + 2.62, -31.34);
      add(mWoodDark, 1.8, 2.4, .08, .80, fy, -31.36, { parent: OUT });
    }
  }
  col(-20, -.85, -25 - ANNEX_DZ, -13.5 - ANNEX_DZ, true);
  col(2.45, 28, -25 - ANNEX_DZ, -13.5 - ANNEX_DZ, true);
  col(-.85, 2.45, -25 - ANNEX_DZ, -19.5 - ANNEX_DZ, true);
  OUT.add(boxMesh(-20.4, 28.4, 12.4, 12.7, -25.4 - ANNEX_DZ, -13.1 - ANNEX_DZ, mFacade, 3));
  {
    [1.8, 5.8, 9.8].forEach((y) => {
      for (let x = -18; x <= 26; x += 4) {
        if (x > -3.5 && x < 4.5) continue;
        win3D(OUT, 2.2, 1.5, x, y, -13.44 - ANNEX_DZ, Math.PI, pickWin());
      }
      for (let x = -18; x <= 18; x += 4) {
        if (x > -4.5 && x < 5.5) continue;
        win3D(OUT, 2.2, 1.5, x, y, -25.06 - ANNEX_DZ, 0, pickWin());
      }
      [-22 - ANNEX_DZ, -17 - ANNEX_DZ].forEach(z => {
        win3D(OUT, 1.8, 1.5, -20.05, y, z, -Math.PI / 2, pickWin());
        win3D(OUT, 1.8, 1.5, 28.05, y, z, Math.PI / 2, pickWin());
      });
    });
  }
  // 별관 옥상 파라펫 & 별관 서편 확장 날개(x: -28.0 ~ -20.0) + 본관 동·서 3층 아케이드 특별연구 윙(x: -45.5 ~ -36.3, +36.3 ~ +45.5) 증축!
  OUT.add(
    boxMesh(-28.4, 28.4, 12.7, 13.6, -25.4 - ANNEX_DZ, -25.1 - ANNEX_DZ, mFacade, 3),
    boxMesh(-28.4, 28.4, 12.7, 13.6, -13.4 - ANNEX_DZ, -13.1 - ANNEX_DZ, mFacade, 3),
    boxMesh(-28.4, -28.1, 12.7, 13.6, -25.4 - ANNEX_DZ, -13.1 - ANNEX_DZ, mFacade, 3),
    boxMesh(28.1, 28.4, 12.7, 13.6, -25.4 - ANNEX_DZ, -13.1 - ANNEX_DZ, mFacade, 3),
    // 별관 서편 확장 날개 (x: -28.0 ~ -20.0, 1층 필로티 보행로 확보를 위해 2·3층 y: 3.8 ~ 12.4 스팬 + 외곽 기둥!)
    boxMesh(-28.0, -20.0, 3.8, 12.4, -25 - ANNEX_DZ, -13.5 - ANNEX_DZ, mBrick, 2.5),
    boxMesh(-28.4, -20.0, 12.4, 12.7, -25.4 - ANNEX_DZ, -13.1 - ANNEX_DZ, mFacade, 3),
    boxMesh(-28.0, -27.2, 0, 3.8, -24.8 - ANNEX_DZ, -24.0 - ANNEX_DZ, mFacade, 1),
    boxMesh(-28.0, -27.2, 0, 3.8, -14.5 - ANNEX_DZ, -13.7 - ANNEX_DZ, mFacade, 1),
    // 본관 서관 아케이드 특별연구 윙 (x: -45.5 ~ -36.3, z: -8.8 ~ +8.8 — 1층 y: 0~3.8m 은 보도블록 인도 x=-38.3 이 통과하는 개방형 아케이드 필로티!)
    boxMesh(-45.5, -36.3, 3.8, 12.2, -8.8, 8.8, mFacade, 2.5),
    boxMesh(-45.8, -36.3, 12.2, 13.1, -9.1, 9.1, mFacadeTrim, 2),
    boxMesh(-45.5, -40.5, 0, 3.8, -8.6, 8.6, mBrick, 2),
    // 본관 동관 아케이드 특별연구 윙 (x: 36.3 ~ 45.5, z: -8.8 ~ +8.8 — 1층 y: 0~3.8m 은 보도블록 인도 x=38.3 이 통과하는 개방형 아케이드 필로티!)
    boxMesh(36.3, 45.5, 3.8, 12.2, -8.8, 8.8, mFacade, 2.5),
    boxMesh(36.3, 45.8, 12.2, 13.1, -9.1, 9.1, mFacadeTrim, 2),
    boxMesh(40.5, 45.5, 0, 3.8, -8.6, 8.6, mBrick, 2)
  );
  col(-45.5, -40.5, -8.6, 8.6, true); col(40.5, 45.5, -8.6, 8.6, true);
  col(-28.0, -27.2, -24.8 - ANNEX_DZ, -24.0 - ANNEX_DZ, true); col(-28.0, -27.2, -14.5 - ANNEX_DZ, -13.7 - ANNEX_DZ, true);
  [5.8, 9.8].forEach(yw => {
    [-43.0, -39.0, 39.0, 43.0].forEach(xw => {
      win3D(OUT, 2.2, 1.5, xw, yw, 8.86, 0, pickWin());
      win3D(OUT, 2.2, 1.5, xw, yw, -8.86, Math.PI, pickWin());
    });
    [-26.0, -22.0].forEach(xw => {
      win3D(OUT, 2.2, 1.5, xw, yw, -13.44 - ANNEX_DZ, Math.PI, pickWin());
      win3D(OUT, 2.2, 1.5, xw, yw, -25.06 - ANNEX_DZ, 0, pickWin());
    });
  });
  // ── 캠퍼스 전역 보도블록 · 판석 타일 인도 네트워크 (서쪽 끝 외곽 서문 x=-114, z=55.6 직결 및 전 캠퍼스 100% 연결 · 건물 침범 0건!) ──
  const ROAD_RECTS = [];
  {
    const curbG = [];
    const tileRoad = (x1, x2, z1, z2, curbW = true, curbZ = false) => {
      ROAD_RECTS.push([x1 - .55, x2 + .55, z1 - .55, z2 + .55]);
      (OUT.userData.paths ||= []).push({ x1, x2, z1, z2, curbW, curbZ, mesh: flat(OUT, pave, x1, x2, z1, z2, .012, 3) }); OUT.userData.pave = pave;   // 재배치용 (campusPaths.js)
      if (curbW) { curbG.push(bx(.16, .08, z2 - z1, x1 - .08, .04, (z1 + z2) / 2, 2), bx(.16, .08, z2 - z1, x2 + .08, .04, (z1 + z2) / 2, 2)); }
      if (curbZ) { curbG.push(bx(x2 - x1, .08, .16, (x1 + x2) / 2, .04, z1 - .08, 2), bx(x2 - x1, .08, .16, (x1 + x2) / 2, .04, z2 + .08, 2)); }
    };
    // 1) 본관 남쪽 전면 횡단 인도 & 서부·동부 남북 종단 인도
    tileRoad(-29.6, 27.6, 10.2, 12.4, false, true);      // 본관 정문 앞 동서 연결 광장 인도
    tileRoad(-29.6, -27.2, 11.0, 57.2, true, false);     // 서부 남북 종단 인도 (본관 남서 ↔ 급식실 ↔ 수영장 ↔ 서문 대보행로 직결!)
    tileRoad(25.0, 27.6, 11.0, 57.5, true, false);       // 동부 남북 종단 인도 (본관 남동 ↔ 체육관 ↔ 제1주차장 입구 직결!)
    // 2) 본관 서쪽·동쪽 외곽 아케이드 통과 남북 우회 인도
    tileRoad(-39.6, -37.0, -35.2, 12.0, true, false);    // 본관 서관 아케이드 통과 인도 (북부 인도 ↔ 필로티 인도 ↔ 급식실 북쪽)
    tileRoad(37.0, 39.6, -35.2, 12.0, true, false);      // 본관 동관 아케이드 통과 인도 (북부 인도 ↔ 필로티 인도 ↔ 체육관 북쪽)
    tileRoad(-39.6, -27.2, 9.8, 12.2, false, true);      // 서쪽 아케이드 인도 ↔ 서부 남북 인도 연결
    tileRoad(25.0, 39.6, 9.8, 12.2, false, true);        // 동쪽 아케이드 인도 ↔ 동부 남북 인도 연결
    // 3) 구름다리 아래 1층 필로티 동서 횡단 메인 인도 & 별관 서편 필로티(비상구) 연결 인도
    tileRoad(-37.0, 37.0, -16.8, -13.6, false, true);
    tileRoad(-26.8, -20.2, -32.4, -16.8, true, false);
    flat(OUT, pave, -5.5, 6.5, WALKWAY.z1 + .02, WALKWAY.z2 - .02, .014, 3);
    // 4) ★ 서문(西門, x=-114.0, z=55.6 — 2번 사진 자리!) 직결 서남 동서 대보행로 & 중서부 연결로
    tileRoad(-113.8, -27.2, 54.0, 57.2, false, true);    // 정문/운동장 서남단(x=-27.2)에서 제2주차장·학생회관 사이를 지나 서쪽 끝 서문(x=-113.8, z=55.6)까지 일직선 직결!
    tileRoad(-69.4, -29.6, 26.6, 29.4, false, true);     // 급식실(z<=25)과 수영장(z>=31) 사이를 통과하는 중서부 동서 연결 인도
    tileRoad(-33.8, -29.6, 39.6, 42.4, false, true);     // 수영장 정문 진입 지선
    // 5) 서편 확장 캠퍼스 남북 종단 대로 & 서편 4대 시설 진입 지선
    tileRoad(-72.2, -69.4, -45.0, 57.2, true, false);    // 서편 남북 종단 대로 (청운학사 기숙사 ↔ 테니스장 ↔ 야구장 ↔ 학생회관 ↔ 서문 대보행로 직결!)
    tileRoad(-75.0, -72.2, -43.5, -40.5, false, true);   // 청운학사(2층 기숙사) 정문 진입 지선
    tileRoad(-78.0, -72.2, -17.5, -14.5, false, true);   // 테니스·양궁 훈련장 진입 지선
    tileRoad(-76.0, -72.2, 12.5, 15.5, false, true);     // 서문고 야구 스타디움 진입 지선
    tileRoad(-77.0, -72.2, 40.5, 43.5, false, true);     // 학생회관·동아리관 정문 진입 지선
    // 6) 북부 캠퍼스 동서 관통 대보행로 (서편 대로 x=-69.4 ↔ 대강당 ↔ 북문/청운호 ↔ 중앙중정 ↔ 야외음악당 ↔ 동편 대로 x=69.4 일직선 관통!)
    tileRoad(-69.4, 69.4, -35.2, -32.4, false, true);    // 별관 북벽(z=-32.0) 북쪽을 따라 캠퍼스 동서를 하나로 잇는 북부 메인 인도
    tileRoad(1.4, 4.6, -44.0, -35.2, true, false);       // 중앙 중정(창립자 석상 정원) 진입 인도
    tileRoad(-10.6, -7.4, -75.8, -35.2, true, false);    // 청운호 생태수변공원 & 호심정 남북 진입 인도
    tileRoad(33.4, 36.6, -40.5, -35.2, true, false);      // 해교 야외 음악당 진입 지선
    // 7) 동편 확장 캠퍼스 남북 종단 대로 & 동편 시설 연결 인도
    tileRoad(27.6, 69.4, 35.2, 38.0, false, true);       // 체육관(z<=34.5)과 야외농구장(z>=38.5) 사이를 통과해 동편 대로까지 잇는 동남 메인 인도
    tileRoad(43.4, 46.0, 38.0, 57.5, true, false);       // 야외농구장 동편 ~ 제1주차장 연결 남북 인도
    tileRoad(69.4, 72.2, -51.5, 44.0, true, false);      // 동편 남북 종단 대로 (생태온실 ↔ 과학천문관 ↔ 1998 학우매점 ↔ 중앙학술정보관 대도서관 직결!)
    tileRoad(65.2, 69.4, -51.5, -48.5, false, true);     // 생물부 생태온실 진입 지선
    tileRoad(39.6, 69.4, 3.6, 6.4, false, true);         // 본관 동관 아케이드(x=39.6) ↔ 동편 남북 대로(x=69.4) & 동편 학술광장 직결 중앙 동서 보행로!
    tileRoad(72.2, 74.0, -35.5, -32.5, false, true);     // 과학천문관 정문 진입 지선
    tileRoad(60.0, 69.4, 21.4, 24.2, false, true);       // 1998 구관 학우매점 전면 진입 지선
    tileRoad(72.2, 73.2, 37.5, 40.5, false, true);       // 중앙학술정보관(대도서관) 정문 진입 지선
    { const cm = new THREE.Mesh(merge(curbG), mStep); OUT.add(cm); OUT.userData.pathCurb = cm; OUT.userData.curbMat = mStep; }
  }

  // 본관-별관 2층·3층 공중 구름다리 (Skybridge) & 1층 개방형 필로티 기둥 구조:
  // 1층(y 0 ~ 3.85m)은 벽 없이 완전히 뚫려 동서 보행이 자유롭고, 2층(y 4.0m)에서 실내 구름다리를 통해 별관 2층으로 건너간다!
  {
    const W = WALKWAY, g = [], al = [], gl = [], cxW = (W.x1 + W.x2) / 2, czW = (W.z1 + W.z2) / 2, L = W.z2 - W.z1, Wd = W.x2 - W.x1;
    // 1층 필로티 원형 콘크리트 기둥 4기 + 상부 받침 보(Girder) + 필로티 천장 다운라이트
    [[-1.25, -17.6], [2.85, -17.6], [-1.25, -12.8], [2.85, -12.8]].forEach(([px, pz]) => {
      g.push(new THREE.CylinderGeometry(.26, .28, 3.85, 16).translate(px, 1.925, pz), bx(.68, .28, .68, px, 3.72, pz, 2));
      col(px - .28, px + .28, pz - .28, pz + .28, true);
    });
    g.push(bx(Wd + .5, .28, .45, cxW, 3.76, -17.6, 2), bx(Wd + .5, .28, .45, cxW, 3.76, -12.8, 2));
    // 2층(f=1) · 3층(f=2) 공중 구름다리 외관
    for (let f = 1; f < 3; f++) {
      const y = f * FH;
      g.push(bx(Wd + .4, .32, L, cxW, y + 3.26, czW, 2));                                      // 지붕 슬래브
      g.push(bx(Wd + .4, .3, L, cxW, y - .15, czW, 2));                                        // 구름다리 바닥 슬래브
      [W.x1, W.x2].forEach(x => {
        g.push(bx(.26, .5, L, x, y + .25, czW, 2));                                            // 콘크리트 기단(유리 아래 허리벽)
        [W.z1 + .15, czW, W.z2 - .15].forEach(z => al.push(bx(.12, 2.6, .12, x, y + 1.8, z))); // 커튼월 기둥(멀리언)
        for (let z = W.z1 + .15; z < W.z2 - .3; z += (L - .3) / 3) al.push(bx(.06, 2.6, .06, x, y + 1.8, z + (L - .3) / 6));
        al.push(bx(.1, .08, L, x, y + .54, czW), bx(.1, .08, L, x, y + 1.7, czW), bx(.1, .1, L, x, y + 3.08, czW));
      });
      gl.push([W.x1, y], [W.x2, y]);
    }
    const fm = new THREE.Mesh(merge(g), mFacade); OUT.add(fm);
    OUT.add(new THREE.Mesh(merge(al), mPoleW));
    const mGl = new THREE.MeshStandardMaterial({ color: 0x8aa0a8, roughness: .12, metalness: .2, transparent: true, opacity: .22, side: THREE.DoubleSide, depthWrite: false });
    gl.forEach(([x, y]) => plane(OUT, mGl, L, 2.55, x, y + 1.78, czW, x < cxW ? Math.PI / 2 : -Math.PI / 2));
    // 구름다리 외벽 명패 (2층 높이 y = 4.0 + 3.15 = 7.15m 양면에 장착)
    plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('본관 2F ⇄ 별관 2F 구름다리', '#182832', '#dcece6', 22) }), 2.8, .42, W.x2 + .22, FH + 3.22, czW, Math.PI / 2);
    plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('본관 2F ⇄ 별관 2F 구름다리', '#182832', '#dcece6', 22) }), 2.8, .42, W.x1 - .22, FH + 3.22, czW, -Math.PI / 2);
    // 1층 양끝 야외 출입문: 본관 1층 후문(x 0.8, z -9.9) & 별관 1층 정문(x 0, z W.z1)
    const doorAt = (x, z, y0, w) => {
      OUT.add(new THREE.Mesh(merge([bx(.14, 2.48, .22, x - w / 2 - .07, y0 + 1.24, z), bx(.14, 2.48, .22, x + w / 2 + .07, y0 + 1.24, z), bx(w + .28, .16, .22, x, y0 + 2.52, z)]), mDarkMetal));
    };
    doorAt(.8, -9.9 - .1, 0, 1.3, Math.PI);
    plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('본관 1F 후문 (중앙계단)', '#1e2a2e', '#d9e4d0', 22), color: 0x9aa59a }), 1.5, .3, .8, 2.8, -10.02, Math.PI);
    // 옥상 환기 펜트하우스 (외관 디자인 시트 '상부 / 옥상 라인'): 바깥에서도 파라펫 위로 보인다 · 옥상 충돌
    { const RF = floors.find(F => F.f === 3), slats = [];
      [-27, -15, 15, 27].forEach(x => { const z = 3.2; OUT.add(boxMesh(x - .9, x + .9, ROOF_Y, ROOF_Y + 1.6, z - .9, z + .9, mFacade, 2), boxMesh(x - 1.05, x + 1.05, ROOF_Y + 1.6, ROOF_Y + 1.75, z - 1.05, z + 1.05, mFacade, 2));
        for (let k = 0; k < 5; k++) [-1, 1].forEach(s2 => slats.push(bx(1.3, .05, .06, x, ROOF_Y + .45 + k * .2, z + s2 * .93, 1)));
        RF.col.push({ x1: x - 1, x2: x + 1, z1: z - 1, z2: z + 1 }); });
      OUT.add(new THREE.Mesh(merge(slats), mRust)); }
    model('metal_trash_can', 26.8, 0, 14.6, Math.PI, { out: true, col: [.65, .56] });
    const glowWarmOut = T.makeGlow('255,205,120');
    const extLamp = (lx, ly, lz, lry) => { model('sf_bulkhead_lamp', lx, ly, lz, lry, { out: true }); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowWarmOut, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .75 })); sp.scale.set(1.1, 1.1, 1); sp.position.set(lx + Math.sin(lry) * .12, ly + .17, lz + Math.cos(lry) * .12); OUT.add(sp); };
    [-3.1, 3.1, -19.5, 19.5].forEach(lx => extLamp(lx, 3.05, MAIN_ZS + .08, 0));
    [-2.4, 2.4].forEach(lx => extLamp(lx, 3.05, -13.45 - ANNEX_DZ, 0));
    model('sf_fuse_box', 36.32, 1.35, 4.0, Math.PI / 2, { out: true });
    model('sf_fuse_box', -3.2, 1.35, -13.42 - ANNEX_DZ, 0, { out: true });
    [[-28.28, -Math.PI / 2], [28.28, Math.PI / 2]].forEach(([x, ry]) => model('exterior_aircon_unit', x, 1.35, -19.0 - ANNEX_DZ, ry, { out: true }));
    // 1층 야외 필로티 광장 출입문: 본관 1층 후문 & 별관 1층 정문
    doors.push({ floor: 0, x: .8, z: -10.5, r: 1.4, seamless: true, label: '본관 1층 후문 (계단실)', to: { floor: 0, x: .8, z: -8.7, yaw: Math.PI } });
    // 2층 · 3층 공중 구름다리: 본관 계단실과 물리적으로 뚫려 있어 걸어서 바로 통과하며, 북쪽 끝도 걸어서 바로 별관 2층·3층 중앙 연결 홀로 이어진다!
    doors.push({ floor: 1, x: .8, z: WALKWAY.z1 + .85, r: 1.6, seamless: true, label: '별관 2층 연결 홀', to: { floor: 9, x: 0, z: 8.4, yaw: 0 } });
    doors.push({ floor: 2, x: .8, z: WALKWAY.z1 + .85, r: 1.6, seamless: true, label: '별관 3층 연결 홀', to: { floor: 10, x: 0, z: 8.4, yaw: 0 } });
    floors[2].col.push({ x1: -1.62, x2: -.8, z1: WALKWAY.z1, z2: WALKWAY.z2 }, { x1: 2.4, x2: 3.75, z1: WALKWAY.z1, z2: WALKWAY.z2 });
    floors[2].walls.push({ x1: -1.62, x2: -.8, z1: WALKWAY.z1, z2: WALKWAY.z2 }, { x1: 2.4, x2: 3.75, z1: WALKWAY.z1, z2: WALKWAY.z2 });
  }
  annexExitDoor(OUT, -20.42, -Math.PI / 2);   // 별관 서쪽 비상구 (바깥 면)
  doors.push({ floor: 0, x: -21.2, z: ANNEX_EXIT_Z, r: 1.4, label: '별관 비상구로 들어가기', to: { floor: 8, x: -18.9, z: 0, yaw: -Math.PI / 2 } });
  plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('별관 (특별교실동)', '#1e2a2e', '#d9e4d0', 26), color: 0x9aa59a }), 3.4, .85, 0, 3.6, -13.46 - ANNEX_DZ, 0);
  doors.push({ floor: 0, x: .8, z: WALKWAY.z1 + 1.1, r: 2.0, seamless: true, label: '별관 1층 연결 홀', to: { floor: 8, x: .8, z: 8.3, yaw: 0 } });

  // 본관 외관 디테일: 기둥(필라스터) · 창 상인방 · 기단 · 처마 코니스 · 파라펫 · 우수관 · 북/측면 창
  {
    const fac = [], dark = [], pipes = [], X0 = -36.3, X1 = 36.3, ZS = MAIN_ZS, ZN = -9.9, ZL = MAIN_ZS + 9.9, ZC = (MAIN_ZS - 9.9) / 2, TOP = 3 * FH + .4;
    for (let x = -28; x <= 28; x += 8) { const y0 = Math.abs(x) < 4.5 ? 3.25 : 0; fac.push(bx(.42, TOP - y0, .22, x, (TOP + y0) / 2, ZS + .11, 3)); }
    [X0 + .3, X1 - .3].forEach(x => fac.push(bx(.8, TOP, .32, x, TOP / 2, ZS + .16, 3), bx(.32, TOP, .8, x < 0 ? X0 - .16 : X1 + .16, TOP / 2, ZS - .3, 3)));
    // 남면 창 상인방 (남쪽 방 창: 방 중심 ±3.05)
    for (let f = 0; f < 3; f++) SLOTS.forEach(cx => [cx - 3.05, cx + 3.05].forEach(x => fac.push(bx(1.7, .16, .2, x, f * FH + 2.62, ZS + .1, 3))));
    for (let f = 0; f < 3; f++) for (let x = -34; x <= 34; x += 4) {
      const y = f * FH;
      if (x > WALKWAY.x1 - 1.4 && x < WALKWAY.x2 + 1.4) continue;   // 연결 통로 · 구름다리가 붙는 자리: 창 대신 통로 출입문 (예전엔 창이 문 위에 겹쳐 그려졌다)
      // 북면 창은 F.shell 에 실제 구멍이 뚫린 win3D 로 통합됨 (창문을 막던 불투명 평면 제거)
    }
    // 측면 창 (계단 끝 벽)
    for (let f = 0; f < 3; f++) [-7, -3, 3, 7].forEach(z => [[X0 - .04, -Math.PI / 2], [X1 + .04, Math.PI / 2]].forEach(([x, ry]) => {
      win3D(OUT, 1.6, 1.5, x, f * FH + 1.75, z, ry, pickWin()); fac.push(bx(.2, .1, 2.0, x + Math.sign(x) * .1, f * FH + .95, z, 3));
    }));
    // 층간 띠 (북면) · 기단 · 코니스 · 파라펫 갓돌
    for (let f = 1; f < 3; f++) fac.push(bx(X1 - X0 + .4, .28, .18, 0, f * FH, ZN - .09, 3));
    fac.push(bx(-.95 - (X0 - .3), .55, .16, (X0 - .3 - .95) / 2, .27, ZN - .08, 3), bx(X1 + .3 - 2.55, .55, .16, (X1 + .3 + 2.55) / 2, .27, ZN - .08, 3),   /* 북면 기단: 연결 통로 입구(x −0.95 ~ 2.55)는 비운다 — 문 앞을 가로질러 턱처럼 보였다 */ bx(.16, .55, ZL + .25, X0 - .08, .27, ZC, 3), bx(.16, .55, ZL + .25, X1 + .08, .27, ZC, 3));
    fac.push(bx(X1 - X0 + 1.0, .22, .5, 0, TOP + .05, ZS + .25, 3), bx(X1 - X0 + 1.0, .22, .5, 0, TOP + .05, ZN - .25, 3));
    fac.push(bx(.5, .22, ZL + .95, X0 - .25, TOP + .05, ZC, 3), bx(.5, .22, ZL + .95, X1 + .25, TOP + .05, ZC, 3));
    // 파라펫 바깥 면 (옥상 층이 안 보일 때도 외부에서 보이도록)
    fac.push(bx(X1 - X0 + .8, 1.15, .1, 0, TOP + .58, ZN - .35, 3), bx(X1 - X0 + .8, 1.15, .1, 0, TOP + .58, ZS + .35, 3), bx(.1, 1.15, ZL + .55, X0 - .35, TOP + .58, ZC, 3), bx(.1, 1.15, ZL + .55, X1 + .35, TOP + .58, ZC, 3));
    for (let x = -28; x <= 28; x += 8) if (Math.abs(x) >= 4.5) col(x - .21, x + .21, ZS, ZS + .22);
    fac.push(bx(X1 - X0 + .8, .12, .45, 0, TOP + 1.2, ZN - .2, 3), bx(.45, .12, ZL + .75, X0 - .2, TOP + 1.2, ZC, 3), bx(.45, .12, ZL + .75, X1 + .2, TOP + 1.2, ZC, 3), bx(X1 - X0 + .8, .12, .45, 0, TOP + 1.2, ZS + .2, 3));
    // 우수관 (홈통 + 이음쇠)
    [[-24.1, ZS + .3], [24.1, ZS + .3], [-16, ZN - .2], [16, ZN - .2]].forEach(([x, z]) => {
      pipes.push(tube(.06, x, .05, z, x, TOP + .1, z));
      for (let y = 1; y < TOP; y += 2) pipes.push(new THREE.CylinderGeometry(.085, .085, .08, 8).translate(x, y, z));
      pipes.push(tube(.06, x, .05, z, x, .05, z + (z > 0 ? .4 : -.4)));
    });
    const fm = new THREE.Mesh(merge(fac), mFacadeTrim); OUT.add(fm);
    OUT.add(new THREE.Mesh(merge(dark), mFrame), new THREE.Mesh(merge(pipes), mRust));
    // 별관 외관 보강: 창틀 · 층간 띠 · 코니스
    const af = [];
    [1.8, 5.8, 9.8].forEach((y, r) => { for (let x = -18; x <= 26; x += 4) { if (x > -3.5 && x < 4.5) continue; af.push(bx(2.7, .1, .2, x, y - .85, -13.4 - ANNEX_DZ, 3), bx(2.7, .14, .14, x, y + .86, -13.43 - ANNEX_DZ, 3)); } });
    [4, 8].forEach(y => { af.push(bx(19.2, .26, .16, -10.55, y, -13.42 - ANNEX_DZ, 3), bx(25.4, .26, .16, 15.25, y, -13.42 - ANNEX_DZ, 3)); });
    for (let x = -20; x <= 20; x += 8) if (x !== 0) af.push(bx(.4, 12.4, .2, x, 6.2, -13.4 - ANNEX_DZ, 3));
    // (예전 별관 현관 캐노피 + 기둥 2개는 연결 통로 안에 겹쳐 서 있어 제거 — 연결 통로 지붕이 현관을 덮는다)
    OUT.add(new THREE.Mesh(merge(af), mFacadeTrim));
    // 체육관 · 수영장 · 급식실 외관: 기단 · 수직 리브 · 처마 홈통
    const gf = [];
    for (let z = 13.5; z <= 33.5; z += 4) { gf.push(bx(.24, 8, .3, 27.88, 4, z, 3), bx(.24, 8, .3, 48.12, 4, z, 3)); }
    [12.5, 34.5].forEach(z => gf.push(bx(20.4, .5, .2, 38, .25, z + (z > 20 ? .1 : -.1), 3)));
    gf.push(bx(.2, .5, 22, 27.9, .25, 23.5, 3), bx(.2, .5, 22, 48.1, .25, 23.5, 3));
    [15.5, 19.5, 23.5, 27.5, 31.5].forEach(z => { gf.push(bx(.16, .1, 2.7, 27.9, 4.2, z, 3), bx(.16, .1, 2.7, 48.1, 4.2, z, 3)); });
    gf.push(bx(18.4, .4, .2, -39, .2, 25.1, 3), bx(.2, .4, 12.5, -29.9, .2, 18.75, 3));
    OUT.add(new THREE.Mesh(merge(gf), mFacadeTrim));
    [15.5, 19.5, 23.5, 27.5, 31.5].forEach(z => { plane(OUT, pickWin(), 2.4, 1.8, 27.98, 5.2, z, -Math.PI / 2); plane(OUT, pickWin(), 2.4, 1.8, 48.02, 5.2, z, Math.PI / 2); });
    [15.5, 19.5, 23.5].forEach(z => plane(OUT, pickWin(), 2.4, 1.6, -48.02, 2.4, z, -Math.PI / 2));
  }
  // 15,000평(230m × 180m) 메가 캠퍼스 통합 외곽 대경계 담장 (캠퍼스 중간을 가로막던 구 내곽 담장은 철거하고 외곽 경계와 서문 x=-114, z=55.6 으로 통합!)
  outWall(-114.5, -113.8, -108, 51.5, fenceH, mFence);
  outWall(-114.5, -113.8, 59.7, GATE_Z, fenceH, mFence);
  outWall(113.8, 114.5, -108, GATE_Z, fenceH, mFence);
  outWall(-114.5, 114.5, -108.5, -107.8, fenceH, mFence);
  // 정문 안쪽 (설계집 '서문 상세 안내도'): 경비실 · 교훈 표지석 · 조경 벤치
  {
    // 경비실: 제공 모델 350×280×250cm, 지도에 표시된 정문 안쪽 중앙 보행로 동편 위치
    const G = new THREE.Group(); G.name = 'GUARDROOM_FALLBACK'; G.userData.dynamic = true; OUT.add(G);
    const holder = new THREE.Group(); holder.name = 'GUARDROOM_HOLDER'; holder.userData.dynamic = true; holder.position.set(GUARD_LAYOUT.originX, GUARD_LAYOUT.floorY, GUARD_LAYOUT.originZ); OUT.add(holder); if (!window.__oldGuard) holder.visible = false;
    flat(OUT, pave, GUARD_SPUR.x1, GUARD_SPUR.x2, GUARD_SPUR.z1, GUARD_SPUR.z2, .025, 2);
    const guardFabric = S(null, { color: 0xc9c5b9, roughness: .95 });
    for (const n of (window.__oldGuard ? GUARD_NODES : [])) {   // (구)경비실 철거: 새 경비동 당직실이 그 자리를 대신한다
      if (/ENTRANCE_DOOR|ENTRANCE_HANDLE/.test(n.name)) continue;
      const mat = n.name.startsWith('SHELL_') ? (n.name === 'SHELL_FLOOR' ? mFloorTile : mFacade) : n.name.startsWith('WINDOW_') ? mWinIn : /^F01_/.test(n.name) ? mWood : /^F03_/.test(n.name) ? mMetal : /^F05_/.test(n.name) ? guardFabric : mWhite;
      const m = boxMesh(GUARD_LAYOUT.originX + n.min[0], GUARD_LAYOUT.originX + n.max[0], GUARD_LAYOUT.floorY + n.min[2], GUARD_LAYOUT.floorY + n.max[2], GUARD_LAYOUT.originZ - n.max[1], GUARD_LAYOUT.originZ - n.min[1], mat, 2); m.name = n.name; G.add(m);
    }
    const furnitureColliders = [];
    for (const c of (window.__oldGuard ? guardCollisionRects() : [])) { col(c.x1, c.x2, c.z1, c.z2, c.wall); if (!c.wall) furnitureColliders.push({id:c.id,collider:cur.col[cur.col.length-1]}); }
    const doorPivot = new THREE.Group(); doorPivot.position.set(GUARD_LAYOUT.doorX, GUARD_LAYOUT.floorY, GUARD_LAYOUT.doorZ); doorPivot.rotation.y = -Math.PI / 2; G.add(doorPivot);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(.85, 2.05, .05), mDoor); leaf.geometry.translate(.425, 1.025, 0); doorPivot.add(leaf);
    const doorCollider = { x1: GUARD_LAYOUT.doorX - .025, x2: GUARD_LAYOUT.doorX + .025, z1: GUARD_LAYOUT.doorZ, z2: GUARD_LAYOUT.doorZ + .85, off: false, guardDoor: true }; cur.col.push(doorCollider);
    if (window.__oldGuard) OUT.add(boxMesh(GUARD_LAYOUT.originX - .18, GUARD_LAYOUT.originX + 3.68, 2.52, 2.64, GUARD_LAYOUT.originZ - 2.98, GUARD_LAYOUT.originZ + .18, mFacade, 2));
    if (window.__oldGuard) plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('경비실', '#1e2a2e', '#d9e4d0', 34), color: 0x9aa59a }), 1.1, .3, GUARD_LAYOUT.originX + 1.1, 2.30, GUARD_LAYOUT.originZ + .125, 0);
    Object.assign(guardRoom, { holder, furnitureColliders, fallback: G, fallbackDoorPivot: doorPivot, doorCollider, ceilingCover: false, templates: { wall: mFacade, floor: mFloorTile, wood: mWood, metal: mMetal, fabric: guardFabric }, layout: GUARD_LAYOUT });
    props.push({ kind: 'robj', k: 'guarddoor', t: 'guard', floor: 0, x: GUARD_LAYOUT.doorX + .425, z: GUARD_LAYOUT.doorZ, y: 1.05, r: 1.5, label: '경비실 문 닫기' });
    props.push({ kind: 'robj', k: 'guardlog', t: 'guard', floor: 0, ...GUARD_LAYOUT.log, x: 5.9, z: 67.14, r: 2.1, label: '경비실 심야 순찰 일지 & 경비원 육성 녹음 확인하기' });
    props.push({ kind: 'robj', k: 'guard_recorder', t: 'guard', floor: 0, x: 6.28, z: 67.08, y: 0.84, r: 2.1, label: '경비실 보이스레코더 — 1998년 그날 밤 경비원 녹취록 재생' });
    props.push({ kind: 'robj', k: 'guardcctv', t: 'guard', floor: 0, ...GUARD_LAYOUT.cctv, label: 'CCTV 전원 끄기' });
    guardAnnex = buildGuardAnnex({ OUT, props, boxMesh, plane, flat, col, S, model: (n, x, y, z, ry, o = {}) => model(n, x, y, z, ry, { ...o, out: true }), makeSign: T.makeSign, mats: { facade: mFacade, wall: mWall, white: mWhite, floor: mFloorTile, wood: mWood, metal: mMetal, glass: mWinIn } });
    col(GANX.x1 - .95, GANX.x1, GANX.doorZ1 - .02, GANX.doorZ1 + .04, true);
    guardAnnex.duty = buildDutyRoom({ G: guardAnnex.group, props, boxMesh, plane, flat, col, S, model: (n, x, y, z, ry, o = {}) => model(n, x, y, z, ry, { ...o, out: true }), makeSign: T.makeSign, mats: { facade: mFacade, wall: mWall, white: mWhite, floor: mFloorTile, wood: mWood, metal: mMetal, glass: mWinIn } });
    guardAnnex.group.traverse(o => { o.userData.dynamic = true; });
    props.push({ kind: 'robj', k: 'guardlight', t: 'guard', floor: 0, ...GUARD_LAYOUT.lightSwitch, label: '경비실 전등 켜기' });
    // 교훈 표지석: 납작한 화강암 + 새긴 글씨 + 받침 화단
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1).scale(1.7, 1.0, .55), S(null, { color: 0x8a8478, roughness: .85 })); stone.position.set(-20, 1.0, 64); stone.rotation.y = .15; OUT.add(stone); col(-21.8, -18.2, 63.2, 64.8, true);
    OUT.add(boxMesh(-22.3, -17.7, 0, .3, 62.6, 65.4, S(null, { color: 0x6a645a, roughness: .9 })));
    const tx = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .9), new THREE.MeshStandardMaterial({ map: T.makeSign('성실 · 창의 · 배려', '#7a7468', '#2a2620', 30), roughness: .9, transparent: true, opacity: .92 }));
    tx.position.set(-20, 1.25, 64.56); tx.rotation.y = .15; OUT.add(tx);
    // 조경 벤치 (캠퍼스 목재·주철 벤치 2개)
    [[-26, 61.2, Math.PI], [27, 60.6, Math.PI]].forEach(([x, z, r]) => model('sf_park_bench', x, 0, z, r, { out: true, col: [1.85, .64] }));
  }
  // 정문 기둥
  const pillarM = S(T.makeFence()); const plaque = new THREE.MeshStandardMaterial({ map: T.makeGatePlaque('서문고등학교'), roughness: .9 });
  [[-4.5], [4.5]].forEach(([px]) => {
    const p = boxMesh(px - .65, px + .65, 0, 3.4, GATE_Z - .65, GATE_Z + .65, pillarM); OUT.add(p); col(px - .65, px + .65, GATE_Z - .65, GATE_Z + .65, true);
    const cap = boxMesh(px - .8, px + .8, 3.4, 3.65, GATE_Z - .8, GATE_Z + .8, pillarM); OUT.add(cap);
    plane(OUT, plaque, .55, 2.2, px, 1.75, GATE_Z + .66);
  });
  { const bg = new THREE.PlaneGeometry(3.4, 1.1, 12, 4), bp = bg.attributes.position; for (let i = 0; i < bp.count; i++) bp.setZ(i, Math.sin(bp.getX(i) * 2.2) * .06 + (bp.getY(i) < -.4 ? Math.sin(bp.getX(i) * 9) * .04 : 0)); bg.computeVertexNormals();
    const bm = new THREE.MeshStandardMaterial({ map: T.makeSign('서문고등학교', '#d6cfba', '#6a1c1c', 46), roughness: 1, side: THREE.DoubleSide });
    const ban = new THREE.Mesh(bg, bm); ban.position.set(11.5, 1.75, GATE_Z + .3); ban.rotation.z = .03; OUT.add(ban); }
  const warn = new THREE.MeshStandardMaterial({ map: T.makeWarning(), roughness: .8 });
  plane(OUT, warn, 1.1, .7, -7.5, 1.7, GATE_Z + .27); plane(OUT, warn, 1.1, .7, 12, 1.7, GATE_Z - .27, Math.PI);
  plane(OUT, warn, 1.1, .7, 9.5, 1.7, GATE_Z + .27);
  // 철문
  const gate = { open: 0, target: 0, leaves: [], wall: null };
  const gateBars = new THREE.Group(); OUT.add(gateBars);
  const mkLeaf = (hx, dir) => {
    const piv = new THREE.Group(); piv.position.set(hx, 0, GATE_Z); piv.userData.dynamic = true;
    const leaf = new THREE.Group(); piv.add(leaf);
    const L = 4;
    const add2 = (w, h, d, x, y, z) => { const m = new THREE.Mesh(unit, mRust); m.scale.set(w, h, d); m.position.set(x, y + h / 2, z); leaf.add(m); };
    add2(L, .12, .1, dir * L / 2, .2, 0); add2(L, .12, .1, dir * L / 2, 2.2, 0); add2(.12, 2.3, .1, dir * .06, .1, 0); add2(.12, 2.3, .1, dir * (L - .06), .1, 0);
    for (let k = 1; k < 14; k++) add2(.04, 2.3, .04, dir * k * L / 14, .1, 0);
    add2(L, .06, .06, dir * L / 2, 1.2, 0);
    OUT.add(piv); return { piv, dir };
  };
  gate.leaves = [mkLeaf(-4, 1), mkLeaf(4, -1)];
  // 처음엔 열려 있음 → 입장 후 닫힘
  gate.setOpen = (v) => { gate.open = v; gate.leaves[0].piv.rotation.y = -v * Math.PI / 2 * 0.95; gate.leaves[1].piv.rotation.y = v * Math.PI / 2 * 0.95; };
  gate.setOpen(1);
  // 자물쇠+사슬
  const chain = new THREE.Mesh(new THREE.TorusGeometry(.18, .03, 6, 12), mRust); chain.position.set(0, 1.2, GATE_Z); chain.userData.dynamic = true; OUT.add(chain);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(.18, .22, .1), S(null, { color: 0x6a5a30, metalness: .8, roughness: .4 })); lock.position.set(0, 1.0, GATE_Z + .06); lock.userData.dynamic = true; OUT.add(lock);
  const lockGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.makeGlow('255,40,30'), blending: THREE.AdditiveBlending, depthWrite: false }));
  lockGlow.scale.set(.9, .9, .9); lockGlow.position.set(0, 1.0, GATE_Z + .15); OUT.add(lockGlow); gate.lockGlow = lockGlow;
  gate.lockParts = [chain, lock, lockGlow]; gate.lockParts.forEach(m => { m.visible = false; });
  gate.blockRect = { x1: -4, x2: 4, z1: GATE_Z - .12, z2: GATE_Z + .12 };

  // 외부 경계 (보이지 않는 벽)
  [[-60, -59, 70, 90], [59, 60, 70, 90], [-60, 60, 82, 83]].forEach(([a, b, c, d]) => col(a, b, c, d));
  col(-60, -50, GATE_Z - .5, GATE_Z + .5);

  // 별관 건물(체육관/급식실) — 외관만
  const gym = boxMesh(28, 48, 0, 8, 12.5, 34.5, mFacade, 3); OUT.add(gym); col(28, 48, 12.5, 34.5, true);
  // 아치형 골강판 지붕 (외부 설정도): 반원 단면을 납작하게 눌러 길이 방향으로 뽑고, 골은 아치를 따라가게 UV 를 돌린다
  function barrelRoof(cx, cz, w, len, y, rise) {
    const r = w / 2, g = new THREE.CylinderGeometry(r, r, len, 28, 1, true, Math.PI / 2, Math.PI); g.rotateX(Math.PI / 2); g.scale(1, rise / r, 1);
    const uv = g.attributes.uv, arc = Math.PI * r * .8;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * len / 2.7, uv.getX(i) * arc / 2.7);
    const m = new THREE.Mesh(g, mRoofMetal); m.position.set(cx, y, cz); OUT.add(m);
    const sh = new THREE.Shape(); sh.absellipse(0, 0, r - .25, rise - .1, 0, Math.PI, false);
    [cz - len / 2 + .3, cz + len / 2 - .3].forEach((z, k) => { const e = new THREE.Mesh(new THREE.ShapeGeometry(sh, 20), mFacade); e.position.set(cx, y, z); e.rotation.y = k ? 0 : Math.PI; OUT.add(e); });
    const eave = []; [-1, 1].forEach(s2 => eave.push(bx(.18, .18, len, cx + s2 * (r - .1), y + .05, cz, 2)));   // 처마 홈통
    OUT.add(new THREE.Mesh(merge(eave), mRust));
  }
  barrelRoof(38, 23.5, 21, 23, 8, 3.3);
  const poolB = boxMesh(-48, -34, 0, 6.4, 31, 51, mBlueMetal, 2.5); OUT.add(poolB); col(-48, -34, 31, 51, true);   // 급식실과 6m 띄움
  OUT.add(boxMesh(-48.2, -33.8, 6.3, 6.5, 30.8, 51.2, mFacade, 3)); barrelRoof(-41, 41, 15, 20.6, 6.5, 2.5);
  [33, 36.5, 45.5, 49].forEach(z => plane(OUT, pickWin(), 2.4, 1.8, -33.98, 3.6, z, Math.PI / 2));
  plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('수 영 장', '#1e2a2e', '#d9e4d0', 34), color: 0x9aa59a }), 2.2, .55, -33.97, 3.8, 41, Math.PI / 2);
  // 큰 건물 출입문: 문틀 + 양여닫이(유리창 · 밀대) + 콘크리트 차양 — 건물 높이에 맞춘 사람 크기 (w × h)
  function bigDoor(x, z, ry, w, h) {
    const g = new THREE.Group(), lw = w / 2 - .05;
    const fr = [bx(.14, h + .14, .16, -w / 2 - .07, (h + .14) / 2, .04), bx(.14, h + .14, .16, w / 2 + .07, (h + .14) / 2, .04), bx(w + .28, .14, .16, 0, h + .07, .04)];
    g.add(new THREE.Mesh(merge(fr), mRust));
    [-1, 1].forEach(sd => {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(lw, h - .02, .05), mDoor); leaf.position.set(sd * (lw / 2 + .02), h / 2, .03); g.add(leaf);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(lw * .55, h * .32), mGlass); gl.position.set(sd * (lw / 2 + .02), h * .68, .06); g.add(gl);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(lw * .7, .05, .06), mChrome); bar.position.set(sd * (lw / 2 + .02), 1.05, .09); g.add(bar);
    });
    const can = new THREE.Mesh(new THREE.BoxGeometry(w + 1.0, .16, 1.3), mFacade); can.position.set(0, h + .35, .65); g.add(can);
    const step = new THREE.Mesh(new THREE.BoxGeometry(w + .8, .12, 1.0), mFacade); step.position.set(0, .06, .5); g.add(step);
    g.position.set(x, 0, z); g.rotation.y = ry; OUT.add(g);
  }
  bigDoor(-33.96, 41, Math.PI / 2, 2.6, 2.9);
  bigDoor(38, 34.52, 0, 3.0, 3.2);
  plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('체 육 관', '#1e2a2e', '#d9e4d0', 34), color: 0x9aa59a }), 2.6, .65, 38, 4.2, 34.54, 0);
  const cafe = boxMesh(-48, -30, 0, 4.5, 12.5, 25, mFacade, 3); OUT.add(cafe); col(-48, -30, 12.5, 25, true);
  OUT.add(boxMesh(-48.4, -29.6, 4.5, 4.75, 12.1, 25.4, mFacade, 3), boxMesh(-48.4, -29.6, 4.75, 5.4, 12.1, 12.35, mFacade, 3), boxMesh(-48.4, -29.6, 4.75, 5.4, 25.15, 25.4, mFacade, 3), boxMesh(-48.4, -48.15, 4.75, 5.4, 12.1, 25.4, mFacade, 3), boxMesh(-29.85, -29.6, 4.75, 5.4, 12.1, 25.4, mFacade, 3));   // 평지붕 + 파라펫
  doors.push({ floor: 0, x: 38, z: 35.9, r: 2.0, label: '체육관 들어가기', to: { floor: 5, x: 38, z: 28.1, yaw: 0 } });
  doors.push({ floor: 0, x: -32.7, z: 41, r: 2.0, label: '수영장 들어가기', to: { floor: 6, x: -35.5, z: 38, yaw: Math.PI / 2 } });
  doors.push({ floor: 0, x: -39, z: 26.4, r: 2.0, label: '급식실 들어가기', to: { floor: 7, x: -39, z: 20.5, yaw: 0 } });
  bigDoor(-39, 25.02, 0, 3.0, 3.0);
  plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('급 식 실', '#1e2a2e', '#d9e4d0', 34), color: 0x9aa59a }), 2.2, .55, -39, 3.85, 25.04, 0);
  [[33, 12.48], [38, 12.48], [43, 12.48]].forEach(([x, z]) => plane(OUT, pickWin(), 3, 1.6, x, 5.2, z, Math.PI));
  [[-44, 12.48], [-39, 12.48], [-34, 12.48]].forEach(([x, z]) => plane(OUT, pickWin(), 3, 1.6, x, 2.4, z, Math.PI));


  // 나무: 건물/길을 피해서 배치, 울퉁불퉁한 수관 + 개체별 색 변화
  const BLOCK = [...ROAD_RECTS, [-46.2, -36.0, -9.5, 9.5], [36.0, 46.2, -9.5, 9.5], [30.2, 39.8, -53.5, -39.5], [-36.5, -28.0, -32.5, -17.0], [-54.5, -40.5, -37.5, -16.5], [GUARD_LAYOUT.originX - 1.4, GUARD_LAYOUT.originX + GUARD_LAYOUT.width + 1.4, GUARD_LAYOUT.originZ - GUARD_LAYOUT.depth - 1.4, GUARD_LAYOUT.originZ + 1.4], [GANX.x1 - 1.2, GANX.x2 + 1.8, GANX.z1 - 1.8, GANX.z2], [-22.5, -17.5, 62.2, 65.8], [-5.8, 6.8, WALKWAY.z1 - .2, -9.6], [-37.5, 37.5, -11, 11.5], [-28.5, 28.5, -32.4, WALKWAY.z1 + 1], [MEGA.gym.x - MEGA.gym.w / 2 - 1.5, MEGA.gym.x + MEGA.gym.w / 2 + 1.5, MEGA.gym.z - MEGA.gym.d / 2 - 1.5, MEGA.gym.z + MEGA.gym.d / 2 + 3.5], [MEGA.court.x - MEGA.court.w / 2 - .5, MEGA.court.x + MEGA.court.w / 2 + .5, MEGA.court.z - MEGA.court.d / 2 - .5, MEGA.court.z + MEGA.court.d / 2 + .5], [26.5, 49.5, 11, 36], [-49.5, -28.5, 11, 26.5], [-49.5, -32.5, 29.5, 52.5], [-5, 5, 60, 72], [-17, 17, 1.5, 12], [-51, 51, -4.8, 13.8], [-32.5, 26.5, -31, -15.3], [-5.6, -.4, -16, -3.6], [14, 47, 57, 68.7], [-98.5, -53.5, 61, 69.7], [-15.2, -7.8, 60, 67]];   // 새 본관 · 별관 · 구름다리 · 주차장 2곳 · 청운정
  const blocked = (x, z, m = 0) => BLOCK.some(([a, b2, c, d]) => x > a - m && x < b2 + m && z > c - m && z < d + m);
  const trunkG = merge([new THREE.CylinderGeometry(.16, .3, 3.4, 7).translate(0, 1.7, 0), tube(.07, 0, 2.2, 0, .9, 3.4, .3), tube(.06, 0, 2.6, 0, -.7, 3.7, -.4)]);
  const lump = (r, x, y, z) => {
    const g = new THREE.IcosahedronGeometry(r, 2), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = Math.sin(p.getX(i) * 12.9 + p.getY(i) * 78.2 + p.getZ(i) * 37.7) * 43758.5; const n = 1 + (k - Math.floor(k) - .5) * .4; p.setXYZ(i, p.getX(i) * n, p.getY(i) * n * .85, p.getZ(i) * n); }
    g.translate(x, y, z); const idx = []; for (let i = 0; i < p.count; i++) idx.push(i); g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  const crownG = merge([lump(1.7, 0, 4.3, 0), lump(1.3, .9, 5.2, .4), lump(1.2, -.8, 4.9, -.5), lump(.9, .1, 5.9, -.1)]);
  const treeM = [], tpos = [[-6.2, 62.4, true, 1], [13.0, 54.6, true, 1], [-17.2, 59.2, true, 1], [12.0, 67.2, true, 1], [-11, 58.0, true, 1], [16.6, 54.6, true, 1]];   // 정문 옆 벚나무 (청운정 · 제1주차장을 비켜서)   // 정문 옆 벚나무
  for (let i = 0; i < 260 && tpos.length < 120; i++) {
    let x, z; const inside = tpos.length < 54;
    if (inside) {
      const side = (rnd() * 4) | 0;
      if (side === 0) { x = rr(-48, 48); z = rr(65.5, 68.5); } else if (side === 1) { x = rr(-48.5, -44); z = rr(NORTH_Z + 2, 66); } else if (side === 2) { x = rr(44, 48.5); z = rr(NORTH_Z + 2, 66); } else { x = rr(-48, 48); z = rr(NORTH_Z + 2, NORTH_Z + 5); }
      if (blocked(x, z, 2.5) || (z > 10.5 && z < 14.5)) continue;
    } else {
      const a = rnd() * 6.28, r = rr(62, 135); x = Math.cos(a) * r * 1.3; z = 20 + Math.sin(a) * r * .95;
      if ((Math.abs(x) < 56 && z > NORTH_Z - 3 && z < 90) || (z > 70 && z < 85) || (x < -50 && x > -95 && z > -35 && z < 110)) continue;
    }
    tpos.push([x, z, inside]);
  }
  const inMegaZone = (x, z) => (x < -42 && z > -46 && z < 66) || (x > 42 && z > -46 && z < 54) || (x > -30 && x < 14 && z < -58) || (x > 14 && x < 38 && z > 58) || (x > -55 && x < -28 && z > -38 && z < -10) || (x > 24 && x < 42 && z > -38 && z < -10);
  tpos.forEach(([x, z, inside]) => { const s2 = rr(.8, 1.4), ry = rnd() * 6, sy = rr(.9, 1.25), hide = inMegaZone(x, z); _o.position.set(x, hide ? -500 : 0, z); _o.rotation.set(0, ry, 0); _o.scale.set(hide ? 0 : s2, hide ? 0 : s2 * sy, hide ? 0 : s2); _o.updateMatrix(); treeM.push(_o.matrix.clone()); if (inside && !hide) col(x - .35, x + .35, z - .35, z + .35); });
  _o.scale.set(1, 1, 1);
  inst(OUT, trunkG, S(T.makeWood([52, 38, 26])), treeM);
  const crowns = inst(OUT, crownG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), treeM);
  const tc = new THREE.Color(); treeM.forEach((m, i) => { if (tpos[i][3]) tc.setHSL(rr(.9, .95), rr(.35, .5), rr(.32, .42)); else tc.setHSL(rr(.2, .3), rr(.2, .35), rr(.045, .085)); crowns.setColorAt(i, tc); }); crowns.instanceColor.needsUpdate = true;
  // 풀: 십자형 풀잎 카드 (알파 텍스처)
  const grassG = merge([new THREE.PlaneGeometry(.8, .55).translate(0, .27, 0), new THREE.PlaneGeometry(.8, .55).rotateY(Math.PI / 2).translate(0, .27, 0)]);
  const grM = [];
  for (let i = 0; i < 4000 && grM.length < 1800; i++) {
    const x = rr(-49, 49), z = rr(NORTH_Z + 1, 69.5);
    if (blocked(x, z, .3) || (z > 9.5 && z < 15.4) || (x > 0 && x < 8.5 && z > 64.5 && z < 70.5) || (Math.abs(x) < 3.6 && z > 1.5) || (x > -27 && x < 27 && z > 15 && z < 59 && rnd() < .9) || (x > 28.5 && x < 43.5 && z > 38 && z < 54)) continue;
    _o.position.set(x, 0, z); _o.rotation.set(0, rnd() * 6, 0); _o.scale.setScalar(rr(.6, 1.5)); _o.updateMatrix(); grM.push(_o.matrix.clone());
  }
  _o.scale.set(1, 1, 1);
  inst(OUT, grassG, new THREE.MeshStandardMaterial({ map: T.makeGrass(), alphaTest: .45, side: THREE.DoubleSide, roughness: 1, color: 0xb8c8a0 }), grM);

  // 하늘: 별 + 달
  const sp = []; for (let i = 0; i < 700; i++) { const a = rnd() * 6.28, e = rr(.08, 1.4); const r = 230; sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  const starG = new THREE.BufferGeometry(); starG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starG, new THREE.PointsMaterial({ color: 0xbcc8e8, size: 1.3, sizeAttenuation: false, fog: false })); scene.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshBasicMaterial({ color: 0xe6ecff, fog: false })); moon.position.set(-60, 105, -190); scene.add(moon);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.makeGlow('150,180,255'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  moonGlow.scale.set(90, 90, 1); moonGlow.position.copy(moon.position); scene.add(moonGlow);

  /* ---------- 갱신 ---------- */
  // 마무리: 층별 책 인스턴싱 + 정적 배칭
  const campusDesign = buildCampusDesign({out:OUT,facade:floors[0].shell,brick:mBrick,concrete:mStep,metal:mMetal,colliders:floors[0].col});
  // CCTV audit: ceiling-supported coverage for annex corridors and independent areas.
  for (const f of [8,9,10]) { const F=floors.find(n=>n.f===f); for(const x of [-19.5,19.5]) cctv(x,CH,-1.1,0,{parent:F.interior,floor:f,target:[0,1.4,0],label:AREA_NAMES[f]+' · 복도 '+(x<0?'서쪽':'동쪽')}); }
  for (const p of [
    {f:5,x:28.55,z:29.40,y:7.888,target:[38,1.6,18],label:'체육관 · 무대/코트'},
    {f:6,x:-49.45,z:30.55,y:6.288,target:[-42,1.4,39],label:'수영장 · 풀 홀'},
    {f:7,x:-47.45,z:21.40,y:4.388,target:[-39,1.4,14],label:'급식실 · 식당'}
  ]) { const F=floors.find(n=>n.f===p.f); cctv(p.x,p.y,p.z,0,{parent:F.interior,floor:p.f,mountY:p.y,target:p.target,label:p.label}); }
  cctv(-26.20,14.138,4.15,0,{parent:OUT,floor:3,mountY:14.138,outdoor:true,target:[0,13.7,5],label:'옥상 · 발전기/출입구'});
  for(const x of [-4.5,4.5]) cctv(x,3.388,GATE_Z-.79,0,{parent:OUT,floor:0,mountY:3.388,outdoor:true,target:[0,1.4,GATE_Z-5],label:'정문 · '+(x<0?'서쪽':'동쪽')});
  cctv(GUARD_LAYOUT.originX+3.21,2.30,GUARD_LAYOUT.cz,0,{parent:OUT,floor:0,mountY:2.30,wallMount:true,target:[GUARD_LAYOUT.npc.x,1.15,GUARD_LAYOUT.npc.z],label:'경비실 · 관제 데스크'});

  const modelAudit = { duplicatesRemoved:removeDuplicateModels(MODELS) };
  const bookMat = new THREE.MeshStandardMaterial({ map: T.makeBookSpine(), roughness: .8 });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const bakeStats = { merged: 0, meshes: 0 };
  floors.forEach(F => {
    if (F.books && F.books.length) {
      const im = new THREE.InstancedMesh(unitBox, bookMat, F.books.length);
      F.books.forEach((b, i) => { im.setMatrixAt(i, b.m); im.setColorAt(i, b.c); });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.castShadow = im.receiveShadow = true; F.interior.add(im);
    }
    if (!(typeof location !== 'undefined' && /[?&]nobake/.test(location.search)))   /* ?nobake: 배치 감사용 (메시를 합치지 않는다) */
    [F.interior, F.shell].forEach(g => { const r = bakeStatic(g); bakeStats.merged += r.merged; bakeStats.meshes += r.meshes; });
  });
  { const r = bakeStatic(OUT); bakeStats.merged += r.merged; bakeStats.meshes += r.meshes; }

  let lastT = 0;
  // gain: 발전기 출력(전압 강하 때 낮아짐) · warm: 비상 발전기 전원일 때 따뜻하고 누런 빛 · emerg: 비상등 밝기
  function update(t, blackout, gain = 1, warm = 0, emerg = 0) {
    const dt = Math.min(.1, Math.max(0, t - lastT)); lastT = t;
    for (const d of doorList) {
      if (d.open !== d.target) { const s = d.kind === 'slide' ? 2.2 : (d.slam ? 7 : 2.6); d.open = d.target > d.open ? Math.min(d.target, d.open + dt * s) : Math.max(d.target, d.open - dt * s); if (d.open === d.target) d.slam = false; }
      d.rect.off = d.open > .4;
      if (d.leaves) d.leaves.forEach(l => { l.piv.rotation.y = l.a * d.open * (d.dir || 1); });   // dir: 여는 쪽 (game.js doorDir — 방 안쪽)
      else if (d.kind === 'slide') d.panels.forEach(p => { p.m.position.x = p.x0 + (p.x1 - p.x0) * d.open; });
      else d.piv.rotation.y = d.open * d.angOpen * (d.dir || 1);
    }
    for (const p of props) {
      if (p.kind === 'safe') p.piv.rotation.y = -p.open * 1.7;
      if (p.kind === 'breaker') p.lev.rotation.z += ((p.on ? -.6 : -2.4) - p.lev.rotation.z) * Math.min(1, dt * 10);
      else if (p.kind === 'switch') { p.key.rotation.x += ((p.on ? -.35 : .35) - p.key.rotation.x) * Math.min(1, dt * 18); p.led.visible = !p.on; }
    }
    // 고장 난 형광등: 대부분 켜져 있다가 몇 초에 한 번 부드럽게 두세 번 어두워진다 (점멸 피로를 줄인 패턴)
    const cr = .87 + .13 * warm, cg = .92 - .02 * warm, cb = 1 - .22 * warm;
    flickerMats.forEach((m, i) => { const v = blackout ? 0 : flickVal(t, i) * gain; m.userData.v = v; m.color.setRGB(cr * v + .02, cg * v + .02, cb * v + .02); });
    matLampOn.color.setRGB(blackout ? .02 : cr * gain, blackout ? .02 : cg * gain, blackout ? .02 : cb * gain); if (winMats[9]) winMats[9].emissiveIntensity = blackout ? 0 : .55 * gain;
    spEm.opacity = emerg * .9; matEmHead.color.setRGB(.16 + emerg * .84, .16 + emerg * .76, .15 + emerg * .6); matEmLed.color.setHex(emerg > .1 ? 0xff4020 : 0x30ff60);
    for (const it of items) if (!it.taken && it.kind !== 'note') { it.mesh.position.y = it.pos.y - floors[it.floor].y0 + Math.sin(t * 2 + it.pos.x) * .03; it.mesh.rotation.y = t * 1.2; }
    lockGlow.material.opacity = .6 + .4 * Math.sin(t * 3);
  }

  function flickVal(t, i) {
    if (flickCfg.calm) return 1;
    const per = 7 + i * 2.3, ph = (t + i * 3.7) % per, len = .55 + i * .08;
    if (ph > len) return 1 - .04 * Math.sin(t * 2.1 + i);               // 거의 일정 (아주 약한 웅웅거림)
    const d = .5 + .5 * Math.cos(ph / len * Math.PI * 2 * (2 + (i % 2)));  // 두세 번 부드럽게 꺼질 듯 어두워짐
    return .38 + .62 * d;
  }
  const flickCfg = { calm: false };
  return { CCTV_CAMERAS, guardRoom, guardAnnex, INFIRMARY_SLOTS, campusDesign, modelAudit, POOL, CHAIRS, B_BOIL, LOCKER_BOXES, h133Mat, crMat, thMat, prMat, v2Mat, winMats, MODELS, floors, items, lockers, doors, gate, update, mats: { flickerMats, matLampOn, matLampDead }, flickCfg, sky: { stars, moon, moonGlow }, NOTES, TAPES, PHOTOS, doorList, props, boardRefs, OUT, bakeStats, makeBoardTex: makeClassroomBoard98 };
}

/* ---------- 충돌/시야 ---------- */
export function collide(cols, p, r) {
  for (let it = 0; it < 3; it++) for (const c of cols) {
    if (c.off) continue;
    const cx = Math.max(c.x1, Math.min(p.x, c.x2)), cz = Math.max(c.z1, Math.min(p.z, c.z2));
    const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-9) { const d = Math.sqrt(d2); p.x += dx / d * (r - d); p.z += dz / d * (r - d); }
      else {
        const l = p.x - c.x1, rt = c.x2 - p.x, t = p.z - c.z1, b = c.z2 - p.z, m = Math.min(l, rt, t, b);
        if (m === l) p.x = c.x1 - r; else if (m === rt) p.x = c.x2 + r; else if (m === t) p.z = c.z1 - r; else p.z = c.z2 + r;
      }
    }
  }
}
export function los(walls, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  for (const c of walls) {
    if (c.off) continue;
    let t0 = 0, t1 = 1;
    for (let k = 0; k < 2; k++) {
      const o = k ? az : ax, d = k ? dz : dx, lo = k ? c.z1 : c.x1, hi = k ? c.z2 : c.x2;
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { t0 = 2; break; } }
      else { let a = (lo - o) / d, b = (hi - o) / d; if (a > b) { const s = a; a = b; b = s; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) break; }
    }
    if (t0 <= t1) return false;
  }
  return true;
}
