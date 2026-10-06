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

const NOTES = {
  n1: { title: '3학년 1반 일기', text: '오늘도 아무도 오지 않았다.<br>선생님은 칠판에 같은 말만 쓰신다.<br><b>“다시, 여기서.”</b><br>나는 이 문장을 몇 번째 읽고 있는 걸까.' },
  n2: { title: '보건 일지', text: '복도에서 쓰러진 여학생이 실려 옴.<br>그런데 아무도 이 아이의 이름을 기억하지 못한다.<br>출석부에도, 졸업앨범에도 없다.<br>아이는 불을 끄지 말라고 했다.' },
  n3: { title: '교무회의록', text: '폐교 결정. 마지막 졸업식은 열리지 않았다.<br>정문 열쇠는 사고를 막기 위해 <b>다섯 조각</b>으로 나누어 보관한다.<br>3층 음악실의 피아노는 절대 건드리지 말 것.' },
  n4: { title: '도서 대출 카드', text: '같은 이름이 수백 번 적혀 있다.<br>마지막 대출일은 <b>오늘</b>이다.<br>반납란은 비어 있다.' },
  n5: { title: '실험 노트', text: '불을 끄면 그녀가 온다.<br>빛이 있는 곳에는 쉽게 다가오지 못한다.<br>하지만 건전지는 영원하지 않다.<br>달리면 소리가 난다. 그녀는 <b>듣는다</b>.' },
  n13: { title: '급식 일지', text: '오늘의 급식: 아무도 먹지 않았다.<br>식판은 매일 같은 자리에 놓여 있다. 한 명분이 모자란 채로.<br>배식대 끝에 <b>응급 상자</b>를 두고 간 사람이 있다.' },
  n14: { title: '동아리 활동일지', text: '“우리끼리 만든 학교 괴담 모임.”<br>마지막 회의록: 3층 창가에서 누군가 손을 흔들었다.<br>아무도 따라 올라가지 않았다. 딱 한 명만 빼고.', annex: true },
  n15: { title: '스마트교실 로그', text: '전자칠판이 혼자 켜진다.<br>화면에는 매번 같은 교실 사진. 칠판에는 <b>“다시, 여기서.”</b><br>시스템을 껐는데도 화면이 꺼지지 않는다.', annex: true },
  n16: { title: '가정 실습 노트', text: '재봉틀 소리가 밤마다 들린다.<br>실밥이 풀린 교복 한 벌이 의자에 걸려 있다.<br>이름표에는 아무것도 적혀 있지 않다.', annex: true },
  n8: { title: '방송 대본', text: '“교내 방송입니다. 모두 교실로 돌아가세요.”<br>마지막 방송 뒤, 스피커에서 계속 숨소리가 들렸다.<br>마이크는 꺼져 있었는데도.' },
  n9: { title: '체육 일지', text: '졸업식 예행연습 중 무대 커튼 뒤에서 누군가 박수를 쳤다.<br>관람석은 비어 있었다.<br>그날 이후 체육관 불은 켜지지 않는다.' },
  n10: { title: '수영장 안전 일지', text: '물을 뺀 뒤에도 레인 쪽에서 물소리가 난다.<br>감시대 위에 앉아 있던 아이는 아무도 구하지 못했다.<br>펌프실 문은 지하로 이어져 있다.' },
  n11: { title: '보일러실 점검표', text: '지하 B1 점검 완료. 비상 통로는 폐쇄.<br>단, <b>정문 열쇠가 모두 모이면</b> 비상 통로 자물쇠가 풀린다.<br>그 길은 정문 쪽 담장으로 이어진다.' },
  n12: { title: '낡은 명부', text: '졸업생 명부에 이름 하나가 붉게 지워져 있다.<br>이름 옆에 적힌 말: <b>“다시, 여기서.”</b>' },
  n7: { title: '옥상 일지', text: '안테나는 오래전에 끊겼다.<br>방송실의 마지막 방송이 아직도 귓가에 남아 있다.<br><b>“모두 교실로 돌아가세요.”</b><br>아무도 대답하지 않았다. 아무도.' },
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
  const items = [], lockers = [], flickerMats = [], doors = [];
  const mBase = new THREE.MeshStandardMaterial({ map: T.makeBasement(), roughness: .95 });
  let curWall = mWall;
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
    const m = boxMesh(x1, x2, y1, y2, z1, z2, curWall);
    (shell ? cur.shell : cur.interior).add(m);
    if (y1 < 1) col(x1, x2, z1, z2, true);
  }
  function addNote(id, x, y, z, ry = 0) {
    if (!!cur.annex !== !!NOTES[id].annex) return;
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
  function addMedkit(x, y, z) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(.3, .18, .1), mWhite));
    const red = new THREE.MeshBasicMaterial({ color: 0xc02020 });
    g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(.16, .05, .11), red)));
    g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(.05, .14, .11), red)));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexR, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.set(.8, .8, .8); g.add(sp);
    g.position.set(x, y + .12, z); cur.interior.add(g);
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
    addBattery(cx + 2.4, .5, -8.4); addMedkit(cx + 2.4, .66, -7.6);
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
    add(mBlack, 1.5, .8, 2.0, cx + 2.2, .15, -8.2, { col: true });
    add(mBlack, 1.4, .05, 1.6, cx + 2.2, .95, -8.3, { rz: 0 });
    [[-.6, -.8], [.6, -.8], [0, .8]].forEach(([dx, dz]) => add(mBlack, .1, .15, .1, cx + 2.2 + dx, 0, -8.2 + dz));
    add(mWhite, 1.3, .03, .2, cx + 2.2, .96, -7.1);
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
    if (!cur.basement) plane(cur.interior, mWin, 2.0, 1.8, cx + 1.8, 1.9, -9.58);
    // 계단 표시
    const sg2 = new THREE.MeshBasicMaterial({ map: T.makeSign('▲ 위층   ▼ 아래층', '#1e2a2e', '#d9e4d0', 26), transparent: false });
    plane(cur.interior, sg2, 1.8, .45, cx + 1.8, 2.6, -9.57);
    // 낡은 소방 장비
    add(S(null, { color: 0x8a1a1a, roughness: .6 }), .22, .5, .22, cx + 3.5, 0, -3.0);
    // 중앙계단 쓰레기
    papers(cx, -8, -3, 6);
  }

  /* ---------- 방송실 · 지하층 방 가구 ---------- */
  const mScreen = new THREE.MeshBasicMaterial({ color: 0x3f7090 });
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
    addNote('n8', cx - 1.8, .8, -7.6);
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
    for (let k = 0; k < 4; k++) { add(mLocker, .9, 2.0, .45, cx - 2.7 + k * 1.8, 0, -9.35, { col: true }); plane(cur.interior, mWarnS, .5, .3, cx - 2.7 + k * 1.8, 1.5, -9.1); }
    add(mBlack, .4, .15, 5, cx + 1, 0, -5.5); add(mBlack, .4, .15, 4, cx - 1.5, 0, -6);
    add(mWood, 1, .5, 1, cx + 3, 0, -3.5, { col: true }); addMedkit(cx + 3, .5, -3.5);
    papers(cx, -8, -2.4, 4);
  }
  function storage(cx) {
    [-2.9, 2.9].forEach(dx => [-8.0, -5.8, -3.6].forEach(z => { add(mMetal, .5, 2.0, 1.8, cx + dx, 0, z, { col: true }); add(mWood, .4, .4, .5, cx + dx + (dx < 0 ? .3 : -.3), 0, z); }));
    add(mWood, 1, .9, 1, cx, 0, -8.6, { col: true }); add(mWood, .8, .7, .8, cx + .8, 0, -8.0);
    addBattery(cx, .9, -8.6); papers(cx, -8, -2.4, 7);
  }
  function records(cx) {
    [-2.9, 2.9].forEach(dx => [-8.2, -6.0].forEach(z => { add(mMetal, .5, 2.1, 2.0, cx + dx, 0, z, { col: true }); plane(cur.interior, mBooks, 1.9, 2.0, cx + dx + (dx < 0 ? .26 : -.26), 1.05, z, dx < 0 ? Math.PI / 2 : -Math.PI / 2); }));
    add(mWoodDark, 1.6, .75, .8, cx, 0, -8.4, { col: true }); addNote('n12', cx + .3, .77, -8.4);
    papers(cx, -8, -2.4, 12);
  }
  function cleaning(cx) {
    [[-2.5, -8], [-1.6, -8.4], [2.8, -3.5]].forEach(([dx, z]) => cyl(S(null, { color: 0x2a4a7a }), .22, .4, cx + dx, 0, z));
    [-2, -1.5].forEach(dx => add(mWood, .04, 1.5, .04, cx + dx, 0, -9.3));
    add(mMetal, .5, 2, 3, cx + 3.3, 0, -6.5, { col: true }); add(mWood, .9, .7, .9, cx, 0, -8.6, { col: true });
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
      ({ class: classroom, office, nurse, counsel, library, lab, computer, music, art, toilet, stair: stairRoom, cooking, craft, broadcast, boiler, electric, storage, records, cleaning, generator, pump, exit: exitRoom })[t](cx, lay.names[i]);
    });
    if (f === 2) addMedkit(SLOTS[3] + 2.6, .77, -8.6);
    if (f === 1) addMedkit(SLOTS[1] + 2.6, .77, -8.6);
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
      lockers.push({ floor: f, x: cx + 2.66, z: -1.2, y: F.y0, dir: { x: 0, z: 1 } });
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
    add(mWoodDark, 3.6, 2.0, .45, cx, 0, zN + .3, { col: true }); plane(cur.interior, mBooks, 3.4, 1.8, cx, 1.0, zN + .54);
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
    [11, 15, 19].forEach(z => plane(F.interior, mWin, 2.4, 1.6, x0 + t + .02, 2.4, z, Math.PI / 2));
    [-45, -34].forEach(x => plane(F.interior, mWin, 3, 1.6, x, 2.4, z1 - t - .02, Math.PI));
    // 배식대 + 조리실
    add(mMetal, 12, .9, .9, -40.2, 0, 12.9, { col: true }); add(mGlass, 12, .35, .6, -40.2, .9, 12.9);
    for (let k = 0; k < 8; k++) add(mMetal, .3, .04, .25, -45.5 + k * 1.4, .95, 13.3);
    plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('골고루 먹고 건강하게!', '#2a3a2a', '#d0e0c0', 24), color: 0xaab0a0 }), 3.2, .8, -41, 2.8, z0 + t + .02);
    add(mMetal, 3, .9, 1, -45, 0, 10, { col: true }); add(mMetal, 2.4, .9, 1, -41, 0, 10, { col: true }); add(mMetal, 2.6, .5, 1.2, -41, 3.0, 10);
    cyl(mMetal, .35, .45, -45, .9, 10); cyl(mMetal, .3, .4, -41.5, .9, 10); add(mMetal, 1.2, 1.3, 1.0, -46.9, 0, 11.6, { col: true });
    add(mMetal, .5, 2, 3, -30.75, 0, 10.2, { col: true }); add(mWood, .8, .6, .8, -32.5, 0, 9.2, { col: true }); add(mWood, .8, .6, .8, -32.4, .6, 9.2);
    add(mMetal, .8, 1.1, .6, -30.8, 0, 17, { col: true });
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
    addBattery(-34.9, .72, 19.2);
    for (let k = 0; k < 8; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.28, .2), mDirtPaper); m.rotation.set(-Math.PI / 2, 0, rnd() * 6); m.position.set(rr(-46, -32), .02, rr(14, 21)); F.interior.add(m); }
    add(mLocker, .62, 1.85, .55, -31.3, 0, 8.6 + .28 + 1.3, { col: true }); add(mLocker, .62, 1.85, .55, -31.3 - .66, 0, 8.6 + .28 + 1.3, { col: true });
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
    add(mBlack, 3.2, 1.6, .08, cx, .9, zN + .1); const sc = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.4), mScreen); sc.position.set(cx, 1.7, zN + .15); cur.interior.add(sc);
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
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), mScreen); sc.position.set(cx, 1.9, zN + .15); cur.interior.add(sc);
    addBattery(cx - 3.2, 0, -3.2); papers(cx, -8, -2.4, 7);
  }
  function club(cx) {
    const zN = -9.6;
    frontWall(cx, zN, false);
    add(mWood, 4.2, .75, 1.2, cx, 0, -6.4, { col: true });
    [-1.6, -.5, .6, 1.7].forEach(dx => [-1, 1].forEach(s => add(mBlack, .4, .45, .4, cx + dx, 0, -6.4 + s * 1.0)));
    add(mWoodDark, .4, 2.0, 3.2, cx - 3.6, 0, -6.4, { col: true }); plane(cur.interior, mBooks, 3.0, 1.9, cx - 3.38, 1.0, -6.4, Math.PI / 2);
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
    flat(F.interior, mCeil, X0, X1, Z0, Z1, CH, 4, false);
    awall(X0, X1, Z0, -9.6, CH); awall(X0, -20, -9.6, Z1, CH); awall(20, X1, -9.6, Z1, CH);
    if (k === 0) {
      awall(X0, -1.5, 1.45, Z1, CH); awall(1.5, X1, 1.45, Z1, CH); awall(-1.5, 1.5, 1.45, Z1, CH, 2.7);
      [-1.5, 1.5].forEach(x => add(mWoodDark, .12, 2.7, .4, x, 0, 1.6));
      plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign('주출입구', '#1e2a2e', '#d9e4d0', 30), color: 0x9aa59a }), 1.4, .35, 0, 3.0, 1.43, Math.PI);
    } else awall(X0, X1, 1.45, Z1, CH);
    [-16, -12, -8, 8, 12, 16].concat(k ? [-4, 0, 4] : []).forEach(x => plane(F.interior, mWin, 2.4, 1.6, x, 1.7, 1.44, Math.PI));
    sl.forEach((cx, i) => {
      awall(cx - 4, cx - 1, -1.75, -1.45, CH); awall(cx + 1, cx + 4, -1.75, -1.45, CH); awall(cx - 1, cx + 1, -1.75, -1.45, CH, 2.4);
      add(mWoodDark, .1, 2.4, .36, cx - 1.0, 0, -1.6); add(mWoodDark, .1, 2.4, .36, cx + 1.0, 0, -1.6);
      plane(F.interior, new THREE.MeshBasicMaterial({ map: T.makeSign(spec.names[i], '#1e2a2e', '#d9e4d0', spec.names[i].length > 6 ? 22 : 28), color: 0x9aa59a }), 1.4, .35, cx, 2.62, -1.43);
    });
    [-12, -4, 4, 12].forEach(b => awall(b - .15, b + .15, -9.6, -1.75, CH));
    const fn = { stair: stairRoom, cooking, tech, fusion, counsel, computer, lang, smart, club, music, art, craft, lab };
    sl.forEach((cx, i) => fn[spec.types[i]](cx, spec.names[i]));
    [-12, -4, 4, 12].forEach(x => areaLamp(x, 0, CH - .1)); sl.forEach(cx => { areaLamp(cx - 2, -5.6, CH - .1); areaLamp(cx + 2, -5.6, CH - .1); });
    [2, 3].forEach(i => { const cx = sl[i]; for (let q = 0; q < 3; q++) add(mLocker, .62, 1.85, .5, cx + 2.0 + q * .66, 0, -1.2, { col: true }); lockers.push({ floor: f, x: cx + 2.66, z: -1.2, y: y0, dir: { x: 0, z: 1 } }); });
    for (let q = 0; q < 24; q++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.28, .2), mDirtPaper); m.rotation.set(-Math.PI / 2, 0, rnd() * 6.28); m.position.set(rr(-19, 19), .012, rr(-1.2, 1.3)); F.interior.add(m); }
    const xs = new Set(sl); for (let x = -20; x <= 20; x += 4) xs.add(x);
    const arr = [...xs].sort((p, q) => p - q), cn = arr.map(x => { F.nodes.push({ x, z: 0 }); return F.nodes.length - 1; });
    for (let q = 0; q < cn.length - 1; q++) F.edges.push([cn[q], cn[q + 1]]);
    sl.forEach(cx => { F.nodes.push({ x: cx, z: -5.5 }); F.edges.push([cn[arr.indexOf(cx)], F.nodes.length - 1]); });
    F.spawns = [{ x: 18, z: 0 }, { x: -18, z: 0 }, { x: 8, z: -5.5 }];
    finishGraph(F);
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
    [11, 15, 19, 23, 27].forEach(z => { plane(F.interior, mWin, 2.4, 1.8, x0 + t + .02, 5.2, z, Math.PI / 2); plane(F.interior, mWin, 2.4, 1.8, x1 - t - .02, 5.2, z, -Math.PI / 2); });
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
    // 기구
    add(mMetal, 1, .9, .8, 30.4, 0, 14.5, { col: true }); [0, 1, 2].forEach(k => ball(30.1 + k * .3, 14.5, mBall)); ball(30.2, 14.5, mBall);
    add(mBlue, 1.6, .5, .8, 46, 0, 13.4, { col: true }); add(mGreen, 1.5, .4, .8, 46, .5, 13.4);
    add(mWood, .8, .5, .5, 31.5, 0, 25.5, { col: true }); add(mWood, .8, .3, .5, 31.5, .5, 25.5);
    add(mWood, .4, .45, 2.2, 33.5, 0, 28.3, { col: true });
    add(mBlack, .5, .8, .4, x0 + t + .3, 4.8, 12); add(mBlack, .5, .8, .4, x1 - t - .3, 4.8, 12);
    for (let k = 0; k < 6; k++) ball(rr(31, 45), rr(14, 27), mBall);
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(.15, .45, 8), S(null, { color: 0xc05a20 })); c.position.set(rr(32, 44), .22, rr(15, 26)); cur.interior.add(c); }
    const pud = new THREE.MeshStandardMaterial({ color: 0x0a1018, roughness: .05, metalness: .5 });
    [[35, 18], [41, 23], [37, 15]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.CircleGeometry(rr(.8, 1.6), 18), pud); p.rotation.x = -Math.PI / 2; p.position.set(x, .03, z); cur.interior.add(p); });
    papers(38, 12, 28, 18, 8);
    // 숨을 곳 (기구함)
    for (let k = 0; k < 3; k++) add(mLocker, .55, 1.85, .62, x0 + t + .28, 0, 23.3 + k * .66, { col: true });
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
    [29, 34, 39, 44].forEach(z => plane(F.interior, mWin, 3.2, 2.2, x0 + t + .02, 3.6, z, Math.PI / 2));
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
    // 남/여 탈의실 (분리된 방)
    const wz = 30.0, signM = n => new THREE.MeshBasicMaterial({ map: T.makeSign(n, '#1e2a2e', '#d9e4d0', 28), color: 0x9aa59a });
    awall(x0 + t, -45, wz, wz + t, H); awall(-44, -41.65, wz, wz + t, H); awall(-41.65, -41.35, z0 + t, wz, H);
    awall(-41.35, -38, wz, wz + t, H); awall(-37, x1 - t, wz, wz + t, H);
    awall(-45, -44, wz, wz + t, H, 2.4); awall(-38, -37, wz, wz + t, H, 2.4);
    plane(F.interior, signM('남자 탈의실'), 1.4, .35, -44.5, 2.7, wz + t + .02, 0); plane(F.interior, signM('여자 탈의실'), 1.4, .35, -37.5, 2.7, wz + t + .02, 0);
    for (let k = 0; k < 7; k++) { add(mLocker, .62, 1.85, .55, -47.2 + k * .66, 0, z0 + t + .28, { col: true }); add(mLocker, .62, 1.85, .55, -40.9 + k * .66, 0, z0 + t + .28, { col: true }); }
    add(mWood, 2.0, .45, .4, -45.2, 0, 28.3, { col: true }); add(mWood, 2.0, .45, .4, -38.2, 0, 28.3, { col: true });
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
  const mBrick = S(T.makeWall(), { color: 0xb87a60 });
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
  OUT.add(boxMesh(-20, 20, 0, 12.4, -25, -13.5, mBrick)); col(-20, 20, -25, -13.5, true);
  OUT.add(boxMesh(-20.4, 20.4, 12.4, 12.9, -25.4, -13.1, mWall));
  [1.8, 5.8, 9.8].forEach((y, r) => { for (let x = -18; x <= 18; x += 4) { if (r === 0 && Math.abs(x) < 3) continue; plane(OUT, mWin, 2.4, 1.6, x, y, -13.47, 0); } });
  plane(OUT, mDoor, 1.8, 2.4, 0, 1.2, -13.47, 0);
  plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('별관 (특별교실동)', '#1e2a2e', '#d9e4d0', 26), color: 0x9aa59a }), 3.4, .85, 0, 3.6, -13.46, 0);
  doors.push({ floor: 0, x: 0, z: -12.4, r: 2.0, label: '별관 들어가기', to: { floor: 8, x: 0, z: .2, yaw: 0 } });

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
  const poolB = boxMesh(-48, -34, 0, 6.4, 26, 50, mWall); OUT.add(poolB); col(-48, -34, 26, 50, true);
  const poolRoof = new THREE.Mesh(new THREE.BoxGeometry(14.6, .4, 24.6), mRoofRed); poolRoof.position.set(-41, 6.6, 38); OUT.add(poolRoof);
  [29, 34, 43, 47].forEach(z => plane(OUT, mWin, 2.4, 1.8, -33.98, 3.6, z, Math.PI / 2));
  plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('수 영 장', '#1e2a2e', '#d9e4d0', 34), color: 0x9aa59a }), 2.2, .55, -33.97, 3.3, 38, Math.PI / 2);
  plane(OUT, mDoor, 1.8, 2.4, -33.97, 1.2, 38, Math.PI / 2);
  plane(OUT, mDoor, 1.8, 2.4, 38, 1.2, 30.03, 0);
  plane(OUT, new THREE.MeshBasicMaterial({ map: T.makeSign('체 육 관', '#1e2a2e', '#d9e4d0', 34), color: 0x9aa59a }), 2.2, .55, 38, 3.3, 30.04, 0);
  const cafe = boxMesh(-48, -30, 0, 4.5, 8, 22, mWall); OUT.add(cafe); col(-48, -30, 8, 22, true);
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

  return { floors, items, lockers, doors, gate, update, mats: { flickerMats, matLampOn }, NOTES };
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
