// 업데이트 호환 — 예전 빌드가 남긴 세이브 모양(git 기록 기준)을 현재 빌드가 읽고, 손상 · 미래 버전 세이브를 잃지 않는지
// 기록: 0e65d23(v362, BUILD 2026.10.14) 부터 save() 모양은 같다(SCHEMA 5). 그 이전 v4 는 'haegyo_save_v4'(배열 인덱스).
import test from 'node:test'; import assert from 'node:assert/strict';
import { SCHEMA, storageKeys, readSlot, writeSlot, validate, normalize, clearSlot } from '../saveSystem.js';

const mem = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
const K = storageKeys(false);
const CTX = { itemUids: ['battery:0:12:-46', 'key:0', 'camcorder'], propUids: ['safe::0:10:10', 'lock::1:20:20'] };

// v362 시절(유령 추격이 있던 때) save() 가 쓰던 그대로의 모양
const v362 = () => ({
  schemaVersion: 5, build: '2026.10.14',
  meta: { char: 'seoyeon', ch: 2, time: 812.4, savedAt: 1760400000000, where: '본관 2층 · 2-3 교실' },
  player: { x: 12.3, z: -40.1, yaw: 1.2, floor: 2, sh: 0, hp: 74, battery: 61, stamina: 100, keys: 1, light: true, pbat: 88, roofSeen: false, b1Seen: true, gymSeen: false, cafeSeen: false, poolSeen: false, bcast: false },
  progress: { got: [true, false, false, false, false], FL: { cam: true, mina: false, night: true }, power: true, gateClosed: false, introDone: true, playTime: 812.4 },
  inv: { battery: 2, can: 1 }, docs: [{ id: 'n3', kind: 'note' }], msgs: [{ from: '민아', t: '어디야?' }], clues: ['c1'],
  events: ['EV-01', 'EV-02'], tips: ['flash'], cards: ['ch1'], b33: 0,
  world: { items: { 'key:0': 1 }, props: { 'safe::0:10:10': { done: true, on: false, fused: false, tried: true, fails: 0 } }, doors: { 'door:2:10:20': 1 } },
  ghost: { active: true, enraged: true, floor: 2, x: 3, z: 4 },   // 제거된 유령 기능 — 무시돼야 한다
});
// v4(인덱스 기반) — 'haegyo_save_v4'
const v4 = () => ({ char: 'jihun', P: { x: 0, z: 0, floor: 0, hp: 80, keys: 1 }, got: [true, false, false, false, false], taken: [false, true, true], props: [{ done: true }, { done: false }], inv: { battery: 2 }, FL: { cam: true }, playTime: 5, ghost: { active: true, floor: 1 } });

test('v362(BUILD 2026.10.14) 세이브 → 현재: 그대로 읽히고 유령 상태는 버려진다', () => {
  const s = mem({ [K.main]: JSON.stringify(v362()) });
  const r = readSlot(s, K, CTX);
  assert.equal(r.source, 'main'); assert.equal(r.data.player.floor, 2); assert.equal(r.data.meta.char, 'seoyeon');
  assert.equal(r.data.ghost, undefined);
  assert.deepEqual(r.data.progress.FL, { cam: true, mina: false, night: true });   // FL.elec 같은 이후 추가 플래그가 없어도 된다
});

test('v4 레거시 키 → v5 변환 (본 세이브 · 백업이 없을 때)', () => {
  const s = mem({ [K.legacy]: JSON.stringify(v4()) });
  const r = readSlot(s, K, CTX);
  assert.equal(r.source, 'legacy'); assert.equal(r.data.schemaVersion, SCHEMA);
  assert.deepEqual(r.data.world.items, { 'key:0': 1, camcorder: 1 });
  assert.equal(r.data.ghost, undefined); assert.deepEqual(validate(r.data), []);
});

test('선택 필드가 빠진 예전 v5 · 모르는 새 필드가 붙은 v5 모두 읽힌다(새 필드는 보존)', () => {
  const old = v362(); delete old.docs; delete old.msgs; delete old.clues; delete old.events; delete old.tips; delete old.cards; delete old.world.doors; delete old.progress.FL; delete old.meta.where;
  const r1 = readSlot(mem({ [K.main]: JSON.stringify(old) }), K, CTX);
  assert.equal(r1.source, 'main'); assert.deepEqual(r1.data.docs, []); assert.deepEqual(r1.data.world.doors, {}); assert.deepEqual(r1.data.progress.FL, {});
  const nw = { ...v362(), smartObjects: { a: 1 }, npc: { mina: { mood: 3 } }, player: { ...v362().player, newStat: 7 } };
  const r2 = readSlot(mem({ [K.main]: JSON.stringify(nw) }), K, CTX);
  assert.equal(r2.source, 'main'); assert.deepEqual(r2.data.smartObjects, { a: 1 }); assert.equal(r2.data.player.newStat, 7);
});

test('손상 본 세이브 → 백업에서 복구 · 원문은 corrupt 키에 보관 · 예외 없음', () => {
  const s = mem({ [K.main]: '{"schemaVersion":5,"meta":{"ch', [K.backup]: JSON.stringify(v362()) });
  const r = readSlot(s, K, CTX);
  assert.equal(r.source, 'backup');
  assert.equal(s.getItem(K.corrupt), '{"schemaVersion":5,"meta":{"ch');
  // 구조가 깨진(파싱은 되는) 세이브도 마찬가지
  const s2 = mem({ [K.main]: JSON.stringify({ schemaVersion: 5, player: 'x' }) });
  assert.deepEqual(readSlot(s2, K, CTX), { data: null, source: null });
  assert.ok(s2.getItem(K.corrupt));
  // 저장소 자체가 예외를 던져도 죽지 않는다
  const bad = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(readSlot(bad, K, CTX), { data: null, source: null });
});

test('손상 본 세이브 위에 새로 저장해도 원문은 corrupt 키에 남는다(백업은 덮지 않음)', () => {
  const good = JSON.stringify(v362());
  const s = mem({ [K.main]: 'garbage{', [K.backup]: good });
  writeSlot(s, K, normalize(v362()));
  assert.equal(s.getItem(K.corrupt), 'garbage{'); assert.equal(s.getItem(K.backup), good);
});

test('다운그레이드: 더 새 빌드(schemaVersion > SCHEMA)의 세이브는 읽지 않고, 덮어써도 future 키에 원문이 남는다', () => {
  const fut = JSON.stringify({ ...v362(), schemaVersion: SCHEMA + 1, build: '2027.01.01', brandNew: [1, 2] });
  const s = mem({ [K.main]: fut, [K.backup]: JSON.stringify(v362()) });
  const r = readSlot(s, K, CTX);
  assert.equal(r.source, 'backup'); assert.equal(s.getItem(K.future), fut);
  writeSlot(s, K, normalize(v362()));
  assert.equal(s.getItem(K.future), fut, '미래 세이브 원문 보존');
  clearSlot(s, K);   // 새 게임으로 지워도 보관본은 남긴다
  assert.equal(s.getItem(K.future), fut);
});

test('라운드트립: 예전 세이브를 읽어 다시 쓰면 현재 검증을 통과한다', () => {
  const s = mem({ [K.main]: JSON.stringify(v362()) });
  const d = readSlot(s, K, CTX).data; writeSlot(s, K, d);
  assert.deepEqual(validate(JSON.parse(s.getItem(K.main))), []);
  assert.deepEqual(JSON.parse(s.getItem(K.backup)).ghost.active, true, '이전 본 세이브는 원문 그대로 백업');
});
