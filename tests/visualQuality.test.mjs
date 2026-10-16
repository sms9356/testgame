// Run from the testgame checkout: node --test /path/to/visualQuality.test.mjs
// Or: TESTGAME_ROOT=/path/to/testgame node --test visualQuality.test.mjs
// Node only. No WebGL renderer, network, DOM, dependencies, or repository edits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(process.env.TESTGAME_ROOT || process.cwd());
const source = name => readFile(path.join(root, name), 'utf8');
const THREE = await import(pathToFileURL(path.join(root, 'vendor/three.module.js')).href);
const { bakeStatic } = await import(pathToFileURL(path.join(root, 'bake.js')).href);
const game = await source('game.js');

function nearArray(actual, expected, label, epsilon = 2e-6) {
  assert.equal(actual.length, expected.length, `${label}: length`);
  for (let i = 0; i < actual.length; i++) {
    assert.ok(Number.isFinite(actual[i]) && Math.abs(actual[i] - expected[i]) <= epsilon,
      `${label}[${i}]: ${actual[i]} != ${expected[i]}`);
  }
}
function mesh(material, cast, receive, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  m.castShadow = cast; m.receiveShadow = receive; m.position.set(x, y, z);
  return m;
}
const baked = root => root.children.filter(o => o.isMesh && o.userData.baked);

for (const [label, makeMaterial] of [
  ['standard', () => new THREE.MeshStandardMaterial()],
  ['basic', () => new THREE.MeshBasicMaterial()],
  ['transparent', () => new THREE.MeshStandardMaterial({ transparent: true, opacity: .5 })],
]) {
  test(`bake: ${label} material partitions all four source shadow flag pairs and applies material policy`, () => {
    const group = new THREE.Group(), material = makeMaterial();
    for (const cast of [false, true]) for (const receive of [false, true]) {
      group.add(mesh(material, cast, receive, 1), mesh(material, cast, receive, 2));
    }
    assert.deepEqual(bakeStatic(group), { merged: 8, meshes: 4 });
    const outputs = baked(group);
    assert.equal(outputs.length, 4);
    assert.deepEqual(outputs.map(m => `${m.castShadow}/${m.receiveShadow}`).sort(),
      label === 'standard'
        ? ['false/false', 'false/true', 'true/false', 'true/true']
        : ['false/false', 'false/false', 'false/false', 'false/false']);
    for (const m of outputs) {
      assert.equal(m.material, material);
      assert.equal(m.geometry.attributes.position.count, 48);
      assert.equal(m.geometry.index.count, 72);
    }
  });
}

test('bake: still partitions by material and each spatial chunk axis', () => {
  const group = new THREE.Group(), a = new THREE.MeshStandardMaterial(), b = a.clone();
  group.add(mesh(a, true, false, 1), mesh(a, true, false, 2));
  group.add(mesh(b, true, false, 1));
  group.add(mesh(a, true, false, 19), mesh(a, true, false, -1));
  group.add(mesh(a, true, false, 1, 9), mesh(a, true, false, 1, 0, 19));
  assert.deepEqual(bakeStatic(group), { merged: 7, meshes: 6 });
  assert.equal(baked(group).filter(m => m.material === b).length, 1);
  assert.equal(baked(group).filter(m => m.geometry.attributes.position.count === 48).length, 1);
  for (const m of baked(group)) {
    assert.equal(m.castShadow, true); assert.equal(m.receiveShadow, false);
  }
});

test('bake: dynamic descendants, invisible meshes and instancing remain untouched', () => {
  const group = new THREE.Group(), material = new THREE.MeshStandardMaterial();
  const dynamic = new THREE.Group(); dynamic.userData.dynamic = true;
  const child = mesh(material, true, true); dynamic.add(child); group.add(dynamic);
  const hidden = mesh(material, false, false); hidden.visible = false;
  const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(), material, 1);
  group.add(hidden, instanced, mesh(material, false, false));
  assert.deepEqual(bakeStatic(group), { merged: 1, meshes: 1 });
  assert.equal(child.parent, dynamic); assert.equal(hidden.parent, group);
  assert.equal(instanced.parent, group);
});

