// 브라우저 회귀 테스트 (Playwright) — 엔딩까지의 진행 · 저장/복원 · 캐릭터 · 테스트 세이브 분리
// 실행: python3 -m http.server 8765  (다른 터미널)
//       PW_CORE=<playwright-core 경로> CHROME=<chromium 실행 파일> node tests/e2e.mjs
// 미니게임 조작 자체는 MG.win() 으로 성공 처리하고, 그 결과(보상 · 진행 플래그 · 저장)를 검증한다.
const pw = await import(process.env.PW_CORE || 'playwright-core');
const URL = process.env.GAME_URL || 'http://localhost:8765/index.html';
const b = await pw.chromium.launch({ executablePath: process.env.CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
let pass = 0, fail = 0, restores = 0;
const SEC = [], sec = t => { SEC.push({ t, p: 0, f: 0 }); console.log('\n■ ' + t); };   // 구역별 집계 — 구역이 조용히 빠지면 결과 표에서 바로 보인다
const ok = (cond, msg) => { const S = SEC[SEC.length - 1]; if (cond) { pass++; if (S) S.p++; console.log('  ✔', msg); } else { fail++; if (S) S.f++; console.log('  ✘', msg); } };

async function page(qs = process.env.GAME_QS || '?debug') {   // 새 건물 점검: GAME_QS='?debug&rb&norender'
  const ctx = await b.newContext({ viewport: { width: 480, height: 270 } });
  // 외부 요청(구글 웹폰트 등)은 막는다: 샌드박스 프록시에서 응답 없이 매달린 폰트 요청이 'load' · 새로고침을 수 분씩 붙잡았다 — 글꼴은 대체 글꼴로 그려지고 게임 동작과는 무관
  if (!process.env.E2E_NET) await ctx.route(u => !/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(u.href), r => r.abort());
  const p = await ctx.newPage();
  p.setDefaultNavigationTimeout(180000); p.setDefaultTimeout(60000);
  p.errors = 0; p.on('pageerror', e => { p.errors++; console.log('   [pageerror]', e.message, (e.stack || '').split('\n')[1] || ''); });
  await p.goto(URL + qs, { timeout: 180000 }); await p.waitForFunction(() => window.__loadTimes, null, { timeout: 180000 });
  return p;
}
const E = (p, f, a) => p.evaluate(f, a);
// 정문을 연 뒤 마지막 선택(EV-23): 선택지가 뜨면 고른다
async function finalChoice(p, i) {
  await p.waitForFunction(() => document.getElementById('choice').classList.contains('show'), null, { timeout: 30000 });
  await p.evaluate(i => document.querySelectorAll('#choiceBtns button')[i].click(), i);
  // 결말 자료(뉴스 · 경찰 · 학교) 세 장을 넘긴다
  await p.waitForFunction(() => { const o = document.getElementById('outro'); if (o.classList.contains('show') && o.querySelector('.card.on')) { o.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); window.__outroN = (window.__outroN || 0) + 1; } return document.getElementById('win').classList.contains('show'); }, null, { timeout: 40000, polling: 900 });
}
const W = (p, t) => p.waitForTimeout(t);
// 새 게임 · 이어하기: 로딩 화면(whenAssetsReady — 소품 모델은 상한 시간 뒤 플레이 중 계속 들어옴)과 타이틀이 닫힐 때까지 기다린다
const started = p => p.waitForFunction(() => !document.getElementById('loading').classList.contains('show') && !document.getElementById('title').classList.contains('show'), null, { timeout: 180000 }).then(() => W(p, 700));
// 인트로 건너뛰기: 시작 1.5초 동안은 Space · Enter 를 무시한다(introSkippable) → 그 뒤에 눌러야 실제로 넘어간다
const skipIntro = async p => { await p.waitForFunction(() => __g.state !== 'intro' || __g.introSkippable(), null, { timeout: 10000, polling: 100 }).catch(() => W(p, 1600)); await p.keyboard.press('Space'); };
async function ready(p) { await E(p, () => __g.applyQuality('low')); }
// 아이템 줍기 / 장치 사용 (위치로 이동 → 상호작용)
const take = (p, kind, id) => E(p, ([k, id]) => { const it = __g.world.items.find(i => i.kind === k && (id == null || i.id === id || i.idx === id) && !i.taken); if (!it || it.locked) return it ? 'locked' : 'none'; __g.state = 'playing'; __g.P.floor = it.floor; __g.P.x = it.pos.x; __g.P.z = it.pos.z + .8; __g.P.sh = it.rbY ?? __g.P.sh; __g.setTarget({ type: 'item', it, label: '' }); __g.interact(); return 'ok'; }, [kind, id]);
const use = (p, kind, i = 0) => E(p, ([k, i]) => { const s = __g.world.props.filter(q => q.kind === k)[i]; __g.state = 'playing'; __g.P.floor = s.floor; __g.P.x = s.x; __g.P.z = s.z + .9; __g.P.sh = s.rbY ?? __g.P.sh; __g.useProp(s); return s.label; }, [kind, i]);
const winMini = async p => { for (let i = 0; i < 20 && !(await E(p, () => __g.MG.active)); i++) await W(p, 150); await E(p, () => __g.MG.win()); await W(p, 1000); await E(p, () => { if (__g.state === 'note' || __g.state === 'ui') __g.state = 'playing'; }); };
const closeNote = p => E(p, () => { if (__g.state === 'note') { document.getElementById('noteBox').click(); } __g.state = 'playing'; });
// 새로고침은 'load' 이벤트가 아니라 __loadTimes 를 기다린다: 소프트웨어 GL 에서 프레임 하나가 2초 · 셰이더 동기 컴파일이 수십 초라 'load' 대기가 180초를 넘기곤 했다
async function saveReload(p, label) {
  await E(p, () => { __g.state = 'playing'; __g.save(); });
  await p.reload({ waitUntil: 'commit' }); await p.waitForFunction(() => window.__loadTimes, null, { timeout: 180000 }); await ready(p);
  await E(p, () => __g.continueGame()); await started(p); await E(p, () => { __g.state = 'playing'; });
  restores++; return label;
}

async function normalRun(char) {
  sec(`${char} — 처음부터 NORMAL 엔딩 (+ 저장/복원)`);
  const p = await page();
  await E(p, c => { localStorage.clear(); localStorage.setItem('haegyo_char', c); }, char); await p.reload({ waitUntil: 'commit' }); await p.waitForFunction(() => window.__loadTimes, null, { timeout: 180000 }); await ready(p);
  await E(p, () => __g.newGame()); await started(p); await skipIntro(p); await W(p, 500);
  ok(await E(p, () => __g.CHAR) === char, `주인공 ${char}`);
  await E(p, () => { __g.P.z = -1; });
  ok(await take(p, 'camcorder') === 'ok', '캠코더 획득'); await W(p, 300);
  await saveReload(p, '캠코더 후'); ok(await E(p, () => __g.FL.cam) && await E(p, () => __g.CHAR) === char, '복원: 캠코더 · 캐릭터 유지');
  await take(p, 'note', 'n3'); await closeNote(p);
  // 금고: 연 직후(열쇠 줍기 전) 저장 → 복원 → 줍기 (P0)
  await use(p, 'safe'); await W(p, 300); for (const k of '1012') await p.keyboard.press('Digit' + k);
  // 금고가 열리면 1.4초 뒤 열쇠를 저절로 집는다 → 열린 바로 그 프레임에 저장해야 '열쇠 줍기 전' 세이브가 된다 (W 300 뒤 저장은 느린 실행에서 이미 집은 뒤였다)
  await p.waitForFunction(() => { const s = __g.world.props.find(q => q.kind === 'safe'); if (s.done && __g.state === 'playing' && !s.key.taken) { __g.save(); return true; } return false; }, null, { timeout: 20000, polling: 30 }).catch(() => {});
  await p.reload({ waitUntil: 'commit' }); await p.waitForFunction(() => window.__loadTimes, null, { timeout: 180000 }); await ready(p); await E(p, () => __g.continueGame()); await started(p); await E(p, () => { __g.state = 'playing'; }); restores++;
  ok(await E(p, () => { const k = __g.world.items.find(i => i.kind === 'key' && i.idx === 0); return k.taken ? __g.P.keys === 1 : !k.locked && k.mesh.visible; }), '복원: 금고 안 열쇠가 잠기지 않고 보임 (P0)');
  await take(p, 'key', 0); await p.waitForFunction(() => __g.P.keys === 1, null, { timeout: 8000 }).catch(() => {});   // 복원 3초 뒤 저절로 집을 수도 있다
  ok(await E(p, () => __g.P.keys === 1 && __g.world.items.find(i => i.kind === 'key' && i.idx === 0).taken), '첫 열쇠 조각 획득');
  await E(p, () => { __g.ghost.active = false; });
  await saveReload(p, '첫 조각 후'); ok(await E(p, () => __g.P.keys) === 1 && await E(p, () => __g.docs.some(d => d.id === 'n3')), '복원: 조각 1 · 문서');
  // 도서실: 머리핀 → 자물쇠 따기
  ok(await take(p, 'hairpin') === 'ok', '머리핀 획득');
  await use(p, 'lock', 0); await winMini(p); ok(await take(p, 'key', 1) === 'ok', '도서실 조각 (자물쇠 따기)');
  await saveReload(p, '도서실 후'); ok(await E(p, () => __g.world.props.filter(q => q.kind === 'lock')[0].done), '복원: 보관함 열린 상태');
  // 과학실 · 체육관: 다이얼
  await use(p, 'lock', 1); await winMini(p); ok(await take(p, 'key', 2) === 'ok', '과학실 조각 (다이얼)');
  await use(p, 'lock', 2); await winMini(p); ok(await take(p, 'key', 3) === 'ok', '체육관 조각 (다이얼)');
  // 수영장: 자루 + 철사 → 갈고리 → 낚기
  await take(p, 'mop'); await take(p, 'wire');
  await saveReload(p, '재료 수집 후'); ok(await E(p, () => __g.FL.mop && __g.FL.wire), '복원: 대걸레 자루 · 철사');
  await E(p, () => { __g.openInv('keys'); }); await W(p, 200);
  await E(p, () => { const cells = [...document.querySelectorAll('#invGrid .cell:not(.empty)')]; cells.find(c => c.innerHTML.includes('🦯')).click(); });
  await p.keyboard.press('KeyC'); await E(p, () => { [...document.querySelectorAll('#invGrid .cell:not(.empty)')].find(c => c.innerHTML.includes('➰')).click(); }); await W(p, 300);
  ok(await E(p, () => __g.FL.hook), '조합: 갈고리 장대'); await p.keyboard.press('Tab'); await W(p, 200);
  // 수영장은 먼저 물을 빼야 한다 (수질관리실 밸브 → FL.poolDrained)
  await E(p, () => { const s = __g.world.props.find(q => q.kind === 'mspot' && q.m && q.m.id === 'poolValve'); __g.state = 'playing'; __g.P.floor = s.floor; __g.P.x = s.x; __g.P.z = s.z + .9; __g.P.sh = s.rbY ?? __g.P.sh; __g.useProp(s); });
  await winMini(p); ok(await E(p, () => __g.FL.poolDrained), '수영장 배수 (수질관리실 밸브)');
  await use(p, 'drain'); await winMini(p); ok(await E(p, () => __g.P.keys) === 5, '수영장 조각 (낚기) — 5/5');
  await saveReload(p, '조각 5개'); ok(await E(p, () => __g.P.keys) === 5 && await E(p, () => __g.objective().ch) === 4, '복원: 조각 5 · 제4장');
  // 제4장 · 열쇠의 머리: 머리 없이는 조합 불가 → 교장실 → 별관 머릿돌 → 분전반(배선) → 보안 PC(사진 맞추기) → 진열장(0302)
  await E(p, () => __g.makeGateKey()); ok(!(await E(p, () => __g.FL.gatekey)), '열쇠 머리 없이는 정문 열쇠를 만들 수 없음');
  const hd = async k => { await E(p, k => { const q = __g.world.props.find(o => o.uid === `sq:head:${k}`); __g.state = 'playing'; __g.ghost.active = false; __g.tp(q.x, q.z + (q.z > 0 ? -1 : 1), q.floor, 0, 0); __g.P.sh = q.rbY ?? __g.P.sh; __g.useHead(q); }, k); };
  await hd(0); await W(p, 600); await closeNote(p); await hd(1); await W(p, 600); await closeNote(p);
  await saveReload(p, '제4장 중간'); ok(await E(p, () => __g.sqStep('head')) === 2 && await E(p, () => __g.objective().ch) === 4, '복원: 제4장 진행 (교장 수첩 · 머릿돌)');
  await hd(2); await winMini(p); await closeNote(p); ok(await E(p, () => __g.FL.anPow), '별관 분전반 → 별관 전원');
  await hd(3); await winMini(p); await closeNote(p);
  await hd(4); await p.waitForFunction(() => document.getElementById('keypad').classList.contains('show'), null, { timeout: 60000 }); await W(p, 300); for (const k of '0302') await p.keyboard.press('Digit' + k); await W(p, 1500); await E(p, () => { __g.ghost.active = false; }); await closeNote(p);
  ok(await E(p, () => __g.FL.keyhead) && await E(p, () => __g.objective().ch) === 5 && await E(p, () => ['h1', 'h2', 'h3', 'h4', 'h5'].every(id => __g.docs.some(d => d.id === id))), '진열장(0302) → 열쇠 머리 · 제5장 · 문서 5종');
  await saveReload(p, '열쇠 머리 후'); ok(await E(p, () => __g.FL.keyhead && __g.objective().ch === 5), '복원: 열쇠 머리');
  await E(p, () => __g.makeGateKey()); await W(p, 2500); await E(p, () => { __g.ghost.active = false; __g.ghost.enraged = false; });
  await saveReload(p, '정문 열쇠 후'); ok(await E(p, () => __g.FL.gatekey) && await E(p, () => __g.objective().ch) === 6, '복원: 정문 열쇠 · 제6장');
  await E(p, () => { __g.ghost.active = false; __g.state = 'playing'; __g.P.floor = 0; __g.P.x = 0; __g.P.z = 67; __g.P.yaw = Math.PI; });
  await p.evaluate(s => new Promise(r => { const t0 = __g.tNow; const f = () => { if (__g.tNow - t0 >= s) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), .4);
  await p.keyboard.press('KeyE'); await finalChoice(p, 1);
  ok(await E(p, () => __g.state) === 'won' && (await E(p, () => document.getElementById('endTag').textContent)) === 'NORMAL END', 'NORMAL 엔딩 도달');
  ok(await E(p, () => __g.FL.final) === 'B0' && (await E(p, () => document.getElementById('winText').textContent)).includes('END B?'), '마지막 선택 B (혼자 떠남) 후일담');
  ok(p.errors === 0, '콘솔 오류 없음'); await p.close();
}

async function trueRun() {
  sec('TRUE 엔딩 경로 (명찰 → 퓨즈 · 차단기 → 마지막 방송 → 민아)');
  const p = await page();
  await E(p, () => { localStorage.clear(); localStorage.setItem('haegyo_char', 'seoyeon'); }); await p.reload({ waitUntil: 'commit' }); await p.waitForFunction(() => window.__loadTimes, null, { timeout: 180000 }); await ready(p);
  await E(p, () => __g.newGame()); await started(p); await skipIntro(p); await W(p, 500);
  await take(p, 'nametag'); ok(await E(p, () => __g.FL.tag), '명찰');
  await saveReload(p, '명찰 후'); ok(await E(p, () => __g.FL.tag && __g.FL.opt), '복원: 명찰 · 특별 목표');
  await use(p, 'breaker'); ok(!(await E(p, () => __g.power)), '퓨즈 없이 차단기 불가');
  await take(p, 'fuse'); await use(p, 'breaker'); await winMini(p); ok(await E(p, () => __g.power), '퓨즈 + 배선 → 전력 복구');
  await saveReload(p, '전력 후'); ok(await E(p, () => __g.power) && await E(p, () => __g.world.props.find(q => q.kind === 'breaker').on), '복원: 차단기 켜짐');
  // 장비실 철문: 경비실 열쇠함 → 예비 열쇠 → 철문 → 민아 구출 → 앵커석 대본 낭독 (큐 대사 ~25초 뒤 방송 미니게임)
  await p.waitForFunction(() => __g.world.props.some(q => q.kind === 'eqKeyBox'), null, { timeout: 30000 });
  await use(p, 'mina'); ok(!(await E(p, () => __g.FL.eqOpen || __g.FL.mina)), '열쇠 없이 장비실 철문 불가');
  await use(p, 'eqKeyBox'); await W(p, 300); await use(p, 'eqDoor'); ok(await E(p, () => __g.FL.eqOpen), '경비실 예비 열쇠 → 장비실 철문');
  await use(p, 'mina'); await W(p, 4000); ok(await E(p, () => __g.FL.mina), '민아 깨우기');
  await saveReload(p, '민아 후'); ok(await E(p, () => __g.FL.mina && __g.FL.eqOpen) && await E(p, () => __g.minaF.on && __g.mina.visible), '복원: 민아 구출 · 동행 유지');
  await use(p, 'console'); await E(p, () => { __g.state = 'playing'; __g.bcAuto(); });
  await p.waitForFunction(() => __g.MG.active, null, { timeout: 60000 }); await winMini(p); ok(await E(p, () => __g.FL.tapesDone), '마지막 방송: 녹음 순서 복원');
  await W(p, 16000); ok(await E(p, () => __g.FL.calm && !__g.ghost.active), '하교 방송 → 그것이 사라짐');
  await saveReload(p, '방송 후'); ok(await E(p, () => __g.FL.calm && !__g.ghost.active), '복원: 방송 완료 · 그것 비활성');
  // 의뢰(서브 퀘스트): '집으로 가는 길'(조건 없음) · '민아가 여기 온 이유'(민아 구출 후) — 진행 · 아이템 주고받기 · 저장/복원
  const sq = async (id, k) => { await E(p, ([id, k]) => { const q = __g.world.props.find(o => o.uid === `sq:${id}:${k}`); __g.state = 'playing'; __g.tp(q.x, q.z + .8, q.floor, 0, 0); __g.useSideQuest(q); }, [id, k]); await W(p, 2600); await E(p, () => { if (__g.state === 'note' || __g.state === 'ui') __g.state = 'playing'; }); };
  ok(await E(p, () => __g.world.props.filter(o => o.kind === 'sq' && !o.main).length) === 20 && await E(p, () => __g.world.props.filter(o => o.kind === 'sq' && o.main).length) === 5, '의뢰 조사 지점 20곳 · 제4장 지점 5곳 배치');
  await sq('book', 0); ok(await E(p, () => __g.sqStep('book') === 1 && __g.FL.qi.bookHome), '의뢰: 책을 집음 (퀘스트 아이템)');
  await sq('book', 1); ok(await E(p, () => __g.sqStep('book') === 2 && !__g.FL.qi.bookHome && __g.docs.some(d => d.id === 'q8b')), '의뢰 완료: 반납 (아이템 소모 · 문서)');
  for (const k of [0, 1, 2]) await sq('mina', k);
  ok(await E(p, () => __g.sqStep('mina') === 3 && __g.sqDoneCount() === 2), '의뢰 완료: 민아가 여기 온 이유 (민아 조건)');
  await saveReload(p, '의뢰 후'); ok(await E(p, () => __g.sqStep('book') === 2 && __g.sqStep('mina') === 3 && __g.world.props.filter(o => o.kind === 'sq' && !o.done).length === 6), '복원: 의뢰 진행 · 남은 의뢰 6건의 첫 지점');
  await E(p, () => { __g.world.items.filter(i => i.kind === 'key').forEach(i => { if (!i.taken) { i.locked = false; __g.setTarget({ type: 'item', it: i }); __g.state = 'playing'; __g.interact(); } }); __g.FL.keyhead = true; __g.makeGateKey(); });
  await W(p, 2500); ok(!(await E(p, () => __g.ghost.enraged)), '방송 후엔 최종 추격 없음');
  await E(p, () => { __g.state = 'playing'; __g.P.floor = 0; __g.P.x = 0; __g.P.z = 67; __g.P.yaw = Math.PI; });
  await p.evaluate(s => new Promise(r => { const t0 = __g.tNow; const f = () => { if (__g.tNow - t0 >= s) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), .4);
  await p.keyboard.press('KeyE'); await finalChoice(p, 1);
  ok((await E(p, () => document.getElementById('endTag').textContent)) === 'TRUE END', 'TRUE 엔딩 도달');
  ok(await E(p, () => __g.FL.final) === 'B', '마지막 선택 B (민아와 함께) 후일담');
  ok(p.errors === 0, '콘솔 오류 없음'); await p.close();
}

async function extrasRun() {
  sec('사물함 수색 · 수집품 · 소모품 · 방 미니게임 · 초자연 현상');
  const p = await page();
  await E(p, () => { localStorage.clear(); localStorage.setItem('haegyo_char', 'jihun'); }); await p.reload({ waitUntil: 'commit' }); await p.waitForFunction(() => window.__loadTimes, null, { timeout: 180000 }); await ready(p);
  await E(p, () => __g.newGame()); await started(p); await skipIntro(p); await W(p, 500); await E(p, () => { __g.ghost.active = false; });
  ok(await E(p, () => __g.world.props.filter(q => q.kind === 'search').length) >= 40 && await E(p, () => __g.world.props.filter(q => q.kind === 'mspot').length) >= 10, '수색 지점 40곳 이상 · 방 미니게임 10곳 이상');
  // 수집품이 든 사물함 3곳을 실제로 뒤진다 (가만히 1.1초)
  const n = await E(p, async () => { let k = 0; for (const q of __g.world.props.filter(q => q.kind === 'search' && q.loot && q.loot.col).slice(0, 3)) { __g.state = 'playing'; __g.tp(q.x, q.z + (q.where === '복도' ? .7 : q.z < 0 ? -.5 : .5), q.floor, 0, 0); __g.startSearch(q); if (__g.XT.search) __g.XT.search.t = 1.09; const t0 = performance.now(); while (__g.XT.search && performance.now() - t0 < 8000) await new Promise(r => setTimeout(r, 50)); if (q.done) k++; } return k; });
  ok(n === 3 && await E(p, () => Object.keys(__g.FL.col || {}).length) === 3, '사물함 수색 → 수집품 3개');
  await E(p, () => { const q = __g.world.props.find(o => o.uid === 'ms:lab'); __g.state = 'playing'; __g.tp(q.x, q.z + 1.2, q.floor, 0, 0); __g.useMiniSpot(q); }); await winMini(p);
  ok(await E(p, () => __g.FL.ms && __g.FL.ms.lab === 1 && __g.inv.medkit >= 1 && __g.FL.col.c27 === 1), '과학실 미니게임(시약 적정) → 구급상자 · 형광 시약병(c27)');
  await E(p, () => { const q = __g.world.props.find(o => o.uid === 'ms:music'); __g.state = 'playing'; __g.tp(q.x, q.z + 1.2, q.floor, 0, 0); __g.useMiniSpot(q); }); await winMini(p);
  ok(await E(p, () => __g.FL.col.c07 === 1), '음악실 미니게임(순서 따라 하기) → 수집품');
  // 칠판 질문(kind 'chalk')은 조사 지점 · 질문 목록(CHALK_QA) · useProp 연결이 모두 없어 게임에서 열 수 없다 — 예전의 조건부 검사는 늘 조용히 건너뛰었으므로 뺐다
  ok(await E(p, () => { __g.state = 'playing'; const i = __g.inv; i.medkit = 1; i.sedative = 1; __g.tryCombine('medkit', 'sedative'); __g.P.hp = 40; __g.useFirstAid(); return i.firstaid === 0 && __g.P.hp === 100; }), '조합 (CraftingSystem: 응급 처치 키트)');
  ok(await E(p, () => { __g.state = 'playing'; __g.camMode(true); const on = __g.CAM.on && __g.camera.layers.isEnabled(2); __g.P.pbat = 100; const b0 = __g.P.pbat; __g.camShoot(); const shot = __g.P.pbat <= b0 - 19.9; const ov = document.body.classList.contains('ghost-cam-active'); __g.camMode(false); return on && ov && shot && !__g.camera.layers.isEnabled(2) && __g.CAM.clues.length > 50 && __g.ghostCam.hiddenClues.length === 3; }), '심령 카메라 (GhostCameraSystem: 숨은 단서 레이어 · 플래시 촬영)');
  ok(await E(p, () => { __g.state = 'playing'; __g.setBreaker(0, true); const on = __g.BRK[0].on; __g.setBreaker(0, false); __g.schoolPower.chimeTimer = 0; return on && __g.world.props.filter(q => q.kind === 'cbreaker').length === 7 && __g.schoolPower.powerBoxes.length === 7; }), '배전반 7곳 (SchoolPowerEventSystem) · 차임벨');
  ok(await E(p, () => { __g.state = 'playing'; const W = __g.world, sinks = W.props.filter(q => q.kind === 'sink'), fl = W.props.filter(q => q.kind === 'flush'), st = W.lockers.filter(l => l.stallDoor), lk = W.doorList.filter(d => d.locked);
    const s0 = sinks.find(q => q.floor === 0); __g.P.fear = .5; __g.useSink(s0); __g.useSink(s0); __g.useSink(s0); const f3 = __g.P.fear; __g.useFlush(fl[0]);
    const l = st.find(o => o.floor === 0); __g.enterLocker(l); const closed = l.stallDoor.target === 0; __g.leaveLocker(true); const reopened = l.stallDoor.target === 1;
    return sinks.length >= 18 && fl.length > 10 && st.length === fl.length && lk.length >= 3 && closed && reopened && s0.sinkObj.uses === 3 && Math.abs(f3 - .5) > .01; }), '남/녀 화장실 (RestroomSystem 세면대 · 변기 물 내리기 · 칸막이 은신 · 잠긴 3번 칸)');
  ok(await E(p, () => { __g.state = 'playing'; __g.inv.charm = 1; __g.P.invuln = 0; __g.ghost.active = true; __g.ghost.floor = __g.P.floor; __g.ghost.x = __g.P.x + 1; __g.ghost.z = __g.P.z; const hp = __g.P.hp; __g.hit(); const r = __g.P.hp === hp && __g.inv.charm === 1; __g.ghost.active = false; return r; }), '유령 접촉은 체력과 부적을 소모하지 않음');
  const bf = await E(p, () => JSON.stringify([Object.keys(__g.FL.col), __g.world.props.filter(q => q.kind === 'search' && q.done).map(q => q.uid || q.x), __g.FL.ms]));
  await saveReload(p, '수색 후'); const af = await E(p, () => JSON.stringify([Object.keys(__g.FL.col), __g.world.props.filter(q => q.kind === 'search' && q.done).map(q => q.uid || q.x), __g.FL.ms]));
  ok(bf === af && await E(p, () => Object.keys(__g.FL.col).length === 5 && __g.FL.col.c27 === 1 && __g.world.props.filter(q => q.kind === 'search' && q.done).length === 3 && __g.FL.ms.lab === 1), '복원: 수집품 · 뒤진 사물함 · 미니게임 보답' + (bf === af ? '' : ` — 전 ${bf} / 후 ${af}`));
  ok(p.errors === 0, '콘솔 오류 없음'); await p.close();
}


// 도달성 감사: 모든 문을 연 상태에서 바닥을 격자로 채워(플레이어 반지름 0.3m · 0.4m 이하 단은 올라섬) 복도에서 걸어갈 수 있는 곳을 구하고,
// 모든 아이템 · 장치 · 의뢰 · 수색 · 미니게임 · 칠판 · 숨는 사물함을 '걸어갈 수 있는 자리에서 바라보고 E' 로 고를 수 있는지 확인한다.
// 예외: 잠긴 보관함 · 금고 · 서랍 속 물건(먼저 열어야 함), 철제 덮개로만 들어가는 비밀 자료실
async function reachAudit() {
  sec('도달성 감사 (막힌 통로 · 가려진 조사 지점)');
  const p = await page();
  await E(p, () => { localStorage.clear(); __g.newGame(); }); await started(p); await skipIntro(p); await W(p, 600);
  // 소품 모델이 다 들어와야 묻힌 아이템 옮기기(itemUnbury)가 끝난다 — 이어하기는 기다리지 않으므로 여기서 기다린다
  await p.waitForFunction(() => window.__modelsDone, null, { timeout: 180000 }); await W(p, 500);
  const bad = await E(p, () => {
    const g = __g, out = []; g.ghost.active = false; g.state = 'playing'; if (window.__rbRel) window.__rbRel();   // 새 건물: 방금 생긴 조사 지점까지 옮긴 뒤 점검
    g.world.doorList.forEach(d => { if (d.rect) d.rect.off = true; }); (g.world.facDoors || []).forEach(D => { D.t = D.target = 1; D.open = true; D.sync(); });   // 캠퍼스 시설 실내 문도 연다
    g.floors.forEach(F => F && F.col.forEach(c => { if (c.gate) c.off = true; }));   // 미션으로 여는 문(옥상 녹슨 철문 등)도 열린 것으로
    const SEEDS = { 0: [[0.8, -11.2]], 4: [[18, -16], [0.8, -5.2]] };   // B1: 계단으로 내려온 자리(철문 안쪽)   // 순간이동 문으로만 들어가는 공간 (본관 ↔ 별관 실내 연결복도)
    const S = .2, r = .3, FF = {};
    const AREA = { 0: [-100, 100, -100, 90, [0, 40]], 1: [-36, 36, -10, 10, [4, 0]], 2: [-36, 36, -10, 10, [4, 0]], 3: [-36, 36, -10, 10, [0, -6]], 4: [-36, 36, -36, 10, [4, 0]], 5: [15, 52, 5, 33, [38, 27]], 6: [-60, -28, 16, 60, [-35.5, 38]], 7: [-49, -29, 7, 23, [-39, 20]], 8: [-21, 21, -10, 10, [-15.2, -5.2]], 9: [-21, 21, -10, 10, [-15.2, -5.2]], 10: [-21, 21, -10, 10, [-15.2, -5.2]] };
    const flood = f => { if (FF[f]) return FF[f]; const F = g.floors[f]; const [x0, x1, z0, z1, [sx, sz]] = AREA[f]; const nx = Math.round((x1 - x0) / S), nz = Math.round((z1 - z0) / S);
      // 높이를 따라 걷는다(게임의 STEP_UP 처럼): 발 높이 + 0.4m 이하 윗면은 올라서고(관람석 · 무대 계단을 한 단씩), 그보다 높은 것만 막는다
      const blocked = (x, z, ft = 0) => F.col.some(c => !c.off && !(c.h != null && c.h <= ft + .4) && !(c.y0 != null && c.y0 > ft + 1.5) && x > c.x1 - r && x < c.x2 + r && z > c.z1 - r && z < c.z2 + r);
      const supAt = (x, z, ft) => F.col.reduce((s, c) => !c.off && c.h != null && c.h <= ft + .4 && c.h > s && x > c.x1 - .1 && x < c.x2 + .1 && z > c.z1 - .1 && z < c.z2 + .1 ? c.h : s, 0);
      const seen = new Uint8Array(nx * nz), hh = new Float32Array(nx * nz), q = [];
      for (const [ax, az] of [[sx, sz], ...(SEEDS[f] || [])]) { let si = Math.round((ax - x0) / S), sk = Math.round((az - z0) / S);
      outer: for (let d = 0; d < 20; d++) for (let a = -d; a <= d; a++) for (const [i, k] of [[si + a, sk - d], [si + a, sk + d], [si - d, sk + a], [si + d, sk + a]]) if (i >= 0 && k >= 0 && i < nx && k < nz && !blocked(x0 + i * S, z0 + k * S)) { si = i; sk = k; break outer; }
      seen[sk * nx + si] = 1; q.push([si, sk]); }
      while (q.length) { const [i, k] = q.pop(), ft = hh[k * nx + i]; for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, c = k + dk; if (a < 0 || c < 0 || a >= nx || c >= nz) continue; const id = c * nx + a; if (seen[id] === 1) continue; const x = x0 + a * S, z = z0 + c * S; if (blocked(x, z, ft)) { seen[id] = 2; continue; } seen[id] = 1; hh[id] = supAt(x, z, ft); q.push([a, c]); } }
      const at = (x, z) => { const i = Math.round((x - x0) / S), k = Math.round((z - z0) / S); return i >= 0 && k >= 0 && i < nx && k < nz && seen[k * nx + i] === 1 ? k * nx + i : -1; };
      const fn = (x, z) => at(x, z) >= 0; fn.h = (x, z) => hh[at(x, z)] || 0; return FF[f] = fn; };
    const T = [];
    g.world.items.forEach(it => { if (!it.taken && it.kind !== 'key' && it.id !== 'n27') T.push({ o: it, f: it.floor, x: it.pos.x, z: it.pos.z, id: it.kind + ':' + (it.id ?? '') }); });
    g.world.props.forEach(q => { if (q.kind !== 'switch' && q.minSh == null && !q.after && !(q.kind === 'tape' && q.id === 'tape5')) T.push({ o: q, f: q.floor, x: q.x, z: q.z, id: q.kind + ':' + (q.uid || q.k || '') }); });
    g.world.lockers.forEach((l, i) => { if (!l.noPick && l.stallDoor) T.push({ o: l, f: l.floor, x: l.x, z: l.z, id: 'locker:' + i, l: true }); });   // noPick: 국솥 · 청소도구함은 자기 조사 지점으로 숨는다
    for (const t of T) {
      if (!AREA[t.f]) continue;
      if (window.__rbg && [1, 2, 8, 9, 10].includes(t.f)) continue;   // 새 건물: 예전 층에 남겨 둔(쓰지 않는) 장치는 점검 대상 아님
      // 새 건물(기본): 옮긴 대상은 그 층 높이(rbY)에서 — 바닥이 그 높이이고 막히지 않은 자리 (층 사이 연결은 rebuild 보행 감사가 따로 본다)
      const up2 = t.f === 0 && t.o.rbY == null && (t.o.y ?? 0) > 3.2 && [[-86, -42, 22, 14], [-88, 42, 22, 14], [-88, 14, 20, 16], [-88, -16, 15.6, 10.6]].some(([cx, cz, w, d]) => Math.abs(t.x - cx) < w / 2 + .1 && Math.abs(t.z - cz) < d / 2 + .1);   // 2층 시설(청운학사 · 학생회관 · 과학천문관 · 역사관) 2층: 바닥 격자는 1층만 보므로 2층 물건은 그 높이에서 고르기만 본다
      const R = window.__rbg, hy = t.o.rbY, ok2 = up2 ? (() => true) : hy != null && R ? ((px, pz) => { const gg = R.groundAt(px, pz, hy + .1); return gg != null && Math.abs(gg - hy) < .3 && !R.blocked(px, pz, hy, .3); }) : flood(t.f), wd = t.o.done, wl = t.o.locked; if (!t.l) { t.o.done = false; t.o.locked = false; }
      let ok = false;
      for (const rr of [.5, .7, .9, 1.1, 1.3, 1.6]) { for (let a = 0; a < 24 && !ok; a++) { const an = a / 24 * Math.PI * 2, px = t.x + Math.cos(an) * rr, pz = t.z + Math.sin(an) * rr; if (!ok2(px, pz)) continue;
        g.P.floor = t.f; g.P.x = px; g.P.z = pz; g.P.sh = hy ?? 0; g.P.jy = up2 ? 3.85 : ok2.h ? ok2.h(px, pz) : 0; g.P.yaw = Math.atan2(-(t.x - px), -(t.z - pz)); const h = g.findInteract(); if (h && (h.it === t.o || h.p === t.o || h.l === t.o)) ok = true; } if (ok) break; }
      if (!t.l) { t.o.done = wd; t.o.locked = wl; }
      if (!ok) { let why = 'no-floor';   // 진단: 다가설 자리가 없나 · 있는데 다른 것이 골라지나
        for (const rr of [.5, .9, 1.3]) for (let a = 0; a < 24; a++) { const an = a / 24 * Math.PI * 2, px = t.x + Math.cos(an) * rr, pz = t.z + Math.sin(an) * rr; if (!ok2(px, pz)) continue; g.P.floor = t.f; g.P.x = px; g.P.z = pz; g.P.sh = hy ?? 0; g.P.jy = up2 ? 3.85 : ok2.h ? ok2.h(px, pz) : 0; g.P.yaw = Math.atan2(-(t.x - px), -(t.z - pz)); const h = g.findInteract(); why = h ? 'other:' + (h.label || h.type).slice(0, 18) : 'none'; break; }
        out.push(`${t.id} (${t.f}: ${t.x.toFixed(1)}, ${t.z.toFixed(1)}) [${why}]`); }
    }
    return out;
  });
  ok(bad.length === 0, `조사 대상 전부 걸어가서 고를 수 있음${bad.length ? ' — 문제: ' + bad.join(' · ') : ''}`);
  await p.close();
}

async function saveEdgeCases() {
  sec('저장 예외: 캐릭터 유지 · 손상 세이브 백업 복구 · 테스트 세이브 분리');
  const p = await page();
  await E(p, () => { localStorage.clear(); localStorage.setItem('haegyo_char', 'jihun'); }); await p.reload({ waitUntil: 'commit' }); await p.waitForFunction(() => window.__loadTimes, null, { timeout: 180000 }); await ready(p);
  await E(p, () => __g.newGame()); await started(p); await skipIntro(p); await W(p, 400);
  await E(p, () => { __g.state = 'playing'; __g.P.hp = 77; __g.save(); __g.P.hp = 55; __g.save(); localStorage.setItem('haegyo_char', 'seoyeon'); });
  await p.reload({ waitUntil: 'commit' }); await p.waitForFunction(() => window.__loadTimes, null, { timeout: 180000 }); await ready(p);
  await E(p, () => __g.continueGame()); await started(p);
  ok(await E(p, () => __g.CHAR) === 'jihun', '메뉴에서 서연을 골라도 이어하기는 저장된 지훈'); restores++;
  await E(p, () => localStorage.setItem('haegyo_save_v5', '{손상된 데이터'));
  await p.reload({ waitUntil: 'commit' }); await p.waitForFunction(() => window.__loadTimes, null, { timeout: 180000 }); await ready(p);
  await E(p, () => __g.continueGame()); await started(p);
  ok(await E(p, () => __g.P.hp) === 77, '본 세이브 손상 → 백업 세이브(이전 저장)로 복구'); restores++;
  await p.close();
  const t = await page('?debug&test');
  await E(t, () => { localStorage.removeItem('haegyo_save_v5'); __g.start(); }); await W(t, 600);
  await E(t, () => { __g.state = 'playing'; __g.save(); });
  ok(await E(t, () => !!localStorage.getItem('haegyo_test_save_v5') && !localStorage.getItem('haegyo_save_v5')), '테스트 모드 세이브는 별도 키 (실제 세이브 오염 없음)');
  await t.close();
}

// 은폐 엔딩: 마지막 선택 C → 교장실 전화 → 거래 · 혼자 묻기
async function coverRun() {
  sec('은폐 엔딩 (마지막 선택 C → 교장실의 전화)');
  for (const [k, title, fin] of [[0, '침묵의 서약', 'C'], [1, '교장실의 거래', 'C2']]) {
    const p = await page(); await ready(p);
    await E(p, () => { localStorage.removeItem('haegyo_endings'); __g.newGame(); }); await started(p); await skipIntro(p); await p.waitForFunction(() => __g.state === 'note', null, { timeout: 20000 }).catch(() => {}); await closeNote(p); await W(p, 300);   // 인트로를 넘기면 서문일보 호외가 먼저 뜬다
    await E(p, () => { __g.state = 'playing'; __g.winGame(); });
    await p.waitForFunction(() => document.getElementById('choice').classList.contains('show'), null, { timeout: 90000 });   // 소프트웨어 GL: 엔딩 연출 첫 셰이더 컴파일로 30초를 넘기기도 한다
    await E(p, () => document.querySelectorAll('#choiceBtns button')[2].click());
    await W(p, 600); await finalChoice(p, k);
    ok(await E(p, () => document.getElementById('endTag').textContent) === 'COVER-UP END' && await E(p, () => document.getElementById('endTitle').textContent) === title && await E(p, () => __g.FL.final) === fin, `은폐 엔딩 도달 — ${title} (END ${fin})`);
    ok(await E(p, () => JSON.parse(localStorage.getItem('haegyo_endings') || '[]').includes('cover')), '엔딩 기록에 COVER-UP 저장');
    ok(await E(p, () => window.__outroN >= 3), '결말 자료 세 장 (학교 · 경찰 · 뉴스) 표시');
    ok(p.errors === 0, '콘솔 오류 없음'); await p.close();
  }
}

// E2E_ONLY=reach,extras … 처럼 일부만 돌릴 수 있다
const ONLY = (process.env.E2E_ONLY || '').split(',').filter(Boolean), run = (k, f) => !ONLY.length || ONLY.includes(k) ? f() : null;
await run('normal', () => normalRun('jihun'));
await run('normal', () => normalRun('seoyeon'));
await run('true', trueRun);
await run('cover', coverRun);
await run('extras', extrasRun);
await run('reach', reachAudit);
await run('save', saveEdgeCases);
for (const S of SEC) console.log(`  ${S.f ? '✘' : '✔'} ${S.p + S.f}건 (실패 ${S.f}) — ${S.t}`);
console.log(`\n결과: 통과 ${pass} · 실패 ${fail} · 저장/복원 ${restores}회`);
await b.close();
process.exit(fail ? 1 : 0);
