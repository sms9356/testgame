// 폐교 — 다시, 여기서 : 1인칭 학교 공포 게임 (Three.js)
import * as THREE from './vendor/three.module.js';
import { buildWorld, collide, los, FH, GATE_Z, KEY_NAMES } from './world.js';
import { initAudio, sfx, setProximity } from './audio.js';

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

/* ---------- 렌더러 / 씬 ---------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);
scene.fog = new THREE.FogExp2(0x070a12, 0.03);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 320);
scene.add(camera);

const hemi = new THREE.HemisphereLight(0x8aa0d0, 0x2a2018, 0.4);
scene.add(hemi);
const moonLight = new THREE.DirectionalLight(0x7f9ae0, 1.0);
moonLight.position.set(-40, 90, -120); scene.add(moonLight);
const flash = new THREE.SpotLight(0xfff0d0, 0, 30, 0.5, 0.55, 1.3);
flash.position.set(0.12, -0.08, 0); flash.target.position.set(0, 0, -6);
camera.add(flash, flash.target);
const pool = [];
for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xcfe6d6, 0, 12, 1.7); scene.add(l); pool.push(l); }

const world = buildWorld(scene);
const floors = world.floors;

/* ---------- 상태 ---------- */
let state = 'menu';            // menu | playing | paused | note | dead | won
let tNow = 0, playTime = 0;
const P = {
  x: 0, z: 77.5, floor: 0, yaw: 0, pitch: 0, light: true, battery: 100, stamina: 100, tired: false,
  keys: 0, moving: false, sprinting: false, hiding: null, bob: 0, stepD: 0, noise: 0, fade: 0,
};
const got = [false, false, false, false];
let gateClosed = false, gateAnim = 0, gateState = 'open';
let blackout = 0, shake = 0, nextEvent = 40, lampTimer = 0, introDone = false, escaped = false;
const keys = {};

/* ---------- 유령 ---------- */
function buildGhost() {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const dressM = new THREE.MeshStandardMaterial({ color: 0xd4cfc4, roughness: 1, emissive: 0x3a3630, side: THREE.DoubleSide });
  const hairM = new THREE.MeshStandardMaterial({ color: 0x050404, roughness: 1, side: THREE.DoubleSide });
  const skinM = new THREE.MeshStandardMaterial({ color: 0xc4bdb0, roughness: .9, emissive: 0x28251f });
  const pts = [[.02, 0], [.36, 0], [.44, .08], [.36, .5], [.26, .95], [.2, 1.25], [.14, 1.4], [.1, 1.5]].map(p => new THREE.Vector2(p[0], p[1]));
  const dress = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), dressM); dress.position.y = .3; inner.add(dress);
  const head = new THREE.Group(); head.position.y = 1.9; head.rotation.x = .22; inner.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(.12, 14, 12), skinM); face.scale.set(.9, 1.15, .95); head.add(face);
  const black = new THREE.MeshBasicMaterial({ color: 0x000000 }), white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-1, 1].forEach(s => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(.032, 8, 8), black); e.scale.set(1, 1.7, .6); e.position.set(s * .045, .02, .105); head.add(e);
    const p = new THREE.Mesh(new THREE.SphereGeometry(.008, 6, 6), white); p.position.set(s * .045, .02, .122); head.add(p);
  });
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 8), black); mouth.scale.set(1, 1.8, .5); mouth.position.set(0, -.06, .108); head.add(mouth);
  const hb = new THREE.Mesh(new THREE.SphereGeometry(.15, 12, 10), hairM); hb.scale.set(1, 1.15, 1); hb.position.set(0, .01, -.04); head.add(hb);
  for (let i = 0; i < 9; i++) {
    const a = -1.9 + i * .475;
    const c = new THREE.Mesh(new THREE.ConeGeometry(.06, 1.35, 5), hairM); c.rotation.x = Math.PI;
    c.position.set(Math.sin(a) * .12, -.62, -Math.cos(a) * .1 - .02 + (Math.abs(Math.sin(a)) > .8 ? .1 : 0)); head.add(c);
  }
  const arms = [];
  [-1, 1].forEach(s => {
    const pv = new THREE.Group(); pv.position.set(s * .2, 1.72, .02); inner.add(pv);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(.03, .022, 1.15, 6), skinM); arm.position.y = -.57; pv.add(arm);
    for (let k = -1; k <= 1; k++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(.006, .004, .2, 4), skinM); f.position.set(k * .02, -1.2, 0); pv.add(f); }
    pv.rotation.set(-.35, 0, s * .1); arms.push(pv);
  });
  const glow = new THREE.PointLight(0xaa2222, 0.7, 5); glow.position.set(0, 1.8, .4); g.add(glow);
  g.visible = false; scene.add(g);
  return { group: g, inner, head, arms, glow };
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
  out.push({ x: bx, z: bz }); return out;
}