// Deliberately extract only the existing local arrow function, not game startup.
// A structural change fails loudly rather than silently skipping normal tests.
const hMatch = game.match(/const\s+h133Parts\s*=\s*([\s\S]*?);\s*const\s+packed\s*=/);
assert.ok(hMatch, 'Locate h133Parts immediately before packed in game.js');
const hSource = hMatch[1];
test('h133Parts: clones smooth normals before flat computation and restores after UV assignment', () => {
  const cloneAt = hSource.search(/g\.attributes\.normal(?:\?\.)?\.?(?:clone)\(\)/);
  const computeAt = hSource.indexOf('g.computeVertexNormals()');
  const uvAt = hSource.search(/g\.setAttribute\(\s*['"]uv['"]/);
  const restoreAt = hSource.search(/g\.setAttribute\(\s*['"]normal['"]/);
  assert.ok(cloneAt >= 0 && cloneAt < computeAt, 'clone transformed source normals before computing flat normals');
  assert.ok(computeAt < uvAt && uvAt < restoreAt, 'use flat normals for UVs, then restore smooth normals');
});
function mergeGeometries(gs) {
  // h133Parts has already converted each geometry to non-indexed form.
  const merged = new THREE.BufferGeometry();
  for (const name of Object.keys(gs[0].attributes)) {
    const itemSize = gs[0].attributes[name].itemSize;
    const values = gs.flatMap(g => {
      assert.equal(g.index, null);
      assert.equal(g.attributes[name].itemSize, itemSize);
      return Array.from(g.attributes[name].array);
    });
    merged.setAttribute(name, new THREE.Float32BufferAttribute(values, itemSize));
  }
  return merged;
}
const sharedMat = new THREE.MeshStandardMaterial();
const world = Object.fromEntries(['h133Mat', 'crMat', 'prMat', 'v2Mat'].map(k => [k, () => sharedMat]));
const h133Parts = new Function('THREE', 'world', 'mergeGeometries', `return (${hSource});`)(THREE, world, mergeGeometries);
function referenceGeometry(o, pr) {
  const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
  g.deleteAttribute('color'); g.applyMatrix4(o.matrixWorld);
  if (pr === true) g.rotateX(-Math.PI / 2);
  return g;
}
function flatUV(g) {
  const flat = g.clone(); flat.computeVertexNormals();
  const p = flat.attributes.position, n = flat.attributes.normal, uv = [];
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [u, v] = ax >= ay && ax >= az ? [p.getZ(i), p.getY(i)]
      : ay >= az ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)];
    uv.push(u * .8, v * .8);
  }
  return uv;
}
for (const indexed of [true, false]) for (const pr of [false, true, 'v2']) {
  test(`h133Parts: transformed smooth normals survive; legacy flat-axis UVs survive (indexed=${indexed}, pr=${pr})`, () => {
    const group = new THREE.Group();
    group.position.set(2, 3, 4); group.rotation.set(.2, .4, -.1);
    const sphere = new THREE.SphereGeometry(1, 12, 8);
    const geo = indexed ? sphere : sphere.toNonIndexed();
    const beforeNormal = Array.from(geo.attributes.normal.array);
    const beforePosition = Array.from(geo.attributes.position.array);
    const a = new THREE.Mesh(geo, sharedMat), b = new THREE.Mesh(geo.clone(), sharedMat);
    a.scale.set(1.2, .7, 1.8); b.position.set(3, 1, 2);
    group.add(a, b); group.updateMatrixWorld(true);
    const refs = [a, b].map(o => referenceGeometry(o, pr));
    // Ensure this fixture actually distinguishes flat normals from smooth ones.
    const flat = refs[0].clone(); flat.computeVertexNormals();
    assert.ok(flat.attributes.normal.array.some((v, i) => Math.abs(v - refs[0].attributes.normal.array[i]) > .01));
    const out = h133Parts(group, 'fixture', false, pr);
    assert.equal(out.length, 1); assert.equal(out[0].material, sharedMat);
    const g = out[0].geometry;
    nearArray(g.attributes.normal.array, refs.flatMap(r => Array.from(r.attributes.normal.array)), 'smooth normals');
    nearArray(g.attributes.position.array, refs.flatMap(r => Array.from(r.attributes.position.array)), 'positions');
    nearArray(g.attributes.uv.array, refs.flatMap(flatUV), 'legacy UV');
    assert.deepEqual(Array.from(geo.attributes.normal.array), beforeNormal, 'source normals not mutated');
    assert.deepEqual(Array.from(geo.attributes.position.array), beforePosition, 'source positions not mutated');
  });
}

test('h133Parts: normal-less input still gains valid face normals and UVs', () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([1, 2, 3, 4, 2, 3, 1, 5, 3], 3));
  const group = new THREE.Group(); group.add(new THREE.Mesh(g, sharedMat)); group.updateMatrixWorld(true);
  const [out] = h133Parts(group, 'fixture', false, false);
  nearArray(out.geometry.attributes.normal.array, [0, 0, 1, 0, 0, 1, 0, 0, 1], 'fallback normals');
  nearArray(out.geometry.attributes.uv.array, flatUV(g), 'fallback UV');
  assert.equal(g.attributes.normal, undefined);
});

test('quality: low preset uses pixel ratio 1, not .75', () => {
  const low = game.match(/\blow\s*:\s*\{([^}]*)\}/);
  assert.ok(low, 'low preset exists');
  const pr = low[1].match(/\bpr\s*:\s*([\d.]+)/);
  assert.ok(pr, 'low preset pr exists'); assert.equal(Number(pr[1]), 1);
  assert.match(low[1], /\bsh\s*:\s*0\b/, 'low still disables shadows');
});

