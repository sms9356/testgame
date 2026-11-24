// 게임 설정 (그래픽 · 조작 · 자막 · 접근성) — localStorage 에 저장된다. 볼륨은 audio.js, 음성·자막 모드는 voice.js 가 따로 저장한다.
export const DEF = {
  quality: 'auto', scale: 1, bright: 1, fov: 72, bloom: true, grain: false, bgm: true, bgmVol: .3, objArrow: true, objMode: 'full', bob: true, bobK: 1, shake: true, showFps: false, showPlay: true,
  sens: 1, invertY: false, runToggle: false, hints: true, view: 1, camDist: 2.4,
  subBg: .45, subNames: true,
  crouchToggle: true, idleHint: true, idleHintSec: 240, cbSafe: false,   // 편의: 앉기 방식 · 목표 다시 알림 · 색각 보조 강조
  diff: 'normal', jump: 'soft', flashReduce: false, fearFx: true, captions: true, tips: true, areaPhotos: false, contrast: false, motionBlur: false, classicBars: false, minimap: true, paperMap: false, ui: 1, mic: false, lang: 'ko',
  hintFreq: 'normal',   // 힌트 빈도: low(적게) · normal(보통) · high(많이) — 민아 · 무전 · 단서 보드 공용 (minaDirector.js)
  minaAI: false, minaAIUrl: '',   // 민아와 자유 대화 (AI) — 기본 꺼짐 · 서버 주소가 비면 기능 숨김 (minaChat.js)
  keys: { interact: 'KeyE', flash: 'KeyF', inv: 'Tab', map: 'KeyM', phone: 'KeyP', throwCan: 'KeyG', view: 'KeyV', run: 'ShiftLeft', down: 'KeyQ', crouch: 'KeyC', jump: 'Space', scan: 'KeyH', camera: 'KeyX', quest: 'KeyO', quickSave: 'F5', quickLoad: 'F9', radio: 'KeyB' },
};
export const SET = { ...DEF, keys: { ...DEF.keys } };
// 저장된 설정 문자열 → 기본값과 합친 설정 (손상 · 이상값은 기본값으로). node 테스트에서 직접 검증한다.
export function parseSET(raw) {
  let s = {}; try { s = JSON.parse(raw || '{}'); } catch (e) { s = {}; }
  if (!s || typeof s !== 'object' || Array.isArray(s)) s = {};
  const out = { ...DEF, ...s, keys: migrateKeys(s.keys) };
  for (const k of ['crouchToggle', 'idleHint', 'cbSafe']) if (typeof out[k] !== 'boolean') out[k] = DEF[k];
  if (!Number.isFinite(out.idleHintSec)) out.idleHintSec = DEF.idleHintSec;
  if (!['low', 'normal', 'high'].includes(out.hintFreq)) out.hintFreq = DEF.hintFreq;
  out.idleHintSec = Math.min(600, Math.max(60, out.idleHintSec));
  return out;
}
// 키 설정 이전: 저장된 키 + 새로 생긴 동작(예: quickSave F5 · quickLoad F9)의 기본 키.
// 새 동작의 기본 키를 플레이어가 이미 다른 동작에 쓰고 있으면 새 동작은 비워 둔다('' = 미지정 · 키 설정에서 지정) — 한 키가 두 동작을 하지 않게.
// 문자열이 아닌 값은 기본값으로. 더는 없는 동작(제거된 기능)의 키는 버린다.
export function migrateKeys(stored) {
  const s = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  const out = {}, used = new Set();
  for (const a of Object.keys(DEF.keys)) if (typeof s[a] === 'string') { out[a] = s[a]; if (s[a]) used.add(s[a]); }
  for (const a of Object.keys(DEF.keys)) if (!(a in out)) { const d = DEF.keys[a]; out[a] = used.has(d) ? '' : d; if (out[a]) used.add(d); }
  return out;
}
// 예전 설정값 → 현재 (한 번만 적용되는 값 변경). node 테스트에서 직접 검증한다.
export function migrateSET(S) {
  // Psychological horror replaces legacy full-screen shock settings.
  S.jump = 'soft';
  // 목표 바 키 J → O (J 는 사건 기록 도감)
  if (S.keys.quest === 'KeyJ' && !Object.values(S.keys).includes('KeyO')) S.keys.quest = 'KeyO';
  // 화면 노이즈 수정(v2): 예전 설정에 켜져 있던 필름 그레인을 한 번 끈다
  if (S.fxv !== 2) { S.grain = false; S.fxv = 2; }
  return S;
}
try { Object.assign(SET, parseSET(localStorage.getItem('haegyo_set'))); } catch (e) { /* ignore */ }
migrateSET(SET);
try { const q = localStorage.getItem('haegyo_q'); if (q && !localStorage.getItem('haegyo_set')) SET.quality = q; } catch (e) { /* ignore */ }
export function saveSET() { try { localStorage.setItem('haegyo_set', JSON.stringify(SET)); } catch (e) { /* ignore */ } }
export function resetSET() { Object.assign(SET, DEF, { keys: { ...DEF.keys } }); saveSET(); }
// 키 이름 표시용
export const keyLabel = c => !c ? '—' : String(c).replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('ShiftRight', 'R-Shift').replace('ControlLeft', 'Ctrl').replace('Space', 'Space');
// 난이도: 유령 속도 · 피해량 · 배터리 소모
export const DIFF = {
  easy: { label: '쉬움', speed: .8, dmg: 25, battery: .6, hear: .65, away: 130, visit: 35, chaseMax: 8, first: 180 },
  normal: { label: '보통', speed: .92, dmg: 34, battery: .85, hear: .85, away: 90, visit: 50, chaseMax: 12, first: 120 },
  hard: { label: '어려움', speed: 1.1, dmg: 100, battery: 1.2, hear: 1.2, away: 40, visit: 100, chaseMax: 22, first: 45 },
};
