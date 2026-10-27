# 텍스처 출처

대부분의 재질은 `tex.js` 의 절차적 생성기로 구운 원본이다 (`tools/bake_textures.mjs`).
다음 재질은 사용자 제공 PBR 가이드(Haegyo_PBR_Guide_With_Source.pdf)의 추천에 따라 **Poly Haven CC0 실사 스캔**으로 교체했다
(1K 다운로드 → 1024px WebP, 노멀은 OpenGL 형식 그대로). `bake_textures.mjs` 는 이 5종을 덮어쓰지 않는다 (`FORCE_PROC=1` 로 강제 가능).

| 파일 | 원본 | 작가 | 라이선스 |
|---|---|---|---|
| tile_* (복도 · 교실 테라조 바닥) | [Old Mosaic Floor](https://polyhaven.com/a/old_mosaic_floor) | Amal Kumar | CC0 |
| wood_* (나무 마루) | [Old Wood Floor](https://polyhaven.com/a/old_wood_floor) | Guillaume Monsergent | CC0 |
| base_* (지하 콘크리트) | [Damaged Concrete Floor](https://polyhaven.com/a/damaged_concrete_floor) | Rob Tuytel | CC0 |
| dirt_* (운동장 흙) | [Brown Mud 03](https://polyhaven.com/a/brown_mud_03) | Rob Tuytel | CC0 |
| locker_* (사물함 철판) | [Rusty Metal Sheet](https://polyhaven.com/a/rusty_metal_sheet) | Amal Kumar | CC0 |
| step_* (계단 · 층참 콘크리트) | [Concrete Floor 02](https://polyhaven.com/a/concrete_floor_02) | Rob Tuytel | CC0 |
| facade_* (외벽 노후 콘크리트 + 빗물 자국 합성) | [Concrete Wall 008](https://polyhaven.com/a/concrete_wall_008) | Dario Barresi, Charlotte Baglioni | CC0 |
| roofmetal_* (체육관 · 수영장 아치 지붕) | [Corrugated Iron 02](https://polyhaven.com/a/corrugated_iron_02) | Jenelle van Heerden, Sergej Majboroda | CC0 |
| bluemetal_* (수영장 외벽) | [Blue Metal Plate](https://polyhaven.com/a/blue_metal_plate) | Rob Tuytel | CC0 |
| tfloor_* (화장실 바닥) | [Worn Tile Floor](https://polyhaven.com/a/worn_tile_floor) | Dimitrios Savva | CC0 |
| paint_* (교실 · 복도 벽 페인트 요철) | [Painted Plaster Wall](https://polyhaven.com/a/painted_plaster_wall) | Poly Haven | CC0 |
| ceil_* (텍스 천장) | [Ceiling Interior](https://polyhaven.com/a/ceiling_interior) | Poly Haven | CC0 |
| brick_* (적벽돌) | [Red Brick 03](https://polyhaven.com/a/red_brick_03) | Poly Haven | CC0 |
| d2_tex_paint_* (벗겨진 유성 페인트 징두리 · 도장 철판) | [Peeling Painted Wall](https://polyhaven.com/a/peeling_painted_wall) | Poly Haven | CC0 |
| varnish_* · d2_tex_varnish_* (사물함 · 서가 니스 나무) | [Wood Cabinet Worn Long](https://polyhaven.com/a/wood_cabinet_worn_long) | Poly Haven | CC0 |
| door_* · d2_tex_door_* (나무 문) | [Cherry Veneer](https://polyhaven.com/a/cherry_veneer) | Poly Haven | CC0 |
| d2_th102_wood_edge_* (책상 상판 합판) | [Plywood](https://polyhaven.com/a/plywood) | Poly Haven | CC0 |
| twall_* (화장실 벽 타일) | 직접 생성 (`tex.js` pbrToiletWall) | — | 프로젝트 원본 |
| win_atlas.webp (외벽 창 12종) | 직접 생성 (외부 창문 텍스처 시트 참고) | — | 프로젝트 원본 |

바닥(tile · wood · base · step · tfloor) · 벽(paint) · 천장(ceil) · 벽돌 · 외벽(facade) · 사물함 철판은 2K, 나머지는 1K. (base · step · tfloor · locker 는 같은 원본을 2K 로 다시 받음)

실사 소품 모델(`assets/models`)도 Poly Haven CC0 — 작가 목록은 `assets/models/credits.json`.
