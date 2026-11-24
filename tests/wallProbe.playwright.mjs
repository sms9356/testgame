// 벽 점검 (?debug&norender): ① 벽걸이 장치가 벽 장식(게시물 · 시계 · 게시판)과 겹치지 않고, 두 번 불러도 같은 자리인지
//                            ② 실제 이동 · 충돌 코드(updatePlayer)로 본관 복도 벽 전부와 방 벽 표본을 향해 걸어 벽을 통과하지 못하는지
// 실행: python3 -m http.server 8765 → PW_CORE=<playwright-core> CHROME=<chromium> node tests/wallProbe.playwright.mjs
const { chromium } = await import(process.env.PW_CORE || 'playwright-core');
const URL = (process.env.GAME_URL || 'http://localhost:8765/index.html') + '?debug&norender';
const b = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let fail = 0; const check = (name, v, extra = '') => { console.log((v ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); if (!v) fail++; };

async function load() {
  const ctx = await b.newContext({ viewport: { width: 480, height: 270 } });
  await ctx.route(u => !/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(u.href), r => r.abort());
  const p = await ctx.newPage(); p.setDefaultTimeout(240000);
  p.on('pageerror', e => console.log('  [pageerror]', e.message));
  await p.goto(URL, { timeout: 240000 }); await p.waitForFunction(() => window.__loadTimes, null, { polling: 500 });
  await p.waitForFunction(() => window.__modelsDone, null, { polling: 500, timeout: 300000 });
  await p.evaluate(() => { localStorage.clear(); __g.newGame(); });
  await p.waitForTimeout(2500); await p.keyboard.press('Space'); await p.waitForTimeout(500);
  await p.evaluate(() => { __g.state = 'playing'; __g.ghost.active = false; });
  await p.waitForTimeout(9000);   // 조사 게시판(2.5초) · 생활 상호작용(5초) 이 벽 장식을 등록할 때까지
  await p.evaluate(() => { __g.state = 'playing'; window.__rbRel && window.__rbRel(); });
  return { p, ctx };
}
const devices = p => p.evaluate(() => {
  const g = __g, T = g.THREE, R = g.RBG, deco = R.wallDeco || [], out = [], hits = [];
  for (const q of g.world.props) { const o = q.anim && q.anim.g; if (!o || !o.userData.wallDev || q._drop) continue;
    const bb = new T.Box3().setFromObject(o); const key = (q.k || '') + '|' + (q.label || '') + '|' + (q.uid || '');
    out.push(key + '@' + o.position.x.toFixed(2) + ',' + o.position.y.toFixed(2) + ',' + o.position.z.toFixed(2));
    for (const d of deco) if (bb.max.x > d.x1 && bb.min.x < d.x2 && bb.max.z > d.z1 && bb.min.z < d.z2 && bb.max.y > d.y1 && bb.min.y < d.y2) hits.push(key + ' × ' + d.id); }
  return { list: out.sort(), hits, deco: deco.length };
});
const walk = (p, bk = 'MAIN') => p.evaluate(bk => {
  const g = __g, P = g.P, B = g.RBG[bk], FH = B.spec.FH, L = B.layout, res = { n: 0, leaks: [] };
  const key = (c, d) => dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c, key: c, bubbles: true }));
  const nearDoor = (lx, lz, f) => B.doors.some(d => d.floor === f && Math.hypot(d.mx - lx, d.mz - lz) < 1.3) || (L.rooms || []).some(r => /stair/.test(r.kind) && lx > r.x1 - .8 && lx < r.x2 + .8);
  // 시작점에서 (nx,nz) 방향 1.6m 안의 첫 번째 '실제 벽' 충돌 상자 (키 큰 · 얇은 · 문 아님)
  const wallOn = (f, sx, sz, nx, nz) => { let best = null, bd = 1.6; for (const c of B.col) { if (c.door || c.y1 == null || c.y1 > f * FH + .3 || c.y2 < f * FH + 1.8) continue;
      if (nx) { if ((c.x2 - c.x1) > .45 || sz < c.z1 + .35 || sz > c.z2 - .35) continue; const d = (nx > 0 ? c.x1 - sx : sx - c.x2); if (d > -.01 && d < bd) { bd = d; best = c; } }
      else { if ((c.z2 - c.z1) > .45 || sx < c.x1 + .35 || sx > c.x2 - .35) continue; const d = (nz > 0 ? c.z1 - sz : sz - c.z2); if (d > -.01 && d < bd) { bd = d; best = c; } } }
    return best; };
  const probe = (f, sx, sz, nx, nz, tag) => {
    const c = wallOn(f, sx, sz, nx, nz); if (!c) return; const far = nx > 0 ? c.x2 : nx < 0 ? c.x1 : nz > 0 ? c.z2 : c.z1;
    if (nearDoor(nx ? far : sx, nx ? sz : far, f)) return;
    const [wx, wz] = B.toWorld(sx, sz), [tx, tz] = B.toWorld(sx + nx, sz + nz);
    g.state = 'playing'; P.floor = 0; P.x = wx; P.z = wz; P.sh = P.shV = f * FH; P.jy = P.jyV = P.vy = 0; P.inElev = false; P.hiding = null; P.sitting = null; P.crouch = false; P.runOn = false;
    P.yaw = Math.atan2(-(tx - wx), -(tz - wz)); P.pitch = 0; key('ShiftLeft', true); key('KeyW', true);
    for (let i = 0; i < 150; i++) g.updatePlayer(1 / 60);
    key('KeyW', false); key('ShiftLeft', false); for (let i = 0; i < 20; i++) g.updatePlayer(1 / 60);
    const [lx, lz] = B.toLocal(P.x, P.z), past = nx ? (lx - far) * nx : (lz - far) * nz;
    res.n++; if (past > 0 || Math.abs((P.sh || 0) - f * FH) > 1) res.leaks.push({ tag, f, from: [+sx.toFixed(2), +sz.toFixed(2)], to: [+lx.toFixed(2), +lz.toFixed(2)], wall: +far.toFixed(2), sh: +(P.sh || 0).toFixed(2) });
  };
  const rooms = B.props.filter(r => r.kind === 'room');
  for (let f = 0; f < B.spec.floors; f++) {
    // 복도: 각 방 앞 복도 쪽 벽 — 방 직사각형의 복도 쪽 변 바깥 1m 에서 방 쪽으로 (문 · 계단 제외)
    for (const r of rooms.filter(r => r.floor === f)) {
      const north = r.z2 < (L.zC ?? 0) + .5, wz = north ? r.z2 : r.z1, dir = north ? -1 : 1;   // 복도에서 방으로 가는 방향
      for (let x = r.x1 + .6; x < r.x2 - .5; x += 1.0) { probe(f, x, wz - dir * 1.0, 0, dir, '복도→' + r.label); }
    }
    // 복도 반대쪽(북쪽 바깥) 벽 · 양 끝 벽: 복도 길이 전체를 1m 간격으로
    for (let x = -L.L / 2 + .8; x < L.L / 2 - .8; x += 1.0) probe(f, x, L.zN + 1.0, 0, -1, '복도 북벽');
    for (const sx of [-1, 1]) for (let z = L.zN + .5; z < (L.zC ?? 0) - .3; z += .7) probe(f, sx * (L.L / 2 - 1.0), z, sx, 0, '복도 끝벽');
    // 방 벽 표본: 방마다 네 벽 가운데 (문 · 개구부 · 창 제외)
    for (const r of rooms.filter(r => r.floor === f)) { const cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2;
      for (const [nx, nz, ax, w, px, pz] of [[-1, 0, 'x', r.x1, r.x1, cz + .7], [1, 0, 'x', r.x2, r.x2, cz - .7], [0, -1, 'z', r.z1, cx + 1.1, r.z1], [0, 1, 'z', r.z2, cx - 1.1, r.z2]]) {
        probe(f, px - nx * 1.0, pz - nz * 1.0, nx, nz, '방→' + r.label + (ax === 'x' ? (nx < 0 ? ' 서벽' : ' 동벽') : (nz < 0 ? ' 북벽' : ' 남벽'))); } }
  }
  return res;
}, bk);
// ③ 시설 · 실내 층: 그 층 충돌 상자 중 '벽'(얇고 · 키 큰 · 높이 제한 없는 것) 전부를 양쪽에서 1m 간격으로 향해 걷는다
//   시설(2층 건물)은 floors[0].col 의 maxY(1층) / y0(2층) 로 층을 나누고, 2층은 P.jy = FH 에서 (위층 바닥판 위) 걷는다
const ZONES = { 청운학사: [-86, -42, 22, 14, 2], 학생회관: [-88, 42, 22, 14, 2], 대강당: [-50, 41.8, 18, 24, 1], 과학천문관: [-88, 14, 20, 16, 2], 역사관: [-88, -16, 15.6, 10.6, 2], 식당외관: [-61, 13, 12.5, 18, 1], 수영장외관: [58, 35, 14, 20, 1], 체육관외관: [84, -39, 20, 22, 1] };
const walkCols = (p, spec) => p.evaluate(spec => {
  const g = __g, P = g.P, res = { n: 0, leaks: [], fell: 0 }, FH = 3.6;
  const key = (c, d) => dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c, key: c, bubbles: true }));
  const F = g.floors[spec.floor], [x1, x2, z1, z2] = spec.rect;
  const lvlOf = c => c.y0 != null ? (c.y0 >= FH - .3 ? 1 : 0) : c.maxY != null ? 0 : -1;   // -1: 모든 층
  const walls = F.col.filter(c => !c.off && c.h == null && !(c.y0 > FH + 1) && Math.min(c.x2 - c.x1, c.z2 - c.z1) <= .45 && Math.max(c.x2 - c.x1, c.z2 - c.z1) >= .9 && (c.x1 + c.x2) / 2 > x1 && (c.x1 + c.x2) / 2 < x2 && (c.z1 + c.z2) / 2 > z1 && (c.z1 + c.z2) / 2 < z2);
  const hitAny = (x, z, jy, lv) => F.col.some(c => !c.off && !(c.h != null && c.h <= jy + .34) && !(c.y0 != null && jy + 1.5 < c.y0) && !(c.maxY != null && jy > c.maxY) && x > c.x1 - .36 && x < c.x2 + .36 && z > c.z1 - .36 && z < c.z2 + .36);
  for (const c of walls) { const lv0 = lvlOf(c); const lvls = lv0 < 0 ? [...Array(spec.levels).keys()] : [lv0];
    const alongX = c.x2 - c.x1 > c.z2 - c.z1, a1 = alongX ? c.x1 : c.z1, a2 = alongX ? c.x2 : c.z2;
    for (const lv of lvls) for (let a = a1 + .45; a < a2 - .35; a += 1.0) for (const s of [-1, 1]) {
      const jy = lv * FH, far = alongX ? (s > 0 ? c.z2 : c.z1) : (s > 0 ? c.x2 : c.x1), near = alongX ? (s > 0 ? c.z1 : c.x1) : 0;
      const sx = alongX ? a : (s > 0 ? c.x1 - 1.0 : c.x2 + 1.0), sz = alongX ? (s > 0 ? c.z1 - 1.0 : c.z2 + 1.0) : a;
      if (hitAny(sx, sz, jy) ) continue;   // 시작점이 가구 · 다른 벽 속
      g.state = 'playing'; P.floor = spec.floor; P.x = sx; P.z = sz; P.sh = P.shV = 0; P.jy = P.jyV = jy; P.vy = 0; P.inElev = false; P.hiding = null; P.sitting = null; P.crouch = false; P.runOn = false;
      P.yaw = Math.atan2(-(alongX ? 0 : s), -(alongX ? s : 0)); P.pitch = 0; key('ShiftLeft', true); key('KeyW', true);
      for (let i = 0; i < 100; i++) g.updatePlayer(1 / 60);
      key('KeyW', false); key('ShiftLeft', false); for (let i = 0; i < 15; i++) g.updatePlayer(1 / 60);
      if (P.floor !== spec.floor || Math.abs((P.jy || 0) - jy) > .5 || Math.abs(P.sh || 0) > .5) { res.fell++; continue; }
      const along = alongX ? P.x : P.z, past = ((alongX ? P.z : P.x) - far) * s;
      res.n++; if (past > 0 && Math.abs(along - a) < .4) res.leaks.push({ tag: spec.tag, lv, from: [+sx.toFixed(2), +sz.toFixed(2)], to: [+P.x.toFixed(2), +P.z.toFixed(2)], wall: [c.x1, c.x2, c.z1, c.z2].map(v => +v.toFixed(2)), y: [c.y0, c.maxY] });
    } }
  return res;
}, spec);

