// 액자 사진 촬영기: 실제 게임 장면(서린고 캠퍼스 3D)을 헤드리스 Chromium(swiftshader)에서 낮 조명으로 찍고,
//   tools/photo_fx.js 로 시대별 사진(필름 · 인화지 · 날짜 각인 · 2008 디카)처럼 후보정해 assets/art/photo_*.webp 로 저장한다.
//   node tools/capture_photos.mjs [--raw <dir>] [--fx-only] [--only id,id] [--sheet <contact.png>]
//     --raw     원본 렌더를 PNG 로 보관하는 곳 (기본 $TMPDIR/seorin_photo_raw) — --fx-only 면 게임 렌더를 건너뛴다
//     사람 패스: 원본 + 카메라 · 바닥 표본(<id>.json)으로 tools/photo_people.js 가 3D 학생들을 그려 <사진>_people.png 로 둔다 (--no-people 이면 있던 것을 쓴다)
//   PW_CORE · CHROME 로 playwright-core · Chromium 경로를 바꿀 수 있다. 실행 후 manifest.json 에 크기를 합쳐 넣는다.
//   순서: node tools/gen_art.mjs (그림 · 상장 · 교표 · 교가) → node tools/capture_photos.mjs (사진)
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import net from 'node:net'; import { spawn } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(ROOT, 'assets/art');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const RAW = arg('--raw', path.join(os.tmpdir(), 'seorin_photo_raw')), FX_ONLY = process.argv.includes('--fx-only'), NO_PEOPLE = process.argv.includes('--no-people'), ONLY = arg('--only', '');
const pw = await import(process.env.PW_CORE || '/opt/node-tools/node_modules/playwright-core/index.mjs');
fs.mkdirSync(RAW, { recursive: true });

// 촬영 지점: tp = 플레이어를 옮겨 둘 곳(스트리밍 · 층 표시용), cam/look = 실제 카메라, fov, exp = 노출 배율
//   좌표: 본관은 x -46..46 · z 0..7 (정면이 +z, 운동장 쪽), 정문 z≈70, 대강당 (-50, 42), 체육관 실내 floor 5
const SHOTS = [
  { id: 'aerial', tp: [0, 30, 0], cam: [-26, 44, 84], look: [0, 0, 6], fov: 46, nofog: true, size: [1024, 704] },
  { id: 'facade', tp: [0, 30, 0], cam: [3, 2, 50], look: [0, 8, 6], fov: 50, nofog: true },
  { id: 'steps', tp: [0, 26, 0], cam: [0, 1.7, 31], look: [0, 3.8, 12], fov: 50 },
  { id: 'gate', tp: [0, 62, 0], cam: [-3, 1.65, 56], look: [2, 2.4, 90], fov: 55 },
  { id: 'gate_in', tp: [0, 74, 0], cam: [4, 1.65, 82], look: [0, 4, 40], fov: 50 },
  { id: 'field', tp: [-10, 30, 0], cam: [-30, 5.5, 48], look: [-4, 1, 18], fov: 55, grid: [-34, 14, 2, 46, .5] },
  { id: 'aud', tp: [-40, 30, 0], cam: [-30, 1.7, 22], look: [-50, 4, 40], fov: 55, grid: [-50, 24, -30, 42, .5] },
  // 단체 사진 배경 (사람은 tools/photo_people.js 가 같은 카메라로 따로 그려 합성한다 — grid = 바닥 높이 표본 [x0, z0, x1, z1, 간격])
  { id: 'grad_a', tp: [0, 26, 0], cam: [0, 1.8, 32], look: [0, 2.4, 19], fov: 42, grid: [-9, 12, 9, 26, .25] },
  { id: 'grad_b', tp: [0, 30, 0], cam: [5, 1.9, 42], look: [1, 2.8, 20], fov: 42, grid: [-9, 12, 9, 26, .25] },
  { id: 'gym', tp: [38, 28.1, 5], eye: true, yaw: Math.PI / 2, pitch: .05, fov: 62, exp: 1.6 },
  { id: 'library', tp: [17, 2.4, 0], sh: 3.6, eye: true, yaw: -Math.PI / 2 + .3, pitch: -.12, fov: 64, exp: 1.7 },
  { id: 'classroom', tp: [-29.5, 4.6, 0], sh: 7.2, eye: true, yaw: Math.PI / 2 + .25, pitch: -.15, fov: 64, exp: 1.7 },
  { id: 'bcast', tp: [-42.5, 3.2, 0], sh: 10.8, eye: true, yaw: -Math.PI / 2 + .5, pitch: -.12, fov: 64, exp: 1.8, grid: [-49, -3, -36, 10, .25], gridTop: 12.3 },
];

