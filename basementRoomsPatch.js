/**
 * [Module 9] 지하 전기실 · 보일러실 디테일 보강 패치
 * (사용자 제공 코드 — 게임 연결은 game.js 의 "지하 전기실 · 보일러실 연결" 부분)
 */
import * as THREE from './vendor/three.module.js';
/**
 * ============================================================================
 * 〈폐교: 잊혀진 시간〉 지하 전기실 & 보일러실 텍스처 및 디테일 보강 패치
 * - 전기실 고압 분전반, 전기 스파크 이펙트, 보일러실 녹슨 대형 보일러 및 배관 텍스처
 * ============================================================================
 */
class BasementRoomsPatch {
  constructor() {
    this.scene = null;
    this.audioCtx = null;
    this.electricalSparks = [];
    this.boilers = [];
  }

  init({ scene, audioCtx } = {}) {
    this.scene = scene || window.scene;
    this.audioCtx = audioCtx || window.audioCtx;
    this.textures = this._createBasementTextures();
    console.log("[BasementPatch] 지하 전기실 및 보일러실 디테일 보강 패치 로드 완료");
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
     1. 지하 구역 전용 고급 PBR 텍스처 (콘크리트 벽, 철제 분전반, 녹슨 보일러 철판)
     ========================================================= */
  _createBasementTextures() {
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
      // ① 지하 콘크리트 벽 (습기로 얼룩진 거친 시멘트 + 곰팡이)
      basementWall: makeTex((ctx, s) => {
        ctx.fillStyle = "#2d3336"; ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 3000; i++) {
          ctx.fillStyle = i % 2 === 0 ? "#1b2022" : "#3e474b";
          ctx.fillRect(Math.random() * s, Math.random() * s, 3, 3);
        }
        // 물때와 이끼 자국
        ctx.fillStyle = "rgba(15, 25, 20, 0.4)";
        for (let i = 0; i < 15; i++) {
          ctx.fillRect(Math.random() * s, 0, 25 + Math.random() * 40, s);
        }
      }, 4, 4),

      // ② 고압 분전반 판넬 철판 텍스처 (⚡ 고압위험 경고 스텐실)
      electricalPanel: makeTex((ctx, s) => {
        ctx.fillStyle = "#384145"; ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = "#1a1f21"; ctx.lineWidth = 12;
        ctx.strokeRect(10, 10, s - 20, s - 20);

        // 노란색 ⚡ 고압 위험 마크
        ctx.fillStyle = "#d4af37";
        ctx.beginPath();
        ctx.moveTo(s / 2, 80); ctx.lineTo(s / 2 - 50, 230); ctx.lineTo(s / 2 + 15, 230);
        ctx.lineTo(s / 2 - 15, 360); ctx.lineTo(s / 2 + 60, 210); ctx.lineTo(s / 2, 210);
        ctx.closePath();
        ctx.fill();
      }, 1, 1),

      // ③ 보일러실 녹슨 철제 보일러 몸체 텍스처
      rustedBoiler: makeTex((ctx, s) => {
        ctx.fillStyle = "#5c3322"; ctx.fillRect(0, 0, s, s);
        // 녹슨 얼룩과 용접선
        for (let i = 0; i < 60; i++) {
          ctx.fillStyle = Math.random() < 0.5 ? "rgba(35, 18, 10, 0.6)" : "rgba(135, 65, 30, 0.5)";
          ctx.beginPath();
          ctx.arc(Math.random() * s, Math.random() * s, 20 + Math.random() * 60, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = "#1a0d07"; ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(0, s * 0.3); ctx.lineTo(s, s * 0.3); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, s * 0.7); ctx.lineTo(s, s * 0.7); ctx.stroke();
      }, 2, 2)
    };
  }

  /* =========================================================
     2. 지하 전기실 구축 (고압 분전반 + 주기적 파란색 전기 스파크)
     ========================================================= */
  buildElectricalRoom(centerPos, rotationY = 0) {
    if (!this.scene) return;
    const group = new THREE.Group();
    group.position.copy(centerPos);
    group.rotation.y = rotationY;

    // 대형 고압 분전반 판넬 2개 나란히 배치
    const panelMat = new THREE.MeshStandardMaterial({
      map: this.textures.electricalPanel,
      roughness: 0.4,
      metalness: 0.75
    });

    [-0.9, 0.9].forEach((xOffset) => {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.45), panelMat);
      panel.position.set(xOffset, 1.05, -2.5);
      group.add(panel);

      // 전기 스파크를 위한 포인트 라이트 (평소엔 꺼짐, 스파크 튈 때 번쩍임)
      const sparkLight = new THREE.PointLight(0x3388ff, 0, 4.5);
      sparkLight.position.set(xOffset, 1.4, -2.2);
      group.add(sparkLight);
      this.electricalSparks.push({ light: sparkLight, timer: Math.random() * 3 });
    });

    this.scene.add(group);
    return group;
  }

  /* =========================================================
     3. 지하 보일러실 구축 (거대한 원통형 보일러 + 녹슨 배관 + 밸브)
     ========================================================= */
  buildBoilerRoom(centerPos, rotationY = 0) {
    if (!this.scene) return;
    const group = new THREE.Group();
    group.position.copy(centerPos);
    group.rotation.y = rotationY;

    const boilerMat = new THREE.MeshStandardMaterial({
      map: this.textures.rustedBoiler,
      roughness: 0.7,
      metalness: 0.5
    });

    // 거대한 원통형 대형 보일러 본체
    const boilerBody = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 2.6, 24), boilerMat);
    boilerBody.rotation.z = Math.PI / 2;
    boilerBody.position.set(0, 1.3, 0);

    // 보일러 앞쪽 원형 철제 해치 및 붉은색 밸브 핸들
    const hatch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 0.18, 16),
      new THREE.MeshStandardMaterial({ color: 0x3d4448, metalness: 0.8 })
    );
    hatch.rotation.y = Math.PI / 2;
    hatch.position.set(1.36, 1.3, 0);

    const redValve = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.035, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xcc2929, roughness: 0.4 })
    );
    redValve.rotation.y = Math.PI / 2;
    redValve.position.set(1.48, 1.3, 0);

    group.add(boilerBody, hatch, redValve);
    this.scene.add(group);
    this.boilers.push(group);
    return group;
  }

  /* =========================================================
     4. 매 프레임 업데이트 (전기실 파란색 스파크 번쩍임 및 방전음)
     ========================================================= */
  update(dt = 0.016) {
    for (const sp of this.electricalSparks) {
      sp.timer -= dt;
      if (sp.timer <= 0) {
        sp.timer = 2.0 + Math.random() * 4.5;
        sp.light.intensity = 6.5; // 번쩍!
        this._playSparkSound();
        setTimeout(() => {
          if (sp.light) sp.light.intensity = 0;
        }, 90);
      }
    }
  }

  _playSparkSound() {
    const ctx = this._ensureAudio();
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(350, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.09);

    osc.start(now); osc.stop(now + 0.1);
  }
}

window.basementRoomsPatch = new BasementRoomsPatch();
export { BasementRoomsPatch };