try {
  const A = await load();
  const d1 = await devices(A.p);
  console.log(`load1: 장치 ${d1.list.length} · 벽 장식 ${d1.deco}`);
  check('wall devices do not overlap any registered wall decoration', d1.hits.length === 0, d1.hits.slice(0, 12).join(' ; '));
  const w = await walk(A.p);
  console.log(`walk probes: ${w.n}`);
  check('player cannot walk through 본관 corridor/room walls', w.n > 50 && w.leaks.length === 0, JSON.stringify(w.leaks.slice(0, 15)));
  const wa = await walk(A.p, 'ANX');
  console.log(`walk probes 별관: ${wa.n}`);
  check('player cannot walk through 별관 corridor/room walls', wa.n > 50 && wa.leaks.length === 0, JSON.stringify(wa.leaks.slice(0, 15)));
  const gd = await A.p.evaluate(() => { const d = __g.world.guardRoom && __g.world.guardRoom.doorCollider; return d ? [d.x1, d.z1] : null; });
  const areas = [...Object.entries(ZONES).map(([tag, [cx, cz, W, D, levels]]) => ({ tag, floor: 0, levels, rect: [cx - W / 2 - .3, cx + W / 2 + .3, cz - D / 2 - .3, cz + D / 2 + .3] })),
    ...(gd ? [{ tag: '경비실', floor: 0, levels: 1, rect: [gd[0] - 5, gd[0] + 5, gd[1] - 5, gd[1] + 5] }] : []),
    { tag: 'B1', floor: 4, levels: 1, rect: [-200, 200, -200, 200] }, { tag: '체육관', floor: 5, levels: 1, rect: [-200, 200, -200, 200] },
    { tag: '수영장', floor: 6, levels: 1, rect: [-200, 200, -200, 200] }, { tag: '식당', floor: 7, levels: 1, rect: [-200, 200, -200, 200] }];
  for (const ar of areas) { const r = await walkCols(A.p, ar);
    console.log(`walk probes ${ar.tag}: ${r.n} (skipped ${r.fell})`);
    check(`player cannot walk through ${ar.tag} walls`, r.n > 3 && r.leaks.length === 0, JSON.stringify(r.leaks.slice(0, 10))); }
  await A.ctx.close();
  const B2 = await load(); const d2 = await devices(B2.p); await B2.ctx.close();
  const diff = d1.list.filter((s, i) => s !== d2.list[i]);
  check('wall device placement identical across two loads', d1.list.length === d2.list.length && diff.length === 0, diff.slice(0, 6).join(' ; '));
  check('second load: no device overlaps decoration', d2.hits.length === 0, d2.hits.slice(0, 6).join(' ; '));
} finally { await b.close(); }
process.exit(fail ? 1 : 0);
