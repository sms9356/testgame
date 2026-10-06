// 폐교 월드 빌더 — 레퍼런스(배치도/정문/교실/소품 시트)를 기반으로 학교 전체를 절차적으로 생성한다.
import * as THREE from './vendor/three.module.js';
import * as T from './tex.js';
import { rnd, rr, pick } from './tex.js';

export const FH = 4, CH = 3.6;
export const SLOTS = [-32, -24, -16, -8, 0, 8, 16, 24, 32];
// 층별 교실 배치 (레퍼런스 평면도 기준)
export const LAYOUT = [
  { types: ['toilet', 'nurse', 'counsel', 'office', 'stair', 'class', 'class', 'class', 'library'],
    names: ['화장실', '보건실', '상담실', '교무실', '중앙계단', '1-1', '1-2', '1-3', '도서실'] },
  { types: ['toilet', 'class', 'class', 'class', 'stair', 'class', 'class', 'computer', 'lab'],
    names: ['화장실', '2-1', '2-2', '2-3', '중앙계단', '2-4', '2-5', '컴퓨터실', '과학실'] },
  { types: ['toilet', 'class', 'class', 'class', 'stair', 'class', 'class', 'art', 'music'],
    names: ['화장실', '3-1', '3-2', '3-3', '중앙계단', '3-4', '3-5', '미술실', '음악실'] },
];
export const GATE_Z = 70;
export const KEY_NAMES = ['교무실', '도서실', '과학실', '음악실'];

const NOTES = {
  n1: { title: '3학년 1반 일기', text: '오늘도 아무도 오지 않았다.<br>선생님은 칠판에 같은 말만 쓰신다.<br><b>“다시, 여기서.”</b><br>나는 이 문장을 몇 번째 읽고 있는 걸까.' },
  n2: { title: '보건 일지', text: '복도에서 쓰러진 여학생이 실려 옴.<br>그런데 아무도 이 아이의 이름을 기억하지 못한다.<br>출석부에도, 졸업앨범에도 없다.<br>아이는 불을 끄지 말라고 했다.' },
  n3: { title: '교무회의록', text: '폐교 결정. 마지막 졸업식은 열리지 않았다.<br>정문 열쇠는 사고를 막기 위해 <b>네 조각</b>으로 나누어 보관한다.<br>3층 음악실의 피아노는 절대 건드리지 말 것.' },
  n4: { title: '도서 대출 카드', text: '같은 이름이 수백 번 적혀 있다.<br>마지막 대출일은 <b>오늘</b>이다.<br>반납란은 비어 있다.' },
  n5: { title: '실험 노트', text: '불을 끄면 그녀가 온다.<br>빛이 있는 곳에는 쉽게 다가오지 못한다.<br>하지만 건전지는 영원하지 않다.<br>달리면 소리가 난다. 그녀는 <b>듣는다</b>.' },
  n6: { title: '찢어진 쪽지', text: '사물함 안에 숨어. 문틈으로 보면 그녀가 지나가는 게 보여.<br>숨소리를 죽이면 그냥 지나칠 때도 있어.<br>…하지만 네가 숨는 걸 봤다면, 그땐 늦었어.' },
};

