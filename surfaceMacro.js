// 큰 바닥 · 벽 · 천장 면에 월드 좌표 기준 거시 변이(macro variation)를 입힌다 — 같은 타일 텍스처가 반복돼 보이던 것을 깨는 용도.
//  - 새 에셋 0바이트: 256px RGBA 노이즈 한 장을 런타임에 만들어 모든 재질이 공유 (≈256KB GPU, 밉맵 포함 ≈340KB)
//  - 월드 좌표 평면 투영(바닥/천장=XZ, 벽=법선이 큰 쪽 축) 이라 UV 늘어짐 · 이음매가 없고 같은 재질이 방마다 다르게 보인다
//  - 두 스케일(≈9m 얼룩 · ≈1.7m 얼룩) + 미세 입자(≈0.35m): 명도 · 거칠기(왁스 광택) · 때 · 물자국 · 긁힌 자국 · 벽 아래 먼지띠 · 천장 얼룩
//  - 법선 미세 요철(옅은 bump): level 2 (낮음 이상) 에서만. 이방성 스커프 · 세로 물줄기 등
//  - level 0 (igpu 저사양 / WebGPU) 에서는 재질 패치를 하지 않거나 셰이더 분기에서 샘플링을 건너뛴다.
import * as THREE from './vendor/three.module.js';

const LEVEL = { value: 2 };            // 0 끔 · 1 알베도/거칠기 · 2 + 법선 요철 (모든 재질이 같은 uniform 객체를 본다)
const GAIN = { value: 1 };            // 전체 세기 배율 (튜닝 · 접근성)
let NOISE = null;
const patched = new WeakSet();
const SKIP = /window|screen|lamp|glass|sky|water|exit|sign|light|glow|ghost|fx|particle|flame|fog|led|bulb|door|board|poster|flag|banner|mirror|monitor|paper|screen/i;

// 가로 · 세로로 이어지는 값 노이즈 (격자 wrap) — 4채널: 저주파 · 중주파 · 미세 입자 · 균열/줄무늬
function makeNoise(N = 256) {
  let s = 20081012;
  const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  const lattice = (cells) => { const a = new Float32Array(cells * cells); for (let i = 0; i < a.length; i++) a[i] = rnd(); return a; };
  const sm = t => t * t * (3 - 2 * t);
  const sample = (a, cells, x, y) => {   // x,y ∈ [0,1) → [0,1]
    const fx = x * cells, fy = y * cells, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
    const i0 = x0 % cells, j0 = y0 % cells, i1 = (x0 + 1) % cells, j1 = (y0 + 1) % cells;
    const v00 = a[j0 * cells + i0], v10 = a[j0 * cells + i1], v01 = a[j1 * cells + i0], v11 = a[j1 * cells + i1];
    return (v00 + (v10 - v00) * tx) * (1 - ty) + (v01 + (v11 - v01) * tx) * ty;
  };
  const fbm = (octs, x, y) => { let v = 0, amp = .5, tot = 0; for (const [a, c] of octs) { v += sample(a, c, x, y) * amp; tot += amp; amp *= .55; } return v / tot; };
  const mk = base => [0, 1, 2, 3].map(i => { const c = base * (1 << i); return [lattice(c), c]; });
  const A = mk(3), B = mk(5), C = mk(16), D = mk(7);
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = (y * N + x) * 4;
    const r = fbm(A, u, v), g = fbm(B, u, v), b = fbm(C.slice(0, 3), u, v);
    const d = 1 - Math.abs(fbm(D, u, v) * 2 - 1);            // 능선형: 균열 · 줄무늬
    // fbm 값은 0.5 근처로 몰리므로 대비를 늘린다
    const ct = q => Math.max(0, Math.min(1, (q - .5) * 2.1 + .5));
    data[i] = ct(r) * 255; data[i + 1] = ct(g) * 255; data[i + 2] = ct(b) * 255; data[i + 3] = Math.pow(d, 9) * 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true; t.name = 'macro-noise';
  return t;
}

