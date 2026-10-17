// Fine surface wear for existing furniture PBR maps. No new images or larger maps.
const TAU = Math.PI * 2;
const MATERIALS = new Set(['varnish', 'varnishDark', 'paint', 'locker', 'rust', 'door']);
const patterns = new Map();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function surfaceDetail(u, v, wood = false) {
  // Integer-frequency waves tile seamlessly. Wear is shared across PBR channels.
  const broad = Math.sin(TAU * u * 3) * Math.cos(TAU * v * 4);
  const grain = wood ? Math.sin(TAU * (v * 72 + .14 * Math.sin(TAU * u * 3))) : Math.sin(TAU * u * 37) * Math.cos(TAU * v * 41);
  const micro = Math.sin(TAU * u * 113) * Math.cos(TAU * v * 127);
  const dust = Math.max(0, broad - .35) / .65;
  const scratchWave = Math.cos(TAU * (wood ? v * 19 : u * 23));
  const scratch = Math.max(0, (scratchWave - .992) / .008) * Math.max(0, Math.sin(TAU * (wood ? u * 7 : v * 5)));
  return {
    height: grain * (wood ? .012 : .006) + micro * .004 - scratch * .018,
    tone: 1 + grain * .026 + micro * .012 - dust * .045 + scratch * .045,
    rough: grain * .022 + micro * .018 + dust * .085 + scratch * .10
  };
}
function pattern(name, w, h) {
  const wood = /varnish|door/.test(name), key = (wood ? 'wood' : 'metal') + ':' + w + 'x' + h;
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
  p = { key, w, h, height: new Float32Array(count), tone: new Float32Array(count), rough: new Float32Array(count) };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, broad = X[0][x] * Y[0][y];
    const grain = wood ? Y[1][y] * X[1][x] + Y[2][y] * X[2][x] : X[3][x] * Y[3][y];
    const micro = X[4][x] * Y[4][y], dust = Math.max(0, broad - .35) / .65;
    const scratch = Math.max(0, ((wood ? Y[5][y] : X[5][x]) - .992) / .008) * Math.max(0, wood ? X[6][x] : Y[6][y]);
    p.height[i] = grain * (wood ? .012 : .006) + micro * .004 - scratch * .018;
    p.tone[i] = 1 + grain * .026 + micro * .012 - dust * .045 + scratch * .045;
    p.rough[i] = grain * .022 + micro * .018 + dust * .085 + scratch * .10;
  }
  if (patterns.size >= 3) patterns.delete(patterns.keys().next().value);
  patterns.set(key, p); return p;
}
export function clearFurnitureDetailCache() { patterns.clear(); }
export function refineFurnitureTexture(texture, name, channel) {
  if (!texture || !MATERIALS.has(name) || !['map', 'normal', 'rough'].includes(channel)) return texture;
  if (texture.userData?.furnitureDetail?.name === name && texture.userData.furnitureDetail.channel === channel) return texture;
  if (channel === 'normal' && texture.flipY === false) return texture;
  const image = texture.image, w = image?.naturalWidth || image?.width, h = image?.naturalHeight || image?.height;
  if (!w || !h || w * h > 1024 * 1024) return texture;
  const start = performance.now();
  let p;
  try {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return texture;
    ctx.drawImage(image, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h), data = pixels.data;
    p = pattern(name, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, j = i * 4;
      if (data[j + 3] === 0) continue;
      if (channel === 'map') {
        for (let c = 0; c < 3; c++) data[j + c] = clamp(data[j + c] * p.tone[i], 0, 255);
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
