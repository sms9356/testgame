/**
 * [Module 2] 남/녀 화장실 디테일 및 세면대/변기 상호작용 매니저
 * (사용자 제공 코드 — 게임 연결은 game.js 의 "화장실 연결" 부분)
 */
import * as THREE from './vendor/three.module.js';

class RestroomSystem {
  constructor(scene, audioCtx) {
    this.scene = scene;
    this.audioCtx = audioCtx;
    this.interactables = [];
  }

  _ensureAudio() {
    if (!this.audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AC();
    }
    if (this.audioCtx.state === "suspended") this.audioCtx.resume();
    return this.audioCtx;
  }

  createSinkUnit(position, rotationY = 0, sinkId = "sink_1") {
    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.y = rotationY;

    const basin = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.22, 0.48),
      new THREE.MeshStandardMaterial({ color: 0xd8dcd6, roughness: 0.2 })
    );
    basin.position.set(0, 0.82, 0);
    group.add(basin);
    this.scene.add(group);

    const sinkObj = {
      id: sinkId,
      type: "restroom_sink",
      mesh: basin,
      group,
      promptText: "[E] 세면대 수도꼭지 틀기 (정신 차리기 / 물소리로 유인)",
      onInteract: (playerState, notifyUI, alertMonsterFn) => {
        const isBlood = Math.random() < 0.25;
        if (isBlood) {
          if (playerState) playerState.fear = Math.min(100, (playerState.fear || 0) + 18);
          if (notifyUI) notifyUI("수도꼭지에서 검붉은 핏물이 쏟아진다! (공포 증가)");
        } else {
          if (playerState) playerState.fear = Math.max(0, (playerState.fear || 0) - 25);
          if (notifyUI) notifyUI("시원한 수돗물로 세수를 했다. (공포 -25%)");
        }
        if (typeof alertMonsterFn === "function") alertMonsterFn(group.position, 14);
      }
    };
    basin.userData.interactable = sinkObj;
    this.interactables.push(sinkObj);
    return group;
  }
}
window.RestroomSystem = RestroomSystem;
export { RestroomSystem };
