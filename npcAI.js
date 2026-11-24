// 서린고 : 잊혀진 시간 — 방과 후 학교의 사람들 (NPC 이동 · 행동 · 사물 반응)
//   · 길찾기: 층마다 기존 충돌체(RBG.groundAt / RBG.blocked)로 만든 걷기 격자 + A* + 시야 직선화
//   · 행동: 일정(순찰 · 방 점검 · 청소 · 자습) 상태 기계 — 플레이어를 보면 돌아보고, 말을 걸면 짧은 대사 · 현재 목표 힌트
//   · 사물: NPC 가 문을 열고 닫고, 교실 불을 켰다 끄고, 청소 카트를 밀고, 종이를 옮기고, 교무실 전화를 받는다
//   · 충돌체가 없다(플레이어 길을 막지 않음) — 가까이 오면 비켜선다. 저장하지 않고 시작 · 불러오기 때 일정 처음으로 되돌린다
//   · 끄기: ?nonpc · 내장 그래픽(igpu): NPC 2명 · 다른 층 NPC 는 멈춤
// 앞부분(격자 · A* · 상태 기계)은 THREE 없이 동작한다 (tests/npcAI.test.mjs)

// ───────────────────────── 1. 걷기 격자 ─────────────────────────
export function createNavGrid({ x0, z0, x1, z1, cell = .3 }) {
  const nx = Math.max(1, Math.ceil((x1 - x0) / cell)), nz = Math.max(1, Math.ceil((z1 - z0) / cell)), N = nx * nz;
  return { x0, z0, cell, nx, nz, w: new Uint8Array(N), built: 0, ready: false,
    g: new Float32Array(N), par: new Int32Array(N), seen: new Uint32Array(N), closed: new Uint32Array(N), stamp: 0, heap: new Int32Array(N), hf: new Float32Array(N) };
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
    if (++iter > 60000) break;
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
    blockT: 0, yx: 0, yz: 0, stuckT: 0, stuckD: 0, stuckN: 0, replans: 0, arrivals: 0, interrupt: null, look: 0, toF: -1, sitting: false };
}
export function resetNPC(n) { const t0 = n.def.tasks[0]; Object.assign(n, { f: n.def.f ?? t0.f, x: n.def.x ?? t0.x, z: n.def.z ?? t0.z, yaw: n.def.yaw || 0, state: 'idle', t: n.def.delay || .5, ti: -1, task: null, pn: 0, pi: 0, v: 0, blockT: 0, stuckT: 0, stuckN: 0, interrupt: null, toF: -1, sitting: false }); }
const angTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
function turn(n, ty, dt, rate = 4) { const e = angTo(n.yaw, ty); n.yaw += Math.sign(e) * Math.min(Math.abs(e), rate * dt); }
function startTask(n, task, env) {
  n.task = task; n.sitting = false;
  if (task.f !== n.f) {   // 다른 층: 계단으로
    const s = env.stair(n.f); n.toF = task.f;
    if (!env.plan(n, s.x, s.z)) { n.state = 'idle'; n.t = 2; return; }
  } else { n.toF = -1; if (!env.plan(n, task.x, task.z)) { n.state = 'idle'; n.t = 2; env.event(n, 'fail', task); return; } }
  n.state = 'walk'; n.stuckT = 0; n.stuckD = 0; n.blockT = 0;
}
function nextTask(n, env) {
  if (n.interrupt && n.interrupt.f === n.f) { const t = n.interrupt; n.interrupt = null; startTask(n, t, env); return; }
  const T = n.def.tasks; n.ti = (n.ti + 1) % T.length; startTask(n, T[n.ti], env);
}
export function talkTo(n, sec = 4.5) { if (n.state === 'talk') { n.t = sec; return; } n.prevState = n.state; n.prevT = n.t; n.state = 'talk'; n.t = sec; n.v = 0; }
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
  const P = env.player, pd = P && P.on && P.f === n.f ? Math.hypot(P.x - n.x, P.z - n.z) : 99;
  n.look = pd < 3.2 && n.state !== 'walk' ? 1 : 0;
  switch (n.state) {
    case 'idle': n.v = 0; if ((n.t -= dt) <= 0) nextTask(n, env); break;
    case 'talk': n.v = 0; turn(n, Math.atan2(P.x - n.x, P.z - n.z), dt, 5);
      if ((n.t -= dt) <= 0) { const ps = n.prevState; if ((ps === 'walk' || ps === 'yield') && n.task) startTask(n, n.task, env); else if (ps === 'act' || ps === 'stair') { n.state = ps; n.t = Math.max(.5, n.prevT); } else { n.state = 'idle'; n.t = .5; } }
      break;
    case 'act': {
      n.v = 0; const tk = n.task;
      if (n.look && pd < 2.2) turn(n, Math.atan2(P.x - n.x, P.z - n.z), dt, 3);   // 플레이어가 다가오면 돌아본다
      else if (tk && tk.face) turn(n, Math.atan2(tk.face[0] - n.x, tk.face[1] - n.z), dt, 3);
      env.event(n, 'tick', tk);
      if ((n.t -= dt) <= 0) { n.sitting = false; env.event(n, 'done', tk); if (n.interrupt && n.interrupt.f === n.f) nextTask(n, env); else { n.state = 'idle'; n.t = .4 + env.rand() * .8; } }
      break; }
    case 'stair': n.v = 0; if ((n.t -= dt) <= 0) { const s = env.stair(n.toF); n.f = n.toF; n.x = s.x; n.z = s.z; n.toF = -1; env.event(n, 'arriveFloor', n.task); startTask(n, n.task, env); } break;
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
      const before = n.moved, r = sp > .01 ? follow(n, sp * dt, env) : 'moving';
      n.v = (n.moved - before) / Math.max(dt, 1e-4);
      if (n.pi < n.pn) { const hx = n.path[n.pi * 2] - n.x, hz = n.path[n.pi * 2 + 1] - n.z; if (hx * hx + hz * hz > 1e-4) turn(n, Math.atan2(hx, hz), dt, 6); }
      // 막힘 감지: 1.5초 동안 0.15m 도 못 가면(문 · 플레이어 대기 제외) 다시 길을 찾고, 세 번째엔 가까운 빈칸으로 옮긴다
      if (r !== 'door' && sp > .3) { n.stuckT += dt; n.stuckD += n.moved - before; if (n.stuckT > 1.5) { if (n.stuckD < .15) { n.stuckN++; n.replans++; env.event(n, 'stuck', n.task); if (n.task) startTask(n, n.task, env); } else n.stuckN = 0; n.stuckT = 0; n.stuckD = 0; } }
      if (r === 'arrived') {
        if (n.toF >= 0) { n.state = 'stair'; n.t = 4 + env.rand() * 2; env.event(n, 'stair', n.task); break; }
        n.arrivals++; n.stuckN = 0; const tk = n.task; n.state = 'act'; n.t = tk ? tk.dur : 1; n.sitting = !!(tk && tk.sit); env.event(n, 'arrive', tk);
      }
      break; }
  }
}

