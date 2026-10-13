// 폐교 — 잊혀진 시간 : 1인칭 학교 공포 게임 (Three.js)
import * as THREE from './vendor/three.module.js';
import { buildWorld, collide, los, FH, GATE_Z, KEY_NAMES, KEY_ROOMS, AREA_NAMES, SLOTS, LAYOUT, ANNEX } from './world.js';
import { drawMap } from './map.js';
import { makeDress, makeHair, makeGhostFace, loadPBR } from './tex.js';
import { warmUp } from './bake.js';
import { createFX } from './fx.js';
import { initAudio, sfx, at, setProximity, setListener, setAmbience, setBreath, setGhostVoice, setMusic, setVolumes, getVolumes } from './audio.js';
import { VS, saveVS, loadManifest, speak, stopSpeak, subtitle, line, preload, hasBrowserVoice, lineInfo } from './voice.js';
import { CHARACTERS, FACE, LINES, VO, ITEMS, RECIPES, CHAPTERS, CREDITS, OPTIONAL, CLUES } from './story.js';
import { SET, saveSET, resetSET, DIFF } from './settings.js';
loadManifest();

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const TEST = params.has('test');
const TST = { god: false, noGhost: false };
// 주인공 (캐릭터 선택)
let CHAR = 'seoyeon';
try { CHAR = localStorage.getItem('haegyo_char') || 'seoyeon'; } catch (e) { /* ignore */ }
if (!CHARACTERS[CHAR]) CHAR = 'seoyeon';
const CH = () => CHARACTERS[CHAR], CK = () => (CHAR === 'jihun' ? 'j' : 's');
const DF = () => DIFF[SET.diff] || DIFF.normal;
// 이야기 진행 플래그
const FL = { cam: false, tag: false, calm: false, mina: false, gatekey: false, opt: false };
const msgs = [], clues = [], newItems = new Set();
let voBusy = false;   // 중요한 연출(하교 방송) 중에는 휴대폰 메시지를 미룬다
let chapterShown = 0;

/* ---------- 렌더러 / 씬 ---------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3 * SET.bright;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);
scene.fog = new THREE.FogExp2(0x070a12, 0.03);
const FOG_IN = new THREE.Color(0x060708), FOG_OUT = new THREE.Color(0x0c1424);
const camera = new THREE.PerspectiveCamera(SET.fov, innerWidth / innerHeight, 0.05, 320);
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

const _t0 = performance.now();
await loadPBR();
const _t1 = performance.now();
const world = buildWorld(scene);
const _t2 = performance.now();
const fx = createFX(renderer, scene, camera);
let hurtFx = 0, lightningT = 25, sparkT = 3;
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
let lookBack = 0, introT = 0, introText = false;
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
  const G = ghost; speed *= DF().speed;
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
  if (!P.hiding && !G.hunt && !(outP && !G.enraged) && G.state !== 'chase' && dist < P.noise * DF().hear) {
    G.state = 'search'; G.target = { x: P.x, z: P.z }; G.wait = 0; G.replan = 0;
  }
  if (G.hunt) { /* 사물함으로 직행 */ }
  else if (sees && G.spawnGrace <= 0) {
    if (G.state !== 'chase') { G.state = 'chase'; sfx.alert(); fx.glitch(.5); if (Math.random() < .35) line('gh4', 'whisper'); else talk('spotted', 2600); }
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
    if (Math.hypot(G.x - d.x, G.z - dz) < 1.3) { d.target = 1; d.slam = true; const dd = Math.hypot(P.x - d.x, P.z - dz); if (G.floor === P.floor && dd < 20) { at(d.x, floors[d.floor].y0 + 1.2, dz).doorBang(0, 1); if (dd < 6) shake = .35; } }
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
  if (G.stepT <= 0) { G.stepT = .55; const pan = ((G.x - P.x) * Math.cos(P.yaw) - (G.z - P.z) * Math.sin(P.yaw)) / Math.max(1, dist); at(G.x, floors[G.floor].y0 + .2, G.z).ghostStep(Math.min(dist, 6), 0); }
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
/* ----- 목표 · 챕터 ----- */
const LOC = {
  entrance: { f: 0, x: 0, z: 2.5, where: '본관 현관' }, cam: { f: 0, x: 10.95, z: -8.55, where: '본관 1층 · 1-1 교실' },
  office: { f: 0, x: -8, z: -5.5, where: '본관 1층 · 교무실' }, gate: { f: 0, x: 0, z: GATE_Z - 2.5, where: '정문' },
  tag: { f: 4, x: 29, z: -4.5, where: '지하 B1 · 펌프실' }, breaker: { f: 4, x: -19, z: -5.4, where: '지하 B1 · 전기실' },
  console: { f: 2, x: -25.1, z: -7, where: '본관 3층 · 방송실' }, mina: { f: 2, x: -21.7, z: -8.1, where: '본관 3층 · 방송실 장비실' },
};
const KEY_WHERE = ['본관 1층 · 교무실 금고', '본관 1층 · 도서실', '본관 2층 · 과학실', '체육관 · 기록석', '수영장 · 탈의실'];
function objective() {
  const n3 = docs.some(d => d.id === 'n3');
  if (!FL.cam && P.keys === 0) return { ch: 1, main: gateClosed ? '1학년 1반에서 민아의 흔적을 찾아라' : '민아를 찾아 학교 안으로 들어가라', loc: gateClosed ? LOC.cam : LOC.entrance,
    subs: [['학교 안으로 들어가기', introDone], ['1-1 교실 조사하기', FL.cam]] };
  if (!got[0]) return { ch: 2, main: '교무실 금고를 열어 첫 번째 열쇠 조각을 찾아라', loc: LOC.office,
    subs: [['민아의 캠코더 확인', FL.cam], ['교무회의록 읽기', n3], ['금고 열기 — 비밀번호: 그날의 날짜', got[0]]] };
  if (P.keys < TOTAL) {
    const left = KEY_ROOMS.map((r, i) => ({ ...r, i })).filter(r => !got[r.i]);
    const k = left.find(r => r.f === P.floor) || left[0];
    return { ch: 3, main: `정문 열쇠 조각을 모두 모아라 (${P.keys}/${TOTAL})`, loc: { ...k, where: KEY_WHERE[k.i] }, subs: KEY_NAMES.map((n, i) => [`${n} 열쇠 조각`, got[i]]) };
  }
  if (!FL.gatekey) return { ch: 4, main: '소지품(Tab)에서 열쇠 조각 다섯 개를 조합하라', loc: null, subs: [[`열쇠 조각 ${TOTAL}/${TOTAL}`, true], ['정문 열쇠 만들기', false]] };
  return { ch: 5, main: FL.mina ? '민아와 함께 정문으로 나가라' : '정문으로 달려가 탈출하라', loc: LOC.gate, subs: FL.calm ? [['하늘의 하교 방송', true]] : [['그것에게 잡히지 않기', false]] };
}
function optSteps() { return [FL.tag, power, FL.calm, FL.mina]; }
function optLoc() { const s = optSteps(), i = s.indexOf(false); return i < 0 ? null : [LOC.tag, LOC.breaker, LOC.console, LOC.mina][i]; }
function unlockOptional() {
  if (FL.opt) return; FL.opt = true;
  setTimeout(() => toast('특별 목표가 추가되었습니다', '하교 방송 — 하늘의 이야기를 끝내 줄 방법이 있을지도 모른다', 'opt'), 1200); refreshHud();
}
function showChapter(n) {
  const c = CHAPTERS[n - 1]; if (!c) return;
  $('ccNum').textContent = `CHAPTER ${n}`; $('ccTitle').textContent = c.title.split('·')[1].trim();
  const el = $('chapterCard'); el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 3800);
}
function refreshHud() {
  const o = objective();
  if (o.ch !== chapterShown) { const prev = chapterShown; chapterShown = o.ch; if (prev && state === 'playing') { showChapter(o.ch); sfx.alert && o.ch > 1 && toast('새로운 장', CHAPTERS[o.ch - 1].title, 'info'); } }
  $('chapter').textContent = CHAPTERS[o.ch - 1].title;
  $('objText').textContent = o.main; $('objWhere').textContent = o.loc ? '📍 ' + o.loc.where : '';
  $('subs').innerHTML = o.subs.map(([t, d]) => `<div class="chk${d ? ' done' : ''}">${t}</div>`).join('');
  $('optBox').style.display = FL.opt ? 'block' : 'none';
  $('optTitle').textContent = OPTIONAL.title;
  const st = optSteps(); $('optSubs').innerHTML = OPTIONAL.steps.map((t, i) => `<div class="chk${st[i] ? ' done' : ''}">${t}</div>`).join('');
  $('c2').textContent = inv.battery; $('c3').textContent = inv.medkit; $('c4').textContent = FL.gatekey ? '열쇠' : `${P.keys}/${TOTAL}`;
  $('s2').classList.toggle('off', !inv.battery); $('s3').classList.toggle('off', !inv.medkit); $('s4').classList.toggle('off', !P.keys);
  const un = msgs.filter(m => !m.read).length; $('phoneBadge').textContent = un; $('phoneBadge').classList.toggle('on', un > 0);
  const con = world.props.find(p => p.kind === 'console'); if (con) con.label = FL.calm ? '방송 장비 (조용하다)' : FL.tag && power ? '하늘을 위해 하교 방송하기' : '방송 장비 사용';
}
function toast(title, desc = '', kind = '') {
  const t = document.createElement('div'); t.className = 'toast panel ' + kind; t.innerHTML = `<b>${title}</b>${desc}`;
  $('toasts').appendChild(t); setTimeout(() => t.remove(), 4200);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
}
let talkTimer = 0;
// 주인공 대사: story.js LINES 의 id 로 부른다 (선택한 캐릭터의 대사 · 목소리)
function talk(id, ms = 3200) {
  const L = LINES[id], text = L ? L[CK()] : id;
  $('dlgText').textContent = text; $('dlgName').textContent = CH().name;
  $('dlg').classList.toggle('show', VS.subs || VS.mode === 'off'); clearTimeout(talkTimer);
  talkTimer = setTimeout(() => $('dlg').classList.remove('show'), ms);
  const vid = L && `l_${id}_${CK()}`;
  if (vid && lineInfo(vid)) speak(vid).then(sec => { clearTimeout(talkTimer); talkTimer = setTimeout(() => $('dlg').classList.remove('show'), Math.max(ms, sec * 1000 + 700)); });
}
function addClue(id) { if (clues.includes(id)) return; clues.push(id); }
function clockText(extra = 0) { const m = Math.floor(23 * 60 + 40 + (playTime + extra) / 6), h = Math.floor(m / 60) % 24; return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }

/* ----- 문서 (쪽지 · 사진 · 녹음 · 캠코더) ----- */
function docInfo(d) {
  if (d.kind === 'note') { const n = world.NOTES[d.id]; return n && { icon: '📄', title: n.title, text: n.text }; }
  if (d.kind === 'photo') { const p = world.PHOTOS[d.id]; return p && { icon: '🖼', title: p.title, text: p.text, img: p.img }; }
  if (d.kind === 'tape') { const t = world.TAPES[d.id]; const i = lineInfo(d.id) || VO[d.id]; return t && { icon: '📼', title: t.title, text: i ? i.text : '', tape: d.id, spk: '📼 ' + t.spk }; }
  if (d.kind === 'cam') return { icon: '📹', title: '캠코더 녹화 — 민아', text: VO.cam1.text, tape: 'cam1', spk: '📹 민아', fx: 'phone' };
  return null;
}
function addDoc(d) { if (docs.some(x => x.id === d.id)) return; const i = docInfo(d); if (i) docs.push({ ...d, ...i }); }
const DOC_TOTAL = () => world.items.filter(i => i.kind === 'note' || i.kind === 'photo').length + Object.keys(world.TAPES).length + 1;
async function playCam() {
  const sec = await line('cam1', 'phone', '📹 민아 (녹화)');
  setTimeout(() => { if (state === 'playing' || state === 'ui') talk('afterCam', 3200); }, (sec + .6) * 1000);
}

