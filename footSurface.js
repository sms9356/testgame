// 발밑 재질 판정: 발 바로 아래로 광선을 쏘아 맞은 바닥 메시의 태그(userData.surface) · 재질 태그 · 이름 · 텍스처로 표면을 고른다.
//   - 빌더가 재질/메시에 userData.surface 를 달아 두면 그것이 최우선 (본관 · 별관 · 시설 · 체육관 · 수영장 · 급식실 · 운동장 · 인도 …)
//   - 태그가 없는 굳힌(bake) 메시는 메시 이름(RB_terr · union_F03 · chunk_tennis …) → 텍스처 파일 이름 → 색으로 짐작
//   - 광선 후보는 '바닥이 될 수 있는' 메시만 한 번 모아 두고(경계구로 거른 뒤) 0.6m 칸마다 결과를 기억한다 → 걸음마다 거의 비용이 없다
//   - 은행잎 낙엽(InstancedMesh)은 광선 대신 1m 격자 밀도로 덮어쓴다
// DOM 을 쓰지 않는다 (node 테스트에서 classify 만 따로 돈다).
export const SURFACE_LIST = ['terrazzo', 'pvc', 'ceramic', 'tile', 'kitchen', 'stairs', 'wood', 'sportwood', 'stage', 'carpet', 'rubber', 'concrete', 'roofpaint',
  'wet', 'puddle', 'metal', 'grate', 'dirt', 'track', 'gravel', 'grass', 'leaves', 'paver', 'asphalt', 'stone'];
const OK = new Set(SURFACE_LIST);
// 메시 이름 규칙 (본관 · 별관 RB_<재질키>, 시설 <id>_<재질코드>, 메가 캠퍼스 chunk_<구역>)
const NAME_RULES = [
  [/^RB_(terr|porch)\b|walkway/i, 'terrazzo'], [/^RB_(deco|wear)\b|_DECO$/, 'pvc'], [/^RB_tile\b|_F04$/, 'ceramic'], [/^RB_nonslip\b/, 'stairs'],
  [/^RB_(dk)?wood\b|_F02$|_LPM$|_WOOD$|AgedOak|Walnut/i, 'wood'], [/_F03$/, 'wood'], [/_DARKWOOD$/, 'stage'], [/_CARPET$/, 'carpet'], [/^RB_rubber\b|_RUBBER$/, 'rubber'],
  [/^RB_conc\b|_F05$|_CONC$/, 'concrete'], [/^RB_roofCoat\b/, 'roofpaint'], [/_TERR$/, 'terrazzo'], [/_F01$/, 'tile'], [/_GRANITE$/, 'stone'],
  [/_CHECKER$|_STEEL$|^RB_(steelG|grille|frp)\b/, 'metal'], [/track/i, 'track'], [/grounds08_leaves|leaves|낙엽/i, 'leaves'],
  [/^chunk_(sports|lake)/, 'grass'], [/^chunk_tennis/, 'asphalt'], [/^chunk_(east_plaza|parking)/, 'paver'], [/^chunk_library/, 'wood'], [/^hood_.*_props$/, 'asphalt'],
  [/grass|lawn|잔디/i, 'grass'], [/CAMPUS_PATHS/, 'paver'], [/GUARD/, 'tile'],
];
// 텍스처 파일 이름 (실사 PBR · 시설 텍스처)
const TEX_RULES = [[/tfloor|pooltile/, 'ceramic'], [/fac_f01|tile_map/, 'tile'], [/wood|varnish|fac_f0[23]/, 'wood'], [/fac_f05|step_map|concrete/, 'concrete'], [/carpet/, 'carpet'], [/fac_metal|metal/, 'metal'], [/brick/, 'paver']];
// 한 메시(맞은 재질) → 표면 이름 또는 null
export function classify(o, m) {
  if (!o) return null;
  const tag = o.userData && o.userData.surface; if (OK.has(tag)) return tag;
  if (m && m.userData && OK.has(m.userData.surface)) return m.userData.surface;
  for (let a = o.parent, i = 0; a && i < 3; a = a.parent, i++) if (a.userData && OK.has(a.userData.surface)) return a.userData.surface;
  if (m && m.name === 'school-turf') return 'dirt';   // 다진 마사토 흙 운동장 (이름은 turf 지만 흙)
  for (const nm of [o.name, m && m.name, o.parent && o.parent.name]) if (nm) for (const [re, s] of NAME_RULES) if (re.test(nm)) return s;
  const src = m && m.map && m.map.image && (m.map.image.currentSrc || m.map.image.src || '');
  if (src && typeof src === 'string') for (const [re, s] of TEX_RULES) if (re.test(src)) return s;
  if (m && m.color) { const { r: R, g: G, b: B } = m.color;   // 색으로 짐작 (대략)
    if (R < .8 || G < .8 || B < .8) { if (G > R * 1.15 && G > B) return 'grass'; if (R > B * 1.3 && G > B * 1.1 && R < .6) return 'dirt'; } }
  return null;
}
// 바닥이 될 수 있는 메시만 (투명한 웅덩이 · 낙엽은 태그가 있을 때만)
function candidate(o) {
  if (!o.isMesh || o.isSkinnedMesh || o.isPoints || o.isLine) return null;
  const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m) return null;
  const tagged = OK.has(o.userData && o.userData.surface) || OK.has(m.userData && m.userData.surface);
  if (o.isInstancedMesh && !tagged) return null;
  if (!tagged && (m.transparent || m.isMeshBasicMaterial || m.isShaderMaterial)) return null;
  return classify(o, m) ? m : null;
}

