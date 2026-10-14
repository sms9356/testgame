/**
 * 폐교: 잊혀진 시간 — GLB NPC + 캐릭터 초상화 연결 모듈
 * Three.js, GLTFLoader는 현재 게임(game.js)의 기존 객체를 전달받는다.
 * GLB를 아직 만들지 않았거나 로딩에 실패해도 기존 절차적 캐릭터를 그대로 보존한다.
 * (사용자 제공 코드팩 Haegyo_Guard_Mina_Character_CodePack — 초상화 패널만 HUD 와 겹치지 않게 왼쪽으로 옮김)
 */
export function createNPCVisuals({ THREE, GLTFLoader }) {
  const loader = new GLTFLoader();
  const mixers = new Map();
  const portraitSrc = {
    guard: 'assets/ui/npc_guard.webp',
    mina: 'assets/ui/npc_mina.webp',
  };
  const pending = new Map();
  let panel = null;
  let timeout = 0;

  // holder = 이미 존재하는 경비원/민아 그룹. 그룹의 위치·회전·가시성과
  // 기존 상호작용 및 저장 로직은 손대지 않고 내부 외형만 교체한다.
  async function load(id, holder, options = {}) {
    if (!holder || !holder.isObject3D) throw new TypeError(`${id}: 유효한 Three.js 그룹이 필요합니다`);
    if (pending.has(holder)) return pending.get(holder);

    const url = options.url || `assets/characters/${id}.glb`;
    const targetHeight = Number(options.height) || (id === 'mina' ? .95 : 1.75);
    const yaw = ((Number(options.yawDegrees) || 0) * Math.PI) / 180;
    const originalChildren = [...holder.children];

    const task = loader.loadAsync(url).then(gltf => {
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const height = box.max.y - box.min.y;
      if (!Number.isFinite(height) || height <= .01) {
        throw new Error('GLB 모델에 유효한 메시와 높이가 없습니다');
      }

      // GLB 기본 단위를 m로 정규화하고 발 위치를 y=0에 맞춘다.
      model.scale.multiplyScalar(targetHeight / height);
      model.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(model);
      model.position.x -= (b.min.x + b.max.x) / 2;
      model.position.y -= b.min.y;
      model.position.z -= (b.min.z + b.max.z) / 2;

      const pivot = new THREE.Group();
      pivot.name = `${id}_VISUAL`;
      pivot.rotation.y = yaw;
      pivot.position.y = Number(options.yOffset) || 0;
      pivot.add(model);

      model.traverse(obj => {
        if (!obj.isMesh && !obj.isSkinnedMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false; // 스킨 애니메이션 절단 방지 (필요 시 성능 확인 후 변경)
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.filter(Boolean).forEach(mat => {
          if (mat.isMeshStandardMaterial && mat.roughness < .14) mat.roughness = .14;
        });
      });

      const clips = gltf.animations || [];
      if (clips.length) {
        const mixer = new THREE.AnimationMixer(model);
        const wanted = (options.clipNames ||
          (id === 'mina' ? ['sitting', 'sit', 'idle'] : ['idle', 'breathe', 'stand']))
          .map(s => s.toLowerCase());
        const clip = clips.find(c => wanted.some(w => c.name.toLowerCase().includes(w))) || clips[0];
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat);
        action.play();
        mixers.set(holder, mixer);
        console.info(`[NPC] ${id}: animation=${clip.name}`);
      } else {
        console.warn(`[NPC] ${id}: GLB에 애니메이션이 없습니다. T-Pose 여부를 확인하세요.`);
      }

      // 모든 검증과 초기화를 끝내고 나서만 기존 모델을 숨긴다.
      originalChildren.forEach(child => { child.visible = false; });
      holder.add(pivot);
      holder.userData.characterModel = pivot;
      console.info(`[NPC] ${id}: 3D 모델 연결 성공 (${url})`);
      return { ok: true, id, url, clips: clips.length };
    }).catch(err => {
      // 실제 GLB를 만들기 전엔 404가 날 수 있다. 플레이는 그대로 진행된다.
      originalChildren.forEach(child => { child.visible = true; });
      console.info(`[NPC] ${id}: GLB 파일 미사용, 기존 모델 유지. ${err.message}`);
      return { ok: false, id, url, error: String(err.message) };
    });
    pending.set(holder, task);
    return task;
  }

  function ensurePanel() {
    if (panel) return panel;
    const css = document.createElement('style');
    css.textContent = `
      #npc-portrait-panel{position:fixed;z-index:100;left:24px;top:20px;width:176px;
        background:rgba(10,13,18,.94);color:#f0e9e1;border:1px solid #7d8291;
        box-shadow:0 10px 30px #000a;padding:7px;border-radius:5px;
        font:13px/1.5 system-ui,sans-serif;pointer-events:none;
        opacity:0;transform:translateX(-12px);transition:opacity .25s,transform .25s}
      #npc-portrait-panel.open{opacity:1;transform:translateX(0)}
      #npc-portrait-panel img{display:block;width:100%;aspect-ratio:3/4;
        object-fit:cover;object-position:center 20%;border-radius:2px}
      #npc-portrait-panel .npc-name{padding:7px 3px 1px;letter-spacing:.09em}
      @media(max-width:700px){#npc-portrait-panel{left:8px;top:8px;width:116px}}
      #objP{transition:opacity .25s} body.npc-portrait #objP{opacity:0}
    `;
    document.head.appendChild(css);
    panel = document.createElement('aside');
    panel.id = 'npc-portrait-panel';
    panel.setAttribute('aria-label', 'NPC 캐릭터 초상화');
    panel.innerHTML = `<img alt="NPC 초상화"><div class="npc-name"></div>`;
    document.body.appendChild(panel);
    return panel;
  }

  function portrait(id, label, durationMs = 4200) {
    if (!portraitSrc[id]) return;
    const p = ensurePanel();
    const img = p.querySelector('img');
    img.src = portraitSrc[id];
    img.alt = `${label} 초상화`;
    img.onerror = () => { p.classList.remove('open'); document.body.classList.remove('npc-portrait'); };
    p.querySelector('.npc-name').textContent = label;
    window.clearTimeout(timeout);
    // reflow to allow transition when swapping characters
    p.classList.add('open'); document.body.classList.add('npc-portrait');   // 게임 목표 패널(#objP) 자리에 잠시 표시
    timeout = window.setTimeout(() => { p.classList.remove('open'); document.body.classList.remove('npc-portrait'); }, Math.max(800, durationMs));
  }

  function update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    mixers.forEach((m, holder) => { if (holder.visible) m.update(Math.min(.067, dt)); });
  }

  return { load, portrait, update };
}
