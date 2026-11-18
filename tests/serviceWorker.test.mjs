// 서비스 워커 캐시 버전이 게임 코드 버전과 함께 올라가는지 (버전을 안 올리면 재방문자가 예전 코드를 캐시에서 받는다)
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('net.js cache version matches game.js version in index.html', () => {
  const html = read('index.html');
  const net = html.match(/<script src="net\.js\?v=(\d+)"><\/script>/), game = html.match(/<script type="module" src="game\.js\?v=(\d+)">/);
  assert.ok(net, 'net.js must be loaded with ?v=');
  assert.ok(game);
  assert.equal(net[1], game[1], 'bump net.js?v= together with game.js?v= so the service worker cache rolls over');
  assert.ok(html.indexOf('net.js') < html.indexOf('<link rel="stylesheet"'), 'net.js must run before other resources are requested');
});

test('service worker: html network-first, range requests untouched, versioned cache', () => {
  const sw = read('sw.js');
  assert.match(sw, /searchParams\.get\('v'\)/);
  assert.match(sw, /headers\.has\('range'\)\) return/);
  assert.match(sw, /req\.mode === 'navigate'[^\n]*page\(req\)/);
  assert.match(sw, /skipWaiting/); assert.match(sw, /clients\.claim/);
});

test('net.js: service worker off on localhost unless ?sw and never on app:// (desktop)', () => {
  const net = read('net.js');
  assert.match(net, /\^https\?:\$/);
  assert.match(net, /!local \|\| /);
});
