// 금고 모형 (1990년대~2008년 한국 교무실·교장실 내화금고)
// 두꺼운 강판 몸체(모서리 둥글림) · 법랑 도장(가장자리 칠 벗겨짐 · 긁힘 · 녹) · 크롬 테두리
// 숫자 눈금 다이얼 + 인덱스 표시 · 3살 손잡이 · 열쇠 구멍 덮개 · 경첩 핀 · 무명 명판 · 받침대와 고무발
// 문은 경첩(피벗 그룹)으로 회전하며 안쪽에 선반 · 서랍 · 내용물이 있다. 텍스처/재질/지오메트리는 모듈 캐시로 공유.
// 좌표: 몸체 정면이 로컬 +x, 폭은 z(±W/2), 원점은 바닥 중앙. 피벗은 정면 -z 모서리(경첩 쪽).
import * as THREE from './vendor/three.module.js';

const C = { tex: {}, mat: {}, geo: {} };
const rand = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(9173);

function canvasTex(key, w, h, draw, srgb = true) {
  if (C.tex[key]) return C.tex[key];
  let t;
  if (typeof document === 'undefined') { t = new THREE.Texture(); }
  else { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); t = new THREE.CanvasTexture(c); }
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return (C.tex[key] = t);
}

// 법랑(에나멜) 도장: 미세 얼룩 · 붓자국 없는 소부 도장 · 모서리 쪽 벗겨짐(밑 강판 노출) · 긁힘 · 녹 점
function enamelTex(key, base) {
  return canvasTex('enamel_' + key, 256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const v = rand(); g.fillStyle = `rgba(${v < .5 ? '0,0,0' : '255,255,255'},${.01 + rand() * .018})`; const s = 2 + rand() * 6; g.fillRect(rand() * w, rand() * h, s, s); }
    // 모서리(텍스처 가장자리 = 판 가장자리) 칠 벗겨짐
    for (let i = 0; i < 70; i++) { const e = rand() * 4 | 0, t = rand() * w, d = rand() * 10; const x = e < 2 ? t : (e === 2 ? d : w - d), y = e < 2 ? (e === 0 ? d : h - d) : t;
      g.fillStyle = rand() < .5 ? 'rgba(150,150,145,.55)' : 'rgba(110,70,40,.45)'; g.beginPath(); g.ellipse(x, y, 1 + rand() * 5, 1 + rand() * 3, rand() * 3, 0, 7); g.fill(); }
    // 긁힘
    g.lineCap = 'round';
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(200,200,190,${.08 + rand() * .18})`; g.lineWidth = .6 + rand(); const x = rand() * w, y = rand() * h, a = rand() * 6.3, l = 6 + rand() * 30; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    // 녹 점 + 흘러내린 자국
    for (let i = 0; i < 14; i++) { const x = rand() * w, y = rand() * h; g.fillStyle = `rgba(120,60,25,${.25 + rand() * .3})`; g.beginPath(); g.arc(x, y, 1 + rand() * 2.5, 0, 7); g.fill(); g.fillStyle = 'rgba(110,60,30,.08)'; g.fillRect(x - 1, y, 2, 6 + rand() * 18); }
  });
}
function brushedTex() {
  return canvasTex('brushed', 128, 128, (g, w, h) => {
    g.fillStyle = '#9da2a6'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) { g.fillStyle = `rgba(${rand() < .5 ? '255,255,255' : '0,0,0'},${rand() * .12})`; g.fillRect(0, y, w, 1); }
    for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(60,50,40,.18)'; g.beginPath(); g.arc(rand() * w, rand() * h, 1 + rand() * 3, 0, 7); g.fill(); }
  });
}
// 다이얼 면: 0~99 눈금(5단위 긴 눈금, 10단위 숫자) · 크롬 바탕 위 검은 인쇄 · 손때
export function dialFaceTex() {
  return canvasTex('dial', 512, 512, (g, w) => {
    const c = w / 2, R = w / 2;
    const gr = g.createRadialGradient(c * .8, c * .7, 10, c, c, R); gr.addColorStop(0, '#e8eaec'); gr.addColorStop(.7, '#aeb2b6'); gr.addColorStop(1, '#6f7377');
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, R, 0, 7); g.fill();
    g.fillStyle = '#16181a'; g.beginPath(); g.arc(c, c, R * .62, 0, 7); g.fill();          // 안쪽 검은 손잡이 링
    g.fillStyle = '#2a2d30'; g.beginPath(); g.arc(c, c, R * .5, 0, 7); g.fill();
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(c + Math.cos(a) * R * .52, c + Math.sin(a) * R * .52); g.lineTo(c + Math.cos(a) * R * .61, c + Math.sin(a) * R * .61); g.stroke(); }   // 미끄럼 방지 홈
    g.fillStyle = '#111'; g.strokeStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 34px Arial, sans-serif';
    for (let n = 0; n < 100; n++) { const a = -Math.PI / 2 + n / 100 * Math.PI * 2, long = n % 5 === 0;
      g.lineWidth = long ? 3 : 1.6; g.beginPath(); g.moveTo(c + Math.cos(a) * R * .97, c + Math.sin(a) * R * .97); g.lineTo(c + Math.cos(a) * R * (long ? .86 : .91), c + Math.sin(a) * R * (long ? .86 : .91)); g.stroke();
      if (n % 10 === 0) { g.save(); g.translate(c + Math.cos(a) * R * .75, c + Math.sin(a) * R * .75); g.rotate(a + Math.PI / 2); g.fillText(String(n), 0, 0); g.restore(); } }
    g.fillStyle = 'rgba(60,45,30,.18)'; g.beginPath(); g.arc(c - R * .3, c + R * .2, R * .25, 0, 7); g.fill();   // 손때
  });
}
function plateTex() {
  return canvasTex('plate', 256, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#c9a65a'); gr.addColorStop(.5, '#e2c57e'); gr.addColorStop(1, '#9c7c3a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = '#5a4520'; g.lineWidth = 3; g.strokeRect(5, 5, w - 10, h - 10);
    g.fillStyle = '#3a2c12'; g.font = 'bold 22px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('耐 火 金 庫', w / 2, h / 2 - 6);
    g.font = '11px sans-serif'; g.fillText('FIRE RESISTANT · KS', w / 2, h / 2 + 16);
    for (let i = 0; i < 4; i++) { g.fillStyle = '#6a5228'; g.beginPath(); g.arc(i % 2 ? w - 12 : 12, i < 2 ? 12 : h - 12, 3, 0, 7); g.fill(); }
  });
}
function liningTex() {
  return canvasTex('lining', 128, 128, (g, w, h) => {
    g.fillStyle = '#8f8a78'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(0,0,0,${rand() * .07})`; g.fillRect(rand() * w, rand() * h, 2, 2); }
  });
}

