import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';
import {elevatorLocal,elevatorWorld,elevatorRoute,elevatorBay,restoreOutsideElevatorBay} from '../elevatorLayout.js';
test('west-facing cabin and real landing share position and direction without a portal',()=>{
 for(const p of [{px:2,pz:-7},{px:-14,pz:-7}])for(const [x,z] of [[0,-1],[.2,-.3],[-.2,.5]]){
  const world=elevatorWorld(p,x,z);const local=elevatorLocal(p,world.x,world.z);assert.ok(Math.abs(local.x-x)<1e-10&&Math.abs(local.z-z)<1e-10);
 }
});
test('basement routes use height order and both banks reject unknown destinations',()=>{
 assert.deepEqual(elevatorRoute([4,0,1,2],0,4),[4]);assert.deepEqual(elevatorRoute([4,0,1,2],4,2),[0,1,2]);assert.deepEqual(elevatorRoute([8,9,10],10,8),[9,8]);assert.deepEqual(elevatorRoute([8,9,10],8,0),[]);
});
const source=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');const extract=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
test('loading midway through an elevator ride cancels old floor movement and door changes',async()=>{
 let release;const material={color:{setHex(){}}};const ctx={sfx:{elevatorButton(){}},ELV:{idle:0,moving:false,cur:0,set:[4,0,1,2],p:{px:2,pz:-7},want:1,token:0},P:{inElev:true,x:3,z:-7,floor:0},performance:{now:()=>0},setTimeout(){},say(){},elevatorLocal,elevatorRoute,elvHere:()=>({}),storySession:1,EL_BTN:{2:'3'},elvAnnounce:()=>new Promise(r=>release=r),elvDoor(){assert.fail('stale door change');}};
 vm.createContext(ctx);vm.runInContext(extract('async function elvPress(b){','// 카 안 조준:'),ctx);const pending=ctx.elvPress({a:'f',f:2,mesh:{material}});ctx.storySession++;ctx.ELV.token++;ctx.ELV.moving=false;ctx.P.inElev=false;release(false);await pending;assert.equal(ctx.P.floor,0);assert.equal(ctx.ELV.moving,false);
});
test('12 Korean elevator announcements have real matching audio and generation hashes',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('../voice/manifest.json',import.meta.url))),entries=Object.entries(manifest).filter(([id])=>id.startsWith('elv_'));assert.equal(entries.length,12);
 for(const [id,v] of entries){const bytes=fs.readFileSync(new URL('../voice/'+id+'.mp3',import.meta.url));assert.ok(bytes.length>1000);assert.ok(v.dur>.3&&v.dur<6);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),v.generation.audio_sha256);assert.equal(v.nofile,undefined);}
});
test('a destination cannot start travel while a passenger is standing in the doorway',async()=>{
 let notices=0;const ctx={ELV:{moving:false,p:{px:2,pz:-7},cur:0},P:{x:1.9,z:-7},sfx:{elevatorButton(){}},performance:{now:()=>0},setTimeout(){},elevatorLocal,say(){notices++;}};
 vm.createContext(ctx);vm.runInContext(extract('async function elvPress(b){','// 카 안 조준:'),ctx);
 await ctx.elvPress({a:'f',f:2,mesh:{material:{color:{setHex(){}}}}});assert.equal(ctx.ELV.moving,false);assert.equal(notices,1);
});

test('reserved shafts enclose the cabin behind a flush wall while retaining the stair landing',()=>{
 for(const cx of [0,-16]){const b=elevatorBay(cx);assert.ok(b.doorX>b.front);assert.ok(b.doorX+1.65<b.rear);assert.ok(b.clearSpawnX+.32<b.front);assert.ok(b.front-(cx-1.2)>3);}
});
test('legacy saves inside the reserved shaft recover to the clear landing',()=>{
 const b=elevatorBay(-16),p={x:-13,z:-5.2};assert.equal(restoreOutsideElevatorBay(p,b),true);assert.ok(p.x+.32<b.front);assert.equal(p.z,b.doorZ);
 const safe={x:-16,z:-5};assert.equal(restoreOutsideElevatorBay(safe,b),false);assert.deepEqual(safe,{x:-16,z:-5});
});
