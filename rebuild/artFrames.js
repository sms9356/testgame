// 액자 그림 · 사진 (assets/art — tools/gen_art.mjs 로 절차 생성한 유화 · 교장 초상 · 졸업 사진 · 붓글씨 · 상장 · 학생 작품)
//   본관 · 별관 방(교장실 · 교무실 · 중앙 현관 · 도서실 · 복도 · 미술실 · 음악실 · 역사관)과 시설(역사관 · 학생회관 · 대강당 로비) 벽에 건다.
//   자리는 실제 지오메트리에 광선을 쏘아 고른다: 액자 뒤 전체가 한 평면의 벽이어야 하고(문 · 창 · 게시판 · 표지 · 가구가 있으면 탈락),
//   상호작용 · 조사 지점과는 떨어뜨린다 — 다른 팀이 건물 배치를 바꿔도 겹치지 않게.
//   그림은 한 장의 아틀라스로 묶고, 액자 · 유리 · 그림은 재질별로 하나의 메시로 합친다 (드로콜 ~6).
import * as THREE from '../vendor/three.module.js';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';
import { ZONES as FZ } from '../facilityRebuild.js?v=434';
import { idleTimeout } from '../idleTasks.js?v=434';

// 분류별 크기(긴 변 m) · 액자 (테 폭, 두께, 재질, 유리, 매트)
const KIND = {
  oil: { L: 1.1, bw: .075, d: .055, frame: 'gilt', glass: false },
  portrait: { L: .64, bw: .07, d: .05, frame: 'walnut', glass: false },
  photo: { L: .72, bw: .022, d: .03, frame: 'black', glass: true },
  callig: { L: 1.25, bw: .04, d: .035, frame: 'oak', glass: true },
  scroll: { L: 1.0, bw: .035, d: .03, frame: 'oak', glass: true },
  cert: { L: .44, bw: .025, d: .025, frame: 'gilt', glass: true },
  poster: { L: .62, bw: .014, d: .02, frame: 'alu', glass: true },
  student: { L: .6, bw: .02, d: .022, frame: 'oak', glass: true },
  hero: { L: 1.3, bw: .035, d: .035, frame: 'black', glass: true },   // 학교 전경 항공 사진
  emblem: { L: .7, bw: .06, d: .045, frame: 'gilt', glass: true },   // 교표
  song: { L: .78, bw: .035, d: .03, frame: 'oak', glass: true },   // 교가
};
const kindOf = n => n === 'photo_aerial_campus' ? 'hero' : n === 'emblem_seorin' ? 'emblem' : n === 'callig_school_song' ? 'song' : /^oil_/.test(n) ? 'oil' : /^portrait_/.test(n) ? 'portrait' : /^photo_/.test(n) ? 'photo' : n === 'callig_scroll' ? 'scroll' : /^callig_/.test(n) ? 'callig' : /^cert_/.test(n) ? 'cert' : /^poster_/.test(n) ? 'poster' : 'student';
const HEIGHT = { oil: 1.68, portrait: 1.78, photo: 1.62, callig: 1.95, scroll: 1.6, cert: 1.55, poster: 1.5, student: 1.52, hero: 1.7, emblem: 1.75, song: 1.62 };