const PALETTES = { olive: '#4a5446', grey: '#3d4247', beige: '#a49c82' };
function mats(variant) {
  const k = 'm_' + variant; if (C.mat[k]) return C.mat[k];
  const enamel = enamelTex(variant, PALETTES[variant] || PALETTES.olive);
  const m = {
    paint: new THREE.MeshStandardMaterial({ map: enamel, roughness: .58, metalness: .25 }),
    chrome: new THREE.MeshStandardMaterial({ map: brushedTex(), roughness: .28, metalness: .92 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1b1d1f, roughness: .7, metalness: .3 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x141414, roughness: .95 }),
    dial: new THREE.MeshStandardMaterial({ map: dialFaceTex(), roughness: .32, metalness: .75 }),
    plate: new THREE.MeshStandardMaterial({ map: plateTex(), roughness: .35, metalness: .8 }),
    lining: new THREE.MeshStandardMaterial({ map: liningTex(), roughness: .9 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xd8cfb8, roughness: .95 }),
    ledger: new THREE.MeshStandardMaterial({ color: 0x3a2b22, roughness: .8 }),
    ledger2: new THREE.MeshStandardMaterial({ color: 0x24344a, roughness: .8 }),
    cashbox: new THREE.MeshStandardMaterial({ color: 0x6a1e1a, roughness: .5, metalness: .4 }),
  };
  return (C.mat[k] = m);
}

