// 2008년 10월 밤 · 캠퍼스 바깥마당 마감 (외부 팀): 흙 운동장 트랙 · 붉은 벽돌 담장 + 철망 · 교명석 · 현수막 · 등하교 안전 표지 ·
//   교직원 주차장(2008년식 무상표 박스형 승용차 · 승합차) · 은행나무(10월 노란 잎) · 향나무 · 낙엽 · 분리수거장.
//   ── 모두 InstancedMesh / 합친 메시 · 공용 재질 · 그림자 드리우는 조명 없음. 인도(window.__pathNET) · 금지 구역 · 충돌 상자 · 조사 지점은 피한다.
import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';
import * as PT from './rebuild/periodTex.js?v=431';   // 소품 사실감: 은행잎 · 나무껍질 · 향나무 · 차 도장 텍스처 (모듈 캐시 한 벌)

const S = (c, r = .7, m = 0, e) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...(e || {}) });
const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
let seed = 20081012; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

// 붉은 치장벽돌 (boxMesh UV: 1 = 4m) — 벽돌 0.2 × 0.06m · 줄눈 · 군데군데 그을음 · 이끼
function brickTex() {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#6e6458'; g.fillRect(0, 0, w, h);
    const bw = w / 20, bh = h / 66;
    for (let r = 0; r < 66; r++) for (let c = -1; c < 21; c++) {
      const x = c * bw + (r % 2 ? bw / 2 : 0), y = r * bh, t = rnd();
      g.fillStyle = `rgb(${120 + t * 40 | 0},${48 + t * 22 | 0},${34 + t * 14 | 0})`; g.fillRect(x + 1, y + 1, bw - 2, bh - 1.6);
    }
    for (let i = 0; i < 24; i++) { const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 70, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rnd() < .5 ? 'rgba(20,18,14,.28)' : 'rgba(50,70,30,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  });
}
// 현수막 (흰 천 · 붉은 · 남색 글씨)
function bannerTex(lines, accent = '#b0201c') {
  return canvasTex(1024, 192, (g, w, h) => {
    g.fillStyle = '#efece2'; g.fillRect(0, 0, w, h); g.fillStyle = accent; g.fillRect(0, 0, w, 14); g.fillRect(0, h - 14, w, 14);
    g.textAlign = 'center'; g.fillStyle = accent; g.font = 'bold 64px "Noto Sans KR", sans-serif'; g.fillText(lines[0], w / 2, 90);
    g.fillStyle = '#1c2a5a'; g.font = 'bold 36px "Noto Sans KR", sans-serif'; g.fillText(lines[1], w / 2, 150);
    g.fillStyle = 'rgba(80,70,50,.18)'; for (let i = 0; i < 6; i++) g.fillRect(rnd() * w, 0, 2, h);   // 접힌 주름
  });
}
function signTex(draw, w = 256, h = 256) { return canvasTex(w, h, draw); }

export function installCampusGrounds({ scene, world, floors, footprints = [] }) {
  const OUT = world.OUT || scene, F0 = floors[0], C = F0.col || (F0.col = []);
  const NET = window.__pathNET || [], KEEP = window.__pathKEEP || [];
  const spots = [...(world.props || []), ...(world.items || [])].filter(p => !p.floor && (p.pos || p.mesh)).map(p => { const v = p.pos || p.mesh.position; return [v.x, v.z]; });
  const onPath = (x, z, m = 0) => NET.some(r => x > r[0] - m && x < r[1] + m && z > r[2] - m && z < r[3] + m);
  const inBlock = (x, z, m = .3) => [...KEEP, ...footprints].some(b => x > b[0] - m && x < b[1] + m && z > b[2] - m && z < b[3] + m);
  const hitCol = (x, z, m = .35) => C.some(c => !c.off && c.x1 != null && x > c.x1 - m && x < c.x2 + m && z > c.z1 - m && z < c.z2 + m);
  const nearSpot = (x, z, r = 2.2) => spots.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < r);
  const used = [];
  const free = (x, z, r = .5) => !onPath(x, z, r) && !inBlock(x, z, r * .6) && !hitCol(x, z, r) && !nearSpot(x, z) && !used.some(([ux, uz, ur]) => Math.hypot(ux - x, uz - z) < ur + r);
  const col = (x1, x2, z1, z2, h) => C.push({ x1, x2, z1, z2, h, grounds08: true });
  const root = new THREE.Group(); root.name = 'GROUNDS_2008'; root.userData.rbKeep = root.userData.facKeep = root.userData.facNew = true;
  const add = (g, m, shadow = false) => { const o = new THREE.Mesh(g, m); o.receiveShadow = true; o.castShadow = shadow; root.add(o); return o; };
  const info = {};

  // ── 1) 운동장 트랙: 붉은 우레탄 → 다진 마사토 흙 트랙 (흰 석회 선은 그대로). 2008년 공립 고교 운동장 ──
  { let n = 0; const bb = new THREE.Box3(); let dirt = null;
    scene.traverse(o => { if (!o.isMesh || !o.material || o.material.polygonOffsetFactor !== -1 || !o.material.map || o.material.name === 'school-turf') return;
      bb.setFromObject(o); if (bb.min.x < -25 || bb.max.x > 25 || bb.min.z < 26 || bb.max.z > 54.5 || bb.max.y > .06) return;
      if (!dirt) { dirt = o.material.clone(); dirt.map = OUT.userData.dirtMap || findTurfMap(scene) || o.material.map; dirt.normalMap = null; dirt.roughnessMap = null; dirt.color.set(0xb4a284); dirt.roughness = 1; dirt.name = 'track-dirt-2008'; }
      o.material = dirt; n++; }); info.track = n; }

  // ── 2) 외곽 담장: 붉은 벽돌 + 위에 철망 (정문 좌우 남쪽 담) ──
  // 정문 서쪽 담(-114.5 ~ -4.5)의 충돌 상자는 중심점(-59.5, 70)이 제2주차장 정리 영역 안이라 시설 재건축 때 함께 지워졌다
  //   → 담 메시는 그대로라 플레이어 · 카메라가 담을 통과해 거리로 나갔다. 빠진 구간만 다시 세운다 (facKeep: 이후 정리에도 남는다)
  { const has = C.some(c => !c.off && c.x1 != null && c.x1 < -40 && c.x2 > -20 && c.z1 < 70 && c.z2 > 70);
    if (!has) { const r = { x1: -114.5, x2: -4.5, z1: 69.75, z2: 70.25, facKeep: true, grounds08: true }; C.push(r); (F0.walls || (F0.walls = [])).push(r); info.westWallCol = true; } }
  { let wallMat = null; scene.traverse(o => { if (!wallMat && o.isMesh && o.material && o.material.bumpScale === .015 && o.material.map) wallMat = o.material; });
    if (wallMat) { const t = brickTex(); t.wrapS = t.wrapT = THREE.RepeatWrapping; wallMat.map = t; wallMat.bumpMap = t; wallMat.bumpScale = .01; wallMat.color.set(0xffffff); wallMat.needsUpdate = true; info.brick = true; }
    // 철망: 담 위 0.9m · 2.5m 마다 ㄱ자 지주 (한 벌) + 마름모 철망 (알파 텍스처 한 장)
    const wireTex = canvasTex(64, 64, (g) => { g.strokeStyle = '#9aa0a0'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(64, 64); g.moveTo(64, 0); g.lineTo(0, 64); g.stroke(); g.fillStyle = '#9aa0a0'; g.fillRect(0, 0, 64, 3); });
    wireTex.colorSpace = THREE.NoColorSpace; wireTex.wrapS = wireTex.wrapT = THREE.RepeatWrapping;
    const mWire = new THREE.MeshStandardMaterial({ color: 0x6c7270, map: wireTex, alphaMap: wireTex, transparent: true, alphaTest: .3, side: THREE.DoubleSide, roughness: .6, metalness: .5, depthWrite: false });
    const mPostW = S(0x3c4244, .5, .6); const wires = [], posts = [], Z = 70, Y0 = 2.8, H = .9;
    for (const [x1, x2] of [[-114.5, -5.3], [5.3, 114.5]]) {
      const g = new THREE.PlaneGeometry(x2 - x1, H); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (x2 - x1) / .12, uv.getY(i) * H / .12);
      g.translate((x1 + x2) / 2, Y0 + H / 2, Z); wires.push(g);
      for (let x = x1; x <= x2 + .01; x += 2.5) posts.push(new THREE.BoxGeometry(.05, H + .12, .05).translate(x, Y0 + H / 2, Z));
      posts.push(new THREE.BoxGeometry(x2 - x1, .03, .03).translate((x1 + x2) / 2, Y0 + H, Z));
    }
    add(mergeGeometries(wires), mWire); add(mergeGeometries(posts), mPostW);
    // 담쟁이 (10월: 붉게 물든 잎) — 안쪽 벽면 군데군데
    const ivyTex = canvasTex(256, 256, (g, w, h) => { for (let i = 0; i < 900; i++) { const x = rnd() * w, y = h - Math.pow(rnd(), .6) * h; g.fillStyle = ['#7a2a18', '#9a3a1c', '#5a4a1c', '#3c4a22', '#b0501e'][i % 5]; g.globalAlpha = .9; g.beginPath(); g.ellipse(x, y, 5 + rnd() * 4, 3 + rnd() * 3, rnd() * 3, 0, 7); g.fill(); } });
    const mIvy = new THREE.MeshStandardMaterial({ map: ivyTex, alphaTest: .4, transparent: false, side: THREE.DoubleSide, roughness: .85 });
    const ivy = []; for (const x of [-96, -78, -61, -44, -33, 19, 52, 66, 83, 101]) { const w = 2.5 + rnd() * 3, h = 1.6 + rnd() * 1.1; ivy.push(new THREE.PlaneGeometry(w, h).translate(x, h / 2, Z - .27)); }
    add(mergeGeometries(ivy), mIvy);
  }

  // ── 3) 교명석 (정문 안 서쪽) · 향나무 2 · 정문 바깥 등하교 안전 표지 ──
  const mStone = S(0x8a8478, .85), mDark = S(0x2a2c2e, .6, .3);
  { const x = -9.2, z = 68.3; if (!hitCol(x, z, .2)) {
      const base = new THREE.BoxGeometry(3.2, .35, 1.2).translate(x, .175, z), rock = new THREE.DodecahedronGeometry(1, 0).scale(1.45, .78, .42).translate(x, 1.05, z);
      add(mergeGeometries([base.toNonIndexed(), rock.toNonIndexed()]), mStone, true);
      const t = signTex((g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#1a1612'; g.font = 'bold 96px "Noto Serif KR", serif'; g.textAlign = 'center'; g.fillText('서문고등학교', w / 2, 120); g.font = '40px "Noto Serif KR", serif'; g.fillText('誠實 · 勤勉 · 創意', w / 2, 190); }, 1024, 224);
      const p = add(new THREE.PlaneGeometry(2.2, .48), new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: .9, polygonOffset: true, polygonOffsetFactor: -2 }));
      p.position.set(x, 1.12, z - .37); p.rotation.y = Math.PI;
      col(x - 1.6, x + 1.6, z - .6, z + .6); used.push([x, z, 1.8]); info.nameStone = true; } }
  // 등하교 안전 표지 (정문 바깥 · 인도 쪽): 원형 '30' 서행 + 등하교 안전 지도 판
  { const x = 6.4, z = 71.4; const pole = new THREE.CylinderGeometry(.04, .04, 2.6, 8).translate(x, 1.3, z);
    add(pole, mDark); col(x - .1, x + .1, z - .1, z + .1);
    const t1 = signTex((g, w, h) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill(); g.strokeStyle = '#c81e1e'; g.lineWidth = 26; g.beginPath(); g.arc(128, 128, 108, 0, 7); g.stroke(); g.fillStyle = '#111'; g.font = 'bold 110px sans-serif'; g.textAlign = 'center'; g.fillText('30', 128, 166); });
    const p1 = add(new THREE.CircleGeometry(.32, 24), new THREE.MeshStandardMaterial({ map: t1, roughness: .6 })); p1.position.set(x, 2.35, z + .05);
    const t2 = signTex((g, w, h) => { g.fillStyle = '#f2d21c'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.textAlign = 'center'; g.font = 'bold 44px sans-serif'; g.fillText('등하교 안전 지도', w / 2, 58); g.font = 'bold 34px sans-serif'; g.fillText('학교 앞 서행 · 주정차 금지', w / 2, 108); g.font = '26px sans-serif'; g.fillText('07:30 ~ 08:30  /  16:30 ~ 22:00', w / 2, 150); }, 512, 176);
    const p2 = add(new THREE.PlaneGeometry(.9, .31), new THREE.MeshStandardMaterial({ map: t2, roughness: .6 })); p2.position.set(x, 1.8, z + .05); }

  // ── 4) 현수막 2: 바깥(거리 쪽) 수시 합격 · 안쪽(운동장 쪽) 축제 ──
  { const mk = (t, w, h, x, y, z, ry) => { const m = add(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: .95, side: THREE.FrontSide })); m.position.set(x, y, z); m.rotation.y = ry; };
    mk(bannerTex(['축  2009학년도 수시모집 합격', '3학년 김○○(○○대)  이○○(○○교대)  박○○(○○대)  외 27명  — 서문고등학교 동문회 —']), 8, 1.5, 14, 1.75, 69.71, Math.PI);
    mk(bannerTex(['제22회 서문제 · 10월 24일(금) ~ 25일(토)', '학교폭력 없는 행복한 학교 · 10월은 독서의 달'], '#1c4a8a'), 7, 1.3, -20, 1.75, 69.71, Math.PI);
    const ropes = [new THREE.BoxGeometry(.02, .02, .3).translate(10, 2.5, 69.8), new THREE.BoxGeometry(.02, .02, .3).translate(18, 2.5, 69.8)]; add(mergeGeometries(ropes), mDark); }

  // ── 5) 교직원 주차장 (옛 제1주차장 터, 정문 동쪽 · 남쪽 담장 밑): 아스팔트 + 흰 주차선 · 카 스토퍼 · 차량 7대 ──
  { const X1 = 17.5, X2 = 44.5, Z1 = 59.2, Z2 = 69.2, SL = 2.5, ZS = 63.9;   // 담장 쪽 한 줄 주차 (앞쪽은 통로 → 동쪽 산책로 · 남부 대로)
    const asp = canvasTex(1024, 384, (g, w, h) => { g.fillStyle = '#3a3a3a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { g.fillStyle = rnd() < .5 ? 'rgba(20,20,20,.5)' : 'rgba(110,108,100,.45)'; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
      const sx = w / (X2 - X1), sz = h / (Z2 - Z1); g.fillStyle = 'rgba(232,228,214,.85)'; for (let x = X1 + .5; x <= X2 - .4; x += SL) g.fillRect((x - X1) * sx - 3, (ZS - Z1) * sz, 6, (Z2 - .2 - ZS) * sz); g.fillRect(4, (ZS - Z1) * sz, w - 8, 6);
      g.fillStyle = 'rgba(30,30,30,.35)'; for (let i = 0; i < 14; i++) { const x = rnd() * w, y = (ZS - Z1) * sz + rnd() * 120; g.beginPath(); g.ellipse(x, y, 30 + rnd() * 30, 14, 0, 0, 7); g.fill(); } });   // 기름 얼룩
    const lot = new THREE.PlaneGeometry(X2 - X1, Z2 - Z1); lot.rotateX(-Math.PI / 2); lot.translate((X1 + X2) / 2, .016, (Z1 + Z2) / 2);
    add(lot, new THREE.MeshStandardMaterial({ map: asp, roughness: .92, polygonOffset: true, polygonOffsetFactor: -1 }));
    // 차량: 박스형 중형 세단 · 경차 · 승합차 실루엣 (로고 · 상표 없음) — 차체(인스턴스 색) · 유리 · 바퀴/범퍼
    const body = { sedan: [[4.6, .62, 1.76, 0, .55, 0], [2.5, .55, 1.6, -.15, 1.14, 0]], mini: [[3.5, .7, 1.5, 0, .55, 0], [2.1, .58, 1.4, -.1, 1.18, 0]], van: [[4.9, 1.45, 1.86, 0, .97, 0]] };
    const glass = { sedan: [[2.3, .42, 1.62, -.15, 1.16, 0]], mini: [[1.95, .44, 1.42, -.1, 1.2, 0]], van: [[3.6, .5, 1.88, -.45, 1.4, 0], [.06, .55, 1.6, 2.42, 1.35, 0]] };
    const gbox = L => mergeGeometries(L.map(([w, h, d, x, y, z]) => new THREE.BoxGeometry(w, h, d).translate(x, y, z)));
    const wheels = (len, wd) => { const L = []; for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.push(new THREE.CylinderGeometry(.31, .31, .2, 12).rotateX(Math.PI / 2).translate(sx * len * .32, .31, sz * (wd / 2 - .08)));
      L.push(new THREE.BoxGeometry(.12, .22, wd * .98).translate(len / 2, .42, 0), new THREE.BoxGeometry(.12, .22, wd * .98).translate(-len / 2, .42, 0)); return mergeGeometries(L.map(g => g.index ? g.toNonIndexed() : g)); };
    const geo = { sedan: [gbox(body.sedan), gbox(glass.sedan), wheels(4.6, 1.76)], mini: [gbox(body.mini), gbox(glass.mini), wheels(3.5, 1.5)], van: [gbox(body.van), gbox(glass.van), wheels(4.9, 1.86)] };
    const mPaint = S(0xffffff, .38, .45, { map: PT.shared('carPaint', PT.carPaint) }), mGlass = S(0x14181c, .15, .6, { map: PT.shared('screenGlass', PT.screenGlass), roughnessMap: PT.shared('screenRough', PT.screenRough) }), mTire = S(0x141414, .85);   // 도장: 오렌지필 · 빗물 먼지 · 흙탕 점 / 유리: 먼지 · 물 얼룩
    const slots = []; for (let x = X1 + .5 + SL / 2; x < X2 - .5; x += SL) slots.push(x);
    const pick = [['sedan', 0xd8d8d2], ['sedan', 0x2a2c30], ['van', 0xc8ccc8], ['mini', 0xb8a050], ['sedan', 0x9aa0a6], null, ['sedan', 0x5a1c1c], null, ['mini', 0x3a5a7a], ['sedan', 0xd0ccc0]];
    const per = {}; let cars = 0;
    slots.forEach((x, i) => { const c = pick[i % pick.length]; const z = (ZS + Z2) / 2 + .05;
      if (!c || hitCol(x, z, .9) || nearSpot(x, z, 3)) return; (per[c[0]] ||= []).push([x, z, c[1], rnd() < .5 ? Math.PI / 2 : -Math.PI / 2]); cars++; });
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3(1, 1, 1), Yv = new THREE.Vector3(0, 1, 0), col3 = new THREE.Color();
    for (const [k, L] of Object.entries(per)) { geo[k].forEach((g, gi) => { if (g.attributes.uv) g.deleteAttribute('uv'); if (gi < 2) g = PT.boxProjectUV(g, 1.2); const im = new THREE.InstancedMesh(g, [mPaint, mGlass, mTire][gi], L.length); im.castShadow = gi === 0; im.receiveShadow = true;
        L.forEach(([x, z, c, ry], i) => { Q.setFromAxisAngle(Yv, ry); P.set(x, 0, z); M.compose(P, Q, Sc); im.setMatrixAt(i, M); if (gi === 0) im.setColorAt(i, col3.set(c)); });
        im.computeBoundingSphere(); root.add(im); });
      L.forEach(([x, z]) => { col(x - 1, x + 1, z - 2.45, z + 2.45, 1.5); used.push([x, z, 2.6]); }); }
    // 카 스토퍼 (콘크리트) — 빈 칸 포함
    const stops = slots.map(x => new THREE.BoxGeometry(1.4, .12, .16).translate(x, .06, Z2 - .75)); add(mergeGeometries(stops), mStone);
    // 주차장 표지판
    const t = signTex((g, w, h) => { g.fillStyle = '#1c3a7a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = 'bold 150px sans-serif'; g.textAlign = 'center'; g.fillText('P', 70, 170); g.font = 'bold 54px sans-serif'; g.fillText('교직원', 320, 100); g.fillText('주차장', 320, 175); g.font = '24px sans-serif'; g.fillText('외부 차량 주차 금지', w / 2, 232); }, 512, 256);
    const sp = add(new THREE.PlaneGeometry(1, .5), new THREE.MeshStandardMaterial({ map: t, roughness: .6 })); sp.position.set(X1 + .3, 1.9, Z1 + .5); sp.rotation.y = -Math.PI / 2;
    add(new THREE.CylinderGeometry(.04, .04, 2.2, 8).translate(X1 + .35, 1.1, Z1 + .5), mDark); col(X1 + .25, X1 + .45, Z1 + .4, Z1 + .6);
    info.cars = cars;
    // 분리수거장 (주차장 동쪽 끝 · 담장 밑): 슬래브 + 녹색 철망 칸막이 + 골강판 지붕 + 수거함 4 (캔 · 병 / 플라스틱 / 종이 / 일반)
    { const x0 = 47.2, z0 = 66.6; if (!hitCol(x0, z0, 1.6) && !onPath(x0, z0, 1.8) && !nearSpot(x0, z0, 2.5)) {
        const fr = [new THREE.BoxGeometry(4.2, .1, 2.2).translate(x0, .05, z0)]; for (const dx of [-2, 2]) for (const dz of [-1, 1]) fr.push(new THREE.BoxGeometry(.07, 2.3, .07).translate(x0 + dx, 1.15, z0 + dz));
        fr.push(new THREE.BoxGeometry(4.5, .05, 2.5).rotateX(.08).translate(x0, 2.35, z0)); add(mergeGeometries(fr), S(0x5c6a60, .6, .4), true);
        const binC = [0xd8b020, 0x2a6a9a, 0x3a7a3a, 0x6a6a6a]; const bins = []; binC.forEach((c, i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(.85, 1.0, .75), S(c, .55)); b.position.set(x0 - 1.4 + i * .93, .6, z0 + .4); root.add(b); bins.push(b); });
        const st = signTex((g, w, h) => { g.fillStyle = '#2a5a3a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 60px sans-serif'; g.fillText('분리수거장', w / 2, 70); g.font = '34px sans-serif'; g.fillText('캔·병   플라스틱   종이   일반', w / 2, 128); }, 512, 160);
        const sm = add(new THREE.PlaneGeometry(1.8, .56), new THREE.MeshStandardMaterial({ map: st, roughness: .7 })); sm.position.set(x0, 1.9, z0 - 1.06); sm.rotation.y = Math.PI;
        col(x0 - 2.1, x0 + 2.1, z0 - 1.1, z0 + 1.1, 2.4); used.push([x0, z0, 2.6]); info.recycle = true; } }
  }

  // ── 6) 은행나무(노랗게 물든 10월) · 향나무 · 낙엽 ──
  { const trunkG = new THREE.CylinderGeometry(.13, .2, 3.2, 7).translate(0, 1.6, 0);
    const crown = mergeGeometries([new THREE.IcosahedronGeometry(1.5, 1).scale(1, 1.5, 1).translate(0, 4.6, 0), new THREE.IcosahedronGeometry(1.1, 1).translate(.5, 3.6, .3), new THREE.IcosahedronGeometry(1.0, 1).translate(-.5, 6.0, -.2)]);
    const juniper = mergeGeometries([new THREE.ConeGeometry(.75, 1.6, 8).translate(0, 1.1, 0), new THREE.ConeGeometry(.6, 1.4, 8).translate(0, 2.0, 0), new THREE.ConeGeometry(.42, 1.1, 8).translate(0, 2.8, 0)].map(g => g.toNonIndexed()));
    const cands = []; // 담장 밑 · 운동장 가장자리 · 본관 앞 광장 둘레 (인도 바깥)
    for (let x = -108; x <= 108; x += 7.5) cands.push([x + rnd() * 2, 68.0]);
    for (let z = 18; z <= 54; z += 6) { cands.push([-31.2, z]); cands.push([31.6, z]); }
    for (let x = -46; x <= 46; x += 8) cands.push([x + 2, 9.0]);
    const ginkgo = []; for (const [x, z] of cands) if (free(x, z, 1.6)) { ginkgo.push([x, z]); used.push([x, z, 1.6]); col(x - .22, x + .22, z - .22, z + .22); }
    const jun = []; for (const [x, z] of [[-12, 68.4], [-6.5, 68.5], [-16, 67.6], [11.8, 68.3], [-38, 11.2], [38, 11.2]]) if (free(x, z, .8)) { jun.push([x, z]); used.push([x, z, .8]); col(x - .5, x + .5, z - .5, z + .5); }
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3(), Yv = new THREE.Vector3(0, 1, 0), cc = new THREE.Color();
    const inst = (g, m, L, shadow, color, uvS = 0) => { if (!L.length) return; if (g.attributes.uv) g.deleteAttribute('uv'); if (uvS) g = PT.boxProjectUV(g, uvS);   // 알베도만 (노멀 맵 없음 → 달빛에 보랏빛으로 번지지 않는다)   // uv 없음 → 단색 보강(노멀 맵)이 덮지 않는다 (잎 덩어리가 하늘빛에 보랏빛으로 번졌다)
      const im = new THREE.InstancedMesh(g, m, L.length); im.castShadow = shadow; im.receiveShadow = true;
      L.forEach(([x, z], i) => { const s = .85 + rnd() * .35; Q.setFromAxisAngle(Yv, rnd() * 6.28); P.set(x, 0, z); Sc.set(s, s, s); M.compose(P, Q, Sc); im.setMatrixAt(i, M); if (color) im.setColorAt(i, cc.setHSL(color[0] + rnd() * color[1], color[2], color[3] + rnd() * .08)); });
      im.computeBoundingSphere(); root.add(im); };
    // 잎 덩어리: 달빛(푸른 방향광 · 반구광)만 받으면 노랑의 파랑 성분이 없어 보랏빛 회색으로 죽는다 → 약한 주황 자체광으로 10월 은행잎 색을 지킨다
    const fol = PT.shared('ginkgoFoliage', PT.ginkgoFoliage), mCrown = S(0xf0b020, .9, 0, { flatShading: true, emissive: 0xa86a10, emissiveIntensity: .42, map: fol, emissiveMap: fol });   // 부채꼴 잎 무더기 · 그늘 틈 (예전 민무늬 노랑 덩어리) mCrown.userData.noDetail = true; mCrown.name = 'ginkgo-crown-2008';
    inst(trunkG, S(0x4a3c30, .95, 0, { map: PT.shared('barkTex', PT.barkTex) }), ginkgo, true, null, 1.2); inst(crown, mCrown, ginkgo, true, null, 1.6);
    inst(juniper, S(0x1f3a24, .9, 0, { flatShading: true, map: PT.shared('needleFoliage', PT.needleFoliage) }), jun, true, null, .8);
    // 낙엽: 은행잎 · 마른 잎 — 나무 밑에 많이, 인도 위로도 조금 날린다 (평평한 작은 판 한 벌)
    const leafG = new THREE.PlaneGeometry(.11, .09).rotateX(-Math.PI / 2); const leaves = [];
    for (const [x, z] of ginkgo) for (let k = 0; k < 90; k++) { const a = rnd() * 6.28, r = Math.pow(rnd(), .7) * 3.4; leaves.push([x + Math.cos(a) * r, z + Math.sin(a) * r, 1]); }
    for (let k = 0; k < 900; k++) { const r = NET[(rnd() * NET.length) | 0]; if (!r) break; leaves.push([r[0] + rnd() * (r[1] - r[0]), r[2] + rnd() * (r[3] - r[2]), 0]); }
    if (leaves.length) { const im = new THREE.InstancedMesh(leafG, S(0xffffff, .9, 0, { side: THREE.DoubleSide }), leaves.length); im.receiveShadow = true; im.name = 'grounds08_leaves';
      leaves.forEach(([x, z, g], i) => { Q.setFromAxisAngle(Yv, rnd() * 6.28); P.set(x, (onPath(x, z, .1) ? .02 : -.012) + rnd() * .006, z);   // 잔디(-0.02) 위 낙엽은 잔디에 붙인다 — 예전엔 인도 높이(.02)로 깔려 잔디 위 4cm 에 떠 있었다 const s = .7 + rnd() * .7; Sc.set(s, 1, s); M.compose(P, Q, Sc); im.setMatrixAt(i, M);
        im.setColorAt(i, g && rnd() < .8 ? cc.setHSL(.12 + rnd() * .03, .78, .45 + rnd() * .1) : cc.setHSL(.07 + rnd() * .04, .5, .22 + rnd() * .1)); });
      im.computeBoundingSphere(); root.add(im); }
    // 원래 캠퍼스 나무(world: 120그루 한 벌)의 수관 색 — 정문 옆 벚나무가 10월에 분홍 꽃빛(H .9~.95)이라 안개 속에서 보랏빛 회색으로 보였다
    //   → 벚나무는 붉은 단풍, 나머지는 은행 · 느티 가을빛(호박색 · 마른 올리브)으로. 개체 색만 바꾼다 (형상 · 충돌 그대로)
    { let n = 0; const hc = { h: 0, s: 0, l: 0 }; scene.traverse(o => { if (!o.isInstancedMesh || !o.instanceColor || o.parent === root || o.count < 60 || o.count > 200 || !o.material || !o.material.flatShading) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); if (o.geometry.boundingBox.max.y < 5.5) return;
        for (let i = 0; i < o.count; i++) { o.getColorAt(i, cc); cc.getHSL(hc);
          if (hc.h > .8) cc.setHSL(.03 + rnd() * .04, .62, .26 + rnd() * .08);                       // 벚나무 단풍
          else if (rnd() < .4) cc.setHSL(.10 + rnd() * .03, .6, .2 + rnd() * .08);                  // 은행 · 느티 노란 잎
          else cc.setHSL(.13 + rnd() * .07, .38, .09 + rnd() * .06);                                // 마른 올리브 (밤 실루엣)
          o.setColorAt(i, cc); }
        o.instanceColor.needsUpdate = true; if (o.material.emissive) { o.material.emissive.set(0x3a2208); o.material.emissiveIntensity = .22; } n++; });
      info.autumnCrowns = n; }
    info.ginkgo = ginkgo.length; info.juniper = jun.length; info.leaves = leaves.length; }

  OUT.add(root); window.__grounds = info; return info;
}
function findTurfMap(scene) { let m = null; scene.traverse(o => { if (!m && o.isMesh && o.material && o.material.name === 'school-turf') m = o.material.map; }); return m; }
