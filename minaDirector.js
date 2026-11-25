// 서린고 — 민아 '연출' 계층 (THREE · DOM 없이 동작 · tests/minaDirector.test.mjs)
//   1) LineGate     : 대사 반복 줄이기 — 줄마다 쿨다운 · N분 안에 같은 줄 금지 · 덜 쓴 줄에 가중치
//   2) SpeechQueue  : 말 차례 — 우선순위 큐 · 이야기 대사/다른 자막 위로 말하지 않는다 · 오래된 말은 버린다
//   3) HintDirector : 민아 · 무전 · 단서 보드가 함께 쓰는 힌트 단계 하나 (서로 다른/겹치는 힌트 금지) · 힌트 빈도(적게/보통/많이)
//   4) 행동 고르기  : 대기 행동(둘러보기 · 휴대폰 · 팔짱 · 벽 기대기 · 앉기) · 가감속 · 시야 가림 판정
//   매 프레임 부르는 함수(approach · turnSpeed · occludes · idleBehavior)는 객체를 만들지 않는다
import { hintLine, HINT_GAP } from './npcMind.js?v=461';

// ── 1. 반복 제어 ──
//   window: 같은 줄을 다시 쓰기까지 최소 시간(초) · cd[id]: 줄마다 따로 정한 쿨다운
export function createLineGate({ window: win = 300, cd = null } = {}) {
  const last = new Map(), count = new Map();
  const G = {
    win, stats: { said: 0, repeats: 0, blocked: 0 },
    cooldown: id => (cd && cd[id] != null ? cd[id] : G.win),
    canSay(id, now) { const t = last.get(id); return t == null || now < t || now - t >= G.cooldown(id); },
    mark(id, now) { const t = last.get(id); if (t != null && now >= t && now - t < G.win) G.stats.repeats++; last.set(id, now); count.set(id, (count.get(id) || 0) + 1); G.stats.said++; },
    uses: id => count.get(id) || 0,
    lastAt: id => last.get(id),
    // 후보 중 하나: 쿨다운 지난 것만 · 덜 쓴 줄 · 오래전에 쓴 줄일수록 무겁게. 고를 게 없으면 null
    pick(ids, now, rnd = Math.random) {
      let tot = 0;
      for (let i = 0; i < ids.length; i++) { const w = G.weight(ids[i], now); tot += w; }
      if (tot <= 0) { G.stats.blocked++; return null; }
      let r = rnd() * tot;
      for (let i = 0; i < ids.length; i++) { const w = G.weight(ids[i], now); if ((r -= w) <= 0 && w > 0) return ids[i]; }
      for (let i = ids.length - 1; i >= 0; i--) if (G.weight(ids[i], now) > 0) return ids[i];
      return null;
    },
    weight(id, now) {
      if (!G.canSay(id, now)) return 0; const t = last.get(id), n = count.get(id) || 0;
      const age = t == null ? 4 : Math.min(4, (now - t) / Math.max(1, G.cooldown(id)));
      return (1 + age) / (1 + n * n);
    },
    serialize() { const o = {}; for (const [k, v] of last) o[k] = [v, count.get(k) || 0]; return o; },
    restore(o) { last.clear(); count.clear(); if (!o || typeof o !== 'object') return; for (const k in o) { const v = o[k]; if (Array.isArray(v) && Number.isFinite(v[0])) { last.set(k, v[0]); count.set(k, Number.isFinite(v[1]) ? v[1] | 0 : 1); } } },
    reset() { last.clear(); count.clear(); G.stats.said = G.stats.repeats = G.stats.blocked = 0; },
  };
  return G;
}

