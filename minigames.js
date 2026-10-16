// 미니게임: 자물쇠 따기 · 다이얼 자물쇠 · 배선 퍼즐 · 피아노 · 슬라이딩 퍼즐 · 갈고리 낚기 · 녹음 순서 · 짝 맞추기 · 주파수 · 순서 따라 하기 · 타이밍 · 분신사바
//          + 증기 배관(압력) · 어둠 속 미로(그것 추격) · 맞물린 고리 암호 · 틀린 그림 찾기 · 퓨즈판
// run(kind, opts) → Promise<{ ok }>. 열려 있는 동안 MG.active 가 true 이고, 키 입력은 여기서 처리한다.
import { sfx } from './audio.js';

export const MG = { active: false, win: () => { if (finish) close(true); } };   // win: 디버그용 즉시 성공
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let finish = null, keyH = null, raf = 0, cleanups = [];

function open(title, hint) {
  MG.active = true;
  $('mgTitle').textContent = title; $('mgHint').innerHTML = hint || ''; $('mgStatus').textContent = ''; $('mgStatus').className = '';
  $('mgBody').innerHTML = ''; $('mg').classList.add('show');
  return new Promise(res => { finish = res; });
}
function close(ok) {
  cancelAnimationFrame(raf); raf = 0;
  if (keyH) { removeEventListener('keydown', keyH, true); removeEventListener('keyup', keyH, true); keyH = null; }
  cleanups.forEach(f => f()); cleanups = [];
  const f = finish; finish = null;
  const done = () => { $('mg').classList.remove('show'); MG.active = false; if (f) f({ ok }); };
  if (ok) { $('mgStatus').textContent = '성공!'; $('mgStatus').className = 'ok'; setTimeout(done, 650); } else done();
}
const status = (t, cls = '') => { $('mgStatus').textContent = t; $('mgStatus').className = cls; };
function keys(fn) {
  keyH = e => {
    if (e.type === 'keydown' && (e.code === 'Escape' || e.code === 'Tab')) { e.preventDefault(); e.stopImmediatePropagation(); close(false); return; }
    e.stopImmediatePropagation(); if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    fn(e);
  };
  addEventListener('keydown', keyH, true); addEventListener('keyup', keyH, true);
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.className = 'mgCanvas'; $('mgBody').appendChild(c); return c; }
$('mgCancel').onclick = () => { if (finish) close(false); };

/* ---------- 1. 자물쇠 따기 (머리핀) ---------- */
// 마우스/A·D 로 핀 각도, Space·마우스 버튼을 누르고 있으면 실린더를 돌린다. 맞는 각도일수록 더 많이 돈다.
function lockpick({ pins, usePin, tol = 9 }) {
  const p = open('자물쇠 따기', '마우스(또는 A · D)로 핀 각도 조절 · <b>Space / 마우스 버튼</b>을 누르고 있으면 돌린다<br>덜컥거리면 바로 놓을 것 — 오래 버티면 핀이 부러진다');
  const c = canvas(380, 380), g = c.getContext('2d');
  const info = document.createElement('div'); info.className = 'mgInfo'; $('mgBody').appendChild(info);
  const sweet = (Math.random() * 150 - 75) * Math.PI / 180, T = tol * Math.PI / 180;
  let pa = 0, rot = 0, strain = 0, turning = false, left = pins(), lastClick = 0, t = 0, lastT = performance.now();
  const upd = () => { info.innerHTML = `남은 머리핀 <b>${left}</b>개`; };
  upd();
  const setA = a => { const n = clamp(a, -Math.PI / 2, Math.PI / 2); if (Math.abs(n - lastClick) > .07) { sfx.pick(); lastClick = n; } pa = n; };
  c.addEventListener('mousemove', e => { const r = c.getBoundingClientRect(); setA(((e.clientX - r.left) / r.width - .5) * Math.PI * 1.15); });
  c.addEventListener('mousedown', () => { turning = true; }); const mu = () => { turning = false; }; addEventListener('mouseup', mu); cleanups.push(() => removeEventListener('mouseup', mu));
  keys(e => {
    const dn = e.type === 'keydown';
    if (e.code === 'Space' || e.code === 'KeyW') turning = dn;
    if (dn && (e.code === 'KeyA' || e.code === 'ArrowLeft')) setA(pa - .06);
    if (dn && (e.code === 'KeyD' || e.code === 'ArrowRight')) setA(pa + .06);
  });
  const loop = now => {
    const dt = Math.min(.12, (now - lastT) / 1000); lastT = now; t += dt;
    const off = Math.abs(pa - sweet), maxR = clamp(1 - (off - T) / (Math.PI * .22), 0, 1) * Math.PI / 2;
    if (turning) {
      rot = Math.min(maxR, rot + dt * 1.6);
      if (rot >= Math.PI / 2 - .02) { sfx.tumbler(); status('철컥 — 열렸다', 'ok'); draw(0); return close(true); }
      if (rot >= maxR - .01) { strain += dt * .8; if (Math.random() < .3) sfx.tension(strain); if (strain > 1) {
        sfx.pinBreak(); left--; usePin(); upd(); strain = 0; rot = 0; turning = false; status('핀이 부러졌다!', 'err');
        if (left <= 0) { status('머리핀이 다 떨어졌다', 'err'); draw(0); setTimeout(() => close(false), 900); return; }
      } }
    } else { rot = Math.max(0, rot - dt * 3); strain = Math.max(0, strain - dt * 2); }
    draw(strain > .05 && turning ? (Math.random() - .5) * strain * 6 : 0);
    raf = requestAnimationFrame(loop);
  };
  function draw(shk) {
    g.clearRect(0, 0, 380, 380); g.save(); g.translate(190 + shk, 200);
    const gr = g.createRadialGradient(0, 0, 20, 0, 0, 150); gr.addColorStop(0, '#8a7a50'); gr.addColorStop(1, '#3a3020');
    g.fillStyle = '#1a1612'; g.beginPath(); g.arc(0, 0, 160, 0, 7); g.fill(); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 140, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; for (let k = 0; k < 24; k++) { g.beginPath(); g.arc(0, 0, 140 - k * .4, k * .26, k * .26 + .1); g.stroke(); }
    g.save(); g.rotate(rot); g.fillStyle = '#c8b070'; g.beginPath(); g.arc(0, 0, 70, 0, 7); g.fill(); g.strokeStyle = '#6a5a30'; g.lineWidth = 4; g.stroke();
    g.fillStyle = '#0a0806'; g.beginPath(); g.arc(0, -18, 14, 0, 7); g.fill(); g.fillRect(-7, -18, 14, 50); g.restore();
    // 텐션 렌치
    g.save(); g.rotate(rot); g.fillStyle = '#5a5a5e'; g.fillRect(-4, 20, 8, 120); g.fillRect(-4, 132, 70, 8); g.restore();
    // 머리핀
    g.save(); g.rotate(pa); g.strokeStyle = '#2a2a30'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -10); g.lineTo(0, -175); g.stroke();
    g.strokeStyle = '#7a7a84'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -10); g.lineTo(0, -175); g.stroke(); g.restore();
    g.restore();
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(20, 14, 340, 8); g.fillStyle = strain > .6 ? '#e05040' : '#c8a050'; g.fillRect(20, 14, 340 * clamp(rot / (Math.PI / 2), 0, 1), 8);
  }
  raf = requestAnimationFrame(loop);
  return p;
}

/* ---------- 2. 다이얼 자물쇠 ---------- */
function dial({ code, title = '다이얼 자물쇠', hint = '', onFail }) {
  const n = code.length, val = Array(n).fill(0); let sel = 0;
  const p = open(title, `←→ 칸 선택 · ↑↓ 또는 휠 · 클릭으로 숫자 돌리기 · Enter 열기${hint ? '<br>' + hint : ''}`);
  const box = document.createElement('div'); box.className = 'dialBox'; $('mgBody').appendChild(box);
  const btn = document.createElement('button'); btn.className = 'btn pri'; btn.textContent = '열기'; btn.style.marginTop = '14px'; $('mgBody').appendChild(btn);
  const render = () => {
    box.innerHTML = val.map((v, i) => `<div class="wheel${i === sel ? ' sel' : ''}" data-i="${i}"><span>${(v + 9) % 10}</span><b>${v}</b><span>${(v + 1) % 10}</span></div>`).join('');
    box.querySelectorAll('.wheel').forEach(w => {
      const i = +w.dataset.i;
      w.onclick = e => { const r = w.getBoundingClientRect(); sel = i; turn(i, e.clientY < r.top + r.height / 2 ? 1 : -1); };
      w.onwheel = e => { e.preventDefault(); sel = i; turn(i, e.deltaY < 0 ? 1 : -1); };
    });
  };
  const turn = (i, d) => { val[i] = (val[i] + d + 10) % 10; sfx.dial(); render(); };
  const check = () => {
    if (val.join('') === code) { sfx.tumbler(); close(true); }
    else { sfx.buzz(); status('열리지 않는다', 'err'); if (onFail) onFail(); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); }
  };
  btn.onclick = check;
  keys(e => {
    if (e.type !== 'keydown') return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { sel = (sel + n - 1) % n; render(); }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { sel = (sel + 1) % n; render(); }
    if (e.code === 'ArrowUp' || e.code === 'KeyW') turn(sel, 1);
    if (e.code === 'ArrowDown' || e.code === 'KeyS') turn(sel, -1);
    if (/^(Digit|Numpad)\d$/.test(e.code)) { val[sel] = +e.code.slice(-1); sfx.dial(); sel = Math.min(n - 1, sel + 1); render(); }
    if (e.code === 'Enter') check();
  });
  render();
  return p;
}

