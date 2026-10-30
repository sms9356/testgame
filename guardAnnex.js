// 경비동 별관: 정문 안쪽 기존 경비실 북쪽 벽에 바로 붙인 관제실 + 열쇠보관실.
// 중앙 보도(서쪽)로 출입문이 나 있고, 남쪽 벽은 경비실 북쪽 벽과 맞닿는다.
import * as THREE from './vendor/three.module.js';

export const ANNEX = Object.freeze({ x1: 4.8, x2: 11.4, z1: 59.6, z2: 64.95, h: 2.8, t: .15, xp: 8.0, doorZ1: 61.2, doorZ2: 62.2, innerZ1: 60.3, innerZ2: 61.3 });
// 키 보관함 비밀번호 = 펌프실 열쇠가 나간 시각 (대출 장부 22:50)
export const CABINET_CODE = '2250';
export const ANNEX_KEYS = [
  { id: 'main', name: '본관 열쇠', tag: '본관 교무실 · 숙직 서류함', color: '#c9a64a' },
  { id: 'gym', name: '체육관 열쇠', tag: '체육관 기구 창고 · 당직 함', color: '#4a8ac9' },
  { id: 'base', name: '지하실 열쇠', tag: '지하 시설창고 · 기밀 상자', color: '#c94a4a' },
];

function screenTex(label, seed) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 144; const g = c.getContext('2d');
  g.fillStyle = '#0a110d'; g.fillRect(0, 0, 256, 144);
  let s = seed * 9301 + 49297; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 1400; i++) { const v = 30 + r() * 70 | 0; g.fillStyle = `rgb(${v},${v + 8},${v})`; g.fillRect(r() * 256, r() * 144, 2, 1); }
  for (let y = 0; y < 144; y += 3) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, y, 256, 1); }
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, 256, 18);
  g.fillStyle = '#c8ffd6'; g.font = '11px monospace'; g.fillText(label, 5, 13); g.fillStyle = '#ff5050'; g.fillText('● REC', 205, 13);
  g.fillStyle = '#c8ffd6'; g.fillText('1998-10-12  22:5' + (seed % 10), 5, 138);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ── 실내 마감 (1998년 학교 경비실): 황갈색 장판(리놀륨) 바닥 · 진녹색 유성페인트 징두리 + 크림 벽지 · 걸레받이 · 텍스 천장 ──
