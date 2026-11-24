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

test('업데이트: 새 워커는 대기 → 게임 시작 전이거나 저장 후에만 넘겨받는다 (플레이 중 섞임 · 저장 없는 새로고침 없음)', () => {
  const sw = read('sw.js'), net = read('net.js'), game = read('game.js');
  assert.doesNotMatch(sw, /addEventListener\('install', \(\) => self\.skipWaiting\(\)\)/, '설치 즉시 skipWaiting 하면 플레이 중인 탭이 새 캐시를 받는다');
  assert.match(sw, /type === 'skipWaiting'\) \{ self\.skipWaiting\(\)/);
  assert.match(sw, /rv !== VERSION[^\n]*cacheName: PREFIX \+ rv/, '예전 ?v 요청은 직전 버전 캐시에서');
  assert.match(sw, /cache: 'no-cache'/, '새 캐시에 담을 때 HTTP 캐시 재검증');
  for (const t of ['새 버전이 있습니다 — 저장 후 새로고침', 'A new version is available', '新しいバージョンがあります', '有新版本']) assert.ok(net.includes(t), t);
  assert.match(net, /__saveForUpdate/); assert.match(game, /window\.__saveForUpdate = /);
  const apply = net.slice(net.indexOf('function applyUpdate'), net.indexOf('window.__updateBanner'));
  assert.ok(apply.indexOf('if (!ok)') < apply.indexOf('location.reload'), '저장 실패면 새로고침하지 않는다');
});

test('net.js: service worker off on localhost unless ?sw and never on app:// (desktop)', () => {
  const net = read('net.js');
  assert.match(net, /\^https\?:\$/);
  assert.match(net, /!local \|\| /);
});
