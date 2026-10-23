import { cloneV6, batchV6, guardDoorSweepContains, localBounds } from './guardRoomV6.js';
import { arrangeGuardRoomV6 } from './guardRoomV6Layout.js';
import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';
import { toCreasedNormals } from './vendor/addons/utils/BufferGeometryUtils.js';

const URL = 'assets/guardroom/guardroom_v6.glb';
const nextFrame = () => new Promise(resolve => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(resolve);
  else resolve();
});
const load = (loader) => loader.loadAsync ? loader.loadAsync(URL)
  : new Promise((resolve, reject) => loader.load(URL, resolve, undefined, reject));
const hasMaps = material => material && ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap'].some(k => material[k]);
function templateKind(name) {
  if (/SHELL.*FLOOR|FLOOR.*SHELL/i.test(name)) return 'floor';
  if (/SHELL/i.test(name)) return 'wall';
  if (/^F01(?:_|$)/i.test(name)) return 'wood';
  if (/^F03(?:_|$)/i.test(name)) return 'metal';
  if (/^F05(?:_|$)/i.test(name)) return 'fabric';
  return null;
}
// Planar coordinates use the two largest extents and template tile size in metres.
function addPlanarUV(geometry, tileMetres = 1) {
  if (geometry.getAttribute('uv')) return;
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new THREE.Vector3());
  const axes = ['x','y','z'].sort((a,b) => size[b] - size[a]);
  const p = geometry.getAttribute('position'), values = new Float32Array(p.count * 2);
  const get = (i, axis) => axis === 'x' ? p.getX(i) : axis === 'y' ? p.getY(i) : p.getZ(i);
  for (let i=0; i<p.count; i++) { values[i*2]=get(i,axes[0])/tileMetres; values[i*2+1]=get(i,axes[1])/tileMetres; }
  geometry.setAttribute('uv', new THREE.BufferAttribute(values,2));
}
function cloneModel(source, templates) {
  const result = source.clone(true);
  result.traverse(node => {
    node.userData = { ...node.userData, dynamic: true };
    if (!node.isMesh) return;
    // Never mutate cached loader geometries or materials.
    let geometry = node.geometry.clone();
    const repairedNormals = !geometry.getAttribute('normal');
    if (repairedNormals) {
      const repaired = toCreasedNormals(geometry, Math.PI / 3);
      if (repaired !== geometry) geometry.dispose();
      geometry = repaired;
    }
    const kind = templateKind(node.name), template = templates?.[kind];
    const mappedTemplate = hasMaps(template);
    if (mappedTemplate) addPlanarUV(geometry, kind === 'floor' ? 4 : kind === 'wall' ? 2 : 1);
    node.geometry = geometry;
    const glass = /WINDOW_(NORTH|WEST)_GLASS/i.test(node.name);
    const cloneMaterial = original => {
      const material = (mappedTemplate ? template : original).clone();
      material.vertexColors = !mappedTemplate && !!geometry.getAttribute('color');
      if (repairedNormals && material.flatShading) material.flatShading = false;
      if (glass) { material.transparent = true; material.depthWrite = false; }
      material.needsUpdate = true;
      return material;
    };
    node.material = Array.isArray(node.material) ? node.material.map(cloneMaterial) : cloneMaterial(node.material);
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    node.castShadow = node.receiveShadow = mats.every(m => !m.transparent && m.opacity >= 1);
    node.matrixAutoUpdate = true;
  });
  return result;
}

/** Source is metres, Z-up. holder is already anchored by world.js; no bbox grounding.
 * ready resolves to this controller on success OR failure; inspect status/error.
 * templates are optional THREE materials (texture references remain shared/read-only).
 * frame is an optional async yield function, loader is an optional GLTFLoader-shaped object.
 */