// ───────────────────────── 3. 게임 연결 ─────────────────────────
const NAMES = { guard: '경비 아저씨', teacher: '당직 선생님', cleaner: '청소 아주머니', studentA: '자습하는 학생', studentB: '늦게 남은 학생' };
export const NPC_LINES = {
  guard: { bark: '거기 누구여? …아, 학생이구먼. 놀랐잖여.', greet: ['어이 학생, 아직 안 갔어? 늦었는디 조심히 돌아댕겨유.', '순찰 중이여. 문 열린 데 있으면 내가 닫고 갈 텡께 신경 쓰지 말어.', '손전등 배터리는 아껴 써. 복도 끝은 불이 잘 안 들어와.'],
    hint: '순찰 돌다 보니 {} 쪽이 영 수상하더라고. 거기부터 살펴봐유.' },
  teacher: { bark: '누구니? …아, 깜짝 놀랐잖니.', greet: ['어머, 아직 학교에 있었니? 당직이라 나도 아직 못 갔단다.', '교실 불 켜 놓고 간 반이 꼭 있어. 한 바퀴 돌고 와야겠다.', '교무실 전화가 오늘따라 자꾸 울리네…'],
    hint: '찾는 게 있다면 {}부터 가 보렴. 대신 너무 늦지는 말고.',
    phone: '네, 서린고 교무실입니다. …네, 아직 학생이 하나 남아 있어요. 네, 조심히 보내겠습니다.' },
  cleaner: { bark: '어머, 깜짝이야! 기척 좀 내고 다녀, 학생.', greet: ['아이고, 바닥 미끄러워. 조심해서 걸어, 학생.', '화장실 청소만 끝나면 나도 집에 간다. 오늘은 3층까지야.', '떨어진 종이는 내가 주울 테니까 그냥 둬.'],
    hint: '{} 말이지? 아까 청소하다 보니 거기 뭐가 있긴 하더라.' },
  studentA: { bark: '헉… 선생님인 줄 알았네.', greet: ['쉿… 나 내일 모의고사야. 자습실 문 닫고 다녀 줘.', '너도 야자 땡땡이 안 쳤구나? 수능 진짜 얼마 안 남았다…', '아까 복도에서 누가 뛰어가는 소리 들었어. 너였어?'],
    hint: '{}? 거기 가면 뭔가 있을 거야. 선배들도 그랬어.' },
  studentB: { bark: '아, 뭐야… 사람 있었네.', greet: ['선생님한테 나 여기 있다고 말하지 마. 학생회 일 마저 해야 돼.', '매점 문 닫았지? 컵라면 먹고 싶다…', '이 학교 옛날 얘기 알아? 선배들이 그러는데 10년 전에 무슨 일이 있었대.'],
    hint: '학생회 기록에 {} 얘기가 있었어. 한번 가 봐.' },
};
export const NPC_HINT_MAIN = '지금 할 일이라… "{}" 말이지? 천천히 해 봐.';
export const NPC_TALK_LABEL = '말 걸기';
export { NAMES as NPC_NAMES };

