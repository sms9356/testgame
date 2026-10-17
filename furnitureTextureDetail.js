// Fine surface wear for existing furniture PBR maps. No new images or larger maps.
// v2: irregular sparse stains, dents and paint chips; also covers authored wood/painted-steel model packs.
const TAU = Math.PI * 2;
const MATERIALS = new Set(['varnish', 'varnishDark', 'paint', 'locker', 'rust', 'door', 'modelWood', 'modelMetal']);
const patterns = new Map();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TINT_WOOD = [46, 32, 22], TINT_RUST = [104, 58, 33], CELLS = 12;
let clearTimer = 0;
// Pre-baked v2 detail textures (identical output, no load-time computation). Originals stay as fallback.
const BAKED = new Set(["tex_varnish_map","tex_varnish_normal","tex_varnish_rough","tex_varnishDark_map","tex_varnishDark_normal","tex_varnishDark_rough","tex_paint_map","tex_paint_normal","tex_paint_rough","tex_locker_map","tex_locker_normal","tex_locker_rough","tex_rust_map","tex_rust_normal","tex_rust_rough","tex_door_map","tex_door_normal","tex_door_rough","th102_old_wood_BaseColor","th102_old_wood_Normal","th102_old_wood_Roughness","th102_wood_edge_BaseColor","th102_wood_edge_Normal","th102_wood_edge_Roughness","th102_painted_steel_BaseColor","th102_painted_steel_Normal","th102_painted_steel_Roughness","th102_dark_metal_BaseColor","th102_dark_metal_Normal","th102_dark_metal_Roughness","th102_rust_BaseColor","th102_rust_Normal","th102_rust_Roughness","pr_aged_wood_counter_BaseColor","pr_aged_wood_counter_NormalGL","pr_aged_wood_counter_Roughness","pr_painted_rust_steel_BaseColor","pr_painted_rust_steel_NormalGL","pr_painted_rust_steel_Roughness"]);
export function bakedUrl(url) {
  const key = String(url || '').replace(/^assets\/(models\/)?/, '').replace('/tex/', '/').replace(/\.webp$/, '').replace(/\//g, '_');
  return BAKED.has(key) ? 'assets/tex/d2_' + key + '.webp' : null;
}

function hash(i, j, k, seed) { const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7 + seed) * 43758.5453; return s - Math.floor(s); }
// Integer frequencies keep every layer seamless when the texture repeats.
function warp(u, v, wood) {
  const a = wood ? .5 : 1;
  return [a * (.11 * Math.sin(TAU * (v * 37 + u * 11)) + .08 * Math.sin(TAU * (u * 19 - v * 29)) + .035 * Math.sin(TAU * (v * 67 + u * 23))),
          a * (.11 * Math.sin(TAU * (u * 31 - v * 13)) + .08 * Math.sin(TAU * (v * 17 + u * 27)) + .035 * Math.sin(TAU * (u * 61 - v * 41)))];
}
function splatStains(p, w, h, wood) {
  const seed = wood ? 17.3 : 71.9, cw = w / CELLS, chh = h / CELLS, s = p.stain;
  for (let j = 0; j < CELLS; j++) for (let i = 0; i < CELLS; i++) {
    if (hash(i, j, 4, seed) <= (wood ? .58 : .5)) continue;
    const ccx = i + hash(i, j, 1, seed), ccy = j + hash(i, j, 2, seed);
    const r = (wood ? .16 : .08) + hash(i, j, 3, seed) * (wood ? .3 : .22), reach = r + .3;
    const x0 = Math.floor((ccx - reach * (wood ? 1 : 1)) * cw), x1 = Math.ceil((ccx + reach) * cw);
    const y0 = Math.floor((ccy - reach) * chh), y1 = Math.ceil((ccy + reach) * chh);
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const u = px / w, v = py / h, d2 = warp(u, v, wood);
      const dx = u * CELLS + d2[0] - ccx, dy = (v * CELLS + d2[1] - ccy) * (wood ? 1.7 : 1);
      const d = Math.hypot(dx, dy); if (d >= r) continue;
      let val = wood ? 1 - d / r : Math.min(1, (r - d) / (r * .18));
      val = val * val * (3 - 2 * val);
      const idx = (((py % h) + h) % h) * w + (((px % w) + w) % w);
      if (val > s[idx]) s[idx] = val;
    }
  }
}
function pattern(name, w, h) {
  const wood = /varnish|door|Wood/.test(name), key = (wood ? 'wood' : 'metal') + ':' + w + 'x' + h;
  let p = patterns.get(key); if (p) return p;
  const X = Array.from({ length: 7 }, () => new Float32Array(w));
  const Y = Array.from({ length: 7 }, () => new Float32Array(h));
  for (let x = 0; x < w; x++) {
    const u = TAU * x / w, bend = .14 * Math.sin(u * 3) * TAU;
    X[0][x] = Math.sin(u * 3); X[1][x] = Math.cos(bend); X[2][x] = Math.sin(bend);
    X[3][x] = Math.sin(u * 37); X[4][x] = Math.sin(u * 113);
    X[5][x] = Math.cos(u * 23); X[6][x] = Math.sin(u * 7);
  }
  for (let y = 0; y < h; y++) {
    const v = TAU * y / h;
    Y[0][y] = Math.cos(v * 4); Y[1][y] = Math.sin(v * 72); Y[2][y] = Math.cos(v * 72);
    Y[3][y] = Math.cos(v * 41); Y[4][y] = Math.cos(v * 127);
    Y[5][y] = Math.cos(v * 19); Y[6][y] = Math.sin(v * 5);
  }
  const count = w * h;
  p = { key, w, h, wood, height: new Float32Array(count), tone: new Float32Array(count), rough: new Float32Array(count), tint: new Float32Array(count), stain: new Float32Array(count) };
  splatStains(p, w, h, wood);
  // Metal grid-like product waves are kept very faint; wood keeps its grain.
  const gT = wood ? .026 : .007, mT = wood ? .012 : .003, gR = wood ? .022 : .008, mR = wood ? .018 : .008;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, broad = X[0][x] * Y[0][y];
    const grain = wood ? Y[1][y] * X[1][x] + Y[2][y] * X[2][x] : X[3][x] * Y[3][y];
    const micro = X[4][x] * Y[4][y], dust = Math.max(0, broad - .35) / .65;
    const scratch = Math.max(0, ((wood ? Y[5][y] : X[5][x]) - .992) / .008) * Math.max(0, wood ? X[6][x] : Y[6][y]);
    const st = p.stain[i], ring = wood ? 0 : Math.max(0, 1 - Math.abs(st - .18) / .14) * (st < .5 ? 1 : 0);
    p.height[i] = grain * (wood ? .012 : .003) + micro * (wood ? .004 : .0015) - scratch * .018 - st * (wood ? .012 : .022);
    p.tone[i] = 1 + grain * gT + micro * mT - dust * .045 + scratch * .045 - (wood ? st * .08 : 0);
    p.rough[i] = grain * gR + micro * mR + dust * .085 + scratch * .10 + st * (wood ? .12 : .26);
    p.tint[i] = wood ? st * .28 : Math.max(0, st - .35) / .65 * .62;
    p.tone[i] *= 1 + ring * .1;   // thin lighter primer edge around paint chips
  }
  p.stain = null;
  if (patterns.size >= 4) patterns.delete(patterns.keys().next().value);
  patterns.set(key, p); return p;
}
export function clearFurnitureDetailCache() { patterns.clear(); }
function scheduleCacheClear() { clearTimeout(clearTimer); clearTimer = setTimeout(() => patterns.clear(), 4000); }
export function refineModelTexture(texture, url, channel) {
  const s = String(url || '').toLowerCase();
  const name = /wood/.test(s) ? 'modelWood' : /painted_steel|painted_rust_steel|rust|dark_metal/.test(s) ? 'modelMetal' : null;
  const ch = channel === 'BaseColor' ? 'map' : /^Normal/.test(channel) ? 'normal' : channel === 'Roughness' ? 'rough' : null;
  if (!name || !ch) return texture;
  const out = refineFurnitureTexture(texture, name, ch); scheduleCacheClear(); return out;
}
export function refineFurnitureTexture(texture, name, channel) {
  if (!texture || !MATERIALS.has(name) || !['map', 'normal', 'rough'].includes(channel)) return texture;
  if (texture.userData?.furnitureDetail?.name === name && texture.userData.furnitureDetail.channel === channel) return texture;
  if (channel === 'normal' && texture.flipY === false) return texture;
  const image = texture.image, w = image?.naturalWidth || image?.width, h = image?.naturalHeight || image?.height;
  if (!w || !h || w * h > 1024 * 1024) return texture;
  const start = performance.now();
  try {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return texture;
    ctx.drawImage(image, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h), data = pixels.data, p = pattern(name, w, h);
    const tc = p.wood ? TINT_WOOD : TINT_RUST;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, j = i * 4;
      if (data[j + 3] === 0) continue;
      if (channel === 'map') {
        const k = p.tint[i], t = p.tone[i];
        for (let c = 0; c < 3; c++) data[j + c] = clamp((data[j + c] * (1 - k) + tc[c] * k) * t, 0, 255);
      } else if (channel === 'rough') {
        const rough = clamp(data[j + 1] / 255 + p.rough[i], .12, .98);
        data[j] = data[j + 1] = data[j + 2] = Math.round(rough * 255);
      } else {
        const left = y * w + (x + w - 1) % w, right = y * w + (x + 1) % w;
        const up = ((y + h - 1) % h) * w + x, down = ((y + 1) % h) * w + x;
        let nx = data[j] / 127.5 - 1 - (p.height[right] - p.height[left]) * 2;
        let ny = data[j + 1] / 127.5 - 1 - (p.height[down] - p.height[up]) * 2;
        let nz = Math.max(.05, data[j + 2] / 127.5 - 1);
        const length = Math.hypot(nx, ny, nz);
        data[j] = (nx / length * .5 + .5) * 255;
        data[j + 1] = (ny / length * .5 + .5) * 255;
        data[j + 2] = (nz / length * .5 + .5) * 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    texture.image = canvas; texture.needsUpdate = true;
    texture.userData.furnitureDetail = { name, channel, width: w, height: h, milliseconds: performance.now() - start };
  } catch (error) {
    // Keep the original image when canvas access is unavailable.
    console.warn('[Furniture detail] original texture retained', name, channel, error.message);
  }
  return texture;
}
