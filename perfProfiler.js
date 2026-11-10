// 프레임 시간 프로파일러 (?debug 에서만 켜진다 — 평소에는 모든 함수가 즉시 반환)
//   window.__perf.report() : 프레임 간격 히스토그램 · >33/50/100ms 프레임 수 · 프레임 안 JS 시간 · 긴 프레임에 무엇이 돌았는지(구간 태그)
//   window.__perf.reset()  : 측정 다시 시작
//   타이머(setTimeout · setInterval) · 이벤트 콜백 중 4ms 넘게 걸린 것도 출처와 함께 기록한다 (프레임 사이에 끼어 끊김을 만드는 작업 찾기)
const BUCKETS = [4, 8, 12, 17, 25, 33, 50, 100, 250, 1e9];
const P = { on: false, frames: 0, t0: 0, last: 0, cur: null, mark: 0, fStart: 0,
  gap: new Array(BUCKETS.length).fill(0), js: new Array(BUCKETS.length).fill(0), over33: 0, over50: 0, over100: 0, jsOver8: 0, jsOver16: 0, jsOver33: 0,
  jsSum: 0, jsMax: 0, gapMax: 0, tags: Object.create(null), long: [], tasks: [], taskSum: Object.create(null), pend: [] };
const bucket = ms => { for (let i = 0; i < BUCKETS.length; i++) if (ms <= BUCKETS[i]) return i; return BUCKETS.length - 1; };

export function perfProfInit(on) {
  if (!on || P.on) return; P.on = true; P.t0 = performance.now();
  // 프레임 밖 작업(타이머)의 시간 측정
  const wrap = (fn, kind) => { if (typeof fn !== 'function') return fn; const label = kind + ':' + (fn.name || String(fn).replace(/\s+/g, ' ').slice(0, 70));
    return function (...a) { const t = performance.now(); try { return fn.apply(this, a); } finally { const d = performance.now() - t; if (d > 4) task(label, d); } }; };
  const st = window.setTimeout, si = window.setInterval;
  window.setTimeout = (fn, ms, ...a) => st(wrap(fn, 'timeout'), ms, ...a);
  window.setInterval = (fn, ms, ...a) => si(wrap(fn, 'interval@' + ms), ms, ...a);
  window.__perf = { report, reset, raw: P, note: perfNote };
}
function task(label, ms) { P.pend.push(label + '=' + ms.toFixed(1)); const s = (P.taskSum[label] ||= { n: 0, ms: 0, max: 0 }); s.n++; s.ms += ms; if (ms > s.max) s.max = ms; if (P.tasks.length < 400) P.tasks.push({ t: Math.round(performance.now() - P.t0), label, ms: +ms.toFixed(1) }); }
// 프레임 밖 · 안에서 일어난 사건을 다음 긴 프레임 기록에 붙인다 (예: 'floor 0→4', 'save')
export function perfNote(s) { if (P.on) P.pend.push(String(s)); }
export function perfFrameBegin() {
  if (!P.on) return; const now = performance.now();
  if (P.last) { const g = now - P.last; P.gap[bucket(g)]++; if (g > 33.4) P.over33++; if (g > 50) P.over50++; if (g > 100) P.over100++; if (g > P.gapMax) P.gapMax = g; P.lastGap = g; }
  P.last = now; P.fStart = P.mark = now; P.cur = Object.create(null); P.frames++;
}
// 직전 구간이 끝났다: 그 시간을 tag 에 더한다
export function perfMark(tag) { if (!P.on || !P.cur) return; const now = performance.now(), d = now - P.mark; P.mark = now; P.cur[tag] = (P.cur[tag] || 0) + d; }
export function perfFrameEnd() {
  if (!P.on || !P.cur) return; const now = performance.now(), js = now - P.fStart, c = P.cur; P.cur = null;
  P.js[bucket(js)]++; P.jsSum += js; if (js > P.jsMax) P.jsMax = js; if (js > 8) P.jsOver8++; if (js > 16.7) P.jsOver16++; if (js > 33.4) P.jsOver33++;
  for (const k in c) { const s = (P.tags[k] ||= { ms: 0, max: 0, n: 0 }); s.ms += c[k]; s.n++; if (c[k] > s.max) s.max = c[k]; }
  if (js > 12 || P.lastGap > 40) { if (P.long.length < 600) { const top = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + '=' + v.toFixed(1)); P.long.push({ t: Math.round(now - P.t0), gap: +(P.lastGap || 0).toFixed(1), js: +js.toFixed(1), top, ev: P.pend.slice(0, 8) }); } }
  P.pend.length = 0;
}
function reset() { P.frames = 0; P.last = 0; P.gap.fill(0); P.js.fill(0); P.over33 = P.over50 = P.over100 = P.jsOver8 = P.jsOver16 = P.jsOver33 = 0; P.jsSum = P.jsMax = P.gapMax = 0; P.tags = Object.create(null); P.long = []; P.tasks = []; P.taskSum = Object.create(null); P.pend.length = 0; P.t0 = performance.now(); }
function report() {
  const h = a => Object.fromEntries(BUCKETS.map((b, i) => ['<=' + (b > 1e6 ? 'inf' : b), a[i]]));
  const tags = Object.entries(P.tags).map(([k, v]) => ({ tag: k, avg: +(v.ms / Math.max(1, P.frames)).toFixed(3), max: +v.max.toFixed(1) })).sort((a, b) => b.avg - a.avg);
  const tasks = Object.entries(P.taskSum).map(([k, v]) => ({ label: k, n: v.n, total: +v.ms.toFixed(1), max: +v.max.toFixed(1) })).sort((a, b) => b.total - a.total).slice(0, 25);
  return { frames: P.frames, seconds: +((performance.now() - P.t0) / 1000).toFixed(1), gapHist: h(P.gap), over33: P.over33, over50: P.over50, over100: P.over100, gapMax: +P.gapMax.toFixed(1),
    jsHist: h(P.js), jsAvg: +(P.jsSum / Math.max(1, P.frames)).toFixed(2), jsMax: +P.jsMax.toFixed(1), jsOver8: P.jsOver8, jsOver16: P.jsOver16, jsOver33: P.jsOver33, tags, tasks, long: P.long };
}
