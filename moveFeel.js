// 이동감 (1인칭): 가속 · 감속, 걸음에 맞춘 시점 흔들림(상하 · 좌우 · 기울기), 발소리 동기, 옆걸음 · 회전 기울임, 계단 · 착지 눌림,
//   숨 고르기 흔들림, 달릴 때 시야각, 손전등 지연 — 모두 설정의 '걸을 때 흔들림 강도'(0 ~ 150%)를 따르고, 깜빡임 줄이기 · 시스템의 '동작 줄이기'에서는 약해진다.
//   충돌 · 조사 거리 같은 판정은 건드리지 않는다. 여기는 속도 곡선과 카메라 연출 값만 계산한다 (DOM · three.js 를 쓰지 않아 node 테스트에서 그대로 돈다).
export const STEP_LEN = { walk: 1.45, run: 1.9, crouch: 1.0 };   // 발소리 한 번 사이 이동 거리(m) — 걷기 · 달리기는 예전 발소리 간격 그대로
export const SPEED = { walk: 2.8, run: 5.0, crouch: 1.45 };
export const BACK_K = .8, STRAFE_K = .93;   // 뒷걸음 · 옆걸음은 조금 느리다
const ACC_WALK = 11, ACC_RUN = 6.5, DEC = 13, TAU = Math.PI * 2;
const ex = (k, dt) => 1 - Math.exp(-k * dt);   // 프레임 길이에 무관한 지수 접근
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

