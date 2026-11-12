// 사진 속 인물 (tools/capture_photos.mjs 의 사람 패스 — 게임 런타임은 이 파일을 읽지 않는다)
//   게임의 리깅된 캐릭터 GLB(jihun = 남학생 · seoyeon = 여학생, 같은 UE 뼈대)를 SkeletonUtils 로 복제해
//   졸업 단체 사진(단상 · 앞줄 의자 · 가운데 선생님) · 방송부 · 체육대회 · 서린제 군중을 3D 로 세운다.
//   배경은 게임 장면을 같은 카메라로 찍은 원본이고, 여기서는 그 카메라(위치 · 방향 · 화각)와 바닥 높이 표본(grid)을 받아
//   사람 + 접지 그림자만 투명 배경에 그린다 → photo_fx.js 가 원본 위에 합성한 뒤 시대별 후보정을 한다.
//   개체마다 키(0.94~1.06) · 몸/고개 방향 · Idle 프레임 · 머리/피부 톤 · 시대별 교복 · 넥타이/리본 · 안경을 바꾼다.
//   얼굴은 게임의 양식화된 얼굴 그대로이며 사진 크기에서는 식별되지 않는다 (실제 인물 없음).
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import * as SU from '../vendor/addons/utils/SkeletonUtils.js';
const T = THREE, BASE = new URL('..', import.meta.url).href;
const R = s => { let a = s >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

// ── 모델 ──
let LIB = null;
const shrink = (tex, max) => {   // 사진 속 사람은 수십 px — 텍스처를 줄여 헤드리스 메모리 · 시간을 아낀다
  const im = tex && tex.image; if (!im || !im.width || Math.max(im.width, im.height) <= max || tex.userData.shrunk) return;
  const k = max / Math.max(im.width, im.height), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); tex.image = c; tex.userData.shrunk = true; tex.needsUpdate = true;
};
async function loadLib() {
  if (LIB) return LIB;
  const ld = new GLTFLoader();
  const one = async (id, h) => {
    const gl = await ld.loadAsync(BASE + 'assets/characters/' + id + '.glb'), m = gl.scene;
    const drop = [];
    m.traverse(o => {
      if (!(o.isMesh || o.isSkinnedMesh)) return;
      if (/Backpack|Strap|Bunny|Keyring|Baton|Belt|Buckle|Guard_Cap|Flashlight|Holster|Key\d|KeyRing|Radio|NameTag|Patch|Guard_Tie|Teeth|Tongue/i.test(o.name)) { drop.push(o); return; }
      for (const M of [].concat(o.material)) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap']) shrink(M[k], 512);
    });
    drop.forEach(o => o.parent.remove(o));
    m.updateMatrixWorld(true);
    const b = new T.Box3().setFromObject(m), s = h / (b.max.y - b.min.y);
    m.scale.multiplyScalar(s); m.position.set(-(b.min.x + b.max.x) / 2 * s, -b.min.y * s, -(b.min.z + b.max.z) / 2 * s);
    const holder = new T.Group(); holder.add(m);
    return { holder, clips: gl.animations || [], id };
  };
  const [M, F] = await Promise.all([one('jihun', 1.73), one('seoyeon', 1.61)]);
  return (LIB = { M, F });
}

// ── 시대별 교복 ── coat = 동복 상의, tie = 남 넥타이, rib = 여 리본, dark = 검정 동복 시절(넥타이 없음)
const ERA = {
  1968: { coat: 0x121214, tie: null, rib: null, dark: true },
  1989: { coat: 0x15161b, tie: null, rib: 0x18181c, dark: true },
  1993: { coat: 0x1c2236, tie: 0x5a2026, rib: 0x5a2026 },
  1997: { coat: 0x1b2640, tie: 0x6a1e2a, rib: 0x7a2030 },
  1998: { coat: 0x1b2640, tie: 0x6a1e2a, rib: 0x7a2030 },
  2001: { coat: 0x262f20, tie: 0x6a5520, rib: 0x6a5520 },
  2004: { coat: 0x1a2340, tie: 0x7a2030, rib: 0x7a2030 },
  2007: { coat: 0x222a3e, tie: 0x2a4a7a, rib: 0x2a4a7a },
};
const HAIR = [0x0d0b0a, 0x15110e, 0x1e1813, 0x271d16];
const SKIN = [[1, 1, 1], [1.03, 1, .97], [.94, .9, .87], [.98, .95, .92], [1.05, 1.03, 1]];
const TEACH = [0x3c3c40, 0x4a4238, 0x2a2c32, 0x56565a, 0x3a3226];
const SPORT = [0xf0f0ec, 0xf0f0ec, 0xf0f0ec, 0x1e2a6a, 0xb82a26];   // 체육복 (흰 · 청 · 적 — 청백전)

