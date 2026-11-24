// 캐시 버전 올리기 — 사용: node tools/bump-version.mjs [새 번호]   (번호를 빼면 +1)
//   --check : 고치지 않고 검사만(문제가 있으면 종료 코드 1)   --fix : 버전은 그대로 두고 어긋난 ?v= 만 맞춘다
// version.js 의 VERSION 과 index.html · 모든 게임 모듈 import · fetch 의 ?v= 를 한꺼번에 맞춘다.
// ?v 가 빠진 로컬 import 에는 ?v 를 붙이고, vendor/ import 의 ?v 는 뗀다 (tools/versionAudit.mjs 규칙).
import fs from 'node:fs'; import path from 'node:path';
import { ROOT, readVersion, auditAll } from './versionAudit.mjs';
const args = process.argv.slice(2), cur = readVersion();
const report = r => { [...r.issues, ...r.duplicates].forEach(i => console.log('✘ ' + i)); return r.issues.length + r.duplicates.length; };
if (args.includes('--check')) {
  const n = report(auditAll(false, cur));
  console.log(n ? `문제 ${n}건` : `✔ 모두 ?v=${cur}`); process.exit(n ? 1 : 0);
}
const arg = args.find(a => /^\d+$/.test(a));
const next = args.includes('--fix') ? cur : arg ? Number(arg) : cur + 1;
if (next < cur) { console.error(`새 버전(${next})이 현재(${cur})보다 작다 — 서비스 워커는 번호가 큰 쪽을 새 버전으로 본다`); process.exit(1); }
const vf = path.join(ROOT, 'version.js');
fs.writeFileSync(vf, fs.readFileSync(vf, 'utf8').replace(/export const VERSION = \d+;/, `export const VERSION = ${next};`));
const fixed = auditAll(true, next);
console.log(`VERSION ${cur} → ${next} · 고친 곳 ${fixed.issues.length}건`);
if (report(auditAll(false, next))) { console.error('남은 문제가 있다(위 목록)'); process.exit(1); }
