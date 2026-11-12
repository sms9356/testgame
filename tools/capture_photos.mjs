// 액자 사진 촬영기: 실제 게임 장면(서린고 캠퍼스 3D)을 헤드리스 Chromium(swiftshader)에서 낮 조명으로 찍고,
//   tools/photo_fx.js 로 시대별 사진(필름 · 인화지 · 날짜 각인 · 2008 디카)처럼 후보정해 assets/art/photo_*.webp 로 저장한다.
//   node tools/capture_photos.mjs [--raw <dir>] [--fx-only] [--only id,id] [--sheet <contact.png>]
//     --raw     원본 렌더를 PNG 로 보관하는 곳 (기본 $TMPDIR/seorin_photo_raw) — --fx-only 면 렌더를 건너뛰고 보정만 다시 한다
//   PW_CORE · CHROME 로 playwright-core · Chromium 경로를 바꿀 수 있다. 실행 후 manifest.json 에 크기를 합쳐 넣는다.
//   순서: node tools/gen_art.mjs (그림 · 상장 · 교표 · 교가) → node tools/capture_photos.mjs (사진)
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import net from 'node:net'; import { spawn } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(ROOT, 'assets/art');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const RAW = arg('--raw', path.join(os.tmpdir(), 'seorin_photo_raw')), FX_ONLY = process.argv.includes('--fx-only'), ONLY = arg('--only', '');
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
  { id: 'field', tp: [-10, 30, 0], cam: [-30, 5.5, 48], look: [-4, 1, 18], fov: 55 },
  { id: 'aud', tp: [-40, 30, 0], cam: [-30, 1.7, 22], look: [-50, 4, 40], fov: 55 },
  { id: 'gym', tp: [38, 28.1, 5], eye: true, yaw: Math.PI / 2, pitch: .05, fov: 62, exp: 1.6 },
  { id: 'library', tp: [17, 2.4, 0], sh: 3.6, eye: true, yaw: -Math.PI / 2 + .3, pitch: -.12, fov: 64, exp: 1.7 },
  { id: 'classroom', tp: [-29.5, 4.6, 0], sh: 7.2, eye: true, yaw: Math.PI / 2 + .25, pitch: -.15, fov: 64, exp: 1.7 },
  { id: 'bcast', tp: [-42.5, 3.2, 0], sh: 10.8, eye: true, yaw: -Math.PI / 2 + .5, pitch: -.12, fov: 64, exp: 1.8 },
];

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
  for (const S of SHOTS) {
    if (ONLY && !ONLY.split(',').includes(S.id)) continue;
    const t0 = Date.now();
    await p.evaluate(S => { const g = __g; g.state = 'playing'; g.DAY.k = .92; g.DAY.done = true; g.DAY.start = -1; delete g.FL.night;
      g.tp(S.tp[0], S.tp[1], S.tp[2], S.yaw || 0, S.pitch || 0); g.P.sh = S.sh || 0; g.P.shV = S.sh || 0; }, S);
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
      r.setSize(old.x, old.y, false); r.setPixelRatio(pr); cam.fov = fov0; cam.aspect = asp0; cam.updateProjectionMatrix(); r.toneMappingExposure = exp0; g.scene.fog = fog0;
      return c.toDataURL('image/png'); }, S);
    fs.writeFileSync(path.join(RAW, S.id + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log(`  shot ${S.id} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  await ctx.close();
}

// ── 후보정: tools/photo_fx.js 를 빈 페이지에서 돌려 사진 목록(PHOTOS)을 만든다 ──
if (!browser) browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const fx = await browser.newPage();
await fx.route('http://fx.local/**', r => { const u = new URL(r.request().url()).pathname; if (u === '/') return r.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/vendor/fonts/fonts.css"><body>' });
  const f = path.join(ROOT, decodeURIComponent(u)); return f.startsWith(ROOT) && fs.existsSync(f) ? r.fulfill({ path: f }) : r.fulfill({ status: 404, body: '' }); });
await fx.goto('http://fx.local/');
await fx.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'tools/photo_fx.js'), 'utf8') });
await fx.evaluate(async () => { for (const f of ['Noto Sans KR', 'Noto Serif KR', 'Nanum Myeongjo', 'Nanum Pen Script', 'Nanum Gothic Coding']) for (const w of ['400', '700']) await document.fonts.load(`${w} 20px "${f}"`, '서린고등학교제회서린제졸업기념0123456789\'.'); });
const raws = {}; for (const S of SHOTS) { const f = path.join(RAW, S.id + '.png'); if (fs.existsSync(f)) raws[S.id] = 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'); }
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
