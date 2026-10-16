import * as THREE from './vendor/three.module.js';

// TextureLoader returns before image decoding. Expose readiness so a staged
// model cannot reach initTexture/compile with a half-loaded material.
export function loadSurfaceTexture(loader,url,channel) {
  let resolve;
  const ready=new Promise(r=>{resolve=r;});
  const texture=loader.load(url,()=>resolve(true),undefined,()=>{
    const c=document.createElement('canvas');c.width=c.height=2;
    const ctx=c.getContext('2d');ctx.fillStyle=/Normal/i.test(channel)?'#8080ff':/AO|Rough/i.test(channel)?'#eeeeee':'#9b9b92';ctx.fillRect(0,0,2,2);
    texture.image=c;texture.needsUpdate=true;
    (window.__assetErrors ||= []).push(url);resolve(false);
  });
  texture.userData.ready=ready;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;
  if(channel==='BaseColor')texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
