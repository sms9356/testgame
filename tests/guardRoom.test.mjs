// Run in repository: node --test guardRoom.test.mjs
// Or TESTGAME_ROOT=/checkout node --test /path/to/guardRoom.test.mjs
// Actual Three classes, no DOM/WebGL/network. GLB integration runs when asset is present.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.env.TESTGAME_ROOT || process.cwd());
const THREE = await import(pathToFileURL(path.join(root,'vendor/three.module.js')).href);
const { installGuardRoom } = await import(pathToFileURL(path.join(root,'guardRoom.js')).href);
const { GLTFLoader } = await import(pathToFileURL(path.join(root,'vendor/addons/loaders/GLTFLoader.js')).href);
const near = (a,b,e=1e-5) => assert.ok(Math.abs(a-b)<e, `${a} != ${b}`);
function fixture() {
  const scene = new THREE.Group();
  const box = (name,min,max) => {
    const size = new THREE.Vector3().subVectors(max,min);
    const g = new THREE.BoxGeometry(size.x,size.y,size.z);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    const color = new Float32Array(g.getAttribute('position').count*4).fill(1);
    for(let i=3;i<color.length;i+=4) color[i]=0.7;
    g.setAttribute('color',new THREE.BufferAttribute(color,4));
    const m = new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true}));
    m.name=name; m.position.copy(min).add(max).multiplyScalar(.5); scene.add(m); return m;
  };
  const v = (x,y,z) => new THREE.Vector3(x,y,z);
  box('SHELL_FLOOR',v(0,0,-.15),v(3.5,2.8,0));
  box('SHELL_WALL_NORTH',v(0,2.7,0),v(3.5,2.8,2.5));
  box('ENTRANCE_DOOR',v(1.8,-.135,0),v(2.65,-.085,2.05));
  box('ENTRANCE_HANDLE',v(2.5,-.19,.95),v(2.6,-.135,1.05));
  box('F10_CCTV_MONITOR',v(.675,1.0575,.855),v(1.305,1.1225,1.225));
  box('WINDOW_NORTH_GLASS',v(.5,2.7,1),v(1.5,2.71,2));
  box('WINDOW_WEST_GLASS',v(0,.5,1),v(.01,1.5,2));
  for(const name of ['F01_DESK','F03_CABINET','F05_CHAIR']) box(name,v(.1,.1,.1),v(.2,.2,.2));
  return scene;
}
function environment(source=fixture(),extra={}) {
  const scene=new THREE.Scene(), holder=new THREE.Group(), fallback=new THREE.Group();
  scene.add(holder); holder.position.set(20,.02,66.4); holder.add(fallback);
  const guardRoom={holder,fallback,doorCollider:{x1:21.8,x2:22.65,z1:66.485,z2:66.535,off:false,tag:'preserved'},ceilingCover:false,fallbackDoorPivot:new THREE.Group(),...extra};
  const events=[];
  const renderer={initTexture:()=>events.push('texture'),compileAsync:async()=>{assert.equal(fallback.visible,true);events.push('compile');}};
  const cctvTexture=new THREE.Texture();
  const api=installGuardRoom({renderer,scene,camera:new THREE.PerspectiveCamera(),guardRoom,cctvTexture,loader:{loadAsync:async url=>{assert.equal(url,'assets/guardroom/guardroom.glb'); return {scene:source};}},frame:async()=>events.push('frame')});
  return {api,guardRoom,source,events,cctvTexture,renderer};
}
test('source axes, intentional negative slab, anchor and all named nodes survive',async()=>{
  const e=environment(); await e.api.ready;
  assert.equal(e.api.status,'ready'); assert.equal(e.guardRoom.fallback.visible,false);
  near(e.api.model.rotation.x,-Math.PI/2);
  e.guardRoom.holder.updateMatrixWorld(true);
  const floor=new THREE.Box3().setFromObject(e.api.refs.nodes.SHELL_FLOOR);
  near(floor.min.x,20); near(floor.max.x,23.5); near(floor.min.z,63.6); near(floor.max.z,66.4);
  near(floor.max.y,.02); near(floor.min.y,-.13);
  const full=new THREE.Box3().setFromObject(e.api.model); near(full.max.y,2.52);
  e.source.traverse(n=>{if(n.name) assert.ok(e.api.refs.nodes[n.name]);});
  assert.deepEqual(e.events.filter(x=>x!=='texture'),['frame','frame','compile','frame']);
});
test('door is attached without translation jumps; outward raw-Z hinge updates world collider',async()=>{
  const e=environment(); const closed={...e.guardRoom.doorCollider}; await e.api.ready;
  const p=e.api.refs.doorPivot; near(p.position.x,1.8);near(p.position.y,-.11);near(p.position.z,0);
  e.api.model.updateMatrixWorld(true);
  const c=e.guardRoom.doorCollider; near(c.x1,21.8);near(c.x2,22.65);near(c.z1,66.485);near(c.z2,66.535);
  assert.equal(c.tag,'preserved'); assert.equal(c,e.guardRoom.doorCollider);
  assert.equal(e.api.refs.handle.parent,p); assert.equal(c.off,false);
  e.api.applyState({doorOpen:true});e.api.tick(1);
  near(p.rotation.z,-Math.PI/2);near(c.x1,21.775);near(c.x2,21.825);near(c.z1,66.51);near(c.z2,67.36);
  assert.equal(c.tag,'preserved');
  assert.notDeepEqual(c,closed);
  e.api.applyState({doorOpen:false});e.api.tick(1);near(c.x1,21.8);near(c.x2,22.65);near(c.z2-c.z1,.05);
});
test('state applied before load persists; screen texture is read-only and light stays visible',async()=>{
  const e=environment(); const textureVersion=e.cctvTexture.version;
  e.api.applyState({lightOn:true,cctvOn:true,doorOpen:true});e.api.tick(1);
  near(e.guardRoom.fallbackDoorPivot.rotation.y,-Math.PI/2);
  await e.api.ready;
  assert.equal(e.api.refs.screen.material.map,e.cctvTexture);near(e.api.refs.light.intensity,.8);
  assert.equal(e.api.refs.light.visible,true); assert.equal(e.api.refs.screen.castShadow,false);assert.equal(e.api.refs.lamp.castShadow,false);
  near(e.api.refs.lamp.position.y,2.475);near(e.api.refs.light.position.y,2.2);
  near(e.api.refs.lamp.position.y + .035/2,2.4925);
  near(e.api.refs.doorPivot.rotation.z,-Math.PI/2);
  const n=new THREE.Vector3(0,0,1).applyQuaternion(e.api.refs.screen.quaternion);near(n.y,-1);
  e.api.applyState({lightOn:false,cctvOn:false});assert.equal(e.api.refs.screen.material.map,null);near(e.api.refs.light.intensity,0);
  assert.equal(e.api.refs.light.visible,true);assert.equal(e.cctvTexture.version,textureVersion);
});
test('normals repaired and UV added only on clones; RGBA colors and existing attributes preserved',async()=>{
  const source=fixture(), wood=source.getObjectByName('F01_DESK');
  const uv=new THREE.BufferAttribute(new Float32Array(wood.geometry.getAttribute('position').count*2).fill(.123),2);wood.geometry.setAttribute('uv',uv);
  const texture=new THREE.Texture(), template=new THREE.MeshStandardMaterial({map:texture});
  const orig=source.getObjectByName('SHELL_FLOOR'), bytes=Array.from(orig.geometry.getAttribute('color').array);
  const e=environment(source,{templates:{floor:template,wall:template,wood:template,metal:template,fabric:template}});await e.api.ready;
  assert.equal(orig.geometry.getAttribute('normal'),undefined);assert.equal(orig.geometry.getAttribute('uv'),undefined);
  assert.deepEqual(Array.from(orig.geometry.getAttribute('color').array),bytes);
  const floor=e.api.refs.nodes.SHELL_FLOOR;assert.ok(floor.geometry.getAttribute('normal'));assert.ok(floor.geometry.getAttribute('uv'));
  assert.equal(floor.geometry.getAttribute('color').itemSize,4);assert.notEqual(floor.material,template);assert.equal(floor.material.map,texture);
  assert.equal(floor.material.vertexColors,false);
  for(const [name,divisor] of [['SHELL_FLOOR',4],['SHELL_WALL_NORTH',2],['F03_CABINET',1],['F05_CHAIR',1]]) {
    const mesh=e.api.refs.nodes[name],g=mesh.geometry;g.computeBoundingBox();
    const size=g.boundingBox.getSize(new THREE.Vector3());
    const axes=['x','y','z'].sort((a,b)=>size[b]-size[a]);
    const p=g.getAttribute('position'),generated=g.getAttribute('uv');
    const coord=(i,axis)=>axis==='x'?p.getX(i):axis==='y'?p.getY(i):p.getZ(i);
    for(let i=0;i<p.count;i++){near(generated.getX(i),coord(i,axes[0])/divisor);near(generated.getY(i),coord(i,axes[1])/divisor);}
    assert.equal(mesh.material.vertexColors,false);assert.equal(g.getAttribute('color').itemSize,4);
    assert.equal(source.getObjectByName(name).geometry.getAttribute('uv'),undefined);
  }
  const woodUV=e.api.refs.nodes.F01_DESK.geometry.getAttribute('uv');
  for(let i=0;i<woodUV.count;i++){near(woodUV.getX(i),.123);near(woodUV.getY(i),.123);}
  assert.equal(wood.geometry.getAttribute('uv'),uv);assert.equal(uv.getX(0),woodUV.getX(0));
  assert.equal(e.api.refs.nodes.F01_DESK.material.vertexColors,false);
  assert.equal(template.vertexColors,false);
  for(const name of ['WINDOW_NORTH_GLASS','WINDOW_WEST_GLASS']) {
    const glass=e.api.refs.nodes[name];assert.equal(glass.material.transparent,true);assert.equal(glass.material.depthWrite,false);assert.equal(glass.geometry.getAttribute('color').itemSize,4);assert.equal(glass.material.vertexColors,true);assert.equal(glass.castShadow,false);
  }
});
test('load and shader failures preserve fallback and closed collision',async()=>{
  for(const fail of ['load','compile']) {
    const scene=new THREE.Scene(),holder=new THREE.Group(),fallback=new THREE.Group();scene.add(holder);holder.add(fallback);
    const collider={x1:21.8,x2:22.65,z1:66.485,z2:66.535,off:false,tag:'preserved'},before={...collider};
    const api=installGuardRoom({scene,camera:new THREE.Camera(),guardRoom:{holder,fallback,doorCollider:collider},frame:async()=>{},loader:{loadAsync:async()=>{if(fail==='load')throw new Error('load failed');return {scene:fixture()};}},renderer:{compileAsync:async()=>{throw new Error('compile failed');}}});
    await api.ready;assert.equal(api.status,'error');assert.ok(api.error);assert.equal(fallback.visible,true);assert.equal(api.model,null);assert.deepEqual(collider,before);assert.equal(holder.children.length,1);
  }
});
test('actual supplied GLB: every named node and source attributes survive',async t=>{
  let data;try{data=await readFile(path.join(root,'assets/guardroom/guardroom.glb'));}catch(err){if(err.code==='ENOENT'){t.skip('Upload assets/guardroom/guardroom.glb to enable actual-asset integration');return;}throw err;}
  const buffer=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
  const gltf=await new GLTFLoader().parseAsync(buffer,'');
  const names=[],saved=[];gltf.scene.traverse(n=>{if(n.name)names.push(n.name);if(n.isMesh)saved.push([n,n.geometry,Object.fromEntries(Object.entries(n.geometry.attributes).map(([k,a])=>[k,Array.from(a.array)]))]);});
  const e=environment(gltf.scene);await e.api.ready;assert.equal(e.api.status,'ready');
  for(const name of names)assert.ok(e.api.refs.nodes[name],name);
  for(const name of ['ENTRANCE_DOOR','ENTRANCE_HANDLE','F10_CCTV_MONITOR','WINDOW_NORTH_GLASS','WINDOW_WEST_GLASS'])assert.ok(e.api.refs.nodes[name],name);
  for(const [n,g,attrs] of saved){assert.equal(n.geometry,g);for(const [k,values] of Object.entries(attrs))assert.deepEqual(Array.from(g.attributes[k].array),values);}
  e.guardRoom.holder.updateMatrixWorld(true);near(new THREE.Box3().setFromObject(e.api.model).max.y,2.52);
});
