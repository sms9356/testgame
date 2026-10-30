// 단색 가구 · 소품 재질 보강: 텍스처 없이 색만 있던 MeshStandardMaterial 에 표면 질감(노멀 · 거칠기 맵)을 입힌다.
// 색은 그대로 두고(맵 색이 곱해져 어두워지지 않게) 나뭇결 · 금속 결 · 도장면 요철만 더한다. 같은 재질은 한 번만 바꾼다.
import { pbr } from './tex.js?v=305';
const done = new WeakSet(), hsl = {};
const SKIP = /mina|guard|ghost|npc|char|sky|water|glass|screen|lamp|light/i;
function kindOf(m) {
  m.color.getHSL(hsl);
  if (m.metalness > .25 || (hsl.s < .1 && hsl.l > .3 && hsl.l < .75)) return 'locker';
  if (hsl.h > .02 && hsl.h < .13 && hsl.s > .2 && hsl.l < .72) return 'varnish';
  return 'paint';
}
export function upgradePlainMaterials(scene) {
  let n = 0;
  scene.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || !o.geometry || !o.geometry.attributes.uv) return;
    for (let a = o; a; a = a.parent) if (SKIP.test(a.name || '')) return;
    for (const m of [].concat(o.material)) {
      if (!m || done.has(m)) continue; done.add(m);
      if (!m.isMeshStandardMaterial || m.map || m.normalMap || m.transparent || m.alphaTest > 0 || SKIP.test(m.name || '')) continue;
      if (m.emissive && m.emissiveIntensity > 0 && m.emissive.getHex() !== 0) continue;
      const t = pbr(kindOf(m), () => ({}));
      if (!t.normalMap) continue;
      m.normalMap = t.normalMap; m.normalScale.set(.6, .6);
      if (t.roughnessMap && m.roughness > .3) { m.roughnessMap = t.roughnessMap; }
      m.needsUpdate = true; n++;
    }
  });
  return n;
}
