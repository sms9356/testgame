// NPC 길찾기(A*) · 상태 기계 — 브라우저 없이
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { gridFromAscii, astar, gridLOS, nearestFree, walkableAt, createNPC, stepNPC, talkTo, resetNPC, NPC_LINES, NPC_NAMES, NPC_HINT_MAIN, NPC_TALK_LABEL, labelComponents, compAt, makePortal, portalPos, routeHop, followGoal, followSpeed } from '../npcAI.js';
import { pickLine, newMemory, sanitizeMemory, mindStrings, CH_HINT, HINT_GAP, reactLine, canReact, markReact, MINA_LINES, hintLine, emotionOf, EMO_FOLLOW, EMO_LINE, lineText } from '../npcMind.js';

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
test('only Mina remains as a live NPC; every line is translated (en · ja · zh)', () => {
  assert.deepEqual(Object.keys(NPC_LINES), ['mina']); assert.deepEqual(Object.keys(NPC_NAMES), ['mina']);
  const L = NPC_LINES.mina, keys = [...L.greet, L.hint, NPC_HINT_MAIN, NPC_TALK_LABEL, '말 걸기 · 민아', ...mindStrings()];
  for (const code of ['en', 'ja', 'zh']) { const d = JSON.parse(fs.readFileSync(new URL(`../lang/${code}.json`, import.meta.url), 'utf8')); for (const k of keys) assert.ok(d[k], `${code}: ${k}`); }
  const game = fs.readFileSync(new URL('../game.js', import.meta.url), 'utf8');
  assert.ok(!/경비 아저씨'|청소 아주머니'|npcSchedules/.test(fs.readFileSync(new URL('../npcAI.js', import.meta.url), 'utf8')), 'no other live NPCs');
  assert.ok(/ANX_SCENES_NOW/.test(game) && /data-tape/.test(game), 'guard-room VCR has tonight\'s tape');
});

// 층 사이 길: 두 층(격자) + 계단 portal → 다익스트라 첫 hop, 계단 위 위치는 높이까지 보간
test('stairs: portal routing across layers and position along the 3D stair path', () => {
  const A = gridFromAscii(['#######', '#.....#', '#######']), B = gridFromAscii(['#######', '#.....#', '#######']);
  labelComponents(A); labelComponents(B);
  const p = makePortal(0, 1, [5.5, 0, 1.5, 5.5, 1.8, 1.5, 5.5, 3.6, 1.5]); p.ca = compAt(A, 5.5, 1.5); p.cb = compAt(B, 5.5, 1.5);
  assert.ok(Math.abs(p.len - 3.6) < 1e-5);
  const h = routeHop([p], 0, compAt(A, 1.5, 1.5), 1.5, 1.5, 1, compAt(B, 2.5, 1.5), 2.5, 1.5); assert.equal(h, p.fwd);
  assert.equal(routeHop([p], 1, 0, 1.5, 1.5, 0, 0, 1.5, 1.5), p.back);
  assert.equal(routeHop([p], 0, 0, 1, 1, 0, 0, 3, 1), null); assert.equal(routeHop([], 0, 0, 1, 1, 1, 0, 3, 1), false);
  const o = { si: 0 }; portalPos(p.fwd, 1.8, o); assert.ok(Math.abs(o.y - 1.8) < 1e-5); portalPos(p.back, .9, o); assert.ok(Math.abs(o.y - 2.7) < 1e-5);
  // 상태 기계가 계단을 실제로 걷는다: y 가 0 → 3.6 으로 이어지고, 도착 층이 바뀐다
  const grids = [A, B], env = { player: { on: false }, rand: () => .5, walkable: (f, x, z) => walkableAt(grids[f], x, z), event() {},
    route: (n, tk) => routeHop([p], n.f, compAt(grids[n.f], n.x, n.z), n.x, n.z, tk.f, compAt(grids[tk.f], tk.x, tk.z), tk.x, tk.z),
    plan(n, gx, gz) { n.pn = astar(grids[n.f], n.x, n.z, gx, gz, n.path); n.pi = 0; return n.pn > 0; } };
  const n = createNPC({ id: 'm', f: 0, x: 1.5, z: 1.5, tasks: [{ f: 1, x: 2.5, z: 1.5, act: 'wait', dur: 1 }], speed: 1.5 });
  let ys = []; for (let i = 0; i < 600; i++) { stepNPC(n, 1 / 30, env); if (n.state === 'stair') ys.push(n.y); else assert.ok(walkableAt(grids[n.f], n.x, n.z)); }
  assert.ok(ys.length > 20 && ys[0] < .2 && ys.at(-1) > 3.3, 'climbed visibly'); for (let i = 1; i < ys.length; i++) assert.ok(ys[i] >= ys[i - 1] - 1e-6);
  assert.equal(n.f, 1); assert.equal(n.stairs, 1); assert.ok(Math.hypot(n.x - 2.5, n.z - 1.5) < .05);
});
test('follow helpers: goal behind the player, falls back sideways; speed tiers', () => {
  const G = gridFromAscii(['#####', '#...#', '#...#', '#...#', '#####']);
  const g = followGoal(2.5, 2.5, 0, (x, z) => walkableAt(G, x, z), 1); assert.deepEqual([g.x, g.z], [2.5, 1.5]);   // 앞(+z) 을 보면 뒤(-z)
  const g2 = followGoal(2.5, 1.5, 0, (x, z) => walkableAt(G, x, z), 1); assert.ok(walkableAt(G, g2.x, g2.z) && !(g2.x === 2.5 && g2.z === 1.5));
  assert.equal(followSpeed(true, 1.5), 0); assert.equal(followSpeed(true, 3), 1.5); assert.ok(followSpeed(true, 9) > 3); assert.ok(followSpeed(false, 1) > 3);
});

