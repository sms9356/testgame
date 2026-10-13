// 폐교 — 다시, 여기서 : 1인칭 학교 공포 게임 (Three.js)
import * as THREE from './vendor/three.module.js';
import { buildWorld, collide, los, FH, GATE_Z, KEY_NAMES, KEY_ROOMS, AREA_NAMES, SLOTS, LAYOUT, ANNEX } from './world.js';
import { drawMap } from './map.js';
import { makeDress, makeHair, makeGhostFace } from './tex.js';
import { warmUp } from './bake.js';
import { initAudio, sfx, setProximity } from './audio.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const TEST = params.has('test');
const TST = { god: false, noGhost: false };

/* ---------- 렌더러 / 씬 ---------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);
scene.fog = new THREE.FogExp2(0x070a12, 0.03);
const FOG_IN = new THREE.Color(0x060708), FOG_OUT = new THREE.Color(0x0c1424);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 320);
scene.add(camera);

const hemi = new THREE.HemisphereLight(0x8aa0d0, 0x2a2018, 0.4);
scene.add(hemi);
const moonLight = new THREE.DirectionalLight(0x7f9ae0, 1.0);
moonLight.position.set(-40, 90, -120); scene.add(moonLight);
const fillLight = new THREE.DirectionalLight(0x8a9ac8, 0); fillLight.position.set(30, 50, 150); scene.add(fillLight);   // 운동장 쪽 건물 정면을 비추는 보조 달빛
const flash = new THREE.SpotLight(0xfff0d0, 0, 30, 0.5, 0.55, 1.3);
flash.position.set(0.12, -0.08, 0); flash.target.position.set(0, 0, -6);
camera.add(flash, flash.target);
flash.castShadow = true; flash.shadow.mapSize.set(1024, 1024); flash.shadow.camera.near = .15; flash.shadow.camera.far = 26;
flash.shadow.bias = -.0006; flash.shadow.normalBias = .03;
const pool = [];
for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xcfe6d6, 0, 12, 1.7); scene.add(l); pool.push(l); }

const world = buildWorld(scene);
const floors = world.floors;

/* ---------- 상태 ---------- */
let state = 'menu';            // menu | playing | paused | note | dead | won
let tNow = 0, playTime = 0;
const P = {
  x: 0, z: 77.5, floor: 0, yaw: 0, pitch: 0, light: true, battery: 100, stamina: 100, tired: false,
  keys: 0, hp: 100, invuln: 0, fear: 0, roofSeen: false, moving: false, sprinting: false, hiding: null, bob: 0, stepD: 0, noise: 0, fade: 0,
};
const TOTAL = KEY_NAMES.length;
const got = KEY_NAMES.map(() => false);
const inv = { battery: 0, medkit: 0 }, docs = [];
let gateClosed = false, gateAnim = 0, gateState = 'open';
let lookBack = 0, introT = 0;
let blackout = 0, shake = 0, nextEvent = 40, lampTimer = 0, introDone = false, escaped = false;
const keys = {};

/* ---------- 유령 ---------- */
function buildGhost() {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const DS = THREE.DoubleSide;
  const dTex = makeDress(); dTex.repeat.set(3, 1);
  const dressM = new THREE.MeshStandardMaterial({ map: dTex, color: 0x6e6a62, roughness: 1, emissive: 0x141210, side: DS, alphaTest: .4 });
  const hairM = new THREE.MeshStandardMaterial({ map: makeHair(), color: 0x1a1612, roughness: .8, side: DS, alphaTest: .3 });
  const capM = new THREE.MeshStandardMaterial({ color: 0x070605, roughness: .9 });
  const skinM = new THREE.MeshStandardMaterial({ color: 0x7a756c, roughness: .9, emissive: 0x0c0b0a });
  const faceM = new THREE.MeshStandardMaterial({ map: makeGhostFace(), color: 0x8a857c, roughness: .9 });
  // 원피스: 주름 진 레이스 실루엣 + 찢어진 밑단(알파)
  const prof = [[.05, 0], [.42, .02], [.47, .1], [.41, .45], [.32, .85], [.24, 1.12], [.2, 1.28], [.17, 1.38], [.12, 1.46], [.06, 1.5]].map(p => new THREE.Vector2(p[0], p[1]));
  const dg = new THREE.LatheGeometry(prof, 40), dp = dg.attributes.position;
  for (let i = 0; i < dp.count; i++) {
    const x = dp.getX(i), y = dp.getY(i), z = dp.getZ(i), a = Math.atan2(z, x), k = 1 + .07 * Math.sin(a * 9 + y * 3) * Math.max(0, 1 - y / 1.4);
    dp.setXYZ(i, x * k, y, z * k);
  }
  dg.computeVertexNormals();
  const dress = new THREE.Mesh(dg, dressM); dress.position.y = .22; inner.add(dress);
  // 허공에 떠 있는 맨발
  [-1, 1].forEach(s => { const f = new THREE.Mesh(new THREE.CylinderGeometry(.03, .022, .22, 6), skinM); f.position.set(s * .08, .14, .02); f.rotation.x = .25; inner.add(f); });
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, .18, 8), skinM); neck.position.y = 1.8; inner.add(neck);
  const head = new THREE.Group(); head.position.y = 1.95; head.rotation.x = .28; inner.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(.115, 24, 18), faceM); face.scale.set(.88, 1.12, .95); head.add(face);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.128, 18, 14, 0, Math.PI * 2, 0, Math.PI * .62), capM); cap.position.set(0, .015, -.03); cap.rotation.x = -.35; head.add(cap);
  // 길게 늘어진 머리카락 (알파 텍스처 가닥)
  const hair = [];
  const strand = (a, w, L, fwd = 0) => {
    const pg = new THREE.PlaneGeometry(w, L); pg.translate(0, -L / 2, 0);
    const m = new THREE.Mesh(pg, hairM); const r = .125 + fwd;
    m.position.set(Math.sin(a) * r, .07, Math.cos(a) * r); m.rotation.order = 'YXZ'; m.rotation.y = a; m.rotation.x = fwd ? -.24 : -.3; head.add(m); hair.push(m); return m;
  };
  for (let i = 0; i < 22; i++) strand(Math.PI * (.35 + i / 21 * 1.3), .11 + Math.random() * .05, .95 + Math.random() * .5);
  [-.42, -.22, .25, .45].forEach((a, i) => strand(a, .07, .85 + i * .08, .012));   // 얼굴을 가리는 앞머리
  // 팔: 어깨-팔꿈치-손목, 긴 손가락
  const arms = [];
  [-1, 1].forEach(s => {
    const sh = new THREE.Group(); sh.position.set(s * .19, 1.66, .02); inner.add(sh);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(.03, .026, .36, 7), skinM); up.position.y = -.18; sh.add(up);
    const el = new THREE.Group(); el.position.y = -.36; el.rotation.x = -.35; sh.add(el);
    const lo = new THREE.Mesh(new THREE.CylinderGeometry(.025, .018, .34, 7), skinM); lo.position.y = -.17; el.add(lo);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(.05, .09, .022), skinM); hand.position.y = -.38; el.add(hand);
    for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(.0055, .003, .13, 4), skinM); f.position.set(-.018 + k * .012, -.48, 0); f.rotation.z = (k - 1.5) * .06; el.add(f); }
    sh.rotation.set(-.3, 0, s * .08); arms.push(sh);
  });
  // 조명은 그룹 밖(씬)에 항상 둔다 — 보였다 안 보였다 하면 조명 개수가 바뀌어 모든 셰이더가 다시 컴파일되며 크게 끊긴다
  const glow = new THREE.PointLight(0xaa2222, 0, 5); scene.add(glow);
  g.visible = false; scene.add(g);
  return { group: g, inner, head, arms, hair, glow };
}
const ghost = {
  ...buildGhost(), active: false, floor: 1, x: -30, z: 0, yaw: 0, state: 'patrol', path: [], target: null, wait: 2,
  lose: 0, away: 0, replan: 0, enraged: false, stepT: 0, findT: 0, hunt: null, speedMul: 1, spawnGrace: 0,
};

/* ---------- 경로탐색 ---------- */
function findPath(F, ax, az, bx, bz) {
  if (los(F.walls, ax, az, bx, bz)) return [{ x: bx, z: bz }];
  let A = -1, Ad = 1e9, B = -1, Bd = 1e9;
  F.nodes.forEach((n, i) => {
    if (los(F.walls, ax, az, n.x, n.z)) { const d = Math.hypot(ax - n.x, az - n.z); if (d < Ad) { Ad = d; A = i; } }
    if (los(F.walls, bx, bz, n.x, n.z)) { const d = Math.hypot(bx - n.x, bz - n.z); if (d < Bd) { Bd = d; B = i; } }
  });
  if (A < 0 || B < 0) return [{ x: bx, z: bz }];
  const dist = F.nodes.map(() => 1e9), prev = F.nodes.map(() => -1), done = F.nodes.map(() => false);
  dist[A] = 0;
  for (let it = 0; it < F.nodes.length; it++) {
    let u = -1; for (let i = 0; i < dist.length; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] > 1e8) break; done[u] = true;
    for (const v of F.adj[u]) { const w = dist[u] + Math.hypot(F.nodes[u].x - F.nodes[v].x, F.nodes[u].z - F.nodes[v].z); if (w < dist[v]) { dist[v] = w; prev[v] = u; } }
  }
  const out = []; for (let v = B; v >= 0; v = prev[v]) out.unshift({ x: F.nodes[v].x, z: F.nodes[v].z });
  out.push({ x: bx, z: bz });
  // 이미 지나온/직선으로 갈 수 있는 노드는 건너뛴다 (되돌아가며 떨리는 문제)
  while (out.length > 1 && los(F.walls, ax, az, out[1].x, out[1].z)) out.shift();
  return out;
}

function ghostRelocate() {
  const G = ghost, F = floors[P.floor];
  G.floor = P.floor;
  const ends = F.spawns ? F.spawns.slice() : [{ x: -34, z: 0 }, { x: 34, z: 0 }, { x: 0, z: -5.2 }];
  ends.sort((a, b) => Math.hypot(b.x - P.x, b.z - P.z) - Math.hypot(a.x - P.x, a.z - P.z));
  let s = ends[0];
  if (!F.spawns && Math.hypot(ends[2].x - P.x, ends[2].z - P.z) > 14 && !G.enraged && Math.random() < .6) s = ends[2];
  G.x = s.x; G.z = s.z; G.away = 0; G.lose = 0; G.hunt = null; G.spawnGrace = 1.5;
  if (G.enraged) { G.state = 'chase'; G.target = { x: P.x, z: P.z }; } else { G.state = 'search'; G.target = { x: P.x, z: P.z }; G.wait = 0; }
  G.path = findPath(F, G.x, G.z, G.target.x, G.target.z);
  if (P.floor > 0 || P.z < 1.5) sfx.stairs();
}

