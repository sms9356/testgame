// 서린고 : 잊혀진 시간 — 동행 NPC 민아의 길찾기 · 따라가기 · 대화
//   · 길찾기: 층마다 기존 충돌체(RBG.groundAt / RBG.blocked)로 만든 걷기 격자 + A* + 시야 직선화
//   · 동행: 민아 한 명 — 플레이어 뒤를 따라 길을 찾아 걷고(문 · 계단 · 구름다리 · 별관 · 현관 밖), 막히면 비켜서고, 멀어지면 뛰어 따라잡는다
//   · 다른 사람들(경비 · 당직 선생님 · 청소 · 학생)은 걷지 않는다 — 목소리 · 회상 · 경비실 CCTV 녹화로만
//   · 충돌체가 없다(플레이어 길을 막지 않음) — 가까이 오면 비켜선다. 자리 · 기억은 세이브의 npc 칸에 (serialize / restore)
//   · 층 사이는 계단을 실제로 걷는다(계단실 안 (칸 · 높이) 탐색으로 잰 길) · 본관 1~4층 + 구름다리 + 별관 + 바깥(현관 ~ 경비실 · 정문)
//   · 대사: npcMind.js — 장 · 소지품 · 시간 · 차단기 상태로 고르고, 한 말을 기억하며 힌트를 막연 → 구체로 · 사건 반응(정전 · 처음 온 방 · 증거 · 계단)
//   · 끄기: ?nonpc (민아는 예전 따라가기로)
// 앞부분(격자 · A* · 상태 기계)은 THREE 없이 동작한다 (tests/npcAI.test.mjs)
import { approach, turnSpeed, createLineGate, createSpeechQueue, PRIO, hintDirector as HD, idleBehavior, occludes, canTeleportUnseen, MUTTER_IDS, EXAM_IDS } from './minaDirector.js?v=460';
import { pickSeat, seatAcross, seatHeight, seatFront, itemComment, decorFor } from './minaInteract.js?v=460';
import { MIND_VER, MINA_LINES, newMemory, sanitizeMemory, pickLine, reactLine, canReact, markReact, EMO_LINE, EMO_FOLLOW, emotionOf, hintLine, EMOTIONS, CH_HINT as CH_HINT_ } from './npcMind.js?v=460';

// ───────────────────────── 1. 걷기 격자 ─────────────────────────
export function createNavGrid({ x0, z0, x1, z1, cell = .3 }) {
  const nx = Math.max(1, Math.ceil((x1 - x0) / cell)), nz = Math.max(1, Math.ceil((z1 - z0) / cell)), N = nx * nz;
  return { x0, z0, cell, nx, nz, w: new Uint8Array(N), built: 0, ready: false,
    g: new Float32Array(N), par: new Int32Array(N), seen: new Uint32Array(N), closed: new Uint32Array(N), stamp: 0, heap: new Int32Array(N), hf: new Float32Array(N), maxIter: Math.max(60000, N), comp: null };
}
// walk(x, z) → 걸을 수 있나. budget 칸까지만 채우고 다 채웠으면 true (프레임마다 나눠 만든다)
export function buildNavGrid(G, walk, budget = Infinity) {
  const N = G.nx * G.nz; let n = 0;
  while (G.built < N && n < budget) { const i = G.built++, ix = i % G.nx, iz = (i / G.nx) | 0; G.w[i] = walk(G.x0 + (ix + .5) * G.cell, G.z0 + (iz + .5) * G.cell) ? 1 : 0; n++; }
  if (G.built >= N) G.ready = true; return G.ready;
}
export const cellOf = (G, x, z) => { const ix = Math.floor((x - G.x0) / G.cell), iz = Math.floor((z - G.z0) / G.cell); return ix < 0 || iz < 0 || ix >= G.nx || iz >= G.nz ? -1 : iz * G.nx + ix; };
export const walkableAt = (G, x, z) => { const c = cellOf(G, x, z); return c >= 0 && G.w[c] === 1; };
// 가장 가까운 걸을 수 있는 칸 (나선형 · 반경 maxR m) → 칸 번호 또는 -1
export function nearestFree(G, x, z, maxR = 3) {
  const c0 = cellOf(G, x, z); if (c0 >= 0 && G.w[c0]) return c0;
  const ix = Math.floor((x - G.x0) / G.cell), iz = Math.floor((z - G.z0) / G.cell), R = Math.ceil(maxR / G.cell);
  let best = -1, bd = Infinity;
  for (let r = 1; r <= R; r++) {
    for (let a = -r; a <= r; a++) for (let s = 0; s < 4; s++) {
      const i = s === 0 ? ix + a : s === 1 ? ix + a : s === 2 ? ix - r : ix + r, k = s === 0 ? iz - r : s === 1 ? iz + r : iz + a;
      if (i < 0 || k < 0 || i >= G.nx || k >= G.nz) continue; const c = k * G.nx + i; if (!G.w[c]) continue;
      const d = (i - ix) * (i - ix) + (k - iz) * (k - iz); if (d < bd) { bd = d; best = c; }
    }
    if (best >= 0) return best;
  }
  return -1;
}
// 격자 위 직선 시야: 선분을 반 칸 간격으로 짚어 모두 걸을 수 있으면 true
export function gridLOS(G, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz), n = Math.ceil(L / (G.cell * .5));
  for (let i = 1; i <= n; i++) { const t = i / n; if (!walkableAt(G, ax + dx * t, az + dz * t)) return false; }
  return true;
}
// A* (8방향 · 모서리 끊기 없음 · 옥타일 휴리스틱). out: Float32Array (x, z 쌍) — 직선화한 경로 점 개수를 돌려준다(못 찾으면 0)
const SQ2 = Math.SQRT2;
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQ2], [1, -1, SQ2], [-1, 1, SQ2], [-1, -1, SQ2]];
export function astar(G, sx, sz, gx, gz, out, maxPts = out.length >> 1) {
  const s = nearestFree(G, sx, sz, 1.5), t = nearestFree(G, gx, gz, 2.5); if (s < 0 || t < 0) return 0;
  const nx = G.nx, tx = t % nx, tz = (t / nx) | 0, st = ++G.stamp, heap = G.heap, hf = G.hf;
  const H = c => { const ax = Math.abs(c % nx - tx), az = Math.abs(((c / nx) | 0) - tz); return (ax + az) + (SQ2 - 2) * Math.min(ax, az); };
  let hn = 0;
  const push = (c, f) => { let i = hn++; while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= f) break; heap[i] = heap[p]; hf[i] = hf[p]; i = p; } heap[i] = c; hf[i] = f; };
  const pop = () => { const top = heap[0], lc = heap[--hn], lf = hf[hn]; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= hn) break; if (c + 1 < hn && hf[c + 1] < hf[c]) c++; if (hf[c] >= lf) break; heap[i] = heap[c]; hf[i] = hf[c]; i = c; } heap[i] = lc; hf[i] = lf; return top; };
  G.g[s] = 0; G.par[s] = -1; G.seen[s] = st; push(s, H(s)); let found = false, iter = 0;
  while (hn > 0) {
    const c = pop(); if (G.closed[c] === st) continue; G.closed[c] = st; if (c === t) { found = true; break; }
    if (++iter > G.maxIter) break;
    const cx = c % nx, cz = (c / nx) | 0;
    for (let k = 0; k < 8; k++) {
      const D = DIRS[k], ax = cx + D[0], az = cz + D[1]; if (ax < 0 || az < 0 || ax >= nx || az >= G.nz) continue;
      const n = az * nx + ax; if (!G.w[n] || G.closed[n] === st) continue;
      if (D[2] !== 1 && (!G.w[cz * nx + ax] || !G.w[az * nx + cx])) continue;   // 대각선은 양옆이 비었을 때만
      const ng = G.g[c] + D[2]; if (G.seen[n] === st && ng >= G.g[n]) continue;
      G.seen[n] = st; G.g[n] = ng; G.par[n] = c; push(n, ng + H(n) * 1.001);
    }
  }
  if (!found) return 0;
  // 칸 사슬(목표 → 출발) 길이
  let len = 0; for (let c = t; c >= 0; c = G.par[c]) len++;
  // 직선화: 출발에서 시야가 닿는 가장 먼 칸까지 건너뛴다 (뒤에서부터 칸 목록을 heap 버퍼에 거꾸로 펼쳐 둔다)
  const chain = heap; { let i = len - 1; for (let c = t; c >= 0; c = G.par[c]) chain[i--] = c; }
  const cx = c => G.x0 + (c % nx + .5) * G.cell, cz = c => G.z0 + (((c / nx) | 0) + .5) * G.cell;
  let n = 0, ax = sx, az = sz, i = 0;
  if (!walkableAt(G, ax, az)) { ax = cx(s); az = cz(s); out[0] = ax; out[1] = az; n = 1; }
  while (i < len - 1 && n < maxPts - 1) {
    let j = len - 1; while (j > i + 1 && !gridLOS(G, ax, az, cx(chain[j]), cz(chain[j]))) j--;
    ax = cx(chain[j]); az = cz(chain[j]); out[n * 2] = ax; out[n * 2 + 1] = az; n++; i = j;
  }
  if (n === 0) { out[0] = cx(t); out[1] = cz(t); n = 1; }
  // 마지막 점: 목표 자체가 걸을 수 있으면 정확한 목표로
  if (walkableAt(G, gx, gz) && gridLOS(G, out[n * 2 - 2], out[n * 2 - 1], gx, gz)) { out[n * 2 - 2] = gx; out[n * 2 - 1] = gz; }
  return n;
}
// 연결 요소 번호 (4방향 · 같은 번호 = 서로 걸어갈 수 있다). G.comp[c] = 번호(0~) · 막힘 -1 → 요소 개수
export function labelComponents(G) {
  const N = G.nx * G.nz, comp = G.comp ||= new Int32Array(N), q = G.heap; comp.fill(-1); let nc = 0;
  for (let s = 0; s < N; s++) { if (!G.w[s] || comp[s] >= 0) continue; let h = 0, t = 0; q[t++] = s; comp[s] = nc;
    while (h < t) { const c = q[h++], ix = c % G.nx, iz = (c / G.nx) | 0;
      if (ix > 0 && G.w[c - 1] && comp[c - 1] < 0) { comp[c - 1] = nc; q[t++] = c - 1; }
      if (ix < G.nx - 1 && G.w[c + 1] && comp[c + 1] < 0) { comp[c + 1] = nc; q[t++] = c + 1; }
      if (iz > 0 && G.w[c - G.nx] && comp[c - G.nx] < 0) { comp[c - G.nx] = nc; q[t++] = c - G.nx; }
      if (iz < G.nz - 1 && G.w[c + G.nx] && comp[c + G.nx] < 0) { comp[c + G.nx] = nc; q[t++] = c + G.nx; } }
    nc++; }
  G.ncomp = nc; return nc;
}
export const compAt = (G, x, z, r = 1.5) => { if (!G || !G.comp) return -1; const c = nearestFree(G, x, z, r); return c < 0 ? -1 : G.comp[c]; };
// 층 사이 길(계단 · 출입문): portal { la, lb, ax, az, bx, bz, pts(x,y,z…), cum, len, ca, cb } — la 쪽 a 에서 lb 쪽 b 로
export function makePortal(la, lb, pts, extra) {
  const n = pts.length / 3, cum = new Float32Array(n); for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 3] - pts[i * 3 - 3], pts[i * 3 + 1] - pts[i * 3 - 2], pts[i * 3 + 2] - pts[i * 3 - 1]);
  const P = { la, lb, ax: pts[0], az: pts[2], bx: pts[(n - 1) * 3], bz: pts[(n - 1) * 3 + 2], pts: Float32Array.from(pts), cum, len: cum[n - 1], ca: -1, cb: -1, ...extra };
  P.fwd = { p: P, dir: 1 }; P.back = { p: P, dir: -1 }; return P;
}
// 계단 위 위치: 거리 d (출발 쪽에서) → o.x · o.y · o.z · o.hx · o.hz(진행 방향). o.si 는 지난 구간 번호(앞으로만 훑는다)
export function portalPos(hop, d, o) {
  const p = hop.p, cum = p.cum, n = cum.length, pts = p.pts, s = hop.dir > 0 ? Math.max(0, Math.min(p.len, d)) : Math.max(0, Math.min(p.len, p.len - d));
  let i = Math.max(0, Math.min(n - 2, o.si | 0));
  while (i < n - 2 && cum[i + 1] < s) i++; while (i > 0 && cum[i] > s) i--; o.si = i;
  const seg = cum[i + 1] - cum[i], k = seg > 1e-6 ? (s - cum[i]) / seg : 1, a = i * 3, b = a + 3;
  o.x = pts[a] + (pts[b] - pts[a]) * k; o.y = pts[a + 1] + (pts[b + 1] - pts[a + 1]) * k; o.z = pts[a + 2] + (pts[b + 2] - pts[a + 2]) * k;
  o.hx = (pts[b] - pts[a]) * hop.dir; o.hz = (pts[b + 2] - pts[a + 2]) * hop.dir; return o;
}
// 층(요소) 사이 경로: 출발 (la, ca, x, z) → 목표 (lb, cb, tx, tz). 첫 번째로 지날 portal 의 hop 을 돌려준다
//   null = 같은 요소(곧장 걸어가면 됨) · false = 이을 길 없음. 비용 = 평지 직선거리 × 1.3 + 계단 길이 (portal 수십 개 → 다익스트라)
const RT = { cost: new Float64Array(256), first: new Array(256), done: new Uint8Array(256) };
export function routeHop(portals, la, ca, x, z, lb, cb, tx, tz) {
  if (la === lb && ca === cb && ca >= 0) return null;
  if (ca < 0 || cb < 0) return la === lb ? null : false;
  const P = portals, m = P.length * 2; if (m > 256) return false;
  const C = RT.cost, F = RT.first, D = RT.done; C.fill(Infinity, 0, m); D.fill(0, 0, m);
  // 노드 2i = portal i 의 b 끝에 도착(위로 건넘) · 2i+1 = a 끝에 도착(아래로)
  const endL = j => (j & 1 ? P[j >> 1].la : P[j >> 1].lb), endC = j => (j & 1 ? P[j >> 1].ca : P[j >> 1].cb);
  const endX = j => (j & 1 ? P[j >> 1].ax : P[j >> 1].bx), endZ = j => (j & 1 ? P[j >> 1].az : P[j >> 1].bz);
  for (let i = 0; i < P.length; i++) { const p = P[i];
    if (p.la === la && p.ca === ca) { const c = Math.hypot(p.ax - x, p.az - z) * 1.3 + p.len; if (c < C[2 * i]) { C[2 * i] = c; F[2 * i] = p.fwd; } }
    if (p.lb === la && p.cb === ca) { const c = Math.hypot(p.bx - x, p.bz - z) * 1.3 + p.len; if (c < C[2 * i + 1]) { C[2 * i + 1] = c; F[2 * i + 1] = p.back; } } }
  let best = Infinity, bestHop = false;
  for (;;) {
    let j = -1, cj = Infinity; for (let q = 0; q < m; q++) if (!D[q] && C[q] < cj) { cj = C[q]; j = q; }
    if (j < 0 || cj >= best) break; D[j] = 1;
    const L = endL(j), Cc = endC(j), ex = endX(j), ez = endZ(j);
    if (L === lb && Cc === cb) { const c = cj + Math.hypot(tx - ex, tz - ez) * 1.3; if (c < best) { best = c; bestHop = F[j]; } continue; }
    for (let i = 0; i < P.length; i++) { const p = P[i];
      if (p.la === L && p.ca === Cc) { const c = cj + Math.hypot(p.ax - ex, p.az - ez) * 1.3 + p.len; if (c < C[2 * i]) { C[2 * i] = c; F[2 * i] = F[j]; } }
      if (p.lb === L && p.cb === Cc) { const c = cj + Math.hypot(p.bx - ex, p.bz - ez) * 1.3 + p.len; if (c < C[2 * i + 1]) { C[2 * i + 1] = c; F[2 * i + 1] = F[j]; } } }
  }
  return bestHop;
}
// 문자 지도 → 격자 (테스트 · 디버그용): '#' 막힘, 그 밖은 통로
export function gridFromAscii(rows, cell = 1) {
  const G = createNavGrid({ x0: 0, z0: 0, x1: rows[0].length * cell, z1: rows.length * cell, cell });
  buildNavGrid(G, (x, z) => rows[Math.floor(z / cell)][Math.floor(x / cell)] !== '#'); return G;
}

