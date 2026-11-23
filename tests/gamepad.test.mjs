import test from 'node:test';
import assert from 'node:assert/strict';
import { padState, diffHeld, padGlyphHtml, PAD_BUTTONS } from '../gamepad.js';

const KEYS = { interact: 'KeyE', flash: 'KeyF', inv: 'Tab', map: 'KeyM', phone: 'KeyP', throwCan: 'KeyG', view: 'KeyV', run: 'ShiftLeft', down: 'KeyQ', crouch: 'KeyC', jump: 'Space', scan: 'KeyH', camera: 'KeyX', quest: 'KeyO' };
const pad = (axes = [0, 0, 0, 0], on = []) => ({ axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: on.includes(i), value: on.includes(i) ? 1 : 0 })) });

test('left stick maps to WASD with deadzone', () => {
  assert.deepEqual([...padState(pad([0.1, -0.2]), KEYS).held], []);
  assert.deepEqual([...padState(pad([0, -0.9]), KEYS).held], ['KeyW']);
  assert.deepEqual([...padState(pad([0.8, 0.8]), KEYS).held].sort(), ['KeyD', 'KeyS']);
  assert.deepEqual([...padState(pad([-0.8, 0]), KEYS).held], ['KeyA']);
});
test('buttons use configured key bindings (remap aware)', () => {
  assert.deepEqual([...padState(pad(undefined, [0]), KEYS).held], ['KeyE']);
  assert.deepEqual([...padState(pad(undefined, [0]), { ...KEYS, interact: 'KeyR' }).held], ['KeyR']);
  const all = padState(pad(undefined, Object.keys(PAD_BUTTONS).map(Number)), KEYS).held;
  for (const c of ['KeyE', 'KeyC', 'KeyF', 'Tab', 'KeyQ', 'KeyG', 'KeyH', 'ShiftLeft', 'KeyM', 'Escape', 'Space', 'KeyV', 'KeyP', 'KeyO', 'Digit2', 'Digit3']) assert.ok(all.has(c), c);
});
test('analog trigger counts as pressed past threshold', () => {
  const p = pad(); p.buttons[7] = { pressed: false, value: 0.7 };
  assert.ok(padState(p, KEYS).held.has('ShiftLeft'));
  p.buttons[7] = { pressed: false, value: 0.2 };
  assert.ok(!padState(p, KEYS).held.has('ShiftLeft'));
});
test('right stick look has deadzone, sign and curve', () => {
  assert.deepEqual(padState(pad([0, 0, 0.1, -0.1]), KEYS).look, { x: 0, y: 0 });
  const l = padState(pad([0, 0, 1, -1]), KEYS).look; assert.equal(l.x, 1); assert.equal(l.y, -1);
  assert.ok(padState(pad([0, 0, 0.5, 0]), KEYS).look.x < 0.5);
});
test('diffHeld gives press/release edges', () => {
  assert.deepEqual(diffHeld(new Set(['KeyW', 'KeyE']), new Set(['KeyW', 'KeyD'])), { down: ['KeyD'], up: ['KeyE'] });
});
test('prompt glyphs swap keyboard keys for pad buttons', () => {
  assert.equal(padGlyphHtml('<kbd>E</kbd>문 열기'), '<kbd class="gpGlyph">A</kbd>문 열기');
  assert.equal(padGlyphHtml('<kbd>Q</kbd>내려가기 <kbd>Z</kbd>'), '<kbd class="gpGlyph">LB</kbd>내려가기 <kbd>Z</kbd>');
});