function ghostStep(tx, tz, speed, dt) {
  const G = ghost, dx = tx - G.x, dz = tz - G.z, d = Math.hypot(dx, dz);
  if (d < 0.05) return true;
  const m = Math.min(d, speed * dt);
  G.x += dx / d * m; G.z += dz / d * m;
  const ty = Math.atan2(dx, dz); let dy = ty - G.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283;
  G.yaw += dy * Math.min(1, dt * 8);
  return d - m < 0.05;
}
function followPath(speed, dt) {
  const G = ghost;
  while (G.path.length && Math.hypot(G.path[0].x - G.x, G.path[0].z - G.z) < 0.25 && G.path.length > 1) G.path.shift();
  if (!G.path.length) return true;
  const last = G.path.length === 1;
  const arrived = ghostStep(G.path[0].x, G.path[0].z, speed, dt);
  if (arrived && last) { G.path.shift(); return true; }
  if (arrived) G.path.shift();
  return false;
}

function ghostTick(dt, t) {
  const G = ghost; if (!G.active) return;
  const F = floors[G.floor];
  const same = G.floor === P.floor;
  const outP = P.floor === 0 && P.z > 1.9;
  const dist = Math.hypot(P.x - G.x, P.z - G.z);
  G.spawnGrace = Math.max(0, G.spawnGrace - dt);

  if (G.lureT > 0) G.lureT -= dt;
  // 다른 층이면 일정 시간 뒤 플레이어 층으로 이동
  if (!same) {
    if (G.lureT > 0) return;
    G.away += dt;
    const wait = G.enraged ? 4.5 : 22 + (G.floor * 3 % 7);
    if (G.away > wait && !(outP && !G.enraged)) ghostRelocate();
    return;
  }
  G.away = 0;

  // 시야 판정
  let sees = false;
  if (!P.hiding && !(outP && !G.enraged)) {
    const range = (P.light ? 20 : 12) * (G.enraged ? 1.5 : 1);
    if (dist < range && los(F.walls, G.x, G.z, P.x, P.z) && los(F.doorWalls || [], G.x, G.z, P.x, P.z)) sees = true;
  }
  // 청각 판정
  if (!P.hiding && !G.hunt && !(outP && !G.enraged) && G.state !== 'chase' && dist < P.noise) {
    G.state = 'search'; G.target = { x: P.x, z: P.z }; G.wait = 0; G.replan = 0;
  }
  if (G.hunt) { /* 사물함으로 직행 */ }
  else if (sees && G.spawnGrace <= 0) {
    if (G.state !== 'chase') { G.state = 'chase'; sfx.alert(); talk('…들켰다! 숨거나, 달려야 해!', 2600); }
    G.target = { x: P.x, z: P.z }; G.lose = 0;
  } else if (G.state === 'chase') {
    G.lose += dt;
    if (G.lose > 4.5) { G.state = 'search'; G.wait = 0; }
  }

  const sp = 1 + Math.min(.25, P.keys * .06);
  let speed = 1.5;
  G.replan -= dt;
  const plan = (tx, tz) => { if (G.replan <= 0 || !G.path.length) { G.path = findPath(F, G.x, G.z, tx, tz); G.replan = .35; } };
  let tgt = G.target;
  if (G.hunt) {
    speed = 3.2 * sp; plan(G.hunt.x, G.hunt.z);
    followPath(speed, dt);
    if (Math.hypot(G.hunt.x - G.x, G.hunt.z - G.z) < 1.3) { if (P.hiding) leaveLocker(true); hit(); return; }
  } else if (G.state === 'chase') {
    speed = (G.enraged ? 3.55 : 2.95) * sp; plan(tgt.x, tgt.z); followPath(speed, dt);
  } else if (G.state === 'search') {
    speed = 2.1; plan(tgt.x, tgt.z);
    const arr = followPath(speed, dt);
    if (arr) { G.wait += dt; if (G.wait > 3) { G.state = 'patrol'; G.path = []; G.wait = 1; } }
  } else { // patrol
    speed = 1.5;
    if (!G.path.length) {
      G.wait -= dt;
      if (G.wait <= 0) {
        const idx = F.nodes.map((n, i) => i).filter(i => !(i === F.entrance));
        idx.sort((a, b) => Math.hypot(F.nodes[a].x - P.x, F.nodes[a].z - P.z) - Math.hypot(F.nodes[b].x - P.x, F.nodes[b].z - P.z));
        const k = Math.random() < .55 ? idx[(Math.random() * 8) | 0] : idx[(Math.random() * idx.length) | 0];
        G.path = findPath(F, G.x, G.z, F.nodes[k].x, F.nodes[k].z); G.wait = 1.5 + Math.random() * 2.5;
      }
    } else followPath(speed, dt);
  }
  // 실외 이동 제약
  if (G.floor === 0) {
    if (!G.enraged && G.z > 1.3) G.z = 1.3;
    if (G.z > 1.8) { const p = { x: G.x, z: G.z }; collide(floors[0].col, p, .4); G.x = p.x; G.z = p.z; }
  }

  // 닫힌 문은 열고 지나간다
  for (const d of world.doorList) {
    if (d.floor !== G.floor || d.target > .5) continue;
    const dz = d.kind === 'slide' ? -1.55 : d.z;
    if (Math.hypot(G.x - d.x, G.z - dz) < 1.3) { d.target = 1; d.slam = true; const dd = Math.hypot(P.x - d.x, P.z - dz); if (G.floor === P.floor && dd < 20) { sfx.doorBang(0, Math.max(.15, 1 - dd / 20)); if (dd < 6) shake = .35; } }
  }
  // 사물함 수색
  if (P.hiding && !G.hunt) {
    const l = P.hiding;
    if (Math.hypot(l.x - G.x, l.z - G.z) < 2.6) { G.findT += dt; if (G.findT > 5.2) { const dr = l.dir || { x: 0, z: 1 }; G.hunt = { x: l.x + dr.x * .6, z: l.z + dr.z * .6 }; } } else G.findT = Math.max(0, G.findT - dt);
  }

  // 붙잡힘
  if (sees && dist < 1.05 && G.spawnGrace <= 0 && P.invuln <= 0) { hit(); return; }

  // 발소리
  G.stepT -= dt * (speed / 1.5);
  if (G.stepT <= 0) { G.stepT = .55; const pan = ((G.x - P.x) * Math.cos(P.yaw) - (G.z - P.z) * Math.sin(P.yaw)) / Math.max(1, dist); sfx.ghostStep(dist, pan); }
}

scene.traverse(o => {
  if (!o.isMesh) return;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  if (m.isMeshBasicMaterial || m.transparent) return;
  o.castShadow = true; o.receiveShadow = true;
});

function ghostVisual(dt, t) {
  const G = ghost; if (!G.active) { G.group.visible = false; G.glow.intensity = 0; return; }
  G.group.visible = G.floor === P.floor && !(P.floor === 0 && P.z > 1.9 && G.z > 1.8 && false);
  G.group.position.set(G.x, floors[G.floor].y0 + .08 + Math.sin(t * 2) * .05, G.z);
  G.group.rotation.y = G.yaw;
  const chasing = G.state === 'chase' || G.hunt;
  G.inner.rotation.z = Math.sin(t * 1.7) * .05;
  G.head.rotation.z = Math.sin(t * .9) * .15 + (chasing ? Math.sin(t * 30) * .06 : 0);
  G.inner.position.x = chasing ? (Math.random() - .5) * .04 : 0;
  G.arms.forEach((a, i) => { a.rotation.x = -.35 + Math.sin(t * (chasing ? 7 : 1.4) + i * 2) * (chasing ? .5 : .12) - (chasing ? .6 : 0); });
  G.glow.position.set(G.x, floors[G.floor].y0 + 1.8, G.z);
  G.glow.intensity = G.group.visible ? .5 + .4 * Math.sin(t * 5) : 0;
  G.hair.forEach((h, i) => { h.rotation.z = Math.sin(t * (chasing ? 6 : 1.3) + i * .7) * (chasing ? .12 : .04); });
}

/* ---------- UI ---------- */
let msgTimer = 0;
function say(text, ms = 3000) { const m = $('msg'); m.textContent = text; m.classList.add('show'); clearTimeout(msgTimer); msgTimer = setTimeout(() => m.classList.remove('show'), ms); }
function refreshHud() {
  $('objText').textContent = P.keys >= TOTAL ? '정문으로 달려가 문을 열어라!' : `정문 열쇠 조각을 모아 학교를 탈출하라 (${P.keys}/${TOTAL})`;
  const subs = KEY_NAMES.map((n, i) => `<div class="${got[i] ? 'done' : ''}">${n} 열쇠 조각 찾기</div>`);
  subs.push(`<div class="${P.roofSeen ? 'done' : ''}">옥상 조사하기</div>`);
  $('subs').innerHTML = subs.join('');
  $('c2').textContent = inv.battery; $('c3').textContent = inv.medkit; $('c4').textContent = docs.length;
  $('s2').classList.toggle('off', !inv.battery); $('s3').classList.toggle('off', !inv.medkit);
}
function toast(title, desc = '', kind = '') {
  const t = document.createElement('div'); t.className = 'toast panel ' + kind; t.innerHTML = `<b>${title}</b>${desc}`;
  $('toasts').appendChild(t); setTimeout(() => t.remove(), 4200);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
}
let talkTimer = 0;
function talk(text, ms = 3200) { $('dlgText').textContent = text; $('dlg').classList.add('show'); clearTimeout(talkTimer); talkTimer = setTimeout(() => $('dlg').classList.remove('show'), ms); }


