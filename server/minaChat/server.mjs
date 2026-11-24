// Mina free-chat proxy: POST /mina/chat → streams Mina's reply as NDJSON.
//   {"t":"<text delta>"}                     zero or more
//   {"done":true,"text":"<final>","fallback":false}   exactly one, last
// The Anthropic API key never leaves this process: `new Anthropic()` reads ANTHROPIC_API_KEY
// (or ANTHROPIC_AUTH_TOKEN / an `ant auth login` profile) from the environment.
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { validateBody, buildRequest, guardReply, fallbackLine, safePrefixLength, createRateLimiter, parseOrigins, DEFAULT_SECRETS, LIMITS } from './lib.mjs';

export function createHandler({ client, origins = [], limiter = createRateLimiter(), secrets = DEFAULT_SECRETS, log = console, trustProxy = false } = {}) {
  const corsFor = origin => (origin && (origins.includes(origin) || origins.includes('*')) ? origin : null);
  return async function handle(req, res) {
    const origin = req.headers.origin;
    const allowed = corsFor(origin);
    if (allowed) { res.setHeader('Access-Control-Allow-Origin', allowed); res.setHeader('Vary', 'Origin'); }
    if (req.method === 'OPTIONS') {
      if (!allowed) { res.writeHead(403).end(); return; }
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' }).end(); return;
    }
    const url = (req.url || '').split('?')[0];
    if (url === '/healthz' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/plain' }).end('ok'); return; }
    if (url !== '/mina/chat' || req.method !== 'POST') { res.writeHead(404).end(); return; }
    if (origin && !allowed) { json(res, 403, { error: 'origin not allowed' }); return; }
    const ip = (trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket?.remoteAddress || 'unknown';
    if (!limiter(ip)) { json(res, 429, { error: 'rate limited' }); return; }

    let raw;
    try { raw = await readBody(req, LIMITS.bodyBytes); } catch (e) { json(res, 413, { error: 'body too large' }); return; }
    let body; try { body = JSON.parse(raw); } catch (e) { json(res, 400, { error: 'invalid JSON' }); return; }
    const v = validateBody(body, secrets);
    if (!v.ok) { json(res, 400, { error: v.error }); return; }
    const lang = v.value.lang;

    res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    const send = o => { try { res.write(JSON.stringify(o) + '\n'); } catch (e) { /* client went away */ } };
    const abort = new AbortController();
    res.on('close', () => abort.abort());
    let acc = '', sent = 0, tripped = false;
    try {
      const stream = client.beta.messages.stream(buildRequest(v.value), { signal: abort.signal });
      stream.on('text', delta => {
        if (tripped) return;
        acc += delta;
        if (secrets.some(c => c && acc.includes(c))) { tripped = true; return; }
        const upto = safePrefixLength(acc);
        if (upto > sent) { send({ t: acc.slice(sent, upto) }); sent = upto; }
      });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === 'refusal') {
        log.warn?.('[mina] refusal', msg.stop_details?.category ?? null);
        send({ done: true, text: fallbackLine(lang), fallback: true, reason: 'refusal' });
      } else {
        const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
        const g = guardReply(text, lang, secrets);
        send({ done: true, text: g.text, fallback: g.replaced || tripped, reason: g.replaced || tripped ? 'guard' : undefined });
        const u = msg.usage || {};
        log.info?.(`[mina] ok in=${u.input_tokens} cache_read=${u.cache_read_input_tokens} cache_write=${u.cache_creation_input_tokens} out=${u.output_tokens}`);
      }
    } catch (err) {
      let reason = 'error';
      if (err instanceof Anthropic.RateLimitError) reason = 'upstream_rate_limit';
      else if (err instanceof Anthropic.AuthenticationError) reason = 'auth';
      else if (err instanceof Anthropic.BadRequestError) reason = 'bad_request';
      else if (err instanceof Anthropic.APIConnectionTimeoutError) reason = 'timeout';
      else if (err instanceof Anthropic.APIConnectionError) reason = 'connection';
      else if (err instanceof Anthropic.APIError) reason = 'api_' + err.status;
      else if (abort.signal.aborted) reason = 'client_closed';
      log.warn?.('[mina] ' + reason, err?.message);
      send({ done: true, text: fallbackLine(lang, 2), fallback: true, reason });
    }
    try { res.end(); } catch (e) { /* ignore */ }
  };
}

function json(res, code, o) { res.writeHead(code, { 'Content-Type': 'application/json' }).end(JSON.stringify(o)); }
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > max) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = +process.env.PORT || 8787;
  const origins = parseOrigins(process.env.MINA_ALLOWED_ORIGINS || 'http://localhost:8000,http://127.0.0.1:8000,app://game');
  const secrets = process.env.MINA_SECRET_CODES ? parseOrigins(process.env.MINA_SECRET_CODES) : DEFAULT_SECRETS;
  const limiter = createRateLimiter({ max: +process.env.MINA_RATE_PER_MIN || 20, windowMs: 60_000 });
  const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
  const server = http.createServer(createHandler({ client, origins, limiter, secrets, trustProxy: process.env.MINA_TRUST_PROXY === '1' }));
  server.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`[mina] listening on http://${process.env.HOST || '127.0.0.1'}:${port}/mina/chat · origins: ${origins.join(', ')}`));
}
