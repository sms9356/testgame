// 2008년 10월 밤 · 서린동 동네 (학교 담장 바깥 배경): 담 너머 네 방향 거리 · 보도 · 연석 · 횡단보도 · 전봇대(엉킨 전선 · 변압기) · 나트륨 가로등 ·
//   3~5층 상가(1층 분식집 · 문구점 · PC방 · 세탁소 · 슈퍼 · 2~3층 학원 간판) · 빌라/다세대(옥상 물탱크 · 위성 안테나) · 놀이터 · 서린동 버스 정류장 ·
//   주차된 2008년식 차 · 오토바이 · 은행나무/플라타너스 가로수(10월 단풍) · 먼 아파트 단지(불 켜진 창 무작위) · 산 능선 · 도시 불빛.
//   ── 상호작용 없는 배경: 충돌 상자 없음(플레이어는 기존 보이지 않는 벽 안) · 진짜 조명 없음(나트륨 빛은 정점 속성으로 구움 + 가산 바닥 웅덩이) ·
//      구역(동서남북 × 앞줄/뒷줄)마다 재질별로 합친 메시 몇 개 · 거리 컬링 · 저사양(low/igpu)은 뒷줄 빌라를 끄고 컬링 거리를 줄인다.
import * as THREE from './vendor/three.module.js';
import { SET } from './settings.js';

let seed = 20081012 ^ 0x5e11;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const rr = (a, b) => a + rnd() * (b - a), pick = a => a[rnd() * a.length | 0];
const hex = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const jit = (c, k = .08) => { const f = 1 + (rnd() - .5) * 2 * k; return [c[0] * f, c[1] * f, c[2] * f]; };
const BAY = 3, FH = 3, TL = 16, SHOP_H = 3.4;
const BLANK = [.0006, .0006];
const FONT = '"Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR","NanumGothic",sans-serif';

// ── 정점 버퍼 모음 (재질 하나 = 버퍼 하나) ──
class Buf {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.i = []; }
  get empty() { return !this.i.length; }
  quad(v, n, uv, col) { const b = this.p.length / 3; for (let k = 0; k < 4; k++) { this.p.push(...v[k]); this.n.push(...n); this.c.push(...col); } this.u.push(...uv); this.i.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  // 수평 법선 n 인 벽면: 바깥에서 볼 때 L(왼쪽 아래) → R. uv = [u0,v0,u1,v1]
  wall(L, R, y1, y2, n, uv, col) { this.quad([[L[0], y1, L[1]], [R[0], y1, R[1]], [R[0], y2, R[1]], [L[0], y2, L[1]]], [n[0], 0, n[1]], [uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]], col); }
  top(x1, x2, z1, z2, y, uv, col) { const [a, b, c, d] = uv; this.quad([[x1, y, z2], [x2, y, z2], [x2, y, z1], [x1, y, z1]], [0, 1, 0], [a, b, c, b, c, d, a, d], col); }
  box(x1, x2, y1, y2, z1, z2, col, uv = [BLANK[0], BLANK[1], BLANK[0], BLANK[1]]) {
    faces(x1, x2, z1, z2).forEach(([L, R, n]) => this.wall(L, R, y1, y2, n, uv, col));
    this.top(x1, x2, z1, z2, y2, uv, col);
  }
  geo(g, m, col, uv = BLANK) {
    const G = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(m), P = G.attributes.position, N = G.attributes.normal, b = this.p.length / 3;
    for (let k = 0; k < P.count; k++) { this.p.push(P.getX(k), P.getY(k), P.getZ(k)); this.n.push(N.getX(k), N.getY(k), N.getZ(k)); this.u.push(uv[0], uv[1]); this.c.push(...col); this.i.push(b + k); }
    G.dispose();
  }
  build(lamps) {
    const g = new THREE.BufferGeometry(), P = this.p, cnt = P.length / 3, glow = new Float32Array(cnt);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let k = 0; k < cnt; k++) { const x = P[k * 3], z = P[k * 3 + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    lamps = lamps.filter(L => L[0] > x0 - 30 && L[0] < x1 + 30 && L[2] > z0 - 30 && L[2] < z1 + 30);
    for (let k = 0; k < cnt; k++) {
      const x = P[k * 3], y = P[k * 3 + 1], z = P[k * 3 + 2]; let s = 0;
      for (const L of lamps) { const dx = x - L[0], dz = z - L[2]; if (dx * dx + dz * dz > 900) continue; const dy = y - L[1], d2 = dx * dx + dy * dy + dz * dz; s += 1.1 / (1 + d2 / 30); }
      glow[k] = Math.min(1, s);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1)); g.setIndex(cnt > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox(); return g;
  }
}
// AABB 네 옆면: [L, R, n] (바깥에서 볼 때 왼쪽 → 오른쪽)
const faces = (x1, x2, z1, z2) => [[[x2, z1], [x1, z1], [0, -1]], [[x1, z2], [x2, z2], [0, 1]], [[x1, z1], [x1, z2], [-1, 0]], [[x2, z2], [x2, z1], [1, 0]]];

// 나트륨 빛 굽기: 정점의 aGlow 만큼 주황빛을 스스로 낸다 (+ 아주 약한 바탕 빛)
function glowPatch(m, amb) {
  m.onBeforeCompile = s => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float aGlow;\nvarying float vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * (${amb.toFixed(3)} + vGlow * vec3(.8, .45, .18));`);
  };
  m.customProgramCacheKey = () => 'hood08_' + amb;
  return m;
}
// 먼 배경: 안개를 일부만 먹인다 (완전히 지워지지 않게 · 실루엣에 공기 원근)
function partialFog(m, cap) {
  m.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <fog_fragment>', `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float hoodFog = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float hoodFog = smoothstep( fogNear, fogFar, vFogDepth );
  #endif
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, min( hoodFog, ${cap.toFixed(2)} ) );
#endif`); };
  m.customProgramCacheKey = () => 'hood08fog' + cap; return m;
}
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const ctex = (c, rep) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };

