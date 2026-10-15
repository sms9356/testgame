# R02-03 교탁 — QC (V4 1단계)

| 항목 | 값 |
|---|---|
| 사양서 W/D/H | 1200 × 600 × 850 mm |
| 실제 바운딩박스 | 1200 × 600 × 850 mm |
| 축 · 피벗 | glTF Y-up, 원점 = 바닥 중심(y = 0), 학생 쪽 = +Z |
| 부품 (실제 별도 형상) | 목재 상판(라운드) · 교사 쪽 책 받침 턱 · 철판 앞판(학생 쪽, 접합 줄눈 3 · 황동 명판) · 옆판 2 · 바닥판 · 중간 선반 · 칸막이 · 걸레받이 · 고무 발 4 |
| 삼각형 | LOD0 1,436 · LOD1 574 (.blend 안 별도 객체, 게임은 LOD0) |
| UV | UV0 (상자 투영, 실치수 비례 — 철제는 녹 반점 크기 때문에 0.5 배율) |
| 재질 · 맵 | V4_wood_worn, V4_steel_dusty, V4_plinth, V4_brass, V4_rubber — 목재 · 철제: BaseColor · Normal(OpenGL) · ARM(R=AO · G=Roughness · B=Metallic → glTF occlusion + metallicRoughness 한 장) / 고무 · 걸레받이 · 명판: 상수 |
| 텍스처 | 2048 px JPEG (q82), 게임에서는 세 모델이 `assets/models/v4_tex/` 한 벌을 함께 씀 |
| 출처 · 라이선스 | 목재 Poly Haven “Wood Table Worn” (Dimitrios Savva · Rico Cilliers, CC0) · 철제 Poly Haven “Rusty Metal 02” (Rob Tuytel, CC0) — 색만 시트에 맞게 조정(녹 채도 ↓ · 회색 먼지 톤 / 목재 어둡게) |
| 재임포트 | Blender 5.2: GLB · FBX · OBJ · 게임용 glTF 모두 메시 1 · 크기 동일 · 재질 동일 → 통과 (`reimport_check.json`) |
| 렌더 | `render_front/side/back/persp/detail.webp` (Cycles, 흰 배경) |
| 게임 안 | 일반 교실 전부: 예전 강의대 자리(칠판 앞 cx−1.2), 충돌 1.2 × 0.6 m · 끄기 `?v4=0` |
| 판정 | 적용 (게임 회귀 테스트 통과) |