export function createMoveFeel() {
  return { vx: 0, vz: 0, speed: 0, stride: .5, amp: 0, run: 0, lean: 0, dip: 0, dipV: 0, breathT: 0, exert: 0, fov: 0,
    fYaw: null, fPitch: null, lagYaw: 0, lagPitch: 0, pYaw: null, yawRate: 0, lastSh: null, out: { y: 0, x: 0, roll: 0, pitch: 0, fov: 0 } };
}
// 입력(앞뒤 fw · 좌우 sd, −1 ~ 1)과 상태에서 목표 속도(m/s)
export function targetSpeed(fw, sd, sprinting, crouch) {
  let sp = sprinting ? SPEED.run : crouch ? SPEED.crouch : SPEED.walk;
  if (fw < 0) sp *= BACK_K; else if (!fw && sd) sp *= STRAFE_K;
  return sp;
}
// 속도 갱신: 눌렀다고 바로 최고 속도가 되지 않고(걷기 ≈ 0.2초 · 달리기 ≈ 0.35초), 떼면 짧게 미끄러지며 멈춘다(걷기 ≈ 0.2m)
export function stepVelocity(M, dirX, dirZ, sp, want, dt) {
  const tx = want ? dirX * sp : 0, tz = want ? dirZ * sp : 0;
  const cur = Math.hypot(M.vx, M.vz), k = !want ? DEC : sp > cur + .3 && sp > 3.5 ? ACC_RUN : ACC_WALK, a = ex(k, dt);
  M.vx += (tx - M.vx) * a; M.vz += (tz - M.vz) * a;
  if (!want && Math.hypot(M.vx, M.vz) < .08) M.vx = M.vz = 0;
  return Math.hypot(M.vx, M.vz);
}
export function stopVelocity(M) { M.vx = M.vz = 0; M.speed = 0; }
// 실제로 움직인 거리 mv 로 걸음 위상을 진행. 발이 닿는 순간(정수 경계)마다 true → 발소리
export function advanceStride(M, mv, sprinting, crouch) {
  const L = sprinting ? STEP_LEN.run : crouch ? STEP_LEN.crouch : STEP_LEN.walk, s0 = M.stride;
  M.stride += mv / L; if (M.stride > 1e6) M.stride -= 1e6;
  return Math.floor(M.stride) !== Math.floor(s0);
}
// 멈추면 다음 걸음이 반 걸음 뒤에 오도록 위상을 맞춘다 (흔들림 세기는 이미 0 이라 튀지 않는다)
export function restStride(M) { M.stride = Math.floor(M.stride) + .5; }
// 설정 → 연출 세기 (0 이면 모든 흔들림이 꺼진다)
export function motionScale(set, reduced) {
  if (!set || set.bob === false) return 0;
  const k = clamp(Number.isFinite(+set.bobK) ? +set.bobK : 1, 0, 1.5);
  return k * (reduced || set.flashReduce ? .4 : 1);
}
// 계단 · 턱 · 점프 착지: 아래로 눌렸다가 돌아오는 스프링에 충격을 준다 (v: 아래 방향 속도 m/s 상당)
export function landImpulse(M, v) { M.dipV -= clamp(v, 0, 6) * .14; }
// 매 프레임: 카메라에 더할 값 M.out { y: 상하(m), x: 좌우(m), roll: 기울기(rad), pitch(rad), fov(도) } 과 손전등 지연 M.lagYaw · M.lagPitch
//   o: { dt, t, speed(실제 속도), sprinting, crouchK, strafe(오른쪽 +, m/s), yaw, pitch, sh(발밑 높이), stamina(0~100), grounded, scale, reduced, still(앉음 · 숨음 등 연출 끔) }
export function feelTick(M, o) {
  const dt = Math.min(.1, Math.max(0, o.dt)), sc = o.still ? 0 : o.scale, out = M.out;
  // 걸음 세기: 속도에 비례해 부드럽게 들어오고 나간다
  const ref = o.sprinting ? SPEED.run : SPEED.walk, want = clamp(o.speed / ref, 0, 1) * (o.grounded === false ? .25 : 1);
  M.amp += (want - M.amp) * ex(want > M.amp ? 7 : 9, dt);
  M.run += ((o.sprinting ? clamp((o.speed - SPEED.walk) / (SPEED.run - SPEED.walk), 0, 1) : 0) - M.run) * ex(5, dt);
  const cr = 1 - (o.crouchK || 0) * .5, ph = M.stride * TAU;
  const aY = (.021 + .017 * M.run) * cr, aX = (.011 + .008 * M.run) * cr, aR = .0032 + .0045 * M.run;
  let y = -Math.cos(ph) * aY * M.amp;                    // 발이 닿을 때 가장 낮다
  let x = Math.sin(ph * .5) * aX * M.amp;                // 좌우는 두 걸음에 한 번 (왼발 · 오른발)
  let roll = -Math.sin(ph * .5) * aR * M.amp;
  let pitch = Math.sin(ph) * .0016 * (1 + M.run) * M.amp;
  // 옆걸음 · 회전 기울임
  if (M.pYaw == null) M.pYaw = o.yaw;
  const rate = dt > 0 ? clamp(wrap(o.yaw - M.pYaw) / dt, -6, 6) : 0; M.pYaw = o.yaw; M.yawRate += (rate - M.yawRate) * ex(10, dt);
  const leanT = o.reduced ? 0 : clamp(-(o.strafe || 0) / SPEED.run * .02 + M.yawRate * .0035 * clamp(o.speed / SPEED.walk, 0, 1), -.022, .022);
  M.lean += (leanT - M.lean) * ex(7, dt); roll += M.lean;
  // 계단 · 턱: 발밑 높이가 갑자기 낮아지면(내려 디딤) 눌림 — 올라갈 때는 약하게
  if (M.lastSh != null && o.sh != null && dt > 0) { const d = o.sh - M.lastSh; if (Math.abs(d) > .04 && Math.abs(d) < .6) landImpulse(M, d < 0 ? -d * 8 : d * 3); }
  M.lastSh = o.sh;
  { const n = Math.max(1, Math.ceil(dt / .012)), h = dt / n; for (let i = 0; i < n; i++) { M.dipV += (-170 * M.dip - 20 * M.dipV) * h; M.dip += M.dipV * h; } M.dip = clamp(M.dip, -.09, .03); }
  y += M.dip;
  // 숨: 서 있을 때 느리게, 지치거나 달린 뒤에는 빠르고 크게
  const ext = clamp(1 - (o.stamina ?? 100) / 100, 0, 1); M.exert += (Math.max(ext, o.sprinting ? .55 : 0) - M.exert) * ex(o.sprinting ? 1.2 : .5, dt);
  M.breathT += dt * (1.45 + 3.1 * M.exert); if (M.breathT > 1e4) M.breathT -= 1e4;
  const bw = (1 - .65 * M.amp) * (1 + 2.4 * M.exert), bs = Math.sin(M.breathT);
  y += bs * .0032 * bw; pitch += Math.sin(M.breathT + .9) * .0016 * bw; x += Math.sin(M.breathT * .5 + .4) * .0018 * (1 - M.amp);
  // 달릴 때 시야각 (+3.5°) — 실제 속도를 따라 천천히
  M.fov += ((o.reduced ? 0 : 3.5 * M.run) - M.fov) * ex(4, dt);
  out.y = y * sc; out.x = x * sc; out.roll = roll * sc; out.pitch = pitch * sc; out.fov = M.fov * Math.min(1, sc);
  // 손전등: 시선보다 조금 늦게 따라온다
  if (M.fYaw == null) { M.fYaw = o.yaw; M.fPitch = o.pitch; }
  const a = ex(15, dt), lim = .1 * Math.min(1, sc);
  M.fYaw += wrap(o.yaw - M.fYaw) * a; M.fPitch += (o.pitch - M.fPitch) * a;
  let ly = wrap(M.fYaw - o.yaw), lp = M.fPitch - o.pitch;
  if (Math.abs(ly) > lim) { ly = clamp(ly, -lim, lim); M.fYaw = o.yaw + ly; } if (Math.abs(lp) > lim) { lp = clamp(lp, -lim, lim); M.fPitch = o.pitch + lp; }
  M.lagYaw = ly; M.lagPitch = lp;
  return out;
}