/* ----- 소지품 ----- */
let invTab = 'items', invSel = 0, combineFrom = null, invMsg = '', mapFloor = 0;
const TABS = ['items', 'docs', 'keys'];
const iconHTML = ic => /^[a-z_0-9]+$/.test(ic) ? `<img src="assets/ui/${ic}.webp" alt="">` : ic;
function bagList() {
  const L = CH().items.map(id => ({ id }));
  if (inv.battery) L.push({ id: 'battery', n: inv.battery });
  if (inv.medkit) L.push({ id: 'medkit', n: inv.medkit });
  if (FL.gatekey) L.push({ id: 'gatekey' });
  if (P.keys && !FL.gatekey) L.push({ id: 'keypiece', n: P.keys });
  if (FL.tag) L.push({ id: 'nametag' });
  if (FL.cam) L.push({ id: 'camcorder' });
  return L.map(x => ({ ...ITEMS[x.id], ...x }));
}
function itemDesc(it) {
  if (it.id === 'flashlight') return `${it.desc}<br>배터리 <b>${Math.round(P.battery)}%</b> · ${P.light ? '켜짐' : '꺼짐'}`;
  if (it.id === 'keypiece') return `${it.desc}<br>모은 조각: <b>${P.keys} / ${TOTAL}</b>`;
  return it.desc;
}
const USE = {
  flashlight: () => { P.light = !P.light; sfx.click(); return P.light ? '손전등을 켰다.' : '손전등을 껐다.'; },
  battery: () => (useBattery() ? '손전등에 건전지를 넣었다.' : ''),
  medkit: () => (useMedkit() ? '응급 밴드를 붙였다.' : ''),
  camcorder: () => { closeUI(); playCam(); },
  phone_jihun: () => { closeUI(); openPhone('msg'); }, phone_seoyeon: () => { closeUI(); openPhone('msg'); },
  memo_jihun: () => { closeUI(); openPhone('memo'); }, memo_seoyeon: () => { closeUI(); openPhone('memo'); },
  keypiece: () => { startCombine('keypiece'); return '조각끼리 맞춰 보자 — 같은 칸을 한 번 더 선택'; },
  gatekey: () => '정문 자물쇠에 쓸 수 있다. 정문 앞에서 E.',
  nametag: () => (power ? '3층 방송실 장비에서 이 이름을 불러 줄 수 있다.' : '방송실에서 이 이름을 불러 주려면 먼저 전기가 필요하다.'),
  necklace: () => '“첫 녹음 기념. 우리 방송, 오래 하자.” — 민아',
  keys_jihun: () => '민아가 맡겨 둔 열쇠. 꼭 돌려줘야 한다.',
};
const canCombine = id => RECIPES.some(r => r.a === id || r.b === id);
function startCombine(id) { combineFrom = id; invMsg = `「${ITEMS[id].name}」과(와) 조합할 아이템을 고르세요 · Esc 취소`; renderInv(); }
function tryCombine(a, b) {
  combineFrom = null;
  const r = RECIPES.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  if (!r) { talk('combineFail', 2200); invMsg = '이 둘은 함께 쓸 수 없다.'; sfx.buzz(); renderInv(); return; }
  if (r.fn === 'recharge') invMsg = useBattery() ? '손전등 배터리를 갈아 끼웠다.' : '';
  else if (r.fn === 'gatekey') {
    if (P.keys < TOTAL) { invMsg = `조각이 부족하다 — ${P.keys} / ${TOTAL}`; sfx.buzz(); }
    else { makeGateKey(); invMsg = '다섯 조각이 맞물려 정문 열쇠가 되었다!'; }
  }
  renderInv();
}
function makeGateKey() {
  if (FL.gatekey) return;
  FL.gatekey = true; newItems.add('gatekey'); sfx.unlock(); setFace('resolve', 3);
  toast('정문 열쇠를 만들었습니다', '정문 · 서문 · 지하 비상 통로를 열 수 있다');
  setTimeout(() => talk('keyMade', 3000), 300);
  if (FL.calm) setTimeout(() => toast('고요하다', '그것은 더 이상 쫓아오지 않는다. ' + (FL.mina ? '민아와 함께 정문으로.' : '…민아는 아직 방송실에 있다.'), 'opt'), 2600);
  else setTimeout(() => { if (state === 'ui') closeUI(); enrage(); }, 1600);
  refreshHud(); save(true);
}
function invUse(it) {
  const f = USE[it.id]; const r = f ? f() : '지금은 쓸 곳이 없다.';
  if (typeof r === 'string') invMsg = r;
  if (state === 'ui' && $('inv').classList.contains('show')) renderInv();
}
function zoom(title, big, text) {
  $('izName').textContent = title; $('izBig').innerHTML = big; $('izText').innerHTML = text; $('invZoom').classList.add('show');
}
function renderInv() {
  document.querySelectorAll('#invTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === invTab));
  const grid = $('invGrid'), det = $('invDetail'); grid.innerHTML = ''; det.innerHTML = '';
  const actBtns = acts => `<div id="invMsg">${invMsg}</div><div id="invActs">${acts.map(([l, k, dis], i) => `<button data-a="${i}"${dis ? ' disabled' : ''}>${l}${k ? ` <kbd>${k}</kbd>` : ''}</button>`).join('')}</div>`;
  const bindActs = fns => det.querySelectorAll('#invActs button').forEach(b => { b.onclick = () => fns[+b.dataset.a](); });
  if (invTab === 'items' || invTab === 'keys') {
    grid.className = '';
    const all = bagList(), its = all.filter(i => (i.cat === 'key') === (invTab === 'keys'));
    invSel = clamp(invSel, 0, Math.max(0, its.length - 1));
    const slots = Math.max(invTab === 'items' ? 15 : 5, Math.ceil(its.length / 5) * 5);
    for (let i = 0; i < slots; i++) {
      const it = its[i], c = document.createElement('div');
      if (!it) { c.className = 'cell empty'; grid.appendChild(c); continue; }
      c.className = 'cell' + (i === invSel ? ' sel' : '') + (combineFrom ? ' pick' : '');
      c.innerHTML = iconHTML(it.icon) + (it.n > 1 ? `<em>×${it.n}</em>` : '') + (newItems.has(it.id) ? '<span class="new">NEW</span>' : '');
      c.onclick = () => { if (combineFrom) { tryCombine(combineFrom, it.id); return; } invSel = i; invMsg = ''; renderInv(); };
      grid.appendChild(c);
    }
    $('invCap').innerHTML = `<span>${its.length}개 · ${invTab === 'items' ? '아이템' : '열쇠 아이템'}</span><span>←→↑↓ 선택 · Enter 사용 · C 조합 · Z 자세히</span>`;
    const it = its[invSel];
    if (!it) { det.innerHTML = invTab === 'keys' ? keyPieceHTML() : '<p>비어 있다.</p>'; return; }
    newItems.delete(it.id);
    det.innerHTML = `<div class="big">${iconHTML(it.icon)}</div><h3>${it.name}${it.n > 1 ? ` <small style="color:var(--dim)">×${it.n}</small>` : ''}</h3><div class="cat">${it.cat === 'key' ? '열쇠 아이템' : '아이템'}</div><div>${itemDesc(it)}</div>${invTab === 'keys' ? keyPieceHTML() : ''}` +
      actBtns([['사용', 'Enter'], ['조합', 'C', !canCombine(it.id)], ['자세히', 'Z']]);
    bindActs([() => invUse(it), () => startCombine(it.id), () => zoom(it.name, iconHTML(it.icon), itemDesc(it))]);
  } else {
    grid.className = 'list';
    if (!docs.length) { grid.innerHTML = '<p style="color:#8d897d">아직 모은 문서가 없다.</p>'; $('invCap').innerHTML = `<span>문서 0 / ${DOC_TOTAL()}</span>`; return; }
    invSel = clamp(invSel, 0, docs.length - 1);
    docs.forEach((d, i) => { const c = document.createElement('div'); c.className = 'doc' + (i === invSel ? ' sel' : ''); c.innerHTML = `${d.icon} ${d.title}<small>${{ note: '쪽지', photo: '사진', tape: '녹음', cam: '영상' }[d.kind]}</small>`; c.onclick = () => { invSel = i; renderInv(); }; grid.appendChild(c); });
    $('invCap').innerHTML = `<span>찾은 기록 ${docs.length} / ${DOC_TOTAL()}</span><span>↑↓ 선택 · Enter 다시 듣기 · Z 자세히</span>`;
    const d = docs[invSel];
    det.innerHTML = `<h3>${d.title}</h3><div class="cat">${{ note: '쪽지 · 문서', photo: '사진', tape: '녹음 테이프', cam: '캠코더 영상' }[d.kind]}</div>${d.img ? `<img class="photo" src="assets/img/${d.img}.webp" alt="">` : ''}<div class="paper">${d.text}</div>` +
      actBtns([['▶ 다시 듣기', 'Enter', !d.tape], ['자세히', 'Z']]);
    bindActs([() => line(d.tape, d.fx || 'radio', d.spk), () => zoom(d.title, d.img ? `<img src="assets/img/${d.img}.webp" alt="">` : d.icon, d.text)]);
  }
}
function keyPieceHTML() {
  return `<div class="pieceList" style="margin-top:10px;border-top:1px solid #2c3640;padding-top:8px"><b style="font-size:12px;color:var(--dim)">정문 열쇠 조각 ${P.keys}/${TOTAL}</b>${KEY_NAMES.map((n, i) => `<div class="chk${got[i] ? ' done' : ''}">${KEY_WHERE[i]}</div>`).join('')}</div>`;
}
function invKey(e) {
  const c = e.code, list = invTab === 'docs' ? docs : bagList().filter(i => (i.cat === 'key') === (invTab === 'keys'));
  if ($('invZoom').classList.contains('show')) { if (['Escape', 'KeyZ', 'Enter', 'Tab'].includes(c)) $('invZoom').classList.remove('show'); return true; }
  if (c === 'Escape' && combineFrom) { combineFrom = null; invMsg = ''; renderInv(); return true; }
  if (c === 'KeyQ' || c === 'KeyE') { invTab = TABS[(TABS.indexOf(invTab) + (c === 'KeyE' ? 1 : 2)) % 3]; invSel = 0; combineFrom = null; invMsg = ''; renderInv(); return true; }
  const cols = invTab === 'docs' ? 1 : 5;
  const mv = { ArrowRight: 1, KeyD: 1, ArrowLeft: -1, KeyA: -1, ArrowDown: cols, KeyS: cols, ArrowUp: -cols, KeyW: -cols }[c];
  if (mv) { invSel = clamp(invSel + mv, 0, Math.max(0, list.length - 1)); invMsg = combineFrom ? invMsg : ''; renderInv(); return true; }
  if (c === 'Enter' || c === 'Space') { const b = $('invActs') && $('invActs').querySelector('[data-a="0"]'); if (combineFrom && invTab !== 'docs') { const it = list[invSel]; if (it) tryCombine(combineFrom, it.id); } else if (b && !b.disabled) b.click(); return true; }
  if (c === 'KeyC' && invTab !== 'docs') { const it = list[invSel]; if (it && canCombine(it.id)) startCombine(it.id); return true; }
  if (c === 'KeyZ') { const b = $('invActs') && [...$('invActs').querySelectorAll('button')].pop(); if (b) b.click(); return true; }
  return false;
}

/* ----- 휴대폰 ----- */
let phoneTab = 'msg';
const PTABS = ['msg', 'photo', 'memo'];
function openPhone(tab = 'msg') { if (state !== 'playing') return; phoneTab = tab; openUI('phone'); renderPhone(); sfx.click(); }
function renderPhone() {
  document.querySelectorAll('.pTabs button').forEach(b => b.classList.toggle('on', b.dataset.p === phoneTab));
  $('pClock').textContent = clockText();
  const B = $('pBody');
  if (phoneTab === 'msg') {
    B.innerHTML = msgs.length ? msgs.slice().reverse().map(m => `<div class="bubble${m.read ? '' : ' unread'}" data-id="${m.id}"><small>민아 · ${m.t} · ▶ 음성 메시지</small>${VO[m.id].text}</div>`).join('') : '<div class="pEmpty">메시지가 없습니다.<br>신호 없음</div>';
    B.querySelectorAll('.bubble').forEach(b => { b.onclick = () => line(b.dataset.id, 'phone', '📱 민아'); });
    msgs.forEach(m => { m.read = true; }); refreshHud();
  } else if (phoneTab === 'photo') {
    const ph = docs.filter(d => d.img);
    B.innerHTML = ph.length ? `<div class="pPhotos">${ph.map(d => `<img src="assets/img/${d.img}.webp" alt="" title="${d.title}" data-t="${d.title}">`).join('')}</div>` : '<div class="pEmpty">저장된 사진이 없습니다.</div>';
    B.querySelectorAll('img').forEach(im => { im.onclick = () => { $('lbImg').src = im.src; $('lbCap').textContent = im.dataset.t; $('lightbox').classList.add('show'); }; });
  } else {
    B.innerHTML = clues.length ? clues.slice().reverse().map(c => `<div class="memo">${CLUES[c]}</div>`).join('') : '<div class="pEmpty">아직 기록한 단서가 없습니다.</div>';
  }
}
document.querySelectorAll('.pTabs button').forEach(b => { b.onclick = () => { phoneTab = b.dataset.p; renderPhone(); }; });

/* ----- 열기 / 닫기 ----- */
const UI_PANELS = ['inv', 'mapOv', 'testOv', 'keypad', 'phone', 'invZoom'];
function openUI(kind) { if (state !== 'playing') return; state = 'ui'; for (const k in keys) keys[k] = false; $('prompt').style.display = 'none'; $(kind).classList.add('show'); document.exitPointerLock?.(); }
function closeUI() { if (state !== 'ui') return; UI_PANELS.forEach(k => $(k).classList.remove('show')); combineFrom = null; invMsg = ''; state = 'playing'; refreshHud(); lock(); }
function openInv(tab = 'items') { if (state !== 'playing') return; invTab = tab; invSel = 0; openUI('inv'); renderInv(); sfx.paper(); }
document.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => closeUI(); });
$('izClose').onclick = () => $('invZoom').classList.remove('show');
document.querySelectorAll('#invTabs button').forEach(b => { b.onclick = () => { invTab = b.dataset.tab; invSel = 0; combineFrom = null; invMsg = ''; renderInv(); }; });

