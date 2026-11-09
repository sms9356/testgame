// 달빛 창 기둥 · 기둥 속 먼지 · 복도 끝 어둠 그라데이션 (조명 추가 없음 — 가산 혼합 / 반투명 판만)
//   moonWins: rebuild/mainBuilding.js 창호 생성 때 모은 창 개구부 (건물 로컬 좌표)
//   기둥 · 먼지는 높음/최고 품질에서만, 복도 어둠은 항상 (판 몇 장)
import * as THREE from './vendor/three.module.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
let seed = 9173; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// 기둥: v(세로)=창→바닥 감쇠, u(가로)=먼지 띠 (밝기 줄무늬)
const shaftTex = () => canvasTex(128, 128, (g, w, h) => {
  const bands = new Float32Array(w); for (let k = 0; k < 7; k++) { const c = rnd() * w, r = 3 + rnd() * 14, a = .25 + rnd() * .5; for (let x = 0; x < w; x++) { const d = Math.min(Math.abs(x - c), w - Math.abs(x - c)); bands[x] += a * Math.exp(-(d * d) / (r * r)); } }
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) { const v = y / (h - 1), fall = Math.pow(1 - v, 1.4) * .85 + .15 * Math.max(0, 1 - v * 1.05), edge = Math.min(1, v * 14);
    for (let x = 0; x < w; x++) { const b = (.45 + Math.min(1, bands[x]) * .55) * fall * edge * 255, i = (y * w + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = b; img.data[i + 3] = 255; } }
  g.putImageData(img, 0, 0);
});
// 바닥에 떨어진 창 모양 빛 (한 짝: 테두리 흐림 + 살 그림자)
const poolTex = () => canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.filter = 'blur(3px)'; g.fillStyle = '#fff'; g.fillRect(5, 5, w - 10, h - 10);
  g.fillStyle = '#000'; g.fillRect(w / 2 - 2, 0, 4, h); g.filter = 'none';
});
const dotTex = () => canvasTex(32, 32, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
const fadeTex = () => canvasTex(128, 4, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#000'); gr.addColorStop(.55, '#555'); gr.addColorStop(1, '#fff'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, false);

const quad = (p0, p1, p2, p3, uv) => {   // p: [x,y,z], uv: [[u,v]×4]
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...p0, ...p1, ...p2, ...p0, ...p2, ...p3], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([...uv[0], ...uv[1], ...uv[2], ...uv[0], ...uv[2], ...uv[3]], 2));
  return g;
};

