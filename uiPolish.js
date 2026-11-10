// UI 다듬기 — 게임패드로 메뉴 조작(일시정지 · 설정 · 소지품 · 휴대폰 · 문서) · 로딩 퍼센트 표시
// 게임 코드와 독립: 보이는 오버레이 안의 버튼 사이를 십자키/스틱으로 옮기고 A=결정, B=닫기(Esc 전달). 타이틀/캐릭터 선택은 자체 처리.
(function () {
  const MENUS = ['pause', 'settings', 'inv', 'phone', 'noteBox', 'newConfirm', 'invZoom'];
  const $ = id => document.getElementById(id);
  const visible = el => el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
  let cur = null, prev = {}, rep = 0;
  function activeMenu() { for (const id of MENUS) { const el = $(id); if (el && el.classList.contains('show')) return el; } return null; }
  function items(menu) { return [...menu.querySelectorAll('button:not([disabled]), select, input[type=range], input[type=checkbox], [data-close]')].filter(visible); }
  function focus(el) { if (cur) cur.classList.remove('gpFocus'); cur = el; if (!el) return; el.classList.add('gpFocus'); try { el.focus({ preventScroll: false }); el.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ } }
  function move(menu, dx, dy) {
    const list = items(menu); if (!list.length) return;
    if (!cur || !list.includes(cur)) { focus(list[0]); return; }
    if (dx && cur.type === 'range') { cur.value = +cur.value + dx * (+cur.step || 1) * 5; cur.dispatchEvent(new Event('input', { bubbles: true })); cur.dispatchEvent(new Event('change', { bubbles: true })); return; }
    if (dx && cur.tagName === 'SELECT') { const n = cur.options.length; cur.selectedIndex = (cur.selectedIndex + dx + n) % n; cur.dispatchEvent(new Event('change', { bubbles: true })); return; }
    const r0 = cur.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    let best = null, bd = 1e9;
    for (const el of list) { if (el === cur) continue; const r = el.getBoundingClientRect(), ex = r.left + r.width / 2 - cx, ey = r.top + r.height / 2 - cy;
      const along = dx ? ex * dx : ey * dy, side = dx ? Math.abs(ey) : Math.abs(ex); if (along <= 4) continue;
      const d = along + side * 2.5; if (d < bd) { bd = d; best = el; } }
    if (best) focus(best);
  }
  function press(el) { if (!el) return; if (el.type === 'checkbox') { el.checked = !el.checked; el.dispatchEvent(new Event('change', { bubbles: true })); } else el.click(); }
  function esc() { document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true })); }
  function poll() {
    requestAnimationFrame(poll);
    const pads = navigator.getGamepads ? navigator.getGamepads() : []; const gp = pads && [...pads].find(Boolean); if (!gp) return;
    if (window.__g && window.__g.state === 'menu') return;   // 타이틀 쪽은 game.js 가 패드를 처리
    const menu = activeMenu(); if (!menu) { if (cur) focus(null); prev = {}; return; }
    const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed), ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const st = { up: b(12) || ay < -.6, down: b(13) || ay > .6, left: b(14) || ax < -.6, right: b(15) || ax > .6, a: b(0), b: b(1), lb: b(4), rb: b(5) };
    const now = performance.now(), edge = k => st[k] && (!prev[k] || now > rep);
    if (['up', 'down', 'left', 'right'].some(k => st[k] && !prev[k])) rep = now + 380; else if (['up', 'down', 'left', 'right'].some(edge)) rep = now + 110;
    if (edge('up')) move(menu, 0, -1); else if (edge('down')) move(menu, 0, 1); else if (edge('left')) move(menu, -1, 0); else if (edge('right')) move(menu, 1, 0);
    if (st.a && !prev.a) { if (menu.id === 'noteBox') menu.click(); else press(cur || items(menu)[0]); }
    if (st.b && !prev.b) { if (menu.id === 'noteBox') menu.click(); else { const x = menu.querySelector('.x, [data-close]'); if (x && menu.id !== 'pause') x.click(); else esc(); } }
    // LB / RB: 탭 전환 (소지품 · 설정 · 휴대폰)
    if ((st.lb && !prev.lb) || (st.rb && !prev.rb)) { const tabs = [...menu.querySelectorAll('#invTabs button, #setTabs button, .pTabs button')].filter(visible); if (tabs.length) { const i = Math.max(0, tabs.findIndex(t => t.classList.contains('on'))); tabs[(i + (st.rb ? 1 : -1) + tabs.length) % tabs.length].click(); } }
    prev = st;
  }
  addEventListener('gamepadconnected', () => { if (!poll._on) { poll._on = true; requestAnimationFrame(poll); } });
  addEventListener('mousemove', () => { if (cur) { cur.classList.remove('gpFocus'); cur = null; } }, { passive: true });

  // 로딩 화면: 진행 막대 아래 퍼센트 (숫자는 언어와 무관)
  const fill = $('ldFill'), bar = fill && fill.parentElement;
  if (bar) { const pct = document.createElement('span'); pct.className = 'ldPct'; bar.after(pct);
    const upd = () => { const w = parseFloat(fill.style.width) || 0; pct.textContent = Math.round(w) + '%'; };
    new MutationObserver(upd).observe(fill, { attributes: true, attributeFilter: ['style'] }); upd(); }
})();