// ───────────────────────── 2. 상태 기계 ─────────────────────────
// task: { f, x, z, act, dur, face?: [x, z], light?, say? }
// env: { plan(npc, gx, gz) → bool · walkable(f, x, z) · player { x, z, f, on } · door(npc, x, z, nx, nz) → true = 문 열리는 중(기다림)
//        event(npc, type, task) · stair(f) → { x, z } · rand() }
export const NPC_STATES = ['idle', 'walk', 'act', 'talk', 'yield', 'stair'];
export function createNPC(def) {
  const t0 = def.tasks[0];
  return { id: def.id, role: def.role || def.id, def, f: def.f ?? t0.f, x: def.x ?? t0.x, z: def.z ?? t0.z, yaw: def.yaw || 0, speed: def.speed || 1.15,
    state: 'idle', t: def.delay || .5, ti: -1, task: null, path: new Float32Array(128), pn: 0, pi: 0, v: 0, moved: 0, prevState: 'idle', prevT: 0,
    blockT: 0, yx: 0, yz: 0, stuckT: 0, stuckD: 0, stuckN: 0, replans: 0, arrivals: 0, interrupt: null, look: 0, toF: -1, sitting: false,
    hop: null, sd: 0, y: 0, pp: { x: 0, y: 0, z: 0, hx: 0, hz: 0, si: 0 }, faceT: null, stairs: 0, cv: 0 };
}
export function resetNPC(n) { const t0 = n.def.tasks[0]; Object.assign(n, { f: n.def.f ?? t0.f, x: n.def.x ?? t0.x, z: n.def.z ?? t0.z, yaw: n.def.yaw || 0, state: 'idle', t: n.def.delay || .5, ti: -1, task: null, pn: 0, pi: 0, v: 0, blockT: 0, stuckT: 0, stuckN: 0, interrupt: null, toF: -1, sitting: false, hop: null, sd: 0, faceT: null }); }
const angTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
function turn(n, ty, dt, rate = 4) { const e = angTo(n.yaw, ty); n.yaw += Math.sign(e) * Math.min(Math.abs(e), rate * dt); }
function startTask(n, task, env) {
  n.task = task; n.sitting = false; n.hop = null;
  if (env.route) {   // 층 · 건물 · 바깥 사이 길: 첫 계단(portal)까지 걸어간 뒤 계단을 실제로 오르내린다
    const h = env.route(n, task);
    if (h === false) { n.toF = -1; n.state = 'idle'; n.t = 2; env.event(n, 'fail', task); return; }
    if (h) { n.hop = h; n.toF = h.dir > 0 ? h.p.lb : h.p.la; const ex = h.dir > 0 ? h.p.ax : h.p.bx, ez = h.dir > 0 ? h.p.az : h.p.bz;
      if (!env.plan(n, ex, ez)) { n.hop = null; n.state = 'idle'; n.t = 2; env.event(n, 'fail', task); return; } }
    else { n.toF = -1; if (!env.plan(n, task.x, task.z)) { n.state = 'idle'; n.t = 2; env.event(n, 'fail', task); return; } }
  } else if (task.f !== n.f) {   // 다른 층: 계단으로 (길 정보가 없을 때 — 잠깐 사라졌다 나타난다)
    const s = env.stair(n.f); n.toF = task.f;
    if (!env.plan(n, s.x, s.z)) { n.state = 'idle'; n.t = 2; return; }
  } else { n.toF = -1; if (!env.plan(n, task.x, task.z)) { n.state = 'idle'; n.t = 2; env.event(n, 'fail', task); return; } }
  n.state = 'walk'; n.stuckT = 0; n.stuckD = 0; n.blockT = 0;
}
function nextTask(n, env) {
  if (n.interrupt && (env.route || n.interrupt.f === n.f)) { const t = n.interrupt; n.interrupt = null; startTask(n, t, env); return; }
  const T = n.def.tasks; n.ti = (n.ti + 1) % T.length; startTask(n, T[n.ti], env);
}
export function talkTo(n, sec = 4.5, face = null) { n.faceT = face; if (n.state === 'talk') { n.t = sec; return; } n.prevState = n.state; n.prevT = n.t; n.state = 'talk'; n.t = sec; n.v = 0; }
// 한 걸음: 경로를 따라 dist 만큼 (여러 점을 넘어갈 수 있음 — 멀리 있어 드물게 갱신할 때)
function follow(n, dist, env) {
  while (dist > 1e-4 && n.pi < n.pn) {
    const px = n.path[n.pi * 2], pz = n.path[n.pi * 2 + 1], dx = px - n.x, dz = pz - n.z, d = Math.hypot(dx, dz);
    if (env.door && env.door(n, n.x, n.z, px, pz)) { n.v = 0; return 'door'; }
    if (d <= dist) { n.x = px; n.z = pz; dist -= d; n.pi++; n.moved += d; continue; }
    const k = dist / d; n.x += dx * k; n.z += dz * k; n.moved += dist; dist = 0;
  }
  return n.pi >= n.pn ? 'arrived' : 'moving';
}
// 비켜설 자리까지 곧장 걸어갈 수 있나 (선분을 0.15m 간격으로 짚는다 — 벽 · 닫힌 문을 뚫고 비키지 않게)
function canStep(env, n, x, z) {
  const ok = env.clear || env.walkable, dx = x - n.x, dz = z - n.z, k = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .15));
  for (let i = 1; i <= k; i++) if (!ok(n.f, n.x + dx * i / k, n.z + dz * i / k)) return false;
  return true;
}
export function stepNPC(n, dt, env) {
  if (n.state !== 'walk' && n.state !== 'yield') n.cv = Math.max(0, n.cv - 6 * dt);
  const P = env.player, pd = P && P.on && P.f === n.f ? Math.hypot(P.x - n.x, P.z - n.z) : 99;
  n.look = pd < 3.2 && n.state !== 'walk' ? 1 : 0;
  switch (n.state) {
    case 'idle': n.v = 0; if ((n.t -= dt) <= 0) nextTask(n, env); break;
    case 'talk': n.v = 0; if (n.faceT) turn(n, Math.atan2(n.faceT.x - n.x, n.faceT.z - n.z), dt, 5); else if (P) turn(n, Math.atan2(P.x - n.x, P.z - n.z), dt, 5);
      if ((n.t -= dt) <= 0) { n.faceT = null; const ps = n.prevState; if ((ps === 'walk' || ps === 'yield') && n.task) startTask(n, n.task, env); else if (ps === 'act' || ps === 'stair') { n.state = ps; n.t = Math.max(.5, n.prevT); } else { n.state = 'idle'; n.t = .5; } }
      break;
    case 'act': {
      n.v = 0; const tk = n.task;
      if (n.look && pd < 2.2) turn(n, Math.atan2(P.x - n.x, P.z - n.z), dt, 3);   // 플레이어가 다가오면 돌아본다
      else if (tk && tk.face) turn(n, Math.atan2(tk.face[0] - n.x, tk.face[1] - n.z), dt, 3);
      env.event(n, 'tick', tk);
      if ((n.t -= dt) <= 0) { n.sitting = false; env.event(n, 'done', tk); if (n.interrupt && (env.route || n.interrupt.f === n.f)) nextTask(n, env); else { n.state = 'idle'; n.t = .4 + env.rand() * .8; } }
      break; }
    case 'stair': if (n.hop) {   // 계단을 실제로 걷는다: 미리 재어 둔 계단 길(높이 포함)을 따라
        n.sd += n.speed * .72 * dt; n.v = n.speed * .72; const o = portalPos(n.hop, n.sd, n.pp); n.x = o.x; n.z = o.z; n.y = o.y;
        if (o.hx * o.hx + o.hz * o.hz > 1e-6) turn(n, Math.atan2(o.hx, o.hz), dt, 6);
        if (n.sd >= n.hop.p.len) { const h = n.hop; n.f = n.toF; n.x = h.dir > 0 ? h.p.bx : h.p.ax; n.z = h.dir > 0 ? h.p.bz : h.p.az; n.hop = null; n.toF = -1; n.stairs++; env.event(n, 'arriveFloor', n.task); startTask(n, n.task, env); }
        break; }
      n.v = 0; if ((n.t -= dt) <= 0) { const s = env.stair(n.toF); n.f = n.toF; n.x = s.x; n.z = s.z; n.toF = -1; env.event(n, 'arriveFloor', n.task); startTask(n, n.task, env); } break;
    case 'yield': {
      n.t -= dt; const dx = n.yx - n.x, dz = n.yz - n.z, d = Math.hypot(dx, dz);
      if (d > .05) { const st = Math.min(d, n.speed * 1.1 * dt); n.x += dx / d * st; n.z += dz / d * st; n.v = st / Math.max(dt, 1e-4); n.yaw = Math.atan2(dx, dz); }
      else { n.v = 0; if (pd < 3) turn(n, Math.atan2(P.x - n.x, P.z - n.z), dt, 4); }
      if ((pd > 2.2 && d <= .05) || n.t <= 0) { const tk = n.task; n.avoidP = pd < 2.6; if (tk) startTask(n, tk, env); else { n.state = 'idle'; n.t = .3; } n.avoidP = false; }
      break; }
    case 'walk': {
      // 플레이어가 길 앞을 막으면 속도를 줄이고, 오래 막으면 옆으로 비켜선다 (NPC 에는 충돌체가 없어 플레이어는 늘 지나갈 수 있다)
      let sp = n.speed;
      if (pd < 1.6 && n.pi < n.pn) {
        const hx = n.path[n.pi * 2] - n.x, hz = n.path[n.pi * 2 + 1] - n.z, hl = Math.hypot(hx, hz) || 1, ahead = ((P.x - n.x) * hx + (P.z - n.z) * hz) / hl / Math.max(pd, .01);
        const lat = Math.abs((P.x - n.x) * hz - (P.z - n.z) * hx) / hl;   // 경로선에서 옆으로 떨어진 거리 — 비켜 지나갈 수 있으면 막힘이 아니다
        if (ahead > .35 && lat < .7) { sp *= Math.max(0, (pd - .7) / .9); n.blockT += dt; } else n.blockT = Math.max(0, n.blockT - dt);
        if (n.blockT > .9) {   // 비켜서기: 진행 방향의 수직 양쪽 중 플레이어에서 먼 쪽 · 걸을 수 있는 자리
          n.blockT = 0; const px = -hz / hl, pz = hx / hl; let ok = false;
          for (const r of [1.1, .8, 1.5]) { for (const sgn of ((P.x - n.x) * px + (P.z - n.z) * pz > 0 ? [-1, 1] : [1, -1])) { const yx = n.x + px * r * sgn, yz = n.z + pz * r * sgn; if (canStep(env, n, yx, yz) && Math.hypot(yx - P.x, yz - P.z) > 1.1) { n.yx = yx; n.yz = yz; ok = true; break; } } if (ok) break; }
          if (!ok) { const bx = n.x - hx / hl * .9, bz = n.z - hz / hl * .9; if (canStep(env, n, bx, bz)) { n.yx = bx; n.yz = bz; ok = true; } }
          if (ok) { n.state = 'yield'; n.t = 5; env.event(n, 'yield', n.task); break; }
        }
      } else n.blockT = 0;
      // 가감속 · 회전 호: 속도는 천천히 붙고(출발) 남은 길이 짧으면 줄인다(도착) · 크게 꺾을 땐 덜 가며 돈다 — 발 미끄러짐 없이 (보폭 맞춤 재생은 실제 이동 속도를 읽는다)
      let herr = 0, rem = 9;
      if (n.pi < n.pn) { const hx = n.path[n.pi * 2] - n.x, hz = n.path[n.pi * 2 + 1] - n.z; if (hx * hx + hz * hz > 1e-4) herr = angTo(n.yaw, Math.atan2(hx, hz)); if (n.pi === n.pn - 1) rem = Math.hypot(hx, hz); }
      const want = Math.min(sp, rem < 9 ? Math.sqrt(2 * 3.2 * rem) + .15 : sp);
      n.cv = approach(n.cv, want, dt, n.cv < 1.2 ? 2.6 : 3.4, 4.5);
      const st = n.cv * turnSpeed(herr);
      const before = n.moved, r = st > .005 ? follow(n, st * dt, env) : 'moving';
      n.v = (n.moved - before) / Math.max(dt, 1e-4);
      if (n.pi < n.pn) { const hx = n.path[n.pi * 2] - n.x, hz = n.path[n.pi * 2 + 1] - n.z; if (hx * hx + hz * hz > 1e-4) turn(n, Math.atan2(hx, hz), dt, 6); }
      // 막힘 감지: 1.5초 동안 0.15m 도 못 가면(문 · 플레이어 대기 제외) 다시 길을 찾고, 세 번째엔 가까운 빈칸으로 옮긴다
      if (r === 'door') n.cv = Math.min(n.cv, .3);
      if (r !== 'door' && sp > .3 && n.cv > .25) { n.stuckT += dt; n.stuckD += n.moved - before; if (n.stuckT > 1.5) { if (n.stuckD < .15) { n.stuckN++; n.replans++; env.event(n, 'stuck', n.task); if (n.task) startTask(n, n.task, env); } else n.stuckN = 0; n.stuckT = 0; n.stuckD = 0; } }
      if (r === 'arrived') {
        if (n.hop) { n.state = 'stair'; n.sd = 0; n.pp.si = n.hop.dir > 0 ? 0 : n.hop.p.cum.length - 2; const o = portalPos(n.hop, 0, n.pp); n.y = o.y; env.event(n, 'stair', n.task); break; }
        if (n.toF >= 0) { n.state = 'stair'; n.t = 4 + env.rand() * 2; env.event(n, 'stair', n.task); break; }
        n.arrivals++; n.stuckN = 0; const tk = n.task; n.state = 'act'; n.t = tk ? tk.dur : 1; n.sitting = !!(tk && tk.sit); env.event(n, 'arrive', tk);
      }
      break; }
  }
}

