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
    // 새 워커는 설치 뒤 대기한다(sw.js). 넘겨받기(skipWaiting)는 두 경우에만:
    //  (1) 이 페이지가 막 열렸고(게임 시작 전) 예전 워커가 잡고 있을 때 → 로딩을 멈추고 넘겨받은 뒤(또는 8초 뒤) 한 번 새로고침
    //  (2) 플레이 중 새 버전이 설치되면 배너 '새 버전이 있습니다 — 저장 후 새로고침' → 플레이어가 누르고 저장(window.__saveForUpdate)된 뒤에만
    //  플레이 중에는 절대 저장 없이 새로고침하지 않는다.
    var ctl = navigator.serviceWorker.controller, ctlVer = ctl && ((ctl.scriptURL.match(/[?&]v=([^&]+)/) || [])[1]);
    var once = false; try { once = sessionStorage.getItem('swBump') === ver; } catch (e) { /* ignore */ }
    var bootSwap = !!(ctl && ctlVer !== ver && !once), wantReload = false, startedWithCtl = !!ctl;
    var skip = function (w) { if (w) try { w.postMessage({ type: 'skipWaiting' }); } catch (e) { /* ignore */ } };
    if (bootSwap) {
      try { sessionStorage.setItem('swBump', ver); } catch (e) { /* ignore */ }
      try { window.stop(); } catch (e) { /* ignore */ }
      wantReload = true; setTimeout(function () { location.reload(); }, 8000);
    }
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (wantReload) { wantReload = false; location.reload(); return; }
      // 다른 탭이 먼저 새 버전으로 넘겨받았다: 이 탭은 새로고침하지 않고(예전 ?v 요청은 sw 가 직전 캐시에서 준다) 배너만 띄운다
      if (startedWithCtl && !applying) showBanner(null);
    });
    var watch = function (reg) {
      var offer = function (w) {
        if (!w) return;
        if (bootSwap) { skip(w); return; }
        if (navigator.serviceWorker.controller) showBanner(reg); else skip(w);   // 컨트롤러가 없으면(첫 방문) 바로 넘겨받는다
      };
      if (reg.waiting) offer(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var w = reg.installing; if (!w) return;
        w.addEventListener('statechange', function () { if (w.state === 'installed') offer(w); });
      });
      // 오래 켜 둔 탭도 새 버전을 알아채도록 30분마다 · 탭으로 돌아올 때 확인
      setInterval(function () { reg.update().catch(function () {}); }, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () {}); });
    };
    navigator.serviceWorker.register('sw.js?v=' + ver).then(watch).catch(function () {});
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


  // ── 업데이트 배너(4개 언어) — 저장 없이 새로고침하지 않는다 ─────────────────
  var T = {
    ko: ['새 버전이 있습니다 — 저장 후 새로고침', '저장 후 새로고침', '나중에', '지금은 저장할 수 없습니다. 안전한 곳에서 다시 눌러 주세요.'],
    en: ['A new version is available — save, then reload', 'Save & reload', 'Later', "Can't save right now. Try again somewhere safe."],
    ja: ['新しいバージョンがあります — セーブしてから再読み込み', 'セーブして再読み込み', 'あとで', '今はセーブできません。安全な場所でもう一度押してください。'],
    zh: ['有新版本 — 保存后刷新', '保存并刷新', '稍后', '现在无法保存，请到安全的地方再试。']
  };
  function langCode() { try { var l = JSON.parse(localStorage.getItem('haegyo_set') || '{}').lang; return T[l] ? l : 'ko'; } catch (e) { return 'ko'; } }
  var bannerEl = null, bannerReg = null, applying = false;
  function showBanner(reg) {
    if (reg) bannerReg = reg;
    var mount = function () {
      if (!document.body) { setTimeout(mount, 500); return; }
      var t = T[langCode()];
      if (!bannerEl) {
        bannerEl = document.createElement('div'); bannerEl.id = 'updateBanner'; bannerEl.setAttribute('role', 'status');
        bannerEl.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:2147483000;max-width:min(92vw,420px);background:rgba(12,14,18,.94);color:#e8e6e1;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:10px 12px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.5)';
        bannerEl.innerHTML = '<div class="ub-msg"></div><div class="ub-err" style="color:#f0b07a;font-size:12px;margin-top:4px;display:none"></div><div style="margin-top:8px;display:flex;gap:8px;justify-content:flex-end"><button class="ub-later" style="background:none;border:1px solid #555;color:#bbb;border-radius:5px;padding:4px 10px;cursor:pointer"></button><button class="ub-go" style="background:#c9a24a;border:0;color:#111;border-radius:5px;padding:4px 10px;cursor:pointer;font-weight:600"></button></div>';
        bannerEl.querySelector('.ub-later').onclick = function () { bannerEl.style.display = 'none'; };
        bannerEl.querySelector('.ub-go').onclick = applyUpdate;
        document.body.appendChild(bannerEl);
      }
      bannerEl.querySelector('.ub-msg').textContent = t[0]; bannerEl.querySelector('.ub-go').textContent = t[1]; bannerEl.querySelector('.ub-later').textContent = t[2];
      bannerEl.style.display = '';
    };
    mount();
  }
  // 저장(게임이 window.__saveForUpdate 제공: 저장했거나 저장할 게 없으면 true, 저장 못 하면 false) → 새 워커 넘겨받기 → 새로고침
  function applyUpdate() {
    var ok = true;
    try { if (typeof window.__saveForUpdate === 'function') ok = window.__saveForUpdate() !== false; } catch (e) { ok = false; }
    if (!ok) { if (bannerEl) { var er = bannerEl.querySelector('.ub-err'); er.textContent = T[langCode()][3]; er.style.display = ''; } return false; }
    applying = true;
    var w = bannerReg && bannerReg.waiting, done = false, go = function () { if (!done) { done = true; location.reload(); } };
    if (w) { navigator.serviceWorker.addEventListener('controllerchange', go); w.postMessage({ type: 'skipWaiting' }); setTimeout(go, 4000); }
    else go();   // 이미 다른 탭이 넘겨받았다
    return true;
  }
  window.__updateBanner = { show: showBanner, apply: applyUpdate };

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
