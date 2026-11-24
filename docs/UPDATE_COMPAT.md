# 업데이트 호환 절차 (UPDATE_COMPAT)

예전 버전을 플레이 중이던 사람이 새 버전으로 넘어올 때 생기는 충돌(모듈 섞임 · 세이브/설정 손실 · 오래된 에셋)을 막는 규칙과 배포 절차.

## 배포 체크리스트

1. `node tools/bump-version.mjs` (또는 `node tools/bump-version.mjs <번호>`)
   - `version.js` 의 `VERSION` 을 올리고 index.html · 모든 모듈 import · fetch 의 `?v=` 와 `sw.js` 의 `SW_BUILD` 를 한꺼번에 맞춘다.
   - 손으로 `?v=` 를 고치지 않는다. 검사만: `node tools/bump-version.mjs --check` · 어긋난 곳만 맞추기: `--fix`.
2. 세이브 모양을 바꿨다면 아래 「세이브」 규칙을 따르고 `tests/saveCompat.test.mjs` 에 예전 모양을 추가한다.
3. 키 동작을 추가했다면 `settings.js` 의 `DEF.keys` 에만 넣는다(이전은 `migrateKeys` 가 처리).
4. `npm test` 통과 (`tests/versionConsistency.test.mjs` 가 `?v` 누락 · 불일치 · 모듈 두 벌 실행을 잡는다).
5. E2E: `E2E_ONLY=reach,save node tests/e2e.mjs`.

## 1. 모듈 버전 (`?v=`)

- 단일 출처: `version.js` (`export const VERSION`).
- 규칙(`tools/versionAudit.mjs`): 게임 파일(루트 `*.js` · `rebuild/*` · `index.html` · `*.css`)의
  - 로컬 모듈 import / `import()` 는 **반드시** `?v=VERSION`.
  - `vendor/` import 에는 `?v` 를 **붙이지 않는다**.
  - `파일?v=N` 의 N 은 모두 VERSION.
- 왜: 브라우저는 `./a.js` 와 `./a.js?v=456` 을 **다른 모듈**로 보고 두 번 실행한다(상태 · 이벤트 리스너 두 벌).
  이번 감사에서 `world.js`, `audio.js`(minigames 가 `?v=140` 으로 가져옴 → AudioContext 두 벌), `tex.js`, `story.js`,
  `guardRoomLayout.js`, `campusVisuals.js`, `rebuild/models.js`, `rebuild/mainBuilding.js` 가 두 벌로 실행되고 있었고,
  `?v` 없는 import 54곳은 서비스 워커가 없는 환경에서 HTTP 캐시의 예전 파일과 새 파일이 섞일 수 있었다.
- 새 모듈(예: `minaChat.js`, `smartObjects.js`)도 같은 규칙. 루트에 두면 자동으로 검사 대상이 된다.
  `server/` 아래 Node 서버 코드는 브라우저 모듈이 아니므로 검사하지 않는다.

## 2. 서비스 워커 (웹 배포판)

- 캐시 이름 `seorin-assets-<VERSION>` (`net.js?v=` → `sw.js?v=`). 키는 쿼리를 뗀 경로.
- `sw.js` 본문에 `SW_BUILD` — 브라우저는 sw.js **본문이 같으면** 주소(`?v=`)가 바뀌어도 새 워커를 설치하지 않는다.
- 새 워커는 설치 뒤 **대기**한다(설치 즉시 `skipWaiting` 하지 않음).
  - 페이지를 막 열었을 때(게임 시작 전) 예전 워커가 잡고 있으면 → `net.js` 가 로딩을 멈추고 `skipWaiting` 메시지 → 넘겨받으면 한 번 새로고침.
  - 플레이 중 새 버전 감지(30분마다 · 탭 복귀 때 `index.html` 의 `net.js?v=` 확인) → 배너
    「새 버전이 있습니다 — 저장 후 새로고침」(ko/en/ja/zh). 버튼을 누르면 `window.__saveForUpdate()` 로 저장이
    **성공했을 때만** 넘겨받고 새로고침한다(사망 화면 등 저장 불가면 안내만). 플레이 중 자동 새로고침은 없다.
  - 다른 탭이 먼저 넘겨받으면 이 탭은 새로고침하지 않고 배너만 뜬다. 이 탭의 `?v=<이전>` 요청은 직전 버전 캐시에서
    내어 주고(활성화 때 직전 버전 캐시 하나는 남긴다), 다른 버전 요청은 현재 캐시에 넣지 않는다 → 한 세션 안에서 섞이지 않는다.
  - 넘겨받을 때 `clients.claim`, 그보다 오래된 캐시는 삭제.
