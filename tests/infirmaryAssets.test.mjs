import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { installInfirmaryAssets } from '../infirmaryAssets.js';

function fixture(kind = 'bed', count = 1) {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const source = new THREE.Group(); source.name = 'authored-root';
  const geometry = new THREE.BoxGeometry(4, 2, 1);
  const material = new THREE.MeshStandardMaterial({ roughness: .03, metalness: .8 });
  material.name = 'linen';
  material.map = new THREE.Texture(); material.normalMap = new THREE.Texture();
  material.roughnessMap = material.metalnessMap = new THREE.Texture();
  const mesh = new THREE.Mesh(geometry, material); mesh.position.z = 2;
  source.add(mesh);
  const head = new THREE.Object3D(); head.name = 'head-marker'; head.position.set(-2, 0, 2); source.add(head);
  const slots = Array.from({ length: count }, (_, i) => {
    const holder = new THREE.Group(), fallback = new THREE.Group();
    holder.add(fallback); scene.add(holder);
    return { id: 'slot-' + i, kind, holder, fallback };
  });
  const calls = { gltf: [], ao: [], init: [], compile: [] };
  const loader = { loadAsync: async url => { calls.gltf.push(url); return { scene: source }; } };
  const textureLoader = { loadAsync: async url => { calls.ao.push(url); return new THREE.Texture(); } };
  const renderer = {
    capabilities: { getMaxAnisotropy: () => 16 },
    initTexture: texture => calls.init.push(texture),
    compileAsync: async model => { calls.compile.push(model); }
  };
  const options = { renderer, scene, camera, slots, loader, textureLoader, frame: () => Promise.resolve() };
  return { options, slots, source, mesh, geometry, material, calls };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, a + ' != ' + b);

test('bed Z-up conversion, width/height/length, head north and grounding', async () => {
  const f = fixture(); const { records, ready } = installInfirmaryAssets(f.options); await ready;
  const model = records[0].model; model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
  near(size.x, 2); near(size.y, 1); near(size.z, 4); near(box.min.y, 0);
  const head = model.getObjectByName('head-marker').getWorldPosition(new THREE.Vector3());
  assert.ok(head.z < 0); near(model.rotation.y, -Math.PI / 2);
  near(model.children[0].rotation.x, -Math.PI / 2);
});

test('cabinet conversion has no imposed yaw; holder yaw stays unchanged', async () => {
  const f = fixture('cabinetClosed'); f.slots[0].holder.rotation.y = .7;
  const { records, ready } = installInfirmaryAssets(f.options); await ready;
  near(records[0].model.rotation.y, 0); near(f.slots[0].holder.rotation.y, .7);
  near(records[0].model.children[0].rotation.x, -Math.PI / 2);
  assert.equal(f.calls.gltf[0], 'assets/infirmary/medicine_cabinet_closed.glb');
});

test('geometry identity, normals/UVs, authored hierarchy and embedded PBR maps preserved', async () => {
  const f = fixture();
  const normal = f.geometry.attributes.normal.array.slice(), uv = f.geometry.attributes.uv.array.slice();
  const { records, ready } = installInfirmaryAssets(f.options); await ready;
  const root = records[0].model.children[0].children[0], clone = root.children[0];
  assert.equal(root.name, 'authored-root'); near(clone.position.z, 2);
  assert.equal(clone.geometry, f.geometry);
  assert.deepEqual(f.geometry.attributes.normal.array, normal); assert.deepEqual(f.geometry.attributes.uv.array, uv);
  assert.notEqual(clone.material, f.material); near(clone.material.roughness, .03);
  for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) assert.equal(clone.material[key], f.material[key]);
  assert.equal(f.material.aoMap, null);
  assert.equal(clone.material.aoMap.flipY, false); assert.equal(clone.material.aoMap.channel, 0);
  assert.equal(clone.material.aoMap.colorSpace, THREE.NoColorSpace);
  near(clone.material.aoMapIntensity, .6); assert.equal(clone.material.aoMap.anisotropy, 8);
  records[0].model.traverse(o => assert.equal(o.userData.dynamic, true));
});

test('per-kind source and AO cached; distinct scene clones and sequential staging', async () => {
  const f = fixture('bed', 2); let inFlight = 0;
  f.options.renderer.compileAsync = async model => {
    assert.equal(inFlight++, 0);
    assert.equal(f.slots[f.calls.compile.length].fallback.visible, true);
    assert.equal(model.parent, null);
    await Promise.resolve(); f.calls.compile.push(model); inFlight--;
  };
  const { records, ready } = installInfirmaryAssets(f.options); assert.equal(await ready, records);
  assert.equal(f.calls.gltf.length, 1); assert.equal(f.calls.ao.length, 1); assert.equal(f.calls.compile.length, 2);
  assert.notEqual(records[0].model, records[1].model);
  for (let i = 0; i < 2; i++) {
    assert.equal(records[i].status, 'ready'); assert.equal(records[i].model.parent, f.slots[i].holder);
    assert.equal(f.slots[i].fallback.visible, false); assert.equal(f.slots[i].fallback.parent, f.slots[i].holder);
  }
});