export function buildWorld(scene) {
  /* ---------- 재질 ---------- */
  const S = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: .92, metalness: 0, ...o });
  const mWall = S(T.makeWall());
  const mFloorTile = S(T.makeTileFloor(), { roughness: .55 });
  const mFloorWood = S(T.makeWoodFloor(), { roughness: .6 });
  const mCeil = S(T.makeCeiling());
  const mWood = S(T.makeWood());
  const mWoodDark = S(T.makeWood([58, 36, 22]));
  const mMetal = S(T.makeMetal(), { roughness: .6, metalness: .35 });
  const mRust = S(T.makeMetal([100, 66, 44]), { roughness: .8, metalness: .3 });
  const mLocker = S(T.makeMetal([120, 134, 138]), { roughness: .55, metalness: .4 });
  const mBooks = S(T.makeBooks());
  const mCork = S(T.makeCork());
  const mFlag = S(T.makeFlag());
  const mDoor = S(T.makeDoor(), { side: THREE.DoubleSide });
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

  /* ---------- 지오메트리 도구 ---------- */
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const bx = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
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
  const MX = (x, y, z, ry = 0, rz = 0, rx = 0) => { _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz); _o.updateMatrix(); return _o.matrix.clone(); };
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
  const items = [], lockers = [], flickerMats = [];
  const matLampOn = new THREE.MeshBasicMaterial({ color: 0xdfeaff });
  const matLampDead = new THREE.MeshBasicMaterial({ color: 0x2b2b28 });
  for (let i = 0; i < 4; i++) flickerMats.push(new THREE.MeshBasicMaterial({ color: 0xdfeaff }));
  const lampHousing = S(null, { color: 0x555550, roughness: .7 });

  function col(x1, x2, z1, z2, wall = false) { const r = { x1, x2, z1, z2 }; cur.col.push(r); if (wall) cur.walls.push(r); }
  // 가구: y는 바닥 기준 하단
  function add(mat, w, h, d, x, y, z, o = {}) {
    const m = new THREE.Mesh(unit, mat); m.scale.set(w, h, d); m.position.set(x, y + h / 2, z);
    if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz;
    (o.parent || cur.interior).add(m);
    if (o.col) { const sw = (o.ry && Math.abs(Math.sin(o.ry)) > .7) ? d : w, sd = (o.ry && Math.abs(Math.sin(o.ry)) > .7) ? w : d; col(x - sw / 2, x + sw / 2, z - sd / 2, z + sd / 2); }
    return m;
  }
  function wallSeg(x1, x2, z1, z2, y1, y2, shell = false) {
    const m = boxMesh(x1, x2, y1, y2, z1, z2, mWall);
    (shell ? cur.shell : cur.interior).add(m);
    if (y1 < 1) col(x1, x2, z1, z2, true);
  }
  function addNote(id, x, y, z, ry = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.3, .22), mPaperN);
    m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, y + .01, z); cur.interior.add(m);
    items.push({ kind: 'note', id, floor: cur.f, pos: new THREE.Vector3(x, cur.y0 + y, z), mesh: m, title: NOTES[id].title, text: NOTES[id].text, taken: false, label: '쪽지 읽기' });
  }
  function addBattery(x, y, z) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .15, 12), S(null, { color: 0x3fae5a, emissive: 0x0a3010 }));
    b.rotation.z = Math.PI / 2; g.add(b);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .03, 8), mMetal); tip.rotation.z = Math.PI / 2; tip.position.x = .09; g.add(tip);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexG, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }));
    sp.scale.set(.7, .7, .7); g.add(sp);
    g.position.set(x, y + .1, z); cur.interior.add(g);
    items.push({ kind: 'battery', floor: cur.f, pos: new THREE.Vector3(x, cur.y0 + y + .1, z), mesh: g, taken: false, label: '건전지 줍기', baseY: y + .1 });
  }
  const glowTexY = T.makeGlow('255,200,90'), glowTexG = T.makeGlow('90,255,140');
  function addKey(id, idx, x, y, z) {
    const g = new THREE.Group();
    const gold = S(null, { color: 0xe0b44a, emissive: 0x6a4a10, roughness: .35, metalness: .7 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.05, .014, 8, 16), gold); ring.position.x = -.08; g.add(ring);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(.18, .02, .02), gold); g.add(shaft);
    [.05, .08].forEach(px => { const t = new THREE.Mesh(new THREE.BoxGeometry(.015, .05, .02), gold); t.position.set(px, -.03, 0); g.add(t); });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexY, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.set(1.2, 1.2, 1.2); g.add(sp);
    g.position.set(x, y + .12, z); cur.interior.add(g);
    items.push({ kind: 'key', idx, floor: cur.f, pos: new THREE.Vector3(x, cur.y0 + y + .12, z), mesh: g, taken: false, label: `열쇠 조각 줍기 (${KEY_NAMES[idx]})`, baseY: y + .12 });
  }
  function papers(cx, z1, z2, n, spread = 3.4) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(.28, .2), mDirtPaper);
      m.rotation.set(-Math.PI / 2, 0, rnd() * 6.28); m.position.set(cx + rr(-spread, spread), .015 + rnd() * .01, rr(z1, z2)); cur.interior.add(m);
    }
  }

  /* ---------- 학생 책상/의자 (인스턴싱) ---------- */
  const deskTopG = merge([bx(.7, .04, .5, 0, .74, 0), bx(.62, .16, .4, 0, .62, 0)]);
  const deskLegG = merge([[-.3, -.2], [.3, -.2], [-.3, .2], [.3, .2]].map(([x, z]) => bx(.035, .72, .035, x, .36, z)));
  const seatG = merge([bx(.4, .04, .38, 0, .44, .56), bx(.4, .28, .04, 0, .7, .75)]);
  const chairLegG = merge([[-.17, .42], [.17, .42], [-.17, .72], [.17, .72]].map(([x, z]) => bx(.03, .44, .03, x, .22, z)));
  function deskGrid(cx, offs, rows, miss = .15) {
    const tops = [], legs = [], seats = [], cl = [];
    for (const dx of offs) for (const z of rows) {
      if (rnd() < miss) continue;
      const x = cx + dx + rr(-.06, .06), ry = rr(-.1, .1);
      tops.push(MX(x, 0, z, ry)); legs.push(MX(x, 0, z, ry));
      col(x - .38, x + .38, z - .28, z + .82);
      if (rnd() < .78) {
        const tip = rnd() < .15, cy = rr(-.5, .5);
        const m = tip ? MX(x, .22, z + rr(-.2, .3), cy, rr(1.2, 1.6)) : MX(x + rr(-.08, .08), 0, z + rr(-.08, .35), cy * .4);
        seats.push(m); cl.push(m);
      }
    }
    if (!tops.length) return;
    inst(cur.interior, deskTopG, mWood, tops); inst(cur.interior, deskLegG, mMetal, legs);
    if (seats.length) { inst(cur.interior, seatG, mWood, seats); inst(cur.interior, chairLegG, mMetal, cl); }
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
    }
    [-3.05, 3.05].forEach(dx => plane(cur.interior, mWin, 1.3, 1.45, cx + dx, 1.75, zN + .02));
  }
  function classroom(cx, name) {
    const zN = -9.6;
    frontWall(cx, zN);
    add(mWood, 1.3, .75, .65, cx + 2.6, 0, zN + 1.0, { col: true });
    add(mWood, .7, 1.0, .5, cx - 2.6, 0, zN + 1.0, { col: true });
    add(mWoodDark, .4, .04, .4, cx + 2.6, .44, zN + 1.7); add(mMetal, .4, .44, .04, cx + 2.6, 0, zN + 1.7);
    // 게시판 (동쪽 벽)
    plane(cur.interior, mCork, 2.0, 1.1, cx + 3.84, 1.6, -5.2, -Math.PI / 2);
    // 뒤쪽 사물함(서쪽 벽)
    for (let k = 0; k < 4; k++) add(mLocker, .45, 1.4, .5, cx - 3.55, 0, -2.9 - k * .55 - 0.0, { col: false, ry: Math.PI / 2 });
    col(cx - 3.85, cx - 3.3, -5.2, -2.6);
    deskGrid(cx, [-3.0, -2.0, 2.0, 3.0], [-7.2, -6.0, -4.8, -3.6], .16);
    papers(cx, -8, -2.4, 9);
  }
  function office(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    // 서류 책장
    for (let k = 0; k < 3; k++) { add(mWoodDark, 1.1, 2.0, .4, cx + (k - 1) * 1.3, 0, zN + .25, { col: true }); plane(cur.interior, mBooks, 1.0, 1.8, cx + (k - 1) * 1.3, 1.0, zN + .46); }
    const rowsZ = [-7.4, -5.5, -3.8];
    [-2.6, 2.6].forEach(dx => rowsZ.forEach((z, r) => {
      add(mWoodDark, 1.4, .76, .7, cx + dx, 0, z, { col: true });
      add(mMetal, .5, .5, .5, cx + dx + rr(-.3, .3), .76, z - .1); // 모니터/상자
      add(mWhite, .3, .06, .22, cx + dx + rr(-.5, .5), .76, z + .15, { ry: rr(-.5, .5) });
      add(mBlack, .45, .04, .45, cx + dx, .45, z + .85); add(mMetal, .04, .45, .04, cx + dx, 0, z + .85);
    }));
    add(mLocker, .6, 1.8, .5, cx + 3.55, 0, -8.8, { col: true }); add(mLocker, .6, 1.8, .5, cx + 3.55, 0, -8.25, { col: true });
    plane(cur.interior, mCork, 2.0, 1.1, cx + 3.84, 1.6, -5.5, -Math.PI / 2);
    addKey('office', 0, cx + 2.6, .76, -7.4);
    addNote('n3', cx - 2.5, .76, -5.4);
    papers(cx, -8, -2.4, 14);
  }
  function nurse(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    [-2.4, 2.4].forEach(dx => { add(mMetal, 1.0, .5, 2.0, cx + dx, 0, zN + 1.2, { col: true }); add(mWhite, .95, .14, 1.9, cx + dx, .5, zN + 1.2); add(mWhite, .5, .1, .35, cx + dx, .64, zN + .4); });
    add(mLocker, .9, 1.7, .4, cx + 3.6, 0, -6.5, { ry: Math.PI / 2, col: true }); add(mGlass, .9, 1.7, .44, cx + 3.6, 0, -6.5, { ry: Math.PI / 2 });
    add(mWood, 1.2, .75, .6, cx - 3.2, 0, -5.4, { col: true, ry: Math.PI / 2 });
    addNote('n2', cx - 3.2, .75, -5.4);
    addBattery(cx + 2.4, .5, -8.4);
    papers(cx, -8, -2.4, 7);
  }
  function counsel(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    add(mFabric, 2.0, .45, .8, cx, 0, -8.8, { col: true }); add(mFabric, 2.0, .5, .2, cx, .45, -9.1);
    add(mWood, 1.0, .4, .6, cx, 0, -7.4, { col: true });
    add(mFabric, .8, .45, .8, cx - 2.4, 0, -6.4, { ry: Math.PI / 2, col: true });
    add(mWoodDark, .5, 2.0, 1.4, cx + 3.5, 0, -6.0, { col: true }); plane(cur.interior, mBooks, 1.3, 1.8, cx + 3.23, 1.0, -6.0, -Math.PI / 2);
    addBattery(cx + 0.2, .4, -7.4);
    papers(cx, -8, -2.4, 5);
  }
  function library(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    [-2.9, 2.9].forEach(dx => [-8.2, -6.0, -3.8].forEach(z => {
      add(mWoodDark, .5, 2.1, 2.0, cx + dx, 0, z, { col: true });
      plane(cur.interior, mBooks, 1.9, 2.0, cx + dx + (dx < 0 ? .26 : -.26), 1.05, z, dx < 0 ? Math.PI / 2 : -Math.PI / 2);
    }));
    // 독서 테이블 + 열쇠
    add(mWood, 2.4, .75, .9, cx, 0, -8.6, { col: true });
    [-.8, .8].forEach(dx => add(mWoodDark, .4, .45, .4, cx + dx, 0, -7.7));
    addKey('library', 1, cx + .6, .75, -8.6);
    addNote('n4', cx - .6, .75, -8.6);
    papers(cx, -8, -2.4, 10);
    // 쓰러진 책장
    add(mWoodDark, 1.8, .4, .5, cx + 0.2, 0, -4.3, { rz: 0, ry: .5 });
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
    addKey('lab', 2, cx - 2.4, .92, -4.8);
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
    add(mBlack, 1.5, .8, 2.0, cx + 2.2, .15, -8.2, { col: true });
    add(mBlack, 1.4, .05, 1.6, cx + 2.2, .95, -8.3, { rz: 0 });
    [[-.6, -.8], [.6, -.8], [0, .8]].forEach(([dx, dz]) => add(mBlack, .1, .15, .1, cx + 2.2 + dx, 0, -8.2 + dz));
    add(mWhite, 1.3, .03, .2, cx + 2.2, .96, -7.1);
    addKey('music', 3, cx + 2.2, .98, -7.4);
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
      add(mMetal, 1.0, 1.6, .04, dx, .3, zN + 2.0, { ry: i === 1 ? .9 : (i === 3 ? -.2 : 0) }); // 문
      add(mWhite, .4, .4, .55, dx, 0, zN + .45);
    }
    col(cx - 3.45, cx + 1.05, zN + 1.95, zN + 2.05);
    // 세면대 & 거울
    [-5.4, -4.2, -3.0].forEach(z => { add(mWhite, .5, .15, .6, cx + 3.55, .8, z, { col: false }); add(mWhite, .2, .8, .2, cx + 3.65, 0, z); plane(cur.interior, mGlass, .8, .9, cx + 3.83, 1.6, z, -Math.PI / 2); });
    col(cx + 3.25, cx + 3.85, -6.0, -2.6);
    papers(cx, -8, -3, 8);
  }
  function stairRoom(cx) {
    // 계단(장식) + 창
    const sg = new THREE.BoxGeometry(2.6, 1, .5);
    const stepMesh = new THREE.InstancedMesh(sg, mWall, 14);
    for (let i = 0; i < 14; i++) { const h = (i + 1) * .24; _o.position.set(cx - 2.5, h / 2, -2.45 - i * .5); _o.scale.set(1, h, 1); _o.rotation.set(0, 0, 0); _o.updateMatrix(); stepMesh.setMatrixAt(i, _o.matrix); }
    stepMesh.instanceMatrix.needsUpdate = true; stepMesh.frustumCulled = false; cur.interior.add(stepMesh);
    col(cx - 3.8, cx - 1.2, -9.6, -2.2);
    add(mRust, .06, 1.0, 6.5, cx - 1.15, .6, -5.5);
    plane(cur.interior, mWin, 2.0, 1.8, cx + 1.8, 1.9, -9.58);
    // 계단 표시
    const sg2 = new THREE.MeshBasicMaterial({ map: T.makeSign('▲ 위층   ▼ 아래층', '#1e2a2e', '#d9e4d0', 26), transparent: false });
    plane(cur.interior, sg2, 1.8, .45, cx + 1.8, 2.6, -9.57);
    // 낡은 소방 장비
    add(S(null, { color: 0x8a1a1a, roughness: .6 }), .22, .5, .22, cx + 3.5, 0, -3.0);
    // 중앙계단 쓰레기
    papers(cx, -8, -3, 6);
  }

  /* ---------- 층 빌드 ---------- */
  const mDeskSign = {};
  function buildFloor(f) {
    const F = { f, y0: f * FH, interior: new THREE.Group(), shell: new THREE.Group(), col: [], walls: [], lamps: [], nodes: [], edges: [] };
    F.interior.position.y = F.y0; F.shell.position.y = F.y0;
    scene.add(F.interior, F.shell); floors.push(F); cur = F;
    const Z0 = -9.9, Z1 = 1.75, X0 = -36.3, X1 = 36.3;
    const lay = LAYOUT[f];

    // 바닥/천장
    flat(F.interior, mFloorTile, X0, X1, -1.75, Z1, 0);
    flat(F.interior, mCeil, X0, X1, Z0, Z1, CH, 4, false);
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
    for (let x = -34; x <= 34; x += 4) { if (f === 0 && Math.abs(x) < 3) continue; wins.push(x); }
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
        const wp = new THREE.Mesh(new THREE.PlaneGeometry(o.w, 1.6), mWin); wp.position.set(o.x, 1.7, 1.6); F.shell.add(wp);
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
    // 충돌 보정: 창문 구간도 벽이므로 단일 충돌체로 대체 (현관 제외)
    F.col = F.col.filter(r => !(r.z1 === zs0 && r.z2 === zs1));
    F.walls = F.walls.filter(r => !(r.z1 === zs0 && r.z2 === zs1));
    if (f === 0) { col(-36.3, -1.5, zs0, zs1, true); col(1.5, 36.3, zs0, zs1, true); }
    else col(-36.3, 36.3, zs0, zs1, true);

    // 지붕 / 시계탑
    if (f === 2) {
      F.shell.add(boxMesh(X0 - .3, X1 + .3, FH, FH + .4, Z0 - .3, Z1 + .3, mWall));
      F.shell.add(boxMesh(X0 - .3, X1 + .3, FH + .4, FH + 1.0, Z1, Z1 + .2, mWall));
      F.shell.add(boxMesh(-5, 5, FH, FH + 3.2, -4.5, 1.9, mWall));
      F.shell.add(boxMesh(-5.4, 5.4, FH + 3.2, FH + 3.6, -4.9, 2.3, mWall));
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
      if (lay.types[i] !== 'stair' && rnd() < .75) {
        const dl = new THREE.Mesh(new THREE.BoxGeometry(.9, 2.2, .05), mDoor); dl.geometry.translate(.45, 1.1, 0);
        dl.position.set(cx - .95, 0, -1.6); dl.rotation.y = rr(.9, 1.5); F.interior.add(dl);
      }
      // 교실 명패
      const sg = new THREE.MeshBasicMaterial({ map: T.makeSign(lay.names[i], '#1e2a2e', '#d9e4d0', lay.names[i].length > 3 ? 28 : 36), color: 0x9aa59a });
      plane(F.interior, sg, 1.0, .25, cx, 2.62, -1.43);
    });
    for (const b of [-28, -20, -12, -4, 4, 12, 20, 28]) wallSeg(b - .15, b + .15, -9.6, -1.75, 0, CH);

    // 방별 가구
    SLOTS.forEach((cx, i) => {
      const t = lay.types[i];
      ({ class: classroom, office, nurse, counsel, library, lab, computer, music, art, toilet, stair: stairRoom })[t](cx, lay.names[i]);
    });
    if (f === 0) addNote('n1', SLOTS[5] + 2.0, .77, -7.2, 0.3);

    // 조명 (형광등) — 복도 + 각 방
    const addLamp = (x, z, ang) => {
      const r = rnd(); const kind = r < .35 ? 'on' : r < .62 ? 'flick' : 'dead';
      const m = kind === 'on' ? matLampOn : kind === 'dead' ? matLampDead : flickerMats[(rnd() * 4) | 0];
      const tube = new THREE.Mesh(new THREE.BoxGeometry(1.3, .05, .12), m); tube.position.set(x, CH - .1, z); tube.rotation.y = ang; F.interior.add(tube);
      const hs = new THREE.Mesh(new THREE.BoxGeometry(1.4, .04, .22), lampHousing); hs.position.set(x, CH - .04, z); hs.rotation.y = ang; F.interior.add(hs);
      F.lamps.push({ x, y: F.y0 + CH - .5, z, kind, mat: m });
    };
    for (let x = -28; x <= 28; x += 8) addLamp(x + 4 * 0, 0, 0);
    addLamp(-34, 0, 0); addLamp(34, 0, 0);
    // 현관 근처 1F 램프는 반드시 켜짐
    SLOTS.forEach((cx, i) => { addLamp(cx - 2, -5.6, 0); addLamp(cx + 2, -5.6, 0); });
    if (f === 0) { const a = F.lamps.find(l => Math.abs(l.x) < 5 && Math.abs(l.z) < .1); if (a) { a.kind = 'on'; a.mat = matLampOn; } }

    // 사물함(숨는 곳)
    const lockSlots = [1, 3, 6, 8];
    lockSlots.forEach(i => {
      const cx = SLOTS[i];
      for (let k = 0; k < 3; k++) {
        add(mLocker, .62, 1.85, .5, cx + 2.0 + k * .66, 0, -1.2, { col: true });
        const lx = cx + 2.0 + k * .66;
        plane(F.interior, new THREE.MeshBasicMaterial({ color: 0x0a0a0a }), .06, .35, lx + .12, 1.35, -.94);
      }
      lockers.push({ floor: f, x: cx + 2.66, z: -1.2, y: F.y0 });
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

  /* ---------- 야외 ---------- */
  cur = floors[0];
  const OUT = new THREE.Group(); scene.add(OUT);
  const g0 = floors[0];
  const addO = (mat, w, h, d, x, y, z, o = {}) => add(mat, w, h, d, x, y, z, { ...o, parent: OUT });
  const outWall = (x1, x2, z1, z2, h, mat, wall = true) => { const m = boxMesh(x1, x2, 0, h, z1, z2, mat); OUT.add(m); col(x1, x2, z1, z2, wall); };

  // 지면
  const groundMat = S(T.makeGround()); flat(OUT, groundMat, -300, 300, -250, 300, -.02, 8);
  const dirtMat = S(T.makeDirt()); flat(OUT, dirtMat, -34, 34, 16, 60, 0, 6);
  const pave = S(T.makePaving()); flat(OUT, pave, -3.2, 3.2, 1.75, 69.5, .01, 4); flat(OUT, pave, -16, 16, 1.75, 11, .01, 4);
  flat(OUT, pave, -46, 46, 11, 14, .005, 4);
  const asph = S(T.makeAsphalt()); flat(OUT, asph, -120, 120, 73, 82, 0.005, 8);
  // 웅덩이
  const puddle = new THREE.MeshStandardMaterial({ color: 0x0a1018, roughness: .05, metalness: .5 });
  [[0, 9], [-2, 30], [1.5, 50], [-20, 40], [14, 30]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.CircleGeometry(rr(1, 2.2), 20), puddle); p.rotation.x = -Math.PI / 2; p.position.set(x, .02, z); OUT.add(p); });

  // 외곽 담장
  const fenceH = 2.8;
  outWall(-50, -4.5, GATE_Z - .25, GATE_Z + .25, fenceH, mFence);
  outWall(4.5, 50, GATE_Z - .25, GATE_Z + .25, fenceH, mFence);
  outWall(-50.25, -49.75, -26, GATE_Z, fenceH, mFence);
  outWall(49.75, 50.25, -26, GATE_Z, fenceH, mFence);
  outWall(-50, 50, -26.25, -25.75, fenceH, mFence);
  // 정문 기둥
  const pillarM = S(T.makeFence()); const plaque = new THREE.MeshStandardMaterial({ map: T.makeGatePlaque(), roughness: .9 });
  [[-4.5], [4.5]].forEach(([px]) => {
    const p = boxMesh(px - .65, px + .65, 0, 3.4, GATE_Z - .65, GATE_Z + .65, pillarM); OUT.add(p); col(px - .65, px + .65, GATE_Z - .65, GATE_Z + .65, true);
    const cap = boxMesh(px - .8, px + .8, 3.4, 3.65, GATE_Z - .8, GATE_Z + .8, pillarM); OUT.add(cap);
    plane(OUT, plaque, .75, 1.5, px, 2.0, GATE_Z + .66);
  });
  const warn = new THREE.MeshStandardMaterial({ map: T.makeWarning(), roughness: .8 });
  plane(OUT, warn, 1.1, .7, -7.5, 1.7, GATE_Z + .27); plane(OUT, warn, 1.1, .7, 12, 1.7, GATE_Z - .27, Math.PI);
  plane(OUT, warn, 1.1, .7, 9.5, 1.7, GATE_Z + .27);
  // 철문
  const gate = { open: 0, target: 0, leaves: [], wall: null };
  const gateBars = new THREE.Group(); OUT.add(gateBars);
  const mkLeaf = (hx, dir) => {
    const piv = new THREE.Group(); piv.position.set(hx, 0, GATE_Z);
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
  const chain = new THREE.Mesh(new THREE.TorusGeometry(.18, .03, 6, 12), mRust); chain.position.set(0, 1.2, GATE_Z); OUT.add(chain);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(.18, .22, .1), S(null, { color: 0x6a5a30, metalness: .8, roughness: .4 })); lock.position.set(0, 1.0, GATE_Z + .06); OUT.add(lock);
  const lockGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.makeGlow('255,40,30'), blending: THREE.AdditiveBlending, depthWrite: false }));
  lockGlow.scale.set(.9, .9, .9); lockGlow.position.set(0, 1.0, GATE_Z + .15); OUT.add(lockGlow); gate.lockGlow = lockGlow;
  gate.blockRect = { x1: -4, x2: 4, z1: GATE_Z - .12, z2: GATE_Z + .12 };

  // 외부 경계 (보이지 않는 벽)
  [[-60, -59, 70, 90], [59, 60, 70, 90], [-60, 60, 82, 83]].forEach(([a, b, c, d]) => col(a, b, c, d));
  col(-60, -50, GATE_Z - .5, GATE_Z + .5);

  // 별관 건물(체육관/급식실) — 외관만
  const gym = boxMesh(28, 48, 0, 8, 8, 30, mWall); OUT.add(gym); col(28, 48, 8, 30, true);
  [-1, 1].forEach(sd => { const r = new THREE.Mesh(new THREE.BoxGeometry(10.6, .3, 23), mRoofRed); r.position.set(38 + sd * 5, 8.9, 19); r.rotation.z = -sd * .2; OUT.add(r); });
  const cafe = boxMesh(-48, -30, 0, 4.5, 8, 22, mWall); OUT.add(cafe); col(-48, -30, 8, 22, true);
  const cafeRoof = new THREE.Mesh(new THREE.BoxGeometry(19, .4, 15), mRoofRed); cafeRoof.position.set(-39, 4.7, 15); cafeRoof.rotation.z = .08; OUT.add(cafeRoof);
  [[33, 8.02], [38, 8.02], [43, 8.02]].forEach(([x, z]) => plane(OUT, mWin, 3, 1.6, x, 5.2, z, Math.PI));
  [[-44, 8.02], [-39, 8.02], [-34, 8.02]].forEach(([x, z]) => plane(OUT, mWin, 3, 1.6, x, 2.4, z, Math.PI));

  // 축구 골대
  [[16], [57]].forEach(([z]) => { const m = mMetal; [-3.6, 3.6].forEach(x => addO(m, .1, 2.4, .1, x, 0, z)); addO(m, 7.3, .1, .1, 0, 2.4, z); });

  // 나무
  const trunkG = new THREE.CylinderGeometry(.18, .3, 3.2, 6); trunkG.translate(0, 1.6, 0);
  const crown1 = new THREE.IcosahedronGeometry(1.9, 1); crown1.translate(0, 4.2, 0);
  const crown2 = new THREE.IcosahedronGeometry(1.3, 1); crown2.translate(.7, 5.4, .3);
  const crownG = merge([crown1, crown2].map(g => { const n = g; const idx = []; const c = n.attributes.position.count; for (let i = 0; i < c; i++) idx.push(i); n.setIndex(idx); return n; }));
  const treeM = [];
  const tpos = [];
  for (let i = 0; i < 110; i++) {
    let x, z;
    if (i < 46) { // 담장 안쪽
      const side = (rnd() * 4) | 0;
      if (side === 0) { x = rr(-48, 48); z = rr(66, 68.5); } else if (side === 1) { x = rr(-48.5, -45); z = rr(-24, 66); } else if (side === 2) { x = rr(45, 48.5); z = rr(-24, 66); } else { x = rr(-48, 48); z = rr(-24, -20); }
      if (Math.abs(x) < 7 && z > 60) continue;
      if (z > 11 && z < 14) continue;
    } else { // 담장 바깥 숲
      const a = rnd() * 6.28, r = rr(58, 130); x = Math.cos(a) * r * 1.3; z = 20 + Math.sin(a) * r * .95;
      if (Math.abs(x) < 54 && z > -30 && z < 90) continue;
      if (z > 70 && z < 84 && Math.abs(x) < 120) continue;
    }
    tpos.push([x, z]);
  }
  tpos.forEach(([x, z], i) => { const s = rr(.8, 1.5); _o.position.set(x, 0, z); _o.rotation.set(0, rnd() * 6, 0); _o.scale.set(s, s * rr(.9, 1.3), s); _o.updateMatrix(); treeM.push(_o.matrix.clone()); if (i < 46 && Math.abs(x) < 49) col(x - .35, x + .35, z - .35, z + .35); });
  inst(OUT, trunkG, S(null, { color: 0x2a1e14 }), treeM);
  inst(OUT, crownG, new THREE.MeshStandardMaterial({ color: 0x1b2a14, roughness: 1, flatShading: true }), treeM);
  // 풀
  const grassG = new THREE.ConeGeometry(.07, .6, 4); grassG.translate(0, .3, 0);
  const grM = []; for (let i = 0; i < 900; i++) {
    let x = rr(-48, 48), z = rr(2, 68); if (Math.abs(x) < 2.5 && rnd() < .8) x += 6 * Math.sign(x || 1);
    _o.position.set(x, 0, z); _o.rotation.set(rr(-.3, .3), rnd() * 6, rr(-.3, .3)); _o.scale.setScalar(rr(.6, 1.8)); _o.updateMatrix(); grM.push(_o.matrix.clone());
  }
  inst(OUT, grassG, new THREE.MeshStandardMaterial({ color: 0x2f4a22, roughness: 1 }), grM);

  // 하늘: 별 + 달
  const sp = []; for (let i = 0; i < 700; i++) { const a = rnd() * 6.28, e = rr(.08, 1.4); const r = 230; sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  const starG = new THREE.BufferGeometry(); starG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starG, new THREE.PointsMaterial({ color: 0xbcc8e8, size: 1.3, sizeAttenuation: false, fog: false })); scene.add(stars);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 24, 16), new THREE.MeshBasicMaterial({ color: 0xe6ecff, fog: false })); moon.position.set(-60, 105, -190); scene.add(moon);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.makeGlow('150,180,255'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  moonGlow.scale.set(90, 90, 1); moonGlow.position.copy(moon.position); scene.add(moonGlow);

  /* ---------- 갱신 ---------- */
  function update(t, blackout) {
    flickerMats.forEach((m, i) => {
      const k = Math.sin(t * (9 + i * 3.1) + i) * Math.sin(t * (23 + i * 5.3));
      const v = blackout ? 0.0 : (k > .35 ? 1 : (k > -.2 ? .08 : .45));
      m.color.setRGB(.87 * v + .02, .92 * v + .02, v + .02);
    });
    matLampOn.color.setRGB(blackout ? .02 : .87, blackout ? .02 : .92, blackout ? .02 : 1);
    for (const it of items) if (!it.taken && it.kind !== 'note') { it.mesh.position.y = it.pos.y - floors[it.floor].y0 + Math.sin(t * 2 + it.pos.x) * .03; it.mesh.rotation.y = t * 1.2; }
    lockGlow.material.opacity = .6 + .4 * Math.sin(t * 3);
  }

  return { floors, items, lockers, gate, update, mats: { flickerMats, matLampOn }, NOTES };
}

/* ---------- 충돌/시야 ---------- */
export function collide(cols, p, r) {
  for (let it = 0; it < 3; it++) for (const c of cols) {
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
