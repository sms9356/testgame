import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const mod = readFileSync(new URL('../propTextureDetail.js', import.meta.url), 'utf8');

test('prop wear maps are skipped on igpu / WebGPU and have a kill switch', () => {
  assert.match(game, /!IGPU && !ENGINE\.webgpu && !\/\[\?&\]noprop\\b\/\.test\(location\.search\)\) \{ const pd = applyPropDetail/);
});
test('prop wear maps are procedural, small and shared', () => {
  assert.doesNotMatch(mod, /\.(webp|png|jpg)/);
  assert.ok(statSync(new URL('../propTextureDetail.js', import.meta.url)).size < 20000);
  assert.match(mod, /c\.width = c\.height = 256/);
});
test('propKind classifies target props and ignores others', async () => {
  const { propKind } = await import('../propTextureDetail.js');
  assert.equal(propKind('RB_lockerF'), 'locker');
  assert.equal(propKind('sf_vending'), 'vending');
  assert.equal(propKind('RBM_sf_park_bench'), 'wood');
  assert.equal(propKind('astro_BOARD'), 'board');
  assert.equal(propKind('INV_BOARD_inv_nurse'), null);
  assert.equal(propKind('floor'), null);
});
