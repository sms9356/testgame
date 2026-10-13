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
    names: ['비상 통로', '보일러실', '전기실', '창고', '계단', '기록실', '청소도구실', '발전실', '펌프실'] },
];
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
  const mRust = PB('rust', () => T.pbrPaintMetal(256, [120, 72, 44]), { metalness: .3 });
  mRust.color.setRGB(.62, .55, .5);
  const mLocker = S(T.makeMetal([120, 134, 138]), { roughness: .55, metalness: .4 });
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
  const mFrame = S(T.makeMetal([150, 158, 150]), { roughness: .6, metalness: .3 });
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
  const mRad = S(T.makeMetal([168, 162, 140]), { roughness: .7, metalness: .25 });
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
  function classroom(cx, name) {
    const zN = -9.6;
    frontWall(cx, zN, true, name === '3-3' ? ['자습'] : undefined);
    if (name === '3-3') boardRefs.b33 = { mat: frontWall.last, floor: cur.f, cx };
    teacherDesk(cx + 2.6, zN + 1.0);
    lectern(cx - 1.2, zN + 1.05);
    fan(cx, -7.3); fan(cx, -3.9);
    bin(cx + 3.5, -2.3);
    { const ck = new THREE.Mesh(new THREE.CircleGeometry(.22, 24), mClockM); ck.position.set(cx, 2.7, -1.76); ck.rotation.y = Math.PI; cur.interior.add(ck); }
    if (rnd() < .5) graffiti(pick(['다시, 여기서', '돌아와', '보고 있어']), cx - 2.4, 1.7, -1.765, Math.PI, 1.8);
    // 게시판 (동쪽 벽)
    plane(cur.interior, mCork, 2.0, 1.1, cx + 3.84, 1.6, -5.2, -Math.PI / 2);
    // 뒤쪽 사물함(서쪽 벽)
    for (let k = 0; k < 4; k++) add(mLockerT, .45, 1.4, .5, cx - 3.55, 0, -2.9 - k * .55 - 0.0, { col: false, ry: Math.PI / 2 });
    col(cx - 3.85, cx - 3.3, -5.2, -2.6);
    deskGrid(cx, [-2.8, -1.9, 1.9, 2.8], [-7.2, -6.0, -4.8, -3.6], .14);
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
      add(mWoodDark, 1.4, .76, .7, cx + dx, 0, z, { col: true });
      add(mMetal, .5, .5, .5, cx + dx + rr(-.3, .3), .76, z - .1); // 모니터/상자
      add(mWhite, .3, .06, .22, cx + dx + rr(-.5, .5), .76, z + .15, { ry: rr(-.5, .5) });
      add(mBlack, .45, .04, .45, cx + dx, .45, z + .85); add(mMetal, .04, .45, .04, cx + dx, 0, z + .85);
    }));
    add(mLockerT, .6, 1.8, .5, cx + 3.55, 0, -8.8, { col: true }); add(mLockerT, .6, 1.8, .5, cx + 3.55, 0, -8.25, { col: true });
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
      [-.5, .5].forEach(dz => add(mWoodDark, .35, .55, .35, cx + dx + (dx < 0 ? .95 : -.95), 0, z + dz, {}));
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
  }
  function computer(cx) {
    const zN = -9.6;
    frontWall(cx, zN, true, ['시스템 오류']);
    [-3.0, 3.0].forEach(dx => [-8.0, -6.4, -4.8, -3.3].forEach(z => {
      add(mWood, .7, .74, 1.3, cx + dx, 0, z, { col: true });
      add(mMetal, .45, .4, .45, cx + dx, .74, z - .2);
      add(mBlack, .38, .3, .02, cx + dx, .78, z + .03 - .2 + .24);
    }));
    addBattery(cx - 3.0, .78, -4.8);
    papers(cx, -8, -2.4, 6);
  }
  function music(cx) {
    const zN = -9.6;
    frontWall(cx, zN, true, ['도 레 미 파']);
    // 그랜드 피아노
    grandPiano(cx + 2.2, -8.2);
    boardRefs['piano' + cur.f] = { floor: cur.f, x: cx + 2.2, z: -8.2 };
    addBattery(cx + 2.2, .98, -7.4);
    addNote('n6', cx - 2.5, .5, -8.0);
    // 보면대/의자
    [-2.8, -1.4, 0].forEach((dx, k) => { add(mMetal, .05, 1.0, .05, cx - 2 + dx, 0, -5.2 + k * .2, { }); add(mMetal, .4, .3, .03, cx - 2 + dx, 1.0, -5.2 + k * .2); add(mWoodDark, .4, .45, .4, cx - 2 + dx, 0, -4.4 + k * .2); });
    papers(cx, -8, -2.4, 12);
  }
  function art(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    [-2.8, -0.9, 1.0, 2.8].forEach((dx, k) => {
      add(mWoodDark, .08, 1.7, .08, cx + dx - .4, 0, -6.2 + (k % 2) * 1.6); add(mWoodDark, .08, 1.7, .08, cx + dx + .4, 0, -6.2 + (k % 2) * 1.6);
      const cv = new THREE.MeshStandardMaterial({ color: pick([0x8a8a78, 0x6a5a48, 0x4a5a5a]), roughness: 1 });
      add(cv, .8, .9, .04, cx + dx, .7, -6.2 + (k % 2) * 1.6, { col: true });
    });
    add(mWhite, .4, 1.0, .4, cx + 3.2, 0, -8.9, { col: true }); add(mWhite, .26, .3, .26, cx + 3.2, 1.0, -8.9);
    addBattery(cx - 3.2, .0, -3.2);
    papers(cx, -8, -2.4, 12);
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
    col(cx - 3.85, cx - 1.2, -9.6, z0 + .1);
    if (!cur.basement) win3D(cur.interior, 2.0, 1.8, cx + 1.8, 1.9, -9.58);
    // 계단 표시
    const sg2 = new THREE.MeshBasicMaterial({ map: T.makeSign('▲ 위층   ▼ 아래층', '#1e2a2e', '#d9e4d0', 26), transparent: false });
    plane(cur.interior, sg2, 1.8, .45, cx + 1.8, 2.6, -9.57);
    // 낡은 소방 장비
    add(S(null, { color: 0x8a1a1a, roughness: .6 }), .22, .5, .22, cx + 3.5, 0, -3.0);
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
  function boiler(cx) {
    [-2.0, 1.6].forEach(dx => { cyl(mRust, .85, 2.4, cx + dx, 0, -7.4); col(cx + dx - .85, cx + dx + .85, -8.25, -6.55); });
    add(mRust, .14, .14, 7, cx + 3.3, 2.5, -6, {}); add(mRust, .14, 1.2, .14, cx + 3.3, 1.3, -8.5);
    add(mWood, .8, .7, .8, cx + 3.0, 0, -3.4, { col: true }); addNote('n11', cx + 3.0, .72, -3.4);
    addBattery(cx - 3.0, 0, -3.0); papers(cx, -8, -2.4, 6);
  }
  function electric(cx) {
    for (let k = 0; k < 4; k++) { add(mLockerT, .9, 2.0, .45, cx - 2.7 + k * 1.8, 0, -9.35, { col: true }); plane(cur.interior, mWarnS, .5, .3, cx - 2.7 + k * 1.8, 1.5, -9.1); }
    add(mBlack, .4, .15, 5, cx + 1, 0, -5.5); add(mBlack, .4, .15, 4, cx - 1.5, 0, -6);
    add(mWood, 1, .5, 1, cx + 3, 0, -3.5, { col: true }); addMedkit(cx + 3, .5, -3.5);
    // 주 차단기
    meshAt(merge([bx(.12, 1.0, .8, 0, 1.4, 0), bx(.04, .9, .7, .07, 1.4, 0)]), S(T.makeMetal([110, 116, 112]), { roughness: .6, metalness: .4 }), cx - 3.78, 0, -5.4);
    plane(cur.interior, mWarnS, .45, .28, cx - 3.68, 2.05, -5.4, Math.PI / 2);
    { const lev = dyn(new THREE.Group()); lev.position.set(cx - 3.66, 1.4, -5.4); cur.interior.add(lev);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.04, .32, .05), mBlack); arm.position.y = .16; lev.add(arm);
      const knob = new THREE.Mesh(new THREE.BoxGeometry(.12, .05, .05), S(null, { color: 0xb02020 })); knob.position.y = .32; lev.add(knob); lev.rotation.z = -2.4;
      props.push({ kind: 'breaker', floor: cur.f, x: cx - 3.0, z: -5.4, lev, on: false, label: '주 차단기 올리기' }); }
    papers(cx, -8, -2.4, 4);
  }
  function storage(cx) {
    [-2.9, 2.9].forEach(dx => [-8.0, -5.8, -3.6].forEach(z => { add(mMetal, .5, 2.0, 1.8, cx + dx, 0, z, { col: true }); add(mWood, .4, .4, .5, cx + dx + (dx < 0 ? .3 : -.3), 0, z); }));
    add(mWood, 1, .9, 1, cx, 0, -8.6, { col: true }); add(mWood, .8, .7, .8, cx + .8, 0, -8.0);
    addBattery(cx, .9, -8.6); papers(cx, -8, -2.4, 7);
  }
  function records(cx) {
    [-2.9, 2.9].forEach(dx => [-8.2, -6.0].forEach(z => shelf3D(cx + dx, z, dx < 0 ? Math.PI / 2 : -Math.PI / 2, 2.0, 2.1, .5, 6, .8)));
    scatterBooks(cx, -4.5, 10);
    add(mWoodDark, 1.6, .75, .8, cx, 0, -8.4, { col: true }); addNote('n12', cx + .3, .77, -8.4);
    tapeRecorder('tape3', cx - .45, .75, -8.35, .2);
    papers(cx, -8, -2.4, 12);
  }
  function cleaning(cx) {
    [[-2.5, -8], [-1.6, -8.4], [2.8, -3.5]].forEach(([dx, z]) => cyl(S(null, { color: 0x2a4a7a }), .22, .4, cx + dx, 0, z));
    [-2, -1.5].forEach(dx => add(mWood, .04, 1.5, .04, cx + dx, 0, -9.3));
    add(mMetal, .5, 2, 3, cx + 3.3, 0, -6.5, { col: true }); add(mWood, .9, .7, .9, cx, 0, -8.6, { col: true });
    mopBucket(cx - 3.0, -5.5); mopBucket(cx + 1.2, -4.0);
    addBattery(cx - 3, 0, -3.2); papers(cx, -8, -2.4, 8);
  }
  function generator(cx) {
    add(mMetal, 3, 1.6, 1.6, cx, 0, -7.6, { col: true }); cyl(mRust, .5, 1.6, cx - 3, 0, -4.6); col(cx - 3.5, cx - 2.5, -5.1, -4.1);
    add(mRust, .3, .3, 4, cx + 2.8, 2.2, -6); glowAt(cx, 1.8, -6.7, 1.4, glowRed);
    papers(cx, -8, -2.4, 5);
  }
  function pump(cx) {
    [-2, 0.5].forEach(dx => { cyl(mMetal, .6, 1.5, cx + dx, 0, -7.5); col(cx + dx - .6, cx + dx + .6, -8.1, -6.9); });
    add(mRust, .16, .16, 7, cx + 3.4, 1.8, -6); add(mRust, 8, .16, .16, cx, 2.6, -9.3);
    [-.3, .3].forEach(dx => add(mMetal, .06, 3.2, .06, cx + 2.4 + dx, 0, -9.5)); for (let k = 0; k < 8; k++) add(mMetal, .6, .05, .05, cx + 2.4, .4 + k * .4, -9.5);
    doors.push({ floor: cur.f, x: cx + 2.4, z: -8.4, r: 1.9, label: '사다리 오르기 (수영장 펌프실)', to: { floor: 6, x: -40, z: 48.2, yaw: 0 } });
    papers(cx, -8, -2.4, 4);
  }
  function exitRoom(cx) {
    plane(cur.interior, mDoor, 1.5, 2.4, cx, 1.2, -9.57);
    plane(cur.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('비 상 구', '#0a3a1a', '#7dffa0', 30) }), 1.2, .3, cx, 2.8, -9.56);
    glowAt(cx, 1.4, -8.6, 5, glowRed);
    add(mWood, 1, .8, 1, cx - 2.6, 0, -5, { col: true }); add(mWood, .8, .6, .8, cx + 2.6, 0, -4.2, { col: true });
    doors.push({ floor: cur.f, x: cx, z: -8.5, r: 1.9, label: '비상 통로 (정문 방향)', need: KEY_NAMES.length, to: { floor: 0, x: -12, z: 67.5, yaw: Math.PI } });
    papers(cx, -8, -2.4, 6);
  }

  /* ---------- 층 빌드 ---------- */
  const mDeskSign = {};
  function buildFloor(f, o = {}) {
    curWall = o.basement ? mBase : mWall;
    const F = { f, y0: o.y0 ?? f * FH, basement: !!o.basement, interior: new THREE.Group(), shell: new THREE.Group(), col: [], walls: [], lamps: [], nodes: [], edges: [] };
    F.interior.position.y = F.y0; F.shell.position.y = F.y0;
    scene.add(F.interior, F.shell); floors.push(F); cur = F;
    const Z0 = -9.9, Z1 = 1.75, X0 = -36.3, X1 = 36.3;
    const lay = o.lay || LAYOUT[f];

    // 바닥/천장
    flat(F.interior, mFloorTile, X0, X1, -1.75, Z1, 0);
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
    for (let x = -34; x <= 34; x += 4) { if (o.basement || (f === 0 && Math.abs(x) < 3)) continue; wins.push(x); }
    const ops = wins.map(x => ({ x, w: 2.4, type: 'win' }));
    if (f === 0) ops.push({ x: 0, w: 3.0, type: 'door' });
    ops.sort((a, b) => a.x - b.x);
    let cursor = -36;
    const zs0 = 1.45, zs1 = 1.75;
    for (const o of ops) {
      const a = o.x - o.w / 2, b = o.x + o.w / 2;
      if (a > cursor) wallSeg(cursor, a, zs0, zs1, 0, FH, true);
      if (o.type === 'win') {
        wallSeg(a, b, zs0, zs1, 0, .9, true); wallSeg(a, b, zs0, zs1, 2.5, FH, true);
        win3D(F.shell, o.w, 1.6, o.x, 1.7, 1.6, Math.PI);
        if (!o.base) { const r = new THREE.Mesh(radG, mRad); r.position.set(o.x, 0, 1.33); r.rotation.y = Math.PI; r.scale.x = 1.6; F.interior.add(r); }
        add(mWoodDark, o.w + .2, .06, .3, o.x, .88, 1.65, { parent: F.shell });
      } else {
        wallSeg(a, b, zs0, zs1, 2.7, FH, true);
        add(mWoodDark, .12, 2.7, .4, a, 0, 1.6, { parent: F.shell }); add(mWoodDark, .12, 2.7, .4, b, 0, 1.6, { parent: F.shell });
        // 열려 있는 유리문 두 짝
        [[a, -1], [b, 1]].forEach(([hx, s]) => { const dg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, .05), mDoor); dg.geometry.translate(-s * .7, 1.2, 0); dg.position.set(hx, 0, 1.7); dg.rotation.y = s * (1.2 + rr(-.2, .2)); F.shell.add(dg); });
      }
      cursor = b;
    }
    if (cursor < 36.3) wallSeg(cursor, 36.3, zs0, zs1, 0, FH, true);
    // 층간 콘크리트 띠 + 바깥 창턱
    if (!o.basement && f < 2) F.shell.add(boxMesh(-36.6, 36.6, FH - .14, FH + .14, 1.75, 1.95, mFacade, 3));
    if (!o.basement) wins.forEach(x => F.shell.add(boxMesh(x - 1.35, x + 1.35, .82, .9, 1.75, 1.92, mFacade, 3)));
    if (f === 0) {   // 현관: 계단 + 캐노피 + 기둥 + 교명 간판
      for (let k = 0; k < 3; k++) { F.shell.add(boxMesh(-3.2 + k * .25, 3.2 - k * .25, 0, .12 * (k + 1), 1.75, 3.4 - k * .45, mStep, 2)); }
      F.shell.add(boxMesh(-3.0, 3.0, 2.95, 3.2, 1.75, 4.6, mFacade, 3));
      [-2.6, 2.6].forEach(x => F.shell.add(boxMesh(x - .18, x + .18, 0, 2.95, 4.05, 4.41, mFacade, 3)));
      const sg = new THREE.MeshStandardMaterial({ map: T.makeSign('서 문 고 등 학 교', 'rgba(0,0,0,0)', '#c8c0a8', 40), transparent: true, metalness: .6, roughness: .45 });
      plane(F.shell, sg, 4.6, 1.15, 0, 3.55, 1.78);
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

    // 방별 가구
    SLOTS.forEach((cx, i) => {
      const t = lay.types[i];
      ({ class: classroom, office, nurse, counsel, library, lab, computer, music, art, toilet, stair: stairRoom, cooking, craft, broadcast, boiler, electric, storage, records, cleaning, generator, pump, exit: exitRoom })[t](cx, lay.names[i]);
    });
    if (f === 2) addMedkit(SLOTS[3] + 2.6, .77, -8.6);
    if (f === 1) addMedkit(SLOTS[1] + 2.6, .77, -8.6);
    if (f === 0) { framed('map_aerial', 2.2, 1.2, -2.6, 1.75, -1.42); framed('map_floors', 1.6, 1.17, 2.6, 1.75, -1.42); }
    if (f === 2) framed('bc_modern', 1.6, .9, SLOTS[1] - 2.6, 1.75, -1.42);
    if (f === 0) addNote('n1', SLOTS[5] + 2.6, .77, -8.6, 0.3);

    // 조명 (형광등) — 복도 + 각 방
    const addLamp = (x, z, ang) => {
      const r = rnd(); const kind = r < .35 ? 'on' : r < .62 ? 'flick' : 'dead';
      const m = kind === 'on' ? matLampOn : kind === 'dead' ? matLampDead : flickerMats[(rnd() * 4) | 0];
      const tube = new THREE.Mesh(new THREE.BoxGeometry(1.3, .05, .12), m); tube.position.set(x, CH - .1, z); tube.rotation.y = ang; F.interior.add(tube);
      const hs = new THREE.Mesh(new THREE.BoxGeometry(1.4, .04, .22), lampHousing); hs.position.set(x, CH - .04, z); hs.rotation.y = ang; F.interior.add(hs);
      if (kind === 'dead' && rnd() < .4) { tube.rotation.x = rr(.5, .9); tube.position.y = CH - .45; meshAt(tube_(x - .5, CH - .05, z, x - .5, CH - .5, z), mBlack, 0, 0, 0); (F.sparks ||= []).push({ x: x - .5, y: CH - .5, z }); }
      F.lamps.push({ x, y: F.y0 + CH - .5, z, kind, mat: m });
    };
    for (let x = -28; x <= 28; x += 8) addLamp(x + 4 * 0, 0, 0);
    addLamp(-34, 0, 0); addLamp(34, 0, 0);
    // 현관 근처 1F 램프는 반드시 켜짐
    SLOTS.forEach((cx, i) => { addLamp(cx - 2, -5.6, 0); addLamp(cx + 2, -5.6, 0); });
    if (f === 0) { const a = F.lamps.find(l => Math.abs(l.x) < 5 && Math.abs(l.z) < .1); if (a) { a.kind = 'on'; a.mat = matLampOn; } }

    // 복도 디테일: 배관, 천장 손상, 비상구, 소화기, 낙서
    corridorPipes(-36, 36);
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
    if (f === 0) { const e = nid(0, 3.6); F.edges.push([cn[arr.indexOf(0)], e]); F.entrance = e; }
    F.adj = F.nodes.map(() => []);
    F.edges.forEach(([p, q]) => { F.adj[p].push(q); F.adj[q].push(p); });
    return F;
  }
  for (let f = 0; f < 3; f++) buildFloor(f);


  /* ---------- 옥상 (floor 3) ---------- */
  {
    const R = { f: 3, y0: ROOF_Y, interior: new THREE.Group(), shell: new THREE.Group(), col: [], walls: [], lamps: [], nodes: [], edges: [], adj: [] };
    R.interior.position.y = ROOF_Y; scene.add(R.interior); floors.push(R); cur = R;
    const X0 = -36.3, X1 = 36.3, Z0 = -9.9, Z1 = 1.75;
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
    framed('cafe_hall', 2.4, 1.04, -30.32, 2.3, 19.4, -Math.PI / 2);
    addMedkit(-41, .9, 10.4);
    // 식당 홀
    const tabs = [[-43.5, 16], [-39.2, 16], [-34.9, 16], [-43.5, 19.2], [-34.9, 19.2]];
    const stO = [], stG = [];
    tabs.forEach(([x, z], i) => {
      add(mWood, 3.2, .06, .9, x, .72, z); [-1.5, 1.5].forEach(dx => add(mMetal, .06, .72, .8, x + dx, 0, z)); col(x - 1.6, x + 1.6, z - .45, z + .45);
      for (let k = 0; k < 3; k++) [-.7, .7].forEach(dz => { if (rnd() < .2) return; (((k + (dz > 0 ? 1 : 0)) % 2) ? stO : stG).push(MX(x - 1 + k * 1.0 + rr(-.05, .05), 0, z + dz + rr(-.05, .05))); });
    });
    const stool = new THREE.CylinderGeometry(.17, .17, .45, 10); stool.translate(0, .225, 0);
    inst(F.interior, stool, S(null, { color: 0xc86a20, roughness: .6 }), stO); inst(F.interior, stool, S(null, { color: 0x6a8a2a, roughness: .6 }), stG);
    addMedkit(-34.5, .95, 12.9); addNote('n13', -39.2, .76, 16);
    tabs.forEach(([x, z]) => { for (let k = 0; k < 3; k++) if (rnd() < .7) tray(x - 1 + k + rr(-.1, .1), .755, z + (rnd() < .5 ? -.22 : .22), rr(-.3, .3)); });
    addBattery(-34.9, .72, 19.2);
    for (let k = 0; k < 8; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.28, .2), mDirtPaper); m.rotation.set(-Math.PI / 2, 0, rnd() * 6); m.position.set(rr(-46, -32), .02, rr(14, 21)); F.interior.add(m); }
    add(mLockerT, .62, 1.85, .55, -31.3, 0, 8.6 + .28 + 1.3, { col: true }); add(mLockerT, .62, 1.85, .55, -31.3 - .66, 0, 8.6 + .28 + 1.3, { col: true });
    lockers.push({ floor: 7, x: -31.3, z: 10.18, y: 140, dir: { x: 0, z: 1 } });
    [-44, -39, -34].forEach(x => [10, 15, 20].forEach(z => areaLamp(x, z, H - .6)));
    [[-43, 14.6], [-39, 14.6], [-35, 14.6], [-43, 20.4], [-35, 20.4], [-39, 20.6], [-32, 13], [-32, 10.5], [-39.5, 11.6]].forEach(([x, z]) => F.nodes.push({ x, z }));
    F.entrance = 5;
    [[0, 1], [1, 2], [0, 3], [2, 4], [1, 5], [3, 5], [4, 5], [2, 6], [6, 7], [7, 8]].forEach(e => F.edges.push(e));
    F.spawns = [{ x: -43, z: 14.6 }, { x: -32, z: 10.5 }, { x: -43, z: 20.4 }];
    finishGraph(F);
    doors.push({ floor: 7, x: -39, z: 21.2, r: 1.8, label: '급식실 나가기', to: { floor: 0, x: -39, z: 23.6, yaw: Math.PI } });
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
    const X0 = -20.3, X1 = 20.3, Z0 = -9.9, Z1 = 1.75;
    const woodT = ['music', 'art', 'craft', 'counsel', 'club'];
    flat(F.interior, mFloorTile, X0, X1, -1.75, Z1, 0);
    sl.forEach((cx, i) => flat(F.interior, woodT.includes(spec.types[i]) ? mFloorWood : mFloorTile, cx - 4, cx + 4, -9.6, -1.75, 0));
    ceilHole(F.interior, X0, X1, Z0, Z1, -16);
    awall(X0, X1, Z0, -9.6, CH); awall(X0, -20, -9.6, Z1, CH); awall(20, X1, -9.6, Z1, CH);
    if (k === 0) {
      awall(X0, -1.5, 1.45, Z1, CH); awall(1.5, X1, 1.45, Z1, CH); awall(-1.5, 1.5, 1.45, Z1, CH, 2.7);
      [-1.5, 1.5].forEach(x => add(mWoodDark, .12, 2.7, .4, x, 0, 1.6));
      plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('주출입구', '#1e2a2e', '#d9e4d0', 30), color: 0x9aa59a }), 1.4, .35, 0, 3.0, 1.43, Math.PI);
    } else awall(X0, X1, 1.45, Z1, CH);
    [-16, -12, -8, 8, 12, 16].concat(k ? [-4, 0, 4] : []).forEach(x => { win3D(F.interior, 2.4, 1.6, x, 1.7, 1.44, Math.PI); radiator(x, 1.3, Math.PI, 1.6); });
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
    [-12, -4, 4, 12].forEach(x => areaLamp(x, 0, CH - .1)); sl.forEach(cx => { areaLamp(cx - 2, -5.6, CH - .1); areaLamp(cx + 2, -5.6, CH - .1); });
    [2, 3].forEach(i => { const cx = sl[i]; for (let q = 0; q < 3; q++) add(mLockerT, .62, 1.85, .5, cx + 2.35 + q * .66, 0, -1.2, { col: true }); lockers.push({ floor: f, x: cx + 3.01, z: -1.2, y: y0, dir: { x: 0, z: 1 } }); });
    for (let q = 0; q < 24; q++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.28, .2), mDirtPaper); m.rotation.set(-Math.PI / 2, 0, rnd() * 6.28); m.position.set(rr(-19, 19), .012, rr(-1.2, 1.3)); F.interior.add(m); }
    const xs = new Set(sl); for (let x = -20; x <= 20; x += 4) xs.add(x);
    const arr = [...xs].sort((p, q) => p - q), cn = arr.map(x => { F.nodes.push({ x, z: 0 }); return F.nodes.length - 1; });
    for (let q = 0; q < cn.length - 1; q++) F.edges.push([cn[q], cn[q + 1]]);
    sl.forEach(cx => { F.nodes.push({ x: cx, z: -5.5 }); F.edges.push([cn[arr.indexOf(cx)], F.nodes.length - 1]); });
    F.spawns = [{ x: 18, z: 0 }, { x: -18, z: 0 }, { x: 8, z: -5.5 }];
    finishGraph(F);
    if (k === 0) framed('annex_ext', 2.4, .77, -5.5, 1.8, -1.42);
    if (k === 0) doors.push({ floor: 8, x: 0, z: .9, r: 1.9, label: '별관 나가기', to: { floor: 0, x: 0, z: -12.3, yaw: Math.PI } });
  }

  /* ---------- 독립 공간: 체육관(5) / 수영장(6) ---------- */
  function areaFloor(f, y0) {
    const F = { f, y0, interior: new THREE.Group(), shell: new THREE.Group(), col: [], walls: [], lamps: [], nodes: [], edges: [], adj: [], spawns: [], area: true };
    F.interior.position.y = y0; scene.add(F.interior); floors.push(F); cur = F; return F;
  }
  const finishGraph = F => { F.adj = F.nodes.map(() => []); F.edges.forEach(([p, q]) => { F.adj[p].push(q); F.adj[q].push(p); }); };
  const awall = (x1, x2, z1, z2, h, y1 = 0, mat = mWall) => { cur.interior.add(boxMesh(x1, x2, y1, h, z1, z2, mat)); if (y1 < 1) col(x1, x2, z1, z2, true); };
  function areaLamp(x, z, y) {
    const r = rnd(); const kind = r < .3 ? 'on' : r < .6 ? 'flick' : 'dead';
    const m = kind === 'on' ? matLampOn : kind === 'dead' ? matLampDead : flickerMats[(rnd() * 4) | 0];
    const t = new THREE.Mesh(new THREE.BoxGeometry(1.3, .05, .12), m); t.position.set(x, y, z); cur.interior.add(t);
    const hs = new THREE.Mesh(new THREE.BoxGeometry(1.4, .04, .22), lampHousing); hs.position.set(x, y + .06, z); cur.interior.add(hs);
    cur.lamps.push({ x, y: cur.y0 + y - .4, z, kind, mat: m });
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
    framed('gym_full', 2.4, .96, 33, 3.2, z1 - t - .03, Math.PI);
    [11, 15, 19, 23, 27].forEach(z => { win3D(F.interior, 2.4, 1.8, x0 + t + .02, 5.2, z, Math.PI / 2); win3D(F.interior, 2.4, 1.8, x1 - t - .02, 5.2, z, -Math.PI / 2); });
    for (let z = 10; z <= 28; z += 4) add(mMetal, 19.4, .25, .2, 38, H - .6, z);
    // 무대
    add(mWoodDark, 19.4, 1.1, 4.0, 38, 0, z0 + t + 2, { col: true });
    plane(F.interior, mCurt, 6.5, 5.2, 32.5, 3.7, z0 + t + .12); plane(F.interior, mCurt, 6.5, 5.2, 43.5, 3.7, z0 + t + .12); plane(F.interior, mCurt, 19.4, .9, 38, 6.45, z0 + t + .14);
    plane(F.interior, mBanner, 7, 1.75, 38, 7.0, z0 + t + .05);
    // 농구 골대
    [[13.0, 1], [27.2, -1]].forEach(([z, d]) => {
      add(mMetal, .2, 3.2, .2, 38, 0, z - d * .3, { col: true });
      add(mWhite, 1.8, 1.05, .05, 38, 2.5, z); const rim = new THREE.Mesh(new THREE.TorusGeometry(.23, .02, 6, 14), mRust); rim.rotation.x = Math.PI / 2; rim.position.set(38, 2.95, z + d * .35); cur.interior.add(rim);
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
    [33, 38, 43].forEach(x => [12, 17, 22, 27].forEach(z => areaLamp(x, z, H - .9)));
    const xs = [33, 38, 41], zs = [14, 20, 26];
    xs.forEach(x => zs.forEach(z => F.nodes.push({ x, z })));
    F.nodes.push({ x: 38, z: 28.4 }); F.entrance = 9;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const k = i * 3 + j; if (j < 2) F.edges.push([k, k + 1]); if (i < 2) F.edges.push([k, k + 3]); }
    F.edges.push([7, 9]);
    F.spawns = [{ x: 33, z: 14.5 }, { x: 41, z: 14.5 }, { x: 33, z: 26 }];
    finishGraph(F);
    doors.push({ floor: 5, x: 38, z: 28.9, r: 1.8, label: '체육관 나가기', to: { floor: 0, x: 38, z: 32, yaw: Math.PI } });
  }

  function buildPool() {
    const F = areaFloor(6, 100), x0 = -48, x1 = -34, z0 = 26, z1 = 50, H = 6.2, t = .3;
    const mPool = S(T.makePoolTile(), { roughness: .5 });
    const mSafety = new THREE.MeshStandardMaterial({ map: T.makeSafetySign(), roughness: .8 });
    flat(F.interior, mFloorTile, x0, x1, z0, z1, .01, 3);
    flat(F.interior, mCeil, x0, x1, z0, z1, H - .1, 4, false);
    awall(x0, x0 + t, z0, z1, H); awall(x0, x1, z0, z0 + t, H);
    awall(x1 - t, x1, z0, 37, H); awall(x1 - t, x1, 39, z1, H); awall(x1 - t, x1, 37, 39, H, 2.6);
    awall(x0, -41, z1 - t, z1, H); awall(-39, x1, z1 - t, z1, H); awall(-41, -39, z1 - t, z1, H, 2.6);
    [37, 39].forEach(z => add(mWoodDark, .4, 2.6, .12, x1 - .15, 0, z));
    plane(F.interior, mDoor, 1.5, 2.3, -40, 1.15, z1 - t - .02, Math.PI);
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('펌프실', '#3a1a1a', '#e0c8a8', 34) }), 1, .26, -40, 2.7, z1 - t - .02, Math.PI);
    [29, 34, 39, 44].forEach(z => win3D(F.interior, 3.2, 2.2, x0 + t + .02, 3.6, z, Math.PI / 2));
    [-45, -41.5, -38].forEach(x => plane(F.interior, mWin, 2.6, 2, x, 3.6, z0 + t + .02));
    // 수조
    const bx0 = -45.6, bx1 = -37.4, bz0 = 32.0, bz1 = 45.5, D = 1.6;
    flat(F.interior, mPool, bx0, bx1, bz0, bz1, -D, 2);
    F.interior.add(boxMesh(bx0 - .3, bx0, -D, 0, bz0 - .3, bz1 + .3, mPool, 2)); F.interior.add(boxMesh(bx1, bx1 + .3, -D, 0, bz0 - .3, bz1 + .3, mPool, 2));
    F.interior.add(boxMesh(bx0, bx1, -D, 0, bz0 - .3, bz0, mPool, 2)); F.interior.add(boxMesh(bx0, bx1, -D, 0, bz1, bz1 + .3, mPool, 2));
    const lane = new THREE.MeshBasicMaterial({ color: 0x0a1218 });
    for (let k = 1; k < 8; k++) flat(F.interior, lane, bx0 + k - .06 + .1, bx0 + k + .06 + .1, bz0, bz1, -D + .01, 1);
    col(bx0, bx1, bz0, bz1, true);
    [-44.6, -42.4, -40.2, -38.0].forEach((x, i) => add(S(T.makeNumber(i + 1)), .7, .6, .7, x, 0, 46.3, { col: true }));
    // 감시대
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => add(mRust, .06, 1.6, .06, -35.8 + a * .28, 0, 44 + b * .28));
    add(S(null, { color: 0x8a2a20 }), .7, .08, .7, -35.8, 1.6, 44); add(S(null, { color: 0x8a2a20 }), .7, .5, .06, -35.8, 1.68, 44.33); col(-36.15, -35.45, 43.65, 44.35);
    addKey('pool', 4, -35.8, 1.68, 44);
    add(mWood, .5, .45, 2.2, -35.2, 0, 40.4, { col: true }); addNote('n10', -35.2, .47, 40.0); addMedkit(-35.2, .47, 41.0);
    blood('drag', -41.5, .02, 46.8, 1.6, .3, true);
    // 남/여 탈의실 (분리된 방)
    const wz = 30.0, signM = n => new THREE.MeshBasicMaterial({ map: T.makeSign(n, '#1e2a2e', '#d9e4d0', 28), color: 0x9aa59a });
    awall(x0 + t, -45, wz, wz + t, H); awall(-44, -41.65, wz, wz + t, H); awall(-41.65, -41.35, z0 + t, wz, H);
    awall(-41.35, -38, wz, wz + t, H); awall(-37, x1 - t, wz, wz + t, H);
    awall(-45, -44, wz, wz + t, H, 2.4); awall(-38, -37, wz, wz + t, H, 2.4);
    plane(F.interior, signM('남자 탈의실'), 1.4, .35, -44.5, 2.7, wz + t + .02, 0); plane(F.interior, signM('여자 탈의실'), 1.4, .35, -37.5, 2.7, wz + t + .02, 0);
    for (let k = 0; k < 7; k++) { add(mLockerT, .62, 1.85, .55, -47.2 + k * .66, 0, z0 + t + .28, { col: true }); add(mLockerT, .62, 1.85, .55, -40.9 + k * .66, 0, z0 + t + .28, { col: true }); }
    add(mWood, 2.0, .45, .4, -45.2, 0, 28.3, { col: true }); add(mWood, 2.0, .45, .4, -38.2, 0, 28.3, { col: true });
    framed('pool_locker', 1.0, .94, -45.2, 2.6, z0 + t + .02); framed('pool_main', 2.0, 1.07, -38.0, 4.2, wz + t + .03);
    tapeRecorder('tape4', -38.2, .45, 28.3, .5);
    lockers.push({ floor: 6, x: -47.2 + 3 * .66, z: z0 + t + .28, y: 100, dir: { x: 0, z: 1 } }, { floor: 6, x: -40.9 + 3 * .66, z: z0 + t + .28, y: 100, dir: { x: 0, z: 1 } });
    // 샤워기/표지판/구명환
    [-41, -40, -39, -38].forEach(x => { add(mMetal, .04, 2.2, .04, x, 0, z0 + t + .1); add(mMetal, .16, .04, .04, x + .04, 2.1, z0 + t + .1); });
    plane(F.interior, mSafety, 1.6, .8, x0 + t + .03, 2.4, 38, Math.PI / 2); plane(F.interior, mSafety, 1.6, .8, -34.3 - 1.6, 2.4, z0 + t + .02);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.28, .08, 8, 16), S(null, { color: 0xc03030 })); ring.position.set(x0 + t + .1, 1.5, 32); ring.rotation.y = Math.PI / 2; cur.interior.add(ring);
    for (let k = 0; k < 3; k++) add(S(null, { color: k % 2 ? 0xc03030 : 0xcfcfcf }), 2.2, .08, .08, rr(-47, -36), 0, rr(28, 29.5), { ry: rr(-.4, .4) });
    addBattery(-46.8, 0, 48.8);
    [-43, -39, -36].forEach(x => [29, 34, 40, 46].forEach(z => areaLamp(x, z, H - .7)));
    papers(-41, 27, 49, 14, 6);
    const pts = [[-46.7, 31], [-41.5, 31], [-35.9, 31], [-35.9, 38], [-35.9, 47.6], [-41.5, 47.6], [-46.7, 47.6], [-46.7, 38], [-34.9, 38], [-44.5, 31], [-44.5, 28.3], [-37.5, 31], [-37.5, 28.3]];
    pts.forEach(([x, z]) => F.nodes.push({ x, z }));
    for (let k = 0; k < 8; k++) F.edges.push([k, (k + 1) % 8]); F.edges.push([3, 8], [0, 9], [9, 1], [1, 11], [11, 2], [9, 10], [11, 12]);
    F.spawns = [{ x: -46.7, z: 47.2 }, { x: -35.9, z: 47.6 }, { x: -46.7, z: 38 }];
    finishGraph(F);
    doors.push({ floor: 6, x: -35.2, z: 38, r: 1.8, label: '수영장 나가기', to: { floor: 0, x: -32.2, z: 38, yaw: -Math.PI / 2 } });
    doors.push({ floor: 6, x: -40, z: 48.4, r: 1.6, label: '펌프실 (지하 연결)', to: { floor: 4, x: 32, z: -4.4, yaw: Math.PI } });
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
  const pave = S(T.makePaving()); flat(OUT, pave, -3.2, 3.2, 1.75, 69.5, .01, 4); flat(OUT, pave, -16, 16, 1.75, 11, .01, 4);
  flat(OUT, pave, -46, 46, 11, 14, .005, 4);
  const asph = S(T.makeAsphalt()); flat(OUT, asph, -120, 120, 73, 82, 0.005, 8);
  // 웅덩이
  const puddle = new THREE.MeshStandardMaterial({ color: 0x2a3640, roughness: .12, metalness: 0, transparent: true, opacity: .55, depthWrite: false });
  [[0, 9], [-2, 30], [1.5, 50], [-20, 40], [14, 30], [-9, 46], [22, 44], [-26, 26], [8, 20], [27, 52], [-14, 18], [5, 62]].forEach(([x, z]) => {
    const geo = new THREE.CircleGeometry(1, 28), pp = geo.attributes.position; for (let i = 1; i < pp.count; i++) { const k = .7 + rnd() * .5; pp.setXY(i, pp.getX(i) * k, pp.getY(i) * k * rr(.6, 1)); }
    const p = new THREE.Mesh(geo, puddle); p.rotation.x = -Math.PI / 2; p.rotation.z = rnd() * 6; p.scale.setScalar(rr(.9, 2.3)); p.position.set(x, .022, z); OUT.add(p); });
  // 담쟁이덩굴 (본관 정면 · 담장 · 별관)
  { const ivyM = new THREE.MeshStandardMaterial({ map: T.makeIvy(), alphaTest: .45, side: THREE.DoubleSide, roughness: .75 });
    const ivy = (x, z, w, h, ry, y0 = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), ivyM); m.position.set(x, y0 + h / 2, z); m.rotation.y = ry; OUT.add(m); };
    [[-33, 6.5], [-27.5, 4], [-18, 7.5], [-9, 3.5], [11, 5], [21, 8], [30.5, 6], [35, 4]].forEach(([x, h]) => ivy(x, 1.8, rr(2.2, 3.4), h, 0));
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
  OUT.add(boxMesh(-20.4, 20.4, 12.4, 12.9, -25.4, -13.1, mWall));
  [1.8, 5.8, 9.8].forEach((y, r) => { for (let x = -18; x <= 18; x += 4) { if (r === 0 && Math.abs(x) < 3) continue; plane(OUT, mWin, 2.4, 1.6, x, y, -13.47, 0); } });
  plane(OUT, mDoor, 1.8, 2.4, 0, 1.2, -13.47, 0);
  plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('별관 (특별교실동)', '#1e2a2e', '#d9e4d0', 26), color: 0x9aa59a }), 3.4, .85, 0, 3.6, -13.46, 0);
  doors.push({ floor: 0, x: 0, z: -12.4, r: 2.0, label: '별관 들어가기', to: { floor: 8, x: 0, z: .2, yaw: 0 } });

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
  const gym = boxMesh(28, 48, 0, 8, 8, 30, mFacade, 3); OUT.add(gym); col(28, 48, 8, 30, true);
  [-1, 1].forEach(sd => { const r = new THREE.Mesh(new THREE.BoxGeometry(10.6, .3, 23), mRoofRed); r.position.set(38 + sd * 5, 8.9, 19); r.rotation.z = -sd * .2; OUT.add(r); });
  const poolB = boxMesh(-48, -34, 0, 6.4, 26, 50, mBrick, 2.5); OUT.add(poolB); col(-48, -34, 26, 50, true);
  const poolRoof = new THREE.Mesh(new THREE.BoxGeometry(14.6, .4, 24.6), mRoofRed); poolRoof.position.set(-41, 6.6, 38); OUT.add(poolRoof);
  [29, 34, 43, 47].forEach(z => plane(OUT, mWin, 2.4, 1.8, -33.98, 3.6, z, Math.PI / 2));
  plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('수 영 장', '#1e2a2e', '#d9e4d0', 34), color: 0x9aa59a }), 2.2, .55, -33.97, 3.3, 38, Math.PI / 2);
  plane(OUT, mDoor, 1.8, 2.4, -33.97, 1.2, 38, Math.PI / 2);
  plane(OUT, mDoor, 1.8, 2.4, 38, 1.2, 30.03, 0);
  plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('체 육 관', '#1e2a2e', '#d9e4d0', 34), color: 0x9aa59a }), 2.2, .55, 38, 3.3, 30.04, 0);
  const cafe = boxMesh(-48, -30, 0, 4.5, 8, 22, mFacade, 3); OUT.add(cafe); col(-48, -30, 8, 22, true);
  const cafeRoof = new THREE.Mesh(new THREE.BoxGeometry(19, .4, 15), mRoofRed); cafeRoof.position.set(-39, 4.7, 15); cafeRoof.rotation.z = .08; OUT.add(cafeRoof);
  doors.push({ floor: 0, x: 38, z: 31.4, r: 2.0, label: '체육관 들어가기', to: { floor: 5, x: 38, z: 28.1, yaw: 0 } });
  doors.push({ floor: 0, x: -32.7, z: 38, r: 2.0, label: '수영장 들어가기', to: { floor: 6, x: -35.5, z: 38, yaw: Math.PI / 2 } });
  doors.push({ floor: 0, x: -39, z: 23.4, r: 2.0, label: '급식실 들어가기', to: { floor: 7, x: -39, z: 20.5, yaw: 0 } });
  plane(OUT, mDoor, 1.8, 2.4, -39, 1.2, 22.03, 0);
  plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('급 식 실', '#1e2a2e', '#d9e4d0', 34), color: 0x9aa59a }), 2.2, .55, -39, 3.3, 22.04, 0);
  [[33, 8.02], [38, 8.02], [43, 8.02]].forEach(([x, z]) => plane(OUT, mWin, 3, 1.6, x, 5.2, z, Math.PI));
  [[-44, 8.02], [-39, 8.02], [-34, 8.02]].forEach(([x, z]) => plane(OUT, mWin, 3, 1.6, x, 2.4, z, Math.PI));

  // 축구 골대
  [[16], [57]].forEach(([z]) => { const m = mMetal; [-3.6, 3.6].forEach(x => addO(m, .1, 2.4, .1, x, 0, z)); addO(m, 7.3, .1, .1, 0, 2.4, z); });

  // 나무: 건물/길을 피해서 배치, 울퉁불퉁한 수관 + 개체별 색 변화
  const BLOCK = [[-37.5, 37.5, -11, 3.5], [-21.5, 21.5, -26, -12], [26.5, 49.5, 6.5, 31.5], [-49.5, -28.5, 6.5, 23.5], [-49.5, -32.5, 24.5, 51.5], [-51, -45.5, 27, 42], [-5, 5, 60, 72], [-17, 17, 1.5, 12]];
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
  function update(t, blackout) {
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
    }
    flickerMats.forEach((m, i) => {
      const k = Math.sin(t * (9 + i * 3.1) + i) * Math.sin(t * (23 + i * 5.3));
      const v = blackout ? 0.0 : (k > .35 ? 1 : (k > -.2 ? .08 : .45));
      m.color.setRGB(.87 * v + .02, .92 * v + .02, v + .02);
    });
    matLampOn.color.setRGB(blackout ? .02 : .87, blackout ? .02 : .92, blackout ? .02 : 1);
    for (const it of items) if (!it.taken && it.kind !== 'note') { it.mesh.position.y = it.pos.y - floors[it.floor].y0 + Math.sin(t * 2 + it.pos.x) * .03; it.mesh.rotation.y = t * 1.2; }
    lockGlow.material.opacity = .6 + .4 * Math.sin(t * 3);
  }

  return { floors, items, lockers, doors, gate, update, mats: { flickerMats, matLampOn }, NOTES, TAPES, PHOTOS, doorList, props, boardRefs, OUT, bakeStats, makeBoardTex: T.makeBoard };
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
