// 서비스 워커 — 정적 에셋 캐시로 서버 트래픽을 줄인다 (net.js 가 sw.js?v=<캐시 버전> 으로 등록)
// · 캐시 이름은 index.html 의 net.js?v= 버전(version.js)에 묶인다. 새 워커는 설치 뒤 '대기'한다:
//   - 페이지를 처음 열 때(게임 시작 전)는 net.js 가 바로 넘겨받게(skipWaiting 메시지) 한 뒤 한 번 새로고침한다.
//   - 플레이 중인 탭에는 net.js 가 '새 버전이 있습니다 — 저장 후 새로고침' 배너를 띄우고, 저장한 뒤에만 넘겨받는다.
//     → 한 세션 안에서 예전 모듈과 새 모듈이 섞이지 않는다. 넘겨받으면 clients.claim.
//   - 다른 탭이 먼저 넘겨받아도, 예전 ?v=<이전 버전> 요청은 직전 버전 캐시에서 내어 준다(섞임 방지).
// 직전 버전 캐시는 조건부 요청(ETag/Last-Modified → 304)으로
//   바뀌지 않은 파일만 옮겨 담아 버전을 올려도 전부 다시 받지는 않는다.
// · index.html(탐색 요청)은 네트워크 우선(실패 때만 캐시) — 새 버전을 늘 먼저 본다.
// · 그 밖의 같은 출처 GET 은 캐시 우선. 캐시 키는 쿼리를 뗀 경로: 같은 버전 안에서 a.js 와 a.js?v=<n> 은 같은 파일이다.
// · Range 요청(음악 스트리밍)은 손대지 않는다.
// · 네트워크: 같은 파일 동시 요청은 한 번만, 동시 다운로드는 최대 LIMIT 개, 오류 · 5xx · 429 는 지수 백오프로 재시도.
const VERSION = new URL(self.location.href).searchParams.get('v') || '0';
const PREFIX = 'seorin-assets-', CACHE = PREFIX + VERSION;
const LIMIT = 8, TRIES = 4;

self.addEventListener('install', () => { /* 대기 — net.js 가 {type:'skipWaiting'} 를 보낼 때 넘겨받는다 */ });
self.addEventListener('activate', e => e.waitUntil((async () => {
  // 직전 버전 하나만 남겨 조건부 재검증에 쓰고, 나머지 예전 캐시는 지운다
  const names = (await caches.keys()).filter(n => n.startsWith(PREFIX) && n !== CACHE);
  const num = n => parseFloat(n.slice(PREFIX.length)) || 0;
  const older = names.filter(n => num(n) < (parseFloat(VERSION) || 0)).sort((a, b) => num(b) - num(a));
  const keep = older[0];
  await Promise.all(names.filter(n => n !== keep).map(n => caches.delete(n)));
  await self.clients.claim();
})()));