/* ----- 지도 ----- */
let mapZoom = 1, mapPan = { x: 0, z: 0 };
function openMap() { if (state !== 'playing') return; mapFloor = P.floor; const inB = P.floor === 0 && !isOutdoors(); mapZoom = inB ? 2.1 : 1; mapPan = { x: 0, z: inB ? -26 : 0 }; openUI('mapOv'); renderMap(); }
function mapPins(f) { return KEY_ROOMS.map((r, i) => ({ ...r, i })).filter(r => r.f === f).map(r => ({ x: r.x, z: r.z, done: got[r.i] })); }
function mapTarget(f) { const o = objective(), t = o.loc || (FL.opt && optLoc()); return t && t.f === f ? t : null; }
function mapExtras(f) {
  return {
    doors: world.doorList.filter(d => d.floor === f).map(d => ({ x: d.x, z: d.kind === 'slide' ? -1.55 : d.z, open: d.target > .5, slide: d.kind === 'slide' })),
    props: world.props.filter(p => p.floor === f && p.kind !== 'bell').map(p => ({ x: p.x, z: p.z, done: !!p.done, label: { safe: '금고', breaker: '차단기', console: '방송 장비', tape: '녹음기', mina: '민아' }[p.kind] })),
    target: mapTarget(f),
  };
}
function renderMap() {
  document.querySelectorAll('#mapTabs button').forEach(b => b.classList.toggle('on', b.dataset.f === String(mapFloor)));
  const guide = mapFloor === 'guide'; $('bigMap').style.display = guide ? 'none' : 'block'; $('guide').style.display = guide ? 'grid' : 'none';
  const o = objective(), t = o.loc || (FL.opt && optLoc());
  $('mapObj').textContent = t ? `★ ${o.main} — ${t.where}` : `★ ${o.main}`;
  if (guide) return;
  const c = $('bigMap'), ctx = c.getContext('2d');
  const V = { 0: [0, 22, 5.2], 5: [38, 19, 22], 6: [-41, 38, 19], 7: [-39, 15, 24], 8: [0, -4, 21], 9: [0, -4, 21], 10: [0, -4, 21] }[mapFloor] || [0, -4, 11];
  drawMap(ctx, c.width, c.height, { floor: mapFloor, cx: V[0] + mapPan.x, cz: V[1] + mapPan.z, scale: V[2] * mapZoom, labels: true, pins: mapPins(mapFloor), ...mapExtras(mapFloor), t: tNow,
    lockers: world.lockers.filter(l => l.floor === mapFloor), player: P.floor === mapFloor ? { x: P.x, z: P.z, yaw: P.yaw } : null });
}
document.querySelectorAll('#mapTabs button').forEach(b => { b.onclick = () => { mapFloor = b.dataset.f === 'guide' ? 'guide' : +b.dataset.f; mapZoom = 1; mapPan = { x: 0, z: 0 }; renderMap(); }; });
$('bigMap').addEventListener('wheel', e => { e.preventDefault(); mapZoom = clamp(mapZoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), .5, 4); renderMap(); }, { passive: false });
{ let drag = null; const c = $('bigMap');
  c.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', e => { if (!drag) return; const V = { 0: 5.2, 5: 22, 6: 19, 7: 24, 8: 21, 9: 21, 10: 21 }[mapFloor] || 11, k = c.width / c.clientWidth / (V * mapZoom); mapPan.x -= (e.clientX - drag.x) * k; mapPan.z -= (e.clientY - drag.y) * k; drag = { x: e.clientX, y: e.clientY }; renderMap(); });
  c.addEventListener('pointerup', () => { drag = null; }); }

