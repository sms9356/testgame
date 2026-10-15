/**
 * [Module 7] 본관 ↔ 별관 실내 연결복도 패치
 * (사용자 제공 코드 — 게임 연결은 game.js 의 "실내 연결복도 연결" 부분)
 */
import * as THREE from './vendor/three.module.js';
/**
 * ============================================================================
 * 〈폐교: 잊혀진 시간〉 본관 ↔ 별관 '실내 연결복도(Indoor Passage)' 패치 모듈
 * - 막힌 실내 복도, 철제 방화문 바리케이드, 청소도구함 은신, 스팀 배관 밸브, 순차 소등 이벤트
 * ============================================================================
 */
class IndoorCorridorPassagePatch {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.audioCtx = null;

    this.passageGroup = null;
    this.leftDoorPivot = null;
    this.rightDoorPivot = null;
    this.steamParticles = null;
    this.ceilingLights = [];

    // 실내 연결복도 상태 관리
    this.state = {
      fireDoorClosed: false,
      fireDoorBarricaded: false,
      barricadeTimer: 0,         // 방화문 바리케이드 유지 시간 (25초)
      steamActive: false,
      steamTimer: 0,             // 스팀 분출 유지 시간 (12초)
      blackoutTriggered: false   // 복도 순차 소등 공포 이벤트 발동 여부
    };

