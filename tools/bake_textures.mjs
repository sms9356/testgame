// PBR 텍스처 굽기: tex.js 의 절차적 생성기로 만든 색·노멀·거칠기 맵을 assets/tex/*.webp 로 저장한다.
// 사용법: npx http-server(또는 python3 -m http.server 8765) 실행 후
//   node tools/bake_textures.mjs [playwright-core 경로] [chromium 실행 파일]
import fs from 'fs';
import path from 'path';
const pw = await import(process.argv[2] || 'playwright-core');
const exe = process.argv[3];
const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const b = await pw.chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto('http://localhost:8765/index.html?nostart' + (process.argv[4] ? '&only=' + process.argv[4] : ''));
const out = await p.evaluate(async () => {
  const T = await import('./tex.js');
  const jobs = { wall: () => T.pbrWall(2048), tile: () => T.pbrTile(2048), wood: () => T.pbrWood(2048), ceil: () => T.pbrCeiling(1024), step: () => T.pbrConcrete(512), base: () => T.pbrConcrete(1024, [104, 110, 102]),
    varnish: () => T.pbrVarnish(1024), varnishDark: () => T.pbrVarnish(1024, [92, 58, 34]), paint: () => T.pbrPaintMetal(1024, [118, 126, 122]), locker: () => T.pbrPaintMetal(1024, [92, 116, 128]),
    rust: () => T.pbrPaintMetal(512, [120, 72, 44]), door: () => T.pbrDoor(1024), brick: () => T.pbrBrick(1024), facade: () => T.pbrFacade(1024), dirt: () => T.pbrDirt(1024), pooltile: () => T.pbrPoolTile(1024), track: () => T.pbrTrack(1024) };
  const res = {}, only = new URLSearchParams(location.search).get('only');
  for (const [k, f] of Object.entries(jobs)) {
    if (only && !only.split(',').includes(k)) continue;
    const t = f();
    res[k] = { map: t.map.image.toDataURL('image/webp', .9), normal: t.normalMap.image.toDataURL('image/webp', .92), rough: t.roughnessMap.image.toDataURL('image/webp', .85) };
  }
  return res;
});
// Poly Haven CC0 실사 스캔으로 교체한 재질은 절차적 텍스처로 덮어쓰지 않는다 (assets/tex/CREDITS.md)
const PHOTO = new Set(['tile', 'wood', 'base', 'dirt', 'locker']);
for (const [k, maps] of Object.entries(out)) for (const [m, url] of Object.entries(maps)) {
  if (PHOTO.has(k) && !process.env.FORCE_PROC) { console.log('skip (photoscan)', k); continue; }
  const f = path.join(ROOT, 'assets/tex', `${k}_${m}.webp`);
  fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
  console.log(f, fs.statSync(f).size);
}
await b.close();
