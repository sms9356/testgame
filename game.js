// 폐교 — 다시, 여기서 : 1인칭 학교 공포 게임 (Three.js)
import * as THREE from './vendor/three.module.js';
import { buildWorld, collide, los, FH, GATE_Z, KEY_NAMES, KEY_ROOMS, AREA_NAMES } from './world.js';
import { drawMap } from './map.js';
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
  keys: 0, hp: 100, invuln: 0, fear: 0, roofSeen: false, moving: false, sprinting: false, hiding: null, bob: 0, stepD: 0, noise: 0, fade: 0,
};
const TOTAL = KEY_NAMES.length;
const got = KEY_NAMES.map(() => false);
const inv = { battery: 0, medkit: 0 }, docs = [];
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
function drawFace(c) {
  const g = c.getContext('2d'), s = c.width / 64; g.setTransform(s, 0, 0, s, 0, 0); g.clearRect(0, 0, 64, 64);
  g.fillStyle = '#10161c'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#3a2a22'; g.beginPath(); g.ellipse(51, 36, 6, 14, .4, 0, 6.3); g.fill(); g.beginPath(); g.ellipse(32, 28, 19, 21, 0, 0, 6.3); g.fill();
  g.fillStyle = '#d8cbb0'; g.beginPath(); g.ellipse(32, 70, 30, 16, 0, 0, 6.3); g.fill(); g.fillStyle = '#8a8a92'; g.beginPath(); g.ellipse(32, 66, 22, 12, 0, 0, 6.3); g.fill();
  g.fillStyle = '#e8c8b0'; g.beginPath(); g.ellipse(32, 32, 14, 17, 0, 0, 6.3); g.fill();
  g.fillStyle = '#3a2a22'; g.beginPath(); g.moveTo(17, 29); g.quadraticCurveTo(32, 5, 47, 29); g.quadraticCurveTo(38, 20, 32, 23); g.quadraticCurveTo(24, 20, 17, 29); g.fill();
  g.fillStyle = '#2a1c18'; [26, 38].forEach(x => { g.beginPath(); g.ellipse(x, 35, 1.9, 2.6, 0, 0, 6.3); g.fill(); });
  g.strokeStyle = '#a0605a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(29, 44); g.quadraticCurveTo(32, 45.5, 35, 44); g.stroke();
}
drawFace($('portrait')); drawFace($('dlgFace'));

