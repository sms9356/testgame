// ?v= 캐시 버전 감사 — tools/bump-version.mjs 와 tests/versionConsistency.test.mjs 가 함께 쓴다.
// 규칙
//  1) 게임 파일(루트 *.js · rebuild/*.js · index.html · *.css)의 모든 <파일>?v=<숫자> 는 version.js 의 VERSION 과 같다.
//  2) 로컬 모듈(vendor/ 제외) import · import() 는 반드시 ?v=VERSION 을 붙인다 — 빠지면 업데이트 뒤 HTTP 캐시의 예전 파일과
//     새 파일이 섞이고, 같은 파일을 ?v 있이/없이 가져오면 모듈이 두 벌 실행된다(상태 · 이벤트 중복).
//  3) vendor/ 모듈은 절대 ?v 를 붙이지 않는다(같은 three.js 가 두 벌 뜨는 것 방지).
import fs from 'node:fs'; import path from 'node:path';
export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export function readVersion() { return Number(fs.readFileSync(path.join(ROOT, 'version.js'), 'utf8').match(/export const VERSION = (\d+);/)[1]); }
export function gameFiles() {
  const top = fs.readdirSync(ROOT).filter(f => /\.(js|html|css)$/.test(f) && f !== 'version.js');
  const reb = fs.existsSync(path.join(ROOT, 'rebuild')) ? fs.readdirSync(path.join(ROOT, 'rebuild')).filter(f => /\.(js|html)$/.test(f)).map(f => 'rebuild/' + f) : [];
  return [...top, ...reb];
}
const IMPORT_RE = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.{1,2}\/[^'"?]+?\.js)(\?[^'"]*)?\2/g;
const V_RE = /([A-Za-z0-9_\-./]+\.(?:js|json|css|webp|png|jpg|glb|mp3|ogg|wav))\?v=(\d+)/g;
const norm = (rel, spec) => path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
// 파일 하나를 검사(fix=true 면 고친 본문도 돌려준다)
export function auditText(rel, src, ver, fix = false) {
  const issues = [], V = String(ver);
  let out = src.replace(IMPORT_RE, (m, kw, q, spec, query) => {
    if (/^vendor\//.test(norm(rel, spec))) { if (query) { issues.push(`${rel}: vendor import 에 ?v 금지: ${spec}${query}`); return kw + q + spec + q; } return m; }
    if (!query) { issues.push(`${rel}: ?v 없는 import: ${spec}`); return kw + q + spec + '?v=' + V + q; }
    const v = (query.match(/[?&]v=(\d+)/) || [])[1];
    if (v !== V) { issues.push(`${rel}: import ${spec}${query} ≠ ?v=${V}`); return kw + q + spec + '?v=' + V + q; }
    return m;
  });
  out = out.replace(V_RE, (m, f, v) => { if (v === V) return m; issues.push(`${rel}: ${f}?v=${v} ≠ ${V}`); return f + '?v=' + V; });
  // sw.js: 본문이 버전마다 달라야 새 워커가 설치된다
  if (rel === 'sw.js') {
    const m = out.match(/const SW_BUILD = (\d+);/);
    if (!m) issues.push('sw.js: const SW_BUILD = <버전>; 없음');
    else if (m[1] !== V) { issues.push(`sw.js: SW_BUILD ${m[1]} ≠ ${V}`); out = out.replace(/const SW_BUILD = \d+;/, `const SW_BUILD = ${V};`); }
  }
  return { issues: [...new Set(issues)], out: fix ? out : src };
}
// 같은 모듈을 서로 다른 주소(쿼리)로 가져오는지 — 두 벌 실행
export function duplicateInstances(files) {
  const seen = new Map(), dup = [];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const m of src.matchAll(IMPORT_RE)) {
      const abs = norm(rel, m[3]), q = m[4] || '';
      if (!seen.has(abs)) seen.set(abs, new Set()); seen.get(abs).add(q);
    }
  }
  for (const [f, qs] of seen) if (qs.size > 1) dup.push(`${f}: ${[...qs].map(q => q || '(쿼리 없음)').join(' · ')}`);
  return dup;
}
export function auditAll(fix = false, ver = readVersion()) {
  const files = gameFiles(), issues = [];
  for (const rel of files) {
    const p = path.join(ROOT, rel), src = fs.readFileSync(p, 'utf8');
    const r = auditText(rel, src, ver, fix); issues.push(...r.issues);
    if (fix && r.out !== src) fs.writeFileSync(p, r.out);
  }
  return { issues, duplicates: duplicateInstances(files) };
}
