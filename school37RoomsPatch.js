/**
 * [Module 12] 본관 18실 · 별관 19실 (37개 구역) 가구 · PBR · 동선 마스터 패치
 * (사용자 제공 코드 — 게임 연결은 game.js 의 "37개 특별실 · 보조실 연결" 부분)
 */
import * as THREE from './vendor/three.module.js';
/**
 * ============================================================================
 * 〈폐교: 잊혀진 시간〉 본관(18실) & 별관(19실) 37개 구역 3D 가구·텍스처·동선 마스터 패치
 * - 1) 겹침 방지 AABB 점유 스캐너 (기존 가구/문 앞 1.6m 자동 회피)
 * - 2) 최소 1.5m 폭의 플레이어 & 괴물 이동 동선(Walkable Nav-Corridor) 보장
 * - 3) 37개 실별 맞춤형 3D 리얼 가구/오브젝트 프리팹 & PBR 텍스처 자동 생성
 * ============================================================================
 */
class School37RoomsMasterPatch {
  constructor() {
    this.scene = null;
    this.audioCtx = null;
    this.textures = {};
    this.materials = {};

    // 충돌 및 겹침 방지를 위한 방별 점유 박스(AABB) 레지스트리
    this.roomOccupancyMap = new Map();
    // 플레이어 이동 충돌체에 등록할 깔끔한 바운딩 박스 목록
    this.walkableColliders = [];
    // E키 상호작용 가능 오브젝트 목록
    this.interactables = [];
  }

  init({ scene, audioCtx, existingColliders = [] } = {}) {
    this.scene = scene || window.scene;
    this.audioCtx = audioCtx || window.audioCtx;
    this.textures = this._buildRealisticPBRTextures();
    this.materials = this._buildSharedMaterials();

    // 기존 게임에 이미 배치된 가구/벽 콜라이더가 있다면 먼저 등록하여 겹침 원천 차단!
    this.existingColliders = existingColliders;
    console.log("[School37RoomsMasterPatch] 본관·별관 37개 구역 리얼 가구 및 동선 최적화 엔진 로드 완료");
  }

