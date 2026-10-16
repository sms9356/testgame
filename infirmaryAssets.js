import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';

export function updateInfirmaryCabinets(views, records) { for (const view of views) { const closed = records.find(r => r.id === view.closedId), opened = records.find(r => r.id === view.openId); const showOpen = !!view.getOpen?.() && opened?.status === "ready"; view.closedHolder.visible = !showOpen; view.openHolder.visible = showOpen; if (view.fallback) view.fallback.visible = !showOpen && closed?.status !== "ready"; } } const URLS = {
  bed: 'assets/infirmary/infirmary_bed.glb',
  cabinetClosed: 'assets/infirmary/medicine_cabinet_closed.glb',
  cabinetOpen: 'assets/infirmary/medicine_cabinet_open.glb'
};
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
const load = (loader, url) => typeof loader.loadAsync === 'function'
  ? loader.loadAsync(url)
  : new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));

const opaque = material => !!material && !material.transparent && !/glass/i.test(material.name);
const setShadows = mesh => {
  const enabled = !Array.isArray(mesh.material) && opaque(mesh.material) && mesh.material.isMeshStandardMaterial === true;
  mesh.castShadow = mesh.receiveShadow = enabled;
};

// Opt-in for static furniture only. Clone the hierarchy first, so source nodes,
// matrices, attributes, geometries and materials are never edited.
function optimizeOpaque(source) {
  const root = source.clone(true);
  root.updateMatrixWorld(true);
  const determinant = root.matrixWorld.determinant();
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) return root;
  const inverseRoot = root.matrixWorld.clone().invert(), groups = new Map();
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    // Group authored shadow flags exactly; final imported clones get the
    // local high-quality shadow policy after batching.
    // Keep glass and hierarchy-sensitive/animated or partial-draw meshes intact.
    if (mesh === root || mesh.children.length || mesh.isSkinnedMesh || mesh.isInstancedMesh ||
      Array.isArray(mesh.material) || !opaque(mesh.material)) return;
    let ancestor = mesh;
    while (ancestor) { if (!ancestor.visible) return; ancestor = ancestor.parent; }
    const geometry = mesh.geometry;
    if (!geometry?.attributes.position || Object.keys(geometry.morphAttributes).length ||
      geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity) return;
    const attributes = Object.entries(geometry.attributes).sort(([a], [b]) => a.localeCompare(b));
    if (attributes.some(([, a]) => a.isInterleavedBufferAttribute || !a.array)) return;
    const relative = new THREE.Matrix4().multiplyMatrices(inverseRoot, mesh.matrixWorld);
    // Reflections would require winding edits; degenerate transforms cannot
    // preserve normals reliably. Retain their original meshes instead.
    if (!(relative.determinant() > 1e-12)) return;
    const signature = JSON.stringify({
      index: geometry.index ? [geometry.index.array.constructor.name,
        geometry.index.itemSize, geometry.index.normalized,
        geometry.index.gpuType ?? null, geometry.index.usage] : null,
      attributes: attributes.map(([name, a]) => [name, a.itemSize, a.normalized,
        a.array.constructor.name, a.gpuType ?? null, a.usage]),
      castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow
    });
    const key = mesh.material.uuid + ':' + signature;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ mesh, relative });
  });
  for (const entries of groups.values()) {
    if (entries.length < 2) continue;
    const copies = [];
    let merged;
    try {
      for (const { mesh, relative } of entries) {
        const geometry = mesh.geometry.clone(); copies.push(geometry);
        geometry.applyMatrix4(relative); // UVs untouched; normals transform only.
      }
      merged = mergeGeometries(copies, false);
      if (!merged) continue;
      const first = entries[0].mesh, mesh = new THREE.Mesh(merged, first.material);
      mesh.name = 'infirmary-batch:' + first.material.name;
      mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
      mesh.userData.sourceNames = entries.map(entry => entry.mesh.name);
      root.add(mesh);
      for (const entry of entries) entry.mesh.parent.remove(entry.mesh);
    } catch (_) {
      // No originals are removed until merging succeeds.
      if (merged) merged.dispose();
    } finally {
      for (const geometry of copies) geometry.dispose();
    }
  }
  return root;
}

/** Visual replacement only. Holders must already be attached to the scene.
 * ready resolves with records even on per-slot failure. Optional missing AO
 * sidecars retain the original AO and are reported through record.aoErrors.
 */