const canvasTex = (w, h, draw, rep = [1, 1]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; return t; };
let FIN = null;
function finishes() {
  if (FIN) return FIN;
  const noise = (g, w, h, n, a, base) => { for (let i = 0; i < n; i++) { const v = (Math.random() - .5) * a; g.fillStyle = `rgba(${base[0] + v | 0},${base[1] + v | 0},${base[2] + v | 0},.5)`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 2); } };
  const lino = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#9a7a4e'; g.fillRect(0, 0, w, h); noise(g, w, h, 5000, 40, [154, 122, 78]); g.strokeStyle = 'rgba(60,40,20,.45)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); g.strokeStyle = 'rgba(255,240,210,.12)'; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(40,25,10,.08)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 30, 10 + Math.random() * 20, Math.random() * 3, 0, 7); g.fill(); } }, [2.5, 2.5]);
  const paper = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#e4dcc4'; g.fillRect(0, 0, w, h); noise(g, w, h, 3000, 18, [228, 220, 196]); g.strokeStyle = 'rgba(160,140,100,.18)'; for (let x = 0; x < w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } }, [3, 1.2]);
  const green = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#2f4a3c'; g.fillRect(0, 0, w, h); noise(g, w, h, 900, 22, [47, 74, 60]); g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, 0, w, 6); }, [3, 1]);
  const tex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#e6e2d6'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { g.fillStyle = 'rgba(120,110,90,.22)'; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); } g.strokeStyle = '#a8a294'; g.lineWidth = 4; g.strokeRect(0, 0, w, h); }, [5, 4]);
  FIN = { floor: new THREE.MeshStandardMaterial({ map: lino, roughness: .55, metalness: 0 }), paper: new THREE.MeshStandardMaterial({ map: paper, roughness: .9 }), wain: new THREE.MeshStandardMaterial({ map: green, roughness: .35 }),
    base: new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: .6 }), ceil: new THREE.MeshStandardMaterial({ map: tex, roughness: .95, side: THREE.DoubleSide }), rail: new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: .5 }) };
  return FIN;
}
// 벽 안쪽 면 마감: 면 (x1..x2 | z1..z2), n = 실내 쪽 법선 축 ('x+','x-','z+','z-'), 문 · 창 구멍은 [a, b, y1, y2] 로 비운다
function finishWall(G, boxMesh, a1, a2, c, n, H, holes = []) {
  const F = finishes(), alongX = n[0] === 'z', sg = n[1] === '+' ? 1 : -1, d = .012;
  const seg = (u1, u2, y1, y2, m) => { if (u2 - u1 < .02 || y2 - y1 < .02) return; const o = alongX ? boxMesh(u1, u2, y1, y2, c + (sg > 0 ? 0 : -d), c + (sg > 0 ? d : 0), m, 1) : boxMesh(c + (sg > 0 ? 0 : -d), c + (sg > 0 ? d : 0), y1, y2, u1, u2, m, 1); o.receiveShadow = true; G.add(o); };
  const band = (y1, y2, m) => { let u = a1; for (const [h1, h2, hy1, hy2] of [...holes].sort((p, q) => p[0] - q[0])) { seg(u, h1, y1, y2, m); if (y2 > hy2) seg(h1, h2, Math.max(y1, hy2), y2, m); if (y1 < hy1) seg(h1, h2, y1, Math.min(y2, hy1), m); u = h2; } seg(u, a2, y1, y2, m); };
  band(0, .1, F.base); band(.1, 1.0, F.wain); band(1.0, 1.04, F.rail); band(1.04, H - .02, F.paper);
}
export function buildGuardAnnex({ OUT, props, boxMesh, plane, flat, col, S, makeSign, mats, model }) {
  const A = ANNEX, G = new THREE.Group(); G.name = 'GUARD_ANNEX'; G.userData.dynamic = true; OUT.add(G);
  const wall = mats.facade, inner = mats.wall || mats.white, Y0 = .02;
  const W = (x1, x2, z1, z2, y1 = 0, y2 = A.h, mat = wall, solid = true) => { const m = boxMesh(x1, x2, y1, y2, z1, z2, mat, 2); m.castShadow = m.receiveShadow = true; G.add(m); if (solid && y1 < .5) col(x1, x2, z1, z2, true); return m; };
  // 바닥 · 지붕
  const FN = finishes(); flat(G, FN.floor, A.x1, A.x2, A.z1, A.z2, Y0, 2);
  G.add(boxMesh(A.x1 - .2, A.x2 + .2, A.h, A.h + .14, A.z1 - .25, A.z2 + .2, wall, 2));
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(A.x2 - A.x1, A.z2 - A.z1), FN.ceil); ceil.rotation.x = Math.PI / 2; ceil.position.set((A.x1 + A.x2) / 2, A.h - .01, (A.z1 + A.z2) / 2); G.add(ceil);
  // 외벽 (남쪽 벽은 기존 경비실 북쪽 벽과 맞닿는다)
  W(A.x1, 7.05, A.z2 - A.t, A.z2); W(7.9, A.x2, A.z2 - A.t, A.z2); W(7.05, 7.9, A.z2 - A.t, A.z2, 2.1, A.h, wall, false);   // 당직실 ↔ 관제실 내부 출입문 (한 건물)
  W(A.x2 - A.t, A.x2, A.z1, A.z2);
  W(A.x1, 9.0, A.z1, A.z1 + A.t); W(10.5, A.x2, A.z1, A.z1 + A.t); W(9.0, 10.5, A.z1, A.z1 + A.t, 0, 1.0); W(9.0, 10.5, A.z1, A.z1 + A.t, 2.1, A.h, wall, false);   // 북: 보관실 창
  plane(G, mats.glass, 1.5, 1.1, 9.75, 1.55, A.z1 + .075);
  W(A.x1, A.x1 + A.t, A.z1, A.doorZ1); W(A.x1, A.x1 + A.t, A.doorZ2, A.z2); W(A.x1, A.x1 + A.t, A.doorZ1, A.doorZ2, 2.15, A.h, wall, false);   // 서: 출입문 (중앙 보도 쪽)
  // 칸막이벽 (관제실 | 열쇠보관실)
  const px1 = A.xp - .06, px2 = A.xp + .06;
  W(px1, px2, A.z1, A.innerZ1, 0, A.h, inner); W(px1, px2, A.innerZ2, A.z2, 0, A.h, inner); W(px1, px2, A.innerZ1, A.innerZ2, 2.15, A.h, inner, false);
  // 출입문 (바깥으로 열린 철문 짝) · 간판
  G.add(boxMesh(A.x1 - .95, A.x1, 0, 2.1, A.doorZ1 - .02, A.doorZ1 + .04, mats.metal, 1));
  plane(G, new THREE.MeshBasicMaterial({ map: makeSign('경비동 관제실 · 열쇠보관실', '#1e2a2e', '#d9e4d0', 22), color: 0x9aa59a }), 2.2, .32, A.x1 - .01, 2.42, (A.doorZ1 + A.doorZ2) / 2, -Math.PI / 2);
  plane(G, new THREE.MeshBasicMaterial({ map: makeSign('관제실', '#20302a', '#cfe8d4', 30), color: 0xaab5aa }), .7, .2, A.xp - .07, 2.3, (A.innerZ1 + A.innerZ2) / 2, -Math.PI / 2);
  plane(G, new THREE.MeshBasicMaterial({ map: makeSign('열쇠보관실', '#302820', '#e8dcc8', 30), color: 0xaab5aa }), .7, .2, A.xp + .07, 2.3, (A.innerZ1 + A.innerZ2) / 2, Math.PI / 2);

  // 실내 벽 마감 (관제실 · 보관실 각 면)
  { const T = A.t, H = A.h;
    finishWall(G, boxMesh, A.x1 + T, A.xp - .06, A.z2 - T, 'z-', H, [[7.05, 7.9, 0, 2.1]]); finishWall(G, boxMesh, A.xp + .06, A.x2 - T, A.z2 - T, 'z-', H);
    finishWall(G, boxMesh, A.x1 + T, A.xp - .06, A.z1 + T, 'z+', H); finishWall(G, boxMesh, A.xp + .06, A.x2 - T, A.z1 + T, 'z+', H, [[9.0, 10.5, 1.0, 2.1]]);
    finishWall(G, boxMesh, A.z1 + T, A.z2 - T, A.x1 + T, 'x+', H, [[A.doorZ1, A.doorZ2, 0, 2.15]]); finishWall(G, boxMesh, A.z1 + T, A.z2 - T, A.x2 - T, 'x-', H);
    finishWall(G, boxMesh, A.z1 + T, A.z2 - T, A.xp - .06, 'x-', H, [[A.innerZ1, A.innerZ2, 0, 2.15]]); finishWall(G, boxMesh, A.z1 + T, A.z2 - T, A.xp + .06, 'x+', H, [[A.innerZ1, A.innerZ2, 0, 2.15]]); }
  // ── 관제실 (x 4.8 ~ 8.0): 경비실 쪽 남벽에 콘솔 · 모니터 월 ──
  const desk = mats.wood, dark = S(null, { color: 0x1c1f22, roughness: .5, metalness: .3 });
  if (model) { model('metal_office_desk', 5.95, 0, 64.3, 0); }   // 철제 사무용 책상 (실사) + 장부 놓는 보조 상판
  else { G.add(boxMesh(5.1, 6.95, .74, .79, 63.95, 64.75, desk, 1)); G.add(boxMesh(5.15, 6.9, 0, .74, 64.5, 64.75, dark, 1)); }
  col(5.1, 6.95, 63.95, 64.8, false, .79);
  G.add(boxMesh(5.05, 6.95, .95, 2.5, 64.68, 64.8, dark, 1));
  const screens = [], labels = ['CAM-01 정문', 'CAM-02 본관 1F 복도', 'CAM-03 B1 복도', 'CAM-04 교무실 앞', 'CAM-05 체육관', 'CAM-06 방송실', 'CAM-07 수영장', 'CAM-08 청운학사', 'CAM-09 옥상'];
  for (let i = 0; i < 9; i++) {
    const cx = 5.42 + (i % 3) * .6, cy = 2.17 - Math.floor(i / 3) * .52;
    const m = plane(G, new THREE.MeshBasicMaterial({ map: screenTex(labels[i], i + 1), toneMapped: false }), .56, .4, cx, cy, 64.665, Math.PI);
    screens.push(m);
  }
  G.add(boxMesh(6.15, 6.75, .79, .81, 64.05, 64.25, dark, 1));
  const vcr = S(null, { color: 0x2a2c2e, roughness: .4, metalness: .4 });
  for (let k = 0; k < 3; k++) G.add(boxMesh(5.2, 5.7, .79 + k * .09, .87 + k * .09, 64.1, 64.55, vcr, 1));
  const tapeM = S(null, { color: 0x111111, roughness: .6 });
  for (let k = 0; k < 6; k++) G.add(boxMesh(5.8 + k * .04, 5.83 + k * .04, .79, .98, 64.35, 64.55, tapeM, 1));
  
  officeChair(G, boxMesh, S, 6.45, 63.4, 0); col(6.2, 6.7, 63.1, 63.65, false, .48);
  if (model) model('drawer_cabinet', 5.2, 0, 60.35, Math.PI / 2); else G.add(boxMesh(4.97, 5.45, 0, 1.32, 59.78, 60.6, mats.metal, 1)); col(4.95, 5.45, 59.75, 60.95, false, 1.9);   // 서류 캐비닛 (실사)
  plane(G, new THREE.MeshBasicMaterial({ map: makeSign('정문 · 본관 · 체육관 · B1 순찰 경로', '#e8e8e0', '#2a3a4a', 16), color: 0xcfcfc4 }), 1.6, .9, 6.6, 1.6, A.z1 + .16, 0);

  // ── 열쇠보관실 (x 8.0 ~ 11.4) ──
  // 벽걸이 열쇠보관함 (H400 × W350 × D71 · 아이보리 철제 양문형 · 상단 손잡이 · 전자식 자동 잠금) — 문은 [E] 로 비밀번호를 넣으면 열리고, 창을 닫으면 저절로 닫혀 잠긴다
  const CX = 11.245, CZ = 62.8, CY = 1.45, CW = .35, CH = .40, CD = .071, ivory = S(null, { color: 0xe8e2d0, roughness: .45, metalness: .35 });
  const cabG = new THREE.Group(); G.add(cabG);
  cabG.add(boxMesh(CX - .012, CX, CY - CH / 2, CY + CH / 2, CZ - CW / 2, CZ + CW / 2, ivory, 1));   // 뒤판
  for (const [y1, y2] of [[CY - CH / 2, CY - CH / 2 + .012], [CY + CH / 2 - .012, CY + CH / 2]]) cabG.add(boxMesh(CX - CD, CX, y1, y2, CZ - CW / 2, CZ + CW / 2, ivory, 1));   // 위 · 아래판
  for (const z of [CZ - CW / 2, CZ + CW / 2 - .012]) cabG.add(boxMesh(CX - CD, CX, CY - CH / 2, CY + CH / 2, z, z + .012, ivory, 1));   // 옆판
  { const hm = S(null, { color: 0x2a2a2a, roughness: .5 }); cabG.add(boxMesh(CX - .045, CX - .03, CY + CH / 2, CY + CH / 2 + .03, CZ - .06, CZ + .06, hm, 1)); }   // 상단 손잡이
  // 안쪽: 걸이 바 3단 + 노랑 · 파랑 꼬리표 (사진처럼 가운데 단은 파랑)
  { const bar = S(null, { color: 0xb8b8b8, roughness: .3, metalness: .8 }), tagY = new THREE.MeshStandardMaterial({ color: 0xf2c418, roughness: .55 }), tagB = new THREE.MeshStandardMaterial({ color: 0x2f5fb8, roughness: .55 });
    const tg = new THREE.BoxGeometry(.004, .045, .016), N = 14, rows = [CY + .11, CY, CY - .11];
    const iy = new THREE.InstancedMesh(tg, tagY, N * 2), ib = new THREE.InstancedMesh(tg, tagB, N), m4 = new THREE.Matrix4(); let ky = 0, kb = 0;
    rows.forEach((y, r) => { cabG.add(boxMesh(CX - .03, CX - .02, y + .04, y + .046, CZ - CW / 2 + .02, CZ + CW / 2 - .02, bar, 1));
      for (let i = 0; i < N; i++) { const z = CZ - CW / 2 + .03 + i * ((CW - .06) / (N - 1)); if (r === 0 && i < ANNEX_KEYS.length) continue;   // 맨 윗단 앞자리는 이야기 열쇠
        m4.makeTranslation(CX - .022, y + .005, z); r === 1 ? ib.setMatrixAt(kb++, m4) : iy.setMatrixAt(ky++, m4); } });
    iy.count = ky; ib.count = kb; cabG.add(iy, ib); }
  // 양문: 바깥쪽 경첩에서 벽 쪽(-x)으로 열린다
  const doorM = ivory, mkDoor = (hz, dir) => { const pv = new THREE.Group(); pv.position.set(CX - CD, CY, hz); cabG.add(pv);
    const d = new THREE.Mesh(new THREE.BoxGeometry(.012, CH - .004, CW / 2 - .003), doorM); d.position.set(-.006, 0, dir * (CW / 4)); d.castShadow = true; pv.add(d); return pv; };
  const doorL = mkDoor(CZ - CW / 2, 1), doorR = mkDoor(CZ + CW / 2, -1);
  { const lk = new THREE.Mesh(new THREE.CylinderGeometry(.009, .009, .01, 12), S(null, { color: 0xc8c8c8, metalness: .9, roughness: .25 })); lk.rotation.z = Math.PI / 2; lk.position.set(-.017, .02, -.03); doorR.add(lk); }
  const pad = new THREE.Mesh(new THREE.BoxGeometry(.006, .03, .045), new THREE.MeshBasicMaterial({ color: 0xff4030 })); pad.position.set(-.015, .09, -.04); doorR.add(pad);   // 전자 잠금 표시등
  col(CX - CD - .02, CX, CZ - CW / 2, CZ + CW / 2, false, CY + CH / 2);
  const hookKeys = ANNEX_KEYS.map((k, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(.006, .05, .016), new THREE.MeshStandardMaterial({ color: k.color, metalness: .6, roughness: .35 })); m.position.set(CX - .022, CY + .115, CZ - CW / 2 + .03 + i * ((CW - .06) / 13)); cabG.add(m); return m; });
  const cabDoor = { L: doorL, R: doorR, t: 0, target: 0, set(t) { this.t = t; doorL.rotation.y = -1.9 * t; doorR.rotation.y = 1.9 * t; } };
  { const st = S(null, { color: 0x7a8288, roughness: .45, metalness: .6 });   // 앵글 철제 선반 (기둥 6 · 선반 4단) + 보관 상자 (실사 골판지 상자)
    for (const x of [8.32, 9.78, 11.22]) for (const z of [64.38, 64.78]) G.add(boxMesh(x - .02, x + .02, 0, 2.0, z - .02, z + .02, st, 1));
    for (let j = 0; j < 4; j++) { const y = .12 + j * .6; G.add(boxMesh(8.3, 11.24, y, y + .025, 64.36, 64.8, st, 1)); }
    col(8.3, 11.25, 64.35, 64.8, true);
    for (let j = 0; j < 3; j++) for (let k = 0; k < 6; k++) if ((j + k) % 4 !== 3) { const x = 8.55 + k * .46, y = .145 + j * .6; if (model) model('cardboard_box_01', x, y, 64.57, (k % 2) * Math.PI / 2 + j * .2); } }
  if (model) { model('metal_office_desk', 9.5, 0, 62.0, Math.PI / 2); model('plastic_monobloc_chair_01', 8.6, 0, 62.0, Math.PI / 2); } else G.add(boxMesh(9.0, 10.0, .72, .77, 61.6, 62.4, desk, 1)); col(9.02, 9.98, 61.0, 63.0, false, .79);

  // 소품: 벽시계 · 소화기 · 화재감지기 · 분전반 · 화분 · 휴지통 · 방범 카메라
  if (model) {
    model('wall_clock', 6.6, 2.35, A.z1 + .17, 0); model('wall_clock', 9.75, 2.35, A.z2 - .17, Math.PI);
    model('korean_fire_extinguisher_01', 7.72, 0, 60.1, -Math.PI / 2); model('korean_fire_extinguisher_01', 8.3, 0, 63.9, Math.PI / 2);
    model('fire_alarm', A.x1 + .17, 1.5, 63.6, Math.PI / 2); model('power_box_01', A.x2 - .35, 1.3, 60.4, -Math.PI / 2);
    model('potted_plant_04', 6.95, 0, 60.05, 0, { s: 2.4 });   // 소화기(7.72, 60.1)와 같은 자리에 겹쳐 있던 것 → 벽을 따라 0.75m 옆으로 model('security_camera_01', A.x1 - .12, 2.55, A.z1 + .25, -Math.PI / 4);
  }
  { const bin = new THREE.Mesh(new THREE.CylinderGeometry(.15, .12, .36, 14, 1, true), S(null, { color: 0x3a5a7a, roughness: .5, side: THREE.DoubleSide })); bin.position.set(7.75, .18, 62.9); G.add(bin); }
  // 조명 (정전 · 전원과 함께 켜고 끈다)
  const panelM = new THREE.MeshBasicMaterial({ color: 0xdfeaff });
  for (const cx of [6.4, 9.7]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .3), panelM); p.rotation.x = Math.PI / 2; p.position.set(cx, A.h - .02, 62.3); G.add(p); }
  const light = new THREE.PointLight(0xe8f0ff, 1.4, 10, 1.6); light.position.set(8.0, 2.45, 62.3); G.add(light);

  props.push({ kind: 'ganx', k: 'live', floor: 0, x: 6.45, z: 63.4, y: 1.25, r: 1.7, label: '관제실 CCTV 모니터 월 — 실시간 화면' });
  props.push({ kind: 'ganx', k: 'archive', floor: 0, x: 5.45, z: 63.45, y: 1.0, r: 1.5, label: '1998년 녹화 테이프 열람 (VCR 데크)' });
  props.push({ kind: 'ganx', k: 'ledger', floor: 0, x: 7.35, z: 63.45, y: .85, r: 1.4, label: '열쇠 대출 장부 읽기' });
  props.push({ kind: 'ganx', k: 'cabinet', floor: 0, x: 11.15, z: 62.8, y: 1.45, r: 1.4, label: '벽걸이 열쇠보관함 — 비밀번호 입력 (자동 잠금)' });
  props.push({ kind: 'ganx', k: 'lost', floor: 0, x: 9.5, z: 62.75, y: .85, r: 1.5, label: '보관실 분실물 상자 뒤지기' });
  return { group: G, screens, cabDoor, cabPad: pad, hookKeys, light, panelM };
}