function ghostRelocate() {
  const G = ghost, F = floors[P.floor];
  G.floor = P.floor;
  const ends = [{ x: -34, z: 0 }, { x: 34, z: 0 }, { x: 0, z: -5.2 }];
  ends.sort((a, b) => Math.hypot(b.x - P.x, b.z - P.z) - Math.hypot(a.x - P.x, a.z - P.z));
  let s = ends[0];
  if (Math.hypot(ends[2].x - P.x, ends[2].z - P.z) > 14 && !G.enraged && Math.random() < .6) s = ends[2];
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

  // 다른 층이면 일정 시간 뒤 플레이어 층으로 이동
  if (!same) {
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
    if (dist < range && los(F.walls, G.x, G.z, P.x, P.z)) sees = true;
  }
  // 청각 판정
  if (!P.hiding && !G.hunt && !(outP && !G.enraged) && G.state !== 'chase' && dist < P.noise) {
    G.state = 'search'; G.target = { x: P.x, z: P.z }; G.wait = 0; G.replan = 0;
  }
  if (G.hunt) { /* 사물함으로 직행 */ }
  else if (sees && G.spawnGrace <= 0) {
    if (G.state !== 'chase') { G.state = 'chase'; sfx.alert(); say('...들켰다. 숨거나, 달려!', 2200); }
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
    if (Math.hypot(G.hunt.x - G.x, G.hunt.z - G.z) < 1.3) { if (P.hiding) leaveLocker(true); die(); return; }
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

  // 사물함 수색
  if (P.hiding && !G.hunt) {
    const l = P.hiding;
    if (Math.hypot(l.x - G.x, l.z - G.z) < 2.6) { G.findT += dt; if (G.findT > 5.2) G.hunt = { x: l.x, z: l.z + .6 }; } else G.findT = Math.max(0, G.findT - dt);
  }

  // 붙잡힘
  if (sees && dist < 1.05 && G.spawnGrace <= 0) { die(); return; }

  // 발소리
  G.stepT -= dt * (speed / 1.5);
  if (G.stepT <= 0) { G.stepT = .55; const pan = ((G.x - P.x) * Math.cos(P.yaw) - (G.z - P.z) * Math.sin(P.yaw)) / Math.max(1, dist); sfx.ghostStep(dist, pan); }
}

function ghostVisual(dt, t) {
  const G = ghost; if (!G.active) { G.group.visible = false; return; }
  G.group.visible = G.floor === P.floor && !(P.floor === 0 && P.z > 1.9 && G.z > 1.8 && false);
  G.group.position.set(G.x, floors[G.floor].y0 + .08 + Math.sin(t * 2) * .05, G.z);
  G.group.rotation.y = G.yaw;
  const chasing = G.state === 'chase' || G.hunt;
  G.inner.rotation.z = Math.sin(t * 1.7) * .05;
  G.head.rotation.z = Math.sin(t * .9) * .15 + (chasing ? Math.sin(t * 30) * .06 : 0);
  G.inner.position.x = chasing ? (Math.random() - .5) * .04 : 0;
  G.arms.forEach((a, i) => { a.rotation.x = -.35 + Math.sin(t * (chasing ? 7 : 1.4) + i * 2) * (chasing ? .5 : .12) - (chasing ? .6 : 0); });
  G.glow.intensity = .5 + .4 * Math.sin(t * 5);
}

/* ---------- UI ---------- */
let msgTimer = 0;
function say(text, ms = 3000) { const m = $('msg'); m.textContent = text; m.classList.add('show'); clearTimeout(msgTimer); msgTimer = setTimeout(() => m.classList.remove('show'), ms); }
function refreshHud() {
  const els = document.querySelectorAll('.key'); els.forEach((e, i) => e.classList.toggle('on', got[i]));
  $('objText').textContent = P.keys >= 4 ? '정문으로 달려가 문을 열어라!' : `정문 열쇠 조각 ${P.keys}/4 — ${KEY_NAMES.filter((n, i) => !got[i]).join(', ')}`;
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
    if (it.taken || it.floor !== P.floor) continue;
    const dx = it.pos.x - P.x, dz = it.pos.z - P.z, d = Math.hypot(dx, dz);
    if (d > 2.3) continue;
    const f = (dx * fx + dz * fz) / Math.max(d, .01);
    const s = f - d * .1; if (f > .72 && s > bs) { bs = s; best = { type: 'item', it, label: it.label }; }
  }
  for (const l of world.lockers) {
    if (l.floor !== P.floor) continue;
    const dx = l.x - P.x, dz = l.z - P.z, d = Math.hypot(dx, dz);
    if (d > 1.7) continue; const f = (dx * fx + dz * fz) / Math.max(d, .01);
    const s = f - d * .1; if (f > .35 && s > bs) { bs = s; best = { type: 'locker', l, label: '사물함에 숨기' }; }
  }
  if (!best) {
    if (P.x > -1 && P.x < 4 && P.z > -9.3 && P.z < -2) {
      const up = P.floor < 2, down = P.floor > 0;
      best = { type: 'stairs', label: [up ? 'E 위층' : '', down ? 'Q 아래층' : ''].filter(Boolean).join('  /  '), raw: true };
      if (!up && !down) best = null;
    } else if (P.floor === 0 && P.z > GATE_Z - 4.5 && P.z < GATE_Z + 3 && Math.abs(P.x) < 6 && gateClosed && !escaped) best = { type: 'gate', label: '정문 열기' };
  }
  return best;
}
function interact() {
  if (!target) return;
  if (target.type === 'item') {
    const it = target.it;
    if (it.kind === 'note') { showNote(it); return; }
    it.taken = true; it.mesh.visible = false;
    if (it.kind === 'key') {
      got[it.idx] = true; P.keys++; sfx.key(); refreshHud();
      say(`열쇠 조각을 찾았다 (${P.keys}/4)`, 3200);
      if (P.keys === 1) activateGhost();
      if (P.keys === 4) enrage();
    } else { P.battery = Math.min(100, P.battery + 45); sfx.pickup(); say('건전지를 교체했다', 2000); }
  } else if (target.type === 'locker') enterLocker(target.l);
  else if (target.type === 'stairs') changeFloor(1);
  else if (target.type === 'gate') openGate();
}