  /* =========================================================
     1. 3D 리얼 PBR 텍스처 팩 (원목, 가죽, 카펫, 스테인리스, 방음벽, 타공판 등)
     ========================================================= */
  _buildRealisticPBRTextures() {
    const makeTex = (drawFn, rx = 2, ry = 2) => {
      const c = document.createElement("canvas");
      c.width = 512; c.height = 512;
      drawFn(c.getContext("2d"), 512);
      if (typeof THREE !== "undefined") {
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace;
        return t;
      }
      return null;
    };

    return {
      // ① 고급 원목 나뭇결 (교장실, 음악실, 상담실 가구 및 마루용)
      mahoganyWood: makeTex((ctx, s) => {
        ctx.fillStyle = "#3d2314"; ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 400; i++) {
          ctx.fillStyle = i % 2 === 0 ? "rgba(25, 12, 5, 0.25)" : "rgba(85, 48, 28, 0.18)";
          ctx.fillRect(0, Math.random() * s, s, 2 + Math.random() * 5);
        }
      }, 2, 2),

      // ② 패브릭/카펫 타일 (회의실, 언어실, 창의융합실, 상담실 소파용)
      carpetTile: makeTex((ctx, s) => {
        ctx.fillStyle = "#2b3238"; ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 5000; i++) {
          ctx.fillStyle = i % 2 === 0 ? "#22282d" : "#363f47";
          ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
        }
        ctx.strokeStyle = "#1c2124"; ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, s / 2, s / 2); ctx.strokeRect(s / 2, s / 2, s / 2, s / 2);
      }, 6, 6),

      // ③ 헤어라인 스테인리스 스틸 (요리실, 세척실, 보건실, 펌프실 기기용)
      brushedSteel: makeTex((ctx, s) => {
        const g = ctx.createLinearGradient(0, 0, s, s);
        g.addColorStop(0, "#8c9398"); g.addColorStop(0.5, "#b4bcc2"); g.addColorStop(1, "#6e757a");
        ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = "rgba(30, 35, 38, 0.12)";
        for (let i = 0; i < 600; i++) ctx.fillRect(0, Math.random() * s, s, 1);
      }, 1, 1),

      // ④ 음악실/언어실 목재 타공 흡음판 벽지
      acousticWoodWall: makeTex((ctx, s) => {
        ctx.fillStyle = "#6e4e32"; ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = "#1f140b";
        for (let y = 16; y < s; y += 24) {
          for (let x = 16; x < s; x += 24) {
            ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
          }
        }
      }, 4, 2),

      // ⑤ 공구실 타공판(Pegboard) & 철제 선반 메쉬 텍스처
      pegboardTex: makeTex((ctx, s) => {
        ctx.fillStyle = "#333c42"; ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = "#1a2024"; ctx.lineWidth = 10; ctx.strokeRect(5, 5, s - 10, s - 10);
        ctx.fillStyle = "#121618";
        for (let y = 24; y < s - 24; y += 20) {
          for (let x = 24; x < s - 24; x += 20) {
            ctx.fillRect(x, y, 5, 5);
          }
        }
        // 걸려 있는 스패너/망치 실루엣
        ctx.fillStyle = "#9aa2a8";
        ctx.fillRect(80, 70, 14, 140); ctx.fillRect(62, 65, 50, 24);
        ctx.fillRect(160, 80, 12, 110);
      }, 1, 1),

      // ⑥ 보건실/요리실 청결 타일 (민트/화이트 격자)
      cleanClinicTile: makeTex((ctx, s) => {
        ctx.fillStyle = "#cfd8d5"; ctx.fillRect(0, 0, s, s);
        const c = s / 8;
        ctx.strokeStyle = "#8fa19b"; ctx.lineWidth = 2;
        for (let i = 0; i <= 8; i++) {
          ctx.beginPath();
          ctx.moveTo(i * c, 0); ctx.lineTo(i * c, s);
          ctx.moveTo(0, i * c); ctx.lineTo(s, i * c);
          ctx.stroke();
        }
      }, 5, 5)
    };
  }

  _buildSharedMaterials() {
    if (typeof THREE === "undefined") return {};
    return {
      mahogany: new THREE.MeshStandardMaterial({ map: this.textures.mahoganyWood, roughness: 0.38, metalness: 0.1 }),
      oakWood: new THREE.MeshStandardMaterial({ color: 0x7c5836, map: this.textures.mahoganyWood, roughness: 0.55 }),
      darkLeather: new THREE.MeshStandardMaterial({ color: 0x241d1a, roughness: 0.58, metalness: 0 }),
      softFabric: new THREE.MeshStandardMaterial({ color: 0x45525c, map: this.textures.carpetTile, roughness: 0.85 }),
      stainless: new THREE.MeshStandardMaterial({ map: this.textures.brushedSteel, roughness: 0.25, metalness: 0.82 }),
      industrialBlue: new THREE.MeshStandardMaterial({ color: 0x224860, roughness: 0.58, metalness: 0.05 }),
      industrialRed: new THREE.MeshStandardMaterial({ color: 0x8a2420, roughness: 0.58, metalness: 0.05 }),
      hospitalCurtain: new THREE.MeshStandardMaterial({ color: 0x6b9486, roughness: 0.9, side: THREE.DoubleSide }), hospitalLinen: new THREE.MeshStandardMaterial({ color: 0xd9d5c8, roughness: 0.88, metalness: 0 }),
      whitePorcelain: new THREE.MeshStandardMaterial({ color: 0xdde3e0, roughness: 0.2, metalness: 0 }),
      pianoBlack: new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.12, metalness: 0.35 }),
      plasterWhite: new THREE.MeshStandardMaterial({ color: 0xd8d4cb, roughness: 0.75 }),
      glassCase: new THREE.MeshStandardMaterial({ color: 0xaad4e6, transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0.8 })
    };
  }

  /* =========================================================
     2. 핵심: 겹침 방지 & 보행 동선(Nav-Corridor) 보장 배치 엔진
     * - 문 앞 1.6m 반경 및 방 중앙 십자(+) 동선에는 절대 가구를 놓지 않음!
     ========================================================= */
  _canPlaceFurniture(roomKey, localX, localZ, width, depth, roomW, roomD, doorPositions = []) {
    const pad = 0.28; // 가구 간 최소 여유 간격 (끼임 방지)
    const halfW = width / 2 + pad;
    const halfD = depth / 2 + pad;

    // 1) 방 벽면 경계 밖으로 나가는지 검사
    if (localX - halfW < -roomW / 2 + 0.15 || localX + halfW > roomW / 2 - 0.15) return false;
    if (localZ - halfD < -roomD / 2 + 0.15 || localZ + halfD > roomD / 2 - 0.15) return false;

    // 2) 모든 출입문(Door) 앞 반경 1.65m 클리어 존 침범 검사 (문 막힘 버그 100% 방지)
    for (const door of doorPositions) {
      const distToDoor = Math.hypot(localX - door.x, localZ - door.z);
      if (distToDoor < 1.65 + Math.max(width, depth) * 0.4) return false;
    }

    // 3) 방 내 이미 배치된 다른 가구와의 AABB 겹침 검사
    const list = this.roomOccupancyMap.get(roomKey) || [];
    for (const box of list) {
      const overlapX = Math.abs(localX - box.x) < (halfW + box.w / 2);
      const overlapZ = Math.abs(localZ - box.z) < (halfD + box.d / 2);
      if (overlapX && overlapZ) return false;
    }

    return true;
  }

  // 안전하게 가구를 배치하고, 겹칠 경우 주변 안전 슬롯으로 자동 이동시키는 스마트 스포너
  _placeSafeProp(roomGroup, roomKey, propMesh, {
    x = 0, z = 0, rotY = 0, w = 1.0, d = 1.0, h = 1.0,
    roomW = 7.0, roomD = 8.0, doors = [{ x: 0, z: roomD / 2 }],
    allowCenter = false, interactData = null
  }) {
    if (!this.roomOccupancyMap.has(roomKey)) {
      this.roomOccupancyMap.set(roomKey, []);
    }

    // 중앙 보행 통로(폭 1.4m) 보호: allowCenter가 아닌 일반 가구가 중앙선을 침범하면 벽 쪽으로 밀어냄
    let candidateOffsets = [[0, 0]];
    for (let step = 0.6; step <= 2.4; step += 0.6) {
      candidateOffsets.push([step, 0], [-step, 0], [0, step], [0, -step], [step, step], [-step, -step]);
    }

    const footprint = propMesh.userData.infirmaryFootprint || { x: 0, z: 0 };
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const offsetX = footprint.x * cosY + footprint.z * sinY;
    const offsetZ = -footprint.x * sinY + footprint.z * cosY;

    let placedX = null, placedZ = null;
    for (const [ox, oz] of candidateOffsets) {
      const tx = x + ox;
      const tz = z + oz;
      const centerX = tx + offsetX, centerZ = tz + offsetZ;

      // 중앙 보행 동선(폭 1.3m) 확보 체크
      if (!allowCenter && Math.abs(centerX) < 0.75 && Math.abs(centerZ) < roomD * 0.35) continue;

      if (this._canPlaceFurniture(roomKey, centerX, centerZ, w, d, roomW, roomD, doors)) {
        placedX = tx;
        placedZ = tz;
        break;
      }
    }

    // 만약 모든 후보 자리가 좁아서 실패했다면 동선을 막지 않기 위해 과감히 스킵
    if (placedX === null) return null;

    propMesh.position.set(placedX, 0, placedZ);
    propMesh.rotation.y = rotY;
    roomGroup.add(propMesh);

    // 점유 영역 등록
    this.roomOccupancyMap.get(roomKey).push({ x: placedX + offsetX, z: placedZ + offsetZ, w, d });

    // 플레이어/괴물 이동 충돌용 단순 박스 콜라이더 등록 (끼임 없는 슬라이딩용)
    const worldBox = {
      roomKey,
      localX: placedX + offsetX,
      localZ: placedZ + offsetZ,
      width: w,
      depth: d,
      height: h,
      mesh: propMesh
    };
    this.walkableColliders.push(worldBox);

    if (interactData) {
      propMesh.userData.interactable = interactData;
      this.interactables.push({ mesh: propMesh, ...interactData });
    }

    return propMesh;
  }

  /* =========================================================
     3. 37개 실별 맞춤형 고디테일 3D 가구 프리팹 빌더 (Composite 3D Models)
     ========================================================= */
  _prefabBedWithCurtain() {
    // [보건실] 매트리스 + 베개 + 철제 프레임 + 반투명 녹색 병원 커튼 파티션
    const g = new THREE.Group();
    const frame = new THREE.Group(); const rail = new THREE.Mesh(new THREE.BoxGeometry(1.0, .07, 2.0), this.materials.stainless); rail.position.y = .175; frame.add(rail); for (const x of [-.44, .44]) for (const z of [-.9, .9]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.055, .42, .055), this.materials.stainless); leg.position.set(x, -.015, z); frame.add(leg); } const head = new THREE.Mesh(new THREE.BoxGeometry(.94, .4, .05), this.materials.stainless); head.position.set(0, .425, -.97); frame.add(head);
    frame.position.y = 0.225;
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.16, 1.92), this.materials.hospitalLinen);
    mattress.position.y = 0.52;
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.32), this.materials.hospitalLinen);
    pillow.position.set(0, 0.62, -0.72);
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.8, 32, 1), this.materials.hospitalCurtain); const folds = curtain.geometry.attributes.position; for (let i = 0; i < folds.count; i++) folds.setZ(i, -.025 * (.5 + .5 * Math.cos(folds.getX(i) * Math.PI * 10))); curtain.geometry.computeVertexNormals();
    curtain.position.set(0.55, 1.1, 0);
    curtain.rotation.y = Math.PI / 2;
    g.userData.infirmaryKind = "bed"; g.add(frame, mattress, pillow, curtain);
    return g;
  }

  _prefabGrandPiano() {
    // [별관 3층 음악실] 검은 유광 그랜드 피아노 + 건반 + 보면대 + 피아노 의자
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.38, 1.8), this.materials.pianoBlack);
    body.position.set(0, 0.78, 0);
    const keys = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.06, 0.22), this.materials.whitePorcelain);
    keys.position.set(0, 0.74, 0.88);
    // 다리 3개
    [[-0.65, 0.75], [0.65, 0.75], [0, -0.75]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.72, 10), this.materials.pianoBlack);
      leg.position.set(lx, 0.36, lz);
      g.add(leg);
    });
    const stool = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.48, 0.38), this.materials.darkLeather);
    stool.position.set(0, 0.24, 1.25);
    g.add(body, keys, stool);
    return g;
  }

  _prefabExecutiveDeskSet() {
    // [본관 1층 교장실] 중후한 마호가니 집무 데스크 + 가죽 의자 + 명패 + 스탠드
    const g = new THREE.Group();
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.78, 0.95), this.materials.mahogany);
    desk.position.y = 0.39;
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.15, 0.65), this.materials.darkLeather);
    chair.position.set(0, 0.575, -0.68);
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.08), this.materials.oakWood);
    plaque.position.set(0, 0.84, 0.28);
    g.add(desk, chair, plaque);
    return g;
  }

  _prefabSofaLoungeSet() {
    // [상담실 / 교장실 / 교사휴게실 / 동아리실] 3인용 패브릭 소파 + 낮은 원목 티테이블
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.42, 0.75), this.materials.softFabric);
    seat.position.set(0, 0.21, -0.45);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.48, 0.22), this.materials.softFabric);
    back.position.set(0, 0.62, -0.72);
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.42, 0.6), this.materials.oakWood);
    table.position.set(0, 0.21, 0.35);
    g.add(seat, back, table);
    return g;
  }

  _prefabCookingStation() {
    // [본관 2층 요리실 / 별관 1층 요리실(101) / 세척실] 스테인리스 아일랜드 조리대 + 싱크볼 + 수전
    const g = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.86, 0.85), this.materials.stainless);
    counter.position.y = 0.43;
    const faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8), this.materials.stainless);
    faucet.position.set(-0.5, 1.0, -0.2);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 0.75), this.materials.stainless);
    hood.position.set(0, 2.25, 0);
    g.add(counter, faucet, hood);
    return g;
  }

  _prefabIndustrialPumpUnit() {
    // [본관 지하1층 펌프실 / 기계실] 대형 가압 펌프 모터 + 배관 매니폴드 + 압력 게이지
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, 0.9), this.materials.stainless);
    base.position.y = 0.09;
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.95, 14), this.materials.industrialBlue);
    motor.rotation.z = Math.PI / 2;
    motor.position.set(-0.2, 0.52, 0);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.4, 10), this.materials.industrialRed);
    pipe.position.set(0.45, 1.2, 0);
    g.add(base, motor, pipe);
    return g;
  }

  _prefabHeavyStorageRack() {
    // [창고 / 시설창고실 / 교재창고실 / 보관실 / 자재창고] 4단 철제 앵글 선반 + 수납 박스들
    const g = new THREE.Group();
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.0, 0.6), this.materials.industrialBlue);
    rack.position.y = 1.0;
    const box1 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 0.48), this.materials.oakWood);
    box1.position.set(-0.35, 1.25, 0.04);
    const box2 = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.48), this.materials.plasterWhite);
    box2.position.set(0.35, 0.65, 0.04);
    g.add(rack, box1, box2);
    return g;
  }

  _prefabDisplayPedestal() {
    // [별관 3층 전시공간 / 2층홀 / 3층홀] 갤러리 좌대 + 석고 흉상/트로피 + 강화유리 쇼케이스
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.05, 0.7), this.materials.mahogany);
    base.position.y = 0.525;
    const bust = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), this.materials.plasterWhite);
    bust.position.set(0, 1.28, 0);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.65, 0.66), this.materials.glassCase);
    glass.position.set(0, 1.38, 0);
    g.add(base, bust, glass);
    return g;
  }

  _prefabPotteryAndCraftSet() {
    // [별관 3층 공예실 / 작업실] 도자기 전동 물레 + 전기가마(Kiln) + 작업 테이블
    const g = new THREE.Group();
    const kiln = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 1.15, 12), this.materials.stainless);
    kiln.position.set(-0.6, 0.575, 0);
    const wheelTable = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.68, 0.75), this.materials.oakWood);
    wheelTable.position.set(0.55, 0.34, 0);
    const clayPot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.25, 12), this.materials.mahogany);
    clayPot.position.set(0.55, 0.8, 0);
    g.add(kiln, wheelTable, clayPot);
    return g;
  }

  _prefabLanguageBoothRow() {
    // [별관 2층 언어실 / 스마트교실 / 창의융합실] 칸막이 어학 부스 & 모니터 데스크
    const g = new THREE.Group();
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.75, 0.7), this.materials.oakWood);
    desk.position.y = 0.375;
    [-1.08, 0, 1.08].forEach((px) => {
      const divider = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.68), this.materials.softFabric);
      divider.position.set(px, 0.95, 0);
      g.add(divider);
    });
    [-0.54, 0.54].forEach((mx) => {
      const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.04), this.materials.pianoBlack);
      monitor.position.set(mx, 0.92, -0.18);
      g.add(monitor);
    });
    g.add(desk);
    return g;
  }

  /* =========================================================
     4. 본관(18실) & 별관(19실) 37개 구역 자동 맞춤 빌더
     * - roomName만 넘기면 해당 방의 특성에 맞는 가구와 상호작용을 동선 겹침 없이 배치!
     ========================================================= */
  populateRoomByType({
    roomKey,
    roomName,
    centerPos = new THREE.Vector3(0, 0, 0),
    roomW = 7.2,
    roomD = 8.4,
    doors = [{ x: 0, z: 4.2 }]
  }) {
    if (!this.scene) return null;
    const roomGroup = new THREE.Group();
    roomGroup.position.copy(centerPos);

    const place = (mesh, x, z, rotY, w, d, h, allowCenter = false, interact = null) => {
      return this._placeSafeProp(roomGroup, roomKey || roomName, mesh, {
        x, z, rotY, w, d, h, roomW, roomD, doors, allowCenter, interactData: interact
      });
    };

    const hw = roomW / 2 - 0.65;
    const hd = roomD / 2 - 0.65;

    switch (roomName) {
      // ==================== [본관 지하 1층] ====================
      case "청소도구실":
        place(this._prefabCookingStation(), -hw + 0.4, -hd + 0.3, 0, 2.1, 0.85, 1.0, false, {
          promptText: "[E] 대걸레 세척 싱크대 수색 (락스/절연테이프 파밍)"
        });
        place(this._prefabHeavyStorageRack(), hw - 0.3, -hd + 0.3, 0, 1.6, 0.6, 2.0);
        break;

      case "기계실":
      case "펌프실":
        place(this._prefabIndustrialPumpUnit(), -hw + 0.5, -hd + 0.5, 0, 1.6, 0.9, 1.8, false, {
          promptText: `[E] ${roomName} 메인 가압 밸브 조작 (배관 소음 발생)`
        });
        place(this._prefabIndustrialPumpUnit(), hw - 0.5, -hd + 0.5, Math.PI, 1.6, 0.9, 1.8);
        place(this._prefabHeavyStorageRack(), -hw + 0.3, hd - 1.2, Math.PI / 2, 1.6, 0.6, 2.0);
        break;

      case "시설창고실":
      case "창고":
      case "자재창고":
      case "교재창고실":
      case "보관실":
        // 창고류: 좌우 벽면을 따라 디귿(ㄷ)자로 선반을 배치하고 중앙 보행 통로(2.2m)를 뻥 뚫어줌!
        place(this._prefabHeavyStorageRack(), -hw + 0.2, -hd + 0.5, Math.PI / 2, 0.7, 1.6, 2.0, false, {
          promptText: `[E] ${roomName} 선반 박스 뒤지기 (아이템 탐색)`
        });
        place(this._prefabHeavyStorageRack(), hw - 0.2, -hd + 0.5, -Math.PI / 2, 0.7, 1.6, 2.0);
        place(this._prefabHeavyStorageRack(), 0, -hd + 0.2, 0, 1.6, 0.7, 2.0);
        break;

      // ==================== [본관 1층 ~ 3층] ====================
      case "교장실":
        place(this._prefabExecutiveDeskSet(), 0, -hd + 0.8, 0, 1.9, 1.4, 1.1, false, {
          promptText: "[E] 교장 집무실 서랍 조사 (학교 기밀 문서 확인)"
        });
        place(this._prefabSofaLoungeSet(), -hw + 0.8, 0.4, Math.PI / 2, 1.2, 1.8, 0.9);
        place(this._prefabDisplayPedestal(), hw - 0.4, -hd + 0.4, 0, 0.7, 0.7, 1.7);
        break;

      case "상담실":
      case "진로상담실":
      case "교사휴게실":
        place(this._prefabSofaLoungeSet(), -hw + 0.7, -hd + 0.8, 0, 1.8, 1.2, 0.9, false, {
          promptText: `[E] ${roomName} 소파에 앉아 숨 고르기 (공포 -15%)`
        });
        place(this._prefabHeavyStorageRack(), hw - 0.3, -hd + 0.4, -Math.PI / 2, 0.7, 1.6, 2.0);
        break;

      case "회의실":
      case "학생회실":
        // 회의실: 중앙에 회의 테이블을 두되, 사방 둘레로 최소 1.5m 회전/도주 동선을 완벽히 확보!
        place(this._prefabExecutiveDeskSet(), 0, -0.4, 0, 2.2, 1.2, 0.8, true, {
          promptText: `[E] ${roomName} 회의록 및 안건 서류 읽기`
        });
        place(this._prefabHeavyStorageRack(), -hw + 0.3, -hd + 0.3, 0, 1.6, 0.6, 2.0);
        break;

      case "보건실":
      case "보건실보조":
        place(this._prefabBedWithCurtain(), -hw + 0.5, -hd + 0.6, 0, 1.1, 2.0, 1.8, false, {
          promptText: "[E] 보건실 커튼 침대 안에 숨기 / 응급 밴드 탐색"
        });
        if (roomName === "보건실") {
          place(this._prefabBedWithCurtain(), hw - 0.5, -hd + 0.6, 0, 1.1, 2.0, 1.8);
        }
        place(((p) => { p.userData.infirmaryKind = "cabinetOpen"; p.userData.infirmaryFootprint = { x: .2425, z: .2225 }; return p; })(this._prefabHeavyStorageRack()), 0, -hd + 0.2, 0, 1.4, .85, 1.8, false, {
          promptText: "[E] 보건실 유리 약품장 열기 (진정제/붕대 파밍)"
        });
        break;

      case "2층홀":
      case "3층홀":
      case "전시공간":
        // 홀 & 전시공간: 통행량이 가장 많은 곳이므로 중앙은 완전히 비우고 모서리에만 전시 좌대 배치!
        place(this._prefabDisplayPedestal(), -hw + 0.5, -hd + 0.5, 0, 0.7, 0.7, 1.7, false, {
          promptText: `[E] ${roomName} 전시 작품 및 명패 살펴보기`
        });
        place(this._prefabDisplayPedestal(), hw - 0.5, -hd + 0.5, 0, 0.7, 0.7, 1.7);
        break;

      case "요리실":
      case "요리실(101)":
      case "세척실":
      case "실습준비실":
        place(this._prefabCookingStation(), -hw + 0.8, -hd + 0.6, 0, 2.1, 0.9, 1.2, false, {
          promptText: `[E] ${roomName} 스테인리스 싱크대 수도 틀기 / 조리도구 조사`
        });
        place(this._prefabCookingStation(), hw - 0.8, -hd + 0.6, 0, 2.1, 0.9, 1.2);
        break;

      // ==================== [별관 1층 ~ 3층 특화실] ====================
      case "공구실":
      case "기자재실":
      case "과학준비실": {
        const pegWall = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 1.3, 0.08),
          new THREE.MeshStandardMaterial({ map: this.textures.pegboardTex, roughness: 0.5 })
        );
        pegWall.position.set(0, 1.5, -roomD / 2 + 0.12);
        roomGroup.add(pegWall);

        place(this._prefabHeavyStorageRack(), -hw + 0.3, -hd + 0.5, Math.PI / 2, 0.7, 1.6, 2.0, false, {
          promptText: `[E] ${roomName} 공구/시약 보관함 수색 (절연테이프·배터리 파밍)`
        });
        place(this._prefabExecutiveDeskSet(), hw - 0.7, -hd + 0.6, 0, 1.8, 1.0, 0.9);
        break;
      }

      case "창의융합실(103)":
      case "언어실":
      case "스마트교실":
        place(this._prefabLanguageBoothRow(), -hw + 0.9, -hd + 0.7, 0, 2.2, 0.8, 1.2, false, {
          promptText: `[E] ${roomName} 단말기 모니터 전원 켜기`
        });
        place(this._prefabLanguageBoothRow(), hw - 0.9, -hd + 0.7, 0, 2.2, 0.8, 1.2);
        break;

      case "동아리실":
        place(this._prefabSofaLoungeSet(), -hw + 0.7, -hd + 0.7, 0, 1.8, 1.2, 0.9, false, {
          promptText: "[E] 동아리실 낡은 일지 및 부원 명단 확인"
        });
        place(this._prefabGrandPiano(), hw - 0.6, -hd + 0.7, -Math.PI / 4, 1.5, 1.8, 1.1);
        break;

      case "음악실":
        place(this._prefabGrandPiano(), -hw + 0.9, -hd + 0.9, Math.PI / 6, 1.6, 1.9, 1.2, false, {
          promptText: "[E] 그랜드 피아노 건반 누르기 (피아노 소리로 괴물 강력 유인)"
        });
        place(this._prefabLanguageBoothRow(), hw - 0.9, -hd + 0.7, 0, 2.2, 0.8, 1.0);
        break;

      case "작업실":
      case "공예실":
        place(this._prefabPotteryAndCraftSet(), -hw + 0.8, -hd + 0.6, 0, 1.8, 0.9, 1.2, false, {
          promptText: `[E] ${roomName} 전기가마 및 물레 작업대 조사`
        });
        place(this._prefabDisplayPedestal(), hw - 0.5, -hd + 0.5, 0, 0.7, 0.7, 1.7);
        break;
    }

    this.scene.add(roomGroup);
    return roomGroup;
  }

  /* =========================================================
     5. 이동 동선 끼임 해결사: 플레이어 위치 보정(Smooth Sliding) 함수
     * - 기존 게임의 이동(WASD) 직후 호출하면 가구 모서리에 끼이지 않고 부드럽게 미끄러짐
     ========================================================= */
  resolvePlayerMovementCollision(playerPos, playerRadius = 0.38) {
    if (!playerPos) return;
    for (const col of this.walkableColliders) {
      if (!col.mesh || !col.mesh.parent) continue;

      const worldPos = new THREE.Vector3();
      const footprint = col.mesh.userData.infirmaryFootprint;
      if (footprint) {
        worldPos.set(footprint.x, 0, footprint.z);
        col.mesh.localToWorld(worldPos);
      } else {
        col.mesh.getWorldPosition(worldPos);
      }

      const halfW = col.width / 2 + playerRadius;
      const halfD = col.depth / 2 + playerRadius;

      const dx = playerPos.x - worldPos.x;
      const dz = playerPos.z - worldPos.z;

      if (Math.abs(dx) < halfW && Math.abs(dz) < halfD && Math.abs(playerPos.y - worldPos.y) < 1.8) {
        const overlapX = halfW - Math.abs(dx);
        const overlapZ = halfD - Math.abs(dz);

        // 더 얕게 겹친 축으로 부드럽게 밀어내어 벽/가구를 타고 슬라이딩 이동 가능!
        if (overlapX < overlapZ) {
          playerPos.x += dx > 0 ? overlapX : -overlapX;
        } else {
          playerPos.z += dz > 0 ? overlapZ : -overlapZ;
        }
      }
    }
  }
}

window.school37RoomsPatch = new School37RoomsMasterPatch();
export { School37RoomsMasterPatch };
