// 예전 건물 메시를 삼각형 단위로 다룬다.
//   carve: 조건에 맞는 삼각형을 지운다 (층 전체를 하나로 합친 메시에서 예전 건물 부분만 걷어 낸다)
import * as THREE from '../vendor/three.module.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const ATTRS = ['position', 'normal', 'uv', 'color'];

// 삼각형 목록(원본 꼭짓점 번호 3개씩) → 새 비인덱스 지오메트리 (M 을 곱한다)
function build(geo, tris, M) {
  const out = new THREE.BufferGeometry(), nm = M ? new THREE.Matrix3().getNormalMatrix(M) : null;
  for (const k of ATTRS) {
    const src = geo.getAttribute(k); if (!src) continue;
    const n = src.itemSize, arr = new Float32Array(tris.length * n);
    for (let i = 0; i < tris.length; i++) for (let j = 0; j < n; j++) arr[i * n + j] = src.getComponent(tris[i], j);
    const at = new THREE.BufferAttribute(arr, n);
    if (M && k === 'position') at.applyMatrix4(M); else if (nm && k === 'normal') { at.applyNormalMatrix(nm); at.normalized = false; }
    out.setAttribute(k, at);
  }
  return out;
}
// 삼각형마다 (그룹 번호, 꼭짓점 3개, 세계 좌표 중심) 를 돈다
function eachTri(mesh, fn) {
  const geo = mesh.geometry, idx = geo.index, pos = geo.getAttribute('position'); if (!pos) return;
  const n = idx ? idx.count : pos.count, at = i => idx ? idx.getX(i) : i;
  const groups = geo.groups.length ? geo.groups : [{ start: 0, count: n, materialIndex: 0 }];
  mesh.updateWorldMatrix(true, false); const W = mesh.matrixWorld;
  for (const g of groups) for (let t = g.start; t < Math.min(n, g.start + g.count) - 2; t += 3) {
    const i0 = at(t), i1 = at(t + 1), i2 = at(t + 2);
    _a.fromBufferAttribute(pos, i0).applyMatrix4(W); _b.fromBufferAttribute(pos, i1).applyMatrix4(W); _c.fromBufferAttribute(pos, i2).applyMatrix4(W);
    fn(g.materialIndex || 0, i0, i1, i2, (_a.x + _b.x + _c.x) / 3, (_a.y + _b.y + _c.y) / 3, (_a.z + _b.z + _c.z) / 3);
  }
}
const grouped = (geo, byMat) => {   // 재질별 삼각형 목록 → 그룹 달린 지오메트리
  const flat = [], groups = []; for (const [mi, list] of byMat) { groups.push({ start: flat.length, count: list.length, materialIndex: mi }); flat.push(...list); }
  return { flat, groups };
};

// 조건에 맞는 삼각형을 지운다. 지운 삼각형 수를 돌려준다 (전부 지워지면 감춘다)
export function carve(mesh, pred) {
  if (mesh.isInstancedMesh || mesh.isSkinnedMesh) return 0;
  const byMat = new Map(); let gone = 0, total = 0;
  eachTri(mesh, (mi, i0, i1, i2, x, y, z) => { total++; if (pred(x, y, z)) { gone++; return; } const l = byMat.get(mi) || byMat.set(mi, []).get(mi); l.push(i0, i1, i2); });
  if (!gone) return 0;
  if (gone === total) { mesh.visible = false; return gone; }
  const { flat, groups } = grouped(mesh.geometry, byMat), g = build(mesh.geometry, flat, null);
  if (Array.isArray(mesh.material)) groups.forEach(q => g.addGroup(q.start, q.count, q.materialIndex));
  mesh.geometry = g; g.computeBoundingSphere(); g.computeBoundingBox(); return gone;
}
