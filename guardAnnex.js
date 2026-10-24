// 경비동 별관: 정문 안쪽 기존 경비실 북쪽 벽에 바로 붙인 관제실 + 열쇠보관실.
// 중앙 보도(서쪽)로 출입문이 나 있고, 남쪽 벽은 경비실 북쪽 벽과 맞닿는다.
import * as THREE from './vendor/three.module.js';

export const ANNEX = Object.freeze({ x1: 4.8, x2: 11.4, z1: 59.6, z2: 64.95, h: 2.8, t: .15, xp: 8.0, doorZ1: 61.2, doorZ2: 62.2, innerZ1: 60.3, innerZ2: 61.3 });
// 키 보관함 비밀번호 = 펌프실 열쇠가 나간 시각 (대출 장부 22:50)
export const CABINET_CODE = '2250';
export const ANNEX_KEYS = [
  { id: 'main', name: '본관 열쇠', tag: '본관 숙직실 · 행정 서류함', color: '#c9a64a' },
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

export function buildGuardAnnex({ OUT, props, boxMesh, plane, flat, col, S, makeSign, mats }) {
  const A = ANNEX, G = new THREE.Group(); G.name = 'GUARD_ANNEX'; G.userData.dynamic = true; OUT.add(G);
  const wall = mats.facade, inner = mats.wall || mats.white, Y0 = .02;
  const W = (x1, x2, z1, z2, y1 = 0, y2 = A.h, mat = wall, solid = true) => { const m = boxMesh(x1, x2, y1, y2, z1, z2, mat, 2); m.castShadow = m.receiveShadow = true; G.add(m); if (solid && y1 < .5) col(x1, x2, z1, z2, true); return m; };
  // 바닥 · 지붕
  flat(G, mats.floor, A.x1, A.x2, A.z1, A.z2, Y0, 2);
  G.add(boxMesh(A.x1 - .2, A.x2 + .2, A.h, A.h + .14, A.z1 - .25, A.z2 + .2, wall, 2));
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(A.x2 - A.x1, A.z2 - A.z1), S(null, { color: 0xd6d3c8, side: THREE.DoubleSide })); ceil.rotation.x = Math.PI / 2; ceil.position.set((A.x1 + A.x2) / 2, A.h - .01, (A.z1 + A.z2) / 2); G.add(ceil);
  // 외벽 (남쪽 벽은 기존 경비실 북쪽 벽과 맞닿는다)
  W(A.x1, A.x2, A.z2 - A.t, A.z2);
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

  // ── 관제실 (x 4.8 ~ 8.0): 경비실 쪽 남벽에 콘솔 · 모니터 월 ──
  const desk = mats.wood, dark = S(null, { color: 0x1c1f22, roughness: .5, metalness: .3 });
  G.add(boxMesh(5.1, 7.75, .74, .79, 63.95, 64.75, desk, 1)); G.add(boxMesh(5.15, 7.7, 0, .74, 64.5, 64.75, dark, 1)); col(5.1, 7.75, 63.95, 64.8, false, .79);
  G.add(boxMesh(5.05, 7.8, .95, 2.5, 64.68, 64.8, dark, 1));
  const screens = [], labels = ['CAM-01 정문', 'CAM-02 본관 1F 복도', 'CAM-03 B1 복도', 'CAM-04 교무실 앞', 'CAM-05 체육관', 'CAM-06 방송실', 'CAM-07 수영장', 'CAM-08 청운학사', 'CAM-09 옥상'];
  for (let i = 0; i < 9; i++) {
    const cx = 5.55 + (i % 3) * .87, cy = 2.17 - Math.floor(i / 3) * .52;
    const m = plane(G, new THREE.MeshBasicMaterial({ map: screenTex(labels[i], i + 1), toneMapped: false }), .8, .46, cx, cy, 64.665, Math.PI);
    screens.push(m);
  }
  G.add(boxMesh(6.15, 6.75, .79, .81, 64.05, 64.25, dark, 1));
  const vcr = S(null, { color: 0x2a2c2e, roughness: .4, metalness: .4 });
  for (let k = 0; k < 3; k++) G.add(boxMesh(5.2, 5.7, .79 + k * .09, .87 + k * .09, 64.1, 64.55, vcr, 1));
  const tapeM = S(null, { color: 0x111111, roughness: .6 });
  for (let k = 0; k < 6; k++) G.add(boxMesh(5.8 + k * .04, 5.83 + k * .04, .79, .98, 64.35, 64.55, tapeM, 1));
  G.add(boxMesh(7.15, 7.5, .79, .81, 64.05, 64.3, S(null, { color: 0x6a4a2a }), 1));
  G.add(boxMesh(6.2, 6.7, .42, .48, 63.15, 63.65, dark, 1)); G.add(boxMesh(6.2, 6.7, .48, 1.0, 63.1, 63.16, dark, 1)); col(6.2, 6.7, 63.1, 63.65, false, .48);
  G.add(boxMesh(4.97, 5.45, 0, 1.32, 59.78, 60.6, mats.metal, 1)); col(4.95, 5.45, 59.75, 60.6, false, 1.32);
  plane(G, new THREE.MeshBasicMaterial({ map: makeSign('정문 · 본관 · 체육관 · B1 순찰 경로', '#e8e8e0', '#2a3a4a', 16), color: 0xcfcfc4 }), 1.6, .9, 6.6, 1.6, A.z1 + .16, 0);

  // ── 열쇠보관실 (x 8.0 ~ 11.4) ──
  const cab = S(null, { color: 0x5b6a5e, roughness: .55, metalness: .45 });
  G.add(boxMesh(10.97, 11.25, .9, 2.05, 62.0, 63.6, cab, 1)); col(10.95, 11.25, 62.0, 63.6, true);
  const pivot = new THREE.Group(); pivot.position.set(10.95, 0, 62.0); G.add(pivot);
  const cabDoor = new THREE.Mesh(new THREE.BoxGeometry(.03, 1.13, 1.58), S(null, { color: 0x6b7a6e, roughness: .5, metalness: .5 })); cabDoor.position.set(0, 1.475, .79); pivot.add(cabDoor);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(.03, .16, .1), new THREE.MeshBasicMaterial({ color: 0xff4030 })); pad.position.set(-.02, 1.5, 1.4); pivot.add(pad);
  const hookKeys = ANNEX_KEYS.map((k, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(.02, .1, .04), new THREE.MeshStandardMaterial({ color: k.color, metalness: .8, roughness: .3 })); m.position.set(10.96, 1.55, 62.3 + i * .35); G.add(m); return m; });
  G.add(boxMesh(8.3, 11.25, 0, 2.0, 64.35, 64.8, mats.metal, 1)); col(8.3, 11.25, 64.35, 64.8, true);
  const boxM = S(null, { color: 0xa88e62, roughness: .9 });
  for (let k = 0; k < 10; k++) G.add(boxMesh(8.4 + (k % 5) * .56, 8.88 + (k % 5) * .56, .4 + (k / 5 | 0) * .8, .75 + (k / 5 | 0) * .8, 64.4, 64.75, boxM, 1));
  G.add(boxMesh(9.0, 10.0, .72, .77, 61.6, 62.4, desk, 1)); col(9.0, 10.0, 61.6, 62.4, false, .77);

  // 조명 (정전 · 전원과 함께 켜고 끈다)
  const panelM = new THREE.MeshBasicMaterial({ color: 0xdfeaff });
  for (const cx of [6.4, 9.7]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .3), panelM); p.rotation.x = Math.PI / 2; p.position.set(cx, A.h - .02, 62.3); G.add(p); }
  const light = new THREE.PointLight(0xe8f0ff, 1.4, 10, 1.6); light.position.set(8.0, 2.45, 62.3); G.add(light);

  props.push({ kind: 'ganx', k: 'live', floor: 0, x: 6.45, z: 63.4, y: 1.25, r: 1.7, label: '관제실 CCTV 모니터 월 — 실시간 화면' });
  props.push({ kind: 'ganx', k: 'archive', floor: 0, x: 5.45, z: 63.45, y: 1.0, r: 1.5, label: '1998년 녹화 테이프 열람 (VCR 데크)' });
  props.push({ kind: 'ganx', k: 'ledger', floor: 0, x: 7.35, z: 63.45, y: .85, r: 1.4, label: '열쇠 대출 장부 읽기' });
  props.push({ kind: 'ganx', k: 'cabinet', floor: 0, x: 10.6, z: 62.8, y: 1.45, r: 1.6, label: '열쇠보관함 — 비밀번호 입력' });
  props.push({ kind: 'ganx', k: 'lost', floor: 0, x: 9.5, z: 62.75, y: .85, r: 1.5, label: '보관실 분실물 상자 뒤지기' });
  return { group: G, screens, cabDoor: pivot, cabPad: pad, hookKeys, light, panelM };
}