// 방 종류 → 걸 그림 (순서대로, 자리가 나는 만큼)
const ROOM_ART = {
  principal: ['callig_motto', 'photo_aerial_campus', 'portrait_p6', 'portrait_p7', 'portrait_p8', 'portrait_p9', 'portrait_p10', 'portrait_p11', 'emblem_seorin'],
  staff: ['oil_sea_dusk', 'cert_school_2005', 'cert_science_2007', 'photo_grad_2007', 'callig_school_song', 'photo_classroom_2006'],
  hall: ['emblem_seorin', 'photo_aerial_campus', 'callig_school_song', 'callig_motto', 'oil_hanok_village', 'cert_school_2005'],
  library: ['photo_library_2008', 'callig_scroll', 'oil_hanok_village2', 'poster_book'],
  corridor: ['photo_grad_2001', 'photo_spring_1999', 'poster_water', 'photo_grad_2004', 'photo_sports_1997', 'poster_energy', 'photo_autumn_2006', 'poster_peace', 'photo_gym_2005', 'oil_mountain_autumn'],
  art: ['art_wc_school', 'art_still_life', 'art_wc_cosmos', 'art_plaster_sketch', 'poster_water', 'poster_energy', 'poster_book', 'poster_peace'],
  music: ['poster_choir', 'oil_sea_dusk2', 'cert_choir_2006'],
  history: ['photo_opening_1968', 'photo_grad_1989', 'photo_grad_1993', 'photo_grad_1997', 'photo_gate_1994', 'photo_bcast_1998'],
  fac_hist: ['photo_opening_1968', 'photo_aerial_campus', 'photo_bcast_1998', 'photo_grad_1989', 'photo_grad_1993', 'photo_grad_1997', 'photo_gate_1994', 'photo_gate_autumn_1996', 'photo_sports_1997', 'photo_grad_2001', 'emblem_seorin', 'portrait_p9'],
  fac_union: ['cert_bcast_2008', 'photo_seorinje_2007', 'photo_sports_1997', 'photo_grad_2004', 'poster_choir', 'poster_peace', 'oil_mountain_autumn'],
  fac_aud: ['photo_seorinje_2007', 'oil_sea_dusk', 'cert_choir_2006', 'photo_grad_2007', 'poster_choir', 'emblem_seorin'],
};

let MATS = null;
function mats(atlas) {
  if (MATS) return MATS;
  const S = (o) => new THREE.MeshStandardMaterial(o);
  MATS = {
    art: S({ map: atlas, roughness: .62, metalness: 0 }),
    gilt: S({ color: 0x9a7434, roughness: .38, metalness: .75 }),
    walnut: S({ color: 0x3a2416, roughness: .5, metalness: .05 }),
    oak: S({ color: 0x8a6440, roughness: .6, metalness: 0 }),
    black: S({ color: 0x1c1c1e, roughness: .45, metalness: .3 }),
    alu: S({ color: 0xb8bcc0, roughness: .3, metalness: .8 }),
    back: S({ color: 0x2a2620, roughness: .95 }),
    glass: S({ color: 0xffffff, roughness: .04, metalness: .9, transparent: true, opacity: .1, depthWrite: false }),
  };
  return MATS;
}

// ── 광선 판정용 삼각형 격자 (월드 좌표) ──
function triGrid(roots, boxes) {
  const C = .5, cells = new Map(), T = [], v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], bb = new THREE.Box3();
  const hitBox = (x1, x2, y1, y2, z1, z2) => boxes.some(b => x2 > b.x1 && x1 < b.x2 && z2 > b.z1 && z1 < b.z2 && y2 > b.y1 && y1 < b.y2);
  for (const root of roots) { root.updateMatrixWorld(true); root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.geometry || !o.geometry.attributes.position || o.userData.artFrame) return;
    for (let a = o; a; a = a.parent) if (a.visible === false) return;
    const mt = Array.isArray(o.material) ? o.material[0] : o.material; if (!mt || mt.transparent || mt.opacity < 1 || mt.transmission > 0 || /glass|win/i.test(mt.name || '') || /glass|win/i.test(o.name || '')) return;   // 유리 · 창은 벽이 아니다 (광선이 지나가 탈락)
    const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); bb.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
    if (!hitBox(bb.min.x, bb.max.x, bb.min.y, bb.max.y, bb.min.z, bb.max.z)) return;
    const P = g.attributes.position, I = g.index, n = I ? I.count : P.count, M = o.matrixWorld;
    for (let i = 0; i < n; i += 3) {
      for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(P, I ? I.getX(i + k) : i + k).applyMatrix4(M);
      const x1 = Math.min(v[0].x, v[1].x, v[2].x), x2 = Math.max(v[0].x, v[1].x, v[2].x), z1 = Math.min(v[0].z, v[1].z, v[2].z), z2 = Math.max(v[0].z, v[1].z, v[2].z), y1 = Math.min(v[0].y, v[1].y, v[2].y), y2 = Math.max(v[0].y, v[1].y, v[2].y);
      if (!hitBox(x1, x2, y1, y2, z1, z2)) continue;
      const id = T.length; T.push(v[0].x, v[0].y, v[0].z, v[1].x, v[1].y, v[1].z, v[2].x, v[2].y, v[2].z);
      for (let ix = Math.floor(x1 / C); ix <= Math.floor(x2 / C); ix++) for (let iz = Math.floor(z1 / C); iz <= Math.floor(z2 / C); iz++) { const key = ix * 100003 + iz; let l = cells.get(key); if (!l) cells.set(key, l = []); l.push(id); }
    } }); }
  const F = new Float32Array(T);
  // 수평 짧은 광선: 첫 교차 거리 · 법선 (양면)
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), pv = new THREE.Vector3(), tv = new THREE.Vector3(), qv = new THREE.Vector3(), seen = new Set();
  return function ray(ox, oy, oz, dx, dz, len) {
    let best = len, bn = null; seen.clear();
    const steps = Math.ceil(len / (C * .5)) + 1;
    for (let s = 0; s <= steps; s++) { const t = Math.min(len, s * C * .5), ix = Math.floor((ox + dx * t) / C), iz = Math.floor((oz + dz * t) / C), l = cells.get(ix * 100003 + iz); if (!l) continue;
      for (const id of l) { if (seen.has(id)) continue; seen.add(id); const j = id;
        e1.set(F[j + 3] - F[j], F[j + 4] - F[j + 1], F[j + 5] - F[j + 2]); e2.set(F[j + 6] - F[j], F[j + 7] - F[j + 1], F[j + 8] - F[j + 2]);
        pv.set(-e2.y * dz, e2.x * dz - e2.z * dx, e2.y * dx);   // (dx,0,dz) × e2
        const det = e1.dot(pv); if (Math.abs(det) < 1e-9) continue; const inv = 1 / det;
        tv.set(ox - F[j], oy - F[j + 1], oz - F[j + 2]); const u = tv.dot(pv) * inv; if (u < 0 || u > 1) continue;
        qv.crossVectors(tv, e1); const vv = (qv.x * dx + qv.z * dz) * inv; if (vv < 0 || u + vv > 1) continue;
        const t = e2.dot(qv) * inv; if (t > 1e-4 && t < best) { best = t; bn = new THREE.Vector3().crossVectors(e1, e2).normalize(); } } }
    return bn ? { t: best, n: bn } : null;
  };
}

