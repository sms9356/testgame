// 웹폰트 로컬 번들 — 실행 중 Google Fonts(CDN) 요청을 없앤다 (Steam/오프라인 데스크톱판)
// 사용: node tools/vendor-fonts.mjs <@fontsource 패키지들을 풀어 둔 폴더>
//   각 하위 폴더 = `npm pack @fontsource/<name>` 를 풀어 둔 것 (…/package/{400.css,files/,LICENSE})
// 출력: vendor/fonts/fonts.css · vendor/fonts/files/*.woff2 · vendor/fonts/OFL.txt
// 모든 폰트는 SIL Open Font License 1.1 — 게임과 함께 번들 재배포 허용
import fs from 'node:fs'; import path from 'node:path';
const SRC = process.argv[2]; if (!SRC) { console.error('usage: node tools/vendor-fonts.mjs <dir>'); process.exit(1); }
const OUT = path.resolve('vendor/fonts'); fs.mkdirSync(path.join(OUT, 'files'), { recursive: true });
const FONTS = { 'noto-sans-kr': [300, 400, 500, 700], 'noto-serif-kr': [400, 700], 'east-sea-dokdo': [400],
  'nanum-pen-script': [400], 'nanum-gothic-coding': [400, 700], 'nanum-myeongjo': [400, 700] };
const SKIP = /cyrillic|greek|vietnamese/;
let css = '/* 자동 생성: tools/vendor-fonts.mjs — 손으로 고치지 말 것. 라이선스: OFL.txt (SIL OFL 1.1) */\n', n = 0, lic = '';
for (const [name, weights] of Object.entries(FONTS)) {
  const dir = fs.readdirSync(SRC).map(d => path.join(SRC, d, 'package')).find(p => fs.existsSync(path.join(p, 'package.json')) && JSON.parse(fs.readFileSync(path.join(p, 'package.json'))).name === '@fontsource/' + name);
  if (!dir) throw new Error('missing @fontsource/' + name);
  const L = fs.readFileSync(path.join(dir, 'LICENSE'), 'utf8'); if (!/Open Font License/.test(L)) throw new Error(name + ' is not OFL');
  lic += `===== ${name} (@fontsource/${name}) =====\n${L.trim()}\n\n`;
  for (const w of weights) {
    for (const block of fs.readFileSync(path.join(dir, `${w}.css`), 'utf8').split(/\n(?=\/\*)/)) {
      const m = block.match(/url\(\.\/files\/([^)]+\.woff2)\)/); if (!m || SKIP.test(m[1])) continue;
      fs.copyFileSync(path.join(dir, 'files', m[1]), path.join(OUT, 'files', m[1])); n++;
      css += block.replace(/, url\([^)]+\.woff\) format\('woff'\)/, '').replace(/\.\/files\//g, 'files/').trim() + '\n';
    }
  }
}
fs.writeFileSync(path.join(OUT, 'fonts.css'), css); fs.writeFileSync(path.join(OUT, 'OFL.txt'), lic);
console.log(`vendored ${n} woff2 files`);
