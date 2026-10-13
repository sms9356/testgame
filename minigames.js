// 미니게임: 자물쇠 따기 · 다이얼 자물쇠 · 배선 퍼즐 · 피아노 · 슬라이딩 퍼즐 · 갈고리 낚기
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
function dial({ code, title = '다이얼 자물쇠', hint = '' }) {
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
    else { sfx.buzz(); status('열리지 않는다', 'err'); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); }
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
function piano({ melody, sheet }) {
  const p = open('피아노', `숫자 키 <b>1~8</b> 또는 건반 클릭 · 악보의 선율을 그대로 쳐라${sheet ? `<br>악보: <b style="color:#e8d8a8">${sheet}</b>` : '<br><span style="color:#a06a6a">어딘가에 악보가 있었을 것 같다…</span>'}`);
  const kb = document.createElement('div'); kb.className = 'pianoKb'; $('mgBody').appendChild(kb);
  const disp = document.createElement('div'); disp.className = 'pianoDisp'; $('mgBody').appendChild(disp);
  let idx = 0, played = [];
  kb.innerHTML = NOTES.map(([n], i) => `<button data-i="${i}"><small>${i + 1}</small>${n}</button>`).join('');
  const press = i => {
    const b = kb.children[i]; b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 160);
    sfx.note(NOTES[i][1]); played.push(NOTES[i][0]);
    if (i === melody[idx]) { idx++; if (idx === melody.length) { setTimeout(() => close(true), 400); } }
    else { idx = i === melody[0] ? 1 : 0; if (played.length > 1) status('…음이 어긋났다', 'err'); played = idx ? [NOTES[i][0]] : []; }
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

export function run(kind, opts = {}) {
  if (MG.active) return Promise.resolve({ ok: false });
  return ({ lockpick, dial, circuit, piano, slide, fishing })[kind](opts);
}
