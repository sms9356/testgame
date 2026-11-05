// 단색 가구 · 소품 재질 보강: 텍스처 없이 색만 있던 MeshStandardMaterial 에 표면 질감(노멀 · 거칠기 맵)을 입힌다.
// 색은 그대로 두고(맵 색이 곱해져 어두워지지 않게) 결 · 요철 · 거칠기 변화만 더한다. 같은 재질은 한 번만 바꾼다.
// 재질 종류: 금속(헤어라인) · 니스 목재 · 도장면 · 직물(의자 · 커튼 · 매트) · 무광 플라스틱/고무(약하게) · 콘크리트/석재
import { pbr } from './tex.js?v=404';
const done = new WeakSet(), hsl = {};
const SKIP = /mina|guard|ghost|npc|char|sky|water|glass|screen|lamp|light/i;
function kindOf(m) {
  m.color.getHSL(hsl);
  if (m.metalness > .4) return ['bc_metal', .5];                                                     // 금속: 헤어라인 · 미세 긁힘
  if (m.metalness > .25 || (hsl.s < .1 && hsl.l > .3 && hsl.l < .75 && m.roughness < .7)) return ['locker', .6];
  if (hsl.h > .02 && hsl.h < .13 && hsl.s > .2 && hsl.l < .72) return ['varnish', .6];                // 니스 목재
  if (hsl.l < .16) return ['paint', .3];                                                              // 검은 플라스틱 · 고무: 은은하게
  if (m.roughness >= .85 && hsl.s > .15) return ['bc_fabric', .7];                                    // 천 · 쿠션 · 매트
  if (m.roughness >= .85 && hsl.s <= .15) return ['wall', .8];                                        // 콘크리트 · 석재 · 시멘트
  return ['paint', .6];
}
const _box = { x: 0, y: 0, z: 0 };
function tooLong(g) { if (!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox; return !b || Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) > 4; }   // 긴 배관 · 벽판: 질감이 늘어나 오히려 어색하다
export function upgradePlainMaterials(root) {
  let n = 0;
  root.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || !o.geometry || !o.geometry.attributes.uv) return;
    for (let a = o; a; a = a.parent) if (SKIP.test(a.name || '')) return;
    if (tooLong(o.geometry)) return;
    for (const m of [].concat(o.material)) {
      if (!m || done.has(m)) continue; done.add(m);
      if (!m.isMeshStandardMaterial || m.map || m.normalMap || m.transparent || m.alphaTest > 0 || SKIP.test(m.name || '')) continue;
      if (m.emissive && m.emissiveIntensity > 0 && m.emissive.getHex() !== 0) continue;
      const [kind, ns] = kindOf(m), t = pbr(kind, () => ({}));
      if (!t.normalMap) continue;
      m.normalMap = t.normalMap; m.normalScale.set(ns, ns);
      if (t.roughnessMap && m.roughness > .3) { m.roughnessMap = t.roughnessMap; }
      m.needsUpdate = true; n++;
    }
  });
  return n;
}