export function installInfirmaryAssets({ renderer, scene, camera, slots,
  loader = new GLTFLoader(), textureLoader = new THREE.TextureLoader(), frame = nextFrame,
  batchOpaque = false }) {
  const records = slots.map(slot => ({ ...slot, status: 'pending', error: null,
    aoErrors: [], model: null }));
  const sources = new Map(), aoCache = new Map(), uploaded = new Set();
  const sourceFor = kind => {
    if (!URLS[kind]) throw new Error('Unknown infirmary kind: ' + kind);
    if (!sources.has(kind)) sources.set(kind, load(loader, URLS[kind]).then(gltf => {
      if (!gltf?.scene) throw new Error('GLTF has no scene: ' + kind);
      if (!batchOpaque || gltf.animations?.length) return gltf.scene;
      try { return optimizeOpaque(gltf.scene); }
      catch (_) { return gltf.scene; } // Full hierarchy on optimization failure.
    }));
    return sources.get(kind);
  };
  const aoFor = name => {
    const url = 'assets/infirmary/ao_' + encodeURIComponent(name) + '.png';
    if (!aoCache.has(url)) aoCache.set(url, load(textureLoader, url).then(texture => {
      texture.flipY = false;
      texture.channel = 0;
      texture.colorSpace = THREE.NoColorSpace;
      const maximum = renderer.capabilities?.getMaxAnisotropy?.() ?? 1;
      texture.anisotropy = Math.max(1, Math.min(8, maximum));
      texture.needsUpdate = true;
      return texture;
    }));
    return aoCache.get(url);
  };
  const ready = (async () => {
    for (const record of records) {
      let model;
      try {
        record.status = 'loading';
        if (!record.holder?.isObject3D) throw new Error('Slot holder must be an Object3D');
        if (record.fallback === record.holder) throw new Error('Slot fallback must not equal holder');
        const source = await sourceFor(record.kind);
        let skinned = false;
        source.traverse(o => { if (o.isSkinnedMesh) skinned = true; });
        if (skinned) throw new Error('Skinned furniture requires skeleton-aware cloning');
        const root = source.clone(true), materials = new Map();
        function copyMaterial(original) {
          if (!original) return original;
          if (!materials.has(original)) {
            const material = original.clone();
            if (material.transparent || /glass/i.test(material.name)) {
              material.transparent = true;
              material.depthWrite = false;
            }
            materials.set(original, material);
          }
          return materials.get(original);
        }
        root.traverse(o => {
          o.userData.dynamic = true;
          if (!o.isMesh) return;
          o.material = Array.isArray(o.material)
            ? o.material.map(copyMaterial) : copyMaterial(o.material);
          setShadows(o);
        });
        for (const material of materials.values()) {
          if (!material.name || !('aoMap' in material)) continue;
          try {
            material.aoMap = await aoFor(material.name);
            material.aoMapIntensity = .6;
            material.needsUpdate = true;
          } catch (error) {
            record.aoErrors.push({ material: material.name, error });
          }
        }
        // Preserve authored attributes and PBR; optional static batching above
        // transforms cloned geometry only. No UV generation or normal recompute.
        model = new THREE.Group(); model.name = 'infirmary:' + record.id;
        const zUp = new THREE.Group(); zUp.rotation.x = -Math.PI / 2;
        zUp.add(root); model.add(zUp);
        if (record.kind === 'bed') model.rotation.y = -Math.PI / 2;
        model.traverse(o => { o.userData.dynamic = true; });
        model.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(model, true);
        if (bounds.isEmpty() || !Number.isFinite(bounds.min.y)) throw new Error('Asset has no finite bounds');
        model.position.y = -bounds.min.y;
        model.updateMatrixWorld(true);
        record.status = 'staging';
        const textures = new Set();
        for (const material of materials.values()) {
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        }
        for (const texture of textures) {
          if (uploaded.has(texture)) continue;
          await frame();
          renderer.initTexture(texture);
          uploaded.add(texture);
        }
        await frame();
        if (typeof renderer.compileAsync !== 'function') throw new Error('renderer.compileAsync is required');
        await renderer.compileAsync(model, camera, scene);
        record.holder.add(model);
        if (record.fallback) record.fallback.visible = false;
        record.model = model;
        record.status = 'ready';
      } catch (error) {
        if (model?.parent) model.parent.remove(model);
        record.error = error;
        record.status = 'error';
        if (record.fallback) record.fallback.visible = true;
      }
    }
    return records;
  })();
  return { records, ready };
}
