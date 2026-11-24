// 저장 시스템 — 스키마 버전 · 고유 ID 기반 월드 상태 · 백업 슬롯 · 구버전 변환 · 구조 검증
// DOM/Three.js 에 의존하지 않는 순수 함수만 둔다 (tests/save.test.mjs 에서 node 로 검증).
export const SCHEMA = 5;
export const BUILD = '2026.10.14';

// 저장소 키: 테스트 모드는 실제 세이브를 오염시키지 않도록 분리한다
export function storageKeys(test) {
  const p = test ? 'haegyo_test_' : 'haegyo_';
  // corrupt: 읽을 수 없게 된 본 세이브 원문 보관 · future: 더 새 빌드가 쓴 세이브(schemaVersion > SCHEMA) 원문 보관 — 덮어써도 잃지 않는다
  return { main: p + 'save_v5', backup: p + 'save_v5_bak', corrupt: p + 'save_corrupt', future: p + 'save_future', legacy: test ? null : 'haegyo_save_v4', char: p + 'char', endings: p + 'endings', deaths: p + 'deaths', shots: p + 'shots', stats: p + 'stats', auto: p + 'auto' };
}

// 고유 ID: 위치가 바뀌어도 의미가 같은 물건은 같은 ID 를 갖도록 (열쇠 조각 · 문서는 위치와 무관)
export function itemUid(it) {
  if (it.kind === 'key') return 'key:' + it.idx;
  if (it.id && (it.kind === 'note' || it.kind === 'photo')) return it.kind + ':' + it.id;
  if (it.kind === 'camcorder' || it.kind === 'nametag') return it.kind;
  return `${it.kind}:${it.floor}:${Math.round(it.pos.x * 10)}:${Math.round(it.pos.z * 10)}`;
}
export function propUid(p) { return `${p.kind}:${p.id || ''}:${p.floor}:${Math.round(p.x * 10)}:${Math.round(p.z * 10)}`; }
export function doorUid(d) { return `door:${d.floor}:${Math.round(d.x * 10)}:${Math.round((d.z ?? 0) * 10)}`; }
// 같은 ID 가 생기면 #2, #3 … 을 붙여 유일하게 만든다
export function assignUids(list, fn) {
  const seen = new Map();
  list.forEach(o => { const base = o.uid || fn(o); const n = (seen.get(base) || 0) + 1; seen.set(base, n); o.uid = n > 1 ? `${base}#${n}` : base; });
  return list.map(o => o.uid);
}

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// 구조 검증 — 손상되었거나 필수 필드가 없으면 오류 목록을 돌려준다
export function validate(d) {
  const err = [];
  if (!isRecord(d)) return ['저장 데이터가 객체가 아님'];
  if (d.schemaVersion !== SCHEMA) err.push('schemaVersion 불일치');
  if (!d.meta || typeof d.meta.char !== 'string') err.push('meta.char 없음');
  const pl = d.player;
  if (!isRecord(pl) || !['x', 'z', 'floor', 'hp'].every(k => Number.isFinite(pl[k])) || !Number.isInteger(pl.floor) || pl.floor < 0 || pl.floor > 10) err.push('player 좌표/체력 이상');
  if (!d.progress || !Array.isArray(d.progress.got)) err.push('progress.got 없음');
  if (!isRecord(d.world) || !isRecord(d.world.items) || !isRecord(d.world.props) || (d.world.doors != null && !isRecord(d.world.doors))) err.push('world 상태 없음');
  if (!isRecord(d.inv)) err.push('inv 없음');
  return err;
}

// v4(배열 인덱스 기반) → v5(고유 ID 기반). ctx: 현재 빌드의 itemUids / propUids 순서
export function migrate(d, ctx) {
  if (!d || typeof d !== 'object') return null;
  if (d.schemaVersion === SCHEMA) return d;
  if (d.schemaVersion != null && d.schemaVersion > SCHEMA) return null;   // 미래 버전은 읽지 않는다
  if (!isRecord(d.P) || !Array.isArray(d.got)) return null;
  if ((d.taken != null && !Array.isArray(d.taken)) || (d.props != null && !Array.isArray(d.props))) return null;
  if (!ctx || !Array.isArray(ctx.itemUids) || !Array.isArray(ctx.propUids)) return null;
  const items = {}, props = {};
  (d.taken || []).forEach((t, i) => { if (t && ctx.itemUids[i]) items[ctx.itemUids[i]] = 1; });
  (d.props || []).forEach((s, i) => { if (s && s.done && ctx.propUids[i]) props[ctx.propUids[i]] = { done: true }; });
  return {
    schemaVersion: SCHEMA, build: 'migrated-v4',
    meta: { char: d.char || (d.meta && d.meta.char) || 'seoyeon', ch: d.meta ? d.meta.ch : 1, time: d.playTime || 0, savedAt: d.meta ? d.meta.at : Date.now(), where: '' },
    player: { ...d.P },
    progress: { got: d.got, FL: d.FL || {}, power: !!d.power, gateClosed: !!d.gateClosed, introDone: !!d.introDone, playTime: d.playTime || 0 },
    inv: d.inv || {}, docs: d.docs || [], msgs: d.msgs || [], clues: d.clues || [],
    events: [], tips: [], cards: [],
    world: { items, props, doors: {} },
  };
}