// 구역 안에서 벽 후보 찾기 → 그림마다 맞는 자리 고르기
function placeZone(ray, Z, names, info, avoid, out, rnd) {
  const yc0 = Z.y0 + 1.65, seen = new Map(), cands = [];
  const STEP = 1.1, LEN = 4.5;
  for (let x = Z.x1 + .4; x <= Z.x2 - .4; x += STEP) for (let z = Z.z1 + .4; z <= Z.z2 - .4; z += STEP) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const h = ray(x, yc0, z, dx, dz, LEN); if (!h || Math.abs(h.n.y) > .05) continue;
    const nd = h.n.x * dx + h.n.z * dz; if (nd > -.985) continue;   // 광선을 마주 보는 축 정렬 벽
    const px = x + dx * h.t, pz = z + dz * h.t; if (px < Z.x1 - .5 || px > Z.x2 + .5 || pz < Z.z1 - .5 || pz > Z.z2 + .5) continue;
    const key = `${dx},${dz},${Math.round((dx ? px : pz) * 50)}`; let w = seen.get(key); if (!w) { seen.set(key, w = { dx, dz, c: dx ? px : pz, a: [] }); cands.push(w); } w.a.push(dx ? z : x); }
  // 벽마다 따라가며 0.15m 간격 자리
  const spots = []; for (const w of cands) { const lo = Math.min(...w.a) - 1, hi = Math.max(...w.a) + 1; for (let s = lo; s <= hi; s += .15) spots.push({ w, s }); }
  const fits = (w, s, cy, W, H) => {   // 액자 뒤가 한 평면의 벽인지 (테두리 6cm 여유)
    const off = .32, nx = 6, ny = 5, ox = w.dx ? w.c - w.dx * off : 0, oz = w.dz ? w.c - w.dz * off : 0;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const u = -W / 2 - .06 + (W + .12) * i / (nx - 1), v = cy - H / 2 - .06 + (H + .12) * j / (ny - 1);
      const x = w.dx ? ox : s + u, z = w.dz ? oz : s + u, h = ray(x, v, z, w.dx, w.dz, .6);
      if (!h || Math.abs(h.t - off) > .012 || (h.n.x * w.dx + h.n.z * w.dz) > -.97) return false; }
    // 벽이 액자 위로도 이어지는지 (키 큰 장 · 칸막이 옆면을 벽으로 착각하지 않게)
    const top = Math.min(Z.y0 + 2.5, cy + H / 2 + .35), h = ray(w.dx ? ox : s, top, w.dz ? oz : s, w.dx, w.dz, .6);
    return !!h && Math.abs(h.t - off) < .015;
  };
  const placed = [];
  const free = (w, s, cy, W, H) => {
    const x = w.dx ? w.c : s, z = w.dz ? w.c : s;
    if (x < Z.x1 - .5 || x > Z.x2 + .5 || z < Z.z1 - .5 || z > Z.z2 + .5) return false;
    for (const p of placed) if (p.w === w && Math.abs(p.s - s) < (p.W + W) / 2 + p.gap && Math.abs(p.cy - cy) < (p.H + H) / 2 + .2) return false;
    for (const p of out) if (Math.hypot(p.x - x, p.z - z) < (p.W + W) / 2 + .3 && Math.abs(p.y - cy) < 1) return false;
    for (const a of avoid) if (Math.abs(a.y - Z.y0 - 1) < 1.8 && Math.hypot(a.x - x, a.z - z) < (a.r ?? 1.0) + W / 2) return false;
    return true; };
  const order = spots.map(p => ({ ...p, k: rnd() })).sort((a, b) => a.k - b.k);
  for (const name of names) { const im = info[name]; if (!im) continue; const kd = kindOf(name), K = KIND[kd], sc = Z.scale || 1;
    const asp = im.w / im.h, L = K.L * sc, W = (asp >= 1 ? L : L * asp) + K.bw * 2, H = (asp >= 1 ? L / asp : L) + K.bw * 2;
    const cy = Z.y0 + HEIGHT[kd] + (kd === 'portrait' ? 0 : (rnd() - .5) * .04);
    // 같은 종류 액자는 이미 건 액자 옆(같은 벽)을 먼저 — 초상 · 졸업 사진이 한 줄로 걸린다
    const prev = placed.filter(p => p.kd === kd), tries = prev.length ? [...prev.flatMap(p => [p.s + (p.W + W) / 2 + .28, p.s - (p.W + W) / 2 - .28].map(s => ({ w: p.w, s }))), ...order] : order;
    for (const sp of tries) { if (!free(sp.w, sp.s, cy, W, H) || !fits(sp.w, sp.s, cy, W, H)) continue;
      const x = sp.w.dx ? sp.w.c : sp.s, z = sp.w.dz ? sp.w.c : sp.s;
      const rec = { name, kd, w: sp.w, s: sp.s, cy, W, H, gap: kd === prev[0]?.kd ? .2 : .45, x, y: cy, z, nx: -sp.w.dx, nz: -sp.w.dz, zone: Z.key };
      placed.push(rec); out.push(rec); break; }
    if (Z.max && placed.length >= Z.max) break; }
}