- `index.html` (탐색 요청)은 네트워크 우선 — 확인함(`page()`).
- 데스크톱(Electron `app://`)은 서비스 워커를 쓰지 않는다(`net.js` 의 `swOn` 이 http(s) 에서만 켜짐). `app://` 핸들러는 쿼리를 무시하고 파일을 그대로 읽는다.
  `tools/stage-desktop.mjs` 가 런타임 모듈 `bake.js` 를 빼고 복사하던 문제를 고쳤다(패키지판이 뜨지 않음).
- 한계: 이미 배포된 예전 워커(≤456)는 설치 즉시 넘겨받고 다른 버전 요청도 자기 캐시에 넣는다. 그래서 **456 → 다음 버전 한 번**은
  예전 탭을 켜 둔 채 새 탭을 열면 예전 탭이 새 파일을 받을 수 있다(예전 탭 새로고침으로 해결). 그다음 업데이트부터는 위 동작.

## 3. 세이브 (`saveSystem.js`, `SCHEMA = 5`)

- 키: `haegyo_save_v5`(본) · `_bak`(직전 정상본) · `haegyo_save_v4`(레거시 → 변환) · **`haegyo_save_corrupt`**(읽을 수 없는 본 세이브 원문) · **`haegyo_save_future`**(더 새 빌드가 쓴 세이브 원문).
- 읽기: 본 → 백업 → 레거시. 예외를 던지지 않는다. 손상본은 corrupt 키에, `schemaVersion > SCHEMA` 는 future 키에 원문을 남기고 건너뛴다.
- 쓰기: 이전 본이 정상이면 백업으로, 손상/미래본이면 corrupt/future 키로 옮겨 **잃지 않는다**. 새 게임(`clearSlot`)도 보관본은 지우지 않는다.
- `normalize()`: 빠진 선택 필드(docs · msgs · clues · events · tips · cards · world.doors · progress.FL · meta.where)는 기본값, **모르는 필드는 보존**(다운그레이드 → 재업그레이드 때 손실 없음), 제거된 유령 기능의 `ghost` 상태는 버린다.
- 스키마를 올릴 때: `SCHEMA` 를 올리고 `migrate()` 에 `n → n+1` 단계를 추가, 본 키 이름을 `save_v<n+1>` 로 바꾸고 이전 키를 `legacy` 로 둔다
  (예전 빌드가 새 세이브를 덮어쓰지 않도록). `tests/saveCompat.test.mjs` 에 이전 모양을 추가.
- git 기록(`0e65d23` = v362 ~ 현재)의 save() 모양은 같다(SCHEMA 5). 그 이전은 v4 레거시.

## 4. 설정 · localStorage

- `haegyo_set` → `parseSET()` + `migrateKeys()` + `migrateSET()`:
  - 새 키 동작(예: quickSave F5 · quickLoad F9)은 기본 키를 받되, 그 키를 플레이어가 이미 다른 동작에 쓰고 있으면 **미지정('')** — 한 키가 두 동작을 하지 않는다(표시 '—', 키 설정에서 지정).
  - 문자열이 아닌 키 값 → 기본값, 없어진 동작의 키 → 버림, 모르는 설정 필드 → 보존.
  - 일회성 값 이전(그레인 끄기 `fxv`, 목표 바 J→O — O 가 비어 있을 때만).
- 유령 관련 저장 상태: 세이브의 `ghost` 는 `normalize` 와 game.js 가 무시. 설정에는 유령 관련 키가 없었다(기록 확인).
- `haegyo_seen` · `haegyo_voice` · `haegyo_vol` 은 손상값을 기본값으로 처리(기존).

## 5. 에셋 (GLB · WebP · 음성)

- 서비스 워커 캐시는 버전별이므로, 버전을 올리면 모든 에셋이 직전 캐시와 **조건부 요청(ETag/Last-Modified → 304)** 으로 재검증된다.
- 새 캐시에 담을 때 `cache: 'no-cache'` 로 요청 — 브라우저 HTTP 캐시가 휴리스틱으로 들고 있던 예전 GLB · WebP · 음성이 새 버전 캐시에 들어가지 않는다.
- `voice/manifest.json?v=`, CSS · 타이틀 이미지 `?v=` 도 VERSION 을 따른다. `lang/*.json` 은 `cache: 'no-cache'`.
- 그러므로 에셋 파일을 같은 이름으로 바꿔도 **버전만 올리면** 된다.

## 검증 방법

- `npm test` — versionConsistency · saveCompat · settingsCompat · serviceWorker 테스트.
- 업데이트 시뮬레이션: 같은 출처에서 루트 폴더를 바꿔 끼우는 정적 서버로 예전 빌드(git worktree) → 새 빌드 순서로 서빙하고,
  예전 빌드에서 저장 → 새 빌드에서 이어하기, 플레이 중 배너 → 저장 후 새로고침을 Playwright 로 확인했다.
  (포트가 다르면 출처가 달라 localStorage 가 공유되지 않으므로 반드시 같은 포트.)
