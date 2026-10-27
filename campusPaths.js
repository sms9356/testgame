// 캠퍼스 인도 재배치: 예전 배치(옛 시설 · 옛 본관 기준)로 깔린 보도블록이 새 건물 벽을 뚫고 지나가거나
// 서로 겹쳐(같은 높이 → 깜빡임) 지저분했다 → 예전 보도를 모두 걷고, 같은 경로를 격자로 합친 뒤
// 건물 바닥 사각형을 빼고, 새 현관마다 진입로를 이어 한 장의 겹침 없는 인도로 다시 깐다 (경계엔 연석).
import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';
import { ZONES } from './facilityRebuild.js?v=225';

const CELL = .2, X0 = -130, X1 = 130, Z0 = -100, Z1 = 90;
// 새 현관 진입로 (설계도: 모든 시설 남측 중앙 · 수영장만 동측) — 캐노피 디딤판 끝에서 가까운 간선까지
const SPURS = [
  [-87.5, -72.2, -32.7, -29.9],   // 청운학사 → 서편 남북 대로
  [-89.5, -86.5, 51.3, 54.0],     // 학생회관 → 서남 대보행로
  [82.5, 85.5, -23.7, -21.0], [72.2, 85.5, -23.7, -21.0],   // 과학천문관 → 동편 대로
  [82.5, 85.5, -3.4, -.6], [72.2, 85.5, -3.4, -.6],         // 역사관 → 동편 대로
  [82.5, 85.5, 22.8, 25.6], [72.2, 85.5, 22.8, 25.6],       // 분리수거장 → 동편 대로
  [-40.5, -37.5, 27.3, 29.4],     // 급식실 → 중서부 연결로
  [-26.5, -23.5, -32.7, -32.4],   // 대강당 캐노피 ↔ 북부 메인 인도 (틈 메움)
];
// 예전 옆문으로 가던 진입 지선 (새 건물엔 그쪽에 문이 없다)
const DEAD = [[-75.0, -72.2, -43.5, -40.5], [72.2, 74.0, -35.5, -32.5], [-77.0, -72.2, 40.5, 43.5]];
const near = (a, b) => Math.abs(a - b) < .05;

export function relayCampusPaths({ world, footprints = [] }) {
  const OUT = world.OUT, pave = OUT.userData.pave; if (!pave) return null;
  // 1) 예전 보도 수집 · 숨김 (tileRoad 목록 + 같은 재질의 다른 평면 보도)
  const rects = [], bb = new THREE.Box3();
  (OUT.userData.paths || []).forEach(p => { p.mesh.visible = false; if (!DEAD.some(d => near(d[0], p.x1) && near(d[1], p.x2) && near(d[2], p.z1) && near(d[3], p.z2))) rects.push([p.x1, p.x2, p.z1, p.z2]); });
  OUT.traverse(o => { if (!o.isMesh || o.material !== pave || !o.visible) return; bb.setFromObject(o); if (bb.max.y > .06) return; o.visible = false; rects.push([bb.min.x, bb.max.x, bb.min.z, bb.max.z]); });
  if (OUT.userData.pathCurb) OUT.userData.pathCurb.visible = false;
  rects.push(...SPURS);
  // 2) 격자에 칠하고 건물 바닥(벽 두께 포함)을 뺀다
  const nx = Math.round((X1 - X0) / CELL), nz = Math.round((Z1 - Z0) / CELL), G = new Uint8Array(nx * nz);
  const paint = (x1, x2, z1, z2, v) => { const i1 = Math.max(0, Math.round((x1 - X0) / CELL)), i2 = Math.min(nx, Math.round((x2 - X0) / CELL)), k1 = Math.max(0, Math.round((z1 - Z0) / CELL)), k2 = Math.min(nz, Math.round((z2 - Z0) / CELL)); for (let k = k1; k < k2; k++) G.fill(v, k * nx + i1, k * nx + i2); };
  rects.forEach(r => paint(...r, 1));
  const blocks = [...Object.values(ZONES).map(Z => [Z.cx - Z.W / 2, Z.cx + Z.W / 2, Z.cz - Z.D / 2, Z.cz + Z.D / 2]), ...footprints, [4.8, 11.4, 59.6, 67.9]];   // + 경비동
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
