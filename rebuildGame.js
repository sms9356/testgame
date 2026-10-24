// 재건축 본관 · 별관을 게임 안에 들인다 (1단계: 건물 · 보행 · 충돌 · 문 · 조명)
//   기본으로 켜진다 (예전 건물로 보려면 주소창에 ?oldmap).
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
  // 옥상(예전 3층 공간)은 새 본관 지붕 높이로 올린다 — 옥상에 있을 때만 보인다 (예전 지붕이 새 건물 4층 안에 떠 보이지 않게)
  const ROOF = floors[3]; let roofDy = 0;
  if (ROOF) { roofDy = MAIN.spec.floors * MAIN.spec.FH - ROOF.y0; ROOF.y0 += roofDy; ROOF.interior.position.y += roofDy; if (ROOF.shell) ROOF.shell.position.y += roofDy; }
  const v = new THREE.Vector3(), bb = new THREE.Box3();
  // 메시 하나하나: 예전 건물 땅(조금 넓힌 상자) 안에 다 들어가면 감춘다. 땅바닥(높이 0.3m 미만)은 남긴다.
  //   캠퍼스 전체를 덮는 합친 메시(바닥 · 길)는 상자 밖으로 삐져나오므로 그대로 둔다.
  const fits = (b, m = 3) => b.min.x > -47 - m && b.max.x < 47 + m && ((b.min.z > -10.6 - m && b.max.z < 10.6 + m) || (b.min.z > -34 - m && b.max.z < -10.6 + m) || (b.min.z > -34 - m && b.max.z < 10.6 + m && b.max.x - b.min.x < 70));
  const hideIn = root => { if (!root) return; root.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    for (let a = o; a; a = a.parent) if (a.userData && a.userData.rbKeep) return;   // 새 연결 통로로 옮긴 구름다리 연출
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
    blocked(x, z, y, r) { if (R.gate && y < .6 && R.gate.closed() && Math.abs(z - R.gate.z) < r + .08 && x > R.gate.x1 && x < R.gate.x2) return true; return BLD.some(b => { const [lx, lz] = b.toLocal(x, z); return b.col.some(c => !c.off && lx + r > c.x1 && lx - r < c.x2 && lz + r > c.z1 && lz - r < c.z2 && y + 1.7 > c.y1 + .001 && y + .35 < c.y2); }); },
    nearDoor(x, z, y) { let best = null, bd = 9; for (const b of BLD) { const [lx, lz] = b.toLocal(x, z), d = b.nearDoor(lx, lz, y); if (d) { const dd = Math.hypot(d.mx - lx, d.mz - lz); if (dd < bd) { bd = dd; best = d; } } } return best; },
    toggleDoor(d) { d.target = d.target > .5 ? 0 : 1; },
    // 전력 연동: 정전(blackout)이면 형광등 · 등기구 발광 모두 끔, 발전기 출력(gain) · 본전력(power)에 따라 밝기
    setPower(off, gain = 1, power = false) { const k = off ? 0 : gain * (power ? 1 : .86); if (k === this._pk) return; this._pk = k;
      lamps.forEach(l => { l.intensity = 1.6 * k; });
      [MAIN, ANX].forEach(b => { const m = b.mats && b.mats.lamp; if (m) m.emissiveIntensity = 1.4 * k; }); },
    tick(dt, P) { BLD.forEach(b => b.tickDoors(dt)); if (ROOF) ROOF.interior.visible = !!P && P.floor === 3; },
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
  const TOILET = new Set(['flush', 'sink']);
  const DROP = new Set(['switch', 'look', 'ldoor', 'elevator', 'roofDoor', 'passSwitch']);
  let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const used = [];
  const spotIn = (b, room, f, strict = false) => {   // 방 안 빈자리 (세계 좌표) · strict: 못 찾으면 null
    const h = f * FH;
    for (let t = 0; t < 40; t++) {
      const lx = room.x1 + 1 + rnd() * (room.x2 - room.x1 - 2), lz = room.z1 + 1 + rnd() * (room.z2 - room.z1 - 2);
      const [x, z] = b.toWorld(lx, lz);
      const g = R.groundAt(x, z, h + .1); if (g == null || Math.abs(g - h) > .2) continue;
      if (R.blocked(x, z, h, .55)) continue;
      if (used.some(u => u.h === h && Math.hypot(u.x - x, u.z - z) < 1.0)) continue;
      used.push({ x, z, h }); return { x, z, h };
    }
    // 무작위로 못 찾으면 방 안을 0.4m 격자로 훑어 막히지 않은 첫 자리 (사방 0.5m 도 비어 있어야 — 다가설 수 있게)
    for (let lx = room.x1 + .8; lx < room.x2 - .8; lx += .4) for (let lz = room.z1 + .8; lz < room.z2 - .8; lz += .4) {
      const [x, z] = b.toWorld(lx, lz), g = R.groundAt(x, z, h + .1);
      if (g == null || Math.abs(g - h) > .2 || R.blocked(x, z, h, .55)) continue;
      if (used.some(u => u.h === h && Math.hypot(u.x - x, u.z - z) < 1.0)) continue;   // 겹치면 서로 가려 고를 수 없다
      used.push({ x, z, h }); return { x, z, h };
    }
    if (strict) return null;
    const [x, z] = b.toWorld((room.x1 + room.x2) / 2, (room.z1 + room.z2) / 2); return { x, z, h };
  };
  // 방이 꽉 차면 같은 층의 다른 방으로 넘긴다 (spotIn 이 null 이면)
  const spotAny = (b, room, f) => {
    const s0 = room && spotIn(b, room, f, true); if (s0) return s0;
    const rx = room ? (room.x ?? (room.x1 + room.x2) / 2) : 0;
    for (const ff of [f, f + 1, f - 1, f + 2, f - 2]) for (const r of roomsOf(b, ff).sort((p, q) => Math.abs(p.x - rx) - Math.abs(q.x - rx))) { const s1 = spotIn(b, r, ff, true); if (s1) return s1; }
    return spotIn(b, room || roomsOf(b, f)[0], f); };
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
      if (it._rb || !isOld(it.floor, it.pos.x, it.pos.z)) continue; it._rb = true; it._old = { f: it.floor, x: it.pos.x, z: it.pos.z };
      const sk = it.kind === 'key' ? SPECIAL_KEY[it.idx] : null;
      const tgt = sk ? (() => { const rs = roomsOf(sk[0], sk[1]).filter(r => r.type === sk[2]); return rs.length ? { b: sk[0], f: sk[1], room: rs[0] } : pickRoom(it.floor, it.pos.x); })() : pickRoom(it.floor, it.pos.x);
      if (!tgt) continue;
      const oy = it.pos.y - (FL_[it.floor]?.y0 || 0), s = spotAny(tgt.b, tgt.room, tgt.f);
      it.floor = 0; it.rbY = s.h; it.pos.set(s.x, s.h + oy, s.z); if (it.baseY != null) it.baseY = s.h + it.baseY;
      moveObj(it.mesh, s.x, s.h + (it.baseY != null ? it.baseY - s.h : oy), s.z); moved++;
    }
    for (const p of world.props) {
      if (p._rb || !isOld(p.floor, p.x, p.z)) continue; p._rb = true; p._old = { f: p.floor, x: p.x, z: p.z };
      if (inPassOld(p.floor, p.x, p.z) && R.gate) { const [nx, nz] = R.passToNew(p.x, p.z); p.floor = 0; p.rbY = 0; p.x = nx; p.z = nz; if (p.px != null) [p.px, p.pz] = R.passToNew(p.px, p.pz); moved++; continue; }
      if (DROP.has(p.kind)) { p.floor = park(p.floor); dropped++; continue; }
      if (TOILET.has(p.kind)) {   // 세면대 · 변기 → 같은 층(없으면 위층) 새 화장실
        const [b, f0] = OLDMAP[p.floor]; let t = null;
        for (const f of [f0, f0 + 1, f0 + 2]) { t = (b.props || []).filter(q => q.kind === 'toilet' && q.floor === f); if (t.length) { t = { f, list: t }; break; } t = null; }
        if (!t) { p.floor = park(p.floor); dropped++; continue; }
        const q = t.list[(p.x > 0 ? 1 : 0) % t.list.length], box = q2 => ({ x: q2.x, x1: q2.x - 2.1, x2: q2.x + 2.1, z1: .3, z2: b.layout.zS - .3 });
        const s = [q, ...t.list, ...(b.props || []).filter(q2 => q2.kind === 'toilet')].reduce((a, q2) => a || spotIn(b, box(q2), q2.floor, true), null) || spotAny(b, null, t.f);
        for (const k of Object.keys(p)) if (p[k] && p[k].isObject3D && k !== 'parent') moveObj(p[k], s.x, s.h, s.z);
        p.floor = 0; p.rbY = s.h; p.x = s.x; p.z = s.z; moved++; continue;
      }
      const tgt = pickRoom(p.floor, p.x); if (!tgt) { p.floor = park(p.floor); dropped++; continue; }
      const s = spotAny(tgt.b, tgt.room, tgt.f), oy = (p.y ?? 1);
      for (const k of Object.keys(p)) if (p[k] && p[k].isObject3D && k !== 'parent') moveObj(p[k], s.x, s.h, s.z);
      p.floor = 0; p.rbY = s.h; p.x = s.x; p.z = s.z; p.y = oy; if (p.px != null) { p.px = s.x; p.pz = s.z; } moved++;
    }
    for (const d of world.doors) if (!d._rb && isOld(d.floor, d.x, d.z)) { d._rb = true; d.floor = park(d.floor); dropped++; }
    for (const d of world.doorList) if (!d._rb && isOld(d.floor, d.x, d.z)) { d._rb = true; d.floor = park(d.floor); }
    // 화장실 칸 숨기(칸막이 문) → 새 화장실 칸 앞 (층 대응, 모자라면 다른 층 빈 칸)
    const slots = R._stallSlots ||= [MAIN, ANX].flatMap(b => (b.props || []).filter(q => q.kind === 'toilet').flatMap(q => [0, 1, 2].map(k => ({ b, f: q.floor, lx: q.x + 2.25 - .85, lz: 2.4 + k * 1.6 + .8, used: false }))));
    for (const l of world.lockers) if (!l._rb && isOld(l.floor, l.x, l.z)) { l._rb = true;
      if (!l.stallDoor) { l.floor = park(l.floor); continue; }
      const [b0, f0] = OLDMAP[l.floor], free = slots.filter(q => !q.used), sl = free.find(q => q.b === b0 && q.f === f0) || free.find(q => q.b === b0) || free[0];
      if (!sl) { l.floor = park(l.floor); continue; }
      sl.used = true; const [x, z] = sl.b.toWorld(sl.lx, sl.lz); l._old = { f: l.floor, x: l.x, z: l.z }; const [dx, dz] = sl.b.toWorld(sl.lx - 1, sl.lz); l.dir = { x: dx - x, z: dz - z }; l.floor = 0; l.rbY = sl.f * FH; l.x = x; l.z = z; moved++; }
    // 지하(B1) 계단 입구: 새 본관 서쪽 계단실 1층 층 참 바깥벽 쪽
    if (!R.b1Door && stairSpawnB1) {
      const [x, z] = MAIN.toWorld(-MAIN.layout.L / 2 + .8, MAIN.layout.zN + 1.35);
      R.b1Door = { floor: 0, x, z, r: 1.5, rbY: 0, label: '지하 계단 — B1로 내려가기', to: { floor: 4, x: stairSpawnB1.x, z: stairSpawnB1.z, yaw: Math.PI }, _rb: true };
      R.b1Return = { floor: 0, x: x + 2.2, z, yaw: -Math.PI / 2 };
      world.doors.push(R.b1Door);
      sign(x - .72, 0, z, '지하 B1 ↓', Math.PI / 2, true);
    }
    // 옥상 출입문: 새 본관 동쪽 계단실 맨 위층(4층) 층 참 — 옥상(예전 3층 공간)으로 이어진다
    if (!R.roofDoor) {
      const top = (MAIN.spec.floors - 1) * FH, [x, z] = MAIN.toWorld(MAIN.layout.L / 2 - .8, MAIN.layout.zN + 1.35);
      R.roofDoor = { floor: 0, x, z, r: 1.5, rbY: top, label: '옥상 출입문 — 옥상으로 나가기', to: { floor: 3, x: 0, z: -7.5, yaw: 0 }, _rb: true };
      R.roofReturn = { floor: 0, x: x - 2.2, z, yaw: Math.PI / 2, sh: top };
      world.doors.push(R.roofDoor);
      sign(x + .76, top, z, '옥상 ↑', -Math.PI / 2);
    }
    return { moved, dropped };
  };
  // 예전 층(1·2·8~10층 · 예전 본관 땅)으로 가는 순간이동 → 새 건물의 같은 자리
  R.mapTeleport = (to, from, world) => {
    if (from === 4 && to.floor === 0 && R.b1Return) return R.b1Return;
    if (from === 3 && R.roofReturn && (to.floor === 2 || to.floor === 0)) return R.roofReturn;
    if (!isOld(to.floor, to.x, to.z) || (to.floor === 0 && to.sh != null)) return to;
    const m = R.mapLoc({ f: to.floor, x: to.x, z: to.z }, world);
    return { ...to, floor: 0, x: m.x, z: m.z, sh: m.rbY ?? 0 };
  };
  // ── 4단계: 구름다리 방화문 연출 · 엘리베이터 ──
  // 예전 2층 구름다리(skybridge2F: 방화문 · 증기 밸브 · 청소도구함 · 정전 · 액자 낙하)를 새 1층 연결 통로(z −17 ~ −3)에 그대로 옮긴다
  //   예전 통로 z −20.5 ~ −9.9 (10.6m) → 새 통로 14m: z 방향 1.32배 늘리고, x −1, 높이 −2층
  const PS = 14 / 10.6, PC = -10 - PS * -15.2, PX = -1;
  R.passToNew = (x, z) => [x + PX, z * PS + PC];
  R.passToOld = (x, z) => [x - PX, (z - PC) / PS];
  const inPassOld = (f, x, z) => f === 1 && x > -1.7 && x < 3.7 && z > -20.6 && z < -9.8;
  R.adoptPassage = (OUT, doorZ) => {
    const O = OUT.children.find(c => c.name === 'skybridge2F'); if (!O) return;
    O.userData.rbKeep = true; O.position.set(PX, 0, PC); O.scale.z = PS;
    O.traverse(o => { if (o.isMesh) o.visible = true; });
    WK.root.visible = false;   // 겹치는 새 통로 겉모습은 숨기고 (바닥 · 충돌은 그대로) 구름다리 실내를 쓴다
    R.gate = { z: R.passToNew(0, doorZ)[1], x1: -2, x2: 2, closed: () => false };
  };
  R.inWalkway = P => P.floor === 0 && (P.sh || 0) < .5 && Math.abs(P.x) < 1.95 && P.z > -17.2 && P.z < -2.8;
  // 엘리베이터: 본관 · 별관 복도 북쪽 벽(코어 동쪽)에 층마다 문 — E 위층 · Q 아래층
  R.elevs = [];
  const mElv = new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: .3, metalness: .85 }), mFrame = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: .5, metalness: .6 });
  const mBtn = new THREE.MeshStandardMaterial({ color: 0xffb040, emissive: 0xff8a20, emissiveIntensity: .8 });
  [MAIN, ANX].forEach(b => { for (let f = 0; f < b.spec.floors; f++) {
    const y = f * FH, lx = 3.7, lz = b.layout.zN + .06, g = new THREE.Group(); g.position.set(lx, y, lz); b.root.add(g);
    const bx = (w, h, d, m, x, yy, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, yy, z); g.add(o); };
    bx(1.4, 2.35, .08, mFrame, 0, 1.175, 0); bx(.56, 2.1, .04, mElv, -.29, 1.05, .05); bx(.56, 2.1, .04, mElv, .29, 1.05, .05);
    bx(.12, .2, .03, mFrame, .95, 1.15, .02); bx(.05, .05, .02, mBtn, .95, 1.2, .04); bx(.05, .05, .02, mBtn, .95, 1.1, .04);
    { const c = document.createElement('canvas'); c.width = 128; c.height = 48; const x = c.getContext('2d'); x.fillStyle = '#05080c'; x.fillRect(0, 0, 128, 48); x.fillStyle = '#ff9a3a'; x.font = 'bold 30px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(`${f + 1}F`, 64, 26);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(.36, .14), new THREE.MeshBasicMaterial({ map: t })); m.position.set(0, 2.5, .05); g.add(m); }
    b.col.push({ x1: lx - .7, x2: lx + .7, z1: lz - .1, z2: lz + .05, y1: y, y2: y + 2.4 });
    const [wx, wz] = b.toWorld(lx, lz + .9), [fx, fz] = b.toWorld(lx, lz + 1.6);
    R.elevs.push({ b, f, n: b.spec.floors, x: wx, z: wz, rbY: y, out: { x: fx, z: fz }, yaw: Math.atan2(-(fx - wx), -(fz - wz)) });
  } });
  R.nearElev = (x, z, y) => R.elevs.find(e => Math.abs(e.rbY - y) < 1.2 && Math.hypot(e.x - x, e.z - z) < 1.2);
  R.elevTo = (e, dir) => { const nf = e.f + dir; if (nf < 0 || nf >= e.n) return null; const t = R.elevs.find(q => q.b === e.b && q.f === nf); return { floor: 0, x: t.out.x, z: t.out.z, yaw: t.yaw, sh: t.rbY }; };

  // ── 3단계: 위치 안내 ──
  // 새 건물 안인가 (각 건물 좌표계의 외곽 상자)
  R.inBuilding = (x, z) => BLD.some(b => { const [lx, lz] = b.toLocal(x, z); if (b.layout) return lx > -b.layout.L / 2 - .3 && lx < b.layout.L / 2 + .3 && lz > b.layout.zN - .3 && lz < b.layout.zS + .3; return b.groundAt(lx, lz, 0) != null; });
  R.floorLabel = (x, z, y) => { for (const b of [MAIN, ANX]) { const [lx, lz] = b.toLocal(x, z); if (lx > -b.layout.L / 2 - .3 && lx < b.layout.L / 2 + .3 && lz > b.layout.zN - .3 && lz < b.layout.zS + .3) return `${b.name} ${Math.round(y / FH) + 1}층`; } return R.inBuilding(x, z) ? '연결 통로' : null; };
  // 목표 위치(예전 좌표) → 새 위치: 옮긴 물건 중 원래 자리가 가장 가까운 것, 없으면 같은 비율의 새 방 가운데
  R.mapLoc = (l, world) => {
    if (!l || l.rbY != null || !isOld(l.f, l.x, l.z)) return l;
    let best = null, bd = 6;
    for (const o of [...world.items, ...world.props]) { const q = o._old; if (!q || q.f !== l.f) continue; const d = Math.hypot(q.x - l.x, q.z - l.z); if (d < bd) { bd = d; best = o; } }
    if (best) { const x = best.pos ? best.pos.x : best.x, z = best.pos ? best.pos.z : best.z; return { ...l, f: 0, x, z, rbY: best.rbY }; }
    const t = pickRoom(l.f, l.x); if (!t) return l;
    const [x, z] = t.b.toWorld(t.room.x, t.room.z); return { ...l, f: 0, x, z, rbY: t.f * FH };
  };
  // 지도용: 지울 예전 자리 · 건물 외곽 · 지금 층 방 (세계 좌표 다각형)
  let mdKey = '', mdVal = null;
  R.mapData = (x, z, y) => {
    const f0 = Math.round(y / FH), k0 = f0 + '|' + R.where(x, z, y); if (k0 === mdKey) return mdVal; mdKey = k0;
    const f = f0, corners = (b, x1, x2, z1, z2) => [[x1, z1], [x2, z1], [x2, z2], [x1, z2]].map(([a, c]) => b.toWorld(a, c));
    const shells = [MAIN, ANX].map(b => corners(b, -b.layout.L / 2, b.layout.L / 2, b.layout.zN, b.layout.zS));
    shells.push(corners(WK, -1.9, 1.9, -17, -3));
    const here = R.where(x, z, y);
    const rooms = [MAIN, ANX].flatMap(b => (b.props || []).filter(p => p.kind === 'room' && p.floor === f).map(p => { const [cx, cz] = b.toWorld(p.x ?? (p.x1 + p.x2) / 2, p.z ?? (p.z1 + p.z2) / 2); return { pts: corners(b, p.x1, p.x2, p.z1, p.z2), label: p.label, cx, cz, here: here && here.endsWith(p.label) }; }));
    return (mdVal = { clear: [OLD_MAIN, OLD_ANNEX], shells, rooms });
  };
  // 계단실 출입문 표시: 철문 + 표지판 (bx: 표지판 x, 문짝은 벽 쪽으로)
  const sign = (sx, y, z, text, ry, door = false) => {
    const m = new THREE.MeshStandardMaterial({ color: 0x4a5250, roughness: .6, metalness: .55 });
    const dx = Math.sin(ry) * -.04;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(.06, 2.0, 1.1), m); leaf.position.set(sx + dx, y + 1.0, z); group.add(leaf);
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#3a0e0a'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#f0d8c0'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 33);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(.8, .2), new THREE.MeshBasicMaterial({ map: t })); sg.position.set(sx - dx, y + 2.15, z); sg.rotation.y = ry; group.add(sg);
  };
  return R;
}
