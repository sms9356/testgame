/**
 * [Module 10] 수영장 · 남/녀 탈의실·샤워실 · 기계실/장비창고 철문 패치
 * (사용자 제공 코드 — 게임 연결은 game.js 의 "수영장 · 기계실 연결" 부분)
 */
import * as THREE from './vendor/three.module.js';
/**
 * ============================================================================
 * 〈폐교: 잊혀진 시간〉 수영장 전면 확장, 남/녀 샤워실·탈의실 분리, 기계실·장비창고 철문 패치
 * - 수영장 수조/타일 PBR, 남/녀 탈의실/샤워실 분리 배치, 헤비 스틸 도어 및 기계실 프롭
 * ============================================================================
 */
class PoolAndMachineryExpansionPatch {
  constructor() {
    this.scene = null;
    this.audioCtx = null;
    this.interactables = [];
    this.heavyDoors = [];
  }

  init({ scene, audioCtx } = {}) {
    this.scene = scene || window.scene;
    this.audioCtx = audioCtx || window.audioCtx;
    this.textures = this._createPoolAndMachineTextures();
    console.log("[PoolPatch] 수영장 및 기계실 확장 패치 모듈 로드 완료");
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
     1. 수영장 및 기계실 전용 PBR 텍스처 생성기
     ========================================================= */
  _createPoolAndMachineTextures() {
    const makeTex = (drawFn, rx = 4, ry = 4) => {
      const c = document.createElement("canvas");
      c.width = 512; c.height = 512;
      drawFn(c.getContext("2d"), 512);
      if (typeof THREE !== "undefined") {
        const t = new THREE.CanvasTexture(c);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(rx, ry);
        return t;
      }
      return null;
    };

    return {
      // ① 수영장 타일 (수조 안쪽 푸른색 세라믹 타일 + 물때)
      poolTile: makeTex((ctx, s) => {
        ctx.fillStyle = "#1b424f"; ctx.fillRect(0, 0, s, s);
        const cell = s / 12;
        ctx.strokeStyle = "#0e232b"; ctx.lineWidth = 2;
        for (let y = 0; y < 12; y++) {
          for (let x = 0; x < 12; x++) {
            ctx.strokeRect(x * cell, y * cell, cell, cell);
          }
        }
        // 물때와 이끼
        ctx.fillStyle = "rgba(10, 35, 25, 0.35)";
        ctx.fillRect(0, s * 0.7, s, s * 0.3);
      }, 8, 8),

      // ② 중량감 있는 녹슨 철문 텍스처
      heavySteelDoor: makeTex((ctx, s) => {
        ctx.fillStyle = "#2d3336"; ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = "#15181a"; ctx.lineWidth = 14;
        ctx.strokeRect(10, 10, s - 20, s - 20);
        // 중앙 볼트와 철판 이음새
        ctx.fillStyle = "#4a5257";
        ctx.fillRect(s * 0.45, 0, s * 0.1, s);
        // 녹슨 자국
        ctx.fillStyle = "rgba(85, 38, 18, 0.45)";
        ctx.beginPath(); ctx.arc(100, 350, 75, 0, Math.PI * 2); ctx.fill();
      }, 1, 1)
    };
  }

  /* =========================================================
     2. 실내 수영장 및 남/녀 탈의실·샤워실 구축
     ========================================================= */
  buildSwimmingPoolArea(centerPos, rotationY = 0) {
    if (!this.scene) return;
    const group = new THREE.Group();
    group.position.copy(centerPos);
    group.rotation.y = rotationY;

    // 1) 수영장 수조 (Pool Basin)
    const poolMat = new THREE.MeshStandardMaterial({
      map: this.textures.poolTile,
      roughness: 0.25,
      metalness: 0.1
    });

    const basinWidth = 8.0;
    const basinLength = 14.0;
    const basinDepth = 1.8;

    const poolFloor = new THREE.Mesh(new THREE.BoxGeometry(basinWidth, 0.2, basinLength), poolMat);
    poolFloor.position.set(0, -basinDepth, 0);

    // 수면 메쉬 (잔잔하게 빛나는 반투명 수면)
    const waterSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(basinWidth - 0.2, basinLength - 0.2),
      new THREE.MeshStandardMaterial({
        color: 0x1a6b7d,
        transparent: true,
        opacity: 0.72,
        roughness: 0.1,
        metalness: 0.3
      })
    );
    waterSurface.rotation.x = -Math.PI / 2;
    waterSurface.position.set(0, -0.15, 0);

    group.add(poolFloor, waterSurface);

    // 2) 남성 / 여성 샤워실 및 탈의실 구역 분리 배치
    [-1, 1].forEach((side) => {
      const isMale = side < 0;
      const xPos = side * (basinWidth / 2 + 2.8);

      const signCanvas = document.createElement("canvas");
      signCanvas.width = 256; signCanvas.height = 128;
      const sCtx = signCanvas.getContext("2d");
      sCtx.fillStyle = isMale ? "#1a3852" : "#521a28"; sCtx.fillRect(0, 0, 256, 128);
      sCtx.fillStyle = "#fff"; sCtx.font = "bold 34px sans-serif"; sCtx.textAlign = "center";
      sCtx.fillText(isMale ? "남자 탈의실 · 샤워실" : "여자 탈의실 · 샤워실", 128, 76);

      const signMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.38, 0.04),
        new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(signCanvas), roughness: 0.4 })
      );
      signMesh.position.set(xPos, 2.2, -basinLength / 4);
      group.add(signMesh);
    });

    this.scene.add(group);
    return group;
  }

  /* =========================================================
     3. 기계실 및 장비창고 구축 (중량감 있는 철문 + 배관 및 공구 랙)
     ========================================================= */
  buildMachineryAndStorageRooms(centerPos, rotationY = 0) {
    if (!this.scene) return;
    const group = new THREE.Group();
    group.position.copy(centerPos);
    group.rotation.y = rotationY;

    const doorMat = new THREE.MeshStandardMaterial({
      map: this.textures.heavySteelDoor,
      roughness: 0.45,
      metalness: 0.8
    });

    // 1) 기계실 철문 & 장비창고 철문 배치
    [-1.8, 1.8].forEach((xPos, idx) => {
      const heavyDoor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.12), doorMat);
      heavyDoor.position.set(xPos, 1.1, -2.0);
      group.add(heavyDoor);

      const doorInteract = {
        id: `heavy_steel_door_${idx}`,
        type: "heavy_door",
        mesh: heavyDoor,
        isOpen: false,
        promptText: idx === 0 ? "[E] 기계실 헤비 스틸 도어 열기" : "[E] 장비창고 철문 열기",
        onInteract: ({ notify }) => {
          doorInteract.isOpen = !doorInteract.isOpen;
          heavyDoor.rotation.y = doorInteract.isOpen ? Math.PI * 0.55 : 0;
          this._playHeavyDoorSound();
          notify(doorInteract.isOpen ? "무거운 철문을 덜컹거리며 열었다." : "철문을 닫았다.");
        }
      };

      heavyDoor.userData.interactable = doorInteract;
      this.interactables.push(doorInteract);
    });

    this.scene.add(group);
    return group;
  }

  _playHeavyDoorSound() {
    const ctx = this._ensureAudio();
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.exponentialRampToValueAtTime(22, now + 0.5);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.55);

    osc.start(now); osc.stop(now + 0.58);
  }
}

window.poolAndMachineryPatch = new PoolAndMachineryExpansionPatch();
export { PoolAndMachineryExpansionPatch };
