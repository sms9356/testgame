import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const game = readFileSync(new URL('../game.js', import.meta.url), 'utf8');
const mod = readFileSync(new URL('../surfaceMacro.js', import.meta.url), 'utf8');

test('surface macro detail is skipped on igpu / WebGPU and has a kill switch', () => {
  assert.match(game, /!IGPU && !ENGINE\.webgpu && !\/\[\?&\]nomacro\\b\/\.test\(location\.search\)\) \{ const mc = applyMacroDetail/);
  assert.match(game, /const macroLevel = \(\) => IGPU \? 0 :/);
  assert.match(game, /setMacroLevel\(macroLevel\(\)\)/);
});

test('surface macro detail adds no image assets and shares one noise texture', () => {
  assert.doesNotMatch(mod, /\.(webp|png|jpg)/);
  assert.equal((mod.match(/makeNoise\(256\)/g) || []).length, 1);
});