/* ---------- 3. 배선 퍼즐 (타일 회전) ---------- */
// 마스크: N=1 E=2 S=4 W=8. 왼쪽 전원에서 오른쪽 출력까지 회로를 잇는다.
function circuit({ title = '배선 퍼즐', hint = '' } = {}) {
  const R = 4, C = 5, S = 74;
  const p = open(title, `타일을 클릭해 돌려 왼쪽 <b style="color:#ffd060">전원</b>에서 오른쪽 <b style="color:#60e0ff">차단기</b>까지 전선을 이어라 (우클릭: 반대로)${hint ? '<br>' + hint : ''}`);
  const c = canvas(C * S + 80, R * S + 20), g = c.getContext('2d');
  const rot = m => ((m << 1) | (m >> 3)) & 15;
  const grid = Array.from({ length: R }, () => Array(C).fill(0));
  const r0 = (Math.random() * R) | 0, r1 = (Math.random() * R) | 0;
  // 정답 경로
  const path = []; let r = r0;
  for (let col = 0; col < C; col++) {
    const tgt = col === C - 1 ? r1 : (Math.random() * R) | 0;
    path.push([r, col]); while (r !== tgt) { r += Math.sign(tgt - r); path.push([r, col]); }
  }
  const conn = (a, b) => (b[0] < a[0] ? 1 : b[1] > a[1] ? 2 : b[0] > a[0] ? 4 : 8);
  path.forEach((cell, i) => {
    let m = 0;
    if (i === 0) m |= 8; else m |= conn(cell, path[i - 1]);
    if (i === path.length - 1) m |= 2; else m |= conn(cell, path[i + 1]);
    grid[cell[0]][cell[1]] = m;
  });
  const pieces = [5, 3, 7, 3, 10];
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (!grid[y][x]) grid[y][x] = pieces[(Math.random() * pieces.length) | 0];
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { const k = 1 + ((Math.random() * 3) | 0); for (let i = 0; i < k; i++) grid[y][x] = rot(grid[y][x]); }
  let won = false;
  const powered = () => {
    const on = Array.from({ length: R }, () => Array(C).fill(false)); const q = [];
    if (grid[r0][0] & 8) { on[r0][0] = true; q.push([r0, 0]); }
    while (q.length) {
      const [y, x] = q.shift(), m = grid[y][x];
      [[1, -1, 0, 4], [2, 0, 1, 8], [4, 1, 0, 1], [8, 0, -1, 2]].forEach(([b, dy, dx, opp]) => {
        const ny = y + dy, nx = x + dx; if (!(m & b) || ny < 0 || ny >= R || nx < 0 || nx >= C || on[ny][nx] || !(grid[ny][nx] & opp)) return;
        on[ny][nx] = true; q.push([ny, nx]);
      });
    }
    return on;
  };
  const draw = () => {
    const on = powered(); won = on[r1][C - 1] && (grid[r1][C - 1] & 2);
    g.fillStyle = '#0c1014'; g.fillRect(0, 0, c.width, c.height);
    const ox = 40, oy = 10;
    g.fillStyle = '#ffd060'; g.fillRect(4, oy + r0 * S + S / 2 - 12, 30, 24); g.fillStyle = '#000'; g.font = 'bold 12px sans-serif'; g.fillText('⚡', 12, oy + r0 * S + S / 2 + 5);
    g.fillStyle = won ? '#60ffa0' : '#60e0ff'; g.fillRect(ox + C * S + 6, oy + r1 * S + S / 2 - 12, 30, 24);
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
      const px = ox + x * S, py = oy + y * S, m = grid[y][x];
      g.fillStyle = '#1a2026'; g.fillRect(px + 2, py + 2, S - 4, S - 4); g.strokeStyle = '#2c3640'; g.strokeRect(px + 2, py + 2, S - 4, S - 4);
      g.strokeStyle = on[y][x] ? (won ? '#60ffa0' : '#ffd060') : '#5a646c'; g.lineWidth = 9; g.lineCap = 'round';
      const cx = px + S / 2, cy = py + S / 2;
      [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0]].forEach(([b, dx, dy]) => { if (m & b) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + dx * S / 2, cy + dy * S / 2); g.stroke(); } });
      g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(cx, cy, 7, 0, 7); g.fill();
    }
  };
  const click = (e, dir) => {
    if (won) return; const rc = c.getBoundingClientRect(), x = ((e.clientX - rc.left) * c.width / rc.width - 40) / S | 0, y = ((e.clientY - rc.top) * c.height / rc.height - 10) / S | 0;
    if (x < 0 || x >= C || y < 0 || y >= R) return;
    grid[y][x] = dir > 0 ? rot(grid[y][x]) : rot(rot(rot(grid[y][x]))); sfx.dial(); draw();
    if (won) { sfx.fuse(); close(true); }
  };
  c.addEventListener('click', e => click(e, 1)); c.addEventListener('contextmenu', e => { e.preventDefault(); click(e, -1); });
  keys(() => {});
  draw();
  if (won) { grid[r0][0] = rot(grid[r0][0]); draw(); }
  return p;
}

/* ---------- 4. 피아노 ---------- */
const NOTES = [['도', 261.6], ['레', 293.7], ['미', 329.6], ['파', 349.2], ['솔', 392.0], ['라', 440.0], ['시', 493.9], ['도²', 523.3]];
function piano({ melody, sheet, onFail }) {
  const p = open('피아노', `숫자 키 <b>1~8</b> 또는 건반 클릭 · 악보의 선율을 그대로 쳐라${sheet ? `<br>악보: <b style="color:#e8d8a8">${sheet}</b>` : '<br><span style="color:#a06a6a">어딘가에 악보가 있었을 것 같다…</span>'}`);
  const kb = document.createElement('div'); kb.className = 'pianoKb'; $('mgBody').appendChild(kb);
  const disp = document.createElement('div'); disp.className = 'pianoDisp'; $('mgBody').appendChild(disp);
  let idx = 0, played = [];
  kb.innerHTML = NOTES.map(([n], i) => `<button data-i="${i}"><small>${i + 1}</small>${n}</button>`).join('');
  const press = i => {
    const b = kb.children[i]; b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 160);
    sfx.note(NOTES[i][1]); played.push(NOTES[i][0]);
    if (i === melody[idx]) { idx++; if (idx === melody.length) { setTimeout(() => close(true), 400); } }
    else { idx = i === melody[0] ? 1 : 0; if (played.length > 1) { status('…음이 어긋났다', 'err'); if (onFail) onFail(); } played = idx ? [NOTES[i][0]] : []; }
    disp.textContent = played.join(' · ') || '…';
  };
  kb.querySelectorAll('button').forEach(b => { b.onclick = () => press(+b.dataset.i); });
  keys(e => { if (e.type === 'keydown' && /^(Digit|Numpad)[1-8]$/.test(e.code)) press(+e.code.slice(-1) - 1); });
  disp.textContent = '…';
  return p;
}

