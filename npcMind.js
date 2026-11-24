// 서린고 — 동행 NPC(민아)의 '머리': 상황에 맞는 대사 고르기 · 기억(무엇을 말했나) · 힌트 단계(막연 → 구체) · 사건 반응 대사 · 저장
//   · THREE · DOM 없이 동작 (tests/npcAI.test.mjs). 문자열은 모두 lang/<en|ja|zh>.json 에 번역이 있다
//   · 힌트는 장소 · 방법까지만 — 퍼즐 답(번호 · 순서)은 절대 말하지 않는다

export const MIND_VER = 1;
export const HINT_GAP = 40;   // 같은 장(章) 힌트를 한 단계 더 구체적으로 올리기 전 최소 간격(초)

// 장마다 2단계: [0] 막연한 기억 · [1] 접근 방법 (가운데 단계는 민아의 '장소' 힌트 — NPC_LINES.mina.hint)
export const CH_HINT = {
  1: ['내 캠코더… 1학년 교실 쪽 어딘가에 두고 왔던 것 같아.', '1학년 1반 교실이야. 영상 안에 내가 본 게 다 남아 있을 거야.'],
  2: ['교무실은 밤에도 서류 냄새가 나. 오래된 회의록 같은 거 말이야.', '금고 번호 같은 건 보통 잊으면 안 되는 날로 정하지. 기록에 자꾸 나오는 날짜를 잘 봐.'],
  3: ['이 학교는 선생님마다 숨겨 둔 게 하나씩 있다는 소문이 있어.', '손이 안 닿는 데 있는 물건이면 주변 물건을 엮어서 도구를 만들어 봐. 소지품 창에서 합칠 수 있잖아.'],
  4: ['교장 선생님 방은 늘 잠겨 있었어. 수첩을 꼭 들고 다니셨지.', '별관 보안 기록하고 CCTV는 경비실 장비랑 이어져 있어. 녹화가 남아 있을지도 몰라.'],
  5: ['모은 걸 늘어놓기만 해서는 소용없어. 하나로 묶어야 이야기가 되지.', '소지품 창에서 조각들을 한데 합쳐 봐. 기록부처럼 엮일 거야.'],
  6: ['4층 방송실 장비는 아직 살아 있어. 전기만 들어오면 말이야.', '방송을 하려면 전력부터 살려야 해. 지하 전기실 차단기 쪽을 먼저 봐.'],
};

// 상황 대사: 주제 → { any: 문자열 또는 [단계0, 단계1] } (역할별 덮어쓰기 가능)
export const SITU = {
  dark: { any: ['불이 나갔네… 차단기가 내려간 거 아닐까?', '층마다 계단 근처에 철제 분전반이 있어. 거기 차단기를 확인해 봐.'] },
  late: { any: '밤이 꽤 깊었네… 그래도 너랑 같이라 덜 무서워.' },
  keys: { any: '그거, 잃어버리면 안 돼. 하나하나가 그날 밤의 증거야.' },
  battery: { any: '손전등 깜빡거린다. 건전지 남았어?' },
  exploreFew: { any: '별관은 2층 구름다리로 건너가면 돼. 거기도 한번 둘러봐.' },
  exploreMany: { any: '학교 안 다 돌아봤구나. 나보다 더 잘 알겠다.' },
};

// 사건 반응 — 문자열 또는 [처음, 다시]. room 은 '{}' 에 방 이름
export const REACT = {
  lightsOut: { any: ['어? 불 나갔어… 내 옆에 붙어 있어.', '또 정전이야. 분전반부터 보자.'] },
  lightsFixed: { any: '불 들어왔다… 이제 좀 살 것 같아.' },
  room: { any: ['{}… 여기도 조심해서 보자.', '{}. 그날 밤에도 여길 지나갔었어.'] },
  key: { any: ['찾았다… 하나 더 모였어.', '이것도 그날 밤 기록이야. 잘 챙겨.'] },
  run: { any: '같이 가… 너무 빨라!' },
  stairs: { any: '계단은 천천히. 그날 밤에도 여기서 미끄러졌었어.' },
};

const pickRole = (tbl, id) => (tbl[id] != null ? tbl[id] : tbl.any);
const tierOf = (v, t) => (Array.isArray(v) ? v[Math.min(t, v.length - 1)] : v);
export function reactLine(kind, id, count = 0) { const T = REACT[kind]; if (!T) return null; const v = pickRole(T, id); return v == null ? null : tierOf(v, count); }

// 모든 번역 대상 문자열 (테스트 · 번역 점검용)
export function mindStrings() {
  const out = [];
  for (const k in CH_HINT) out.push(...CH_HINT[k]);
  for (const T of [SITU, REACT]) for (const k in T) for (const r in T[k]) { const v = T[k][r]; if (Array.isArray(v)) out.push(...v); else out.push(v); }
  return out;
}

