// 더빙 · 자막: voice/manifest.json 의 사전 생성 음성(내장) 또는 브라우저 음성 합성(Web Speech)으로 대사를 읽는다.
import { playVoice, stopVoice, loadVoice } from './audio.js';

const SPEAKER = { seoyeon: '서연', jihun: '지훈', narrator: '', mina: '민아', haneul: '하늘', teacher: '선생님', pa: '교내 방송', ghost: '???', guard: '경비 아저씨', friend: '수아', friend2: '다은' };
// 브라우저 음성: 화자별 성별 · 음높이 (자연스러운 음성은 음높이를 거의 건드리지 않는다)
const GENDER = { seoyeon: 'f', mina: 'f', haneul: 'f', ghost: 'f', jihun: 'm', narrator: 'm', teacher: 'm', pa: 'm', guard: 'm', friend: 'f', friend2: 'f' };
// 나이 · 성별에 맞춘 기본 음높이 (지훈 18 남 · 서연 17 여 · 민아 18 여 · 하늘 18 여(그날에 멈춘) · 담임 40대 남 · 경비 60대 남 · 친구 둘 18 여)
const PITCH = { seoyeon: 1.06, mina: 1.08, haneul: 1.12, ghost: .7, jihun: 1, narrator: .95, teacher: .88, pa: 1, guard: .8, friend: 1.12, friend2: 1.06 };
// 화자별로 다른 자연스러운 음성을 고른다 (Edge 의 한국어 Natural 음성 이름 기준, 없으면 성별로 대체)
const VOICE_PREF = { seoyeon: /sunhi/i, mina: /jimin|yujin/i, haneul: /seohyeon|soonbok/i, friend: /yujin|jimin/i, friend2: /jimin|seohyeon/i, ghost: /seohyeon|sunhi/i,
  jihun: /injoon|hyunsu/i, narrator: /gookmin|bongjin|hyunsu/i, teacher: /bongjin|gookmin/i, guard: /gookmin|bongjin/i, pa: /hyunsu|injoon/i };
// 감정 연기: 대사마다 상황(평범 · 놀람 · 두려움 · 긴박 · 속삭임 · 결의 · 안도)에 맞춰 속도 · 음높이 · 크기 · 떨림을 바꾼다
const EMO = {
  normal: { rate: 1, pitch: 1, vol: 1 },
  surprise: { rate: 1.12, pitch: 1.1, vol: 1, gain: 1.15 },
  fear: { rate: .9, pitch: 1.04, vol: .85, gain: .9, trem: 6.5 },
  urgent: { rate: 1.22, pitch: 1.06, vol: 1, gain: 1.2 },
  whisper: { rate: .86, pitch: .97, vol: .55, gain: .6, airy: true },
  resolve: { rate: .96, pitch: .97, vol: 1, gain: 1.05 },
  relief: { rate: .92, pitch: 1, vol: .9, gain: .95 },
  sad: { rate: .85, pitch: .95, vol: .8, gain: .85, trem: 4 },
};
const LINE_EMO = {
  spotted: 'urgent', enrage: 'urgent', hit: 'urgent', lure: 'urgent', repel: 'urgent', sprint: 'fear',
  doorSlam: 'surprise', ball: 'surprise', steps: 'surprise', speakers: 'surprise', piano: 'surprise', wake: 'surprise', phone: 'surprise', pinBroken: 'surprise', breaker: 'surprise', pianoOk: 'surprise', slideOk: 'surprise',
  inside: 'fear', gym: 'fear', pool: 'fear', cafe: 'fear', b1: 'fear', stall: 'fear', roof: 'fear', arrive: 'fear', minaAsleep: 'fear', locked: 'fear', needPin: 'fear',
  hide: 'whisper', breath: 'whisper',
  gate: 'resolve', keyMade: 'resolve', keyLast: 'resolve', findMina: 'resolve', withMina: 'resolve', afterCam: 'resolve', key: 'resolve', needPower: 'resolve',
  calm: 'relief', heal: 'relief', unlocked: 'relief', safeOpen: 'relief', hookMade: 'relief',
  tagFound: 'sad', minaFound: 'urgent',
};
const VO_EMO = { tape5: 'sad', phone1: 'fear', phone2: 'fear', phone3: 'whisper', tape2: 'fear', gh1: 'whisper', gh2: 'whisper', gh3: 'whisper', gh4: 'whisper', ghThanks: 'relief', echo1: 'normal', echo2: 'normal', guard1: 'sad', teacher2: 'sad', endBad: 'sad', intro3: 'fear', tape4: 'normal' };
export function emoFor(id) { const m = /^l_(.+)_[js]$/.exec(id); return EMO[(m ? LINE_EMO[m[1]] : VO_EMO[id]) || 'normal']; }
let manifest = {};
// dub: 더빙 켜기/끄기 · engine: auto(자연스러운 브라우저 음성이 있으면 사용) | file(내장) | browser
export const VS = { dub: true, engine: 'auto', subs: true, readNotes: true, subSize: 1 };
try {
  const o = JSON.parse(localStorage.getItem('haegyo_voice') || '{}');
  if (o.mode) { if (o.mode === 'off') o.dub = false; else o.engine = o.mode === 'browser' ? 'browser' : 'auto'; delete o.mode; }   // 이전 설정 변환
  Object.assign(VS, o);
} catch (e) { /* ignore */ }
export function saveVS() { try { localStorage.setItem('haegyo_voice', JSON.stringify(VS)); } catch (e) { /* ignore */ } applySubSize(); }
function applySubSize() { document.documentElement.style.setProperty('--subScale', VS.subSize); }
applySubSize();

