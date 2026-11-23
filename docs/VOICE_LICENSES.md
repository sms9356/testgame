# 더빙 음성 라이선스 점검표 (상업 출시 전)

## 현재 상태
- 한국어 대사 648줄 전부 ElevenLabs `eleven_v4` 로 생성했습니다 (`voice/manifest.json` 의 `generation` 필드에 voice_id · model_id 기록).
- 비상업 전용이던 **Microsoft Edge 읽어주기(edge-tts)** 와 **KSS(CC BY-NC-SA)** 기반 생성기, 그리고 그 음성으로 만든 영어 · 일본어 · 중국어 더빙 팩(`voice/en|ja|zh`)은 저장소에서 **삭제**했습니다. 영어 · 일본어 · 중국어는 자막과 기기 브라우저 음성(Web Speech)만 씁니다.

## 확인된 사항
- ElevenLabs 워크스페이스 요금제: **Creator 플랜**(사용자 확인). ElevenLabs 의 공개 약관상 유료 플랜(Starter 이상)은 생성 음성의 상업 이용이 포함되지만, 약관은 바뀔 수 있으니 출시 직전에 최신 약관을 다시 확인하세요. 모든 녹음이 Creator 플랜 시점에 만들어졌는지도 확인이 필요합니다(과거 무료 플랜으로 만든 줄이 있었다면 해당 줄은 재생성).

## 출시 전에 확인할 것
1. ElevenLabs 계정이 **상업 이용이 허용되는 유료 요금제**였는지 (무료 요금제로 만든 결과물은 상업 이용 불가). 생성 시점의 요금제를 확인하세요.
2. `voice/CASTING.md` 의 voice_id 중 **Voice Library(공유 음성)** 를 쓴 화자는 음성 제공자별 이용 조건을 확인하세요. 상업 이용이 불확실하면 Voice Design 으로 만든 음성이나 직접 계약한 성우로 교체해야 합니다 (10대 배역은 Voice Design 이 거부하므로 성우 녹음이 대안).
3. Steam 에 AI 생성 음성 사용 여부를 공개해야 합니다 (스토어 AI 공개 항목).

## 교체가 필요해지면
`tools/recast/` 도구로 화자별 voice_id 만 바꿔 다시 녹음하고, 적용된 줄은 `generation_id` 로 건너뜁니다. 비용: 약 55,000 크레딧(전체 기준 추정).
