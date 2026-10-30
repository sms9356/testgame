// 더빙 · 자막: voice/manifest.json 의 사전 생성 음성(내장) + 캐릭터별 성도 포먼트/피치 변조 및 브라우저 신경망 음성 합성(Web Speech) 하이브리드 엔진
import { playVoice, stopVoice, loadVoice, isVoicePlaying } from './audio.js?v=295';

const SPEAKER = {
  seoyeon: '🎙 김서연 (방송부 2학년)',
  jihun: '🎙 박지훈 (서현고 2학년)',
  narrator: '📖 내레이션',
  reporter: '📰 서문일보 사회부 한진우 기자',
  principal: '📼 제9대 교장 · 한석규',
  witness_principal: '📼 제9대 교장 · 한석규',
  nurse: '📼 보건교사 · 임소연 선생님',
  witness_nurse: '📼 보건교사 · 임소연 선생님',
  homeroom: '📼 3-2 담임 · 정은수 선생님',
  scienceTeacher: '📼 과학부장 · 최동혁 선생님',
  witness_science: '📼 과학부장 · 최동혁 선생님',
  peTeacher: '📼 체육부장 · 강태식 선생님',
  headTeacher: '📼 교무부장 · 권오현',
  teacher: '📼 교무부장 · 권오현',
  librarian: '📼 도서실 사서 · 송지혜 선생님',
  counselor: '📼 상담교사 · 오유진 선생님',
  witness_counselor: '📼 상담교사 · 오유진 선생님',
  mina: '📱 선배 박민아 (방송부 3학년)',
  haneul: '📼 윤하늘 (1998년 3-2 방송부 · 리허설 녹음)',
  pa: '📢 서문고 교내 방송',
  ghost: '📢 출처 불명의 방송',
  guard: '🔦 당직 경비원 · 박종철 아저씨',
  friend: '📼 단짝 친구 · 이수아',
  friend2: '📼 단짝 친구 · 서다은',
  junho: '📼 전 방송부 3학년 · 이준호',
  snackLady: '📼 매점 아주머니',
  mother: '📼 윤하늘 어머니',
  paramedic: '📻 서문소방서 구급대',
  vicePrincipal: '📼 교감 · 노태수',
  dormMother: '📼 청운학사 사감 · 문정희',
  classRep: '📼 반장 증언 (1998.10.13 학급 조사)',
  electrician: '📼 전기 기사 · 배만수',
  cook: '📼 급식실 조리실장 · 하정숙',
  musicTeacher: '📼 음악교사 · 윤서경',
  artTeacher: '📼 미술교사 · 박정우',
  janitor: '📼 환경미화원 · 김순례',
  mom: '🏠 엄마',
  dispatcher: '🚑 119 종합상황실',
};

// 브라우저 음성: 화자별 성별 ('f': 여성 / 'm': 남성)
const GENDER = {
  seoyeon: 'f', mina: 'f', haneul: 'f', ghost: 'f', friend: 'f', friend2: 'f',
  nurse: 'f', witness_nurse: 'f', homeroom: 'f', librarian: 'f', counselor: 'f', witness_counselor: 'f',
  jihun: 'm', narrator: 'm', reporter: 'm', principal: 'm', witness_principal: 'm',
  scienceTeacher: 'm', witness_science: 'm', peTeacher: 'm', headTeacher: 'm', teacher: 'm', pa: 'm', guard: 'm',
  junho: 'm', paramedic: 'm', vicePrincipal: 'm', electrician: 'm', snackLady: 'f', mother: 'f', dormMother: 'f', classRep: 'f', cook: 'f', musicTeacher: 'f', janitor: 'f', artTeacher: 'm', mom: 'f', dispatcher: 'f',
};

