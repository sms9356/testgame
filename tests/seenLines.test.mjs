// 본 대사 기록(이미 본 대사 넘기기) — seenLines.js 저장 · 복원 · 손상값 처리, 설정 기본값 · 빠른 저장 키 설정
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
store.set('haegyo_seen', JSON.stringify(['intro1', 'call_unk1']));
const S = await import('../seenLines.js');
const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('seen lines are restored from localStorage at load', () => {
  assert.equal(S.isSeen('intro1'), true); assert.equal(S.isSeen('call_unk1'), true); assert.equal(S.isSeen('m_battery'), false); assert.equal(S.seenCount(), 2);
});
test('markSeen persists across a reload', () => {
  assert.equal(S.markSeen('m_battery', true), true); assert.equal(S.markSeen('m_battery', true), false);   // 두 번째는 새로 기록하지 않는다
  assert.deepEqual(JSON.parse(store.get(S.SEEN_KEY)).sort(), ['call_unk1', 'intro1', 'm_battery']);
  S.loadSeen(); assert.equal(S.isSeen('m_battery'), true); assert.equal(S.seenCount(), 3);
});
test('batched save flushes and corrupt data falls back to empty', () => {
  S.markSeen('m_medkit'); S.saveSeen(); assert.ok(JSON.parse(store.get(S.SEEN_KEY)).includes('m_medkit'));
  assert.deepEqual(S.parseSeen('{bad'), []); assert.deepEqual(S.parseSeen('{"a":1}'), []); assert.deepEqual(S.parseSeen('["a", 3, null, ""]'), ['a']);
  store.set(S.SEEN_KEY, 'garbage'); assert.equal(S.loadSeen(), 0); assert.equal(S.isSeen('intro1'), false);
  S.markSeen('x1', true); S.clearSeen(); assert.equal(S.seenCount(), 0); assert.deepEqual(JSON.parse(store.get(S.SEEN_KEY)), []);
});
test('voice.js wires seen tracking and a default-off skip setting', () => {
  const v = read('voice.js');
  assert.match(v, /skipSeen: false/); assert.match(v, /markSeen\(id\)/); assert.match(v, /export function skipSeenLine/);
  const h = read('index.html'); assert.match(h, /id="setSkipSeen"/);
  for (const l of ['en', 'ja', 'zh']) { const d = JSON.parse(read(`lang/${l}.json`)); for (const k of ['이미 본 대사', '상호작용 키로 넘기기 (한 번 본 대사만)', '빠른 저장', '{} — 현재 진행을 저장합니다']) assert.ok(d[k], `${l}: ${k}`); }
});
test('quick save / load keys are rebindable settings', async () => {
  const { DEF, parseSET } = await import('../settings.js');
  assert.equal(DEF.keys.quickSave, 'F5'); assert.equal(DEF.keys.quickLoad, 'F9');
  assert.equal(parseSET(JSON.stringify({ keys: { run: 'KeyR' } })).keys.quickSave, 'F5');   // 예전 설정에도 기본값이 들어온다
  assert.equal(parseSET(JSON.stringify({ keys: { quickLoad: 'KeyL' } })).keys.quickLoad, 'KeyL');
  const g = read('game.js'); assert.match(g, /\['quickSave', '빠른 저장'\], \['quickLoad', '빠른 불러오기'\]/); assert.match(g, /e\.code === K\(\)\.quickSave/);
});
