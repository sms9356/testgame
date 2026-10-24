// 브라우저 회귀 테스트 (Playwright) — 엔딩까지의 진행 · 저장/복원 · 캐릭터 · 테스트 세이브 분리
// 실행: python3 -m http.server 8765  (다른 터미널)
//       PW_CORE=<playwright-core 경로> CHROME=<chromium 실행 파일> node tests/e2e.mjs
// 미니게임 조작 자체는 MG.win() 으로 성공 처리하고, 그 결과(보상 · 진행 플래그 · 저장)를 검증한다.
const pw = await import(process.env.PW_CORE || 'playwright-core');
const URL = process.env.GAME_URL || 'http://localhost:8765/index.html';
const b = await pw.chromium.launch({ executablePath: process.env.CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
let pass = 0, fail = 0, restores = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✔', msg); } else { fail++; console.log('  ✘', msg); } };

async function page(qs = process.env.GAME_QS || '?debug') {   // 새 건물 점검: GAME_QS='?debug&rb&norender'
  const p = await (await b.newContext({ viewport: { width: 480, height: 270 } })).newPage();
  p.setDefaultNavigationTimeout(180000); p.setDefaultTimeout(60000);
  p.errors = 0; p.on('pageerror', e => { p.errors++; console.log('   [pageerror]', e.message); });
  await p.goto(URL + qs, { timeout: 180000 }); await p.waitForFunction(() => window.__loadTimes, null, { timeout: 180000 });
  return p;
}
const E = (p, f, a) => p.evaluate(f, a);
// 정문을 연 뒤 마지막 선택(EV-23): 선택지가 뜨면 고른다
async function finalChoice(p, i) {
  await p.waitForFunction(() => document.getElementById('choice').classList.contains('show'), null, { timeout: 30000 });
  await p.evaluate(i => document.querySelectorAll('#choiceBtns button')[i].click(), i);
  await p.waitForFunction(() => document.getElementById('win').classList.contains('show'), null, { timeout: 30000 });
}
const W = (p, t) => p.waitForTimeout(t);
async function ready(p) { await E(p, () => __g.applyQuality('low')); }
// 아이템 줍기 / 장치 사용 (위치로 이동 → 상호작용)
const take = (p, kind, id) => E(p, ([k, id]) => { const it = __g.world.items.find(i => i.kind === k && (id == null || i.id === id || i.idx === id) && !i.taken); if (!it || it.locked) return it ? 'locked' : 'none'; __g.state = 'playing'; __g.P.floor = it.floor; __g.P.x = it.pos.x; __g.P.z = it.pos.z + .8; __g.P.sh = it.rbY ?? __g.P.sh; __g.setTarget({ type: 'item', it, label: '' }); __g.interact(); return 'ok'; }, [kind, id]);
const use = (p, kind, i = 0) => E(p, ([k, i]) => { const s = __g.world.props.filter(q => q.kind === k)[i]; __g.state = 'playing'; __g.P.floor = s.floor; __g.P.x = s.x; __g.P.z = s.z + .9; __g.P.sh = s.rbY ?? __g.P.sh; __g.useProp(s); return s.label; }, [kind, i]);
const winMini = async p => { for (let i = 0; i < 20 && !(await E(p, () => __g.MG.active)); i++) await W(p, 150); await E(p, () => __g.MG.win()); await W(p, 1000); await E(p, () => { if (__g.state === 'note' || __g.state === 'ui') __g.state = 'playing'; }); };
const closeNote = p => E(p, () => { if (__g.state === 'note') { document.getElementById('noteBox').click(); } __g.state = 'playing'; });
async function saveReload(p, label) {
  await E(p, () => { __g.state = 'playing'; __g.save(); });
  await p.reload(); await p.waitForFunction(() => window.__loadTimes, null, { timeout: 180000 }); await ready(p);
  await E(p, () => __g.continueGame()); await W(p, 700); await E(p, () => { __g.state = 'playing'; });
  restores++; return label;
}

async function normalRun(char) {
  console.log(`\n■ ${char} — 처음부터 NORMAL 엔딩 (+ 저장/복원)`);
  const p = await page();
  await E(p, c => { localStorage.clear(); localStorage.setItem('haegyo_char', c); }, char); await p.reload(); await p.waitForFunction(() => window.__loadTimes, null, { timeout: 180000 }); await ready(p);
  await E(p, () => __g.newGame()); await W(p, 600); await p.keyboard.press('Space'); await W(p, 500);
  ok(await E(p, () => __g.CHAR) === char, `주인공 ${char}`);
  await E(p, () => { __g.P.z = -1; });
  ok(await take(p, 'camcorder') === 'ok', '캠코더 획득'); await W(p, 300);
  await saveReload(p, '캠코더 후'); ok(await E(p, () => __g.FL.cam) && await E(p, () => __g.CHAR) === char, '복원: 캠코더 · 캐릭터 유지');
  await take(p, 'note', 'n3'); await closeNote(p);
  // 금고: 연 직후(열쇠 줍기 전) 저장 → 복원 → 줍기 (P0)
  await use(p, 'safe'); await W(p, 300); for (const k of '1012') await p.keyboard.press('Digit' + k);
  await p.waitForFunction(() => __g.world.props.find(q => q.kind === 'safe').done && __g.state === 'playing', null, { timeout: 20000 }).catch(() => {}); await W(p, 300);
  await saveReload(p, '금고 연 직후');
  ok(await E(p, () => { const k = __g.world.items.find(i => i.kind === 'key' && i.idx === 0); return !k.locked && k.mesh.visible && !k.taken; }), '복원: 금고 안 열쇠가 잠기지 않고 보임 (P0)');
  ok(await take(p, 'key', 0) === 'ok' && await E(p, () => __g.P.keys) === 1, '첫 열쇠 조각 획득');
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
  await p.keyboard.press('KeyE'); await finalChoice(p, 2);
  ok(await E(p, () => __g.state) === 'won' && (await E(p, () => document.getElementById('endTag').textContent)) === 'NORMAL END', 'NORMAL 엔딩 도달');
  ok(await E(p, () => __g.FL.final) === 'C' && (await E(p, () => document.getElementById('winText').textContent)).includes('END C'), '마지막 선택 C (은폐) 후일담');
  ok(p.errors === 0, '콘솔 오류 없음'); await p.close();
}

async function trueRun() {
  console.log('\n■ TRUE 엔딩 경로 (명찰 → 퓨즈 · 차단기 → 마지막 방송 → 민아)');
  const p = await page();
  await E(p, () => { localStorage.clear(); localStorage.setItem('haegyo_char', 'seoyeon'); }); await p.reload(); await p.waitForFunction(() => window.__loadTimes, null, { timeout: 180000 }); await ready(p);
  await E(p, () => __g.newGame()); await W(p, 600); await p.keyboard.press('Space'); await W(p, 500);
  await take(p, 'nametag'); ok(await E(p, () => __g.FL.tag), '명찰');
  await saveReload(p, '명찰 후'); ok(await E(p, () => __g.FL.tag && __g.FL.opt), '복원: 명찰 · 특별 목표');
  await use(p, 'breaker'); ok(!(await E(p, () => __g.power)), '퓨즈 없이 차단기 불가');
  await take(p, 'fuse'); await use(p, 'breaker'); await winMini(p); ok(await E(p, () => __g.power), '퓨즈 + 배선 → 전력 복구');
  await saveReload(p, '전력 후'); ok(await E(p, () => __g.power) && await E(p, () => __g.world.props.find(q => q.kind === 'breaker').on), '복원: 차단기 켜짐');
  await use(p, 'console'); await winMini(p); ok(await E(p, () => __g.FL.tapesDone), '마지막 방송: 녹음 순서 복원');
  await W(p, 16000); ok(await E(p, () => __g.FL.calm && !__g.ghost.active), '하교 방송 → 그것이 사라짐');
  await saveReload(p, '방송 후'); ok(await E(p, () => __g.FL.calm && !__g.ghost.active), '복원: 방송 완료 · 그것 비활성');
  await use(p, 'mina'); await W(p, 4000); ok(await E(p, () => __g.FL.mina), '민아 깨우기');
  await saveReload(p, '민아 후'); ok(await E(p, () => __g.FL.mina) && await E(p, () => !__g.mina.visible), '복원: 민아 구출');
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
  console.log('\n■ 사물함 수색 · 수집품 · 소모품 · 방 미니게임 · 칠판 · 초자연 현상');
  const p = await page();
  await E(p, () => { localStorage.clear(); localStorage.setItem('haegyo_char', 'jihun'); }); await p.reload(); await p.waitForFunction(() => window.__loadTimes, null, { timeout: 180000 }); await ready(p);
  await E(p, () => __g.newGame()); await W(p, 600); await p.keyboard.press('Space'); await W(p, 500); await E(p, () => { __g.ghost.active = false; });
  ok(await E(p, () => __g.world.props.filter(q => q.kind === 'search').length) >= 40 && await E(p, () => __g.world.props.filter(q => q.kind === 'mspot').length) >= 10, '수색 지점 40곳 이상 · 방 미니게임 10곳 이상');
  // 수집품이 든 사물함 3곳을 실제로 뒤진다 (가만히 1.1초)
  const n = await E(p, async () => { let k = 0; for (const q of __g.world.props.filter(q => q.kind === 'search' && q.loot && q.loot.col).slice(0, 3)) { __g.state = 'playing'; __g.tp(q.x, q.z + (q.where === '복도' ? .7 : q.z < 0 ? -.5 : .5), q.floor, 0, 0); __g.startSearch(q); if (__g.XT.search) __g.XT.search.t = 1.09; const t0 = performance.now(); while (__g.XT.search && performance.now() - t0 < 8000) await new Promise(r => setTimeout(r, 50)); if (q.done) k++; } return k; });
  ok(n === 3 && await E(p, () => Object.keys(__g.FL.col || {}).length) === 3, '사물함 수색 → 수집품 3개');
  await E(p, () => { const q = __g.world.props.find(o => o.uid === 'ms:lab'); __g.state = 'playing'; __g.tp(q.x, q.z + 1.2, q.floor, 0, 0); __g.useMiniSpot(q); }); await winMini(p);
  ok(await E(p, () => __g.FL.ms && __g.FL.ms.lab === 1 && __g.inv.salt >= 2), '과학실 미니게임(타이밍) → 굵은 소금');
  await E(p, () => { const q = __g.world.props.find(o => o.uid === 'ms:music'); __g.state = 'playing'; __g.tp(q.x, q.z + 1.2, q.floor, 0, 0); __g.useMiniSpot(q); }); await winMini(p);
  ok(await E(p, () => __g.FL.col.c07 === 1), '음악실 미니게임(순서 따라 하기) → 수집품');
  await E(p, () => { const q = __g.world.props.find(o => o.kind === 'chalk'); __g.state = 'playing'; __g.tp(q.x, q.z + 1.4, q.floor, 0, 0); __g.openChalk(q); __g.chalkAsk(0); }); await W(p, 3500);
  ok(await E(p, () => __g.FL.chalk >= 1), '칠판에 질문 → 대답'); await E(p, () => { document.getElementById('chalkClose').click(); __g.state = 'playing'; });
  ok(await E(p, () => { __g.state = 'playing'; return ['door', 'lights', 'shadow', 'cold', 'phone'].every(k => __g.paraEvent(k)); }), '초자연 현상 5종 발생');
  ok(await E(p, () => { __g.state = 'playing'; __g.tp(-8, -5, 0, 0, 0); return ['steps', 'scream', 'thump', 'chair', 'torch', 'hands', 'eyes', 'bell', 'radio', 'rattle', 'bleed', 'count', 'heart', 'glass'].every(k => __g.paraEvent(k)); }), '새 초자연 현상 14종 발생');
  // 화장실 괴담: 6종 + 3번 칸의 질문(침묵 → 노란 부적), 선택은 저장된다
  await E(p, () => { __g.state = 'playing'; __g.tp(-31.2, -5.4, 0, -Math.PI / 2, 0); const r = __g.roomAt(0, -31.2, -5.4); ['faucet', 'flush', 'shoes', 'mirror', 'stall', 'flicker'].forEach(k => __g.toiletFx(k, 0, r)); __g.toiletFx('tissue', 0, r); });
  await p.waitForFunction(() => document.getElementById('choice').classList.contains('show'), null, { timeout: 120000 });
  const charm0 = await E(p, () => __g.inv.charm || 0); await p.keyboard.press('Digit3');
  await p.waitForFunction(c => (__g.inv.charm || 0) > c, charm0, { timeout: 120000 });
  ok(await E(p, () => __g.FL.redblue === 3 && __g.tmpFx.length > 0), '화장실 괴담 7종 · 빨간 휴지 파란 휴지(침묵 → 노란 부적)');
  ok(await E(p, () => { __g.state = 'playing'; const i = __g.inv; i.can = 2; i.tape = 1; i.battery = 1; i.medkit = 1; i.sedative = 1; __g.tryCombine('can', 'tape'); __g.tryCombine('battery', 'can'); __g.tryCombine('medkit', 'sedative'); __g.P.hp = 40; __g.useFirstAid(); __g.tp(0, 0, 0, 0, 0); __g.placeAlarm(); return i.alarm === 0 && i.shock === 1 && i.firstaid === 0 && __g.P.hp === 100 && __g.craftingSystem.activeTraps.length === 1; }), '조합 3종 (CraftingSystem: 경보 함정 설치 · 쇼트 폭탄 · 응급 처치 키트)');
  ok(await E(p, () => { __g.state = 'playing'; __g.camMode(true); const on = __g.CAM.on && __g.camera.layers.isEnabled(2); __g.P.pbat = 100; const b0 = __g.P.pbat; __g.camShoot(); const shot = __g.P.pbat <= b0 - 19.9; const ov = document.body.classList.contains('ghost-cam-active'); __g.camMode(false); return on && ov && shot && !__g.camera.layers.isEnabled(2) && __g.CAM.clues.length > 50 && __g.ghostCam.hiddenClues.length === 3; }), '심령 카메라 (GhostCameraSystem: 숨은 단서 레이어 · 플래시 촬영)');
  ok(await E(p, () => { __g.state = 'playing'; __g.setBreaker(0, true); const on = __g.BRK[0].on; __g.setBreaker(0, false); __g.schoolPower.chimeTimer = 0; return on && __g.world.props.filter(q => q.kind === 'cbreaker').length === 7 && __g.schoolPower.powerBoxes.length === 7; }), '배전반 7곳 (SchoolPowerEventSystem) · 차임벨');
  ok(await E(p, () => { __g.state = 'playing'; const W = __g.world, sinks = W.props.filter(q => q.kind === 'sink'), fl = W.props.filter(q => q.kind === 'flush'), st = W.lockers.filter(l => l.stallDoor), lk = W.doorList.filter(d => d.locked);
    const s0 = sinks.find(q => q.floor === 0); __g.P.fear = .5; __g.useSink(s0); __g.useSink(s0); __g.useSink(s0); const f3 = __g.P.fear; __g.useFlush(fl[0]);
    const l = st.find(o => o.floor === 0); __g.enterLocker(l); const closed = l.stallDoor.target === 0; __g.leaveLocker(true); const reopened = l.stallDoor.target === 1;
    return sinks.length >= 24 && fl.length > 10 && st.length === fl.length && lk.length >= 3 && closed && reopened && s0.sinkObj.uses === 3 && Math.abs(f3 - .5) > .01; }), '남/녀 화장실 (RestroomSystem 세면대 · 변기 물 내리기 · 칸막이 은신 · 잠긴 3번 칸)');
  ok(await E(p, () => { __g.state = 'playing'; __g.inv.charm = 1; __g.P.invuln = 0; __g.ghost.active = true; __g.ghost.floor = __g.P.floor; __g.ghost.x = __g.P.x + 1; __g.ghost.z = __g.P.z; const hp = __g.P.hp; __g.hit(); const r = __g.P.hp === hp && __g.inv.charm === 1; __g.ghost.active = false; return r; }), '유령 접촉은 체력과 부적을 소모하지 않음');
  await saveReload(p, '수색 후'); ok(await E(p, () => Object.keys(__g.FL.col).length === 4 && __g.world.props.filter(q => q.kind === 'search' && q.done).length === 3 && __g.FL.ms.lab === 1), '복원: 수집품 · 뒤진 사물함 · 미니게임 보답');
  ok(p.errors === 0, '콘솔 오류 없음'); await p.close();
}


// 도달성 감사: 모든 문을 연 상태에서 바닥을 격자로 채워(플레이어 반지름 0.3m · 0.4m 이하 단은 올라섬) 복도에서 걸어갈 수 있는 곳을 구하고,
// 모든 아이템 · 장치 · 의뢰 · 수색 · 미니게임 · 칠판 · 숨는 사물함을 '걸어갈 수 있는 자리에서 바라보고 E' 로 고를 수 있는지 확인한다.
// 예외: 잠긴 보관함 · 금고 · 서랍 속 물건(먼저 열어야 함), 철제 덮개로만 들어가는 비밀 자료실
async function reachAudit() {
  console.log('\n■ 도달성 감사 (막힌 통로 · 가려진 조사 지점)');
  const p = await page();
  await E(p, () => { localStorage.clear(); __g.newGame(); }); await W(p, 800); await p.keyboard.press('Space'); await W(p, 600);
  const bad = await E(p, () => {
    const g = __g, out = []; g.ghost.active = false; g.state = 'playing'; if (window.__rbRel) window.__rbRel();   // 새 건물: 방금 생긴 조사 지점까지 옮긴 뒤 점검
    g.world.doorList.forEach(d => { if (d.rect) d.rect.off = true; });
    g.floors.forEach(F => F && F.col.forEach(c => { if (c.gate) c.off = true; }));   // 미션으로 여는 문(옥상 녹슨 철문 등)도 열린 것으로
    const SEEDS = { 0: [[0.8, -11.2]], 4: [[18, -16]] };   // 순간이동 문으로만 들어가는 공간 (본관 ↔ 별관 실내 연결복도)
    const S = .2, r = .3, FF = {};
    const AREA = { 0: [-100, 100, -100, 90, [0, 40]], 1: [-36, 36, -10, 10, [4, 0]], 2: [-36, 36, -10, 10, [4, 0]], 3: [-36, 36, -10, 10, [0, -6]], 4: [-36, 36, -36, 10, [4, 0]], 5: [27, 49, 7, 31, [38, 27]], 6: [-50, -30, 22, 58, [-35.5, 38]], 7: [-49, -29, 7, 23, [-39, 20]], 8: [-21, 21, -10, 10, [-15.2, -5.2]], 9: [-21, 21, -10, 10, [-15.2, -5.2]], 10: [-21, 21, -10, 10, [-15.2, -5.2]] };
    const flood = f => { if (FF[f]) return FF[f]; const F = g.floors[f]; const [x0, x1, z0, z1, [sx, sz]] = AREA[f]; const nx = Math.round((x1 - x0) / S), nz = Math.round((z1 - z0) / S);
      const blocked = (x, z) => F.col.some(c => !c.off && !(c.h != null && c.h <= .4) && x > c.x1 - r && x < c.x2 + r && z > c.z1 - r && z < c.z2 + r);
      const seen = new Uint8Array(nx * nz), q = [];
      for (const [ax, az] of [[sx, sz], ...(SEEDS[f] || [])]) { let si = Math.round((ax - x0) / S), sk = Math.round((az - z0) / S);
      outer: for (let d = 0; d < 20; d++) for (let a = -d; a <= d; a++) for (const [i, k] of [[si + a, sk - d], [si + a, sk + d], [si - d, sk + a], [si + d, sk + a]]) if (i >= 0 && k >= 0 && i < nx && k < nz && !blocked(x0 + i * S, z0 + k * S)) { si = i; sk = k; break outer; }
      seen[sk * nx + si] = 1; q.push([si, sk]); }
      while (q.length) { const [i, k] = q.pop(); for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, c = k + dk; if (a < 0 || c < 0 || a >= nx || c >= nz) continue; const id = c * nx + a; if (seen[id]) continue; if (blocked(x0 + a * S, z0 + c * S)) { seen[id] = 2; continue; } seen[id] = 1; q.push([a, c]); } }
      return FF[f] = (x, z) => { const i = Math.round((x - x0) / S), k = Math.round((z - z0) / S); return i >= 0 && k >= 0 && i < nx && k < nz && seen[k * nx + i] === 1; }; };
    const T = [];
    g.world.items.forEach(it => { if (!it.taken && it.kind !== 'key' && it.id !== 'n27') T.push({ o: it, f: it.floor, x: it.pos.x, z: it.pos.z, id: it.kind + ':' + (it.id ?? '') }); });
    g.world.props.forEach(q => { if (q.kind !== 'switch' && q.minSh == null && !q.after && !(q.kind === 'tape' && q.id === 'tape5')) T.push({ o: q, f: q.floor, x: q.x, z: q.z, id: q.kind + ':' + (q.uid || q.k || '') }); });
    g.world.lockers.forEach((l, i) => { if (!l.noPick) T.push({ o: l, f: l.floor, x: l.x, z: l.z, id: 'locker:' + i, l: true }); });   // noPick: 국솥 · 청소도구함은 자기 조사 지점으로 숨는다
    for (const t of T) {
      if (!AREA[t.f]) continue;
      if (window.__rbg && [1, 2, 8, 9, 10].includes(t.f)) continue;   // 새 건물: 예전 층에 남겨 둔(쓰지 않는) 장치는 점검 대상 아님
      // 새 건물(기본): 옮긴 대상은 그 층 높이(rbY)에서 — 바닥이 그 높이이고 막히지 않은 자리 (층 사이 연결은 rebuild 보행 감사가 따로 본다)
      const R = window.__rbg, hy = t.o.rbY, ok2 = hy != null && R ? ((px, pz) => { const gg = R.groundAt(px, pz, hy + .1); return gg != null && Math.abs(gg - hy) < .3 && !R.blocked(px, pz, hy, .3); }) : flood(t.f), wd = t.o.done, wl = t.o.locked; if (!t.l) { t.o.done = false; t.o.locked = false; }
      let ok = false;
      for (const rr of [.5, .7, .9, 1.1, 1.3, 1.6]) { for (let a = 0; a < 24 && !ok; a++) { const an = a / 24 * Math.PI * 2, px = t.x + Math.cos(an) * rr, pz = t.z + Math.sin(an) * rr; if (!ok2(px, pz)) continue;
        g.P.floor = t.f; g.P.x = px; g.P.z = pz; g.P.sh = hy ?? 0; g.P.yaw = Math.atan2(-(t.x - px), -(t.z - pz)); const h = g.findInteract(); if (h && (h.it === t.o || h.p === t.o || h.l === t.o)) ok = true; } if (ok) break; }
      if (!t.l) { t.o.done = wd; t.o.locked = wl; }
      if (!ok) out.push(`${t.id} (${t.f}: ${t.x.toFixed(1)}, ${t.z.toFixed(1)})`);
    }
    return out;
  });
  ok(bad.length === 0, `조사 대상 전부 걸어가서 고를 수 있음${bad.length ? ' — 문제: ' + bad.join(' · ') : ''}`);
  await p.close();
}

async function saveEdgeCases() {
  console.log('\n■ 저장 예외: 캐릭터 유지 · 손상 세이브 백업 복구 · 테스트 세이브 분리');
  const p = await page();
  await E(p, () => { localStorage.clear(); localStorage.setItem('haegyo_char', 'jihun'); }); await p.reload(); await p.waitForFunction(() => window.__loadTimes, null, { timeout: 180000 }); await ready(p);
  await E(p, () => __g.newGame()); await W(p, 600); await p.keyboard.press('Space'); await W(p, 400);
  await E(p, () => { __g.state = 'playing'; __g.P.hp = 77; __g.save(); __g.P.hp = 55; __g.save(); localStorage.setItem('haegyo_char', 'seoyeon'); });
  await p.reload(); await p.waitForFunction(() => window.__loadTimes, null, { timeout: 180000 }); await ready(p);
  await E(p, () => __g.continueGame()); await W(p, 600);
  ok(await E(p, () => __g.CHAR) === 'jihun', '메뉴에서 서연을 골라도 이어하기는 저장된 지훈'); restores++;
  await E(p, () => localStorage.setItem('haegyo_save_v5', '{손상된 데이터'));
  await p.reload(); await p.waitForFunction(() => window.__loadTimes, null, { timeout: 180000 }); await ready(p);
  await E(p, () => __g.continueGame()); await W(p, 600);
  ok(await E(p, () => __g.P.hp) === 77, '본 세이브 손상 → 백업 세이브(이전 저장)로 복구'); restores++;
  await p.close();
  const t = await page('?debug&test');
  await E(t, () => { localStorage.removeItem('haegyo_save_v5'); __g.start(); }); await W(t, 600);
  await E(t, () => { __g.state = 'playing'; __g.save(); });
  ok(await E(t, () => !!localStorage.getItem('haegyo_test_save_v5') && !localStorage.getItem('haegyo_save_v5')), '테스트 모드 세이브는 별도 키 (실제 세이브 오염 없음)');
  await t.close();
}

// E2E_ONLY=reach,extras … 처럼 일부만 돌릴 수 있다
const ONLY = (process.env.E2E_ONLY || '').split(',').filter(Boolean), run = (k, f) => !ONLY.length || ONLY.includes(k) ? f() : null;
await run('normal', () => normalRun('jihun'));
await run('normal', () => normalRun('seoyeon'));
await run('true', trueRun);
await run('extras', extrasRun);
await run('reach', reachAudit);
await run('save', saveEdgeCases);
console.log(`\n결과: 통과 ${pass} · 실패 ${fail} · 저장/복원 ${restores}회`);
await b.close();
process.exit(fail ? 1 : 0);