export function installMoonShafts({ scene, blds, moonPos }) {
  const MOON = new THREE.Color(0xb8cdf2);   // 차가운 청백
  const T = { shaft: shaftTex(), pool: poolTex(), dot: dotTex(), fade: fadeTex() };
  const mShaft = new THREE.MeshBasicMaterial({ map: T.shaft, color: MOON, transparent: true, opacity: .11, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true, toneMapped: false });
  const mPool = new THREE.MeshBasicMaterial({ map: T.pool, color: MOON, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false, fog: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mMote = new THREE.PointsMaterial({ map: T.dot, color: 0xdfe8ff, size: .016, sizeAttenuation: true, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  const mDark = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: T.fade, transparent: true, opacity: .62, depthWrite: false, side: THREE.DoubleSide, fog: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const BASE = { shaft: mShaft.opacity, pool: mPool.opacity, mote: mMote.opacity, dark: mDark.opacity };
  const hi = [], motes = [], dark = [];
  const W = new THREE.Vector3().copy(moonPos).normalize().negate();   // 빛 진행 방향 (월드)

  for (const b of blds) { if (!b || !b.moonWins || !b.root) continue;
    const RY = b.root.rotation.y, cR = Math.cos(RY), sR = Math.sin(RY);
    const d = new THREE.Vector3(W.x * cR - W.z * sR, W.y, W.x * sR + W.z * cR);   // 로컬 빛 방향
    const LY = b.layout, S = b.spec, zMin = LY.zN + .05, zMax = LY.zS - .05, wallIn = (S.outer || .3) / 2 + .02;
    const byF = new Map();
    for (const w of b.moonWins) {
      if (d.z * -w.out < .15) continue;   // 달을 등진 창
      const zi = w.z - w.out * wallIn, fy = w.y0 + .012;
      const land = (x, y) => { let t = (y - fy) / -d.y; const z = zi + d.z * t; if (z < zMin) t = (zMin - zi) / d.z; if (z > zMax) t = (zMax - zi) / d.z; return [x + d.x * t, y + d.y * t, zi + d.z * t]; };
      const C = [[w.a, w.y1], [w.b, w.y1], [w.b, w.y2], [w.a, w.y2]].map(([x, y]) => [x, y, zi]), L = C.map(c => land(c[0], c[1]));
      const F = byF.get(w.f) || { s: [], p: [], m: [], y0: w.y0 }; byF.set(w.f, F);
      for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4, u0 = k % 2 ? 0 : 0, span = k % 2 ? (w.y2 - w.y1) / 2.5 : (w.b - w.a) / 2.5;
        F.s.push(quad(C[k], C[k2], L[k2], L[k], [[u0, 0], [span, 0], [span, 1], [u0, 1]])); }
      const onFloor = L.every(p => p[1] < fy + .05);
      if (onFloor) F.p.push(quad(L[0], L[1], L[2], L[3], [[0, 0], [w.nS || 1, 0], [w.nS || 1, 1], [0, 1]]));
      const n = Math.round((w.b - w.a) * (w.y2 - w.y1) * 7);
      for (let i = 0; i < n; i++) { const sx = w.a + rnd() * (w.b - w.a), sy = w.y1 + rnd() * (w.y2 - w.y1), e = land(sx, sy), q = .05 + rnd() * .9;
        F.m.push(sx + (e[0] - sx) * q, sy + (e[1] - sy) * q, zi + (e[2] - zi) * q); }
    }
    for (const [f, F] of byF) {
      if (F.s.length) { const m = new THREE.Mesh(mergeGeometries(F.s, false), mShaft); m.name = 'MOON_SHAFT_' + f; m.renderOrder = 5; m.frustumCulled = true; b.root.add(m); hi.push(m); F.s.forEach(g => g.dispose()); }
      if (F.p.length) { const m = new THREE.Mesh(mergeGeometries(F.p, false), mPool); m.name = 'MOON_POOL_' + f; m.renderOrder = 4; b.root.add(m); hi.push(m); F.p.forEach(g => g.dispose()); }
      if (F.m.length) { const g = new THREE.BufferGeometry(), base = new Float32Array(F.m); g.setAttribute('position', new THREE.BufferAttribute(base.slice(), 3)); const ph = new Float32Array(base.length / 3).map(() => rnd() * 6.283);
        const p = new THREE.Points(g, mMote); p.name = 'MOON_MOTES_' + f; p.renderOrder = 6; p.frustumCulled = false; b.root.add(p); hi.push(p); motes.push({ p, base, ph, y0: F.y0, b }); }
    }
    // 복도 끝 어둠: 복도(zN..-벽/2) 양 끝 F m 를 바닥 · 천장 · 양 벽에 검은 반투명 그라데이션 판으로 (u 0 = 안쪽 투명, 1 = 끝 진함)
    const zA = LY.zN + .012, zB = -(S.wall || .2) / 2 - .012, FL = Math.min(16, LY.L * .2), ds = [];
    for (let f = 0; f < S.floors; f++) { const y0 = f * S.FH, yc = y0 + S.CEIL - .01, yF = y0 + .016;
      for (const sx of [-1, 1]) { const xe = sx * LY.L / 2, xi = xe - sx * FL, uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
        ds.push(quad([xi, yF, zA], [xe, yF, zA], [xe, yF, zB], [xi, yF, zB], uv), quad([xi, yc, zA], [xe, yc, zA], [xe, yc, zB], [xi, yc, zB], uv),
          quad([xi, yF, zA], [xe, yF, zA], [xe, yc, zA], [xi, yc, zA], uv), quad([xi, yF, zB], [xe, yF, zB], [xe, yc, zB], [xi, yc, zB], uv)); } }
    if (ds.length) { const m = new THREE.Mesh(mergeGeometries(ds, false), mDark); m.name = 'CORRIDOR_END_DARK'; m.renderOrder = 3; b.root.add(m); dark.push(m); ds.forEach(g => g.dispose()); }
  }

  let on = true, tt = 0; const wp = new THREE.Vector3();
  const api = {
    count: () => ({ shafts: hi.length, motes: motes.reduce((s, m) => s + m.base.length / 3, 0), dark: dark.length }),
    setQuality(q) { on = q === 'high' || q === 'ultra'; hi.forEach(m => { m.visible = on; }); },
    tick(dt, cam, dk = 0) {
      const night = Math.max(0, 1 - dk * 1.6);
      mShaft.opacity = BASE.shaft * night; mPool.opacity = BASE.pool * night; mMote.opacity = BASE.mote * night; mDark.opacity = BASE.dark * (1 - dk * .9);
      if (!on || night <= 0) return;
      tt += dt; T.shaft.offset.x = tt * .006;   // 먼지 띠가 천천히 흐른다
      for (const M of motes) { M.b.root.worldToLocal(wp.copy(cam.position)); const near = Math.abs(wp.y - M.y0 - 1.4) < 2.4; M.p.visible = near; if (!near) continue;
        const a = M.p.geometry.attributes.position, A = a.array, B = M.base;
        for (let i = 0, j = 0; i < A.length; i += 3, j++) { const p = M.ph[j], s = tt * (.15 + (p % 1) * .2);
          A[i] = B[i] + Math.sin(s + p) * .06; A[i + 1] = B[i + 1] + Math.sin(s * .7 + p * 2.1) * .05 - ((tt * .01 + p) % .12); A[i + 2] = B[i + 2] + Math.cos(s * .8 + p) * .06; }
        a.needsUpdate = true; }
    },
  };
  return api;
}
