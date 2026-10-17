잊혀진 교실 — 경비실 가구 37종 컬러 PBR v6

핵심:
- 실제 편집 가능한 3D 메시(GLB). 사진 같은 콘셉트 이미지만 만든 것이 아닙니다.
- 37종의 색상은 메시별 UV 알베도(Base Color) 텍스처로 GLB에 포함됨.
- 기존 v5의 상세 형상(추가 실제 3D 부품 479개), 이름, 좌표, 기존 금속/거칠기 및 노멀 재질을 사용.
- 책상: 갈색 목재 + 청회색 도장 강철 / 의자: 검은 가죽 / 사물함: 청록색 / 침대: 올리브색 직물 / 난로: 앰버 컬러 발열부 등.
- 개별 GLB 37개는 v5 모든 부품을 포함. v6 CAMPUS_PLACED 단일 GLB는 v4 건축 배치용 기반이며, v5의 추가 디테일 부품 479개는 개별 GLB에서 확인.
- 기본 색상 이미지 256x256px가 GLB 내부에 포함되어 있으므로 텍스처 연결 없이 색상 확인 가능.
- 별도 HQ 소재 라이브러리의 JPEG 파일은 768x768px. 이를 4K라고 표기하지 않음.
- 이전 별도 4K 아틀라스는 본 버전의 새로운 부분별 착색과 구조가 다르며, 자동 호환이라고 가정하면 안 됨.

사용 순서:
1) INDIVIDUAL_PART_01, PART_02 ZIP을 같은 폴더에 압축 해제 (models/ 가 합쳐짐)
2) Blender 열기 > File > Import > glTF 2.0 (.glb)에서 F01... 파일 선택
3) Material Preview에서 실제 착색 확인
4) 전체 배치만 필요한 경우 GUARDHOUSE_CAMPUS_PLACED_37_COLORED_v6.glb 바로 가져오기
5) HQ 재질 선택사항: 768px 텍스처 팩을 같은 폴더에 풀어 textures_HQ/ 만들기
6) scripts/Blender_Import_Color_Guardhouse_v6.py 를 Blender Scripting > Text > Open > Run Script 실행
   Script는 개별 37종을 합치고, HQ 재질이 있으면 적용하며, .blend 파일을 PC에 저장. 덮어쓰지 않음.
   기존 장면에 추가하기 때문에 먼저 빈 프로젝트에서 실행 추천.
7) 스크립트 상단 RENDER_ON_FINISH=True로 바꾸면 PC Blender에서 Cycles PNG 렌더를 수행.

제한:
- 실제 상업용 스캔 데이터나 ZBrush 수작업의 고해상도 포토리얼 최종 모델은 아님.
- 실제 Blender에서 스크립트를 실행/렌더한 것은 아니며 로컬 실행이 필요.
- 30MB/파일 제한에 맞춰 ZIP을 분리. 함께 압축 해제 후 같은 폴더에 배치.
