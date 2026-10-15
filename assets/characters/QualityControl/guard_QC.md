# 경비원 (Guard) — 품질 검사 기록

| 항목 | 결과 |
|---|---|
| 제작 방식 | Blender 5.2 (bpy) 스크립트 파이프라인 — MakeHuman 1.2 **CC0** 기본 인체(나이 60 · 남성 · 아시아 · 키 1.75m) + 표정 유닛 타깃으로 얼굴 조정, 옷(MakeHuman CC0 프록시 재착색) · 모자 · 넥타이 · 벨트 · 무전기 · 홀스터 · 열쇠 꾸러미 · 경봉 · 손전등 · 견장 · 가슴 패치 · 명찰("경 비")은 직접 모델링 (`Guard/Source/*.py`) |
| 메시 | 31개 · **45,612 삼각형** (LOD1 24,464 · LOD2 13,888) |
| 리그 | 53 본 (게임 엔진형 휴머노이드 · UE 마네킹 이름), 모든 정점 가중치 있음(입 안 175개는 가장 가까운 정점에서 채움) |
| 동작 9 | Idle · Walk · Run · GuardStance · FlashlightHold · RadioUse · Inspect · Surprised · Frightened |
| 표정 모프 8 | Alert · Surprised · Angry · Sad · Talk · Tense · Fear · Blink (게임은 Blink 로 눈 깜빡임) |
| 재질 | 23 (PBR: 색 · 노멀 · 거칠기/AO). 텍스처 `Guard/Textures` (최대 2K) |
| 키 | 몸 1.75m · 모자 포함 1.845m (실측) |
| 파일 | `guard.blend` · `../guard.glb`(LOD0, 게임용 WebP) · `guard_lod1.glb` · `guard_lod2.glb` · `guard.fbx`(텍스처 상대 경로) · `guard.obj/.mtl` |
| 재임포트 검사 | GLB · FBX · OBJ · .blend 모두 Blender 로 다시 열어 메시 31 · 삼각형 45,612 · 본 53(OBJ 는 본 없음) · 텍스처 연결 확인 (`export_report.json`) |
| 렌더 | `Guard/Renders` 정면 · 측면 · 후면 · 3/4 · 얼굴 · 얼굴 측면 (Cycles) |
| 게임 연결 | `manifest.json` 의 guard=true → 정문 경비실 경비원이 3D 모델로 바뀜. **브라우저(Chromium) 실행 확인**: 로드 성공 · Idle 재생 · 스케일 그대로(native) · 발 위치 바닥 · 콘솔 오류 없음 |

## 남은 한계 (솔직하게)
- 얼굴은 캐릭터 시트와 **비슷한 인상**일 뿐 똑같지 않다 (MakeHuman 타깃 조합 · 사진 스캔 아님)
- 동작은 **키프레임 손작업**(모션 캡처 아님) — 걷기 · 달리기가 다소 기계적
- 머리카락은 MakeHuman 카드 방식, 일부 텍스처(모자 원단 · 가죽 · 배지 · 패치 · 명찰 · 피부 잡티)는 절차적 생성
- 경봉 색이 렌더에서 붉은 기가 강함 · 눈이 조명에 따라 어둡게 보임
- FPS: 이 컨테이너는 GPU 없는 소프트웨어 렌더(SwiftShader)라 실제 FPS 를 잴 수 없다 (게임 전체가 1~2fps). 실제 GPU 에서 확인 필요
- 민아(Mina)는 같은 파이프라인으로 제작 완료 → `mina_QC.md`

## 라이선스
MakeHuman 1.2 기본 메시 · 타깃 · 프록시 · 텍스처: CC0 (makehumancommunity.org). 직접 만든 소품 · 텍스처: 프로젝트 원본.

## 게임 안 화면
- `guard_ingame_front.jpg` — 경비실 안 (정면 비교를 위해 테스트에서만 몸을 카메라 쪽으로 돌림)
- `guard_ingame_side.jpg` — 실제 배치 그대로 (창밖을 보고 선 모습)
