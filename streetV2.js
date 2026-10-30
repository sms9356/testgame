// 캠퍼스 가로 시설 v2 (인도망 v2 와 함께): 보도를 따라 가로등 · 벤치 · 휴지통 · 맨홀 · 배수구 · 안내 표지 · 캠퍼스 안내도 · 볼라드 · 자전거 거치대
//   ── 인도 사각형(window.__pathNET)과 건물 · 시설 금지 구역(window.__pathKEEP + 건물 바닥)을 보고 잔디 쪽 가장자리에만 놓는다
//   ── 같은 모양은 InstancedMesh 한 벌로 (그리기 호출 최소) · 충돌 상자는 바깥 0층 col 에 추가 · 문 · 현관 앞 3m 는 비운다
import * as THREE from './vendor/three.module.js';
import { ZONES as FZ } from './facilityRebuild.js?v=306';

const S = (c, r = .6, m = 0, e) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...(e || {}) });
function signTex(lines, bg = '#1e3a2e', fg = '#f2efe4', w = 512, h = 384, title) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 6; x.strokeRect(8, 8, w - 16, h - 16);
  let y = 30; if (title) { x.fillStyle = fg; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.fillText(title, w / 2, 62); y = 90; x.fillRect(40, 76, w - 80, 3); }
  x.textAlign = 'left'; x.font = '30px sans-serif'; const lh = (h - y - 20) / Math.max(1, lines.length);
  lines.forEach((l, i) => { x.fillStyle = fg; x.fillText(l, 36, y + lh * (i + .72)); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function installStreetscape({ scene, world, floors, footprints = [] }) {
  const NET = window.__pathNET, KEEP = window.__pathKEEP || [];
  if (!NET || !NET.length) return null;
  const F0 = floors[0], C = F0.col || (F0.col = []);
  const ZONES = Object.values(FZ).map(Z => [Z.cx - Z.W / 2, Z.cx + Z.W / 2, Z.cz - Z.D / 2, Z.cz + Z.D / 2]);
  const blocks = [...KEEP, ...footprints, ...ZONES];
  const doors = [...(world.doors || []).filter(d => d.floor === 0).map(d => [d.x, d.z]), [-3, 11.2], [-3, -4.8], [-3, -15.2], [24.9, -16.3], [-30.9, -16.4], [-53.4, 13], [0, 69.6], [-112.4, 55.6]];
  const onPath = (x, z, m = 0) => NET.some(r => x > r[0] - m && x < r[1] + m && z > r[2] - m && z < r[3] + m);
  const inBlock = (x, z, m = .3) => blocks.some(b => x > b[0] - m && x < b[1] + m && z > b[2] - m && z < b[3] + m);
  const hitCol = (x, z, m = .35) => C.some(c => !c.off && c.x1 != null && x > c.x1 - m && x < c.x2 + m && z > c.z1 - m && z < c.z2 + m);
  const nearDoor = (x, z) => doors.some(([dx, dz]) => Math.hypot(dx - x, dz - z) < 3.2);
  const inCampus = (x, z) => x > -112 && x < 112 && z > -98 && z < 68.8;
  const used = [];
  const free = (x, z, r = .5) => inCampus(x, z) && !onPath(x, z, .05) && !inBlock(x, z) && !hitCol(x, z, r) && !nearDoor(x, z) && !used.some(([ux, uz, ur]) => Math.hypot(ux - x, uz - z) < ur + r);
  const take = (x, z, r) => used.push([x, z, r]);

  // ── 모양 (한 벌씩) ──
  const mPole = S(0x2e3236, .45, .7), mHead = S(0xe8e4d8, .4, .2, { emissive: 0xffe2a8, emissiveIntensity: .9 }), mWood = S(0x8a5a32, .7), mSteel = S(0x5a5e62, .4, .75), mBin = S(0x2f5a3a, .6, .3), mBinLid = S(0x23262a, .5, .5),
    mIron = S(0x2a2a2a, .8, .6), mGrate = S(0x3a3c3e, .7, .6), mYellow = S(0xd8b020, .5, .2), mPost = S(0x4a4e52, .5, .6), mConc = S(0x9a968c, .9);
  const geo = {
    pole: new THREE.CylinderGeometry(.055, .075, 4.4, 10).translate(0, 2.2, 0), base: new THREE.CylinderGeometry(.16, .2, .32, 12).translate(0, .16, 0),
    arm: new THREE.BoxGeometry(.06, .06, .9).translate(0, 4.3, .4), head: new THREE.BoxGeometry(.3, .12, .55).translate(0, 4.24, .82),
    seat: new THREE.BoxGeometry(1.7, .05, .44).translate(0, .44, 0), back: new THREE.BoxGeometry(1.7, .36, .05).translate(0, .72, -.22), legs: new THREE.BoxGeometry(.06, .44, .44),
    bin: new THREE.CylinderGeometry(.24, .21, .82, 14).translate(0, .41, 0), lid: new THREE.CylinderGeometry(.26, .26, .06, 14).translate(0, .85, 0),
    man: new THREE.CylinderGeometry(.34, .34, .012, 20).translate(0, .016, 0), grate: new THREE.BoxGeometry(.5, .012, .9).translate(0, .016, 0),
    boll: new THREE.CylinderGeometry(.09, .1, .8, 10).translate(0, .4, 0), bollBand: new THREE.CylinderGeometry(.102, .102, .08, 10).translate(0, .66, 0),
    rack: new THREE.TorusGeometry(.38, .03, 6, 14, Math.PI).rotateY(Math.PI / 2).translate(0, .02, 0), post: new THREE.BoxGeometry(.1, 2.3, .1).translate(0, 1.15, 0),
  };
  const sets = {}; const put = (key, g, m, x, y, z, ry = 0) => { (sets[key] ||= { g, m, L: [] }).L.push([x, y, z, ry]); };
  const flush = () => { const root = new THREE.Group(); root.name = 'STREETSCAPE_V2'; root.userData.rbKeep = true; root.userData.facKeep = true; root.userData.facNew = true;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3(1, 1, 1), Y = new THREE.Vector3(0, 1, 0);
    for (const [k, s] of Object.entries(sets)) { const im = new THREE.InstancedMesh(s.g, s.m, s.L.length); im.name = 'sv2_' + k; im.castShadow = k === 'pole' || k === 'back' || k === 'seat'; im.receiveShadow = true;
      s.L.forEach(([x, y, z, ry], i) => { Q.setFromAxisAngle(Y, ry); P.set(x, y, z); M.compose(P, Q, Sc); im.setMatrixAt(i, M); }); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); root.add(im); }
    return root; };
  const col = (x1, x2, z1, z2, h) => C.push({ x1, x2, z1, z2, h, sv2: true });

  // 각 보도 사각형의 가장자리를 따라 걷으며 배치 (긴 쪽 방향 · 바깥 잔디)
  let lamps = 0, benches = 0, bins = 0, mans = 0, racks = 0;
  NET.forEach((r, ri) => {
    const [x1, x2, z1, z2] = r, w = x2 - x1, d = z2 - z1, alongX = w >= d, L = alongX ? w : d; if (L < 9) return;
    const sides = alongX ? [[z1 - .55, Math.PI, 0, -1], [z2 + .55, 0, 0, 1]] : [[x1 - .55, Math.PI / 2, -1, 0], [x2 + .55, -Math.PI / 2, 1, 0]];
    // 가로등: 15m 마다 한쪽씩 번갈아 (넓은 마당 · 대로에서)
    for (let s = 6, k = 0; s < L - 3; s += 15, k++) {
      const [edge, ry] = sides[k % 2]; let x = alongX ? x1 + s : edge, z = alongX ? edge : z1 + s;
      if (!free(x, z, .5)) { const [e2, r2] = sides[(k + 1) % 2]; x = alongX ? x1 + s : e2; z = alongX ? e2 : z1 + s; if (!free(x, z, .5)) continue; }
      const facing = alongX ? (z < z1 ? 0 : Math.PI) : (x < x1 ? Math.PI / 2 : -Math.PI / 2);   // 팔이 보도 쪽으로
      put('pole', geo.pole, mPole, x, 0, z, facing); put('base', geo.base, mConc, x, 0, z, facing); put('arm', geo.arm, mPole, x, 0, z, facing); put('head', geo.head, mHead, x, 0, z, facing);
      col(x - .15, x + .15, z - .15, z + .15); take(x, z, 1.0); lamps++; }
    // 벤치 + 휴지통: 22m 마다 (보도를 바라보게)
    for (let s = 13; s < L - 5; s += 22) {
      for (const [edge, , ] of sides) { const off = edge + (alongX ? (edge < z1 ? -.25 : .25) : (edge < x1 ? -.25 : .25)); const x = alongX ? x1 + s : off, z = alongX ? off : z1 + s;
        if (!free(x, z, 1.0)) continue; const ry = alongX ? (z < z1 ? 0 : Math.PI) : (x < x1 ? Math.PI / 2 : -Math.PI / 2);
        put('seat', geo.seat, mWood, x, 0, z, ry); put('back', geo.back, mWood, x, 0, z, ry);
        [-.72, .72].forEach(o => { const lx = x + Math.cos(ry) * o, lz = z - Math.sin(ry) * o; put('legs', geo.legs, mSteel, lx, .22, lz, ry); });
        const bw = alongX ? [.9, .25] : [.25, .9]; col(x - bw[0], x + bw[0], z - bw[1], z + bw[1], .8); take(x, z, 1.1); benches++;
        const bx = x + Math.cos(ry) * 1.25, bz = z - Math.sin(ry) * 1.25; if (free(bx, bz, .3)) { put('bin', geo.bin, mBin, bx, 0, bz); put('lid', geo.lid, mBinLid, bx, 0, bz); col(bx - .25, bx + .25, bz - .25, bz + .25, .9); take(bx, bz, .4); bins++; }
        break; } }
    // 맨홀 · 배수구 (보도 위, 걸려 넘어지지 않게 납작): 맨홀 30m · 배수구 18m
    for (let s = 9; s < L - 2; s += 30) { const x = alongX ? x1 + s : (x1 + x2) / 2, z = alongX ? (z1 + z2) / 2 : z1 + s; put('man', geo.man, mIron, x, 0, z); mans++; }
    for (let s = 4; s < L - 2; s += 18) { const x = alongX ? x1 + s : x2 - .3, z = alongX ? z2 - .3 : z1 + s; put('grate', geo.grate, mGrate, x, 0, z, alongX ? Math.PI / 2 : 0); }
  });
  // 자전거 거치대: 본관 앞 광장 동쪽 · 별관 현관 옆 · 청운학사 진입로
  [[22, 14.4, 0], [8.5, -17.2, 0], [-79, -36.0, 0]].forEach(([x, z]) => { for (let k = 0; k < 5; k++) { const rx = x + k * .7; if (!free(rx, z, .3)) continue; put('rack', geo.rack, mSteel, rx, 0, z); take(rx, z, .35); racks++; } });
  // 볼라드: 정문 앞마당 양옆 (차량 진입 막음 · 사람은 사이로)
  [-4.6, 4.0].forEach(x => [60.2, 61.6, 63.0].forEach(z => { put('boll', geo.boll, mPost, x, 0, z); put('bollB', geo.bollBand, mYellow, x, 0, z); col(x - .1, x + .1, z - .1, z + .1); }));
  const root = flush();
  // 캠퍼스 안내도 (정문 앞마당 · 중앙 횡단로 · 서편 대로 남쪽) + 방향 표지 (주요 교차점)
  const mapLines = ['본관 (교실 · 교무실 · 보건실)  ↑ 정면', '별관 (특별실 · 방송실)  ↑ 본관 뒤', '급식실 · 대강당  ← 서쪽', '체육관 · 수영장 · 도서관  → 동쪽', '청운학사 · 역사관 · 천문관  ← 서편 대로', '호수 정원 · 야외음악당  ↑ 북쪽'];
  const boardTex = signTex(mapLines, '#1e3a2e', '#f2efe4', 640, 400, '서문고등학교 캠퍼스 안내');
  const board = (x, z, ry) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    [-.75, .75].forEach(o => { const p = new THREE.Mesh(geo.post, mPost); p.position.x = o; g.add(p); });
    const fr = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, .08), mPost); fr.position.y = 1.65; g.add(fr);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({ map: boardTex, color: 0xd8d8d0 })); pl.position.set(0, 1.65, .045); g.add(pl);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, .06, .35), mPole); roof.position.set(0, 2.25, .05); g.add(roof); root.add(g); col(x - .9, x + .9, z - .2, z + .2); };
  const tryBoard = (x, z, ry) => { if (!inBlock(x, z, .1) && !onPath(x, z) && !hitCol(x, z, .9) && !nearDoor(x, z)) { board(x, z, ry); take(x, z, 1.2); return 1; } return 0; };
  let boards = 0; boards += tryBoard(-6.6, 64.5, Math.PI / 2) || tryBoard(-6.6, 67.5, Math.PI / 2); boards += tryBoard(-10, -12.6, Math.PI); boards += tryBoard(-68.0, 50.5, -Math.PI / 2);
  const dirs = [[-29.6 - .6, 13.9, '↑ 본관 · 급식실', '↓ 운동장 · 정문'], [-50.0 + .6, -12.6, '← 서편 대로 · 급식실', '→ 별관 · 중앙 횡단로'], [69.3 - .6, -12.6, '→ 체육관 · 테니스장', '← 별관 · 본관'], [-69.4 + .6, -31.6, '↑ 청운학사 · 호수 정원', '↓ 역사관 · 학생회관'], [30.6, 53.4, '→ 수영장 · 도서관', '← 정문 · 운동장']];
  let signs = 0; dirs.forEach(([x, z, a, b]) => { if (inBlock(x, z, .1) || hitCol(x, z, .3) || onPath(x, z)) return;
    const g = new THREE.Group(); g.position.set(x, 0, z); const p = new THREE.Mesh(geo.post, mPost); g.add(p);
    [[a, 2.05], [b, 1.7]].forEach(([t, y], i) => { const tx = signTex([t], i ? '#2a3e5a' : '#1e4a34', '#f4f2ea', 512, 96); const m = new THREE.Mesh(new THREE.PlaneGeometry(1.25, .24), new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide })); m.position.set(.62, y, 0); m.rotation.y = i ? .35 : -.35; g.add(m); });
    root.add(g); col(x - .08, x + .08, z - .08, z + .08); signs++; });
  (world.OUT || scene).add(root);
  const info = { lamps, benches, bins, manholes: mans, racks, boards, signs };
  window.__streetV2 = info; return info;
}