// ── 기억 ──
// told: 이미 한 말(키 → 횟수) · tier: 장별 힌트 단계 · hintAt: 장별 마지막 단계 올린 때 · n: 말 건 횟수
export function newMemory() { return { n: 0, told: {}, tier: {}, hintAt: {}, react: {}, convo: {} }; }
export function sanitizeMemory(m) {
  const o = newMemory(); if (!m || typeof m !== 'object') return o;
  o.n = Number.isFinite(m.n) ? Math.max(0, m.n | 0) : 0;
  for (const k of ['told', 'tier', 'hintAt', 'react', 'convo']) if (m[k] && typeof m[k] === 'object' && !Array.isArray(m[k])) for (const q in m[k]) { const v = m[k][q]; if (Number.isFinite(v)) o[k][q] = v; }
  for (const q in o.tier) o.tier[q] = Math.max(0, Math.min(2, o.tier[q] | 0));
  return o;
}

// ── 상황 판단 ──
// c: { ch, main, where, dark, late, keys, cam, lowBattery, visited } — 게임이 말 걸 때마다 만든다
export function situations(c) {
  const s = [];
  if (c.keys > 0) s.push('keys');
  if (c.lowBattery) s.push('battery');
  if (c.late) s.push('late');
  if (c.visited != null && c.visited < 5) s.push('exploreFew');
  if (c.visited != null && c.visited >= 15) s.push('exploreMany');
  return s;
}

// 대사 고르기 → { key, text, topic, tier }.  L: NPC_LINES[id] (greet[] · hint 틀) · hintMain: '{}' 틀 (목표 문장)
//  1) 처음 말 걸면 인사  2) 어두우면(정전 · 차단기) 그 얘기부터, 단계적으로  3) 홀수 번째마다 장 힌트 — 막연 → 장소 → 방법 (HINT_GAP 초 지나야 한 단계 올림)
//  4) 아직 안 한 상황 대사(소지품 · 시간 · 돌아본 곳)  5) 인사 돌려 쓰기 (안 한 것 먼저)
export function pickLine(id, L, c, mem, now, hintMain) {
  const k = mem.n++, bump = key => { mem.told[key] = (mem.told[key] || 0) + 1; };
  const out = (key, text, topic, tier = 0) => { bump(key); return { key, text, topic, tier }; };
  if (k === 0) return out('g0', L.greet[0], 'greet');
  if (c.dark) {
    const t = mem.tier.dark || 0, v = pickRole(SITU.dark, id);
    if (t < 2) { mem.tier.dark = t + 1; return out('dark' + t, tierOf(v, t), 'dark', t); }
  } else if (mem.tier.dark) mem.tier.dark = 0;   // 불이 다시 들어오면 다음 정전 땐 처음부터
  const ch = c.ch || 1, ck = 'ch' + ch;
  if (k % 2 === 1 && CH_HINT[ch]) {
    const t = mem.tier[ck] || 0, last = mem.hintAt[ck];
    if (last == null || now - last >= HINT_GAP) {   // 너무 자주 물으면 힌트 대신 다른 얘기 (단계가 한꺼번에 올라가지 않게)
      const text = t === 0 ? CH_HINT[ch][0] : t === 1 ? (c.where ? L.hint.replace('{}', c.where) : c.main ? hintMain.replace('{}', c.main) : CH_HINT[ch][0]) : CH_HINT[ch][1];
      mem.tier[ck] = Math.min(2, t + 1); mem.hintAt[ck] = now;
      return out('h' + ch + ':' + t, text, 'hint', t);
    }
  }
  for (const s of situations(c)) { const key = 's:' + s; if (mem.told[key]) continue; const v = pickRole(SITU[s], id); if (v == null) continue; return out(key, tierOf(v, 0), s); }
  // 인사: 안 한 것 먼저, 다 했으면 돌려 쓰기
  let gi = -1; for (let i = 0; i < L.greet.length; i++) if (!mem.told['g' + i]) { gi = i; break; }
  if (gi < 0) gi = (k >> 1) % L.greet.length;
  return out('g' + gi, L.greet[gi], 'greet');
}

// 반응 쿨다운: 같은 NPC · 같은 종류는 cd 초에 한 번
export function canReact(mem, kind, now, cd) { const t = mem.react[kind]; return t == null || now - t >= cd || now < t; }
export function markReact(mem, kind, now) { mem.react[kind] = now; mem.told['r:' + kind] = (mem.told['r:' + kind] || 0) + 1; return mem.told['r:' + kind] - 1; }
