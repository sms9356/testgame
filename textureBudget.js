// Runtime-only static image budget. Originals stay intact for explicit high quality.
export function createTextureBudget({ quality = 'mid', batchSize = 2,
  yieldTask = () => new Promise(resolve => setTimeout(resolve, 0)),
  makeCanvas = () => document.createElement('canvas'),
  isStaticImage = image => (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) ||
    (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap),
} = {}) {
  const caps = { low: 512, mid: 1024, high: 1024, ultra: Infinity };   // 높음도 1K: 2K · 4K 텍스처 한 장 올리는 데 수십~수백 ms 씩 멈췄다 (최고 품질만 원본)
  const records = new Map(), originals = new WeakMap();
  let revision = 0, pending = Promise.resolve();
  function register(texture) {
    if (!texture?.isTexture || texture.isRenderTargetTexture || texture.isVideoTexture ||
        texture.isDataTexture || texture.isCompressedTexture || texture.isCubeTexture || texture.mipmaps?.length) return;
    const source = texture.source, image = source?.data;
    let record = records.get(source);
    if (!record) {
      if (!isStaticImage(image) || !(image.width > 0 && image.height > 0)) return;
      let shared = originals.get(image);
      if (!shared) { shared = { image, cache: new Map() }; originals.set(image, shared); }
      record = { source, shared, textures: new Set() }; records.set(source, record);
    }
    record.textures.add(texture);
  }
  function resized(shared, cap) {
    const image = shared.image, size = Math.max(image.width, image.height);
    if (size <= cap) return image;
    if (shared.cache.has(cap)) return shared.cache.get(cap);
    const canvas = makeCanvas();
    canvas.width = Math.max(1, Math.round(image.width * cap / size));
    canvas.height = Math.max(1, Math.round(image.height * cap / size));
    const ctx = canvas.getContext('2d');
    if (!ctx) return image;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    shared.cache.set(cap, canvas); return canvas;
  }
  async function process(version) {
    let count = 0;
    for (const record of records.values()) {
      if (version !== revision) return;
      let image;
      try { image = resized(record.shared, caps[quality]); } catch { continue; }
      if (record.source.data !== image) {
        // Release all known GPU variants before replacing a shared Three.Source.
        for (const texture of record.textures) texture.dispose();
        record.source.data = image;
        for (const texture of record.textures) texture.needsUpdate = true;
        if (++count % batchSize === 0) await yieldTask();
      }
    }
  }
  function enqueue() {
    const version = ++revision;
    pending = pending.then(() => process(version)); return pending;
  }
  function collect(root) {
    root.traverse(object => {
      for (const material of [].concat(object.material || [])) {
        for (const value of Object.values(material)) if (value?.isTexture) register(value);
      }
    });
  }
  return {
    prepareTextures(textures) { for (const texture of textures) register(texture); return enqueue(); },
    prepare(root) { collect(root); return enqueue(); },
    setQuality(value) {
      if (!(value in caps)) throw new Error('Unknown texture quality: ' + value);
      if (quality === value) return pending;
      quality = value; return enqueue();
    },
    ready() { return pending; },
    stats() {
      const current = new Map(), original = new Map();
      for (const record of records.values()) {
        const mip = [...record.textures].some(t => t.generateMipmaps) ? 4 / 3 : 1;
        current.set(record.source.data, Math.max(current.get(record.source.data) || 0, mip));
        original.set(record.shared.image, Math.max(original.get(record.shared.image) || 0, mip));
      }
      const bytes = images => [...images].reduce((sum, [image, mip]) => sum + image.width * image.height * 4 * mip, 0);
      return { quality, sources: records.size, originalImages: original.size,
        originalEstimatedMiB: bytes(original) / 1048576, currentEstimatedMiB: bytes(current) / 1048576 };
    },
  };
}
