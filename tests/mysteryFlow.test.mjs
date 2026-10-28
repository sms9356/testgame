import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {buildMissionGroups,recordCompleted,normalizeCompletedLog} from '../mysteryMissions.js';
import {SIDEQUESTS} from '../story.js';
const objective={main:'선배의 녹화 찾기',subs:[['학교 안으로 들어가기',false]],loc:{where:'1-1'}};
test('missions distinguish missing senior search, independent side cases and evidence reconstruction',()=>{
 const flags={sq:{book:2},mega:{tapes:['a','a'],tags:[]}};
 const groups=buildMissionGroups({flags,documents:[{id:'n23'}],quests:SIDEQUESTS,objective});
 assert.deepEqual(groups.map(g=>g.id),['main','side','special']);assert.match(groups[0].title,/선배/);assert.equal(groups[2].items[0].done,false);assert.equal(groups[2].items[1].progress,'1/6');
 assert.equal(groups[1].items.find(x=>x.id==='book').done,true);assert.equal(groups[0].items[1].done,false);
});
test('restored flags derive special completion and tolerate malformed optional collections',()=>{
 const groups=buildMissionGroups({flags:{mega:{tags:{},tapes:null},sq:{book:-2}},quests:SIDEQUESTS,documents:[],objective});assert.equal(groups[2].items[1].progress,'0/6');
 const fractional=buildMissionGroups({flags:{sq:{book:1.5}},quests:SIDEQUESTS,documents:[],objective});assert.equal(fractional[1].items.find(x=>x.id==='book').progress,'1/2');
 const done=buildMissionGroups({flags:{mega:{tags:Array.from({length:12},(_,i)=>''+i),tapes:Array.from({length:6},(_,i)=>''+i)}},documents:[{id:'n23'},{id:'n24'}],objective});assert.ok(done[2].items.every(x=>x.done));
});
test('identical completion wording in different mission types is retained once per type',()=>{
 const log=[];recordCompleted(log,'main','기록 확인',1);recordCompleted(log,'special','기록 확인',2);recordCompleted(log,'main','기록 확인',3);assert.equal(log.length,2);
 assert.deepEqual(normalizeCompletedLog('bad'),[]);assert.deepEqual(normalizeCompletedLog([null,{s:2,t:'x'},{s:'main',t:'x'}]),[{s:'main',t:'x'}]);
});
const source=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');
const method=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
test('loading during a puzzle cancels its stale result without restoring an unrelated modal',async()=>{
 let resolve;const ctx={state:'playing',storySession:1,storyCalm(){},keys:{},$:()=>({style:{}}),document:{exitPointerLock(){}},runMini:()=>new Promise(r=>resolve=r),refreshHud(){assert.fail('stale HUD restore');},lock(){assert.fail('stale pointer lock');}};
 vm.createContext(ctx);vm.runInContext(method('async function mini(kind, opts) {','function usePassSwitch()'),ctx);const result=ctx.mini('order',{});ctx.storySession=2;ctx.state='ui';resolve({ok:true});assert.deepEqual(JSON.parse(JSON.stringify(await result)),{ok:false,cancelled:true});assert.equal(ctx.state,'ui');
});
test('a broadcast cancelled by load cannot later play dialogue or change the restored scene',async()=>{
 let release;const ctx={storySession:1,state:'playing',voBusy:false,FL:{tapesDone:true},sfx:{broadcast(){}},storyCalm(){},refreshHud(){},save(){},toast(){},wait:()=>new Promise(r=>release=r),line(){assert.fail('stale voice');},ghost:{active:true}};
 vm.createContext(ctx);vm.runInContext(method('async function haneulBroadcast() {','// 민아 깨우기:'),ctx);const pending=ctx.haneulBroadcast();assert.equal(ctx.voBusy,true);ctx.storySession=2;ctx.voBusy=false;release();await pending;assert.equal(ctx.ghost.active,true);assert.equal(ctx.voBusy,false);
});
globalThis.window={};globalThis.document={getElementById:()=>({})};
const {SanityHallucinationSystem}=await import('../sanitySystem.js');
test('memory text effect cannot select real mission or puzzle text and preserves newer text',t=>{
 const restorers=[],target={textContent:'기억',dataset:{},classList:{add(){},remove(){}}};
 const selectors=[];globalThis.document.querySelectorAll=selector=>{selectors.push(selector);return [target];};
 t.mock.method(globalThis,'setTimeout',fn=>{restorers.push(fn);return 0;});
 const engine={creepyPhrases:['시계가 같은 시각이다'],activeTextRestorers:[]};
 SanityHallucinationSystem.prototype.corruptUIElements.call(engine);
 assert.deepEqual(selectors,['[data-memory-echo]']);assert.equal(target.textContent,'시계가 같은 시각이다');target.textContent='새로운 기억';restorers[0]();assert.equal(target.textContent,'새로운 기억');
});
test('rescuing the senior before collecting her recording does not regress to the missing-person opening',()=>{
 const ctx={FL:{mina:true,cam:false},P:{keys:0},docs:[],got:[false],LOC:{office:{where:'교무실'}}};vm.createContext(ctx);vm.runInContext(method('function objective() {','function missionGroups()'),ctx);
 assert.equal(ctx.objective().ch,2);assert.match(ctx.objective().main,/금고/);
});
function keypadContext(){
 const timers=[],pad={key:{locked:true,mesh:{visible:false}}};let unlocks=0;
 const ctx={kpOpening:false,kpProp:pad,kpBuf:'1012',state:'ui',keypadSequence:1,storySession:1,$:()=>({className:'',style:{}}),sfx:{unlock(){unlocks++;}},setTimeout:f=>{timers.push(f);return 0;},closeUI(){ctx.state='playing';ctx.keypadSequence++;},toast(){},talk(){},addClue(){},renderKeypad(){},headAdvance(){}};
 vm.createContext(ctx);vm.runInContext(method('function keypadCheck() {','function keypadKey('),ctx);return {ctx,timers,pad,unlocks:()=>unlocks};
}
test('Enter and auto-check cannot schedule a keypad reward twice',()=>{
 const t=keypadContext();t.ctx.keypadCheck();t.ctx.keypadCheck();assert.equal(t.unlocks(),1);assert.equal(t.timers.length,1);t.timers[0]();assert.equal(t.pad.key.locked,false);assert.equal(t.pad.done,true);
});
test('old keypad success cannot unlock a different pad after session or UI replacement',()=>{
 for(const changed of ['storySession','keypadSequence']){const t=keypadContext();t.ctx.keypadCheck();t.ctx[changed]++;t.timers[0]();assert.equal(t.pad.key.locked,true);assert.equal(t.pad.done,undefined);}
});
test('leaving a pool memory clears its tint; a replaced session is never touched',async()=>{
 for(const changed of ['floor','session']){
  let release,removed=0;
  const ctx={storySession:1,P:{floor:6},state:'playing',storyCalm(){},$:()=>({classList:{add(){},remove(){removed++;}}}),fx:{glitch(){},emit(){}},sfx:{drip(){}},setFace(){},caption(){},floors:{6:{y0:0}},Math,line:()=>new Promise(r=>release=r),wait:async()=>{}};
  vm.createContext(ctx);vm.runInContext(method('async function poolFlashback() {','/* ---------- 교실의 기억'),ctx);
  const pending=ctx.poolFlashback();if(changed==='floor')ctx.P.floor=0;else ctx.storySession++;
  release(1);await pending;assert.equal(removed,changed==='floor'?1:0);
 }
});
