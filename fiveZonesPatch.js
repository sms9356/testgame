/**
 * [Module 6] 5대 구역(경비실 · 운동장 · 과학실 · 급식실 · 옥상) 확장 패치
 * (사용자 제공 코드 — 게임 연결은 game.js 의 "5대 구역 연결" 부분)
 */
import * as THREE from './vendor/three.module.js';
/**
 * ============================================================================
 * 〈폐교: 잊혀진 시간〉 5대 구역(경비실·운동장·과학실·급식실·옥상) 확장 패치
 * - 기존 게임 코드와 중복 없이 E키 상호작용, 3D 프롭, 이벤트, 미션만 주입
 * ============================================================================
 */
class FiveZonesExpansionPatch {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.audioCtx = null;

    // 5대 구역 전용 미션 진행 상태 (기존 열쇠/인벤토리와 자동 연동)
    this.missions = {
      guardPowerChecked: false,   // 경비실 정문 스위치 확인 여부
      rooftopGeneratorOn: false,  // 옥상 비상발전기 가동 여부
      rooftopSignalSent: false,   // 옥상 휴대폰 구조신호 발송 여부 (진엔딩 조건)
      scienceAcidCrafted: false,  // 과학실 강산 부식액 제작 여부
      rooftopDoorMelted: false,   // 옥상 녹슨 자물쇠 부식 완료 여부
      frozenKeyObtained: false,   // 급식실 냉동창고 얼어붙은 열쇠 획득 여부
      frozenKeyMelted: false,     // 조리실 화구에서 열쇠 해동 완료 여부
      yardCapsuleDug: false       // 운동장 모래장 타임캡슐 발굴 여부
    };

    // 구역별 실시간 이벤트 상태
    this.events = {
      freezerLocked: false,
      freezerTimer: 30.0,
      yardFogActive: false,
      mannequinMesh: null,
      cctvnoiseCanvas: null,
      cctvNoiseCtx: null
    };

