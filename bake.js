// 정적 지오메트리 배칭 — 수천 개의 개별 메시를 "재질 × 공간 청크" 단위로 합쳐 draw call 을 크게 줄인다.
// userData.dynamic 이 붙은 오브젝트(문, 아이템, 금고 문 등)와 InstancedMesh·Sprite 는 건드리지 않는다.
import * as THREE from './vendor/three.module.js';

const CHUNK = 18;
const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3();

function isDynamic(o, root) {
  for (let a = o; a && a !== root; a = a.parent) if (a.userData.dynamic) return true;
  return false;
}

export function bakeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map(), victims = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || !o.visible) return;
    if (isDynamic(o, root)) return;
    const g = o.geometry;
    if (!g.attributes.position || !g.attributes.normal) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    _v.setFromMatrixPosition(m);
    const key = o.material.uuid + '|' + Math.floor(_v.x / CHUNK) + ',' + Math.floor(_v.z / CHUNK) + ',' + Math.floor(_v.y / 8);
    let e = groups.get(key);
    if (!e) groups.set(key, e = { mat: o.material, list: [], cast: o.castShadow !== false, verts: 0 });
    e.list.push({ g, m }); e.verts += g.attributes.position.count;
    victims.push(o);
  });
  for (const o of victims) o.parent.remove(o);
  let made = 0;
  for (const e of groups.values()) {
    const pos = new Float32Array(e.verts * 3), nor = new Float32Array(e.verts * 3), uv = new Float32Array(e.verts * 2);
    const idx = [];
    let off = 0;
    for (const { g, m } of e.list) {
      const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      _n.getNormalMatrix(m);
      const flip = m.determinant() < 0;
      for (let i = 0; i < p.count; i++) {
        _v.fromBufferAttribute(p, i).applyMatrix4(m); pos.set([_v.x, _v.y, _v.z], (off + i) * 3);
        _v.fromBufferAttribute(n, i).applyMatrix3(_n).normalize(); nor.set([_v.x, _v.y, _v.z], (off + i) * 3);
        if (u) { uv[(off + i) * 2] = u.getX(i); uv[(off + i) * 2 + 1] = u.getY(i); }
      }
      if (g.index) {
        const a = g.index.array;
        for (let i = 0; i < a.length; i += 3) flip ? idx.push(a[i] + off, a[i + 2] + off, a[i + 1] + off) : idx.push(a[i] + off, a[i + 1] + off, a[i + 2] + off);
      } else for (let i = 0; i < p.count; i += 3) flip ? idx.push(off + i, off + i + 2, off + i + 1) : idx.push(off + i, off + i + 1, off + i + 2);
      off += p.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(off > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, e.mat);
    const basic = e.mat.isMeshBasicMaterial || e.mat.transparent;
    mesh.castShadow = !basic && e.cast; mesh.receiveShadow = !basic;
    mesh.userData.baked = true;
    root.add(mesh); made++;
  }
  // 빈 그룹 정리
  const empties = [];
  root.traverse(o => { if (o !== root && o.isGroup && !o.children.length && !o.userData.dynamic) empties.push(o); });
  empties.forEach(o => o.parent && o.parent.remove(o));
  return { merged: victims.length, meshes: made };
}

// 처음 방문할 때 생기는 끊김(텍스처 업로드·셰이더 컴파일)을 로딩 중에 미리 처리한다.
export function warmUp(renderer, scene, camera, groups) {
  const vis = groups.map(g => g.visible);
  groups.forEach(g => { g.visible = true; });
  const seen = new Set();
  scene.traverse(o => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) for (const k of ['map', 'bumpMap', 'alphaMap', 'emissiveMap']) {
      const t = m[k]; if (t && !seen.has(t)) { seen.add(t); if (t.image) renderer.initTexture(t); }
    }
  });
  try { renderer.compile(scene, camera); } catch (e) { /* ignore */ }
  // 그림자 패스용 셰이더는 compile() 로 만들어지지 않으므로, 컬링을 끄고 실제로 한 프레임을 그려 둔다
  const culled = [];
  scene.traverse(o => { if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
  // 아주 작은 영역에만 그려서 셰이더·그림자 프로그램만 만들고 비용은 최소화
  const vp = new THREE.Vector4(); renderer.getViewport(vp);
  const sh = [];
  scene.traverse(o => { if (o.isLight && o.shadow && o.castShadow) { sh.push([o, o.shadow.mapSize.x]); o.shadow.mapSize.set(16, 16); if (o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; } } });
  renderer.setScissorTest(true); renderer.setScissor(0, 0, 2, 2); renderer.setViewport(0, 0, 2, 2);
  try { renderer.render(scene, camera); } catch (e) { /* ignore */ }
  renderer.setScissorTest(false); renderer.setViewport(vp);
  sh.forEach(([o, s]) => { o.shadow.mapSize.set(s, s); if (o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; } });
  culled.forEach(o => { o.frustumCulled = true; });
  groups.forEach((g, i) => { g.visible = vis[i]; });
}
