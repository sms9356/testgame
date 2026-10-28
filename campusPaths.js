// 캠퍼스 인도 재배치: 예전 배치(옛 시설 · 옛 본관 기준)로 깔린 보도블록이 새 건물 벽을 뚫고 지나가거나
// 서로 겹쳐(같은 높이 → 깜빡임) 지저분했다 → 예전 보도를 모두 걷고, 같은 경로를 격자로 합친 뒤
// 건물 바닥 사각형을 빼고, 새 현관마다 진입로를 이어 한 장의 겹침 없는 인도로 다시 깐다 (경계엔 연석).
import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';
import { ZONES } from './facilityRebuild.js?v=253';

const CELL = .2, X0 = -130, X1 = 130, Z0 = -100, Z1 = 90;
// 캠퍼스 재배치 후 새 인도망 (폭 2.8m 안팎): 예전 보도는 모두 걷고 동선대로 다시 깐다 — 대로 4줄 + 안쪽 종단로 + 각 건물 현관 진입로
const NET = [
  // 대로: 서편 남북 · 동편 남북(야구장 펜스 · 도서관 소품을 밟지 않게 x 67.8 ~ 70.4) · 북부 동서 · 남부 동서(서문 ↔ 운동장 서쪽 / 운동장 동쪽 ↔ 동편 대로)
  [-72.2, -69.4, -45.0, 57.2], [69.3, 71.7, -51.5, 30.0], [69.3, 70.6, 30.0, 48.0], [69.3, 71.7, 48.0, 57.2], [-69.4, 71.7, -35.2, -32.4], [-113.8, -27.2, 54.0, 57.2], [27.6, 69.3, 54.0, 57.2],
  // 운동장 양옆 종단로 · 본관 양옆 길 · 운동장 북쪽 연결 · 호수 길
  [-29.6, -27.2, 11.0, 54.0], [25.0, 27.6, 11.0, 54.0], [-39.6, -37.0, -32.4, 11.0], [37.0, 39.6, -32.4, 10.4], [-29.6, 25.0, 11.0, 12.6], [-10.6, -7.4, -77.0, -35.2],
  // 서쪽 학술 · 생활: 청운학사 · 역사관 · 과학천문관 · 학생회관 · 급식실
  [-87.5, -72.2, -35.0, -32.4], [-89.4, -72.2, -10.7, -7.9], [-89.4, -72.2, 22.0, 24.8], [-89.5, -86.5, 49.0, 54.0], [-69.4, -29.6, 26.6, 29.4], [-40.5, -37.5, 25.0, 26.6],
  // 동쪽 스포츠: 체육관(남측 현관) · 테니스장 문 · 야구장 문 · 농구장 · 수영장(동측 현관) · 수돗가 · 씨름장
  [71.7, 85.4, -27.9, -25.1], [71.7, 73.8, -18.5, -15.5], [71.7, 72.0, 6.5, 9.5], [65.0, 69.3, 5.6, 8.4], [65.0, 69.3, 33.6, 36.4], [60.0, 69.3, -16.2, -13.4],
  // 대강당(남측 현관) ↔ 남부 대로 · 도서관(현관 계단 앞까지) · 온실 · 야외음악당
  [36.6, 39.4, 37.0, 54.0], [71.7, 85.4, 50.4, 53.2], [82.6, 85.4, 49.4, 50.4], [65.6, 69.3, -46.2, -43.4], [33.6, 36.4, -45.0, -35.2],
];
// 길을 깔지 않는 자리: 옮긴 체육관 · 코트 · 경기장, 도서관 · 매점 · 온실 · 음악당
const KEEP_OUT = [[74, 94, -50, -28], [74, 94, -25, -9], [72, 96, -5, 21], [51, 65, -.5, 14.5], [73, 95, 30, 48], [58.9, 68.1, 14.8, 21.2], [58, 65.5, -53, -47], [31.2, 38.8, -52, -45]];
const near = (a, b) => Math.abs(a - b) < .05;

