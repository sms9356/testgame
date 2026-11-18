// 네트워크 부하 완화 (index.html <head> 맨 앞에서 동기 실행 · 일반 스크립트)
// 1) 서비스 워커(sw.js) 등록: 버전(?v=)별 캐시 — 재방문 · 새로고침 때 에셋을 다시 받지 않는다.
//    http(s) 배포본에서만 켠다. localhost 는 개발 중 수정이 바로 보이도록 기본 끔(?sw 로 켬) · ?nosw 는 어디서나 끔.
//    데스크톱(app://) 은 serviceWorker 를 쓰지 않는다.
// 2) fetch 감싸기: 같은 주소의 동시 요청은 한 번만 받아 나눠 주고(in-flight dedupe),
//    서버가 바쁠 때(네트워크 오류 · 408/429/5xx) 지수 백오프로 다시 시도하며, 서비스 워커가 없을 때는 동시 요청 수를 제한한다.
(function () {
  if (typeof window === 'undefined' || window.__netLayer) return;
  window.__netLayer = true;
  var cur = document.currentScript && document.currentScript.src || '';
  var ver = (cur.match(/[?&]v=([^&]+)/) || [])[1] || '0';
  var qs = location.search, local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var swOn = /^https?:$/.test(location.protocol) && 'serviceWorker' in navigator && !/[?&]nosw\b/.test(qs) && (!local || /[?&]sw\b/.test(qs));
  if (swOn) {
    navigator.serviceWorker.register('sw.js?v=' + ver).catch(function () {});
    // 첫 방문: 워커가 페이지를 넘겨받기 전에 받은 파일(HTML · CSS · 폰트 · 첫 모듈)은 워커 캐시에 없다 →
    // 넘겨받은 직후 그 목록을 보내 브라우저 HTTP 캐시에서 옮겨 담게 한다(대개 서버 왕복 없음).
    var hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (hadController) return; hadController = true;
      setTimeout(function () {
        try {
          var urls = performance.getEntriesByType('resource').map(function (e) { return e.name; })
            .filter(function (u) { return u.indexOf(location.origin + '/') === 0 && !/\.html?(\?|$)|\/(\?|$)|\/music\//.test(u); });
          var c = navigator.serviceWorker.controller; if (c) c.postMessage({ type: 'warm', urls: urls });
        } catch (e) { /* ignore */ }
      }, 4000);
    });
  } else if (/^https?:$/.test(location.protocol) && 'serviceWorker' in navigator) {
    // 꺼진 환경에서 예전에 등록된 워커가 남아 있으면 정리한다(개발 중 오래된 캐시 방지)
    try { navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { if (/\/sw\.js/.test((r.active || r.installing || r.waiting || {}).scriptURL || '')) r.unregister(); }); }).catch(function () {}); } catch (e) { /* ignore */ }
  }

  var orig = window.fetch && window.fetch.bind(window);
  if (!orig) return;
  var inflight = new Map(), queue = [], active = 0;
  var LIMIT = 8, TRIES = 4;
  var controlled = function () { return !!(navigator.serviceWorker && navigator.serviceWorker.controller); };
  var acquire = function () { if (controlled() || active < LIMIT) { active++; return Promise.resolve(); } return new Promise(function (r) { queue.push(r); }); };
  var release = function () { active--; var n = queue.shift(); if (n) { active++; n(); } };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var retryable = function (s) { return s === 408 || s === 429 || s >= 500; };
  function attempt(url, init, n) {
    return acquire().then(function () {
      return orig(url, init).then(function (r) { release(); return r; }, function (e) { release(); throw e; });
    }).then(function (r) {
      if (retryable(r.status) && n + 1 < TRIES) return wait(400 * Math.pow(3, n) + Math.random() * 250).then(function () { return attempt(url, init, n + 1); });
      return r;
    }, function (e) {
      if (n + 1 < TRIES && !(e && e.name === 'AbortError')) return wait(400 * Math.pow(3, n) + Math.random() * 250).then(function () { return attempt(url, init, n + 1); });
      throw e;
    });
  }
  window.fetch = function (input, init) {
    try {
      var isReq = typeof Request !== 'undefined' && input instanceof Request;
      var method = ((init && init.method) || (isReq && input.method) || 'GET').toUpperCase();
      var hasHeaders = (init && init.headers) || (isReq && [...input.headers.keys()].length);
      var u = new URL(isReq ? input.url : String(input), location.href);
      if (method !== 'GET' || (init && (init.body || init.signal)) || isReq || hasHeaders || u.origin !== location.origin) return orig(input, init);
      var key = u.href + '|' + ((init && init.cache) || '') + '|' + ((init && init.credentials) || '');
      var shared = inflight.get(key);
      if (!shared) {
        shared = attempt(u.href, init, 0);
        inflight.set(key, shared);
        var drop = function () { inflight.delete(key); };
        shared.then(drop, drop);
      }
      // 각 호출자는 원본의 복제본을 받는다(원본 본문은 아무도 읽지 않으므로 언제든 복제 가능)
      return shared.then(function (r) { return r.clone(); });
    } catch (e) { return orig(input, init); }
  };
})();
