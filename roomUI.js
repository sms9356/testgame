// 방별 UI 상호작용 · 애니메이션 (roomUI v1)
//   · 방에 들어서면 「현장 조사」 카드: 방 이름 · 방 종류 아이콘 · 한 줄 메모 · 이 방 조사 지점 (확인 / 전체) → 몇 초 뒤 작은 칩으로 접힌다
//   · 상호작용 안내(E)에 대상 종류 아이콘 · 방 색 · 나타날 때 튀어나오는 애니메이션
//   · 아이템 획득 카드가 소지품(퀵슬롯) 쪽으로 날아가 들어가는 애니메이션 · 목표가 바뀌면 목표 패널이 반짝
//   게임 코드는 건드리지 않고, 넘겨받은 상태(P · world · RBG · 현재 대상)를 읽기만 한다.
const ROOM_TYPES = [
  [/교무실|행정실/, { ic: '📁', c: '#e2b35a', note: '결재 서류 · 공문 · 금고 — 학교의 말이 정리된 곳' }],
  [/교장실/, { ic: '🏛', c: '#d08a4a', note: '직인 · 감사 문서 — 마지막 결재가 내려진 곳' }],
  [/방송실/, { ic: '📻', c: '#e05a4a', note: '송출 기록 · 테이프 — 그날 23:40의 방송' }],
  [/도서실|열람실/, { ic: '📚', c: '#c9a36a', note: '대출 카드 · 신문 스크랩 — 기록은 책 사이에 남는다' }],
  [/보건실/, { ic: '🩺', c: '#5cc0b4', note: '보건일지 · 약품장 — 그날 밤 다친 학생들' }],
  [/과학실|실험/, { ic: '🧪', c: '#5aa8e0', note: '약품장 · 실험대 — 잠긴 장의 사용 기록' }],
  [/음악실/, { ic: '🎹', c: '#b08ae0', note: '피아노 · 악보 — 반주 연습이 멈춘 자리' }],
  [/미술실/, { ic: '🎨', c: '#e08ab0', note: '이젤 · 스케치 — 지워진 얼굴' }],
  [/컴퓨터실/, { ic: '💾', c: '#6ad0a0', note: 'PC · 수신기 — 포맷된 디스크에 남은 로그' }],
  [/화장실/, { ic: '🚻', c: '#8aa0b0', note: '칸막이 · 세면대 — 낙서는 지워지지 않는다' }],
  [/회의실|상담실|진로/, { ic: '💬', c: '#c0a070', note: '회의 · 상담 기록 — 누가 무엇을 말했나' }],
  [/창고/, { ic: '📦', c: '#9a8a70', note: '보관 상자 — 버리지 못한 물건들' }],
  [/현관|계단|복도/, { ic: '🚪', c: '#9aa3a8', note: '이동 통로 — 방마다 다른 단서가 있다' }],
  [/(\d)학년 (\d+)반|빈 교실|자율학습/, { ic: '🏫', c: '#7fc08a', note: '칠판 · 출석부 · 사물함 — 학생들의 하루' }],
  [/가정실|공예|작업/, { ic: '🧵', c: '#c08a60', note: '실습실 — 도구와 재료' }],
];
const KIND_IC = { key: '🗝', battery: '🔋', medkit: '🩹', photo: '🖼', camcorder: '📹', nametag: '🏷', hairpin: '📍', can: '🥫', fuse: '🔌', mop: '🧹', wire: '➰', stairs: '🪜', door: '🚪', rbdoor: '🚪', gate: '🏫', rbelev: '🛗', safe: '🔐', lock: '🔒', case5: '🔢', tape: '📼', note: '📄', clue: '🔎', look: '👁', search: '🗄', robj: '✋', mspot: '🧩', piano: '🎹', easel: '🖼', console: '🎚', mina: '🧍', cctvRec: '📹', megaRadio: '📡', sink: '🚰', flush: '🚽', pick: '🤏', sq: '⭐', switch: '💡', ldoor: '🚪', idoor: '🚪', item: '🤏', locker: '🚪', elevator: '🛗', bell: '🔔', phone: '☎', breaker: '⚡', cbreaker: '⚡' };
const COUNT = new Set(['look', 'search', 'robj', 'tape', 'clue', 'safe', 'lock', 'mspot', 'case5', 'pick', 'sq', 'piano', 'easel', 'console', 'mina', 'cctvRec', 'megaRadio', 'drain', 'footprints', 'phone', 'gradio', 'glog']);
export function installRoomUI({ P, world, getRBG, getState, getTarget, keyInteract = () => 'KeyE' }) {
  if (window.__roomUI) return window.__roomUI;
  const css = document.createElement('style'); css.id = 'roomUIcss'; css.textContent = CSS; document.head.appendChild(css);
  const card = document.createElement('div'); card.id = 'roomCard'; card.innerHTML = '<div class="rc-ic"></div><div class="rc-b"><small class="rc-k">현장 조사</small><b class="rc-n"></b><span class="rc-note"></span><div class="rc-bar"><i></i></div><span class="rc-cnt"></span></div>';
  (document.getElementById('hud') || document.body).appendChild(card);
  const seen = new Set(); let curRoom = '', shownAt = 0, lastTgt = null;
  const roomOf = (x, z, y) => { const R = getRBG(); if (!R || !R.where) return ''; return R.where(x, z, y) || ''; };
  const typeOf = name => (ROOM_TYPES.find(([re]) => re.test(name)) || [null, { ic: '📍', c: '#9aa3a8', note: '' }])[1];
  const uid = p => p.uid || p.id || (p.kind + ':' + (p.x ?? p.pos?.x)?.toFixed?.(2) + ':' + (p.z ?? p.pos?.z)?.toFixed?.(2));
  function roomPoints(name) {
    const out = [];
    for (const p of world.props) { if (!COUNT.has(p.kind) || p.rbY == null || p.hidden) continue; if (roomOf(p.x, p.z, p.rbY + .5) === name) out.push(p); }
    for (const it of world.items) { if (it.rbY == null || !it.pos) continue; if (roomOf(it.pos.x, it.pos.z, it.rbY + .5) === name) out.push(it); }
    return out;
  }
  const isDone = p => seen.has(uid(p)) || p.done || p.solved || p.taken || (p.n > 0);
  function render(full) {
    const T = typeOf(curRoom), pts = roomPoints(curRoom), d = pts.filter(isDone).length;
    card.style.setProperty('--rc', T.c);
    card.querySelector('.rc-ic').textContent = T.ic; card.querySelector('.rc-n').textContent = curRoom.replace(/^(본관|별관) /, '$1 · ');
    card.querySelector('.rc-note').textContent = T.note;
    card.querySelector('.rc-cnt').textContent = pts.length ? '조사 지점 ' + d + ' / ' + pts.length + (d >= pts.length ? ' · 모두 확인' : '') : '조사 지점 없음';
    card.querySelector('.rc-bar i').style.width = pts.length ? (d / pts.length * 100) + '%' : '0';
    card.classList.toggle('done', !!pts.length && d >= pts.length);
    if (full) { card.classList.remove('mini', 'on'); void card.offsetWidth; card.classList.add('on'); shownAt = performance.now(); }
  }
  // 방 바뀜 감지 (0.4초마다)
  setInterval(() => {
    const st = getState(); if (st !== 'playing') { card.classList.add('hide'); return; } card.classList.remove('hide');
    { const op = document.getElementById('objP'); if (op) { const r = op.getBoundingClientRect(), z = parseFloat(getComputedStyle(card).zoom) || 1; if (r.height) card.style.top = ((r.bottom + 10) / z) + 'px'; } }   // 목표 패널(펼침 · 접힘) 바로 아래
    const name = P.floor === 0 ? roomOf(P.x, P.z, (P.sh || 0) + .5) : '';
    if (name !== curRoom) { curRoom = name; if (name) render(true); else card.classList.remove('on', 'mini'); }
    else if (name && card.classList.contains('on') && !card.classList.contains('mini') && performance.now() - shownAt > 6000) card.classList.add('mini');
  }, 400);
  // 상호작용 안내: 대상 종류 아이콘 · 방 색 · 튀어나오기
  const pr = document.getElementById('prompt');
  setInterval(() => {
    if (!pr) return; const t = getTarget(); const kind = t ? (t.type === 'prop' ? t.p && t.p.kind : t.type === 'item' ? (t.it && t.it.kind) || 'item' : t.type) : null;
    const key = t ? (t.label || '') + kind : null;
    if (key !== lastTgt) { lastTgt = key; pr.dataset.ic = kind ? (KIND_IC[kind] || '•') : ''; pr.classList.remove('pop'); if (t) { void pr.offsetWidth; pr.classList.add('pop'); } }
    pr.style.setProperty('--rc', curRoom ? typeOf(curRoom).c : '#e2b35a');
  }, 120);
  // E를 누르는 순간의 대상을 '확인함'으로 기록 (게임보다 먼저 듣는다)
  addEventListener('keydown', e => { if (e.code !== keyInteract() || getState() !== 'playing') return; const t = getTarget(); const p = t && (t.p || t.it || t.prop); if (p) { const id = uid(p); if (!seen.has(id)) { seen.add(id); if (curRoom) setTimeout(() => render(false), 150); } } }, true);
  // 아이템 획득 카드 → 퀵슬롯으로 날아가기
  const loot = document.getElementById('lootCard');
  if (loot) new MutationObserver(() => { if (loot.classList.contains('on') || !loot.innerHTML || loot.classList.contains('scare')) return;
    const ic = loot.querySelector('.ic'); const dst = document.getElementById('slots') || document.getElementById('who'); if (!ic || !dst) return;
    const a = ic.getBoundingClientRect(), b = dst.getBoundingClientRect(); if (!a.width) return;
    const fly = ic.cloneNode(true); fly.className = 'lootFly'; Object.assign(fly.style, { left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px' }); document.body.appendChild(fly);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    fly.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + dx * .55 + 'px,' + (dy * .35 - 60) + 'px) scale(.7)', opacity: .95, offset: .55 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.25)', opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => { fly.remove(); dst.animate([{ transform: dst.style.transform || 'translateX(-50%)', filter: 'brightness(1.6)' }, { transform: dst.style.transform || 'translateX(-50%)', filter: 'none' }], { duration: 400 }); };
  }).observe(loot, { attributes: true, attributeFilter: ['class'] });
  // 목표가 바뀌면 목표 패널 반짝
  const obj = document.getElementById('objMini'); let lastObj = '';
  if (obj) new MutationObserver(() => { const t = obj.textContent; if (t && t !== lastObj) { if (lastObj) { const pnl = document.getElementById('objP'); pnl && pnl.animate([{ boxShadow: '0 0 0 2px rgba(226,179,90,.9),0 0 24px rgba(226,179,90,.5)' }, { boxShadow: '0 0 0 0 rgba(226,179,90,0)' }], { duration: 1400, easing: 'ease-out' }); } lastObj = t; } }).observe(obj, { childList: true, subtree: true, characterData: true });
  return (window.__roomUI = { seen, render: () => render(true), get room() { return curRoom; } });
}
const CSS = `
#roomCard{position:absolute;left:20px;top:64px;display:flex;gap:12px;align-items:center;max-width:360px;padding:10px 14px 10px 10px;border-radius:6px;background:linear-gradient(168deg,rgba(22,26,31,.9),rgba(8,10,12,.94));border:1px solid rgba(255,255,255,.07);border-left:3px solid var(--rc,#e2b35a);box-shadow:0 10px 28px rgba(0,0,0,.5);opacity:0;transform:translateX(-14px);transition:opacity .45s,transform .45s cubic-bezier(.2,.8,.2,1),max-width .45s,padding .45s;pointer-events:none;zoom:var(--ui,1)}
#roomCard.on{opacity:1;transform:none}
#roomCard.hide{opacity:0!important}
#roomCard .rc-ic{width:40px;height:40px;flex:none;display:grid;place-items:center;font-size:22px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.08),rgba(0,0,0,.3));box-shadow:0 0 0 1px var(--rc,#e2b35a) inset,0 0 14px color-mix(in srgb,var(--rc,#e2b35a) 35%,transparent);transition:width .45s,height .45s,font-size .45s}
#roomCard.on .rc-ic{animation:rcIc .7s cubic-bezier(.2,1.4,.4,1) both}
@keyframes rcIc{from{transform:scale(.4) rotate(-20deg);opacity:0}to{transform:none;opacity:1}}
#roomCard .rc-b{display:flex;flex-direction:column;gap:2px;min-width:0}
#roomCard .rc-k{font-size:10px;letter-spacing:.3em;color:var(--rc,#e2b35a)}
#roomCard .rc-n{font-size:15px;color:#f2ead8;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#roomCard .rc-note{font-size:11.5px;color:#a9b0b4;line-height:1.5}
#roomCard .rc-bar{height:3px;margin-top:5px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden}
#roomCard .rc-bar i{display:block;height:100%;width:0;background:var(--rc,#e2b35a);transition:width .6s cubic-bezier(.2,.8,.2,1)}
#roomCard .rc-cnt{font-size:11px;color:#d6cdb6;font-variant-numeric:tabular-nums}
#roomCard.done .rc-cnt{color:#8fe0a8}
#roomCard.on .rc-n,#roomCard.on .rc-note,#roomCard.on .rc-cnt{animation:rcTx .6s ease both}
#roomCard.on .rc-note{animation-delay:.12s}#roomCard.on .rc-cnt{animation-delay:.22s}
@keyframes rcTx{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
#roomCard.mini{max-width:230px;padding:6px 10px 6px 6px}
#roomCard.mini .rc-ic{width:26px;height:26px;font-size:14px}
#roomCard.mini .rc-k,#roomCard.mini .rc-note{display:none}
#roomCard.mini .rc-n{font-size:12.5px}
#prompt.pop{animation:prPop .35s cubic-bezier(.2,1.5,.4,1)}
@keyframes prPop{from{transform:translateX(-50%) scale(.85);opacity:.2}to{transform:translateX(-50%) scale(1);opacity:1}}
#prompt[data-ic]:not([data-ic=""])::before{content:attr(data-ic);margin-right:8px;display:inline-block;filter:drop-shadow(0 0 6px var(--rc,#e2b35a))}
#prompt{border-color:color-mix(in srgb,var(--rc,#e2b35a) 55%,transparent)!important}
#prompt kbd{animation:kbdPulse 1.8s ease-in-out infinite}
@keyframes kbdPulse{0%,100%{box-shadow:0 0 0 0 rgba(226,179,90,.0)}50%{box-shadow:0 0 0 4px rgba(226,179,90,.25)}}
.lootFly{position:fixed;z-index:60;pointer-events:none;display:grid;place-items:center;font-size:30px;border-radius:10px;background:rgba(20,22,24,.8);box-shadow:0 0 18px rgba(226,179,90,.6)}
.lootFly img{max-width:100%;max-height:100%}
#noteBox.show #note{animation:noteIn .55s cubic-bezier(.2,.9,.2,1) both;transform-origin:50% 0}
@keyframes noteIn{from{opacity:0;transform:perspective(900px) rotateX(-14deg) translateY(18px) scale(.97)}to{opacity:1;transform:none}}
#toasts>*{animation:toastIn .45s cubic-bezier(.2,.9,.2,1) both}
@keyframes toastIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){#roomCard,#roomCard *,#prompt,#prompt kbd,#noteBox #note,#toasts>*{animation:none!important;transition:none!important}}
`;
