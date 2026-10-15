/**
 * 〈폐교: 잊혀진 시간〉 휴대폰 심령 카메라(야간투시) & 플래시 괴물 퇴치 시스템
 * - 외부 에셋 없이 Three.js Layer 2 + Web Audio API + CanvasTexture로 동작
 * (사용자 제공 코드 — 게임 연결은 game.js 의 "심령 카메라 연결" 부분)
 */
import * as THREE from './vendor/three.module.js';

class GhostCameraSystem {
  constructor({ scene, camera, renderer, audioCtx }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.audioCtx = audioCtx;

    this.SPIRIT_LAYER = 2; // 심령 카메라를 켰을 때만 보이는 전용 Three.js 레이어 번호
    this.isActive = false;
    this.phoneBattery = 100; // 0 ~ 100 (%)
    this.batteryDrainRate = 1.8; // 카메라 켜둘 때 초당 배터리 소모량
    this.flashCost = 20; // 플래시 1회 촬영 시 배터리 소모량
    this.flashCooldown = 0; // 재충전 쿨타임 (초)
    this.maxFlashCooldown = 3.0;

    this.hiddenClues = []; // 카메라로만 보이는 단서 메쉬 배열
    this.capturedPhotos = []; // 촬영해서 휴대폰 사진첩에 저장된 단서 목록
    this.nightVisionLight = null;
    this.flashBurstLight = null;

    this._initUI();
    this._initLights();
  }