function useBattery() {
  if (inv.battery <= 0) { toast('건전지가 없습니다', '', 'warn'); return false; }
  if (P.battery >= 95) { say('손전등 배터리는 아직 충분하다', 1800); return false; }
  inv.battery--; P.battery = Math.min(100, P.battery + 45); if (!P.light) P.light = true; sfx.pickup(); toast('건전지를 교체했습니다', '손전등 배터리 회복', 'info'); refreshHud(); return true;
}
function useMedkit() {
  if (inv.medkit <= 0) { toast('응급 밴드가 없습니다', '', 'warn'); return false; }
  if (P.hp >= 100) { say('다친 곳이 없다', 1800); return false; }
  inv.medkit--; P.hp = Math.min(100, P.hp + 50); setFace('relief', 3); sfx.paper(); toast('응급 밴드를 사용했습니다', '체력 +50', 'info'); talk('heal', 2400); refreshHud(); return true;
}
const WOOD_ROOMS = ['class', 'office', 'library', 'music', 'art', 'counsel', 'nurse', 'club', 'craft'];
function surfaceAt() {
  const f = P.floor;
  if (f === 0 && isOutdoors()) return (Math.abs(P.x) < 3.4 || (P.z > 1.75 && P.z < 14 && Math.abs(P.x) < 46)) ? 'tile' : 'dirt';
  if (f === 5) return 'wood';
  if (f >= 0 && f !== 3 && f < 11) { const r = roomAt(f, P.x, P.z); if (r && WOOD_ROOMS.includes(r.type)) return 'wood'; if (r && r.type === 'stair') return 'metal'; }
  return 'tile';
}
const _fwd = new THREE.Vector3();
function updateSound(dt) {
  camera.getWorldDirection(_fwd);
  setListener(camera.position.x, camera.position.y, camera.position.z, _fwd.x, _fwd.z);
  let a = 'in';
  if (isOutdoors()) a = P.floor === 3 ? 'roof' : 'out'; else if (P.floor === 4) a = 'b1'; else if (P.floor === 5 || P.floor === 6) a = 'hall'; else if (roomAt(P.floor, P.x, P.z)) a = 'room';
  setAmbience(a, dt);
  const chase = ghost.active && ghost.floor === P.floor && (ghost.state === 'chase' || !!ghost.hunt) && state === 'playing';
  setMusic(state === 'menu' || state === 'intro' ? 'menu' : chase ? 'chase' : 'none', dt);
  const lvl = P.hiding ? .8 : P.tired ? 1 : Math.max(P.fear > .45 ? P.fear * .8 : 0, P.stamina < 45 ? (45 - P.stamina) / 45 * .8 : 0);
  setBreath(state === 'playing' ? lvl : 0, P.tired || P.sprinting ? 1.1 : P.hiding ? .4 : .55, dt);
  if (ghost.active && ghost.floor === P.floor && state === 'playing') setGhostVoice({ x: ghost.x, y: floors[ghost.floor].y0 + 1.7, z: ghost.z }, 1, chase, dt);
  else setGhostVoice(null, 0, false, dt);
}
function isOutdoors() { return state === 'menu' || state === 'intro' || P.floor === 3 || (P.floor === 0 && !(P.z < 1.45 && P.z > -9.9 && Math.abs(P.x) < 36.3)); }
function hit() {
  if (TEST && TST.god) return;
  if (P.invuln > 0 || state !== 'playing') return;
  const G = ghost;
  P.hp -= DF().dmg; P.invuln = 3.5; shake = 1; hurtFx = 1; fx.glitch(.8); setFace('surprise', 2.6);
  sfx.screech();
  const h = $('hurt'); h.style.transition = 'none'; h.style.opacity = 1; requestAnimationFrame(() => { h.style.transition = 'opacity 1.4s'; h.style.opacity = 0; });
  if (P.hp <= 0) { P.hp = 0; die(); return; }
  if (P.hiding) leaveLocker(true);
  G.hunt = null; G.state = 'search'; G.spawnGrace = 3.5; G.path = []; G.replan = 0;
  const F = floors[G.floor]; let far = F.nodes[0];
  F.nodes.forEach(n => { if (Math.hypot(n.x - P.x, n.z - P.z) > Math.hypot(far.x - P.x, far.z - P.z)) far = n; });
  G.target = { x: far.x, z: far.z }; G.wait = 0;
  toast('공격당했습니다', '체력이 낮습니다. 응급 밴드가 필요합니다.', 'warn'); talk('hit', 2600);
  refreshHud();
}
function showNote(it) {
  state = 'note';
  $('note').innerHTML = (it.img ? `<img class="photo" src="assets/img/${it.img}.webp" alt="">` : '') + `<b style="font-size:19px">${it.title}</b><br><br>${it.text}<small>${it.img ? '— 빛바랜 사진' : it.tape ? '— 녹음 내용' : '— 낡은 종이'}</small>`;
  $('noteBox').classList.add('show'); it.img ? sfx.photo() : sfx.paper();
  if (it.kind === 'note' && it.id && VS.readNotes) speak('note_' + it.id);
}
function closeNote() { $('noteBox').classList.remove('show'); if (state === 'note') { state = 'playing'; stopSpeak(); } }

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
    } else if (dr) best = { type: 'door', d: dr, label: dr.label + (dr.need && !FL.gatekey ? ' 🔒' : '') };
    else if (P.floor === 0 && P.z > GATE_Z - 4.5 && P.z < GATE_Z + 3 && Math.abs(P.x) < 6 && gateClosed && !escaped) best = { type: 'gate', label: '정문 열기' };
  }
  return best;
}
function interact() {
  if (!target) return;
  if (target.type === 'item') {
    const it = target.it;
    if (it.kind === 'note') { readNote(it); return; }
    if (it.kind === 'photo') { if (!it.taken) { it.taken = true; it.mesh.visible = false; addDoc({ id: it.id, kind: 'photo' }); toast('사진을 획득했습니다', it.title + ' — 휴대폰 사진첩에 저장', 'info'); refreshHud(); } showNote(it); return; }
    it.taken = true; it.mesh.visible = false;
    if (it.kind === 'key') {
      got[it.idx] = true; P.keys++; sfx.key(); newItems.add('keypiece'); setFace(P.keys < TOTAL ? 'resolve' : 'relief', 3);
      toast('아이템을 획득했습니다', `${KEY_NAMES[it.idx]} 열쇠 조각 (${P.keys}/${TOTAL})`);
      talk(P.keys < TOTAL ? 'key' : 'keyLast', 3000);
      if (P.keys === 1) setTimeout(() => phoneMessage(1), 9000);
      if (P.keys === 1) activateGhost();
      if (P.keys === 3) setTimeout(() => phoneMessage(2), 14000);
      if (P.keys === TOTAL) setTimeout(() => toast('열쇠 조각을 모두 모았습니다', '소지품(Tab) → 열쇠 조각 → 조합 으로 정문 열쇠를 만드세요'), 3200);
      refreshHud(); save(true);
    } else if (it.kind === 'camcorder') {
      FL.cam = true; newItems.add('camcorder'); sfx.pickup(); toast('아이템을 획득했습니다', '민아의 캠코더 — 녹화 파일이 남아 있다');
      addDoc({ id: 'cam1', kind: 'cam' }); addClue('cam'); refreshHud();
      setTimeout(playCam, 700); save(true);
    } else if (it.kind === 'nametag') {
      FL.tag = true; FL.opt = true; newItems.add('nametag'); sfx.key(); setFace('calm', 3);
      toast('특별 목표', '윤하늘의 명찰을 찾았다', 'opt'); talk('tagFound', 3600); addClue('tag'); refreshHud(); save(true);
    } else if (it.kind === 'battery') { inv.battery++; newItems.add('battery'); sfx.pickup(); toast('아이템을 획득했습니다', '건전지 (2번 키로 사용)'); refreshHud(); }
    else { inv.medkit++; newItems.add('medkit'); sfx.pickup(); toast('아이템을 획득했습니다', '응급 밴드 (3번 키로 사용)'); refreshHud(); }
  } else if (target.type === 'locker') enterLocker(target.l);
  else if (target.type === 'stairs') changeFloor(1);
  else if (target.type === 'door') {
    const d = target.d;
    if (d.win) {
      if (!FL.gatekey) { sfx.click(); if (P.keys >= TOTAL) talk('needCombine'); say(d.locked, 2800); return; }
      escaped = true; sfx.gateOpen(); say('쇠사슬이 힘없이 끊어졌다…', 3000); winGame(); return;
    }
    if (d.locked) { sfx.click(); say(d.locked, 2600); return; }
    if (d.need && !FL.gatekey) { sfx.click(); say(`굳게 잠겨 있다. 완성된 정문 열쇠가 있어야 열린다 (조각 ${P.keys}/${TOTAL})`, 2600); return; }
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
  if (!it.taken) {
    it.taken = true; it.mesh.visible = false; addDoc({ id: it.id, kind: 'note' }); toast('새로운 문서를 획득했습니다', it.title, 'info');
    if (CLUES[it.id]) addClue(it.id);
    if (['n7', 'n8', 'n12', 'n14'].includes(it.id)) unlockOptional();
    refreshHud();
  }
  showNote(it);
}
function activateGhost() {
  if (ghost.active || (TEST && TST.noGhost)) return;
  ghost.active = true; ghost.floor = P.floor === 2 ? 1 : 2; ghost.x = 20; ghost.z = 0; ghost.state = 'patrol'; ghost.path = []; ghost.wait = 2;
  sfx.bang(0, .9); setTimeout(() => talk('wake', 3500), 900);
}
function enrage() {
  if (TEST && TST.noGhost) { blackout = 2; toast('테스트', '유령이 꺼져 있어 최종 추격은 생략됩니다.', 'info'); return; }
  ghost.active = true; ghost.enraged = true; blackout = 3.2;
  setTimeout(() => { ghostRelocate(); ghost.floor = P.floor; sfx.screech(); toast('목표가 갱신되었습니다', '정문으로 달려가라!', 'warn'); talk('enrage', 4000); }, 2600);
  setTimeout(() => phoneMessage(3), 16000);
}
const STAIRS = { 0: { up: 1, down: 4 }, 1: { up: 2, down: 0 }, 2: { up: 3, down: 1 }, 3: { down: 2 }, 4: { up: 0 }, 8: { up: 9 }, 9: { up: 10, down: 8 }, 10: { down: 9 } };
function teleport(to) {
  if (state !== 'playing') return;
  state = 'trans'; $('fade').style.opacity = 1; sfx.stairs();
  setTimeout(() => {
    P.floor = to.floor; P.x = to.x; P.z = to.z; P.yaw = to.yaw; P.pitch = 0;
    if (to.floor === 3 && !P.roofSeen) { P.roofSeen = true; refreshHud(); setTimeout(() => talk('roof', 3200), 600); }
    if (to.floor === 4 && !P.b1Seen) { P.b1Seen = true; setTimeout(() => talk('b1', 3000), 600); }
    if (to.floor === 5 && !P.gymSeen) { P.gymSeen = true; setTimeout(() => talk('gym', 3400), 600); }
    if (to.floor === 7 && !P.cafeSeen) { P.cafeSeen = true; setTimeout(() => talk('cafe', 3400), 600); }
    if (to.floor === 6 && !P.poolSeen) { P.poolSeen = true; setTimeout(() => talk('pool', 3400), 600); }
    $('fade').style.opacity = 0; state = 'playing';
  }, 700);
}
function changeFloor(dir) {
  const info = STAIRS[P.floor]; const nf = info && (dir > 0 ? info.up : info.down); if (nf == null) return;
  const sz = floors[nf].stairZone; teleport(nf === 3 ? { floor: 3, x: 0, z: -7.5, yaw: 0 } : { floor: nf, x: sz ? sz.spawn.x : 2.2, z: sz ? sz.spawn.z : -5.2, yaw: Math.PI });
}
function openGate() {
  if (!FL.gatekey) {
    sfx.click();
    if (P.keys >= TOTAL) { talk('needCombine', 3200); say('열쇠 조각을 먼저 맞춰야 한다 — 소지품(Tab)에서 조합', 3000); }
    else say(`자물쇠가 굳게 잠겨 있다. 정문 열쇠가 필요하다 (조각 ${P.keys}/${TOTAL})`, 2800);
    return;
  }
  escaped = true; gateState = 'opening'; sfx.gateOpen(); say('열쇠가 맞물렸다…', 3000);
  gate.blockRect.x1 = 1e9; gate.blockRect.x2 = 1e9 + 1;
  winGame();
}
// 엔딩: 민아를 깨워 함께 나가면 진 엔딩, 아니면 노멀 엔딩
function winGame() {
  const end = FL.mina ? 'true' : 'normal';
  if (FL.mina) setTimeout(() => talk('withMina', 2800), 400);
  setTimeout(() => {
    state = 'won'; sfx.win(); stopSpeak(); $('hud').classList.remove('show');
    try { const e = new Set(JSON.parse(localStorage.getItem('haegyo_endings') || '[]')); e.add(end); localStorage.setItem('haegyo_endings', JSON.stringify([...e])); localStorage.removeItem(SAVE); } catch (err) { /* ignore */ }
    const vo = end === 'true' ? 'endTrue' : 'endNormal';
    $('endTag').textContent = end === 'true' ? 'TRUE END' : 'NORMAL END'; $('endTag').className = end;
    $('endTitle').textContent = end === 'true' ? '마지막 하교 방송' : '다시 닫힌 문';
    $('winText').innerHTML = VO[vo].text + (end === 'true' ? '' : '<br><br><small style="color:#8a8678">…민아는 아직 방송실에 있다. 하늘의 이야기를 끝내면 다른 결말을 볼 수 있다.</small>');
    const nd = docs.length, tot = DOC_TOTAL();
    $('endStats').innerHTML = `<span>주인공</span><b>${CH().name}</b><span>플레이 시간</span><b>${Math.floor(playTime / 60)}분 ${Math.floor(playTime % 60)}초</b><span>찾은 기록</span><b>${nd} / ${tot}</b><span>난이도</span><b>${DF().label}</b><span>쓰러진 횟수</span><b>${deaths}</b>`;
    setTimeout(() => line(vo), 1200);
    $('win').classList.add('show'); document.exitPointerLock?.();
  }, 3600);
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
  const fl = $('flash'); fl.style.transition = 'none'; fl.style.opacity = SET.flashReduce ? .25 : .9; requestAnimationFrame(() => { fl.style.transition = 'opacity 1.2s'; fl.style.opacity = 0; });
  $('prompt').style.display = 'none';
  if (SET.jump === 'full') { const j = $('jump'); j.classList.remove('show'); void j.offsetWidth; j.classList.add('show'); }
  deaths++; try { localStorage.setItem('haegyo_deaths', deaths); } catch (e) { /* ignore */ }
  setTimeout(() => { $('hud').classList.remove('show'); $('dead').classList.add('show'); $('retryBtn').disabled = !hasSave(); document.exitPointerLock?.(); setTimeout(() => line('endBad'), 700); }, 1900);
}

/* ---------- 이벤트(랜덤 공포 연출) ---------- */
function randomEvent() {
  const r = Math.random();
  const pan = Math.random() * 2 - 1;
  if (r < .35) { sfx.bang(pan, .7); }
  else if (r < .6) { blackout = 1.0 + Math.random() * 1.2; sfx.creak(pan); }
  else if (r < .8) { sfx.whisper(); if (Math.random() < .6) line(['gh1', 'gh2', 'gh3'][(Math.random() * 3) | 0], 'whisper'); }
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
    if ($('inv').classList.contains('show') && e.code !== 'Tab' && e.code !== 'KeyI' && invKey(e)) return;
    if ($('phone').classList.contains('show') && (e.code === 'KeyQ' || e.code === 'KeyE')) { phoneTab = PTABS[(PTABS.indexOf(phoneTab) + (e.code === 'KeyE' ? 1 : 2)) % 3]; renderPhone(); return; }
    if ($('mapOv').classList.contains('show') && (e.code === 'KeyZ' || e.code === 'KeyX')) { mapZoom = clamp(mapZoom * (e.code === 'KeyZ' ? 1.25 : .8), .5, 4); renderMap(); return; }
    if (['Tab', 'Escape', 'KeyI', 'KeyM', 'KeyT', 'KeyP', 'Digit4'].includes(e.code)) closeUI();
    return;
  }
  if (state !== 'playing') return;
  if (e.code === 'Tab' || e.code === 'KeyI') { openInv(); return; }
  if (e.code === 'KeyM') { openMap(); return; }
  if (e.code === 'KeyP' || e.code === 'Digit4') { openPhone(msgs.some(m => !m.read) ? 'msg' : phoneTab); return; }
  if (TEST && e.code === 'KeyT') { openTest(); return; }
  if (e.code === 'Digit1' || e.code === 'KeyF') { P.light = !P.light; sfx.click(); }
  if (e.code === 'Digit2') useBattery();
  if (e.code === 'Digit3') useMedkit();
  if (SET.runToggle && (e.code === 'ShiftLeft' || e.code === 'ShiftRight')) P.runOn = !P.runOn;
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
  const ms = .0022 * SET.sens; P.yaw -= e.movementX * ms; P.pitch = clamp(P.pitch - e.movementY * ms * (SET.invertY ? -1 : 1), -1.45, 1.45);
  if (P.hiding) P.yaw = clamp(P.yaw, P.hiding.yaw - .7, P.hiding.yaw + .7);
});
canvas.addEventListener('click', () => { if (state === 'playing' && !document.pointerLockElement) lock(); });
$('noteBox').addEventListener('click', closeNote);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); fx.resize(innerWidth, innerHeight, renderer.getPixelRatio()); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && (state === 'playing' || state === 'note') && !DEBUG) { if (state === 'note') closeNote(); pauseGame(); }
});
function pauseGame() {
  state = 'paused'; for (const k in keys) keys[k] = false;
  const o = objective(); $('pauseInfo').textContent = `${CHAPTERS[o.ch - 1].title}  ·  ${CH().name}  ·  ${Math.floor(playTime / 60)}분 ${Math.floor(playTime % 60)}초`;
  $('loadBtn2').disabled = !hasSave(); $('pause').classList.add('show');
}
function lock() {
  try { const r = canvas.requestPointerLock({ unadjustedMovement: true }); if (r && r.catch) r.catch(() => { try { const r2 = canvas.requestPointerLock(); if (r2 && r2.catch) r2.catch(() => {}); } catch (e) { /* ignore */ } }); }
  catch (e) { try { canvas.requestPointerLock(); } catch (e2) { /* ignore */ } }
}

/* ---------- 저장 / 불러오기 ---------- */
const SAVE = 'haegyo_save_v4';
let deaths = 0; try { deaths = +localStorage.getItem('haegyo_deaths') || 0; } catch (e) { /* ignore */ }
const hasSave = () => { try { return !!localStorage.getItem(SAVE); } catch (e) { return false; } };
function save(silent) {
  if (state === 'dead' || state === 'won') return;
  const d = {
    meta: { char: CHAR, ch: objective().ch, time: playTime, at: Date.now() }, char: CHAR,
    P: { x: P.x, z: P.z, floor: P.floor, yaw: P.yaw, hp: P.hp, battery: P.battery, stamina: P.stamina, keys: P.keys, light: P.light, roofSeen: P.roofSeen },
    got, inv, FL, power, msgs, clues, docs: docs.map(x => ({ id: x.id, kind: x.kind })), taken: world.items.map(i => i.taken), gateClosed, introDone, playTime,
    props: world.props.map(p => ({ done: !!p.done, label: p.label })),
    ghost: { active: ghost.active, enraged: ghost.enraged, floor: ghost.floor, x: ghost.x, z: ghost.z },
  };
  try { localStorage.setItem(SAVE, JSON.stringify(d)); toast('저장되었습니다', silent ? '자동 저장' : '', 'info'); } catch (e) { toast('저장 실패', '', 'warn'); }
}
function readSave() { try { return JSON.parse(localStorage.getItem(SAVE)); } catch (e) { return null; } }
function load() {
  const d = readSave(); if (!d) return;
  Object.assign(P, d.P); got.splice(0, TOTAL, ...d.got); inv.battery = d.inv.battery; inv.medkit = d.inv.medkit;
  Object.assign(FL, d.FL || {}); power = !!d.power; msgs.push(...(d.msgs || [])); clues.push(...(d.clues || []));
  docs.length = 0; (d.docs || []).forEach(x => addDoc(x));
  world.items.forEach((it, i) => { if (d.taken[i]) { it.taken = true; it.mesh.visible = false; } });
  (d.props || []).forEach((s, i) => { const p = world.props[i]; if (!p || !s.done) return; p.done = true;
    if (p.kind === 'safe') { p.open = 1; p.opening = true; } if (p.kind === 'breaker') p.on = true; if (p.kind === 'mina') mina.visible = false; });
  introDone = d.introDone; playTime = d.playTime;
  if (d.gateClosed) { gateClosed = true; gateState = 'closed'; gateAnim = 1; gate.setOpen(0); }
  if (d.ghost.active && !FL.calm) { Object.assign(ghost, d.ghost, { state: 'patrol', path: [], wait: 2 }); }
  chapterShown = objective().ch; refreshHud(); toast('불러오기 완료', CHAPTERS[chapterShown - 1].title, 'info');
}

