// Render-only distance LOD for small baked static geometry.
// Never edits visibility, geometry, collision, saves, or dynamic actors.
import * as THREE from './vendor/three.module.js';
export function createStaticDistanceLOD(scene) {
  let entries = [], scanAt = -Infinity, tickAt = -Infinity, scans = 0;
  const SCAN_AT = [0, 8000, 25000, 60000, 120000];   // 늦게 불러오는 모델까지 몇 번만 다시 훑는다 (2초마다 씬 전체 1만 7천 개를 훑던 것이 주기적 끊김의 원인)
  const position = new THREE.Vector3(), size = new THREE.Vector3();
  function scan() {
    const previous = new Map(entries.map(e => [e.mesh, e]));
    entries = [];
    scene.traverse(mesh => {
      if (!mesh.isMesh || mesh.isInstancedMesh || !mesh.userData.baked || mesh.userData.dynamic) return;
      for (let p = mesh.parent; p; p = p.parent) if (p.userData.dynamic) return;
      const box = new THREE.Box3().setFromObject(mesh);
      box.getSize(size);
      // Keep walls, floors, roofs, terrain and large merged chunks.
      if (box.isEmpty() || Math.max(size.x, size.y, size.z) >= 12) return;
      entries.push({ mesh, box, far: previous.get(mesh)?.far || false });
    });
  }
  return {
    render(camera, now, quality, draw) {
      // High quality remains unchanged. Other settings retain structural
      // silhouettes, but omit small static detail beyond 40 metres.
      const enabled = quality !== 'high';
      if (enabled && scans < SCAN_AT.length && now - scanAt >= (SCAN_AT[scans] - (SCAN_AT[scans - 1] || 0))) { scan(); scanAt = now; scans++; }
      if (enabled && now - tickAt >= 200) {
        camera.getWorldPosition(position);
        for (const e of entries) {
          const dx = Math.max(e.box.min.x - position.x, 0, position.x - e.box.max.x);
          const dz = Math.max(e.box.min.z - position.z, 0, position.z - e.box.max.z);
          e.far = dx * dx + dz * dz > (e.far ? 35 * 35 : 40 * 40);
        }
        tickAt = now;
      }
      const changed = [];
      if (enabled) for (const e of entries) if (e.far && (e.mesh.layers.mask & 1)) {
        changed.push([e.mesh, e.mesh.layers.mask]);
        e.mesh.layers.disable(0);
      }
      try { return draw(); }
      finally { for (const [mesh, mask] of changed) mesh.layers.mask = mask; }
    },
    invalidate() { scanAt = tickAt = -Infinity; scans = Math.min(scans, SCAN_AT.length - 1); },
  };
}