/* ---------- 5. 슬라이딩 퍼즐 ---------- */
function slide({ img, title = '그림 맞추기' }) {
  const N = 3, p = open(title, '빈칸 옆의 조각을 클릭하거나 방향키로 밀어 그림을 완성하라');
  const box = document.createElement('div'); box.className = 'slideBox'; $('mgBody').appendChild(box);
  const info = document.createElement('div'); info.className = 'mgInfo'; $('mgBody').appendChild(info);
  let t = [...Array(N * N).keys()], e0 = N * N - 1, moves = 0;
  const nb = i => [i - N, i + N, i % N ? i - 1 : -1, (i + 1) % N ? i + 1 : -1].filter(j => j >= 0 && j < N * N);
  const swap = j => { const e = t.indexOf(N * N - 1); t[e] = t[j]; t[j] = N * N - 1; };
  for (let k = 0, last = -1; k < 90; k++) { const e = t.indexOf(N * N - 1), c = nb(e).filter(j => j !== last); const j = c[(Math.random() * c.length) | 0]; last = e; swap(j); }
  if (t.every((v, i) => v === i)) swap(nb(t.indexOf(N * N - 1))[0]);
  const render = () => {
    box.innerHTML = t.map((v, i) => v === N * N - 1 ? '<div class="sl empty"></div>' : `<div class="sl" data-i="${i}" style="background-image:url(${img});background-position:${(v % N) * 50}% ${((v / N) | 0) * 50}%"></div>`).join('');
    box.querySelectorAll('.sl[data-i]').forEach(d => { d.onclick = () => move(+d.dataset.i); });
    info.textContent = `이동 ${moves}회`;
  };
  const move = j => {
    if (!nb(t.indexOf(N * N - 1)).includes(j)) return;
    swap(j); moves++; sfx.slide(); render();
    if (t.every((v, i) => v === i)) { box.innerHTML = `<img src="${img}" style="width:100%;display:block">`; close(true); }
  };
  keys(e => {
    if (e.type !== 'keydown') return; const em = t.indexOf(N * N - 1);
    const d = { ArrowUp: em + N, KeyW: em + N, ArrowDown: em - N, KeyS: em - N, ArrowLeft: (em + 1) % N ? em + 1 : -1, KeyA: (em + 1) % N ? em + 1 : -1, ArrowRight: em % N ? em - 1 : -1, KeyD: em % N ? em - 1 : -1 }[e.code];
    if (d != null && d >= 0 && d < N * N) move(d);
  });
  render();
  return p;
}