/* ----- 인벤토리 / 지도 UI ----- */
let invTab = 'items', invSel = 0, mapFloor = 0, uiPrev = 'playing';
const TABS = ['items', 'docs', 'keys'];
function invItems() {
  return [
    { icon: '🔦', name: '손전등', desc: `어두운 곳을 비추는 손전등. 배터리 ${Math.round(P.battery)}% 남음. (F)`, act: ['켜기 / 끄기', () => { P.light = !P.light; }] },
    inv.battery > 0 && { icon: '🔋', name: '건전지', count: inv.battery, desc: '손전등용 건전지. 사용하면 배터리가 45% 회복된다.', act: ['사용하기', useBattery] },
    inv.medkit > 0 && { icon: '🩹', name: '응급 밴드', count: inv.medkit, desc: '상처 치료용 응급 밴드. 사용하면 체력이 50 회복된다.', act: ['사용하기', useMedkit] },
    { icon: '🪪', name: '학생증', desc: '대학교 1학년 한서연. 휴학 중. 사진 속 표정이 지금보다 밝다.' },
    { icon: '📱', name: '스마트폰', desc: '액정이 깨졌고 신호가 없다. 마지막 메시지: “여기, 아직 누군가의 흔적이 남아있어.”' },
    { icon: '📻', name: '무전기', desc: '잡음만 들린다. 가끔 누군가 속삭이는 것 같다.' },
    { icon: '📓', name: '노트', desc: '단서를 기록하는 노트. 모은 쪽지는 문서 탭에서 다시 읽을 수 있다.' },
    { icon: '🗺', name: '학교 지도', desc: '직접 그린 학교 지도. 목표 위치가 표시되어 있다. (M)', act: ['지도 열기', () => { closeUI(); openMap(); }] },
  ].filter(Boolean);
}
function renderInv() {
  document.querySelectorAll('#inv .tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === invTab));
  const list = $('invList'), det = $('invDetail'); list.className = invTab === 'docs' ? 'docs' : ''; list.innerHTML = ''; det.innerHTML = '';
  if (invTab === 'items') {
    const its = invItems(); invSel = Math.min(invSel, its.length - 1);
    its.forEach((it, i) => { const c = document.createElement('div'); c.className = 'cell' + (i === invSel ? ' sel' : ''); c.innerHTML = it.icon + (it.count ? `<em>${it.count}</em>` : ''); c.onclick = () => { invSel = i; renderInv(); }; list.appendChild(c); });
    const it = its[invSel]; det.innerHTML = `<h3>${it.icon} ${it.name}</h3>${it.desc}`;
    if (it.act) { const b = document.createElement('button'); b.textContent = it.act[0]; b.onclick = () => { it.act[1](); renderInv(); }; det.appendChild(b); }
  } else if (invTab === 'docs') {
    if (!docs.length) { list.innerHTML = '<p style="color:#8d897d">아직 모은 문서가 없다.</p>'; return; }
    invSel = Math.min(invSel, docs.length - 1);
    docs.forEach((d, i) => { const c = document.createElement('div'); c.className = 'doc' + (i === invSel ? ' sel' : ''); c.textContent = '📄 ' + d.title; c.onclick = () => { invSel = i; renderInv(); }; list.appendChild(c); });
    const d = docs[invSel]; det.innerHTML = `<h3>${d.title}</h3><div class="paper">${d.text}</div>`;
  } else {
    KEY_NAMES.forEach((n, i) => { const c = document.createElement('div'); c.className = 'doc' + (i === invSel ? ' sel' : ''); c.style.opacity = got[i] ? 1 : .45; c.textContent = `🗝 ${n} 열쇠 조각 — ${got[i] ? '획득' : '미획득'}`; c.onclick = () => { invSel = i; renderInv(); }; list.appendChild(c); });
    invSel = Math.min(invSel, TOTAL - 1);
    det.innerHTML = `<h3>정문 열쇠 (${P.keys}/${TOTAL})</h3>사고를 막기 위해 일곱 조각으로 나뉜 정문 열쇠.<br>${KEY_NAMES[invSel]}에서 찾을 수 있다.<br><br>${got[invSel] ? '✔ 이미 획득했다.' : '아직 찾지 못했다. 지도에 목표 위치가 표시되어 있다.'}`;
  }
}
function openUI(kind) { if (state !== 'playing') return; uiPrev = state; state = 'ui'; for (const k in keys) keys[k] = false; $('prompt').style.display = 'none'; $(kind).classList.add('show'); document.exitPointerLock?.(); }
function closeUI() { if (state !== 'ui') return; $('inv').classList.remove('show'); $('mapOv').classList.remove('show'); state = 'playing'; refreshHud(); lock(); }
function openInv(tab = 'items') { if (state !== 'playing') return; invTab = tab; invSel = 0; openUI('inv'); renderInv(); }
function openMap() { if (state !== 'playing') return; mapFloor = P.floor; openUI('mapOv'); renderMap(); }
function mapPins(f) { return KEY_ROOMS.map((r, i) => ({ ...r, i })).filter(r => r.f === f).map(r => ({ x: r.x, z: r.z, done: got[r.i] })); }
function renderMap() {
  document.querySelectorAll('#mapOv .tabs button').forEach(b => b.classList.toggle('on', +b.dataset.f === mapFloor));
  const c = $('bigMap'), ctx = c.getContext('2d');
  const V = { 0: [0, 22, 5.2], 5: [38, 19, 22], 6: [-41, 38, 19], 7: [-39, 15, 24] }[mapFloor] || [0, -4, 11];
  drawMap(ctx, c.width, c.height, { floor: mapFloor, cx: V[0], cz: V[1], scale: V[2], labels: true, pins: mapPins(mapFloor), lockers: world.lockers.filter(l => l.floor === mapFloor), player: P.floor === mapFloor ? { x: P.x, z: P.z, yaw: P.yaw } : null });
}
document.querySelectorAll('#inv .tabs button').forEach(b => b.onclick = () => { invTab = b.dataset.tab; invSel = 0; renderInv(); });
document.querySelectorAll('#mapOv .tabs button').forEach(b => b.onclick = () => { mapFloor = +b.dataset.f; renderMap(); });

function useBattery() {
  if (inv.battery <= 0) { toast('건전지가 없습니다', '', 'warn'); return false; }
  if (P.battery >= 95) { say('손전등 배터리는 아직 충분하다', 1800); return false; }
  inv.battery--; P.battery = Math.min(100, P.battery + 45); if (!P.light) P.light = true; sfx.pickup(); toast('건전지를 교체했습니다', '손전등 배터리 회복', 'info'); refreshHud(); return true;
}
function useMedkit() {
  if (inv.medkit <= 0) { toast('응급 밴드가 없습니다', '', 'warn'); return false; }
  if (P.hp >= 100) { say('다친 곳이 없다', 1800); return false; }
  inv.medkit--; P.hp = Math.min(100, P.hp + 50); sfx.paper(); toast('응급 밴드를 사용했습니다', '체력 +50', 'info'); talk('조금 낫네… 계속 가자.', 2400); refreshHud(); return true;
}
function hit() {
  if (P.invuln > 0 || state !== 'playing') return;
  const G = ghost;
  P.hp -= 50; P.invuln = 3.5; shake = 1;
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
    const si = STAIRS[P.floor];
    const inStair = !si ? false : P.floor === 3 ? (Math.abs(P.x) < 4.5 && P.z < -5.2 && P.z > -9.5) : (P.x > -1 && P.x < 4 && P.z > -9.3 && P.z < -2);
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
      got[it.idx] = true; P.keys++; sfx.key(); refreshHud();
      toast('아이템을 획득했습니다', `${KEY_NAMES[it.idx]} 열쇠 조각 (${P.keys}/${TOTAL})`);
      talk(P.keys < 4 ? '열쇠 조각이다. 하나 더…' : '마지막 조각이야. 이제 정문으로!', 3000);
      if (P.keys === 1) activateGhost();
      if (P.keys === TOTAL) enrage();
      save(true);
    } else if (it.kind === 'battery') { inv.battery++; sfx.pickup(); toast('아이템을 획득했습니다', '건전지 (2번 키로 사용)'); refreshHud(); }
    else { inv.medkit++; sfx.pickup(); toast('아이템을 획득했습니다', '응급 밴드 (3번 키로 사용)'); refreshHud(); }
  } else if (target.type === 'locker') enterLocker(target.l);
  else if (target.type === 'stairs') changeFloor(1);
  else if (target.type === 'door') {
    const d = target.d;
    if (d.locked) { sfx.click(); say(d.locked, 2600); return; }
    if (d.need && P.keys < d.need) { sfx.click(); say(`굳게 잠겨 있다. 열쇠 조각이 더 필요하다 (${P.keys}/${TOTAL})`, 2600); return; }
    teleport(d.to);
  }
  else if (target.type === 'gate') openGate();
}