// 대사: 처음 인사 → 홀수 번째 장 힌트가 막연 → 장소 → 방법으로, HINT_GAP 안에 또 물으면 다른 얘기 · 정답(숫자)은 말하지 않는다
test('dialogue: gradual hint escalation with memory, never spoils answers', () => {
  const L = NPC_LINES.mina, c = { ch: 2, main: '금고를 열어라', where: '본관 1층 · 교무실' }, m = newMemory();
  const say = t => pickLine('mina', L, c, m, t, NPC_HINT_MAIN);
  assert.equal(say(0).topic, 'greet');
  const h0 = say(1); assert.equal(h0.topic, 'hint'); assert.equal(h0.tier, 0); assert.equal(h0.text, CH_HINT[2][0]);
  say(2); const quick = say(5); assert.notEqual(quick.topic, 'hint', 'no escalation spam');
  say(6); const h1 = say(1 + HINT_GAP + 1); assert.equal(h1.tier, 1); assert.ok(h1.text.includes('교무실'));
  say(60); const h2 = say(1 + 2 * HINT_GAP + 5); assert.equal(h2.tier, 2); assert.equal(h2.text, CH_HINT[2][1]);
  for (const s of mindStrings()) assert.ok(!/1012|2250|\d{4}/.test(s), 'no codes: ' + s);
  // 새 장이면 다시 막연하게
  m.n = 1; const n0 = pickLine('mina', L, { ...c, ch: 3 }, m, 500, NPC_HINT_MAIN); assert.equal(n0.tier, 0);
  // 어두우면(차단기) 그 얘기부터, 두 단계까지
  const m2 = newMemory(); pickLine('mina', L, c, m2, 0, NPC_HINT_MAIN); const d0 = pickLine('mina', L, { ...c, dark: true }, m2, 1, NPC_HINT_MAIN), d1 = pickLine('mina', L, { ...c, dark: true }, m2, 2, NPC_HINT_MAIN);
  assert.equal(d0.topic, 'dark'); assert.equal(d1.topic, 'dark'); assert.notEqual(d0.text, d1.text);
  // 상황 대사는 한 번씩
  const m3 = newMemory(); m3.n = 2; const a = pickLine('mina', L, { ch: 9, keys: 2 }, m3, 0, NPC_HINT_MAIN), b = pickLine('mina', L, { ch: 9, keys: 2 }, m3, 1, NPC_HINT_MAIN);
  assert.equal(a.topic, 'keys'); assert.notEqual(b.topic, 'keys');
});
test('memory persistence: JSON round-trip keeps hint tiers and told lines; junk/old data is sanitized', () => {
  const L = NPC_LINES.mina, m = newMemory(); for (let t = 0; t < 6; t++) pickLine('mina', L, { ch: 4 }, m, t * 50, NPC_HINT_MAIN);
  markReact(m, 'room', 10);
  const back = sanitizeMemory(JSON.parse(JSON.stringify(m))); assert.deepEqual(back, m);
  assert.equal(pickLine('mina', L, { ch: 4 }, back, 1000, NPC_HINT_MAIN).tier, pickLine('mina', L, { ch: 4 }, m, 1000, NPC_HINT_MAIN).tier);
  assert.deepEqual(sanitizeMemory(null), newMemory()); assert.deepEqual(sanitizeMemory({ n: 'x', told: [1], tier: { ch1: 9 } }).tier, { ch1: 2 });
  assert.ok(!canReact(m, 'room', 20, 60) && canReact(m, 'room', 80, 60) && canReact(m, 'room', 5, 60));   // 세이브 시각이 거꾸로면 허용
  assert.ok(reactLine('room', 'mina', 0).includes('{}'));
});