/* ---------- 6. 갈고리 낚기 (타이밍) ---------- */
function fishing({ title = '배수구 — 갈고리 걸기', need = 3 }) {
  const p = open(title, '흔들리는 갈고리가 <b style="color:#60e0a0">초록 구간</b>에 들어왔을 때 <b>Space / 클릭</b> — 3번 걸면 끌어올린다');
  const c = canvas(440, 150), g = c.getContext('2d');
  let x = 0, sp = 1.3, hits = 0, miss = 0, zone = .3 + Math.random() * .4, w = .16, lastT = performance.now(), t = 0, flash = 0;
  const act = () => {
    const pos = (Math.sin(t * sp * 2.2) + 1) / 2;
    if (Math.abs(pos - zone) < w / 2) { hits++; sfx.hook(); flash = 1; zone = .15 + Math.random() * .7; w *= .82; sp *= 1.15; status(`걸렸다! (${hits}/${need})`, 'ok'); if (hits >= need) { setTimeout(() => close(true), 300); } }
    else { miss++; sfx.buzz(); status(`미끄러졌다… (실수 ${miss}/3)`, 'err'); if (miss >= 3) setTimeout(() => close(false), 600); }
  };
  c.addEventListener('click', act);
  keys(e => { if (e.type === 'keydown' && (e.code === 'Space' || e.code === 'Enter')) act(); });
  const loop = now => {
    const dt = Math.min(.12, (now - lastT) / 1000); lastT = now; t += dt; flash = Math.max(0, flash - dt * 3);
    x = (Math.sin(t * sp * 2.2) + 1) / 2;
    g.fillStyle = '#081014'; g.fillRect(0, 0, 440, 150);
    for (let k = 0; k < 12; k++) { g.fillStyle = `rgba(40,90,110,${.15 + .1 * Math.sin(t * 2 + k)})`; g.fillRect(0, k * 12 + Math.sin(t + k) * 3, 440, 6); }
    g.fillStyle = '#1e2a30'; g.fillRect(20, 60, 400, 30);
    g.fillStyle = `rgba(80,230,150,${.55 + flash * .4})`; g.fillRect(20 + (zone - w / 2) * 400, 60, w * 400, 30);
    g.strokeStyle = '#d8d0b8'; g.lineWidth = 3; g.beginPath(); g.moveTo(20 + x * 400, 10); g.lineTo(20 + x * 400, 80); g.stroke();
    g.beginPath(); g.arc(20 + x * 400 + 8, 84, 8, Math.PI, Math.PI * 2.6); g.stroke();
    for (let k = 0; k < need; k++) { g.fillStyle = k < hits ? '#60e0a0' : '#2c3640'; g.beginPath(); g.arc(200 + k * 22, 120, 7, 0, 7); g.fill(); }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return p;
}

/* ---------- 7. 녹음 순서 맞추기 (마지막 방송) ---------- */
// 카드를 클릭해 두 장씩 자리를 바꾸고, ▶ 로 들어 볼 수 있다. 자막(텍스트)과 파형을 함께 보여 준다
function order({ title, frags, showTimes, onFail }) {
  const p = open(title, `그날 밤의 녹음 조각을 <b>일어난 순서대로</b> 놓아라 — 두 카드를 차례로 눌러 자리를 바꾼다 · ▶ 다시 듣기<br>휴대폰의 <b>사건 연표</b>가 도움이 된다`);
  let cur = frags.map((f, i) => i); do { cur.sort(() => Math.random() - .5); } while (cur.every((v, i) => v === i));
  let pick = -1, fails = 0, times = !!showTimes;
  const box = document.createElement('div'); box.className = 'tapeBox'; $('mgBody').appendChild(box);
  const btn = document.createElement('button'); btn.className = 'btn pri'; btn.textContent = '이 순서로 방송 송출'; btn.style.marginTop = '10px'; $('mgBody').appendChild(btn);
  const wave = seed => { let s = seed * 9301 + 49297, out = ''; for (let k = 0; k < 28; k++) { s = (s * 9301 + 49297) % 233280; out += `<i style="height:${4 + (s / 233280) * 22}px"></i>`; } return out; };
  const render = () => {
    box.innerHTML = cur.map((fi, slot) => { const f = frags[fi]; return `<div class="tape${slot === pick ? ' pick' : ''}" data-s="${slot}"><em>${slot + 1}</em><div class="wv">${wave(fi + 3)}</div><span>${f.text}</span>${times ? `<b>${f.t}</b>` : ''}<button data-play="${fi}">▶</button></div>`; }).join('');
    box.querySelectorAll('.tape').forEach(el => { el.onclick = e => { if (e.target.dataset.play != null) { sfx.tape(); sfx.staticNoise(.6); status(frags[+e.target.dataset.play].text); return; } const s = +el.dataset.s; if (pick < 0) { pick = s; sfx.dial(); } else { [cur[pick], cur[s]] = [cur[s], cur[pick]]; pick = -1; sfx.slide(); } render(); }; });
  };
  btn.onclick = () => {
    if (cur.every((v, i) => v === i)) { sfx.broadcast(); close(true); return; }
    fails++; if (onFail) onFail(); sfx.buzz(); status('…지직. 순서가 맞지 않는다', 'err');
    if (fails >= 2 && !times) { times = true; status('녹음 테이프에 적힌 시각이 보인다', 'err'); }
    render();
  };
  keys(() => {});
  render();
  return p;
}


/* ---------- 8. 짝 맞추기 (기억력) ---------- */
// 카드를 두 장씩 뒤집어 같은 그림을 찾는다. 틀린 횟수가 많으면 실패
function memory({ title = '짝 맞추기', icons = ['📻', '🎹', '📼', '🔔', '📕', '🗝'], maxMiss = 8 }) {
  const p = open(title, '카드를 클릭해 두 장씩 뒤집고 <b>같은 그림</b>을 모두 찾아라 · 틀린 횟수가 다 차면 실패');
  const deck = [...icons, ...icons].map((ic, i) => ({ ic, id: i, open: false, done: false })).sort(() => Math.random() - .5);
  const box = document.createElement('div'); box.className = 'memGrid'; box.style.gridTemplateColumns = `repeat(${deck.length > 12 ? 5 : 4}, 64px)`; $('mgBody').appendChild(box);
  const info = document.createElement('div'); info.className = 'mgInfo'; $('mgBody').appendChild(info);
  let first = null, lock = false, miss = 0, pairs = 0;
  const render = () => {
    box.innerHTML = deck.map((c, i) => `<button class="memCard${c.open || c.done ? ' open' : ''}${c.done ? ' done' : ''}" data-i="${i}">${c.open || c.done ? c.ic : '?'}</button>`).join('');
    info.innerHTML = `찾은 짝 <b>${pairs}</b> / ${icons.length} · 남은 실수 <b>${maxMiss - miss}</b>`;
    box.querySelectorAll('.memCard').forEach(b => { b.onclick = () => flip(+b.dataset.i); });
  };
  const flip = i => {
    const c = deck[i]; if (lock || c.open || c.done) return;
    c.open = true; sfx.paper(); render();
    if (!first) { first = c; return; }
    if (first.ic === c.ic) { first.done = c.done = true; first = null; pairs++; sfx.ding ? sfx.ding() : sfx.unlock(); render(); if (pairs >= icons.length) setTimeout(() => close(true), 350); return; }
    lock = true; miss++; sfx.buzz(); const a = first; first = null;
    setTimeout(() => { a.open = c.open = false; lock = false; render(); if (miss >= maxMiss) { status('…카드가 모두 뒤집혔다', 'err'); setTimeout(() => close(false), 600); } }, 650);
  };
  keys(() => {});
  render();
  return p;
}

/* ---------- 9. 주파수 맞추기 (라디오) ---------- */
// A · D / 마우스로 다이얼을 돌려 잡음이 사라지는 주파수를 찾고, 그 자리에서 1.5초 버티면 성공
function tune({ title = '라디오 주파수 맞추기', label = '…이 방송을 듣는 사람에게…' }) {
  const p = open(title, '<b>A · D / 마우스</b>로 다이얼을 돌려 잡음이 사라지는 곳을 찾아라 — 찾으면 그대로 <b>잠시 버티기</b>');
  const c = canvas(440, 170), g = c.getContext('2d');
  const target = .15 + Math.random() * .7; let f = Math.random() < .5 ? .05 : .95, hold = 0, lastT = performance.now(), t = 0, dir = 0, lastTick = 0;
  c.addEventListener('mousemove', e => { const r = c.getBoundingClientRect(); f = clamp((e.clientX - r.left) / r.width, 0, 1); });
  keys(e => { const dn = e.type === 'keydown'; if (e.code === 'KeyA' || e.code === 'ArrowLeft') dir = dn ? -1 : (dir === -1 ? 0 : dir); if (e.code === 'KeyD' || e.code === 'ArrowRight') dir = dn ? 1 : (dir === 1 ? 0 : dir); });
  const loop = now => {
    const dt = Math.min(.12, (now - lastT) / 1000); lastT = now; t += dt; f = clamp(f + dir * dt * .32, 0, 1);
    const d = Math.abs(f - target), clear = clamp(1 - d / .06, 0, 1);
    if (Math.abs(f - lastTick) > .02) { lastTick = f; sfx.dial(); }
    hold = clear > .75 ? hold + dt : Math.max(0, hold - dt * 2);
    g.fillStyle = '#0b0f0c'; g.fillRect(0, 0, 440, 170);
    // 잡음 · 파형
    g.strokeStyle = `rgba(120,230,150,${.35 + clear * .6})`; g.lineWidth = 2; g.beginPath();
    for (let x = 0; x < 440; x += 4) { const n = (Math.random() - .5) * 60 * (1 - clear), w = Math.sin(x * .05 + t * 6) * 22 * clear; const y = 62 + n + w; x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    // 눈금 · 바늘
    g.fillStyle = '#18221c'; g.fillRect(20, 120, 400, 26);
    g.fillStyle = '#7a8a7a'; g.font = '11px monospace'; for (let k = 0; k <= 10; k++) { g.fillRect(20 + k * 40, 120, 1, k % 5 ? 6 : 12); if (k % 2 === 0) g.fillText(String(88 + k * 2), 12 + k * 40, 162); }
    g.fillStyle = '#ff6a4a'; g.fillRect(20 + f * 400 - 1, 112, 3, 38);
    g.fillStyle = `rgba(232,200,112,${clear})`; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText(clear > .6 ? label : '지지직……', 220, 26); g.textAlign = 'left';
    g.fillStyle = '#2c3640'; g.fillRect(140, 92, 160, 8); g.fillStyle = '#60e0a0'; g.fillRect(140, 92, 160 * clamp(hold / 1.5, 0, 1), 8);
    if (hold >= 1.5) { sfx.radio ? sfx.radio() : sfx.beep(); return close(true); }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return p;
}

/* ---------- 10. 순서 따라 하기 (사이먼) ---------- */
// 불이 켜지는 순서를 기억했다가 그대로 누른다 (1 · 2 · 3 · 4 키 또는 클릭). 라운드마다 하나씩 길어진다
function simon({ title = '순서 따라 하기', pads = ['도', '레', '미', '솔'], rounds = [3, 4, 5], notes = [262, 294, 330, 392] }) {
  const p = open(title, '불이 켜지는 <b>순서</b>를 기억했다가 그대로 눌러라 — <b>1 · 2 · 3 · 4</b> 키 또는 클릭 · 3번 틀리면 실패');
  const box = document.createElement('div'); box.className = 'simGrid'; $('mgBody').appendChild(box);
  const info = document.createElement('div'); info.className = 'mgInfo'; $('mgBody').appendChild(info);
  const cols = ['#c84a3a', '#d8b040', '#4aa86a', '#4a7ad0'];
  box.innerHTML = pads.map((n, i) => `<button class="simPad" data-i="${i}" style="--c:${cols[i]}">${i + 1}<small>${n}</small></button>`).join('');
  const el = [...box.querySelectorAll('.simPad')];
  let r = 0, seq = [], input = 0, busy = true, miss = 0;
  const light = (i, ms = 380) => { el[i].classList.add('on'); sfx.note(notes[i]); setTimeout(() => el[i].classList.remove('on'), ms); };
  const play = () => {
    busy = true; input = 0; while (seq.length < rounds[r]) seq.push((Math.random() * 4) | 0);
    info.innerHTML = `라운드 <b>${r + 1}</b> / ${rounds.length} · 실수 ${miss}/3 — 잘 봐라`;
    seq.forEach((v, k) => setTimeout(() => light(v), 600 + k * 560));
    setTimeout(() => { busy = false; info.innerHTML = `라운드 <b>${r + 1}</b> / ${rounds.length} · 실수 ${miss}/3 — 이제 따라 눌러라`; }, 600 + seq.length * 560);
  };
  const press = i => {
    if (busy || !finish) return; light(i, 200);
    if (seq[input] !== i) { miss++; sfx.buzz(); status('틀렸다…', 'err'); if (miss >= 3) { busy = true; setTimeout(() => close(false), 500); return; } seq = seq.slice(0, rounds[r]); setTimeout(play, 700); return; }
    input++;
    if (input >= seq.length) { r++; status(r >= rounds.length ? '' : '좋아!', 'ok'); if (r >= rounds.length) { busy = true; setTimeout(() => close(true), 400); return; } busy = true; setTimeout(play, 800); }
  };
  el.forEach((b, i) => { b.onclick = () => press(i); });
  keys(e => { if (e.type === 'keydown' && /^(Digit|Numpad)[1-4]$/.test(e.code)) press(+e.code.slice(-1) - 1); });
  play();
  return p;
}

/* ---------- 11. 타이밍 (게이지) ---------- */
// 왕복하는 바늘이 초록 구간에 들어왔을 때 Space / 클릭. need 번 성공하면 끝 (농구 슛 · 비커 눈금 · 부적 붙이기 등)
function timing({ title = '타이밍', hint = '바늘이 <b style="color:#60e0a0">초록 구간</b>에 들어왔을 때 <b>Space / 클릭</b>', need = 3, tries = 5, icon = '', okText = '성공!', missText = '빗나갔다…' }) {
  const p = open(title, hint + ` — <b>${tries}</b>번 중 <b>${need}</b>번`);
  const c = canvas(440, 140), g = c.getContext('2d');
  let t = 0, sp = 1.1, hits = 0, used = 0, zone = .3 + Math.random() * .4, w = .18, lastT = performance.now(), flash = 0, fc = '#60e0a0';
  const act = () => {
    if (!finish) return; const pos = (Math.sin(t * sp * 2.4) + 1) / 2; used++;
    if (Math.abs(pos - zone) < w / 2) { hits++; flash = 1; fc = '#60e0a0'; sfx.ball ? sfx.ball() : sfx.click(); status(`${okText} (${hits}/${need})`, 'ok'); zone = .15 + Math.random() * .7; w *= .88; sp *= 1.12; }
    else { flash = 1; fc = '#e06a5a'; sfx.buzz(); status(`${missText} (남은 기회 ${tries - used})`, 'err'); }
    if (hits >= need) setTimeout(() => close(true), 350);
    else if (tries - used < need - hits) setTimeout(() => close(false), 600);
  };
  c.addEventListener('click', act);
  keys(e => { if (e.type === 'keydown' && (e.code === 'Space' || e.code === 'Enter')) act(); });
  const loop = now => {
    const dt = Math.min(.12, (now - lastT) / 1000); lastT = now; t += dt; flash = Math.max(0, flash - dt * 3);
    const x = (Math.sin(t * sp * 2.4) + 1) / 2;
    g.fillStyle = '#0a0d10'; g.fillRect(0, 0, 440, 140);
    g.fillStyle = '#1e2a30'; g.fillRect(20, 54, 400, 28);
    g.fillStyle = 'rgba(80,230,150,.6)'; g.fillRect(20 + (zone - w / 2) * 400, 54, w * 400, 28);
    if (flash > 0) { g.fillStyle = fc; g.globalAlpha = flash * .35; g.fillRect(0, 0, 440, 140); g.globalAlpha = 1; }
    g.fillStyle = '#f0e8d0'; g.fillRect(20 + x * 400 - 2, 44, 4, 48);
    if (icon) { g.font = '26px sans-serif'; g.textAlign = 'center'; g.fillText(icon, 20 + x * 400, 36); g.textAlign = 'left'; }
    for (let k = 0; k < tries; k++) { g.fillStyle = k < used ? '#3a4650' : '#8a96a0'; g.beginPath(); g.arc(160 + k * 22, 116, 6, 0, 7); g.fill(); }
    for (let k = 0; k < need; k++) { g.fillStyle = k < hits ? '#60e0a0' : '#2c3640'; g.fillRect(150 + k * 26 + 160, 110, 18, 12); }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return p;
}

/* ---------- 12. 분신사바 (위저 보드) ---------- */
// 질문을 고르면 말판이 저절로 움직여 글자를 짚는다. 플레이어는 손을 떼지 않게 Space 를 계속 누르고 있어야 한다 (떼면 실패)
function ouija({ title = '분신사바', qs = [] }) {
  const p = open(title, '질문을 고른 뒤, 말판이 대답을 마칠 때까지 <b>Space / 마우스 버튼</b>을 계속 누르고 있어라 — 손을 떼면 안 된다');
  const c = canvas(440, 220), g = c.getContext('2d');
  const L = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'.split('').concat(['예', '아니오']);
  const pos = L.map((ch, i) => i < 14 ? { ch, x: 40 + (i % 7) * 60, y: 70 + ((i / 7) | 0) * 56 } : { ch, x: i === 14 ? 70 : 370, y: 26 });
  const qbox = document.createElement('div'); qbox.className = 'ouQ'; $('mgBody').appendChild(qbox);
  qbox.innerHTML = qs.map((q, i) => `<button class="btn" data-i="${i}">${q.q}</button>`).join('');
  let hold = false, ans = null, k = 0, px = 220, py = 120, t = 0, lastT = performance.now(), shown = '', started = false, lost = 0;
  const down = () => { hold = true; }, up = () => { hold = false; };
  c.addEventListener('mousedown', down); addEventListener('mouseup', up); cleanups.push(() => removeEventListener('mouseup', up));
  keys(e => { if (e.code === 'Space') hold = e.type === 'keydown'; });
  qbox.querySelectorAll('button').forEach(b => { b.onclick = () => { if (ans) return; ans = qs[+b.dataset.i]; qbox.innerHTML = `<div class="mgInfo">“${ans.q}”</div>`; sfx.whisper && sfx.whisper(); started = true; }; });
  const loop = now => {
    const dt = Math.min(.12, (now - lastT) / 1000); lastT = now; t += dt;
    g.fillStyle = '#20160e'; g.fillRect(0, 0, 440, 220); g.strokeStyle = '#6a5038'; g.strokeRect(6, 6, 428, 208);
    g.font = '20px serif'; g.textAlign = 'center'; g.fillStyle = '#d8c8a0'; pos.forEach(o => g.fillText(o.ch, o.x, o.y + 7));
    if (started && ans) {
      if (!hold) { lost += dt; if (lost > .6) { status('손을 뗐다 — 말판이 바닥으로 떨어졌다', 'err'); sfx.ghostLaugh ? sfx.ghostLaugh() : sfx.buzz(); started = false; setTimeout(() => close(false), 700); } }
      else lost = 0;
      const seq = ans.a, tgt = pos.find(o => o.ch === seq[k]) || pos[0];
      px += (tgt.x - px) * Math.min(1, dt * 2.2) + Math.sin(t * 9) * .6; py += (tgt.y - py) * Math.min(1, dt * 2.2) + Math.cos(t * 7) * .6;
      if (Math.hypot(tgt.x - px, tgt.y - py) < 3) { shown += seq[k] === '예' || seq[k] === '아니오' ? `[${seq[k]}] ` : seq[k]; k++; sfx.knock ? sfx.knock() : sfx.click(); if (k >= seq.length) { started = false; status(`…${ans.r || shown}`, 'ok'); setTimeout(() => close(true), 1400); } }
    }
    g.strokeStyle = 'rgba(240,220,170,.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(px, py - 26); g.lineTo(px - 20, py + 14); g.lineTo(px + 20, py + 14); g.closePath(); g.stroke();
    g.beginPath(); g.arc(px, py, 8, 0, 7); g.stroke(); g.lineWidth = 1;
    g.fillStyle = '#e8c870'; g.font = '15px sans-serif'; g.fillText(shown, 220, 205); g.textAlign = 'left';
    if (started && !hold) { g.fillStyle = 'rgba(200,60,40,.35)'; g.fillRect(0, 0, 440, 220); }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return p;
}

/* ---------- 13. 증기 배관 (압력 제한) ---------- */
// 배관 타일을 돌려 밸브(왼쪽)에서 배출구(오른쪽 위 · 아래 두 곳)까지 증기를 보낸다. 압력계가 계속 오르고, 틀린 방향으로 새는 증기가 많을수록 더 빨리 오른다
function pipes({ title = '증기 배관 — 압력을 빼라', time = 70 } = {}) {
  const R = 5, C = 6, S = 62, ox = 46, oy = 34;
  const p = open(title, `타일을 클릭해 돌려 <b style="color:#ffb070">밸브</b>의 증기를 <b style="color:#70d8ff">배출구 두 곳</b>으로 모두 보내라 (우클릭: 반대로)<br>열린 관 끝으로 증기가 새면 <b>압력이 더 빨리</b> 오른다 — 계기판이 빨간 칸에 닿으면 터진다`);
  const c = canvas(C * S + ox * 2, R * S + oy + 30), g = c.getContext('2d');
  const rot = m => ((m << 1) | (m >> 3)) & 15, conn = (a, b) => (b[0] < a[0] ? 1 : b[1] > a[1] ? 2 : b[0] > a[0] ? 4 : 8);
  const grid = Array.from({ length: R }, () => Array(C).fill(0));
  const src = 2, outs = [0, R - 1];
  // 두 출구로 가는 경로를 무작위로 깔고 겹치는 칸은 합친다(T자 · 십자 관이 생긴다)
  outs.forEach(tr => { let r = src; const path = [];
    for (let col = 0; col < C; col++) { const tgt = col === C - 1 ? tr : col < 2 ? src : (Math.random() * R) | 0; path.push([r, col]); while (r !== tgt) { r += Math.sign(tgt - r); path.push([r, col]); } }
    path.forEach((cell, i) => { let m = grid[cell[0]][cell[1]]; m |= i === 0 ? 8 : conn(cell, path[i - 1]); m |= i === path.length - 1 ? 2 : conn(cell, path[i + 1]); grid[cell[0]][cell[1]] = m; }); });
  const filler = [5, 3, 6, 7, 11];
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { if (!grid[y][x]) grid[y][x] = filler[(Math.random() * filler.length) | 0]; const k = 1 + ((Math.random() * 3) | 0); for (let i = 0; i < k; i++) grid[y][x] = rot(grid[y][x]); }
  let press = 0, leak = 0, won = false, lastT = performance.now(), puffs = [];
  const flow = () => {
    const on = Array.from({ length: R }, () => Array(C).fill(false)), q = []; let lk = 0;
    if (grid[src][0] & 8) { on[src][0] = true; q.push([src, 0]); }
    while (q.length) { const [y, x] = q.shift(), m = grid[y][x];
      [[1, -1, 0, 4], [2, 0, 1, 8], [4, 1, 0, 1], [8, 0, -1, 2]].forEach(([b, dy, dx, opp]) => { if (!(m & b)) return; const ny = y + dy, nx = x + dx;
        if (nx === C && outs.includes(y) && b === 2) return;                                   // 배출구
        if (nx < 0 && y === src && b === 8) return;                                             // 밸브
        if (ny < 0 || ny >= R || nx < 0 || nx >= C || !(grid[ny][nx] & opp)) { lk++; return; }  // 새는 관 끝
        if (!on[ny][nx]) { on[ny][nx] = true; q.push([ny, nx]); } }); }
    return { on, lk, ok: outs.every(y => on[y][C - 1] && (grid[y][C - 1] & 2)) };
  };
  const click = (e, dir) => { if (won || !finish) return; const rc = c.getBoundingClientRect(), x = ((e.clientX - rc.left) * c.width / rc.width - ox) / S | 0, y = ((e.clientY - rc.top) * c.height / rc.height - oy) / S | 0;
    if (x < 0 || x >= C || y < 0 || y >= R) return; grid[y][x] = dir > 0 ? rot(grid[y][x]) : rot(rot(rot(grid[y][x]))); sfx.dial(); };
  c.addEventListener('click', e => click(e, 1)); c.addEventListener('contextmenu', e => { e.preventDefault(); click(e, -1); });
  keys(() => {});
  const loop = now => {
    const dt = Math.min(.1, (now - lastT) / 1000); lastT = now; const F = flow(); leak = F.lk;
    if (!won) press += dt * (1 / time) * (1 + leak * .22);
    if (F.ok && !won) { won = true; sfx.fuse ? sfx.fuse() : sfx.click(); status('쉬이이— 증기가 빠져나간다', 'ok'); setTimeout(() => close(true), 700); }
    if (press >= 1 && !won && finish) { sfx.buzz(); status('펑— 배관이 터졌다!', 'err'); setTimeout(() => finish && close(false), 700); press = 1; }
    g.fillStyle = '#0b0e10'; g.fillRect(0, 0, c.width, c.height);
    // 압력계
    g.fillStyle = '#1b2228'; g.fillRect(ox, 8, C * S, 14); g.fillStyle = '#5a2020'; g.fillRect(ox + C * S * .85, 8, C * S * .15, 14);
    g.fillStyle = press > .7 ? '#ff6a4a' : '#e8c070'; g.fillRect(ox, 8, C * S * Math.min(1, press), 14);
    g.fillStyle = '#c8c0a8'; g.font = '11px sans-serif'; g.fillText(`압력 ${Math.round(press * 100)}%  · 새는 곳 ${leak}`, ox, 32 - 2);
    g.fillStyle = '#ffb070'; g.fillRect(6, oy + src * S + S / 2 - 14, 34, 28); g.fillStyle = '#000'; g.font = 'bold 11px sans-serif'; g.fillText('밸브', 10, oy + src * S + S / 2 + 4);
    outs.forEach(y => { g.fillStyle = F.on[y][C - 1] && (grid[y][C - 1] & 2) ? '#80ffb0' : '#70d8ff'; g.fillRect(ox + C * S + 6, oy + y * S + S / 2 - 14, 34, 28); });
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
      const px = ox + x * S, py = oy + y * S, m = grid[y][x], cx = px + S / 2, cy = py + S / 2;
      g.fillStyle = '#161c20'; g.fillRect(px + 2, py + 2, S - 4, S - 4);
      g.lineCap = 'butt'; g.lineWidth = 14; g.strokeStyle = '#3a3026';
      [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0]].forEach(([b, dx, dy]) => { if (m & b) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + dx * S / 2, cy + dy * S / 2); g.stroke(); } });
      g.lineWidth = 6; g.strokeStyle = F.on[y][x] ? (won ? '#9affc8' : '#f0d8b0') : '#6a5a48';
      [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0]].forEach(([b, dx, dy]) => { if (m & b) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + dx * S / 2, cy + dy * S / 2); g.stroke(); } });
      g.fillStyle = '#7a6a58'; g.beginPath(); g.arc(cx, cy, 8, 0, 7); g.fill();
      if (F.on[y][x] && Math.random() < .04) puffs.push({ x: cx + (Math.random() - .5) * 20, y: cy, a: 1 });
    }
    puffs = puffs.filter(q => (q.a -= dt * 1.2) > 0); puffs.forEach(q => { q.y -= dt * 30; g.fillStyle = `rgba(230,230,230,${q.a * .25})`; g.beginPath(); g.arc(q.x, q.y, 10 * (2 - q.a), 0, 7); g.fill(); });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return p;
}