test('load failure resolves, retains fallback and leaves holder otherwise unchanged', async () => {
  const f = fixture('bed', 2); f.options.loader.loadAsync = async () => { throw new Error('missing GLB'); };
  const { records, ready } = installInfirmaryAssets(f.options); await ready;
  for (let i = 0; i < 2; i++) {
    assert.equal(records[i].status, 'error'); assert.match(records[i].error.message, /missing GLB/);
    assert.equal(records[i].model, null); assert.equal(f.slots[i].fallback.visible, true);
    assert.deepEqual(f.slots[i].holder.children, [f.slots[i].fallback]);
  }
});

test('compile failure retains fallback; later slot still succeeds', async () => {
  const f = fixture('cabinetOpen', 2); let n = 0;
  f.options.renderer.compileAsync = async () => { if (++n === 1) throw new Error('compile failed'); };
  const { records, ready } = installInfirmaryAssets(f.options); await ready;
  assert.equal(records[0].status, 'error'); assert.equal(f.slots[0].fallback.visible, true);
  assert.equal(f.slots[0].holder.children.length, 1);
  assert.equal(records[1].status, 'ready'); assert.equal(f.slots[1].fallback.visible, false);
});

test('optional AO failure keeps original maps; local glass clone gets depthWrite false', async () => {
  const f = fixture('cabinetClosed'); f.material.name = 'glass'; f.material.transparent = true;
  f.material.aoMap = new THREE.Texture();
  f.options.textureLoader.loadAsync = async () => { throw new Error('no AO sidecar'); };
  const { records, ready } = installInfirmaryAssets(f.options); await ready;
  assert.equal(records[0].status, 'ready'); assert.equal(records[0].aoErrors.length, 1);
  const clone = records[0].model.children[0].children[0].children[0];
  assert.equal(clone.material.aoMap, f.material.aoMap); assert.equal(clone.material.depthWrite, false);
  assert.equal(f.material.depthWrite, true);
});

const meshCount = root => { let n = 0; root.traverse(o => { if (o.isMesh) n++; }); return n; };

test('reject fallback equal to holder without attaching or hiding a model', async () => {
  const f = fixture(); f.slots[0].fallback = f.slots[0].holder;
  const { records, ready } = installInfirmaryAssets(f.options); await ready;
  assert.equal(records[0].status, 'error'); assert.match(records[0].error.message, /must not equal holder/);
  assert.equal(records[0].model, null); assert.equal(f.slots[0].holder.visible, true);
  assert.equal(f.slots[0].holder.children.length, 1); assert.equal(f.calls.gltf.length, 0);
});