// ── 당직실: (구)경비실을 철거한 자리 (x 4.8 ~ 8.25, z 64.95 ~ 67.9). 남쪽 출입문 · 근무 책상 · 경비원 의자는 예전 자리 그대로 ──
export const DUTY = Object.freeze({ x1: 4.8, x2: 8.25, z1: 64.95, z2: 67.9, h: 2.8, t: .15, doorX1: 6.55, doorX2: 7.4 });
export function buildDutyRoom({ G, props, boxMesh, plane, flat, col, S, makeSign, mats, model }) {
  const D = DUTY, wall = mats.facade, Y0 = .02;
  const W = (x1, x2, z1, z2, y1 = 0, y2 = D.h, solid = true) => { const m = boxMesh(x1, x2, y1, y2, z1, z2, wall, 2); m.castShadow = m.receiveShadow = true; G.add(m); if (solid && y1 < .5) col(x1, x2, z1, z2, true); return m; };
  const FN = finishes(); flat(G, FN.floor, D.x1, D.x2, D.z1, D.z2, Y0, 2);
  G.add(boxMesh(D.x1 - .2, D.x2 + .2, D.h, D.h + .14, D.z1 - .05, D.z2 + .25, wall, 2));
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(D.x2 - D.x1, D.z2 - D.z1), FN.ceil); ceil.rotation.x = Math.PI / 2; ceil.position.set((D.x1 + D.x2) / 2, D.h - .01, (D.z1 + D.z2) / 2); G.add(ceil);
  // 서벽 (보도 쪽 창) · 동벽 · 남벽 (출입문)
  W(D.x1, D.x1 + D.t, D.z1, 65.7); W(D.x1, D.x1 + D.t, 66.9, D.z2); W(D.x1, D.x1 + D.t, 65.7, 66.9, 0, 1.0); W(D.x1, D.x1 + D.t, 65.7, 66.9, 2.1, D.h, false);
  plane(G, mats.glass, 1.2, 1.1, D.x1 + .075, 1.55, 66.3, Math.PI / 2);
  W(D.x2 - D.t, D.x2, D.z1, D.z2);
  W(D.x1, D.doorX1, D.z2 - .11, D.z2); W(D.doorX2, D.x2, D.z2 - .11, D.z2); W(D.doorX1, D.doorX2, D.z2 - .11, D.z2, 2.1, D.h, false);
  plane(G, new THREE.MeshBasicMaterial({ map: makeSign('경비실 · 당직실', '#1e2a2e', '#d9e4d0', 28), color: 0x9aa59a }), 1.4, .3, 6.0, 2.4, D.z2 + .01, 0);
  { const T = D.t, H = D.h; finishWall(G, boxMesh, D.z1, D.z2 - .11, D.x1 + T, 'x+', H, [[65.7, 66.9, 1.0, 2.1]]); finishWall(G, boxMesh, D.z1, D.z2 - .11, D.x2 - T, 'x-', H); finishWall(G, boxMesh, D.x1 + T, D.x2 - T, D.z2 - .11, 'z-', H, [[D.doorX1, D.doorX2, 0, 2.1]]); finishWall(G, boxMesh, D.x1 + T, D.x2 - T, D.z1 + .005, 'z+', H, [[7.05, 7.9, 0, 2.1]]); }
  const wood = mats.wood, dark = S(null, { color: 0x1c1f22, roughness: .5, metalness: .3 }), metal = mats.metal;
  // 근무 책상 (예전 책상 자리 · 일지 · 모자 · 녹음기가 그 위에 놓인다) + CRT 모니터 · 전화 · 스탠드
  G.add(boxMesh(4.95, 6.45, .74, .79, 66.55, 67.6, wood, 1)); G.add(boxMesh(4.98, 5.4, 0, .74, 66.6, 67.55, wood, 1)); G.add(boxMesh(6.38, 6.43, 0, .74, 66.6, 67.55, wood, 1)); col(4.95, 6.45, 66.55, 67.6, false, .79);
  const crt = S(null, { color: 0xbdb8a8, roughness: .6 }); G.add(boxMesh(5.35, 5.95, .79, 1.25, 67.05, 67.55, crt, 1));
  plane(G, new THREE.MeshBasicMaterial({ color: 0x18301e, toneMapped: false }), .46, .34, 5.65, 1.03, 67.04, Math.PI);
  G.add(boxMesh(5.0, 5.25, .79, .86, 66.65, 66.9, S(null, { color: 0x8a2020, roughness: .5 }), 1));
  G.add(boxMesh(6.2, 6.28, .79, 1.15, 67.35, 67.43, dark, 1));
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.11, .12, .07, 16), S(null, { color: 0x222c44, roughness: .7 })); cap.position.set(6.23, .83, 67.01); G.add(cap);
  // 경비원 의자 (인트로 경비원이 앉는 자리)
  const chairM = S(null, { color: 0x3a3f46, roughness: .7 });
  G.add(boxMesh(5.52, 5.96, .44, .5, 65.88, 66.32, chairM, 1)); G.add(boxMesh(5.52, 5.96, .5, 1.0, 65.84, 65.9, chairM, 1)); G.add(boxMesh(5.71, 5.77, 0, .44, 66.07, 66.13, dark, 1));
  // 철제 사물함 (북서 구석) · 간이 찬장 + 주전자 · 소화기 · 옷걸이 + 제복
  G.add(boxMesh(4.97, 5.5, 0, 1.8, 65.0, 65.5, S(null, { color: 0x6a7a80, roughness: .5, metalness: .5 }), 1)); col(4.97, 5.5, 65.0, 65.5, false, 1.8);
  G.add(boxMesh(5.23, 5.25, .9, 1.7, 65.5, 65.51, dark, 1)); for (let k = 0; k < 5; k++) G.add(boxMesh(5.02 + k * .09, 5.07 + k * .09, 1.55, 1.565, 65.5, 65.505, dark, 1)); G.add(boxMesh(5.43, 5.46, .95, 1.05, 65.5, 65.53, S(null, { color: 0xb0b0a8, metalness: .8, roughness: .3 }), 1));   // 통풍구 · 손잡이
  G.add(boxMesh(7.45, 8.08, 0, .8, 66.75, 67.3, wood, 1)); col(7.45, 8.08, 66.75, 67.3, false, .8);
  const kettle = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, .2, 14), S(null, { color: 0xb8b8b0, metalness: .8, roughness: .3 })); kettle.position.set(7.65, .9, 67.0); G.add(kettle);
  const thermos = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .26, 12), S(null, { color: 0x2a5a3a, roughness: .5 })); thermos.position.set(7.9, .93, 67.1); G.add(thermos);
  if (model) model('korean_fire_extinguisher_01', 7.6, 0, 67.6, Math.PI); else { const ext = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .5, 12), S(null, { color: 0xc0201a, roughness: .4 })); ext.position.set(7.6, .25, 67.62); G.add(ext); }
  G.add(boxMesh(8.05, 8.1, 1.6, 1.65, 67.33, 67.6, dark, 1)); G.add(boxMesh(7.92, 8.08, .9, 1.6, 67.37, 67.57, S(null, { color: 0x233048, roughness: .8 }), 1));
  // 벽: 시계 · 1998년 달력 · 근무 교대표 · 비상연락망
  if (model) { model('wall_clock', 6.9, 2.15, D.z1 + .05, 0); model('ceiling_fan', 6.5, D.h - .02, 66.4, 0, { s: .7 }); model('potted_plant_04', 5.85, 0, 65.25, 0, { s: 2.2 }); model('fire_alarm', 6.5, 2.0, D.z1 + .03, 0); }
  else { const clock = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .04, 24), S(null, { color: 0xf0ece0, roughness: .5 })); clock.rotation.x = Math.PI / 2; clock.position.set(6.9, 2.15, D.z1 + .03); G.add(clock); }
  { const bin = new THREE.Mesh(new THREE.CylinderGeometry(.14, .11, .34, 14, 1, true), S(null, { color: 0x6a6a5a, roughness: .5, side: THREE.DoubleSide })); bin.position.set(6.62, .17, 67.55); G.add(bin); }   // 휴지통
  plane(G, new THREE.MeshBasicMaterial({ map: makeSign('1998 · 10月', '#f4efe2', '#902020', 26), color: 0xe0dbcc }), .5, .62, 6.0, 1.55, D.z1 + .02, 0);
  plane(G, new THREE.MeshBasicMaterial({ map: makeSign('근무 교대표', '#e8e8dc', '#1a2a3a', 22), color: 0xd8d8cc }), .7, .9, D.x2 - D.t - .01, 1.55, 66.3, -Math.PI / 2);
  plane(G, new THREE.MeshBasicMaterial({ map: makeSign('비상연락망', '#f0e8c8', '#3a2a1a', 22), color: 0xd8d0b4 }), .45, .6, D.x1 + D.t + .01, 1.5, 65.25, Math.PI / 2);
  // 조명
  const panelM = new THREE.MeshBasicMaterial({ color: 0x9a9890 });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(.9, .3), panelM); panel.rotation.x = Math.PI / 2; panel.position.set(6.5, D.h - .02, 66.4); G.add(panel);
  const light = new THREE.PointLight(0xffe7ba, 0, 6, 1.8); light.position.set(6.5, 2.45, 66.4); G.add(light);
  props.push({ kind: 'ganx', k: 'roster', floor: 0, x: 7.85, z: 66.3, y: 1.5, r: 1.5, label: '근무 교대표 읽기 (1998.10)' });
  props.push({ kind: 'ganx', k: 'calendar', floor: 0, x: 6.0, z: 65.25, y: 1.5, r: 1.4, label: '1998년 10월 달력 보기' });
  props.push({ kind: 'ganx', k: 'glocker', floor: 0, x: 5.24, z: 65.75, y: 1.0, r: 1.4, label: '경비원 사물함 열기' });
  props.push({ kind: 'ganx', k: 'kettle', floor: 0, x: 7.65, z: 66.55, y: .9, r: 1.3, label: '보온 주전자 만져 보기' });
  props.push({ kind: 'ganx', k: 'contacts', floor: 0, x: 5.15, z: 65.25, y: 1.5, r: 1.3, label: '비상연락망 읽기' });
  return { light, panelM };
}

// 사무용 회전의자 (5발 바퀴 받침 · 가스 실린더 · 쿠션 좌판 · 등받이)
function officeChair(G, boxMesh, S, x, z, ry = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; G.add(g);
  const blk = S(null, { color: 0x1e2024, roughness: .6, metalness: .3 }), fab = S(null, { color: 0x2c3a4c, roughness: .9 });
  for (let k = 0; k < 5; k++) { const a = k * 1.2566, m = new THREE.Mesh(new THREE.BoxGeometry(.3, .03, .04), blk); m.position.set(Math.cos(a) * .15, .07, Math.sin(a) * .15); m.rotation.y = -a; g.add(m); const w = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .03, 8), blk); w.rotation.z = Math.PI / 2; w.position.set(Math.cos(a) * .29, .025, Math.sin(a) * .29); g.add(w); }
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(.025, .03, .34, 10), blk); cyl.position.y = .25; g.add(cyl);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(.48, .08, .46), fab); seat.position.y = .46; g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(.44, .5, .06), fab); back.position.set(0, .8, -.24); back.rotation.x = -.12; g.add(back);
  const post = new THREE.Mesh(new THREE.BoxGeometry(.05, .3, .03), blk); post.position.set(0, .56, -.24); g.add(post);
}