// 나이 · 성별 · 역할에 맞춘 정밀 음높이
const PITCH = {
  seoyeon: 1.08, mina: 1.11, haneul: 1.15, ghost: .72,
  nurse: 1.04, witness_nurse: 1.04, homeroom: .97, librarian: 1.01, counselor: 1.05, witness_counselor: 1.05,
  friend: 1.10, friend2: 1.05,
  jihun: .95, narrator: .92, reporter: .99,
  scienceTeacher: .91, witness_science: .91,
  headTeacher: .85, teacher: .85,
  peTeacher: .80,
  principal: .76, witness_principal: .76,
  guard: .75, pa: .96,
};

// 캐릭터별 고유 성도 포먼트(Formant EQ) & 피치(detune) & 발화 속도(voiceRate) 튜닝 프로필
const VOICE_TIMBRE = {
  seoyeon:           { detune: 35,   voiceRate: 1.01, formantHz: 2600, formantType: 'peaking',  formantGain: 3.2 },
  jihun:             { detune: -35,  voiceRate: 0.98, formantHz: 420,  formantType: 'peaking',  formantGain: 2.8 },
  reporter:          { detune: 75,   voiceRate: 1.07, formantHz: 2450, formantType: 'peaking',  formantGain: 5.5 }, // 아나운서/뉴스기자 특유의 명료하고 속도감 있는 보도 톤
  principal:         { detune: -165, voiceRate: 0.90, formantHz: 210,  formantType: 'lowshelf', formantGain: 5.2 }, // 60대 노교장의 중후하고 떨리는 저음
  witness_principal: { detune: -165, voiceRate: 0.90, formantHz: 210,  formantType: 'lowshelf', formantGain: 5.2 },
  nurse:             { detune: 45,   voiceRate: 0.94, formantHz: 1850, formantType: 'peaking',  formantGain: 3.5 }, // 30대 여성 보건교사의 차분하고 애절한 음색
  witness_nurse:     { detune: 45,   voiceRate: 0.94, formantHz: 1850, formantType: 'peaking',  formantGain: 3.5 },
  homeroom:          { detune: 95,   voiceRate: 0.93, formantHz: 1550, formantType: 'peaking',  formantGain: 4.5 }, // 3-2 담임 정은수 선생님의 호소력 짙고 단호한 목소리
  scienceTeacher:    { detune: 40,   voiceRate: 0.98, formantHz: 1950, formantType: 'peaking',  formantGain: 3.8 }, // 40대 과학선생님의 지적인 딕션
  witness_science:   { detune: 40,   voiceRate: 0.98, formantHz: 1950, formantType: 'peaking',  formantGain: 3.8 },
  peTeacher:         { detune: -220, voiceRate: 0.91, formantHz: 175,  formantType: 'lowshelf', formantGain: 6.5 }, // 40대 체육선생님의 굵직하고 울림 큰 바리톤
  headTeacher:       { detune: -75,  voiceRate: 0.95, formantHz: 980,  formantType: 'peaking',  formantGain: 4.0 }, // 50대 교무부장의 날카롭고 강압적인 중저음
  teacher:           { detune: -75,  voiceRate: 0.95, formantHz: 980,  formantType: 'peaking',  formantGain: 4.0 },
  librarian:         { detune: -85,  voiceRate: 0.91, formantHz: 1350, formantType: 'peaking',  formantGain: 3.2 }, // 40대 여성 사서 선생님의 조용하고 떨리는 속삭임
  counselor:         { detune: 60,   voiceRate: 0.95, formantHz: 2100, formantType: 'peaking',  formantGain: 3.0 }, // 30대 여성 상담선생님의 온화한 톤
  witness_counselor: { detune: 60,   voiceRate: 0.95, formantHz: 2100, formantType: 'peaking',  formantGain: 3.0 },
  guard:             { detune: -90,  voiceRate: 0.93, formantHz: 310,  formantType: 'lowshelf', formantGain: 4.0 }, // 60대 충청도 경비 아저씨
};

