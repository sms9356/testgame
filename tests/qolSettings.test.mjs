// 편의(QoL) 설정 저장 · 복원 검증 — settings.js parseSET / saveSET
import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const { DEF, SET, parseSET, saveSET, resetSET } = await import('../settings.js');

test('QoL defaults exist', () => {
  assert.equal(DEF.crouchToggle, true); assert.equal(DEF.idleHint, true); assert.equal(DEF.cbSafe, false); assert.equal(DEF.idleHintSec, 240);
});
test('QoL settings round-trip through localStorage', () => {
  Object.assign(SET, { crouchToggle: false, idleHint: false, idleHintSec: 420, cbSafe: true }); saveSET();
  const back = parseSET(store.get('haegyo_set'));
  assert.equal(back.crouchToggle, false); assert.equal(back.idleHint, false); assert.equal(back.idleHintSec, 420); assert.equal(back.cbSafe, true);
  assert.deepEqual(back.keys, SET.keys);
});
test('old/corrupt saves fall back to defaults', () => {
  const old = parseSET(JSON.stringify({ fov: 80, keys: { run: 'KeyR' } }));
  assert.equal(old.fov, 80); assert.equal(old.crouchToggle, true); assert.equal(old.keys.run, 'KeyR'); assert.equal(old.keys.interact, 'KeyE');
  const bad = parseSET(JSON.stringify({ crouchToggle: 'yes', idleHintSec: 5, cbSafe: 1, keys: 3 }));
  assert.equal(bad.crouchToggle, true); assert.equal(bad.cbSafe, false); assert.equal(bad.idleHintSec, 60); assert.equal(bad.keys.interact, 'KeyE');
  assert.equal(parseSET('{not json').idleHint, true); assert.equal(parseSET('[1]').cbSafe, false); assert.equal(parseSET(null).idleHintSec, 240);
});
test('reset restores QoL defaults', () => {
  SET.cbSafe = true; resetSET(); assert.equal(SET.cbSafe, false); assert.equal(parseSET(store.get('haegyo_set')).cbSafe, false);
});