const MATS = new Map(), RECOL = new Map();
function recolor(tex, hex) {   // 교복 텍스처(남색 원단 + 흰 셔츠 · 칼라)를 시대 색으로: 어두운 원단만 바꾸고 흰 부분 · 체크 무늬 명암은 유지
  const k = tex.uuid + hex; if (RECOL.has(k)) return RECOL.get(k);
  const im = tex.image, c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data, tr = hex >> 16 & 255, tg = hex >> 8 & 255, tb = hex & 255;   // sRGB 그대로 (텍스처 공간)
  for (let i = 0; i < p.length; i += 4) { const l = (p[i] * .3 + p[i + 1] * .59 + p[i + 2] * .11) / 255;
    if (l > .55) continue;   // 셔츠 · 칼라
    const f = Math.min(2.2, l / .11), w = Math.max(0, (l - .3) / .25);   // 원단 결 · 주름 명암 보존, 밝은 체크선은 섞는다
    p[i] = tr * f * (1 - w) + p[i] * w; p[i + 1] = tg * f * (1 - w) + p[i + 1] * w; p[i + 2] = tb * f * (1 - w) + p[i + 2] * w; }
  g.putImageData(d, 0, 0); const t = new T.CanvasTexture(c); t.colorSpace = tex.colorSpace; t.flipY = tex.flipY; t.wrapS = tex.wrapS; t.wrapT = tex.wrapT; t.channel = tex.channel;
  RECOL.set(k, t); return t;
}
function dress(o, look, rnd) {   // 변형별 재질 공유 (개체마다 복제하면 셰이더 · 메모리가 폭증한다)
  const hi = rnd() * HAIR.length | 0, si = rnd() * SKIN.length | 0;
  o.traverse(m => {
    if (!(m.isMesh || m.isSkinnedMesh) || !m.material) return;
    m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    const S0 = m.material, nm = (m.name + '_' + (S0.name || '')).toLowerCase();
    const part = /hair|bang/.test(nm) ? 'hair' : /brow|lash/.test(nm) ? 'lash' : /skin|body/.test(nm) && !/suit/.test(nm) ? 'skin' : /uniform|suit/.test(nm) ? 'cloth' : /tie|ribbon/.test(nm) ? 'tie' : /emblem|button|zip/.test(nm) ? 'trim' : 'other';
    const v = part === 'hair' ? hi : part === 'skin' ? si : part === 'cloth' ? look.coat : part === 'tie' ? String(look.tie) : part === 'trim' ? String(look.dark) : 0;
    if (part === 'tie' && look.tie == null) { m.visible = false; return; }
    const key = S0.uuid + '|' + v;
    if (MATS.has(key)) { m.material = MATS.get(key); return; }
    const M = new T.MeshStandardMaterial({ name: S0.name, color: S0.color?.clone() || new T.Color(1, 1, 1), map: S0.map, normalMap: S0.normalMap, roughness: Math.max(.5, S0.roughness ?? .8), metalness: 0,
      transparent: false, alphaTest: S0.transparent || S0.alphaTest ? .45 : 0, side: S0.side });
    if (part === 'hair') { M.color.setHex(HAIR[hi]).multiplyScalar(3); M.roughness = .55; M.side = T.DoubleSide; }
    else if (part === 'skin') M.color.setRGB(...SKIN[si]);
    else if (part === 'cloth') { M.roughness = .9; if (look.white) { M.map = null; M.color.setHex(look.coat); } else if (M.map) { M.map = recolor(M.map, look.coat); M.color.setRGB(1, 1, 1); } }
    else if (part === 'tie') M.color.setHex(look.tie).multiplyScalar(2.2);
    else if (part === 'trim' && look.dark) M.color.setHex(0x9a8a60);
    else if (part === 'lash') { M.depthWrite = false; M.transparent = true; M.alphaTest = 0; }
    MATS.set(key, M); m.material = M;
  });
}

