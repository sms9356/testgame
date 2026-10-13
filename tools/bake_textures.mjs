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
await p.goto('http://localhost:8765/index.html?nostart');
const out = await p.evaluate(async () => {
  const T = await import('./tex.js');
  const jobs = { wall: () => T.pbrWall(1024), tile: () => T.pbrTile(1024), wood: () => T.pbrWood(1024), ceil: () => T.pbrCeiling(1024), step: () => T.pbrConcrete(512), base: () => T.pbrConcrete(1024, [104, 110, 102]) };
  const res = {};
  for (const [k, f] of Object.entries(jobs)) {
    const t = f();
    res[k] = { map: t.map.image.toDataURL('image/webp', .9), normal: t.normalMap.image.toDataURL('image/webp', .92), rough: t.roughnessMap.image.toDataURL('image/webp', .85) };
  }
  return res;
});
for (const [k, maps] of Object.entries(out)) for (const [m, url] of Object.entries(maps)) {
  const f = path.join(ROOT, 'assets/tex', `${k}_${m}.webp`);
  fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
  console.log(f, fs.statSync(f).size);
}
await b.close();
