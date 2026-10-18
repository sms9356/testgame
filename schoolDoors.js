import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';

const BASE = 'assets/models/door2/';
const ENT_GLB = 'assets/models/sf/sf_entrance_door.glb';
const FLOORS = new Set([0, 1, 2, 8, 9, 10]);
const SKIP_ROOM = /^(toilet|storage|storeS|cleaning)$/;
const KEEP = { front: 1, back: 1, glass: 1 };

function bucketOf(m) {
  const n = m.name || '';
  if (m.transparent || /glaz|glass/i.test(n)) return 'glass';
  if (/PHOTO_oak_front/i.test(n)) return 'front';
  if (/Oak_side_back/i.test(n)) return 'back';
  if (/alumin|lock|stainless|metal|silver/i.test(n)) return 'metal';
  if (/rubber|seal|join|dark|frame/i.test(n)) return 'dark';
  return 'trim';
}
function packLeaf(scene, mats) {
  scene.updateMatrixWorld(true);
  const groups = {};
  scene.traverse(o => {
    if (!o.isMesh) return;
    const k = bucketOf(o.material);
    if (!mats[k]) mats[k] = makeMat(k, o.material);
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    (groups[k] ||= []).push(g.index ? g.toNonIndexed() : g);
  });
  const out = {};
  for (const [k, gs] of Object.entries(groups)) out[k] = gs.length > 1 ? mergeGeometries(gs) : gs[0];
  const b = new THREE.Box3(); Object.values(out).forEach(g => { g.computeBoundingBox(); b.union(g.boundingBox); });
  return { geos: out, box: b };
}
function makeMat(k, src) {
  if (KEEP[k]) { const m = src.clone(); if (k === 'glass') { m.transparent = true; m.opacity = Math.min(m.opacity ?? 1, .22); m.depthWrite = false; m.side = THREE.DoubleSide; } return m; }
  return new THREE.MeshStandardMaterial({ color: src.color.clone(), roughness: src.roughness, metalness: src.metalness });
}

function packEntranceKit(scene) {
  scene.updateMatrixWorld(true);
  const entMats = {
    glass: new THREE.MeshStandardMaterial({ color: 0x9ec0d4, roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
    frame: new THREE.MeshStandardMaterial({ color: 0x383e42, roughness: 0.42, metalness: 0.65 }),
    bar: new THREE.MeshStandardMaterial({ color: 0xd0d6dc, roughness: 0.22, metalness: 0.88 })
  };
  const leftGroups = {}, rightGroups = {};
  scene.traverse(o => {
    if (!o.isMesh) return;
    const matName = (o.material?.name || '').toLowerCase();
    const k = matName.includes('glass') ? 'glass' : matName.includes('silver') ? 'bar' : 'frame';
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position, nor = g.attributes.normal;
    const lPos = [], lNor = [], rPos = [], rNor = [];
    for (let i = 0; i < pos.count; i += 3) {
      const x0 = pos.getX(i), x1 = pos.getX(i + 1), x2 = pos.getX(i + 2);
      if (Math.max(x0, x1, x2) - Math.min(x0, x1, x2) > 1.35) continue;
      const mx = (x0 + x1 + x2) / 3;
      const tPos = mx < 0 ? lPos : rPos, tNor = mx < 0 ? lNor : rNor;
      for (let j = 0; j < 3; j++) {
        tPos.push(pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j));
        tNor.push(nor.getX(i + j), nor.getY(i + j), nor.getZ(i + j));
      }
    }
    const buildGeo = (pArr, nArr) => {
      if (!pArr.length) return null;
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute(pArr, 3));
      bg.setAttribute('normal', new THREE.Float32BufferAttribute(nArr, 3));
      return bg;
    };
    const lg = buildGeo(lPos, lNor), rg = buildGeo(rPos, rNor);
    if (lg) (leftGroups[k] ||= []).push(lg);
    if (rg) (rightGroups[k] ||= []).push(rg);
  });
  const finishSide = (groups) => {
    const out = {}, b = new THREE.Box3();
    for (const [k, gs] of Object.entries(groups)) {
      out[k] = gs.length > 1 ? mergeGeometries(gs) : gs[0];
      out[k].computeBoundingBox(); b.union(out[k].boundingBox);
    }
    return { geos: out, box: b };
  };
  return { left: finishSide(leftGroups), right: finishSide(rightGroups), mats: entMats };
}

