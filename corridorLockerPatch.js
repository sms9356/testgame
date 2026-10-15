/**
 * [Module 8] 3D 철제 캐비닛 사물함 & 학교 복도 리모델링 패치
 * (사용자 제공 코드 — 게임 연결은 game.js 의 "사물함 · 복도 리모델링 연결" 부분)
 */
import * as THREE from './vendor/three.module.js';
/**
 * ============================================================================
 * 〈폐교: 잊혀진 시간〉 실제 학교 복도 디테일 확장 & 3D 철제 캐비닛 사물함 패치
 * - 2D 박스형 사물함을 '몸체 + 회전하는 3D 문 + 루버 환기구 PBR + 내부 선반'으로 교체
 * - 한국 학교 복도 고증 프롭(복도 창틀, 돌출 학급 팻말, 소화전, 게시판, 형광등 갓) 추가
 * ============================================================================
 */
class CorridorAndLockerRemodelPatch {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.audioCtx = null;

    this.lockers = [];       // 생성된 3D 캐비닛 사물함 배열
    this.corridorProps = []; // 복도 디테일 소품 배열
    this.textures = {};

    this._injectLockerSlitOverlay();
  }

  init({ scene, camera, audioCtx } = {}) {
    this.scene = scene || window.scene;
    this.camera = camera || window.camera;
    this.audioCtx = audioCtx || window.audioCtx;
    this.textures = this._generateCabinetAndCorridorTextures();
    console.log("[CorridorLockerPatch] 3D 스틸 캐비닛 사물함 및 학교 복도 리모델링 패치 로드 완료");
  }

  /* =========================================================
     1. 사물함 내부 은신 시 '환기구 빗살 틈새(Louver Slit)' 1인칭 시야 오버레이
     ========================================================= */
  _injectLockerSlitOverlay() {
    if (document.getElementById("patch-locker-slit-view")) return;
    const style = document.createElement("style");
    style.textContent = `
      #patch-locker-slit-view {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 9975;
        display: none;
        background:
          /* 철제 캐비닛 상단 빗살 환기구(루버) 틈새로만 밖이 보이는 연출 */
          repeating-linear-gradient(
            180deg,
            rgba(5, 7, 8, 0.97) 0px,
            rgba(5, 7, 8, 0.97) 26px,
            rgba(0, 0, 0, 0.12) 28px,
            rgba(0, 0, 0, 0.12) 48px,
            rgba(18, 22, 24, 0.95) 50px
          ),
          radial-gradient(circle at center, transparent 35%, rgba(0, 0, 0, 0.98) 78%);
        box-shadow: inset 0 0 120px 60px #000000;
      }
      body.patch-inside-locker #patch-locker-slit-view {
        display: block;
      }
    `;
    document.head.appendChild(style);

    const div = document.createElement("div");
    div.id = "patch-locker-slit-view";
    document.body.appendChild(div);
  }

  /* =========================================================
     2. 실제 학교 철제 캐비닛(Steel Locker) PBR 텍스처 & 복도 디테일 텍스처 생성
     ========================================================= */
  _generateCabinetAndCorridorTextures() {
    const createCanvas = (w = 512, h = 1024) => {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      return { c, ctx: c.getContext("2d") };
    };

    // ① 철제 사물함 문짝 텍스처 (Color Map + Bump Map 세트)
    const buildLockerDoorMaps = (lockerNumberStr = "07", isRusted = false) => {
      const { c: cCol, ctx: col } = createCanvas(512, 1024);
      const { c: cBump, ctx: bump } = createCanvas(512, 1024);

      // 베이스: 한국 학교 특유의 차가운 청회색/베이지 분체도장 강판
      col.fillStyle = "#7a8688";
      col.fillRect(0, 0, 512, 1024);
      bump.fillStyle = "#808080";
      bump.fillRect(0, 0, 512, 1024);

      // 문짝 바깥쪽 프레스 철판 단차 프레임 (입체 베벨)
      col.strokeStyle = "#485254";
      col.lineWidth = 14;
      col.strokeRect(18, 18, 476, 988);

      bump.strokeStyle = "#ffffff";
      bump.lineWidth = 10;
      bump.strokeRect(20, 20, 472, 984);
      bump.strokeStyle = "#202020";
      bump.lineWidth = 6;
      bump.strokeRect(12, 12, 488, 1000);

      // 상단 이름표/번호표 꽂이 프레임 (Metal Nameplate Holder)
      col.fillStyle = "#535d5f";
      col.fillRect(176, 70, 160, 64);
      col.fillStyle = "#dbd6c8"; // 바랜 종이 명찰
      col.fillRect(186, 78, 140, 48);
      col.fillStyle = "#1e2224";
      col.font = "bold 32px monospace";
      col.textAlign = "center";
      col.fillText(lockerNumberStr, 256, 113);

      bump.fillStyle = "#e0e0e0";
      bump.fillRect(176, 70, 160, 64);

      // 상단 & 하단 루버(빗살형 공기 통풍구 슬릿 6줄씩 — 실제 캐비닛의 핵심 디테일!)
      const drawLouvers = (startY, count) => {
        for (let i = 0; i < count; i++) {
          const y = startY + i * 28;
          // 위쪽은 볼록하게 빛을 받고 아래쪽은 어두운 그림자 슬릿
          const grad = col.createLinearGradient(0, y, 0, y + 18);
          grad.addColorStop(0, "#96a3a6");
          grad.addColorStop(0.55, "#424a4c");
          grad.addColorStop(1, "#121617");
          col.fillStyle = grad;
          col.fillRect(110, y, 292, 18);

          // 범프맵에 강한 요철 부여
          bump.fillStyle = "#ffffff";
          bump.fillRect(110, y, 292, 8);
          bump.fillStyle = "#050505";
          bump.fillRect(110, y + 8, 292, 10);
        }
      };
      drawLouvers(175, 6); // 상단 환기구 6줄
      drawLouvers(760, 5); // 하단 환기구 5줄

      // 우측 중앙 매립형 크롬 손잡이 (Recessed Handle Pocket) & 열쇠 구멍
      col.fillStyle = "#2b3133";
      col.fillRect(390, 450, 58, 130);
      col.strokeStyle = "#b8c2c4";
      col.lineWidth = 5;
      col.strokeRect(390, 450, 58, 130);

      // 손잡이 안쪽 크롬 레버
      col.fillStyle = "#c4cdd0";
      col.fillRect(408, 475, 22, 80);

      // 열쇠 구멍 (Keyhole Cylinder)
      col.fillStyle = "#d0d6d8";
      col.beginPath(); col.arc(419, 418, 14, 0, Math.PI * 2); col.fill();
      col.fillStyle = "#111";
      col.fillRect(416, 412, 6, 12);

      bump.fillStyle = "#101010";
      bump.fillRect(390, 450, 58, 130);
      bump.fillStyle = "#ffffff";
      bump.fillRect(408, 475, 22, 80);

      // 세월의 흔적: 스크래치, 손때, 하단 녹슨 얼룩(Rust)
      const stainGrad = col.createRadialGradient(419, 510, 10, 419, 510, 140);
      stainGrad.addColorStop(0, "rgba(25, 20, 15, 0.38)");
      stainGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      col.fillStyle = stainGrad;
      col.fillRect(260, 360, 240, 300);

      if (isRusted) {
        col.fillStyle = "rgba(95, 42, 18, 0.42)";
        col.beginPath(); col.arc(85, 920, 95, 0, Math.PI * 2); col.fill();
        col.beginPath(); col.arc(430, 880, 65, 0, Math.PI * 2); col.fill();
      }

      if (typeof THREE !== "undefined") {
        return {
          map: new THREE.CanvasTexture(cCol),
          bumpMap: new THREE.CanvasTexture(cBump)
        };
      }
      return null;
    };

    // ② 복도 교실 쪽 상단 유리창 + 나무 창틀 텍스처
    const buildCorridorWindowTex = () => {
      const { c, ctx } = createCanvas(1024, 512);
      ctx.fillStyle = "#2b2118"; // 낡은 나무 창틀
      ctx.fillRect(0, 0, 1024, 512);

      // 4칸 미닫이 어두운 반투명 유리창
      for (let i = 0; i < 4; i++) {
        const x = 18 + i * 250;
        const g = ctx.createLinearGradient(x, 20, x + 232, 492);
        g.addColorStop(0, "#141d21");
        g.addColorStop(0.5, "#233136");
        g.addColorStop(1, "#0e1417");
        ctx.fillStyle = g;
        ctx.fillRect(x, 20, 232, 472);

        // 창살 가로대
        ctx.fillStyle = "#2b2118";
        ctx.fillRect(x, 248, 232, 14);
      }
      return typeof THREE !== "undefined" ? new THREE.CanvasTexture(c) : null;
    };

    // ③ 복도 옥내소화전 함 텍스처 ('소화전 FIRE HYDRANT')
    const buildHydrantTex = () => {
      const { c, ctx } = createCanvas(256, 384);
      ctx.fillStyle = "#7a8082";
      ctx.fillRect(0, 0, 256, 384);
      ctx.strokeStyle = "#3a3e40";
      ctx.lineWidth = 10;
      ctx.strokeRect(8, 8, 240, 368);

      // 상단 붉은 경종 표시창
      ctx.fillStyle = "#9e1b1b";
      ctx.fillRect(24, 28, 208, 70);
      ctx.fillStyle = "#f2ece4";
      ctx.font = "bold 30px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("옥내소화전", 128, 74);

      return typeof THREE !== "undefined" ? new THREE.CanvasTexture(c) : null;
    };

    return {
      buildLockerDoorMaps,
      corridorWindow: buildCorridorWindowTex(),
      fireHydrant: buildHydrantTex()
    };
  }

  /* =========================================================
     3. 실제 회전하는 문과 내부 공간을 가진 '3D 스틸 캐비닛 사물함 묶음(Row)' 생성
     * - 기존 2D 박스 사물함을 대체하거나 복도 벽면에 일렬로 배치
     ========================================================= */
  create3DSteelLockerBank(startPosition, {
    count = 5,
    rotationY = 0,
    startNumber = 1
  } = {}) {
    if (!this.scene) return;

    const bankGroup = new THREE.Group();
    bankGroup.position.copy(startPosition);
    bankGroup.rotation.y = rotationY;

    const lockerW = 0.62;
    const lockerH = 1.88;
    const lockerD = 0.54;
    const gap = 0.02;

    // 캐비닛 외함/내부 철판 재질 (유광 메탈릭 페인트 질감)
    const bodySteelMat = new THREE.MeshStandardMaterial({
      color: 0x5c6769,
      roughness: 0.42,
      metalness: 0.68
    });
    const darkInteriorMat = new THREE.MeshStandardMaterial({
      color: 0x16191a,
      roughness: 0.85,
      metalness: 0.3
    });

    for (let i = 0; i < count; i++) {
      const unitGroup = new THREE.Group();
      unitGroup.position.set(i * (lockerW + gap), 0, 0);

      // 1) 캐비닛 속이 빈 3D 몸체 (뒷판 + 좌우 측판 + 상하판 + 내부 선반) — 문이 열렸을 때 실제 내부가 보임!
      const backPlate = new THREE.Mesh(new THREE.BoxGeometry(lockerW, lockerH, 0.03), bodySteelMat);
      backPlate.position.set(0, lockerH / 2, -lockerD / 2);

      const leftSide = new THREE.Mesh(new THREE.BoxGeometry(0.03, lockerH, lockerD), bodySteelMat);
      leftSide.position.set(-lockerW / 2 + 0.015, lockerH / 2, 0);

      const rightSide = new THREE.Mesh(new THREE.BoxGeometry(0.03, lockerH, lockerD), bodySteelMat);
      rightSide.position.set(lockerW / 2 - 0.015, lockerH / 2, 0);

      const topPlate = new THREE.Mesh(new THREE.BoxGeometry(lockerW, 0.04, lockerD), bodySteelMat);
      topPlate.position.set(0, lockerH - 0.02, 0);

      const bottomPlate = new THREE.Mesh(new THREE.BoxGeometry(lockerW, 0.08, lockerD), bodySteelMat);
      bottomPlate.position.set(0, 0.04, 0);

      // 내부 상단 가방 선반
      const innerShelf = new THREE.Mesh(new THREE.BoxGeometry(lockerW - 0.06, 0.025, lockerD - 0.06), darkInteriorMat);
      innerShelf.position.set(0, lockerH * 0.74, 0);

      unitGroup.add(backPlate, leftSide, rightSide, topPlate, bottomPlate, innerShelf);

      // 2) 경첩(Hinge) 피벗을 기준으로 실제로 회전하며 열리는 3D 철문!
      const numStr = String(startNumber + i).padStart(2, "0");
      const doorMaps = this.textures.buildLockerDoorMaps(numStr, i % 3 === 0);

      const doorMat = new THREE.MeshStandardMaterial({
        map: doorMaps.map,
        bumpMap: doorMaps.bumpMap,
        bumpScale: 0.025,
        roughness: 0.35,
        metalness: 0.72
      });

      // 왼쪽 모서리를 회전축(Pivot)으로 설정
      const doorPivot = new THREE.Group();
      doorPivot.position.set(-lockerW / 2 + 0.02, lockerH / 2, lockerD / 2);

      const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(lockerW - 0.04, lockerH - 0.08, 0.035), doorMat);
      doorMesh.position.set((lockerW - 0.04) / 2, 0, 0);

      // 문짝 바깥으로 튀어나온 입체 손잡이 메쉬 추가 (2D 느낌 완전 제거!)
      const handle3D = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.14, 0.04),
        new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.2, metalness: 0.9 })
      );
      handle3D.position.set(lockerW - 0.12, -0.02, 0.025);
      doorMesh.add(handle3D);

      doorPivot.add(doorMesh);
      unitGroup.add(doorPivot);

      // 일부 사물함은 처음부터 문이 살짝 삐걱거리며 열려 있는 디테일
      const initiallyAjar = (i === 2);
      if (initiallyAjar) {
        doorPivot.rotation.y = -0.28;
      }

      // 3) 기존 사물함 상호작용(파밍 / 은신)과 연동되는 데이터 객체
      const lockerData = {
        id: `steel_locker_${startNumber + i}`,
        type: "locker_3d",
        mesh: doorMesh,
        doorPivot,
        unitGroup,
        isOpen: initiallyAjar,
        isPlayerInside: false,
        targetRotationY: initiallyAjar ? -0.28 : 0,
        // 문을 열고 닫는 애니메이션 트리거 함수
        toggleDoor: (openState) => {
          lockerData.isOpen = openState !== undefined ? openState : !lockerData.isOpen;
          lockerData.targetRotationY = lockerData.isOpen ? -Math.PI * 0.62 : 0;
          this._playMetalLockerSound(lockerData.isOpen);
        },
        // 플레이어가 이 사물함 안에 숨거나 나올 때 호출
        setPlayerHiding: (hiding) => {
          lockerData.isPlayerInside = hiding;
          document.body.classList.toggle("patch-inside-locker", hiding);
          // 숨을 때는 문이 열렸다가 닫히는 연출
          lockerData.targetRotationY = -Math.PI * 0.55;
          this._playMetalLockerSound(true);
          setTimeout(() => {
            lockerData.targetRotationY = hiding ? -0.04 : 0; // 안에 숨으면 살짝 틈만 남기고 닫힘
            this._playMetalLockerSound(false);
          }, 280);
        }
      };

      doorMesh.userData.locker3D = lockerData;
      this.lockers.push(lockerData);
      bankGroup.add(unitGroup);
    }

    this.scene.add(bankGroup);
    return bankGroup;
  }

  /* =========================================================
     4. 학교 복도 디테일 확장 공사 (복도 창문, 돌출 호수판, 소화전, 게시판, 형광등)
     * - 밋밋한 복도 벽면에 호출하면 즉시 실제 한국 학교 복도 디테일을 부착
     ========================================================= */
  upgradeCorridorSegment(segmentCenterPos, {
    length = 18,
    width = 3.4,
    height = 3.1,
    roomLabels = ["1-1", "1-2", "교무실"]
  } = {}) {
    if (!this.scene) return;
    const group = new THREE.Group();
    group.position.copy(segmentCenterPos);

    const woodTrimMat = new THREE.MeshStandardMaterial({ color: 0x38281c, roughness: 0.65 });

    // 1) 양쪽 복도 벽을 따라 이어지는 입체 나무 허리 몰딩(Chair Rail) & 바닥 걸레받이(Baseboard)
    [-1, 1].forEach((side) => {
      const x = side * (width / 2 - 0.03);
      const chairRail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, length), woodTrimMat);
      chairRail.position.set(x, 1.15, 0);

      const baseboard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, length), woodTrimMat);
      baseboard.position.set(x, 0.06, 0);

      group.add(chairRail, baseboard);
    });

    // 2) 교실 쪽 벽면 상단 '복도 미닫이 채광창(Transom Windows)' 배치
    const winMat = new THREE.MeshStandardMaterial({
      map: this.textures.corridorWindow,
      roughness: 0.25,
      metalness: 0.3
    });
    for (let z = -length / 2 + 3.0; z <= length / 2 - 3.0; z += 6.0) {
      const corridorWin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.05, 3.2), winMat);
      corridorWin.position.set(-width / 2 + 0.04, 2.05, z);
      group.add(corridorWin);
    }

    // 3) 교실 문 위쪽에 벽에서 직각으로 튀어나온 '돌출형 교실 호수 아크릴 명패'
    roomLabels.forEach((labelTxt, idx) => {
      const zPos = -length / 2 + 3.5 + idx * 5.5;
      const signCanvas = document.createElement("canvas");
      signCanvas.width = 256; signCanvas.height = 128;
      const sCtx = signCanvas.getContext("2d");
      sCtx.fillStyle = "#1c262b"; sCtx.fillRect(0, 0, 256, 128);
      sCtx.strokeStyle = "#b5b0a3"; sCtx.lineWidth = 8; sCtx.strokeRect(4, 4, 248, 120);
      sCtx.fillStyle = "#f0eae1"; sCtx.font = "bold 44px sans-serif"; sCtx.textAlign = "center";
      sCtx.fillText(labelTxt, 128, 80);

      const signMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.24, 0.03),
        new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(signCanvas), roughness: 0.3 })
      );
      signMesh.position.set(-width / 2 + 0.26, 2.45, zPos);
      group.add(signMesh);
    });

    // 4) 복도 벽면 '옥내소화전(붉은 비상벨 표시등 포함)' & '녹색 학급 환경미화 게시판'
    const hydrantBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.95, 0.68),
      new THREE.MeshStandardMaterial({ map: this.textures.fireHydrant, metalness: 0.6, roughness: 0.4 })
    );
    hydrantBox.position.set(width / 2 - 0.07, 1.35, -2.5);

    // 소화전 상단 붉은 비상 위치표시등 (어두운 복도에서 은은하게 붉은 빛 발산)
    const redIndMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff1e1e })
    );
    redIndMesh.position.set(width / 2 - 0.14, 1.92, -2.5);
    const redGlow = new THREE.PointLight(0xff1a1a, 0.45, 3.5);
    redGlow.position.copy(redIndMesh.position);

    // 녹색 펠트 게시판 (삐뚤어진 가정통신문/포스터 부착)
    const noticeBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 1.1, 2.1),
      new THREE.MeshStandardMaterial({ color: 0x243b2c, roughness: 0.9 })
    );
    noticeBoard.position.set(width / 2 - 0.04, 1.6, 2.8);

    group.add(hydrantBox, redIndMesh, redGlow, noticeBoard);

    // 5) 천장 2구 철제 형광등 등기구 프레임 (3D 입체 갓)
    for (let z = -length / 2 + 3.0; z <= length / 2 - 3.0; z += 6.0) {
      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.07, 1.25),
        new THREE.MeshStandardMaterial({ color: 0xd0d4d6, emissive: 0x334448, roughness: 0.3 })
      );
      fixture.position.set(0, height - 0.04, z);
      group.add(fixture);
    }

    this.scene.add(group);
    this.corridorProps.push(group);
    return group;
  }

  /* =========================================================
     5. 매 프레임 업데이트 (사물함 3D 철문 부드러운 개폐 애니메이션 보간)
     ========================================================= */
  update(dt = 0.016) {
    for (const lk of this.lockers) {
      if (lk.doorPivot) {
        const diff = lk.targetRotationY - lk.doorPivot.rotation.y;
        if (Math.abs(diff) > 0.005) {
          lk.doorPivot.rotation.y += diff * Math.min(1, dt * 10.0);
        }
      }
    }
  }

  /* =========================================================
     6. 철제 캐비닛 문 여닫는 묵직한 금속 삐걱거림 & 철컥 사운드 (Web Audio API)
     ========================================================= */
  _playMetalLockerSound(isOpening = true) {
    if (!this.audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AC();
    }
    const ctx = this.audioCtx;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;

    // 1) 경첩 끼이익 소리 (주파수 변조 사각파)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(isOpening ? 310 : 420, now);
    osc.frequency.exponentialRampToValueAtTime(isOpening ? 540 : 140, now + 0.22);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);

    // 2) 철판 텅! 닫히는 금속 공명음
    if (!isOpening) {
      const clang = ctx.createOscillator();
      const cGain = ctx.createGain();
      clang.type = "triangle";
      clang.frequency.setValueAtTime(135, now + 0.16);
      clang.frequency.exponentialRampToValueAtTime(42, now + 0.34);
      cGain.gain.setValueAtTime(0.35, now + 0.16);
      cGain.gain.exponentialRampToValueAtTime(0.005, now + 0.36);
      clang.connect(cGain);
      cGain.connect(ctx.destination);
      clang.start(now + 0.16);
      clang.stop(now + 0.37);
    }
  }
}

window.corridorLockerPatch = new CorridorAndLockerRemodelPatch();
export { CorridorAndLockerRemodelPatch };
