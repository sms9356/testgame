// 게임 설정 (그래픽 · 조작 · 자막 · 접근성) — localStorage 에 저장된다. 볼륨은 audio.js, 음성·자막 모드는 voice.js 가 따로 저장한다.
export const DEF = {
  quality: 'auto', scale: 1, bright: 1, fov: 72, bloom: true, grain: true, bob: true, shake: true, showFps: false,
  sens: 1, invertY: false, runToggle: false, hints: true,
  subBg: .45, subNames: true,
  diff: 'normal', jump: 'full', flashReduce: false, fearFx: true,
};
export const SET = { ...DEF };
try { Object.assign(SET, JSON.parse(localStorage.getItem('haegyo_set') || '{}')); } catch (e) { /* ignore */ }
try { const q = localStorage.getItem('haegyo_q'); if (q && !localStorage.getItem('haegyo_set')) SET.quality = q; } catch (e) { /* ignore */ }
export function saveSET() { try { localStorage.setItem('haegyo_set', JSON.stringify(SET)); } catch (e) { /* ignore */ } }
export function resetSET() { Object.assign(SET, DEF); saveSET(); }
// 난이도: 유령 속도 · 피해량 · 배터리 소모
export const DIFF = {
  easy: { label: '쉬움', speed: .85, dmg: 34, battery: .7, hear: .8 },
  normal: { label: '보통', speed: 1, dmg: 50, battery: 1, hear: 1 },
  hard: { label: '어려움', speed: 1.12, dmg: 100, battery: 1.25, hear: 1.25 },
};