function start(skipIntro = false) {
  initAudio(); closeMenus(); applyChar();
  refreshHud(); chapterShown = objective().ch;
  if (skipIntro || TEST) { finishIntro(); return; }
  state = 'intro'; introT = 0; introText = true; $('intro').classList.add('show');
  const ids = ['intro1', 'intro2', 'intro3', 'intro4'], ps = [...$('intro').querySelectorAll('p')];
  ps.forEach((p, i) => { p.classList.remove('on'); p.textContent = i === 2 ? `“${VO[ids[i]].text}”` : VO[ids[i]].text; });
  preload(ids);
  (async () => {
    await new Promise(r => setTimeout(r, 600));
    for (let i = 0; i < 4; i++) {
      if (state !== 'intro') return;
      ps[i].classList.add('on');
      const sec = await speak(ids[i], i === 2 ? 'phone' : 'none');
      await new Promise(r => setTimeout(r, (Math.max(sec, 1.6) + .45) * 1000 / (DEBUG && window.__introJump ? 6 : 1)));
    }
    if (state === 'intro') { introText = false; introT = 6; }
  })();
}
function finishIntro() {
  stopSpeak(); introText = false;
  preload(['phone1', 'phone2', 'phone3', 'pa1', 'gh1', 'gh2', 'gh3', 'gh4', 'cam1', ...Object.keys(LINES).map(k => `l_${k}_${CK()}`)]);
  $('intro').classList.remove('show'); $('introTitle').classList.remove('show'); $('hud').classList.add('show');
  if (!readingSave) { P.x = 0; P.z = 77.5; P.yaw = 0; P.pitch = 0; }
  state = 'playing';
  if (!readingSave) { setTimeout(() => talk('arrive', 4200), 500); setTimeout(() => showChapter(1), 900); }
}
// 인트로: 검은 화면 텍스트(0~6초) → 폐교를 향한 카메라 돌리(6~13초)
function updateIntro(dt) {
  introT += dt * (DEBUG && window.__introJump ? 6 : 1);
  const ease = t => t * t * (3 - 2 * t);
  if (introText) introT = Math.min(introT, 5.99);
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

/* ---------- 타이틀 · 캐릭터 선택 ---------- */
let readingSave = false;
const MENUS = ['title', 'charsel', 'newConfirm', 'settings', 'gallery', 'credits'];
function closeMenus() { MENUS.forEach(k => $(k).classList.remove('show')); }
function applyChar() {
  const c = CH();
  document.documentElement.style.setProperty('--acc', c.color);
  $('pName').textContent = c.name; $('pAge').textContent = `${c.age} · ${c.school.split(' ')[1] || ''}`; $('dlgName').textContent = c.name;
  curFace = ''; updateFace(0);
}
function newGame() {
  try { localStorage.removeItem(SAVE); } catch (e) { /* ignore */ }
  lock(); start();
}
function continueGame() { readingSave = true; lock(); start(true); load(); }
function refreshTitle() {
  const d = readSave();
  $('mContinue').style.display = d ? 'block' : 'none';
  if (d && d.meta) { const c = CHARACTERS[d.meta.char]; $('mContInfo').textContent = `${c ? c.name : ''} · 제${d.meta.ch}장 · ${Math.floor(d.meta.time / 60)}분`; }
  $('mCharName').textContent = CH().name;
  let ends = []; try { ends = JSON.parse(localStorage.getItem('haegyo_endings') || '[]'); } catch (e) { /* ignore */ }
  $('tEnd').textContent = ends.length ? `달성한 엔딩: ${ends.map(e => e === 'true' ? 'TRUE' : 'NORMAL').join(' · ')}  ·  ` : '';
  const btns = [...$('tMenu').querySelectorAll('button')].filter(b => b.style.display !== 'none'); btns.forEach((b, i) => b.classList.toggle('sel', i === 0));
}
let csMode = 'view', csPick = CHAR;
function openCharsel(mode) {
  csMode = mode; csPick = CHAR; $('title').classList.remove('show'); $('charsel').classList.add('show');
  $('csOk').textContent = mode === 'new' ? '결정 · 시작' : '결정'; renderCharsel(); sfx.ui && sfx.ui();
}
function renderCharsel() {
  $('csCards').innerHTML = Object.entries(CHARACTERS).map(([k, c]) => `
    <div class="cs${k === csPick ? ' on' : ''}" data-k="${k}" style="--c:${c.color}">
      <img class="pt" src="assets/ui/${c.portrait}.webp" alt="">
      <div><h3>${c.name}<small>${c.age} · ${c.sex}</small></h3>
        <table><tr><td>학교</td><td>${c.school}</td></tr><tr><td>성격</td><td>${c.pers}</td></tr><tr><td>특징</td><td>${c.trait}</td></tr><tr><td>소개</td><td>${c.intro}</td></tr></table>
        <div class="q">“${c.quote}”</div></div>
      <img class="bd" src="assets/ui/${c.body}.webp" alt="">
      <div class="faces">${c.faces.map((f, i) => `<figure><img src="assets/ui/${f}.webp" alt="">${c.faceNames[i]}</figure>`).join('')}</div>
      <div class="perk">${c.perk.map(p => `<span>★ ${p}</span>`).join('')}</div>
      <div class="kit"><b>시작 아이템</b><div class="its">${c.items.map(id => `<div class="it">${iconHTML(ITEMS[id].icon)}<span>${ITEMS[id].name.replace(/ \(.*\)/, '')}</span></div>`).join('')}</div></div>
    </div>`).join('');
  $('csCards').querySelectorAll('.cs').forEach(el => { el.onclick = () => { csPick = el.dataset.k; renderCharsel(); sfx.ui && sfx.ui(); }; el.ondblclick = () => $('csOk').click(); });
}
$('csOk').onclick = () => {
  CHAR = csPick; try { localStorage.setItem('haegyo_char', CHAR); } catch (e) { /* ignore */ }
  applyChar();
  if (csMode === 'new') { $('charsel').classList.remove('show'); newGame(); }
  else { $('charsel').classList.remove('show'); $('title').classList.add('show'); refreshTitle(); toast('주인공 선택', `${CH().name}(으)로 플레이합니다`, 'info'); }
};
$('csPrev').onclick = $('csBack').onclick = () => { $('charsel').classList.remove('show'); $('title').classList.add('show'); refreshTitle(); };
$('mContinue').onclick = () => { closeMenus(); continueGame(); };
$('mNew').onclick = () => { if (hasSave()) $('newConfirm').classList.add('show'); else openCharsel('new'); };
$('ncYes').onclick = () => { $('newConfirm').classList.remove('show'); openCharsel('new'); };
$('ncNo').onclick = () => $('newConfirm').classList.remove('show');
$('mChar').onclick = () => openCharsel('view');
$('mSet').onclick = () => openSettings('title');
$('mGal').onclick = () => openGallery();
$('mCred').onclick = () => { $('credTable').innerHTML = CREDITS.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join(''); $('credits').classList.add('show'); };
$('credClose').onclick = () => $('credits').classList.remove('show');
$('mQuit').onclick = () => { $('bye').classList.add('show'); try { window.close(); } catch (e) { /* ignore */ } };
$('byeBack').onclick = () => $('bye').classList.remove('show');
document.querySelectorAll('#tMenu button').forEach(b => b.addEventListener('mouseenter', () => { document.querySelectorAll('#tMenu button').forEach(x => x.classList.toggle('sel', x === b)); sfx.ui && sfx.ui(); }));
addEventListener('keydown', e => {
  if (state !== 'menu') return;
  if ($('charsel').classList.contains('show')) {
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) { csPick = csPick === 'jihun' ? 'seoyeon' : 'jihun'; renderCharsel(); }
    else if (e.code === 'Enter') $('csOk').click(); else if (e.code === 'Escape') $('csBack').click();
    return;
  }
  if (!$('title').classList.contains('show') || MENUS.slice(2).some(k => $(k).classList.contains('show'))) { if (e.code === 'Escape') MENUS.slice(2).forEach(k => $(k).classList.remove('show')); return; }
  const btns = [...$('tMenu').querySelectorAll('button')].filter(b => b.style.display !== 'none'); let i = btns.findIndex(b => b.classList.contains('sel'));
  if (e.code === 'ArrowDown' || e.code === 'ArrowUp' || e.code === 'KeyS' || e.code === 'KeyW') { i = (i + (e.code === 'ArrowDown' || e.code === 'KeyS' ? 1 : btns.length - 1)) % btns.length; btns.forEach((b, k) => b.classList.toggle('sel', k === i)); sfx.ui && sfx.ui(); }
  else if (e.code === 'Enter' && i >= 0) btns[i].click();
});
$('saveBtn').addEventListener('click', () => save());
$('titleBtn').addEventListener('click', () => location.reload());
$('loadBtn2').addEventListener('click', () => { try { sessionStorage.setItem('haegyo_auto', 'continue'); } catch (e) { /* ignore */ } location.reload(); });
$('resumeBtn').addEventListener('click', () => { lock(); $('pause').classList.remove('show'); state = 'playing'; });
$('retryBtn').addEventListener('click', () => { try { sessionStorage.setItem('haegyo_auto', 'continue'); } catch (e) { /* ignore */ } location.reload(); });
$('restartBtn').addEventListener('click', () => { try { localStorage.removeItem(SAVE); sessionStorage.setItem('haegyo_auto', 'new'); } catch (e) { /* ignore */ } location.reload(); });
$('deadTitleBtn').addEventListener('click', () => location.reload());
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
    const wantRun = (SET.runToggle ? P.runOn : (keys.ShiftLeft || keys.ShiftRight)) && want && !P.tired && P.stamina > 0;
    if (wantRun) { P.sprinting = true; P.stamina = Math.max(0, P.stamina - (CHAR === 'jihun' ? 16 : 20) * dt); if (P.stamina <= 0) { P.tired = true; P.runOn = false; talk('sprint', 2200); } }
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
      if (P.stepD > (P.sprinting ? 1.9 : 1.45)) { P.stepD = 0; sfx.step(P.sprinting, 1, surfaceAt()); }
    } else P.stepD = 0;
  } else if (P.hiding) P.stamina = Math.min(100, P.stamina + 25 * dt);
  P.noiseT = Math.max(0, (P.noiseT || 0) - dt);
  P.noise = P.hiding ? 0 : P.noiseT > 0 ? 9 : P.sprinting ? 15 : P.moving ? 5.5 : 0;

  // 정문 닫힘 연출
  if (!gateClosed && state === 'playing' && P.z < GATE_Z - 3) {
    gateClosed = true; gateState = 'closing'; sfx.gateClang(); shake = .8; if (P.z > GATE_Z - 8) lookBack = 1.9;
    setTimeout(() => { toast('정문이 잠겼습니다', '민아의 흔적을 따라 학교 안으로', 'warn'); talk('gate', 4200); refreshHud(); }, 800);
  }
  if (!introDone && P.floor === 0 && P.z < 1.2) { introDone = true; talk('inside', 3500); refreshHud(); setTimeout(() => toast('팁', '쪽지를 읽고, 사물함에 숨어 시선을 피하세요. (Tab 소지품 · P 휴대폰 · M 지도)', 'info'), 1500); }

  P.invuln = Math.max(0, P.invuln - dt);
  if (!P.bcast && P.floor === 2 && Math.abs(P.x + 24) < 3.8 && P.z < -2) { P.bcast = true; sfx.broadcast(); setTimeout(() => line('pa1', 'pa'), 900); setTimeout(() => talk('speakers', 3600), 8500); }
  // 손전등/배터리
  if (P.light && P.battery > 0) P.battery = Math.max(0, P.battery - .75 * dt * (CHAR === 'seoyeon' ? .75 : 1) * DF().battery);
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
  const bob = SET.bob ? Math.sin(P.bob) * (P.sprinting ? .05 : .028) : 0;
  let ey = P.hiding ? 1.45 : 1.62 + bob;
  camera.position.set(P.x, F.y0 + ey, P.z);
  let yaw = P.yaw, pitch = P.pitch;
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.4); const k = SET.shake ? .05 : .008; yaw += (Math.random() - .5) * k * shake; pitch += (Math.random() - .5) * k * shake; }
  const G = ghost; let prox = 0, chase = false;
  if (G.active && G.floor === P.floor) { prox = clamp(1 - Math.hypot(G.x - P.x, G.z - P.z) / 14, 0, 1); chase = G.state === 'chase' || !!G.hunt; }
  if (state === 'dead') { const dx = G.x - P.x, dz = G.z - P.z; yaw = Math.atan2(-dx, -dz); pitch = .1; }
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  const fov = SET.fov + (P.sprinting ? 6 : 0) + (chase ? 4 : 0) + (state === 'dead' ? -10 : 0);
  camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 6)); camera.updateProjectionMatrix();
  $('fear').style.opacity = SET.fearFx ? clamp(prox * (chase ? 1.2 : .7), 0, 1) : 0;
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
  const want = faceT > 0 ? faceOver : P.fear > .6 ? 'fear' : P.hp <= 50 ? 'resolve' : 'basic';
  const src = `assets/ui/${CH().faces[FACE[want] ?? 0]}.webp`;
  if (src !== curFace) { curFace = src; $('portrait').src = $('dlgFace').src = src; }
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
Object.values(CHARACTERS).forEach(c => c.faces.forEach(k => { const im = new Image(); im.src = `assets/ui/${k}.webp`; }));
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
const REF_TITLES = ['폐교 실내 공간 3D 모델링 시트', '폐교 정문 3D 배경 시트', '교실 소품 오브젝트 시트', '폐교 내부 3D 배치도', '폐교 배치도 / 건물 도면', '주인공 캐릭터 시트', '인게임 화면 · UI 구성', '특수 공간 상세 배치도', '상호작용 UI 시트', '체육관 내부 시트', '방송실 내부 배치', '수영장 내부 배치', '방송실 · 수영장 · 지하 B1', '학교 지도', '급식실 배치도', '별관 (특별교실동)', '서문 상세 안내도', '방송실 상세 배치도', '수영장 샤워실 · 탈의실', '전체 배치도 · 오브젝트 · 이펙트 시트'];
let galTab = 'ref';
function openGallery(tab = galTab) {
  galTab = tab; document.querySelectorAll('#galTabs button').forEach(b => b.classList.toggle('on', b.dataset.g === galTab));
  const gw = $('galGrid'); gw.innerHTML = '';
  const fig = (thumb, big, cap, lock) => {
    const d = document.createElement('figure'); if (lock) d.className = 'lock';
    d.innerHTML = `<img src="${lock ? 'assets/ui/charsel_blur.webp' : thumb}" alt="" loading="lazy" style="${thumb.includes('/ui/') && !lock ? 'object-fit:contain;background:#0a0d10' : ''}"><figcaption>${lock ? '🔒 ' + cap : cap}</figcaption>`;
    if (!lock) d.onclick = () => { $('lbImg').src = big; $('lbCap').textContent = cap; $('lightbox').classList.add('show'); };
    gw.appendChild(d);
  };
  if (galTab === 'ref') REF_TITLES.forEach((t, i) => { const n = String(i + 1).padStart(2, '0'); fig(`assets/ref/${n}_t.webp`, `assets/ref/${n}.webp`, `${i + 1}. ${t}`); });
  else if (galTab === 'char') Object.values(CHARACTERS).forEach(c => {
    fig(`assets/ui/${c.portrait}.webp`, `assets/ui/${c.portrait}.webp`, `${c.name} — 초상`); fig(`assets/ui/${c.body}.webp`, `assets/ui/${c.body}.webp`, `${c.name} — 전신`);
    c.faces.forEach((f, i) => fig(`assets/ui/${f}.webp`, `assets/ui/${f}.webp`, `${c.name} — ${c.faceNames[i]}`));
  });
  else {
    let ends = []; try { ends = JSON.parse(localStorage.getItem('haegyo_endings') || '[]'); } catch (e) { /* ignore */ }
    fig('assets/ui/title_main.webp', 'assets/ui/title_main.webp', 'TRUE END — 마지막 하교 방송', !ends.includes('true'));
    fig('assets/img/gate_night.webp', 'assets/img/gate_night.webp', 'NORMAL END — 다시 닫힌 문', !ends.includes('normal'));
    fig('assets/img/ghost_cut.webp', 'assets/img/ghost_cut.webp', 'BAD END — 다시, 여기서', deaths === 0);
  }
  $('gallery').classList.add('show');
}
document.querySelectorAll('#galTabs button').forEach(b => { b.onclick = () => openGallery(b.dataset.g); });
addEventListener('pointerdown', () => initAudio(), { once: true });
$('galBtn2').addEventListener('click', () => openGallery());
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
    drawMap(g, 150, 150, { floor: P.floor, cx: P.x, cz: P.z, scale: 2.6, pins: mapPins(P.floor), ...mapExtras(P.floor), t: tNow, mini: true, player: { x: P.x, z: P.z, yaw: P.yaw } });
    g.restore();
  }
  updatePerks(dt);
}
// 고유 능력 — 서연: 가까운 그것의 방향 감지 / 지훈: 조사 가능한 단서가 빛나 보인다
const glintTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,250,220,1)'); r.addColorStop(.15, 'rgba(255,230,160,.8)'); r.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(255,255,235,.9)'; g.fillRect(31, 4, 2, 56); g.fillRect(4, 31, 56, 2);
  return new THREE.CanvasTexture(c); })();
