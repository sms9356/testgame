import { GUARD_LAYOUT, GUARD_SPUR } from './guardRoomLayout.js';
// 미니맵 / 전체 지도 렌더러
import { SLOTS, LAYOUT, GATE_Z, ANNEX, LAYOUT_S, ANNEX_S, MAIN_ZS, WALKWAY, NORTH_Z, ANNEX_DZ, MEGA } from './world.js';

const COL = { tech: '#3a4a3a', fusion: '#2c3f55', lang: '#2c3f4a', smart: '#2c3a55', club: '#3a4a2c', cooking: '#3a4a4a', craft: '#4a3f2f', broadcast: '#4a2a2a', boiler: '#4a3a2a', electric: '#4a4a2a', storage: '#3a3a30', records: '#3a4030', cleaning: '#2f3f4a', generator: '#4a2f2f', pump: '#2a3f4a', exit: '#5a2a2a', class: '#27384a', office: '#4a3a28', nurse: '#2f4a46', counsel: '#3f3a4f', library: '#3a4a2c', lab: '#2c4a3a', computer: '#2c3f55', music: '#4a2f3a', art: '#4a432c', toilet: '#38334d', stair: '#5a5a58' };

export function drawMap(ctx, W, H, o) {
  const { floor, cx, cz, scale: S, player, labels = false, doors = [] } = o;
  const X = x => W / 2 + (x - cx) * S, Y = z => H / 2 + (z - cz) * S;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  const fillRect = (x1, z1, x2, z2, c) => { ctx.fillStyle = c; ctx.fillRect(X(x1), Y(z1), (x2 - x1) * S, (z2 - z1) * S); };
  const campusLabels = [], campusLab = (t, x, y) => { if (t) campusLabels.push([t, x, y]); };
  const strokeRect = (x1, z1, x2, z2, c, w = 1) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.strokeRect(X(x1), Y(z1), (x2 - x1) * S, (z2 - z1) * S); };

  // 3D 입체 건물 볼륨 렌더러 (평면 fillRect 는 기존 테스트 호환을 위해 먼저 그리고, 그 위에 3D 아이소메트릭 입체 측벽·지붕·고도 음영을 렌더링한다)
  const box3D = (x1, z1, x2, z2, h, baseCol, roofCol, sideCol) => {
    fillRect(x1, z1, x2, z2, baseCol);
    const ox = -h * .28, oy = -h * .38;
    // 3D 동쪽/남쪽 입체 측벽 폴리곤
    ctx.fillStyle = sideCol;
    ctx.beginPath();
    ctx.moveTo(X(x1), Y(z2)); ctx.lineTo(X(x2), Y(z2)); ctx.lineTo(X(x2), Y(z1));
    ctx.lineTo(X(x2 + ox), Y(z1 + oy)); ctx.lineTo(X(x2 + ox), Y(z2 + oy)); ctx.lineTo(X(x1 + ox), Y(z2 + oy));
    ctx.closePath(); ctx.fill();
    // 3D 상단 지붕 면
    fillRect(x1 + ox, z1 + oy, x2 + ox, z2 + oy, roofCol);
    strokeRect(x1 + ox, z1 + oy, x2 + ox, z2 + oy, 'rgba(235,240,245,.55)', 1.1);
  };

  if (floor === 0) { // 외부 (15,000평 3D 캠퍼스 마스터플랜 — ①학술·건물 섹션 / ②운동·스포츠 섹션 / ③주차·교통 섹션)
    fillRect(-114, -108, 114, 72, 'rgba(22,34,22,.65)');
    fillRect(-50, NORTH_Z, 50, 70, 'rgba(30,45,28,.55)');
    // 3대 섹션 구획 하이라이트 존
    strokeRect(-104, -100, 104, -12, 'rgba(110,185,235,.28)', 1.5); // ① 학술·생활 건물 섹션
    strokeRect(-104, -22, 48, 60, 'rgba(110,220,150,.25)', 1.5);     // ② 종합 운동·스포츠 섹션
    strokeRect(50, -52, 98, 50, 'rgba(235,195,95,.30)', 1.5);        // ③ 동쪽 스포츠 섹션 (캠퍼스 재배치)

    fillRect(-27, 15, 27, 59, 'rgba(110,88,60,.45)');
    { const r = 11.4 * S; ctx.strokeStyle = 'rgba(150,60,50,.75)'; ctx.lineWidth = 3.6 * S; ctx.beginPath(); ctx.moveTo(X(-11), Y(40) - r); ctx.lineTo(X(11), Y(40) - r); ctx.arc(X(11), Y(40), r, -Math.PI / 2, Math.PI / 2); ctx.lineTo(X(-11), Y(40) + r); ctx.arc(X(-11), Y(40), r, Math.PI / 2, Math.PI * 1.5); ctx.stroke(); }   // 트랙
    fillRect(-14, 17.1, -8, 20.1, '#6a6a60'); fillRect(5, 13.4, 22, 16.6, '#5a5a54'); fillRect(51, -.5, 65, 14.5, 'rgba(120,60,50,.5)');   // 조회대 · 스탠드 · 농구장 (동쪽)
    fillRect(-3, 2, 3, 69, 'rgba(120,120,110,.4)');
    // 기존 건물 평면 + 3D 입체 볼륨
    fillRect(74, -50, 94, -28, '#3a2a2a'); box3D(74, -50, 94, -28, 8.0, '#3a2a2a', '#5c4238', '#281c18');   // 체육관 (동쪽)
    box3D(-59, 29.8, -41, 53.8, 7.5, '#4a3a28', '#68523a', '#2c2218');   // 대강당 (운동장 서남쪽)
    fillRect(-67.25, 4, -54.75, 22, '#3a3030'); box3D(-67.25, 4, -54.75, 22, 4.8, '#3a3030', '#584842', '#261e1c');   // 급식실 (운동장 서쪽)
    fillRect(51, 25, 65, 45, '#2a3a46');   box3D(51, 25, 65, 45, 6.4, '#2a3a46', '#3c586c', '#1a2630');   // 수영장 (동쪽)
    fillRect(GUARD_SPUR.x1, GUARD_SPUR.z1, GUARD_SPUR.x2, GUARD_SPUR.z2, '#55554b');
    // 경비동: 관제실 · 열쇠보관실 (북) + 당직실 (남, 예전 경비실 자리)
    box3D(4.8, 59.6, 11.4, 64.95, 2.8, '#4a4a40', '#6a6a5c', '#2c2c26'); box3D(GUARD_LAYOUT.originX, GUARD_LAYOUT.originZ - GUARD_LAYOUT.depth, GUARD_LAYOUT.originX + GUARD_LAYOUT.width, GUARD_LAYOUT.originZ, 2.8, '#4a4a40', '#6a6a5c', '#2c2c26');
    strokeRect(8.0, 59.6, 8.0, 64.95, '#9a9a8a', 1);
    if (!o.rb) {   // 예전 별관 · 본관 측면 볼륨 (재건축 전 지도)
      fillRect(-20, -25 - ANNEX_DZ, 20, -13.5 - ANNEX_DZ, '#3a4248');
      strokeRect(-20, -25 - ANNEX_DZ, 20, -13.5 - ANNEX_DZ, '#8a8a80', 1.5);
      box3D(-28, -25 - ANNEX_DZ, 28, -13.5 - ANNEX_DZ, 12.0, '#3a4248', '#52626e', '#242c32');
      box3D(-45.5, -8.8, -36.3, 8.8, 12.0, '#3a3832', '#5c5850', '#24221e');
      box3D(36.3, -8.8, 45.5, 8.8, 12.0, '#3a3832', '#5c5850', '#24221e');
    }
    { const r = MEGA.court; fillRect(r.x - r.w / 2, r.z - r.d / 2, r.x + r.w / 2, r.z + r.d / 2, '#354a36'); strokeRect(r.x - r.w / 2, r.z - r.d / 2, r.x + r.w / 2, r.z + r.d / 2, '#8a8a80', 1.5); }
    strokeRect(-50, NORTH_Z, 50, 70, '#6a6a60', 1.5);
    fillRect(-4, GATE_Z - .6, 4, GATE_Z + .6, '#8a4a30');
    // 캠퍼스 타일 인도 네트워크 (서쪽 끝 서문 x=-114, z=55.6 직결 및 전 캠퍼스 완전 연결!) & 3대 섹션 건물 3D 입체 볼륨
    [[-72.2, -69.4, -45.0, 57.2], [69.3, 71.7, -51.5, 30.0], [69.3, 70.6, 30.0, 48.0], [69.3, 71.7, 48.0, 57.2], [-69.4, 71.7, -35.2, -32.4], [-113.8, -27.2, 54.0, 57.2], [27.6, 69.3, 54.0, 57.2], [-29.6, -27.2, 11.0, 54.0], [25.0, 27.6, 11.0, 54.0], [-39.6, -37.0, -32.4, 11.0], [37.0, 39.6, -32.4, 10.4], [-29.6, 25.0, 11.0, 12.6], [-10.6, -7.4, -77.0, -35.2],
     [-87.5, -72.2, -35.0, -32.4], [-89.4, -72.2, -10.7, -7.9], [-89.4, -72.2, 22.0, 24.8], [-89.5, -86.5, 49.0, 54.0], [-69.4, -29.6, 26.6, 29.4], [71.7, 85.4, -27.9, -25.1], [71.7, 73.8, -18.5, -15.5], [65.0, 69.3, 5.6, 8.4], [65.0, 69.3, 33.6, 36.4], [60.0, 69.3, -16.2, -13.4], [36.6, 39.4, 37.0, 54.0], [71.7, 85.4, 50.4, 53.2], [65.6, 69.3, -46.2, -43.4], [33.6, 36.4, -45.0, -35.2]]
      .forEach(([x1, x2, z1, z2]) => fillRect(x1, z1, x2, z2, 'rgba(145,140,125,.42)'));   // 새 인도망 (campusPaths.js NET)
    fillRect(-114.6, 51.4, -113.2, 59.8, '#8a4a30'); // 서쪽 끝 외곽 서문(西門, x=-114, z=55.6)
    box3D(58, -53, 65.5, -47, 3.6, '#2a4a38', '#467a5c', '#1a3024');   // 생태온실 (동북 학술정원)
    box3D(58.9, 14.8, 68.1, 21.2, 3.8, '#4a362c', '#7a5838', '#2c1e16'); // 1998 학우매점 (동남 학술·복지광장)
    box3D(31.2, -52, 38.8, -45, 4.2, '#38424c', '#586878', '#222830'); // 야외음악당
    box3D(-97, -49, -75, -35, 9.6, '#4a322c', '#6e4a40', '#2c1c18');   // 청운학사(2F 기숙사) 3D 볼륨
    fillRect(-25, -95, 7, -77, '#1c4e58'); strokeRect(-25, -95, 7, -77, '#68b8c8', 1.2); // 청운호 수변공원
    box3D(-98, 6, -78, 22, 9.5, '#2c3e54', '#4c6a8c', '#1a2636');     // 과학천문관 3D 볼륨 (서쪽)
    box3D(-95.8, -21.3, -80.2, -10.7, 5.2, '#5a382e', '#7e5244', '#36201a'); // 서문고 역사관(개교기념관) 3D 볼륨 (서쪽)
    fillRect(51.5, -25.5, 59.5, -17.5, '#8a7248'); strokeRect(51.5, -25.5, 59.5, -17.5, '#d8c088', 1.1); // 씨름장 모래판
    box3D(73, 30, 95, 48, 9.4, '#4a3628', '#6c503c', '#2c2018');       // 중앙학술정보관(대도서관) 3D 볼륨
    fillRect(74, -25, 94, -9, '#224868'); strokeRect(74, -25, 94, -9, '#78b0d8', 1.2); // 테니스·양궁 코트 (동쪽)
    fillRect(72, -5, 96, 21, '#244a38'); strokeRect(72, -5, 96, 21, '#68b088', 1.2);   // 야구 스타디움 (동쪽)
    box3D(-99, 35, -77, 49, 9.0, '#48342e', '#6a4c42', '#2a1e1a');     // 학생회관·동아리관 3D 볼륨 (인도 z=54~57.2 북쪽에 깔끔히 배치!)
    fillRect(-13.8, 61.2, -9.2, 65.8, '#4a3828');                                                      // 청운정(육각정)
    if (labels) {
      // 캠퍼스 이름표는 모아 두었다가 건물을 다 그린 뒤 겹치지 않게 한 번에 (경비동 · 경비실 겹침, 건물에 가려 잘리던 이름 방지)
      campusLab('운동장(트랙·축구장)', X(0), Y(36)); campusLab('조회대', X(-11), Y(16.4)); campusLab('스탠드', X(13.5), Y(12.6));
      campusLab('야외농구장', X(58), Y(7)); campusLab('체육관', X(84), Y(-39)); campusLab('급식실', X(-61), Y(13)); campusLab('수영장', X(58), Y(35));
      campusLab('경비동', X(8.1), Y(62.4)); campusLab('경비실·당직실', X(GUARD_LAYOUT.cx), Y(GUARD_LAYOUT.cz)); campusLab(o.rb ? '본관(1~4F)' : '', X(0), Y(-5.2)); campusLab(o.rb ? '별관(1~3F)' : '별관(1~3F)', X(0), Y(o.rb ? -30 : -19.25 - ANNEX_DZ));
      campusLab('대강당', X(-50), Y(42)); campusLab('중정', X(MEGA.court.x), Y(MEGA.court.z));
      campusLab('◀ 서문(탈출구)', X(-106), Y(55.6)); campusLab('정문', X(0), Y(GATE_Z) - 8);
      campusLab('생태온실', X(62), Y(-50)); campusLab('학우매점', X(63.5), Y(18)); campusLab('야외음악당', X(35.0), Y(-48.5));
      campusLab('청운정', X(-11.5), Y(63.5));
      campusLab('청운학사(2F기숙사)', X(-86), Y(-42)); campusLab('청운호·호심정', X(-9), Y(-86));
      campusLab('과학천문관', X(-88), Y(14)); campusLab('서문고역사관', X(-88), Y(-16)); campusLab('수돗가', X(58), Y(-10)); campusLab('씨름장', X(55.5), Y(-21.5)); campusLab('중앙도서관', X(84), Y(39));
      campusLab('테니스·양궁장', X(84), Y(-17)); campusLab('야구스타디움', X(84), Y(8)); campusLab('학생회관', X(-88), Y(42));
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
    fillRect(-36.3, -9.9, 36.3, MAIN_ZS, '#33373a'); fillRect(-5, -4.5, 5, 1.9, '#555'); fillRect(26, -9.4, 33, -5.4, '#4a4033'); fillRect(-21.6, -7.6, -18.4, -4.4, '#5a3a2a');
    strokeRect(-36.3, -9.9, 36.3, MAIN_ZS, '#8a8a80', 1.5);
    if (labels) { ctx.fillStyle = '#c8c4b4'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('옥상 광장', X(-8), Y(-1)); ctx.fillText('관리실', X(29.5), Y(-7.4)); ctx.fillText('물탱크', X(-20), Y(-8)); ctx.fillText('계단실', X(0), Y(-2)); }
  } else {
    const an = floor >= 8, lay = an ? ANNEX.floors[floor - 8] : LAYOUT[floor], sl = an ? ANNEX.slots : SLOTS, hx = an ? 20.3 : 36.3;
    fillRect(-hx, -1.75, hx, 1.75, '#3d403e');
    sl.forEach((c, i) => {
      if (floor === 2 && i === 0) return;
      if (floor === 2 && i === 1) {
        fillRect(-36, -9.6, -20, -1.75, COL.broadcast);
        strokeRect(-36, -9.6, -20, -1.75, '#0c0c0c', 1.5);
        strokeRect(-28.05, -9.6, -27.95, -4.0, 'rgba(140,210,245,.65)', 1.2);
        if (labels) {
          ctx.fillStyle = '#f2dec8'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('방송편집실 (주조정실)', X(-32), Y(-5.8));
          ctx.fillText('방송실 (레코딩룸)', X(-24), Y(-5.8));
        }
        return;
      }
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
    // 실내 층 3D 아이소메트릭 입체 외벽 테두리
    box3D(-hx, -9.9, hx, -9.5, 2.2, '#5a6064', '#889298', '#2a3034');
    strokeRect(-hx, -9.9, hx, LS ? MAIN_ZS : 1.75, '#9ab0be', 2);
    if (floor === 4) { fillRect(28, 1.75, 36, 9.9, '#3a2a48'); strokeRect(28, 1.75, 36, 9.9, '#0c0c0c', 1.5); if (labels) { ctx.fillStyle = '#d6d2c2'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('비밀 자료실', X(32), Y(6)); } }
    if (floor === 4) { fillRect(12, -34, 24, -14, '#3a3e3c'); strokeRect(12, -34, 24, -14, '#8a8a80', 1.5); if (labels) { ctx.fillStyle = '#d8c890'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('지하 보존서고', X(18), Y(-24)); } }
    if (floor === 0 || floor === 1) { const W = WALKWAY; fillRect(W.x1, W.z1, W.x2, W.z2, floor === 1 ? '#364a54' : '#3a4248'); strokeRect(W.x1, W.z1, W.x2, W.z2, '#8a8a80', 1); if (labels) { ctx.fillStyle = '#c8c4b4'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(floor === 1 ? '2층 구름다리 ↑' : '필로티 통로 (2F 구름다리)', X((W.x1 + W.x2) / 2), Y((W.z1 + W.z2) / 2)); } }
    if (floor === 0 || floor === 8) { ctx.fillStyle = '#e6c14a'; ctx.fillRect(X(-1.5), Y(MAIN_ZS) - 2, 3 * S, 4); }
  }
  if (floor < 3 || floor === 4 || floor >= 8) { // 계단 표시
    const sx = floor >= 8 ? -17 : -1.2;
    ctx.fillStyle = '#d8d8d0'; ctx.fillRect(X(sx), Y(-8), 5 * S * .5, 6 * S * .4);
    if (labels) { ctx.fillStyle = '#111'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('계단', X(sx + 2.5), Y(-6.2)); }
  }
  if(o.elevatorBay){const b=o.elevatorBay;fillRect(b.front,b.z1,b.rear,b.z2,'#23282c');strokeRect(b.front,b.z1,b.rear,b.z2,'#83919a');
    if(labels){ctx.fillStyle='#b5c8d0';ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText('승강로',X((b.front+b.rear)/2),Y(b.doorZ));}}
  // 재건축 건물 (?rb): 예전 본관 · 별관 자리를 지우고 새 건물 외곽 · 복도 · 방(지금 층)을 그린다
  if (o.rb) {
    const poly = (pts, c, st) => { ctx.beginPath(); pts.forEach(([x, z], i) => i ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z))); ctx.closePath(); if (c) { ctx.fillStyle = c; ctx.fill(); } if (st) { ctx.strokeStyle = st; ctx.lineWidth = 1.5; ctx.stroke(); } };
    o.rb.clear.forEach(r => fillRect(r.x1, r.z1, r.x2, r.z2, '#1f2622'));
    o.rb.shells.forEach(pts => poly(pts, '#3a3e40', '#9ab0be'));
    o.rb.rooms.forEach(r => poly(r.pts, r.here ? '#4a5a4e' : r.stair ? '#55584e' : r.hall ? '#2a2e30' : '#30363a', '#0c0c0c'));
    if (o.rb.furn && S > 6) o.rb.furn.forEach(pts => poly(pts, 'rgba(150,140,120,.28)', 'rgba(200,190,170,.25)'));   // 가구 윤곽 (확대했을 때만)
    if (labels) o.rb.rooms.forEach(r => { if (!r.label || r.stair) return; const xs = r.pts.map(p => X(p[0])), rw = Math.max(...xs) - Math.min(...xs) - 4; let lab = r.label, fs = S > 6 ? 12 : 11; ctx.textAlign = 'center';   // 좁은 방은 글자를 줄이거나 줄임말로
      const fit = () => { ctx.font = `${fs >= 12 ? 'bold ' : ''}${fs}px sans-serif`; return ctx.measureText(lab).width <= rw; };
      if (!fit()) { fs = 9; if (!fit()) { lab = lab.replace(/남자 화장실/, '남WC').replace(/여자 화장실/, '여WC').replace(/중앙 계단/, '계단').replace(/중앙 현관/, '현관').replace(/ · 행정실/, '').replace(/학년 (\d+)반/, '-$1'); if (!fit()) return; } } const w = ctx.measureText(lab).width + 8; ctx.fillStyle = 'rgba(10,12,14,.55)'; ctx.fillRect(X(r.cx) - w / 2, Y(r.cz) - 9, w, 14); ctx.fillStyle = '#e6e0cc'; ctx.fillText(lab, X(r.cx), Y(r.cz) + 2); });
    (o.rb.icons || []).forEach(ic => { const x = X(ic.x), y = Y(ic.z), sz = Math.max(9, Math.min(16, S * 1.3)); ctx.save(); ctx.translate(x, y); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const badge = (bg, fg, txt) => { ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, sz * .62, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = fg; ctx.font = `bold ${Math.round(sz * .62)}px sans-serif`; ctx.fillText(txt, 0, 1); };
      if (ic.t === 'stair') badge('#c8a040', '#1a1408', '⇅'); else if (ic.t === 'elev') badge('#4a8ac8', '#fff', 'EV'); else if (ic.t === 'exit') badge('#1fa64a', '#fff', '🚪'); else badge('#d0c8b0', '#1a1a1a', ic.t === 'bridge' ? '⇄' : '▲');
      if (ic.label && labels) { ctx.font = '10px sans-serif'; ctx.fillStyle = '#f0e8d0'; ctx.fillText(ic.label, 0, sz * .62 + 8); } ctx.restore(); });
    if (labels && o.rb.title) { ctx.save(); ctx.fillStyle = 'rgba(10,16,22,.8)'; ctx.fillRect(14, 56, 230, 58); ctx.strokeStyle = 'rgba(130,195,235,.5)'; ctx.strokeRect(14, 56, 230, 58); ctx.fillStyle = '#e8f2f8'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('📍 ' + o.rb.title, 24, 77);
      ctx.font = '11px sans-serif'; ctx.fillStyle = '#c8a040'; ctx.fillText('⇅ 계단', 24, 99); ctx.fillStyle = '#7ab0e0'; ctx.fillText('EV 엘리베이터', 72, 99); ctx.fillStyle = '#5fd080'; ctx.fillText('🚪 비상구', 170, 99); ctx.restore(); }
  }
  // 목표 방 강조 (정확한 좌표 대신 방 전체를 은은하게 깜빡) — 새 본관 · 별관 평면
  if (o.rb && o.target) { const T = o.target, inPoly = pts => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > T.z) !== (zj > T.z) && T.x < (xj - xi) * (T.z - zi) / (zj - zi) + xi) c = !c; } return c; };
    const r = o.rb.rooms.find(q => !q.hall && inPoly(q.pts)); if (r) { const a = .45 + .35 * Math.sin((o.t || 0) * 4); ctx.beginPath(); r.pts.forEach(([x, z], i) => i ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z))); ctx.closePath(); ctx.fillStyle = `rgba(242,193,78,${a * .35})`; ctx.fill(); ctx.strokeStyle = `rgba(242,193,78,${a + .2})`; ctx.lineWidth = 2.5; ctx.stroke(); ctx.lineWidth = 1;
      if (labels) { const cx = r.pts.reduce((s, p) => s + p[0], 0) / r.pts.length, cz = r.pts.reduce((s, p) => s + p[1], 0) / r.pts.length; ctx.fillStyle = '#f2c14e'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', X(cx), Y(cz) - 12); } } }
  if (campusLabels.length) {   // 캠퍼스 이름표: 겹치면 위아래로 비켜 놓고, 그래도 자리가 없으면 생략 · 어두운 테두리로 건물 위에서도 읽히게
    ctx.save(); ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; const placed = [];
    for (const [t, x, y] of campusLabels) {
      const w = ((ctx.measureText && ctx.measureText(t).width) || t.length * 7) + 8; let yy = null;
      for (const dy of [0, -13, 13, -26, 26]) { const r = { x1: x - w / 2, x2: x + w / 2, y1: y + dy - 11, y2: y + dy + 3 }; if (!placed.some(p => r.x1 < p.x2 && r.x2 > p.x1 && r.y1 < p.y2 && r.y2 > p.y1)) { placed.push(r); yy = y + dy; break; } }
      if (yy == null) continue;
      if (ctx.strokeText) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(6,10,14,.85)'; ctx.strokeText(t, x, yy); }
      ctx.fillStyle = '#e6ecf0'; ctx.fillText(t, x, yy);
    }
    ctx.restore();
  }
  // Discovery-first: items, devices, lockers and exact objective coordinates are not plotted.
  // 문 상태 (열림: 초록 / 닫힘: 빨강)
  doors.forEach(d => { ctx.fillStyle = d.transition ? '#74b9e8' : d.open ? '#5fc47a' : '#b04040'; const w = Math.max(4, (d.slide ? 1.4 : .9) * S); ctx.fillRect(X(d.x) - w / 2, Y(d.z) - 1.5, w, 3); });
  if (player) {
    ctx.translate(X(player.x), Y(player.z)); ctx.rotate(-player.yaw);
    ctx.fillStyle = '#f2c14e'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
