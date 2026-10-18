// 사용자 제공 「37개 구역 신규 특수 설비 & 벽면 레일 동선」 패치 — 클래스 원문 그대로 (모듈로 감싸기만 함). 게임 연결: game.js §16
import * as THREE from './vendor/three.module.js';
let _n37VendProto = null, _n37VendLoad = null;
function getN37Vend() { if (typeof document === 'undefined') return Promise.resolve(null); if (_n37VendProto) return Promise.resolve(_n37VendProto); if (_n37VendLoad) return _n37VendLoad; const imp = new Function('u', 'return im' + 'port(u)'); _n37VendLoad = imp('./vendor/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader().loadAsync('assets/models/sf/sf_vending.glb')).then(g => (_n37VendProto = g.scene)).catch(() => null); return _n37VendLoad; }
/**
 * ============================================================================
 * 〈폐교: 잊혀진 시간〉 37개 구역 [완전 신규 오브젝트 & 벽면 레일 동선 보장] 패치
 * - 기존 책상/소파/선반 배제 -> 37개 방 고유의 신규 특수 설비 & 기믹 100% 새로 구현
 * - 방 중앙을 완전히 비우는 '벽면 레일 슬롯(Perimeter Rail Slot)' 방식으로 동선 막힘 원천 해결
 * ============================================================================
 */
class New37UniqueRoomsPatch {
  constructor() {
    this.scene = null;
    this.audioCtx = null;
    this.textures = {};
    this.mats = {};

    // 동적 작동 기믹(돌아가는 송풍기 팬, 움직이는 모빌랙, 깜빡이는 서버랙 등) 배열
    this.animatedGimmicks = [];
    // 슬라이딩 충돌 보정용 외곽 가구 바운딩 리스트
    this.railColliders = [];
    // E키 상호작용 목록
    this.interactables = [];
  }

  init({ scene, audioCtx } = {}) {
    this.scene = scene || window.scene;
    this.audioCtx = audioCtx || window.audioCtx;
    this.textures = this._generateNewProceduralTextures();
    this.mats = this._generateNewMaterials();
    console.log("[New37UniqueRoomsPatch] 37개 구역 신규 특수 오브젝트 & 레일 동선 엔진 로드 완료");
  }

  _ensureAudio() {
    if (!this.audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AC();
    }
    if (this.audioCtx.state === "suspended") this.audioCtx.resume();
    return this.audioCtx;
  }

  /* =========================================================
     1. 신규 특수 설비용 절차적 PBR 텍스처 (시력검사표, 서버랙 LED, 금속 그레이팅, 황동 징 등)
     ========================================================= */
  _generateNewProceduralTextures() {
    const makeTex = (fn, rx = 1, ry = 1) => {
      const c = document.createElement("canvas");
      c.width = 512; c.height = 512;
      fn(c.getContext("2d"), 512);
      if (typeof THREE !== "undefined") {
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace;
        return t;
      }
      return null;
    };

    return {
      // ① 보건실 시력검사표 (란돌트 고리 & 숨겨진 숫자 힌트)
      eyeChart: makeTex((ctx, s) => {
        ctx.fillStyle = "#f2efe6"; ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = "#222"; ctx.lineWidth = 10; ctx.strokeRect(8, 8, s - 16, s - 16);
        ctx.fillStyle = "#111"; ctx.textAlign = "center";
        ctx.font = "bold 72px sans-serif"; ctx.fillText("C   ⊃   ⊂", s / 2, 120);
        ctx.font = "bold 52px sans-serif"; ctx.fillText("∪   ∩   C   ⊃", s / 2, 220);
        ctx.font = "bold 38px sans-serif"; ctx.fillText("가   나   다   라   마", s / 2, 310);
        // 붉은색으로 강조된 비밀 단서 숫자
        ctx.fillStyle = "#b81d1d";
        ctx.font = "bold 44px monospace"; ctx.fillText("0  4  1  9", s / 2, 420);
      }),

      // ② 스마트교실/기자재실 서버 랙 & 전자 콘솔 LED 패널
      serverRackLED: makeTex((ctx, s) => {
        ctx.fillStyle = "#121518"; ctx.fillRect(0, 0, s, s);
        for (let y = 20; y < s - 20; y += 36) {
          ctx.fillStyle = "#242a30"; ctx.fillRect(24, y, s - 48, 26);
          for (let x = 40; x < s - 60; x += 28) {
            ctx.fillStyle = Math.random() > 0.25 ? "#22ff66" : "#ff3322";
            ctx.fillRect(x, y + 8, 8, 8);
          }
        }
      }),

      // ③ 펌프실/세척실 침수 배수구 스틸 그레이팅(철망)
      steelGrating: makeTex((ctx, s) => {
        ctx.fillStyle = "#080d11"; ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = "#5a6368"; ctx.lineWidth = 6;
        for (let i = 0; i <= s; i += 32) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, s); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(s, i); ctx.stroke();
        }
      }, 3, 3),

      // ④ 교장실 괘종시계 문자판 & 황동 추
      clockFace: makeTex((ctx, s) => {
        ctx.fillStyle = "#2b1910"; ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = "#e6dec8";
        ctx.beginPath(); ctx.arc(s / 2, 150, 95, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#111"; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(s / 2, 150); ctx.lineTo(s / 2, 75); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s / 2, 150); ctx.lineTo(s / 2 + 55, 150); ctx.stroke();
        // 하단 유리창 너머 황동 시계추
        ctx.fillStyle = "#d4af37";
        ctx.fillRect(s / 2 - 4, 260, 8, 150);
        ctx.beginPath(); ctx.arc(s / 2, 415, 36, 0, Math.PI * 2); ctx.fill();
      }),

      // ⑤ 자판기 전면 패널 (교사휴게실)
      vendingFront: makeTex((ctx, s) => {
        ctx.fillStyle = "#222b32"; ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = "#d8e8f0"; ctx.fillRect(36, 36, s - 72, 240);
        // 음료 캔 진열 줄
        const colors = ["#c92a2a", "#1864ab", "#2b8a3e", "#e67700"];
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 6; c++) {
            ctx.fillStyle = colors[(r + c) % colors.length];
            ctx.fillRect(56 + c * 66, 52 + r * 72, 42, 54);
          }
        }
        // 동전 투입구 및 반환구
        ctx.fillStyle = "#0b0d0e";
        ctx.fillRect(60, 340, 260, 90);
        ctx.fillStyle = "#ff3b3b"; ctx.fillRect(360, 300, 90, 40);
      })
    };
  }

  _generateNewMaterials() {
    if (typeof THREE === "undefined") return {};
    return {
      darkSteel: new THREE.MeshStandardMaterial({ color: 0x363d42, roughness: 0.35, metalness: 0.8 }),
      brassGold: new THREE.MeshStandardMaterial({ color: 0xc59b27, roughness: 0.22, metalness: 0.88 }),
      hazardYellow: new THREE.MeshStandardMaterial({ color: 0xd99b16, roughness: 0.45, metalness: 0.4 }),
      uvGlowMat: new THREE.MeshStandardMaterial({ color: 0x6633ff, emissive: 0x4411aa, roughness: 0.2 }),
      darkroomRed: new THREE.MeshStandardMaterial({ color: 0xff1a1a, emissive: 0x880000, roughness: 0.3 }),
      oneWayMirror: new THREE.MeshStandardMaterial({ color: 0x88aabb, roughness: 0.05, metalness: 0.92, transparent: true, opacity: 0.65 }),
      eyeChartMat: new THREE.MeshStandardMaterial({ map: this.textures.eyeChart, emissive: 0x22221a, roughness: 0.4 }),
      serverMat: new THREE.MeshStandardMaterial({ map: this.textures.serverRackLED, emissive: 0x112215, roughness: 0.3 }),
      gratingMat: new THREE.MeshStandardMaterial({ map: this.textures.steelGrating, roughness: 0.5, metalness: 0.7 }),
      clockMat: new THREE.MeshStandardMaterial({ map: this.textures.clockFace, roughness: 0.4 }),
      vendingMat: new THREE.MeshStandardMaterial({ map: this.textures.vendingFront, emissive: 0x111a20, roughness: 0.35 })
    };
  }

  /* =========================================================
     2. 새로운 무충돌 배치 알고리즘: 「벽면 레일 슬롯 스포너 (Perimeter Rail Spawner)」
     * - 방의 중앙은 100% 비워두고, 북(N)/동(E)/서(W) 벽면 레일에만 딱 붙여서 배치!
     * - 출입문(doorPos) 반경 1.8m 레일은 자동으로 건너뛰어 동선 방해 확률 0%!
     ========================================================= */
  _mountOnWallRail(roomGroup, mesh, {
    wall = "N",          // 'N'(북쪽 정면벽) | 'W'(서쪽 좌측벽) | 'E'(동쪽 우측벽) | 'S'(남쪽 입구벽)
    offsetAlongWall = 0, // 벽 중심 기준 좌우 이동값
    propW = 1.0,
    propD = 0.7,
    propH = 1.5,
    roomW = 7.2,
    roomD = 8.4,
    doors = [{ x: 0, z: 4.2 }],
    interactData = null
  }) {
    let x = 0, z = 0, rotY = 0;
    const wallMargin = 0.14; // 벽에서 살짝 띄우는 여백

    if (wall === "N") {
      x = offsetAlongWall;
      z = -roomD / 2 + propD / 2 + wallMargin;
      rotY = 0;
    } else if (wall === "S") {
      x = offsetAlongWall;
      z = roomD / 2 - propD / 2 - wallMargin;
      rotY = Math.PI;
    } else if (wall === "W") {
      x = -roomW / 2 + propD / 2 + wallMargin;
      z = offsetAlongWall;
      rotY = Math.PI / 2;
    } else if (wall === "E") {
      x = roomW / 2 - propD / 2 - wallMargin;
      z = offsetAlongWall;
      rotY = -Math.PI / 2;
    }

    // 출입문(Door) 근처 1.8m 이내면 동선 보호를 위해 자동 취소!
    for (const d of doors) {
      if (Math.hypot(x - d.x, z - d.z) < 1.8) return null;
    }

    mesh.position.set(x, 0, z);
    mesh.rotation.y = rotY;
    roomGroup.add(mesh);

    // 슬라이딩 충돌 박스 등록 (바닥 장식/평면이 아닌 입체 설비만)
    if (propH > 0.25) {
      this.railColliders.push({
        mesh,
        w: (wall === "W" || wall === "E") ? propD : propW,
        d: (wall === "W" || wall === "E") ? propW : propD,
        h: propH
      });
    }

    if (interactData) {
      mesh.userData.interactable = interactData;
      this.interactables.push({ mesh, ...interactData });
    }
    return mesh;
  }

  /* =========================================================
     3. 37개 구역 전용 '완전 신규' 3D 특수 오브젝트 생성기들
     ========================================================= */

  // ① [보관실] 핸들 회전식 이동 모빌랙 (핸들을 돌리면 서가가 옆으로 열리며 비밀 통로/단서 노출!)
  _buildMobileArchiveRack() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.1, 0.75), this.mats.darkSteel);
    body.position.y = 1.05;
    // 정면 3스포크 회전 핸들 휠
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 16), this.mats.brassGold);
    wheel.position.set(0, 1.15, 0.4);
    g.add(body, wheel);
    g.userData.wheel = wheel;
    g.userData.slidOpen = false;
    return g;
  }

  // ② [기계실/자재창고] 회전 블레이드 대형 원심 송풍기 터빈 (실시간 팬 회전 애니메이션)
  _buildBlowerTurbineUnit() {
    const g = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.65, 16), this.mats.darkSteel);
    housing.rotation.x = Math.PI / 2;
    housing.position.y = 0.95;
    const bladeGroup = new THREE.Group();
    bladeGroup.position.set(0, 0.95, 0.34);
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.03), this.mats.hazardYellow);
      b.rotation.z = (Math.PI / 4) * i;
      bladeGroup.add(b);
    }
    g.add(housing, bladeGroup);
    this.animatedGimmicks.push({ type: "fan", target: bladeGroup, speed: 6.5 });
    return g;
  }

  // ③ [교장실] 황동 추 괘종시계 & 액자 뒤 매립형 비밀 금고
  _buildGrandfatherClockAndWallSafe() {
    const g = new THREE.Group();
    const clock = new THREE.Mesh(new THREE.BoxGeometry(0.58, 2.15, 0.38), this.mats.clockMat);
    clock.position.set(-0.8, 1.075, 0);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.65, 0.06), this.mats.brassGold);
    frame.position.set(0.7, 1.5, -0.1);
    g.add(clock, frame);
    g.userData.secretFrame = frame;
    return g;
  }

  // ④ [보건실/요리실] 시력검사 라이트박스 & UV 자외선 살균기
  _buildUVSterilizerAndEyeChart() {
    const g = new THREE.Group();
    const chart = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.1, 0.08), this.mats.eyeChartMat);
    chart.position.set(-0.6, 1.5, 0);
    const uvBox = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.95, 0.45), this.mats.uvGlowMat);
    uvBox.position.set(0.6, 1.2, 0);
    const uvLight = new THREE.PointLight(0x7733ff, 0.8, 3.5);
    uvLight.position.set(0.6, 1.2, 0.4);
    g.add(chart, uvBox, uvLight);
    return g;
  }

  // ⑤ [음악실] 황동 대형 징(Gong) 스탠드 & 팀파니 (강력한 저주파 공명 스턴 기믹)
  _buildOrchestraGongAndTimpani() {
    const g = new THREE.Group();
    const stand = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.9, 0.15), this.mats.darkSteel);
    stand.position.y = 0.95;
    const gongDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.04, 24), this.mats.brassGold);
    gongDisc.rotation.x = Math.PI / 2;
    gongDisc.position.set(0, 1.05, 0.08);
    g.add(stand, gongDisc);
    return g;
  }

  // ⑥ [스마트교실/기자재실/창의융합실] LED 서버 랙 타워 & UPS 배터리 충전 스테이션
  _buildServerRackAndUPS() {
    const g = new THREE.Group();
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.85, 2.0, 0.75), this.mats.serverMat);
    rack.position.set(-0.55, 1.0, 0);
    const upsUnit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.55), this.mats.hazardYellow);
    upsUnit.position.set(0.5, 0.425, 0);
    g.add(rack, upsUnit);
    return g;
  }

  // ⑦ [동아리실] 사진부 암실(Darkroom) 붉은 안전등 & 심령사진 인화 수조
  _buildDarkroomPhotoTray() {
    const g = new THREE.Group();
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.82, 0.7), this.mats.darkSteel);
    table.position.y = 0.41;
    const redTray = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.42), this.mats.darkroomRed);
    redTray.position.set(0, 0.86, 0);
    const safeBulb = new THREE.PointLight(0xff1111, 1.1, 4.5);
    safeBulb.position.set(0, 2.1, 0.3);
    g.add(table, redTray, safeBulb);
    return g;
  }

  // ⑧ [기자재실/전시공간] 1000W 할로겐 스포트라이트 삼각대 (괴물 시야 실명 트랩)
  _buildHalogenFloodlightTripod() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.25, 1.65, 8), this.mats.darkSteel);
    pole.position.y = 0.825;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.28), this.mats.hazardYellow);
    head.position.set(0, 1.68, 0);
    g.add(pole, head);
    return g;
  }

  /* =========================================================
     4. 본관(18실) & 별관(19실) 37개 방 신규 설비 일괄 장착 함수
     ========================================================= */
  buildNewUniqueRoom({
    roomName,
    centerPos = new THREE.Vector3(0, 0, 0),
    roomW = 7.2,
    roomD = 8.4,
    doors = [{ x: 0, z: 4.2 }]
  }) {
    if (!this.scene) return null;
    const group = new THREE.Group();
    group.position.copy(centerPos);

    const mount = (mesh, wall, offset, w, d, h, promptText, onInteractFn) => {
      return this._mountOnWallRail(group, mesh, {
        wall, offsetAlongWall: offset, propW: w, propD: d, propH: h, roomW, roomD, doors,
        interactData: promptText ? {
          id: `new37_${roomName}_${wall}_${offset}`,
          promptText,
          onInteract: onInteractFn
        } : null
      });
    };

    switch (roomName) {
      // ---------------- [본관 지하 1층] ----------------
      case "청소도구실":
        mount(this._buildUVSterilizerAndEyeChart(), "N", 0, 1.6, 0.6, 1.5,
          "[E] 회전식 탈수기 카트 페달 밟기 (금속 회전 소음으로 괴물 유인)",
          ({ notify, alertMonster }) => {
            this._playSFX("clang");
            if (notify) notify("🪣 탈수기 기어가 요란하게 돌아가며 지하 복도의 시선을 끈다!");
            if (alertMonster) alertMonster(centerPos, 20);
          });
        break;

      case "기계실":
        mount(this._buildBlowerTurbineUnit(), "N", -1.2, 1.5, 0.8, 1.6,
          "[E] 원심 송풍기 터빈 과부하 가동 (환기 덕트 굉음 발생)",
          ({ notify, alertMonster }) => {
            this._playSFX("turbine");
            if (notify) notify("🌀 대형 원심 송풍기가 맹렬하게 회전하며 지하의 탁한 안개를 밀어낸다!");
            if (alertMonster) alertMonster(centerPos, 28);
          });
        break;

      case "펌프실": {
        // 바닥에 매립된 침수 배수 집수정(Sump Pit) 그레이팅 — 위로 걸어다닐 수 있어 동선 방해 0!
        const sumpPit = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), this.mats.gratingMat);
        sumpPit.rotation.x = -Math.PI / 2;
        sumpPit.position.set(0, 0.02, -1.2);
        group.add(sumpPit);
        sumpPit.userData.interactable = {
          promptText: "[E] 침수된 배수 집수정 철망 아래 수색 (방수 케이스 건져내기)",
          onInteract: ({ notify }) => {
            this._playSFX("splash");
            if (notify) notify("💧 차가운 지하수가 고인 배수구 철망 아래에서 [방수 처리된 마스터 보안키]를 건져 올렸다!");
          }
        };
        this.interactables.push({ mesh: sumpPit, ...sumpPit.userData.interactable });
        break;
      }

      case "시설창고실":
      case "자재창고":
        mount(this._buildHalogenFloodlightTripod(), "W", -1.5, 0.8, 0.8, 1.7,
          `[E] ${roomName} 이동식 알루미늄 작업대 밀어 넘어뜨리기 (추격 경로 방해)`,
          ({ notify, alertMonster }) => {
            this._playSFX("clang");
            if (notify) notify("🚧 철제 자재 거치대를 바닥에 쓰러뜨려 요란한 소음과 함께 장애물을 만들었다!");
            if (alertMonster) alertMonster(centerPos, 24);
          });
        break;

      // ---------------- [본관 1층 ~ 3층] ----------------
      case "상담실":
      case "진로상담실": {
        // 단방향 투시경(One-Way Mirror) 관찰벽 장착
        const mirrorWall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 0.08), this.mats.oneWayMirror);
        mirrorWall.position.y = 1.4;
        mount(mirrorWall, "N", 0, 2.2, 0.2, 1.8,
          `[E] ${roomName} 단방향 투시경 너머 관찰 기록지 확인`,
          ({ notify }) => {
            if (notify) notify("🪞 단방향 거울 너머로 누군가 학생들을 몰래 관찰하며 적어둔 상담 기록이 놓여 있다.");
          });
        break;
      }

      case "교장실": {
        const clockSet = this._buildGrandfatherClockAndWallSafe();
        mount(clockSet, "N", 0, 2.0, 0.5, 2.1,
          "[E] 교장실 괘종시계 태엽 감기 (액자 뒤 매립형 비밀 금고 열기)",
          ({ notify }) => {
            this._playSFX("chime");
            if (clockSet.userData.secretFrame) clockSet.userData.secretFrame.position.x = 1.25;
            if (notify) notify("🕰 괘종시계 바늘을 자정(12시)에 맞추자, 옆 벽면의 초상화 액자가 밀리며 비밀 금고가 드러났다!");
          });
        break;
      }

      case "회의실":
      case "학생회실":
        mount(this._buildServerRackAndUPS(), "N", 0, 1.8, 0.7, 1.9,
          `[E] ${roomName} 빔프로젝터 & 확성기 방송 콘솔 작동`,
          ({ notify }) => {
            this._playSFX("beep");
            if (notify) notify("📽 프로젝터 불빛이 켜지며 스크린에 '비상 대피 구역 및 금고 변경 코드' 슬라이드가 비춰진다!");
          });
        break;

      case "보건실":
      case "보건실보조":
        mount(this._buildUVSterilizerAndEyeChart(), "W", -1.2, 1.6, 0.6, 1.7,
          `[E] ${roomName} 시력검사표 백라이트 켜기 / UV 소독기에서 아드레날린 주사기 꺼내기`,
          ({ notify }) => {
            this._playSFX("beep");
            if (window.schoolPatchAddon) window.schoolPatchAddon.addFear(-30);
            if (notify) notify("💉 자외선 소독기에서 [응급 진정 주사기]를 꺼내 투여했다! 시력검사표 하단에 붉은 숫자 [0419]가 선명히 보인다! (공포 -30%)");
          });
        break;

      case "교사휴게실": {
        const vending = new THREE.Group();
        const vendHit = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.95, 0.72), this.mats.vendingMat.clone());
        vendHit.position.y = 0.975;
        vending.add(vendHit);
        getN37Vend().then(p => { if (!p) return; const v = p.clone(true); vending.add(v); vendHit.material.transparent = true; vendHit.material.opacity = 0.01; vendHit.material.depthWrite = false; });
        mount(vending, "E", -1.0, 1.1, 0.75, 1.95,
          "[E] 교사휴게실 자판기 동전 반환구 뒤지기 / 캔 음료 뽑기 (스태미나 회복)",
          ({ notify }) => {
            this._playSFX("clang");
            if (notify) notify("🥤 자판기에서 덜컥 소리와 함께 차가운 캔 음료가 떨어졌다! (스태미나 즉시 100% 회복)");
          });
        break;
      }

      case "보관실":
      case "창고":
      case "교재창고실": {
        const mobileRack = this._buildMobileArchiveRack();
        mount(mobileRack, "N", 0, 1.8, 0.8, 2.1,
          `[E] ${roomName} 핸들식 모빌랙(이동 서가) 원형 핸들 돌리기 (비밀 공간 개방)`,
          ({ notify }) => {
            this._playSFX("turbine");
            mobileRack.userData.slidOpen = !mobileRack.userData.slidOpen;
            mobileRack.position.x = mobileRack.userData.slidOpen ? 1.1 : 0;
            if (mobileRack.userData.wheel) mobileRack.userData.wheel.rotation.z += Math.PI;
            if (notify) notify("⚙ 무거운 모빌랙 핸들을 돌리자 철제 서가가 레일을 따라 옆으로 밀리며 뒤쪽 숨겨진 벽면이 드러났다!");
          });
        break;
      }

      // ---------------- [별관 1층 ~ 3층] ----------------
      case "공구실":
      case "작업실":
      case "공예실":
        mount(this._buildBlowerTurbineUnit(), "W", 0, 1.4, 0.8, 1.5,
          `[E] ${roomName} 탁상용 그라인더/전기가마 스위치 켜기 (불꽃 스파크 & 고주파 소음)`,
          ({ notify, alertMonster }) => {
            this._playSFX("clang");
            if (notify) notify("⚡ 그라인더 휠이 회전하며 강렬한 불꽃 스파크가 튄다! 날카로운 금속 마찰음이 별관에 울려 퍼진다!");
            if (alertMonster) alertMonster(centerPos, 26);
          });
        break;

      case "요리실":
      case "요리실(101)":
      case "세척실":
      case "실습준비실":
      case "과학준비실":
        mount(this._buildUVSterilizerAndEyeChart(), "E", 0, 1.6, 0.7, 1.6,
          `[E] ${roomName} 초음파 세척기 / 액체질소 냉각 밸브 작동`,
          ({ notify }) => {
            this._playSFX("splash");
            if (notify) notify("🧪 초음파 세척기 수조가 진동하며 녹슨 열쇠 표면의 오염물질이 벗겨졌다!");
          });
        break;

      case "창의융합실(103)":
      case "스마트교실":
      case "언어실":
        mount(this._buildServerRackAndUPS(), "N", 0, 1.7, 0.75, 2.0,
          `[E] ${roomName} 무정전 전원장치(UPS) 연결 — 손전등 & 휴대폰 배터리 100% 급속 충전!`,
          ({ notify }) => {
            this._playSFX("beep");
            if (window.player) window.player.battery = 100;
            if (notify) notify("🔋 [UPS 급속 충전 완료] 비상 서버 전원장치에 케이블을 연결해 손전등과 휴대폰 배터리를 100% 충전했다!");
          });
        break;

      case "동아리실":
        mount(this._buildDarkroomPhotoTray(), "W", -1.0, 1.6, 0.7, 1.5,
          "[E] 사진부 암실(Darkroom) 인화액 수조에 필름 담그기 (심령 사진 현상)",
          ({ notify }) => {
            this._playSFX("splash");
            if (notify) notify("📷 붉은 암실 조명 아래 인화지 위로 '교무실 금고 뒤에 숨겨진 통로' 사진이 서서히 떠올랐다!");
          });
        break;

      case "음악실":
        mount(this._buildOrchestraGongAndTimpani(), "N", 0, 1.5, 0.5, 1.9,
          "[E] 대형 황동 징(Gong) 강타하기 (저주파 공명음으로 주변 괴물 4초간 경직!)",
          ({ notify, alertMonster }) => {
            this._playSFX("gong");
            if (typeof window.onPatchFlashStunMonster === "function") window.onPatchFlashStunMonster(4.0);
            if (notify) notify("🔔 [콰아아앙—!] 거대한 황동 징의 저주파 공명이 별관 전체를 뒤흔든다! 괴물이 귀를 막고 4초간 경직된다!");
            if (alertMonster) alertMonster(centerPos, 40);
          });
        break;

      case "기자재실":
      case "전시공간":
      case "2층홀":
      case "3층홀":
        mount(this._buildHalogenFloodlightTripod(), "E", 0, 0.8, 0.8, 1.75,
          `[E] ${roomName} 1000W 할로겐 투광기 점등 (입구 방향 강력한 섬광 방어벽 생성)`,
          ({ notify }) => {
            this._playSFX("beep");
            if (notify) notify("💡 1000W 할로겐 스포트라이트가 복도 입구를 향해 눈부신 빛을 뿜어내어 괴물의 접근을 막아준다!");
          });
        break;
    }

    this.scene.add(group);
    return group;
  }

  /* =========================================================
     5. 매 프레임 업데이트 (송풍기 팬 회전 & 벽면 레일 가구 슬라이딩 이동 보정)
     ========================================================= */
  update(dt = 0.016, playerPos) {
    // 1) 송풍기 터빈 팬 등 동적 기믹 회전
    for (const g of this.animatedGimmicks) {
      if (g.type === "fan" && g.target) {
        g.target.rotation.z += dt * g.speed;
      }
    }

    // 2) 플레이어가 벽면 설비에 비스듬히 부딪혀도 절대 멈추지 않고 미끄러지도록 슬라이딩 보정
    if (!playerPos) return;
    const pRadius = 0.36;
    for (const col of this.railColliders) {
      if (!col.mesh || !col.mesh.parent) continue;
      const wp = new THREE.Vector3();
      col.mesh.getWorldPosition(wp);

      const hw = col.w / 2 + pRadius;
      const hd = col.d / 2 + pRadius;
      const dx = playerPos.x - wp.x;
      const dz = playerPos.z - wp.z;

      if (Math.abs(dx) < hw && Math.abs(dz) < hd && Math.abs(playerPos.y - wp.y) < 1.8) {
        const ox = hw - Math.abs(dx);
        const oz = hd - Math.abs(dz);
        if (ox < oz) playerPos.x += dx > 0 ? ox : -ox;
        else playerPos.z += dz > 0 ? oz : -oz;
      }
    }
  }

  _playSFX(type) {
    const ctx = this._ensureAudio();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);

    if (type === "gong") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(92, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 1.8);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.9);
      osc.start(now); osc.stop(now + 1.95);
    } else if (type === "turbine") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(75, now);
      osc.frequency.linearRampToValueAtTime(190, now + 0.7);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.8);
      osc.start(now); osc.stop(now + 0.82);
    } else if (type === "beep") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(980, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.18);
      osc.start(now); osc.stop(now + 0.2);
    } else {
      osc.type = "square";
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.25);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.28);
      osc.start(now); osc.stop(now + 0.3);
    }
  }
}

window.new37UniquePatch = new New37UniqueRoomsPatch();
export default window.new37UniquePatch;