let READY = null;
function loadKit() {
  if (READY) return READY;
  const L = new GLTFLoader(), mats = {};
  READY = Promise.all([
    L.loadAsync(BASE + 'left.glb'),
    L.loadAsync(BASE + 'right.glb'),
    L.loadAsync(ENT_GLB).catch(() => null)
  ]).then(([l, r, ent]) => ({
    left: packLeaf(l.scene, mats),
    right: packLeaf(r.scene, mats),
    mats,
    entKit: ent ? packEntranceKit(ent.scene) : null
  }));
  return READY;
}

function fitLeaf(kit, piv, isEntrance = false) {
  const old = piv.children.find(c => c.isMesh && !c.userData.door2);
  if (!old) return false;
  if (!old.geometry.boundingBox) old.geometry.computeBoundingBox();
  const ob = old.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().compose(old.position, old.quaternion, old.scale));
  const toPlusX = (ob.min.x + ob.max.x) / 2 > 0;
  const src = toPlusX ? kit.left : kit.right, mb = src.box;
  if (!mb || mb.isEmpty()) return false;
  const W = ob.max.x - ob.min.x, H = ob.max.y - ob.min.y, mw = mb.max.x - mb.min.x, mh = mb.max.y - mb.min.y;
  const g = new THREE.Group(); g.userData.door2 = true; g.userData.dynamic = true;
  g.scale.set(W / mw, H / mh, 1);
  g.position.set(toPlusX ? ob.min.x - mb.min.x * W / mw : ob.max.x - mb.max.x * W / mw, ob.min.y - mb.min.y * H / mh, (ob.min.z + ob.max.z) / 2 - (mb.min.z + mb.max.z) / 2);
  for (const [k, geo] of Object.entries(src.geos)) {
    const m = new THREE.Mesh(geo, kit.mats[k]);
    m.castShadow = !isEntrance && (k === 'front' || k === 'back');
    m.receiveShadow = true; m.userData.dynamic = true; m.frustumCulled = true;
    g.add(m);
  }
  piv.children.forEach(c => { if (!c.userData.door2) c.visible = false; });
  piv.add(g);
  return { base: piv.position.x, baseZ: piv.position.z, dir: toPlusX ? -1 : 1, W };
}

export function isSchoolDoorTarget(d) {
  return !!(d && d.leaves && d.leaves.length === 2 && FLOORS.has(d.floor) && !SKIP_ROOM.test(d.rt || '') && !d.stall && d.name !== '현관문');
}
export async function installSchoolDoors(world) {
  const kit = await loadKit();
  let n = 0;
  for (const d of world.doorList) {
    if (d.name === '현관문' && kit.entKit && !d.entInstalled) {
      d.leaves.forEach(l => fitLeaf(kit.entKit, l.piv, true));
      d.entInstalled = true;
      continue;
    }
    if (!isSchoolDoorTarget(d) || d.door2) continue;
    let ok = true; d.leaves.forEach(l => { const r = fitLeaf(kit, l.piv); if (r) { l.slide = r; l.a = 0; l.piv.rotation.y = 0; } else ok = false; });
    if (ok) { d.door2 = true; n++; }
  }
  window.__door2Count = n;
  return n;
}

export function updateSchoolDoors(world) {
  for (const d of world.doorList) {
    if (!d.door2) continue;
    const t = d.open, e = t * t * (3 - 2 * t);
    if (d._slideE === e) continue; d._slideE = e;
    for (const l of d.leaves) { if (!l.slide) continue; l.piv.rotation.y = 0; l.piv.position.x = l.slide.base + l.slide.dir * e * l.slide.W * .96; const bz = l.slide.baseZ; if (Math.abs(bz) > 1.2 && Math.abs(bz) < 2.2) l.piv.position.z = bz - Math.sign(bz) * .1 * Math.min(1, e * 4); }
  }
}