/* ---------- 14. 어둠 속 더듬기 (손전등 미로) ---------- */
// 위에서 본 어두운 미로: 손전등 반경만 보인다. 열쇠(또는 찾는 물건)를 주워 출구로. 그것이 돌아다니다가 빛 안에 들어온 플레이어를 쫓는다
function maze({ title = '어둠 속 — 선반 사이를 더듬어라', item = '물건', W = 13, H = 9 } = {}) {
  const S = 34;
  const p = open(title, `<b>WASD / 방향키</b>로 이동 · <b>Shift</b> 손전등 끄기(숨기) — 불을 끄면 그것이 놓친다<br><b style="color:#ffd070">${item}</b>을 주워 <b style="color:#80ffb0">출구</b>로. 그것에 닿으면 실패`);
  const c = canvas(W * S, H * S), g = c.getContext('2d');
  // 미로 생성 (DFS) + 고리 몇 개
  const wall = Array.from({ length: H }, () => Array(W).fill(1)), carve = (x, y) => { wall[y][x] = 0; [[2, 0], [-2, 0], [0, 2], [0, -2]].sort(() => Math.random() - .5).forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy; if (nx > 0 && ny > 0 && nx < W - 1 && ny < H - 1 && wall[ny][nx]) { wall[y + dy / 2][x + dx / 2] = 0; carve(nx, ny); } }); };
  carve(1, 1); for (let k = 0; k < 7; k++) { const x = 1 + ((Math.random() * (W - 2)) | 0), y = 1 + ((Math.random() * (H - 2)) | 0); if ((x + y) % 2) wall[y][x] = 0; }
  const free = []; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (!wall[y][x]) free.push([x, y]);
  const far = (a) => free.slice().sort((p, q) => Math.hypot(q[0] - a[0], q[1] - a[1]) - Math.hypot(p[0] - a[0], p[1] - a[1]))[0];
  const pl = { x: 1.5, y: 1.5 }, key = far([1, 1]), exit = [1, H - 2];
  const gs0 = free.filter(q => Math.hypot(q[0] - 1, q[1] - 1) > 6 && Math.hypot(q[0] - exit[0], q[1] - exit[1]) > 4); const g0 = gs0[(Math.random() * gs0.length) | 0] || far([1, 1]);
  const gh = { x: g0[0] + .5, y: g0[1] + .5, tx: 0, ty: 0, chase: 0, wake: 3 };   // 그것은 플레이어에게서 멀리 · 3초 뒤부터 움직인다
  let has = false, dark = false, lastT = performance.now(), held = {}, dead = false;
  keys(e => { held[e.code] = e.type === 'keydown'; });
  const solid = (x, y) => { const cx = x | 0, cy = y | 0; return cy < 0 || cy >= H || cx < 0 || cx >= W || wall[cy][cx]; };
  const move = (o, dx, dy, r = .28) => { if (!solid(o.x + dx + Math.sign(dx) * r, o.y) && !solid(o.x + dx + Math.sign(dx) * r, o.y + r * .9) && !solid(o.x + dx + Math.sign(dx) * r, o.y - r * .9)) o.x += dx; if (!solid(o.x, o.y + dy + Math.sign(dy) * r) && !solid(o.x + r * .9, o.y + dy + Math.sign(dy) * r) && !solid(o.x - r * .9, o.y + dy + Math.sign(dy) * r)) o.y += dy; };
  const los = (a, b) => { const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d * 4); for (let i = 1; i < n; i++) if (solid(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false; return true; };
  const loop = now => {
    const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
    if (!dead && finish) {
      dark = !!(held.ShiftLeft || held.ShiftRight);
      const sp = (dark ? 1.6 : 2.6) * dt, ix = (held.KeyD || held.ArrowRight ? 1 : 0) - (held.KeyA || held.ArrowLeft ? 1 : 0), iy = (held.KeyS || held.ArrowDown ? 1 : 0) - (held.KeyW || held.ArrowUp ? 1 : 0);
      move(pl, ix * sp, iy * sp);
      if (!has && Math.hypot(pl.x - key[0] - .5, pl.y - key[1] - .5) < .5) { has = true; sfx.pickup ? sfx.pickup() : sfx.click(); status(`${item} 확보 — 출구로!`, 'ok'); }
      if (has && Math.hypot(pl.x - exit[0] - .5, pl.y - exit[1] - .5) < .5) { dead = true; close(true); }
      // 그것: 빛이 켜져 있고 보이면 쫓고, 아니면 아무 데나 배회
      gh.wake -= dt;
      const sees = gh.wake <= 0 && !dark && Math.hypot(pl.x - gh.x, pl.y - gh.y) < 5.5 && los(pl, gh);
      if (sees) { gh.chase = 2.5; gh.tx = pl.x; gh.ty = pl.y; } else gh.chase -= dt;
      if (gh.chase <= 0 && (Math.hypot(gh.tx - gh.x, gh.ty - gh.y) < .3 || !gh.tx)) { const f2 = free[(Math.random() * free.length) | 0]; gh.tx = f2[0] + .5; gh.ty = f2[1] + .5; }
      const d = Math.hypot(gh.tx - gh.x, gh.ty - gh.y) || 1, gs = gh.wake > 0 ? 0 : (gh.chase > 0 ? 2.15 : 1.2) * dt; move(gh, (gh.tx - gh.x) / d * gs, (gh.ty - gh.y) / d * gs, .25);
      if (Math.hypot(pl.x - gh.x, pl.y - gh.y) < .55) { dead = true; sfx.stinger ? sfx.stinger(.6) : sfx.buzz(); status('그것에게 붙잡혔다…', 'err'); setTimeout(() => finish && close(false), 800); }
      if (Math.random() < dt * .6) sfx.step ? sfx.step() : 0;
    }
    g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { g.fillStyle = wall[y][x] ? '#2a2620' : '#11100e'; g.fillRect(x * S, y * S, S, S); if (wall[y][x]) { g.fillStyle = '#3a342a'; g.fillRect(x * S + 3, y * S + 3, S - 6, 4); } }
    if (!has) { g.font = '20px sans-serif'; g.textAlign = 'center'; g.fillText('🗝', key[0] * S + S / 2, key[1] * S + S / 2 + 7); }
    g.fillStyle = has ? '#60ffa0' : '#2a5a3a'; g.fillRect(exit[0] * S + 6, exit[1] * S + 6, S - 12, S - 12);
    g.fillStyle = '#e8e4e0'; g.beginPath(); g.ellipse(gh.x * S, gh.y * S, 9, 12, 0, 0, 7); g.fill(); g.fillStyle = '#000'; g.fillRect(gh.x * S - 5, gh.y * S - 4, 3, 4); g.fillRect(gh.x * S + 2, gh.y * S - 4, 3, 4);
    g.fillStyle = '#ffd070'; g.beginPath(); g.arc(pl.x * S, pl.y * S, 8, 0, 7); g.fill();
    // 어둠: 손전등 반경 밖은 가린다
    const r = dark ? S * .9 : S * 2.6, gr = g.createRadialGradient(pl.x * S, pl.y * S, r * .35, pl.x * S, pl.y * S, r);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.985)'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    const near = Math.hypot(pl.x - gh.x, pl.y - gh.y); if (near < 3.5) { g.fillStyle = `rgba(140,0,0,${(3.5 - near) / 3.5 * .25})`; g.fillRect(0, 0, c.width, c.height); }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return p;
}

