// 민아와 자유 대화 (AI): 클라이언트 요청 만들기 · 서버 입력 검증 · 거절/오류 처리 (SDK 는 가짜 객체 — 실제 API 호출 없음)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { sanitizeContext, trimHistory, buildChatRequest, normalizeEndpoint, parseNdjsonChunk, requestReply, redactCodes } from '../minaChat.js';
import * as lib from '../server/minaChat/lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('client: context sanitization strips markup, control chars, codes and caps sizes', () => {
  const c = sanitizeContext({ chapter: '2.6', objective: '교무실 금고(1012) 열기 — <b>1998</b>년', location: 'x'.repeat(999), itemsHeld: Array.from({ length: 50 }, (_, i) => 'item' + i), discovered: ['캐비닛 2250', null, ''], emotion: 'scared\u0000', recentLines: 'nope' });
  assert.equal(c.chapter, 3);
  assert.ok(!c.objective.includes('1012') && c.objective.includes('1998') && !c.objective.includes('<b>'));
  assert.equal(c.location.length, 160);
  assert.equal(c.itemsHeld.length, 24);
  assert.deepEqual(c.discovered, ['캐비닛 ???']);
  assert.equal(c.emotion, 'scared');
  assert.deepEqual(c.recentLines, []);
  assert.equal(redactCodes('2008년 314호 0723'), '2008년 ???호 ???');
  assert.deepEqual(sanitizeContext(null).itemsHeld, []);
});

test('client: history trimming keeps last 8 turns, user-first, assistant-last', () => {
  const h = [];
  for (let i = 0; i < 20; i++) h.push({ role: 'user', text: 'q' + i }, { role: 'assistant', text: 'a' + i });
  const t = trimHistory(h);
  assert.equal(t.length, 16); assert.equal(t[0].text, 'q12'); assert.equal(t.at(-1).role, 'assistant');
  assert.deepEqual(trimHistory([{ role: 'assistant', text: 'hi' }, { role: 'system', text: 'x' }, { role: 'user', text: 'u' }]), []);
  const r = buildChatRequest({ lang: 'xx', playerText: ' 안녕 '.repeat(200), history: h, context: {} });
  assert.equal(r.lang, 'ko'); assert.ok(r.playerText.length <= 300); assert.equal(r.history.length, 16);
});

test('client: endpoint normalization and NDJSON parsing', () => {
  assert.equal(normalizeEndpoint(''), '');
  assert.equal(normalizeEndpoint('javascript:alert(1)'), '');
  assert.equal(normalizeEndpoint('http://localhost:8787'), 'http://localhost:8787/mina/chat');
  assert.equal(normalizeEndpoint('https://x.example/api/mina/chat'), 'https://x.example/api/mina/chat');
  const p = parseNdjsonChunk('{"t":"a"}\n{"done":true}\n{"t":');
  assert.equal(p.events.length, 2); assert.equal(p.rest, '{"t":');
});

test('client: requestReply falls back on offline / http error without throwing', async () => {
  const off = await requestReply('http://x/mina/chat', {}, { fetchImpl: async () => { throw new TypeError('offline'); } });
  assert.equal(off.fallback, true); assert.equal(off.text, '');
  const bad = await requestReply('http://x/mina/chat', {}, { fetchImpl: async () => ({ ok: false, status: 503 }) });
  assert.equal(bad.reason, 'http_503');
  const enc = new TextEncoder(); const parts = ['{"t":"안녕"}\n{"t":", 나야"}\n', '{"done":true,"text":"안녕, 나야","fallback":false}\n'];
  const body = { getReader() { let i = 0; return { read: async () => (i < parts.length ? { done: false, value: enc.encode(parts[i++]) } : { done: true }) }; } };
  const seen = [];
  const ok = await requestReply('http://x/mina/chat', {}, { fetchImpl: async () => ({ ok: true, body }), onDelta: s => seen.push(s) });
  assert.deepEqual(seen, ['안녕', '안녕, 나야']); assert.equal(ok.text, '안녕, 나야'); assert.equal(ok.fallback, false);
});

