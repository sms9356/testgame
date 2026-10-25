// 재건축 본관 · 별관을 게임 안에 들인다 (1단계: 건물 · 보행 · 충돌 · 문 · 조명)
//   기본으로 켜진다 (예전 건물로 보려면 주소창에 ?oldmap).
//   예전 본관(1~3층 · 옥상) · 별관(8~10층) 건물은 감추고, 그 자리 땅(0층)에서 새 건물을 걷는다.
//   높이는 P.sh(계단 높이 보정값)로 넘긴다 → 카메라 · 점프 · 가구 오르기 코드는 손대지 않아도 된다.
import { buildMainBuilding, buildWalkway, ANNEX_SPEC, ANNEX_PLAN } from './rebuild/mainBuilding.js?v=215';
import { placeModels } from './rebuild/models.js?v=215';
import { carve, subdivide } from './rebuild/transplant.js?v=215';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';

// 예전 건물이 차지하던 땅 (이 안의 예전 메시 · 충돌 상자를 걷어 낸다)
const OLD_MAIN = { x1: -51, x2: 51, z1: -10.6, z2: 10.9 };
const OLD_ANNEX = { x1: -32, x2: 32, z1: -34, z2: -10.6 };
const inBox = (b, x, z) => x > b.x1 && x < b.x2 && z > b.z1 && z < b.z2;
const inOld = (x, z) => inBox(OLD_MAIN, x, z) || inBox(OLD_ANNEX, x, z);