// ── 2. 말 차례 (우선순위 큐) ──
export const PRIO = { talk: 100, story: 90, hint: 70, safety: 65, react: 50, examine: 45, board: 42, comment: 30, banter: 20, idle: 10 };
//   item: { key, who, text, prio, ttl(초), dur(자막 초), gap(뒤 쉼 초), kind }
export function createSpeechQueue({ max = 6, gap = 1.2 } = {}) {
  const items = [];
  let quietUntil = -1e9, seq = 0, lastSpoke = -1e9;
  const Q = {
    items, stats: { pushed: 0, spoken: 0, dropped: 0, expired: 0, deduped: 0 },
    push(it, now) {
      if (!it || !it.text) return false;
      for (let i = 0; i < items.length; i++) if ((it.key && items[i].key === it.key) || items[i].text === it.text) { Q.stats.deduped++; if ((it.prio || 0) > items[i].prio) items[i].prio = it.prio; return false; }
      const e = { key: it.key || '', who: it.who || '', text: it.text, prio: it.prio ?? PRIO.comment, exp: now + (it.ttl ?? 8), dur: it.dur ?? 3.4, gap: it.gap ?? gap, kind: it.kind || '', s: seq++, then: it.then || null };
      items.push(e); Q.stats.pushed++;
      if (items.length > max) { let lo = 0; for (let i = 1; i < items.length; i++) if (items[i].prio < items[lo].prio || (items[i].prio === items[lo].prio && items[i].s < items[lo].s)) lo = i; items.splice(lo, 1); Q.stats.dropped++; }
      return true;
    },
    // 말할 차례: busy(이야기 대사 · 다른 자막) 이거나 앞 말의 쉼 안이면 null
    next(now, busy) {
      for (let i = items.length - 1; i >= 0; i--) if (items[i].exp < now) { items.splice(i, 1); Q.stats.expired++; }
      if (!items.length || busy || now < quietUntil) return null;
      let b = 0; for (let i = 1; i < items.length; i++) if (items[i].prio > items[b].prio || (items[i].prio === items[b].prio && items[i].s < items[b].s)) b = i;
      const e = items.splice(b, 1)[0]; quietUntil = now + e.dur + e.gap; lastSpoke = now; Q.stats.spoken++; return e;
    },
    // 바로 말한 것(대화 등)도 차례에 넣는다 — 그 뒤 큐는 기다린다
    hold(now, sec) { quietUntil = Math.max(quietUntil, now + sec); lastSpoke = now; },
    clear(below = Infinity) { for (let i = items.length - 1; i >= 0; i--) if (items[i].prio < below) { items.splice(i, 1); Q.stats.dropped++; } },
    sinceSpoke: now => now - lastSpoke,
    get size() { return items.length; },
    reset() { items.length = 0; quietUntil = -1e9; lastSpoke = -1e9; },
  };
  return Q;
}

// ── 3. 힌트 감독 ──
//   한 장(章)의 힌트 단계(0 막연 → 1 장소 → 2 방법)는 하나뿐 — 누가 말하든(민아 · 무전 · 보드) 같은 단계를 올린다
//   freq: low(적게) · normal(보통) · high(많이) → 단계 사이 최소 간격 · 먼저 꺼내는 막힘 기준 시간 배율
export const HINT_FREQ = { low: { gap: 2, stuck: 1.75, sugg: 1 }, normal: { gap: 1, stuck: 1, sugg: 3 }, high: { gap: .5, stuck: .55, sugg: 3 } };
export const HINT_FREQ_KEYS = ['low', 'normal', 'high'];
export const HINT_FREQ_LABEL = { low: '적게', normal: '보통', high: '많이' };
export function createHintDirector({ freq = 'normal' } = {}) {
  const D = {
    freq: HINT_FREQ[freq] ? freq : 'normal',
    st: { tier: {}, hintAt: {}, last: null, n: 0, by: {} },
    setFreq(f) { D.freq = HINT_FREQ[f] ? f : 'normal'; },
    get F() { return HINT_FREQ[D.freq]; },
    gap() { return HINT_GAP * D.F.gap; },
    // 먼저 꺼낼 막힘 기준(초): base × 배율
    stuckAfter(base) { return base * D.F.stuck; },
    tier(ch) { return D.st.tier['ch' + (ch || 1)] || 0; },
    // 방금(sec 안) 누군가 힌트를 줬나 — 다른 쪽이 겹쳐 말하지 않게
    recently(now, sec = 30) { const l = D.st.last; return !!l && now >= l.t && now - l.t < sec; },
    // 다음 힌트 한 단계 (src: 'mina' · 'radio' · 'board') — 너무 이르면 null. L: 그 화자의 틀(hint · ch 표)
    request(src, L, c, now, hintMain, { force = false } = {}) {
      if (!force && D.recently(now, Math.min(D.gap(), 30)) && D.st.last.src !== src) return null;   // 다른 화자가 방금 힌트를 줬다
      const h = hintLine(L, c, D.st, now, hintMain, D.gap()); if (!h) return null;
      h.src = src; D.st.last = { src, t: now, key: h.key }; D.st.n++; D.st.by[src] = (D.st.by[src] || 0) + 1; return h;
    },
    // 지금 단계 다시 말하기(새 단계 아님): 자유 대화가 '힌트 줘' 할 때 너무 이르면
    repeatTier(ch) { return Math.max(0, D.tier(ch) - 1); },
    // 단서 보드 제안을 몇 개 보여줄지 (빈도 · 지금 단계에 따라)
    boardSuggestions(ch) { return D.freq === 'low' ? (D.tier(ch) >= 1 ? 1 : 0) : D.F.sugg; },
    serialize() { return { tier: { ...D.st.tier }, hintAt: { ...D.st.hintAt }, n: D.st.n }; },
    restore(o) { D.st = { tier: {}, hintAt: {}, last: null, n: 0, by: {} }; if (!o || typeof o !== 'object') return;
      for (const k of ['tier', 'hintAt']) if (o[k] && typeof o[k] === 'object') for (const q in o[k]) if (Number.isFinite(o[k][q])) D.st[k][q] = o[k][q];
      for (const q in D.st.tier) D.st.tier[q] = Math.max(0, Math.min(2, D.st.tier[q] | 0)); D.st.n = Number.isFinite(o.n) ? o.n | 0 : 0; },
    // 예전 세이브의 따로 놀던 단계(민아 mem.tier · 무전 prMem.tier)를 합친다 — 더 많이 나간 쪽
    absorb(mem) { if (!mem || !mem.tier) return; for (const k in mem.tier) if (/^ch\d/.test(k)) { D.st.tier[k] = Math.max(D.st.tier[k] || 0, mem.tier[k] | 0); if (mem.hintAt && Number.isFinite(mem.hintAt[k])) D.st.hintAt[k] = Math.max(D.st.hintAt[k] ?? -1e9, mem.hintAt[k]); } },
    reset() { D.restore(null); },
  };
  return D;
}