const VERT_PARS = 'varying vec3 vMcW;\nvarying vec3 vMcN;\n';
const FRAG_PARS = `varying vec3 vMcW;
varying vec3 vMcN;
uniform sampler2D uMcTex;
uniform vec3 uMc;      // x 세기, y 스케일 배수, z 야외(1)
uniform float uMcLevel;
uniform float uMcGain;
vec3 mcBump(vec3 p, vec3 n, float h) {
  vec3 q0 = dFdx(p), q1 = dFdy(p);
  vec3 r1 = cross(q1, n), r2 = cross(n, q0);
  float det = dot(q0, r1);
  vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - g);
}
`;
const FRAG_COLOR = `
float mcRough = 0.0, mcH = 0.0;
if (uMcLevel > 0.5 && uMc.x > 0.0) {
  vec3 wn = normalize(vMcN);
  float fl = step(0.72, wn.y), ce = step(0.72, -wn.y), wl = 1.0 - fl - ce;
  vec2 uv = fl + ce > 0.5 ? vMcW.xz : (abs(wn.x) > abs(wn.z) ? vMcW.zy : vMcW.xy);
  float k = uMc.y;
  vec4 a = texture2D(uMcTex, uv * 0.11 * k);
  vec4 b = texture2D(uMcTex, uv * 0.59 * k + vec2(.31, .77));
  vec4 c = texture2D(uMcTex, uv * 2.9 + vec2(.57, .13));
  float amt = uMc.x * uMcGain;
  // 명도: 큰 얼룩 · 중간 얼룩 · 미세 입자
  float lum = (a.r - .5) * .26 + (b.g - .5) * .18 + (c.b - .5) * .07;
  vec3 col = diffuseColor.rgb * (1.0 + lum * amt);
  // 때 · 물자국: 갈색 기운이 도는 어두운 얼룩 (천장 · 벽은 강하게, 바닥은 약하게)
  float stain = smoothstep(.50, .95, a.g * .55 + b.r * .45);
  float stainK = ce > .5 ? .55 : (wl > .5 ? .20 : .16);
  col *= mix(vec3(1.0), vec3(.80, .73, .62), stain * stainK * amt);
  // 가는 얼룩 선 (헤어라인 균열 · 물 흐름 자국)
  float crack = smoothstep(.45, .85, b.a) * smoothstep(.58, .78, a.r + (c.g - .5) * .3) * (1.0 - ce);
  col *= 1.0 - crack * .20 * amt * (1.0 - fl * .4);
  if (wl > .5) {
    // 벽: 아래쪽 먼지띠 · 걸레받이 오염 · 천장 근처 물자국 / 위에서 흘러내린 세로 줄무늬
    float hb = mod(vMcW.y + .15, 3.6) - .15;
    float base = 1.0 - smoothstep(0.0, .55, hb);
    float top = smoothstep(3.6 - .55, 3.6, hb);
    float drip = texture2D(uMcTex, vec2(uv.x * 1.7 * k + .2, uv.y * .09 * k)).a;
    col *= 1.0 - base * (.14 + .22 * b.g) * amt;
    col *= mix(vec3(1.0), vec3(.84, .79, .70), top * smoothstep(.45, .8, a.r + b.g * .4) * .8 * amt);
    col *= 1.0 - drip * (.05 + .10 * top) * amt;
  }
  if (fl > .5) {
    // 바닥: 긁힌 자국 (이방성) · 왁스 광택 얼룩 (거칠기)
    float sc = texture2D(uMcTex, uv * vec2(1.7, .21) * k + vec2(.4, .6)).a;
    col *= 1.0 - sc * .10 * amt;
    mcRough = ((a.r - .5) * .34 + (b.g - .5) * .20 - stain * .10 + sc * .10) * amt;
  } else if (ce > .5) { mcRough = (b.g - .5) * .20 * amt; }
  else { mcRough = ((a.g - .5) * .24 + (c.b - .5) * .12) * amt; }
  mcH = b.g * .65 + a.r * .35;
  diffuseColor.rgb = col;
}
`;
const FRAG_ROUGH = `
roughnessFactor = clamp(roughnessFactor + mcRough, roughnessFactor * .7, 1.0);
`;
const FRAG_BUMP = `
if (uMcLevel > 1.5 && uMc.x > 0.0) normal = mcBump(-vViewPosition, normal, mcH * .010 * uMc.x * uMcGain);
`;

