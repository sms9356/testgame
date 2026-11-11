// 한가할 때 실행기 — 늦은 보정 작업(늦게 오는 모델 정리 · 재배치 · 전체 씬 순회)이 걷거나 뛰는 도중 한 프레임을 수십~수천 ms 멈추던 문제
//   · 타이머가 울려도 바로 돌리지 않고 줄에 세운다. 플레이어가 멈춰 서 있거나(화면이 정지 → 끊김이 보이지 않는다) 메뉴 · UI · 페이드 중일 때 하나씩 꺼내 돌린다.
//   · 같은 작업이 줄에 이미 있으면 겹쳐 넣지 않는다. 계속 움직이는 중이어도 maxWait 가 지나면 돌린다(굶지 않게).
//   · 한 번에 하나, 최소 180ms 간격 — 여러 보정이 같은 프레임에 몰려 길게 멎던 것도 나눈다.
const Q = []; let probe = null, timer = 0, lastRun = 0;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
// probe(): 지금 끊기면 눈에 띄는가 (움직이는 중 · 컷신 카메라 이동 중)
export function setIdleProbe(fn) { probe = fn; }
function pump() {
  timer = 0; if (!Q.length) return;
  const t = now(); let busy = false; try { busy = !!(probe && probe()); } catch (e) { busy = false; }
  let i = busy ? Q.findIndex(q => t >= q.due) : 0;
  if (i >= 0 && t - lastRun >= 180) { const q = Q.splice(i, 1)[0]; const t1 = now(); try { q.fn(); } catch (e) { console.warn('[idle task]', e); } lastRun = now(); if (lastRun - t1 > 50 && typeof window !== 'undefined') { const L = (window.__idleSlow ||= []); if (L.length < 60) L.push({ t: Math.round(t1), ms: Math.round(lastRun - t1), busy, fn: (q.fn.name || String(q.fn)).slice(0, 90) }); } }
  if (Q.length) timer = setTimeout(pump, busy ? 250 : 190);
}
export function whenIdle(fn, maxWait = 45000) {
  if (typeof fn !== 'function') return;
  if (!probe) { fn(); return; }   // 게임 밖(테스트 · 도구)에서는 바로
  if (Q.some(q => q.fn === fn)) return;
  Q.push({ fn, due: now() + maxWait }); if (!timer) timer = setTimeout(pump, 0);
}
export const idleTimeout = (fn, ms, maxWait) => setTimeout(() => whenIdle(fn, maxWait), ms);
export const idleInterval = (fn, ms, maxWait) => setInterval(() => whenIdle(fn, maxWait), ms);
export const idleQueueLength = () => Q.length;
