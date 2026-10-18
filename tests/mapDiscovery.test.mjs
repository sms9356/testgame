import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {drawMap} from '../map.js';
function canvasSpy(){const calls=[];const ctx={};for(const key of ['clearRect','save','restore','fillRect','strokeRect','fillText','beginPath','moveTo','lineTo','arc','closePath','fill','stroke','translate','rotate'])ctx[key]=(...args)=>calls.push([key,...args]);ctx.measureText=t=>({width:String(t).length*8});return{ctx,calls};}
for(const floor of [0,1,2,3,4,5,6,7,8,9,10])test('discovery map ignores all spoiler coordinates on floor '+floor,()=>{
 const options={floor,cx:0,cz:0,scale:3,labels:true,player:{x:1,z:2,yaw:0},doors:[{x:3,z:4,open:true}]};
 const plain=canvasSpy(),spoilers=canvasSpy();drawMap(plain.ctx,640,480,options);
 drawMap(spoilers.ctx,640,480,{...options,pins:[{x:6,z:7,done:false}],props:[{x:10,z:11,label:'SPOILER DEVICE'}],lockers:[{x:12,z:13}],zones:[[14,15,'SPOILER ZONE']],target:{x:20,z:21},mini:true,t:2});
 assert.deepEqual(spoilers.calls,plain.calls);
 assert.ok(plain.calls.some(c=>c[0]==='translate'));assert.ok(plain.calls.some(c=>c[0]==='fillText'));
});
test('spoiler inputs are never inspected',()=>{const spy=canvasSpy();const o={floor:1,cx:0,cz:0,scale:3};for(const k of ['pins','props','lockers','zones','target'])Object.defineProperty(o,k,{get(){throw Error('read spoiler '+k);}});assert.doesNotThrow(()=>drawMap(spy.ctx,640,480,o));});
test('legend explains discovery and retains only orientation information',async()=>{const html=await readFile(new URL('../index.html',import.meta.url),'utf8');const legend=html.match(/<div class="legend">[\s\S]*?<\/div>/)[0];assert.ok(legend.includes('현재 위치'));assert.ok(legend.includes('열린 문'));assert.ok(legend.includes('직접 탐색'));for(const text of ['열쇠 조각','획득 완료','장치 · 녹음기','사물함','현재 목표'])assert.ok(!legend.includes(text));});
