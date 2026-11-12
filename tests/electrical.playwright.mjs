// 전기 배선 점검 (electrical.js): 모든 스위치를 바라보고 [E] 프롬프트가 그 스위치에 잡히는지 → 눌러서 그 회로 등기구가 바뀌는지
//   + 분전반 차단기 · 별관 전원(FL.anPow) · 외등 광센서 · 세이브/복원
// 실행: python3 -m http.server 8765 & PW_CORE=<playwright-core> CHROME=<chromium> [GAME_URL=…] node tests/electrical.playwright.mjs
const pw = await import(process.env.PW_CORE || 'playwright-core');
const URL = process.env.GAME_URL || 'http://localhost:8765/index.html';
const b = await pw.chromium.launch({ executablePath: process.env.CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 480, height: 270 } });
await ctx.route(u => !/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(u.href), r => r.abort());
const p = await ctx.newPage(); let errs = 0; p.on('console', m => { if (m.text().startsWith('brk')) console.log(m.text()); }); p.on('pageerror', e => { errs++; console.log('[pageerror]', e.message); });
p.setDefaultTimeout(180000);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? '  ✔ ' : '  ✘ ') + m); };
try {
  await p.goto(URL + '?debug&norender', { timeout: 180000 }); await p.waitForFunction(() => window.__loadTimes, null, { timeout: 180000, polling: 500 });
  await p.evaluate(() => __g.newGame()); await p.waitForFunction(() => window.__elec && __g.state !== 'menu', null, { timeout: 180000, polling: 500 });
  await p.waitForTimeout(20000);   // 캠퍼스 시설 스위치(늦게 지어짐)까지
  await p.evaluate(() => { __g.state = 'playing'; __g.FL.anPow = true; window.__elec.applyAll(); });
  const res = await p.evaluate(() => {
    const g = __g, E = window.__elec, P = g.P, out = [];
    for (const c of E.circuits) {
      if (c.noSwitch) continue;
      const prop = c.prop || g.world.props.find(q => q.sw && q.sw._c === c); if (!prop) { out.push({ id: c.id, err: 'no prop' }); continue; }
      const pz = c.pose, n = Math.hypot(pz.nx, pz.nz) || 1, nx = pz.nx / n, nz = pz.nz / n;
      P.floor = c.floor ?? 0; P.sh = prop.rbY ?? 0; P.jy = prop.rbY ?? Math.max(0, (prop.y || 1.2) - 1.2); P.x = pz.x + nx * .75; P.z = pz.z + nz * .75; P.yaw = Math.atan2(nx, nz); P.inElev = false;
      const t = g.findInteract(), hit = t && t.p === prop;
      const before = E.fixtureState(c), wasOn = c.type === 'lg' ? !!prop.on : E.swOn(c);
      if (hit) { g.setTarget(t); g.interact(); } else g.useProp(prop);
      const after = E.fixtureState(c), isOn = c.type === 'lg' ? !!prop.on : E.swOn(c);
      const changed = isOn !== wasOn && (isOn ? after.lit > 0 : after.lit === 0) && before.lit !== after.lit;
      // 되돌리기 (원래 상태)
      g.useProp(prop); const back = E.fixtureState(c);
      out.push({ id: c.id, label: c.label, hit, prompt: t && t.label, changed, before: before.lit, after: after.lit, back: back.lit, n: before.n });
    }
    return out;
  });
  const bad = res.filter(r => !r.hit || !r.changed);
  ok(res.length >= 70, `스위치 회로 ${res.length}개`);
  ok(res.filter(r => r.hit).length === res.length, `프롬프트가 그 스위치에 잡힘 ${res.filter(r => r.hit).length}/${res.length}`);
  ok(res.filter(r => r.changed).length === res.length, `눌러서 그 회로 등기구가 바뀜 ${res.filter(r => r.changed).length}/${res.length}`);
  bad.slice(0, 20).forEach(r => console.log('    ·', JSON.stringify(r)));
  // 다른 방 등기구가 같이 켜지지 않는가 (본관 1층 한 방만 켜기)
  ok(await p.evaluate(() => { const E = window.__elec, rb = E.circuits.filter(c => c.type === 'rb'); rb.forEach(c => { if (E.swOn(c)) E.toggle(c); }); const c = rb[0]; E.toggle(c); const others = rb.filter(q => q !== c).every(q => E.fixtureState(q).lit === 0 || q.lamps.some(l => c.lamps.includes(l))); const covers = rb.filter(q => q !== c && q.bld === c.bld).every(q => q.cover.visible); E.toggle(c); return others && covers; }), '한 방 스위치는 그 방 등기구만 (다른 방 발광면은 덮개)');
  // 차단기
  ok(await p.evaluate(async () => { const E = window.__elec, c = E.circuits.find(c => c.type === 'rb' && c.bld === 'main' && c.sw.floor === 0); if (!E.swOn(c)) E.toggle(c); const on1 = E.fixtureState(c).lit; E.setBreaker('main:0F', false); const off = E.fixtureState(c).lit; E.setBreaker('main:0F', true); await new Promise(r => setTimeout(r, 2500)); const on2 = E.fixtureState(c).lit; E.toggle(c); const r = on1 > 0 && off === 0 && on2 > 0; if (!r) console.log("brk", on1, off, on2, __g.RBG._pk, c.flickT); return r; }), '본관 1층 차단기를 내리면 1층 방 등이 꺼지고, 올리면 다시 켜짐');
  ok(await p.evaluate(() => { const E = window.__elec, c = E.circuits.find(c => c.type === 'lg' && c.floor === 4); const p = c.prop; if (!p.on) __g.useProp(p); const a = E.fixtureState(c).lit; E.setBreaker('main:B1', false); const b = E.fixtureState(c).lit; E.setBreaker('main:B1', true); const d = E.fixtureState(c).lit; return a > 0 && b === 0 && d > 0; }), '지하층 차단기가 지하 방 스위치 회로를 끊음');
  ok(await p.evaluate(() => { const E = window.__elec, c = E.circuits.find(c => c.type === 'grp'); if (!E.swOn(c)) E.toggle(c); const a = E.fixtureState(c).lit; E.setBreaker(c.brk.id, false); const b = E.fixtureState(c).lit; E.setBreaker(c.brk.id, true); return a > 0 && b === 0; }), '캠퍼스 시설 차단기');
  // 별관 전원 (가정실 분전반 퍼즐 전)
  ok(await p.evaluate(() => { const E = window.__elec, c = E.circuits.find(c => c.type === 'rb' && c.bld === 'annex'); __g.FL.anPow = false; E.applyAll(); if (!E.swOn(c)) E.toggle(c); const a = E.fixtureState(c).lit; __g.FL.anPow = true; E.applyAll(); const b = E.fixtureState(c).lit; E.toggle(c); return a === 0 && b > 0; }), '별관은 FL.anPow 전에는 스위치를 올려도 꺼져 있음');
  // 외등 광센서
  ok(await p.evaluate(() => { const E = window.__elec, c = E.byId.get('ext:street'); if (!c.lamps.length) return 'no street'; const D = __g.DAY, k0 = D.k; D.k = 0; E.tick(2); const night = E.fixtureState(c).lit; D.k = 1; E.tick(2); const day = E.fixtureState(c).lit; D.k = k0; E.tick(2); return night === c.lamps.length && day === 0; }), '외등: 밤 자동 점등 · 낮 소등');
  // 분전반 UI
  ok(await p.evaluate(() => { const g = __g, q = g.world.props.find(q => q.k === 'elec_panel' && q.bld === 'main'); g.state = 'playing'; g.useProp(q); const o = document.getElementById('elecPanel'), open = o && o.classList.contains('show') && o.querySelectorAll('.elec-row').length >= 5; window.__elec.closePanel(); return open && g.state === 'playing'; }), '본관 분전반 화면 열기 · 닫기');
  // 세이브 → 복원
  const saved = await p.evaluate(() => { const E = window.__elec, c = E.circuits.find(c => c.type === 'rb' && c.bld === 'main'); if (!E.swOn(c)) E.toggle(c); E.setBreaker('main:2F', false); __g.state = 'playing'; __g.save(); return c.id; });
  await p.evaluate(() => { const E = window.__elec; E.circuits.filter(c => c.type === 'rb').forEach(c => { if (E.swOn(c)) E.toggle(c); }); E.setBreaker('main:2F', true); __g.load(); });
  ok(await p.evaluate(id => { const E = window.__elec, c = E.byId.get(id); return E.swOn(c) && E.fixtureState(c).lit > 0 && !E.brkOn([...E.BLD.get('main').brks.values()].find(k => k.id === 'main:2F')); }, saved), '스위치 · 차단기 상태 저장 → 불러오기');
  ok(errs === 0 && !(await p.evaluate(() => window.__frameErrs)), 'pageerror · 프레임 오류 0');
} catch (e) { fail++; console.log('  ✘ 예외', e.message); }
console.log(`\n통과 ${pass} · 실패 ${fail}`); await b.close(); process.exit(fail ? 1 : 0);
