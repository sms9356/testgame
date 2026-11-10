// 데스크톱(Electron/Steam) 패키지용 게임 파일을 desktop/game/ 으로 복사한다
// 사용: node tools/stage-desktop.mjs   (npm run desktop:stage)
import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'desktop', 'game');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const TOP = fs.readdirSync(ROOT).filter(f => /\.(js|css|html)$/.test(f) && !/^(bake|start)\b/.test(f));
for (const f of TOP) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
for (const d of ['assets', 'vendor', 'voice', 'music', 'lang', 'rebuild']) {
  if (fs.existsSync(path.join(ROOT, d))) fs.cpSync(path.join(ROOT, d), path.join(OUT, d), { recursive: true });
}
// 실행에 쓰지 않는 원본 작업 파일(캐릭터 .blend/.fbx/.obj · 렌더 · 품질검사 · 미사용 텍스처 묶음)은 뺀다
for (const d of ['assets/characters/Mina', 'assets/characters/Guard', 'assets/characters/QualityControl', 'assets/characters/GameIntegration', 'assets/schoolwide']) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });
for (const f of ['LICENSE', 'README.md']) if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
console.log(`staged ${TOP.length} top-level files → ${path.relative(ROOT, OUT)}`);
