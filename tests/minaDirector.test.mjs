// 민아 연출 계층: 반복 제어 · 말 차례(우선순위 큐) · 공용 힌트 감독 · 대기 행동 · 시야 판정
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLineGate, createSpeechQueue, PRIO, createHintDirector, HINT_FREQ, approach, turnSpeed, idleBehavior, occludes, canTeleportUnseen, MUTTER_IDS, EXAM_IDS, BANTER_N } from '../minaDirector.js';
import { MINA_LINES, HINT_GAP, newMemory, pickLine, CH_HINT } from '../npcMind.js';
import { partnerReply, RADIO_L, banterPick } from '../partnerRadio.js';
import { NPC_LINES, NPC_HINT_MAIN } from '../npcAI.js';
import { parseSET } from '../settings.js';

// 결정적 난수
const lcg = (s = 7) => () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

test('line gate: same line never repeats inside the window; per-line cooldowns; variety weighting', () => {
  const G = createLineGate({ window: 300, cd: { b: 60 } }), r = lcg();
  assert.ok(G.canSay('a', 0)); G.mark('a', 0);
  assert.ok(!G.canSay('a', 299)); assert.ok(G.canSay('a', 300));
  G.mark('b', 0); assert.ok(G.canSay('b', 60), 'per-line cooldown overrides window');
  // 10줄 혼잣말을 30초마다 1시간: 5분 안에 같은 줄 0번, 모든 줄이 고르게
  const H = createLineGate({ window: 300 }), seen = new Map(), uses = {}; let repeats = 0, said = 0;
  for (let t = 0; t < 3600; t += 30) { const id = H.pick(MUTTER_IDS, t, r); if (!id) continue; if (seen.has(id) && t - seen.get(id) < 300) repeats++; seen.set(id, t); H.mark(id, t); said++; uses[id] = (uses[id] || 0) + 1; }
  assert.equal(repeats, 0); assert.ok(said >= 100, 'still talks: ' + said);
  const u = Object.values(uses); assert.equal(u.length, MUTTER_IDS.length); assert.ok(Math.max(...u) - Math.min(...u) <= 3, 'balanced ' + u);
  assert.equal(H.stats.repeats, 0);
  // 다 막히면 null (조용히)
  const K = createLineGate({ window: 100 }); K.mark('x', 0); assert.equal(K.pick(['x'], 50, r), null); assert.equal(K.stats.blocked, 1);
  // 저장 · 복원
  const S = createLineGate(); S.mark('q', 10); const T = createLineGate(); T.restore(JSON.parse(JSON.stringify(S.serialize()))); assert.ok(!T.canSay('q', 20)); T.restore({ bad: 'x', q: [NaN] }); assert.ok(T.canSay('q', 20));
  // 예전 방식(무작위 고르기) 비교: 같은 조건에서 5분 안 반복이 생긴다 — 개선 확인
  let old = 0; const om = new Map(); for (let t = 0; t < 3600; t += 30) { const id = MUTTER_IDS[(r() * 7) | 0]; if (om.has(id) && t - om.get(id) < 300) old++; om.set(id, t); }
  assert.ok(old > 10, 'baseline repeats ' + old);
});

test('speech queue: priority order, no talking while busy, gaps, ttl expiry, dedupe, capacity', () => {
  const Q = createSpeechQueue({ max: 3, gap: 1 });
  Q.push({ key: 'i', text: 'idle', prio: PRIO.idle }, 0); Q.push({ key: 'h', text: 'hint', prio: PRIO.hint, dur: 2 }, 0); Q.push({ key: 'r', text: 'react', prio: PRIO.react }, 0);
  assert.equal(Q.next(0, true), null, 'story/subtitle busy → wait');
  const a = Q.next(0, false); assert.equal(a.text, 'hint');
  assert.equal(Q.next(2.5, false), null, 'still inside dur+gap'); assert.equal(Q.next(3.1, false).text, 'react');
  assert.equal(Q.push({ key: 'i', text: 'idle', prio: PRIO.idle }, 3), false, 'dedupe'); assert.equal(Q.stats.deduped, 1);
  Q.push({ key: 'z', text: 'z', prio: PRIO.comment, ttl: 1 }, 3); assert.equal(Q.next(30, false), null, 'both expired'); assert.equal(Q.size, 0);
  // 용량: 낮은 우선순위부터 버린다
  const C = createSpeechQueue({ max: 2 }); C.push({ text: 'a', prio: 10 }, 0); C.push({ text: 'b', prio: 50 }, 0); C.push({ text: 'c', prio: 30 }, 0);
  assert.deepEqual(C.items.map(e => e.text).sort(), ['b', 'c']);
  // 같은 우선순위는 먼저 온 순서
  const F = createSpeechQueue({ gap: 0 }); F.push({ text: '1', prio: 5, dur: 0 }, 0); F.push({ text: '2', prio: 5, dur: 0 }, 0); assert.equal(F.next(0, false).text, '1'); assert.equal(F.next(0.01, false).text, '2');
  // hold: 플레이어가 말을 걸면 큐는 그동안 기다린다 · clear: 낮은 것만 버린다
  const H = createSpeechQueue(); H.push({ text: 'x', prio: PRIO.idle }, 0); H.push({ text: 'y', prio: PRIO.hint }, 0); H.hold(0, 5); assert.equal(H.next(4, false), null); H.clear(PRIO.hint); assert.equal(H.size, 1); assert.equal(H.next(5.1, false).text, 'y');
});

