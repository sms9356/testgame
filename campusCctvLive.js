import * as THREE from './vendor/three.module.js';
import { makeRenderTarget, ENGINE } from './engine.js?v=306';

const WIDTH = 256, HEIGHT = 192, MAX_RENDER_HZ = 6, READBACK_MS = 500;
export function createCampusCctvLive({ renderer, scene, feeds = [], floorRoots = [], monitorMeshes = [], onClose, onChannelsChanged, onPowerToggle, getPowered, initialChannels = [], visibilityForFeed, renderCapture } = {}) {
  if (!renderer || !scene) throw new TypeError('renderer and scene are required');
  const targets = Array.from({ length: 3 }, () => makeRenderTarget(WIDTH, HEIGHT, { depthBuffer: true, stencilBuffer: false }));
  const cameras = Array.from({ length: 3 }, () => new THREE.PerspectiveCamera(55, WIDTH / HEIGHT, 0.1, 1000));
  let feedList = Array.isArray(feeds) ? feeds.slice() : [], monitors = Array.from(monitorMeshes || []), channelIds = [], cursor = 0, elapsed = 0, readbackElapsed = 0, opened = false, disposed = false, overlay = null, renderCount=0, poweredNow=Boolean(getPowered?.()), channelFeedIds=[null,null,null];
  const textures = targets.map(t => { t.texture.colorSpace=THREE.SRGBColorSpace; return t.texture; });
  const idOf = f => f?.id;
  function validIds(ids) { const known=new Set(feedList.map(idOf)), out=[null,null,null]; Array.from(ids||[]).slice(0,3).forEach((id,i)=>{if(known.has(id))out[i]=id}); let n=0; for(let i=0;i<3;i++)if(out[i]==null){while(n<feedList.length&&out.includes(idOf(feedList[n])))n++;if(n<feedList.length)out[i]=idOf(feedList[n++]);else if(feedList.length)out[i]=idOf(feedList[i%feedList.length]);} return out; }
  channelIds = validIds(initialChannels);
  function syncChannels() { channelIds = validIds(channelIds); if (overlay) refreshUI(); }
  function setFeeds(next) { feedList = Array.isArray(next) ? next.slice() : []; channelIds = validIds(channelIds); cursor = 0; syncChannels(); }
  function setMonitors(next) { monitors = Array.from(next || []); }
  function restoreChannels(ids) { channelIds = validIds(ids); syncChannels(); }
  function floorVisibility(feed) {
    const saved = [];
    for (const r of floorRoots || []) { for(const [obj,on] of [[r.interior,!feed.outdoor&&r.floor===feed.floor],[r.shell,feed.outdoor?r.floor<=3:r.floor===feed.floor],[r.windowFake,feed.outdoor||r.floor!==feed.floor]]) if(obj){saved.push([obj,obj.visible]);obj.visible=on;} }
    return () => { for (const [obj, visible] of saved) obj.visible = visible; };
  }
  function renderFeed(index) {
    if (!feedList.length) return;
    const feed = feedList.find(f=>f.id===channelIds[index]); channelFeedIds[index]=feed?.id??null; if (!feed?.position || !feed?.target) return;
    const camera = cameras[index]; camera.position.set(...feed.position); camera.lookAt(...feed.target); camera.updateMatrixWorld();
    const oldTarget = renderer.getRenderTarget?.() ?? null;
    const vp = renderer.getViewport?.(new THREE.Vector4()); const sc = renderer.getScissor?.(new THREE.Vector4());
    const st = renderer.getScissorTest?.() ?? false, ac = renderer.autoClear, xr = renderer.xr?.enabled, shadow = renderer.shadowMap?.autoUpdate;
    const vis = monitors.map(m => [m, m.visible]); let restoreFloor = () => {}, restoreEntities = () => {};
    try {
      for (const m of monitors) if (m) m.visible = false;
      restoreFloor = floorVisibility(feed);
      restoreEntities = visibilityForFeed?.(feed) || (() => {});
      renderer.xr && (renderer.xr.enabled = false); if (renderer.shadowMap) renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(targets[index]); renderer.setViewport(0, 0, WIDTH, HEIGHT); renderer.setScissorTest(false); renderer.autoClear = true; renderer.clear?.(); if(renderCapture)renderCapture(camera,feed);else renderer.render(scene, camera); renderCount++;
    } finally {
      restoreEntities(); restoreFloor(); for (const [m, v] of vis) if (m) m.visible = v;
      renderer.setRenderTarget(oldTarget); if (vp) renderer.setViewport(vp); if (sc) renderer.setScissor(sc); renderer.setScissorTest(st); renderer.autoClear = ac;
      if (renderer.xr) renderer.xr.enabled = xr; if (renderer.shadowMap) renderer.shadowMap.autoUpdate = shadow;
    }
  }
  function makeOverlay() {
    if (overlay || typeof document === 'undefined' || !document.createElement) return;
    const root = document.createElement('div'); root.setAttribute('role','dialog');root.setAttribute('aria-modal','true'); root.setAttribute('aria-label','경비실 실시간 CCTV'); root.style.cssText='position:fixed;left:3vw;right:3vw;top:50%;transform:translateY(-50%);max-height:90vh;z-index:2147483000;background:#0c1713;color:#d8f4df;padding:20px;overflow:auto;font:14px/1.5 sans-serif;display:none;border:1px solid #577c67;border-radius:8px;box-shadow:0 0 0 100vmax rgba(0,0,0,.7)';
    const head=document.createElement('div'); head.textContent='경비실 실시간 CCTV · 채널당 약 2 FPS';head.style.cssText='font-size:18px;font-weight:700;margin-bottom:16px'; root.append(head);
    const grid=document.createElement('div'); grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px'; root.append(grid);
    for(let i=0;i<3;i++){ const box=document.createElement('section'); const label=document.createElement('div'); label.textContent='모니터 '+(i+1); const canvas=document.createElement('canvas'); canvas.width=WIDTH; canvas.height=HEIGHT; canvas.style.cssText='width:100%;background:#222'; const select=document.createElement('select'); select.style.cssText='width:100%;margin-top:6px;padding:8px;background:#182c22;color:#d8f4df;border:1px solid #4d725e;border-radius:3px';select.dataset.index=String(i); select.setAttribute('aria-label','모니터 '+(i+1)+' 채널'); select.addEventListener('change',()=>{const n=Number(select.dataset.index); channelIds[n]=select.value||null; channelIds=validIds(channelIds);cursor=n;elapsed=1/MAX_RENDER_HZ; onChannelsChanged?.(channelIds.slice()); refreshUI();}); box.append(label,canvas,select); grid.append(box); }
    const power=document.createElement('button'); power.type='button'; power.textContent='CCTV 전원 켜기/끄기'; power.addEventListener('click',()=>onPowerToggle?.()); const close=document.createElement('button'); close.type='button'; close.textContent='닫기 (Esc)'; close.addEventListener('click',()=>{closeUI();onClose?.();}); for(const b of [power,close])b.style.cssText='padding:8px 14px;margin:18px 10px 0 0;background:#213d2f;color:#e2ffe8;border:1px solid #5d846d;border-radius:4px;cursor:pointer';root.append(power,close); document.body?.append(root); overlay=root; refreshUI();
  }
  function refreshUI(){ if(!overlay) return; const selects=overlay.querySelectorAll('select'); selects.forEach((s,i)=>{const chosen=channelIds[i]||''; s.replaceChildren(); const empty=document.createElement('option'); empty.value=''; empty.textContent='채널 선택'; s.append(empty); for(const f of feedList){const o=document.createElement('option');o.value=String(f.id);o.textContent=f.label||String(f.id);s.append(o);} s.value=chosen;}); }
  function open(){ if(disposed)return; opened=true; makeOverlay(); if(overlay){overlay.style.display='block';overlay.querySelector('select')?.focus();} }
  function closeUI(){ opened=false;if(overlay)overlay.style.display='none'; }
  function tick(dt=0, { powered = Boolean(getPowered?.()), near = false, quality = 1 } = {}) {
    if(disposed)return; poweredNow=powered; elapsed+=Math.max(0,Number(dt)||0); readbackElapsed+=Math.max(0,Number(dt)||0);
    const cadence=1/MAX_RENDER_HZ; if(powered&&(near||opened)&&elapsed>=cadence){elapsed%=cadence; const ix=(cursor++%3); try{renderFeed(ix);}catch(e){throw e;} }
    if(opened && readbackElapsed>=READBACK_MS/1000){readbackElapsed%=READBACK_MS/1000; readCanvases();}
  }
  // 신규 엔진(WebGPU): 픽셀 읽기가 비동기 — 위아래가 이미 바른 순서로 온다
  let gpuReading=false;
  async function readCanvasesGPU(){ if(gpuReading)return; gpuReading=true; try{ const canvases=overlay.querySelectorAll('canvas');
    for(let i=0;i<3;i++){ const c=canvases[i],ctx=c?.getContext?.('2d'); if(!ctx)continue; if(!poweredNow){ctx.fillStyle='#050808';ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.fillStyle='#9bb5aa';ctx.font='14px sans-serif';ctx.fillText('전원 꺼짐',85,100);continue;}
      const data=await renderer.readRenderTargetPixelsAsync(targets[i],0,0,WIDTH,HEIGHT); if(!overlay)break; const px=new Uint8ClampedArray(data.buffer?data.buffer.slice(0,WIDTH*HEIGHT*4):data); ctx.putImageData(new ImageData(px,WIDTH,HEIGHT),0,0);
      ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(0,0,WIDTH,23);ctx.fillStyle='#d4ffe2';ctx.font='12px sans-serif';ctx.fillText((feedList.find(f=>f.id===channelIds[i])?.label||'신호 없음').slice(0,28),5,16);ctx.fillText(new Date().toLocaleTimeString('ko-KR'),165,HEIGHT-8); } }catch{} gpuReading=false; }
  function readCanvases(){ if(!overlay)return; if(ENGINE.webgpu&&renderer.readRenderTargetPixelsAsync){ readCanvasesGPU(); return; } if(!renderer.readRenderTargetPixels)return; const canvases=overlay.querySelectorAll('canvas'); for(let i=0;i<3;i++){const c=canvases[i],ctx=c?.getContext?.('2d');if(!ctx)continue;if(!poweredNow){ctx.fillStyle='#050808';ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.fillStyle='#9bb5aa';ctx.font='14px sans-serif';ctx.fillText('전원 꺼짐',85,100);continue;}try{const data=new Uint8Array(WIDTH*HEIGHT*4);renderer.readRenderTargetPixels(targets[i],0,0,WIDTH,HEIGHT,data);const flipped=new Uint8ClampedArray(data.length);for(let y=0;y<HEIGHT;y++)flipped.set(data.subarray(y*WIDTH*4,(y+1)*WIDTH*4),(HEIGHT-1-y)*WIDTH*4);ctx.putImageData(new ImageData(flipped,WIDTH,HEIGHT),0,0);ctx.fillStyle='rgba(0,0,0,.65)';ctx.fillRect(0,0,WIDTH,23);ctx.fillStyle='#d4ffe2';ctx.font='12px sans-serif';ctx.fillText((feedList.find(f=>f.id===channelIds[i])?.label||'신호 없음').slice(0,28),5,16);ctx.fillText(new Date().toLocaleTimeString('ko-KR'),165,HEIGHT-8);}catch{}}
  }
  function dispose(){if(disposed)return;disposed=true;overlay?.remove();overlay=null;for(const t of targets)t.dispose();}
  return { textures, setFeeds, setMonitors, tick, open, close:closeUI, get isOpen(){return opened;}, get channels(){return channelIds.slice();}, restoreChannels, get diagnostics(){return {feedCount:feedList.length, channelCount:channelIds.length, rendersPerSecond:MAX_RENDER_HZ, targetSize:[WIDTH,HEIGHT],renderCount,channelFeedIds:channelFeedIds.slice(),powered:poweredNow,disposed};}, dispose };
}

export function collectCampusCctvFeeds(records) {
  return (records||[]).map(r=>{
    r.lens.updateWorldMatrix(true,false);
    const position=r.lens.localToWorld(new THREE.Vector3(...r.eye));
    const target=r.target ? r.parent.localToWorld(new THREE.Vector3(...r.target)) : position.clone().add(new THREE.Vector3(0,0,12).applyQuaternion(r.lens.getWorldQuaternion(new THREE.Quaternion())));
    return {id:r.id,label:r.label,floor:r.floor,outdoor:r.outdoor,position:position.toArray(),target:target.toArray()};
  }).sort((a,b)=>{const rank=f=>f.label==='1F · 복도 서쪽'?0:f.label==='정문 · 서쪽'?1:f.label.startsWith('옥상')?2:f.label.startsWith('경비실')?3:10+f.floor;return rank(a)-rank(b);});
}
