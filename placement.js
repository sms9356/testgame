import * as THREE from './vendor/three.module.js';
import { MODEL_BOUNDS } from './modelBounds.js';

export const overlaps = (a, b, gap = 0) => a.x1 < b.x2 + gap && a.x2 > b.x1 - gap && a.z1 < b.z2 + gap && a.z2 > b.z1 - gap;

export function modelFootprint(m) {
  const v = MODEL_BOUNDS[m.model];
  if (!v) return null;
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(m.x, m.y, m.z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(m.rx || 0, m.ry || 0, m.rz || 0, 'YXZ')),
    new THREE.Vector3().setScalar(m.s || 1));
  const b = new THREE.Box3(new THREE.Vector3(...v.slice(0, 3)), new THREE.Vector3(...v.slice(3))).applyMatrix4(matrix);
  return { x1:b.min.x, x2:b.max.x, z1:b.min.z, z2:b.max.z, y1:b.min.y, y2:b.max.y };
}

// Exact duplicates are safe to remove. Authored stacks/chairs under desks are
// retained; their vertical bounds are used by the later room occupancy pass.
export function removeDuplicateModels(models) {
  const seen = new Set(), kept = []; let removed = 0;
  for (const m of models) {
    const key = [m.model,m.f,m.x,m.y,m.z,m.rx,m.ry,m.rz,m.s].map(v=>typeof v==='number'?v.toFixed(3):v).join('|');
    if (seen.has(key)) { removed++; continue; }
    seen.add(key); kept.push(m);
  }
  models.splice(0,models.length,...kept);
  return removed;
}