test('hint director: single escalation shared by Mina and radio, no duplicates, frequency setting', () => {
  const D = createHintDirector(), c = { ch: 2, main: '금고 열기', where: '교무실' };
  const h0 = D.request('mina', NPC_LINES.mina, c, 0, NPC_HINT_MAIN); assert.equal(h0.tier, 0); assert.equal(h0.src, 'mina');
  assert.equal(D.request('radio', RADIO_L, c, 5, '{}'), null, 'radio does not pile a hint right after Mina');
  assert.equal(D.request('mina', NPC_LINES.mina, c, 10, NPC_HINT_MAIN), null, 'too soon to escalate');
  const h1 = D.request('radio', RADIO_L, c, HINT_GAP + 1, '{}'); assert.equal(h1.tier, 1, 'radio continues the same ladder (place)');
  assert.ok(h1.text.includes('교무실'));
  const h2 = D.request('mina', NPC_LINES.mina, c, 2 * HINT_GAP + 2, NPC_HINT_MAIN); assert.equal(h2.tier, 2); assert.equal(h2.text, CH_HINT[2][1]);
  assert.equal(D.tier(2), 2); assert.equal(D.request('mina', NPC_LINES.mina, c, 9e3, NPC_HINT_MAIN).tier, 2, 'stays at the most specific tier');
  // 다른 장은 따로
  assert.equal(D.request('mina', NPC_LINES.mina, { ch: 3 }, 9e3 + 100, NPC_HINT_MAIN).tier, 0);
  // 빈도: 적게 → 간격 두 배 · 막힘 기준 늦게 · 보드 제안 숨김(단계 0) / 많이 → 빠르게
  const L = createHintDirector({ freq: 'low' }), Hh = createHintDirector({ freq: 'high' });
  assert.equal(L.gap(), HINT_GAP * HINT_FREQ.low.gap); assert.ok(Hh.gap() < HINT_GAP); assert.ok(L.stuckAfter(240) > 240 && Hh.stuckAfter(240) < 240);
  assert.equal(L.boardSuggestions(1), 0); assert.equal(Hh.boardSuggestions(1), 3);
  L.request('mina', NPC_LINES.mina, c, 0, NPC_HINT_MAIN); assert.equal(L.request('mina', NPC_LINES.mina, c, HINT_GAP + 1, NPC_HINT_MAIN), null, 'low: not yet');
  assert.ok(L.request('mina', NPC_LINES.mina, c, HINT_GAP * 2 + 1, NPC_HINT_MAIN)); assert.equal(L.boardSuggestions(2), 1);
  Hh.request('mina', NPC_LINES.mina, c, 0, NPC_HINT_MAIN); assert.ok(Hh.request('mina', NPC_LINES.mina, c, HINT_GAP * .5 + 1, NPC_HINT_MAIN), 'high: sooner');
  D.setFreq('bogus'); assert.equal(D.freq, 'normal');
  // 저장 · 예전 세이브 합치기
  const S = createHintDirector(); S.restore(JSON.parse(JSON.stringify(D.serialize()))); assert.equal(S.tier(2), 2);
  const A = createHintDirector(); A.absorb({ tier: { ch1: 2, dark: 1 }, hintAt: { ch1: 50 } }); assert.equal(A.tier(1), 2); assert.equal(A.st.tier.dark, undefined);
  A.restore({ tier: { ch1: 9 } }); assert.equal(A.tier(1), 2);
});