test('Mina line table: every id has ko/en/ja/zh and matches lang/*.json; emotions and stuck hints', () => {
  const langs = ['en', 'ja', 'zh'].map(c => JSON.parse(fs.readFileSync(new URL(`../lang/${c}.json`, import.meta.url), 'utf8')));
  for (const id in MINA_LINES) { const r = MINA_LINES[id]; assert.equal(r.length, 4, id); r.forEach(t => assert.ok(t && typeof t === 'string', id)); langs.forEach((d, i) => assert.equal(d[r[0]], r[i + 1], id)); }
  for (const id of ['notice_0', 'notice_1', 'stuck_0', 'stuck_fail', 'emo_calm', 'emo_uneasy', 'emo_curious', 'emo_relieved']) assert.ok(MINA_LINES[id], id);
  assert.equal(lineText('emo_uneasy', 'en'), MINA_LINES.emo_uneasy[1]);
  assert.equal(emotionOf({ dark: true, emo: 'relieved', until: 99 }, 1), 'uneasy'); assert.equal(emotionOf({ emo: 'curious', until: 10 }, 5), 'curious'); assert.equal(emotionOf({ emo: 'curious', until: 10 }, 11), 'calm');
  assert.ok(EMO_FOLLOW.uneasy[0] < EMO_FOLLOW.calm[0] && EMO_FOLLOW.curious[0] > EMO_FOLLOW.calm[0]); assert.ok(EMO_LINE.relieved);
  const m = newMemory(), L = { greet: ['a'], hint: '{}?' }, c = { ch: 6, where: '방송실' };
  assert.equal(hintLine(L, c, m, 0, '{}').tier, 0); assert.equal(hintLine(L, c, m, 5, '{}'), null); assert.equal(hintLine(L, c, m, 5 + HINT_GAP, '{}').text, '방송실?'); assert.equal(hintLine(L, c, m, 10 + 2 * HINT_GAP, '{}').tier, 2);
});

test('walkie-talkie partner: graded hints with memory, stuck -> hint first, no spoilers', async () => {
  const { partnerReply, RADIO_L } = await import('../partnerRadio.js');
  const m = newMemory(), c = { ch: 1, main: '캠코더를 찾아라', where: '1학년 1반' };
  assert.equal(partnerReply(c, m, 0).topic, 'greet');
  const h0 = partnerReply(c, m, 1); assert.equal(h0.text, RADIO_L.ch[1][0]);
  const s = partnerReply({ ...c, stuckSec: 400 }, m, 1 + HINT_GAP); assert.ok(s.intro && s.tier === 1 && s.text.includes('1학년 1반'));
  const back = sanitizeMemory(JSON.parse(JSON.stringify(m))); assert.deepEqual(back, m);
  for (const k in RADIO_L.ch) RADIO_L.ch[k].forEach(t => assert.ok(!/\d{4}/.test(t)));
  for (const id of Object.keys(MINA_LINES).filter(k => k.startsWith('radio_'))) assert.equal(MINA_LINES[id].length, 4);
});