/* ----- 인벤토리 / 지도 UI ----- */
let invTab = 'items', invSel = 0, mapFloor = 0, uiPrev = 'playing';
const TABS = ['items', 'docs', 'keys'];
function invItems() {
  return [
    { icon: '🔦', name: '손전등', desc: `어두운 곳을 비추는 손전등. 배터리 ${Math.round(P.battery)}% 남음. (F)`, act: ['켜기 / 끄기', () => { P.light = !P.light; }] },
    inv.battery > 0 && { icon: '🔋', name: '건전지', count: inv.battery, desc: '손전등용 건전지. 사용하면 배터리가 45% 회복된다.', act: ['사용하기', useBattery] },
    inv.medkit > 0 && { icon: '🩹', name: '응급 밴드', count: inv.medkit, desc: '상처 치료용 응급 밴드. 사용하면 체력이 50 회복된다.', act: ['사용하기', useMedkit] },
    { icon: '🪪', name: '학생증', img: 'face_relief', desc: '○○대학교 1학년 한서연 (20세). 휴학 중. 사진 속 표정이 지금보다 밝다.' },
    { icon: '📱', name: '스마트폰', img: 'old_class', desc: '액정이 깨졌고 신호가 없다. 마지막으로 받은 사진: 칠판에 적힌 “다시, 여기서.”' },
    { icon: '📻', name: '무전기', desc: '잡음만 들린다. 가끔 누군가 속삭이는 것 같다.' },
    { icon: '📓', name: '노트', desc: '단서를 기록하는 노트. 모은 쪽지는 문서 탭에서 다시 읽을 수 있다.' },
    { icon: '🗺', name: '학교 지도', img: 'map_old', desc: '직접 그린 학교 지도. 목표 위치가 표시되어 있다. (M)', act: ['지도 열기', () => { closeUI(); openMap(); }] },
  ].filter(Boolean);
}
function renderInv() {
  document.querySelectorAll('#inv .tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === invTab));
  const list = $('invList'), det = $('invDetail'); list.className = invTab === 'docs' ? 'docs' : ''; list.innerHTML = ''; det.innerHTML = '';
  if (invTab === 'items') {
    const its = invItems(); invSel = Math.min(invSel, its.length - 1);
    its.forEach((it, i) => { const c = document.createElement('div'); c.className = 'cell' + (i === invSel ? ' sel' : ''); c.innerHTML = it.icon + (it.count ? `<em>${it.count}</em>` : ''); c.onclick = () => { invSel = i; renderInv(); }; list.appendChild(c); });
    const it = its[invSel]; det.innerHTML = `<h3>${it.icon} ${it.name}</h3>${it.desc}${it.img ? `<img class="invImg" src="assets/img/${it.img}.webp" alt="">` : ''}`;
    if (it.act) { const b = document.createElement('button'); b.textContent = it.act[0]; b.onclick = () => { it.act[1](); renderInv(); }; det.appendChild(b); }
  } else if (invTab === 'docs') {
    if (!docs.length) { list.innerHTML = '<p style="color:#8d897d">아직 모은 문서가 없다.</p>'; return; }
    invSel = Math.min(invSel, docs.length - 1);
    docs.forEach((d, i) => { const c = document.createElement('div'); c.className = 'doc' + (i === invSel ? ' sel' : ''); c.textContent = '📄 ' + d.title; c.onclick = () => { invSel = i; renderInv(); }; list.appendChild(c); });
    const d = docs[invSel]; det.innerHTML = `<h3>${d.title}</h3><div class="paper">${d.text}</div>`;
  } else {
    KEY_NAMES.forEach((n, i) => { const c = document.createElement('div'); c.className = 'doc' + (i === invSel ? ' sel' : ''); c.style.opacity = got[i] ? 1 : .45; c.textContent = `🗝 ${n} 열쇠 조각 — ${got[i] ? '획득' : '미획득'}`; c.onclick = () => { invSel = i; renderInv(); }; list.appendChild(c); });
    invSel = Math.min(invSel, TOTAL - 1);
    det.innerHTML = `<h3>정문 열쇠 (${P.keys}/${TOTAL})</h3>사고를 막기 위해 다섯 조각으로 나뉜 정문 열쇠.<br>${KEY_NAMES[invSel]}에서 찾을 수 있다.<br><br>${got[invSel] ? '✔ 이미 획득했다.' : '아직 찾지 못했다. 지도에 목표 위치가 표시되어 있다.'}`;
  }
}
function openUI(kind) { if (state !== 'playing') return; uiPrev = state; state = 'ui'; for (const k in keys) keys[k] = false; $('prompt').style.display = 'none'; $(kind).classList.add('show'); document.exitPointerLock?.(); }
function closeUI() { if (state !== 'ui') return; $('inv').classList.remove('show'); $('mapOv').classList.remove('show'); $('testOv').classList.remove('show'); $('keypad').classList.remove('show'); state = 'playing'; refreshHud(); lock(); }
function openInv(tab = 'items') { if (state !== 'playing') return; invTab = tab; invSel = 0; openUI('inv'); renderInv(); }
function openMap() { if (state !== 'playing') return; mapFloor = P.floor; openUI('mapOv'); renderMap(); }
function mapPins(f) { return KEY_ROOMS.map((r, i) => ({ ...r, i })).filter(r => r.f === f).map(r => ({ x: r.x, z: r.z, done: got[r.i] })); }
function renderMap() {
  document.querySelectorAll('#mapOv .tabs button').forEach(b => b.classList.toggle('on', b.dataset.f === String(mapFloor)));
  const guide = mapFloor === 'guide'; $('bigMap').style.display = guide ? 'none' : 'block'; $('guide').style.display = guide ? 'grid' : 'none';
  if (guide) return;
  const c = $('bigMap'), ctx = c.getContext('2d');
  const V = { 0: [0, 22, 5.2], 5: [38, 19, 22], 6: [-41, 38, 19], 7: [-39, 15, 24], 8: [0, -4, 21], 9: [0, -4, 21], 10: [0, -4, 21] }[mapFloor] || [0, -4, 11];
  drawMap(ctx, c.width, c.height, { floor: mapFloor, cx: V[0], cz: V[1], scale: V[2], labels: true, pins: mapPins(mapFloor), lockers: world.lockers.filter(l => l.floor === mapFloor), player: P.floor === mapFloor ? { x: P.x, z: P.z, yaw: P.yaw } : null });
}
document.querySelectorAll('#inv .tabs button').forEach(b => b.onclick = () => { invTab = b.dataset.tab; invSel = 0; renderInv(); });
document.querySelectorAll('#mapOv .tabs button').forEach(b => b.onclick = () => { mapFloor = b.dataset.f === 'guide' ? 'guide' : +b.dataset.f; renderMap(); });

function useBattery() {
  if (inv.battery <= 0) { toast('건전지가 없습니다', '', 'warn'); return false; }
  if (P.battery >= 95) { say('손전등 배터리는 아직 충분하다', 1800); return false; }
  inv.battery--; P.battery = Math.min(100, P.battery + 45); if (!P.light) P.light = true; sfx.pickup(); toast('건전지를 교체했습니다', '손전등 배터리 회복', 'info'); refreshHud(); return true;
}
function useMedkit() {
  if (inv.medkit <= 0) { toast('응급 밴드가 없습니다', '', 'warn'); return false; }
  if (P.hp >= 100) { say('다친 곳이 없다', 1800); return false; }
  inv.medkit--; P.hp = Math.min(100, P.hp + 50); setFace('face_relief', 3); sfx.paper(); toast('응급 밴드를 사용했습니다', '체력 +50', 'info'); talk('조금 낫네… 계속 가자.', 2400); refreshHud(); return true;
}
function hit() {
  if (TEST && TST.god) return;
  if (P.invuln > 0 || state !== 'playing') return;
  const G = ghost;
  P.hp -= 50; P.invuln = 3.5; shake = 1; setFace('face_surprise', 2.6);
  sfx.screech();
  const h = $('hurt'); h.style.transition = 'none'; h.style.opacity = 1; requestAnimationFrame(() => { h.style.transition = 'opacity 1.4s'; h.style.opacity = 0; });
  if (P.hp <= 0) { P.hp = 0; die(); return; }
  if (P.hiding) leaveLocker(true);
  G.hunt = null; G.state = 'search'; G.spawnGrace = 3.5; G.path = []; G.replan = 0;
  const F = floors[G.floor]; let far = F.nodes[0];
  F.nodes.forEach(n => { if (Math.hypot(n.x - P.x, n.z - P.z) > Math.hypot(far.x - P.x, far.z - P.z)) far = n; });
  G.target = { x: far.x, z: far.z }; G.wait = 0;
  toast('공격당했습니다', '체력이 낮습니다. 응급 밴드가 필요합니다.', 'warn'); talk('윽…! 도망쳐야 해!', 2600);
  refreshHud();
}
function showNote(it) {
  state = 'note'; $('note').innerHTML = `<b style="font-size:19px">${it.title}</b><br><br>${it.text}<small>— 낡은 종이</small>`;
  $('noteBox').classList.add('show'); sfx.paper();
}
function closeNote() { $('noteBox').classList.remove('show'); if (state === 'note') state = 'playing'; }

/* ---------- 상호작용 ---------- */
let target = null;
function findInteract() {
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  let best = null, bs = 0;
  for (const it of world.items) {
    if (it.taken || it.locked || it.floor !== P.floor) continue;
    const dx = it.pos.x - P.x, dz = it.pos.z - P.z, d = Math.hypot(dx, dz);
    if (d > 2.3 || !los(floors[P.floor].walls, P.x, P.z, it.pos.x, it.pos.z) || !los(floors[P.floor].doorWalls || [], P.x, P.z, it.pos.x, it.pos.z)) continue;
    const f = (dx * fx + dz * fz) / Math.max(d, .01);
    const s = f - d * .1; if (f > .72 && s > bs) { bs = s; best = { type: 'item', it, label: it.label }; }
  }
  for (const l of world.lockers) {
    if (l.floor !== P.floor) continue;
    const dx = l.x - P.x, dz = l.z - P.z, d = Math.hypot(dx, dz);
    if (d > 1.7 || !los(floors[P.floor].walls, P.x, P.z, l.x, l.z)) continue; const f = (dx * fx + dz * fz) / Math.max(d, .01);
    const s = f - d * .1; if (f > .35 && s > bs) { bs = s; best = { type: 'locker', l, label: '사물함에 숨기' }; }
  }
  for (const d of world.doorList) {
    if (d.floor !== P.floor) continue;
    const dzc = d.kind === 'slide' ? -1.55 : d.z;
    const dx = d.x - P.x, dz = dzc - P.z, dd = Math.hypot(dx, dz);
    if (dd > (d.kind === 'slide' ? 1.9 : 1.4)) continue;
    const f = (dx * fx + dz * fz) / Math.max(dd, .01), s = f - dd * .15 - .15;
    if (f > .2 && s > bs) { bs = s; best = { type: 'idoor', d, label: (d.target > .5 ? `${d.name} 닫기` : `${d.name} 열기`) }; }
  }
  for (const p of world.props) {
    if (p.floor !== P.floor || p.done) continue;
    const dx = p.x - P.x, dz = p.z - P.z, dd = Math.hypot(dx, dz);
    if (dd > 1.8) continue;
    const f = (dx * fx + dz * fz) / Math.max(dd, .01), s = f - dd * .1 + .1;
    if (f > .1 && s > bs) { bs = s; best = { type: 'prop', p, label: p.label }; }
  }
  if (!best) {
    const si = STAIRS[P.floor];
    const inStair = !si ? false : P.floor === 3 ? (Math.abs(P.x) < 4.5 && P.z < -5.2 && P.z > -9.5) : (() => { const z = floors[P.floor].stairZone || { x1: -1, x2: 4, z1: -9.3, z2: -2 }; return P.x > z.x1 && P.x < z.x2 && P.z > z.z1 && P.z < z.z2; })();
    const dr = world.doors.find(d => d.floor === P.floor && Math.hypot(d.x - P.x, d.z - P.z) < d.r);
    if (inStair) {
      const up = si.up != null, down = si.down != null;
      const ul = si.up === 3 ? '옥상으로' : si.up === 0 ? '1층으로' : '위층', dl = si.down === 4 ? '지하층 (B1)' : '아래층';
      best = { type: 'stairs', label: [up ? `E ${ul}` : '', down ? `Q ${dl}` : ''].filter(Boolean).join('  /  '), raw: true };
    } else if (dr) best = { type: 'door', d: dr, label: dr.label + (dr.need && P.keys < dr.need ? ' 🔒' : '') };
    else if (P.floor === 0 && P.z > GATE_Z - 4.5 && P.z < GATE_Z + 3 && Math.abs(P.x) < 6 && gateClosed && !escaped) best = { type: 'gate', label: '정문 열기' };
  }
  return best;
}
function interact() {
  if (!target) return;
  if (target.type === 'item') {
    const it = target.it;
    if (it.kind === 'note') { readNote(it); return; }
    it.taken = true; it.mesh.visible = false;
    if (it.kind === 'key') {
      got[it.idx] = true; P.keys++; sfx.key(); refreshHud(); setFace(P.keys < TOTAL ? 'face_resolve' : 'face_relief', 3);
      toast('아이템을 획득했습니다', `${KEY_NAMES[it.idx]} 열쇠 조각 (${P.keys}/${TOTAL})`);
      talk(P.keys < TOTAL ? '열쇠 조각이다. 하나 더…' : '마지막 조각이야. 이제 정문으로!', 3000);
      if (P.keys === 1) setTimeout(() => phoneMessage(1), 9000);
      if (P.keys === 1) activateGhost();
      if (P.keys === TOTAL) enrage();
      save(true);
    } else if (it.kind === 'battery') { inv.battery++; sfx.pickup(); toast('아이템을 획득했습니다', '건전지 (2번 키로 사용)'); refreshHud(); }
    else { inv.medkit++; sfx.pickup(); toast('아이템을 획득했습니다', '응급 밴드 (3번 키로 사용)'); refreshHud(); }
  } else if (target.type === 'locker') enterLocker(target.l);
  else if (target.type === 'stairs') changeFloor(1);
  else if (target.type === 'door') {
    const d = target.d;
    if (d.win) {
      if (P.keys < TOTAL) { sfx.click(); say(d.locked, 2800); return; }
      escaped = true; sfx.gateOpen(); say('쇠사슬이 힘없이 끊어졌다…', 3000); winGame(); return;
    }
    if (d.locked) { sfx.click(); say(d.locked, 2600); return; }
    if (d.need && P.keys < d.need) { sfx.click(); say(`굳게 잠겨 있다. 열쇠 조각이 더 필요하다 (${P.keys}/${TOTAL})`, 2600); return; }
    teleport(d.to);
  }
  else if (target.type === 'gate') openGate();
  else if (target.type === 'idoor') toggleDoor(target.d);
  else if (target.type === 'prop') useProp(target.p);
}
function toggleDoor(d, silent) {
  if (d.target > .5) {
    const r = d.rect, m = .33;
    if (P.floor === d.floor && P.x > r.x1 - m && P.x < r.x2 + m && P.z > r.z1 - m && P.z < r.z2 + m) { say('문틀에서 비켜야 닫을 수 있다', 1600); return; }
    d.target = 0;
  } else d.target = 1;
  if (!silent) { d.kind === 'slide' ? sfx.doorSlide() : sfx.doorHinge(); P.noiseT = .6; }
}

function readNote(it) {
  if (!it.taken) { it.taken = true; it.mesh.visible = false; docs.push({ id: it.id, title: it.title, text: it.text }); toast('새로운 문서를 획득했습니다', it.title, 'info'); refreshHud(); }
  showNote(it);
}
function activateGhost() {
  if (ghost.active || (TEST && TST.noGhost)) return;
  ghost.active = true; ghost.floor = P.floor === 2 ? 1 : 2; ghost.x = 20; ghost.z = 0; ghost.state = 'patrol'; ghost.path = []; ghost.wait = 2;
  sfx.bang(0, .9); setTimeout(() => talk('방금… 위층에서 소리가 났어.', 3500), 900);
}
function enrage() {
  if (TEST && TST.noGhost) { blackout = 2; toast('테스트', '유령이 꺼져 있어 최종 추격은 생략됩니다.', 'info'); return; }
  ghost.active = true; ghost.enraged = true; blackout = 3.2;
  setTimeout(() => { ghostRelocate(); ghost.floor = P.floor; sfx.screech(); toast('목표가 갱신되었습니다', '정문으로 달려가라!', 'warn'); talk('그게… 깨어났어. 정문으로 뛰어!', 4000); }, 2600);
}
const STAIRS = { 0: { up: 1, down: 4 }, 1: { up: 2, down: 0 }, 2: { up: 3, down: 1 }, 3: { down: 2 }, 4: { up: 0 }, 8: { up: 9 }, 9: { up: 10, down: 8 }, 10: { down: 9 } };
function teleport(to) {
  if (state !== 'playing') return;
  state = 'trans'; $('fade').style.opacity = 1; sfx.stairs();
  setTimeout(() => {
    P.floor = to.floor; P.x = to.x; P.z = to.z; P.yaw = to.yaw; P.pitch = 0;
    if (to.floor === 3 && !P.roofSeen) { P.roofSeen = true; refreshHud(); toast('목표 달성', '옥상 조사하기', 'info'); setTimeout(() => talk('바람 소리뿐이야… 여기도 누군가 있었어.', 3200), 600); }
    if (to.floor === 4 && !P.b1Seen) { P.b1Seen = true; setTimeout(() => talk('지하…? 이런 곳이 있었다니.', 3000), 600); }
    if (to.floor === 5 && !P.gymSeen) { P.gymSeen = true; setTimeout(() => talk('불 꺼진 체육관… 누가 박수를 치고 있어.', 3400), 600); }
    if (to.floor === 7 && !P.cafeSeen) { P.cafeSeen = true; setTimeout(() => talk('식판이 그대로야… 방금까지 누가 있었던 것처럼.', 3400), 600); }
    if (to.floor === 6 && !P.poolSeen) { P.poolSeen = true; setTimeout(() => talk('물이 없는데… 물소리가 들려.', 3400), 600); }
    $('fade').style.opacity = 0; state = 'playing';
  }, 700);
}
function changeFloor(dir) {
  const info = STAIRS[P.floor]; const nf = info && (dir > 0 ? info.up : info.down); if (nf == null) return;
  const sz = floors[nf].stairZone; teleport(nf === 3 ? { floor: 3, x: 0, z: -7.5, yaw: 0 } : { floor: nf, x: sz ? sz.spawn.x : 2.2, z: sz ? sz.spawn.z : -5.2, yaw: Math.PI });
}
function openGate() {
  if (P.keys < TOTAL) { sfx.click(); say(`자물쇠가 굳게 잠겨 있다. 열쇠 조각이 더 필요하다 (${P.keys}/${TOTAL})`, 2800); return; }
  escaped = true; gateState = 'opening'; sfx.gateOpen(); say('열쇠가 맞물렸다…', 3000);
  gate.blockRect.x1 = 1e9; gate.blockRect.x2 = 1e9 + 1;
  winGame();
}
function winGame() {
  setTimeout(() => { state = 'won'; sfx.win(); $('winText').innerHTML = `당신은 폐교를 빠져나왔다.<br>뒤돌아보지 마라.<br><br>소요 시간 ${Math.floor(playTime / 60)}분 ${Math.floor(playTime % 60)}초`; $('win').classList.add('show'); document.exitPointerLock?.(); }, 3600);
}
const gate = world.gate;

function enterLocker(l) {
  const G = ghost;
  P.hiding = l; sfx.locker();
  const dr = l.dir || { x: 0, z: 1 }; l.yaw = Math.atan2(-dr.x, -dr.z);
  P.x = l.x + dr.x * .12; P.z = l.z + dr.z * .12; P.yaw = l.yaw; P.pitch = 0;
  $('hide').classList.add('show');
  if (G.active && G.floor === P.floor && (G.state === 'chase') && Math.hypot(G.x - P.x, G.z - P.z) < 9 && los(floors[P.floor].walls, G.x, G.z, P.x, P.z)) G.hunt = { x: l.x + dr.x * .6, z: l.z + dr.z * .6 };
  say('숨을 죽여라…  (E 나가기)', 2500);
}
function leaveLocker(silent) {
  const l = P.hiding; if (!l) return;
  const dr = l.dir || { x: 0, z: 1 }; P.hiding = null; $('hide').classList.remove('show'); P.x = l.x + dr.x * .85; P.z = l.z + dr.z * .85; P.yaw = l.yaw; P.pitch = 0;
  ghost.hunt = null; ghost.findT = 0; if (!silent) sfx.locker();
}

/* ---------- 죽음 / 점프스케어 ---------- */
function die() {
  if (state === 'dead' || state === 'won') return;
  state = 'dead';
  const G = ghost;
  G.floor = P.floor; G.state = 'chase';
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  G.x = P.x + fx * .95; G.z = P.z + fz * .95; G.yaw = Math.atan2(-fx, -fz);
  G.group.visible = true; G.arms.forEach(a => a.rotation.x = -1.5);
  if (P.hiding) { P.hiding = null; $('hide').classList.remove('show'); }
  sfx.screech(); shake = 1.2;
  const fl = $('flash'); fl.style.transition = 'none'; fl.style.opacity = .9; requestAnimationFrame(() => { fl.style.transition = 'opacity 1.2s'; fl.style.opacity = 0; });
  $('prompt').style.display = 'none';
  const j = $('jump'); j.classList.remove('show'); void j.offsetWidth; j.classList.add('show');
  setTimeout(() => { $('dead').classList.add('show'); document.exitPointerLock?.(); }, 1900);
}

/* ---------- 이벤트(랜덤 공포 연출) ---------- */
function randomEvent() {
  const r = Math.random();
  const pan = Math.random() * 2 - 1;
  if (r < .35) { sfx.bang(pan, .7); }
  else if (r < .6) { blackout = 1.0 + Math.random() * 1.2; sfx.creak(pan); }
  else if (r < .8) { sfx.whisper(); }
  else { sfx.creak(pan); setTimeout(() => sfx.bang(pan, .5), 700); }
}

/* ---------- 입력 ---------- */
addEventListener('keydown', e => {
  if (e.code === 'Tab') e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (state === 'note' && (e.code === 'KeyE' || e.code === 'Escape' || e.code === 'Space')) { closeNote(); return; }
  if (state === 'ui' && $('keypad').classList.contains('show')) { keypadKey(e); return; }
  if (state === 'ui') {
    if (e.code === 'Tab' || e.code === 'Escape' || e.code === 'KeyI' || e.code === 'KeyM' || e.code === 'KeyT') closeUI();
    else if ($('inv').classList.contains('show') && (e.code === 'KeyQ' || e.code === 'KeyE')) { invTab = TABS[(TABS.indexOf(invTab) + (e.code === 'KeyE' ? 1 : 2)) % 3]; invSel = 0; renderInv(); }
    return;
  }
  if (state !== 'playing') return;
  if (e.code === 'Tab' || e.code === 'KeyI') { openInv(); return; }
  if (e.code === 'KeyM') { openMap(); return; }
  if (TEST && e.code === 'KeyT') { openTest(); return; }
  if (e.code === 'Digit1' || e.code === 'KeyF') { P.light = !P.light; sfx.click(); }
  if (e.code === 'Digit2') useBattery();
  if (e.code === 'Digit3') useMedkit();
  if (e.code === 'Digit4') openInv('docs');
  if (e.code === 'KeyE') { if (P.hiding) leaveLocker(); else interact(); }
  if (e.code === 'KeyQ' && target && target.type === 'stairs') changeFloor(-1);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('mousemove', e => {
  if (state !== 'playing' && state !== 'dead') return;
  if (!document.pointerLockElement && !DEBUG) return;
  if (state === 'dead' || lookBack > 0) return;
  // 포인터 락 직후·창 전환 시 브라우저가 보내는 비정상적으로 큰 값은 무시 (시점이 순간이동하는 문제)
  if (Math.abs(e.movementX) > 220 || Math.abs(e.movementY) > 220) return;
  P.yaw -= e.movementX * .0022; P.pitch = clamp(P.pitch - e.movementY * .0022, -1.45, 1.45);
  if (P.hiding) P.yaw = clamp(P.yaw, P.hiding.yaw - .7, P.hiding.yaw + .7);
});
$('noteBox').addEventListener('click', closeNote);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && (state === 'playing' || state === 'note') && !DEBUG) { if (state === 'note') closeNote(); state = 'paused'; $('pause').classList.add('show'); for (const k in keys) keys[k] = false; }
});
function lock() {
  try { const r = canvas.requestPointerLock({ unadjustedMovement: true }); if (r && r.catch) r.catch(() => { try { const r2 = canvas.requestPointerLock(); if (r2 && r2.catch) r2.catch(() => {}); } catch (e) { /* ignore */ } }); }
  catch (e) { try { canvas.requestPointerLock(); } catch (e2) { /* ignore */ } }
}