// 액자 조립 (로컬: x 벽 따라 · y 위 · z 벽 밖으로) → 월드
function buildFrame(rec, im, atlasRect, G, rnd) {
  const K = KIND[rec.kd], W = rec.W, H = rec.H, bw = K.bw, d = K.d, M = new THREE.Matrix4(), n = new THREE.Vector3(rec.nx, 0, rec.nz), right = new THREE.Vector3(n.z, 0, -n.x);
  M.makeBasis(right, new THREE.Vector3(0, 1, 0), n).setPosition(rec.x + rec.nx * .003, rec.y, rec.z + rec.nz * .003);
  const tilt = new THREE.Matrix4().makeRotationZ((rnd() - .5) * (rec.kd === 'portrait' ? .012 : .024)); M.multiply(tilt);
  const push = (k, g) => { g.applyMatrix4(M); (G[k] ||= []).push(g); };
  const bx = (k, w, h, dd, x, y, z) => { const g = new THREE.BoxGeometry(w, h, dd); g.translate(x, y, z); push(k, g); };
  // 테두리 4개 (안쪽이 살짝 낮은 2단 몰딩)
  bx(K.frame, W, bw, d, 0, H / 2 - bw / 2, d / 2); bx(K.frame, W, bw, d, 0, -H / 2 + bw / 2, d / 2); bx(K.frame, bw, H - bw * 2, d, -W / 2 + bw / 2, 0, d / 2); bx(K.frame, bw, H - bw * 2, d, W / 2 - bw / 2, 0, d / 2);
  if (bw > .03) { const r = bw * .35, dd = d * .7; bx(K.frame, W - bw * 2 + r * 2, r, dd, 0, H / 2 - bw - r / 2 + r, dd / 2 + .002); bx(K.frame, W - bw * 2 + r * 2, r, dd, 0, -H / 2 + bw + r / 2 - r, dd / 2 + .002); }
  bx('back', W - bw, H - bw, .006, 0, 0, .003);   // 뒤판: 벽에 닿는다
  const aw = W - bw * 2, ah = H - bw * 2, z = K.glass ? d * .45 : d * .55, pg = new THREE.PlaneGeometry(aw, ah); pg.translate(0, 0, z);
  const uv = pg.attributes.uv, [u0, v0, u1, v1] = atlasRect; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); push('art', pg);
  if (K.glass) { const gg = new THREE.PlaneGeometry(aw, ah); gg.translate(0, 0, d * .8); gg.deleteAttribute('uv'); gg.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(8), 2)); push('glass', gg); }
}