/* ---------- 15. 맞물린 고리 암호 ---------- */
// 고리 3개에 기호가 8개씩. 오른쪽 위 '읽는 선'에 세 기호가 단서와 같게 오도록 돌린다. 바깥 고리를 돌리면 가운데 고리도 함께 돈다(맞물림)
function rings({ title = '단말기 잠금 — 고리 암호', clue = null, maxMoves = 24 } = {}) {
  const SYM = ['☾', '✦', '◆', '☂', '♪', '✚', '⌂', '☀'], N = 8;
  const target = clue || [0, 1, 2].map(() => (Math.random() * N) | 0);
  const off = [0, 0, 0];
  // 정답 상태에서 무작위로 섞어 풀 수 있게 만든다 (돌리기는 맞물림 규칙 그대로)
  const turn = (i, d) => { off[i] = (off[i] + d + N) % N; if (i === 2) off[1] = (off[1] + d + N) % N; if (i === 0) off[2] = (off[2] - d + N) % N; };
  target.forEach((t, i) => { off[i] = t; }); for (let k = 0; k < 14; k++) turn((Math.random() * 3) | 0, Math.random() < .5 ? 1 : -1);
  if ([0, 1, 2].every(i => off[i] === target[i])) turn(1, 1);
  const p = open(title, `고리를 <b>클릭</b>(왼쪽 / 오른쪽 클릭 = 반대 방향)해서 <b style="color:#ffd070">읽는 선</b>에 단서의 기호 세 개를 맞춰라<br>안쪽 고리 → 바깥 고리가 반대로 · 바깥 고리 → 가운데 고리가 같은 방향으로 함께 돈다 — 남은 회전 <b id="rgLeft">${maxMoves}</b>`);
  const c = canvas(420, 340), g = c.getContext('2d'); let moves = 0, won = false;
  const draw = () => {
    g.fillStyle = '#0b0d10'; g.fillRect(0, 0, 420, 340);
    const cx = 170, cy = 170, R = [62, 104, 146];
    g.fillStyle = '#c8c0a8'; g.font = '12px sans-serif'; g.fillText('단서', 330, 40); target.forEach((t, i) => { g.font = '26px serif'; g.fillStyle = ['#e8c070', '#a8d8ff', '#e8a0c8'][i]; g.fillText(SYM[t], 330, 78 + i * 38); });
    for (let i = 2; i >= 0; i--) { g.strokeStyle = ['#e8c070', '#a8d8ff', '#e8a0c8'][i]; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R[i], 0, 7); g.stroke();
      for (let k = 0; k < N; k++) { const a = (k - off[i]) / N * Math.PI * 2 - Math.PI / 2, r2 = R[i] - 20; g.font = '22px serif'; g.textAlign = 'center'; g.fillStyle = k === off[i] ? '#fff' : '#9a9488'; g.fillText(SYM[k], cx + Math.cos(a) * r2, cy + Math.sin(a) * r2 + 8); } }
    g.textAlign = 'left'; g.strokeStyle = 'rgba(255,208,112,.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy - 20); g.lineTo(cx, cy - R[2] - 8); g.stroke();
    g.fillStyle = '#ffd070'; g.beginPath(); g.moveTo(cx - 7, cy - R[2] - 14); g.lineTo(cx + 7, cy - R[2] - 14); g.lineTo(cx, cy - R[2] - 4); g.fill();
  };
  const click = (e, d) => { if (won || !finish) return; const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width - 170, y = (e.clientY - rc.top) * c.height / rc.height - 170, r = Math.hypot(x, y);
    const i = r < 84 ? 0 : r < 126 ? 1 : r < 168 ? 2 : -1; if (i < 0) return; turn(i, d); moves++; sfx.dial(); const L = document.getElementById('rgLeft'); if (L) L.textContent = maxMoves - moves; draw();
    if ([0, 1, 2].every(k => off[k] === target[k])) { won = true; sfx.fuse ? sfx.fuse() : sfx.click(); setTimeout(() => close(true), 400); }
    else if (moves >= maxMoves) { sfx.buzz(); status('잠금이 초기화된다…', 'err'); setTimeout(() => finish && close(false), 700); } };
  c.addEventListener('click', e => click(e, 1)); c.addEventListener('contextmenu', e => { e.preventDefault(); click(e, -1); });
  keys(() => {}); draw();
  return p;
}

