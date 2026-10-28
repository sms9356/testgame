// 모든 게임 모듈이 문법적으로 읽히는지 (한 줄짜리 코드 안에 주석을 잘못 넣어 game.js 전체가 안 읽히던 사고 방지)
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const files = fs.readdirSync(root).filter(f => f.endsWith('.js'));
for (const f of files) test(`${f} parses as a module`, () => {
  const src = fs.readFileSync(new URL(f, root), 'utf8');
  assert.doesNotThrow(() => new vm.SourceTextModule(src, { identifier: f }), f);
});
