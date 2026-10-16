import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';
const proposed = await readFile(new URL('../school37RoomsPatch.js', import.meta.url), 'utf8');
function extract(s,start,end){const a=s.indexOf(start),b=s.indexOf(end,a);assert.ok(a>=0&&b>a,'method boundary');return s.slice(a,b).trim();}
function engine(s=proposed){
const can=extract(s,'  _canPlaceFurniture(','  // 안전하게');
const place=extract(s,'  _placeSafeProp(','  /* =========================================================\n     3.');
const populate=extract(s,'  populateRoomByType(','  /* =========================================================\n     5.');
const resolve=extract(s,'  resolvePlayerMovementCollision(','\n}\n\nwindow.school37RoomsPatch');
return Object.assign(new Function('THREE','return ({'+can+','+place+','+populate+','+resolve+'});')(THREE),{
scene:new THREE.Scene(),roomOccupancyMap:new Map(),walkableColliders:[],interactables:[],
_prefabBedWithCurtain(){const p=new THREE.Group();p.userData.infirmaryKind='bed';return p;},
_prefabHeavyStorageRack(){return new THREE.Group();}
});}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
function options(extra={}){return {x:0,z:-2.9,w:1.4,d:.85,h:1.8,roomW:7.6,roomD:7.5,doors:[{x:0,z:3.75}],...extra};}
function prop(offset){const p=new THREE.Group();if(offset)p.userData.infirmaryFootprint=offset;return p;}
test('nurse accepts original pose; two beds and interaction metadata preserved',()=>{
const e=engine(),g=e.populateRoomByType({roomKey:'nurse',roomName:'보건실',roomW:7.6,roomD:7.5,doors:[{x:0,z:3.75}]});
const p=g.children.find(p=>p.userData.infirmaryKind==='cabinetOpen');assert.ok(p);near(p.position.x,0);near(p.position.z,-2.9);
assert.equal(g.children.filter(p=>p.userData.infirmaryKind==='bed').length,2);assert.equal(e.interactables.length,2);assert.match(p.userData.interactable.promptText,/유리 약품장/);
const c=e.walkableColliders.find(c=>c.mesh===p),o=e.roomOccupancyMap.get('nurse').at(-1);near(c.localX,.2425);near(c.localZ,-2.6775);near(o.x,c.localX);near(o.z,c.localZ);assert.equal(c.width,1.4);assert.equal(c.depth,.85);assert.equal(c.height,1.8);
});
test('original oversized pose fails bounds; exact offset footprint fits',()=>{const e=engine();assert.equal(e._canPlaceFurniture('old',0,-2.9,1.95,1.35,7.6,7.5,[{x:0,z:3.75}]),false);assert.equal(e._canPlaceFurniture('fixed',.2425,-2.6775,1.4,.85,7.6,7.5,[{x:0,z:3.75}]),true);assert.ok(e._placeSafeProp(new THREE.Group(),'fixed',prop({x:.2425,z:.2225}),options()));});
test('yaw offset matches actual Three Y rotation; origin unchanged',()=>{
for(const rotY of [0,Math.PI/2,Math.PI,-Math.PI/2]){const e=engine(),p=prop({x:.2425,z:.2225}),v=new THREE.Vector3(.2425,0,.2225).applyAxisAngle(new THREE.Vector3(0,1,0),rotY);
assert.equal(e._placeSafeProp(new THREE.Group(),'yaw',p,options({x:1,z:1,rotY,allowCenter:true,roomW:20,roomD:20,doors:[]})),p);near(p.position.x,1);near(p.position.z,1);near(p.rotation.y,rotY);
const c=e.walkableColliders[0],o=e.roomOccupancyMap.get('yaw')[0];near(c.localX,1+v.x);near(c.localZ,1+v.z);near(o.x,c.localX);near(o.z,c.localZ);}
});
test('central check and safety check use offset candidate centre',()=>{
const e=engine(),p=prop({x:1,z:0}),seen=[];e._canPlaceFurniture=(...args)=>{seen.push(args);return true;};
assert.equal(e._placeSafeProp(new THREE.Group(),'cross',p,options({x:0,z:0})),p);near(p.position.x,0);near(seen[0][1],1);near(seen[0][2],0);
});
test('default zero offset retains known placement and collider fields',()=>{const e=engine(),p=prop();assert.equal(e._placeSafeProp(new THREE.Group(),'normal',p,options({w:1.6,d:.6})),p);near(p.position.x,0);near(p.position.z,-2.9);const c=e.walkableColliders[0];near(c.localX,0);near(c.localZ,-2.9);assert.equal(c.width,1.6);assert.equal(c.depth,.6);assert.equal(c.height,1.8);assert.deepEqual(e.roomOccupancyMap.get('normal'),[{x:0,z:-2.9,w:1.6,d:.6}]);});