/* ---------- 16. 틀린 그림 찾기 (두 장의 기록) ---------- */
// 같은 장면을 그린 두 그림 — 오른쪽 그림에서 달라진 곳 5개를 찾는다. 헛클릭 3번이면 그림이 일그러지며 실패. 제한 시간 있음
function spotdiff({ title = '두 장의 기록 — 달라진 곳 찾기', time = 80, scene = 'classroom' } = {}) {
  const Wd = 250, Hd = 200;
  const p = open(title, `오른쪽 그림에서 <b>달라진 곳 5개</b>를 클릭 · 헛클릭 3번 · 제한 시간 <b>${time}초</b>`);
  const c = canvas(Wd * 2 + 20, Hd + 30), g = c.getContext('2d');
  const rnd = (a, b) => a + Math.random() * (b - a);
  // 장면 요소: [종류, x, y, 크기, 색]
  const items = [];
  items.push(['window', 30, 30, 60, '#2a3a4a'], ['window', 160, 30, 60, '#2a3a4a'], ['board', 70, 40, 90, '#1e3a2a'], ['clock', 205, 22, 14, '#d8d0c0']);
  for (let k = 0; k < 6; k++) items.push(['desk', 20 + (k % 3) * 78, 120 + ((k / 3) | 0) * 40, 30, '#7a5a3a']);
  items.push(['figure', rnd(40, 200), 100, 22, '#d8d8d8'], ['flower', 222, 150, 12, '#c04040'], ['bag', 110, 175, 12, '#3a4a6a'], ['paper', 60, 95, 10, '#e8e0c8'], ['lamp', 125, 8, 40, '#e8e0a0']);
  const kinds = ['move', 'color', 'gone', 'size'];
  const diffs = items.map((_, i) => i).sort(() => Math.random() - .5).slice(0, 5).map(i => ({ i, k: kinds[(Math.random() * kinds.length) | 0], found: false }));
  const draw1 = (ox, alt) => {
    g.save(); g.translate(ox, 0); g.fillStyle = '#2e2a26'; g.fillRect(0, 0, Wd, Hd); g.fillStyle = '#3a342c'; g.fillRect(0, 90, Wd, Hd - 90);
    items.forEach((it, i) => { let [t, x, y, s, col] = it; const d = alt && diffs.find(q => q.i === i);
      if (d) { if (d.k === 'gone') return; if (d.k === 'move') x += 18; if (d.k === 'color') col = t === 'figure' ? '#a02020' : '#3a8a3a'; if (d.k === 'size') s *= 1.45; }
      g.fillStyle = col; g.strokeStyle = '#000';
      if (t === 'window') { g.fillRect(x, y, s * .6, s * .8); g.strokeStyle = '#8a8a80'; g.strokeRect(x, y, s * .6, s * .8); g.beginPath(); g.moveTo(x + s * .3, y); g.lineTo(x + s * .3, y + s * .8); g.stroke(); }
      else if (t === 'board') g.fillRect(x, y, s, s * .4);
      else if (t === 'clock') { g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); g.strokeStyle = '#222'; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - s * .7); g.moveTo(x, y); g.lineTo(x + s * .5, y); g.stroke(); }
      else if (t === 'desk') { g.fillRect(x, y, s * 1.6, s * .35); g.fillRect(x + 3, y + s * .35, 4, s * .5); g.fillRect(x + s * 1.6 - 7, y + s * .35, 4, s * .5); }
      else if (t === 'figure') { g.globalAlpha = .75; g.beginPath(); g.arc(x, y - s * 1.2, s * .45, 0, 7); g.fill(); g.fillRect(x - s * .45, y - s * .8, s * .9, s * 1.6); g.globalAlpha = 1; g.fillStyle = '#000'; g.fillRect(x - 4, y - s * 1.25, 3, 3); g.fillRect(x + 1, y - s * 1.25, 3, 3); }
      else if (t === 'flower') { g.fillStyle = '#3a6a3a'; g.fillRect(x - 1, y, 2, s * 1.4); g.fillStyle = col; g.beginPath(); g.arc(x, y, s * .5, 0, 7); g.fill(); }
      else if (t === 'lamp') { g.fillRect(x - s / 2, y, s, 5); }
      else g.fillRect(x - s / 2, y - s / 2, s, s * .8); });
    g.restore();
  };
  let miss = 0, t0 = performance.now(), lastFx = 0;
  const posOf = d => { const [, x, y] = items[d.i]; return [x + (d.k === 'move' ? 18 : 0), y]; };
  const loop = now => {
    const left = time - (now - t0) / 1000;
    g.fillStyle = '#0b0d10'; g.fillRect(0, 0, c.width, c.height); draw1(0, false); draw1(Wd + 20, true);
    diffs.filter(d => d.found).forEach(d => { const [x, y] = posOf(d); g.strokeStyle = '#60ffa0'; g.lineWidth = 2; [0, Wd + 20].forEach(o => { g.beginPath(); g.arc(o + x + 6, y + 4, 18, 0, 7); g.stroke(); }); });
    if (now - lastFx < 400) { g.fillStyle = 'rgba(160,0,0,.25)'; g.fillRect(Wd + 20, 0, Wd, Hd); }
    g.fillStyle = '#c8c0a8'; g.font = '12px sans-serif'; g.fillText(`찾은 곳 ${diffs.filter(d => d.found).length}/5 · 헛클릭 ${miss}/3 · 남은 시간 ${Math.max(0, Math.ceil(left))}초`, 6, Hd + 20);
    if (left <= 0 && finish) { status('시간이 다 됐다 — 그림이 번진다', 'err'); setTimeout(() => finish && close(false), 500); return; }
    raf = requestAnimationFrame(loop);
  };
  c.addEventListener('click', e => { if (!finish) return; const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width - Wd - 20, y = (e.clientY - rc.top) * c.height / rc.height; if (x < 0) return;
    const d = diffs.find(q => !q.found && Math.hypot(posOf(q)[0] + 6 - x, posOf(q)[1] + 4 - y) < 24);
    if (d) { d.found = true; sfx.click(); if (diffs.every(q => q.found)) { status('모두 찾았다', 'ok'); setTimeout(() => close(true), 500); } }
    else { miss++; lastFx = performance.now(); sfx.buzz(); if (miss >= 3) { status('그림 속 인물이 이쪽을 본다…', 'err'); setTimeout(() => finish && close(false), 700); } } });
  keys(() => {}); raf = requestAnimationFrame(loop);
  return p;
}

