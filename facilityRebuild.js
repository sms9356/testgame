// 캠퍼스 8개 시설 재건축 (사용자 제공 「서문고 8개 시설 종합 콘셉트 설계」 PDF · 시설 면적 일람 · 가구/설비 일람 · 재질/벽지/천장 코드 CSV)
//   본관 · 별관을 뺀 예전 건물(청운학사 · 학생회관 · 대강당 · 분리수거/소각장 · 과학천문관 · 역사관)은 터(외곽 치수 그대로)의 메시 · 충돌 상자 · 조명을 걷어 내고 새로 짓는다.
//   급식실 · 수영장은 실내가 따로 된 층(6 · 7층 공간)이라 퀘스트 장치(배수구 · 냉동창고 · 철문)를 살리고, 바깥 건물을 새로 짓고 실내 마감을 재질 코드로 바꾼다.
//   공통: 남측 중앙 출입구 · 북측/남측 실 + 가운데 복도 · 2층 건물은 직선 계단 · 600×600 T-bar 천장 · 2구 형광등 · 벽돌/철근콘크리트 외장
//   재질: F-01 ~ F-05 바닥 · W-01 ~ W-05 벽 · C-01 ~ C-04 천장 (Poly Haven CC0 실사 스캔 텍스처, assets/tex/fac_* · 미터 단위 UV)
import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';
import { pbr } from './tex.js?v=280';

const FH = 3.6, CEIL = 2.9, WALL_T = .24, LIN = .06;
const TL = new THREE.TextureLoader(), TEX = {};
const tex = (n, ch) => {
  const k = n + ch; if (TEX[k]) return TEX[k];
  const t = TL.load(`assets/tex/fac_${n}_${ch}.webp`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (ch === 'map') t.colorSpace = THREE.SRGBColorSpace; return (TEX[k] = t);
};
const facMat = (n, o = {}) => new THREE.MeshStandardMaterial({ map: tex(n, 'map'), normalMap: tex(n, 'normal'), roughnessMap: tex(n, 'rough'), roughness: 1, metalness: 0, ...o });
const oldMat = (n, o = {}) => { const t = pbr(n, () => ({})); return new THREE.MeshStandardMaterial({ map: t.map || null, normalMap: t.normalMap || null, roughnessMap: t.roughnessMap || null, roughness: t.roughnessMap ? 1 : .8, metalness: 0, ...o }); };
const PM = (c, r = .6, m = 0, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...o });

// 재질 라이브러리: [재질, 텍스처 한 장이 덮는 길이(m)]
let LIB = null;
function lib() {
  if (LIB) return LIB;
  LIB = {
    F01: [facMat('f01', { color: 0xdfe2df }), 1.6], F02: [facMat('f02', { color: 0xe6c8a8 }), 1.8], F03: [facMat('f03', { color: 0x9a7058 }), 1.4], CARPET: [facMat('carpet', { color: 0x8a4038 }), 1.2],
    F04: [facMat('f04', { color: 0xe8eae6, roughness: .8 }), 1.0], F05: [facMat('f05', { color: 0xc2c6c8 }), 2.4],
    W01: [facMat('w01', { color: 0xf2eee2 }), 2.2], W02: [facMat('w01', { color: 0xbfb9ae }), 2.2], W03: [facMat('w01', { color: 0xeee0c4 }), 2.2], W04: [facMat('w04', { color: 0xc8cdcb }), 2.6], W05: [facMat('w05', { color: 0xf4f6f5 }), 1.2],
    C01: [oldMat('ceil', { color: 0xf4f2ee }), 2.4], C02: [PM(0x44494a, .9), 1], C03: [oldMat('ceil', { color: 0xf6f7f4 }), 1.8], C04: [oldMat('step', { color: 0xa6a8a5 }), 2.4],
    BRICK: [facMat('brick'), 2.2], CONC: [oldMat('facade', { color: 0xd4d0c8 }), 3.0], GRANITE: [oldMat('step', { color: 0x8a8c8e }), 1.6], SLAB: [oldMat('step', { color: 0xb8b8b2 }), 3.0],
    STEEL: [oldMat('paint', { color: 0x8a949a, metalness: .35 }), 1.0], GREENSTEEL: [oldMat('locker', { color: 0x7d9a88, metalness: .3 }), 1.4], GREYSTEEL: [oldMat('locker', { color: 0xb2b6b4, metalness: .3 }), 1.4],
    LPM: [oldMat('varnish', { color: 0xe8d6b8 }), 1.2], WOOD: [oldMat('varnishDark', { color: 0xc89870 }), 1.2], DARKWOOD: [oldMat('varnishDark', { color: 0x7a5236 }), 1.2], CHECKER: [facMat('metal', { color: 0xb0b4b6, metalness: .5 }), 1.2],
    SS: [PM(0xc6cacc, .28, .85), 1], CHROME: [PM(0xe0e4e6, .18, .95), 1], BLACK: [PM(0x16181a, .45, .3), 1], LACQUER: [PM(0x08090a, .12, .2), 1], RUBBER: [PM(0x1c1c1c, .9), 1],
    FABRIC: [PM(0x2c3e5e, .95), 1], RED: [PM(0x7a1820, .9), 1], VELVET: [PM(0x6a1018, .95), 1], MATTRESS: [PM(0xd8d4c6, .9), 1], BLANKET: [PM(0x54708a, .95), 1],
    WHITE: [PM(0xeeeeea, .5), 1], PORC: [PM(0xf4f4f0, .2, .05), 1], HDPE_B: [PM(0x2e5aa8, .6), 1], HDPE_G: [PM(0x2e8a4a, .6), 1], HDPE_Y: [PM(0xd8b820, .6), 1], HDPE_GR: [PM(0x6a6e70, .6), 1],
    FRAME: [PM(0x3a4046, .45, .6), 1], ALU: [PM(0xb8bcc0, .35, .8), 1], REFRACT: [PM(0x6a5446, .95), 1], SOOT: [PM(0x1a1614, .95), 1], PANEL: [PM(0xd8d2c4, .8), 1], CORK: [PM(0x9a7448, .95), 1],
    HOUSING: [PM(0xe8e8e4, .5, .2), 1], GREEN: [PM(0x2e5a3a, .7), 1], BOARD: [PM(0x24382e, .85), 1], DOME: [PM(0xc8ccd0, .35, .7), 1], TEAL: [PM(0x2c7a8a, .5, .2), 1],
  };
  return LIB;
}
const GLASS = () => new THREE.MeshStandardMaterial({ color: 0x9fb8c4, roughness: .06, metalness: .3, transparent: true, opacity: .32, depthWrite: false });
const LAMP_ON = () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 1.6, roughness: .4 });

