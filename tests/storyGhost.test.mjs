import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {settleStoryGhost,tickStoryGhost,showStoryGhost} from '../storyGhost.js';
import * as THREE from '../vendor/three.module.js';
test('legacy chasing/hiding/enraged state cannot survive story ticks or pursue the player',()=>{
 const g={x:12,z:4,floor:0,active:true,enraged:true,state:'chase',hunt:{x:0,z:0},path:[{x:0,z:0}],fake:{},lockSearch:{},storyTime:8};
 for(let i=0;i<1000;i++)tickStoryGhost(g,.016);
 assert.equal(g.x,12);assert.equal(g.z,4);assert.equal(g.enraged,false);assert.equal(g.hunt,null);assert.equal(g.state,'story');assert.equal(g.storyTime,0);assert.deepEqual(g.path,[]);
});
test('story apparition uses an authored distant anchor and never follows movement',()=>{
 const g={},p={x:0,z:0,floor:0},floors=[{nodes:[{x:0,z:0},{x:8,z:0},{x:20,z:0}]}];showStoryGhost(g,p,floors);
 assert.equal(g.x,8);assert.equal(g.storyTime,8);p.x=7.9;tickStoryGhost(g,1);assert.equal(g.x,8);
 showStoryGhost(g,p,[{nodes:[]}]);assert.equal(g.storyTime,0);
});
test('legacy hit call cannot damage player or consume protective inventory',()=>{
 const source=readFileSync(new URL('../game.js',import.meta.url),'utf8');const hit=source.slice(source.indexOf('function hit() {'),source.indexOf('\n}',source.indexOf('function hit() {'))+2);
 const P={hp:100},inv={charm:2},ghost={enraged:true};new Function('P','inv','ghost','settleStoryGhost',`${hit};hit();`)(P,inv,ghost,settleStoryGhost);
 assert.equal(P.hp,100);assert.equal(inv.charm,2);assert.equal(ghost.enraged,false);
});
globalThis.window={};globalThis.document={getElementById:()=>({})};const {SubGhostNPCSheetSystem}=await import('../subGhostSystem.js');
test('close story encounter delivers testimony without attack, scream overlay or fear damage',t=>{
 const timers=[];t.mock.method(globalThis,'setTimeout',fn=>{timers.push(fn);return 0;});
 window.schoolPatchAddon={addFear(){assert.fail('attack fear penalty');}};
 const poses=[],expressions=[],lines=[];const ghost={dialogue:'그날의 증언',setExpression:x=>expressions.push(x),setAnimationPose:x=>poses.push(x)};
 SubGhostNPCSheetSystem.prototype.triggerCloseUpEncounter.call({},ghost,null,(who,text)=>lines.push(text));
 assert.deepEqual(expressions,['sad']);assert.deepEqual(poses,['idle']);assert.deepEqual(lines,['그날의 증언']);timers.forEach(f=>f());assert.deepEqual(poses,['idle','fade']);
});
test('stairs witness never crawls or moves toward a nearby player',()=>{
 const ghost={phase:0,baseY:0,animState:'idle',behavior:'stairs_ambush',isTriggered:true,root:new THREE.Group(),mainPlane:{position:new THREE.Vector3()},faceOverlay:{},opacity:1};ghost.root.position.set(0,0,0);
 SubGhostNPCSheetSystem.prototype.update.call({ghostInstances:[ghost]},1,new THREE.Vector3(1,0,0));assert.deepEqual(ghost.root.position.toArray(),[0,0,0]);
});
