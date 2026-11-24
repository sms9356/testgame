# Mina free-chat proxy (`server/minaChat`)

Optional server for the in-game "민아와 자유 대화 (AI)" feature. The game never talks to the Claude API directly and never holds an API key; it posts to this proxy, which calls Claude with the official `@anthropic-ai/sdk` and streams Mina's reply back.

## Run

```bash
cd server/minaChat
npm install
export ANTHROPIC_API_KEY=...        # or ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile — read by `new Anthropic()`
MINA_ALLOWED_ORIGINS="http://localhost:8000,app://game" npm start   # → http://127.0.0.1:8787/mina/chat
```

In the game: Settings › 게임 · 접근성 › 민아와 자유 대화 (AI) → turn on, enter `http://localhost:8787` (the `/mina/chat` path is added automatically). With an empty URL the feature is hidden. Once Mina is following you, press **T** near her (gamepad: Pause menu › 민아와 대화 (AI)).

| env | default | meaning |
|---|---|---|
| `PORT` / `HOST` | `8787` / `127.0.0.1` | listen address (put a TLS reverse proxy in front for public use) |
| `MINA_ALLOWED_ORIGINS` | `http://localhost:8000,http://127.0.0.1:8000,app://game` | CORS allow-list (`app://game` = the Electron/Steam build) |
| `MINA_RATE_PER_MIN` | `20` | requests per IP per minute |
| `MINA_TRUST_PROXY` | off | `1` = use `X-Forwarded-For` for the per-IP limit (only behind your own proxy) |
| `MINA_SECRET_CODES` | puzzle codes in `lib.mjs` | comma list of strings the reply may never contain |

The Electron build blocks all non-`app://` traffic; the endpoint the player enters is the one exception (`https://…/mina/chat`, or `http://localhost`), allowed through `desktop.setAiEndpoint` in `preload.cjs` / `main.cjs`.

## API

`POST /mina/chat` with JSON
`{ lang: "ko"|"en"|"ja"|"zh", playerText, context: { chapter, objective, location, itemsHeld[], discovered[], emotion, memorySummary, recentLines[] }, history: [{ role: "user"|"assistant", text }] }`

Response: `application/x-ndjson` — zero or more `{"t":"delta"}` lines then one `{"done":true,"text":"…","fallback":bool,"reason"?:…}`. The client always replaces the bubble with `done.text`. Errors and refusals still return 200 with `fallback:true` and an in-character line, so the game never breaks; 400 (validation), 403 (origin), 413 (body), 429 (rate limit) are returned before calling Claude.

## Guardrails

- **Frozen system prompt** (`SYSTEM_PROMPT` in `lib.mjs`) with `cache_control` on the system block: Mina's persona (2008 high-school student, Korean speech style), knows only the `discovered` list, never gives puzzle answers or future story beats, hints of increasing specificity, stays in-world, replies in the player's language, 1–3 sentences. Volatile game state goes in the user turn as `<game_context>` so the cached prefix never changes.
- Input caps (300 chars per message, last 8 turns, list/field caps), control-character stripping, code-like numbers redacted from context on both client and server.
- Output guard: secret codes are never forwarded — trailing digits are held back while streaming, and a reply containing a code is replaced with a fallback line.
- `stop_reason === "refusal"` → in-character fallback line. Server-side fallbacks requested with `betas: ["server-side-fallback-2026-07-01"], fallbacks: "default"` (a model without fallback support simply runs alone).
- Typed SDK errors (`RateLimitError`, `AuthenticationError`, `APIConnectionTimeoutError`, …) → fallback line + log; client-side timeout 15 s → the game's rule-based Mina line.

## Model and cost

`claude-opus-5-5`, adaptive thinking (default, `thinking` omitted), `output_config: { effort: "low" }` for chat latency, `max_tokens: 1024`, SDK timeout 20 s with 1 retry.
Rough per-message cost at Opus 5.5 list prices ($4 / $20 per MTok in/out; cache reads 0.05×): system prompt ≈ 1k tokens (cached after the first message within 5 minutes), context + history ≈ 0.5–1.5k uncached, reply + thinking ≈ 100–400 output tokens → roughly **$0.005–0.015 per message**. Thinking tokens are billed as output. Check `usage` in the server log (`cache_read` should be non-zero from the second message). Rate limit and caps bound the worst case; set a spend limit in the Claude Console.

## Tests

`npm test` at the repo root runs `tests/minaChat.test.mjs` with a mocked SDK client — no real API calls.