// 상자 UV 를 면 크기(m) / 타일 길이로 맞춘다 (늘어진 텍스처 방지)
function boxUV(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
  return g;
}
function canvasSign(text, sub = '', w = 1024, h = 200, bg = '#1e2a30', fg = '#f2ecd8') {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.globalAlpha = .55; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); g.globalAlpha = 1;
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold ${sub ? 84 : 100}px "Noto Sans KR", "Malgun Gothic", sans-serif`; g.fillText(text, w / 2, sub ? h * .4 : h / 2, w - 60);
  if (sub) { g.font = `500 40px "Noto Sans KR", sans-serif`; g.globalAlpha = .8; g.fillText(sub, w / 2, h * .78, w - 60); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// 태극기 (국기의 제작 방법: 3:2 · 태극 지름 = 세로 1/2 · 괘 길이 D/2 · 굵기 D/12 · 간격 D/24 · 태극과 괘 사이 D/4)
export function taegukgiTexture() {
  const c = document.createElement('canvas'); c.width = 900; c.height = 600; const g = c.getContext('2d'), D = 300, cx = 450, cy = 300, R = D / 2;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 900, 600);
  g.save(); g.translate(cx, cy); g.rotate(Math.atan2(2, 3));
  g.fillStyle = '#0047a0'; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#cd2e3a'; g.beginPath(); g.arc(0, 0, R, Math.PI, 0); g.fill(); g.beginPath(); g.arc(-R / 2, 0, R / 2, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0047a0'; g.beginPath(); g.arc(R / 2, 0, R / 2, 0, Math.PI * 2); g.fill(); g.restore();
  const bw = D / 12, gap = D / 24, len = D / 2;
  [[-1, -1, [1, 1, 1]], [1, 1, [0, 0, 0]], [1, -1, [0, 1, 0]], [-1, 1, [1, 0, 1]]].forEach(([sx, sy, bars]) => {   // 건(좌상) · 곤(우하) · 감(우상) · 리(좌하)
    g.save(); g.translate(cx, cy); g.rotate(Math.atan2(sy * 2, sx * 3)); g.fillStyle = '#000000';
    bars.forEach((solid, k) => { const x = R + D / 4 + k * (bw + gap); if (solid) g.fillRect(x, -len / 2, bw, len); else { const hh = (len - gap) / 2; g.fillRect(x, -len / 2, bw, hh); g.fillRect(x, gap / 2, bw, hh); } });
    g.restore(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

// ───────── 철거 ─────────
// 캠퍼스 재배치 (campusRelayout.js): 서쪽 = 학술 · 생활(청운학사 · 학생회관 · 역사관 · 과학천문관), 동쪽 = 스포츠(수영장 …), 체육관 자리 = 대강당, 소각장 철거
export const ZONES = {
  dorm: { cx: -86, cz: -42, W: 22, D: 14 }, union: { cx: -88, cz: 42, W: 22, D: 14 }, aud: { cx: 38, cz: 24, W: 18, D: 26 },
  astro: { cx: -88, cz: 14, W: 20, D: 16 }, hist: { cx: -88, cz: -16, W: 15.6, D: 10.6 },
  cafe: { cx: -39, cz: 18.75, W: 18, D: 12.5 }, pool: { cx: 58, cz: 35, W: 14, D: 20 },
};
// 옛 자리 (걷어 낼 터)
const OLD_ZONES = { aud: { cx: -25, cz: -48, W: 18, D: 26 }, recy: { cx: 84, cz: 15, W: 16, D: 11 }, astro: { cx: 84, cz: -34, W: 20, D: 16 }, hist: { cx: 84, cz: -11, W: 15.6, D: 10.6 }, pool: { cx: -41, cz: 41, W: 14, D: 20 } };
export const FACILITY_ZONES = ZONES;
export const TWO_STORY = ['dorm', 'union', 'astro', 'hist'].map(k => ZONES[k]);
export const inTwoStory = (x, z) => TWO_STORY.some(Z => Math.abs(x - Z.cx) < Z.W / 2 + .1 && Math.abs(z - Z.cz) < Z.D / 2 + .1);

function demolish({ scene, floors, world }, zoneList, protect, cols = true) {
  const v = new THREE.Vector3(), bb = new THREE.Box3(), sz = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const rects = zoneList.map(Z => ({ x1: Z.cx - Z.W / 2 - 2, x2: Z.cx + Z.W / 2 + 2, z1: Z.cz - Z.D / 2 - 2, z2: Z.cz + Z.D / 2 + 2, Z }));   // 2m 띠: 옛 현관 캐노피 · 모서리 기둥 · 울타리 잔재까지
  const inR = (x, z, m = 0) => rects.find(r => x > r.x1 - m && x < r.x2 + m && z > r.z1 - m && z < r.z2 + m);
  // 2m 띠 안이라도 건물 밖 조사 지점(종 · 공중전화 · 게시판 등 메시 없는 상호작용)이 기대는 물체는 남긴다
  const inFoot = (x, z) => zoneList.some(Z => Math.abs(x - Z.cx) < Z.W / 2 + .3 && Math.abs(z - Z.cz) < Z.D / 2 + .3);
  const anchors = (world.props || []).filter(p => p.floor === 0 && !p.mesh && !inFoot(p.x, p.z) && inR(p.x, p.z, 1.6)).map(p => [p.x, p.z]);
  const anchored = (x, z) => !inFoot(x, z) && anchors.some(([ax, az]) => Math.hypot(ax - x, az - z) < 1.8);
  const kill = [];
  scene.updateMatrixWorld(true);
  const visit = o => {
    if (o.userData && (o.userData.facNew || o.userData.facKeep)) return;
    if (protect.has(o) || o.isCamera || o.isSkinnedMesh) return;
    if (o.isLight && o.userData.perfPool) return; if (o.isLight && !o.isAmbientLight && !o.isHemisphereLight && !o.isDirectionalLight) { o.getWorldPosition(v); if (inR(v.x, v.z) && v.y > -1 && v.y < 14) { o.visible = false; o.intensity = 0; } return; }
    if (o.isInstancedMesh) { let hit = 0; const p = new THREE.Vector3(); for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); p.setFromMatrixPosition(m4).applyMatrix4(o.matrixWorld); if (inR(p.x, p.z) && p.y > -1 && p.y < 14) { m4.makeScale(0, 0, 0); o.setMatrixAt(i, m4); hit++; } } if (hit) o.instanceMatrix.needsUpdate = true; return; }
    if (o.isMesh || o.isSprite || o.isLine || o.isPoints) {
      if (o.isSprite) { o.getWorldPosition(v); if (inR(v.x, v.z) && v.y > -1 && v.y < 16) kill.push(o); return; }
      bb.setFromObject(o); if (bb.isEmpty()) return; bb.getSize(sz); bb.getCenter(v);
      const r = inR(v.x, v.z); if (!r || anchored(v.x, v.z)) return;
      if (bb.max.y < -.5 || bb.min.y > 30) return;
      const big = sz.x > r.Z.W + 6 || sz.z > r.Z.D + 6;   // 캠퍼스 전체 바닥 · 길 합친 메시는 남긴다
      if (big) return;
      if (bb.max.y < .05 && (sz.x > r.Z.W * .9 || sz.z > r.Z.D * .9) && !(bb.min.x > r.x1 && bb.max.x < r.x2 && bb.min.z > r.z1 && bb.max.z < r.z2)) return;   // 길 · 보도블록
      kill.push(o); return;
    }
    for (let i = o.children.length - 1; i >= 0; i--) visit(o.children[i]);
  };
  // 그룹 단위로 보되, 그룹 안 메시는 하나씩 판정 (자식부터)
  const walk = o => { if (o.userData && (o.userData.facNew || o.userData.facKeep)) return; if (protect.has(o)) return; if (o.isMesh || o.isSprite || o.isLight || o.isInstancedMesh || o.isLine || o.isPoints) return visit(o); for (let i = o.children.length - 1; i >= 0; i--) walk(o.children[i]); };
  scene.children.forEach(c => { if (c.isCamera) return; walk(c); });
  kill.forEach(o => { if (o.parent) o.parent.remove(o); });
  // 충돌 상자 · 문 · 숨는 곳
  const F0 = floors[0];
  if (cols) for (const k of ['col', 'walls', 'doorWalls']) if (F0[k]) F0[k] = F0[k].filter(r => { if (r.facKeep) return true; const cx = ((r.x1 ?? 0) + (r.x2 ?? 0)) / 2, cz = ((r.z1 ?? 0) + (r.z2 ?? 0)) / 2; return !inR(cx, cz, 0) || anchored(cx, cz); });
  return { removed: kill.length, inR };
}

// ───────── 시설 빌더 ─────────
class Fac {
  constructor(ctx, Z, o) {
    this.ctx = ctx; this.Z = Z; this.o = o; this.levels = o.levels || 1;
    this.g = new THREE.Group(); this.g.name = 'FAC_' + o.id; this.g.userData.facNew = true; this.g.userData.rbKeep = true; this.g.userData.dynamic = true;
    ctx.scene.add(this.g);
    this.buckets = {}; this.lamps = {}; this.glass = []; this.L = lib();
    this.x0 = Z.cx - Z.W / 2; this.x1 = Z.cx + Z.W / 2; this.z0 = Z.cz - Z.D / 2; this.z1 = Z.cz + Z.D / 2;
    this.H = o.H || this.levels * FH;
  }
  // 로컬(시설 중심 기준) → 월드
  wx(x) { return this.Z.cx + x; } wz(z) { return this.Z.cz + z; }
  geo(g, mk, x, y, z, o = {}) {
    const e = new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0), q = new THREE.Quaternion().setFromEuler(e);
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(this.wx(x), y, this.wz(z)), q, new THREE.Vector3(1, 1, 1)));
    if (!g.index) g = g.toNonIndexed ? g : g;
    (this.buckets[mk] ||= []).push(g); return g;
  }
  box(w, h, d, mk, x, y, z, o = {}) { const tile = o.tile ?? this.L[mk][1]; return this.geo(boxUV(w, h, d, tile), mk, x, y, z, o); }
  cyl(rt, rb, h, mk, x, y, z, o = {}) { return this.geo(new THREE.CylinderGeometry(rt, rb, h, o.seg || 14, 1, !!o.open), mk, x, y, z, o); }
  sph(r, mk, x, y, z, o = {}) { return this.geo(new THREE.SphereGeometry(r, o.ws || 20, o.hs || 12, 0, o.phiL ?? Math.PI * 2, 0, o.thL ?? Math.PI), mk, x, y, z, o); }
  plane(w, d, mk, x, y, z, o = {}) { const tile = o.tile ?? this.L[mk][1], g = new THREE.PlaneGeometry(w, d); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile); g.rotateX(o.up === false ? Math.PI / 2 : -Math.PI / 2); return this.geo(g, mk, x, y, z, o); }
  mesh(geom, mat, x, y, z, o = {}) { const m = new THREE.Mesh(geom, mat); m.position.set(this.wx(x), y, this.wz(z)); m.rotation.set(o.rx || 0, o.ry || 0, o.rz || 0); m.userData.dynamic = true; m.castShadow = !!o.cast; m.receiveShadow = true; (o.parent || this.g).add(m); return m; }
  sign(text, sub, w, h, x, y, z, ry = 0, colors) { const t = canvasSign(text, sub, 1024, sub ? 220 : 200, ...(colors || [])); return this.mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t }), x, y, z, { ry }); }
  // 충돌: lvl 0/1 (2층 건물은 층마다 높이 범위를 나눈다), h 가 있으면 올라설 수 있는 가구
  col(x1, x2, z1, z2, o = {}) {
    const r = { x1: this.wx(Math.min(x1, x2)), x2: this.wx(Math.max(x1, x2)), z1: this.wz(Math.min(z1, z2)), z2: this.wz(Math.max(z1, z2)) }, lvl = o.lvl || 0, F0 = this.ctx.floors[0];
    if (o.h != null) r.h = lvl * FH + o.h;
    if (this.levels > 1) { if (lvl === 0) { if (o.h == null) r.maxY = o.maxY ?? FH - .2; } else r.y0 = lvl * FH - .1; }
    F0.col.push(r); if (o.h == null && this.levels === 1 && o.wall !== false) F0.walls.push(r);
    return r;
  }
  lamp(x, z, lvl = 0, y = null, rot = 0) {
    const yy = y ?? (lvl * FH + CEIL - .04);
    this.box(rot ? .32 : 1.26, .07, rot ? 1.26 : .32, 'HOUSING', x, yy, z);
    const g = new THREE.BoxGeometry(rot ? .22 : 1.18, .02, rot ? 1.18 : .22); g.translate(this.wx(x), yy - .045, this.wz(z)); (this.lamps[lvl] ||= []).push(g);
  }
  prop(p, x, z, y, lvl = 0) { p.floor = 0; p.x = this.wx(x); p.z = this.wz(z); p.y = lvl * FH + y; if (lvl > 0) p.minSh = undefined; return p; }
  // 형광등 스위치: 같은 층 형광등(emissive) 을 끄고 켠다 (game.js light_switch 처리와 같은 sw 구조)
  addSwitch(x, z, ry, lvl, label) {
    const nx = Math.sin(ry), nz = Math.cos(ry), y0 = lvl * FH;
    this.box(.09, .13, .02, 'WHITE', x, y0 + 1.3, z, { ry }); this.box(.028, .05, .012, 'BLACK', x + nx * .014, y0 + 1.31, z + nz * .014, { ry });
    const rect = { x1: this.x0, x2: this.x1, z1: this.z0, z2: this.z1, y1: y0, y2: y0 + FH - .2 };
    this.ctx.world.props.push({ kind: 'robj', k: 'light_switch', t: 'fac', floor: 0, x: this.wx(x + nx * .45), z: this.wz(z + nz * .45), y: y0 + 1.3, r: 1.5, label: label + ' 끄기', sw: { grp: this.g, rect, on: true, base: label } });
  }
  finish() {
    const mats = this.L;
    for (const [k, list] of Object.entries(this.buckets)) {
      if (!list.length) continue;
      const g = mergeGeometries(list.map(q => q.index ? q : q), false); if (!g) { console.warn('[fac] merge fail', k); continue; }
      g.computeBoundingSphere(); const m = new THREE.Mesh(g, mats[k][0]); m.name = this.o.id + '_' + k; m.userData.dynamic = true; m.castShadow = !/^(F0|C0|W0|SLAB|CARPET)/.test(k); m.receiveShadow = true; this.g.add(m);
    }
    for (const [lvl, list] of Object.entries(this.lamps)) {
      const g = mergeGeometries(list, false); g.computeBoundingBox(); const c = new THREE.Vector3(); g.boundingBox.getCenter(c); c.y = +lvl * FH + CEIL - .1; g.translate(-c.x, -c.y, -c.z);
      const m = new THREE.Mesh(g, LAMP_ON()); m.position.copy(c); m.userData.dynamic = true; this.g.add(m);
    }
    this.buckets = {}; this.lamps = {};
  }
}

// ── 공통 시공: 실(방) 하나 = 바닥 · 천장 · 사방 벽 라이너(실 쪽 마감) ──
//   r = { name, x1, x2, z1, z2 (로컬), lvl, F, W, C, ceil, gaps: { N:[[a,b,h]], S, W, E } }
function room(B, r) {
  const y0 = r.lvl * FH, ch = r.ceil ?? CEIL, w = r.x2 - r.x1, d = r.z2 - r.z1, cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2;
  if (!r.noFloor) B.plane(w, d, r.F, cx, y0 + .025, cz);
  if (!r.noCeil && r.stair) {   // 계단실 천장: 계단이 지나가는 구멍을 남긴다 (통째로 덮어 계단을 오르면 천장을 뚫고 지나갔다)
    const h = stairHoleOf(r), P = (x1, x2, z1, z2) => { if (x2 - x1 > .02 && z2 - z1 > .02) B.plane(x2 - x1, z2 - z1, r.C, (x1 + x2) / 2, y0 + ch, (z1 + z2) / 2, { up: false }); };
    P(r.x1, r.x2, h.z2, r.z2); P(r.x1, h.x1, r.z1, h.z2); P(h.x2, r.x2, r.z1, h.z2);
  } else if (!r.noCeil) B.plane(w, d, r.C, cx, y0 + ch, cz, { up: false });
  const side = (dir, a1, a2, fixed) => {   // 벽 라이너 한 면 (gaps 는 구멍 [a,b,높이])
    const gaps = (r.gaps && r.gaps[dir] || []).slice().sort((p, q) => p[0] - q[0]); let a = a1;
    const seg = (p, q, yb, yt) => { if (q - p < .02 || yt - yb < .02) return; const L = q - p, m = (p + q) / 2, hh = yt - yb;
      if (dir === 'N') B.box(L, hh, LIN, r.W, m, y0 + yb + hh / 2, fixed + LIN / 2); else if (dir === 'S') B.box(L, hh, LIN, r.W, m, y0 + yb + hh / 2, fixed - LIN / 2);
      else if (dir === 'W') B.box(LIN, hh, L, r.W, fixed + LIN / 2, y0 + yb + hh / 2, m); else B.box(LIN, hh, L, r.W, fixed - LIN / 2, y0 + yb + hh / 2, m); };
    for (const [p, q, gh] of gaps) { seg(a, p, 0, ch); seg(p, q, gh ?? 2.1, ch); a = q; }
    seg(a, a2, 0, ch);
    // 걸레받이 (높이 10cm)
    if (!r.noBase && r.W !== 'W05') { let b = a1; for (const [p, q] of gaps) { baseb(B, dir, b, p, fixed, y0); b = q; } baseb(B, dir, b, a2, fixed, y0); }
  };
  side('N', r.x1, r.x2, r.z1); side('S', r.x1, r.x2, r.z2); side('W', r.z1, r.z2, r.x1); side('E', r.z1, r.z2, r.x2);
}
function baseb(B, dir, p, q, fixed, y0) { if (q - p < .05) return; const L = q - p, m = (p + q) / 2, o = LIN + .012;
  if (dir === 'N') B.box(L, .1, .024, 'DARKWOOD', m, y0 + .05, fixed + o); else if (dir === 'S') B.box(L, .1, .024, 'DARKWOOD', m, y0 + .05, fixed - o);
  else if (dir === 'W') B.box(.024, .1, L, 'DARKWOOD', fixed + o, y0 + .05, m); else B.box(.024, .1, L, 'DARKWOOD', fixed - o, y0 + .05, m); }

// 문틀 + 여닫는 문짝 (닫힌 채 시작 · [E] 로 연다 — 예전엔 열린 채 고정된 장식이라 닫을 수 없었다). open: 열리는 쪽(실 방향) 부호 · 0 이면 문틀만
function doorway(B, axis, at, a, b, lvl, open = 1, leafMat = 'DARKWOOD') {
  const y0 = lvl * FH, w = b - a, m = (a + b) / 2;
  if (axis === 'z') { B.box(.06, 2.12, .2, 'FRAME', a, y0 + 1.06, at); B.box(.06, 2.12, .2, 'FRAME', b, y0 + 1.06, at); B.box(w + .12, .08, .2, 'FRAME', m, y0 + 2.14, at); }
  else { B.box(.2, 2.12, .06, 'FRAME', at, y0 + 1.06, a); B.box(.2, 2.12, .06, 'FRAME', at, y0 + 1.06, b); B.box(.2, .08, w + .12, 'FRAME', at, y0 + 2.14, m); }
  if (!open) return;
  const sgn = Math.sign(open), L = B.L[leafMat][0], lw = w - .06;
  const pivot = new THREE.Group(); pivot.userData.dynamic = true; B.g.add(pivot);
  if (axis === 'z') pivot.position.set(B.wx(a + .03), y0, B.wz(at)); else pivot.position.set(B.wx(at), y0, B.wz(a + .03));
  const leaf = new THREE.Mesh(axis === 'z' ? new THREE.BoxGeometry(lw, 2.04, .045) : new THREE.BoxGeometry(.045, 2.04, lw), L); leaf.castShadow = true; leaf.receiveShadow = true;
  axis === 'z' ? leaf.position.set(lw / 2, 1.03, 0) : leaf.position.set(0, 1.03, lw / 2); pivot.add(leaf);
  const knob = new THREE.Mesh(new THREE.BoxGeometry(.03, .03, .14), B.L.CHROME[0]); axis === 'z' ? knob.position.set(lw - .1, 1.0, 0) : (knob.rotation.y = Math.PI / 2, knob.position.set(0, 1.0, lw - .1)); pivot.add(knob);
  const c = B.col(0, 0, 0, 0, { lvl });   // 문짝 충돌 (닫힘: 구멍을 막는다 · 열림: 문짝이 벽에 붙은 자리)
  const D = { pivot, col: c, open: false, t: 0, target: 0,
    sync() { const ang = (axis === 'z' ? 1 : -1) * sgn * Math.PI / 2 * this.t; pivot.rotation.y = ang;
      const vx = axis === 'z' ? lw : 0, vz = axis === 'z' ? 0 : lw, cs = Math.cos(ang), sn = Math.sin(ang), hx = pivot.position.x, hz = pivot.position.z, ex = hx + vx * cs + vz * sn, ez = hz - vx * sn + vz * cs;
      c.x1 = Math.min(hx, ex) - .04; c.x2 = Math.max(hx, ex) + .04; c.z1 = Math.min(hz, ez) - .04; c.z2 = Math.max(hz, ez) + .04; } };
  D.sync();
  const px = axis === 'z' ? B.wx(m) : B.wx(at), pz = axis === 'z' ? B.wz(at) : B.wz(m);
  B.ctx.world.props.push({ kind: 'robj', k: 'fac_door', t: 'fac', floor: 0, x: px, z: pz, y: y0 + 1.1, r: 1.6, label: '문 열기', fdoor: D });
  (B.ctx.world.facDoors ||= []).push(D);
}

// ── 평면 생성: 북측 실 열 · 복도 · 남측 실 열 (위 → 아래), 남측 가운데 현관 ──
//   spec.N / spec.S = [{ name, w, fin:'gen'|'wet'|'dorm'|'exh'|'ind', door:x(로컬 실 안 상대 위치 0~1) , lobby, stair, stairTop, open }]
const FIN = { gen: ['F01', 'W01', 'C01'], wet: ['F04', 'W05', 'C03'], dorm: ['F02', 'W03', 'C01'], exh: ['F01', 'W02', 'C01'], read: ['F02', 'W01', 'C01'], ind: ['F05', 'W04', 'C04'], aud: ['F03', 'W01', 'C02'] };
function layoutLevel(B, lvl, spec) {
  const { W, D } = B.Z, hx = W / 2 - WALL_T, hz = D / 2 - WALL_T, [c0, c1] = spec.corr, rooms = [];
  const row = (list, z1, z2, north) => { let x = -W / 2 + WALL_T; const tot = list.reduce((s, q) => s + q.w, 0), k = (W - 2 * WALL_T) / tot;
    list.forEach((q, i) => { const w = q.w * k, r = { ...q, x1: x, x2: x + w, z1, z2, lvl, north }; x += w; rooms.push(r); }); };
  row(spec.N, -hz, c0 - .06, true); row(spec.S, c1 + .06, hz, false);
  const corr = { name: spec.corrName || '복도', x1: -hx, x2: hx, z1: c0 + .06, z2: c1 - .06, lvl, fin: spec.corrFin || 'gen', corridor: true }; rooms.push(corr);
  // 구멍: 실 ↔ 복도 문 (1.0m), 로비는 복도 쪽 전면 개방, 현관은 남쪽 외벽 2.0m
  rooms.forEach(r => { r.gaps = { N: [], S: [], W: [], E: [] }; const f = FIN[r.fin || 'gen']; r.F = r.F || f[0]; r.W = r.W || f[1]; r.C = r.C || f[2]; });
  const doorW = 1.0;
  rooms.filter(r => !r.corridor).forEach(r => {
    const dir = r.north ? 'S' : 'N', cd = r.north ? 'N' : 'S';
    if (r.lobby || r.open) { const p = r.x1 + .15, q = r.x2 - .15; r.gaps[dir].push([p, q, CEIL - .2]); corr.gaps[cd].push([p, q, CEIL - .2]); }
    else { const dx = r.x1 + (r.x2 - r.x1) * (r.door ?? .5); const p = Math.max(r.x1 + .25, dx - doorW / 2), q = Math.min(r.x2 - .25, p + doorW);
      r.gaps[dir].push([p, q, 2.1]); corr.gaps[cd].push([p, q, 2.1]); r.doorAt = [p, q]; doorway(B, 'z', r.north ? r.z2 + .06 : r.z1 - .06, p, q, lvl, .9); }
    if (r.lobby && lvl === 0) r.gaps.S.push([-1.0, 1.0, 2.4]);   // 현관 (남측 외벽 가운데)
    if (r.stair && lvl === 0) stairFlight(B, r);
    if (r.stairTop) r.stairHole = stairHoleOf(r);
  });
  // 충돌: 실 사이 칸막이 (x 경계), 복도 벽 (문 구멍 제외)
  const L = { lvl };
  const segCols = (list, north) => { for (let i = 0; i < list.length - 1; i++) { const a = rooms.find(r => r === list[i]); } };
  const rowRooms = n => rooms.filter(r => !r.corridor && r.north === n);
  [true, false].forEach(n => { const rr = rowRooms(n); for (let i = 0; i < rr.length - 1; i++) B.col(rr[i].x2 - .08, rr[i].x2 + .08, rr[i].z1, rr[i].z2, L);
    const zw = n ? c0 : c1; let a = -hx; const gaps = rr.flatMap(r => r.gaps[n ? 'S' : 'N']).sort((p, q) => p[0] - q[0]);
    for (const [p, q] of gaps) { if (p - a > .02) B.col(a, p, zw - .08, zw + .08, L); a = q; } if (hx - a > .02) B.col(a, hx, zw - .08, zw + .08, L); });
  return rooms;
}
// 직선 계단: 실 북쪽 벽을 따라 동쪽으로 오른다 (단 높이 0.2m × 18단 · 디딤판 0.28m · 폭 1.3m)
const ST_N = 18, ST_RUN = .28, ST_W = 1.3;
function stairFlight(B, r) {
  const sx = r.x1 + .35, z1 = r.z1 + .02, z2 = z1 + ST_W, rise = FH / ST_N;
  for (let i = 0; i < ST_N; i++) { const a = sx + i * ST_RUN, h = (i + 1) * rise;
    B.box(ST_RUN, h, ST_W, 'SLAB', a + ST_RUN / 2, h / 2, (z1 + z2) / 2); B.box(ST_RUN + .02, .025, ST_W, 'GRANITE', a + ST_RUN / 2, h + .012, (z1 + z2) / 2);
    B.box(ST_RUN + .02, .012, .05, 'RUBBER', a + ST_RUN - .03, h + .028, (z1 + z2) / 2, { ry: Math.PI / 2, tile: 1 });
    B.col(a, a + ST_RUN, z1, z2, { lvl: 0, h }); }
  // 난간 (남쪽 열린 면): 동자 기둥 + 손잡이 (경사)
  const len = ST_N * ST_RUN, ang = Math.atan2(FH, len);
  for (let i = 1; i < ST_N; i += 2) B.cyl(.016, .016, .9, 'STEEL', sx + i * ST_RUN + .14, (i + 1) * rise + .45, z2 + .02, { seg: 8 });
  B.box(Math.hypot(len, FH) + .2, .05, .06, 'DARKWOOD', sx + len / 2, FH / 2 + .95, z2 + .02, { rz: ang });
  B.col(sx + .6, sx + len, z2 - .02, z2 + .08, { lvl: 0, maxY: 3.3 });   // 계단 옆으로 떨어지지 않게 (1층에서는 계단 밑 벽)
  r.stairX = [sx, sx + len]; r.stairZ = [z1, z2];
}
function stairHoleOf(r) { const sx = r.x1 + .35; return { x1: sx - .05, x2: sx + ST_N * ST_RUN, z1: r.z1, z2: r.z1 + .02 + ST_W + .04 }; }

// 바깥 껍데기: 외벽(벽돌) · 기단 · 층 띠 · 처마 · 파라펫 · 창 · 현관 캐노피 · 간판 · 지붕 · 슬래브 충돌
function shell(B, o = {}) {
  const { W, D } = B.Z, H = B.H, t = WALL_T, hw = W / 2, hd = D / 2, ext = o.ext || 'BRICK';
  const doorGap = o.door ?? 2.0;
  // 외벽 (현관 구멍 포함) — 바깥 벽돌 · 안쪽은 실 라이너가 덮는다. side: 'S'(남측 가운데, 기본) | 'E'(동측 가운데)
  const E = o.side === 'E', C = (x1, x2, z1, z2) => { const r = B.col(x1, x2, z1, z2, { lvl: 0, maxY: 99 }); delete r.maxY; if (B.levels > 1) B.ctx.floors[0].walls.push(r); };
  B.box(W, H, t, ext, 0, H / 2, -hd + t / 2); B.box(t, H, D - 2 * t, ext, -hw + t / 2, H / 2, 0); C(-hw, hw, -hd, -hd + t); C(-hw, -hw + t, -hd, hd);
  let sw;
  if (!E) { B.box(t, H, D - 2 * t, ext, hw - t / 2, H / 2, 0); C(hw - t, hw, -hd, hd);
    sw = (W - doorGap) / 2; B.box(sw, H, t, ext, -hw + sw / 2, H / 2, hd - t / 2); B.box(sw, H, t, ext, hw - sw / 2, H / 2, hd - t / 2); B.box(doorGap, H - 2.4, t, ext, 0, 2.4 + (H - 2.4) / 2, hd - t / 2);
    C(-hw, -doorGap / 2, hd - t, hd); C(doorGap / 2, hw, hd - t, hd); }
  else { B.box(W, H, t, ext, 0, H / 2, hd - t / 2); C(-hw, hw, hd - t, hd); sw = (D - doorGap) / 2;
    B.box(t, H, sw - t, ext, hw - t / 2, H / 2, -hd + t + (sw - t) / 2); B.box(t, H, sw - t, ext, hw - t / 2, H / 2, hd - t - (sw - t) / 2); B.box(t, H - 2.4, doorGap, ext, hw - t / 2, 2.4 + (H - 2.4) / 2, 0);
    C(hw - t, hw, -hd, -doorGap / 2); C(hw - t, hw, doorGap / 2, hd); }
  // 기단 (화강석 0.6m) · 층 띠 · 처마 코니스 · 파라펫
  const ring = (y, h, out, mk) => { B.box(W + 2 * out, h, out + .02, mk, 0, y, -hd - out / 2); B.box(W + 2 * out, h, out + .02, mk, 0, y, hd + out / 2); B.box(out + .02, h, D + 2 * out, mk, -hw - out / 2, y, 0); B.box(out + .02, h, D + 2 * out, mk, hw + out / 2, y, 0); };
  ring(.3, .6, .05, 'GRANITE');
  for (let l = 1; l < B.levels; l++) ring(l * FH, .3, .06, 'CONC');
  ring(H - .15, .3, .1, 'CONC');
  B.box(W + .3, .9, .18, 'CONC', 0, H + .45, -hd + .05); B.box(W + .3, .9, .18, 'CONC', 0, H + .45, hd - .05); B.box(.18, .9, D, 'CONC', -hw + .05, H + .45, 0); B.box(.18, .9, D, 'CONC', hw - .05, H + .45, 0);
  B.box(W + .4, .06, .26, 'ALU', 0, H + .93, -hd + .05); B.box(W + .4, .06, .26, 'ALU', 0, H + .93, hd - .05); B.box(.26, .06, D + .4, 'ALU', -hw + .05, H + .93, 0); B.box(.26, .06, D + .4, 'ALU', hw - .05, H + .93, 0);
  // 지붕 슬래브 (방수 시트) + 옥상 실외기 · 환기구 · 선홈통
  B.box(W, .25, D, 'SLAB', 0, H + .12, 0, { tile: 3 });
  if (!o.noRoofKit) { [[-hw + 2.2, -hd + 2], [-hw + 3.6, -hd + 2]].forEach(([x, z]) => { B.box(1.0, .8, .45, 'GREYSTEEL', x, H + .65, z); B.cyl(.18, .18, .02, 'BLACK', x, H + .65, z + .23, { rx: Math.PI / 2 }); });
    B.box(.6, .5, .6, 'ALU', hw - 2, H + .5, hd - 2.4); B.cyl(.08, .08, H, 'ALU', -hw - .1, H / 2, hd + .1, { seg: 8 }); B.cyl(.08, .08, H, 'ALU', hw + .1, H / 2, -hd - .1, { seg: 8 }); }
  // 현관 캐노피 + 기둥 2 + 간판 + 디딤판 + 유리 양개문 — 로컬 (u: 출입면을 따라, n: 바깥쪽) 로 그린다
  const P = (u, n) => E ? [hw + n, -u] : [u, hd + n], RY = E ? Math.PI / 2 : 0;
  const bx = (wu, h, wn, mk, u, y, n, oo = {}) => { const [x, z] = P(u, n); return E ? B.box(wn, h, wu, mk, x, y, z, oo) : B.box(wu, h, wn, mk, x, y, z, oo); };
  const cl = (u1, u2, n1, n2, oo) => { const [ax, az] = P(u1, n1), [bx2, bz] = P(u2, n2); B.col(Math.min(ax, bx2), Math.max(ax, bx2), Math.min(az, bz), Math.max(az, bz), oo); };
  bx(4.4, .22, 2.6, 'CONC', 0, 3.0, 1.25); bx(4.5, .06, 2.7, 'ALU', 0, 3.13, 1.25);
  [-1.9, 1.9].forEach(u => { const [x, z] = P(u, 2.3); B.cyl(.12, .12, 3.0, 'CONC', x, 1.5, z, { seg: 16 }); cl(u - .14, u + .14, 2.16, 2.44, { lvl: 0, maxY: 99 }); });
  bx(4.2, .12, 2.2, 'GRANITE', 0, .06, 1.2); cl(-2.1, 2.1, 0, 2.3, { lvl: 0, h: .12 });
  { const [x, z] = P(0, .14); B.sign(o.sign || B.o.name, o.signSub || '', 3.4, .62, x, 3.55, z, RY, ['#1c2a34', '#f4eedc']); }
  if (o.closedDoor) { bx(2.0, 2.4, .12, 'DARKWOOD', 0, 1.2, -.12); bx(.04, .8, .02, 'CHROME', -.12, 1.1, -.04); bx(.04, .8, .02, 'CHROME', .12, 1.1, -.04); bx(.02, 2.4, .14, 'FRAME', 0, 1.2, -.11); cl(-1.05, 1.05, -.25, 0, { lvl: 0, maxY: 99 }); }
  else { [-1, 1].forEach(s => { bx(.05, 2.4, .06, 'FRAME', s * 1.0, 1.2, -.1); const [gx, gz] = P(s * 1.45, -.3); const gl = B.mesh(new THREE.PlaneGeometry(.9, 2.2), GLASS(), gx, 1.12, gz, { ry: RY + s * Math.PI / 2 }); gl.renderOrder = 2; bx(.04, 2.3, .95, 'FRAME', s * 1.92, 1.15, -.3); }); }
  bx(2.1, .1, .1, 'FRAME', 0, 2.42, -.1);
  // 창: 층마다 외벽 4면 (현관 · 모서리 피함) — 바깥 프레임 + 유리 + 창턱, 안쪽 프레임 + 은은한 달빛 유리
  const winM = new THREE.MeshStandardMaterial({ color: 0x1c2630, roughness: .08, metalness: .5, emissive: 0x0c1418, emissiveIntensity: .4 });
  const winIn = new THREE.MeshStandardMaterial({ color: 0x6a8494, roughness: .1, metalness: .2, emissive: 0x1a2a38, emissiveIntensity: .55 });
  const wins = [], ww = 1.6, wh = 1.5, step = o.winStep || 3.2;
  for (let l = 0; l < B.levels; l++) { const y = l * FH + 1.65; if (o.noWin && o.noWin(l)) continue;
    for (let x = -hw + 2.0; x <= hw - 2.0 + .01; x += step) { wins.push([x, y, -hd, 0]); if (E || Math.abs(x) > 2.8) wins.push([x, y, hd, 0]); }
    for (let z = -hd + 2.2; z <= hd - 2.2 + .01; z += step) { wins.push([-hw, y, z, 1]); if (!E || Math.abs(z) > 2.8) wins.push([hw, y, z, 1]); } }
  const wg = [], wgIn = [];
  wins.forEach(([x, y, z, side]) => {
    const out = side ? Math.sign(x) : Math.sign(z), ry = side ? Math.PI / 2 : 0;
    const p = (dd) => side ? [x + out * dd, z] : [x, z + out * dd];
    const [ox, oz] = p(.008), [ix, iz] = p(-(WALL_T + LIN + .01));
    const g1 = new THREE.PlaneGeometry(ww, wh); g1.rotateY(ry + (out < 0 ? Math.PI : 0)); g1.translate(B.wx(ox), y, B.wz(oz)); wg.push(g1);
    const g2 = new THREE.PlaneGeometry(ww - .1, wh - .1); g2.rotateY(ry + (out < 0 ? 0 : Math.PI)); g2.translate(B.wx(ix), y, B.wz(iz)); wgIn.push(g2);
    const fr = (dd, w2, h2, yy) => { const [fx, fz] = p(dd); if (side) B.box(.06, h2, w2, 'FRAME', fx, yy, fz); else B.box(w2, h2, .06, 'FRAME', fx, yy, fz); };
    fr(.03, ww + .1, .07, y + wh / 2); fr(.03, ww + .1, .07, y - wh / 2); fr(.03, .07, wh, y); if (true) { const [fx, fz] = p(.03); if (side) { B.box(.06, wh, .07, 'FRAME', fx, y, fz - ww / 2); B.box(.06, wh, .07, 'FRAME', fx, y, fz + ww / 2); } else { B.box(.07, wh, .06, 'FRAME', fx - ww / 2, y, fz); B.box(.07, wh, .06, 'FRAME', fx + ww / 2, y, fz); } }
    const [sx, sz] = p(.09); if (side) B.box(.16, .05, ww + .2, 'CONC', sx, y - wh / 2 - .05, sz); else B.box(ww + .2, .05, .16, 'CONC', sx, y - wh / 2 - .05, sz);
    const [kx, kz] = p(-(WALL_T + LIN + .03)); if (side) { B.box(.05, .06, ww + .1, 'FRAME', kx, y - wh / 2, kz); B.box(.05, .06, ww + .1, 'FRAME', kx, y + wh / 2, kz); B.box(.05, wh, .05, 'FRAME', kx, y, kz); } else { B.box(ww + .1, .06, .05, 'FRAME', kx, y - wh / 2, kz); B.box(ww + .1, .06, .05, 'FRAME', kx, y + wh / 2, kz); B.box(.05, wh, .05, 'FRAME', kx, y, kz); }
  });
  if (wg.length) { const m = new THREE.Mesh(mergeGeometries(wg), winM); m.userData.dynamic = true; B.g.add(m); const m2 = new THREE.Mesh(mergeGeometries(wgIn), winIn); m2.userData.dynamic = true; B.g.add(m2); }
  B.wins = wins;
}
// 위층 바닥 슬래브 (메시 + 충돌), 구멍(계단) 제외
function levelSlab(B, lvl, hole) {
  const { W, D } = B.Z, hw = W / 2 - WALL_T, hd = D / 2 - WALL_T, y = lvl * FH;
  const rects = hole ? [[-hw, hw, -hd, hole.z1], [-hw, hw, hole.z2, hd], [-hw, hole.x1, hole.z1, hole.z2], [hole.x2, hw, hole.z1, hole.z2]] : [[-hw, hw, -hd, hd]];
  rects.forEach(([x1, x2, z1, z2]) => { if (x2 - x1 < .02 || z2 - z1 < .02) return; B.box(x2 - x1, .3, z2 - z1, 'SLAB', (x1 + x2) / 2, y - .15, (z1 + z2) / 2); B.col(x1, x2, z1, z2, { lvl, h: 0 }); });
  if (hole) {   // 구멍 둘레 난간 (위층)
    const yy = y; B.box(hole.x2 - hole.x1 - 1.0, .05, .06, 'DARKWOOD', (hole.x1 + hole.x2 - 1.0) / 2, yy + 1.0, hole.z2);
    for (let x = hole.x1 + .1; x < hole.x2 - 1.0; x += .3) B.cyl(.014, .014, 1.0, 'STEEL', x, yy + .5, hole.z2, { seg: 6 });
    B.box(.06, .05, hole.z2 - hole.z1, 'DARKWOOD', hole.x1, yy + 1.0, (hole.z1 + hole.z2) / 2); for (let z = hole.z1 + .15; z < hole.z2; z += .3) B.cyl(.014, .014, 1.0, 'STEEL', hole.x1, yy + .5, z, { seg: 6 });
    B.col(hole.x1 - .05, hole.x2 - 1.0, hole.z2 - .04, hole.z2 + .06, { lvl }); B.col(hole.x1 - .06, hole.x1 + .04, hole.z1, hole.z2, { lvl });
  }
}

// ───────── 가구 (CSV 규격, mm → m) ─────────
const FURN = {
  desk(B, x, z, ry = 0, lvl = 0, w = 1.2, d = .6, h = .72, top = 'LPM') { const y = lvl * FH, c = Math.cos(ry), s = Math.sin(ry);
    B.box(w, .03, d, top, x, y + h - .015, z, { ry }); B.box(w - .06, .3, .02, 'GREYSTEEL', x + s * (d / 2 - .04), y + h - .2, z + c * (d / 2 - .04), { ry });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const lx = a * (w / 2 - .04), lz = b * (d / 2 - .04); B.box(.035, h - .03, .035, 'GREYSTEEL', x + lx * c + lz * s, y + (h - .03) / 2, z - lx * s + lz * c); });
    const hw = (Math.abs(c) * w + Math.abs(s) * d) / 2, hd = (Math.abs(s) * w + Math.abs(c) * d) / 2; B.col(x - hw, x + hw, z - hd, z + hd, { lvl, h }); },
  chair(B, x, z, ry = 0, lvl = 0, seat = 'FABRIC', w = .45, d = .5, h = .8) { const y = lvl * FH, c = Math.cos(ry), s = Math.sin(ry), sh = .45;
    B.box(w, .05, d - .04, seat, x, y + sh, z, { ry }); B.box(w, h - sh - .05, .04, seat, x - s * (d / 2 - .03), y + sh + (h - sh) / 2, z - c * (d / 2 - .03), { ry });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const lx = a * (w / 2 - .03), lz = b * (d / 2 - .05); B.box(.022, sh, .022, 'FRAME', x + lx * c + lz * s, y + sh / 2, z - lx * s + lz * c); }); },
  table(B, x, z, w, d, h, lvl = 0, top = 'LPM', leg = 'GREYSTEEL', ry = 0) { const y = lvl * FH, c = Math.cos(ry), s = Math.sin(ry);
    B.box(w, .035, d, top, x, y + h - .018, z, { ry }); B.box(w - .1, .06, d - .1, leg, x, y + h - .07, z, { ry });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const lx = a * (w / 2 - .08), lz = b * (d / 2 - .08); B.box(.05, h - .04, .05, leg, x + lx * c + lz * s, y + (h - .04) / 2, z - lx * s + lz * c); });
    const hw = (Math.abs(c) * w + Math.abs(s) * d) / 2, hd = (Math.abs(s) * w + Math.abs(c) * d) / 2; B.col(x - hw, x + hw, z - hd, z + hd, { lvl, h }); },
  cabinet(B, x, z, ry, lvl, w, d, h, mk = 'GREYSTEEL', doors = 2) { const y = lvl * FH, c = Math.cos(ry), s = Math.sin(ry);
    B.box(w, h, d, mk, x, y + h / 2, z, { ry });
    for (let k = 0; k < doors; k++) { const lx = -w / 2 + w / doors * (k + .5); B.box(w / doors - .02, h - .06, .01, mk, x + lx * c + s * (d / 2 + .005), y + h / 2, z - lx * s + c * (d / 2 + .005), { ry }); B.box(.02, .14, .02, 'CHROME', x + (lx + (k % 2 ? -1 : 1) * (w / doors / 2 - .06)) * c + s * (d / 2 + .02), y + h / 2, z - (lx + (k % 2 ? -1 : 1) * (w / doors / 2 - .06)) * s + c * (d / 2 + .02), { ry }); }
    const hw = (Math.abs(c) * w + Math.abs(s) * d) / 2, hd = (Math.abs(s) * w + Math.abs(c) * d) / 2; B.col(x - hw, x + hw, z - hd, z + hd, { lvl }); },
  shelf(B, x, z, ry, lvl, w, d, h, mk = 'GREYSTEEL', n = 5, goods = null) { const y = lvl * FH, c = Math.cos(ry), s = Math.sin(ry);
    for (let k = 0; k < n; k++) B.box(w, .025, d, mk, x, y + .08 + k * (h - .1) / (n - 1), z, { ry });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const lx = a * (w / 2 - .02), lz = b * (d / 2 - .02); B.box(.035, h, .035, mk, x + lx * c + lz * s, y + h / 2, z - lx * s + lz * c); });
    if (goods) for (let k = 0; k < n - 1; k++) for (let j = 0; j < 3; j++) { const lx = -w / 2 + .18 + j * (w - .3) / 2, gy = y + .08 + k * (h - .1) / (n - 1) + .13; if ((k + j) % 3 === 2) continue; B.box(.26, .22, d - .1, goods[(k + j) % goods.length], x + lx * c, gy, z - lx * s, { ry }); }
    const hw = (Math.abs(c) * w + Math.abs(s) * d) / 2, hd = (Math.abs(s) * w + Math.abs(c) * d) / 2; B.col(x - hw, x + hw, z - hd, z + hd, { lvl }); },
  lockers(B, x, z, ry, lvl, n, w = .4, d = .5, h = 1.8, mk = 'GREENSTEEL') { const y = lvl * FH, c = Math.cos(ry), s = Math.sin(ry), W = n * w;
    B.box(W, h, d, mk, x, y + h / 2, z, { ry });
    for (let k = 0; k < n; k++) { const lx = -W / 2 + w * (k + .5); B.box(w - .02, h - .08, .012, mk, x + lx * c + s * (d / 2 + .006), y + h / 2, z - lx * s + c * (d / 2 + .006), { ry });
      for (let v = 0; v < 3; v++) B.box(w * .5, .012, .014, 'BLACK', x + lx * c + s * (d / 2 + .013), y + h - .2 - v * .04, z - lx * s + c * (d / 2 + .013), { ry });
      B.box(.02, .1, .02, 'CHROME', x + (lx + w / 2 - .07) * c + s * (d / 2 + .02), y + 1.0, z - (lx + w / 2 - .07) * s + c * (d / 2 + .02), { ry }); }
    const hw = (Math.abs(c) * W + Math.abs(s) * d) / 2, hd = (Math.abs(s) * W + Math.abs(c) * d) / 2; B.col(x - hw, x + hw, z - hd, z + hd, { lvl }); },
  bunk(B, x, z, ry, lvl) { const y = lvl * FH, w = 1.0, d = 2.1, h = 1.5, c = Math.cos(ry), s = Math.sin(ry);   // 2층침대 1000×2100×1500 (목재 상판 · 철제 프레임)
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const lx = a * (w / 2 - .03), lz = b * (d / 2 - .03); B.box(.05, h, .05, 'FRAME', x + lx * c + lz * s, y + h / 2, z - lx * s + lz * c); });
    [.3, 1.2].forEach(hy => { B.box(w, .05, d, 'WOOD', x, y + hy, z, { ry }); B.box(w - .08, .14, d - .1, 'MATTRESS', x, y + hy + .1, z, { ry }); B.box(w - .1, .05, d * .6, 'BLANKET', x, y + hy + .19, z + c * .3, { ry }); B.box(.5, .1, .3, 'WHITE', x - s * (d / 2 - .25), y + hy + .22, z - c * (d / 2 - .25), { ry }); });
    B.box(.04, .3, d * .7, 'FRAME', x + c * (w / 2) , y + 1.45, z - s * (w / 2), { ry }); for (let k = 0; k < 4; k++) B.box(.4, .03, .03, 'FRAME', x + c * (w / 2 + .02) + s * (d / 2 - .1), y + .3 + k * .25, z - s * (w / 2 + .02) + c * (d / 2 - .1), { ry: ry + Math.PI / 2 });
    const hw = (Math.abs(c) * w + Math.abs(s) * d) / 2, hd = (Math.abs(s) * w + Math.abs(c) * d) / 2; B.col(x - hw, x + hw, z - hd, z + hd, { lvl, h: .5 }); },
  sinkCounter(B, x, z, ry, lvl, w = 2.4, d = .65, h = .85, basins = 2) { const y = lvl * FH, c = Math.cos(ry), s = Math.sin(ry);
    B.box(w, h - .04, d, 'SS', x, y + (h - .04) / 2, z, { ry }); B.box(w + .02, .04, d + .02, 'SS', x, y + h - .02, z, { ry });
    for (let k = 0; k < basins; k++) { const lx = -w / 2 + w / basins * (k + .5); B.box(.42, .02, .34, 'BLACK', x + lx * c, y + h + .002, z - lx * s, { ry }); B.cyl(.012, .012, .24, 'CHROME', x + lx * c - s * (d / 2 - .07), y + h + .12, z - lx * s - c * (d / 2 - .07)); }
    const hw = (Math.abs(c) * w + Math.abs(s) * d) / 2, hd = (Math.abs(s) * w + Math.abs(c) * d) / 2; B.col(x - hw, x + hw, z - hd, z + hd, { lvl, h }); },
  // 화장실: 칸막이 n 칸 (변기) + 세면대 + 거울
  // 화장실: 칸막이 n 칸 (변기) — 복도 문 반대편(바깥벽)에 붙이고, 문에서 먼 쪽 끝부터 / 세면대는 문 쪽 옆벽
  toilets(B, r, n) { const lvl = r.lvl, y = lvl * FH, sw = .95, sd = 1.45, north = r.north, dc = r.doorAt ? (r.doorAt[0] + r.doorAt[1]) / 2 : (r.x1 + r.x2) / 2, fromLeft = dc > (r.x1 + r.x2) / 2;
    const zw = north ? r.z1 + .08 : r.z2 - .08, zs = north ? 1 : -1, zc = zw + zs * sd / 2, x0 = fromLeft ? r.x1 + .1 : r.x2 - .1 - n * sw;
    for (let k = 0; k <= n; k++) { const x = x0 + k * sw; B.box(.03, 1.9, sd, 'PANEL', x, y + 1.05, zc); B.col(x - .03, x + .03, Math.min(zw, zw + zs * sd), Math.max(zw, zw + zs * sd), { lvl }); }
    for (let k = 0; k < n; k++) { const x = x0 + k * sw, xm = x + sw / 2; B.box(sw - .62, 1.8, .03, 'PANEL', x + sw - .29, y + 1.0, zw + zs * sd);
      B.box(.38, .4, .5, 'PORC', xm, y + .2, zw + zs * .32); B.box(.36, .05, .44, 'PORC', xm, y + .42, zw + zs * .34); B.box(.38, .38, .16, 'PORC', xm, y + .6, zw + zs * .1); B.col(xm - .2, xm + .2, Math.min(zw, zw + zs * .58), Math.max(zw, zw + zs * .58), { lvl, h: .45 }); }
    const sx = fromLeft ? r.x2 - .35 : r.x1 + .35, sz = (zw + zs * (sd + .3) + (north ? r.z2 : r.z1)) / 2; FURN.sinkCounter(B, sx, sz, fromLeft ? -Math.PI / 2 : Math.PI / 2, lvl, 1.6, .55, .82, 2);
    B.box(.02, .8, 1.4, 'CHROME', fromLeft ? r.x2 - .07 : r.x1 + .07, y + 1.55, sz); r.sinkAt = [fromLeft ? sx - .8 : sx + .8, sz]; },
  showers(B, r, n) { const lvl = r.lvl, y = lvl * FH, bw = .9, north = r.north, dc = r.doorAt ? (r.doorAt[0] + r.doorAt[1]) / 2 : (r.x1 + r.x2) / 2, fromLeft = dc > (r.x1 + r.x2) / 2;   // 샤워부스 900×900×2100 방수 패널
    const zw = north ? r.z1 + .08 : r.z2 - .08, zs = north ? 1 : -1, zc = zw + zs * .45, x0 = fromLeft ? r.x1 + .12 : r.x2 - .12 - n * bw;
    for (let k = 0; k <= n; k++) { const x = x0 + k * bw; B.box(.03, 2.1, .9, 'PANEL', x, y + 1.05, zc); B.col(x - .02, x + .02, Math.min(zw, zw + zs * .9), Math.max(zw, zw + zs * .9), { lvl }); }
    for (let k = 0; k < n; k++) { const xm = x0 + k * bw + bw / 2; B.cyl(.012, .012, .5, 'CHROME', xm, y + 2.0, zw + zs * .12, { rx: Math.PI / 2 }); B.cyl(.07, .07, .02, 'CHROME', xm, y + 1.95, zw + zs * .35); B.box(.5, .01, .5, 'RUBBER', xm, y + .035, zc); }
    const bx = fromLeft ? r.x2 - .45 : r.x1 + .45, bz = (r.z1 + r.z2) / 2; B.box(.4, .06, 1.6, 'WOOD', bx, y + .45, bz); B.col(bx - .2, bx + .2, bz - .8, bz + .8, { lvl, h: .48 }); },
  vitrine(B, x, z, ry, lvl, w, d, h, base = 'DARKWOOD', fill = null) { const y = lvl * FH, c = Math.cos(ry), s = Math.sin(ry), bh = h > 1.5 ? .4 : h - .3;   // 전시 진열장 (유리/목재)
    B.box(w, bh, d, base, x, y + bh / 2, z, { ry }); B.box(w + .02, .03, d + .02, 'FRAME', x, y + bh + .015, z, { ry });
    const gl = new THREE.BoxGeometry(w - .02, h - bh - .03, d - .02); const m = B.mesh(gl, GLASS(), x, y + bh + (h - bh) / 2, z, { ry }); m.renderOrder = 2;
    B.box(w, .04, d, 'FRAME', x, y + h, z, { ry }); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const lx = a * (w / 2 - .01), lz = b * (d / 2 - .01); B.box(.025, h - bh, .025, 'FRAME', x + lx * c + lz * s, y + bh + (h - bh) / 2, z - lx * s + lz * c); });
    if (fill) fill(y + bh + .03);
    const hw = (Math.abs(c) * w + Math.abs(s) * d) / 2, hd = (Math.abs(s) * w + Math.abs(c) * d) / 2; B.col(x - hw, x + hw, z - hd, z + hd, { lvl }); },
  panel(B, x, z, ry, lvl, colorMk = 'PANEL', label = null) { const y = lvl * FH, c = Math.cos(ry), s = Math.sin(ry);   // 벽면/전시 패널 1200×60×2400
    B.box(1.2, 2.4, .06, colorMk, x, y + 1.25, z, { ry }); B.box(1.0, .7, .01, 'WHITE', x + s * .036, y + 1.55, z + c * .036, { ry }); B.box(1.0, .5, .01, 'CORK', x + s * .036, y + .85, z + c * .036, { ry });
    if (label) { const m = B.sign(label, '', 1.0, .18, x + s * .045, y + 2.25, z + c * .045, ry, ['#2a2622', '#efe6d0']); } },
  railLamps(B, x1, x2, z, y) { B.box(x2 - x1, .04, .06, 'BLACK', (x1 + x2) / 2, y, z); for (let x = x1 + .4; x < x2; x += 1.1) { B.cyl(.04, .05, .14, 'BLACK', x, y - .1, z, { seg: 10 }); } },
};

// ───────── 시설별 설계 ─────────
function lampsGrid(B, r, step = 2.4) { const w = r.x2 - r.x1, d = r.z2 - r.z1, nx = Math.max(1, Math.round(w / step)), nz = Math.max(1, Math.round(d / step));
  const h = r.stair ? stairHoleOf(r) : null;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = r.x1 + w * (i + .5) / nx, z = r.z1 + d * (j + .5) / nz; if (h && x > h.x1 - .3 && x < h.x2 + .3 && z < h.z2 + .3) continue; B.lamp(x, z, r.lvl, r.lvl * FH + (r.ceil ?? CEIL) - .04); } }
function roomSign(B, r) { if (r.corridor || r.lobby || !r.doorAt) return; const y = r.lvl * FH + 2.42, [p, q] = r.doorAt, z = r.north ? r.z2 + .14 : r.z1 - .14;
  B.box(.62, .16, .02, 'FRAME', (p + q) / 2, y, z); B.sign(r.name, '', .58, .13, (p + q) / 2, y, r.north ? z + .012 : z - .012, r.north ? 0 : Math.PI, ['#f2efe6', '#1c2226']); }
function buildRooms(B, rooms) { rooms.forEach(r => { room(B, r); if (!r.noLamps) lampsGrid(B, r, r.corridor ? 3.0 : 2.4); roomSign(B, r); }); }

function buildTwoStory(B, spec) {
  shell(B, spec.shell || {});
  const R0 = layoutLevel(B, 0, spec.L0), R1 = layoutLevel(B, 1, spec.L1);
  const top = R1.find(r => r.stairTop), hole = top && top.stairHole;
  // 계단실: 1층 천장 / 2층 바닥에 계단 구멍
  const st0 = R0.find(r => r.stair); if (st0) { st0.ceil = FH - .32; }
  if (top) { top.noFloor = true; const h = hole; B.plane(top.x2 - top.x1, top.z2 - h.z2, top.F, (top.x1 + top.x2) / 2, FH + .025, (h.z2 + top.z2) / 2); if (top.x2 > h.x2) B.plane(top.x2 - h.x2, h.z2 - top.z1, top.F, (h.x2 + top.x2) / 2, FH + .025, (top.z1 + h.z2) / 2); if (h.x1 > top.x1) B.plane(h.x1 - top.x1, h.z2 - top.z1, top.F, (top.x1 + h.x1) / 2, FH + .025, (top.z1 + h.z2) / 2); }
  levelSlab(B, 1, hole);
  buildRooms(B, R0); buildRooms(B, R1);
  return { R0, R1 };
}
const byName = (R, n) => R.find(r => r.name === n);

function buildDorm(ctx, Z) {   // 청운학사 22 × 14m · 2층 (기숙사 · 생활)
  const B = new Fac(ctx, Z, { id: 'dorm', name: '청운학사', levels: 2 });
  const { R0, R1 } = buildTwoStory(B, { shell: { sign: '청 운 학 사', signSub: 'CHEONGUN DORMITORY · 서문고등학교 기숙사' },
    L0: { corr: [-1.2, 1.2], N: [{ name: '로비 · 계단', w: 6.6, stair: true, open: true }, { name: '사감실', w: 5.0 }, { name: '공용부엌', w: 5.2, fin: 'wet', W: 'W05', F: 'F01' }, { name: '창고', w: 5.2, fin: 'ind' }],
      S: [{ name: '화장실', w: 4.8, fin: 'wet', door: .8 }, { name: '샤워실', w: 4.7, fin: 'wet', door: .75 }, { name: '현관', w: 3.0, lobby: true }, { name: '식당 · 라운지', w: 9.5, door: .12 }] },
    L1: { corr: [-1.2, 1.2], N: [{ name: '계단홀', w: 6.6, stairTop: true, open: true }, { name: '기숙사 A (4인실)', w: 7.7, fin: 'dorm' }, { name: '기숙사 B (4인실)', w: 7.7, fin: 'dorm' }],
      S: [{ name: '공부방', w: 7.0, fin: 'read' }, { name: '라운지', w: 5.0, fin: 'dorm', open: true }, { name: '화장실 (2층)', w: 5.0, fin: 'wet', door: .3 }, { name: '샤워실 (2층)', w: 5.0, fin: 'wet', door: .3 }] } });
  const F = FURN;
  // 1층 — 사감실: CCTV 관제석 (dorm_log) · 서류장 · 의자
  { const r = byName(R0, '사감실'), cx = (r.x1 + r.x2) / 2; F.desk(B, cx, r.z1 + .5, 0, 0, 1.6, .7, .74); F.chair(B, cx, r.z1 + 1.2, Math.PI, 0);
    [-.45, .45].forEach(dx => { B.box(.42, .32, .3, 'BLACK', cx + dx, .74 + .17, r.z1 + .38); B.box(.36, .26, .01, 'TEAL', cx + dx, .74 + .18, r.z1 + .535); });
    F.cabinet(B, r.x2 - .4, r.z1 + 1.6, -Math.PI / 2, 0, .9, .45, 1.8, 'GREYSTEEL'); B.box(1.2, .8, .02, 'CORK', cx, 1.7, r.z1 + .07); }
  // 공용부엌: 싱크대 2400 · 냉장고 · 상부장
  { const r = byName(R0, '공용부엌'), cx = (r.x1 + r.x2) / 2; F.sinkCounter(B, cx, r.z1 + .4, 0, 0); B.box(2.4, .7, .35, 'WHITE', cx, 1.9, r.z1 + .24); F.cabinet(B, r.x2 - .45, r.z1 + 1.7, -Math.PI / 2, 0, .7, .7, 1.8, 'WHITE', 2); F.table(B, cx, r.z2 - 1.2, 1.2, .7, .76, 0, 'LPM'); }
  // 식당 · 라운지: 식탁 2 (1800×900) + 의자 4
  { const r = byName(R0, '식당 · 라운지'), cz = (r.z1 + r.z2) / 2 + .4; [r.x1 + 3.4, r.x1 + 6.6].forEach(x => { F.table(B, x, cz, 1.8, .9, .75, 0, 'LPM'); [-1, 1].forEach(s => F.chair(B, x + s * .45, cz + .75, Math.PI, 0)); }); B.box(2.0, .42, .7, 'FABRIC', r.x2 - 1.4, .21, r.z2 - .45); B.col(r.x2 - 2.4, r.x2 - .4, r.z2 - .8, r.z2 - .1, { h: .45 }); }
  // 로비 · 계단: 신발장 · 게시판
  { const r = byName(R0, '로비 · 계단'); F.shelf(B, r.x1 + 3.2, r.z2 - .3, Math.PI, 0, 2.4, .35, 1.2, 'WOOD', 4); B.box(1.4, .9, .02, 'CORK', r.x1 + 4.6, 1.6, r.z1 + .08); }
  { const r = byName(R0, '화장실'); F.toilets(B, r, 4); }
  { const r = byName(R0, '샤워실'); F.showers(B, r, 4); }
  { const r = byName(R0, '창고'); [0, 1].forEach(k => F.shelf(B, r.x1 + 1.3 + k * 2.4, r.z1 + .35, 0, 0, 1.8, .45, 1.8, 'GREYSTEEL', 5, ['PANEL', 'CORK', 'WHITE'])); F.shelf(B, r.x2 - .35, r.z1 + 2.4, -Math.PI / 2, 0, 1.8, .45, 1.8, 'GREYSTEEL', 5, ['BLANKET', 'WHITE']); }
  // 2층 — 기숙사 A/B: 2층침대 2 + 사물함 4 + 책상 2 + 의자 2
  const piv = {};
  ['기숙사 A (4인실)', '기숙사 B (4인실)'].forEach((n, i) => { const r = byName(R1, n);
    F.bunk(B, r.x1 + .7, r.z1 + 1.2, 0, 1); F.bunk(B, r.x1 + 2.0, r.z1 + 1.2, 0, 1);
    F.lockers(B, r.x2 - .35, r.z1 + 1.4, -Math.PI / 2, 1, 4);
    F.desk(B, r.x1 + 4.0, r.z1 + .45, 0, 1); F.desk(B, r.x1 + 5.3, r.z1 + .45, 0, 1); F.chair(B, r.x1 + 4.0, r.z1 + 1.05, Math.PI, 1); F.chair(B, r.x1 + 5.3, r.z1 + 1.05, Math.PI, 1);
    if (i === 0) { const p = new THREE.Group(); p.position.set(B.wx(r.x2 - .1), FH, B.wz(r.z1 + 1.4 + .6)); p.userData.dynamic = true; B.g.add(p); const d = new THREE.Mesh(new THREE.BoxGeometry(.012, 1.74, .38), lib().GREENSTEEL[0]); d.position.set(-.01, .9, -.19); p.add(d); piv.locker = p; piv.lockerAt = [r.x2 - .8, r.z1 + 1.6]; } });
  // 공부방: 책상 4 (카렐) + 의자 4 + 서가
  { const r = byName(R1, '공부방'); for (let k = 0; k < 4; k++) { const x = r.x1 + .9 + k * 1.4; F.desk(B, x, r.z2 - .45, Math.PI, 1); F.chair(B, x, r.z2 - 1.05, 0, 1); B.box(.03, .5, .6, 'PANEL', x + .62, FH + 1.0, r.z2 - .45); }
    F.shelf(B, r.x1 + .4, (r.z1 + r.z2) / 2, Math.PI / 2, 1, 1.8, .35, 1.8, 'WOOD', 5, ['RED', 'BLANKET', 'GREEN']); piv.studyAt = [r.x1 + 2.3, r.z2 - .9]; }
  { const r = byName(R1, '라운지'); F.table(B, (r.x1 + r.x2) / 2, (r.z1 + r.z2) / 2 + .6, 1.2, .7, .45, 1, 'WOOD'); B.box(2.0, .42, .7, 'FABRIC', (r.x1 + r.x2) / 2, FH + .21, r.z2 - .45); B.col((r.x1 + r.x2) / 2 - 1, (r.x1 + r.x2) / 2 + 1, r.z2 - .8, r.z2 - .1, { lvl: 1, h: .45 }); }
  { const r = byName(R1, '화장실 (2층)'); F.toilets(B, r, 3); piv.wcAt = r.sinkAt; }
  { const r = byName(R1, '샤워실 (2층)'); F.showers(B, r, 4); }
  B.addSwitch(1.6, B.Z.D / 2 - WALL_T - LIN - .01, Math.PI, 0, '1층 형광등 스위치'); B.addSwitch(byName(R1, '계단홀').x2 - .3, byName(R1, '계단홀').z1 + LIN + .01, 0, 1, '2층 형광등 스위치');
  B.finish();
  const sl = byName(R0, '사감실');
  return { B, anchors: { dorm_log: [(sl.x1 + sl.x2) / 2, sl.z1 + 1.15, .95, 0], dorm_locker: [...piv.lockerAt, 1.1, 1, { anim: { type: 'hinge', doorPiv: piv.locker, openAngle: 1.45, t: 0, active: false } }], dorm_study: [...piv.studyAt, 1.0, 1], campus_wc: [...piv.wcAt, .85, 1] } };
}

function buildUnion(ctx, Z) {   // 학생회관 22 × 14m · 2층 (학생자치 · 동아리)
  const B = new Fac(ctx, Z, { id: 'union', name: '학생회관', levels: 2 });
  const { R0, R1 } = buildTwoStory(B, { shell: { sign: '학 생 회 관', signSub: 'STUDENT UNION · 동아리연합회관' },
    L0: { corr: [-1.2, 1.2], N: [{ name: '중앙 로비 · 계단', w: 6.6, stair: true, open: true }, { name: '학생회실', w: 7.7 }, { name: '동아리실 1', w: 7.7 }],
      S: [{ name: '매점', w: 4.5, door: .5 }, { name: '공용 창고', w: 5.0, fin: 'ind', door: .5 }, { name: '현관', w: 3.0, lobby: true }, { name: '학생식당', w: 9.5, door: .1 }] },
    L1: { corr: [-1.2, 1.2], N: [{ name: '계단홀', w: 6.6, stairTop: true, open: true }, { name: '동아리실 2', w: 7.7 }, { name: '동아리실 3', w: 7.7 }],
      S: [{ name: '회의실', w: 7.0 }, { name: '다목적실', w: 8.5, F: 'F03' }, { name: '휴게공간', w: 6.5, open: true }] } });
  const F = FURN, piv = {};
  // 학생식당: 테이블 6 (1800×750) × 의자 36
  { const r = byName(R0, '학생식당'); for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) { const x = r.x1 + 2.7 + i * 3.9, z = r.z1 + 1.15 + j * 1.75;
      F.table(B, x, z, 1.8, .75, .74, 0, 'LPM'); for (let k = -1; k <= 1; k++) { F.chair(B, x + k * .58, z - .62, 0, 0, 'WOOD', .42, .45, .82); F.chair(B, x + k * .58, z + .62, Math.PI, 0, 'WOOD', .42, .45, .82); } } }
  // 매점: 진열대 4 (900×450×1800) + 계산대
  { const r = byName(R0, '매점'); for (let k = 0; k < 4; k++) F.shelf(B, r.x1 + .6 + k * 1.0, r.z2 - .35, Math.PI, 0, .9, .45, 1.8, 'STEEL', 5, ['RED', 'HDPE_Y', 'HDPE_B', 'GREEN']); F.table(B, r.x1 + .9, r.z1 + 1.6, 1.4, .6, .95, 0, 'WOOD', 'WOOD', Math.PI / 2); }
  { const r = byName(R0, '공용 창고'); F.shelf(B, r.x1 + 1.2, r.z2 - .35, Math.PI, 0, 1.8, .45, 1.8, 'GREYSTEEL', 5, ['PANEL', 'CORK']); F.shelf(B, r.x2 - 1.2, r.z2 - .35, Math.PI, 0, 1.8, .45, 1.8, 'GREYSTEEL', 5, ['WHITE', 'CORK']); }
  // 학생회실: 수납장 2 (union_locker) + 회의 책상
  { const r = byName(R0, '학생회실'); F.cabinet(B, r.x1 + .9, r.z1 + .3, 0, 0, .9, .45, 1.8, 'GREYSTEEL'); F.cabinet(B, r.x1 + 1.85, r.z1 + .3, 0, 0, .9, .45, 1.8, 'WOOD');
    F.desk(B, (r.x1 + r.x2) / 2 + 1, (r.z1 + r.z2) / 2, 0, 0, 1.2, .7, .74); F.desk(B, (r.x1 + r.x2) / 2 + 2.25, (r.z1 + r.z2) / 2, 0, 0, 1.2, .7, .74); F.chair(B, (r.x1 + r.x2) / 2 + 1, (r.z1 + r.z2) / 2 + .7, Math.PI, 0); F.chair(B, (r.x1 + r.x2) / 2 + 2.25, (r.z1 + r.z2) / 2 + .7, Math.PI, 0);
    const p = new THREE.Group(); p.position.set(B.wx(r.x1 + .9 - .45), 0, B.wz(r.z1 + .3 + .23)); p.userData.dynamic = true; B.g.add(p); const d = new THREE.Mesh(new THREE.BoxGeometry(.44, 1.74, .012), lib().GREYSTEEL[0]); d.position.set(.22, .9, .01); p.add(d); piv.locker = p; piv.lockerAt = [r.x1 + .9, r.z1 + 1.0];
    B.box(2.4, 1.2, .03, 'WHITE', (r.x1 + r.x2) / 2 + 1.6, 1.5, r.z1 + .08); }
  // 동아리실 1·2·3: 동아리 책상 8 (1200×700) + 수납장
  [[R0, '동아리실 1', 3], [R1, '동아리실 2', 3], [R1, '동아리실 3', 2]].forEach(([R, n, cnt]) => { const r = byName(R, n), l = r.lvl;
    for (let k = 0; k < cnt; k++) { const x = r.x1 + 1.4 + k * 1.6; F.desk(B, x, (r.z1 + r.z2) / 2 - .4, 0, l, 1.2, .7, .74); F.chair(B, x, (r.z1 + r.z2) / 2 + .3, Math.PI, l); }
    F.cabinet(B, r.x2 - .35, r.z1 + 1.0, -Math.PI / 2, l, .9, .45, 1.8, 'GREYSTEEL'); B.box(2.0, 1.0, .03, 'BOARD', (r.x1 + r.x2) / 2, l * FH + 1.5, r.z1 + .08); });
  // 회의실: 회의 테이블 2 (2400×1200) + 의자
  { const r = byName(R1, '회의실'), cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2; F.table(B, cx - 1.25, cz, 2.4, 1.2, .74, 1, 'LPM'); F.table(B, cx + 1.25, cz, 2.4, 1.2, .74, 1, 'LPM');
    for (let k = -2; k <= 2; k++) { if (!k) continue; F.chair(B, cx + k * 1.0, cz - .9, 0, 1); F.chair(B, cx + k * 1.0, cz + .9, Math.PI, 1); } F.cabinet(B, r.x1 + .5, r.z2 - .3, Math.PI, 1, .9, .45, 1.8, 'WOOD'); }
  // 다목적실 (소극장): 낮은 무대 + 음향 콘솔 (union_console) + 접이식 의자
  { const r = byName(R1, '다목적실'), cx = (r.x1 + r.x2) / 2; B.box(r.x2 - r.x1 - .2, .4, 2.0, 'DARKWOOD', cx, FH + .2, r.z2 - 1.1); B.col(r.x1 + .1, r.x2 - .1, r.z2 - 2.1, r.z2 - .1, { lvl: 1, h: .4 });
    B.box(r.x2 - r.x1 - .4, 2.4, .05, 'VELVET', cx, FH + 1.6, r.z2 - .15);
    F.table(B, r.x1 + 1.2, r.z1 + .6, 1.2, .6, .76, 1, 'BLACK', 'FRAME'); B.box(.9, .08, .45, 'BLACK', r.x1 + 1.2, FH + .82, r.z1 + .6, { rx: -.2 }); piv.consoleAt = [r.x1 + 1.2, r.z1 + 1.2];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) F.chair(B, r.x1 + 2.6 + j * .9, r.z1 + 1.1 + i * .95, Math.PI, 1, 'RED'); }
  { const r = byName(R1, '휴게공간'); B.box(2.0, .42, .7, 'FABRIC', (r.x1 + r.x2) / 2, FH + .21, r.z2 - .45); B.col((r.x1 + r.x2) / 2 - 1, (r.x1 + r.x2) / 2 + 1, r.z2 - .8, r.z2 - .1, { lvl: 1, h: .45 }); F.table(B, (r.x1 + r.x2) / 2, (r.z1 + r.z2) / 2, .9, .6, .45, 1, 'WOOD'); }
  { const r = byName(R0, '중앙 로비 · 계단'); B.box(1.6, 1.0, .02, 'CORK', r.x1 + 4.5, 1.6, r.z1 + .08); F.table(B, r.x1 + 1.4, r.z2 - .6, 1.6, .6, .9, 0, 'WOOD', 'WOOD'); }
  B.addSwitch(1.6, B.Z.D / 2 - WALL_T - LIN - .01, Math.PI, 0, '1층 형광등 스위치'); B.addSwitch(byName(R1, '계단홀').x2 - .3, byName(R1, '계단홀').z1 + LIN + .01, 0, 1, '2층 형광등 스위치');
  B.finish();
  return { B, anchors: { union_locker: [...piv.lockerAt, 1.1, 0, { anim: { type: 'hinge', doorPiv: piv.locker, openAngle: -1.5, t: 0, active: false } }], union_console: [...piv.consoleAt, 1.0, 1] } };
}

function buildHistory(ctx, Z) {   // 역사관 15.6 × 10.6m · 2층 (학교 · 지역 기록 전시)
  const B = new Fac(ctx, Z, { id: 'hist', name: '역사관', levels: 2 });
  const { R0, R1 } = buildTwoStory(B, { shell: { sign: '서문고 역사관', signSub: '개교기념관 · SEOMUN HISTORY HALL', winStep: 2.8 },
    L0: { corr: [-1.0, 1.0], corrFin: 'exh', N: [{ name: '중앙 로비 · 계단', w: 5.6, stair: true, open: true, fin: 'exh' }, { name: '학교역사 전시', w: 5.0, fin: 'exh', open: true }, { name: '지역역사 전시', w: 5.0, fin: 'exh', open: true }],
      S: [{ name: '사무실', w: 6.3, door: .8 }, { name: '현관', w: 3.0, lobby: true, fin: 'exh' }, { name: '자료 보관실', w: 6.3, fin: 'ind', door: .2 }] },
    L1: { corr: [-1.0, 1.0], corrFin: 'exh', N: [{ name: '계단홀', w: 5.6, stairTop: true, open: true, fin: 'exh' }, { name: '기획전시실', w: 5.0, fin: 'exh', open: true }, { name: '아카이브 열람실', w: 5.0, fin: 'read' }],
      S: [{ name: '보존실', w: 7.8, fin: 'ind', door: .3 }, { name: '관리실', w: 7.8, door: .7 }] } });
  const F = FURN, an = {};
  const exhibit = (y, x, z, k) => { const cols = ['RED', 'CORK', 'WHITE', 'BLANKET', 'PANEL']; for (let i = 0; i < 4; i++) B.box(.22, .02 + (i % 2) * .16, .16, cols[(k + i) % 5], x - .6 + i * .4, y + .02 + (i % 2) * .08, z); };
  // 1층 로비: 안내 데스크 (1800×700×1000)
  { const r = byName(R0, '중앙 로비 · 계단'); B.box(1.8, 1.0, .7, 'WOOD', r.x2 - 1.3, .5, r.z2 - .55); B.box(1.84, .04, .74, 'DARKWOOD', r.x2 - 1.3, 1.02, r.z2 - .55); B.col(r.x2 - 2.2, r.x2 - .4, r.z2 - .9, r.z2 - .2, { lvl: 0, h: 1.0 }); }
  // 학교역사 전시: 대형 진열장 4 (1800×750×950) + 벽면 패널 3 + 타임캡슐 진열 (east_museum)
  { const r = byName(R0, '학교역사 전시'), cx = (r.x1 + r.x2) / 2; [[-1.15, -.9], [1.15, -.9], [-1.15, .9], [1.15, .9]].forEach(([dx, dz], k) => F.vitrine(B, cx + dx, (r.z1 + r.z2) / 2 + dz, 0, 0, 1.4, .75, .95, 'DARKWOOD', y => exhibit(y, cx + dx, (r.z1 + r.z2) / 2 + dz, k)));
    [-1.5, 0, 1.5].forEach((dx, k) => F.panel(B, cx + dx, r.z1 + .1, 0, 0, 'PANEL', ['1998 · 개교 30주년', '역대 교장 · 졸업 앨범', '방송부 30년사'][k]));
    B.box(.5, .5, .5, 'GREYSTEEL', cx + 1.1, .95 + .28, (r.z1 + r.z2) / 2 - 1.0); an.museum = [cx + 1.1, (r.z1 + r.z2) / 2 - .3]; }
  // 지역역사 전시: 진열장 2 + 벽면 패널 3
  { const r = byName(R0, '지역역사 전시'), cx = (r.x1 + r.x2) / 2; [-1.15, 1.15].forEach((dx, k) => F.vitrine(B, cx + dx, (r.z1 + r.z2) / 2, 0, 0, 1.4, .75, .95, 'DARKWOOD', y => exhibit(y, cx + dx, (r.z1 + r.z2) / 2, k + 2)));
    [-1.5, 0, 1.5].forEach((dx, k) => F.panel(B, cx + dx, r.z1 + .1, 0, 0, 'PANEL', ['서문동 옛 지도', '1970년대 학교 앞 거리', '지역 신문 스크랩'][k])); }
  // 사무실: 책상 2 + 서가 2
  { const r = byName(R0, '사무실'); F.desk(B, r.x1 + 1.3, r.z1 + 1.4, 0, 0, 1.2, .6, .72); F.desk(B, r.x1 + 2.7, r.z1 + 1.4, 0, 0, 1.2, .6, .72); F.chair(B, r.x1 + 1.3, r.z1 + 2.0, Math.PI, 0); F.chair(B, r.x1 + 2.7, r.z1 + 2.0, Math.PI, 0);
    F.shelf(B, r.x2 - .35, r.z1 + 1.3, -Math.PI / 2, 0, .9, .45, 1.8, 'GREYSTEEL', 5, ['WHITE', 'PANEL']); F.shelf(B, r.x2 - .35, r.z1 + 2.3, -Math.PI / 2, 0, .9, .45, 1.8, 'GREYSTEEL', 5, ['CORK', 'WHITE']); }
  // 자료 보관실: 자료 서가 5
  { const r = byName(R0, '자료 보관실'); for (let k = 0; k < 5; k++) F.shelf(B, r.x1 + .7 + k * 1.05, r.z2 - .35, Math.PI, 0, .9, .45, 1.8, 'GREYSTEEL', 5, ['PANEL', 'CORK', 'WHITE']); }
  // 2층 기획전시실: 진열장 2 + 패널 3 + 레일 조명
  { const r = byName(R1, '기획전시실'), cx = (r.x1 + r.x2) / 2; [-1.1, 1.1].forEach((dx, k) => F.vitrine(B, cx + dx, (r.z1 + r.z2) / 2, 0, 1, 1.8, .75, .95, 'DARKWOOD', y => exhibit(y, cx + dx, (r.z1 + r.z2) / 2, k)));
    [-1.5, 0, 1.5].forEach((dx, k) => F.panel(B, cx + dx, r.z1 + .1, 0, 1, 'PANEL', ['기획전 · 잊힌 이름들', '1998.10.12', '방송실 마지막 큐시트'][k])); F.railLamps(B, r.x1 + .3, r.x2 - .3, r.z1 + 1.2, FH + CEIL - .06); }
  // 아카이브 열람실: 열람 테이블 3 (1800×900) + 자료 서가 4
  { const r = byName(R1, '아카이브 열람실'); [0, 1].forEach(k => { F.table(B, r.x1 + 1.4 + k * 2.2, (r.z1 + r.z2) / 2 + .3, 1.8, .9, .74, 1, 'WOOD'); F.chair(B, r.x1 + 1.4 + k * 2.2, (r.z1 + r.z2) / 2 + 1.0, Math.PI, 1); });
    for (let k = 0; k < 4; k++) F.shelf(B, r.x1 + .6 + k * 1.0, r.z1 + .3, 0, 1, .9, .45, 1.8, 'GREYSTEEL', 5, ['WHITE', 'CORK', 'PANEL']); }
  // 보존실: 철제 보존함 4 + 열람 테이블 1
  { const r = byName(R1, '보존실'); for (let k = 0; k < 4; k++) F.cabinet(B, r.x1 + .7 + k * 1.0, r.z2 - .3, Math.PI, 1, .9, .45, 1.8, 'STEEL', 2); F.table(B, r.x2 - 1.6, r.z1 + 1.4, 1.8, .9, .74, 1, 'WOOD'); }
  // 관리실: 책상 + 캐비닛
  { const r = byName(R1, '관리실'); F.desk(B, r.x1 + 1.6, r.z1 + 1.2, 0, 1, 1.4, .7, .74); F.chair(B, r.x1 + 1.6, r.z1 + 1.85, Math.PI, 1); F.cabinet(B, r.x2 - .4, r.z1 + 1.2, -Math.PI / 2, 1, .9, .45, 1.8, 'GREYSTEEL'); }
  // 벽면 패널 (나머지 3): 복도 · 계단홀
  F.panel(B, 2.5, -1.0 + .1, 0, 1, 'PANEL', '연혁 1968 ~ 2008'); F.panel(B, 4.0, -1.0 + .1, 0, 1, 'PANEL', '교가 · 교훈'); F.panel(B, -2.0, 1.0 - .1, Math.PI, 0, 'PANEL', '관람 안내');
  B.addSwitch(1.6, B.Z.D / 2 - WALL_T - LIN - .01, Math.PI, 0, '1층 형광등 스위치'); B.addSwitch(byName(R1, '계단홀').x2 - .3, byName(R1, '계단홀').z1 + LIN + .01, 0, 1, '2층 형광등 스위치');
  B.finish();
  return { B, anchors: { east_museum: [...an.museum, 1.1, 0] } };
}

function buildAstro(ctx, Z) {   // 과학천문관 20 × 16m · 2층 (천문 교육 · 관측) + 관측돔
  const B = new Fac(ctx, Z, { id: 'astro', name: '과학천문관', levels: 2 });
  const { R0, R1 } = buildTwoStory(B, { shell: { sign: '서문 과학천문관', signSub: 'SEOMUN SCIENCE & ASTRONOMY HALL', ext: 'CONC', noRoofKit: true },
    L0: { corr: [-1.2, 1.2], N: [{ name: '로비 · 계단', w: 6.6, stair: true, open: true }, { name: '천문교육실', w: 7.4 }, { name: '전시실', w: 6.0, fin: 'exh' }],
      S: [{ name: '장비보관', w: 8.5, fin: 'ind', door: .8 }, { name: '현관', w: 3.0, lobby: true }, { name: '관측 제어실', w: 8.5, door: .15 }] },
    L1: { corr: [-1.2, 1.2], corrFin: 'exh', N: [{ name: '계단홀', w: 6.6, stairTop: true, open: true }, { name: '관측돔 · 망원경', w: 13.4, noCeil: true, noLamps: true }],
      S: [{ name: '관측 준비실', w: 6.0, door: .8 }, { name: '전시 복도', w: 8.0, fin: 'exh', open: true }, { name: '장비 점검실', w: 6.0, fin: 'ind', door: .2 }] } });
  const F = FURN, an = {}, H = B.H;
  // 천문교육실: 교육용 책상 12 (1200×600) + 의자 12 + 칠판
  { const r = byName(R0, '천문교육실'); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const x = r.x1 + .95 + i * 1.85, z = r.z1 + 1.9 + j * 1.35; F.desk(B, x, z, Math.PI, 0, 1.2, .6, .74); F.chair(B, x, z + .55, Math.PI, 0); }
    B.box(3.6, 1.2, .04, 'BOARD', (r.x1 + r.x2) / 2, 1.5, r.z1 + .08); B.box(3.7, .05, .1, 'ALU', (r.x1 + r.x2) / 2, .88, r.z1 + .1); }
  // 전시실: 전시 진열장 4 (1200×600×2100) + 패널 4 + 태양계 모형 (astro_orrery)
  { const r = byName(R0, '전시실'), cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2;
    for (let k = 0; k < 4; k++) F.vitrine(B, r.x1 + .9 + k * 1.4, r.z1 + .45, 0, 0, 1.2, .6, 2.1, 'DARKWOOD', y => { for (let i = 0; i < 3; i++) B.sph(.07 + i * .02, ['SOOT', 'REFRACT', 'GREYSTEEL'][i], r.x1 + .6 + k * 1.4 + i * .3, y + .4 + i * .5, r.z1 + .45, { ws: 10, hs: 8 }); });
    [-2.0, -.7, .7, 2.0].forEach((dx, k) => F.panel(B, cx + dx, r.z2 - .1, Math.PI, 0, 'PANEL', ['태양계', '은하수와 성운', '혜성 · 운석', '별자리 지도'][k]));
    B.cyl(.4, .5, .9, 'DARKWOOD', cx, .45, cz + .4, { seg: 18 }); B.col(cx - .5, cx + .5, cz - .1, cz + .9, { lvl: 0, h: .9 });
    const op = new THREE.Group(); op.position.set(B.wx(cx), 1.0, B.wz(cz + .4)); op.userData.dynamic = true; B.g.add(op);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(.09, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffc040, emissive: 0xff9020, emissiveIntensity: .9 })); sun.position.y = .12; op.add(sun);
    [.18, .26, .34, .42].forEach((rad, i) => { const pl = new THREE.Mesh(new THREE.SphereGeometry(.025 + i * .006, 10, 8), PM([0x9a8a7a, 0xd8b070, 0x3a70c0, 0xc05030][i], .6)); pl.position.set(Math.cos(i * 1.7) * rad, .12, Math.sin(i * 1.7) * rad); op.add(pl);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, .003, 4, 48), PM(0xb8a060, .4, .8)); ring.rotation.x = Math.PI / 2; ring.position.y = .12; op.add(ring); });
    an.orrery = { piv: op, at: [cx, cz + 1.3] }; an.caseAt = [r.x1 + 2.3, r.z1 + 1.1]; }
  // 관측 제어실: 관측 콘솔 2 (1800×800) + 모니터 + 서버랙 (astro_console)
  { const r = byName(R0, '관측 제어실'); [0, 1].forEach(k => { const x = r.x1 + 2.6 + k * 3.2, z = r.z2 - .55; F.table(B, x, z, 1.8, .8, .75, 0, 'LPM', 'FRAME', Math.PI);
      [-.5, 0, .5].forEach(dx => { B.box(.48, .32, .04, 'BLACK', x + dx, .75 + .22, z + .15); B.box(.44, .28, .01, 'TEAL', x + dx, .75 + .22, z + .128); }); F.chair(B, x, z - .7, 0, 0); });
    B.box(.6, 2.0, .8, 'BLACK', r.x2 - .5, 1.0, r.z2 - .6); B.col(r.x2 - .8, r.x2 - .2, r.z2 - 1.0, r.z2 - .2, { lvl: 0 }); an.consoleAt = [r.x1 + 2.6, r.z2 - 1.35]; }
  // 장비보관: 수납장 3 (900×450×1800)
  { const r = byName(R0, '장비보관'); for (let k = 0; k < 3; k++) F.cabinet(B, r.x1 + .8 + k * 1.0, r.z2 - .3, Math.PI, 0, .9, .45, 1.8, 'GREYSTEEL'); B.box(1.0, .6, .6, 'GREYSTEEL', r.x1 + 1.0, .3, r.z1 + 1.0); B.col(r.x1 + .5, r.x1 + 1.5, r.z1 + .7, r.z1 + 1.3, { lvl: 0, h: .6 }); }
  // 2층 전시 복도: 진열장 4 + 패널 4
  { const r = byName(R1, '전시 복도'); for (let k = 0; k < 4; k++) F.vitrine(B, r.x1 + 1.0 + k * 2.0, r.z2 - .4, 0, 1, 1.2, .6, 2.1, 'DARKWOOD');
    [0, 1, 2, 3].forEach(k => F.panel(B, r.x1 + 1.0 + k * 2.0, r.z1 + .1 + .6, 0, 1, 'PANEL', ['1998 관측 일지', '천문부 연혁', '페가수스자리', '망원경의 구조'][k])); }
  // 관측 준비실 · 장비 점검실: 수납장 2 + 작업대
  { const r = byName(R1, '장비 점검실'); [0, 1].forEach(k => F.cabinet(B, r.x1 + .8 + k * 1.0, r.z2 - .3, Math.PI, 1, .9, .45, 1.8, 'GREYSTEEL')); F.table(B, r.x2 - 1.4, r.z1 + 1.2, 1.6, .7, .85, 1, 'SS', 'FRAME'); }
  { const r = byName(R1, '관측 준비실'); F.table(B, (r.x1 + r.x2) / 2, (r.z1 + r.z2) / 2, 1.6, .8, .74, 1, 'LPM'); F.chair(B, (r.x1 + r.x2) / 2, (r.z1 + r.z2) / 2 + .7, Math.PI, 1); B.box(1.4, .9, .02, 'BOARD', (r.x1 + r.x2) / 2, FH + 1.6, r.z1 + .08); }
  // 관측돔 (2층 북측 · 반지름 4.6m 은빛 돔 + 슬릿) + 천체망원경 (2500×800×2000, astro_scope)
  { const r = byName(R1, '관측돔 · 망원경'), cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2, rad = 3.0;
    // 돔 아래 둥근 드럼 (지붕 위) + 돔
    B.cyl(rad + .15, rad + .15, .6, 'CONC', cx, H + .3, cz, { seg: 40 });
    const dome = B.sph(rad, 'DOME', cx, H + .6, cz, { ws: 40, hs: 16, thL: Math.PI / 2 });
    B.box(.9, .05, rad * 1.6, 'BLACK', cx, H + .6 + rad * .62, cz - rad * .2, { rx: -.6 });
    // 돔 안쪽 (2층 실에서 올려다보는 면): 뒤집힌 반구 + 천장 링
    const inner = new THREE.SphereGeometry(rad - .05, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2); inner.scale(1, 1, 1); const im = B.mesh(inner, new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: .7, side: THREE.BackSide }), cx, H + .6, cz);
    B.plane(r.x2 - r.x1, r.z2 - r.z1, 'C02', cx, FH + 3.2, cz, { up: false }); // 돔 둘레 평천장 (구멍은 돔이 보이게 아래 링으로 처리)
    B.cyl(rad + .05, rad + .05, .4, 'C02', cx, FH + 3.0, cz, { seg: 40, open: true });
    // 망원경 받침 · 경통
    B.cyl(.35, .45, .9, 'GREYSTEEL', cx, FH + .45, cz, { seg: 16 }); B.box(.5, .3, .5, 'BLACK', cx, FH + 1.05, cz); B.cyl(.17, .17, 2.4, 'WHITE', cx, FH + 1.6, cz - .4, { rx: -.95, seg: 18 }); B.cyl(.2, .2, .2, 'BLACK', cx, FH + 2.55, cz - 1.12, { rx: -.95, seg: 18 }); B.cyl(.05, .05, .4, 'BLACK', cx + .25, FH + 1.3, cz + .1, { rx: -.95 });
    B.col(cx - .5, cx + .5, cz - .5, cz + .5, { lvl: 1 }); an.scopeAt = [cx, cz + 1.0];
    lampsGrid(B, { x1: r.x1, x2: r.x2, z1: r.z1, z2: r.z2, lvl: 1, ceil: 3.2 }, 3.2); }
  B.addSwitch(1.6, B.Z.D / 2 - WALL_T - LIN - .01, Math.PI, 0, '1층 형광등 스위치'); B.addSwitch(byName(R1, '계단홀').x2 - .3, byName(R1, '계단홀').z1 + LIN + .01, 0, 1, '2층 형광등 스위치');
  B.finish();
  return { B, anchors: { astro_console: [...an.consoleAt, 1.1, 0], astro_orrery: [...an.orrery.at, 1.1, 0, { anim: { type: 'orrery', orreryPiv: an.orrery.piv, t: 0, active: false } }], astro_case: [...an.caseAt, 1.1, 0], astro_scope: [...an.scopeAt, 1.3, 1] } };
}

function buildRecycle(ctx, Z) {   // 분리수거 · 소각장 16 × 11m · 1층 (산업공간 F-05 / W-04 / C-04)
  const B = new Fac(ctx, Z, { id: 'recy', name: '분리수거 · 소각장', levels: 1, H: 4.6 });
  const H = B.H, ch = 4.2;
  shell(B, { sign: '분리수거장 · 소각장', signSub: '폐기물 관리 · 관계자 외 출입 주의', ext: 'CONC', winStep: 3.0, door: 2.4 });
  const hz = B.Z.D / 2 - WALL_T, hx = B.Z.W / 2 - WALL_T, zr = -.4;   // 북측 실(깊이 6.5) | 남측 작업 · 통로 (깊이 4.5)
  const mk = (name, x1, x2, z1, z2, gaps, extra = {}) => ({ name, x1, x2, z1, z2, lvl: 0, F: 'F05', W: 'W04', C: 'C04', ceil: ch, gaps: { N: [], S: [], W: [], E: [], ...gaps }, ...extra });
  const xA = -hx + 5.8, xB = xA + 5.8;
  const R = [
    mk('분리수거 · 선별', -hx, xA - .06, -hz, zr - .06, { S: [[-hx + 1.4, -hx + 4.2, 3.0]], E: [] }),
    mk('소각시설 연출구역', xA + .06, xB - .06, -hz, zr - .06, { S: [[xA + 1.6, xA + 4.2, 3.0]] }),
    mk('관리실', xB + .06, hx, -hz, zr - .06, { S: [[xB + .9, xB + 1.9, 2.1]] }, { F: 'F01', W: 'W01', C: 'C01', ceil: 2.7 }),
    mk('작업 · 보관 / 안전 완충 통로', -hx, hx, zr + .06, hz, { N: [[-hx + 1.4, -hx + 4.2, 3.0], [xA + 1.6, xA + 4.2, 3.0], [xB + .9, xB + 1.9, 2.1]], S: [[-1.2, 1.2, 2.4]] }),
  ];
  R.forEach(r => room(B, r));
  B.col(xA - .08, xA + .08, -hz, zr, {}); B.col(xB - .08, xB + .08, -hz, zr, {});
  [[-hx, -hx + 1.4], [-hx + 4.2, xA + 1.6], [xA + 4.2, xB + .9], [xB + 1.9, hx]].forEach(([a, b]) => B.col(a, b, zr - .08, zr + .08, {}));
  doorway(B, 'z', zr + .06, xB + .9, xB + 1.9, 0, .9, 'GREYSTEEL');
  // 셔터 개구부 머리 (롤 셔터 박스)
  [[-hx + 1.4, -hx + 4.2], [xA + 1.6, xA + 4.2]].forEach(([a, b]) => { B.box(b - a + .2, .35, .3, 'GREYSTEEL', (a + b) / 2, 3.2, zr + .2); for (let y = 3.05; y > 2.85; y -= .08) B.box(b - a, .05, .03, 'GREYSTEEL', (a + b) / 2, y, zr + .1); B.box(.08, 3.0, .12, 'GREYSTEEL', a, 1.5, zr); B.box(.08, 3.0, .12, 'GREYSTEEL', b, 1.5, zr); });
  const F = FURN;
  // 분리수거 · 선별: 대형 수거함 8 (1370×770×1200, HDPE) — 색별 + 라벨
  { const r = R[0]; const cols = ['HDPE_B', 'HDPE_G', 'HDPE_Y', 'HDPE_GR'], labels = ['종이', '플라스틱', '캔 · 고철', '일반쓰레기'];
    for (let k = 0; k < 8; k++) { const i = k % 4, j = (k / 4) | 0, x = r.x1 + .85 + i * 1.45 * (5.4 / 5.8), z = r.z1 + .55 + j * 1.1;
      if (x + .7 > r.x2) continue; B.box(1.3, 1.1, .74, cols[i], x, .55, z); B.box(1.34, .06, .78, cols[i], x, 1.15, z, { rx: -.08 }); [-.5, .5].forEach(dx => B.cyl(.07, .07, .05, 'RUBBER', x + dx, .07, z + .3, { rz: Math.PI / 2, seg: 10 }));
      if (j === 0) B.sign(labels[i], '', .7, .16, x, .8, z + .375, 0, ['#f4f4ee', '#1a1a1a']); B.col(x - .66, x + .66, z - .38, z + .38, { h: 1.15 }); }
    // 철제 메쉬 카트 2
    [0, 1].forEach(k => { const x = r.x1 + 1.3 + k * 2.6, z = r.z2 - .9; B.box(1.2, .03, 1.0, 'GREYSTEEL', x, .3, z); for (let a = -1; a <= 1; a += 2) { B.box(1.2, .9, .02, 'GREYSTEEL', x, .75, z + a * .5, { tile: .1 }); B.box(.02, .9, 1.0, 'GREYSTEEL', x + a * .6, .75, z); } B.col(x - .6, x + .6, z - .5, z + .5, { h: 1.2 }); }); }
  // 소각시설: 소각로 외형 2500×3500×3000 (강판/내화재) + 투입구 + 굴뚝 (지붕 위 8m) (east_incinerator)
  const an = {};
  { const r = R[1], cx = (r.x1 + r.x2) / 2, cz = r.z1 + 2.2; B.box(2.5, 3.0, 3.5, 'GREYSTEEL', cx, 1.5, cz); B.box(2.3, .9, .04, 'REFRACT', cx, 1.0, cz + 1.77); B.box(1.0, .7, .06, 'SOOT', cx, 1.1, cz + 1.79);
    B.box(1.1, .08, .12, 'STEEL', cx, 1.5, cz + 1.82); [-.8, .8].forEach(dx => B.cyl(.08, .08, .1, 'BLACK', cx + dx, 2.4, cz + 1.8, { rx: Math.PI / 2 }));
    B.cyl(.32, .32, H + 8 - 3.0, 'GREYSTEEL', cx + .6, 3.0 + (H + 8 - 3.0) / 2, cz - .9, { seg: 18 }); B.cyl(.4, .4, .3, 'SOOT', cx + .6, H + 8, cz - .9, { seg: 18 });
    for (let y = H + 1; y < H + 8; y += 1.6) B.cyl(.36, .36, .06, 'BLACK', cx + .6, y, cz - .9, { seg: 18 });
    B.col(cx - 1.25, cx + 1.25, cz - 1.75, cz + 1.75, {}); an.incAt = [cx, cz + 2.4];
    // 작업대 1 (스테인리스) · 철제 선반 1
    F.table(B, r.x1 + .6, r.z2 - 1.2, 1.8, .75, .85, 0, 'SS', 'FRAME', Math.PI / 2); F.shelf(B, r.x2 - .3, r.z1 + 1.2, -Math.PI / 2, 0, 1.8, .45, 1.8, 'GREYSTEEL', 5, ['REFRACT', 'PANEL']); }
  // 관리실: 책상 · 의자 · 일지
  { const r = R[2]; F.desk(B, (r.x1 + r.x2) / 2, r.z1 + .5, 0, 0, 1.2, .6, .72); F.chair(B, (r.x1 + r.x2) / 2, r.z1 + 1.1, Math.PI, 0); B.box(.9, .02, .6, 'CORK', (r.x1 + r.x2) / 2, 1.6, r.z1 + .08, { rx: Math.PI / 2 }); }
  // 작업 · 보관 / 통로: 작업대 1 · 철제 선반 2 · 메쉬 카트 2 · 노란 안전 통로 선
  { const r = R[3]; F.table(B, r.x1 + 1.8, r.z2 - .55, 1.8, .75, .85, 0, 'SS', 'FRAME'); F.shelf(B, r.x2 - 1.2, r.z2 - .35, Math.PI, 0, 1.8, .45, 1.8, 'GREYSTEEL', 5, ['PANEL', 'HDPE_GR']); F.shelf(B, r.x2 - 3.2, r.z2 - .35, Math.PI, 0, 1.8, .45, 1.8, 'GREYSTEEL', 5, ['CORK', 'WHITE']);
    [0, 1].forEach(k => { const x = r.x1 + 4.4 + k * 1.4, z = r.z2 - .7; B.box(1.2, .03, 1.0, 'GREYSTEEL', x, .3, z); B.box(1.2, .9, .02, 'GREYSTEEL', x, .75, z - .5, { tile: .1 }); B.col(x - .6, x + .6, z - .5, z + .5, { h: 1.2 }); });
    [-1.6, 1.6].forEach(dx => B.box(.1, .01, r.z2 - r.z1 - .2, 'HDPE_Y', dx, .03, (r.z1 + r.z2) / 2)); }
  [R[0], R[1], R[3]].forEach(r => lampsGrid(B, { ...r, ceil: ch }, 3.0)); lampsGrid(B, { ...R[2], ceil: 2.7 }, 2.4);
  B.addSwitch(1.9, B.Z.D / 2 - WALL_T - LIN - .01, Math.PI, 0, '형광등 스위치');
  B.finish();
  return { B, anchors: { east_incinerator: [...an.incAt, 1.0, 0] } };
}

function buildAuditorium(ctx, Z) {   // 대강당 18 × 26m · 1층 (공연 · 행사) — 북측 무대 · 측면 준비실 / 객석 200석 / 남측 로비 · 음향조명 조정실 · 장비창고
  const B = new Fac(ctx, Z, { id: 'aud', name: '대강당', levels: 1, H: 8.0 });
  const H = B.H, hx = B.Z.W / 2 - WALL_T, hz = B.Z.D / 2 - WALL_T, F = FURN, an = {};
  shell(B, { sign: '대 강 당', signSub: 'GRAND AUDITORIUM · 1998 개교 30주년 기념관', winStep: 4.2, door: 2.6, noWin: () => false });
  const zStage = -hz + 6.2, zLobby = hz - 4.6, stageH = 1.0, hallCeil = 7.2;
  const mk = (name, x1, x2, z1, z2, gaps, fin) => ({ name, x1, x2, z1, z2, lvl: 0, F: fin[0], W: fin[1], C: fin[2], ceil: fin[3], gaps: { N: [], S: [], W: [], E: [], ...gaps } });
  // 실: 객석 홀 (무대 포함) / 준비실 2 (무대 좌우) / 로비 / 음향·조명 조정실 / 장비창고
  const wing = 3.0;
  const hall = mk('객석 · 무대', -hx, hx, -hz, zLobby - .06, { S: [[-1.4, 1.4, 2.6], [-hx + 1.0, -hx + 2.2, 2.1], [hx - 2.2, hx - 1.0, 2.1]] }, ['F03', 'W01', 'C02', hallCeil]);
  const lobby = mk('로비', -hx + 5.2, hx - 5.2, zLobby + .06, hz, { N: [[-1.4, 1.4, 2.6]], S: [[-1.3, 1.3, 2.6]] }, ['F01', 'W01', 'C01', 3.0]);
  const ctl = mk('음향 · 조명 조정실', -hx, -hx + 5.1, zLobby + .06, hz, { N: [[-hx + 1.0, -hx + 2.2, 2.1]] }, ['F01', 'W01', 'C01', 3.0]);
  const sto = mk('장비창고', hx - 5.1, hx, zLobby + .06, hz, { N: [[hx - 2.2, hx - 1.0, 2.1]] }, ['F05', 'W04', 'C04', 3.0]);
  [hall, lobby, ctl, sto].forEach(r => room(B, r));
  // 조정실 · 창고 ↔ 로비 칸막이, 홀 ↔ 남측 실 벽 (구멍 제외)
  B.col(-hx + 5.1, -hx + 5.26, zLobby, hz); B.col(hx - 5.26, hx - 5.1, zLobby, hz);
  [[-hx, -hx + 1.0], [-hx + 2.2, -1.4], [1.4, hx - 2.2], [hx - 1.0, hx]].forEach(([a, b]) => B.col(a, b, zLobby - .08, zLobby + .08));
  doorway(B, 'z', zLobby - .06, -hx + 1.0, -hx + 2.2, 0, .9); doorway(B, 'z', zLobby - .06, hx - 2.2, hx - 1.0, 0, .9);
  // 조정실 관람창 (홀 쪽)
  { const gl = B.mesh(new THREE.PlaneGeometry(2.6, 1.0), GLASS(), -hx + 3.0, 1.7, zLobby, {}); gl.renderOrder = 2; B.box(2.7, .06, .2, 'FRAME', -hx + 3.0, 1.2, zLobby); B.box(2.7, .06, .2, 'FRAME', -hx + 3.0, 2.2, zLobby); }
  // 무대 (높이 1.0m) + 앞면 + 계단 (좌우 5단) + 준비실 칸막이 (무대 좌우 날개)
  const sx1 = -hx + wing, sx2 = hx - wing;
  B.box(sx2 - sx1, stageH, zStage - (-hz), 'DARKWOOD', 0, stageH / 2, (-hz + zStage) / 2); B.box(sx2 - sx1, .03, zStage + hz, 'F03', 0, stageH + .015, (-hz + zStage) / 2);
  B.box(sx2 - sx1, stageH - .1, .04, 'BLACK', 0, (stageH - .1) / 2, zStage + .02);
  B.col(sx1, sx2, -hz, zStage, { h: stageH });
  [sx1 + .6, sx2 - .6].forEach(x => { for (let i = 0; i < 5; i++) { const h = (i + 1) * .2, z = zStage + 1.25 - i * .25; B.box(1.0, h, .25, 'DARKWOOD', x, h / 2, z); B.col(x - .5, x + .5, z - .125, z + .125, { h }); } });
  // 준비실 (무대 측면 · 좌우): 칸막이벽 + 문
  [[-hx, sx1, '무대 측면 준비실 (서)'], [sx2, hx, '무대 측면 준비실 (동)']].forEach(([a, b, nm], i) => { const xw = i ? a : b;
    B.box(.12, hallCeil, zStage + hz, 'W01', xw, hallCeil / 2, (-hz + zStage) / 2); B.box(b - a, hallCeil - 2.2, .12, 'W01', (a + b) / 2, 2.2 + (hallCeil - 2.2) / 2, zStage);
    B.box(b - a - 1.2, 2.2, .12, 'W01', i ? a + .6 + (b - a - 1.2) / 2 + .6 : a + (b - a - 1.2) / 2, 1.1, zStage);
    B.col(xw - .08, xw + .08, -hz, zStage); const dx = i ? [a, a + 1.2] : [b - 1.2, b]; B.col(i ? a + 1.2 : a, i ? b : b - 1.2, zStage - .08, zStage + .08); doorway(B, 'z', zStage + .06, dx[0], dx[1], 0, .9);
    B.box(b - a - .1, .02, zStage + hz - .1, 'C01', (a + b) / 2, 3.0, (-hz + zStage) / 2); B.lamp((a + b) / 2, (-hz + zStage) / 2, 0, 2.96, 1);
    F.cabinet(B, (a + b) / 2, -hz + .3, 0, 0, .9, .45, 1.8, 'GREYSTEEL'); B.box(.9, .02, .5, 'CHROME', (a + b) / 2, 1.5, -hz + .08, { rx: Math.PI / 2 });
    B.sign(nm.replace(/ \(.\)/, ''), '', .9, .14, dx[0] + .6, 2.4, zStage + .075, 0, ['#f2efe6', '#1c2226']); });
  // 무대 커튼 (방염 벨벳) · 상부 막 · 무대 조명바 3 (6000×300×500) · 태극기 · 강연대 · 그랜드피아노
  B.box(sx2 - sx1, 1.1, .1, 'VELVET', 0, hallCeil - .6, zStage - .2); [-1, 1].forEach(s => { for (let k = 0; k < 6; k++) B.box(.32, hallCeil - 1.2 - stageH, .12, 'VELVET', s * ((sx2 - sx1) / 2 - .2 - k * .26), stageH + (hallCeil - 1.2 - stageH) / 2, zStage - .25 - (k % 2) * .06); });
  B.box(sx2 - sx1 - .4, hallCeil - 1.6 - stageH, .06, 'VELVET', 0, stageH + (hallCeil - 1.6 - stageH) / 2, -hz + .5);   // 무대 뒤 배경막
  [-hz + 1.6, -hz + 3.4, zStage - 1.2].forEach(z => { B.box(6.0, .3, .3, 'BLACK', 0, hallCeil - .9, z); for (let k = -2; k <= 2; k++) { B.cyl(.12, .14, .3, 'BLACK', k * 1.2, hallCeil - 1.2, z, { seg: 12 }); } B.cyl(.012, .012, .9, 'STEEL', -2.9, hallCeil - .45, z); B.cyl(.012, .012, .9, 'STEEL', 2.9, hallCeil - .45, z); });
  { const fm = new THREE.MeshStandardMaterial({ map: taegukgiTexture(), roughness: .8 }); B.mesh(new THREE.PlaneGeometry(2.7, 1.8), fm, 0, 4.4, -hz + .54); B.box(2.8, 1.9, .03, 'DARKWOOD', 0, 4.4, -hz + .52); }
  { const lx = 0, lz = zStage - 1.4; B.box(.7, 1.15, .6, 'WOOD', lx, stageH + .575, lz); B.box(.74, .04, .5, 'DARKWOOD', lx, stageH + 1.17, lz + .04, { rx: -.25 }); B.cyl(.01, .01, .35, 'BLACK', lx + .15, stageH + 1.35, lz + .15, { rx: -.5 }); B.col(lx - .35, lx + .35, lz - .3, lz + .3, { h: stageH + 1.2 }); an.lectern = [lx, lz + .9]; }
  { const px = sx1 + 2.4, pz = -hz + 2.6, y = stageH; B.box(1.5, .32, 2.0, 'LACQUER', px, y + .62, pz); B.box(1.46, .03, 1.9, 'LACQUER', px - .2, y + 1.15, pz, { rz: .55 }); B.box(1.3, .06, .25, 'WHITE', px, y + .8, pz + 1.0); B.box(1.3, .02, .1, 'BLACK', px, y + .835, pz + 1.0);
    [[-.6, -.8], [.6, -.8], [0, .8]].forEach(([a, b]) => B.cyl(.05, .04, .62, 'LACQUER', px + a, y + .31, pz + b)); B.box(.6, .5, .35, 'LACQUER', px, y + .25, pz + 1.45); B.col(px - .75, px + .75, pz - 1.0, pz + 1.1, { h: y + .95 }); }
  // 스피커 2 (무대 앞 좌우)
  [-1, 1].forEach(s => { const x = s * (hx - 1.0), z = zStage + .6; B.box(.6, 1.0, .5, 'BLACK', x, .5, z); B.cyl(.18, .18, .02, 'RUBBER', x, .65, z + .26, { rx: Math.PI / 2 }); B.col(x - .3, x + .3, z - .25, z + .25, {}); });
  // 객석 200석 (550×650×900 패브릭/스틸): 좌우 블록 8석 × 12열 + 맨 앞 중앙 8석 · 가운데 통로 1.4m
  { const seatZ0 = zStage + 2.4, rowGap = .95, nRow = 12, sw = .55, gS = [], gF = [];
    const seat = (x, z) => { gS.push(boxUV(.5, .08, .48, 1).translate(B.wx(x), .46, B.wz(z)), boxUV(.5, .5, .07, 1).translate(B.wx(x), .78, B.wz(z + .26)).rotateX(0)); gF.push(new THREE.BoxGeometry(.04, .46, .5).translate(B.wx(x + .27), .23, B.wz(z + .02)), new THREE.BoxGeometry(.05, .06, .42).translate(B.wx(x + .27), .62, B.wz(z))); };
    for (let rI = 0; rI < nRow; rI++) { const z = seatZ0 + rI * rowGap; [[-.7 - 8 * sw, -.7], [.7, .7 + 8 * sw]].forEach(([a, b]) => { for (let k = 0; k < 8; k++) seat(a + sw * (k + .5), z); B.col(a, b, z - .25, z + .32, { h: .5 }); }); }
    for (let k = 0; k < 8; k++) seat(-2.2 + sw * (k + .5), seatZ0 - 1.1); B.col(-2.2, 2.2, seatZ0 - 1.35, seatZ0 - .78, { h: .5 });
    const ms = new THREE.Mesh(mergeGeometries(gS), lib().FABRIC[0]), mf = new THREE.Mesh(mergeGeometries(gF), lib().FRAME[0]); [ms, mf].forEach(m => { m.userData.dynamic = true; m.castShadow = true; B.g.add(m); });
    B.plane(1.3, nRow * rowGap + 1.5, 'CARPET', 0, .03, seatZ0 + nRow * rowGap / 2 - .6); an.tag = [-.7 - 3 * sw, seatZ0 + 4 * rowGap - .45]; }
  // 노출 트러스 (C-02 차콜 천장 아래) + 형광등 · 무대 PAR
  for (let z = -hz + 2; z < zLobby; z += 3.2) { B.box(2 * hx, .3, .12, 'BLACK', 0, hallCeil - .2, z); B.box(2 * hx, .06, .06, 'BLACK', 0, hallCeil - .65, z); for (let x = -hx + .8; x < hx; x += 1.6) B.box(.04, .5, .04, 'BLACK', x, hallCeil - .42, z, { rz: .6 }); }
  for (let x = -6; x <= 6; x += 3) for (let z = zStage + 2; z < zLobby - 1; z += 3.2) B.lamp(x, z, 0, hallCeil - .7);
  // 조정실: 음향 믹서대 (1200×800×750) + 랙 + 의자 / 창고: 선반 · 접이식 의자 묶음
  { const r = ctl; F.table(B, r.x1 + 3.0, r.z1 + .6, 1.2, .8, .75, 0, 'BLACK', 'FRAME', Math.PI); B.box(1.1, .08, .6, 'BLACK', r.x1 + 3.0, .82, r.z1 + .6, { rx: .18 }); for (let k = 0; k < 10; k++) B.box(.02, .04, .3, 'WHITE', r.x1 + 2.55 + k * .1, .88, r.z1 + .6);
    F.chair(B, r.x1 + 3.0, r.z1 + 1.3, 0, 0); B.box(.6, 1.8, .6, 'BLACK', r.x1 + .5, .9, r.z2 - .5); B.col(r.x1 + .2, r.x1 + .8, r.z2 - .8, r.z2 - .2, {}); an.mixer = [r.x1 + 3.0, r.z1 + 1.35];
    lampsGrid(B, { ...r, ceil: 3.0 }, 2.4); }
  { const r = sto; [0, 1].forEach(k => F.shelf(B, r.x1 + 1.2 + k * 2.0, r.z2 - .35, Math.PI, 0, 1.8, .45, 1.8, 'GREYSTEEL', 5, ['BLACK', 'PANEL'])); for (let k = 0; k < 6; k++) B.box(.45, .9, .06, 'FRAME', r.x1 + 1.0 + k * .07, .45, r.z1 + 1.2, { rz: .12 }); lampsGrid(B, { ...r, ceil: 3.0 }, 2.4); }
  { const r = lobby; lampsGrid(B, { ...r, ceil: 3.0 }, 2.4); B.box(1.6, 1.0, .02, 'CORK', 2.6, 1.6, r.z1 + .08); B.sign('객석 입구', '', 1.4, .22, 0, 2.85, r.z1 + .07, 0, ['#1c2a34', '#f4eedc']); }
  B.addSwitch(1.9, B.Z.D / 2 - WALL_T - LIN - .01, Math.PI, 0, '대강당 형광등 스위치');
  B.finish();
  // 비상구 2 (동 · 서 측벽 앞쪽) 표지
  [-1, 1].forEach(s => B.sign('비 상 구', '', .7, .2, s * (hx - .02), 2.5, zStage + 3, -s * Math.PI / 2, ['#0a3a1a', '#7dffa0']));
  return { B, anchors: { lectern: an.lectern, tag: an.tag, mixer: an.mixer, curtain: [sx1 + .6, zStage - .6] } };
}

// 급식실 · 수영장: 바깥 건물 신축 (실내는 6 · 7층 공간에서 그대로) + 실내 마감 재질 코드로 교체
function buildShellOnly(ctx, Z, id, name, sub, H, side) {
  const B = new Fac(ctx, Z, { id, name, levels: 1, H });
  shell(B, { sign: name, signSub: sub, winStep: 3.2, closedDoor: true, side, door: 2.4 });   // 실내는 별도 공간 — 기존 출입문(E)으로 들어간다
  B.finish(); return B;
}
function retexture(F, rules) {   // 실내 층(6 · 7)의 바닥/벽/천장 메시 재질을 코드 재질로 (월드 좌표 UV 로 다시 깐다)
  if (!F || !F.interior) return 0; let n = 0; const bb = new THREE.Box3(), sz = new THREE.Vector3(), v = new THREE.Vector3(); F.interior.updateMatrixWorld(true);
  F.interior.traverse(o => { if (!o.isMesh || o.isInstancedMesh || !o.geometry || !o.geometry.attributes.position || o.userData.facDone) return; const m = Array.isArray(o.material) ? null : o.material; if (!m || m.transparent || (m.emissive && m.emissiveIntensity > .3 && m.emissive.getHex())) return;
    bb.setFromObject(o); bb.getSize(sz); const y0 = F.y0 || 0; let key = null;
    if (sz.y < .25 && sz.x > 3 && sz.z > 3) key = (bb.max.y - y0) < .4 ? rules.F : (bb.min.y - y0) > 2.2 ? rules.C : null;
    else if (sz.y > 2.2 && Math.min(sz.x, sz.z) < .5 && Math.max(sz.x, sz.z) > 2.5) key = rules.W;
    if (!key) return; const L = lib()[key]; if (!L) return;
    const g = o.geometry.clone(), pos = g.attributes.position, nor = g.attributes.normal; if (!nor) return; o.updateMatrixWorld(); const mw = o.matrixWorld, nm = new THREE.Matrix3().getNormalMatrix(mw), nv = new THREE.Vector3();
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(mw); nv.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); const ax = Math.abs(nv.x), ay = Math.abs(nv.y), az = Math.abs(nv.z);
      const [u, w] = ay >= ax && ay >= az ? [v.x, v.z] : ax >= az ? [v.z, v.y] : [v.x, v.y]; uv[i * 2] = u / L[1]; uv[i * 2 + 1] = w / L[1]; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); o.geometry = g; o.material = L[0]; o.userData.facDone = true; n++; });
  return n;
}

// ───────── 설치 ─────────
export function installFacilityRebuild(ctx) {
  const { world, floors, scene } = ctx, t0 = performance.now();
  const ids = ['dorm', 'union', 'aud', 'astro', 'hist'], zones = [...ids.map(k => ZONES[k]), ...['aud', 'recy', 'astro', 'hist'].map(k => OLD_ZONES[k])];
  // 보존: 퀘스트 물건(메시 있는 것) · 사물함/숨는 곳 메시
  const protect = new Set(); const keep = o => { if (!o) return; o.traverse ? o.traverse(c => protect.add(c)) : protect.add(o); for (let a = o.parent; a; a = a.parent) protect.add(a); };
  // 조상까지 보호하면 그룹이 통째로 살아남으므로, 조상은 walk 단계에서만 통과시키고 메시는 개별 판정 → protect 에는 메시만
  const keepMesh = new Set(); (world.props || []).forEach(p => { if (p.mesh) p.mesh.traverse(c => keepMesh.add(c)); }); (world.items || []).forEach(i => { if (i.mesh) i.mesh.traverse(c => keepMesh.add(c)); });
  const res = demolish(ctx, zones, keepMesh);
  // 옛 시설 묶음(청운학사 · 학생회관 · 천문관 옛 현관 캐노피 · 간판)과 옛 분리수거장 동쪽 담장(구역 2m 밖)까지 통째로 걷는다 — 소품(keepMesh)은 남김
  { const extra = [[78.3, 94.8, 9.8, 21.2]], kill = [], b3 = new THREE.Box3(), c3 = new THREE.Vector3();
    scene.traverse(o => { if (!o.isMesh || keepMesh.has(o)) return; for (let a = o; a; a = a.parent) if (a.userData.facKeep) return; let old = false; for (let a = o.parent; a; a = a.parent) if (/^chunk_(dorm|astro|union)$/.test(a.name)) old = true;
      if (!old) { b3.setFromObject(o); if (b3.isEmpty() || b3.max.y - b3.min.y < .5) return; b3.getCenter(c3); old = extra.some(r => c3.x > r[0] && c3.x < r[1] && c3.z > r[2] && c3.z < r[3]) && !o.isInstancedMesh; }
      if (old) kill.push(o); });
    kill.forEach(o => o.parent && o.parent.remove(o));
    const F0 = floors[0]; for (const k of ['col', 'walls']) if (F0[k]) F0[k] = F0[k].filter(r => r.facKeep || !extra.some(e => (r.x1 + r.x2) / 2 > e[0] && (r.x1 + r.x2) / 2 < e[1] && (r.z1 + r.z2) / 2 > e[2] && (r.z1 + r.z2) / 2 < e[3])); }
  // 옛 시설 안 물건 정리: 스위치 · 화장실 표시는 새로 만든다, 나머지는 새 위치로
  const inZone = (p, Z) => p.floor === 0 && Math.abs(p.x - Z.cx) < Z.W / 2 + .8 && Math.abs(p.z - Z.cz) < Z.D / 2 + .8;
  world.props = world.props.filter(p => !(ids.some(k => inZone(p, ZONES[k])) && (p.k === 'light_switch' || (p.k === 'campus_wc' && !inZone(p, ZONES.dorm)))));
  const built = { dorm: buildDorm(ctx, ZONES.dorm), union: buildUnion(ctx, ZONES.union), hist: buildHistory(ctx, ZONES.hist), astro: buildAstro(ctx, ZONES.astro), aud: buildAuditorium(ctx, ZONES.aud) };
  const place = (p, B, a) => { const [x, z, y, lvl, extra] = a; B.prop(p, x, z, y, lvl || 0); if (extra) Object.assign(p, extra); if (p.mesh) { p.mesh.position.set(p.x, p.y, p.z); } };
  for (const id of ['dorm', 'union', 'hist', 'astro']) { const { B, anchors } = built[id];
    world.props.forEach(p => { if (p.floor === 0 && p.k && anchors[p.k] && inZone(p, ZONES[id])) place(p, B, anchors[p.k]); }); }
  // 대강당: 단상 콘솔 → 강연대, 명찰 → 객석, 테이프 → 조정실 믹서, 숨는 곳 → 무대 커튼 뒤
  { const { B, anchors } = built.aud, Z = ZONES.aud; const fz = world.props.filter(p => p.kind === 'fz' && inZone(p, Z));
    fz.forEach(p => { const lab = p.label || ''; const a = /콘솔|단상/.test(lab) ? [...anchors.lectern, 2.2, 0] : /명찰/.test(lab) ? [...anchors.tag, .6, 0] : /테이프/.test(lab) ? [...anchors.mixer, .95, 0] : null; if (!a) return;
      const [x, z, y] = a; const wx = B.wx(x), wz = B.wz(z); if (p.mesh) { const dx = wx - p.x, dz = wz - p.z; p.mesh.position.x += dx; p.mesh.position.z += dz; p.mesh.position.y += (y - (p.y ?? y)); } p.x = wx; p.z = wz; p.y = y; });
    (world.lockers || []).forEach(l => { if (l.floor === 0 && inZone(l, Z)) { l.x = B.wx(anchors.curtain[0]); l.z = B.wz(anchors.curtain[1]); l.y = 1.0; } }); }
  // 급식실 · 수영장: 외관 신축 + 실내 마감 재질 코드 (F-01/W-05/C-01 · F-04/W-05/C-03)
  const ext = [];
  { const kill2 = demolishExterior(ctx, [ZONES.cafe, OLD_ZONES.pool, ZONES.pool]); ext.push(kill2); }
  buildShellOnly(ctx, ZONES.cafe, 'cafe', '급 식 실', 'CAFETERIA · 배식 · 식사', 5.0);
  buildShellOnly(ctx, ZONES.pool, 'pool', '실내 수영장', 'INDOOR POOL · 학교 수영 교육', 6.4, 'E');
  const rt = retexture(floors[7], { F: 'F01', W: 'W05', C: 'C01' }) + retexture(floors[6], { F: 'F04', W: 'W05', C: 'C03' });
  window.__facilityRebuild = { removed: res.removed, ext, retextured: rt, ms: Math.round(performance.now() - t0) };
  // 나중에 불러오는 모델(GLB)이 옛 터에 다시 나타나면 걷어 낸다
  //   씬 전체 판정을 다시 돌리면 수 초씩 멈췄다 → 설치 뒤 새로 생긴 메시(기존 묶음 안에 비동기로 붙은 GLB 포함)만 골라 본다
  const seen = new WeakSet(); scene.traverse(o => seen.add(o));
  const keepNew = o => { for (let a = o; a; a = a.parent) if (a.userData && (a.userData.facNew || a.userData.facKeep)) return true; return false; };
  const again = () => { const live = new Set(); [...(world.props || []), ...(world.items || [])].forEach(p => { if (p.mesh) p.mesh.traverse(c => live.add(c)); if (p.led) live.add(p.led); });   // 게임이 나중에 놓은 조사 소품 · 아이템은 건드리지 않는다
    const fresh = []; scene.traverse(o => { if (seen.has(o)) return; seen.add(o); if ((o.isMesh || o.isSprite || o.isLight) && !o.isSkinnedMesh && !live.has(o) && !keepNew(o)) fresh.push(o); }); if (!fresh.length) return;
    const tmp = { scene: { children: fresh, updateMatrixWorld: () => fresh.forEach(c => c.updateMatrixWorld(true)) }, floors, world }; demolish(tmp, zones, keepMesh, false); };
  [4000, 12000, 30000, 70000].forEach(ms => setTimeout(again, ms));
  // 새 가구(객석 줄 · 진열장)가 옛 조사 지점 위에 놓여 다가설 자리가 없어진 경우 → 가까운 빈 바닥으로 옮긴다
  const rescue = () => { const C = floors[0].col || [], R = .3;
    const free = (x, z) => !C.some(c => !c.off && !(c.h != null && c.h <= .34) && !(c.y0 != null && c.y0 > 1.5) && x > c.x1 - R && x < c.x2 + R && z > c.z1 - R && z < c.z2 + R);
    const near = (x, z) => { for (const rr of [.5, .7, .9, 1.1, 1.3]) for (let a = 0; a < 24; a++) { const an = a / 24 * Math.PI * 2; if (free(x + Math.cos(an) * rr, z + Math.sin(an) * rr)) return true; } return false; };
    const inZ = (x, z) => zones.some(Z => Math.abs(x - Z.cx) < Z.W / 2 && Math.abs(z - Z.cz) < Z.D / 2);
    const fix = (o, get, set) => { const [x, z] = get(); if (!inZ(x, z) || near(x, z)) return;
      for (let d = .2; d < 4; d += .2) for (let a = 0; a < 16; a++) { const an = a / 16 * Math.PI * 2, nx = x + Math.cos(an) * d, nz = z + Math.sin(an) * d; if (free(nx, nz) && near(nx, nz)) { set(nx - x, nz - z); return; } } };
    (world.props || []).forEach(p => { if (p.floor !== 0 || (p.y ?? 0) > 3.2) return; fix(p, () => [p.x, p.z], (dx, dz) => { p.x += dx; p.z += dz; if (p.mesh) { p.mesh.position.x += dx; p.mesh.position.z += dz; } }); });
    (world.items || []).forEach(i => { if (i.floor !== 0 || !i.pos || i.pos.y > 3.2) return; fix(i, () => [i.pos.x, i.pos.z], (dx, dz) => { i.pos.x += dx; i.pos.z += dz; if (i.mesh) { i.mesh.position.x += dx; i.mesh.position.z += dz; } }); }); };
  [3000, 15000].forEach(ms => setTimeout(rescue, ms));
  return built;
}
// 급식실 · 수영장 옛 외관 (바깥 0층 메시) 만 걷어 낸다 — 실내 층(6 · 7)은 건드리지 않는다
function demolishExterior(ctx, zones) {
  const { scene, floors } = ctx, v = new THREE.Vector3(), bb = new THREE.Box3(), sz = new THREE.Vector3(); let n = 0;
  const inner = new Set(); [5, 6, 7].forEach(f => { const F = floors[f]; if (F) { inner.add(F.interior); if (F.shell) inner.add(F.shell); } });
  const kill = [];
  const walk = o => { if (inner.has(o) || o.isCamera || o.isSkinnedMesh || (o.userData && (o.userData.facNew || o.userData.facKeep))) return;
    if (o.isMesh && !o.isInstancedMesh) { bb.setFromObject(o); if (bb.isEmpty()) return; bb.getSize(sz); bb.getCenter(v);
      const Z = zones.find(Z => v.x > Z.cx - Z.W / 2 - .6 && v.x < Z.cx + Z.W / 2 + .6 && v.z > Z.cz - Z.D / 2 - .6 && v.z < Z.cz + Z.D / 2 + .6);
      if (Z && sz.x < Z.W + 2 && sz.z < Z.D + 2 && bb.max.y > .3 && bb.min.y > -1 && bb.max.y < 12) kill.push(o); return; }
    for (let i = o.children.length - 1; i >= 0; i--) walk(o.children[i]); };
  scene.children.forEach(walk); kill.forEach(o => { o.parent && o.parent.remove(o); n++; });
  return n;
}
