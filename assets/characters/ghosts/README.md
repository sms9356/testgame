# 서브 유령 3D 모델 (사용자 제공 v007 .blend → 게임용 GLB)

| 파일 | 구역 유령 | 원본 |
|---|---|---|
| rooftop.glb | 옥상 (sg_roof) | 01_rooftop/face_body.blend |
| pool.glb | 수영장 (sg_pool, 새 구역) | 02_pool/face_body.blend |
| music.glb | 음악실 (sg_music) | 03_music/face_body.blend |
| art.glb | 미술실 (sg_art) | 04_art/face_body.blend |
| restroom.glb | 화장실 (sg_toilet) | 05_restroom/face_body.blend |
| corridor.glb | 복도 (sg_corr) | 06_corridor/face_body.blend |
| classroom.glb | 교실 (sg_class) | 07_classroom/face_body.blend |

변환: `tools/ghost_blend_to_glb.py` — 배경 디오라마 · 안개 · 떠다니는 실 제거, 몸 약 3만 삼각형으로 감쇠,
원본 절차적 재질 색을 2048 텍스처로 굽고(Cycles), 곡선 머리카락 약 2만 가닥 중 일부를 얇은 띠 메시로 바꿈 (모델당 약 6만 삼각형 · 4MB).
원본은 리깅 · 애니메이션이 없는 정지 모델이라 게임의 움직임(돌아보기 · 숨 · 떨림 · 깜빡임)은 코드로 준다.
기본 인체: MakeHuman (애셋 CC0 — licenses/ 참고). 피부 · 홍채 이미지는 원본 제작 과정에서 이미지 생성 도구로 만든 재료(원본 동봉 기록).
