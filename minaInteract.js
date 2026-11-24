// 서린고 — 민아와 가구 · 소지품 · 장식 (THREE · DOM 없이 동작 · tests/minaInteract.test.mjs)
//   1) 자리 고르기 : window.__seats [{x,y,z,floor,yaw,kind,building}] 중 플레이어 곁 · 마주 앉기 (없으면 null → 쪼그려 쉬기)
//   2) 보여주기   : 소지품 하나에 대한 민아의 한마디 — 처음 · 다시 · 힌트 단계(0 막연 → 1 장소 → 2 방법)에 맞춘 귀띔 (답은 말하지 않는다)
//   3) 장식 반응  : 방 이름 → 눈에 띄는 장식 종류 (종류마다 한 번)

// ── 1. 자리 ──
// 자리의 앉는 높이(바닥에서): y 가 바닥 높이 그대로(0.2m 아래)면 보통 의자 높이 .45
export function seatHeight(s, floorY) { const h = (s.y ?? floorY) - floorY; return h > .2 && h < 1.2 ? h : .45; }
const onLayer = (s, floorY) => Number.isFinite(s.x) && Number.isFinite(s.z) && Math.abs((s.y ?? floorY) - floorY) < 1.3 && (s.y ?? floorY) >= floorY - .2;
// q: { floorY, px, pz(플레이어), mx, mz(민아), maxP(플레이어에서), ok(x,z)(갈 수 있나), avoid(다른 사람이 앉은 자리 반경) }
export function pickSeat(seats, q) {
  if (!Array.isArray(seats) || !seats.length) return null;
  const maxP = q.maxP ?? 4.5; let best = null, bs = Infinity;
  for (const s of seats) {
    if (!s || !onLayer(s, q.floorY)) continue;
    const dP = Math.hypot(s.x - q.px, s.z - q.pz); if (dP > maxP || dP < (q.avoid ?? .8)) continue;
    if (q.ok && !q.ok(s.x + Math.sin(s.yaw || 0) * .55, s.z + Math.cos(s.yaw || 0) * .55)) continue;
    const dM = Math.hypot(s.x - q.mx, s.z - q.mz), fx = Math.sin(s.yaw || 0), fz = Math.cos(s.yaw || 0), face = ((q.px - s.x) * fx + (q.pz - s.z) * fz) / (dP || 1);
    const sc = dP + dM * .4 - face * 1.2; if (sc < bs) { bs = sc; best = s; }
  }
  return best;
}
// 플레이어가 앉은 자리(ps: {x,z,yaw}) 맞은편: 앞쪽 0.7~2.8m · 서로 마주 보는 자리 우선, 없으면 플레이어 쪽을 보는 가까운 자리
export function seatAcross(seats, ps, floorY, ok = null) {
  if (!Array.isArray(seats) || !ps) return null; const fx = Math.sin(ps.yaw || 0), fz = Math.cos(ps.yaw || 0); let best = null, bs = Infinity;
  for (const s of seats) {
    if (!s || !onLayer(s, floorY)) continue; const dx = s.x - ps.x, dz = s.z - ps.z, d = Math.hypot(dx, dz); if (d < .7 || d > 2.8) continue;
    const ahead = (dx * fx + dz * fz) / d; if (ahead < .3) continue;
    const opp = Math.cos((s.yaw || 0) - (ps.yaw || 0)); if (opp > -.3) continue;   // 같은 쪽을 보는 자리(옆 · 앞줄)는 마주 앉기가 아니다
    if (ok && !ok(s.x + Math.sin(s.yaw || 0) * .55, s.z + Math.cos(s.yaw || 0) * .55)) continue;
    const sc = d * (1 - ahead * .5) + (1 + opp); if (sc < bs) { bs = sc; best = s; }
  }
  return best;
}
// 앉으러 갈 자리 앞(서는 곳): 자리에서 앉는 방향으로 0.55m
export const seatFront = (s, d = .55) => ({ x: s.x + Math.sin(s.yaw || 0) * d, z: s.z + Math.cos(s.yaw || 0) * d });

