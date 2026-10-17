import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.resolve(process.env.TESTGAME_ROOT || process.cwd());
const { GUARD_LAYOUT: G, GUARD_SPUR: S, GUARD_RAW_COLLIDERS, guardCollisionRects, guardWorld } = await import(pathToFileURL(path.join(root,'guardRoomLayout.js')).href);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5, a+' != '+b);
const overlap=(a,b)=>a.x1<b.x2&&a.x2>b.x1&&a.z1<b.z2&&a.z2>b.z1;
test('marker placement translates all anchors without resizing source',()=>{
  assert.deepEqual([G.cx,G.cz,G.width,G.depth,G.height],[6.5,66.5,3.5,2.8,2.5]);
  near(G.originX,4.75); near(G.originZ,67.9); near(G.doorX,6.55); near(G.doorZ,68.01);
  const old={cctv:[20.99,65.348],log:[21.21,65.51],lightSwitch:[21.64,66.2],gateSwitch:[23.35,63.85],npc:[21.15,66.05],cap:[21.48,65.51]};
  for(const [key,[x,z]] of Object.entries(old)){near(G[key].x,x-15.25);near(G[key].z,z+1.5);}
  near(guardWorld(0,0).x,G.originX); near(guardWorld(0,G.depth).z,G.originZ-G.depth);
  for(const [i,c] of guardCollisionRects().entries()){const raw=GUARD_RAW_COLLIDERS[i];near(c.x1,G.originX+raw.min[0]);near(c.x2,G.originX+raw.max[0]);near(c.z1,G.originZ-raw.max[1]);near(c.z2,G.originZ-raw.min[1]);}
});
test('room roof open door and short approach avoid gate fence and pillars',()=>{
  const room={x1:G.originX,x2:G.originX+G.width,z1:G.originZ-G.depth,z2:G.originZ};
  const roof={x1:G.originX-.18,x2:G.originX+G.width+.18,z1:G.originZ-G.depth-.18,z2:G.originZ+.18};
  const door={x1:G.doorX-.025,x2:G.doorX+.025,z1:G.doorZ,z2:G.doorZ+.85};
  const gate=[{x1:-50,x2:-4.5,z1:69.75,z2:70.25},{x1:4.5,x2:50,z1:69.75,z2:70.25},...[-4.5,4.5].map(x=>({x1:x-.8,x2:x+.8,z1:69.2,z2:70.8}))];
  for(const shape of [room,roof,door,S,...guardCollisionRects()])for(const obstacle of gate)assert.equal(overlap(shape,obstacle),false);
  assert.ok(room.x1>3.2); assert.equal(S.x1,3); assert.ok(S.x2-S.x1<5); assert.ok(S.z2-S.z1<=1.1);
  assert.ok(S.z2<=68.9);assert.ok(S.x1<G.doorX&&S.x2>G.doorX+.85);assert.ok(S.z1<=G.doorZ&&S.z2>=G.doorZ+.85);
  for(const c of guardCollisionRects())assert.equal(overlap(S,c),false);
});
test('world map and game use canonical placement instead of old guard anchors',async()=>{
  const [world,map,game]=await Promise.all(['world.js','map.js','game.js'].map(f=>readFile(path.join(root,f),'utf8')));
  assert.ok(world.includes('GUARD_SPUR.x1, GUARD_SPUR.x2, GUARD_SPUR.z1, GUARD_SPUR.z2'));
  assert.ok(world.includes('GUARD_LAYOUT.originX + 1.1, 2.30'));
  assert.ok(map.includes('X(GUARD_LAYOUT.cx), Y(GUARD_LAYOUT.cz)'));
  assert.ok(map.includes('GUARD_LAYOUT.originZ - GUARD_LAYOUT.depth'));
  assert.ok(game.includes('buildGuardhouseProps(V3(GUARD_LAYOUT.cx, 0, GUARD_LAYOUT.cz))'));
  assert.ok(game.includes('Math.hypot(P.x - GUARD_LAYOUT.cx, P.z - GUARD_LAYOUT.cz)'));
  assert.ok(game.includes("[GUARD_LAYOUT.cx, GUARD_LAYOUT.cz, '경비실"));
  for(const old of ['x > 19.1 && x < 24.4','P.x - 21.75','x: 21.75, z: 65.6'])assert.ok(!game.includes(old));
  assert.ok(!map.includes('fillRect(20, 63.6, 23.5, 66.4'));assert.ok(!map.includes('X(21.75), Y(65)'));
});