// 화자별로 다른 자연스러운 음성을 고른다
const VOICE_PREF = {
  seoyeon: /sunhi|heami/i, mina: /jimin|yujin|sunhi/i, haneul: /seohyeon|soonbok|sunhi/i,
  nurse: /sunhi|yujin/i, witness_nurse: /sunhi|yujin/i, homeroom: /jimin|sunhi/i, librarian: /seohyeon|sunhi/i, counselor: /yujin|sunhi/i, witness_counselor: /yujin|sunhi/i,
  friend: /yujin|jimin/i, friend2: /jimin|seohyeon/i, ghost: /seohyeon|sunhi/i,
  jihun: /injoon|hyunsu/i, reporter: /hyunsu|injoon|gookmin/i, narrator: /gookmin|bongjin|hyunsu/i,
  principal: /bongjin|gookmin/i, witness_principal: /bongjin|gookmin/i,
  scienceTeacher: /hyunsu|injoon/i, witness_science: /hyunsu|injoon/i,
  peTeacher: /gookmin|bongjin/i, headTeacher: /bongjin|gookmin/i, teacher: /bongjin|gookmin/i,
  guard: /gookmin|bongjin/i, pa: /hyunsu|injoon/i,
};

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
const VO_EMO = {
  tape5: 'sad', phone1: 'fear', phone2: 'fear', phone3: 'whisper', tape2: 'fear',
  gh1: 'whisper', gh2: 'whisper', gh3: 'whisper', gh4: 'whisper', ghThanks: 'relief',
  echo1: 'normal', echo2: 'normal', guard1: 'sad', guardHi: 'resolve', guardMina: 'normal', guardPast: 'sad', guardGift: 'resolve', guardBye: 'fear',
  teacher2: 'sad', endBad: 'sad', intro3: 'fear', tape4: 'normal',
  newspaper_reporter: 'resolve', tape_homeroom: 'sad', tape_science: 'resolve', tape_pe: 'fear', tape_librarian: 'whisper', tape_counselor: 'sad',
};
export function emoFor(id) {
  const m = /^l_(.+)_[js]$/.exec(id);
  const base = EMO[(m ? LINE_EMO[m[1]] : VO_EMO[id]) || 'normal'] || EMO.normal;
  const info = manifest[id];
  const timbre = info && VOICE_TIMBRE[info.spk];
  return timbre ? { ...base, ...timbre } : base;
}

let manifest = {};
export const VS = { dub: true, engine: 'auto', subs: true, readNotes: true, subSize: 1 };
try {
  const o = JSON.parse(localStorage.getItem('haegyo_voice') || '{}');
  if (o.mode) { if (o.mode === 'off') o.dub = false; else o.engine = o.mode === 'browser' ? 'browser' : 'auto'; delete o.mode; }
  Object.assign(VS, o);
} catch (e) { /* ignore */ }
export function saveVS() { try { localStorage.setItem('haegyo_voice', JSON.stringify(VS)); } catch (e) { /* ignore */ } applySubSize(); }
function applySubSize() { if (typeof document !== 'undefined') document.documentElement.style.setProperty('--subScale', VS.subSize); }
applySubSize();

