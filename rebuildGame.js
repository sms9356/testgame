// 재건축 본관 · 별관을 게임 안에 들인다 (1단계: 건물 · 보행 · 충돌 · 문 · 조명)
//   주소창에 ?rb 를 붙이면 켜진다 — 퍼즐 · 열쇠 이전(2단계)이 끝날 때까지 기본 게임은 그대로 둔다.
//   예전 본관(1~3층 · 옥상) · 별관(8~10층) 건물은 감추고, 그 자리 땅(0층)에서 새 건물을 걷는다.
//   높이는 P.sh(계단 높이 보정값)로 넘긴다 → 카메라 · 점프 · 가구 오르기 코드는 손대지 않아도 된다.
import { buildMainBuilding, buildWalkway, ANNEX_SPEC, ANNEX_PLAN } from './rebuild/mainBuilding.js';
import { placeModels } from './rebuild/models.js';

// 예전 건물이 차지하던 땅 (이 안의 예전 메시 · 충돌 상자를 걷어 낸다)
const OLD_MAIN = { x1: -47, x2: 47, z1: -10.6, z2: 10.6 };
const OLD_ANNEX = { x1: -32, x2: 32, z1: -34, z2: -10.6 };
const inBox = (b, x, z) => x > b.x1 && x < b.x2 && z > b.z1 && z < b.z2;
const inOld = (x, z) => inBox(OLD_MAIN, x, z) || inBox(OLD_ANNEX, x, z);

