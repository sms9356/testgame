// HUD v2: 3D 목표 마커 · HUD 모드(F1: 전체 / 간소 / 숨김) · 상태 자동 숨김 · 위급 경고(손전등 배터리 · 체력) · 패널 디자인
//   공포 게임 HUD 레퍼런스(디제틱 · 미니멀)를 따라, 평소엔 화면을 비우고 필요한 순간에만 정보가 떠오르게 한다
const MODES = ['full', 'minimal', 'off'], LABEL = { full: 'HUD 전체', minimal: 'HUD 간소 (필요할 때만 표시)', off: 'HUD 숨김 (몰입 모드)' };
let C = null;

export function installHudV2(ctx) {
  C = { ...ctx, mode: 'minimal', idle: 0, last: '', playT: 0, v: new ctx.THREE.Vector3() };
  try { const m = localStorage.getItem('hud_mode'); if (MODES.includes(m)) C.mode = m; } catch (e) { /* ignore */ }
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'hudV2.css?v=305'; document.head.appendChild(css);
  const wp = document.createElement('div'); wp.id = 'wpMark'; wp.innerHTML = '<i></i><b></b>'; document.getElementById('hud').appendChild(wp); C.wp = wp;
  const tag = document.createElement('div'); tag.id = 'hudModeTag'; document.body.appendChild(tag); C.tag = tag;
  addEventListener('keydown', e => { if (e.code !== 'F1') return; e.preventDefault(); setMode(MODES[(MODES.indexOf(C.mode) + 1) % MODES.length], true); });
  setMode(C.mode, false);
  return C;
}

function setMode(m, announce) {
  C.mode = m; try { localStorage.setItem('hud_mode', m); } catch (e) { /* ignore */ }
  MODES.forEach(k => document.body.classList.toggle('hud-' + k, k === m));
  if (announce) { C.tag.textContent = LABEL[m] + '  ·  F1'; C.tag.classList.remove('show'); void C.tag.offsetWidth; C.tag.classList.add('show'); }
}

export function tickHudV2(dt) {
  if (!C) return; const { P, camera, objDir, getState } = C, playing = getState() === 'playing';
  if (playing) C.playT += dt;
  // 1) 상태 패널: 간소 모드에서 체력 · 기력이 가득하고 공포가 낮으면 6초 뒤 흐려진다 (바뀌면 다시 나타남)
  const key = `${Math.round(P.hp)}|${Math.round(P.stamina / 5)}|${Math.round((P.fear || 0) / 5)}|${P.light ? 1 : 0}`;
  if (key !== C.last) { C.last = key; C.idle = 0; } else C.idle += dt;
  const calm = P.hp >= 99 && P.stamina >= 98 && (P.fear || 0) < 15;
  document.body.classList.toggle('hud-calm', C.mode === 'minimal' && calm && C.idle > 6);
  document.body.classList.toggle('hud-hintsOld', C.playT > 90);   // 조작 안내는 처음 90초만 (전체 모드에선 항상)
  // 2) 위급 경고
  document.body.classList.toggle('hud-lowbat', P.light && P.battery < 20);
  document.body.classList.toggle('hud-lowhp', P.hp < 30);
  // 3) 3D 목표 마커: 같은 층 목표를 화면에 다이아몬드로 · 화면 밖이면 가장자리 화살표
  const d = playing && C.mode !== 'off' && C.objArrow() ? objDir() : null, wp = C.wp;
  if (!d || d.other || !d.pos || d.d < 2.5) { wp.className = ''; return; }
  const v = C.v.set(d.pos.x, d.pos.y, d.pos.z).project(camera), W = innerWidth, H = innerHeight;
  let x = (v.x * .5 + .5) * W, y = (-v.y * .5 + .5) * H; const behind = v.z > 1, M = 46;
  let off = behind || x < M || x > W - M || y < M || y > H - M;
  if (behind) { x = W - x; y = H - M; }
  if (off) { const cx = W / 2, cy = H / 2, dx = x - cx, dy = y - cy, s = Math.min((W / 2 - M) / Math.abs(dx || 1e-3), (H / 2 - M) / Math.abs(dy || 1e-3)); x = cx + dx * s; y = cy + dy * s;
    wp.querySelector('i').style.transform = `rotate(${Math.atan2(dy, dx) * 180 / Math.PI + 90}deg)`; } else wp.querySelector('i').style.transform = '';
  if (off) y = Math.min(y, H - 130);   // 화면 아래 가장자리는 소지품 슬롯 위로
  wp.className = 'on' + (off ? ' edge' : '') + (d.d < 8 ? ' near' : '');
  wp.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
  const t = Math.round(d.d) + 'm'; if (wp._t !== t) { wp._t = t; wp.querySelector('b').textContent = t; }
}