const glints = [];
for (let i = 0; i < 8; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); sp.visible = false; scene.add(sp); glints.push(sp); }
let glintT = 0;
function updatePerks(dt) {
  const sense = $('sense');
  if (CHAR === 'seoyeon' && ghost.active && ghost.floor === P.floor && state === 'playing') {
    const dx = ghost.x - P.x, dz = ghost.z - P.z, d = Math.hypot(dx, dz);
    const rx = dx * Math.cos(P.yaw) - dz * Math.sin(P.yaw), fw = -dx * Math.sin(P.yaw) - dz * Math.cos(P.yaw);
    sense.style.opacity = d < 22 ? clamp((22 - d) / 14, .15, .9) : 0; sense.style.transform = `rotate(${Math.atan2(rx, fw)}rad)`;
  } else sense.style.opacity = 0;
  glintT -= dt;
  if (CHAR !== 'jihun' || state !== 'playing') { glints.forEach(g => { g.visible = false; }); return; }
  if (glintT <= 0) {
    glintT = .3;
    const c = world.items.filter(i => !i.taken && !i.locked && i.floor === P.floor && i.kind !== 'battery' && i.kind !== 'medkit')
      .map(i => ({ p: i.pos, d: Math.hypot(i.pos.x - P.x, i.pos.z - P.z) }))
      .concat(world.props.filter(p => p.floor === P.floor && !p.done && (p.kind === 'tape' || p.kind === 'mina' || p.kind === 'safe')).map(p => ({ p: { x: p.x, y: floors[p.floor].y0 + (p.y ?? 1) , z: p.z }, d: Math.hypot(p.x - P.x, p.z - P.z) })))
      .filter(o => o.d < 11).sort((a, b) => a.d - b.d).slice(0, glints.length);
    glints.forEach((g, i) => { const o = c[i]; g.visible = !!o; if (o) g.position.set(o.p.x, o.p.y + .18, o.p.z); g.userData.d = o ? o.d : 99; });
  }
  glints.forEach((g, i) => { if (!g.visible) return; const k = .5 + .5 * Math.sin(tNow * 3 + i * 1.7); g.scale.setScalar(.28 + k * .22); g.material.opacity = (.35 + k * .5) * clamp((11 - g.userData.d) / 4, 0, 1); });
}

function updatePrompt() {
  const pr = $('prompt');
  if (state !== 'playing') { pr.style.display = 'none'; return; }
  if (P.hiding) { pr.style.display = 'block'; pr.innerHTML = '<kbd>E</kbd>사물함에서 나가기'; return; }
  target = findInteract();
  if (target) { pr.style.display = 'block'; pr.innerHTML = target.raw ? target.label.replace(/\b([EQ]) /g, '<kbd>$1</kbd>') : `<kbd>E</kbd>${target.label}`; } else pr.style.display = 'none';
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
    if ($('intro').classList.contains('show')) { requestAnimationFrame(frame); return; }   // 검은 화면 텍스트 동안은 3D를 그리지 않는다
  } else if (state === 'menu') {
    if (MENUS.some(k => $(k).classList.contains('show'))) { requestAnimationFrame(frame); return; }
    camera.position.set(Math.sin(tNow * .1) * 3, 2.2, 74); camera.rotation.set(-.05, Math.sin(tNow * .1) * .1, 0, 'YXZ');
    updateLighting(dt);
  }
  world.update(tNow, blackout > 0);
  // 날씨: 번개 (밖이거나 창가에서), 전기 불꽃
  const outdoorsNow = isOutdoors();
  if (state === 'playing' || state === 'menu' || state === 'intro') {
    lightningT -= dt;
    if (lightningT <= 0) { lightningT = 22 + Math.random() * 35; fx.lightning(); const far = 1 + Math.random() * 2.5; setTimeout(() => sfx.thunder && sfx.thunder(far), far * 700); }
  }
  if (state === 'playing') {
    sparkT -= dt;
    if (sparkT <= 0) {
      sparkT = 1.5 + Math.random() * 3;
      const sp = (floors[P.floor].sparks || []).filter(s => Math.hypot(s.x - P.x, s.z - P.z) < 9);
      if (sp.length && Math.random() < .5) { const s = sp[(Math.random() * sp.length) | 0]; fx.spark(s.x, floors[P.floor].y0 + s.y, s.z); sfx.spark && sfx.spark(); }
    }
  }
  hurtFx = Math.max(0, hurtFx - dt * .8);
  updateSound(dt);
  fx.render(dt, { fear: P.fear || 0, flash: flash.intensity / 95, outdoors: outdoorsNow, floorY: floors[P.floor].y0, hurt: hurtFx });
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
    talk('breaker', 3200); addClue('power'); refreshHud();
    if (ghost.active && ghost.floor === P.floor) { ghost.state = 'search'; ghost.target = { x: P.x, z: P.z }; ghost.wait = 0; ghost.replan = 0; }
  } else if (p.kind === 'tape') {
    sfx.tape(); p.label = '녹음기 다시 재생';
    setTimeout(() => line(p.id, 'radio', '📼 ' + p.spk), 450);
    if (!docs.find(d => d.id === p.id)) { addDoc({ id: p.id, kind: 'tape' }); toast('녹음 테이프를 들었습니다', p.title + ' — 소지품 › 문서에서 다시 듣기', 'info'); if (CLUES[p.id]) addClue(p.id); if (p.id === 'tape4' || p.id === 'tape2') unlockOptional(); refreshHud(); }
  } else if (p.kind === 'bell') {
    if (p.cd > 0) { sfx.click(); say('벨이 아직 울리지 않는다…', 1500); return; }
    p.cd = 60; at(p.bx, floors[p.floor].y0 + 1.5, p.bz).bell(); P.noiseT = 1; shake = .25;
    toast('비상벨', '학교에 벨이 울린다. 그것이 이곳으로 온다 — 숨어!', 'warn');
    if (ghost.active) {
      if (ghost.floor !== p.floor) { const sz = floors[p.floor].stairZone; ghost.floor = p.floor; ghost.x = sz ? sz.spawn.x : 2.2; ghost.z = sz ? sz.spawn.z : -5.2; ghost.spawnGrace = 2; }
      ghost.state = 'search'; ghost.target = { x: p.bx, z: p.bz + .8 }; ghost.path = []; ghost.replan = 0; ghost.wait = 0; ghost.lureT = 20; ghost.hunt = null;
    }
  } else if (p.kind === 'console') {
    if (!power) { sfx.click(); talk('needPower', 3200); say('전원이 들어오지 않는다. 지하 전기실의 차단기를 올려야 한다.', 2800); return; }
    if (FL.calm) { say('스피커는 이제 조용하다.', 2000); return; }
    if (FL.tag) { haneulBroadcast(); return; }
    if (consoleCD > 0) { sfx.buzz(); say(`장비가 과열됐다… (${Math.ceil(consoleCD)}초)`, 2000); return; }
    consoleCD = 90; sfx.broadcast(); setTimeout(() => line('pa1', 'pa'), 800);
    toast('교내 방송', '학교 전체에 소리가 울렸다. 그것이 방송실로 향한다 (25초)', 'warn');
    talk('lure', 3200); if (FL.opt) setTimeout(() => talk('needTag', 3400), 5200);
    if (ghost.active) { ghost.floor = 2; ghost.x = -24; ghost.z = -5.5; ghost.state = 'search'; ghost.target = { x: -24, z: -5.5 }; ghost.path = []; ghost.lureT = 25; ghost.spawnGrace = 2; ghost.hunt = null; }
  } else if (p.kind === 'mina') {
    if (!FL.calm) { talk(p.tried ? 'minaAsleep' : 'minaFound', 3200); p.tried = true; say('숨은 쉬고 있다… 무언가가 아직 그녀를 붙잡고 있다.', 3000); unlockOptional(); return; }
    p.done = true; FL.mina = true; sfx.paper();
    line(`mw_${CK()}`, 'none', '민아').then(sec => setTimeout(() => { talk('withMina', 3000); }, (sec + .5) * 1000));
    fadeOut(mina, 1.2); addClue('mina'); toast('민아를 찾았습니다', '함께 정문으로 — 진 엔딩 조건 달성', 'opt'); refreshHud(); save(true);
  }
}
// 진 엔딩 루트: 명찰을 가진 채 방송 → 하늘의 하교 방송 → 그것이 사라진다
function haneulBroadcast() {
  FL.calm = true; consoleCD = 999; sfx.broadcast(); shake = .3; voBusy = true; setTimeout(() => { voBusy = false; }, 26000);
  toast('하교 방송', '3학년 2반 윤하늘의 이름을 불렀다…', 'opt');
  if (ghost.active) { ghost.state = 'search'; ghost.hunt = null; ghost.lureT = 60; ghost.target = { x: ghost.x, z: ghost.z }; ghost.path = []; }
  setTimeout(async () => {
    const sec = await line(`bc_${CK()}`, 'pa', `📢 ${CH().name}`);
    setTimeout(async () => {
      ghost.active = false; ghost.enraged = false; ghost.hunt = null;
      if (P.floor === 2) showApparition(2, -24.6, -3.6, Math.atan2(P.x + 24.6, P.z + 3.6), 5, null);
      const s2 = await line('ghThanks', 'none', '하늘');
      setTimeout(() => {
        talk('calm', 3200); addClue('calm'); refreshHud(); save(true);
        toast('특별 목표 달성', '그것은 더 이상 쫓아오지 않는다', 'opt');
        setTimeout(() => talk('findMina', 3400), 4200);
      }, (s2 + .6) * 1000);
    }, (sec + .8) * 1000);
  }, 900);
}
function fadeOut(obj, sec) {
  const ms = []; obj.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; ms.push(o.material); } });
  let t = 0; const iv = setInterval(() => { t += .05; ms.forEach(m => { m.opacity = Math.max(0, 1 - t / sec); }); if (t >= sec) { clearInterval(iv); obj.visible = false; } }, 50);
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
    setTimeout(() => { closeUI(); kpProp.opening = true; kpProp.done = true; kpProp.key.locked = false; kpProp.key.mesh.visible = true; toast('금고가 열렸다', '안에 열쇠 조각이 있다'); talk('safeOpen', 3000); addClue('safe'); }, 700);
  } else {
    $('kpDisp').textContent = 'E R R'; $('kpDisp').className = 'err'; sfx.buzz(); kpBuf = '';
    setTimeout(renderKeypad, 700);
    if (!kpProp.hinted) { kpProp.hinted = true; setTimeout(() => talk('safeHint', 3000), 900); }
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
// 민아의 음성 메시지 — 휴대폰(P) 메시지함에 쌓인다
function phoneMessage(n) {
  const id = 'phone' + n;
  if (msgs.some(m => m.id === id) || (n === 3 && FL.calm)) return;
  if (state !== 'playing' || voBusy) { setTimeout(() => phoneMessage(n), 4000); return; }
  msgs.push({ id, t: clockText(), read: false }); sfx.phone(); toast('📱 새 메시지 — 민아', '신호가 없는데 메시지가 도착했다 (P: 휴대폰)', 'info');
  if (CLUES[id]) addClue(id);
  if (n === 2) unlockOptional();
  refreshHud();
  setTimeout(() => { if (state !== 'playing') return; talk('phone', 2600); setTimeout(() => line(id, 'phone', '📱 민아'), 2600); }, 1200);
}
function updateEvents(dt) {
  if (consoleCD > 0) consoleCD -= dt;
  for (const p of world.props) { if (p.kind === 'safe' && p.opening && p.open < 1) p.open = Math.min(1, p.open + dt * 1.2); if (p.kind === 'bell' && p.cd > 0) p.cd -= dt; }
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
    if (d && Math.random() < .35) { d.target = 0; d.slam = true; sfx.doorBang(0, .9); shake = .45; EV.slamCD = 100 + Math.random() * 80; setTimeout(() => talk('doorSlam', 2400), 500); }
    else EV.slamCD = 8;
  }
  // ② 음악실 피아노
  if (room && room.type === 'music') evOnce('piano' + f, () => { sfx.piano(); setTimeout(() => talk('piano', 2800), 1200); });
  // ③ 화장실 칸막이 문이 쾅
  if (room && room.type === 'toilet' && EV.roomT > 1.4) evOnce('stall', () => { const d = world.doorList.find(o => o.stall && o.floor === f && o.target > .5); if (d) { d.target = 0; d.slam = true; } sfx.doorBang(-.3, 1); shake = .4; setTimeout(() => talk('stall', 2000), 600); });
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
    setTimeout(() => { if (state !== 'playing') return; sfx.lightsOff(); blackout = 4.2; [14, 10, 7, 4.5, 3].forEach((d, i) => setTimeout(() => sfx.ghostStep(d, .4), 700 + i * 550)); setTimeout(() => talk('steps', 2600), 4400); }, 1500);
  });
  // ⑦ 체육관 · 수영장 · 급식실 입장
  if (f === 5) evOnce('gym', () => { sfx.ball(); setTimeout(() => talk('ball', 2800), 2400); });
  if (f === 6) evOnce('pool', () => { sfx.drip(); setTimeout(() => { sfx.splash(); }, 5200); });
  // ⑧ 방송실 도착 시 두 번째 메시지
  if (room && room.type === 'broadcast') evOnce('bcMsg', () => setTimeout(() => phoneMessage(2), 4000));
}

