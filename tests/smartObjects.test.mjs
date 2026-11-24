// 스마트 사물 · 단서 보드: 시드 내용 · 단서 연결 추론 · 상태 저장(버전 · 옛 세이브 관용) — DOM/THREE 없이
import test from 'node:test';
import assert from 'node:assert/strict';
import { drawerContents, DRAWER_POOL, inferLinks, tagsOf, serializeState, restoreState, emptyState, SMART_VERSION, minaLine, minaMood, tl, S, POSTS, placeTagOfRoom, createSmart, pickRoomEvent, shouldFire, ROOM_EVENTS } from '../smartObjects.js';

test('서랍 내용은 시드로 고정 (같은 키 → 같은 내용, 다른 키 → 대개 다름)', () => {
  const a = drawerContents('so:본관:0:교무실:cabinet:1'), b = drawerContents('so:본관:0:교무실:cabinet:1');
  assert.deepEqual(a, b); assert.equal(a.length, 2); assert.equal(new Set(a).size, 2);
  a.forEach(i => assert.ok(i >= 0 && i < DRAWER_POOL.length));
  const many = new Set(Array.from({ length: 20 }, (_, i) => drawerContents('k' + i).join()));
  assert.ok(many.size > 10);
});

test('태그 추출: 사람 · 장소 · 날짜', () => {
  const t = tagsOf('10월 12일 밤 교무부장은 펌프실 열쇠를 갖고 있었다');
  for (const k of ['1012', 'vp', 'pump']) assert.ok(t.includes(k), k);
  assert.equal(placeTagOfRoom('도서실'), 'library'); assert.equal(placeTagOfRoom('1학년 1반'), null);
});

test('연결 추론: 공통 태그로 잇고, 공유가 많을수록 앞에', () => {
  const E = [
    { id: 'a', text: '하늘은 밤 10시 방송실 리허설에 갔다.' },
    { id: 'b', text: '방송실 인터폰 — 리허설 중이니…' },
    { id: 'c', text: '하늘의 대출 카드 — 도서실.' },
    { id: 'd', text: '건전지 하나와 고무줄.' },
  ];
  const r = inferLinks(E);
  const ab = r.links.find(l => l.a === 'a' && l.b === 'b'); assert.ok(ab && ab.tags.includes('bcast'));
  assert.ok(r.links.find(l => l.a === 'a' && l.b === 'c').tags.includes('haneul'));
  assert.ok(!r.links.some(l => l.a === 'd' || l.b === 'd'), '공통점 없는 항목은 연결 없음');
});

test('모순 감지: 같은 장소에 대해 열림 ↔ 잠김, 하교 ↔ 못 갔다', () => {
  const r = inferLinks([
    { id: 'x', text: '⚠ 방송부원: “펌프실 문은 이미 열려 있었다.”' },
    { id: 'y', text: '⚠ 경비: “펌프실 문은 밖에서 잠겨 있었다.”' },
    { id: 'z', text: '하늘이는 6시 반납 · 하교 처리.' },
    { id: 'w', text: '하늘이는 집에 가지 못했다.' },
    { id: 'q', text: '도서실은 잠겨 있었다.' },   // 장소가 다르면 모순 아님
  ]);
  assert.ok(r.contradictions.some(c => c.a === 'x' && c.b === 'y' && c.tags.includes('pump')));
  assert.ok(r.contradictions.some(c => c.a === 'z' && c.b === 'w'));
  assert.ok(!r.contradictions.some(c => c.a === 'q' || c.b === 'q'));
});

test('다음에 볼 곳: 두 번 이상 언급 · 아직 조사 안 한 장소만, 답은 말하지 않는다', () => {
  const E = [{ id: '1', text: '펌프실 점검 연기' }, { id: '2', text: '펌프실 배수' }, { id: '3', text: '도서실 대출' }, { id: '4', text: '도서실 반납', place: 'library' }, { id: '5', text: '별관 전기' }];
  const r = inferLinks(E);
  assert.deepEqual(r.suggestions.map(s => s.place), ['pump']);
  assert.equal(r.suggestions[0].n, 2);
  assert.deepEqual(inferLinks(E, ['pump']).suggestions, []);
  assert.deepEqual(inferLinks([]), { links: [], contradictions: [], suggestions: [], tags: {} });
});