// 일정 (본관 · 층 0~3 = 1~4층. 복도 z ≈ -1.8, 교실 z 0.1~10)
export function npcSchedules() {
  const C = -1.8;
  return [
    { id: 'guard', f: 0, speed: 1.05, tasks: [
      { f: 0, x: -40, z: C, act: 'look', dur: 3, face: [-48, C] },
      { f: 0, x: -29.5, z: 4, act: 'look', dur: 2.5, face: [-29.5, 9] },   // 1학년 2반 안을 비춰 본다
      { f: 0, x: -1.9, z: 4, act: 'look', dur: 4, face: [-1.9, 10] },      // 중앙 현관 · 출입문 확인
      { f: 0, x: 21, z: C, act: 'look', dur: 2, face: [21, 2] },
      { f: 0, x: 30, z: 5, act: 'look', dur: 2.5, face: [30, 9] },          // 1학년 4반
      { f: 0, x: 41, z: C, act: 'look', dur: 3, face: [48, C] },
      { f: 0, x: 10, z: C, act: 'look', dur: 2, face: [10, 2] },
    ] },
    { id: 'teacher', f: 0, speed: 1.0, tasks: [
      { f: 0, x: -11, z: 4.2, act: 'desk', dur: 14, face: [-11, 6] },       // 교무실 자리
      { f: 1, x: -39, z: 5, act: 'check', dur: 4, light: true },           // 2학년 1반 점검 (불 켰다 끄기)
      { f: 1, x: -30, z: 5, act: 'check', dur: 4, light: true },
      { f: 1, x: 21, z: 5, act: 'check', dur: 5, light: true },            // 도서실
      { f: 0, x: -11, z: 4.2, act: 'desk', dur: 18, face: [-11, 6] },
      { f: 0, x: 39, z: 5, act: 'check', dur: 4, light: true },            // 1학년 5반
    ] },
    { id: 'cleaner', f: 1, speed: .75, cart: true, tasks: [
      { f: 1, x: 12, z: C, act: 'mop', dur: 6 },
      { f: 1, x: -5.2, z: 4.5, act: 'mop', dur: 7 },                       // 2층 남자 화장실
      { f: 1, x: -.8, z: 4.5, act: 'mop', dur: 7 },                        // 2층 여자 화장실
      { f: 1, x: -25, z: C, act: 'mop', dur: 6 },
      { f: 1, x: -40, z: C, act: 'paper', dur: 3 },                        // 떨어진 종이 줍기
      { f: 1, x: 30, z: C, act: 'mop', dur: 6 },
    ] },
    { id: 'studentA', f: 2, speed: .95, tasks: [
      { f: 2, x: 10.2, z: 4.6, act: 'study', dur: 26, sit: true, face: [10.2, 9], paper: 'drop' },   // 자율학습실 자리 (종이를 책상에 내려놓는다)
      { f: 2, x: 15.4, z: 8.6, act: 'look', dur: 5, face: [15.4, 11], paper: 'pick' },              // 창가 (종이를 집어 든다)
      { f: 2, x: 12.8, z: 2.6, act: 'study', dur: 20, sit: true, face: [12.8, 9], paper: 'drop' },
      { f: 2, x: 9, z: C, act: 'look', dur: 3, face: [0, C], paper: 'pick' },
    ] },
    { id: 'studentB', f: 2, speed: 1.1, tasks: [
      { f: 2, x: 14, z: 6.2, act: 'study', dur: 18, sit: true, face: [14, 9] },
      { f: 2, x: -5.2, z: 4.5, act: 'look', dur: 5 },                      // 화장실
      { f: 2, x: 39, z: 5, act: 'look', dur: 8, face: [39, 9] },           // 학생회실
    ] },
  ];
}

