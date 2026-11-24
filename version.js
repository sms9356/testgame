// 빌드(캐시) 버전 — 단일 출처. 바꿀 때는 손으로 고치지 말고 `node tools/bump-version.mjs [번호]` 를 쓴다:
// 이 값과 index.html · 모든 모듈 import · fetch 의 ?v= 를 한꺼번에 맞춘다 (tests/versionConsistency.test.mjs 가 검사).
// 서비스 워커 캐시 이름(seorin-assets-<v>)도 이 값을 따른다(net.js?v= → sw.js?v=).
export const VERSION = 458;