// ───────────────────────── 3. 게임 연결: 동행 NPC 민아 ─────────────────────────
//   방과 후 학교의 다른 사람들(경비 · 당직 선생님 · 청소 · 학생)은 걸어다니지 않는다 — 목소리(전화 · 방송 · 무전) · 회상 · 경비실 CCTV 녹화로만 나온다
const NAMES = { mina: '민아' };
const ML = id => MINA_LINES[id][0];
export const NPC_LINES = { mina: { greet: [ML('greet_0'), ML('greet_1'), ML('greet_2')], hint: ML('hint_where') } };
export const NPC_HINT_MAIN = ML('hint_main');
export const NPC_TALK_LABEL = '말 걸기';
export { NAMES as NPC_NAMES };

// 걷기 층(layer): 0~3 = 1~4층 (본관 + 구름다리 + 별관을 한 격자로) · OUT = 본관 남쪽 현관 ~ 정문 · 경비실 바깥
export const OUT = 8;
// 따라가기 목표: 플레이어 뒤쪽(시야를 막지 않게) dist m — 걸을 수 없으면 비스듬히 · 옆 순으로
const FG = [0, .6, -.6, 1.3, -1.3, Math.PI / 2 + .9, -Math.PI / 2 - .9];
export function followGoal(px, pz, yaw, ok, dist = 1.4, out = { x: 0, z: 0 }) {
  for (let i = 0; i < FG.length; i++) { const a = yaw + FG[i]; const x = px - Math.sin(a) * dist, z = pz - Math.cos(a) * dist; if (ok(x, z)) { out.x = x; out.z = z; return out; } }
  out.x = px; out.z = pz; return out;
}
// 따라가기 속도: 같은 층에서 가까우면 멈춤(0), 멀면 뛰어 따라잡기
export function followSpeed(sameLayer, d, stop = 2.1) { if (sameLayer && d < stop) return 0; if (!sameLayer || d > 7) return 3.4; return d > 4 ? 2.3 : 1.5; }