export function installNPCAI({ THREE, scene, R, P, isPlaying, subtitle, objective, at, sfx, igpu, debug }) {
  const MAIN = R.MAIN, FH = MAIN.spec.FH, L = MAIN.layout.L;
  const BOUND = { x0: -L / 2 + .2, x1: L / 2 - .2, z0: MAIN.layout.zN + .05, z1: MAIN.layout.zS - .05 };
  const grids = [], NEED = [0, 1, 2];
  const doorsOff = new Uint8Array(MAIN.doors.length);
  const walkFor = f => { const h = f * FH; return (x, z) => { const g = R.groundAt(x, z, h + .1); if (g == null || Math.abs(g - h) > .12) return false; return !R.blocked(x, z, h, .3); }; };
  // 격자 한 조각: 문 충돌체를 잠깐 끈 상태(열린 문으로 간주)에서 — 같은 호출 안에서 원래대로 돌려 플레이어 판정엔 영향 없음
  function buildStep(budget) {
    for (const f of NEED) {
      const G = grids[f] ||= createNavGrid({ ...BOUND, cell: .3 }); if (G.ready) continue;
      MAIN.doors.forEach((d, i) => { doorsOff[i] = d.col.off ? 1 : 0; d.col.off = true; });
      try { buildNavGrid(G, walkFor(f), budget); } finally { MAIN.doors.forEach((d, i) => { d.col.off = !!doorsOff[i]; }); }
      return false;
    }
    return true;
  }
  const STAIR = [], AVOID = new Int32Array(128);   // 층마다 중앙 계단 입구 (격자가 다 만들어진 뒤 정한다)
  const env = {
    player: { x: 0, z: 0, f: -9, on: false },
    rand: (() => { let s = 1234567; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); })(),
    walkable: (f, x, z) => !!grids[f] && walkableAt(grids[f], x, z),
    clear: (f, x, z) => !!grids[f] && walkableAt(grids[f], x, z) && !R.blocked(x, z, f * FH, .3),   // 비켜설 자리: 닫힌 문 앞도 피한다
    stair: f => STAIR[f] || STAIR[0] || { x: 4.5, z: -1.6 },
    plan(n, gx, gz) { const G = grids[n.f]; if (!G || !G.ready) return false;
      // 비켜선 뒤 다시 걸을 때: 서 있는 플레이어 둘레(0.9m)를 잠깐 막힘으로 두고 길을 찾아 옆으로 돌아간다
      let nb = 0; const pl = env.player;
      if (n.avoidP && pl.on && pl.f === n.f) { const r = Math.ceil(.9 / G.cell), cx = Math.floor((pl.x - G.x0) / G.cell), cz = Math.floor((pl.z - G.z0) / G.cell);
        for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const i = cx + a, k = cz + b; if (i < 0 || k < 0 || i >= G.nx || k >= G.nz || a * a + b * b > r * r) continue; const c = k * G.nx + i; if (G.w[c] && nb < AVOID.length) { AVOID[nb++] = c; G.w[c] = 0; } } }
      n.pn = astar(G, n.x, n.z, gx, gz, n.path); for (let i = 0; i < nb; i++) G.w[AVOID[i]] = 1;
      if (!n.pn && nb) n.pn = astar(G, n.x, n.z, gx, gz, n.path); n.pi = 0; if (n.pn && !walkableAt(G, n.x, n.z)) { const c = nearestFree(G, n.x, n.z, 2); if (c >= 0) { n.x = G.x0 + (c % G.nx + .5) * G.cell; n.z = G.z0 + (((c / G.nx) | 0) + .5) * G.cell; } } return n.pn > 0; },
    door(n, x, z, nx, nz) {   // 닫힌 문이 다음 경로 구간 위에 있으면 열고(열리는 동안 기다림), 지나간 뒤 플레이어가 가까이 없으면 다시 닫는다
      const y = n.f * FH, d = R.nearDoor(x, z, y); if (!d) return false;
      const dd = Math.hypot(d.mx - x, d.mz - z); if (dd > 1.15) return false;
      const sx = nx - x, sz = nz - z, sl = Math.hypot(sx, sz) || 1, t = ((d.mx - x) * sx + (d.mz - z) * sz) / sl;
      if (t < -.2 || Math.abs((d.mx - x) * sz - (d.mz - z) * sx) / sl > .9) return false;
      if (d.target < .5) { R.toggleDoor(d); stats.doorsOpened++; (n.opened ||= []).push(d); try { at(d.mx, y + 1.1, d.mz)[d.kind === 'slide' ? 'doorSlide' : 'doorHinge'](.5); } catch (e) { /* 소리 없음 */ } }
      return d.col && !d.col.off;
    },
    event(n, type, tk) { onEvent(n, type, tk); },
  };
  // ── 모양: 저폴리 절차 인체 (공유 지오메트리 · 재질) ──
  const BOX = new THREE.BoxGeometry(1, 1, 1), HEAD = new THREE.SphereGeometry(.115, 10, 8), CONE = new THREE.ConeGeometry(.9, 4.5, 14, 1, true);
  CONE.translate(0, -2.25, 0); CONE.rotateX(-Math.PI / 2);
  const M = c => new THREE.MeshStandardMaterial({ color: c, roughness: .85 });
  const MAT = { skin: M(0xd9a67e), hair: M(0x1b1714), shoe: M(0x161616), guard: M(0x2d3646), guardCap: M(0x232a36), teacher: M(0x6a5a4c), skirt: M(0x3a3430), cleaner: M(0x7d8a6a), apron: M(0x5a7db0), scarf: M(0xb05c5c),
    uniform: M(0x1f2a44), shirt: M(0xe8e6de), pants: M(0x2b2b30), metal: M(0x9aa0a6), cart: M(0x2f6fb0), paper: M(0xf2efe4), phone: M(0x6b5d4a),
    beam: new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: .06, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }) };
  const part = (parent, mat, sx, sy, sz, x, y, z, geo = BOX) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = false; m.userData.dynamic = true; parent.add(m); return m; };   // dynamic · rbKeep(뿌리): 정적 병합(bake.js) · 예전 건물 정리(rebuildGame hideIn)가 감추지 않게
  const LOOK = {
    guard: { top: MAT.guard, leg: MAT.guard, hat: MAT.guardCap },
    teacher: { top: MAT.teacher, leg: MAT.skirt, hat: MAT.hair },
    cleaner: { top: MAT.cleaner, leg: MAT.pants, hat: MAT.scarf, apron: MAT.apron },
    studentA: { top: MAT.uniform, leg: MAT.uniform, hat: MAT.hair, collar: MAT.shirt },
    studentB: { top: MAT.shirt, leg: MAT.uniform, hat: MAT.hair },
  };
  function makeBody(role) {
    const lk = LOOK[role], g = new THREE.Group(); g.name = 'NPC_' + role; g.userData.dynamic = true; g.userData.rbKeep = true;
    const body = new THREE.Group(); g.add(body);
    part(body, lk.top, .42, .58, .24, 0, 1.18, 0); part(body, lk.leg, .36, .2, .22, 0, .9, 0);
    if (lk.apron) part(body, lk.apron, .38, .62, .02, 0, 1.05, .125);
    if (lk.collar) part(body, lk.collar, .16, .1, .02, 0, 1.4, .121);
    const head = new THREE.Group(); head.position.set(0, 1.56, 0); body.add(head);
    part(head, MAT.skin, 1, 1, 1, 0, .04, 0, HEAD); part(head, lk.hat, .25, .09, .25, 0, .13, -.01);
    if (role === 'guard') part(head, MAT.guardCap, .2, .02, .12, 0, .1, .13);
    const limb = (x, y, mat, w, h, dz = 0) => { const p = new THREE.Group(); p.position.set(x, y, dz); body.add(p); part(p, mat, w, h, w, 0, -h / 2, 0); return p; };
    const legL = limb(-.1, .86, lk.leg, .15, .82), legR = limb(.1, .86, lk.leg, .15, .82);
    part(legL, MAT.shoe, .16, .07, .26, 0, -.83, .04); part(legR, MAT.shoe, .16, .07, .26, 0, -.83, .04);
    const armL = limb(-.27, 1.43, lk.top, .11, .6), armR = limb(.27, 1.43, lk.top, .11, .6);
    part(armL, MAT.skin, .09, .09, .09, 0, -.63, 0); part(armR, MAT.skin, .09, .09, .09, 0, -.63, 0);
    let beam = null;
    if (role === 'guard') { part(armR, MAT.metal, .05, .05, .2, 0, -.62, .08); beam = new THREE.Mesh(CONE, MAT.beam); beam.position.set(0, -.62, .18); beam.renderOrder = 5; beam.frustumCulled = false; armR.add(beam); }
    return { g, body, head, legL, legR, armL, armR, beam, ph: 0 };
  }
  function makeCart() {
    const g = new THREE.Group(); g.name = 'NPC_cart'; g.userData.dynamic = true; g.userData.rbKeep = true;
    part(g, MAT.cart, .5, .42, .78, 0, .42, 0); part(g, MAT.metal, .52, .03, .8, 0, .64, 0); part(g, MAT.apron, .3, .26, .3, 0, .78, .18);
    part(g, MAT.metal, .03, 1.1, .03, .12, 1.1, .18); part(g, MAT.metal, .46, .03, .03, 0, .9, -.4);
    for (const [x, z] of [[-.22, -.32], [.22, -.32], [-.22, .32], [.22, .32]]) part(g, MAT.shoe, .05, .1, .1, x, .05, z);
    scene.add(g); return g;
  }
  // 교무실 전화 · 자습실 종이 (이야기 물건이 아닌 이 모듈의 소품 — 충돌체 없음)
  const surfTop = (x, z, h) => { let top = null; for (const c of MAIN.col) { if (c.off || c.door || x < c.x1 || x > c.x2 || z < c.z1 || z > c.z2) continue; if (c.y2 > h + .55 && c.y2 < h + 1.15 && (top == null || c.y2 > top)) top = c.y2; } return top; };
  const PHONE = { g: null, x: -11, z: 5.2, y: .78, ring: 0, rings: 0, next: 75, answered: false };
  function makePhone() {
    const g = new THREE.Group(); g.name = 'NPC_phone'; g.userData.dynamic = true; g.userData.rbKeep = true; part(g, MAT.phone, .22, .07, .18, 0, .035, 0); const hs = new THREE.Group(); g.add(hs); part(hs, MAT.shoe, .2, .045, .06, 0, .09, -.04); PHONE.hs = hs;
    const t = surfTop(PHONE.x, PHONE.z, 0); PHONE.y = t ?? .76; g.position.set(PHONE.x, PHONE.y, PHONE.z); scene.add(g); return g;
  }
  const PAPER = { g: null, holder: null, x: 10.2, z: 5.1, y: 0, onDesk: true };
  function makePaper() { const g = new THREE.Group(); g.name = 'NPC_papers'; g.userData.dynamic = true; g.userData.rbKeep = true; part(g, MAT.paper, .21, .006, .297, 0, .003, 0); const p2 = part(g, MAT.paper, .21, .006, .297, .02, .009, .01); p2.rotation.y = .12; scene.add(g); return g; }
  function placePaper(x, z) { const h = 2 * FH, t = surfTop(x, z, h); PAPER.x = x; PAPER.z = z; PAPER.y = t ?? (h + .74); PAPER.onDesk = true; if (PAPER.g) { if (PAPER.g.parent !== scene) scene.add(PAPER.g); PAPER.g.position.set(x, PAPER.y, z); PAPER.g.rotation.set(0, .3, 0); } }

  // ── NPC 목록 (igpu: 2명) ──
  const defs = npcSchedules(), npcs = [], byId = {};
  let curIgpu = !!igpu();   // 내장 그래픽: 앞의 2명(경비 · 당직 선생님)만 움직이고 나머지는 숨긴다 (품질을 바꾸면 바로 따른다)
  for (const d of defs) {
    const n = createNPC(d), vis = makeBody(d.id); n.vis = vis; scene.add(vis.g); vis.g.visible = false;
    if (d.cart) n.cart = makeCart();
    n.acc = 0; n.seen = false; n.lines = 0; n.opened = []; npcs.push(n); byId[d.id] = n;
  }
  if (byId.teacher) PHONE.g = makePhone();
  if (byId.studentA) { PAPER.g = makePaper(); placePaper(10.2, 5.1); }
  const stats = { stuck: 0, arrivals: 0, doorsOpened: 0, doorsClosed: 0, lights: 0, phone: 0, yields: 0, talks: 0, built: false };

  // ── 사건: 도착 · 끝 · 사물 ──
  function findSwitch(f, x, z) { for (const sw of R.switches || []) { const r = sw.rect; if (!r || sw.floor !== f || (sw.bld && sw.bld !== 'main' && sw.bld !== MAIN && sw.bld !== MAIN.name)) continue; if (x > r.x1 && x < r.x2 && z > r.z1 && z < r.z2) return sw; } return null; }
  function onEvent(n, type, tk) {
    if (type === 'stuck') stats.stuck++;
    if (type === 'yield') stats.yields++;
    if (type === 'arrive') {
      stats.arrivals++;
      if (tk && tk.light && !n.sw && !(R._pk === 0)) {   // 정전 중엔 손대지 않는다
        const sw = findSwitch(tk.f, tk.x, tk.z);
        if (sw && sw.lamps) { const on = R.toggleSwitch(sw); if (on === false) R.toggleSwitch(sw); else { n.sw = sw; stats.lights++; try { at(tk.x, tk.f * FH + 1.3, tk.z).click(); } catch (e) { /* */ } } }
      }
      if (tk && tk.act === 'phone') { PHONE.answered = true; PHONE.ring = 0; stats.phone++; if (near(n, 14)) subtitle(NAMES.teacher, NPC_LINES.teacher.phone, 5.5); try { at(PHONE.x, PHONE.y, PHONE.z).pickupClick(); } catch (e) { /* */ } }
      if (tk && tk.paper === 'drop' && PAPER.holder === n) { placePaper(tk.x, tk.z + .5); PAPER.holder = null; try { at(tk.x, 2 * FH + .8, tk.z).paper(); } catch (e) { /* */ } }
      if (tk && tk.paper === 'pick' && !PAPER.holder && PAPER.onDesk) { PAPER.holder = n; PAPER.onDesk = false; n.vis.armR.add(PAPER.g); PAPER.g.position.set(0, -.6, .1); PAPER.g.rotation.set(1.2, 0, 0); try { at(n.x, 2 * FH + .8, n.z).paper(); } catch (e) { /* */ } }
      if (tk && tk.act === 'paper' && near(n, 10)) { try { at(n.x, n.f * FH + .3, n.z).paper(); } catch (e) { /* */ } }
    }
    if (type === 'done') {
      if (n.sw) { if (!(R._pk === 0)) R.toggleSwitch(n.sw); n.sw = null; }
      if (tk && tk.act === 'phone' && PHONE.hs) PHONE.hs.position.y = 0;
    }
  }
  const near = (n, r) => env.player.on && env.player.f === n.f && Math.hypot(env.player.x - n.x, env.player.z - n.z) < r;
  // 지나온 문 닫기: 원래 닫혀 있던 문만 · NPC 가 1.6m 지나갔고 플레이어가 2.5m 안에 없을 때
  function closeDoors(n) {
    if (!n.opened.length) return;
    for (let i = n.opened.length - 1; i >= 0; i--) { const d = n.opened[i], y = n.f * FH;
      if (Math.abs(d.py - y) > 1.2) { n.opened.splice(i, 1); continue; }
      if (Math.hypot(d.mx - n.x, d.mz - n.z) > 1.6 && !(env.player.on && Math.abs(env.player.y - y) < 1.5 && Math.hypot(d.mx - env.player.x, d.mz - env.player.z) < 2.5)) {
        if (d.target > .5) { R.toggleDoor(d); stats.doorsClosed++; try { at(d.mx, y + 1.1, d.mz)[d.kind === 'slide' ? 'doorSlide' : 'doorHinge'](.4); } catch (e) { /* */ } } n.opened.splice(i, 1); } }
  }
  function finishBuild() {
    for (const f of NEED) { const G = grids[f], c = nearestFree(G, 4.5, 1.3, 2.5); STAIR[f] = c >= 0 ? { x: G.x0 + (c % G.nx + .5) * G.cell, z: G.z0 + (((c / G.nx) | 0) + .5) * G.cell } : { x: 4.5, z: -1.6 }; }
    for (const n of npcs) { const G = grids[n.f], c = nearestFree(G, n.x, n.z, 3); if (c >= 0 && !walkableAt(G, n.x, n.z)) { n.x = G.x0 + (c % G.nx + .5) * G.cell; n.z = G.z0 + (((c / G.nx) | 0) + .5) * G.cell; } }
  }
  // ── 매 프레임 ──
  let enabled = true, buildDone = false, phoneT = PHONE.next;
  const _look = new THREE.Vector3();
  function playerFloor() {
    if (P.floor !== 0) return -9; const y = P.sh || 0, x = P.x, z = P.z;
    if (x < -L / 2 - 1 || x > L / 2 + 1 || z < MAIN.layout.zN - 1 || z > MAIN.layout.zS + 1) return y < 1 ? -1 : -9;   // 바깥 (1층 높이면 창 너머로 1층만 보인다)
    return Math.round(y / FH);
  }
  function animate(n, dt, show) {
    const V = n.vis; V.g.visible = show; if (n.cart) n.cart.visible = show; if (!show) return;
    const y0 = n.f * FH; V.g.position.set(n.x, y0, n.z); V.g.rotation.y = n.yaw;
    const mv = Math.min(1, n.v / 1.2); V.ph += dt * (2.2 + n.v * 4.2);
    const s = Math.sin(V.ph) * .55 * mv, sit = n.sitting && n.state === 'act' ? 1 : 0;
    V.legL.rotation.x = sit ? -1.45 : s; V.legR.rotation.x = sit ? -1.45 : -s;
    V.body.position.y = sit ? -.42 : Math.abs(Math.cos(V.ph)) * .035 * mv; V.body.position.z = sit ? -.05 : 0;
    const carry = PAPER.holder === n;
    V.armL.rotation.x = n.cart && n.state === 'walk' ? -.9 : -s * .8 + (sit ? -.7 : 0);
    V.armR.rotation.x = V.beam ? -1.05 + Math.sin(V.ph * .5) * .05 : carry ? -.9 : n.state === 'act' && n.task && n.task.act === 'mop' ? -.6 + Math.sin(V.ph * 1.6) * .35 : s * .8 + (sit ? -.7 : 0);
    if (n.task && n.task.act === 'phone' && n.state === 'act') { V.armL.rotation.x = -2.4; V.armL.rotation.z = -.3; if (PHONE.hs) PHONE.hs.position.y = 9; } else V.armL.rotation.z = 0;
    // 고개: 가까운 플레이어 쪽으로 (몸이 덜 돌아간 만큼만)
    let hy = 0; if (n.look || n.state === 'talk') { const a = Math.atan2(env.player.x - n.x, env.player.z - n.z); hy = Math.max(-1, Math.min(1, angTo(n.yaw, a))); }
    V.head.rotation.y += (hy - V.head.rotation.y) * Math.min(1, dt * 5);
    if (V.beam) V.beam.visible = !curIgpu;
    if (n.cart) { const ex = n.x + Math.sin(n.yaw) * .85, ez = n.z + Math.cos(n.yaw) * .85, ok = env.walkable(n.f, ex, ez); const k = ok ? .85 : .55; n.cart.position.set(n.x + Math.sin(n.yaw) * k, y0, n.z + Math.cos(n.yaw) * k); n.cart.rotation.y = n.yaw; }
  }
  function tick(dt) {
    if (!enabled) return;
    if (!buildDone) { buildDone = buildStep(2500); stats.built = buildDone; if (!buildDone) return; finishBuild(); }
    const pf = playerFloor(), pl = env.player; pl.x = P.x; pl.z = P.z; pl.f = pf; pl.y = P.sh || 0; pl.on = isPlaying() && pf >= 0;
    const ig = curIgpu = !!igpu(), cap = ig ? 2 : npcs.length;
    // 전화: 당직 선생님이 같은 층(1층)에 있을 때 가끔 울리고, 선생님이 받으러 간다
    if (byId.teacher && (phoneT -= dt) <= 0) {
      const T = byId.teacher; phoneT = 110 + env.rand() * 60;
      if (T.f === 0 && T.state !== 'talk' && !T.interrupt) { PHONE.ring = 7; PHONE.answered = false; T.interrupt = { f: 0, x: PHONE.x - .1, z: PHONE.z - .75, act: 'phone', dur: 6, face: [PHONE.x, PHONE.z] }; if (T.state === 'act' || T.state === 'idle') T.t = Math.min(T.t, .3); }
    }
    if (PHONE.g && PHONE.ring > 0) { PHONE.ring -= dt; const ph = PHONE.ring % 2.2; PHONE.g.rotation.z = ph > 1.2 ? Math.sin(PHONE.ring * 60) * .04 : 0; if (ph > 2.15 - dt && (pf === 0 || pf === -1) && Math.hypot(P.x - PHONE.x, P.z - PHONE.z) < 30) { try { at(PHONE.x, PHONE.y, PHONE.z).phone(); } catch (e) { /* */ } } if (PHONE.ring <= 0) PHONE.g.rotation.z = 0; }
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i]; if (i >= cap) { if (n.vis.g.visible) animate(n, dt, false); continue; }
      const same = pf === n.f || (pf === -1 && n.f === 0), d = same ? Math.hypot(P.x - n.x, P.z - n.z) : 99;
      if (ig && !same) { animate(n, dt, false); continue; }   // 내장 그래픽: 다른 층 NPC 는 멈춘다
      const rate = d < 22 ? 0 : d < 45 ? .12 : .35; n.acc += dt;
      if (n.acc >= rate) { const st = Math.min(n.acc, .5); n.acc = 0; stepNPC(n, st, env); closeDoors(n); }
      if (!n.seen && same && d < 4.5 && pl.on && n.state !== 'stair') { n.seen = true; if (n.state !== 'talk') talkTo(n, 2.2); subtitle(NAMES[n.id], NPC_LINES[n.id].bark, 3.2); }
      animate(n, dt, same && d < 48 && n.state !== 'stair');
    }
    if (PAPER.g && PAPER.holder && PAPER.g.parent !== PAPER.holder.vis.armR) PAPER.holder.vis.armR.add(PAPER.g);
  }
  // ── 플레이어 상호작용: 바라보는 가까운 NPC ──
  function pick(px, pz, fx, fz) {
    const pf = playerFloor(); let best = null, bs = .3;
    for (const n of npcs) { if (n.f !== pf || n.state === 'stair' || !n.vis.g.visible) continue; const dx = n.x - px, dz = n.z - pz, d = Math.hypot(dx, dz); if (d > 2.1) continue; const f = (dx * fx + dz * fz) / Math.max(d, .01), s = f - d * .1; if (f > .6 && s > bs) { bs = s; best = n; } }
    return best ? { n: best, label: `${NPC_TALK_LABEL} · ${NAMES[best.id]}` } : null;
  }
  function talk(n) {
    stats.talks++; talkTo(n, 5); n.seen = true;
    const L2 = NPC_LINES[n.id], k = n.lines++; let text;
    if (k % 2 === 1) { const o = objective && objective(), w = o && o.loc && o.loc.where; text = w ? L2.hint.replace('{}', w) : o && o.main ? NPC_HINT_MAIN.replace('{}', o.main) : L2.greet[0]; }
    else text = L2.greet[(k >> 1) % L2.greet.length];
    subtitle(NAMES[n.id], text, 5);
    return text;
  }
  function reset() {
    for (const n of npcs) { if (n.sw) { n.sw = null; } n.opened.length = 0; resetNPC(n); n.seen = false; n.lines = 0; n.acc = 0; }
    PHONE.ring = 0; phoneT = PHONE.next; if (PHONE.hs) PHONE.hs.position.y = 0;
    if (PAPER.g) { PAPER.holder = null; placePaper(10.2, 5.1); }
  }
  function setEnabled(v) { enabled = !!v; if (!enabled) for (const n of npcs) animate(n, 0, false); }
  const api = { npcs, byId, grids, stats, tick, pick, talk, reset, setEnabled, env, PHONE, PAPER, buildAll() { while (!buildStep(1e9)); if (!buildDone) { buildDone = true; finishBuild(); } stats.built = true; }, playerFloor };
  if (debug) window.__npc = api;
  return api;
}
