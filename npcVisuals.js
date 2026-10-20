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
          ctx.filter = charId === 'guard' ? 'contrast(1.14) saturate(1.12) brightness(1.03)' : 'contrast(1.09) saturate(1.10) brightness(1.03)';
        } else if (role === 'eye') {
          ctx.filter = 'contrast(1.32) saturate(1.25) brightness(1.22)';
        } else {
          ctx.filter = 'contrast(1.15) saturate(1.10)';
        }
        ctx.drawImage(img, 0, 0, w, h);
        ctx.filter = 'none';

        if (role === 'skin') {
          // 피부 마이크로 모공·모세혈관·수염 모낭 질감 입자 합성
          const idata = ctx.getImageData(0, 0, w, h);
          const d = idata.data;
          for (let i = 0; i < d.length; i += 4) {
            const px = (i >> 2) % w, py = ((i >> 2) / w) | 0;
            const n = ((Math.sin(px * 12.9898 + py * 78.233) * 43758.5453) % 1 + 1) % 1;
            const poreDelta = (n - 0.5) * (charId === 'guard' ? 11 : 7);
            // 따뜻한 피하 혈색(Subdermal Warmth: R 살짝 보강)과 미세 모공 명암
            d[i]     = Math.max(0, Math.min(255, d[i] + poreDelta + 3));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + poreDelta * 0.85));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + poreDelta * 0.75 - 2));
          }
          ctx.putImageData(idata, 0, 0);
        } else if (role === 'eye') {
          // 안구 전체가 까맣게 보이지 않도록: 원본의 너무 넓은 검정 영역을 축소하고 흰자위(Sclera)·앰버 브라운 홍채(Iris)·동공(Pupil)·각막 반사광(Catchlight)을 선명하게 재구축!
          const idata = ctx.getImageData(0, 0, w, h);
          const d = idata.data;
          // 텍스처 중심(또는 어두운 동공 중심)을 기준으로 흰자위 영역을 대폭 넓힌다
          let sumX = 0, sumY = 0, darkCnt = 0;
          for (let y = 0; y < h; y += 2) {
            for (let x = 0; x < w; x += 2) {
              const k = (y * w + x) * 4;
              const lum = d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11;
              if (lum < 85) { sumX += x; sumY += y; darkCnt++; }
            }
          }
          const cx = darkCnt > 10 ? sumX / darkCnt : w * 0.5;
          const cy = darkCnt > 10 ? sumY / darkCnt : h * 0.5;
          const maxR = Math.min(w, h) * 0.5;
          const irisR = maxR * 0.34, pupilR = maxR * 0.14;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const k = (y * w + x) * 4;
              const dx = x - cx, dy = y - cy, dist = Math.hypot(dx, dy);
              if (dist > irisR) {
                // 맑고 자연스러운 인간 흰자위(Sclera) + 가장자리 은은한 음영
                const edge = Math.min(1, (dist - irisR) / (maxR * 0.5));
                d[k]     = Math.round(244 - edge * 18);
                d[k + 1] = Math.round(236 - edge * 22);
                d[k + 2] = Math.round(230 - edge * 24);
              } else if (dist > pupilR) {
                // 한국인 다크 브라운 홍채(Iris) + 방사형 섬유 스트랜드 + 외곽 림(Limbal Ring)
                const t = (dist - pupilR) / (irisR - pupilR);
                const ang = Math.atan2(dy, dx);
                const fib = 0.85 + 0.25 * Math.sin(ang * 28) * Math.cos(ang * 13);
                const limbal = t > 0.82 ? 0.55 : 1.0;
                d[k]     = Math.min(255, Math.round(118 * fib * limbal));
                d[k + 1] = Math.min(255, Math.round(74 * fib * limbal));
                d[k + 2] = Math.min(255, Math.round(42 * fib * limbal));
              } else {
                // 깊은 동공(Pupil)
                d[k] = 12; d[k + 1] = 10; d[k + 2] = 10;
              }
            }
          }
          ctx.putImageData(idata, 0, 0);
          // 초롱초롱한 듀얼 각막 반사 하이라이트 (Corneal Catchlights)
          ctx.fillStyle = 'rgba(255,255,255,0.96)';
          ctx.beginPath(); ctx.arc(cx - irisR * 0.28, cy - irisR * 0.28, pupilR * 0.52, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.72)';
          ctx.beginPath(); ctx.arc(cx + irisR * 0.26, cy + irisR * 0.24, pupilR * 0.28, 0, Math.PI * 2); ctx.fill();
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
        if (mat.map) {
          const role = /skin|body|head|face/.test(mName) ? 'skin' : (/eye/.test(mName) && !/brow|lash|bunny/.test(mName)) ? 'eye' : 'generic';
          remasterCharacterTexture(mat.map, role, id);
        }
        if (/skin|body|face|head/.test(mName)) {
          mat.roughness = id === 'guard' ? 0.44 : 0.39;
          mat.metalness = 0.02;
          mat.emissive = new THREE.Color(id === 'guard' ? 0x361c14 : 0x381e18);
          if (mat.map) mat.emissiveMap = mat.map;
          mat.emissiveIntensity = 0.18;
          if (!mat.normalMap) {
            mat.normalMap = nm.skinNormal;
            mat.normalScale = new THREE.Vector2(0.32, 0.32);
          }
        } else if (/eye/.test(mName) && !/brow|lash|bunny/.test(mName)) {
          mat.roughness = 0.03;
          mat.metalness = 0.12;
          mat.emissive = new THREE.Color(0xffffff);
          if (mat.map) mat.emissiveMap = mat.map;
          mat.emissiveIntensity = 0.38;
        } else if (/teeth/.test(mName)) {
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

  function attachGuardFacialFeatures(model) {
    const headBone = model.getObjectByName('head');
    if (!headBone || headBone.userData?.hasGuardFacial) return;
    headBone.userData.hasGuardFacial = true;
    // 초상화(npc_guard.webp)와 동일한 인자하고 사실적인 중년 경비원 수염(회백색 콧수염·턱수염) 및 짙은 눈썹 입체 디테일 추가
    const gMat = new THREE.MeshStandardMaterial({ color: 0x76787c, roughness: 0.78, metalness: 0.05 });
    const dMat = new THREE.MeshStandardMaterial({ color: 0x484a4e, roughness: 0.82, metalness: 0.04 });
    const fg = new THREE.Group(); fg.name = 'GUARD_FACIAL_DETAIL';
    // 콧수염 좌/우 (자연스럽게 처진 팔자형 회백색 콧수염)
    [-1, 1].forEach(s => {
      const m1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.026, 5, 8), gMat);
      m1.position.set(s * 0.016, 0.042, 0.098);
      m1.rotation.z = Math.PI / 2 - s * 0.28;
      m1.rotation.y = s * 0.18;
      fg.add(m1);
      // 짙은 회백색 눈썹 보강
      const br = new THREE.Mesh(new THREE.CapsuleGeometry(0.0065, 0.028, 4, 8), dMat);
      br.position.set(s * 0.032, 0.116, 0.094);
      br.rotation.z = Math.PI / 2 + s * 0.08;
      fg.add(br);
    });
    // 턱수염 (짧은 회백색 그루밍 스터블)
    const chin = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.024, 5, 8), dMat);
    chin.position.set(0, 0.008, 0.092);
    chin.rotation.z = Math.PI / 2;
    fg.add(chin);
    headBone.add(fg);
  }
  function extractHumanRig(model, id) {
    if (id === 'guard') attachGuardFacialFeatures(model);
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

  // 이전 프레임에 더했던 절차적 오프셋을 정확히 제거하여 본이 절대 누적 회전으로 비틀리지 않게 보장!
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

    const url = (options.url || ('assets/characters/' + id + '.glb')) + '?v=145';
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