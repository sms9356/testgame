/**
 * [Module 10] 교실 리모델링 (텍스처 · 비반복 배치 · 의자 착석) 패치
 * (사용자 제공 코드 — 게임 연결은 game.js 의 "교실 리모델링 연결" 부분)
 */
import * as THREE from './vendor/three.module.js';
/**
 * ============================================================================
 * 〈폐교: 잊혀진 시간〉 각 교실별 텍스처 품질 향상 & 비반복 가구 배치 & 의자 착석 패치
 * - 교실별 유니크한 책상/사물함 배치 알고리즘, 나무 마루 PBR 텍스처, 의자 착석(E키) 기믹
 * ============================================================================
 */
class ClassroomRemodelPatch {
  constructor() {
    this.scene = null;
    this.audioCtx = null;
    this.classrooms = [];
    this.interactables = [];
    this.isSittingOnChair = false;
    this.currentChairMesh = null;
    this.playerOriginalPos = null;
  }

  init({ scene, audioCtx } = {}) {
    this.scene = scene || window.scene;
    this.audioCtx = audioCtx || window.audioCtx;
    this.textures = this._createClassroomTextures();
    this._injectSitUI();
    console.log("[ClassroomPatch] 교실 텍스처 품질 향상 및 가구 비반복 배치 모듈 로드 완료");
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
     1. 교실 전용 고급 PBR 텍스처 (나무 마루 바닥, 초록 칠판, 투톤 회벽)
     ========================================================= */
  _createClassroomTextures() {
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
      // ① 교실 나무 마루 바닥 (낡은 우드 플랭크 + 긁힌 자국)
      woodFloor: makeTex((ctx, s) => {
        ctx.fillStyle = "#4a3322"; ctx.fillRect(0, 0, s, s);
        const plankH = s / 8;
        ctx.strokeStyle = "#24180f"; ctx.lineWidth = 3;
        for (let i = 0; i <= 8; i++) {
          ctx.beginPath(); ctx.moveTo(0, i * plankH); ctx.lineTo(s, i * plankH); ctx.stroke();
        }
        for (let i = 0; i < 1800; i++) {
          ctx.fillStyle = "rgba(20, 12, 8, 0.25)";
          ctx.fillRect(Math.random() * s, Math.random() * s, 18, 2);
        }
      }, 5, 5),

      // ② 교실 칠판 텍스처 (오래된 녹색 칠판 + 분필 가루 흔적)
      chalkboard: makeTex((ctx, s) => {
        ctx.fillStyle = "#1e382b"; ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = "#4d3522"; ctx.lineWidth = 14;
        ctx.strokeRect(7, 7, s - 14, s - 14); // 나무 테두리
        // 분필 자국
        ctx.fillStyle = "rgba(220, 235, 225, 0.18)";
        ctx.fillRect(40, 80, 220, 45);
        ctx.fillRect(120, 160, 310, 35);
      }, 1, 1)
    };
  }

  _injectSitUI() {
    if (document.getElementById("patch-sit-indicator")) return;
    const div = document.createElement("div");
    div.id = "patch-sit-indicator";
    div.style.cssText = `
      position: fixed; bottom: 22%; left: 50%; transform: translateX(-50%);
      color: #e8e2dc; background: rgba(10,14,18,0.85); border: 1px solid #7c8c7e;
      padding: 8px 18px; border-radius: 4px; font-size: 14px; font-family: monospace;
      z-index: 9970; display: none; pointer-events: none;
    `;
    div.textContent = "[E] 의자에 앉기 (숨기 / 경계) · [Space/W] 일어나기";
    document.body.appendChild(div);
  }