export function createFootSurface({ THREE, scene, cell = .6 }) {
  const rc = new THREE.Raycaster(), DN = new THREE.Vector3(0, -1, 0), from = new THREE.Vector3();
  let items = [], builtAt = -1e9, cache = new Map(), leaf = null;
  const stats = { probes: 0, rays: 0, hits: 0, ms: 0, built: 0 };
  function build(now = performance.now()) {
    const t0 = performance.now(); items = []; leaf = new Map();
    scene.updateMatrixWorld(false);
    scene.traverse(o => {
      if (o.isInstancedMesh && /leaves|낙엽/i.test(o.name || '')) {   // 낙엽 밀도 격자
        const mx = new THREE.Matrix4(), p = new THREE.Vector3();
        for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, mx); p.setFromMatrixPosition(mx).applyMatrix4(o.matrixWorld); const k = Math.round(p.x) + ',' + Math.round(p.z); leaf.set(k, (leaf.get(k) || 0) + 1); }
        return; }
      if (!candidate(o)) return;
      const g = o.geometry; if (!g || !g.attributes || !g.attributes.position) return;
      if (!g.boundingSphere) g.computeBoundingSphere(); const s = g.boundingSphere.clone().applyMatrix4(o.matrixWorld);
      items.push({ o, s });
    });
    cache.clear(); builtAt = now; stats.built++; stats.buildMs = +(performance.now() - t0).toFixed(1); stats.items = items.length;
  }
  let rebuildQueued = false;
  const visible = o => { for (let a = o; a; a = a.parent) if (!a.visible) return false; return true; };
  // (x, 발 높이 y, z) → { surface, src } 또는 null
  function probe(x, y, z) {
    const now = performance.now(); stats.probes++;
    if (builtAt < 0 || !items.length) build(now);
    else if (now - builtAt > 30000 && !rebuildQueued) {   // 30초마다 다시 모으되, 걷는 프레임이 아니라 한가한 때에 (예전엔 걸음 중 ~230ms 멈춤)
      rebuildQueued = true; const ric = globalThis.requestIdleCallback || (f => setTimeout(f, 200));
      ric(() => { rebuildQueued = false; build(performance.now()); }, { timeout: 4000 });
    }
    const key = Math.round(x / cell) + ',' + Math.round(z / cell) + ',' + Math.round(y * 2);
    let r = cache.get(key);
    if (r === undefined) {
      const t0 = performance.now(); stats.rays++; r = null;
      const near = []; for (const it of items) { const s = it.s, dx = s.center.x - x, dy = s.center.y - y, dz = s.center.z - z, R = s.radius + .6; if (dx * dx + dy * dy + dz * dz < R * R) near.push(it.o); }
      from.set(x, y + .32, z); rc.set(from, DN); rc.far = .7;
      let hits = []; try { hits = rc.intersectObjects(near, false); } catch (e) { hits = []; }
      for (const h of hits) { if (!visible(h.object)) continue; const m = Array.isArray(h.object.material) ? h.object.material[(h.face && h.face.materialIndex) || 0] : h.object.material;
        const s = classify(h.object, m); if (s) { r = { surface: s, src: (h.object.name || (m && m.name) || h.object.parent?.name || 'mesh') }; stats.hits++; break; } }
      if (cache.size > 2048) cache.clear(); cache.set(key, r); stats.ms += performance.now() - t0;
    }
    if (leaf && leaf.size && y > -1 && y < 1) { const n = leaf.get(Math.round(x) + ',' + Math.round(z)) || 0; if (n >= 2 && (!r || /grass|dirt|paver|track|asphalt/.test(r.surface))) return { surface: 'leaves', src: 'grounds08_leaves', under: r && r.surface }; }
    return r;
  }
  return { probe, build, stats, invalidate: () => { builtAt = -1e9; } };
}

// 표면별 걸음 느낌 (아주 약하게): 속도 배율 · 흔들림 감쇠(1 = 그대로)
export const SURFACE_FEEL = {
  dirt: { speed: .97, bob: .9 }, track: { speed: .985, bob: .93 }, gravel: { speed: .96, bob: .88 }, grass: { speed: .98, bob: .92 }, leaves: { speed: .98, bob: .92 },
  carpet: { speed: 1, bob: .9 }, rubber: { speed: 1, bob: .92 }, wet: { speed: .95, bob: 1 }, puddle: { speed: .94, bob: 1 },
};