function readNote(it) {
  if (!it.taken) { it.taken = true; it.mesh.visible = false; docs.push({ id: it.id, title: it.title, text: it.text }); toast('새로운 문서를 획득했습니다', it.title, 'info'); refreshHud(); }
  showNote(it);
}
function activateGhost() {
  if (ghost.active) return;
  ghost.active = true; ghost.floor = P.floor === 2 ? 1 : 2; ghost.x = 20; ghost.z = 0; ghost.state = 'patrol'; ghost.path = []; ghost.wait = 2;
  sfx.bang(0, .9); setTimeout(() => talk('방금… 위층에서 소리가 났어.', 3500), 900);
}
function enrage() {
  ghost.active = true; ghost.enraged = true; blackout = 3.2;
  setTimeout(() => { ghostRelocate(); ghost.floor = P.floor; sfx.screech(); toast('목표가 갱신되었습니다', '정문으로 달려가라!', 'warn'); talk('그게… 깨어났어. 정문으로 뛰어!', 4000); }, 2600);
}
const STAIRS = { 0: { up: 1, down: 4 }, 1: { up: 2, down: 0 }, 2: { up: 3, down: 1 }, 3: { down: 2 }, 4: { up: 0 } };
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
  teleport(nf === 3 ? { floor: 3, x: 0, z: -7.5, yaw: 0 } : { floor: nf, x: 2.2, z: -5.2, yaw: Math.PI });
}
function openGate() {
  if (P.keys < TOTAL) { sfx.click(); say(`자물쇠가 굳게 잠겨 있다. 열쇠 조각이 더 필요하다 (${P.keys}/${TOTAL})`, 2800); return; }
  escaped = true; gateState = 'opening'; sfx.gateOpen(); say('열쇠가 맞물렸다…', 3000);
  gate.blockRect.x1 = 1e9; gate.blockRect.x2 = 1e9 + 1;
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
  if (state === 'ui') {
    if (e.code === 'Tab' || e.code === 'Escape' || e.code === 'KeyI' || e.code === 'KeyM') closeUI();
    else if ($('inv').classList.contains('show') && (e.code === 'KeyQ' || e.code === 'KeyE')) { invTab = TABS[(TABS.indexOf(invTab) + (e.code === 'KeyE' ? 1 : 2)) % 3]; invSel = 0; renderInv(); }
    return;
  }
  if (state !== 'playing') return;
  if (e.code === 'Tab' || e.code === 'KeyI') { openInv(); return; }
  if (e.code === 'KeyM') { openMap(); return; }
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
  if (state === 'dead') return;
  P.yaw -= e.movementX * .0022; P.pitch = clamp(P.pitch - e.movementY * .0022, -1.45, 1.45);
  if (P.hiding) P.yaw = clamp(P.yaw, P.hiding.yaw - .7, P.hiding.yaw + .7);
});
$('noteBox').addEventListener('click', closeNote);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && (state === 'playing' || state === 'note') && !DEBUG) { if (state === 'note') closeNote(); state = 'paused'; $('pause').classList.add('show'); for (const k in keys) keys[k] = false; }
});
function lock() { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignore */ } }

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