function glasses() {   // 값싼 뿔테 안경
  const g = new T.Group(), mat = new T.MeshStandardMaterial({ color: 0x141210, roughness: .4 });
  const ring = new T.TorusGeometry(.022, .003, 6, 18);
  for (const s of [-1, 1]) { const r = new T.Mesh(ring, mat); r.position.x = s * .033; g.add(r); }
  const br = new T.Mesh(new T.BoxGeometry(.022, .004, .004), mat); g.add(br);
  return g;
}
function chair() {   // 강당 접이식 의자
  const g = new T.Group(), m = new T.MeshStandardMaterial({ color: 0x55555a, roughness: .5, metalness: .4 }), s = new T.MeshStandardMaterial({ color: 0x2a2a30, roughness: .8 });
  const seat = new T.Mesh(new T.BoxGeometry(.44, .04, .42), s); seat.position.y = .44; g.add(seat);
  for (const [x, z] of [[-.2, -.18], [.2, -.18], [-.2, .18], [.2, .18]]) { const l = new T.Mesh(new T.CylinderGeometry(.012, .012, .44, 6), m); l.position.set(x, .22, z); g.add(l); }
  const back = new T.Mesh(new T.BoxGeometry(.44, .34, .03), s); back.position.set(0, .7, -.2); g.add(back);
  for (const x of [-.2, .2]) { const p = new T.Mesh(new T.CylinderGeometry(.012, .012, .5, 6), m); p.position.set(x, .7, -.2); g.add(p); }
  g.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  return g;
}

// ── 자세: Idle 프레임 위에 뼈를 덮어쓴다 ──
//   UE 마네킹 뼈 (glTF Y-up 변환 후). 축은 실측: 팔 내리기 = upperarm 의 로컬 회전, 앉기 = thigh/calf.
const AX = { arm: new T.Vector3(0, 0, 1), leg: new T.Vector3(0, 0, 1) };
function boneRot(b, axis, a) { if (b) b.quaternion.multiply(new T.Quaternion().setFromAxisAngle(axis, a)); }
function aimBone(b, child, dirW, k = 1) {   // 뼈 b 를 돌려 b→child 방향이 dirW(월드)를 향하게
  if (!b || !child) return;
  b.updateWorldMatrix(true, true);
  const p0 = b.getWorldPosition(new T.Vector3()), p1 = child.getWorldPosition(new T.Vector3()), cur = p1.sub(p0).normalize();
  const q = new T.Quaternion().setFromUnitVectors(cur, dirW.clone().normalize());
  if (k < 1) q.slerp(new T.Quaternion(), 1 - k);
  const pq = b.parent.getWorldQuaternion(new T.Quaternion()), wq = b.getWorldQuaternion(new T.Quaternion());
  b.quaternion.copy(pq.invert().multiply(q.multiply(wq)));
  b.updateWorldMatrix(false, true);
}
function pose(B, kind, rnd, root) {
  root.updateMatrixWorld(true);
  const rq = root.getWorldQuaternion(new T.Quaternion()), W = (x, y, z) => new T.Vector3(x, y, z).applyQuaternion(rq);   // 사람 기준(x 오른쪽 · z 앞)
  const side = s => (s === 'l' ? 1 : -1);   // 모델 왼쪽 = +x (앞이 +z 일 때)
  if (kind === 'sit') {
    for (const s of ['l', 'r']) { aimBone(B['thigh_' + s], B['calf_' + s], W(side(s) * .12, -.05, 1)); aimBone(B['calf_' + s], B['foot_' + s], W(side(s) * .05, -1, .08)); }
  }
  if (kind === 'stand' || kind === 'clasp' || kind === 'sit') {
    for (const s of ['l', 'r']) {
      if (kind === 'stand') { aimBone(B['upperarm_' + s], B['lowerarm_' + s], W(side(s) * (.16 + rnd() * .05), -1, .02)); aimBone(B['lowerarm_' + s], B['hand_' + s], W(side(s) * .05, -1, .12)); }
      else if (kind === 'clasp') { aimBone(B['upperarm_' + s], B['lowerarm_' + s], W(side(s) * .14, -1, .12)); aimBone(B['lowerarm_' + s], B['hand_' + s], W(-side(s) * .55, -.85, .3)); }
      else { aimBone(B['upperarm_' + s], B['lowerarm_' + s], W(side(s) * .12, -1, .15)); aimBone(B['lowerarm_' + s], B['hand_' + s], W(-side(s) * .1, -.35, 1)); }
    }
  } else if (kind === 'cheer') {
    const s = rnd() < .5 ? 'l' : 'r', both = rnd() < .4;
    for (const t of both ? ['l', 'r'] : [s]) { aimBone(B['upperarm_' + t], B['lowerarm_' + t], W(side(t) * .45, 1, .15)); aimBone(B['lowerarm_' + t], B['hand_' + t], W(side(t) * .15, 1, .1)); }
    if (!both) { const o = s === 'l' ? 'r' : 'l'; aimBone(B['upperarm_' + o], B['lowerarm_' + o], W(side(o) * .18, -1, .05)); aimBone(B['lowerarm_' + o], B['hand_' + o], W(side(o) * .05, -1, .15)); }
  } else if (kind === 'console') {   // 방송 콘솔에 손을 얹는다
    for (const s of ['l', 'r']) { aimBone(B['upperarm_' + s], B['lowerarm_' + s], W(side(s) * .2, -.8, .5)); aimBone(B['lowerarm_' + s], B['hand_' + s], W(-side(s) * .2, -.25, 1)); }
  }
  // 손가락: Idle 의 벌린 손가락을 손등 방향으로 가지런히 (살짝 굽힘) — 갈퀴 손 방지
  for (const s of ['l', 'r']) {
    const hb = B['hand_' + s], la = B['lowerarm_' + s]; if (!hb || !la) continue;
    hb.updateWorldMatrix(true, true);
    const dir = hb.getWorldPosition(new T.Vector3()).sub(la.getWorldPosition(new T.Vector3())).normalize();
    for (const f of ['index', 'middle', 'ring', 'pinky']) { aimBone(B[f + '_01_' + s], B[f + '_02_' + s], dir); aimBone(B[f + '_02_' + s], B[f + '_03_' + s], dir); }
  }
  // 고개: 약간씩 다르게 (카메라 쪽은 유지)
  if (B.head) boneRot(B.head, new T.Vector3(0, 1, 0), (rnd() - .5) * .25);
  if (B.neck_01) boneRot(B.neck_01, new T.Vector3(1, 0, 0), (rnd() - .5) * .08);
}