    this.interactables = []; // 기존 게임의 E키 Raycaster 배열에 추가할 오브젝트들
  }

  init({ scene, camera, audioCtx } = {}) {
    this.scene = scene || window.scene;
    this.camera = camera || window.camera;
    this.audioCtx = audioCtx || window.audioCtx;
    this.textures = this._createZoneTextures();
    console.log("[FiveZonesPatch] 운동장·경비실·옥상·과학실·급식실 모듈 로드 완료");
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
     1. 5대 구역 전용 절차적(Procedural) PBR 텍스처 생성기
     ========================================================= */
  _createZoneTextures() {
    const buildTex = (drawFn, rx = 4, ry = 4) => {
      const c = document.createElement("canvas");
      c.width = 512; c.height = 512;
      drawFn(c.getContext("2d"), 512);
      if (typeof THREE !== "undefined") {
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(rx, ry);
        return tex;
      }
      return null;
    };

    return {
      // ① 운동장 마사토(붉은 황토 + 잔디 잡초 + 흰색 트랙 라인 흔적)
      yardMasato: buildTex((ctx, s) => {
        ctx.fillStyle = "#6b4435"; ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 6500; i++) {
          ctx.fillStyle = i % 3 === 0 ? "#4d2f23" : (i % 2 === 0 ? "#855643" : "#3a4528");
          ctx.fillRect(Math.random() * s, Math.random() * s, 2.5, 2.5);
        }
        // 지워진 운동장 백회(하얀 라인) 흔적
        ctx.fillStyle = "rgba(220, 215, 205, 0.18)";
        ctx.fillRect(0, s * 0.48, s, 14);
      }, 14, 14),

      // ② 옥상 우레탄 방수 바닥 (벗겨진 녹색 방수페인트 + 회색 콘크리트 균열)
      rooftopUrethane: buildTex((ctx, s) => {
        ctx.fillStyle = "#355242"; ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 45; i++) {
          ctx.fillStyle = "rgba(75, 78, 76, 0.55)";
          ctx.beginPath();
          ctx.arc(Math.random() * s, Math.random() * s, 15 + Math.random() * 55, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = "#1f2421"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(40, 20); ctx.lineTo(260, 290); ctx.lineTo(480, 410); ctx.stroke();
      }, 6, 6),

      // ③ 과학실 내산성 검은 대리석 & 타일 바닥
      scienceLabTile: buildTex((ctx, s) => {
        ctx.fillStyle = "#1c2124"; ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = "#323b40"; ctx.lineWidth = 4;
        for (let i = 0; i <= 4; i++) {
          const p = (s / 4) * i;
          ctx.strokeRect(0, 0, p, p);
        }
        // 화학 약품 얼룩(초록/노란 산성 자국)
        ctx.fillStyle = "rgba(90, 170, 80, 0.22)";
        ctx.beginPath(); ctx.arc(180, 220, 48, 0, Math.PI * 2); ctx.fill();
      }, 6, 6),

      // ④ 급식실 주방 논슬립 타일 & 배수 트렌치 그레이팅
      kitchenTile: buildTex((ctx, s) => {
        ctx.fillStyle = "#7d8285"; ctx.fillRect(0, 0, s, s);
        const cell = s / 8;
        ctx.strokeStyle = "#3a3d3f"; ctx.lineWidth = 3;
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            ctx.strokeRect(x * cell, y * cell, cell, cell);
          }
        }
        // 중앙 스테인리스 배수구 그레이팅 줄무늬
        ctx.fillStyle = "#2b2e30";
        ctx.fillRect(0, s * 0.45, s, 36);
      }, 6, 6)
    };
  }

  /* =========================================================
     2. 구역 ①: 경비실 (CCTV 감시 모니터, 인터폰 유인, 정문 개방 스위치)
     ========================================================= */
  buildGuardhouseProps(originPos) {
    if (!this.scene) return;
    const group = new THREE.Group();
    group.position.copy(originPos);

    // 1) 경비실 책상 & 4분할 CCTV 모니터
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.78, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 0.7 })
    );
    desk.position.set(0, 0.39, 0);

    // 실시간 캔버스 노이즈가 흐르는 CCTV 화면
    this.events.cctvNoiseCanvas = document.createElement("canvas");
    this.events.cctvNoiseCanvas.width = 256;
    this.events.cctvNoiseCanvas.height = 192;
    this.events.cctvNoiseCtx = this.events.cctvNoiseCanvas.getContext("2d");
    this._drawCCTVFrame(false);

    const cctvTex = new THREE.CanvasTexture(this.events.cctvNoiseCanvas);
    const cctvMonitor = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.52, 0.42),
      new THREE.MeshStandardMaterial({ map: cctvTex, emissive: 0x112218, roughness: 0.3 })
    );
    cctvMonitor.position.set(-0.35, 1.05, -0.1);

    // 2) 정문 전동 개폐기 컨트롤 박스
    const gateSwitch = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.45, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x2e3538, metalness: 0.6 })
    );
    gateSwitch.position.set(0.85, 1.35, -0.35);

    group.add(desk, cctvMonitor, gateSwitch);
    this.scene.add(group);

    // 상호작용 등록: CCTV 모니터
    this._registerInteractable(cctvMonitor, {
      id: "guard_cctv",
      promptText: "[E] 경비실 4분할 CCTV 모니터 확인 (순찰 경로 · 녹화 확인)",
      onInteract: ({ notify, revealMonsterOnMap }) => {
        const isScare = false;
        this._drawCCTVFrame(isScare);
        cctvTex.needsUpdate = true;
        this._playSound("static");

        if (isScare) {
          this._addPlayerFear(20);
          notify("📺 [CCTV CAM-03] 녹화 목록에 1998.10.12 23:10~23:50 구간이 삭제된 흔적이 있다.");
        } else {
          notify("📺 [CCTV 확인] 본관 복도와 급식실 채널을 스캔했습니다. 움직임은 없습니다.");
          if (revealMonsterOnMap) revealMonsterOnMap(15.0);
        }
      }
    });

    // 상호작용 등록: 정문 개폐 스위치 (미션 연계)
    this._registerInteractable(gateSwitch, {
      id: "guard_gate_switch",
      promptText: "[E] 정문 전동 철문 개폐기 작동",
      onInteract: ({ notify, triggerFinalGateOpen }) => {
        this.missions.guardPowerChecked = true;
        if (!this.missions.rooftopGeneratorOn) {
          this._playSound("error");
          notify("⚠ [전력 부족] 정문 모터가 작동하지 않는다. '옥상 비상발전기'를 먼저 가동해야 한다! (새 목표 등록)");
        } else {
          this._playSound("power_up");
          notify("🚨 [정문 개방 시작] 발전기 전력이 공급되어 정문 철문이 열리기 시작합니다!");
          if (triggerFinalGateOpen) triggerFinalGateOpen();
        }
      }
    });

    return group;
  }

  _drawCCTVFrame(showMonsterFace = false) {
    const ctx = this.events.cctvNoiseCtx;
    if (!ctx) return;
    ctx.fillStyle = "#0a140e";
    ctx.fillRect(0, 0, 256, 192);

    // 4분할 격자선
    ctx.strokeStyle = "#4aff88";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 128, 96);
    ctx.strokeRect(128, 0, 128, 96);
    ctx.strokeRect(0, 96, 128, 96);
    ctx.strokeRect(128, 96, 128, 96);

    ctx.fillStyle = "#7cffaa";
    ctx.font = "11px monospace";
    ctx.fillText("CAM1: 1F 복도", 8, 16);
    ctx.fillText("CAM2: 급식실", 136, 16);
    ctx.fillText("CAM3: 경비실 밖", 8, 112);
    ctx.fillText("CAM4: 옥상 입구", 136, 112);

    if (showMonsterFace) {
      ctx.fillStyle = "#ff2222";
      ctx.beginPath(); ctx.arc(64, 150, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#000";
      ctx.fillRect(50, 142, 8, 8); ctx.fillRect(70, 142, 8, 8);
    }
  }

  /* =========================================================
     3. 구역 ②: 야외 운동장 (조회대 마이크, 흔들리는 그네, 모래장 타임캡슐)
     ========================================================= */
  buildSchoolYardProps(originPos) {
    if (!this.scene) return;
    const group = new THREE.Group();
    group.position.copy(originPos);

    // 1) 조회대 콘크리트 단상 & 앰프 마이크
    const podium = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.75, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x666866, roughness: 0.85 })
    );
    podium.position.set(0, 0.375, 0);

    const micStand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.03, 1.25, 8),
      new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 })
    );
    micStand.position.set(0, 1.35, -0.7);

    // 2) 씨름장/모래장 타임캡슐 발굴 포인트
    const sandPit = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.4, 0.12, 16),
      new THREE.MeshStandardMaterial({ color: 0x8a6d4b, roughness: 0.95 })
    );
    sandPit.position.set(8.5, 0.06, 5.0);

    group.add(podium, micStand, sandPit);
    this.scene.add(group);

    // 상호작용: 조회대 마이크 방송 (초장거리 어그로 유인)
    this._registerInteractable(micStand, {
      id: "yard_mic",
      promptText: "[E] 조회대 앰프 마이크 켜기 (운동장 전체로 방송)",
      onInteract: ({ notify, alertMonster }) => {
        this._playSound("mic_howl");
        notify("📢 [운동장 조회대] 귀를 찢는 하울링이 밤하늘에 울려 퍼집니다!");
        if (alertMonster) alertMonster(originPos, 50.0);
      }
    });

    // 상호작용: 모래장 타임캡슐 파헤치기 (열쇠 조각 미션)
    this._registerInteractable(sandPit, {
      id: "yard_sandpit_capsule",
      promptText: "[E] 운동장 모래장 파헤치기 (묻힌 물건 수색)",
      onInteract: ({ notify, giveKeyPiece }) => {
        if (this.missions.yardCapsuleDug) {
          notify("이미 파헤쳐진 구덩이다.");
          return;
        }
        this.missions.yardCapsuleDug = true;
        this._playSound("dig");
        notify("🗝 [미션 완료] 모래 속에서 녹슨 '1998년 졸업 타임캡슐'을 파냈다! 안에서 [열쇠 조각]과 빛바랜 단체 사진을 획득했다!");
        if (giveKeyPiece) giveKeyPiece();
      }
    });

    return group;
  }

  /* =========================================================
     4. 구역 ③: 과학실 (인체 해골 모형 추격 기믹, 포르말린 표본, 부식액 조합)
     ========================================================= */
  buildScienceLabProps(originPos) {
    if (!this.scene) return;
    const group = new THREE.Group();
    group.position.copy(originPos);

    // 1) 검은 대리석 상판 실험대
    const labTable = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.85, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x1a1e21, roughness: 0.3 })
    );
    labTable.position.set(0, 0.425, 0);

    // 2) 시약 플라스크 세트 (강산 부식액 제작용)
    const flask = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 0.32, 12),
      new THREE.MeshStandardMaterial({ color: 0x44ff77, transparent: true, opacity: 0.8, roughness: 0.1 })
    );
    flask.position.set(0.3, 1.0, 0);

    // 3) 시선을 떼면 움직이는 인체 골격 모형(해골)
    const skeletonGroup = new THREE.Group();
    skeletonGroup.position.set(-2.5, 0, -2.0);
    const skull = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xd8d2c5, roughness: 0.6 })
    );
    skull.position.set(0, 1.58, 0);
    const spine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.06, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: 0xd0cabd })
    );
    spine.position.set(0, 0.8, 0);
    skeletonGroup.add(skull, spine);
    this.events.mannequinMesh = skeletonGroup;

    group.add(labTable, flask, skeletonGroup);
    this.scene.add(group);

    // 상호작용: 화학 시약 조합 (옥상 잠긴 자물쇠를 녹이는 강산 용액 제작)
    this._registerInteractable(flask, {
      id: "science_acid_craft",
      promptText: "[E] 과학실 실험대 — 고농도 산성 부식액 조합하기",
      onInteract: ({ notify }) => {
        if (this.missions.scienceAcidCrafted) {
          notify("이미 [산성 부식액]을 조합해 소지하고 있다.");
          return;
        }
        this.missions.scienceAcidCrafted = true;
        this._playSound("bubble");
        notify("🧪 [화학 조합 성공] 황산과 질산을 배합해 [강산성 부식액]을 얻었다! 녹슬어 꿈쩍 않는 옥상 철문 자물쇠를 녹일 수 있다.");
      }
    });

    return group;
  }

  /* =========================================================
     5. 구역 ④: 급식실 (대형 국솥 은신, 냉동창고 감금 탈출, 얼어붙은 열쇠 해동)
     ========================================================= */
  buildCafeteriaProps(originPos) {
    if (!this.scene) return;
    const group = new THREE.Group();
    group.position.copy(originPos);

    const stainlessMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.82, roughness: 0.28 });

    // 1) 은신 가능한 대형 조리용 국솥 (Vat)
    const cookingVat = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.58, 1.05, 16), stainlessMat);
    cookingVat.position.set(-1.8, 0.525, -1.2);

    // 2) 조리실 공업용 가스 화구 (얼어붙은 열쇠 해동용)
    const gasStove = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 0.9), stainlessMat);
    gasStove.position.set(0.5, 0.425, -1.5);

    // 3) 냉동창고 두꺼운 철문 & 얼어붙은 열쇠 덩어리
    const freezerItem = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.25, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.78, roughness: 0.1 })
    );
    freezerItem.position.set(3.2, 0.9, -2.0);

    // 4) 냉동창고 내부 비상 탈출 레버
    const emergencyLever = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.38, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xd92b2b })
    );
    emergencyLever.position.set(3.8, 1.35, -2.4);

    group.add(cookingVat, gasStove, freezerItem, emergencyLever);
    this.scene.add(group);

    // 상호작용 1: 대형 국솥 은신
    this._registerInteractable(cookingVat, {
      id: "cafeteria_vat",
      promptText: "[E] 대형 조리용 국솥 안에 숨기 (은신)",
      onInteract: ({ notify, togglePlayerHide }) => {
        this._playSound("metal_clang");
        notify("차갑고 기름때 낀 대형 국솥 안으로 몸을 웅크리고 뚜껑을 덮었다.");
        if (togglePlayerHide) togglePlayerHide();
      }
    });

    // 상호작용 2: 냉동창고 얼음 덩어리 획득 -> 즉시 냉동창고 감금 이벤트 발동!
    this._registerInteractable(freezerItem, {
      id: "cafeteria_frozen_key",
      promptText: "[E] 얼음 덩어리 속에 얼어붙은 물건 꺼내기",
      onInteract: ({ notify }) => {
        if (this.missions.frozenKeyObtained) return;
        this.missions.frozenKeyObtained = true;
        freezerItem.visible = false;

        // 감금 서바이벌 이벤트 시작!
        this.events.freezerLocked = true;
        this.events.freezerTimer = 30.0;
        document.body.classList.add("patch-freezer-locked");
        this._playSound("metal_clang");
        notify("❄ [돌발 이벤트: 냉동창고 감금] 등 뒤에서 냉동창고 철문이 쾅 닫히며 잠겼다! 체온이 바닥나기 전에 안쪽 [붉은 비상 탈출 레버]를 당겨라!");
      }
    });

    // 상호작용 3: 냉동창고 내부 비상 레버
    this._registerInteractable(emergencyLever, {
      id: "cafeteria_freezer_lever",
      promptText: "[E] 냉동창고 내부 비상 개방 레버 당기기",
      onInteract: ({ notify }) => {
        if (!this.events.freezerLocked) {
          notify("냉동창고 문이 열려 있다.");
          return;
        }
        this.events.freezerLocked = false;
        document.body.classList.remove("patch-freezer-locked");
        this._playSound("power_up");
        notify("🔓 비상 압축 밸브가 풀리며 냉동창고 문이 열렸다! 이제 조리실 가스 화구에서 얼어붙은 열쇠를 녹이자.");
      }
    });

    // 상호작용 4: 조리실 가스 화구 (얼어붙은 열쇠 해동 -> 열쇠 조각 획득)
    this._registerInteractable(gasStove, {
      id: "cafeteria_gas_stove",
      promptText: "[E] 조리실 공업용 화구 점화하기",
      onInteract: ({ notify, giveKeyPiece }) => {
        if (!this.missions.frozenKeyObtained) {
          notify("가스가 남아 있어 불이 붙는다. 무언가 얼어붙은 것을 녹일 수 있을 것 같다.");
          return;
        }
        if (this.missions.frozenKeyMelted) {
          notify("이미 얼음을 모두 녹여 열쇠 조각을 꺼냈다.");
          return;
        }
        this.missions.frozenKeyMelted = true;
        this._playSound("bubble");
        notify("🔥 [미션 완료] 화구의 뜨거운 열기로 얼음 덩어리를 녹여 그 안에 있던 [열쇠 조각]을 획득했다!");
        if (giveKeyPiece) giveKeyPiece();
      }
    });

    return group;
  }

  /* =========================================================
     6. 구역 ⑤: 옥상 (산성 용액으로 문 개방, 비상발전기 가동, 휴대폰 구조 신호)
     ========================================================= */
  buildRooftopProps(originPos) {
    if (!this.scene) return;
    const group = new THREE.Group();
    group.position.copy(originPos);

    // 1) 녹슨 옥상 방화문 (과학실 산성 부식액 필요)
    const rooftopDoor = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 2.1, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x4d3328, roughness: 0.85, metalness: 0.5 })
    );
    rooftopDoor.position.set(-3.0, 1.05, 0);

    // 2) 디젤 비상 발전기
    const generator = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.1, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x3b4d3b, roughness: 0.6, metalness: 0.5 })
    );
    generator.position.set(1.5, 0.55, -1.8);

    // 3) 옥상 통신 안테나 (유일하게 휴대폰 전파가 잡히는 지점)
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.12, 3.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8 })
    );
    antenna.position.set(3.5, 1.6, 1.5);

    group.add(rooftopDoor, generator, antenna);
    this.scene.add(group);

    // 상호작용 1: 옥상 녹슨 철문 자물쇠
    this._registerInteractable(rooftopDoor, {
      id: "rooftop_rusted_door",
      promptText: "[E] 녹슬어 달라붙은 옥상 방화문 조사",
      onInteract: ({ notify }) => {
        if (!this.missions.scienceAcidCrafted) {
          this._playSound("error");
          notify("🔒 자물쇠가 붉게 부식되어 열쇠 구멍조차 막혀 있다. 과학실에서 자물쇠를 녹일 [강산성 부식액]을 만들어 와야 한다.");
          return;
        }
        if (!this.missions.rooftopDoorMelted) {
          this.missions.rooftopDoorMelted = true;
          rooftopDoor.rotation.y = Math.PI * 0.55;
          this._playSound("bubble");
          notify("🧪 [옥상 개방] 강산성 부식액을 부어 녹슨 자물쇠를 녹여냈다! 차가운 밤바람과 함께 옥상 문이 열린다.");
        }
      }
    });

    // 상호작용 2: 옥상 비상발전기 시동 (경비실 정문 전력 공급 + 옥상 추격 이벤트)
    this._registerInteractable(generator, {
      id: "rooftop_generator",
      promptText: "[E] 옥상 비상발전기 시동 레버 당기기 (정문 전력 공급)",
      onInteract: ({ notify, alertMonster }) => {
        if (this.missions.rooftopGeneratorOn) {
          notify("비상발전기가 요란한 엔진 소리를 내며 가동 중이다. 이제 1층 경비실에서 정문을 열 수 있다!");
          return;
        }
        this.missions.rooftopGeneratorOn = true;
        this._playSound("power_up");
        notify("⚡ [미션 완료: 비상발전기 가동] 옥상 경광등이 켜지며 경비실 정문 개폐기에 전력이 공급됩니다!");
        if (alertMonster) alertMonster(originPos, 60.0);
      }
    });

    // 상호작용 3: 옥상 통신 안테나 (휴대폰 신호 복구 -> 구조 요청 문자 발송)
    this._registerInteractable(antenna, {
      id: "rooftop_antenna_signal",
      promptText: "[E] 옥상 난간 안테나 — 휴대폰 전파 잡기 (구조 요청)",
      onInteract: ({ notify }) => {
        if (this.missions.rooftopSignalSent) {
          notify("이미 외부로 구조 요청 좌표를 전송했다.");
          return;
        }
        this.missions.rooftopSignalSent = true;
        // 기존 휴대폰 UI의 '신호 없음 ✕' 텍스트를 '📶 LTE (1칸)'으로 실시간 패치!
        document.querySelectorAll("b").forEach((b) => {
          if (b.textContent.includes("신호 없음")) b.textContent = "📶 미약한 신호 연결됨";
        });
        this._playSound("power_up");
        notify("📱 [히든 미션 완료] 옥상 고지대에서 기적적으로 안테나 신호가 1칸 잡혔다! 외부에 긴급 구조 문자를 발송했다! (진엔딩 조건 달성)");
      }
    });

    return group;
  }

  /* =========================================================
     7. 매 프레임 업데이트 (냉동창고 저체온 데미지 & 과학실 해골 기믹)
     ========================================================= */
  update(dt = 0.016, playerPos, notifyFn) {
    // 1) 급식실 냉동창고 감금 시 매초 저체온증 피해
    if (this.events.freezerLocked) {
      this.events.freezerTimer -= dt;
      if (window.player && typeof window.player.hp === "number") {
        window.player.hp = Math.max(1, window.player.hp - 2.5 * dt);
      }
      if (this.events.freezerTimer <= 0) {
        this.events.freezerLocked = false;
        document.body.classList.remove("patch-freezer-locked");
      }
    }

    // 2) 과학실 인체 해골 모형: 플레이어가 등 돌리고 있을 때 조금씩 다가옴 (Weeping Angel 기믹)
    if (this.events.mannequinMesh && this.camera && playerPos) {
      const mPos = this.events.mannequinMesh.position;
      const dist = mPos.distanceTo(playerPos);
      if (dist > 1.4 && dist < 9.0) {
        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);
        const toMannequin = new THREE.Vector3().subVectors(mPos, playerPos).normalize();
        // 플레이어가 해골 쪽을 보고 있지 않을 때만(dot < 0.2) 소리 없이 접근
        if (camDir.dot(toMannequin) < 0.2) {
          mPos.lerp(playerPos, dt * 0.45);
          this.events.mannequinMesh.lookAt(playerPos.x, mPos.y, playerPos.z);
        }
      }
    }
  }

  _registerInteractable(mesh, data) {
    mesh.userData.interactable = data;
    this.interactables.push({ mesh, ...data });
  }

  _addPlayerFear(amount) {
    if (window.schoolPatchAddon) {
      window.schoolPatchAddon.addFear(amount);
    } else if (window.player && typeof window.player.fear === "number") {
      window.player.fear = Math.min(100, window.player.fear + amount);
    }
  }

  _playSound(type) {
    const ctx = this._ensureAudio();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "power_up") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.35);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.4);
      osc.start(now); osc.stop(now + 0.42);
    } else if (type === "error") {
      osc.type = "square";
      osc.frequency.setValueAtTime(150, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.25);
      osc.start(now); osc.stop(now + 0.26);
    } else if (type === "mic_howl") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(1550, now);
      osc.frequency.linearRampToValueAtTime(2400, now + 1.1);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 1.2);
      osc.start(now); osc.stop(now + 1.25);
    } else {
      osc.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.2);
      osc.start(now); osc.stop(now + 0.22);
    }
  }
}

window.fiveZonesPatch = new FiveZonesExpansionPatch();
export { FiveZonesExpansionPatch };
