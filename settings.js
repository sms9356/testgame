// 게임 설정 (그래픽 · 조작 · 자막 · 접근성) — localStorage 에 저장된다. 볼륨은 audio.js, 음성·자막 모드는 voice.js 가 따로 저장한다.
export const DEF = {
  quality: 'auto', scale: 1, bright: 1, fov: 72, bloom: true, grain: false, bgm: true, bgmVol: .3, objArrow: true, bob: true, shake: true, showFps: false, showPlay: true,
  sens: 1, invertY: false, runToggle: false, hints: true, view: 1, camDist: 2.4,
  subBg: .45, subNames: true,
  diff: 'normal', jump: 'full', flashReduce: false, fearFx: true, captions: true, tips: true, areaPhotos: false, contrast: false, ui: 1,
  keys: { interact: 'KeyE', flash: 'KeyF', inv: 'Tab', map: 'KeyM', phone: 'KeyP', throwCan: 'KeyG', view: 'KeyV', run: 'ShiftLeft', down: 'KeyQ', crouch: 'KeyC', jump: 'Space', scan: 'KeyH' },
};
export const SET = { ...DEF, keys: { ...DEF.keys } };
try { const s = JSON.parse(localStorage.getItem('haegyo_set') || '{}'); Object.assign(SET, s, { keys: { ...DEF.keys, ...(s.keys || {}) } }); } catch (e) { /* ignore */ }
// 화면 노이즈 수정(v2): 예전 설정에 켜져 있던 필름 그레인을 한 번 끈다
if (SET.fxv !== 2) { SET.grain = false; SET.fxv = 2; }
try { const q = localStorage.getItem('haegyo_q'); if (q && !localStorage.getItem('haegyo_set')) SET.quality = q; } catch (e) { /* ignore */ }
export function saveSET() { try { localStorage.setItem('haegyo_set', JSON.stringify(SET)); } catch (e) { /* ignore */ } }
export function resetSET() { Object.assign(SET, DEF, { keys: { ...DEF.keys } }); saveSET(); }
// 키 이름 표시용
export const keyLabel = c => c.replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'Shift').replace('ShiftRight', 'R-Shift').replace('ControlLeft', 'Ctrl').replace('Space', 'Space');
// 난이도: 유령 속도 · 피해량 · 배터리 소모
export const DIFF = {
  easy: { label: '쉬움', speed: .8, dmg: 25, battery: .6, hear: .65, away: 130, visit: 35, chaseMax: 8, first: 180 },
  normal: { label: '보통', speed: .92, dmg: 34, battery: .85, hear: .85, away: 90, visit: 50, chaseMax: 12, first: 120 },
  hard: { label: '어려움', speed: 1.1, dmg: 100, battery: 1.2, hear: 1.2, away: 40, visit: 100, chaseMax: 22, first: 45 },
};
