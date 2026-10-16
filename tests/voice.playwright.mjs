// Run against the local static server: GAME_URL=http://127.0.0.1:8767
// PW_CORE=/path/to/playwright-core/index.mjs CHROME=/usr/bin/chromium node tests/voice.playwright.mjs
import assert from 'node:assert/strict';
const {chromium} = await import(process.env.PW_CORE || 'playwright-core');
const browser = await chromium.launch({executablePath:process.env.CHROME,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
try {
 const page = await browser.newPage();
 const base = process.env.GAME_URL || 'http://127.0.0.1:8767';
 await page.route('**/audio-test', route=>route.fulfill({contentType:'text/html',body:'<div id="sub"></div>'}));
 await page.goto(base+'/audio-test');
 const result = await page.evaluate(async()=>{
  const audio = await import('./audio.js'), voice = await import('./voice.js');
  audio.initAudio(); await voice.loadManifest();
  const originalStart=AudioBufferSourceNode.prototype.start;
  let started=0;
  AudioBufferSourceNode.prototype.start=function(...args){started++;return originalStart.apply(this,args);};
  const realFetch=window.fetch;
  const delayed=new Map();
  window.fetch=(url,...args)=>String(url).includes('?delay=') ? new Promise(resolve=>delayed.set(String(url),()=>resolve(realFetch(url,...args)))) : realFetch(url,...args);
  const pending=audio.playVoice('voice/intro1.mp3?delay=stop');
  audio.stopVoice();delayed.get('voice/intro1.mp3?delay=stop')();
  const cancelled=await pending;
  const afterStop=started;
  const older=audio.playVoice('voice/intro2.mp3?delay=older');
  const newer=await audio.playVoice('voice/ghThanks.mp3', 'none', {rate:1,pitch:1,dry:true});
  delayed.get('voice/intro2.mp3?delay=older')();
  const superseded=await older;
  const afterLatest=started;
  audio.stopVoice();
  // Clearing a note during an in-flight fetch must also suppress its subtitle.
  voice.registerLines({test_late:{spk:'narrator',text:'중단한 대사'}});
  const info=voice.lineInfo('test_late');delete info.nofile;
  let release;
  window.fetch=(url,...args)=>String(url)==='voice/test_late.mp3' ? new Promise(resolve=>{release=()=>resolve(realFetch('voice/intro1.mp3',...args));}) : realFetch(url,...args);
  const late=voice.line('test_late');voice.stopSpeak();release();
  const lateDuration=await late;
  const subtitleVisible=document.querySelector('#sub').classList.contains('show');
  const afterLate=started;
  window.fetch=realFetch;AudioBufferSourceNode.prototype.start=originalStart;
  return {cancelled,afterStop,superseded,afterLatest,newerDuration:newer.duration,lateDuration,subtitleVisible,afterLate};
 });
 assert.equal(result.cancelled,null);assert.equal(result.afterStop,0);
 assert.equal(result.superseded,null);assert.equal(result.afterLatest,1);
 assert.ok(result.newerDuration>0);assert.equal(result.lateDuration,0);
 assert.equal(result.subtitleVisible,false);assert.equal(result.afterLate,1);
 console.log('PASS: delayed cancellation, latest request wins, file duration, stale subtitle suppression',JSON.stringify(result));
}finally{await browser.close();}