  _ensureAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === "suspended") this.audioCtx.resume();
    return this.audioCtx;
  }

  /* =========================================================
     1. 뷰파인더 DOM 오버레이 및 카메라 전용 조명 초기화
     ========================================================= */
  _initUI() {
    if (!document.getElementById("ghost-cam-overlay")) {
      const overlay = document.createElement("div");
      overlay.id = "ghost-cam-overlay";
      overlay.innerHTML = `
        <div class="cam-frame-box">
          <div class="cam-corner tl"></div>
          <div class="cam-corner tr"></div>
          <div class="cam-corner bl"></div>
          <div class="cam-corner br"></div>
        </div>
        <div class="cam-top-bar">
          <div class="cam-rec"><span class="cam-rec-dot"></span><span>REC · SPIRIT CAM [IR]</span></div>
          <div id="cam-emf-status">영적 파장: 안정 (0.1 mG)</div>
          <div id="cam-battery-txt">🔋 100%</div>
        </div>
        <div id="cam-reticle"></div>
        <div class="cam-bottom-bar">
          <div id="cam-clue-hint">맨눈에 보이지 않는 흔적을 비추세요</div>
          <div id="cam-flash-status">[클릭 / R] 플래시 촬영 (배터리 -20% · 그것 퇴치)</div>
        </div>
      `;
      document.body.appendChild(overlay);
    }

    if (!document.getElementById("ghost-cam-flash-burst")) {
      const burst = document.createElement("div");
      burst.id = "ghost-cam-flash-burst";
      document.body.appendChild(burst);
    }
  }

  _initLights() {
    if (!this.scene || !this.camera) return;

    // 야간투시 모드용 은은한 적외선 보조광 (어두운 복도 시야 확보)
    this.nightVisionLight = new THREE.PointLight(0x66ff99, 0, 14, 1.8);
    this.camera.add(this.nightVisionLight);

    // 플래시 터질 때 순간적으로 방 전체를 밝히는 고출력 조명
    this.flashBurstLight = new THREE.PointLight(0xeef6ff, 0, 26, 1.2);
    this.camera.add(this.flashBurstLight);

    if (!this.camera.parent) {
      this.scene.add(this.camera);
    }
  }

  /* =========================================================
     2. 카메라 켜기 / 끄기 토글 (단축키 C 또는 휴대폰 카메라 탭)
     ========================================================= */
  toggleCamera(notifyUI) {
    if (!this.isActive && this.phoneBattery <= 0) {
      if (notifyUI) notifyUI("휴대폰 배터리가 방전되어 카메라를 켤 수 없다!");
      return false;
    }

    this.isActive = !this.isActive;

    if (this.isActive) {
      document.body.classList.add("ghost-cam-active");
      if (this.camera && this.camera.layers) {
        this.camera.layers.enable(this.SPIRIT_LAYER); // 숨겨진 영적 레이어 가시화!
      }
      if (this.nightVisionLight) this.nightVisionLight.intensity = 1.35;
      this.playCamPowerSound(true);
      if (notifyUI) notifyUI("휴대폰 심령 카메라 ON — 숨겨진 단서 투시 및 플래시 퇴치 가능");
    } else {
      document.body.classList.remove("ghost-cam-active");
      if (this.camera && this.camera.layers) {
        this.camera.layers.disable(this.SPIRIT_LAYER); // 일반 시점에서는 다시 숨김
      }
      if (this.nightVisionLight) this.nightVisionLight.intensity = 0;
      this.playCamPowerSound(false);
    }
    return this.isActive;
  }

  /* =========================================================
     3. 맨눈엔 안 보이고 카메라로만 보이는 '심령 단서/금고 힌트' 생성기
     ========================================================= */
  createHiddenWallClue({ position, rotationY = 0, text = "금고 앞자리: 1 9", subText = "교무실 책상 밑을 보지 마", clueId = "clue_1" }) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");

    // 투명 배경 위에 형광/핏빛으로 일렁이는 손글씨 렌더링
    ctx.clearRect(0, 0, 512, 256);
    ctx.shadowColor = "#33ff88";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#b8ffd0";
    ctx.font = "bold 46px serif";
    ctx.fillText(text, 36, 110);

    ctx.font = "26px serif";
    ctx.fillStyle = "#ff5566";
    ctx.shadowColor = "#ff1133";
    ctx.fillText(subText, 40, 175);

    // 손바닥 자국 노이즈
    ctx.fillStyle = "rgba(180, 255, 210, 0.18)";
    ctx.beginPath();
    ctx.arc(420, 128, 45, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), mat);
    mesh.position.copy(position);
    mesh.rotation.y = rotationY;

    // 핵심: 일반 카메라(Layer 0)에서는 안 보이고 SPIRIT_LAYER(Layer 2)에서만 보이도록 설정!
    mesh.layers.set(this.SPIRIT_LAYER);
    this.scene.add(mesh);

    const clueObj = {
      id: clueId,
      text,
      subText,
      mesh,
      position: mesh.position,
      photographed: false
    };
    this.hiddenClues.push(clueObj);
    return clueObj;
  }

  /* =========================================================
     4. 매 프레임 업데이트 (배터리 소모, 괴물/단서 조준 감지, 플래시 감쇠)
     ========================================================= */
  update(dt, monsterObj, isPaused = false) {
    if (isPaused) return;

    // 플래시 쿨다운 감소 및 잔광 감쇠
    if (this.flashCooldown > 0) {
      this.flashCooldown = Math.max(0, this.flashCooldown - dt);
    }
    if (this.flashBurstLight && this.flashBurstLight.intensity > 0) {
      this.flashBurstLight.intensity = Math.max(0, this.flashBurstLight.intensity - dt * 18);
    }

    if (!this.isActive) return;

    // 1. 배터리 실시간 소모
    this.phoneBattery = Math.max(0, this.phoneBattery - this.batteryDrainRate * dt);
    const batEl = document.getElementById("cam-battery-txt");
    if (batEl) {
      batEl.textContent = `🔋 ${Math.ceil(this.phoneBattery)}%`;
      batEl.style.color = this.phoneBattery <= 25 ? "#ff4444" : "#8cffaa";
    }

    // 배터리 0% 도달 시 강제 종료
    if (this.phoneBattery <= 0) {
      this.toggleCamera();
      return;
    }

    // 2. 전방에 괴물('그것') 또는 숨겨진 단서가 조준되었는지 판별
    const reticle = document.getElementById("cam-reticle");
    const emfEl = document.getElementById("cam-emf-status");
    const flashEl = document.getElementById("cam-flash-status");

    let isLockedOn = false;
    let emfValue = (0.1 + Math.random() * 0.2).toFixed(1);

    // 괴물과의 거리 및 각도 계산
    if (monsterObj && monsterObj.position && this.camera) {
      const camPos = new THREE.Vector3();
      const camDir = new THREE.Vector3();
      this.camera.getWorldPosition(camPos);
      this.camera.getWorldDirection(camDir);

      const toMonster = new THREE.Vector3().subVectors(monsterObj.position, camPos);
      const dist = toMonster.length();
      toMonster.normalize();
      const dot = camDir.dot(toMonster); // 1.0에 가까울수록 정중앙 조준

      if (dist < 14) {
        emfValue = Math.min(99.9, (18 / Math.max(1, dist)) * 4.5 + Math.random() * 2).toFixed(1);
      }

      // 9.5m 이내 + 화면 중앙 시야각(dot > 0.82) 안에 괴물이 들어오면 붉은색 락온!
      if (dist <= 9.5 && dot > 0.82) {
        isLockedOn = true;
      }
    }

    // 숨겨진 단서 조준 판별
    const aimedClue = this._getAimedClue(8.0);
    if (aimedClue) {
      isLockedOn = true;
      emfValue = (12.4 + Math.random() * 1.5).toFixed(1);
    }

    if (reticle) {
      reticle.classList.toggle("target-locked", isLockedOn);
    }
    if (emfEl) {
      emfEl.textContent = isLockedOn
        ? `⚠ 영적 반응 포착! (${emfValue} mG)`
        : `영적 파장: ${emfValue} mG`;
      emfEl.style.color = isLockedOn ? "#ff3b3b" : "#8cffaa";
    }
    if (flashEl) {
      flashEl.textContent = this.flashCooldown > 0
        ? `⚡ 플래시 충전 중... (${this.flashCooldown.toFixed(1)}s)`
        : `[클릭 / R] 플래시 촬영 (배터리 -${this.flashCost}% · 제압/기록)`;
    }
  }

  /* =========================================================
     5. 고출력 카메라 플래시 터뜨리기 (괴물 스턴 퇴치 + 심령 단서 촬영)
     ========================================================= */
  triggerFlash({ monsterObj, stunMonsterCallback, notifyUI, onClueCaptured }) {
    if (!this.isActive) return false;

    if (this.flashCooldown > 0) {
      if (notifyUI) notifyUI(`카메라 플래시 충전 중입니다 (${this.flashCooldown.toFixed(1)}초)`);
      return false;
    }

    if (this.phoneBattery < this.flashCost) {
      if (notifyUI) notifyUI("배터리가 부족해 고출력 플래시를 터뜨릴 수 없다! (최소 20% 필요)");
      return false;
    }

    // 배터리 차감 및 쿨다운 시작
    this.phoneBattery = Math.max(0, this.phoneBattery - this.flashCost);
    this.flashCooldown = this.maxFlashCooldown;

    // 1. 시각적 화이트아웃 플래시 & 3D 공간 고출력 광원 폭발
    const burstEl = document.getElementById("ghost-cam-flash-burst");
    if (burstEl) {
      burstEl.classList.add("burst");
      setTimeout(() => burstEl.classList.remove("burst"), 60);
    }
    if (this.flashBurstLight) {
      this.flashBurstLight.intensity = 8.5;
    }

    // 2. 카메라 셔터 + 플래시 커패시터 방전 사운드 재생
    this.playShutterAndFlashSound();

    // 3. 전방의 괴물('그것') 적중 판정 (9.5m 이내 & 시야각 내)
    let hitMonster = false;
    if (monsterObj && monsterObj.position && this.camera) {
      const camPos = new THREE.Vector3();
      const camDir = new THREE.Vector3();
      this.camera.getWorldPosition(camPos);
      this.camera.getWorldDirection(camDir);

      const toMonster = new THREE.Vector3().subVectors(monsterObj.position, camPos);
      const dist = toMonster.length();
      toMonster.normalize();
      const dot = camDir.dot(toMonster);

      if (dist <= 9.5 && dot > 0.75) {
        hitMonster = true;
        this.playMonsterbanishScreech();
        if (typeof stunMonsterCallback === "function") {
          stunMonsterCallback(3.8); // 3.8초간 괴물 강제 스턴 및 후퇴!
        }
        if (notifyUI) {
          notifyUI("📸 [영적 제압 성공] 강렬한 플래시 빛에 '그것'이 비명을 지르며 물러난다!");
        }
      }
    }

    // 4. 전방의 숨겨진 심령 단서 촬영 판정
    const aimedClue = this._getAimedClue(8.5);
    if (aimedClue && !aimedClue.photographed) {
      aimedClue.photographed = true;
      this.capturedPhotos.push({
        id: aimedClue.id,
        title: `심령 사진 #${this.capturedPhotos.length + 1}`,
        text: aimedClue.text,
        subText: aimedClue.subText,
        time: "23:40"
      });
      if (typeof onClueCaptured === "function") {
        onClueCaptured(aimedClue);
      }
      if (notifyUI && !hitMonster) {
        notifyUI(`📸 [단서 촬영 완료] '${aimedClue.text}' 기록이 휴대폰 사진첩에 저장되었다.`);
      }
    } else if (!hitMonster && notifyUI) {
      notifyUI("📸 플래시가 어둠을 가르며 터졌다. (배터리 -20%)");
    }

    return true;
  }

  _getAimedClue(maxDist = 8.0) {
    if (!this.camera || this.hiddenClues.length === 0) return null;
    const camPos = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    this.camera.getWorldPosition(camPos);
    this.camera.getWorldDirection(camDir);

    for (const clue of this.hiddenClues) {
      const toClue = new THREE.Vector3().subVectors(clue.position, camPos);
      const dist = toClue.length();
      if (dist <= maxDist) {
        toClue.normalize();
        if (camDir.dot(toClue) > 0.85) {
          return clue;
        }
      }
    }
    return null;
  }

  /* =========================================================
     6. Web Audio API 절차적 카메라 효과음 (셔터 폭발음, 고주파 충전음, 괴물 피격음)
     ========================================================= */
  playShutterAndFlashSound() {
    const ctx = this._ensureAudio();
    const now = ctx.currentTime;

    // 1) 기계식 셔터 찰칵! (짧은 화이트 노이즈 버스트)
    const bufSize = Math.floor(ctx.sampleRate * 0.06);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(1200, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.65, now);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    // 2) 플래시 커패시터 고주파 충전음 (삐이이이- 올라가는 사인파)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1800, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(6200, now + 1.4);

    oscGain.gain.setValueAtTime(0.08, now + 0.08);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.45);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now + 0.08);
    osc.stop(now + 1.46);
  }

  playCamPowerSound(turnOn = true) {
    const ctx = this._ensureAudio();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(turnOn ? 880 : 1320, now);
    osc.frequency.exponentialRampToValueAtTime(turnOn ? 1760 : 520, now + 0.12);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.13);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playMonsterbanishScreech() {
    const ctx = this._ensureAudio();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.75);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.78);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.8);
  }
}

window.GhostCameraSystem = GhostCameraSystem;
export { GhostCameraSystem };