export function relayCampusPaths({ world, footprints = [] }) {
  const OUT = world.OUT, pave = OUT.userData.pave; if (!pave) return null;
  // 1) 예전 보도 수집 · 숨김 (tileRoad 목록 + 같은 재질의 다른 평면 보도)
  const bb = new THREE.Box3();
  (OUT.userData.paths || []).forEach(p => { p.mesh.visible = false; });
  OUT.traverse(o => { if (!o.isMesh || o.material !== pave || !o.visible) return; bb.setFromObject(o); if (bb.max.y > .06) return; o.visible = false; });
  if (OUT.userData.pathCurb) OUT.userData.pathCurb.visible = false;
  const rects = NET.slice();
  window.__pathNET = NET;   // 점검 스크립트용
  // 2) 격자에 칠하고 건물 바닥(벽 두께 포함)을 뺀다
  const nx = Math.round((X1 - X0) / CELL), nz = Math.round((Z1 - Z0) / CELL), G = new Uint8Array(nx * nz);
  const paint = (x1, x2, z1, z2, v) => { const i1 = Math.max(0, Math.round((x1 - X0) / CELL)), i2 = Math.min(nx, Math.round((x2 - X0) / CELL)), k1 = Math.max(0, Math.round((z1 - Z0) / CELL)), k2 = Math.min(nz, Math.round((z2 - Z0) / CELL)); for (let k = k1; k < k2; k++) G.fill(v, k * nx + i1, k * nx + i2); };
  rects.forEach(r => paint(...r, 1));
  const blocks = [...Object.values(ZONES).map(Z => [Z.cx - Z.W / 2, Z.cx + Z.W / 2, Z.cz - Z.D / 2, Z.cz + Z.D / 2]), ...footprints, ...KEEP_OUT, [4.8, 11.4, 59.6, 67.9]];   // + 경비동
  blocks.forEach(b => paint(b[0] - .05, b[1] + .05, b[2] - .05, b[3] + .05, 0));
  // 3) 겹침 없는 사각형으로 묶기 (가로 구간 → 같은 구간이 이어지는 줄끼리 세로로 합침)
  const quads = [], open = new Map();
  const flush = (key, q) => { quads.push(q); open.delete(key); };
  for (let k = 0; k <= nz; k++) {
    const runs = new Set();
    if (k < nz) for (let i = 0; i < nx;) { if (!G[k * nx + i]) { i++; continue; } let j = i; while (j < nx && G[k * nx + j]) j++; runs.add(i + ':' + j); i = j; }
    for (const [key, q] of [...open]) if (!runs.has(key)) flush(key, q); else { q[3] = k + 1; runs.delete(key); }
    for (const key of runs) { const [i, j] = key.split(':').map(Number); open.set(key, [i, j, k, k + 1]); }
  }
  // 4) 메시: 월드 좌표 UV (이음매 없이 이어지는 판석 무늬) · 한 장으로 합침
  const geos = quads.map(([i, j, k1, k2]) => { const x1 = X0 + i * CELL, x2 = X0 + j * CELL, z1 = Z0 + k1 * CELL, z2 = Z0 + k2 * CELL;
    const g = new THREE.PlaneGeometry(x2 - x1, z2 - z1); g.rotateX(-Math.PI / 2); g.translate((x1 + x2) / 2, .013, (z1 + z2) / 2);
    const uv = g.attributes.uv, pos = g.attributes.position; for (let n = 0; n < uv.count; n++) uv.setXY(n, pos.getX(n) / 3, -pos.getZ(n) / 3); return g; });
  const root = new THREE.Group(); root.name = 'CAMPUS_PATHS'; root.userData.rbKeep = true; root.userData.facKeep = true;
  if (geos.length) { const m = new THREE.Mesh(mergeGeometries(geos), pave); m.receiveShadow = true; root.add(m); }
  // 5) 연석: 인도 칸과 잔디 칸이 맞닿는 경계를 따라 (가로 · 세로로 이어 붙여 상자 수를 줄인다)
  const curb = [], cw = .14, ch = .08, on = (i, k) => i >= 0 && k >= 0 && i < nx && k < nz && G[k * nx + i] === 1;
  const blocked = (i, k) => { const x = X0 + (i + .5) * CELL, z = Z0 + (k + .5) * CELL; return blocks.some(b => x > b[0] - .1 && x < b[1] + .1 && z > b[2] - .1 && z < b[3] + .1); };   // 건물 벽에 닿는 쪽은 연석 없음
  for (const dk of [-1, 1]) for (let k = 0; k < nz; k++) for (let i = 0; i < nx;) { if (!(on(i, k) && !on(i, k + dk) && !blocked(i, k + dk))) { i++; continue; } let j = i; while (j < nx && on(j, k) && !on(j, k + dk) && !blocked(j, k + dk)) j++;
    const z = Z0 + (dk > 0 ? k + 1 : k) * CELL; const g = new THREE.BoxGeometry((j - i) * CELL, ch, cw); g.translate(X0 + (i + j) / 2 * CELL, ch / 2, z); curb.push(g); i = j; }
  for (const di of [-1, 1]) for (let i = 0; i < nx; i++) for (let k = 0; k < nz;) { if (!(on(i, k) && !on(i + di, k) && !blocked(i + di, k))) { k++; continue; } let j = k; while (j < nz && on(i, j) && !on(i + di, j) && !blocked(i + di, j)) j++;
    const x = X0 + (di > 0 ? i + 1 : i) * CELL; const g = new THREE.BoxGeometry(cw, ch, (j - k) * CELL); g.translate(x, ch / 2, Z0 + (k + j) / 2 * CELL); curb.push(g); k = j; }
  if (curb.length) { const cm = new THREE.Mesh(mergeGeometries(curb), OUT.userData.curbMat || pave); cm.receiveShadow = true; root.add(cm); }
  OUT.add(root);
  return { quads: quads.length, curbs: curb.length, rects: rects.length };
}

