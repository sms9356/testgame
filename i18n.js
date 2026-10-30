// 언어 패치 (한국어 · English · 日本語 · 中文) — 인터페이스 · 자막 · 음성
// 게임 코드의 한국어 문장은 그대로 두고, 화면에 나타나는 순간 번역한다 (패치 방식):
//   · 화면 글자: 문서의 글자 노드가 바뀔 때마다(MutationObserver) 사전에서 찾아 바꾼다 — 메뉴 · HUD · 토스트 · 자막 · 휴대폰 · 쪽지 전부
//   · 지도 · 미니맵 · 마이크 미터처럼 화면에 붙은 캔버스 글자도 번역 (3D 표지판 · 칠판 · 포스터는 학교 안의 한국어 그대로 둔다)
//   · 음성: 영어 · 일본어 · 중국어는 voice/<언어>/ 의 신경망 음성 팩(미리 만든 파일)을 재생하고, 팩에 없는 대사만 브라우저 음성(그 언어 목소리)으로 읽는다
// 사전: lang/<en|ja|zh>.json — { "한국어 원문": "번역" } · 원문 속 {} 는 실행 중 들어가는 값(이름 · 숫자 등)
import { SET, saveSET } from './settings.js';

export const LANGS = { ko: '한국어', en: 'English', ja: '日本語', zh: '中文' };
export const SPEECH_LANG = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN' };
const HG = /[가-힣]/;
let dict = null, tpls = [], cache = new Map(), vpack = null;
const MISS = new Set();
export const lang = () => (LANGS[SET.lang] ? SET.lang : 'ko');

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function build(obj) {
  dict = new Map(); tpls = []; cache = new Map();
  const addEntry = (k, v) => {
    if (!k || !v) return;
    if (k.includes('{}')) {
      const parts = k.split('{}'), lit = parts.join('');
      if (!lit.replace(/\s/g, '').length) { dict.set(k, v); return; }
      const pat = ['^', parts.map(esc).join('([\\s\\S]*?)'), '$'].join('');
      tpls.push({ re: new RegExp(pat), v, n: parts.length - 1, w: lit.length, e: k.startsWith('[E] '), h: HG.test(lit) });
    } else dict.set(k, v);
  };
  for (const [k, v] of Object.entries(obj)) {
    if (!v) continue;
    addEntry(k, v);
    const kt = k.trim(), vt = v.trim();
    if (kt !== k) addEntry(kt, vt);
    if (/\s*·\s*/.test(kt.slice(-3))) addEntry(kt.replace(/\s*·\s*$/, '').trim(), vt.replace(/\s*·\s*$/, '').trim());
  }
  tpls.sort((a, b) => b.w - a.w);   // 글자가 많이 고정된 틀부터
}
export async function loadLang(code = lang()) {
  document.documentElement.lang = code;
  if (code === 'ko') { dict = null; tpls = []; cache = new Map(); return; }
  fetch(`voice/${code}/manifest.json`).then(r => r.ok ? r.json() : null).then(m => { vpack = m; }).catch(() => { vpack = null; });   // 신경망 음성 팩
  try { build(await (await fetch(`lang/${code}.json`, { cache: 'no-cache' })).json()); }
  catch (e) { console.warn('[i18n] 사전을 불러오지 못했다:', code, e && e.message); dict = null; }
}
// 한 문장 번역 (없으면 원문)
export function tr(s) {
  if (!dict || typeof s !== 'string' || !HG.test(s)) return s;
  const hit = cache.get(s); if (hit !== undefined) return hit;
  const r = trCore(s, 0); if (cache.size > 6000) cache.clear(); cache.set(s, r);
  if (HG.test(r) && MISS.size < 3000) MISS.add(s);   // 사전에 없는 문장 (?debug 에서 __i18n.miss 로 확인)
  return r;
}
const hgN = s => (s.match(/[가-힣]/g) || []).length;
function trCore(s, depth) {
  const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/), a = m[1], core = m[2], b = m[3];
  if (!core || !HG.test(core)) return s;
  let v = dict.get(core); if (v != null) return a + v + b;
  v = dict.get('[E] ' + core); if (v != null) return a + v.replace(/^\[E\]\s*/, '') + b;   // 클래스 promptText 의 '[E] ' 를 뗀 라벨
  let best = core;
  const take = x => { if (x !== core && hgN(x) < hgN(best)) best = x; };
  for (const t of tpls) {
    let mm = core.match(t.re), pre = '';
    if (!mm && t.e) { mm = ('[E] ' + core).match(t.re); pre = '[E] '; }
    if (!mm) continue;
    let i = 0; v = t.v.replace(/\{\}/g, () => { const x = mm[++i] ?? ''; return depth < 3 ? trCore(x, depth + 1) : x; });
    if (pre) v = v.replace(/^\[E\]\s*/, '');
    if (!t.h && v === core) continue;   // 한글 없는 틀(📍 {} 등)은 무언가 번역됐을 때만
    take(v); break;
  }
  if (depth < 4 && hgN(best)) {
    // 구분자로 이어 붙인 문장: 조각마다 번역
    for (const sep of [' · ', ' — ', '\n', ' → ', ' / ', ' | ', ': ', ' - ', ', ']) {
      if (!core.includes(sep)) continue;
      const ps = core.split(sep); take(ps.map(p => trCore(p, depth + 1)).join(sep)); if (!hgN(best)) break;
    }
    // 앞뒤 기호 · 이모지 · 숫자 묶음 (🙂 민아 · ' · 켜짐' · '(0/3)')
    const mm = core.match(/^([^\p{L}]*?)([\p{L}][\s\S]*?)([^\p{L}]*)$/u);
    if (mm && (mm[1] || mm[3])) take(mm[1] + trCore(mm[2], depth + 1) + mm[3]);
    const lm = core.match(/^([^\p{L}]+)([\p{L}][\s\S]*)$/u); if (lm) take(lm[1] + trCore(lm[2], depth + 1));   // 앞 기호만 뗀 것
    const pm = core.match(/^([\s\S]+?)(\s*\([^()]*\))$/);   // 끝의 괄호 설명
    if (pm) take(trCore(pm[1], depth + 1) + trCore(pm[2], depth + 1));
  }
  return a + best + b;
}
// ── 화면 글자 자동 번역 ──
const ATTRS = ['title', 'placeholder', 'aria-label'];
function trText(n) { const v = n.nodeValue; if (v && HG.test(v)) { const t = tr(v); if (t !== v) n.nodeValue = t; } }
function trEl(el) {
  if (el.nodeType === 3) { trText(el); return; }
  if (el.nodeType !== 1 || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
  for (const at of ATTRS) { const v = el.getAttribute(at); if (v && HG.test(v)) { const t = tr(v); if (t !== v) el.setAttribute(at, t); } }
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === 3) trText(n);
    else for (const at of ATTRS) { const v = n.getAttribute(at); if (v && HG.test(v)) { const t = tr(v); if (t !== v) n.setAttribute(at, t); } }
  }
}
let mo = null;
function startObserver() {
  if (mo) return;
  mo = new MutationObserver(list => {
    if (!dict) return;
    for (const m of list) {
      if (m.type === 'characterData') trText(m.target);
      else if (m.type === 'attributes') trEl(m.target);
      else m.addedNodes.forEach(trEl);
    }
  });
  mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
// 화면에 붙어 있는 캔버스(지도 · 미니맵 · 미터)의 글자만 번역 — 3D 텍스처용 캔버스는 문서에 붙지 않아 그대로
{
  const P = CanvasRenderingContext2D.prototype, fill = P.fillText, stroke = P.strokeText, meas = P.measureText;
  P.fillText = function (t, ...r) { return fill.call(this, dict && this.canvas && this.canvas.isConnected ? tr(String(t)) : t, ...r); };
  P.strokeText = function (t, ...r) { return stroke.call(this, dict && this.canvas && this.canvas.isConnected ? tr(String(t)) : t, ...r); };
  P.measureText = function (t) { return meas.call(this, dict && this.canvas && this.canvas.isConnected ? tr(String(t)) : t); };
}
export async function initI18n() {
  await loadLang();
  startObserver();
  if (dict) trEl(document.body);
}
export async function setLang(code) {
  if (!LANGS[code]) return;
  SET.lang = code; saveSET();
  // 이미 번역된 글자를 되돌릴 수 없으므로 언어를 바꾸면 화면을 다시 불러온다 (진행은 저장된다)
  location.reload();
}
// 음성: 번역 대사를 그 언어 브라우저 목소리로. 목소리가 없으면 null (→ 원래 한국어 더빙)
export function voiceFor(code) {
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith(code));
  return vs.find(v => /natural|online|neural|google|premium|enhanced/i.test(v.name)) || vs[0] || null;
}
export const hasVoiceFor = code => !!voiceFor(code);
window.__i18n = { get miss() { return [...MISS]; }, tr, lang, LANGS, setLang, hasVoiceFor, get size() { return dict ? dict.size + tpls.length : 0; } };

