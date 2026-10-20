// 폐교: 잊혀진 시간 — 고화질 PBR 캐릭터 셰이딩 + 생체역학(Biomechanical) 본 애니메이션 & 시선 추적 IK 엔진 (v142)
export function createNPCVisuals({ THREE, GLTFLoader, prepare }) {
  const loader = new GLTFLoader();
  const mixers = new Map();
  const rigs = new Map();
  const portraitSrc = {
    guard: 'assets/ui/npc_guard.webp',
    mina: 'assets/ui/npc_mina.webp',
  };
  const pending = new Map();
  let panel = null;
  let timeout = 0;

  let detailMaps = null;
  function getDetailMaps() {
    if (detailMaps) return detailMaps;
    const mkTex = (size, rep, drawFn) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = size;
      const g = cv.getContext('2d');
      drawFn(g, size);
      const t = new THREE.CanvasTexture(cv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rep, rep);
      t.anisotropy = 16;
      return t;
    };
    const skinBump = mkTex(256, 6, (g, N) => {
      g.fillStyle = '#808080'; g.fillRect(0, 0, N, N);
      for (let i = 0; i < 4200; i++) {
        const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * N;
        const y = (Math.sin(i * 78.233) * 43758.5453 % 1 + 1) % 1 * N;
        g.fillStyle = i % 3 === 0 ? 'rgba(60,55,55,0.22)' : 'rgba(205,200,200,0.16)';
        g.fillRect(x, y, 1.5, 1.5);
      }
    });
    const fabricBump = mkTex(256, 10, (g, N) => {
      g.fillStyle = '#808080'; g.fillRect(0, 0, N, N);
      g.strokeStyle = 'rgba(220,220,220,0.28)'; g.lineWidth = 1.2;
      for (let i = -N; i < N * 2; i += 4) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i + N, N); g.stroke();
      }
      g.strokeStyle = 'rgba(40,40,40,0.24)';
      for (let y = 0; y < N; y += 3) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(N, y); g.stroke();
      }
    });
    const leatherBump = mkTex(256, 7, (g, N) => {
      g.fillStyle = '#7c7c7c'; g.fillRect(0, 0, N, N);
      for (let i = 0; i < 2600; i++) {
        const x = (i * 73) % N, y = ((i * 137) + ((i / 17) | 0) * 29) % N;
        g.fillStyle = i % 2 ? 'rgba(215,215,215,0.22)' : 'rgba(35,35,35,0.25)';
        g.beginPath(); g.arc(x, y, 1.8, 0, Math.PI * 2); g.fill();
      }
    });
    const hairBump = mkTex(256, 5, (g, N) => {
      g.fillStyle = '#808080'; g.fillRect(0, 0, N, N);
      for (let x = 0; x < N; x += 2) {
        g.fillStyle = (x % 4 === 0) ? 'rgba(225,220,215,0.32)' : 'rgba(35,30,28,0.30)';
        g.fillRect(x, 0, 1, N);
      }
    });
    detailMaps = { skinBump, fabricBump, leatherBump, hairBump };
    return detailMaps;
  }

  function sharpenCharacterTexture(tex, kind = 'generic') {
    if (!tex || tex.userData?.sharpened) return;
    tex.anisotropy = 16;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    const img = tex.image;
    if (img && img.width && img.height && typeof document !== 'undefined') {
      try {
        const w = img.width, h = img.height;
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.filter = kind === 'skin' ? 'contrast(1.06) saturate(1.08)' : kind === 'eye' ? 'contrast(1.18) saturate(1.16) brightness(1.04)' : 'contrast(1.12) saturate(1.08)';
        ctx.drawImage(img, 0, 0, w, h);
        ctx.filter = 'none';
        tex.image = cv;
      } catch (e) {}
    }
    tex.userData = { ...(tex.userData || {}), sharpened: true };
    tex.needsUpdate = true;
  }

  function enhanceCharacterMaterials(model, id) {
    const dm = getDetailMaps();
    model.traverse(obj => {
      if (!obj.isMesh && !obj.isSkinnedMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.frustumCulled = false;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.filter(Boolean).forEach(mat => {
        if (!mat.isMeshStandardMaterial) return;
        const mName = ((obj.name || '') + '_' + (mat.name || '')).toLowerCase();
        if (mat.map) {
          const tKind = /skin|body|head|face/.test(mName) ? 'skin' : /eye|iris/.test(mName) ? 'eye' : 'generic';
          sharpenCharacterTexture(mat.map, tKind);
        }
        if (/skin|body|face|head/.test(mName)) {
          mat.roughness = 0.42;
          mat.metalness = 0.02;
          mat.emissive = new THREE.Color(id === 'guard' ? 0x220e0a : 0x26100d);
          mat.emissiveIntensity = 0.065;
          if (!mat.bumpMap && !mat.normalMap) { mat.bumpMap = dm.skinBump; mat.bumpScale = 0.006; }
        } else if (/eye/.test(mName) && !/brow|lash|bunny/.test(mName)) {
          mat.roughness = 0.05;
          mat.metalness = 0.08;
          mat.emissive = new THREE.Color(0xffffff);
          if (mat.map) { mat.emissiveMap = mat.map; mat.emissiveIntensity = 0.14; }
        } else if (/hair|bang/.test(mName)) {
          mat.roughness = 0.46;
          mat.metalness = 0.06;
          if (!mat.bumpMap && !mat.normalMap) { mat.bumpMap = dm.hairBump; mat.bumpScale = 0.014; }
        } else if (/uniform|suit|capfabric|backpack|tie|ribbon|skirt|pants|shirt|blazer/.test(mName)) {
          mat.roughness = 0.74;
          mat.metalness = 0.03;
          if (!mat.bumpMap && !mat.normalMap) { mat.bumpMap = dm.fabricBump; mat.bumpScale = 0.016; }
        } else if (/leather|belt|holster|pouch|boot|loafer|shoe|strap/.test(mName)) {
          mat.roughness = 0.28;
          mat.metalness = 0.08;
          if (!mat.bumpMap && !mat.normalMap) { mat.bumpMap = dm.leatherBump; mat.bumpScale = 0.012; }
        } else if (/badge|buckle|steel|button|emblem|zip/.test(mName)) {
          mat.roughness = 0.22;
          mat.metalness = 0.88;
        } else if (mat.roughness < 0.14) {
          mat.roughness = 0.14;
        }
        mat.needsUpdate = true;
      });
    });
  }

  function extractHumanRig(model) {
    const b = name => model.getObjectByName(name);
    return {
      pelvis: b('pelvis'),
      spine1: b('spine_01'),
      spine2: b('spine_02'),
      spine3: b('spine_03'),
      neck: b('neck_01'),
      head: b('head'),
      clavL: b('clavicle_l'),
      clavR: b('clavicle_r'),
      armL: b('upperarm_l'),
      armR: b('upperarm_r'),
      foreL: b('lowerarm_l'),
      foreR: b('lowerarm_r'),
      handL: b('hand_l'),
      handR: b('hand_r'),
      lookYaw: 0,
      lookPitch: 0,
      turnLean: 0,
      lastHolderYaw: null,
      phaseSeed: Math.random() * Math.PI * 2
    };
  }

  async function load(id, holder, options = {}) {
    if (!holder || !holder.isObject3D) throw new TypeError(id + ': 유효한 Three.js 그룹이 필요합니다');
    if (pending.has(holder)) return pending.get(holder);

    const url = (options.url || ('assets/characters/' + id + '.glb')) + '?v=142';
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

      if (!options.native) model.scale.multiplyScalar(targetHeight / height);
      model.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(model);
      model.position.x -= (b.min.x + b.max.x) / 2;
      model.position.y -= b.min.y;
      model.position.z -= (b.min.z + b.max.z) / 2;

      const pivot = new THREE.Group();
      pivot.name = id + '_VISUAL';
      pivot.rotation.y = yaw;
      pivot.position.y = Number(options.yOffset) || 0;
      if (Array.isArray(options.offset)) {
        pivot.position.x += options.offset[0] || 0;
        pivot.position.y += options.offset[1] || 0;
        pivot.position.z += options.offset[2] || 0;
      }
      pivot.add(model);

      enhanceCharacterMaterials(model, id);

      const clips = gltf.animations || [];
      if (clips.length) {
        const mixer = new THREE.AnimationMixer(model);
        const wanted = (options.clipNames ||
          (id === 'mina' ? ['sitting', 'sit', 'idle'] : ['idle', 'breathe', 'stand']))
          .map(s => s.toLowerCase());
        let clip = null;
        for (const w of wanted) {
          clip = clips.find(c => c.name.toLowerCase() === w) || clips.find(c => c.name.toLowerCase().includes(w));
          if (clip) break;
        }
        clip = clip || clips[0];
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat);
        action.play();
        mixers.set(holder, mixer);
        holder.userData.npcClips = clips;
        holder.userData.npcAction = action;
      }

      const rig = extractHumanRig(model);
      rigs.set(holder, { id, rig, model });

      if (prepare) { try { await prepare(pivot); } catch (e) {} }
      originalChildren.forEach(child => { if (child.name !== 'GUARD_TORCH_FX') child.visible = false; });
      holder.add(pivot);
      holder.userData.characterModel = pivot;

      const bl = [];
      model.traverse(o => {
        if (o.morphTargetDictionary && o.morphTargetDictionary.Blink != null) {
          bl.push([o, o.morphTargetDictionary.Blink]);
        }
      });
      if (bl.length) blinkers.push({ holder, meshes: bl, t: 1 + Math.random() * 2.5 });
      if (options.onLoad) { try { options.onLoad(pivot); } catch (e) { console.warn('[NPC] onLoad', e); } }
      return { ok: true, id, url, clips: clips.length };
    }).catch(err => {
      originalChildren.forEach(child => { child.visible = true; });
      return { ok: false, id, url, error: String(err.message) };
    });
    pending.set(holder, task);
    return task;
  }

  function ensurePanel() {
    if (panel) return panel;
    const css = document.createElement('style');
    css.textContent = '#npc-portrait-panel{position:fixed;z-index:100;left:24px;top:20px;width:176px;background:rgba(10,13,18,.94);color:#f0e9e1;border:1px solid #7d8291;box-shadow:0 10px 30px #000a;padding:7px;border-radius:5px;font:13px/1.5 system-ui,sans-serif;pointer-events:none;opacity:0;transform:translateX(-12px);transition:opacity .25s,transform .25s}#npc-portrait-panel.open{opacity:1;transform:translateX(0)}#npc-portrait-panel img{display:block;width:100%;aspect-ratio:3/4;object-fit:cover;object-position:center 20%;border-radius:2px}#npc-portrait-panel .npc-name{padding:7px 3px 1px;letter-spacing:.09em}@media(max-width:700px){#npc-portrait-panel{left:8px;top:8px;width:116px}}#objP{transition:opacity .25s} body.npc-portrait #objP{opacity:0}';
    document.head.appendChild(css);
    panel = document.createElement('aside');
    panel.id = 'npc-portrait-panel';
    panel.setAttribute('aria-label', 'NPC 캐릭터 초상화');
    panel.innerHTML = '<img alt="NPC 초상화"><div class="npc-name"></div>';
    document.body.appendChild(panel);
    return panel;
  }

  function portrait(id, label, durationMs = 4200) {
    if (!portraitSrc[id]) return;
    const p = ensurePanel();
    const img = p.querySelector('img');
    img.src = portraitSrc[id];
    img.alt = label + ' 초상화';
    img.onerror = () => { p.classList.remove('open'); document.body.classList.remove('npc-portrait'); };
    p.querySelector('.npc-name').textContent = label;
    window.clearTimeout(timeout);
    p.classList.add('open'); document.body.classList.add('npc-portrait');
    timeout = window.setTimeout(() => { p.classList.remove('open'); document.body.classList.remove('npc-portrait'); }, Math.max(800, durationMs));
  }

  const blinkers = [];
  function applyHumanBiomechanics(holder, entry, dt, tNow) {
    const { id, rig } = entry;
    if (!rig || holder.userData.seated) return;

    const ph = tNow * 1.65 + rig.phaseSeed;
    const breath = Math.sin(ph);
    const sway = Math.sin(ph * 0.52);
    const clipName = String(holder.userData.curClipName || '').toLowerCase();
    const isWalking = clipName.includes('walk') || clipName.includes('run');

    const curYaw = holder.rotation?.y || 0;
    if (rig.lastHolderYaw === null) rig.lastHolderYaw = curYaw;
    let dYaw = curYaw - rig.lastHolderYaw;
    dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
    rig.lastHolderYaw = curYaw;
    const targetLean = Math.max(-0.14, Math.min(0.14, -dYaw / Math.max(0.016, dt) * 0.032));
    rig.turnLean += (targetLean - rig.turnLean) * Math.min(1, dt * 8);

    if (rig.spine1) {
      rig.spine1.rotation.x += breath * 0.016;
      rig.spine1.rotation.z += sway * 0.012 + rig.turnLean * 0.45;
    }
    if (rig.spine2) {
      rig.spine2.rotation.x += breath * 0.022;
      rig.spine2.rotation.z += rig.turnLean * 0.55;
      if (isWalking) rig.spine2.rotation.y += Math.sin(tNow * 6.2) * 0.038;
    }
    if (rig.clavL) rig.clavL.rotation.z += breath * 0.018;
    if (rig.clavR) rig.clavR.rotation.z -= breath * 0.018;

    let wantLookYaw = 0, wantLookPitch = 0;
    const g = typeof window !== 'undefined' ? window.__g : null;
    if (g && g.P && id !== 'jihun' && id !== 'seoyeon') {
      const dx = g.P.x - holder.position.x, dz = g.P.z - holder.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 7.2 && dist > 0.25) {
        const toPlayerYaw = Math.atan2(dx, dz);
        let relYaw = toPlayerYaw - curYaw;
        relYaw = Math.atan2(Math.sin(relYaw), Math.cos(relYaw));
        if (Math.abs(relYaw) < 1.35) {
          wantLookYaw = Math.max(-0.72, Math.min(0.72, relYaw * 0.78));
          wantLookPitch = Math.max(-0.25, Math.min(0.25, -0.05 / Math.max(1.2, dist) + Math.sin(tNow * 2.4) * 0.025));
        }
      } else if (id === 'guard') {
        wantLookYaw = Math.sin(tNow * 1.15) * 0.32;
        wantLookPitch = Math.sin(tNow * 0.75) * 0.08;
      }
    }
    rig.lookYaw += (wantLookYaw - rig.lookYaw) * Math.min(1, dt * 6.5);
    rig.lookPitch += (wantLookPitch - rig.lookPitch) * Math.min(1, dt * 6.5);

    if (rig.neck) {
      rig.neck.rotation.y += rig.lookYaw * 0.38;
      rig.neck.rotation.x += rig.lookPitch * 0.35 + breath * 0.01;
    }
    if (rig.head) {
      rig.head.rotation.y += rig.lookYaw * 0.62;
      rig.head.rotation.x += rig.lookPitch * 0.65 - breath * 0.012;
      rig.head.rotation.z += sway * 0.018;
    }

    if (id === 'guard' && holder.userData.torchFx && holder.userData.torchFx.visible) {
      const sweep = Math.sin(tNow * 1.8) * 0.24;
      holder.userData.torchFx.rotation.y = sweep;
      holder.userData.torchFx.rotation.x = Math.sin(tNow * 1.1) * 0.08;
    }
  }

  function update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const stepDt = Math.min(.067, dt);
    const tNow = performance.now() / 1000;
    mixers.forEach((m, holder) => {
      if (holder.visible) {
        m.update(stepDt);
        const entry = rigs.get(holder);
        if (entry) applyHumanBiomechanics(holder, entry, stepDt, tNow);
      }
    });
    for (const b of blinkers) {
      if (b.holder.userData.noBlink) continue;
      b.t -= stepDt;
      if (b.t < -.15) b.t = 2.2 + Math.random() * 3.2;
      const v = b.t < 0 ? Math.sin((-b.t / .15) * Math.PI) : 0;
      b.meshes.forEach(([o, i]) => { o.morphTargetInfluences[i] = v; });
    }
  }

  function setExpression(holder, name, v = 1) {
    const m = holder && holder.userData.characterModel; if (!m) return false; let hit = false;
    m.traverse(o => { if (o.morphTargetDictionary && o.morphTargetDictionary[name] != null) { o.morphTargetInfluences[o.morphTargetDictionary[name]] = v; hit = true; } });
    return hit;
  }

  function play(holder, name, { once = false, fade = .32, speed = 1 } = {}) {
    const mixer = mixers.get(holder), clips = holder && holder.userData.npcClips;
    if (!mixer || !clips) return Promise.resolve(false);
    const clip = clips.find(c => c.name.toLowerCase() === String(name).toLowerCase())
      || clips.find(c => c.name.toLowerCase().includes(String(name).toLowerCase()));
    if (!clip) return Promise.resolve(false);
    const prev = holder.userData.npcAction, act = mixer.clipAction(clip);
    if (prev === act && act.isRunning() && !once) {
      act.timeScale = speed;
      return Promise.resolve(true);
    }
    act.reset();
    act.timeScale = speed;
    act.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    act.clampWhenFinished = once;
    act.play();
    if (prev && prev !== act) prev.crossFadeTo(act, fade, false);
    holder.userData.npcAction = act;
    if (!once) return Promise.resolve(true);
    return new Promise(res => {
      const h = e => { if (e.action === act) { mixer.removeEventListener('finished', h); res(true); } };
      mixer.addEventListener('finished', h);
    });
  }
  const has = holder => !!(holder && holder.userData.characterModel);
  return { load, portrait, update, setExpression, play, has, enhanceCharacterMaterials };
}