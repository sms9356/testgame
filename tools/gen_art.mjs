// 액자 그림 · 사진 생성기: tools/art_painter.js 를 헤드리스 Chromium 캔버스로 그려 assets/art/*.webp 로 저장
//   node tools/gen_art.mjs [--sheet <contact.png>]
//   PW_CORE (기본 /opt/node-tools/node_modules/playwright-core/index.mjs) · CHROME (기본 /opt/pw-browsers/chromium) 로 바꿀 수 있다
//   긴 변 ≤ 512px · 합계 ≤ 4MB (넘으면 품질을 낮춰 다시 굽는다)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(ROOT, 'assets/art');
const pw = await import(process.env.PW_CORE || '/opt/node-tools/node_modules/playwright-core/index.mjs');
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.html': 'text/html' };
const PAGE = '<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/vendor/fonts/fonts.css"><body><script src="/tools/art_painter.js"></script>';
const srv = http.createServer((q, s) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') { s.writeHead(200, { 'content-type': 'text/html' }); return s.end(PAGE); }
  const f = path.join(ROOT, u); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { s.writeHead(404); return s.end(); } s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(s); });
await new Promise(r => srv.listen(0, r));
const b = await pw.chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage(); await p.goto(`http://127.0.0.1:${srv.address().port}/`);
await p.evaluate(async () => { const T = '성실정직봉사배우고익히다무자년가을서문고개교주년상장표창최우수대은동금려합창제방송부다같이환경가꾸기학교교육감한방울의물도소중하게쓰지않는불은끄고다녀요책속에길이있어요친구야먼저손내밀게제대회졸업기념ON AIR 0123456789'; for (const f of ['East Sea Dokdo', 'Nanum Myeongjo', 'Nanum Pen Script', 'Noto Sans KR', 'Noto Serif KR', 'Nanum Gothic Coding']) for (const w of ['400', '700']) await document.fonts.load(`${w} 20px "${f}"`, T); });
fs.mkdirSync(OUT, { recursive: true });
const names = await p.evaluate(() => window.ART_LIST); let q = .8, res;
for (;;) { res = []; let tot = 0;
  for (const n of names) { const r = await p.evaluate(([n, q]) => window.paintOne(n, q), [n, q]); const buf = Buffer.from(r.url.split(',')[1], 'base64'); tot += buf.length; res.push({ name: n, url: r.url, buf, w: r.w, h: r.h }); }
  if (tot <= 4 * 1024 * 1024 || q < .45) { console.log(`quality ${q} · ${(tot / 1024).toFixed(0)} KB · ${res.length} images`); break; } q -= .08; }
for (const r of res) fs.writeFileSync(path.join(OUT, r.name + '.webp'), r.buf);
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(Object.fromEntries(res.map(r => [r.name, [r.w, r.h]]))) + '\n');
const si = process.argv.indexOf('--sheet'); if (si > 0) { const u = await p.evaluate(a => window.contactSheet(a), res.map(r => ({ name: r.name, url: r.url }))); fs.writeFileSync(process.argv[si + 1], Buffer.from(u.split(',')[1], 'base64')); }
await b.close(); srv.close();
