// 민아와 가구 · 소지품 · 장식: 자리 고르기 · 보여주기 대사 고르기/기억 · 장식 종류
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickSeat, seatAcross, seatHeight, seatFront, itemComment, itemCat, ITEM_CAT, ITEM_SPECIAL, radioItemLine, decorFor, INTERACT_LINE_IDS } from '../minaInteract.js';
import { MINA_LINES, newMemory, sanitizeMemory } from '../npcMind.js';
import { ITEMS } from '../story.js';

const seats = [
  { x: 2, y: .45, z: 0, floor: 0, yaw: -Math.PI / 2, kind: 'chair', building: 'main' },   // 플레이어(0,0) 쪽을 본다
  { x: 0, y: .45, z: 3, floor: 0, yaw: 0, kind: 'chair', building: 'main' },              // 등을 돌린 자리
  { x: 1, y: 4.05, z: 0, floor: 1, yaw: 0, kind: 'chair', building: 'main' },             // 윗층
  { x: 30, y: .45, z: 0, floor: 0, yaw: 0, kind: 'bench', building: 'main' },             // 멀다
  { x: .3, y: .45, z: .2, floor: 0, yaw: 0, kind: 'chair', building: 'main' },            // 플레이어가 앉은 자리
];

test('seat selection: same floor, near the player, prefers facing the player, skips the player seat; absent registry → null', () => {
  const s = pickSeat(seats, { floorY: 0, px: 0, pz: 0, mx: 1, mz: 1 });
  assert.equal(s, seats[0]);
  assert.equal(pickSeat(null, { floorY: 0, px: 0, pz: 0, mx: 0, mz: 0 }), null);
  assert.equal(pickSeat([], { floorY: 0, px: 0, pz: 0, mx: 0, mz: 0 }), null);
  assert.equal(pickSeat(seats, { floorY: 3.6, px: -.5, pz: 0, mx: 1, mz: 0 }), seats[2], 'upper floor only');
  assert.equal(pickSeat(seats, { floorY: 0, px: 0, pz: 0, mx: 0, mz: 0, ok: () => false }), null, 'unreachable fronts skipped');
  assert.equal(pickSeat([{ x: NaN, z: 0 }, null, { x: 1.5, z: 0, yaw: 0 }], { floorY: 0, px: 0, pz: 0, mx: 0, mz: 0 }).x, 1.5, 'tolerates junk; y missing = floor level');
  assert.ok(Math.abs(seatHeight(seats[2], 3.6) - .45) < 1e-9); assert.equal(seatHeight({ y: .05 }, 0), .45); assert.ok(Math.abs(seatHeight({ y: .5 }, 0) - .5) < 1e-9);
  const f = seatFront(seats[0]); assert.ok(f.x < 2 && Math.abs(f.z) < 1e-9);
});

test('seat across: in front of the seated player and facing back; same-facing seats rejected', () => {
  const ps = { x: 0, z: 0, yaw: Math.PI / 2 };   // +x 쪽을 본다
  assert.equal(seatAcross(seats, ps, 0), seats[0]);
  assert.equal(seatAcross(seats, { x: 0, z: 0, yaw: 0 }, 0), null, 'seat ahead but facing the same way is not across');
  assert.equal(seatAcross(null, ps, 0), null);
});

test('item comments: first look, hint-ladder nudges (place → method, once each), memory, no codes', () => {
  const m = newMemory();
  let r = itemComment('fuse', m, { tier: 0 }); assert.deepEqual(r.ids, ['item_tool_see']); assert.equal(r.nudge, -1); assert.ok(r.first);
  r = itemComment('fuse', m, { tier: 0 }); assert.deepEqual(r.ids, ['item_fuse_use'], 'second show gives the place nudge'); assert.equal(r.nudge, 1);
  r = itemComment('fuse', m, { tier: 1 }); assert.deepEqual(r.ids, ['item_again'], 'no repeat of the same tier');
  r = itemComment('fuse', m, { tier: 2 }); assert.deepEqual(r.ids, ['item_tool_how']); assert.equal(r.nudge, 2);
  r = itemComment('fuse', m, { tier: 2 }); assert.deepEqual(r.ids, ['item_again']);
  // 단계가 이미 높으면 처음 보여 줄 때 장소 귀띔까지 (두 줄)
  const m2 = newMemory(); r = itemComment('eqKey', m2, { tier: 1 }); assert.deepEqual(r.ids, ['item_key_see', 'item_eqKey_use']);
  // 다 쓴 물건: 귀띔 없음
  const m3 = newMemory(); itemComment('battery', m3); r = itemComment('battery', m3, { tier: 2, used: true }); assert.deepEqual(r.ids, ['item_again']);
  // 이야기 물건 · 전용 대사
  const m4 = newMemory(); assert.deepEqual(itemComment('necklace', m4).ids, ['item_necklace']); assert.deepEqual(itemComment('nametag', m4, { tier: 1 }).ids, ['item_nametag']);
  // 기억은 세이브(sanitizeMemory)를 지나도 남는다
  const back = sanitizeMemory(JSON.parse(JSON.stringify(m))); assert.deepEqual(itemComment('fuse', back, { tier: 2 }).ids, ['item_again']);
  // 모든 소지품: 대사가 표에 있고, 퍼즐 답(숫자 코드)을 말하지 않는다
  for (const id of Object.keys(ITEMS)) for (const tier of [0, 1, 2]) { const mm = newMemory(); for (let k = 0; k < 3; k++) for (const lid of itemComment(id, mm, { tier }).ids) { assert.ok(MINA_LINES[lid], id + ' → ' + lid); assert.ok(!/\d{3,}/.test(MINA_LINES[lid][0]), lid); } }
  for (const id of Object.keys(ITEMS)) assert.ok(MINA_LINES[radioItemLine(id)], 'radio ' + id);
  assert.equal(itemCat('unknownKeyX'), 'key'); assert.ok(Object.keys(ITEM_SPECIAL).every(k => ITEM_CAT[k]));
});

test('decor: room → kind, once per kind; all new line ids in 4 languages', () => {
  const told = {};
  assert.equal(decorFor('교장실', told), 'trophy'); told['d:trophy'] = 1;
  assert.equal(decorFor('교장실', told), null);
  assert.equal(decorFor('2-3 교실', told), 'motto'); told['d:motto'] = 1; assert.equal(decorFor('2-3 교실', told), 'timetable');
  assert.equal(decorFor('학교 역사관', told), 'photo'); assert.equal(decorFor('', told), null); assert.equal(decorFor('복도', told), null);
  for (const id of INTERACT_LINE_IDS) { assert.ok(MINA_LINES[id], id); assert.equal(MINA_LINES[id].length, 4, id); }
});
