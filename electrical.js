// 전기 설비 배선 (electrical.js) — 스위치 → 회로 → 등기구 를 한 곳에서 관리한다
//   · 건물마다 분전반(차단기: 층 · 구역별). 회로가 켜지려면 [스위치 ON] · [차단기 ON] · [건물 전원] 이 모두 있어야 한다
//       본관 · 지하 · 체육관 · 수영장 · 급식실 · 캠퍼스 시설: 늘 전원(발전기 → 본전원, GEN.gain · power 로 밝기)
//       별관: 별관 1층 가정실 분전반 퍼즐(FL.anPow) 전까지 전원 없음
//       순간 정전(blackout) 동안은 모든 등이 꺼진다 (게임 쪽 조명 풀 · RBG.setPower 와 같은 규칙)
//   · 외등(가로등): 경비실 분전반의 외등 회로 — 자동(광센서: 어두우면 점등) · 항상 켜짐 · 꺼짐
//   · 점조명 개수는 바꾸지 않는다 (셰이더 재컴파일 방지): 세기 · 발광 · 덮개만 바꾼다
//   · 상태는 FL.elec 에 남는다 (세이브 · 이어하기)
import { SET } from './settings.js';

export function installElectrical(ctx) {
  const { THREE, scene, world, floors, mergeGeometries } = ctx;
  const FL = () => ctx.FL;
  const ST = () => (FL().elec ||= { sw: {}, brk: {}, ext: 'auto' });
  const RBG = ctx.RBG;

  // ── 건물 · 차단기 ──
  const BLD = new Map();   // id → { id, name, brks: Map, live() }
  const bld = (id, name, live = () => true) => { let b = BLD.get(id); if (!b) BLD.set(id, b = { id, name, brks: new Map(), live, panels: [] }); return b; };
  const brk = (bid, zone, label) => { const b = BLD.get(bid), id = bid + ':' + zone; let k = b.brks.get(id); if (!k) b.brks.set(id, k = { id, bld: bid, label, def: true }); return k; };
  const brkOn = k => { const v = ST().brk[k.id]; return v == null ? k.def : !!v; };
  bld('main', '본관'); bld('annex', '별관', () => !!FL().anPow); bld('gym', '체육관'); bld('pool', '수영장'); bld('cafe', '급식실'); bld('ext', '경비실 · 외등');
  brk('main', 'B1', '지하층 전등'); brk('main', 'B1c', '지하층 복도 전등');

  // ── 회로 ──
  const circuits = [], byId = new Map();
  const addC = c => { if (byId.has(c.id)) { let i = 2; while (byId.has(c.id + '#' + i)) i++; c.id += '#' + i; } circuits.push(c); byId.set(c.id, c); return c; };
  const swOn = c => { const v = ST().sw[c.id]; return v == null ? c.def : !!v; };
  const feed = c => brkOn(c.brk) && BLD.get(c.bld).live();
  const live = c => swOn(c) && feed(c);
  const blackout = () => ctx.blackout() > 0;

  // 형광등 점등: 스타터가 두 번 깜빡인 뒤 안정 (게임 조명 풀과 같은 패턴)
  const flick = c => { if (!c.flickT) return 1; const st = ctx.tNow() - c.flickT; if (st >= .9) { c.flickT = 0; return 1; } if (st < 0) return 0;
    return SET.flashReduce || SET.noFlicker ? Math.min(1, st / .9) : st < .12 || (st > .3 && st < .42) ? .55 : st < .6 ? .25 + st : 1; };
  const flickering = new Set();

  // ── 1) 새 본관 · 별관 (RBG): 방 스위치 + 층 복도 스위치 ──
  const rbBy = { main: [], annex: [] };
  if (RBG) {
    const FH = RBG.MAIN.spec.FH;
    RBG.switches.forEach((sw, i) => {
      const bid = sw.bld || 'main', f = sw.floor ?? 0, k = brk(bid, f + 'F', `${f + 1}층 전등`);
      const c = addC({ id: `rb:${bid}:${f}:${sw.base}`, type: 'rb', bld: bid, brk: k, label: sw.base, def: false, sw, lamps: sw.lamps.slice(), pose: sw.pose, floor: 0, rbY: f * FH });
      sw._c = c; rbBy[bid].push(c); c.prop = world.props.find(q => q.sw === sw);
    });
    // 스위치가 없던 등기구(계단홀 · 현관 · 승강장): 같은 건물 · 같은 층 가장 가까운 스위치(대개 복도 스위치) 회로에 묶는다
    const owned = new Set(circuits.flatMap(c => c.lamps));
    let orphan = 0;
    for (const l of RBG.lamps) { if (owned.has(l)) continue; const f = Math.floor(l.position.y / FH);
      let best = null, bd = 1e9; for (const c of circuits) { if (c.type !== 'rb' || c.sw.floor !== f) continue; const d = Math.hypot(c.pose.x - l.position.x, c.pose.z - l.position.z) - (/복도/.test(c.label) ? 12 : 0); if (d < bd) { bd = d; best = c; } }
      if (best) { best.lamps.push(l); orphan++; } }
    ctx.audit.rbOrphanLamps = orphan;
    // 등기구 발광면 덮개: 건물 발광 재질 하나를 모든 방이 같이 써서, 한 방만 켜도 건물 전체 등기구가 빛났다 → 꺼진 회로 등기구는 어두운 덮개로 가린다 (회로마다 병합 메시 1개)
    const coverM = new THREE.MeshStandardMaterial({ color: 0x55575b, roughness: .65 });
    for (const c of circuits) { if (c.type !== 'rb' || !c.lamps.length) continue;
      const gs = c.lamps.map(l => { const g = new THREE.PlaneGeometry(1.3, 1.3); g.rotateX(Math.PI / 2); g.translate(l.position.x, l.position.y + .075, l.position.z); return g; });
      const m = new THREE.Mesh(mergeGeometries(gs, false), coverM); gs.forEach(g => g.dispose()); m.name = 'ELEC_cover'; m.visible = false; m.userData.dynamic = true; RBG.group.add(m); c.cover = m; }
  }
  let rbDirty = true;
  function applyRB(k) {
    if (!RBG) return;
    const v = new Map(), any = { main: false, annex: false };
    for (const c of circuits) { if (c.type !== 'rb') continue; const lv = live(c), f = lv ? flick(c) : 0; c._lv = lv; c._f = f; if (lv) any[c.bld] = true; for (const l of c.lamps) v.set(l, Math.max(v.get(l) || 0, f)); }
    for (const l of RBG.lamps) { const f = v.get(l) || 0; l.userData.swOff = f <= 0; l.intensity = 1.6 * k * f; }
    for (const c of circuits) if (c.type === 'rb' && c.cover) c.cover.visible = any[c.bld] && k > 0 && !(c._lv && c._f > .5);
    [['main', RBG.MAIN], ['annex', RBG.ANX]].forEach(([id, b]) => { const m = b.mats && b.mats.lamp; if (m) m.emissiveIntensity = any[id] ? 1.4 * k : 0; });
  }
  if (RBG) {
    RBG.setPower = function (off, gain = 1, power = false) { const k = off ? 0 : gain * (power ? 1 : .86); if (k === this._pk && !rbDirty) return; this._pk = k; rbDirty = false; applyRB(k); };
    RBG.toggleSwitch = sw => { toggle(sw._c, true); return swOn(sw._c); };
    RBG.allOff = () => { for (const c of circuits) if (c.type === 'rb') c.def = false; rbDirty = true; };
  }

  // ── 2) 지하 · 체육관 · 수영장 · 급식실 (예전 층 4~7): world.js 방 스위치 + 복도 등 ──
  const LEG = { 4: 'main', 5: 'gym', 6: 'pool', 7: 'cafe' };
  try { RBG && RBG.pruneOld(); } catch (e) { /* 예전 층(숨김) 스위치 정리 */ }
  for (const p of world.props) {
    if (p.kind !== 'switch' || !LEG[p.floor]) continue;
    const bid = LEG[p.floor], k = p.floor === 4 ? BLD.get('main').brks.get('main:B1') : brk(bid, p.floor === 6 ? p.room : 'L', p.floor === 6 ? `${p.name} 전등` : `${BLD.get(bid).name} 전등`);
    const nx = (p.x - p.px) / .55, nz = (p.z - p.pz) / .55;
    const c = addC({ id: `lg:${p.floor}:${p.room}`, type: 'lg', bld: bid, brk: k, label: (p.name || p.room) + ' 형광등', prop: p, floor: p.floor, lamps: floors[p.floor].lamps.filter(l => l.room === p.room), pose: { x: p.px, y: 1.3, z: p.pz, nx, nz }, legacy: true });
    p.elec = c;
  }
  // 복도 · 방 스위치 없는 등: 분전반 차단기로만 (지하 복도는 늘 켜 둔다 — 학교 야간 복도등)
  for (const f of [4, 5, 6, 7]) { const F = floors[f]; if (!F || !F.lamps) continue;
    const rooms = new Set(circuits.filter(c => c.type === 'lg' && c.floor === f).map(c => c.prop.room));
    const loose = F.lamps.filter(l => !l.cabin && (!l.room || !rooms.has(l.room)));
    if (!loose.length) continue;
    const bid = LEG[f], k = f === 4 ? BLD.get('main').brks.get('main:B1c') : brk(bid, 'L', `${BLD.get(bid).name} 전등`);
    addC({ id: `lgc:${f}`, type: 'lgc', bld: bid, brk: k, label: k.label, floor: f, lamps: loose, def: true, noSwitch: true });
  }

  // ── 3) 캠퍼스 시설 · 메가 캠퍼스 건물: 층 스위치 → 등기구 발광 메시 + 조명 풀 점조명 ──
  const extLights = world.campusDesign && world.campusDesign.lights;
  const MEGA_NAMES = { chunk_library: '중앙학술정보관', chunk_dorm: '기숙사', chunk_astro: '천문관', chunk_union: '학생회관' };
  const lampOffM = new THREE.MeshStandardMaterial({ color: 0x4a4c50, roughness: .7 });
  function addGrp(p) {
    const sw = p.sw, r = sw.rect, bid = 'fac:' + (sw.bid || sw.bName || 'x'); bld(bid, MEGA_NAMES[sw.bName] || (/^chunk_/.test(sw.bName || '') ? '캠퍼스 건물' : sw.bName) || '캠퍼스 건물');
    const lvl = sw.lvl || 0, k = brk(bid, lvl + 'F', `${lvl + 1}층 전등`);
    const inR = (x, y, z) => x > r.x1 && x < r.x2 && z > r.z1 && z < r.z2 && y > (r.y1 ?? 0) + 1.8 && y < (r.y2 ?? 99) + .5;
    const meshes = []; sw.grp.traverse(o => { if (!(o.isMesh || o.isSprite) || o.isInstancedMesh) return; const em = o.isMesh && o.material && o.material.emissiveIntensity > .5 && o.material.emissive && o.material.emissive.getHex() !== 0, gl = o.isSprite && o.material.blending === THREE.AdditiveBlending; if (!em && !gl) return;
      const w = o.getWorldPosition(new THREE.Vector3()); if (inR(w.x, w.y, w.z)) meshes.push(o); });
    // 조명 풀: 등기구 자리마다 점조명 후보 (fac: 기록된 자리 · 메가: 6등 배치)
    let pts = (sw.grp.userData.lampPts || []).filter(q => q.lvl === lvl && inR(q.x, q.y + .2, q.z));
    if (!pts.length && sw.lampY) { const cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2, W = r.x2 - r.x1, D = r.z2 - r.z1;
      pts = [[-W * .28, -D * .26], [0, -D * .26], [W * .28, -D * .26], [-W * .28, D * .26], [0, D * .26], [W * .28, D * .26]].map(([a, b]) => ({ x: cx + a, y: sw.lampY - .1, z: cz + b, mega: true })); }
    const lamps = pts.map(q => ({ x: q.x, y: q.y, z: q.z, kind: 'on', fac: true, room: 'elec:' + bid + ':' + lvl, off: true }));
    if (extLights) extLights.push(...lamps); if (floors[0] && floors[0].lamps) floors[0].lamps.push(...lamps);
    // 발광 메시를 못 찾은 건물(병합된 메가 캠퍼스 등기구): 꺼질 때 어두운 덮개
    let cover = null; if (!meshes.length && pts.some(q => q.mega)) { const gs = pts.map(q => { const g = new THREE.BoxGeometry(1.24, .02, .22); g.translate(q.x, q.y + .07, q.z); return g; }); cover = new THREE.Mesh(mergeGeometries(gs, false), lampOffM); gs.forEach(g => g.dispose()); cover.name = 'ELEC_cover'; cover.userData.dynamic = true; scene.add(cover); }
    const c = addC({ id: `fx:${bid}:${lvl}:${Math.round(sw.pose ? sw.pose.x : p.x)}:${Math.round(sw.pose ? sw.pose.z : p.z)}`, type: 'grp', bld: bid, brk: k, label: sw.base, def: true, sw, prop: p, meshes, lamps, cover, pose: sw.pose, floor: 0 });
    sw._c = c; p.elec = c; return c;
  }
  const scanGrp = () => { let n = 0; for (const p of world.props) if (p.k === 'light_switch' && p.sw && !p.sw.lamps && !p.sw._c) { addGrp(p); n++; } if (n) { buildPlates(); applyAll(); } return n; };
  function applyGrp(c) { const lv = live(c) && !blackout(), f = lv ? flick(c) : 0; c._lv = lv;
    c.meshes.forEach(o => { o.visible = f > .5; }); if (c.cover) c.cover.visible = !(f > .5);
    c.lamps.forEach(l => { l.off = !lv; l.start = c.flickT || 0; }); }

  // ── 4) 외등 (캠퍼스 가로등): 경비실 분전반 · 광센서 ──
  const extK = brk('ext', 'street', '외등 (가로등)');
  const streets = extLights ? extLights.filter(l => l.street) : [];
  const extC = addC({ id: 'ext:street', type: 'ext', bld: 'ext', brk: extK, label: '외등 (가로등)', def: true, lamps: streets, noSwitch: true });
  const extWant = () => { const m = ST().ext || 'auto'; return m === 'on' ? true : m === 'off' ? false : ctx.dayK() < .45; };
  function applyExt() { const lv = brkOn(extK) && extWant(); extC._lv = lv; streets.forEach(l => { l.off = !lv; }); }

  // ── 스위치 판 (2008년식 와이드 로커 · 1~3구 · 1.2m · 표시등) — 인스턴스 3개로 전부 그린다 ──
  let plateIM = null, keyIM = null, ledIM = null; const keySlots = [];
  const plateM = new THREE.MeshStandardMaterial({ color: 0xf1eee6, roughness: .45 }), keyM = new THREE.MeshStandardMaterial({ color: 0xf6f4ee, roughness: .38 }), ledM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const gangOf = c => c.gang || (c.gang = c.type === 'grp' ? 3 : /복도/.test(c.label) ? 3 : c.lamps.length > 12 ? 3 : c.lamps.length > 3 ? 2 : 1);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color();
  function buildPlates() {
    const list = circuits.filter(c => (c.type === 'rb' || c.type === 'grp') && c.pose);
    [plateIM, keyIM, ledIM].forEach(m => { if (m) { m.parent && m.parent.remove(m); m.dispose(); } });
    keySlots.length = 0;
    const nK = list.reduce((a, c) => a + gangOf(c), 0);
    plateIM = new THREE.InstancedMesh(new THREE.BoxGeometry(.072, .118, .009), plateM, list.length);
    keyIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .056, .011), keyM, nK);
    ledIM = new THREE.InstancedMesh(new THREE.BoxGeometry(.006, .004, .003), ledM, nK);
    let j = 0;
    list.forEach((c, i) => { const P = c.pose, ry = Math.atan2(P.nx, P.nz); _q.setFromEuler(_e.set(0, ry, 0));
      _m.compose(_v.set(P.x + P.nx * .0045, P.y, P.z + P.nz * .0045), _q, _s); plateIM.setMatrixAt(i, _m);
      const g = gangOf(c), w = .058 / g; for (let n = 0; n < g; n++) keySlots.push({ c, j: j++, ry, lx: (n - (g - 1) / 2) * w, w: w - .004 }); });
    plateIM.instanceMatrix.needsUpdate = true;
    [plateIM, keyIM, ledIM].forEach(m => { m.name = 'ELEC_switchplates'; m.frustumCulled = false; m.userData.dynamic = true; m.castShadow = false; scene.add(m); });
    syncKeys();
  }
  // 키: 켜짐 = 위쪽을 누른 상태(아래로 기울어짐), 표시등: 꺼진 스위치 · 전원 있음일 때 주황 (어두운 방에서 스위치 찾기용 — 2008년 국산 스위치)
  function syncKeys() {
    if (!keyIM) return;
    for (const s of keySlots) { const c = s.c, on = swOn(c), P = c.pose, tx = Math.cos(s.ry), tz = -Math.sin(s.ry);
      _q.setFromEuler(_e.set(on ? .16 : -.16, s.ry, 0, 'YXZ'));
      _v.set(P.x + P.nx * .012 + tx * s.lx, P.y, P.z + P.nz * .012 + tz * s.lx); _s.set(s.w, 1, 1); _m.compose(_v, _q, _s); keyIM.setMatrixAt(s.j, _m);
      _v.set(P.x + P.nx * .0185 + tx * s.lx, P.y - .018, P.z + P.nz * .0185 + tz * s.lx); _s.set(1, 1, 1); _m.compose(_v, _q, _s); ledIM.setMatrixAt(s.j, _m);
      ledIM.setColorAt(s.j, _c.setHex(!on && feed(c) && !blackout() ? 0xff8a1e : 0x2a1a10)); }
    _s.set(1, 1, 1); keyIM.instanceMatrix.needsUpdate = true; ledIM.instanceMatrix.needsUpdate = true; if (ledIM.instanceColor) ledIM.instanceColor.needsUpdate = true;
  }

  // ── 분전반 (건물마다) ──
  const panelProps = [];
  const pTex = (() => { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 160; const g = cv.getContext('2d'); g.fillStyle = '#b9bdb6'; g.fillRect(0, 0, 128, 160); g.fillStyle = '#ffd400'; g.beginPath(); g.moveTo(64, 26); g.lineTo(92, 74); g.lineTo(36, 74); g.closePath(); g.fill(); g.fillStyle = '#111'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText('⚡', 64, 68); g.font = 'bold 22px sans-serif'; g.fillText('분 전 반', 64, 108); g.font = '13px sans-serif'; g.fillText('관계자 외 조작 금지', 64, 132); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const boxM = new THREE.MeshStandardMaterial({ color: 0x9da29b, roughness: .55, metalness: .35 }), faceM = new THREE.MeshStandardMaterial({ map: pTex, roughness: .6 });
  function panelVisual(x, y, z, nx, nz) {   // 벽면 노출형 강판 분전반 (420 × 560 × 110)
    const g = new THREE.Group(); g.position.set(x + nx * .055, y, z + nz * .055); g.rotation.y = Math.atan2(nx, nz); g.name = 'ELEC_panel'; g.userData.dynamic = true;
    const b = new THREE.Mesh(new THREE.BoxGeometry(.42, .56, .11), boxM); g.add(b);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(.2, .25), faceM); f.position.set(0, .08, .0555); g.add(f);
    const h = new THREE.Mesh(new THREE.BoxGeometry(.02, .07, .02), boxM); h.position.set(.17, -.04, .06); g.add(h);
    scene.add(g); return g;
  }
  function addPanel(bid, x, y, z, nx, nz, o = {}) {
    const B = BLD.get(bid); if (!B) return null;
    if (o.visual !== false) panelVisual(x, y + .35, z, nx, nz);
    const p = { kind: 'robj', k: 'elec_panel', t: 'elec', floor: o.floor ?? 0, x: x + nx * .7, z: z + nz * .7, y: y + .3, r: 1.5, label: '분전반 열기', bld: bid, _rb: o.rbY != null };
    if (o.rbY != null) p.rbY = o.rbY; world.props.push(p); B.panels.push(p); panelProps.push(p); return p;
  }
  // 문에서 먼 쪽으로 벽을 따라 비켜 단다 (스위치 옆 · 문틀과 겹치지 않게)
  const nearDoor = (x, z) => { let best = null, bd = 4; for (const q of world.props) { if (q.k !== 'fac_door' && q.kind !== 'idoor') continue; const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = q; } } return best; };
  function panelBeside(bid, c, o = {}) { const P = c.pose, tx = P.nz, tz = -P.nx, r = c.sw && c.sw.rect, d = nearDoor(P.x, P.z) || (r ? { x: (r.x1 + r.x2) / 2, z: (r.z1 + r.z2) / 2 } : null); let s = 1; if (d) s = ((P.x - d.x) * tx + (P.z - d.z) * tz) >= 0 ? 1 : -1; return addPanel(bid, P.x + tx * s * .45, 1.25 + (o.y0 || 0), P.z + tz * s * .45, P.nx, P.nz, o); }
  function placePanels() {
    // 본관 · 별관: 층마다 EPS 분전반(이미 있는 강판 함체) 자리에 조작 지점만
    if (RBG) for (const [bid, b] of [['main', RBG.MAIN], ['annex', RBG.ANX]]) for (const q of (b.props || [])) { if (q.kind !== 'panel') continue;
      const [x, z] = b.toWorld(q.x, q.z), [x2, z2] = b.toWorld(q.x, q.z + 1); addPanel(bid, x, q.y - .3, z, x2 - x, z2 - z, { visual: false, rbY: Math.floor(q.y / RBG.MAIN.spec.FH) * RBG.MAIN.spec.FH }); }
    // 지하 · 체육관 · 수영장 · 급식실: 그 층 분전반 모델(fuse_box · power_box) 살펴보기 지점을 분전반으로
    for (const f of [4, 5, 6, 7]) { const bid = LEG[f], looks = world.props.filter(q => q.kind === 'look' && q.floor === f && /분전반/.test(q.label));
      if (looks.length) looks.forEach(q => { q.kind = 'robj'; q.k = 'elec_panel'; q.t = 'elec'; q.label = '분전반 열기'; q.bld = bid; BLD.get(bid).panels.push(q); panelProps.push(q); });
      else { const c = circuits.find(c => c.type === 'lg' && c.floor === f); if (c) panelBeside(bid, c, { floor: f, y0: 0 }); } }
    // 경비실(경비동 별관) 벽 분전반 모델: 외등 · 경비동
    addPanel('ext', 11.4 - .15 - .02, 1.0, 60.4, -1, 0, { visual: false });
  }
  const facPanelDone = new Set();
  function facPanels() { for (const c of circuits) { if (c.type !== 'grp' || facPanelDone.has(c.bld)) continue; const first = circuits.find(q => q.type === 'grp' && q.bld === c.bld && (q.sw.lvl || 0) === 0) || c; facPanelDone.add(c.bld); panelBeside(c.bld, first, { y0: (first.sw.lvl || 0) * 3.6 }); } }

  // ── 조작 ──
  function applyAll() { rbDirty = true; if (RBG) RBG.setPower(blackout(), ctx.genGain(), ctx.power()); for (const c of circuits) { if (c.type === 'grp') applyGrp(c); else if (c.type === 'lg' || c.type === 'lgc') applyLg(c); } applyExt(); syncKeys(); syncLabels(); }
  function applyLg(c) {   // 지하 · 체육관 · 수영장 · 급식실: 게임 조명 풀이 l.off 를 본다
    const on = c.type === 'lgc' ? swOn(c) : !!c.prop.on, lv = on && feed(c);
    c.lamps.forEach(l => { const was = l.off; l.off = !lv; if (l.mesh) l.mesh.material = (!lv || l.kind === 'dead') ? world.mats.matLampDead : l.mat; if (was && lv && c.type === 'lg') l.start = l.start || ctx.tNow(); });
    if (c.prop) { if (c.prop.key) c.prop.key.rotation.x = on ? -0.32 : 0.32; if (c.prop.led && c.prop.led.material) c.prop.led.material.color.setHex(on || !feed(c) ? 0x163822 : 0x40ff80); }
  }
  function syncLabels() { for (const c of circuits) if (c.prop && c.prop.k === 'light_switch') c.prop.label = `${c.label} ${swOn(c) ? '끄기' : '켜기'}`; }
  function toggle(c, byPlayer = false) {
    if (!c) return;
    const on = !swOn(c); ST().sw[c.id] = on ? 1 : 0; if (c.sw) c.sw.on = on;
    if (on && feed(c)) { c.flickT = ctx.tNow(); flickering.add(c); }
    rbDirty = true; if (c.type === 'grp') applyGrp(c); if (RBG && c.type === 'rb') RBG.setPower(blackout(), ctx.genGain(), ctx.power());
    syncKeys(); syncLabels();
    if (byPlayer) { const P = c.pose || c.prop; try { ctx.at(P.x, (c.rbY || 0) + 1.2, P.z).click(); } catch (e) { ctx.sfx.click(); }
      if (on && !feed(c)) ctx.say(!BLD.get(c.bld).live() ? '딸깍 — 전원이 들어오지 않는다 (별관 1층 가정실 분전반)' : '딸깍 — 불이 들어오지 않는다. 분전반 차단기가 내려가 있다', 2400);
      else ctx.say(on ? '딸깍 — 형광등이 몇 번 깜빡이다 켜졌다' : '딸깍 — 형광등이 꺼졌다', 1600);
      ctx.noise && ctx.noise(.4); }
  }
  function setBreaker(id, on) { for (const B of BLD.values()) { const k = B.brks.get(id); if (!k) continue; ST().brk[id] = on ? 1 : 0;
      for (const c of circuits) if (c.brk === k && on && swOn(c) && B.live()) { c.flickT = ctx.tNow() + Math.random() * .2; flickering.add(c); if (c.type === 'lg') c.lamps.forEach(l => { l.start = ctx.tNow() + Math.random() * .25; }); }
      applyAll(); return true; } return false; }

  // ── 분전반 화면 ──
  let ov = null, ovB = null;
  function ensureOv() {
    if (ov) return ov;
    ov = document.createElement('div'); ov.id = 'elecPanel'; ov.className = 'elec-ov';
    ov.innerHTML = '<div class="elec-box"><div class="elec-hd"><span class="elec-t">분전반</span> <span class="elec-n"></span></div><div class="elec-sub">차단기를 올리고 내려 층 · 구역 전등 회로를 켜고 끈다</div><div class="elec-pw"></div><div class="elec-rows"></div><button class="elec-x" type="button">닫기</button></div>';
    const css = document.createElement('style'); css.textContent = `.elec-ov{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);z-index:60}.elec-ov.show{display:flex}
.elec-box{background:#8f948c;border:3px solid #5d625b;border-radius:6px;box-shadow:inset 0 0 0 2px #b8bcb3,0 10px 40px #000;color:#111;font:14px/1.4 sans-serif;padding:14px 16px;width:min(420px,92vw);max-height:86vh;overflow:auto}
.elec-hd{font-weight:700;font-size:17px;margin-bottom:2px}.elec-sub{font-size:12px;color:#2b2f2a;margin-bottom:8px}.elec-pw{font-size:12px;font-weight:700;color:#7a1010;margin-bottom:6px}
.elec-row{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#d9dbd3;border:1px solid #6b7068;border-radius:3px;padding:6px 8px;margin:4px 0}
.elec-row button{min-width:84px;padding:5px 8px;border:2px solid #222;border-radius:3px;font-weight:700;cursor:pointer;background:#2c2f2b;color:#ddd}.elec-row button.on{background:#1f6b2f;color:#fff}
.elec-x{margin-top:10px;width:100%;padding:8px;border:none;border-radius:3px;background:#2c2f2b;color:#fff;cursor:pointer}`;
    document.head.appendChild(css); document.body.appendChild(ov);
    ov.querySelector('.elec-x').addEventListener('click', () => closePanel());
    ov.addEventListener('click', e => { const b = e.target.closest('button[data-b]'); if (b) { const id = b.dataset.b; if (id === 'extmode') { const m = ST().ext || 'auto'; ST().ext = m === 'auto' ? 'on' : m === 'on' ? 'off' : 'auto'; ctx.sfx.click(); applyAll(); } else { const on = !brkOn([...BLD.get(ovB).brks.values()].find(k => k.id === id)); setBreaker(id, on); try { ctx.sfx.breaker(); } catch (e2) { ctx.sfx.click(); } } render(); ctx.save && ctx.save(); } });
    window.addEventListener('keydown', e => { if (ov.classList.contains('show') && (e.code === 'Escape' || e.code === 'KeyE')) { e.preventDefault(); e.stopPropagation(); closePanel(); } }, true);
    return ov;
  }
  const EXT_TXT = { auto: '자동 (광센서)', on: '항상 켜짐', off: '꺼짐' };
  function render() {
    const B = BLD.get(ovB); ov.querySelector('.elec-n').textContent = B.name;
    ov.querySelector('.elec-pw').textContent = B.live() ? '' : '전원 없음 — 별관 1층 가정실 분전반을 먼저 복구해야 한다';
    const rows = ov.querySelector('.elec-rows'); rows.textContent = '';
    const row = (label, id, on, txt) => { const r = document.createElement('div'); r.className = 'elec-row'; const s = document.createElement('span'); s.textContent = label; const b = document.createElement('button'); b.type = 'button'; b.dataset.b = id; b.className = on ? 'on' : ''; b.textContent = txt; r.append(s, b); rows.appendChild(r); };
    for (const k of B.brks.values()) row(k.label, k.id, brkOn(k), brkOn(k) ? 'ON' : 'OFF');
    if (B.id === 'ext') row('외등 점등 방식', 'extmode', extC._lv, EXT_TXT[ST().ext || 'auto']);
  }
  function openPanel(bid) { if (!BLD.get(bid)) return; ensureOv(); ovB = bid; render(); ov.classList.add('show'); ctx.enterUI(); try { ctx.sfx.click(); } catch (e) {} }
  function closePanel() { if (!ov || !ov.classList.contains('show')) return; ov.classList.remove('show'); ctx.exitUI(); }

  // ── 매 프레임: 점등 깜빡임 · 순간 정전 · 별관 전원 · 외등 광센서 ──
  let lastBo = false, lastAn = null, extT = 0, scanT = 0, scanN = 0;
  function tick(dt) {
    const bo = blackout(), an = !!FL().anPow;
    if (bo !== lastBo || an !== lastAn) { lastBo = bo; lastAn = an; for (const c of circuits) if (c.type === 'grp') applyGrp(c); rbDirty = true; syncKeys(); }
    if (flickering.size) { rbDirty = true; for (const c of flickering) { if (c.type === 'grp') applyGrp(c); if (!c.flickT) flickering.delete(c); } }
    if ((extT -= dt) <= 0) { extT = 1; applyExt(); }
    if (scanN < 12 && (scanT -= dt) <= 0) { scanT = 5; scanN++; if (scanGrp()) facPanels(); }
  }
  // 세이브 복원 · 새 게임
  function restore() { for (const c of circuits) { c.flickT = 0; if (c.sw) c.sw.on = swOn(c); } flickering.clear(); applyAll(); }

  // 처음 설치
  scanGrp(); buildPlates(); placePanels(); facPanels(); applyAll();
  const api = {
    BLD, circuits, byId, toggle, setBreaker, openPanel, closePanel, tick, restore, applyAll, live, feed, swOn, brkOn, scanGrp,
    isOpen: () => !!(ov && ov.classList.contains('show')),
    use(p) { if (p.k === 'elec_panel') { openPanel(p.bld); return true; } if (p.k === 'light_switch' && p.sw && p.sw._c) { toggle(p.sw._c, true); return true; } return false; },
    legacyLive: (p, on) => on && (!p.elec || feed(p.elec)),
    legacyApply: p => { if (p.elec) { applyLg(p.elec); for (const c of circuits) if (c.type === 'lgc' && c.floor === p.floor) applyLg(c); } },
    // 점검용: 회로마다 등기구 상태 (켜진 개수 · 세기 합)
    fixtureState(c) { if (typeof c === 'string') c = byId.get(c); if (!c) return null;
      if (c.type === 'rb') return { lit: c.lamps.filter(l => l.intensity > 0).length, sum: c.lamps.reduce((a, l) => a + l.intensity, 0), cover: c.cover ? c.cover.visible : null, n: c.lamps.length };
      if (c.type === 'grp') return { lit: c.lamps.filter(l => !l.off).length + c.meshes.filter(o => o.visible).length, n: c.lamps.length + c.meshes.length, cover: c.cover ? c.cover.visible : null };
      return { lit: c.lamps.filter(l => !l.off).length, n: c.lamps.length }; },
    audit() { const t = {}; circuits.forEach(c => { t[c.type] = (t[c.type] || 0) + 1; });
      return { circuits: circuits.length, byType: t, buildings: [...BLD.values()].map(b => ({ id: b.id, name: b.name, breakers: b.brks.size, panels: b.panels.length })), emptyCircuits: circuits.filter(c => (c.lamps.length + (c.meshes ? c.meshes.length : 0)) === 0).map(c => c.id), switches: circuits.filter(c => !c.noSwitch).length, panels: panelProps.length, orphanLamps: ctx.audit.rbOrphanLamps }; },
    strings() { const s = new Set(); for (const B of BLD.values()) { s.add(B.name); for (const k of B.brks.values()) s.add(k.label); } return [...s]; },
  };
  return api;
}