/* ---------- 이야기 오브젝트: 민아의 캠코더 · 윤하늘의 명찰 · 장비실의 민아 ---------- */
function storyItem(kind, f, x, y, z, mesh, label, glowColor) {
  const F = floors[f]; mesh.position.set(x, F.y0 + y, z); mesh.userData.dynamic = true; F.interior.add(mesh);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, color: glowColor, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .55 }));
  sp.scale.setScalar(.55); sp.position.y = .06; mesh.add(sp);
  world.items.push({ kind, floor: f, pos: new THREE.Vector3(x, F.y0 + y, z), mesh, taken: false, label });
}
{ // 캠코더 (1-1 교실 교탁 위)
  const g = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: .45, metalness: .3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(.08, .075, .17), dark); body.position.y = .04; g.add(body);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(.03, .032, .06, 18).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: .2, metalness: .6 })); lens.position.set(0, .045, -.11); g.add(lens);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(.024, 18), new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: .05, metalness: .9 })); glass.position.set(0, .045, -.141); glass.rotation.y = Math.PI; g.add(glass);
  const scr = new THREE.Mesh(new THREE.BoxGeometry(.005, .05, .07), new THREE.MeshBasicMaterial({ color: 0x4a6a8a })); scr.position.set(.045, .045, .0); scr.rotation.y = .5; g.add(scr);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(.035, .006, 6, 16, Math.PI), dark); strap.position.set(-.042, .06, .02); strap.rotation.y = Math.PI / 2; g.add(strap);
  const rec = new THREE.Mesh(new THREE.SphereGeometry(.006, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 })); rec.position.set(.02, .08, -.06); g.add(rec);
  g.rotation.y = .6;
  storyItem('camcorder', 0, SLOTS[5] + 2.95, .77, -8.5, g, '민아의 캠코더 줍기', 0xffd0a0);
}
{ // 윤하늘의 명찰 (지하 펌프실 바닥)
  const c = document.createElement('canvas'); c.width = 256; c.height = 80; const x = c.getContext('2d');
  x.fillStyle = '#e9e3d0'; x.fillRect(0, 0, 256, 80); x.fillStyle = '#2a4a7a'; x.fillRect(0, 0, 256, 16); x.fillStyle = 'rgba(120,90,50,.35)'; x.beginPath(); x.ellipse(170, 52, 70, 26, .3, 0, 7); x.fill();
  x.fillStyle = '#1a1a1a'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.fillText('3-2 윤하늘', 128, 60);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(.09, .004, .028), [0, 0, new THREE.MeshStandardMaterial({ map: t, roughness: .5 }), 0, 0, 0].map(m => m || new THREE.MeshStandardMaterial({ color: 0xd8d0b8, roughness: .5 })));
  g.add(plate); const pin = new THREE.Mesh(new THREE.BoxGeometry(.06, .003, .004), new THREE.MeshStandardMaterial({ color: 0x999999, metalness: .8, roughness: .3 })); pin.position.set(0, -.003, 0); g.add(pin);
  g.rotation.y = .9;
  storyItem('nametag', 4, SLOTS[8] - 3, .02, -4.5, g, '명찰 줍기', 0xc8a0ff);
}
// 장비실에 주저앉은 민아 (서현고 교복)
const mina = new THREE.Group();
{
  const F = floors[2], navy = new THREE.MeshStandardMaterial({ color: 0x1c2233, roughness: .85 }), shirt = new THREE.MeshStandardMaterial({ color: 0xd8d6cc, roughness: .8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc9a48a, roughness: .7 }), hairM = new THREE.MeshStandardMaterial({ color: 0x17120f, roughness: .6 }), skirt = new THREE.MeshStandardMaterial({ color: 0x3a3440, roughness: .9 });
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); mina.add(o); return o; };
  add(new THREE.CylinderGeometry(.2, .24, .16, 14), skirt, 0, .1, .02);
  [-1, 1].forEach(s => { add(new THREE.CylinderGeometry(.055, .05, .42, 8), skin, s * .09, .1, .3, Math.PI / 2 - .15); add(new THREE.BoxGeometry(.08, .07, .2), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .6 }), s * .09, .05, .55); });
  add(new THREE.BoxGeometry(.34, .44, .2), navy, 0, .42, -.04, -.18);
  add(new THREE.BoxGeometry(.12, .2, .01), shirt, 0, .52, .06, -.18);
  add(new THREE.CylinderGeometry(.045, .05, .08, 8), skin, 0, .67, -.02);
  const head = add(new THREE.SphereGeometry(.1, 18, 14), skin, .03, .76, .0, .35, 0, .35); head.scale.set(.9, 1.1, .95);
  add(new THREE.SphereGeometry(.112, 18, 12, 0, Math.PI * 2, 0, Math.PI * .6), hairM, .03, .79, -.02, -.05, 0, .35);
  add(new THREE.BoxGeometry(.22, .32, .05), hairM, .06, .62, -.08, .1, 0, .3);
  [-1, 1].forEach(s => { add(new THREE.CylinderGeometry(.04, .035, .4, 8), navy, s * .2, .36, .06, -.5, 0, s * .15); add(new THREE.SphereGeometry(.035, 8, 6), skin, s * .22, .2, .22); });
  mina.position.set(-21.65, F.y0, -8.45); mina.userData.dynamic = true; F.interior.add(mina);
  mina.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  world.props.push({ kind: 'mina', floor: 2, x: -21.65, z: -7.9, y: .8, label: '민아 깨우기' });
}

/* ---------- 성능 / 그래픽 품질 ---------- */
const QUAL = { high: { pr: 1.5, sh: 1024, label: '높음' }, mid: { pr: 1, sh: 512, label: '보통' }, low: { pr: .75, sh: 0, label: '낮음' } };
let qCur = 'high', perfAcc = 0, perfN = 0, perfWin = 0, fpsShown = 60;
function applyQuality(q) {
  qCur = q; const c = QUAL[q];
  renderer.setPixelRatio(Math.min(devicePixelRatio, c.pr) * SET.scale); renderer.setSize(innerWidth, innerHeight); fx.resize(innerWidth, innerHeight, renderer.getPixelRatio()); fx.setQuality(q);
  const sh = c.sh > 0;
  if (sh && flash.shadow.mapSize.x !== c.sh) { flash.shadow.mapSize.set(c.sh, c.sh); if (flash.shadow.map) { flash.shadow.map.dispose(); flash.shadow.map = null; } }
  if (renderer.shadowMap.enabled !== sh || flash.castShadow !== sh) {
    renderer.shadowMap.enabled = sh; flash.castShadow = sh;
    scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); });
  }
}
function perfTick(dt) {
  if (state !== 'playing') return;
  perfAcc += dt; perfN++; perfWin += dt;
  if (perfWin >= 2.5) {
    const fps = perfN / perfAcc; fpsShown = fps; perfAcc = 0; perfN = 0; perfWin = 0;
    $('fps').textContent = `${fps.toFixed(0)} FPS · ${QUAL[qCur].label}`;
    if (SET.quality === 'auto' && fps < 38 && qCur !== 'low') { applyQuality(qCur === 'high' ? 'mid' : 'low'); toast('그래픽 품질 자동 조정', `${QUAL[qCur].label}(으)로 낮췄습니다`, 'info'); }
  }
}
// 설정을 실제 화면 · 조작에 반영
function applySettings() {
  renderer.toneMappingExposure = 1.3 * SET.bright;
  fx.setOpts({ bloom: SET.bloom, grain: SET.grain, glitch: SET.flashReduce ? .2 : 1, flash: SET.flashReduce ? .25 : 1 });
  $('fps').classList.toggle('on', SET.showFps || TEST); $('hints').style.display = SET.hints ? '' : 'none';
  document.documentElement.style.setProperty('--subBg', SET.subBg);
  document.body.classList.toggle('noNames', !SET.subNames);
  if (state !== 'playing') { camera.fov = SET.fov; camera.updateProjectionMatrix(); }
}
applyQuality(SET.quality === 'auto' ? 'high' : SET.quality);
applySettings();
// 로딩 중에 모든 공간의 텍스처·셰이더를 미리 준비 (처음 들어가는 곳에서 멈칫하는 문제)
warmUp(renderer, scene, camera, [...floors.map(f => f.interior), ...floors.map(f => f.shell), world.OUT, ghost.group, appar]);
const _t3 = performance.now();
window.__loadTimes = { textures: Math.round(_t1 - _t0), build: Math.round(_t2 - _t1), warmup: Math.round(_t3 - _t2) };
$('loading').classList.remove('show');