/* ---------- 저장 / 불러오기 ---------- */
const SAVE = 'haegyo_save_v3';
function save(silent) {
  if (state === 'dead' || state === 'won') return;
  const d = {
    P: { x: P.x, z: P.z, floor: P.floor, yaw: P.yaw, hp: P.hp, battery: P.battery, stamina: P.stamina, keys: P.keys, light: P.light, roofSeen: P.roofSeen },
    got, inv, docs: docs.map(x => x.id), taken: world.items.map(i => i.taken), gateClosed, introDone, playTime,
    ghost: { active: ghost.active, enraged: ghost.enraged, floor: ghost.floor, x: ghost.x, z: ghost.z },
  };
  try { localStorage.setItem(SAVE, JSON.stringify(d)); toast('저장되었습니다', silent ? '자동 저장' : '', 'info'); } catch (e) { toast('저장 실패', '', 'warn'); }
}
function load() {
  let d; try { d = JSON.parse(localStorage.getItem(SAVE)); } catch (e) { return; }
  if (!d) return;
  Object.assign(P, d.P); got.splice(0, TOTAL, ...d.got); inv.battery = d.inv.battery; inv.medkit = d.inv.medkit;
  docs.length = 0; d.docs.forEach(id => { const n = world.NOTES[id]; if (n) docs.push({ id, title: n.title, text: n.text }); });
  world.items.forEach((it, i) => { if (d.taken[i]) { it.taken = true; it.mesh.visible = false; } });
  introDone = d.introDone; playTime = d.playTime;
  if (d.gateClosed) { gateClosed = true; gateState = 'closed'; gateAnim = 1; gate.setOpen(0); }
  if (d.ghost.active) { Object.assign(ghost, d.ghost, { state: 'patrol', path: [], wait: 2 }); }
  refreshHud(); toast('불러오기 완료', '', 'info');
}