let manifestPromise = null;
export async function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch('voice/manifest.json?v=295').then(r => r.json()).then(m => {
      manifest = { ...manifest, ...m };
      for (const [k, val] of Object.entries(manifest)) {
        if (val && val.audioFile && m[val.audioFile]) {
          const src = m[val.audioFile];
          val.dur = src.dur;
          val.generation = src.generation;
          val.baked = true;
          val.nofile = false;
        }
      }
      return manifest;
    }).catch(() => manifest);
  }
  return manifestPromise;
}
export const lineInfo = id => manifest[id];
export const allLines = () => manifest;
export function registerLines(map) {
  Object.entries(map).forEach(([id, v]) => {
    const cleanText = (v.text || '').replace(/<[^>]+>/g, ' ');
    if (v.audioId && manifest[v.audioId]) {
      manifest[id] = {
        ...manifest[v.audioId],
        spk: v.spk || manifest[v.audioId].spk,
        text: cleanText || manifest[v.audioId].text,
        rawHtml: v.text || cleanText,
        stage: v.stage || '',
        audioFile: v.audioId,
        nofile: false,
        baked: true,
      };
    } else if (v.recast && manifest[id]) {
      // 메인 퀘스트 개편으로 대본이 새로 작성된 대사는 새 대본과 새 화자를 우선 적용!
      manifest[id] = {
        ...manifest[id],
        spk: v.spk || manifest[id].spk,
        text: cleanText,
        rawHtml: v.text || cleanText,
        stage: v.stage || '',
        audioFile: v.audioId || id,
      };
    } else if (!manifest[id] || manifest[id].nofile) {
      manifest[id] = {
        spk: v.spk,
        text: cleanText,
        rawHtml: v.text || cleanText,
        stage: v.stage || '',
        dur: Math.max(2.2, cleanText.length * .115),
        nofile: !v.audioId,
        baked: !!v.audioId,
        audioFile: v.audioId || null,
        ...(manifest[id] && !manifest[id].nofile ? manifest[id] : {}),
      };
    } else if (manifest[id]) {
      // 기존 manifest 항목도 최신 대본·화자·무대지문을 동기화
      manifest[id].text = cleanText || manifest[id].text;
      manifest[id].rawHtml = v.text || manifest[id].text;
      if (v.spk) manifest[id].spk = v.spk;
      if (v.stage) manifest[id].stage = v.stage;
    }
    if (v.parts) manifest[id].parts = v.parts;
  });
}
export function preload(ids) {
  if (!VS.dub || useBrowser()) return;
  ids.forEach(id => { const i = manifest[id]; if (!i) return; const u = VHOOK.file && VHOOK.file(id, i); if (u !== undefined) { if (u) loadVoice(u); return; } const f = i.audioFile || id; if (!i.nofile) loadVoice(`voice/${f}.mp3`); });
}

let voices = [];
const NATURAL = /natural|online|neural|google|premium|enhanced/i;
const MALE = /injoon|hyunsu|bongjin|gookmin|junho|minsu|male|남성|남자/i;
function pickBrowserVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  voices = speechSynthesis.getVoices().filter(v => /^ko/i.test(v.lang));
  return voices;
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) { pickBrowserVoices(); speechSynthesis.onvoiceschanged = pickBrowserVoices; }
export const hasBrowserVoice = () => (voices.length || pickBrowserVoices().length) > 0;
export const hasNaturalVoice = () => hasBrowserVoice() && voices.some(v => NATURAL.test(v.name));
export const browserVoiceName = () => { const v = voiceFor('f'); return v ? v.name : ''; };
function voiceFor(g, spk) {
  const nat = voices.filter(v => NATURAL.test(v.name)), pool = nat.length ? nat : voices;
  const pref = spk && VOICE_PREF[spk] && pool.find(v => VOICE_PREF[spk].test(v.name)); if (pref) return pref;
  const male = pool.filter(v => MALE.test(v.name)), female = pool.filter(v => !MALE.test(v.name));
  return (g === 'm' ? (male[0] || female[0]) : (female[0] || male[0])) || null;
}
const bakedSet = () => Object.values(manifest).some(m => m.baked);
const useBrowser = id => {
  if (VS.engine === 'browser') return hasBrowserVoice();
  if (VS.engine === 'auto') {
    if (id && manifest[id] && (!manifest[id].nofile || manifest[id].audioFile)) return false;
    return hasNaturalVoice() && !bakedSet();
  }
  return false;
};
export const engineLabel = () => (!VS.dub ? '끔' : useBrowser() ? `브라우저 음성 (${browserVoiceName()})` : '내장 성우 더빙');

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const VHOOK = { speak: null, file: null };
let speechRequest = 0, playbackDone = null;
let protectedUntil = 0, storyTail = Promise.resolve(), storyEpoch = 0;
let storyPending = 0;
const pendingLines = new Map();
export const isSpeechBusy = () => storyPending > 0 || isVoicePlaying() || !!(typeof window !== 'undefined' && window.speechSynthesis?.speaking);