// 외벽 타일: 16 칸 × 16 층 (칸 3m · 층 3m) · 창마다 무작위로 불 (형광등 · 백열등 · TV · 커튼)
function facadeTextures(far) {
  const C = far ? 32 : 64, W = C * TL, [cm, gm] = canvas(W, W), [ce, ge] = canvas(W, W);
  gm.fillStyle = far ? '#121722' : '#d6d1c6'; gm.fillRect(0, 0, W, W); ge.fillStyle = '#000'; ge.fillRect(0, 0, W, W);
  if (!far) for (let k = 0; k < 900; k++) { gm.fillStyle = `rgba(${rnd() < .5 ? '40,36,30' : '255,250,240'},${rr(.03, .09)})`; gm.fillRect(rnd() * W, rnd() * W, rr(4, 40), rr(4, 60)); }
  for (let r = 0; r < TL; r++) for (let c = 0; c < TL; c++) {
    const x0 = c * C, y0 = r * C;
    gm.fillStyle = far ? 'rgba(0,0,0,.25)' : 'rgba(60,56,50,.25)'; gm.fillRect(x0, y0 + C - C * .08, C, C * .08);   // 층 슬래브 띠
    if (rnd() < (far ? .05 : .08)) continue;   // 창 없는 칸
    const wx = x0 + C * .15, wy = y0 + C * .2, ww = C * .7, wh = C * .5, t = rnd();
    const lit = t < (far ? .22 : .3), col = lit ? pick(['#ffcf8a', '#ffd9a0', '#e4f0ff', '#d8ecff', '#ffbf70', '#9fb8ff', '#c8955a']) : null;
    if (!far) { gm.fillStyle = '#86837c'; gm.fillRect(wx - 2, wy - 2, ww + 4, wh + 4); }
    gm.fillStyle = lit ? col : (far ? '#0a0d13' : pick(['#1a2028', '#20262e', '#2a2f34'])); gm.fillRect(wx, wy, ww, wh);
    if (lit) {
      ge.fillStyle = col; ge.fillRect(wx, wy, ww, wh);
      if (rnd() < .45) { const cw = ww * rr(.25, .5); [gm, ge].forEach(g => { g.fillStyle = 'rgba(70,40,20,.55)'; g.fillRect(wx, wy, cw, wh); }); }   // 커튼
    }
    if (!far) { gm.fillStyle = 'rgba(0,0,0,.45)'; gm.fillRect(wx + ww / 2 - 1, wy, 2, wh); ge.fillStyle = 'rgba(0,0,0,.5)'; ge.fillRect(wx + ww / 2 - 1, wy, 2, wh); }
    if (!far && rnd() < .25) { gm.fillStyle = '#5c5a56'; gm.fillRect(wx - 3, wy + wh * .55, ww + 6, 3); for (let k = 0; k < 6; k++) gm.fillRect(wx + k * ww / 5 - 1, wy + wh * .55, 2, wh * .47); }   // 방범창
  }
  // 왼쪽 아래 한 점 = 무늬 없는 벽 (지붕 · 옆벽에 쓴다)
  gm.fillStyle = far ? '#121722' : '#cfcabf'; gm.fillRect(0, W - 8, 8, 8); ge.fillStyle = '#000'; ge.fillRect(0, W - 8, 8, 8);
  return [ctex(cm, true), far ? null : ctex(ce, true)];
}

// 가게 간판 · 학원 간판 · 정류장 표지 아틀라스 (4 × 8 칸, 칸 256 × 128)
const SHOPS = [
  ['서린분식', '떡볶이 · 김밥 · 라면', '#d9442c', '#fff6dc', 1], ['꿈나라문구', '문구 · 완구 · 학습준비물', '#1f5fae', '#ffffff', 0], ['별빛 PC방', '24시 · 초고속 광랜', '#2a1a5a', '#7ff0ff', 1],
  ['깨끗한 세탁소', '세탁 · 수선 · 드라이', '#2c7a4a', '#ffffff', 0], ['서린 슈퍼', '담배 · 생필품 · 주류', '#e0a020', '#2a1a10', 1], ['바삭 통닭', '배달 환영', '#f0c030', '#b01810', 1],
  ['한빛 부동산', '매매 · 전세 · 월세', '#20406a', '#f0f0e8', 0], ['미소 미용실', '커트 · 파마', '#c23a7a', '#ffffff', 0], ['서린 약국', '', '#2a8a3a', '#ffffff', 0],
  ['노래연습장', '휴게음식점', '#7a1a8a', '#ffe060', 1], ['열쇠 · 도장', '', '#5a5048', '#f6e8c0', 0], ['우리 식당', '백반 · 찌개', '#8a3a1a', '#fff0d0', 0],
  ['비디오 · 만화', '도서대여', '#1a5a6a', '#ffffff', 1], ['호프 · 소주', '', '#c86418', '#fff8e0', 1], ['동네 철물', '', '#3a4a5a', '#e8e8e0', 0], ['서린 떡집', '', '#6a8a2a', '#ffffff', 0],
];
const UPPER = [['한빛 수학학원', '#0d3c8a', '#ffffff'], ['영어 전문학원', '#b0181c', '#ffffff'], ['태권도장', '#1a1a1a', '#ffd040'], ['피아노 교습소', '#f2efe6', '#1a2a6a'], ['독서실', '#2a6a3a', '#ffffff'],
  ['서린 치과', '#ffffff', '#0a5aa0'], ['당구장', '#1a5a2a', '#ffffff'], ['컴퓨터 학원', '#20306a', '#7ff0ff'], ['내과 의원', '#ffffff', '#1a7a3a'], ['보습학원', '#e86a10', '#ffffff']];
const CELL = { shop0: 0, upper0: 16, bus: 26, ad: 27, sodium: 28, glass: 29, sign: 30 };
function shopTextures() {
  const CW = 256, CH = 128, [cm, gm] = canvas(CW * 4, CH * 8), [ce, ge] = canvas(CW * 4, CH * 8);
  const cell = (k, fn) => { const x = (k % 4) * CW, y = (k / 4 | 0) * CH; [[gm, 0], [ge, 1]].forEach(([g, em]) => { g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, CW, CH); g.clip(); fn(g, em); g.restore(); }); };
  const text = (g, t, x, y, px, col, w) => { g.font = `bold ${px}px ${FONT}`; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; const m = g.measureText(t).width; g.save(); g.translate(x, y); if (m > w) g.scale(w / m, 1); g.fillText(t, 0, 0); g.restore(); };
  SHOPS.forEach(([name, sub, bg, fg, open], k) => cell(CELL.shop0 + k, (g, em) => {
    g.fillStyle = bg; g.fillRect(0, 0, CW, 50); text(g, name, CW / 2, sub ? 21 : 26, 30, fg, CW - 20); if (sub) text(g, sub, CW / 2, 42, 13, fg, CW - 30);
    if (!open) { g.fillStyle = em ? 'rgba(0,0,0,.72)' : 'rgba(0,0,0,.25)'; g.fillRect(0, 0, CW, 50); }
    if (open) {
      const gr = g.createLinearGradient(0, 50, 0, CH); gr.addColorStop(0, '#fff2c8'); gr.addColorStop(1, '#d8b070'); g.fillStyle = gr; g.fillRect(0, 50, CW, CH - 50);
      g.fillStyle = 'rgba(80,50,30,.55)'; for (let s = 0; s < 4; s++) g.fillRect(10 + s * 60 + rnd() * 10, 64 + rnd() * 20, 30 + rnd() * 18, 40 + rnd() * 20);   // 진열대 · 손님 그림자
      g.fillStyle = '#3a3a3a'; for (let s = 0; s <= 4; s++) g.fillRect(s * CW / 4 - 2, 50, 4, CH - 50); g.fillRect(0, 50, CW, 4);
    } else {
      g.fillStyle = em ? '#000' : '#4e5052'; g.fillRect(0, 50, CW, CH - 50);
      if (!em) { g.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 54; y < CH; y += 5) g.fillRect(0, y, CW, 1.5); g.fillStyle = 'rgba(200,200,190,.25)'; g.font = `bold 13px ${FONT}`; g.fillText(pick(['임대 문의', '정기 휴일', '', '']), CW / 2, 100); }
    }
  }));
  UPPER.forEach(([name, bg, fg], k) => cell(CELL.upper0 + k, (g, em) => { g.fillStyle = bg; g.fillRect(0, 0, CW, CH); g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(6, 6, CW - 12, CH - 12); text(g, name, CW / 2, CH / 2 + 2, 46, fg, CW - 30); if (em && rnd() < .3) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, CW, CH); } }));
  cell(CELL.bus, (g) => { g.fillStyle = '#1d4f9c'; g.fillRect(0, 0, CW, CH); g.fillStyle = '#ffffff'; g.fillRect(0, 70, CW, 58); text(g, '서린동', CW / 2, 30, 40, '#ffffff', CW - 20); text(g, '버스 정류장', CW / 2, 58, 16, '#d8e6ff', CW); text(g, '마을02 · 351 · 6614', CW / 2, 98, 22, '#1d4f9c', CW - 20); });
  cell(CELL.ad, (g) => { const gr = g.createLinearGradient(0, 0, 0, CH); gr.addColorStop(0, '#f6f2e6'); gr.addColorStop(1, '#d8e6f0'); g.fillStyle = gr; g.fillRect(0, 0, CW, CH); text(g, '겨울방학 특강', CW / 2, 36, 30, '#b01818', CW - 20); text(g, '수강생 모집', CW / 2, 74, 26, '#1a2a6a', CW - 20); text(g, '한빛 보습학원 ☎ 000-0000', CW / 2, 108, 14, '#333', CW - 20); });
  cell(CELL.sodium, (g) => { g.fillStyle = '#ffc070'; g.fillRect(0, 0, CW, CH); });
  cell(CELL.glass, (g, em) => { g.fillStyle = em ? '#000' : '#2a3440'; g.fillRect(0, 0, CW, CH); });
  cell(CELL.sign, (g) => { g.fillStyle = '#f2f0e8'; g.fillRect(0, 0, CW, CH); });
  return [ctex(cm), ctex(ce)];
}
const cellUV = k => { const c = k % 4, r = k / 4 | 0, e = .002; return [c / 4 + e, 1 - (r + 1) / 8 + e, (c + 1) / 4 - e, 1 - r / 8 - e]; };
const cellPt = k => { const [a, b, c, d] = cellUV(k), u = (a + c) / 2, v = (b + d) / 2; return [u, v, u, v]; };

