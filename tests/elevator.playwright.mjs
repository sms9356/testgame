// Serve the repository, then run with PW_CORE, CHROME and optional GAME_URL / ARTIFACT_DIR.
// Real W-key entry/exit; debug positioning between banks and direct floor-button selection.
import fs from 'node:fs';import path from 'node:path';
const {chromium}=await import(process.env.PW_CORE||'playwright-core');
const outDir=path.resolve(process.env.ARTIFACT_DIR||'/tmp/haegyo-elevator-check');fs.mkdirSync(outDir,{recursive:true});
const gameURL=new URL(process.env.GAME_URL||'http://localhost:8765/index.html');gameURL.searchParams.set('debug','');gameURL.searchParams.set('nolock','');
const b=await chromium.launch({executablePath:process.env.CHROME,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});const p=await b.newPage({viewport:{width:960,height:640}}),result={checks:[],errors:[],routes:[],voices:[]};
p.setDefaultTimeout(120000);const check=(name,value)=>{result.checks.push({name,pass:!!value});console.log(value?'PASS':'FAIL',name);if(!value)throw Error(name);};
p.on('pageerror',e=>{result.errors.push(e.message);console.log('PAGEERROR',e.message);});await p.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:''}));
await p.addInitScript(()=>{localStorage.setItem('haegyo_set',JSON.stringify({quality:'low',scale:.5,bloom:false,view:1,bob:false,shake:false}));});
const E=f=>p.evaluate(f),W=n=>p.waitForTimeout(n);
async function shot(name){await E(()=>{__g.camera.updateMatrixWorld();window.__render(__g.scene,__g.camera);});await W(300);await p.screenshot({path:path.join(outDir,'elevator-'+name+'.png')});}
async function at(f){await p.evaluate(f=>{__g.elvReset();const q=__g.world.props.find(q=>q.kind==='elevator'&&q.floor===f);__g.state='playing';__g.tp(q.px-1,q.pz,f,-Math.PI/2,0);__g.P.light=false;__g.P.sh=__g.P.jy=__g.P.shV=__g.P.jyV=0;},f);await W(2300);await E(()=>{__g.P.yaw=-Math.PI/2;__g.P.pitch=0;});await p.keyboard.press('KeyE');await p.waitForFunction(()=>__g.ELV.open>.95&&__g.ELV.want===1);}
async function enter(){await p.keyboard.down('KeyW');try{await p.waitForFunction(()=>__g.P.inElev&&__g.P.x>__g.ELV.p.px+.7);}finally{await p.keyboard.up('KeyW');}console.log('ENTER',await E(()=>({x:__g.P.x,z:__g.P.z,yaw:__g.P.yaw,f:__g.P.floor,inside:__g.P.inElev,open:__g.ELV.open,hall:__g.ELV.p?.hallK})));check('walk across threshold into real cabin',await E(()=>__g.P.inElev&&Math.abs(__g.P.x)<40));await E(()=>{__g.P.yaw=Math.PI/2;__g.P.pitch=0;});await W(150);}
async function ride(f){await p.evaluate(f=>{window.__ride=__g.elvPress(__g.ELV.btns.find(b=>b.a==='f'&&b.f===f));},f);await p.waitForFunction(f=>__g.P.floor===f&&!__g.ELV.moving&&__g.ELV.open>.95,f,{timeout:120000});const r=await E(()=>{const g=__g,q=g.ELV.p;return {floor:g.P.floor,car:[g.ELV.g.position.x,g.ELV.g.position.y,g.ELV.g.position.z],landing:[q.px,g.floors[q.floor].y0,q.pz],player:[g.P.x,g.P.z],open:g.ELV.open,hall:q.hallK,block:q.doorBlock.off};});result.routes.push(r);check('arrival '+f+': real landing, open hall and cabin, no remote coordinates',r.car.every((v,i)=>Math.abs(v-r.landing[i])<1e-6)&&r.hall>.85&&r.block&&Math.abs(r.player[0])<40);}
async function leave(){const before=await E(()=>({x:__g.P.x,z:__g.P.z,f:__g.P.floor}));await p.keyboard.down('KeyW');try{await p.waitForFunction(()=>!__g.P.inElev&&__g.P.x<__g.ELV.p.px-.75);}finally{await p.keyboard.up('KeyW');}const after=await E(()=>({x:__g.P.x,z:__g.P.z,f:__g.P.floor,inside:__g.P.inElev}));check('walk out onto same floor without a position jump',!after.inside&&before.f===after.f&&Math.hypot(after.x-before.x,after.z-before.z)<3.3);}
try{
await p.goto(gameURL.href,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__loadTimes,null,{timeout:180000});console.log('READY');
await E(()=>{window.__render=__g.renderer.render.bind(__g.renderer);__g.renderer.render=()=>{};});
await E(()=>__g.newGame());await p.keyboard.press('Space');await E(()=>{__g.state='playing';__g.save();__g.load();});
await p.waitForFunction(()=>window.__modelsDone,null,{timeout:300000});await at(0);await enter();
check('ceiling contains two luminous diffusers and a working cabin light',await E(()=>__g.ELV.light.intensity>0&&__g.ELV.g.children.filter(o=>o.material?.color?.getHex()===0xfff2d5).length===2));
await shot('1f-open');await E(()=>{__g.P.pitch=1.15;});await W(250);await shot('ceiling');await E(()=>{__g.P.pitch=0;});await E(()=>__g.toggleView());await W(250);check('third-person camera stays within the narrow cabin',await E(()=>__g.camera.position.distanceTo(__g.ELV.g.position)<2.8));await E(()=>__g.toggleView());
await ride(4);await shot('b1-open');
check('open doorway sees actual basement geometry beyond the threshold',await E(()=>{const g=__g,q=g.ELV.p,ray=new g.ELV.ray.constructor();ray.camera=g.camera;ray.set(g.camera.position.clone(),g.camera.getWorldDirection(g.camera.position.clone()));const hits=ray.intersectObjects(g.floors[4].interior.children,true);return hits.some(h=>h.point.x<q.px-.6&&h.distance>1);}));
await leave();await shot('b1-landing');
await at(4);await enter();await ride(2);await ride(1);await ride(0);await leave();
await at(8);await enter();await ride(9);await ride(10);await ride(8);await leave();
await at(0);await enter();await E(()=>{__g.save();__g.elvPress(__g.ELV.btns.find(b=>b.f===2));__g.load();});await W(4500);
check('load during ride restores landing and cancels cabin callbacks',await E(()=>!__g.P.inElev&&!__g.ELV.moving&&__g.P.floor===0&&Math.abs(__g.P.x)<40));
result.voices=await E(async()=>{const {SUBLOG}=await import('./voice.js');return SUBLOG.filter(x=>JSON.stringify(x).includes('승강기')).slice(-30);});
check('page and frame loop remain error-free',result.errors.length===0&&await E(()=>!window.__frameErrs));
}catch(e){result.failure=String(e);result.last=await E(()=>({p:{x:__g.P.x,z:__g.P.z,floor:__g.P.floor,inElev:__g.P.inElev},state:__g.state,car:{cur:__g.ELV.cur,moving:__g.ELV.moving,open:__g.ELV.open}}));console.log('LAST',JSON.stringify(result.last));throw e;}finally{fs.writeFileSync(path.join(outDir,'elevator-runtime.json'),JSON.stringify(result,null,2));await b.close();}
