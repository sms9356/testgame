import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {treeCollider,TREE_HALF,CAMPUS_BOX} from '../neighborhood2008.js';
test('street tree colliders are trunk-sized and never inside the walkable campus box',()=>{
  const c=treeCollider(128.4,10);assert.ok(c);assert.ok(c.x2-c.x1<=.5&&c.z2-c.z1<=.5);assert.equal(c.h,undefined);
  assert.equal(treeCollider(0,0),null);assert.equal(treeCollider(-50,-100),null);
  const [a,b,z0]=CAMPUS_BOX;assert.equal(treeCollider(a+1,z0+1),null);assert.notEqual(treeCollider(b+1,0),null);
});
test('tree colliders cannot block spawn / entrance routes and are wired into game.js',async()=>{
  const [a,b,z0,z1]=CAMPUS_BOX;
  for(const [x,z] of [[0,78],[0,40],[0,8],[-30,60],[30,60]])assert.ok(x>a&&x<b&&z>z0&&z<z1&&!treeCollider(x,z));
  assert.ok(TREE_HALF*2<1);
  const g=await readFile(new URL('../game.js',import.meta.url),'utf8');
  assert.match(g,/installNeighborhood\(\{ scene, camera, colliders: floors\[0\]\.col \}\)/);
});