export function installRebuild({ THREE, scene, floors, world }) {
  const MAIN = buildMainBuilding({ southEntry: true });
  const ANX = buildMainBuilding({ spec: ANNEX_SPEC, plan: ANNEX_PLAN, x: 0, z: -20, ry: Math.PI, name: 'REBUILD_ANNEX', label: '별관', prefix: '', signText: '서문고 별관 · 예술 실습동', noSciLib: true, classLabel: (f, n) => `3학년 ${n + 8}반` });
  const WK = buildWalkway({ x1: -1.9, x2: 1.9, z1: -17.0, z2: -3.0 });
  const BLD = [MAIN, ANX, WK];

  // 1) 예전 본관 · 별관 감추기: 층 통째(1~3층 · 옥상 · 별관) + 0층 · 야외에서 그 땅 위에 선 것
  [1, 2, 3, 8, 9, 10].forEach(f => { const F = floors[f]; if (!F) return; F.interior.visible = false; if (F.shell) F.shell.visible = false; });
  const v = new THREE.Vector3(), bb = new THREE.Box3();
  // 메시 하나하나: 예전 건물 땅(조금 넓힌 상자) 안에 다 들어가면 감춘다. 땅바닥(높이 0.3m 미만)은 남긴다.
  //   캠퍼스 전체를 덮는 합친 메시(바닥 · 길)는 상자 밖으로 삐져나오므로 그대로 둔다.
  const fits = (b, m = 3) => b.min.x > -47 - m && b.max.x < 47 + m && ((b.min.z > -10.6 - m && b.max.z < 10.6 + m) || (b.min.z > -34 - m && b.max.z < -10.6 + m) || (b.min.z > -34 - m && b.max.z < 10.6 + m && b.max.x - b.min.x < 70));
  const hideIn = root => { if (!root) return; root.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    if (o.isInstancedMesh) { const m4 = new THREE.Matrix4(), p = new THREE.Vector3(); let hit = 0; o.updateMatrixWorld(true);
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); p.setFromMatrixPosition(m4).applyMatrix4(o.matrixWorld); if (inOld(p.x, p.z) && p.y > -.5) { m4.makeScale(0, 0, 0); o.setMatrixAt(i, m4); hit++; } }
      if (hit) o.instanceMatrix.needsUpdate = true; return; }
    bb.setFromObject(o); if (bb.isEmpty() || bb.max.y < .3) return;
    if (fits(bb)) o.visible = false;
  }); };
  const clearOld = () => {
    hideIn(floors[0].interior); hideIn(floors[0].shell); hideIn(world.OUT);
    for (const k of ['col', 'walls', 'doorWalls']) if (floors[0][k]) { const keep = floors[0][k].filter(r => !inOld(((r.x1 ?? r.ax ?? 0) + (r.x2 ?? r.bx ?? 0)) / 2, ((r.z1 ?? r.az ?? 0) + (r.z2 ?? r.bz ?? 0)) / 2)); floors[0][k].length = 0; floors[0][k].push(...keep); }
  };
  clearOld();
  // 소품 모델은 나중에 비동기로 들어온다 → 몇 번 더 걷어 낸다
  [3000, 10000, 25000, 60000, 120000].forEach(ms => setTimeout(clearOld, ms));

  // 2) 새 건물
  const group = new THREE.Group(); group.name = 'REBUILD'; group.userData.dynamic = true; scene.add(group);
  BLD.forEach(b => { group.add(b.root); if (b.models.length) placeModels(b.root, b.models, { shadows: false }); });
  // 형광등: 자리마다 점조명 (perfStabilizer 조명 풀이 가까운 것만 골라 비춘다)
  const lamps = [];
  BLD.forEach(b => b.lights.forEach(l => { const [x, z] = b.toWorld(l.x, l.z); const p = new THREE.PointLight(0xf2f4ff, 1.6, 9, 1.6); p.position.set(x, l.y, z); p.userData.on = true; group.add(p); lamps.push(p); }));

  const R = {
    MAIN, ANX, WK, BLD, group, lamps,
    groundAt(x, z, feet) { let best = null; for (const b of BLD) { const [lx, lz] = b.toLocal(x, z), g = b.groundAt(lx, lz, feet); if (g != null && (best == null || g > best)) best = g; } return best; },
    blocked(x, z, y, r) { return BLD.some(b => { const [lx, lz] = b.toLocal(x, z); return b.col.some(c => !c.off && lx + r > c.x1 && lx - r < c.x2 && lz + r > c.z1 && lz - r < c.z2 && y + 1.7 > c.y1 + .001 && y + .35 < c.y2); }); },
    nearDoor(x, z, y) { let best = null, bd = 9; for (const b of BLD) { const [lx, lz] = b.toLocal(x, z), d = b.nearDoor(lx, lz, y); if (d) { const dd = Math.hypot(d.mx - lx, d.mz - lz); if (dd < bd) { bd = dd; best = d; } } } return best; },
    toggleDoor(d) { d.target = d.target > .5 ? 0 : 1; },
    tick(dt) { BLD.forEach(b => b.tickDoors(dt)); },
    // 새 건물 땅 위에 있나 (예전 건물 자리)
    inside(x, z) { return inOld(x, z); },
    floorOf(y) { return Math.max(0, Math.round(y / MAIN.spec.FH)); },
    where(x, z, y) { const f = Math.round(y / MAIN.spec.FH); for (const b of BLD) { const [lx, lz] = b.toLocal(x, z); const r = (b.props || []).find(p => p.kind === 'room' && p.floor === f && lx > p.x1 && lx < p.x2 && lz > p.z1 && lz < p.z2); if (r) return `${b.name} ${f + 1}층 ${r.label}`; } return null; },
  };

  // 한 걸음 이동: 새 건물 땅이면 true (예전 계단 · 통로 순간이동 코드는 건너뛴다)
  //   P.sh = 발밑 높이. 0.5m 넘는 단 · 벽 · 가구는 막는다. 층 사이 허공으로는 걸어 나가지 않는다.
  R.step = (P, px, pz) => {
    const feet = P.sh || 0;
    if (!inOld(P.x, P.z) && feet < .3) return false;
    const ok = (x, z) => { const g = R.groundAt(x, z, feet); if (g == null) return feet < .3 && !R.blocked(x, z, 0, .3) ? 0 : null; if (g - feet > .5) return null; return R.blocked(x, z, Math.max(feet, g), .3) ? null : g; };
    let g = ok(P.x, P.z);
    if (g == null) { g = ok(P.x, pz); if (g != null) P.z = pz; else { g = ok(px, P.z); if (g != null) P.x = px; else { P.x = px; P.z = pz; g = feet; } } }
    P.sh = g;
    return true;
  };

  // ── 2단계: 예전 건물의 열쇠 · 쪽지 · 조사 지점을 새 방으로 옮긴다 ──
  //   예전 층 → 새 건물 층: 본관 0·1·2층 → 새 본관 1·2·3층, 별관(8·9·10) → 새 별관 1·2·3층
  //   방은 예전 x 위치 비율이 가장 가까운 새 방, 방 안 자리는 막히지 않은 곳을 고른다
  //   옮긴 것은 floor 0 + rbY(그 층 바닥 높이) — findInteract 가 높이가 다른 층의 것은 고르지 않는다
  const FH = MAIN.spec.FH;
  const roomsOf = (b, f) => (b.props || []).filter(p => p.kind === 'room' && p.floor === f && p.x2 - p.x1 > 2.5);
  const OLDMAP = { 0: [MAIN, 0], 1: [MAIN, 1], 2: [MAIN, 2], 8: [ANX, 0], 9: [ANX, 1], 10: [ANX, 2] };
  const SPECIAL_KEY = { 0: [MAIN, 0, 'staff'], 1: [ANX, 1, 'library'], 2: [ANX, 1, 'science'] };
  const DROP = new Set(['flush', 'sink', 'switch', 'look', 'ldoor', 'elevator', 'roofDoor', 'passSwitch']);
  let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const used = [];
  const spotIn = (b, room, f) => {   // 방 안 빈자리 (세계 좌표)
    const h = f * FH;
    for (let t = 0; t < 40; t++) {
      const lx = room.x1 + 1 + rnd() * (room.x2 - room.x1 - 2), lz = room.z1 + 1 + rnd() * (room.z2 - room.z1 - 2);
      const [x, z] = b.toWorld(lx, lz);
      const g = R.groundAt(x, z, h + .1); if (g == null || Math.abs(g - h) > .2) continue;
      if (R.blocked(x, z, h, .35)) continue;
      if (used.some(u => u.h === h && Math.hypot(u.x - x, u.z - z) < .8) && t < 30) continue;
      used.push({ x, z, h }); return { x, z, h };
    }
    const [x, z] = b.toWorld((room.x1 + room.x2) / 2, (room.z1 + room.z2) / 2); return { x, z, h };
  };
  const pickRoom = (oldF, oldX, prefer) => {
    const [b, f] = OLDMAP[oldF]; let rs = roomsOf(b, f); if (!rs.length) return null;
    if (prefer) { const pr = rs.filter(r => r.type === prefer); if (pr.length) rs = pr; }
    const lo = oldF >= 8 ? -24 : -40, hi = oldF >= 8 ? 28 : 40, t = Math.min(1, Math.max(0, (oldX - lo) / (hi - lo)));
    const L = b.layout.L, best = rs.reduce((a, r) => { const tr = (r.x - (-L / 2)) / L, tt = b === ANX ? 1 - tr : tr; return !a || Math.abs(tt - t) < a.d ? { r, d: Math.abs(tt - t) } : a; }, null);
    return { b, f, room: best.r };
  };
  const moveObj = (o, x, y, z) => { if (!o || !o.isObject3D) return; group.attach(o); o.position.set(x, y, z); o.visible = true; };
  const park = f => f === 0 ? 1 : f;   // 쓰지 않는 것: 감춘 예전 층에 둔다 (floor -1 은 floors[] 조회가 깨진다)
  const isOld = (f, x, z) => f === 1 || f === 2 || f >= 8 && f <= 10 || (f === 0 && inOld(x, z));
  R.relocate = ({ world, floors: FL_, stairSpawnB1 }) => {
    let moved = 0, dropped = 0;
    for (const it of world.items) {
      if (it._rb || !isOld(it.floor, it.pos.x, it.pos.z)) continue; it._rb = true;
      const sk = it.kind === 'key' ? SPECIAL_KEY[it.idx] : null;
      const tgt = sk ? (() => { const rs = roomsOf(sk[0], sk[1]).filter(r => r.type === sk[2]); return rs.length ? { b: sk[0], f: sk[1], room: rs[0] } : pickRoom(it.floor, it.pos.x); })() : pickRoom(it.floor, it.pos.x);
      if (!tgt) continue;
      const oy = it.pos.y - (FL_[it.floor]?.y0 || 0), s = spotIn(tgt.b, tgt.room, tgt.f);
      it.floor = 0; it.rbY = s.h; it.pos.set(s.x, s.h + oy, s.z); if (it.baseY != null) it.baseY = s.h + it.baseY;
      moveObj(it.mesh, s.x, s.h + (it.baseY != null ? it.baseY - s.h : oy), s.z); moved++;
    }
    for (const p of world.props) {
      if (p._rb || !isOld(p.floor, p.x, p.z)) continue; p._rb = true;
      if (DROP.has(p.kind)) { p.floor = park(p.floor); dropped++; continue; }
      const tgt = pickRoom(p.floor, p.x); if (!tgt) { p.floor = park(p.floor); dropped++; continue; }
      const s = spotIn(tgt.b, tgt.room, tgt.f), oy = (p.y ?? 1);
      for (const k of Object.keys(p)) if (p[k] && p[k].isObject3D && k !== 'parent') moveObj(p[k], s.x, s.h, s.z);
      p.floor = 0; p.rbY = s.h; p.x = s.x; p.z = s.z; p.y = oy; if (p.px != null) { p.px = s.x; p.pz = s.z; } moved++;
    }
    for (const d of world.doors) if (!d._rb && isOld(d.floor, d.x, d.z)) { d._rb = true; d.floor = park(d.floor); dropped++; }
    for (const d of world.doorList) if (!d._rb && isOld(d.floor, d.x, d.z)) { d._rb = true; d.floor = park(d.floor); }
    for (const l of world.lockers) if (!l._rb && isOld(l.floor, l.x, l.z)) { l._rb = true; l.floor = park(l.floor); }
    // 지하(B1) 계단 입구: 새 본관 서쪽 계단실 1층 층 참 바깥벽 쪽
    if (!R.b1Door && stairSpawnB1) {
      const [x, z] = MAIN.toWorld(-MAIN.layout.L / 2 + .8, MAIN.layout.zN + 1.35);
      R.b1Door = { floor: 0, x, z, r: 1.5, rbY: 0, label: '지하 계단 — B1로 내려가기', to: { floor: 4, x: stairSpawnB1.x, z: stairSpawnB1.z, yaw: Math.PI }, _rb: true };
      R.b1Return = { floor: 0, x: x + 2.2, z, yaw: -Math.PI / 2 };
      world.doors.push(R.b1Door);
      box3(x, z);
    }
    return { moved, dropped };
  };
  // B1 입구 표시: 철제 셔터 문짝 + 표지판
  const box3 = (x, z) => {
    const m = new THREE.MeshStandardMaterial({ color: 0x4a5250, roughness: .6, metalness: .55 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(.06, 2.0, 1.1), m); door.position.set(x - .76, 1.0, z); group.add(door);
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#3a0e0a'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#f0d8c0'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('지하 B1 ↓', 128, 33);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(.8, .2), new THREE.MeshBasicMaterial({ map: t })); sg.position.set(x - .72, 2.15, z); sg.rotation.y = Math.PI / 2; group.add(sg);
  };
  return R;
}
