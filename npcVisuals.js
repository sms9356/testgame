/**
 * 폐교: 잊혀진 시간 — GLB NPC + 캐릭터 초상화 연결 모듈
 * Three.js, GLTFLoader는 현재 게임(game.js)의 기존 객체를 전달받는다.
 * GLB를 아직 만들지 않았거나 로딩에 실패해도 기존 절차적 캐릭터를 그대로 보존한다.
 * (사용자 제공 코드팩 Haegyo_Guard_Mina_Character_CodePack — 초상화 패널만 HUD 와 겹치지 않게 왼쪽으로 옮김)
 */
export function createNPCVisuals({ THREE, GLTFLoader, prepare }) {
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

    const task = loader.loadAsync(url).then(async gltf => {
      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const height = box.max.y - box.min.y;
      if (!Number.isFinite(height) || height <= .01) {
        throw new Error('GLB 모델에 유효한 메시와 높이가 없습니다');
      }

      // GLB 기본 단위를 m로 정규화하고 발 위치를 y=0에 맞춘다.
      // native: 이미 실제 미터 크기로 만든 모델(모자 · 소품 포함 높이)이면 크기를 바꾸지 않는다
      if (!options.native) model.scale.multiplyScalar(targetHeight / height);
      model.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(model);
      model.position.x -= (b.min.x + b.max.x) / 2;
      model.position.y -= b.min.y;
      model.position.z -= (b.min.z + b.max.z) / 2;

      const pivot = new THREE.Group();
      pivot.name = `${id}_VISUAL`;
      pivot.rotation.y = yaw;
      pivot.position.y = Number(options.yOffset) || 0;
      if (Array.isArray(options.offset)) { pivot.position.x += options.offset[0] || 0; pivot.position.y += options.offset[1] || 0; pivot.position.z += options.offset[2] || 0; }
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
        // 원하는 이름 순서대로 고른다 (예: 'idle' 이 'GuardStance'(stand 포함)보다 먼저)
        let clip = null;
        for (const w of wanted) { clip = clips.find(c => c.name.toLowerCase() === w) || clips.find(c => c.name.toLowerCase().includes(w)); if (clip) break; }
        clip = clip || clips[0];
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat);
        action.play();
        mixers.set(holder, mixer); holder.userData.npcClips = clips; holder.userData.npcAction = action;
        console.info(`[NPC] ${id}: animation=${clip.name}`);
      } else {
        console.warn(`[NPC] ${id}: GLB에 애니메이션이 없습니다. T-Pose 여부를 확인하세요.`);
      }

      // 화면에 넣기 전에 텍스처 업로드 · 셰이더 컴파일을 미리 (넣는 순간 멈칫하지 않도록)
      if (prepare) { try { await prepare(pivot); } catch (e) { /* 준비 실패해도 그대로 붙인다 */ } }
      // 모든 검증과 초기화를 끝내고 나서만 기존 모델을 숨긴다.
      originalChildren.forEach(child => { child.visible = false; });
      holder.add(pivot);
      holder.userData.characterModel = pivot;
      const bl = []; model.traverse(o => { if (o.morphTargetDictionary && o.morphTargetDictionary.Blink != null) bl.push([o, o.morphTargetDictionary.Blink]); });
      if (bl.length) blinkers.push({ holder, meshes: bl, t: 1 + Math.random() * 3 });
      if (options.onLoad) { try { options.onLoad(pivot); } catch (e) { console.warn('[NPC] onLoad', e); } }
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

  // 표정 모프(Blink 등)가 있으면 가끔 눈을 깜빡인다
  const blinkers = [];
  function update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    mixers.forEach((m, holder) => { if (holder.visible) m.update(Math.min(.067, dt)); });
    for (const b of blinkers) {
      if (b.holder.userData.noBlink) continue;
      b.t -= dt; if (b.t < -.16) b.t = 2.5 + Math.random() * 3.5;
      const v = b.t < 0 ? Math.sin((-b.t / .16) * Math.PI) : 0;
      b.meshes.forEach(([o, i]) => { o.morphTargetInfluences[i] = v; });
    }
  }
  function setExpression(holder, name, v = 1) {
    const m = holder && holder.userData.characterModel; if (!m) return false; let hit = false;
    m.traverse(o => { if (o.morphTargetDictionary && o.morphTargetDictionary[name] != null) { o.morphTargetInfluences[o.morphTargetDictionary[name]] = v; hit = true; } });
    return hit;
  }

  // 동작 바꾸기: 이름(대소문자 무시)으로 찾아 fade 초 동안 섞는다. once=true 면 한 번만 재생하고 마지막 자세에 멈춘 뒤 Promise 가 끝난다
  function play(holder, name, { once = false, fade = .35, speed = 1 } = {}) {
    const mixer = mixers.get(holder), clips = holder && holder.userData.npcClips; if (!mixer || !clips) return Promise.resolve(false);
    const clip = clips.find(c => c.name.toLowerCase() === String(name).toLowerCase()); if (!clip) return Promise.resolve(false);
    const prev = holder.userData.npcAction, act = mixer.clipAction(clip);
    act.reset(); act.timeScale = speed; act.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity); act.clampWhenFinished = once; act.play();
    if (prev && prev !== act) prev.crossFadeTo(act, fade, false);
    holder.userData.npcAction = act;
    if (!once) return Promise.resolve(true);
    return new Promise(res => { const h = e => { if (e.action === act) { mixer.removeEventListener('finished', h); res(true); } }; mixer.addEventListener('finished', h); });
  }
  const has = holder => !!(holder && holder.userData.characterModel);
  return { load, portrait, update, setExpression, play, has };
}
