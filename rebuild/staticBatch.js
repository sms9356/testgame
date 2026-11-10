// 정적 메시 정리 (성능): ① 같은 설정 · 같은 텍스처 원본의 재질을 하나로 (중복 재질 제거)
//   ② 묶음 바로 아래의 이름 · 표식 없는 정적 메시를 재질 · 층별로 한 덩어리로 합친다 (드로우콜 감소).
//   모양 · 재질 · 그림자 설정은 그대로, 위치만 미리 구워 넣는다. 반환값 등으로 다른 코드가 붙잡고 있는 객체 · 재질은 건드리지 않는다.
import * as THREE from '../vendor/three.module.js';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';

// 값(반환 객체 등) 안에서 Object3D · Material 참조를 모은다 — 이것들은 합치거나 바꾸지 않는다
export function collectRefs(val, objs = new Set(), mats = new Set(), depth = 0, seen = new Set()) {
  if (!val || typeof val !== 'object' || seen.has(val) || depth > 4) return { objs, mats };
  seen.add(val);
  if (val.isObject3D) { objs.add(val); return { objs, mats }; }
  if (val.isMaterial) { mats.add(val); return { objs, mats }; }
  if (val.isTexture || val.isBufferGeometry || ArrayBuffer.isView(val)) return { objs, mats };
  for (const k of Object.keys(val)) collectRefs(val[k], objs, mats, depth + 1, seen);
  return { objs, mats };
}

const TEX_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'lightMap', 'displacementMap', 'envMap', 'specularMap'];
const VAL_KEYS = ['color', 'emissive', 'emissiveIntensity', 'roughness', 'metalness', 'transparent', 'opacity', 'side', 'depthWrite', 'depthTest', 'blending', 'toneMapped', 'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'alphaTest', 'vertexColors', 'flatShading', 'envMapIntensity', 'fog', 'wireframe', 'colorWrite', 'visible', 'aoMapIntensity', 'bumpScale', 'lightMapIntensity', 'shininess', 'reflectivity', 'dithering', 'premultipliedAlpha', 'alphaToCoverage', 'clipShadows', 'shadowSide', 'stencilWrite', 'forceSinglePass'];
const KNOWN = new Set(['MeshStandardMaterial', 'MeshBasicMaterial', 'MeshLambertMaterial', 'MeshPhongMaterial']);
const texSig = t => t.source.uuid + '/' + t.repeat.toArray() + '/' + t.offset.toArray() + '/' + t.center.toArray() + '/' + t.rotation + '/' + t.wrapS + t.wrapT + t.colorSpace + t.flipY + t.channel + t.magFilter + t.minFilter + t.anisotropy + t.generateMipmaps + '/' + t.matrixAutoUpdate;
function matSig(m) {
  if (!KNOWN.has(m.type) || m.clippingPlanes || Object.keys(m.userData).length || m.defines && Object.keys(m.defines).length) return null;
  if (m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile || m.customProgramCacheKey !== THREE.Material.prototype.customProgramCacheKey || m.onBeforeRender !== THREE.Material.prototype.onBeforeRender) return null;
  // 투명 · 발광 재질은 다른 코드가 한 개만 깜빡이거나 흐리게 바꿀 수 있다 → 그대로 둔다
  if (m.transparent || m.opacity < 1 || (m.emissive && m.emissive.getHex() && m.emissiveIntensity > 0)) return null;
  const o = [m.type, m.name];
  for (const k of VAL_KEYS) { const v = m[k]; o.push(v && v.isColor ? v.getHex() : v); }
  if (m.normalScale) o.push(m.normalScale.x, m.normalScale.y, m.normalMapType);
  for (const k of TEX_KEYS) { const t = m[k]; o.push(t && t.isTexture ? texSig(t) : t ? '?' + (t.uuid || '') : 0); }
  return o.join('|');
}

// root 아래 모든 메시의 중복 재질을 하나로 (참조된 재질 · 메시는 제외)
export function dedupeMaterials(root, { objs = new Set(), mats = new Set() } = {}) {
  const canon = new Map(), bySig = new Map(); let n = 0;
  root.traverse(o => {
    if (!o.isMesh || objs.has(o) || Array.isArray(o.material) || !o.material || mats.has(o.material)) return;
    if (o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
    const m = o.material; let c = canon.get(m);
    if (c === undefined) { const s = matSig(m); c = s == null ? m : (bySig.get(s) || (bySig.set(s, m), m)); canon.set(m, c); }
    if (c !== m) { o.material = c; n++; }
  });
  return n;
}

// root 바로 아래 정적 메시를 재질 · 층(band)별로 합친다
export function batchStaticChildren(root, { objs = new Set(), band = 3.5, minCount = 2 } = {}) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), buckets = new Map(), box = new THREE.Box3(), ctr = new THREE.Vector3();
  const gsig = geo => (geo.index ? 'i' : 'n') + Object.keys(geo.attributes).sort().map(k => k + geo.attributes[k].itemSize + (geo.attributes[k].normalized ? 'N' : '') + geo.attributes[k].array.constructor.name).join();
  for (const m of root.children) {
    if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || m.children.length || !m.visible || m.name || objs.has(m) || Array.isArray(m.material)) continue;
    const mat = m.material, geo = m.geometry;
    if (!mat || !geo || !geo.attributes.position || mat.transparent || mat.opacity < 1 || mat.alphaTest > 0 || Object.keys(geo.morphAttributes).length) continue;
    if (m.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender || m.onAfterRender !== THREE.Object3D.prototype.onAfterRender) continue;
    if (Object.keys(m.userData).some(k => k !== 'dynamic')) continue;   // 이름 · 표식이 붙은 메시는 다른 코드가 찾을 수 있다
    box.setFromObject(m).getCenter(ctr).applyMatrix4(inv);
    const key = mat.uuid + '|' + m.castShadow + m.receiveShadow + m.frustumCulled + '|' + m.renderOrder + '|' + m.layers.mask + '|' + !!m.userData.dynamic + '|' + gsig(geo) + '|' + Math.floor(ctr.y / band);
    (buckets.get(key) || buckets.set(key, []).get(key)).push(m);
  }
  let removed = 0, added = 0;
  for (const list of buckets.values()) {
    if (list.length < minCount) continue;
    const geos = list.map(m => { const c = m.geometry.clone(); c.clearGroups(); c.applyMatrix4(inv.clone().multiply(m.matrixWorld)); return c; });
    const merged = mergeGeometries(geos, false); geos.forEach(c => c.dispose());
    if (!merged) continue;
    merged.computeBoundingBox(); merged.computeBoundingSphere();
    const f = list[0], mesh = new THREE.Mesh(merged, f.material);
    mesh.name = root.name + '_sbatch'; mesh.castShadow = f.castShadow; mesh.receiveShadow = f.receiveShadow; mesh.renderOrder = f.renderOrder; mesh.frustumCulled = f.frustumCulled; mesh.layers.mask = f.layers.mask;
    if (f.userData.dynamic) mesh.userData.dynamic = true;
    mesh.matrixAutoUpdate = false; root.add(mesh); added++;
    for (const m of list) { root.remove(m); m.geometry.dispose(); removed++; }
  }
  return { removed, added };
}