export function installRebuild({ THREE, scene, floors, world }) {
  const MAIN = buildMainBuilding({ southEntry: true, roofStair: true, centerStair: 'east', bridge: true });
  const ANX = buildMainBuilding({ spec: ANNEX_SPEC, plan: ANNEX_PLAN, x: -3, z: -20, ry: Math.PI, bridge: true, endExits: true, name: 'REBUILD_ANNEX', label: '별관', prefix: '', signText: '서문고 별관 · 예술 실습동', noLib: true, classLabel: (f, n) => `3학년 ${n + 5}반` });
  // 구름다리 (2층): 본관 북쪽 외벽 ↔ 별관 복도쪽 외벽, 두 건물 코어(현관) 앞 x 에서
  const BRX = MAIN.toWorld((MAIN.layout.rooms.find(r => r.kind === 'core').x1 + MAIN.layout.rooms.find(r => r.kind === 'core').x2) / 2, 0)[0], BRZ2 = MAIN.toWorld(0, MAIN.layout.zN - MAIN.spec.outer)[1], BRZ1 = ANX.toWorld(0, ANX.layout.zN - ANX.spec.outer)[1];
  const WK = buildWalkway({ x1: BRX - 1.9, x2: BRX + 1.9, z1: BRZ1, z2: BRZ2, y: MAIN.spec.FH });
  const BLD = [MAIN, ANX, WK];

  // 1) 예전 본관 · 별관 감추기: 층 통째(1~3층 · 옥상 · 별관) + 0층 · 야외에서 그 땅 위에 선 것
  const NOOP = () => {};
  const OLD_FLOORS = [1, 2, 3, 8, 9, 10].map(f => floors[f]).filter(Boolean);
  [1, 2, 3, 8, 9, 10].forEach(f => { const F = floors[f]; if (!F) return; F.interior.visible = false; if (F.shell) F.shell.visible = false; });
  // 옥상(예전 3층 공간)은 새 본관 지붕 높이로 올린다 — 옥상에 있을 때만 보인다 (예전 지붕이 새 건물 4층 안에 떠 보이지 않게)
  const ROOF = floors[3]; let roofDy = 0;
  if (ROOF) { roofDy = MAIN.spec.floors * MAIN.spec.FH - ROOF.y0; ROOF.y0 += roofDy; ROOF.interior.position.y += roofDy; if (ROOF.shell) ROOF.shell.position.y += roofDy; }
  const v = new THREE.Vector3(), bb = new THREE.Box3();
  const inNew = (x, z) => [MAIN, ANX].some(b => { const [lx, lz] = b.toLocal(x, z); return lx > -b.layout.L / 2 - .35 && lx < b.layout.L / 2 + .35 && lz > b.layout.zN - .35 && lz < b.layout.zS + .35; });   // 새 본관 · 별관 바닥 자리
  // 메시 하나하나: 예전 건물 땅(조금 넓힌 상자) 안에 다 들어가면 감춘다. 땅바닥(높이 0.3m 미만)은 남긴다.
  //   캠퍼스 전체를 덮는 합친 메시(바닥 · 길)는 상자 밖으로 삐져나오므로 그대로 둔다.
  const fits = (b, m = 3) => b.min.x > -47 - m && b.max.x < 47 + m && ((b.min.z > -10.6 - m && b.max.z < 10.6 + m) || (b.min.z > -34 - m && b.max.z < -10.6 + m) || (b.min.z > -34 - m && b.max.z < 10.6 + m && b.max.x - b.min.x < 70));
  // 예전 출입구 바깥에 남은 것 (발판 · 계단 · 문 위 등): 새 건물과 위치가 달라 허공 · 풀밭에 떠 있었다
  const OLD_SPOTS = [[.1, 12.5, 1.7], [-25, -34.2, 3.4], [-43.5, -20, 2.2]];
  const oldSpot = (x, z) => OLD_SPOTS.some(([a, b, r]) => Math.hypot(x - a, z - b) < r);
  const hideIn = root => { if (!root) return; root.traverse(o => {
    if ((o.isMesh || o.isSprite) && o.visible && !o.isInstancedMesh) { const w = o.isSprite ? o.getWorldPosition(v) : bb.setFromObject(o).getCenter(v); if (!o.isSprite && bb.getSize(new THREE.Vector3()).length() > 8) {} else if (w.y < 3.5 && oldSpot(w.x, w.z)) { let keep = false; for (let q = o; q; q = q.parent) if (q.name === 'REBUILD' || q.isSkinnedMesh) keep = true; if (!keep) { o.visible = false; return; } } }
    if (o.isSprite && o.visible) { for (let a = o; a; a = a.parent) if (a.isCamera || a.name === 'REBUILD' || a.isSkinnedMesh || (a.userData && (a.userData.rbKeep || a.userData.rbRoof))) return; const w = o.getWorldPosition(v); if (inOld(w.x, w.z) || inNew(w.x, w.z)) { o.visible = false; o.scale.setScalar(0); } return; }   // 예전 벽등 · 가로등의 빛 번짐 스프라이트
    if (!o.isMesh || !o.visible) return;
    for (let a = o; a; a = a.parent) if (a.userData && a.userData.rbKeep) return;   // 새 연결 통로로 옮긴 구름다리 연출
    if (o.isInstancedMesh) { const m4 = new THREE.Matrix4(), p = new THREE.Vector3(); let hit = 0; o.updateMatrixWorld(true);
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); p.setFromMatrixPosition(m4).applyMatrix4(o.matrixWorld); if (inOld(p.x, p.z) && p.y > -.5) { m4.makeScale(0, 0, 0); o.setMatrixAt(i, m4); hit++; } }
      if (hit) o.instanceMatrix.needsUpdate = true; return; }
    bb.setFromObject(o); if (bb.isEmpty()) return;
    if (bb.max.y < .3 && !o.userData.dynamic && Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) < 20 && inOld(bb.min.x + .9, bb.min.z + .9) && inOld(bb.max.x - .9, bb.max.z - .9) && (Math.min(bb.max.x - bb.min.x, bb.max.z - bb.min.z) < .7 || Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) < 12)) { o.visible = false; return; }   // 예전 건물 기단 · 경계석 띠 · 현관 포치   // 예전 건물 기단 · 경계석 띠
    if (bb.max.y < .3) { if (inNew((bb.min.x + bb.max.x) / 2, (bb.min.z + bb.max.z) / 2) && bb.max.x - bb.min.x < 60 && bb.max.z - bb.min.z < 30) o.visible = false; else if (!o.userData.rbFloorCut && !o.userData.dynamic && !(o.geometry && o.geometry.groups && o.geometry.groups.length > 1)) { o.userData.rbFloorCut = true; const ov = [MAIN, ANX].some(b => { const c = [[-b.layout.L / 2, b.layout.zN], [b.layout.L / 2, b.layout.zS]].map(([a, d]) => b.toWorld(a, d)); return bb.max.x > Math.min(c[0][0], c[1][0]) && bb.min.x < Math.max(c[0][0], c[1][0]) && bb.max.z > Math.min(c[0][1], c[1][1]) && bb.min.z < Math.max(c[0][1], c[1][1]); }); if (ov) { subdivide(o, 1.0); carve(o, (x, y, z) => y > -.3 && inNew(x, z)); } } return; }   // 예전 바닥판: 새 건물 바닥 밑에서 겹쳐 깜빡이던 것
    if (fits(bb)) { o.visible = false; return; }
    // 층 전체를 합친 메시: 예전 건물 땅 위(높이 0.3m 이상)의 삼각형만 잘라 낸다 (벽 · 창 · 덩굴 잔재가 새 교실을 뚫고 나오던 문제)
    if (o.userData.dynamic || o.userData.rbCarved || !(bb.max.x > -47 && bb.min.x < 47 && bb.max.z > -34 && bb.min.z < 10.6)) return;
    o.userData.rbCarved = true; carve(o, (x, y, z) => (y > .3 && inOld(x, z)) || (y > -.3 && inNew(x, z)));
  }); };
  const clearOld = () => {
    OLD_FLOORS.forEach(F => { F.interior.visible = false; if (F.shell) F.shell.visible = false; });   // 예전 층: 플레이 전(인트로 · 메뉴)에도 감춘다
    hideIn(floors[0].interior); hideIn(floors[0].shell); hideIn(world.OUT);
    // 씬 루트에 바로 붙은 소품 묶음(나중에 불러오는 GLB 등)도 — 새 건물 · 다른 층 · 지하(높이 −0.3 아래)는 건드리지 않는다
    const skip = new Set([...floors.filter(Boolean).flatMap((F, i) => i === 0 ? [] : [F.interior, F.shell])]);
    const sweep = (c, d) => { if (skip.has(c) || c.isCamera || c.isLight || c.name === 'REBUILD' || c.isSkinnedMesh || c.userData.rbKeep) return; let live = false; c.traverse(o => { if (o !== c && o.isSkinnedMesh) live = true; });   // 움직이는 인물(스킨 메시)만 남긴다 — 예전 층의 '앉을 수 있는 의자' 같은 동적 소품도 걷어 낸다
      if (live) { if (c.children.some(k => k.isSkinnedMesh || k.children.some(q => q.isSkinnedMesh))) return; if (d < 5) c.children.forEach(k => sweep(k, d + 1)); return; }   /* 인물(유령 · NPC) 자체는 건드리지 않고, 같은 묶음의 다른 소품만 정리 */ bb.setFromObject(c); if (bb.isEmpty() || bb.max.y < -.3) return; hideIn(c); };
    scene.children.forEach(c => sweep(c, 0));
    for (const k of ['col', 'walls', 'doorWalls']) if (floors[0][k]) { const keep = floors[0][k].filter(r => !inOld(((r.x1 ?? r.ax ?? 0) + (r.x2 ?? r.bx ?? 0)) / 2, ((r.z1 ?? r.az ?? 0) + (r.z2 ?? r.bz ?? 0)) / 2)); floors[0][k].length = 0; floors[0][k].push(...keep); }
  };
  // 예전 본관 3층 방송실(x −36 ~ −20 · z −9.6 ~ −1.75)의 장치 · 인물은 새 본관 4층 서쪽 18m 방송실(새 가구 배치)의 알맞은 자리로 옮긴다
  //   가구 · 벽은 새 건물 것(mainBuilding 'bcast')을 쓰고, 예전 방 메시는 가져오지 않는다
  const BC = { x1: -35.75, x2: -20.25, z1: -9.35, z2: -2.0, y0: floors[2] ? floors[2].y0 : 8 };
  const inBC = (x, z) => x > BC.x1 && x < BC.x2 && z > BC.z1 && z < BC.z2, BCY = 3 * MAIN.spec.FH;
  // 방송실 자리: 새 방송실 가구 배치(mainBuilding 'bcast') 기준 — X1 = 서쪽 첫 교실 칸 안쪽 벽
  const BX = MAIN.layout.rooms.find(r => r.kind === 'class').x1 + MAIN.spec.wall / 2, BXP = BX + 9;
  const BC_SLOT = { console: [[BX + 2.55, 3.9]], cctvRec: [[BX + 1.75, 9.05]], tape: [[BXP + 1.0, 1.05], [BXP + 2.2, 1.05], [BXP + 3.4, 1.05], [BXP + 4.6, 1.05]], mina: [[BX + 17.0, 7.4]], sq: [[BXP + 4.6, 6.2], [BXP + 1.8, 8.6], [BX + 4.6, 6.6]] };
  // 5구역 장비 조사 지점: 이름에 맞는 장비 앞으로 (랙 · 스위처 · 믹서 · 편집 PC)
  const BC_FZ = [[/랙|VTR|셀렉터/, [BX + 3.45, 1.5]], [/스위처|CRT/, [BX + 2.6, 2.0]], [/믹서|마이크/, [BX + 2.6, 5.7]], [/NLE|편집 ?PC/, [BX + 6.9, 8.4]]];
  // 의자에 앉기: 방송실 실제 의자 자리 (주조정 콘솔 의자 2 · 편집석 의자 · 라디오 원탁 의자 3 · 앵커 의자 2)
  const BC_CHAIR = [[BX + 2.5, 3.0], [BX + 2.5, 4.8], [BX + 6.9, 8.5], [BX + 12.3, 6.1], [BX + 13.5, 7.3], [BX + 11.1, 7.3], [BX + 16.5, 2.5], [BX + 16.5, 3.8]]; let bcChair = 0;
  // 공중에 뜬 물건(바닥 위 0.3m 넘게): 실제 가구 윗면으로 [x, z, 높이]
  const BC_TOP = [[BX + 6.3, 9.2, .76], [BX + 12.0, 7.0, .79], [BX + 15.5, 3.4, .82], [BX + 12.6, 7.6, .79], [BX + 7.5, 9.2, .76]]; let bcTop = 0;
  const BC_FREE = [[BX + 4.4, 4.2], [BX + 6.6, 3.0], [BXP + 3.2, 5.6], [BXP + 5.2, 8.6], [BX + 6.2, 6.6], [BXP + 7.4, 6.0]];
  let bcFree = 0; const bcUsed = {};
  const bcTaken = [];
  const bcFreeSpot = () => {   // 방 안 격자에서 가구에 막히지 않고 다른 조사 지점과 1.2m 이상 떨어진 자리
    for (const [x, z] of BC_FREE) if (!bcTaken.some(([a, b]) => Math.hypot(a - x, b - z) < 1.2)) return [x, z];
    for (let z = 1.3; z < 9.0; z += .65) for (let x = BX + 2; x < BX + 17; x += .65) { if (bcTaken.some(([a, b]) => Math.hypot(a - x, b - z) < 1.2)) continue; if (R.blocked && R.blocked(x, z, BCY, .45)) continue; return [x, z]; }
    return BC_FREE[bcFree++ % BC_FREE.length];
  };
  const bcSpot = (kind, label = '') => { if (kind === 'fz' && /의자에 앉기/.test(label) && bcChair < BC_CHAIR.length) { const c = BC_CHAIR[bcChair++]; bcTaken.push(c); return c; } if (kind === 'fz') { const m = BC_FZ.find(([re, sp]) => re.test(label) && !bcTaken.includes(sp)); if (m) { bcTaken.push(m[1]); return m[1]; } } const l = BC_SLOT[kind]; let s0 = null; if (l) { const i = bcUsed[kind] = (bcUsed[kind] ?? -1) + 1; if (i < l.length) s0 = l[i]; } const s1 = s0 || bcFreeSpot(); bcTaken.push(s1); return s1; };
  if (floors[2]) for (const c of [...floors[2].interior.children]) { if (!c.userData.dynamic) continue; const w = c.getWorldPosition(new THREE.Vector3()); if (!inBC(w.x, w.z)) continue;
    const [x, z] = BC_SLOT.mina[0]; MAIN.root.attach(c); c.position.set(x, BCY + Math.max(0, w.y - BC.y0), z); c.rotation.y = -Math.PI / 2; }   // 민아 · 민아 소지품: 스튜디오 동쪽 구석 벽에 기대 앉음
  clearOld();
  // 소품 모델은 나중에 비동기로 들어온다 → 몇 번 더 걷어 낸다
  [3000, 10000, 25000, 60000, 120000].forEach(ms => setTimeout(clearOld, ms)); { let n = 0; const iv = setInterval(() => { clearOld(); if (++n > 30) clearInterval(iv); }, 9000); }

  // 2) 새 건물
  const group = new THREE.Group(); group.name = 'REBUILD'; group.userData.dynamic = true; scene.add(group);
  BLD.forEach(b => { group.add(b.root); if (b.models.length) placeModels(b.root, b.models, { shadows: false, floorH: b.spec ? b.spec.FH : 0 }); });
  if (WK.support) group.add(WK.support);   // 구름다리 기둥 · 보
  // 형광등: 자리마다 점조명 (perfStabilizer 조명 풀이 가까운 것만 골라 비춘다)
  const lamps = [];
  BLD.forEach(b => b.lights.forEach(l => { const [x, z] = b.toWorld(l.x, l.z); const p = new THREE.PointLight(0xf2f4ff, 1.6, 9, 1.6); p.position.set(x, l.y, z); p.userData.on = true; group.add(p); lamps.push(p); }));

  // 형광등 스위치 + 노출 전선관: 방마다 복도 쪽 벽(출입문 옆) 안쪽 · 층마다 복도 스위치. 스위치는 그 방 형광등(점조명 · 등기구 덮개)을 끄고 켠다
  const switches = [];
  {
    const parts = { plate: [], key: [], pipe: [] }, M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sc = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    const put = (key, w, h, d, b, lx, y, lz, rot) => { const [x, z] = b.toWorld(lx, lz), g = new THREE.BoxGeometry(w, h, d); Q.setFromAxisAngle(up, rot); M4.compose(V.set(x, y, z), Q, Sc); g.applyMatrix4(M4); parts[key].push(g); };
    for (const b of [MAIN, ANX]) {
      const [ax, az] = b.toWorld(0, 0), [bx, bz] = b.toWorld(1, 0), rot = -Math.atan2(bz - az, bx - ax), FH = b.spec.FH, CEIL = b.spec.CEIL || 2.7, zN = b.layout.zN;
      const add = (f, lx, lz, dir, rect, label) => {   // dir: +1 이면 스위치 판이 +z(로컬)를 본다
        const y0 = f * FH, n = dir * .012;
        const ls = lamps.filter(l => { const [px, pz] = b.toLocal(l.position.x, l.position.z); return px > rect.x1 && px < rect.x2 && pz > rect.z1 && pz < rect.z2 && l.position.y > y0 && l.position.y < y0 + FH; });
        if (!ls.length) return;   // 점조명이 없는 방(화장실 등)은 스위치를 달지 않는다
        put('plate', .09, .13, .02, b, lx, y0 + 1.3, lz, rot); put('key', .028, .05, .012, b, lx, y0 + 1.31, lz + n, rot);
        put('pipe', .026, CEIL - 1.37, .026, b, lx, y0 + (1.37 + CEIL) / 2 - .06, lz + dir * .016, rot);
        put('pipe', .1, .1, .05, b, lx, y0 + CEIL - .18, lz + dir * .03, rot);
        put('pipe', Math.max(1, rect.x2 - rect.x1 - .6), .026, .026, b, (rect.x1 + rect.x2) / 2, y0 + CEIL - .18, lz + dir * .02, rot);
        const [wx, wz] = b.toWorld(lx, lz + dir * .5);
        const sw = { on: true, lamps: ls, covers: null, base: label }; switches.push(sw);
        world.props.push({ kind: 'robj', k: 'light_switch', floor: 0, rbY: y0, x: wx, z: wz, y: y0 + 1.3, r: 1.3, label: label + ' 끄기', sw, _rb: true });
      };
      for (const r of b.props) {
        if (r.kind !== 'room' || r.exit || r.x2 - r.x1 < 2 || r.z1 < -.2) continue;
        if (r.label === '중앙 계단' || r.label === '중앙 현관') continue;
        add(r.floor, r.x1 + .45, (b.spec.wall || .2) / 2 + .012, 1, r, `${r.label} 형광등 스위치`);
      }
      const L = b.layout.L, cst = b.layout.rooms.find(q => q.kind === 'cstair');
      for (let f = 0; f < b.spec.floors; f++) {   // 복도: 중앙 계단 서쪽 · 복도 북벽
        const x = cst ? cst.x1 - .6 : 0;
        add(f, x, zN + .012, 1, { x1: -L / 2, x2: L / 2, z1: zN, z2: 0 }, `${f + 1}층 복도 형광등 스위치`);
      }
    }
    const mk = (key, color, rough, metal = 0) => { if (!parts[key].length) return; const g = mergeGeometries(parts[key], false); parts[key].forEach(q => q.dispose()); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })); m.name = 'RB_switch_' + key; group.add(m); };
    mk('plate', 0xece8dc, .5); mk('key', 0x2c2c2a, .5); mk('pipe', 0x9a9c98, .5, .35);
  }
  const R = {
    MAIN, ANX, WK, BLD, group, lamps,
    groundAt(x, z, feet) { let best = null; for (const b of BLD) { const [lx, lz] = b.toLocal(x, z), g = b.groundAt(lx, lz, feet); if (g != null && (best == null || g > best)) best = g; } return best; },
    blocked(x, z, y, r) { if (R.gate && y > MAIN.spec.FH - .4 && y < MAIN.spec.FH + .6 && R.gate.closed() && Math.abs(z - R.gate.z) < r + .08 && x > R.gate.x1 && x < R.gate.x2) return true; return BLD.some(b => { const [lx, lz] = b.toLocal(x, z); return b.col.some(c => !c.off && lx + r > c.x1 && lx - r < c.x2 && lz + r > c.z1 && lz - r < c.z2 && y + 1.7 > c.y1 + .001 && y + .35 < c.y2); }); },
    nearDoor(x, z, y) { let best = null, bd = 9; for (const b of BLD) { const [lx, lz] = b.toLocal(x, z), d = b.nearDoor(lx, lz, y); if (d) { const dd = Math.hypot(d.mx - lx, d.mz - lz); if (dd < bd) { bd = dd; best = d; } } } return best; },
    toggleDoor(d) { d.target = d.target > .5 ? 0 : 1; },
    // 전력 연동: 정전(blackout)이면 형광등 · 등기구 발광 모두 끔, 발전기 출력(gain) · 본전력(power)에 따라 밝기
    setPower(off, gain = 1, power = false) { const k = off ? 0 : gain * (power ? 1 : .86); if (k === this._pk) return; this._pk = k;
      lamps.forEach(l => { l.intensity = l.userData.swOff ? 0 : 1.6 * k; });
      [MAIN, ANX].forEach(b => { const m = b.mats && b.mats.lamp; if (m) m.emissiveIntensity = 1.4 * k; }); },
    // 형광등 스위치: 그 방 점조명을 끄고, 등기구 발광면은 어두운 덮개로 가린다
    switches,
    toggleSwitch(sw) { sw.on = !sw.on;
      if (!sw.covers) { sw.covers = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x5a5c60, roughness: .6 }), g = new THREE.PlaneGeometry(1.3, 1.3); g.rotateX(Math.PI / 2);
        sw.lamps.forEach(l => { const c = new THREE.Mesh(g, m); c.position.set(l.position.x, l.position.y + .075, l.position.z); sw.covers.add(c); }); group.add(sw.covers); }
      sw.covers.visible = !sw.on; const k = this._pk == null ? 1 : this._pk;
      sw.lamps.forEach(l => { l.userData.swOff = !sw.on; l.intensity = sw.on ? 1.6 * k : 0; }); return sw.on; },
    hideOld() { for (const F of OLD_FLOORS) { F.interior.visible = false; if (F.shell) F.shell.visible = false; if (F.winFake) F.winFake.visible = false; for (const o of [F.interior, F.shell, F.winFake]) if (o && !o._frozen) { o._frozen = true; o.updateMatrixWorld = NOOP; } } },   // 영구히 숨긴 예전 층: 매 프레임 행렬 갱신(수천 개)도 건너뛴다
    cull(dt, P) { cullModels(dt, P); for (const F of OLD_FLOORS) { if (F.interior.visible) F.interior.visible = false; if (F.shell && F.shell.visible) F.shell.visible = false; } },   // 매 프레임(메뉴 · 인트로 포함) 예전 층을 끈다
    // 숨긴 예전 층에 남은 죽은 상호작용(옛 스위치 · 사물함 문 · 둘러보기 · 엘리베이터 호출 · 옥상 문) 정리 — 새 건물에 같은 것이 따로 있다
    pruneOld() { const OLDF = new Set([1, 2, 3, 8, 9, 10]), dead = new Set(['switch', 'ldoor', 'look', 'elevator', 'roofDoor']); for (let i = world.props.length - 1; i >= 0; i--) { const q = world.props[i]; if (OLDF.has(q.floor) && dead.has(q.kind)) world.props.splice(i, 1); } },
    tick(dt, P, sfx) { if ((this._pt = (this._pt || 0) + dt) > 5) { this._pt = 0; this.pruneOld(); } BLD.forEach(b => b.tickDoors(dt)); OLD_FLOORS.forEach(F => { if (F.interior.visible) F.interior.visible = false; if (F.shell && F.shell.visible) F.shell.visible = false; }); /* 게임의 층 표시 로직이 예전 층을 다시 켜도 끈다 */ cullModels(dt, P); if (R.elevTick) R.elevTick(dt, P, sfx); },
    // 새 건물 땅 위에 있나 (예전 건물 자리)
    inside(x, z) { return inOld(x, z); },
    floorOf(y) { return Math.max(0, Math.round(y / MAIN.spec.FH)); },
    roomAt(x, z, y) { const f = Math.round(y / MAIN.spec.FH); for (const b of BLD) { if (!b.spec) continue; const [lx, lz] = b.toLocal(x, z); const r = (b.props || []).find(p => p.kind === 'room' && p.floor === f && lx > p.x1 && lx < p.x2 && lz > p.z1 && lz < p.z2);
      if (r) { const [cx, cz] = b.toWorld((r.x1 + r.x2) / 2, (r.z1 + r.z2) / 2); return { id: `rb:${b.name}:${f}:${r.label}`, type: ({ bcast: 'broadcast', staff: 'office' })[r.type] || r.type || 'room', name: r.label, cx, cz, rb: true, y0: f * MAIN.spec.FH, hw: (r.x2 - r.x1) / 2 - .2, hd: (r.z2 - r.z1) / 2 - .2 }; } } return null; },
    where(x, z, y) { const f = Math.round(y / MAIN.spec.FH); for (const b of BLD) { const [lx, lz] = b.toLocal(x, z); const r = (b.props || []).find(p => p.kind === 'room' && p.floor === f && lx > p.x1 && lx < p.x2 && lz > p.z1 && lz < p.z2); if (r) return `${b.name} ${f + 1}층 ${r.label}`; } return null; },
  };

  // 한 걸음 이동: 새 건물 땅이면 true (예전 계단 · 통로 순간이동 코드는 건너뛴다)
  //   P.sh = 발밑 높이. 0.5m 넘는 단 · 벽 · 가구는 막는다. 층 사이 허공으로는 걸어 나가지 않는다.
  R.BLD = BLD;   // 감사 · 테스트용
  R.step = (P, px, pz) => {
    const feet = P.sh || 0;
    if (!inOld(P.x, P.z) && feet < .3 && feet > -.3 && !inPit(P.x, P.z)) return false;   // 지하 계단 구덩이는 예전 건물 자리 밖이어도 새 건물이 높이를 맡는다
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
  // 실내 실사 소품(책상 · 의자 · 선풍기 …)은 층마다 따로 묶여 있다: 플레이어가 그 건물 안 그 층에 있을 때만 그린다
  //   (예전엔 모든 층 책상 756개 · 의자 756개가 밖에서도 늘 그려져 1100만 삼각형 → 프레임 드랍)
  let cullT = 0, cullList = null, cullKey = '';
  const cullModels = (dt, P) => {
    cullT -= dt || 0; if (cullT <= 0 || !cullList) { cullT = 2; cullList = BLD.filter(b => b.spec).map(b => { const ims = []; b.root.traverse(o => { if (o.isInstancedMesh && o.userData.rbFloor != null) ims.push(o); }); return { b, ims }; }); cullKey = ''; }
    let inB = null, f = -1, st = false;
    if (P && P.floor === 0) for (const { b } of cullList) { const [lx, lz] = b.toLocal(P.x, P.z), L = b.layout; if (lx > -L.L / 2 - .6 && lx < L.L / 2 + .6 && lz > L.zN - .6 && lz < L.zS + .6) { inB = b; f = Math.round((P.sh || 0) / b.spec.FH); st = (L.rooms || []).some(r => r.kind === 'stair' && lx > r.x1 - .3 && lx < r.x2 + .3); break; } }
    const key = (inB ? inB.name : '-') + f + st; if (key === cullKey) return; cullKey = key;
    for (const { b, ims } of cullList) for (const im of ims) im.visible = b === inB && Math.abs(im.userData.rbFloor - f) <= (st ? 1 : 0);
  };
  const roomsOf = (b, f) => (b.props || []).filter(p => p.kind === 'room' && p.floor === f && p.x2 - p.x1 > 2.5 && p.type !== 'toilet' && p.label !== '중앙 계단' && !p.exit);
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
  // 옮겨 온 물건(증언 녹음기 · 쪽지 · 열쇠 · 건전지 · 구급함 …)을 바닥 · 허공 대신 그 방의 실제 가구 윗면(책상 · 탁자 · 장 위)에 올린다
  const surfUse = new Map();
  const surfaceIn = (b, room, f) => {
    const h = f * FH, cands = [];
    for (const c of b.col) { if (c.y1 == null || c.y2 == null) continue; const top = c.y2 - h; if (top < .55 || top > 1.25 || c.y1 > h + .3) continue;
      if (c.x1 < room.x1 - .05 || c.x2 > room.x2 + .05 || c.z1 < room.z1 - .05 || c.z2 > room.z2 + .05) continue; if ((c.x2 - c.x1) * (c.z2 - c.z1) < .12) continue; cands.push(c); }
    if (!cands.length) return null;
    cands.sort((a, b2) => (surfUse.get(a) || 0) - (surfUse.get(b2) || 0) || rnd() - .5);
    const W = R._relocWorld, near = (x, z) => W && [...W.props.map(q => [q.x, q.z, q.rbY ?? (q.floor === 0 ? 0 : -99)]), ...W.items.filter(i => !i.taken).map(i => [i.pos.x, i.pos.z, i.rbY ?? -99])].some(([qx, qz, qh]) => Math.abs(qh - h) < 1 && Math.hypot(qx - x, qz - z) < 1.0);   // 다른 조사 대상과 1m 안이면 서로 가려 고를 수 없다
    for (const c of cands) for (let t = 0; t < 6; t++) {
      const lx = c.x1 + (c.x2 - c.x1) * (.2 + .6 * rnd()), lz = c.z1 + (c.z2 - c.z1) * (.2 + .6 * rnd()), [x, z] = b.toWorld(lx, lz);
      if (near(x, z)) continue; surfUse.set(c, (surfUse.get(c) || 0) + 1); return { x, z, h, top: c.y2 };
    }
    return null;
  };
  R.relocate = ({ world, floors: FL_, stairSpawnB1 }) => {
    R._relocWorld = world;
    let moved = 0, dropped = 0;
    for (const it of world.items) {
      if (it._rb || !isOld(it.floor, it.pos.x, it.pos.z)) continue; it._rb = true; it._old = { f: it.floor, x: it.pos.x, z: it.pos.z };
      if (it.floor === 2 && inBC(it.pos.x, it.pos.z)) { let [x, z] = bcSpot(it.kind), oy = it.pos.y - BC.y0; if (oy > .3 && bcTop < BC_TOP.length) { const t = BC_TOP[bcTop++]; x = t[0]; z = t[1]; if (it.baseY != null) it.baseY += t[2] + .02 - oy; oy = t[2] + .02; } else if (oy > .3) { if (it.baseY != null) it.baseY -= oy - .03; oy = .03; } it.floor = 0; it.rbY = BCY; it.pos.set(x, BCY + oy, z); if (it.baseY != null) it.baseY = BCY + it.baseY - BC.y0; if (it.mesh) moveObj(it.mesh, x, BCY + oy, z); moved++; continue; }
      const sk = it.kind === 'key' ? SPECIAL_KEY[it.idx] : null;
      const tgt = sk ? (() => { const rs = roomsOf(sk[0], sk[1]).filter(r => r.type === sk[2]); return rs.length ? { b: sk[0], f: sk[1], room: rs[0] } : pickRoom(it.floor, it.pos.x); })() : pickRoom(it.floor, it.pos.x);
      if (!tgt) continue;
      let oy = it.pos.y - (FL_[it.floor]?.y0 || 0), s = null;
      if (oy > .25) { const su = tgt.room && surfaceIn(tgt.b, tgt.room, tgt.f); if (su) { s = su; const ny = su.top - su.h + .02; if (it.baseY != null) it.baseY += ny - oy; oy = ny; } }   // 원래 책상 · 선반 위에 있던 것 → 새 방 가구 위
      if (!s) { s = spotAny(tgt.b, tgt.room, tgt.f); if (oy > .25) { if (it.baseY != null) it.baseY -= oy - .03; oy = .03; } }   // 올릴 가구가 없으면 바닥에 (허공에 뜨지 않게)
      it.floor = 0; it.rbY = s.h; it.pos.set(s.x, s.h + oy, s.z); if (it.baseY != null) it.baseY = s.h + it.baseY;
      moveObj(it.mesh, s.x, s.h + (it.baseY != null ? it.baseY - s.h : oy), s.z); moved++;
    }
    for (const p of world.props) {
      if (p._rb || !isOld(p.floor, p.x, p.z)) continue; p._rb = true; p._old = { f: p.floor, x: p.x, z: p.z };
      if (p.floor === 2 && inBC(p.x, p.z) && !DROP.has(p.kind) && !TOILET.has(p.kind)) { const [x, z] = bcSpot(p.kind, p.label || ''); if (p.label) p.label = p.label.replace(/방송(편집)?실 교실 의자/, '방송실 의자');
        for (const k of Object.keys(p)) { const o = p[k]; if (o && o.isObject3D && k !== 'parent') { const w = o.getWorldPosition(new THREE.Vector3()); moveObj(o, x, BCY + Math.max(0, w.y - BC.y0), z); } }
        p.floor = 0; p.rbY = BCY; p.x = x; p.z = z; if (p.px != null) { p.px = x; p.pz = z; } moved++; continue; }
      if (inPassOld(p.floor, p.x, p.z) && R.gate) { const [nx, nz] = R.passToNew(p.x, p.z); p.floor = 0; p.rbY = FHB; p.x = nx; p.z = nz; if (p.px != null) [p.px, p.pz] = R.passToNew(p.px, p.pz); moved++; continue; }
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
      const small = ['tape', 'clue', 'pick', 'case5', 'phone'].includes(p.kind);   // 탁자 위에 놓이는 작은 소품: 증언 녹음기 · 쪽지/단서 · 줍는 물건 · 녹음기 · 전화
      const su = small && tgt.room ? surfaceIn(tgt.b, tgt.room, tgt.f) : null, s = su || spotAny(tgt.b, tgt.room, tgt.f);
      let oy = (p.y ?? 1), base = s.h;
      if (su) { base = su.top; oy = su.top - su.h + .08; }
      for (const k of Object.keys(p)) if (p[k] && p[k].isObject3D && k !== 'parent') moveObj(p[k], s.x, base, s.z);
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
    if (!R.b1Door && stairSpawnB1) {   // 지하 계단: 중앙 계단실 1층 둘째 비행 밑 내려가는 계단(B1PIT) 맨 아래 철문
      const P = B1PIT, x = (P.x1 + P.x2) / 2, z = P.zw - .5;
      R.b1Door = { floor: 0, x, z, r: 1.4, rbY: -P.d, label: '지하 B1 철문 — 아래층으로 내려가기', to: { floor: 4, x: stairSpawnB1.x, z: stairSpawnB1.z, yaw: Math.PI }, _rb: true };
      R.b1Return = { floor: 0, x, z: P.zb + .3, yaw: Math.PI, sh: -P.d };
      world.doors.push(R.b1Door);
    }
    // 옥상: 순간이동 대신 새 본관 옥상을 직접 걷는다 — 예전 옥상(3층 공간)의 미션 구역 · 물건을 새 옥상(같은 x, 높이 4층 위)으로 옮긴다
    if (!R.roofMoved && FL_[3]) { R.roofMoved = true; const RF = FL_[3], top = MAIN.spec.floors * FH, zIn = z => Math.min(MAIN.layout.zS - .8, Math.max(MAIN.layout.zN + .8, z < MAIN.layout.zN + .8 ? z + 4.8 : z));
      for (let i = world.props.length - 1; i >= 0; i--) { const q = world.props[i]; if (q.floor !== 3) continue; if (q.kind === 'roofDoor') { world.props.splice(i, 1); continue; } q.floor = 0; q.rbY = top; q.z = zIn(q.z); q._rb = true; }
      for (const it of world.items) { if (it.floor !== 3) continue; const nz = zIn(it.pos.z), wy = it.mesh ? it.mesh.getWorldPosition(new THREE.Vector3()).y : top + .1; it.floor = 0; it.rbY = top; it.pos.z = nz; if (it.mesh) moveObj(it.mesh, it.pos.x, wy, nz); it._rb = true; }
      // 발전기 울타리 구역 · 안테나 묶음(5구역 패치가 예전 옥상에 붙인 것)은 통째로 새 옥상에 — 안테나 쪽(북쪽 밖)만 안으로 당긴다
      for (const c of [...RF.interior.children]) { if (!c.isGroup) continue; const bx = new THREE.Box3().setFromObject(c); if (bx.isEmpty() || bx.min.x < 14 || bx.max.x > 24) continue;
        group.attach(c); c.traverse(o => { if (o !== c && o.parent === c && o.position.z < MAIN.layout.zN + .8) o.position.z += 4.8; }); c.userData.rbRoof = true; }
      R.roofCol = () => RF.col.filter(r => r.x1 > 14 && r.x2 < 24).map(r => r.z1 < MAIN.layout.zN + .8 ? { ...r, z1: r.z1 + 4.8, z2: r.z2 + 4.8, ref: r } : r);
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
  const PS = (BRZ2 - BRZ1) / 10.6, PC = (BRZ1 + BRZ2) / 2 - PS * -15.2, PX = BRX - 1, FHB = MAIN.spec.FH;
  R.passToNew = (x, z) => [x + PX, z * PS + PC];
  R.passToOld = (x, z) => [x - PX, (z - PC) / PS];
  const inPassOld = (f, x, z) => f === 1 && x > -1.7 && x < 3.7 && z > -20.6 && z < -9.8;
  R.adoptPassage = (OUT, doorZ) => {
    const O = OUT.children.find(c => c.name === 'skybridge2F'); if (!O) return;
    O.userData.rbKeep = true; O.position.set(PX, 0, PC); O.scale.z = PS; O.updateMatrixWorld(true); { const bx = new THREE.Box3().setFromObject(O); O.position.y = FHB - Math.max(-.3, Math.min(.3, bx.min.y + .25)); }   // 구름다리는 2층 높이
    O.traverse(o => { if (o.isMesh) o.visible = true; });
    WK.root.visible = false;   // 겹치는 새 통로 겉모습은 숨기고 (바닥 · 충돌은 그대로) 구름다리 실내를 쓴다
    R.gate = { z: R.passToNew(0, doorZ)[1], x1: BRX - 2, x2: BRX + 2, closed: () => false };
  };
  R.inWalkway = P => P.floor === 0 && Math.abs((P.sh || 0) - FHB) < .6 && Math.abs(P.x - BRX) < 1.95 && P.z > BRZ1 - .2 && P.z < BRZ2 + .2;
  // 지하 B1 내려가는 계단: 새 본관 서쪽 계단실 1층 층참의 북쪽 절반 (x −45.6 ~ −41.4) — 계단 10단 · 1.8m 아래 철문
  //   바닥 판(땅 · 층참 슬래브)은 그 사각 기둥만 잘라 그린다 (clipping) — 땅은 캠퍼스 전체가 큰 사각형 몇 개라 메시를 자를 수 없다
  // 지하 B1 계단: 본관 중앙 계단실 1층, 둘째 비행(동쪽) 밑 — 복도 쪽(천장 높은 곳)에서 남쪽으로 10단 내려가 중간참 아래 철문
  //   (예전 서쪽 계단실 입구는 철판으로 막아 폐쇄)
  const B1PIT = (() => { const c = MAIN.layout.rooms.find(r => r.kind === 'cstair'), w = (c.x2 - c.x1 - .6) / 2, xb = c.x1 + .15 + w + .3;
    return { x1: xb + .05, x2: xb + 1.45, zt: 1.0, zb: 3.2, zw: 3.95, d: 1.8 }; })();
  {
    const P = B1PIT, mC = new THREE.MeshStandardMaterial({ color: 0x8a8780, roughness: .92 }), mStep = new THREE.MeshStandardMaterial({ color: 0x9a968c, roughness: .85 }), mRail = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: .4, metalness: .7 });
    const bx = (m, x1, x2, y1, y2, z1, z2) => { const o = new THREE.Mesh(new THREE.BoxGeometry(x2 - x1, y2 - y1, z2 - z1), m); o.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2); o.receiveShadow = true; group.add(o); };
    const n = 10, run = (P.zb - P.zt) / n;
    for (let k = 0; k < n; k++) { const z1 = P.zt + k * run; bx(mStep, P.x1, P.x2, -P.d - .05, -(k + 1) * P.d / n, z1, z1 + run); bx(mRail, P.x1, P.x2, -(k + 1) * P.d / n - .005, -(k + 1) * P.d / n + .001, z1, z1 + .03); }
    bx(mStep, P.x1, P.x2, -P.d - .05, -P.d, P.zb, P.zw);
    bx(mC, P.x1 - .1, P.x1, -P.d - .05, 0, P.zt, P.zw); bx(mC, P.x2, P.x2 + .1, -P.d - .05, 0, P.zt, P.zw); bx(mC, P.x1, P.x2, -P.d - .05, 0, P.zw, P.zw + .1);   // 구덩이 벽 3면
    for (let z = P.zt + .2; z < P.zw; z += .9) bx(mRail, P.x2 + .02, P.x2 + .06, 0, 1.0, z - .02, z + .02);
    bx(mRail, P.x2 + .01, P.x2 + .07, .98, 1.03, P.zt, P.zw); bx(mRail, P.x1, P.x2 + .07, .98, 1.03, P.zw + .02, P.zw + .08);   // 난간 (동쪽 · 남쪽)
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.0, .06), new THREE.MeshStandardMaterial({ color: 0x4a5250, roughness: .6, metalness: .55 })); leaf.position.set((P.x1 + P.x2) / 2, -P.d + 1.0, P.zw - .04); group.add(leaf);
    { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#3a0e0a'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#f0d8c0'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('지하 B1 ↓', 128, 34);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(.9, .22), new THREE.MeshBasicMaterial({ map: t })); m.position.set((P.x1 + P.x2) / 2, -P.d + 2.15, P.zw - .02); m.rotation.y = Math.PI; group.add(m);
      const m2 = m.clone(); m2.position.set(P.x2 + .1, 1.25, P.zt + .4); m2.rotation.y = Math.PI / 2; group.add(m2); }   // 위에서 보이는 안내판
    const lamp = new THREE.PointLight(0xffd8a0, .7, 4, 2); lamp.position.set((P.x1 + P.x2) / 2, -P.d + 1.9, P.zw - .6); group.add(lamp); lamps.push(lamp);
    // 예전 입구 (서쪽 계단실 1층 북쪽): 철판으로 덮고 폐쇄 표시
    { const L = MAIN.layout, x0 = -L.L / 2 + .3, x1 = -L.L / 2 + 5.0, z0 = L.zN + .1, z1 = L.zN + 1.3;
      bx(new THREE.MeshStandardMaterial({ color: 0x5a5e60, roughness: .5, metalness: .6 }), x0, x1, .02, .05, z0, z1);
      for (let k = 0; k < 6; k++) bx(new THREE.MeshStandardMaterial({ color: k % 2 ? 0x1a1a1a : 0xd8b820, roughness: .6 }), x0 + k * (x1 - x0) / 6, x0 + (k + 1) * (x1 - x0) / 6, .05, .06, z1 - .12, z1);
      const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d'); g.fillStyle = '#d8b820'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#1a1a1a'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('폐 쇄', 128, 40); g.font = '18px sans-serif'; g.fillText('지하 출입은 중앙계단으로', 128, 78);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(.8, .3), new THREE.MeshBasicMaterial({ map: t })); m.position.set((x0 + x1) / 2, .061, (z0 + z1) / 2); m.rotation.x = -Math.PI / 2; group.add(m); }
  }
  // 바닥 판 자르기: 사각 기둥 (x xw~xb · z z1~z2 · 높이 0.15 아래) 안의 픽셀만 버린다
  const pitClip = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), B1PIT.x1), new THREE.Plane(new THREE.Vector3(1, 0, 0), -B1PIT.x2), new THREE.Plane(new THREE.Vector3(0, 0, -1), B1PIT.zt), new THREE.Plane(new THREE.Vector3(0, 0, 1), -B1PIT.zw), new THREE.Plane(new THREE.Vector3(0, 1, 0), -.15)];
  const clipFloor = () => { const cx = (B1PIT.x1 + B1PIT.x2) / 2, cz = (B1PIT.zt + B1PIT.zw) / 2; scene.traverse(o => {
    if (!o.isMesh || o.userData.pitClip || o.parent === group) return; const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); const b = new THREE.Box3().copy(g.boundingBox).applyMatrix4(o.matrixWorld);
    if (b.max.y > .2 || b.min.y < -.6 || b.max.y < -.3 || cx < b.min.x || cx > b.max.x || cz < b.min.z || cz > b.max.z) { if (!(o.name === 'RB_terr' || o.name === 'RB_conc')) return; }
    o.userData.pitClip = true; const fix = m => { const c = m.clone(); c.clippingPlanes = pitClip; c.clipIntersection = true; c.clipShadows = true; c.needsUpdate = true; return c; };
    o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material); }); };
  R.clipFloor = clipFloor; setTimeout(clipFloor, 500); setTimeout(clipFloor, 8000);
  const inPit = (x, z) => x > B1PIT.x1 && x < B1PIT.x2 && z > B1PIT.zt && z < B1PIT.zw;
  R.inPit = inPit;
  const pitH = z => z <= B1PIT.zt ? 0 : z >= B1PIT.zb ? -B1PIT.d : -B1PIT.d * (z - B1PIT.zt) / (B1PIT.zb - B1PIT.zt);
  // 엘리베이터: 본관 · 별관 복도 북쪽 외벽(코어 동쪽) 바깥 승강로 — 실제로 타고 오르내린다
  //   복도에서 E: 호출(다른 층이면 칸이 내려오고/올라온 뒤 문이 열린다) · 칸 안에서 E 위층 / Q 아래층 · 문은 몇 초 뒤 저절로 닫힌다
  R.elevs = []; const ELV = [];
  const mElv = new THREE.MeshStandardMaterial({ color: 0x9aa2a8, roughness: .3, metalness: .85 }), mFrame = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: .5, metalness: .6 });
  const mBtn = new THREE.MeshStandardMaterial({ color: 0xffb040, emissive: 0xff8a20, emissiveIntensity: .8 }), mShaft = new THREE.MeshStandardMaterial({ color: 0x8a8a84, roughness: .9 }), mCarF = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: .7 });
  const EW = .6;
  [MAIN, ANX].forEach(b => {
    const T = b.spec.outer, zw = b.layout.zN - T, n = b.spec.floors, zc1 = zw - 1.7, zc2 = zw - .02;
    const EX = b.elevX, CAR = { x1: EX - .66, x2: EX + .66 };
    const E = { b, n, f: 0, y: 0, target: 0, door: 0, doorT: 0, wait: 0, moving: false, landing: [], zw, zc1, zc2, EX, CAR };
    const box = (par, w, h, d, m, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); if (m === mShaftB) { const uv = g.attributes.uv, n = g.attributes.normal; for (let i = 0; i < uv.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)); uv.setXY(i, uv.getX(i) * (ax > .5 ? d : w) / 1.6, uv.getY(i) * (ay > .5 ? d : h) / 1.6); } }
      const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = m === mShaftB; par.add(o); return o; };
    const mShaftB = b.mats.brick || mShaft;   // 승강로 탑: 건물과 같은 벽돌 (맨 콘크리트 기둥이 예전 건물 잔재처럼 보이던 것)
    // 승강로 (바깥에서 보이는 콘크리트 탑)
    const top = n * b.spec.FH + 1.2, zm = (zw - 1.85 + zw) / 2;
    box(b.root, 1.9, top + .3, .2, mShaftB, EX, top / 2 - .15, zw - 1.94); box(b.root, .2, top + .3, 1.94, mShaftB, EX - .85, top / 2 - .15, zm - .04); box(b.root, .2, top + .3, 1.94, mShaftB, EX + .85, top / 2 - .15, zm - .04);
    box(b.root, 2.1, .3, 2.3, b.mats.conc || mShaft, EX, top, zm - .04);
    // 칸 (바닥 · 벽 3면 · 천장 조명 · 조작반)
    const car = new THREE.Group(); b.root.add(car); E.car = car;
    box(car, 1.36, .06, 1.7, mCarF, EX, .03, (zc1 + zc2) / 2); box(car, 1.36, 2.3, .04, mElv, EX, 1.18, zc1 + .02); box(car, .04, 2.3, 1.7, mElv, CAR.x1, 1.18, (zc1 + zc2) / 2); box(car, .04, 2.3, 1.7, mElv, CAR.x2, 1.18, (zc1 + zc2) / 2);
    box(car, 1.36, .05, 1.7, mFrame, EX, 2.35, (zc1 + zc2) / 2); box(car, .5, .02, .3, new THREE.MeshBasicMaterial({ color: 0xf4f0e0 }), EX, 2.32, (zc1 + zc2) / 2);
    box(car, .04, .5, .2, mFrame, CAR.x2 - .03, 1.2, zc2 - .35);
    const cv = document.createElement('canvas'); cv.width = 96; cv.height = 48; const cx = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(.22, .11), new THREE.MeshBasicMaterial({ map: tex })); disp.position.set(EX, 2.1, zc1 + .05); car.add(disp);
    E.show = t => { cx.fillStyle = '#05080c'; cx.fillRect(0, 0, 96, 48); cx.fillStyle = '#ff9a3a'; cx.font = 'bold 28px monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, 48, 26); tex.needsUpdate = true; };
    const lamp = new THREE.PointLight(0xfff4e0, .9, 4, 2); lamp.position.set(EX, 2.1, (zc1 + zc2) / 2); car.add(lamp);
    for (let f = 0; f < n; f++) {
      const y = f * b.spec.FH, lz = b.layout.zN + .06, g = new THREE.Group(); g.position.set(EX, y, lz); b.root.add(g);
      box(g, 1.4, .25, .08, mFrame, 0, 2.27, 0); box(g, .1, 2.15, .08, mFrame, -.65, 1.07, 0); box(g, .1, 2.15, .08, mFrame, .65, 1.07, 0);
      const L = box(g, EW, 2.1, .04, mElv, -.3, 1.05, .05), Rr = box(g, EW, 2.1, .04, mElv, .3, 1.05, .05);
      box(g, .12, .2, .03, mFrame, .95, 1.15, .02); box(g, .05, .05, .02, mBtn, .95, 1.2, .04); box(g, .05, .05, .02, mBtn, .95, 1.1, .04);
      { const c = document.createElement('canvas'); c.width = 128; c.height = 48; const x = c.getContext('2d'); x.fillStyle = '#05080c'; x.fillRect(0, 0, 128, 48); x.fillStyle = '#ff9a3a'; x.font = 'bold 30px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(`${f + 1}F`, 64, 26);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(.36, .14), new THREE.MeshBasicMaterial({ map: t })); m.position.set(0, 2.5, .05); g.add(m); }
      E.landing.push({ L, R: Rr });
      const [wx, wz] = b.toWorld(EX, lz + .9), [fx, fz] = b.toWorld(EX, lz + 1.6);
      R.elevs.push({ b, f, n, x: wx, z: wz, rbY: y, out: { x: fx, z: fz }, yaw: Math.atan2(-(fx - wx), -(fz - wz)), E });
    }
    E.show('1F'); ELV.push(E);
  });
  const inCar = (E, lx, lz) => lx > E.CAR.x1 + .05 && lx < E.CAR.x2 - .05 && lz > E.zc1 + .05 && lz < E.zw + .02;
  const elvAt = (x, z) => { for (const E of ELV) { const [lx, lz] = E.b.toLocal(x, z); if (lx > E.EX - .85 && lx < E.EX + .85 && lz > E.zw - 2 && lz < E.zw + .02) return { E, lx, lz }; } return null; };
  // 높이 · 충돌: 칸 바닥은 칸 높이, 승강로 벽 · 칸 벽은 막힘, 문이 닫혀 있거나 칸이 없는 층의 출입구도 막힘
  const gA = R.groundAt, bA = R.blocked;
  const elvSill = (x, z) => { for (const E of ELV) { const [lx, lz] = E.b.toLocal(x, z); if (lx > E.EX - .62 && lx < E.EX + .62 && lz >= E.zw - .02 && lz <= E.b.layout.zN + .05) return E; } return null; };
  R.groundAt = (x, z, feet) => { const h = elvAt(x, z); if (h) { const { E, lx, lz } = h; if (lz < E.zw && inCar(E, lx, lz) && Math.abs(feet - E.y) < 1.2) return E.y + .06; if (lz < E.zw) return null; }
    const sE = elvSill(x, z); if (sE) { const fy = Math.round(feet / sE.b.spec.FH) * sE.b.spec.FH; if (Math.abs(feet - fy) < .4) return Math.max(fy, Math.abs(sE.y + .06 - feet) < .2 ? sE.y + .06 : fy); }   // 승강장 문턱 (벽 두께)
    return gA(x, z, feet); };
  R.blocked = (x, z, y, r) => { const h = elvAt(x, z); if (h) { const { E, lx, lz } = h, open = E.door > .85 && Math.abs(E.y - y) < .7 && !E.moving;
      if (lz < E.zw + r && (lx - r < E.CAR.x1 + .02 || lx + r > E.CAR.x2 - .02) && lz < E.zw) return true;   // 칸 옆벽
      if (lz - r < E.zc1 + .04) return true;   // 칸 뒷벽
      if (lz > E.zw - .3 && lz < E.zw + r + .05 && !open) return true; }
    return bA(x, z, y, r); };
  { const bR = R.blocked, top = MAIN.spec.floors * MAIN.spec.FH; R.blocked = (x, z, y, r) => { if (y > top - .3 && y < top + 1 && R.roofCol && R.roofCol().some(c => !c.off && x + r > c.x1 && x - r < c.x2 && z + r > c.z1 && z - r < c.z2 && !(c.h != null && c.h <= .4))) return true; return bR(x, z, y, r); }; }
  { const gB = R.groundAt, bB = R.blocked;
    R.groundAt = (x, z, feet) => { if (inPit(x, z) && feet < .35 && feet > pitH(z) - .7) return pitH(z); return gB(x, z, feet); };
    R.blocked = (x, z, y, r) => { if (y < .6 && inPit(x, z) && z > B1PIT.zt + .25 && y > pitH(z) + .45) return true;   /* 구덩이 규칙은 1층 바닥 높이에서만 — 위 계단(중간참 · 2비행)을 투명벽처럼 막던 버그 */ if (z > B1PIT.zw - .25 && z < B1PIT.zw + .3 && x > B1PIT.x1 && x < B1PIT.x2 && y < -.2) return true; if (y < -.2 && z > B1PIT.zt && z < B1PIT.zw && (x < B1PIT.x1 + .2 || x > B1PIT.x2 - .2)) return true; return bB(x, z, y, r); }; }
  R.nearElev = (x, z, y) => {
    const h = elvAt(x, z); if (h && h.lz < h.E.zw) { const E = h.E, f = Math.round(E.y / E.b.spec.FH); return { inCar: true, E, f, n: E.n, rbY: E.y }; }
    return R.elevs.find(e => Math.abs(e.rbY - y) < 1.2 && Math.hypot(e.x - x, e.z - z) < 1.3);
  };
  // 조작: 복도에서는 호출, 칸 안에서는 dir(+1 위 / -1 아래)
  R.elevAct = (e, dir) => {
    const E = e.E; if (E.moving) return 'moving';
    if (e.inCar) { const nf = Math.round(E.y / E.b.spec.FH) + dir; if (nf < 0 || nf >= E.n) return 'end'; E.target = nf; E.door = Math.min(E.door, 1); E.doorT = 0; E.go = true; return 'go'; }
    const fHere = e.f; if (Math.abs(E.y - fHere * E.b.spec.FH) < .05) { E.doorT = 1; E.wait = 5; return 'open'; }
    E.target = fHere; E.go = true; E.doorT = 0; return 'call';
  };
  R.elevTo = (e, dir) => { const nf = e.f + dir; if (nf < 0 || nf >= e.n) return null; const t = R.elevs.find(q => q.b === e.b && q.f === nf); return { floor: 0, x: t.out.x, z: t.out.z, yaw: t.yaw, sh: t.rbY }; };
  R.elevTick = (dt, P, sfx) => {
    for (const E of ELV) {
      const FHb = E.b.spec.FH, ty = E.target * FHb;
      // 문: doorT 쪽으로 (0 닫힘 · 1 열림)
      if (E.door !== E.doorT) E.door += Math.sign(E.doorT - E.door) * Math.min(Math.abs(E.doorT - E.door), dt * 1.4);
      const fNow = Math.round(E.y / FHb);
      E.landing.forEach((l, i) => { const k = i === fNow && !E.moving ? E.door : 0; l.L.position.x = -.3 - k * .58; l.R.position.x = .3 + k * .58; });
      const h = P && P.floor === 0 ? elvAt(P.x, P.z) : null, rider = h && h.E === E && h.lz < E.zw && Math.abs((P.sh || 0) - E.y) < 1.3;
      if (E.go && E.door <= .01) { E.go = false; E.moving = Math.abs(ty - E.y) > .01; if (E.moving) sfx && sfx.elevator && sfx.elevator(Math.abs(ty - E.y) / 1.2); }
      if (E.moving) { const d = ty - E.y, st = Math.sign(d) * Math.min(Math.abs(d), dt * 1.2 * Math.min(1, .25 + Math.abs(d))); E.y += st; if (rider) P.sh = E.y + .06;
        if (Math.abs(ty - E.y) < .005) { E.y = ty; E.moving = false; E.doorT = 1; E.wait = 5; sfx && sfx.elevatorChime && sfx.elevatorChime(); } E.show(`${Math.round(E.y / FHb) + 1}F${E.moving ? (d > 0 ? '▲' : '▼') : ''}`); }
      else if (E.door >= .99 && E.doorT === 1) { E.wait -= dt; const inDoor = h && h.E === E && Math.abs(h.lz - E.zw) < .6; if (rider) E.wait = Math.max(E.wait, 1); if (E.wait <= 0 && !inDoor) E.doorT = 0; }
      E.car.position.y = E.y;
    }
  };

  // ── 3단계: 위치 안내 ──
  // 새 건물 안인가 (각 건물 좌표계의 외곽 상자)
  R.inBuilding = (x, z) => BLD.some(b => { const [lx, lz] = b.toLocal(x, z); if (b.layout) return lx > -b.layout.L / 2 - .3 && lx < b.layout.L / 2 + .3 && lz > b.layout.zN - .3 && lz < b.layout.zS + .3; return b.groundAt(lx, lz, b.walk[0].h()) != null; });   // 구름다리: 바닥 높이 기준
  R.floorLabel = (x, z, y) => { for (const b of [MAIN, ANX]) { const [lx, lz] = b.toLocal(x, z); if (lx > -b.layout.L / 2 - .3 && lx < b.layout.L / 2 + .3 && lz > b.layout.zN - .3 && lz < b.layout.zS + .3) return `${b.name} ${Math.round(y / FH) + 1}층`; } return R.inBuilding(x, z) ? '구름다리 (2층)' : null; };
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
    shells.push(corners(WK, BRX - 1.9, BRX + 1.9, BRZ1, BRZ2));
    const here = R.where(x, z, y);
    const rooms = [MAIN, ANX].flatMap(b => (b.props || []).filter(p => p.kind === 'room' && p.floor === f).map(p => { const [cx, cz] = b.toWorld(p.x ?? (p.x1 + p.x2) / 2, p.z ?? (p.z1 + p.z2) / 2); return { pts: corners(b, p.x1, p.x2, p.z1, p.z2), label: p.label, cx, cz, here: here && here.endsWith(p.label) }; }));
    return (mdVal = { clear: [OLD_MAIN, OLD_ANNEX], shells, rooms });
  };
  // 지도 탭: 건물 하나의 한 층 평면 (bk 'M' 본관 · 'A' 별관)
  R.mapStory = (bk, f) => {
    const corners = (b, x1, x2, z1, z2) => [[x1, z1], [x2, z1], [x2, z2], [x1, z2]].map(([a, c]) => b.toWorld(a, c));
    const b = bk === 'A' ? ANX : MAIN, shells = [MAIN, ANX].map(q => corners(q, -q.layout.L / 2, q.layout.L / 2, q.layout.zN, q.layout.zS)); shells.push(corners(WK, BRX - 1.9, BRX + 1.9, BRZ1, BRZ2));
    const rooms = (b.props || []).filter(p => p.kind === 'room' && p.floor === f).map(p => { const [cx, cz] = b.toWorld(p.x ?? (p.x1 + p.x2) / 2, p.z ?? (p.z1 + p.z2) / 2); return { pts: corners(b, p.x1, p.x2, p.z1, p.z2), label: p.label, cx, cz }; });
    b.layout.rooms.filter(r => r.kind === 'stair').forEach(r => { const [cx, cz] = b.toWorld((r.x1 + r.x2) / 2, b.layout.zS / 2); rooms.push({ pts: corners(b, r.x1, r.x2, b.layout.zN, b.layout.zS), label: '계단', cx, cz, stair: true }); });
    { const [cx, cz] = b.toWorld(0, b.layout.zN / 2); rooms.unshift({ pts: corners(b, -b.layout.L / 2, b.layout.L / 2, b.layout.zN, 0), label: '복도', cx, cz, hall: true }); }
    return { clear: [OLD_MAIN, OLD_ANNEX], shells, rooms, floors: b.spec.floors };
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
