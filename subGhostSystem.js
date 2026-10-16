/**
 * [Module 11] 서브 NPC 유령 시트지 3D 렌더링 & 구역별 이벤트
 * (사용자 제공 코드 — 게임 연결은 game.js 의 "서브 유령 연결" 부분)
 * 시트지 이미지: assets/img/sub_ghost_sheet.png (또는 .webp) — 파일이 있을 때만 게임이 유령을 배치한다
 */
import * as THREE from './vendor/three.module.js';
/**
 * ============================================================================
 * 〈폐교: 잊혀진 시간〉 서브 NPC 유령 시트지 3D 렌더링 & 구역별 이벤트 시스템
 * - 시트지(Atlas) UV 크롭 + 어두운 배경 자동 알파 크로마키 + PBR 재질 추출
 * - GLB/FBX 외부 모델이 있으면 GLTFLoader로 로드하고, 없으면 시트지 기반
 *   고품질 3D 하이브리드 메쉬(PBR 관절 바디 + 고해상도 시트지 레이어)로 자동 렌더링!
 * ============================================================================
 */
class SubGhostNPCSheetSystem {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.audioCtx = null;

    // 업로드한 시트지 이미지 기본 경로 (프로젝트 내 저장 경로에 맞게 변경 가능)
    this.sheetUrl = "assets/img/sub_ghost_sheet.webp";
    this.sheetImage = null;
    this.isLoaded = false;

    // 생성된 서브 유령 NPC 인스턴스 목록
    this.ghostInstances = [];
    this.extractedPBR = {};

    // =========================================================================
    // [시트지 정밀 좌표 매핑] (0.0 ~ 1.0 정규화 비율 좌표: x, y, w, h)
    // =========================================================================
    // 1) 복장 및 타입 변형 8종 (중단 좌측 박스: y=0.385 ~ 0.618)
    this.OUTFITS = {
      default_uniform: { name: "기본 교복형",     uv: [0.012, 0.392, 0.052, 0.215], zone: "교실 유령" },
      bloody_uniform:  { name: "피 묻은 교복형",   uv: [0.064, 0.392, 0.052, 0.215], zone: "화장실 유령" },
      old_uniform:     { name: "오래된 교복형",   uv: [0.116, 0.392, 0.054, 0.215], zone: "계단 유령" },
      white_dress:     { name: "흰 원피스형",     uv: [0.170, 0.392, 0.052, 0.215], zone: "복도 유령" },
      gym_suit:        { name: "체육복형",       uv: [0.222, 0.392, 0.052, 0.215], zone: "체육관 유령" },
      art_apron:       { name: "미술실 앞치마형", uv: [0.274, 0.392, 0.054, 0.215], zone: "미술실 유령" },
      umbrella_girl:   { name: "우산 소녀형",     uv: [0.328, 0.392, 0.054, 0.215], zone: "음악실 유령" },
      rooftop_suicide: { name: "옥상 자살형",     uv: [0.382, 0.375, 0.065, 0.232], zone: "옥상 유령" }
    };

    // 2) 얼굴 표정(감정) 8종 (우측 상단 4x2 그리드: x=0.730~0.988, y=0.045~0.335)
    this.EXPRESSIONS = {
      neutral:   { name: "기본 표정", uv: [0.732, 0.048, 0.062, 0.130] },
      sad:       { name: "슬픔",     uv: [0.796, 0.048, 0.062, 0.130] },
      angry:     { name: "분노",     uv: [0.860, 0.048, 0.062, 0.130] },
      scream:    { name: "비명",     uv: [0.924, 0.048, 0.062, 0.130] },
      blank:     { name: "무표정",   uv: [0.732, 0.195, 0.062, 0.130] },
      crying:    { name: "울음",     uv: [0.796, 0.195, 0.062, 0.130] },
      creepy:    { name: "소름",     uv: [0.860, 0.195, 0.062, 0.130] },
      empty:     { name: "공허",     uv: [0.924, 0.195, 0.062, 0.130] }
    };

