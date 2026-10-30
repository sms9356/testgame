// 렌더링 엔진 선택: WebGPU (신규 · Three.js WebGPURenderer + TSL 노드 후처리) ↔ WebGL (기존 · 호환 모드)
//   기본은 자동: 브라우저가 WebGPU 를 지원하고 어댑터를 얻으면 WebGPU, 아니면 WebGL. ?webgl / ?webgpu 또는 설정(SET.engine)으로 강제.
//   WebGPU 렌더러에는 WebGL 전용 API(extensions · info.programs · capabilities · getContext · 동기 픽셀 읽기)가 없어서,
//   게임 코드가 그대로 돌도록 같은 이름의 호환 계층을 붙인다.
import * as THREE from './vendor/three.module.js';

export const ENGINE = { name: 'webgl', webgpu: false, W: null, TSL: null, reason: '' };

function want(pref) {
  const q = new URLSearchParams(location.search);
  if (q.has('webgl')) return 'webgl';
  if (q.has('webgpu')) return 'webgpu';
  return pref || 'auto';
}

function shim(r) {
  if (!r.extensions) r.extensions = { has: () => false, get: () => null };
  if (!r.capabilities) r.capabilities = { isWebGL2: true, getMaxAnisotropy: () => (r.getMaxAnisotropy ? r.getMaxAnisotropy() : 16), maxTextures: 16, precision: 'highp' };
  if (r.info && !r.info.programs) r.info.programs = [];
  if (!r.getContext) r.getContext = () => null;
  if (!r.compile && r.compileAsync) r.compile = (s, c, t) => { r.compileAsync(s, c, t).catch(() => {}); };
  return r;
}

export async function createRenderer({ canvas, pref = 'auto', antialias = true } = {}) {
  const mode = want(pref);
  if (mode !== 'webgl' && typeof navigator !== 'undefined' && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('WebGPU 어댑터 없음');
      const [W, TSL] = await Promise.all([import('./vendor/three.webgpu.js'), import('./vendor/three.tsl.js')]);
      const r = new W.WebGPURenderer({ canvas, antialias, powerPreference: 'high-performance' });
      await r.init();
      if (!r.backend || !r.backend.isWebGPUBackend) throw new Error('WebGPU 백엔드 초기화 실패');
      Object.assign(ENGINE, { name: 'webgpu', webgpu: true, W, TSL, reason: '' });
      r.isWebGPU = true;
      return shim(r);
    } catch (e) { ENGINE.reason = String(e && e.message || e); console.warn('[엔진] WebGPU 사용 불가 → WebGL', e); }
  } else if (mode !== 'webgl') ENGINE.reason = '브라우저가 WebGPU 를 지원하지 않음';
  const r = new THREE.WebGLRenderer({ canvas, antialias, powerPreference: 'high-performance' });
  Object.assign(ENGINE, { name: 'webgl', webgpu: false });
  return r;
}

// 렌더 타깃: WebGPU 는 범용 RenderTarget, WebGL 은 WebGLRenderTarget
export function makeRenderTarget(w, h, o) { return ENGINE.webgpu ? new THREE.RenderTarget(w, h, o) : new THREE.WebGLRenderTarget(w, h, o); }
// PMREM(환경광 필터링): 엔진에 맞는 생성기
export function makePMREM(renderer) { return ENGINE.webgpu ? new ENGINE.W.PMREMGenerator(renderer) : new THREE.PMREMGenerator(renderer); }
