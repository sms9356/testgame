import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {prepareModelGeometry} from '../modelGeometry.js';
import {modelFootprint,removeDuplicateModels,overlaps} from '../placement.js';
import {loadSurfaceTexture} from '../materialTextures.js';

test('a staged material waits until its image is decoded',async()=>{
 let loaded;const texture=new THREE.Texture();const loader={load(url,onLoad){loaded=()=>{texture.image={width:2,height:2};onLoad(texture);};return texture;}};
 const t=loadSurfaceTexture(loader,'fixture.webp','BaseColor');let ready=false;t.userData.ready.then(()=>ready=true);
 await Promise.resolve();assert.equal(ready,false);assert.equal(t.image,null);
 loaded();assert.equal(await t.userData.ready,true);assert.equal(t.image.width,2);assert.equal(t.colorSpace,THREE.SRGBColorSpace);
});

test('authored UVs survive preparation and receive a separate AO channel',()=>{
 const source=new THREE.BoxGeometry(2,1,1),expected=Array.from(source.toNonIndexed().attributes.uv.array);
 const g=prepareModelGeometry(source,new THREE.Matrix4().makeTranslation(3,2,1));
 assert.deepEqual(Array.from(g.attributes.uv.array),expected);
 assert.deepEqual(Array.from(g.attributes.uv1.array),expected);
 assert.notEqual(g.attributes.uv,g.attributes.uv1);
 assert.equal(g.boundingBox.min.x,2);
});

test('missing UVs use one axis for each whole triangle including tied normals',()=>{
 const source=new THREE.BufferGeometry();source.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,-1,0,0,0,1],3));
 source.setAttribute('normal',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1],3));
 const g=prepareModelGeometry(source,new THREE.Matrix4()),u=g.attributes.uv;
 const area=(u.getX(1)-u.getX(0))*(u.getY(2)-u.getY(0))-(u.getY(1)-u.getY(0))*(u.getX(2)-u.getX(0));
 assert.ok(Math.abs(area)>.1);assert.ok(Array.from(u.array).every(Number.isFinite));
});

test('duplicate removal preserves authored stacks and other floors',()=>{
 const a={model:'SchoolDesk_01',f:0,x:0,y:0,z:0,rx:0,ry:0,rz:0,s:1};
 const list=[a,{...a},{...a,y:1},{...a,f:1}];assert.equal(removeDuplicateModels(list),1);assert.equal(list.length,3);
});

test('model footprints include authored size, rotation and scale',()=>{
 const a={model:'SchoolDesk_01',f:0,x:8,y:0,z:-5,s:1,ry:0},b=modelFootprint(a),c=modelFootprint({...a,s:2,ry:Math.PI/2});
 assert.ok(b&&c);assert.ok(Math.abs((b.x2-b.x1)*2-(c.z2-c.z1))<.001);
 assert.equal(overlaps(b,b),true);assert.equal(overlaps(b,{x1:100,x2:101,z1:100,z2:101}),false);
});

test('room placement reserves actual rotated furniture bounds',async()=>{
 globalThis.window||={};await import('../school37RoomsPatch.js');
 const patch=window.school37RoomsPatch,room=new THREE.Group(),prop=new THREE.Group();prop.add(new THREE.Mesh(new THREE.BoxGeometry(3,1,1)));
 patch._placeSafeProp(room,'regression',prop,{x:0,z:0,rotY:Math.PI/2,w:1,d:1,h:1,roomW:10,roomD:10,doors:[],allowCenter:true});
 const c=patch.walkableColliders.at(-1);assert.ok(c.depth>=3-.001);assert.ok(c.width>=1-.001);
 const other=new THREE.Group();other.add(new THREE.Mesh(new THREE.BoxGeometry(3,1,1)));
 patch._placeSafeProp(room,'regression',other,{x:0,z:0,rotY:Math.PI/2,w:1,d:1,h:1,roomW:10,roomD:10,doors:[],allowCenter:true});
 const d=patch.walkableColliders.at(-1);assert.ok(Math.abs(c.localX-d.localX)>=(c.width+d.width)/2||Math.abs(c.localZ-d.localZ)>=(c.depth+d.depth)/2);
});