// 더빙 순번: 앞 목소리가 끝날 때까지 기다렸다가 재생한다 (예전엔 새 대사가 앞 대사를 그 자리에서 끊었다)
//   이야기 대사는 최대 15초 기다린다 · 혼잣말 같은 짧은 대사는 2.5초 안에 차례가 안 오면 소리만 건너뛴다 (자막은 그대로)
let gate = Promise.resolve(), gateEpoch = 0;
export async function speak(id, fx = 'none', story = false) {
  if (!story && (storyPending || performance.now() < protectedUntil)) return 0;
  const myEpoch = gateEpoch, prev = gate; let release; gate = new Promise(r => { release = r; });
  const late = await Promise.race([prev.then(() => false), new Promise(r => setTimeout(() => r(true), story ? 15000 : 2500))]);
  if (myEpoch !== gateEpoch) { release(); return 0; }
  if (late && !story) { prev.then(release); return 0; }
  let sec = 0;
  try { sec = await speakNow(id, fx); } catch (e) { release(); throw e; }
  if (!VS.dub) { release(); return sec; }
  const done = playbackDone, cap = new Promise(r => setTimeout(r, (sec || 0) * 1000 + 1200));
  (done ? Promise.race([done, cap]) : new Promise(r => setTimeout(r, (sec || 0) * 1000))).then(release);
  return sec;
}
async function speakNow(id, fx) {
  ++speechRequest; playbackDone = null;
  const info = manifest[id];
  const est = info ? info.dur : 2.5;
  if (!VS.dub || !info) return est;
  if (VHOOK.speak) { const r = VHOOK.speak(id, info, fx); if (r != null) return r; }
  if (useBrowser(id) || (info.nofile && !info.audioFile && hasBrowserVoice())) {
    stopVoice();
    speechSynthesis.cancel();
    const text = info.text.replace(/<[^>]+>/g, ' ').replace(/…/g, '… ').replace(/—/g, ', ');
    const u = new SpeechSynthesisUtterance(text), g = GENDER[info.spk] || 'f', v = voiceFor(g, info.spk);
    if (v) u.voice = v;
    u.lang = 'ko-KR';
    const e = emoFor(id);
    u.pitch = Math.min(1.8, Math.max(0.55, (g === 'm' && v && !MALE.test(v.name) ? .74 : 1) * (PITCH[info.spk] ?? 1) * e.pitch));
    const spkRate = info.spk === 'ghost' ? .76 : info.spk === 'reporter' ? 1.06 : info.spk === 'narrator' ? .93 : (['guard', 'principal', 'witness_principal', 'headTeacher', 'teacher'].includes(info.spk)) ? .88 : (info.spk === 'jihun' ? .96 : .99);
    u.rate = clamp(spkRate * e.rate, 0.72, 1.25);
    u.volume = clamp(e.vol ?? 1, 0.2, 1);
    playbackDone = new Promise(resolve => { u.addEventListener('end', resolve, {once:true}); u.addEventListener('error', resolve, {once:true}); });
    speechSynthesis.speak(u);
    return Math.max(1.6, text.length * .11 / u.rate + (text.match(/[,.?!…]/g) || []).length * .16);
  }
  if (info.nofile && !info.audioFile) return est;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) speechSynthesis.cancel();
  const fileId = info.audioFile || id;
  const e = emoFor(id);
  const playOpts = info.baked
    ? { gain: info.generation ? 1 : (e.gain || 1), rate: 1, pitch: 1, detune: 0, formantHz: 0, trem: 0, airy: false, dry: true }
    : e;
  const r = await playVoice(`voice/${fileId}.mp3`, fx, playOpts);
  playbackDone = r?.finished || null;
  return r ? r.duration : est;
}

export function stopSpeak() {
  clearTimeout(subTimer);
  if (typeof document !== 'undefined') document.getElementById('sub')?.classList.remove('show');
  ++storyEpoch; pendingLines.clear(); storyPending = 0; storyTail = Promise.resolve(); protectedUntil = 0; ++speechRequest; ++gateEpoch; gate = Promise.resolve();
  stopVoice();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) speechSynthesis.cancel();
}