    this.interactables = []; // 기존 게임의 E키 상호작용에 추가할 목록
  }

  init({ scene, camera, audioCtx } = {}) {
    this.scene = scene || window.scene;
    this.camera = camera || window.camera;
    this.audioCtx = audioCtx || window.audioCtx;
    this.textures = this._createPassageTextures();
    console.log("[IndoorPassagePatch] 본관-별관 실내 연결복도 모듈 로드 완료");
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
     1. 실내 연결복도 전용 절차적 텍스처 (습기 찬 복도 벽, 리놀륨/시멘트 바닥, 철제 방화문)
     ========================================================= */
  _createPassageTextures() {
    const makeTex = (drawFn, rx = 1, ry = 1) => {
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
      // ① 실내 연결복도 벽면: 상단 바랜 회벽 + 하단 군청/청록색 유성페인트 + 습기 곰팡이
      indoorWall: makeTex((ctx, s) => {
        const split = Math.floor(s * 0.58);
        ctx.fillStyle = "#b8b3a6"; ctx.fillRect(0, 0, s, split);
        ctx.fillStyle = "#42524c"; ctx.fillRect(0, split, s, s - split);
        ctx.fillStyle = "#2b241d"; ctx.fillRect(0, split - 6, s, 12);

        // 하단 습기로 인해 올라온 검은 곰팡이와 페인트 들뜸
        for (let i = 0; i < 80; i++) {
          ctx.fillStyle = "rgba(18, 20, 16, 0.22)";
          ctx.beginPath();
          ctx.arc(Math.random() * s, split + Math.random() * (s - split), 8 + Math.random() * 28, 0, Math.PI * 2);
          ctx.fill();
        }
      }, 4, 1),

      // ② 실내 복도 바닥: 낡은 학교 디럭스 타일(체크무늬 마모 타일) + 중앙 건물 이음매 줄눈
      indoorFloor: makeTex((ctx, s) => {
        const grid = 4;
        const cell = s / grid;
        for (let y = 0; y < grid; y++) {
          for (let x = 0; x < grid; x++) {
            ctx.fillStyle = (x + y) % 2 === 0 ? "#4e524f" : "#434744";
            ctx.fillRect(x * cell, y * cell, cell, cell);
            ctx.strokeStyle = "#2b2d2b";
            ctx.lineWidth = 2;
            ctx.strokeRect(x * cell, y * cell, cell, cell);
          }
        }
        // 발길질에 닳은 흙먼지 자국
        ctx.fillStyle = "rgba(25, 22, 18, 0.28)";
        ctx.fillRect(s * 0.2, 0, s * 0.6, s);
      }, 3, 8),

      // ③ 철제 양개 방화문 텍스처 ('방화문 · 상시개방엄금' 스텐실)
      fireDoorTex: makeTex((ctx, s) => {
        ctx.fillStyle = "#4a4e52"; ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = "#2b2e30"; ctx.lineWidth = 10;
        ctx.strokeRect(12, 12, s - 24, s - 24);

        // 녹슨 얼룩
        ctx.fillStyle = "rgba(95, 42, 22, 0.35)";
        ctx.beginPath(); ctx.arc(120, 400, 70, 0, Math.PI * 2); ctx.fill();

        // 경고 문구
        ctx.fillStyle = "#c9382e";
        ctx.fillRect(100, 160, s - 200, 70);
        ctx.fillStyle = "#f0eae1";
        ctx.font = "bold 36px sans-serif";
        ctx.fillText("방 화 문", 185, 208);
        ctx.fillStyle = "#d4cfc7";
        ctx.font = "bold 24px sans-serif";
        ctx.fillText("상 시 개 방 엄 금", 160, 265);
      }, 1, 1)
    };
  }

  /* =========================================================
     2. 본관-별관 실내 연결복도 3D 아키텍처 및 프롭 생성
     * @param {THREE.Vector3} centerPos - 연결복도 중심 좌표
     ========================================================= */
  buildIndoorPassage(centerPos, { length = 16, width = 3.0, height = 2.9, rotationY = 0 } = {}) {
    if (!this.scene) return;

    const group = new THREE.Group();
    group.position.copy(centerPos);
    group.rotation.y = rotationY;
    this.passageGroup = group;

    const wallMat = new THREE.MeshStandardMaterial({ map: this.textures.indoorWall, roughness: 0.78 });
    const floorMat = new THREE.MeshStandardMaterial({ map: this.textures.indoorFloor, roughness: 0.62 });
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x6e6c64, roughness: 0.85 });

    // 1) 바닥, 천장, 양옆 막힌 실내 콘크리트 벽 생성
    const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, length), floorMat);
    floor.position.set(0, -0.1, 0);

    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, length), ceilingMat);
    ceiling.position.set(0, height + 0.1, 0);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, height, length), wallMat);
    leftWall.position.set(-width / 2, height / 2, 0);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, height, length), wallMat);
    rightWall.position.set(width / 2, height / 2, 0);

    group.add(floor, ceiling, leftWall, rightWall);

    // 2) 천장 노출 소방/보일러 파이프 2줄 & 벽면 스팀 밸브 (상호작용 기믹)
    const redPipeMat = new THREE.MeshStandardMaterial({ color: 0x7a1f1b, metalness: 0.7, roughness: 0.4 });
    const silverPipeMat = new THREE.MeshStandardMaterial({ color: 0x7d8487, metalness: 0.6, roughness: 0.5 });

    const firePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, length, 10), redPipeMat);
    firePipe.rotation.x = Math.PI / 2;
    firePipe.position.set(-width / 2 + 0.35, height - 0.22, 0);

    const steamPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, length, 10), silverPipeMat);
    steamPipe.rotation.x = Math.PI / 2;
    steamPipe.position.set(width / 2 - 0.35, height - 0.25, 0);

    // 벽으로 내려온 스팀 밸브 핸들
    const valveWheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.025, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xc42b2b, metalness: 0.6 })
    );
    valveWheel.rotation.y = Math.PI / 2;
    valveWheel.position.set(width / 2 - 0.14, 1.35, -2.2);

    // 스팀 분출 구름 메쉬 (평소엔 숨김)
    this.steamParticles = new THREE.Mesh(
      new THREE.SphereGeometry(1.35, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xd8e2e6, transparent: true, opacity: 0.0, depthWrite: false })
    );
    this.steamParticles.position.set(0, 1.4, -2.2);

    group.add(firePipe, steamPipe, valveWheel, this.steamParticles);

    // 상호작용 등록 ①: 고압 스팀 밸브 개방 (시야 연막 + 소음 유인)
    this._registerInteractable(valveWheel, {
      id: "passage_steam_valve",
      promptText: "[E] 노후 난방배관 스팀 밸브 열기 (수증기 연막 분출 & 소음 유인)",
      onInteract: ({ notify, alertMonsterFn }) => {
        if (this.state.steamActive) {
          notify("이미 고압 수증기가 뿜어져 나오고 있다.");
          return;
        }
        this.state.steamActive = true;
        this.state.steamTimer = 12.0;
        if (this.steamParticles) this.steamParticles.material.opacity = 0.65;
        this._playSound("steam_burst");

        notify("💨 [스팀 연막 작동] 배관에서 뜨거운 수증기가 터져 나와 통로 시야를 가리고 소음을 냅니다! (12초간 괴물 시야 차단)");
        if (alertMonsterFn) alertMonsterFn(centerPos, 20.0);
      }
    });

    // 3) 통로 중앙 '양개형 철제 방화문(Double Fire Door)' + 소화기 바리케이드
    const doorMat = new THREE.MeshStandardMaterial({
      map: this.textures.fireDoorTex,
      roughness: 0.45,
      metalness: 0.7
    });

    const halfW = (width - 0.2) / 2;
    this.leftDoorPivot = new THREE.Group();
    this.leftDoorPivot.position.set(-width / 2 + 0.1, 0, 0);
    const leftDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(halfW, 2.3, 0.08), doorMat);
    leftDoorMesh.position.set(halfW / 2, 1.15, 0);
    this.leftDoorPivot.add(leftDoorMesh);

    this.rightDoorPivot = new THREE.Group();
    this.rightDoorPivot.position.set(width / 2 - 0.1, 0, 0);
    const rightDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(halfW, 2.3, 0.08), doorMat);
    rightDoorMesh.position.set(-halfW / 2, 1.15, 0);
    this.rightDoorPivot.add(rightDoorMesh);

    // 처음에는 양쪽으로 활짝 열려 벽에 붙어 있음
    this.leftDoorPivot.rotation.y = Math.PI * 0.45;
    this.rightDoorPivot.rotation.y = -Math.PI * 0.45;

    group.add(this.leftDoorPivot, this.rightDoorPivot);

    // 상호작용 등록 ②: 양개형 철제 방화문 닫고 걸어 잠그기 (본관↔별관 물리적 차단)
    const doorHandler = {
      id: "passage_fire_door",
      promptText: "[E] 연결복도 철제 방화문 닫고 빗장 걸기 (25초간 본관↔별관 봉쇄)",
      onInteract: ({ notify, blockMonsterPathFn, alertMonsterFn }) => {
        if (this.state.fireDoorClosed) {
          this.state.fireDoorClosed = false;
          this.state.fireDoorBarricaded = false;
          this.leftDoorPivot.rotation.y = Math.PI * 0.45;
          this.rightDoorPivot.rotation.y = -Math.PI * 0.45;
          this._playSound("door_heavy");
          notify("철제 방화문의 빗장을 풀고 다시 열어젖혔다.");
          if (blockMonsterPathFn) blockMonsterPathFn(false);
          return;
        }

        this.state.fireDoorClosed = true;
        this.state.fireDoorBarricaded = true;
        this.state.barricadeTimer = 25.0;
        this.leftDoorPivot.rotation.y = 0;
        this.rightDoorPivot.rotation.y = 0;
        this._playSound("door_slam");

        notify("🔒 [방화문 봉쇄] 무거운 철제 방화문을 닫고 부서진 걸상 다리를 손잡이에 끼워 잠갔습니다! (25초간 괴물 통과 불가)");
        if (blockMonsterPathFn) blockMonsterPathFn(true);
        if (alertMonsterFn) alertMonsterFn(centerPos, 24.0);
      }
    };
    this._registerInteractable(leftDoorMesh, doorHandler);
    this._registerInteractable(rightDoorMesh, doorHandler);

    // 4) 복도 한쪽 구석 '철제 청소도구함(Mop Locker)' (긴급 은신 포인트) & 폐책걸상 바리케이드
    const mopLocker = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 1.85, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x3b4d43, roughness: 0.5, metalness: 0.6 })
    );
    mopLocker.position.set(-width / 2 + 0.5, 0.925, 3.8);
    group.add(mopLocker);

    this._registerInteractable(mopLocker, {
      id: "passage_mop_locker",
      promptText: "[E] 복도 청소도구함 안에 숨기 (사물함 은신 연동)",
      onInteract: ({ notify, togglePlayerHide }) => {
        this._playSound("door_heavy");
        notify("곰팡이와 락스 냄새가 나는 좁은 청소도구함 안으로 몸을 숨겼다. [Space]로 숨을 참을 수 있다.");
        if (togglePlayerHide) togglePlayerHide();
      }
    });

    // 5) 천장 형광등 3개 일렬 배치 (순차 소등 공포 연출용)
    [-length * 0.32, 0, length * 0.32].forEach((zPos) => {
      const pLight = new THREE.PointLight(0xd8f0ff, 0.85, 9, 1.8);
      pLight.position.set(0, height - 0.25, zPos);
      group.add(pLight);
      this.ceilingLights.push(pLight);
    });

    this.scene.add(group);
    return group;
  }

  /* =========================================================
     3. 매 프레임 업데이트 (방화문 바리케이드 타이머, 스팀 연막, 순차 소등 이벤트)
     ========================================================= */
  update(dt = 0.016, playerPos, notifyFn) {
    if (!this.passageGroup || !playerPos) return;

    // 1) 방화문 바리케이드 유지 시간 체크
    if (this.state.fireDoorBarricaded) {
      this.state.barricadeTimer -= dt;
      if (this.state.barricadeTimer <= 0) {
        this.state.fireDoorBarricaded = false;
        this.state.fireDoorClosed = false;
        if (this.leftDoorPivot) this.leftDoorPivot.rotation.y = Math.PI * 0.45;
        if (this.rightDoorPivot) this.rightDoorPivot.rotation.y = -Math.PI * 0.45;
        this._playSound("door_slam");
        if (notifyFn) notifyFn("💥 연결복도 방화문에 끼워둔 걸상 다리가 부러지며 문이 다시 열렸습니다!");
      }
    }

    // 2) 스팀 연막 지속 시간 체크
    if (this.state.steamActive) {
      this.state.steamTimer -= dt;
      if (this.state.steamTimer <= 0) {
        this.state.steamActive = false;
        if (this.steamParticles) this.steamParticles.material.opacity = 0.0;
      }
    }

    // 3) 복도 첫 진입 시 '차례대로 꺼지는 형광등(Sequential Blackout)' 공포 이벤트
    const dist = playerPos.distanceTo(this.passageGroup.position);
    if (!this.state.blackoutTriggered && dist < 5.5) {
      this.state.blackoutTriggered = true;
      this._triggerSequentialBlackout(notifyFn);
    }
  }

  _triggerSequentialBlackout(notifyFn) {
    if (notifyFn) {
      notifyFn("연결복도 저편에서부터 천장 형광등이 하나씩 '퍽! 퍽!' 소리를 내며 꺼져 들어온다...");
    }
    if (window.schoolPatchAddon) window.schoolPatchAddon.addFear(12);

    this.ceilingLights.forEach((light, idx) => {
      setTimeout(() => {
        this._playSound("bulb_pop");
        light.intensity = 0.05;
      }, (idx + 1) * 650);
    });

    // 4초 뒤 비상 전력으로 희미하게 하나만 다시 켜짐
    setTimeout(() => {
      if (this.ceilingLights[1]) this.ceilingLights[1].intensity = 0.45;
    }, 4200);
  }

  _registerInteractable(mesh, data) {
    mesh.userData.interactable = data;
    this.interactables.push({ mesh, ...data });
  }

  /* =========================================================
     4. Web Audio API 절차적 사운드 (철제 방화문 쾅, 스팀 파열음, 형광등 퍽)
     ========================================================= */
  _playSound(type) {
    const ctx = this._ensureAudio();
    const now = ctx.currentTime;

    if (type === "steam_burst") {
      // 고압 수증기 치이이이익- 화이트 노이즈
      const dur = 2.5;
      const bufSize = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.35;

      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(2400, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + dur);

      src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      src.start(now);
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);

    if (type === "door_slam") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(24, now + 0.45);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.5);
      osc.start(now); osc.stop(now + 0.52);
    } else if (type === "bulb_pop") {
      osc.type = "square";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.09);
      osc.start(now); osc.stop(now + 0.1);
    } else {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(180, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.25);
      osc.start(now); osc.stop(now + 0.26);
    }
  }
}

window.indoorPassagePatch = new IndoorCorridorPassagePatch();
export { IndoorCorridorPassagePatch };
