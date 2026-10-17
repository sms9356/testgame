import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createCampusCctvLive } from '../campusCctvLive.js';

function fixture(throws = false, feeds = [{id:'a',label:'North',floor:1,position:[0,2,4],target:[0,0,0]}]) {
  const scene = new THREE.Scene(), interior = new THREE.Group(), shell = new THREE.Group();
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  const state = { target:null, viewport:new THREE.Vector4(3,4,800,600), scissor:new THREE.Vector4(1,2,30,40), scissorTest:true, autoClear:false, xr:true, shadow:true, renders:0,camPositions:[],targets:[] };
  const renderer = { xr:{get enabled(){return state.xr},set enabled(v){state.xr=v}}, shadowMap:{get autoUpdate(){return state.shadow},set autoUpdate(v){state.shadow=v}}, get autoClear(){return state.autoClear},set autoClear(v){state.autoClear=v}, getRenderTarget(){return state.target},setRenderTarget(v){state.target=v},getViewport(v){return v.copy(state.viewport)},setViewport(...a){state.viewport=a[0]?.isVector4?a[0].clone():new THREE.Vector4(...a)},getScissor(v){return v.copy(state.scissor)},setScissor(...a){state.scissor=a[0]?.isVector4?a[0].clone():new THREE.Vector4(...a)},getScissorTest(){return state.scissorTest},setScissorTest(v){state.scissorTest=v},clear(){},render(s,camera){state.renders++;state.camPositions.push(camera.position.toArray());state.targets.push(state.target.texture);if(throws)throw Error('render failed')} };
  const api=createCampusCctvLive({renderer,scene,feeds,floorRoots:[{floor:1,interior,shell}],monitorMeshes:[monitor],initialChannels:['a']});
  return {api,state,interior,shell,monitor};
}
test('independent targets and power/proximity scheduling',()=>{const {api,state}=fixture();assert.equal(api.textures.length,3);assert.equal(new Set(api.textures).size,3);api.tick(1,{powered:false,near:true});assert.equal(state.renders,0);api.tick(.2,{powered:true,near:true});assert.equal(state.renders,1);api.tick(1,{powered:true,near:false});assert.equal(state.renders,1);api.open();api.tick(.2,{powered:true,near:false});assert.equal(state.renders,2);api.dispose()});
test('restores all renderer/object state after throw',()=>{const {api,state,interior,shell,monitor}=fixture(true);assert.throws(()=>api.tick(.2,{powered:true,near:true}),/render failed/);assert.equal(state.target,null);assert.deepEqual(state.viewport.toArray(),[3,4,800,600]);assert.deepEqual(state.scissor.toArray(),[1,2,30,40]);assert.equal(state.scissorTest,true);assert.equal(state.autoClear,false);assert.equal(state.xr,true);assert.equal(state.shadow,true);assert.equal(interior.visible,true);assert.equal(shell.visible,true);assert.equal(monitor.visible,true);api.dispose()});
test('filters restored channel ids and disposes safely',()=>{const {api}=fixture();api.restoreChannels(['bad','a']);assert.deepEqual(api.channels,['a','a','a']);api.dispose();api.dispose()});

test('chosen monitor channel stays on its selected feed and target',()=>{const feeds=['a','b','c'].map((id,i)=>({id,label:id,floor:1,position:[i*10,2,4],target:[0,0,0]}));const {api,state}=fixture(false,feeds);api.restoreChannels(['c','a','b']);for(let i=0;i<3;i++)api.tick(.2,{powered:true,near:true});assert.deepEqual(state.camPositions,[[20,2,4],[0,2,4],[10,2,4]]);state.targets.forEach((t,i)=>assert.equal(t,api.textures[i]));assert.deepEqual(api.diagnostics.channelFeedIds,['c','a','b']);assert.equal(api.diagnostics.renderCount,3);api.dispose();});