// 세이브 정규화(같은 스키마 안의 예전 · 새 빌드 차이 흡수): 빠진 선택 필드는 기본값, 모르는 필드는 그대로 둔다(새 빌드 필드 보존).
// 유령(추격) 기능은 제거됨 — 예전 세이브의 ghost 상태는 읽지 않는다(game.js 도 무시).
export function normalize(d) {
  if (!isRecord(d)) return d;
  for (const k of ['docs', 'msgs', 'clues', 'events', 'tips', 'cards']) if (!Array.isArray(d[k])) d[k] = [];
  if (isRecord(d.progress) && !isRecord(d.progress.FL)) d.progress.FL = {};
  if (isRecord(d.world) && !isRecord(d.world.doors)) d.world.doors = {};
  if (isRecord(d.meta) && typeof d.meta.where !== 'string') d.meta.where = '';
  if (d.inv == null) d.inv = {};
  delete d.ghost;
  return d;
}

// 원문을 보관 키에 복사(같은 내용이면 건너뜀) — 실패해도 진행은 막지 않는다
function keepRaw(storage, key, raw) { if (!key || !raw) return; try { if (storage.getItem(key) !== raw) storage.setItem(key, raw); } catch (e) { /* ignore */ } }
// 읽기: 본 세이브 → (실패 시) 백업 → (없으면) 구버전 변환. { data, source }
// 손상된 본 세이브는 corrupt 키에, 더 새 빌드의 세이브는 future 키에 원문을 남긴다(절대 예외를 던지지 않는다).
export function readSlot(storage, keys, ctx, preferBackup = false) {
  const order = [[keys.main, 'main'], [keys.backup, 'backup'], [keys.legacy, 'legacy']];
  if (preferBackup) order.unshift(order.splice(1, 1)[0]);
  for (const [k, src] of order) {
    if (!k) continue;
    let text = null, raw = null;
    try { text = storage.getItem(k); } catch (e) { continue; }
    if (!text) continue;
    try { raw = JSON.parse(text); } catch (e) { if (src === 'main') keepRaw(storage, keys.corrupt, text); continue; }
    if (isRecord(raw) && Number(raw.schemaVersion) > SCHEMA) { keepRaw(storage, keys.future, text); continue; }   // 다운그레이드: 읽지 않고 원문 보관
    try {
      const d = normalize(migrate(raw, ctx)); if (!d) { if (src === 'main') keepRaw(storage, keys.corrupt, text); continue; }
      if (validate(d).length === 0) return { data: d, source: src };
      if (src === 'main') keepRaw(storage, keys.corrupt, text);
    } catch (e) {
      // 한 슬롯의 변환 실패가 정상 백업 복구까지 막지 않도록 한다.
      if (src === 'main') keepRaw(storage, keys.corrupt, text);
      continue;
    }
  }
  return { data: null, source: null };
}
// 쓰기: 기존 본 세이브를 백업으로 밀어 두고 새로 쓴다. 기존 본 세이브가 손상 · 미래 버전이면 버리지 않고 corrupt · future 키에 보관한다.
export function writeSlot(storage, keys, data) {
  const errors = validate(data);
  if (errors.length) throw new Error('저장 데이터 검증 실패: ' + errors.join(', '));
  const next = JSON.stringify(data); // 직렬화 실패 시 기존 슬롯은 그대로 둔다.
  const prev = storage.getItem(keys.main);
  if (prev) {
    let parsed = null; try { parsed = JSON.parse(prev); } catch (e) { /* 손상 */ }
    if (parsed && validate(parsed).length === 0) storage.setItem(keys.backup, prev);
    else if (isRecord(parsed) && Number(parsed.schemaVersion) > SCHEMA) keepRaw(storage, keys.future, prev);
    else keepRaw(storage, keys.corrupt, prev);
  }
  storage.setItem(keys.main, next);
}
export function hasSlot(storage, keys) { return !!(storage.getItem(keys.main) || storage.getItem(keys.backup) || (keys.legacy && storage.getItem(keys.legacy))); }
export function clearSlot(storage, keys) { [keys.main, keys.backup, keys.legacy].forEach(k => k && storage.removeItem(k)); }

// 진행 불능 방지: 필수 진행 상태를 서로 맞춘다 (열쇠 조각 수, 정문 열쇠 등)
export function repairProgress(d, total) {
  const fixes = [];
  const n = d.progress.got.filter(Boolean).length;
  if (d.player.keys !== n) { fixes.push(`열쇠 조각 수 ${d.player.keys}→${n}`); d.player.keys = n; }
  if (d.progress.FL && d.progress.FL.gatekey && n < total) { fixes.push('정문 열쇠 플래그 해제'); d.progress.FL.gatekey = false; }
  if (!Number.isFinite(d.player.hp) || d.player.hp <= 0) { fixes.push('체력 복구'); d.player.hp = 50; }
  return fixes;
    }
