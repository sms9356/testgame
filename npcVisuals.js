// 서린고 : 잊혀진 시간 — 초실사 캐릭터 피부 모공·홍채·직물 탄젠트 노멀맵(NormalMap) + 생체역학 본 IK 엔진 (v144)
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
    // 부드러운 값 노이즈 (타일링): 저주파 사인 항은 8비트 양자화에서 등고선 무늬(얼굴·재킷의 물결 줄)를 만들어서 쓰지 않는다
    const vnoise = (x, y, cell, size) => {
      const n = size / cell, gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy);
      const fx = gx - x0, fy = gy - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const h = (i, j) => hash(((i % n) + n) % n, ((j % n) + n) % n);
      return (h(x0, y0) * (1 - sx) + h(x0 + 1, y0) * sx) * (1 - sy) + (h(x0, y0 + 1) * (1 - sx) + h(x0 + 1, y0 + 1) * sx) * sy;
    };
    // ① 피부 모공 · 잔결: 고주파 노이즈 + 드문 모공 (낮은 세기로 쓴다)
    const skinNormal = buildNormal(256, 22, 1.6, (x, y, s) => {
      const fine = vnoise(x, y, 2, s) * 0.35 + vnoise(x, y, 4, s) * 0.25;
      const p = hash(x, y); return fine - (p > 0.93 ? (p - 0.93) * 6 : 0);
    });
    // ② 교복·경비복 울 능직(트윌): 대각 골 + 실 굵기 노이즈
    const fabricNormal = buildNormal(256, 24, 2.2, (x, y, s) => {
      const twill = Math.abs(((x + y) % 4) - 2) / 2;
      return twill * 0.5 + vnoise(x, y, 2, s) * 0.3 + vnoise(x, y, 8, s) * 0.2;
    });
    // ③ 가죽 페블 그레인
    const leatherNormal = buildNormal(256, 10, 2.0, (x, y, s) => vnoise(x, y, 4, s) * 0.6 + vnoise(x, y, 2, s) * 0.3);
    // ④ 머리카락 결: 세로(v) 방향으로 길게 늘인 노이즈
    const hairNormal = buildNormal(256, 6, 2.4, (x, y, s) => vnoise(x, 0, 2, s) * 0.6 + vnoise(x, 0, 1, s) * 0.2 + vnoise(x, y, 16, s) * 0.2);
    // ⑤ 교복 몸판: 큰 주름(세로로 늘인 저주파 골 · 팔꿈치 · 허리 구김) + 능직 결을 한 장에 — 반복을 낮춰 주름이 옷 크기로 보인다
    const fabricFoldNormal = buildNormal(512, 5, 2.0, (x, y, s) => {
      const twill = Math.abs(((x + y) % 4) - 2) / 2;
      const fold = vnoise(x, Math.floor(y / 3) * 3, 64, s) * 0.55 + vnoise(x, y, 32, s) * 0.35;   // 세로 방향 처짐 주름
      const crease = Math.pow(1 - Math.abs(vnoise(x, y, 48, s) * 2 - 1), 6) * 0.35;                // 접힌 자국 (날카로운 능선)
      return fold * 2.4 + crease * 1.6 + twill * 0.16 + vnoise(x, y, 2, s) * 0.08;
    });
    normalMaps = { skinNormal, fabricNormal, leatherNormal, hairNormal, fabricFoldNormal };
    return normalMaps;
  }

  // ── 2. 원본 UV(flipY=false)를 100% 보존하면서 피부 모공·혈색·눈동자 각막 하이라이트·의상 질감을 고해상도 리마스터링 ──
  function remasterCharacterTexture(tex, role = 'generic', charId = '') {
    if (!tex || tex.userData?.remasteredV151) return;
    tex.anisotropy = 16;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    const img = tex.image;
    if (img && img.width && img.height && typeof document !== 'undefined') {
      try {
        const w = img.width, h = img.height;
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d');
        ctx.filter = role === 'skin'
          ? (charId === 'guard' ? 'contrast(1.10) saturate(0.85) brightness(0.95)' : 'contrast(1.06) saturate(0.92) brightness(0.98)')
          : 'contrast(1.12) saturate(1.06)';
        ctx.drawImage(img, 0, 0, w, h);
        ctx.filter = 'none';
        const prevFlipY = tex.flipY;
        tex.image = cv;
        tex.flipY = prevFlipY;
      } catch (e) {}
    }
    tex.userData = { ...(tex.userData || {}), remasteredV151: true };
    tex.needsUpdate = true;
  }
  // 표준 재질 → 물리 재질 (sheen · clearcoat 를 쓰려고): 텍스처 · 색 · 알파 설정은 그대로 옮긴다
  function toPhysical(mat) {
    if (mat.isMeshPhysicalMaterial) return mat;
    const p = new THREE.MeshPhysicalMaterial();
    THREE.MeshStandardMaterial.prototype.copy.call(p, mat);
    p.defines = { STANDARD: '', PHYSICAL: '' };
    p.name = mat.name;
    return p;
  }
  // 피부 산란 근사: 그늘진 쪽에도 붉은 기가 남도록 간접광에 피의 색을 조금 더하고, 명암 경계를 따뜻하게 감싼다
  //   face(선택): 바인드 공간 입 중심(치아 메시 중심) → 입술 붉은 기 · 촉촉한 광 · 볼 홍조를 정점 위치로 칠한다 (텍스처 UV 와 무관 · 스키닝과 같이 움직인다)
  //   유니폼 값만 다르고 셰이더 키는 같아서 민아 · 서연 · 지훈이 같은 프로그램을 재사용한다
  function addSkinScatter(mat, warm, face) {
    const uMouth = { value: face ? face.mouth.clone() : new THREE.Vector3(0, -99, 0) };
    const uFace = { value: new THREE.Vector4(face ? face.lip : 0, face ? face.blush : 0, face ? face.cheekX : 0.04, face ? face.scale : 1) };
    const uCheek = { value: new THREE.Vector2(face ? face.cheekDY : 0.03, 0) };
    mat.userData.faceUniforms = { uMouth, uFace, uCheek };
    mat.onBeforeCompile = sh => {
      sh.uniforms.uMouth = uMouth; sh.uniforms.uFace = uFace; sh.uniforms.uCheek = uCheek;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vBindP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBindP = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vBindP; uniform vec3 uMouth; uniform vec4 uFace; uniform vec2 uCheek; float fLip = 0.0;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 d = (vBindP - uMouth) / uFace.w;
          float front = smoothstep(-0.012, 0.004, d.z);
          fLip = exp(-(d.x * d.x) / (0.021 * 0.021) - ((d.y + 0.002) * (d.y + 0.002)) / (0.0075 * 0.0075)) * front * uFace.x;
          vec2 cL = vec2(d.x - uFace.z, d.y - uCheek.x), cR = vec2(d.x + uFace.z, d.y - uCheek.x);
          float blush = (exp(-dot(cL, cL) / (0.02 * 0.02)) + exp(-dot(cR, cR) / (0.02 * 0.02))) * smoothstep(-0.05, -0.02, d.z) * uFace.y;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.0, 0.6, 0.64), clamp(fLip, 0.0, 1.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.02, 0.8, 0.8), clamp(blush, 0.0, 1.0));
        }`)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.32, clamp(fLip, 0.0, 1.0));')
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(${warm.map(v => v.toFixed(3)).join(',')});
        reflectedLight.directDiffuse *= vec3(1.0, 0.96, 0.93) + vec3(0.06, 0.02, 0.0) * (1.0 - smoothstep(0.0, 0.6, length(reflectedLight.directDiffuse)));`);
    };
    mat.customProgramCacheKey = () => 'skinScatterFace' + warm.join();
  }
  // 입 중심 (바인드 공간): 치아 메시 경계 상자의 앞쪽 중심. 볼 간격은 눈 메시 폭에서 얻는다
  function findFaceAnchor(model) {
    let teeth = null, eyes = null;
    model.traverse(o => { if (!o.geometry) return; const n = o.name.toLowerCase(); if (/teeth/.test(n)) teeth = o; else if (/_eyes$/.test(n)) eyes = o; });
    if (!teeth) return null;
    // 치아 메시는 잇몸 · 안쪽까지 커서 상자 중심이 입보다 낮다 → 가장 앞쪽 앞니 정점들의 평균이 입술 사이 높이다
    teeth.geometry.computeBoundingBox(); const tb = teeth.geometry.boundingBox, tp = teeth.geometry.attributes.position;
    let sy = 0, sx = 0, cnt = 0;
    for (let i = 0; i < tp.count; i++) if (tp.getZ(i) > tb.max.z - 0.008) { sx += tp.getX(i); sy += tp.getY(i); cnt++; }
    const mouth = new THREE.Vector3(cnt ? sx / cnt : 0, cnt ? sy / cnt : (tb.min.y + tb.max.y) / 2, tb.max.z + 0.006);
    let cheekX = 0.04, cheekDY = 0.03;
    if (eyes) {
      eyes.geometry.computeBoundingBox(); const eb = eyes.geometry.boundingBox;
      cheekX = Math.max(0.025, Math.min(0.06, (eb.max.x - eb.min.x) * 0.5));
      cheekDY = Math.max(0.015, Math.min(0.06, (eb.min.y - 0.022) - mouth.y));   // 광대 = 눈 밑 2cm 남짓
    }
    return { mouth, cheekX, cheekDY, scale: 1 };
  }
  function enhanceCharacterMaterials(model, id) {
    const nm = getNormalMaps();
    const faceA = id === 'guard' ? null : findFaceAnchor(model);
    const female = id === 'mina' || id === 'seoyeon';
    const face = faceA && { ...faceA, lip: female ? 0.85 : 0.35, blush: female ? 0.55 : 0.18 };
    const swapped = new Map();
    model.traverse(obj => {
      if (!obj.isMesh && !obj.isSkinnedMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.frustumCulled = false;
      const arr = Array.isArray(obj.material);
      const mats = arr ? obj.material : [obj.material];
      const out = mats.map(mat => {
        if (!mat || !mat.isMeshStandardMaterial) return mat;
        if (swapped.has(mat)) return swapped.get(mat);
        const mName = ((obj.name || '') + '_' + (mat.name || '')).toLowerCase();
        let m = mat;
        if (/eye/.test(mName) && !/brow|lash|bunny/.test(mName)) {
          reprojectEyeMeshUVs(obj);
          m = toPhysical(mat);
          const eyeTex = getPhotorealEyeTexture();
          m.map = eyeTex;
          m.roughness = 0.35;           // 공막은 촉촉하되 거울은 아니다 — 반사는 각막(clearcoat)이 맡는다
          m.metalness = 0;
          m.clearcoat = 1; m.clearcoatRoughness = 0.03;
          m.emissive = new THREE.Color(0xffffff); m.emissiveMap = eyeTex; m.emissiveIntensity = 0.05;
        } else if (/skin|body|face|head/.test(mName)) {
          if (mat.map) remasterCharacterTexture(mat.map, 'skin', id);
          m = toPhysical(mat);
          m.roughness = id === 'guard' ? 0.62 : 0.55;   // 피지 · 땀이 적은 맨 피부: 0.5~0.65
          m.metalness = 0;
          m.specularIntensity = 0.55;                   // 피부 F0 ≈ 0.028 (기본 0.04 보다 낮다)
          m.sheen = id === 'guard' ? 0.12 : 0.3;        // 솜털 (가장자리 부드러운 광)
          m.sheenRoughness = 0.55;
          m.sheenColor = new THREE.Color(id === 'guard' ? 0x8a6a58 : 0xffd2c0);
          m.emissive = new THREE.Color(0x000000); m.emissiveIntensity = 0; m.emissiveMap = null;
          if (!m.normalMap) { m.normalMap = nm.skinNormal; m.normalScale = new THREE.Vector2(0.12, 0.12); }
          m.specularColor = new THREE.Color(0xfff4ee);   // 피부 정반사는 아주 약간 따뜻하게
          addSkinScatter(m, id === 'guard' ? [0.07, 0.025, 0.015] : [0.1, 0.03, 0.025], face);
        } else if (/teeth/.test(mName)) {
          mat.roughness = 0.25; mat.metalness = 0;
          mat.emissive = new THREE.Color(0x000000); mat.emissiveIntensity = 0;
        } else if (/tongue/.test(mName)) {
          mat.roughness = 0.3; mat.metalness = 0;
        } else if (/hair|bang/.test(mName)) {
          // 머리카락 카드: 블렌딩 대신 알파 테스트 + 깊이 기록 → 정렬 깨짐(뒷머리가 앞머리를 덮음) 없이 가닥 끝이 살아난다
          m = toPhysical(mat);
          if (/bang/.test(mName)) { m.transparent = true; m.alphaTest = 0.1; m.depthWrite = true; }   // 앞머리: 가닥 끝은 블렌딩으로 부드럽게, 희미한 가장자리만 잘라 깊이를 쓴다
          else { m.transparent = false; m.alphaTest = 0.42; m.depthWrite = true; m.alphaToCoverage = true; }
          if (m.map) { m.map.wrapS = m.map.wrapT = THREE.ClampToEdgeWrapping; m.map.needsUpdate = true; }   // 반복 래핑이면 카드 끝에서 반대편 가닥을 샘플해 이마에 가는 선이 생긴다
          m.roughness = 0.44; m.metalness = 0;
          m.sheen = 0.7; m.sheenRoughness = 0.35; m.sheenColor = new THREE.Color(id === 'guard' ? 0x8a8680 : 0x5a4a44);   // 결을 따라 흐르는 광택 띠
          m.specularIntensity = 0.8; m.specularColor = new THREE.Color(id === 'guard' ? 0xd8d4cc : 0xe8d8cc);   // 검은 머리의 따뜻한 1차 반사
          m.side = THREE.DoubleSide;
          if ('anisotropy' in m) { m.anisotropy = 0.55; m.anisotropyRotation = Math.PI / 2; }   // 가닥 방향(카드 V축)으로 늘어진 하이라이트 (Kajiya-Kay 근사)
          if (!m.normalMap) { m.normalMap = nm.hairNormal; m.normalScale = new THREE.Vector2(0.35, 0.35); }
        } else if (/brow|lash/.test(mName)) {
          mat.roughness = 0.7; mat.metalness = 0; mat.depthWrite = false;
          if (!mat.userData.lashTone) { mat.userData.lashTone = true; mat.color.multiplyScalar(/lash/.test(mName) ? 0.55 : 0.85); }   // 속눈썹은 더 짙게 · 눈썹은 살짝   // 얇은 반투명 카드는 블렌딩 유지, 깊이는 쓰지 않는다
        } else if (/uniform|suit|capfabric|backpack|tie|ribbon|skirt|pants|shirt|blazer/.test(mName)) {
          m = toPhysical(mat);
          m.roughness = /ribbon|tie/.test(mName) ? 0.55 : 0.86;
          m.metalness = 0;
          m.sheen = /backpack/.test(mName) ? 0.15 : 0.45;   // 울 · 폴리 혼방 교복의 보풀 광
          m.sheenRoughness = 0.7;
          // 2008 동복: 남색 울 블레이저는 차갑고 어두운 보풀 광, 넥타이/리본은 폴리 능직이라 결이 촘촘하고 약간 더 반짝인다
          m.sheenColor = new THREE.Color(/tie|ribbon/.test(mName) ? 0x7a6a78 : /shirt/.test(mName) ? 0xd8dce4 : 0x5e6a8c);
          if (/tie|ribbon/.test(mName)) { m.specularIntensity = 0.6; m.sheenRoughness = 0.45; }
          else if (/blazer|suit|uniform|skirt|pants/.test(mName)) { m.specularIntensity = 0.35; }   // 울은 정반사가 약하다
          m.emissive = new THREE.Color(0x000000); m.emissiveIntensity = 0; m.emissiveMap = null;
          if (!m.normalMap) {
            const body = /uniform|suit|skirt|pants|shirt|blazer/.test(mName) && !/capfabric/.test(mName);
            m.normalMap = body ? nm.fabricFoldNormal : nm.fabricNormal;
            m.normalScale = body ? new THREE.Vector2(0.45, 0.45) : new THREE.Vector2(0.35, 0.35);
          }
          else { m.normalScale = new THREE.Vector2(0.7, 0.7); }
        } else if (/leather|belt|holster|pouch|boot|loafer|shoe|strap/.test(mName)) {
          m = toPhysical(mat);
          m.roughness = /strap|pouch|holster/.test(mName) ? 0.6 : 0.42;
          m.metalness = 0;
          if (/loafer|shoe|boot/.test(mName)) { m.clearcoat = 0.7; m.clearcoatRoughness = 0.18; }   // 광 낸 구두
          if (!m.normalMap) { m.normalMap = nm.leatherNormal; m.normalScale = new THREE.Vector2(0.3, 0.3); }
        } else if (/badge|buckle|steel|button|emblem|zip/.test(mName)) {
          mat.roughness = 0.28;
          mat.metalness = 0.9;
          mat.emissive = new THREE.Color(0x000000); mat.emissiveIntensity = 0;
        } else if (mat.roughness < 0.14) {
          mat.roughness = 0.14;
        }
        m.needsUpdate = true;
        swapped.set(mat, m);
        if (m !== mat) mat.dispose();
        return m;
      });
      obj.material = arr ? out : out[0];
    });
    if (id === 'mina') addMinaUniformDetail(model);
  }

  // 민아 교복 디테일 (2008 여고 동복): 오른쪽 가슴 명찰 "3학년 박민아" (왼쪽은 교표), 넥 리본을 실제 크기로 키운다
  let nameTagTex = null;
  function addMinaUniformDetail(model) {
    if (model.userData.minaDetail) return; model.userData.minaDetail = true;
    try {
      model.updateMatrixWorld(true);
      // 리본: 바인드 공간 기하를 자기 중심으로 1.45배 (스키닝은 그대로 — 정점만 커진다)
      ['Mina_RibbonBow', 'Mina_RibbonTail_L', 'Mina_RibbonTail_R'].forEach(n => {
        const o = model.getObjectByName(n); const g = o && o.geometry; if (!g || g.userData.ribbonScaled) return;
        g.userData.ribbonScaled = true; g.computeBoundingBox();
        const c = new THREE.Vector3(); (n === 'Mina_RibbonBow' ? g.boundingBox : model.getObjectByName('Mina_RibbonBow').geometry.boundingBox || g.boundingBox).getCenter(c);
        g.translate(-c.x, -c.y, -c.z); g.scale(1.45, 1.45, 1.45); g.translate(c.x, c.y, c.z); g.computeBoundingBox(); g.computeBoundingSphere();
      });
      // 명찰: 교표(왼쪽 가슴)의 좌우 대칭 자리 = 오른쪽 가슴. 바인드 공간에서 가장 가까운 교복 정점을 찾아
      //   그 정점의 본 가중치를 그대로 쓰는 SkinnedMesh 로 만든다 → 앉기 · 달리기 등 어떤 동작에서도 옷과 같이 움직인다
      const emb = model.getObjectByName('Mina_Emblem'), suit = model.getObjectByName('Mina_Suit');
      if (!emb || !suit || !suit.isSkinnedMesh || !emb.geometry) return;
      emb.geometry.computeBoundingBox();
      const ec = emb.geometry.boundingBox.getCenter(new THREE.Vector3());
      const tx = -ec.x, ty = ec.y + 0.012, tz = ec.z;
      const sp = suit.geometry.attributes.position, sn = suit.geometry.attributes.normal;
      let best = -1, bd = 1e9;
      for (let i = 0; i < sp.count; i++) {
        const z = sp.getZ(i); if (z < tz - 0.04) continue;
        const d = (sp.getX(i) - tx) ** 2 + (sp.getY(i) - ty) ** 2 + 0.25 * (z - tz) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      if (best < 0) return;
      // 판 넓이 안에서 가장 앞으로 나온 교복 정점 + 여유 → 가슴 곡면에 묻히지 않는다 (교복 메시가 성겨 삼각형이 정점보다 불룩하다)
      let zMax = sp.getZ(best);
      for (let i = 0; i < sp.count; i++) if (Math.abs(sp.getX(i) - tx) < 0.05 && Math.abs(sp.getY(i) - ty) < 0.025 && sp.getZ(i) < zMax + 0.05) zMax = Math.max(zMax, sp.getZ(i));
      const P = new THREE.Vector3(tx, ty, zMax + 0.004);
      const N = new THREE.Vector3(tx < 0 ? -0.18 : 0.18, 0.1, 1).normalize();   // 가슴 바깥쪽 · 약간 위를 향한다
      if (!nameTagTex) {
        nameTagTex = new THREE.TextureLoader().load(new URL('./assets/characters/mina_nametag.webp', import.meta.url).href);
        if (THREE.SRGBColorSpace) nameTagTex.colorSpace = THREE.SRGBColorSpace;
        nameTagTex.anisotropy = 8;
      }
      const geo = new THREE.BoxGeometry(0.074, 0.0204, 0.0025);   // 얇은 아크릴 판 (옆면이 보여 스티커처럼 납작하지 않다)
      const o3 = new THREE.Object3D(); o3.position.copy(P).addScaledVector(N, 0.0035); o3.lookAt(o3.position.clone().add(N)); o3.updateMatrix();
      geo.applyMatrix4(o3.matrix);
      const n = geo.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      const SI = suit.geometry.attributes.skinIndex, SW = suit.geometry.attributes.skinWeight;
      for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { si[i * 4 + k] = SI.getComponent(best, k); sw[i * 4 + k] = SW.getComponent(best, k); }
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      const face = new THREE.MeshPhysicalMaterial({ map: nameTagTex, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.1 });
      const edge = new THREE.MeshStandardMaterial({ color: 0x14285e, roughness: 0.4 });
      const tag = new THREE.SkinnedMesh(geo, [edge, edge, edge, edge, face, edge]);   // BoxGeometry 그룹 4 = +Z 앞면
      tag.name = 'Mina_NameTag';
      tag.position.copy(suit.position); tag.quaternion.copy(suit.quaternion); tag.scale.copy(suit.scale);
      tag.castShadow = false; tag.receiveShadow = true; tag.frustumCulled = false;
      suit.parent.add(tag);
      tag.bind(suit.skeleton, suit.bindMatrix);
    } catch (e) { console.warn('[npc] mina detail', e && e.message); }
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
    // 좌안(x > 0)과 우안(x < 0) 각각의 실제 눈앞 정점(max Z)을 중심(cx, cy)으로 삼아 삼백안 현상을 원천 방지한다!
    const eyes = [
      { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9, maxZ: -1e9, fx: 0.031, fy: 1.639 },
      { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9, maxZ: -1e9, fx: -0.031, fy: 1.639 }
    ];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const e = x >= 0 ? eyes[0] : eyes[1];
      if (x < e.minX) e.minX = x; if (x > e.maxX) e.maxX = x;
      if (y < e.minY) e.minY = y; if (y > e.maxY) e.maxY = y;
      if (z > e.maxZ) { e.maxZ = z; e.fx = x; e.fy = y; }
    }
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const e = x >= 0 ? eyes[0] : eyes[1];
      const cx = e.fx, cy = e.fy - 0.0016; // 홍채 중심을 살짝 아래로 내려 자연스럽고 인자한 눈매 완성!
      const rx = Math.max(0.005, (e.maxX - e.minX) * 0.44);
      const ry = Math.max(0.005, (e.maxY - e.minY) * 0.44);
      const u = Math.max(0.02, Math.min(0.98, 0.5 + (x - cx) / (rx * 2.0)));
      const v = Math.max(0.02, Math.min(0.98, 0.5 - (y - cy) / (ry * 2.0)));
      uv.setXY(i, u, v);
    }
    uv.needsUpdate = true;
  }
  let eyeTexCache = null;
  function getPhotorealEyeTexture() {
    if (eyeTexCache) return eyeTexCache;
    const N = 512, cv = document.createElement('canvas'); cv.width = cv.height = N;
    const ctx = cv.getContext('2d');
    const cx = N * 0.5, cy = N * 0.50, irisR = N * 0.30, pupilR = N * 0.11;
    const img = ctx.createImageData(N, N);
    const d = img.data;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const k = (y * N + x) * 4;
        const dx = x - cx, dy = y - cy, dist = Math.hypot(dx, dy);
        // 윗눈꺼풀 그림자 & 아랫눈꺼풀 음영으로 놀란 눈 느낌을 완전히 없애고 깊이감 있는 실제 사람의 눈매 구현
        let lidShade = 1.0;
        if (y < cy - irisR * 0.15) {
          lidShade = Math.max(0.5, 1.0 - (cy - irisR * 0.15 - y) / (N * 0.4));
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
  function sculptGuardRealisticHead(model) {
    try {
      ['Guard_Cap_1', 'Guard_Cap_2', 'Guard_CapBrim', 'Guard_CapBadge', 'Guard_CapButton'].forEach(nm => {
        const m = model.getObjectByName(nm);
        if (m && m.geometry && !m.geometry.userData?.capLowered) {
          m.geometry.userData.capLowered = true;
          m.geometry.translate(0, -0.023, 0.008);
        }
      });
      const hair = model.getObjectByName('Guard_Hair');
      if (hair && hair.geometry && !hair.geometry.userData?.hairFitted) {
        hair.geometry.userData.hairFitted = true;
        hair.geometry.translate(0, -0.014, 0.006);
      }
    } catch (e) {}
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
      foreL: b('lowerarm_l'),
      handL: b('hand_l'),
      armR: b('upperarm_r'),
      foreR: b('lowerarm_r'),
      handR: b('hand_r'),
      thighL: b('thigh_l'),
      calfL: b('calf_l'),
      footL: b('foot_l'),
      ballL: b('ball_l'),
      thighR: b('thigh_r'),
      calfR: b('calf_r'),
      footR: b('foot_r'),
      ballR: b('ball_r'),
      lookYaw: 0,
      lookPitch: 0,
      turnLean: 0,
      walkBlend: 0,
      gaitPhase: 0,
      lastPos: null,
      lastHolderYaw: null,
      phaseSeed: Math.random() * Math.PI * 2,
      speed: 0, workK: 0, idleK: 1,
      fingers: ['index', 'middle', 'ring', 'pinky'].flatMap(f => ['_l', '_r'].map(sd => b(f + '_02' + sd))).filter(Boolean),
      applied: { nx: 0, ny: 0, hx: 0, hy: 0, hz: 0, sx: 0, cz: 0, pz: 0, sz: 0, fx: 0 }
    };
  }

  function clearAppliedOffsets(rig) {
    if (!rig || !rig.applied) return;
    const a = rig.applied;
    if (rig.neck) { rig.neck.rotation.x -= a.nx; rig.neck.rotation.y -= a.ny; }
    if (rig.head) { rig.head.rotation.x -= a.hx; rig.head.rotation.y -= a.hy; rig.head.rotation.z -= a.hz; }
    if (rig.spine3) rig.spine3.rotation.x -= a.sx;
    if (rig.clavL) rig.clavL.rotation.z -= a.cz;
    if (rig.clavR) rig.clavR.rotation.z += a.cz;
    if (rig.pelvis) rig.pelvis.rotation.z -= a.pz;
    if (rig.spine2) rig.spine2.rotation.z -= a.sz;
    if (a.fx) for (const f of rig.fingers) f.rotation.z -= a.fx;
    a.nx = a.ny = a.hx = a.hy = a.hz = a.pz = a.sz = a.fx = a.sx = a.cz = 0;
  }

  // ── 3. 휴머노이드 생체역학 모션 시스템 (HumanoidMotionSystem: Analytic Limb Aiming IK/FK) ──
  const _vO = THREE.Vector3 ? new THREE.Vector3() : null, _vE = THREE.Vector3 ? new THREE.Vector3() : null, _vFrom = THREE.Vector3 ? new THREE.Vector3() : null, _vTo = THREE.Vector3 ? new THREE.Vector3() : null;
  const _qDelta = THREE.Quaternion ? new THREE.Quaternion() : null, _qWorld = THREE.Quaternion ? new THREE.Quaternion() : null, _qParentInv = THREE.Quaternion ? new THREE.Quaternion() : null;

  function aimBoneCharSpace(holderYaw, joint, end, lx, ly, lz, blend = 1.0) {
    if (!joint || !end || !_vO || !_qDelta) return;
    joint.updateWorldMatrix(true, false);
    end.updateWorldMatrix(true, false);
    joint.getWorldPosition(_vO);
    end.getWorldPosition(_vE);
    _vFrom.subVectors(_vE, _vO).normalize();
    const sinY = Math.sin(holderYaw), cosY = Math.cos(holderYaw);
    _vTo.set(lx * cosY + lz * sinY, ly, -lx * sinY + lz * cosY).normalize();
    _qDelta.setFromUnitVectors(_vFrom, _vTo);
    joint.getWorldQuaternion(_qWorld);
    _qDelta.multiply(_qWorld);
    joint.parent.getWorldQuaternion(_qParentInv).invert();
    _qParentInv.multiply(_qDelta);
    if (blend >= 0.999) joint.quaternion.copy(_qParentInv);
    else joint.quaternion.slerp(_qParentInv, blend);
    joint.updateWorldMatrix(false, true);
  }


  // ── 보폭 보정: 클립마다 "디딤발이 지면을 뒤로 미는 속도" = 클립이 표현하는 이동 속도를 미리 잰다 → 실제 이동 속도로 재생 속도를 맞춰 발 미끄러짐 제거
  function calibrateStrides(model, clips, rig) {
    const out = new Map();
    if (!rig.footL || !rig.footR) return out;
    const mx = new THREE.AnimationMixer(model), pL = new THREE.Vector3(), pR = new THREE.Vector3(), qL = new THREE.Vector3(), qR = new THREE.Vector3();
    const par = model.parent; if (par) par.updateMatrixWorld(true);
    const toLocal = v => (par ? par.worldToLocal(v) : v);
    for (const clip of clips) {
      if (!/walk|run/i.test(clip.name)) continue;
      const act = mx.clipAction(clip); act.play();
      // 부모(피벗) 공간 +z = 캐릭터 정면. 디딤발(낮은 발)의 z 속도: 정상 보행이면 뒤(-z)로 흐른다.
      //   이 GLB 들의 Walk/Run 은 시간이 거꾸로 저장돼 있어 디딤발이 앞으로 미끄러진다(문워크) → dir = -1 로 역재생
      const N = 60, dtS = clip.duration / N, L = [], R = [], bL = new THREE.Vector3(), bR = new THREE.Vector3();
      // 접지점 = 발목(foot)과 발볼(ball) 중 낮은 쪽 (뒤꿈치→앞꿈치로 구르는 동안 실제로 바닥에 닿은 곳)
      for (let i = 0; i <= N; i++) {
        mx.setTime(i * dtS); model.updateMatrixWorld(true);
        toLocal(rig.footL.getWorldPosition(pL)); toLocal(rig.footR.getWorldPosition(pR));
        if (rig.ballL) { toLocal(rig.ballL.getWorldPosition(bL)); if (bL.y < pL.y) pL.copy(bL); }
        if (rig.ballR) { toLocal(rig.ballR.getWorldPosition(bR)); if (bR.y < pR.y) pR.copy(bR); }
        L.push(pL.y, pL.z); R.push(pR.y, pR.z);
      }
      let minY = 1e9; for (let i = 0; i < L.length; i += 2) minY = Math.min(minY, L[i], R[i]);
      const sp = [];
      for (const A of [L, R]) for (let i = 2; i < A.length; i += 2) if (A[i] < minY + .015 && A[i - 2] < minY + .015) sp.push((A[i + 1] - A[i - 1]) / dtS);
      sp.sort((x, y) => x - y);
      const med = sp.length ? sp[(sp.length * .5) | 0] : 0, dir = med > 0 ? -1 : 1, v = Math.abs(med);
      const e = model.matrixWorld.elements;
      if (v > .05) out.set(clip, { v, dir, scale: Math.hypot(e[0], e[1], e[2]) });
      act.stop(); mx.uncacheAction(clip);
    }
    mx.stopAllAction(); mx.setTime(0);
    return out;
  }
  // ── 2차 움직임: 머리카락 · 리본 끈 끝이 몸의 가속에 늦게 따라오는 스프링 (뼈가 없으니 정점 셰이더에서 바인드 공간으로 흔든다 → 그 뒤 스키닝)
  function addSecondaryWobble(model) {
    const sw = { u: { uSwayT: { value: 0 }, uSway: { value: new THREE.Vector3() } }, x: 0, z: 0, vx: 0, vz: 0, lvx: 0, lvz: 0, init: false };
    const done = new Set();
    model.traverse(o => {
      if (!o.isSkinnedMesh || !/Mina_Hair|Mina_RibbonTail/.test(o.name) || done.has(o.material)) return;
      const mat = o.material; done.add(mat);
      const g = o.geometry; g.computeBoundingBox(); const bb = g.boundingBox;
      const ribbon = /Ribbon/.test(o.name), top = ribbon ? bb.max.y : bb.max.y - (bb.max.y - bb.min.y) * .25, len = Math.max(.02, top - bb.min.y);
      const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey && mat.customProgramCacheKey.bind(mat);
      mat.onBeforeCompile = (sh, r) => {
        if (prev) prev.call(mat, sh, r);
        sh.uniforms.uSwayT = sw.u.uSwayT; sh.uniforms.uSway = sw.u.uSway;
        sh.vertexShader = 'uniform float uSwayT;\nuniform vec3 uSway;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          { float w = clamp((${top.toFixed(4)} - position.y) / ${len.toFixed(4)}, 0.0, 1.0); w *= w;
            transformed.xz += (uSway.xz + vec2(sin(uSwayT * 1.7 + position.y * 23.0), cos(uSwayT * 1.3 + position.x * 17.0)) * ${ribbon ? '0.0035' : '0.0022'}) * w * ${ribbon ? '1.6' : '1.0'};
            transformed.y += abs(uSway.x + uSway.z) * w * -0.25; }`);
      };
      mat.customProgramCacheKey = () => (prevKey ? prevKey() : '') + 'sway' + top.toFixed(3);
      mat.needsUpdate = true;
    });
    return done.size ? sw : null;
  }
  // 민아의 손전등 ("손전등 꺼지면 말해. 내 거 아직 남았어") — 오른손 본에 붙는 작은 펜라이트. 재질 공유
  let torchMats = null;
  function attachFlashlight(model, rig) {
    if (!rig.handR) return null;
    const mid = model.getObjectByName('middle_01_r'); if (!mid) return null;
    torchMats ||= { body: new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: .38, metalness: .75 }), lens: new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffe7b0, emissiveIntensity: .6, roughness: .1 }) };
    model.updateMatrixWorld(true);
    const hp = rig.handR.getWorldPosition(new THREE.Vector3()), mp = mid.getWorldPosition(new THREE.Vector3());
    const ws = rig.handR.getWorldScale(new THREE.Vector3()).x || 1;
    const g = new THREE.Group(); g.name = 'Mina_Flashlight';
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.014, .012, .15, 12), torchMats.body);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(.019, .015, .035, 12), torchMats.body); head.position.y = .09;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.016, 12), torchMats.lens); lens.position.y = .108; lens.rotation.x = -Math.PI / 2;
    g.add(body, head, lens); g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    // 손 → 가운뎃손가락 방향을 따라 손바닥 안쪽에 쥔다 (손 로컬 좌표로 변환)
    const dirW = mp.clone().sub(hp).normalize();
    const qInv = rig.handR.getWorldQuaternion(new THREE.Quaternion()).invert();
    const dirL = dirW.clone().applyQuaternion(qInv);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirL);
    g.position.copy(mp.clone().sub(hp).multiplyScalar(.75)).applyQuaternion(qInv).divideScalar(ws);
    g.scale.setScalar(1 / ws);
    g.visible = false;
    rig.handR.add(g);
    return g;
  }

  async function load(id, holder, options = {}) {
    if (!holder || !holder.isObject3D) throw new TypeError(id + ': 유효한 Three.js 그룹이 필요합니다');
    if (pending.has(holder)) return pending.get(holder);

    const url = (options.url || ('assets/characters/' + id + '.glb')) + '?v=155';
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
      if (id === 'guard') sculptGuardRealisticHead(model);

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
      const entry = { id, rig, model, strideRef: clips.length ? calibrateStrides(model, clips, rig) : null, sway: null, prop: null };
      if (rig.thighL && rig.calfL) { model.updateMatrixWorld(true); entry.sitDrop = rig.thighL.getWorldPosition(new THREE.Vector3()).distanceTo(rig.calfL.getWorldPosition(new THREE.Vector3())) * .92; }
      entry.baseY = model.position.y;
      { const a0 = holder.userData.npcAction, r0 = a0 && entry.strideRef && entry.strideRef.get(a0.getClip()); if (r0) a0.timeScale = r0.dir; }
      if (id === 'mina' || id === 'seoyeon') { entry.sway = addSecondaryWobble(model); if (id === 'mina') entry.prop = attachFlashlight(model, rig); }
      rigs.set(holder, entry);

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
      originalChildren.forEach(child => { child.visible = true; }); console.warn('[npc] load failed', id, err && err.message);
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
    const curYaw = holder.rotation?.y || 0;
    if (rig.lastHolderYaw === null) rig.lastHolderYaw = curYaw;
    let dYaw = curYaw - rig.lastHolderYaw;
    dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
    rig.lastHolderYaw = curYaw;
    const targetLean = Math.max(-0.12, Math.min(0.12, -dYaw / Math.max(0.016, dt) * 0.025));
    rig.turnLean += (targetLean - rig.turnLean) * Math.min(1, dt * 8);

    // 실제 이동 거리 기반 보행 위상(gaitPhase) 및 보행 블렌딩(walkBlend) 계산
    if (!rig.lastPos && holder.position?.clone) rig.lastPos = holder.position.clone();
    if (!rig.lastPos) return;
    const movedDist = Math.hypot(holder.position.x - rig.lastPos.x, holder.position.z - rig.lastPos.z);
    rig.lastPos.copy(holder.position);
    rig.speed += (Math.min(8, movedDist / Math.max(.001, dt)) - rig.speed) * Math.min(1, dt * 10);
    const clipName = String(holder.userData.curClipName || '').toLowerCase();
    const isWalking = clipName.includes('walk') || clipName.includes('run') || movedDist > 0.002;
    rig.walkBlend += ((isWalking ? 1 : 0) - rig.walkBlend) * Math.min(1, dt * 9);
    if (isWalking) {
      const stepAdvance = movedDist > 0.0005 ? movedDist * 3.8 : dt * 5.6;
      rig.gaitPhase = (rig.gaitPhase + stepAdvance) % (Math.PI * 2);
    }

    // ── 경비원(guard) 전용 휴머노이드 전신 모션 시스템 (좀비 걸음 완전 제거 & 자연스러운 인간 보행·순찰 포즈 합성) ──
    if (id === 'guard' && rig.thighL && rig.calfL && rig.armL && rig.armR) {
      const wb = rig.walkBlend;
      const gPhi = rig.gaitPhase;
      const sL = Math.sin(gPhi), cL = Math.cos(gPhi);
      const sR = -sL, cR = -cL;

      // ① 상체(Spine): 구부정한 좀비 허리를 곧게 펴고 호흡과 보행 카운터 트위스트 적용
      const twistX = wb * (-sL * 0.045) + (1 - wb) * (sway * 0.015) + rig.turnLean * 0.45;
      const leanFwd = clipName.includes('inspect') ? 0.16 : (0.03 + breath * 0.012);
      aimBoneCharSpace(curYaw, rig.spine1, rig.spine2, twistX * 0.5, 1.0, leanFwd, 0.92);
      aimBoneCharSpace(curYaw, rig.spine2, rig.spine3, twistX, 1.0, leanFwd * 0.8, 0.92);

      // ② 다리(Legs): 4단계 인간 보행 주기 (허벅지 교차 스윙 + 스윙 구간 무릎 굽힘 + 발목 롤링)
      const lThighZ = wb * (sL * 0.38 + 0.04) + (1 - wb) * 0.02;
      const lKneeBend = wb * (Math.max(0, cL) * 0.48 + 0.07) + (1 - wb) * 0.04;
      aimBoneCharSpace(curYaw, rig.thighL, rig.calfL, 0.03, -0.94, lThighZ, 0.94);
      aimBoneCharSpace(curYaw, rig.calfL, rig.footL, 0.02, -0.94, lThighZ * 0.32 - lKneeBend, 0.94);
      if (rig.footL && rig.ballL) aimBoneCharSpace(curYaw, rig.footL, rig.ballL, 0.02, wb * (sL * 0.08) - 0.04, 0.24, 0.90);

      const rThighZ = wb * (sR * 0.38 + 0.04) + (1 - wb) * (-0.02);
      const rKneeBend = wb * (Math.max(0, cR) * 0.48 + 0.07) + (1 - wb) * 0.04;
      aimBoneCharSpace(curYaw, rig.thighR, rig.calfR, -0.03, -0.94, rThighZ, 0.94);
      aimBoneCharSpace(curYaw, rig.calfR, rig.footR, -0.02, -0.94, rThighZ * 0.32 - rKneeBend, 0.94);
      if (rig.footR && rig.ballR) aimBoneCharSpace(curYaw, rig.footR, rig.ballR, -0.02, wb * (sR * 0.08) - 0.04, 0.24, 0.90);

      // ③ 양팔(Arms): 좀비처럼 앞으로 나란히 들지 않고 몸통 옆으로 자연스럽게 내려 다리와 반대 위상으로 경쾌하게 스윙!
      if (clipName.includes('radio')) {
        // 무전기 교신 자세: 왼손을 어깨 무전기 쪽으로 자연스럽게 올림
        aimBoneCharSpace(curYaw, rig.armL, rig.foreL, 0.22, -0.45, 0.38, 0.92);
        aimBoneCharSpace(curYaw, rig.foreL, rig.handL, -0.18, 0.65, 0.32, 0.92);
      } else {
        // 자연스러운 왼팔 진자 스윙
        const lArmZ = wb * (-sL * 0.32) + (1 - wb) * (breath * 0.02);
        aimBoneCharSpace(curYaw, rig.armL, rig.foreL, 0.16, -0.92, lArmZ, 0.94);
        aimBoneCharSpace(curYaw, rig.foreL, rig.handL, 0.12, -0.84, Math.max(0.06, lArmZ + 0.22), 0.94);
      }
      // 오른팔: 상완은 몸통 옆에 자연스럽게 내리고, 전완은 손전등을 들고 걸음에 맞춰 부드럽게 리듬 스윙
      const rArmZ = wb * (sL * 0.18 + 0.08) + (1 - wb) * 0.08;
      const torchAimY = clipName.includes('inspect') ? -0.52 : -0.36;
      aimBoneCharSpace(curYaw, rig.armR, rig.foreR, -0.17, -0.90, rArmZ, 0.94);
      aimBoneCharSpace(curYaw, rig.foreR, rig.handR, -0.08 + Math.sin(tNow * 1.6) * 0.06, torchAimY, 0.76, 0.94);
    }

    // ⑤ 민아 · 주인공: 콘솔 작업(앉은) 자세 · 대기 중 체중 이동과 손가락 움직임
    if (id !== 'guard') {
      rig.workK += ((holder.userData.workPose ? 1 : 0) - rig.workK) * Math.min(1, dt * 2.5);
      const wk = rig.workK;
      if (entry.model) entry.model.position.y = entry.baseY - (entry.sitDrop || 0) * wk;
      if (wk > .005 && rig.thighL && rig.armL) {
        const tap = Math.sin(tNow * 3.1) * .05, tap2 = Math.sin(tNow * 2.3 + 1) * .05;
        aimBoneCharSpace(curYaw, rig.thighL, rig.calfL, .05, -.08, 1, wk);
        aimBoneCharSpace(curYaw, rig.calfL, rig.footL, .03, -1, .12, wk);
        aimBoneCharSpace(curYaw, rig.thighR, rig.calfR, -.05, -.08, 1, wk);
        aimBoneCharSpace(curYaw, rig.calfR, rig.footR, -.03, -1, .12, wk);
        aimBoneCharSpace(curYaw, rig.spine2, rig.spine3, 0, 1, .22, wk * .8);
        aimBoneCharSpace(curYaw, rig.armL, rig.foreL, .16, -.82, .45, wk);
        aimBoneCharSpace(curYaw, rig.foreL, rig.handL, -.18, -.2 + tap, 1, wk);
        aimBoneCharSpace(curYaw, rig.armR, rig.foreR, -.16, -.82, .45, wk);
        aimBoneCharSpace(curYaw, rig.foreR, rig.handR, .18, -.2 + tap2, 1, wk);
      }
      rig.idleK = (1 - rig.walkBlend) * (1 - wk);
    }

    // ④ 시선 추적 IK (Smooth Head & Neck Look-At) — userData.lookTarget(Vector3) 가 있으면 그쪽(관심 지점), 없으면 플레이어
    let wantLookYaw = 0, wantLookPitch = 0;
    const g = typeof window !== 'undefined' ? window.__g : null;
    const lt = holder.userData.lookTarget || (g && g.P && id !== 'jihun' && id !== 'seoyeon' ? g.P : null);
    if (holder.userData.workPose) wantLookPitch = .2 + Math.sin(tNow * .6) * .03;
    else if (lt) {
      const dx = lt.x - holder.position.x, dz = lt.z - holder.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 6.8 && dist > 0.25) {
        const toPlayerYaw = Math.atan2(dx, dz);
        let relYaw = toPlayerYaw - curYaw;
        relYaw = Math.atan2(Math.sin(relYaw), Math.cos(relYaw));
        if (Math.abs(relYaw) < 1.25) {
          wantLookYaw = Math.max(-0.52, Math.min(0.52, relYaw * 0.65));
          wantLookPitch = Math.max(-0.16, Math.min(0.16, Math.sin(tNow * 2.0) * 0.02));
        if (holder.userData.lookTarget && lt.y != null) wantLookPitch = Math.max(-.3, Math.min(.3, -Math.atan2(lt.y - holder.position.y - 1.45, dist) * .8));
        }
      } else if (id === 'guard') {
        wantLookYaw = Math.sin(tNow * 1.1) * 0.24;
        wantLookPitch = Math.sin(tNow * 0.7) * 0.05;
      }
    }
    rig.lookYaw += (wantLookYaw - rig.lookYaw) * Math.min(1, dt * 6.5);
    rig.lookPitch += (wantLookPitch - rig.lookPitch) * Math.min(1, dt * 6.5);

    const a = rig.applied;
    a.nx = rig.lookPitch * 0.35 + breath * 0.008;
    a.ny = rig.lookYaw * 0.35;
    a.hx = rig.lookPitch * 0.65 - breath * 0.010;
    a.hy = rig.lookYaw * 0.65;
    a.hz = sway * 0.012;

    if (rig.neck) { rig.neck.rotation.x += a.nx; rig.neck.rotation.y += a.ny; }
    if (rig.head) { rig.head.rotation.x += a.hx; rig.head.rotation.y += a.hy; rig.head.rotation.z += a.hz; }
    // 서 있을 때 숨쉬기: 가슴(spine_03)이 들숨에 살짝 펴지고 쇄골이 함께 오른다 (걷는 중에는 걸음이 덮으므로 줄인다)
    if (id !== 'guard') {
      const still = 1 - rig.walkBlend;
      a.sx = -breath * 0.014 * still; a.cz = breath * 0.012 * still;
      if (rig.spine3) rig.spine3.rotation.x += a.sx;
      if (rig.clavL) rig.clavL.rotation.z += a.cz;
      if (rig.clavR) rig.clavR.rotation.z -= a.cz;
    }
    if (id !== 'guard' && rig.idleK > .01) {
      const ik = rig.idleK, ws = Math.sin(tNow * .31 + rig.phaseSeed) + .35 * Math.sin(tNow * .83 + rig.phaseSeed * 2);
      a.pz = ws * .028 * ik; a.sz = -a.pz * .8;   // 짝다리 체중 이동 (골반 기울기 ↔ 상체 보상)
      a.fx = (.5 + .5 * Math.sin(tNow * .7 + rig.phaseSeed)) * .14 * ik;   // 손가락이 천천히 오므려졌다 펴짐
      if (rig.pelvis) rig.pelvis.rotation.z += a.pz;
      if (rig.spine2) rig.spine2.rotation.z += a.sz;
      for (const f of rig.fingers) f.rotation.z += a.fx;
    }

    if (id === 'guard' && holder.userData.torchFx && holder.userData.torchFx.visible) {
      const sweep = Math.sin(tNow * 1.8) * 0.20;
      holder.userData.torchFx.rotation.y = sweep;
      holder.userData.torchFx.rotation.x = Math.sin(tNow * 1.1) * 0.06;
    }
    else if (holder.userData.torchFx && holder.userData.torchFx.visible) {   // 민아 등: 손전등 빛이 시선을 따라간다 (머리보다 약간 늦게 · 손떨림)
      const tf = holder.userData.torchFx;
      tf.rotation.y += (rig.lookYaw * 0.9 + Math.sin(tNow * 2.3) * 0.015 - tf.rotation.y) * Math.min(1, dt * 4);
      tf.rotation.x += (-rig.lookPitch * 0.9 + Math.sin(tNow * 1.7) * 0.012 - tf.rotation.x) * Math.min(1, dt * 4);
    }
  }
  // 보폭 맞춤 재생 속도 · 머리카락/리본 스프링 · 소품 표시 (프레임당 할당 없음)
  function secondary(holder, entry, dt, tNow) {
    const rig = entry.rig, act = holder.userData.npcAction;
    if (entry.strideRef && act && holder.userData.autoStride !== false) {
      const ref = entry.strideRef.get(act.getClip());
      if (ref && rig.speed > .1) {
        const e = entry.model.matrixWorld.elements, sc = Math.hypot(e[0], e[1], e[2]) / ref.scale;
        const want = ref.dir * Math.max(.5, Math.min(2.6, rig.speed / (ref.v * sc)));
        act.timeScale += (want - act.timeScale) * Math.min(1, dt * 6);
      }
    }
    const sw = entry.sway;
    if (sw) {
      const yaw = (holder.rotation.y || 0) + (holder.userData.characterModel ? holder.userData.characterModel.rotation.y : 0);
      const p = holder.position;
      if (!sw.init) { sw.px = p.x; sw.pz = p.z; sw.init = true; }
      const vx = (p.x - sw.px) / dt, vz = (p.z - sw.pz) / dt; sw.px = p.x; sw.pz = p.z;
      // 세계 가속 → 캐릭터 로컬(바인드 공간: +z 앞)로 회전, 관성 반대 방향으로 스프링을 민다
      const ax = Math.max(-30, Math.min(30, (vx - sw.lvx) / dt)), az = Math.max(-30, Math.min(30, (vz - sw.lvz) / dt)); sw.lvx = vx; sw.lvz = vz;
      const c = Math.cos(yaw), s = Math.sin(yaw), lx = ax * c - az * s, lz = ax * s + az * c;
      const spd = Math.hypot(vx, vz), bob = Math.sin(tNow * 9) * Math.min(1, spd / 3) * .006;
      sw.vx += (-60 * sw.x - 7 * sw.vx - lx * .02) * dt; sw.vz += (-60 * sw.z - 7 * sw.vz - lz * .02 - spd * .35) * dt;
      sw.x = Math.max(-.05, Math.min(.05, sw.x + sw.vx * dt)); sw.z = Math.max(-.05, Math.min(.05, sw.z + sw.vz * dt));
      sw.u.uSway.value.set(sw.x + bob, 0, sw.z); sw.u.uSwayT.value = tNow;
    }
    if (entry.prop) entry.prop.visible = !!holder.userData.showProp && !holder.userData.workPose;   // 콘솔 앞에서는 손전등을 내려놓는다
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
        if (entry) { applyHumanBiomechanics(holder, entry, stepDt, tNow); secondary(holder, entry, stepDt, tNow); }
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
    const sr = entry && entry.strideRef && entry.strideRef.get(clip);
    if (sr) speed *= sr.dir;   // 역저장 보행 클립은 거꾸로 재생
    if (prev === act && act.isRunning() && !once) {
      if (!sr) act.timeScale = speed;
      return Promise.resolve(true);
    }
    act.reset();
    act.timeScale = speed;
    act.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    act.clampWhenFinished = once;
    act.play();
    if (prev && prev !== act) prev.crossFadeTo(act, fade, false);
    holder.userData.npcAction = act;
    if (entry && entry.id !== 'guard') holder.userData.curClipName = clip.name;   // 경비원은 게임이 직접 기록한다
    if (!once) return Promise.resolve(true);
    return new Promise(res => {
      const h = e => { if (e.action === act) { mixer.removeEventListener('finished', h); res(true); } };
      mixer.addEventListener('finished', h);
    });
  }
  const has = holder => !!(holder && holder.userData.characterModel);
  return { load, portrait, update, setExpression, play, has, enhanceCharacterMaterials, _rigs: rigs };
}