function start() {
  initAudio(); $('menu').classList.remove('show'); $('hud').classList.add('show');
  state = 'playing'; refreshHud(); drawFace($('portrait'));
  setTimeout(() => talk('무서워도… 가야지. 누군가는 알아야 하니까.', 4200), 500);
}
$('startBtn').addEventListener('click', () => { try { localStorage.removeItem(SAVE); } catch (e) { /* ignore */ } lock(); start(); });
$('helpBtn').addEventListener('click', () => $('helpBox').classList.toggle('show'));
$('loadBtn').addEventListener('click', () => { lock(); start(); load(); });
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
  if (gateState === 'closed') gate.lockGlow.visible = true;
  if (gateState === 'opening') gate.lockGlow.visible = false;
}
const easeOut = t => 1 - Math.pow(1 - t, 3);

function updateLighting(dt) {
  const F = floors[P.floor];
  const indoors = P.floor >= 4 || (P.floor > 0 && P.floor < 3) || (P.floor === 0 && P.z < 1.45 && P.z > -9.9 && Math.abs(P.x) < 36.3);
  const k = Math.min(1, dt * 3);
  moonLight.intensity = lerp(moonLight.intensity, indoors ? 0 : 1.1, k);
  hemi.intensity = lerp(hemi.intensity, indoors ? .2 : .5, k);
  scene.fog.density = lerp(scene.fog.density, indoors ? .05 : .024, k);
  floors.forEach(f => { f.interior.visible = f.f === P.floor; });
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
function updateHud(dt, prox, chase) {
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
    give() { world.items.filter(i => i.kind === 'key').forEach(i => { i.taken = true; i.mesh.visible = false; got[i.idx] = true; }); P.keys = TOTAL; refreshHud(); },
    get state() { return state; }, set state(v) { state = v; },
    interact, die, activateGhost, enrage,
    setTarget(t) { target = t; },
  };
}