const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
// 쓰는 그림만 2048 × (≤3072) 아틀라스로 (선반 패킹, 넘치면 축소) — 사진이 늘어 2048² 에선 0.65배로 뭉개졌다
function packAtlas(imgs) {
  const S = 2048, SH = 3072, list = Object.entries(imgs).sort((a, b) => b[1].height - a[1].height);
  for (let sc = 1; sc > .2; sc -= .05) { let x = 0, y = 0, rowH = 0, ok = true; const rect = {};
    for (const [n, im] of list) { const w = Math.ceil(im.width * sc) + 4, h = Math.ceil(im.height * sc) + 4; if (x + w > S) { x = 0; y += rowH; rowH = 0; } if (y + h > SH) { ok = false; break; } rect[n] = [x + 2, y + 2, w - 4, h - 4]; x += w; rowH = Math.max(rowH, h); }
    if (!ok) continue;
    const c = document.createElement('canvas'); c.width = S; c.height = Math.min(SH, Math.ceil((y + rowH) / 256) * 256); const g = c.getContext('2d'); g.fillStyle = '#555'; g.fillRect(0, 0, c.width, c.height);
    const uv = {}; for (const [n, [rx, ry, rw, rh]] of Object.entries(rect)) { g.drawImage(imgs[n], rx, ry, rw, rh); uv[n] = [(rx + .5) / S, 1 - (ry + rh - .5) / c.height, (rx + rw - .5) / S, 1 - (ry + .5) / c.height]; }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.flipY = true; return { tex: t, uv };
  }
  return null;
}

// zones: [{ x1,x2,z1,z2 (월드), y0, key (ROOM_ART), max?, scale? }], roots: 광선 대상, avoid: [{x,y,z,r}]
export async function hangArt({ scene, roots, zones, avoid = [], base = 'assets/art/' }) {
  const t0 = performance.now(), want = new Set(zones.flatMap(z => ROOM_ART[z.key] || []));
  const imgs = {}; await Promise.all([...want].map(async n => { const im = await loadImg(base + n + '.webp'); if (im) imgs[n] = im; }));
  if (!Object.keys(imgs).length) return null;
  const info = {}; for (const n in imgs) info[n] = { w: imgs[n].width, h: imgs[n].height };
  const boxes = zones.map(z => ({ x1: z.x1 - .6, x2: z.x2 + .6, z1: z.z1 - .6, z2: z.z2 + .6, y1: z.y0 + .4, y2: z.y0 + 2.7 }));
  const tg = performance.now(), ray = triGrid(roots, boxes), gridMs = Math.round(performance.now() - tg); let zoneMax = 0;
  let seed = 9; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const out = []; for (const Z of zones) { await new Promise(r => setTimeout(r, 0)); const tz = performance.now(); placeZone(ray, Z, Z.names || ROOM_ART[Z.key] || [], info, avoid, out, rnd); zoneMax = Math.max(zoneMax, performance.now() - tz); }
  const used = {}; out.forEach(r => used[r.name] = imgs[r.name]);
  const A = packAtlas(used); if (!A) return null;
  const M = mats(A.tex), G = {};
  for (const r of out) buildFrame(r, info[r.name], A.uv[r.name], G, rnd);
  const grp = new THREE.Group(); grp.name = 'ART_FRAMES'; Object.assign(grp.userData, { rbKeep: true, rbChk: true, facKeep: true, artFrame: true });
  for (const k in G) { const m = new THREE.Mesh(mergeGeometries(G[k], false), M[k]); m.name = 'ART_' + k; m.receiveShadow = k !== 'glass'; m.castShadow = false; if (k === 'glass') m.renderOrder = 3; Object.assign(m.userData, { rbChk: true, artFrame: true, dynamic: true }); grp.add(m); }
  scene.add(grp);
  const res = { count: out.length, ms: Math.round(performance.now() - t0), gridMs, zoneMaxMs: Math.round(zoneMax), list: out.map(r => ({ name: r.name, x: +r.x.toFixed(2), y: +r.y.toFixed(2), z: +r.z.toFixed(2), nx: r.nx, nz: r.nz, zone: r.zone })) };
  return res;
}
export const ART_ROOMS = ROOM_ART;