test('talking to Mina and calling the radio walk one hint ladder (pickLine/partnerReply with the director)', () => {
  const D = createHintDirector(), c = { ch: 4, main: '교장실', where: '교장실', stuckSec: 0 };
  const mm = newMemory(), pm = newMemory(); let t = 0; const tiers = [];
  for (let i = 0; i < 8; i++) { t += 25;
    const r = i % 2 ? partnerReply({ ...c, stuckSec: 400 }, pm, t, D) : pickLine('mina', NPC_LINES.mina, c, mm, t, NPC_HINT_MAIN, () => D.request('mina', NPC_LINES.mina, c, t, NPC_HINT_MAIN, { force: true }));
    if (r.topic === 'hint') tiers.push(r.tier); }
  assert.ok(tiers.length >= 2); for (let i = 1; i < tiers.length; i++) assert.ok(tiers[i] > tiers[i - 1] || tiers[i] === 2, 'never repeats or goes backwards: ' + tiers);
  assert.ok(!mm.tier.ch4 && !pm.tier.ch4, 'no private ladders when the director is used');
});

test('behaviour helpers: smooth speed, turning arcs, idle choices, view occlusion, unseen teleport', () => {
  let v = 0; for (let i = 0; i < 10; i++) v = approach(v, 1.5, .05); assert.ok(v > .9 && v < 1.5, 'accelerates gradually ' + v);
  for (let i = 0; i < 100; i++) v = approach(v, 0, .05); assert.equal(v, 0);
  assert.equal(turnSpeed(0), 1); assert.ok(turnSpeed(1.5) < .5 && turnSpeed(1.5) >= .3);
  assert.equal(idleBehavior({ still: 1, pIdle: 0, emo: 'calm', r: .1 }), 'none');
  assert.equal(idleBehavior({ still: 6, pIdle: 0, emo: 'uneasy', r: .9 }), 'hug');
  assert.equal(idleBehavior({ still: 20, pIdle: 60, emo: 'calm', r: .9 }), 'sit');
  assert.equal(idleBehavior({ still: 9, pIdle: 0, emo: 'calm', wall: true, r: .9 }), 'lean');
  assert.equal(idleBehavior({ still: 7, pIdle: 0, emo: 'calm', r: .1 }), 'phone');
  assert.equal(idleBehavior({ still: 9, pIdle: 0, emo: 'calm', r: .9, cur: 'phone' }), 'phone', 'keeps the pose (no flicker)');
  assert.ok(occludes(0, 0, 0, 4, .1, 2)); assert.ok(!occludes(0, 0, 0, 4, 1, 2)); assert.ok(!occludes(0, 0, 0, 4, 0, -1), 'behind the camera'); assert.ok(!occludes(0, 0, 0, 4, 0, 4.5));
  assert.ok(canTeleportUnseen(0, 0, 0, 1, 0, -3, true), 'behind the player'); assert.ok(!canTeleportUnseen(0, 0, 0, 1, 0, 5, true), 'in front, visible');
  assert.ok(canTeleportUnseen(0, 0, 0, 1, 0, 5, false), 'behind a wall'); assert.ok(!canTeleportUnseen(0, 0, 0, 1, .1, .1, false), 'too close');
});

test('new Mina lines: in MINA_LINES (4 languages), ids referenced by the director exist; banter sets', () => {
  const ids = [...MUTTER_IDS, ...Object.values(EXAM_IDS).flat(), 'exam_event', 'exam_link', 'board_contra_0', 'board_contra_1', 'board_sugg', 'sound_look', 'idle_sit', 'idle_phone', 'sep_found'];
  for (let k = 0; k < BANTER_N; k++) ids.push(`radio_banter${k}_a`, `banter${k}_m`, `radio_banter${k}_b`);
  for (const id of ids) { assert.ok(MINA_LINES[id], id); assert.equal(MINA_LINES[id].length, 4); }
  for (const id of ['exam_link', 'board_contra_0', 'board_contra_1', 'board_sugg']) MINA_LINES[id].forEach(s => assert.ok(s.includes('{}'), id));
  assert.equal(banterPick([]), 0); assert.equal(banterPick([0, 1]), 2); assert.equal(banterPick([0, 1, 2, 3]), -1);
});

test('settings: hint frequency defaults to normal and rejects junk', () => {
  assert.equal(parseSET('{}').hintFreq, 'normal'); assert.equal(parseSET('{"hintFreq":"low"}').hintFreq, 'low'); assert.equal(parseSET('{"hintFreq":"lots"}').hintFreq, 'normal');
});
