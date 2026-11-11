// 텍스처 점검 · 미리 올리기
//  1) 색 공간 · 이방성 점검: 색(알베도 · 발광) 텍스처는 sRGB, 데이터(법선 · 거칠기 · 금속 · AO · 범프 · 변위 · 알파) 텍스처는 선형.
//     아직 GPU 에 안 올라간 텍스처만 고친다 (이미 올라간 것을 고치면 다시 올려야 해서 끊김이 생긴다).
//  2) 처음 1분 동안 아직 안 올라간 텍스처를 한 프레임에 몇 ms 씩만 미리 올린다 — 새 방을 처음 볼 때 수십 장이 한 프레임에 몰려 멈추던 현상 완화.
//     HTMLImageElement 는 img.decode() 로 메인 스레드 밖에서 먼저 풀어 둔다 (업로드 때 동기 디코딩 방지).
const COLOR = ['map', 'emissiveMap', 'specularColorMap', 'sheenColorMap'];
const DATA = ['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'displacementMap', 'alphaMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap'];
const ANISO = { low: 2, mid: 4, high: 8, ultra: 16 };

export function createTexWarm(THREE, renderer, scene, { window: winS = 60 } = {}) {
  const seen = new WeakSet(), queue = [], stats = { fixedColor: 0, fixedData: 0, uploaded: 0, decoded: 0 };
  let quality = 'mid', t = 0, scanT = 0, startT = null, gate = Promise.resolve(), open = false;
  const maxA = (() => { try { return renderer.capabilities.getMaxAnisotropy() || 1; } catch (e) { return 1; } })();
  const props = renderer.properties;
  const uploaded = tex => { try { const p = props && props.get(tex); return !!(p && (p.__webglInit || p.initialized || p.texture)); } catch (e) { return true; } };
  const isImg = tex => { const d = tex.image; return d && !tex.isDataTexture && !tex.isRenderTargetTexture && !tex.isVideoTexture && !tex.isCompressedTexture && !tex.isDepthTexture && (d.width > 0 || d.naturalWidth > 0); };
  function audit(tex, color) {
    if (!tex || !tex.isTexture || seen.has(tex)) return; seen.add(tex);
    if (!isImg(tex)) return;
    if (!uploaded(tex)) {
      if (color && tex.colorSpace === THREE.NoColorSpace) { tex.colorSpace = THREE.SRGBColorSpace; stats.fixedColor++; }
      else if (!color && tex.colorSpace === THREE.SRGBColorSpace) { tex.colorSpace = THREE.NoColorSpace; stats.fixedData++; }
      const a = Math.min(maxA, ANISO[quality] || 4); if ((tex.anisotropy || 1) < a && tex.minFilter !== THREE.NearestFilter) tex.anisotropy = a;
      queue.push(tex);
    }
  }
  function scan() {
    scene.traverse(o => { const ms = o.material; if (!ms) return;
      for (const m of Array.isArray(ms) ? ms : [ms]) { if (!m) continue; for (const k of COLOR) audit(m[k], true); for (const k of DATA) audit(m[k], false); } });
  }
  async function decode(tex) {
    const img = tex.image;
    if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement && img.decode) { try { await img.decode(); stats.decoded++; } catch (e) { /* ignore */ } }
  }
  const pending = new Set();
  function tick(dt) {
    if (!open) return; if (startT == null) startT = 0;
    t += dt; if (t > winS) return;
    if ((scanT -= dt) <= 0) { scanT = 2; scan(); }
    const budget = quality === 'low' ? 1.5 : 3, t0 = performance.now();
    let n = 0;
    while (queue.length && (n === 0 || performance.now() - t0 < budget)) {
      const tex = queue.shift();
      if (uploaded(tex) || !isImg(tex)) continue;
      if (!pending.has(tex) && tex.image instanceof (typeof HTMLImageElement !== 'undefined' ? HTMLImageElement : Object) && !tex._warmDecoded) { pending.add(tex); decode(tex).then(() => { tex._warmDecoded = true; pending.delete(tex); queue.push(tex); }); continue; }
      try { renderer.initTexture(tex); stats.uploaded++; } catch (e) { /* ignore */ }
      n++;
    }
  }
  return {
    tick,
    setQuality(q) { quality = q; },
    // 텍스처 예산(축소)이 끝난 뒤에 시작해야 같은 텍스처를 두 번 올리지 않는다
    after(p) { gate = Promise.resolve(p).catch(() => {}); gate.then(() => { open = true; scan(); }); },
    stats: () => ({ ...stats, queued: queue.length, t }),
  };
}