// 게임 연결 (rebuildGame.js 한 줄): 본관 · 별관 · 시설이 다 지어진 뒤 한가할 때 건다
const TYPE_KEY = { principal: 'principal', staff: 'staff', library: 'library', art: 'art', music: 'music', history: 'history' };
export function installArtFrames({ scene, world, buildings, delay = 2500 }) {
  const run = async () => {
    const zones = [], roots = [], avoid = [];
    for (const b of buildings) { if (!b || !b.spec || !b.props) continue; roots.push(b.root); const FH = b.spec.FH;
      const wbox = (x1, x2, z1, z2) => { const a = b.toWorld(x1, z1), c = b.toWorld(x2, z2); return { x1: Math.min(a[0], c[0]), x2: Math.max(a[0], c[0]), z1: Math.min(a[1], c[1]), z2: Math.max(a[1], c[1]) }; };
      for (const p of b.props) { if (p.kind === 'room') { const key = p.label === '중앙 현관' ? 'hall' : TYPE_KEY[p.type]; if (key) zones.push({ ...wbox(p.x1, p.x2, p.z1, p.z2), y0: p.floor * FH, key }); continue; }
        if (p.x == null || p.z == null) continue; const [x, z] = b.toWorld(p.x, p.z); avoid.push({ x, z, y: p.y ?? (p.floor || 0) * FH + 1 }); }
      for (const d of b.doors || []) if (d.mx != null) { const [x, z] = b.toWorld(d.mx, d.mz); avoid.push({ x, z, y: (d.py || 0) + 1, r: .7 }); }
      if (b.name === '본관') for (let f = 0; f < Math.min(3, b.spec.floors); f++) { const N = ROOM_ART.corridor; zones.push({ ...wbox(-b.layout.L / 2 + 6, b.layout.L / 2 - 6, b.layout.zN + .15, -.15), y0: f * FH, key: 'corridor', max: 3, names: N.map((_, i) => N[(i + f * 3) % N.length]) }); } }
    for (const [id, key, lv] of [['hist', 'fac_hist', [0, 1]], ['union', 'fac_union', [0, 1]], ['aud', 'fac_aud', [0]]]) { const g = scene.getObjectByName('FAC_' + id), Z = FZ[id]; if (!g || !Z) continue; roots.push(g);
      let x1 = Z.cx - Z.W / 2 + .3, x2 = Z.cx + Z.W / 2 - .3, z1 = Z.cz - Z.D / 2 + .3, z2 = Z.cz + Z.D / 2 - .3; if (id === 'aud') { x1 = Z.cx - 3.6; x2 = Z.cx + 3.6; z1 = Z.cz + Z.D / 2 - 4.7; }   // 대강당은 남측 로비만
      const names = ROOM_ART[key]; const half = Math.ceil(names.length / lv.length); lv.forEach((l, i) => zones.push({ x1, x2, z1, z2, y0: l * 3.6, key, names: names.slice(i * half, (i + 1) * half) })); }
    for (const p of world.props || []) { if (p.kind === 'room' || p.x == null) continue; avoid.push({ x: p.x, z: p.z, y: p.y ?? ((p.rbY ?? 0) + 1) }); }
    for (const it of world.items || []) if (it.pos) avoid.push({ x: it.pos.x, z: it.pos.z, y: it.pos.y, r: .8 });
    try { window.__artFrames = await hangArt({ scene, roots, zones, avoid }); } catch (e) { console.warn('[art frames]', e); }
  };
  idleTimeout(run, delay);
}