let active = 0; const queue = [], inflight = new Map();
const acquire = () => active < LIMIT ? (active++, Promise.resolve()) : new Promise(r => queue.push(r));
const release = () => { active--; const n = queue.shift(); if (n) { active++; n(); } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const retryable = s => s === 408 || s === 429 || s >= 500;
async function net(req, n = 0) {
  await acquire();
  let r, err;
  try { r = await fetch(req); } catch (e) { err = e; } finally { release(); }
  if ((err || retryable(r.status)) && n + 1 < TRIES) { await wait(400 * 3 ** n + Math.random() * 250); return net(req, n + 1); }
  if (err) throw err;
  return r;
}
const keyOf = url => { const u = new URL(url); return u.origin + u.pathname; };

async function oldCache() {
  const names = (await caches.keys()).filter(n => n.startsWith(PREFIX) && n !== CACHE);
  return names.length ? caches.open(names[0]) : null;
}
async function fromNetwork(req, key) {
  const cache = await caches.open(CACHE);
  // 직전 버전 캐시에 있으면 조건부 요청 — 304 면 본문을 받지 않고 옮겨 담는다
  const prevCache = await oldCache().catch(() => null), prev = prevCache && await prevCache.match(key);
  const etag = prev && prev.headers.get('ETag'), lm = prev && prev.headers.get('Last-Modified');
  if (prev && (etag || lm)) {
    const h = new Headers(); if (etag) h.set('If-None-Match', etag); if (lm) h.set('If-Modified-Since', lm);
    const r = await net(new Request(req.url, { headers: h, cache: 'no-store', credentials: 'same-origin' })).catch(() => null);
    if (r && r.status === 304) { await cache.put(key, prev.clone()); return prev; }   // 직전 캐시는 지우지 않는다: 아직 예전 버전으로 도는 탭이 쓴다(다음 버전 활성화 때 정리)
    if (r && r.ok) { cache.put(key, r.clone()).catch(() => {}); return r; }
  }
  // cache:'no-cache' — 브라우저 HTTP 캐시가 휴리스틱으로 들고 있는 예전 GLB · WebP · 음성을 새 버전 캐시에 담지 않도록 반드시 재검증
  const r = await net(new Request(req.url, { credentials: 'same-origin', cache: 'no-cache' }));
  if (r.ok && r.status === 200 && r.type === 'basic') cache.put(key, r.clone()).catch(() => {});   // 기다리지 않는다: 본문은 스트리밍으로 바로 넘긴다
  return r;
}
async function asset(req) {
  const key = keyOf(req.url);
  // 예전 버전 페이지의 요청(?v=<이전>)은 그 버전 캐시에서 — 한 세션 안에서 예전/새 모듈이 섞이지 않게
  const rv = new URL(req.url).searchParams.get('v');
  if (rv && rv !== VERSION && /^\d+$/.test(rv)) { const old = await caches.match(key, { cacheName: PREFIX + rv }).catch(() => null); if (old) return old; }
  const hit = await caches.match(key, { cacheName: CACHE });
  if (hit) return hit;
  let p = inflight.get(key);
  if (!p) { p = fromNetwork(req, key); inflight.set(key, p); p.then(() => inflight.delete(key), () => inflight.delete(key)); }
  return (await p).clone();
}
async function page(req) {
  const key = keyOf(req.url);
  try {
    const r = await net(req);
    if (r.ok && r.type === 'basic') { const c = await caches.open(CACHE); await c.put(key, r.clone()).catch(() => {}); }
    return r;
  } catch (e) {
    const hit = await caches.match(key); if (hit) return hit;
    throw e;
  }
}

// 첫 방문 때 워커가 넘겨받기 전에 받은 파일들을 캐시에 옮겨 담는다(net.js 가 목록을 보냄 · 대개 HTTP 캐시에서 바로 나온다)
self.addEventListener('message', e => {
  const d = e.data;
  if (d && d.type === 'skipWaiting') { self.skipWaiting(); return; }   // net.js: 게임 시작 전이거나, 플레이어가 저장한 뒤
  if (d && d.type === 'version' && e.source) { e.source.postMessage({ type: 'version', v: VERSION }); return; }
  if (!d || d.type !== 'warm' || !Array.isArray(d.urls)) return;
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const url of d.urls.slice(0, 2000)) {
      try {
        const u = new URL(url); if (u.origin !== self.location.origin || u.pathname.endsWith('/sw.js')) continue;
        const key = keyOf(url);
        if (await cache.match(key) || inflight.has(key)) continue;
        const r = await net(new Request(url, { credentials: 'same-origin' }));
        if (r.ok && r.status === 200 && r.type === 'basic') await cache.put(key, r);
      } catch (err) { /* ignore */ }
    }
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return;
  if (u.pathname.endsWith('/sw.js')) return;
  if (req.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html')) { e.respondWith(page(req)); return; }
  if (req.cache === 'no-store' || req.cache === 'reload') return;
  e.respondWith(asset(req));
});
