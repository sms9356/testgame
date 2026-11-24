// 본 대사 기록 (줄 단위) — '이미 본 대사 넘기기' 설정용. 세이브 슬롯과 무관하게 이 브라우저에서 한 번이라도 끝까지 나온 대사 id 를 localStorage 에 남긴다.
//   node 테스트(tests/seenLines.test.mjs)에서 저장 · 복원 · 손상값 처리를 직접 검증한다.
export const SEEN_KEY = 'haegyo_seen';
const MAX = 5000;   // 대사 수(≈2천 줄)보다 넉넉히 — 혹시 모를 무한 증가만 막는다
const seen = new Set();
let saveT = 0;
const store = () => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } };

export function parseSeen(raw) {
  let a = []; try { a = JSON.parse(raw || '[]'); } catch (e) { a = []; }
  return Array.isArray(a) ? a.filter(x => typeof x === 'string' && x && x.length < 120).slice(-MAX) : [];
}
export function loadSeen() { seen.clear(); const s = store(); if (s) try { parseSeen(s.getItem(SEEN_KEY)).forEach(id => seen.add(id)); } catch (e) { /* ignore */ } return seen.size; }
export function saveSeen() { clearTimeout(saveT); saveT = 0; const s = store(); if (!s) return; try { s.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-MAX))); } catch (e) { /* ignore */ } }
export const isSeen = id => !!id && seen.has(id);
export const seenCount = () => seen.size;
// 대사가 자막으로 나온 순간 기록 — 저장은 묶어서(연속 대사마다 localStorage 를 쓰지 않게)
export function markSeen(id, now = false) {
  if (!id || seen.has(id)) return false; seen.add(id);
  if (now || typeof setTimeout === 'undefined') saveSeen(); else if (!saveT) saveT = setTimeout(saveSeen, 1500);
  return true;
}
export function clearSeen() { seen.clear(); saveSeen(); }
loadSeen();
if (typeof addEventListener === 'function') try { addEventListener('pagehide', () => { if (saveT) saveSeen(); }); } catch (e) { /* ignore */ }