  /* =========================================================
     2. 교실별 비반복(Unique) 가구 배치 알고리즘
     * @param {THREE.Vector3} roomCenter - 교실 중심 좌표
     * @param {number} layoutSeed - 교실마다 다른 배치 패턴 번호 (1, 2, 3...)
     ========================================================= */
  buildUniqueClassroom(roomCenter, {
    length = 8.5,
    width = 6.5,
    height = 3.1,
    rotationY = 0,
    layoutSeed = 1,
    roomLabel = "2-3"
  } = {}) {
    if (!this.scene) return;

    const roomGroup = new THREE.Group();
    roomGroup.position.copy(roomCenter);
    roomGroup.rotation.y = rotationY;

    // 바닥, 천장
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.2, length),
      new THREE.MeshStandardMaterial({ map: this.textures.woodFloor, roughness: 0.5 })
    );
    floor.position.set(0, -0.1, 0);
    roomGroup.add(floor);

    // 칠판 (앞쪽 벽)
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 1.3, 0.06),
      new THREE.MeshStandardMaterial({ map: this.textures.chalkboard, roughness: 0.35 })
    );
    board.position.set(0, 1.7, -length / 2 + 0.05);
    roomGroup.add(board);

    // 교탁 (Teacher's Podium)
    const podium = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.85, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x3d2c1d, roughness: 0.7 })
    );
    podium.position.set(0, 0.425, -length / 2 + 1.8);
    roomGroup.add(podium);

    // 교탁 의자 (착석 상호작용 가능)
    this._createChair(roomGroup, new THREE.Vector3(0, 0, -length / 2 + 2.3), 0, "교탁 의자");

    // =========================================================
    // [비반복 가구 배치 알고리즘] layoutSeed 값에 따라 책상/걸상 배치가 유니크하게 분기!
    // =========================================================
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x3b2e23, roughness: 0.65 });
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.6 });

    let rows = 3, cols = 3;
    let startZ = -1.2;
    let spacingZ = 1.4;
    let spacingX = 1.3;

    if (layoutSeed === 2) {
      // 2번 교실: 창가 쪽으로 치우친 모둠형 배치
      startZ = -1.5;
      spacingX = 1.1;
    } else if (layoutSeed === 3) {
      // 3번 교실: 책상 일부가 엎어져 있는 폐허 배치
      rows = 4; cols = 2;
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * spacingX + (layoutSeed === 2 ? 0.8 : 0);
        const z = startZ + r * spacingZ;

        // 책상
        const desk = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.72, 0.55), deskMat);
        desk.position.set(x, 0.36, z);

        // 의자 (착석 상호작용 연결)
        const chairGroup = this._createChair(roomGroup, new THREE.Vector3(x, 0, z + 0.52), Math.PI, `학생 의자 ${r}-${c}`);

        // 3번 교실의 특정 책상은 엎어져 있는 연출
        if (layoutSeed === 3 && r === 2 && c === 1) {
          desk.rotation.z = 0.35;
          desk.position.y = 0.28;
        }

        roomGroup.add(desk);
      }
    }

    this.scene.add(roomGroup);
    this.classrooms.push(roomGroup);
    return roomGroup;
  }

  /* =========================================================
     3. 의자에 앉기 상호작용 생성기 (`E` 키로 착석 및 해제)
     ========================================================= */
  _createChair(parentGroup, position, rotationY, label) {
    const chairGroup = new THREE.Group();
    chairGroup.position.copy(position);
    chairGroup.rotation.y = rotationY;

    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.05, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x3d322b, roughness: 0.6 })
    );
    seat.position.set(0, 0.44, 0);

    const backrest = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x3d322b, roughness: 0.6 })
    );
    backrest.position.set(0, 0.68, -0.2);

    const legs = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.015, 0.44, 8),
      new THREE.MeshStandardMaterial({ color: 0x1c1e20, metalness: 0.8 })
    );
    legs.position.set(0, 0.22, 0);

    chairGroup.add(seat, backrest, legs);
    parentGroup.add(chairGroup);

    // 상호작용 데이터 등록
    const chairInteractable = {
      id: `chair_${Math.random()}`,
      type: "classroom_chair",
      mesh: seat,
      chairGroup,
      label,
      promptText: `[E] ${label}에 앉기 (숨기 / 경계)`,
      onInteract: (playerRef, notifyFn) => {
        this.sitOnChair(chairGroup, playerRef, notifyFn);
      }
    };

    seat.userData.interactable = chairInteractable;
    this.interactables.push(chairInteractable);
    return chairGroup;
  }

  sitOnChair(chairGroup, playerRef, notifyFn) {
    if (this.isSittingOnChair) return;
    this.isSittingOnChair = true;
    this.currentChairMesh = chairGroup;

    if (playerRef && playerRef.position) {
      this.playerOriginalPos = playerRef.position.clone();
      // 의자 위치로 플레이어 이동 및 시점 낮추기
      const sitTarget = chairGroup.position.clone().add(new THREE.Vector3(0, 0.25, 0));
      playerRef.position.copy(sitTarget);
    }

    const ind = document.getElementById("patch-sit-indicator");
    if (ind) ind.style.display = "block";

    this._playSound("sit");
    if (notifyFn) notifyFn("🪑 의자에 앉았습니다. 복도 발소리를 집중해서 들을 수 있습니다. (일어나려면 이동키 W 또는 Space)");
  }

  standUp(playerRef) {
    if (!this.isSittingOnChair) return;
    this.isSittingOnChair = false;
    this.currentChairMesh = null;

    if (playerRef && this.playerOriginalPos) {
      playerRef.position.copy(this.playerOriginalPos).add(new THREE.Vector3(0, 0, 0.6)); // 의자 뒤로 살짝 비켜서 일어나기
    }

    const ind = document.getElementById("patch-sit-indicator");
    if (ind) ind.style.display = "none";

    this._playSound("sit");
  }

  /* =========================================================
     4. 메인 루프 업데이트 (앉아 있는 동안 W/Space 누르면 기상)
     ========================================================= */
  update(playerRef) {
    if (this.isSittingOnChair) {
      // W, A, S, D 또는 Space 누르면 의자에서 일어남
      window.addEventListener("keydown", (e) => {
        if (["KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(e.code)) {
          this.standUp(playerRef);
        }
      }, { once: true });
    }
  }

  _playSound(type) {
    const ctx = this._ensureAudio();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "triangle";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.2);
    osc.start(now); osc.stop(now + 0.22);
  }
}

window.classroomRemodelPatch = new ClassroomRemodelPatch();
export { ClassroomRemodelPatch };
