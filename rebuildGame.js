// 재건축 본관 · 별관을 게임 안에 들인다 (1단계: 건물 · 보행 · 충돌 · 문 · 조명)
//   항상 켜진다 (예전 건물 모드는 폐지).
//   예전 본관(1~3층 · 옥상) · 별관(8~10층) 건물은 감추고, 그 자리 땅(0층)에서 새 건물을 걷는다.
//   높이는 P.sh(계단 높이 보정값)로 넘긴다 → 카메라 · 점프 · 가구 오르기 코드는 손대지 않아도 된다.
import { buildMainBuilding, buildWalkway, ANNEX_SPEC, ANNEX_PLAN } from './rebuild/mainBuilding.js?v=305';
import { placeModels } from './rebuild/models.js?v=305';
import { carve, subdivide } from './rebuild/transplant.js?v=305';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';
import { turfMaterial } from './campusVisuals.js?v=305';

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
  const hideIn = (root, oldRoot = false) => { if (!root) return; root.traverse(o => {
    if (o.userData.rbChk) return; o.userData.rbChk = true;   // 한 번 본 것은 다시 보지 않는다 (반복 정리가 매번 씬 전체를 훑어 초반에 수 초씩 멈췄다)
    if ((o.isMesh || o.isSprite) && o.visible && !o.isInstancedMesh) { const w = o.isSprite ? o.getWorldPosition(v) : bb.setFromObject(o).getCenter(v); if (!o.isSprite && bb.getSize(new THREE.Vector3()).length() > 8) {} else if (w.y < 3.5 && oldSpot(w.x, w.z)) { let keep = false; for (let q = o; q; q = q.parent) if (q.name === 'REBUILD' || q.isSkinnedMesh || (q.userData && q.userData.rbKeep)) keep = true; if (!keep) { o.visible = false; return; } } }
    if (o.isSprite && o.visible) { for (let a = o; a; a = a.parent) if (a.isCamera || a.name === 'REBUILD' || a.isSkinnedMesh || (a.userData && (a.userData.rbKeep || a.userData.rbRoof))) return; const w = o.getWorldPosition(v); if (inOld(w.x, w.z) || inNew(w.x, w.z)) { o.visible = false; o.scale.setScalar(0); } return; }   // 예전 벽등 · 가로등의 빛 번짐 스프라이트
    if (!o.isMesh || !o.visible) return;
    for (let a = o; a; a = a.parent) if (a.userData && a.userData.rbKeep) return;   // 새 연결 통로로 옮긴 구름다리 연출
    if (o.isInstancedMesh) { const p = new THREE.Vector3(); let hit = 0, live = 0; o.updateMatrixWorld(true);
      // 거리 컬링이 원본 행렬을 따로 들고 있으면 그쪽을 고친다 (화면용 배열만 고치면 컬링이 원본에서 다시 살려 냈다)
      const e = window.__perfInst && window.__perfInst(o), arr = e ? e.src : o.instanceMatrix.array, n = e ? e.n : o.count;
      for (let i = 0; i < n; i++) { const k = i * 16; if (arr[k] === 0 && arr[k + 5] === 0 && arr[k + 10] === 0) continue; p.set(arr[k + 12], arr[k + 13], arr[k + 14]).applyMatrix4(o.matrixWorld); if (inOld(p.x, p.z) && p.y > -.5) { arr.fill(0, k, k + 16); hit++; } else live++; }
      if (hit && !e) { let w = 0; const col = o.instanceColor && o.instanceColor.array; for (let i = 0; i < n; i++) { const k = i * 16; if (arr[k] === 0 && arr[k + 5] === 0 && arr[k + 10] === 0) continue; if (w !== i) { arr.copyWithin(w * 16, k, k + 16); if (col) col.copyWithin(w * 3, i * 3, i * 3 + 3); } w++; } o.count = w; o.instanceMatrix.needsUpdate = true; if (col) o.instanceColor.needsUpdate = true; if (!w) { o.layers.disable(0); o.layers.enable(7); } }   // 전부 걷어 냈으면 그리기 호출에서도 뺀다
      return; }
    bb.setFromObject(o); if (bb.isEmpty()) return;
    if (bb.max.y < .3 && !o.userData.dynamic && Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) < 20 && inOld(bb.min.x + .9, bb.min.z + .9) && inOld(bb.max.x - .9, bb.max.z - .9) && (Math.min(bb.max.x - bb.min.x, bb.max.z - bb.min.z) < .7 || Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) < 12)) { o.visible = false; return; }   // 예전 건물 기단 · 경계석 띠 · 현관 포치   // 예전 건물 기단 · 경계석 띠
    // 예전 건물 1층 바닥판(나무 마루 · 복도 타일)이 새 건물 밖(본관 ↔ 별관 사이 등)에 남아 있던 것: 예전 땅 안 삼각형은 모두 걷어 내고 잔디로 덮는다
    if (oldRoot && bb.max.y < .3 && !o.userData.dynamic && !o.userData.rbOldFloorGone) { o.userData.rbOldFloorGone = true; subdivide(o, 1.0); carve(o, (x, y, z) => inOld(x, z)); return; }
    if (bb.max.y < .3) { if (inNew((bb.min.x + bb.max.x) / 2, (bb.min.z + bb.max.z) / 2) && bb.max.x - bb.min.x < 60 && bb.max.z - bb.min.z < 30) o.visible = false; else if (!o.userData.rbFloorCut && !o.userData.dynamic && !(o.geometry && o.geometry.groups && o.geometry.groups.length > 1)) { o.userData.rbFloorCut = true; const ov = [MAIN, ANX].some(b => { const c = [[-b.layout.L / 2, b.layout.zN], [b.layout.L / 2, b.layout.zS]].map(([a, d]) => b.toWorld(a, d)); return bb.max.x > Math.min(c[0][0], c[1][0]) && bb.min.x < Math.max(c[0][0], c[1][0]) && bb.max.z > Math.min(c[0][1], c[1][1]) && bb.min.z < Math.max(c[0][1], c[1][1]); }); if (ov) { subdivide(o, 1.0); carve(o, (x, y, z) => y > -.3 && inNew(x, z)); } } return; }   // 예전 바닥판: 새 건물 바닥 밑에서 겹쳐 깜빡이던 것
    if (fits(bb)) { o.visible = false; return; }
    // 층 전체를 합친 메시: 예전 건물 땅 위(높이 0.3m 이상)의 삼각형만 잘라 낸다 (벽 · 창 · 덩굴 잔재가 새 교실을 뚫고 나오던 문제)
    if (o.userData.dynamic || o.userData.rbCarved || !(bb.max.x > -47 && bb.min.x < 47 && bb.max.z > -34 && bb.min.z < 10.6)) return;
    o.userData.rbCarved = true; carve(o, (x, y, z) => (y > .3 && inOld(x, z)) || (y > -.3 && inNew(x, z)));
  }); };
  const clearOld = () => {
    OLD_FLOORS.forEach(F => { F.interior.visible = false; if (F.shell) F.shell.visible = false; });   // 예전 층: 플레이 전(인트로 · 메뉴)에도 감춘다
    hideIn(floors[0].interior, true); hideIn(floors[0].shell, true); hideIn(world.OUT);
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
  const BC_FZ = [[/랙|VTR|셀렉터/, [BX + 3.45, 1.5]], [/스위처|CRT/, [BX + 2.6, 2.0]], [/믹서|마이크/, [BX + 2.6, 5.7]], [/NLE|편집 ?PC/, [BX + 6.1, 8.4]]];
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
  if (floors[2]) { let side = 0; for (const c of [...floors[2].interior.children]) { if (!c.userData.dynamic) continue; const w = c.getWorldPosition(new THREE.Vector3()); if (!inBC(w.x, w.z)) continue;
    // 민아 본인 · 민아 바닥 소품(예전 자리 x −21.65 · z −8.45)만 벽에 기대 앉히고, 같은 방에 있던 다른 장비(수신기 등)는
    //   민아 머리 위에 겹치지 않게 앵커 데스크 쪽 바닥에 한 줄로 내려놓는다
    const [x, z] = BC_SLOT.mina[0], isMina = Math.abs(w.x + 21.65) < .15 && Math.abs(w.z + 8.45) < .15; MAIN.root.attach(c);
    if (isMina) { c.position.set(x, BCY + Math.max(0, w.y - BC.y0), z); c.rotation.y = -Math.PI / 2; }
    else { side++; c.position.set(x - .2, BCY, z - 1.0 - .7 * side); c.rotation.y = -Math.PI / 2; } } }   // 민아 · 민아 소지품: 스튜디오 동쪽 구석 벽에 기대 앉음
  clearOld();
  // 예전 건물 터(본관 · 별관 옛 자리)에 잔디: 새 본관 · 별관 바닥 밑은 비우고 덮는다 (길 · 보도블록은 위에 그대로)
  let FOOTPRINTS = []; { const holes = FOOTPRINTS = [MAIN, ANX].map(b => { const c = [[-b.layout.L / 2 - .5, b.layout.zN - .5], [b.layout.L / 2 + .5, b.layout.zS + .5]].map(([a, d]) => b.toWorld(a, d)); return [Math.min(c[0][0], c[1][0]), Math.max(c[0][0], c[1][0]), Math.min(c[0][1], c[1][1]), Math.max(c[0][1], c[1][1])]; });
    const R = [-37, 37, -32.2, 10.1], quads = [], st = .5;
    for (let z = R[2]; z < R[3] - 1e-6; z += st) { const z2 = Math.min(R[3], z + st), zc = (z + z2) / 2; let spans = [[R[0], R[1]]];
      holes.forEach(([x1, x2, h1, h2]) => { if (zc < h1 || zc > h2) return; spans = spans.flatMap(([a, b]) => b <= x1 || a >= x2 ? [[a, b]] : [[a, Math.max(a, x1)], [Math.min(b, x2), b]].filter(([p, q]) => q - p > .01)); });
      spans.forEach(([a, b]) => { const g = new THREE.PlaneGeometry(b - a, z2 - z); g.rotateX(-Math.PI / 2); g.translate((a + b) / 2, .004, zc); const uv = g.attributes.uv, pos = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 2, -pos.getZ(i) / 2); quads.push(g); }); }
    const t = turfMaterial(), m = t.clone(); m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -1;
    const gm = new THREE.Mesh(mergeGeometries(quads), m); gm.name = 'RB_oldsite_grass'; gm.receiveShadow = true; gm.userData.rbKeep = true; scene.add(gm);
    // 예전 필로티 보도(본관 ↔ 별관 사이 x −37 ~ 37 띠)는 새 배치와 맞지 않고 UV 가 늘어나 나무판자처럼 보였다 → 걷어 내고 두 현관을 잇는 보도만 새로 깐다
    const bb2 = new THREE.Box3(); let paveM = null;
    world.OUT.traverse(o => { if (!o.isMesh || o.isInstancedMesh) return; bb2.setFromObject(o); if (bb2.min.x < -36 && bb2.max.x > 36 && bb2.max.y < .05 && bb2.min.z > -17.5 && bb2.max.z < -9 && bb2.max.z - bb2.min.z < 8) { paveM = paveM || o.material; o.visible = false; } });
    if (paveM) { const zA = holes[1][3] - .5, zB = holes[0][2] + .5, w = 3.2, g = new THREE.PlaneGeometry(w, zB - zA); g.rotateX(-Math.PI / 2); g.translate(BRX, .012, (zA + zB) / 2);
      const uv = g.attributes.uv, pos = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 1.6, -pos.getZ(i) / 1.6);
      const pm = paveM.clone(); if (pm.map) { pm.map = pm.map.clone(); pm.map.repeat.set(1, 1); pm.map.needsUpdate = true; } const pv = new THREE.Mesh(g, pm); pv.name = 'RB_link_path'; pv.receiveShadow = true; pv.userData.rbKeep = true; scene.add(pv); } }
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
        { const hit = (x, z, ya, yb) => b.col.some(c => (c.y2 == null ? ya < 3 : c.y2 > ya && (c.y1 ?? 0) < yb) && x > c.x1 - .3 && x < c.x2 + .3 && z > c.z1 - .3 && z < c.z2 + .3);   // 가구가 스위치 앞을 막으면 벽을 따라 빈 자리로
          const inDoor = x => b.layout.rooms.some(q => q.kind === 'class' && ((x > q.x1 + .5 && x < q.x1 + 1.9) || (x > q.x2 - 1.9 && x < q.x2 - .5)));   // 앞 · 뒷문 개구부(미닫이 문짝 자리 포함) 위엔 달지 않는다
          if (Math.abs(lz) < 1 && inDoor(lx)) { const c = [lx - .9, lx + .9, lx - 1.6, lx + 1.6].find(x => x > rect.x1 + .3 && x < rect.x2 - .3 && !inDoor(x)); if (c != null) lx = c; }
          if (hit(lx, lz + dir * .45, y0 + .1, y0 + 1.6)) for (const o of [.5, -.5, 1, -1, 1.5, -1.5, 2, -2, 2.6, -2.6]) { const nx = lx + o; if (nx < rect.x1 + .3 || nx > rect.x2 - .3 || (Math.abs(lz) < 1 && inDoor(nx))) continue; if (!hit(nx, lz + dir * .45, y0 + .1, y0 + 1.6)) { lx = nx; break; } } }
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
        // 출입문 바로 옆 (교실 칸의 앞문 서쪽 · 칸막이로 나눈 동쪽 방은 뒷문 동쪽) — 방 한가운데나 문 없는 쪽에 붙던 스위치
        const bay = b.layout.rooms.find(q => q.kind === 'class' && (r.x1 + r.x2) / 2 > q.x1 && (r.x1 + r.x2) / 2 < q.x2), front = bay ? bay.x1 + .7 : null;
        const lx = !bay || (front > r.x1 && front < r.x2) ? (bay ? bay.x1 + .42 : r.x1 + .45) : bay.x2 - .42;
        add(r.floor, Math.min(r.x2 - .15, Math.max(r.x1 + .15, lx)), (b.spec.wall || .2) / 2 + .012, 1, r, `${r.label} 형광등 스위치`);
      }
      const L = b.layout.L, cst = b.layout.rooms.find(q => q.kind === 'cstair');
      for (let f = 0; f < b.spec.floors; f++) {   // 복도: 중앙 계단 서쪽 · 복도 북벽
        const x = -L / 2 + 1.1;   // 복도 서쪽 끝(계단실 옆) 북벽 — 가운데 현관 · 엘리베이터 문과 겹치지 않게
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
    toggleDoor(d) { const t = d.target > .5 ? 0 : 1; d.target = t;   // 양여닫이(현관 유리문 2짝): 두 짝이 같은 손잡이 자리를 공유한다 → 함께 연다 (예전엔 한 짝만 열렸다)
      for (const b of BLD) if (b.doors && b.doors.includes(d)) b.doors.forEach(o => { if (o !== d && o.label === d.label && Math.abs(o.mx - d.mx) < .05 && Math.abs(o.mz - d.mz) < .05 && Math.abs(o.py - d.py) < .1) o.target = t; }); },
    // 전력 연동: 정전(blackout)이면 형광등 · 등기구 발광 모두 끔, 발전기 출력(gain) · 본전력(power)에 따라 밝기
    setPower(off, gain = 1, power = false) { const k = off ? 0 : gain * (power ? 1 : .86); if (k === this._pk) return; this._pk = k;
      lamps.forEach(l => { l.intensity = l.userData.swOff ? 0 : 1.6 * k; });
      [MAIN, ANX].forEach(b => { const m = b.mats && b.mats.lamp; if (m) m.emissiveIntensity = switches.some(s => s.on) ? 1.4 * k : 0; }); },
    // 형광등 스위치: 그 방 점조명을 끄고, 등기구 발광면은 어두운 덮개로 가린다
    switches,
    toggleSwitch(sw) { sw.on = !sw.on;
      if (!sw.covers) { sw.covers = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: 0x5a5c60, roughness: .6 }), g = new THREE.PlaneGeometry(1.3, 1.3); g.rotateX(Math.PI / 2);
        sw.lamps.forEach(l => { const c = new THREE.Mesh(g, m); c.position.set(l.position.x, l.position.y + .075, l.position.z); sw.covers.add(c); }); group.add(sw.covers); }
      sw.covers.visible = !sw.on; const k = this._pk == null ? 1 : this._pk;
      sw.lamps.forEach(l => { l.userData.swOff = !sw.on; l.intensity = sw.on ? 1.6 * k : 0; });
      [MAIN, ANX].forEach(b => { const m = b.mats && b.mats.lamp; if (m) m.emissiveIntensity = switches.some(s => s.on) ? 1.4 * k : 0; }); return sw.on; },
    // 건물 전체 소등으로 시작 (폐교 분위기 · 손전등 진행): 모든 방 스위치를 내리고 등기구 발광도 끈다 — 덮개 메시는 만들지 않는다
    allOff() { switches.forEach(sw => { sw.on = false; sw.lamps.forEach(l => { l.userData.swOff = true; l.intensity = 0; }); }); lamps.forEach(l => { l.userData.swOff = true; l.intensity = 0; });
      [MAIN, ANX].forEach(b => { const m = b.mats && b.mats.lamp; if (m) m.emissiveIntensity = 0; }); },
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
  // 이름(라벨)으로 알맞은 방 종류 — 예전 x 비율만 보고 고르면 '교장 책상 서랍'이 2학년 교실, '피아노'가 3학년 교실로 가던 것
  const LABEL_ROOM = [[/교장/, 'principal'], [/카드함|대출|서가|도서/, 'library'], [/피아노|악보|음악/, 'music'], [/이젤|그림|미술|물감/, 'art'], [/약품|시약|실험/, 'science'],
    [/보건|구급|양호/, 'nurse'], [/복사|수화기|전화|단말기|교무|출석부/, 'staff'], [/투표함|상담/, 'counsel'], [/청소도구/, 'storage'], [/가정|조리|재봉/, 'home'], [/컴퓨터|모니터 켜기/, 'computer']];
  const roomForLabel = label => { const m = LABEL_ROOM.find(([re]) => re.test(label || '')); return m ? m[1] : null; };
  const pickRoom = (oldF, oldX, prefer) => {
    const [b, f] = OLDMAP[oldF]; let rs = roomsOf(b, f); if (!rs.length) return null;
    if (prefer && !rs.some(r => r.type === prefer)) {   // 이 층에 없으면 가까운 층 · 다른 건물에서 그 방을 찾는다
      for (const [bb, ff] of [[b, f + 1], [b, f - 1], [b, f + 2], [b, f - 2], [b, f + 3], [b, f - 3], [b, f + 4], [b, f - 4], ...[0, 1, 2, 3, 4].map(k => [b === MAIN ? ANX : MAIN, k])]) {
        if (!bb || ff < 0) continue; const pr = roomsOf(bb, ff).filter(r => r.type === prefer); if (pr.length) return { b: bb, f: ff, room: pr[(Math.abs(Math.round(oldX)) + pr.length) % pr.length] }; } }
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
  const objsOf = p => {   // 소품의 3D 부품 (중첩된 anim.g 포함 · 부모-자식 중복 제거)
    const out = new Set(); for (const k of Object.keys(p)) { const o = p[k]; if (o && o.isObject3D && k !== 'parent') out.add(o); }
    for (const k of ['g', 'mesh', 'grp']) { const o = p.anim && p.anim[k]; if (o && o.isObject3D) out.add(o); }
    const L = [...out], inside = (o, q) => { for (let a = o.parent; a; a = a.parent) if (a === q) return true; return false; };
    return L.filter(o => !L.some(q => q !== o && inside(o, q)));
  };
  R.relocate = ({ world, floors: FL_, stairSpawnB1 }) => {
    R._relocWorld = world;
    let moved = 0, dropped = 0;
    for (const it of world.items) {
      if (it._rb || !isOld(it.floor, it.pos.x, it.pos.z)) continue; it._rb = true; it._old = { f: it.floor, x: it.pos.x, z: it.pos.z };
      if (it.floor === 2 && inBC(it.pos.x, it.pos.z)) { let [x, z] = bcSpot(it.kind), oy = it.pos.y - BC.y0; if (oy > .3 && bcTop < BC_TOP.length) { const t = BC_TOP[bcTop++]; x = t[0]; z = t[1]; if (it.baseY != null) it.baseY += t[2] + .02 - oy; oy = t[2] + .02; } else if (oy > .3) { if (it.baseY != null) it.baseY -= oy - .03; oy = .03; } it.floor = 0; it.rbY = BCY; it.pos.set(x, BCY + oy, z); if (it.baseY != null) it.baseY = BCY + it.baseY - BC.y0; if (it.mesh) moveObj(it.mesh, x, BCY + oy, z); moved++; continue; }
      const sk = it.kind === 'key' ? SPECIAL_KEY[it.idx] : null;
      const byNm = it.kind === 'wire' ? (() => { const r = roomsOf(ANX, 0).find(q => /가정실/.test(q.label || q.name || '')); return r ? { b: ANX, f: 0, room: r } : null; })() : it.kind === 'camcorder' ? (() => { const r = roomsOf(MAIN, 0).find(q => /1학년 1반|(^|\D)1-1(\D|$)/.test(q.label || q.name || '')); return r ? { b: MAIN, f: 0, room: r } : null; })() : null;   // 민아의 캠코더는 이야기대로 1-1 교실
      const tgt = byNm || (sk ? (() => { const rs = roomsOf(sk[0], sk[1]).filter(r => r.type === sk[2]); return rs.length ? { b: sk[0], f: sk[1], room: rs[0] } : pickRoom(it.floor, it.pos.x); })() : pickRoom(it.floor, it.pos.x));
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
      const tgt = pickRoom(p.floor, p.x, roomForLabel(p.label)); if (!tgt) { p.floor = park(p.floor); dropped++; continue; }
      const small = ['tape', 'clue', 'pick', 'case5', 'phone'].includes(p.kind);   // 탁자 위에 놓이는 작은 소품: 증언 녹음기 · 쪽지/단서 · 줍는 물건 · 녹음기 · 전화
      const su = small && tgt.room ? surfaceIn(tgt.b, tgt.room, tgt.f) : null, s = su || spotAny(tgt.b, tgt.room, tgt.f);
      let oy = Math.max(.05, p.y ?? 1), base = s.h;
      if (su) { base = su.top; oy = su.top - su.h + .08; }
      { const oldY0 = FL_[p.floor]?.y0 || 0, dx = s.x - p.x, dz = s.z - p.z;   // 부품(몸체 · 문 · 녹음기 모형)의 상대 위치를 지키며 함께 옮긴다 — 예전엔 조사 지점만 오고 모형은 숨긴 옛 층에 남았다
        for (const o of objsOf(p)) { const w = o.getWorldPosition(new THREE.Vector3()); group.attach(o); o.position.set(w.x + dx, s.h + (su ? Math.max(0, su.top - s.h - .74) : 0) + (w.y - oldY0), w.z + dz); o.visible = true; }
        if (p.kind === 'safe' && p.key && p.key.pos) { const kx = s.x - .9, ky = s.h + .38, kz = s.z; p.key.pos.set(kx, ky, kz); if (p.key.baseY != null) p.key.baseY = ky; p.key.floor = 0; p.key.rbY = s.h; p.key._rb = true; if (p.key.mesh) { group.attach(p.key.mesh); p.key.mesh.position.set(kx, ky, kz); } } }   // 금고 속 열쇠도 금고 안으로
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
      for (let i = world.props.length - 1; i >= 0; i--) { const q = world.props[i]; if (q.floor !== 3) continue; if (q.kind === 'roofDoor') { world.props.splice(i, 1); continue; } q.floor = 0; q.rbY = top; q.z = zIn(q.z); q._rb = true;
        if (q.mesh && q.mesh.isObject3D && q.mesh.parent === RF.interior) { const wy = q.mesh.getWorldPosition(new THREE.Vector3()).y; moveObj(q.mesh, q.x, top + Math.max(.03, wy - RF.y0), q.z); } }   // 물건 모델도 함께 (조사 지점만 옮겨지고 명찰은 숨겨진 예전 옥상에 남아 줍지 못했다)
      for (const it of world.items) { if (it.floor !== 3) continue; const nz = zIn(it.pos.z), wy = it.mesh ? it.mesh.getWorldPosition(new THREE.Vector3()).y : top + .1; it.floor = 0; it.rbY = top; it.pos.z = nz; if (it.mesh) moveObj(it.mesh, it.pos.x, wy, nz); it._rb = true; }
      // 발전기 울타리 구역 · 안테나 묶음(5구역 패치가 예전 옥상에 붙인 것)은 통째로 새 옥상에 — 안테나 쪽(북쪽 밖)만 안으로 당긴다
      for (const c of [...RF.interior.children]) { if (!c.isGroup) continue; const bx = new THREE.Box3().setFromObject(c); if (bx.isEmpty() || bx.min.x < 14 || bx.max.x > 24) continue;
        group.attach(c); c.traverse(o => { if (o !== c && o.parent === c && o.position.z < MAIN.layout.zN + .8) o.position.z += 4.8; }); c.userData.rbRoof = true; }
      R.roofCol = () => RF.col.filter(r => r.x1 > 14 && r.x2 < 24).map(r => r.z1 < MAIN.layout.zN + .8 ? { ...r, z1: r.z1 + 4.8, z2: r.z2 + 4.8, ref: r } : r);
    }
    return { moved, dropped };
  };
  // ── 3단계: 이름에 방이 적힌 조사 지점(예: '2-4 교실 냉난방기', '교사휴게실 자판기')이 엉뚱한 방에 들어가 있으면 그 방으로 옮긴다 ──
  //   예전 방 비율로 옮기다 보니 '2-4 교실 …' 이 회의실에, '교사휴게실 …' 이 교실에 남던 것. 새 건물에 없는 방은 성격이 가까운 방으로.
  const ROOM_ALIAS = { '교사휴게실': '교무실 · 행정실', '휴게실': '교무실 · 행정실', '교무실': '교무실 · 행정실', '행정실': '교무실 · 행정실', '주조정실': '방송실', '방송편집실': '방송실', '방송실 장비실': '방송실',
    '요리실': '가정실', '조리실': '가정실', '공구실': '과학실', '과학준비실': '과학실', '과학 준비실': '과학실', '언어실': '컴퓨터실', '스마트교실': '컴퓨터실', '전산실': '컴퓨터실', '양호실': '보건실', '보건실보조': '보건실', '도서관': '도서실', '독서실': '자율학습실', '학생회실': '회의실', '세척실': '과학실', '어학실': '컴퓨터실' };
  const allRooms = () => [MAIN, ANX].flatMap(b => (b.props || []).filter(p => p.kind === 'room' && !p.exit && p.x2 - p.x1 > 2.5).map(r => ({ b, r, name: r.label || r.name || '' })));
  const refOf = label => { const L = (label || '').replace(/^\[E\]\s*/, '');
    let m = L.match(/^(\d)-(\d)(?!\d)/) || L.match(/^(\d)학년\s?(\d)반/); if (m) return { tok: m[0], name: `${m[1]}학년 ${m[2]}반` };
    const names = [...new Set(allRooms().map(q => q.name))], al = Object.keys(ROOM_ALIAS).sort((a, b) => b.length - a.length);
    for (const a of al) if (L.startsWith(a)) return { tok: a, name: ROOM_ALIAS[a] };
    for (const n of names.sort((a, b) => b.length - a.length)) if (n.length >= 2 && L.startsWith(n)) return { tok: n, name: n };
    return null; };
  // 녹음기(증언 테이프): 화자 · 제목으로 알맞은 방 — 반장 녹음은 그 반, 교사는 자기 교과실
  const TAPE_ROOM = [[/(\d)학년 (\d)반 반장/, m => `${m[1]}학년 ${m[2]}반`], [/3-2 담임/, () => '3학년 2반'], [/상담교사/, () => '상담실'], [/보건교사|구급대/, () => '보건실'],
    [/음악교사/, () => '음악실'], [/미술교사/, () => '미술실'], [/과학부장/, () => '과학실'], [/사서|서다은/, () => '도서실'], [/교감/, () => '교무실 · 행정실'], [/어머니/, () => '상담실']];
  // 서브 퀘스트 조사 지점 → 이야기 속 방 (새 건물 이름): 학생회실 → 회의실, 기록 보관실 → 창고, 디지털실습실 → 컴퓨터실
  const SQ_ROOM = { 'attend:0': '1학년 1반', 'trio:0': '3학년 5반', 'trio:1': '음악실', 'nurse:0': '보건실', 'prank:0': '회의실', 'prank:1': '창고', 'prank:2': '3학년 4반', 'mina:0': '컴퓨터실', 'mina:1': '2학년 5반', 'book:0': '3학년 3반', 'book:1': '도서실', 'head:3': '컴퓨터실', 'head:4': '자율학습실' };
  const MSPOT_ROOM = [[/드럼|실로폰/, '음악실'], [/영사기/, '회의실'], [/고장 난 PC/, '컴퓨터실'], [/이젤/, '미술실']];
  const sqRef = p => { if (p.kind === 'mspot') { const r = MSPOT_ROOM.find(([re]) => re.test(p.label || '')); if (r) return { tok: '', name: r[1] }; } if (p.kind === 'ganx' && p.k === 'box' && p.key === 'main') return { tok: '', name: '교무실 · 행정실' }; const m = /^sq:(.+)$/.exec(p.uid || ''); return m && SQ_ROOM[m[1]] ? { tok: '', name: SQ_ROOM[m[1]] } : null; };
  const tapeRef = p => { const sq = sqRef(p); if (sq) return sq; if (p.kind !== 'tape') return null; const t = `${p.title || ''} ${p.spk || ''}`; for (const [re, f] of TAPE_ROOM) { const m = t.match(re); if (m) return { tok: '', name: f(m) }; } return null; };
  R.fixRoomRefs = world => {
    const W = world, rooms = allRooms(); let moved = 0, relabeled = 0, dup = 0;
    for (const p of W.props) {
      if (p._rf || p.floor !== 0 || !p.label || !/[가-힣]/.test(p.label)) continue; p._rf = true;
      const y = p.rbY ?? 0, cur = R.roomAt(p.x, p.z, y + .1); if (!cur) continue;
      const ref = tapeRef(p) || refOf(p.label); if (!ref) continue;
      const curName = cur.name || cur.label || ''; if (curName === ref.name) { if (ref.tok && ref.tok !== ref.name && !/^\d/.test(ref.tok)) { p.label = p.label.replace(ref.tok, ref.name); relabeled++; } continue; }
      const cands = rooms.filter(q => q.name === ref.name); if (!cands.length) continue;
      const curF = Math.round(y / FH), t = cands.sort((a, b) => Math.abs(a.r.floor - curF) - Math.abs(b.r.floor - curF))[0];
      if (/의자에 앉기/.test(p.label)) { p.label = p.label.replace(ref.tok + ' 교실', curName).replace(ref.tok, curName); relabeled++; continue; }   // 앉는 자리는 그 방 의자에 붙어 있다: 이름만 지금 방으로
      const small = ['tape', 'clue', 'pick', 'case5', 'phone', 'note'].includes(p.kind), su = small ? surfaceIn(t.b, t.r, t.r.floor) : null, sp = su || spotIn(t.b, t.r, t.r.floor, true);   // 그 방 안에서만 (꽉 차도 다른 방으로 넘기지 않는다)
      let sp_ = sp; if (sp_ && W.props.some(q => q !== p && q.floor === 0 && Math.abs((q.rbY ?? 0) - sp_.h) < 1 && Math.hypot(q.x - sp_.x, q.z - sp_.z) < .7)) sp_ = null;   // 다른 조사 지점과 포개지는 자리는 버린다
      const story = p.mega || p.main || p.q || /명찰|테이프|증거|열쇠|쪽지|기록부|녹음/.test(p.label);
      if (!sp_ && !story) { for (const o of objsOf(p)) o.visible = false; p._drop = true; continue; }   // 자리가 없는 옛 방 장식은 방 한가운데 겹쳐 두지 않고 걷는다
      const sp2 = sp_ || (() => {   // 방이 가구로 꽉 차도 이야기 물건끼리 한 점에 포개지지 않게: 가운데 둘레를 돌며 빈 자리
        const h = t.r.floor * FH, busy = (x, z) => W.props.some(q => q !== p && q.floor === 0 && Math.abs((q.rbY ?? 0) - h) < 1 && Math.hypot(q.x - x, q.z - z) < .7);
        const mx = (t.r.x1 + t.r.x2) / 2, mz = (t.r.z1 + t.r.z2) / 2;
        for (let rr = 0; rr < 3.2; rr += .45) for (let a = 0; a < 12; a++) { const lx = mx + Math.cos(a / 12 * 6.283) * rr, lz = mz + Math.sin(a / 12 * 6.283) * rr; if (lx < t.r.x1 + .4 || lx > t.r.x2 - .4 || lz < t.r.z1 + .4 || lz > t.r.z2 - .4) continue;
          const [x, z] = t.b.toWorld(lx, lz); if (!busy(x, z)) return { x, z, h }; }
        return spotIn(t.b, t.r, t.r.floor); })();
      used.push({ x: sp2.x, z: sp2.z, h: sp2.h }); p._rfT = t;
      const dx = sp2.x - p.x, dz = sp2.z - p.z, dy = sp2.h - y;
      for (const o of objsOf(p)) { const w = o.getWorldPosition(new THREE.Vector3()); group.attach(o); o.position.set(w.x + dx, w.y + dy, w.z + dz); o.visible = true; }
      p.x = sp2.x; p.z = sp2.z; p.rbY = sp2.h; if (p.px != null) { p.px += dx; p.pz += dz; }
      if (ref.tok && ref.tok !== ref.name && !/^\d/.test(ref.tok)) p.label = p.label.replace(ref.tok, ref.name);
      moved++;
    }
    // 같은 방에 같은 이름의 조사 지점이 여러 개(예전 같은 종류 방 여러 칸에서 모여든 것) → 하나만 남기고 걷는다
    // 마지막 정리: 옮긴 것끼리 0.5m 안에 포개졌으면 뒤의 것을 방 안 빈자리로 밀어 낸다
    for (const p of W.props) { if (!p._rfT || p._drop) continue; const h = p.rbY ?? 0, near = () => W.props.some(q => q !== p && !q._drop && q.floor === 0 && Math.abs((q.rbY ?? 0) - h) < 1 && Math.hypot(q.x - p.x, q.z - p.z) < .5); if (!near()) continue;
      const t = p._rfT, mx = (t.r.x1 + t.r.x2) / 2, mz = (t.r.z1 + t.r.z2) / 2; let done = false;
      for (let rr = .5; rr < 3.5 && !done; rr += .45) for (let a = 0; a < 12 && !done; a++) { const lx = mx + Math.cos(a / 12 * 6.283) * rr, lz = mz + Math.sin(a / 12 * 6.283) * rr; if (lx < t.r.x1 + .4 || lx > t.r.x2 - .4 || lz < t.r.z1 + .4 || lz > t.r.z2 - .4) continue;
        const [x, z] = t.b.toWorld(lx, lz); if (W.props.some(q => q !== p && !q._drop && q.floor === 0 && Math.abs((q.rbY ?? 0) - h) < 1 && Math.hypot(q.x - x, q.z - z) < .7)) continue;
        const dx = x - p.x, dz = z - p.z; for (const k of Object.keys(p)) { const o = p[k]; if (o && o.isObject3D && k !== 'parent') { o.position.x += dx; o.position.z += dz; } } p.x = x; p.z = z; if (p.px != null) { p.px += dx; p.pz += dz; } done = true; } }
    // 옛 건물에서 옮겨 온 물건 중 새 방에 어울리지 않는 것: 세면대 · 수도꼭지는 물 쓰는 방에만, 옛 형광등 스위치는 새 건물 스위치가 있으니 걷는다
    for (const p of W.props) { if (!p._old || p._drop || p.floor !== 0 || !p.label) continue; const rm = R.roomAt(p.x, p.z, (p.rbY ?? 0) + .1), rn = rm ? (rm.name || rm.label || '') : '';
      const junk = p.kind === 'fz' && /홀 전시 작품|할로겐 투광기|사진부 암실|스팀 밸브|방화문 닫고/.test(p.label);   // 새 건물에 없는 옛 홀 · 암실 · 연결복도 장치
      if (junk) { for (const o of objsOf(p)) o.visible = false; p._drop = true; continue; }
      const wet = /수도꼭지|세면대|싱크|개수대/.test(p.label) && !/화장실|과학실|가정실|미술실|보건실/.test(rn), oldSw = p.kind !== 'switch' && /스위치/.test(p.label) && /형광등|전등|조명/.test(p.label);
      if (wet || oldSw) { for (const o of objsOf(p)) o.visible = false; p._drop = true; } }
    for (let i = W.props.length - 1; i >= 0; i--) if (W.props[i]._drop) { W.props.splice(i, 1); dup++; }
    const seen = new Map();
    for (let i = 0; i < W.props.length; i++) { const p = W.props[i]; if (p.floor !== 0 || !p._rf || !p.label || !['fz', 'robj'].includes(p.kind) || p.mega || p.main || p.q || /의자에 앉기|스위치|문 열기|문 닫기|명찰|테이프|증거|열쇠|쪽지|기록부/.test(p.label)) continue;   // 미션 · 수집품은 건드리지 않는다
      const rm = R.roomAt(p.x, p.z, (p.rbY ?? 0) + .1); if (!rm) continue; const key = (rm.id || rm.name) + '|' + p.label.replace(/\s*\(.*$/, '');
      if (!seen.has(key)) { seen.set(key, p); continue; }
      for (const o of objsOf(p)) o.visible = false;
      W.props.splice(i--, 1); dup++; }
    return { moved, relabeled, dup };
  };
  // ── 4단계: 이름만 있고 실물과 따로 놀던 공용 조사 지점을 새 건물의 실제 물건에 다시 잇는다 ──
  //   사물함 파밍(복도 · 별관 · 교실) → 교실 뒤 사물함 벽 앞 · 비상벨 → 복도 화재 발신기 · 배전반 → 복도 외벽 · 감정 카드 → 상담실
  const VIS = { body: new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: .5, metalness: .3 }), reel: new THREE.MeshStandardMaterial({ color: 0xc8c8c0, roughness: .4, metalness: .6 }), led: new THREE.MeshBasicMaterial({ color: 0xff3020 }),
    panel: new THREE.MeshStandardMaterial({ color: 0x9aa6a0, roughness: .6, metalness: .4 }), warn: new THREE.MeshBasicMaterial({ color: 0xf0c020 }), red: new THREE.MeshStandardMaterial({ color: 0xc8241c, roughness: .5 }), btn: new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: .4 }) };
  // ── 5단계: 옮긴 물건을 바로 아래 받침(책상 · 선반 · 바닥) 위에 내려놓는다 ──
  //   예전 자리의 높이(벽 · 높은 선반)를 그대로 가지고 와 새 방 한가운데 허공에 떠 있던 것. 벽에 거는 것(비상벨 · 배전반 · 게시물)은 그대로
  R.settleMoved = world => {
    const W = world, bx = new THREE.Box3(); let n = 0;
    const supportAt = (x, z, below) => { let best = null; for (const B of [MAIN, ANX]) { const [lx, lz] = B.toLocal(x, z); if (!B.layout || lx < -B.layout.L / 2 - .3 || lx > B.layout.L / 2 + .3 || lz < B.layout.zN - .3 || lz > B.layout.zS + .3) continue;
        const f = Math.max(0, Math.floor((below + .05) / FH)); best = f * FH;
        for (const c of B.col) { if (c.y2 == null || c.y2 > below + .06 || c.y2 < best || c.y2 - (c.y1 ?? 0) > 2.4) continue; if (lx > c.x1 + .02 && lx < c.x2 - .02 && lz > c.z1 + .02 && lz < c.z2 - .02) best = c.y2; } } return best; };
    R._sup = supportAt;
    const WALL = /게시|액자|공지|시계|포스터|명패|달력|스위치|비상벨|배전반|분전반|거울|칠판|현판|안내/;
    const settle = (objs, label, onDy) => { if (!objs.length) return; bx.makeEmpty(); for (const o of objs) bx.expandByObject(o); if (bx.isEmpty()) return;
      if (WALL.test(label || '')) { const fl = Math.max(0, Math.floor((bx.min.y + .05) / FH)) * FH, h = bx.min.y - fl; if (h > .7 && h < 2.2) return; }   // 벽에 걸린 높이(0.7~2.2m)면 그대로, 천장 · 바닥 아래로 빠진 것만 바로잡는다
      const s = bx.getSize(new THREE.Vector3()); if (s.y > 2.2 || Math.max(s.x, s.z) > 3) return; const c = bx.getCenter(new THREE.Vector3()), sup = supportAt(c.x, c.z, bx.min.y); if (sup == null) return;
      const dy = sup - bx.min.y; if (Math.abs(dy) < .03) return; for (const o of objs) o.position.y += dy; onDy && onDy(dy); n++; };
    for (const p of W.props) { if ((p.rbY == null && !R.inBuilding(p.x, p.z)) || p.floor !== 0 || p.kind === 'bell' || p.kind === 'cbreaker' || p.visMesh || p.hang) continue;
      settle(objsOf(p), p.label, dy => { if (p.y != null) p.y = Math.max(.15, p.y + dy); }); }
    for (const it of W.items) { if ((it.rbY == null && !R.inBuilding(it.pos.x, it.pos.z)) || it.taken || it.floor !== 0 || !it.mesh || it.locked) continue;
      settle([it.mesh], it.label || it.kind, dy => { it.pos.y += dy; if (it.baseY != null) it.baseY += dy; }); }
    return { n };
  };
  R.relinkGeneric = world => {
    const W = world; let n = 0, drop = 0;
    const lay = (b, f) => (b.props || []).filter(q => q.kind === 'room' && q.floor === f);
    const classes = [MAIN, ANX].flatMap(b => (b.props || []).filter(q => q.kind === 'room' && q.type === 'class').map(r => ({ b, r })));
    const lockerSpots = classes.flatMap(({ b, r }) => [.3, .55, .8].map(t => { const lz = r.z1 + .3 + (r.z2 - r.z1 - .6) * t, [x, z] = b.toWorld(r.x2 - .95, lz), [fx, fz] = b.toWorld(r.x2, lz); return { x, z, h: r.floor * FH, face: [fx, fz], room: r.label }; }));
    const alarmSpots = [MAIN, ANX].flatMap(b => { const zN = b.layout.zN; return [...Array(b.spec.floors).keys()].flatMap(f => lay(b, f).filter(q => q.type === 'class').filter((_, i) => i % 2 === 0).map(r => { const [x, z] = b.toWorld(r.x2 + .75, zN + .6); return { x, z, h: f * FH }; })); });
    const panelSpots = [MAIN, ANX].flatMap(b => { const zN = b.layout.zN; return [...Array(b.spec.floors).keys()].flatMap(f => lay(b, f).filter(q => q.type === 'class').filter((_, i) => i % 2 === 1).map(r => { const [x, z] = b.toWorld(r.x1 + .9, zN + .6); return { x, z, h: f * FH }; })); });
    const take = (list, p) => { if (!list.length) return null; const y = p.rbY ?? 0; list.sort((a, c) => (Math.abs(a.h - y) * 10 + Math.hypot(a.x - p.x, a.z - p.z)) - (Math.abs(c.h - y) * 10 + Math.hypot(c.x - p.x, c.z - p.z))); return list.shift(); };
    const put = (p, s, y) => { const dx = s.x - p.x, dz = s.z - p.z, dy = s.h - (p.rbY ?? 0); for (const o of objsOf(p)) { const w = o.getWorldPosition(new THREE.Vector3()); group.attach(o); o.position.set(w.x + dx, w.y + dy, w.z + dz); }
      p.x = s.x; p.z = s.z; p.rbY = s.h; if (y != null) p.y = y; if (p.px != null) { p.px += dx; p.pz += dz; } p._relink = true; n++; };
    const kill = p => { for (const o of objsOf(p)) o.visible = false; p._drop = true; drop++; };
    const inNew = p => p.floor === 0 && p.rbY != null && R.inBuilding(p.x, p.z);
    for (const p of W.props) { if (p._relink || !inNew(p)) continue; const L = p.label || '';
      if (p.kind === 'search' && /사물함 파밍/.test(L) && !/탈의실|샤워실|사감|기숙사/.test(L)) { const s = take(lockerSpots, p); if (s) { put(p, s, 1.0); p.label = '교실 사물함 파밍하기'; } else kill(p); }
      else if (p.kind === 'bell') { const s = take(alarmSpots, p); if (s) put(p, s, 1.45); }
      else if (p.kind === 'cbreaker') { const s = take(panelSpots, p); if (s) put(p, s, 1.4); }
      else if (/감정 카드/.test(L)) { const r = classes.length && [MAIN, ANX].flatMap(b => (b.props || []).filter(q => q.kind === 'room' && /상담실/.test(q.label || '')).map(r => ({ b, r }))); const t = r && r.sort((a, c) => Math.abs(a.r.floor * FH - (p.rbY ?? 0)) - Math.abs(c.r.floor * FH - (p.rbY ?? 0)))[0];
        if (t && !t.r._card) { t.r._card = true; const s = spotIn(t.b, t.r, t.r.floor, true) || spotIn(t.b, t.r, t.r.floor); put(p, s, .9); }
        else if (r && r.length > 1 && !r[1].r._card) { const u = r.find(q => !q.r._card); u.r._card = true; put(p, spotIn(u.b, u.r, u.r.floor, true) || spotIn(u.b, u.r, u.r.floor), .9); }
        else kill(p); } }   // 상담실마다 하나 — 남는 감정 카드는 걷는다
    for (let i = W.props.length - 1; i >= 0; i--) if (W.props[i]._drop) W.props.splice(i, 1);
    // 모형 없는 조사 지점에 모형을 붙인다: 녹음기(반장 · 교사 증언) · 배전반 · 비상벨 — 빈 허공에 [E] 만 뜨던 것
    for (const p of W.props) { if (p._vis || !(inNew(p) || (p.kind === 'tape' && p.floor === 0)) || objsOf(p).length) continue;   // 바깥 증언 녹음기도 모형이 없으면 붙인다
      const mk = p.kind === 'tape' ? 'tape' : p.kind === 'cbreaker' ? 'panel' : p.kind === 'bell' ? 'bell' : null; if (!mk) continue; p._vis = true;
      const g = new THREE.Group(), y = p.rbY ?? 0;
      if (mk === 'tape') { const su = R.groundAt(p.x, p.z, y + 1.3), top = su != null && su - y > .4 && su - y < 1.3 ? su : y; { const bm = new THREE.Mesh(new THREE.BoxGeometry(.26, .08, .15), VIS.body); bm.position.y = .04; g.add(bm); }
        for (const sx of [-.055, .055]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .012, 14), VIS.reel); r.position.set(sx, .085, -.01); g.add(r); }
        const led = new THREE.Mesh(new THREE.BoxGeometry(.012, .008, .012), VIS.led); led.position.set(.1, .084, .05); g.add(led); g.position.set(p.x, top + .005, p.z); g.rotation.y = (p.x * 7 + p.z * 3) % 6.28; }
      else if (mk === 'panel') { g.add(new THREE.Mesh(new THREE.BoxGeometry(.5, .7, .12), VIS.panel)); const lab = new THREE.Mesh(new THREE.BoxGeometry(.18, .06, .01), VIS.warn); lab.position.set(0, .26, .065); g.add(lab); g.position.set(p.x, y + 1.4, p.z); }
      else { const bx = new THREE.Mesh(new THREE.BoxGeometry(.22, .3, .08), VIS.red); g.add(bx); const btn = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .03, 16), VIS.btn); btn.rotation.x = Math.PI / 2; btn.position.set(0, -.03, .05); g.add(btn); g.position.set(p.x, y + 1.45, p.z); }
      if (mk !== 'tape') { let best = null, bd = 9; for (const B of [MAIN, ANX]) { const [lx, lz] = B.toLocal(p.x, p.z); if (Math.abs(lz - B.layout.zN) < bd) { bd = Math.abs(lz - B.layout.zN); best = B; } }   // 복도 외벽에 붙여 단다 (벽을 등지게)
        if (best) { const [lx] = best.toLocal(p.x, p.z), [wx, wz] = best.toWorld(lx, best.layout.zN + .07), [ox, oz] = best.toWorld(lx, best.layout.zN + 1); g.position.x = wx; g.position.z = wz; g.rotation.y = Math.atan2(ox - wx, oz - wz); } }
      group.add(g); p.visMesh = g; }
    return { n, drop };
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
    restylePassage(O);   // 디자인 정리: 거친 콘크리트(동굴처럼 보이던) 벽 · 바닥 · 천장 → 학교 복도 마감
    WK.root.visible = false;   // 겹치는 새 통로 겉모습은 숨기고 (바닥 · 충돌은 그대로) 구름다리 실내를 쓴다
    R.gate = { z: R.passToNew(0, doorZ)[1], x1: BRX - 2, x2: BRX + 2, closed: () => false };
  };
  // 구름다리 실내 마감: 벽 = 흰 도장 + 녹색 걸레받이 벽(1.2m), 바닥 = 테라조 타일, 천장 = 600각 텍스 · 2등용 형광등 (본관 복도와 같은 말씨)
  function restylePassage(O) {
    if (O.userData.restyled) return; O.userData.restyled = true; O.updateMatrixWorld(true);
    const tx = (w, h, draw, rx, ry) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; };
    const bb = new THREE.Box3(), v = new THREE.Vector3(), all = new THREE.Box3().setFromObject(O), y0 = FHB;
    const mPaint = new THREE.MeshStandardMaterial({ color: 0xe9e5da, roughness: .88 }), mWain = new THREE.MeshStandardMaterial({ color: 0x3e6a56, roughness: .6 });
    const terr = (L) => new THREE.MeshStandardMaterial({ roughness: .45, map: tx(256, 256, (g, w, h) => { g.fillStyle = '#9a9b94'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1400; i++) { const c = 120 + Math.random() * 110 | 0; g.fillStyle = `rgb(${c},${c - 4},${c - 10})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 2, 2 + Math.random() * 2); } g.strokeStyle = '#6e6f6a'; g.lineWidth = 2; g.strokeRect(0, 0, w, h); }, 1, Math.max(1, L / .6)) });
    const ceil = (L) => new THREE.MeshStandardMaterial({ roughness: .9, map: tx(128, 128, (g, w, h) => { g.fillStyle = '#e4e2dc'; g.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(120,118,110,.25)'; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } g.strokeStyle = '#b9b7ae'; g.lineWidth = 3; g.strokeRect(0, 0, w, h); }, 5, Math.max(1, L / .6)) });
    const walls = [];
    O.traverse(o => { if (!o.isMesh || o.isInstancedMesh || o.userData.keepMat) return; const m = [].concat(o.material)[0]; if (!m || !m.isMeshStandardMaterial || m.name === 'passGlass') return;
      bb.setFromObject(o); const s = bb.getSize(v); const len = Math.max(s.x, s.z);
      if (len < 6) return;   // 소품 · 문 · 의자는 그대로
      if (s.y > 2 && Math.min(s.x, s.z) < .35) { o.material = mPaint; walls.push(bb.clone()); }   // 긴 벽
      else if (s.y < .35 && bb.max.y < y0 + .4) o.material = terr(len);   // 바닥
      else if (s.y < .35 && bb.min.y > y0 + 2.2) o.material = ceil(len);   // 천장
      else if (s.y <= 2 && s.y > .5 && Math.min(s.x, s.z) < .35 && bb.max.y < y0 + 1.6) o.material = mWain; });
    // 녹색 걸레받이 벽: 벽마다 안쪽 면에 1.2m (예전엔 한쪽 벽에만 있었다)
    const cx = (all.min.x + all.max.x) / 2;
    const sides = new Map(); for (const w of walls) { if (w.max.y - w.min.y < 2) continue; const k = (w.min.x + w.max.x) / 2 < cx ? 'L' : 'R', e = sides.get(k); if (!e) sides.set(k, w.clone()); else e.union(w); }   // 벽 조각이 여러 개라도 한쪽에 한 줄
    for (const w of sides.values()) { const inner = (w.min.x + w.max.x) / 2 < cx ? w.max.x + .006 : w.min.x - .006, sgn = inner > cx ? -1 : 1;
      const g = new THREE.BoxGeometry(.012, 1.2, w.max.z - w.min.z), m = new THREE.Mesh(g, mWain); m.position.set(inner + sgn * .006, y0 + .62, (w.min.z + w.max.z) / 2); group.add(m); }
  }
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
  // 리모델링(사진 기준): 승강장 문 = 헤어라인 스테인리스 + 곡선 띠 · 아래쪽 가로줄 무늬 · 주의 스티커, 칸 안 = 오렌지 목재 타공 패널 · 스테인리스 기둥 · 3면 핸드레일 · 투톤 바닥
  const cvTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const hairline = (g, w, h, base = 168) => { for (let y = 0; y < h; y++) { const v = base + (Math.random() * 26 - 13); g.fillStyle = `rgb(${v},${v + 3},${v + 6})`; g.fillRect(0, y, w, 1); } };
  const leafTex = side => cvTex(256, 896, (g, w, h) => { hairline(g, w, h, 172);
    g.save(); g.globalAlpha = .55; g.fillStyle = '#e8eef2'; g.beginPath(); const x0 = side < 0 ? w * .05 : w * .95;   // 곡선 띠 (가운데로 휘어 드는 밝은 띠)
    g.moveTo(x0, h * .2); g.quadraticCurveTo(w * .5, h * .45, side < 0 ? w * .98 : w * .02, h * .52); g.lineTo(side < 0 ? w * .98 : w * .02, h * .58); g.quadraticCurveTo(w * .45, h * .5, x0, h * .3); g.fill(); g.restore();
    g.fillStyle = 'rgba(70,76,82,.55)'; for (let y = h * .56; y < h * .98; y += 14) { const inset = Math.max(0, (h * .78 - y) * .25); g.fillRect(side < 0 ? inset : 0, y, w - inset, 6); }   // 아래쪽 가로줄 무늬
    const stk = (x, y, c1, c2) => { g.fillStyle = c1; g.fillRect(x, y, 34, 40); g.fillStyle = c2; g.beginPath(); g.moveTo(x + 17, y + 6); g.lineTo(x + 30, y + 32); g.lineTo(x + 4, y + 32); g.fill(); };
    stk(side < 0 ? w - 60 : 26, h * .14, '#2a2e33', '#f2f2f2'); stk(side < 0 ? 26 : w - 60, h * .78, '#f2f2f2', '#f0c020');   // 손 끼임 주의 · 경고 스티커
  });
  const woodTex = cvTex(256, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#c8823e'); gr.addColorStop(.5, '#d99550'); gr.addColorStop(1, '#c47c3a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) { g.fillStyle = `rgba(90,45,10,${.08 + Math.random() * .08})`; g.fillRect(0, y, w, 1); }
    g.fillStyle = 'rgba(60,30,8,.35)'; for (let y = 3; y < h; y += 6) for (let x = (y / 6 % 2) * 3 + 2; x < w; x += 6) g.fillRect(x, y, 1.6, 1.6); });   // 타공(점) 무늬
  const floorTex = cvTex(256, 256, (g, w, h) => { g.fillStyle = '#8c9094'; g.fillRect(0, 0, w, h); g.fillStyle = '#c9ccce'; g.fillRect(w * .28, 0, w * .44, h); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * .12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
  const mSteel = new THREE.MeshStandardMaterial({ map: cvTex(128, 512, (g, w, h) => hairline(g, w, h, 180)), roughness: .28, metalness: .9 });
  const mWood = new THREE.MeshStandardMaterial({ map: woodTex, roughness: .6, metalness: .05 }), mCarFloor = new THREE.MeshStandardMaterial({ map: floorTex, roughness: .35 });
  const mLeafL = new THREE.MeshStandardMaterial({ map: leafTex(-1), roughness: .3, metalness: .85 }), mLeafR = new THREE.MeshStandardMaterial({ map: leafTex(1), roughness: .3, metalness: .85 });
  const mCeilLt = new THREE.MeshBasicMaterial({ color: 0xfffaf0 });
  const ledTex = (t, arrow) => cvTex(160, 48, (g, w, h) => { g.fillStyle = '#0a0606'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff2a1a'; g.shadowColor = '#ff3020'; g.shadowBlur = 8; g.font = 'bold 34px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((arrow ? arrow + ' ' : '') + t, w / 2, h / 2 + 2); });
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
    { const zm2 = (zc1 + zc2) / 2, D = zc2 - zc1;
      box(car, 1.36, .06, 1.7, mCarFloor, EX, .03, zm2);   // 투톤 바닥 (가운데 밝은 띠)
      box(car, 1.36, 2.3, .04, mSteel, EX, 1.18, zc1 + .02); box(car, .04, 2.3, 1.7, mSteel, CAR.x1, 1.18, zm2); box(car, .04, 2.3, 1.7, mSteel, CAR.x2, 1.18, zm2);   // 스테인리스 골조
      box(car, .62, 2.12, .012, mWood, EX, 1.18, zc1 + .046);   // 뒷벽 가운데 목재 패널 (양옆은 스테인리스)
      for (const sx of [-1, 1]) { const xw = sx < 0 ? CAR.x1 + .026 : CAR.x2 - .026; box(car, .012, 2.12, D - .5, mWood, xw, 1.18, zm2 - .1); }   // 옆벽 목재 패널
      box(car, 1.36, .05, 1.7, mFrame, EX, 2.35, zm2); for (const sx of [-1, 1]) box(car, .1, .015, 1.5, mCeilLt, EX + sx * .5, 2.322, zm2);   // 천장 양쪽 조명 띠
      box(car, .36, .015, 1.3, mSteel, EX, 2.322, zm2);
      const rail = (len, x, z, alongZ) => { const g = new THREE.CylinderGeometry(.018, .018, len, 10); g.rotateX(alongZ ? Math.PI / 2 : 0); if (!alongZ) g.rotateZ(Math.PI / 2); const o = new THREE.Mesh(g, mSteel); o.position.set(x, .92, z); car.add(o); };
      rail(1.1, EX, zc1 + .1, false); rail(D - .45, CAR.x1 + .1, zm2 - .12, true); rail(D - .45, CAR.x2 - .1, zm2 - .12, true);   // 3면 핸드레일
      for (const [x, z] of [[EX - .5, zc1 + .1], [EX + .5, zc1 + .1], [CAR.x1 + .1, zc2 - .4], [CAR.x2 - .1, zc2 - .4]]) box(car, .03, .03, .1, mSteel, x, .92, z - (z < zm2 ? .05 : 0));
      // 조작반 (오른쪽 벽 앞쪽): 스테인리스 판 + 층 버튼 + 열림/닫힘
      box(car, .02, .62, .2, mSteel, CAR.x2 - .04, 1.2, zc2 - .32);
      for (let k = 0; k < n; k++) box(car, .012, .045, .045, mBtn, CAR.x2 - .055, 1.0 + k * .08, zc2 - .32);
      for (const dz of [-.05, .05]) box(car, .012, .04, .04, mFrame, CAR.x2 - .055, .92, zc2 - .32 + dz); }
    // 칸 문 (안쪽 미닫이 2짝): 승강장 문과 함께 열리고 닫힌다 — 칸 안에서 문이 없어 승강로 벽이 그대로 보이던 것
    E.carL = box(car, EW, 2.1, .03, mSteel, EX - .3, 1.08, zc2 - .06); E.carR = box(car, EW, 2.1, .03, mSteel, EX + .3, 1.08, zc2 - .06);
    box(car, 1.36, .08, .06, mSteel, EX, 2.17, zc2 - .06);   // 문 위 인방
    const cv = document.createElement('canvas'); cv.width = 96; cv.height = 48; const cx = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(.22, .11), new THREE.MeshBasicMaterial({ map: tex })); disp.position.set(EX, 2.1, zc1 + .05); car.add(disp);
    E.show = t => { if (E.ind && t !== E._lt) { E._lt = t; const m = t.match(/^(\d+)F(.?)/); if (m) { const tx = ledTex(m[1], m[2] === '▲' ? '↑' : m[2] === '▼' ? '↓' : ''); E.ind.forEach(o => { o.material.map && o.material.map.dispose(); o.material.map = tx; o.material.needsUpdate = true; }); } } cx.fillStyle = '#05080c'; cx.fillRect(0, 0, 96, 48); cx.fillStyle = '#ff9a3a'; cx.font = 'bold 28px monospace'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, 48, 26); tex.needsUpdate = true; };
    const lamp = new THREE.PointLight(0xfff4e0, .9, 4, 2); lamp.position.set(EX, 2.1, (zc1 + zc2) / 2); car.add(lamp);
    for (let f = 0; f < n; f++) {
      const y = f * b.spec.FH, lz = b.layout.zN + .06, g = new THREE.Group(); g.position.set(EX, y, lz); b.root.add(g);
      box(g, 1.4, .25, .08, mSteel, 0, 2.27, 0); box(g, .1, 2.15, .08, mSteel, -.65, 1.07, 0); box(g, .1, 2.15, .08, mSteel, .65, 1.07, 0);   // 스테인리스 문틀
      const L = box(g, EW, 2.1, .04, [mSteel, mSteel, mSteel, mSteel, mLeafL, mLeafL], -.3, 1.05, .05), Rr = box(g, EW, 2.1, .04, [mSteel, mSteel, mSteel, mSteel, mLeafR, mLeafR], .3, 1.05, .05);
      box(g, .12, .2, .03, mFrame, .95, 1.15, .02); box(g, .05, .05, .02, mBtn, .95, 1.2, .04); box(g, .05, .05, .02, mBtn, .95, 1.1, .04);
      { const m = new THREE.Mesh(new THREE.PlaneGeometry(.36, .11), new THREE.MeshBasicMaterial({ map: ledTex('1'), toneMapped: false })); m.position.set(0, 2.5, .05); g.add(m); (E.ind ||= []).push(m); }   // 층 표시 (붉은 LED · 칸 위치를 따라 바뀐다)
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
  R.elevGo = (e, nf) => { const E = e.E; if (E.moving || nf < 0 || nf >= E.n) return 'end'; if (Math.abs(E.y - nf * E.b.spec.FH) < .05) { E.doorT = 1; E.wait = 5; return 'here'; } E.target = nf; E.doorT = 0; E.go = true; return 'go'; };   // 칸 안 층 버튼
  R.elevTo = (e, dir) => { const nf = e.f + dir; if (nf < 0 || nf >= e.n) return null; const t = R.elevs.find(q => q.b === e.b && q.f === nf); return { floor: 0, x: t.out.x, z: t.out.z, yaw: t.yaw, sh: t.rbY }; };
  const _ev = new THREE.Vector3();
  R.elevTick = (dt, P, sfx) => {
    for (const E of ELV) {
      const FHb = E.b.spec.FH, ty = E.target * FHb;
      // 문: doorT 쪽으로 (0 닫힘 · 1 열림)
      const h0 = P && P.floor === 0 ? elvAt(P.x, P.z) : null, near = !!(h0 && h0.E === E) || (P && P.floor === 0 && E.car && Math.hypot(P.x - E.car.getWorldPosition(_ev).x, P.z - _ev.z) < 7 && Math.abs((P.sh || 0) - E.y) < 2.5);
      if (E.doorT !== E._lastDT) { if (E._lastDT !== undefined) R.onElev && R.onElev(E.doorT ? 'open' : 'close', E, near); E._lastDT = E.doorT; }   // 문 소리 · 안내 음성
      if (E.door !== E.doorT) E.door += Math.sign(E.doorT - E.door) * Math.min(Math.abs(E.doorT - E.door), dt * 1.4);
      const fNow = Math.round(E.y / FHb);
      E.landing.forEach((l, i) => { const k = i === fNow && !E.moving ? E.door : 0; l.L.position.x = -.3 - k * .58; l.R.position.x = .3 + k * .58; });
      if (E.carL) { const k = E.moving ? 0 : E.door; E.carL.position.x = E.EX - .3 - k * .56; E.carR.position.x = E.EX + .3 + k * .56; }
      const h = P && P.floor === 0 ? elvAt(P.x, P.z) : null, rider = h && h.E === E && h.lz < E.zw && Math.abs((P.sh || 0) - E.y) < 1.3;
      if (E.go && E.door <= .01) { E.go = false; E.moving = Math.abs(ty - E.y) > .01; if (E.moving) { sfx && sfx.elevator && sfx.elevator(Math.abs(ty - E.y) / 1.2); R.onElev && R.onElev(ty > E.y ? 'up' : 'down', E, near); } }
      if (E.moving) { const d = ty - E.y, st = Math.sign(d) * Math.min(Math.abs(d), dt * 1.2 * Math.min(1, .25 + Math.abs(d))); E.y += st; if (rider) P.sh = E.y + .06;
        if (Math.abs(ty - E.y) < .005) { E.y = ty; E.moving = false; E.doorT = 1; E.wait = 5; sfx && sfx.elevatorChime && sfx.elevatorChime(); R.onElev && R.onElev('floor_' + (E.target + 1), E, near); } E.show(`${Math.round(E.y / FHb) + 1}F${E.moving ? (d > 0 ? '▲' : '▼') : ''}`); }
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
    // 지도 디테일: 이 층 가구 윤곽(책상 · 장 · 실험대 등) · 엘리베이터 · 계단 · 비상구 · 현관 아이콘
    const y0 = f * FH, furn = [];
    for (const c of b.col) { if (c.y2 == null) continue; const y1 = c.y1 ?? 0, h = c.y2 - y1, w = c.x2 - c.x1, d = c.z2 - c.z1;
      if (y1 < y0 - .1 || y1 > y0 + .6 || h < .3 || h > 2.4 || w > 4 || d > 4 || w < .15 || d < .15 || (w > 2.6 && d < .25) || (d > 2.6 && w < .25)) continue; furn.push(corners(b, c.x1, c.x2, c.z1, c.z2)); }
    const icons = [];
    b.layout.rooms.filter(r => r.kind === 'stair' || r.kind === 'cstair').forEach(r => { const [x, z] = b.toWorld((r.x1 + r.x2) / 2, r.kind === 'cstair' ? 2.4 : b.layout.zS / 2); icons.push({ x, z, t: 'stair' }); });
    R.elevs.filter(e => e.b === b && e.f === f).forEach(e => icons.push({ x: e.x, z: e.z, t: 'elev' }));
    if (f === 0) { const core = b.layout.rooms.find(r => r.kind === 'core'); if (core) { const [x, z] = b.toWorld((core.x1 + core.x2) / 2, b.layout.zN - .4); icons.push({ x, z, t: 'door', label: '현관' }); }
      if (b === ANX) [-1, 1].forEach(sx => { const [x, z] = b.toWorld(sx * (b.layout.L / 2), b.layout.zN + .95); icons.push({ x, z, t: 'exit' }); }); }
    if (f === 1) { const [x, z] = [BRX, (BRZ1 + BRZ2) / 2]; icons.push({ x, z, t: 'bridge', label: '구름다리' }); }
    return { clear: [OLD_MAIN, OLD_ANNEX], shells, rooms, furn, icons, title: `${b.name} ${f + 1}층`, floors: b.spec.floors };
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
  R.footprints = FOOTPRINTS;
  R.classRooms = [MAIN, ANX].flatMap(b => b.props.filter(r => r.kind === 'room' && /^\d학년 \d+반$/.test(r.label || '')).map(r => { const [cx, cz] = b.toWorld((r.x1 + r.x2) / 2, (r.z1 + r.z2) / 2), [fx, fz] = b.toWorld(r.x1 + 2.6, (r.z1 + r.z2) / 2); return { label: r.label, y0: r.floor * b.spec.FH, cx, cz, fx, fz }; }));   // 교실 (반장 증언 배치용)
  R.extra = []; { const bX = R.blocked; R.blocked = (x, z, y, r) => R.extra.some(c => Math.abs(y - c.y) < .5 && x + r > c.x1 && x - r < c.x2 && z + r > c.z1 && z - r < c.z2) || bX(x, z, y, r); }   // 나중에 놓는 받침 수납장 등   // 새 본관 · 별관 바닥 사각형 (인도 재배치용)
  // 새 본관 · 별관 CCTV: 층마다 복도 양 끝 천장 돔 카메라 (복도를 길게 내려다본다) + 중앙 현관 · 2층 구름다리 — 경비실 실시간 모니터 채널
  R.cctvFeeds = () => {
    if (R._cctv) return R._cctv; const out = [], V = (b, lx, y, lz) => { const [x, z] = b.toWorld(lx, lz); return [x, y, z]; };
    const domeM = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: .15, metalness: .4 }), baseM = new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: .6 }), ledM = new THREE.MeshBasicMaterial({ color: 0xff2a20 });
    const dome = ([x, y, z]) => { const g = new THREE.Group(); g.position.set(x, y + .2, z);   // 천장 부착형 돔 (Ø140): 흰 받침 + 검은 반구 + 빨간 녹화 LED
      const bm = new THREE.Mesh(new THREE.CylinderGeometry(.08, .085, .04, 20), baseM); g.add(bm); const dm = new THREE.Mesh(new THREE.SphereGeometry(.065, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), domeM); dm.position.y = -.02; g.add(dm);
      const l = new THREE.Mesh(new THREE.SphereGeometry(.007, 6, 4), ledM); l.position.set(.07, -.02, 0); g.add(l); group.add(g); };
    const add = (id, label, pos, tgt) => { dome(pos); out.push({ id, label, floor: 0, outdoor: false, position: [pos[0], pos[1] - .1, pos[2]], target: tgt }); };
    for (const b of [MAIN, ANX]) { const L = b.layout.L, zN = b.layout.zN, FH = b.spec.FH, CEIL = b.spec.CEIL || 2.7, zc = zN / 2;
      for (let f = 0; f < b.spec.floors; f++) { const y = f * FH + CEIL - .22;
        for (const sd of [-1, 1]) { const p = V(b, sd * (L / 2 - 1), y, zN + .4); add(`rb_${b.name}_${f}_${sd}`, `${b.name} ${f + 1}F · 복도 ${p[0] < b.toWorld(0, 0)[0] ? '서쪽' : '동쪽'} 끝`, p, V(b, -sd * (L / 2 - 8), f * FH + .9, zc)); } } }
    { const core = MAIN.layout.rooms.find(r => r.kind === 'core'); if (core) add('rb_entrance', '본관 1F · 중앙 현관', V(MAIN, core.x2 - .4, (MAIN.spec.CEIL || 2.7) - .22, MAIN.layout.zS - .6), V(MAIN, core.x1 + .5, .9, MAIN.layout.zN / 2)); }
    add('rb_bridge', '2F · 본관 ↔ 별관 구름다리', [BRX + 1.4, FHB + 2.55, BRZ2 - .6], [BRX, FHB + .9, BRZ1 + 1]);
    return (R._cctv = out);
  };
  // 새 건물로 옮긴 퀘스트 물건 · 쪽지 · 녹음기 모형 바로잡기: ① 숨긴 옛 층에 매달려 안 보이던 모형을 새 건물 쪽으로 옮겨 달고
  //   ② 바닥 아래(한 층 밑 · 땅속)에 묻힌 모형은 그 자리 받침면(책상 · 선반 · 바닥) 위로 올린다
  R.fixVisible = world => {
    const W = world, T = new THREE.Box3(), V = new THREE.Vector3(); let re = 0, up = 0;
    const shown = o => { for (let a = o; a; a = a.parent) { if (!a.visible) return false; if (a.isScene) return true; } return false; };
    const fix = (objs, x, z, rb, onMove, flat) => {
      objs = objs.filter(o => o && o.isObject3D); if (!objs.length) return;
      for (const o of objs) if (o.parent && !shown(o.parent)) { group.attach(o); re++; }   // 퀘스트 단계가 되면 켜지는 모형도 미리 옮겨 단다
      const bb = new THREE.Box3(); for (const o of objs) { T.setFromObject(o); if (!T.isEmpty()) bb.union(T); } if (bb.isEmpty()) return;
      if (flat && bb.max.y < rb + .6 && bb.min.y < rb + .05 && (bb.max.y - bb.min.y < .06 || bb.max.y - bb.min.y < .5)) {   // 바닥에 납작하게 깔린 쪽지 · 사진 · 명찰 → 가까운 책상 · 탁자 위로 (같은 방, 2.5m 안)
        { const c0 = bb.getCenter(V), s1 = R._sup(c0.x, c0.z, rb + 1.25); if (s1 != null && s1 > rb + .5 && s1 < rb + 1.2) { const dy = s1 + .004 - bb.min.y; for (const o of objs) { if (o.parent !== group) group.attach(o); o.position.y += dy; } onMove && onMove(dy); up++; return; } }   // 바로 위가 책상 · 탁자면 그 위로
        let best = null, bd = 2.5; for (const B of [MAIN, ANX]) { const [lx, lz] = B.toLocal(x, z); if (lx < -B.layout.L / 2 || lx > B.layout.L / 2 || lz < B.layout.zN || lz > B.layout.zS) continue; const rm = R.roomAt(x, z, rb + .1);
          for (const c of B.col) { if (c.y2 == null || c.y2 < rb + .6 || c.y2 > rb + 1.15 || (c.y1 != null && (c.y1 > rb + .1 || c.y1 < rb - .5)) || c.x2 - c.x1 > 2.6 || c.z2 - c.z1 > 2.6 || c.x2 - c.x1 < .35 || c.z2 - c.z1 < .3) continue;
            const cx = (c.x1 + c.x2) / 2, cz = (c.z1 + c.z2) / 2, d = Math.hypot(cx - lx, cz - lz); if (d >= bd) continue; const [wx, wz] = B.toWorld(cx, cz); if (rm && (R.roomAt(wx, wz, rb + .1) || {}).id !== rm.id) continue; bd = d; best = { x: wx, z: wz, y: c.y2 }; } }
        if (best) { const c0 = bb.getCenter(V), dx = best.x - c0.x, dz = best.z - c0.z, dy = best.y + .004 - bb.min.y; for (const o of objs) { if (o.parent !== group) group.attach(o); o.position.x += dx; o.position.y += dy; o.position.z += dz; } onMove && onMove(dy, dx, dz); up++; return; } }
      if (bb.max.y > rb + .015 && bb.min.y > rb - .12) return;   // 바닥 위에 제대로 있다
      const s = R._sup ? R._sup(x, z, rb + 1.25) : rb, base = s != null && s >= rb - .05 && s < rb + 1.3 ? s : rb, dy = base + .004 - bb.min.y;
      for (const o of objs) { if (o.parent !== group) group.attach(o); o.position.y += dy; } onMove && onMove(dy); up++;
    };
    // 가구 속에 박힌 아이템(구급상자 등) → 그 가구 윗면 위로 (1.3m 이하) 아니면 바깥 빈 바닥으로
    for (const it of W.items) { if (it.taken || it.rbY == null || !it.mesh || it._emb) continue; it._emb = true; const bb = new THREE.Box3().setFromObject(it.mesh); if (bb.isEmpty()) continue;
      for (const B of [MAIN, ANX]) { const [lx, lz] = B.toLocal(it.pos.x, it.pos.z); if (lx < -B.layout.L / 2 || lx > B.layout.L / 2 || lz < B.layout.zN || lz > B.layout.zS) continue;
        const c = B.col.find(c => c.y2 != null && c.y2 > bb.min.y + .03 && (c.y1 ?? 0) < bb.max.y - .03 && lx > c.x1 - .05 && lx < c.x2 + .05 && lz > c.z1 - .05 && lz < c.z2 + .05 && c.x2 - c.x1 < 3.5 && c.z2 - c.z1 < 3.5); if (!c) break;
        if (c.y2 < it.rbY + 1.3) { const dy = c.y2 + .004 - bb.min.y; if (it.mesh.parent !== group) group.attach(it.mesh); it.mesh.position.y += dy; it.pos.y += dy; if (it.baseY != null) it.baseY += dy; up++; break; }
        const cands = [[c.x1 - .3, lz], [c.x2 + .3, lz], [lx, c.z1 - .3], [lx, c.z2 + .3]].sort((a, b) => Math.hypot(a[0] - lx, a[1] - lz) - Math.hypot(b[0] - lx, b[1] - lz));
        for (const [qx, qz] of cands) { if (B.col.some(k => k.y2 != null && k.y2 > it.rbY + .05 && (k.y1 ?? 0) < it.rbY + .5 && qx > k.x1 - .15 && qx < k.x2 + .15 && qz > k.z1 - .15 && qz < k.z2 + .15)) continue; const [wx, wz] = B.toWorld(qx, qz), dx = wx - it.pos.x, dz = wz - it.pos.z, dy = it.rbY + .004 - bb.min.y; if (it.mesh.parent !== group) group.attach(it.mesh); it.mesh.position.x += dx; it.mesh.position.y += dy; it.mesh.position.z += dz; it.pos.x = wx; it.pos.z = wz; it.pos.y += dy; up++; break; }
        break; } }
    for (const it of W.items) { if (it.taken || it.rbY == null || !it.mesh) continue; fix([it.mesh], it.pos.x, it.pos.z, it.rbY, (dy, dx = 0, dz = 0) => { it.pos.x += dx; it.pos.y += dy; it.pos.z += dz; if (it.baseY != null) it.baseY += dy; }, true); }
    // 방송 수신기(megaRadio): 모형 없던 자리 → 탁상형 단파 수신기 (주파수 다이얼 창 · 노브 2 · 안테나)
    for (const p of W.props) { if (p._rx || p.kind !== 'megaRadio' || p.rbY == null || objsOf(p).length) continue; p._rx = true;
      const cs = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: .5, metalness: .4 }), dl = new THREE.MeshStandardMaterial({ color: 0xd8c890, emissive: 0x6a5420, emissiveIntensity: .6 }), kn = new THREE.MeshStandardMaterial({ color: 0xb8b8b4, metalness: .8, roughness: .3 });
      const g = new THREE.Group(), bd = new THREE.Mesh(new THREE.BoxGeometry(.42, .2, .24), cs); bd.position.y = .1; g.add(bd); const w = new THREE.Mesh(new THREE.BoxGeometry(.22, .06, .005), dl); w.position.set(-.06, .13, .121); g.add(w);
      [.1, .16].forEach(x => { const k = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .02, 14), kn); k.rotation.x = Math.PI / 2; k.position.set(x, .08, .125); g.add(k); });
      const an = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .5, 6), kn); an.position.set(.17, .44, -.08); an.rotation.z = -.3; g.add(an);
      const s0 = R._sup(p.x, p.z, p.rbY + 1.25), top = s0 != null && s0 > p.rbY + .3 ? s0 : p.rbY; g.position.set(p.x, top + .002, p.z); group.add(g); p.mesh = g; up++; }
    // 모형 없이 [E] 만 뜨던 옛 장비 · 좌석 조사 지점 정리 (새 건물 기준)
    //  ① 교실 '냉난방기 · 빔프로젝터 제어반' → 천장형 빔프로젝터 + 복도 쪽 벽걸이 에어컨 모형을 달고 조사 지점을 에어컨 앞으로
    //  ② 의자 · 소파 → 같은 방 가장 가까운 좌석(높이 .35~.6) 위로, 장비 · 서류 → 가까운 책상 · 장비(높이 .6 이상) 앞으로 (3m 안)
    //  ③ 붙일 가구가 없으면 이야기와 무관한 옛 장식 지점은 걷는다
    const roomRect = (x, z, rb) => { const f = Math.round((rb + .1) / FH); for (const B of [MAIN, ANX]) { const [lx, lz] = B.toLocal(x, z); const r = (B.props || []).find(q => q.kind === 'room' && q.floor === f && lx > q.x1 && lx < q.x2 && lz > q.z1 && lz < q.z2); if (r) return { B, r, lx, lz }; } return null; };
    const acM = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: .45 }), dkM = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: .4, metalness: .3 }), lensM = new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: .1, metalness: .6 });
    const mesh = (geo, m, x, y, z, g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    for (const p of W.props) { if (p._eq || p.floor !== 0 || p.rbY == null || p._drop || objsOf(p).length || !p.label) continue;
      const lab = p.label, rr = roomRect(p.x, p.z, p.rbY); if (!rr) continue; const { B, r } = rr, rb = p.rbY;
      if (/냉난방기.*빔프로젝터/.test(lab)) { p._eq = true; const ang = -Math.atan2(B.toWorld(1, 0)[1] - B.toWorld(0, 0)[1], B.toWorld(1, 0)[0] - B.toWorld(0, 0)[0]);
        const g = new THREE.Group(), ax = (r.x1 + r.x2) / 2 + 2, [wx, wz] = B.toWorld(ax, r.z1 + .16); g.position.set(wx, rb + 2.15, wz); g.rotation.y = ang; group.add(g);
        mesh(new THREE.BoxGeometry(.9, .29, .21), acM, 0, 0, 0, g); mesh(new THREE.BoxGeometry(.84, .03, .01), dkM, 0, -.11, .106, g); mesh(new THREE.BoxGeometry(.06, .015, .005), new THREE.MeshBasicMaterial({ color: 0x40ff80 }), .35, .06, .106, g);   // 벽걸이 에어컨 (토출구 · 전원 LED)
        const pj = new THREE.Group(), [cx, cz] = B.toWorld((r.x1 + r.x2) / 2, (r.z1 + r.z2) / 2); pj.position.set(cx, rb + (B.spec.CEIL || 2.7), cz); pj.rotation.y = ang; group.add(pj);
        mesh(new THREE.CylinderGeometry(.02, .02, .28, 8), dkM, 0, -.14, 0, pj); mesh(new THREE.BoxGeometry(.32, .1, .26), acM, 0, -.32, 0, pj); const ln = mesh(new THREE.CylinderGeometry(.035, .035, .03, 14), lensM, -.1, -.32, .135, pj); ln.rotation.x = Math.PI / 2;   // 천장 빔프로젝터
        p.mesh = g; p.mesh2 = pj; const [ix, iz] = B.toWorld(ax, r.z1 + .8); p.x = ix; p.z = iz; p.y = 1.6; if (p.px != null) { p.px = ix; p.pz = iz; } up++; continue; }
      if (!/의자|소파|장비|PC|믹서|스위처|데크|콘솔|세척기|그라인더|무정전|단말기|보관함|실험대|투시경|회의록|서류/.test(lab)) continue; p._eq = true;
      const seat = /의자|소파/.test(lab), lo = seat ? .35 : .6, hi = seat ? .62 : 2.2; let best = null, bd = 3;
      for (const c of B.col) { if (c.y2 == null || c.y2 < rb + lo || c.y2 > rb + hi || (c.y1 != null && (c.y1 > rb + .1 || c.y1 < rb - .5)) || c.x2 - c.x1 > 3 || c.z2 - c.z1 > 3) continue;
        const cx = (c.x1 + c.x2) / 2, cz = (c.z1 + c.z2) / 2; if (cx < r.x1 || cx > r.x2 || cz < r.z1 || cz > r.z2) continue; const d = Math.hypot(cx - rr.lx, cz - rr.lz); if (d < bd) { bd = d; best = { cx, cz }; } }
      if (best) { const [wx, wz] = B.toWorld(best.cx, best.cz); p.x = wx; p.z = wz; if (p.px != null) { p.px = wx; p.pz = wz; } up++; }
      else if (!(p.main || p.mega || p.q || p.uid)) { p._drop = true; } }
    for (let i = W.props.length - 1; i >= 0; i--) if (W.props[i]._drop) W.props.splice(i, 1);
    // 화장실 세면대: 옛 화장실에서 옮겨 온 세면대 조사 지점(바닥 가운데 22cm 높이 옛 세면대 잔해) → 새 연립 세면대의 세면볼 3개 앞으로, 옛 모형은 숨긴다
    if (!R._sinkFix) { R._sinkFix = true; const slots = [];
      for (const B of [MAIN, ANX]) for (const q of (B.props || [])) if (q.kind === 'sink') { const rm = (B.props || []).find(r => r.kind === 'room' && r.type === 'toilet' && r.floor === q.floor && q.x > r.x1 - .2 && q.x < r.x2 + .2), wsx = rm ? (Math.abs(q.x - rm.x1) < Math.abs(q.x - rm.x2) ? rm.x1 : rm.x2) : q.x - .7, dS = Math.sign(q.x - wsx) || 1;
        for (const dz of [-.58, 0, .58]) { const [x, z] = B.toWorld(q.x, q.z + dz), [tx, tz] = B.toWorld(wsx + dS * .2, q.z + dz); slots.push({ x, z, h: q.floor * FH, tap: { x: tx, y: q.floor * FH + 1.07, z: tz }, used: false }); } }
      for (const p of W.props) { if (p.kind !== 'sink' || p.rbY == null || p.floor !== 0) continue; for (const o of objsOf(p)) o.visible = false;
        let best = null, bd = 1e9; for (const sl of slots) { if (sl.used || Math.abs(sl.h - p.rbY) > .5) continue; const d = Math.hypot(sl.x - p.x, sl.z - p.z); if (d < bd) { bd = d; best = sl; } }
        if (!best || bd > 6) { p._drop = true; continue; } best.used = true; p.x = best.x; p.z = best.z; if (p.px != null) { p.px = best.x; p.pz = best.z; } p.y = .9; if (p.sinkObj && p.sinkObj.group) p.sinkObj.group.position.set(best.tap.x, best.tap.y - .9, best.tap.z); if (p.ctx) { p.ctx.f = 0; p.ctx.rb = best.h; p.ctx.tap = { x: best.tap.x + (best.x - best.tap.x) * .0, z: best.tap.z }; const ry = Math.atan2(best.x - best.tap.x, best.z - best.tap.z); p.ctx.mirror = { x: best.tap.x - (best.x - best.tap.x) / Math.max(.01, Math.hypot(best.x - best.tap.x, best.z - best.tap.z)) * .2, y: best.h + 1.45, z: best.tap.z - (best.z - best.tap.z) / Math.max(.01, Math.hypot(best.x - best.tap.x, best.z - best.tap.z)) * .2, ry }; } up++; }
      for (let i = W.props.length - 1; i >= 0; i--) if (W.props[i]._drop) W.props.splice(i, 1); }
    // 벽걸이 방 장치(robj: 인터폰 · 복사 카운터 · 단말기 · 약품함 · 감정 카드판 등)가 옛 벽 자리 허공에 떠 있던 것 → 새 방에서 가장 가까운 벽면에 붙이고 방 안쪽을 보게
    for (const p of W.props) { if (p._wall || p.kind !== 'robj' || p.rbY == null || !p.anim || !p.anim.g || p.k === 'light_switch' || p._drop) continue; p._wall = true;
      const rr = roomRect(p.x, p.z, p.rbY); if (!rr) continue; const { B, r } = rr, g = p.anim.g, wp = g.getWorldPosition(new THREE.Vector3()), [lx, lz] = B.toLocal(wp.x, wp.z);
      const ed = [[lx - r.x1, 'x1'], [r.x2 - lx, 'x2'], [lz - r.z1, 'z1'], [r.z2 - lz, 'z2']].sort((a, b) => a[0] - b[0])[0][1];
      let nx = ed === 'x1' ? r.x1 + .12 : ed === 'x2' ? r.x2 - .12 : Math.min(r.x2 - .6, Math.max(r.x1 + .6, lx)), nz = ed === 'z1' ? r.z1 + .12 : ed === 'z2' ? r.z2 - .12 : Math.min(r.z2 - .6, Math.max(r.z1 + .6, lz));
      let inn = ed === 'x1' ? [1, 0] : ed === 'x2' ? [-1, 0] : ed === 'z1' ? [0, 1] : [0, -1];
      { const along = inn[0] ? [0, 1] : [1, 0], hy1 = p.rbY + 1.05, hy2 = p.rbY + 1.7, busy = (x, z) => B.col.some(c => c.y2 != null && c.y2 > hy1 && (c.y1 ?? 0) < hy2 && x + .3 > c.x1 && x - .3 < c.x2 && z + .3 > c.z1 && z - .3 < c.z2);   // 벽에 붙은 높은 장 · 사물함과 겹치면 벽을 따라 빈 자리로
        for (const o of [0, .6, -.6, 1.2, -1.2, 1.8, -1.8, 2.6, -2.6, 3.4, -3.4]) { const tx = nx + along[0] * o, tz = nz + along[1] * o; if (tx < r.x1 + .3 || tx > r.x2 - .3 || tz < r.z1 + .3 || tz > r.z2 - .3) continue; if (!busy(tx, tz)) { nx = tx; nz = tz; break; } } }
      const [wx, wz] = B.toWorld(nx, nz), [ix, iz] = B.toWorld(nx + inn[0], nz + inn[1]);
      if (g.parent !== group) group.attach(g); g.position.set(wx, p.rbY + 1.35, wz); g.rotation.set(0, Math.atan2(ix - wx, iz - wz), 0);
      const [px, pz] = B.toWorld(nx + inn[0] * .55, nz + inn[1] * .55); p.x = px; p.z = pz; if (p.px != null) { p.px = px; p.pz = pz; } up++; }
    // 대출 카드함: 모형 없이 [E] 만 뜨던 자리 → 나무 카드 목록함 (서랍 4×3, 놋쇠 손잡이 · 이름표)
    for (const p of W.props) { if (p._cardBox || p.k !== 'cards' || p.rbY == null || objsOf(p).length) continue; p._cardBox = true;
      const wd = new THREE.MeshStandardMaterial({ color: 0x6e4a2c, roughness: .6 }), br = new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: .35, metalness: .8 }), lb = new THREE.MeshStandardMaterial({ color: 0xece4cc, roughness: .9 });
      const g = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(.62, .92, .46), wd); body.position.y = .46; g.add(body);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const y = .24 + i * .19, x = -.2 + j * .2, fr = new THREE.Mesh(new THREE.BoxGeometry(.18, .16, .015), wd); fr.position.set(x, y, .235); g.add(fr);
        const h = new THREE.Mesh(new THREE.BoxGeometry(.05, .012, .02), br); h.position.set(x, y - .03, .248); g.add(h); const l = new THREE.Mesh(new THREE.BoxGeometry(.06, .03, .004), lb); l.position.set(x, y + .03, .244); g.add(l); }
      g.position.set(p.x, p.rbY, p.z); g.rotation.y = Math.atan2(p.x * .0, 1); group.add(g); p.mesh = g; up++; }
    // 잠긴 증거함(자물쇠 보관함)과 그 안의 증거 조각: 따로 옮겨져 상자는 바닥 · 조각은 허공에 있던 것 → 조각 자리의 책상 위에 상자를 놓고 조각은 상자 안에
    for (const p of W.props) { if (p.kind !== 'lock' || p.keyIdx == null || p.rbY == null || p._lk) continue; const it = W.items.find(i => i.kind === 'key' && i.idx === p.keyIdx); if (!it || it.rbY == null) continue; p._lk = true;
      const objs = objsOf(p); if (!objs.length) continue; const bb = new THREE.Box3(); for (const o of objs) { T.setFromObject(o); if (!T.isEmpty()) bb.union(T); } if (bb.isEmpty()) continue;
      const s0 = R._sup(it.pos.x, it.pos.z, it.rbY + 1.25), top = s0 != null && s0 > it.rbY + .3 ? s0 : it.rbY, c = bb.getCenter(V), dx = it.pos.x - c.x, dz = it.pos.z - c.z, dy = top + .003 - bb.min.y;
      for (const o of objs) { if (o.parent !== group) group.attach(o); o.position.x += dx; o.position.y += dy; o.position.z += dz; } p.x += dx; p.z += dz; if (p.px != null) { p.px += dx; p.pz += dz; } p.rbY = it.rbY; up++;
      if (it.mesh) { const kb = new THREE.Box3().setFromObject(it.mesh), ky = top + (bb.max.y - bb.min.y) * .35 - kb.min.y; if (it.mesh.parent !== group) group.attach(it.mesh); it.mesh.position.y += ky; it.pos.y += ky; if (it.baseY != null) it.baseY += ky; } }
    // 모형이 없거나 비어 버린 녹음기 → 대역 카세트 녹음기를 그 자리 책상 · 탁자 위(없으면 바닥)에 놓는다 (실내 · 바깥 모두)
    for (const p of W.props) { if (p.kind !== 'tape' || p.floor !== 0 || p.done) continue; const os = objsOf(p); let empty = !os.length;
      if (!empty) { const bb = new THREE.Box3(); os.forEach(o => { T.setFromObject(o); if (!T.isEmpty()) bb.union(T); }); empty = bb.isEmpty(); }
      if (!empty) continue; for (const o of os) if (o.parent) o.parent.remove(o);
      const y = p.rbY ?? 0, su = p.rbY != null ? R._sup(p.x, p.z, y + 1.25) : (R.groundAt ? R.groundAt(p.x, p.z, 1.3) : null), top = su != null && su - y > .3 && su - y < 1.3 ? su : y, g = new THREE.Group();
      const bm = new THREE.Mesh(new THREE.BoxGeometry(.26, .08, .15), VIS.body); bm.position.y = .04; g.add(bm);
      for (const sx of [-.055, .055]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .012, 14), VIS.reel); r.position.set(sx, .085, -.01); g.add(r); }
      const led = new THREE.Mesh(new THREE.BoxGeometry(.012, .008, .012), VIS.led); led.position.set(.1, .084, .05); g.add(led);
      g.position.set(p.x, top + .005, p.z); g.rotation.y = (p.x * 7 + p.z * 3) % 6.28; group.add(g); p.visMesh = g; p._vis = true; up++; }
    for (const p of W.props) { if (p.done || p.rbY == null || p.floor !== 0) continue; fix(objsOf(p), p.x, p.z, p.rbY, (dy, dx = 0, dz = 0) => { p.x += dx; p.z += dz; if (p.px != null) { p.px += dx; p.pz += dz; } }, /명찰|쪽지|사진|메모/.test(p.label || '') || ['clue', 'pick', 'note', 'tape'].includes(p.kind)); }
    // 녹음기 최종 안착: 충돌 상자가 아니라 실제로 그려지는 책상 · 탁자 메시 윗면에 레이캐스트로 올린다 (책상 모델 윗면이 충돌 상자보다 높아 녹음기가 상판 속에 묻혀 안 보이던 것)
    { const rc = new THREE.Raycaster(), dn = new THREE.Vector3(0, -1, 0), O = new THREE.Vector3(); rc.camera = new THREE.PerspectiveCamera();   // 스프라이트도 레이에 걸리면 카메라가 필요하다 (없으면 로딩이 멈췄다)
      for (const p of W.props) { if (p.kind !== 'tape' || p.floor !== 0 || p._seat) continue; const os = objsOf(p); if (!os.length) continue; p._seat = true;
        const mine = new Set(); os.forEach(o => o.traverse(c => mine.add(c))); const bb = new THREE.Box3(); os.forEach(o => { T.setFromObject(o); if (!T.isEmpty()) bb.union(T); }); if (bb.isEmpty()) continue;
        const c = bb.getCenter(V), base = p.rbY ?? 0; O.set(c.x, base + 1.4, c.z); rc.set(O, dn); rc.far = 1.45;
        const hit = rc.intersectObjects(scene.children, true).find(h => h.object.isMesh && !mine.has(h.object) && h.object.visible && !h.object.material?.transparent && h.point.y > base - .05 && h.point.y < base + 1.35);
        let ty = hit ? hit.point.y + .004 : bb.min.y; if (ty - base > .68 && ty - base < .8) ty = Math.max(ty, base + .806);   // 학생 책상(모델 윗면 ≈ .80) 위 — 충돌 상자 윗면(.76)에 놓으면 상판 속에 묻혀 안 보였다
        const dy = ty - bb.min.y; if (Math.abs(dy) < .005) continue; for (const o of os) { if (o.parent !== group) group.attach(o); o.position.y += dy; } up++; } }
    return { re, up };
  };
  return R;
}
