/**
 * 〈폐교: 잊혀진 시간〉 학교 배전반(두꺼비집) 복구 & 차임벨 방송 은폐 시스템
 * - 배전반 퍼즐 미니게임, 비상등 안전 구역, 차임벨 발소리 은폐 기믹
 * (사용자 제공 코드 — 게임 연결은 game.js 의 "배전반 · 차임벨 연결" 부분)
 */
import * as THREE from './vendor/three.module.js';

class SchoolPowerEventSystem {
  constructor(scene, playerRef, audioCtx) {
    this.scene = scene;
    this.playerRef = playerRef;
    this.audioCtx = audioCtx;

    this.isPowerRestored = false; // 배전반 전원 복구 여부
    this.powerTimer = 0;          // 전원 유지 시간 (3분 30초)
    this.maxPowerTime = 210;

    this.isChimeActive = false;   // 학교 차임벨 방송 울리는 중 여부
    this.chimeTimer = 160;        // 다음 차임벨까지 대기 시간 (약 2분 40초)
    this.chimeDuration = 15;      // 방송 지속 시간 (15초)

    this.powerBoxes = [];         // 복도에 배치된 배전반 오브젝트 배열
    this.activeEmergencyLights = []; // 켜진 비상등 조명 배열
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
     1. 복도 벽면에 배전반(두꺼비집) 생성 및 상호작용 등록
     ========================================================= */
  createPowerBox(position, rotationY = 0, boxId = "power_box_1") {
    const boxGroup = new THREE.Group();
    boxGroup.position.copy(position);
    boxGroup.rotation.y = rotationY;

    // 낡은 철제 배전반 함체
    const boxMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.62, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x3d4245, roughness: 0.6, metalness: 0.7 })
    );
    boxMesh.position.set(0, 1.25, 0);

    // 경고 문구 및 전원 LED
    const ledMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }) // 평소엔 꺼진 빨간불
    );
    ledMesh.position.set(0.12, 1.42, 0.08);

    boxGroup.add(boxMesh, ledMesh);
    this.scene.add(boxGroup);

    // E키 상호작용 데이터
    const powerBoxObj = {
      id: boxId,
      type: "school_power_box",
      mesh: boxMesh,
      led: ledMesh,
      isRestored: false,
      promptText: "[E] 배전반(두꺼비집) 열기 — 전력 복구 퍼즐 조작",
      onInteract: (playerState, notifyUI, openPuzzleModalFn) => {
        if (powerBoxObj.isRestored) {
          if (notifyUI) notifyUI("배전반 전력은 이미 정상 공급 중이다.");
          return;
        }
        // 배전반 스위치 연결 미니게임 팝업창 호출
        if (typeof openPuzzleModalFn === "function") {
          openPuzzleModalFn(powerBoxObj);
        } else {
          // 간이 즉시 복구 처리
          this.restorePower(notifyUI);
          powerBoxObj.isRestored = true;
          ledMesh.material.color.setHex(0x22ff44); // 초록불로 변경
        }
      }
    };

    boxMesh.userData.interactable = powerBoxObj;
    this.powerBoxes.push(powerBoxObj);
    return boxGroup;
  }

  /* =========================================================
     2. 전력 복구 실행 (해당 복도 비상등 켜짐 + 공포 게이지 감소 안전 구역 활성화)
     ========================================================= */
  restorePower(notifyUI) {
    this.isPowerRestored = true;
    this.powerTimer = this.maxPowerTime;
    this.playPowerOnSound();

    if (notifyUI) {
      notifyUI("⚡ [전력 복구 성공] 배전반 스위치가 올라갔습니다! 복도 비상등이 켜지며 공포가 진정됩니다.");
    }
  }

  /* =========================================================
     3. 학교 차임벨(종소리) 방송 이벤트 실행 (발소리 은폐 기믹)
     ========================================================= */
  triggerSchoolChime(notifyUI) {
    this.isChimeActive = true;
    this.chimeDuration = 15.0; // 15초간 유지
    this.playCreepySchoolChimeSound();

    if (notifyUI) {
      notifyUI("🔊 [학교 방송 시스템] 지직거리는 소음과 함께 기괴한 차임벨이 울려 퍼집니다! (15초간 달리는 소음 은폐)");
    }
  }

  /* =========================================================
     매 프레임 업데이트 (타이머 관리 및 안전 구역 공포 감소 판정)
     ========================================================= */
  update(dt, playerState, notifyUI) {
    // 1. 차임벨 타이머 관리
    this.chimeTimer -= dt;
    if (this.chimeTimer <= 0) {
      this.triggerSchoolChime(notifyUI);
      this.chimeTimer = 190 + Math.random() * 50; // 약 3분 ~ 3분 40초 주기
    }

    if (this.isChimeActive) {
      this.chimeDuration -= dt;
      if (this.chimeDuration <= 0) {
        this.isChimeActive = false;
      }
    }

    // 2. 배전반 전력 유지 타이머 관리
    if (this.isPowerRestored) {
      this.powerTimer -= dt;

      // 비상등 아래(배전반 반경 6m 이내)에 있으면 공포 수치 서서히 감소
      let nearSafeZone = false;
      for (const box of this.powerBoxes) {
        if (box.isRestored && this.playerRef && this.playerRef.position.distanceTo(box.mesh.parent.position) <= 6.0) {
          nearSafeZone = true;
          break;
        }
      }

      if (nearSafeZone && playerState && playerState.fear > 0) {
        playerState.fear = Math.max(0, playerState.fear - 1.2 * dt); // 초당 공포 -1.2 회복
      }

      if (this.powerTimer <= 0) {
        this.isPowerRestored = false;
        this.powerBoxes.forEach(b => {
          b.isRestored = false;
          b.led.material.color.setHex(0xff2222);
        });
        if (notifyUI) notifyUI("⚠ 배전반 과부하로 인해 비상 전력이 다시 차단되었습니다.");
      }
    }
  }

  /* =========================================================
     Web Audio API 절차적 사운드 합성 (배전반 스위치음, 차임벨 종소리)
     ========================================================= */
  playPowerOnSound() {
    const ctx = this._ensureAudio();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.setValueAtTime(220, now + 0.1);
    osc.frequency.setValueAtTime(440, now + 0.2);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  playCreepySchoolChimeSound() {
    const ctx = this._ensureAudio();
    const now = ctx.currentTime;
    // 늘어진 기괴한 학교 차임벨 4음계 (미-레-도-솔)
    const notes = [659.25, 587.33, 523.25, 392.00];
    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.45;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      // 공포감을 주기 위해 주파수를 미세하게 꺾어줌 (detune)
      osc.frequency.setValueAtTime(freq * 0.96, startTime);
      osc.frequency.linearRampToValueAtTime(freq * 0.92, startTime + 0.8);

      gain.gain.setValueAtTime(0.01, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 1.25);
    });
  }
}

window.SchoolPowerEventSystem = SchoolPowerEventSystem;
export { SchoolPowerEventSystem };
