// 민아와 자유 대화 (AI) — 선택 기능, 기본 꺼짐.
//   · 설정 › 게임 · 접근성 에서 켜고 서버 주소(server/minaChat 프록시)를 넣어야 나타난다. 주소가 비어 있으면 기능 전체가 숨는다.
//   · API 키는 클라이언트에 없다: 이 파일은 우리 프록시 주소로 게임 상황(장 · 목표 · 장소 · 소지품 · 발견한 단서)과 플레이어 문장만 보낸다.
//   · 민아가 가까이 있을 때 T (게임패드: 일시정지 메뉴의 '민아와 대화') → 입력창 · 입력 중엔 플레이어 조작 멈춤 · 답은 자막 말풍선으로 흘러나온다.
//   · 오프라인 · 오류 · 시간 초과 → 민아의 기존 규칙 기반 대사(window.__mina 또는 게임이 넘겨 준 대사)로 대신한다. 절대 예외를 밖으로 던지지 않는다.
// 순수 함수(sanitizeContext · trimHistory · buildChatRequest · parseNdjsonChunk)는 node 테스트에서 직접 검증한다.

export const CHAT_LIMITS = { text: 300, hist: 8, histText: 400, list: 24, listText: 120, field: 160, memory: 600, timeoutMs: 15000 };
const LANGS = ['ko', 'en', 'ja', 'zh'];
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;
const clean = (v, max) => (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(CTRL, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
// 퍼즐 답처럼 보이는 숫자(3~6자리, 1900~2099 연도 제외)는 보내기 전에 가린다 — 목표 문구 '금고(1012)' 같은 것
export const redactCodes = s => String(s || '').replace(/\d{3,6}/g, m => (m.length === 4 && /^(19|20)\d\d$/.test(m) ? m : '???'));
const cleanList = (a, n = CHAT_LIMITS.list) => (Array.isArray(a) ? a : []).map(x => redactCodes(clean(x, CHAT_LIMITS.listText))).filter(Boolean).slice(-n);

// 게임 상태(신뢰할 수 없는 값 포함) → 서버로 보낼 깨끗한 상황 정보
export function sanitizeContext(c = {}) {
  c = c && typeof c === 'object' ? c : {};
  const ch = Number(c.chapter);
  return {
    chapter: Number.isFinite(ch) ? Math.max(0, Math.min(99, Math.round(ch))) : null,
    objective: redactCodes(clean(c.objective, CHAT_LIMITS.field)),
    location: clean(c.location, CHAT_LIMITS.field),
    emotion: clean(c.emotion, 40),
    memorySummary: redactCodes(clean(c.memorySummary, CHAT_LIMITS.memory)),
    itemsHeld: cleanList(c.itemsHeld),
    discovered: cleanList(c.discovered),
    recentLines: cleanList(c.recentLines, 8),
  };
}
// 대화 기록: 마지막 n 턴(사용자 · 민아 한 쌍), 사용자로 시작하고 민아로 끝나게
export function trimHistory(h, turns = CHAT_LIMITS.hist) {
  const out = [];
  for (const m of Array.isArray(h) ? h : []) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    const text = clean(m.text, CHAT_LIMITS.histText); if (!text) continue;
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1] = { role: m.role, text }; else out.push({ role: m.role, text });
  }
  let r = out.slice(-turns * 2);
  while (r.length && r[0].role !== 'user') r = r.slice(1);
  if (r.length && r[r.length - 1].role === 'user') r = r.slice(0, -1);
  return r;
}
export function buildChatRequest({ lang, playerText, context, history }) {
  return {
    lang: LANGS.includes(lang) ? lang : 'ko',
    playerText: clean(playerText, CHAT_LIMITS.text),
    context: sanitizeContext(context),
    history: trimHistory(history),
  };
}
// 서버 주소 확인: http(s) 만, 끝 경로 /mina/chat 이 없으면 붙인다. 이상하면 ''.
export function normalizeEndpoint(u) {
  u = clean(u, 300); if (!u) return '';
  try { const x = new URL(u); if (x.protocol !== 'https:' && x.protocol !== 'http:') return ''; if (!/\/mina\/chat\/?$/.test(x.pathname)) x.pathname = x.pathname.replace(/\/$/, '') + '/mina/chat'; return x.toString(); } catch (e) { return ''; }
}
// NDJSON 조각 → [객체...], 남은 꼬리
export function parseNdjsonChunk(buf) {
  const lines = buf.split('\n'), rest = lines.pop(), out = [];
  for (const l of lines) { if (!l.trim()) continue; try { out.push(JSON.parse(l)); } catch (e) { /* skip */ } }
  return { events: out, rest };
}

