import test from 'node:test';
import assert from 'node:assert/strict';
import { isIntegratedName, createDynRes } from '../igpu.js';

test('integrated GPU names are detected, discrete/software are not', () => {
  for (const s of ['ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)', 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11)', 'AMD Radeon(TM) Graphics', 'ANGLE (AMD, Radeon RX Vega 8 Graphics)', 'Apple GPU', 'Apple M1'])
    assert.equal(isIntegratedName(s), true, s);
  for (const s of ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3060)', 'AMD Radeon RX 6700 XT', 'Google SwiftShader', 'llvmpipe (LLVM 15)', ''])
    assert.equal(isIntegratedName(s), false, s);
});

test('dynamic resolution lowers on slow frames and recovers with hysteresis', () => {
  const seen = []; const d = createDynRes({ apply: s => seen.push(s) }); d.setEnabled(true);
  for (let i = 0; i < 40; i++) d.tick(.045);          // 22fps for ~1.8s
  assert.ok(d.scale < 1 && d.scale >= .6);
  for (let i = 0; i < 2000; i++) d.tick(.045);
  assert.equal(d.scale, .6);
  const low = d.scale; for (let i = 0; i < 100; i++) d.tick(.02);   // one good window: no change yet
  assert.equal(d.scale, low);
  for (let i = 0; i < 6000; i++) d.tick(.016);
  assert.equal(d.scale, 1);
  d.setEnabled(false); assert.equal(d.scale, 1); assert.ok(seen.length > 2);
});