/* ---------- 17. 퓨즈판 (모두 켜기) ---------- */
// 퓨즈를 누르면 자기와 상하좌우 퓨즈가 함께 뒤집힌다. 정해진 횟수 안에 전부 켜면 전력 복구. 오래 끌면 과열(스파크)
function fuse({ title = '퓨즈판 — 모든 회로를 켜라', N = 4, extra = 6 } = {}) {
  const on = Array.from({ length: N }, () => Array(N).fill(true));
  const flip = (y, x) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dy, dx]) => { const a = y + dy, b = x + dx; if (a >= 0 && a < N && b >= 0 && b < N) on[a][b] = !on[a][b]; });
  const par = 5 + ((Math.random() * 3) | 0); for (let k = 0; k < par; k++) flip((Math.random() * N) | 0, (Math.random() * N) | 0);
  if (on.flat().every(Boolean)) flip(1, 1);
  const max = par + extra; let used = 0, won = false;
  const p = open(title, `퓨즈를 클릭하면 <b>자기와 상하좌우</b>가 함께 뒤집힌다 — <b>${max}</b>번 안에 16개를 모두 켜라`);
  const S = 70, c = canvas(N * S + 40, N * S + 50), g = c.getContext('2d');
  const draw = () => {
    g.fillStyle = '#121416'; g.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const px = 20 + x * S, py = 20 + y * S;
      g.fillStyle = '#23272b'; g.fillRect(px + 4, py + 4, S - 8, S - 8); g.fillStyle = on[y][x] ? '#7aff9a' : '#3a1414'; g.shadowColor = on[y][x] ? '#7aff9a' : 'transparent'; g.shadowBlur = on[y][x] ? 14 : 0;
      g.fillRect(px + 18, py + 14, S - 36, S - 28); g.shadowBlur = 0; g.fillStyle = '#b8b0a0'; g.fillRect(px + 26, py + 8, S - 52, 6); g.fillRect(px + 26, py + S - 14, S - 52, 6); }
    g.fillStyle = '#c8c0a8'; g.font = '12px sans-serif'; g.fillText(`남은 조작 ${max - used}`, 20, N * S + 40);
  };
  c.addEventListener('click', e => { if (won || !finish) return; const rc = c.getBoundingClientRect(), x = ((e.clientX - rc.left) * c.width / rc.width - 20) / S | 0, y = ((e.clientY - rc.top) * c.height / rc.height - 20) / S | 0;
    if (x < 0 || x >= N || y < 0 || y >= N) return; flip(y, x); used++; sfx.click(); draw();
    if (on.flat().every(Boolean)) { won = true; sfx.fuse ? sfx.fuse() : 0; setTimeout(() => close(true), 450); }
    else if (used >= max) { sfx.spark ? sfx.spark() : sfx.buzz(); status('퓨즈가 과열됐다 — 스파크!', 'err'); setTimeout(() => finish && close(false), 700); } });
  keys(() => {}); draw();
  return p;
}

export function run(kind, opts = {}) {
  if (MG.active) return Promise.resolve({ ok: false });
  return ({ lockpick, dial, circuit, piano, slide, fishing, order, memory, tune, simon, timing, ouija, pipes, maze, rings, spotdiff, fuse })[kind](opts);
}