export const SUBLOG = [];
export function logLine(who, text) {
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || (SUBLOG.length && SUBLOG[SUBLOG.length - 1].text === t)) return;
  SUBLOG.push({ who: who || '', text: t, at: Date.now() });
  if (SUBLOG.length > 80) SUBLOG.shift();
}

// 화자별 생동감 있는 컬러 테마
const SPK_COLOR = {
  seoyeon: '#ff94a8',
  jihun: '#7cc0ff',
  reporter: '#5cd6ff',
  principal: '#e8b860',
  witness_principal: '#e8b860',
  nurse: '#88e2c2',
  witness_nurse: '#88e2c2',
  homeroom: '#f4b8e0',
  scienceTeacher: '#78d8f0',
  witness_science: '#78d8f0',
  peTeacher: '#ffaa68',
  headTeacher: '#ff7868',
  teacher: '#ff7868',
  librarian: '#c8b4f8',
  counselor: '#a8e4a0',
  witness_counselor: '#a8e4a0',
  guard: '#d8c488',
  mina: '#ffb878',
  haneul: '#d8e8ff',
  ghost: '#ff5252',
};

let subTimer = 0;
export function subtitle(who, text, sec, spkKey = null, stageDir = '') {
  logLine(who, text);
  if (typeof document === 'undefined') return;
  const el = document.getElementById('sub'); if (!el) return;
  if (!VS.subs) { el.classList.remove('show'); return; }
  const col = (spkKey && SPK_COLOR[spkKey]) || '#ffd888';
  const wave = '<i style="display:inline-flex;align-items:flex-end;gap:2px;height:11px;margin-right:6px;vertical-align:middle;"><s style="width:2.5px;height:10px;background:' + col + ';display:inline-block;border-radius:1px;"></s><s style="width:2.5px;height:6px;background:' + col + ';display:inline-block;border-radius:1px;"></s><s style="width:2.5px;height:11px;background:' + col + ';display:inline-block;border-radius:1px;"></s></i>';
  const stageHtml = stageDir ? `<em style="display:block;font-size:0.82em;color:#b8b09c;font-style:italic;margin-bottom:2px;">${stageDir}</em>` : '';
  el.innerHTML = (who ? `<b style="color:${col};text-shadow:0 1px 6px rgba(0,0,0,0.85);">${wave}${who}</b>` : '') + `<span>${stageHtml}${text}</span>`;
  el.classList.add('show');
  clearTimeout(subTimer);
  subTimer = setTimeout(() => el.classList.remove('show'), sec * 1000);
}

export function line(id, fx, whoOverride) {
  if (!manifest[id] && manifestPromise) return manifestPromise.then(() => line(id, fx, whoOverride));
  const info = manifest[id]; if (!info) return Promise.resolve(0);
  if (pendingLines.has(id)) return pendingLines.get(id);
  if (info.spk === 'ghost' && storyPending) return Promise.resolve(0);
  const epoch = storyEpoch;
  ++storyPending;
  let completion = Promise.resolve();
  const job = storyTail.then(async () => {
    if (epoch !== storyEpoch) return 0;
    const sec = await speak(id, fx, true);   // 순번을 기다린 뒤 재생 (그 사이 stopSpeak 가 오면 epoch 가 바뀐다)
    if (epoch !== storyEpoch) return 0;
    const timeout = new Promise(resolve => setTimeout(resolve, (playbackDone ? sec * 2 + 5 : sec) * 1000));
    completion = playbackDone ? Promise.race([playbackDone, timeout]) : timeout;
    protectedUntil = performance.now() + sec * 1000;
    subtitle(whoOverride ?? SPEAKER[info.spk], info.rawHtml || info.text, sec + .6, info.spk, info.stage || '');
    return sec;
  });
  storyTail = job.then(() => completion).catch(() => {});
  pendingLines.set(id, job);
  storyTail.finally(() => { if (epoch === storyEpoch) { pendingLines.delete(id); storyPending = Math.max(0, storyPending - 1); } });
  return job;
}