function patch(m, kind) {
  if (patched.has(m)) return false;
  patched.add(m);
  const U = new THREE.Vector3(kind === 'out' ? .6 : 1, kind === 'out' ? .22 : 1, kind === 'out' ? 1 : 0);   // 세기 · 스케일 · 야외
  m.userData.macroU = U;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = function (shader, renderer) {
    if (prev) prev.call(this, shader, renderer);
    shader.uniforms.uMcTex = { value: NOISE }; shader.uniforms.uMc = { value: U }; shader.uniforms.uMcLevel = LEVEL; shader.uniforms.uMcGain = GAIN;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <project_vertex>', `#include <project_vertex>
      { vec4 mcl = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mcl = instanceMatrix * mcl;
        #endif
        vMcW = ( modelMatrix * mcl ).xyz; vMcN = normalize( mat3( modelMatrix ) * objectNormal ); }`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + FRAG_PARS)
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + FRAG_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + FRAG_ROUGH)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_BUMP);
  };
  const key = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
  m.customProgramCacheKey = () => key() + '|mc1';
  m.needsUpdate = true;
  return true;
}

const _ws = new THREE.Vector3(), _sz = new THREE.Vector3();
function bigFlat(o) {
  const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox();
  o.getWorldScale(_ws); _sz.copy(g.boundingBox.max).sub(g.boundingBox.min).multiply(_ws);
  const a = [Math.abs(_sz.x), Math.abs(_sz.y), Math.abs(_sz.z)].sort((p, q) => q - p);
  return { big: a[0] >= 3 && a[1] >= 1.4, huge: a[0] >= 24 && a[1] >= 24 };
}

// 장면을 훑어 크고 납작한 면(바닥 · 벽 · 천장 · 마당)을 쓰는 텍스처 재질에 거시 변이를 붙인다 — 재질당 한 번
export function applyMacroDetail(root, { renderer = null, level = 2 } = {}) {
  if (!THREE.WebGLRenderer || (renderer && !renderer.isWebGLRenderer)) return { n: 0, skipped: 'not-webgl' };
  LEVEL.value = level;
  if (!NOISE) NOISE = makeNoise(256);
  let n = 0; const seenIn = new Set(), seenOut = new Map();
  root.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || !o.geometry || !o.geometry.attributes.normal) return;
    if (o.userData.noMacro || (o.parent && o.parent.userData && o.parent.userData.noMacro)) return;
    let nm = '', a = o; for (let i = 0; i < 3 && a; i++, a = a.parent) nm += ' ' + (a.name || '');
    if (SKIP.test(nm)) return;
    const ms = [].concat(o.material); if (!ms.some(m => m && m.isMeshStandardMaterial && m.map)) return;
    const f = bigFlat(o); if (!f.big) return;
    for (const m of ms) {
      if (!m || !m.isMeshStandardMaterial || !m.map || m.userData.noMacro || patched.has(m)) continue;
      if (m.transparent || m.opacity < 1 || m.wireframe || m.vertexColors || m.alphaTest > 0 || m.metalness > .5) continue;
      if (m.emissive && m.emissiveIntensity > .2 && m.emissive.getHex() !== 0) continue;
      if (SKIP.test(m.name || '')) continue;
      if (f.huge) { if (!seenIn.has(m)) seenOut.set(m, true); } else { seenIn.add(m); seenOut.delete(m); }
    }
  });
  for (const m of seenIn) if (patch(m, 'in')) n++;
  for (const m of seenOut.keys()) if (!seenIn.has(m) && patch(m, 'out')) n++;
  return { n, level };
}
export const setMacroLevel = v => { LEVEL.value = v; };
export const setMacroGain = v => { GAIN.value = v; };
if (typeof window !== 'undefined') window.__macro = { setMacroLevel, setMacroGain };
export const macroStats = () => ({ level: LEVEL.value, noiseBytes: NOISE ? 256 * 256 * 4 * 4 / 3 | 0 : 0 });