test('resolver uses footprint world centre under room rotation and prop yaw',()=>{
 for(const roomYaw of [0,Math.PI])for(const propYaw of [0,Math.PI/2]){
  const e=engine(),room=new THREE.Group(),p=prop({x:.2425,z:.2225});room.position.set(12,0,-5);room.rotation.y=roomYaw;
  e._placeSafeProp(room,'resolve',p,options({x:1,z:1,rotY:propYaw,allowCenter:true,roomW:20,roomD:20,doors:[]}));room.updateMatrixWorld(true);
  const expected=p.localToWorld(new THREE.Vector3(.2425,0,.2225));
  const c=e.walkableColliders[0],registryCentre=room.localToWorld(new THREE.Vector3(c.localX,0,c.localZ));assert.ok(expected.distanceTo(registryCentre)<1e-10);
  const player=expected.clone();e.resolvePlayerMovementCollision(player);near(player.x,expected.x);near(player.z,expected.z-(.85/2+.38));
 }
});
test('resolver without footprint retains known original centre response',()=>{const e=engine(),room=new THREE.Group();room.position.set(12,0,-5);room.rotation.y=Math.PI;e._placeSafeProp(room,'normal-resolve',prop(),options({w:1.6,d:.6}));room.updateMatrixWorld(true);const c=e.walkableColliders[0],centre=c.mesh.getWorldPosition(new THREE.Vector3()),player=centre.clone();e.resolvePlayerMovementCollision(player);near(player.x,centre.x);near(player.z,centre.z-(.6/2+.38));});

const nurseOccupied = [{"x":-2.3999999999999986,"z":-2.7250000000000005,"w":1,"d":2},{"x":2.3999999999999986,"z":-2.7250000000000005,"w":1,"d":2},{"x":3.6000000000000014,"z":-0.8250000000000002,"w":0.3999999999999986,"d":0.9000000000000004},{"x":-3.1999999999999993,"z":0.27499999999999947,"w":0.6000000000000014,"d":1.1999999999999993},{"x":1.1999999999999993,"z":1.2749999999999995,"w":0.8500000000000014,"d":1.0999999999999996},{"x":-3.1999999999999993,"z":0.27499999999999947,"w":0.8,"d":0.8},{"x":2.3999999999999986,"z":-2.7250000000000005,"w":0.8,"d":0.8},{"x":2.3999999999999986,"z":-1.9249999999999998,"w":0.8,"d":0.8},{"x":-2.3999999999999986,"z":-2.325,"w":0.8,"d":0.8},{"x":-2.6999999999999993,"z":3.875,"w":0.8,"d":0.8},{"x":-3.1999999999999993,"z":0.7249999999999996,"w":0.8,"d":0.8},{"x":1.3999999999999986,"z":3.3449999999999998,"w":0.8,"d":0.8},{"x":2.8999999999999986,"z":3.375,"w":0.8,"d":0.8},{"x":0,"z":0.17499999999999982,"w":0.9,"d":0.9}];
test('observed main nurse occupancy accepts cabinet without moving base beds',()=>{const e=engine();e.roomOccupancyMap.set('0:-24:1',nurseOccupied.map(o=>({...o})));const g=e.populateRoomByType({roomKey:'0:-24:1',roomName:'보건실',roomW:7.6,roomD:7.5,doors:[{x:0,z:3.75}]});const cabinet=g.children.find(p=>p.userData.infirmaryKind==='cabinetOpen');assert.ok(cabinet);near(cabinet.position.x,0);near(cabinet.position.z,-2.9);assert.equal(e.interactables.length,1);assert.match(e.interactables[0].promptText,/약품장/);});