function activateGhost() {
  if (ghost.active) return;
  ghost.active = true; ghost.floor = P.floor === 2 ? 1 : 2; ghost.x = 20; ghost.z = 0; ghost.state = 'patrol'; ghost.path = []; ghost.wait = 2;
  sfx.bang(0, .9); setTimeout(() => say('위층에서 무언가 움직이는 소리가 들린다...', 3500), 900);
}
function enrage() {
  ghost.active = true; ghost.enraged = true; blackout = 3.2;
  setTimeout(() => { ghostRelocate(); ghost.floor = P.floor; sfx.screech(); say('그것이 깨어났다. 정문으로 달려라!', 4000); }, 2600);
}
function changeFloor(dir) {
  if (state !== 'playing') return;
  const nf = P.floor + dir; if (nf < 0 || nf > 2) return;
  state = 'trans'; $('fade').style.opacity = 1; sfx.stairs();
  setTimeout(() => { P.floor = nf; P.x = 2.2; P.z = -5.2; P.yaw = Math.PI; P.pitch = 0; $('fade').style.opacity = 0; state = 'playing'; }, 700);
}
function openGate() {
  if (P.keys < 4) { sfx.click(); say(`자물쇠가 굳게 잠겨 있다. 열쇠 조각이 더 필요하다 (${P.keys}/4)`, 2800); return; }
  escaped = true; gateState = 'opening'; sfx.gateOpen(); say('열쇠가 맞물렸다…', 3000);
  gate.blockRect.x1 = 1e9; gate.blockRect.x2 = 1e9 + 1;
  setTimeout(() => { state = 'won'; sfx.win(); $('winText').innerHTML = `당신은 폐교를 빠져나왔다.<br>뒤돌아보지 마라.<br><br>소요 시간 ${Math.floor(playTime / 60)}분 ${Math.floor(playTime % 60)}초`; $('win').classList.add('show'); document.exitPointerLock?.(); }, 3600);
}
const gate = world.gate;

