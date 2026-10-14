# 폐교: 잊혀진 시간 — Unreal Engine 5 병행 포트 (Phase A · B 준비물 + C 파일럿 블록아웃)

`Haegyo_UE5_AllInOne.pdf` 포팅 가이드에 따라 **웹(Three.js) 게임은 그대로 두고** 이 폴더에서 UE5 버전을 따로 시작한다.

## 현재 상태 — 무엇이 되어 있고, 무엇이 검증되지 않았나

| 항목 | 상태 |
|---|---|
| Phase A 좌표 · 맵 데이터 | ✅ `Data/haegyo_layout.json` — 웹 게임에서 실제로 생성된 벽 · 문 · 출입 포털 · 열쇠 · 장치 · 사물함 · 형광등 · 실사 소품 위치를 내보냄 (웹 브라우저에서 추출, 검증됨) |
| Phase B 텍스처 변환 | ✅ `tools/export_ue_textures.py` 로 15종 생성 확인 (스타터 팩 10종 + 웹에 적용한 Poly Haven CC0 실사 5종) |
| Phase B 머티리얼 자동 생성 | ⚠️ `Content/Python/haegyo_setup.py` — **언리얼 에디터에서 실행해 보지 못함** |
| Phase C 파일럿 블록아웃 | ⚠️ 같은 스크립트가 1층 복도 + 교무실 주변을 큐브로 배치 — **미검증** |
| C++ (플레이어 · 손전등 · 상호작용 · 문 · 저장/백업) | ⚠️ 작성만 됨 — **컴파일 · PIE 미검증** (이 저장소 환경에는 UE5 가 없다) |
| 유령 AI · 퍼즐 · UI · 엔딩 | ❌ 아직 없음 — 파일럿 승인 후 Phase D 이후 |

> 가이드의 원칙대로, 실제 엔진에서 열어 보고 스크린샷 · 로그 · FPS 를 확인하기 전에는 "완성"이 아니다.

## 시작 방법 (Windows, UE 5.4 이상)

1. 텍스처 생성 (저장소 루트에서): `pip install pillow` → `python tools/export_ue_textures.py`
   → `UnrealPort/HaegyoUE/Textures/<id>/T_<id>_{BC.jpg, N_DX.png, ORM.png}`
2. `HaegyoUE.uproject` 우클릭 → *Generate Visual Studio project files* → 빌드 (Development Editor)
3. 에디터에서 새 빈 레벨 (`/Game/Haegyo/Maps/L_Pilot_1F`) 을 만들고 저장
4. *Tools → Execute Python Script* → `Content/Python/haegyo_setup.py`
   - 텍스처 임포트 (BC: sRGB ON · N_DX: Normalmap · **Flip Green 끔** · ORM: Masks)
   - `M_HaegyoPBR` 마스터 + `MI_<id>` 15개
   - 1층 파일럿 블록아웃 (벽 · 바닥 · 문 표식 · 교무실 열쇠 표식 · 형광등 포인트 라이트)
5. PlayerStart 를 1층 복도(웹 좌표 x 0, z 0 → UE (0, 0, 100))에 두고 Play — WASD · 마우스 · E 조사 · F 손전등 · Shift 달리기 · C 앉기 · F5/F9 저장/불러오기

## 좌표 규약 (가이드 4장)

`UE_X = -100 × Three_Z`, `UE_Y = +100 × Three_X`, `UE_Z = +100 × (y0 + Three_Y)` (cm). 1층 간격 FH = 4 m → 400 cm.
B1(y0 = -30) · 체육관 · 수영장 · 급식실 · 별관(y0 180~260) 은 웹에서 **독립 공간**이라 높이를 그대로 쓰면 안 되고, 포털(`portals`)로 연결 관계를 맞춘다.

## 재질 대응 (웹 → UE)

| 웹 `assets/tex` | UE MI | 출처 |
|---|---|---|
| tile (복도 · 교실 바닥) | MI_ph_old_mosaic_floor | Poly Haven *Old Mosaic Floor* (CC0) |
| wood | MI_ph_old_wood_floor | Poly Haven *Old Wood Floor* (CC0) |
| base (B1) | MI_ph_damaged_concrete_floor | Poly Haven *Damaged Concrete Floor* (CC0) |
| dirt (운동장) | MI_ph_brown_mud_03 | Poly Haven *Brown Mud 03* (CC0) |
| locker | MI_ph_rusty_metal_sheet | Poly Haven *Rusty Metal Sheet* (CC0) |
| (스타터 팩 10종) | MI_corridor_peeling_wall … MI_chalkboard_dusty | 사용자 제공 절차적 팩 |

## 다음 단계 (사용자 승인 게이트)

파일럿(1층 복도 + 교무실 금고 + 손전등 + 저장/불러오기)을 실제 에디터에서 확인 → 스크린샷 · FPS · 버그 목록 보고 → 승인 후
Phase D (지훈/서연 · UMG · 퍼즐 5종 · 유령 AIPerception/BT/NavMesh) → E (전 층 · 외부) → F (방송 · 엔딩) → G (Windows 빌드 · QA).
Enhanced Input 으로의 이전(키 재설정)은 Phase D 에서 한다 — 파일럿은 `Config/DefaultInput.ini` 기본 입력을 쓴다.

## 저작권

- 원본 음성 더빙은 비상업 용도 제한 — 유료 배포 전 교체 필요 (웹 README 참고)
- Poly Haven 텍스처 · 모델은 CC0. 웹 `assets/models/credits.json` 에 작가 목록
