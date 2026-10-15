# 게임 연결 (경비원 · 민아)

1. `assets/characters/<id>.glb` 를 두고 `assets/characters/manifest.json` 에서 `"<id>": true` 로 바꾼다. false 면 요청하지 않는다(404 없음).
2. `game.js` → `npcLoad(id, holder, opts)` → `npcVisuals.js` 가 기존 절차적 모델 그룹(holder) 안의 외형만 교체한다 — 위치 · 회전 · 상호작용 · 저장은 그대로.
   - 경비원: `native: true`(실제 미터 크기 그대로) · 경비실은 `Idle`, 정문 순찰은 `FlashlightHold` 동작
   - 모프 `Blink` 가 있으면 자동으로 눈을 깜빡인다. `setExpression(holder, 'Fear', 1)` 로 표정
3. 로딩 실패 시 기존 절차적 모델 + 초상화 유지.
4. 현재 상태: **guard = true (적용)** · mina = false (미제작)