// 둥근 빛 웅덩이 · 후광
function radialTex(inner = 'rgba(255,255,255,1)') { const [c, g] = canvas(128, 128), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(.35, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return ctex(c); }

export function installNeighborhood({ scene, camera }) {
  const t0 = performance.now();
  const [fMap, fEm] = facadeTextures(false), [farMap] = facadeTextures(true), [sMap, sEm] = shopTextures(), poolTex = radialTex(), haloTex = radialTex();
  const M = {
    props: glowPatch(new THREE.MeshLambertMaterial({ vertexColors: true, userData: { surface: 'asphalt' } }), .1),   // 발소리: 담장 너머 차도 · 보도
    facade: glowPatch(new THREE.MeshLambertMaterial({ vertexColors: true, map: fMap, emissiveMap: fEm, emissive: 0xffffff, emissiveIntensity: .95 }), .1),
    shop: glowPatch(new THREE.MeshLambertMaterial({ vertexColors: true, map: sMap, emissiveMap: sEm, emissive: 0xffffff, emissiveIntensity: .9 }), .05),
    pool: new THREE.MeshBasicMaterial({ map: poolTex, color: 0x8a5420, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    halo: new THREE.PointsMaterial({ map: haloTex, color: 0xffa040, size: 3.2, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .55 }),
    wire: new THREE.LineBasicMaterial({ color: 0x0c0c0e }),
    far: partialFog(new THREE.MeshBasicMaterial({ map: farMap }), .55),
  };
  const root = new THREE.Group(); root.name = 'NEIGHBORHOOD_2008'; Object.assign(root.userData, { rbKeep: true, facKeep: true, facNew: true, hood08: true });
  const lamps = [], chunks = [], footprints = [];
  const chunk = (name, detail) => { const c = { name, detail, props: new Buf(), facade: new Buf(), shop: new Buf(), pools: new Buf(), halos: [], wires: [] }; chunks.push(c); return c; };
  const mat4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), Sc = new THREE.Vector3();
  const tr = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => mat4.compose(V.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz, 'YXZ')), Sc.set(sx, sy, sz));
  const G = {
    cyl: new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, .5, 0), cyl12: new THREE.CylinderGeometry(1, 1, 1, 12).translate(0, .5, 0), pole: new THREE.CylinderGeometry(.14, .2, 1, 8).translate(0, .5, 0),
    box: new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0), wheel: new THREE.CylinderGeometry(1, 1, 1, 10).rotateZ(Math.PI / 2),
    crown: new THREE.IcosahedronGeometry(1, 0), dish: new THREE.SphereGeometry(1, 10, 4, 0, Math.PI * 2, 0, .6),
  };

  // ── 공용 색 ──
  const C = {
    asph: hex(0x232427), walk: hex(0x7d776e), curb: hex(0xa29e94), stripe: hex(0xcfcdc4), yellow: hex(0xb89a2a), conc: hex(0x8e8a82), pad: hex(0x34332f),
    poleC: hex(0x8a877f), arm: hex(0x3e3e3c), trans: hex(0x6d7275), trunk: hex(0x3a2e24), sand: hex(0x9c8866), green: hex(0x2f6a3e), red: hex(0xa8302a), blue: hex(0x2a5aa0),
    tire: hex(0x161616), glass: hex(0x14181d), steel: hex(0x4a5054),
  };
  const ROOF = [hex(0x7d7a74), hex(0x6a6e6a), hex(0x5f6a64), hex(0x8a8070)];
  const TINT_SHOP = [hex(0xffffff), hex(0xe8e2d8), hex(0xd8dce0), hex(0xf0e6d0), hex(0xc8c4be)];
  const TINT_VILLA = [hex(0xb07a62), hex(0xa06a56), hex(0xc49a80), hex(0xe8e0d4), hex(0x9a8a7c), hex(0xd0c4b0)];
  const LEAF = [hex(0xc89a18), hex(0xd2a828), hex(0xb08818), hex(0x9a9428), hex(0x7a8a2a)], PLANE = [hex(0x8a5a26), hex(0x7a5a24), hex(0x6a6a30), hex(0x9a6a2a)];
  const CAR = [hex(0xc8cacc), hex(0xe8e8e4), hex(0x1c1e22), hex(0x2a3550), hex(0x5a1e22), hex(0x8a8e92), hex(0x3a4a3a), hex(0xd8d0b8)];

  // ── 거리 요소 ──
  const flat = (ch, x1, x2, z1, z2, y, col) => ch.props.top(x1, x2, z1, z2, y, [BLANK[0], BLANK[1], BLANK[0], BLANK[1]], col);
  const walk = (ch, x1, x2, z1, z2) => { ch.props.box(x1, x2, 0, .14, z1, z2, jit(C.walk, .03)); };
  const curbX = (ch, x, z1, z2) => ch.props.box(x - .1, x + .1, 0, .17, z1, z2, C.curb), curbZ = (ch, z, x1, x2) => ch.props.box(x1, x2, 0, .17, z - .1, z + .1, C.curb);
  const crosswalk = (ch, x1, x2, z1, z2, alongX) => { if (alongX) for (let x = x1; x < x2 - .3; x += .9) flat(ch, x, x + .45, z1, z2, .02, C.stripe); else for (let z = z1; z < z2 - .3; z += .9) flat(ch, x1, x2, z, z + .45, .02, C.stripe); };
  // 전봇대 + 가로등 팔 + 변압기. sx,sz = 길(전선) 방향 · ox,oz = 차도 쪽 방향
  const pole = (ch, x, z, sx, sz, ox, oz, k, lamp = true) => {
    const P = ch.props; P.geo(G.pole, tr(x, 0, z, 0, 1, 10.5, 1), jit(C.poleC, .05));
    const ry = Math.atan2(sx, sz);
    P.geo(G.box, tr(x, 9.6, z, ry, 2.4, .12, .12), C.arm); P.geo(G.box, tr(x, 8.7, z, ry, 1.6, .1, .1), C.arm);
    if (k % 2 === 0) { const tx = x - ox * .45, tz = z - oz * .45; P.geo(G.cyl12, tr(tx, 6.9, tz, 0, .36, 1.15, .36), C.trans); P.geo(G.cyl12, tr(tx + sx * .8, 6.9, tz + sz * .8, 0, .3, .95, .3), C.trans); }
    if (k % 3 === 1) P.geo(G.box, tr(x, 2.2, z, ry, .34, .55, .2), hex(0x9a9690));   // 전주 번호판 · 광고 전단 띠
    if (lamp) {
      const hx = x + ox * 1.9, hz = z + oz * 1.9; P.geo(G.box, tr(x + ox * .95, 7.55, z + oz * .95, Math.atan2(ox, oz), .08, .08, 1.9), C.arm);
      ch.shop.geo(G.box, tr(hx, 7.35, hz, Math.atan2(ox, oz), .32, .16, .6), [1, 1, 1], cellPt(CELL.sodium));
      lamps.push([hx, 7.3, hz]); ch.halos.push(hx, 7.25, hz);
      const r = 6.5; ch.pools.top(hx - r, hx + r, hz - r, hz + r, .16, [0, 0, 1, 1], [1, 1, 1]);
    }
    return [x, z, ry];
  };
  // 엉킨 전선: 전봇대 줄 사이 · 처짐 · 건물로 내려가는 인입선
  const sag = (ch, a, b, s, seg = 6) => { for (let k = 0; k < seg; k++) { const t0 = k / seg, t1 = (k + 1) / seg, y = t => a[1] + (b[1] - a[1]) * t - s * 4 * t * (1 - t); ch.wires.push(a[0] + (b[0] - a[0]) * t0, y(t0), a[2] + (b[2] - a[2]) * t0, a[0] + (b[0] - a[0]) * t1, y(t1), a[2] + (b[2] - a[2]) * t1); } };
  const wireRun = (ch, poles, ox, oz) => {
    for (let k = 0; k < poles.length - 1; k++) {
      const [x1, z1, r1] = poles[k], [x2, z2] = poles[k + 1], px = Math.cos(r1), pz = -Math.sin(r1);
      [[-1.1, 9.62], [0, 9.62], [1.1, 9.62], [-.7, 8.72], [.7, 8.72], [.2, 7.9], [-.25, 7.6]].forEach(([o, y], j) => sag(ch, [x1 + px * o, y, z1 + pz * o], [x2 + px * o + rr(-.15, .15), y, z2 + pz * o], rr(.35, .9) + j * .08, 7));
      for (let d = 0; d < 2 + (rnd() * 3 | 0); d++) { const t = rr(.15, .85), bx = x1 + (x2 - x1) * t - ox * rr(5, 9), bz = z1 + (z2 - z1) * t - oz * rr(5, 9); sag(ch, [x1, rr(7.4, 8.6), z1], [bx, rr(5.5, 8.5), bz], rr(.2, .6), 5); }
      if (rnd() < .5) { const t = rr(.3, .7), cx = x1 + (x2 - x1) * t, cz = z1 + (z2 - z1) * t; for (let q = 0; q < 8; q++) { const a = q / 8 * 6.28, b = (q + 1) / 8 * 6.28; ch.wires.push(cx + Math.cos(a) * .35 * px, 7.4 + Math.sin(a) * .35, cz + Math.cos(a) * .35 * pz, cx + Math.cos(b) * .35 * px, 7.4 + Math.sin(b) * .35, cz + Math.cos(b) * .35 * pz); } }   // 감아 둔 여유 통신선
    }
  };
  const tree = (ch, x, z, ginkgo) => {
    const s = rr(.85, 1.2), h = rr(3.0, 3.8) * s, base = pick(ginkgo ? LEAF : PLANE);
    ch.props.geo(G.cyl, tr(x, 0, z, 0, .13 * s, h + .8, .13 * s), C.trunk);
    const n = ginkgo ? 4 : 3;
    for (let k = 0; k < n; k++) { const a = rnd() * 6.28, r = (ginkgo ? .55 : .9) * s, y = h + (ginkgo ? .5 + k * .75 : .6 + rnd() * .7) * s, sc = (ginkgo ? 1.25 - k * .2 : 1.2) * s;
      ch.props.geo(G.crown, tr(x + Math.cos(a) * r * (k ? 1 : .3), y, z + Math.sin(a) * r * (k ? 1 : .3), rnd() * 6, sc, sc * (ginkgo ? 1.0 : .8), sc), jit(base, .14)); }
  };
  // 2008년식 승용차 · 승합차 · 1톤 트럭 · 배달 오토바이 (길 방향 ry)
  const vehicle = (ch, x, z, ry, kind = rnd()) => {
    const P = ch.props, c = pick(CAR), cs = Math.cos(ry), sn = Math.sin(ry), at = (f, s) => [x + sn * f + cs * s, z + cs * f - sn * s];
    const wheels = (fb, sw, r) => [[fb, sw], [fb, -sw], [-fb, sw], [-fb, -sw]].forEach(([f, s]) => { const [wx, wz] = at(f, s); P.geo(G.wheel, tr(wx, r, wz, ry, .22, r, r), C.tire); });
    if (kind < .62) { P.geo(G.box, tr(x, .32, z, ry, 1.72, .7, 4.5), c); const [cx, cz] = at(-.2, 0); P.geo(G.box, tr(cx, 1.0, cz, ry, 1.56, .52, 2.3), C.glass); P.geo(G.box, tr(cx, 1.5, cz, ry, 1.5, .05, 2.0), c); wheels(1.45, .78, .32); }
    else if (kind < .78) { P.geo(G.box, tr(x, .3, z, ry, 1.45, 1.55, 3.4), c); const [fx, fz] = at(1.55, 0); P.geo(G.box, tr(fx, 1.0, fz, ry, 1.35, .55, .32), C.glass); wheels(1.1, .66, .28); }
    else if (kind < .9) { const blue = hex(0x2a4a8a); const [fx, fz] = at(1.7, 0); P.geo(G.box, tr(fx, .35, fz, ry, 1.7, 1.6, 1.5), blue); const [gx, gz] = at(2.3, 0); P.geo(G.box, tr(gx, 1.1, gz, ry, 1.55, .6, .25), C.glass); const [bx, bz] = at(-.9, 0); P.geo(G.box, tr(bx, .7, bz, ry, 1.7, .35, 3.0), C.steel); wheels(1.5, .75, .33); }
    else { P.geo(G.box, tr(x, .3, z, ry, .35, .45, 1.5), pick([hex(0xa82a20), hex(0x2a2a2a), hex(0xd8d4c8)])); const [bx, bz] = at(-.55, 0); P.geo(G.box, tr(bx, .75, bz, ry, .5, .45, .5), hex(0xb02018)); const [hx, hz] = at(.6, 0); P.geo(G.box, tr(hx, .95, hz, ry, .6, .06, .06), C.arm); wheels(.55, 0, .22); }
  };

  // ── 건물 ──
  // AABB · 정면 법선 fn · 1층 상가 여부. 정면 이외 옆벽은 창 없는 벽(맞벽), 빌라는 사방에 창
  const building = (ch, x1, x2, z1, z2, floors, o) => {
    const H = (o.shop ? SHOP_H : 0) + floors * FH, tint = o.tint, F = ch.facade, uo = (rnd() * TL | 0) / TL, vo = (rnd() * TL | 0) / TL;
    footprints.push([x1, x2, z1, z2]);
    for (const [L, R, n] of faces(x1, x2, z1, z2)) {
      const front = n[0] === o.fn[0] && n[1] === o.fn[1], len = Math.hypot(R[0] - L[0], R[1] - L[1]), win = front || o.allWin || (rnd() < .35 && !o.shop);
      const y0 = front && o.shop ? SHOP_H : 0;
      const uv = win ? [uo, vo, uo + len / BAY / TL, vo + (H - y0) / FH / TL] : [BLANK[0], BLANK[1], BLANK[0], BLANK[1]];
      F.wall(L, R, y0, H, n, uv, win ? tint : jit(tint, .04));
      if (front && o.shop) {   // 1층 가게: 폭 6~9m 마다 한 칸
        const nShop = Math.max(1, Math.round(len / rr(6, 9)));
        for (let s = 0; s < nShop; s++) {
          const a = s / nShop, b = (s + 1) / nShop, l = [L[0] + (R[0] - L[0]) * a + n[0] * .02, L[1] + (R[1] - L[1]) * a + n[1] * .02], r = [L[0] + (R[0] - L[0]) * b + n[0] * .02, L[1] + (R[1] - L[1]) * b + n[1] * .02];
          ch.shop.wall(l, r, 0, SHOP_H, n, cellUV(CELL.shop0 + (o.shopIdx = (o.shopIdx ?? (rnd() * 16 | 0)) + 1) % 16), [1, 1, 1]);
          if (rnd() < .35) { const ax = (l[0] + r[0]) / 2 + n[0] * .6, az = (l[1] + r[1]) / 2 + n[1] * .6; ch.props.geo(G.box, tr(ax, SHOP_H - .45, az, Math.atan2(n[0], n[1]), Math.hypot(r[0] - l[0], r[1] - l[1]) * .9, .08, 1.2, -.35), pick([C.red, C.green, C.blue, hex(0xc8a020)])); }   // 차양
        }
        // 2~3층 학원 · 병원 간판
        if (floors >= 2 && rnd() < .8) { const a = rr(.1, .45), b = a + rr(.3, .5), yb = SHOP_H + rr(.3, .9) + (rnd() < .4 ? FH : 0); const l = [L[0] + (R[0] - L[0]) * a + n[0] * .06, L[1] + (R[1] - L[1]) * a + n[1] * .06], r = [L[0] + (R[0] - L[0]) * b + n[0] * .06, L[1] + (R[1] - L[1]) * b + n[1] * .06]; ch.shop.wall(l, r, yb, yb + 1.1, n, cellUV(CELL.upper0 + (rnd() * UPPER.length | 0)), [1, 1, 1]); }
      }
    }
    F.top(x1, x2, z1, z2, H, [BLANK[0], BLANK[1], BLANK[0], BLANK[1]], pick(ROOF));
    // 옥상: 난간 · 물탱크 · 위성 안테나 · 옥탑
    const P = ch.props, cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, w = x2 - x1, d = z2 - z1;
    P.box(x1, x2, H, H + .9, z1, z1 + .15, ROOF[0]); P.box(x1, x2, H, H + .9, z2 - .15, z2, ROOF[0]); P.box(x1, x1 + .15, H, H + .9, z1, z2, ROOF[0]); P.box(x2 - .15, x2, H, H + .9, z1, z2, ROOF[0]);
    if (rnd() < (o.shop ? .55 : .9)) { const tx = cx + rr(-w / 4, w / 4), tz = cz + rr(-d / 4, d / 4); P.geo(G.box, tr(tx, H, tz, 0, 1.6, .5, 1.6), C.steel); P.geo(G.cyl12, tr(tx, H + .5, tz, 0, .8, rr(1.2, 1.6), .8), pick([hex(0xd8b030), hex(0x3a6aa8), hex(0xb8bcc0), hex(0x5a8a6a)])); }
    if (rnd() < (o.shop ? .35 : .7)) { const sx = x1 + .8 + rnd() * (w - 1.6), sz = z1 + .8 + rnd() * (d - 1.6); P.geo(G.dish, tr(sx, H + 1.0, sz, rnd() * 6, .42, .42, .42, -1.1), hex(0xe2e2dc)); P.geo(G.cyl, tr(sx, H, sz, 0, .03, 1, .03), C.steel); }
    if (rnd() < .45) { const bx = x1 + rr(.4, w * .4), bz = z1 + rr(.4, d * .4); P.box(bx, bx + Math.min(4, w * .4), H, H + 2.4, bz, bz + Math.min(3.5, d * .4), jit(tint, .1)); }   // 옥탑 계단실 · 옥탑방
  };
  // 한 줄 거리 상가 (frame: 원점 · 길 방향 a · 바깥 d · 정면 법선 = -d)
  const rowStreet = (ch, f, a0, a1, gaps, o) => {
    const W = (a, d) => [f.o[0] + f.a[0] * a + f.d[0] * d, f.o[1] + f.a[1] * a + f.d[1] * d];
    const box = (a1_, a2, d1, d2) => { const p = W(a1_, d1), q = W(a2, d2); return [Math.min(p[0], q[0]), Math.max(p[0], q[0]), Math.min(p[1], q[1]), Math.max(p[1], q[1])]; };
    for (let a = a0; a < a1;) {
      const g = gaps.find(([g0, g1]) => a >= g0 - .01 && a < g1); if (g) { a = g[1]; continue; }
      const next = gaps.filter(([g0]) => g0 > a).reduce((m, [g0]) => Math.min(m, g0), a1);
      let w = Math.min(rr(o.wMin, o.wMax), next - a); if (next - a - w < o.wMin) w = next - a; if (w < 4) { a += w; continue; }
      const dep = rr(o.dMin, o.dMax), [x1, x2, z1, z2] = box(a + .15, a + w - .15, o.d0, o.d0 + dep);
      building(ch, x1, x2, z1, z2, o.floors(), { shop: o.shop, fn: [-f.d[0], -f.d[1]], tint: jit(pick(o.shop ? TINT_SHOP : TINT_VILLA), .05), allWin: !o.shop });
      a += w;
    }
  };
  // 뒷줄 빌라 · 다세대 블록 (골목 4m · 대지 12~15m)
  const villaGrid = (ch, x1, x2, z1, z2, fn) => {
    for (let x = x1; x < x2 - 9; x += rr(13, 16)) for (let z = z1; z < z2 - 9; z += rr(13, 16)) {
      if (rnd() < .12) { if (rnd() < .5) vehicle(ch, x + 5, z + 5, rnd() < .5 ? 0 : Math.PI / 2); continue; }
      const w = rr(9, 11.5), d = rr(9, 11.5);
      building(ch, x, x + w, z, z + d, rnd() < .25 ? 5 : rnd() < .6 ? 4 : 3, { shop: false, fn, tint: jit(pick(TINT_VILLA), .06), allWin: true });
      if (rnd() < .35) vehicle(ch, x + w + 1.8, z + rr(2, d - 2), 0, rnd() * .78);
      flat(ch, x - 2, x + w + 2, z - 2, z + d + 2, .004, C.pad);
    }
  };
  const tile = (a, b, step, fn) => { for (let v = a; v <= b; v += step) fn(v); };

  // ═══ 남쪽 (정문 앞 길 건너): 보도 z 82~86 · 상가 줄 z 86.5~ · 놀이터 · 버스 정류장 · 뒤로 빌라 ═══
  const SG = [[-63.5, -57.5], [-38, -24], [27, 33], [96, 102], [-122, -116]];   // 골목 · 놀이터 자리
  ['S0', 'S1'].forEach((nm, si) => {
    const ch = chunk(nm, false), xa = si ? 0 : -180, xb = si ? 180 : 0;
    walk(ch, xa, xb, 82, 86.3); curbZ(ch, 82, xa, xb);
    flat(ch, xa, xb, 86.3, 100, .003, C.pad);
    if (si) { flat(ch, 120, 180, 73, 82, .004, C.asph); } else { flat(ch, -180, -126, 73, 82, .004, C.asph); }
    rowStreet(ch, { o: [0, 86.5], a: [1, 0], d: [0, 1] }, xa, xb, SG, { shop: true, wMin: 8, wMax: 15, dMin: 10, dMax: 13, d0: 0, floors: () => 2 + (rnd() * 3 | 0) });
    const poles = []; let k = 0;
    for (let x = xa + 7; x < xb; x += rr(21, 26)) { if (Math.abs(x - 11) < 4) x += 5; poles.push(pole(ch, x, 82.55, 1, 0, 0, -1, k++)); }
    wireRun(ch, poles, 0, -1);
    for (let x = xa + 3; x < xb; x += rr(8, 10)) { if (poles.some(p => Math.abs(p[0] - x) < 2.5) || Math.abs(x - 11) < 5) continue; tree(ch, x, 83.3, rnd() < .7); }
    // 골목 입구: 아스팔트 · 횡단보도
    SG.forEach(([g0, g1]) => { if (g0 < xa || g1 > xb || g0 === -38) return; flat(ch, g0 + .2, g1 - .2, 82.3, 100, .145, C.asph); crosswalk(ch, g0 + .5, g1 - .5, 82.4, 85.8, true); if (rnd() < .7) vehicle(ch, g0 + 1.6, rr(90, 97), 0); });
  });
  { // 정문 서쪽 횡단보도 (길 건너 정류장 쪽으로) — 바닥 그림만
    const ch = chunks.find(c => c.name === 'S0'); for (let x = -9.5; x < -4.5; x += .9) flat(ch, x, x + .45, 73.4, 81.6, .022, C.stripe);
    flat(ch, -10.4, -10.2, 73.4, 81.6, .022, C.stripe); flat(ch, -3.8, -3.6, 73.4, 81.6, .022, C.stripe);
  }
  { // 서린동 버스 정류장 (남쪽 보도, 정문 대각선 건너편)
    const ch = chunks.find(c => c.name === 'S1'), P = ch.props, x0 = 8.2, x1 = 13.8, zf = 83.7, zb = 85.6, sh = hex(0x34444c);
    [[x0, zb], [x1, zb], [x0, zf + .3], [x1, zf + .3]].forEach(([x, z]) => P.box(x - .05, x + .05, .14, 2.65, z - .05, z + .05, sh));
    P.box(x0 - .3, x1 + .3, 2.65, 2.78, zf - .3, zb + .2, sh);
    P.box(x0 + .1, x1 - .1, .5, 2.4, zb - .03, zb + .03, hex(0x2a3a44));   // 뒤 유리 (밤이라 어둡게)
    P.box(x0 + .5, x1 - .5, .14, .55, zb - .55, zb - .1, hex(0x8a6a40)); P.box(x0 + .5, x1 - .5, .55, .6, zb - .55, zb - .1, hex(0x9a7a4a));   // 벤치
    ch.shop.wall([x1 + .07, zb - .15], [x1 + .07, zf + .4], .6, 2.35, [1, 0], cellUV(CELL.ad), [1, 1, 1]);   // 옆 광고판 (뒤에서 불빛)
    ch.shop.wall([x1 - .07, zf + .4], [x1 - .07, zb - .15], .6, 2.35, [-1, 0], cellUV(CELL.ad), [1, 1, 1]);
    P.box(15.2, 15.3, .14, 3.0, 82.55, 82.65, C.steel);   // 정류장 표지 기둥
    ch.shop.wall([15.65, 82.52], [14.85, 82.52], 2.35, 2.75, [0, -1], cellUV(CELL.bus), [1, 1, 1]); ch.shop.wall([14.85, 82.68], [15.65, 82.68], 2.35, 2.75, [0, 1], cellUV(CELL.bus), [1, 1, 1]);
    lamps.push([11, 2.5, 84.6]); ch.halos.push(11, 2.55, 84.6);
    vehicle(ch, 22, 84.6, Math.PI / 2, .95); vehicle(ch, 23, 84.9, Math.PI / 2, .95);   // 정류장 옆 배달 오토바이
  }
  { // 놀이터 (상가 사이 작은 어린이공원 x -38 ~ -24)
    const ch = chunks.find(c => c.name === 'S0'), P = ch.props;
    flat(ch, -37.6, -24.4, 86.4, 99.5, .03, C.sand);
    [[-37.6, -24.4, 86.4, 86.5], [-37.6, -24.4, 99.4, 99.5], [-37.6, -37.5, 86.4, 99.5], [-24.5, -24.4, 86.4, 99.5]].forEach(([a, b, c, d]) => P.box(a, b, 0, .6, c, d, C.green));
    P.box(-35.5, -34, 0, 2.2, 90, 91.5, hex(0xc84a2a)); P.geo(G.box, tr(-34.7, 1.2, 93.3, 0, .8, .06, 3.6, -.55), hex(0xd8c040));   // 미끄럼틀
    [-31.5, -28.3].forEach(x => [[x, 95.6], [x, 97.6]].forEach(([px, pz]) => P.geo(G.cyl, tr(px, 0, pz, 0, .06, 2.4, .06, 0, 0), C.blue)));
    P.box(-31.6, -28.2, 2.35, 2.45, 95.55, 97.65, C.blue);   // 그네 틀
    P.box(-31.62, -31.38, 2.35, 2.45, 95.5, 97.7, C.blue); P.box(-28.42, -28.18, 2.35, 2.45, 95.5, 97.7, C.blue);
    [96.2, 97.0].forEach(z => { P.box(-30.6, -29.2, .45, .5, z - .2, z + .2, C.red); P.box(-30.55, -30.5, .5, 2.35, z - .02, z + .02, C.steel); P.box(-29.3, -29.25, .5, 2.35, z - .02, z + .02, C.steel); });
    P.geo(G.box, tr(-27, .45, 90.5, 0, .25, .12, 3.2, .12), hex(0xd8a020)); P.box(-27.15, -26.85, 0, .45, 90.35, 90.65, C.steel);   // 시소
    P.box(-36.8, -35.2, .4, .45, 97.8, 98.4, hex(0x8a6a40)); tree(ch, -25.6, 98.2, false); tree(ch, -36.4, 87.8, false);
    lamps.push([-31, 4.2, 88]); P.geo(G.cyl, tr(-31, 0, 87.6, 0, .06, 4.2, .06), C.steel); ch.shop.geo(G.box, tr(-31, 4.2, 87.6, 0, .3, .2, .3), [1, 1, 1], cellPt(CELL.sodium)); ch.halos.push(-31, 4.25, 87.6);
  }
  // 남쪽 뒷줄 빌라 (저사양에서는 끔)
  ['S0d', 'S1d'].forEach((nm, si) => { const ch = chunk(nm, true); villaGrid(ch, si ? 2 : -176, si ? 176 : -2, 103, 160, [0, -1]); });

  // ═══ 동쪽 담장 너머: 보도 · 차도 x 116.5~127 · 상가 줄 x 131~ ═══
  {
    const ch = chunk('E', false);
    walk(ch, 114.7, 116.5, -121, 73); curbX(ch, 116.5, -121, 73); flat(ch, 116.5, 127, -121, 73, .005, C.asph); walk(ch, 127, 130.8, -124.5, 73); curbX(ch, 127, -121, 73);
    tile(-112, 66, 5, z => flat(ch, 121.65, 121.85, z, z + 2.5, .012, C.yellow)); crosswalk(ch, 116.7, 126.8, 60, 64, false);
    flat(ch, 130.8, 180, -124.5, 82, .003, C.pad);
    rowStreet(ch, { o: [131, 0], a: [0, 1], d: [1, 0] }, -118, 80, [[-64, -58], [-8, -2], [40, 46]], { shop: true, wMin: 9, wMax: 16, dMin: 10, dMax: 13, d0: 0, floors: () => 2 + (rnd() * 3 | 0) });
    const poles = []; let k = 0; for (let z = -116; z < 72; z += rr(22, 26)) poles.push(pole(ch, 127.45, z, 0, 1, -1, 0, k++)); wireRun(ch, poles, -1, 0);
    for (let z = -114; z < 70; z += rr(9, 12)) { if (poles.some(p => Math.abs(p[1] - z) < 2.5)) continue; tree(ch, 128.4, z, rnd() < .5); }
    for (let z = -110; z < 66; z += rr(6, 14)) if (rnd() < .45) vehicle(ch, 125.6, z, 0);
    villaGrid(chunk('Ed', true), 148, 190, -118, 78, [-1, 0]);
  }
  // ═══ 북쪽 담장 너머: 보도 · 차도 z -121~-110.5 · 상가 줄 z ~-125 ═══
  ['N0', 'N1'].forEach((nm, si) => {
    const ch = chunk(nm, false), xa = si ? 0 : -180, xb = si ? 180 : 0;
    walk(ch, Math.max(xa, -114.3), Math.min(xb, 114.7), -110.5, -108.7); curbZ(ch, -110.5, Math.max(xa, -126), Math.min(xb, 127));
    flat(ch, Math.max(xa, -126), Math.min(xb, 127), -121, -110.5, .005, C.asph); walk(ch, xa, xb, -124.7, -121); curbZ(ch, -121, xa, xb);
    tile(xa + 4, xb - 4, 5, x => { if (x > -126 && x < 125) flat(ch, x, x + 2.5, -115.9, -115.7, .012, C.yellow); });
    flat(ch, xa, xb, -150, -124.7, .003, C.pad);
    rowStreet(ch, { o: [0, -125], a: [1, 0], d: [0, -1] }, xa, xb, [[-90, -84], [-20, -14], [52, 58], [120, 126]], { shop: si === 0, wMin: 9, wMax: 16, dMin: 10, dMax: 13, d0: 0, floors: () => 2 + (rnd() * 3 | 0) });
    const poles = []; let k = 0; for (let x = xa + 6; x < xb; x += rr(22, 26)) poles.push(pole(ch, x, -121.45, 1, 0, 0, 1, k++)); wireRun(ch, poles, 0, 1);
    for (let x = xa + 3; x < xb; x += rr(9, 12)) { if (poles.some(p => Math.abs(p[0] - x) < 2.5)) continue; tree(ch, x, -122.3, rnd() < .6); }
    for (let x = Math.max(xa, -120) + 4; x < Math.min(xb, 120); x += rr(6, 14)) if (rnd() < .4) vehicle(ch, x, -119.6, Math.PI / 2);
    villaGrid(chunk(nm + 'd', true), xa + 3, xb - 3, -185, -141, [0, 1]);
  });
  // ═══ 서쪽 대로(기존 x -126~-115.5) 건너편: 보도 · 상가 줄 x ~-130 ═══
  {
    const ch = chunk('W', false);
    flat(ch, -126, -115.5, -121, -90, .004, C.asph); walk(ch, -129.8, -126, -124.5, 73); curbX(ch, -126, -121, 73);
    flat(ch, -180, -129.8, -124.5, 82, .003, C.pad);
    rowStreet(ch, { o: [-130, 0], a: [0, 1], d: [-1, 0] }, -118, 80, [[-50, -44], [10, 16]], { shop: true, wMin: 9, wMax: 16, dMin: 10, dMax: 13, d0: 0, floors: () => 2 + (rnd() * 3 | 0) });
    const poles = []; let k = 0; for (let z = -116; z < 72; z += rr(22, 26)) poles.push(pole(ch, -126.45, z, 0, 1, 1, 0, k++)); wireRun(ch, poles, 1, 0);
    for (let z = -114; z < 70; z += rr(9, 12)) { if (poles.some(p => Math.abs(p[1] - z) < 2.5)) continue; tree(ch, -127.4, z, rnd() < .5); }
    for (let z = -110; z < 30; z += rr(7, 15)) if (rnd() < .4) vehicle(ch, -124.8, z, Math.PI);
    villaGrid(chunk('Wd', true), -190, -146, -118, 78, [1, 0]);
  }

  // ── 메시로 묶기 ──
  const groups = [];
  for (const c of chunks) {
    const g = new THREE.Group(); g.name = 'hood_' + c.name; g.userData.detail = c.detail;
    const add = (o, nm) => { o.name = 'hood_' + c.name + '_' + nm; o.matrixAutoUpdate = false; o.updateMatrix(); g.add(o); return o; };
    if (!c.props.empty) add(new THREE.Mesh(c.props.build(lamps), M.props), 'props');
    if (!c.facade.empty) add(new THREE.Mesh(c.facade.build(lamps), M.facade), 'facade');
    if (!c.shop.empty) add(new THREE.Mesh(c.shop.build([]), M.shop), 'shop');
    if (!c.pools.empty) { const pm = add(new THREE.Mesh(c.pools.build([]), M.pool), 'pools'); pm.renderOrder = 2; }
    if (c.halos.length) { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(c.halos, 3)); add(new THREE.Points(gg, M.halo), 'halos').renderOrder = 3; }
    if (c.wires.length) { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(c.wires, 3)); add(new THREE.LineSegments(gg, M.wire), 'wires'); }
    g.userData.box = new THREE.Box3().setFromObject(g); root.add(g); groups.push(g);
  }

  // ── 먼 아파트 단지 (안개 무시 · 실루엣 + 불 켜진 창) ──
  const far = new Buf();
  const apt = (cx, cz, along, floors) => { const L = rr(36, 64), D = 12, H = floors * 2.8, x1 = along ? cx - L / 2 : cx - D / 2, x2 = along ? cx + L / 2 : cx + D / 2, z1 = along ? cz - D / 2 : cz - L / 2, z2 = along ? cz + D / 2 : cz + L / 2, uo = (rnd() * TL | 0) / TL, vo = (rnd() * TL | 0) / TL;
    for (const [L0, R0, n] of faces(x1, x2, z1, z2)) { const len = Math.hypot(R0[0] - L0[0], R0[1] - L0[1]); far.wall(L0, R0, 0, H, n, len > 20 ? [uo, vo, uo + len / BAY / TL, vo + floors / TL] : [BLANK[0], BLANK[1], BLANK[0], BLANK[1]], [1, 1, 1]); }
    far.top(x1, x2, z1, z2, H, [BLANK[0], BLANK[1], BLANK[0], BLANK[1]], [1, 1, 1]); };
  [[-150, 230, 3], [20, 250, 3], [150, 225, 2], [260, 40, 3], [250, -120, 2], [-260, 10, 3], [-250, -140, 2], [-120, -230, 3], [60, -240, 3], [190, -200, 2]].forEach(([cx, cz, n]) => {
    const along = Math.abs(cz) > Math.abs(cx); for (let k = 0; k < n; k++) apt(cx + (along ? (k - (n - 1) / 2) * 75 + rr(-8, 8) : rr(-25, 25)), cz + (along ? rr(-25, 25) : (k - (n - 1) / 2) * 75), along, 12 + (rnd() * 9 | 0));
  });
  const farMesh = new THREE.Mesh(far.build([]), M.far); farMesh.name = 'hood_far_apts'; farMesh.matrixAutoUpdate = false; root.add(farMesh);

  // ── 산 능선 + 도시 불빛 (카메라를 따라다니는 배경 고리) ──
  const sky = new THREE.Group(); sky.name = 'hood_skyline';
  {
    const N = 160, pos = [], col = [], idx = [], gp = [], gc = [], gi = [];
    for (let k = 0; k <= N; k++) {
      const a = k / N * Math.PI * 2, x = Math.cos(a), z = Math.sin(a);
      // 북 · 서쪽이 높은 산 (서린동 뒷산), 남 · 동쪽은 낮은 구릉 + 도시
      const mt = .5 + .5 * Math.sin(a + 2.2), h = .035 + .1 * mt * (.6 + .4 * Math.sin(a * 5 + 1) * Math.sin(a * 3.3)) + .02 * Math.sin(a * 17) + .008 * Math.sin(a * 41);
      pos.push(x, -.04, z, x, Math.max(.02, h), z); const top = hex(0x0b0f17), bot = hex(0x06080c); col.push(...bot, ...top);
      const city = .25 + .75 * (1 - mt), gl = [.10 * city, .065 * city, .035 * city];
      gp.push(x * 1.02, -.02, z * 1.02, x * 1.02, .2, z * 1.02); gc.push(...gl, 0, 0, 0);
      if (k < N) { const b = k * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); gi.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    }
    const mk = (p, c, i) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); g.setIndex(i); return g; };
    const glow = new THREE.Mesh(mk(gp, gc, gi), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending }));
    glow.renderOrder = -9.5; glow.frustumCulled = false; sky.add(glow);
    const mtn = new THREE.Mesh(mk(pos, col, idx), partialFog(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, depthWrite: false }), .7));
    mtn.renderOrder = -9; mtn.frustumCulled = false; sky.add(mtn);
  }
  root.add(sky);
  scene.add(root);

  // ── 담장 밖 기존 나무 인스턴스 중 새 건물 안에 박힌 것은 숨긴다 ──
  let treesHidden = 0;
  { const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
    scene.traverse(o => { if (!o.isInstancedMesh || o.parent === root || root.getObjectById(o.id)) return; let ch = false;
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); p.setFromMatrixPosition(m4).applyMatrix4(o.matrixWorld);
        if (p.x > -114.5 && p.x < 114.5 && p.z > -108.5 && p.z < 82) continue;
        if (footprints.some(([a, b, c, d]) => p.x > a - 1.5 && p.x < b + 1.5 && p.z > c - 1.5 && p.z < d + 1.5)) { o.setMatrixAt(i, zero); ch = true; treesHidden++; } }
      if (ch) { o.instanceMatrix.needsUpdate = true; o.computeBoundingSphere?.(); } }); }

  // ── 매 프레임(가볍게): 배경 고리 위치 · 구역 거리 컬링 · 저사양 밀도 · 실내 깊은 곳에서는 통째로 끔 ──
  const HIDE_FLOORS = new Set([4, 5, 6, 7]);
  const isLow = () => camera.far < 300 || SET.quality === 'low' || SET.quality === 'igpu';
  let fr = 0; const cp = new THREE.Vector3();
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (r, s, cam, ...rest) {
    if (prev) prev.call(this, r, s, cam, ...rest);
    if (cam !== camera) return;
    const R = camera.far * .8; sky.position.set(camera.position.x, 0, camera.position.z); sky.scale.set(R, R, R); sky.updateMatrixWorld(true);
    if (fr++ % 12) return;
    const P = window.__g && window.__g.P, hide = P && HIDE_FLOORS.has(P.floor); root.visible = !hide; if (hide) return;
    const low = isLow(), lim = low ? 150 : 250; cp.copy(camera.position);
    for (const g of groups) g.visible = !(low && g.userData.detail) && g.userData.box.distanceToPoint(cp) < lim;
  };

  const tris = groups.reduce((s, g) => s + g.children.reduce((t, m) => t + (m.isMesh ? m.geometry.index.count / 3 : 0), 0), 0) + farMesh.geometry.index.count / 3;
  const info = { chunks: groups.length, meshes: groups.reduce((s, g) => s + g.children.length, 0) + 3, buildings: footprints.length, lamps: lamps.length, tris: tris | 0, treesHidden, ms: Math.round(performance.now() - t0) };
  window.__hood08 = info; return info;
}