test('opt-in opaque batching preserves transformed bounds/UV/normals and immutable source; shares optimized buffers', async () => {
  const f = fixture('bed', 2); f.mesh.name = 'body-a';
  f.source.position.set(1, .4, 2); f.source.rotation.z = .2;
  const nested = new THREE.Group(); nested.name = 'nested';
  nested.position.set(3, .7, .2); nested.rotation.set(.1, .2, .4); nested.scale.set(1.2, .8, 1.1);
  const second = new THREE.Mesh(f.geometry, f.material); second.name = 'body-b'; second.position.set(.2, .1, 2);
  nested.add(second); f.source.add(nested);
  const glassMaterial = new THREE.MeshStandardMaterial({ transparent: true, opacity: .4 }); glassMaterial.name = 'glass';
  const glass = new THREE.Mesh(new THREE.BoxGeometry(.2, .3, .4), glassMaterial); glass.name = 'glass-pane';
  glass.position.set(.2, 2, 1); nested.add(glass);
  const basic = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .1), new THREE.MeshBasicMaterial());
  basic.name = 'basic-detail'; f.source.add(basic);
  const arrayMesh = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .1), [f.material]);
  arrayMesh.name = 'array-material'; f.source.add(arrayMesh);
  const sourceChildren = f.source.children.slice(), nestedChildren = nested.children.slice();
  const normal = f.geometry.attributes.normal.array.slice(), uv = f.geometry.attributes.uv.array.slice();
  const sourceMatrix = f.source.matrix.clone(), sourceWorld = f.source.matrixWorld.clone();
  const sourceCast = f.mesh.castShadow, sourceReceive = f.mesh.receiveShadow;
  const reference = f.source.clone(true); reference.updateMatrixWorld(true);
  const inverse = reference.matrixWorld.clone().invert(), expectedNormals = [], expectedUV = [];
  for (const name of ['body-a', 'body-b']) {
    const m = reference.getObjectByName(name);
    const geometry = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, m.matrixWorld));
    expectedNormals.push(...geometry.attributes.normal.array); expectedUV.push(...geometry.attributes.uv.array);
  }
  const baseHolder = new THREE.Group(), baseFallback = new THREE.Group(); baseHolder.add(baseFallback); f.options.scene.add(baseHolder);
  const baseline = installInfirmaryAssets({ ...f.options, slots: [{ id: 'baseline', kind: 'bed', holder: baseHolder, fallback: baseFallback }] });
  await baseline.ready;
  const installed = installInfirmaryAssets({ ...f.options, batchOpaque: true }); await installed.ready;
  const model = installed.records[0].model, optimizedRoot = model.children[0].children[0];
  assert.equal(installed.records[0].status, 'ready');
  assert.equal(meshCount(baseline.records[0].model), 5); assert.equal(meshCount(model), 4);
  const before = new THREE.Box3().setFromObject(baseline.records[0].model, true), after = new THREE.Box3().setFromObject(model, true);
  for (const key of ['x', 'y', 'z']) { near(before.min[key], after.min[key]); near(before.max[key], after.max[key]); }
  const merged = optimizedRoot.getObjectByName('infirmary-batch:linen'); assert.ok(merged);
  assert.notEqual(merged.geometry, f.geometry);
  assert.deepEqual([...merged.geometry.attributes.uv.array], expectedUV);
  const actualNormal = [...merged.geometry.attributes.normal.array]; assert.equal(actualNormal.length, expectedNormals.length);
  actualNormal.forEach((value, i) => near(value, expectedNormals[i]));
  const otherMerged = installed.records[1].model.getObjectByName('infirmary-batch:linen');
  assert.equal(otherMerged.geometry, merged.geometry);
  assert.equal(f.calls.gltf.length, 2); // one baseline installation and one cached batch installation
  assert.equal(merged.castShadow, true); assert.equal(merged.receiveShadow, true);
  const clonedGlass = model.getObjectByName('glass-pane');
  assert.equal(clonedGlass.parent.name, 'nested'); assert.equal(clonedGlass.geometry, glass.geometry);
  assert.equal(clonedGlass.material.depthWrite, false); assert.equal(clonedGlass.castShadow, false); assert.equal(clonedGlass.receiveShadow, false);
  assert.equal(model.getObjectByName('basic-detail').castShadow, false);
  assert.equal(model.getObjectByName('array-material').castShadow, false);
  assert.deepEqual(f.source.children, sourceChildren); assert.deepEqual(nested.children, nestedChildren);
  assert.deepEqual(f.geometry.attributes.normal.array, normal); assert.deepEqual(f.geometry.attributes.uv.array, uv);
  assert.ok(f.source.matrix.equals(sourceMatrix)); assert.ok(f.source.matrixWorld.equals(sourceWorld));
  assert.equal(f.mesh.castShadow, sourceCast); assert.equal(f.mesh.receiveShadow, sourceReceive);
  assert.equal(f.material.aoMap, null); assert.equal(glassMaterial.depthWrite, true);
});

test('batching keeps incompatible attribute signatures and animated assets unmerged', async () => {
  const f = fixture(); const different = f.geometry.clone();
  different.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(different.attributes.position.count * 2), 2));
  f.source.add(new THREE.Mesh(different, f.material));
  const result = installInfirmaryAssets({ ...f.options, batchOpaque: true }); await result.ready;
  assert.equal(meshCount(result.records[0].model), 2);
  const animated = fixture(); animated.source.add(new THREE.Mesh(animated.geometry, animated.material));
  animated.options.loader.loadAsync = async () => ({ scene: animated.source, animations: [new THREE.AnimationClip('static-looking', 1, [])] });
  const skipped = installInfirmaryAssets({ ...animated.options, batchOpaque: true }); await skipped.ready;
  assert.equal(meshCount(skipped.records[0].model), 2);
});

test('batch grouping honors distinct authored cast/receive flags', async () => {
  const f = fixture(); const second = new THREE.Mesh(f.geometry, f.material);
  second.castShadow = true; second.receiveShadow = true; f.source.add(second);
  const result = installInfirmaryAssets({ ...f.options, batchOpaque: true }); await result.ready;
  assert.equal(meshCount(result.records[0].model), 2);
  result.records[0].model.traverse(o => {
    if (o.isMesh) { assert.equal(o.castShadow, true); assert.equal(o.receiveShadow, true); }
  });
  assert.equal(f.mesh.castShadow, false); assert.equal(f.mesh.receiveShadow, false);
});
