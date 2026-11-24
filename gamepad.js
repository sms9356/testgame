// 게임패드(표준 매핑) → 게임 조작. 키보드와 같은 처리 경로를 쓰도록 설정된 키 코드로 keydown/keyup 을 흉내 낸다.
//   왼쪽 스틱 = 이동(WASD) · 오른쪽 스틱 = 시점 · A 상호작용 · B 앉기 · X 손전등 · Y 소지품 · LB 내려가기(Q) · RB 던지기
//   LT 주변 살피기 · RT 달리기 · L3 점프 · R3 시점 전환 · Back 지도 · Start 일시정지 · 십자키 ↑휴대폰 ↓목표 ←건전지 →구급상자
// 메뉴(일시정지 · 설정 · 소지품 · 휴대폰 · 쪽지 · 지도)의 커서 이동은 uiPolish.js 가 맡는다. 타이틀은 game.js 의 titleFx.

// 버튼 번호 → 동작 이름 (동작 이름은 SET.keys 의 키, 또는 '#Code' 로 고정 키 코드)
export const PAD_BUTTONS = {
  0: 'interact', 1: 'crouch', 2: 'flash', 3: 'inv', 4: 'down', 5: 'throwCan', 6: 'scan', 7: 'run',
  8: 'map', 9: '#Escape', 10: 'jump', 11: 'view', 12: 'phone', 13: 'quest', 14: '#Digit2', 15: '#Digit3',   // 16(Home/가이드)은 OS 가 가로채 브라우저에 거의 오지 않는다 — 무전 호출은 일시정지 메뉴의 '무전 호출'로
};
// 프롬프트 글자: 키보드 글자 → 패드 버튼 표시
export const PAD_GLYPH = { E: 'A', Q: 'LB', G: 'RB', F: 'X', C: 'B', Esc: 'Start' };
export const STICK_DEAD = 0.38, LOOK_DEAD = 0.14, TRIGGER_ON = 0.4;

const pressed = b => !!b && (typeof b === 'object' ? (b.pressed || (b.value || 0) > TRIGGER_ON) : !!b);
const codeOf = (act, keys) => act[0] === '#' ? act.slice(1) : (keys && keys[act]) || null;

// 한 번의 패드 상태 → 눌러져 있어야 할 키 코드 집합 + 시점 입력. 순수 함수 (테스트 대상)
export function padState(pad, keys) {
  const held = new Set(), ax = pad.axes || [], btn = pad.buttons || [];
  const lx = ax[0] || 0, ly = ax[1] || 0;
  if (ly < -STICK_DEAD) held.add('KeyW'); if (ly > STICK_DEAD) held.add('KeyS');
  if (lx < -STICK_DEAD) held.add('KeyA'); if (lx > STICK_DEAD) held.add('KeyD');
  for (const i in PAD_BUTTONS) if (pressed(btn[i])) { const c = codeOf(PAD_BUTTONS[i], keys); if (c) held.add(c); }
  const dz = v => { const a = Math.abs(v); if (a < LOOK_DEAD) return 0; const k = (a - LOOK_DEAD) / (1 - LOOK_DEAD); return Math.sign(v) * k * k; };   // 제곱 곡선: 작은 기울기는 정밀하게
  const look = { x: dz(ax[2] || 0), y: dz(ax[3] || 0) };
  const any = held.size > 0 || look.x !== 0 || look.y !== 0 || Math.abs(lx) > STICK_DEAD || Math.abs(ly) > STICK_DEAD;
  return { held, look, any };
}
// 이전/현재 집합 차이 → 누름 · 뗌
export function diffHeld(prev, cur) {
  const down = [...cur].filter(c => !prev.has(c)), up = [...prev].filter(c => !cur.has(c));
  return { down, up };
}
// 프롬프트 HTML 의 <kbd>E</kbd> 등을 패드 버튼 글자로
export function padGlyphHtml(html) {
  return String(html).replace(/<kbd>([^<]{1,5})<\/kbd>/g, (m, k) => PAD_GLYPH[k] ? `<kbd class="gpGlyph">${PAD_GLYPH[k]}</kbd>` : m);
}

const MOVE = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
let device = 'kb', installed = false;
export const padActive = () => device === 'pad';
export const promptGlyphs = html => device === 'pad' ? padGlyphHtml(html) : html;

// ctx: { getState(): string, keys(): SET.keys, look(dx, dy, dt), skipLine?(): boolean — 이미 본 대사를 넘겼으면 true }
export function installGamepad(ctx) {
  if (installed || typeof window === 'undefined') return; installed = true;
  let prev = new Set(), last = 0, raf = 0;
  const send = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
  const release = () => { prev.forEach(c => send('keyup', c)); prev = new Set(); };
  const setDev = d => { if (d === device) return; device = d; document.body && document.body.classList.toggle('gpMode', d === 'pad'); };
  addEventListener('keydown', e => { if (e.isTrusted) setDev('kb'); }, true);
  addEventListener('mousedown', e => { if (e.isTrusted) setDev('kb'); }, true);
  addEventListener('mousemove', e => { if (e.isTrusted && (Math.abs(e.movementX) + Math.abs(e.movementY) > 6)) setDev('kb'); }, true);
  const tick = now => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.connected) : null;
    if (!gp) { if (prev.size) release(); return; }
    const st = ctx.getState();
    const s = padState(gp, ctx.keys());
    if (s.any) setDev('pad');
    if (st !== 'playing') {
      // 메뉴 · 소지품 등은 uiPolish 가 처리. 여기서는 눌린 키만 정리하고, 일시정지 중 Start 는 재개
      tick.was = st;
      if (prev.size) release();
      if (st === 'paused' && pressed(gp.buttons[9]) && !tick.start) send('keydown', 'Escape');
      tick.start = pressed(gp.buttons[9]);
      return;
    }
    tick.start = pressed(gp.buttons[9]);
    // 메뉴에서 막 돌아왔을 때 아직 누르고 있는 버튼(예: 쪽지를 닫은 A)은 다시 떼기 전까지 무시 — 이동 키만 바로 이어진다
    if (tick.was !== 'playing') prev = new Set([...s.held].filter(c => !MOVE.has(c)));
    tick.was = st;
    const { down, up } = diffHeld(prev, s.held);
    // A(상호작용)를 새로 눌렀고 지금 나오는 대사가 이미 본 줄이면(설정 '이미 본 대사 넘기기') 그 줄만 넘기고 상호작용은 보내지 않는다 — 키보드 E · Enter 와 같은 동작
    const ia = codeOf('interact', ctx.keys()), ii = ia ? down.indexOf(ia) : -1;
    if (ii >= 0 && pressed(gp.buttons[0]) && ctx.skipLine && ctx.skipLine()) down.splice(ii, 1);
    up.forEach(c => send('keyup', c)); down.forEach(c => send('keydown', c));
    prev = s.held;
    if (s.look.x || s.look.y) ctx.look(s.look.x, s.look.y, dt);
  };
  addEventListener('gamepadconnected', () => { if (!raf) raf = requestAnimationFrame(tick); });
  if (navigator.getGamepads && [...navigator.getGamepads()].some(Boolean) && !raf) raf = requestAnimationFrame(tick);
}
