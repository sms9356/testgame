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
