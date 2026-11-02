// 로딩 화면 v2 — 「사건 기록」 페이지 · 일러스트 · 진행 막대 (설정: 1998.10.12 서문고 은폐 사건)
// 게임 코드와 독립: #loading 이 보이는 동안만 기록 페이지를 넘기고, 진행 막대는 실제 소품 불러오기 수(__modelLoadState)가 있으면 그것을, 없으면 경과 시간으로 추정한다.
(function () {
  const PAGES = [
    { img: 'gate', title: '1998.10.12 (월) 23:40 — 서문고 본관', date: '기록 01 · 현장', text: '야간 자율학습 2부가 끝나야 할 시각. 4층 방송실 창문에만 불이 켜져 있었다. 예정된 하교 방송은 끝내 나오지 않았다.' },
    { img: 'tape', title: '방송실 — 송출되지 않은 테이프', date: '기록 02 · 방송부', text: '23:40에 맞춰진 기계식 타이머. 담당은 3학년 2반 윤하늘. 다음 날 아침, 원본 테이프는 교장실이 회수했다.' },
    { img: 'pump', title: '지하 펌프실 — 밖에서 잠긴 문', date: '기록 03 · 시설', text: '지하에서 올라온 학생 셋은 “문이 안 열렸다”고 진술했다. 학교 시설 일지에는 그날 밤 지하 출입 기록이 없다.' },
    { img: 'attend', title: '3학년 2반 출석부 — 수정액 한 줄', date: '기록 04 · 교무부', text: '10월 12일 야간 자율학습은 “전원 정상 하교”. 윤하늘의 칸만 수정액 아래로 지워진 글씨가 비친다.' },
    { img: 'meeting', title: '교무회의실 — 10.13 새벽 1시', date: '기록 05 · 회의', text: '다섯 명의 교직원이 모였다. 회의록은 남지 않았다. 다음 날부터 학교의 말은 하나로 맞춰졌다.' },
    { img: 'clip', title: '서문일보 스크랩 — 내사 종결', date: '기록 06 · 언론', text: '11월 2일, 경찰은 단순 사고로 내사를 종결했다. 기사 아래 누군가 연필로 적었다. “그날 밤 열쇠는 누가 갖고 있었나?”' },
  ];
  const ov = document.getElementById('loading'); if (!ov) return;
  const $ = id => document.getElementById(id);
  const img = $('ldImg'), img2 = $('ldImg2'), tEl = $('ldTitle'), dEl = $('ldDate'), xEl = $('ldText'), nEl = $('ldNo'), fill = $('ldFill'), pageEl = $('ldPage');
  if (!img || !tEl) return;
  const src = k => 'assets/img/case/' + k + '.webp?v=296';
  PAGES.forEach(p => { const im = new Image(); im.src = src(p.img); });   // 미리 받아 둔다 (넘길 때 깜빡임 방지)
  let k = Math.floor(Math.random() * PAGES.length), front = img, back = img2, timer = 0, t0 = performance.now(), shownAt = t0;
  function show(i, instant) {
    k = (i + PAGES.length) % PAGES.length; const p = PAGES[k];
    back.src = src(p.img); back.classList.add('on'); front.classList.remove('on'); const tmp = front; front = back; back = tmp;
    pageEl.classList.remove('in'); void pageEl.offsetWidth;
    tEl.textContent = p.title; dEl.textContent = p.date; xEl.textContent = p.text; nEl.textContent = String(k + 1).padStart(2, '0') + ' / ' + String(PAGES.length).padStart(2, '0');
    pageEl.classList.add('in'); shownAt = performance.now();
  }
  show(k, true);
  const visible = () => ov.classList.contains('show');
  function tick() {
    if (!visible()) { t0 = performance.now(); return; }
    const now = performance.now();
    if (now - shownAt > 7500) show(k + 1);
    const s = window.__modelLoadState; let p;
    if (s && s.total) p = Math.min(1, s.completed / s.total);
    else p = Math.min(.94, 1 - Math.exp(-(now - t0) / 16000));   // 진행 수를 모르는 첫 로딩: 시간 기준 추정 (끝에서 멈추지 않게 94%까지만)
    if (fill) fill.style.width = (p * 100).toFixed(1) + '%';
  }
  timer = setInterval(tick, 200);
  ov.addEventListener('click', () => { if (visible()) show(k + 1); });
  addEventListener('keydown', e => { if (!visible()) return; if (e.code === 'ArrowRight') show(k + 1); else if (e.code === 'ArrowLeft') show(k - 1); });
  // 다시 나타날 때(새 게임 · 이어하기의 소품 불러오기) 새 기록부터
  let wasVis = visible(); new MutationObserver(() => { const v = visible(); if (v && !wasVis) { t0 = performance.now(); show(k + 1); } wasVis = v; }).observe(ov, { attributes: true, attributeFilter: ['class'] });
})();
