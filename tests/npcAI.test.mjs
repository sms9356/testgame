// NPC 길찾기(A*) · 상태 기계 — 브라우저 없이
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { gridFromAscii, astar, gridLOS, nearestFree, walkableAt, createNPC, stepNPC, talkTo, resetNPC, npcSchedules, NPC_LINES, NPC_NAMES, NPC_HINT_MAIN, NPC_TALK_LABEL } from '../npcAI.js';

const MAP = [
  '##########',
  '#........#',
  '#.######.#',
  '#.#....#.#',
  '#.#.##.#.#',
  '#...##...#',
  '##########',
];
const pathPts = (out, n) => Array.from({ length: n }, (_, i) => [out[i * 2], out[i * 2 + 1]]);
const segsClear = (G, sx, sz, pts) => { let ax = sx, az = sz; for (const [x, z] of pts) { if (!gridLOS(G, ax, az, x, z)) return false; ax = x; az = z; } return true; };

test('A*: finds a path around walls and every segment stays on walkable cells', () => {
  const G = gridFromAscii(MAP), out = new Float32Array(64);
  const n = astar(G, 3.5, 4.5, 6.5, 4.5, out);   // 가운데 기둥(##) 때문에 위로 돌아간다
  assert.ok(n > 0);
  const pts = pathPts(out, n); assert.deepEqual(pts[n - 1], [6.5, 4.5]);
  assert.ok(segsClear(G, 3.5, 4.5, pts), 'path crosses a wall');
  assert.ok(pts.some(([, z]) => z < 4), 'path must go around the pillar');
});
test('A*: long route through the outer ring, no corner cutting', () => {
  const G = gridFromAscii(MAP), out = new Float32Array(64);
  const n = astar(G, 1.5, 1.5, 8.5, 5.5, out); assert.ok(n >= 2);
  assert.ok(segsClear(G, 1.5, 1.5, pathPts(out, n)));
});
test('A*: unreachable goal returns 0 · goal inside wall snaps to nearest free cell', () => {
  const G = gridFromAscii(['#####', '#.#.#', '#####']), out = new Float32Array(32);
  assert.equal(astar(G, 1.5, 1.5, 3.5, 1.5, out), 0);
  const G2 = gridFromAscii(MAP); const c = nearestFree(G2, 4.5, 4.5, 2); assert.ok(c >= 0 && G2.w[c] === 1);
  assert.ok(astar(G2, 1.5, 1.5, 4.5, 4.5, out) > 0);
});
test('A*: repeated searches reuse buffers (stamps) and stay correct', () => {
  const G = gridFromAscii(MAP), out = new Float32Array(64);
  for (let i = 0; i < 50; i++) { const n = astar(G, 1.5, 1.5 + (i % 4), 8.5, 5.5, out); assert.ok(n > 0); }
});

// 상태 기계: 격자 위에서 실제로 걷는다
function makeEnv(G, player = { x: -99, z: -99, f: 0, on: false }) {
  const ev = [];
  return { ev, player, rand: () => .5, walkable: (f, x, z) => walkableAt(G, x, z), stair: () => ({ x: 1.5, z: 1.5 }),
    plan(n, gx, gz) { n.pn = astar(G, n.x, n.z, gx, gz, n.path); n.pi = 0; return n.pn > 0; }, event(n, type, tk) { ev.push(type + ':' + (tk ? tk.act : '')); } };
}
test('NPC state machine: idle → walk → act → next task, reaches every waypoint without entering walls', () => {
  const G = gridFromAscii(MAP), env = makeEnv(G);
  const n = createNPC({ id: 't', tasks: [{ f: 0, x: 8.5, z: 5.5, act: 'look', dur: 1 }, { f: 0, x: 3.5, z: 3.5, act: 'desk', dur: 1 }, { f: 0, x: 1.5, z: 1.5, act: 'look', dur: 1 }], speed: 1.5 });
  const seen = new Set();
  for (let i = 0; i < 2000; i++) { stepNPC(n, 1 / 30, env); seen.add(n.state); assert.ok(walkableAt(G, n.x, n.z), `in wall at ${n.x},${n.z}`); }
  assert.ok(n.arrivals >= 3, 'arrivals ' + n.arrivals); assert.ok(seen.has('walk') && seen.has('act') && seen.has('idle'));
  assert.equal(n.replans, 0); assert.ok(env.ev.includes('arrive:desk') && env.ev.includes('done:look'));
});
test('NPC: yields to a player blocking the corridor, then resumes and arrives', () => {
  const G = gridFromAscii(['#########', '#.......#', '#.......#', '#.......#', '#########']), P = { x: 5, z: 2.5, f: 0, on: true }, env = makeEnv(G, P);
  const n = createNPC({ id: 'y', x: 1.5, z: 2.5, tasks: [{ f: 0, x: 7.5, z: 2.5, act: 'look', dur: 30 }], speed: 1.2 });
  let yielded = false; for (let i = 0; i < 300; i++) { stepNPC(n, 1 / 30, env); if (n.state === 'yield') yielded = true; }
  assert.ok(yielded, 'should step aside'); assert.ok(Math.hypot(n.x - P.x, n.z - P.z) > .9, 'keeps distance');
  P.x = -50; P.on = false; for (let i = 0; i < 600; i++) stepNPC(n, 1 / 30, env);
  assert.equal(n.state, 'act'); assert.ok(Math.hypot(n.x - 7.5, n.z - 2.5) < .05);
});
test('NPC: talk interrupts and faces the player, then resumes; reset is deterministic', () => {
  const G = gridFromAscii(MAP), P = { x: 1.5, z: 3.5, f: 0, on: true }, env = makeEnv(G, P);
  const n = createNPC({ id: 'k', tasks: [{ f: 0, x: 8.5, z: 1.5, act: 'look', dur: 2 }] });
  for (let i = 0; i < 20; i++) stepNPC(n, 1 / 30, env);
  talkTo(n, 1); assert.equal(n.state, 'talk'); const x = n.x;
  for (let i = 0; i < 25; i++) stepNPC(n, 1 / 30, env); assert.equal(n.x, x, 'no walking while talking');
  for (let i = 0; i < 20; i++) stepNPC(n, 1 / 30, env); assert.notEqual(n.state, 'talk');
  resetNPC(n); assert.equal(n.state, 'idle'); assert.equal(n.ti, -1); assert.equal(n.x, 8.5);
});
test('NPC: different-floor task goes via stair state', () => {
  const G = gridFromAscii(MAP), env = makeEnv(G);
  const n = createNPC({ id: 's', f: 0, x: 8.5, z: 5.5, tasks: [{ f: 1, x: 3.5, z: 3.5, act: 'check', dur: 1 }] });
  const st = new Set(); for (let i = 0; i < 1500; i++) { stepNPC(n, 1 / 30, env); st.add(n.state); }
  assert.ok(st.has('stair')); assert.equal(n.f, 1);
});
test('NPC schedules and every new line are translated (en · ja · zh)', () => {
  const keys = [...Object.values(NPC_NAMES), NPC_HINT_MAIN, NPC_TALK_LABEL];
  for (const L of Object.values(NPC_LINES)) keys.push(L.bark, L.hint, ...L.greet, ...(L.phone ? [L.phone] : []));
  for (const code of ['en', 'ja', 'zh']) { const d = JSON.parse(fs.readFileSync(new URL(`../lang/${code}.json`, import.meta.url), 'utf8')); for (const k of keys) assert.ok(d[k], `${code}: ${k}`); }
  for (const s of npcSchedules()) assert.ok(s.tasks.length >= 2 && NPC_LINES[s.id] && NPC_NAMES[s.id]);
});
