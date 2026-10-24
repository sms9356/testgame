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
  return R;
}