export function installNPCAI({ R, P, isPlaying, subtitle, objective, at, igpu, debug, mind, elec, now, outdoor, busy, nearby, fails, voice, board, tagName, view, seats, playerSeat, smart }) {
  const MAIN = R.MAIN, ANX = R.ANX || null, FH = MAIN.spec.FH, BLDS = [MAIN, ANX].filter(Boolean);
  const clock = now || (() => performance.now() / 1000);
  const recent = [], subtitle0 = subtitle;   // 최근 민아 대사 (자유 대화 모듈이 읽는다)
  subtitle = (who, text, dur) => { if (text) { recent.push(text); if (recent.length > 8) recent.shift(); try { voice && voice(text, 'mina'); } catch (e) { /* 자막만 */ } } subtitle0(who, text, dur); };   // 녹음된 민아 대사면 목소리도 (한국어만 · voice/mn_*.mp3)
  // 말 차례(우선순위 큐) · 반복 제어(줄마다 쿨다운 · 5분 안에 같은 줄 금지) — 모든 자발적 대사는 큐를 지난다
  const GATE = createLineGate({ window: 300, cd: { sound_look: 240, exam_event: 420, sep_found: 600, idle_sit: 900, idle_phone: 900 } }), Q = createSpeechQueue({ max: 6, gap: 1.4 });
  const LS = { said: 0, repeats: 0, byText: new Map() };   // 실제로 나간 민아 대사 통계 (시뮬레이션 · 디버그)
  const logSaid = (text, t) => { LS.said++; const p = LS.byText.get(text); if (p != null && t - p < 300) LS.repeats++; LS.byText.set(text, t); };
  const busyNow = () => !isPlaying() || !!(busy && busy());
  // say: 대사 한 줄을 큐에 (key = 반복 제어 단위 · 보통 MINA_LINES id 나 문장). 막혔으면 false
  function say(key, text, prio, { dur = 3.4, ttl = 7, gate = true, then = null } = {}) {
    if (!text) return false; const t = clock(); if (gate && !GATE.canSay(key, t)) return false;
    if (gate) { const p = LS.byText.get(text); if (p != null && t >= p && t - p < 300) return false; }   // 같은 문장이 다른 id(인사 · 혼잣말)로 5분 안에 다시 나오지 않게
    if (!Q.push({ key, text, prio, dur, ttl, then }, t)) return false; if (gate) GATE.mark(key, t); return true;
  }
  function pumpSpeech() {
    if (!Q.size) return; const t = clock();
    if (!isPlaying()) { Q.clear(PRIO.hint); return; }   // 컷신 · 메뉴: 잡담은 버리고 힌트만 남긴다
    const e = Q.next(t, busyNow() || (n.state === 'stair' && n.hop && !near(n, 5))); if (!e) return;
    subtitle(NAMES.mina, e.text, e.dur); logSaid(e.text, t); anyCd = t; if (e.then) try { e.then(); } catch (er) { /* */ }
  }
  const stats = { stuck: 0, arrivals: 0, doorsOpened: 0, doorsClosed: 0, yields: 0, talks: 0, built: false, stairs: 0, floorsReached: 0, reacts: 0, plans: 0, planMs: 0, tickMs: 0, ticks: 0, tickMax: 0, teleports: 0, fails: 0 };
  // ── 층(layer) ──
  const bbOf = b => { const Lb = b.layout.L, xs = [], zs = []; for (const [lx, lz] of [[-Lb / 2 - .4, b.layout.zN - .4], [Lb / 2 + .4, b.layout.zN - .4], [-Lb / 2 - .4, b.layout.zS + .4], [Lb / 2 + .4, b.layout.zS + .4]]) { const [x, z] = b.toWorld(lx, lz); xs.push(x); zs.push(z); } return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }; };
  const BB = BLDS.map(bbOf), inBB = (b, x, z) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;
  const LYR = []; const nF = Math.max(...BLDS.map(b => b.spec.floors));
  for (let f = 0; f < nF; f++) { const bs = BB.filter((_, i) => f < BLDS[i].spec.floors); LYR[f] = { id: f, y: f * FH, vf: f, x0: Math.min(...bs.map(b => b.x0)), x1: Math.max(...bs.map(b => b.x1)), z0: Math.min(...bs.map(b => b.z0)), z1: Math.max(...bs.map(b => b.z1)) }; }
  // 바깥: 본관 남쪽 현관 ~ 경비실 · 정문 (충돌체: 게임 1층 바깥 충돌 상자 · 정문 · 경비실)
  const core = MAIN.layout.rooms.find(r => r.kind === 'core'), coreX = MAIN.toWorld((core.x1 + core.x2) / 2, 0)[0], zSw = MAIN.toWorld(0, MAIN.layout.zS)[1];
  let OUTP = null;
  if (outdoor && outdoor.door && MAIN.toWorld(0, 0)[0] === 0) {
    const dx = outdoor.door.x, gz = outdoor.gateZ;
    OUTP = { step: [coreX, zSw + 2.4], door: [dx, outdoor.door.z + .9], gate: [(coreX + dx) / 2, gz - .9], gateZ: gz, doorX: dx };
    LYR[OUT] = { id: OUT, y: 0, vf: 0, out: true, x0: Math.min(coreX, dx) - 8, x1: Math.max(coreX, dx) + 8, z0: zSw - .2, z1: gz + .6 };
  }
  const layerY = f => (LYR[f] ? LYR[f].y : f * FH), layerVF = f => (LYR[f] ? LYR[f].vf : f);
  const LIDS = LYR.map((l, i) => (l ? i : -1)).filter(i => i >= 0);
  const grids = [], allDoors = BLDS.flatMap(b => b.doors), doorsOff = new Uint8Array(allDoors.length);
  const initClosed = new Set(allDoors.filter(d => d.target < .5));   // 처음에 닫혀 있던 문만 '열어 두고 갔다'고 본다
  let outCols = null;
  const outHit = (x, z, r) => { for (let i = 0; i < outCols.length; i++) { const c = outCols[i]; const cx = c.x1 > x ? c.x1 : c.x2 < x ? c.x2 : x, cz = c.z1 > z ? c.z1 : c.z2 < z ? c.z2 : z; if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r * r) return true; } return false; };
  const walkFor = f => { const Ly = LYR[f], h = Ly.y;
    if (Ly.out) return (x, z) => R.groundAt(x, z, .6) == null && !R.blocked(x, z, 0, .3) && !outHit(x, z, .32);
    return (x, z) => { const g = R.groundAt(x, z, h + .1); if (g == null || Math.abs(g - h) > .12) return false; return !R.blocked(x, z, h, .3); }; };
  const doorsOpen = fn => { allDoors.forEach((d, i) => { doorsOff[i] = d.col.off ? 1 : 0; d.col.off = true; }); try { return fn(); } finally { allDoors.forEach((d, i) => { d.col.off = !!doorsOff[i]; }); } };
  // 격자 만들기: 프레임마다 시간 예산(ms)만큼 · 다 만들면 연결 요소 → 계단 길 → 끝
  const portals = [], panels = [];
  let buildPhase = 0, stairJobs = null;
  function buildStep(ms) {
    const t0 = performance.now();
    if (buildPhase === 0) {
      if (LYR[OUT] && !outCols) { const O = LYR[OUT], src = (outdoor.cols && outdoor.cols()) || []; outCols = src.filter(c => !c.off && !(c.h != null && c.h <= .34) && !(c.y0 != null && c.y0 > 1.5) && c.x2 > O.x0 - 1 && c.x1 < O.x1 + 1 && c.z2 > O.z0 - 1 && c.z1 < O.z1 + 1); if (outdoor.extra) outCols.push(...outdoor.extra()); }
      for (const f of LIDS) { const Ly = LYR[f], G = grids[f] ||= Object.assign(createNavGrid({ x0: Ly.x0, z0: Ly.z0, x1: Ly.x1, z1: Ly.z1, cell: .3 }), { maxIter: 30000 }); if (G.ready) continue;   // A* 상한: 한 번에 수 ms 이내
        doorsOpen(() => { const walk = walkFor(f); while (!G.ready && performance.now() - t0 < ms) buildNavGrid(G, walk, 400); });
        return false; }
      for (const f of LIDS) labelComponents(grids[f]);
      buildPhase = 1; stairJobs = [];
      for (const B of BLDS) for (const r of B.layout.rooms) if (r.kind === 'stair' || r.kind === 'cstair') for (let f = 0; f < B.spec.floors - 1; f++) stairJobs.push([B, r, f]);
      return false;
    }
    if (buildPhase === 1) {
      while (stairJobs.length && performance.now() - t0 < ms) { const [B, r, f] = stairJobs.shift(); const p = doorsOpen(() => stairPortal(B, r, f)); if (p) portals.push(p); }
      if (stairJobs.length) return false;
      if (OUTP) { const p = entryPortal(); if (p) portals.push(p); }
      for (const p of portals) { p.ca = compAt(grids[p.la], p.ax, p.az, .6); p.cb = compAt(grids[p.lb], p.bx, p.bz, .6); }
      for (let i = portals.length - 1; i >= 0; i--) if (portals[i].ca < 0 || portals[i].cb < 0) portals.splice(i, 1);
      findPanels(); buildPhase = 2; return true;
    }
    return true;
  }
  // 계단 길: 계단실 안을 (칸 · 높이) 상태로 넓이 우선 탐색 — 층 f 참에서 출발해 f+1 층 참에 닿는 실제 디딤판 위의 길 (손스침 · 칸막이 피함)
  function stairPortal(B, r, f) {
    const LY = B.layout, zA = r.kind === 'cstair' ? .45 : LY.zN + 2.8, st = .25, x0 = r.x1 - .2, z0 = LY.zN + .1, nx = Math.ceil((r.x2 + .2 - x0) / st), nz = Math.ceil((LY.zS - .1 - z0) / st);
    const h0 = f * FH, h1 = (f + 1) * FH, G0 = grids[f], G1 = grids[f + 1]; if (!G0 || !G1) return null;
    const cx = (r.x1 + r.x2) / 2, sl = [cx, Math.max(LY.zN + .7, zA - .9)];
    let sx = Math.round((sl[0] - x0) / st - .5), sz = Math.round((sl[1] - z0) / st - .5); sx = Math.max(0, Math.min(nx - 1, sx)); sz = Math.max(0, Math.min(nz - 1, sz));
    const W = (ix, iz) => B.toWorld(x0 + (ix + .5) * st, z0 + (iz + .5) * st);
    const ok = (ix, iz, h) => { if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return null; const [wx, wz] = W(ix, iz), g = R.groundAt(wx, wz, h + .3); if (g == null || Math.abs(g - h) > .3 || g < h0 - .05 || g > h1 + .05) return null; if (R.blocked(wx, wz, g, .2)) return null; return g; };
    // 출발 칸: 참 가운데에서 가까운 걸을 수 있는 칸
    let s0 = -1, sh = h0; for (let rr = 0; rr < 6 && s0 < 0; rr++) for (let a = -rr; a <= rr && s0 < 0; a++) for (let b = -rr; b <= rr && s0 < 0; b++) { const g = ok(sx + a, sz + b, h0); if (g != null && Math.abs(g - h0) < .05) { const [wx, wz] = W(sx + a, sz + b); if (walkableAt(G0, wx, wz)) { s0 = (sz + b) * nx + sx + a; sh = g; } } }
    if (s0 < 0) return null;
    const HB = h => Math.max(0, Math.min(63, Math.round((h - h0 + .3) / .12))), key = (c, h) => c * 64 + HB(h);
    const par = new Map(), hv = new Map(), q = [key(s0, sh)]; par.set(q[0], -1); hv.set(q[0], sh); let goal = -1;
    for (let qi = 0; qi < q.length && qi < 60000; qi++) {
      const k = q[qi], c = (k / 64) | 0, h = hv.get(k), ix = c % nx, iz = (c / nx) | 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { if (!a && !b) continue;
        const g = ok(ix + a, iz + b, h); if (g == null) continue;
        if (a && b && (ok(ix + a, iz, h) == null || ok(ix, iz + b, h) == null)) continue;   // 대각선은 양옆이 비었을 때만
        const nc = (iz + b) * nx + ix + a, nk = key(nc, g); if (par.has(nk)) continue; par.set(nk, k); hv.set(nk, g); q.push(nk);
        if (g > h1 - .04 && z0 + (iz + b + .5) * st < zA - .3) { const [wx, wz] = W(ix + a, iz + b); if (walkableAt(G1, wx, wz)) { goal = nk; break; } } }
      if (goal >= 0) break;
    }
    if (goal < 0) return null;
    const chain = []; for (let k = goal; k >= 0; k = par.get(k)) chain.push(k); chain.reverse();
    const raw = chain.map(k => { const c = (k / 64) | 0, [wx, wz] = W(c % nx, (c / nx) | 0); return [wx, hv.get(k), wz]; });
    // 높이 다듬기(디딤판 계단 → 경사) · 곧은 구간 점 줄이기
    const ys = raw.map((p, i) => { if (i === 0 || i === raw.length - 1) return p[1]; let s = 0, n = 0; for (let j = Math.max(0, i - 2); j <= Math.min(raw.length - 1, i + 2); j++) { s += raw[j][1]; n++; } return s / n; });
    const pts = []; for (let i = 0; i < raw.length; i++) { if (i > 0 && i < raw.length - 1) { const a = raw[i - 1], b = raw[i + 1], p = raw[i]; const cr = (p[0] - a[0]) * (b[2] - a[2]) - (p[2] - a[2]) * (b[0] - a[0]); const ty = (ys[i - 1] + ys[i + 1]) / 2; if (Math.abs(cr) < 1e-4 && Math.abs(ys[i] - ty) < .015) continue; } pts.push(raw[i][0], ys[i], raw[i][2]); }
    return makePortal(f, f + 1, pts, { kind: 'stair', bld: B === MAIN ? 'main' : 'annex', room: r.label || r.kind });
  }
  // 본관 남쪽 현관 ↔ 바깥: 문턱을 지나는 짧은 평지 길
  function entryPortal() {
    const G0 = grids[0], G1 = grids[OUT]; if (!G0 || !G1) return null;
    const a = nearestFree(G0, coreX, zSw - 1.2, 2), b = nearestFree(G1, coreX, zSw + 1.4, 4); if (a < 0 || b < 0) return null;
    const cxy = (G, c) => [G.x0 + (c % G.nx + .5) * G.cell, G.z0 + (((c / G.nx) | 0) + .5) * G.cell], A = cxy(G0, a), Bp = cxy(G1, b);
    return makePortal(0, OUT, [A[0], 0, A[1], coreX, 0, zSw, Bp[0], 0, Bp[1]], { kind: 'door', flat: true });
  }
  // 층마다 분전반 (경비 아저씨가 차단기를 올리러 간다)
  function findPanels() {
    for (const B of BLDS) for (const q of B.props || []) { if (q.kind !== 'panel') continue; const f = Math.floor((q.y + .5) / FH), G = grids[f]; if (!G) continue;
      const [x, z] = B.toWorld(q.x, q.z), [x2, z2] = B.toWorld(q.x, q.z + 1); let c = -1;
      for (const k of [.8, -.8, 1.2, -1.2]) { const tx = x + (x2 - x) * k, tz = z + (z2 - z) * k; if (walkableAt(G, tx, tz)) { c = cellOf(G, tx, tz); break; } }
      if (c < 0) c = nearestFree(G, x, z, 1.6); if (c < 0) continue;
      panels.push({ bld: B === MAIN ? 'main' : 'annex', f, px: x, pz: z, x: G.x0 + (c % G.nx + .5) * G.cell, z: G.z0 + (((c / G.nx) | 0) + .5) * G.cell }); }
  }
  const AVOID = new Int32Array(128);
  const env = {
    player: { x: 0, z: 0, f: -9, y: 0, on: false },
    rand: (() => { let s = 1234567; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); })(),
    walkable: (f, x, z) => !!grids[f] && walkableAt(grids[f], x, z),
    clear: (f, x, z) => !!grids[f] && walkableAt(grids[f], x, z) && !R.blocked(x, z, layerY(f), .3),   // 비켜설 자리: 닫힌 문 앞도 피한다
    route(n, tk) { const Ga = grids[n.f], Gb = grids[tk.f]; if (!Ga || !Gb) return false;
      if (n.f === tk.f && !portals.length) return null;
      return routeHop(portals, n.f, compAt(Ga, n.x, n.z, 2), n.x, n.z, tk.f, compAt(Gb, tk.x, tk.z, 2.5), tk.x, tk.z); },
    plan(n, gx, gz) { const G = grids[n.f]; if (!G || !G.ready) return false;
      // 비켜선 뒤 다시 걸을 때: 서 있는 플레이어 둘레(0.9m)를 잠깐 막힘으로 두고 길을 찾아 옆으로 돌아간다
      let nb = 0; const pl = env.player;
      if (n.avoidP && pl.on && pl.f === n.f) { const r = Math.ceil(.9 / G.cell), cx = Math.floor((pl.x - G.x0) / G.cell), cz = Math.floor((pl.z - G.z0) / G.cell);
        for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const i = cx + a, k = cz + b; if (i < 0 || k < 0 || i >= G.nx || k >= G.nz || a * a + b * b > r * r) continue; const c = k * G.nx + i; if (G.w[c] && nb < AVOID.length) { AVOID[nb++] = c; G.w[c] = 0; } } }
      const t0 = performance.now(); n.pn = astar(G, n.x, n.z, gx, gz, n.path); for (let i = 0; i < nb; i++) G.w[AVOID[i]] = 1;
      if (!n.pn && nb) n.pn = astar(G, n.x, n.z, gx, gz, n.path); stats.planMs += performance.now() - t0; stats.plans++;
      n.pi = 0; if (n.pn && !walkableAt(G, n.x, n.z)) { const c = nearestFree(G, n.x, n.z, 2); if (c >= 0) { n.x = G.x0 + (c % G.nx + .5) * G.cell; n.z = G.z0 + (((c / G.nx) | 0) + .5) * G.cell; } } return n.pn > 0; },
    door(n, x, z, nx, nz) {   // 닫힌 문이 다음 경로 구간 위에 있으면 열고(열리는 동안 기다림), 지나간 뒤 플레이어가 가까이 없으면 다시 닫는다
      const y = layerY(n.f), d = R.nearDoor(x, z, y); if (!d) return false;
      const dd = Math.hypot(d.mx - x, d.mz - z); if (dd > 1.15) return false;
      const sx = nx - x, sz = nz - z, sl = Math.hypot(sx, sz) || 1, t = ((d.mx - x) * sx + (d.mz - z) * sz) / sl;
      if (t < -.2 || Math.abs((d.mx - x) * sz - (d.mz - z) * sx) / sl > .9) return false;
      if (d.target < .5) openDoor(n, d, y);
      return d.col && !d.col.off;
    },
    event(n, type, tk) { onEvent(n, type, tk); },
  };
  function openDoor(n, d, y) { R.toggleDoor(d); stats.doorsOpened++; n.opened.push(d); try { at(d.mx, y + 1.1, d.mz)[d.kind === 'slide' ? 'doorSlide' : 'doorHinge'](.5); } catch (e) { /* 소리 없음 */ } }
  function onEvent(n, type) {
    if (type === 'stuck') stats.stuck++;
    if (type === 'yield') stats.yields++;
    if (type === 'fail') stats.fails++;
    if (type === 'arrive') stats.arrivals++;
    if (type === 'arriveFloor') stats.floorsReached++;
    if (type === 'stair') { stats.stairs++; if (n.hop && n.hop.p.flat) { const p = n.hop.p, mx = (p.ax + p.bx) / 2, mz = (p.az + p.bz) / 2, d = R.nearDoor(mx, mz, 0); if (d && d.target < .5 && Math.hypot(d.mx - mx, d.mz - mz) < 2.2) openDoor(n, d, 0); }
      else if (n.hop && near(n, 6)) react('stairs'); }
  }
  const near = (n, r) => env.player.on && env.player.f === n.f && Math.hypot(env.player.x - n.x, env.player.z - n.z) < r;
  // 지나온 문 닫기: 1.6m 지나갔고 플레이어가 6m 안에 없을 때 (플레이어가 뒤따라 지나갈 문은 열어 둔다)
  function closeDoors(n) {
    if (!n.opened.length) return;
    for (let i = n.opened.length - 1; i >= 0; i--) { const d = n.opened[i], y = n.state === 'stair' && n.hop ? n.y : layerY(n.f);
      if (Math.abs(d.py - y) > 1.2) { n.opened.splice(i, 1); continue; }
      if (Math.hypot(d.mx - n.x, d.mz - n.z) > 1.6 && !(env.player.on && Math.abs(env.player.y - y) < 1.5 && Math.hypot(d.mx - env.player.x, d.mz - env.player.z) < 6)) {
        if (d.target > .5) { R.toggleDoor(d); stats.doorsClosed++; try { at(d.mx, y + 1.1, d.mz)[d.kind === 'slide' ? 'doorSlide' : 'doorHinge'](.4); } catch (e) { /* */ } } n.opened.splice(i, 1); } }
  }
  const cellX = (G, c) => G.x0 + (c % G.nx + .5) * G.cell, cellZ = (G, c) => G.z0 + (((c / G.nx) | 0) + .5) * G.cell;

  // ── 민아: 상태 기계 한 명 (일정 대신 '플레이어 뒤' 목표 하나를 계속 바꾼다) ──
  const TASK = { f: 0, x: 0, z: 0, act: 'wait', dur: .2 };
  const n = createNPC({ id: 'mina', tasks: [TASK], speed: 1.5 }); n.opened = []; n.mem = newMemory(); n.active = false; n.goalT = 0; n.fails = 0; n.lines = 0;
  const visited = new Set(), GOAL = { x: 0, z: 0 };
  let enabled = true, buildDone = false, lastLine = null, pend = null;   // pend: 격자가 아직 없을 때 불러온 자리
  function playerLayer() {
    if (P.floor !== 0) return -9; const y = P.sh || 0, x = P.x, z = P.z;
    for (let i = 0; i < BB.length; i++) if (inBB(BB[i], x, z)) { const f = Math.round(y / FH); return f >= 0 && f < BLDS[i].spec.floors && grids[f] ? f : -9; }
    return y < 1 && LYR[OUT] && grids[OUT] && walkableAt(grids[OUT], x, z) ? OUT : -9;   // 바깥: 현관 ~ 정문 구역 안에서만 (그 밖은 예전 방식)
  }
  function place(f, x, z) { const G = grids[f]; if (!G) return false; const c = nearestFree(G, x, z, 3); if (c < 0) return false; resetNPC(n); n.f = f; n.x = cellX(G, c); n.z = cellZ(G, c); n.state = 'idle'; n.t = 1e9; n.hop = null; n.toF = -1; n.stuckN = 0; return true; }
  function teleportBehind(pf, gx, gz) { const G = grids[pf]; if (gx == null) { followGoal(P.x, P.z, P.yaw, (x, z) => walkableAt(G, x, z) && gridLOS(G, P.x, P.z, x, z), 1.3, GOAL); gx = GOAL.x; gz = GOAL.z; } stats.teleports++; n.fails = 0; sepT = 0; sepFar = false; return place(pf, gx, gz); }
  // 반응 대사: 같은 종류는 쿨다운 · 말하는 중(더빙 · 대화)이면 넘긴다
  const CDS = { lightsOut: 45, lightsFixed: 45, room: 70, key: 20, run: 60, stairs: 1e9, notice: 25 };
  let anyCd = -1e9;
  function react(kind, arg) {
    const t = clock(); if (t - anyCd < 8 || (busy && busy()) || !canReact(n.mem, kind, t, CDS[kind] || 60)) return false;
    let s = reactLine(kind, 'mina', (n.mem.told['r:' + kind] || 0)); if (!s) return false; if (arg != null) s = s.replace('{}', arg);
    if (!say(s, s, kind === 'lightsOut' ? PRIO.safety : kind === 'notice' ? PRIO.examine : PRIO.react, { ttl: 6 })) return false;
    markReact(n.mem, kind, t); anyCd = t; stats.reacts++; lastLine = { key: 'r:' + kind, text: s, topic: kind }; return true;
  }
  // 세상 변화 감시 (0.5초마다): 정전 · 차단기 · 처음 들어간 방 · 증거 · 혼자 뛰어가기
  let watchT = 0, wasDark = null, lastKeys = -1, lastRoom = '';
  const brkIsOn = (E, id) => { for (const B of E.BLD.values()) { const k = B.brks.get(id); if (k) return E.brkOn(k); } return true; };
  function darkHere(pf) { if (R._pk === 0) return true; const E = elec && elec(); if (!E || !E.BLD || pf < 0 || pf === OUT) return false; const bid = ANX && BB[1] && inBB(BB[1], P.x, P.z) ? 'annex' : 'main'; return !brkIsOn(E, bid + ':' + pf + 'F'); }
  // 감정 · 막힘 · 단서 알아채기 상태
  const EMO = { emo: 'calm', until: 0, dark: false, cur: 'calm' }, LOOK = { x: 0, z: 0, t: 0 };
  const setEmo = (e, sec) => { EMO.emo = e; EMO.until = clock() + sec; };
  let progKey = null, progT = 0, failBase = 0, stuckCd = -1e9, noticeT = 0, lastCtx = null;
  const failsNow = () => { try { return (fails && fails()) | 0; } catch (e) { return 0; } };
  function watchStuck(t) {   // 목표가 바뀌지 않은 채 오래 · 퍼즐 실패가 쌓이면 점점 구체적인 힌트 (답은 말하지 않는다)
    let c = null; try { c = mind && mind(); } catch (e) { /* */ } const key = c ? (c.ch || 0) + '|' + (c.main || '') : '';
    if (key !== progKey) { progKey = key; progT = t; failBase = failsNow(); return; }
    const nf = failsNow() - failBase, idle = t - progT;
    if (!((idle > HD.stuckAfter(240) && t - stuckCd > HD.stuckAfter(150)) || (nf >= 3 && t - stuckCd > HD.stuckAfter(60))) || (busy && busy()) || !c) return;
    stuckCd = t; progT = t; failBase = failsNow();
    const h = HD.request('mina', NPC_LINES.mina, { ...c, dark: false }, t, NPC_HINT_MAIN); if (!h) return;
    // 첫 단계(막연)인데 단서 보드에 '아직 안 가 본 곳'이 여러 번 나오면 그 얘기로 (같은 단계 — 보드와 겹치지 않게)
    if (h.tier === 0) { const sg = boardInfer(); const p = sg && sg.suggestions && sg.suggestions[0]; if (p) h.text = ML('board_sugg').replace('{}', tagKo(p.place)); }
    stats.stuckHints = (stats.stuckHints || 0) + 1; n.mem.told[h.key] = (n.mem.told[h.key] || 0) + 1;
    const intro = reactLine(nf >= 3 ? 'stuckFail' : 'stuck', 'mina', 0); lastLine = h; anyCd = t;
    Q.push({ key: 'hintIntro', text: intro, prio: PRIO.hint + 1, dur: 3.2, ttl: 20, gap: .3 }, t); Q.push({ key: h.key, text: h.text, prio: PRIO.hint, dur: 5, ttl: 30 }, t);
  }
  function watchNotice(t) {   // 플레이어 곁(5m)의 아직 안 본 단서 · 조사 대상: 고개를 돌리고 한마디 (대상마다 한 번)
    let list = null; try { list = nearby && nearby(); } catch (e) { list = null; } if (!list || !list.length) return;
    let best = null, bd = 5; for (const q of list) { if (n.mem.told['n:' + q.id]) continue; const d = Math.hypot(q.x - P.x, q.z - P.z); if (d < bd) { bd = d; best = q; } }
    if (!best) return; LOOK.x = best.x; LOOK.z = best.z; LOOK.t = 3; LOOK.pt = true;
    if (react('notice', best.label)) { n.mem.told['n:' + best.id] = 1; setEmo('curious', 20); } else n.mem.told['n:' + best.id] = 1;   // 못 말했으면(차례 · 반복) 조용히 넘긴다 — 같은 대상으로 되풀이하지 않게
  }
  function watchEmotion(t) { const prev = EMO.cur; EMO.cur = emotionOf(EMO, t); if (EMO.cur !== prev && EMO.cur !== 'calm' && canReact(n.mem, 'emo_' + EMO.cur, t, 120) && t - anyCd > 10 && say('emo_' + EMO.cur, EMO_LINE[EMO.cur], PRIO.comment, { ttl: 5 })) markReact(n.mem, 'emo_' + EMO.cur, t); }
  function watch(pf) {
    const t = clock(), dk = darkHere(pf); EMO.dark = dk;
    if (wasDark != null && dk !== wasDark) { react(dk ? 'lightsOut' : 'lightsFixed'); if (!dk) setEmo('relieved', 25); } wasDark = dk;
    const keys = P.keys | 0; if (lastKeys >= 0 && keys > lastKeys) { react('key'); setEmo('relieved', 25); } lastKeys = keys;
    if ((noticeT -= .5) <= 0) { noticeT = 1.5; watchNotice(t); }
    watchStuck(t); watchEmotion(t);
    if (R.where && visited.size < 300) { const w0 = R.where(P.x, P.z, P.sh || 0), w = w0 && (typeof w0 === 'string' ? w0 : w0.name || ''); if (w && w !== lastRoom) { lastRoom = w; if (!visited.has(w)) { visited.add(w); if (!/복도|계단|현관/.test(w)) { react('room', w); decorNotice(w); } } } }
    if (P.sprinting && Math.hypot(P.x - n.x, P.z - n.z) > 6) react('run');
    if (exam.due && t >= exam.due) examineComment(t);
    // 가구 · 벽 속에 서 있지 않게: 멈춰 있는데 지금 칸이 걸을 수 없는 칸이면 가까운 빈칸으로 걸어 나간다
    if (n.state === 'idle' && n.f === pf && !SE.on) { const G = grids[n.f]; if (G && !walkableAt(G, n.x, n.z)) { const c = nearestFree(G, n.x, n.z, 2); if (c >= 0) { TASK.f = n.f; TASK.x = cellX(G, c); TASK.z = cellZ(G, c); n.speed = 1.1; startTask(n, TASK, env); stats.unstuckFurniture = (stats.unstuckFurniture || 0) + 1; } } }
  }
  // ── 조사 반응 · 단서 보드 (smartObjects 가 window.__mina.remember 로 알려 준다) ──
  const exam = { due: 0, kind: '', id: '', type: '', x: 0, z: 0, has: false };
  const tagKo = k => { try { return (tagName && tagName(k, 'ko')) || k; } catch (e) { return k; } };
  let boardCache = null, boardT = -1e9;
  function boardInfer() { const t = clock(); if (t - boardT < 2 && boardCache) return boardCache; boardT = t; try { boardCache = board ? board() : null; } catch (e) { boardCache = null; } return boardCache; }
  function remember(ev) {
    if (!ev || typeof ev !== 'object' || !enabled || !n.active) return false; const t = clock();
    exam.type = ev.type || ''; exam.kind = ev.kind || ''; exam.id = String(ev.id || ''); exam.has = Number.isFinite(ev.x) && Number.isFinite(ev.z); if (exam.has) { exam.x = ev.x; exam.z = ev.z; }
    // 고개: 조사한 물건 쪽 · 소리 난 방이면 둘러본다
    if (exam.has) { LOOK.x = exam.x; LOOK.z = exam.z; LOOK.t = 2.6; LOOK.pt = true; } else if (exam.type === 'roomEvent') { const a = n.yaw + (env.rand() - .5) * 2.4; LOOK.x = n.x + Math.sin(a) * 4; LOOK.z = n.z + Math.cos(a) * 4; LOOK.t = 2.2; }
    if (exam.type === 'roomEvent') setEmo('curious', 15);
    exam.due = t + (exam.type === 'roomEvent' ? 4.2 : 2.2); boardT = -1e9; stats.remembers = (stats.remembers || 0) + 1; return true;
  }
  function examineComment(t) {
    exam.due = 0; const inf = boardInfer();
    // 1) 새 모순 → 꼭 말한다 (보드 우선순위)
    if (inf && inf.contradictions) for (const c of inf.contradictions) { const k = 'c:' + c.a + '|' + c.b; if (n.mem.told[k]) continue; n.mem.told[k] = 1;
      const id = (n.mem.told['r:contra'] = (n.mem.told['r:contra'] || 0) + 1) % 2 ? 'board_contra_0' : 'board_contra_1';
      if (say('contra:' + k, ML(id).replace('{}', tagKo(c.tags[0])), PRIO.board, { ttl: 15, dur: 4.2, gate: false })) { stats.contra = (stats.contra || 0) + 1; setEmo('curious', 25); return; } }
    // 2) 방금 본 것이 앞의 단서와 사람 · 장소로 이어지면 (태그마다 한 번)
    if (inf && inf.links && exam.id) for (const l of inf.links) { const mine = l.a.startsWith(exam.id) ? 1 : l.b.startsWith(exam.id) ? 2 : 0; if (!mine || l.w < 1.5) continue;
      const tg = l.tags[0], k = 'l:' + tg; if (n.mem.told[k]) continue; n.mem.told[k] = 1;
      if (say('link:' + tg, ML('exam_link').replace('{}', tagKo(tg)), PRIO.examine, { ttl: 8 })) return; }
    // 3) 물건 종류에 맞는 한마디 (반복 제어 · 절반만 — 수다스럽지 않게)
    if (exam.type === 'roomEvent') { const a = Math.atan2(LOOK.x - n.x, LOOK.z - n.z); errand(n.x + Math.sin(a) * 1.2, n.z + Math.cos(a) * 1.2, { pose: 'none', maxD: 3 }); if (env.rand() < .55) say('exam_event', ML('exam_event'), PRIO.comment, { ttl: 6 }); return; }
    if (exam.has && exam.type === 'object' && Math.hypot(P.x - exam.x, P.z - exam.z) > 1.1 && env.rand() < .6) { const ids = EXAM_IDS[exam.kind] || EXAM_IDS.any, id = GATE.pick(ids, t, env.rand); if (errand(exam.x, exam.z, { line: id, maxD: 8 })) return; }
    if (env.rand() < .5) return;
    const ids = EXAM_IDS[exam.kind] || EXAM_IDS.any, id = GATE.pick(ids, t, env.rand) || GATE.pick(EXAM_IDS.any, t, env.rand); if (id) say(id, ML(id), PRIO.comment, { ttl: 6 });
  }
  // ── 소지품 보여주기 (소지품 창 '민아에게 보여주기'): 처음 · 다시 · 힌트 단계에 맞춘 귀띔 · 단서 보드 연결 ──
  function showItem(id, { used = false, name = '' } = {}) {
    if (!n.active || !id) return null; const t = clock(), c = context(), r = itemComment(String(id), n.mem, { tier: HD.tier(c.ch || 1), used });
    const texts = r.ids.filter(k => MINA_LINES[k]).map(k => ML(k)); if (!texts.length) return null;
    Q.clear(PRIO.examine); talkTo(n, 3.5); texts.forEach((tx, i) => Q.push({ key: 'item:' + id + ':' + i, text: tx, prio: PRIO.talk, dur: i ? 4.6 : 3.6, ttl: 20, gap: .3 }, t));
    if (r.nudge > 0) HD.st.last = { src: 'mina', t, key: 'item:' + id };   // 귀띔도 공용 힌트 차례로 (무전이 곧바로 겹쳐 말하지 않게)
    stats.itemShows = (stats.itemShows || 0) + 1; IB.pose = 'none'; if (SE.on) seatLeave(true); setEmo('curious', 12);
    try { smart && smart.noteItem && smart.noteItem(String(id), name || String(id), r.cat); } catch (e) { /* 보드 없음 */ }
    lastLine = { key: 'item:' + id, text: texts[texts.length - 1], topic: 'item' }; return { ...r, texts };
  }
  // ── 장식 반응: 처음 온 방의 눈에 띄는 장식(트로피 · 급훈 · 옛 사진 · 시간표 · 부서진 물건 · 포스터) — 종류마다 한 번, 큐를 지난다 ──
  function decorNotice(room) {
    const k = decorFor(room, n.mem.told); if (!k) return false; n.mem.told['d:' + k] = 1;
    return say('decor_' + k, ML('decor_' + k), PRIO.comment, { ttl: 14, dur: 3.8 });
  }
  // ── 정리: 플레이어가 열어 두고 떠난 캐비닛 · 블라인드를 닫는다 (스마트 사물 상태 API · 겉모습만) ──
  let tidyT = 0;
  function tidyTick(dt) {
    if ((tidyT -= dt) > 0 || ER.on || SE.on || !smart || !smart.openObjects || !n.active || n.state === 'stair') return; tidyT = 4;
    let L = null; try { L = smart.openObjects(); } catch (e) { L = null; } if (!L || !L.length) return; const y = layerY(n.f);
    for (const o of L) { if (Math.abs(o.y - y) > 1.2 || Math.hypot(o.x - n.x, o.z - n.z) > 7) continue; const dp = Math.hypot(o.x - P.x, o.z - P.z); if (dp < 3 || dp > 9 || env.rand() > .35) continue;
      const line = o.kind === 'blinds' ? 'tidy_blinds' : 'tidy_cabinet', can = GATE.canSay(line, clock());
      if (errand(o.x, o.z, { done: () => { try { smart.close(o.id); stats.tidies = (stats.tidies || 0) + 1; } catch (e) { /* */ } }, line: can ? line : null, maxD: 7 })) { if (can) GATE.mark(line, clock()); return; } }
  }
  // 혼잣말 (게임의 동행 잡담 차례에서 부른다): 10줄 중 오래 안 한 줄 · 같은 줄은 5분 안에 다시 안 한다
  function chatter() { const t = clock(), id = GATE.pick(MUTTER_IDS, t, env.rand); if (!id) return false; return say(id, ML(id), PRIO.idle, { ttl: 10 }); }
  // 매 프레임: 민아를 움직이고 자리 · 높이 · 방향 · 속도를 돌려준다. 새 길찾기를 쓸 수 없는 곳(예전 층 · 먼 바깥)이면 null → 게임의 예전 따라가기
  const OUTV = { x: 0, y: 0, z: 0, yaw: 0, v: 0, stair: false, emotion: 'calm', look: false, lx: 0, lz: 0, pose: 'none', point: false };
  // 대기 행동: 민아가 멈춘 시간 · 플레이어가 가만히 있는 시간 · 감정 · 등 뒤 벽 → 둘러보기 · 휴대폰 · 팔짱 · 벽 기대기 · 쪼그려 쉬기
  const IB = { still: 0, pIdle: 0, px: 0, pz: 0, pose: 'none', t: 0, wall: false, wallYaw: 0, scan: 0 };
  function wallBehind(G) {   // 등 뒤 0.55m 가 막혀 있고 옆은 트인 방향 → 기댈 벽 (8방향 중)
    for (let k = 0; k < 8; k++) { const a = n.yaw + Math.PI + (k & 1 ? 1 : -1) * (k >> 1) * .785; if (!walkableAt(G, n.x + Math.sin(a) * .55, n.z + Math.cos(a) * .55) && walkableAt(G, n.x + Math.sin(a) * .2, n.z + Math.cos(a) * .2)) { IB.wallYaw = a + Math.PI; return true; } }
    return false;
  }
  function idleTick(dt, t) {
    const moving = n.v > .08 || n.state === 'stair' || n.state === 'walk'; IB.still = moving ? 0 : IB.still + dt;
    const pm = Math.hypot(P.x - IB.px, P.z - IB.pz); IB.px = P.x; IB.pz = P.z; IB.pIdle = pm > .02 * Math.max(1, dt * 60) ? 0 : IB.pIdle + dt;
    if (moving) { IB.pose = 'none'; IB.t = 0; return; }
    if ((IB.t -= dt) <= 0) { IB.t = 1.5 + env.rand() * 1.5; const G = grids[n.f]; IB.wall = !!G && IB.still > 6 && wallBehind(G);
      const prev = IB.pose; IB.pose = idleBehavior({ still: IB.still, pIdle: IB.pIdle, emo: EMO.cur, dark: EMO.dark, wall: IB.wall, r: env.rand(), cur: IB.pose === 'look' ? 'none' : IB.pose });
      if (IB.pose === 'sit' && !SE.on && seatTry(t, false)) IB.pose = 'none';
      if (IB.pose !== prev) { if (IB.pose === 'sit') say('idle_sit', ML('idle_sit'), PRIO.idle, { ttl: 4 }); else if (IB.pose === 'phone' && env.rand() < .3) say('idle_phone', ML('idle_phone'), PRIO.idle, { ttl: 4 }); }
      if (IB.pose === 'look' && LOOK.t <= 0) { const a = n.yaw + (env.rand() - .5) * 2.6; LOOK.x = n.x + Math.sin(a) * 5; LOOK.z = n.z + Math.cos(a) * 5; LOOK.t = 1.2 + env.rand(); } }
    if (IB.pose === 'lean') { const e = angTo(n.yaw, IB.wallYaw); n.yaw += Math.sign(e) * Math.min(Math.abs(e), dt * 2.2); }   // 벽에 등을 댄다
  }
  // ── 주변과 상호작용 (심부름): 조사한 사물 만져 보기 · 불 켜기 · 던진 캔 줍기 · 소리 쪽으로 다가가기 ──
  //   같은 층 · 가까울 때만 · 플레이어가 멀어지거나(12m) 15초 넘으면 그만둔다 · 길/퍼즐을 막지 않는다(충돌체 없음 · 도착 뒤 바로 따라가기로)
  const ER = { on: false, x: 0, z: 0, fx: 0, fz: 0, t: 0, act: 0, done: null, pose: 'touch', line: null, n: 0 };
  // 사물에 손 뻗으러 갈 자리: 걸을 수 있고 · 몸 둘레 0.3m 안에 충돌체가 없는 곳 — 사물에서 민아 쪽으로 물러나며 찾는다
  const CLEAR = .3;
  function clearAt(f, x, z) { const G = grids[f]; if (!G || !walkableAt(G, x, z)) return false; try { return !R.blocked || !R.blocked(x, z, layerY(f), CLEAR); } catch (e) { return true; } }
  function standPoint(f, x, z) {
    const G = grids[f]; const dx = n.x - x, dz = n.z - z, l = Math.max(.3, Math.hypot(dx, dz)), ux = dx / l, uz = dz / l;
    for (const d of [.55, .7, .85, 1.0, 1.2]) for (const sa of [0, .5, -.5, 1, -1]) { const c = Math.cos(sa), s2 = Math.sin(sa), vx = ux * c - uz * s2, vz = ux * s2 + uz * c, tx = x + vx * d, tz = z + vz * d; if (clearAt(f, tx, tz)) return { x: tx, z: tz }; }
    const c = nearestFree(G, x + ux * .55, z + uz * .55, 1.4); return c < 0 ? null : { x: cellX(G, c), z: cellZ(G, c) };
  }
  function errand(x, z, { done = null, pose = 'touch', line = null, maxD = 10 } = {}) {
    if (!n.active || ER.on || n.state === 'stair' || n.f !== env.player.f || !isPlaying()) return false;
    const G = grids[n.f]; if (!G || Math.hypot(x - n.x, z - n.z) > maxD) return false;
    if (SE.on) return false; const sp = standPoint(n.f, x, z); if (!sp) return false;
    ER.on = true; ER.x = sp.x; ER.z = sp.z; ER.fx = x; ER.fz = z; ER.t = 15; ER.act = 0; ER.done = done; ER.pose = pose; ER.line = line; ER.n++;
    TASK.f = n.f; TASK.x = ER.x; TASK.z = ER.z; n.speed = 1.3; startTask(n, TASK, env); IB.pose = 'none'; stats.errands = (stats.errands || 0) + 1; return true;
  }
  function errandTick(dt) {
    if (!ER.on) return false; ER.t -= dt; const dp = Math.hypot(P.x - n.x, P.z - n.z);
    if (ER.t <= 0 || dp > 12 || n.f !== env.player.f || !isPlaying()) { ER.on = false; IB.pose = 'none'; return false; }
    if (ER.act > 0) { ER.act -= dt; IB.pose = ER.pose; const e = angTo(n.yaw, Math.atan2(ER.fx - n.x, ER.fz - n.z)); n.yaw += Math.sign(e) * Math.min(Math.abs(e), dt * 4);
      if (ER.act <= 0) { ER.on = false; IB.pose = 'none'; IB.still = 0; } return true; }
    if (n.state !== 'walk' && Math.hypot(ER.x - n.x, ER.z - n.z) < .6) { ER.act = ER.pose === 'none' ? .6 : 1.3; LOOK.x = ER.fx; LOOK.z = ER.fz; LOOK.t = 1.6; LOOK.pt = true;
      try { ER.done && ER.done(); } catch (e) { /* */ } if (ER.line) say(ER.line, ML(ER.line), PRIO.comment, { ttl: 5 }); stats.errandsDone = (stats.errandsDone || 0) + 1; return true; }
    if (n.state === 'idle') { TASK.f = n.f; TASK.x = ER.x; TASK.z = ER.z; startTask(n, TASK, env); }
    return true;
  }
  // 소리 · 가림 판정 (게임의 위치 소리 · 민아 목소리): 0 트임 ~ 1 막힘 — 벽(격자 시야) · 닫힌 문 · 다른 층
  function hearOcc(x, z) {
    const pf = env.player.f; if (!n.active) return 0; if (n.f !== pf || n.state === 'stair') return .8;
    const G = grids[pf]; let o = G && gridLOS(G, P.x, P.z, x, z) ? 0 : .55; const y = layerY(pf), d = Math.hypot(x - P.x, z - P.z), k = Math.min(8, Math.ceil(d / 1.5));
    for (let i = 1; i < k; i++) { const dd = R.nearDoor(P.x + (x - P.x) * i / k, P.z + (z - P.z) * i / k, y); if (dd && dd.target < .5 && Math.hypot(dd.mx - (P.x + (x - P.x) * i / k), dd.mz - (P.z + (z - P.z) * i / k)) < .7) { o += .35; break; } }
    return Math.min(1, o);
  }
  // 플레이어 시야(카메라 → 보는 곳)를 가리면 옆으로 비켜선다 (조사 대상이 가려지지 않게)
  let occT = 0;
  function viewTick(dt) {
    const V = view && view(); if (!V || !V.on || n.state !== 'idle' || n.f !== env.player.f) { occT = 0; return; }
    if (!occludes(V.cx, V.cz, V.tx, V.tz, n.x, n.z, .4)) { occT = 0; return; }
    if ((occT += dt) < .45) return; occT = 0; const G = grids[n.f], dx = V.tx - V.cx, dz = V.tz - V.cz, l = Math.hypot(dx, dz) || 1, px = -dz / l, pz = dx / l;
    const side = ((n.x - V.cx) * px + (n.z - V.cz) * pz) >= 0 ? 1 : -1;
    for (const r of [.9, 1.3, .6]) for (const sg of [side, -side]) { const tx = n.x + px * r * sg, tz = n.z + pz * r * sg;
      if (G && clearAt(n.f, tx, tz) && gridLOS(G, n.x, n.z, tx, tz) && !occludes(V.cx, V.cz, V.tx, V.tz, tx, tz, .45)) { TASK.f = n.f; TASK.x = tx; TASK.z = tz; n.speed = 1.2; startTask(n, TASK, env); stats.viewYields = (stats.viewYields || 0) + 1; IB.pose = 'none'; return; } }
  }
  // 순간이동은 플레이어가 보지 않을 때만: 민아의 지금 자리 · 옮겨 갈 자리 둘 다 시야 밖(시야각 밖 · 벽 너머)
  let sepT = 0, sepFar = false;
  function unseen(f, x, z) { const V = view && view(); const cx = V && V.on ? V.cx : P.x, cz = V && V.on ? V.cz : P.z, fx = V && V.on ? V.tx - V.cx : Math.sin(P.yaw), fz = V && V.on ? V.tz - V.cz : Math.cos(P.yaw);
    const pf = env.player.f, G = grids[f], los = f === pf && G && gridLOS(G, P.x, P.z, x, z); return canTeleportUnseen(cx, cz, fx, fz, x, z, !!los); }
  function teleportHidden(pf) {
    const G = grids[pf]; if (!G) return false; const V = view && view(), back = V && V.on && V.third ? 3.4 : 1.4;
    for (const d of [back, back + 1.2, 2.2]) { followGoal(P.x, P.z, P.yaw, (x, z) => walkableAt(G, x, z) && gridLOS(G, P.x, P.z, x, z) && unseen(pf, x, z), d, GOAL); if (GOAL.x !== P.x || GOAL.z !== P.z) { const far = sepFar; const ok = teleportBehind(pf, GOAL.x, GOAL.z); if (ok && far) say('sep_found', ML('sep_found'), PRIO.react, { ttl: 6 }); return ok; } }
    return false;
  }
  // ── 진짜 의자에 앉기 (window.__seats · 없으면 쪼그려 쉬기) ──
  //   플레이어가 곁에서 오래 가만히 있으면 가까운 자리로 걸어가 앉는다 · 플레이어가 앉으면(교실 의자) 맞은편 자리 · 플레이어가 움직이면 일어선다
  const SE = { on: false, ph: '', s: null, h: .45, t: 0, fx: 0, fz: 0, across: false, cd: 0, uses: 0, tries: 0 };
  const seatList = () => { try { const a = seats ? seats() : (typeof window !== 'undefined' ? window.__seats : null); return Array.isArray(a) ? a : null; } catch (e) { return null; } };
  const pSeat = () => { try { return playerSeat ? playerSeat() : null; } catch (e) { return null; } };
  function seatTry(t, across) {
    if (SE.on || t < SE.cd || ER.on || n.state === 'stair' || n.f !== env.player.f) return false; SE.cd = t + 6; SE.tries++;
    const L = seatList(); if (!L || !L.length) return false; const G = grids[n.f], fy = layerY(n.f), ok = (x, z) => clearAt(n.f, x, z) || (G && walkableAt(G, x, z));
    const ps = across ? pSeat() : null;
    const s = (ps && seatAcross(L, ps, fy, ok)) || pickSeat(L, { floorY: fy, px: P.x, pz: P.z, mx: n.x, mz: n.z, ok, maxP: across ? 3.2 : 4.5 }); if (!s) return false;
    const fr = seatFront(s); const c = nearestFree(G, fr.x, fr.z, .9); if (c < 0) return false;
    SE.on = true; SE.ph = 'go'; SE.s = s; SE.h = seatHeight(s, fy); SE.fx = cellX(G, c); SE.fz = cellZ(G, c); SE.t = 16; SE.across = !!(ps && across);
    TASK.f = n.f; TASK.x = SE.fx; TASK.z = SE.fz; n.speed = 1.2; startTask(n, TASK, env); IB.pose = 'none'; return true;
  }
  function seatLeave(quiet) { if (!SE.on) return; if (SE.ph === 'sit' || SE.ph === 'in') { SE.ph = 'up'; SE.t = .7; if (!quiet) say('seat_up', ML('seat_up'), PRIO.idle, { ttl: 3 }); } else { SE.on = false; SE.ph = ''; SE.why = 'leave'; } }
  // 앉기 진행 (true: 이번 프레임 민아를 이쪽에서 움직였다 — 따라가기 목표를 바꾸지 않는다)
  function seatTick(dt) {
    if (!SE.on) return false; const s = SE.s;
    { const pm = Math.hypot(P.x - IB.px, P.z - IB.pz); IB.px = P.x; IB.pz = P.z; IB.pIdle = pm > .02 ? 0 : IB.pIdle + dt; }
    if (n.f !== env.player.f || !isPlaying() || n.state === 'stair') { if (SE.ph !== 'go') { n.x = SE.fx; n.z = SE.fz; } SE.on = false; SE.ph = ''; SE.why = 'ctx'; return false; }
    if (SE.ph === 'go') { if ((SE.t -= dt) <= 0) { SE.on = false; SE.ph = ''; SE.why = 'timeout'; return false; }
      if (n.state !== 'walk' && Math.hypot(SE.fx - n.x, SE.fz - n.z) < .45) { SE.ph = 'in'; SE.t = .6; n.state = 'idle'; n.t = 1e9; n.pn = 0; n.v = 0; }
      else if (n.state === 'idle') { TASK.f = n.f; TASK.x = SE.fx; TASK.z = SE.fz; startTask(n, TASK, env); }
      if (SE.across ? !pSeat() : IB.pIdle < .4 && Math.hypot(P.x - s.x, P.z - s.z) > 5) { SE.on = false; SE.ph = ''; SE.why = 'moved'; }
      return true; }
    if (SE.ph === 'in' || SE.ph === 'up') {   // 앞자리 ↔ 의자 사이를 0.6초에 미끄러지듯 (몸을 돌리며)
      const k = Math.min(1, dt / Math.max(.05, SE.t)); SE.t -= dt; const tx = SE.ph === 'in' ? s.x : SE.fx, tz = SE.ph === 'in' ? s.z : SE.fz;
      n.x += (tx - n.x) * k; n.z += (tz - n.z) * k; n.yaw += angTo(n.yaw, (s.yaw || 0) + Math.PI) * Math.min(1, dt * 6);
      if (SE.t <= 0) { if (SE.ph === 'in') { SE.ph = 'sit'; SE.uses++; stats.seatUses = (stats.seatUses || 0) + 1; n.x = s.x; n.z = s.z; say(SE.across ? 'seat_across' : 'seat_sit', ML(SE.across ? 'seat_across' : 'seat_sit'), PRIO.idle, { ttl: 4 }); }
        else { SE.on = false; SE.ph = ''; n.x = SE.fx; n.z = SE.fz; IB.still = 0; } }
      return true; }
    // 앉아 있음: 플레이어가 움직이면(다시 걷거나 일어서면) 일어선다
    n.yaw += angTo(n.yaw, (s.yaw || 0) + Math.PI) * Math.min(1, dt * 4); n.v = 0;
    const ps = pSeat(); if ((SE.across && !ps) || (!SE.across && (IB.pIdle < .01 || ps)) || Math.hypot(P.x - n.x, P.z - n.z) > 5) seatLeave(false);
    return true;
  }
  function follow(dt, m) {
    if (!enabled) return null;
    if (!buildDone) { buildDone = buildStep(4); stats.built = buildDone; if (!buildDone) return null; }
    const t0 = performance.now(), pf = playerLayer(), pl = env.player;
    pl.x = P.x; pl.z = P.z; pl.f = pf; pl.y = P.sh || 0; pl.on = isPlaying() && pf !== -9;
    if (pf === -9) { n.active = false; return null; }
    if (!n.active) {   // 예전 방식에서 넘어옴: 지금 자리가 같은 층 걸을 수 있는 곳이면 거기서, 아니면 플레이어 뒤에
      n.active = true; const my = m ? m.position.y : -99, f = Math.round(my / FH), q = pend; pend = null;
      if (q && q.f === pf && Math.hypot(q.x - P.x, q.z - P.z) < 25 && place(q.f, q.x, q.z)) { /* 세이브 자리 */ } else
      if (!(m && f === pf && grids[f] && Math.abs(my - f * FH) < .4 && walkableAt(grids[f], m.position.x, m.position.z) && place(f, m.position.x, m.position.z))) teleportBehind(pf);
    }
    const onStairs = pf !== OUT && Math.abs((P.sh || 0) - pf * FH) > .25;   // 플레이어가 계단 위: 층이 정해질 때까지 목표를 바꾸지 않는다 (계단실 안은 따로 떨어진 칸)
    let same = n.f === pf && n.state !== 'stair', dp = Math.hypot(P.x - n.x, P.z - n.z);
    // 너무 멀거나(40m) 길이 계속 끊기면 플레이어 뒤로 — 같은 층 가까이(보이는 곳)에선 순간이동하지 않는다
    // 떨어짐: 너무 멀거나(40m) 길이 계속 끊기면 플레이어 뒤로 — 단, 민아도 옮길 자리도 플레이어 시야 밖일 때만 (오래(12초) 못 옮기면 그땐 옮긴다)
    if (dp > 15 || n.f !== pf) sepFar = sepFar || dp > 15;
    if ((dp > 40 || n.fails >= 3 || n.stuckN >= 3) && n.state !== 'stair' && !onStairs && !(same && dp < 12 && n.fails < 6)) {
      sepT += dt; const hid = !same || unseen(n.f, n.x, n.z);
      if ((hid && teleportHidden(pf)) || (sepT > 12 && teleportBehind(pf))) { same = true; dp = Math.hypot(P.x - n.x, P.z - n.z); stats.hiddenTeleports = (stats.hiddenTeleports || 0) + (sepT > 12 ? 0 : 1); }
    } else if (dp < 6 && same) { sepT = 0; sepFar = false; }
    // 목표 갱신 (0.35초마다): 플레이어 뒤 · 같은 층이고 가까우면 멈추고 바라본다
    if (!SE.on && !ER.on && same && dp < 6 && pSeat()) seatTry(clock(), true);
    const busyErr = errandTick(Math.min(dt, .1)) || seatTick(Math.min(dt, .1));
    if (!busyErr && (n.goalT -= dt) <= 0 && !onStairs && n.state !== 'stair' && n.state !== 'talk' && n.state !== 'yield') {
      n.goalT = .35; const EF = EMO_FOLLOW[EMO.cur] || EMO_FOLLOW.calm, sp = followSpeed(same, dp, EF[1]);
      if (sp === 0) { if (n.state !== 'idle' && !(n.state === 'walk' && (n.speed < 1.3 || (n.pn && Math.hypot(n.path[n.pn * 2 - 2] - n.x, n.path[n.pn * 2 - 1] - n.z) < 1.4)))) { n.state = 'idle'; n.t = 1e9; n.pn = 0; }   // 남은 길이 짧으면 끝까지 걸으며 멈춘다(급정거 없음)
        // 플레이어가 바로 붙으면(0.75m) 한 걸음 비켜선다
        if (dp < .75 && n.state === 'idle') { const G = grids[n.f], ax = n.x - P.x, az = n.z - P.z, l = Math.hypot(ax, az) || 1, tx = n.x + ax / l * .9, tz = n.z + az / l * .9; if (clearAt(n.f, tx, tz) && gridLOS(G, n.x, n.z, tx, tz)) { TASK.f = n.f; TASK.x = tx; TASK.z = tz; n.speed = 1.2; startTask(n, TASK, env); } } }
      else { n.speed = sp; const G = grids[pf]; followGoal(P.x, P.z, P.yaw, (x, z) => walkableAt(G, x, z), EF[0], GOAL);
        const moved = TASK.f !== pf || Math.hypot(GOAL.x - TASK.x, GOAL.z - TASK.z) > 1.0;
        if (moved || n.state === 'idle' || n.state === 'act') { TASK.f = pf; TASK.x = GOAL.x; TASK.z = GOAL.z; startTask(n, TASK, env); if (n.state === 'idle') { n.fails++; n.t = 1e9; } else n.fails = 0; } }
    }
    if (!(SE.on && SE.ph !== 'go')) stepNPC(n, Math.min(dt, .1), env);
    if (n.state === 'act' || (n.state === 'idle' && n.t < 1e8)) { n.state = 'idle'; n.t = 1e9; }
    if ((ER.on && ER.act > 0) || (SE.on && SE.ph !== 'go')) { /* 만지는 중 · 앉는 중: 플레이어 쪽으로 돌지 않는다 */ } else   // 도착: 다음 목표는 위에서
    if (n.state === 'idle') { const ty = Math.atan2(P.x - n.x, P.z - n.z), e = Math.atan2(Math.sin(ty - n.yaw), Math.cos(ty - n.yaw)); n.yaw += Math.sign(e) * Math.min(Math.abs(e), dt * 2.6); }
    closeDoors(n);
    if ((watchT -= dt) <= 0) { watchT = .5; if (pl.on) watch(pf); }
    if (pl.on) tidyTick(Math.min(dt, .1));
    if (pl.on && !ER.on && !SE.on) { idleTick(Math.min(dt, .1), clock()); viewTick(Math.min(dt, .1)); } pumpSpeech();
    OUTV.x = n.x; OUTV.z = n.z; OUTV.y = n.state === 'stair' && n.hop ? n.y : layerY(n.f); OUTV.yaw = n.yaw; OUTV.v = n.v; OUTV.stair = n.state === 'stair'; OUTV.emotion = EMO.cur; OUTV.pose = SE.on && SE.ph !== 'go' ? 'chair' : IB.pose; OUTV.seatH = SE.h; OUTV.seatK = SE.ph === 'sit' ? 1 : SE.ph === 'in' ? 1 - Math.max(0, SE.t) / .6 : SE.ph === 'up' ? Math.max(0, SE.t) / .7 : 0; if (LOOK.t > 0) LOOK.t -= dt; else LOOK.pt = false; OUTV.point = !!LOOK.pt && LOOK.t > 0; OUTV.look = LOOK.t > 0; OUTV.lx = LOOK.x; OUTV.lz = LOOK.z;
    const ms = performance.now() - t0; stats.tickMs += ms; stats.ticks++; if (ms > stats.tickMax) stats.tickMax = ms;
    return OUTV;
  }
  // ── 플레이어 상호작용: 바라보는 민아 ──
  function pick(px, pz, fx, fz) {
    if (!n.active || n.state === 'stair' || n.f !== playerLayer()) return null; const dx = n.x - px, dz = n.z - pz, d = Math.hypot(dx, dz); if (d > 2.2) return null;
    const f = (dx * fx + dz * fz) / Math.max(d, .01); return f > .6 ? { n, label: `${NPC_TALK_LABEL} · ${NAMES.mina}` } : null;
  }
  function context() {
    let c = {}; try { c = (mind && mind()) || {}; } catch (e) { c = {}; }
    if (!c.ch || !c.main) { const o = objective && objective(); if (o) { c.ch ??= o.ch; c.main ??= o.main; c.where ??= o.loc && o.loc.where; } }
    c.dark = darkHere(playerLayer()); c.visited = visited.size; c.emotion = EMO.cur; lastCtx = c; return c;
  }
  function talk() {
    stats.talks++; talkTo(n, 4); n.lines++;
    const t = clock(), c = context(), r = pickLine('mina', NPC_LINES.mina, c, n.mem, t, NPC_HINT_MAIN, () => HD.request('mina', NPC_LINES.mina, c, t, NPC_HINT_MAIN, { force: true })); lastLine = r;
    Q.clear(PRIO.hint); Q.hold(t, 5.6); IB.pose = 'none'; IB.still = 0; subtitle(NAMES.mina, r.text, 5); logSaid(r.text, t); GATE.mark(r.text, t); return r.text;
  }
  function reset() { pend = null; ER.on = false; SE.on = false; SE.ph = ''; Q.reset(); GATE.reset(); IB.pose = 'none'; IB.still = 0; sepT = 0; exam.due = 0; HD.reset(); EMO.emo = 'calm'; EMO.until = 0; EMO.cur = 'calm'; progKey = null; stuckCd = -1e9; LOOK.t = 0; n.mem = newMemory(); visited.clear(); n.active = false; n.opened.length = 0; n.lines = 0; wasDark = null; lastKeys = -1; lastRoom = ''; anyCd = -1e9; resetNPC(n); }
  // ── 저장 · 불러오기: 세이브의 npc 칸 { v, mina: { on, f, x, z, yaw, lines, mem }, visited } — v 가 다르거나 없으면 처음 상태 ──
  function serialize() {
    const st = n.state === 'stair' && n.hop ? (n.hop.dir > 0 ? { f: n.hop.p.la, x: n.hop.p.ax, z: n.hop.p.az } : { f: n.hop.p.lb, x: n.hop.p.bx, z: n.hop.p.bz }) : { f: n.f, x: n.x, z: n.z };
    return { v: MIND_VER, hd: HD.serialize(), gate: GATE.serialize(), mina: { on: n.active, f: st.f, x: Math.round(st.x * 100) / 100, z: Math.round(st.z * 100) / 100, yaw: Math.round(n.yaw * 100) / 100, lines: n.lines, mem: n.mem }, visited: [...visited].slice(0, 300) };
  }
  function restore(d) {
    reset(); if (!d || typeof d !== 'object' || d.v !== MIND_VER) return false;
    const s = d.mina; if (s && typeof s === 'object') { n.mem = sanitizeMemory(s.mem); n.lines = Number.isFinite(s.lines) ? s.lines | 0 : 0;
      if (s.on && LYR[s.f] && Number.isFinite(s.x) && Number.isFinite(s.z)) { pend = { f: s.f, x: s.x, z: s.z }; if (Number.isFinite(s.yaw)) n.yaw = s.yaw; } }
    if (Array.isArray(d.visited)) for (const w of d.visited.slice(0, 300)) if (typeof w === 'string') visited.add(w);
    if (d.hd) HD.restore(d.hd); else HD.absorb(n.mem);   // 예전 세이브: 민아 혼자 올리던 힌트 단계를 공용 단계로
    GATE.restore(d.gate);   // 반복 기록(playTime 기준)도 세이브와 함께
    return true;
  }
  function setEnabled(v) { enabled = !!v; if (!enabled) n.active = false; }
  const api = { mina: n, npcs: [n], grids, portals, panels, layers: LYR, OUT, stats, follow, pick, talk, reset, serialize, restore, setEnabled, env, visited, context, react, lastLine: () => lastLine,
    remember, chatter, errand, showItem, decorNotice, seat: () => ({ on: SE.on, ph: SE.ph, uses: SE.uses, tries: SE.tries, across: SE.across, why: SE.why || '' }), seatTry: across => seatTry(clock(), !!across), standUp: () => seatLeave(true), errandBusy: () => ER.on, hearOcc, say: (id, prio = PRIO.comment) => !!MINA_LINES[id] && say(id, ML(id), prio), queue: Q, gate: GATE, lineStats: () => ({ said: LS.said, repeats: LS.repeats, distinct: LS.byText.size, gate: { ...GATE.stats }, queue: { ...Q.stats } }),
    quiet: sec => Q.size === 0 && clock() - Math.max(anyCd, -1e9) > sec, pose: () => IB.pose, hint: HD,
    emotion: () => EMO.cur, setEmotion: setEmo,
    buildAll() { while (!buildStep(1e9)); buildDone = true; stats.built = true; }, playerLayer, layerY, igpu };
  if (debug) window.__npc = api;
  // 읽기 전용 상태 (선택 기능 · 자유 대화 등이 읽는다): 읽을 때마다 새 사본 — 바꿔도 민아에겐 영향 없음
  const snapshot = () => { let c = null; try { c = context(); } catch (e) { c = null; } const m = n.mem;
    const tiers = Object.entries(HD.st.tier).filter(([k]) => /^ch/.test(k)).map(([k, v]) => `${k} 힌트 ${v}/3단계`).join(', ');
    const memorySummary = `말 건 횟수 ${m.n} · 감정 ${EMO.cur} · ${tiers || '힌트 아직 없음'} · 돌아본 곳 ${visited.size}곳${lastRoom ? ' (지금: ' + lastRoom + ')' : ''} · 막힌 시간 ${progKey == null ? 0 : Math.round(clock() - progT)}초`;
    return Object.freeze({ remember, memorySummary, recentLines: recent.slice(), hintLine: apiHint, fallbackLine: apiFallback, active: n.active, state: n.state, emotion: EMO.cur, emotions: EMOTIONS.slice(), layer: n.f, onStairs: n.state === 'stair', pos: { x: +n.x.toFixed(2), y: +(n.state === 'stair' && n.hop ? n.y : layerY(n.f)).toFixed(2), z: +n.z.toFixed(2) },
      distToPlayer: +Math.hypot(P.x - n.x, P.z - n.z).toFixed(2), lookingAt: LOOK.t > 0 ? { x: LOOK.x, z: LOOK.z } : null,
      memory: { talks: m.n, hintTiers: { ...HD.st.tier }, toldCount: Object.keys(m.told).length, told: Object.keys(m.told).slice(-30), visitedRooms: [...visited].slice(-30), lastLine: lastLine ? { key: lastLine.key, text: lastLine.text, topic: lastLine.topic } : null },
      objective: c ? { context: `제${c.ch || 1}장 · ${c.main || ''}${c.where ? ' · ' + c.where : ''}${c.dark ? ' · 정전' : ''}`, ch: c.ch, main: c.main, where: c.where, dark: c.dark, keys: c.keys, late: c.late } : null,
      stuck: { secondsWithoutProgress: progKey == null ? 0 : Math.round(clock() - progT), failedAttempts: failsNow() - failBase } }); };
  // 자유 대화 모듈용: 지금 장의 다음 힌트(규칙 · 단계 · 기억 그대로 — 너무 이르면 지금 단계 다시) · 규칙 기반 대사(대답 못 할 때)
  function apiHint() { const c = context(), h = HD.request('mina', NPC_LINES.mina, c, clock(), NPC_HINT_MAIN, { force: true }); if (h) { n.mem.told[h.key] = (n.mem.told[h.key] || 0) + 1; lastLine = h; return h.text; }
    const ch = c.ch || 1, t = HD.repeatTier(ch), H = CH_HINT_[ch]; return !H ? null : t === 1 && c.where ? NPC_LINES.mina.hint.replace('{}', c.where) : H[t >= 2 ? 1 : 0]; }
  function apiFallback() { const c = context(), t = clock(), r = pickLine('mina', NPC_LINES.mina, c, n.mem, t, NPC_HINT_MAIN, () => HD.request('mina', NPC_LINES.mina, c, t, NPC_HINT_MAIN, { force: true })); lastLine = r; return r.text; }
  api.snapshot = snapshot; api.hintLine = apiHint; api.fallbackLine = apiFallback;
  try { Object.defineProperty(window, '__mina', { get: snapshot, configurable: true }); } catch (e) { /* 브라우저 밖 */ }
  return api;
}