export function installGuardRoom({ renderer, scene, camera, guardRoom, cctvTexture, loader = new GLTFLoader(), frame = nextFrame }) {
  if (!guardRoom?.holder) throw new Error('guardRoom.holder is required');
  const holder = guardRoom.holder;
  const state = { cctvOn: false, lightOn: false, doorOpen: false };
  const refs = { nodes: {}, doorPivot: null, screen: null, lamp: null, light: null, ceiling: null };
  let status = 'loading', error = null, model = null, sourceRoot = null;
  let v6 = false, diagnostics = null, doorColliderDirty = true;
  let doorAngle = 0, screenOn = null, screenOff = null, liveScreenMaterials = [];
  const doorBox = new THREE.Box3();
  const controller = {
    ready: null,
    get status() { return status; }, get error() { return error; },
    get model() { return model; }, get diagnostics() { return diagnostics; }, get closing() { return !state.doorOpen && doorAngle > 0; }, refs,
    canClose(player) { return !guardDoorSweepContains(guardRoom.layout || {doorX:6.55,doorZ:68.01}, player); },
    setLiveTextures(textures = []) {
      liveScreenMaterials.forEach(m => m.dispose());
      liveScreenMaterials = textures.slice(0,3).map(map => new THREE.MeshBasicMaterial({map,color:0xe2ffe8,toneMapped:false}));
      controller.applyState(state);
    },
    applyState(values = {}) {
      for (const key of Object.keys(state)) if (values[key] !== undefined) state[key] = !!values[key];
      (refs.screens || (refs.screen ? [refs.screen] : [])).forEach((screen,i) => { screen.material = state.cctvOn ? (liveScreenMaterials[i] || (cctvTexture ? screenOn : screenOff)) : screenOff; });
      if (refs.light) refs.light.intensity = state.lightOn ? 0.8 : 0;
      if (refs.lamp) refs.lamp.material.emissiveIntensity = state.lightOn ? 1 : 0;
      return controller;
    },
    tick(dt = 0) {
      const target = state.doorOpen ? Math.PI / 2 : 0;
      // Bounded delta, smooth approach without overshoot; large dt reaches target.
      const previousAngle = doorAngle;
      doorAngle += (target-doorAngle) * Math.min(1, Math.max(0, Number.isFinite(dt) ? dt : 0) * 10);
      if (Math.abs(target-doorAngle) < 1e-5) doorAngle = target;
      if (guardRoom.fallbackDoorPivot && (v6 || status !== 'ready')) guardRoom.fallbackDoorPivot.rotation.y = -doorAngle;
      if (refs.doorPivot) refs.doorPivot.rotation.z = -doorAngle;
      if (doorColliderDirty || doorAngle !== previousAngle) { updateDoorCollider(); doorColliderDirty = false; }
    }
  };
  function updateDoorCollider() {
    const door = v6 || status !== 'ready' ? guardRoom.fallbackDoorPivot?.children[0] : refs.door;
    if (!door || !guardRoom.doorCollider) return;
    door.updateWorldMatrix(true, false);
    door.geometry.computeBoundingBox();
    doorBox.copy(door.geometry.boundingBox).applyMatrix4(door.matrixWorld);
    const c = guardRoom.doorCollider;
    c.x1 = doorBox.min.x; c.x2 = doorBox.max.x;
    c.z1 = doorBox.min.z; c.z2 = doorBox.max.z;
    c.off = false;
    refs.doorWorldBox = doorBox;
  }
  controller.applyState(guardRoom.state || {});
  controller.ready = (async () => {
    let stage;
    try {
      const gltf = await load(loader);
      if (!gltf?.scene) throw new Error('Guard room GLB contains no scene');
      v6 = !!gltf.scene.getObjectByName('F10_GROUP');
      sourceRoot = v6 ? cloneV6(gltf.scene) : cloneModel(gltf.scene, guardRoom.templates);
      const layoutReport = v6 ? arrangeGuardRoomV6(sourceRoot) : null;
      stage = new THREE.Group(); stage.name = 'GUARDROOM_LOADED';
      model = new THREE.Group(); model.name = 'GUARDROOM_Z_UP'; model.rotation.x = -Math.PI/2;
      model.add(sourceRoot); stage.add(model);
      sourceRoot.traverse(node => { if (node.name) refs.nodes[node.name] = node; });
      refs.door = sourceRoot.getObjectByName('ENTRANCE_DOOR');
      refs.handle = sourceRoot.getObjectByName('ENTRANCE_HANDLE');
      if (refs.door) {
        refs.doorPivot = new THREE.Group(); refs.doorPivot.name = 'GUARDROOM_DOOR_HINGE';
        refs.doorPivot.position.set(1.8,-0.11,0); sourceRoot.add(refs.doorPivot);
        sourceRoot.updateMatrixWorld(true);
        refs.doorPivot.attach(refs.door);
        if (refs.handle) refs.doorPivot.attach(refs.handle);
        refs.doorPivot.rotation.z = -doorAngle;
      }
      screenOff = new THREE.MeshBasicMaterial({ color: 0x080c10 });
      screenOn = new THREE.MeshBasicMaterial({ map: cctvTexture || null, color: 0xffffff, toneMapped: false });
      refs.screen = new THREE.Mesh(new THREE.PlaneGeometry(0.57,0.31), screenOff);
      refs.screen.name = 'GUARDROOM_CCTV_SCREEN'; refs.screen.position.set(0.99,1.052,1.04);
      refs.screen.rotation.x = Math.PI/2; model.add(refs.screen);
      if (v6) {
        refs.screen.removeFromParent(); refs.screens = [];
        sourceRoot.updateMatrixWorld(true);
        sourceRoot.traverse(node => {
          if (!node.isMesh || !/smudged_monitor_screen/i.test(node.name)) return;
          const b = localBounds(sourceRoot,node), size = b.getSize(new THREE.Vector3()), center = b.getCenter(new THREE.Vector3());
          const screen = new THREE.Mesh(new THREE.PlaneGeometry(size.x,size.z), screenOff);
          screen.name='GUARDROOM_CCTV_SCREEN'; screen.position.set(center.x,b.max.y+.002,center.z);
          screen.rotation.set(-Math.PI/2,0,0); model.add(screen); refs.screens.push(screen);
        });
        refs.screen = refs.screens[0] || null;
      }
      refs.lamp = new THREE.Mesh(new THREE.BoxGeometry(0.38,0.035,0.22),new THREE.MeshStandardMaterial({color:0xe8e5d8,emissive:0xffe7ba,emissiveIntensity:0}));
      if (v6 && sourceRoot.getObjectByName('F25_002_diffuser')) {
        refs.lamp.geometry.dispose(); refs.lamp.material.dispose();
        refs.lamp = sourceRoot.getObjectByName('F25_002_diffuser');
        refs.lamp.userData.dynamic = true; refs.lamp.material = refs.lamp.material.clone(); refs.lamp.material.emissive.setHex(0xffe7ba);
      }
      refs.lamp.name = 'GUARDROOM_CEILING_LAMP'; if (!v6 || !refs.lamp.parent) { refs.lamp.position.set(1.75,2.475,-1.4); stage.add(refs.lamp); }
      refs.light = new THREE.PointLight(0xffe7ba,0,5,2); refs.light.name='GUARDROOM_LOCAL_LIGHT';
      refs.light.position.set(1.75,2.2,-1.4); refs.light.layers.set(7); stage.add(refs.light);   // 카메라 레이어 밖(7): perfStabilizer 조명 풀이 대신 비춘다 — 경비실 보일 때마다 조명 수가 바뀌어 전체 셰이더가 다시 만들어지던 끊김
      // Disable when parent already provides the room's roof. Nominal top remains 2.5m.
      if (guardRoom.ceilingCover !== false) {
        const material = guardRoom.templates?.wall?.clone() || new THREE.MeshStandardMaterial({color:0xd9d5c8,side:THREE.DoubleSide});
        material.side = THREE.DoubleSide;
        refs.ceiling = new THREE.Mesh(new THREE.PlaneGeometry(3.5,2.8),material);
        refs.ceiling.name='GUARDROOM_CEILING_COVER'; refs.ceiling.rotation.x=Math.PI/2;
        refs.ceiling.position.set(1.75,2.5,-1.4); refs.ceiling.castShadow=refs.ceiling.receiveShadow=true; stage.add(refs.ceiling);
      }
      if (v6) {
        refs.furnitureBounds = {};
        sourceRoot.updateMatrixWorld(true);
        for (const entry of guardRoom.furnitureColliders || []) { const group=sourceRoot.getObjectByName(entry.id+'_GROUP'); if (group) refs.furnitureBounds[entry.id]=localBounds(sourceRoot,group); }
        diagnostics = {...batchV6(sourceRoot), layout:layoutReport}; diagnostics.sourceV6 = true;
        diagnostics.groups = Object.keys(refs.nodes).filter(n => /^F\d{2}_GROUP$/.test(n));
      }
      stage.traverse(node => { node.userData = {...node.userData,dynamic:true}; });
      controller.applyState(state);
      // Warm texture upload and shaders in a detached scene while fallback stays visible.
      await frame();
      // Compile both screen variants now so CCTV toggles do not first-use compile.
      const screenWarm = new THREE.Mesh(refs.screen?.geometry || new THREE.PlaneGeometry(.1,.1), refs.screen?.material === screenOn ? screenOff : screenOn);
      stage.add(screenWarm);
      const textures = new Set();
      stage.traverse(node => { if (!node.isMesh) return; for (const m of (Array.isArray(node.material)?node.material:[node.material])) for (const v of Object.values(m)) if (v?.isTexture) textures.add(v); });
      if (renderer?.initTexture) for (const texture of textures) renderer.initTexture(texture);
      await frame();
      const stagingScene = new THREE.Scene(); stagingScene.add(stage);
      if (renderer?.compileAsync) await renderer.compileAsync(stagingScene,camera,scene);
      else if (renderer?.compile) renderer.compile(stagingScene,camera,scene);
      await frame();
      screenWarm.removeFromParent();
      holder.add(stage);
      status = 'ready';
      controller.applyState(state); updateDoorCollider();
      if (guardRoom.fallback) {
        if (v6) {
          for (const node of guardRoom.fallback.children) node.visible = node === guardRoom.fallbackDoorPivot || /^(SHELL_|WINDOW_)/.test(node.name);
          for (const entry of guardRoom.furnitureColliders || []) {
            const group=sourceRoot.getObjectByName(entry.id+'_GROUP');
            // Groups still exist after batching: use pre-batch authored bounds captured below.
            const b=refs.furnitureBounds?.[entry.id];
            if (!b) continue;
            const c=entry.collider, origin=guardRoom.layout;
            c.x1=origin.originX+b.min.x; c.x2=origin.originX+b.max.x;
            c.z1=origin.originZ-b.max.y; c.z2=origin.originZ-b.min.y;
          }
        } else guardRoom.fallback.visible = false;
      }
      return controller;
    } catch (cause) {
      error = cause; status = 'error';
      if (stage?.parent) stage.removeFromParent();
      if (guardRoom.fallback) guardRoom.fallback.visible = true;
      model = null;
      return controller;
    }
  })();
  return controller;
}
