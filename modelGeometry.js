import * as THREE from './vendor/three.module.js';

// Keep authored UVs. For unwrapped procedural packs, project whole triangles
// onto one plane; switching axes per vertex tears curved faces into blocks.
export function prepareModelGeometry(source, matrix, rotateZUp = false) {
  const g = source.index ? source.toNonIndexed() : source.clone();
  const authored = g.getAttribute('uv');
  const hasUV = authored && authored.count === g.attributes.position.count &&
    Array.from(authored.array).every(Number.isFinite) && authored.array.some(v => Math.abs(v) > 1e-6);
  g.applyMatrix4(matrix);
  if (rotateZUp) g.rotateX(-Math.PI / 2);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!hasUV) {
    const p = g.attributes.position, uv = new Float32Array(p.count * 2);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      n.crossVectors(b.sub(a), c.sub(a)).normalize();
      const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
      for (let k = i; k < i + 3; k++) {
        const axis = ax >= ay && ax >= az ? 0 : ay >= az ? 1 : 2;
        const u = axis === 0 ? p.getZ(k) : p.getX(k);
        const v = axis === 1 ? p.getZ(k) : p.getY(k);
        uv[k * 2] = u; uv[k * 2 + 1] = v;
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  // Packs are static props. Normalize attributes before merging, and provide
  // the AO UV channel explicitly instead of sampling every vertex at (0, 0).
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  g.setAttribute('uv1', g.attributes.uv.clone());
  g.computeBoundingBox();
  return g;
}
