import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';

// 학교 양개 여닫이문 (사용자 제공 School_DoubleDoor_01 · 문짝 GLB 2개, 텍스처는 공용 JPG로 줄임)
// 기존 문 시스템(경첩 피벗 · 충돌 · 저장 · 애니메이션)은 그대로 두고, 피벗 안의 단순 판 문짝만 이 모델로 바꿔 끼운다.
// 제외: 교문 · 화장실 · 창고 · 본관 B1 · 체육관 · 급식실 · 수영장 · 경비실 · 옥상문 (본관 0~2층 · 별관 8~10층의 양문만 대상)
const BASE = 'assets/models/door2/';
const FLOORS = new Set([0, 1, 2, 8, 9, 10]);
const SKIP_ROOM = /^(toilet|storage|storeS|cleaning)$/;
const KEEP = { front: 1, back: 1, glass: 1 };

// 원본 58개 메시 → 재질 묶음별 한 덩어리 (문짝 하나에 5~6 draw call)
function bucketOf(m) {
  const n = m.name || '';
  if (m.transparent || /glaz|glass/i.test(n)) return 'glass';
  if (/PHOTO_oak_front/i.test(n)) return 'front';
  if (/Oak_side_back/i.test(n)) return 'back';
  if (/alumin|lock|stainless|metal/i.test(n)) return 'metal';
  if (/rubber|seal|join|dark/i.test(n)) return 'dark';
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
  if (KEEP[k]) { const m = src.clone(); if (k === 'glass') { m.transparent = true; m.opacity = Math.min(m.opacity ?? 1, .35); m.depthWrite = false; } return m; }
  return new THREE.MeshStandardMaterial({ color: src.color.clone(), roughness: src.roughness, metalness: src.metalness });
}

let READY = null;
function loadKit() {
  if (READY) return READY;
  const L = new GLTFLoader(), mats = {};
  READY = Promise.all(['left.glb', 'right.glb'].map(f => L.loadAsync(BASE + f))).then(([l, r]) => ({ left: packLeaf(l.scene, mats), right: packLeaf(r.scene, mats), mats }));
  return READY;
}

function fitLeaf(kit, piv) {
  const old = piv.children.find(c => c.isMesh && !c.userData.door2);
  if (!old) return false;
  if (!old.geometry.boundingBox) old.geometry.computeBoundingBox();
  const ob = old.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().compose(old.position, old.quaternion, old.scale));
  const toPlusX = (ob.min.x + ob.max.x) / 2 > 0;   // 경첩에서 +x 쪽으로 뻗는 문짝 = 왼쪽 문짝 모델
  const src = toPlusX ? kit.left : kit.right, mb = src.box;
  const W = ob.max.x - ob.min.x, H = ob.max.y - ob.min.y, mw = mb.max.x - mb.min.x, mh = mb.max.y - mb.min.y;
  const g = new THREE.Group(); g.userData.door2 = true; g.userData.dynamic = true;
  g.scale.set(W / mw, H / mh, 1);
  g.position.set(toPlusX ? ob.min.x - mb.min.x * W / mw : ob.max.x - mb.max.x * W / mw, ob.min.y - mb.min.y * H / mh, (ob.min.z + ob.max.z) / 2 - (mb.min.z + mb.max.z) / 2);
  for (const [k, geo] of Object.entries(src.geos)) { const m = new THREE.Mesh(geo, kit.mats[k]); m.castShadow = k === 'front' || k === 'back'; m.receiveShadow = true; m.userData.dynamic = true; m.frustumCulled = true; g.add(m); }
  // 예전 판 문짝 · 손잡이는 숨긴다 (첫 자식은 열린 문 충돌 상자 계산에 계속 쓰인다)
  piv.children.forEach(c => { if (!c.userData.door2) c.visible = false; });
  piv.add(g);
  return true;
}

export function isSchoolDoorTarget(d) {
  return !!(d && d.leaves && d.leaves.length === 2 && FLOORS.has(d.floor) && !SKIP_ROOM.test(d.rt || '') && !d.stall);
}
export async function installSchoolDoors(world) {
  const kit = await loadKit();
  let n = 0;
  for (const d of world.doorList) {
    if (!isSchoolDoorTarget(d) || d.door2) continue;
    let ok = true; d.leaves.forEach(l => { ok = fitLeaf(kit, l.piv) && ok; });
    if (ok) { d.door2 = true; n++; }
  }
  window.__door2Count = n;
  return n;
}
