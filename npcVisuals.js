// 폐교: 잊혀진 시간 — 초실사 캐릭터 피부 모공·홍채·직물 탄젠트 노멀맵(NormalMap) + 생체역학 본 IK 엔진 (v144)
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

  // ── 1. 높이장(Heightfield) → RGB 탄젠트 스페이스 노멀맵(Tangent-Space NormalMap) 변환기 ──
  let normalMaps = null;
  function getNormalMaps() {
    if (normalMaps) return normalMaps;
    const buildNormal = (size, rep, amp, heightFn) => {
      const hBuf = new Float32Array(size * size);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) hBuf[y * size + x] = heightFn(x, y, size);
      }
      const cv = document.createElement('canvas'); cv.width = cv.height = size;
      const ctx = cv.getContext('2d');
      const img = ctx.createImageData(size, size);
      const d = img.data;
      for (let y = 0; y < size; y++) {
        const ym = (y - 1 + size) % size, yp = (y + 1) % size;
        for (let x = 0; x < size; x++) {
          const xm = (x - 1 + size) % size, xp = (x + 1) % size;
          const dx = (hBuf[y * size + xm] - hBuf[y * size + xp]) * amp;
          const dy = (hBuf[ym * size + x] - hBuf[yp * size + x]) * amp;
          const dz = 1.0;
          const inv = 1 / Math.hypot(dx, dy, dz);
          const idx = (y * size + x) * 4;
          d[idx]     = Math.max(0, Math.min(255, Math.round((dx * inv * 0.5 + 0.5) * 255)));
          d[idx + 1] = Math.max(0, Math.min(255, Math.round((dy * inv * 0.5 + 0.5) * 255)));
          d[idx + 2] = Math.max(0, Math.min(255, Math.round((dz * inv * 0.5 + 0.5) * 255)));
          d[idx + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      const t = new THREE.CanvasTexture(cv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rep, rep);
      t.anisotropy = 16;
      return t;
    };
    const hash = (x, y) => {
      const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    // ① 실제 인간 피부 모공(Micro-Pores) & 미세 표피 결 탄젠트 노멀맵
    const skinNormal = buildNormal(256, 14, 2.2, (x, y) => {
      const n1 = hash(x, y);
      const pore = n1 > 0.78 ? -(n1 - 0.78) * 3.5 : (n1 - 0.4) * 0.35;
      const crease = Math.sin(x * 0.35 + Math.cos(y * 0.28) * 2.0) * 0.18;
      return pore + crease;
    });
    // ② 고밀도 의상 직물(교복·경비복·모자·가방) 능직 트윌 위브 탄젠트 노멀맵
    const fabricNormal = buildNormal(256, 18, 2.8, (x, y) => {
      const warp = Math.sin((x + y) * 1.5708) * 0.45;
      const weft = Math.cos((x - y) * 1.5708) * 0.35;
      const fold = Math.sin(x * 0.08 + Math.sin(y * 0.05) * 2.5) * 0.4;
      return warp + weft + fold + (hash(x, y) - 0.5) * 0.15;
    });
    // ③ 천연 가죽(벨트·홀스터·구두·로퍼) 페블 그레인 탄젠트 노멀맵
    const leatherNormal = buildNormal(256, 10, 2.4, (x, y) => {
      const cell = Math.sin(x * 0.45) * Math.cos(y * 0.45) * 0.5;
      return cell + (hash(x >> 1, y >> 1) - 0.5) * 0.4;
    });
    // ④ 머리카락 세로 스트랜드 결 탄젠트 노멀맵
    const hairNormal = buildNormal(256, 8, 2.6, (x, y) => {
      return Math.sin(x * 1.8 + Math.sin(y * 0.12) * 1.5) * 0.65 + (hash(x, y >> 2) - 0.5) * 0.3;
    });
    normalMaps = { skinNormal, fabricNormal, leatherNormal, hairNormal };
    return normalMaps;
  }

  // ── 2. 원본 UV(flipY=false)를 100% 보존하면서 피부 모공·혈색·눈동자 각막 하이라이트·의상 질감을 고해상도 리마스터링 ──
  function remasterCharacterTexture(tex, role = 'generic', charId = '') {
    if (!tex || tex.userData?.remasteredV144) return;
    tex.anisotropy = 16;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    const img = tex.image;
    if (img && img.width && img.height && typeof document !== 'undefined') {
      try {
        const w = img.width, h = img.height;
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        // 원본 이미지를 변환 없이 그대로 그려 GLTF flipY=false UV 좌표계를 100% 보존!
        if (role === 'skin') {
          // 주황빛/과채도를 억제한 자연스러운 한국인 실사 피부 톤 & 명암 대비
          ctx.filter = charId === 'guard' ? 'contrast(1.12) saturate(0.84) brightness(0.95)' : 'contrast(1.08) saturate(0.92) brightness(0.98)';
        } else {
          ctx.filter = 'contrast(1.14) saturate(1.06)';
        }
        ctx.drawImage(img, 0, 0, w, h);
        ctx.filter = 'none';
        if (role === 'skin') {
          const idata = ctx.getImageData(0, 0, w, h);
          const d = idata.data;
          for (let i = 0; i < d.length; i += 4) {
            const px = (i >> 2) % w, py = ((i >> 2) / w) | 0;
            const n = ((Math.sin(px * 12.9898 + py * 78.233) * 43758.5453) % 1 + 1) % 1;
            const pore = (n - 0.5) * (charId === 'guard' ? 8 : 5);
            d[i]     = Math.max(0, Math.min(255, Math.round(d[i] + pore)));
            d[i + 1] = Math.max(0, Math.min(255, Math.round(d[i + 1] + pore)));
            d[i + 2] = Math.max(0, Math.min(255, Math.round(d[i + 2] + pore)));
          }
          ctx.putImageData(idata, 0, 0);
        }
                const prevFlipY = tex.flipY;
        tex.image = cv;
        tex.flipY = prevFlipY;
      } catch (e) {}
    }
    tex.userData = { ...(tex.userData || {}), remasteredV144: true };
    tex.needsUpdate = true;
  }

  function enhanceCharacterMaterials(model, id) {
    const nm = getNormalMaps();
    model.traverse(obj => {
      if (!obj.isMesh && !obj.isSkinnedMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.frustumCulled = false;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.filter(Boolean).forEach(mat => {
        if (!mat.isMeshStandardMaterial) return;
        const mName = ((obj.name || '') + '_' + (mat.name || '')).toLowerCase();
        if (/eye/.test(mName) && !/brow|lash|bunny/.test(mName)) {
          reprojectEyeMeshUVs(obj);
          const eyeTex = getPhotorealEyeTexture();
          mat.map = eyeTex;
          mat.roughness = 0.04;
          mat.metalness = 0.08;
          mat.emissive = new THREE.Color(0xffffff);
          mat.emissiveMap = eyeTex;
          mat.emissiveIntensity = 0.04;
        } else if (/skin|body|face|head/.test(mName)) {
          if (mat.map) remasterCharacterTexture(mat.map, 'skin', id);
          mat.roughness = id === 'guard' ? 0.48 : 0.42;
          mat.metalness = 0.01;
          mat.emissive = new THREE.Color(0x1a0e0a);
          if (mat.map) mat.emissiveMap = mat.map;
          mat.emissiveIntensity = 0.025;
          if (!mat.normalMap) {
            mat.normalMap = nm.skinNormal;
            mat.normalScale = new THREE.Vector2(0.28, 0.28);
          }        } else if (/teeth/.test(mName)) {
          mat.roughness = 0.18;
          mat.emissive = new THREE.Color(0x2a2824);
          mat.emissiveIntensity = 0.12;
        } else if (/hair|bang|brow|lash/.test(mName)) {
          mat.roughness = 0.42;
          mat.metalness = 0.08;
          if (!mat.normalMap && /hair|bang/.test(mName)) {
            mat.normalMap = nm.hairNormal;
            mat.normalScale = new THREE.Vector2(0.42, 0.42);
          }
        } else if (/uniform|suit|capfabric|backpack|tie|ribbon|skirt|pants|shirt|blazer/.test(mName)) {
          mat.roughness = 0.68;
          mat.metalness = 0.05;
          if (mat.map) { mat.emissive = new THREE.Color(0xffffff); mat.emissiveMap = mat.map; mat.emissiveIntensity = 0.08; }
          if (!mat.normalMap) {
            mat.normalMap = nm.fabricNormal;
            mat.normalScale = new THREE.Vector2(0.52, 0.52);
          }
        } else if (/leather|belt|holster|pouch|boot|loafer|shoe|strap/.test(mName)) {
          mat.roughness = 0.25;
          mat.metalness = 0.12;
          if (!mat.normalMap) {
            mat.normalMap = nm.leatherNormal;
            mat.normalScale = new THREE.Vector2(0.38, 0.38);
          }
        } else if (/badge|buckle|steel|button|emblem|zip/.test(mName)) {
          mat.roughness = 0.18;
          mat.metalness = 0.92;
          mat.emissive = new THREE.Color(0x3a2e14);
          mat.emissiveIntensity = 0.15;
        } else if (mat.roughness < 0.14) {
          mat.roughness = 0.14;
        }
        mat.needsUpdate = true;
      });
    });
  }

  function reprojectEyeMeshUVs(eyeMesh) {
    const geo = eyeMesh?.geometry;
    if (!geo || !geo.attributes?.position || geo.userData?.reprojectedEyeUV) return;
    geo.userData.reprojectedEyeUV = true;
    const pos = geo.attributes.position;
    let uv = geo.attributes.uv;
    if (!uv) {
      uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
      geo.setAttribute('uv', uv);
    }
    // 좌안(x > 0)과 우안(x < 0) 각각의 정면 중심점(max Z 근처 평균 X, Y)과 반지름을 구한다
    const eyes = [{ minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9 }, { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9 }];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const e = x >= 0 ? eyes[0] : eyes[1];
      if (x < e.minX) e.minX = x; if (x > e.maxX) e.maxX = x;
      if (y < e.minY) e.minY = y; if (y > e.maxY) e.maxY = y;
    }
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const e = x >= 0 ? eyes[0] : eyes[1];
      const cx = (e.minX + e.maxX) * 0.5, cy = (e.minY + e.maxY) * 0.5;
      const rx = Math.max(0.004, (e.maxX - e.minX) * 0.52);
      const ry = Math.max(0.004, (e.maxY - e.minY) * 0.52);
      const u = Math.max(0.02, Math.min(0.98, 0.5 + (x - cx) / (rx * 2.15)));
      const v = Math.max(0.02, Math.min(0.98, 0.5 - (y - cy) / (ry * 2.15)));
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;
  }

  let eyeTexCache = null;
  function getPhotorealEyeTexture() {
    if (eyeTexCache) return eyeTexCache;
    const N = 512, cv = document.createElement('canvas'); cv.width = cv.height = N;
    const ctx = cv.getContext('2d');
    const cx = N * 0.5, cy = N * 0.50, irisR = N * 0.37, pupilR = N * 0.15;
    const img = ctx.createImageData(N, N);
    const d = img.data;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const k = (y * N + x) * 4;
        const dx = x - cx, dy = y - cy, dist = Math.hypot(dx, dy);
        // 윗눈꺼풀 그림자 & 아랫눈꺼풀 음영으로 놀란 눈 느낌을 완전히 없애고 깊이감 있는 실제 사람의 눈매 구현
        let lidShade = 1.0;
        if (y < cy - irisR * 0.15) {
          lidShade = Math.max(0.22, 1.0 - (cy - irisR * 0.15 - y) / (N * 0.28));
        } else if (y > cy + irisR * 0.55) {
          lidShade = Math.max(0.55, 1.0 - (y - (cy + irisR * 0.55)) / (N * 0.28));
        }
        const cornerShade = Math.max(0.58, 1.0 - Math.pow(Math.abs(dx) / (N * 0.5), 2.2) * 0.45);
        const ao = lidShade * cornerShade;
        if (dist > irisR) {
          const edge = Math.min(1, Math.max(0, (dist - irisR) / (N * 0.22)));
          d[k]     = Math.round((214 - edge * 26) * ao);
          d[k + 1] = Math.round((204 - edge * 30) * ao);
          d[k + 2] = Math.round((198 - edge * 32) * ao);
          d[k + 3] = 255;
        } else if (dist > pupilR) {
          const t = (dist - pupilR) / (irisR - pupilR);
          const ang = Math.atan2(dy, dx);
          const fib = 0.85 + 0.22 * Math.sin(ang * 30) * Math.cos(ang * 14 + t * 3);
          const limbal = t > 0.76 ? Math.max(0.28, 1 - (t - 0.76) * 3.0) : 1.0;
          const f = fib * limbal * ao;
          d[k]     = Math.min(255, Math.round(74 * f));
          d[k + 1] = Math.min(255, Math.round(44 * f));
          d[k + 2] = Math.min(255, Math.round(26 * f));
          d[k + 3] = 255;
        } else {
          d[k] = 8; d[k + 1] = 6; d[k + 2] = 6; d[k + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    // 은은하고 자연스러운 각막 하이라이트 (Catchlight)
    ctx.fillStyle = 'rgba(255,252,245,0.82)';
    ctx.beginPath(); ctx.arc(cx - irisR * 0.24, cy - irisR * 0.18, pupilR * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,252,245,0.45)';
    ctx.beginPath(); ctx.arc(cx + irisR * 0.22, cy + irisR * 0.20, pupilR * 0.18, 0, Math.PI * 2); ctx.fill();
    const tex = new THREE.CanvasTexture(cv);
    tex.flipY = false;
    tex.anisotropy = 16;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    eyeTexCache = tex;
    return tex;
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
      lookYaw: 0,
      lookPitch: 0,
      turnLean: 0,
      lastHolderYaw: null,
      phaseSeed: Math.random() * Math.PI * 2,
      applied: { s1x: 0, s1z: 0, s2x: 0, s2y: 0, s2z: 0, clz: 0, crz: 0, nx: 0, ny: 0, hx: 0, hy: 0, hz: 0 }
    };
  }
  function clearAppliedOffsets(rig) {
    if (!rig || !rig.applied) return;
    const a = rig.applied;
    if (rig.spine1) { rig.spine1.rotation.x -= a.s1x; rig.spine1.rotation.z -= a.s1z; }
    if (rig.spine2) { rig.spine2.rotation.x -= a.s2x; rig.spine2.rotation.y -= a.s2y; rig.spine2.rotation.z -= a.s2z; }
    if (rig.clavL)  { rig.clavL.rotation.z -= a.clz; }
    if (rig.clavR)  { rig.clavR.rotation.z -= a.crz; }
    if (rig.neck)   { rig.neck.rotation.x -= a.nx; rig.neck.rotation.y -= a.ny; }
    if (rig.head)   { rig.head.rotation.x -= a.hx; rig.head.rotation.y -= a.hy; rig.head.rotation.z -= a.hz; }
    a.s1x = a.s1z = a.s2x = a.s2y = a.s2z = a.clz = a.crz = a.nx = a.ny = a.hx = a.hy = a.hz = 0;
  }

  async function load(id, holder, options = {}) {
    if (!holder || !holder.isObject3D) throw new TypeError(id + ': 유효한 Three.js 그룹이 필요합니다');
    if (pending.has(holder)) return pending.get(holder);

    const url = (options.url || ('assets/characters/' + id + '.glb')) + '?v=149';
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

      const rig = extractHumanRig(model, id);
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
    const targetLean = Math.max(-0.12, Math.min(0.12, -dYaw / Math.max(0.016, dt) * 0.028));
    rig.turnLean += (targetLean - rig.turnLean) * Math.min(1, dt * 8);

    let wantLookYaw = 0, wantLookPitch = 0;
    const g = typeof window !== 'undefined' ? window.__g : null;
    if (g && g.P && id !== 'jihun' && id !== 'seoyeon') {
      const dx = g.P.x - holder.position.x, dz = g.P.z - holder.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 6.8 && dist > 0.25) {
        const toPlayerYaw = Math.atan2(dx, dz);
        let relYaw = toPlayerYaw - curYaw;
        relYaw = Math.atan2(Math.sin(relYaw), Math.cos(relYaw));
        if (Math.abs(relYaw) < 1.25) {
          wantLookYaw = Math.max(-0.52, Math.min(0.52, relYaw * 0.65));
          wantLookPitch = Math.max(-0.18, Math.min(0.18, Math.sin(tNow * 2.0) * 0.02));
        }
      }
    }
    rig.lookYaw += (wantLookYaw - rig.lookYaw) * Math.min(1, dt * 6.5);
    rig.lookPitch += (wantLookPitch - rig.lookPitch) * Math.min(1, dt * 6.5);

    const a = rig.applied;
    a.s1x = breath * 0.014;
    a.s1z = sway * 0.010 + rig.turnLean * 0.4;
    a.s2x = breath * 0.018;
    a.s2y = isWalking ? Math.sin(tNow * 5.8) * 0.032 : 0;
    a.s2z = rig.turnLean * 0.5;
    a.clz = breath * 0.015;
    a.crz = -breath * 0.015;
    a.nx  = rig.lookPitch * 0.35 + breath * 0.008;
    a.ny  = rig.lookYaw * 0.35;
    a.hx  = rig.lookPitch * 0.65 - breath * 0.010;
    a.hy  = rig.lookYaw * 0.65;
    a.hz  = sway * 0.012;

    if (rig.spine1) { rig.spine1.rotation.x += a.s1x; rig.spine1.rotation.z += a.s1z; }
    if (rig.spine2) { rig.spine2.rotation.x += a.s2x; rig.spine2.rotation.y += a.s2y; rig.spine2.rotation.z += a.s2z; }
    if (rig.clavL)  { rig.clavL.rotation.z += a.clz; }
    if (rig.clavR)  { rig.clavR.rotation.z += a.crz; }
    if (rig.neck)   { rig.neck.rotation.x += a.nx; rig.neck.rotation.y += a.ny; }
    if (rig.head)   { rig.head.rotation.x += a.hx; rig.head.rotation.y += a.hy; rig.head.rotation.z += a.hz; }

    if (id === 'guard' && holder.userData.torchFx && holder.userData.torchFx.visible) {
      const sweep = Math.sin(tNow * 1.8) * 0.22;
      holder.userData.torchFx.rotation.y = sweep;
      holder.userData.torchFx.rotation.x = Math.sin(tNow * 1.1) * 0.07;
    }
  }

  function update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const stepDt = Math.min(.067, dt);
    const tNow = performance.now() / 1000;
    mixers.forEach((m, holder) => {
      if (holder.visible) {
        const entry = rigs.get(holder);
        if (entry) clearAppliedOffsets(entry.rig);
        m.update(stepDt);
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
    const entry = rigs.get(holder);
    if (entry) clearAppliedOffsets(entry.rig);
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