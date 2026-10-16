import * as THREE from './vendor/three.module.js';

let turf;
// Fine, seamless turf fibres with neutral relief; no baked directional lighting.
export function turfMaterial() {
  if (turf) return turf;
  const n=1024, canvas=document.createElement('canvas'); canvas.width=canvas.height=n;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#334d2a';ctx.fillRect(0,0,n,n);
  let seed=48117; const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<76000;i++){
    const x=random()*n,y=random()*n,length=2+random()*9,a=random()*Math.PI*2;
    const v=random();ctx.strokeStyle=v<.12?'#897f43':v<.36?'#203c24':v<.72?'#476539':'#597843';ctx.lineWidth=.5+random()*.8;
    const dx=Math.cos(a)*length,dy=Math.sin(a)*length;
    for(const ox of [-n,0,n])for(const oy of [-n,0,n]){if(x+ox+Math.abs(dx)<0||x+ox-Math.abs(dx)>n||y+oy+Math.abs(dy)<0||y+oy-Math.abs(dy)>n)continue;ctx.beginPath();ctx.moveTo(x+ox,y+oy);ctx.lineTo(x+ox+dx,y+oy+dy);ctx.stroke();}
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=8;
  // Separate data map: a subtle fibre normal, never interpreted as sRGB.
  const normalCanvas=document.createElement('canvas');normalCanvas.width=normalCanvas.height=256;
  const ng=normalCanvas.getContext('2d'),data=ng.createImageData(256,256);
  for(let i=0;i<data.data.length;i+=4){data.data[i]=122+random()*12;data.data[i+1]=122+random()*12;data.data[i+2]=254;data.data[i+3]=255;}ng.putImageData(data,0,0);
  const normal=new THREE.CanvasTexture(normalCanvas);normal.wrapS=normal.wrapT=THREE.RepeatWrapping;
  turf=new THREE.MeshStandardMaterial({map,normalMap:normal,normalScale:new THREE.Vector2(.2,.2),roughness:.96,metalness:0});
  turf.name='school-turf';return turf;
}

export function buildCampusDesign({out,facade,brick,concrete,metal,colliders}) {
  const design=new THREE.Group();design.name='campus-renovation';out.add(design);
  const steel=metal.clone();steel.color.set(0x39464a);steel.roughness=.65;
  const trim=new THREE.MeshStandardMaterial({color:0x929b97,roughness:.72,metalness:.3});
  const diffuser=new THREE.MeshStandardMaterial({color:0xf3e7ce,emissive:0xffd49a,emissiveIntensity:.7,roughness:.7});
  const positions=[[-4.3,15.5],[4.3,15.5],[-24.8,29],[24.8,29],[-24.8,50],[24.8,50],[-4.3,58.5],[4.3,58.5],[-4.3,65.5],[4.3,65.5],[-15.5,12.2],[23.5,12.2],[-11,-23],[11,-23]];
  const lights=[];
  const add=(parent,geometry,material,x,y,z)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=false;parent.add(m);return m;};
  for(const [x,z]of positions){
    const g=new THREE.Group();g.position.set(x,0,z);design.add(g);g.name='campus-lamp';
    add(g,new THREE.CylinderGeometry(.3,.34,.15,12),concrete,0,.075,0);
    add(g,new THREE.CylinderGeometry(.075,.12,4.5,10),steel,0,2.35,0);
    const arm=add(g,new THREE.BoxGeometry(.85,.07,.075),steel,x<0?.33:-.33,4.57,0);
    add(g,new THREE.BoxGeometry(.57,.12,.32),steel,arm.position.x,4.5,0);
    add(g,new THREE.BoxGeometry(.48,.025,.25),diffuser,arm.position.x,4.43,0);
    lights.push({x:x+arm.position.x,y:4.25,z,kind:'street',street:true});
    colliders.push({x1:x-.22,x2:x+.22,z1:z-.22,z2:z+.22,campusLamp:true});
  }
  // Horizontal courses and narrow brick piers align with floor slabs and wall
  // divisions, leaving existing windows, doors and roof access unobstructed.
  const front=new THREE.Group();front.name='school-facade-detail';facade.add(front);
  for(const y of [4.02,8.02,12.22])add(front,new THREE.BoxGeometry(73.1,.18,.18),trim,0,y,10.09);
  for(const x of [-36.45,-28,-20,-12,12,20,28,36.45])add(front,new THREE.BoxGeometry(.32,11.95,.13),brick,x,6,10.05);
  for(const x of [-36.45,36.45]){add(front,new THREE.BoxGeometry(.18,12,.35),concrete,x,6,-9.95);add(front,new THREE.BoxGeometry(.18,.2,20),trim,x,12.2,0);}
  // Slim entry canopy follows the existing porch footprint; no posts in the door.
  add(front,new THREE.BoxGeometry(6.2,.07,2.95),trim,0,3.245,11.325);
  const signCanvas=document.createElement('canvas');signCanvas.width=1024;signCanvas.height=256;const sc=signCanvas.getContext('2d');sc.fillStyle='#253b3e';sc.fillRect(0,0,1024,256);sc.strokeStyle='#b9ac85';sc.lineWidth=8;sc.strokeRect(12,12,1000,232);sc.fillStyle='#e8e3d2';sc.font='bold 94px sans-serif';sc.textAlign='center';sc.fillText('서 문 고 등 학 교',512,164);
  const signMap=new THREE.CanvasTexture(signCanvas);signMap.colorSpace=THREE.SRGBColorSpace;
  add(front,new THREE.BoxGeometry(5.6,.72,.08),steel,0,3.63,10.15);
  add(front,new THREE.PlaneGeometry(5.5,.67),new THREE.MeshStandardMaterial({map:signMap,roughness:.8}),0,3.63,10.197);
  return {lights,fixtureMaterial:diffuser,lampCount:positions.length};
}