// 서버로 보내고 글자가 올 때마다 onDelta. 결과 { text, fallback, reason }. 실패해도 throw 하지 않는다.
export async function requestReply(endpoint, req, { onDelta = () => {}, timeoutMs = CHAT_LIMITS.timeoutMs, fetchImpl = globalThis.fetch } = {}) {
  const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), timeoutMs);
  let acc = '';
  try {
    const r = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req), signal: ac.signal });
    if (!r.ok || !r.body) return { text: '', fallback: true, reason: 'http_' + r.status };
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      const p = parseNdjsonChunk(buf + dec.decode(value, { stream: true })); buf = p.rest;
      for (const ev of p.events) {
        if (typeof ev.t === 'string') { acc += ev.t; onDelta(acc); }
        if (ev.done) return { text: clean(ev.text, 400), fallback: !!ev.fallback, reason: ev.reason };
      }
    }
    return { text: '', fallback: true, reason: 'truncated' };
  } catch (e) {
    return { text: '', fallback: true, reason: ac.signal.aborted ? 'timeout' : 'offline' };
  } finally { clearTimeout(tm); }
}

// 규칙 기반 대사 (AI 대신): 다른 에이전트가 만드는 window.__mina 를 조심스럽게 읽는다 (없을 수 있음)
function ruleLine(deps) {
  try {
    const m = typeof window !== 'undefined' ? window.__mina : undefined;
    if (m && typeof m === 'object') {
      for (const k of ['hintLine', 'fallbackLine', 'line']) { const f = m[k]; if (typeof f === 'function') { const s = f(); if (typeof s === 'string' && s.trim()) return s; } }
      for (const k of ['hint', 'lastLine', 'currentLine']) { const s = m[k] ?? m.objective?.[k]; if (typeof s === 'string' && s.trim()) return s; }
    }
  } catch (e) { /* ignore */ }
  try { const s = deps.ruleLine && deps.ruleLine(); if (s) return s; } catch (e) { /* ignore */ }
  return '…지금은 우리 할 일부터 하자.';
}
function minaSnapshot() {
  try {
    const m = typeof window !== 'undefined' ? window.__mina : undefined; if (!m || typeof m !== 'object') return {};
    const pick = v => (typeof v === 'string' ? v : v && typeof v === 'object' ? (v.name || v.label || v.state || '') : '');
    const mem = m.memorySummary ?? m.memory?.summary ?? m.memory;
    const lines = m.recentLines ?? m.memory?.recentLines;
    return { emotion: pick(m.emotion), memorySummary: typeof mem === 'string' ? mem : '', recentLines: Array.isArray(lines) ? lines.map(x => (typeof x === 'string' ? x : x && x.text)).filter(Boolean) : [], objectiveHint: pick(m.objective?.context ?? m.objectiveContext ?? m.context) };
  } catch (e) { return {}; }
}

// ---------- 화면 ----------
// deps: { SET, saveSET, lang(), near(), playing(), pause(), resume(), context(), ruleLine(), onSettingsMount? }
let D = null, open = false, history = [], busy = false;
const $ = id => document.getElementById(id);
export const enabled = () => !!(D && D.SET.minaAI && normalizeEndpoint(D.SET.minaAIUrl));