function start(skipIntro = false) {
  initAudio(); $('menu').classList.remove('show');
  refreshHud();
  if (skipIntro || TEST) { finishIntro(); return; }
  state = 'intro'; introT = 0; $('intro').classList.add('show');
}
function finishIntro() {
  $('intro').classList.remove('show'); $('introTitle').classList.remove('show'); $('hud').classList.add('show');
  P.x = 0; P.z = 77.5; P.yaw = 0; P.pitch = 0; state = 'playing';
  setTimeout(() => talk('무서워도… 가야지. 누군가는 알아야 하니까.', 4200), 500);
}
// 인트로: 검은 화면 텍스트(0~6초) → 폐교를 향한 카메라 돌리(6~13초)
function updateIntro(dt) {
  introT += dt * (DEBUG && window.__introJump ? 6 : 1);
  const ease = t => t * t * (3 - 2 * t);
  if (introT < 6) { camera.position.set(0, 10, 106); camera.rotation.set(-.1, 0, 0, 'YXZ'); }
  else {
    if ($('intro').classList.contains('show')) { $('intro').classList.remove('show'); $('introTitle').classList.add('show'); }
    const k = ease(clamp((introT - 6) / 7, 0, 1));
    camera.position.set(Math.sin(introT * .3) * .4 * (1 - k), lerp(10, 1.62, k), lerp(106, 77.5, k));
    camera.rotation.set(lerp(-.1, 0, k), 0, 0, 'YXZ');
    if (introT > 10) $('introTitle').classList.remove('show');
  }
  updateLighting(dt);
  if (introT > 13.2) finishIntro();
}
addEventListener('keydown', e => { if (state === 'intro' && ['Space', 'Enter', 'Escape'].includes(e.code)) finishIntro(); });
$('intro').addEventListener('click', () => { if (state === 'intro') finishIntro(); });
$('startBtn').addEventListener('click', () => { try { localStorage.removeItem(SAVE); } catch (e) { /* ignore */ } lock(); start(); });
$('helpBtn').addEventListener('click', () => $('helpBox').classList.toggle('show'));
$('loadBtn').addEventListener('click', () => { lock(); start(true); load(); });
$('saveBtn').addEventListener('click', () => save());
$('titleBtn').addEventListener('click', () => location.reload());
try { if (localStorage.getItem(SAVE)) $('loadBtn').style.display = 'block'; } catch (e) { /* ignore */ }
$('resumeBtn').addEventListener('click', () => { lock(); $('pause').classList.remove('show'); state = 'playing'; });
$('retryBtn').addEventListener('click', () => location.reload());
$('againBtn').addEventListener('click', () => location.reload());

/* ---------- 업데이트 ---------- */
const _v = new THREE.Vector3();
function updatePlayer(dt) {
  const F = floors[P.floor];
  const fw = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const sd = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  P.moving = false; P.sprinting = false;
  if (lookBack > 0) {
    lookBack -= dt; let dy = Math.PI - P.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283;
    P.yaw += dy * Math.min(1, dt * 5); P.pitch = lerp(P.pitch, .04, Math.min(1, dt * 5));
  } else if (!P.hiding && state === 'playing') {
    const want = !!(fw || sd);
    const wantRun = (keys.ShiftLeft || keys.ShiftRight) && want && !P.tired && P.stamina > 0;
    if (wantRun) { P.sprinting = true; P.stamina = Math.max(0, P.stamina - 20 * dt); if (P.stamina <= 0) P.tired = true; }
    else { P.stamina = Math.min(100, P.stamina + (want ? 9 : 18) * dt); if (P.tired && P.stamina > 30) P.tired = false; }
    if (want) {
      const sp = P.sprinting ? 5.0 : 2.8;
      const l = Math.hypot(fw, sd) || 1;
      const dx = (-Math.sin(P.yaw) * fw + Math.cos(P.yaw) * sd) / l, dz = (-Math.cos(P.yaw) * fw - Math.sin(P.yaw) * sd) / l;
      const ox = P.x, oz = P.z;
      // 한 프레임 이동을 짧은 구간으로 나눠 충돌을 처리한다 (프레임이 길어도 벽을 넘거나 튀지 않게)
      const tot = sp * dt, n = Math.max(1, Math.ceil(tot / .06));
      for (let i = 0; i < n; i++) {
        P.x += dx * tot / n; P.z += dz * tot / n;
        collide(F.col, P, .32);
        if (P.floor === 0 && gateClosed) collide([gate.blockRect], P, .32);
      }
      const mv = Math.hypot(P.x - ox, P.z - oz);
      P.moving = mv > .0005; P.bob += mv * (P.sprinting ? 2.4 : 2.9); P.stepD += mv;
      if (P.stepD > (P.sprinting ? 1.9 : 1.45)) { P.stepD = 0; sfx.step(P.sprinting); }
    } else P.stepD = 0;
  } else if (P.hiding) P.stamina = Math.min(100, P.stamina + 25 * dt);
  P.noiseT = Math.max(0, (P.noiseT || 0) - dt);
  P.noise = P.hiding ? 0 : P.noiseT > 0 ? 9 : P.sprinting ? 15 : P.moving ? 5.5 : 0;

  // 정문 닫힘 연출
  if (!gateClosed && state === 'playing' && P.z < GATE_Z - 3) {
    gateClosed = true; gateState = 'closing'; sfx.gateClang(); shake = .8; if (P.z > GATE_Z - 8) lookBack = 1.9;
    setTimeout(() => { toast('새로운 목표가 추가되었습니다', `정문 열쇠 조각 ${TOTAL}개를 찾아라`, 'warn'); talk('문이 잠겼어… 열쇠를 찾아야 해.', 4200); }, 800);
  }
  if (!introDone && P.floor === 0 && P.z < 1.2) { introDone = true; talk('안은 숨소리까지 들릴 만큼 조용해…', 3500); setTimeout(() => toast('팁', '쪽지를 읽고, 사물함에 숨어 시선을 피하세요. (Tab: 인벤토리, M: 지도)', 'info'), 1500); }

  P.invuln = Math.max(0, P.invuln - dt);
  if (!P.bcast && P.floor === 2 && Math.abs(P.x + 24) < 3.8 && P.z < -2) { P.bcast = true; sfx.broadcast(); toast('교내 방송', '“…모두 교실로 돌아가세요.”', 'warn'); setTimeout(() => talk('스피커가… 켜졌어? 전원도 안 들어오는데.', 3600), 900); }
  // 손전등/배터리
  if (P.light && P.battery > 0) P.battery = Math.max(0, P.battery - .75 * dt);
  if (P.battery <= 0 && P.light) { if (inv.battery > 0) useBattery(); else { P.light = false; toast('손전등이 꺼졌습니다', '건전지가 없습니다.', 'warn'); } }
}

function updateGate(dt) {
  if (gateState === 'closing') { gateAnim = Math.min(1, gateAnim + dt / .9); gate.setOpen(1 - easeOut(gateAnim)); if (gateAnim >= 1) { gateState = 'closed'; gate.setOpen(0); } }
  else if (gateState === 'opening') { gateAnim = Math.max(0, gateAnim - dt / 3); gate.setOpen(1 - easeOut(gateAnim)); }
  gate.lockParts.forEach(m => { m.visible = gateState === 'closed'; });
}
const easeOut = t => 1 - Math.pow(1 - t, 3);