test('no API key or SDK in client code', () => {
  const files = fs.readdirSync(ROOT).filter(f => /\.(js|html|css|json)$/.test(f)).concat(fs.readdirSync(path.join(ROOT, 'desktop')).filter(f => /\.(c?js|json)$/.test(f)).map(f => 'desktop/' + f));
  for (const f of files) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!/sk-ant-[A-Za-z0-9_-]{10,}/.test(s), f + ' contains an Anthropic key');
    assert.ok(!/ANTHROPIC_API_KEY|x-api-key|@anthropic-ai\/sdk|api\.anthropic\.com/i.test(s), f + ' references the Anthropic API directly');
  }
});

test('server: input validation', () => {
  assert.equal(lib.validateBody(null).ok, false);
  assert.equal(lib.validateBody({ lang: 'fr', playerText: 'hi' }).ok, false);
  assert.equal(lib.validateBody({ lang: 'ko', playerText: '   ' }).ok, false);
  assert.equal(lib.validateBody({ lang: 'ko', playerText: 'x'.repeat(601) }).ok, false);
  const v = lib.validateBody({ lang: 'en', playerText: 'what now?', context: { objective: 'open safe (1012)', discovered: ['memo 2250'] }, history: [{ role: 'user', text: 'a' }, { role: 'assistant', text: 'b' }, { role: 'user', text: 'c' }] });
  assert.equal(v.ok, true);
  assert.ok(!JSON.stringify(v.value).includes('1012') && !JSON.stringify(v.value).includes('2250'));
  assert.equal(v.value.history.length, 2);
});

test('server: request shape — frozen cached system prompt, volatile context in user turn', () => {
  const v = lib.validateBody({ lang: 'ja', playerText: 'ヒントちょうだい', context: { chapter: 2, objective: 'x' } }).value;
  const a = lib.buildRequest(v), b = lib.buildRequest({ ...v, playerText: 'other', context: { ...v.context, chapter: 5 } });
  assert.equal(a.model, 'claude-opus-5-5');
  assert.equal(a.thinking, undefined);
  assert.deepEqual(a.output_config, { effort: 'low' });
  assert.deepEqual(a.betas, ['server-side-fallback-2026-07-01']); assert.equal(a.fallbacks, 'default');
  assert.deepEqual(a.system, b.system);
  assert.deepEqual(a.system[0].cache_control, { type: 'ephemeral' });
  assert.ok(a.messages.at(-1).content.includes('"reply_language":"ja"'));
  assert.ok(!a.system[0].text.includes('ヒント'));
  assert.ok(lib.SYSTEM_PROMPT.length > 2500, 'system prompt long enough to be cacheable');
});

test('server: reply guard, streaming hold-back, rate limiter', () => {
  assert.equal(lib.guardReply('금고 번호는 1012야', 'ko').replaced, true);
  assert.equal(lib.guardReply('**같이 가자**', 'ko').text, '같이 가자');
  assert.equal(lib.guardReply('', 'en').replaced, true);
  assert.equal(lib.safePrefixLength('번호는 10'), 4);
  assert.equal(lib.safePrefixLength('abc'), 3);
  let t = 0; const allow = lib.createRateLimiter({ max: 2, windowMs: 1000, now: () => t });
  assert.deepEqual([allow('a'), allow('a'), allow('a'), allow('b')], [true, true, false, true]);
  t = 1000; assert.equal(allow('a'), true);
});