function enterLocker(l) {
  const G = ghost;
  P.hiding = l; sfx.locker();
  P.x = l.x; P.z = l.z + .12; P.yaw = Math.PI; P.pitch = 0;
  $('hide').classList.add('show');
  if (G.active && G.floor === P.floor && (G.state === 'chase') && Math.hypot(G.x - P.x, G.z - P.z) < 9 && los(floors[P.floor].walls, G.x, G.z, P.x, P.z)) G.hunt = { x: l.x, z: l.z + .6 };
  say('숨을 죽여라…  (E 나가기)', 2500);
}
function leaveLocker(silent) {
  const l = P.hiding; if (!l) return;
  P.hiding = null; $('hide').classList.remove('show'); P.x = l.x; P.z = -.45; P.yaw = 0; P.pitch = 0;
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
  if (e.repeat) return;
  keys[e.code] = true;
  if (state === 'note' && (e.code === 'KeyE' || e.code === 'Escape' || e.code === 'Space')) { closeNote(); return; }
  if (state !== 'playing') return;
  if (e.code === 'KeyF') { P.light = !P.light; sfx.click(); }
  if (e.code === 'KeyE') { if (P.hiding) leaveLocker(); else interact(); }
  if (e.code === 'KeyQ' && target && target.type === 'stairs') changeFloor(-1);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('mousemove', e => {
  if (state !== 'playing' && state !== 'dead') return;
  if (!document.pointerLockElement && !DEBUG) return;
  if (state === 'dead') return;
  P.yaw -= e.movementX * .0022; P.pitch = clamp(P.pitch - e.movementY * .0022, -1.45, 1.45);
  if (P.hiding) P.yaw = clamp(P.yaw, Math.PI - .7, Math.PI + .7);
});
$('noteBox').addEventListener('click', closeNote);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && (state === 'playing' || state === 'note') && !DEBUG) { if (state === 'note') closeNote(); state = 'paused'; $('pause').classList.add('show'); for (const k in keys) keys[k] = false; }
});
function lock() { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignore */ } }
function start() {
  initAudio(); $('menu').classList.remove('show'); $('hud').classList.add('show');
  state = 'playing'; refreshHud();
  setTimeout(() => say('정문 너머, 불 꺼진 학교가 어둠 속에 서 있다.', 3600), 500);
}
$('startBtn').addEventListener('click', () => { lock(); start(); });
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
  if (!P.hiding && state === 'playing') {
    const want = !!(fw || sd);
    const wantRun = (keys.ShiftLeft || keys.ShiftRight) && want && !P.tired && P.stamina > 0;
    if (wantRun) { P.sprinting = true; P.stamina = Math.max(0, P.stamina - 20 * dt); if (P.stamina <= 0) P.tired = true; }
    else { P.stamina = Math.min(100, P.stamina + (want ? 9 : 18) * dt); if (P.tired && P.stamina > 30) P.tired = false; }
    if (want) {
      const sp = P.sprinting ? 5.0 : 2.8;
      const l = Math.hypot(fw, sd) || 1;
      const dx = (-Math.sin(P.yaw) * fw + Math.cos(P.yaw) * sd) / l, dz = (-Math.cos(P.yaw) * fw - Math.sin(P.yaw) * sd) / l;
      const ox = P.x, oz = P.z;
      P.x += dx * sp * dt; P.z += dz * sp * dt;
      collide(F.col, P, .32);
      if (P.floor === 0 && gateClosed) collide([gate.blockRect], P, .32);
      const mv = Math.hypot(P.x - ox, P.z - oz);
      P.moving = mv > .0005; P.bob += mv * (P.sprinting ? 2.4 : 2.9); P.stepD += mv;
      if (P.stepD > (P.sprinting ? 1.9 : 1.45)) { P.stepD = 0; sfx.step(P.sprinting); }
    } else P.stepD = 0;
  } else if (P.hiding) P.stamina = Math.min(100, P.stamina + 25 * dt);
  P.noise = P.hiding ? 0 : P.sprinting ? 15 : P.moving ? 5.5 : 0;

  // 정문 닫힘 연출
  if (!gateClosed && state === 'playing' && P.z < GATE_Z - 3) {
    gateClosed = true; gateState = 'closing'; sfx.gateClang(); shake = .8;
    setTimeout(() => say('정문이 등 뒤에서 닫혔다. 열쇠가 없으면 나갈 수 없다…', 4500), 800);
  }
  if (!introDone && P.floor === 0 && P.z < 1.2) { introDone = true; say('학교 안은 숨소리까지 들릴 만큼 조용하다.', 3500); }

  // 손전등/배터리
  if (P.light && P.battery > 0) P.battery = Math.max(0, P.battery - .75 * dt);
  if (P.battery <= 0 && P.light) { P.light = false; say('손전등이 꺼졌다…', 2000); }
}

