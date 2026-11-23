// UI · 상호작용 감사 회귀: 존재하지 않는 아이콘 이미지 요청 · 생활 상호작용 문구의 번역 누락 · 좁은 화면 설정창 규칙
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const read = f => readFile(new URL('../' + f, import.meta.url), 'utf8');

test('lootCard / iconHTML: 아이템 id 로 부르는 아이콘은 실제 아이템 아이콘으로 바뀐다 (assets/ui/battery.webp 404 방지)', async () => {
  const game = await read('game.js'), story = await read('story.js');
  assert.match(game, /const iconHTML = ic => \/\^\[a-z_0-9\]\+\$\/\.test\(ic\) && ITEMS\[ic\]/);
  for (const [, id] of game.matchAll(/lootCard\('([a-z_0-9]+)'/g)) {
    const m = story.match(new RegExp(`\\n  ${id}: \\{[^}]*icon: '([^']+)'`));
    assert.ok(m, `ITEMS.${id} 아이콘 정의`);
    if (/^[a-z_0-9]+$/.test(m[1])) assert.ok(existsSync(new URL(`../assets/ui/${m[1]}.webp`, import.meta.url)), `assets/ui/${m[1]}.webp`);
  }
});

test('생활 상호작용 문구는 en · ja · zh 사전에 모두 있다', async () => {
  const src = await read('interactionsPlus.js');
  const labels = ['책상 낙서 읽어 보기', '교탁 서랍 열어 보기', '교무실 일정 칠판 읽기', '방송 큐시트 읽기', '자판기 살펴보기', '소파에 앉아 잠깐 쉬기'];
  for (const l of labels) assert.ok(src.includes(`'${l}'`), l);
  for (const lang of ['en', 'ja', 'zh']) {
    const d = JSON.parse(await read(`lang/${lang}.json`));
    for (const l of labels) assert.ok(d[l], `${lang}: ${l}`);
    for (const k of src.match(/'[^'\n]*[가-힣][^'\n]*'/g).map(s => s.slice(1, -1)).filter(s => /^(책상 위에|샤프로|지우다|책상 서랍|“졸업|출석부|분필 반|서랍이|전원이|모든 버튼|반환구|푹 꺼진|오래된 가죽|방금 쉬었다)/.test(s))) assert.ok(d[k], `${lang}: ${k.slice(0, 20)}`);
  }
});

test('일시정지 중 Esc 는 설정 · 갤러리를 닫거나 게임으로 돌아간다', async () => {
  const game = await read('game.js');
  assert.match(game, /state === 'paused' && e\.code === 'Escape'/);
});

test('좁은 화면에서 설정창이 가로로 넘치지 않도록 한 줄 배치 규칙이 있다', async () => {
  const css = await read('uiPolish.css');
  assert.match(css, /@media \(max-width:560px\)[\s\S]*#setBody\{flex-direction:column/);
});
