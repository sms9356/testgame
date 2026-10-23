// 실사 소품 모델(Poly Haven CC0, assets/models/<name>/<name>.gltf)을 이름별 InstancedMesh 로 배치한다
//   list: [{ name, x, y, z, ry, s }]  — 같은 모델 수백 개(책상 · 의자)도 드로콜 몇 개로 끝난다
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = {};
const load = name => cache[name] || (cache[name] = new Promise((res, rej) => loader.load(new URL(`../assets/models/${name}/${name}.gltf`, import.meta.url).href, g => res(g.scene), undefined, rej)));

export function placeModels(parent, list, { shadows = true } = {}) {
  const byName = new Map(); for (const m of list) (byName.get(m.name) || byName.set(m.name, []).get(m.name)).push(m);
  const jobs = [];
  for (const [name, items] of byName) jobs.push(load(name).then(src => {
    src.updateMatrixWorld(true);
    const _m = new THREE.Matrix4(), _p = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    src.traverse(o => {
      if (!o.isMesh) return;
      const im = new THREE.InstancedMesh(o.geometry, o.material, items.length);
      items.forEach((it, i) => { q.setFromEuler(e.set(it.rx || 0, it.ry || 0, it.rz || 0)); _p.compose(v.set(it.x, it.y, it.z), q, sc.setScalar(it.s || 1)); _m.multiplyMatrices(_p, o.matrixWorld); im.setMatrixAt(i, _m); });
      im.castShadow = shadows; im.receiveShadow = true; im.name = 'RBM_' + name; im.computeBoundingSphere(); parent.add(im);
    });
  }).catch(e => console.warn('[rebuild model]', name, e && e.message)));
  return Promise.all(jobs);
}
