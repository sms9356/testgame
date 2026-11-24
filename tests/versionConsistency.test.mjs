// 업데이트 호환: 모든 ?v= 가 version.js 의 VERSION 하나를 따르고, 같은 모듈이 두 주소로 두 벌 실행되지 않는지
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { auditAll, auditText, readVersion } from '../tools/versionAudit.mjs';
import { VERSION } from '../version.js';

test('version.js 가 단일 출처이고 index.html 의 net.js · game.js 버전과 같다', () => {
  assert.equal(readVersion(), VERSION);
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(html.match(/net\.js\?v=(\d+)/)[1], String(VERSION));
  assert.equal(html.match(/game\.js\?v=(\d+)/)[1], String(VERSION));
});

test('?v 누락 · 불일치 import 와 ?v 가 다른 리소스 주소가 없다 (고치기: node tools/bump-version.mjs --fix)', () => {
  const { issues } = auditAll(false);
  assert.deepEqual(issues, []);
});

test('같은 모듈을 ?v 있이/없이(또는 다른 ?v 로) 가져와 두 벌 실행되는 곳이 없다', () => {
  assert.deepEqual(auditAll(false).duplicates, []);
});

test('감사기 자체: 누락 · 불일치 · vendor ?v 를 잡고 --fix 로 고친다', () => {
  const src = "import a from './a.js';\nimport { b } from './b.js?v=1';\nimport * as T from './vendor/three.module.js?v=2';\nconst m = await import('./c.js');\nfetch('voice/manifest.json?v=3');";
  const r = auditText('x.js', src, 9, true);
  assert.equal(r.issues.length, 5);
  assert.equal(r.out, "import a from './a.js?v=9';\nimport { b } from './b.js?v=9';\nimport * as T from './vendor/three.module.js';\nconst m = await import('./c.js?v=9');\nfetch('voice/manifest.json?v=9');");
  assert.deepEqual(auditText('x.js', r.out, 9).issues, []);
  // sw.js 본문은 버전마다 달라야 한다(같으면 브라우저가 새 워커를 설치하지 않음)
  const sw = auditText('sw.js', 'const SW_BUILD = 1;', 9, true);
  assert.equal(sw.issues.length, 1); assert.equal(sw.out, 'const SW_BUILD = 9;');
  assert.equal(auditText('sw.js', '//', 9).issues.length, 1);
});
