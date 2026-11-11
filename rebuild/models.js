// 실사 소품 모델(Poly Haven CC0, assets/models/<name>/<name>.gltf · sf_ 팩은 assets/models/sf/<name>.glb)을 이름별 InstancedMesh 로 배치한다
//   list: [{ name, x, y, z, ry, s }]  — 같은 모델 수백 개(책상 · 의자)도 드로콜 몇 개로 끝난다
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { retexSchoolModel } from './modelRetex.js?v=430';

const loader = new GLTFLoader();
const cache = {};
const url = name => name.startsWith('sf_') ? `../assets/models/sf/${name}.glb` : name.includes('/') ? `../assets/models/${name}.glb` : `../assets/models/${name}/${name}.gltf`;   // 'h133/CLS-014' 처럼 폴더/이름 이면 .glb
const load = name => cache[name] || (cache[name] = new Promise((res, rej) => loader.load(new URL(url(name), import.meta.url).href, g => { retexSchoolModel(name, g.scene); res(g.scene); }, undefined, rej)));
// 같은 모델 수십 개가 똑같은 색이면 복제품처럼 보인다 → 위치로 정한 아주 작은 명도 · 색 차이 (instanceColor 하나, 비용 거의 없음)
const VARY = { SchoolDesk_01: .07, SchoolChair_01: .08, metal_trash_can: .06 };
const _c = new THREE.Color();
const hash = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

// floorH 를 주면 층별로 따로 InstancedMesh 를 만든다 (im.userData.rbFloor) — 지금 층만 그리기 위해
export function placeModels(parent, list, { shadows = true, floorH = 0 } = {}) {
  const byName = new Map(); for (const m of list) { const k = floorH ? m.name + '|' + Math.max(0, Math.floor((m.y + .3) / floorH)) : m.name; (byName.get(k) || byName.set(k, []).get(k)).push(m); }
  const jobs = [];
  for (const [key, items] of byName) { const name = items[0].name, fl = floorH ? +key.split('|')[1] : null; jobs.push(load(name).then(src => {
    src.updateMatrixWorld(true);
    const _m = new THREE.Matrix4(), _p = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    src.traverse(o => {
      if (!o.isMesh) return;
      const im = new THREE.InstancedMesh(o.geometry, o.material, items.length), vary = VARY[name];
      items.forEach((it, i) => { q.setFromEuler(e.set(it.rx || 0, it.ry || 0, it.rz || 0)); _p.compose(v.set(it.x, it.y, it.z), q, sc.setScalar(it.s || 1)); _m.multiplyMatrices(_p, o.matrixWorld); im.setMatrixAt(i, _m);
        if (vary) { const a = hash(it.x, it.z), b = hash(it.z + 3.1, it.x - 7.7), l = 1 - vary + a * vary; _c.setRGB(l, l * (1 - (b - .5) * vary * .5), l * (1 - (b - .3) * vary)); im.setColorAt(i, _c); } });
      im.castShadow = shadows; im.receiveShadow = true; im.name = 'RBM_' + name; im.userData.rbFloor = fl; im.computeBoundingSphere(); parent.add(im);
    });
  }).catch(e => console.warn('[rebuild model]', name, e && e.message))); }
  return Promise.all(jobs);
}