// ── 4. 행동 ──
// 가감속: v 를 목표 속도로 (가속 acc · 감속 dec m/s²)
export function approach(v, target, dt, acc = 2.4, dec = 4.2) {
  if (target > v) return Math.min(target, v + acc * dt);
  return Math.max(target, v - dec * dt);
}
// 회전 호: 방향 오차가 크면 앞으로 덜 간다(제자리 미끄러짐 대신 호를 그리며 돈다). 0.3 ~ 1
export function turnSpeed(err) { const a = Math.abs(err); return a < .35 ? 1 : Math.max(.3, Math.cos(Math.min(a, 1.4)) + .15); }

// 대기 행동 고르기 (순수): s = { still(민아 멈춘 초), pIdle(플레이어 가만히 초), emo, dark, wall(뒤에 벽 있음), r(0~1 난수), cur }
//   돌려주는 값: 'none' · 'look'(둘러보기) · 'phone'(휴대폰) · 'hug'(팔짱 · 움츠림) · 'lean'(벽 기대기) · 'sit'(쪼그려 쉬기)
export function idleBehavior(s) {
  if (s.still < 2.5) return 'none';
  if (s.emo === 'uneasy' || s.dark) return s.still > 4 ? 'hug' : 'look';
  if (s.pIdle > 35 && s.still > 12) return 'sit';
  if (s.cur && s.cur !== 'none' && s.cur !== 'look') return s.cur;   // 이미 하던 자세는 이어간다 (깜빡이지 않게)
  if (s.still > 7 && s.wall) return 'lean';
  if (s.still > 6) return s.r < .5 ? 'phone' : 'look';
  return s.r < .35 ? 'look' : 'none';
}

// 시야 가림: 카메라(cx, cz) → 목표(tx, tz) 선분에 민아(mx, mz, 반지름 r)가 걸리나 — 카메라에서 목표까지 사이에 있을 때만
export function occludes(cx, cz, tx, tz, mx, mz, r = .35) {
  const dx = tx - cx, dz = tz - cz, L2 = dx * dx + dz * dz; if (L2 < 1e-6) return false;
  const k = ((mx - cx) * dx + (mz - cz) * dz) / L2; if (k <= .05 || k >= .95) return false;
  const px = cx + dx * k - mx, pz = cz + dz * k - mz; return px * px + pz * pz < r * r;
}

// 멀어진 민아를 옮겨도 되나: 플레이어가 그 자리를 보고 있지 않을 때만 (시야각 밖이거나, 벽 너머이거나, 충분히 멀거나)
//   fx, fz: 플레이어(카메라)가 보는 방향 · los: 플레이어 ↔ 그 자리 사이가 트였나
export function canTeleportUnseen(px, pz, fx, fz, x, z, los, fov = 1.1) {
  const dx = x - px, dz = z - pz, d = Math.hypot(dx, dz); if (d < .5) return false;
  if (!los) return true;
  const c = (dx * fx + dz * fz) / (d * (Math.hypot(fx, fz) || 1)); return c < Math.cos(fov) && d > 1.8;
}

// 게임 하나에 힌트 감독 하나: 민아(npcAI) · 무전(partnerRadio) · 단서 보드(smartObjects 표시 개수)가 함께 쓴다
export const hintDirector = createHintDirector();
// 민아 대사 묶음 (id 목록) — 혼잣말 · 조사 반응
export const MUTTER_IDS = ['mutter_0', 'mutter_1', 'mutter_2', 'mutter_3', 'mutter_4', 'mutter_5', 'mutter_6', 'mutter_7', 'mutter_8', 'mutter_9'];
export const EXAM_IDS = { cabinet: ['exam_cabinet'], shelf: ['exam_cabinet'], tv: ['exam_screen'], radio: ['exam_screen'], pc: ['exam_pc'], phone: ['exam_phone'], intercom: ['exam_phone'], board: ['exam_wall'], any: ['exam_any_0', 'exam_any_1', 'exam_any_2'] };
export const BANTER_N = 4;
