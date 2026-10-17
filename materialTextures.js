import * as THREE from './vendor/three.module.js';
import { refineModelTexture, bakedUrl } from './furnitureTextureDetail.js';

// TextureLoader returns before image decoding. Expose readiness so a staged
// model cannot reach initTexture/compile with a half-loaded material.
// Pre-baked detail textures load first; on failure the original is refined at runtime.
export function loadSurfaceTexture(loader,url,channel) {
  let resolve;
  const ready=new Promise(r=>{resolve=r;});
  const bk=bakedUrl(url);
  const fail=()=>{
    const c=document.createElement('canvas');c.width=c.height=2;
    const ctx=c.getContext('2d');ctx.fillStyle=/Normal/i.test(channel)?'#8080ff':/AO|Rough/i.test(channel)?'#eeeeee':'#9b9b92';ctx.fillRect(0,0,2,2);
    texture.image=c;texture.needsUpdate=true;
    (window.__assetErrors ||= []).push(url);resolve(false);
  };
  const texture=loader.load(bk||url,()=>{if(!bk)refineModelTexture(texture,url,channel);resolve(true);},undefined,()=>{
    if(!bk)return fail();
    new THREE.ImageLoader().load(url,img=>{texture.image=img;texture.needsUpdate=true;refineModelTexture(texture,url,channel);resolve(true);},undefined,fail);
  });
  texture.userData.ready=ready;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;
  if(channel==='BaseColor')texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
