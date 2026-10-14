// 브라우저 회귀 테스트 (Playwright) — 엔딩까지의 진행 · 저장/복원 · 캐릭터 · 테스트 세이브 분리
// 실행: python3 -m http.server 8765  (다른 터미널)
//       PW_CORE=<playwright-core 경로> CHROME=<chromium 실행 파일> node tests/e2e.mjs
// 미니게임 조작 자체는 MG.win() 으로 성공 처리하고, 그 결과(보상 · 진행 플래그 · 저장)를 검증한다.
const pw = await import(process.env.PW_CORE || 'playwright-core');
const URL = process.env.GAME_URL || 'http://localhost:8765/index.html';
const b = await pw.chromium.launch({ executablePath: process.env.CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
let pass = 0, fail = 0, restores = 0;
const ok = (cond, msg) => { if (cond) { pass++; console.log('  ✔', msg); } else { fail++; console.log('  ✘', msg); } };

async function page(qs = '?debug') {
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
const take = (p, kind, id) => E(p, ([k, id]) => { const it = __g.world.items.find(i => i.kind === k && (id == null || i.id === id || i.idx === id) && !i.taken); if (!it || it.locked) return it ? 'locked' : 'none'; __g.state = 'playing'; __g.P.floor = it.floor; __g.P.x = it.pos.x; __g.P.z = it.pos.z + .8; __g.setTarget({ type: 'item', it, label: '' }); __g.interact(); return 'ok'; }, [kind, id]);
const use = (p, kind, i = 0) => E(p, ([k, i]) => { const s = __g.world.props.filter(q => q.kind === k)[i]; __g.state = 'playing'; __g.P.floor = s.floor; __g.P.x = s.x; __g.P.z = s.z + .9; __g.useProp(s); return s.label; }, [kind, i]);
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
  await use(p, 'safe'); await W(p, 300); for (const k of '1012') await p.keyboard.press('Digit' + k); await W(p, 1500);
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
  await E(p, () => __g.makeGateKey()); await W(p, 2500); await E(p, () => { __g.ghost.active = false; __g.ghost.enraged = false; });
  await saveReload(p, '정문 열쇠 후'); ok(await E(p, () => __g.FL.gatekey) && await E(p, () => __g.objective().ch) === 5, '복원: 정문 열쇠 · 제5장');
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
  await E(p, () => { __g.world.items.filter(i => i.kind === 'key').forEach(i => { if (!i.taken) { i.locked = false; __g.setTarget({ type: 'item', it: i }); __g.state = 'playing'; __g.interact(); } }); __g.makeGateKey(); });
  await W(p, 2500); ok(!(await E(p, () => __g.ghost.enraged)), '방송 후엔 최종 추격 없음');
  await E(p, () => { __g.state = 'playing'; __g.P.floor = 0; __g.P.x = 0; __g.P.z = 67; __g.P.yaw = Math.PI; });
  await p.evaluate(s => new Promise(r => { const t0 = __g.tNow; const f = () => { if (__g.tNow - t0 >= s) r(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), .4);
  await p.keyboard.press('KeyE'); await finalChoice(p, 1);
  ok((await E(p, () => document.getElementById('endTag').textContent)) === 'TRUE END', 'TRUE 엔딩 도달');
  ok(await E(p, () => __g.FL.final) === 'B', '마지막 선택 B (민아와 함께) 후일담');
  ok(p.errors === 0, '콘솔 오류 없음'); await p.close();
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

await normalRun('jihun');
await normalRun('seoyeon');
await trueRun();
await saveEdgeCases();
console.log(`\n결과: 통과 ${pass} · 실패 ${fail} · 저장/복원 ${restores}회`);
await b.close();
process.exit(fail ? 1 : 0);
