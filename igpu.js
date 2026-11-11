// 내장 그래픽(iGPU) / 저사양 경로: GPU 이름으로 내장 그래픽을 알아내고, 프레임 시간에 맞춰 렌더 해상도를 0.6~1.0 사이에서 조절한다.
// Intel UHD / Iris Xe · AMD Vega / "Radeon Graphics"(APU) · 외장 GPU 없는 Apple GPU 를 내장으로 본다.

// 렌더러 문자열 → 내장 그래픽 여부 (외장 GPU 이름이 함께 있으면 아니다)
export function isIntegratedName(s) {
  if (!s) return false;
  if (/swiftshader|llvmpipe|software/i.test(s)) return false;   // 소프트웨어 렌더러(헤드리스 테스트)는 건드리지 않는다
  if (/nvidia|geforce|quadro|rtx|gtx|radeon\s*(rx(?!\s*vega)|pro|r9|r7|hd\s*[5-9]\d{3})|arc\s*a\d/i.test(s)) return false;
  return /intel|uhd|iris|hd graphics|vega|radeon(\(tm\))?\s*graphics|radeon\s*\d{3}m|apple\s*(m\d|gpu)|mali|adreno|powervr/i.test(s);
}

// WebGL 컨텍스트(또는 three.js 렌더러)에서 GPU 이름을 읽는다
export function gpuName(renderer) {
  try {
    const gl = renderer && (renderer.getContext ? renderer.getContext() : renderer);
    if (!gl || !gl.getParameter) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
  } catch (e) { return ''; }
}

export function detectIntegrated(renderer) {
  let name = gpuName(renderer);
  if (!name) {   // WebGPU 렌더러 등: 따로 만든 작은 WebGL 컨텍스트로 이름만 본다
    try { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); name = gpuName(gl); gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch (e) { /* ignore */ }
  }
  return { name, integrated: isIntegratedName(name) };
}

// 동적 해상도: 1.5초 창의 평균 프레임 시간이 목표(30fps)보다 길면 0.1 내리고, 넉넉하면(3창 연속 < 25ms) 0.05 올린다 (히스테리시스)
// apply(scale) 는 크기가 바뀔 때만 부른다 — 렌더 타깃을 다시 만드는 비용이 있어 최소 1.5초 간격.
export function createDynRes({ min = .6, max = 1, targetMs = 1000 / 30, apply } = {}) {
  let scale = max, acc = 0, n = 0, win = 0, good = 0, on = false;
  return {
    get scale() { return scale; },
    get enabled() { return on; },
    setEnabled(v) { on = !!v; acc = n = win = good = 0; if (!on && scale !== max) { scale = max; apply && apply(scale); } },
    tick(dtSec) {
      if (!on || !(dtSec > 0) || dtSec > .5) return;   // 탭 전환 · 로딩 멈춤은 무시
      acc += dtSec * 1000; n++; win += dtSec;
      if (win < 1.5) return;
      const ms = acc / n; acc = n = win = 0;
      let next = scale;
      if (ms > targetMs * 1.05) { good = 0; next = Math.max(min, +(scale - (ms > targetMs * 1.4 ? .15 : .1)).toFixed(2)); }
      else if (ms < targetMs * .75) { if (++good >= 3) { good = 0; next = Math.min(max, +(scale + .05).toFixed(2)); } }
      else good = 0;
      if (next !== scale) { scale = next; apply && apply(scale); }
    },
  };
}