/* ---------- 설정 화면 ---------- */
let settingsFrom = null, setTab = 'gfx';
function showSetTab(t) { setTab = t; document.querySelectorAll('#setTabs button').forEach(b => b.classList.toggle('on', b.dataset.s === t)); document.querySelectorAll('.setPage').forEach(p => p.classList.toggle('on', p.dataset.s === t)); }
function fillSettings() {
  $('setScreen').value = document.fullscreenElement ? 'full' : 'win';
  $('quality2').value = SET.quality; $('setScale').value = SET.scale * 100; $('setBright').value = SET.bright * 100; $('setFov').value = SET.fov;
  $('setBloom').checked = SET.bloom; $('setGrain').checked = SET.grain; $('setBob').checked = SET.bob; $('setShake').checked = SET.shake; $('setFps').checked = SET.showFps;
  const v = getVolumes(); ['master', 'sfx', 'voice', 'amb', 'music'].forEach(k => { $('vol_' + k).value = Math.round(v[k] * 100); });
  $('setSens').value = SET.sens * 100; $('setInvY').checked = SET.invertY; $('setRun').value = SET.runToggle ? 'toggle' : 'hold'; $('setHints').checked = SET.hints;
  $('setVoice').value = VS.mode; $('setVoice').querySelector('[value=browser]').disabled = !hasBrowserVoice();
  $('setSubs').checked = VS.subs; $('setNotes').checked = VS.readNotes; $('setSubSize').value = String(VS.subSize); $('setNames').checked = SET.subNames; $('setSubBg').value = SET.subBg * 100;
  $('setDiff').value = SET.diff; $('setJump').value = SET.jump; $('setFlash').checked = SET.flashReduce; $('setFearFx').checked = SET.fearFx;
  vals();
}
function vals() {
  $('vScale').textContent = Math.round(SET.scale * 100) + '%'; $('vBright').textContent = Math.round(SET.bright * 100) + '%'; $('vFov').textContent = SET.fov + '°';
  $('vSens').textContent = SET.sens.toFixed(2) + '×'; $('vSubBg').textContent = Math.round(SET.subBg * 100) + '%';
}
function openSettings(from) {
  settingsFrom = from; if (from === 'pause') $('pause').classList.remove('show');
  fillSettings(); showSetTab(setTab); $('settings').classList.add('show');
}
function closeSettings() { $('settings').classList.remove('show'); if (settingsFrom === 'pause') $('pause').classList.add('show'); }
$('settingsClose').onclick = $('settingsClose2').onclick = closeSettings;
document.querySelectorAll('#setTabs button').forEach(b => { b.onclick = () => showSetTab(b.dataset.s); });
$('setBtn2').onclick = () => openSettings('pause');
const setS = (k, v) => { SET[k] = v; saveSET(); applySettings(); vals(); };
$('setScreen').onchange = e => { try { if (e.target.value === 'full') document.documentElement.requestFullscreen(); else if (document.fullscreenElement) document.exitFullscreen(); } catch (err) { /* ignore */ } };
$('quality2').onchange = e => { setS('quality', e.target.value); applyQuality(SET.quality === 'auto' ? 'high' : SET.quality); };
$('setScale').oninput = e => { setS('scale', e.target.value / 100); };
$('setScale').onchange = () => applyQuality(qCur);
$('setBright').oninput = e => setS('bright', e.target.value / 100);
$('setFov').oninput = e => setS('fov', +e.target.value);
$('setBloom').onchange = e => setS('bloom', e.target.checked); $('setGrain').onchange = e => setS('grain', e.target.checked);
$('setBob').onchange = e => setS('bob', e.target.checked); $('setShake').onchange = e => setS('shake', e.target.checked); $('setFps').onchange = e => setS('showFps', e.target.checked);
['master', 'sfx', 'voice', 'amb', 'music'].forEach(k => { $('vol_' + k).oninput = e => { setVolumes({ [k]: e.target.value / 100 }); }; });
$('vol_voice').onchange = () => speak(`l_heal_${CK()}`);
$('vol_sfx').onchange = () => sfx.doorBang(0, .6);
$('setSens').oninput = e => setS('sens', e.target.value / 100); $('setInvY').onchange = e => setS('invertY', e.target.checked);
$('setRun').onchange = e => setS('runToggle', e.target.value === 'toggle'); $('setHints').onchange = e => setS('hints', e.target.checked);
$('setVoice').onchange = e => { VS.mode = e.target.value; saveVS(); stopSpeak(); speak('intro1'); };
$('setSubs').onchange = e => { VS.subs = e.target.checked; saveVS(); };
$('setNotes').onchange = e => { VS.readNotes = e.target.checked; saveVS(); };
$('setSubSize').onchange = e => { VS.subSize = +e.target.value; saveVS(); subtitle('미리보기', '자막 크기가 이렇게 보입니다.', 2.5); };
$('setNames').onchange = e => { setS('subNames', e.target.checked); subtitle('미리보기', '화자 이름 표시', 2); };
$('setSubBg').oninput = e => { setS('subBg', e.target.value / 100); subtitle('미리보기', '자막 배경 진하기', 1.5); };
$('setDiff').onchange = e => setS('diff', e.target.value); $('setJump').onchange = e => setS('jump', e.target.value);
$('setFlash').onchange = e => setS('flashReduce', e.target.checked); $('setFearFx').onchange = e => setS('fearFx', e.target.checked);
$('setReset').onclick = () => { resetSET(); setVolumes({ master: 1, sfx: 1, voice: 1, amb: 1, music: 1 }); VS.mode = 'file'; VS.subs = true; VS.readNotes = true; VS.subSize = 1; saveVS(); applySettings(); applyQuality(SET.quality === 'auto' ? 'high' : SET.quality); fillSettings(); toast('설정', '기본값으로 되돌렸습니다', 'info'); };
document.querySelectorAll('.btn').forEach(b => b.addEventListener('mouseenter', () => sfx.ui()));

/* ---------- 테스트 모드 (?test) ---------- */
const TP = [
  ['정문 앞 (도로)', { floor: 0, x: 0, z: 76, yaw: 0 }], ['운동장 · 본관 현관', { floor: 0, x: 0, z: 4, yaw: 0 }],
  ['본관 1F 복도', { floor: 0, x: 0, z: 0, yaw: -Math.PI / 2 }], ['본관 2F 복도', { floor: 1, x: 0, z: 0, yaw: -Math.PI / 2 }],
  ['본관 3F (방송실 앞)', { floor: 2, x: -24, z: 0, yaw: 0 }], ['옥상', { floor: 3, x: 0, z: -7.5, yaw: 0 }],
  ['지하 B1', { floor: 4, x: 0, z: 0, yaw: -Math.PI / 2 }], ['체육관', { floor: 5, x: 38, z: 28.1, yaw: 0 }],
  ['수영장', { floor: 6, x: -35.5, z: 38, yaw: Math.PI / 2 }], ['급식실', { floor: 7, x: -39, z: 20.5, yaw: 0 }],
  ['별관 1F', { floor: 8, x: 0, z: .2, yaw: -Math.PI / 2 }], ['별관 2F', { floor: 9, x: 0, z: 0, yaw: -Math.PI / 2 }],
  ['별관 3F', { floor: 10, x: 0, z: 0, yaw: -Math.PI / 2 }], ['서문 앞', { floor: 0, x: -46.5, z: 32, yaw: Math.PI / 2 }],
  ['1-1 교실 (캠코더)', { floor: 0, x: 8, z: -3, yaw: 0 }], ['B1 펌프실 (명찰)', { floor: 4, x: 32, z: -3, yaw: 0 }], ['방송실 장비실 (민아)', { floor: 2, x: -21.4, z: -5.0, yaw: 0 }],
  ['교무실 금고', { floor: 0, x: -10.4, z: -8.0, yaw: Math.PI / 2 }], ['보건실 녹음기', { floor: 0, x: -26.4, z: -4.6, yaw: Math.PI / 2 }], ['B1 전기실', { floor: 4, x: -16, z: -4, yaw: Math.PI / 2 }], ['3-3 교실', { floor: 2, x: -8, z: -3, yaw: 0 }], ['음악실', { floor: 2, x: 32, z: -3, yaw: 0 }],
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
  ac.appendChild(b('정문 열쇠 조합', false, () => testAct(() => { if (P.keys < TOTAL) { world.items.filter(i => i.kind === 'key').forEach(i => { i.taken = true; i.mesh.visible = false; got[i.idx] = true; }); P.keys = TOTAL; } makeGateKey(); })));
  ac.appendChild(b('특별 목표 준비 (명찰+전력)', false, () => testAct(() => { const t = world.items.find(i => i.kind === 'nametag'); if (t && !t.taken) { t.taken = true; t.mesh.visible = false; } FL.tag = true; FL.opt = true; power = true; world.props.forEach(p => { if (p.kind === 'breaker') { p.on = true; p.done = true; } }); refreshHud(); toast('테스트', '명찰 획득 · 전력 복구 — 방송실에서 하교 방송', 'opt'); })));
  ac.appendChild(b('최종 추격 시작', false, () => testAct(() => enrage())));
  ac.appendChild(b('보급품 채우기', false, () => testAct(() => { P.hp = 100; P.battery = 100; P.stamina = 100; inv.battery = 5; inv.medkit = 5; refreshHud(); toast('테스트', 'HP·배터리·건전지·응급 밴드 보충', 'info'); })));
  ac.appendChild(b('모든 문 열기', false, () => testAct(() => world.doorList.forEach(d => { d.target = 1; }))));
  ac.appendChild(b('전력 복구', false, () => testAct(() => { power = true; world.props.forEach(p => { if (p.kind === 'breaker') { p.on = true; p.done = true; } }); toast('테스트', '전력 복구', 'info'); })));
  ac.appendChild(b('모든 문서 획득', false, () => testAct(() => { world.items.filter(i => i.kind === 'note' && !i.taken).forEach(i => { i.taken = true; i.mesh.visible = false; addDoc({ id: i.id, kind: 'note' }); if (CLUES[i.id]) addClue(i.id); }); refreshHud(); toast('테스트', `문서 ${docs.length}개`, 'info'); })));
  $('testInfo').textContent = `현재: ${AREA_NAMES[P.floor]} (${P.x.toFixed(1)}, ${P.z.toFixed(1)})  ·  열쇠 ${P.keys}/${TOTAL}  ·  유령 ${ghost.active ? AREA_NAMES[ghost.floor] + ' / ' + ghost.state : '비활성'}`;
}
function openTest() { if (state !== 'playing') return; openUI('testOv'); renderTest(); }
if (TEST) {
  document.body.classList.add('test');
  $('testBadge').style.display = 'block';
  $('tTest').style.display = 'block'; $('testLink').style.display = 'none';
}
// 시작: 타이틀 표시 (재시도 · 처음부터는 바로 이어서)
applyChar(); refreshTitle();
{ let auto = null; try { auto = sessionStorage.getItem('haegyo_auto'); sessionStorage.removeItem('haegyo_auto'); } catch (e) { /* ignore */ }
  if (auto === 'continue' && hasSave()) { closeMenus(); continueGame(); } else if (auto === 'new') { closeMenus(); newGame(); } }

if (DEBUG) {
  window.__g = {
    P, ghost, floors, world, scene, camera, renderer, start: () => start(true),
    tp(x, z, f = 0, yaw = 0, pitch = 0) { P.x = x; P.z = z; P.floor = f; P.yaw = yaw; P.pitch = pitch; },
    give() { world.items.filter(i => i.kind === 'key').forEach(i => { i.taken = true; i.mesh.visible = false; got[i.idx] = true; }); P.keys = TOTAL; refreshHud(); },
    get state() { return state; }, set state(v) { state = v; }, get tNow() { return tNow; }, openTest, EV, appar, applyQuality,
    interact, die, activateGhost, enrage, FL, docs, msgs, clues, objective, makeGateKey, openInv, openPhone, openMap, openCharsel, openSettings, refreshHud, save, load, inv, mina,
    get power() { return power; }, set power(v) { power = v; }, get CHAR() { return CHAR; }, newGame, continueGame,
    setTarget(t) { target = t; },
  };
}
