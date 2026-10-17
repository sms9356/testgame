import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {cloneV6,batchV6,localBounds,guardDoorSweepContains} from '../guardRoomV6.js';
import {installGuardRoom} from '../guardRoom.js';
import {readFile} from 'node:fs/promises';
test('batch preserves shared PBR, maps, attributes and source geometry',()=>{
 const source=new THREE.Group(), texture=new THREE.Texture(), mat=new THREE.MeshStandardMaterial({map:texture,color:0x123456});
 for(let i=0;i<12;i++){const geometry=new THREE.BoxGeometry(.2,.3,.4);geometry.clearGroups();geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count*4).fill(.5),4));const mesh=new THREE.Mesh(geometry,mat);mesh.position.x=i*.3;source.add(mesh);}
 const original=source.children[0].geometry, root=cloneV6(source);assert.equal(root.children[0].material,root.children[1].material);assert.notEqual(root.children[0].material,mat);assert.equal(root.children[0].material.map,texture);
 const before=localBounds(root), result=batchV6(root);assert.equal(result.before,12);assert.equal(result.after,1);assert.ok(before.min.distanceTo(result.bounds.min)<1e-6);assert.ok(before.max.distanceTo(result.bounds.max)<1e-6);assert.equal(root.children[0].geometry.attributes.color.itemSize,4);assert.equal(source.children.length,12);assert.equal(source.children[0].geometry,original);assert.equal(mat.color.getHex(),0x123456);
});
test('v6 retains shell and entrance, three CCTV screens, and pre-load door state',async()=>{
 const source=new THREE.Group(), group=new THREE.Group();group.name='F10_GROUP';source.add(group);
 for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.18348,.008,.189),new THREE.MeshStandardMaterial());m.position.set(.932+i*.198,1.11,1.0524);m.name='F10_'+i+'_smudged_monitor_screen';group.add(m);}
 const scene=new THREE.Scene(), holder=new THREE.Group(), fallback=new THREE.Group(), pivot=new THREE.Group();scene.add(holder,fallback);holder.position.set(4.75,.02,67.9);pivot.position.set(6.55,.02,68.01);fallback.add(pivot);
 const leaf=new THREE.Mesh(new THREE.BoxGeometry(.85,2.05,.05),new THREE.MeshStandardMaterial());leaf.geometry.translate(.425,1.025,0);pivot.add(leaf);
 const shell=new THREE.Group();shell.name='SHELL_EAST';const furniture=new THREE.Group();furniture.name='F01_OLD';fallback.add(shell,furniture);
 const room={holder,fallback,fallbackDoorPivot:pivot,doorCollider:{off:false},ceilingCover:false,layout:{doorX:6.55,doorZ:68.01}};
 const texture=new THREE.Texture(), api=installGuardRoom({scene,camera:new THREE.Camera(),guardRoom:room,cctvTexture:texture,loader:{loadAsync:async()=>({scene:source})},frame:async()=>{}});
 api.applyState({doorOpen:true,cctvOn:true});api.tick(1);await api.ready;assert.equal(api.status,'ready');assert.equal(api.refs.screens.length,3);assert.equal(shell.visible,true);assert.equal(pivot.visible,true);assert.equal(furniture.visible,false);for(const s of api.refs.screens)assert.equal(s.material.map,texture);assert.equal(room.doorCollider.off,false);assert.ok(Math.abs(room.doorCollider.x2-room.doorCollider.x1-.05)<1e-5);
 api.applyState({doorOpen:false,cctvOn:false});api.tick(1);assert.ok(Math.abs(room.doorCollider.x2-room.doorCollider.x1-.85)<1e-5);for(const s of api.refs.screens)assert.equal(s.material.map,null);
 const saved={...room.doorCollider};api.tick(.016);assert.deepEqual(room.doorCollider,saved);
});
test('door sweep and FL integration',async()=>{
 const layout={doorX:6.55,doorZ:68.01};assert.equal(guardDoorSweepContains(layout,{x:6.8,z:68.3,floor:0}),true);assert.equal(guardDoorSweepContains(layout,{x:5,z:69,floor:0}),false);
 const game=await readFile(new URL('../game.js',import.meta.url),'utf8');assert.match(game,/doorOpen: FL.guardDoorOpen \?\? true/);assert.match(game,/k === 'guarddoor'/);assert.match(game,/canClose\(P\)/);assert.match(game,/guardRoomController\?\.closing/);
});

test('bundled v6 has 37 colored prop groups and authored mesh attributes',async()=>{const b=await readFile(new URL('../assets/guardroom/guardroom_v6.glb',import.meta.url));assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(4),2);assert.ok(b.length<30*1024*1024);const gl=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString('utf8').trim());assert.equal(gl.nodes.filter(n=>/^F\d{2}_GROUP$/.test(n.name)).length,37);assert.equal(gl.meshes.length,1130);assert.ok(gl.images.filter(i=>i.bufferView!=null).length>=24);for(const m of gl.meshes)for(const p of m.primitives){assert.ok(p.attributes.POSITION!=null);assert.ok(p.attributes.TEXCOORD_0!=null);}});
test('missing normals repaired only on clone while UV and original stay intact',()=>{const s=new THREE.Group(),g=new THREE.BoxGeometry(1,1,1);g.deleteAttribute('normal');const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({flatShading:true}));s.add(m);const c=cloneV6(s);assert.equal(g.getAttribute('normal'),undefined);assert.ok(c.children[0].geometry.getAttribute('normal'));assert.ok(c.children[0].geometry.getAttribute('uv'));assert.equal(c.children[0].material.flatShading,false);});
