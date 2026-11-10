// Steam 업적 브리지 — 데스크톱판(window.desktop.steam)에서만 동작, 브라우저에서는 아무것도 안 한다.
// 게임 코드를 건드리지 않고 저장 데이터(localStorage)를 주기적으로 읽어 desktop/steam/achievements.json 규칙대로 해제한다.
(function () {
  const S = window.desktop && window.desktop.steam;
  if (!S) return;
  const TEST = /[?&]test\b/.test(location.search);   // 테스트 모드 세이브는 업적에 반영하지 않는다
  if (TEST) return;
  const J = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  let rules = [];
  function check() {
    const ends = J('haegyo_endings', []), stats = J('haegyo_stats', {}), save = J('haegyo_save_v5', {}) || {};
    const deaths = Number(localStorage.getItem('haegyo_deaths')) || 0;
    const bests = Object.values((stats && stats.best) || {}).filter(n => typeof n === 'number');
    for (const a of rules) {
      const r = a.rule || {}; let ok = false;
      if (r.type === 'ending') ok = Array.isArray(ends) && ends.includes(r.id);
      else if (r.type === 'allEndings') ok = Array.isArray(ends) && r.ids.every(id => ends.includes(id));
      else if (r.type === 'deaths') ok = deaths >= r.min;
      else if (r.type === 'docs') ok = Array.isArray(save.docs) && save.docs.length >= r.min;
      else if (r.type === 'clues') ok = Array.isArray(save.clues) && save.clues.length >= r.min;
      else if (r.type === 'bestTimeUnder') ok = bests.some(t => t > 0 && t < r.sec);
      if (ok) S.unlock(a.apiName);
    }
  }
  S.achievements().then(list => { rules = Array.isArray(list) ? list : []; check(); setInterval(check, 5000); addEventListener('pagehide', check); }).catch(() => {});
})();
