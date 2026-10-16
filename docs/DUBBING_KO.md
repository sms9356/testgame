# 한국어 더빙 재제작

221개 한국어 대사/쪽지 낭독을 ElevenLabs `eleven_v4`, `language_code=ko`, stability 0.5로 생성한다. 게임 원문/자막은 유지하고, 생성 입력에만 감정·호흡 지시를 넣는다. 외국어 음성 팩은 별도 제작 대상이다.

## 캐스팅과 연기

`tools/korean_performance.json`이 재현 가능한 기준이다. 기존 캐스팅을 계정 음성 목록 및 최신 변경 이력과 대조했다. 경비의 보이스 디자인 음성은 계정 `/v1/voices`에서 확인했다.

| 역할 | 기존 캐스팅 유지 | 연기 방향 |
|---|---|---|
| 서연, 17세 여학생 | yeonjin | 서울말. 선배에게 존댓말. 숨기·발각·결심을 구분 |
| 지훈, 18세 남학생 | Leo | 서울말. 겁을 누르며 짧게 관찰하고 판단 |
| 민아, 18세 여학생 | sena | 녹화 중 대화체에서 통화의 불안으로 전환 |
| 하늘, 18세 여학생 | Sujin | 과거 방송의 기대와 마지막 작별의 안도 구분 |
| 경비 | 경비 아저씨 (충청도 중년) | 현재 게임의 설계 음색/사투리 유지. 걱정과 회상의 무게 |
| 담임/기록, 40대 남성 | Travel Docent | 기록을 읽는 말투와 죄책감의 고백 구분 |
| 내레이션 | Madangsoe | 차분한 표준어, 과장 없는 전달 |
| 친구 | 랑이 / Busan SS | 친근한 일상 대화. 기존 부산 억양 유지 |
| 방송 / 그것 | Joey Kim / Sophia | 공식 방송 / 가까운 속삭임 |

캐릭터의 나이는 역할 설정이다. 라이브러리 음성의 연령 메타데이터와 동일함을 보장하지 않는다. 특히 기존 `konan/`의 경비 60대 표기와 최신 중년 설정은 서로 다르다. 이번에는 최신 캐스팅을 보존했다.

## 처리 원칙

- 모든 쉼·숨·말끝 보존. `silenceremove`를 사용하지 않는다.
- 피치 변조·떨림·중복 에코 없이 원음을 먼저 생성한다.
- 일반 대사는 -19 LUFS, 속삭임은 -23 LUFS 목표, true peak -2 dBTP 목표로 처리한 모노 44.1kHz / 128kbps MP3. 매우 짧은 파일의 LUFS 수치는 제한적으로 해석한다.
- `voice/manifest.json`의 실제 길이를 갱신하고 생성 voice_id/model/settings/input hash/audio hash/request ID를 기록한다. 비밀 키는 저장하지 않는다.
- 청취 전 생성물에는 `review_status=listening_required`. 기술 검사를 통과해도 자연스러움 검수가 끝난 것으로 표시하지 않는다.

## 다시 만들기

먼저 비용 없는 작업량 확인:

```sh
python3 tools/redub_korean.py --out /tmp/haegyo-redub
```

개발 환경의 `ELEVENLABS_API_KEY`가 연결되어 있을 때 실제 생성(크레딧 사용):

```sh
python3 tools/redub_korean.py --generate --out /tmp/haegyo-redub
python3 tools/redub_korean.py --generate --only l_hide_s,l_spotted_s --out /tmp/haegyo-redub
```

출력은 저장소 밖에만 쓴다. 성공한 원본 테이크와 요청 영수증을 보존하여 같은 입력은 로컬에서 이어 처리한다. 실패 요청은 자동 재시도하지 않는다. 설정이나 대사를 바꾸면 새 출력 폴더를 사용한다. 검수한 MP3와 manifest만 게임에 반영한다. 기존 `gen_voice_eleven.py`의 Elli/Josh/Clyde 기본값은 현재 한국어 캐스팅과 달라 이 팩의 재생성에 사용하지 않는다.

## 검증

```sh
npm test
python3 -m http.server 8767
# 다른 터미널, Playwright와 Chromium이 설치되어 있을 때:
GAME_URL=http://127.0.0.1:8767 CHROME=/usr/bin/chromium node tests/voice.playwright.mjs
```

브라우저 검사는 지연된 음성 요청의 취소, 최신 요청 우선, 실제 재생 길이, 취소 후 자막 억제를 확인한다. `PW_CORE`로 playwright-core의 설치 경로를 지정할 수 있다.