// 재배치 뒤 남은 잔재 · 인도 위 장애물 정리 (늦게 불러오는 모델이 있어 몇 번 더 돈다)
//   ① 옛 수영장 현관문(옛 자리 동쪽 벽 바깥) · 옛 야외농구장 바닥 선  ② 새 인도 위에 놓인 작은 인스턴스 소품(화단 풀 · 쓰레기통 · 라바콘 등)
const LEFTOVER = [[-34.7, -31.5, 38.2, 43.8, 99], [28.0, 44.6, 37.0, 57.0, .06], [69.8, 72.6, -10.0, -7.0, 99], [-49.2, -47.8, 25.8, 27.2, 99]];   // + 동편 대로 위 옛 광장 소품 · 급식실 서쪽 길 위 잔해   // [x1, x2, z1, z2, 이 높이 아래 메시만]
const CLEAN_SEEN = new WeakSet();
export function cleanupCampus({ scene, floors }) {
  const inner = new Set(); floors.forEach((F, i) => { if (F && i) { inner.add(F.interior); if (F.shell) inner.add(F.shell); } });
  const bb = new THREE.Box3(), c = new THREE.Vector3(), s = new THREE.Vector3(), m4 = new THREE.Matrix4(), v = new THREE.Vector3(); let hid = 0, inst = 0;
  const inNet = (x, z) => NET.some(q => x > q[0] + .3 && x < q[1] - .3 && z > q[2] + .3 && z < q[3] - .3);
  const walk = o => { if (inner.has(o) || !o.visible || o.isCamera || o.isSkinnedMesh) return; const n = o.name || '';
    if (/^(FAC_|CAMPUS_PATHS|REBUILD)/.test(n) || o.userData.relaid || o.userData.facNew) return;
    if (o.isInstancedMesh) { let hit = 0; const e = window.__perfInst && window.__perfInst(o), arr = e ? e.src : null, cnt = e ? e.n : o.count, from = o.userData.cleanN || 0; o.userData.cleanN = cnt;   // 이미 본 인스턴스는 다시 보지 않는다
      for (let i = from; i < cnt; i++) { if (arr) m4.fromArray(arr, i * 16); else o.getMatrixAt(i, m4); if (m4.elements[0] === 0 && m4.elements[5] === 0 && m4.elements[10] === 0) continue;
        v.setFromMatrixPosition(m4).applyMatrix4(o.matrixWorld); if (v.y < -.5 || v.y > 2.5 || !inNet(v.x, v.z)) continue; m4.makeScale(0, 0, 0); if (arr) m4.toArray(arr, i * 16); o.setMatrixAt(i, m4); hit++; }
      if (hit) { o.instanceMatrix.needsUpdate = true; inst += hit; } return; }
    if (o.isMesh) { if (CLEAN_SEEN.has(o)) return; CLEAN_SEEN.add(o); v.setFromMatrixPosition(o.matrixWorld); if (!LEFTOVER.some(r => v.x > r[0] - 20 && v.x < r[1] + 20 && v.z > r[2] - 20 && v.z < r[3] + 20) && o.geometry && (o.geometry.boundingSphere || (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere)).radius < 15) return;   // 잔재 구역 근처만 상자 계산 (매번 전체 상자를 재면 100ms 씩 멈췄다)
      bb.setFromObject(o); if (bb.isEmpty()) return; bb.getCenter(c); bb.getSize(s); if (Math.max(s.x, s.z) > 25) return;
      const L = LEFTOVER.find(r => c.x > r[0] && c.x < r[1] && c.z > r[2] && c.z < r[3] && bb.max.y < r[4] && bb.min.y > -.5); if (L) { o.visible = false; hid++; } return; }
    o.children.forEach(walk); };
  scene.children.forEach(walk);
  return { hid, inst };
}