function updateLighting(dt) {
  const F = floors[P.floor];
  const indoors = P.floor >= 4 || (P.floor > 0 && P.floor < 3) || (P.floor === 0 && P.z < 1.45 && P.z > -9.9 && Math.abs(P.x) < 36.3);
  const k = Math.min(1, dt * 3);
  moonLight.intensity = lerp(moonLight.intensity, indoors ? 0 : 1.6, k);
  hemi.intensity = lerp(hemi.intensity, indoors ? .2 : .68, k);
  fillLight.intensity = lerp(fillLight.intensity, indoors ? 0 : .85, k);
  scene.fog.density = lerp(scene.fog.density, indoors ? .05 : .014, k);
  scene.fog.color.lerp(indoors ? FOG_IN : FOG_OUT, k);
  floors.forEach(f => { f.interior.visible = f.f === P.floor; if (f.f <= 2) f.shell.visible = P.floor <= 3; });
  world.OUT.visible = P.floor === 0 || P.floor === 3 || state === 'menu' || state === 'intro';
  // 형광등 풀: 가장 가까운 켜진 램프 4개에 PointLight 배치
  lampTimer -= dt;
  if (lampTimer <= 0) {
    lampTimer = .2;
    const c = F.lamps.filter(l => l.kind !== 'dead').map(l => ({ l, d: Math.hypot(l.x - P.x, l.z - P.z) })).filter(o => o.d < 16).sort((a, b) => a.d - b.d).slice(0, 4);
    pool.forEach((p, i) => { const o = c[i]; if (o) { p.position.set(o.l.x, o.l.y, o.l.z); p.userData.kind = o.l.kind; p.userData.on = true; } else p.userData.on = false; });
  }
  pool.forEach((p, i) => {
    if (!p.userData.on || blackout > 0 || !indoors) { p.intensity = 0; return; }
    const fl = p.userData.kind === 'flick' ? (Math.sin(tNow * (10 + i * 3)) * Math.sin(tNow * 23 + i) > .1 ? 1 : .1) : 1;
    p.intensity = 7 * fl;
  });
  // 손전등
  const near = ghost.active && ghost.floor === P.floor ? clamp(1 - Math.hypot(ghost.x - P.x, ghost.z - P.z) / 9, 0, 1) : 0;
  let fi = P.light && P.battery > 0 ? 95 : 0;
  if (P.battery < 15 && fi) fi *= Math.random() < .1 ? .1 : .85;
  if (near > .4 && fi && Math.random() < near * .12) fi = 0;
  flash.intensity = fi;
}

let beatT = 0, camShakeT = 0;
function updateCamera(dt, t) {
  const F = floors[P.floor];
  const bob = Math.sin(P.bob) * (P.sprinting ? .05 : .028);
  let ey = P.hiding ? 1.45 : 1.62 + bob;
  camera.position.set(P.x, F.y0 + ey, P.z);
  let yaw = P.yaw, pitch = P.pitch;
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.4); yaw += (Math.random() - .5) * .05 * shake; pitch += (Math.random() - .5) * .05 * shake; }
  const G = ghost; let prox = 0, chase = false;
  if (G.active && G.floor === P.floor) { prox = clamp(1 - Math.hypot(G.x - P.x, G.z - P.z) / 14, 0, 1); chase = G.state === 'chase' || !!G.hunt; }
  if (state === 'dead') { const dx = G.x - P.x, dz = G.z - P.z; yaw = Math.atan2(-dx, -dz); pitch = .1; }
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  const fov = 72 + (P.sprinting ? 6 : 0) + (chase ? 4 : 0) + (state === 'dead' ? -10 : 0);
  camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 6)); camera.updateProjectionMatrix();
  $('fear').style.opacity = clamp(prox * (chase ? 1.2 : .7), 0, 1);
  setProximity(prox * (chase ? 1 : .6), t);
  // 심장박동
  if (state === 'playing' && (prox > .25 || chase)) {
    beatT -= dt; if (beatT <= 0) { sfx.heartbeat(.5 + prox * .5); beatT = lerp(1.15, .45, prox); }
  }
  // 체력/배터리 바
  updateHud(dt, prox, chase);
  
}


let miniT = 0;
/* ---------- 레퍼런스 이미지: 표정 / 장소 컷 / 자료집 ---------- */
let faceOver = null, faceT = 0, curFace = '';
function setFace(k, t) { faceOver = k; faceT = t; }
function updateFace(dt) {
  faceT -= dt;
  const want = faceT > 0 ? faceOver : P.fear > .6 ? 'face_fear' : P.hp <= 50 ? 'face_resolve' : 'face_basic';
  if (want !== curFace) { curFace = want; $('portrait').src = $('dlgFace').src = `assets/img/${want}.webp`; }
}
// [이미지, 제목, 설명, 폐교 전 사진 여부]
const CARDS = {
  gate: ['gate_night', '폐교 정문', '버려진 시간 속, 멈춘 교실의 풍경'], corridor: ['v_corridor', '본관 복도', '끝이 보이지 않는 복도. 발소리가 두 번 울린다.'],
  class: ['old_class', '교실', '칠판에는 아직 “다시, 여기서.”'], office: ['old_office', '교무실', '서류 더미 사이, 누군가 막 일어난 듯한 의자'],
  library: ['v_library', '도서실', '대출 카드의 이름은 모두 같다'], lab: ['v_lab', '과학실', '불을 끄지 마'], music: ['v_music', '음악실', '피아노 뚜껑이 열려 있다'],
  art: ['v_art', '미술실', '캔버스 속 얼굴들이 이쪽을 본다'], computer: ['v_computer', '컴퓨터실', '꺼진 모니터에 비친 실루엣'], nurse: ['v_nurse', '보건실', '침대 시트가 아직 따뜻하다'],
  toilet: ['v_toilet', '화장실', '거울에 금이 가 있다'], stair: ['v_stairs', '중앙 계단', '위층에서 무언가 끌리는 소리'], broadcast: ['bc_main', '방송실', '아직 꺼지지 않은 목소리'],
  roof: ['v_roof', '옥상', '가장 높은 곳, 여전히 바람이 부는 공간'], b1: ['b1_corr', '지하층 B1', '아무도 오지 않는, 더 깊은 곳'],
  gym: ['gym_full', '체육관', '먼지 낀 코트 위에 공 하나가 굴러간다'], gymStage: ['gym_stage', '체육관 무대', '커튼 뒤에서 박수 소리가 들렸다'],
  pool: ['pool_main', '수영장 (폐쇄)', '물이 빠진 채 조용히 남아있는 수영장'], poolLocker: ['pool_locker', '탈의실', '폐교 전 사진 — 누군가의 사물함이 아직 잠겨 있다', 1],
  cafe: ['cafe_hall', '급식실', '폐교 전 사진 — 한 명분이 모자란 식판', 1], annex: ['annex_ext', '별관 (특별교실동)', '폐교 전 사진 — 다양한 꿈과 재능을 키우던 곳', 1],
  annexOut: ['annex_ext', '별관 (특별교실동)', '폐교 전 사진 — 본관 뒤편의 특별교실동', 1], westGate: ['west_gate', '서문', '폐교 전 사진 — 행복한 배움, 함께 만드는 미래', 1],
};
Object.values(CARDS).forEach(c => { const im = new Image(); im.src = `assets/img/${c[0]}.webp`; });
['face_fear', 'face_resolve', 'face_surprise', 'face_relief'].forEach(k => { const im = new Image(); im.src = `assets/img/${k}.webp`; });
const seenCards = new Set(); let cardTimer = 0, areaT = 0;
function showCard(k) {
  if (seenCards.has(k)) return; seenCards.add(k);
  const c = CARDS[k]; if (!c) return;
  const el = $('card'); el.querySelector('img').src = `assets/img/${c[0]}.webp`;
  el.querySelector('b').textContent = c[1]; el.querySelector('span').textContent = c[2];
  el.classList.toggle('old', !!c[3]); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(cardTimer); cardTimer = setTimeout(() => el.classList.remove('show'), 4600);
}
function areaCheck(dt) {
  areaT -= dt; if (areaT > 0) return; areaT = .3;
  const f = P.floor; let k = null;
  if (f === 5) k = P.z < 15.5 ? 'gymStage' : 'gym';
  else if (f === 6) k = P.z < 30.2 ? 'poolLocker' : 'pool';
  else if (f === 7) k = 'cafe'; else if (f === 3) k = 'roof';
  else if (f === 0 && !(P.z < 1.45 && P.z > -9.9 && Math.abs(P.x) < 36.3)) {
    if (P.z > 60) k = 'gate'; else if (P.x < -40 && Math.abs(P.z - 32) < 9) k = 'westGate'; else if (Math.abs(P.x) < 22 && P.z < -10.5) k = 'annexOut';
  } else if (f <= 2 || f === 4 || f >= 8) {
    const an = f >= 8, sl = an ? ANNEX.slots : SLOTS, lay = an ? ANNEX.floors[f - 8] : LAYOUT[f];
    if (P.z > -1.75) k = f === 4 ? 'b1' : an ? 'annex' : 'corridor';
    else { const i = sl.findIndex(c => Math.abs(P.x - c) < 4); if (i >= 0) k = lay.types[i]; }
  }
  if (k) showCard(k);
}
const REF_TITLES = ['폐교 실내 공간 3D 모델링 시트', '폐교 정문 3D 배경 시트', '교실 소품 오브젝트 시트', '폐교 내부 3D 배치도', '폐교 배치도 / 건물 도면', '주인공 캐릭터 시트', '인게임 화면 · UI 구성', '특수 공간 상세 배치도', '상호작용 UI 시트', '체육관 내부 시트', '방송실 내부 배치', '수영장 내부 배치', '방송실 · 수영장 · 지하 B1', '학교 지도', '급식실 배치도', '별관 (특별교실동)', '서문 상세 안내도', '방송실 상세 배치도', '수영장 샤워실 · 탈의실'];
function openGallery() {
  const gw = $('galGrid'); if (!gw.children.length) REF_TITLES.forEach((t, i) => {
    const n = String(i + 1).padStart(2, '0'), d = document.createElement('figure');
    d.innerHTML = `<img src="assets/ref/${n}_t.webp" alt="" loading="lazy"><figcaption>${i + 1}. ${t}</figcaption>`;
    d.onclick = () => { $('lbImg').src = `assets/ref/${n}.webp`; $('lbCap').textContent = `${i + 1}. ${t}`; $('lightbox').classList.add('show'); };
    gw.appendChild(d);
  });
  $('gallery').classList.add('show');
}
$('galBtn').addEventListener('click', openGallery); $('galBtn2').addEventListener('click', openGallery);
$('galClose').addEventListener('click', () => $('gallery').classList.remove('show'));
$('lightbox').addEventListener('click', () => $('lightbox').classList.remove('show'));