// 사진 속 사람 (tools/photo_people.js): bg = 배경 원본, era = 교복 시대, groups = 단체(rows: 뒤→앞, 앞줄 의자 · 가운데 선생님) · 군중(scatter) · 목록(list)
//   origin 은 월드 [x, z], rel 은 카메라 기준 [오른쪽, 앞] (사람은 카메라를 본다)
const ROWS5 = [{ n: 17, dz: -1.95, h: .96, spacing: .48 }, { n: 17, dz: -1.32, h: .64, spacing: .48, stagger: 1 }, { n: 17, dz: -.69, h: .32, spacing: .48 }, { n: 16, dz: -.06, spacing: .5, stagger: 1 }, { n: 13, dz: .85, seat: 1, spacing: .6 }];
const ROWS4 = [{ n: 15, dz: -1.32, h: .64, spacing: .5 }, { n: 15, dz: -.69, h: .32, spacing: .5, stagger: 1 }, { n: 15, dz: -.06, spacing: .5 }, { n: 12, dz: .85, seat: 1, spacing: .6 }];
const grad = (era, seed, bg, rows, origin) => ({ bg, era, seed, female: era >= 1997 ? .46 : 0, glasses: era < 1995 ? .1 : .16, groups: [{ type: 'rows', origin, teachers: 5, rows }] });
const PEOPLE = {
  grad_1989: grad(1989, 189, 'grad_b', ROWS4, [1.5, 29]),
  grad_1993: grad(1993, 193, 'grad_a', ROWS5, [0, 19]),
  grad_1997: grad(1997, 197, 'grad_b', ROWS5, [1.5, 29]),
  grad_2001: grad(2001, 201, 'grad_a', ROWS4, [0, 19.4]),
  grad_2004: grad(2004, 204, 'grad_a', ROWS5, [0, 19]),
  grad_2007: grad(2007, 207, 'grad_b', ROWS5, [1.5, 29]),
  opening_1968: { bg: 'grad_b', era: 1968, seed: 68, female: 0, glasses: .08, groups: [{ type: 'rows', origin: [1.5, 29], teachers: 7, rows: [{ n: 20, dz: -.69, h: .32, spacing: .5 }, { n: 20, dz: -.06, spacing: .5, stagger: 1 }, { n: 14, dz: .85, seat: 1, spacing: .6 }] }] },
  bcast_1998: { bg: 'bcast', era: 1998, seed: 198, female: .5, flat: 10.8, sun: .4, key: 2.6, hemi: .5, shadow: .35, shadowR: 5, sunDir: [-.2, 1.2, -.6], exposure: 1.1,
    groups: [{ type: 'list', rel: [.5, 3.9], at: [[-1.3, -.5, 0, 'stand'], [-.6, -.6, 0, 'clasp'], [.1, -.65, 0, 'stand'], [.8, -.55, 0, 'stand'], [1.5, -.45, 0, 'clasp'], [-1.0, .2, 0, 'stand'], [-.3, .15, 0, 'stand'], [.45, .2, 0, 'clasp'], [1.2, .25, .1, 'stand']] }] },
  sports_1997: { bg: 'field', era: 1997, seed: 97, female: .45, glasses: .05, shadowR: 16,
    groups: [{ type: 'scatter', origin: [-14, 30], w: 12, d: 6, n: 48, sport: true, poses: ['cheer', 'cheer', 'stand', 'stand', 'clasp'], face: 'cam', spread: 1.4, gap: .55, yaw: -0.73 },
      { type: 'scatter', origin: [-6, 22], w: 8, d: 3, n: 18, sport: true, poses: ['stand', 'cheer'], face: 'in', spread: .5, gap: .6 }] },
  seorinje_2007: { bg: 'aud', era: 2007, seed: 207, female: .5, shadowR: 14,
    groups: [{ type: 'scatter', rel: [0, 11], w: 11, d: 5, n: 46, poses: ['stand', 'stand', 'clasp', 'cheer'], face: null, spread: 6.3, gap: .55 }] },
};

