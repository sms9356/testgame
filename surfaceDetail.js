// 텍스처 없는 단색 가구 · 장식 · 시설 재질에 가벼운 표면 디테일을 입힌다 (깨진 블록처럼 보이던 민무늬 면 보완)
// 256px 캔버스 텍스처 5종을 한 번만 만들어 모든 재질이 공유한다 — 색은 재질 color 가 곱해지므로 텍스처는 밝은 회색 계열
import * as THREE from './vendor/three.module.js';

const TEX = {};
const rnd = (() => { let s = 9; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
function canvas(draw) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); draw(g, 256);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const KINDS = {
  // 분체 도장 · 페인트: 얼룩진 농담 + 미세 반점 + 드문 긁힘
  paint: (g, n) => { g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 70; i++) { const v = 222 + rnd() * 30 | 0; g.fillStyle = `rgba(${v},${v},${v},.35)`; g.beginPath(); g.arc(rnd() * n, rnd() * n, 8 + rnd() * 34, 0, 7); g.fill(); }
    for (let i = 0; i < 2600; i++) { const v = 205 + rnd() * 50 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd() * n, rnd() * n, 1, 1); }
    g.strokeStyle = 'rgba(150,150,150,.35)'; for (let i = 0; i < 6; i++) { g.beginPath(); const x = rnd() * n, y = rnd() * n; g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 40, y + (rnd() - .5) * 12); g.stroke(); } },
  // 헤어라인 금속
  brushed: (g, n) => { for (let y = 0; y < n; y++) { const v = 214 + rnd() * 36 | 0; g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(0, y, n, 1); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(170,170,170,.25)'; g.fillRect(rnd() * n, rnd() * n, 20 + rnd() * 80, 1); } },
  // 나뭇결
  wood: (g, n) => { g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, n, n);
    for (let y = 0; y < n; y += 1) { const v = 205 + 40 * (.5 + .5 * Math.sin(y * .21 + Math.sin(y * .043) * 3)) * (.75 + rnd() * .25) | 0; g.fillStyle = `rgba(${v},${v},${v},.55)`; g.fillRect(0, y, n, 1); }
    for (let i = 0; i < 5; i++) { g.strokeStyle = 'rgba(150,150,150,.4)'; g.beginPath(); g.ellipse(rnd() * n, rnd() * n, 10 + rnd() * 10, 3 + rnd() * 3, 0, 0, 7); g.stroke(); } },
  // 유약 · 매끈한 플라스틱: 아주 옅은 지문 · 물자국
  glaze: (g, n) => { g.fillStyle = '#f6f6f6'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(200,200,200,.18)'; g.beginPath(); g.arc(rnd() * n, rnd() * n, 4 + rnd() * 20, 0, 7); g.fill(); } },
  // 거친 면 (콘크리트 · 고무 · 코르크 · 천)
  rough: (g, n) => { g.fillStyle = '#e8e8e8'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 9000; i++) { const v = 175 + rnd() * 80 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd() * n, rnd() * n, 1 + (rnd() < .1), 1 + (rnd() < .1)); }
    for (let i = 0; i < 30; i++) { g.fillStyle = 'rgba(185,185,185,.3)'; g.beginPath(); g.arc(rnd() * n, rnd() * n, 6 + rnd() * 22, 0, 7); g.fill(); } },
};
const tex = k => TEX[k] || (TEX[k] = canvas(KINDS[k]));
const SKIP = /window|screen|lamp|glass|sky|water|exit|sign|light|glow|ghost|mina|guard|char|hair|skin|eye|fx|particle|flame|fog|led|bulb/i;

function kindOf(m) {
  if (m.metalness >= .5) return 'brushed';
  if (m.roughness < .25) return 'glaze';
  const c = m.color, hsl = {}; c.getHSL(hsl);
  if (hsl.h > .03 && hsl.h < .12 && hsl.s > .25 && hsl.l < .55 && hsl.l > .08) return 'wood';
  if (m.roughness >= .85) return 'rough';
  return 'paint';
}
// 재질 하나에 디테일 (이미 맵이 있거나 투명 · 발광 · 특수 재질이면 그대로)
export function detailize(m, name = '') {
  if (!m || !m.isMeshStandardMaterial || m.map || m.userData.noDetail || m.userData.detailed) return false;
  if (m.transparent || m.opacity < 1 || m.wireframe || m.vertexColors) return false;
  if (m.emissive && m.emissiveIntensity > .2 && m.emissive.getHex() !== 0) return false;
  if (SKIP.test(name) || SKIP.test(m.name || '')) return false;
  const k = kindOf(m), t = tex(k); m.map = t;
  if (k !== 'glaze') { m.bumpMap = t; m.bumpScale = k === 'rough' ? .9 : .35; }
  m.userData.detailed = true; m.needsUpdate = true; return true;
}
// 장면(또는 그룹)을 훑어 UV 가 있는 민무늬 메시 재질에 디테일 — 같은 재질은 한 번만
export function autoDetail(root) {
  let n = 0;
  root.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh && o.userData.noDetail || !o.geometry || !o.geometry.attributes.uv) return;
    let nm = '', a = o; for (let i = 0; i < 4 && a; i++, a = a.parent) nm += ' ' + (a.name || '');
    for (const m of [].concat(o.material)) if (detailize(m, nm)) n++;
  });
  return n;
}
