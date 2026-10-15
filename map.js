// 미니맵 / 전체 지도 렌더러
import { SLOTS, LAYOUT, GATE_Z, ANNEX, LAYOUT_S, ANNEX_S, MAIN_ZS, WALKWAY } from './world.js';

const COL = { tech: '#3a4a3a', fusion: '#2c3f55', lang: '#2c3f4a', smart: '#2c3a55', club: '#3a4a2c', cooking: '#3a4a4a', craft: '#4a3f2f', broadcast: '#4a2a2a', boiler: '#4a3a2a', electric: '#4a4a2a', storage: '#3a3a30', records: '#3a4030', cleaning: '#2f3f4a', generator: '#4a2f2f', pump: '#2a3f4a', exit: '#5a2a2a', class: '#27384a', office: '#4a3a28', nurse: '#2f4a46', counsel: '#3f3a4f', library: '#3a4a2c', lab: '#2c4a3a', computer: '#2c3f55', music: '#4a2f3a', art: '#4a432c', toilet: '#38334d', stair: '#5a5a58' };

export function drawMap(ctx, W, H, o) {
  const { floor, cx, cz, scale: S, player, pins = [], lockers = [], labels = false, zones = [], doors = [], props = [], target = null, t = 0, mini = false } = o;
  const X = x => W / 2 + (x - cx) * S, Y = z => H / 2 + (z - cz) * S;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  const fillRect = (x1, z1, x2, z2, c) => { ctx.fillStyle = c; ctx.fillRect(X(x1), Y(z1), (x2 - x1) * S, (z2 - z1) * S); };
  const strokeRect = (x1, z1, x2, z2, c, w = 1) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.strokeRect(X(x1), Y(z1), (x2 - x1) * S, (z2 - z1) * S); };

  if (floor === 0) { // 외부
    fillRect(-50, -26, 50, 70, 'rgba(30,45,28,.55)');
    fillRect(-27, 15, 27, 59, 'rgba(110,88,60,.45)');
    { const r = 11.4 * S; ctx.strokeStyle = 'rgba(150,60,50,.75)'; ctx.lineWidth = 3.6 * S; ctx.beginPath(); ctx.moveTo(X(-11), Y(40) - r); ctx.lineTo(X(11), Y(40) - r); ctx.arc(X(11), Y(40), r, -Math.PI / 2, Math.PI / 2); ctx.lineTo(X(-11), Y(40) + r); ctx.arc(X(-11), Y(40), r, Math.PI / 2, Math.PI * 1.5); ctx.stroke(); }   // 트랙
    fillRect(-14, 17.1, -8, 20.1, '#6a6a60'); fillRect(5, 13.4, 22, 16.6, '#5a5a54'); fillRect(29, 38.5, 43, 53.5, 'rgba(120,60,50,.5)');   // 조회대 · 스탠드 · 농구장
    fillRect(-3, 2, 3, 69, 'rgba(120,120,110,.4)');
    fillRect(28, 12.5, 48, 34.5, '#3a2a2a'); fillRect(-48, 12.5, -30, 25, '#3a3030'); fillRect(-48, 31, -34, 51, '#2a3a46'); fillRect(19.15, 62.8, 24.35, 67.2, '#4a4a40');   // 체육관 · 급식실 · 수영장 · 경비실 (외관 실제 위치)
    strokeRect(-50, -26, 50, 70, '#6a6a60', 1.5);
    fillRect(-4, GATE_Z - .6, 4, GATE_Z + .6, '#8a4a30');
    if (labels) {
      ctx.fillStyle = '#b8b4a4'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('운동장', X(0), Y(36)); ctx.fillText('조회대', X(-11), Y(16.4)); ctx.fillText('스탠드', X(13.5), Y(12.6)); ctx.fillText('농구장', X(36), Y(46)); ctx.fillText('체육관', X(38), Y(23.5)); ctx.fillText('급식실', X(-39), Y(19)); ctx.fillText('수영장', X(-41), Y(41)); ctx.fillText('경비실', X(21.75), Y(65)); ctx.fillText('별관', X(0), Y(-19)); ctx.fillText('서문', X(-47), Y(32)); ctx.fillText('정문', X(0), Y(GATE_Z) - 8);
    }
  }
  if (floor === 5) {
    fillRect(28, 8, 48, 30, '#4a3a28'); fillRect(29, 8.3, 47, 12.3, '#6a2a30'); fillRect(43.2, 14, 47.7, 26, '#2a3a5a'); fillRect(28.3, 18.5, 29.8, 21.5, '#6a5a3a');
    strokeRect(28, 8, 48, 30, '#8a8a80', 2);
    if (labels) { ctx.fillStyle = '#e8e0c8'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('무대', X(38), Y(10.6)); ctx.fillText('농구 코트', X(37), Y(20)); ctx.fillText('관람석', X(45.5), Y(20)); ctx.fillText('기록석', X(29.8), Y(17.8)); ctx.fillText('출입문', X(38), Y(29.3)); }
  } else if (floor === 7) {
    fillRect(-48, 8, -30, 22, '#3a4038'); fillRect(-46.5, 12.5, -34, 13.4, '#6a6a60'); fillRect(-46.5, 9, -39.5, 11, '#4a4a48'); fillRect(-45, 15.5, -33.3, 16.5, '#6a5a3a'); fillRect(-45, 18.7, -33.3, 19.7, '#6a5a3a');
    strokeRect(-48, 8, -30, 22, '#8a8a80', 2);
    if (labels) { ctx.fillStyle = '#e8e8d8'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('조리실', X(-43), Y(9.6)); ctx.fillText('배식대', X(-38), Y(12.6)); ctx.fillText('식당 홀', X(-39), Y(17.6)); ctx.fillText('창고', X(-32), Y(9.4)); ctx.fillText('출입문', X(-39), Y(21.6)); }
  } else if (floor === 6) {
    fillRect(-50, 20, -34, 58, '#3a4048'); fillRect(-45.6, 32, -37.4, 45.5, '#2a6a86');
    fillRect(-50, 20, -41.65, 30.3, '#44506a'); fillRect(-41.35, 20, -34, 30.3, '#3a5a6a'); fillRect(-50, 50, -34, 58, '#4a4438');
    fillRect(-50, 33.5, -47.25, 46.5, '#5a5048'); strokeRect(-50, 20, -34, 58, '#8a8a80', 2);
    [[-50, 30, -34, 30.3], [-41.65, 20, -41.35, 30.3], [-50, 50, -34, 50.3], [-43.5, 50.3, -43.2, 58]].forEach(([a, b, c, d]) => fillRect(a, b, c, d, '#8a8a80'));
    if (labels) { ctx.fillStyle = '#e8f0f0'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('메인 수조 (6레인)', X(-41.5), Y(38.5)); ctx.fillText('탈의실', X(-46), Y(25)); ctx.fillText('샤워실', X(-37.7), Y(25)); ctx.fillText('장비창고', X(-46.6), Y(54)); ctx.fillText('기계실', X(-38.6), Y(54)); ctx.fillText('관람석', X(-48.6), Y(40)); ctx.fillText('관리', X(-35.4), Y(34.6)); ctx.fillText('출입구', X(-35), Y(38.9)); }
  } else if (floor === 3) {
    fillRect(-36.3, -9.9, 36.3, 1.75, '#33373a'); fillRect(-5, -4.5, 5, 1.9, '#555'); fillRect(26, -9.4, 33, -5.4, '#4a4033'); fillRect(-21.6, -7.6, -18.4, -4.4, '#5a3a2a');
    strokeRect(-36.3, -9.9, 36.3, 1.75, '#8a8a80', 1.5);
    if (labels) { ctx.fillStyle = '#c8c4b4'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('옥상 광장', X(-8), Y(-1)); ctx.fillText('관리실', X(29.5), Y(-7.4)); ctx.fillText('물탱크', X(-20), Y(-8)); ctx.fillText('계단실', X(0), Y(-2)); }
  } else {
    const an = floor >= 8, lay = an ? ANNEX.floors[floor - 8] : LAYOUT[floor], sl = an ? ANNEX.slots : SLOTS, hx = an ? 20.3 : 36.3;
    fillRect(-hx, -1.75, hx, 1.75, '#3d403e');
    sl.forEach((c, i) => {
      fillRect(c - 4, -9.6, c + 4, -1.75, COL[lay.types[i]] || '#333');
      strokeRect(c - 4, -9.6, c + 4, -1.75, '#0c0c0c', 1.5);
      if (labels) { ctx.fillStyle = '#d6d2c2'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(lay.names[i], X(c), Y(-5.8)); }
    });
    const LS = an ? ANNEX_S[floor - 8] : floor <= 2 && LAYOUT_S[floor];
    if (LS) sl.forEach((c, i) => {   // 남쪽 방 줄
      const t = LS.types[i]; fillRect(c - 4, 1.75, c + 4, 9.6, t === 'lobby' || t === 'lobbyA' || t === 'hall' ? '#4a4c48' : COL[t] || '#36383a');
      strokeRect(c - 4, 1.75, c + 4, 9.6, '#0c0c0c', 1.5);
      if (labels) { ctx.fillStyle = '#d6d2c2'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(LS.names[i], X(c), Y(5.8)); }
    });
    strokeRect(-hx, -9.9, hx, LS ? MAIN_ZS : 1.75, '#8a8a80', 2);
    if (floor === 4) { fillRect(28, 1.75, 36, 9.9, '#3a2a48'); strokeRect(28, 1.75, 36, 9.9, '#0c0c0c', 1.5); if (labels) { ctx.fillStyle = '#d6d2c2'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('비밀 자료실', X(32), Y(6)); } }
    if (floor === 0) { const W = WALKWAY; fillRect(W.x1, W.z1 - 4, W.x2, W.z2, '#3a4248'); strokeRect(W.x1, W.z1 - 4, W.x2, W.z2, '#8a8a80', 1); if (labels) { ctx.fillStyle = '#c8c4b4'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('별관 연결 통로 ↑', X((W.x1 + W.x2) / 2), Y(W.z1 - 1.5)); } }
    if (floor === 0 || floor === 8) { ctx.fillStyle = '#e6c14a'; ctx.fillRect(X(-1.5), Y(MAIN_ZS) - 2, 3 * S, 4); }
  }
  if (floor < 3 || floor === 4 || floor >= 8) { // 계단 표시
    const sx = floor >= 8 ? -17 : -1.2;
    ctx.fillStyle = '#d8d8d0'; ctx.fillRect(X(sx), Y(-8), 5 * S * .5, 6 * S * .4);
    if (labels) { ctx.fillStyle = '#111'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('계단', X(sx + 2.5), Y(-6.2)); }
  }
  lockers.forEach(l => { ctx.fillStyle = '#9a6ad8'; ctx.fillRect(X(l.x) - 2, Y(l.z) - 2, 4, 4); });
  // 문 상태 (열림: 초록 / 닫힘: 빨강)
  doors.forEach(d => { ctx.fillStyle = d.open ? '#5fc47a' : '#b04040'; const w = Math.max(4, (d.slide ? 1.4 : .9) * S); ctx.fillRect(X(d.x) - w / 2, Y(d.z) - 1.5, w, 3); });
  // 장치 · 녹음기
  props.forEach(p => {
    const x = X(p.x), y = Y(p.z); ctx.fillStyle = p.done ? '#6a5a7a' : '#c89af0';
    ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 4, y); ctx.closePath(); ctx.fill();
    if (labels && p.label) { ctx.fillStyle = '#d8c8e8'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(p.label, x + 6, y + 4); }
  });
  // 구역 미션 표시 (5대 구역 · 실내 연결복도): 금색 테두리 이름표
  if (labels) zones.forEach(([zx, zz, t]) => { const x = X(zx), y = Y(zz); ctx.font = 'bold 12px sans-serif'; const w = ctx.measureText(t).width + 12; ctx.fillStyle = 'rgba(20,16,8,.82)'; ctx.fillRect(x - w / 2, y - 9, w, 18); ctx.strokeStyle = '#e8c870'; ctx.lineWidth = 1.2; ctx.strokeRect(x - w / 2, y - 9, w, 18); ctx.fillStyle = '#f0d890'; ctx.textAlign = 'center'; ctx.fillText(t, x, y + 4); });
  pins.forEach(p => {
    ctx.fillStyle = p.done ? '#4cc07a' : '#e04048';
    ctx.beginPath(); ctx.arc(X(p.x), Y(p.z) - 4, 5, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(X(p.x) - 3, Y(p.z) - 2); ctx.lineTo(X(p.x) + 3, Y(p.z) - 2); ctx.lineTo(X(p.x), Y(p.z) + 5); ctx.fill();
    if (p.done) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(p.x) - 2.5, Y(p.z) - 4); ctx.lineTo(X(p.x) - .5, Y(p.z) - 1.5); ctx.lineTo(X(p.x) + 3, Y(p.z) - 6); ctx.stroke(); }
  });
  if (target) { // 현재 목표 (깜빡이는 별)
    const x = X(target.x), y = Y(target.z), r = (mini ? 6 : 9) * (1 + .15 * Math.sin(t * 5));
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#f2c14e'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }
  if (player) {
    ctx.translate(X(player.x), Y(player.z)); ctx.rotate(-player.yaw);
    ctx.fillStyle = '#f2c14e'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