function css() {
  if ($('mcStyle')) return;
  const s = document.createElement('style'); s.id = 'mcStyle';
  s.textContent = `#mcBox{position:fixed;left:50%;bottom:calc(120px * var(--subScale,1) + 40px);transform:translateX(-50%);width:min(640px,86vw);z-index:60;display:none;font-family:inherit}
#mcBox.show{display:block}#mcBox .mcLog{max-height:30vh;overflow:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
#mcBox .mcB{background:rgba(0,0,0,var(--subBg,.55));color:#f2efe6;padding:7px 14px;border-radius:4px;font-size:calc(17px * var(--subScale,1));line-height:1.45;text-shadow:0 1px 2px #000}
#mcBox .mcB.me{align-self:flex-end;color:#cfd8e6;font-size:calc(15px * var(--subScale,1))}#mcBox .mcB b{color:#f0c987;margin-right:6px}
#mcBox .mcRow{display:flex;gap:6px}#mcBox input{flex:1;background:rgba(10,10,12,.85);border:1px solid #6b6252;color:#fff;padding:8px 10px;font-size:15px;border-radius:4px}
#mcBox small{display:block;color:#a9a294;margin-top:4px;font-size:11.5px}#mcPrompt{position:fixed;left:50%;bottom:22%;transform:translateX(-50%);color:#e8e0cc;font-size:13px;background:rgba(0,0,0,.5);padding:3px 10px;border-radius:3px;display:none;z-index:40;pointer-events:none}
.mcDisc{grid-column:1/-1;color:#b8ad98;font-size:12px;line-height:1.45;margin:-2px 0 6px}`;
  document.head.appendChild(s);
}
function buildUI() {
  if ($('mcBox')) return;
  const b = document.createElement('div'); b.id = 'mcBox'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', '민아와 대화');
  b.innerHTML = `<div class="mcLog" id="mcLog" aria-live="polite"></div><div class="mcRow"><input id="mcIn" maxlength="${CHAT_LIMITS.text}" autocomplete="off" placeholder="민아에게 말하기… (Enter 보내기 · Esc 닫기)"></div><small>AI 생성 대사 — 메시지는 AI 서비스로 전송됩니다</small>`;
  document.body.appendChild(b);
  const p = document.createElement('div'); p.id = 'mcPrompt'; document.body.appendChild(p);
}
function bubble(cls, who, text) {
  const d = document.createElement('div'); d.className = 'mcB ' + cls;
  if (who) { const w = document.createElement('b'); w.textContent = who; d.appendChild(w); }
  const t = document.createElement('span'); t.textContent = text; d.appendChild(t);
  const L = $('mcLog'); L.appendChild(d); while (L.children.length > 8) L.firstChild.remove(); L.scrollTop = L.scrollHeight;
  return t;
}
export function openChat() {
  if (!enabled() || open || !D.playing() || !D.near()) return false;
  open = true; D.pause(); $('mcBox').classList.add('show'); $('mcPrompt').style.display = 'none';
  const i = $('mcIn'); i.value = ''; setTimeout(() => i.focus(), 0); return true;
}
export function closeChat() {
  if (!open) return; open = false; $('mcBox').classList.remove('show'); try { $('mcIn').blur(); } catch (e) { /* ignore */ }
  try { D.resume(); } catch (e) { /* ignore */ }
}
async function send() {
  const i = $('mcIn'), text = clean(i.value, CHAT_LIMITS.text); if (!text || busy) return;
  i.value = ''; busy = true; bubble('me', '', text);
  const span = bubble('mina', '민아', '…');
  let r;
  try {
    const sm = minaSnapshot(), c = D.context() || {};
    const req = buildChatRequest({ lang: D.lang(), playerText: text, history, context: { ...c, emotion: sm.emotion || c.emotion, memorySummary: [sm.memorySummary, sm.objectiveHint].filter(Boolean).join(' / '), recentLines: sm.recentLines?.length ? sm.recentLines : c.recentLines } });
    r = await requestReply(normalizeEndpoint(D.SET.minaAIUrl), req, { onDelta: s => { span.textContent = s; } });
  } catch (e) { r = { text: '', fallback: true, reason: 'client' }; }
  const reply = r.text || ruleLine(D);
  span.textContent = reply;
  if (!r.text) span.parentElement.title = '규칙 기반 대사 (' + (r.reason || 'offline') + ')';
  history = trimHistory([...history, { role: 'user', text }, { role: 'assistant', text: reply }]);
  busy = false;
}
// 설정 › 게임 · 접근성 에 줄 추가 (index.html 을 건드리지 않는다)
function mountSettings() {
  const page = document.querySelector('.setPage[data-s="acc"] .setgrid'); if (!page || $('setMinaAI')) return;
  const h = document.createElement('h4'); h.textContent = '민아와 자유 대화 (AI)';
  const s1 = document.createElement('span'); s1.textContent = '민아와 자유 대화 (AI)';
  const l1 = document.createElement('label'); l1.innerHTML = '<input type="checkbox" id="setMinaAI"> 민아가 곁에 있을 때 T 키로 자유롭게 말 걸기';
  const s2 = document.createElement('span'); s2.textContent = 'AI 서버 주소';
  const u = document.createElement('input'); u.type = 'url'; u.id = 'setMinaAIUrl'; u.placeholder = 'https://…/mina/chat'; u.spellcheck = false; u.style.width = '100%';
  const d = document.createElement('p'); d.className = 'mcDisc'; d.textContent = '켜면 입력한 메시지와 현재 게임 상황(목표 · 장소 · 소지품 · 발견한 단서)이 AI 서비스(Anthropic Claude)로 전송되어 민아의 답이 실시간으로 생성됩니다. 생성된 대사는 미리 검수되지 않습니다. 주소를 비워 두면 기능이 숨겨집니다.';
  page.append(h, s1, l1, s2, u, d);
  const cb = $('setMinaAI');
  const fill = () => { cb.checked = !!D.SET.minaAI; u.value = D.SET.minaAIUrl || ''; };
  fill(); page.closest('.setPage')?.addEventListener('focusin', fill, { once: true });
  cb.onchange = () => { D.SET.minaAI = cb.checked; D.saveSET(); syncDesktop(); };
  u.onchange = () => { const n = normalizeEndpoint(u.value); D.SET.minaAIUrl = n; u.value = n; D.saveSET(); syncDesktop(); };
  u.addEventListener('keydown', e => e.stopPropagation());
}
// Electron: 기본적으로 app:// 밖 요청을 모두 막는다 → 사용자가 넣은 주소 하나만 허용해 달라고 알린다
function syncDesktop() { try { const dk = window.desktop; if (dk && typeof dk.setAiEndpoint === 'function') dk.setAiEndpoint(enabled() ? normalizeEndpoint(D.SET.minaAIUrl) : ''); } catch (e) { /* ignore */ } }
function mountPauseEntry() {
  const m = document.querySelector('#pause .menuBtns'); if (!m || $('mcPauseBtn')) return;
  const b = document.createElement('button'); b.className = 'btn'; b.id = 'mcPauseBtn'; b.textContent = '민아와 대화 (AI)'; b.style.display = 'none';
  b.onclick = () => { $('resumeBtn')?.click(); setTimeout(openChat, 60); };
  m.insertBefore(b, m.children[1] || null);
}