function updateGate(dt) {
  if (gateState === 'closing') { gateAnim = Math.min(1, gateAnim + dt / .9); gate.setOpen(1 - easeOut(gateAnim)); if (gateAnim >= 1) { gateState = 'closed'; gate.setOpen(0); } }
  else if (gateState === 'opening') { gateAnim = Math.max(0, gateAnim - dt / 3); gate.setOpen(1 - easeOut(gateAnim)); }
  if (gateState === 'closed') gate.lockGlow.visible = true;
  if (gateState === 'opening') gate.lockGlow.visible = false;
}
const easeOut = t => 1 - Math.pow(1 - t, 3);

function updateLighting(dt) {
  const F = floors[P.floor];
  const indoors = P.floor > 0 || (P.z < 1.45 && P.z > -9.9 && Math.abs(P.x) < 36.3);
  const k = Math.min(1, dt * 3);
  moonLight.intensity = lerp(moonLight.intensity, indoors ? 0 : 1.1, k);
  hemi.intensity = lerp(hemi.intensity, indoors ? .2 : .5, k);
  scene.fog.density = lerp(scene.fog.density, indoors ? .05 : .024, k);
  floors.forEach(f => { f.interior.visible = f.f === P.floor && (P.floor === 0 || indoors); });
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
  $('bat').firstElementChild.style.width = P.battery + '%';
  $('sta').firstElementChild.style.width = P.stamina + '%';
  $('sta').firstElementChild.style.background = P.tired ? '#a85040' : '#7aa7b8';
  const outdoors = P.floor === 0 && !(P.z < 1.45 && P.z > -9.9 && Math.abs(P.x) < 36.3);
  $('floor').textContent = outdoors ? '외부' : (P.floor + 1) + 'F';
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
  const dt = Math.min(.05, (now - last) / 1000); last = now; tNow += dt;
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
    }
    updateLighting(dt);
    ghostVisual(dt, tNow);
    updateCamera(dt, tNow);
  } else if (state === 'menu') {
    camera.position.set(Math.sin(tNow * .1) * 3, 2.2, 74); camera.rotation.set(-.05, Math.sin(tNow * .1) * .1, 0, 'YXZ');
    updateLighting(dt);
  }
  world.update(tNow, blackout > 0);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (DEBUG) {
  window.__g = {
    P, ghost, floors, world, scene, camera, start,
    tp(x, z, f = 0, yaw = 0, pitch = 0) { P.x = x; P.z = z; P.floor = f; P.yaw = yaw; P.pitch = pitch; },
    give() { world.items.filter(i => i.kind === 'key').forEach(i => { i.taken = true; i.mesh.visible = false; got[i.idx] = true; }); P.keys = 4; refreshHud(); },
    get state() { return state; }, set state(v) { state = v; },
    interact, die, activateGhost, enrage,
    setTarget(t) { target = t; },
  };
}
