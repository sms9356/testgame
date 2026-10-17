import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three.module.js';
import {collectCampusCctvFeeds} from '../campusCctvLive.js';

test('south-room transformed CCTV optical axis and floor elevation remain correct',()=>{
 const floor=new THREE.Group();floor.position.y=4;
 const south=new THREE.Group();south.rotation.y=Math.PI;floor.add(south);
 const mount=new THREE.Group();mount.position.set(-3.75,3.588,-2);mount.rotation.y=Math.PI*.75;south.add(mount);
 const lens=new THREE.Group();lens.rotation.x=.35;mount.add(lens);
 const f=collectCampusCctvFeeds([{id:'s',label:'2F classroom',floor:1,lens,eye:[0,-.24,.312],parent:south}])[0];
 assert.ok(f.position[0]>3);assert.ok(f.position[1]>7);assert.ok(f.position[2]>1.5);
 assert.ok(f.target[0]<f.position[0]);assert.ok(f.target[2]>f.position[2]);assert.ok(f.target[1]<f.position[1]);
});
test('registered CCTV mounts replace duplicate imported cameras and cover every area',async()=>{
 const w=await readFile(new URL('../world.js',import.meta.url),'utf8');
 assert.doesNotMatch(w,/model\('security_camera_01'/);
 assert.match(w,/const CCTV_CAMERAS = \[\]/);assert.match(w,/return \{ CCTV_CAMERAS,/);
 assert.match(w,/cctv\(cx - 3\.75, CH, -2\.0, Math\.PI \* \.75/);
 assert.match(w,/for \(const f of \[8,9,10\]\)/);
 for(const name of ['체육관 · 무대/코트','수영장 · 풀 홀','급식실 · 식당','옥상 · 발전기/출입구','경비실 · 관제 데스크'])assert.ok(w.includes(name));
 assert.match(w,/GATE_Z-\.79/);assert.match(w,/mountY:3\.388/);
});
test('guardroom uses real target textures, persistent channels and seated rig; recorded clues remain',async()=>{
 const g=await readFile(new URL('../game.js',import.meta.url),'utf8'),r=await readFile(new URL('../guardRoom.js',import.meta.url),'utf8');
 assert.match(g,/collectCampusCctvFeeds\(world.CCTV_CAMERAS\)/);
 assert.match(g,/setLiveTextures\(campusCctv.textures\)/);
 assert.match(g,/restoreChannels\(FL.guardCctvChannels/);assert.match(g,/applyGuardSeatedPose\(guardNPC,GUARD_LAYOUT.seat\)/);
 assert.doesNotMatch(g,/fzP\._drawCCTVFrame\(/);assert.match(g,/CCTV 녹화 — 10.12 23:31/);
 assert.match(r,/liveScreenMaterials\[i\]/);
});