// ── 배치 ──
export async function stage(scene, P, groundAt) {
  const L = await loadLib(), rnd = R(P.seed || 1), era = ERA[P.era] || ERA[2007];
  const root = new T.Group(); scene.add(root);
  const people = [];
  const add = (x, z, yaw, o = {}) => {
    const female = o.female ?? (rnd() < (P.female ?? .45)), src = female ? L.F : L.M;
    const p = SU.clone(src.holder), sc = o.scale ?? (.94 + rnd() * .12) * (o.teacher ? 1.02 : 1);
    p.scale.setScalar(sc);
    const look = o.teacher ? { coat: TEACH[o.teacher % TEACH.length], tie: female ? null : 0x4a2a2a } : o.sport ? { coat: SPORT[rnd() * SPORT.length | 0], tie: null, white: true } : { coat: era.coat, tie: female ? era.rib : era.tie, dark: era.dark };
    if (look.white && look.coat !== 0xf0f0ec) look.white = false;
    dress(p, look, rnd);
    const y = o.y ?? groundAt(x, z);
    p.position.set(x, y, z); p.rotation.y = yaw + (o.jitter ?? (rnd() - .5) * .14);
    root.add(p);
    const model = p.children[0], B = {}; model.traverse(b => { if (b.isBone) B[b.name] = b; });
    const clip = (o.clip && src.clips.find(c => c.name === o.clip)) || src.clips.find(c => /^idle$/i.test(c.name)) || src.clips[0];
    if (clip) { const mx = new T.AnimationMixer(model); mx.clipAction(clip).play(); mx.update(rnd() * clip.duration); }
    pose(B, o.pose || 'stand', rnd, p);
    if (o.pose === 'sit') {   // 엉덩이를 의자 높이로 (Idle 의 골반 높이 → 좌판 0.47)
      p.updateMatrixWorld(true); const pel = B.pelvis.getWorldPosition(new T.Vector3());
      p.position.y += (y + .5) - pel.y + .02;
      p.updateMatrixWorld(true); const fl = Math.min(B.foot_l.getWorldPosition(new T.Vector3()).y, B.foot_r.getWorldPosition(new T.Vector3()).y);
      if (fl < y + .06) { /* 발이 바닥 아래로 — 다리가 길면 무릎을 조금 더 굽힌 셈 치고 그대로 둔다 */ }
    }
    if (o.glasses ?? rnd() < (P.glasses ?? .15)) { const gl = glasses(); p.updateMatrixWorld(true); const hp = B.head.getWorldPosition(new T.Vector3()); const q = p.getWorldQuaternion(new T.Quaternion());
      gl.position.copy(hp).add(new T.Vector3(0, .075 * sc * (female ? .93 : 1), .095 * sc).applyQuaternion(q)); gl.quaternion.copy(q); gl.scale.setScalar(sc); root.add(gl); }
    people.push(p); return p;
  };
  for (const G of P.groups) {
    const [ox, oz] = G.origin, yaw = G.yaw || 0, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const Wp = (lx, lz) => [ox + lx * cy + lz * sy, oz - lx * sy + lz * cy];   // 로컬(x 오른쪽 · z 카메라 쪽) → 월드
    if (G.type === 'rows') {   // 졸업 사진: 뒤에서 앞 순서 rows: { n, dz, h(단 높이), seat, spacing, stagger }
      const base = G.base ?? groundAt(ox, oz);
      G.rows.forEach(r => {
        const sp = r.spacing || .5, off = r.stagger ? sp / 2 : 0;
        if (r.h) {   // 나무 단상(라이저) — 앞줄 사람에 가려 윗면 가장자리만 보인다
          const w = r.n * sp + .5 + off, box = new T.Mesh(new T.BoxGeometry(w, r.h, .62), new T.MeshStandardMaterial({ color: 0x5e5246, roughness: .9 }));
          const [bx, bz] = Wp(off / 2, r.dz); box.position.set(bx, base + r.h / 2, bz); box.rotation.y = yaw; box.castShadow = box.receiveShadow = true; root.add(box);
        }
        for (let i = 0; i < r.n; i++) {
          const mid = Math.abs(i - (r.n - 1) / 2), lx = (i - (r.n - 1) / 2) * sp + off + (rnd() - .5) * .04, [x, z] = Wp(lx, r.dz + (rnd() - .5) * .04);
          if (r.seat) {
            const teacher = mid < (G.teachers || 0) / 2 ? 1 + i : 0;
            const ch = chair(), [cx, cz] = Wp(lx, r.dz - .1); ch.position.set(cx, base, cz); ch.rotation.y = yaw; root.add(ch);
            add(x, z, yaw, { y: base, pose: 'sit', teacher, female: teacher ? i % 3 === 1 : undefined, jitter: (rnd() - .5) * .06 });
          } else add(x, z, yaw, { y: base + (r.h || 0), pose: rnd() < .7 ? 'stand' : 'clasp', jitter: (rnd() - .5) * .1 });
        }
      });
    } else if (G.type === 'scatter') {   // 군중: 겹치지 않게 흩어 세운다
      for (let i = 0; i < G.n; i++) {
        let lx, lz, x, z, k = 0;
        const g0 = groundAt(ox, oz);   // 가로등 · 지붕 위 같은 높은 표본은 건너뛴다
        do { lx = (rnd() - .5) * G.w; lz = (rnd() - .5) * G.d; [x, z] = Wp(lx, lz); } while (++k < 60 && (Math.abs(groundAt(x, z) - g0) > .35 || people.some(q => Math.hypot(q.position.x - x, q.position.z - z) < (G.gap || .6))));
        if (k >= 60) continue;
        const face = G.face === 'cam' ? yaw : G.face === 'in' ? Math.atan2(ox - x, oz - z) : G.face != null ? G.face : rnd() * 6.28;
        const ps = G.poses ? G.poses[rnd() * G.poses.length | 0] : 'stand';
        add(x, z, face + (rnd() - .5) * (G.spread ?? .6), { pose: ps, sport: G.sport });
      }
    } else if (G.type === 'list') {
      for (const [lx, lz, ry, ps, ex] of G.at) { const [x, z] = Wp(lx, lz); add(x, z, yaw + (ry || 0), { pose: ps || 'stand', ...(ex || {}) }); }
    }
  }
  return { root, people };
}