// 음성 연결 (영어 · 일본어 · 중국어):
//   1) voice/<언어>/ 의 신경망 음성 팩(Microsoft Edge 신경망 음성으로 미리 만든 파일 — tools/gen_voice_pack.py)에 그 대사가 있으면 그것을 재생
//   2) 없으면 번역된 대사를 브라우저 음성(그 언어 목소리)으로 읽는다. 그 언어 목소리도 없으면 null → 원래 한국어 더빙
import { VHOOK, emoFor } from './voice.js?v=305';
import { playVoice } from './audio.js?v=305';
// 대사 → 번역문 (쪽지처럼 제목 · 본문 조각으로 등록된 대사는 조각별로 번역해 잇는다)
export const voiceText = info => (info.parts ? info.parts.map(p => tr(p)).join('. ') : tr(info.text.replace(/<[^>]+>/g, ' '))).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
VHOOK.speak = (id, info, fx) => {
  const code = lang(); if (code === 'ko' || !dict) return null;
  const pk = vpack && vpack[id];
  if (pk && pk.src === info.text) {   // 원문이 바뀐 대사는 팩을 쓰지 않는다 (다시 만들 때까지 브라우저 음성)
    const e = emoFor(id);
    return playVoice(`voice/${code}/${id}.mp3`, fx, { ...e, rate: 1, pitch: 1, trem: 0, airy: 0, dry: true }).then(r => r ? r.duration : pk.dur);
  }
  const v = voiceFor(code); if (!v) return null;
  const text = voiceText(info).replace(/…+/g, ', ');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = SPEECH_LANG[code];
  const g = info.spk; u.pitch = g === 'ghost' ? .7 : ['jihun', 'narrator', 'teacher', 'pa', 'guard'].includes(g) ? .85 : 1.05; u.rate = g === 'ghost' ? .75 : .95;
  speechSynthesis.speak(u);
  const per = code === 'en' ? .065 : .14;   // 글자 수로 길이 추정
  return Math.max(1.2, text.length * per / u.rate);
};
VHOOK.file = (id, info) => { const code = lang(); if (code === 'ko' || !dict) return undefined; const pk = vpack && vpack[id]; return pk && pk.src === info.text ? `voice/${code}/${id}.mp3` : null; };
window.__i18n.voiceText = voiceText;
