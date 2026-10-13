// 더빙 · 자막: voice/manifest.json 의 사전 생성 음성(내장) 또는 브라우저 음성 합성(Web Speech)으로 대사를 읽는다.
import { playVoice, stopVoice, loadVoice } from './audio.js';

const SPEAKER = { seoyeon: '서연', narrator: '', friend: '???', teacher: '선생님', pa: '교내 방송', ghost: '???' };
const BROWSER_PITCH = { seoyeon: 1.15, narrator: .8, friend: 1.3, teacher: .7, pa: .9, ghost: .5 };
let manifest = {}, byText = new Map();
export const VS = { mode: 'file', subs: true, readNotes: true, subSize: 1 };
try { Object.assign(VS, JSON.parse(localStorage.getItem('haegyo_voice') || '{}')); } catch (e) { /* ignore */ }
export function saveVS() { try { localStorage.setItem('haegyo_voice', JSON.stringify(VS)); } catch (e) { /* ignore */ } applySubSize(); }
function applySubSize() { document.documentElement.style.setProperty('--subScale', VS.subSize); }
applySubSize();

export async function loadManifest() {
  try { manifest = await (await fetch('voice/manifest.json')).json(); } catch (e) { manifest = {}; }
  byText = new Map(Object.entries(manifest).filter(([k]) => k.startsWith('t_')).map(([k, v]) => [v.text, k]));
}
export const voiceIdFor = text => byText.get(text);
export const lineInfo = id => manifest[id];
export function preload(ids) {
  if (VS.mode !== 'file') return;
  if (ids.includes('talk*')) ids = ids.concat(Object.keys(manifest).filter(k => k.startsWith('t_')));
  ids.forEach(id => manifest[id] && loadVoice(`voice/${id}.mp3`));
}

let koVoice = null;
function pickBrowserVoice() {
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices().filter(v => /^ko/i.test(v.lang));
  koVoice = vs.find(v => /natural|online|neural/i.test(v.name)) || vs[0] || null; return koVoice;
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = pickBrowserVoice;
export const hasBrowserVoice = () => !!(koVoice || pickBrowserVoice());

// 대사 한 줄 재생 → 실제 길이(초)를 돌려준다. 음성이 없으면 글자 수로 추정.
export async function speak(id, fx = 'none') {
  const info = manifest[id];
  const est = info ? info.dur : 2.5;
  if (VS.mode === 'off' || !info) return est;
  if (VS.mode === 'browser' && hasBrowserVoice()) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(info.text.replace(/<[^>]+>/g, ' '));
    u.voice = koVoice; u.lang = 'ko-KR'; u.pitch = BROWSER_PITCH[info.spk] ?? 1; u.rate = info.spk === 'ghost' ? .7 : 1;
    speechSynthesis.speak(u);
    return Math.max(est, info.text.length * .11);
  }
  const r = await playVoice(`voice/${id}.mp3`, fx);
  return r ? r.duration : est;
}
export function stopSpeak() { stopVoice(); if ('speechSynthesis' in window) speechSynthesis.cancel(); }

// 하단 자막 (서연 외 화자: 내레이션·방송·테이프·전화·유령)
let subTimer = 0;
export function subtitle(who, text, sec) {
  const el = document.getElementById('sub'); if (!el) return;
  if (!VS.subs) { el.classList.remove('show'); return; }
  el.innerHTML = (who ? `<b>${who}</b>` : '') + `<span>${text}</span>`;
  el.classList.add('show'); clearTimeout(subTimer); subTimer = setTimeout(() => el.classList.remove('show'), sec * 1000);
}
export async function line(id, fx, whoOverride) {
  const info = manifest[id]; if (!info) return 0;
  const sec = await speak(id, fx);
  subtitle(whoOverride ?? SPEAKER[info.spk], info.text, sec + .5);
  return sec;
}