// ── 2. 소지품 ──
export const ITEM_CAT = {
  eqKey: 'key', gymBoothKey: 'key', keys_jihun: 'key', poolValveKey: 'key',
  chlorineLog: 'doc', letterT: 'doc', bookHome: 'doc', memo_jihun: 'doc', memo_seoyeon: 'doc', id_jihun: 'doc', id_seoyeon: 'doc',
  tapeTrio: 'media', stageReel: 'media', camcorder: 'media', recorder: 'media',
  battery: 'power', emBattery: 'power',
  medkit: 'care', firstaid: 'care', candy: 'care', thermos: 'care', sedative: 'care',
  hairpin: 'tool', mop: 'tool', wire: 'tool', hook: 'tool', can: 'tool', tape: 'tool', acid: 'tool', fuse: 'tool', alarm: 'tool', shock: 'tool', flashlight: 'tool', phone_jihun: 'tool', phone_seoyeon: 'tool',
  necklace: 'story', nametag: 'story', keypiece: 'story', keyhead: 'story', gatekey: 'story', frozenkey: 'story',
};
export const ITEM_CATS = ['key', 'doc', 'media', 'power', 'care', 'tool', 'story'];
export const itemCat = id => ITEM_CAT[id] || (/key/i.test(id || '') ? 'key' : /photo|note|doc|log/i.test(id || '') ? 'doc' : 'story');
// 물건마다 따로 있는 대사: see(처음 보면) · use(장소 귀띔 — 1단계부터)
export const ITEM_SPECIAL = {
  necklace: { see: 'item_necklace' }, nametag: { see: 'item_nametag' }, camcorder: { see: 'item_camcorder' }, keypiece: { see: 'item_keypiece' }, gatekey: { see: 'item_gatekey' },
  fuse: { use: 'item_fuse_use' }, hook: { use: 'item_hook_use' }, mop: { use: 'item_mop_use' }, wire: { use: 'item_mop_use' }, emBattery: { use: 'item_emBattery_use' }, tapeTrio: { use: 'item_tapeTrio_use' },
  bookHome: { use: 'item_bookHome_use' }, letterT: { use: 'item_letterT_use' }, poolValveKey: { use: 'item_valve_use' }, gymBoothKey: { use: 'item_booth_use' }, eqKey: { use: 'item_eqKey_use' }, acid: { use: 'item_acid_use' },
};
// 이 카테고리에 단계별 귀띔이 있나 (care · story 는 방법 단계 없음)
const CAT_HOW = { key: 1, doc: 1, media: 1, power: 1, tool: 1 };
// 민아의 반응 고르기 (순수): mem.told 에 'i:<id>'(보여 준 횟수) · 'it:<id>'(이미 말한 귀띔 단계 +1)를 남긴다
//   tier: 지금 장의 공용 힌트 단계(0~2) · used: 이 물건을 이미 다 썼나(그럼 귀띔 없음)
//   돌려주는 값: { ids: [대사 id, …](1~2줄), first, nudge(귀띔 단계 or -1), cat }
export function itemComment(id, mem, { tier = 0, used = false } = {}) {
  const cat = itemCat(id), sp = ITEM_SPECIAL[id] || {}, told = mem.told, n = told['i:' + id] | 0, given = (told['it:' + id] | 0) - 1;
  told['i:' + id] = n + 1;
  const ids = []; let nudge = -1;
  if (n === 0) ids.push(sp.see || `item_${cat}_see`);
  // 귀띔: 단계 1 → 장소(물건 전용 · 카테고리 use) · 단계 2 → 방법(카테고리 how). 이미 한 단계는 되풀이하지 않는다
  if (!used) {
    const want = Math.min(tier, 2);
    for (let t = Math.max(1, given + 1); t <= want; t++) {
      const line = t === 1 ? (sp.use || (cat !== 'story' || n > 0 ? `item_${cat}_use` : null)) : CAT_HOW[cat] ? `item_${cat}_how` : null;
      if (line && !ids.includes(line)) { ids.push(line); nudge = t; break; }
    }
    if (nudge < 0 && n > 0 && tier === 0 && given < 0 && (sp.use || CAT_HOW[cat] || cat === 'care')) { ids.push(cat === 'care' ? 'item_care_use' : (sp.use || `item_${cat}_use`)); nudge = 1; }   // 두 번째로 보여 주면 장소 귀띔 하나 (막연 단계여도 — 플레이어가 물어본 셈)
    if (nudge > 0) told['it:' + id] = nudge + 1;
  }
  if (!ids.length) ids.push('item_again');
  return { ids: ids.slice(0, 2), first: n === 0, nudge, cat };
}
// 무전 상대에게 물어보기: 카테고리 한 줄
export const radioItemLine = id => 'radio_item_' + itemCat(id);

// ── 3. 장식 ──
//   방 이름 → 장식 종류 (먼저 맞는 것) · 종류마다 한 번만 말한다
export const DECOR_RULES = [
  ['trophy', /교장실|체육관|체육교사|행정실|트로피/],
  ['photo', /역사관|기록|보존|사진/],
  ['broken', /창고|보일러|기계실|B1|지하|폐/],
  ['poster', /음악실|미술실|과학|보건실|도서|상담|방송실/],
  ['motto', /\d+\s*-\s*\d+|\d+반|교실/],
  ['timetable', /교무실|\d+\s*-\s*\d+|\d+반|교실/],
  ['flag', /교실|교무|회의/],
];
export function decorFor(room, told = {}) {
  if (!room) return null;
  for (const [k, re] of DECOR_RULES) if (re.test(room) && !told['d:' + k]) return k;
  return null;
}
export const DECOR_KINDS = DECOR_RULES.map(r => r[0]);
// 새 대사 id (녹음 대본용)
export const INTERACT_LINE_IDS = [...new Set([
  ...ITEM_CATS.flatMap(c => [`item_${c}_see`, `item_${c}_use`, ...(CAT_HOW[c] ? [`item_${c}_how`] : [])]), 'item_again',
  ...Object.values(ITEM_SPECIAL).flatMap(o => Object.values(o)), ...ITEM_CATS.map(c => 'radio_item_' + c), 'radio_busy',
  ...DECOR_KINDS.map(k => 'decor_' + k), 'tidy_cabinet', 'tidy_blinds', 'seat_sit', 'seat_across', 'seat_up'])];
