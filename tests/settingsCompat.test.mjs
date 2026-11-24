// 업데이트 호환 — 예전 빌드의 'haegyo_set' 를 현재 빌드가 안전하게 읽는지 (새 동작 키 · 키 충돌 · 손상값 · 모르는 필드)
import test from 'node:test'; import assert from 'node:assert/strict';
import { DEF, parseSET, migrateSET, migrateKeys, keyLabel } from '../settings.js';

// 0e65d23(v362) 시절 설정: quickSave · quickLoad · crouchToggle 등이 없었다
const v362Keys = { interact: 'KeyE', flash: 'KeyF', inv: 'Tab', map: 'KeyM', phone: 'KeyP', throwCan: 'KeyG', view: 'KeyV', run: 'ShiftLeft', down: 'KeyQ', crouch: 'KeyC', jump: 'Space', scan: 'KeyH', camera: 'KeyX', quest: 'KeyO' };

test('v362 설정 → 새 동작(quickSave F5 · quickLoad F9)은 기본 키를 받는다', () => {
  const S = migrateSET(parseSET(JSON.stringify({ quality: 'high', grain: true, keys: v362Keys })));
  assert.equal(S.keys.quickSave, 'F5'); assert.equal(S.keys.quickLoad, 'F9');
  assert.equal(S.quality, 'high'); assert.equal(S.grain, false, '그레인 1회 끄기(fxv 2)'); assert.equal(S.fxv, 2);
  assert.equal(S.crouchToggle, DEF.crouchToggle);
});

test('새 동작의 기본 키를 플레이어가 이미 다른 동작에 쓰면 새 동작은 미지정(충돌 없음)', () => {
  const k = migrateKeys({ ...v362Keys, flash: 'F5' });
  assert.equal(k.flash, 'F5'); assert.equal(k.quickSave, ''); assert.equal(k.quickLoad, 'F9');
  const codes = Object.values(k).filter(Boolean);
  assert.equal(new Set(codes).size, codes.length, '한 키가 두 동작에 묶이지 않는다');
  assert.equal(keyLabel(k.quickSave), '—');
});

test('손상 · 이상한 키 값과 없어진 동작의 키는 정리되고, 모르는 설정 필드는 보존된다', () => {
  const S = parseSET(JSON.stringify({ keys: { interact: 5, removedAction: 'KeyZ' }, futureOpt: 3 }));
  assert.equal(S.keys.interact, 'KeyE'); assert.equal('removedAction' in S.keys, false);
  assert.equal(S.futureOpt, 3);
  assert.deepEqual(parseSET('{broken').keys, DEF.keys);
  assert.deepEqual(parseSET('[1,2]').keys, DEF.keys);
  assert.deepEqual(parseSET(JSON.stringify({ keys: [1] })).keys, DEF.keys);
});

test('목표 바 J → O 이전은 O 가 비어 있을 때만', () => {
  assert.equal(migrateSET(parseSET(JSON.stringify({ keys: { ...v362Keys, quest: 'KeyJ' } }))).keys.quest, 'KeyO');
  assert.equal(migrateSET(parseSET(JSON.stringify({ keys: { ...v362Keys, quest: 'KeyJ', map: 'KeyO' } }))).keys.quest, 'KeyJ');
});