export function installMinaChat(deps) {
  D = deps; if (typeof document === 'undefined') return;
  css(); buildUI(); mountSettings(); mountPauseEntry(); syncDesktop();
  if (D.SET.minaAI == null) D.SET.minaAI = false;
  if (typeof D.SET.minaAIUrl !== 'string') D.SET.minaAIUrl = '';
  // 캡처 단계에서 먼저 받는다: 입력 중엔 게임 단축키 · 이동 키가 새지 않게
  addEventListener('keydown', e => {
    if (open) {
      if (e.code === 'Escape') { e.preventDefault(); closeChat(); }
      else if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !e.isComposing) { e.preventDefault(); send(); }
      e.stopImmediatePropagation(); return;
    }
    if (e.code === 'KeyT' && !e.repeat && enabled() && D.playing() && D.near()) {
      if (openChat()) { e.preventDefault(); e.stopImmediatePropagation(); }
    }
  }, true);
  addEventListener('keyup', e => { if (open) e.stopImmediatePropagation(); }, true);
  setInterval(() => {   // 'T 민아와 대화' 안내 · 일시정지 메뉴 항목
    try {
      const ok = enabled() && D.near(); const p = $('mcPrompt');
      if (p) { p.style.display = ok && !open && D.playing() ? 'block' : 'none'; p.textContent = 'T  민아와 대화'; }
      const pb = $('mcPauseBtn'); if (pb) pb.style.display = ok ? '' : 'none';
    } catch (e) { /* ignore */ }
  }, 400);
}
