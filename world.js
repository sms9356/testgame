// 폐교 월드 빌더 — 레퍼런스(배치도/정문/교실/소품 시트)를 기반으로 학교 전체를 절차적으로 생성한다.
import * as THREE from './vendor/three.module.js';
import * as T from './tex.js';
import { rnd, rr, pick } from './tex.js';
import { bakeStatic } from './bake.js';
import { NOTES } from './story.js';

export const FH = 4, CH = 3.6;
export const SLOTS = [-32, -24, -16, -8, 0, 8, 16, 24, 32];
// 층별 교실 배치 (레퍼런스 평면도 기준)
export const LAYOUT = [
  { types: ['toilet', 'nurse', 'counsel', 'office', 'stair', 'class', 'class', 'class', 'library'],
    names: ['화장실', '보건실', '상담실', '교무실', '중앙계단', '1-1', '1-2', '1-3', '도서실'] },
  { types: ['toilet', 'class', 'cooking', 'class', 'stair', 'class', 'class', 'computer', 'lab'],
    names: ['화장실', '2-1', '요리실', '2-3', '중앙계단', '2-4', '2-5', '컴퓨터실', '과학실'] },
  { types: ['toilet', 'broadcast', 'craft', 'class', 'stair', 'class', 'class', 'art', 'music'],
    names: ['화장실', '방송실', '공예실', '3-3', '중앙계단', '3-4', '3-5', '미술실', '음악실'] },
  null,
  { types: ['exit', 'boiler', 'electric', 'storage', 'stair', 'records', 'cleaning', 'generator', 'pump'],
    names: ['비상 계단실', '보일러실', '전기실', '시설 창고', '진입 계단실', '문서 보관실', '청소도구실', '기계실', '펌프실'] },
];
// 본관 남쪽 방 줄 (3D 프로토타입 room_manifest 기준: 복도 양쪽에 방이 있는 구조)
export const LAYOUT_S = [
  { types: ['class', 'class', 'principal', 'meeting', 'lobby', 'print', 'storeS', 'sick', 'toilet'], names: ['1-4', '1-5', '교장실', '회의실', '중앙현관', '인쇄실', '창고', '보건실 보조', '화장실'] },
  { types: ['class', 'toilet', 'staff', 'archive', 'hall', 'reading', 'av', 'counselS', 'storeS'], names: ['2-2', '화장실', '교사 휴게실', '기록 보관실', '2층 홀', '열람실', '시청각실', '상담실', '창고'] },
  { types: ['class', 'class', 'class', 'class', 'hall', 'class', 'student', 'counselS', 'storeS'], names: ['3-1', '3-2', '3-6', '3-7', '3층 홀', '3-8', '학생회실', '상담실', '보관실'] },
];
// 별관 남쪽 방 줄 (맵 통합 설계집: 별관 1~3F 복도 양쪽)
export const ANNEX_S = [
  { types: ['prepS', 'tool', 'lobbyA', 'wash', 'storeS'], names: ['실습 준비실', '공구실', '별관 현관', '세척실', '자재 창고'] },
  { types: ['prepS', 'digital', 'storeS', 'counselS', 'toilet'], names: ['과학 준비실', '디지털실습실', '교재 창고', '상담실', '화장실'] },
  { types: ['work', 'storeS', 'equip', 'gallery', 'toilet'], names: ['작업실', '보관실', '기자재실', '전시 공간', '화장실'] },
];
export const MAIN_ZS = 9.9;
// 본관 1층 계단실 북쪽 문 ↔ 별관 현관을 잇는 유리 연결 통로 (본관 북벽 z -9.9 ~ 별관 남벽 z -13.5)
export const WALKWAY = { x1: -1.6, x2: 3.6, z1: -13.5, z2: -9.9 };   // 본관 남쪽 외벽 바깥면 (남쪽 방: z 1.75 ~ 9.6)
export const ANNEX = { slots: [-16, -8, 0, 8, 16], floors: [
  { types: ['stair', 'cooking', 'tech', 'fusion', 'counsel'], names: ['계단', '요리실 (101)', '기술·가정실 (102)', '창의융합실 (103)', '진로상담실 (104)'] },
  { types: ['stair', 'computer', 'lang', 'smart', 'club'], names: ['계단', '컴퓨터실 (201)', '언어실 (202)', '스마트교실 (203)', '동아리실 (204)'] },
  { types: ['stair', 'music', 'art', 'craft', 'lab'], names: ['계단', '음악실 (301)', '미술실 (302)', '공예실 (303)', '과학실 (304)'] }] };
export const GATE_Z = 70;
export const KEY_NAMES = ['교무실', '도서실', '과학실', '체육관', '수영장'];
export const KEY_ROOMS = [{ f: 0, x: -8, z: -5.5 }, { f: 0, x: 32, z: -5.5 }, { f: 1, x: 32, z: -5.5 }, { f: 5, x: 29.5, z: 20.5 }, { f: 6, x: -35.8, z: 44 }];
export const AREA_NAMES = { 0: '1F', 1: '2F', 2: '3F', 3: 'RF', 4: 'B1', 5: '체육관', 6: '수영장', 7: '급식실', 8: '별관 1F', 9: '별관 2F', 10: '별관 3F' };
export const ROOF_Y = 12.4;


