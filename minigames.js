// 미니게임: 자물쇠 따기 · 다이얼 자물쇠 · 배선 퍼즐 · 피아노 · 슬라이딩 퍼즐 · 갈고리 낚기 · 녹음 순서 · 짝 맞추기 · 주파수 · 순서 따라 하기 · 타이밍 · 분신사바
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

export function run(kind, opts = {}) {
  if (MG.active) return Promise.resolve({ ok: false });
  return ({ lockpick, dial, circuit, piano, slide, fishing, order, memory, tune, simon, timing, ouija })[kind](opts);
}