test('paving: narrowed warm gray range and genuinely finer speckle sizes', async () => {
  const tex = await source('tex.js');
  const match = tex.match(/export\s+const\s+makePaving\s*=([\s\S]*?)(?=export\s+const\s+makeAsphalt)/);
  assert.ok(match, 'makePaving exists');
  const body = match[1];
  assert.match(body, /\brr\(\s*82\s*,\s*90\s*\)/);
  assert.doesNotMatch(body, /\brr\(\s*70\s*,\s*100\s*\)/);
  assert.match(body, /rgb\(\$\{v\},\s*\$\{v\s*-\s*2\},\s*\$\{v\s*-\s*8\}\)/, 'paving tile base retains warm gray channel offsets');
  // Numeric parameters after the color array: smin, smax, amax.
  const calls = [...body.matchAll(/\bspeckle\([^;]*?\]\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/g)];
  assert.ok(calls.length, 'paving retains texture speckles');
  assert.ok(calls.some(m => Number(m[1]) > 0 && Number(m[1]) < 2 &&
    Number(m[2]) >= Number(m[1]) && Number(m[2]) < 9), 'fine speckle min and max both shrink from 2..9');
});

test('signs: long text fits and damage speckles stay fine', async () => { const tex = await source('tex.js'); const m = tex.match(/export const makeSign =([\s\S]*?)(?=\/\/ 태극기)/); assert.ok(m); const makeSign = new Function('ctex','FONT','speckle', 'return (' + m[1].trim().replace(/;$/, '') + ');')((w,h,paint) => { const result = {}, g = { font: '', fillRect() {}, strokeRect() {}, measureText(t) { return { width: String(t).length * Number(this.font.match(/[\d.]+/)[0]) * .7 }; }, fillText(t,x,y,maxWidth) { Object.assign(result, { text:t, maxWidth, font:this.font, width:this.measureText(t).width }); } }; paint(g,w,h); return result; }, 'sans-serif', (g,w,h,n,cols,smin,smax,amax) => { assert.ok(smin > 0 && smax <= 1.5 && amax <= .1); }); for (const text of ['음악실','서 문 고 등 학 교','본관 북쪽 연결 통로 및 별관 안내']) { const r = makeSign(text, '#222', '#ddd', 40); assert.equal(r.maxWidth, 236); assert.ok(r.width <= 236.001); } }); test('clinic furniture: open bed frame and folded curtain preserve bounds', async () => { const s = await source('school37RoomsPatch.js'); const start = s.indexOf('_prefabBedWithCurtain() {'), end = s.indexOf('_prefabGrandPiano() {', start); assert.ok(start >= 0 && end > start); const method = s.substring(start, end), body = method.substring(method.indexOf('{') + 1, method.lastIndexOf('}')); const mat = new THREE.MeshStandardMaterial(), materials = Object.fromEntries(['stainless','hospitalLinen','hospitalCurtain'].map(k => [k, mat])); const bed = new Function('THREE', 'return function(){' + body + '};')(THREE).call({ materials }); assert.ok(bed.children[0].isGroup && bed.children[0].children.length >= 6); assert.ok(bed.children[3].geometry.attributes.position.count > 4); const b = new THREE.Box3().setFromObject(bed); nearArray([b.min.x,b.min.y,b.min.z,b.max.x,b.max.y,b.max.z],[-.5,0,-1,.55,2,1],'bed bounds'); }); const patches = ['classroomRemodelPatch.js', 'basementRoomsPatch.js', 'school37RoomsPatch.js',
  'poolMachineryPatch.js', 'indoorPassagePatch.js', 'new37UniquePatch.js'];
for (const file of patches) {
  test(`${file}: local makeTex assigns SRGBColorSpace before returning texture`, async () => {
    const text = await source(file);
    const match = text.match(/const\s+makeTex\s*=\s*([\s\S]*?\n\s*};)/);
    assert.ok(match, `${file}: makeTex local helper exists`);
    const body = match[1];
    const created = body.match(/const\s+(\w+)\s*=\s*new\s+THREE\.CanvasTexture\(/);
    assert.ok(created, 'helper creates CanvasTexture');
    const variable = created[1];
    const assignment = new RegExp(`\\b${variable}\\.colorSpace\\s*=\\s*THREE\\.SRGBColorSpace\\s*;`);
    assert.match(body, assignment, 'local canvas color texture is explicitly sRGB');
    const setAt = body.search(assignment), returnAt = body.search(new RegExp(`\\breturn\\s+${variable}\\s*;`));
    assert.ok(setAt > body.indexOf('new THREE.CanvasTexture') && setAt < returnAt,
      'sRGB is assigned to the created texture before return');
  });
    }