let browser, srv;
async function freePort() { return new Promise(r => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); }); }
if (!FX_ONLY) {
  const port = await freePort();
  srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 704 } });
  await ctx.route(u => !/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(u.href), r => r.abort());
  const p = await ctx.newPage(); p.setDefaultTimeout(300000);
  p.on('pageerror', e => console.log('  [pageerror]', e.message));
  await p.goto(`http://127.0.0.1:${port}/index.html?debug`, { timeout: 300000 });
  await p.waitForFunction(() => window.__loadTimes, null, { timeout: 300000, polling: 500 });
  await p.evaluate(() => { __g.applyQuality?.('high'); __g.start(); });
  await p.waitForFunction(() => !document.getElementById('loading').classList.contains('show') && !document.getElementById('title').classList.contains('show'), null, { timeout: 300000, polling: 500 });
  await p.evaluate(() => { __g.state = 'playing'; document.querySelectorAll('body > *:not(canvas)').forEach(e => { if (!e.querySelector('canvas')) e.style.visibility = 'hidden'; }); });
  await p.evaluate(() => { const g = __g; g.DAY.k = .92; g.DAY.done = true; g.DAY.start = -1; delete g.FL.night; });
  await p.waitForTimeout(8000);   // 첫 장이 밤 조명으로 찍히지 않게: 낮 전환 · 하늘 갱신을 먼저 한 바퀴 돌린다
  for (const S of SHOTS) {
    if (ONLY && !ONLY.split(',').includes(S.id)) continue;
    const t0 = Date.now();
    await p.evaluate(S => { const g = __g; g.state = 'playing'; g.DAY.k = .92; g.DAY.done = true; g.DAY.start = -1; delete g.FL.night;
      g.tp(S.tp[0], S.tp[1], S.tp[2], S.yaw || 0, S.pitch || 0); g.power = true; g.P.sh = S.sh || 0; g.P.shV = S.sh || 0; }, S);
    await p.waitForTimeout(4500);   // 스트리밍 · 층 전환 · 조명 갱신
    const url = await p.evaluate(S => { const g = __g, T = g.THREE, cam = g.camera, r = g.renderer, W = (S.size || [768, 528])[0], H = (S.size || [768, 528])[1];
      g.DAY.k = .92; if (g.ghost?.mesh) g.ghost.mesh.visible = false; if (g.ghost?.group) g.ghost.group.visible = false;
      const fog0 = g.scene.fog; if (S.nofog) g.scene.fog = null;
      const fov0 = cam.fov, asp0 = cam.aspect, exp0 = r.toneMappingExposure;
      if (!S.eye) { cam.position.set(...S.cam); cam.lookAt(new T.Vector3(...S.look)); }
      cam.fov = S.fov || 55; cam.aspect = W / H; cam.far = Math.max(cam.far, 600); cam.updateProjectionMatrix();
      r.toneMappingExposure = exp0 * (S.exp || 1.15);
      const old = new T.Vector2(); r.getSize(old); const pr = r.getPixelRatio(); r.setPixelRatio(1); r.setSize(W, H, false);
      r.render(g.scene, cam);
      const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(r.domElement, 0, 0, W, H);
      let info = null;
      if (S.grid) {   // 사람 합성용: 카메라 · 바닥 높이 표본
        const [x0, z0, x1, z1, st] = S.grid, nx = Math.round((x1 - x0) / st) + 1, nz = Math.round((z1 - z0) / st) + 1, h = [], ray = new T.Raycaster(); ray.camera = cam; ray.params.Line.threshold = 0; ray.params.Points.threshold = 0;
        const top = S.gridTop ?? 6, dn = new T.Vector3(0, -1, 0), objs = []; g.scene.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && o.visible && !(o.material?.transparent && (o.material.opacity ?? 1) < .6) && !o.isInstancedMesh) { let v = true, q = o; while (q) { if (!q.visible) { v = false; break; } q = q.parent; } if (v) objs.push(o); } });
        g.scene.updateMatrixWorld(true);
        for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { ray.set(new T.Vector3(x0 + i * st, top, z0 + j * st), dn); ray.far = top + 4; const hit = ray.intersectObjects(objs, false)[0]; h.push(hit ? +hit.point.y.toFixed(3) : null); }
        info = { pos: cam.position.toArray(), quat: cam.quaternion.toArray(), fov: cam.fov, W, H, grid: { x0, z0, st, nx, nz, h } };
      }
      r.setSize(old.x, old.y, false); r.setPixelRatio(pr); cam.fov = fov0; cam.aspect = asp0; cam.updateProjectionMatrix(); r.toneMappingExposure = exp0; g.scene.fog = fog0;
      return [c.toDataURL('image/png'), info]; }, S).then(([u, info]) => { if (info) fs.writeFileSync(path.join(RAW, S.id + '.json'), JSON.stringify(info)); return u; });
    fs.writeFileSync(path.join(RAW, S.id + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log(`  shot ${S.id} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  await ctx.close();
}

// ── 후보정: tools/photo_fx.js 를 빈 페이지에서 돌려 사진 목록(PHOTOS)을 만든다 ──
if (!browser) browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const fx = await browser.newPage(); fx.setDefaultTimeout(600000);
fx.on('pageerror', e => console.log('  [pageerror]', e.message));
await fx.route('http://fx.local/**', r => { const u = new URL(r.request().url()).pathname; if (u === '/') return r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script><link rel="stylesheet" href="/vendor/fonts/fonts.css"><body>' });
  const f = path.join(ROOT, decodeURIComponent(u)); return f.startsWith(ROOT) && fs.existsSync(f) ? r.fulfill({ path: f }) : r.fulfill({ status: 404, body: '' }); });
await fx.goto('http://fx.local/');
// ── 사람 패스 ──
if (!NO_PEOPLE) for (const [id, P] of Object.entries(PEOPLE)) {
  if (ONLY && !ONLY.split(',').includes(P.bg) && !ONLY.split(',').includes(id)) continue;
  const jf = path.join(RAW, P.bg + '.json'); if (!fs.existsSync(jf)) { console.log('  (카메라 정보 없음) ' + id); continue; }
  const t0 = Date.now(), r = await fx.evaluate(async ([info, P]) => (await import('/tools/photo_people.js')).render(info, P), [JSON.parse(fs.readFileSync(jf, 'utf8')), P]);
  fs.writeFileSync(path.join(RAW, id + '_people.png'), Buffer.from(r.url.split(',')[1], 'base64'));
  console.log(`  people ${id} · ${r.n}명 · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
await fx.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'tools/photo_fx.js'), 'utf8') });
await fx.evaluate(async () => { for (const f of ['Noto Sans KR', 'Noto Serif KR', 'Nanum Myeongjo', 'Nanum Pen Script', 'Nanum Gothic Coding']) for (const w of ['400', '700']) await document.fonts.load(`${w} 20px "${f}"`, '서린고등학교제회서린제졸업기념0123456789\'.'); });
const raws = {}; for (const k of [...SHOTS.map(S => S.id), ...Object.keys(PEOPLE).map(k => k + '_people')]) { const f = path.join(RAW, k + '.png'); if (fs.existsSync(f)) raws[k] = 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'); }
await fx.evaluate(r => window.loadRaws(r), raws);
const list = await fx.evaluate(() => window.PHOTO_LIST);
let q = .82, res;
for (;;) { res = []; let tot = 0;
  for (const n of list) { const r = await fx.evaluate(([n, q]) => window.developOne(n, q), [n, q]); if (!r) { console.log('  (원본 없음) ' + n); continue; } const buf = Buffer.from(r.url.split(',')[1], 'base64'); tot += buf.length; res.push({ name: n, url: r.url, buf, w: r.w, h: r.h }); }
  if (tot <= 1.6 * 1024 * 1024 || q < .5) { console.log(`photos: quality ${q.toFixed(2)} · ${(tot / 1024).toFixed(0)} KB · ${res.length} images`); break; } q -= .08; }
for (const r of res) fs.writeFileSync(path.join(OUT, r.name + '.webp'), r.buf);
const mf = path.join(OUT, 'manifest.json'), M = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : {};
for (const r of res) M[r.name] = [r.w, r.h];
fs.writeFileSync(mf, JSON.stringify(M) + '\n');
const si = process.argv.indexOf('--sheet'); if (si > 0) { const u = await fx.evaluate(a => window.contactSheet(a), res.map(r => ({ name: r.name, url: r.url }))); fs.writeFileSync(process.argv[si + 1], Buffer.from(u.split(',')[1], 'base64')); }
await browser.close(); if (srv) srv.kill();