    // 3) 주요 애니메이션 포즈 8종 (하단 좌측 박스: x=0.012~0.518, y=0.665~0.810)
    this.ANIMATIONS = {
      idle:       { name: "대기",         uv: [0.014, 0.668, 0.056, 0.138] },
      walk:       { name: "걷기",         uv: [0.070, 0.668, 0.056, 0.138] },
      float:      { name: "부유 이동",     uv: [0.126, 0.668, 0.062, 0.138] },
      run:        { name: "달리기",       uv: [0.188, 0.668, 0.062, 0.138] },
      attack:     { name: "공격(손 뻗기)", uv: [0.250, 0.668, 0.064, 0.138] },
      fade:       { name: "사라짐(페이드)", uv: [0.314, 0.668, 0.060, 0.138] },
      crawl:      { name: "기어가기",     uv: [0.374, 0.668, 0.076, 0.138] },
      behind_you: { name: "등 뒤 출현",   uv: [0.450, 0.668, 0.066, 0.138] }
    };

    // 4) 소품 및 악세서리 5종 (중단 우측 끝 박스: x=0.812~0.990, y=0.380~0.610)
    this.PROPS = {
      umbrella:   { name: "우산",       uv: [0.814, 0.382, 0.068, 0.115] },
      doll:       { name: "인형",       uv: [0.884, 0.382, 0.045, 0.115] },
      sketchbook: { name: "스케치북",   uv: [0.930, 0.382, 0.058, 0.115] },
      palette:    { name: "물감 / 붓",   uv: [0.814, 0.502, 0.095, 0.105] },
      schoolbag:  { name: "가방",       uv: [0.912, 0.502, 0.078, 0.105] }
    };

    // 5) 우측 하단 PBR 텍스처 스와치 영역 (3D 메쉬 표면에 직접 타일링 매핑용)
    this.PBR_SWATCHES = {
      normalMap:    [0.625, 0.665, 0.066, 0.062],
      roughnessMap: [0.702, 0.665, 0.066, 0.062],
      skinTex:      [0.540, 0.742, 0.068, 0.062],
      eyeTex:       [0.612, 0.742, 0.064, 0.062],
      hairTex:      [0.680, 0.742, 0.066, 0.062],
      plaidSkirt:   [0.750, 0.742, 0.082, 0.062],
      bloodyCloth:  [0.836, 0.742, 0.078, 0.062],
      whiteDress:   [0.918, 0.742, 0.072, 0.062]
    };

