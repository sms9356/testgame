import * as THREE from './vendor/three.module.js';
import { mergeGeometries, toCreasedNormals } from './vendor/addons/utils/BufferGeometryUtils.js';

export function cloneV6(source) {
  const root = source.clone(true), materials = new Map();
  root.traverse(n => {
    if (!n.isMesh) return;
    n.geometry = n.geometry.clone();
    const repaired = !n.geometry.getAttribute('normal');
    if (repaired) { const g = toCreasedNormals(n.geometry, Math.PI / 3); if (g !== n.geometry) n.geometry.dispose(); n.geometry = g; }
    const clone = m => { let variants = materials.get(m); if (!variants) { variants = new Map(); materials.set(m,variants); } const key = repaired && m.flatShading; if (!variants.has(key)) { const c=m.clone(); if (key) c.flatShading=false; variants.set(key,c); } return variants.get(key); };
    n.material = Array.isArray(n.material) ? n.material.map(clone) : clone(n.material);
    const ms = Array.isArray(n.material) ? n.material : [n.material];
    n.castShadow = n.receiveShadow = ms.every(m => !m.transparent && m.opacity >= 1);
  });
  return root;
}
function signature(g) {
  return Object.keys(g.attributes).sort().map(k => {
    const a = g.attributes[k];
    return [k,a.itemSize,a.normalized,a.array.constructor.name,a.gpuType].join(':');
  }).join('|');
}
export function batchV6(root) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert(), buckets = new Map();
  let before = 0;
  root.traverse(n => {
    if (!n.isMesh) return;
    before++;
    const g = n.geometry, m = n.material;
    if (Array.isArray(m) || m.transparent || m.opacity < 1 || m.alphaTest > 0 || n.isSkinnedMesh || n.userData.dynamic ||
        /screen|diffuser|DOOR|HANDLE/i.test(n.name) || Object.keys(g.morphAttributes).length || g.groups.length > 1 ||
        g.drawRange.start !== 0 || g.drawRange.count !== Infinity || Object.values(g.attributes).some(a => a.isInterleavedBufferAttribute)) return;
    const key = [m.uuid,signature(g),n.castShadow,n.receiveShadow].join(';');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(n);
  });
  for (const nodes of buckets.values()) {
    if (nodes.length < 2) continue;
    const geometries = nodes.map(n => {
      const g = n.geometry.clone(), matrix = inverse.clone().multiply(n.matrixWorld);
      g.applyMatrix4(matrix);
      if (!g.index) { const indices = new Uint32Array(g.attributes.position.count); for (let i=0;i<indices.length;i++) indices[i]=i; g.setIndex(new THREE.BufferAttribute(indices,1)); }
      if (matrix.determinant() < 0) { const ix = g.index.array; for (let i=0;i<ix.length;i+=3) { const t=ix[i]; ix[i]=ix[i+2]; ix[i+2]=t; } }
      return g;
    });
    const merged = mergeGeometries(geometries, false);
    geometries.forEach(g => g.dispose());
    if (!merged) continue;
    merged.computeBoundingBox(); merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged,nodes[0].material);
    mesh.name = 'GUARDROOM_V6_BATCH'; mesh.castShadow=nodes[0].castShadow; mesh.receiveShadow=nodes[0].receiveShadow;
    mesh.matrixAutoUpdate=false; root.add(mesh);
    nodes.forEach(n => { n.removeFromParent(); n.geometry.dispose(); });
  }
  root.updateMatrixWorld(true);
  let after=0; root.traverse(n => { if(n.isMesh) after++; });
  return { before, after, bounds: localBounds(root) };
}

export function guardDoorSweepContains(layout, player, radius=.24) {
  if (!player || player.floor !== 0) return false;
  const dx=player.x-layout.doorX, dz=player.z-layout.doorZ;
  return dx >= -radius-.025 && dz >= -radius-.025 && Math.hypot(Math.max(0,dx),Math.max(0,dz)) <= .85+radius+.025;
}

export function localBounds(root, object = root) {
  root.updateWorldMatrix(true,true);
  const inverse=root.matrixWorld.clone().invert(), box=new THREE.Box3();
  object.traverse(n => { if (!n.isMesh) return; n.geometry.computeBoundingBox(); box.union(n.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(n.matrixWorld))); });
  return box;
}