function updateHud(dt, prox, chase) {
  updateFace(dt); if (state === 'playing') areaCheck(dt);
  P.fear = lerp(P.fear, clamp(prox * (chase ? 1.2 : .7), 0, 1), Math.min(1, dt * 3));
  $('hpBar').style.width = P.hp + '%'; $('hpBar').style.background = P.hp > 50 ? '#5fc47a' : '#d0583c';
  $('sta').style.width = P.stamina + '%'; $('sta').style.background = P.tired ? '#a85040' : '#5a9ac8';
  $('fearBar').style.width = P.fear * 100 + '%';
  const st = $('stat'); st.textContent = P.hp > 50 ? (P.fear > .6 ? '공포' : '정상') : '부상'; st.style.color = P.hp > 50 ? (P.fear > .6 ? '#e86870' : '#6fd08c') : '#e0884c';
  $('batBar').style.width = P.battery + '%'; $('s1').classList.toggle('off', !P.light);
  const outdoors = P.floor === 0 && !(P.z < 1.45 && P.z > -9.9 && Math.abs(P.x) < 36.3);
  $('floor').textContent = P.floor === 0 && outdoors ? '외부' : AREA_NAMES[P.floor];
  const m = Math.floor(23 * 60 + 40 + playTime / 6), h24 = Math.floor(m / 60) % 24;
  $('clock').textContent = `${h24 >= 12 ? 'PM' : 'AM'} ${String(h24 % 12 || 12).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  miniT -= dt;
  if (miniT <= 0) {
    miniT = .1; const c = $('miniMap'), g = c.getContext('2d');
    g.save(); g.beginPath(); g.arc(75, 75, 75, 0, 6.3); g.clip();
    drawMap(g, 150, 150, { floor: P.floor, cx: P.x, cz: P.z, scale: 2.6, pins: mapPins(P.floor), player: { x: P.x, z: P.z, yaw: P.yaw } });
    g.restore();
  }
}

function updatePrompt() {
  const pr = $('prompt');
  if (state !== 'playing') { pr.style.display = 'none'; return; }
  if (P.hiding) { pr.style.display = 'block'; pr.textContent = 'E  사물함에서 나가기'; return; }
  target = findInteract();
  if (target) { pr.style.display = 'block'; pr.textContent = target.raw ? target.label : `E  ${target.label}`; } else pr.style.display = 'none';
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(.066, Math.max(0, (now - last) / 1000)); last = now; tNow += dt;
  perfTick(dt);
  if (state === 'playing' || state === 'trans' || state === 'dead') {
    if (state === 'playing') playTime += dt;
    if (state !== 'dead') updatePlayer(dt);
    updateGate(dt);
    if (blackout > 0) blackout -= dt;
    if (state === 'playing') {
      ghostTick(dt, tNow);
      // 랜덤 이벤트
      if (introDone && ghost.active) { nextEvent -= dt; if (nextEvent <= 0) { nextEvent = 25 + Math.random() * 30; randomEvent(); } }
      updatePrompt();
      updateEvents(dt);
    }
    updateLighting(dt);
    ghostVisual(dt, tNow);
    updateCamera(dt, tNow);
  } else if (state === 'intro') {
    updateIntro(dt);
  } else if (state === 'menu') {
    camera.position.set(Math.sin(tNow * .1) * 3, 2.2, 74); camera.rotation.set(-.05, Math.sin(tNow * .1) * .1, 0, 'YXZ');
    updateLighting(dt);
  }
  world.update(tNow, blackout > 0);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);


/* ---------- 퍼즐 · 장치 ---------- */
let power = false, consoleCD = 0, kpBuf = '', kpProp = null;
function useProp(p) {
  if (p.kind === 'safe') {
    if (p.open > 0) return;
    kpProp = p; kpBuf = ''; renderKeypad(); openUI('keypad'); sfx.beep();
  } else if (p.kind === 'breaker') {
    p.on = true; p.done = true; power = true; sfx.breaker(); shake = .5; P.noiseT = 2.5;
    toast('전력이 복구되었습니다', '3층 방송실 장비를 쓸 수 있다. 큰 소리가 났다…', 'warn');
    talk('불이… 들어왔어. 근데 소리가 너무 컸어.', 3200);
    if (ghost.active && ghost.floor === P.floor) { ghost.state = 'search'; ghost.target = { x: P.x, z: P.z }; ghost.wait = 0; ghost.replan = 0; }
  } else if (p.kind === 'console') {
    if (!power) { sfx.click(); say('전원이 들어오지 않는다. 어딘가의 차단기를 올려야 한다.', 2800); return; }
    if (consoleCD > 0) { sfx.buzz(); say(`장비가 과열됐다… (${Math.ceil(consoleCD)}초)`, 2000); return; }
    consoleCD = 90; sfx.broadcast(); setTimeout(() => sfx.broadcast(), 1600);
    toast('교내 방송', '학교 전체에 소리가 울렸다. 그것이 방송실로 향한다 (25초)', 'warn');
    talk('지금이야… 여기서 빨리 벗어나야 해.', 3200);
    if (ghost.active) { ghost.floor = 2; ghost.x = -24; ghost.z = -5.5; ghost.state = 'search'; ghost.target = { x: -24, z: -5.5 }; ghost.path = []; ghost.lureT = 25; ghost.spawnGrace = 2; ghost.hunt = null; }
  }
}
function renderKeypad() {
  const d = $('kpDisp'); d.textContent = (kpBuf + '____').slice(0, 4).split('').join(' '); d.className = '';
}
function keypadPress(k) {
  if (k === 'C') { kpBuf = ''; sfx.beep(); renderKeypad(); return; }
  if (k === 'OK') return keypadCheck();
  if (kpBuf.length < 4) { kpBuf += k; sfx.beep(); renderKeypad(); if (kpBuf.length === 4) setTimeout(keypadCheck, 250); }
}
function keypadCheck() {
  if (kpBuf === '1012') {
    $('kpDisp').textContent = 'O P E N'; $('kpDisp').className = 'ok'; sfx.unlock();
    setTimeout(() => { closeUI(); kpProp.opening = true; kpProp.done = true; kpProp.key.locked = false; kpProp.key.mesh.visible = true; toast('금고가 열렸다', '안에 열쇠 조각이 있다'); talk('10월 12일… 마지막 졸업식 날.', 3000); }, 700);
  } else {
    $('kpDisp').textContent = 'E R R'; $('kpDisp').className = 'err'; sfx.buzz(); kpBuf = '';
    setTimeout(renderKeypad, 700);
    if (!kpProp.hinted) { kpProp.hinted = true; setTimeout(() => talk('비밀번호… 교무회의록에 힌트가 있었던 것 같은데.', 3000), 900); }
  }
}
function keypadKey(e) {
  if (e.code === 'Escape' || e.code === 'Tab') { closeUI(); return; }
  if (/^(Digit|Numpad)\d$/.test(e.code)) keypadPress(e.code.slice(-1));
  else if (e.code === 'Backspace') { kpBuf = kpBuf.slice(0, -1); renderKeypad(); }
  else if (e.code === 'Enter' || e.code === 'NumpadEnter') keypadCheck();
}
document.querySelectorAll('#kpGrid button').forEach(b => b.onclick = () => keypadPress(b.dataset.k));
$('kpClose').onclick = () => closeUI();

/* ---------- 스크립트 이벤트 ---------- */
// 환영: 유령과 같은 모델이지만 해치지 않는다. 잠깐 보였다 사라진다.
const appar = ghost.group.clone(true); appar.visible = false; scene.add(appar);
let apparT = 0, apparWatch = null;
function showApparition(f, x, z, yaw, dur, watch) { appar.position.set(x, floors[f].y0 + .08, z); appar.rotation.y = yaw; appar.visible = true; appar.userData.floor = f; apparT = dur; apparWatch = watch || null; }
const EV = { done: new Set(), t: 0, inRoom: null, roomT: 0, slamCD: 60, b33T: 0, b33: 0, corrT: 0 };
const evOnce = (id, fn) => { if (EV.done.has(id)) return false; EV.done.add(id); fn(); return true; };
function roomAt(f, x, z) {
  if (z > -1.8) return null;
  const an = f >= 8 && f <= 10, sl = an ? ANNEX.slots : SLOTS, lay = an ? ANNEX.floors[f - 8] : LAYOUT[f];
  if (!lay || (f > 4 && !an)) return null;
  const i = sl.findIndex(c => Math.abs(x - c) < 4); if (i < 0) return null;
  return { type: lay.types[i], name: lay.names[i], cx: sl[i], id: f + ':' + i };
}
function phoneMessage(n) {
  if (state !== 'playing') return;
  sfx.phone(); toast('📱 새 메시지 1건', '발신자: 알 수 없음', 'info');
  const msg = n === 1 ? '“3층 방송실. 그 방송, 나도 들었어. 거기서 기다릴게.”' : '“늦었어. 이번엔 꼭… 다시, 여기서.”';
  setTimeout(() => { if (state === 'playing') { talk('메시지…? 신호도 안 잡히는데.', 2600); setTimeout(() => state === 'playing' && showNote({ title: '📱 새 메시지', text: msg + '<br><br><small style="color:#6a6048">보낸 시각: 10년 전 오늘 23:40</small>' }), 1400); } }, 1200);
}
function updateEvents(dt) {
  if (consoleCD > 0) consoleCD -= dt;
  for (const p of world.props) if (p.kind === 'safe' && p.opening && p.open < 1) p.open = Math.min(1, p.open + dt * 1.2);
  // 환영 처리: 손전등으로 바라보면 사라진다
  if (appar.visible) {
    apparT -= dt;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), dx = appar.position.x - P.x, dz = appar.position.z - P.z, d = Math.hypot(dx, dz);
    const look = (dx * fx + dz * fz) / Math.max(d, .01) > .93;
    if (apparWatch === 'look' && look) { apparWatch = 'seen'; apparT = .45; sfx.screech(); shake = .6; }
    if (apparT <= 0 || appar.userData.floor !== P.floor) { appar.visible = false; if (apparWatch === 'seen') { blackout = .4; } }
  }
  EV.t -= dt; if (EV.t > 0) return; EV.t = .2; const step = .2;
  const f = P.floor, room = roomAt(f, P.x, P.z);
  // 방에 들어온 시간
  if (room && EV.inRoom === room.id) EV.roomT += step; else { EV.inRoom = room ? room.id : null; EV.roomT = 0; }
  EV.slamCD -= step;
  // ① 문이 저절로 닫힌다
  if (room && EV.roomT > 3.5 && EV.slamCD <= 0 && P.z < -3) {
    const d = world.doorList.find(o => o.kind === 'slide' && o.floor === f && Math.abs(o.x - room.cx) < .1 && o.target > .5);
    if (d && Math.random() < .35) { d.target = 0; d.slam = true; sfx.doorBang(0, .9); shake = .45; EV.slamCD = 100 + Math.random() * 80; setTimeout(() => talk('문이… 저절로 닫혔어.', 2400), 500); }
    else EV.slamCD = 8;
  }
  // ② 음악실 피아노
  if (room && room.type === 'music') evOnce('piano' + f, () => { sfx.piano(); setTimeout(() => talk('피아노가… 혼자 울리고 있어.', 2800), 1200); });
  // ③ 화장실 칸막이 문이 쾅
  if (room && room.type === 'toilet' && EV.roomT > 1.4) evOnce('stall', () => { const d = world.doorList.find(o => o.stall && o.floor === f && o.target > .5); if (d) { d.target = 0; d.slam = true; } sfx.doorBang(-.3, 1); shake = .4; setTimeout(() => talk('…누구 있어요?', 2000), 600); });
  // ④ 3-3 교실: 뒤를 봐
  const br = world.boardRefs.b33;
  if (br && room && f === br.floor && room.cx === br.cx) {
    const fz = -Math.cos(P.yaw);
    if (EV.b33 === 0 && EV.roomT > 1.5 && fz > .55) { EV.b33T += step; if (EV.b33T > .8) { EV.b33 = 1; br.mat.map = world.makeBoardTex(['뒤 를 봐']); br.mat.needsUpdate = true; sfx.creak(); } }
    if (EV.b33 === 1 && fz < -.6) { EV.b33 = 2; showApparition(f, br.cx, -8.2, 0, 3, 'look'); }
  }
  // ⑤ 복도 끝의 그림자 (유령이 깨어나기 전 복선)
  if (!ghost.active && (f === 0 || f === 1) && Math.abs(P.z) < 1.3 && Math.abs(P.x) < 30 && playTime > 25) {
    EV.corrT += step;
    if (EV.corrT > 6) evOnce('corr' + f, () => {
      const fx = -Math.sin(P.yaw), sx = P.x + Math.sign(fx || 1) * 15;
      if (Math.abs(fx) > .7 && Math.abs(sx) < 34) { showApparition(f, sx, 0, Math.atan2(P.x - sx, 0), 1.8, null); sfx.whisper(); if (P.light) blackout = .25; }
      else EV.done.delete('corr' + f);
    });
  }
  // ⑥ 2층 첫 진입: 정전 + 다가오는 발소리
  if (f === 1 && Math.abs(P.z) < 1.4) evOnce('lights1', () => {
    setTimeout(() => { if (state !== 'playing') return; sfx.lightsOff(); blackout = 4.2; [14, 10, 7, 4.5, 3].forEach((d, i) => setTimeout(() => sfx.ghostStep(d, .4), 700 + i * 550)); setTimeout(() => talk('…방금 그거, 발소리였어?', 2600), 4400); }, 1500);
  });
  // ⑦ 체육관 · 수영장 · 급식실 입장
  if (f === 5) evOnce('gym', () => { sfx.ball(); setTimeout(() => talk('공이… 굴러왔어. 아무도 없는데.', 2800), 2400); });
  if (f === 6) evOnce('pool', () => { sfx.drip(); setTimeout(() => { sfx.splash(); talk('물이 없는데… 물소리가 나.', 2800); }, 5200); });
  // ⑧ 방송실 도착 시 두 번째 메시지
  if (room && room.type === 'broadcast') evOnce('bcMsg', () => setTimeout(() => phoneMessage(2), 4000));
}

/* ---------- 성능 / 그래픽 품질 ---------- */
const QUAL = { high: { pr: 1.5, sh: 1024, label: '높음' }, mid: { pr: 1, sh: 512, label: '보통' }, low: { pr: .75, sh: 0, label: '낮음' } };
let qMode = 'auto', qCur = 'high', perfAcc = 0, perfN = 0, perfWin = 0, fpsShown = 60;
try { qMode = localStorage.getItem('haegyo_q') || 'auto'; } catch (e) { /* ignore */ }
function applyQuality(q) {
  qCur = q; const c = QUAL[q];
  renderer.setPixelRatio(Math.min(devicePixelRatio, c.pr)); renderer.setSize(innerWidth, innerHeight);
  const sh = c.sh > 0;
  if (sh && flash.shadow.mapSize.x !== c.sh) { flash.shadow.mapSize.set(c.sh, c.sh); if (flash.shadow.map) { flash.shadow.map.dispose(); flash.shadow.map = null; } }
  if (renderer.shadowMap.enabled !== sh || flash.castShadow !== sh) {
    renderer.shadowMap.enabled = sh; flash.castShadow = sh;
    scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); });
  }
  const sel = $('quality'); if (sel) sel.value = qMode;
}
function perfTick(dt) {
  if (state !== 'playing') return;
  perfAcc += dt; perfN++; perfWin += dt;
  if (perfWin >= 2.5) {
    const fps = perfN / perfAcc; fpsShown = fps; perfAcc = 0; perfN = 0; perfWin = 0;
    if (TEST) $('fps').textContent = `${fps.toFixed(0)} FPS · ${QUAL[qCur].label}`;
    if (qMode === 'auto' && fps < 38 && qCur !== 'low') { applyQuality(qCur === 'high' ? 'mid' : 'low'); toast('그래픽 품질 자동 조정', `${QUAL[qCur].label}(으)로 낮췄습니다`, 'info'); }
  }
}
$('quality').addEventListener('change', e => { qMode = e.target.value; try { localStorage.setItem('haegyo_q', qMode); } catch (err) { /* ignore */ } applyQuality(qMode === 'auto' ? 'high' : qMode); });
applyQuality(qMode === 'auto' ? 'high' : qMode);
// 로딩 중에 모든 공간의 텍스처·셰이더를 미리 준비 (처음 들어가는 곳에서 멈칫하는 문제)
warmUp(renderer, scene, camera, [...floors.map(f => f.interior), ...floors.map(f => f.shell), world.OUT, ghost.group, appar]);

/* ---------- 테스트 모드 (?test) ---------- */
const TP = [
  ['정문 앞 (도로)', { floor: 0, x: 0, z: 76, yaw: 0 }], ['운동장 · 본관 현관', { floor: 0, x: 0, z: 4, yaw: 0 }],
  ['본관 1F 복도', { floor: 0, x: 0, z: 0, yaw: -Math.PI / 2 }], ['본관 2F 복도', { floor: 1, x: 0, z: 0, yaw: -Math.PI / 2 }],
  ['본관 3F (방송실 앞)', { floor: 2, x: -24, z: 0, yaw: 0 }], ['옥상', { floor: 3, x: 0, z: -7.5, yaw: 0 }],
  ['지하 B1', { floor: 4, x: 0, z: 0, yaw: -Math.PI / 2 }], ['체육관', { floor: 5, x: 38, z: 28.1, yaw: 0 }],
  ['수영장', { floor: 6, x: -35.5, z: 38, yaw: Math.PI / 2 }], ['급식실', { floor: 7, x: -39, z: 20.5, yaw: 0 }],
  ['별관 1F', { floor: 8, x: 0, z: .2, yaw: -Math.PI / 2 }], ['별관 2F', { floor: 9, x: 0, z: 0, yaw: -Math.PI / 2 }],
  ['별관 3F', { floor: 10, x: 0, z: 0, yaw: -Math.PI / 2 }], ['서문 앞', { floor: 0, x: -46.5, z: 32, yaw: Math.PI / 2 }],
  ['교무실 금고', { floor: 0, x: -10.4, z: -8.0, yaw: Math.PI / 2 }], ['B1 전기실', { floor: 4, x: -16, z: -4, yaw: Math.PI / 2 }], ['3-3 교실', { floor: 2, x: -8, z: -3, yaw: 0 }], ['음악실', { floor: 2, x: 32, z: -3, yaw: 0 }],
];
function testAct(fn) { closeUI(); setTimeout(fn, 60); }
function renderTest() {
  const b = (label, on, fn) => { const el = document.createElement('button'); el.textContent = label; if (on) el.classList.add('on'); el.onclick = fn; return el; };
  const tp = $('testTp'), ac = $('testAct'); tp.innerHTML = ''; ac.innerHTML = '';
  TP.forEach(([n, to]) => tp.appendChild(b(n, false, () => testAct(() => { if (!gateClosed && to.z < GATE_Z - 3) { gateClosed = true; gateState = 'closed'; gateAnim = 1; gate.setOpen(0); } teleport(to); }))));
  ac.appendChild(b(`무적 ${TST.god ? 'ON' : 'OFF'}`, TST.god, () => { TST.god = !TST.god; renderTest(); }));
  ac.appendChild(b(`유령 ${TST.noGhost ? 'OFF' : 'ON'}`, !TST.noGhost, () => { TST.noGhost = !TST.noGhost; if (TST.noGhost) { ghost.active = false; ghost.hunt = null; } renderTest(); }));
  ac.appendChild(b('유령 바로 깨우기', false, () => testAct(() => { TST.noGhost = false; ghost.active = true; ghostRelocate(); toast('테스트', '유령을 현재 층으로 불렀습니다.', 'warn'); })));
  ac.appendChild(b('열쇠 조각 모두 획득', false, () => testAct(() => { world.items.filter(i => i.kind === 'key').forEach(i => { i.taken = true; i.mesh.visible = false; got[i.idx] = true; }); P.keys = TOTAL; refreshHud(); toast('테스트', `열쇠 ${TOTAL}/${TOTAL} — 정문·서문·비상 통로가 열립니다.`, 'info'); })));
  ac.appendChild(b('최종 추격 시작', false, () => testAct(() => enrage())));
  ac.appendChild(b('보급품 채우기', false, () => testAct(() => { P.hp = 100; P.battery = 100; P.stamina = 100; inv.battery = 5; inv.medkit = 5; refreshHud(); toast('테스트', 'HP·배터리·건전지·응급 밴드 보충', 'info'); })));
  ac.appendChild(b('모든 문 열기', false, () => testAct(() => world.doorList.forEach(d => { d.target = 1; }))));
  ac.appendChild(b('전력 복구', false, () => testAct(() => { power = true; world.props.forEach(p => { if (p.kind === 'breaker') { p.on = true; p.done = true; } }); toast('테스트', '전력 복구', 'info'); })));
  ac.appendChild(b('모든 문서 획득', false, () => testAct(() => { world.items.filter(i => i.kind === 'note' && !i.taken).forEach(i => { i.taken = true; i.mesh.visible = false; docs.push({ id: i.id, title: i.title, text: i.text }); }); refreshHud(); toast('테스트', `문서 ${docs.length}개`, 'info'); })));
  $('testInfo').textContent = `현재: ${AREA_NAMES[P.floor]} (${P.x.toFixed(1)}, ${P.z.toFixed(1)})  ·  열쇠 ${P.keys}/${TOTAL}  ·  유령 ${ghost.active ? AREA_NAMES[ghost.floor] + ' / ' + ghost.state : '비활성'}`;
}
function openTest() { if (state !== 'playing') return; openUI('testOv'); renderTest(); }
if (TEST) {
  document.body.classList.add('test');
  $('testBadge').style.display = 'block';
  $('menuTest').style.display = 'block'; $('testLink').style.display = 'none';
}

if (DEBUG) {
  window.__g = {
    P, ghost, floors, world, scene, camera, renderer, start: () => start(true),
    tp(x, z, f = 0, yaw = 0, pitch = 0) { P.x = x; P.z = z; P.floor = f; P.yaw = yaw; P.pitch = pitch; },
    give() { world.items.filter(i => i.kind === 'key').forEach(i => { i.taken = true; i.mesh.visible = false; got[i.idx] = true; }); P.keys = TOTAL; refreshHud(); },
    get state() { return state; }, set state(v) { state = v; }, get tNow() { return tNow; }, openTest, EV, appar, applyQuality, get power() { return power; },
    interact, die, activateGhost, enrage,
    setTarget(t) { target = t; },
  };
}
