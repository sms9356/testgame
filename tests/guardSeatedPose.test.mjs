import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';
import {applyGuardSeatedPose} from '../guardSeatedPose.js';

test('supplied guard rig is seated at chair: thighs forward, shins down, feet near floor',async()=>{
  const b=await readFile(new URL('../assets/characters/guard.glb',import.meta.url));
  const gl=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString().trim());
  const joints=new Set(gl.skins.flatMap(s=>s.joints));
  const nodes=gl.nodes.map((n,i)=>{const o=joints.has(i)?new THREE.Bone():new THREE.Object3D();o.name=n.name||'';if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);if(n.matrix){o.matrix.fromArray(n.matrix);o.matrix.decompose(o.position,o.quaternion,o.scale);}return o;});
  gl.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>nodes[i].add(nodes[c])));
  const model=new THREE.Group();gl.scenes[gl.scene||0].nodes.forEach(i=>model.add(nodes[i]));
  const holder=new THREE.Group();holder.position.set(5.74,.02,66.1);holder.add(model);holder.userData.characterModel=model;
  let stopped=false;holder.userData.npcAction={stop(){stopped=true;}};
  const report=applyGuardSeatedPose(holder,{x:5.74,y:.5005,z:66.1});
  assert.equal(report.ok,true);assert.equal(stopped,true);assert.equal(holder.userData.seated,true);
  assert.ok(Math.abs(report.pelvis[1]-.6205)<1e-5);
  report.knees.forEach(p=>{assert.ok(p[2]>report.pelvis[2]+.3);assert.ok(p[1]<report.pelvis[1]);});
  report.feet.forEach((p,i)=>{assert.ok(p[1]>.01&&p[1]<.13);assert.ok(p[1]<report.knees[i][1]-.3);});
  assert.equal(gl.animations.some(a=>/sit/i.test(a.name)),false);
});
test('not-yet-loaded guard keeps procedural fallback',()=>{assert.equal(applyGuardSeatedPose(new THREE.Group(),{}).ok,false);});