export async function loadManifest() {
  try { manifest = await (await fetch('voice/manifest.json')).json(); } catch (e) { manifest = {}; }
}
export const lineInfo = id => manifest[id];
// 내장 음성 파일이 없는 새 대사: 자막과 브라우저 음성으로만 재생한다 (길이는 글자 수로 추정)
export function registerLines(map) {
  Object.entries(map).forEach(([id, v]) => { if (!manifest[id]) manifest[id] = { spk: v.spk, text: v.text.replace(/<[^>]+>/g, ' '), dur: Math.max(1.6, v.text.length * .11), nofile: true }; });
}
export function preload(ids) {
  if (!VS.dub || useBrowser()) return;
  ids.forEach(id => manifest[id] && !manifest[id].nofile && loadVoice(`voice/${id}.mp3`));
}

let voices = [];
const NATURAL = /natural|online|neural|google|premium|enhanced/i;
const MALE = /injoon|hyunsu|bongjin|gookmin|junho|minsu|male|남성|남자/i;
function pickBrowserVoices() {
  if (!('speechSynthesis' in window)) return [];
  voices = speechSynthesis.getVoices().filter(v => /^ko/i.test(v.lang));
  return voices;
}
if ('speechSynthesis' in window) { pickBrowserVoices(); speechSynthesis.onvoiceschanged = pickBrowserVoices; }
export const hasBrowserVoice = () => (voices.length || pickBrowserVoices().length) > 0;
export const hasNaturalVoice = () => hasBrowserVoice() && voices.some(v => NATURAL.test(v.name));
export const browserVoiceName = () => { const v = voiceFor('f'); return v ? v.name : ''; };
function voiceFor(g, spk) {
  const nat = voices.filter(v => NATURAL.test(v.name)), pool = nat.length ? nat : voices;
  const pref = spk && VOICE_PREF[spk] && pool.find(v => VOICE_PREF[spk].test(v.name)); if (pref) return pref;
  const male = pool.filter(v => MALE.test(v.name)), female = pool.filter(v => !MALE.test(v.name));
  return (g === 'm' ? (male[0] || female[0]) : (female[0] || male[0])) || null;
}
const useBrowser = () => VS.engine === 'browser' ? hasBrowserVoice() : VS.engine === 'auto' ? hasNaturalVoice() : false;
export const engineLabel = () => (!VS.dub ? '끔' : useBrowser() ? `브라우저 음성 (${browserVoiceName()})` : '내장 더빙');

// 대사 한 줄 재생 → 실제 길이(초)를 돌려준다. 음성이 없으면 글자 수로 추정.
export async function speak(id, fx = 'none') {
  const info = manifest[id];
  const est = info ? info.dur : 2.5;
  if (!VS.dub || !info) return est;
  if (useBrowser()) {
    speechSynthesis.cancel();
    const text = info.text.replace(/<[^>]+>/g, ' ').replace(/…/g, ', ');
    const u = new SpeechSynthesisUtterance(text), g = GENDER[info.spk] || 'f', v = voiceFor(g, info.spk);
    u.voice = v; u.lang = 'ko-KR';
    // 남성 목소리가 없으면 여성 음성을 낮춰 쓴다
    const e = emoFor(id);
    u.pitch = Math.min(2, (g === 'm' && v && !MALE.test(v.name) ? .7 : 1) * (PITCH[info.spk] ?? 1) * e.pitch);
    u.rate = (info.spk === 'ghost' ? .75 : info.spk === 'narrator' ? .92 : info.spk === 'guard' || info.spk === 'teacher' ? .9 : 1) * e.rate; u.volume = e.vol;
    speechSynthesis.speak(u);
    return Math.max(1.2, text.length * .105 / u.rate + (text.match(/[,.?!]/g) || []).length * .12);
  }
  if (info.nofile) return est;
  const e = emoFor(id), r = await playVoice(`voice/${id}.mp3`, fx, info.baked ? { ...e, rate: 1, pitch: 1, trem: 0 } : e);   // baked: 감정이 이미 녹음에 들어 있다
  return r ? r.duration : est;
}
export function stopSpeak() { stopVoice(); if ('speechSynthesis' in window) speechSynthesis.cancel(); }

// 하단 자막 (주인공 외 화자: 내레이션 · 방송 · 테이프 · 전화 · 하늘)
// 대화 기록 (휴대폰 › 기록): 최근 자막 80개
export const SUBLOG = [];
export function logLine(who, text) { const t = String(text).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); if (!t || (SUBLOG.length && SUBLOG[SUBLOG.length - 1].text === t)) return; SUBLOG.push({ who: who || '', text: t, at: Date.now() }); if (SUBLOG.length > 80) SUBLOG.shift(); }
let subTimer = 0;
export function subtitle(who, text, sec) {
  logLine(who, text);
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