// 둥근 모서리 판(익스트루드 + 베벨): w(z방향) × h(y), 두께 d(x방향) — 로컬 중심 정렬
function rslab(w, h, d, r) {
  const k = `rs_${w}_${h}_${d}_${r}`; if (C.geo[k]) return C.geo[k];
  const s = new THREE.Shape(), x0 = -w / 2 + r, y0 = -h / 2 + r, x1 = w / 2 - r, y1 = h / 2 - r;
  s.moveTo(x0, -h / 2); s.lineTo(x1, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, y0); s.lineTo(w / 2, y1); s.quadraticCurveTo(w / 2, h / 2, x1, h / 2);
  s.lineTo(x0, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, y1); s.lineTo(-w / 2, y0); s.quadraticCurveTo(-w / 2, -h / 2, x0, -h / 2);
  const b = Math.min(r * .6, d * .3);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(.001, d - 2 * b), bevelEnabled: true, bevelThickness: b, bevelSize: b * .8, bevelSegments: 2, curveSegments: 3 });
  g.translate(0, 0, -(d - 2 * b) / 2); g.rotateY(Math.PI / 2);   // 두께를 x로
  // UV를 판 크기(0..1)로 정규화 → 텍스처 가장자리 칠 벗겨짐이 판 가장자리에 오게
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w + .5, uv.getY(i) / h + .5);
  return (C.geo[k] = g);
}
const box = (k, w, h, d) => C.geo[k] || (C.geo[k] = new THREE.BoxGeometry(w, h, d));
const cyl = (k, rt, rb, h, n = 24) => C.geo[k] || (C.geo[k] = new THREE.CylinderGeometry(rt, rb, h, n));
function dialKnobGeo() {   // 선반(lathe) 다이얼: 낮은 원뿔대 + 테두리
  if (C.geo.knob) return C.geo.knob;
  const p = [[0, 0], [.064, 0], [.066, .006], [.062, .02], [.05, .024], [.036, .03], [.034, .044], [.026, .05], [0, .05]].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(p, 40); g.rotateZ(-Math.PI / 2);   // 축을 +x로
  return (C.geo.knob = g);
}

const add = (parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; };

/**
 * 금고 한 대를 만든다.
 * @param {object} o  { W:폭(z) , H:높이, D:깊이(x), variant:'olive'|'grey'|'beige', contents:true }
 * @returns {{ body: THREE.Group, piv: THREE.Group, dial: THREE.Object3D, size:{W,H,D}, hingeZ:number, frontX:number }}
 *   body: 몸체·받침·내부 (원점=바닥 중앙). piv: 문(경첩 피벗) — 호출자가 같은 부모에 두고 위치를 body와 같게(+ piv.position 은 이미 몸체 기준 오프셋).
 *   piv.rotation.y 를 0 → ~1.9 로 올리면 문이 바깥으로 열린다.
 */
