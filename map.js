// 미니맵 / 전체 지도 렌더러
import { SLOTS, LAYOUT, GATE_Z } from './world.js';

const COL = { class: '#27384a', office: '#4a3a28', nurse: '#2f4a46', counsel: '#3f3a4f', library: '#3a4a2c', lab: '#2c4a3a', computer: '#2c3f55', music: '#4a2f3a', art: '#4a432c', toilet: '#38334d', stair: '#5a5a58' };

export function drawMap(ctx, W, H, o) {
  const { floor, cx, cz, scale: S, player, pins = [], lockers = [], labels = false, taken = [] } = o;
  const X = x => W / 2 + (x - cx) * S, Y = z => H / 2 + (z - cz) * S;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  const fillRect = (x1, z1, x2, z2, c) => { ctx.fillStyle = c; ctx.fillRect(X(x1), Y(z1), (x2 - x1) * S, (z2 - z1) * S); };
  const strokeRect = (x1, z1, x2, z2, c, w = 1) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.strokeRect(X(x1), Y(z1), (x2 - x1) * S, (z2 - z1) * S); };

  if (floor === 0) { // 외부
    fillRect(-50, -26, 50, 70, 'rgba(30,45,28,.55)');
    fillRect(-34, 16, 34, 60, 'rgba(110,88,60,.45)');
    fillRect(-3, 2, 3, 69, 'rgba(120,120,110,.4)');
    fillRect(28, 8, 48, 30, '#3a2a2a'); fillRect(-48, 8, -30, 22, '#3a3030');
    strokeRect(-50, -26, 50, 70, '#6a6a60', 1.5);
    fillRect(-4, GATE_Z - .6, 4, GATE_Z + .6, '#8a4a30');
    if (labels) {
      ctx.fillStyle = '#b8b4a4'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('운동장', X(0), Y(38)); ctx.fillText('체육관', X(38), Y(19)); ctx.fillText('급식실', X(-39), Y(15)); ctx.fillText('정문', X(0), Y(GATE_Z) - 8);
    }
  }
  if (floor === 3) {
    fillRect(-36.3, -9.9, 36.3, 1.75, '#33373a'); fillRect(-5, -4.5, 5, 1.9, '#555'); fillRect(26, -9.4, 33, -5.4, '#4a4033'); fillRect(-21.6, -7.6, -18.4, -4.4, '#5a3a2a');
    strokeRect(-36.3, -9.9, 36.3, 1.75, '#8a8a80', 1.5);
    if (labels) { ctx.fillStyle = '#c8c4b4'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('옥상 광장', X(-8), Y(-1)); ctx.fillText('관리실', X(29.5), Y(-7.4)); ctx.fillText('물탱크', X(-20), Y(-8)); ctx.fillText('계단실', X(0), Y(-2)); }
  } else {
    const lay = LAYOUT[floor];
    fillRect(-36.3, -1.75, 36.3, 1.75, '#3d403e');
    SLOTS.forEach((c, i) => {
      fillRect(c - 4, -9.6, c + 4, -1.75, COL[lay.types[i]] || '#333');
      strokeRect(c - 4, -9.6, c + 4, -1.75, '#0c0c0c', 1.5);
      if (labels) { ctx.fillStyle = '#d6d2c2'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(lay.names[i], X(c), Y(-5.8)); }
    });
    strokeRect(-36.3, -9.9, 36.3, 1.75, '#8a8a80', 2);
    if (floor === 0) { ctx.fillStyle = '#e6c14a'; ctx.fillRect(X(-1.5), Y(1.75) - 2, 3 * S, 4); }
  }
  if (floor < 3) { // 계단 표시
    ctx.fillStyle = '#d8d8d0'; ctx.fillRect(X(-1.2), Y(-8), 5 * S * .5, 6 * S * .4);
    if (labels) { ctx.fillStyle = '#111'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('계단', X(1.3), Y(-6.2)); }
  }
  lockers.forEach(l => { ctx.fillStyle = '#9a6ad8'; ctx.fillRect(X(l.x) - 2, Y(l.z) - 2, 4, 4); });
  pins.forEach(p => {
    ctx.fillStyle = p.done ? '#4cc07a' : '#e04048';
    ctx.beginPath(); ctx.arc(X(p.x), Y(p.z) - 4, 5, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(X(p.x) - 3, Y(p.z) - 2); ctx.lineTo(X(p.x) + 3, Y(p.z) - 2); ctx.lineTo(X(p.x), Y(p.z) + 5); ctx.fill();
    if (p.done) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(p.x) - 2.5, Y(p.z) - 4); ctx.lineTo(X(p.x) - .5, Y(p.z) - 1.5); ctx.lineTo(X(p.x) + 3, Y(p.z) - 6); ctx.stroke(); }
  });
  if (player) {
    ctx.translate(X(player.x), Y(player.z)); ctx.rotate(-player.yaw);
    ctx.fillStyle = '#f2c14e'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
