# 텍스처 출처

대부분의 재질은 `tex.js` 의 절차적 생성기로 구운 원본이다 (`tools/bake_textures.mjs`).
다음 5종은 사용자 제공 PBR 가이드(Haegyo_PBR_Guide_With_Source.pdf)의 추천에 따라 **Poly Haven CC0 실사 스캔**으로 교체했다
(1K 다운로드 → 1024px WebP, 노멀은 OpenGL 형식 그대로). `bake_textures.mjs` 는 이 5종을 덮어쓰지 않는다 (`FORCE_PROC=1` 로 강제 가능).

| 파일 | 원본 | 작가 | 라이선스 |
|---|---|---|---|
| tile_* (복도 · 교실 테라조 바닥) | [Old Mosaic Floor](https://polyhaven.com/a/old_mosaic_floor) | Amal Kumar | CC0 |
| wood_* (나무 마루) | [Old Wood Floor](https://polyhaven.com/a/old_wood_floor) | Guillaume Monsergent | CC0 |
| base_* (지하 콘크리트) | [Damaged Concrete Floor](https://polyhaven.com/a/damaged_concrete_floor) | Rob Tuytel | CC0 |
| dirt_* (운동장 흙) | [Brown Mud 03](https://polyhaven.com/a/brown_mud_03) | Rob Tuytel | CC0 |
| locker_* (사물함 철판) | [Rusty Metal Sheet](https://polyhaven.com/a/rusty_metal_sheet) | Amal Kumar | CC0 |

실사 소품 모델(`assets/models`)도 Poly Haven CC0 — 작가 목록은 `assets/models/credits.json`.
