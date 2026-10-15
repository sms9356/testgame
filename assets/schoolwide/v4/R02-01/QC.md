# R02-01 학생용 책상 — QC (V4 1단계)

| 항목 | 값 |
|---|---|
| 사양서 W/D/H | 650 × 450 × 730 mm |
| 실제 바운딩박스 | 가방걸이 포함 폭 708 mm (고리 각 29 mm 돌출) |
| 축 · 피벗 | glTF Y-up, 원점 = 바닥 중심(y = 0), 학생 쪽 = +Z |
| 부품 (실제 별도 형상) | 18 mm 합판 상판(라운드 4 mm) · 20×20 각관 상판 프레임 4 · 25×25 각관 다리 4 · 고무 발 4 · 옆 하부 가로대 2 · 뒤 가로대 · 철판 책 선반(바닥 · 뒤 립 · 옆 립 2) · 가방걸이 2(굽힌 봉) · 고정 나사 8 |
| 삼각형 | LOD0 3,584 · LOD1 1,432 (.blend 안 별도 객체, 게임은 LOD0) |
| UV | UV0 (상자 투영, 실치수 비례 — 철제는 녹 반점 크기 때문에 0.5 배율) |
| 재질 · 맵 | V4_wood_worn, V4_steel_dusty, V4_rubber — 목재 · 철제: BaseColor · Normal(OpenGL) · ARM(R=AO · G=Roughness · B=Metallic → glTF occlusion + metallicRoughness 한 장) / 고무 · 걸레받이 · 명판: 상수 |
| 텍스처 | 2048 px JPEG (q82), 게임에서는 세 모델이 `assets/models/v4_tex/` 한 벌을 함께 씀 |
| 출처 · 라이선스 | 목재 Poly Haven “Wood Table Worn” (Dimitrios Savva · Rico Cilliers, CC0) · 철제 Poly Haven “Rusty Metal 02” (Rob Tuytel, CC0) — 색만 시트에 맞게 조정(녹 채도 ↓ · 회색 먼지 톤 / 목재 어둡게) |
| 재임포트 | Blender 5.2: GLB · FBX · OBJ · 게임용 glTF 모두 메시 1 · 크기 동일 · 재질 동일 → 통과 (`reimport_check.json`) |
| 렌더 | `render_front/side/back/persp/detail.webp` (Cycles, 흰 배경) |
| 게임 안 | 일반 교실 전부: 기존 책상 자리(빠진 자리 · 충돌 그대로, 윗면 0.73 m — 점프로 올라섬) · 끄기 `?v4=0` |
| 판정 | 적용 (게임 회귀 테스트 통과) |
