// 저장 시스템 단위 테스트 — 실행: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA, storageKeys, itemUid, assignUids, validate, migrate, readSlot, writeSlot, repairProgress } from '../saveSystem.js';

const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
const v5 = (o = {}) => ({
  schemaVersion: SCHEMA, meta: { char: 'jihun', ch: 2, time: 10 }, player: { x: 1, z: 2, floor: 0, hp: 100, keys: 1 },
  progress: { got: [true, false, false, false, false], FL: {}, playTime: 10 }, inv: { battery: 1 }, world: { items: {}, props: {}, doors: {} }, ...o,
});

test('테스트 모드는 실제 세이브와 다른 키를 쓴다', () => {
  assert.notEqual(storageKeys(true).main, storageKeys(false).main);
  assert.equal(storageKeys(true).legacy, null);
});

test('열쇠 조각 · 문서 ID 는 위치와 무관하다', () => {
  assert.equal(itemUid({ kind: 'key', idx: 3, pos: { x: 1, z: 2 } }), 'key:3');
  assert.equal(itemUid({ kind: 'note', id: 'n3', pos: { x: 9, z: 9 } }), 'note:n3');
  assert.equal(itemUid({ kind: 'battery', floor: 1, pos: { x: 1.23, z: -4.56 } }), 'battery:1:12:-46');
});

test('겹치는 ID 는 #n 으로 유일해진다', () => {
  const l = [{ kind: 'can', floor: 0, pos: { x: 0, z: 0 } }, { kind: 'can', floor: 0, pos: { x: 0, z: 0 } }];
  const ids = assignUids(l, itemUid);
  assert.deepEqual(ids, ['can:0:0:0', 'can:0:0:0#2']);
});

test('구조 검증: 정상 / 손상', () => {
  assert.deepEqual(validate(v5()), []);
  assert.ok(validate({ schemaVersion: SCHEMA }).length > 0);
  assert.ok(validate(null).length > 0);
  assert.ok(validate(v5({ player: { x: NaN, z: 0, floor: 0, hp: 1 } })).length > 0);
});

test('v4(인덱스 기반) 세이브를 v5(ID 기반)로 변환한다', () => {
  const v4 = { char: 'jihun', P: { x: 0, z: 0, floor: 0, hp: 80, keys: 1 }, got: [true, false, false, false, false], taken: [false, true, true], props: [{ done: true }, { done: false }], inv: { battery: 2 }, FL: { cam: true }, playTime: 5 };
  const d = migrate(v4, { itemUids: ['battery:0:1:1', 'key:0', 'camcorder'], propUids: ['safe::0:1:1', 'lock::1:2:2'] });
  assert.equal(d.schemaVersion, SCHEMA);
  assert.equal(d.meta.char, 'jihun');
  assert.deepEqual(d.world.items, { 'key:0': 1, camcorder: 1 });
  assert.deepEqual(d.world.props, { 'safe::0:1:1': { done: true } });
  assert.deepEqual(validate(d), []);
});

test('미래 버전 세이브는 읽지 않는다', () => { assert.equal(migrate({ schemaVersion: SCHEMA + 1 }, { itemUids: [], propUids: [] }), null); });

test('본 세이브가 손상되면 백업에서 읽는다', () => {
  const s = mem(), k = storageKeys(false);
  writeSlot(s, k, v5({ meta: { char: 'jihun', ch: 1, time: 1 } }));
  writeSlot(s, k, v5({ meta: { char: 'seoyeon', ch: 3, time: 2 } }));
  assert.equal(readSlot(s, k, { itemUids: [], propUids: [] }).data.meta.char, 'seoyeon');
  s.setItem(k.main, '{깨진 JSON');
  const r = readSlot(s, k, { itemUids: [], propUids: [] });
  assert.equal(r.source, 'backup'); assert.equal(r.data.meta.char, 'jihun');
});

test('진행 상태 보정: 열쇠 수 · 정문 열쇠 · 체력', () => {
  const d = v5({ player: { x: 0, z: 0, floor: 0, hp: 0, keys: 4 }, progress: { got: [true, true, false, false, false], FL: { gatekey: true } } });
  const fixes = repairProgress(d, 5);
  assert.equal(d.player.keys, 2); assert.equal(d.progress.FL.gatekey, false); assert.equal(d.player.hp, 50); assert.equal(fixes.length, 3);
});