    this._injectJumpscareOverlay();
  }

  /* =========================================================
     1. 시트지 이미지 로드 및 PBR 스와치 추출 초기화
     ========================================================= */
  async init({ scene, camera, audioCtx, sheetUrl } = {}) {
    this.scene = scene || window.scene;
    this.camera = camera || window.camera;
    this.audioCtx = audioCtx || window.audioCtx;
    if (sheetUrl) this.sheetUrl = sheetUrl;

    await this._loadSheetImage(this.sheetUrl);
    if (this.sheetImage) {
      this._extractPBRSwatchesFromSheet();
    }
    console.log("[SubGhostNPCSheetSystem] 서브 NPC 유령 시트지 3D 엔진 초기화 완료");
  }

  _loadSheetImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        this.sheetImage = img;
        this.isLoaded = true;
        resolve(img);
      };
      img.onerror = () => {
        console.warn("[SubGhostNPC] 시트지 이미지를 찾을 수 없어 절차적 폴백 텍스처로 구동합니다:", url);
        this.isLoaded = false;
        resolve(null);
      };
      img.src = url;
    });
  }

  /* =========================================================
     2. 핵심 기술: 시트지 특정 영역(UV) 크롭 + 어두운 배경 자동 투명화(Chroma-Key)
     * - 시트지의 검은/남색 배경(#0a1017)을 깔끔하게 알파=0으로 날리고 캐릭터만 추출!
     ========================================================= */
  cropSheetRegionToTexture(uvRect, { removeDarkBg = true, addGhostRim = true } = {}) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 768;
    const ctx = canvas.getContext("2d");

    if (this.sheetImage) {
      const [ux, uy, uw, uh] = uvRect;
      const sx = ux * this.sheetImage.width;
      const sy = uy * this.sheetImage.height;
      const sw = uw * this.sheetImage.width;
      const sh = uh * this.sheetImage.height;

      ctx.drawImage(this.sheetImage, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

      if (removeDarkBg) {
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const w = canvas.width;
        const h = canvas.height;

        for (let i = 0; i < data.length; i += 4) {
          const pxIdx = i / 4;
          const x = pxIdx % w;
          const y = Math.floor(pxIdx / w);

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // 시트지 특유의 어두운 청록/남색 배경(밝기가 낮고 푸른기가 살짝 도는 외곽) 판별
          const luma = 0.299 * r + 0.587 * g + 0.114 * b;
          const isBorderArea = (x < 28 || x > w - 28 || y < 24 || y > h - 38);
          const isSheetBgColor = (r < 34 && g < 44 && b < 52 && b >= r);

          if ((isSheetBgColor && luma < 36) || (isBorderArea && luma < 52)) {
            data[i + 3] = 0; // 완전 투명화
          } else if (isSheetBgColor && luma < 48) {
            // 경계선 소프트 페더링 (계단현상 방지)
            data[i + 3] = Math.floor(((luma - 36) / 12) * 255);
          }

          // 하단 텍스트 라벨 영역(예: '기본 교복형') 자동 마스킹 제거
          if (y > h * 0.93) {
            data[i + 3] = 0;
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }
    } else {
      // 이미지 파일 로드 전 폴백(Fallback) 창백한 여고생 유령 실루엣 렌더링
      this._drawProceduralFallbackGhost(ctx, canvas.width, canvas.height);
    }

    if (addGhostRim) {
      ctx.globalCompositeOperation = "source-atop";
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, "rgba(180, 220, 255, 0.08)");
      grad.addColorStop(0.75, "rgba(0, 0, 0, 0)");
      grad.addColorStop(1, "rgba(10, 18, 24, 0.65)"); // 발끝은 어둠 속으로 페이드아웃
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  // 시트지 우측 하단 PBR 텍스처 패치들을 3D 메쉬용 타일링 텍스처로 추출
  _extractPBRSwatchesFromSheet() {
    for (const [key, uv] of Object.entries(this.PBR_SWATCHES)) {
      const tex = this.cropSheetRegionToTexture(uv, { removeDarkBg: false, addGhostRim: false });
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(2, 2);
      this.extractedPBR[key] = tex;
    }
  }

  /* =========================================================
     3. 3D 유령 NPC 스폰 (PBR 3D 관절 마네킹 + 시트지 고해상도 레이어 결합)
     * @param {string} outfitKey - 'default_uniform' | 'bloody_uniform' | 'white_dress' 등 8종
     * @param {string} expressionKey - 'neutral' | 'sad' | 'angry' | 'scream' | 'creepy' 등 8종
     * @param {string} animState - 'idle' | 'walk' | 'float' | 'crawl' | 'attack' 등 8종
     * @param {string} propKey - 'umbrella' | 'doll' | 'sketchbook' | 'palette' | 'schoolbag'
     ========================================================= */
  spawnGhostNPC({
    id = "ghost_npc_1",
    position = new THREE.Vector3(0, 0, 0),
    outfitKey = "default_uniform",
    expressionKey = "sad",
    animState = "idle",
    propKey = null,
    behavior = "haunt", // 'haunt'(자리 지킴) | 'patrol'(복도 부유) | 'weeping'(안 볼 때 접근) | 'mirror'(거울)
    dialogue = "다들... 여기 있어..."
  } = {}) {
    if (!this.scene) return null;

    const root = new THREE.Group();
    root.position.copy(position);

    const outfitInfo = this.OUTFITS[outfitKey] || this.OUTFITS.default_uniform;
    const bodyTex = this.cropSheetRegionToTexture(outfitInfo.uv);

    // ---------------------------------------------------------
    // [레이어 A] 시트지 고해상도 입체 빌보드/크로스 플레인 (일러스트 디테일 100% 보존)
    // ---------------------------------------------------------
    const spriteMat = new THREE.MeshStandardMaterial({
      map: bodyTex,
      normalMap: this.extractedPBR.normalMap || null,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.65,
      metalness: 0.1,
      transparent: true,
      alphaTest: 0.08,
      side: THREE.DoubleSide
    });

    const mainPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.78), spriteMat);
    mainPlane.position.set(0, 0.89, 0);
    root.add(mainPlane);

    // ---------------------------------------------------------
    // [레이어 B] 내부 3D 볼륨 코어 (손전등 비췄을 때 실제 3D 그림자와 입체 실루엣 생성)
    // - 시트지에서 추출한 피부/체크치마/원피스 PBR 텍스처를 입힌 3D 바디
    // ---------------------------------------------------------
    const volumeCore = this._build3DPBRCoreMesh(outfitKey);
    root.add(volumeCore);

    // ---------------------------------------------------------
    // [레이어 C] 감정 표정(8종) 실시간 교체용 헤드 오버레이 레이어
    // ---------------------------------------------------------
    const expInfo = this.EXPRESSIONS[expressionKey] || this.EXPRESSIONS.neutral;
    const faceTex = this.cropSheetRegionToTexture(expInfo.uv);
    const faceMat = new THREE.MeshBasicMaterial({
      map: faceTex,
      transparent: true,
      opacity: 0.0, // 평소엔 기본 전신 표정, 이벤트 시 1.0으로 전환하여 표정 변화!
      depthWrite: false
    });
    const faceOverlay = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.36), faceMat);
    faceOverlay.position.set(0, 1.54, 0.03);
    root.add(faceOverlay);

    // ---------------------------------------------------------
    // [레이어 D] 시트지 소품(우산, 인형, 스케치북, 물감/칼, 가방) 3D 손 부착
    // ---------------------------------------------------------
    let propMesh = null;
    if (propKey && this.PROPS[propKey]) {
      const propTex = this.cropSheetRegionToTexture(this.PROPS[propKey].uv);
      propMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.55, 0.55),
        new THREE.MeshStandardMaterial({ map: propTex, transparent: true, side: THREE.DoubleSide })
      );
      propMesh.position.set(0.34, 0.95, 0.12);
      root.add(propMesh);
    }

    // 유령 주변 차가운 창백한 오라 조명
    const ghostLight = new THREE.PointLight(0x6688aa, 0.45, 3.8);
    ghostLight.position.set(0, 1.2, 0.3);
    root.add(ghostLight);

    this.scene.add(root);

    const ghostInstance = {
      id,
      root,
      mainPlane,
      volumeCore,
      faceOverlay,
      propMesh,
      ghostLight,
      outfitKey,
      expressionKey,
      animState,
      behavior,
      dialogue,
      baseY: position.y,
      phase: Math.random() * Math.PI * 2,
      opacity: 1.0,
      isTriggered: false,

      // 실시간 표정 변경 메서드 ('neutral'|'sad'|'angry'|'scream'|'blank'|'crying'|'creepy'|'empty')
      setExpression: (newExpKey) => {
        if (!this.EXPRESSIONS[newExpKey]) return;
        ghostInstance.expressionKey = newExpKey;
        faceOverlay.material.map = this.cropSheetRegionToTexture(this.EXPRESSIONS[newExpKey].uv);
        faceOverlay.material.opacity = 0.95;
        faceOverlay.material.needsUpdate = true;
      },

      // 실시간 애니메이션 포즈 변경 메서드 ('idle'|'walk'|'float'|'run'|'attack'|'fade'|'crawl'|'behind_you')
      setAnimationPose: (newAnimKey) => {
        if (!this.ANIMATIONS[newAnimKey]) return;
        ghostInstance.animState = newAnimKey;
        mainPlane.material.map = this.cropSheetRegionToTexture(this.ANIMATIONS[newAnimKey].uv);
        mainPlane.material.needsUpdate = true;
        // 기어가기(crawl) 포즈일 때는 높이를 바닥으로 낮춤
        if (newAnimKey === "crawl") {
          mainPlane.scale.set(1.25, 0.65, 1);
          mainPlane.position.y = 0.45;
        } else {
          mainPlane.scale.set(1, 1, 1);
          mainPlane.position.y = 0.89;
        }
      },

      // 실시간 복장 변경 메서드
      setOutfit: (newOutfitKey) => {
        if (!this.OUTFITS[newOutfitKey]) return;
        ghostInstance.outfitKey = newOutfitKey;
        mainPlane.material.map = this.cropSheetRegionToTexture(this.OUTFITS[newOutfitKey].uv);
        mainPlane.material.needsUpdate = true;
      }
    };

    this.ghostInstances.push(ghostInstance);
    return ghostInstance;
  }

  // 시트지 우측 하단 PBR 스와치(피부, 체크치마, 원피스, 머리카락)가 입혀진 내부 3D 입체 마네킹
  _build3DPBRCoreMesh(outfitKey) {
    const coreGroup = new THREE.Group();
    const isDress = (outfitKey === "white_dress" || outfitKey === "rooftop_suicide");
    const isBloody = (outfitKey === "bloody_uniform" || outfitKey === "old_uniform");

    const skinMat = new THREE.MeshStandardMaterial({
      map: this.extractedPBR.skinTex || null,
      color: 0xc8c2c0,
      roughness: 0.75
    });
    const hairMat = new THREE.MeshStandardMaterial({
      map: this.extractedPBR.hairTex || null,
      color: 0x161518,
      roughness: 0.85
    });
    const topMat = new THREE.MeshStandardMaterial({
      map: isBloody ? this.extractedPBR.bloodyCloth : (this.extractedPBR.whiteDress || null),
      color: isBloody ? 0x8a4545 : 0xd0ccc5,
      roughness: 0.8
    });
    const skirtMat = new THREE.MeshStandardMaterial({
      map: isDress ? this.extractedPBR.whiteDress : (this.extractedPBR.plaidSkirt || null),
      color: isDress ? 0xc8c6c0 : 0x2c333d,
      roughness: 0.78
    });

    // 머리 + 긴 생머리 볼륨
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 12), skinMat);
    head.position.set(0, 1.54, -0.04);
    const hairBack = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.42, 10), hairMat);
    hairBack.position.set(0, 1.42, -0.07);

    // 상체 블라우스/원피스
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.44, 10), topMat);
    torso.position.set(0, 1.18, -0.04);

    // 체크 교복 치마 or 긴 원피스 자락
    const skirtH = isDress ? 0.68 : 0.36;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.24, skirtH, 12), skirtMat);
    skirt.position.set(0, isDress ? 0.68 : 0.82, -0.04);

    coreGroup.add(head, hairBack, torso, skirt);
    // 시트지 메인 플레인 바로 뒤에서 입체 그림자와 측면 볼륨을 형성
    coreGroup.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return coreGroup;
  }

  /* =========================================================
     4. 시트지 하단 「게임 내 렌더링 예시 6대 구역 이벤트」 일괄 배치
     * - 1) 교실 등장  2) 복도 이동  3) 근접 연출  4) 계단 출현  5) 화장실 거울  6) 미술실 이벤트
     ========================================================= */
  setupSixSheetEvents({
    classroomPos = new THREE.Vector3(-12, 0, -8),
    corridorPos  = new THREE.Vector3(0, 0, -14),
    stairsPos    = new THREE.Vector3(8, 2.2, -10),
    restroomPos  = new THREE.Vector3(-8, 0, 6),
    artRoomPos   = new THREE.Vector3(14, 0, 8),
    rooftopPos   = new THREE.Vector3(0, 6.0, -6)
  } = {}) {
    // ① [교실 등장] 책상에 앉아 스케치북에 무언가 적고 있는 기본 교복형 유령
    this.spawnGhostNPC({
      id: "event_classroom_ghost",
      position: classroomPos,
      outfitKey: "default_uniform",
      expressionKey: "blank",
      animState: "idle",
      propKey: "sketchbook",
      behavior: "haunt",
      dialogue: "다들... 여기 있어... 내 자리 지우지 마..."
    });

    // ② [복도 이동] 복도 안개 속을 공중 부유하며 배회하는 흰 원피스형 유령
    this.spawnGhostNPC({
      id: "event_corridor_ghost",
      position: corridorPos,
      outfitKey: "white_dress",
      expressionKey: "empty",
      animState: "float",
      behavior: "patrol",
      dialogue: "집에 갈 시간이 지났는데..."
    });

    // ③ [계단 출현] 계단참 위에서 내려다보다가 가까워지면 기어 내려오는 유령
    this.spawnGhostNPC({
      id: "event_stairs_ghost",
      position: stairsPos,
      outfitKey: "old_uniform",
      expressionKey: "creepy",
      animState: "idle",
      behavior: "stairs_ambush",
      dialogue: "위층엔... 아무도 없어..."
    });

    // ④ [화장실 거울] 세면대 거울을 바라보고 서 있다가 플레이어가 다가가면 고개만 180도 돌리는 유령
    this.spawnGhostNPC({
      id: "event_restroom_mirror_ghost",
      position: restroomPos,
      outfitKey: "bloody_uniform",
      expressionKey: "crying",
      animState: "behind_you",
      behavior: "mirror",
      dialogue: "거울 속에... 내가 안 보여..."
    });

    // ⑤ [미술실 이벤트] 피 묻은 캔버스 이젤 앞에서 붓과 팔레트를 들고 서 있는 앞치마 유령
    this.spawnGhostNPC({
      id: "event_artroom_ghost",
      position: artRoomPos,
      outfitKey: "art_apron",
      expressionKey: "angry",
      animState: "idle",
      propKey: "palette",
      behavior: "art_event",
      dialogue: "빨간색이... 아직 부족해..."
    });

    // ⑥ [옥상 유령] 비 오는 옥상 난간 앞에 우산을 쓰고 서 있는 유령
    this.spawnGhostNPC({
      id: "event_rooftop_ghost",
      position: rooftopPos,
      outfitKey: "rooftop_suicide",
      expressionKey: "sad",
      animState: "idle",
      propKey: "umbrella",
      behavior: "haunt",
      dialogue: "아래에서... 누가 내 이름을 불렀어..."
    });
  }

  /* =========================================================
     5. 시트지 하단 3번째 컷: 「근접 연출 (Close-up Scream)」 발동기
     ========================================================= */
  triggerCloseUpEncounter(ghostInstance, notifyFn, subtitleFn) {
    if (!ghostInstance || ghostInstance.isTriggered) return;
    ghostInstance.isTriggered = true;

    // Story encounter only: no attack pose, full-screen scream or fear penalty.
    ghostInstance.setExpression("sad");
    ghostInstance.setAnimationPose("idle");
    const line = ghostInstance.dialogue || "다들... 여기 있어...";
    if (subtitleFn) subtitleFn("유령", line);
    else if (notifyFn) notifyFn(`👻 "${line}"`);

    // 1.8초 뒤 '사라짐(페이드)' 애니메이션 상태로 전환되며 연기처럼 소멸
    setTimeout(() => {
      ghostInstance.setAnimationPose("fade");
      ghostInstance.behavior = "fading_out";
    }, 1800);
  }

  /* =========================================================
     6. 매 프레임 업데이트 (부유 모션, 시선 추적, 근접 이벤트 트리거, 페이드아웃)
     ========================================================= */
  update(dt = 0.016, playerPos, notifyFn, subtitleFn) {
    if (!playerPos) return;

    for (let i = this.ghostInstances.length - 1; i >= 0; i--) {
      const g = this.ghostInstances[i];
      g.phase += dt * 2.4;

      // 카메라를 향해 Y축 빌보드 회전 (단, 옆면 3D 코어는 자연스럽게 유지)
      if (this.camera) {
        g.mainPlane.lookAt(this.camera.position.x, g.root.position.y + 0.89, this.camera.position.z);
        g.faceOverlay.lookAt(this.camera.position.x, g.root.position.y + 1.54, this.camera.position.z);
      }

      const dist = g.root.position.distanceTo(playerPos);

      // 1) 부유 이동(float) 및 복도 배회(patrol) 모션
      if (g.animState === "float" || g.behavior === "patrol") {
        g.root.position.y = g.baseY + Math.sin(g.phase) * 0.14 + 0.12;
        g.root.position.z += Math.cos(g.phase * 0.5) * dt * 0.65;
      } else {
        // 미세한 호흡/떨림
        g.mainPlane.position.x = Math.sin(g.phase * 7) * 0.006;
      }

      // 3) 플레이어가 2.3m 이내로 근접 시 '근접 연출(손 뻗기 + 비명 표정 + 대사)' 발동!
      if (dist < 2.3 && !g.isTriggered && g.behavior !== "fading_out") {
        this.triggerCloseUpEncounter(g, notifyFn, subtitleFn);
      }

      // 4) 사라짐(페이드) 처리
      if (g.behavior === "fading_out") {
        g.opacity -= dt * 0.85;
        g.mainPlane.material.opacity = Math.max(0, g.opacity);
        g.ghostLight.intensity = Math.max(0, g.opacity * 0.45);
        if (g.opacity <= 0) {
          this.scene.remove(g.root);
          this.ghostInstances.splice(i, 1);
        }
      }
    }
  }

  _injectJumpscareOverlay() {
    if (document.getElementById("patch-subghost-closeup")) return;
    const style = document.createElement("style");
    style.textContent = `
      #patch-subghost-closeup {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 9992;
        opacity: 0;
        background: radial-gradient(circle, rgba(180,20,20,0.25) 0%, rgba(5,8,12,0.92) 85%);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.08s ease;
      }
      #patch-subghost-closeup.active {
        opacity: 1;
        animation: ghostCloseupShake 0.09s infinite;
      }
      #patch-subghost-closeup .ghost-quote {
        position: absolute;
        bottom: 14%;
        color: #e8e2dc;
        font-size: 24px;
        font-family: serif;
        letter-spacing: 3px;
        text-shadow: 0 0 12px #ff1a1a, 2px 0 #00ffff;
      }
      @keyframes ghostCloseupShake {
        0%   { transform: scale(1.04) translate(-4px, 2px); }
        50%  { transform: scale(1.08) translate(4px, -3px); }
        100% { transform: scale(1.05) translate(-2px, -2px); }
      }
    `;
    document.head.appendChild(style);

    const el = document.createElement("div");
    el.id = "patch-subghost-closeup";
    el.innerHTML = `<div class="ghost-quote">“다들... 여기 있어...”</div>`;
    document.body.appendChild(el);
  }

  _drawProceduralFallbackGhost(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
    // 창백한 얼굴과 붉은 리본 교복, 검은 긴 머리 실루엣
    ctx.fillStyle = "#141619";
    ctx.beginPath(); ctx.arc(w / 2, 150, 75, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(w / 2 - 70, 150, 140, 180);

    ctx.fillStyle = "#c8c4c2";
    ctx.beginPath(); ctx.arc(w / 2, 155, 52, 0, Math.PI * 2); ctx.fill();

    // 충혈된 눈과 붉은 눈물
    ctx.fillStyle = "#1a0808";
    ctx.beginPath(); ctx.arc(w / 2 - 20, 152, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w / 2 + 20, 152, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#8a1111";
    ctx.fillRect(w / 2 - 22, 160, 4, 24);
    ctx.fillRect(w / 2 + 18, 160, 4, 28);

    // 피 묻은 흰 교복 셔츠 & 붉은 리본
    ctx.fillStyle = "#b8b4ad";
    ctx.fillRect(w / 2 - 68, 230, 136, 195);
    ctx.fillStyle = "#6e1414";
    ctx.beginPath(); ctx.moveTo(w / 2, 245); ctx.lineTo(w / 2 - 24, 285); ctx.lineTo(w / 2 + 24, 285); ctx.fill();

    // 체크 교복 치마
    ctx.fillStyle = "#262c36";
    ctx.beginPath();
    ctx.moveTo(w / 2 - 68, 425);
    ctx.lineTo(w / 2 + 68, 425);
    ctx.lineTo(w / 2 + 95, 580);
    ctx.lineTo(w / 2 - 95, 580);
    ctx.closePath();
    ctx.fill();
  }

  _playGhostWhisperAndScream() {
    if (!this.audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AC();
    }
    const ctx = this.audioCtx;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;

    // 불협화음 여성 비명 포먼트 신디사이저
    [587.33, 622.25, 880.0].forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.35, now + 0.18);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.75, now + 0.65);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.7);
    });
  }
}

window.subGhostSystem = new SubGhostNPCSheetSystem();
export { SubGhostNPCSheetSystem };