export function buildSafe(o = {}) {
  const W = o.W ?? .62, H = o.H ?? .9, D = o.D ?? .6, M = mats(o.variant || 'olive'), t = .055, plinth = .06, r = .03;
  const body = new THREE.Group(); body.name = 'safeBody'; body.userData.rbKeep = true;   // rbKeep: 새 건물 정리 패스가 작은 부품을 숨기지 않게
  const y0 = plinth, hh = H - plinth, cy = y0 + hh / 2, fx = D / 2;
  // 받침대(어두운 강철) + 고무발 4
  add(body, box('plinth' + W + D, D - .04, plinth - .015, W - .04), M.dark, 0, (plinth - .015) / 2 + .015, 0);
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) add(body, cyl('foot', .025, .028, .015, 12), M.rubber, sx * (D / 2 - .06), .0075, sz * (W / 2 - .06));
  // 껍데기: 뒤판 · 좌우판 · 상판 · 바닥판 (둥근 모서리 슬래브)
  add(body, rslab(W, hh, t, r), M.paint, -fx + t / 2, cy, 0);
  const side = rslab(D, hh, t, r);
  add(body, side, M.paint, 0, cy, -W / 2 + t / 2, 0, Math.PI / 2, 0); add(body, side, M.paint, 0, cy, W / 2 - t / 2, 0, Math.PI / 2, 0);
  const top = rslab(W, D, t, r);
  add(body, top, M.paint, 0, H - t / 2, 0, 0, 0, Math.PI / 2); add(body, top, M.paint, 0, y0 + t / 2, 0, 0, 0, Math.PI / 2);
  // 정면 문틀(크롬 테두리 띠)
  const iw = W - 2 * t, ih = hh - 2 * t;
  add(body, box('fr_v' + ih, .012, ih + .02, .012), M.chrome, fx - .004, cy, -iw / 2 - .002); add(body, box('fr_v' + ih, .012, ih + .02, .012), M.chrome, fx - .004, cy, iw / 2 + .002);
  add(body, box('fr_h' + iw, .012, .012, iw + .02), M.chrome, fx - .004, y0 + t - .002, 0); add(body, box('fr_h' + iw, .012, .012, iw + .02), M.chrome, fx - .004, H - t + .002, 0);
  // 내부 내장재 · 선반(아래 큰 칸 / 위 서랍 칸)
  add(body, box('lin_b' + iw + ih, .005, ih, iw), M.lining, -fx + t + .003, cy, 0);
  const shelfY = y0 + t + ih * .42;
  add(body, box('shelf' + D + iw, D - t - .06, .012, iw), M.lining, -.03, shelfY, 0);
  const dwH = ih * .16, dwY = H - t - dwH / 2 - .005;
  add(body, box('drw' + D + iw, D - t - .08, dwH, iw * .96), M.dark, -.04, dwY, 0);           // 내부 잠금 서랍(속금고)
  add(body, box('drwf' + iw + dwH, .008, dwH * .8, iw * .9), M.paint, fx - t - .02, dwY, 0);
  add(body, cyl('drwk', .008, .008, .014, 10), M.chrome, fx - t - .01, dwY, 0, 0, 0, Math.PI / 2);
  if (o.contents !== false) {   // 내용물: 장부 2권(세워 둠) · 서류 뭉치 · 손금고(현금함)
    const sTop = shelfY + .006;
    add(body, box('ldg', .2, .24, .035), M.ledger, -.05, sTop + .12, -iw / 2 + .05);
    add(body, box('ldg', .2, .24, .035), M.ledger2, -.05, sTop + .12, -iw / 2 + .09, .05, 0, 0);
    add(body, box('pap', .2, .03, .16), M.paper, -.02, sTop + .015, iw / 2 - .12);
    add(body, box('cash', .16, .07, .12), M.cashbox, -.1, y0 + t + .035, iw / 2 - .07);
  }
  // 문 (경첩 피벗: 정면 -z 모서리)
  const piv = new THREE.Group(); piv.name = 'safeDoor'; piv.userData.rbKeep = true; piv.position.set(fx, 0, -W / 2);
  const dw = W - .012, dh = hh - .012, dt = .06, dz = W / 2;
  add(piv, rslab(dw, dh, dt, r), M.paint, dt / 2, cy, dz);
  add(piv, box('dlin' + dw, .006, dh - .08, dw - .08), M.dark, -.002, cy, dz);                 // 문 안쪽 판
  for (const yy of [-.25, 0, .25]) add(piv, cyl('bolt', .012, .012, .04, 10), M.chrome, .01, cy + yy * dh, dz + dw / 2 - .015, Math.PI / 2, 0, 0);   // 잠금 볼트
  // 문 정면 크롬 장식 테 (이중 판 느낌)
  const ow = dw - .06, oh = dh - .06;
  add(piv, box('tr_v' + oh, .006, oh, .01), M.chrome, dt + .003, cy, dz - ow / 2); add(piv, box('tr_v' + oh, .006, oh, .01), M.chrome, dt + .003, cy, dz + ow / 2);
  add(piv, box('tr_h' + ow, .006, .01, ow), M.chrome, dt + .003, cy - oh / 2, dz); add(piv, box('tr_h' + ow, .006, .01, ow), M.chrome, dt + .003, cy + oh / 2, dz);
  // 다이얼: 크롬 베젤 링 + 회전 노브(숫자 면) + 고정 인덱스 표시
  const dY = cy + dh * .17, dZ = dz + .02;
  add(piv, cyl('bezel', .078, .082, .012, 40), M.chrome, dt + .006, dY, dZ, 0, 0, Math.PI / 2);
  const dial = new THREE.Group(); dial.position.set(dt + .012, dY, dZ); piv.add(dial);
  add(dial, dialKnobGeo(), M.chrome, 0, 0, 0);
  add(dial, cyl('dface', .064, .064, .002, 48), M.dial, .0075, 0, 0, 0, 0, -Math.PI / 2).rotation.set(0, 0, -Math.PI / 2);
  add(piv, box('idx', .006, .016, .006), M.chrome, dt + .016, dY + .088, dZ);
  add(piv, box('idx2', .004, .008, .004), M.dark, dt + .02, dY + .083, dZ);
  // 3살 손잡이 (허브 + 스포크 + 볼)
  const hY = cy - dh * .08, hZ = dZ;
  add(piv, cyl('hub', .028, .032, .03, 20), M.chrome, dt + .015, hY, hZ, 0, 0, Math.PI / 2);
  for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 + Math.PI / 2, sp = add(piv, cyl('spoke', .0075, .0075, .11, 8), M.chrome, dt + .03, hY + Math.sin(a) * .055, hZ + Math.cos(a) * .055); sp.rotation.x = -a + Math.PI / 2;
    const bl = add(piv, C.geo.ball || (C.geo.ball = new THREE.SphereGeometry(.016, 12, 8)), M.dark, dt + .03, hY + Math.sin(a) * .11, hZ + Math.cos(a) * .11); }
  // 열쇠 구멍 덮개(회전식 둥근 덮개) · 명판
  add(piv, cyl('kh', .016, .016, .006, 18), M.chrome, dt + .004, hY - dh * .18, dZ, 0, 0, Math.PI / 2);
  add(piv, box('khc', .004, .022, .01), M.chrome, dt + .008, hY - dh * .18 - .012, dZ + .004, .3, 0, 0);
  const pl = add(piv, C.geo.plate || (C.geo.plate = new THREE.PlaneGeometry(.16, .04)), M.plate, dt + .004, cy + dh * .38, dZ, 0, Math.PI / 2, 0);
  // 경첩 핀 2 (몸체 모서리 바깥, 피벗 축 위)
  for (const yy of [.22, .78]) { add(piv, cyl('hinge', .014, .014, .09, 12), M.chrome, .0, y0 + hh * yy, -.006); add(piv, cyl('hcap', .007, .009, .012, 10), M.chrome, 0, y0 + hh * yy + .05, -.006); }
  void pl;
  return { body, piv, dial, size: { W, H, D }, frontX: fx };
}

// 열기 애니메이션 보간(ease-out)
export const SAFE_OPEN_ANGLE = 1.95;