test('상태 저장: 왕복 · 버전 · 손상/옛 세이브 관용', () => {
  const st = emptyState();
  st.objs['so:a:tv:0'] = { on: true, ch: 3, n: 5 }; st.objs['so:b:board:0'] = { text: '23:40 → 방송실?' }; st.objs['so:c:cabinet:0'] = { open: false, dr: [1, 4] };
  st.notes.push({ id: 'so:a#0', k: 'tv', room: '시청각실', ko: '심야 라디오 10월 12일', tags: ['1012'], place: null, t: 12.7 });
  const raw = JSON.parse(JSON.stringify(serializeState(st)));
  assert.equal(raw.v, SMART_VERSION);
  const back = restoreState(raw);
  assert.deepEqual(back.objs['so:a:tv:0'], { on: true, ch: 3, n: 5 });
  assert.equal(back.objs['so:b:board:0'].text, '23:40 → 방송실?');
  assert.deepEqual(back.objs['so:c:cabinet:0'].dr, [1, 4]);
  assert.equal(back.notes[0].ko, '심야 라디오 10월 12일'); assert.equal(back.notes[0].t, 13);
  // 옛 세이브(키 없음) · 손상 · 미래 버전
  for (const bad of [undefined, null, 42, 'x', [], { v: 99, objs: { a: { on: true } } }, { objs: 'nope', notes: 'nope' }]) { const r = restoreState(bad); assert.deepEqual(r.objs, {}); assert.deepEqual(r.notes, []); }
  // v0 시험판 키 이름 + 이상값 거르기
  const v0 = restoreState({ objects: { k: { on: 'yes', ch: 2, text: 5, dr: [1, 'x', 3] } }, notes: [{ id: 7, ko: 'a', tags: ['pump', 3] }, null, { ko: 'no id' }] });
  assert.deepEqual(v0.objs.k, { ch: 2, dr: [1, 3] }); assert.equal(v0.notes.length, 1); assert.equal(v0.notes[0].id, '7'); assert.deepEqual(v0.notes[0].tags, ['pump']);
});

test('createSmart: DOM 없이도 직렬화 · 복원 · 리셋', () => {
  const sm = createSmart();
  sm.restore({ v: 1, objs: { q: { on: true } }, notes: [] });
  assert.equal(sm.serialize().objs.q.on, true);
  sm.reset(); assert.deepEqual(sm.serialize().objs, {});
});

test('민아 반응: __mina 가 없거나 모양이 달라도 안전', () => {
  assert.equal(minaLine(undefined, 'k'), '');
  assert.equal(minaMood({ emotion: { name: 'fear' } }), 'scared');
  assert.equal(minaMood({ emotion: '슬픔' }), 'sad');
  assert.equal(minaMood({}), 'calm');
  for (const lg of ['ko', 'en', 'ja', 'zh']) assert.ok(minaLine({ emotion: 'calm' }, 'k', lg).length > 0);
});

test('4개 언어 문자열이 모두 있다', () => {
  for (const k in S) assert.equal(S[k].length, 4, k);
  for (const e of DRAWER_POOL) assert.ok(e.slice(0, 4).every(x => typeof x === 'string' && x.length));
  for (const p of POSTS) { assert.equal(p.t.length, 4); assert.equal(p.b.length, 4); }
  assert.equal(tl('tv', 'ja'), 'ブラウン管テレビ');
});

test('방 이벤트: 방마다 매칭 · 전원/단서 변형 · 시드 고정 · 쿨다운', () => {
  for (const L of ['음악실', '과학실', '방송실', '도서실', '교무실 · 행정실', '보건실', '컴퓨터실', '체육관', '2학년 3반', '교장실', '회의실', '진로상담실', '사진부 암실', '학교 역사관', '남자 화장실']) assert.ok(pickRoomEvent(L), L);
  for (const e of ROOM_EVENTS) for (const pool of [e.v, e.pw, e.np, e.prog].filter(Boolean)) for (const l of pool) assert.equal(l.length, 4, e.id);
  assert.match(pickRoomEvent('과학실', { power: true }).ko, /전열기/); assert.match(pickRoomEvent('과학실', { power: false }).ko, /배수 시료/);
  const lib = pickRoomEvent('도서실', { clues: ['n25'] }); assert.ok(lib.progressed); assert.match(lib.ko, /집으로 가는 길/);
  assert.equal(pickRoomEvent('2학년 1반', { visits: 3 }).ko, pickRoomEvent('2학년 1반', { visits: 3 }).ko);
  assert.equal(pickRoomEvent('복도'), null);
  const mem = { last: {}, visits: {} };
  assert.ok(shouldFire(mem, '음악실', 0)); assert.equal(shouldFire(mem, '음악실', 1000), null); assert.ok(shouldFire(mem, '음악실', 1e6)); assert.equal(mem.visits['음악실'], 2);
});