// --- HTTP handler with a mocked SDK client ---
let server = null;
try { server = await import('../server/minaChat/server.mjs'); } catch (e) { /* SDK not installed: skip handler tests */ }
const fakeClient = (texts, final, err) => ({ beta: { messages: { stream(params) {
  fakeClient.last = params; const cbs = [];
  return { on(ev, cb) { if (ev === 'text') cbs.push(cb); return this; },
    async finalMessage() { if (err) throw err; for (const x of texts) cbs.forEach(cb => cb(x)); return final; } };
} } } });
async function call(handler, body, headers = {}) {
  const srv = http.createServer(handler); await new Promise(r => srv.listen(0, '127.0.0.1', r));
  try {
    const r = await fetch(`http://127.0.0.1:${srv.address().port}/mina/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
    const text = await r.text();
    return { status: r.status, lines: text.split('\n').filter(Boolean).map(l => JSON.parse(l)), headers: r.headers };
  } finally { srv.close(); }
}
const quiet = { info() {}, warn() {} };
const OK = { lang: 'ko', playerText: '이제 어디로 가?', context: { chapter: 2 } };

test('server handler: streams text and ends with done', { skip: !server && 'SDK not installed in server/minaChat' }, async () => {
  const h = server.createHandler({ client: fakeClient(['교무회의록', '을 다시 보자.'], { stop_reason: 'end_turn', content: [{ type: 'text', text: '교무회의록을 다시 보자.' }], usage: {} }), log: quiet });
  const r = await call(h, OK);
  assert.equal(r.status, 200);
  assert.equal(r.lines.filter(l => l.t).map(l => l.t).join(''), '교무회의록을 다시 보자.');
  assert.deepEqual(r.lines.at(-1), { done: true, text: '교무회의록을 다시 보자.', fallback: false });
});

test('server handler: refusal → in-character fallback', { skip: !server && 'SDK not installed' }, async () => {
  const h = server.createHandler({ client: fakeClient([], { stop_reason: 'refusal', stop_details: { category: 'cyber' }, content: [], usage: {} }), log: quiet });
  const r = await call(h, { ...OK, lang: 'en' });
  const d = r.lines.at(-1);
  assert.equal(d.fallback, true); assert.equal(d.reason, 'refusal'); assert.ok(lib.FALLBACK.en.includes(d.text));
});

test('server handler: secret code is never streamed', { skip: !server && 'SDK not installed' }, async () => {
  const h = server.createHandler({ client: fakeClient(['비밀번호는 10', '12야'], { stop_reason: 'end_turn', content: [{ type: 'text', text: '비밀번호는 1012야' }], usage: {} }), log: quiet });
  const r = await call(h, OK);
  assert.ok(!r.lines.map(l => l.t || l.text || '').join('').includes('1012'));
  assert.equal(r.lines.at(-1).fallback, true);
});

test('server handler: typed SDK errors → fallback; validation, CORS, rate limit', { skip: !server && 'SDK not installed' }, async () => {
  const { default: Anthropic } = await import('../server/minaChat/node_modules/@anthropic-ai/sdk/index.mjs').catch(() => import('@anthropic-ai/sdk'));
  const rl = new Anthropic.RateLimitError(429, { type: 'error', error: { type: 'rate_limit_error', message: 'slow' } }, 'slow', new Headers());
  let r = await call(server.createHandler({ client: fakeClient([], null, rl), log: quiet }), OK);
  assert.equal(r.lines.at(-1).reason, 'upstream_rate_limit'); assert.equal(r.lines.at(-1).fallback, true);
  r = await call(server.createHandler({ client: fakeClient([], null, new Anthropic.APIConnectionTimeoutError()), log: quiet }), OK);
  assert.equal(r.lines.at(-1).reason, 'timeout');
  const h = server.createHandler({ client: fakeClient([], { stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }], usage: {} }), origins: ['app://game'], log: quiet });
  assert.equal((await call(h, '{bad')).status, 400);
  assert.equal((await call(h, { lang: 'ko', playerText: '' })).status, 400);
  assert.equal((await call(h, OK, { Origin: 'https://evil.example' })).status, 403);
  r = await call(server.createHandler({ client: fakeClient([], { stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }], usage: {} }), origins: ['app://game'], log: quiet }), OK, { Origin: 'app://game' });
  assert.equal(r.headers.get('access-control-allow-origin'), 'app://game');
  const lim = server.createHandler({ client: fakeClient([], { stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }], usage: {} }), limiter: lib.createRateLimiter({ max: 1 }), log: quiet });
  assert.equal((await call(lim, OK)).status, 200);
  assert.equal((await call(lim, OK)).status, 429);
});
