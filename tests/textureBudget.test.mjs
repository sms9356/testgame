import assert from 'node:assert/strict';
import { createTextureBudget } from '../textureBudget.js';
const image = (width, height, kind = 'image') => ({ width, height, kind });
const texture = (source, extra = {}) => ({ isTexture: true, source, generateMipmaps: true,
  mipmaps: [], disposed: 0, dispose() { this.disposed++; }, colorSpace: 'srgb', wrapS: 1000,
  minFilter: 1008, channel: 1, ...extra });
let yields = 0, draws = 0;
const budget = createTextureBudget({ quality: 'low', batchSize: 1,
  isStaticImage: i => ['image', 'bitmap'].includes(i.kind),
  yieldTask: async () => { yields++; },
  makeCanvas: () => ({ kind: 'canvas', getContext: () => ({ drawImage() { draws++; } }) }),
});
const original = image(2048, 1024), source = { data: original };
const a = texture(source), b = texture(source), clone = texture({ data: original });
const bitmap = texture({ data: image(1024, 2048, 'bitmap') });
const excluded = [texture({ data: image(2048, 2048, 'canvas') }),
  texture({ data: image(2048, 2048) }, { isRenderTargetTexture: true }),
  texture({ data: image(2048, 2048) }, { isVideoTexture: true }),
  texture({ data: image(2048, 2048) }, { mipmaps: [{}] }),
  texture({ data: image(2048, 2048) }, { isDataTexture: true })];
await budget.prepareTextures([a, b, clone, bitmap, ...excluded]);
assert.equal(source.data.width, 512); assert.equal(source.data.height, 256);
assert.equal(bitmap.source.data.width, 256); assert.equal(bitmap.source.data.height, 512);
assert.equal(clone.source.data, source.data); assert.equal(draws, 2);
assert.equal(a.disposed, 1); assert.equal(b.disposed, 1); assert.equal(a.needsUpdate, true);
assert.equal(a.colorSpace, 'srgb'); assert.equal(a.wrapS, 1000); assert.equal(a.channel, 1);
assert.equal(a.minFilter, 1008); assert.equal(a.generateMipmaps, true);
assert(excluded.every(t => t.disposed === 0)); assert(yields >= 2);
const low = source.data; const stats = budget.stats();
assert.equal(stats.originalImages, 2); assert.equal(stats.sources, 3);
assert(stats.currentEstimatedMiB < stats.originalEstimatedMiB);
await budget.setQuality('high'); assert.equal(source.data, original);
assert.equal(clone.source.data, original); assert.equal(original.width, 2048);
await budget.setQuality('mid'); assert.equal(source.data.width, 1024);
await budget.setQuality('low'); assert.equal(source.data, low); assert.equal(draws, 4);
const late = texture({ data: image(4096, 1024) });
await budget.prepare({ traverse(fn) { fn({ material: [{ map: late }] }); } });
assert.equal(late.source.data.width, 512); assert.equal(late.source.data.height, 128);
await Promise.all([budget.setQuality('high'), budget.setQuality('mid'), budget.setQuality('low')]);
assert.equal(source.data, low); assert.equal(late.source.data.width, 512);
assert.throws(() => budget.setQuality('bogus'));
console.log('PASS: aspect, shared-source/image cache, exclusions, restore, metadata/mips, batching, late models, rapid switches, deduped estimates');
