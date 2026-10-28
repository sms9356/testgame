/**
 * 〈폐교: 잊혀진 시간〉 인벤토리 조합(Crafting) 및 생존 도구 시스템
 * - 경보 함정, 쇼트 폭탄, 응급 처치 키트 제작 및 필드 배치/투척 로직
 * (사용자 제공 코드 — 게임 연결은 game.js 의 "조합 연결" 부분. 수정 1곳: craft() 알림의 recipe.name → recipe.resultName)
 */
import * as THREE from './vendor/three.module.js';

class CraftingSystem {
  constructor(scene, playerRef, audioCtx) {
    this.scene = scene;
    this.playerRef = playerRef;
    this.audioCtx = audioCtx;
    
    // 플레이어 인벤토리 상태 참조 (기존 게임의 인벤토리 객체와 동기화)
    this.inventory = {
      items: {
        can: 0,       // 빈 캔
        tape: 0,      // 절연 테이프
        battery: 0,   // 건전지
        bandage: 1,   // 응급 밴드
        pill: 0,      // 보건실 진정제
        // 조합 결과물 슬롯
        trap_can: 0,
        short_bomb: 0,
        med_kit: 0
      }
    };

    // 조합 레시피 (경보 함정 · 쇼트 폭탄은 막을 '괴물'이 없어져 뺐다)
    this.recipes = [
      {
        resultId: "med_kit",
        resultName: "응급 처치 키트",
        ingredients: { bandage: 1, pill: 1 },
        desc: "즉시 체력 100% 회복, 공포 0화, 25초간 스태미나 무한 질주."
      }
    ];

    this.activeTraps = []; // 바닥에 설치된 경보 함정 목록
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
     1. 아이템 조합 실행 로직
     ========================================================= */
  canCraft(recipe) {
    for (const [itemId, reqQty] of Object.entries(recipe.ingredients)) {
      if ((this.inventory.items[itemId] || 0) < reqQty) return false;
    }
    return true;
  }

  craft(recipeId, notifyUI) {
    const recipe = this.recipes.find(r => r.resultId === recipeId);
    if (!recipe) return false;

    if (!this.canCraft(recipe)) {
      if (notifyUI) notifyUI("필요한 재료가 부족합니다.");
      return false;
    }

    // 재료 소모
    for (const [itemId, reqQty] of Object.entries(recipe.ingredients)) {
      this.inventory.items[itemId] -= reqQty;
    }

    // 결과물 지급
    this.inventory.items[recipe.resultId] = (this.inventory.items[recipe.resultId] || 0) + 1;
    this.playCraftSound();
    
    if (notifyUI) notifyUI(`[조합 성공] '${recipe.resultName}'을(를) 제작했습니다!`);
    return true;
  }

  /* =========================================================
     2. 도구 사용 1: 경보 함정 바닥에 설치하기
     ========================================================= */
  deployTrap(notifyUI) {
    if ((this.inventory.items.trap_can || 0) <= 0) {
      if (notifyUI) notifyUI("인벤토리에 설치할 '경보 함정'이 없습니다.");
      return false;
    }

    this.inventory.items.trap_can--;

    // 플레이어 발밑 바닥에 함정 메쉬 생성
    const pos = this.playerRef.position.clone();
    pos.y = 0.05;

    const trapGroup = new THREE.Group();
    trapGroup.position.copy(pos);

    const baseGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.04, 12);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    trapGroup.add(baseMesh);

    this.scene.add(trapGroup);
    this.activeTraps.push({ group: trapGroup, position: pos, triggered: false });

    if (notifyUI) notifyUI("바닥에 경보 함정을 설치했습니다. 괴물이 밟으면 작동합니다.");
    return true;
  }

  /* =========================================================
     3. 도구 사용 2: 쇼트 폭탄 전방 투척하기 (G키 연동)
     =========================================================  */
  throwShortBomb(cameraDir, notifyUI, alertMonsterFn) {
    if ((this.inventory.items.short_bomb || 0) <= 0) {
      if (notifyUI) notifyUI("투척할 '쇼트 폭탄'이 없습니다.");
      return false;
    }

    this.inventory.items.short_bomb--;
    this.playThrowSound();

    if (notifyUI) notifyUI("쇼트 폭탄을 던졌습니다! 잠시 후 푸른 스파크와 함께 터집니다.");

    // 1.2초 뒤 착탄 지점에서 폭발 및 스파크 발생
    setTimeout(() => {
      const impactPos = this.playerRef.position.clone().add(cameraDir.clone().multiplyScalar(4.5));
      impactPos.y = 0.2;

      this.playSparkExplosionSound();

      // 괴물 어그로 및 4.5초 스턴 유발
      if (typeof alertMonsterFn === "function") {
        alertMonsterFn(impactPos, 28, 4.5); // 강력한 소음 + 4.5초 마비
      }
    }, 1200);

    return true;
  }

  /* =========================================================
     4. 도구 사용 3: 응급 처치 키트 사용 (체력 회복 + 공포 0 + 스태미나 무한)
     ========================================================= */
  useMedKit(playerState, notifyUI) {
    if ((this.inventory.items.med_kit || 0) <= 0) {
      if (notifyUI) notifyUI("보유 중인 '응급 처치 키트'가 없습니다.");
      return false;
    }

    this.inventory.items.med_kit--;

    // 효과 적용
    if (playerState) {
      playerState.hp = 100;
      playerState.fear = 0;
      playerState.staminaInfiniteTimer = 25.0; // 25초간 스태미나 무한
    }

    this.playHealSound();
    if (notifyUI) notifyUI("응급 처치 키트를 사용했다! HP가 회복되고, 공포가 사라지며 25초간 지치지 않는다.");
    return true;
  }

  /* =========================================================
     매 프레임 업데이트 (함정 밟음 감지)
     ========================================================= */
  update(monsterPos, notifyUI, alertMonsterFn) {
    if (!monsterPos || this.activeTraps.length === 0) return;

    for (let i = this.activeTraps.length - 1; i >= 0; i--) {
      const trap = this.activeTraps[i];
      if (trap.triggered) continue;

      const dist = trap.position.distanceTo(monsterPos);
      if (dist <= 2.2) {
        // 괴물이 함정을 밟음!
        trap.triggered = true;
        this.playTrapTriggerSound();

        if (notifyUI) notifyUI("⚠ [경보 함정 작동] 괴물이 함정을 밟았습니다! 위치가 노출되었습니다.");
        if (typeof alertMonsterFn === "function") {
          alertMonsterFn(trap.position, 35, 0); // 큰 소음으로 괴물 어그로 고정
        }

        // 함정 메쉬 제거
        this.scene.remove(trap.group);
        this.activeTraps.splice(i, 1);
      }
    }
  }

  /* =========================================================
     Web Audio API 사운드 합성
     ========================================================= */
  playCraftSound() {
    const ctx = this._ensureAudio();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playThrowSound() { /* 캔 던지는 소리 생략 가능 */ }
  playSparkExplosionSound() { /* 쇼트 스파크음 */ }
  playHealSound() { /* 회복음 */ }
  playTrapTriggerSound() { /* 경보음 */ }
}

window.CraftingSystem = CraftingSystem;
export { CraftingSystem };