// ── 사람 패스 렌더: info = capture_photos 가 게임에서 잰 카메라 · 바닥 표본, P = 배치 · 조명 ──
export async function render(info, P) {
  const { W, H, grid } = info, SS = P.ss || 2;
  const hAt = (x, z) => {   // 바닥 높이 (쌍선형, 빈 칸은 이웃)
    const fx = (x - grid.x0) / grid.st, fz = (z - grid.z0) / grid.st, i = Math.max(0, Math.min(grid.nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(grid.nz - 2, Math.floor(fz)));
    const g = (a, b) => grid.h[b * grid.nx + a]; const v = [g(i, j), g(i + 1, j), g(i, j + 1), g(i + 1, j + 1)].filter(q => q != null);
    if (!v.length) return 0; if (v.length < 4) return Math.min(...v);
    const u = Math.min(1, Math.max(0, fx - i)), w = Math.min(1, Math.max(0, fz - j)); return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - w) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * w;
  };
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(info.fov, W / H, .05, 400);
  cam.position.fromArray(info.pos); cam.quaternion.fromArray(info.quat); cam.updateMatrixWorld(true);
  {   // rel: [오른쪽, 앞] — 카메라 기준 배치 (실내 등), 사람은 카메라를 본다
    const f = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); f.y = 0; f.normalize(); const rt = new T.Vector3(-f.z, 0, f.x);
    for (const G of P.groups) if (G.rel) { G.origin = [cam.position.x + rt.x * G.rel[0] + f.x * G.rel[1], cam.position.z + rt.z * G.rel[0] + f.z * G.rel[1]]; G.yaw = Math.atan2(-f.x, -f.z) + (G.yawOff || 0); }
  }
  const hG = P.flat != null ? () => P.flat : hAt, { people } = await stage(scene, P, hG);
  // 그림자 받이: 바닥 표본으로 만든 지형 (그림자만 보인다)
  const geo = new T.PlaneGeometry((grid.nx - 1) * grid.st, (grid.nz - 1) * grid.st, grid.nx - 1, grid.nz - 1); geo.rotateX(-Math.PI / 2);
  const pa = geo.attributes.position;
  for (let k = 0; k < pa.count; k++) { const x = pa.getX(k) + grid.x0 + (grid.nx - 1) * grid.st / 2, z = pa.getZ(k) + grid.z0 + (grid.nz - 1) * grid.st / 2; pa.setXYZ(k, x, hG(x, z) + .004, z); }
  geo.computeVertexNormals();
  const catcher = new T.Mesh(geo, new T.ShadowMaterial({ color: 0x1a140e, opacity: P.shadow ?? .5 })); catcher.receiveShadow = true; scene.add(catcher);
  // 조명: 해(그림자) + 부드러운 정면 키 + 하늘/땅 반구광 — 얼굴 · 교복이 읽히게
  const c = new T.Vector3(); people.forEach(p => c.add(p.position)); c.divideScalar(Math.max(1, people.length));
  const fwd = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); fwd.y = 0; fwd.normalize();
  const right = new T.Vector3().crossVectors(fwd, new T.Vector3(0, 1, 0));
  const sun = new T.DirectionalLight(0xfff1de, P.sun ?? 2.2), sd = P.sunDir || [-.5, 1.1, .7];
  sun.position.copy(c).addScaledVector(right, sd[0] * 20).add(new T.Vector3(0, sd[1] * 20, 0)).addScaledVector(fwd, -sd[2] * 20); sun.target.position.copy(c);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const rr = P.shadowR || 10, sc = sun.shadow.camera; sc.left = sc.bottom = -rr; sc.right = sc.top = rr; sc.near = 1; sc.far = 80; sun.shadow.bias = -.0005; sun.shadow.normalBias = .03; sun.shadow.radius = 4;
  const key = new T.DirectionalLight(0xfff6ec, P.key ?? 1.1); key.position.copy(cam.position).addScaledVector(right, -2).add(new T.Vector3(0, 3, 0)); key.target.position.copy(c);
  const hemi = new T.HemisphereLight(P.sky ?? 0xdfe8f6, P.groundCol ?? 0x6a5a4a, P.hemi ?? 1.1);
  scene.add(sun, sun.target, key, key.target, hemi);
  const r = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(W * SS, H * SS, false); r.setClearColor(0, 0);
  r.outputColorSpace = T.SRGBColorSpace; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = P.exposure ?? 1.0;
  r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
  r.render(scene, cam);
  const out = document.createElement('canvas'); out.width = W * SS; out.height = H * SS; out.getContext('2d').drawImage(r.domElement, 0, 0);
  r.dispose(); r.forceContextLoss?.();
  return { url: out.toDataURL('image/png'), n: people.length };
}
