import test from 'node:test';
import assert from 'node:assert/strict';
import { createNPCVisuals } from '../npcVisuals.js';

test('GLB가 없으면 기존 모델로 안전하게 복귀', async () => {
  class FailingLoader { loadAsync() { return Promise.reject(new Error('404')); } }
  const npc = createNPCVisuals({ THREE: {}, GLTFLoader: FailingLoader });
  const child = { visible: true };
  const holder = { isObject3D: true, children: [child], visible: true };
  const r = await npc.load('guard', holder);
  assert.equal(r.ok, false);
  assert.equal(child.visible, true);
  assert.equal(holder.children.length, 1);
});

test('중복 로더 호출을 피함', async () => {
  let calls = 0;
  class MissingLoader { loadAsync() { calls++; return Promise.reject(new Error('missing')); } }
  const npc = createNPCVisuals({ THREE: {}, GLTFLoader: MissingLoader });
  const holder = { isObject3D: true, children: [], visible: true };
  const [r1, r2] = await Promise.all([npc.load('mina', holder), npc.load('mina', holder)]);
  assert.equal(calls, 1);
  assert.equal(r1.ok, false);
  assert.equal(r2.ok, false);
  npc.update(.016);
});

test('잘못된 holder는 설명 가능한 오류', async () => {
  class MissingLoader {}
  const npc = createNPCVisuals({ THREE: {}, GLTFLoader: MissingLoader });
  await assert.rejects(() => npc.load('guard', null), /그룹/);
});
