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
const walk = p => p.evaluate(() => {
  const g = __g, P = g.P, B = g.RBG.MAIN, FH = B.spec.FH, L = B.layout, res = { n: 0, leaks: [] };
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
});

try {
  const A = await load();
  const d1 = await devices(A.p);
  console.log(`load1: 장치 ${d1.list.length} · 벽 장식 ${d1.deco}`);
  check('wall devices do not overlap any registered wall decoration', d1.hits.length === 0, d1.hits.slice(0, 12).join(' ; '));
  const w = await walk(A.p);
  console.log(`walk probes: ${w.n}`);
  check('player cannot walk through 본관 corridor/room walls', w.n > 50 && w.leaks.length === 0, JSON.stringify(w.leaks.slice(0, 15)));
  await A.ctx.close();
  const B2 = await load(); const d2 = await devices(B2.p); await B2.ctx.close();
  const diff = d1.list.filter((s, i) => s !== d2.list[i]);
  check('wall device placement identical across two loads', d1.list.length === d2.list.length && diff.length === 0, diff.slice(0, 6).join(' ; '));
  check('second load: no device overlaps decoration', d2.hits.length === 0, d2.hits.slice(0, 6).join(' ; '));
} finally { await b.close(); }
process.exit(fail ? 1 : 0);
