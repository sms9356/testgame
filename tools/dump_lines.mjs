// 게임이 실제로 쓰는 음성 대사 전부(story.js 내장 + 실행 중 등록되는 전화 · 쪽지 · 서브 유령 대사)와
// 영어 · 일본어 · 중국어 번역문을 JSON 으로 뽑는다 → tools/gen_voice_pack.py 의 입력
// 실행: python3 -m http.server 8765 (다른 터미널)
//       PW_CORE=<playwright-core 경로> CHROME=<chromium 실행 파일> node tools/dump_lines.mjs lines.json
import fs from 'fs';
const pw = await import(process.env.PW_CORE || 'playwright-core');
const URL = process.env.GAME_URL || 'http://localhost:8765/index.html';
const b = await pw.chromium.launch({ executablePath: process.env.CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 480, height: 270 } })).newPage();
const open = async () => { await p.waitForFunction(() => window.__loadTimes, null, { timeout: 240000 }); await p.waitForTimeout(5000); };
await p.goto(URL, { timeout: 240000 }); await open();
const out = { ko: await p.evaluate(async () => { const v = await import('./voice.js'); return JSON.parse(JSON.stringify(v.allLines())); }) };
for (const L of ['en', 'ja', 'zh']) {
  await p.evaluate(L => __i18n.setLang(L), L).catch(() => {}); await p.waitForTimeout(500); await open();   // 언어를 바꾸면 화면을 다시 불러온다
  out[L] = await p.evaluate(m => Object.fromEntries(Object.entries(m).map(([id, i]) => [id, __i18n.voiceText(i)])), out.ko);
}
await p.evaluate(() => __i18n.setLang('ko')).catch(() => {});
fs.writeFileSync(process.argv[2] || 'lines.json', JSON.stringify(out, null, 1));
console.log('lines', Object.keys(out.ko).length);
await b.close();
