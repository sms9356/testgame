// 폐교 — 잊혀진 시간 : 1인칭 학교 공포 게임 (Three.js)
import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';
import { createNPCVisuals } from './npcVisuals.js';
import { buildWorld, collide, los, FH, GATE_Z, KEY_NAMES, KEY_ROOMS, AREA_NAMES, SLOTS, LAYOUT, ANNEX, LAYOUT_S, ANNEX_S, MAIN_ZS, WALKWAY } from './world.js';
import { drawMap } from './map.js';
import { makeDress, makeHair, makeGhostFace, makeGraffiti, makeKeypad, loadPBR, makeGlow as makeGlowTex, makePaintingStare, makeSign, makeBlood } from './tex.js';
import { warmUp } from './bake.js';
import { createFX } from './fx.js';
import './sanitySystem.js';   // 공포 환각 엔진 (사용자 제공) → window.sanitySystem
import { GhostCameraSystem } from './ghostCamera.js';   // 심령 카메라 엔진 (사용자 제공)
import { CraftingSystem } from './craftingSystem.js';   // 조합 · 생존 도구 (사용자 제공)
import { SchoolPowerEventSystem } from './schoolPowerSystem.js';   // 배전반 · 차임벨 (사용자 제공)
import { RestroomSystem } from './restroomSystem.js';   // 화장실 세면대 · 변기 (사용자 제공)
import { initAudio, sfx, at, setProximity, setListener, setAmbience, setBreath, setGhostVoice, setMusic, setVolumes, getVolumes, setGenHum, setRainLevel, setCoil } from './audio.js';
import { VS, saveVS, loadManifest, speak, stopSpeak, subtitle, line, preload, hasBrowserVoice, hasNaturalVoice, engineLabel, lineInfo, registerLines, SUBLOG, logLine } from './voice.js';
import { CHARACTERS, FACE, LINES, VO, ITEMS, RECIPES, CHAPTERS, CREDITS, OPTIONAL, CLUES, CHAR_NOTE, TIMELINE, EPILOGUE, DEATH_LOG, NOTES as STORY_NOTES, MEMORIES, FINAL_CHOICE, FINAL_EPI, SIDEQUESTS, HEADQUEST, COLLECT, LOCKER_SCARES, CHALK_QA, OUIJA_QS, PARA, TOILET_FX, MIRROR_WORDS } from './story.js';
import { SET, saveSET, resetSET, DIFF, keyLabel } from './settings.js';
const K = () => SET.keys;
import { run as runMini, MG } from './minigames.js';
import { SCHEMA, BUILD, storageKeys, itemUid, propUid, doorUid, assignUids, readSlot, writeSlot, hasSlot, clearSlot, repairProgress } from './saveSystem.js';
loadManifest().then(() => registerLines({ ...VO, ...Object.fromEntries(Object.entries(STORY_NOTES).filter(([, n]) => n.text).map(([k, n]) => ['note_' + k, { spk: 'narrator', text: n.title + '. ' + n.text }])) }));

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const TEST = params.has('test');
const TST = { god: false, noGhost: false };
const TEST_NOLOCK = params.has('nolock'), BRIGHT = params.has('bright');   // bright: 화면 점검용 균일 조명
// 주인공 (캐릭터 선택)
let CHAR = 'seoyeon';
try { CHAR = localStorage.getItem('haegyo_char') || 'seoyeon'; } catch (e) { /* ignore */ }
if (!CHARACTERS[CHAR]) CHAR = 'seoyeon';
const CH = () => CHARACTERS[CHAR], CK = () => (CHAR === 'jihun' ? 'j' : 's');
const DF = () => DIFF[SET.diff] || DIFF.normal;
// 이야기 진행 플래그
const FL = { cam: false, tag: false, calm: false, mina: false, gatekey: false, opt: false, fuse: false, mop: false, wire: false, hook: false };
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
// 심령 카메라: scene · camera · renderer 생성 직후 초기화. 장면에 조명을 더하면 모든 재질 셰이더가 다시 컴파일되고 매 프레임 비용이 늘어나서,
// 클래스의 야간투시 · 플래시 보조광(PointLight 2개) 대신 CSS 야간투시 필터 · 화면 섬광 · 손전등 감광으로 같은 연출을 낸다
class GameGhostCam extends GhostCameraSystem { _initLights() {} }
const ghostCam = window.ghostCam = new GameGhostCam({ scene, camera, renderer });

const hemi = new THREE.HemisphereLight(0x8aa0d0, 0x2a2018, 0.4);
scene.add(hemi);
const moonLight = new THREE.DirectionalLight(0x7f9ae0, 1.0);
moonLight.position.set(-40, 90, -120); scene.add(moonLight);
const fillLight = new THREE.DirectionalLight(0x8a9ac8, 0); fillLight.position.set(30, 50, 150); scene.add(fillLight);   // 운동장 쪽 건물 정면을 비추는 보조 달빛
// 하늘 돔: 위 · 지평선 · 아래 세 색 + 해 주변 노을 — 낮(흐린 늦은 오후) → 해 질 녘 → 밤
const skyU = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(-.8, .12, .55).normalize() }, uGlow: { value: 0 } };
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; }',
  fragmentShader: `uniform vec3 uTop, uHor, uBot, uSun; uniform float uGlow; varying vec3 vD;
    void main(){ float y = vD.y; vec3 c = y > 0.0 ? mix(uHor, uTop, pow(smoothstep(0.0, .55, y), .8)) : mix(uHor, uBot, smoothstep(0.0, .2, -y));
      float s = max(dot(normalize(vD), uSun), 0.0); c += vec3(1.0, .55, .25) * (pow(s, 6.0) * .35 + pow(s, 60.0) * .6) * uGlow * smoothstep(-.1, .15, y);
      gl_FragColor = vec4(c, 1.0); }`,
}));
skyDome.renderOrder = -10; skyDome.frustumCulled = false; scene.add(skyDome);
// 하루의 흐름: dayK 1 = 흐린 늦은 오후, 0 = 비 오는 밤. 정문이 닫히면 해가 진다 (스토리 연계)
const DAY = { k: .92, start: -1, dur: 75, done: false };
const C_ = h => new THREE.Color(h);
const SKY_N = [C_(0x03050b), C_(0x0c1424), C_(0x020304)], SKY_D = [C_(0x5d6e88), C_(0xd8a27a), C_(0x3a3430)];
const FOG_DAY = C_(0xa69a92), FOG_IN_DAY = C_(0x2c2a28), BG_DAY = C_(0x8d97a6);
const SUN_POS = new THREE.Vector3(-150, 42, 70), MOON_POS = new THREE.Vector3(-40, 90, -120);
const SUN_COL = C_(0xffc896), MOON_COL = C_(0x7f9ae0), HEMI_SKY_N = C_(0x8aa0d0), HEMI_SKY_D = C_(0xc8ccd4), HEMI_GND_N = C_(0x2a2018), HEMI_GND_D = C_(0x6a5a48);
const _c1 = new THREE.Color();
const flash = new THREE.SpotLight(0xfff0d0, 0, 30, 0.56, 0.82, 1.3);   // 가장자리를 부드럽게 (딱딱한 원 밖이 완전히 깜깜해 보이던 문제)
// 손전등 산란광: 빛이 벽 · 바닥에 튀어 주변이 희미하게 보이는 효과 (항상 장면에 있어 셰이더 재컴파일 없음)
const spill = new THREE.PointLight(0xffe8cc, 0, 7, 2); camera.add(spill); spill.position.set(0, .1, -1.2);
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
const npcVisuals = createNPCVisuals({ THREE, GLTFLoader, prepare: async obj => {
  const tex = new Set(); obj.traverse(o => { if (o.material) [].concat(o.material).forEach(m => ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'emissiveMap'].forEach(k => m[k] && tex.add(m[k]))); });
  for (const t of tex) { renderer.initTexture(t); await new Promise(r => requestAnimationFrame(r)); }   // 한 프레임에 하나씩
  await renderer.compileAsync(obj, camera, scene);
} });   // assets/characters/{guard,mina}.glb 가 있으면 절차적 모델 대신 쓴다
// 캐릭터 GLB 는 assets/characters/manifest.json 에 true 로 적힌 것만 요청한다 (없는 파일을 매번 요청해 404 가 나던 문제)
const NPC_AVAIL = fetch('assets/characters/manifest.json').then(r => (r.ok ? r.json() : {})).catch(() => ({}));
function npcLoad(id, holder, opts) { NPC_AVAIL.then(m => { if (m && m[id]) npcVisuals.load(id, holder, opts).catch(e => console.warn('[npc]', id, e && e.message)); }); }
// 실사 스캔 소품 (Poly Haven CC0): 모델별 · 층별로 InstancedMesh 를 만들어 드로콜을 줄인다
function loadModels() {
  const byName = {}; world.MODELS.forEach(m => (byName[m.model] = byName[m.model] || []).push(m));
  const loader = new GLTFLoader(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  // 끊김 방지 (게임 시작 직후 버벅임): 예전엔 모든 모델이 다 오면 텍스처 업로드 + 장면 전체 셰이더 컴파일을 한 프레임에 동기로 했다 →
  //   모델을 한 프레임에 하나씩 처리하고, 새 메시는 텍스처를 먼저 올리고 셰이더를 비동기(병렬) 컴파일한 뒤에 장면에 넣는다
  let left = Object.keys(byName).length; const done = () => { if (--left > 0) return; window.__modelsDone = performance.now(); };
  const queue = []; let busy = false, upTex = new Set();
  const pump = () => { if (busy || !queue.length) return; busy = true; const job = queue.shift();
    requestAnimationFrame(async () => { const t0 = performance.now(); try { await job(); } catch (e) { console.warn('[model]', e && e.message); } (window.__modelJobs ||= []).push(Math.round(performance.now() - t0)); busy = false; pump(); }); };
  const stage = async (pairs) => {   // pairs: [parent, mesh]
    const texs = []; pairs.forEach(([, m]) => ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach(k => { const t = m.material[k]; if (t && !upTex.has(t)) { upTex.add(t); texs.push(t); } }));
    for (const t of texs) { renderer.initTexture(t); await new Promise(r => requestAnimationFrame(r)); }   // 텍스처는 한 프레임에 하나씩
    const g = new THREE.Group(); pairs.forEach(([, m]) => g.add(m));
    try { await renderer.compileAsync(g, camera, scene); } catch (e) { /* ignore */ }
    pairs.forEach(([parent, m]) => parent.add(m));
  };
  // 사용자 3D 소품 133종 팩 (h133/ID): 정점 색뿐인 저폴리곤 → 면 법선 · 상자 투영 UV 를 만들고, 부품 이름으로 게임 PBR 재질을 골라 재질별로 합친다
  // (요리실 101 팩 cr101/ID: 재질 이름(steel · steel_dirty · rust …)으로 고른다)
  // (인쇄실 팩 pr/ID: 부품 이름의 재질 표기로 고르고, Z-up 으로 저장된 GLB 를 Y-up 으로 세운다)
  const h133Parts = (root, id, cr, pr) => {
    const groups = new Map();
    root.traverse(o => { if (!o.isMesh) return; const nm = (o.name || o.parent?.name || '').replace(/^\d+_/, ''), mat = pr === 'v2' ? world.v2Mat(nm) : pr ? world.prMat(nm) : cr ? world.crMat(o.material && o.material.name) : world.h133Mat(id, nm);
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.deleteAttribute('color'); g.applyMatrix4(o.matrixWorld); if (pr === true) g.rotateX(-Math.PI / 2); g.computeVertexNormals();
      const P = g.attributes.position, N = g.attributes.normal, uv = new Float32Array(P.count * 2);
      for (let i = 0; i < P.count; i++) { const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i));
        const [u, v] = ax >= ay && ax >= az ? [P.getZ(i), P.getY(i)] : ay >= az ? [P.getX(i), P.getZ(i)] : [P.getX(i), P.getY(i)]; uv[i * 2] = u * .8; uv[i * 2 + 1] = v * .8; }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      (groups.get(mat) || groups.set(mat, []).get(mat)).push(g); });
    const out = []; groups.forEach((gs, mat) => { const m = new THREE.Mesh(gs.length > 1 ? mergeGeometries(gs) : gs[0], mat); out.push(m); });
    return out;
  };
  const packed = name => name.startsWith('h133/') || name.startsWith('cr101/') || name.startsWith('th102/') || name.startsWith('pr/') || name.startsWith('v2/');
  // 기술·가정실 102 팩: UV 가 있는 실제 메시 — 재질별로 합쳐(그리기 호출 절약) 팩 PBR 텍스처를 입힌다
  const thParts = root => { const groups = new Map();
    root.traverse(o => { if (!o.isMesh) return; const mat = world.thMat(o.material && o.material.name);
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); ['color', 'tangent'].forEach(k => g.deleteAttribute(k)); g.applyMatrix4(o.matrixWorld); if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      (groups.get(mat) || groups.set(mat, []).get(mat)).push(g); });
    const out = []; groups.forEach((gs, mat) => out.push(new THREE.Mesh(gs.length > 1 ? mergeGeometries(gs) : gs[0], mat))); return out; };
  Object.entries(byName).forEach(([name, list]) => loader.load(packed(name) ? `assets/models/${name}.glb` : `assets/models/${name}/${name}.gltf`, gltf => { queue.push(async () => {
    const root = gltf.scene; root.updateMatrixWorld(true); const pairs = [];
    const cr = name.startsWith('cr101/') || name.startsWith('th102/');
    const parts = []; if (name.startsWith('th102/')) parts.push(...thParts(root)); else if (packed(name)) parts.push(...h133Parts(root, name.split('/')[1], cr, name.startsWith('pr/') || (name.startsWith('v2/') && 'v2'))); else root.traverse(o => { if (o.isMesh) parts.push(o); });
    const byFloor = {}; list.forEach(m => (byFloor[m.f] = byFloor[m.f] || []).push(m));
    Object.entries(byFloor).forEach(([f, ms]) => {
      const parent = f === 'out' ? world.OUT : floors.find(F => String(F.f) === f).interior;
      parts.forEach(part => {
        const mat = part.material; if (mat.isMeshStandardMaterial && mat.roughness < .14) mat.roughness = .14;
        const im = new THREE.InstancedMesh(part.geometry, mat, ms.length); im.userData.dynamic = true;
        ms.forEach((m, i) => { _e.set(m.rx, m.ry, m.rz, 'YXZ'); _q.setFromEuler(_e); _p.set(m.x, m.y, m.z); _s.setScalar(m.s); _m.compose(_p, _q, _s).multiply(part.matrixWorld); im.setMatrixAt(i, _m); });
        im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = cr; im.receiveShadow = true;   // 큰 조리대 (요리실 팩) 만 손전등 그림자   // 작은 소품은 그림자 패스에서 제외 (프레임 안정)
        pairs.push([parent, im]);
      });
    });
    await stage(pairs);
    if (cr || name.startsWith('pr/') || name.startsWith('v2/')) floors.forEach(F => F.interior.traverse(o => { if (o.userData.cr && o.userData.cr === name.split('/')[1]) o.visible = false; }));   // 새 모델이 들어간 뒤에 같은 자리의 절차적 대체 메시를 숨긴다
    done(); }); pump();
  }, undefined, e => { console.warn('[model]', name, e && e.message); done(); }));
}
// 첫 화면이 늦게 뜨지 않도록 페이지 로드가 끝난 뒤에 불러온다
if (document.readyState === 'complete') setTimeout(loadModels, 300); else addEventListener('load', () => setTimeout(loadModels, 300), { once: true });
// 거울처럼 매끈한 재질은 손전등이 아주 가까울 때 반사광이 과하게 튄다 → 최소 거칠기 (화면이 까매지는 문제의 원인 중 하나)
scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach(m => { if (m && m.isMeshStandardMaterial && m.roughness < .14) m.roughness = .14; }); });
const _t2 = performance.now();
const fx = createFX(renderer, scene, camera);
// 이벤트 연출 강화: 강한 글리치에는 화면 줄무늬 흔들림, 출현 · 추격 시작에는 가장자리 붉은 맥동
const evFx = id => { if (SET.flashReduce) return; const el = document.getElementById(id); if (!el) return; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); };
{ const g0 = fx.glitch; fx.glitch = (s = .6) => { g0(s); if (s >= .45) evFx('evStreak'); }; }
let hurtFx = 0, lightningT = 25, sparkT = 3;
const floors = world.floors;

/* ---------- 상태 ---------- */
let state = 'menu';            // menu | playing | paused | note | dead | won
let tNow = 0, playTime = 0;
// 플레이 시간 표시 · 누적 기록 (세이브와 별개: 엔딩을 봐도 남는다 · 테스트 모드는 별도 키)
let ptShown = -1, statAcc = 0;
const STAT_KEY = TEST ? 'haegyo_test_stats' : 'haegyo_stats';
function fmtPT(sec, words, secs) {
  sec = Math.max(0, Math.floor(sec || 0)); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s2 = sec % 60;
  if (words) return h ? `${h}시간 ${m}분${secs ? ` ${s2}초` : ''}` : secs || !m ? `${m ? m + '분 ' : ''}${s2}초` : `${m}분`;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s2).padStart(2, '0')}` : `${m}:${String(s2).padStart(2, '0')}`;
}
addEventListener('pagehide', () => statFlush());
function statRead() { try { const v = JSON.parse(localStorage.getItem(STAT_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
function statWrite(v) { try { localStorage.setItem(STAT_KEY, JSON.stringify(v)); } catch (e) { /* ignore */ } }
function statFlush() { if (statAcc <= 0) return; const v = statRead(); v.total = (v.total || 0) + statAcc; statAcc = 0; statWrite(v); }
// 엔딩: 엔딩별 최단 시간 기록 → { best: 이전 최단, isBest }
function statClear(end, fin) {
  statFlush(); const v = statRead(); v.best = v.best || {}; const prev = v.best[end], isBest = !prev || playTime < prev;
  if (isBest) v.best[end] = Math.floor(playTime); v.clears = (v.clears || 0) + 1; v.last = { end, fin, t: Math.floor(playTime), at: Date.now() }; statWrite(v);
  return { best: prev, isBest: isBest && !!prev };
}
const P = {
  x: 0, z: 77.5, floor: 0, yaw: 0, pitch: 0, light: true, breath: 100, battery: 100, stamina: 100, tired: false,
  keys: 0, hp: 100, invuln: 0, fear: 0, roofSeen: false, moving: false, sprinting: false, hiding: null, bob: 0, stepD: 0, noise: 0, fade: 0,
};
const TOTAL = KEY_NAMES.length;
const got = KEY_NAMES.map(() => false);
const inv = { battery: 0, medkit: 0, hairpin: 0, can: 0, candy: 0, thermos: 0, salt: 0, charm: 0, musicbox: 0, matches: 0, tape: 0, sedative: 0, alarm: 0, shock: 0, firstaid: 0 }, docs = [];
let gateClosed = false, gateAnim = 0, gateState = 'open';
let lookBack = 0, introT = 0, introText = false;
const CAM = { on: false, layer: 2, clues: [], arrow: null, shotCD: 0 };   // 휴대폰 심령 카메라 (아래 확장 기능)
const MIC = { on: false, level: 0, risk: 0, an: null, buf: null, ctx: null, stream: null, wave: null };
const SAN = { lvl: 0, t: 8, fov: 0, fovT: 0 };
let STH = null;   // 계단 길게 누르기 { code, dir, t }
let repelK = 0;   // 손전등 집중 조사 진행도 (0~1): 빛 색 떨림 · 시야 좁힘 · 흔들림 · 코일 소리
let blackout = 0, shake = 0, nextEvent = 40, lampTimer = 0, introDone = false, escaped = false;
const keys = {};

/* ---------- 유령 ---------- */
// 의문의 학생(유령): 10년 전 교복 — 남색 재킷 · 붉은 리본 · 주름치마 · 검은 스타킹, 얼굴을 가린 긴 머리. 반투명하게 비친다
function buildGhost() {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const DS = THREE.DoubleSide;
  const ghostM = (col, o = {}) => new THREE.MeshStandardMaterial({ color: col, roughness: .85, transparent: true, opacity: .9, emissive: 0x0c1218, side: DS, depthWrite: true, ...o });
  const jacket = ghostM(0x1a2030), shirt = ghostM(0x9a9c98, { emissive: 0x141818 }), skirtM = ghostM(0x2c2a34), stock = ghostM(0x0c0c10);
  const skinM = new THREE.MeshStandardMaterial({ color: 0x8c8a86, roughness: .9, emissive: 0x101214 });
  const faceM = new THREE.MeshStandardMaterial({ map: makeGhostFace(), color: 0x9a9690, roughness: .9 });
  const hairM = new THREE.MeshStandardMaterial({ map: makeHair(), color: 0x0e0c0b, roughness: .75, side: DS, alphaTest: .3 });
  const capM = new THREE.MeshStandardMaterial({ color: 0x060505, roughness: .8 });
  const ribbon = new THREE.MeshStandardMaterial({ color: 0x6a1018, roughness: .6, emissive: 0x1a0204 });
  const part = (geo, m, x, y, z, p = inner) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); p.add(o); return o; };
  // 다리 (검은 스타킹 · 발끝이 바닥에서 살짝 뜬다)
  [-1, 1].forEach(s => { const l = part(new THREE.CylinderGeometry(.052, .04, .78, 12), stock, s * .085, .55, 0); l.rotation.z = s * .02; part(new THREE.BoxGeometry(.08, .05, .2), stock, s * .085, .15, -.03); });
  // 주름치마: 각진 원뿔 + 주름 굴곡
  const sk = new THREE.CylinderGeometry(.17, .29, .38, 24, 2, true), sp = sk.attributes.position;
  for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), z = sp.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z), k = 1 + .06 * Math.sign(Math.sin(a * 12)) * (sp.getY(i) < 0 ? 1 : .3); sp.setXYZ(i, Math.cos(a) * r * k, sp.getY(i), Math.sin(a) * r * k); }
  sk.computeVertexNormals(); part(sk, skirtM, 0, 1.02, 0);
  // 몸통: 셔츠 + 재킷 + 리본
  const torso = new THREE.LatheGeometry([[.12, 0], [.165, .05], [.175, .25], [.16, .42], [.12, .5], [.05, .53]].map(p => new THREE.Vector2(p[0], p[1])), 20);
  const t = part(torso, jacket, 0, 1.18, 0); t.scale.set(1, 1, .72);
  part(new THREE.BoxGeometry(.1, .2, .02), shirt, 0, 1.55, -.115);
  const rb = part(new THREE.BoxGeometry(.12, .045, .03), ribbon, 0, 1.63, -.13); [-1, 1].forEach(s => { const tl = part(new THREE.BoxGeometry(.03, .1, .02), ribbon, s * .02, 1.57, -.135); tl.rotation.z = s * .25; }); rb.rotation.z = .05;
  part(new THREE.CylinderGeometry(.04, .05, .12, 10), skinM, 0, 1.75, 0);
  // 머리: 고개를 숙이고, 앞머리가 얼굴을 덮는다
  const head = new THREE.Group(); head.position.set(0, 1.86, 0); head.rotation.x = .32; inner.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(.105, 24, 18), faceM); face.scale.set(.88, 1.12, .95); head.add(face);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.118, 18, 14, 0, Math.PI * 2, 0, Math.PI * .62), capM); cap.position.set(0, .015, .01); cap.rotation.x = -.3; head.add(cap);
  const hair = [];
  const strand = (a, w, L, fwd = 0) => {
    const pg = new THREE.PlaneGeometry(w, L, 1, 6); pg.translate(0, -L / 2, 0);
    const m = new THREE.Mesh(pg, hairM); const r = .112 + fwd;
    m.position.set(Math.sin(a) * r, .06, Math.cos(a) * r); m.rotation.order = 'YXZ'; m.rotation.y = a; m.rotation.x = fwd ? -.2 : -.12; head.add(m); hair.push(m); return m;
  };
  for (let i = 0; i < 26; i++) strand(Math.PI * (.3 + i / 25 * 1.4), .1 + Math.random() * .05, .75 + Math.random() * .35);
  [-.5, -.28, -.08, .12, .32, .52].forEach((a, i) => strand(a + Math.PI, .07, .62 + (i % 2) * .1, .01));   // 얼굴을 가리는 앞머리
  // 팔: 소매 + 창백한 손, 손가락
  const arms = [];
  [-1, 1].forEach(s => {
    const sh = new THREE.Group(); sh.position.set(s * .2, 1.62, 0); inner.add(sh);
    part(new THREE.CylinderGeometry(.045, .04, .3, 10), jacket, 0, -.15, 0, sh);
    const el = new THREE.Group(); el.position.y = -.3; el.rotation.x = -.25; sh.add(el);
    part(new THREE.CylinderGeometry(.04, .035, .26, 10), jacket, 0, -.12, 0, el);
    part(new THREE.CylinderGeometry(.024, .018, .1, 8), skinM, 0, -.29, 0, el);
    const hand = part(new THREE.BoxGeometry(.045, .08, .02), skinM, 0, -.38, 0, el);
    for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(.005, .003, .1, 4), skinM); f.position.set(-.016 + k * .011, -.46, 0); f.rotation.z = (k - 1.5) * .06; el.add(f); }
    sh.rotation.set(-.15, 0, s * .06); arms.push(sh);
  });
  inner.position.y = .1;   // 살짝 떠 있다
  // 조명은 그룹 밖(씬)에 항상 둔다 — 보였다 안 보였다 하면 조명 개수가 바뀌어 모든 셰이더가 다시 컴파일되며 크게 끊긴다
  const glow = new THREE.PointLight(0x6a8aa8, 0, 5); scene.add(glow);
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

function ghostLeave() {
  const G = ghost, opts = [0, 1, 2, 4].filter(f => f !== P.floor);
  G.floor = opts[(Math.random() * opts.length) | 0]; G.state = 'patrol'; G.path = []; G.hunt = null; G.away = 0; G.warned = false; G.visitT = 0; G.chaseT = 0;
  const n = floors[G.floor].nodes[0]; if (n) { G.x = n.x; G.z = n.z; }
  if (state === 'playing') { sfx.stairs(); caption('발소리가 계단 쪽으로 멀어진다'); }
}
function ghostRelocate() {
  const G = ghost, F = floors[P.floor];
  G.floor = P.floor;
  const ends = F.spawns ? F.spawns.slice() : [{ x: -34, z: 0 }, { x: 34, z: 0 }, { x: 0, z: -5.2 }];
  ends.sort((a, b) => Math.hypot(b.x - P.x, b.z - P.z) - Math.hypot(a.x - P.x, a.z - P.z));
  let s = ends[0];
  if (!F.spawns && Math.hypot(ends[2].x - P.x, ends[2].z - P.z) > 14 && !G.enraged && Math.random() < .6) s = ends[2];
  G.x = s.x; G.z = s.z; G.away = 0; G.lose = 0; G.hunt = null; G.spawnGrace = 3; G.warned = false;
  // 평소엔 플레이어에게 곧장 오지 않고, 먼 쪽에서 순찰을 시작한다 (최종 추격만 곧장)
  G.visitT = 0; G.chaseT = 0;
  if (G.enraged) { G.state = 'chase'; G.target = { x: P.x, z: P.z }; G.path = findPath(F, G.x, G.z, G.target.x, G.target.z); } else { G.state = 'patrol'; G.target = null; G.path = []; G.wait = 3; }
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
  const G = ghost; speed *= DF().speed * (G.lightT > 0 || G.slowT > 0 ? .45 : 1);
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
  const outP = P.floor === 0 && P.z > MAIN_ZS + .15;
  const dist = Math.hypot(P.x - G.x, P.z - G.z);
  G.spawnGrace = Math.max(0, G.spawnGrace - dt); G.calmT = Math.max(0, (G.calmT || 0) - dt);

  if (G.lureT > 0) G.lureT -= dt;
  // 다른 층이면 일정 시간 뒤 플레이어 층으로 이동
  if (!same) {
    if (G.lureT > 0) return;
    G.away += dt;
    const wait = G.enraged ? 6 : DF().away + (G.floor * 7 % 13);
    if (G.calmT > 0 && !G.enraged) return;   // 이야기 장면 직후에는 찾아오지 않는다
    // 출현 예고: 오기 몇 초 전에 계단 쪽 발소리와 자막
    if (!G.warned && G.away > wait - 3.5 && !(outP && !G.enraged) && state === 'playing') {
      G.warned = true; const sz = floors[P.floor].stairZone, sx = sz ? sz.spawn.x : 2.2, sz2 = sz ? sz.spawn.z : -5.2;
      [0, 450, 900, 1350].forEach((t, i) => setTimeout(() => at(sx, floors[P.floor].y0 + .2, sz2).ghostStep(Math.max(2, 12 - i * 2), 0), t));
      caption(P.floor === 4 ? '위층 계단에서 무언가 내려온다' : '계단 쪽에서 발소리가 다가온다');
    }
    if (G.away > wait && !(outP && !G.enraged)) ghostRelocate();
    return;
  }
  G.away = 0;
  if (G.stunT > 0) { G.stunT -= dt; G.lightT = 0; return; }   // 플래시 · 쇼트 폭탄에 경직
  // 머무는 시간 제한: 쫓고 있지 않으면 일정 시간 뒤 다른 층으로 떠난다 (한 층에 눌러앉지 않게)
  if (!G.enraged) {
    G.visitT = (G.visitT || 0) + dt;
    if (G.state === 'chase') G.chaseT = (G.chaseT || 0) + dt; else G.chaseT = Math.max(0, (G.chaseT || 0) - dt * .5);
    if (G.chaseT > DF().chaseMax) { G.chaseT = 0; G.state = 'search'; G.calmT = Math.max(G.calmT, 15); G.visitT = Math.max(G.visitT, DF().visit - 8); let far = F.nodes[0]; F.nodes.forEach(n => { if (Math.hypot(n.x - P.x, n.z - P.z) > Math.hypot(far.x - P.x, far.z - P.z)) far = n; }); G.target = { x: far.x, z: far.z }; G.path = []; G.replan = 0; G.wait = 0; caption('그것이 흥미를 잃은 듯 멀어진다'); }
    if (G.visitT > DF().visit && G.state !== 'chase' && !G.hunt) { ghostLeave(); return; }
  }

  // 시야 판정 (공간마다 다르게: 체육관은 소리, 도서실은 시야, 지하는 좁은 동선)
  const room = roomAt(P.floor, P.x, P.z), inLib = room && room.type === 'library';
  const hearMul = P.floor === 5 ? 1.6 : inLib ? .8 : 1, sightMul = inLib ? 1.3 : P.floor === 4 ? .85 : 1;
  const safe = !!safeRoomAt();
  let sees = false;
  if (!P.hiding && !safe && !(outP && !G.enraged)) {
    const range = (P.light ? 20 : 12) * (G.enraged ? 1.5 : P.keys < 2 ? .8 : 1) * sightMul * (P.crouch ? .65 : 1);
    if (dist < range && los(F.walls, G.x, G.z, P.x, P.z) && los(F.doorWalls || [], G.x, G.z, P.x, P.z)) sees = true;
  }
  // 청각 판정
  if (!P.hiding && !safe && !(G.calmT > 0) && !G.hunt && !(outP && !G.enraged) && G.state !== 'chase' && !schoolPower.isChimeActive && dist < P.noise * DF().hear * hearMul) {
    G.state = 'search'; G.target = { x: P.x, z: P.z }; G.wait = 0; G.replan = 0;
  }
  // 손전등을 똑바로 비추면 느려지고, 버티면 물러난다 (배터리 소모 큼)
  G.repelCD = Math.max(0, (G.repelCD || 0) - dt);
  let lit = false;
  if (P.light && P.battery > 0 && !P.hiding && dist < 8 && G.repelCD <= 0) {
    const lx = -Math.sin(P.yaw), lz = -Math.cos(P.yaw);
    if (((G.x - P.x) * lx + (G.z - P.z) * lz) / Math.max(dist, .01) > .93 && los(F.walls, P.x, P.z, G.x, G.z)) lit = true;
  }
  if (lit) {
    G.lightT = (G.lightT || 0) + dt; P.battery = Math.max(0, P.battery - 7 * dt); repelK = Math.min(1, G.lightT / (G.enraged ? 2.2 : 1.3));
    if (G.lightT > (G.enraged ? 2.2 : 1.3)) {
      G.lightT = 0; G.repelCD = 22; G.hunt = null; G.state = 'search'; G.spawnGrace = 2.5; G.path = []; G.replan = 0; G.wait = 0;
      let far = F.nodes[0]; F.nodes.forEach(n => { if (Math.hypot(n.x - P.x, n.z - P.z) > Math.hypot(far.x - P.x, far.z - P.z)) far = n; });
      G.target = { x: far.x, z: far.z }; sfx.screech(); fx.glitch(.6); shake = .3; talk('repel', 2600);
      fx.dust(G.x, floors[G.floor].y0 + 1, G.z, 25);
    }
  } else { G.lightT = Math.max(0, (G.lightT || 0) - dt * 2); repelK = Math.max(0, repelK - dt * 3); }
  if (G.hunt) { /* 사물함으로 직행 */ }
  else if (sees && G.spawnGrace <= 0) {
    if (G.state !== 'chase') { G.state = 'chase'; sfx.alert(); fx.glitch(.5); evFx('evPulse'); caption('날카로운 비명 — 들켰다'); if (Math.random() < .35) line('gh4', 'whisper'); else talk('spotted', 2600); }
    G.target = { x: P.x, z: P.z }; G.lose = 0;
  } else if (G.state === 'chase') {
    G.lose += dt * (safe ? 4 : 1);
    if (G.lose > 4.5) { G.state = 'search'; G.wait = 0; lockerSearchStart(G); }
  }

  const sp = 1 + Math.min(.25, P.keys * .06);
  let speed = 1.5;
  G.replan -= dt;
  const plan = (tx, tz) => { if (G.replan <= 0 || !G.path.length) { G.path = findPath(F, G.x, G.z, tx, tz); G.replan = .35; } };
  let tgt = G.target;
  const busy = !G.hunt && (fakeTick(G, dt, F) || lockerSearchTick(G, dt, F));
  if (busy) { /* 사물함 수색 · 페이크 퇴장 */ }
  else if (G.hunt) {
    speed = 3.2 * sp; plan(G.hunt.x, G.hunt.z);
    followPath(speed, dt);
    if (Math.hypot(G.hunt.x - G.x, G.hunt.z - G.z) < 1.3) { if (P.hiding) leaveLocker(true); hit(); return; }
  } else if (G.state === 'chase') {
    speed = (G.enraged ? 3.2 : 2.6) * sp * (!G.enraged && litAt(G.floor, G.x, G.z) ? .78 : 1); plan(tgt.x, tgt.z); followPath(speed, dt);
  } else if (G.state === 'search') {
    speed = 2.1; plan(tgt.x, tgt.z);
    const arr = followPath(speed, dt);
    if (arr) { G.wait += dt; if (G.wait > 3) { G.state = 'patrol'; G.path = []; G.wait = 1; if (G.floor === P.floor && Math.random() < .5) at(G.x, floors[G.floor].y0 + 1.5, G.z).ghostLaugh(); } }
  } else { // patrol
    speed = 1.5;
    if (!G.path.length) {
      G.wait -= dt;
      if (G.wait <= 0) {
        const idx = F.nodes.map((n, i) => i).filter(i => !(i === F.entrance));
        idx.sort((a, b) => Math.hypot(F.nodes[a].x - P.x, F.nodes[a].z - P.z) - Math.hypot(F.nodes[b].x - P.x, F.nodes[b].z - P.z));
        let k = Math.random() < .3 ? idx[(Math.random() * 8) | 0] : idx[(Math.random() * idx.length) | 0];
        for (let tries = 0; tries < 4 && litAt(G.floor, F.nodes[k].x, F.nodes[k].z) && Math.random() < .8; tries++) k = idx[(Math.random() * idx.length) | 0];   // 켜진 방은 피한다
        G.path = findPath(F, G.x, G.z, F.nodes[k].x, F.nodes[k].z); G.wait = 1.5 + Math.random() * 2.5;
      }
    } else followPath(speed, dt);
  }
  // 실외 이동 제약
  if (G.floor === 0) {
    if (!G.enraged && G.z > MAIN_ZS - .4) G.z = MAIN_ZS - .4;
    if (G.z > MAIN_ZS + .1) { const p = { x: G.x, z: G.z }; collide(floors[0].col, p, .4); G.x = p.x; G.z = p.z; }
  }

  // 닫힌 문은 열고 지나간다
  for (const d of world.doorList) {
    if (d.floor !== G.floor || d.target > .5) continue;
    const dz = d.kind === 'slide' ? (d.z > 0 ? 1.55 : -1.55) : d.z;
    if (Math.hypot(G.x - d.x, G.z - dz) < 1.3) { d.target = 1; d.slam = true; const dd = Math.hypot(P.x - d.x, P.z - dz); if (G.floor === P.floor && dd < 20) { at(d.x, floors[d.floor].y0 + 1.2, dz).doorBang(0, 1); if (dd < 6) shake = .35; } }
  }
  // 사물함 수색
  if (P.hiding && !G.hunt) {
    const l = P.hiding;
    if (Math.hypot(l.x - G.x, l.z - G.z) < 2.6) { G.findT += dt * (P.holdBreath ? .2 : 1); if (G.findT > 5.2) { const dr = l.dir || { x: 0, z: 1 }; G.hunt = { x: l.x + dr.x * .6, z: l.z + dr.z * .6 }; } } else G.findT = Math.max(0, G.findT - dt);
  }

  // 붙잡힘
  if (sees && !safe && dist < 1.05 && G.spawnGrace <= 0 && P.invuln <= 0) { hit(); return; }

  // 이벤트: 플레이어가 켜 둔 방의 불을 그것이 꺼 버린다 (가끔, 추격 중이 아닐 때)
  if (!G.enraged && G.state !== 'chase' && state === 'playing' && !(G.calmT > 0)) {
    G.swT = (G.swT ?? 40) - dt;
    if (G.swT <= 0) {
      G.swT = 50 + Math.random() * 60;
      const sw = world.props.find(p => p.kind === 'switch' && p.floor === P.floor && p.on && Math.hypot(p.px - P.x, p.pz - P.z) < 7);
      if (sw && dist < 18 && litAt(P.floor, P.x, P.z)) { flipSwitch(sw, false); at(sw.px, floors[sw.floor].y0 + 1.3, sw.pz).click(); fx.glitch(.25); caption('딸깍 — 누군가 불을 껐다'); setFace('fear', 2); }
    }
  }
  // 목소리: 같은 층에 있으면 거리 · 상태에 따라 킥킥 · 흐느낌 · 속삭임 · 끄는 소리 · 숨소리를 낸다
  if (G.floor === P.floor && state === 'playing') {
    G.vocT = (G.vocT ?? 6) - dt;
    if (G.vocT <= 0) {
      const chase = G.state === 'chase', y = floors[G.floor].y0 + 1.5, A = at(G.x, y, G.z);
      if (chase) { G.vocT = 3.5 + Math.random() * 3; (Math.random() < .5 ? A.ghostGiggle() : A.ghostCrack()); }
      else if (dist < 5) { G.vocT = 5 + Math.random() * 4; A.ghostBreath(); if (P.hiding) caption('바로 앞에서… 숨소리'); }
      else if (dist < 26) { G.vocT = 8 + Math.random() * 9; const r = Math.random(); r < .3 ? (A.ghostSob(), caption('어디선가 흐느끼는 소리')) : r < .55 ? (A.ghostWhisper(), caption('알아들을 수 없는 속삭임')) : r < .8 ? (A.ghostDrag(), caption('젖은 무언가를 끄는 소리')) : (A.ghostGiggle(), caption('아이의 웃음소리')); }
      else G.vocT = 6;
    }
  }
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
const KEY_WHERE = ['본관 1층 · 교무실 금고', '본관 1층 · 도서실 대출 데스크', '본관 2층 · 과학실 약품장', '체육관 · 기록석 기구함', '수영장 · 배수구'];
const KEY_HINT = ['비밀번호: 그날의 날짜', '잠긴 서랍 — 머리핀으로 따기', '다이얼 — 칠판 메모', '다이얼 — 전광판 점수', '갈고리 필요 — 대걸레 자루(지하 청소도구실) + 철사(별관 1층 기술·가정실)'];
function objective() {
  const n3 = docs.some(d => d.id === 'n3');
  if (!FL.cam && P.keys === 0) return { ch: 1, main: gateClosed ? '1학년 1반에서 민아의 흔적을 찾아라' : '민아를 찾아 학교 안으로 들어가라', loc: gateClosed ? LOC.cam : LOC.entrance,
    subs: [['학교 안으로 들어가기', introDone], ['1-1 교실 조사하기', FL.cam]] };
  if (!got[0]) return { ch: 2, main: '교무실 금고를 열어 첫 번째 열쇠 조각을 찾아라', loc: LOC.office,
    subs: [['민아의 캠코더 확인', FL.cam], ['교무회의록 읽기', n3], ['금고 열기 — 비밀번호: 그날의 날짜', got[0]]] };
  if (P.keys < TOTAL) {
    const left = KEY_ROOMS.map((r, i) => ({ ...r, i })).filter(r => !got[r.i]);
    const k = left.find(r => r.f === P.floor) || left[0];
    const subs = KEY_NAMES.map((n, i) => [`${n} — ${KEY_HINT[i]}`, got[i]]);
    // 수영장 조각: 갈고리 재료가 없으면 재료 위치를 목표로 안내한다 (재료가 어디 있는지 몰라 막히는 문제)
    if (!got[4] && !FL.hook) {
      subs.push(['  ↳ 대걸레 자루 — 지하 B1 청소도구실', FL.mop], ['  ↳ 철사 뭉치 — 별관 1층 기술·가정실 (102)', FL.wire], ['  ↳ 소지품(Tab)에서 둘을 조합 → 갈고리 장대', false]);
      if (k.i === 4 || left.length === 1) {
        const tl = n => { const it = world.items.find(i => i.kind === n); return it && { f: it.floor, x: it.pos.x, z: it.pos.z }; };
        if (!FL.mop) return { ch: 3, main: `수영장 조각을 꺼낼 갈고리 재료를 찾아라 (${P.keys}/${TOTAL})`, loc: { ...tl('mop'), where: '지하 B1 · 청소도구실 — 대걸레 자루' }, subs };
        if (!FL.wire) return { ch: 3, main: `수영장 조각을 꺼낼 갈고리 재료를 찾아라 (${P.keys}/${TOTAL})`, loc: { ...tl('wire'), where: '별관 1층 · 기술·가정실 (102) — 철사 뭉치' }, subs };
        return { ch: 3, main: '소지품(Tab) › 열쇠 아이템에서 대걸레 자루와 철사를 조합하라', loc: null, subs };
      }
    }
    return { ch: 3, main: `정문 열쇠 조각을 모두 모아라 (${P.keys}/${TOTAL})`, loc: { ...k, where: `${KEY_WHERE[k.i]} — ${KEY_HINT[k.i]}` }, subs };
  }
  if (!FL.gatekey && !FL.keyhead) {   // 제4장 · 열쇠의 머리 (별관)
    const s = (FL.sq && FL.sq.head) || 0, st = HEADQUEST.steps[Math.min(s, HEADQUEST.steps.length - 1)], hp = world.props.find(q => q.uid === `sq:head:${s}`);
    return { ch: 4, main: s === 0 ? '열쇠의 머리가 없다 — 교장실에서 단서를 찾아라' : '별관 진열장에 숨겨진 열쇠의 머리를 찾아라', loc: hp ? { f: hp.floor, x: hp.x, z: hp.z, where: st.where } : null,
      subs: HEADQUEST.steps.map((x, i) => [x.goal, s > i]) };
  }
  if (!FL.gatekey) return { ch: 5, main: '소지품(Tab)에서 열쇠 머리와 조각 다섯 개를 조합하라', loc: null, subs: [[`열쇠 조각 ${TOTAL}/${TOTAL}`, true], ['열쇠 머리', true], ['정문 열쇠 만들기', false]] };
  return { ch: 6, main: FL.mina ? '민아와 함께 정문으로 나가라' : '정문으로 달려가 탈출하라', loc: LOC.gate, subs: FL.calm ? [['하늘의 하교 방송', true]] : [['그것에게 잡히지 않기', false]] };
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
  sqSync(); const aq = SIDEQUESTS.filter(q => sqStep(q.id) > 0 && sqStep(q.id) < q.steps.length);
  $('sqBox').style.display = aq.length || sqDoneCount() ? 'block' : 'none'; $('sqTitle').textContent = `의뢰 · 남겨진 부탁 (${sqDoneCount()}/${SIDEQUESTS.length})`;
  $('sqSubs').innerHTML = aq.slice(0, 3).map(q => `<div class="chk">${q.title} — ${q.steps[sqStep(q.id)].goal}</div>`).join('') + (aq.length > 3 ? `<div class="chk" style="opacity:.6">외 ${aq.length - 3}건 (휴대폰 › 사건)</div>` : '');
  $('c2').textContent = inv.battery; $('c3').textContent = inv.medkit; $('c5').textContent = inv.can; $('s5').classList.toggle('off', !inv.can); $('c4').textContent = FL.gatekey ? '열쇠' : `${P.keys}/${TOTAL}`;
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
  logLine(CH().name, text);
  $('dlgText').textContent = text; $('dlgName').textContent = CH().name;
  $('dlg').classList.toggle('show', VS.subs || !VS.dub); clearTimeout(talkTimer);
  talkTimer = setTimeout(() => $('dlg').classList.remove('show'), ms);
  const vid = L && `l_${id}_${CK()}`;
  if (vid && lineInfo(vid)) speak(vid).then(sec => { clearTimeout(talkTimer); talkTimer = setTimeout(() => $('dlg').classList.remove('show'), Math.max(ms, sec * 1000 + 700)); });
}
// 이야기 장면(녹화 · 녹음 · 메시지 · 문서 · 퍼즐) 직후 잠시 그것이 물러나 있게 한다
function storyCalm(sec = 40) { ghost.calmT = Math.max(ghost.calmT || 0, sec); if (ghost.active && !ghost.enraged && ghost.floor === P.floor && ghost.state !== 'chase') { ghost.state = 'patrol'; ghost.path = []; ghost.wait = 3; } }
function addClue(id) { storyCalm(30); if (clues.includes(id)) return; clues.push(id); }
// 게임 시각: 17:50 에 도착, 해가 지는 동안 한 시간 남짓 흐르고, 이후 실제 1분 = 게임 4분 (한 시간 플레이 ≈ 23시)
const gameMin = (extra = 0) => Math.floor(17 * 60 + 50 + (playTime + extra) * 4 / 60 + 70 * (1 - DAY.k / .92));
function clockText(extra = 0) { const m = gameMin(extra), h = Math.floor(m / 60) % 24; return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }

/* ----- 문서 (쪽지 · 사진 · 녹음 · 캠코더) ----- */
function docInfo(d) {
  if (d.kind === 'note') { const n = d.id === 'nC' ? CHAR_NOTE[CK()] : world.NOTES[d.id]; return n && { icon: '📄', title: n.title, text: n.text }; }
  if (d.kind === 'photo') { const p = world.PHOTOS[d.id]; return p && { icon: '🖼', title: p.title, text: p.text, img: p.img }; }
  if (d.kind === 'tape') { const t = world.TAPES[d.id]; const i = lineInfo(d.id) || VO[d.id]; return t && { icon: '📼', title: t.title, text: i ? i.text : '', tape: d.id, spk: '📼 ' + t.spk }; }
  if (d.kind === 'cam') return { icon: '📹', title: '캠코더 녹화 — 민아', text: VO.cam1.text, tape: 'cam1', spk: '📹 민아', fx: 'phone' };
  return null;
}
function addDoc(d) { if (docs.some(x => x.id === d.id)) return; const i = docInfo(d); if (i) docs.push({ ...d, ...i }); }
const DOC_TOTAL = () => world.items.filter(i => i.kind === 'note' || i.kind === 'photo').length + Object.keys(world.TAPES).length + 1;
async function playCam() {
  storyCalm(45);
  const sec = await line('cam1', 'phone', '📹 민아 (녹화)');
  setTimeout(() => { if (state === 'playing' || state === 'ui') talk('afterCam', 3200); }, (sec + .6) * 1000);
}

/* ----- 소지품 ----- */
let invTab = 'items', invSel = 0, combineFrom = null, invMsg = '', mapFloor = 0;
const TABS = ['items', 'docs', 'keys', 'col', 'craft'];
const iconHTML = ic => /^[a-z_0-9]+$/.test(ic) ? `<img src="assets/ui/${ic}.webp" alt="">` : ic;
function bagList() {
  const L = CH().items.map(id => ({ id }));
  if (inv.battery) L.push({ id: 'battery', n: inv.battery });
  if (inv.medkit) L.push({ id: 'medkit', n: inv.medkit });
  if (FL.gatekey) L.push({ id: 'gatekey' });
  if (FL.keyhead && !FL.gatekey) L.push({ id: 'keyhead' });
  if (P.keys && !FL.gatekey) L.push({ id: 'keypiece', n: P.keys });
  if (inv.hairpin) L.push({ id: 'hairpin', n: inv.hairpin });
  if (inv.can) L.push({ id: 'can', n: inv.can });
  ['candy', 'thermos', 'salt', 'charm', 'musicbox', 'matches', 'tape', 'sedative', 'alarm', 'shock', 'firstaid'].forEach(k => { if (inv[k]) L.push({ id: k, n: inv[k] }); });   // 사물함 수색 · 방 이벤트 소모품
  if (FL.tag) L.push({ id: 'nametag' });
  ['hook', 'fuse', 'mop', 'wire'].forEach(k => { if (FL[k]) L.push({ id: k }); });
  if (FL.cam) L.push({ id: 'camcorder' });
  ['tapeTrio', 'emBattery', 'bookHome', 'letterT'].forEach(k => { if (FL.qi && FL.qi[k]) L.push({ id: k }); });   // 의뢰 아이템
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
  candy: () => { inv.candy--; P.stamina = 100; P.tired = false; P.fear = Math.max(0, P.fear - .3); sfx.pickup(); refreshHud(); return '사탕을 깨물었다. 단맛에 숨이 돌아온다.'; },
  thermos: () => { inv.thermos--; P.hp = Math.min(100, P.hp + 20); calmDown(30, '따뜻한 차가 목을 타고 내려간다'); refreshHud(); return '유자차를 마셨다. 체력 +20'; },
  salt: () => useSalt(), charm: () => '지니고만 있으면 된다. 그것에게 붙잡히는 순간 대신 타오른다.',
  musicbox: () => { closeUI(); setTimeout(placeMusicBox, 80); },
  matches: () => { closeUI(); setTimeout(strikeMatch, 80); },
  nametag: () => (power ? '3층 방송실 장비에서 이 이름을 불러 줄 수 있다.' : '방송실에서 이 이름을 불러 주려면 먼저 전기가 필요하다.'),
  necklace: () => '“첫 녹음 기념. 우리 방송, 오래 하자.” — 민아',
  keys_jihun: () => '민아가 맡겨 둔 열쇠. 꼭 돌려줘야 한다.',
  hairpin: () => '잠긴 서랍이나 보관함 앞에서 E — 자물쇠 따기',
  can: () => { closeUI(); setTimeout(throwCan, 80); },
  tape: () => { startCombine('tape'); return '빈 캔과 묶어 볼까?'; }, sedative: () => { startCombine('sedative'); return '응급 밴드와 함께 쓰면 좋겠다'; },
  alarm: () => { closeUI(); setTimeout(placeAlarm, 80); }, shock: () => { closeUI(); setTimeout(throwShock, 80); }, firstaid: () => useFirstAid(),
  fuse: () => '지하 전기실 주 차단기에 끼울 수 있다.',
  hook: () => '수영장 배수구에서 쓸 수 있다.',
  mop: () => { startCombine('mop'); return '무엇과 묶을까?'; }, wire: () => { startCombine('wire'); return '무엇에 감을까?'; },
};
const canCombine = id => RECIPES.some(r => r.a === id || r.b === id);
function craftNow() { const r = craftingSystem.recipes[invSel]; if (!r) return; const ok = craftingSystem.craft(r.resultId, m => { invMsg = m; }); if (ok) { newItems.add({ trap_can: 'alarm', short_bomb: 'shock', med_kit: 'firstaid' }[r.resultId]); refreshHud(); } else sfx.buzz(); renderInv(); }
function startCombine(id) { combineFrom = id; invMsg = `「${ITEMS[id].name}」과(와) 조합할 아이템을 고르세요 · Esc 취소`; renderInv(); }
function tryCombine(a, b) {
  combineFrom = null;
  const r = RECIPES.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  if (!r) { talk('combineFail', 2200); invMsg = '이 둘은 함께 쓸 수 없다.'; sfx.buzz(); renderInv(); return; }
  if (r.fn === 'recharge') invMsg = useBattery() ? '손전등 배터리를 갈아 끼웠다.' : '';
  else if (r.fn === 'hook') { FL.hook = true; FL.mop = false; FL.wire = false; newItems.add('hook'); sfx.hook(); invMsg = '대걸레 자루에 철사를 감아 갈고리 장대를 만들었다!'; talk('hookMade', 3000); toast('조합 성공', '갈고리 장대 — 수영장 배수구에서 사용'); save(true); }
  else if (CRAFT_ID[r.fn]) { const ok = craftingSystem.craft(CRAFT_ID[r.fn], m => { invMsg = m; }); if (ok) { newItems.add(r.fn); toast('조합 성공', ITEMS[r.fn].name, 'info'); refreshHud(); } else sfx.buzz(); }
  else if (r.fn === 'gatekey') {
    if (P.keys < TOTAL) { invMsg = `조각이 부족하다 — ${P.keys} / ${TOTAL}`; sfx.buzz(); }
    else if (!FL.keyhead) { invMsg = '다섯 조각은 맞물리지만 손으로 쥘 머리가 없다 — 돌릴 수가 없다.'; sfx.buzz(); talk('headMissing', 3000); }
    else { makeGateKey(); invMsg = '머리와 다섯 조각이 맞물려 정문 열쇠가 되었다!'; }
  }
  renderInv();
}
// 점프: 앉아 있으면 일어서며 뛴다 · 숨이 차면 낮게 뛴다 (예전엔 아무 반응 없이 무시돼 '점프가 안 된다'로 보였다)
//   착지 직전에 누른 입력은 잠깐 기억했다가 착지하자마자 뛴다
let jumpBuf = 0;
function tryJump() {
  if (P.hiding) return;
  if (Math.abs(P.vy || 0) > .01) { jumpBuf = .18; return; }
  P.crouch = false;
  const weak = P.tired || P.stamina < 8;
  P.vy = weak ? 3.2 : 4.7; P.jy = (P.jy || 0) + .001; P.stamina = Math.max(0, P.stamina - (weak ? 2 : 8)); sfx.throwIt();
  if (weak) say('숨이 차서 높이 뛸 수 없다', 1400);
}
function makeGateKey() {
  if (FL.gatekey) return;
  if (!FL.keyhead) { toast('열쇠가 완성되지 않는다', '열쇠의 머리가 없다 — 제4장 목표를 확인하세요', 'warn'); return; }
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
      { const rs = RECIPES.filter(r => r.a === it.id || r.b === it.id); c.title = it.name + (rs.length ? '\n조합: ' + rs.map(r => `${ITEMS[r.a === it.id ? r.b : r.a].name} → ${RESULT[r.fn]}`).join(' · ') : ''); }
      c.innerHTML = iconHTML(it.icon) + (it.n > 1 ? `<em>×${it.n}</em>` : '') + (newItems.has(it.id) ? '<span class="new">NEW</span>' : '');
      c.onclick = () => { if (combineFrom) { tryCombine(combineFrom, it.id); return; } invSel = i; invMsg = ''; renderInv(); };
      grid.appendChild(c);
    }
    $('invCap').innerHTML = `<span>${its.length}개 · ${invTab === 'items' ? '아이템' : '열쇠 아이템'}</span><span>←→↑↓ 선택 · Enter 사용 · C 조합 · Z 자세히</span>`;
    const it = its[invSel];
    if (!it) { det.innerHTML = invTab === 'keys' ? keyPieceHTML() : '<p>비어 있다.</p>'; return; }
    newItems.delete(it.id);
    det.innerHTML = `<div class="big">${iconHTML(it.icon)}</div><h3>${it.name}${it.n > 1 ? ` <small style="color:var(--dim)">×${it.n}</small>` : ''}</h3><div class="cat">${it.cat === 'key' ? '열쇠 아이템' : '아이템'}</div><div>${itemDesc(it)}</div>${recipeHTML(it.id)}${invTab === 'keys' ? keyPieceHTML() : ''}` +
      actBtns([['사용', 'Enter'], ['조합', 'C', !canCombine(it.id)], ['자세히', 'Z']]);
    bindActs([() => invUse(it), () => startCombine(it.id), () => zoom(it.name, iconHTML(it.icon), itemDesc(it))]);
  } else if (invTab === 'craft') {   // 조합 — CraftingSystem 레시피 목록 (재료 개수 · 클릭 / Enter 로 제작)
    grid.className = 'craftList'; const rs = craftingSystem.recipes; invSel = clamp(invSel, 0, rs.length - 1);
    const label = { can: '빈 캔', tape: '절연 테이프', battery: '건전지', bandage: '응급 밴드', pill: '보건실 진정제' }, own = { trap_can: 'alarm', short_bomb: 'shock', med_kit: 'firstaid' };
    rs.forEach((r, i) => { const ok = craftingSystem.canCraft(r), c = document.createElement('div'); c.className = 'cell craftRow' + (i === invSel ? ' sel' : '') + (ok ? '' : ' empty');
      c.innerHTML = `${iconHTML(ITEMS[own[r.resultId]].icon)}<div><b>${r.resultName}</b> <small>보유 ${inv[own[r.resultId]] || 0}</small><br><small>${Object.entries(r.ingredients).map(([k, q]) => `${label[k]} ${craftingSystem.inventory.items[k]}/${q}`).join(' + ')}</small></div>`;
      c.onclick = () => { if (invSel === i) craftNow(); else { invSel = i; invMsg = ''; renderInv(); } }; grid.appendChild(c); });
    const r = rs[invSel]; det.innerHTML = `<div class="big">${iconHTML(ITEMS[own[r.resultId]].icon)}</div><h3>${r.resultName}</h3><div class="cat">조합</div><div>${r.desc}</div>` + actBtns([['제작', 'Enter', !craftingSystem.canCraft(r)]]);
    bindActs([craftNow]);
  } else if (invTab === 'col') {   // 수집품 — 하늘의 물건들
    grid.className = ''; FL.col = FL.col || {};
    const n = COLLECT.filter(c => FL.col[c.id]).length; invSel = clamp(invSel, 0, COLLECT.length - 1);
    COLLECT.forEach((cdef, i) => { const has = FL.col[cdef.id], c = document.createElement('div'); c.className = 'cell' + (i === invSel ? ' sel' : '') + (has ? '' : ' empty'); c.innerHTML = has ? cdef.icon + (newItems.has(cdef.id) ? '<span class="new">NEW</span>' : '') : '<span style="opacity:.35">?</span>'; c.onclick = () => { invSel = i; renderInv(); }; grid.appendChild(c); });
    $('invCap').innerHTML = `<span>수집품 ${n} / ${COLLECT.length}${n >= COLLECT.length ? ' · 모두 모았다' : ''}</span><span>사물함 · 방 곳곳에서 찾을 수 있다</span>`;
    const cd = COLLECT[invSel], has = FL.col[cd.id]; newItems.delete(cd.id);
    det.innerHTML = has ? `<div class="big">${cd.icon}</div><h3>${cd.name}</h3><div class="cat">수집품 · ${invSel + 1}번</div><div>${cd.desc}</div>` + actBtns([['자세히', 'Z']]) : `<div class="big" style="opacity:.3">?</div><h3>???</h3><div class="cat">아직 찾지 못했다</div><div style="color:var(--dim)">어딘가의 사물함이나 방에 남아 있다.</div>`;
    if (has) bindActs([() => zoom(cd.name, cd.icon, cd.desc)]);
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
const RESULT = { recharge: '손전등 배터리 충전', gatekey: '정문 열쇠 (조각 5개 필요)', hook: '갈고리 장대', alarm: '경보 함정', shock: '쇼트 폭탄', firstaid: '응급 처치 키트' };
function recipeHTML(id) {
  const rs = RECIPES.filter(r => r.a === id || r.b === id); if (!rs.length) return '';
  return `<div style="margin-top:8px;font-size:12px;color:#8cc0e8">${rs.map(r => `조합: ${ITEMS[r.a].name} + ${ITEMS[r.b].name} → <b>${RESULT[r.fn]}</b>`).join('<br>')}</div>`;
}
function keyPieceHTML() {
  return `<div class="pieceList" style="margin-top:10px;border-top:1px solid #2c3640;padding-top:8px"><b style="font-size:12px;color:var(--dim)">정문 열쇠 조각 ${P.keys}/${TOTAL}</b>${KEY_NAMES.map((n, i) => `<div class="chk${got[i] ? ' done' : ''}">${KEY_WHERE[i]}</div>`).join('')}</div>`;
}
function invKey(e) {
  const c = e.code, list = invTab === 'craft' ? craftingSystem.recipes : invTab === 'docs' ? docs : invTab === 'col' ? COLLECT : bagList().filter(i => (i.cat === 'key') === (invTab === 'keys'));
  if ($('invZoom').classList.contains('show')) { if (['Escape', 'KeyZ', 'Enter', 'Tab'].includes(c)) $('invZoom').classList.remove('show'); return true; }
  if (c === 'Escape' && combineFrom) { combineFrom = null; invMsg = ''; renderInv(); return true; }
  if (c === 'KeyQ' || c === 'KeyE') { invTab = TABS[(TABS.indexOf(invTab) + (c === 'KeyE' ? 1 : TABS.length - 1)) % TABS.length]; invSel = 0; combineFrom = null; invMsg = ''; renderInv(); return true; }
  const cols = invTab === 'docs' || invTab === 'craft' ? 1 : 5;
  if (invTab === 'craft' && (c === 'Enter' || c === 'Space' || c === 'KeyC')) { craftNow(); return true; }
  const mv = { ArrowRight: 1, KeyD: 1, ArrowLeft: -1, KeyA: -1, ArrowDown: cols, KeyS: cols, ArrowUp: -cols, KeyW: -cols }[c];
  if (mv) { invSel = clamp(invSel + mv, 0, Math.max(0, list.length - 1)); invMsg = combineFrom ? invMsg : ''; renderInv(); return true; }
  if (c === 'Enter' || c === 'Space') { const b = $('invActs') && $('invActs').querySelector('[data-a="0"]'); if (combineFrom && invTab !== 'docs') { const it = list[invSel]; if (it) tryCombine(combineFrom, it.id); } else if (b && !b.disabled) b.click(); return true; }
  if (c === 'KeyC' && invTab !== 'docs' && invTab !== 'col') { const it = list[invSel]; if (it && canCombine(it.id)) startCombine(it.id); return true; }
  if (c === 'KeyZ') { const b = $('invActs') && [...$('invActs').querySelectorAll('button')].pop(); if (b) b.click(); return true; }
  return false;
}

/* ----- 휴대폰 ----- */
let phoneTab = 'msg';
const PTABS = ['msg', 'photo', 'memo', 'tl', 'tool', 'cam', 'log'];
const phoneSeen = { photo: 0, memo: 0, tl: 0 };
const hasDoc = id => docs.some(d => d.id === id);
const tlKnown = () => TIMELINE.filter(e => hasDoc(e.need)).length;
function openPhone(tab = 'msg') { if (state !== 'playing') return; phoneTab = tab; openUI('phone'); renderPhone(); sfx.click(); }
function renderPhone() {
  document.querySelectorAll('.pTabs button').forEach(b => b.classList.toggle('on', b.dataset.p === phoneTab));
  $('pClock').textContent = clockText(); $('pBat').textContent = `🔋 ${Math.round(P.pbat ?? 100)}%`;
  const B = $('pBody');
  if (phoneTab === 'msg') {
    const fk = fakeMsgs.slice().reverse().map(m => `<div class="bubble unread" style="border-color:#a02020"><small style="color:#ff6060">${m.who} · ${m.t}</small>${m.text}</div>`).join('');
    B.innerHTML = fk + (msgs.length ? msgs.slice().reverse().map(m => `<div class="bubble${m.read ? '' : ' unread'}" data-id="${m.id}"><img class="av" src="assets/ui/mina_portrait.webp" alt=""><small>민아 · ${m.t} · ▶ 음성 메시지</small>${VO[m.id].text}</div>`).join('') : '<div class="pEmpty">메시지가 없습니다.<br>신호 없음</div>');
    B.querySelectorAll('.bubble[data-id]').forEach(b => { b.onclick = () => line(b.dataset.id, 'phone', '📱 민아'); });
    msgs.forEach(m => { m.read = true; }); refreshHud();
  } else if (phoneTab === 'photo') {
    const ph = docs.filter(d => d.img).map(d => ({ src: `assets/img/${d.img}.webp`, title: d.title })).concat((FL.spirit || []).map((x, i) => ({ src: spiritPhoto(x), title: `심령 사진 #${i + 1} — ${x.text}` })));
    B.innerHTML = ph.length ? `<div class="pPhotos">${ph.map(d => `<img src="${d.src}" alt="" title="${d.title}" data-t="${d.title}">`).join('')}</div>` : '<div class="pEmpty">저장된 사진이 없습니다.</div>';
    B.querySelectorAll('img').forEach(im => { im.onclick = () => { $('lbImg').src = im.src; $('lbCap').textContent = im.dataset.t; $('lightbox').classList.add('show'); }; });
  } else if (phoneTab === 'memo') {
    const sp = (FL.spirit || []).slice().reverse().map(x => `<div class="memo">📷 <b>심령 사진</b> (${x.t || ''}) — ${x.text}<br><i>${x.subText}</i></div>`).join('');
    B.innerHTML = clues.length || sp ? sp + clues.slice().reverse().map(c => `<div class="memo">${CLUES[c]}</div>`).join('') : '<div class="pEmpty">아직 기록한 단서가 없습니다.</div>';
  } else if (phoneTab === 'tool') {
    const o = objective(), d = objDir(), cd = Math.ceil(P.flashCD || 0), pb = Math.round(P.pbat ?? 100);
    B.innerHTML = `<div class="pTool"><div class="pCard"><small>📍 현재 위치</small><b>${whereText()}</b><span>${o.main}${o.loc ? `<br>목표 위치: ${o.loc.where}` : ''}${d ? `<br><em>${d.text}</em>` : ''}</span></div>
      <button data-t="flash"${cd || pb < 15 ? ' disabled' : ''}>📸 카메라 플래시<small>${cd ? `충전 중 ${cd}초` : '앞에 있는 그것을 잠깐 물러나게 한다 · 배터리 15%'}</small></button>
      <button data-t="radar"${pb < 5 ? ' disabled' : ''}>📡 잡음 탐지<small>그것이 같은 층에 있는지 · 얼마나 가까운지 · 배터리 5%</small></button>
      <button data-t="save"${ghost.state === 'chase' && ghost.active && ghost.floor === P.floor ? ' disabled' : ''}>💾 빠른 저장<small>F5 — 쫓기는 중에는 저장할 수 없다</small></button>
      <div class="pNote">휴대폰 배터리는 천천히 충전된다 (보조 배터리 내장)</div></div>`;
    B.querySelectorAll('button[data-t]').forEach(b => { b.onclick = () => phoneTool(b.dataset.t); });
  } else if (phoneTab === 'cam') {   // [📷 카메라] — 휴대폰을 닫고 바로 심령 카메라
    phoneTab = 'msg'; closeUI(); setTimeout(() => camMode(true), 60); return;
  } else if (phoneTab === 'log') {
    B.innerHTML = SUBLOG.length ? SUBLOG.slice().reverse().map(l => `<div class="pLog"><b>${l.who === '·' ? '♪' : l.who || '…'}</b><span>${l.who === '·' ? `[${l.text}]` : l.text}</span></div>`).join('') : '<div class="pEmpty">기록된 대화가 없습니다.</div>';
  } else {
    const n = tlKnown();
    B.innerHTML = `<div class="tlHead">10월 12일 밤 — 사건 연표 <b>${n} / ${TIMELINE.length}</b></div>` + TIMELINE.map(e => {
      const ok = hasDoc(e.need), cf = ok && e.conflict && hasDoc(e.conflict);
      return `<div class="tl${ok ? '' : ' unk'}${cf ? ' cf' : ''}"><b>${e.t}</b><span>${ok ? e.text : '??? — 아직 모르는 일'}${cf ? '<em>⚠ 다른 증언과 모순</em>' : ''}</span></div>`;
    }).join('') + (n === TIMELINE.length ? '<div class="tlEnd">모든 조각이 맞춰졌다. 문은 밖에서 잠겨 있었고, 하늘이는 집에 가지 못했다.</div>' : '');
  }
  if (phoneTab === 'photo') phoneSeen.photo = docs.filter(d => d.img).length;
  if (phoneTab === 'memo') phoneSeen.memo = clues.length;
  if (phoneTab === 'tl') phoneSeen.tl = tlKnown();
  document.querySelectorAll('.pTabs button').forEach(b => { const k = b.dataset.p; b.classList.toggle('dot', k === 'photo' ? docs.filter(d => d.img).length > phoneSeen.photo : k === 'memo' ? clues.length > phoneSeen.memo : k === 'tl' ? tlKnown() > phoneSeen.tl : false); });
}
document.querySelectorAll('.pTabs button').forEach(b => { b.onclick = () => { phoneTab = b.dataset.p; renderPhone(); }; });
// 휴대폰 도구: 카메라 플래시(그것을 물러나게 함) · 잡음 탐지 · 빠른 저장
function phoneTool(t) {
  const G = ghost, same = G.active && G.floor === P.floor, dist = same ? Math.hypot(G.x - P.x, G.z - P.z) : 99;
  if (t === 'flash') {
    if ((P.flashCD || 0) > 0 || (P.pbat ?? 100) < 15) return;
    P.pbat = (P.pbat ?? 100) - 15; P.flashCD = 60; sfx.photo(); fx.lightning(); closeUI();
    const lx = -Math.sin(P.yaw), lz = -Math.cos(P.yaw), F = floors[P.floor];
    if (same && dist < 10 && ((G.x - P.x) * lx + (G.z - P.z) * lz) / Math.max(dist, .01) > .8 && los(F.walls, P.x, P.z, G.x, G.z)) {
      G.repelCD = 22; G.hunt = null; G.state = 'search'; G.spawnGrace = 3; G.path = []; G.replan = 0; G.wait = 0;
      let far = F.nodes[0]; F.nodes.forEach(n => { if (Math.hypot(n.x - P.x, n.z - P.z) > Math.hypot(far.x - P.x, far.z - P.z)) far = n; });
      G.target = { x: far.x, z: far.z }; sfx.screech(); fx.glitch(.6); shake = .3; talk('repel', 2600); fx.dust(G.x, floors[G.floor].y0 + 1, G.z, 25);
    } else caption('찰칵 — 섬광이 어둠을 잠깐 밀어냈다');
    return;
  }
  if (t === 'radar') {
    if ((P.pbat ?? 100) < 5) return; P.pbat = (P.pbat ?? 100) - 5; sfx.staticNoise(.8);
    const msg = !same ? '잡음 없음 — 이 층에는 없다' : dist < 10 ? '⚠ 잡음 최대 — 아주 가까이 있다' : dist < 22 ? '잡음 강함 — 같은 층, 가깝다' : '잡음 약함 — 같은 층 어딘가에 있다';
    toast('📡 잡음 탐지', msg, same && dist < 22 ? 'warn' : 'info'); renderPhone(); return;
  }
  if (t === 'save') { if (G.active && G.state === 'chase' && same) { toast('저장할 수 없습니다', '쫓기는 중', 'warn'); return; } save(); renderPhone(); }
}
// 주변 살피기 (H): 가까운 조사 대상 이름을 화면에 3초 동안 띄운다
let pingList = [], pingT = 0, scanCD = 0;
const PING_NAME = { switch: '형광등 스위치', elevator: '엘리베이터', robj: null, clue: '책상 밑', safe: '금고', breaker: '차단기', console: '방송 장비', tape: '녹음기', piano: '피아노', lock: '보관함', drain: '배수구' };
function scanAround() {
  if (state !== 'playing' || scanCD > 0) return; scanCD = 4; sfx.ui();
  const F = floors[P.floor], near = [];
  const add = (x, y, z, name) => { const d = Math.hypot(x - P.x, z - P.z); if (d < 9 && (d < 3.5 || los(F.walls, P.x, P.z, x, z))) near.push({ x, y: F.y0 + y, z, name, d }); };
  world.props.forEach(p => { if (p.floor !== P.floor || p.done) return; const n = p.kind === 'robj' ? p.label : PING_NAME[p.kind] ?? p.label; if (n) add(p.px ?? p.x, p.y ?? 1, p.pz ?? p.z, n); });
  world.items.forEach(it => { if (it.floor === P.floor && !it.taken && it.pos && it.mesh && it.mesh.visible) add(it.pos.x, it.pos.y - F.y0 + .25, it.pos.z, it.kind === 'note' ? '쪽지' : it.kind === 'battery' ? '건전지' : it.kind === 'medkit' ? '응급 밴드' : it.kind === 'key' ? '열쇠 조각' : '물건'); });
  world.lockers.forEach(l => { if (l.floor === P.floor) add(l.x, 1.2, l.z, '숨을 곳'); });
  pingList = near.sort((a, b) => a.d - b.d).slice(0, 10); pingT = 3;
  const box = $('pings'); box.innerHTML = pingList.map(q => `<div>${q.name}</div>`).join('');
  if (!pingList.length) caption('주변에 눈에 띄는 것이 없다');
}
const _pv = new THREE.Vector3();
function updatePings(dt) {
  scanCD = Math.max(0, scanCD - dt); if (pingT <= 0) return; pingT -= dt;
  const els = $('pings').children;
  pingList.forEach((q, i) => { const el = els[i]; if (!el) return; _pv.set(q.x, q.y, q.z).project(camera); const on = _pv.z < 1 && Math.abs(_pv.x) < 1.1 && Math.abs(_pv.y) < 1.1; el.style.display = on ? '' : 'none'; if (on) { el.style.left = ((_pv.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - _pv.y) / 2 * innerHeight) + 'px'; } });
  if (pingT <= 0) $('pings').innerHTML = '';
}
let objDirT = 0;
function updateObjDir(dt) {
  if ((objDirT -= dt) > 0) return; objDirT = .12;
  const el = $('objDir'), d = SET.objArrow && state === 'playing' ? objDir() : null; el.classList.toggle('on', !!d); if (!d) return;
  el.querySelector('span').textContent = d.text;
  el.querySelector('i').style.transform = d.other ? 'rotate(-90deg)' : `rotate(${(-(d.ang - P.yaw) * 180 / Math.PI) - 90}deg)`;
}
// 목표 방향: 같은 층이면 방위 · 거리, 다른 층이면 계단/엘리베이터 안내
function objDir() {
  const o = objective(), l = o && o.loc; if (!l) return null;
  if (l.f !== P.floor && (l.f >= 8 || P.floor >= 8)) return { other: true, text: l.f >= 8 && P.floor >= 8 ? `${FLOOR_LABEL[l.f] || '별관'} — ${l.f > P.floor ? '위층' : '아래층'} (별관 계단)` : l.f >= 8 ? `${FLOOR_LABEL[l.f] || '별관'} — 본관 1층 중앙계단실 북쪽 유리 통로로` : '별관 1층 현관 → 유리 통로로 본관에 돌아갈 것' };
  if (l.f !== P.floor) { const up = (l.f === 3 || (l.f >= 1 && l.f <= 2 && P.floor < l.f && P.floor !== 4) || (P.floor === 4 && l.f !== 4)); return { other: true, text: `${FLOOR_LABEL[l.f] || '다른 장소'} — ${l.f >= 5 && l.f <= 7 ? '밖으로 나가 건물을 찾을 것' : up ? '위층 (계단 · 엘리베이터)' : '아래층 (계단 · 엘리베이터)'}` }; }
  const dx = l.x - P.x, dz = l.z - P.z, d = Math.hypot(dx, dz), ang = Math.atan2(-dx, -dz);
  const dirs = ['북', '북서', '서', '남서', '남', '남동', '동', '북동'], i = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
  return { other: false, d, ang, text: d < 2.5 ? '바로 이 근처' : `${dirs[i]}쪽 ${Math.round(d)}m` };
}

/* ----- 열기 / 닫기 ----- */
const UI_PANELS = ['inv', 'mapOv', 'testOv', 'keypad', 'phone', 'invZoom', 'chalk'];
function openUI(kind) { if (state !== 'playing') return; if (CAM.on) camMode(false); state = 'ui'; for (const k in keys) keys[k] = false; $('prompt').style.display = 'none'; $(kind).classList.add('show'); document.exitPointerLock?.(); }
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
    doors: world.doorList.filter(d => d.floor === f).map(d => ({ x: d.x, z: d.kind === 'slide' ? (d.z > 0 ? 1.55 : -1.55) : d.z, open: d.target > .5, slide: d.kind === 'slide' })),
    props: world.props.filter(p => p.floor === f && p.kind !== 'bell' && p.kind !== 'switch' && p.kind !== 'robj' && p.kind !== 'search' && p.kind !== 'chalk').map(p => ({ x: p.x, z: p.z, done: !!p.done, label: { safe: '금고', breaker: '차단기', console: '방송 장비', tape: '녹음기', mina: '민아', lock: '잠긴 보관함', drain: '배수구', piano: '피아노', easel: '그림', phone: '전화', elevator: '엘리베이터', mspot: '🎲' }[p.kind] })),
    target: mapTarget(f),
  };
}
function renderMap() {
  document.querySelectorAll('#mapTabs button').forEach(b => b.classList.toggle('on', b.dataset.f === String(mapFloor)));
  const guide = mapFloor === 'guide'; $('bigMap').style.display = guide ? 'none' : 'block'; $('guide').style.display = guide ? 'grid' : 'none';
  const o = objective(), t = o.loc || (FL.opt && optLoc());
  $('mapObj').textContent = t ? `★ ${o.main} — ${t.where}  ·  목표 층: ${AREA_NAMES[t.f]}${t.f === mapFloor ? ' (지금 보는 층)' : ''}` : `★ ${o.main}`;
  document.querySelectorAll('#mapTabs button').forEach(b => b.classList.toggle('tgt', !!t && b.dataset.f === String(t.f)));
  if (guide) return;
  const c = $('bigMap'), ctx = c.getContext('2d');
  const V = { 0: [0, 22, 5.2], 1: [0, 0, 10.5], 2: [0, 0, 10.5], 4: [0, 0, 10.5], 5: [38, 19, 22], 6: [-42, 39, 12.5], 7: [-39, 15, 24], 8: [0, -4, 21], 9: [0, -4, 21], 10: [0, -4, 21] }[mapFloor] || [0, -4, 11];
  drawMap(ctx, c.width, c.height, { floor: mapFloor, cx: V[0] + mapPan.x, cz: V[1] + mapPan.z, scale: V[2] * mapZoom, labels: true, pins: mapPins(mapFloor), ...mapExtras(mapFloor), t: tNow,
    lockers: world.lockers.filter(l => l.floor === mapFloor), player: P.floor === mapFloor ? { x: P.x, z: P.z, yaw: P.yaw } : null });
}
document.querySelectorAll('#mapTabs button').forEach(b => { b.onclick = () => { mapFloor = b.dataset.f === 'guide' ? 'guide' : +b.dataset.f; mapZoom = 1; mapPan = { x: 0, z: 0 }; renderMap(); }; });
$('bigMap').addEventListener('wheel', e => { e.preventDefault(); mapZoom = clamp(mapZoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), .5, 4); renderMap(); }, { passive: false });
{ let drag = null; const c = $('bigMap');
  c.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', e => { if (!drag) return; const V = { 0: 5.2, 5: 22, 6: 12.5, 7: 24, 8: 21, 9: 21, 10: 21 }[mapFloor] || 11, k = c.width / c.clientWidth / (V * mapZoom); mapPan.x -= (e.clientX - drag.x) * k; mapPan.z -= (e.clientY - drag.y) * k; drag = { x: e.clientX, y: e.clientY }; renderMap(); });
  c.addEventListener('pointerup', () => { drag = null; }); }

function useBattery() {
  if (inv.battery <= 0) { toast('건전지가 없습니다', '', 'warn'); return false; }
  if (P.battery >= 95 && (P.pbat ?? 100) >= 95) { say('손전등 · 휴대폰 배터리 모두 충분하다', 1800); return false; }
  inv.battery--; P.battery = Math.min(100, P.battery + 45); P.pbat = Math.min(100, (P.pbat ?? 100) + 50);   // 휴대폰도 +50% if (!P.light) P.light = true; sfx.pickup(); toast('건전지를 교체했습니다', '손전등 배터리 +45% · 휴대폰 +50%', 'info'); refreshHud(); return true;
}
function useMedkit() {
  if (inv.medkit <= 0) { toast('응급 밴드가 없습니다', '', 'warn'); return false; }
  if (P.hp >= 100) { say('다친 곳이 없다', 1800); return false; }
  inv.medkit--; P.hp = Math.min(100, P.hp + 50); setFace('relief', 3); sfx.paper(); toast('응급 밴드를 사용했습니다', '체력 +50', 'info'); talk('heal', 2400); refreshHud(); return true;
}
const WOOD_ROOMS = ['class', 'office', 'library', 'music', 'art', 'counsel', 'nurse', 'club', 'craft'];
function surfaceAt() {
  const f = P.floor;
  if (f === 0 && isOutdoors()) return (Math.abs(P.x) < 3.4 || (P.z > MAIN_ZS && P.z < 14 && Math.abs(P.x) < 46)) ? 'tile' : 'dirt';
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
  const gprox = ghost.active && ghost.floor === P.floor ? clamp(1 - Math.hypot(ghost.x - P.x, ghost.z - P.z) / 16, 0, 1) : 0;
  setMusic(state === 'menu' || state === 'intro' ? 'menu' : chase ? 'chase' : 'none', dt, SET.bgm && (state === 'playing' || state === 'ui' || state === 'trans') ? SET.bgmVol * (1 - gprox * .85) : state === 'dead' || state === 'won' ? .35 : 0);
  const lvl = P.hiding ? .8 : P.tired ? 1 : Math.max(P.fear > .45 ? P.fear * .8 : 0, P.stamina < 45 ? (45 - P.stamina) / 45 * .8 : 0);
  setBreath(state === 'playing' ? lvl : 0, P.tired || P.sprinting ? 1.1 : P.hiding ? .4 : .55, dt);
  if (ghost.active && ghost.floor === P.floor && state === 'playing') setGhostVoice({ x: ghost.x, y: floors[ghost.floor].y0 + 1.7, z: ghost.z }, 1, chase, dt);
  else setGhostVoice(null, 0, false, dt);
}
// 본관 안 또는 본관-별관 연결 통로(지붕 · 유리벽이 있는 실내 통로) 안
const inBldg = (x, z) => (z < MAIN_ZS - .3 && z > -9.9 && Math.abs(x) < 36.3) || (x > WALKWAY.x1 && x < WALKWAY.x2 && z > WALKWAY.z1 && z < WALKWAY.z2);
function isOutdoors() { return state === 'menu' || state === 'intro' || P.floor === 3 || (P.floor === 0 && !inBldg(P.x, P.z)); }
function hit() {
  if (TEST && TST.god) return;
  if (P.invuln > 0 || state !== 'playing') return;
  const G = ghost;
  if (inv.charm > 0) {   // 노란 부적이 대신 타오른다
    inv.charm--; P.invuln = 4; shake = .8; fx.glitch(.9); sfx.spark ? sfx.spark() : sfx.buzz(); sfx.ghostCrack && sfx.ghostCrack(); setFace('surprise', 2);
    toast('부적이 타올랐다', `그것이 비명을 지르며 물러났다 · 남은 부적 ${inv.charm}장`, 'opt'); caption('손끝의 부적이 한순간에 재가 되었다');
    if (!G.enraged) ghostLeave(); else { G.state = 'search'; G.hunt = null; G.spawnGrace = 3; G.target = { x: G.x, z: G.z }; G.path = []; G.slowT = 4; }
    refreshHud(); return;
  }
  P.hp -= DF().dmg; P.invuln = 5; shake = 1; hurtFx = 1; fx.glitch(.8); setFace('surprise', 2.6);
  sfx.screech();
  const h = $('hurt'); h.style.transition = 'none'; h.style.opacity = 1; requestAnimationFrame(() => { h.style.transition = 'opacity 1.4s'; h.style.opacity = 0; });
  if (P.hp <= 0) { P.hp = 0; die(); return; }
  if (P.hiding) leaveLocker(true);
  G.hunt = null; G.state = 'search'; G.spawnGrace = 3.5; G.path = []; G.replan = 0;
  const F = floors[G.floor]; let far = F.nodes[0];
  F.nodes.forEach(n => { if (Math.hypot(n.x - P.x, n.z - P.z) > Math.hypot(far.x - P.x, far.z - P.z)) far = n; });
  G.target = { x: far.x, z: far.z }; G.wait = 0; if (!G.enraged) { G.visitT = Math.max(G.visitT || 0, DF().visit - 6); G.calmT = Math.max(G.calmT || 0, 12); }
  toast('공격당했습니다', '체력이 낮습니다. 응급 밴드가 필요합니다.', 'warn'); talk('hit', 2600);
  refreshHud();
}
function showNote(it) {
  storyCalm(25);
  state = 'note';
  $('note').innerHTML = (it.img ? `<img class="photo" src="assets/img/${it.img}.webp" alt="">` : '') + `<b style="font-size:19px">${it.title}</b><br><br>${it.text}<small>${it.img ? '— 빛바랜 사진' : it.tape ? '— 녹음 내용' : '— 낡은 종이'}</small>`;
  $('noteBox').classList.add('show'); it.img ? sfx.photo() : sfx.paper();
  if (it.kind === 'note' && it.id && VS.readNotes) speak('note_' + it.id);
}
function closeNote() { $('noteBox').classList.remove('show'); if (state === 'note') { state = 'playing'; stopSpeak(); } }

/* ---------- 상호작용 ---------- */
let target = null;
const needText = p => p.kind === 'sq' ? sqNeedText(p) : p.kind === 'lock' && p.lockType === 'pick' && !inv.hairpin ? '  — 머리핀 필요' : p.kind === 'drain' && !FL.hook ? '  — 갈고리 필요' : p.kind === 'breaker' && !FL.fuse ? '  — 퓨즈 필요' : p.kind === 'console' && !power ? '  — 전원 없음' : p.kind === 'lock' && p.lockType === 'dial' && !docs.some(d => d.id === p.clue) ? '  — 번호 모름' : '';
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
    const s = f - d * .1; if (f > .35 && s > bs) { bs = s; best = { type: 'locker', l, label: l.label || '사물함에 숨기' }; }
  }
  for (const d of world.doorList) {
    if (d.floor !== P.floor) continue;
    const dzc = d.kind === 'slide' ? (d.z > 0 ? 1.55 : -1.55) : d.z;
    const dx = d.x - P.x, dz = dzc - P.z, dd = Math.hypot(dx, dz);
    if (dd > (d.kind === 'slide' ? 1.9 : 1.4)) continue;
    const f = (dx * fx + dz * fz) / Math.max(dd, .01), s = f - dd * .15 - .15;
    if (f > .2 && s > bs) { bs = s; best = { type: 'idoor', d, label: (d.target > .5 ? `${d.name} 닫기` : `${d.name} 열기`) }; }
  }
  for (const p of world.props) {
    if (p.floor !== P.floor || p.done) continue;
    let dx = p.x - P.x, dz = p.z - P.z, dd = Math.hypot(dx, dz);
    if (p.kind === 'switch') {   // 스위치: 벽 앞쪽(방 안)에서, 스위치를 바라볼 때만
      if ((P.x - p.px) * (p.x - p.px) + (P.z - p.pz) * (p.z - p.pz) <= 0) continue;
      dx = p.px - P.x; dz = p.pz - P.z; dd = Math.hypot(dx, dz); if (dd > 1.7) continue;
      const f2 = (dx * fx + dz * fz) / Math.max(dd, .01); if (f2 < .55) continue;
      const s2 = f2 - dd * .2 - .1; if (s2 > bs) { bs = s2; best = { type: 'prop', p, label: `${p.name ? p.name + ' ' : ''}형광등 ${p.on ? '끄기' : '켜기'}` }; } continue;
    }
    if (dd > 1.8) continue;
    const f = (dx * fx + dz * fz) / Math.max(dd, .01), s = f - dd * .1 + (p.kind === 'search' ? -.05 : .1);   // 수색은 숨기(사물함)보다 뒤로 — 쫓길 때 숨는 게 먼저
    if (f > (p.kind === 'search' ? .6 : .1) && s > bs) { bs = s; best = { type: 'prop', p, label: p.label + needText(p) }; }
  }
  if (!best) {
    const si = STAIRS[P.floor];
    const inStair = !si ? false : P.floor === 3 ? (Math.abs(P.x) < 4.5 && P.z < -5.2 && P.z > -9.5) : (() => { const z = floors[P.floor].stairZone || { x1: -1, x2: 4, z1: -9.3, z2: -2 }; return P.x > z.x1 && P.x < z.x2 && P.z > z.z1 && P.z < z.z2; })();
    const dr = world.doors.find(d => d.floor === P.floor && Math.hypot(d.x - P.x, d.z - P.z) < d.r);
    if (inStair && !(dr && Math.hypot(dr.x - P.x, dr.z - P.z) < 1.5)) {
      const up = si.up != null, down = si.down != null;
      const ul = si.up === 3 ? '옥상으로' : si.up === 0 ? '1층으로' : '위층', dl = si.down === 4 ? '지하층 (B1)' : '아래층';
      best = { type: 'stairs', label: [up ? `E 길게 · ${ul}` : '', down ? `Q 길게 · ${dl}` : ''].filter(Boolean).join('  /  '), raw: true };
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
      if (P.keys === TOTAL && !FL.keyhead) setTimeout(() => { toast('열쇠 조각을 모두 모았습니다', '…그런데 맞춰 보니 열쇠의 머리가 없다. 교장실을 찾아보자', 'opt'); talk('headMissing', 3400); }, 3200);
      refreshHud(); save(true);
    } else if (it.kind === 'camcorder') {
      FL.cam = true; newItems.add('camcorder'); sfx.pickup(); toast('아이템을 획득했습니다', '민아의 캠코더 — 녹화 파일이 남아 있다');
      addDoc({ id: 'cam1', kind: 'cam' }); addClue('cam'); refreshHud();
      setTimeout(playCam, 700); save(true);
    } else if (it.kind === 'nametag') {
      FL.tag = true; FL.opt = true; newItems.add('nametag'); sfx.key(); setFace('calm', 3);
      toast('특별 목표', '윤하늘의 명찰을 찾았다', 'opt'); talk('tagFound', 3600); addClue('tag'); refreshHud(); save(true);
    } else if (it.kind === 'hairpin' || it.kind === 'can') {
      inv[it.kind]++; newItems.add(it.kind); sfx.pickup(); toast('아이템을 획득했습니다', `${ITEMS[it.kind].name} (보유 ${inv[it.kind]})` + (it.kind === 'can' ? ' — G 키로 던지기' : ''));
      refreshHud();
    } else if (it.kind === 'fuse' || it.kind === 'mop' || it.kind === 'wire') {
      FL[it.kind] = true; newItems.add(it.kind); sfx.pickup(); toast('아이템을 획득했습니다', ITEMS[it.kind].name + (it.kind === 'fuse' ? ' — 지하 전기실 차단기' : ' — 소지품에서 조합'));
      if (it.kind === 'fuse') addClue('fuse');
      if ((it.kind === 'mop' && FL.wire) || (it.kind === 'wire' && FL.mop)) setTimeout(() => toast('조합 가능', '대걸레 자루 + 철사 → 갈고리 장대 (소지품 › 열쇠 아이템 › 조합)', 'info'), 1500);
      refreshHud(); save(true);
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
    if (d.needPower && !power) { sfx.click(); say('철제 덮개가 전자 잠금으로 묶여 있다 — B1 전기실에서 전력을 먼저 복구해야 한다', 3200); addClue('fuse'); return; }
    if (d.needPower && !FL.ev14) { FL.ev14 = true; sfx.alert(); fx.glitch(.4); blackout = .3; caption('삐— 붉은 경광등이 돌며 덮개 잠금이 풀렸다'); }
    if (d.need && !FL.gatekey) { sfx.click(); say(`굳게 잠겨 있다. 완성된 정문 열쇠가 있어야 열린다 (조각 ${P.keys}/${TOTAL})`, 2600); return; }
    teleport(d.to);
  }
  else if (target.type === 'gate') openGate();
  else if (target.type === 'idoor') toggleDoor(target.d);
  else if (target.type === 'prop') useProp(target.p);
}
function toggleDoor(d, silent) {
  if (d.locked && d.target < .5) { at(d.x, floors[d.floor].y0 + 1.1, d.z).knock(); say('안에서 잠겨 있다… 문 아래로 실내화 두 짝이 보인다', 2400); setFace('fear', 2); return; }   // 여자화장실 3번 칸
  if (d.target > .5) {
    const r = d.rect, m = .33;
    if (P.floor === d.floor && P.x > r.x1 - m && P.x < r.x2 + m && P.z > r.z1 - m && P.z < r.z2 + m) { say('문틀에서 비켜야 닫을 수 있다', 1600); return; }
    d.target = 0;
  } else d.target = 1;
  if (!silent) { d.kind === 'slide' ? sfx.doorSlide() : sfx.doorHinge(); P.noiseT = .6; }
}

function readNote(it) {
  if (it.id === 'nC') { it.title = CHAR_NOTE[CK()].title; it.text = CHAR_NOTE[CK()].text; }
  if (!it.taken) {
    it.taken = true; it.mesh.visible = false; addDoc({ id: it.id, kind: 'note' }); toast('새로운 문서를 획득했습니다', it.title, 'info');
    if (CLUES[it.id]) addClue(it.id);
    if (['n7', 'n8', 'n12', 'n14', 'n22', 'n23', 'n24', 'nC'].includes(it.id)) unlockOptional();
    if (it.id === 'n27' && !VS.readNotes) setTimeout(() => line('teacher2'), 1800);
    if (it.id === 'n24' && docs.some(d => d.id === 'n23') || it.id === 'n23' && docs.some(d => d.id === 'n24')) setTimeout(() => toast('⚠ 증언 불일치', '방송부원과 경비의 말이 다르다 — 휴대폰 › 사건 연표', 'opt'), 1600);
    refreshHud();
  }
  showNote(it);
}
function activateGhost() {
  if (ghost.active || (TEST && TST.noGhost)) return;
  // 처음 깨어난 뒤에도 바로 오지 않는다: 난이도별 유예(보통 2분) 동안 먼 층에서 소리로만 존재를 알린다
  ghost.active = true; ghost.floor = P.floor === 2 ? 1 : 2; ghost.x = 20; ghost.z = 0; ghost.state = 'patrol'; ghost.path = []; ghost.wait = 2; ghost.away = -DF().first; ghost.visitT = 0;
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
    P.floor = to.floor; P.x = to.x; P.z = to.z; P.yaw = to.yaw; P.pitch = 0; P.sh = null; P.shV = 0; toastFloor(to.floor);
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
// 가구 높이: 발이 윗면보다 높으면 그 가구는 막지 않는다 · 발 아래 윗면이 지지면
// 낮은 단(계단 한 단 높이 STEP_UP 이하: 현관 계단 · 단상 등)은 그냥 걸어 올라가고, 그보다 높은 가구는 점프로 오른다
const STEP_UP = .225;
const colsAt = F => { if (F._lowCol == null) F._lowCol = F.col.some(r => r.h != null); if (!F._lowCol) return F.col; const foot = P.jy || 0; return F.col.filter(r => !(r.h != null && r.h <= foot + STEP_UP)); };
function supportAt(F, x, z, foot) {
  let s = 0; for (const r of F.col) if (r.h != null && r.h <= foot + STEP_UP && r.h > s && x > r.x1 - .1 && x < r.x2 + .1 && z > r.z1 - .1 && z < r.z2 + .1) s = r.h;
  return s;
}
// 걸어서 오르내리는 계단 (world.js stairRoom): 1번 계단(서쪽, 북쪽으로 오름 0→2.0m) → 층참 → 2번 계단(동쪽, 남쪽으로 오름 2.0→4.0m = 위층 바닥)
// 2번 계단 꼭대기를 지나면 위층, 위층에서 2번 계단 칸으로 들어서면 아래층 계단 꼭대기로 이어진다
const STK = .2 / .48, SZB = -2.9, SZL = -7.7, SLND = FH / 2;   // 한 단 0.2m · 너비 0.48m, 층참 2.0m — 2번 계단 꼭대기 = 위층 바닥 (world.js stairRoom 과 같은 치수)
function stairH(F, x, z) {
  const c = F.stairCx; if (c == null || x < c - 3.85 || x > c - 1.2 || z > SZB || z < -9.6) return null;
  if (z <= SZL) return SLND;
  return x < c - 2.5 ? Math.min(SLND, (SZB - z) * STK) : Math.min(FH, SLND + (z - SZL) * STK);
}
function stairStep(px, pz) {
  const F = floors[P.floor], h = stairH(F, P.x, P.z), lane2 = F.stairCx != null && P.x > F.stairCx - 2.5;
  const hp = stairH(F, px, pz);
  if (P.sh == null || (hp == null ? P.sh > .3 && h == null : Math.abs(hp - P.sh) > .45)) P.sh = hp ?? h ?? 0;   // 불러오기 · 순간이동 뒤 높이 다시 맞춤
  if (h == null) { if (P.sh > .3) { P.x = px; P.z = pz; return true; } P.sh = 0; return false; }
  const info = STAIRS[P.floor] || {};
  if (Math.abs(h - P.sh) > .45) {
    // 바닥에서 2번 계단 칸으로 들어섬 → 아래층 계단 꼭대기
    const nf = info.down, NF = nf != null && floors[nf];
    if (P.sh < .3 && lane2 && pz > SZB && NF && NF.stairCx != null) { P.floor = nf; P.x += NF.stairCx - F.stairCx; P.sh = stairH(NF, P.x, P.z) ?? FH; P.shV = (P.shV || 0) + FH; stairArrive(nf); return true; }
    P.x = px; P.z = pz; return true;
  }
  P.sh = h;
  // 2번 계단 꼭대기 → 위층 (옥상은 계단탑 문 앞으로)
  if (lane2 && P.z > pz && P.z > SZB - .15 && h > FH - .3) {
    const nf = info.up; if (nf == null) { P.x = px; P.z = pz; return true; }
    if (nf === 3) { P.sh = 0; P.shV = 0; teleport({ floor: 3, x: 0, z: -7.5, yaw: 0 }); return true; }
    const NF = floors[nf]; if (NF.stairCx == null) { P.x = px; P.z = pz; return true; }
    P.floor = nf; P.x += NF.stairCx - F.stairCx; P.z = SZB + .05; P.sh = 0; P.shV = (P.shV || 0) - FH; stairArrive(nf); return true;
  }
  return false;
}
function stairArrive(f) {
  sfx.step(false, .8, 'tile');
  if (f === 4 && !P.b1Seen) { P.b1Seen = true; setTimeout(() => talk('b1', 3000), 400); }
  toastFloor(f);
}
const FLOOR_LABEL = { 0: '본관 1층', 1: '본관 2층', 2: '본관 3층', 3: '옥상', 4: '지하 1층 (B1)', 5: '체육관', 6: '수영장', 7: '급식실', 8: '별관 1층', 9: '별관 2층', 10: '별관 3층' };
function toastFloor(f) { const t = $('floorTag'); if (!t) return; t.textContent = FLOOR_LABEL[f] || ''; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 1800); }
// 엘리베이터: 층 선택 화면 → 문 닫힘 · 운행음 · 도착 '띵'
const EL_SET = { main: [4, 0, 1, 2], annex: [8, 9, 10] };
async function rideElevator(p) {
  const set = p.floor >= 8 ? EL_SET.annex : EL_SET.main, dests = set.filter(f => f !== p.floor);
  sfx.ding();
  const opts = dests.map(f => ({ label: FLOOR_LABEL[f], sub: f === 4 ? '설비 · 창고 · 기록' : '' })).concat([{ label: '타지 않는다' }]);
  const i = await choose('엘리베이터', `현재 층 <b>${FLOOR_LABEL[p.floor]}</b> · 갈 층을 고르세요${power ? '' : '<br><small>전력이 끊겨 비상 전원으로 느리게 움직인다</small>'}`, opts);
  if (i >= dests.length || state !== 'playing') return;
  const nf = dests[i], tp = world.props.find(q => q.kind === 'elevator' && q.floor === nf); if (!tp) return;
  state = 'trans'; $('fade').style.opacity = 1; sfx.doorSlide(.8); const ride = (power ? 1.6 : 3.0) + Math.abs(set.indexOf(nf) - set.indexOf(p.floor)) * .5;
  setTimeout(() => sfx.elevator(ride), 500);
  if (!power && Math.random() < .5) setTimeout(() => { sfx.ghostBreath(); caption('(엘리베이터 안, 바로 뒤에서 숨소리)'); }, 900 + ride * 400);
  setTimeout(() => {
    P.floor = nf; P.x = tp.px - .9; P.z = tp.pz; P.yaw = Math.PI / 2; P.pitch = 0; P.sh = 0; P.shV = 0;
    sfx.ding(); sfx.doorSlide(.8); $('fade').style.opacity = 0; state = 'playing'; toastFloor(nf);
    if (nf === 4 && !P.b1Seen) { P.b1Seen = true; setTimeout(() => talk('b1', 3000), 600); }
  }, 600 + ride * 1000);
}
// 방마다 고유 오브젝트 — 선택 화면(1·2·3 키)으로 조작하고, 보급 · 안정 · 기록 · 공포 효과가 있다
const calmDown = (sec, msg) => { storyCalm(sec); P.fear = Math.max(0, P.fear - .4); setFace('relief', 3); if (msg) caption(msg); };
async function useRoomObj(p) {
  const k = p.k, room = roomAt(p.floor, p.x, p.z - .6) || roomAt(p.floor, p.x, p.z + .6), rn = room ? room.name : '';
  if (k === 'med') {
    const i = await choose('약품함', `${rn} 벽에 걸린 약품함. 유통기한이 지난 약이 대부분이지만 쓸 만한 것이 몇 개 남아 있다.`, [{ label: '진통제 먹기', sub: '체력 +30' }, { label: '안정제 먹기', sub: '40초 동안 마음이 가라앉는다 (그것이 덜 다가온다)' }, { label: '응급 밴드 챙기기', sub: '소지품 +1' }, { label: '닫는다' }]);
    if (i === 3) return;
    if (i === 0) { P.hp = Math.min(100, P.hp + 30); toast('진통제', '체력 +30', 'info'); }
    else if (i === 1) calmDown(40, '숨이 조금 고르게 돌아온다');
    else { inv.medkit++; toast('응급 밴드를 챙겼습니다', '소지품 +1', 'info'); }
    sfx.pickup(); p.done = true; refreshHud(); return;
  }
  if (k === 'phone') {
    sfx.click(); const i = await choose('내선 전화', '수화기에서 낮은 신호음이 들린다. 벽에 붙은 내선 번호표가 반쯤 찢어져 있다.', [{ label: '201 — 방송실' }, { label: '100 — 경비실' }, { label: '302 — 3학년 2반' }, { label: '내려놓는다' }]);
    if (i === 3) { sfx.click(); return; }
    sfx.staticNoise(1.2);
    if (i === 0) setTimeout(() => { caption('(지직거림 사이로) …오늘 수업은 끝났어…'); fx.glitch(.3); setFace('fear', 2); }, 900);
    else if (i === 1) setTimeout(() => { caption('(신호만 계속 간다 — 아무도 받지 않는다)'); }, 900);
    else setTimeout(() => { at(P.x, floors[P.floor].y0 + 1.6, P.z).whisper(); sfx.ghostGiggle(); caption('(수화기 너머에서, 아이가 웃는다)'); fx.glitch(.5); shake = .3; setFace('fear', 3); }, 1100);
    return;
  }
  if (k === 'mirror') {
    const i = await choose('거울', '금이 간 거울에 지친 얼굴이 비친다.', [{ label: '세수한다', sub: '마음을 가라앉힌다' }, { label: '거울을 오래 들여다본다' }, { label: '돌아선다' }]);
    if (i === 0) { sfx.drip(); calmDown(25, '차가운 물에 정신이 든다'); }
    else if (i === 1) { if (Math.random() < .45 || !p.tried) { p.tried = true; const bx = P.x + Math.sin(P.yaw) * 1.2, bz = P.z + Math.cos(P.yaw) * 1.2; showApparition(P.floor, bx, bz, P.yaw, .5, null); sfx.ghostBreath(); fx.glitch(.6); shake = .35; caption('거울 속, 내 어깨 너머로 누군가 서 있었다'); setFace('surprise', 2); } else caption('…내 얼굴뿐이다'); }
    return;
  }
  if (k === 'cards') {
    const i = await choose('대출 카드함', '서랍마다 손때 묻은 카드가 빼곡하다.', [{ label: 'ㄱ ~ ㅅ 서랍' }, { label: 'ㅇ 서랍' }, { label: 'ㅈ ~ ㅎ 서랍' }]);
    sfx.paper();
    if (i === 1) showNote({ title: '대출 카드 — 윤하늘 (3-2)', text: '『어린 왕자』 2006.09.14 대출 · <b>반납 안 됨</b><br>『방송 대본 쓰는 법』 2006.10.02 대출 · <b>반납 안 됨</b><br>『안녕, 내일』 2006.10.12 대출 · <b>반납 안 됨</b><br><br>마지막 카드 뒷면에 연필로: <i>“내일 돌려줄게요.”</i>' });
    else caption(i === 0 ? '이름들 사이에 같은 필체가 반복된다 — 모두 반납되지 않았다' : '카드 몇 장이 젖어 붙어 있다');
    return;
  }
  if (k === 'term') {
    sfx.beep(); const o = objective();
    $('note').innerHTML = `<pre style="font:13px/1.55 monospace;color:#7fe0a0;background:#061008;padding:14px;border:1px solid #1d4a2a;white-space:pre-wrap;text-align:left">SEOMUN-NET v2.3  (c)2004\n&gt; login: guest\n&gt; 마지막 접속: 2006-10-12 23:31 (방송실)\n&gt; 남은 작업 1건:\n    ${o.main}${o.loc ? '\n    위치: ' + o.loc.where : ''}\n&gt; 시스템 메시지: <span style="color:#e06060">하교 방송이 아직 끝나지 않았습니다</span>\n&gt; _</pre><small>— 단말기 화면</small>`;
    state = 'note'; $('noteBox').classList.add('show'); storyCalm(10); return;
  }
  if (k === 'chem') {
    const i = await choose('약품 선반', '색이 다른 시약병 세 개. 라벨은 번져서 읽을 수 없다.', [{ label: '파란 용액에 노란 용액을 섞는다' }, { label: '붉은 용액의 냄새를 맡는다' }, { label: '건드리지 않는다' }]);
    if (i === 0) { sfx.splash(); P.battery = Math.min(100, P.battery + 35); toast('형광 용액', '병이 초록빛으로 빛난다 — 손전등 배터리 +35%', 'info'); p.done = true; refreshHud(); }
    else if (i === 1) { sfx.gasp(); shake = .3; fx.glitch(.4); caption('머리가 핑 돈다 — 눈앞이 잠깐 흐려졌다'); P.stamina = Math.max(0, P.stamina - 40); }
    return;
  }
  if (k === 'snack') { sfx.paper(); P.stamina = 100; P.tired = false; P.snackT = 60; toast('간식 바구니', '오래된 사탕과 초코바 — 1분 동안 덜 지친다', 'info'); p.done = true; return; }
  if (k === 'emo') {
    const i = await choose('감정 카드', '상담 선생님이 쓰던 카드. "오늘의 마음을 골라 보세요."', [{ label: '무서워요' }, { label: '괜찮아요' }, { label: '보고 싶어요' }]);
    sfx.paper();
    if (i === 2) { calmDown(45); setTimeout(() => caption('(카드 뒷면) 하늘: 엄마, 방송 꼭 들어 줘.'), 600); }
    else calmDown(i === 0 ? 35 : 25, i === 0 ? '무섭다고 인정하니 조금 나아졌다' : '…괜찮아. 괜찮아.');
    return;
  }
  if (k === 'copier') {
    sfx.beep(); setTimeout(() => { sfx.slide(); fx.glitch(.2); }, 400);
    setTimeout(() => showNote({ img: 'old_class', title: '복사된 종이', text: '전원이 없는데 복사기가 한 장을 뱉어냈다.<br>교실 사진 — 맨 뒷자리만 <b>까맣게</b> 칠해져 있다.' }), 1300);
    p.done = true; return;
  }
  if (k === 'water') { sfx.drip(); setTimeout(() => { caption('녹물… 아니, 붉은 물이 한참 흐르다 맑아진다'); fx.glitch(.3); setFace('fear', 2); }, 500); return; }
  if (k === 'ballot') { sfx.paper(); showNote({ title: '학생회 투표함', text: '2006년 2학기 방송부장 선거.<br>개표되지 않은 용지 41장 — 전부 같은 이름이다.<br><br><b>윤하늘 ○</b>' }); p.done = true; return; }
  if (k === 'guardlog') {
    sfx.paper(); showNote({ title: '경비 일지 — 10월 12일', text: '17:30 정문 순찰. 이상 없음.<br>17:42 서현고 교복 학생 1명, 정문으로 들어감. <b>방송부 조끼.</b> 불렀으나 대답 없음.<br>17:50 또 한 명. 친구를 찾는다고 했다.<br><br>…매년 이 날이면 꼭 누가 들어간다. 나는 들어가지 않는다.<br><i>11시 40분이 되기 전에 나와야 한다.</i>' });
    return;
  }
  if (k === 'guardcctv') {
    sfx.staticNoise(1.4); fx.glitch(.35);
    setTimeout(() => showNote({ img: 'v_corridor', title: 'CCTV — 본관 1층 복도', text: '지직거리는 화면. 복도 끝에서 교복 차림의 누군가가 <b>카메라를 올려다보고 있다.</b><br>다음 순간 화면이 꺼졌다.' }), 900);
    return;
  }
  if (k === 'radio') {
    sfx.staticNoise(1.6); const ga = ghost.active && ghost.floor === P.floor, d = ga ? Math.hypot(ghost.x - P.x, ghost.z - P.z) : 99;
    setTimeout(() => caption(ga ? (d < 12 ? '(지지직!) 잡음이 거세다 — 가까이 있다' : '(지직…) 잡음이 일정하다 — 같은 층 어딘가에 있다') : '(조용한 잡음) — 이 층에는 아무것도 없는 것 같다'), 700);
    return;
  }
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
const wait = ms => new Promise(r => setTimeout(r, ms));
// 선택지 UI (기획서: 컷신 · 대화 선택지 전면 표시). 1 · 2 · 3 키 또는 클릭
function choose(title, text, opts) {
  return new Promise(res => {
    const prev = state; state = 'ui'; for (const k in keys) keys[k] = false; document.exitPointerLock?.(); $('prompt').style.display = 'none';
    const hudOn = $('hud').classList.contains('show'); $('hud').classList.remove('show');
    $('choiceTitle').textContent = title; $('choiceText').innerHTML = text || '';
    const box = $('choiceBtns'); box.innerHTML = '';
    const done = i => { removeEventListener('keydown', kd, true); $('choice').classList.remove('show'); if (hudOn) $('hud').classList.add('show'); sfx.ui(); if (state === 'ui') { state = prev === 'ui' ? 'playing' : prev; if (state === 'playing') lock(); } res(i); };
    const kd = e => { const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code); if (i >= 0 && i < opts.length) { e.preventDefault(); e.stopPropagation(); done(i); } };
    opts.forEach((o, i) => { const b = document.createElement('button'); b.innerHTML = `${i + 1}. ${o.label}${o.sub ? `<small>${o.sub}</small>` : ''}`; b.onclick = () => done(i); box.appendChild(b); });
    addEventListener('keydown', kd, true);
    $('choice').classList.add('show'); sfx.beep();
  });
}
async function winGame() {
  const end = FL.mina ? 'true' : 'normal';
  P.invuln = 999; ghost.active = false;
  if (FL.mina) setTimeout(() => talk('withMina', 2800), 400);
  await wait(2400);
  // 마지막 선택 (EV-23): 기록 수 · 민아 구출 여부에 따라 후일담이 달라진다
  const nd = docs.length, ci = await choose('마지막 선택', `정문이 열렸다. 손에는 오늘 밤 모은 기록 ${nd}개가 있다.${FL.mina ? ' 민아가 곁에 서 있다.' : ''}`, FINAL_CHOICE);
  const pk = FINAL_CHOICE[ci].id, fin = pk === 'A' ? (nd >= 14 ? (sqDoneCount() === SIDEQUESTS.length ? 'Aplus' : 'A') : 'A0') : pk === 'B' ? (FL.mina ? 'B' : 'B0') : 'C';
  FL.final = fin;
  setTimeout(() => {
    state = 'won'; sfx.win(); stopSpeak(); $('hud').classList.remove('show');
    try { const e = new Set(JSON.parse(localStorage.getItem('haegyo_endings') || '[]')); e.add(end); e.add('final' + fin[0]); localStorage.setItem('haegyo_endings', JSON.stringify([...e])); clearSlot(localStorage, SKEYS); } catch (err) { /* ignore */ }
    const vo = end === 'true' ? 'endTrue' : 'endNormal';
    $('endTag').textContent = end === 'true' ? 'TRUE END' : 'NORMAL END'; $('endTag').className = end;
    $('endTitle').textContent = end === 'true' ? '마지막 하교 방송' : '다시 닫힌 문';
    $('winText').innerHTML = VO[vo].text + `<br><br><span class="epi">${EPILOGUE[end]}</span><br><br><span class="epi">${FINAL_EPI[fin]}</span>` + (end === 'true' ? '' : '<br><br><small style="color:#8a8678">…민아는 아직 방송실에 있다. 하늘의 이야기를 끝내면 다른 결말을 볼 수 있다.</small>');
    if (end === 'normal') setTimeout(() => line('pa1', 'pa'), 9000);
    const nd = docs.length, tot = DOC_TOTAL(), rec = statClear(end, fin);
    $('endStats').innerHTML = `<span>주인공</span><b>${CH().name}</b><span>플레이 시간</span><b>${fmtPT(playTime, true, true)}${rec.isBest ? ' <em style="color:#e8c870;font-style:normal">· 최단 기록!</em>' : rec.best ? ` <small style="color:#8a8678">(최단 ${fmtPT(rec.best, true, true)})</small>` : ''}</b><span>찾은 기록</span><b>${nd} / ${tot}</b><span>교실의 기억</span><b>${memCount()} / ${MEM_TOTAL()}</b><span>마지막 선택</span><b>END ${fin}</b><span>난이도</span><b>${DF().label}</b><span>쓰러진 횟수</span><b>${deaths}</b>`;
    setTimeout(() => line(vo), 1200);
    $('win').classList.add('show'); document.exitPointerLock?.();
  }, 1200);
}
const gate = world.gate;

function enterLocker(l) {
  const G = ghost;
  P.hiding = l; sfx.locker(); P.hideCount = (P.hideCount || 0) + 1; if (l.stallDoor) { l.stallDoor.target = 0; sfx.doorHinge(.6); }   // 칸막이: 들어가서 문을 닫는다
  const dr = l.dir || { x: 0, z: 1 }; l.yaw = Math.atan2(-dr.x, -dr.z);
  P.x = l.x + dr.x * .12; P.z = l.z + dr.z * .12; P.yaw = l.yaw; P.pitch = 0;
  $('hide').classList.add('show');
  if (G.active && G.floor === P.floor && (G.state === 'chase') && Math.hypot(G.x - P.x, G.z - P.z) < 9 && los(floors[P.floor].walls, G.x, G.z, P.x, P.z)) G.hunt = { x: l.x + dr.x * .6, z: l.z + dr.z * .6 };
  say('숨을 죽여라…  (E 나가기)', 2500);
}
function leaveLocker(silent) {
  const l = P.hiding; if (!l) return;
  const dr = l.dir || { x: 0, z: 1 }; P.hiding = null; $('hide').classList.remove('show'); P.x = l.x + dr.x * .85; P.z = l.z + dr.z * .85; P.yaw = l.yaw; P.pitch = 0;
  if (l.stallDoor && !l.stallDoor.locked) l.stallDoor.target = 1;
  ghost.hunt = null; ghost.findT = 0; ghost.fake = null; ghost.lockSearch = null; $('peekEye').classList.remove('on'); if (!silent) sfx.locker();
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
  $('deadText').innerHTML = `칠판에 한 줄이 더 늘었다.<br>“다시, 여기서.”<br><br><span class="epi">${DEATH_LOG[Math.min(DEATH_LOG.length, deaths) - 1]}</span>`;
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
  if (MG.active) return;
  if (e.repeat) return;
  keys[e.code] = true;
  if (state === 'note' && (e.code === K().interact || e.code === 'KeyE' || e.code === 'Escape' || e.code === 'Space')) { closeNote(); return; }
  if (state === 'ui' && $('keypad').classList.contains('show')) { keypadKey(e); return; }
  if (state === 'ui') {
    if ($('inv').classList.contains('show') && e.code !== 'Tab' && e.code !== 'KeyI' && invKey(e)) return;
    if ($('phone').classList.contains('show') && (e.code === 'KeyQ' || e.code === 'KeyE')) { phoneTab = PTABS[(PTABS.indexOf(phoneTab) + (e.code === 'KeyE' ? 1 : PTABS.length - 1)) % PTABS.length]; renderPhone(); return; }
    if ($('mapOv').classList.contains('show') && (e.code === 'KeyZ' || e.code === 'KeyX')) { mapZoom = clamp(mapZoom * (e.code === 'KeyZ' ? 1.25 : .8), .5, 4); renderMap(); return; }
    if (['Tab', 'Escape', 'KeyI', 'KeyT', K().inv, K().map, K().phone].includes(e.code)) closeUI();
    return;
  }
  if (state !== 'playing') return;
  if (e.code === K().inv || e.code === 'KeyI') { openInv(); return; }
  if (e.code === K().map) { openMap(); return; }
  if (e.code === 'F5') { e.preventDefault(); phoneTool('save'); return; }
  if (e.code === K().scan) { scanAround(); return; }
  if (e.code === K().phone) { openPhone(msgs.some(m => !m.read) ? 'msg' : phoneTab); return; }
  if (TEST && e.code === 'KeyT') { openTest(); return; }
  if (e.code === 'Digit1' || e.code === K().flash) { P.light = !P.light; sfx.click(); if (P.light && P.battery <= 0) toast('배터리가 없습니다', inv.battery > 0 ? '2번 키로 건전지를 교체하세요 — 지금은 휴대폰 불빛' : '휴대폰 불빛으로 비춥니다 — 건전지를 찾으세요', 'warn'); }
  if (e.code === 'Digit2') useBattery();
  if (e.code === 'Digit3') useMedkit();
  if (SET.runToggle && (e.code === K().run || e.code === 'ShiftRight')) P.runOn = !P.runOn;
  if (e.code === K().view) toggleView();
  if (e.code === K().camera) camMode(!CAM.on);
  if (e.code === 'KeyR' && CAM.on) camShoot();
  if (e.code === K().crouch || e.code === 'ControlLeft') { P.crouch = !P.crouch; if (P.crouch) P.runOn = false; }
  if (e.code === K().jump && !e.repeat) tryJump();
  if (e.code === K().throwCan) { if (inv.shock > 0) throwShock(); else throwCan(); }   // 쇼트 폭탄이 있으면 캔 대신
  if (target && target.type === 'stairs' && !P.hiding && (e.code === K().interact || e.code === K().down)) { if (!e.repeat) STH = { code: e.code, dir: e.code === K().down ? -1 : 1, t: 0 }; return; }   // 계단: 길게 눌러야 층 이동 (파밍 중 실수 방지)
  if (e.code === K().interact) { if (P.hiding) leaveLocker(); else interact(); }
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
  const o = objective(); $('pauseInfo').textContent = `${CHAPTERS[o.ch - 1].title}  ·  ${CH().name}  ·  ⏱ ${fmtPT(playTime, true, true)}`;
  $('loadBtn2').disabled = !hasSave(); $('bakBtn').disabled = !hasSave();
  $('saveInfo').textContent = lastSave ? `마지막 저장: ${fmtAgo(lastSave.savedAt)} · ${lastSave.where || ''}` : '아직 저장하지 않았습니다';
  $('pause').classList.add('show');
}
function lock() {
  try { const r = canvas.requestPointerLock({ unadjustedMovement: true }); if (r && r.catch) r.catch(() => { try { const r2 = canvas.requestPointerLock(); if (r2 && r2.catch) r2.catch(() => {}); } catch (e) { /* ignore */ } }); }
  catch (e) { try { canvas.requestPointerLock(); } catch (e2) { /* ignore */ } }
}

/* ---------- 저장 / 불러오기 ---------- */
// 저장 · 불러오기는 saveSystem.js (스키마 버전 · 고유 ID · 백업 슬롯 · 구버전 변환)
let deaths = 0; try { deaths = +localStorage.getItem('haegyo_deaths') || 0; } catch (e) { /* ignore */ }
let SKEYS = storageKeys(TEST), SCTX = { itemUids: [], propUids: [] };   // 월드 생성 뒤 initSaveIds() 에서 채운다
const hasSave = () => { try { return hasSlot(localStorage, SKEYS); } catch (e) { return false; } };
function initSaveIds() {
  assignUids(world.items, itemUid); assignUids(world.props, propUid); assignUids(world.doorList, doorUid);
  SCTX = { itemUids: world.items.map(i => i.uid), propUids: world.props.map(p => p.uid) };
}
function whereText() { if (P.floor === 0 && isOutdoors()) return '학교 밖'; const r = roomAt(P.floor, P.x, P.z); return AREA_NAMES[P.floor] + (r ? ' · ' + r.name : ''); }
let lastSave = null;
function save(silent) {
  if (state === 'dead' || state === 'won' || state === 'menu' || state === 'intro') return;
  const d = {
    schemaVersion: SCHEMA, build: BUILD,
    meta: { char: CHAR, ch: objective().ch, time: playTime, savedAt: Date.now(), where: whereText() },
    player: { x: P.x, z: P.z, floor: P.floor, yaw: P.yaw, hp: P.hp, battery: P.battery, stamina: P.stamina, keys: P.keys, light: P.light, pbat: Math.round(P.pbat ?? 100), roofSeen: !!P.roofSeen, b1Seen: !!P.b1Seen, gymSeen: !!P.gymSeen, cafeSeen: !!P.cafeSeen, poolSeen: !!P.poolSeen, bcast: !!P.bcast },
    progress: { got: [...got], FL: { ...FL }, power, gateClosed, introDone, playTime },
    inv: { ...inv }, docs: docs.map(x => ({ id: x.id, kind: x.kind })), msgs: msgs.map(m => ({ ...m })), clues: [...clues],
    events: [...EV.done], tips: [...tipsDone], cards: [...seenCards], b33: EV.b33,
    world: {
      items: Object.fromEntries(world.items.filter(i => i.taken).map(i => [i.uid, 1])),
      props: Object.fromEntries(world.props.filter(p => p.done || p.on || p.fused || p.tried || p.fails).map(p => [p.uid, { done: !!p.done, on: !!p.on, fused: !!p.fused, tried: !!p.tried, fails: p.fails || 0 }])),
      doors: Object.fromEntries(world.doorList.map(dd => [dd.uid, dd.target > .5 ? 1 : 0])),
    },
    ghost: { active: ghost.active, enraged: ghost.enraged, floor: ghost.floor, x: ghost.x, z: ghost.z },
  };
  try { writeSlot(localStorage, SKEYS, d); lastSave = d.meta; toast('저장되었습니다', `${silent ? '자동 저장 · ' : ''}${d.meta.where} · ⏱ ${fmtPT(playTime)}`, 'info'); statFlush(); }
  catch (e) { toast('저장 실패', '브라우저 저장 공간을 확인하세요', 'warn'); }
}
function readSave(preferBackup) { try { return readSlot(localStorage, SKEYS, SCTX, preferBackup).data; } catch (e) { return null; } }
// 장치 상태 복원 (시각 연출까지 맞춘다)
function restoreProp(p, s) {
  p.tried = !!s.tried; p.fails = s.fails || 0;
  if (p.kind === 'breaker') { p.fused = !!s.fused; if (s.on) { p.on = true; p.done = true; } return; }
  if (p.kind === 'switch') { flipSwitch(p, !!s.on); return; }
  if (p.kind === 'clue' && s.done) { p.done = true; p.mesh.visible = false; return; }
  if (!s.done) return;
  p.done = true;
  if (p.kind === 'safe') { p.open = 1; p.opening = true; p.key.locked = false; p.key.mesh.visible = !p.key.taken; }
  else if (p.kind === 'lock') openLockVisual(p);
  else if (p.kind === 'mina') { mina.visible = false; minaProps.visible = false; }
}
function load(preferBackup) {
  const r = (() => { try { return readSlot(localStorage, SKEYS, SCTX, preferBackup); } catch (e) { return { data: null }; } })();
  const d = r.data;
  if (!d) { toast('세이브를 불러올 수 없습니다', '저장 데이터가 없거나 손상되었습니다', 'warn'); return false; }
  const fixes = repairProgress(d, TOTAL);
  // 1) 주인공 — 세이브의 캐릭터로 맞춘다 (외형 · 능력 · 대사)
  if (CHARACTERS[d.meta.char]) { CHAR = d.meta.char; try { localStorage.setItem('haegyo_char', CHAR); } catch (e) { /* ignore */ } }
  applyChar();
  // 2) 플레이어 · 진행
  Object.assign(P, d.player); P.hiding = null;
  got.splice(0, TOTAL, ...d.progress.got.slice(0, TOTAL).map(Boolean));
  Object.assign(inv, d.inv); Object.assign(FL, d.progress.FL || {}); power = !!d.progress.power;
  msgs.length = 0; msgs.push(...(d.msgs || [])); clues.length = 0; clues.push(...(d.clues || []));
  docs.length = 0; (d.docs || []).forEach(x => addDoc(x));
  EV.done.clear(); (d.events || []).forEach(e => EV.done.add(e)); EV.b33 = d.b33 || 0;
  tipsDone.clear(); (d.tips || []).forEach(t => tipsDone.add(t)); seenCards.clear(); (d.cards || []).forEach(c => seenCards.add(c));
  introDone = !!d.progress.introDone; playTime = d.progress.playTime || 0;
  if (!FL.night && playTime > 200) FL.night = true;   // 이전 버전 세이브: 이미 밤
  DAY.done = false; DAY.start = -1; DAY.k = FL.night ? 0 : .92;
  // 3) 월드: 아이템 → 장치 → 문 (장치 복원이 아이템 상태를 참고하므로 순서 중요)
  world.items.forEach(it => { if (d.world.items[it.uid]) { it.taken = true; it.mesh.visible = false; } });
  world.props.forEach(p => { const s = d.world.props[p.uid]; if (s) restoreProp(p, s); });
  world.doorList.forEach(dd => { const v = d.world.doors && d.world.doors[dd.uid]; if (v != null) { dd.target = v; dd.open = v; } });
  // 4) 필수 아이템 영구 소실 방지: 열쇠 조각 상태를 진행 기록과 맞춘다
  world.items.filter(i => i.kind === 'key').forEach(it => {
    if (got[it.idx] && !it.taken) { it.taken = true; it.mesh.visible = false; }
    if (!got[it.idx] && it.taken) { it.taken = false; it.mesh.visible = !it.locked; fixes.push(`열쇠 조각 ${it.idx + 1} 복구`); }
  });
  if (d.progress.gateClosed) { gateClosed = true; gateState = 'closed'; gateAnim = 1; gate.setOpen(0); }
  if (d.ghost && d.ghost.active && !FL.calm) Object.assign(ghost, { active: true, enraged: !!d.ghost.enraged, floor: d.ghost.floor, x: d.ghost.x, z: d.ghost.z, state: 'patrol', path: [], wait: 2, spawnGrace: 4 });
  lastSave = d.meta;
  sqSync(true); chapterShown = objective().ch; refreshHud();
  toast(r.source === 'backup' ? '백업 세이브에서 불러왔습니다' : r.source === 'legacy' ? '이전 버전 세이브를 변환했습니다' : '불러오기 완료', `${CHAPTERS[chapterShown - 1].title} · ${d.meta.where || ''}`, r.source === 'main' ? 'info' : 'warn');
  if (fixes.length) console.info('[save] 진행 상태 보정:', fixes);
  return true;
}

function start(skipIntro = false) {
  initAudio(); closeMenus(); applyChar();
  if (!readingSave) { DAY.k = .92; DAY.start = -1; DAY.done = false; delete FL.night; }
  refreshHud(); chapterShown = objective().ch;
  if (skipIntro || TEST) { finishIntro(); return; }
  state = 'intro'; introT = 0; introText = true; introCue = 0; $('intro').classList.add('show'); $('cine').classList.add('on');
  // 순서: 날짜 → 실종 소식 → (진동) 민아의 메시지 → 십 년 전 이야기
  const ids = ['intro1', 'intro2', 'intro3', 'intro4'], ps = [...$('intro').querySelectorAll('p')];
  ps.forEach((p, i) => { p.classList.remove('on'); p.classList.toggle('msg', i === 2); p.dataset.from = i === 2 ? '민아 · 17:41' : ''; p.textContent = i === 2 ? VO[ids[i]].text : VO[ids[i]].text; });
  preload([...ids, 'guard1']);
  const W = s => new Promise(r => setTimeout(r, s * 1000 / (DEBUG && window.__introJump ? 6 : 1)));
  (async () => {
    await W(.9);
    for (let i = 0; i < 4; i++) {
      if (state !== 'intro') return;
      if (i === 2) { sfx.vibrate(); await W(1.4); if (state !== 'intro') return; }
      ps[i].classList.add('on');
      const sec = await speak(ids[i], i === 2 ? 'phone' : 'none');
      await W(Math.max(sec, 1.6) + .5);
    }
    if (state === 'intro') { sfx.swell(1.6, .35); await W(1.5); introText = false; introT = 6; }
  })();
}
function finishIntro() {
  stopSpeak(); introText = false; if (introGuard) introGuard.visible = false;
  preload(['phone1', 'phone2', 'phone3', 'pa1', 'gh1', 'gh2', 'gh3', 'gh4', 'cam1', ...Object.keys(LINES).map(k => `l_${k}_${CK()}`)]);
  $('intro').classList.remove('show'); $('introTitle').classList.remove('show'); $('hud').classList.add('show'); $('cine').classList.remove('on');
  if (!readingSave && !SET.flashReduce) { const b = $('blink'); b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); setTimeout(() => b.classList.remove('go'), 2700); }   // 눈을 뜨듯 시작
  if (!readingSave) { P.x = 0; P.z = 77.5; P.yaw = 0; P.pitch = 0; }
  state = 'playing';
  if (!readingSave) { setTimeout(() => talk('arrive', 4200), 500); setTimeout(() => showChapter(1), 900); }
}
// 정문 앞 경비원 — 인트로에만 나타나는 '그날 밤의 잔상' (번개가 치면 사라진다)
let introGuard = null, introCue = 0;
function buildGuard() {
  const g = new THREE.Group(), M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .8, transparent: true, opacity: .92, ...o });
  const uni = M(0x34466a, { emissive: 0x1a2a44 }), dark = M(0x23283a, { emissive: 0x0c0f18 }), skin = M(0xc8aa94, { emissive: 0x3a2e26 }), badge = M(0xc8a040, { metalness: .7, roughness: .4 });
  const cap = (r, h, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 6, 12), m);
  const put = (o, x, y, z) => { o.position.set(x, y, z); g.add(o); return o; };
  [-.1, .1].forEach(x => put(cap(.075, .62, dark), x, .45, 0));
  put(cap(.2, .42, uni), 0, 1.22, 0).scale.set(1, 1, .75);
  put(new THREE.Mesh(new THREE.BoxGeometry(.06, .07, .01), badge), -.09, 1.38, .15);
  put(new THREE.Mesh(new THREE.SphereGeometry(.11, 16, 12), skin), 0, 1.68, 0);
  put(new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .07, 16), uni), 0, 1.78, 0);
  put(new THREE.Mesh(new THREE.BoxGeometry(.2, .015, .12), dark), 0, 1.75, .11);
  put(cap(.055, .45, uni), -.25, 1.17, 0).rotation.z = .08;
  const arm = put(cap(.055, .4, uni), .25, 1.25, .12); arm.rotation.x = -1.1;
  put(new THREE.Mesh(new THREE.CylinderGeometry(.03, .025, .2, 10), dark), .25, 1.12, .38).rotation.x = Math.PI / 2;
  const lens = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex(), color: 0xfff0d0, blending: THREE.AdditiveBlending, depthWrite: false })); lens.scale.setScalar(.6); lens.position.set(.25, 1.12, .5); g.add(lens);
  // 조명을 새로 추가하면 셰이더가 다시 컴파일되므로, 빛 대신 발광 재질 · 손전등 광원 스프라이트로 표현한다
  const beam = new THREE.Mesh(new THREE.ConeGeometry(.9, 5, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.geometry.translate(0, -2.5, 0); beam.rotation.x = -Math.PI / 2 - .25; beam.position.set(.25, 1.12, .5); g.add(beam);
  g.position.set(1.3, 0, GATE_Z + 4.6); g.rotation.y = -.12; g.visible = false; scene.add(g);
  npcLoad('guard', g, { url: 'assets/characters/guard.glb', height: 1.75, native: true, clipNames: ['flashlighthold', 'idle'] });
  return g;
}
// 경비원 NPC (서브 캐릭터 시트): 60대 · 175cm · 남색 근무복 · 표장 모자 · SECURITY 패치 · 무전기 · 손전등 · 작업화 — 해가 지기 전까지 경비실에 있다
function buildGuardNPC() {
  const g = new THREE.Group(), M = (c, r = .8, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...o });
  const uni = M(0x283450, .82), pants = M(0x1c2130, .85), skin = M(0xc9a088, .62), boot = M(0x111111, .4), badge = M(0xc8a040, .35, { metalness: .7 }), blk = M(0x15161a, .5), gray = M(0x8a8a88, .7);
  const cap = (r, h, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 6, 12), m);
  const put = (o, ...a) => { if (o.isBufferGeometry) o = new THREE.Mesh(o, a.shift()); const [x, y, z, p = g] = a; o.position.set(x, y, z); p.add(o); return o; };
  [-1, 1].forEach(s => { put(cap(.085, .62, pants), s * .1, .5, 0); put(new THREE.BoxGeometry(.12, .1, .26), boot, s * .1, .05, .04); });
  put(new THREE.BoxGeometry(.4, .07, .24), blk, 0, .9, 0);   // 근무 벨트
  put(new THREE.BoxGeometry(.07, .12, .05), blk, -.2, .87, .1); put(new THREE.BoxGeometry(.06, .16, .04), blk, .2, .88, .1);   // 파우치 · 무전기
  const body = put(cap(.2, .42, uni), 0, 1.22, 0); body.scale.set(1.05, 1, .74);
  put(new THREE.BoxGeometry(.08, .45, .02), M(0x23283a, .7), 0, 1.25, .15);   // 지퍼 · 넥타이 선
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(.12, .045), new THREE.MeshBasicMaterial({ map: makeSign('SECURITY', '#20242c', '#d8d4c4', 22), color: 0xb0aca0 })); put(patch, .1, 1.37, .152);
  put(new THREE.CircleGeometry(.035, 12), badge, -.11, 1.37, .152);
  put(new THREE.BoxGeometry(.11, .025, .01), M(0xd8d8d0, .6), .1, 1.31, .152);   // 명찰
  [-1, 1].forEach(s => { const a = put(cap(.06, .44, uni), s * .26, 1.15, 0); a.rotation.z = s * .1; put(new THREE.SphereGeometry(.045, 10, 8), skin, s * .29, .88, .02); });
  put(new THREE.CylinderGeometry(.05, .055, .08, 10), skin, 0, 1.53, 0);
  const head = put(new THREE.SphereGeometry(.105, 18, 14), skin, 0, 1.66, .01); head.scale.set(.95, 1.08, 1);
  put(new THREE.BoxGeometry(.14, .02, .01), gray, 0, 1.6, .1);   // 희끗한 콧수염
  [-1, 1].forEach(s => { put(new THREE.SphereGeometry(.012, 8, 6), blk, s * .036, 1.685, .094); put(new THREE.BoxGeometry(.04, .008, .01), gray, s * .036, 1.708, .095); put(new THREE.SphereGeometry(.026, 8, 6), skin, s * .1, 1.66, 0).scale.set(.5, 1, .8); });   // 눈 · 눈썹 · 귀
  put(new THREE.BoxGeometry(.024, .04, .03), skin, 0, 1.65, .105);   // 코
  put(new THREE.CylinderGeometry(.108, .104, .07, 18, 1, true, Math.PI * .6, Math.PI * .8), gray, 0, 1.7, 0);   // 모자 아래 희끗한 옆 · 뒷머리
  put(new THREE.CylinderGeometry(.115, .118, .08, 18), uni, 0, 1.77, 0);
  put(new THREE.BoxGeometry(.2, .015, .13), blk, 0, 1.735, .1);   // 모자 챙
  put(new THREE.CircleGeometry(.025, 12), badge, 0, 1.79, .118);
  put(new THREE.CylinderGeometry(.025, .02, .2, 10), blk, .3, .95, .1).rotation.x = Math.PI / 2;   // 손전등
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
const guardNPC = buildGuardNPC(); guardNPC.position.set(20.3, 0, 65.6); guardNPC.rotation.y = .9; world.OUT.add(guardNPC);
npcLoad('guard', guardNPC, { url: 'assets/characters/guard.glb', height: 1.75, native: true, clipNames: ['idle', 'stand'] });
const guardCap = new THREE.Mesh(new THREE.CylinderGeometry(.115, .118, .08, 18), new THREE.MeshStandardMaterial({ color: 0x283450, roughness: .8 })); guardCap.position.set(20.0, .8, 66.55); guardCap.visible = false; world.OUT.add(guardCap);
world.props.push({ kind: 'guardnpc', floor: 0, x: 20.3, z: 65.6, y: 1.5, label: '경비 아저씨와 이야기하기' });
let guardGift = false;
async function talkGuard(p) {
  const say2 = async id => { const sec = await speak(id); subtitle('경비 아저씨', VO[id].text, Math.max(2.5, sec) + .4); npcVisuals.portrait('guard', '경비 아저씨', (Math.max(2.5, sec) + .4) * 1000); return sec; };
  await say2('guardHi');
  for (let n = 0; n < 4 && state === 'playing'; n++) {
    const opts = [{ label: '민아라는 학생 못 보셨어요?' }, { label: '이 학교에 무슨 일이 있었어요?' }, { label: guardGift ? '(건전지는 이미 받았다)' : '손전등 건전지 좀 있으세요?' }, { label: '이만 가 볼게요' }];
    const i = await choose('경비 아저씨', '경비실 창가 의자에 앉아 있던 경비원이 손전등을 만지작거린다.', opts);
    if (i === 3) { say2('guardBye'); break; }
    if (i === 0) await wait(1000 * await say2('guardMina'));
    else if (i === 1) await wait(1000 * await say2('guardPast'));
    else if (!guardGift) { guardGift = true; inv.battery += 2; refreshHud(); sfx.pickup(); toast('건전지 2개를 받았다', '경비 아저씨: 열한 시 사십 분 전에는 나와야 한다', 'info'); await wait(1000 * await say2('guardGift')); }
  }
}
// 인트로: 검은 화면 텍스트 → 빗속 공중 전경(번개 · 타이틀) → 정문으로 내려앉기(경비원의 잔상) → 플레이 시작
function updateIntro(dt) {
  introT += dt * (DEBUG && window.__introJump ? 6 : 1);
  if (introText) introT = Math.min(introT, 5.99);
  const ease = t => t * t * (3 - 2 * t), T = introT;
  if (T < 6) { camera.position.set(0, 10, 106); camera.rotation.set(-.1, 0, 0, 'YXZ'); }
  else {
    if ($('intro').classList.contains('show')) { $('intro').classList.remove('show'); }
    if (!introGuard) introGuard = buildGuard();
    const cue = (n, fn) => { if (introCue < n && T >= [0, 6.6, 8.2, 9.4, 12.8, 13.6, 17.2][n]) { introCue = n; fn(); } };
    cue(1, () => { fx.lightning(); sfx.thunder(.6); });
    cue(2, () => { sfx.swell(1.2, .4); });
    cue(3, () => { fx.lightning(); sfx.boom(); $('introTitle').classList.add('show'); sfx.musicBox(7, .6); });
    cue(4, () => { $('introTitle').classList.remove('show'); introGuard.visible = true; sfx.flashlightClick(); });
    cue(5, async () => { const sec = await speak('guard1'); subtitle('경비 아저씨', VO.guard1.text, Math.max(sec, 3) + .4); npcVisuals.portrait('guard', '경비원', (Math.max(sec, 3) + .4) * 1000); });
    cue(6, () => { fx.lightning(); sfx.thunder(.3); introGuard.visible = false; caption('…아무도 없다'); });
    // 공중 전경 → 정문 앞으로 하강
    const k1 = ease(clamp((T - 6) / 6.2, 0, 1)), k2 = ease(clamp((T - 12.2) / 5.4, 0, 1));
    const ax = lerp(-26, 0, k1), ay = lerp(24, 8, k1), az = lerp(104, 92, k1);
    camera.position.set(lerp(ax, 0, k2) + Math.sin(T * .7) * .05, lerp(ay, 1.62, k2), lerp(az, 77.5, k2));
    const tx = lerp(0, 0, k2), ty = lerp(5, 1.4, k2), tz = lerp(0, GATE_Z - 6, k2);
    camera.lookAt(tx, ty, tz); camera.rotation.reorder('YXZ'); camera.rotation.z = 0;
  }
  updateLighting(dt);
  if (T > 19.2) finishIntro();
}
addEventListener('keydown', e => { if (state === 'intro' && ['Space', 'Enter', 'Escape'].includes(e.code)) finishIntro(); });
$('intro').addEventListener('click', () => { if (state === 'intro') finishIntro(); });

/* ---------- 타이틀 · 캐릭터 선택 ---------- */
let readingSave = false;
const fmtAgo = t => { if (!t) return ''; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? '방금 전' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : new Date(t).toLocaleDateString('ko-KR'); };
const tipsDone = new Set();
const MENUS = ['title', 'charsel', 'newConfirm', 'settings', 'gallery', 'credits'];
function closeMenus() { MENUS.forEach(k => $(k).classList.remove('show')); }
function applyChar() {
  const c = CH();
  document.documentElement.style.setProperty('--acc', c.color);
  $('pName').textContent = c.name; $('pAge').textContent = `${c.age} · ${c.school.split(' ')[1] || ''}`; $('dlgName').textContent = c.name;
  curFace = ''; updateFace(0);
}
function newGame() {
  try { clearSlot(localStorage, SKEYS); } catch (e) { /* ignore */ }
  lock(); start();
}
function continueGame(preferBackup) {
  const d = readSave(preferBackup); if (d && CHARACTERS[d.meta.char]) CHAR = d.meta.char;   // 시작 전에 주인공부터 맞춘다
  readingSave = true; lock(); start(true); if (!load(preferBackup)) { readingSave = false; P.x = 0; P.z = 77.5; }
}
function refreshTitle() {
  const d = readSave();
  $('mContinue').style.display = d ? 'block' : 'none';
  if (d && d.meta) { const c = CHARACTERS[d.meta.char]; $('mContInfo').textContent = `${c ? c.name : ''} · 제${d.meta.ch}장 · ${d.meta.where || ''} · ⏱ ${fmtPT(d.meta.time || 0, true)} · ${fmtAgo(d.meta.savedAt)}`; }
  $('mCharName').textContent = CH().name;
  let ends = []; try { ends = JSON.parse(localStorage.getItem('haegyo_endings') || '[]'); } catch (e) { /* ignore */ }
  const ST = statRead(), tot = ST.total ? `총 플레이 ${fmtPT(ST.total, true)}  ·  ` : '';
  $('tEnd').textContent = (ends.length ? `달성한 엔딩: ${ends.filter(e => e === 'true' || e === 'normal').map(e => e === 'true' ? 'TRUE' : 'NORMAL').join(' · ')}  ·  ` : '') + tot;
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
$('mQuit').onclick = () => { $('bye').classList.add('show'); };
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
$('bakBtn').addEventListener('click', () => { try { sessionStorage.setItem('haegyo_auto', 'backup'); } catch (e) { /* ignore */ } location.reload(); });
$('loadBtn2').addEventListener('click', () => { try { sessionStorage.setItem('haegyo_auto', 'continue'); } catch (e) { /* ignore */ } location.reload(); });
$('resumeBtn').addEventListener('click', () => { lock(); $('pause').classList.remove('show'); state = 'playing'; });
$('retryBtn').addEventListener('click', () => { try { sessionStorage.setItem('haegyo_auto', 'continue'); } catch (e) { /* ignore */ } location.reload(); });
$('restartBtn').addEventListener('click', () => { try { clearSlot(localStorage, SKEYS); sessionStorage.setItem('haegyo_auto', 'new'); } catch (e) { /* ignore */ } location.reload(); });
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
    const wantRun = (SET.runToggle ? P.runOn : (keys[K().run] || keys.ShiftRight)) && want && !P.tired && P.stamina > 0 && !P.crouch;
    if (wantRun) { P.sprinting = true; P.stamina = Math.max(0, P.stamina - (CHAR === 'jihun' ? 16 : 20) * ((P.snackT || 0) > 0 ? .5 : 1) * dt); if (P.stamina <= 0) { P.tired = true; P.runOn = false; talk('sprint', 2200); sfx.gasp(); } }
    else { P.stamina = Math.min(100, P.stamina + (want ? 9 : 18) * dt); if (P.tired && P.stamina > 30) P.tired = false; }
    if (want) {
      const sp = P.sprinting ? 5.0 : P.crouch ? 1.45 : 2.8;
      const l = Math.hypot(fw, sd) || 1;
      const dx = (-Math.sin(P.yaw) * fw + Math.cos(P.yaw) * sd) / l, dz = (-Math.cos(P.yaw) * fw - Math.sin(P.yaw) * sd) / l;
      const ox = P.x, oz = P.z;
      // 한 프레임 이동을 짧은 구간으로 나눠 충돌을 처리한다 (프레임이 길어도 벽을 넘거나 튀지 않게)
      const tot = sp * dt, n = Math.max(1, Math.ceil(tot / .06));
      for (let i = 0; i < n; i++) {
        P.x += dx * tot / n; P.z += dz * tot / n;
        const px = P.x - dx * tot / n, pz = P.z - dz * tot / n;
        collide(colsAt(F), P, .32);
        if (P.floor === 0 && gateClosed) collide([gate.blockRect], P, .32);
        if (stairStep(px, pz)) break;
      }
      const mv = Math.hypot(P.x - ox, P.z - oz);
      P.moving = mv > .0005; P.bob += mv * (P.sprinting ? 2.4 : 2.9); P.stepD += mv;
      if (P.stepD > (P.sprinting ? 1.9 : 1.45)) { P.stepD = 0; sfx.step(P.sprinting, 1, surfaceAt());
        if (PSY.follow > 0) { const sp = P.sprinting; setTimeout(() => at(P.x + Math.sin(P.yaw) * 3.2, floors[P.floor].y0 + .1, P.z + Math.cos(P.yaw) * 3.2).step(sp, .75, surfaceAt()), 240 + Math.random() * 60); } }
    } else P.stepD = 0;
  } else if (P.hiding) P.stamina = Math.min(100, P.stamina + 25 * dt);
  P.flashCD = Math.max(0, (P.flashCD || 0) - dt); P.pbat = Math.min(100, (P.pbat ?? 100) + dt * .35);
  P.noiseT = Math.max(0, (P.noiseT || 0) - dt); P.snackT = Math.max(0, (P.snackT || 0) - dt);
  P.noise = P.hiding ? 0 : P.noiseT > 0 ? 9 : P.sprinting ? 12 : P.moving ? (P.crouch ? 1.5 : 4) : 0;
  // 점프 · 웅크리기
  // 점프 · 가구 위: 발 아래 가장 높은 가구 윗면이 바닥이 된다 (가장자리를 벗어나면 떨어진다)
  { const sup = P.sh ? 0 : supportAt(floors[P.floor], P.x, P.z, P.jy || 0);
    if (P.vy > 0 || (P.jy || 0) > sup + .001) { P.vy -= 13 * dt; P.jy = Math.max(sup, (P.jy || 0) + P.vy * dt);
      if (P.jy <= sup + 1e-4 && P.vy <= 0) { if (P.vy < -1.5) { sfx.step(true, 1.1, sup > .1 ? 'wood' : surfaceAt()); P.noiseT = Math.max(P.noiseT, .25); } P.vy = 0; P.jy = sup; if (jumpBuf > 0) { jumpBuf = 0; tryJump(); } } }
    if (jumpBuf > 0) jumpBuf -= dt;
    else if ((P.jy || 0) < sup) P.jy = sup; }
  P.crouchK = lerp(P.crouchK || 0, P.crouch && !P.hiding ? 1 : 0, Math.min(1, dt * 9));

  // 정문 닫힘 연출
  if (!gateClosed && state === 'playing' && P.z < GATE_Z - 3) {
    gateClosed = true; gateState = 'closing'; sfx.gateClang(); shake = .8; if (P.z > GATE_Z - 8) lookBack = 1.9;
    setTimeout(() => { toast('정문이 잠겼습니다', '민아의 흔적을 따라 학교 안으로', 'warn'); talk('gate', 4200); refreshHud(); }, 800);
  }
  if (!introDone && P.floor === 0 && P.z < MAIN_ZS - .5) { introDone = true; talk('inside', 3500); refreshHud(); setTimeout(() => toast('팁', '쪽지를 읽고, 사물함에 숨어 시선을 피하세요. (Tab 소지품 · P 휴대폰 · M 지도)', 'info'), 1500); }

  P.invuln = Math.max(0, P.invuln - dt);
  if (!P.bcast && P.floor === 2 && Math.abs(P.x + 24) < 3.8 && P.z < -2) { P.bcast = true; sfx.broadcast(); setTimeout(() => line('pa1', 'pa'), 900); setTimeout(() => talk('speakers', 3600), 8500); }
  // 손전등/배터리
  if (P.light && P.battery > 0) P.battery = Math.max(0, P.battery - .26 * dt * (CHAR === 'seoyeon' ? .75 : 1) * DF().battery);   // 100% ≈ 7~9분
  if (P.battery <= 0 && P.light && !P.phoneLight) { if (inv.battery > 0) useBattery(); else { P.phoneLight = true; toast('손전등이 꺼졌습니다', '휴대폰 불빛으로 비춘다 — 건전지를 찾으세요', 'warn'); caption('손전등 전구가 꺼진다'); } }
  if (P.battery > 0) P.phoneLight = false;
}

function updateGate(dt) {
  if (gateState === 'closing') { gateAnim = Math.min(1, gateAnim + dt / .9); gate.setOpen(1 - easeOut(gateAnim)); if (gateAnim >= 1) { gateState = 'closed'; gate.setOpen(0); } }
  else if (gateState === 'opening') { gateAnim = Math.max(0, gateAnim - dt / 3); gate.setOpen(1 - easeOut(gateAnim)); }
  gate.lockParts.forEach(m => { m.visible = gateState === 'closed'; });
}
const easeOut = t => 1 - Math.pow(1 - t, 3);

function updateLighting(dt) {
  const F = floors[P.floor];
  const indoors = P.floor >= 4 || (P.floor > 0 && P.floor < 3) || (P.floor === 0 && inBldg(P.x, P.z));
  const k = Math.min(1, dt * 3);
  updateDay(dt);
  const dk = DAY.k;
  moonLight.color.copy(MOON_COL).lerp(SUN_COL, dk); moonLight.position.copy(MOON_POS).lerp(SUN_POS, dk);
  moonLight.intensity = lerp(moonLight.intensity, indoors ? 0 : lerp(1.6, 2.3, dk), k);
  lightFlash = Math.max(0, lightFlash - dt * 3);
  hemi.color.copy(HEMI_SKY_N).lerp(HEMI_SKY_D, dk); hemi.groundColor.copy(HEMI_GND_N).lerp(HEMI_GND_D, dk);
  hemi.intensity = BRIGHT ? 1.5 : lerp(hemi.intensity, indoors ? lerp(.34, .66, dk) : lerp(.68, 1.15, dk), k) + (indoors && P.floor <= 2 ? lightFlash * (Math.sin(tNow * 60) > 0 ? .9 : .3) : 0);
  fillLight.intensity = lerp(fillLight.intensity, indoors ? 0 : lerp(.85, .5, dk), k);
  scene.fog.density = lerp(scene.fog.density, indoors ? lerp(.05, .03, dk) : lerp(.014, .0075, dk), k);
  scene.fog.color.lerp(indoors ? _c1.copy(FOG_IN).lerp(FOG_IN_DAY, dk) : _c1.copy(FOG_OUT).lerp(FOG_DAY, dk), k);
  // 밖에서 건물과 멀리 떨어져 있으면 본관 1층 내부는 그리지 않는다 (창 너머로 거의 보이지 않음 · 야외 프레임 저하의 주원인)
  const farOut = P.floor === 0 && !indoors && (P.z > MAIN_ZS + 16 || P.z < -26 || Math.abs(P.x) > 52);
  floors.forEach(f => { f.interior.visible = f.f === P.floor && !farOut; if (f.f <= 2) f.shell.visible = P.floor <= 3; });
  // 야외: 손전등 그림자 범위를 줄여 그림자 패스가 캠퍼스 전체를 다시 그리지 않게 (셰이더 재컴파일 없이)
  const sf = indoors ? 26 : 6; if (flash.shadow.camera.far !== sf) { flash.shadow.camera.far = sf; flash.shadow.camera.updateProjectionMatrix(); }
  world.OUT.visible = P.floor === 0 || P.floor === 3 || state === 'menu' || state === 'intro';
  // 형광등 풀: 가장 가까운 켜진 램프 4개에 PointLight 배치
  lampTimer -= dt;
  if (lampTimer <= 0) {
    lampTimer = .2;
    const c = F.lamps.filter(l => l.kind !== 'dead' && !l.off).map(l => ({ l, d: Math.hypot(l.x - P.x, l.z - P.z) })).filter(o => o.d < 16).sort((a, b) => a.d - b.d).slice(0, 4);
    pool.forEach((p, i) => { const o = c[i]; if (o) { p.position.set(o.l.x, o.l.y, o.l.z); p.userData.kind = o.l.kind; p.userData.lamp = o.l; p.userData.on = true; } else p.userData.on = false; });
  }
  updateGenerator(dt, indoors);
  pool.forEach((p, i) => {
    if (!p.userData.on || blackout > 0 || !indoors) { p.intensity = 0; return; }
    const lp = p.userData.lamp, st = lp && lp.start ? tNow - lp.start : 9;
    if (st < 0) { p.intensity = 0; return; }
    // 켤 때: 스타터가 두 번 깜빡인 뒤 안정 (무작위 점멸 대신 정해진 짧은 패턴) · 고장 램프: 램프 재질과 같은 부드러운 감광
    const fl = st < .9 ? (SET.flashReduce || SET.noFlicker ? Math.min(1, st / .9) : st < .12 || (st > .3 && st < .42) ? .55 : st < .6 ? .25 + st : 1) : p.userData.kind === 'flick' ? (lp.mat && lp.mat.userData.v != null ? lp.mat.userData.v : 1) : 1;
    p.intensity = 7 * fl * GEN.gain * (power ? 1 : .86);
  });
  // 손전등
  const near = ghost.active && ghost.floor === P.floor ? clamp(1 - Math.hypot(ghost.x - P.x, ghost.z - P.z) / 9, 0, 1) : 0;
  let fi = P.light && P.battery > 0 ? 95 : 0;
  if (P.battery < 15 && fi) fi *= .72 + .28 * Math.sin(tNow * 11) * Math.sin(tNow * 2.7 + 1);   // 부드러운 깜빡임
  if (P.light && P.battery <= 0) { fi = 42; flash.distance = 14; } else flash.distance = 32;   // 배터리가 다 떨어지면 휴대폰 불빛
  if (near > .4 && fi && Math.random() < near * .12) fi = 0;
  if (repelK > .02 && fi) {   // 집중 조사: 창백한 푸른빛 ↔ 붉은빛으로 미세하게 떨리고 세기가 요동친다
    const j = Math.random(); flash.color.setRGB(.75 + .25 * (j > .8 ? 1 : 0) * repelK, .82 - .25 * repelK * j, 1 - .15 * repelK * (1 - j)); fi *= 1.1 + .35 * repelK * (Math.random() - .3);
  } else flash.color.setHex(0xfff0d0);
  setCoil(fi ? repelK : 0); if (repelK > .05) shake = Math.max(shake, .22 * repelK);
  if (CAM.on) fi *= .3;   // 심령 카메라: 야간 투시라 손전등 빛을 줄인다 (흔적이 묻히지 않게)
  flash.intensity = fi;
  spill.intensity = fi ? (fi / 95) * 2.2 : 0;
}

// 비상 발전기: 전력 복구 전에는 건물 조명이 지하 발전기로 돌아간다 — 누런 빛, 아주 약한 전압 출렁임,
// 수십 초마다 발전기가 헛돌며 층 전체 조명이 함께 처지고(비상등이 켜짐) 다시 올라온다. 복구 후에는 드물고 약하게.
const GEN = { gain: 1, emerg: 0, t: 25, dip: null };
function updateGenerator(dt, indoors) {
  GEN.t -= dt;
  if (GEN.t <= 0 && state === 'playing') {
    GEN.t = power ? 150 + Math.random() * 150 : 28 + Math.random() * 40;
    GEN.dip = { t: 0, dur: power ? .5 : .8 + Math.random() * 1.4, depth: power ? .25 : .55 + Math.random() * .3 };
    if (indoors && P.floor !== 3) { sfx.genChug(power ? .4 : 1); if (!power && Math.random() < .5) setTimeout(() => caption('지하에서 발전기가 덜컹거린다'), 300); }
  }
  let g = power ? 1 : 1 - .035 * (.5 + .5 * Math.sin(tNow * 1.7)) * (.6 + .4 * Math.sin(tNow * .43));
  if (GEN.dip) {
    const d = GEN.dip; d.t += dt; const x = d.t / d.dur;
    if (x >= 1) GEN.dip = null;
    else { const sh = Math.sin(Math.PI * x) * (SET.flashReduce || SET.noFlicker ? 1 : .8 + .2 * Math.sin(d.t * 31)); g *= 1 - d.depth * sh; }
  }
  GEN.gain = g;
  const em = blackout > 0 ? 1 : clamp((.8 - g) * 3.5, 0, 1);
  GEN.emerg = lerp(GEN.emerg, em, Math.min(1, dt * (em > GEN.emerg ? 12 : 3)));
  // 발전기 소리: 실내에서 전력 복구 전, 지하 발전기실(B1 동쪽)에 가까울수록 크게
  const nearGen = P.floor === 4 ? clamp(1 - Math.hypot(P.x - 24, P.z + 5.5) / 22, 0, 1) : 0;
  setGenHum(state === 'playing' && indoors && !power ? .25 + nearGen * .75 + (GEN.dip ? .4 : 0) : 0, dt);
}

// 해 질 녘 → 밤: 정문이 닫히면 75초에 걸쳐 해가 지고, 다 지면 비가 쏟아진다 (밖에서 오래 머물러도 2분 반 뒤엔 시작)
function updateDay(dt) {
  if (!DAY.done && DAY.start < 0 && state === 'playing' && (gateClosed || playTime > 150)) { DAY.start = playTime; caption('해가 학교 뒤로 넘어가기 시작한다'); sfx.swell(3, .25); }
  if (!DAY.done && DAY.start >= 0) {
    const x = clamp((playTime - DAY.start) / DAY.dur, 0, 1), e = x * x * (3 - 2 * x); DAY.k = .92 * (1 - e);
    if (x >= 1) { DAY.done = true; FL.night = true; DAY.k = 0; sfx.swell(2.4, .3); toast('밤이 되었다', '학교에 어둠이 내려앉았다', 'warn'); }
  }
  if (FL.night && !DAY.done) { DAY.done = true; DAY.k = 0; }
  const dk = DAY.k, sky = world.sky;
  skyDome.position.copy(camera.position); skyDome.scale.setScalar(camera.far * .9);   // 시야 거리 안쪽에서 카메라를 따라간다
  for (let i = 0; i < 3; i++) [skyU.uTop, skyU.uHor, skyU.uBot][i].value.copy(SKY_N[i]).lerp(SKY_D[i], dk);
  skyU.uGlow.value = clamp(dk * 1.6 - .1, 0, 1) * clamp(1.6 - dk, 0, 1);   // 해 질 녘에 가장 붉게
  scene.background.setHex(0x05070d).lerp(BG_DAY, dk);
  const night = clamp(1 - dk * 3, 0, 1); sky.stars.visible = sky.moon.visible = sky.moonGlow.visible = night > .02;
  sky.stars.material.opacity = night; sky.stars.material.transparent = true; sky.moonGlow.material.opacity = night;
  DAY.rain = 0; setRainLevel(0);   // 비 효과 제거 (요청)
  world.winMats[9].emissiveIntensity = night * 2.4;
  { const here = dk > .3 && !FL.night; guardNPC.visible = here; guardCap.visible = !here; const gp = world.props.find(q => q.kind === 'guardnpc'); if (gp) gp.done = !here; }   // 해가 지면 경비원은 사라지고 모자만 남는다   // 밤이 되면 불 켜진 교실 창 몇 개 (아무도 없는데)
  // 낮의 소리: 가끔 까마귀
  if (dk > .3 && state === 'playing' && isOutdoors() && Math.random() < dt / 14) sfx.crow(Math.random() * 2 - 1);
}

let beatT = 0, camShakeT = 0;
function updateCamera(dt, t) {
  const F = floors[P.floor];
  const bob = SET.bob ? Math.sin(P.bob) * (P.sprinting ? .05 : .028) : 0;
  P.shV = lerp(P.shV || 0, P.sh || 0, Math.min(1, dt * 14));
  P.jyV = (P.vy || 0) !== 0 ? (P.jy || 0) : lerp(P.jyV || 0, P.jy || 0, Math.min(1, dt * 16));   // 낮은 단을 걸어 오를 때 시점이 툭 튀지 않게 (점프 중엔 그대로)
  let ey = P.hiding ? 1.45 : 1.62 - (P.crouchK || 0) * .55 + P.jyV + P.shV + bob * (1 - (P.crouchK || 0) * .5);
  camera.position.set(P.x, F.y0 + ey, P.z);
  let yaw = P.yaw, pitch = P.pitch;
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.4); const k = SET.shake ? .05 : .008; yaw += (Math.random() - .5) * k * shake; pitch += (Math.random() - .5) * k * shake; }
  const G = ghost; let prox = 0, chase = false;
  if (G.active && G.floor === P.floor) { prox = clamp(1 - Math.hypot(G.x - P.x, G.z - P.z) / 14, 0, 1); chase = G.state === 'chase' || !!G.hunt; }
  if (state === 'dead') { const dx = G.x - P.x, dz = G.z - P.z; yaw = Math.atan2(-dx, -dz); pitch = .1; }
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  applyThirdPerson(dt, yaw, pitch);
  const fov = SET.fov + (P.sprinting ? 6 : 0) + (chase ? 4 : 0) + (state === 'dead' ? -10 : 0) - repelK * 8;
  camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 6)); camera.updateProjectionMatrix();
  $('fear').style.opacity = SET.fearFx ? clamp(prox * (chase ? 1.2 : .7), 0, 1) : 0;
  document.body.classList.toggle('chase', chase && state === 'playing');
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
  const el = $('card'); el.querySelector('img').src = `assets/img/${c[0]}.webp`; el.classList.toggle('noimg', !SET.areaPhotos);
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
  else if (f === 0 && !inBldg(P.x, P.z)) {
    if (P.z > 60) k = 'gate'; else if (P.x < -40 && Math.abs(P.z - 32) < 9) k = 'westGate'; else if (Math.abs(P.x) < 22 && P.z < -10.5) k = 'annexOut';
  } else if (f <= 2 || f === 4 || f >= 8) {
    const an = f >= 8, sl = an ? ANNEX.slots : SLOTS, lay = an ? ANNEX.floors[f - 8] : LAYOUT[f];
    const sr = roomAt(f, P.x, P.z);
    if (sr && sr.south) k = sr.type;
    else if (P.z > -1.75) k = f === 4 ? 'b1' : an ? 'annex' : 'corridor';
    else { const i = sl.findIndex(c => Math.abs(P.x - c) < 4); if (i >= 0) k = lay.types[i]; }
  }
  if (k) showCard(k);
}
const REF_TITLES = ['폐교 실내 공간 3D 모델링 시트', '폐교 정문 3D 배경 시트', '교실 소품 오브젝트 시트', '폐교 내부 3D 배치도', '폐교 배치도 / 건물 도면', '주인공 캐릭터 시트', '인게임 화면 · UI 구성', '특수 공간 상세 배치도', '상호작용 UI 시트', '체육관 내부 시트', '방송실 내부 배치', '수영장 내부 배치', '방송실 · 수영장 · 지하 B1', '학교 지도', '급식실 배치도', '별관 (특별교실동)', '서문 상세 안내도', '방송실 상세 배치도', '수영장 샤워실 · 탈의실', '전체 배치도 · 오브젝트 · 이펙트 시트', '학교 외부 창문 텍스처 시트', '폐교 외부 설정도', '학교 외관 디자인 시트', '서브 캐릭터 — 민아', '서브 캐릭터 — 경비원'];
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
  else if (galTab === 'props') {   // 사용자 제공 3D 소품 133종 팩 — 미리보기 렌더 (게임에 배치한 것은 이름 앞에 ●)
    const used = new Set(world.MODELS.filter(m => m.model.startsWith('h133/')).map(m => m.model.slice(5)));
    fetch('assets/models/h133/manifest.json').then(r => r.json()).then(list => { if (galTab !== 'props') return; list.forEach(m => fig(`assets/models/h133/thumbs/${m.id}.webp`, `assets/models/h133/thumbs/${m.id}.webp`, `${used.has(m.id) ? '● ' : ''}${m.id} ${m.name} — ${m.category_kr} · ${m.description}`)); }).catch(() => {});
  }
  else if (galTab === 'char') Object.values(CHARACTERS).forEach(c => {
    fig(`assets/ui/${c.portrait}.webp`, `assets/ui/${c.portrait}.webp`, `${c.name} — 초상`); fig(`assets/ui/${c.body}.webp`, `assets/ui/${c.body}.webp`, `${c.name} — 전신`);
    c.faces.forEach((f, i) => fig(`assets/ui/${f}.webp`, `assets/ui/${f}.webp`, `${c.name} — ${c.faceNames[i]}`));
  });
  else {
    let ends = []; try { ends = JSON.parse(localStorage.getItem('haegyo_endings') || '[]'); } catch (e) { /* ignore */ }
    statFlush(); const ST = statRead(), gs = document.createElement('div'); gs.className = 'galStats';
    gs.innerHTML = `<span>총 플레이 시간</span><b>${fmtPT(ST.total, true)}</b><span>엔딩 본 횟수</span><b>${ST.clears || 0}회</b><span>TRUE END 최단</span><b>${ST.best && ST.best.true ? fmtPT(ST.best.true, true, true) : '—'}</b><span>NORMAL END 최단</span><b>${ST.best && ST.best.normal ? fmtPT(ST.best.normal, true, true) : '—'}</b><span>마지막 엔딩</span><b>${ST.last ? `${ST.last.end === 'true' ? 'TRUE' : 'NORMAL'} · END ${ST.last.fin} · ${fmtPT(ST.last.t, true, true)}` : '—'}</b>`;
    gw.appendChild(gs);
    fig('assets/ui/title_main.webp', 'assets/ui/title_main.webp', 'TRUE END — 마지막 하교 방송', !ends.includes('true'));
    fig('assets/img/gate_night.webp', 'assets/img/gate_night.webp', 'NORMAL END — 다시 닫힌 문', !ends.includes('normal'));
    fig('assets/img/ghost_cut.webp', 'assets/img/ghost_cut.webp', 'BAD END — 다시, 여기서', deaths === 0);
  }
  $('gallery').classList.add('show');
}
document.querySelectorAll('#galTabs button').forEach(b => { b.onclick = () => openGallery(b.dataset.g); });
addEventListener('pointerdown', () => initAudio(), { once: true });
addEventListener('keydown', () => initAudio(), { once: true });   // 타이틀 BGM: 첫 클릭 · 키 입력 때 바로 시작
$('galBtn2').addEventListener('click', () => openGallery());
$('galClose').addEventListener('click', () => $('gallery').classList.remove('show'));
$('lightbox').addEventListener('click', () => $('lightbox').classList.remove('show'));

function updateHud(dt, prox, chase) {
  updateFace(dt); if (state === 'playing') areaCheck(dt);
  { const ft = clamp(prox * (chase ? 1.2 : .7), 0, 1); P.fear = P.fear > ft ? Math.max(ft, P.fear - dt * .05) : lerp(P.fear, ft, Math.min(1, dt * 3)); }   // 사건으로 오른 공포는 천천히 가라앉는다
  $('who').classList.toggle('panic', P.fear > .75); $('who').classList.toggle('pale', P.hp < 35 && P.fear <= .75);
  $('hpBar').style.width = P.hp + '%'; $('hpBar').style.background = P.hp > 50 ? '#5fc47a' : '#d0583c';
  $('sta').style.width = P.stamina + '%'; $('sta').style.background = P.tired ? '#a85040' : '#5a9ac8';
  $('fearBar').style.width = P.fear * 100 + '%';
  const st = $('stat'); st.textContent = (P.hp > 50 ? (P.fear > .6 ? '공포' : '정상') : '부상') + (P.crouch ? ' · 앉음' : ''); st.style.color = P.hp > 50 ? (P.fear > .6 ? '#e86870' : '#6fd08c') : '#e0884c';
  $('batBar').style.width = P.battery + '%'; $('s1').classList.toggle('off', !P.light);
  const outdoors = P.floor === 0 && !inBldg(P.x, P.z);
  $('floor').textContent = P.floor === 0 && outdoors ? '외부' : AREA_NAMES[P.floor];
  const m = gameMin(), h24 = Math.floor(m / 60) % 24;
  $('clock').textContent = `${h24 >= 12 ? 'PM' : 'AM'} ${String(h24 % 12 || 12).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const ps = Math.floor(playTime); if (ps !== ptShown) { ptShown = ps; $('ptime').textContent = '⏱ ' + fmtPT(ps); }
  miniT -= dt;
  if (miniT <= 0) {
    miniT = .1; const c = $('miniMap'), g = c.getContext('2d');
    g.save(); g.beginPath(); g.arc(75, 75, 75, 0, 6.3); g.clip();
    drawMap(g, 150, 150, { floor: P.floor, cx: P.x, cz: P.z, scale: 2.6, pins: mapPins(P.floor), ...mapExtras(P.floor), t: tNow, mini: true, player: { x: P.x, z: P.z, yaw: P.yaw } });
    g.restore();
  }
  updatePerks(dt);
  // 사물함 숨 참기
  const hold = !!P.hiding && keys.Space && P.breath > 0;
  if (hold && !P.holdBreath) talk('breath', 1600);
  P.holdBreath = hold;
  if (hold) { P.breath = Math.max(0, P.breath - 17 * dt); if (P.breath <= 0) { sfx.gasp(); P.breathCD = 2.5; if (ghost.active && ghost.floor === P.floor && Math.hypot(ghost.x - P.x, ghost.z - P.z) < 4) ghost.findT += 2.5; } }
  else P.breath = Math.min(100, (P.breath ?? 100) + (P.breathCD > 0 ? 0 : 11) * dt);
  P.breathCD = Math.max(0, (P.breathCD || 0) - dt);
  $('breath').classList.toggle('show', !!P.hiding); $('breathBar').style.width = (P.breath ?? 100) + '%';
  const dang = Math.max(MIC.risk, P.hiding && ghost.active && ghost.floor === P.floor ? (ghost.fake && ghost.fake.phase !== 'away' ? 1 : clamp(ghost.findT / 5.2, 0, 1)) : 0); $('dangerBar').style.width = dang * 100 + '%';
  if (dang > .45 && Math.random() < dt * 3) { shake = Math.max(shake, .12); sfx.locker && Math.random() < .3 && at(P.x, floors[P.floor].y0 + 1, P.z).click(); }
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
    sense.style.opacity = d < 22 ? clamp((22 - d) / 14, .15, .9) : 0; if (d < 22) perkFlash('⚠ 그것 감지 — 서연'); sense.style.transform = `rotate(${Math.atan2(rx, fw)}rad)`;
  } else sense.style.opacity = 0;
  glintT -= dt;
  if (CHAR !== 'jihun' || state !== 'playing') { glints.forEach(g => { g.visible = false; }); return; }
  if (glintT <= 0) {
    glintT = .3;
    const c = world.items.filter(i => !i.taken && !i.locked && i.floor === P.floor && i.kind !== 'battery' && i.kind !== 'medkit')
      .map(i => ({ p: i.pos, d: Math.hypot(i.pos.x - P.x, i.pos.z - P.z) }))
      .concat(world.props.filter(p => p.floor === P.floor && !p.done && (p.kind === 'tape' || p.kind === 'mina' || p.kind === 'safe')).map(p => ({ p: { x: p.x, y: floors[p.floor].y0 + (p.y ?? 1) , z: p.z }, d: Math.hypot(p.x - P.x, p.z - P.z) })))
      .filter(o => o.d < 11).sort((a, b) => a.d - b.d).slice(0, glints.length);
    if (c.length && !glints[0].visible) perkFlash('✦ 단서 감지 — 지훈');
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
  npcVisuals.update(dt);
  if (state === 'ui') { updateSound(dt); requestAnimationFrame(frame); return; }
  $('clickHint').classList.toggle('show', state === 'playing' && !document.pointerLockElement && !DEBUG && !TEST_NOLOCK);   // 소지품 · 지도 · 미니게임 중에는 3D를 다시 그리지 않는다 (마지막 화면 유지)
  if (state === 'playing' || state === 'trans' || state === 'dead') {
    if (state === 'playing') { playTime += dt; statAcc += dt; if (statAcc > 30) statFlush(); }
    if (state !== 'dead') updatePlayer(dt);
    updateGate(dt);
    if (blackout > 0) blackout -= dt;
    if (state === 'playing') {
      ghostTick(dt, tNow);
      // 랜덤 이벤트
      if (introDone && ghost.active) { nextEvent -= dt; if (nextEvent <= 0) { nextEvent = 60 + Math.random() * 60; randomEvent(); } }
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
  world.update(tNow, blackout > 0, GEN.gain, power ? 0 : 1, GEN.emerg);
  // 날씨: 번개 (밖이거나 창가에서), 전기 불꽃
  const outdoorsNow = isOutdoors();
  if (state === 'playing' || state === 'menu' || state === 'intro') {
    lightningT -= dt;
    if (lightningT <= 0 && DAY.k < .2) { lightningT = 50 + Math.random() * 50; fx.lightning(); lightningEvent(); const far = 1 + Math.random() * 2.5; setTimeout(() => sfx.thunder && sfx.thunder(far), far * 700); }
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
  // 그것 주변의 검은 연기 · 추운 곳의 입김
  if (state === 'playing' && ghost.active && ghost.floor === P.floor && ghost.group.visible) fx.ghostSmoke({ x: ghost.x, y: floors[ghost.floor].y0, z: ghost.z }, dt, ghost.state === 'chase' ? 1.6 : .8);
  if (state === 'playing') fx.breath(P.floor === 4 || P.floor === 6 || isOutdoors() || P.fear > .5, dt);
  updateSound(dt);
  updatePings(dt); updateObjDir(dt);
  fx.render(dt, { fear: P.fear || 0, flash: flash.intensity / 95, outdoors: outdoorsNow, floorY: floors[P.floor].y0, hurt: hurtFx, rain: 0 });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);


/* ---------- 형광등 스위치 ---------- */
// 같은 room 키의 형광등을 켜고 끈다. 켤 때는 형광등 특유의 '틱- 틱-' 점등 깜빡임이 있다.
const roomLamps = p => floors[p.floor].lamps.filter(l => l.room === p.room);
function flipSwitch(p, on, byPlayer = false) {
  p.on = on; p.tried = true;
  const ls = roomLamps(p), t0 = tNow;
  ls.forEach(l => { l.off = !on; l.start = on ? t0 + Math.random() * .25 : 0; l.mesh && (l.mesh.material = (!on || l.kind === 'dead') ? world.mats.matLampDead : l.mat); });
  lampTimer = 0;
  if (!byPlayer) return;
  at(p.px, floors[p.floor].y0 + 1.3, p.pz).click();
  if (on) {
    sfx.lightOn();
    if (ls.length && ls.every(l => l.kind === 'dead')) say('스위치를 올렸지만… 형광등이 모두 나갔다', 2400);
    else if (!FL.switchTip) { FL.switchTip = true; toast('형광등을 켰습니다', '불이 켜진 방에는 그것이 쉽게 들어오지 못한다 — 대신 멀리서도 눈에 띈다', 'info'); }
  }
  P.noiseT = Math.max(P.noiseT || 0, .4);
}
const syncSwitches = () => world.props.forEach(p => { if (p.kind === 'switch') flipSwitch(p, p.on); });
// 지금 위치가 켜진 방 안인지 (그것은 밝은 방을 꺼린다)
function litAt(f, x, z) {
  const F = floors[f]; if (!F) return false;
  return F.lamps.some(l => l.room && !l.off && l.kind !== 'dead' && Math.abs(l.x - x) < 3.6 && Math.abs(l.z - z) < 4.2) && blackout <= 0;
}

/* ---------- 수영장의 기억 (EV-17~19): 플래시백 → 관람석의 소녀 → 선택 → (도망) 추격 ---------- */
async function poolFlashback() {
  storyCalm(120); $('memTint').classList.add('on'); fx.glitch(.5); sfx.drip(); setFace('fear', 3);
  caption('…물방울이 거꾸로 떨어진다. 물이 가득하던 그날의 수영장');
  for (let k = 0; k < 40; k++) fx.emit(-46 + Math.random() * 8, floors[6].y0 - 1.3, 33 + Math.random() * 12, 0, 1.5 + Math.random(), 0, 1.6, [.6, .9, .95], .3, .03, -2);
  line('echo1'); await wait(5600); line('echo2'); await wait(4200);
  $('memTint').classList.remove('on'); addClue('pool3'); FL.mem3 = true;
  toast('기억 조각을 얻었다', '물이 가득하던 수영장 — 관람석에서 누군가 이쪽을 내려다본다', 'opt');
  showApparition(6, -48.6, 40, Math.atan2(P.x + 48.6, P.z - 40), 40, null); sfx.whisper(); await wait(2000);
  if (state !== 'playing' || P.floor !== 6) { apparT = .3; return; }
  const i = await choose('관람석의 소녀', '젖은 머리카락 사이로, 교복 차림의 소녀가 당신을 내려다본다.', [{ label: '사과한다', sub: '“미안해. 아무도 너를 찾으러 오지 않았어.”' }, { label: '묻는다', sub: '“그날 밤, 무슨 일이 있었어?”' }, { label: '도망친다', sub: '지금 당장 이곳을 벗어난다' }]);
  apparT = .4; FL.girl = ['sorry', 'ask', 'run'][i];
  if (i === 0) { subtitle('하늘', '…괜찮아. 이제, 누군가는 알잖아.', 4.5); storyCalm(160); setFace('calm', 3); }
  else if (i === 1) { subtitle('하늘', '그날 밤, 문은 밖에서 잠겨 있었어. 열쇠는… 선생님 주머니에 있었고.', 5.5); addClue('girl'); storyCalm(110); }
  else {
    sfx.screech(); shake = .6; fx.glitch(.6); caption('그것이 관람석에서 뛰어내렸다 — 출구로 달려!');
    if (ghost.active && !ghost.enraged) Object.assign(ghost, { floor: 6, x: -47.2, z: 40, state: 'chase', target: { x: P.x, z: P.z }, spawnGrace: 2.5, calmT: 0, visitT: 0, chaseT: 0, path: [], replan: 0, hunt: null });
  }
  save(true);
}

/* ---------- 교실의 기억 (수집 요소) ---------- */
const MEM_TOTAL = () => world.props.filter(p => p.kind === 'clue').length;
const memCount = () => world.props.filter(p => p.kind === 'clue' && p.done).length;
function readMemory(p) {
  p.done = true; p.mesh.visible = false; sfx.paper(); setTimeout(() => sfx.whisper(), 500);
  const n = memCount(), tot = MEM_TOTAL();
  showNote({ title: `${p.title} — 교실의 기억 ${n}/${tot}`, text: (MEMORIES[p.room] || p.state) + `<br><br><span style="color:#9a9488">(${p.room} · ${p.state})</span>` });
  if (n % 3 === 0 || n === tot) {
    const r = n === tot ? { medkit: 1, battery: 2 } : n / 3 % 2 ? { battery: 1 } : { medkit: 1 };
    Object.entries(r).forEach(([k, v]) => { inv[k] = (inv[k] || 0) + v; });
    setTimeout(() => toast(n === tot ? '교실의 기억을 모두 모았다' : `교실의 기억 ${n}/${tot}`, '누군가 남겨 둔 보급품을 찾았다 — ' + Object.entries(r).map(([k, v]) => `${ITEMS[k].name} ×${v}`).join(', '), 'opt'), 1200);
  } else setTimeout(() => toast('교실의 기억', `${n}/${tot} — 교실마다 그날의 흔적이 하나씩 남아 있다`, 'info'), 1200);
  refreshHud(); save(true);
}

/* ---------- 퍼즐 · 장치 ---------- */
let power = false, consoleCD = 0, kpBuf = '', kpProp = null;
const setTarget = t => { target = t; };
async function useProp(p) {
  if (p.kind === 'switch') { flipSwitch(p, !p.on, true); return; }
  if (p.kind === 'elevator') { rideElevator(p); return; }
  if (p.kind === 'robj') { useRoomObj(p); return; }
  if (p.kind === 'guardnpc') { talkGuard(p); return; }
  if (p.kind === 'sq') { p.main ? useHead(p) : useSideQuest(p); return; }
  if (p.kind === 'search') { startSearch(p); return; }
  if (p.kind === 'mspot') { useMiniSpot(p); return; }
  if (p.kind === 'chalk') { openChalk(p); return; }
  if (p.kind === 'clue') { readMemory(p); return; }
  if (p.kind === 'cctvRec') { p.label = 'CCTV 다시 보기'; sfx.staticNoise(1.2); fx.glitch(.5); showNote({ title: 'CCTV 녹화 — 10.12 23:31 · B1 복도', img: 'b1_corr', text: '정지 화면이 지직거린다. 복도 끝 <b>배수실</b> 쪽에서 누군가 바닥의 <b>철제 덮개</b>를 끌어 덮고 있다.<br>23:33 — 화면이 검게 끊긴다. 마지막 프레임, 렌즈 바로 앞에 젖은 손바닥 자국.' }); addClue('cctv'); return; }
  if (p.kind === 'footprints') { p.done = true; poolFlashback(); return; }
  if (p.kind === 'safe') {
    if (p.open > 0) return;
    kpProp = p; kpBuf = ''; $('kpTitle').textContent = '교무실 금고'; if (!p.fails) $('kpHint').textContent = '숫자 키 · Enter · Backspace 사용 가능'; renderKeypad(); openUI('keypad'); sfx.beep();
  } else if (p.kind === 'sink') { useSink(p);
  } else if (p.kind === 'flush') { useFlush(p);
  } else if (p.kind === 'cbreaker') { useCBreaker(p);
  } else if (p.kind === 'pick') { usePick(p);
  } else if (p.kind === 'breaker') {
    if (!FL.fuse) { sfx.click(); talk('needFuse', 3200); say('퓨즈 홀더가 비어 있다 — 예비 퓨즈가 필요하다', 2800); addClue('fuse'); return; }
    if (!p.fused) { sfx.fuse(); p.fused = true; toast('퓨즈를 끼웠습니다', '배선을 이어 전원을 살려라'); }
    const r = await mini('circuit', { title: '주 차단기 — 배선 연결' }); if (!r.ok) return;
    p.on = true; p.done = true; power = true; sfx.breaker(); shake = .5; P.noiseT = 2.5;
    blackout = Math.max(blackout, .7); GEN.dip = null; GEN.t = 160; setTimeout(() => { sfx.lightOn(); caption('발전기가 멈추고 본전원으로 넘어갔다 — 형광등이 하얗게 안정된다'); }, 800);
    toast('전력이 복구되었습니다', '3층 방송실 장비를 쓸 수 있다. 큰 소리가 났다…', 'warn');
    talk('breaker', 3200); addClue('power'); refreshHud();
    if (ghost.active && ghost.floor === P.floor) { ghost.state = 'search'; ghost.target = { x: P.x, z: P.z }; ghost.wait = 0; ghost.replan = 0; }
  } else if (p.kind === 'tape') {
    sfx.tape(); p.label = '녹음기 다시 재생'; storyCalm(40);
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
  } else if (p.kind === 'lock') openLock(p);
  else if (p.kind === 'drain') {
    if (!FL.hook) { talk('needHook', 3400); say(FL.mop && FL.wire ? '대걸레 자루와 철사가 있다 — 소지품(Tab)에서 조합해 갈고리를 만들자' : `손이 닿지 않는다 — 갈고리 재료: ${FL.mop ? '' : '대걸레 자루(지하 청소도구실) '}${FL.wire ? '' : '철사(별관 1층 기술·가정실)'}`, 4200); if (!FL.mop || !FL.wire) toast('갈고리 재료', '목표 안내와 지도(M)에 재료 위치를 표시했다', 'info'); if (!docs.some(d => d.id === 'n20')) toast('단서', '수영장 감시대 위 메모를 확인해 보자', 'info'); return; }
    const r = await mini('fishing', {}); if (!r.ok) { say('갈고리가 미끄러졌다… 다시 해 보자', 2000); return; }
    p.done = true; sfx.splash(); const it = world.items.find(i => i.kind === 'key' && i.idx === 4);
    it.locked = false; setTarget({ type: 'item', it, label: '' }); interact();
  } else if (p.kind === 'piano') {
    const r = await mini('piano', { melody: [4, 4, 5, 5, 4, 4, 2], sheet: (docs.some(d => d.id === 'n18') || (p.fails || 0) >= 2) ? '솔 솔 라 라 솔 솔 미' : null, onFail: () => { p.fails = (p.fails || 0) + 1; } });
    if (!r.ok) return;
    p.done = true; sfx.drip(); talk('pianoOk', 3000); inv.battery++; inv.hairpin++; newItems.add('hairpin');
    addDoc({ id: 'p4', kind: 'photo' }); addClue('piano'); unlockOptional();
    toast('피아노 속 숨은 칸', '사진 — 방송부 앨범 · 건전지 · 머리핀'); refreshHud(); save(true);
    setTimeout(() => { if (state === 'playing') showNote({ ...world.PHOTOS.p4, kind: 'photo' }); }, 900);
  } else if (p.kind === 'easel') {
    const r = await mini('slide', { img: 'assets/img/old_lab.webp', title: '찢어진 사진 맞추기' });
    if (!r.ok) return;
    p.done = true; talk('slideOk', 3000); inv.medkit++; newItems.add('medkit'); addDoc({ id: 'p5', kind: 'photo' }); unlockOptional();
    toast('그림 뒤에서', '사진 — 과학실 (10년 전) · 응급 밴드'); refreshHud(); save(true);
    setTimeout(() => { if (state === 'playing') showNote({ ...world.PHOTOS.p5, kind: 'photo' }); }, 900);
  } else if (p.kind === 'phone') {
    p.done = true; p.ring = false; sfx.click(); fx.glitch(.5); shake = .3;
    line('gh1', 'phone', '📞 ???'); setTimeout(() => { if (state === 'playing') talk('steps', 2400); }, 3200);
  } else if (p.kind === 'mina') {
    npcVisuals.portrait('mina', '민아 · 방송부장', 4500);
    if (!FL.calm) {
      talk(p.tried ? 'minaAsleep' : 'minaFound', 3200); p.tried = true; say('숨은 쉬고 있다… 무언가가 아직 그녀를 붙잡고 있다.', 3000); unlockOptional();
      if (npcVisuals.has(mina)) { npcVisuals.setExpression(mina, 'Pain', .6); setTimeout(() => npcVisuals.setExpression(mina, 'Pain', 0), 1800); }   // 잠결에 얼굴을 찌푸린다
      return;
    }
    p.done = true; FL.mina = true; sfx.paper();
    line(`mw_${CK()}`, 'none', '민아').then(sec => setTimeout(() => { talk('withMina', 3000); }, (sec + .5) * 1000));
    minaWake(); addClue('mina'); toast('민아를 찾았습니다', '함께 정문으로 — 진 엔딩 조건 달성', 'opt'); refreshHud(); save(true);
  }
}
// 진 엔딩 루트: 명찰을 가진 채 방송 → 하늘의 하교 방송 → 그것이 사라진다
async function haneulBroadcast() {
  if (!FL.tapesDone) {
    const r = await mini('order', { title: '마지막 방송 — 그날 밤의 녹음 복원', frags: TAPE_FRAGS, showTimes: tlKnown() >= 6, onFail: () => { FL.tapeFails = (FL.tapeFails || 0) + 1; } });
    if (!r.ok) { say('녹음 순서가 맞지 않는다… 휴대폰의 사건 연표를 떠올려 보자', 2800); return; }
    FL.tapesDone = true; save(true);
  }
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
// 민아 깨우기: 3D 모델이면 깨어남(이마 짚기 · 두리번) → 일어서기 → 안도 표정 뒤 사라짐. 아니면 바로 사라짐
async function minaWake() {
  if (!npcVisuals.has(mina)) { fadeOut(mina, 1.2); fadeOut(minaProps, 1.2); return; }
  const E = (n, v) => npcVisuals.setExpression(mina, n, v);
  E('Asleep', 0); mina.userData.noBlink = false; E('Pain', .55);
  await npcVisuals.play(mina, 'Recovery', { once: true, fade: .4 });
  E('Pain', 0); E('Sad', .35);
  await npcVisuals.play(mina, 'StandUp', { once: true, fade: .25 });
  E('Sad', 0); E('Relief', .8); npcVisuals.play(mina, 'Idle', { fade: .4 });
  setTimeout(() => { fadeOut(mina, 1.4); fadeOut(minaProps, 1.4); }, 1600);
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
  if (kpProp.code) {   // 제4장 별관 진열장 (전자식 잠금)
    const p = kpProp.prop;
    if (kpBuf === kpProp.code) { $('kpDisp').textContent = 'O P E N'; $('kpDisp').className = 'ok'; sfx.unlock(); setTimeout(() => { closeUI(); headAdvance(p); }, 700); return; }
    $('kpDisp').textContent = 'E R R'; $('kpDisp').className = 'err'; sfx.buzz(); kpBuf = ''; setTimeout(renderKeypad, 700);
    p.fails = (p.fails || 0) + 1;
    $('kpHint').innerHTML = p.fails >= 3 ? '힌트 ③ 머릿돌: 1974년 <b>3월 2일</b> 개교 → 0 3 0 2' : p.fails === 2 ? '힌트 ② 별관 현관의 <b>개교 머릿돌</b> — 월일 4자리' : '힌트 ① 교장 수첩: 잠금 번호는 <b>“이 학교가 태어난 날”</b>';
    return;
  }
  if (kpBuf === '1012') {
    $('kpDisp').textContent = 'O P E N'; $('kpDisp').className = 'ok'; sfx.unlock();
    setTimeout(() => { closeUI(); kpProp.opening = true; kpProp.done = true; kpProp.key.locked = false; kpProp.key.mesh.visible = true; toast('금고가 열렸다', '안에 열쇠 조각이 있다'); talk('safeOpen', 3000); addClue('safe'); }, 700);
  } else {
    $('kpDisp').textContent = 'E R R'; $('kpDisp').className = 'err'; sfx.buzz(); kpBuf = '';
    setTimeout(renderKeypad, 700);
    kpProp.fails = (kpProp.fails || 0) + 1;
    if (kpProp.fails === 1) setTimeout(() => talk('safeHint', 3000), 900);
    $('kpHint').innerHTML = kpProp.fails >= 3 ? '힌트 ③ 달력의 붉은 동그라미 — <b>10월 12일</b> → 1 0 1 2' : kpProp.fails === 2 ? '힌트 ② 교무회의록: 비밀번호는 <b>그날의 날짜</b> (월일 4자리)' : '힌트 ① 그날… 무슨 날이었지? 교무실 어딘가에 기록이 있을 것이다';
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
function showApparition(f, x, z, yaw, dur, watch) { evFx('evPulse'); appar.position.set(x, floors[f].y0 + .08, z); appar.rotation.y = yaw; appar.visible = true; appar.userData.floor = f; apparT = dur; apparWatch = watch || null; }
const EV = { done: new Set(), t: 0, inRoom: null, roomT: 0, slamCD: 60, b33T: 0, b33: 0, corrT: 0 };
const evOnce = (id, fn) => { if (EV.done.has(id)) return false; EV.done.add(id); fn(); return true; };
function roomAt(f, x, z) {
  // 본관 남쪽 방 줄 (복도 남쪽, z 1.75 ~ 9.6)
  if (z > 1.8 && z < MAIN_ZS - .3 && f >= 0 && f <= 2) { const i = SLOTS.findIndex(c => Math.abs(x - c) < 4); if (i < 0) return null; const L = LAYOUT_S[f]; return { type: L.types[i], name: L.names[i], cx: SLOTS[i], id: f + ':s' + i, south: true }; }
  if (z > 1.8 && z < MAIN_ZS - .3 && f >= 8 && f <= 10) { const i = ANNEX.slots.findIndex(c => Math.abs(x - c) < 4); if (i < 0) return null; const L = ANNEX_S[f - 8]; return { type: L.types[i], name: L.names[i], cx: ANNEX.slots[i], id: f + ':s' + i, south: true }; }
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
  msgs.push({ id, t: clockText(), read: false }); storyCalm(35); sfx.phone(); toast('📱 새 메시지 — 민아', '신호가 없는데 메시지가 도착했다 (P: 휴대폰)', 'info');
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
  updateEvents2(dt);
  EV.t -= dt; if (EV.t > 0) return; EV.t = .2; const step = .2;
  const f = P.floor, room = roomAt(f, P.x, P.z);
  moreEvents(f, room, step); psych(f, room, step); toiletTick(f, room, step);
  // 방에 들어온 시간
  if (room && EV.inRoom === room.id) EV.roomT += step; else { EV.inRoom = room ? room.id : null; EV.roomT = 0; }
  EV.slamCD -= step;
  // ① 문이 저절로 닫힌다
  if (room && EV.roomT > 3.5 && EV.slamCD <= 0 && P.z < -3) {
    const d = world.doorList.find(o => o.kind === 'slide' && o.floor === f && Math.abs(o.x - room.cx) < .1 && o.target > .5);
    if (d && Math.random() < .35) { d.target = 0; d.slam = true; sfx.doorBang(0, .9); caption('문이 쾅 닫힌다'); shake = .45; EV.slamCD = 100 + Math.random() * 80; setTimeout(() => talk('doorSlam', 2400), 500); }
    else EV.slamCD = 8;
  }
  // ② 음악실 피아노
  if (room && room.type === 'music') evOnce('piano' + f, () => { sfx.piano(); caption('피아노가 혼자 울린다'); setTimeout(() => talk('piano', 2800), 1200); });
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
    setTimeout(() => { if (state !== 'playing') return; sfx.lightsOff(); blackout = 4.2; caption('형광등이 하나씩 꺼진다'); [14, 10, 7, 4.5, 3].forEach((d, i) => setTimeout(() => sfx.ghostStep(d, .4), 700 + i * 550)); setTimeout(() => talk('steps', 2600), 4400); }, 1500);
  });
  // ⑦ 체육관 · 수영장 · 급식실 입장
  if (f === 5) evOnce('gym', () => { sfx.ball(); setTimeout(() => talk('ball', 2800), 2400); });
  if (f === 6) evOnce('pool', () => { sfx.drip(); setTimeout(() => { sfx.splash(); }, 5200); });
  // ⑧ 방송실 도착 시 두 번째 메시지
  if (room && room.type === 'broadcast') evOnce('bcMsg', () => setTimeout(() => phoneMessage(2), 4000));
}

/* ---------- 이야기 오브젝트: 민아의 캠코더 · 윤하늘의 명찰 · 장비실의 민아 ---------- */
function storyItem(kind, f, x, y, z, mesh, label, glowColor) {
  const F = floors[f]; mesh.position.set(x, y, z); mesh.userData.dynamic = true; F.interior.add(mesh);   // interior 는 이미 y0 만큼 올라가 있다
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
const mina = new THREE.Group(), minaProps = new THREE.Group();
// 민아 (서브 캐릭터 시트): 17세 · 162cm · 남색 블레이저(교표) · 흰 셔츠 · 버건디 리본 · 남색/버건디 체크 플리츠 스커트 · 흰 양말 · 검정 로퍼
// 낮게 묶은 포니테일 + 앞머리 · 검정 백팩(토끼 키링) · 손전등 · 작은 노트 · 스마트폰 — 장비실 벽에 기대 잠든 자세
{
  const F = floors[2], M = (c, r = .8, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...o });
  const plaid = (() => { const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
    g.fillStyle = '#2a2f45'; g.fillRect(0, 0, N, N); g.globalAlpha = .55; g.fillStyle = '#6a2232'; [8, 72].forEach(v => { g.fillRect(v, 0, 14, N); g.fillRect(0, v, N, 14); });
    g.globalAlpha = .35; g.fillStyle = '#9a9aa8'; [40, 104].forEach(v => { g.fillRect(v, 0, 3, N); g.fillRect(0, v, N, 3); }); g.globalAlpha = .25; g.fillStyle = '#c8b070'; [56, 120].forEach(v => { g.fillRect(v, 0, 2, N); g.fillRect(0, v, N, 2); });
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const navy = M(0x1a1f30, .78), shirt = M(0xe6e2da, .8), skin = M(0xe2bfa8, .55), hairM = M(0x1c1410, .5), skirt = M(0xffffff, .9, { map: plaid, side: THREE.DoubleSide });
  const ribbon = M(0x6e1a28, .55), sock = M(0xe8e6e0, .85), loafer = M(0x0c0c0e, .3, { metalness: .1 }), bagM = M(0x16171a, .75), gold = M(0xb89850, .4, { metalness: .6 });
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); mina.add(o); return o; };
  const cap = (r, h, m, x, y, z, rx = 0, ry = 0, rz = 0) => add(new THREE.CapsuleGeometry(r, h, 6, 12), m, x, y, z, rx, ry, rz);
  // 앉은 하체: 플리츠 스커트(주름 원뿔) · 무릎을 세운 다리 · 흰 양말 · 로퍼
  add(new THREE.CylinderGeometry(.17, .27, .2, 24, 1, true), skirt, 0, .12, .06, -.25);
  [-1, 1].forEach(s => {
    cap(.058, .3, skin, s * .1, .26, .26, Math.PI / 2 - .55);   // 허벅지 → 무릎
    cap(.05, .28, skin, s * .1, .2, .5, .55);                  // 정강이
    add(new THREE.CylinderGeometry(.052, .048, .14, 10), sock, s * .1, .07, .6, .2);
    add(new THREE.BoxGeometry(.085, .06, .22), loafer, s * .1, .03, .67);
  });
  // 상체 (벽에 기대 고개를 떨군 자세)
  const torso = new THREE.Group(); torso.position.set(0, .22, -.05); torso.rotation.x = -.22; mina.add(torso);
  const tadd = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); torso.add(o); return o; };
  tadd(new THREE.CapsuleGeometry(.15, .22, 6, 14), navy, 0, .24, 0).scale.set(1.08, 1, .72);   // 블레이저
  tadd(new THREE.BoxGeometry(.11, .2, .02), shirt, 0, .32, .105);
  [-1, 1].forEach(s => tadd(new THREE.BoxGeometry(.06, .2, .015), navy, s * .065, .3, .11, 0, 0, s * .25));  // 라펠
  [-1, 1].forEach(s => tadd(new THREE.ConeGeometry(.035, .07, 4), ribbon, s * .035, .4, .125, 0, 0, s * Math.PI / 2));   // 리본 양쪽
  tadd(new THREE.SphereGeometry(.018, 8, 6), ribbon, 0, .4, .13);
  tadd(new THREE.CircleGeometry(.022, 12), gold, -.085, .36, .113);   // 교표
  [-1, 1].forEach(s => { const arm = tadd(new THREE.CapsuleGeometry(.045, .3, 6, 10), navy, s * .19, .2, .08, -.7, 0, s * .2); tadd(new THREE.SphereGeometry(.04, 10, 8), skin, s * .16, .02, .24); });
  tadd(new THREE.CylinderGeometry(.04, .045, .07, 10), skin, 0, .45, 0);
  const head = tadd(new THREE.SphereGeometry(.1, 20, 16), skin, .02, .56, .03, .45, 0, .25); head.scale.set(.88, 1.08, .95);
  tadd(new THREE.SphereGeometry(.112, 20, 14, 0, Math.PI * 2, 0, Math.PI * .58), hairM, .02, .585, .01, .3, 0, .25);   // 머리
  tadd(new THREE.BoxGeometry(.17, .07, .03), hairM, .03, .6, .11, .7, 0, .25);   // 앞머리
  [-1, 1].forEach(s => tadd(new THREE.BoxGeometry(.03, .16, .05), hairM, .02 + s * .085, .5, .05, .3, 0, .25));   // 옆머리
  tadd(new THREE.CapsuleGeometry(.035, .2, 6, 8), hairM, -.02, .44, -.1, .5, 0, .1);   // 낮게 묶은 포니테일
  // 소품: 백팩(토끼 키링) · 바닥의 손전등(희미하게 켜짐) · 노트 · 스마트폰(화면 빛)
  add(new THREE.BoxGeometry(.3, .38, .16), bagM, .38, .19, .1, 0, -.4).geometry.translate(0, 0, 0);
  add(new THREE.BoxGeometry(.22, .14, .05), bagM, .43, .14, .2, 0, -.4);
  add(new THREE.SphereGeometry(.035, 10, 8), M(0xf0c8cc, .9), .5, .3, .25); add(new THREE.SphereGeometry(.022, 8, 6), M(0xf0c8cc, .9), .5, .35, .25);
  [-1, 1].forEach(s => add(new THREE.CapsuleGeometry(.008, .03, 4, 6), M(0xf0c8cc, .9), .5 + s * .012, .385, .25));   // 토끼 귀
  // 바닥 소품은 따로 둔다 (3D 모델로 바뀌어도 남는다): 오른손 옆 손전등(희미하게 켜짐) · 발치의 스마트폰(화면 빛) · 왼쪽 노트
  const padd = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); minaProps.add(o); return o; };
  const fl = padd(new THREE.CylinderGeometry(.022, .03, .2, 12), M(0x1a1a1a, .4, { metalness: .5 }), -.5, .03, .18, 0, 0, Math.PI / 2); fl.rotation.y = .6;
  padd(new THREE.CircleGeometry(.026, 12), new THREE.MeshBasicMaterial({ color: 0xffe8c0 }), -.42, .03, .24, 0, -1.0);
  padd(new THREE.BoxGeometry(.12, .015, .16), M(0x5a6a4a, .8), .36, .008, .5, 0, .3);   // 작은 노트
  padd(new THREE.BoxGeometry(.07, .008, .14), M(0x111216, .3), -.2, .006, .78, 0, -.2); padd(new THREE.PlaneGeometry(.06, .12), new THREE.MeshBasicMaterial({ color: 0x8ab4e8 }), -.2, .012, .78, -Math.PI / 2, 0, .2);
  mina.position.set(-21.65, 0, -8.45); mina.userData.dynamic = true; F.interior.add(mina);   // interior 그룹이 이미 층 높이(y0)만큼 올라가 있다
  minaProps.position.copy(mina.position); minaProps.userData.dynamic = true; F.interior.add(minaProps);
  [mina, minaProps].forEach(g => g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }));
  world.props.push({ kind: 'mina', floor: 2, x: -21.65, z: -7.9, y: .8, label: '민아 깨우기' });
  // 3D 모델(162cm 실제 크기 · native): 서 있는 몸 그대로 '벽에 기대 앉기' 동작으로 앉힌다 — 크기를 앉은 키에 맞춰 줄이지 않는다(비율 왜곡 없음)
  // offset z: 앉은 자세의 백팩 뒷면이 장비 랙 앞면(z -8.94)에 닿도록
  npcLoad('mina', mina, { url: 'assets/characters/mina.glb', native: true, offset: [0, 0, .36], clipNames: ['sittingagainstwall'],
    onLoad: () => { mina.userData.noBlink = true; npcVisuals.setExpression(mina, 'Asleep', 1); } });
}

/* ---------- 추가 상호작용 오브젝트: 잠긴 보관함 · 다이얼 · 배수구 · 피아노 · 그림 · 도구 ---------- */
const metalM = new THREE.MeshStandardMaterial({ color: 0x4a5258, roughness: .45, metalness: .65 });
const brassM = new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: .35, metalness: .8 });
const paperM = new THREE.MeshStandardMaterial({ color: 0xd8d0b4, roughness: .95, side: THREE.DoubleSide });
function addNoteAt(id, f, x, y, z, ry = 0) {
  const F = floors[f], n = world.NOTES[id], m = new THREE.Mesh(new THREE.PlaneGeometry(.3, .22), paperM);
  m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, y + .012, z); m.userData.dynamic = true; F.interior.add(m);
  world.items.push({ kind: 'note', id, floor: f, pos: new THREE.Vector3(x, F.y0 + y, z), mesh: m, title: n.title, text: n.text, taken: false, label: '쪽지 읽기' });
}
// 잠긴 금속 보관함: type 'pick'(맹꽁이 자물쇠) | 'dial'(다이얼 자물쇠). keyIdx 가 있으면 열쇠 조각을 안에 숨긴다
function lockBox(f, x, y, z, ry, type, o = {}) {
  const F = floors[f], g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.userData.dynamic = true; F.interior.add(g);
  const body = new THREE.Mesh(new THREE.BoxGeometry(.38, .14, .26), metalM); body.position.y = .07; g.add(body);
  const lid = new THREE.Group(); lid.position.set(0, .14, -.13); g.add(lid);
  const lm = new THREE.Mesh(new THREE.BoxGeometry(.39, .05, .27), metalM); lm.position.set(0, .025, .135); lid.add(lm);
  const hasp = new THREE.Mesh(new THREE.BoxGeometry(.05, .07, .015), brassM); hasp.position.set(0, .1, .14); g.add(hasp);
  const lock = new THREE.Group(); lock.position.set(0, .06, .15); g.add(lock);
  lock.add(new THREE.Mesh(new THREE.BoxGeometry(.07, .07, .03), type === 'dial' ? new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: .4, metalness: .6 }) : brassM));
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(.025, .007, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0xc0c0c8, metalness: .9, roughness: .3 })); shackle.position.y = .035; lock.add(shackle);
  if (type === 'dial') for (let k = 0; k < 3; k++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .02, 10).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a8a90, metalness: .8, roughness: .3 })); w.position.set(0, -.015, .018 + 0); w.position.x = -.02 + k * .02; lock.add(w); }
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  const p = { kind: 'lock', lockType: type, floor: f, x, z, y: y + .1, lid, lockMesh: lock, label: o.label || (type === 'dial' ? '다이얼 자물쇠 맞추기' : '잠긴 보관함 따기'), ...o };
  if (o.keyIdx != null) {
    const it = world.items.find(i => i.kind === 'key' && i.idx === o.keyIdx);
    it.locked = true; it.mesh.visible = false; it.mesh.position.set(x, y + .2 - (it.pos.y - F.y0 - it.mesh.position.y), z); it.pos.set(x, F.y0 + y + .2, z); p.keyItem = it;
  }
  world.props.push(p); return p;
}
function openLockVisual(p) {
  p.done = true; p.lockMesh.visible = false;
  let t = 0; const iv = setInterval(() => { t = Math.min(1, t + .08); p.lid.rotation.x = -t * 1.9; if (t >= 1) clearInterval(iv); }, 30);
  if (p.keyItem && !p.keyItem.taken) { p.keyItem.locked = false; p.keyItem.mesh.visible = true; }
}
const tool = (kind, f, x, y, z, mesh, label, col) => storyItem(kind, f, x, y, z, mesh, label, col);
const canM = new THREE.MeshStandardMaterial({ color: 0xb02a28, roughness: .4, metalness: .6 });
const mkCan = () => { const g = new THREE.Group(), c = new THREE.Mesh(new THREE.CylinderGeometry(.033, .033, .12, 12), canM); c.rotation.z = Math.PI / 2; c.position.y = .033; g.add(c); g.rotation.y = Math.random() * 6; return g; };
const mkPin = () => { const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x1e1e22, metalness: .8, roughness: .35 }); [-.006, .006].forEach((o, i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(.07 - i * .01, .003, .003), m); b.position.set(i * .005, .003, o); g.add(b); }); const pearl = new THREE.Mesh(new THREE.SphereGeometry(.007, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe8d8e0, roughness: .2 })); pearl.position.set(-.035, .006, 0); g.add(pearl); g.rotation.y = Math.random() * 6; return g; };
const mkFuse = () => { const g = new THREE.Group(); const gl = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .06, 10).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc8e0e8, roughness: .05, transparent: true, opacity: .6 })); gl.position.y = .013; g.add(gl); [-.034, .034].forEach(x => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.013, .013, .012, 10).rotateZ(Math.PI / 2), brassM); c.position.set(x, .013, 0); g.add(c); }); return g; };
const mkMop = () => { const g = new THREE.Group(), m = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, 1.3, 8).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a6a40, roughness: .8 })); m.position.y = .016; g.add(m); g.rotation.y = .4; return g; };
const mkWire = () => { const g = new THREE.Group(), m = new THREE.Mesh(new THREE.TorusGeometry(.06, .006, 6, 24), new THREE.MeshStandardMaterial({ color: 0x9a9aa0, metalness: .85, roughness: .35 })); m.rotation.x = Math.PI / 2; m.position.y = .01; g.add(m); const m2 = m.clone(); m2.scale.setScalar(.8); m2.position.y = .02; g.add(m2); return g; };
// 쪽지 (단서)
addNoteAt('n19', 0, SLOTS[8], .02, -7.25, .3);   // 도서실
addNoteAt('n17', 1, SLOTS[8] + 2.6, .92, -5.3, -.2);   // 과학실
addNoteAt('n18', 2, SLOTS[8] - 2.6, .02, -6.3, .5);    // 음악실 악보
addNoteAt('n20', 6, -35.8, 1.68, 44, .2);   // 수영장 감시대
addNoteAt('n21', 0, 5.5, .02, 1.2, .4);                       // 1층 복도 — 행사 안내문
addNoteAt('n22', 4, SLOTS[5] + 2.65, .77, -7.5, .2);           // 지하 기록실 — 봉인 서약서
addNoteAt('n23', 9, ANNEX.slots[4], .02, -3.0, -.3);          // 별관 2F 동아리실 — 방송부원 진술서
addNoteAt('n24', 8, ANNEX.slots[4], .02, -3.0, .5);           // 별관 1F 진로상담실 — 경비 일지
addNoteAt('n25', 9, ANNEX.slots[2], .02, -3.0, .1);           // 별관 2F 언어실 — 사서의 메모
addNoteAt('nC', 2, SLOTS[1] + .8, .02, -3.0, -.4);            // 방송실 — 캐릭터 전용 기록
addNoteAt('n29', 0, SLOTS[7] + 2.6, .76, -8.6, .2);           // EV-04 1-3 교실 교사용 책상 — 첫 번째 메모
addNoteAt('n27', 2, SLOTS[5] + 2.6, .76, -8.6, .3);           // 3-4 교실 교사용 책상 — 담임 수첩
addNoteAt('n28', 2, SLOTS[6] - 2.9, .02, -2.3, .6);           // 3-5 교실 사물함 앞 — 교환일기
addNoteAt('n26', 0, SLOTS[8] - .9, .77, -8.45, .1);           // 도서실 — 이벤트로 나타나는 대출 카드
{ const it = world.items.find(i => i.kind === 'note' && i.id === 'n26'); it.locked = true; it.mesh.visible = false; }
// 도구 · 소모품
tool('hairpin', 0, SLOTS[1] - 2.4, .66, -8.0, mkPin(), '머리핀 줍기', 0xffd0e0);          // 보건실 침대
tool('hairpin', 1, SLOTS[1] + 2.3, .77, -8.45, mkPin(), '머리핀 줍기', 0xffd0e0);         // 2-1 교탁
tool('hairpin', 6, -37.6, .45, 28.3, mkPin(), '머리핀 줍기', 0xffd0e0);                   // 여자 탈의실 벤치
tool('fuse', 4, SLOTS[7] - 1.5, .91, -4.15, mkFuse(), '예비 퓨즈 줍기', 0xa0e0ff);          // 지하 기계실 정비 작업대
tool('mop', 4, SLOTS[6] - 1.0, .02, -6.8, mkMop(), '대걸레 자루 줍기', 0xffe0a0);          // 지하 청소도구실
tool('wire', 8, ANNEX.slots[2] + 2.9, .77, -4.8, mkWire(), '철사 뭉치 줍기', 0xffe0a0);    // 별관 기술·가정실
[[0, -20, -1.25], [0, 12, -1.25], [1, -4, -1.25], [1, 28, -1.25], [2, 4, -1.25], [2, -30, -1.25], [5, 35, 25], [7, -36, 18.5]].forEach(([f, x, z]) => tool('can', f, x, .0, z, mkCan(), '빈 캔 줍기', 0xffffff));
// 열쇠 조각을 지키는 자물쇠들
lockBox(0, SLOTS[8] + .6, .75, -8.6, 0, 'pick', { keyIdx: 1, label: '대출 데스크 서랍 따기', tol: 10 });
lockBox(1, SLOTS[8] - 2.4, .92, -4.8, Math.PI / 2, 'dial', { keyIdx: 2, code: '314', label: '약품장 다이얼 자물쇠', clue: 'n17', clueText: '칠판 메모 — 원주율 앞 세 자리' });
lockBox(5, 29.2, .8, 20.6, Math.PI / 2, 'dial', { keyIdx: 3, code: '0723', label: '기구함 다이얼 자물쇠', clue: 'n9', clueText: '체육 일지 — 전광판의 마지막 경기 점수' });
// 덤 보관함 (머리핀으로 따면 보급품)
lockBox(1, SLOTS[6] + 2.2, .76, -8.6, 0, 'pick', { loot: { battery: 2, can: 1 }, tol: 8 });
lockBox(2, SLOTS[5] + 2.2, .76, -8.6, 0, 'pick', { loot: { medkit: 1, battery: 1 }, tol: 7 });
// 수영장 배수구: 열쇠 조각이 바닥 배수구 철망 아래에 빠져 있다
{
  const F = floors[6], it = world.items.find(i => i.kind === 'key' && i.idx === 4);
  it.mesh.position.set(-41.5, -1.6 + .05, 44.85); it.pos.set(-41.5, F.y0 - 1.55, 44.85); it.locked = true;
  const grate = new THREE.Mesh(new THREE.PlaneGeometry(.6, .6), new THREE.MeshStandardMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#6a6a6a'; g.lineWidth = 3; for (let k = 4; k < 64; k += 10) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 64); g.stroke(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(), metalness: .6, roughness: .5, transparent: true, alphaTest: .1 }));
  grate.rotation.x = -Math.PI / 2; grate.position.set(-41.5, -1.58, 44.85); grate.userData.dynamic = true; F.interior.add(grate);
  world.props.push({ kind: 'drain', floor: 6, x: -41.5, z: 46.1, y: 0, label: '배수구 들여다보기' });
}
world.props.push({ kind: 'cctvRec', floor: 2, x: SLOTS[1] - 1.3, z: -7.0, y: 1.0, label: 'CCTV 녹화 화면 보기' });   // EV-10
world.props.push({ kind: 'footprints', floor: 6, x: -46.6, z: 46.9, y: .1, label: '젖은 발자국 조사' });            // EV-17
{ const fm = new THREE.MeshBasicMaterial({ color: 0x0a1012, transparent: true, opacity: .55, depthWrite: false });
  for (let k = 0; k < 9; k++) { const m = new THREE.Mesh(new THREE.CircleGeometry(.07, 10), fm); m.scale.set(1, 1.9, 1); m.rotation.x = -Math.PI / 2; m.rotation.z = .2; m.position.set(-46.6 - k * .12 + (k % 2) * .15, .021, 46.9 - k * .65); m.userData.dynamic = true; floors[6].interior.add(m); } }
world.props.push({ kind: 'piano', floor: 2, x: SLOTS[8] + 2.2, z: -7.1, y: 1, label: '피아노 치기' });
world.props.push({ kind: 'easel', floor: 2, x: SLOTS[7] + 1.0, z: -5.5, y: 1.1, label: '찢어진 그림 맞추기' });
world.PHOTOS.p4 = { img: 'old_music', title: '사진 — 방송부 앨범', text: '음악실 피아노 앞에서 웃고 있는 3학년 2반 윤하늘.<br>뒷면: <b>“기념 방송 반주는 내 몫! — 방송부 하늘”</b>' };
world.PHOTOS.p5 = { img: 'old_lab', title: '사진 — 과학실 (10년 전)', text: '방과 후 과학실. 창가에 교복 차림의 아이가 흐릿하게 서 있다.<br>뒷면: <b>“10.12 담력 체험 — 4명. 하늘이는 빼자고 했는데…”</b>' };

// 미니게임 실행: 게임을 멈추고(사물함처럼 안전) 결과를 돌려준다
async function mini(kind, opts) {
  if (state !== 'playing') return { ok: false };
  storyCalm(20);
  state = 'ui'; for (const k in keys) keys[k] = false; $('prompt').style.display = 'none'; document.exitPointerLock?.();
  const r = await runMini(kind, opts);
  if (state === 'ui') { state = 'playing'; refreshHud(); lock(); }
  return r;
}
async function openLock(p) {
  if (p.lockType === 'pick') {
    if (!inv.hairpin) { sfx.click(); talk('needPin', 3000); say('잠겨 있다 — 머리핀이 있으면 딸 수 있을 것 같다', 2600); return; }
    const r = await mini('lockpick', { pins: () => inv.hairpin, usePin: () => { inv.hairpin = Math.max(0, inv.hairpin - 1); }, tol: p.tol || 9 });
    if (!r.ok) { if (!inv.hairpin) toast('머리핀이 없습니다', '다른 핀을 찾아야 한다', 'warn'); return; }
  } else {
    const known = docs.some(d => d.id === p.clue) || (p.fails || 0) >= 2;
    const hint = (known ? `단서: <b style="color:#e8d8a8">${p.clueText}</b>` : '<span style="color:#a06a6a">번호를 알려 주는 단서가 어딘가에 있을 것이다</span>') + ((p.fails || 0) >= 4 ? `<br>힌트 ③ 첫 자리는 <b>${p.code[0]}</b>` : '');
    const r = await mini('dial', { code: p.code, title: p.label, hint, onFail: () => { p.fails = (p.fails || 0) + 1; if (p.fails === 1) talk('dialWrong', 2400); } });
    if (!r.ok) return;
  }
  openLockVisual(p); sfx.unlock(); talk('unlocked', 2000);
  if (p.loot) { const got2 = []; for (const [k, n] of Object.entries(p.loot)) { inv[k] = (inv[k] || 0) + n; newItems.add(k); got2.push(`${ITEMS[k].name} ×${n}`); } toast('보관함을 열었습니다', got2.join(' · ')); }
  else toast('잠금 해제', '안에 열쇠 조각이 있다');
  refreshHud(); save(true);
}

/* ---------- 빈 캔 던지기: 떨어진 곳의 소리로 그것을 유인 ---------- */
const throws = [];
function throwCan() {
  if (state !== 'playing' || P.hiding) return;
  if (!inv.can) { say('던질 빈 캔이 없다', 1400); return; }
  inv.can--; refreshHud(); sfx.throwIt();
  const F = floors[P.floor], fx2 = -Math.sin(P.yaw), fz2 = -Math.cos(P.yaw), maxD = clamp(6 + P.pitch * 8, 3, 11);
  let d = 0, lx = P.x, lz = P.z;
  while (d < maxD) { const nx = P.x + fx2 * (d + .25), nz = P.z + fz2 * (d + .25); if (!los(F.walls, P.x, P.z, nx, nz) || !los(F.doorWalls || [], P.x, P.z, nx, nz)) break; d += .25; lx = nx; lz = nz; }
  const m = mkCan(); m.scale.setScalar(1); scene.add(m);
  throws.push({ m, t: 0, dur: .45 + d * .05, a: camera.position.clone(), b: new THREE.Vector3(lx, F.y0 + .03, lz), f: P.floor, h: 1 + d * .12, kind: 'can' });
}
function updateThrows(dt) {
  for (let i = throws.length - 1; i >= 0; i--) {
    const T = throws[i]; T.t += dt; const k = Math.min(1, T.t / T.dur);
    T.m.position.lerpVectors(T.a, T.b, k); T.m.position.y += Math.sin(k * Math.PI) * T.h; T.m.rotation.x += dt * 14; T.m.rotation.z += dt * 9;
    if (k >= 1) {
      if (T.kind === 'visual') { T.m.parent?.remove(T.m); throws.splice(i, 1); continue; }
      at(T.b.x, T.b.y + .1, T.b.z).clank(1); fx.dust(T.b.x, T.b.y + .05, T.b.z, 6);
      const G = ghost;
      if (G.active && !G.enraged && G.floor === T.f && Math.hypot(G.x - T.b.x, G.z - T.b.z) < 30) { G.state = 'search'; G.target = { x: T.b.x, z: T.b.z }; G.path = []; G.replan = 0; G.wait = 0; G.hunt = null; G.lure2 = 6; say('깡— 소리가 복도에 울렸다', 1600); }
      T.m.rotation.set(Math.PI / 2, Math.random() * 6, 0); T.m.position.y = T.b.y; floors[T.f].interior.attach(T.m);
      throws.splice(i, 1);
    }
  }
}


// 조합 재료 줍기: 절연 테이프(공예실 · 별관 작업실 · 방송실) · 보건실 진정제(보건실 · 보건실 보조)
const PICK_SPOTS = [['tape', 2, -13.8, .87, -4.6], ['tape', 9, -18.0, .87, 4.8], ['tape', 1, 10.0, .02, 1.35], ['sedative', 0, -18.6, .02, .7], ['sedative', 8, 6.0, .02, 1.35]];
function spawnPicks() {
  const tapeG = new THREE.TorusGeometry(.06, .028, 8, 18), botG = new THREE.CylinderGeometry(.035, .035, .1, 12);
  const tapeM = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: .55 }), botM = new THREE.MeshStandardMaterial({ color: 0x8a5a24, roughness: .25, transparent: true, opacity: .9 });
  PICK_SPOTS.forEach(([item, f, x, y, z], i) => {
    if (!floors[f]) return; const m = item === 'tape' ? new THREE.Mesh(tapeG, tapeM) : new THREE.Mesh(botG, botM);
    if (item === 'tape') { m.rotation.x = Math.PI / 2; m.position.set(x, y + .03, z); } else m.position.set(x, y + .05, z);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .5 })); sp.scale.setScalar(.45); m.add(sp);
    m.userData.dynamic = true; floors[f].interior.add(m);
    world.props.push({ kind: 'pick', id: item + i, item, floor: f, x, z, y: y + .1, mesh: m, label: `${ITEMS[item].name} 줍기` });
  });
}
function usePick(p) { if (p.done) return; p.done = true; p.mesh.visible = false; giveItem(p.item, 1, true); sfx.pickup(); lootCard(ITEMS[p.item].icon, '조합 재료', ITEMS[p.item].name, ITEMS[p.item].desc); refreshHud(); save(true); }
// 오른쪽 클릭: 심령 카메라 켜기/끄기 · 카메라 모드에서 클릭: 촬영
addEventListener('contextmenu', e => { if (state === 'playing') e.preventDefault(); });
addEventListener('mousedown', e => {
  if (state !== 'playing' || (!document.pointerLockElement && !DEBUG)) return;
  if (e.button === 2) camMode(!CAM.on); else if (e.button === 0 && CAM.on) camShoot();
});

/* ---------- 3인칭 시점: 주인공 모델 ---------- */
// 캐릭터 시트 기반 3인칭 모델 — 관절(엉덩이 · 무릎 · 어깨 · 팔꿈치)이 있는 캡슐 인체
function buildPlayerModel(c) {
  const g = new THREE.Group(), j = c === 'jihun', H = j ? 1 : .955;   // 서연은 약간 작다
  const M = (col, r = .8, o = {}) => new THREE.MeshStandardMaterial({ color: col, roughness: r, ...o });
  const blazer = M(0x15171d, .7), shirt = M(0xe4e2da, .8), skin = M(0xe0b9a0, .55), hairM = M(j ? 0x0d0c0c : 0x2a1a14, .5);
  const pants = M(j ? 0x22262e : 0x15151a, .85), skirtM = M(0x4a4048, .9), sock = M(0x111114, .8), shoe = M(0xe8e6e0, .5), sole = M(0x2a2a2a, .7);
  const tie = M(0x7a1a22, .6), hood = M(0x6a6c70, .95), bag = M(j ? 0x111214 : 0xd8c4b4, .7);
  const cap = (r, h, m, seg = 12) => new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 6, seg), m);
  const at = (o, x, y, z, p) => { o.position.set(x, y, z); p.add(o); return o; };
  const root = new THREE.Group(); root.scale.setScalar(H); g.add(root);
  const hips = new THREE.Group(); hips.position.y = .92; root.add(hips);
  // 다리: 허벅지 → 무릎 → 정강이 → 발
  const legs = [], knees = [];
  [-1, 1].forEach(s => {
    const hip = new THREE.Group(); hip.position.set(s * .095, 0, 0); hips.add(hip);
    at(cap(j ? .068 : .058, .32, j ? pants : skin), 0, -.21, 0, hip);
    if (!j) at(cap(.066, .02, skirtM), 0, -.04, 0, hip).scale.set(1, .4, 1);
    const knee = new THREE.Group(); knee.position.y = -.43; hip.add(knee);
    at(cap(j ? .058 : .05, .3, j ? pants : sock), 0, -.2, 0, knee);
    const foot = new THREE.Group(); foot.position.y = -.42; knee.add(foot);
    at(new THREE.Mesh(new THREE.BoxGeometry(.1, .07, .26), shoe), 0, -.02, -.05, foot);
    at(new THREE.Mesh(new THREE.BoxGeometry(.105, .025, .27), sole), 0, -.06, -.05, foot);
    legs.push(hip); knees.push(knee);
  });
  // 치마 (서연) — 주름이 잡힌 짧은 원뿔
  if (!j) {
    const sk = new THREE.CylinderGeometry(.17, .27, .3, 28, 1, true), p = sk.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z) * (1 + .05 * Math.sign(Math.sin(a * 14)) * (p.getY(i) < 0 ? 1 : .2)); p.setXYZ(i, Math.cos(a) * r, p.getY(i), Math.sin(a) * r); }
    sk.computeVertexNormals(); const skm = new THREE.Mesh(sk, new THREE.MeshStandardMaterial({ color: 0x4a4048, roughness: .9, side: THREE.DoubleSide })); skm.position.y = -.05; hips.add(skm);
  }
  // 상체: 허리 → 가슴 (재킷 · 셔츠 · 넥타이/리본)
  const chest = new THREE.Group(); chest.position.y = .06; hips.add(chest);
  const torso = new THREE.LatheGeometry([[.13, 0], [.15, .08], [.175, .3], [.18, .42], [.13, .5], [.06, .52]].map(q => new THREE.Vector2(q[0], q[1])), 22);
  const tm = new THREE.Mesh(torso, blazer); tm.scale.set(1, 1, .7); chest.add(tm);
  at(new THREE.Mesh(new THREE.BoxGeometry(.1, .26, .02), shirt), 0, .36, -.118, chest);
  if (j) { at(new THREE.Mesh(new THREE.BoxGeometry(.035, .24, .02), tie), 0, .34, -.13, chest); const hd = new THREE.Mesh(new THREE.TorusGeometry(.12, .045, 8, 18, Math.PI), hood); hd.rotation.set(-.3, 0, 0); hd.position.set(0, .47, .07); chest.add(hd); }
  else { at(new THREE.Mesh(new THREE.BoxGeometry(.13, .045, .03), tie), 0, .44, -.13, chest); [-1, 1].forEach(s => { const t = at(new THREE.Mesh(new THREE.BoxGeometry(.03, .09, .02), tie), s * .025, .39, -.135, chest); t.rotation.z = s * .3; }); }
  // 가방
  at(new THREE.Mesh(new THREE.BoxGeometry(.28, .34, .13), bag), 0, .27, .18, chest);
  // 목 · 머리 · 머리카락
  at(cap(.045, .05, skin), 0, .57, 0, chest);
  const head = new THREE.Group(); head.position.y = .7; chest.add(head);
  const hm = at(new THREE.Mesh(new THREE.SphereGeometry(.1, 24, 18), skin), 0, 0, 0, head); hm.scale.set(.9, 1.08, .97);
  const hc = at(new THREE.Mesh(new THREE.SphereGeometry(.112, 24, 16, 0, Math.PI * 2, 0, Math.PI * .58), hairM), 0, .018, .012, head); hc.rotation.x = -.15;
  if (j) { for (let k = 0; k < 7; k++) { const f = at(new THREE.Mesh(new THREE.ConeGeometry(.03, .1, 5), hairM), -.07 + k * .023, .05, -.085, head); f.rotation.set(-2.3 + (k % 2) * .2, 0, (k - 3) * .08); } at(new THREE.Mesh(new THREE.BoxGeometry(.2, .1, .08), hairM), 0, -.04, .07, head); }
  else { at(new THREE.Mesh(new THREE.BoxGeometry(.2, .05, .05), hairM), 0, .06, -.085, head).rotation.x = .4; const tail = at(cap(.05, .3, hairM), .02, -.2, .1, head); tail.rotation.x = .15; [-1, 1].forEach(s => at(new THREE.Mesh(new THREE.BoxGeometry(.03, .22, .05), hairM), s * .095, -.07, -.02, head)); }
  // 팔: 어깨 → 팔꿈치 → 손
  const arms = [], elbows = [];
  [-1, 1].forEach(s => {
    const sh = new THREE.Group(); sh.position.set(s * .215, .44, 0); chest.add(sh);
    at(cap(.05, .2, blazer), 0, -.14, 0, sh);
    const el = new THREE.Group(); el.position.y = -.3; sh.add(el);
    at(cap(.044, .18, blazer), 0, -.12, 0, el);
    at(new THREE.Mesh(new THREE.SphereGeometry(.04, 10, 8), skin), 0, -.27, 0, el);
    arms.push(sh); elbows.push(el);
  });
  const torch = at(new THREE.Mesh(new THREE.CylinderGeometry(.022, .02, .2, 12).rotateX(Math.PI / 2), M(0x2a2a2e, .4, { metalness: .6 })), 0, -.28, -.08, elbows[1]);
  const hand = new THREE.Object3D(); hand.position.set(0, -.28, -.2); elbows[1].add(hand);
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  g.visible = false; scene.add(g);
  return { g, root, hips, chest, legs, knees, arms, elbows, head, hand, torch };
}
let pm = null, view = SET.view === 3 ? 3 : 1, camDistNow = 0;
function ensureModel() { if (!pm || pm.char !== CHAR) { if (pm) scene.remove(pm.g); pm = buildPlayerModel(CHAR); pm.char = CHAR; } }
function toggleView() {
  view = view === 3 ? 1 : 3; const t = $('viewTag'); t.textContent = view === 3 ? '3인칭 시점' : '1인칭 시점'; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 1400);
}
const _hand = new THREE.Vector3();
// 카메라 배치 후 호출: 3인칭이면 모델을 움직이고 카메라를 어깨 뒤로 뺀다
function applyThirdPerson(dt, yaw, pitch) {
  ensureModel();
  const third = view === 3 && !P.hiding && state !== 'dead' && state !== 'intro' && state !== 'menu';
  camDistNow = lerp(camDistNow, third ? SET.camDist : 0, Math.min(1, dt * 7));
  const F = floors[P.floor];
  if (camDistNow < .05) { pm.g.visible = false; flash.position.set(.12, -.08, 0); fx.cone.position.set(.12, -.08, -.15); return; }
  const fx3 = -Math.sin(yaw) * Math.cos(pitch), fy3 = Math.sin(pitch), fz3 = -Math.cos(yaw) * Math.cos(pitch), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const pivY = F.y0 + 1.62 - (P.crouchK || 0) * .5 + (P.jy || 0) + (P.shV || 0);
  let d = camDistNow; const side = .42 * Math.min(1, camDistNow / 1.2);
  const ok = (x, z) => los(F.walls, P.x, P.z, x, z) && los(F.doorWalls || [], P.x, P.z, x, z);
  let cx, cz;
  for (; d > .3; d -= .12) { cx = P.x - fx3 * d + rx * side; cz = P.z - fz3 * d + rz * side; const ex = cx - fx3 * .25, ez = cz - fz3 * .25; if (ok(cx, cz) && ok(ex, ez)) break; }
  if (d <= .3) { cx = P.x; cz = P.z; d = 0; }
  let cy = pivY - fy3 * d + .18; const ceil = P.floor === 3 || (P.floor === 0 && isOutdoors()) ? 60 : (P.floor === 5 ? 7.5 : P.floor === 6 ? 5.8 : 3.0);
  cy = clamp(cy, F.y0 + .35 + (P.shV || 0), F.y0 + ceil - .15 + (P.shV || 0));
  camera.position.set(cx, cy, cz);
  // 모델 — 걷기 · 달리기 · 웅크리기 · 점프 자세
  const g = pm.g; g.visible = d > .55; g.position.set(P.x, F.y0 + (P.jy || 0) + (P.shV || 0), P.z); g.rotation.y = yaw;
  const cr = P.crouchK || 0, air = (P.jy || 0) > .02, run = P.sprinting ? 1 : 0;
  const ph = P.bob * 1.0, amp = P.moving ? (run ? .8 : .5) * (1 - cr * .4) : 0;
  const sw = Math.sin(ph) * amp;
  pm.hips.position.y = .92 - cr * .32 + (P.moving ? Math.abs(Math.cos(ph)) * .025 : 0);
  pm.chest.rotation.x = cr * .35 + run * .18;
  pm.legs.forEach((l, i) => { const s2 = i ? -sw : sw; l.rotation.x = (air ? -.7 : 0) + s2 - cr * 1.05; });
  pm.knees.forEach((k, i) => { const s2 = i ? -Math.sin(ph) : Math.sin(ph); k.rotation.x = (air ? 1.1 : 0) + Math.max(0, s2) * amp * 1.2 + cr * 1.7; });
  pm.arms[0].rotation.x = -sw * .9 - cr * .3; pm.arms[0].rotation.z = .1; pm.elbows[0].rotation.x = -.25 - run * .9;
  pm.arms[1].rotation.x = P.light ? -1.2 - pitch * .8 : sw * .9; pm.arms[1].rotation.z = -.1; pm.elbows[1].rotation.x = P.light ? -.15 : -.25 - run * .9;
  pm.head.rotation.x = -pitch * .45 - pm.chest.rotation.x * .6;
  pm.torch.visible = true;
  camera.updateMatrixWorld(); g.updateMatrixWorld(true);
  pm.hand.getWorldPosition(_hand); camera.worldToLocal(_hand);
  _hand.z -= .45; flash.position.copy(_hand); _hand.z -= .25; fx.cone.position.copy(_hand);
}

/* ---------- 추가 이벤트 ---------- */
const staticTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 48; const t = new THREE.CanvasTexture(c); t.userData.c = c; return t; })();
function drawStatic(text) {
  const c = staticTex.userData.c, g = c.getContext('2d'), im = g.createImageData(64, 48);
  for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 200; im.data[i] = v * .8; im.data[i + 1] = v; im.data[i + 2] = v * .9; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0);
  if (text) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 16, 64, 16); g.fillStyle = '#ff4040'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText(text, 32, 28); }
  staticTex.needsUpdate = true;
}
const screens = [];
{ // 컴퓨터실(2층) 모니터 위에 화면 패널 — 평소엔 꺼져 있다 (world 가 모니터 화면 위치를 알려 준다)
  const scrM = new THREE.MeshBasicMaterial({ map: staticTex, toneMapped: false });
  (floors[1].pcScreens || []).forEach(p => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), scrM); m.position.set(p.x, p.y, p.z); m.rotation.y = p.ry; m.visible = false; m.userData.dynamic = true; floors[1].interior.add(m); screens.push(m);
  });
}
let screenT = 0;
const footM = new THREE.MeshStandardMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = 32; c.height = 64; const g = c.getContext('2d'); g.fillStyle = 'rgba(10,14,16,.9)'; g.beginPath(); g.ellipse(16, 40, 9, 18, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(16, 12, 7, 9, 0, 0, 7); g.fill(); const t = new THREE.CanvasTexture(c); return t; })(), transparent: true, roughness: .1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const feet = [];
function spawnFootprints(f, x0, z0, dir) {
  for (let k = 0; k < 10; k++) setTimeout(() => {
    if (P.floor !== f) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.13, .26), footM.clone()); m.rotation.set(-Math.PI / 2, 0, dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    m.position.set(x0 + dir * k * .55, .015, z0 + (k % 2 ? .13 : -.13)); floors[f].interior.add(m); feet.push({ m, t: 25 }); if (k % 2 === 0) sfx.drip();
  }, k * 380);
}
function updateFeet(dt) { for (let i = feet.length - 1; i >= 0; i--) { const F = feet[i]; F.t -= dt; if (F.t < 3) F.m.material.opacity = Math.max(0, F.t / 3); if (F.t <= 0) { F.m.parent && F.m.parent.remove(F.m); F.m.material.dispose(); feet.splice(i, 1); } } }
const fallTiles = [];
function dropCeilingTile(f, x, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(.6, .02, .6), new THREE.MeshStandardMaterial({ color: 0x9a968a, roughness: .95 }));
  m.position.set(x, 2.9, z); floors[f].interior.add(m); fallTiles.push({ m, v: 0, f, x, z });
  fx.dust(x, floors[f].y0 + 2.9, z, 30);
}
function updateFallTiles(dt) {
  for (let i = fallTiles.length - 1; i >= 0; i--) {
    const T = fallTiles[i]; T.v += 9.8 * dt; T.m.position.y -= T.v * dt; T.m.rotation.x += dt * 2; T.m.rotation.z += dt * 1.3;
    if (T.m.position.y <= .02) { T.m.position.y = .02; T.m.rotation.set(0, Math.random() * 3, 0); sfx.crumble(); fx.dust(T.x, floors[T.f].y0 + .1, T.z, 70); if (P.floor === T.f && Math.hypot(P.x - T.x, P.z - T.z) < 6) shake = .5; fallTiles.splice(i, 1); }
  }
}
let phoneProp = null;
{ phoneProp = { kind: 'phone', floor: 0, x: SLOTS[3] - 2.05, z: -5.5, y: .9, label: '울리는 전화 받기', done: true, ring: false }; world.props.push(phoneProp);
  const g = new THREE.Group(), beige = new THREE.MeshStandardMaterial({ color: 0xc8bfa8, roughness: .5 }); g.position.set(phoneProp.x, .76, -5.5); g.rotation.y = -Math.PI / 2; g.userData.dynamic = true; floors[0].interior.add(g);
  const base = new THREE.Mesh(new THREE.BoxGeometry(.2, .07, .22), beige); base.position.y = .035; g.add(base);
  const hs = new THREE.Mesh(new THREE.BoxGeometry(.22, .04, .06), beige); hs.position.set(0, .09, -.04); g.add(hs);
  [-.1, .1].forEach(x => { const e = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .05, 10), beige); e.position.set(x, .08, -.04); g.add(e); });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(.1, .08), new THREE.MeshStandardMaterial({ map: makeKeypad(), roughness: .6 })); pad.rotation.x = -Math.PI / 2 + .3; pad.position.set(0, .075, .06); g.add(pad);
  phoneProp.mesh = hs; }
// 기억의 잔상: 따뜻한 빛으로 된 두 학생의 실루엣이 잠깐 나타나 대화하고 사라진다
let echo = null;
function memoryEcho(cx) {
  storyCalm(45);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd6a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const grp = new THREE.Group(); grp.userData.dynamic = true; floors[2].interior.add(grp);
  [[cx - .9, -8.0, 2.6], [cx + .3, -8.3, -2.4]].forEach(([x, z, ry], i) => {
    const m = buildPlayerModel('seoyeon'); m.g.visible = true; m.g.traverse(o => { if (o.isMesh) o.material = mat; }); if (m.torch) m.torch.visible = false;
    m.g.position.set(x, 0, z); m.g.rotation.y = ry; m.g.scale.setScalar(i ? .97 : 1); grp.add(m.g);
    if (i === 0 && m.arms) m.arms[1].rotation.x = -1.1;   // 손을 흔드는 듯
  });
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex(), color: 0xffc890, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.setScalar(3.2); glow.position.set(cx - .3, 1.2, -8.0); grp.add(glow);
  echo = { grp, mat, glow, t: 0 };
  fx.glitch(.25); sfx.whisper(); caption('…웃음소리. 아주 오래전의.');
  setTimeout(() => line('echo1'), 1400);
  setTimeout(() => line('echo2'), 7600);
  setTimeout(() => addClue('echo'), 12500);
}
function updateEcho(dt) {
  if (!echo) return;
  echo.t += dt; const t = echo.t, a = t < 1.5 ? t / 1.5 : t < 11 ? 1 : Math.max(0, 1 - (t - 11) / 2.5);
  echo.mat.opacity = a * (.32 + Math.sin(t * 7) * .03); echo.glow.material.opacity = a * .35;
  if (t > 13.6) { echo.grp.parent.remove(echo.grp); echo = null; fx.glitch(.2); }
}
let hintT = 0, hintKey = '';
function updateEvents2(dt) {
  updateEcho(dt);
  updateTips(dt); updateSafe(dt); perkCD -= dt;
  // 4분 동안 목표가 바뀌지 않으면 힌트
  const o = objective(), k = o.main + (o.loc ? o.loc.where : '');
  if (k !== hintKey) { hintKey = k; hintT = 0; } else if ((hintT += dt) > 240) { hintT = 0; toast('💡 힌트', o.loc ? `${o.main} — ${o.loc.where}` : o.main, 'info'); }
  updateThrows(dt); updateFeet(dt); updateFallTiles(dt); extrasTick(dt);
  if (screenT > 0) { screenT -= dt; if (Math.random() < .5) drawStatic(screenT < 3.5 ? '다시, 여기서' : null); if (screenT <= 0) screens.forEach(s => { s.visible = false; }); }
  if (phoneProp.ring) { phoneProp.mesh.position.y = .09 + (Math.sin(tNow * 60) > .6 ? .008 : 0); phoneProp.ringT -= dt; if (phoneProp.ringT <= 0) { phoneProp.ringT = 2.2; if (P.floor === 0) { at(phoneProp.x, 1, phoneProp.z).phone(); caption('교무실 전화벨'); } } phoneProp.life -= dt; if (phoneProp.life <= 0) { phoneProp.ring = false; phoneProp.done = true; } }
}
/* ---------- 심리적 공포: 따라오는 발소리 · 바뀐 칠판 · 시야 끝의 그림자 · 이름을 부르는 속삭임 ---------- */
const PSY = { followCD: 75, follow: 0, shadowCD: 55, nameCD: 100, boards: 0, visits: {} };
function psych(f, room, step) {
  if (state !== 'playing' || !introDone) return;
  const chase = ghost.active && ghost.floor === f && (ghost.state === 'chase' || ghost.hunt);
  // 불안도: 그것과의 거리 + 그것이 깨어났는지 + 어둠 (밝은 방에서는 덜하다)
  const fear = (P.fear || 0) + (ghost.active ? .15 : 0) + (P.light ? 0 : .15) - (litAt(f, P.x, P.z) ? .15 : 0);
  // 다시 들어온 교실: 칠판 글씨가 바뀌어 있다 (두 번까지)
  if (room && EV.inRoom !== room.id) {
    PSY.visits[room.id] = (PSY.visits[room.id] || 0) + 1;
    const br = world.boardRefs['cls' + f + ':' + room.cx + (room.south ? 's' : '')];
    if (room.type === 'class' && PSY.visits[room.id] === 2 && PSY.boards < 2 && playTime > 150 && br && br.mat && room.name !== '3-3') {
      PSY.boards++; setTimeout(() => { const W = ['왜 돌아왔어?', '아직 여기 있어', '뒤를 보지 마', '같이 있자']; br.mat.map = world.makeBoardTex([W[(Math.random() * W.length) | 0]]); br.mat.needsUpdate = true; caption('칠판의 글씨가… 바뀌어 있다'); sfx.whisper(); setFace('fear', 2); }, 1600);
    }
  }
  // EV-05 이상한 복도: 3층 복도 끝의 실루엣 — 다가가면 깜빡임과 함께 사라진다
  if (f === 2 && Math.abs(P.z) < 1.5 && playTime > 40 && !chase) evOnce('ev05', () => {
    const dir = -Math.sin(P.yaw) >= 0 ? 1 : -1, x = clamp(P.x + dir * 18, -34, 34);
    if (Math.abs(x - P.x) < 11) { EV.done.delete('ev05'); return; }
    showApparition(2, x, 0, Math.atan2(P.x - x, 0), 9, null); EV.sil = true; blackout = .12; sfx.lightsOff(); caption('복도 끝에… 누군가 서 있다');
  });
  if (EV.sil && appar.visible && P.floor === 2 && Math.abs(appar.position.x - P.x) < 9) { EV.sil = false; apparT = 0; blackout = .35; shake = .4; sfx.whisper(); caption('…사라졌다'); }
  // EV-20 수영장 샤워실 거울: 거울 속, 내 뒤에
  if (f === 6 && FL.girl && P.x < -39.6 && P.z > 22.8 && P.z < 27 && Math.abs(Math.sin(P.yaw) - 1) < .5) evOnce('mirror6', () => {
    const bx = P.x + Math.sin(P.yaw) * 1.3, bz = P.z + Math.cos(P.yaw) * 1.3; showApparition(6, bx, bz, P.yaw, .6, null); at(bx, floors[6].y0 + 1.5, bz).whisper(); shake = .3; caption('거울 속, 내 뒤에 누군가 서 있었다');
  });
  // 선택 이벤트: 얼굴이 바뀌는 초상화 (미술실) — 눈을 돌린 사이 바뀌고, 다시 보면 눈이 떠져 있다
  const pr = world.boardRefs.portrait;
  if (pr && f === pr.floor && room && room.type === 'art') {
    const dx = pr.x - P.x, dz = pr.z - P.z, d = Math.hypot(dx, dz), dot = (dx * -Math.sin(P.yaw) + dz * -Math.cos(P.yaw)) / Math.max(d, .01);
    if (!EV.portrait && EV.roomT > 6 && dot < .2) { EV.portrait = 1; pr.mesh.material = new THREE.MeshStandardMaterial({ map: makePaintingStare(), roughness: .85 }); }
    else if (EV.portrait === 1 && dot > .93 && d < 6) { EV.portrait = 2; sfx.whisper(); fx.glitch(.3); caption('…초상화의 눈이 떠져 있다'); setFace('surprise', 2); }
  }
  if (chase) return;
  // 따라오는 발소리: 복도에서 내 발소리에 한 박자 늦게 겹치는 발소리 (멈추면 같이 멈춘다)
  PSY.followCD -= step; if (PSY.follow > 0) PSY.follow -= step;
  else if (PSY.followCD <= 0 && f <= 2 && Math.abs(P.z) < 1.5 && P.moving) { PSY.follow = 7; PSY.followCD = 130 + Math.random() * 90; setTimeout(() => caption('…발소리가 하나 더 들린다'), 1800); }
  // 시야 끝의 그림자: 겁에 질렸을 때, 곁눈으로만 보이고 돌아보면 없다
  PSY.shadowCD -= step;
  if (PSY.shadowCD <= 0 && fear > .25 && !appar.visible && !isOutdoors()) {
    PSY.shadowCD = 75 + Math.random() * 60;
    const side = Math.random() < .5 ? 1 : -1, a = P.yaw + side * 1.2, d = 6 + Math.random() * 3, x = P.x - Math.sin(a) * d, z = P.z - Math.cos(a) * d;
    if (los(floors[f].walls, P.x, P.z, x, z)) showApparition(f, x, z, Math.atan2(P.x - x, P.z - z), 1.1, null);
  }
  // 이름을 부르는 속삭임: 손전등을 끈 어둠 속에서, 등 뒤에서
  PSY.nameCD -= step;
  if (PSY.nameCD <= 0 && !P.light && fear > .25) {
    PSY.nameCD = 160 + Math.random() * 120; const nm = CHARACTERS[CHAR].name, code = nm.charCodeAt(nm.length - 1) - 0xAC00;
    at(P.x + Math.sin(P.yaw) * 1.5, floors[f].y0 + 1.6, P.z + Math.cos(P.yaw) * 1.5).whisper(); caption(`(등 뒤에서) …${nm}${code >= 0 && code % 28 ? '아' : '야'}`); setFace('fear', 2);
  }
}
function moreEvents(f, room, step) {
  if (state !== 'playing') return;
  // ⑨ 천장 타일 낙하 (복도, 그것이 깨어난 뒤)
  if (ghost.active && f <= 2 && Math.abs(P.z) < 1.5 && playTime > 90 && P.moving) evOnce('tile' + f, () => {
    const fx2 = -Math.sin(P.yaw); const x = P.x + Math.sign(fx2 || 1) * 3.2;
    if (Math.abs(x) < 34) dropCeilingTile(f, x, clamp(P.z, -1.2, 1.2)); else EV.done.delete('tile' + f);
  });
  // ⑩ 컴퓨터실 모니터가 일제히 켜진다
  if (room && f === 1 && room.type === 'computer' && EV.roomT > 1.2) evOnce('screens', () => { screens.forEach(s => { s.visible = true; }); screenT = 7; sfx.staticNoise(2.5); fx.glitch(.5); setTimeout(() => talk('speakers', 2400), 1200); });
  // ⑪ 젖은 발자국이 앞으로 이어진다
  if ((f === 0 || f === 2) && Math.abs(P.z) < 1.4 && playTime > 60 && (ghost.active || playTime > 200)) evOnce('feet' + f, () => {
    const dir = -Math.sin(P.yaw) >= 0 ? 1 : -1; if (Math.abs(P.x + dir * 8) > 32) { EV.done.delete('feet' + f); return; }
    spawnFootprints(f, P.x + dir * 2.5, 0, dir); setTimeout(() => say('…젖은 발자국이 앞으로 이어진다', 2400), 1500);
  });
  // ⑫ 교무실 전화가 울린다
  if (ghost.active && f === 0 && room && room.type === 'office') evOnce('phoneRing', () => { phoneProp.done = false; phoneProp.ring = true; phoneProp.ringT = 0; phoneProp.life = 16; });
  // ⑬ 화장실 거울 글씨
  if (room && room.type === 'toilet' && f === 2 && EV.roomT > 2.5) evOnce('mirror', () => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.8, .3), new THREE.MeshBasicMaterial({ map: makeGraffiti('뒤에 있어'), transparent: true, depthWrite: false }));
    m.position.set(room.cx + 3.81, 1.65, -4.2); m.rotation.y = -Math.PI / 2; floors[f].interior.add(m); sfx.creak(.4); setTimeout(() => sfx.whisper(), 600);
  });
  // ⑯ 도서실: 마지막 반납 (대출 카드를 읽은 뒤 다시 오면)
  if (room && room.type === 'library' && f === 0 && docs.some(d => d.id === 'n4') && EV.roomT > 2) evOnce('libReturn', libraryReturn);
  // ⑰ 물 없는 수영장 바닥에 서 있는 사람
  if (f === 6 && Math.abs(P.x + 41.5) < 4.5 && P.z > 45.6 && P.pitch < -.3) evOnce('poolFigure', () => { showApparition(6, -41.5, 40, 0, 1.6, 'look'); appar.position.y = floors[6].y0 - 1.55; caption('고인 물 한가운데… 누가 서 있다'); });
  // ⑲ 3-5 교실: 그날의 잔상 — 하늘을 기다리던 두 친구 (위협 없는 기억 장면)
  if (room && f === 2 && room.type === 'class' && !room.south && room.cx === SLOTS[6] && EV.roomT > 1.5) evOnce('echo', () => memoryEcho(room.cx));
  // ⑳ 수영장 샤워실: 샤워기가 저절로 틀어져 김이 차오른다
  if (f === 6 && P.x > -41.3 && P.z < 29.6 && P.z > 20.5) evOnce('showers', () => {
    caption('쏴아— 샤워기가 저절로 틀어졌다'); sfx.splash(); storyCalm(20);
    let n = 0; const iv = setInterval(() => { if (++n > 40 || state !== 'playing') { clearInterval(iv); if (n > 40) caption('물소리가 뚝 그쳤다'); return; }
      for (let k = 0; k < 6; k++) { const x = -40.5 + ((Math.random() * 6) | 0) * 1.05; fx.emit(x + (Math.random() - .5) * .15, floors[6].y0 + 2.0, 20.6, (Math.random() - .5) * .2, -2.5, .1, .5, [.55, .6, .65], .18, .015, 4); fx.emit(x, floors[6].y0 + .3, 21, (Math.random() - .5) * .4, .3, .3, 3.5, [.85, .88, .9], .18, .5, -.05, .4, .25); }
      if (n % 5 === 0) at(-38, floors[6].y0 + 1.5, 21).whisper(); }, 200);
  });
  // ㉑ 탈의실: 안쪽 락커 문이 쾅 하고 닫힌다
  if (f === 6 && P.x < -41.7 && P.z < 29 && P.z > 20.5) evOnce('lockerBang', () => { at(-47.3, floors[6].y0 + 1, 24.5).doorBang(0, 1); shake = .35; fx.dust(-47, floors[6].y0 + 1.2, 25, 25); caption('락커 문이 쾅 닫혔다'); setFace('surprise', 2); });
  // ㉒ 수영장 홀: 고인 물 아래에서 무언가 움직인다 (물보라 · 부표 흔들림)
  if (f === 6 && P.z > 31 && P.z < 49 && playTime > 30) evOnce('poolRipple', () => setTimeout(() => {
    if (state !== 'playing' || P.floor !== 6) { EV.done.delete('poolRipple'); return; }
    const x = -41.5 + (Math.random() - .5) * 5, z = 36 + Math.random() * 7; at(x, floors[6].y0 - 1.2, z).splash();
    for (let k = 0; k < 30; k++) fx.emit(x, floors[6].y0 - 1.25, z, (Math.random() - .5) * 2, Math.random() * 2.2, (Math.random() - .5) * 2, 1.1, [.7, .8, .8], .4, .04, 6, .5);
    caption('첨벙— 고인 물 아래에서 무언가 움직였다');
  }, 2500));
  // ㉓ 수영장 기계실: 멈춰 있던 순환 펌프가 혼자 돌기 시작한다
  if (f === 6 && P.z > 50.4) evOnce('poolPump', () => { sfx.breaker(); shake = .3; caption('웅— 멈춰 있던 펌프가 저절로 돌기 시작한다'); });
  // ㉔ 지하 비밀 자료실: 그날 밤의 방 (그것은 들어오지 못한다)
  if (f === 4 && P.z > 2.1) evOnce('secretRoom', () => { storyCalm(80); sfx.whisper(); fx.glitch(.2); caption('공기가 멈춘 방. 벽의 사진들이 모두 같은 밤을 찍었다'); setTimeout(() => talk('steps', 2200), 2600); });
  // ㉕ 지하 보일러실: 전력이 돌아온 뒤 보일러가 다시 불붙는다
  if (f === 4 && power && room && room.type === 'boiler' && EV.roomT > 1) evOnce('boilerFire', () => { sfx.boom(.6); shake = .5; fx.dust(room.cx - 1.8, floors[4].y0 + 2.4, -6.5, 40); caption('쿠르릉— 꺼져 있던 보일러에 불이 붙었다'); });
  // ㉖ 켜 둔 형광등이 터진다 (불 켜진 방에 오래 있으면, 두 번까지)
  if (room && litAt(f, P.x, P.z) && EV.roomT > 25 && (EV.bulbs || 0) < 2 && Math.random() < .004) {
    const lamp = floors[f].lamps.filter(l => l.room && !l.off && l.kind !== 'dead' && Math.abs(l.x - P.x) < 4 && Math.abs(l.z - P.z) < 4)[0];
    if (lamp) { EV.bulbs = (EV.bulbs || 0) + 1; lamp.kind = 'dead'; lamp.mesh.material = world.mats.matLampDead; lampTimer = 0; fx.spark(lamp.x, lamp.y + .35, lamp.z, 40); at(lamp.x, lamp.y, lamp.z).spark(); sfx.pinBreak(); caption('팍— 형광등이 터졌다'); setFace('surprise', 1.5); }
  }
  // ㉗ 3-2 — 하늘의 교실: 남은 한 자리의 휴대전화가 진동한다 (그것은 이 방에 들어오지 않는다)
  if (room && room.south && room.name === '3-2' && EV.roomT > 1.2) evOnce('room32', () => {
    storyCalm(120); at(room.cx, floors[f].y0 + .8, 5.6).vibrate(); fx.glitch(.2); setFace('fear', 2.5);
    caption('국화가 놓인 책상 위에서… 휴대전화가 진동한다'); setTimeout(() => { sfx.whisper(); subtitle('???', '…오늘 방송, 들어 줄 거지?', 3.5); }, 3200);
  });
  if (room && room.south && room.name === '3-2') { ghost.calmT = Math.max(ghost.calmT || 0, 3); }
  // ⑱ 체육관 첫 진입: 소리가 크게 울린다
  if (f === 5) evOnce('gymEcho', () => caption('체육관 — 작은 소리도 크게 울린다'));
  // ⑭ 복도 사물함이 안에서 쾅쾅
  if (ghost.active && Math.abs(P.z) < 1.75) { const l = world.lockers.find(o => o.floor === f && Math.hypot(o.x - P.x, o.z - P.z) < 2.2 && o !== P.hiding); if (l && Math.random() < .02 * step * 5) evOnce('lockerBang' + f, () => { at(l.x, floors[f].y0 + 1, l.z).knock(); shake = .25; caption('사물함 안에서 두드리는 소리'); }); }
}
// ⑮ 번개가 칠 때 창밖(운동장 쪽)에 누군가 서 있다
function lightningEvent() {
  lightFlash = 1;
  if (state !== 'playing' || P.floor > 2 || isOutdoors() || Math.random() > .5) return;
  const fz = -Math.cos(P.yaw); if (fz < .55 || Math.abs(P.z) > 1.75) return;
  showApparition(P.floor, clamp(P.x + (Math.random() - .5) * 4, -30, 30), 5.5, Math.PI, .45, null);
}
let lightFlash = 0;

/* ---------- 첫 10분 튜토리얼 팁 (장면 안에서 한 번씩) ---------- */
const TIPS = [
  { id: 'move', when: () => playTime > 2, text: '<kbd>W A S D</kbd> 이동 · 마우스 시선 · <kbd>Shift</kbd> 달리기 (소리가 납니다)' },
  { id: 'flash', when: () => playTime > 9, text: '<kbd>F</kbd> 손전등 — 배터리는 켜 둔 만큼 닳습니다' },
  { id: 'interact', when: () => !!target && target.type !== 'stairs', text: '<kbd>E</kbd> 조사 — 쪽지 · 문 · 사물함 · 장치' },
  { id: 'map', when: () => gateClosed && playTime > 20, text: '<kbd>M</kbd> 지도(★ 현재 목표) · <kbd>Tab</kbd> 소지품 · <kbd>P</kbd> 휴대폰' },
  { id: 'hide', when: () => world.lockers.some(l => l.floor === P.floor && Math.hypot(l.x - P.x, l.z - P.z) < 2.6), text: '사물함에 <kbd>E</kbd> 로 숨으면 그것의 시선을 피할 수 있다 · 안에서 <kbd>Space</kbd> 숨 참기' },
  { id: 'ghost', when: () => ghost.active, text: '그것은 <b>소리</b>를 듣고 <b>빛</b>을 본다 — 달리면 들킨다. 손전등을 똑바로 비추면 잠시 물러난다' },
  { id: 'safe', when: () => !!safeRoomAt(), text: '<b>안전 구역</b> — 그것이 들어오지 않는다. 들어오면 자동 저장된다' },
  { id: 'can', when: () => inv.can > 0, text: '<kbd>G</kbd> 빈 캔 던지기 — 떨어진 곳의 소리로 그것을 유인' },
  { id: 'combine', when: () => P.keys >= TOTAL || (FL.mop && FL.wire), text: '<kbd>Tab</kbd> 소지품 › 아이템 선택 › <kbd>C</kbd> 조합 › 상대 아이템 선택' },
  { id: 'crouch', when: () => ghost.active && playTime > 30, text: '<kbd>C</kbd> 앉기 — 느리지만 발소리가 거의 없고 잘 보이지 않는다 · <kbd>Space</kbd> 점프' },
  { id: 'view', when: () => playTime > 240, text: '<kbd>V</kbd> 1인칭 / 3인칭 시점 전환' },
];
let tipT = 0, tipShowT = 0;
function updateTips(dt) {
  tipShowT -= dt; if (tipShowT <= 0) $('tip').classList.remove('show');
  if (!SET.tips || state !== 'playing' || (tipT -= dt) > 0) return; tipT = .5;
  if (tipShowT > 0) return;
  const t = TIPS.find(x => !tipsDone.has(x.id) && x.when()); if (!t) return;
  tipsDone.add(t.id); $('tipText').innerHTML = t.text; $('tip').classList.add('show'); tipShowT = 6.5; sfx.ui();
}
/* ---------- 효과음 자막 ([발소리] 등) ---------- */
let capTimer = 0;
function caption(text) {
  if (!SET.captions) return;
  logLine('·', text);
  const el = $('cap'); el.textContent = `[${text}]`; el.classList.add('show'); clearTimeout(capTimer); capTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
/* ---------- 안전 구역: 그것이 들어오지 않는 방 (보건실 · 별관 진로상담실) ---------- */
const SAFE_ROOMS = [{ f: 0, cx: SLOTS[1], name: '보건실' }, { f: 8, cx: ANNEX.slots[4], name: '진로상담실' }];
const safeRoomAt = (f = P.floor, x = P.x, z = P.z) => SAFE_ROOMS.find(r => r.f === f && Math.abs(x - r.cx) < 3.9 && z < -1.9 && z > -9.5);
let safeSaveT = 0, wasSafe = false;
function updateSafe(dt) {
  const s = state === 'playing' && safeRoomAt(); safeSaveT -= dt;
  $('safeTag').classList.toggle('show', !!s);
  if (s && !wasSafe) { caption('안전 구역 — 숨이 고르게 돌아온다'); if (safeSaveT <= 0) { safeSaveT = 60; save(true); } }
  wasSafe = !!s;
  if (s) { P.fear = Math.max(0, P.fear - dt * .5); P.stamina = Math.min(100, P.stamina + 10 * dt); }
}
/* ---------- 능력 발동 피드백 ---------- */
let perkCD = 0;
function perkFlash(text) { if (perkCD > 0) return; perkCD = 8; const el = $('perkTag'); el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); sfx.tension(.2); }
/* ---------- 마지막 방송: 그날 밤의 녹음 조각을 순서대로 복원 ---------- */
const TAPE_FRAGS = [
  { id: 'a', t: '23:05', text: '“…담력 체험 시작. 하늘이 들어갔다. 문 잠갔어. 10분만 있다가 열어 주자.”' },
  { id: 'b', t: '23:20', text: '“…정전이다! 다들 나가, 빨리! …하늘이는? 하늘이는 누가 꺼냈어?”' },
  { id: 'c', t: '23:30', text: '“…펌프실 문이 밖에서 잠겨 있습니다. 열쇠는… 교무부장님이 가져가셨습니다.”' },
  { id: 'd', t: '23:40', text: '“…3학년 2반 윤하늘. 오늘 방송은… 오늘 하루도 수고 많—” (끊김)' },
];
/* ---------- 도서실 · 수영장 대표 장면 ---------- */
function libraryReturn() {
  const it = world.items.find(i => i.kind === 'note' && i.id === 'n26'); if (!it || !it.locked) return;
  sfx.bang(.2, .5); caption('책 한 권이 책상 위로 떨어진다'); shake = .2;
  setTimeout(() => { it.locked = false; it.mesh.visible = true; fx.dust(it.pos.x, it.pos.y + .1, it.pos.z, 15); say('…방금 전까지 없던 대출 카드가 놓여 있다', 2600); }, 600);
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
  world.flickCfg.calm = SET.flashReduce || SET.noFlicker;
  fx.setOpts({ bloom: SET.bloom, grain: SET.grain, glitch: SET.flashReduce ? .2 : 1, flash: SET.flashReduce ? .25 : 1 });
  $('fps').classList.toggle('on', SET.showFps || TEST); $('ptime').classList.toggle('off', SET.showPlay === false); $('hints').style.display = SET.hints ? '' : 'none';
  document.documentElement.style.setProperty('--subBg', SET.subBg);
  document.body.classList.toggle('noNames', !SET.subNames); document.body.classList.toggle('contrast', !!SET.contrast);
  document.documentElement.style.setProperty('--ui', SET.ui);
  if (state !== 'playing') { camera.fov = SET.fov; camera.updateProjectionMatrix(); }
}
/* ---------- 의뢰 (서브 퀘스트): 교실마다 남겨진 부탁 — story.js SIDEQUESTS ----------
   진행은 FL.sq[id] = 현재 단계(0 = 아직 시작 전, steps.length = 완료) · 퀘스트 아이템은 FL.qi — FL 째로 저장된다.
   단계마다 조사 지점(prop kind 'sq')을 하나씩 만들고, 지금 단계의 지점만 활성화한다 */
const sqStep = id => (FL.sq && FL.sq[id]) || 0;
const sqDoneCount = () => SIDEQUESTS.filter(q => sqStep(q.id) >= q.steps.length).length;
const sqProps = [];
{ // 방 이름 → 방 중심 · 남쪽 줄 여부
  const roomOf = (f, name) => {
    const an = f >= 8, rows = an ? [[ANNEX.floors[f - 8], ANNEX.slots, false], [ANNEX_S[f - 8], ANNEX.slots, true]] : [[LAYOUT[f], SLOTS, false], [LAYOUT_S[f], SLOTS, true]];
    for (const [L, sl, south] of rows) { if (!L) continue; const i = L.names.indexOf(name); if (i >= 0) return { cx: sl[i], south }; }
    return null;
  };
  // 가구 · 벽 충돌을 피해 비어 있는 자리로 조금씩 옮긴다
  const freeSpot = (F, x, z, r = .32) => { const hit = (a, b) => F.col.some(c => a > c.x1 - r && a < c.x2 + r && b > c.z1 - r && b < c.z2 + r);
    if (!hit(x, z)) return [x, z]; for (let k = 1; k < 14; k++) for (let a = 0; a < 8; a++) { const ax = x + Math.cos(a * .785) * k * .18, az = z + Math.sin(a * .785) * k * .18; if (!hit(ax, az)) return [ax, az]; } return [x, z]; };
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .8, ...o });
  const LOOK = {
    board: () => { const g = new THREE.Group(), b = new THREE.Mesh(new THREE.BoxGeometry(.5, .36, .02), M(0xd8cfb8)); b.position.y = .62; b.rotation.x = -.35; g.add(b); for (let i = 0; i < 12; i++) { const s = new THREE.Mesh(new THREE.CircleGeometry(.018, 5), new THREE.MeshBasicMaterial({ color: i === 11 ? 0x333333 : 0xe8c040 })); s.position.set(-.18 + (i % 6) * .07, .66 - ((i / 6) | 0) * .1, .02); s.rotation.x = -.35; g.add(s); } return g; },
    book: () => { const m = new THREE.Mesh(new THREE.BoxGeometry(.24, .05, .32), M(0x6a2a2a)); m.position.y = .5; return m; },
    tape: () => { const m = new THREE.Mesh(new THREE.BoxGeometry(.12, .02, .08), M(0x1a1a1c)); m.position.y = .49; return m; },
    deck: () => { const m = new THREE.Mesh(new THREE.BoxGeometry(.4, .14, .26), M(0x2a2b2e, { metalness: .4 })); m.position.y = .55; return m; },
    letter: () => { const m = new THREE.Mesh(new THREE.BoxGeometry(.24, .01, .16), M(0xe8e0cc)); m.position.y = .49; return m; },
    paper: () => { const m = new THREE.Mesh(new THREE.BoxGeometry(.24, .02, .32), M(0xd8d0bc)); m.position.y = .49; return m; },
    drawer: () => { const m = new THREE.Mesh(new THREE.BoxGeometry(.5, .4, .45), M(0x4a4e50, { metalness: .5 })); m.position.y = .68; return m; },
    box: () => { const m = new THREE.Mesh(new THREE.BoxGeometry(.4, .3, .3), M(0x5a6a5a, { metalness: .3 })); m.position.y = .63; return m; },
    monitor: () => { const g = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(.4, .3, .25), M(0xc8bfa8)); m.position.y = .63; const sc = new THREE.Mesh(new THREE.PlaneGeometry(.32, .22), new THREE.MeshBasicMaterial({ color: 0x5a8ad0 })); sc.position.set(0, .64, .126); g.add(m, sc); return g; },
    photo: () => { const m = new THREE.Mesh(new THREE.BoxGeometry(.2, .01, .15), M(0xc8b890)); m.position.y = .49; return m; },
    flower: () => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .3, 5), M(0x3a6a2a)); st.position.set(i * .03 - .03, .15, 0); const fl = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), M(0xe8e0f0)); fl.position.set(i * .03 - .03, .31, 0); g.add(st, fl); } return g; },
    post: () => { const g = new THREE.Group(), b = new THREE.Mesh(new THREE.BoxGeometry(.4, .5, .3), M(0xb02018)); b.position.y = 1.0; const pole = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .75, 8), M(0x2a2a2a)); pole.position.y = .375; g.add(b, pole); return g; },
    plaque: () => { const g = new THREE.Group(), st = new THREE.Mesh(new THREE.BoxGeometry(.9, .7, .3), M(0x8a8478, { roughness: .95 })); st.position.y = .35; const pl = new THREE.Mesh(new THREE.BoxGeometry(.6, .4, .02), M(0x8a6a38, { metalness: .7, roughness: .45 })); pl.position.set(0, .42, .16); g.add(st, pl); return g; },
    panel: () => { const g = new THREE.Group(), b = new THREE.Mesh(new THREE.BoxGeometry(.5, .7, .16), M(0x7a8078, { metalness: .5, roughness: .55 })); b.position.y = 1.35; const d = new THREE.Mesh(new THREE.BoxGeometry(.44, .62, .02), M(0x9aa098, { metalness: .5, roughness: .5 })); d.position.set(0, 1.35, .09); const w = new THREE.Mesh(new THREE.BoxGeometry(.18, .02, .02), M(0xe0c020)); w.position.set(0, 1.62, .1); g.add(b, d, w); return g; },
    case: () => { const g = new THREE.Group(), base = new THREE.Mesh(new THREE.BoxGeometry(1.0, .8, .6), M(0x3a2c22, { roughness: .6 })); base.position.y = .4; const gl = new THREE.Mesh(new THREE.BoxGeometry(.96, .5, .56), new THREE.MeshStandardMaterial({ color: 0xbfd8e0, roughness: .05, metalness: .1, transparent: true, opacity: .22, depthWrite: false })); gl.position.y = 1.06; const km = M(0xc8a050, { metalness: .9, roughness: .3 }), key = new THREE.Mesh(new THREE.TorusGeometry(.06, .015, 8, 20), km); key.position.set(0, .9, 0); key.rotation.x = Math.PI / 2; const shaft = new THREE.Mesh(new THREE.BoxGeometry(.14, .012, .02), km); shaft.position.set(.12, .9, 0); const pad = new THREE.Mesh(new THREE.BoxGeometry(.12, .16, .03), M(0x202428, { emissive: 0x30ff60, emissiveIntensity: .25 })); pad.position.set(.38, .6, .31); g.add(base, gl, key, shaft, pad); g.userData.key = [key, shaft]; return g; },
    lamp: () => { const g = new THREE.Group(), b = new THREE.Mesh(new THREE.BoxGeometry(.36, .16, .1), M(0xd8d4c4)); b.position.y = 2.2; const h = new THREE.Mesh(new THREE.BoxGeometry(.3, .08, .04), sqLampMat); h.position.set(0, 2.18, .06); g.add(b, h); return g; },
  };
  const sqLampMat = new THREE.MeshStandardMaterial({ color: 0x2a2a26, emissive: 0xfff0c8, emissiveIntensity: 0 });
  const crate = new THREE.BoxGeometry(.42, .44, .36), crateM = M(0x6a5a44);
  [...SIDEQUESTS, HEADQUEST].forEach(q => q.steps.forEach((st, k) => {
    let x = st.x, z = st.z, F = floors[st.f];
    if (st.room) { const r = roomOf(st.f, st.room); if (!r) { console.warn('[sq] 방 없음', st.room); return; } x = r.cx + st.dx; z = r.south ? 1.75 + st.d : -1.75 - st.d; }
    if (st.look !== 'post' && st.look !== 'lamp' && st.look !== 'panel') [x, z] = freeSpot(F, x, z);
    const g = new THREE.Group(); g.position.set(x, 0, z); g.userData.dynamic = true;
    if (!['post', 'lamp', 'flower', 'plaque', 'panel', 'case'].includes(st.look)) g.add(new THREE.Mesh(crate, crateM)).position.y = .22;
    const v = LOOK[st.look](); g.add(v);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, color: 0xffd8a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .5 })); gl.scale.setScalar(.6); gl.position.y = st.look === 'lamp' ? 2.2 : st.look === 'post' ? 1.1 : st.look === 'panel' ? 1.4 : st.look === 'case' ? 1.0 : .6; g.add(gl);
    (st.f === 0 && !st.room ? world.OUT : F.interior).add(g);
    if (st.look === 'case' || st.look === 'plaque') { const r = st.room && roomOf(st.f, st.room); if (r && r.south) g.rotation.y = Math.PI; }   // 문 쪽(복도)을 보게
    const p = { kind: 'sq', q: q.id, k, st, floor: st.f, x, z, y: st.look === 'lamp' ? 2.0 : st.look === 'panel' ? 1.3 : .7, mesh: g, glint: gl, label: st.label, uid: `sq:${q.id}:${k}`, main: q === HEADQUEST, keyMeshes: v.userData.key };
    if (st.look === 'lamp') p.lampMat = sqLampMat;
    world.props.push(p); sqProps.push(p);
  }));
}
// 지금 단계의 지점만 보이고 조사할 수 있다. init: 불러오기 직후 (비상등처럼 완료 상태가 남는 연출 복원)
function sqSync(init) {
  FL.sq = FL.sq || {}; FL.qi = FL.qi || {};
  if (FL.gatekey || FL.keyhead) FL.sq.head = HEADQUEST.steps.length;   // 이전 버전 세이브(이미 정문 열쇠를 만든 경우)
  for (const p of sqProps) {
    const s = sqStep(p.q), q = p.main ? HEADQUEST : SIDEQUESTS.find(x => x.id === p.q);
    if (p.main) {   // 제4장: 조각 다섯 개를 모은 뒤에만 · 고정물(머릿돌 · 분전반 · 진열장)은 늘 보인다
      const on = s === p.k && P.keys >= TOTAL && !FL.keyhead;
      p.done = !on; p.mesh.visible = on || ['plaque', 'panel', 'case'].includes(p.st.look); if (p.glint) p.glint.visible = on;
      if (p.keyMeshes) p.keyMeshes.forEach(m => { m.visible = !FL.keyhead; });
      continue;
    }
    // 첫 단계는 언제나 열려 있다(발견형). 이후 단계는 그 단계가 됐을 때만
    const active = s === p.k && s < q.steps.length;
    p.done = !active; p.mesh.visible = active || (p.st.look === 'lamp' && s >= q.steps.length) || (p.st.look === 'post' && s >= p.k);
    if (p.glint) p.glint.visible = active;
    if (p.lampMat) p.lampMat.emissiveIntensity = s >= q.steps.length ? 2.2 : 0;
  }
}
function sqNeedOk(n) { return !n || (n === 'anPow' ? !!FL.anPow : n === 'power' ? power : n === 'mina' ? FL.mina : n === 'key4' ? !!got[4] : n === 'hairpin' ? inv.hairpin > 0 : true); }
function sqNeedText(p) { const n = p.st.need; if (sqNeedOk(n)) return ''; return { anPow: '  — 전원 없음 (별관 1층 공구실 분전반)', power: '  — 전원 없음 (지하 전기실 차단기)', mina: '  — 민아를 먼저 찾아야 한다', key4: '  — 아직 다섯 번째 조각이 없다', hairpin: '  — 머리핀 필요' }[n] || ''; }
async function useSideQuest(p) {
  const q = SIDEQUESTS.find(x => x.id === p.q), st = p.st;
  if (!sqNeedOk(st.need)) { sfx.click(); say(sqNeedText(p).replace(/^\s*—\s*/, ''), 2400); return; }
  if (st.need === 'hairpin') { inv.hairpin--; sfx.pick && sfx.pick(); }
  let ci = 0;
  if (st.choice) { ci = await choose(st.choice.title, st.choice.text, st.choice.opts); }
  if (st.take) delete FL.qi[st.take];
  if (st.give) { FL.qi[st.give] = true; newItems.add(st.give); sfx.pickup(); toast('아이템을 획득했습니다', ITEMS[st.give].name, 'info'); }
  FL.sq[q.id] = p.k + 1;
  const first = p.k === 0, last = p.k + 1 >= q.steps.length;
  if (st.doc) { addDoc({ id: st.doc, kind: 'note' }); sfx.paper(); }
  sqEvent(st.event, ci, p);
  if (st.doc) setTimeout(() => { if (state === 'playing') showNote({ title: world.NOTES[st.doc].title, text: world.NOTES[st.doc].text }); }, st.event ? 1800 : 300);
  if (first && !last) setTimeout(() => toast('새 의뢰', `${q.title} — 다음: ${q.steps[1].goal}`, 'opt'), 900);
  else if (!last) setTimeout(() => toast(q.title, `다음: ${q.steps[p.k + 1].goal}`, 'info'), 900);
  if (last) {
    const r = ci === 0 ? (st.reward || {}) : {};
    Object.entries(r).forEach(([k, v]) => { inv[k] = (inv[k] || 0) + v; });
    addClue('q' + (SIDEQUESTS.indexOf(q) + 1)); storyCalm(40);
    setTimeout(() => toast('의뢰 완료 — ' + q.title, Object.keys(r).length ? '보답: ' + Object.entries(r).map(([k, v]) => `${ITEMS[k].name} ×${v}`).join(', ') : '마음 한구석이 무겁다', 'opt'), 2400);
    if (sqDoneCount() === SIDEQUESTS.length) setTimeout(() => { inv.medkit++; inv.battery += 2; toast('모든 부탁을 들어주었다', '남겨진 사람들의 이야기를 모두 모았다 — 진실을 알리면 다른 결말이 기다린다', 'opt'); refreshHud(); }, 6500);
  }
  refreshHud(); save(true);
}
// 의뢰 연출 — 기존 효과음 · 화면 효과 · 자막만 쓴다
function sqEvent(ev, ci, p) {
  if (!ev) return;
  if (ev === 'bell') { if (ci === 0) { setTimeout(() => sfx.bell(), 300); setTimeout(() => caption('…어디선가 작은 목소리가 대답했다. “네!”'), 1400); } else { sfx.whisper(); caption('출석부를 덮자, 교실 쪽에서 의자 끄는 소리가 났다'); } }
  else if (ev === 'song') { const mel = [392, 392, 440, 440, 392, 392, 330, 392, 392, 330, 330, 294]; sfx.tape && sfx.tape(); mel.forEach((f, i) => setTimeout(() => sfx.note(f), 900 + i * 420)); setTimeout(() => caption('스피커에서 세 사람의 노래가 흘러나온다'), 1200); setTimeout(() => { caption('“…모두, 수고 많았습니다. 집으로 돌아가세요.”'); fx.glitch(.25); }, 900 + mel.length * 420); }
  else if (ev === 'water') { if (ci === 0) { sfx.drip(); setTimeout(() => caption('물소리가 멎었다'), 900); setTimeout(() => sfx.whisper(), 1800); } else caption('물소리는 계속된다'); }
  else if (ev === 'pick') { sfx.tumbler && sfx.tumbler(); setTimeout(() => sfx.unlock(), 700); }
  else if (ev === 'truth') { sfx.staticNoise(.8); fx.glitch(.4); setTimeout(() => caption('두 진술이 모두 사실이었다 — 문은 두 개였다'), 900); }
  else if (ev === 'post') { sfx.paper(); setTimeout(() => sfx.click(), 500); setTimeout(() => caption('편지가 우편함 바닥에 닿는 소리'), 900); }
  else if (ev === 'mina') { sfx.tape && sfx.tape(); setTimeout(() => caption('📼 민아: “언니. 하늘 언니 방송, 내가 끝까지 들었어.”'), 900); }
  else if (ev === 'light') { sfx.lightOn ? sfx.lightOn() : sfx.click(); setTimeout(() => caption('10년 늦은 불빛'), 900); }
  else if (ev === 'library') { sfx.lightsOff ? sfx.lightsOff() : sfx.click(); fx.glitch(.3); setTimeout(() => sfx.whisper(), 1100); setTimeout(() => caption('…다녀왔습니다.'), 1500); }
}
/* ---------- 제4장 · 열쇠의 머리 (별관) — story.js HEADQUEST · 진행은 FL.sq.head ---------- */
async function useHead(p) {
  const st = p.st;
  if (!sqNeedOk(st.need)) { sfx.click(); say(sqNeedText(p).replace(/^\s*—\s*/, ''), 2600); if (st.need === 'anPow') talk('needPower', 2600); return; }
  if (st.mini) {
    const r = await mini(st.mini, st.mini === 'slide' ? { img: 'assets/img/annex_ext.webp', title: '보안 PC — 끊긴 CCTV 화면 맞추기' } : { title: '별관 분전반 — 배선 연결' });
    if (!r.ok) return;
  }
  if (st.code) { kpProp = { code: st.code, prop: p }; kpBuf = ''; $('kpTitle').textContent = '전시 공간 진열장'; $('kpHint').innerHTML = p.fails ? '힌트 ① 교장 수첩: 잠금 번호는 <b>“이 학교가 태어난 날”</b>' : '전자식 잠금 — 숫자 4자리'; renderKeypad(); openUI('keypad'); sfx.beep(); return; }
  headAdvance(p);
}
function headAdvance(p) {
  const st = p.st; FL.sq.head = p.k + 1;
  if (st.doc) { addDoc({ id: st.doc, kind: 'note' }); sfx.paper(); if (CLUES[st.doc]) addClue(st.doc); }
  headEvent(st.event, p);
  if (st.doc) setTimeout(() => { if (state === 'playing') showNote({ title: world.NOTES[st.doc].title, text: world.NOTES[st.doc].text }); }, st.event ? 2600 : 300);
  const nx = HEADQUEST.steps[p.k + 1];
  if (nx) setTimeout(() => toast('제4장 · 열쇠의 머리', `다음: ${nx.goal}`, 'info'), 1200);
  refreshHud(); save(true);
}
// 그것이 플레이어가 있는 층(별관)으로 온다 — 방송 뒤(고요)엔 오지 않는다
function headLure(sec) {
  if (!ghost.active || FL.calm || ghost.enraged) return;
  if (ghost.floor !== P.floor) { ghostRelocate(); ghost.spawnGrace = 4; }
  ghost.state = 'search'; ghost.target = { x: P.x, z: P.z }; ghost.path = []; ghost.replan = 0; ghost.wait = 0; ghost.lureT = sec; ghost.hunt = null;
}
function headEvent(ev, p) {
  if (ev === 'annexPower') {
    FL.anPow = true; sfx.breaker(); shake = .4; P.noiseT = 2.5; blackout = Math.max(blackout, .6);
    setTimeout(() => { sfx.lightOn(); caption('별관 복도 끝에서부터 형광등이 하나씩 켜진다'); }, 900);
    toast('별관 전원이 들어왔다', '분전반 소리가 별관 전체에 울렸다…', 'warn');
    setTimeout(() => { if (state === 'playing' && ghost.active && !FL.calm) { sfx.stairs(); caption('계단 쪽에서 무언가 올라온다'); headLure(20); } }, 4000);
  } else if (ev === 'cctv') {
    sfx.staticNoise(1.4); fx.glitch(.6);
    setTimeout(() => caption('화면 속 전시 공간 — 진열장 앞에 누군가 서 있다'), 1000);
    setTimeout(() => { fx.glitch(.8); sfx.whisper(); caption('…지금 찍히고 있는 화면이다'); }, 2200);
  } else if (ev === 'head') {
    FL.keyhead = true; newItems.add('keyhead'); sfx.key(); setFace('resolve', 3); if (p.keyMeshes) p.keyMeshes.forEach(m => { m.visible = false; });
    toast('열쇠 머리를 얻었습니다', '소지품(Tab)에서 다섯 조각과 조합하면 정문 열쇠가 된다', 'opt'); setTimeout(() => talk('headFound', 3200), 400);
    if (!FL.calm) setTimeout(() => {
      blackout = Math.max(blackout, 1.6); sfx.lightsOff ? sfx.lightsOff() : sfx.click(); shake = .3;
      const ax = P.x - Math.sin(P.yaw) * 2.6, az = P.z - Math.cos(P.yaw) * 2.6; showApparition(P.floor, ax, az, Math.atan2(P.x - ax, P.z - az), 2.2, null); sfx.ghostBreath && sfx.ghostBreath();
      setTimeout(() => { caption('“…그 사람은, 내려오지 않았어.”'); headLure(25); }, 1800);
    }, 3800);
  }
}

/* ---------- 사물함 수색 · 소모품 · 수집품 · 방 미니게임 · 칠판 · 초자연 현상 ----------
   수색 지점(kind 'search'): 교실 뒤 사물함 · 복도 사물함(숨는 칸 양옆) · 체육관/수영장 탈의실. 내용물은 지점 순서로 정해져(시드 고정) 저장/복원과 맞는다.
   방 미니게임(kind 'mspot'): 방마다 하나씩 — 보답은 처음 한 번 (FL.ms). 칠판(kind 'chalk'): 교실마다 분필로 질문 */
const XT = { search: null, para: 75 + Math.random() * 40, paraLast: [], mbox: null };
{
  const roomC = (f, name) => {
    const an = f >= 8, rows = an ? [[ANNEX.floors[f - 8], ANNEX.slots, false], [ANNEX_S[f - 8], ANNEX.slots, true]] : [[LAYOUT[f], SLOTS, false], [LAYOUT_S[f], SLOTS, true]];
    for (const [L, sl, south] of rows) { if (!L) continue; const i = L.names.indexOf(name); if (i >= 0) return { cx: sl[i], south }; }
    return null;
  };
  const free = (F, x, z, r = .32) => { const hit = (a, b) => F.col.some(c => a > c.x1 - r && a < c.x2 + r && b > c.z1 - r && b < c.z2 + r);
    if (!hit(x, z)) return [x, z]; for (let k = 1; k < 16; k++) for (let a = 0; a < 8; a++) { const ax = x + Math.cos(a * .785) * k * .18, az = z + Math.sin(a * .785) * k * .18; if (!hit(ax, az)) return [ax, az]; } return [x, z]; };
  // 1) 수색 지점
  const spots = [];
  for (let f = 0; f <= 2; f++) {
    LAYOUT[f].types.forEach((t, i) => { if (t === 'class') spots.push({ f, x: SLOTS[i] - 2.65, z: -2.35, where: LAYOUT[f].names[i], what: '교실 사물함' }); });
    LAYOUT_S[f].types.forEach((t, i) => { if (t === 'class') spots.push({ f, x: SLOTS[i] + 2.65, z: 2.35, where: LAYOUT_S[f].names[i], what: '교실 사물함' }); });
    [1, 3, 6, 8].forEach(i => [0, 2].forEach(k => spots.push({ f, x: SLOTS[i] + 2.35 + k * .66, z: -.75, where: '복도', what: '복도 사물함' })));
  }
  spots.push({ f: 5, x: 28.9, z: 22.9, where: '체육관', what: '체육관 사물함' }, { f: 6, x: -46.1, z: 25.6, where: '수영장 탈의실', what: '탈의실 사물함' }, { f: 6, x: -47.6, z: 25.6, where: '수영장 탈의실', what: '탈의실 사물함' });
  // 내용물: 수집품 14 → 소모품 → 기본 물품 → 초자연 현상 → 빈 칸 (시드 고정 셔플)
  let seed = 20061012; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const order = spots.map((_, i) => i).sort(() => rng() - .5);
  const pool = [...COLLECT.map(c => ({ col: c.id })),
    ...['candy', 'candy', 'candy', 'candy', 'thermos', 'thermos', 'salt', 'salt', 'salt', 'charm', 'charm', 'musicbox', 'musicbox', 'matches', 'matches', 'matches'].map(k => ({ item: k })),
    ...['battery', 'battery', 'battery', 'battery', 'medkit', 'medkit', 'can', 'can', 'hairpin'].map(k => ({ item: k })),
    ...LOCKER_SCARES.map(sc => ({ scare: sc.k }))];
  order.forEach((si, n) => { spots[si].loot = pool[n] || {}; });
  spots.forEach((sp, i) => {
    const F = floors[sp.f]; if (!F) return;
    world.props.push({ kind: 'search', floor: sp.f, x: sp.x, z: sp.z, y: 1.0, label: `${sp.what} 뒤지기`, loot: sp.loot, where: sp.where, uid: `srch:${i}` });
  });
  // 2) 방 미니게임 지점
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .7, ...o });
  const box = (g, w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
  const LOOKS = {
    xylo: g => { box(g, .9, .7, .4, 0, .35, 0, M(0x5a3a22)); ['#c84a3a', '#d8b040', '#4aa86a', '#4a7ad0', '#a050c0', '#e08040'].forEach((c, i) => box(g, .1, .03, .3 - i * .03, -.3 + i * .12, .72, 0, M(c))); },
    pc: g => { box(g, .9, .74, .6, 0, .37, 0, M(0x6a6a64)); box(g, .42, .34, .3, 0, .95, -.05, M(0xc8bfa8)); const sc = new THREE.Mesh(new THREE.PlaneGeometry(.34, .24), new THREE.MeshBasicMaterial({ color: 0x3a6ab0 })); sc.position.set(0, .96, .101); g.add(sc); },
    radioTop: g => { box(g, .44, .26, .2, 0, .13, 0, M(0x6a4a2a)); box(g, .26, .09, .01, -.04, .15, .101, M(0xd8c890, { emissive: 0x403010, emissiveIntensity: .6 })); const k = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .02, 12), M(0x222222)); k.rotation.x = Math.PI / 2; k.position.set(.14, .14, .105); g.add(k); },
    radio: g => { box(g, .7, .74, .5, 0, .37, 0, M(0x4a3a2a)); box(g, .5, .28, .2, 0, .88, 0, M(0x6a4a2a)); box(g, .3, .1, .01, -.05, .9, .101, M(0xd8c890, { emissive: 0x403010, emissiveIntensity: .6 })); },
    beaker: g => { box(g, 1.0, .9, .6, 0, .45, 0, M(0x2a2e30)); [0, .2, -.2].forEach((x, i) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, .16, 12), M([0x60a0e0, 0xe0d060, 0xd06060][i], { transparent: true, opacity: .75, roughness: .1 })); b.position.set(x, .98, 0); g.add(b); }); },
    hoop: g => { box(g, .7, .6, .45, 0, .3, 0, M(0x3a3a40, { metalness: .4 })); [-.18, .18].forEach(x => { const b = new THREE.Mesh(new THREE.SphereGeometry(.12, 14, 10), M(0xc85a20)); b.position.set(x, .72, 0); g.add(b); }); },
    gacha: g => { box(g, .55, .9, .5, 0, .45, 0, M(0xc83a3a)); const dome = new THREE.Mesh(new THREE.SphereGeometry(.26, 16, 12), M(0xdde8ee, { transparent: true, opacity: .35, roughness: .05 })); dome.position.y = 1.15; g.add(dome); for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), M([0xe0c040, 0x40a0e0, 0xe06090][i % 3])); c.position.set(Math.sin(i) * .14, 1.02 + (i % 3) * .06, Math.cos(i * 1.7) * .12); g.add(c); } box(g, .16, .16, .04, 0, .6, .26, M(0xe8e0c8)); },
    ouija: g => { box(g, .9, .74, .6, 0, .37, 0, M(0x4a3a2a)); box(g, .6, .01, .4, 0, .745, 0, M(0xc8a878)); const pl = new THREE.Mesh(new THREE.ConeGeometry(.06, .02, 3), M(0xe8dcc0)); pl.position.set(.05, .76, .02); g.add(pl); const cnd = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .14, 8), M(0xf0e8d8, { emissive: 0xff9040, emissiveIntensity: .3 })); cnd.position.set(-.35, .82, -.2); g.add(cnd); },
    easel: g => { box(g, .05, 1.5, .05, -.25, .75, 0, M(0x8a6a44)); box(g, .05, 1.5, .05, .25, .75, 0, M(0x8a6a44)); box(g, .7, .55, .03, 0, 1.15, .04, M(0xe8e0d0)); },
    projector: g => { box(g, .8, .74, .5, 0, .37, 0, M(0x3a3a3a)); box(g, .36, .22, .32, 0, .86, 0, M(0x2a2a2c, { metalness: .4 })); const l = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .1, 12), M(0x111111)); l.rotation.x = Math.PI / 2; l.position.set(0, .86, .2); g.add(l); },
    drum: g => { const d = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .3, 18), M(0xb03a2a)); d.position.y = .5; g.add(d); const sn = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .16, 16), M(0xd8d8d8, { metalness: .5 })); sn.position.set(.42, .62, 0); g.add(sn); },
  };
  const MS = [
    { id: 'music', f: 2, room: '음악실', dx: -1.6, d: 3.4, look: 'xylo', label: '실로폰 — 남겨진 음 따라 치기', game: 'simon', opts: { title: '실로폰 — 하늘의 연습곡' }, reward: { col: 'c07', item: { candy: 1 } }, cap: '마지막 음이 끝나자, 누군가 박수를 쳤다. 두 번.' },
    { id: 'comp', f: 1, room: '컴퓨터실', dx: 1.8, d: 3.4, look: 'pc', label: '고장 난 PC — 깨진 파일 복구', game: 'memory', opts: { title: '깨진 파일 아이콘 짝 맞추기', icons: ['💾', '🖥', '📁', '🖨', '📀', '⌨'] }, reward: { item: { battery: 2 } }, cap: '복구된 폴더 이름: 「HANEUL_방송원고_최종_진짜최종」' },
    { id: 'bcast', f: 2, x: -20.45, z: -2.72, onTop: .7, look: 'radioTop', label: '낡은 라디오 — 주파수 맞추기', game: 'tune', opts: { title: '라디오 주파수', label: '…3학년 2반 윤하늘입니다. 오늘도 수고 많았어요…' }, reward: { item: { charm: 1 } }, cap: '라디오가 꺼진 뒤에도 목소리가 한 마디 더 이어졌다. “…고마워.”' },
    { id: 'lab', f: 1, room: '과학실', dx: 1.4, d: 4.2, look: 'beaker', label: '실험대 — 비커 눈금 맞추기', game: 'timing', opts: { title: '시약 붓기', hint: '눈금이 <b style="color:#60e0a0">초록 구간</b>일 때 <b>Space</b> — 조금이라도 넘치면 실패', icon: '🧪', okText: '딱 맞다', missText: '넘쳤다…' }, reward: { item: { salt: 2 } }, cap: '비커 바닥에 하얀 결정이 맺혔다 — 굵은 소금이다.' },
    { id: 'gym', f: 5, x: 32.4, z: 18.5, look: 'hoop', label: '농구공 — 자유투 던지기', game: 'timing', opts: { title: '자유투 (5번 중 3골)', hint: '공이 <b style="color:#60e0a0">초록 구간</b>에 오면 <b>Space</b>', icon: '🏀', okText: '골!', missText: '림을 맞고 튀었다…' }, reward: { item: { candy: 2 } }, replay: true, cap: '마지막 골이 들어가자, 텅 빈 관람석에서 환호성이 아주 작게 들렸다.' },
    { id: 'cafe', f: 7, x: -30.7, z: 15.6, look: 'gacha', label: '뽑기 기계 돌리기', game: 'gacha', replay: true },
    { id: 'counsel', f: 0, room: '상담실', dx: 0, d: 3.6, look: 'ouija', label: '분신사바 판 — 질문하기', game: 'ouija', opts: { title: '분신사바', qs: OUIJA_QS }, reward: { item: { charm: 1, matches: 1 } }, cap: '촛불이 혼자 꺼졌다.', scare: true },
    { id: 'art', f: 2, room: '미술실', dx: -1.2, d: 4.0, look: 'easel', label: '이젤 — 그림 조각 짝 맞추기', game: 'memory', opts: { title: '찢긴 그림 조각 짝 맞추기', icons: ['🎨', '🖌', '🗿', '🖼', '✏', '📐', '🌙'] }, reward: { col: 'c06', item: { thermos: 1 } }, cap: '맞춰진 그림 속 소녀가, 눈을 깜빡인 것 같다.' },
    { id: 'av', f: 1, room: '시청각실', dx: 0, d: 3.8, look: 'projector', label: '영사기 — 초점 맞추기', game: 'timing', opts: { title: '영사기 초점', hint: '흐릿한 화면이 또렷해지는 순간 <b>Space</b>', icon: '🎞', okText: '또렷해졌다', missText: '흐려졌다…' }, reward: { item: { matches: 2 } }, cap: '스크린에 졸업식 장면이 비친다. 3학년 2반 줄, 한 자리가 비어 있다.' },
    { id: 'club', f: 9, room: '동아리실 (204)', dx: 1.2, d: 3.6, look: 'drum', label: '드럼 — 박자 따라 치기', game: 'simon', opts: { title: '밴드부 드럼 — 따라 치기', pads: ['킥', '스네어', '하이햇', '심벌'], notes: [110, 196, 523, 784] }, reward: { item: { musicbox: 1 } }, cap: '마지막 심벌이 울리자 동아리실 불이 한 번 깜빡였다.' },
  ];
  MS.forEach(m => {
    let x = m.x, z = m.z, ry = 0;
    if (m.room) { const r = roomC(m.f, m.room); if (!r) { console.warn('[mspot] 방 없음', m.room); return; } x = r.cx + m.dx; z = r.south ? 1.75 + m.d : -1.75 - m.d; ry = r.south ? Math.PI : 0; }
    const F = floors[m.f]; if (!F) return; if (!m.onTop) [x, z] = free(F, x, z, .5);
    const g = new THREE.Group(); g.position.set(x, m.onTop || 0, z); g.rotation.y = ry; g.userData.dynamic = true; LOOKS[m.look](g); F.interior.add(g);
    if (!m.onTop) F.col.push({ x1: x - .4, x2: x + .4, z1: z - .3, z2: z + .3, h: .9 });   // 가구 위에 올린 것은 새 충돌 없음
    world.props.push({ kind: 'mspot', m, floor: m.f, x, z, y: 1.0, label: m.label, uid: `ms:${m.id}` });
  });
  // 3) 교실 칠판 (분필로 질문하기)
  for (let f = 0; f <= 2; f++) {
    LAYOUT[f].types.forEach((t, i) => { if (t === 'class') world.props.push({ kind: 'chalk', floor: f, x: SLOTS[i] - .6, z: -8.2, y: 1.5, label: '칠판에 분필로 쓰기', br: 'cls' + f + ':' + SLOTS[i], room: LAYOUT[f].names[i], uid: `chalk:${f}:${i}` }); });
    LAYOUT_S[f].types.forEach((t, i) => { if (t === 'class') world.props.push({ kind: 'chalk', floor: f, x: SLOTS[i] + .6, z: 8.2, y: 1.5, label: '칠판에 분필로 쓰기', br: 'cls' + f + ':' + SLOTS[i] + 's', room: LAYOUT_S[f].names[i], uid: `chalk:${f}:s${i}` }); });
  }
}
// ── 사물함 수색: 1.1초 동안 가만히 뒤진다 (움직이면 멈춤 · 작은 소리가 난다)
function startSearch(p) {
  if (p.done || XT.search) return;
  XT.search = { p, t: 0, x: P.x, z: P.z }; sfx.locker ? sfx.locker() : sfx.click(); $('searchBar').classList.add('on'); $('searchBar').querySelector('b').style.width = '0%';
  $('searchBar').firstChild.textContent = `${p.label.replace(' 뒤지기', '')}을 뒤지는 중…`;
}
function searchTick(dt) {
  const S = XT.search; if (!S) return;
  if (state !== 'playing' || Math.hypot(P.x - S.x, P.z - S.z) > .35 || (ghost.active && ghost.floor === P.floor && ghost.state === 'chase')) { XT.search = null; $('searchBar').classList.remove('on'); if (state === 'playing') say('수색을 멈췄다', 1000); return; }
  S.t += dt; P.noiseT = Math.max(P.noiseT, .3); if (Math.random() < dt * 5) sfx.paper();
  $('searchBar').querySelector('b').style.width = Math.min(100, S.t / 1.1 * 100) + '%';
  if (S.t >= 1.1) { XT.search = null; $('searchBar').classList.remove('on'); searchResult(S.p); }
}
let lootTimer = 0;
function lootCard(icon, tag, name, text, scare) {
  const el = $('lootCard'); el.className = scare ? 'scare' : ''; el.innerHTML = `<div class="ic">${iconHTML(icon)}</div><div class="tag">${tag}</div><h4>${name}</h4>${text ? `<p>${text}</p>` : ''}`;
  void el.offsetWidth; el.classList.add('on'); clearTimeout(lootTimer); lootTimer = setTimeout(() => el.classList.remove('on'), scare ? 3200 : 2600);
}
function giveItem(k, n = 1, quiet) { inv[k] = (inv[k] || 0) + n; newItems.add(k); if (!quiet) toast('아이템을 획득했습니다', `${ITEMS[k].name}${n > 1 ? ` ×${n}` : ''}`, 'info'); }
function giveCol(id) {
  FL.col = FL.col || {}; if (FL.col[id]) return false; FL.col[id] = 1; newItems.add(id);
  const n = COLLECT.filter(c => FL.col[c.id]).length;
  if (n === COLLECT.length) { giveItem('charm', 1, true); giveItem('thermos', 1, true); setTimeout(() => { toast('수집품을 모두 모았다', '하늘의 물건 14개 — 보답: 노란 부적 · 보온병 유자차', 'opt'); sfx.win ? sfx.win() : sfx.unlock(); refreshHud(); }, 2800); }
  return true;
}
function searchResult(p) {
  p.done = true; p.label = '비어 있는 사물함'; const L = p.loot || {};
  if (L.col) { const c = COLLECT.find(x => x.id === L.col); giveCol(c.id); sfx.pickup(); lootCard(c.icon, `수집품 ${COLLECT.filter(x => FL.col[x.id]).length} / ${COLLECT.length}`, c.name, c.desc); }
  else if (L.item) { giveItem(L.item, 1, true); sfx.pickup(); lootCard(ITEMS[L.item].icon, '아이템', ITEMS[L.item].name, ITEMS[L.item].desc); }
  else if (L.scare) { paraScare(L.scare); }
  else { sfx.click(); say(['텅 비어 있다', '먼지와 찢어진 교과서뿐이다', '누군가 이미 뒤진 것 같다', '빈 우유갑 하나'][(Math.random() * 4) | 0], 1600); }
  refreshHud(); save(true);
}
function paraScare(k) {
  const sc = LOCKER_SCARES.find(x => x.k === k); shake = .45; fx.glitch(.6); setFace('surprise', 2.4); P.fear = Math.min(1, P.fear + .45);
  ({ hand: () => { sfx.ghostBreath(); sfx.heartbeat(1.2); }, doll: () => { sfx.clank ? sfx.clank(.6) : sfx.click(); setTimeout(() => sfx.ghostGiggle(), 700); }, eyes: () => { sfx.whisper(); }, whisper: () => sfx.ghostWhisper ? sfx.ghostWhisper() : sfx.whisper(), water: () => sfx.drip(), scratch: () => sfx.creak() })[k]?.();
  lootCard('👁', '무언가 있다', '…', sc ? sc.text : '', true); $('paraVig').classList.add('on'); setTimeout(() => $('paraVig').classList.remove('on'), 1600);
  if (k === 'hand' || k === 'doll') { P.noiseT = Math.max(P.noiseT, 1.5); }
}
// ── 소모품
function useSalt() {
  const G = ghost, d = G.active && G.floor === P.floor ? Math.hypot(G.x - P.x, G.z - P.z) : 99;
  if (d > 6) return '뿌릴 대상이 없다 — 그것이 가까이 왔을 때 쓰자.';
  inv.salt--; closeUI(); sfx.splash ? sfx.splash() : sfx.paper(); fx.dust(P.x, floors[P.floor].y0 + 1, P.z, 18); shake = .3;
  setTimeout(() => { if (!G.enraged) ghostLeave(); else { G.slowT = 6; G.state = 'search'; G.hunt = null; G.path = []; } caption('소금이 닿자 그것이 몸을 뒤틀며 물러났다'); sfx.ghostCrack ? sfx.ghostCrack() : sfx.screech(); }, 200);
  refreshHud(); return '';
}
function placeMusicBox() {
  if (state !== 'playing') return; inv.musicbox--; refreshHud();
  const F = floors[P.floor], x = P.x, z = P.z, f = P.floor;
  XT.mbox = { f, x, z, t: 12 }; caption('오르골 태엽을 감아 바닥에 내려놓았다 — 어서 떨어지자');
  at(x, F.y0 + .2, z).musicBox(16, .7);
  const G = ghost;
  if (G.active && !G.enraged && G.floor === f) { G.state = 'search'; G.target = { x, z }; G.path = []; G.replan = 0; G.wait = 0; G.hunt = null; G.lureT = 14; }
}
function strikeMatch() {
  if (state !== 'playing') return; inv.matches--; refreshHud(); sfx.spark ? sfx.spark() : sfx.click(); fx.spark && fx.spark(P.x, floors[P.floor].y0 + 1.3, P.z);
  const G = ghost, d = G.active && G.floor === P.floor ? Math.hypot(G.x - P.x, G.z - P.z) : 99;
  blackout = 0; $('paraVig').classList.remove('on');
  if (d < 9) { G.slowT = 8; G.hunt = null; caption('성냥불이 확 일었다 — 그것이 멈칫한다'); } else caption('성냥불에 주변이 잠깐 따뜻해진다');
  P.fear = Math.max(0, P.fear - .25);
}
// ── 방 미니게임
async function useMiniSpot(p) {
  const m = p.m; FL.ms = FL.ms || {};
  if (m.game === 'gacha') { gacha(p); return; }
  if (FL.ms[m.id] && !m.replay) { say('이미 끝냈다', 1200); return; }
  const r = await mini(m.game, m.opts || {}); if (!r.ok) { if (m.scare && Math.random() < .6) { sfx.ghostLaugh ? sfx.ghostLaugh() : sfx.whisper(); fx.glitch(.5); caption('말판이 손끝에서 미끄러졌다. 웃음소리.'); } return; }
  const first = !FL.ms[m.id]; FL.ms[m.id] = (FL.ms[m.id] || 0) + 1;
  if (m.cap) setTimeout(() => caption(m.cap), 500);
  if (m.scare) { fx.glitch(.5); sfx.whisper(); }
  if (first && m.reward) {
    const got = [];
    if (m.reward.col && giveCol(m.reward.col)) { const c = COLLECT.find(x => x.id === m.reward.col); got.push(c.name); lootCard(c.icon, '수집품', c.name, c.desc); }
    Object.entries(m.reward.item || {}).forEach(([k, n]) => { giveItem(k, n, true); got.push(`${ITEMS[k].name} ×${n}`); });
    toast('보답을 얻었다', got.join(' · '), 'opt'); if (!m.reward.col) { const k0 = Object.keys(m.reward.item || {})[0]; if (k0) lootCard(ITEMS[k0].icon, '보답', ITEMS[k0].name, ITEMS[k0].desc); }
    if (!m.replay) { p.done = true; p.label = m.label.split(' — ')[0] + ' (끝)'; }
  } else if (m.replay) say(`또 성공! (${FL.ms[m.id]}번째)`, 1400);
  refreshHud(); save(true);
}
function gacha(p) {
  FL.ms = FL.ms || {}; const n = FL.ms.cafe || 0;
  if (n >= 3) { sfx.buzz(); say('손잡이가 더 이상 돌아가지 않는다. 안이 텅 비었다.', 2000); p.done = true; p.label = '뽑기 기계 (빈 통)'; return; }
  FL.ms.cafe = n + 1; sfx.dial(); setTimeout(() => sfx.dial(), 220); setTimeout(() => sfx.clank ? sfx.clank(.5) : sfx.click(), 700);
  const table = [['candy', '🍭'], ['matches', '🔥'], ['battery', '🔋'], ['salt', '🧂'], ['can', '🥫']], k = n === 2 && !(FL.col || {}).c11 ? null : table[(Math.random() * table.length) | 0][0];
  setTimeout(() => {
    if (!k) { giveCol('c11'); const c = COLLECT.find(x => x.id === 'c11'); lootCard(c.icon, '캡슐 속 — 수집품', c.name, c.desc); }
    else { giveItem(k, 1, true); lootCard(ITEMS[k].icon, `캡슐 ${n + 1} / 3`, ITEMS[k].name, ITEMS[k].desc); }
    if (n === 1) setTimeout(() => { sfx.ghostGiggle(); caption('“나도 한 번만…” — 아이 목소리가 바로 뒤에서'); }, 1800);
    refreshHud(); save(true);
  }, 900);
}
// ── 칠판: 질문을 쓰면 대답이 적힌다 (3D 칠판 텍스처도 바뀐다)
let chalkProp = null, chalkBusy = false;
function openChalk(p) {
  chalkProp = p; chalkBusy = false; $('chalkTitle').textContent = `${p.room} 교실 칠판`;
  $('chalkBoard').innerHTML = '<span style="opacity:.55">분필 가루가 남아 있다. 무엇을 써 볼까…</span>';
  $('chalkOpts').innerHTML = CHALK_QA.map((q, i) => `<button class="btn" data-i="${i}">${q.q}</button>`).join('') + '<button class="btn" data-i="-1">그만둔다</button>';
  $('chalkOpts').querySelectorAll('button').forEach(b => { b.onclick = () => chalkAsk(+b.dataset.i); });
  openUI('chalk'); sfx.paper();
}
function chalkType(el, text, ms, done) { let i = 0; const iv = setInterval(() => { el.textContent = text.slice(0, ++i); if (i % 2) sfx.click(); if (i >= text.length) { clearInterval(iv); done && done(); } }, ms); }
function chalkAsk(i) {
  if (chalkBusy) return; if (i < 0) { closeUI(); return; }
  const qa = CHALK_QA[i], a = FL.mina && qa.mina ? qa.mina : FL.calm && qa.calm ? qa.calm : qa.a;
  chalkBusy = true; const B = $('chalkBoard'); B.innerHTML = '<div class="q"></div><div class="reply" style="margin-top:22px"></div>';
  chalkType(B.querySelector('.q'), qa.q, 70, () => setTimeout(() => {
    sfx.creak(); fx.glitch(.25);
    chalkType(B.querySelector('.reply'), '— ' + a, 140, () => {
      FL.chalk = (FL.chalk || 0) + 1; chalkBusy = false; sfx.whisper(); P.fear = Math.min(1, P.fear + .2);
      const br = world.boardRefs[chalkProp.br]; if (br && br.mat) { br.mat.map = world.makeBoardTex([qa.q, '— ' + a]); br.mat.needsUpdate = true; }
      if (FL.chalk === 1) toast('칠판', '누군가 대답했다 — 다른 교실 칠판에도 물어볼 수 있다', 'info');
      if (Math.random() < .18 && !FL.calm) setTimeout(() => { if (state !== 'ui') return; B.innerHTML = '<div class="reply" style="font-size:22px;line-height:1.2">' + '다시, 여기서. '.repeat(26) + '</div>'; sfx.screech(); fx.glitch(.8); shake = .4; if (br && br.mat) { br.mat.map = world.makeBoardTex(['다시, 여기서', '다시, 여기서', '다시, 여기서']); br.mat.needsUpdate = true; } }, 1400);
    });
  }, 900));
}
$('chalkClose').onclick = () => closeUI();
// ── 초자연 현상 감독: 쫓기지 않을 때 1~2분마다 하나씩 (장이 진행될수록 잦아진다)
function paraEvent(force) {
  if (!force && (state !== 'playing' || P.hiding || (ghost.active && ghost.floor === P.floor && (ghost.state === 'chase' || ghost.hunt)))) return false;
  if (TEST && TST.noGhost && !force) return false;
  const OUT_OK = ['giggle', 'name', 'cold', 'steps', 'scream', 'bell', 'torch', 'count', 'sob'], out = isOutdoors();
  const pool = PARA.filter(e => !XT.paraLast.includes(e.k) && !(e.k === 'piano' && P.floor !== 2) && !(e.k === 'drag' && P.floor === 2) && !(e.k === 'shadow' && Math.abs(P.z) > 1.6)
    && !(out && !OUT_OK.includes(e.k)) && !(e.k === 'rattle' && !world.lockers.some(l => l.floor === P.floor)) && !(e.k === 'chair' && P.floor > 2 && P.floor < 8) && !(e.k === 'torch' && !P.light) && !(e.k === 'thump' && P.floor === 3));
  const e = typeof force === 'string' ? PARA.find(x => x.k === force) : pool[(Math.random() * pool.length) | 0]; if (!e) return false;
  XT.paraLast.push(e.k); if (XT.paraLast.length > 5) XT.paraLast.shift();
  const F = floors[P.floor];
  const fxs = {
    door: () => { const d = world.doorList.filter(d => d.floor === P.floor && d.target > .5 && Math.hypot(d.x - P.x, d.z - P.z) > 3 && Math.hypot(d.x - P.x, d.z - P.z) < 16).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0]; if (d) { d.target = 0; at(d.x, F.y0 + 1.2, d.z).doorBang(0, 1); } else sfx.doorBang(0, .6); shake = .25; },
    giggle: () => sfx.ghostGiggle(), drag: () => sfx.ghostDrag(), knock: () => sfx.knock(), ball: () => sfx.ball(), piano: () => sfx.note(185), sob: () => sfx.ghostSob(),
    lights: () => { sfx.lightsOff(); [0, 380, 760].forEach(t => setTimeout(() => { blackout = Math.max(blackout, .22); }, t)); },
    phone: () => { sfx.vibrate(); toast('📱 발신: 3-2 교실', '신호 없음 — 그런데 벨이 울린다', 'warn'); },
    cold: () => { sfx.ghostBreath(); $('paraVig').classList.add('on'); setTimeout(() => $('paraVig').classList.remove('on'), 2400); },
    shadow: () => { const fx2 = -Math.sin(P.yaw), fz2 = -Math.cos(P.yaw); let d = 0; while (d < 16 && los(F.walls, P.x, P.z, P.x + fx2 * (d + .5), P.z + fz2 * (d + .5))) d += .5; if (d > 7) { const ax = P.x + fx2 * (d - 1), az = P.z + fz2 * (d - 1); showApparition(P.floor, ax, az, Math.atan2(P.x - ax, P.z - az), 1.1, null); sfx.ghostBreath(); } else sfx.ghostStep && sfx.ghostStep(4, 0); },
    name: () => { sfx.whisper(); setTimeout(() => caption(`“…${CH().name}.”`), 900); },
    steps: () => { for (let i = 0; i < 7; i++) setTimeout(() => { if (state !== 'playing') return; const d = 2.2 + Math.max(0, 4 - i) * .4; at(P.x + Math.sin(P.yaw) * d, F.y0 + .1, P.z + Math.cos(P.yaw) * d).stepBehind(.8 + i * .05); if (i === 6) setTimeout(() => at(P.x + Math.sin(P.yaw) * .8, F.y0 + 1.6, P.z + Math.cos(P.yaw) * .8).ghostBreath(), 500); }, 400 + i * 520); },
    scream: () => { sfx.scream(); setTimeout(() => { blackout = Math.max(blackout, .15); }, 1600); },
    thump: () => { sfx.thump(4); [0, 640, 1280, 1920].forEach(t => setTimeout(() => { shake = Math.max(shake, .12); fx.dust(P.x + (Math.random() - .5) * 3, F.y0 + 3.4, P.z + (Math.random() - .5) * 3, 8); }, t)); },
    chair: () => { const a = Math.random() * 6.28; at(P.x + Math.cos(a) * 7, F.y0 + .4, P.z + Math.sin(a) * 7).chairScrape(); },
    torch: () => { sfx.flashlightClick(); let n = 0; const fl = () => { if (state !== 'playing') return; P.light = !P.light; n++; if (n < 5) setTimeout(fl, 90 + Math.random() * 160); else setTimeout(() => { if (!P.light) { P.light = true; sfx.flashlightClick(); } }, 1900); }; fl(); setTimeout(() => sfx.ghostBreath(), 900); },
    hands: () => paraHands(),
    eyes: () => paraEyes(),
    bell: () => { sfx.bellFar(); fx.glitch(.2); },
    radio: () => { sfx.radioVoice(); fx.glitch(.35); },
    rattle: () => { const l = world.lockers.filter(o => o.floor === P.floor).sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0]; at(l.x, F.y0 + 1, l.z).rattle(18); },
    bleed: () => paraBleed(),
    count: () => { ['하나…', '둘…', '셋…', '넷…', '다섯…'].forEach((t, i) => setTimeout(() => { if (state === 'playing') { caption(`(속삭임) ${t}`); sfx.whisper(); } }, 1200 + i * 1100)); setTimeout(() => { if (state !== 'playing') return; caption('“…찾았다.”'); sfx.stinger(.8); at(P.x + Math.sin(P.yaw) * 1.2, F.y0 + 1.5, P.z + Math.cos(P.yaw) * 1.2).ghostGiggle(); shake = .4; fx.glitch(.6); setFace('surprise', 2); }, 7200); },
    heart: () => { sfx.heartWall(); for (let i = 0; i < 6; i++) setTimeout(() => { shake = Math.max(shake, .06); }, i * 820); },
    glass: () => { const a = Math.random() * 6.28; at(P.x + Math.cos(a) * 5, F.y0 + 1.6, P.z + Math.sin(a) * 5).glassCrack(); },
  };
  fxs[e.k] && fxs[e.k](); caption(e.text.replace(/<[^>]+>/g, '')); setFace('fear', 2.2); P.fear = Math.min(1, P.fear + .3);
  return true;
}
/* ---------- 초자연 현상 2: 손자국 · 붉은 눈 · 핏방울 · 화장실 괴담 · 주변 소리 ---------- */
const tmpFx = [];   // 잠깐 나타났다 사라지는 3D 연출 (각자 재질을 복제해 투명도를 따로 조절)
function addTmp(f, o, life, fadeIn = .4, fadeOut = 1.2) {
  o.userData.dynamic = true; o.traverse(m => { if (m.material) { m.material = m.material.clone(); m.material.transparent = true; m.material.userData.op = m.material.opacity; m.material.opacity = 0; } });
  floors[f].interior.add(o); const e = { o, t: 0, life, fadeIn, fadeOut, f }; tmpFx.push(e); return e;
}
function tmpTick(dt) {
  for (let i = tmpFx.length - 1; i >= 0; i--) {
    const e = tmpFx[i]; e.t += dt; if (e.o.userData.tick) e.o.userData.tick(e);
    const k = Math.min(1, e.t / e.fadeIn, Math.max(0, e.life - e.t) / e.fadeOut);
    e.o.traverse(m => { if (m.material) m.material.opacity = (m.material.userData.op ?? 1) * k; });
    if (e.t >= e.life) { e.o.parent?.remove(e.o); e.o.traverse(m => { m.geometry?.dispose(); m.material?.dispose(); }); tmpFx.splice(i, 1); }
  }
}
// 바라보는 방향의 가장 가까운 벽 (축 정렬 벽으로 가정)
function wallAhead(maxD = 9) {
  const F = floors[P.floor], fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); let d = .5;
  while (d < maxD && los(F.walls, P.x, P.z, P.x + fx * d, P.z + fz * d)) d += .2;
  const ry = Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? -Math.PI / 2 : Math.PI / 2) : (fz > 0 ? Math.PI : 0);
  return { d, fx, fz, ry, x: P.x + fx * (d - .25), z: P.z + fz * (d - .25), hit: d < maxD };
}
let _handTex = null, _poolTex = null;
function paraHands() {
  const w = wallAhead(7); if (!w.hit || w.d < 1.4) { sfx.knock(); return; }
  const f = P.floor, tx = Math.cos(w.ry), tz = -Math.sin(w.ry), wet = Math.random() < .5;
  _handTex ||= makeBlood('hand');
  for (let i = 0; i < 6; i++) setTimeout(() => {
    if (P.floor !== f) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.42, .42), new THREE.MeshStandardMaterial({ map: _handTex, transparent: true, depthWrite: false, roughness: .15, color: wet ? 0x5a6266 : 0xffffff, polygonOffset: true, polygonOffsetFactor: -4 }));
    const o = (i - 2.5) * .42; m.position.set(w.x + tx * o, .95 + Math.random() * .7, w.z + tz * o); m.rotation.set(0, w.ry, (Math.random() - .5) * .8);
    addTmp(f, m, 14, .15, 3); at(m.position.x, floors[f].y0 + m.position.y, m.position.z).slap();
  }, 300 + i * 380);
}
function paraEyes() {
  const w = wallAhead(12), d = Math.min(w.d - .4, 9); if (d < 4) { sfx.ghostBreath(); return; }
  const f = P.floor, g = new THREE.Group(), tex = makeGlowTex('255,40,24');
  [-.065, .065].forEach(dx => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xff3020, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.scale.setScalar(.16); sp.position.x = dx; g.add(sp); });
  g.position.set(P.x + w.fx * d, 1.42, P.z + w.fz * d); g.rotation.y = P.yaw;
  g.userData.tick = e => { const blink = Math.sin(e.t * 9) > .93 ? 0 : 1; g.scale.set(1, blink ? 1 : .1, 1); const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), dx = g.position.x - P.x, dz = g.position.z - P.z, D = Math.hypot(dx, dz); if (P.light && (dx * fx + dz * fz) / D > .985 && e.t > .8 && e.life > e.t + .4) e.life = e.t + .35; };
  addTmp(f, g, 3.2, .5, .5); at(g.position.x, floors[f].y0 + 1.4, g.position.z).ghostBreath();
}
function paraBleed() {
  const f = P.floor, F = floors[f], w = wallAhead(4), d = Math.min(1.8, w.d - .5), x = P.x + w.fx * d, z = P.z + w.fz * d;
  for (let i = 0; i < 12; i++) setTimeout(() => { if (P.floor !== f) return; fx.emit(x + (Math.random() - .5) * .1, F.y0 + 3.45, z + (Math.random() - .5) * .1, 0, -1, 0, 1.2, [.32, .01, .01], .9, .025, 9.5); if (i % 3 === 0) at(x, F.y0 + .1, z).drip(); }, 200 + i * 260);
  _poolTex ||= makeBlood('pool');
  setTimeout(() => { if (P.floor !== f) return; const m = new THREE.Mesh(new THREE.PlaneGeometry(.9, .9), new THREE.MeshStandardMaterial({ map: _poolTex, transparent: true, depthWrite: false, roughness: .1, polygonOffset: true, polygonOffsetFactor: -4 })); m.rotation.x = -Math.PI / 2; m.position.set(x, .015, z); addTmp(f, m, 25, 2.5, 4); }, 700);
}
// 화장실 괴담
const TE = { t: 6, last: [] };
const tPos = (r, lx, lz, ry = 0) => r.south ? { x: 2 * r.cx - lx, z: -lz, ry: ry + Math.PI } : { x: lx, z: lz, ry };
const stallDoor = (f, r, n) => world.doorList.find(o => o.stall && o.floor === f && o.stallNo === n && Math.abs(o.x - r.cx) < 4);
function toiletTick(f, room, step) {
  if (!room || room.type !== 'toilet' || P.hiding) { TE.t = Math.max(TE.t, 6); return; }
  if (state !== 'playing' || (ghost.active && ghost.floor === f && (ghost.state === 'chase' || ghost.hunt))) return;
  TE.t -= step; if (TE.t > 0) return;
  TE.t = 20 + Math.random() * 20;
  const fem = (room.south || f === 2) && !(f === 8 || f === 10);   // 여자화장실에서만 3번 칸 실내화 · 빨간 휴지 파란 휴지
  const ks = Object.keys(TOILET_FX).filter(k => fem || k !== 'shoes').concat(FL.redblue || !fem ? [] : ['tissue', 'tissue']).filter(k => !TE.last.includes(k));
  const k = ks[(Math.random() * ks.length) | 0]; TE.last.push(k); if (TE.last.length > 3) TE.last.shift();
  toiletFx(k, f, room);
}
function toiletFx(k, f, r) {
  const F = floors[f], X1 = r.cx + 3.85, X0 = r.cx - 3.85, y0 = F.y0;
  if (k !== 'tissue') { caption(TOILET_FX[k]); P.fear = Math.min(1, P.fear + .2); setFace('fear', 2); }
  if (k === 'faucet') {
    const z = [-6.9, -6.0, -5.1, -4.2][(Math.random() * 4) | 0], p = tPos(r, X1 - .21, z), rusty = Math.random() < .6;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.007, .01, .19, 8), new THREE.MeshStandardMaterial({ color: rusty ? 0x8a4a2a : 0xa8c8d0, roughness: .05, transparent: true, opacity: .75 }));
    m.position.set(p.x, .875, p.z); m.userData.tick = e => { m.scale.x = m.scale.z = .8 + Math.random() * .5; if (Math.random() < .3) fx.emit(p.x, y0 + .8, p.z, (Math.random() - .5) * .4, .4, (Math.random() - .5) * .4, .3, rusty ? [.5, .28, .16] : [.7, .8, .85], .4, .015, 6); };
    addTmp(f, m, 6.5, .2, .4); at(p.x, y0 + .9, p.z).faucet(6);
  } else if (k === 'flush') { const i = (Math.random() * 4) | 0, p = tPos(r, X0 + i * 1.1 + .55, -9.2); at(p.x, y0 + .5, p.z).flush(); }
  else if (k === 'stall') { const ds = [1, 2, 3, 4].map(n => stallDoor(f, r, n)).filter(d => d && d.target > .5); const d = ds[(Math.random() * ds.length) | 0]; if (d) { d.target = 0; d.slam = true; at(d.x, y0 + 1.2, d.z).doorBang(0, 1); } else at(r.cx, y0 + 1.2, -8).knock(); shake = .35; }
  else if (k === 'flicker') { sfx.lightsOff(); [0, 300, 650, 1100].forEach(t => setTimeout(() => { blackout = Math.max(blackout, .3); }, t)); setTimeout(() => sfx.drip(), 1400); }
  else if (k === 'mirror') {
    const p = tPos(r, X1 - .045, -6.4 + Math.random() * 1.8, -Math.PI / 2), word = MIRROR_WORDS[(Math.random() * MIRROR_WORDS.length) | 0];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .3), new THREE.MeshBasicMaterial({ map: makeGraffiti(word, '#a00a0a'), transparent: true, depthWrite: false, color: 0xffd0d0 }));
    m.position.set(p.x, 1.72, p.z); m.rotation.y = p.ry; addTmp(f, m, 10, 2, 2.5); at(p.x, y0 + 1.7, p.z).glassCrack(); setTimeout(() => sfx.ghostWhisper(), 900);
  } else if (k === 'shoes') {
    const d = stallDoor(f, r, 3); if (d && d.target > .5) { d.target = 0; d.slam = true; at(d.x, y0 + 1.2, d.z).doorBang(0, .7); }
    setTimeout(() => {
      if (P.floor !== f) return;
      const p = tPos(r, X0 + 2.75, -7.86), g = new THREE.Group(), white = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: .7 }), trim = new THREE.MeshStandardMaterial({ color: 0x2a4a9a, roughness: .6 });
      [-.09, .09].forEach(dx => { const s1 = new THREE.Mesh(new THREE.BoxGeometry(.09, .06, .24), white); s1.position.set(dx, .03, 0); g.add(s1); const s2 = new THREE.Mesh(new THREE.BoxGeometry(.092, .02, .1), trim); s2.position.set(dx, .07, .05); g.add(s2); });
      g.position.set(p.x, 0, p.z); g.rotation.y = p.ry; g.userData.tick = e => { if (Math.hypot(P.x - p.x, P.z - p.z) < 1.5 && e.life > e.t + .3) { e.life = e.t + .25; sfx.ghostCrack(); } };
      addTmp(f, g, 9, .3, .3); at(p.x, y0 + .8, p.z).ghostSob();
    }, 900);
  } else if (k === 'tissue') toiletTissue(f, r);
}
// "빨간 휴지 줄까, 파란 휴지 줄까?" — 3번 칸의 질문 (한 번만, 선택은 저장된다)
function toiletTissue(f, r) {
  const F = floors[f], p = tPos(r, r.cx - 3.85 + 2.75, -8.6), d = stallDoor(f, r, 3);
  if (d && d.target > .5) { d.target = 0; d.slam = true; at(d.x, F.y0 + 1.2, d.z).doorBang(0, .8); }
  at(p.x, F.y0 + 1.2, p.z).knock();
  setTimeout(() => {
    const rr = roomAt(P.floor, P.x, P.z); if (state !== 'playing' || !rr || rr.id !== r.id) return;
    at(p.x, F.y0 + 1.3, p.z).ghostWhisper(); caption('3번 칸 안에서 — “빨간 휴지 줄까… 파란 휴지 줄까…?”'); setFace('fear', 3); P.fear = Math.min(1, P.fear + .35);
    setTimeout(async () => {
      if (state !== 'playing') return;
      const i = await choose('3번 칸', '닫힌 칸 안에서 아이 목소리가 묻는다.<br><i>“빨간 휴지 줄까, 파란 휴지 줄까?”</i>', [{ label: '빨간 휴지', sub: '…' }, { label: '파란 휴지', sub: '…' }, { label: '아무 대답도 하지 않는다', sub: '숨을 죽이고 기다린다' }]);
      FL.redblue = i + 1;
      if (i === 0) {
        sfx.stinger(1); sfx.screech(); shake = .9; fx.glitch(1); vig('bloodVig', 2600); setFace('surprise', 3); P.hp = Math.max(5, P.hp - 15);
        caption('“빨간 휴지를 줄게.” — 칸막이 아래로 붉은 물이 번져 나온다');
        _poolTex ||= makeBlood('pool'); const q = tPos(r, r.cx - 3.85 + 2.75, -7.5); const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshStandardMaterial({ map: _poolTex, transparent: true, depthWrite: false, roughness: .08, polygonOffset: true, polygonOffsetFactor: -4 })); m.rotation.x = -Math.PI / 2; m.position.set(q.x, .016, q.z); addTmp(f, m, 60, 3, 6);
      } else if (i === 1) {
        sfx.ghostBreath(); sfx.stinger(.6); fx.glitch(.5); vig('frostVig', 4200); P.stamina = 0; P.tired = true; setFace('fear', 3);
        caption('“파란 휴지를 줄게.” — 목이 조여 오듯 숨이 막힌다. 온몸이 얼어붙는다');
      } else {
        sfx.heartbeat(1); setTimeout(() => { if (d) d.target = 1; at(p.x, F.y0 + 1.2, p.z).stallCreak(); caption('…한참 뒤, 3번 칸 문이 스르르 열린다. 아무도 없다. 변기 뚜껑 위에 노란 종이 한 장'); }, 2600);
        setTimeout(() => { giveItem('charm', 1, true); sfx.pickup(); lootCard(ITEMS.charm.icon, '대답하지 않은 대가', ITEMS.charm.name, '“대답하지 않는 아이는 데려가지 않아.” — 칸 안쪽 벽에 연필로 적혀 있다.'); calmDown(30); refreshHud(); }, 5200);
      }
      save(true); refreshHud();
    }, 2000);
  }, 1500);
}
function vig(id, ms) { const v = $(id); if (!v) return; v.classList.add('on'); clearTimeout(v._t); v._t = setTimeout(() => v.classList.remove('on'), ms); }
// 주변 소리: 자막 없이 14~36초마다 어딘가에서 들리는 소리 (긴장감 유지)
const AMB_SFX = [['pipeKnock', 3], ['creak', 3], ['drip', 2], ['wind', 2], ['thump', 1], ['chairScrape', 1], ['buzz', 1], ['ghostWhisper', 1], ['glassCrack', .5], ['ghostStep', 1]];
function ambientTick(dt) {
  XT.amb = (XT.amb ?? 20) - dt; if (XT.amb > 0) return; XT.amb = 14 + Math.random() * 22;
  if (state !== 'playing' || !introDone || P.hiding) return;
  const out = isOutdoors(), list = AMB_SFX.filter(([k]) => !out || ['wind', 'creak', 'ghostWhisper'].includes(k)), tot = list.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * tot, k = list[0][0]; for (const [n, w] of list) { r -= w; if (r <= 0) { k = n; break; } }
  const a = Math.random() * 6.28, d = 6 + Math.random() * 10, y = floors[P.floor].y0 + (k === 'thump' ? 3.6 : 1 + Math.random() * 1.5), S = at(P.x + Math.cos(a) * d, y, P.z + Math.sin(a) * d);
  if (k === 'thump') S.thump(1); else if (k === 'ghostStep') S.stepBehind(.5); else S[k]();
}
/* ====================================================================
   확장 기능: 마이크 소리 감지 · 휴대폰 심령 카메라 · 환각(Sanity) · 조합 3종 · 복도 배전반 · 학교 차임벨 · 그것의 사물함 수색 · 페이크 퇴장
   ==================================================================== */
// ── 1. 마이크 소리 감지 (선택, 기본 끔) ──
async function micStart() {
  if (MIC.on) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); ctx.resume?.(); const src = ctx.createMediaStreamSource(stream); const an = ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
    Object.assign(MIC, { on: true, stream, ctx, an, buf: new Float32Array(an.fftSize), wave: new Float32Array(48) });
    $('micMeter').classList.add('on'); toast('마이크 감지 켜짐', '숨거나 그것이 가까울 때 큰 소리를 내면 들킨다', 'warn'); return true;
  } catch (e) { SET.mic = false; saveSET(); $('setMic') && ($('setMic').checked = false); toast('마이크를 쓸 수 없습니다', '권한이 거부되었거나 마이크가 없습니다 — 기능을 껐습니다', 'warn'); return false; }
}
function micStop() { if (MIC.stream) MIC.stream.getTracks().forEach(t => t.stop()); if (MIC.ctx) MIC.ctx.close().catch(() => {}); Object.assign(MIC, { on: false, level: 0, risk: 0, an: null, stream: null, ctx: null }); $('micMeter').classList.remove('on'); }
function micTick(dt) {
  if (!MIC.on || !MIC.an) return;
  MIC.an.getFloatTimeDomainData(MIC.buf); let s = 0; for (let i = 0; i < MIC.buf.length; i++) s += MIC.buf[i] * MIC.buf[i];
  const rms = Math.sqrt(s / MIC.buf.length), lv = clamp((Math.log10(Math.max(rms, 1e-5)) + 2.6) / 1.9, 0, 1);   // -52dB → 0 · -13dB → 1
  MIC.level = Math.max(lv, MIC.level - dt * 1.6);
  MIC.wave.copyWithin(0, 1); MIC.wave[MIC.wave.length - 1] = lv;
  const G = ghost, near = G.active && G.floor === P.floor && Math.hypot(G.x - P.x, G.z - P.z) < 10, TH = .42;
  if (state === 'playing' && (P.hiding || near) && MIC.level > TH && !schoolPower.isChimeActive) MIC.risk = Math.min(1, MIC.risk + dt * (1.2 + 4 * (MIC.level - TH)));
  else MIC.risk = Math.max(0, MIC.risk - dt * .25);
  if (MIC.risk >= 1) {
    MIC.risk = .3;
    if (G.active && G.floor === P.floor && !G.enraged) {
      if (P.hiding) { const l = P.hiding, dr = l.dir || { x: 0, z: 1 }; G.hunt = { x: l.x + dr.x * .6, z: l.z + dr.z * .6 }; caption('소리를 들었다 — 사물함 쪽으로 곧장 온다'); }
      else { G.state = 'chase'; G.target = { x: P.x, z: P.z }; G.lose = 0; G.path = []; G.replan = 0; caption('네 목소리를 들었다'); }
      sfx.alert(); fx.glitch(.5); shake = .4;
    }
  }
  // 미터: 파형 + 볼륨 · 위험
  const c = $('micCv'), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  g.strokeStyle = MIC.level > TH ? '#ff5a4a' : '#8fd0a0'; g.lineWidth = 2; g.beginPath();
  MIC.wave.forEach((v, i) => { const x = i / (MIC.wave.length - 1) * c.width, y = c.height / 2 + (i % 2 ? -1 : 1) * v * c.height * .45; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(TH * c.width, 0, 1, c.height);
  $('micLv').style.width = MIC.level * 100 + '%'; $('micRisk').style.width = MIC.risk * 100 + '%';
}

// ── 2. 휴대폰 심령 카메라 (오른쪽 클릭 · X · 휴대폰 › 카메라) ──
camera.layers.disable(2);
const ghostTarget = { position: new THREE.Vector3() };
const ghostAim = () => { const G = ghost; if (!G.active || G.floor !== P.floor) return null; ghostTarget.position.set(G.x, floors[G.floor].y0 + 1.4, G.z); return ghostTarget; };
function camMode(on) {
  if (on === ghostCam.isActive) return;
  if (on && (P.pbat ?? 100) <= 1) { say('휴대폰 배터리가 없다', 1600); return; }
  ghostCam.phoneBattery = P.pbat ?? 100;
  ghostCam.toggleCamera(m => say(m, 2200)); CAM.on = ghostCam.isActive;
  if (CAM.on && !FL.camTip) { FL.camTip = true; toast('심령 카메라', '맨눈에 안 보이던 흔적이 화면에 떠오른다 · 클릭/R: 플래시 촬영(20%) · 오른쪽 클릭/X: 끄기', 'info'); }
}
function camShoot() {
  if (!CAM.on) return;
  ghostCam.phoneBattery = P.pbat ?? 100;
  const ok = ghostCam.triggerFlash({ monsterObj: ghostAim(), stunMonsterCallback: sec => stunGhost(sec, null), notifyUI: m => say(m, 2600), onClueCaptured: captureClue });
  P.pbat = ghostCam.phoneBattery; if (ok) { fx.lightning(); fx.glitch(.15); }
}
// 심령 사진: FL.spirit 에 저장(세이브 유지) → 휴대폰 사진 · 메모 탭
function captureClue(c) {
  FL.spirit ||= []; if (FL.spirit.some(x => x.id === c.id)) return;
  FL.spirit.push({ id: c.id, text: c.text, subText: c.subText, t: clockText() }); sfx.pickup(); toast('심령 사진 저장', `${c.text} — 휴대폰 › 사진 · 메모`, 'opt'); save(true);
}
function spiritPhoto(x) {   // 저장된 글씨로 사진을 다시 그린다 (초록 야간투시 톤)
  const c = document.createElement('canvas'); c.width = 320; c.height = 180; const g = c.getContext('2d');
  const gr = g.createRadialGradient(160, 90, 10, 160, 90, 190); gr.addColorStop(0, '#1d3a22'); gr.addColorStop(1, '#030805'); g.fillStyle = gr; g.fillRect(0, 0, 320, 180);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(160,255,180,${Math.random() * .08})`; g.fillRect(Math.random() * 320, Math.random() * 180, 1, 1); }
  g.shadowColor = '#33ff88'; g.shadowBlur = 12; g.fillStyle = '#c8ffd8'; g.font = `bold 24px ${"'Noto Sans KR',sans-serif"}`; g.fillText(x.text, 18, 82);
  g.shadowColor = '#ff1133'; g.fillStyle = '#ff6677'; g.font = '15px sans-serif'; g.fillText(x.subText, 20, 116);
  g.shadowBlur = 0; g.fillStyle = '#ff3b3b'; g.font = 'bold 12px monospace'; g.fillText('● REC ' + (x.t || ''), 14, 20); return c.toDataURL('image/png');
}
function stunGhost(sec, msg) {
  const G = ghost, F = floors[G.floor]; G.stunT = Math.max(G.stunT || 0, sec); G.hunt = null; G.lockSearch = null; G.fake = null; G.state = 'search'; G.path = []; G.replan = 0; G.wait = 0;
  let far = F.nodes[0]; F.nodes.forEach(n => { if (Math.hypot(n.x - P.x, n.z - P.z) > Math.hypot(far.x - P.x, far.z - P.z)) far = n; }); G.target = { x: far.x, z: far.z };
  at(G.x, F.y0 + 1.5, G.z).screech(); fx.glitch(.5); shake = .3; if (msg) caption(msg);
}
// 숨겨진 단서 (카메라로만 보이는 레이어): 층마다 빛나는 발자국 · 벽의 글씨 · 금고 힌트 · 목표 방향 화살표
function buildCamClues() {
  const glowM = (col, op = .9) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const foot = new THREE.PlaneGeometry(.13, .3), footM = glowM(0xffffff, .95);
  const mk = (f, o) => { o.layers.set(CAM.layer); o.userData.dynamic = true; floors[f].interior.add(o); CAM.clues.push(o); return o; };
  const textPlane = (f, txt, w, x, y, z, ry, rx = 0, col = '#c8ffd8') => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: makeGraffiti(txt, col), transparent: true, depthWrite: false, fog: false })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); return mk(f, m); };
  // 발자국: 복도를 따라 계단 쪽에서 방 하나로 이어진다
  [0, 1, 2, 8, 9, 10, 4].forEach((f, k) => {
    if (!floors[f]) return; const x0 = (k % 2 ? -1 : 1) * (6 + k * 2), x1 = x0 + (k % 2 ? -14 : 14);
    for (let i = 0; i < 18; i++) { const t = i / 17, x = x0 + (x1 - x0) * t, z = (i % 2 ? .18 : -.18) + Math.sin(t * 3) * .4; const m = new THREE.Mesh(foot, footM); m.rotation.set(-Math.PI / 2, 0, Math.sign(x1 - x0) > 0 ? -Math.PI / 2 : Math.PI / 2); m.position.set(x, .02, z); mk(f, m); }
    textPlane(f, ['여기 있어', '나를 찾아', '돌아가', '같이 놀자', '3-2', '보고 있어', '밑에 있어'][k], 1.6, x1, 1.6, -1.72, 0, 0, '#ffffff');
  });
  // 금고 힌트: 교무실 금고 앞 바닥의 손글씨 — 그날의 날짜
  const sf = world.props.find(p => p.kind === 'safe');
  if (sf) { const r = roomAt(sf.floor, sf.x, sf.z), cx = r ? r.cx : sf.x, dx = cx - sf.x, dz = -5.6 - sf.z, d = Math.hypot(dx, dz) || 1; textPlane(sf.floor, '10 월 12 일', 1.4, sf.x + dx / d * 1.1, .03, sf.z + dz / d * 1.1, Math.atan2(dx, dz) + Math.PI, -Math.PI / 2, '#ffffff'); }
  // 사용자 지정 심령 단서 3곳 (GhostCameraSystem.createHiddenWallClue · 촬영하면 휴대폰 사진 · 메모에 저장)
  const V = (f, x, y, z) => new THREE.Vector3(x, floors[f].y0 + y, z);
  ghostCam.createHiddenWallClue({ position: V(0, -5.4, 1.75, -9.5), rotationY: 0, text: '금고: 그날의 날짜', subText: '10월 12일 — 네 자리 숫자', clueId: 'sp_safe' });
  ghostCam.createHiddenWallClue({ position: V(1, -35.88, 1.6, .5), rotationY: Math.PI / 2, text: `조각 → ${KEY_WHERE[2]}`, subText: '약품장 맨 아래 칸을 봐', clueId: 'sp_key' });
  ghostCam.createHiddenWallClue({ position: V(0, -28.2, 2.0, -3.0), rotationY: -Math.PI / 2, text: '3번 칸 — 대답하지 마', subText: '거울 속, 네 뒤에 서 있어', clueId: 'sp_toilet' });
  // 목표 방향 화살표 (매 프레임 위치 갱신)
  const ar = new THREE.Mesh(new THREE.ConeGeometry(.12, .4, 12).rotateX(Math.PI / 2), glowM(0xffe070)); ar.layers.set(CAM.layer); ar.userData.dynamic = true; scene.add(ar); CAM.arrow = ar;
}
function camTick(dt) {
  if (ghostCam.isActive || ghostCam.flashCooldown > 0) { ghostCam.phoneBattery = P.pbat ?? 100; ghostCam.update(dt, ghostAim(), state !== 'playing'); P.pbat = ghostCam.phoneBattery; }
  if (CAM.on && !ghostCam.isActive) { CAM.on = false; say('휴대폰 배터리가 꺼졌다', 1800); }
  if (!CAM.on) { if (CAM.arrow) CAM.arrow.visible = false; return; }
  const d = objDir(), ar = CAM.arrow; ar.visible = !!(d && !d.other);
  if (ar.visible) { const fx2 = -Math.sin(P.yaw), fz2 = -Math.cos(P.yaw); ar.position.set(P.x + fx2 * 1.6, floors[P.floor].y0 + 1.25 + Math.sin(tNow * 3) * .05, P.z + fz2 * 1.6); ar.rotation.set(0, d.ang + Math.PI, 0); }
}

// ── 3. 환각 (공포 75% 이상) ──
// 공포 환각 연결 (사용자 제공 SanityHallucinationSystem): 공포 0~100 · 접근성 '공포 화면 효과'를 끄면 실행하지 않는다
const fakeMsgs = [];   // 환각 문자 — 휴대폰 메시지함에 잠시 끼어들었다가 공포가 50% 이하로 내려가면 사라진다 (저장하지 않음)
{ const S = window.sanitySystem, orig = S.triggerFakePhoneNotification.bind(S);
  S.triggerFakePhoneNotification = () => { orig(); fakeMsgs.push({ who: $('sanity-sms-sender').textContent, text: $('sanity-sms-body').textContent, t: clockText() }); refreshHud(); }; }
function sanityTick(dt) {
  const S = window.sanitySystem;
  if (SET.fearFx) S.update(dt, P.fear * 100, state !== 'playing'); else if (S.isActive) S.update(dt, 0, true);
  if (fakeMsgs.length && P.fear <= .5) fakeMsgs.length = 0;
  const gl = document.body.classList.contains('sanity-glitch-frame');   // 화면이 뒤틀리는 순간 시야각 +6° → 원래 FOV 로 부드럽게 (매 프레임 보간)
  if (gl && !SAN.gl && P.fear >= .8) { camera.fov += 6; camera.updateProjectionMatrix(); } SAN.gl = gl;
}

// ── 4. 조합 연결 (사용자 제공 CraftingSystem): 클래스의 인벤토리를 게임 소지품(inv)에 그대로 연결한다 ──
const playerRef = { position: new THREE.Vector3() };   // 플레이어 발 위치 (층 높이 포함) — 조합 · 배전반 시스템 공용
const CRAFT_MAP = { bandage: 'medkit', pill: 'sedative', trap_can: 'alarm', short_bomb: 'shock', med_kit: 'firstaid' };
const CRAFT_ID = { alarm: 'trap_can', shock: 'short_bomb', firstaid: 'med_kit' };
const PS = { get hp() { return P.hp; }, set hp(v) { P.hp = v; }, get fear() { return P.fear * 100; }, set fear(v) { P.fear = clamp(v / 100, 0, 1); }, set staminaInfiniteTimer(v) { P.stamInfT = v; }, get staminaInfiniteTimer() { return P.stamInfT || 0; } };   // 공포는 0~100 으로
const notify = m => say(m, 2800);
// 층이 여러 개라 바닥 높이 · 벽을 게임에 맞춘다. 클래스의 빈 효과음 자리는 게임 효과음으로 채운다
class GameCrafting extends CraftingSystem {
  deployTrap(n) {
    if (P.hiding) return false; const ok = super.deployTrap(n); if (!ok) return ok;
    const T = this.activeTraps[this.activeTraps.length - 1]; T.position.y = playerRef.position.y + .05; T.group.position.y = T.position.y; T.floor = P.floor;
    const cm = new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: .4, metalness: .7 });
    [[0, 0], [.09, .05], [-.08, .06]].forEach(([x, z], i) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.033, .033, .12, 10), cm); c.position.set(x, .08 + (i === 2 ? .12 : 0), z); T.group.add(c); });
    sfx.clank(.4); refreshHud(); return ok;
  }
  throwShortBomb(dir, n, alertFn) {
    const f = P.floor, F = floors[f]; let d = 0; while (d < 4.5 && los(F.walls, P.x, P.z, P.x + dir.x * (d + .25), P.z + dir.z * (d + .25))) d += .25;   // 벽 앞에서 멈춘다
    const ok = super.throwShortBomb(dir.clone().multiplyScalar(d / 4.5), n, (pos, r, st) => { pos.y = F.y0 + .2; alertFn(pos, r, st, f); });
    if (ok) { const m = mkCan(); scene.add(m);
      throws.push({ m, t: 0, dur: 1.15, a: camera.position.clone(), b: new THREE.Vector3(P.x + dir.x * d, F.y0 + .05, P.z + dir.z * d), f, h: .8, kind: 'visual' }); }
    refreshHud(); return ok;
  }
  playThrowSound() { sfx.throwIt(); } playHealSound() { sfx.pickup(); } playTrapTriggerSound() {} playSparkExplosionSound() {}
}
const craftingSystem = window.craftingSystem = new GameCrafting(scene, playerRef);
craftingSystem.inventory.items = new Proxy({}, { get: (_, k) => inv[CRAFT_MAP[k] || k] || 0, set: (_, k, v) => { inv[CRAFT_MAP[k] || k] = v; return true; } });
// 함정 · 쇼트 폭탄이 터질 때: 소리 · 스파크 · 그것을 끌어들이거나 마비 · (함정) 12초 위치 표시
function alertMonsterFn(pos, radius, stunSec, f) {
  const G = ghost; f ??= floors.findIndex(F => F && Math.abs(F.y0 - (pos.y - .05)) < 1.5); const A = at(pos.x, pos.y + .2, pos.z);
  if (stunSec > 0) { for (let k = 0; k < 40; k++) fx.emit(pos.x, pos.y + .1, pos.z, (Math.random() - .5) * 4, Math.random() * 3, (Math.random() - .5) * 4, .5 + Math.random() * .5, [.4, .7, 1], .9, .03, 6); A.spark(); setTimeout(() => A.spark(), 180); A.buzz(); }
  else { A.rattle(22); A.clank(1.2); XT.revealT = 12; XT.revealF = f; fx.glitch(.2); }
  if (!G.active || G.floor !== f) return; const d = Math.hypot(G.x - pos.x, G.z - pos.z);
  if (stunSec > 0 && d < 5) stunGhost(stunSec, '푸른 스파크 — 그것이 경련하며 멈췄다');
  else if (d < radius && !G.enraged) { G.state = 'search'; G.target = { x: pos.x, z: pos.z }; G.path = []; G.replan = 0; G.wait = 0; G.hunt = null; }
}
const camDir = () => new THREE.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
function placeAlarm() { craftingSystem.deployTrap(notify); refreshHud(); }
function throwShock() { craftingSystem.throwShortBomb(camDir(), notify, alertMonsterFn); }
function useFirstAid() { const ok = craftingSystem.useMedKit(PS, notify); if (ok) { P.stamina = 100; P.tired = false; calmDown(30); refreshHud(); } return ok ? '응급 처치 키트: 체력 100 · 공포 0 · 25초 동안 지치지 않는다' : ''; }
const ghostFoot = new THREE.Vector3();
function trapTick(dt) {
  if (XT.revealT > 0) XT.revealT -= dt;
  playerRef.position.set(P.x, floors[P.floor] ? floors[P.floor].y0 : 0, P.z);
  const G = ghost; craftingSystem.update(G.active ? ghostFoot.set(G.x, floors[G.floor].y0 + .05, G.z) : null, m => (G.floor === P.floor ? caption(m) : toast('경보 함정이 울렸다', `${FLOOR_LABEL[G.floor]} — 12초 동안 위치 표시`, 'warn')), alertMonsterFn);
}
// 그것 위치 표시 (함정이 울린 뒤 12초): 미니맵 붉은 점 + 화면 마커
function revealDraw(g) {
  const G = ghost; const on = XT.revealT > 0 && G.active && G.floor === P.floor; const mk = $('ghostMark'); mk.classList.toggle('on', on); if (!on) return;
  if (g) { const S = 2.6, x = 75 + (G.x - P.x) * S, y = 75 + (G.z - P.z) * S; g.fillStyle = '#ff2a2a'; g.beginPath(); g.arc(clamp(x, 6, 144), clamp(y, 6, 144), 5 + Math.sin(tNow * 8) * 1.5, 0, 6.3); g.fill(); }
  const v = new THREE.Vector3(G.x, floors[G.floor].y0 + 1.5, G.z).project(camera), behind = v.z > 1;
  mk.style.left = clamp((behind ? -v.x : v.x) * .5 + .5, .03, .97) * innerWidth + 'px'; mk.style.top = clamp(behind ? .9 : -v.y * .5 + .5, .05, .95) * innerHeight + 'px';
}

// ── 5. 배전반 · 차임벨 연결 (사용자 제공 SchoolPowerEventSystem) ──
//   배전반은 층마다 복도 서쪽 끝(본관 2층 복도 끝 포함) + 교무실 앞 복도. 비상등 불빛 · 안전 구역(배전반 6m 안 공포 감소) · 3분 30초 뒤 과부하
const schoolPower = window.schoolPowerSystem = new SchoolPowerEventSystem(scene, playerRef);
const BRK = {};   // f → { on, lamps, box } — 비상등 연출 (전구 · 빛무리)
function buildBreakers() {
  const lampM = new THREE.MeshBasicMaterial({ color: 0xffb060 }), offM = new THREE.MeshBasicMaterial({ color: 0x2a2620 });
  const spots = [0, 1, 2, 8, 9, 10].map(f => [f, f >= 8 ? -19.93 : -35.93, -1.0, Math.PI / 2]).concat([[0, -8.0, -1.68, 0]]);   // 마지막: 교무실 앞 복도 벽
  spots.forEach(([f, x, z, ry], i) => {
    const F = floors[f]; if (!F) return;
    const grp = schoolPower.createPowerBox(new THREE.Vector3(x, F.y0, z), ry, `pb_${f}_${i}`), box = schoolPower.powerBoxes[schoolPower.powerBoxes.length - 1];
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(.4, .1), new THREE.MeshBasicMaterial({ map: makeSign('배 전 반', '#d8c020', '#111', 26) })); sign.position.set(0, 1.68, .02); grp.add(sign);
    if (!BRK[f]) {
      const lamps = []; for (let k = 0; k < 6; k++) { const lx = (f >= 8 ? -16 : -30) + k * (f >= 8 ? 6.4 : 12); const lm = new THREE.Mesh(new THREE.BoxGeometry(.3, .08, .12), offM); lm.position.set(lx, 3.2, 1.6); lm.userData.dynamic = true; F.interior.add(lm);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('255,190,110'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); sp.scale.set(3, 2, 1); sp.position.set(lx, 3.0, 1.3); F.interior.add(sp); lamps.push({ lm, sp }); }
      BRK[f] = { on: false, lamps, lampM, offM, boxes: [] };
    }
    BRK[f].boxes.push(box);
    const nx = Math.sin(ry), nz = Math.cos(ry);
    world.props.push({ kind: 'cbreaker', floor: f, x: x + nx * .6, z: z + nz * .6, y: 1.25, box, label: '배전반(두꺼비집) 열기 — 전력 복구' });
  });
}
async function useCBreaker(p) {
  const box = p.box;
  box.onInteract(PS, notify, async () => {   // 클래스의 상호작용 → 스위치 미니게임 → restorePower
    sfx.click(); const r = await mini('timing', { title: '배전반 — 스위치를 눈금에 맞춰 올려라' }); if (!r.ok) { sfx.spark(); say('스파크가 튄다 — 실패', 1500); return; }
    schoolPower.restorePower(notify); box.isRestored = true; box.led.material.color.setHex(0x22ff44); setBreaker(p.floor, true); sfx.breaker(); P.noiseT = 1.5;
  });
}
function setBreaker(f, on) {
  const B = BRK[f]; if (!B) return; B.on = on;
  B.lamps.forEach(({ lm, sp }) => { lm.material = on ? B.lampM : B.offM; sp.material.opacity = on ? .55 : 0; });
}
let chimeWas = false;
function breakerTick(dt) {
  playerRef.position.set(P.x, floors[P.floor] ? floors[P.floor].y0 : 0, P.z);
  if (state === 'playing' && introDone) schoolPower.update(dt, PS, notify);
  for (const f in BRK) { const B = BRK[f]; if (B.on && !B.boxes.some(b => b.isRestored)) { setBreaker(+f, false); if (+f === P.floor) { sfx.spark(); sfx.lightsOff(); blackout = Math.max(blackout, .4); } } }   // 과부하로 꺼짐
  const ch = schoolPower.isChimeActive;   // 차임벨: 15초 동안 발소리 은폐 (그것의 청각 판정에서 제외)
  if (ch && !chimeWas) sfx.chimeWarp(15); $('chimeBar').classList.toggle('on', ch); chimeWas = ch;
}


// ── 7. 화장실 연결 (사용자 제공 RestroomSystem): 세면대 세수(공포 -25) ↔ 핏물 역류(28% · 같은 세면대 3번째부터, 공포 +18 · 거울 핏빛 글씨) · 물소리 14m 유인 ──
//   세면대 모양은 이미 화장실에 있으므로 클래스가 만드는 상자 세면대는 숨기고 상호작용만 쓴다. 변기 물 내리기는 22m 유인
class GameRestroom extends RestroomSystem {
  createSinkUnit(position, rotationY, sinkId, ctx) {
    const grp = super.createSinkUnit(position, rotationY, sinkId), obj = this.interactables[this.interactables.length - 1]; obj.mesh.visible = false; obj.uses = 0;
    obj.onInteract = (ps, notifyUI, alertFn) => {
      obj.uses++; const blood = obj.uses >= 3 || Math.random() < .28;
      sinkStream(ctx, blood); at(position.x, position.y + .9, position.z).faucet(5);
      if (blood) { ps.fear = Math.min(100, ps.fear + 18); notifyUI('수도꼭지에서 검붉은 핏물이 쏟아진다! 거울이 붉게 물든다 (공포 +18%)'); sinkMirror(ctx); sfx.stinger(.6); fx.glitch(.5); shake = .3; setFace('surprise', 2.4); }
      else { ps.fear = Math.max(0, ps.fear - 25); notifyUI('시원한 수돗물로 세수를 했다 (공포 -25%) — 물소리가 복도로 퍼진다'); setFace('relief', 2.4); }
      alertFn(position, 14);
    };
    return grp;
  }
}
const restroom = window.restroomSystem = new GameRestroom(scene);
function buildRestrooms() {
  world.props.filter(p => p.kind === 'sink').forEach((p, i) => {
    const r = roomAt(p.floor, p.x, p.z), wx = r && r.south ? p.x - .3 : p.x + .3;   // 벽 쪽 수전 위치 (남쪽 방은 반대)
    const zl = r.south ? -p.z : p.z; p.ctx = { f: p.floor, r, tap: tPos(r, r.cx + 3.85 - .21, zl), zl };
    p.sink = restroom.createSinkUnit(new THREE.Vector3(wx, floors[p.floor].y0, p.z), r && r.south ? Math.PI / 2 : -Math.PI / 2, `sink_${p.floor}_${i}`, p.ctx);
    p.sinkObj = restroom.interactables[restroom.interactables.length - 1];
  });
}
function sinkStream(c, blood) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(.008, .012, .19, 8), new THREE.MeshStandardMaterial({ color: blood ? 0x6a0606 : 0xa8c8d0, roughness: .05, transparent: true, opacity: .8 }));
  m.position.set(c.tap.x, .875, c.tap.z); m.userData.tick = () => { m.scale.x = m.scale.z = .8 + Math.random() * .5; if (Math.random() < .35) fx.emit(c.tap.x, floors[c.f].y0 + .8, c.tap.z, (Math.random() - .5) * .4, .4, (Math.random() - .5) * .4, .3, blood ? [.45, .03, .03] : [.7, .8, .85], .4, .015, 6); };
  addTmp(c.f, m, 5, .2, .4);
}
function sinkMirror(c) {   // 거울이 핏빛으로 번지고 '뒤에 누구야'
  const r = c.r, p = tPos(r, r.cx + 3.85 - .043, c.zl, -Math.PI / 2), g = new THREE.Group();
  const red = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .9), new THREE.MeshBasicMaterial({ color: 0x5a0000, transparent: true, opacity: .55, depthWrite: false })); g.add(red);
  const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .28), new THREE.MeshBasicMaterial({ map: makeGraffiti('뒤에 누구야', '#c01010'), transparent: true, depthWrite: false })); w.position.set(0, .1, .002); g.add(w);
  g.position.set(p.x, 1.65, p.z); g.rotation.y = p.ry; addTmp(c.f, g, 12, 1.2, 3);
}
const lureTo = (f, pos, radius) => { const G = ghost; if (!G.active || G.floor !== f || G.enraged || Math.hypot(G.x - pos.x, G.z - pos.z) > radius) return false; G.state = 'search'; G.target = { x: pos.x, z: pos.z }; G.path = []; G.replan = 0; G.wait = 0; G.hunt = null; return true; };
function useSink(p) { p.sinkObj.onInteract(PS, notify, (pos, radius) => lureTo(p.floor, pos, radius)); P.noiseT = 1.2; }
function useFlush(p) {
  at(p.x, floors[p.floor].y0 + .5, p.z).flush(); P.noiseT = 2.5; shake = .15;
  const lured = lureTo(p.floor, p, 22); caption(lured ? '쏴아 — 요란한 물소리에 발소리가 이쪽으로 방향을 튼다' : '쏴아 — 물 내려가는 소리가 화장실을 울린다');
}

// ── 6. 그것: 사물함 수색 · 페이크 퇴장 ──
function lockerSearchStart(G) {
  if (!P.hiding || G.lockSearch || G.hunt) return;
  const t = G.target || { x: G.x, z: G.z }, ls = world.lockers.filter(l => l.floor === G.floor && Math.hypot(l.x - t.x, l.z - t.z) < 7);
  if (ls.length < 2 && (P.hideCount || 0) < 3) return;
  ls.sort((a, b) => Math.hypot(a.x - G.x, a.z - G.z) - Math.hypot(b.x - G.x, b.z - G.z));
  G.lockSearch = { list: ls.slice(0, 5), i: 0, t: 0 }; if (!ls.includes(P.hiding) && Math.hypot(P.hiding.x - t.x, P.hiding.z - t.z) < 10) G.lockSearch.list.push(P.hiding);
  if (G.floor === P.floor) caption('사물함 문이 하나씩 거칠게 열린다…');
}
function lockerSearchTick(G, dt, F) {
  const S = G.lockSearch; if (!S || G.hunt) return false;
  const l = S.list[S.i]; if (!l) { G.lockSearch = null; G.state = 'patrol'; G.path = []; G.wait = 1; return false; }
  const dr = l.dir || { x: 0, z: 1 }, fx2 = l.x + dr.x * .8, fz2 = l.z + dr.z * .8;
  if (Math.hypot(G.x - fx2, G.z - fz2) > .5) { if (G.replan <= 0 || !G.path.length) { G.path = findPath(F, G.x, G.z, fx2, fz2); G.replan = .4; } followPath(2.2, dt); return true; }
  S.t += dt;
  if (S.t < dt * 1.5) { const A = at(l.x, F.y0 + 1, l.z); if (l === P.hiding) { A.locker(); sfx.heartbeat(1.3); caption('바로 앞 사물함 손잡이가 덜컹거린다'); } else { A.locker(); A.doorBang(0, .8); } }
  if (l === P.hiding) return S.t < 4 ? true : (S.i++, S.t = 0, true);   // 숨은 사물함 앞에서는 오래 머문다 (기존 발각 판정이 진행)
  if (S.t > 1.3) { S.i++; S.t = 0; }
  return true;
}
// 페이크 퇴장: 숨은 사물함 앞에서 멀어지는 척하다가 25% 확률로 3초 뒤 되돌아와 틈새를 들여다본다 — 즉시 숨을 참지 않으면 들킨다
function fakeTick(G, dt, F) {
  const l = P.hiding; if (!l || G.hunt || G.enraged) { G.fake = null; G.nearLock = false; return false; }
  const d = Math.hypot(l.x - G.x, l.z - G.z);
  if (d < 2.6) G.nearLock = true;
  else if (G.nearLock && d > 3.5 && !G.fake) { G.nearLock = false; if (Math.random() < .25) G.fake = { t: 3, phase: 'away' }; }
  const K = G.fake; if (!K) return false;
  if (K.phase === 'away') { K.t -= dt; if (K.t <= 0) { K.phase = 'rush'; G.path = []; G.replan = 0; } return false; }
  const dr = l.dir || { x: 0, z: 1 }, fx2 = l.x + dr.x * .7, fz2 = l.z + dr.z * .7;
  if (K.phase === 'rush') { if (Math.hypot(G.x - fx2, G.z - fz2) > .4) { if (G.replan <= 0 || !G.path.length) { G.path = findPath(F, G.x, G.z, fx2, fz2); G.replan = .3; } followPath(5.5, dt); return true; }
    K.phase = 'peek'; K.t = 0; $('peekEye').classList.add('on'); sfx.stinger(.7); at(fx2, F.y0 + 1.5, fz2).ghostBreath(); shake = .3; caption('틈새로 — 눈이 마주쳤다'); return true; }
  K.t += dt; if (K.t > .9 && !P.holdBreath) { $('peekEye').classList.remove('on'); G.fake = null; G.hunt = { x: fx2, z: fz2 }; return false; }
  if (K.t > 2.6) { $('peekEye').classList.remove('on'); G.fake = null; G.state = 'patrol'; G.path = []; G.wait = 2; at(G.x, F.y0 + 1.5, G.z).ghostLaugh(); caption('…킥킥거리며 멀어진다'); }
  return true;
}
function featTick(dt) {
  if (STH) { if (!keys[STH.code] || !target || target.type !== 'stairs' || state !== 'playing') STH = null; else if ((STH.t += dt) > .45) { const d = STH.dir; STH = null; changeFloor(d); } } for (const p of world.props) if (p.kind === 'pick' && p.done && p.mesh.visible) p.mesh.visible = false;
  micTick(dt); camTick(dt); sanityTick(dt); trapTick(dt); breakerTick(dt); if ((P.stamInfT || 0) > 0) { P.stamInfT -= dt; if (P.stamInfT < 0) P.stamInfT = 0; P.stamina = 100; P.tired = false; } }

function extrasTick(dt) {
  searchTick(dt); tmpTick(dt); ambientTick(dt); featTick(dt);
  if (XT.mbox) { XT.mbox.t -= dt; if (XT.mbox.t <= 0) XT.mbox = null; }
  if (ghost.slowT > 0) ghost.slowT -= dt;
  if (state === 'playing' && introDone) {
    XT.para -= dt;
    if (XT.para <= 0) { const ch = objective().ch; XT.para = (ch >= 4 ? 55 : ch >= 3 ? 75 : 100) + Math.random() * 50; if (!paraEvent()) XT.para = 15; }
  }
}
buildCamClues(); buildBreakers(); buildRestrooms(); spawnPicks();
sqSync();
initSaveIds();
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
  $('setNoFlicker').checked = !!SET.noFlicker; $('setObjArrow').checked = SET.objArrow; $('setBgm').checked = SET.bgm; $('setBgmVol').value = Math.round(SET.bgmVol * 100); $('setBloom').checked = SET.bloom; $('setGrain').checked = SET.grain; $('setBob').checked = SET.bob; $('setShake').checked = SET.shake; $('setFps').checked = SET.showFps; $('setPlay').checked = SET.showPlay !== false;
  const v = getVolumes(); ['master', 'sfx', 'voice', 'amb', 'music'].forEach(k => { $('vol_' + k).value = Math.round(v[k] * 100); });
  $('setView').value = String(SET.view); $('setDist').value = SET.camDist * 10;
  $('setSens').value = SET.sens * 100; $('setInvY').checked = SET.invertY; $('setRun').value = SET.runToggle ? 'toggle' : 'hold'; $('setHints').checked = SET.hints;
  $('setDub').checked = VS.dub; $('setVoice').value = VS.engine; $('setVoice').querySelector('[value=browser]').disabled = !hasBrowserVoice(); $('vEngine').textContent = '현재: ' + engineLabel() + (hasNaturalVoice() ? '' : ' · 이 브라우저에는 자연스러운 한국어 음성이 없습니다 (Edge 권장)');
  $('setSubs').checked = VS.subs; $('setNotes').checked = VS.readNotes; $('setSubSize').value = String(VS.subSize); $('setNames').checked = SET.subNames; $('setSubBg').value = SET.subBg * 100;
  $('setCaps').checked = SET.captions; $('setTips').checked = SET.tips; $('setPhotos').checked = SET.areaPhotos; $('setMic').checked = !!SET.mic; $('setContrast').checked = SET.contrast; $('setUi').value = Math.round(SET.ui * 100); renderKeys();
  $('setDiff').value = SET.diff; $('setJump').value = SET.jump; $('setFlash').checked = SET.flashReduce; $('setFearFx').checked = SET.fearFx;
  vals();
}
function vals() {
  $('vScale').textContent = Math.round(SET.scale * 100) + '%'; $('vBright').textContent = Math.round(SET.bright * 100) + '%'; $('vFov').textContent = SET.fov + '°';
  $('vUi').textContent = Math.round(SET.ui * 100) + '%';
  $('vSens').textContent = SET.sens.toFixed(2) + '×'; $('vDist').textContent = SET.camDist.toFixed(1) + 'm'; $('vSubBg').textContent = Math.round(SET.subBg * 100) + '%';
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
$('setNoFlicker').onchange = e => setS('noFlicker', e.target.checked); $('setObjArrow').onchange = e => setS('objArrow', e.target.checked); $('setBgm').onchange = e => setS('bgm', e.target.checked); $('setBgmVol').oninput = e => setS('bgmVol', e.target.value / 100);
$('setBloom').onchange = e => setS('bloom', e.target.checked); $('setGrain').onchange = e => setS('grain', e.target.checked);
$('setBob').onchange = e => setS('bob', e.target.checked); $('setShake').onchange = e => setS('shake', e.target.checked); $('setFps').onchange = e => setS('showFps', e.target.checked); $('setPlay').onchange = e => setS('showPlay', e.target.checked);
['master', 'sfx', 'voice', 'amb', 'music'].forEach(k => { $('vol_' + k).oninput = e => { setVolumes({ [k]: e.target.value / 100 }); }; });
$('vol_voice').onchange = () => speak(`l_heal_${CK()}`);
$('vol_sfx').onchange = () => sfx.doorBang(0, .6);
$('setView').onchange = e => { setS('view', +e.target.value); view = SET.view; };
$('setDist').oninput = e => setS('camDist', e.target.value / 10);
$('setSens').oninput = e => setS('sens', e.target.value / 100); $('setInvY').onchange = e => setS('invertY', e.target.checked);
$('setRun').onchange = e => setS('runToggle', e.target.value === 'toggle'); $('setHints').onchange = e => setS('hints', e.target.checked);
$('setVoice').onchange = e => { VS.engine = e.target.value; saveVS(); stopSpeak(); fillSettings(); speak('intro1'); };
$('setDub').onchange = e => { VS.dub = e.target.checked; saveVS(); stopSpeak(); fillSettings(); refreshDubBtns(); if (VS.dub) speak(`l_heal_${CK()}`); };
function refreshDubBtns() { ['mDub', 'dubBtn2'].forEach(id => { const b = $(id); if (b) b.textContent = `더빙 ${VS.dub ? 'ON' : 'OFF'}`; }); }
$('mDub').onclick = () => { VS.dub = !VS.dub; saveVS(); stopSpeak(); refreshDubBtns(); };
$('dubBtn2').onclick = () => { VS.dub = !VS.dub; saveVS(); stopSpeak(); refreshDubBtns(); };
refreshDubBtns();
$('setSubs').onchange = e => { VS.subs = e.target.checked; saveVS(); };
$('setNotes').onchange = e => { VS.readNotes = e.target.checked; saveVS(); };
$('setSubSize').onchange = e => { VS.subSize = +e.target.value; saveVS(); subtitle('미리보기', '자막 크기가 이렇게 보입니다.', 2.5); };
$('setNames').onchange = e => { setS('subNames', e.target.checked); subtitle('미리보기', '화자 이름 표시', 2); };
$('setSubBg').oninput = e => { setS('subBg', e.target.value / 100); subtitle('미리보기', '자막 배경 진하기', 1.5); };
$('setDiff').onchange = e => setS('diff', e.target.value); $('setJump').onchange = e => setS('jump', e.target.value);
$('setFlash').onchange = e => setS('flashReduce', e.target.checked); $('setFearFx').onchange = e => setS('fearFx', e.target.checked);
$('setCaps').onchange = e => { setS('captions', e.target.checked); caption('효과음 자막 미리보기'); }; $('setTips').onchange = e => setS('tips', e.target.checked); $('setPhotos').onchange = e => setS('areaPhotos', e.target.checked);
$('setMic').onchange = async e => { setS('mic', e.target.checked); if (e.target.checked) await micStart(); else micStop(); };
addEventListener('pointerdown', () => { if (SET.mic && !MIC.on) micStart(); }, { once: true });
if (matchMedia('(pointer: coarse)').matches || !('exitPointerLock' in document)) $('mobileNote').style.display = 'block';
$('setContrast').onchange = e => setS('contrast', e.target.checked); $('setUi').oninput = e => setS('ui', e.target.value / 100);
// 키 재지정
const KEY_ACTIONS = [['camera', '휴대폰 심령 카메라'], ['crouch', '앉기 (웅크리기)'], ['jump', '점프'], ['interact', '조사 · 상호작용'], ['flash', '손전등'], ['inv', '소지품'], ['map', '지도'], ['phone', '휴대폰'], ['throwCan', '캔 던지기'], ['view', '시점 전환'], ['run', '달리기'], ['down', '계단 내려가기'], ['scan', '주변 살피기']];
let remapping = null;
function renderKeys() {
  $('keyRemap').innerHTML = KEY_ACTIONS.map(([k, n]) => `<span>${n}</span><button data-k="${k}" class="${remapping === k ? 'wait' : ''}">${remapping === k ? '키를 누르세요…' : keyLabel(SET.keys[k])}</button>`).join('');
  $('keyRemap').querySelectorAll('button').forEach(b => { b.onclick = () => { remapping = b.dataset.k; renderKeys(); }; });
}
addEventListener('keydown', e => {
  if (!remapping) return; e.preventDefault(); e.stopImmediatePropagation();
  if (e.code !== 'Escape') { const old = SET.keys[remapping], dup = Object.keys(SET.keys).find(k => k !== remapping && SET.keys[k] === e.code); if (dup) SET.keys[dup] = old; SET.keys[remapping] = e.code; saveSET(); }
  remapping = null; renderKeys(); refreshHints();
}, true);
function refreshHints() { const k = SET.keys; $('hints').innerHTML = `<div>이동 <kbd>WASD</kbd></div><div>달리기 <kbd>${keyLabel(k.run)}</kbd></div><div>손전등 <kbd>${keyLabel(k.flash)}</kbd></div><div>상호작용 <kbd>${keyLabel(k.interact)}</kbd></div><div>던지기 <kbd>${keyLabel(k.throwCan)}</kbd></div><div>앉기 <kbd>${keyLabel(k.crouch)}</kbd> · 점프 <kbd>${keyLabel(k.jump)}</kbd></div><div>시점 <kbd>${keyLabel(k.view)}</kbd></div><div>주변 살피기 <kbd>${keyLabel(k.scan)}</kbd> · 빠른 저장 <kbd>F5</kbd></div><div>일시정지 <kbd>Esc</kbd></div>`; }
refreshHints();
$('setReset').onclick = () => { resetSET(); setVolumes({ master: 1, sfx: 1, voice: 1, amb: 1, music: 1 }); VS.dub = true; VS.engine = 'auto'; VS.subs = true; VS.readNotes = true; VS.subSize = 1; saveVS(); applySettings(); applyQuality(SET.quality === 'auto' ? 'high' : SET.quality); fillSettings(); refreshHints(); toast('설정', '기본값으로 되돌렸습니다', 'info'); };
document.querySelectorAll('.btn').forEach(b => b.addEventListener('mouseenter', () => sfx.ui()));

/* ---------- 테스트 모드 (?test) ---------- */
const TP = [
  ['정문 앞 (도로)', { floor: 0, x: 0, z: 76, yaw: 0 }], ['운동장 · 본관 현관', { floor: 0, x: 0, z: 4, yaw: 0 }],
  ['본관 1F 복도', { floor: 0, x: 0, z: 0, yaw: -Math.PI / 2 }], ['본관 2F 복도', { floor: 1, x: 0, z: 0, yaw: -Math.PI / 2 }],
  ['본관 3F (방송실 앞)', { floor: 2, x: -24, z: 0, yaw: 0 }], ['옥상', { floor: 3, x: 0, z: -7.5, yaw: 0 }],
  ['지하 B1', { floor: 4, x: 0, z: 0, yaw: -Math.PI / 2 }], ['체육관', { floor: 5, x: 38, z: 28.1, yaw: 0 }],
  ['수영장', { floor: 6, x: -35.5, z: 38, yaw: Math.PI / 2 }], ['급식실', { floor: 7, x: -39, z: 20.5, yaw: 0 }],
  ['별관 1F', { floor: 8, x: 0, z: .2, yaw: -Math.PI / 2 }], ['별관 2F', { floor: 9, x: 0, z: 0, yaw: -Math.PI / 2 }],
  ['별관 3F', { floor: 10, x: 0, z: 0, yaw: -Math.PI / 2 }], ['서문 앞', { floor: 0, x: -49, z: 32, yaw: Math.PI / 2 }],
  ['1-1 교실 (캠코더)', { floor: 0, x: 8, z: -3, yaw: 0 }], ['B1 펌프실 (명찰)', { floor: 4, x: 32, z: -3, yaw: 0 }], ['방송실 장비실 (민아)', { floor: 2, x: -21.4, z: -5.0, yaw: 0 }],
  ['교무실 금고', { floor: 0, x: -10.4, z: -8.0, yaw: Math.PI / 2 }], ['도서실 서랍 (자물쇠 따기)', { floor: 0, x: 32.6, z: -7.4, yaw: 0 }], ['과학실 약품장 (다이얼)', { floor: 1, x: 31, z: -4.8, yaw: Math.PI / 2 }],
  ['체육관 기구함 (다이얼)', { floor: 5, x: 30.6, z: 20.6, yaw: Math.PI / 2 }], ['수영장 배수구 (갈고리)', { floor: 6, x: -41.5, z: 46.9, yaw: 0 }], ['음악실 피아노', { floor: 2, x: 34.2, z: -6.2, yaw: 0 }], ['미술실 그림 퍼즐', { floor: 2, x: 25, z: -4.6, yaw: 0 }], ['보건실 녹음기', { floor: 0, x: -26.4, z: -4.6, yaw: Math.PI / 2 }], ['B1 전기실', { floor: 4, x: -16, z: -4, yaw: Math.PI / 2 }], ['3-3 교실', { floor: 2, x: -8, z: -3, yaw: 0 }], ['음악실', { floor: 2, x: 32, z: -3, yaw: 0 }],
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
  ac.appendChild(b('정문 열쇠 조합', false, () => testAct(() => { if (P.keys < TOTAL) { world.items.filter(i => i.kind === 'key').forEach(i => { i.taken = true; i.mesh.visible = false; got[i.idx] = true; }); P.keys = TOTAL; } FL.keyhead = true; FL.anPow = true; makeGateKey(); })));
  ac.appendChild(b('특별 목표 준비 (명찰+전력)', false, () => testAct(() => { const t = world.items.find(i => i.kind === 'nametag'); if (t && !t.taken) { t.taken = true; t.mesh.visible = false; } FL.tag = true; FL.opt = true; power = true; world.props.forEach(p => { if (p.kind === 'breaker') { p.on = true; p.done = true; } }); refreshHud(); toast('테스트', '명찰 획득 · 전력 복구 — 방송실에서 하교 방송', 'opt'); })));
  ac.appendChild(b('도구 모두 지급', false, () => testAct(() => { inv.hairpin = 5; inv.can = 5; FL.fuse = true; FL.hook = true; refreshHud(); toast('테스트', '머리핀 5 · 빈 캔 5 · 퓨즈 · 갈고리', 'info'); })));
  ac.appendChild(b(`시점: ${view === 3 ? '3인칭' : '1인칭'}`, view === 3, () => { toggleView(); renderTest(); }));
  ac.appendChild(b('최종 추격 시작', false, () => testAct(() => enrage())));
  ac.appendChild(b('보급품 채우기', false, () => testAct(() => { P.hp = 100; P.battery = 100; P.stamina = 100; inv.battery = 5; inv.medkit = 5; refreshHud(); toast('테스트', 'HP·배터리·건전지·응급 밴드 보충', 'info'); })));
  ac.appendChild(b('모든 문 열기', false, () => testAct(() => world.doorList.forEach(d => { d.target = 1; }))));
  ac.appendChild(b('전력 복구', false, () => testAct(() => { power = true; world.props.forEach(p => { if (p.kind === 'breaker') { p.on = true; p.done = true; } }); toast('테스트', '전력 복구', 'info'); })));
  ac.appendChild(b('열쇠 머리 획득 (제4장 건너뛰기)', false, () => testAct(() => { FL.anPow = true; FL.keyhead = true; FL.sq.head = HEADQUEST.steps.length; refreshHud(); toast('테스트', '열쇠 머리 — 소지품에서 조합', 'info'); })));
  ac.appendChild(b('모든 문서 획득', false, () => testAct(() => { world.items.filter(i => i.kind === 'note' && !i.taken).forEach(i => { i.taken = true; i.mesh.visible = false; addDoc({ id: i.id, kind: 'note' }); if (CLUES[i.id]) addClue(i.id); }); refreshHud(); toast('테스트', `문서 ${docs.length}개`, 'info'); })));
  $('testInfo').textContent = `현재: ${AREA_NAMES[P.floor]} (${P.x.toFixed(1)}, ${P.z.toFixed(1)})  ·  열쇠 ${P.keys}/${TOTAL}  ·  유령 ${ghost.active ? AREA_NAMES[ghost.floor] + ' / ' + ghost.state : '비활성'}`;
}
function openTest() { if (state !== 'playing') return; openUI('testOv'); renderTest(); }
if (TEST) {
  document.body.classList.add('test');
  $('testBadge').style.display = 'block';
  $('tTest').style.display = 'block';
}
// 시작: 타이틀 표시 (재시도 · 처음부터는 바로 이어서)
applyChar(); refreshTitle();
{ let auto = null; try { auto = sessionStorage.getItem('haegyo_auto'); sessionStorage.removeItem('haegyo_auto'); } catch (e) { /* ignore */ }
  if ((auto === 'continue' || auto === 'backup') && hasSave()) { closeMenus(); continueGame(auto === 'backup'); } else if (auto === 'new') { closeMenus(); newGame(); } }

if (DEBUG) {
  window.__g = {
    P, ghost, floors, world, scene, camera, renderer, THREE, start: () => start(true),
    setIntroT(t) { introText = false; introT = t; }, introInfo: () => ({ state, introT: +introT.toFixed(1), cue: introCue, guard: !!(introGuard && introGuard.visible), cam: camera.position.toArray().map(v => +v.toFixed(1)) }),
    tp(x, z, f = 0, yaw = 0, pitch = 0) { P.x = x; P.z = z; P.floor = f; P.yaw = yaw; P.pitch = pitch; },
    give() { world.items.filter(i => i.kind === 'key').forEach(i => { i.taken = true; i.mesh.visible = false; got[i.idx] = true; }); P.keys = TOTAL; refreshHud(); },
    get state() { return state; }, set state(v) { state = v; }, get tNow() { return tNow; }, openTest, EV, appar, applyQuality,
    interact, findInteract, hit, die, activateGhost, enrage, FL, MG, throwCan, throws, set playTime(v) { playTime = v; }, toggleView, get view() { return view; }, useProp, docs, msgs, clues, objective, makeGateKey, openInv, openPhone, openMap, openCharsel, openSettings, refreshHud, save, load, inv, mina,
    get power() { return power; }, set power(v) { power = v; }, get CHAR() { return CHAR; }, newGame, continueGame,
    setTarget(t) { target = t; }, DAY, GEN, SIDEQUESTS, sqStep, sqDoneCount, useSideQuest, HEADQUEST, useHead, COLLECT, paraEvent, toiletFx, tmpFx, TE, roomAt, camMode, camShoot, CAM, MIC, SAN, BRK, setBreaker, schoolPower, craftingSystem, ghostCam, restroom, useSink, useFlush, placeAlarm, throwShock, useFirstAid, tryCombine, stunGhost, lockerSearchStart, enterLocker, leaveLocker, startSearch, useMiniSpot, openChalk, chalkAsk, XT,
  };
}
// 형광등 스위치 초기 상태 반영 (방마다 일부만 켜져 있다)
syncSwitches();