export function buildWorld(scene) {
  /* ---------- 재질 ---------- */
  // 단색 재질은 같은 설정끼리 공유한다 (배칭 효율 ↑)
  const _solid = new Map();
  const S = (map, o = {}) => {
    if (map) return new THREE.MeshStandardMaterial({ map, roughness: .92, metalness: 0, ...o });
    const k = JSON.stringify(o); if (!_solid.has(k)) _solid.set(k, new THREE.MeshStandardMaterial({ roughness: .92, metalness: 0, ...o })); return _solid.get(k);
  };
  // PBR 재질 (색 + 노멀 + 거칠기)
  const P = (t, o = {}) => new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, metalness: 0, ...o });
  const mWall = P(T.pbr('wall', () => T.pbrWall()));
  const mFloorTile = P(T.pbr('tile', () => T.pbrTile()));
  const mFloorWood = P(T.pbr('wood', () => T.pbrWood()));
  const mCeil = P(T.pbr('ceil', () => T.pbrCeiling()));
  const PB = (name, gen, o = {}) => { const t = T.pbr(name, gen); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: 1, metalness: 0, ...o }); };
  const mWood = PB('varnish', () => T.pbrVarnish(512));
  const mWoodDark = PB('varnishDark', () => T.pbrVarnish(512, [92, 58, 34]));
  const mMetal = PB('paint', () => T.pbrPaintMetal(512), { metalness: .35 });
  // 캔버스 금속 재질에 PBR 도장 금속의 노멀 · 거칠기를 덧씌워 평평한 단색 판이 실제 철판처럼 보이게 한다
  const _paint = T.pbr('paint', () => T.pbrPaintMetal(512));
  const grunge = m => { m.normalMap = _paint.normalMap; m.roughnessMap = _paint.roughnessMap; m.normalScale = new THREE.Vector2(.6, .6); return m; };
  const mRust = PB('rust', () => T.pbrPaintMetal(256, [120, 72, 44]), { metalness: .3 });
  mRust.color.setRGB(.62, .55, .5);
  const mLocker = grunge(S(T.makeMetal([120, 134, 138]), { roughness: .55, metalness: .4 }));
  const mLockerT = S(T.makeLocker(), { roughness: 1, metalness: .35 });
  { const lk = T.pbr('locker', () => T.pbrPaintMetal(256)); mLockerT.normalMap = lk.normalMap; mLockerT.roughnessMap = lk.roughnessMap; }
  const mStep = P(T.pbr('step', () => T.pbrConcrete(512)));
  const mBooks = S(T.makeBooks());
  const mCork = S(T.makeCork());
  const mFlag = S(T.makeFlag());
  const mDoor = S(T.makeDoor(), { side: THREE.DoubleSide });
  const mDoorP = PB('door', () => T.pbrDoor(512));
  const mWin = new THREE.MeshBasicMaterial({ map: T.makeWindow(), color: 0x9fb2c8, side: THREE.DoubleSide });
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
  // 범프 맵: 같은 텍스처의 명암으로 표면 요철을 만들어 평평한 박스가 실제 재질처럼 보이게 한다
  [[mFence, 2.4], [mDoor, 1.2], [mLocker, 1.2]]
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
  const floors = [];
  let cur = null;
  const items = [], lockers = [], flickerMats = [], doors = [];
  const mFacade = PB('facade', () => T.pbrFacade(512));
  const mBase = P(T.pbr('base', () => T.pbrConcrete(1024, [104, 110, 102])));
  let curWall = mWall;
  const matLampOn = new THREE.MeshBasicMaterial({ color: 0xdfeaff });
  const matLampDead = new THREE.MeshBasicMaterial({ color: 0x2b2b28 });
  for (let i = 0; i < 4; i++) flickerMats.push(new THREE.MeshBasicMaterial({ color: 0xdfeaff }));
  const lampHousing = S(null, { color: 0x555550, roughness: .7 });
  const mSwitchPlate = S(null, { color: 0xd8d4c8, roughness: .5 }), mSwitchKey = S(null, { color: 0xeeeae0, roughness: .4 });

  function col(x1, x2, z1, z2, wall = false) { const r = { x1, x2, z1, z2 }; cur.col.push(r); if (wall) cur.walls.push(r); }
  // 가구: y는 바닥 기준 하단
  function add(mat, w, h, d, x, y, z, o = {}) {
    const m = new THREE.Mesh(boxGeo(w, h, d, mat === mLockerT || !mat.map || mat.map.wrapS !== THREE.RepeatWrapping), mat); m.position.set(x, y + h / 2, z);
    if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    (o.parent || cur.interior).add(m);
    if (o.col) { const sw = (o.ry && Math.abs(Math.sin(o.ry)) > .7) ? d : w, sd = (o.ry && Math.abs(Math.sin(o.ry)) > .7) ? w : d; col(x - sw / 2, x + sw / 2, z - sd / 2, z + sd / 2); }
    return m;
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
  function wallSeg(x1, x2, z1, z2, y1, y2, shell = false) {
    if (shell) facade(x1, x2, z1, z2, y1, y2);
    const m = boxMesh(x1, x2, y1, y2, z1, z2, curWall);
    (shell ? cur.shell : cur.interior).add(m);
    if (y1 < 1) col(x1, x2, z1, z2, true);
  }
  function addNote(id, x, y, z, ry = 0) {
    if (!!cur.annex !== !!NOTES[id].annex) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.3, .22), mPaperN);
    m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, y + .01, z); m.userData.dynamic = true; cur.interior.add(m);
    items.push({ kind: 'note', id, floor: cur.f, pos: new THREE.Vector3(x, cur.y0 + y, z), mesh: m, title: NOTES[id].title, text: NOTES[id].text, taken: false, label: '쪽지 읽기' });
  }
  function addBattery(x, y, z) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .15, 12), S(null, { color: 0x3fae5a, emissive: 0x0a3010 }));
    b.rotation.z = Math.PI / 2; g.add(b);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .03, 8), mMetal); tip.rotation.z = Math.PI / 2; tip.position.x = .09; g.add(tip);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexG, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
    sp.scale.set(.7, .7, .7); g.add(sp);
    g.position.set(x, y + .1, z); g.userData.dynamic = true; cur.interior.add(g);
    items.push({ kind: 'battery', floor: cur.f, pos: new THREE.Vector3(x, cur.y0 + y + .1, z), mesh: g, taken: false, label: '건전지 줍기', baseY: y + .1 });
  }
  function addMedkit(x, y, z) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(.3, .18, .1), mWhite));
    const red = new THREE.MeshBasicMaterial({ color: 0xc02020 });
    g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(.16, .05, .11), red)));
    g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(.05, .14, .11), red)));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexR, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.set(.8, .8, .8); g.add(sp);
    g.position.set(x, y + .12, z); g.userData.dynamic = true; cur.interior.add(g);
    items.push({ kind: 'medkit', floor: cur.f, pos: new THREE.Vector3(x, cur.y0 + y + .12, z), mesh: g, taken: false, label: '응급 밴드 줍기', baseY: y + .12 });
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
    items.push({ kind: 'key', idx, floor: cur.f, pos: new THREE.Vector3(x, cur.y0 + y + .12, z), mesh: g, taken: false, label: `열쇠 조각 줍기 (${KEY_NAMES[idx]})`, baseY: y + .12 });
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
  function deskGrid(cx, offs, rows, miss = .15) {
    const tops = [], legs = [], seats = [], cl = [];
    for (const dx of offs) for (const z of rows) {
      if (rnd() < miss) continue;
      const x = cx + dx + rr(-.05, .05), ry = rr(-.06, .06);
      tops.push(MX(x, 0, z, ry)); legs.push(MX(x, 0, z, ry));
      col(x - .36, x + .36, z - .26, z + .26);
      const r = rnd();
      if (r < .1) { const m = MX(x + rr(-.1, .1), .2, z + .62, rr(-1, 1), Math.PI / 2); seats.push(m); cl.push(m); col(x - .45, x + .45, z + .3, z + .95); }   // 옆으로 쓰러진 의자
      else if (r < .85) { const m = MX(x + rr(-.08, .08), 0, z + .5 + rr(-.05, .2), rr(-.35, .35)); seats.push(m); cl.push(m); }
    }
    if (!tops.length) return;
    inst(cur.interior, deskTopG, mWood, tops); inst(cur.interior, deskLegG, mMetal, legs);
    if (seats.length) { inst(cur.interior, seatG, mWood, seats); inst(cur.interior, chairLegG, mMetal, cl); }
    for (const dx of offs) for (const z of rows) if (rnd() < .14) backpack(cx + dx + rr(.3, .45) * (dx < 0 ? -1 : 1), z + rr(.2, .5), rnd() * 6, rnd() < .4);
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
  function win3D(parent, w, h, x, y, z, ry = 0) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), mWin));
    const bars = [];
    for (let i = 0; i <= 3; i++) bars.push(bx(.06, h, .1, -w / 2 + i * w / 3, 0, 0));
    for (let j = 0; j <= 2; j++) bars.push(bx(w, .06, .1, 0, -h / 2 + j * h / 2, 0));
    bars.push(bx(w + .14, .05, .22, 0, -h / 2 - .05, .04));
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
  function fan(x, z) { const m = meshAt(fanG, mFrame, x, CH, z, rnd() * 6); if (rnd() < .3) m.rotation.z = rr(.08, .2); }
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
    meshAt(merge([bx(.62, .88, .46, 0, .44, 0), bx(.5, .02, .4, 0, .55, .02)]), mWood, x, 0, z);
    const top = meshAt(new THREE.BoxGeometry(.72, .04, .56), mWoodDark, x, 1.0, z + .02); top.rotation.x = .18;
    col(x - .36, x + .36, z - .28, z + .28);
  }
  // 칠판 프레임 + 분필/지우개
  function boardDetail(cx, zN) {
    meshAt(merge([bx(3.9, .06, .07, 0, 1.71, 0), bx(3.9, .06, .07, 0, .5, 0), bx(.06, 1.27, .07, -1.92, 1.1, 0), bx(.06, 1.27, .07, 1.92, 1.1, 0)]), mFrame, cx, 0, zN + .08);
    ['#eee', '#e8d060', '#d05050'].forEach((c, i) => { const ch = meshAt(new THREE.CylinderGeometry(.006, .006, .07, 6), S(null, { color: c }), cx - 1 + i * .12, .585, zN + .14); ch.rotation.z = Math.PI / 2; });
    meshAt(new THREE.BoxGeometry(.13, .035, .05), mFabric, cx + .9, .59, zN + .14);
    meshAt(new THREE.BoxGeometry(.34, .44, .16), mBlack, cx - 2.5, 2.75, zN + .09);   // 스피커
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
  function exitSign(x, y, z, ry = 0) { const m = meshAt(new THREE.BoxGeometry(.5, .2, .06), mBlack, x, y, z, ry); const p = new THREE.Mesh(new THREE.PlaneGeometry(.46, .17), mGreenSign); p.position.z = .031; m.add(p); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowGreen, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .5 })); sp.scale.set(.9, .5, 1); sp.position.z = .1; m.add(sp); }
  // 소화기
  const extG = merge([new THREE.CylinderGeometry(.075, .075, .45, 12).translate(0, .3, 0), new THREE.CylinderGeometry(.03, .04, .08, 8).translate(0, .56, 0), tube(.01, 0, .58, 0, .08, .5, .04)]);
  function extinguisher(x, z) { meshAt(extG, S(null, { color: 0xa01818, roughness: .4, metalness: .2 }), x, 0, z); }
  // 천장 손상: 빠진 타일 구멍, 떨어진 타일, 늘어진 전선
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  function ceilingDamage(x1, x2, z1, z2, n) {
    for (let i = 0; i < n; i++) {
      const x = rr(x1, x2), z = rr(z1, z2);
      const h = new THREE.Mesh(new THREE.PlaneGeometry(.58, .58), holeMat); h.rotation.x = Math.PI / 2; h.position.set(x, CH - .012, z); cur.interior.add(h);
      if (rnd() < .5) { const t = meshAt(new THREE.BoxGeometry(.58, .02, .58), mCeil, x + rr(-.4, .4), .02, z + rr(-.3, .3), rnd() * 3); t.rotation.z = rr(-.12, .12); }
      else { const t = meshAt(new THREE.BoxGeometry(.58, .015, .58), mCeil, x, CH - .32, z + .2); t.rotation.x = rr(.7, 1.1); }
      if (rnd() < .5) meshAt(tube(.008, 0, 0, 0, rr(-.1, .1), -rr(.5, 1.2), rr(-.1, .1)), mBlack, x + .2, CH, z);
    }
  }
  const pipeMat = S(T.makeMetal([96, 104, 98]), { roughness: .6, metalness: .4 });
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
    const p = [tube(.06, x1, CH - .16, 1.25, x2, CH - .16, 1.25), tube(.035, x1, CH - .12, 1.05, x2, CH - .12, 1.05)];
    for (let x = x1 + 2; x < x2; x += 4) p.push(bx(.04, .16, .3, x, CH - .08, 1.15));
    cur.interior.add(new THREE.Mesh(merge(p), pipeMat));
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
    tape1: { title: '녹음 테이프 — 보건 교사', spk: '보건 교사', fx: 'radio' },
    tape2: { title: '녹음 테이프 — 민아', spk: '민아', fx: 'radio' },
    tape3: { title: '녹음 테이프 — 교무부장', spk: '교무부장', fx: 'radio' },
    tape4: { title: '녹음 테이프 — 하교 방송 연습', spk: '윤하늘', fx: 'radio' },
    tape5: { title: '녹음 테이프 — 교무부장의 마지막 녹음', spk: '교무부장', fx: 'radio' },
  };
  const mTape = S(null, { color: 0x2a2a2c, roughness: .5, metalness: .3 });
  function tapeRecorder(id, x, y, z, ry = 0) {
    const g = dyn(new THREE.Group()); g.position.set(x, y, z); g.rotation.y = ry; cur.interior.add(g);
    g.add(new THREE.Mesh(merge([bx(.26, .07, .15, 0, .035, 0), bx(.04, .015, .02, .09, .075, .05), bx(.04, .015, .02, .045, .075, .05)]), mTape));
    const win = new THREE.Mesh(new THREE.BoxGeometry(.11, .005, .07), new THREE.MeshStandardMaterial({ color: 0x6a5a40, roughness: .3 })); win.position.set(-.05, .072, -.01); g.add(win);
    const led = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowRed, blending: THREE.AdditiveBlending, depthWrite: false })); led.scale.setScalar(.12); led.position.set(.11, .08, .07); g.add(led);
    props.push({ kind: 'tape', id, floor: cur.f, x, z, y, label: '녹음기 재생', ...TAPES[id] });
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
  function cctv(x, y, z, ry) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; cur.interior.add(g);
    const m = new THREE.Mesh(camG, mWhite); m.rotation.x = .35; g.add(m);
    const led = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowRed, blending: THREE.AdditiveBlending, depthWrite: false })); led.scale.setScalar(.18); led.position.set(.05, -.18, .2); g.add(led);
  }
  // 가방 · 농구공 · 식판 · 대걸레 · 양동이
  const mBag = [S(null, { color: 0x2a3a5a, roughness: .9 }), S(null, { color: 0x5a2a2a, roughness: .9 }), S(null, { color: 0x2a4a3a, roughness: .9 }), S(null, { color: 0x3a3a3a, roughness: .9 })];
  const bagG = merge([new THREE.SphereGeometry(.18, 12, 10).scale(.9, 1.15, .55).translate(0, .2, 0), new THREE.SphereGeometry(.1, 10, 8).scale(1.1, .8, .5).translate(0, .14, .1), tube(.012, -.08, .38, -.06, -.08, .05, -.1), tube(.012, .08, .38, -.06, .08, .05, -.1)]);
  function backpack(x, z, ry, tip) { const m = meshAt(bagG, pick(mBag), x, 0, z, ry); if (tip) { m.rotation.x = -1.4; m.position.y = .08; } }
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
    const open = rnd() < .8, rect = { x1: cx - 1, x2: cx + 1, z1: -1.75, z2: zW + .03, off: open };
    const panels = [-1, 1].map(s => {
      const g = dyn(new THREE.Group()); g.position.set(0, 0, zW); cur.interior.add(g);
      g.add(new THREE.Mesh(panelG, mDoorP)); const h = new THREE.Mesh(handleG, mChrome); h.position.set(-s * .42, 1.0, .03); g.add(h);
      return { m: g, x0: cx + s * .5, x1: cx + s * 1.48 };
    });
    const d = { kind: 'slide', floor: cur.f, x: cx, z: -1.5, open: open ? 1 : 0, target: open ? 1 : 0, panels, rect, name: '문' };
    panels.forEach(p => { p.m.position.x = p.x0 + (p.x1 - p.x0) * d.open; });
    cur.col.push(rect); (cur.doorWalls ||= []).push(rect); doorList.push(d);
    return d;
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
  const boardTexts = [['다시, 여기서.'], ['다 시  시 작'], ['모두 어디 갔니'], ['돌아와'], ['출석 확인', '1번  2번  3번 ...'], ['아직 수업 중']];
  function frontWall(cx, zN, withBoard = true, lines) {
    if (withBoard) {
      add(mWoodDark, 3.95, 1.4, .06, cx, .5, zN + .03);
      const bm = new THREE.MeshStandardMaterial({ map: T.makeBoard(lines || pick(boardTexts)), roughness: .85 });
      plane(cur.interior, bm, 3.7, 1.16, cx, 1.1, zN + .07);
      plane(cur.interior, mFlag, .95, .63, cx, 2.55, zN + .04);
      // 분필받침
      add(mWoodDark, 3.7, .04, .1, cx, .55, zN + .12);
      boardDetail(cx, zN);
      frontWall.last = bm;
    }
    [-3.05, 3.05].forEach(dx => {
      win3D(cur.interior, 1.3, 1.45, cx + dx, 1.75, zN + .02);
      radiator(cx + dx, zN + .14, 0, 1.15);
      curtain(cx + dx - .78, 1.75, zN + .12, .4, 1.9); if (rnd() < .6) curtain(cx + dx + .78, 1.65, zN + .12, .38, 1.7);
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
  function classroom(cx, name) {
    const zN = -9.6;
    frontWall(cx, zN, true, name === '3-3' ? ['자습'] : undefined);
    boardRefs['cls' + cur.f + ':' + cx + (curSouth ? 's' : '')] = { mat: frontWall.last, floor: cur.f, cx, name };
    if (name === '3-3') boardRefs.b33 = { mat: frontWall.last, floor: cur.f, cx };
    teacherDesk(cx + 2.6, zN + 1.0);
    monitor(cx + 2.35, .78, zN + .82, -.2, { crt: true, cracked: rnd() < .3 });
    lectern(cx - 1.2, zN + 1.05);
    fan(cx, -7.3); fan(cx, -3.9);
    // 빔프로젝터(천장) + 말아 올린 스크린 + 스피커
    { const pj = meshAt(merge([bx(.36, .12, .3, 0, 0, 0), new THREE.CylinderGeometry(.045, .045, .04, 12).rotateX(Math.PI / 2).translate(0, 0, -.17), bx(.04, .3, .04, 0, .2, 0), bx(.25, .02, .25, 0, .35, 0)]), mProj, cx, CH - .45, -6.3); pj.rotation.y = Math.PI;
      meshAt(new THREE.CylinderGeometry(.06, .06, 3.3, 12).rotateZ(Math.PI / 2), mScreenR, cx, CH - .25, zN + .18);
      if (rnd() < .4) { const sc = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.0), mScreenR); sc.position.set(cx + .8, CH - .8, zN + .2); sc.rotation.z = .08; cur.interior.add(sc); } }
    // 시계 · CCTV · 소화기 · 분리수거함 · 냉난방기 · 창가 화분
    { const ck = new THREE.Mesh(new THREE.CircleGeometry(.22, 24), mClockM); ck.position.set(cx, 2.7, -1.76); ck.rotation.y = Math.PI; cur.interior.add(ck); }
    cctv(cx - 3.75, CH - .1, -2.0, Math.PI * .25 + Math.PI);
    extinguisher(cx + 1.65, -2.05);
    [0, 1, 2].forEach(k => add(mRecy[k], .36, .62, .36, cx + 2.6 + k * .4, 0, -2.0, { col: k === 1 }));
    add(S(null, { color: 0xe8e6de, roughness: .5 }), .45, 1.75, .38, cx + 3.55, 0, zN + .25, { col: true }); add(mBlack, .3, .25, .02, cx + 3.55, 1.25, zN + .45);
    [-3.05, 3.05].forEach(dx => potPlant(cx + dx + rr(-.4, .4), .92, zN + .22));
    if (rnd() < .5) graffiti(pick(['다시, 여기서', '돌아와', '보고 있어']), cx - 2.4, 1.7, -1.765, Math.PI, 1.8);
    // 게시판 (동쪽 벽) + 붙은 안내문
    plane(cur.interior, mCork, 2.0, 1.1, cx + 3.84, 1.6, -5.2, -Math.PI / 2);
    for (let k = 0; k < 5; k++) { const pp = new THREE.Mesh(new THREE.PlaneGeometry(.26, .34), mPaperN); pp.position.set(cx + 3.82, 1.4 + (k % 2) * .4 + rr(-.05, .05), -5.9 + k * .32); pp.rotation.set(0, -Math.PI / 2, rr(-.15, .15)); cur.interior.add(pp); }
    // 뒤쪽: 청소도구함(왼쪽 구석) + 개인 사물함 + 책장
    add(mPanelG, .55, 1.8, .45, cx - 3.5, 0, -2.05, { col: true });
    for (let k = 0; k < 4; k++) add(mLockerT, .48, 1.4, .45, cx - 2.9 + k * .5, 0, -2.0, { ry: Math.PI });
    col(cx - 3.2, cx - 1.1, -2.25, -1.75);
    shelf3D(cx - 3.62, -3.8, Math.PI / 2, 1.2, 1.2, .35, 3, .7); col(cx - 3.85, cx - 3.4, -4.4, -3.2);
    // 학생 책상 25세트 (5 × 5)
    deskGrid(cx, [-2.8, -1.4, 0, 1.4, 2.8], [-7.45, -6.45, -5.45, -4.45, -3.45], .12);
    // CSV 소모품: 노트 · 필통 · 물병/종이컵 · 쓰레기/파손물 + 분필 · 지우개는 칠판 아래
    const d = CLS[name];
    if (d && d.c.length) {
      const [nb, pc, wb, tr] = d.c.map(([X, Y]) => csvXZ(cx, X, Y));
      add(S(null, { color: pick([0x2a4a7a, 0x7a2a2a, 0x2a5a3a]), roughness: .8 }), .21, .025, .29, nb[0], .74, nb[1], { ry: rr(-.5, .5) }); add(mPaperN, .2, .01, .28, nb[0] + .05, .765, nb[1], { ry: rr(-.5, .5) });
      add(S(null, { color: pick([0x3a3a6a, 0xa86a8a, 0x2a2a2a]), roughness: .7 }), .2, .05, .07, pc[0], .74, pc[1], { ry: rr(-1, 1) }); for (let k = 0; k < 3; k++) add(S(null, { color: 0xd8b030 }), .14, .008, .008, pc[0] + rr(-.1, .1), .745, pc[1] + .08, { ry: rr(-1, 1) });
      cyl(S(null, { color: 0x9ac0d8, roughness: .2, transparent: true, opacity: .7 }), .035, .2, wb[0], .74, wb[1], 10); cyl(S(null, { color: 0xeeeeea, roughness: .6 }), .035, .09, wb[0] + .12, .74, wb[1] + .05, 10);
      for (let k = 0; k < 4; k++) { const pp = new THREE.Mesh(new THREE.PlaneGeometry(.2, .15), mDirtPaper); pp.rotation.set(-Math.PI / 2, 0, rnd() * 6); pp.position.set(tr[0] + rr(-.4, .4), .016, tr[1] + rr(-.4, .4)); cur.interior.add(pp); }
      add(mWood, .4, .02, .38, tr[0], .02, tr[1], { ry: rr(0, 3), rz: .08 });
      classClue(cx, name);
    }
    papers(cx, -8, -2.4, 9);
  }
  function office(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    // 서류 책장
    for (let k = 0; k < 3; k++) shelf3D(cx + (k - 1) * 1.3, zN + .25, 0, 1.1, 2.0, .4, 5, .7);
    plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeCalendar(), roughness: .9 }), .5, .62, cx + 2.75, 1.75, zN + .03);
    const rowsZ = [-7.4, -5.5, -3.8];
    [-2.6, 2.6].forEach(dx => rowsZ.forEach((z, r) => {
      meshAt(merge([bx(1.4, .04, .7, 0, .74, 0), bx(.42, .72, .66, -.47, .36, 0), bx(.03, .72, .66, .68, .36, 0), bx(1.3, .4, .02, 0, .5, -.33)]), mWoodDark, cx + dx, 0, z); col(cx + dx - .7, cx + dx + .7, z - .35, z + .35);
      monitor(cx + dx + .15, .76, z - .14, 0, { crt: true, cracked: rnd() < .2 });
      keyboard(cx + dx + .15, .76, z + .16, rr(-.1, .1));
      if (rnd() < .6) add(mWhite, .3, .06, .22, cx + dx - .45, .76, z + .05, { ry: rr(-.5, .5) });
      deskClutter(cx + dx + .55, .76, z + .1);
      officeChair(cx + dx + rr(-.1, .1), z + .75, Math.PI + rr(-.5, .5), rnd() < .1);
    }));
    fileCabinet(cx + 3.6, -8.8, -Math.PI / 2); fileCabinet(cx + 3.6, -8.25, -Math.PI / 2, true);
    plane(cur.interior, mPlanMap, 2.0, 1.14, cx + 3.84, 1.6, -5.5, -Math.PI / 2);
    // 금고 (비밀번호: 그날의 날짜 MMDD)
    { const sx = cx - 3.5, sz = -8.6;
      meshAt(merge([bx(.08, .8, .66, -.27, .4, 0), bx(.62, .8, .04, 0, .4, -.31), bx(.62, .8, .04, 0, .4, .31), bx(.62, .04, .66, 0, .02, 0), bx(.62, .04, .66, 0, .78, 0), bx(.5, .02, .55, 0, .36, 0)]), S(T.makeMetal([60, 74, 64]), { roughness: .5, metalness: .5 }), sx, 0, sz);
      const piv = dyn(new THREE.Group()); piv.position.set(sx + .31, 0, sz - .31); cur.interior.add(piv);
      const door = new THREE.Mesh(new THREE.BoxGeometry(.05, .76, .62), S(T.makeMetal([70, 86, 74]), { roughness: .45, metalness: .55 })); door.position.set(0, .4, .31); piv.add(door);
      const kp = new THREE.Mesh(new THREE.PlaneGeometry(.12, .18), new THREE.MeshBasicMaterial({ map: T.makeKeypad() })); kp.position.set(.03, .5, .45); kp.rotation.y = Math.PI / 2; piv.add(kp);
      const hd = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .03, 12), mChrome); hd.rotation.z = Math.PI / 2; hd.position.set(.04, .4, .2); piv.add(hd);
      col(sx - .32, sx + .35, sz - .34, sz + .34);
      addKey('office', 0, sx, .38, sz); const key = items[items.length - 1]; key.locked = true; key.mesh.visible = false;
      props.push({ kind: 'safe', floor: cur.f, x: sx + .9, z: sz, piv, key, open: 0, label: '금고 조사하기' }); }
    addNote('n3', cx - 2.5, .76, -5.4);
    papers(cx, -8, -2.4, 14);
  }
  function nurse(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    [-2.4, 2.4].forEach(dx => { add(mMetal, 1.0, .5, 2.0, cx + dx, 0, zN + 1.2, { col: true }); add(mWhite, .95, .14, 1.9, cx + dx, .5, zN + 1.2); add(mWhite, .5, .1, .35, cx + dx, .64, zN + .4); });
    add(mLockerT, .9, 1.7, .4, cx + 3.6, 0, -6.5, { ry: Math.PI / 2, col: true }); add(mGlass, .9, 1.7, .44, cx + 3.6, 0, -6.5, { ry: Math.PI / 2 });
    add(mWood, 1.2, .75, .6, cx - 3.2, 0, -5.4, { col: true, ry: Math.PI / 2 });
    addNote('n2', cx - 3.2, .75, -5.4);
    tapeRecorder('tape1', cx - 3.2, .75, -4.95, .4);
    blood('splat', cx + 2.4, .02, -6.0, 1.2, 0, true);
    addBattery(cx + 2.4, .5, -8.4); addMedkit(cx + 2.4, .66, -7.6);
    papers(cx, -8, -2.4, 7);
  }
  function counsel(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    add(mFabric, 2.0, .45, .8, cx, 0, -8.8, { col: true }); add(mFabric, 2.0, .5, .2, cx, .45, -9.1);
    add(mWood, 1.0, .4, .6, cx, 0, -7.4, { col: true });
    add(mFabric, .8, .45, .8, cx - 2.4, 0, -6.4, { ry: Math.PI / 2, col: true });
    shelf3D(cx + 3.55, -6.0, -Math.PI / 2, 1.4, 2.0, .45, 5, .75);
    addBattery(cx + 0.2, .4, -7.4);
    papers(cx, -8, -2.4, 5);
  }
  function library(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    [-2.9, 2.9].forEach(dx => [-8.2, -6.0, -3.8].forEach(z => {
      shelf3D(cx + dx, z, dx < 0 ? Math.PI / 2 : -Math.PI / 2, 2.0, 2.1, .5, 6, .9);
    }));
    // 독서 테이블 + 열쇠
    add(mWood, 2.4, .75, .9, cx, 0, -8.6, { col: true });
    [-.8, .8].forEach(dx => add(mWoodDark, .4, .45, .4, cx + dx, 0, -7.7));
    addKey('library', 1, cx + .6, .75, -8.6);
    addNote('n4', cx - .6, .75, -8.6);
    papers(cx, -8, -2.4, 10);
    // 쓰러진 책장
    { const g = shelf3D(cx + 1.6, -3.55, 0, 1.6, .5, .45, 1, 0); g.rotation.set(-Math.PI / 2 + .12, .35, 0); g.position.y = .25; } col(cx + .8, cx + 2.4, -4.0, -3.2);
    scatterBooks(cx + 1.4, -3.0, 18);
  }
  function lab(cx) {
    const zN = -9.6;
    frontWall(cx, zN, true, ['불을 끄지 마']);
    [-2.4, 2.4].forEach(dx => [-7.4, -4.8].forEach(z => {
      add(mBlack, 1.0, .06, 2.0, cx + dx, .86, z); add(mMetal, .9, .86, 1.9, cx + dx, 0, z, { col: true });
      [-.5, .5].forEach(dz => stool(cx + dx + (dx < 0 ? .85 : -.85), z + dz, rnd() < .1));
      add(mChrome, .03, .3, .03, cx + dx, .92, z - .8); add(mChrome, .14, .03, .03, cx + dx + .06, 1.2, z - .8);
    }));
    // 플라스크
    [[-2.4, -7.6], [-2.2, -7.1], [2.4, -4.6]].forEach(([dx, z]) => { const f = new THREE.Mesh(new THREE.CylinderGeometry(.06, .1, .22, 10), mLiquid); f.position.set(cx + dx, .98, z); cur.interior.add(f); });
    // 해골 모형
    const sk = new THREE.Group();
    const bone = (geo, y) => { const m = new THREE.Mesh(geo, mWhite); m.position.y = y; sk.add(m); };
    bone(new THREE.SphereGeometry(.12, 10, 8), 1.6); bone(new THREE.CylinderGeometry(.015, .015, 1.0, 6), 1.05);
    for (let k = 0; k < 5; k++) bone(new THREE.BoxGeometry(.3 - k * .02, .02, .1), 1.4 - k * .1);
    sk.position.set(cx + 3.4, 0, -9.0); cur.interior.add(sk); col(cx + 3.1, cx + 3.7, -9.3, -8.7);
    add(mMetal, .5, .5, .5, cx + 3.4, 0, -4.2, { col: true });
    if (!cur.annex) addKey('lab', 2, cx - 2.4, .92, -4.8);
    addNote('n5', cx + 2.4, .92, -7.4);
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
        const tip = rnd() < .12;
        officeChair(x + rr(-.1, .1), z + .72 + rr(0, .25), Math.PI + rr(-.6, .6), tip);
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
    if (!cur.annex) classClue(cx, 'C-01');
    papers(cx, -8, -2.4, 6);
  }
  function music(cx) {
    const zN = -9.6;
    frontWall(cx, zN, true, ['도 레 미 파']);
    // 그랜드 피아노
    grandPiano(cx + 2.2, -8.2);
    boardRefs['piano' + cur.f] = { floor: cur.f, x: cx + 2.2, z: -8.2 };
    addBattery(cx + 2.2, .98, -7.4);
    deskChair(cx - 2.4, -7.75, .4); addNote('n6', cx - 2.4, .46, -7.75);
    // 보면대/의자
    [-2.8, -1.4, 0].forEach((dx, k) => {
      const x = cx - 1.2 + dx, z = -5.4 + k * .2;
      meshAt(merge([tube(.01, 0, 0, 0, 0, 1.0, 0), tube(.008, 0, .02, 0, .2, 0, .12), tube(.008, 0, .02, 0, -.2, 0, .12), tube(.008, 0, .02, 0, 0, 0, -.22)]), mFrame, x, 0, z);
      const st = meshAt(new THREE.BoxGeometry(.42, .3, .01), mFrame, x, 1.1, z + .02); st.rotation.x = -.3;
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(.38, .26), mDirtPaper); sh.position.z = .007; st.add(sh);
      deskChair(x, z + .8);
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
    if (!cur.annex) classClue(cx, 'M-01');
  }
  function art(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    // 정물대(석고상 + 천) 를 둘러싼 이젤 반원
    meshAt(merge([bx(.9, .7, .9, 0, .35, 0)]), mWhite, cx, 0, -7.6); col(cx - .45, cx + .45, -8.05, -7.15);
    cyl(mWhite, .12, .32, cx - .15, .7, -7.6); meshAt(new THREE.SphereGeometry(.13, 12, 10), mPorc, cx - .15, 1.15, -7.6);
    meshAt(new THREE.SphereGeometry(.09, 10, 8), S(null, { color: 0xa82a20, roughness: .5 }), cx + .2, .79, -7.45);
    curtain(cx, .5, -7.12, .9, .4);
    [[-2.6, -6.2], [-1.4, -5.1], [0, -4.7], [1.4, -5.1], [2.6, -6.2]].forEach(([dx, z], k) => {
      easel(cx + dx, z, Math.atan2(-dx, -(-7.6 - z)) + Math.PI, k === 2 ? 2 : k);
      stool(cx + dx * 1.12, z + .62 * (z > -5.5 ? 1 : .6), rnd() < .15);
    });
    // 벽 쪽 작업대 + 물감통 + 마르는 그림 선반
    add(mWood, .7, .8, 2.6, cx - 3.55, 0, -8.2, { col: true });
    for (let k = 0; k < 6; k++) cyl(S(null, { color: pick([0xb03030, 0x3050a0, 0xd0c040, 0x2a8a4a, 0xeeeeee]), roughness: .5 }), .05, .1, cx - 3.6 + rr(-.2, .2), .8, -9.2 + k * .38, 10);
    add(mWoodDark, .5, 1.6, .9, cx + 3.6, 0, -3.2, { col: true });
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.PlaneGeometry(.55, .45), mPaints[(k + 1) % 4]); c.position.set(cx + 3.33, .6 + k * .45, -3.2); c.rotation.y = -Math.PI / 2; cur.interior.add(c); }
    // 석고 흉상 받침대
    add(mWhite, .4, 1.0, .4, cx + 3.2, 0, -8.9, { col: true }); meshAt(merge([new THREE.SphereGeometry(.13, 12, 10).translate(0, 1.32, 0), new THREE.CylinderGeometry(.08, .16, .2, 12).translate(0, 1.1, 0)]), mPorc, cx + 3.2, 0, -8.9);
    // 벽에 걸린 학생 작품
    [-2.4, -1.2, 1.2, 2.4].forEach((dx, k) => { const c = new THREE.Mesh(new THREE.PlaneGeometry(.5, .62), mPaints[(k + 2) % 4]); c.position.set(cx + dx, 2.4, zN + .03); c.rotation.z = rr(-.06, .06); cur.interior.add(c); });
    addBattery(cx - 3.55, .8, -7.4);
    papers(cx, -8, -2.4, 12);
    if (!cur.annex) classClue(cx, 'A-01');
  }
  function toilet(cx) {
    const zN = -9.6;
    for (let i = 0; i < 5; i++) add(mMetal, .05, 1.9, 2.0, cx - 3.4 + i * 1.1, 0, zN + 1.0, { col: true, parent: cur.interior });
    for (let i = 0; i < 4; i++) {
      const dx = cx - 2.85 + i * 1.1;
      const d = hingeDoor(dx - .5, zN + 2.0, 1.0, 1.65, .25, 1.35, i !== 2, mMetal, '칸막이 문'); d.stall = true;
      toiletAt(dx, zN + .5);
    }
    [-3.1, -2.4, -1.7].forEach(x => { meshAt(urinalG, mPorc, cx + x, 0, -1.8, Math.PI); });
    col(cx - 3.4, cx - 1.4, -2.05, -1.75);
    mopBucket(cx + 2.6, -8.9);
    if (cur.f === 1) blood('hand', cx + 3.83, 1.3, -6.6, .9, -Math.PI / 2);
    // 세면대 & 거울
    [-5.4, -4.2, -3.0].forEach(z => { meshAt(merge([bx(.5, .16, .6, 0, .88, 0), bx(.18, .8, .18, .1, .4, 0)]), mPorc, cx + 3.55, 0, z); meshAt(merge([tube(.012, .2, .96, 0, .2, 1.08, 0), tube(.012, .2, 1.08, 0, .05, 1.08, 0)]), mChrome, cx + 3.55, 0, z); plane(cur.interior, mGlass, .8, .9, cx + 3.83, 1.6, z, -Math.PI / 2); });
    col(cx + 3.25, cx + 3.85, -6.0, -2.6);
    papers(cx, -8, -3, 8);
  }
  // 계단실 천장: 2번 계단 위로 뚫린 개구부 + 어두운 계단 통로
  function ceilHole(P, X0, X1, Z0, Z1, cx) {
    const hx1 = cx - 2.55, hx2 = cx - 1.2, hz1 = -7.9, hz2 = -2.9;
    flat(P, mCeil, X0, hx1, Z0, Z1, CH, 4, false); flat(P, mCeil, hx2, X1, Z0, Z1, CH, 4, false);
    flat(P, mCeil, hx1, hx2, Z0, hz1, CH, 4, false); flat(P, mCeil, hx1, hx2, hz2, Z1, CH, 4, false);
    const sh = new THREE.Mesh(new THREE.BoxGeometry(hx2 - hx1, 1.6, hz2 - hz1), new THREE.MeshBasicMaterial({ color: 0x030303, side: THREE.BackSide }));
    sh.position.set((hx1 + hx2) / 2, CH + .8, (hz1 + hz2) / 2); P.add(sh);
  }
  // 방마다 고유 오브젝트 (출입문 쪽 벽, 방 안을 향함) — 조사하면 선택 화면이 열리고 효과가 있다 (game.js ROBJ)
  const ROBJ_OF = { nurse: 'med', sick: 'med', office: 'phone', staff: 'phone', principal: 'phone', meeting: 'phone', toilet: 'mirror', library: 'cards', reading: 'cards', archive: 'cards', records: 'cards',
    computer: 'term', digital: 'term', av: 'term', lab: 'chem', prepS: 'chem', cooking: 'snack', counsel: 'emo', counselS: 'emo', print: 'copier', wash: 'water', student: 'ballot', tool: 'radio', equip: 'radio' };
  const ROBJ_LABEL = { med: '약품함 열기', phone: '수화기 들기', mirror: '거울 보기', cards: '대출 카드함 뒤지기', term: '단말기 켜기', chem: '약품 선반 살피기', snack: '간식 바구니 뒤지기', emo: '감정 카드 고르기', copier: '복사 카운터 누르기', water: '수도꼭지 틀기', ballot: '투표함 열기', radio: '무전기 켜기' };
  const mRedCross = new THREE.MeshBasicMaterial({ color: 0xb02020 }), mTermScr = new THREE.MeshBasicMaterial({ color: 0x38c070 }), mBeige = S(null, { color: 0xc8bc9c, roughness: .6 });
  function roomObj(t, cx) {
    const k = ROBJ_OF[t]; if (!k) return;
    const x = cx - 2.7, z = -1.8, g = new THREE.Group(); g.position.set(x, 1.35, z); g.rotation.y = Math.PI; cur.interior.add(g);
    const B = (m, w, h, d, px = 0, py = 0, pz = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(px, py, pz); g.add(o); return o; };
    if (k === 'med') { B(mWhite, .5, .62, .16, 0, 0, .08); B(mRedCross, .2, .06, .01, 0, .05, .165); B(mRedCross, .06, .2, .01, 0, .05, .165); B(mChrome, .03, .1, .02, .2, -.1, .17); }
    else if (k === 'phone') { B(mBeige, .2, .3, .08, 0, 0, .04); B(mBeige, .07, .26, .07, -.13, .0, .09); for (let i = 0; i < 9; i++) B(mBlack, .03, .03, .01, -.03 + (i % 3) * .05, .06 - ((i / 3) | 0) * .05, .085); }
    else if (k === 'mirror') { B(mChrome, .56, .76, .03, 0, .15, .015); const m = new THREE.Mesh(new THREE.PlaneGeometry(.5, .7), new THREE.MeshStandardMaterial({ color: 0x8a969a, roughness: .05, metalness: .95 })); m.position.set(0, .15, .032); g.add(m); }
    else if (k === 'cards') { B(mWood, .6, .4, .3, 0, -.15, .15); for (let i = 0; i < 6; i++) { B(mWoodDark, .17, .1, .01, -.19 + (i % 3) * .19, -.06 - ((i / 3) | 0) * .16, .305); B(mChrome, .05, .015, .02, -.19 + (i % 3) * .19, -.08 - ((i / 3) | 0) * .16, .31); } }
    else if (k === 'term') { B(mDarkMetal, .42, .32, .1, 0, 0, .05); const sc = new THREE.Mesh(new THREE.PlaneGeometry(.34, .22), mTermScr); sc.position.set(0, .02, .102); g.add(sc); }
    else if (k === 'chem') { B(mWood, .7, .03, .2, 0, -.1, .1); [[0x3060d0, -.2], [0xd0c030, 0], [0xb02020, .2]].forEach(([c, dx]) => { const f = new THREE.Mesh(new THREE.CylinderGeometry(.035, .06, .18, 10), new THREE.MeshStandardMaterial({ color: c, roughness: .1, transparent: true, opacity: .8, emissive: c, emissiveIntensity: .15 })); f.position.set(dx, .0, .1); g.add(f); }); }
    else if (k === 'snack') { B(mWood, .6, .03, .25, 0, -.12, .12); B(mCardboard, .4, .14, .2, 0, -.03, .12); [0xd04030, 0x3080c0, 0xe0b030].forEach((c, i) => B(S(null, { color: c, roughness: .5 }), .08, .1, .04, -.12 + i * .12, .07, .12)); }
    else if (k === 'emo') { B(mCork, .6, .45, .02, 0, 0, .01); [0xe0d070, 0x80b0e0, 0xe09090, 0xa0d0a0].forEach((c, i) => B(S(null, { color: c, roughness: .8 }), .12, .16, .005, -.2 + i * .13, (i % 2) * .06 - .02, .025)); }
    else if (k === 'copier') { B(mBeige, .3, .3, .12, 0, 0, .06); B(mBlack, .2, .06, .01, 0, .07, .125); B(mRedCross, .04, .04, .01, .08, -.07, .125); }
    else if (k === 'water') { B(mPorc, .5, .14, .3, 0, -.45, .15); B(mChrome, .03, .03, .14, 0, -.25, .07); B(mChrome, .1, .03, .03, 0, -.2, .02); }
    else if (k === 'ballot') { B(mWood, .5, .03, .25, 0, -.18, .12); B(S(null, { color: 0xd8d2c4, roughness: .3, transparent: true, opacity: .55 }), .36, .3, .22, 0, -.01, .12); B(mBlack, .14, .01, .02, 0, .145, .12); }
    else if (k === 'radio') { B(mDarkMetal, .14, .26, .07, 0, 0, .04); B(mBlack, .015, .2, .015, .04, .22, .04); B(mTermScr, .08, .04, .005, 0, .06, .078); }
    props.push({ kind: 'robj', k, t, floor: cur.f, x, z, y: 1.35, cx, label: ROBJ_LABEL[k] });
  }
  // 엘리베이터 (계단실 동쪽 벽): 철문 · 층 표시 · 호출 버튼 — 타면 층 선택 화면
  const EL_LABEL = { 4: 'B1', 0: '1F', 1: '2F', 2: '3F', 8: '1F', 9: '2F', 10: '3F' };
  function elevator(cx) {
    const x = cx + 3.84, z = -7.0, g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -Math.PI / 2; cur.interior.add(g);
    const fr = new THREE.Mesh(merge([bx(.14, 2.4, .1, -.87, 1.2, 0), bx(.14, 2.4, .1, .87, 1.2, 0), bx(1.88, .16, .1, 0, 2.44, 0)]), mChrome); g.add(fr);
    [-.4, .4].forEach(dx => { const d = new THREE.Mesh(new THREE.BoxGeometry(.8, 2.36, .04), mMetal); d.position.set(dx, 1.18, .0); g.add(d); });
    const seam = new THREE.Mesh(new THREE.BoxGeometry(.012, 2.36, .05), mBlack); seam.position.set(0, 1.18, .005); g.add(seam);
    const ind = new THREE.Mesh(new THREE.PlaneGeometry(.5, .2), new THREE.MeshBasicMaterial({ map: T.makeSign(EL_LABEL[cur.f] || '', '#120806', '#ff5a2a', 34), color: 0xffb090 })); ind.position.set(0, 2.72, .06); g.add(ind);
    const pnl = new THREE.Mesh(new THREE.BoxGeometry(.14, .3, .03), mChrome); pnl.position.set(1.15, 1.25, .03); g.add(pnl);
    [.06, -.06].forEach((dy, k) => { const b = dyn(new THREE.Mesh(new THREE.CircleGeometry(.025, 12), new THREE.MeshBasicMaterial({ color: 0xffa040 }))); b.position.set(1.15, 1.25 + dy, .046); g.add(b);
      const ph = k * 1.3; b.onBeforeRender = () => b.material.color.setHex(Math.sin(performance.now() / 900 + ph) > .6 ? 0xffb050 : 0x3a1a08); });
    plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('승강기 · 정원 9명', '#d8d4c8', '#2a2a2a', 20), roughness: .8 }), .6, .14, x - .02, 1.75, z - 1.15, -Math.PI / 2);
    props.push({ kind: 'elevator', floor: cur.f, x: x - .5, z, y: 1.25, px: x, pz: z, cx, label: '엘리베이터 타기' });
  }
  function stairRoom(cx) {
    // ㄷ자 계단: 1번(북쪽으로 오름) → 층참 → 2번(남쪽으로 오름, 천장 개구부로 이어짐)
    const W = 1.3, xa = cx - 3.15, xb = cx - 1.85, n = 10, run = .48, rise = .19, z0 = -3.0, zl = z0 - n * run;
    for (let i = 0; i < n; i++) { const top = (i + 1) * rise; add(mStep, W, top, run, xa, 0, z0 - run * (i + .5)); }
    add(mStep, 2.6, 1.9, 9.55 + zl, cx - 2.5, 0, (zl - 9.55) / 2);   // 층참
    for (let i = 0; i < n; i++) { const top = 1.9 + (i + 1) * rise; add(mStep, W, .2, run, xb, top - .2, zl + run * (i + .5)); }
    const L = Math.hypot(n * run, n * rise), th = Math.atan2(n * rise, n * run);
    const st = new THREE.Mesh(unit, mStep); st.scale.set(W, .22, L); st.position.set(xb, 1.9 + n * rise / 2 - .32, zl + n * run / 2); st.rotation.x = -th; cur.interior.add(st);
    // 난간 (두 계단 사이)
    const rails = [tube(.025, cx - 2.5, 1.0, z0, cx - 2.5, 1.9 + .95, zl), tube(.025, cx - 2.5, 1.9 + .95, zl, cx - 2.5, 1.9 + n * rise + .95, zl + n * run)];
    for (let k = 0; k <= 5; k++) { const z = z0 - k * (n * run / 5), y = k * (n * rise / 5); rails.push(tube(.018, cx - 2.5, y, z, cx - 2.5, y + 1.0, z)); }
    for (let k = 1; k <= 3; k++) { const z = zl + k * 1.2, y = 1.9 + k * 1.2 * rise / run; rails.push(tube(.018, cx - 2.5, y, z, cx - 2.5, y + .95, z)); }
    rails.push(tube(.025, cx - 3.8, 2.85, zl, cx - 1.2, 2.85, zl));
    const rm = new THREE.Mesh(merge(rails), mRust); cur.interior.add(rm);
    // 걸어서 오르내리는 계단: 높이는 game.js 의 stairH 가 계산한다. 두 계단 사이 난간 · 바깥쪽 옆판만 막는다
    if (cur.stairCx == null) cur.stairCx = cx;
    col(cx - 2.56, cx - 2.44, -7.7, z0 + .1); col(cx - 1.25, cx - 1.15, -9.6, z0 + .1);
    elevator(cx);
    if (cur.f === 0) {   // 본관 1층: 창 대신 별관 연결 통로로 나가는 문
      add(mWoodDark, .1, 2.4, .2, cx + 1.1, 0, -9.5); add(mWoodDark, .1, 2.4, .2, cx + 2.5, 0, -9.5); add(mWoodDark, 1.5, .12, .2, cx + 1.8, 2.4, -9.5);
      plane(cur.interior, mDoor, 1.3, 2.3, cx + 1.8, 1.15, -9.57);
      plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('별관 연결 통로 →', '#1e2a2e', '#d9e4d0', 24), color: 0x9aa59a }), 1.4, .32, cx + 1.8, 2.75, -9.56);
      doors.push({ floor: 0, x: cx + 1.8, z: -9.0, r: 1.3, label: '별관 연결 통로로', to: { floor: 0, x: cx + 1.8, z: -11.2, yaw: 0 } });
    } else if (!cur.basement) win3D(cur.interior, 2.0, 1.8, cx + 1.8, 1.9, -9.58);
    // 계단 표시
    const sg2 = new THREE.MeshBasicMaterial({ map: T.makeSign('▲ 위층   ▼ 아래층', '#1e2a2e', '#d9e4d0', 26), transparent: false });
    plane(cur.interior, sg2, 1.8, .45, cx + 1.8, 2.6, -9.57);
    // 낡은 소방 장비
    add(S(null, { color: 0x8a1a1a, roughness: .6 }), .22, .5, .22, cx + 3.5, 0, -3.0);
    if (cur.basement) {   // A01 진입 계단실: 층 안내판 · 계단참 표시 · 보안 카메라
      plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('B1  설비 · 창고 · 기록', '#1e2a2e', '#d9e4d0', 22), roughness: .8 }), 1.4, .35, cx + 3.84, 1.7, -4.5, -Math.PI / 2);
      plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('B1', '#c8a020', '#1a1a1a', 40), roughness: .8 }), .5, .3, cx - 2.5, 2.6, -9.56);
      cctv(cx + 3.6, CH - .05, -9.3, -Math.PI * .75);
    }
    // 중앙계단 쓰레기
    papers(cx, -8, -3, 6);
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
  function crt(x, y, z) { add(mMetal, .5, .42, .45, x, y, z); const s = new THREE.Mesh(new THREE.PlaneGeometry(.34, .26), mScreen); s.position.set(x, y + .22, z + .231); cur.interior.add(s); }
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
    col(x - .3, x + .3, z - .32, z + .32); return g;
  }
  // 이젤 (A 프레임 + 받침대 + 캔버스)
  function easel(x, z, ry, paint) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; cur.interior.add(g);
    const legs = merge([tube(.018, -.3, 0, .12, -.05, 1.7, 0), tube(.018, .3, 0, .12, .05, 1.7, 0), tube(.018, 0, 0, -.45, 0, 1.55, -.02), bx(.66, .04, .07, 0, .78, .1), bx(.1, .04, .06, 0, 1.58, .05)]);
    g.add(new THREE.Mesh(legs, mWood));
    const cv = new THREE.Mesh(new THREE.BoxGeometry(.6, .75, .025), mWhite); cv.position.set(0, 1.18, .11); cv.rotation.x = -.08; g.add(cv);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(.58, .73), mPaints[paint % 4]); pic.position.z = .0135; cv.add(pic);
    if (paint === 2 && !cur.annex) boardRefs.portrait = { mesh: pic, floor: cur.f, x, z };
    col(x - .35, x + .35, z - .35, z + .35); return g;
  }
  // 학생 의자 한 개 (인스턴싱 없이)
  function deskChair(x, z, ry = Math.PI) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry + Math.PI; g.add(new THREE.Mesh(seatG, mWood), new THREE.Mesh(chairLegG, mMetal)); cur.interior.add(g); return g; }
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
  function broadcast(cx) {
    const zN = -9.6;
    // 주조정실: 콘솔 데스크
    add(mWoodDark, 3.6, .8, 1.1, cx - 1.1, 0, -8.0, { col: true });
    add(mBlack, 2.4, .12, .7, cx - 1.1, .8, -8.1);
    for (let k = 0; k < 14; k++) add(S(null, { color: pick([0xb03030, 0xd0c040, 0x3050a0, 0xcccccc]) }), .05, .06, .05, cx - 2.2 + k * .17, .92, -8.1 + (k % 2) * .15);
    crt(cx - 2.5, .92, -8.55); crt(cx - 1.3, .92, -8.55); crt(cx - .1, .92, -8.55);
    add(mBlack, .5, .8, .4, cx - 3.2, 1.5, zN + .3);
    plane(cur.interior, mOnAir, 1.3, .4, cx - .6, 2.55, zN + .05); glowAt(cx - .6, 2.55, zN + .4, 2.2, glowRed);
    add(mBlack, .5, .06, .5, cx - 1.1, .5, -6.9); add(mBlack, .5, .6, .06, cx - 1.1, .5, -6.65);
    add(mBlack, .04, .3, .04, cx + .1, .92, -7.7);
    // 장비실(별도 방): 동쪽 구석
    add(mWall, .15, 2.8, 3.8, cx + 1.4, 0, -7.7, { col: true });
    add(mWall, .6, 2.8, .15, cx + 1.7, 0, -5.75, { col: true }); add(mWall, .65, 2.8, .15, cx + 3.52, 0, -5.75, { col: true }); add(mWall, 1.2, .5, .15, cx + 2.6, 2.3, -5.75);
    plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('장비실', '#1e2a2e', '#d9e4d0', 32), color: 0x9aa59a }), .9, .25, cx + 2.6, 2.1, -5.66);
    [0, 1, 2].forEach(k => { add(mBlack, .7, 2.0, .6, cx + 1.95 + k * .8, 0, -9.25, { col: true }); for (let q = 0; q < 6; q++) add(MATLED[(q + k) % 3], .05, .04, .02, cx + 1.8 + k * .8 + (q % 2) * .15, .5 + q * .25, -8.94); });
    add(mBlack, .5, 1.4, .6, cx + 3.6, 0, -7.4, { col: true }); add(mMetal, .6, .6, .1, cx + 3.55, 1.2, -6.4);
    addMedkit(cx + 2.6, 0, -6.8);
    // 녹음 부스(흡음재) / 크로마키 / 카메라 삼각대
    add(mGlass, .05, 1.6, 3, cx - 2.3, .9, -4.6, { col: true }); add(mWoodDark, .08, 2.5, .08, cx - 2.3, 0, -6.1); add(mWoodDark, .08, 2.5, .08, cx - 2.3, 0, -3.1);
    const foam = S(null, { color: 0x1c1c20, roughness: 1 });
    plane(cur.interior, foam, 2.6, 2.0, cx - 3.84, 1.3, -4.6, Math.PI / 2); plane(cur.interior, new THREE.MeshBasicMaterial({ color: 0x14683a }), 3, 2.2, cx - 3.84, 1.3, -8.0, Math.PI / 2);
    add(mBlack, .04, 1.5, .04, cx - 3.2, 0, -4.8); add(mBlack, .3, .02, .3, cx - 3.2, 1.5, -4.8);
    [[cx + .6, -4.0], [cx - 1.2, -3.6]].forEach(([x, z]) => { add(mBlack, .05, 1.4, .05, x, 0, z); add(mBlack, .3, .25, .4, x, 1.4, z); });
    props.push({ kind: 'console', floor: cur.f, x: cx - 1.1, z: -7.0, label: '방송 장비 사용' });
    addNote('n8', cx - 1.8, .8, -7.6);
    tapeRecorder('tape2', cx - .2, .8, -7.75, -.3);
    addBattery(cx - 3.2, 0, -2.6);
    papers(cx, -8, -2.4, 10);
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
  const mRedV = S(null, { color: 0x9a1a14, roughness: .5, metalness: .4 });
  const mBlueP = S(null, { color: 0x2a4a7a, roughness: .5, metalness: .4 });
  const mRubber = S(null, { color: 0x151515, roughness: .95 });
  const mCardboard = S(null, { color: 0x8a6a42, roughness: .95 });
  const mDrumB = S(null, { color: 0x2a4a6a, roughness: .5, metalness: .4 });
  const mBagB = S(null, { color: 0x111214, roughness: .35, metalness: .1 });
  const mTankG = grunge(S(T.makeMetal([96, 138, 132]), { roughness: .6, metalness: .45 }));
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
  // A06 보일러실
  function boiler(cx) {
    const B = sheetRoom(cx, 10, 11);
    { const b = B(.8, 1.5, 4, 5.5);   // 1 보일러 본체: 누운 원통 + 화실 문 + 리벳 띠 + 연통
      meshAt(merge([new THREE.CylinderGeometry(1.15, 1.15, b.d * .92, 22).rotateX(Math.PI / 2).translate(0, 1.35, 0), ...[-1, -.3, .4, 1.1].map(k => new THREE.TorusGeometry(1.17, .035, 6, 22).translate(0, 1.35, k * b.d * .35)), bx(1.6, .2, b.d * .8, 0, .1, 0)]), mRust, b.x, 0, b.z);
      meshAt(merge([new THREE.CylinderGeometry(.5, .5, .08, 18).rotateX(Math.PI / 2).translate(0, 1.2, 0), bx(.3, .06, .06, .2, 1.2, .05)]), mDarkMetal, b.x, 0, b.z + b.d * .46);
      glowAt(b.x, 1.2, b.z + b.d * .47 + .05, .7, glowRed);
      meshAt(merge([tube(.18, 0, 2.4, -b.d * .3, 0, CH, -b.d * .3)]), mRust, b.x, 0, b.z);
      gauge(b.x + .6, 2.1, b.z + b.d * .47, 0); gauge(b.x - .5, 2.2, b.z + b.d * .47, 0);
      col(b.x - 1.2, b.x + 1.2, b.z - b.d / 2, b.z + b.d / 2); }
    { const p = B(5.3, 1.5, 2.2, 3.4);   // 2 압력 펌프
      meshAt(merge([bx(p.w * .8, .15, p.d * .8, 0, .075, 0), new THREE.CylinderGeometry(.35, .35, p.d * .55, 16).rotateX(Math.PI / 2).translate(0, .55, 0), new THREE.CylinderGeometry(.25, .25, .5, 14).translate(0, .55, p.d * .35)]), mBlueP, p.x, 0, p.z);
      valveWheel(p.x, 1.1, p.z - p.d * .3, 0); col(p.x - p.w * .4, p.x + p.w * .4, p.z - p.d * .4, p.z + p.d * .4); }
    { const v = B(8, .8, 1.1, 9.2);   // 3 수직 배관 (동쪽 벽)
      const P2 = []; for (let k = 0; k < 4; k++) P2.push(tube(.07 + (k % 2) * .03, v.x - .3 + k * .2, 0, v.z - v.d * .35 + k * .6, v.x - .3 + k * .2, CH, v.z - v.d * .35 + k * .6));
      P2.push(tube(.08, v.x, 2.9, v.z - v.d / 2, v.x, 2.9, v.z + v.d / 2), tube(.08, v.x - 2.6, 2.9, -8.3, v.x, 2.9, -8.3));
      meshAt(merge(P2), mRust, 0, 0, 0); valveWheel(v.x - .3, 1.3, v.z - v.d * .35 + .25, 0, .12); valveWheel(v.x + .1, 1.0, v.z - v.d * .35 + 1.45, 0, .12);
      col(v.x - .45, v.x + .45, v.z - v.d / 2, v.z + v.d / 2); }
    { const g = B(5.1, 6.3, 1.4, 1.3);   // 4 압력 게이지 판 (+ 점검표)
      meshAt(merge([bx(.08, 1.4, .08, 0, .7, 0), bx(.7, .5, .06, 0, 1.25, 0)]), mDarkMetal, g.x, 0, g.z); gauge(g.x - .15, 1.3, g.z + .035); gauge(g.x + .18, 1.2, g.z + .035);
      add(mWood, .7, .75, .5, g.x, 0, g.z + .55, { col: true }); addNote('n11', g.x, .77, g.z + .55); }
    { const l = B(1, 8.2, 3.5, 1.2);    // 5 누수 지점: 웅덩이 + 녹 자국 + 물방울 배관
      wetSpot(l.x, l.z, l.w * .45); wetSpot(l.x - .8, l.z + .2, .4); meshAt(tube(.05, l.x - l.w / 2, CH - .15, l.z, l.x + l.w / 2, CH - .15, l.z), mRust, 0, 0, 0);
      blood('drag', l.x, .02, l.z, 1.0, 1.4, true); }
    addBattery(cx - 3.0, 0, -3.0); papers(cx, -8, -2.4, 6);
  }
  // A04 전기실 (분전함 · 비상 전원 — 전력 복구 퍼즐)
  function electric(cx) {
    const E = sheetRoom(cx, 8, 9);
    const a = E(.4, .6, 2.1, 5.5);     // 1 분전반 A: 서쪽 벽을 따라 (차단기 레버는 이쪽)
    cabinetRow(cx - 3.62, a.z, a.d, Math.PI / 2, 2.0, .5); col(cx - 3.9, cx - 3.35, a.z - a.d / 2, a.z + a.d / 2);
    const b2 = E(2.9, .6, 2.1, 5.5);   // 2 분전반 B: 양면 독립 판넬
    cabinetRow(b2.x, b2.z, b2.d, Math.PI / 2, 2.0, .45); cabinetRow(b2.x + .02, b2.z, b2.d, -Math.PI / 2, 2.0, .45); col(b2.x - .3, b2.x + .3, b2.z - b2.d / 2, b2.z + b2.d / 2);
    meshAt(merge([bx(.06, .06, b2.d, 0, 2.15, 0), bx(1.9, .06, .06, -.95, 2.15, -b2.d * .3), bx(1.9, .06, .06, -.95, 2.15, b2.d * .3)]), mDarkMetal, b2.x, 0, b2.z);   // 상부 케이블 트레이
    const u = E(5.5, .6, 1.7, 4.7);    // 3 UPS 캐비닛 (LED)
    cabinetRow(cx + 3.55, u.z, u.d, -Math.PI / 2, 1.9, .7, mDarkMetal); col(cx + 3.15, cx + 3.9, u.z - u.d / 2, u.z + u.d / 2);
    for (let k = 0; k < 4; k++) glowAt(cx + 3.18, 1.55, u.z - u.d / 2 + .4 + k * u.d / 4, .18, k % 2 ? glowRed : glowGreen);
    const m2 = E(2.2, 6.4, 3.5, 1.2);  // 4 전기 절연 매트
    add(mRubber, m2.w, .015, m2.d, m2.x, 0, m2.z);
    const t = E(5.8, 6.4, 1.3, 1.2);   // 5 공구 가방 (+ 응급 밴드)
    meshAt(merge([bx(.5, .26, .25, 0, .13, 0), tube(.012, -.15, .26, 0, -.1, .38, 0), tube(.012, .15, .26, 0, .1, .38, 0), tube(.012, -.1, .38, 0, .1, .38, 0)]), mBagB, t.x, 0, t.z, .3); addMedkit(t.x + .45, 0, t.z);
    // 주 차단기 (분전반 A 정면)
    meshAt(merge([bx(.12, 1.0, .8, 0, 1.4, 0), bx(.04, .9, .7, .07, 1.4, 0)]), S(T.makeMetal([110, 116, 112]), { roughness: .6, metalness: .4 }), cx - 3.3, 0, -5.4);
    plane(cur.interior, mWarnS, .45, .28, cx - 3.2, 2.05, -5.4, Math.PI / 2);
    { const lev = dyn(new THREE.Group()); lev.position.set(cx - 3.18, 1.4, -5.4); cur.interior.add(lev);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.04, .32, .05), mBlack); arm.position.y = .16; lev.add(arm);
      const knob = new THREE.Mesh(new THREE.BoxGeometry(.12, .05, .05), S(null, { color: 0xb02020 })); knob.position.y = .32; lev.add(knob); lev.rotation.z = -2.4;
      props.push({ kind: 'breaker', floor: cur.f, x: cx - 2.5, z: -5.4, lev, on: false, label: '주 차단기 올리기' }); }
    papers(cx, -8, -2.4, 4);
  }
  // A02 시설 창고 (비품 · 공구)
  function storage(cx) {
    const A = sheetRoom(cx, 10, 9);
    const s1 = A(.6, .7, 2.1, 7.3); rackShelf(cx - 2.95, s1.z, s1.d * .95, Math.PI / 2, .8); col(cx - 3.4, cx - 2.5, s1.z - s1.d / 2, s1.z + s1.d / 2);
    const s2 = A(3.6, .7, 2.1, 7.3); rackShelf(cx - .55, s2.z, s2.d * .95, Math.PI / 2, .8); col(cx - 1.0, cx - .1, s2.z - s2.d / 2, s2.z + s2.d / 2);
    const c3 = A(6.4, .7, 2.7, 2.7);   // 3 상자 적재
    for (let k = 0; k < 9; k++) { const s = rr(.45, .65); add(mCardboard, s, s * .8, s, c3.x + rr(-.6, .6), ((k / 3) | 0) * .5, c3.z + rr(-.6, .6), { ry: rr(-.3, .3) }); } col(c3.x - c3.w / 2, c3.x + c3.w / 2, c3.z - c3.d / 2, c3.z + c3.d / 2);
    const t4 = A(6.6, 4.0, 2.6, 1.5);  // 4 공구함 (빨간 롤 캐비닛 + 공구)
    add(mRedV, 1.2, .9, .55, t4.x, 0, t4.z, { col: true }); for (let k = 0; k < 4; k++) add(mChrome, 1.0, .015, .02, t4.x, .15 + k * .2, t4.z + .28);
    add(mRedV, .6, .25, .3, t4.x - .2, .9, t4.z); add(mChrome, .3, .03, .05, t4.x + .35, .92, t4.z, { ry: .4 });
    const d5 = A(6.7, 6.2, 2.4, 1.4);  // 5 서류 상자
    for (let k = 0; k < 4; k++) add(S(null, { color: 0xd8d0b8, roughness: .9 }), .45, .3, .35, d5.x - .7 + k * .48, 0, d5.z + rr(-.1, .1), { ry: rr(-.2, .2) }); add(S(null, { color: 0xd8d0b8, roughness: .9 }), .45, .3, .35, d5.x - .2, .3, d5.z);
    col(d5.x - 1, d5.x + 1, d5.z - .3, d5.z + .3);
    addBattery(d5.x - .2, .6, d5.z); papers(cx, -8, -2.4, 7);
  }
  // A08 문서 보관실 (옛 학적부 · 행정 기록 — 핵심 단서)
  function records(cx) {
    const R = sheetRoom(cx, 11, 11);
    [.5, 3.2, 5.9].forEach(u => { const s = R(u, 1.0, 1.6, 7.5); shelf3D(s.x, s.z, Math.PI / 2, s.d * .95, 2.1, .8, 6, .85); col(s.x - .42, s.x + .42, s.z - s.d / 2, s.z + s.d / 2); });
    const d4 = R(8.3, 1.2, 2.1, 3.3);  // 4 기록 조사 책상 (서약서 · 명부 · 테이프)
    meshAt(merge([bx(1.0, .04, 2.0, 0, .75, 0), bx(.95, .72, .05, 0, .36, -.95), bx(.95, .72, .05, 0, .36, .95), bx(.05, .3, 1.9, .45, .55, 0)]), mWoodDark, d4.x, 0, d4.z); col(d4.x - .5, d4.x + .5, d4.z - 1.0, d4.z + 1.0);
    { const lamp = meshAt(merge([new THREE.CylinderGeometry(.08, .1, .03, 12).translate(0, .015, 0), tube(.01, 0, 0, 0, .08, .35, 0), new THREE.ConeGeometry(.1, .12, 12, 1, true).translate(.1, .32, 0)]), mDarkMetal, d4.x - .3, .77, d4.z - .7); }
    addNote('n12', d4.x, .77, d4.z - .45); tapeRecorder('tape3', d4.x + .1, .77, d4.z + .45, .2);
    deskChair(d4.x - .8, d4.z, -Math.PI / 2);
    const d5 = R(8.3, 6.5, 2.1, 2);    // 5 잠긴 서랍장
    fileCabinet(d5.x + .3, d5.z, -Math.PI / 2); fileCabinet(d5.x + .3, d5.z + .55, -Math.PI / 2);
    meshAt(new THREE.TorusGeometry(.04, .012, 6, 12), mChrome, d5.x + .02, 1.0, d5.z);
    scatterBooks(cx - 1, -2.8, 10); papers(cx, -8, -2.4, 12);
  }
  // A07 폐기물 보관실 (폐자재 · 청소도구)
  function cleaning(cx) {
    const W = sheetRoom(cx, 8, 11);
    const d1 = W(.6, 1.2, 2.1, 2.1);   // 1 폐기물 드럼
    [[-.45, -.4], [.45, -.4], [-.45, .45], [.5, .5]].forEach(([dx, dz], i) => { const d = cyl(i === 3 ? mRust : mDrumB, .3, .9, d1.x + dx, 0, d1.z + dz, 16); if (i === 3) { d.rotation.z = Math.PI / 2; d.position.y = .3; } });
    col(d1.x - .8, d1.x + .8, d1.z - .8, d1.z + .8);
    const d2 = W(3.1, 1.2, 2, 2.3);    // 2 산업용 쓰레기통 (뚜껑 반쯤 열림)
    add(S(null, { color: 0x2a5a3a, roughness: .7, metalness: .2 }), 1.7, 1.2, 1.1, d2.x, 0, d2.z, { col: true });
    { const lid = add(S(null, { color: 0x1e3e2a, roughness: .7 }), 1.75, .05, .6, d2.x, 1.25, d2.z - .3); lid.rotation.x = -.5; }
    const d3 = W(5.5, 1.0, 1.8, 4.0);  // 3 손상된 캐비닛 (넘어짐)
    { const g = add(mPanelG, .6, 1.8, .5, d3.x, 0, d3.z); g.rotation.z = 1.35; g.position.set(d3.x - .2, .3, d3.z); col(d3.x - 1.1, d3.x + .7, d3.z - .35, d3.z + .35); }
    addBattery(d3.x + .4, 0, d3.z + 1.0);
    const d4 = W(.5, 7.2, 5.6, 1.7);   // 4 청소 용구 선반 (출입구 쪽, 동쪽으로 통로)
    rackShelf(d4.x, d4.z, d4.w * .95, 0, .55, 1.8, .5); col(d4.x - d4.w / 2, d4.x + d4.w / 2, d4.z - .3, d4.z + .3);
    [[-.4, 0], [.2, .1]].forEach(([dx]) => meshAt(merge([tube(.015, 0, 0, 0, .05, 1.4, .04), bx(.3, .06, .1, 0, .03, 0)]), S(null, { color: 0x8a6a40 }), d4.x + d4.w / 2 + .25 + dx, 0, d4.z + .4));
    mopBucket(cx + 3.2, -5.4);
    const d5 = W(1.3, 4.9, 2.1, 1.6);  // 5 비닐 포대 (쓰레기 봉투 더미)
    for (let k = 0; k < 6; k++) { const m = meshAt(new THREE.SphereGeometry(rr(.22, .32), 10, 8), mBagB, d5.x + rr(-.7, .7), .2, d5.z + rr(-.4, .4)); m.scale.y = rr(.6, .9); }
    col(d5.x - .9, d5.x + .9, d5.z - .5, d5.z + .5);
    papers(cx, -8, -2.4, 8);
  }
  // A03 기계실 (순환 펌프 · 정비실 — 설비 퍼즐, 예비 퓨즈는 정비 작업대 위)
  function generator(cx) {
    const M = sheetRoom(cx, 12, 9);
    [M(1, 1.1, 3, 2.3), M(5, 1.1, 3, 2.3)].forEach((p, i) => {   // 1 · 2 순환 펌프 (모터 + 펌프 몸체 + 받침)
      meshAt(merge([bx(p.w * .9, .2, p.d * .7, 0, .1, 0), new THREE.CylinderGeometry(.42, .42, 1.0, 18).rotateZ(Math.PI / 2).translate(-.35, .65, 0), new THREE.SphereGeometry(.5, 16, 12).scale(1, 1, .8).translate(.45, .7, 0), new THREE.CylinderGeometry(.16, .16, .7, 12).translate(.45, 1.3, 0)]), i ? mBlueP : mTankG, p.x, 0, p.z);
      for (let k = 0; k < 6; k++) meshAt(new THREE.TorusGeometry(.43, .015, 4, 16).rotateY(Math.PI / 2), mDarkMetal, p.x - .75 + k * .14, .65, p.z);
      gauge(p.x + .45, 1.2, p.z + .42); glowAt(p.x - .35, 1.15, p.z + .3, .25, i ? glowRed : glowGreen);
      col(p.x - p.w * .45, p.x + p.w * .45, p.z - p.d * .35, p.z + p.d * .35); });
    { const l = M(9.2, .5, 1.8, 7.6);    // 3 배관 라인 (빨강 · 파랑 · 회색 다발)
      const PR = [], PB = [], PG = [];
      [[PR, -.35, .09], [PB, 0, .08], [PG, .35, .06]].forEach(([arr, dx, r]) => { arr.push(tube(r, l.x + dx, .35 + dx, l.z - l.d / 2, l.x + dx, .35 + dx, l.z + l.d / 2), tube(r, l.x + dx, .35 + dx, l.z - l.d / 2, l.x + dx, CH, l.z - l.d / 2)); });
      PR.push(tube(.09, l.x - .35, .0, -7.6, l.x - .35, .9, -7.6), tube(.07, cx - 2.3, 1.3, -7.6, l.x - .35, 1.3, -7.6)); PB.push(tube(.07, cx + .3, 1.3, -7.9, l.x, 1.3, -7.9));
      meshAt(merge(PR), mRedV, 0, 0, 0); meshAt(merge(PB), mBlueP, 0, 0, 0); meshAt(merge(PG), mDarkMetal, 0, 0, 0);
      [-.3, .2].forEach(f => valveWheel(l.x - .35, .9, l.z + f * l.d, Math.PI / 2, .14)); col(l.x - .5, l.x + .5, l.z - l.d / 2, l.z + l.d / 2); }
    { const w = M(1.1, 5.4, 4.4, 1.7);    // 4 정비 작업대 (+ 공구 · 바이스)
      meshAt(merge([bx(w.w, .06, .75, 0, .88, 0), bx(.06, .88, .7, -w.w / 2 + .05, .44, 0), bx(.06, .88, .7, w.w / 2 - .05, .44, 0), bx(w.w, .03, .6, 0, .25, 0)]), mWood, w.x, 0, w.z);
      add(mDarkMetal, .25, .2, .2, w.x - .9, .91, w.z); add(mRedV, .5, .22, .28, w.x + .7, .91, w.z - .1); for (let k = 0; k < 3; k++) add(mChrome, .25, .02, .04, w.x + .1 + k * .1, .92, w.z + .2, { ry: rr(-.8, .8) });
      col(w.x - w.w / 2, w.x + w.w / 2, w.z - .4, w.z + .4); }
    { const v = M(6.6, 5.1, 2.3, 2.0);    // 5 밸브 패널 (밸브 · 계기 · 레버)
      add(mPanelG, 1.4, 1.7, .25, v.x, 0, v.z, { col: true });
      [[-.4, 1.25], [.1, 1.25], [.45, 1.0], [-.25, .7]].forEach(([dx, y]) => valveWheel(v.x + dx, y, v.z + .17, 0, .11)); gauge(v.x + .45, 1.45, v.z + .14); gauge(v.x - .45, 1.45, v.z + .14); }
    papers(cx, -8, -2.4, 5);
  }
  // A10 배수 / 하수실 (지하 연결 통로 — 수영장 사다리, 철제 덮개 아래 비밀 자료실)
  function pump(cx) {
    const D = sheetRoom(cx, 6, 11);
    { const t = D(2.5, .5, 1.1, 9.4);    // 1 바닥 배수로 (그레이팅 + 고인 물)
      flat(cur.interior, S(null, { color: 0x0e1416, roughness: .08, metalness: .3 }), t.x - .45, t.x + .45, t.z - t.d / 2, t.z + t.d / 2, .012, 1);
      const bars = []; for (let z = t.z - t.d / 2 + .1; z < t.z + t.d / 2; z += .12) bars.push(bx(.9, .02, .02, 0, .03, z - t.z)); meshAt(merge(bars), mDarkMetal, t.x, 0, t.z); }
    { const p = D(.4, 2.5, 1.7, 2.5);    // 2 배수 펌프
      meshAt(merge([bx(1.4, .15, 1.2, 0, .075, 0), new THREE.CylinderGeometry(.4, .45, .9, 16).translate(0, .6, 0), new THREE.CylinderGeometry(.2, .2, .5, 12).translate(0, 1.3, 0)]), mBlueP, p.x, 0, p.z);
      meshAt(tube(.08, p.x, 1.5, p.z, p.x, CH, p.z), mRust, 0, 0, 0); gauge(p.x + .3, 1.1, p.z + .4); col(p.x - .7, p.x + .7, p.z - .6, p.z + .6); }
    { const l = D(4.3, 1.0, 1, 7.6);     // 3 파이프 연결 (동쪽 벽)
      meshAt(merge([tube(.12, l.x, .4, l.z - l.d / 2, l.x, .4, l.z + l.d / 2), tube(.09, l.x + .3, 1.6, l.z - l.d / 2, l.x + .3, 1.6, l.z + l.d / 2), tube(.12, l.x, .4, l.z - l.d / 2, l.x, 2.6, -9.3), tube(.12, l.x, 2.6, -9.3, cx - 3.6, 2.6, -9.3)]), mRust, 0, 0, 0);
      valveWheel(l.x - .15, .8, l.z, Math.PI / 2, .15); col(l.x - .25, l.x + .5, l.z - l.d / 2, l.z + l.d / 2); }
    { const s = D(.5, 7.7, 1.2, 2.1);    // 4 정비 사다리 (수영장 기계실로)
      const L = [tube(.025, -.25, 0, 0, -.25, CH, 0), tube(.025, .25, 0, 0, .25, CH, 0)]; for (let k = 1; k < 9; k++) L.push(tube(.018, -.25, k * .38, 0, .25, k * .38, 0));
      meshAt(merge(L), mChrome, cx - 3.85, 0, s.z, Math.PI / 2); meshAt(new THREE.BoxGeometry(.9, .02, .9), mBlack, cx - 3.6, CH - .01, s.z);
      doors.push({ floor: cur.f, x: cx - 3.3, z: s.z, r: 1.4, label: '사다리 오르기 (수영장 기계실)', to: { floor: 6, x: -40.2, z: 55.4, yaw: 0 } }); }
    { const c = D(3.6, 8.5, 1.9, 1.4);    // 5 철제 덮개 → 비밀 자료실로 이어지는 좁은 통로
      add(mDarkMetal, 1.0, .05, .8, c.x, 0, c.z); for (let k = 0; k < 4; k++) add(mRust, .9, .012, .03, c.x, .052, c.z - .3 + k * .2);
      meshAt(new THREE.TorusGeometry(.06, .012, 6, 12).rotateX(Math.PI / 2), mChrome, c.x + .35, .06, c.z);
      doors.push({ floor: cur.f, x: c.x, z: c.z, r: 1.1, needPower: true, label: '철제 덮개 들어 올리기 (좁은 통로)', to: { floor: cur.f, x: cx - 2.2, z: 3.1, yaw: Math.PI } }); }
    wetSpot(cx - .4, -5.6, .9); papers(cx, -8, -2.4, 4);
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
    papers(cx, z0 + .5, z1 - .5, 8);
  }
  // A05 비상 계단실 (잠긴 외부 출구 — 탈출 조건)
  function exitRoom(cx) {
    const X = sheetRoom(cx, 8, 9);
    { const s = X(1.0, 1.0, 5.7, 5.6);   // 1 비상 계단: 위로 꺾여 올라가는 철제 계단 + 난간
      const n = 9; for (let i = 0; i < n; i++) add(mStep, 1.4, (i + 1) * .26, .42, cx - 2.6, 0, -2.8 - i * .42 - .21);
      add(mStep, 3.0, 2.34, 1.4, cx - 1.9, 0, -9.0 + .7);
      const R = [tube(.025, cx - 1.9, 1.0, -2.8, cx - 1.9, 3.3, -6.6)]; for (let i = 0; i <= 4; i++) R.push(tube(.018, cx - 1.9, i * .52, -2.8 - i * .95, cx - 1.9, i * .52 + 1.0, -2.8 - i * .95));
      meshAt(merge(R), mRust, 0, 0, 0); col(cx - 3.3, cx - 1.9, -9.6, -2.6); col(cx - 3.4, cx - .4, -9.6, -7.6); }
    { const d = X(6.0, 6.6, 1.0, 1.1); } // 2 잠긴 철문 → 북쪽 벽의 철문(정문 열쇠 필요)
    plane(cur.interior, mDoor, 1.3, 2.3, cx + 1.4, 1.15, -9.57);
    add(mDarkMetal, 1.5, .12, .1, cx + 1.4, 2.3, -9.55); meshAt(new THREE.TorusGeometry(.12, .025, 6, 14), mRust, cx + 1.4, 1.1, -9.48); add(S(null, { color: 0x6a5a30, metalness: .8, roughness: .4 }), .14, .16, .06, cx + 1.4, .9, -9.45);
    plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('비 상 구', '#0a3a1a', '#7dffa0', 30) }), 1.2, .3, cx + 1.4, 2.65, -9.56);
    exitSign(cx + 3.8, 2.6, -5.0, -Math.PI / 2);   // 3 비상 표지
    glowAt(cx + 1.4, 1.4, -8.6, 4, glowRed);
    { const l = X(3.1, 7.2, 1.0, 1.0);  // 4 휴대 비상등 (건전지)
      meshAt(merge([bx(.25, .16, .12, 0, .08, 0), tube(.01, -.08, .16, 0, .08, .16, 0)]), S(null, { color: 0xd8b020, roughness: .5 }), l.x, 0, l.z, .4); glowAt(l.x, .12, l.z + .1, .35, T.makeGlow('255,230,160')); addBattery(l.x + .35, 0, l.z); }
    doors.push({ floor: cur.f, x: cx + 1.4, z: -8.5, r: 1.9, label: '비상 통로 (정문 방향)', need: KEY_NAMES.length, to: { floor: 0, x: -12, z: 67.5, yaw: Math.PI } });
    papers(cx, -8, -2.4, 6);
  }

  /* ---------- 본관 남쪽 방 줄 (3D 프로토타입: 복도 양쪽에 방) ----------
     남쪽 방은 북쪽 방과 같은 빌더로 짓고, 방 중심(cx, 0)을 축으로 180° 돌려 복도 남쪽에 놓는다.
     빌더가 기록한 충돌 · 문 · 소품 · 아이템 · 사물함 좌표도 같은 변환을 적용한다. */
  let curSouth = false;
  function southRoom(cx, fn) {
    const F = cur, real = F.interior, g = new THREE.Group(); g.position.x = 2 * cx; g.rotation.y = Math.PI; real.add(g);
    const n = { col: F.col.length, walls: F.walls.length, dw: (F.doorWalls || []).length, props: props.length, items: items.length, doors: doors.length, dl: doorList.length, lockers: lockers.length, books: (F.books || []).length, sparks: (F.sparks || []).length };
    const refKeys = new Set(Object.keys(boardRefs));
    F.interior = g; curSouth = true;
    try { fn(); } finally { F.interior = real; curSouth = false; }
    const done = new Set(), mx = x => 2 * cx - x;
    const tr = o => {
      if (!o || typeof o !== 'object' || done.has(o)) return; done.add(o);
      if (typeof o.x1 === 'number' && typeof o.x2 === 'number') { const a = mx(o.x2), b = mx(o.x1), c = -o.z2, d = -o.z1; o.x1 = a; o.x2 = b; o.z1 = c; o.z2 = d; }
      if (typeof o.x === 'number' && typeof o.z === 'number') { o.x = mx(o.x); o.z = -o.z; }
      if (typeof o.px === 'number') { o.px = mx(o.px); o.pz = -o.pz; }
      if (o.pos && o.pos.isVector3) { o.pos.x = mx(o.pos.x); o.pos.z = -o.pos.z; }
      if (o.dir) o.dir = { x: -o.dir.x, z: -o.dir.z };
      if (o.rect) tr(o.rect);
    };
    [F.col.slice(n.col), F.walls.slice(n.walls), (F.doorWalls || []).slice(n.dw), props.slice(n.props), items.slice(n.items), doors.slice(n.doors), doorList.slice(n.dl), lockers.slice(n.lockers), (F.sparks || []).slice(n.sparks)].forEach(l => l.forEach(tr));
    Object.keys(boardRefs).filter(k => !refKeys.has(k)).forEach(k => tr(boardRefs[k]));
    if (F.books) { g.updateMatrix(); F.books.slice(n.books).forEach(b => b.m.premultiply(g.matrix)); }
  }
  // 남쪽 방 미닫이문 (복도 남벽, 실제 좌표)
  function slidingDoorsS(cx) {
    const zW = 1.4; add(mWoodDark, 2.2, .05, .08, cx, 2.3, zW - .02);
    const open = rnd() < .8, rect = { x1: cx - 1, x2: cx + 1, z1: zW - .03, z2: 1.75, off: open };
    const panels = [-1, 1].map(s => {
      const g = dyn(new THREE.Group()); g.position.set(0, 0, zW); cur.interior.add(g);
      g.add(new THREE.Mesh(panelG, mDoorP)); const h = new THREE.Mesh(handleG, mChrome); h.position.set(-s * .42, 1.0, -.03); g.add(h);
      return { m: g, x0: cx + s * .5, x1: cx + s * 1.48 };
    });
    const d = { kind: 'slide', floor: cur.f, x: cx, z: 1.5, open: open ? 1 : 0, target: open ? 1 : 0, panels, rect, name: '문' };
    panels.forEach(p => { p.m.position.x = p.x0 + (p.x1 - p.x0) * d.open; });
    cur.col.push(rect); (cur.doorWalls ||= []).push(rect); doorList.push(d);
    return d;
  }
  // 공통 소품
  const sofa = (x, z, ry, w = 1.8, mat = mFabric) => { meshAt(merge([bx(w, .42, .8, 0, .21, 0), bx(w, .45, .18, 0, .62, -.31), bx(.18, .3, .8, -w / 2 + .09, .55, 0), bx(.18, .3, .8, w / 2 - .09, .55, 0)]), mat, x, 0, z, ry); const sw = Math.abs(Math.sin(ry)) > .7; col(x - (sw ? .42 : w / 2), x + (sw ? .42 : w / 2), z - (sw ? w / 2 : .42), z + (sw ? w / 2 : .42)); };
  const trophyCase = (x, z, ry, w = 1.6) => { const g = meshAt(merge([bx(w, 1.9, .45, 0, .95, 0)]), mWoodDark, x, 0, z, ry); const gl = new THREE.Mesh(new THREE.PlaneGeometry(w - .1, 1.2), mGlass); gl.position.set(0, 1.25, .23); g.add(gl);
    for (let k = 0; k < 5; k++) { const t = new THREE.Mesh(merge([new THREE.CylinderGeometry(.05, .07, .05, 10).translate(0, .025, 0), new THREE.CylinderGeometry(.015, .015, .12, 8).translate(0, .11, 0), new THREE.CylinderGeometry(.07, .035, .12, 12, 1, true).translate(0, .23, 0)]), S(null, { color: k % 2 ? 0xb8902a : 0x9a9aa0, metalness: .8, roughness: .3 })); t.position.set(-w / 2 + .25 + k * (w - .5) / 4, .72 + (k % 2) * .45, 0); g.add(t); }
    const sw = Math.abs(Math.sin(ry)) > .7; col(x - (sw ? .25 : w / 2), x + (sw ? .25 : w / 2), z - (sw ? w / 2 : .25), z + (sw ? w / 2 : .25)); };
  const noticeBoard = (x, y, z, ry, w = 1.6) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; cur.interior.add(g); const c = new THREE.Mesh(new THREE.PlaneGeometry(w, .9), mCork); g.add(c); for (let k = 0; k < 5; k++) { const pp = new THREE.Mesh(new THREE.PlaneGeometry(.24, .32), mPaperN); pp.position.set(-w / 2 + .2 + k * (w - .4) / 4, rr(-.2, .2), .01); pp.rotation.z = rr(-.12, .12); g.add(pp); } };
  // 교장실
  function principal(cx) {
    const zN = -9.6;
    meshAt(merge([bx(1.9, .05, .9, 0, .76, 0), bx(1.8, .74, .05, 0, .37, .4), bx(.5, .74, .8, -.65, .37, 0), bx(.5, .74, .8, .65, .37, 0)]), mWoodDark, cx, 0, -7.9); col(cx - .95, cx + .95, -8.35, -7.45);
    officeChair(cx, -8.7, 0); add(mBlack, .45, .3, .02, cx - .5, .79, -8.05); plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('교 장', '#2a2016', '#d8c8a0', 30), roughness: .6 }), .5, .12, cx, .86, -7.44);
    plane(cur.interior, mFlag, .9, .6, cx - 2.6, 2.3, zN + .04); add(mChrome, .03, 2.0, .03, cx - 3.2, 0, zN + .4);
    [-1.3, 1.3].forEach(dx => { const fr = new THREE.Mesh(new THREE.BoxGeometry(.5, .65, .03), mWoodDark); fr.position.set(cx + dx, 2.3, zN + .03); cur.interior.add(fr); const pic = new THREE.Mesh(new THREE.PlaneGeometry(.4, .55), mPaints[1]); pic.position.set(cx + dx, 2.3, zN + .05); cur.interior.add(pic); });
    plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('성실 · 정직 · 배려', '#e8e2d2', '#3a2a1a', 26), roughness: .8 }), 2.0, .45, cx, 3.0, zN + .04);
    sofa(cx - 2.6, -4.5, Math.PI / 2); sofa(cx + 2.6, -4.5, -Math.PI / 2); add(mWood, 1.2, .4, .6, cx, 0, -4.5, { col: true }); cyl(mPorc, .05, .09, cx + .2, .4, -4.5, 10);
    trophyCase(cx + 3.55, -7.9, -Math.PI / 2, 1.6); shelf3D(cx - 3.62, -7.6, Math.PI / 2, 1.6, 2.0, .4, 5, .8); col(cx - 3.85, cx - 3.4, -8.4, -6.8);
    potPlant(cx + 3.3, 0, -2.4, false); papers(cx, -8, -2.4, 6);
  }
  // 회의실
  function meeting(cx) {
    const zN = -9.6;
    meshAt(merge([bx(4.6, .05, 1.3, 0, .74, 0), bx(.08, .72, .08, -2.1, .36, -.5), bx(.08, .72, .08, 2.1, .36, -.5), bx(.08, .72, .08, -2.1, .36, .5), bx(.08, .72, .08, 2.1, .36, .5)]), mWood, cx, 0, -5.8); col(cx - 2.3, cx + 2.3, -6.45, -5.15);
    for (let k = 0; k < 5; k++) [-1, 1].forEach(s => { const c = officeChair(cx - 1.9 + k * .95 + rr(-.08, .08), -5.8 + s * .95, s > 0 ? Math.PI + rr(-.3, .3) : rr(-.3, .3), rnd() < .08); });
    add(mWhite, 2.4, 1.2, .04, cx, 1.0, zN + .05); add(mBlack, .3, .05, .3, cx, CH - .5, -6.0);
    for (let k = 0; k < 6; k++) { const pp = new THREE.Mesh(new THREE.PlaneGeometry(.21, .29), mDirtPaper); pp.rotation.set(-Math.PI / 2, 0, rr(-.6, .6)); pp.position.set(cx - 2 + k * .8, .77, -5.8 + rr(-.4, .4)); cur.interior.add(pp); }
    cyl(S(null, { color: 0x9ac0d8, transparent: true, opacity: .6, roughness: .2 }), .14, .4, cx + 3.5, 1.0, -8.9, 12); add(mWhiteP2, .35, 1.0, .35, cx + 3.5, 0, -8.9, { col: true });
    noticeBoard(cx - 3.84, 1.6, -5.8, Math.PI / 2, 1.8); papers(cx, -8, -2.4, 6);
  }
  // 중앙현관 (밖에서 들어오는 첫 공간): 신발장 · 트로피 진열장 · 안내판 · 교내 지도 · 우산꽂이
  function lobby(cx) {
    for (let k = 0; k < 4; k++) [-1, 1].forEach(s => { meshAt(merge([...Array.from({ length: 5 }, (_, r) => bx(1.0, .02, .35, 0, .05 + r * .38, 0)), bx(.02, 1.6, .35, -.5, .8, 0), bx(.02, 1.6, .35, .5, .8, 0)]), mWood, cx + s * 3.6, 0, -8.6 + k * 1.05, s > 0 ? -Math.PI / 2 : Math.PI / 2); });
    col(cx - 3.85, cx - 3.4, -9.2, -4.9); col(cx + 3.4, cx + 3.85, -9.2, -4.9);
    for (let k = 0; k < 14; k++) add(S(null, { color: pick([0xe8e6e0, 0x2a2a30, 0x3a5aa0, 0x8a2a2a]) }), .26, .08, .1, cx + (k % 2 ? 3.55 : -3.55), .07 + ((k / 4) | 0) * .38, -8.8 + (k % 4) * 1.05 + rr(-.1, .1), { ry: Math.PI / 2 + rr(-.3, .3) });
    trophyCase(cx - 2.6, -2.25, Math.PI, 1.8); noticeBoard(cx + 2.6, 1.6, -2.0, Math.PI, 1.8);
    plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('환영합니다 · 서문고등학교', '#20302a', '#d8e8d0', 22), roughness: .8 }), 3.0, .45, cx, 3.1, -1.95, Math.PI);
    cyl(mBlue, .18, .5, cx + 2.2, 0, -8.9, 12); for (let k = 0; k < 3; k++) { const u = meshAt(new THREE.CylinderGeometry(.012, .012, .9, 6).translate(0, .45, 0), mBlack, cx + 2.2 + rr(-.08, .08), 0, -8.9 + rr(-.08, .08)); u.rotation.z = rr(-.2, .2); }
    potPlant(cx - 2.4, 0, -9.1, true); potPlant(cx + 2.9, 0, -9.1, true);
    add(mStep, 3.4, .02, 1.2, cx, 0, -9.0);   // 현관 매트 자리
    papers(cx, -8, -2.4, 10);
  }
  // 인쇄실
  function print(cx) {
    [[-2.6, -8.6], [-.4, -8.6]].forEach(([dx, z]) => { meshAt(merge([bx(1.0, .9, .7, 0, .45, 0), bx(1.0, .12, .7, 0, .96, 0), bx(.3, .03, .25, .2, 1.03, .2)]), mPlastic, cx + dx, 0, z); col(cx + dx - .5, cx + dx + .5, z - .35, z + .35); glowAt(cx + dx + .3, 1.0, z + .36, .15, glowGreen); });
    add(mWood, 2.4, .8, .7, cx + 2.4, 0, -5.4, { col: true, ry: Math.PI / 2 });
    for (let k = 0; k < 6; k++) add(S(null, { color: 0xeeeeea, roughness: .8 }), .3, .2 + rr(0, .25), .22, cx + 2.4 + rr(-.2, .2), .8, -6.4 + k * .4, { ry: rr(-.2, .2) });
    rackShelf(cx - 3.45, -5.0, 2.6, Math.PI / 2, .6, 2.0, .8); col(cx - 3.8, cx - 3.1, -6.3, -3.7);
    printer(cx + 2.4, .8, -7.2, -Math.PI / 2); papers(cx, -8, -2.4, 18);
  }
  // 창고 · 보관실
  function storeS(cx) {
    rackShelf(cx - 2.9, -6.0, 6.0, Math.PI / 2, .8, 2.1, .8); col(cx - 3.3, cx - 2.5, -9.0, -3.0);
    rackShelf(cx + 2.9, -6.0, 6.0, Math.PI / 2, .8, 2.1, .8); col(cx + 2.5, cx + 3.3, -9.0, -3.0);
    for (let k = 0; k < 4; k++) { const g = new THREE.Group(); g.position.set(cx + rr(-.6, .6), k * .78, -8.6); g.rotation.y = rr(-.2, .2); g.rotation.z = k % 2 ? Math.PI : 0; if (k % 2) g.position.y += .76; g.add(new THREE.Mesh(deskTopG, mWood), new THREE.Mesh(deskLegG, mMetal)); cur.interior.add(g); }
    col(cx - .8, cx + .8, -9.0, -8.2); for (let k = 0; k < 5; k++) add(mCardboard, rr(.4, .6), rr(.3, .5), rr(.4, .6), cx + rr(-1.2, 1.2), 0, -6.5 + rr(-1, 1), { ry: rr(-.5, .5) });
    papers(cx, -8, -2.4, 6);
  }
  // 보건실 보조 (침대 · 커튼 · 약품장)
  function sick(cx) {
    [-2.3, .2].forEach(dx => { add(mMetal, .95, .5, 2.0, cx + dx, 0, -8.3, { col: true }); add(mWhite, .9, .14, 1.9, cx + dx, .5, -8.3); add(mWhite, .5, .1, .35, cx + dx, .64, -9.0); curtain(cx + dx + 1.05, 1.3, -8.0, 1.8, 2.4, Math.PI / 2); });
    add(mLockerT, .9, 1.7, .4, cx + 3.55, 0, -6.4, { ry: Math.PI / 2, col: true }); add(mGlass, .9, 1.7, .44, cx + 3.55, 0, -6.4, { ry: Math.PI / 2 });
    meshAt(merge([bx(.4, .08, .45, 0, .04, 0), tube(.025, 0, .08, -.15, 0, 1.2, -.18)]), mWhite, cx + 3.2, 0, -3.0);
    papers(cx, -8, -2.4, 6);
  }
  // 교사 휴게실
  function staff(cx) {
    const zN = -9.6;
    sofa(cx - 2.2, -8.8, 0, 2.2); add(mWood, 1.2, .4, .6, cx - 2.2, 0, -7.6, { col: true }); cyl(mPorc, .05, .09, cx - 2.0, .4, -7.6, 10); cyl(mPorc, .05, .09, cx - 2.5, .4, -7.5, 10);
    add(mWood, 2.6, .9, .6, cx + 2.4, 0, zN + .35, { col: true }); add(S(null, { color: 0xd8d4c8, roughness: .5 }), .5, .3, .35, cx + 3.2, .9, zN + .35); cyl(mChrome, .08, .22, cx + 1.6, .9, zN + .35, 12);
    add(S(null, { color: 0xd8d4c8, roughness: .4 }), .7, 1.7, .65, cx + 3.5, 0, -7.6, { col: true });
    for (let k = 0; k < 4; k++) add(mLockerT, .5, 1.8, .45, cx - 3.55, 0, -5.8 + k * .52, { ry: Math.PI / 2, col: true });
    add(mWood, 1.4, .74, .8, cx + .8, 0, -4.6, { col: true }); [-1, 1].forEach(s => deskChair(cx + .8 + s * .5, -3.8, Math.PI));
    noticeBoard(cx + 3.84, 1.6, -4.2, -Math.PI / 2, 1.4); papers(cx, -8, -2.4, 6);
  }
  // 기록 보관실
  function archive(cx) {
    [-2.6, 0, 2.6].forEach(dx => { shelf3D(cx + dx, -6.6, Math.PI / 2, 4.6, 2.1, .6, 6, .9); col(cx + dx - .33, cx + dx + .33, -8.9, -4.3); });
    fileCabinet(cx - 3.5, -3.0, Math.PI / 2, true); fileCabinet(cx + 3.5, -3.0, -Math.PI / 2);
    scatterBooks(cx - 1.3, -3.2, 12); papers(cx, -8, -2.4, 12);
  }
  // 층 홀 (2 · 3층 남쪽 가운데): 벤치 · 진열장 · 게시판 · 자판기 · 화분 — 넓은 창이 있는 휴게 공간
  function hall(cx) {
    [-2.4, 2.4].forEach(dx => { meshAt(merge([bx(1.8, .05, .4, 0, .44, 0), bx(.06, .42, .35, -.8, .21, 0), bx(.06, .42, .35, .8, .21, 0)]), mWood, cx + dx, 0, -8.7); col(cx + dx - .9, cx + dx + .9, -8.9, -8.5); });
    trophyCase(cx - 3.55, -5.0, Math.PI / 2, 1.6); noticeBoard(cx + 3.84, 1.6, -5.0, -Math.PI / 2, 2.0);
    add(S(null, { color: 0x8a2020, roughness: .4 }), .8, 1.8, .7, cx + 3.4, 0, -2.6, { col: true }); add(mGlass, .6, .9, .02, cx + 3.4, .7, -2.24); glowAt(cx + 3.4, 1.3, -2.2, .7, glowRed);
    potPlant(cx - 3.3, 0, -9.0, true); potPlant(cx + 3.3, 0, -9.0, false);
    papers(cx, -8, -2.4, 8);
  }
  // 열람실
  function reading(cx) {
    [-1.6, 1.6].forEach(dx => [-7.6, -5.0].forEach(z => { add(mWood, 2.0, .74, 1.0, cx + dx, 0, z, { col: true }); [-.55, .55].forEach(o => [-1, 1].forEach(s => deskChair(cx + dx + o, z + s * .8, s > 0 ? Math.PI : 0))); }));
    shelf3D(cx - 3.62, -4.0, Math.PI / 2, 2.4, 2.0, .4, 5, .85); shelf3D(cx + 3.62, -4.0, -Math.PI / 2, 2.4, 2.0, .4, 5, .85);
    col(cx - 3.85, cx - 3.4, -5.2, -2.8); col(cx + 3.4, cx + 3.85, -5.2, -2.8);
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
    shelf3D(cx + 3.6, -6.0, -Math.PI / 2, 1.4, 2.0, .4, 5, .75); col(cx + 3.38, cx + 3.85, -6.7, -5.3);
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
    frontWall(cx, zN, true, ['']); const bm = frontWall.last; boardRefs['cls' + cur.f + ':' + cx + (curSouth ? 's' : '')] = { mat: bm, floor: cur.f, cx, name: '3-2' };
    curtain(cx, 1.15, zN + .14, 3.8, 1.5);   // 칠판을 덮은 천
    for (let k = 0; k < 10; k++) { const g = new THREE.Group(); const side = k < 5 ? -1 : 1, j = k % 5; g.position.set(cx + side * 3.3, ((j / 2) | 0) * .76, -8.6 + (j % 2) * .9 + (k > 6 ? 2 : 0)); g.rotation.y = Math.PI / 2 + rr(-.2, .2); if (j >= 2) { g.rotation.z = Math.PI; g.position.y += .76; } g.add(new THREE.Mesh(deskTopG, mWood), new THREE.Mesh(deskLegG, mMetal)); cur.interior.add(g); }
    col(cx - 3.85, cx - 2.9, -9.2, -5.4); col(cx + 2.9, cx + 3.85, -9.2, -5.4);
    // 가운데 남은 한 자리: 국화 · 이름표 · 먼지
    const g = new THREE.Group(); g.position.set(cx, 0, -5.6); g.add(new THREE.Mesh(deskTopG, mWood), new THREE.Mesh(deskLegG, mMetal)); cur.interior.add(g); col(cx - .36, cx + .36, -5.86, -5.34);
    deskChair(cx, -5.0, Math.PI);
    cyl(mGlass, .05, .22, cx + .15, .75, -5.65, 10); for (let k = 0; k < 3; k++) { const fl = meshAt(new THREE.SphereGeometry(.045, 8, 6), S(null, { color: 0xe8e4d0, roughness: .7 }), cx + .15 + rr(-.05, .05), .99 + rr(0, .06), -5.65 + rr(-.05, .05)); }
    plane(cur.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('3-2 윤하늘', '#e8e4d8', '#2a2a2a', 30), roughness: .8 }), .2, .06, cx - .15, .757, -5.5, 0, -Math.PI / 2);
    graffiti('집에 가고 싶어', cx - 2.2, 1.6, -1.765, Math.PI, 2.0);
    for (let k = 0; k < 6; k++) add(mCardboard, rr(.4, .6), rr(.3, .5), rr(.4, .6), cx + rr(-2.4, 2.4), 0, -3.0 + rr(-.4, .3), { ry: rr(-.5, .5) });
    classClue(cx, '3-2'); papers(cx, -8, -2.4, 14);
  }
  // --- 별관 남쪽 방 ---
  const winsFar = cx => [-2.5, 2.5].forEach(dx => win3D(cur.interior, 1.6, 1.5, cx + dx, 1.75, -9.58));   // 바깥벽 창 (남쪽 방은 회전되어 남쪽에 놓인다)
  // 실습 · 과학 준비실: 약품장 · 개수대 · 유리기구 선반
  function prepS(cx) {
    winsFar(cx);
    add(mWhite, 3.0, .9, .65, cx - 1.6, 0, -9.2, { col: true }); add(mBlack, 3.0, .04, .65, cx - 1.6, .9, -9.2); [-2.6, -1.2].forEach(dx => meshAt(merge([bx(.5, .02, .4, 0, .0, 0), tube(.012, 0, 0, -.15, 0, .3, -.15), tube(.012, 0, .3, -.15, 0, .3, 0)]), mChrome, cx + dx, .92, -9.2));
    add(mLockerT, 1.0, 1.9, .45, cx + 3.5, 0, -7.5, { ry: -Math.PI / 2, col: true }); add(mGlass, 1.0, 1.9, .48, cx + 3.5, 0, -7.5, { ry: -Math.PI / 2 });
    shelf3D(cx + 3.6, -4.6, -Math.PI / 2, 1.8, 1.8, .4, 4, 0); col(cx + 3.38, cx + 3.85, -5.5, -3.7);
    for (let k = 0; k < 9; k++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(.04, .07, .18, 10), k % 3 ? mGlass : mLiquid); f.position.set(cx + 3.55, .25 + (k % 3) * .45, -5.2 + ((k / 3) | 0) * .5); cur.interior.add(f); }
    add(mWood, 1.6, .8, .8, cx - .4, 0, -5.4, { col: true }); stool(cx - 1.4, -5.4); papers(cx, -8, -2.4, 6);
  }
  // 공구실: 작업대 · 타공판 공구 · 공구함 · 자재
  function tool(cx) {
    winsFar(cx);
    add(mWood, 3.2, .85, .8, cx - 1.6, 0, -9.1, { col: true }); add(mBlack, 3.2, 1.2, .03, cx - 1.6, 1.15, -9.57);
    for (let k = 0; k < 10; k++) add(mChrome, .03, rr(.18, .32), .02, cx - 3.0 + k * .3, 1.45 + rr(-.1, .1), -9.53);
    add(mRedV, .6, .9, .45, cx + 2.8, 0, -9.0, { col: true }); for (let k = 0; k < 3; k++) add(mChrome, .5, .015, .02, cx + 2.8, .2 + k * .25, -8.76);
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
    [-6.8, -4.6].forEach(z => { add(mWood, 6.4, .74, .7, cx, 0, z, { col: true }); for (let k = 0; k < 4; k++) { const x = cx - 2.4 + k * 1.6; monitor(x, .76, z - .14, 0, { cracked: rnd() < .2 }); keyboard(x, .76, z + .14, 0); officeChair(x, z + .75, Math.PI + rr(-.4, .4), rnd() < .1); } });
    termLed(cx + 2.95, .8, -6.95);
    papers(cx, -8, -2.4, 6);
  }
  // 작업실: 바이스가 달린 작업대 · 나무 부품 · 톱밥
  function work(cx) {
    winsFar(cx);
    [-2, 2].forEach(dx => [-7.4, -4.8].forEach(z => { add(mWood, 2.2, .85, 1.0, cx + dx, 0, z, { col: true }); add(mDarkMetal, .25, .18, .2, cx + dx - .9, .85, z - .35); for (let k = 0; k < 3; k++) add(mWood, rr(.3, .7), .04, rr(.1, .2), cx + dx + rr(-.6, .6), .87, z + rr(-.3, .3), { ry: rr(0, 3) }); }));
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
    [-1.5, 1.5].forEach(x => add(mWoodDark, .12, 2.7, .4, cx + x, 0, zN + .1)); add(mWoodDark, 3.1, .12, .4, cx, 2.7, zN + .1);
    plane(cur.interior, mDoor, 1.4, 2.5, cx - .72, 1.25, zN + .06); plane(cur.interior, mDoor, 1.4, 2.5, cx + .72, 1.25, zN + .06);
    plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('주출입구', '#1e2a2e', '#d9e4d0', 30), color: 0x9aa59a }), 1.4, .35, cx, 3.0, zN + .05);
    exitSign(cx, 2.95, zN + .3); noticeBoard(cx - 2.6, 1.6, -2.0, Math.PI, 1.6); potPlant(cx + 2.6, 0, -2.4, true);
    papers(cx, -8, -2.4, 8);
  }
  const mWhiteP2 = S(null, { color: 0xd8d6cc, roughness: .5 });
  const SOUTH_FN = { class: (cx, n) => n === '3-2' ? classroom32(cx) : classroom(cx, n), principal, meeting, lobby, print, storeS, sick, toilet, staff, archive, hall, reading, av, counselS, student, prepS, tool, wash, digital, work, equip, gallery, lobbyA };

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
    if (LS) SLOTS.forEach((cx, i) => { const t = LS.types[i]; flat(F.interior, ['class', 'principal', 'meeting', 'staff', 'reading', 'counselS', 'student', 'av'].includes(t) ? mFloorWood : mFloorTile, cx - 4, cx + 4, 1.75, 9.6, 0); });
    ceilHole(F.interior, X0, X1, Z0, Z1, 0);
    SLOTS.forEach((cx, i) => {
      const t = lay.types[i];
      const wood = ['class', 'office', 'library', 'music', 'art', 'counsel', 'nurse'].includes(t);
      flat(F.interior, wood ? mFloorWood : mFloorTile, cx - 4, cx + 4, -9.6, -1.75, 0);
    });

    // 외벽(shell)
    wallSeg(X0, X1, Z0, -9.6, 0, FH, true);       // 북
    wallSeg(X0, -36, Z0, Z1, 0, FH, true);        // 서
    wallSeg(36, X1, Z0, Z1, 0, FH, true);         // 동
    // 남쪽 벽: 창문 + 현관
    const wins = [];
    if (LS) SLOTS.forEach(cx => wins.push(cx - 3.05, cx + 3.05));
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
        win3D(F.shell, o.w, 1.6, o.x, 1.7, zs0 + .15, Math.PI);
        if (!o.base && !LS) { const r = new THREE.Mesh(radG, mRad); r.position.set(o.x, 0, zs0 - .12); r.rotation.y = Math.PI; r.scale.x = 1.6; F.interior.add(r); }
        add(mWoodDark, o.w + .2, .06, .3, o.x, .88, zs0 + .2, { parent: F.shell });
      } else {
        wallSeg(a, b, zs0, zs1, 2.7, FH, true);
        add(mWoodDark, .12, 2.7, .4, a, 0, zs0 + .15, { parent: F.shell }); add(mWoodDark, .12, 2.7, .4, b, 0, zs0 + .15, { parent: F.shell });
        // 열려 있는 유리문 두 짝
        [[a, -1], [b, 1]].forEach(([hx, s]) => { const dg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, .05), mDoor); dg.geometry.translate(-s * .7, 1.2, 0); dg.position.set(hx, 0, zs0 + .25); dg.rotation.y = s * (1.2 + rr(-.2, .2)); F.shell.add(dg); });
      }
      cursor = b;
    }
    if (cursor < 36.3) wallSeg(cursor, 36.3, zs0, zs1, 0, FH, true);
    // 층간 콘크리트 띠 + 바깥 창턱
    if (!o.basement && f < 2) F.shell.add(boxMesh(-36.6, 36.6, FH - .14, FH + .14, zs1, zs1 + .2, mFacade, 3));
    if (!o.basement) wins.forEach(x => F.shell.add(boxMesh(x - (LS ? .8 : 1.35), x + (LS ? .8 : 1.35), .82, .9, zs1, zs1 + .17, mFacade, 3)));
    if (f === 0) {   // 현관: 계단 + 캐노피 + 기둥 + 교명 간판
      for (let k = 0; k < 3; k++) { F.shell.add(boxMesh(-3.2 + k * .25, 3.2 - k * .25, 0, .12 * (k + 1), zs1, zs1 + 1.65 - k * .45, mStep, 2)); }
      F.shell.add(boxMesh(-3.0, 3.0, 2.95, 3.2, zs1, zs1 + 2.85, mFacade, 3));
      [-2.6, 2.6].forEach(x => F.shell.add(boxMesh(x - .18, x + .18, 0, 2.95, zs1 + 2.3, zs1 + 2.66, mFacade, 3)));
      const sg = new THREE.MeshStandardMaterial({ map: T.makeSign('서 문 고 등 학 교', 'rgba(0,0,0,0)', '#c8c0a8', 40), transparent: true, metalness: .6, roughness: .45 });
      plane(F.shell, sg, 4.6, 1.15, 0, 3.55, zs1 + .03);
    }
    // 충돌 보정: 창문 구간도 벽이므로 단일 충돌체로 대체 (현관 제외)
    F.col = F.col.filter(r => !(r.z1 === zs0 && r.z2 === zs1));
    F.walls = F.walls.filter(r => !(r.z1 === zs0 && r.z2 === zs1));
    if (f === 0) { col(-36.3, -1.5, zs0, zs1, true); col(1.5, 36.3, zs0, zs1, true); }
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
      if (lay.types[i] !== 'stair') slidingDoors(cx);
      // 교실 명패
      const sg = new THREE.MeshBasicMaterial({ map: T.makeSign(lay.names[i], '#1e2a2e', '#d9e4d0', lay.names[i].length > 3 ? 28 : 36), color: 0x9aa59a });
      plane(F.interior, sg, 1.0, .25, cx, 2.62, -1.43);
    });
    for (const b of [-28, -20, -12, -4, 4, 12, 20, 28]) wallSeg(b - .15, b + .15, -9.6, -1.75, 0, CH);
    // 복도 남벽 + 남쪽 방 (현관 · 홀은 넓은 개구부)
    if (LS) {
      SLOTS.forEach((cx, i) => {
        const t = LS.types[i], open = t === 'lobby' || t === 'hall';
        if (open) { wallSeg(cx - 4, cx - 3, 1.45, 1.75, 0, CH); wallSeg(cx + 3, cx + 4, 1.45, 1.75, 0, CH); wallSeg(cx - 3, cx + 3, 1.45, 1.75, 2.7, CH); [-3, 3].forEach(dx => add(mWoodDark, .12, 2.7, .36, cx + dx, 0, 1.6)); }
        else {
          wallSeg(cx - 4, cx - 1, 1.45, 1.75, 0, CH); wallSeg(cx + 1, cx + 4, 1.45, 1.75, 0, CH); wallSeg(cx - 1, cx + 1, 1.45, 1.75, 2.4, CH);
          add(mWoodDark, .1, 2.4, .36, cx - 1.0, 0, 1.6); add(mWoodDark, .1, 2.4, .36, cx + 1.0, 0, 1.6); slidingDoorsS(cx);
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
      ({ class: classroom, office, nurse, counsel, library, lab, computer, music, art, toilet, stair: stairRoom, cooking, craft, broadcast, boiler, electric, storage, records, cleaning, generator, pump, exit: exitRoom })[t](cx, lay.names[i]);
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
      const r = rnd(); const kind = room ? (r < .62 ? 'on' : r < .85 ? 'flick' : 'dead') : (r < .35 ? 'on' : r < .62 ? 'flick' : 'dead');
      const m = kind === 'on' ? matLampOn : kind === 'dead' ? matLampDead : flickerMats[(rnd() * 4) | 0];
      const tube = dyn(new THREE.Mesh(new THREE.BoxGeometry(1.3, .05, .12), m)); tube.position.set(x, CH - .1, z); tube.rotation.y = ang; F.interior.add(tube);
      const hs = new THREE.Mesh(new THREE.BoxGeometry(1.4, .04, .22), lampHousing); hs.position.set(x, CH - .04, z); hs.rotation.y = ang; F.interior.add(hs);
      if (kind === 'dead' && rnd() < .4) { tube.rotation.x = rr(.5, .9); tube.position.y = CH - .45; meshAt(tube_(x - .5, CH - .05, z, x - .5, CH - .5, z), mBlack, 0, 0, 0); (F.sparks ||= []).push({ x: x - .5, y: CH - .5, z }); }
      F.lamps.push({ x, y: F.y0 + CH - .5, z, kind, mat: m, mesh: tube, room });
    };
    for (let x = -28; x <= 28; x += 8) addLamp(x + 4 * 0, 0, 0);
    addLamp(-34, 0, 0); addLamp(34, 0, 0);
    // 현관 근처 1F 램프는 반드시 켜짐
    SLOTS.forEach((cx, i) => { const rk = `${f}:${cx}`; addLamp(cx - 2, -5.6, 0, rk); addLamp(cx + 2, -5.6, 0, rk); lightSwitch(cx + 1.4, -1.78, Math.PI, rk, lay.names[i]); });
    if (LS) SLOTS.forEach((cx, i) => { const rk = `${f}:${cx}s`, open = ['lobby', 'hall'].includes(LS.types[i]); addLamp(cx - 2, 5.6, 0, rk); addLamp(cx + 2, 5.6, 0, rk); lightSwitch(cx + (open ? -3.25 : -1.4), 1.78, 0, rk, LS.names[i]); });
    if (f === 0) { const a = F.lamps.find(l => Math.abs(l.x) < 5 && Math.abs(l.z) < .1); if (a) { a.kind = 'on'; a.mat = matLampOn; } }

    // 복도 디테일: 배관, 천장 손상, 비상구, 소화기, 낙서
    corridorPipes(-36, 36);
    [-30, -10, 10, 30].forEach(x => emergLight(x + 2.2, 2.85, -1.44));
    ceilingDamage(-34, 34, -1.2, 1.2, 9); SLOTS.forEach(cx => { if (rnd() < .5) ceilingDamage(cx - 3, cx + 3, -8.5, -2.5, 1); });
    exitSign(0, 2.95, -1.43); exitSign(-35, 2.9, 0, Math.PI / 2); exitSign(35, 2.9, 0, -Math.PI / 2);
    extinguisher(-1.6, -1.25); extinguisher(33.5, 1.2);
    graffiti(pick(['다시, 여기서', '나가지 마', '뒤를 봐', '같이 놀자']), SLOTS[2] + 2.5, 1.6, -1.44, 0, 2.6);
    [-26, 6, 22].forEach(x => bin(x, 1.15));
    if (!o.basement || f === 4) { alarmBell(-12.5, -1.43, 0); cctv(-35.6, CH - .05, -1.2, Math.PI * .75); cctv(35.6, CH - .05, -1.2, -Math.PI * .75); }
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
        plane(F.interior, new THREE.MeshBasicMaterial({ color: 0x0a0a0a }), .06, .35, lx + .12, 1.35, -.94);
      }
      lockers.push({ floor: f, x: cx + 3.01, z: -1.2, y: F.y0, dir: { x: 0, z: 1 } });
    });

    // 복도 잡동사니
    for (let k = 0; k < 40; k++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(.28, .2), mDirtPaper);
      m.rotation.set(-Math.PI / 2, 0, rnd() * 6.28); m.position.set(rr(-34, 34), .012, rr(-1.2, 1.3)); F.interior.add(m);
    }
    for (let k = 0; k < 7; k++) add(mWall, rr(.4, 1), .08, rr(.4, 1), rr(-33, 33), 0, rr(-1, 1), { ry: rnd() * 3 });

    // 그래프 노드(유령 경로): 복도 노드는 교실 문 정면(슬롯 x)에 맞춘다.
    const nid = (x, z) => { F.nodes.push({ x, z }); return F.nodes.length - 1; };
    const xs = new Set(SLOTS); for (let x = -34; x <= 34; x += 4) xs.add(x);
    const arr = [...xs].sort((p, q) => p - q);
    const cn = arr.map(x => nid(x, 0));
    for (let i = 0; i < cn.length - 1; i++) F.edges.push([cn[i], cn[i + 1]]);
    SLOTS.forEach(cx => { const r = nid(cx, -5.5); F.edges.push([cn[arr.indexOf(cx)], r]); });
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
    [[14, -8], [-8, -8.4]].forEach(([x, z]) => add(mMetal, 1.2, 1, .8, x, 0, z, { col: true }));
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
  function cooking(cx) {
    const zN = -9.6;
    [-2.4, 0.2, 2.8].forEach(dx => { add(mMetal, 2.2, .9, .8, cx + dx, 0, zN + .5, { col: true }); add(mBlack, .6, .06, .5, cx + dx - .4, .9, zN + .5); });
    add(mMetal, 3.6, .5, 1.0, cx, 2.9, zN + .5);
    add(mMetal, 2.6, .9, 1.2, cx, 0, -6.2, { col: true }); [-.7, .7].forEach(dx => cyl(mMetal, .3, .4, cx + dx, .9, -6.2));
    add(mMetal, .9, 1.8, .7, cx + 3.4, 0, -3.8, { col: true });
    plane(cur.interior, mWin, 1.3, 1.45, cx - 3.05, 1.75, zN + .02);
    addBattery(cx - 3, 0, -3.4); papers(cx, -8, -2.4, 6);
  }
  function craft(cx) {
    const zN = -9.6;
    [-2.2, 2.2].forEach(dx => [-7.2, -4.6].forEach(z => add(mWood, 2.2, .85, 1.0, cx + dx, 0, z, { col: true })));
    shelf3D(cx, zN + .3, 0, 3.6, 2.0, .45, 5, .6);
    [-3.2, 3.2].forEach(dx => { add(mWoodDark, .08, 1.7, .08, cx + dx, 0, -3.2); add(mWhite, .7, .8, .04, cx + dx, .8, -3.2); });
    papers(cx, -8, -2.4, 10);
  }
  function buildCafeteria() {
    const F = areaFloor(7, 140), x0 = -48, x1 = -30, z0 = 8, z1 = 22, H = 4.5, t = .3;
    flat(F.interior, mFloorTile, x0, x1, z0, z1, .01, 3);
    flat(F.interior, mCeil, x0, x1, z0, z1, H - .1, 4, false);
    awall(x0, x0 + t, z0, z1, H); awall(x1 - t, x1, z0, z1, H); awall(x0, x1, z0, z0 + t, H);
    awall(x0, -40, z1 - t, z1, H); awall(-38, x1, z1 - t, z1, H); awall(-40, -38, z1 - t, z1, H, 2.6);
    [-40, -38].forEach(x => add(mWoodDark, .12, 2.6, .4, x, 0, z1 - .15));
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('비상구', '#0a3a1a', '#7dffa0', 30) }), 1.4, .35, -39, 3.0, z1 - t - .02, Math.PI);
    [11, 15, 19].forEach(z => win3D(F.interior, 2.4, 1.6, x0 + t + .02, 2.4, z, Math.PI / 2));
    [-45, -34].forEach(x => plane(F.interior, mWin, 3, 1.6, x, 2.4, z1 - t - .02, Math.PI));
    // 배식대 + 조리실
    add(mMetal, 12, .9, .9, -40.2, 0, 12.9, { col: true }); add(mGlass, 12, .35, .6, -40.2, .9, 12.9);
    for (let k = 0; k < 8; k++) add(mMetal, .3, .04, .25, -45.5 + k * 1.4, .95, 13.3);
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('골고루 먹고 건강하게!', '#2a3a2a', '#d0e0c0', 24), color: 0xaab0a0 }), 3.2, .8, -41, 2.8, z0 + t + .02);
    add(mMetal, 3, .9, 1, -45, 0, 10, { col: true }); add(mMetal, 2.4, .9, 1, -41, 0, 10, { col: true }); add(mMetal, 2.6, .5, 1.2, -41, 3.0, 10);
    cyl(mMetal, .35, .45, -45, .9, 10); cyl(mMetal, .3, .4, -41.5, .9, 10); add(mMetal, 1.2, 1.3, 1.0, -46.9, 0, 11.6, { col: true });
    add(mMetal, .5, 2, 3, -30.75, 0, 10.2, { col: true }); add(mWood, .8, .6, .8, -32.5, 0, 9.2, { col: true }); add(mWood, .8, .6, .8, -32.4, .6, 9.2);
    add(mMetal, .8, 1.1, .6, -30.8, 0, 17, { col: true });
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('오늘의 식단 — 잡곡밥 · 미역국 · 불고기', '#22302a', '#d8e0c8', 18), color: 0xa0a898 }), 2.4, .6, -30.32, 2.3, 19.4, -Math.PI / 2);
    addMedkit(-41, .9, 10.4);
    // 식당 홀
    const tabs = [[-43.5, 16], [-39.2, 16], [-34.9, 16], [-43.5, 19.2], [-34.9, 19.2]];
    tabs.forEach(([x, z]) => benchTable(x, z, 3.2));
    addMedkit(-34.5, .95, 12.9); addNote('n13', -39.2, .8, 16);
    tabs.forEach(([x, z]) => { for (let k = 0; k < 3; k++) if (rnd() < .7) tray(x - 1 + k + rr(-.1, .1), .79, z + (rnd() < .5 ? -.22 : .22), rr(-.3, .3)); });
    addBattery(-34.9, .79, 19.2);
    for (let k = 0; k < 8; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.28, .2), mDirtPaper); m.rotation.set(-Math.PI / 2, 0, rnd() * 6); m.position.set(rr(-46, -32), .02, rr(14, 21)); F.interior.add(m); }
    add(mLockerT, .62, 1.85, .55, -31.3, 0, 8.6 + .28 + 1.3, { col: true }); add(mLockerT, .62, 1.85, .55, -31.3 - .66, 0, 8.6 + .28 + 1.3, { col: true });
    lockers.push({ floor: 7, x: -31.3, z: 10.18, y: 140, dir: { x: 0, z: 1 } });
    [-44, -39, -34].forEach(x => [10, 15, 20].forEach(z => areaLamp(x, z, H - .6, 'cafe'))); lightSwitch(-40.6, z1 - t - .02, Math.PI, 'cafe', '급식실');
    [[-43, 14.6], [-39, 14.6], [-35, 14.6], [-43, 20.4], [-35, 20.4], [-39, 20.6], [-32, 13], [-32, 10.5], [-39.5, 11.6]].forEach(([x, z]) => F.nodes.push({ x, z }));
    F.entrance = 5;
    [[0, 1], [1, 2], [0, 3], [2, 4], [1, 5], [3, 5], [4, 5], [2, 6], [6, 7], [7, 8]].forEach(e => F.edges.push(e));
    F.spawns = [{ x: -43, z: 14.6 }, { x: -32, z: 10.5 }, { x: -43, z: 20.4 }];
    finishGraph(F);
    doors.push({ floor: 7, x: -39, z: 21.2, r: 1.8, label: '급식실 나가기', to: { floor: 0, x: -39, z: 28.1, yaw: Math.PI } });
  }

  /* ---------- 별관 방 가구 ---------- */
  function smart(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    add(mBlack, 3.2, 1.6, .08, cx, .9, zN + .1); const sc = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.4), mBigScreen); sc.position.set(cx, 1.7, zN + .15); cur.interior.add(sc);
    add(mWood, .7, 1.0, .5, cx + 2.8, 0, zN + 1.4, { col: true });
    [[-2.3, -6.6], [2.3, -6.6], [-2.3, -4.2], [2.3, -4.2]].forEach(([dx, z]) => { add(mWood, 2.0, .75, .9, cx + dx, 0, z, { col: true }); [-.6, .6].forEach(k => add(mBlack, .4, .45, .4, cx + dx + k, 0, z + .8)); });
    addNote('n15', cx - 2.3, .77, -6.6); papers(cx, -8, -2.4, 8);
  }
  function fusion(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    [-3.0, 3.0].forEach(dx => [-8.0, -6.4, -4.8, -3.3].forEach(z => { add(mWood, .7, .74, 1.3, cx + dx, 0, z, { col: true }); crt(cx + dx, .74, z - .1); }));
    add(mMetal, 1.0, .9, .8, cx, 0, -8.8, { col: true }); add(mGlass, .9, .6, .7, cx, .9, -8.8); add(mBlack, .3, .1, .3, cx, 1.5, -8.8);
    add(mWhite, .4, .9, .3, cx + .1, 0, -5.2); add(mWhite, .3, .3, .3, cx + .1, .9, -5.2); col(cx - .1, cx + .3, -5.35, -5.05);
    addMedkit(cx, .9, -8.2); papers(cx, -8, -2.4, 8);
  }
  function lang(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    [-2.6, 2.6].forEach(dx => [-8, -6.4, -4.8].forEach(z => { add(mWood, 1.6, .75, .8, cx + dx, 0, z, { col: true }); add(mWoodDark, 1.6, 1.3, .05, cx + dx, 0, z - .45); add(mBlack, .3, .1, .3, cx + dx, .75, z); add(mBlack, .4, .45, .4, cx + dx, 0, z + .75); }));
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), mBigScreen); sc.position.set(cx, 1.9, zN + .15); cur.interior.add(sc);
    addBattery(cx - 3.2, 0, -3.2); papers(cx, -8, -2.4, 7);
  }
  function club(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    add(mWood, 4.2, .75, 1.2, cx, 0, -6.4, { col: true });
    [-1.6, -.5, .6, 1.7].forEach(dx => [-1, 1].forEach(s => add(mBlack, .4, .45, .4, cx + dx, 0, -6.4 + s * 1.0)));
    shelf3D(cx - 3.6, -6.4, Math.PI / 2, 3.2, 2.0, .42, 5, .7);
    add(mFabric, 2.0, .45, .8, cx + 2.4, 0, -3.0, { col: true }); add(mFabric, 2.0, .5, .2, cx + 2.4, .45, -2.7);
    [[cx + 3.3, -9.2], [cx - 3.3, -2.6]].forEach(([x, z]) => cyl(S(null, { color: 0x2a4a22, roughness: 1 }), .22, .7, x, 0, z));
    addNote('n14', cx, .77, -6.4); addMedkit(cx + 3.2, 0, -8.6); papers(cx, -8, -2.4, 9);
  }
  function tech(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    [-2.2, 2.2].forEach(dx => [-7.2, -4.8].forEach(z => { add(mWood, 1.8, .75, .8, cx + dx, 0, z, { col: true }); add(mBlack, .4, .35, .3, cx + dx, .75, z); }));
    add(mMetal, 3.6, 1.8, .45, cx, 0, zN + .3, { col: true });
    add(mWhite, 1.2, .08, .35, cx + 3.0, .85, -3.4); add(mMetal, .06, .85, .06, cx + 2.6, 0, -3.4); add(mMetal, .06, .85, .06, cx + 3.4, 0, -3.4);
    addNote('n16', cx - 2.2, .77, -7.2); addBattery(cx - 3.2, 0, -3.2); papers(cx, -8, -2.4, 8);
  }

  /* ---------- 별관 (8,9,10) ---------- */
  function buildAnnexFloor(k) {
    const spec = ANNEX.floors[k], f = 8 + k, y0 = 180 + k * 40, sl = ANNEX.slots;
    const F = areaFloor(f, y0); F.annex = true; F.stairZone = { x1: -17, x2: -12, z1: -9.3, z2: -2, spawn: { x: -13.8, z: -5.2 } };
    const AS = ANNEX_S[k], X0 = -20.3, X1 = 20.3, Z0 = -9.9, Z1 = MAIN_ZS;
    const woodT = ['music', 'art', 'craft', 'counsel', 'club'];
    flat(F.interior, mFloorTile, X0, X1, -1.75, 1.75, 0);
    sl.forEach((cx, i) => flat(F.interior, ['counselS', 'gallery', 'work'].includes(AS.types[i]) ? mFloorWood : mFloorTile, cx - 4, cx + 4, 1.75, 9.6, 0));
    awall(X0, X1, 9.6, Z1, CH);   // 남쪽 바깥벽
    sl.forEach((cx, i) => flat(F.interior, woodT.includes(spec.types[i]) ? mFloorWood : mFloorTile, cx - 4, cx + 4, -9.6, -1.75, 0));
    ceilHole(F.interior, X0, X1, Z0, Z1, -16);
    awall(X0, X1, Z0, -9.6, CH); awall(X0, -20, -9.6, Z1, CH); awall(20, X1, -9.6, Z1, CH);
    // 복도 남벽: 남쪽 방 문 (현관은 넓은 개구부)
    sl.forEach((cx, i) => {
      if (AS.types[i] === 'lobbyA') { awall(cx - 4, cx - 3, 1.45, 1.75, CH); awall(cx + 3, cx + 4, 1.45, 1.75, CH); awall(cx - 3, cx + 3, 1.45, 1.75, CH, 2.7); [-3, 3].forEach(dx => add(mWoodDark, .12, 2.7, .36, cx + dx, 0, 1.6)); }
      else { awall(cx - 4, cx - 1, 1.45, 1.75, CH); awall(cx + 1, cx + 4, 1.45, 1.75, CH); awall(cx - 1, cx + 1, 1.45, 1.75, CH, 2.4); add(mWoodDark, .1, 2.4, .36, cx - 1.0, 0, 1.6); add(mWoodDark, .1, 2.4, .36, cx + 1.0, 0, 1.6); slidingDoorsS(cx); }
      plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign(AS.names[i], '#1e2a2e', '#d9e4d0', AS.names[i].length > 6 ? 22 : 28), color: 0x9aa59a }), 1.4, .35, cx, 2.62, 1.43, Math.PI);
    });
    [-12, -4, 4, 12].forEach(b => awall(b - .15, b + .15, 1.75, 9.6, CH));
    [-10, 10].forEach(x => emergLight(x + 2.2, 2.85, -1.44));
    corridorPipes(-20, 20); ceilingDamage(-19, 19, -1.2, 1.2, 4); exitSign(-20.2, 2.9, 0, Math.PI / 2);
    sl.forEach((cx, i) => {
      awall(cx - 4, cx - 1, -1.75, -1.45, CH); awall(cx + 1, cx + 4, -1.75, -1.45, CH); awall(cx - 1, cx + 1, -1.75, -1.45, CH, 2.4);
      add(mWoodDark, .1, 2.4, .36, cx - 1.0, 0, -1.6); add(mWoodDark, .1, 2.4, .36, cx + 1.0, 0, -1.6);
      if (spec.types[i] !== 'stair') slidingDoors(cx);
      plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign(spec.names[i], '#1e2a2e', '#d9e4d0', spec.names[i].length > 6 ? 22 : 28), color: 0x9aa59a }), 1.4, .35, cx, 2.62, -1.43);
    });
    [-12, -4, 4, 12].forEach(b => awall(b - .15, b + .15, -9.6, -1.75, CH));
    const fn = { stair: stairRoom, cooking, tech, fusion, counsel, computer, lang, smart, club, music, art, craft, lab };
    sl.forEach((cx, i) => fn[spec.types[i]](cx, spec.names[i]));
    sl.forEach((cx, i) => roomObj(spec.types[i], cx));
    sl.forEach((cx, i) => southRoom(cx, () => { SOUTH_FN[AS.types[i]](cx, AS.names[i]); roomObj(AS.types[i], cx); if (AS.types[i] === 'storeS') lostBox(cx + 1.8, -3.4, k === 1); }));
    [-12, -4, 4, 12].forEach(x => areaLamp(x, 0, CH - .1)); sl.forEach((cx, i) => { const rk = `${f}:${cx}`; areaLamp(cx - 2, -5.6, CH - .1, rk); areaLamp(cx + 2, -5.6, CH - .1, rk); lightSwitch(cx + 1.4, -1.78, Math.PI, rk, spec.names[i]); });
    sl.forEach((cx, i) => { const rk = `${f}:${cx}s`; areaLamp(cx - 2, 5.6, CH - .1, rk); areaLamp(cx + 2, 5.6, CH - .1, rk); lightSwitch(cx + (AS.types[i] === 'lobbyA' ? -3.25 : -1.4), 1.78, 0, rk, AS.names[i]); });
    [2, 3].forEach(i => { const cx = sl[i]; for (let q = 0; q < 3; q++) add(mLockerT, .62, 1.85, .5, cx + 2.35 + q * .66, 0, -1.2, { col: true }); lockers.push({ floor: f, x: cx + 3.01, z: -1.2, y: y0, dir: { x: 0, z: 1 } }); });
    for (let q = 0; q < 24; q++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.28, .2), mDirtPaper); m.rotation.set(-Math.PI / 2, 0, rnd() * 6.28); m.position.set(rr(-19, 19), .012, rr(-1.2, 1.3)); F.interior.add(m); }
    const xs = new Set(sl); for (let x = -20; x <= 20; x += 4) xs.add(x);
    const arr = [...xs].sort((p, q) => p - q), cn = arr.map(x => { F.nodes.push({ x, z: 0 }); return F.nodes.length - 1; });
    for (let q = 0; q < cn.length - 1; q++) F.edges.push([cn[q], cn[q + 1]]);
    sl.forEach(cx => { F.nodes.push({ x: cx, z: -5.5 }); F.edges.push([cn[arr.indexOf(cx)], F.nodes.length - 1]); });
    sl.forEach((cx, i) => { if (AS.types[i] === 'lobbyA') return; F.nodes.push({ x: cx, z: 5.2 }); F.edges.push([cn[arr.indexOf(cx)], F.nodes.length - 1]); });
    F.spawns = [{ x: 18, z: 0 }, { x: -18, z: 0 }, { x: 8, z: -5.5 }];
    finishGraph(F);
    if (k === 0) plane(F.interior, mCork, 2.0, 1.0, -5.5, 1.8, -1.42);
    if (k === 0) doors.push({ floor: 8, x: 0, z: 8.9, r: 1.9, label: '별관 나가기', to: { floor: 0, x: 0, z: -12.3, yaw: Math.PI } });
  }

  /* ---------- 독립 공간: 체육관(5) / 수영장(6) ---------- */
  function areaFloor(f, y0) {
    const F = { f, y0, interior: new THREE.Group(), shell: new THREE.Group(), col: [], walls: [], lamps: [], nodes: [], edges: [], adj: [], spawns: [], area: true };
    F.interior.position.y = y0; scene.add(F.interior); floors.push(F); cur = F; return F;
  }
  const finishGraph = F => { F.adj = F.nodes.map(() => []); F.edges.forEach(([p, q]) => { F.adj[p].push(q); F.adj[q].push(p); }); };
  const awall = (x1, x2, z1, z2, h, y1 = 0, mat = mWall) => { cur.interior.add(boxMesh(x1, x2, y1, h, z1, z2, mat)); if (y1 < 1) col(x1, x2, z1, z2, true); };
  function areaLamp(x, z, y, room = null) {
    const r = rnd(); const kind = room ? (r < .62 ? 'on' : r < .85 ? 'flick' : 'dead') : (r < .3 ? 'on' : r < .6 ? 'flick' : 'dead');
    const m = kind === 'on' ? matLampOn : kind === 'dead' ? matLampDead : flickerMats[(rnd() * 4) | 0];
    const t = dyn(new THREE.Mesh(new THREE.BoxGeometry(1.3, .05, .12), m)); t.position.set(x, y, z); cur.interior.add(t);
    const hs = new THREE.Mesh(new THREE.BoxGeometry(1.4, .04, .22), lampHousing); hs.position.set(x, y + .06, z); cur.interior.add(hs);
    cur.lamps.push({ x, y: cur.y0 + y - .4, z, kind, mat: m, mesh: t, room });
  }
  // 벽 형광등 스위치: 같은 room 키를 가진 형광등을 켜고 끈다 (방에 들어서면 문 옆 벽에 있다)
  function lightSwitch(x, z, ry, room, name = '') {
    const g = dyn(new THREE.Group()); g.position.set(x, 1.3, z); g.rotation.y = ry; cur.interior.add(g);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(.09, .13, .015), mSwitchPlate));
    const key = new THREE.Mesh(new THREE.BoxGeometry(.035, .06, .02), mSwitchKey); key.position.z = .012; g.add(key);
    const led = new THREE.Mesh(new THREE.BoxGeometry(.012, .012, .005), new THREE.MeshBasicMaterial({ color: 0x40ff80 })); led.position.set(0, .05, .009); g.add(led);
    const on = rnd() < .3, fx = Math.sin(ry) * .55, fz = Math.cos(ry) * .55;
    props.push({ kind: 'switch', floor: cur.f, x: x + fx, z: z + fz, px: x, pz: z, y: 1.3, room, on, key, led, name, label: '형광등 스위치' });
  }
  function ball(x, z, mat) { const b = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), mat); b.position.set(x, .12, z); cur.interior.add(b); }

  function buildGym() {
    const F = areaFloor(5, 60), x0 = 28, x1 = 48, z0 = 8, z1 = 30, H = 8, t = .3;
    const mCourt = new THREE.MeshStandardMaterial({ map: T.makeCourt(), roughness: .55 });
    const mBall = S(null, { color: 0xb04a20 }), mGreen = S(null, { color: 0x2a4a3a }), mScore = new THREE.MeshBasicMaterial({ map: T.makeScore() });
    const mBanner = new THREE.MeshStandardMaterial({ map: T.makeBanner(), roughness: .9 });
    const mCurt = S(T.makeCurtain(), { side: THREE.DoubleSide });
    plane(F.interior, mCourt, x1 - x0 - 2 * t, z1 - z0 - 2 * t, 38, .01, 19, 0, -Math.PI / 2);
    flat(F.interior, mCeil, x0, x1, z0, z1, H - .1, 4, false);
    awall(x0, x0 + t, z0, z1, H); awall(x1 - t, x1, z0, z1, H); awall(x0, x1, z0, z0 + t, H);
    awall(x0, 37, z1 - t, z1, H); awall(39, x1, z1 - t, z1, H); awall(37, 39, z1 - t, z1, H, 2.6);
    add(mWoodDark, .12, 2.6, .4, 37, 0, z1 - .15); add(mWoodDark, .12, 2.6, .4, 39, 0, z1 - .15);
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('비상구', '#0a3a1a', '#7dffa0', 30) }), 1.4, .35, 38, 3.0, z1 - t - .02, Math.PI);
    plane(F.interior, mClockM, .9, .9, 43, 5.4, z1 - t - .02, Math.PI);
    plane(F.interior, new THREE.MeshStandardMaterial({ map: T.makeSign('제 32회 서문 체육대회', '#20304a', '#e0d8b0', 22), roughness: .9 }), 3.4, .8, 33, 3.6, z1 - t - .03, Math.PI);
    [11, 15, 19, 23, 27].forEach(z => { win3D(F.interior, 2.4, 1.8, x0 + t + .02, 5.2, z, Math.PI / 2); win3D(F.interior, 2.4, 1.8, x1 - t - .02, 5.2, z, -Math.PI / 2); });
    for (let z = 10; z <= 28; z += 4) add(mMetal, 19.4, .25, .2, 38, H - .6, z);
    // 무대
    add(mWoodDark, 19.4, 1.1, 4.0, 38, 0, z0 + t + 2, { col: true });
    plane(F.interior, mCurt, 6.5, 5.2, 32.5, 3.7, z0 + t + .12); plane(F.interior, mCurt, 6.5, 5.2, 43.5, 3.7, z0 + t + .12); plane(F.interior, mCurt, 19.4, .9, 38, 6.45, z0 + t + .14);
    plane(F.interior, mBanner, 7, 1.75, 38, 7.0, z0 + t + .05);
    // 농구 골대
    [[13.0, 1], [27.2, -1]].forEach(([z, d]) => {
      add(mMetal, .2, 3.2, .2, 38, 0, z - d * .3, { col: true });
      add(S(null, { color: 0x8a8e90, roughness: .4, metalness: .2 }), 1.8, 1.05, .05, 38, 2.5, z); add(mRust, .5, .36, .052, 38, 2.62, z);
      add(mMetal, .12, .12, Math.abs(.3) + .05, 38, 2.9, z - d * .15); const rim = new THREE.Mesh(new THREE.TorusGeometry(.23, .02, 6, 14), mRust); rim.rotation.x = Math.PI / 2; rim.position.set(38, 2.95, z + d * .35); cur.interior.add(rim);
    });
    // 관람석
    for (let k = 0; k < 5; k++) { const w = 4.5 - k * .9; add(mWall, w, (k + 1) * .4, 12, 43.2 + k * .9 + w / 2, 0, 20); }
    for (let k = 0; k < 5; k++) add(mBlue, .5, .08, 11.6, 43.2 + k * .9 + .45, (k + 1) * .4, 20);
    col(43.2, 47.7, 14, 26); add(mRust, .05, 1.0, 12, 43.1, 0, 20);
    // 기록석, 전광판
    add(mWoodDark, 1.2, .8, 3, 29.2, 0, 20, { col: true }); add(mBlack, .45, .45, .45, 30.4, 0, 21.6);
    plane(F.interior, mScore, 3, 1.1, x0 + t + .03, 4.2, 20, Math.PI / 2);
    addKey('gym', 3, 29.2, .8, 20.6); addNote('n9', 29.2, .82, 18.6);
    cur.photoHere = true; addPhoto('p2', 36.2, 1.1, 11.9, .3);
    for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.12, 16, 12), mBall); b.position.set(rr(31, 45), .12, rr(14, 27)); b.rotation.set(rnd() * 3, rnd() * 3, 0); cur.interior.add(b); }
    // 기구
    add(mMetal, 1, .9, .8, 30.4, 0, 14.5, { col: true }); [0, 1, 2].forEach(k => ball(30.1 + k * .3, 14.5, mBall)); ball(30.2, 14.5, mBall);
    add(mBlue, 1.6, .5, .8, 46, 0, 13.4, { col: true }); add(mGreen, 1.5, .4, .8, 46, .5, 13.4);
    add(mWood, .8, .5, .5, 31.5, 0, 25.5, { col: true }); add(mWood, .8, .3, .5, 31.5, .5, 25.5);
    add(mWood, .4, .45, 2.2, 33.5, 0, 28.3, { col: true });
    add(mBlack, .5, .8, .4, x0 + t + .3, 4.8, 12); add(mBlack, .5, .8, .4, x1 - t - .3, 4.8, 12);
    for (let k = 0; k < 6; k++) ball(rr(31, 45), rr(14, 27), mBall);
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(.15, .45, 8), S(null, { color: 0xc05a20 })); c.position.set(rr(32, 44), .22, rr(15, 26)); cur.interior.add(c); }
    const pud = new THREE.MeshStandardMaterial({ color: 0x2a3640, roughness: .12, metalness: 0, transparent: true, opacity: .55, depthWrite: false });
    [[35, 18], [41, 23], [37, 15]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.CircleGeometry(rr(.8, 1.6), 18), pud); p.rotation.x = -Math.PI / 2; p.position.set(x, .03, z); cur.interior.add(p); });
    papers(38, 12, 28, 18, 8);
    // 숨을 곳 (기구함)
    for (let k = 0; k < 3; k++) add(mLockerT, .55, 1.85, .62, x0 + t + .28, 0, 23.3 + k * .66, { col: true });
    lockers.push({ floor: 5, x: x0 + t + .28, z: 23.96, y: 60, dir: { x: 1, z: 0 } });
    addMedkit(46, 1.12 - .0, 12.2 + .0); addBattery(44, 0, 28.4);
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
    // 외벽
    awall(x0, x0 + t, z0, z1, H); awall(x0, x1, z0, z0 + t, H); awall(x0, x1, z1 - t, z1, H);
    awall(x1 - t, x1, z0, 37, H); awall(x1 - t, x1, 39, z1, H); awall(x1 - t, x1, 37, 39, H, 2.6);
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
    const lane = new THREE.MeshBasicMaterial({ color: 0x0a1218 }), LW = (bx1 - bx0) / 6;
    for (let k = 0; k < 6; k++) flat(F.interior, lane, bx0 + (k + .5) * LW - .08, bx0 + (k + .5) * LW + .08, bz0 + 1, bz1 - 1, -D + .01, 1);
    // 가장자리 넘침 홈 (그레이팅)
    [[bx0 - .55, bx0 - .3, bz0 - .55, bz1 + .55], [bx1 + .3, bx1 + .55, bz0 - .55, bz1 + .55]].forEach(([a, b, c, d]) => flat(F.interior, mDrain, a, b, c, d, .015, .3));
    // 고인 물: 탁한 녹색, 낙엽 · 부유물
    const water = new THREE.Mesh(new THREE.PlaneGeometry(bx1 - bx0, bz1 - bz0), new THREE.MeshStandardMaterial({ color: 0x1e3c34, roughness: .04, metalness: .35, transparent: true, opacity: .74, depthWrite: false }));
    water.rotation.x = -Math.PI / 2; water.position.set((bx0 + bx1) / 2, WL, (bz0 + bz1) / 2); F.interior.add(water);
    { const leafG = new THREE.CircleGeometry(.07, 5); leafG.rotateX(-Math.PI / 2); const lm = [];
      for (let k = 0; k < 160; k++) lm.push(MX(rr(bx0 + .1, bx1 - .1), WL + .005, rr(bz0 + .1, bz1 - .1), rnd() * 6));
      const im = inst(F.interior, leafG, S(null, { color: 0xffffff, roughness: .9, side: THREE.DoubleSide }), lm); lm.forEach((_, i) => im.setColorAt(i, new THREE.Color(pick([0x7a6a30, 0x5a4a22, 0x8a5a2a, 0x4a5a2a])))); }
    // 레인 줄: 빨강 · 흰색 · 파랑 부표 (물 위에 뜨고, 일부는 끊어져 가라앉음)
    { const fg = new THREE.SphereGeometry(.07, 8, 6); fg.scale(1, .8, 1.4); const ms = [], cols = [];
      for (let k = 1; k < 6; k++) { const x = bx0 + k * LW, broken = k === 4;
        for (let z = bz0 + .15, i = 0; z < bz1 - .1; z += .19, i++) {
          if (broken && z > 37 && z < 40) continue;
          const sag = broken && z > 40 && z < 41.2 ? -.18 * Math.sin((z - 40) / 1.2 * Math.PI) : 0;
          ms.push(MX(x + Math.sin(z * 1.7 + k) * .03, WL + .03 + sag, z)); const end = z < bz0 + 4.6 || z > bz1 - 4.6;
          cols.push(end ? (i % 2 ? 0xc02020 : 0xe8e8e0) : (i % 4 < 2 ? 0x2048a0 : 0xe8e8e0)); } }
      const im = inst(F.interior, fg, S(null, { roughness: .45 }), ms); cols.forEach((c, i) => im.setColorAt(i, new THREE.Color(c))); }
    // 출발대 1~6 (남쪽 끝)
    for (let k = 0; k < 6; k++) { const x = bx0 + (k + .5) * LW;
      meshAt(merge([bx(.55, .7, .5, 0, .35, 0), bx(.6, .06, .62, 0, .73, .04), tube(.012, -.22, .76, .3, -.22, .9, .32), tube(.012, .22, .76, .3, .22, .9, .32)]), mWhiteP, x, 0, bz0 - .27);
      plane(F.interior, S(T.makeNumber(k + 1)), .34, .34, x, .42, bz0 - .53, Math.PI); col(x - .28, x + .28, bz0 - .52, bz0); }
    // 풀 사다리 (스테인리스)
    [[bx0 + .9, bz1, 1], [bx1 - .9, bz1, 1], [bx0 + .9, bz0, -1], [bx1 - .9, bz0, -1]].forEach(([x, z, s]) => {
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
    // 서쪽 관람석 (계단식 테라스 + 난간 + 나무 벤치)
    for (let k = 0; k < 3; k++) { add(mStep, 2.4 - k * .8, .45 * (k + 1), 13, x0 + t + (2.4 - k * .8) / 2, 0, 40); add(mWood, .35, .05, 12.6, x0 + t + 2.4 - k * .8 - .25, .45 * (k + 1) + .02, 40); }
    col(x0, x0 + 2.75, 33.5, 46.5);
    meshAt(merge([tube(.025, x0 + 2.85, 1.0, 33.5, x0 + 2.85, 1.0, 46.5), ...[33.5, 36, 38.5, 41, 43.5, 46.5].map(z => tube(.02, x0 + 2.85, 0, z, x0 + 2.85, 1.0, z)), tube(.018, x0 + 2.85, .5, 33.5, x0 + 2.85, .5, 46.5)]), mRust, 0, 0, 0);
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
    crt(-35.3, .94, 34.2); plane(F.interior, mDirtPaper, .3, .22, -35.4, .955, 35.0, 0, -Math.PI / 2); deskChair(-34.75, 34.9, Math.PI / 2);
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
    { const sx = -48.3, sz = 48.6; shelf3D(sx, sz, Math.PI / 2, 2.2, 1.9, .5, 4, 0); col(sx - .3, sx + .3, sz - 1.1, sz + 1.1);
      for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) add(S(null, { color: [0x2a60c0, 0xd8b020, 0xc02828][(k + r) % 3], roughness: .55 }), .05, .38, .28, sx + .05, .08 + r * .47, sz - .8 + k * .52, { ry: Math.PI / 2 + rr(-.2, .2) });
      const tubeM = S(T.makeSign('GUARD', '#c01818', '#f0e8e0', 40), { roughness: .5 }); [[-47.6, 47.3], [-47.4, 49.9]].forEach(([x, z]) => add(tubeM, .9, .16, .22, x, .0, z, { ry: rr(-.4, .4) })); }

    /* ----- 장비창고 / 기계실 (북쪽, z 50~58) ----- */
    awall(x0, -41, zh, zh + t, H); awall(-39, x1, zh, zh + t, H); awall(-41, -39, zh, zh + t, H, 2.5);
    [-41, -39].forEach(x => add(mWoodDark, .12, 2.5, .4, x, 0, zh + .15));
    sign('기계실 · 장비창고', '#3a2a1a', '#e0d0b0', 26, 1.6, .4, -40, 2.85, zh - .02, Math.PI);
    awall(-43.5, -43.2, zh + t, 53, H); awall(-43.5, -43.2, 54.6, z1 - t, H); awall(-43.5, -43.2, 53, 54.6, H, 2.4);   // 창고 | 기계실 칸막이 (가운데 출입구)
    flat(F.interior, mDrain, -41.2, -38.8, 53.8, 54.2, .015, .4);   // 바닥 트렌치
    // 장비창고 (서쪽): 철제 선반 · 레인 줄 릴 · 킥보드 · 작업대 · 공구함 · 청소 카트
    shelf3D(x0 + t + .3, 54, Math.PI / 2, 3.6, 2.2, .55, 4, 0); col(x0 + t, x0 + t + .6, 52.2, 55.8);
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
    [[-40.9, 56.3], [-36.2, 52.6]].forEach(([x, z]) => {
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
    for (let k = 0; k < 6; k++) add(mBlueL, .62, 1.85, .55, x0 + t + .3, 0, 21.2 + k * .66, { col: true, ry: Math.PI / 2 });
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
    doors.push({ floor: 6, x: -35.2, z: 38, r: 1.8, label: '수영장 나가기', to: { floor: 0, x: -32.2, z: 39, yaw: -Math.PI / 2 } });
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

  // 지면
  const groundMat = S(T.makeGround()); flat(OUT, groundMat, -300, 300, -250, 300, -.02, 8);
  const dirtMat = PB('dirt', () => T.pbrDirt(512)); flat(OUT, dirtMat, -34, 34, 16, 60, 0, 6);
  // 우레탄 트랙 (직선 2 + 반원 2) · 흰 레인 선
  { const trM = PB('track', () => T.pbrTrack(512)); trM.polygonOffset = true; trM.polygonOffsetFactor = -1;
    const lineM = new THREE.MeshStandardMaterial({ color: 0xc8c4b8, roughness: .8, transparent: true, opacity: .75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const CZ = 38, R0 = 13.2, R1 = 17.2, SX = 15, Y = .013;
    const uvPlanar = (geo, sc) => { const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / sc, p.getY(i) / sc); return geo; };
    [-1, 1].forEach(sd => {
      const st = new THREE.Mesh(uvPlanar(new THREE.PlaneGeometry(SX * 2, R1 - R0), 4), trM); st.rotation.x = -Math.PI / 2; st.position.set(0, Y, CZ + sd * (R0 + R1) / 2); OUT.add(st);
      const ring = new THREE.Mesh(uvPlanar(new THREE.RingGeometry(R0, R1, 48, 1, sd > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI), 4), trM); ring.rotation.x = -Math.PI / 2; ring.position.set(sd * SX, Y, CZ); OUT.add(ring);
      [R0, (R0 + R1) / 2 - .9, (R0 + R1) / 2 + .9, R1].forEach(r => {
        const l = new THREE.Mesh(new THREE.PlaneGeometry(SX * 2, .07), lineM); l.rotation.x = -Math.PI / 2; l.position.set(0, Y + .004, CZ + sd * r); OUT.add(l);
        const c = new THREE.Mesh(new THREE.RingGeometry(r - .035, r + .035, 48, 1, sd > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI), lineM); c.rotation.x = -Math.PI / 2; c.position.set(sd * SX, Y + .004, CZ); OUT.add(c);
      });
    });
    for (let k = 0; k < 5; k++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(.07, R1 - R0), lineM); l.rotation.x = -Math.PI / 2; l.position.set(-8 + k * .9, Y + .004, CZ + (R0 + R1) / 2); OUT.add(l); }   // 출발선
  }
  const pave = S(T.makePaving()); flat(OUT, pave, -3.2, 3.2, MAIN_ZS, 69.5, .01, 4); flat(OUT, pave, -16, 16, MAIN_ZS, 11, .01, 4);
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
    [[-33, 6.5], [-27.5, 4], [-18, 7.5], [-9, 3.5], [11, 5], [21, 8], [30.5, 6], [35, 4]].forEach(([x, h]) => ivy(x, MAIN_ZS + .05, rr(2.2, 3.4), h, 0));
    [[-40, 3], [-28, 2.6], [-16, 2.8], [12, 2.7], [24, 2.6], [38, 2.9]].forEach(([x, h]) => ivy(x, GATE_Z - .3, rr(2.5, 3.5), h, Math.PI));
    [[-49.7, 10, 3], [-49.7, 50, 2.8], [-49.7, -10, 2.7]].forEach(([x, z, h]) => ivy(x, z, 3, h, Math.PI / 2));
  }

  // 외곽 담장
  const fenceH = 2.8;
  outWall(-50, -4.5, GATE_Z - .25, GATE_Z + .25, fenceH, mFence);
  outWall(4.5, 50, GATE_Z - .25, GATE_Z + .25, fenceH, mFence);
  outWall(-50.25, -49.75, -26, 28.5, fenceH, mFence); outWall(-50.25, -49.75, 35.5, GATE_Z, fenceH, mFence);
  const brick = mBrick;
  [28.5, 35.5].forEach(z => { OUT.add(boxMesh(-50.6, -49.4, 0, 3.2, z - .6, z + .6, brick)); col(-50.6, -49.4, z - .6, z + .6, true); });
  OUT.add(boxMesh(-50.2, -49.8, 0, 2.2, 29.1, 34.9, mRust)); col(-50.3, -49.7, 29.1, 34.9, true);
  for (let k = 0; k < 14; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(.06, 2.3, .06), mRust); b.position.set(-50, 1.2, 29.4 + k * .4); OUT.add(b); }
  plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('서  문', '#1c1812', '#d8d0b0', 40), color: 0xa09a88 }), 1.0, .5, -49.38, 2.6, 28.5, Math.PI / 2);
  OUT.add(boxMesh(-49.5, -46.5, 0, 2.8, 37, 40.5, brick)); col(-49.5, -46.5, 37, 40.5, true);
  plane(OUT, mWin, 2.2, 1.2, -46.48, 1.7, 38.7, Math.PI / 2);
  doors.push({ floor: 0, x: -48.4, z: 32.2, r: 2.2, label: '서문 (쇠사슬)', win: true, locked: '녹슨 쇠사슬로 단단히 묶여 있다. 열쇠 조각을 모두 모으면 풀릴지도 모른다.' });
  // 서문 밖: 도로 / 인도 / 주차장 / 통학버스
  const mYellow = new THREE.MeshBasicMaterial({ color: 0x9a8a30 }), mWhiteL = new THREE.MeshBasicMaterial({ color: 0xaaa89c });
  flat(OUT, S(T.makeAsphalt()), -64, -52, -40, 110, .004, 8);
  flat(OUT, S(T.makePaving()), -52, -50.3, -30, 80, .006, 3); flat(OUT, S(T.makePaving()), -67, -64, -30, 80, .006, 3);
  for (let z = -30; z < 100; z += 5) flat(OUT, mYellow, -58.15, -57.85, z, z + 2.5, .02, 1);
  for (let k = 0; k < 8; k++) flat(OUT, mWhiteL, -63.4 + k * 1.2, -62.8 + k * 1.2, 26, 38, .02, 1);
  flat(OUT, S(T.makeAsphalt()), -92, -67, 4, 34, .004, 8);
  for (let k = 0; k <= 8; k++) flat(OUT, mWhiteL, -90.5 + k * 2.7, -90.4 + k * 2.7, 6, 14, .02, 1);
  const mCar = c => S(T.makeMetal(c), { roughness: .7, metalness: .3 });
  const car = (x, z, ry, c) => {
    const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, .7, 4.3), mCar(c)); b.position.y = .75; g.add(b);
    const t = new THREE.Mesh(new THREE.BoxGeometry(1.7, .6, 2.3), mBlack); t.position.set(0, 1.4, -.1); g.add(t);
    [[-.9, 1.4], [.9, 1.4], [-.9, -1.4], [.9, -1.4]].forEach(([wx, wz]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .25, 10), mBlack); w.rotation.z = Math.PI / 2; w.position.set(wx, .38, wz); g.add(w); });
    g.position.set(x, 0, z); g.rotation.y = ry; OUT.add(g);
  };
  car(-72, 12, 0, [90, 40, 40]); car(-77, 11, .05, [60, 70, 90]); car(-82, 13, -.04, [100, 100, 96]);
  const bus = new THREE.Group(); const bb = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 10.5), mCar([170, 134, 30])); bb.position.y = 1.7; bus.add(bb);
  for (let k = 0; k < 6; k++) [-1, 1].forEach(sd => { const w = new THREE.Mesh(new THREE.BoxGeometry(.05, .8, 1.2), mBlack); w.position.set(sd * 1.31, 2.1, -4.2 + k * 1.65); bus.add(w); });
  [[-1.3, 3.2], [1.3, 3.2], [-1.3, -3.2], [1.3, -3.2]].forEach(([wx, wz]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .3, 12), mBlack); w.rotation.z = Math.PI / 2; w.position.set(wx, .5, wz); bus.add(w); });
  bus.position.set(-61.3, 0, 53); OUT.add(bus);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, c]) => { const p = new THREE.Mesh(new THREE.BoxGeometry(.1, 2.6, .1), mMetal); p.position.set(-65.5 + a * 1.5, 1.3, 46 + c * .8); OUT.add(p); });
  const shRoof = new THREE.Mesh(new THREE.BoxGeometry(3.4, .15, 2.0), mMetal); shRoof.position.set(-65.5, 2.65, 46); OUT.add(shRoof);
  const shBench = new THREE.Mesh(new THREE.BoxGeometry(2.4, .12, .5), mWood); shBench.position.set(-65.5, .5, 46.6); OUT.add(shBench);
  for (let z = 14; z <= 66; z += 13) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 5, 6), mMetal); p.position.set(-52.6, 2.5, z); OUT.add(p); const h = new THREE.Mesh(new THREE.BoxGeometry(1.2, .1, .3), mMetal); h.position.set(-53.1, 5, z); OUT.add(h); }
  for (let k = 0; k < 6; k++) { const r = new THREE.Mesh(new THREE.BoxGeometry(.05, .9, .5), mMetal); r.position.set(-51.4, .45, 22 + k * .6); OUT.add(r); }
  // 별관(특별교실동) 외관
  OUT.add(boxMesh(-20, 20, 0, 12.4, -25, -13.5, mBrick, 2.5)); col(-20, 20, -25, -13.5, true);
  OUT.add(boxMesh(-20.4, 20.4, 12.4, 12.7, -25.4, -13.1, mFacade, 3));
  [1.8, 5.8, 9.8].forEach((y, r) => { for (let x = -18; x <= 18; x += 4) { if (r === 0 && Math.abs(x) < 3) continue; plane(OUT, mWin, 2.4, 1.6, x, y, -13.47, 0); } });
  // 별관 북 · 동 · 서쪽 창 (예전에는 남쪽 면에만 창이 있었다)
  [1.8, 5.8, 9.8].forEach(y => { for (let x = -18; x <= 18; x += 4) plane(OUT, mWin, 2.4, 1.6, x, y, -25.03, Math.PI); [-22, -17].forEach(z => { plane(OUT, mWin, 1.8, 1.6, -20.03, y, z, -Math.PI / 2); plane(OUT, mWin, 1.8, 1.6, 20.03, y, z, Math.PI / 2); }); });
  // 별관 옥상 파라펫
  OUT.add(boxMesh(-20.4, 20.4, 12.7, 13.6, -25.4, -25.1, mFacade, 3), boxMesh(-20.4, 20.4, 12.7, 13.6, -13.4, -13.1, mFacade, 3), boxMesh(-20.4, -20.1, 12.7, 13.6, -25.4, -13.1, mFacade, 3), boxMesh(20.1, 20.4, 12.7, 13.6, -25.4, -13.1, mFacade, 3));
  // 본관-별관 연결 통로: 바닥 · 지붕 · 기둥 · 유리 벽 (동쪽에 바깥 출입문), 1층 위로는 2 · 3층 구름다리 외관
  {
    const W = WALKWAY, g = [], gl = [];
    g.push(bx(W.x2 - W.x1, .12, W.z2 - W.z1, (W.x1 + W.x2) / 2, .06, (W.z1 + W.z2) / 2, 2));
    g.push(bx(W.x2 - W.x1 + .4, .3, W.z2 - W.z1, (W.x1 + W.x2) / 2, 3.25, (W.z1 + W.z2) / 2, 2));
    [W.x1, W.x2].forEach(x => [W.z1 + .2, (W.z1 + W.z2) / 2, W.z2 - .2].forEach(z => g.push(bx(.2, 3.2, .2, x, 1.6, z, 2))));
    for (let f = 1; f < 3; f++) { const y = f * FH; g.push(bx(W.x2 - W.x1, .3, W.z2 - W.z1, (W.x1 + W.x2) / 2, y + 3.25, (W.z1 + W.z2) / 2, 2), bx(W.x2 - W.x1, .9, .2, (W.x1 + W.x2) / 2, y + .45, W.z1 + .1, 2)); [W.x1, W.x2].forEach(x => g.push(bx(.2, 3.2, .2, x, y + 1.6, W.z1 + .2, 2), bx(.2, 3.2, .2, x, y + 1.6, W.z2 - .2, 2), bx(.12, 1.0, W.z2 - W.z1, x, y + .5, (W.z1 + W.z2) / 2, 2))); [W.x1, W.x2].forEach(x => gl.push([x, y + 2.1, 1.9])); }
    const fm = new THREE.Mesh(merge(g), mFacade); OUT.add(fm);
    const mGl = new THREE.MeshStandardMaterial({ color: 0x8aa0a8, roughness: .2, metalness: .1, transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false });
    // 서쪽 유리벽 (전체) · 동쪽 유리벽 (가운데 출입문 비움)
    plane(OUT, mGl, W.z2 - W.z1, 2.9, W.x1, 1.6, (W.z1 + W.z2) / 2, Math.PI / 2);
    const dz1 = (W.z1 + W.z2) / 2 - .9, dz2 = (W.z1 + W.z2) / 2 + .9;
    plane(OUT, mGl, dz1 - W.z1, 2.9, W.x2, 1.6, (W.z1 + dz1) / 2, -Math.PI / 2); plane(OUT, mGl, W.z2 - dz2, 2.9, W.x2, 1.6, (dz2 + W.z2) / 2, -Math.PI / 2);
    gl.forEach(([x, y, h]) => plane(OUT, mGl, W.z2 - W.z1, h, x, y, (W.z1 + W.z2) / 2, x < 0 ? Math.PI / 2 : -Math.PI / 2));
    col(W.x1 - .1, W.x1 + .1, W.z1, W.z2, true); col(W.x2 - .1, W.x2 + .1, W.z1, dz1, true); col(W.x2 - .1, W.x2 + .1, dz2, W.z2, true);
    plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('본관 ⇄ 별관 연결 통로', '#1e2a2e', '#d9e4d0', 22), color: 0x9aa59a }), 2.2, .4, W.x2 + .12, 2.75, (W.z1 + W.z2) / 2, Math.PI / 2);
    // 통로 천장등 (지붕 아래) · 바닥 매트
    for (let z = W.z1 + .9; z < W.z2; z += 1.8) { const l = new THREE.Mesh(new THREE.BoxGeometry(1.2, .05, .12), matLampOn); l.position.set((W.x1 + W.x2) / 2, 3.08, z); OUT.add(l); }
    // 본관 쪽 출입문 (계단실 북벽) · 별관 쪽은 기존 현관
    plane(OUT, mDoor, 1.3, 2.3, 1.8, 1.15, -9.92, Math.PI);
    doors.push({ floor: 0, x: 1.8, z: -10.5, r: 1.3, label: '본관 들어가기 (계단실)', to: { floor: 0, x: 1.8, z: -8.7, yaw: Math.PI } });
  }
  plane(OUT, mDoor, 1.8, 2.4, 0, 1.2, -13.47, 0);
  plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('별관 (특별교실동)', '#1e2a2e', '#d9e4d0', 26), color: 0x9aa59a }), 3.4, .85, 0, 3.6, -13.46, 0);
  doors.push({ floor: 0, x: 0, z: -12.4, r: 2.0, label: '별관 들어가기', to: { floor: 8, x: 0, z: 8.3, yaw: 0 } });

  // 본관 외관 디테일: 기둥(필라스터) · 창 상인방 · 기단 · 처마 코니스 · 파라펫 · 우수관 · 북/측면 창
  {
    const fac = [], dark = [], pipes = [], X0 = -36.3, X1 = 36.3, ZS = MAIN_ZS, ZN = -9.9, ZL = MAIN_ZS + 9.9, ZC = (MAIN_ZS - 9.9) / 2, TOP = 3 * FH + .4;
    for (let x = -32; x <= 32; x += 4) { const y0 = Math.abs(x) < 3.5 ? 3.25 : 0; fac.push(bx(.46, TOP - y0, .26, x, (TOP + y0) / 2, ZS + .13, 3)); }
    [X0 + .3, X1 - .3].forEach(x => fac.push(bx(.8, TOP, .32, x, TOP / 2, ZS + .16, 3), bx(.32, TOP, .8, x < 0 ? X0 - .16 : X1 + .16, TOP / 2, ZS - .3, 3)));
    // 남면 창 상인방 (남쪽 방 창: 방 중심 ±3.05)
    for (let f = 0; f < 3; f++) SLOTS.forEach(cx => [cx - 3.05, cx + 3.05].forEach(x => fac.push(bx(1.7, .16, .2, x, f * FH + 2.62, ZS + .1, 3))));
    for (let f = 0; f < 3; f++) for (let x = -34; x <= 34; x += 4) {
      const y = f * FH;
      // 북면 창 (실내 북벽 바깥에 붙인 유리 · 창틀 · 창턱)
      plane(OUT, mWin, 2.2, 1.5, x, y + 1.75, ZN - .012, Math.PI);
      fac.push(bx(2.6, .1, .22, x, y + .95, ZN - .11, 3), bx(2.6, .14, .14, x, y + 2.57, ZN - .07, 3));
      dark.push(bx(.06, 1.5, .08, x - 1.1, y + 1.75, ZN - .04), bx(.06, 1.5, .08, x + 1.1, y + 1.75, ZN - .04), bx(.05, 1.5, .08, x, y + 1.75, ZN - .04), bx(2.2, .05, .08, x, y + 1.75, ZN - .04));
    }
    // 측면 창 (계단 끝 벽)
    for (let f = 0; f < 3; f++) [-7, -3, 3, 7].forEach(z => [[X0 - .012, -Math.PI / 2], [X1 + .012, Math.PI / 2]].forEach(([x, ry]) => {
      plane(OUT, mWin, 1.6, 1.5, x, f * FH + 1.75, z, ry); fac.push(bx(.2, .1, 2.0, x + Math.sign(x) * .1, f * FH + .95, z, 3));
    }));
    // 층간 띠 (북면) · 기단 · 코니스 · 파라펫 갓돌
    for (let f = 1; f < 3; f++) fac.push(bx(X1 - X0 + .4, .28, .18, 0, f * FH, ZN - .09, 3));
    fac.push(bx(X1 - X0 + .6, .55, .16, 0, .27, ZN - .08, 3), bx(.16, .55, ZL + .25, X0 - .08, .27, ZC, 3), bx(.16, .55, ZL + .25, X1 + .08, .27, ZC, 3));
    fac.push(bx(X1 - X0 + 1.0, .22, .5, 0, TOP + .05, ZS + .25, 3), bx(X1 - X0 + 1.0, .22, .5, 0, TOP + .05, ZN - .25, 3));
    fac.push(bx(.5, .22, ZL + .95, X0 - .25, TOP + .05, ZC, 3), bx(.5, .22, ZL + .95, X1 + .25, TOP + .05, ZC, 3));
    // 파라펫 바깥 면 (옥상 층이 안 보일 때도 외부에서 보이도록)
    fac.push(bx(X1 - X0 + .8, 1.15, .1, 0, TOP + .58, ZN - .35, 3), bx(X1 - X0 + .8, 1.15, .1, 0, TOP + .58, ZS + .35, 3), bx(.1, 1.15, ZL + .55, X0 - .35, TOP + .58, ZC, 3), bx(.1, 1.15, ZL + .55, X1 + .35, TOP + .58, ZC, 3));
    for (let x = -32; x <= 32; x += 4) if (Math.abs(x) >= 3.5) col(x - .23, x + .23, ZS, ZS + .26);
    fac.push(bx(X1 - X0 + .8, .12, .45, 0, TOP + 1.2, ZN - .2, 3), bx(.45, .12, ZL + .75, X0 - .2, TOP + 1.2, ZC, 3), bx(.45, .12, ZL + .75, X1 + .2, TOP + 1.2, ZC, 3), bx(X1 - X0 + .8, .12, .45, 0, TOP + 1.2, ZS + .2, 3));
    // 우수관 (홈통 + 이음쇠)
    [[-24.1, ZS + .3], [24.1, ZS + .3], [-16, ZN - .2], [16, ZN - .2]].forEach(([x, z]) => {
      pipes.push(tube(.06, x, .05, z, x, TOP + .1, z));
      for (let y = 1; y < TOP; y += 2) pipes.push(new THREE.CylinderGeometry(.085, .085, .08, 8).translate(x, y, z));
      pipes.push(tube(.06, x, .05, z, x, .05, z + (z > 0 ? .4 : -.4)));
    });
    const fm = new THREE.Mesh(merge(fac), mFacade); OUT.add(fm);
    OUT.add(new THREE.Mesh(merge(dark), mFrame), new THREE.Mesh(merge(pipes), mRust));
    // 별관 외관 보강: 창틀 · 층간 띠 · 코니스
    const af = [];
    [1.8, 5.8, 9.8].forEach((y, r) => { for (let x = -18; x <= 18; x += 4) { if (r === 0 && Math.abs(x) < 3) continue; af.push(bx(2.7, .1, .2, x, y - .85, -13.4, 3), bx(2.7, .14, .14, x, y + .86, -13.43, 3)); } });
    [4, 8].forEach(y => af.push(bx(40.4, .26, .16, 0, y, -13.42, 3)));
    for (let x = -20; x <= 20; x += 8) af.push(bx(.4, 12.4, .2, x, 6.2, -13.4, 3));
    af.push(bx(2.6, .2, 1.2, 0, 2.75, -12.9, 3), bx(.18, 2.75, .18, -1.15, 1.37, -12.45, 3), bx(.18, 2.75, .18, 1.15, 1.37, -12.45, 3));
    OUT.add(new THREE.Mesh(merge(af), mFacade));
    // 체육관 · 수영장 · 급식실 외관: 기단 · 수직 리브 · 처마 홈통
    const gf = [];
    for (let z = 13.5; z <= 33.5; z += 4) { gf.push(bx(.24, 8, .3, 27.88, 4, z, 3), bx(.24, 8, .3, 48.12, 4, z, 3)); }
    [12.5, 34.5].forEach(z => gf.push(bx(20.4, .5, .2, 38, .25, z + (z > 20 ? .1 : -.1), 3)));
    gf.push(bx(.2, .5, 22, 27.9, .25, 23.5, 3), bx(.2, .5, 22, 48.1, .25, 23.5, 3));
    [15.5, 19.5, 23.5, 27.5, 31.5].forEach(z => { gf.push(bx(.16, .1, 2.7, 27.9, 4.2, z, 3), bx(.16, .1, 2.7, 48.1, 4.2, z, 3)); });
    gf.push(bx(18.4, .4, .2, -39, .2, 26.6, 3), bx(.2, .4, 14, -29.9, .2, 19.5, 3));
    OUT.add(new THREE.Mesh(merge(gf), mFacade));
    [15.5, 19.5, 23.5, 27.5, 31.5].forEach(z => { plane(OUT, mWin, 2.4, 1.8, 27.98, 5.2, z, -Math.PI / 2); plane(OUT, mWin, 2.4, 1.8, 48.02, 5.2, z, Math.PI / 2); });
    [15.5, 19.5, 23.5].forEach(z => plane(OUT, mWin, 2.4, 1.6, -48.02, 2.4, z, -Math.PI / 2));
  }
  outWall(49.75, 50.25, -26, GATE_Z, fenceH, mFence);
  outWall(-50, 50, -26.25, -25.75, fenceH, mFence);
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
  [-1, 1].forEach(sd => { const r = new THREE.Mesh(new THREE.BoxGeometry(10.6, .3, 23), mRoofRed); r.position.set(38 + sd * 5, 8.9, 23.5); r.rotation.z = -sd * .2; OUT.add(r); });
  const poolB = boxMesh(-48, -34, 0, 6.4, 27, 51, mBrick, 2.5); OUT.add(poolB); col(-48, -34, 27, 51, true);
  const poolRoof = new THREE.Mesh(new THREE.BoxGeometry(14.6, .4, 24.6), mRoofRed); poolRoof.position.set(-41, 6.6, 39); OUT.add(poolRoof);
  [30, 35, 44, 48].forEach(z => plane(OUT, mWin, 2.4, 1.8, -33.98, 3.6, z, Math.PI / 2));
  plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('수 영 장', '#1e2a2e', '#d9e4d0', 34), color: 0x9aa59a }), 2.2, .55, -33.97, 3.3, 39, Math.PI / 2);
  plane(OUT, mDoor, 1.8, 2.4, -33.97, 1.2, 39, Math.PI / 2);
  plane(OUT, mDoor, 1.8, 2.4, 38, 1.2, 34.53, 0);
  plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('체 육 관', '#1e2a2e', '#d9e4d0', 34), color: 0x9aa59a }), 2.2, .55, 38, 3.3, 34.54, 0);
  const cafe = boxMesh(-48, -30, 0, 4.5, 12.5, 26.5, mFacade, 3); OUT.add(cafe); col(-48, -30, 12.5, 26.5, true);
  const cafeRoof = new THREE.Mesh(new THREE.BoxGeometry(19, .4, 15), mRoofRed); cafeRoof.position.set(-39, 4.7, 19.5); cafeRoof.rotation.z = .08; OUT.add(cafeRoof);
  doors.push({ floor: 0, x: 38, z: 35.9, r: 2.0, label: '체육관 들어가기', to: { floor: 5, x: 38, z: 28.1, yaw: 0 } });
  doors.push({ floor: 0, x: -32.7, z: 39, r: 2.0, label: '수영장 들어가기', to: { floor: 6, x: -35.5, z: 38, yaw: Math.PI / 2 } });
  doors.push({ floor: 0, x: -39, z: 27.9, r: 2.0, label: '급식실 들어가기', to: { floor: 7, x: -39, z: 20.5, yaw: 0 } });
  plane(OUT, mDoor, 1.8, 2.4, -39, 1.2, 26.53, 0);
  plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('급 식 실', '#1e2a2e', '#d9e4d0', 34), color: 0x9aa59a }), 2.2, .55, -39, 3.3, 26.54, 0);
  [[33, 12.48], [38, 12.48], [43, 12.48]].forEach(([x, z]) => plane(OUT, mWin, 3, 1.6, x, 5.2, z, Math.PI));
  [[-44, 12.48], [-39, 12.48], [-34, 12.48]].forEach(([x, z]) => plane(OUT, mWin, 3, 1.6, x, 2.4, z, Math.PI));

  // 축구 골대
  [[16], [57]].forEach(([z]) => { const m = mMetal; [-3.6, 3.6].forEach(x => addO(m, .1, 2.4, .1, x, 0, z)); addO(m, 7.3, .1, .1, 0, 2.4, z); });

  // 나무: 건물/길을 피해서 배치, 울퉁불퉁한 수관 + 개체별 색 변화
  const BLOCK = [[-37.5, 37.5, -11, 11.5], [-21.5, 21.5, -26, -12], [26.5, 49.5, 11, 36], [-49.5, -28.5, 11, 28], [-49.5, -32.5, 25.5, 52.5], [-51, -45.5, 27, 42], [-5, 5, 60, 72], [-17, 17, 1.5, 12]];
  const blocked = (x, z, m = 0) => BLOCK.some(([a, b2, c, d]) => x > a - m && x < b2 + m && z > c - m && z < d + m);
  const trunkG = merge([new THREE.CylinderGeometry(.16, .3, 3.4, 7).translate(0, 1.7, 0), tube(.07, 0, 2.2, 0, .9, 3.4, .3), tube(.06, 0, 2.6, 0, -.7, 3.7, -.4)]);
  const lump = (r, x, y, z) => {
    const g = new THREE.IcosahedronGeometry(r, 2), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = Math.sin(p.getX(i) * 12.9 + p.getY(i) * 78.2 + p.getZ(i) * 37.7) * 43758.5; const n = 1 + (k - Math.floor(k) - .5) * .4; p.setXYZ(i, p.getX(i) * n, p.getY(i) * n * .85, p.getZ(i) * n); }
    g.translate(x, y, z); const idx = []; for (let i = 0; i < p.count; i++) idx.push(i); g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  const crownG = merge([lump(1.7, 0, 4.3, 0), lump(1.3, .9, 5.2, .4), lump(1.2, -.8, 4.9, -.5), lump(.9, .1, 5.9, -.1)]);
  const treeM = [], tpos = [[-8, 64.5, true, 1], [9.5, 63.8, true, 1], [-15, 66.5, true, 1], [16, 66, true, 1], [-11, 58.5, true, 1], [12.5, 59, true, 1]];   // 정문 옆 벚나무
  for (let i = 0; i < 260 && tpos.length < 120; i++) {
    let x, z; const inside = tpos.length < 54;
    if (inside) {
      const side = (rnd() * 4) | 0;
      if (side === 0) { x = rr(-48, 48); z = rr(65.5, 68.5); } else if (side === 1) { x = rr(-48.5, -44); z = rr(-24, 66); } else if (side === 2) { x = rr(44, 48.5); z = rr(-24, 66); } else { x = rr(-48, 48); z = rr(-24, -21); }
      if (blocked(x, z, 2.5) || (z > 10.5 && z < 14.5)) continue;
    } else {
      const a = rnd() * 6.28, r = rr(62, 135); x = Math.cos(a) * r * 1.3; z = 20 + Math.sin(a) * r * .95;
      if ((Math.abs(x) < 56 && z > -32 && z < 90) || (z > 70 && z < 85) || (x < -50 && x > -95 && z > -35 && z < 110)) continue;
    }
    tpos.push([x, z, inside]);
  }
  tpos.forEach(([x, z, inside]) => { const s2 = rr(.8, 1.4); _o.position.set(x, 0, z); _o.rotation.set(0, rnd() * 6, 0); _o.scale.set(s2, s2 * rr(.9, 1.25), s2); _o.updateMatrix(); treeM.push(_o.matrix.clone()); if (inside) col(x - .35, x + .35, z - .35, z + .35); });
  _o.scale.set(1, 1, 1);
  inst(OUT, trunkG, S(T.makeWood([52, 38, 26])), treeM);
  const crowns = inst(OUT, crownG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), treeM);
  const tc = new THREE.Color(); treeM.forEach((m, i) => { if (tpos[i][3]) tc.setHSL(rr(.9, .95), rr(.35, .5), rr(.32, .42)); else tc.setHSL(rr(.2, .3), rr(.2, .35), rr(.045, .085)); crowns.setColorAt(i, tc); }); crowns.instanceColor.needsUpdate = true;
  // 풀: 십자형 풀잎 카드 (알파 텍스처)
  const grassG = merge([new THREE.PlaneGeometry(.8, .55).translate(0, .27, 0), new THREE.PlaneGeometry(.8, .55).rotateY(Math.PI / 2).translate(0, .27, 0)]);
  const grM = [];
  for (let i = 0; i < 4000 && grM.length < 1800; i++) {
    const x = rr(-49, 49), z = rr(-25, 69.5);
    if (blocked(x, z, .3) || (Math.abs(x) < 3.6 && z > 1.5) || (x > -34 && x < 34 && z > 16 && z < 60 && rnd() < .85)) continue;
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
  const bookMat = new THREE.MeshStandardMaterial({ map: T.makeBookSpine(), roughness: .8 });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const bakeStats = { merged: 0, meshes: 0 };
  floors.forEach(F => {
    if (F.books && F.books.length) {
      const im = new THREE.InstancedMesh(unitBox, bookMat, F.books.length);
      F.books.forEach((b, i) => { im.setMatrixAt(i, b.m); im.setColorAt(i, b.c); });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.castShadow = im.receiveShadow = true; F.interior.add(im);
    }
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
      if (d.kind === 'slide') d.panels.forEach(p => { p.m.position.x = p.x0 + (p.x1 - p.x0) * d.open; });
      else d.piv.rotation.y = d.open * d.angOpen;
    }
    for (const p of props) {
      if (p.kind === 'safe') p.piv.rotation.y = -p.open * 1.7;
      if (p.kind === 'breaker') p.lev.rotation.z += ((p.on ? -.6 : -2.4) - p.lev.rotation.z) * Math.min(1, dt * 10);
      else if (p.kind === 'switch') { p.key.rotation.x += ((p.on ? -.35 : .35) - p.key.rotation.x) * Math.min(1, dt * 18); p.led.visible = !p.on; }
    }
    // 고장 난 형광등: 대부분 켜져 있다가 몇 초에 한 번 부드럽게 두세 번 어두워진다 (점멸 피로를 줄인 패턴)
    const cr = .87 + .13 * warm, cg = .92 - .02 * warm, cb = 1 - .22 * warm;
    flickerMats.forEach((m, i) => { const v = blackout ? 0 : flickVal(t, i) * gain; m.userData.v = v; m.color.setRGB(cr * v + .02, cg * v + .02, cb * v + .02); });
    matLampOn.color.setRGB(blackout ? .02 : cr * gain, blackout ? .02 : cg * gain, blackout ? .02 : cb * gain);
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
  return { floors, items, lockers, doors, gate, update, mats: { flickerMats, matLampOn, matLampDead }, flickCfg, sky: { stars, moon, moonGlow }, NOTES, TAPES, PHOTOS, doorList, props, boardRefs, OUT, bakeStats, makeBoardTex: T.makeBoard };
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
