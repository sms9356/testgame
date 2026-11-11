// 재건축 본관 (2008년 한국 공립 고등학교 표준 설계 기준)
//   남향 교실 + 북측 편복도, 철근콘크리트 라멘조(기둥 9m 간격), 층고 3.6m · 반자높이 2.7m
//   교실 9.0m × 7.5m, 복도 폭 2.7m, 양 끝 U자 계단실(6m × 9m), 중앙 화장실 · 세면대 코어
//   전기(분전반 · 2등용 형광등 · 콘센트 · 스위치) · 소방(소화전함 · 소화기 · 감지기 · 유도등 · 방화문) · 수도(세면대 · 배관)
import * as THREE from '../vendor/three.module.js';
import { mergeGeometries } from '../vendor/addons/utils/BufferGeometryUtils.js';
import { makeFlag } from '../tex.js?v=429';
import * as PT from './periodTex.js?v=429';
import { collectRefs, dedupeMaterials, batchStaticChildren } from './staticBatch.js?v=429';
// 교실 앞면 꾸밈 공용 (반 이름 · 텍스처 캐시)
const NAMES = ['김민수', '이서연', '박지훈', '최유진', '정하늘', '강도윤', '조수아', '윤재현', '장예린', '임태호', '한소영', '오준서', '서지민', '신동혁', '권나연', '황민재', '안채원', '송우진', '전다은', '홍석진'];
let flagTex = null; const decorTex = new Map();
// 2008년 10월 복도 게시물 (현재 시점 — 1998 사건 증거물과 구분)
const NOTICES = [
  { t: '가 정 통 신 문', s: '제2008-87호', b: ['10월 10일(금) 개교 40주년', '기념 방송 및 야간 자율학습', '실시 안내', '', '학부모님께서는 자녀의 귀가', '시간을 확인해 주시기 바랍니다.'], c: '#f2ead2', h: '#1a1a1a' },
  { t: '10월 급식 식단표', s: '서문고등학교 영양실', b: ['13(월) 쌀밥 · 미역국 · 제육볶음', '14(화) 카레라이스 · 깍두기', '15(수) 비빔밥 · 계란국', '16(목) 짜장면 · 단무지', '17(금) 김치볶음밥 · 어묵국'], c: '#fff8e0', h: '#2a5a2a' },
  { t: '제42회 학예제', s: '2008. 10. 15 ~ 10. 17', b: ['합창 · 연극 · 밴드 공연', '사진부 전시 (본관 4층)', '방송부 UCC 상영회', '', '많은 참여 바랍니다'], c: '#e8f0ff', h: '#1a3a8a' },
  { t: '면학 분위기 조성', s: '학생부', b: ['복도에서 뛰지 맙시다', '바른 언어를 사용합시다', '쓰레기는 분리수거', '실내화 착용 철저', '', '— 선도부 —'], c: '#f4f0e0', h: '#8a1a1a' },
  { t: '수능 D-34', s: '2009학년도 대학수학능력시험', b: ['11월 13일(목)', '', '"오늘 흘린 땀방울이', '내일의 웃음이 된다"', '', '3학년부'], c: '#fff0f0', h: '#a01818' },
  { t: '방과후학교 안내', s: '2008학년도 2학기', b: ['수능 대비 언어 · 수리 · 외국어', '논술 특강 (3학년)', '컴퓨터 자격증 (1·2학년)', '월~목 16:30 ~ 18:10', '', '— 방과후학교 담당 —'], c: '#eaf3ff', h: '#1a4a9a' },
  { t: '학교폭력 STOP!', s: '학교폭력 예방 주간', b: ['친구는 지켜 주는 것', '보고도 모른 척하면', '방관자입니다', '', '신고 · 상담', '학생부 · 상담실'], c: '#fff6e8', h: '#c02020' },
  { t: '야간 자율학습 안내', s: '교무부', b: ['1·2학년 21:00 까지', '3학년 22:00 까지', '', '22시 이후 교내 잔류 금지', '본관 출입문 22:30 자동 잠금', '— 당직 교사 확인 —'], c: '#eef4ea', h: '#2a2a2a' },
];
function drawNotice(g, W, H, n) {
  g.fillStyle = n.c; g.fillRect(0, 0, W, H);
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, 'rgba(160,130,60,.18)'); gr.addColorStop(1, 'rgba(120,90,40,.05)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);   // 누렇게 바램
  g.fillStyle = n.h; g.textAlign = 'center'; g.font = 'bold 26px serif'; g.fillText(n.t, W / 2, 46); g.font = '13px serif'; g.fillStyle = '#555'; g.fillText(n.s, W / 2, 68);
  g.strokeStyle = n.h; g.lineWidth = 2; g.beginPath(); g.moveTo(24, 80); g.lineTo(W - 24, 80); g.stroke();
  g.fillStyle = '#222'; g.font = '16px sans-serif'; g.textAlign = 'left'; n.b.forEach((l, i) => g.fillText(l, 22, 112 + i * 28));
  g.fillStyle = '#c02020'; g.beginPath(); g.arc(W / 2, 10, 6, 0, 7); g.fill();   // 압정
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(90,70,40,${Math.random() * .08})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
}

// 책상 위 낙서 · 칼자국: 연필 · 볼펜 글씨 + 긁힌 선 (투명 판, 책상 윗면에 붙인다). 6가지를 돌려 쓴다 (재질 공유)
const GRAF = ['싸이월드 일촌 신청 ㄱㄱ', '졸면 죽는다', '수학 시험 망함 ㅠ', '서문고 3-2 화이팅', '떠든 사람: 김민수', '시험범위 p.41~78'], grafMat = [];
export function grafMaterial(k) { if (grafMat[k]) return grafMat[k]; const c = document.createElement('canvas'); c.width = 256; c.height = 176; const g = c.getContext('2d');
  const pen = k % 3 === 0 ? 'rgba(40,60,140,.75)' : k % 3 === 1 ? 'rgba(60,60,60,.7)' : 'rgba(120,30,30,.65)';
  g.save(); g.translate(128, 88); g.rotate((k % 2 ? -1 : 1) * .12); g.fillStyle = pen; g.font = `${k % 2 ? 'bold ' : ''}26px "Nanum Pen Script","Gaegu",cursive,sans-serif`; g.textAlign = 'center'; g.fillText(GRAF[k], 0, 0); g.restore();
  g.strokeStyle = 'rgba(70,45,20,.55)'; g.lineWidth = 1.2; for (let i = 0; i < 7; i++) { const x = Math.random() * 256, y = Math.random() * 176; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - .5) * 90, y + (Math.random() - .5) * 20); g.stroke(); }   // 칼 · 컴퍼스 긁힘
  if (k === 0) { g.strokeStyle = pen; g.lineWidth = 2; g.beginPath(); g.ellipse(128, 84, 100, 34, -.12, 0, 7); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (grafMat[k] = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: .8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })); }
let grafN = 0;
// 교실 뒷벽 게시물 (2008년 10월, 투명 판 한 장 · 모든 교실 공유): 10월 급식 식단표 · 청소 당번표 · 수능 D-day (2009학년도 수능 11.13)
const backBoardDraw = (g, w, h) => { g.clearRect(0, 0, w, h);
  const paper = (x, y, pw, ph, rot, bg, title, tc, lines, fs = 17) => { g.save(); g.translate(x + pw / 2, y + ph / 2); g.rotate(rot); g.translate(-pw / 2, -ph / 2);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(4, 5, pw, ph); g.fillStyle = bg; g.fillRect(0, 0, pw, ph); g.fillStyle = tc; g.font = 'bold 24px sans-serif'; g.textAlign = 'center'; g.fillText(title, pw / 2, 32);
    g.textAlign = 'left'; g.fillStyle = '#222'; g.font = `${fs}px sans-serif`; lines.forEach((t, i) => g.fillText(t, 14, 62 + i * (fs + 7)));
    g.fillStyle = '#c82020'; g.beginPath(); g.arc(pw / 2, 8, 6, 0, 7); g.fill(); g.restore(); };
  paper(16, 18, 330, 320, -.015, '#fbf6e2', '10월 급식 식단표', '#2a5a2a', ['6(월) 쌀밥 · 된장국 · 불고기', '7(화) 잡곡밥 · 김치찌개 · 계란말이', '8(수) 카레라이스 · 깍두기 · 요구르트', '9(목) 짜장덮밥 · 단무지 · 귤', '10(금) 비빔밥 · 미역국 · 떡', '13(월) 쌀밥 · 육개장 · 제육볶음', '14(화) 김치볶음밥 · 어묵국', '15(수) 스파게티 · 마늘빵 · 우유', '— 영양사 —'], 16);
  paper(366, 30, 300, 300, .02, '#eef4fb', '청소 당번표', '#1a3a7a', ['교실 바닥 : 1 ~ 6번', '칠판 · 분필 : 7 ~ 9번', '복도 · 창틀 : 10 ~ 15번', '화장실 : 16 ~ 20번', '분리수거 : 21 ~ 24번', '※ 매주 월요일 교대', '※ 대걸레는 빨아서 널 것'], 17);
  g.save(); g.translate(690, 40); g.rotate(-.01); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(4, 5, 250, 270); g.fillStyle = '#fff'; g.fillRect(0, 0, 250, 270);
  g.fillStyle = '#b01818'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText('2009학년도 수능', 125, 46); g.font = 'bold 96px sans-serif'; g.fillText('D-34', 125, 160);
  g.fillStyle = '#222'; g.font = '18px sans-serif'; g.fillText('2008. 11. 13 (목)', 125, 200); g.fillText('지금 자면 꿈을 꾸지만', 125, 232); g.fillText('지금 공부하면 꿈을 이룬다', 125, 256); g.restore(); };
const canvasPlane = (w, h, cw, ch, draw, key, transparent = false) => { let t = key && decorTex.get(key);
  if (!t) { const c = document.createElement('canvas'); c.width = cw; c.height = ch; draw(c.getContext('2d'), cw, ch); t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (key) decorTex.set(key, t); }
  const mk = transparent ? 'mT' : 'mO'; let m = t.userData[mk];   // 같은 텍스처 · 같은 설정 재질은 하나로 (교실마다 새 재질을 만들던 것 — 중복 재질 ~100개)
  if (!m) { m = new THREE.MeshStandardMaterial({ map: t, roughness: .85, transparent, polygonOffset: true, polygonOffsetFactor: -2 }); if (key) t.userData[mk] = m; }
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); };


export const DESK_RY = Math.PI / 2, CHAIR_RY = -Math.PI / 2;   // 의자: 등받이가 교실 뒤쪽(+x) — 칠판(서쪽)을 바라본다 (측정으로 확인)   // 모델 정면 보정 (스크린샷으로 맞춘다)
export const SPEC = {
  floors: 4, FH: 3.6, CEIL: 3.1, slab: .25,   // 반자 높이 3.1m (예전 2.7m 는 답답했다)
  bay: 9, classDepth: 10, corridor: 3.6, wall: .2, outer: .3,   // 교실 9×10m · 복도 3.6m (건물 깊이 14m)
  stairW: 6, coreW: 9,           // 계단실 폭, 중앙 화장실 코어 폭
  classesPerSide: 4,              // 중앙 코어 좌우로 4교실씩 = 층당 8교실
};

// 배치: x 서→동  [계단 6][교실 ×4][코어 9][교실 ×4][계단 6] = 6+36+9+36+6 = 93m
// 층별 실 배치 (교실 칸 8개, 서→동). 1층 관리동 · 4층 특별실
//   1층: 1학년 1~5반 · 교무실·행정실(통합, 현관 쪽으로 확장) · 남/여 화장실 · 보건실/상담실 — 코어는 줄인 중앙 현관
//   2층: 2학년 1~5반 · 교장실 · 회의실 · 도서관
//   3층: 3학년 1~5반 · 진로상담실 · 자율학습실 · 학생회실
//   4층: 방송실(두 칸) · 창고 · 컴퓨터실 · 시청각실 · 기록보존실 · 교사 휴게실 · 사진부 암실      'a+b' = 한 칸을 칸막이로 나눈 두 방
export const ROOM_PLAN = [
  ['class', 'class', 'class', 'staff', 'toiletM+toiletF', 'nurse+counsel', 'class', 'class'],   // staff = 교무실 · 행정실 통합 (중앙 현관 서쪽 2.25m 까지 넓힌 사무실)
  ['class', 'class', 'class', 'principal', 'meeting', 'library', 'class', 'class'],
  ['class', 'class', 'class', 'career', 'study', 'class', 'class', 'council'],
  ['bcast', 'bcast', 'storage', 'computer', 'avroom', 'archive', 'teacher', 'club'],   // bcast 두 칸 = 칸막이 없는 18m 방송실 (예전 본관 방송실 설비를 그대로 옮겨 온다)
];
const OFFICE_EXT = 2.25;
const NEWROOMS = new Set(['council', 'avroom', 'archive', 'teacher', 'club', 'tech', 'prep', 'english', 'math', 'dance', 'band', 'history', 'lounge']), ROOMLOG = [];
const ENT_IN = 2.2, ENT_H = 2.85;   // 현관 유리문: 코어 양끝에서 들인 폭 · 높이 (넓힌 현관)   // 1층 중앙 현관에서 떼어 교무실에 붙이는 폭
const ROOM_NAME = { council: '학생회실', avroom: '시청각실', archive: '기록보존실', teacher: '교사 휴게실', club: '사진부 암실', tech: '기술실', prep: '과학준비실', english: '영어전용실', math: '수학교과실', dance: '무용 · 다목적실', band: '밴드부실', history: '학교 역사관', lounge: '학생 휴게실', toiletM: '남자 화장실', toiletF: '여자 화장실', meeting: '회의실', career: '진로상담실', storage: '창고', empty: '빈 교실', bcast: '방송실', admin: '행정실', principal: '교장실', staff: '교무실 · 행정실', nurse: '보건실', counsel: '상담실', broadcast: '방송실', science: '과학실', library: '도서실', music: '음악실', art: '미술실', computer: '컴퓨터실', home: '가정실', study: '자율학습실' };
// 별관 (3층 · 층당 4실): 1층 예체능 · 2층 실습 · 3층 3학년 교실
export const ANNEX_SPEC = { floors: 3, classesPerSide: 2 };
export const ANNEX_PLAN = [
  ['music', 'art', 'tech', 'home'],
  ['science', 'prep', 'english', 'math'],
  ['dance', 'band', 'history', 'lounge'],
];
export function layout(S = SPEC, cs = null) {   // cs: 중앙 계단실을 코어 'east' / 'west' 옆에
  const rooms = [], L = S.stairW * 2 + S.coreW + S.bay * S.classesPerSide * 2 + (cs ? S.stairW : 0);
  let x = -L / 2;
  const push = (kind, w) => { rooms.push({ kind, x1: x, x2: x + w }); x += w; };
  push('stair', S.stairW);
  for (let i = 0; i < S.classesPerSide; i++) push('class', S.bay);
  if (cs === 'west') push('cstair', S.stairW); push('core', S.coreW); if (cs === 'east') push('cstair', S.stairW);
  for (let i = 0; i < S.classesPerSide; i++) push('class', S.bay);
  push('stair', S.stairW);
  const zS = S.classDepth, zC = 0, zN = -S.corridor;   // 교실: z 0..7.5 (남), 복도: z -2.7..0 (북)
  return { L, rooms, zS, zC, zN, depth: S.classDepth + S.corridor };
}

// ── 절차 텍스처 ──
function canvasTex(w, h, draw, rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
const rnd = (() => { let s = 1234567; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const TEX = {
  ceiling: () => canvasTex(512, 512, (g, w, h) => {   // 600각 텍스 천장 4×4장 (2.4m): 장마다 미세한 색차 · 흡음 타공 · 몇 장은 누런 물 얼룩 테 · 처짐 그늘 · 교체한 새 텍스
    const n = 4, ts = w / n;
    for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) { const x0 = tx * ts, y0 = ty * ts, v = 222 + (rnd() * 14 - 7) | 0, fresh = rnd() < .08;
      g.fillStyle = fresh ? '#f0eee6' : `rgb(${v},${v - 3},${v - 10})`; g.fillRect(x0, y0, ts, ts);
      for (let i = 0; i < 380; i++) { g.fillStyle = `rgba(90,85,75,${.12 + rnd() * .25})`; g.fillRect(x0 + rnd() * ts, y0 + rnd() * ts, 1.5, 1.5); }
      if (!fresh && rnd() < .08) { const cx = x0 + ts * (.3 + rnd() * .4), cy = y0 + ts * (.3 + rnd() * .4), r = ts * (.2 + rnd() * .3), gr = g.createRadialGradient(cx, cy, r * .5, cx, cy, r); gr.addColorStop(0, 'rgba(170,140,90,.09)'); gr.addColorStop(.85, 'rgba(150,115,60,.17)'); gr.addColorStop(1, 'rgba(150,115,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); }   // 물 얼룩 (가장자리가 진한 테)
      if (rnd() < .15) { const gr = g.createLinearGradient(x0, y0, x0 + ts, y0 + ts); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.5, 'rgba(0,0,0,.08)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x0, y0, ts, ts); }   // 처진 장 그늘
      g.fillStyle = '#b8b4a8'; g.fillRect(x0, y0, ts, 3); g.fillRect(x0, y0, 3, ts); }   // T-바 틀
  }),
  wall: () => canvasTex(512, 512, (g, w, h) => {   // 수성페인트 미장 벽 (상부 아이보리): 미세 반점 + 누런 물 얼룩 · 흘러내린 자국 · 덧바른 미장 · 손때
    g.fillStyle = '#e8e2d2'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 200 + rnd() * 40; g.fillStyle = `rgba(${v},${v - 6},${v - 18},.22)`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    for (let i = 0; i < 6; i++) { const x = rnd() * w, y = rnd() * h, r = 30 + rnd() * 90, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(150,130,90,${.05 + rnd() * .08})`); gr.addColorStop(1, 'rgba(150,130,90,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }   // 누렇게 번진 물 얼룩
    for (let i = 0; i < 14; i++) { const x = rnd() * w, y0 = rnd() * h * .5, L = 60 + rnd() * 220; const gr = g.createLinearGradient(0, y0, 0, y0 + L); gr.addColorStop(0, 'rgba(120,105,80,.10)'); gr.addColorStop(1, 'rgba(120,105,80,0)'); g.fillStyle = gr; g.fillRect(x, y0, 1.5 + rnd() * 2.5, L); }   // 흘러내린 자국
    for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(245,242,232,${.25 + rnd() * .2})`; g.fillRect(rnd() * w, rnd() * h, 40 + rnd() * 70, 25 + rnd() * 50); }   // 덧바른 미장(조금 더 흰 네모)
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(70,60,50,${.04 + rnd() * .06})`; g.fillRect(rnd() * w, h * .65 + rnd() * h * .35, 4 + rnd() * 18, 1 + rnd() * 3); }   // 아래쪽 손때 · 긁힘
  }),
  wainscot: () => canvasTex(512, 512, (g, w, h) => {   // 하부 1.2m 녹색 유성페인트 (징두리): 붓 자국 · 벗겨진 칠(아래 미색 바탕이 드러남) · 신발 자국
    g.fillStyle = '#5f7a62'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '20,40,25'},${rnd() * .035})`; g.fillRect(0, y, w, 2); }   // 가로 붓 자국
    for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(30,50,35,${rnd() * .18})`; g.fillRect(rnd() * w, rnd() * h, 2, 3); }
    for (let i = 0; i < 8; i++) { const x = rnd() * w, y = h * .55 + rnd() * h * .45, r = 2 + rnd() * 7; g.fillStyle = '#a8a690'; g.beginPath(); for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283, rr = r * (.5 + rnd() * .7); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); g.strokeStyle = 'rgba(30,40,30,.35)'; g.lineWidth = 1; g.stroke(); }   // 벗겨진 칠
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(20,20,18,${.06 + rnd() * .12})`; g.fillRect(rnd() * w, h * .82 + rnd() * h * .16, 10 + rnd() * 30, 2 + rnd() * 5); }   // 아래쪽 신발 자국
  }),
  brick: () => canvasTex(512, 256, (g, w, h) => {   // 외벽 적벽돌 치장쌓기
    g.fillStyle = '#d8d0c0'; g.fillRect(0, 0, w, h);
    for (let y = 0, r = 0; y < h; y += 16, r++) for (let x = (r % 2) * -32; x < w; x += 64) { const v = 120 + rnd() * 40; g.fillStyle = `rgb(${v + 40},${v * .55},${v * .4})`; g.fillRect(x + 1, y + 1, 62, 14); }
  }),
};

// ── 실사 PBR 재질 (assets/tex: Poly Haven CC0 스캔 + 구운 원본, map · normal · roughness) ──
const TL = new THREE.TextureLoader(), TCACHE = {};
function tx(file, srgb) {
  if (TCACHE[file]) return TCACHE[file];
  const shared = globalThis.__texByFile?.get(file);   // tex.js loadPBR 이 이미 받은 같은 파일 (같은 래핑 · 색공간) — GPU 사본 · 디코딩 한 벌 절약
  if (shared && (!srgb || shared.colorSpace === THREE.SRGBColorSpace) && (srgb || shared.colorSpace !== THREE.SRGBColorSpace)) return (TCACHE[file] = shared);
  const t = TL.load(new URL('../assets/tex/' + file, import.meta.url).href); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; return (TCACHE[file] = t);
}
// name: 텍스처 세트, own: 색 맵도 실사로 쓸지 (false 면 절차 색 + 실사 노멀 · 거칠기만)
function pbr(name, { own = true, map = null, color = 0xffffff, nScale = 1, rough = 1, metal = 0 } = {}) {
  return new THREE.MeshStandardMaterial({ map: own ? tx(name + '_map.webp', true) : map, normalMap: tx(name + '_normal.webp'), normalScale: new THREE.Vector2(nScale, nScale),
    roughnessMap: tx(name + '_rough.webp'), roughness: rough, metalness: metal, color });
}
// 재질별 텍스처 1장이 덮는 실제 크기(m) — 상자 UV 를 이 값으로 나눈다
const UVM = { white: 1.4, crt: 2.2, deskTop: 3, wood: 2.2, terr: 2.4, ceil: 2.4, wall: 2.5, wain: 2.5, conc: 2.5, brick: 1.6, plinth: 1.6, frp: 4, stepc: 1.6, tile: 1.2, twall: 1.2, lockerM: 1.2, door: 1.0, steelG: 1.2, facade: 3, lectern: .7, lockerS: 1.2, steelTop: 1.2, cork: 1.0, tray: 1.0, nonslip: .05, deco: 2.4, skirt: 1, roofCoat: 4 };

export function buildMainBuilding(opt = {}) {
  const S = { ...SPEC, ...(opt.spec || {}) }, PLAN = opt.plan || ROOM_PLAN, LY = layout(S, opt.centerStair || null), root = new THREE.Group(); root.name = opt.name || 'REBUILD_MAIN';
  const csR = LY.rooms.find(r => r.kind === 'cstair'), ELX = csR ? (csR.x1 + csR.x2) / 2 : 3.7;   // 엘리베이터: 중앙 계단실 앞 (없으면 x 3.7)
  const OX = opt.x || 0, OZ = opt.z || 0, RY = opt.ry || 0, cR = Math.cos(RY), sR = Math.sin(RY);
  root.position.set(OX, 0, OZ); root.rotation.y = RY;
  const col = [];      // 충돌 AABB {x1,x2,z1,z2,y1,y2}
  const walk = [];     // 보행면 {x1,x2,z1,z2, h:(x,z)=>y}
  const props = [];    // 상호작용 지점 {kind,label,x,y,z,floor}
  const lights = [];   // 형광등 위치 (게임 쪽 조명 예산이 고른다)
  const geo = new Map();  // 재질키 → 지오메트리 목록 (끝에서 병합 → 드로콜 최소화)
  const moonWins = [];   // 창 개구부 (달빛 기둥 · 먼지용)
  const mats = {}, stairwells = [], doors = [], models = []; let s_sci = 0, s_lib = 0, s_staff = 0; let y_ = 0, rmx = 0, rmz = 0, bseed = 7; const br = () => (bseed = (bseed * 16807) % 2147483647) / 2147483647;   // rmx/rmz: 지금 꾸미는 방의 중심
  const mdl = (name, x, y, z, ry = 0, o = {}) => models.push({ name, x, y, z, ry, ...o });
  const deskGraffiti = (x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(.34, .23), grafMaterial(grafN++ % GRAF.length)); m.rotation.set(-Math.PI / 2, 0, Math.PI / 2 + (br() - .5) * .6); m.position.set(x + (br() - .5) * .08, y, z + (br() - .5) * .2); m.renderOrder = 2; root.add(m); };
  // 캔버스로 그리는 무거운 재질은 본관 · 별관이 한 벌을 함께 쓴다 (예전엔 건물마다 같은 텍스처를 다시 그려 재질 · 캔버스가 두 벌씩)
  const SHARE = new Set(['terr', 'chalk', 'tray', 'lockerF', 'deskMat', 'cork', 'nonslip', 'clsCurtain', 'roofCoat', 'tileW']);
  const M = (key, make) => mats[key] || (mats[key] = SHARE.has(key) ? PT.shared('mb_' + key, make) : make());
  const mat = {
    wood: M('wood', () => pbr('wood', { rough: .9 })),                                   // 노후 참나무 마루 (실사)
    terr: M('terr', () => { const m = pbr('tile', { own: false, map: PT.terrazzo(), nScale: .45, rough: .55 }); m.roughnessMap = PT.terrazzoRough(); return m; }),   // 인조석 물갈기(도끼다시): 회백 바탕 + 백 · 흑 · 담녹 쇄석 + 1.2m 황동 줄눈 + 왁스 광택 얼룩 (진흙처럼 보이던 실사 타일 색 맵 대신)   // 왁스 칠한 인조석 바닥: 손전등 빛이 은은하게 번지도록 거칠기를 낮춤                                   // 인조석 물갈기 · 모자이크 (실사)
    ceil: M('ceil', () => pbr('ceil', { own: false, map: TEX.ceiling(), nScale: .3 })),  // 텍스 천장: 색은 밝게, 요철은 실사
    wall: M('wall', () => pbr('paint', { own: false, map: TEX.wall(), nScale: .85, rough: 1 })),       // 아이보리 수성 페인트 + 실사 요철
    wain: M('wain', () => pbr('d2_tex_paint', { own: false, map: TEX.wainscot(), nScale: 1, rough: .7 })),   // 녹색 유성 페인트 (벗겨진 요철)
    conc: M('conc', () => pbr('step', { rough: 1 })),                                   // 콘크리트 (실사)
    brick: M('brick', () => new THREE.MeshStandardMaterial({ roughness: .9, map: canvasTex(512, 512, (g, w, h) => {   // 외벽: 2000년대 한국 학교 — 미색 수성 도장 콘크리트 (거푸집 이음 · 빗물 얼룩 · 잔 얼룩)
      g.fillStyle = '#ece8df'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const v = 214 + rnd() * 30 | 0; g.fillStyle = `rgba(${v},${v - 2},${v - 8},.5)`; g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
      for (let i = 0; i < 18; i++) { const x = rnd() * w, y = rnd() * h * .6, ww = 6 + rnd() * 18, gr = g.createLinearGradient(0, y, 0, y + 90 + rnd() * 140); gr.addColorStop(0, 'rgba(120,112,98,.07)'); gr.addColorStop(1, 'rgba(120,112,98,0)'); g.fillStyle = gr; g.fillRect(x, y, ww, 230); }   // 창틀 아래 빗물 자국
      g.strokeStyle = 'rgba(150,144,132,.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();   // 거푸집 · 줄눈
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(90,96,80,.08)'; g.beginPath(); g.arc(rnd() * w, rnd() * h, 4 + rnd() * 26, 0, 7); g.fill(); } }) })),   // (예전 적벽돌 대신)
    band: M('band', () => new THREE.MeshStandardMaterial({ color: 0x2f6e8c, roughness: .55, metalness: .1 })),   // 층마다 두른 청록 띠 (학교 상징색)
    plinth: M('plinth', () => new THREE.MeshStandardMaterial({ map: TEX.brick(), color: 0xcdb8ac, roughness: .86 })),   // 2008 외관 리모델링: 1층 하부 · 기둥 피복 치장벽돌 (적갈색 + 미색 줄눈) — 예전 화강석 걸레받이
    trim: M('trim', () => new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: .78 })),             // 외벽 재도장: 창대 · 상인방 · 층간 띠 · 캐노피 (백색 수성 도장)
    aluW: M('aluW', () => new THREE.MeshStandardMaterial({ color: 0xd6dadd, roughness: .32, metalness: .55 })),   // 은백색 알루미늄 이중창 틀 (2000년대 창호 교체)
    grille: M('grille', () => new THREE.MeshStandardMaterial({ color: 0xe9e9e4, roughness: .5, metalness: .35 })),  // 1층 방범창 (백색 분체도장 철봉)
    pvc: M('pvc', () => new THREE.MeshStandardMaterial({ color: 0x9fa3a3, roughness: .55, metalness: .1 })),   // 회색 PVC 선홈통
    acUnit: M('acUnit', () => new THREE.MeshStandardMaterial({ color: 0xe4e4de, roughness: .5, metalness: .15 })), // 에어컨 실외기 · PVC 선홈통
    frp: M('frp', () => new THREE.MeshStandardMaterial({ roughness: .6, map: canvasTex(256, 256, (g, w, h) => {   // FRP 조립식 물탱크 패널 (하늘색 · 1m 격자 리브)
      g.fillStyle = '#b8ccd4'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(90,110,120,.35)'; for (let k = 0; k <= 4; k++) { g.fillRect(k * w / 4 - 3, 0, 6, h); g.fillRect(0, k * h / 4 - 3, w, 6); }
      for (let i = 0; i < 1200; i++) { const v = 170 + rnd() * 40 | 0; g.fillStyle = `rgba(${v},${v + 14},${v + 20},.25)`; g.fillRect(rnd() * w, rnd() * h, 2, 2); } }) })),
    chalk: M('chalk', () => new THREE.MeshStandardMaterial({ map: PT.chalkboard(), roughness: .93, normalMap: tx('d2_tex_paint_normal.webp'), normalScale: new THREE.Vector2(.12, .12) })),   // 교실 녹색 칠판(무광): 지우개 자국 · 지운 판서 흔적 · 분필 가루 — 4.8m 한 장으로 덮는다
    tray: M('tray', () => new THREE.MeshStandardMaterial({ map: PT.chalkTray(), roughness: .55, metalness: .55 })),   // 알루미늄 분필 받침 + 분필 가루 · 몽당 분필
    lockerS: M('lockerS', () => pbr('d2_tex_paint', { own: false, color: 0x9aa09e, rough: .55, metal: .35, nScale: .6 })),   // 철제 사물함 몸체: 회색 소부 도장
    lockerF: M('lockerF', () => new THREE.MeshStandardMaterial({ map: PT.lockerDoors(), normalMap: tx('d2_tex_paint_normal.webp'), normalScale: new THREE.Vector2(.4, .4), roughness: .5, metalness: .35 })),   // 사물함 문 16종 (명찰 · 갤러리 · 찌그러짐 · 녹)
    lectern: M('lectern', () => pbr('d2_tex_varnishDark', { rough: .5, color: 0x9c8a80, nScale: .6 })),   // 교탁: 짙은 니스 칠 원목
    steelTop: M('steelTop', () => pbr('d2_tex_paint', { own: false, color: 0x8e9496, rough: .5, metal: .4, nScale: .5 })),   // 교무실 철제 책상 상판 (회색 소부)
    deskMat: M('deskMat', () => new THREE.MeshStandardMaterial({ map: PT.deskMat(), roughness: .2, metalness: .05 })),   // 녹색 고무 매트 + 덮은 유리 (아래 끼운 시간표 · 메모 · 사진)
    alu: M('alu', () => new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: .35, metalness: .7 })),
    glass: M('glass', () => new THREE.MeshStandardMaterial({ color: 0xbfd6dc, roughness: .08, metalness: .1, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide })),
    frost: M('frost', () => new THREE.MeshStandardMaterial({ color: 0xe6eef0, roughness: .45, metalness: .05, transparent: true, opacity: .62, depthWrite: false, side: THREE.DoubleSide })),   // 화장실 문: 불투명에 가까운 반투명(간유리)   // 투과(transmission) 굴절은 장면을 한 번 더 그리고 흐릿한 바닥 번짐을 만든다 → 반투명 유리
    steelG: M('steelG', () => pbr('d2_tex_paint', { color: 0xa8b8ac, rough: .7, metal: .35 })),   // 도장 철판 (분전반 · 방화문 · 캐비닛)
    red: M('red', () => new THREE.MeshStandardMaterial({ color: 0xb2201c, roughness: .45, metalness: .2 })),
    white: M('white', () => new THREE.MeshStandardMaterial({ roughness: .55, metalness: .08, map: canvasTex(256, 256, (g, w, h) => {   // 흰 도장 철판 · 합판: 미세한 결 · 손때 · 모서리 긁힘 (민무늬 흰 상자처럼 보이던 것)
      g.fillStyle = '#ece9e1'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const v = 225 + Math.random() * 26 | 0; g.fillStyle = `rgba(${v},${v - 2},${v - 8},.35)`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
      for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(120,110,95,${.04 + Math.random() * .06})`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 6 + Math.random() * 20, 3 + Math.random() * 10, Math.random() * 3, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(90,85,78,.25)'; g.lineWidth = 1; for (let i = 0; i < 10; i++) { const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6 + Math.random() * 18, y + Math.random() * 3 - 1.5); g.stroke(); }
      g.fillStyle = 'rgba(70,66,60,.18)'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3); }) })),
    lamp: M('lamp', () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f6ff, emissiveIntensity: 1.4 })),
    exitG: M('exitG', () => new THREE.MeshStandardMaterial({ color: 0x1fa64a, emissive: 0x1fa64a, emissiveIntensity: 1.2 })),
    exitHalo: M('exitHalo', () => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);   // 유도등 녹색 번짐 (가산 평면)
      gr.addColorStop(0, 'rgba(60,255,120,.55)'); gr.addColorStop(.45, 'rgba(30,200,90,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }); }),
    extLamp: M('extLamp', () => new THREE.MeshBasicMaterial({ color: 0xfff4dc, toneMapped: false })),
    exitSign: M('exitSign', () => { const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');   // 비상구 유도등 표지 (녹색 바탕 · 달리는 사람 · 문 · '비상구')
      g.fillStyle = '#1aa04a'; g.fillRect(0, 0, 256, 96); g.fillStyle = '#f4fff6'; g.fillRect(14, 14, 54, 68); g.fillStyle = '#1aa04a'; g.fillRect(22, 22, 38, 60);
      g.fillStyle = '#f4fff6'; g.beginPath(); g.arc(98, 26, 9, 0, 7); g.fill(); g.lineWidth = 9; g.lineCap = 'round'; g.strokeStyle = '#f4fff6';
      g.beginPath(); g.moveTo(96, 38); g.lineTo(86, 60); g.lineTo(100, 80); g.moveTo(86, 60); g.lineTo(72, 74); g.moveTo(93, 44); g.lineTo(78, 46); g.moveTo(95, 42); g.lineTo(110, 52); g.stroke();
      g.font = 'bold 40px sans-serif'; g.textBaseline = 'middle'; g.fillText('비상구', 126, 52);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshBasicMaterial({ map: t, toneMapped: false }); }),
    deskTop: M('deskTop', () => new THREE.MeshStandardMaterial({ map: tx('d2_th102_wood_edge_BaseColor.webp', true), normalMap: tx('d2_th102_wood_edge_Normal.webp'), normalScale: new THREE.Vector2(.35, .35), roughness: .62, color: 0xffd9a8 })),   // 합판 상판
    deskLeg: M('deskLeg', () => new THREE.MeshStandardMaterial({ color: 0x3d4a44, roughness: .45, metalness: .6 })),
    book0: M('book0', () => new THREE.MeshStandardMaterial({ color: 0x7a2a22, roughness: .8 })), book1: M('book1', () => new THREE.MeshStandardMaterial({ color: 0x23406a, roughness: .8 })),
    book2: M('book2', () => new THREE.MeshStandardMaterial({ color: 0x2f5a36, roughness: .8 })), book3: M('book3', () => new THREE.MeshStandardMaterial({ color: 0xc8b48a, roughness: .85 })),
    pcCase: M('pcCase', () => new THREE.MeshStandardMaterial({ roughness: .55, metalness: .35, map: canvasTex(128, 256, (g, w, h) => {   // 2000년대 초 미니타워: 짙은 회색 도장 + 손때 · 먼지 얼룩 + 옆판 통풍 타공
      g.fillStyle = '#3c3e40'; g.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { const v = 40 + Math.random() * 40 | 0; g.fillStyle = `rgba(${v + 30},${v + 26},${v + 18},.18)`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 12, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(20,20,20,.55)'; for (let y = h * .62; y < h * .9; y += 7) for (let x = w * .25; x < w * .75; x += 7) g.fillRect(x, y, 3, 3); }) })),
    kbd: M('kbd', () => new THREE.MeshStandardMaterial({ roughness: .7, map: canvasTex(256, 96, (g, w, h) => {   // 104키 키보드 윗면: 검은 키캡 줄 + 닳은 글자 자리
      g.fillStyle = '#1c1c1e'; g.fillRect(0, 0, w, h); const rows = [[15, 13.2], [14, 13.2], [13, 13.2], [12, 13.2], [8, 13.2]];
      rows.forEach(([n, kw], r) => { for (let i = 0; i < n; i++) { const x = 6 + i * (w * .72 / 15), y = 6 + r * 17; g.fillStyle = '#2c2c30'; g.fillRect(x, y, w * .72 / 15 - 2, 14); g.fillStyle = 'rgba(190,190,180,.35)'; g.fillRect(x + 3, y + 3, 3, 3); } });
      for (let r = 0; r < 5; r++) for (let i = 0; i < 4; i++) { g.fillStyle = '#2c2c30'; g.fillRect(w * .8 + i * 12, 6 + r * 17, 10, 14); } }) })),
    brass: M('brass', () => new THREE.MeshStandardMaterial({ color: 0x9a7a40, roughness: .38, metalness: .9 })),   // 청동 배수 트랩
    hood: M('hood', () => new THREE.MeshStandardMaterial({ roughness: .32, metalness: .85, map: canvasTex(64, 256, (g, w, h) => { for (let y = 0; y < h; y++) { const v = 176 + Math.random() * 30 | 0; g.fillStyle = `rgb(${v},${v + 2},${v + 5})`; g.fillRect(0, y, w, 1); } }) })),   // 헤어라인 스테인리스 (주방 후드)
    crt: M('crt', () => new THREE.MeshStandardMaterial({ roughness: .5, map: canvasTex(128, 128, (g, w, h) => {   // 누렇게 바랜 베이지 플라스틱 (CRT · 본체) + 통풍구 줄
      g.fillStyle = '#d4cbb2'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const v = 195 + Math.random() * 30 | 0; g.fillStyle = `rgba(${v},${v - 6},${v - 26},.4)`; g.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2); }
      g.fillStyle = 'rgba(60,54,40,.35)'; for (let y = 10; y < 34; y += 5) g.fillRect(12, y, w - 24, 2); }) })), screen: M('screen', () => new THREE.MeshStandardMaterial({ color: 0x0c1014, roughness: .15, metalness: .2 })),
    cork: M('cork', () => pbr('bc_fabric', { own: false, map: PT.cork(), nScale: .5, rough: 1 })),   // 게시판 코르크: 알갱이 · 압정 구멍 · 테이프 자국
    curtain: M('curtain', () => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');   // 병원식 커튼: 세로 주름 그늘 + 위쪽 그물망 띠, 살짝 비친다
      for (let x = 0; x < 256; x++) { const v = 205 + Math.sin(x / 256 * Math.PI * 18) * 26; g.fillStyle = `rgb(${v - 30},${v},${v - 8})`; g.fillRect(x, 0, 1, 64); }
      g.fillStyle = 'rgba(255,255,255,.55)'; for (let x = 0; x < 256; x += 4) for (let y = 0; y < 9; y += 4) g.fillRect(x, y, 2, 2);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1);
      return new THREE.MeshStandardMaterial({ map: t, roughness: .95, side: THREE.DoubleSide, transparent: true, opacity: .82, depthWrite: false }); }),
    porc: M('porc', () => new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: .15 })),
    tile: M('tile', () => pbr('tfloor', { rough: .7 })),                                // 화장실 바닥 타일 (실사)
    rubber: M('rubber', () => new THREE.MeshStandardMaterial({ color: 0x3a3a38, roughness: .8 })),
    lockerM: M('lockerM', () => pbr('varnish', { rough: .8 })),                          // 니스 칠 나무 (사물함 · 문 · 서가)
  };
  mat.nonslip = M('nonslip', () => new THREE.MeshStandardMaterial({ map: PT.nonSlip(), roughness: .85, metalness: .1 }));   // 계단 논슬립
  // 2008 교실 바닥 PVC 데코타일 · 진회녹색 걸레받이 · 외벽 빗물 자국 · 밑동 때(백화) — 본관 · 별관 · 시설이 한 재질을 함께 쓴다 (periodTex 모듈 캐시)
  mat.roofCoat = M('roofCoat', () => new THREE.MeshStandardMaterial({ map: PT.roofCoat(), roughnessMap: PT.roofRough(), roughness: 1, metalness: .02 }));   // 옥상 녹색 방수 페인트 (본관 · 별관 한 정의 — 예전엔 두 곳에 같은 정의)
  mat.deco = M('deco', PT.MAT.deco); mat.skirt = M('skirt', PT.MAT.skirt); mat.streak = M('streak', PT.MAT.streak); mat.grime = M('grime', PT.MAT.grime);
  const wallDecal = (key, a, b, ya, yb, zf, out, tile, uo = 0) => { const W = b - a, g = new THREE.PlaneGeometry(W, yb - ya); if (out < 0) g.rotateY(Math.PI); const uv = g.attributes.uv;   // 외벽 면에 붙이는 투명 덧칠 (z 면)
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * W / tile + uo); g.translate((a + b) / 2, (ya + yb) / 2, zf + out * .004); G(key, g); };
  // 세부 소품 재질 (교실 커튼 · 서류철 · 머그컵 · 전화기 · 분리수거함)
  Object.assign(mat, {
    clsCurtain: M('clsCurtain', () => pbr('bc_fabric', { own: false, map: PT.curtain(), nScale: .6, rough: 1 })),   // 면 커튼: 주름 명암 · 직조 결 · 아래 손때   // 누렇게 바랜 교실 커튼 (1998 납품)
    binder0: M('binder0', () => new THREE.MeshStandardMaterial({ color: 0x24407a, roughness: .6 })), binder1: M('binder1', () => new THREE.MeshStandardMaterial({ color: 0x8a2420, roughness: .6 })), binder2: M('binder2', () => new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: .6 })),
    mug: M('mug', () => new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: .3 })),
    phone: M('phone', () => new THREE.MeshStandardMaterial({ color: 0xd6cfbe, roughness: .5 })),   // 누런 아이보리 사무용 전화기
    extTag: M('extTag', PT.MAT.extTag), exitPicto: M('exitPicto', PT.MAT.exitPicto), deskCal: M('deskCal', PT.MAT.deskCal), notice08: M('notice08', PT.MAT.notice08),   // 소품 라운드 2 (본관 · 별관 · 시설 공용)
    mop: M('mop', () => new THREE.MeshStandardMaterial({ color: 0xbdb6a4, roughness: 1 })), broomR: M('broomR', () => new THREE.MeshStandardMaterial({ color: 0xb8322a, roughness: .7 })),   // 회색으로 바랜 면 대걸레 · 빨간 플라스틱 빗자루
    recycB: M('recycB',() => new THREE.MeshStandardMaterial({ color: 0x2a62a8, roughness: .6 })), recycY: M('recycY', () => new THREE.MeshStandardMaterial({ color: 0xd8b42a, roughness: .6 })), recycG: M('recycG', () => new THREE.MeshStandardMaterial({ color: 0x3a8a44, roughness: .6 })),
  });
  const uvBox = (w, h, d, u = 1) => { const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv, n = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)); const sw = ax > .5 ? d : w, sh = ay > .5 ? d : h; uv.setXY(i, uv.getX(i) * sw / u, uv.getY(i) * sh / u); } return g; };
  const boxSeen = new Set();
  const box = (key, x1, x2, y1, y2, z1, z2, { solid = false, u = UVM[key] || 1 } = {}) => {
    const w = x2 - x1, h = y2 - y1, d = z2 - z1; if (w <= 0 || h <= 0 || d <= 0) return;
    { const id = key + [x1, x2, y1, y2, z1, z2].map(v => Math.round(v * 1000)).join(); if (boxSeen.has(id)) { if (solid) col.push({ x1, x2, z1, z2, y1, y2 }); return; } boxSeen.add(id); }   // 같은 자리 같은 재질 상자 두 번 (이웃 칸이 공유하는 기둥 · 이어 붙인 캐비닛 문틈) → 한 번만
    const g = uvBox(w, h, d, u); g.translate((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    (geo.get(key) || geo.set(key, []).get(key)).push(g);
    if (solid) col.push({ x1, x2, z1, z2, y1, y2 });
  };
  const yf = f => f * S.FH;
  // ── 세부 형상 빌더: 상자 하나로 때우던 가구를 실제 부품(문짝 · 손잡이 · 다리 · 리브)으로 짓는다 ──
  const G = (key, g) => (geo.get(key) || geo.set(key, []).get(key)).push(g);
  // 레트로 PC 세트 (2000년대 초): 베이지 15인치 CRT (두꺼운 뒤통수 · 받침) + 짙은 회색 미니타워 (ODD · FDD 베이 · 은색 앞판) + 검은 키보드 · 마우스
  //   dir: 화면이 보는 방향 'x+'|'x-'|'z+'|'z-' · (x, z): 모니터 받침 중심 · y: 책상 윗면 · tower: 'desk' 옆 | 'floor' 책상 아래 | null
  const retroPC = (x, y, z, dir, { tower = 'floor', kb = true, scale = 1, lcd = false } = {}) => {
    const ax = dir[0] === 'x', sg = dir[1] === '+' ? 1 : -1;
    const B = (key, f1, f2, y1, y2, l1, l2, o) => { f1 *= scale; f2 *= scale; l1 *= scale; l2 *= scale; const fa = sg > 0 ? f1 : -f2, fb = sg > 0 ? f2 : -f1, la = ax ? l1 * sg : -l2 * sg, lb = ax ? l2 * sg : -l1 * sg;
      if (ax) box(key, x + fa, x + fb, y + y1 * scale, y + y2 * scale, z + Math.min(la, lb), z + Math.max(la, lb), o); else box(key, x + Math.min(la, lb), x + Math.max(la, lb), y + y1 * scale, y + y2 * scale, z + fa, z + fb, o); };
    if (lcd) {   // 2008: 검은 19인치 LCD (얇은 패널 · 원형 받침 · 목) — 2000년대 후반 학교 보급형
      B('rubber', -.1, .06, 0, .015, -.1, .1); B('rubber', -.04, -.01, .015, .14, -.03, .03);
      B('rubber', -.015, .02, .08, .4, -.215, .215); B('screen', .02, .023, .1, .385, -.2, .2); B('exitG', .02, .024, .088, .094, .17, .178);
    } else {
    B('crt', -.13, .09, 0, .025, -.12, .12); B('crt', -.06, .03, .025, .08, -.06, .06);                       // 받침 · 목
    B('crt', .05, .12, .08, .43, -.195, .195);                                                                  // 앞 베젤
    B('screen', .12, .123, .12, .39, -.155, .155);                                                              // 브라운관 유리
    B('crt', -.2, .05, .1, .41, -.165, .165); B('crt', -.3, -.2, .15, .36, -.11, .11);                         // 뒤로 좁아지는 몸통 (편향 요크 자리)
    B('rubber', .12, .124, .092, .102, -.05, .05); B('exitG', .12, .124, .094, .1, .15, .158);                 // 상표 띠 · 전원 LED
    B('crt', .12, .125, .092, .104, .11, .135);                                                                  // 전원 버튼
    }
    if (kb) { B('rubber', .16, .34, 0, .02, -.23, .23); B('kbd', .17, .33, .02, .028, -.22, .22); B('rubber', .2, .3, 0, .03, .29, .345); }   // 키보드 · 마우스
    if (tower) { const ty = tower === 'floor' ? Math.floor((y + .1) / S.FH) * S.FH - y : 0,   // 책상 밑: 그 층 바닥 (예전엔 절대 높이 0 → 위층 본체가 1층 방 바닥에 떨어졌다)
       l0 = tower === 'floor' ? .05 : .3;
      const T = (key, f1, f2, y1, y2, l1, l2, o) => B(key, f1, f2, ty / scale + y1, ty / scale + y2, l0 + l1, l0 + l2, o);
      T('pcCase', -.3, .14, 0, .43, 0, .19, { solid: true });                                                    // 본체 (W190 D440 H430)
      T(lcd ? 'rubber' : 'alu', .14, .145, .04, .2, .02, .17); if (lcd) T('alu', .146, .148, .345, .35, .03, .16);   // 2008 검은 본체 · 은색 DVD/CD-ROM 트레이 줄 T('rubber', .14, .146, .33, .36, .02, .17); T('rubber', .14, .146, .28, .31, .02, .17);   // 은색 앞판 · ODD 2단
      T('rubber', .14, .146, .235, .245, .06, .13); T('crt', .145, .15, .09, .12, .085, .105); T('exitG', .145, .15, .135, .14, .09, .1); }   // FDD 슬롯 · 전원 버튼 · LED
  };
  // 실명판 (복도로 튀어나온 양면 돌출 간판): 흰 바탕 · 위쪽 파란 띠 · 굵은 검은 글씨 · 파란 밑줄
  const signTex = new Map();
  const roomSign = (text, x, y, z) => {
    let t = signTex.get(text);
    if (!t) { const c = document.createElement('canvas'); c.width = 320; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, 320, 200);
      const gr = g.createLinearGradient(0, 0, 320, 0); gr.addColorStop(0, '#1d8fd0'); gr.addColorStop(.12, '#1b3fa8'); gr.addColorStop(1, '#1a3aa0'); g.fillStyle = gr; g.fillRect(0, 0, 320, 18);
      g.fillStyle = '#111'; g.font = `bold ${text.length > 4 ? 52 : 70}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 160, 104); g.fillStyle = '#1a3aa0'; g.fillRect(30, 166, 260, 4);
      t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; signTex.set(text, t); }
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: .45 });
    [1, -1].forEach(sd => { const p = new THREE.Mesh(new THREE.PlaneGeometry(.5, .31), m); p.position.set(x + sd * .012, y, z - .33); p.rotation.y = sd * Math.PI / 2; root.add(p); });
    box('steelG', x - .01, x + .01, y - .16, y + .16, z - .59, z - .07);   // 간판 판 두께
    box('white', x - .03, x + .03, y - .18, y + .18, z - .08, z);   // 벽 브래킷
  };
  const cyl = (key, x, y, z, r, h, r2 = r, seg = 12) => { const g = new THREE.CylinderGeometry(r2, r, h, seg); g.translate(x, y + h / 2, z); G(key, g); };
  // 라디에이터: 세로 리브 + 상하 헤더관 + 받침다리
  const radiator = (xa, xb, y, za, zb) => { for (let x = xa; x <= xb; x += .065) box('white', x - .022, x + .022, y + .05, y + .58, za, zb); box('white', xa, xb, y + .55, y + .6, za + .01, zb - .01); box('white', xa, xb, y + .03, y + .08, za + .01, zb - .01); [xa + .05, xb - .05].forEach(x => box('alu', x - .015, x + .015, y - .15, y + .03, (za + zb) / 2 - .015, (za + zb) / 2 + .015)); };
  // 캐비닛: 받침 + 몸체 + 문짝 2~4(틈) + 손잡이 + 상판 — front: 앞면 방향 ('x+','x-','z+','z-')
  const cabinetD = (x1, x2, z1, z2, y, h, key, front, glassTop = false) => {
    box(key, x1 + .01, x2 - .01, y + .08, y + h - .03, z1 + .01, z2 - .01, { solid: true }); box('rubber', x1 + .03, x2 - .03, y, y + .08, z1 + .03, z2 - .03); box(key, x1, x2, y + h - .03, y + h, z1, z2);
    const alongX = front[0] === 'z', len = alongX ? x2 - x1 : z2 - z1, n = Math.max(2, Math.round(len / .5)), fs = front[1] === '+' ? 1 : -1;
    const fx = front[0] === 'x' ? (fs > 0 ? x2 : x1) : 0, fz = front[0] === 'z' ? (fs > 0 ? z2 : z1) : 0;
    for (let k = 0; k <= n; k++) { const t = (alongX ? x1 : z1) + k * len / n;   // 문짝 틈 (어두운 줄)
      if (alongX) box('rubber', t - .004, t + .004, y + .1, y + h - .05, Math.min(fz, fz + fs * .006), Math.max(fz, fz + fs * .006)); else box('rubber', Math.min(fx, fx + fs * .006), Math.max(fx, fx + fs * .006), y + .1, y + h - .05, t - .004, t + .004); }
    box('rubber', alongX ? x1 : Math.min(fx, fx + fs * .006), alongX ? x2 : Math.max(fx, fx + fs * .006), y + h * .45 - .004, y + h * .45 + .004, alongX ? Math.min(fz, fz + fs * .006) : z1, alongX ? Math.max(fz, fz + fs * .006) : z2);   // 상 · 하 칸 나눔
    for (let k = 0; k < n; k++) { const t = (alongX ? x1 : z1) + (k + .5) * len / n + (k % 2 ? -.12 : .12) * len / n;   // 손잡이
      [y + h * .45 + .12, y + h * .45 - .12].forEach(hy => alongX ? box('alu', t - .01, t + .01, hy - .05, hy + .05, Math.min(fz, fz + fs * .03), Math.max(fz, fz + fs * .03)) : box('alu', Math.min(fx, fx + fs * .03), Math.max(fx, fx + fs * .03), hy - .05, hy + .05, t - .01, t + .01)); }
    if (glassTop) alongX ? box('glass', x1 + .03, x2 - .03, y + h * .48, y + h - .06, Math.min(fz, fz + fs * .01), Math.max(fz, fz + fs * .01)) : box('glass', Math.min(fx, fx + fs * .01), Math.max(fx, fx + fs * .01), y + h * .48, y + h - .06, z1 + .03, z2 - .03);
  };
  // 교실 뒤 개인 사물함: 3단 × n열 칸 · 칸마다 문 틈 · 이름표 · 손잡이
  // 철제(회색 소부 도장) — 문짝 그림(틈 · 갤러리 · 명찰 · 잠금 고리 · 찌그러짐)은 앞면 판 한 장에 칸마다 텍스처 1칸씩 (8 × 2 변형)
  const lockerWall = (x, zA, zB, y, h, faceX) => { const n = Math.round((zB - zA) / .36); box('lockerS', x - .42, x, y, y + h, zA, zB, { solid: true });
    { const g = new THREE.PlaneGeometry(zB - zA, h), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * n / 8, uv.getY(i) * 3 / 2);
      g.rotateY(-Math.PI / 2); g.translate(x - .422, y + h / 2, (zA + zB) / 2); G('lockerF', g); }
    for (let r = 0; r < 3; r++) for (let k = 0; k < n; k++) { const za = zA + k * (zB - zA) / n, zb = za + (zB - zA) / n, ya = y + r * h / 3, fx = x - .42;
      box('alu', fx - .03, fx, ya + h / 6 - .02, ya + h / 6 + .02, zb - .075, zb - .055); } };   // 손잡이만 입체
  // 교탁: 앞판 · 옆판 · 경사 상판 · 안쪽 선반
  const lectern = (x, z, y) => { box('lectern', x - .3, x + .3, y, y + .95, z - .45, z - .42, { solid: true }); box('lectern', x - .3, x + .3, y, y + .95, z + .42, z + .45); box('lectern', x - .33, x - .3, y, y + .98, z - .45, z + .45); box('lectern', x - .3, x + .3, y + .45, y + .48, z - .42, z + .42);
    const g = uvBox(.66, .04, .96, UVM.lectern); g.rotateZ(-.12); g.translate(x, y + 1.0, z); G('lectern', g); col.push({ x1: x - .33, x2: x + .33, z1: z - .45, z2: z + .45, y1: y, y2: y + 1.05 });
    // 경사 상판 위 (상판 기울기 그대로): 출석부(녹색 하드커버 + 흰 이름표) · 분필통(양철 원통 + 분필 몇 자루) · 지시봉(은색 안테나식)
    const onTop = (key, gg, dx, h, dz) => { gg.translate(dx, .02 + h / 2, dz); gg.rotateZ(-.12); gg.translate(x, y + 1.0, z); G(key, gg); };
    onTop('book2', uvBox(.24, .022, .32, 1), -.02, .022, -.26); onTop('white', uvBox(.1, .003, .06, 1), -.02, .046, -.26);
    onTop('alu', new THREE.CylinderGeometry(.035, .035, .09, 10), .02, .09, .3);
    [[-.012, .01], [.01, -.008], [.004, .012]].forEach(([a, b], i) => onTop(i === 1 ? 'recycY' : 'white', new THREE.CylinderGeometry(.005, .005, .1, 5), .02 + a, .1 + .03, .3 + b));
    { const p = new THREE.CylinderGeometry(.004, .007, .62, 6); p.rotateX(Math.PI / 2); p.rotateY(.08); onTop('alu', p, .22, .014, 0); } };
  // 사무용 회전의자: 쿠션 · 등받이 · 가스 실린더 · 5발 받침 · 바퀴
  const officeChair = (x, z, y, face = 0) => { box('rubber', x - .23, x + .23, y + .42, y + .5, z - .23, z + .23); const bz = z + (face >= 0 ? .2 : -.2); box('rubber', x - .21, x + .21, y + .55, y + .95, Math.min(bz, bz + .05), Math.max(bz, bz + .05)); box('alu', x - .02, x + .02, y + .48, y + .6, bz - .02, bz + .02);
    cyl('alu', x, y + .08, z, .025, .34); for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5, g = new THREE.BoxGeometry(.3, .03, .04); g.translate(.15, 0, 0); g.rotateY(a); g.translate(x, y + .08, z); G('rubber', g); cyl('rubber', x + Math.cos(a) * .29, y, z - Math.sin(a) * .29, .025, .05); } };
  // 침대: 철제 프레임 다리 · 매트리스 · 베개 · 머리 쪽 파이프
  const bed = (x1, x2, z, y) => { [[x1 + .05, z - .42], [x1 + .05, z + .42], [x2 - .05, z - .42], [x2 - .05, z + .42]].forEach(([x, zz]) => cyl('alu', x, y, zz, .02, .4)); box('alu', x1, x2, y + .36, y + .4, z - .44, z + .44);
    box('white', x1 + .02, x2 - .02, y + .4, y + .56, z - .43, z + .43, { solid: true }); box('porc', x2 - .45, x2 - .1, y + .56, y + .66, z - .3, z + .3); box('alu', x2 - .03, x2, y + .4, y + .95, z - .44, z + .44); box('alu', x2 - .03, x2, y + .9, y + .95, z - .44, z + .44); col.push({ x1, x2, z1: z - .45, z2: z + .45, y1: y, y2: y + .6 }); };
  // 과학 실험대: 하부장(문짝) · 검은 레진 상판 · 개수대 · 꺾인 수전 · 가스 꼭지
  const labTable = (x, z, y) => { cabinetD(x - .7, x + .7, z - .9, z + .9, y, .85, 'white', 'x+'); box('rubber', x - .72, x + .72, y + .85, y + .9, z - .92, z + .92); box('screen', x - .2, x + .2, y + .86, y + .905, z - .2, z + .2);
    cyl('alu', x, y + .9, z + .32, .015, .3); box('alu', x - .015, x + .015, y + 1.17, y + 1.2, z + .1, z + .33); [-.45, .45].forEach(dz => cyl('red', x + .5, y + .9, z + dz, .02, .06)); };
  // 업라이트 피아노: 몸체 · 건반대 · 흰/검은 건반 · 뚜껑 · 다리
  const upright = (x, z, y, front) => { const fs = front; box('screen', x - .3, x + .3, y, y + 1.25, z - .75, z + .75, { solid: true }); box('screen', x - .3 + (fs > 0 ? .3 : -.1), x + .3 + (fs > 0 ? .1 : -.3), y + .7, y + .78, z - .72, z + .72);
    for (let k = 0; k < 36; k++) { const kz = z - .7 + k * .039; box('white', fs > 0 ? x + .3 : x - .45, fs > 0 ? x + .45 : x - .3, y + .78, y + .8, kz, kz + .035); if ([1, 2, 4, 5, 6].includes(k % 7)) box('screen', fs > 0 ? x + .3 : x - .38, fs > 0 ? x + .38 : x - .3, y + .8, y + .83, kz - .01, kz + .012); }
    box('screen', x - .32, x + .32, y + 1.25, y + 1.28, z - .77, z + .77); [-.7, .7].forEach(dz => box('screen', fs > 0 ? x + .3 : x - .45, fs > 0 ? x + .45 : x - .3, y, y + .7, z + dz - .03, z + dz + .03)); };
  // 양변기: 받침 · 도기 몸통 · 시트 · 물탱크 — 벽(+x 또는 -x)에 붙는다
  const toilet = (x, z, y, wallSide) => { const s = wallSide; cyl('porc', x, y, z, .17, .4, .2, 16); box('rubber', x - .2, x + .2, y + .4, y + .43, z - .2, z + .2); box('porc', x + s * .2, x + s * .38, y + .4, y + .8, z - .2, z + .2); box('alu', x + s * .25, x + s * .3, y + .8, y + .82, z + .1, z + .15); col.push({ x1: x - .22, x2: x + .22, z1: z - .22, z2: z + .22, y1: y, y2: y + .5 }); };
  // 세면대: 도기 볼 + 받침 기둥 + 수전 + 거울
  // 세면대 (서 · 동쪽 벽에 붙는 것): 볼이 벽에서 x 방향으로 나온다
  const sinkPedX = (x, z, y, wallX, mirror = true) => { const s = Math.sign(x - wallX) || 1; cyl('porc', x, y, z, .07, .7, .09, 12); box('porc', Math.min(wallX, x + s * .22), Math.max(wallX, x + s * .22), y + .72, y + .86, z - .28, z + .28); box('screen', x - .12, x + .12, y + .82, y + .861, z - .2, z + .2);
    cyl('alu', wallX + s * .06, y + .86, z, .015, .16); box('alu', Math.min(wallX + s * .06, wallX + s * .16), Math.max(wallX + s * .06, wallX + s * .16), y + 1.0, y + 1.02, z - .012, z + .012); if (mirror) box('glass', Math.min(wallX, wallX + s * .01), Math.max(wallX, wallX + s * .01), y + 1.15, y + 1.75, z - .3, z + .3); col.push({ x1: Math.min(wallX, x + s * .25), x2: Math.max(wallX, x + s * .25), z1: z - .3, z2: z + .3, y1: y, y2: y + .9 }); };
  const sinkPed = (x, z, y, wallZ, mirror = true) => { const s = Math.sign(z - wallZ) || 1; cyl('porc', x, y, z, .07, .7, .09, 12); box('porc', x - .28, x + .28, y + .72, y + .86, Math.min(wallZ, z + s * .22), Math.max(wallZ, z + s * .22)); box('screen', x - .2, x + .2, y + .82, y + .861, Math.min(z - .12, z + .12), Math.max(z - .12, z + .12));
    cyl('alu', x, y + .86, wallZ + s * .06, .015, .16); box('alu', x - .012, x + .012, y + 1.0, y + 1.02, Math.min(wallZ + s * .06, wallZ + s * .16), Math.max(wallZ + s * .06, wallZ + s * .16)); if (mirror) box('glass', x - .3, x + .3, y + 1.15, y + 1.75, Math.min(wallZ, wallZ + s * .01), Math.max(wallZ, wallZ + s * .01)); col.push({ x1: x - .3, x2: x + .3, z1: Math.min(wallZ, z + s * .25), z2: Math.max(wallZ, z + s * .25), y1: y, y2: y + .9 }); };
  // 2도어 가정용 냉장고 (x 방향 벽용): xb = 벽 쪽 면, xf = 문 쪽 면 · 위 냉동실 1/3 · 문 틈 고무 · 세로 손잡이 · 아래 통풍 그릴 (예전: 흰 상자 하나)
  const fridgeX = (xb, xf, z1, z2, y, h = 1.6) => { const s = Math.sign(xf - xb), a = Math.min(xb, xf), b = Math.max(xb, xf), yd = y + h * .64, f0 = xf - s * .04;
    box('white', a, b, y + .08, y + h, z1, z2, { solid: true }); box('rubber', Math.min(f0, xf - s * .03), Math.max(f0, xf - s * .03), y, y + .08, z1 + .02, z2 - .02);   // 몸체 · 걸레받이 그릴
    box('porc', Math.min(xf, xf + s * .035), Math.max(xf, xf + s * .035), y + .1, yd - .008, z1 + .01, z2 - .01); box('porc', Math.min(xf, xf + s * .035), Math.max(xf, xf + s * .035), yd + .008, y + h - .01, z1 + .01, z2 - .01);   // 냉장실 · 냉동실 문 (문 틈 16mm)
    box('rubber', Math.min(xf, xf + s * .02), Math.max(xf, xf + s * .02), yd - .008, yd + .008, z1 + .02, z2 - .02);
    [[y + .55, yd - .1], [yd + .1, y + h - .12]].forEach(([p, q]) => { box('alu', Math.min(xf + s * .035, xf + s * .06), Math.max(xf + s * .035, xf + s * .06), p, q, z2 - .09, z2 - .065); box('alu', Math.min(xf + s * .035, xf + s * .05), Math.max(xf + s * .035, xf + s * .05), p, p + .02, z2 - .09, z2 - .065); box('alu', Math.min(xf + s * .035, xf + s * .05), Math.max(xf + s * .035, xf + s * .05), q - .02, q, z2 - .09, z2 - .065); });   // 세로 손잡이 (받침 2)
  };
  // 복사기: 하부 급지 서랍 2단 · 본체 · 원고 덮개 · 조작판
  const copier = (x1, x2, z1, z2, y) => { box('white', x1, x2, y, y + .5, z1, z2, { solid: true }); for (let k = 1; k <= 2; k++) box('rubber', x1 - .005, x2 + .005, y + k * .17 - .005, y + k * .17, z1 - .005, z2 + .005); box('white', x1 + .03, x2 - .03, y + .5, y + .95, z1 + .03, z2 - .03); box('rubber', x1, x2, y + .95, y + 1.0, z1, z2); box('screen', x1 + .05, x1 + .3, y + .92, y + .96, z1 - .03, z1 + .1); box('rubber', x1 + .05, x2 - .05, y + .62, y + .64, z1 + .03 - .1, z1 + .03); };
  // ── 단서 배치: 쪽지(story.js NOTES id) · 증언 카세트(voice/<id>.mp3) — 실제 놓인 표면 높이(y) 위에 ──
  const clueNote = (id, x, y, z, f, ry = 0) => { const g = new THREE.BoxGeometry(.21, .004, .3); g.rotateY(ry); g.translate(x, y + .004, z); G('white', g); props.push({ kind: 'note', id, label: '쪽지 읽기', x, y: y + .1, z, floor: f }); };
  const clueTape = (id, x, y, z, f) => { box('screen', x - .13, x + .13, y, y + .07, z - .075, z + .075); box('red', x + .03, x + .07, y + .07, y + .085, z + .03, z + .06); props.push({ kind: 'tape', id, label: '녹음기 재생', x, y: y + .1, z, floor: f }); };
  // 코르크 게시판: 알루미늄 테두리 + 압정으로 꽂힌 공지 · 시간표 종이 (x 방향 벽용 / z 방향 벽용)
  const corkBoard = (xa, xb, ya, yb, z, side) => { const t = .02, zz = side > 0 ? [z, z + t] : [z - t, z]; box('cork', xa, xb, ya, yb, ...zz); box('alu', xa - .03, xb + .03, ya - .03, ya, zz[0], zz[1] + .01); box('alu', xa - .03, xb + .03, yb, yb + .03, zz[0], zz[1] + .01); box('alu', xa - .03, xa, ya, yb, zz[0], zz[1] + .01); box('alu', xb, xb + .03, ya, yb, zz[0], zz[1] + .01);
    for (let k = 0, x = xa + .15; x < xb - .3; k++, x += .32 + br() * .25) { const w = .21, h = .28 + br() * .05, y = ya + .15 + br() * (yb - ya - .55), zf = side > 0 ? zz[1] : zz[0] - .003; box(k % 5 === 2 ? 'book3' : 'white', x, x + w, y, y + h, Math.min(zf, zf + side * .003), Math.max(zf, zf + side * .003)); box('red', x + w / 2 - .01, x + w / 2 + .01, y + h - .03, y + h - .01, Math.min(zf, zf + side * .008), Math.max(zf, zf + side * .008)); } };
  const corkBoardZ = (x, side, za, zb, ya, yb) => { const t = .02, xx = side > 0 ? [x, x + t] : [x - t, x]; box('cork', ...xx, ya, yb, za, zb); [[ya - .03, ya], [yb, yb + .03]].forEach(([a, b]) => box('alu', xx[0], xx[1] + .01, a, b, za - .03, zb + .03));
    for (let k = 0, z = za + .15; z < zb - .3; k++, z += .32 + br() * .25) { const w = .21, h = .28 + br() * .05, y = ya + .15 + br() * (yb - ya - .55), xf = side > 0 ? xx[1] : xx[0] - .003; box(k % 4 === 1 ? 'book3' : 'white', Math.min(xf, xf + side * .003), Math.max(xf, xf + side * .003), y, y + h, z, z + w); } };
  // 응접 소파: 좌판 쿠션 · 등받이 · 팔걸이 · 다리
  const sofa = (x1, x2, z1, z2, y, backSide) => { box('rubber', x1, x2, y + .12, y + .42, z1, z2, { solid: true }); [x1, x2 - .14].forEach(x => box('rubber', x, x + .14, y + .12, y + .62, z1, z2)); const bz = backSide > 0 ? z2 - .16 : z1; box('rubber', x1, x2, y + .42, y + .82, bz, bz + .16); for (let k = 1; k < 3; k++) { const x = x1 + k * (x2 - x1) / 3; box('screen', x - .004, x + .004, y + .42, y + .45, z1 + .02, z2 - .02); } [[x1 + .05, z1 + .05], [x2 - .05, z1 + .05], [x1 + .05, z2 - .05], [x2 - .05, z2 - .05]].forEach(([x, z]) => cyl('screen', x, y, z, .02, .12)); };

  // 벽 + 개구부 (x 방향 벽): 개구부 목록 [{a,b,y1,y2}] 사이만 채운다
  const wallX = (key, xa, xb, z1, z2, y0, ops = [], o = {}) => {
    const H = S.FH - S.slab; let cur = xa; ops = ops.slice().sort((p, q) => p.a - q.a);
    for (const op of ops) { box(key, cur, op.a, y0, y0 + H, z1, z2, { solid: true, ...o }); box(key, op.a, op.b, y0, y0 + op.y1, z1, z2, { solid: op.y1 > .3, ...o }); box(key, op.a, op.b, y0 + op.y2, y0 + H, z1, z2, o); cur = op.b; }
    box(key, cur, xb, y0, y0 + H, z1, z2, { solid: true, ...o });
  };
  const wallZ = (key, x1, x2, za, zb, y0, ops = [], o = {}) => {
    const H = S.FH - S.slab; let cur = za; ops = ops.slice().sort((p, q) => p.a - q.a);
    for (const op of ops) { box(key, x1, x2, y0, y0 + H, cur, op.a, { solid: true, ...o }); box(key, x1, x2, y0, y0 + op.y1, op.a, op.b, { solid: op.y1 > .3, ...o }); box(key, x1, x2, y0 + op.y2, y0 + H, op.a, op.b, o); cur = op.b; }
    box(key, x1, x2, y0, y0 + H, cur, zb, { solid: true, ...o });
  };
  // 내부 벽 마감: 하부 1.2m 녹색 징두리 + 상부 아이보리 (얇은 판을 벽 앞에 붙인다)
  const finishX = (xa, xb, z, side, y0, ops = [], HI = S.CEIL) => {
    const t = .012, z1 = side > 0 ? z : z - t, z2 = side > 0 ? z + t : z;
    let cur = xa; ops = ops.slice().sort((p, q) => p.a - q.a);
    const seg = (a, b, lo, hi) => { if (hi > 1.2) { box('wall', a, b, y0 + Math.max(lo, 1.2), y0 + hi, z1, z2); } if (lo < 1.2) box('wain', a, b, y0 + lo, y0 + Math.min(1.2, hi), z1, z2); };
    for (const op of ops) { seg(cur, op.a, 0, HI); seg(op.a, op.b, 0, op.y1); seg(op.a, op.b, op.y2, HI); cur = op.b; }
    seg(cur, xb, 0, HI);
    box('skirt', xa, xb, y0, y0 + .12, side > 0 ? z + t : z - t - .015, side > 0 ? z + t + .015 : z - t);   // 걸레받이 (진회녹색 PVC 12cm)
  };

  const finishZ = (x, side, za, zb, y0) => {   // z 방향 벽 내부 마감
    const t = .012, x1 = side > 0 ? x : x - t, x2 = side > 0 ? x + t : x;
    box('wall', x1, x2, y0 + 1.2, y0 + S.FH - S.slab, za, zb); box('wain', x1, x2, y0, y0 + 1.2, za, zb);
    box('skirt', side > 0 ? x + t : x - t - .015, side > 0 ? x + t + .015 : x - t, y0, y0 + .12, za, zb);
  };
  const { zS, zN } = LY, T = S.outer;
  const isSt = r => r.kind === 'stair' || r.kind === 'cstair';
  const SG = r => { const zA = r.kind === 'cstair' ? .45 : zN + 2.8, zB = zA + 12 * .3; return { zA, zB, zL: Math.min(zS, zB + 1.6) }; };   // 계단 한 비행 12단 (단 너비 0.3m) · 중간참 1.6m
  for (let f = 0; f < S.floors; f++) {
    const y0 = yf(f), top = y0 + S.FH;
    // 슬래브 (구조) + 바닥 마감 + 반자(천장) + 보
    // 계단실(층 참 남쪽 zA~zS)은 슬래브 · 반자 · 보행면을 비워 둔다 → 위아래 계단이 이어져 보인다
    const cuts = LY.rooms.filter(isSt);
    const spans = []; { let cx = -LY.L / 2 - T; cuts.forEach(r => { spans.push([cx, r.x1]); cx = r.x2; }); spans.push([cx, LY.L / 2 + T]); }
    spans.forEach(([a, b]) => { if (b - a < .01) return;
      box('conc', a, b, y0 - S.slab, y0, zN - T, zS + T);
      box('terr', Math.max(a, -LY.L / 2), Math.min(b, LY.L / 2), y0, y0 + .006, zN, -S.wall / 2);   // 복도 바닥 마감: 인조석 물갈기 (노출 콘크리트 대신 — 1970~90년대 학교 복도 표준)
      box('ceil', Math.max(a, -LY.L / 2), Math.min(b, LY.L / 2), y0 + S.CEIL, y0 + S.CEIL + .02, zN, zS);
      walk.push({ x1: Math.max(a, -LY.L / 2), x2: Math.min(b, LY.L / 2), z1: zN, z2: zS, h: () => y0, f }); });
    cuts.forEach(r => { const { zA, zL } = SG(r); box('conc', r.x1, r.x2, y0 - S.slab, y0, zN - T, zA); walk.push({ x1: r.x1, x2: r.x2, z1: zN, z2: zA, h: () => y0, f }); if (f === 0) box('conc', r.x1, r.x2, y0 - S.slab, y0, zA, zL);
      if (zL < zS) { box('conc', r.x1, r.x2, y0 - S.slab, y0, zL, zS + T); box('ceil', r.x1, r.x2, y0 + S.CEIL, y0 + S.CEIL + .02, zL, zS); walk.push({ x1: r.x1, x2: r.x2, z1: zL, z2: zS, h: () => y0, f }); }
      box('ceil', r.x1, r.x2, y0 + S.CEIL, y0 + S.CEIL + .02, zN, zA); });
    // 기둥 (500×500) — 교실 경계마다 외벽 · 복도벽 라인에
    LY.rooms.forEach(r => [r.x1, r.x2].forEach(x => [zS + T / 2, 0].forEach(z => box('conc', x - .25, x + .25, y0, top - S.slab, z - .25, z + .25, { solid: true }))));
    // 외벽: 남측(교실 창 띠) · 북측(복도 창) · 동서 마구리
    const winsS = [], winsN = [];
    LY.rooms.forEach(r => {
      if (r.kind === 'class') { winsS.push({ a: r.x1 + .6, b: r.x2 - .6, y1: .9, y2: 2.4 }); winsN.push({ a: r.x1 + 1.5, b: r.x2 - 1.5, y1: 1.1, y2: 2.3 }); }
      else if (isSt(r)) winsS.push({ a: r.x1 + 1.5, b: r.x2 - 1.5, y1: f === 0 ? 2.6 : .3 + 1.8, y2: 3.0 });
      else if (r.kind === 'core' && f === 1 && opt.bridge) {}   // 2층 코어 북쪽: 구름다리 출입구
      else if (r.kind === 'core' && f === 0) {}   // 1층 코어 북쪽: 현관 유리문 (창을 겹쳐 두면 유리문 자리가 벽 · 벽돌로 막혀 보였다)
      else winsN.push({ a: r.x1 + 1.5, b: r.x2 - 1.5, y1: 1.5, y2: 2.3 });
    });
    // 1층 중앙 현관 (북측 = 운동장 반대편 주출입구, 남측은 교실)
    const core = LY.rooms.find(r => r.kind === 'core');
    if (f === 0) winsN.push({ a: core.x1 + ENT_IN, b: core.x2 - ENT_IN, y1: 0, y2: ENT_H, door: true });
    winsN.push({ a: ELX - .62, b: ELX + .62, y1: 0, y2: 2.15, door: true, elev: true });   // 엘리베이터 승강장 출입구
    if (f === 1 && opt.bridge) { winsN.push({ a: core.x1 + 2.6, b: core.x2 - 2.6, y1: 0, y2: 2.4, door: true }); walk.push({ x1: core.x1 + 2.6, x2: core.x2 - 2.6, z1: zN - T - .05, z2: zN, h: () => y0, f }); }   // 구름다리 출입구 (2층)   // 엘리베이터 승강장 출입구 (rebuildGame 승강로)
    if (f === 0 && opt.southEntry) winsS.push({ a: core.x1 + ENT_IN, b: core.x2 - ENT_IN, y1: 0, y2: ENT_H, door: true });   // 운동장 · 정문 쪽 주출입구
    wallX('brick', -LY.L / 2 - T, LY.L / 2 + T, zS, zS + T, y0, winsS);
    wallX('brick', -LY.L / 2 - T, LY.L / 2 + T, zN - T, zN, y0, winsN.filter(w => !(w.a > core.x1 && w.b < core.x2 && !w.door && f === 0)));
    finishX(-LY.L / 2, LY.L / 2, zN, 1, y0, winsN);
    if (f === 0 && opt.endExits) [[-LY.L / 2, 1], [LY.L / 2, -1]].forEach(([x, sd]) => {   // 비상구 쪽 끝벽: 안쪽 마감도 문 자리를 비운다 (예전엔 마감벽이 문 뒤를 막았다)
      finishZ(x, sd, zN, zN + .3, y0); finishZ(x, sd, zN + 1.6, zS, y0); const t = .012, x1 = sd > 0 ? x : x - t, x2 = sd > 0 ? x + t : x; box('wall', x1, x2, y0 + 2.2, y0 + S.FH - S.slab, zN + .3, zN + 1.6); });
    else { finishZ(-LY.L / 2, 1, zN, zS, y0); finishZ(LY.L / 2, -1, zN, zS, y0); }
    LY.rooms.filter(isSt).forEach(r => finishX(r.x1, r.x2, zS, -1, y0, winsS.filter(w => w.a >= r.x1 && w.b <= r.x2), S.FH - S.slab));   // 복도 쪽 외벽 안쪽 마감 (벽돌이 실내에 드러나지 않게)
    const exitOps = f === 0 && opt.endExits ? [{ a: zN + .3, b: zN + 1.6, y1: 0, y2: 2.2 }] : [];
    wallZ('brick', -LY.L / 2 - T, -LY.L / 2, zN - T, zS + T, y0, exitOps);
    wallZ('brick', LY.L / 2, LY.L / 2 + T, zN - T, zS + T, y0, exitOps);
    { const L2 = LY.L / 2 + T, o = .04;   // 외벽 장식: 층 슬래브 높이마다 청록 띠 (두께 .28) · 1층 화강석 걸레받이 (0.9m)
      if (f > 0) { box('band', -L2 - o, L2 + o, y0 - .16, y0 + .12, zS + T - .012, zS + T + o); box('band', -L2 - o, L2 + o, y0 - .16, y0 + .12, zN - T - o, zN - T + .012); box('band', -L2 - o, -L2, y0 - .16, y0 + .12, zN - T - o, zS + T + o); box('band', L2, L2 + o, y0 - .16, y0 + .12, zN - T - o, zS + T + o); }
      if (f === 0) { const sp = (a, b, z1, z2, X) => { box('plinth', a, b, 0, .9, z1, z2); const out = z1 > 0 ? 1 : -1; wallDecal('grime', a, b, 0, .9, out > 0 ? z2 : z1, out, 2); };   // + 밑동 흙때 · 백화
        const segs = (wins, z1, z2) => { let x = -L2; for (const w of wins.filter(q => q.door && q.y1 === 0).sort((p, q) => p.a - q.a)) { if (w.a > x) sp(x, w.a, z1, z2); x = Math.max(x, w.b); } if (x < L2) sp(x, L2, z1, z2); };
        segs(winsS, zS + T, zS + T + .03); segs(winsN, zN - T - .03, zN - T); if (!exitOps.length) { box('plinth', -L2 - .03, -L2, 0, .9, zN - T, zS + T); box('plinth', L2, L2 + .03, 0, .9, zN - T, zS + T); } } }
    if (exitOps.length) [-1, 1].forEach(sx => {   // 별관 양 끝 비상구: 바깥으로 열린 녹색 철문 · 비상구 유도등 · 문턱
      const xw = sx * (LY.L / 2 + T / 2);
      box('steelG', xw - .16, xw + .16, 2.2, 2.28, zN + .25, zN + 1.65); [zN + .3, zN + 1.6].forEach(z => box('steelG', xw - .16, xw + .16, 0, 2.2, z - .04, z + .04));
      { const w = 1.26, hz = zN + .32;   // 비상구 철문 (닫힌 채 시작 · [E] 로 여닫는다 · 바깥으로 열린다)
        doors.push({ kind: 'swing', axisZ: true, mat: 'steelG', win: false, w, h: 2.16, t: .05, px: xw, py: 0, pz: hz, ox: 0, oz: w / 2, dir: sx, open: false,
          cx1: xw - .1, cx2: xw + .1, cz1: hz, cz2: hz + w, mx: xw - sx * .7, mz: zN + .95, label: '비상구 철문', floor: 0 }); }
      box('lamp', xw - sx * .2 - .2, xw - sx * .2 + .2, 2.32, 2.5, zN + .75, zN + 1.15); exitSign(sx * (LY.L / 2 - .05), y0 + 2.4, zN + .95, true);
      walk.push({ x1: Math.min(xw - .2, xw + sx * .2) - .2, x2: Math.max(xw - .2, xw + sx * .2) + .2, z1: zN + .3, z2: zN + 1.6, h: () => 0, f: 0 });
      props.push({ kind: 'room', label: '비상구', x1: sx < 0 ? -LY.L / 2 : LY.L / 2 - .5, x2: sx < 0 ? -LY.L / 2 + .5 : LY.L / 2, z1: zN + .3, z2: zN + 1.6, floor: 0, exit: true }); });
    // 창호 (알루미늄 미서기창 + 유리)
    [[winsS, zS + T / 2], [winsN, zN - T / 2]].forEach(([ws, z]) => ws.forEach(w => { if (w.door) return;
      // 2008 창호 교체: 은백색 알루미늄 이중창 (바깥 · 안 두 줄 미서기 레일 · 문틀 · 위 고정창 가로살) — 예전 단창 대신
      box('aluW', w.a, w.b, y0 + w.y1, y0 + w.y1 + .06, z - .07, z + .07); box('aluW', w.a, w.b, y0 + w.y2 - .06, y0 + w.y2, z - .07, z + .07);
      box('aluW', w.a - .001, w.a + .05, y0 + w.y1 + .06, y0 + w.y2 - .06, z - .07, z + .07); box('aluW', w.b - .05, w.b + .001, y0 + w.y1 + .06, y0 + w.y2 - .06, z - .07, z + .07);
      const nS = Math.max(1, Math.round((w.b - w.a) / 1.6)), sw = (w.b - w.a) / nS, tH = w.y2 - w.y1 > 1.2 ? .42 : 0;
      for (let k = 1; k < nS; k++) { const x = w.a + k * sw; box('aluW', x - .035, x + .035, y0 + w.y1 + .06, y0 + w.y2 - .06, z - .06, z + .06); }
      for (let k = 0; k < nS; k++) { const x = w.a + (k + .5) * sw, dz = k % 2 ? .035 : -.035; box('aluW', x - .025, x + .025, y0 + w.y1 + .06, y0 + w.y2 - .06 - tH, z + dz - .02, z + dz + .02); }   // 미서기 짝 맞춤 살 (바깥 · 안 짝이 번갈아)
      if (tH) box('aluW', w.a + .05, w.b - .05, y0 + w.y2 - tH - .04, y0 + w.y2 - tH + .01, z - .065, z + .065);   // 위 고정창 가로살
      box('glass', w.a + .05, w.b - .05, y0 + w.y1 + .06, y0 + w.y2 - .06, z - .046, z - .03); box('glass', w.a + .05, w.b - .05, y0 + w.y1 + .06, y0 + w.y2 - .06, z + .03, z + .046);   // 이중 유리 (바깥 짝 · 안 짝)
      moonWins.push({ a: w.a + .05, b: w.b - .05, y1: y0 + w.y1 + .06, y2: y0 + w.y2 - .06, z, out: z > 0 ? 1 : -1, f, y0, nS });   // 달빛 창 기둥용 (moonShafts.js)
      // 바깥 콘크리트 창대 (물끊기) · 상인방
      const out = z > 0 ? 1 : -1, zo = z + out * (T / 2);
      box('trim', w.a - .08, w.b + .08, y0 + w.y1 - .06, y0 + w.y1, Math.min(zo - out * .01, zo + out * .12), Math.max(zo - out * .01, zo + out * .12));
      if (f > 0) wallDecal('streak', w.a - .05, w.b + .05, y0 + .14, y0 + w.y1 - .06, zo, out, 1.6, (w.a * .37 + f * .21) % 1);   // 창대 밑 빗물 자국 (아래 층 띠 위까지)
      box('trim', w.a - .05, w.b + .05, y0 + w.y2, y0 + w.y2 + .12, Math.min(zo - out * .01, zo + out * .04), Math.max(zo - out * .01, zo + out * .04));
      if (f === 0 && w.y1 < 2) {   // 1층 방범창: 백색 철봉 (12cm 간격) + 가로 띠철 3줄 · 벽에 고정하는 귀 — 창대 위에 선다
        const g1 = zo + out * .035, g2 = zo + out * .055, za = Math.min(g1, g2), zb = Math.max(g1, g2), ya = y0 + w.y1 + .02, yb = y0 + w.y2 - .02;
        for (let x = w.a + .06; x < w.b - .03; x += .12) box('grille', x - .008, x + .008, ya, yb, za, zb);
        [ya + .04, (ya + yb) / 2, yb - .04].forEach(y => box('grille', w.a - .02, w.b + .02, y - .015, y + .015, Math.min(zo + out * .03, zo + out * .062), Math.max(zo + out * .03, zo + out * .062)));
        [w.a - .04, w.b + .04].forEach(x => box('grille', x - .02, x + .02, ya, yb, Math.min(zo - out * .005, g2), Math.max(zo - out * .005, g2))); } }));
    if (f === 0) {   // 현관 유리문 2짝 + 바람막이 캐노피
      const d = { a: core.x1 + ENT_IN, b: core.x2 - ENT_IN };
      box('alu', d.a, d.b, ENT_H - .1, ENT_H, zN - .2, zN - .1); [d.a, (d.a + d.b) / 2, d.b].forEach(x => box('alu', x - .04, x + .04, 0, ENT_H - .1, zN - .2, zN - .1));
      if (opt.bridge) for (let k = 0; k < 4; k++) { const lz = zN - T - 1.2 - k * 2.2; [d.a + .6, d.b - .6].forEach(x => { box('alu', x - .32, x + .32, 3.28, 3.32, lz - .14, lz + .14); box('extLamp', x - .3, x + .3, 3.25, 3.28, lz - .12, lz + .12); }); if (k % 2 === 0) { const pl = new THREE.PointLight(0xffeccc, 1.6, 9, 1.7); pl.position.set((d.a + d.b) / 2, 3.0, lz - 1.1); pl.userData.alwaysOn = true; root.add(pl); } }   // 현관 통로(구름다리 밑) 천장등: 건물 소등과 상관없이 밤새 켜진 보안등
      { const w = (d.b - d.a) / 2; [[d.a, 1], [d.b, -1]].forEach(([hx, sx]) => doors.push({ kind: 'swing', mat: 'alu', win: false, w, h: ENT_H - .15, t: .05, px: hx, py: 0, pz: zN - .15, ox: sx * w / 2, oz: 0, dir: sx, open: false,
          cx1: Math.min(hx, hx + sx * w), cx2: Math.max(hx, hx + sx * w), cz1: zN - .2, cz2: zN - .1, mx: (d.a + d.b) / 2, mz: zN - .2, label: '현관 유리문', floor: 0, glassLeaf: true })); }
      if (!opt.bridge) box('conc', d.a - 1, d.b + 1, 3.0, 3.2, zN - 3.2, zN - T);   // 구름다리가 있으면 그것이 차양
      // 현관 위 교명판 · 출입등 2개
      { const c = document.createElement('canvas'); c.width = 1024; c.height = 160; const g = c.getContext('2d'); g.fillStyle = '#2a2622'; g.fillRect(0, 0, 1024, 160); g.fillStyle = '#d8c9a0'; g.font = 'bold 92px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(opt.signText || '서 문 고 등 학 교', 512, 84);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sg = new THREE.Mesh(new THREE.PlaneGeometry(4.6, .72), new THREE.MeshStandardMaterial({ map: t, roughness: .6, metalness: .3 })); sg.position.set((core.x1 + core.x2) / 2, opt.bridge ? 3.08 : 3.75, zN - T - .02); if (opt.bridge) sg.scale.set(.62, .5, 1); /* 구름다리 밑: 문 위 낮게 */ sg.rotation.y = Math.PI; root.add(sg); }
      [d.a - .6, d.b + .6].forEach(x => { box('alu', x - .1, x + .1, 2.55, 2.85, zN - T - .14, zN - T); box('extLamp', x - .08, x + .08, 2.58, 2.82, zN - T - .16, zN - T - .14); lights.push({ x, y: 2.6, z: zN - T - .6 }); });
      exitSign((d.a + d.b) / 2, ENT_H + .06, zN - T - .04);   // 현관 위 비상구 유도등
      mdl('security_camera_01', d.a - .3, opt.bridge ? 3.15 : 2.9, zN - T - .45, Math.PI);   // 현관 CCTV (바깥을 본다)
      props.push({ kind: 'mainDoor', label: '현관 유리문', x: (d.a + d.b) / 2, y: 1.1, z: zN - .15, floor: 0 });
      walk.push({ x1: d.a, x2: d.b, z1: zN - T - .05, z2: zN, h: () => 0, f: 0 });   // 현관 문턱 (벽 두께)
    }
    if (f === 0 && opt.southEntry) {   // 남쪽 정문 현관 (운동장 · 정문을 마주 본다): 유리문 2짝 · 캐노피 · 교명판 · 출입등
      const d = { a: core.x1 + ENT_IN, b: core.x2 - ENT_IN }, zd = zS + T;
      box('alu', d.a, d.b, ENT_H - .1, ENT_H, zS + .1, zS + .2); [d.a, (d.a + d.b) / 2, d.b].forEach(x => box('alu', x - .04, x + .04, 0, ENT_H - .1, zS + .1, zS + .2));
      { const w = (d.b - d.a) / 2; [[d.a, 1], [d.b, -1]].forEach(([hx, sx]) => doors.push({ kind: 'swing', mat: 'alu', win: false, w, h: ENT_H - .15, t: .05, px: hx, py: 0, pz: zS + .15, ox: sx * w / 2, oz: 0, dir: -sx, open: false,
          cx1: Math.min(hx, hx + sx * w), cx2: Math.max(hx, hx + sx * w), cz1: zS + .1, cz2: zS + .2, mx: (d.a + d.b) / 2, mz: zS + .2, label: '정문 현관 유리문', floor: 0, glassLeaf: true })); }
      // 2008 현관 리모델링: 백색 도장 캐노피 + 알루미늄 후레싱 · 치장벽돌 기둥 · 화강석 포치(+15cm) · 동쪽 장애인 경사로(1/16) + 스테인리스 난간
      box('trim', d.a - 1, d.b + 1, 3.0, 3.2, zd - .01, zd + 3.0); box('aluW', d.a - 1.03, d.b + 1.03, 3.2, 3.26, zd + 2.9, zd + 3.04); box('aluW', d.a - 1.03, d.b + 1.03, 3.2, 3.26, zd - .01, zd + 2.9);   // 캐노피 + 지붕 후레싱
      [d.a - .9, d.b + .9].forEach(x => box('plinth', x - .16, x + .16, .15, 3.0, zd + 2.59, zd + 2.91, { solid: true }));   // 캐노피 기둥 (치장벽돌)
      mat.porch = M('porch', () => new THREE.MeshStandardMaterial({ color: 0xaeaca6, roughness: .78 }));   // 버너 마감 화강석
      const PH = .15, rx0 = d.b + 1, rL = 2.4;   // 포치 높이 · 경사로 시작 x · 길이
      box('porch', d.a - 1, d.b + 1, -.02, PH, zd - .005, zd + 3.0);   // 현관 앞 포치
      walk.push({ x1: d.a - 1, x2: d.b + 1, z1: zd, z2: zd + 3.0, h: () => PH, f: 0 });
      { const ramp = new THREE.BoxGeometry(rL, .06, 1.5), q = Math.atan2(PH, rL); ramp.rotateZ(-q); ramp.translate(rx0 + rL / 2, PH / 2 - .03, zd + 1.05); G('porch', ramp);   // 경사판 (포치에서 동쪽으로 내려간다)
        box('porch', rx0, rx0 + rL, -.02, .005, zd + .25, zd + 1.85);
        walk.push({ x1: rx0, x2: rx0 + rL, z1: zd + .3, z2: zd + 1.8, h: x => Math.max(0, PH * (1 - (x - rx0) / rL)), f: 0 });
        [zd + .25, zd + 1.85].forEach(z => { for (let k = 0; k <= 3; k++) { const x = rx0 + k * rL / 3, yb = PH * (1 - k / 3); box('aluW', x - .02, x + .02, yb, yb + .86, z - .02, z + .02); }
          const len = Math.hypot(rL, PH), rail = new THREE.CylinderGeometry(.022, .022, len, 8); rail.rotateZ(Math.PI / 2 - Math.atan2(PH, rL)); rail.translate(rx0 + rL / 2, PH / 2 + .86, z); G('aluW', rail); });
        // 장애인 경사로 안내 표지 (파란 바탕 · 휠체어)
        const sg = canvasPlane(.3, .3, 128, 128, (g, W, H) => { g.fillStyle = '#1f4fa0'; g.fillRect(0, 0, W, H); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.arc(60, 82, 26, .3, 5.2); g.stroke(); g.beginPath(); g.arc(58, 26, 10, 0, 7); g.fill(); g.fillRect(52, 38, 11, 36); g.fillRect(52, 64, 34, 10); g.fillRect(80, 64, 10, 36); }, 'rampSign');
        sg.position.set(rx0 + rL + .02, PH + .7, zd + 1.85 + .03); root.add(sg); box('aluW', rx0 + rL - .02, rx0 + rL + .02, 0, 1.0, zd + 1.83, zd + 1.87); }
      { const c = document.createElement('canvas'); c.width = 1024; c.height = 160; const g = c.getContext('2d'); g.fillStyle = '#2a2622'; g.fillRect(0, 0, 1024, 160); g.fillStyle = '#d8c9a0'; g.font = 'bold 92px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(opt.signText || '서 문 고 등 학 교', 512, 84);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sg = new THREE.Mesh(new THREE.PlaneGeometry(4.6, .72), new THREE.MeshStandardMaterial({ map: t, roughness: .6, metalness: .3 })); sg.position.set((core.x1 + core.x2) / 2, 3.75, zd + .02); root.add(sg); }
      [d.a - .6, d.b + .6].forEach(x => { box('alu', x - .1, x + .1, 2.55, 2.85, zd, zd + .14); box('lamp', x - .08, x + .08, 2.58, 2.82, zd + .14, zd + .16); lights.push({ x, y: 2.6, z: zd + .6 }); });
      exitSign((d.a + d.b) / 2, ENT_H + .06, zd + .04);   // 현관 위 비상구 유도등 (바깥에서도 보인다)
      mdl('security_camera_01', d.a - .5, 2.9, zd + .45, 0); mdl('security_camera_01', d.b + .5, 2.9, zd + .45, 0);   // 현관 CCTV 2대 (캐노피 밑, 바깥 · 경사로 쪽을 본다)
      props.push({ kind: 'mainDoor', label: '정문 현관 유리문', x: (d.a + d.b) / 2, y: 1.1, z: zS + .15, floor: 0 });
      walk.push({ x1: d.a, x2: d.b, z1: zS, z2: zd + .05, h: (x, z) => .15 * Math.min(1, Math.max(0, (z - zS) / T)), f: 0 });   // 현관 문턱 (벽 두께): 포치 높이 → 실내 바닥으로 완만하게
    }
    // 복도벽(교실 ↔ 복도): 교실마다 앞 · 뒤 미닫이문 + 상부 고창
    LY.rooms.forEach(r => {
      if (r.kind === 'class') {
        const idx = LY.rooms.filter(q => q.kind === 'class').indexOf(r), type = PLAN[f][idx], name = roomName(f, idx);
        // 방송실(두 칸): 출입문은 조정실 앞문 하나뿐 — 나머지 세 문 자리는 벽 (방음 · 보안)
        const D0 = [{ a: r.x1 + .7, b: r.x1 + 1.7, y1: 0, y2: 2.1, k: 0 }, { a: r.x2 - 1.7, b: r.x2 - .7, y1: 0, y2: 2.1, k: 1 }];
        const dops = type === 'bcast' ? (PLAN[f][idx - 1] !== 'bcast' ? [D0[0]] : []) : D0;
        const ops = [...dops, { a: r.x1 + 2.4, b: r.x2 - 2.4, y1: 1.6, y2: 2.4 }];
        wallX('wall', r.x1, r.x2, -S.wall / 2, S.wall / 2, y0, ops);
        finishX(r.x1, r.x2, S.wall / 2, 1, y0, ops); finishX(r.x1, r.x2, -S.wall / 2, -1, y0, ops);
        dops.forEach(o => { const k = o.k; box('alu', o.a - .05, o.a + .012, y0, y0 + 2.15, -.12, .12); box('alu', o.b - .012, o.b + .05, y0, y0 + 2.15, -.12, .12); box('alu', o.a, o.b, y0 + 2.088, y0 + 2.15, -.12, .12);
          // 미서기 나무문 (복도 쪽 레일, 벽 안쪽으로 밀려 들어간다) + 문 위 실명판
          const w = o.b - o.a; doors.push({ kind: 'slide', mat: type === 'bcast' ? 'steelG' : 'lockerM', win: true, w, h: 2.08, t: .04, px: (o.a + o.b) / 2, py: y0, pz: -.14, ox: 0, oz: 0, dir: k ? -1 : 1, open: (f + idx + k) % 3 === 0,
            cx1: o.a, cx2: o.b, cz1: -.18, cz2: -.1, mx: (o.a + o.b) / 2, mz: -.5, label: `${name} ${k ? '뒷문' : '앞문'}`, floor: f });
          if (!k) { box('white', o.a, o.b + .3, y0 + 2.2, y0 + 2.4, -.16, -.12); if (!(type === 'bcast' && LY.rooms.filter(q => q.kind === 'class').indexOf(r) > 0 && PLAN[f][idx - 1] === 'bcast')) roomSign(/^\d학년 \d+반$/.test(name) ? name.replace(/^(\d)학년 (\d+)반$/, '$1-$2') : name.split(' · ')[0], o.a - .3, y0 + 2.3, -.1); } else if (type.includes('+')) { box('white', o.a, o.b + .3, y0 + 2.2, y0 + 2.4, -.16, -.12); roomSign(name.split(' · ')[1], o.a - .3, y0 + 2.3, -.1); }
          if (type === 'bcast') { box('red', o.a + .25, o.b - .25, y0 + 2.45, y0 + 2.6, -.2, -.14); box('rubber', o.a - .02, o.b + .02, y0, y0 + .04, -.2, -.1); } });   // 방송실: 방음 철문 · 문 위 ON AIR 등
        box('glass', r.x1 + 2.4, r.x2 - 2.4, y0 + 1.6, y0 + 2.4, -.01, .01);
        // 교실 사이 칸막이벽 (동측) — 마지막 교실은 코어 · 계단실 벽이 대신한다
        { const nx = LY.rooms[LY.rooms.indexOf(r) + 1]; if (nx && nx.kind === 'class') { if (type === 'bcast' && PLAN[f][idx + 1] === 'bcast') box('wood', r.x2 - S.wall / 2 - .01, r.x2 + S.wall / 2 + .01, y0, y0 + .02, S.wall / 2, zS); else wallZ('wall', r.x2 - S.wall / 2, r.x2 + S.wall / 2, 0, zS, y0); } }
        classroom(r, f, y0, type, name);
      } else if (r.kind === 'stair') {
        { const xi = r.x1 < 0 ? r.x2 : r.x1; wallZ('conc', xi - S.wall / 2, xi + S.wall / 2, zN, zS, y0, [{ a: zN + .1, b: zN + 2.6, y1: 0, y2: 2.2 }]);
          // 갑종 방화문 양개 (평소 자석으로 열어 둔 상태 — 계단실 쪽으로 젖혀진다)
          const w = 1.25, sx = r.x1 < 0 ? -1 : 1;
          [[zN + .1, 1], [zN + 2.6, -1]].forEach(([hz, sz]) => doors.push({ kind: 'swing', axisZ: true, mat: 'steelG', win: true, w, h: 2.18, t: .05, px: xi, py: y0, pz: hz, ox: 0, oz: sz * w / 2, dir: sx * sz, open: true,
            cx1: xi - .1, cx2: xi + .1, cz1: Math.min(hz, hz + sz * w), cz2: Math.max(hz, hz + sz * w), mx: xi + (r.x1 < 0 ? .6 : -.6), mz: zN + 1.35, label: '계단실 방화문', floor: f })); }   // 복도 쪽 벽만 (바깥쪽은 외벽), 방화문 개구부
        { const xi = r.x1 < 0 ? r.x2 : r.x1, sd = r.x1 < 0 ? -1 : 1;
          finishZ(xi - sd * S.wall / 2, -sd, zN + 2.6, zS, y0); finishZ(xi + sd * S.wall / 2, sd, zN + 2.6, zS, y0); }   // 계단실 칸막이벽 양면 마감 (문 개구부 남쪽)
        if (f > 0) box('terr', r.x1, r.x2, y0 - S.slab - .004, y0 + .02, zN + 2.77, zN + 2.81);   // 층 참 슬래브 끝 마감 (노출 콘크리트 단면 가리기)
        stair(r, f, y0);
      } else if (r.kind === 'cstair') {
        centerStair(r, f, y0);
      } else if (r.kind === 'core') {
        coreRoom(r, f, y0);
      }
    });
    // 복도: 형광등 · 감지기 · 유도등 · 소화전함 · 소화기
    for (let x = -LY.L / 2 + 3; x < LY.L / 2 - 2; x += 4.5) { fluor(x, y0 + S.CEIL - .05, zN / 2, true); }
    LY.rooms.filter(r => r.kind === 'class').forEach((r, i) => {
      extinguisher(r.x1 + .35, y0, -.32, Math.PI); if (i % 2 === 0) hydrant(r.x2 - .95, y0, zN + .05, f);   // 창과 창 사이 벽(기둥 옆)에 — 창 앞에 떠 있지 않게
      detector(r.x1 + 4.5, y0 + S.CEIL, zN / 2);
      [[3, 3.3], [6, 3.3], [3, 6.8], [6, 6.8]].forEach(([dx, z]) => sprink(r.x1 + dx, y0 + S.CEIL, z));   // 교실 스프링클러 헤드 (2008 소방 보강)
    });
    for (let x = -LY.L / 2 + 5.25; x < LY.L / 2 - 2; x += 4.5) sprink(x, y0 + S.CEIL, zN / 2);   // 복도 스프링클러 헤드 — 형광등 사이 (2008 소방 보강)
    LY.rooms.filter(r => r.kind === 'stair').forEach(r => exitSign((r.x1 + r.x2) / 2 + (r.x1 < 0 ? 3 : -3), y0 + 2.35, zN / 2, true));
    // 복도 실사 소품: 발신기(화재경보) · 복도 끝 CCTV · 계단실 앞 화분 · 화장실 앞 미끄럼 주의 표지
    LY.rooms.filter(r => r.kind === 'class').forEach((r, i) => { if (i % 2 === 0) mdl('fire_alarm', r.x2 + .75, y0 + 1.45, zN + .01); });   // 소화전 맞은편 기둥 옆 벽
    // 1998년 복도 게시물: 앞문과 복도 창 사이 벽에 A4 한 장씩 (가정통신문 · 급식표 · 학급 시간표 · 대회 포스터 · 표어) — 압정 · 누렇게 바랜 종이
    LY.rooms.filter(r => r.kind === 'class').forEach((r, i) => { const k = (i + f * 3) % NOTICES.length; const p = canvasPlane(.42, .58, 256, 354, (g, W, H) => drawNotice(g, W, H, NOTICES[k]), 'notice' + k, false); p.position.set(r.x2 + .38, y0 + 1.45, zN + .014); p.rotation.set(0, 0, (k % 3 - 1) * .03); root.add(p); });
    [-1, 1].forEach(sx => mdl('security_camera_01', sx * (LY.L / 2 - .5), y0 + S.CEIL - .15, zN + .35, sx > 0 ? -Math.PI / 2 : Math.PI / 2));
    LY.rooms.filter(r => r.kind === 'stair').forEach(r => { const x = r.x1 < 0 ? r.x2 + .5 : r.x1 - .5; mdl('potted_plant_04', x, y0, zN + .35, 0, { s: 2.6 }); });
    // 계단실 앞 화분 옆 분리수거함 3통 (일반 · 캔 · 페트, 1998년형 플라스틱) — 북쪽 벽에 붙여 복도 폭 3.2m 는 그대로
    LY.rooms.filter(r => r.kind === 'stair').forEach(r => { const sg = r.x1 < 0 ? 1 : -1, x0 = r.x1 < 0 ? r.x2 + .95 : r.x1 - .95;
      ['recycB', 'recycY', 'recycG'].forEach((k, i) => { const xa = x0 + sg * i * .42, xb = xa + sg * .38; box(k, Math.min(xa, xb), Math.max(xa, xb), y0, y0 + .7, zN + .04, zN + .42, { solid: true }); box('rubber', Math.min(xa, xb) + .02, Math.max(xa, xb) - .02, y0 + .7, y0 + .73, zN + .06, zN + .4); box('rubber', Math.min(xa, xb) + .1, Math.max(xa, xb) - .1, y0 + .731, y0 + .735, zN + .15, zN + .3); });
      // 분리수거함 위 복도 게시판 (2008: 가정통신문 · 방과후학교 · 학교폭력 예방) + 축광 피난구 유도표지
      const xm = x0 + sg * .62; corkBoard(xm - .66, xm + .66, y0 + 1.15, y0 + 1.75, zN, 1); { const g = new THREE.PlaneGeometry(1.28, .48); g.translate(xm, y0 + 1.45, zN + .024); G('notice08', g); }
      { const g = new THREE.PlaneGeometry(.5, .19); g.translate(xm, y0 + 2.0, zN + .012); G('exitPicto', g); } });
    { const c = LY.rooms.find(r => r.kind === 'core'); if ((f + 1) % 2) mdl('WetFloorSign_01', c.x1 + 1.5, y0, -.9, .6); }
    era08Corridor(f, y0);   // 2008 복도 설비 (정수기 · CCTV · 감지기 · 비상조명등 · 스피커 · 소화기 표지)
  }
  // 옥상 슬래브 + 파라펫
  const yr = yf(S.floors), eSt = opt.roofStair ? LY.rooms.filter(r => r.kind === 'stair').pop() : null, zA_ = zN + 2.8, zL_ = eSt ? SG(eSt).zL : zS;
  const ups = opt.roofStair ? LY.rooms.filter(r => isSt(r) && r.x1 > 0).sort((a, b) => a.x1 - b.x1) : [];   // 옥상까지 오르는 계단(동쪽 끝 · 중앙 계단): 그 위 슬래브를 뚫는다 — 중앙 계단은 판에 막혀 머리가 뚫고 나가던 것
  if (ups.length) { let cx = -LY.L / 2 - T;
    for (const u of ups) { const g = SG(u); box('conc', cx, u.x1, yr - S.slab, yr, zN - T, zS + T); box('conc', u.x1, u.x2, yr - S.slab, yr, zN - T, zN);   /* 옥탑 층 참(인조석 판, zN ~ zA)이 이 자리를 덮는다 — 옥상 슬래브와 같은 높이로 겹쳐 깜빡이던 것 */ box('conc', u.x1, u.x2, yr - S.slab, yr, g.zL, zS + T); cx = u.x2; }
    box('conc', cx, LY.L / 2 + T, yr - S.slab, yr, zN - T, zS + T);
  } else box('conc', -LY.L / 2 - T, LY.L / 2 + T, yr - S.slab, yr, zN - T, zS + T);
  box('brick', -LY.L / 2 - T, LY.L / 2 + T, yr, yr + 1.1, zS, zS + T, { solid: true }); box('brick', -LY.L / 2 - T, LY.L / 2 + T, yr, yr + 1.1, zN - T, zN, { solid: true });
  if (opt.roofStair) {
    // ── 옥상 리모델링: 우레탄 방수 바닥 · 사방 파라펫 + 안전 난간 · 실외기 · 물탱크 · 통신 철탑 · 투광등 · 버려진 옥상 텃밭 ──
    mat.roofLine = M('roofLine', () => new THREE.MeshStandardMaterial({ color: 0xd8c860, roughness: .7 }));
    const X1 = -LY.L / 2, X2 = LY.L / 2, P = .02;
    { const segs = []; let cx = X1;   // 옥상 바닥: 옥탑 계단실(동쪽 끝 · 중앙 계단) 자리만 남쪽 일부로
      for (const u of ups) { const g = SG(u); if (u.x1 - .2 > cx) segs.push([cx, u.x1 - .2, zN]); segs.push([u.x1 - .2, Math.min(X2, u.x2 + .2), g.zL + .2]); cx = Math.min(X2, u.x2 + .2); }
      if (cx < X2) segs.push([cx, X2, zN]);
      for (const [a, b, z1] of segs) { box('roofCoat', a, b, yr, yr + P, z1, zS); walk.push({ x1: a, x2: b, z1, z2: zS, h: () => yr + P, f: S.floors }); } }
    box('brick', X1 - T, X1, yr, yr + 1.1, zN - T, zS + T, { solid: true }); box('brick', X2, X2 + T, yr, yr + 1.1, zN - T, zS + T, { solid: true });
    box('conc', X1 - T - .04, X2 + T + .04, yr + 1.1, yr + 1.18, zS - .04, zS + T + .04); box('conc', X1 - T - .04, X2 + T + .04, yr + 1.1, yr + 1.18, zN - T - .04, zN + .04);
    box('conc', X1 - T - .04, X1 + .04, yr + 1.1, yr + 1.18, zN, zS); box('conc', X2 - .04, X2 + T + .04, yr + 1.1, yr + 1.18, zN, zS);
    for (let x = X1 + 1; x < X2; x += 2.4) [zN + .12, zS - .12].forEach(z => box('deskLeg', x - .02, x + .02, yr + 1.18, yr + 1.75, z - .02, z + .02));   // 파라펫 위 안전 난간
    [zN + .12, zS - .12].forEach(z => box('deskLeg', X1, X2, yr + 1.72, yr + 1.77, z - .025, z + .025));
    // 노란 보행 안내선 (옥탑 출입문 → 서쪽)
    box('roofLine', X1 + 2, eSt.x1 - .3, yr + P, yr + P + .005, 1.95, 2.05); box('roofLine', X1 + 2, eSt.x1 - .3, yr + P, yr + P + .005, 3.95, 4.05);
    // 루프 드레인
    for (let x = X1 + 4; x < X2 - 8; x += 12) { box('rubber', x - .15, x + .15, yr + P, yr + P + .03, zS - .55, zS - .25); box('rubber', x - .15, x + .15, yr + P, yr + P + .03, zN + .25, zN + .55); }
    // 에어컨 실외기 8대 (팬 격자 + 받침) — 남쪽 파라펫 따라
    for (let k = 0; k < 8; k++) { const x = X1 + 8 + k * 3.2, z = zS - 1.0;
      box('rubber', x - .5, x + .5, yr, yr + .12, z - .4, z + .4); box('steelG', x - .45, x + .45, yr + .12, yr + .82, z - .32, z + .32, { solid: true });
      box('rubber', x - .3, x + .3, yr + .2, yr + .74, z - .33, z - .325); box('rubber', x - .02, x + .02, yr + .2, yr + .74, z - .336, z - .33); box('rubber', x - .3, x + .3, yr + .45, yr + .49, z - .336, z - .33);
      if (k % 2 === 0) box('deskLeg', x + .3, x + .35, yr + .5, yr + 1.0, z + .32, z + .36); }   // 냉매관
    // 물탱크 2기 (서쪽) — 원통 + 받침 철골 + 사다리
    [[X1 + 4, 1.6], [X1 + 4, 5.2]].forEach(([x, z]) => { box('frp', x - 1.25, x + 1.25, yr + 1.0, yr + 3.4, z - 1.25, z + 1.25);   // FRP 조립식 물탱크 (2000년대 교체 — 예전 철제 원통)
      box('frp', x - .3, x + .3, yr + 3.4, yr + 3.5, z - .3, z + .3); box('steelG', x - .25, x + .25, yr + 3.5, yr + 3.53, z - .25, z + .25);   // 맨홀 뚜껑
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box('deskLeg', x + dx * .9 - .05, x + dx * .9 + .05, yr, yr + 1.0, z + dz * .9 - .05, z + dz * .9 + .05);
      box('steelG', x - 1.3, x + 1.3, yr + .95, yr + 1.0, z - 1.3, z + 1.3); col.push({ x1: x - 1.35, x2: x + 1.35, z1: z - 1.35, z2: z + 1.35, y1: yr, y2: yr + 3.5 });
      for (let k = 0; k < 9; k++) box('deskLeg', x + 1.3, x + 1.36, yr + .3 + k * .35, yr + .33 + k * .35, z - .25, z + .25); box('deskLeg', x + 1.3, x + 1.36, yr, yr + 3.4, z - .27, z - .23); box('deskLeg', x + 1.3, x + 1.36, yr, yr + 3.4, z + .23, z + .27); });
    // 통신 철탑 (옥탑 서쪽) + 피뢰침 + 경고등
    { const x = eSt.x1 - 3, z = zN + 1.2; for (const [dx, dz] of [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]]) box('deskLeg', x + dx - .04, x + dx + .04, yr, yr + 7, z + dz - .04, z + dz + .04);
      for (let y = yr + .8; y < yr + 7; y += 1.1) { box('deskLeg', x - .44, x + .44, y, y + .04, z - .44, z - .4); box('deskLeg', x - .44, x + .44, y, y + .04, z + .4, z + .44); box('deskLeg', x - .44, x - .4, y, y + .04, z - .44, z + .44); box('deskLeg', x + .4, x + .44, y, y + .04, z - .44, z + .44); }
      box('deskLeg', x - .015, x + .015, yr + 7, yr + 8.4, z - .015, z + .015); box('lamp', x - .08, x + .08, yr + 7.05, yr + 7.2, z - .08, z + .08);
      const dish = new THREE.Mesh(new THREE.SphereGeometry(.55, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3), mat.steelG); dish.position.set(x + .5, yr + 4.6, z + .2); dish.rotation.set(-1.2, 0, .4); root.add(dish);
      col.push({ x1: x - .5, x2: x + .5, z1: z - .5, z2: z + .5, y1: yr, y2: yr + 7 }); }
    // 투광등 4기 (파라펫 모서리)
    [[X1 + .5, zN + .5], [X1 + .5, zS - .5], [eSt.x1 - 1, zS - .5], [0, zN + .5]].forEach(([x, z]) => { box('deskLeg', x - .04, x + .04, yr, yr + 2.6, z - .04, z + .04); box('steelG', x - .22, x + .22, yr + 2.5, yr + 2.8, z - .12, z + .12); box('lamp', x - .18, x + .18, yr + 2.52, yr + 2.56, z - .1, z + .1); lights.push({ x, y: yr + 2.4, z }); });
    // 버려진 옥상 텃밭 (스티로폼 상자 + 마른 흙) · 낡은 벤치 · 빨랫줄
    for (let k = 0; k < 6; k++) { const x = -6 + k * 1.1; box('white', x - .45, x + .45, yr, yr + .35, zS - 2.6, zS - 2.0, { solid: true }); box('wood', x - .42, x + .42, yr + .3, yr + .34, zS - 2.57, zS - 2.03); }
    box('wood', 4, 6, yr + .42, yr + .47, zN + .6, zN + 1.0); [4.2, 5.8].forEach(x => box('deskLeg', x - .04, x + .04, yr, yr + .42, zN + .62, zN + .98)); box('wood', 4, 6, yr + .47, yr + .9, zN + .58, zN + .62);
    col.push({ x1: 4, x2: 6, z1: zN + .55, z2: zN + 1.05, y1: yr, y2: yr + .9 });
    [-14, -4].forEach(x => box('deskLeg', x - .03, x + .03, yr, yr + 1.9, 1.0, 1.06)); box('deskLeg', -14, -4, yr + 1.85, yr + 1.87, 1.02, 1.04);
    // 서쪽 계단실 위 옥탑 (닫힌 기계실)
    { const w = LY.rooms.find(r => r.kind === 'stair'); box('conc', w.x1 - .2, w.x2 + .2, yr, yr + 2.6, zN - .2, zN + 3.2, { solid: true }); box('conc', w.x1 - .3, w.x2 + .3, yr + 2.6, yr + 2.8, zN - .3, zN + 3.3); box('steelG', w.x2 + .2, w.x2 + .23, yr, yr + 2.0, zN + .8, zN + 1.8); }
  }
  // 층간 띠 (외관 수평선)
  exteriorKit();
  for (let f = 1; f <= S.floors; f++) { box('trim', -LY.L / 2 - T - .05, LY.L / 2 + T + .05, yf(f) - .3, yf(f) - .002, zS + T - .015, zS + T + .08); }


  // ── 2008 외관 리모델링 키트: 치장벽돌 기둥 피복 · PVC 선홈통 · 벽걸이 에어컨 실외기 · 금속 교명 글자 · 별관 옥상 설비 · 비상구 바깥 유도등 ──
  function exteriorKit() {
    const L2 = LY.L / 2, N = S.floors, top = yr + 1.1;
    const xs = [...new Set(LY.rooms.flatMap(r => [r.x1, r.x2]).map(x => +x.toFixed(3)))];
    // 기둥 피복 (남 · 북 외벽, 바닥 ~ 파라펫 위): 미색 벽면을 세로로 나누는 적갈색 치장벽돌 — 2000년대 학교 리모델링 외관
    const coreR = LY.rooms.find(r => r.kind === 'core');
    // 북쪽 층간 띠 (남쪽과 같은 백색 띠 — 슬래브 끝 노출 콘크리트를 덮는다), 구름다리 접합부는 비운다
    for (let f = 1; f <= N; f++) { const y1 = yf(f) - .3, y2 = yf(f) - .002, z1 = zN - T - .08, z2 = zN - T + .015, X = L2 + T + .05;
      if (opt.bridge && f === 1) { box('trim', -X, coreR.x1 + .5, y1, y2, z1, z2); box('trim', coreR.x2 - .5, X, y1, y2, z1, z2); } else box('trim', -X, X, y1, y2, z1, z2); }
    xs.forEach(x => { box('plinth', x - .27, x + .27, 0, top, zS + T - .02, zS + .42, { solid: true });
      if (!(opt.bridge && x > coreR.x1 + .5 && x < coreR.x2 - .5)) box('plinth', x - .27, x + .27, 0, top, zN - T - .12, zN - T + .02, { solid: true }); });
    // 모서리 기둥 (동 · 서 끝): 벽돌 귀퉁이
    [-1, 1].forEach(sx => { const xo = sx * (L2 + T); [[zS + T - .5, zS + T + .02], [zN - T - .02, zN - T + .5]].forEach(([za, zb]) => box('plinth', Math.min(xo - sx * .02, xo + sx * .1), Math.max(xo - sx * .02, xo + sx * .1), 0, top, za, zb, { solid: true })); });
    // PVC 선홈통 (옥상 루프 드레인 → 지면): 피복 기둥 옆, 코어 · 현관 · 구름다리 쪽은 피한다
    const pipe = (x, z, out) => { const g = new THREE.CylinderGeometry(.05, .05, top - .15, 10); g.translate(x, (top - .15) / 2 + .05, z); G('pvc', g);
      for (let y = 1.2; y < top - .5; y += S.FH) box('pvc', x - .06, x + .06, y, y + .04, Math.min(z, z - out * .1), Math.max(z, z - out * .1));   // 고정 밴드
      box('pvc', x - .07, x + .07, top - .25, top - .05, Math.min(z - out * .02, z + out * .12), Math.max(z - out * .02, z + out * .12));   // 깔때기 (집수기)
      box('pvc', x - .07, x + .07, 0, .12, Math.min(z, z + out * .22), Math.max(z, z + out * .22)); };   // 지면 엘보
    LY.rooms.forEach((r, i) => { if (r.kind === 'core' || r.kind === 'cstair' || i % 2) return; const x = r.x1 + .4;
      pipe(x, zS + T + .07, 1); if (!(opt.bridge && x > coreR.x1 - 1 && x < coreR.x2 + 1)) pipe(x, zN - T - .07, -1); });
    // 벽걸이 에어컨 실외기 (2008 교실 냉방 설치): 동 · 서 마구리벽 층마다 2대 — 철제 앵글 받침 + 냉매관이 벽으로 들어간다
    const ac = (xw, sx, y, z) => { const xa = xw + sx * .05, xb = xw + sx * .4;
      box('acUnit', Math.min(xa, xb), Math.max(xa, xb), y, y + .62, z - .42, z + .42);
      box('rubber', Math.min(xb, xb + sx * .005), Math.max(xb, xb + sx * .005), y + .1, y + .52, z - .3, z + .12);   // 팬 격자
      box('acUnit', Math.min(xb, xb + sx * .01), Math.max(xb, xb + sx * .01), y + .1, y + .52, z - .095, z - .085); box('acUnit', Math.min(xb, xb + sx * .01), Math.max(xb, xb + sx * .01), y + .305, y + .315, z - .3, z + .12);
      [z - .33, z + .33].forEach(zz => { box('deskLeg', Math.min(xw, xb + sx * .02), Math.max(xw, xb + sx * .02), y - .04, y, zz - .02, zz + .02); box('deskLeg', Math.min(xw, xw + sx * .04), Math.max(xw, xw + sx * .04), y - .4, y, zz - .02, zz + .02); });   // 앵글 받침
      const pg = new THREE.CylinderGeometry(.025, .025, .9, 8); pg.translate(xw + sx * .07, y + .9, z + .3); G('acUnit', pg); };
    [-1, 1].forEach(sx => { const xw = sx * (L2 + T); for (let f = 1; f < N; f++) [2.6, 6.8].forEach(z => ac(xw, sx, yf(f) + .5, z)); });
    // 교명 금속 글자 (남쪽 파라펫, 정문 · 운동장을 본다): 스테인리스 채널 글자 + 벽에 지는 그림자
    const LTR = opt.letters ?? (opt.southEntry ? '서문고등학교' : null);
    if (LTR) { const txt = LTR, W = Math.min(coreR.x2 - coreR.x1 - 1.2, txt.length * 1.05), H = .78, cx = (coreR.x1 + coreR.x2) / 2;
      const draw = shadow => (g, w, h) => { g.clearRect(0, 0, w, h); g.font = `bold ${h * .8 | 0}px "Noto Sans KR", "Malgun Gothic", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        if (shadow) { g.fillStyle = 'rgba(40,36,30,.55)'; g.fillText(txt, w / 2, h / 2 + 4, w - 8); return; }
        const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f6f8fa'); gr.addColorStop(.45, '#aeb4ba'); gr.addColorStop(.55, '#c8ced4'); gr.addColorStop(1, '#7e868e'); g.fillStyle = gr; g.fillText(txt, w / 2, h / 2, w - 8);
        g.lineWidth = 3; g.strokeStyle = 'rgba(60,64,70,.7)'; g.strokeText(txt, w / 2, h / 2, w - 8); };
      const sh = canvasPlane(W, H, 1024, 128, draw(true), 'ltrS_' + txt, true), lt = canvasPlane(W, H, 1024, 128, draw(false), 'ltr_' + txt, true);
      lt.material.metalness = .7; lt.material.roughness = .3; lt.material.alphaTest = .3; sh.material.depthWrite = false;
      sh.position.set(cx + .03, yr + .52, zS + T + .004); lt.position.set(cx, yr + .55, zS + T + .05); root.add(sh); root.add(lt); }
    // 별관 · 일반 옥상 (출입 없음): 실외기 · FRP 물탱크 · 파라펫 갓돌 + 안전 난간
    if (!opt.roofStair) {
      box('trim', -L2 - T - .04, L2 + T + .04, yr + 1.1, yr + 1.16, zS - .04, zS + T + .04); box('trim', -L2 - T - .04, L2 + T + .04, yr + 1.1, yr + 1.16, zN - T - .04, zN + .04);
      box('brick', -L2 - T, -L2, yr, yr + 1.1, zN, zS, { solid: true }); box('brick', L2, L2 + T, yr, yr + 1.1, zN, zS, { solid: true });
      box('trim', -L2 - T - .04, -L2 + .04, yr + 1.1, yr + 1.16, zN + .04, zS - .04); box('trim', L2 - .04, L2 + T + .04, yr + 1.1, yr + 1.16, zN + .04, zS - .04);
      box('roofCoat', -L2, L2, yr, yr + .015, zN, zS);   // 녹색 우레탄 방수 바닥
      for (let x = -L2 + 1; x < L2; x += 2.4) [zN + .15, zS - .15].forEach(z => box('deskLeg', x - .02, x + .02, yr + 1.16, yr + 1.7, z - .02, z + .02));
      [zN + .15, zS - .15].forEach(z => box('deskLeg', -L2 + .5, L2 - .5, yr + 1.66, yr + 1.71, z - .025, z + .025));
      for (let k = 0; k < 5; k++) { const x = -L2 + 6 + k * 3.0, z = zS - 1.0; box('rubber', x - .5, x + .5, yr + .015, yr + .12, z - .4, z + .4); box('acUnit', x - .45, x + .45, yr + .12, yr + .82, z - .32, z + .32, { solid: true }); box('rubber', x - .3, x + .3, yr + .2, yr + .74, z + .32, z + .326); }
      { const x = L2 - 3.5, z = (zN + zS) / 2; [-1, 1].forEach(dx => [-1, 1].forEach(dz => box('deskLeg', x + dx * 1 - .05, x + dx * 1 + .05, yr, yr + .6, z + dz * 1 - .05, z + dz * 1 + .05))); box('steelG', x - 1.1, x + 1.1, yr + .6, yr + .65, z - 1.1, z + 1.1); box('frp', x - 1.05, x + 1.05, yr + .65, yr + 2.65, z - 1.05, z + 1.05, { solid: true }); }
    }
    // 별관 양 끝 비상구: 바깥 문 위 유도등
    if (opt.endExits) [-1, 1].forEach(sx => exitSign(sx * (L2 + T + .04), 2.32, zN + .95, true));
  }
  // ── 교실 ──
  function roomName(f, idx) { const t = PLAN[f][idx]; if (t.includes('+')) return t.split('+').map(q => (opt.prefix || '') + ROOM_NAME[q]).join(' · '); if (t !== 'class') return (opt.prefix || '') + ROOM_NAME[t]; const n = PLAN[f].slice(0, idx + 1).filter(q => q === 'class').length; if (opt.classLabel) return opt.classLabel(f, n); return `${f + 1}학년 ${n}반`; }
  // 교실 앞면 꾸밈: 칠판 오른쪽에만 날짜 · 주번(반마다 다른 이름) · 전달사항, 칠판 옆 시간표, 칠판 위 가운데 태극기 액자 · 왼쪽 교훈 액자
  function classDecor(name, x1, zc, y0) {
    let hsh = 0; for (const ch of name) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
    const a = NAMES[hsh % NAMES.length], b = NAMES[(hsh >>> 5) % NAMES.length] === a ? NAMES[(hsh + 7) % NAMES.length] : NAMES[(hsh >>> 5) % NAMES.length];
    const put = (mesh, y, z) => { mesh.position.set(x1 + .046, y, z); mesh.rotation.y = Math.PI / 2; root.add(mesh); };
    // 칠판 필기: 칠판 전체 크기의 투명 판 — 보는 사람 기준 오른쪽 1/3 에만 분필 글씨
    put(canvasPlane(4.8, 1.2, 1536, 384, (g, w, h) => { g.clearRect(0, 0, w, h); const x = w * .7; g.strokeStyle = 'rgba(235,235,225,.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 30, 30); g.lineTo(x - 30, h - 30); g.stroke();
      g.fillStyle = 'rgba(242,242,232,.85)'; g.font = 'bold 50px serif'; g.fillText('10월 10일 (금)  수능 D-34', x, 90); g.font = 'bold 44px serif'; g.fillText(`주번: ${a}`, x, 170); g.fillText(`        ${b}`, x, 230);
      g.font = '36px serif'; g.fillStyle = 'rgba(242,242,232,.7)'; g.fillText('※ 7교시 후 청소', x, 310); }, null, true), y0 + 1.55, zc);
    // 시간표 (칠판 오른쪽 벽): 흰 종이 + 요일 칸
    const z2 = zc - 2.4 - .65;
    put(canvasPlane(.8, 1.05, 320, 420, (g, w, h) => { g.fillStyle = '#f2efe4'; g.fillRect(0, 0, w, h); g.fillStyle = '#1c2a3a'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.fillText(`${name} 시간표`, w / 2, 32); g.font = '15px sans-serif'; g.fillText('2008학년도 2학기', w / 2, 52);
      const D = ['월', '화', '수', '목', '금'], S2 = ['국어', '수학', '영어', '과학', '사회', '체육', '음악', '미술', '도덕', '기가']; g.font = '18px sans-serif'; g.strokeStyle = '#6a7380'; g.lineWidth = 1;
      for (let c = 0; c <= 5; c++) { g.beginPath(); g.moveTo(20 + c * 56, 60); g.lineTo(20 + c * 56, h - 20); g.stroke(); } for (let r = 0; r <= 8; r++) { g.beginPath(); g.moveTo(20, 60 + r * 42.5); g.lineTo(w - 20, 60 + r * 42.5); g.stroke(); }
      D.forEach((d, c) => g.fillText(d, 48 + c * 56, 88)); for (let r = 1; r < 8; r++) for (let c = 0; c < 5; c++) g.fillText(S2[(hsh + r * 3 + c * 7) % S2.length], 48 + c * 56, 88 + r * 42.5); }, 'tt:' + name), y0 + 1.6, z2);
    // 칠판 위: 가운데 태극기 액자 · 왼쪽 교훈 액자 (나무 테두리)
    flagTex = flagTex || makeFlag();
    const frame = (w, h, y, z, mat) => { const fr = new THREE.Mesh(new THREE.BoxGeometry(.03, h + .06, w + .06), M('frameWood', () => new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: .6 }))); fr.position.set(x1 + .03, y, z); root.add(fr); const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); p.position.set(x1 + .047, y, z); p.rotation.y = Math.PI / 2; root.add(p); };
    frame(.6, .4, y0 + 2.68, zc, M('flagFrame', () => new THREE.MeshStandardMaterial({ map: flagTex, roughness: .7 })));
    frame(1.3, .34, y0 + 2.68, zc + 1.35, canvasPlane(1.3, .34, 520, 136, (g, w, h) => { g.fillStyle = '#f4f0e2'; g.fillRect(0, 0, w, h); g.fillStyle = '#7a1a1a'; g.font = 'bold 30px serif'; g.textAlign = 'center'; g.fillText('교  훈', w / 2, 44); g.fillStyle = '#1a1a1a'; g.font = 'bold 40px serif'; g.fillText('성실 · 정직 · 봉사', w / 2, 104); }, 'motto').material);
    // 칠판 위 오른쪽: 급훈 액자 (반마다 다른 문구, 붓글씨 느낌)
    { const GH = ['하면 된다', '최선을 다하자', '꿈은 이루어진다', '서로 돕고 아끼자', '오늘 흘린 땀은 내일의 웃음'], gi = hsh % GH.length;
      frame(1.3, .34, y0 + 2.68, zc - 1.35, canvasPlane(1.3, .34, 520, 136, (g, w, h) => { g.fillStyle = '#f6f2e6'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a3a6a'; g.font = 'bold 30px serif'; g.textAlign = 'center'; g.fillText('급  훈', w / 2, 44); g.fillStyle = '#1a1a1a'; g.font = `bold ${GH[gi].length > 8 ? 32 : 40}px serif`; g.fillText(GH[gi], w / 2, 104); }, 'gh' + gi).material); }
  }
  function classroom(r, f, y0, type = 'class', name = '') {
    const x1 = r.x1 + S.wall / 2, x2 = r.x2 - S.wall / 2, z1 = S.wall / 2, z2 = zS;
    if (!type.startsWith('toilet')) box('deco', x1, x2, y0, y0 + .02, z1, z2);   // 2008 교실 바닥: PVC 데코타일 300각 (예전 참나무 마루 스캔) — 특별실은 제 바닥을 위에 덧깐다 · 화장실 칸은 타일 바닥을 따로 깐다
    const wetRoom = type.startsWith('toilet');   // 화장실 칸은 타일 벽이 마감을 대신한다 (페인트 · 징두리 마감과 같은 면에 겹쳐 깜박이던 것)
    if (!wetRoom) finishX(x1, x2, z2 - .001, -1, y0, [{ a: x1 + .4, b: x2 - .4, y1: .9, y2: 2.4 }]);
    for (let k = 0; k < 4; k++) radiator(x1 + 1 + k * 2, x1 + 2.2 + k * 2, y0 + .15, z2 - .2, z2 - .08);   // 창 아래 주물 라디에이터
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) fluor(x1 + 1.6 + i * 2.9, y0 + S.CEIL - .05, z1 + 1.3 + j * 2.4, false);
    detector((x1 + x2) / 2, y0 + S.CEIL, (z1 + z2) / 2);
    if (type.includes('+')) {   // 한 칸을 칸막이로 나눈 두 방 (앞문 → 서쪽 방, 뒷문 → 동쪽 방)
      const [ta, tb] = type.split('+'), xm = (x1 + x2) / 2, [na, nb] = name.split(' · ');
      wallZ('wall', xm - S.wall / 2, xm + S.wall / 2, S.wall / 2, zS, y0); if (!wetRoom) { finishZ(xm - S.wall / 2, -1, S.wall / 2, zS, y0); finishZ(xm + S.wall / 2, 1, S.wall / 2, zS, y0); }
      props.push({ kind: 'room', type: ta, label: na, x: (x1 + xm) / 2, y: y0, z: (z1 + z2) / 2, floor: f, x1, x2: xm - S.wall / 2, z1, z2 });
      props.push({ kind: 'room', type: tb, label: nb, x: (xm + x2) / 2, y: y0, z: (z1 + z2) / 2, floor: f, x1: xm + S.wall / 2, x2, z1, z2 });
      if (ta === 'toiletM') { props.pop(); props.pop(); toiletRoom(x1 - .1, xm - S.wall / 2 + .1, '남', f, y0); toiletRoom(xm + S.wall / 2 - .1, x2 + .1, '여', f, y0); return; }   // 1층 화장실 2개 (남 · 여)
      special(ta, x1, xm - S.wall / 2, z1, z2, y0, f); special(tb, xm + S.wall / 2, x2, z1, z2, y0, f); return;
    }
    const nxR = LY.rooms[LY.rooms.indexOf(r) + 1];
    if (type === 'staff' && f === 0 && opt.southEntry && nxR && nxR.kind === 'core') {   // 교무실 · 행정실: 현관 서쪽 2.25m 까지 한 방
      const xe = nxR.x1 + OFFICE_EXT - S.wall / 2;
      box('deco', x2, xe, y0, y0 + .02, z1, z2); finishX(x2, xe, z2 - .001, -1, y0, [{ a: x2 + .3, b: xe - .3, y1: .9, y2: 2.4 }]);
      for (let j = 0; j < 3; j++) fluor(x2 + 1.1, y0 + S.CEIL - .05, z1 + 1.3 + j * 2.4, false);
      props.push({ kind: 'room', type, label: name, x: (x1 + xe) / 2, y: y0, z: (z1 + z2) / 2, floor: f, x1, x2: xe, z1, z2 });
      special('office', x1, xe, z1, z2, y0, f); return;
    }
    props.push({ kind: 'room', type, label: name, x: (x1 + x2) / 2, y: y0, z: (z1 + z2) / 2, floor: f, x1, x2, z1, z2 });
    if (type === 'bcast') { const ci = LY.rooms.filter(q => q.kind === 'class').indexOf(r); if (PLAN[f][ci + 1] === 'bcast') special(type, x1, x2 + S.bay, z1, z2, y0, f); return; }   // 두 칸 방송실: 첫 칸에서 18m 로 한 번에
    if (type !== 'class' && type !== 'empty') { special(type, x1, x2, z1, z2, y0, f); return; }
    // 교단(높이 0.2) + 녹색 칠판 4.8m + 분필 받침 — 앞쪽(서측 벽)
    box('wood', x1, x1 + 1.2, y0, y0 + .2, z1 + 1.2, z2 - 1.2, { solid: false });
    walk.push({ x1, x2: x1 + 1.2, z1: z1 + 1.2, z2: z2 - 1.2, h: () => y0 + .2, f });
    { const g = new THREE.BoxGeometry(.03, 1.2, 4.8); g.translate(x1 + .025, y0 + 1.55, (z1 + z2) / 2); G('chalk', g); }   // 기본 상자 UV: 칠판 면 한 장에 텍스처 1장 (반복 무늬 없이)
    box('tray', x1 + .04, x1 + .12, y0 + .9, y0 + .94, (z1 + z2) / 2 - 2.4, (z1 + z2) / 2 + 2.4);
    { const zc = (z1 + z2) / 2, yt = y0 + .94;   // 분필 받침 위: 칠판지우개 2개(펠트 + 나무 등) · 분필 종이갑 (흰 · 색분필)
      [zc - 1.6, zc + .9].forEach(z => { box('rubber', x1 + .05, x1 + .11, yt, yt + .012, z, z + .14); box('wood', x1 + .055, x1 + .105, yt + .012, yt + .04, z + .005, z + .135); });
      box('white', x1 + .05, x1 + .11, yt, yt + .06, zc - .9, zc - .78); box('recycY', x1 + .05, x1 + .11, yt, yt + .06, zc - .76, zc - .66); }
    if (type === 'class') classDecor(name, x1, (z1 + z2) / 2, y0);   // 칠판 필기(한쪽) · 시간표 · 교훈 · 태극기 액자
    // 교탁
    lectern(x1 + 1.8, (z1 + z2) / 2, y0);
    // 학생 책상 · 의자 6열 × 4줄 = 24석 (줄 사이 0.5m 이상 — 책상 사이로 지나다닐 수 있다) (1인용 650×500, 통로 0.6m)
    // 복도 쪽 1.25m는 앞 · 뒷문 동선으로 비우고, 맨 뒷줄은 뒷문 앞을 막지 않게 1.5m 띄운다
    // 3분단 × 짝꿍 2열: 분단 사이 통로(약 0.7m)로 교실 안 어디든 걸어갈 수 있다
    // 3분단 × 짝꿍 2열 × 4줄 = 24석 — 반듯하게 줄 맞춤, 분단 사이 통로는 같은 너비로, 의자는 책상 쪽으로 붙여 넣는다
    const cols = 6, rows = 4, X0 = x1 + 2.9, XL = x2 - 1.55, dx = (XL - X0) / (rows - 1), PW = 1.48, zA = z1 + 1.2, zB = z2 - 1.0, gStep = (zB - zA - PW) / 2;
    const colZ = j => zA + ((j / 2) | 0) * gStep + (j % 2 ? PW - .37 : .37);
    const zz0 = zA;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const cx = X0 + i * dx, cz = colZ(j);
      // 실사 학교 책걸상 모델 (Poly Haven SchoolDesk_01 · SchoolChair_01) — 칠판(서쪽)을 바라본다
      mdl('SchoolDesk_01', cx, y0, cz, DESK_RY);
      col.push({ x1: cx - .28, x2: cx + .28, z1: cz - .36, z2: cz + .36, y1: y0, y2: y0 + .76 });
      mdl('SchoolChair_01', cx + .5, y0, cz, CHAIR_RY);   // 의자 앞 끝이 책상 뒤에 살짝 들어가되 겹치지 않게
    }
    if (type === 'class') {   // 데코타일 위 닳은 동선: 분단 사이 통로 · 교탁 앞 · 복도 쪽 문 동선 (교실 한 칸 = 텍스처 한 장)
      const W = x2 - x1, D = z2 - z1, lanes = [0, 1].map(k => [(zA + k * gStep + PW - z1) / D, (zA + (k + 1) * gStep - z1) / D]);
      mat.wear = mat.wear || M('wear', () => PT.MAT.wear(lanes, [1.2 / W, (X0 - .45 - x1) / W]));
      const g = new THREE.PlaneGeometry(W, D); g.rotateX(-Math.PI / 2); g.translate((x1 + x2) / 2, y0 + .0215, (z1 + z2) / 2); G('wear', g);
    }
    // 뒤쪽 사물함 (36칸, 높이 1.2) + 게시판
    lockerWall(x2 - .02, z1 + .3, z2 - .3, y0, 1.2);
    corkBoardZ(x2 - .02, -1, z1 + 1, z2 - 1, y0 + 1.4, y0 + 2.4);   // 뒷벽 학급 게시판
    if (type === 'class') { const bp = canvasPlane(2.4, .9, 960, 360, backBoardDraw, 'backBoard08', true); bp.position.set(x2 - .052, y0 + 1.9, z1 + 2.4); bp.rotation.y = -Math.PI / 2; root.add(bp); }   // 2008 학급 게시물: 급식 식단표 · 청소 당번표 · 수능 D-day
    // 3학년 2반(윤하늘의 반): 교탁 위 담임 수첩 · 교환일기 · 개근 스티커판 · 첫 번째 메모
    if (name === '3학년 2반' && !opt.noClues) { clueNote('n27', x1 + 1.8, y0 + 1.0, (z1 + z2) / 2, f, .2); clueNote('n28', x1 + 3.0, y0 + .74, zz0 + .36, f, -.3); clueNote('q1a', x2 - .03 - .05, y0 + 1.3, z1 + 2.0, f); clueNote('n29', x1 + 3.0, y0 + .74, zz0 + 1.08, f, .5); }
    // 태극기 액자 · 스피커 · 시계
    box('white', x1 + .02, x1 + .08, y0 + 2.25, y0 + 2.55, (z1 + z2) / 2 - .35, (z1 + z2) / 2 + .35);   // 태극기 액자
    box('white', x1 + .02, x1 + .06, y0 + 2.3, y0 + 2.6, z1 + .5, z1 + .8);   // 스피커
    mdl('wall_clock', x2 - .03, y0 + 2.4, (z1 + z2) / 2, -Math.PI / 2);   // 뒷벽 벽시계 (실사)
    mdl('ceiling_fan', x1 + 3.4, y0 + S.CEIL, (z1 + z2) / 2 - 1.8); mdl('ceiling_fan', x1 + 6.6, y0 + S.CEIL, (z1 + z2) / 2 + 1.8);   // 천장 선풍기 2대
    // 2008 교실 기본 설비: 칠판 옆 벽걸이 42" PDP TV (브래킷) · 창가 앞 구석 스탠드형 에어컨 · 교탁 옆 교사용 LCD PC
    { const tz = (z1 + z2) / 2 + 2.55; box('alu', x1 + .02, x1 + .2, y0 + 2.15, y0 + 2.25, tz + .4, tz + .5); box('rubber', x1 + .2, x1 + .28, y0 + 1.85, y0 + 2.45, tz - .02, tz + .92); box('screen', x1 + .28, x1 + .285, y0 + 1.89, y0 + 2.41, tz + .02, tz + .88); }
    box('white', x1 + .08, x1 + .5, y0, y0 + 1.8, z2 - .95, z2 - .5, { solid: true }); box('rubber', x1 + .5, x1 + .505, y0 + 1.45, y0 + 1.7, z2 - .9, z2 - .55); box('screen', x1 + .5, x1 + .506, y0 + 1.2, y0 + 1.3, z2 - .8, z2 - .65); box('exitG', x1 + .505, x1 + .51, y0 + 1.25, y0 + 1.27, z2 - .63, z2 - .61);
    box('wood', x1 + 1.95, x1 + 2.55, y0, y0 + .72, (z1 + z2) / 2 + 1.7, (z1 + z2) / 2 + 2.3, { solid: true }); retroPC(x1 + 2.2, y0 + .72, (z1 + z2) / 2 + 2.0, 'x+', { tower: null, kb: true, scale: .85, lcd: true });
    mdl('metal_trash_can', x1 + 1.65, y0, z2 - .5, .4); col.push({ x1: x1 + 1.35, x2: x1 + 1.95, z1: z2 - .8, z2: z2 - .2, y1: y0, y2: y0 + .9 });   // 창가 앞 구석 쓰레기통 (교단 옆 — 뒷줄 의자와 겹치지 않게)
    classExtras(x1, x2, z1, z2, y0);   // 창 커튼 · 청소함
    if (type === 'class') era08Class(name, f, x1, x2, z1, z2, y0);   // 2008: 실물화상기 · 달력 · 환경미화 (203 멀티미디어 설비)
  }
  // 교실 세부: 남쪽 창 커튼(레일 + 양 끝 · 가운데에 묶어 걷은 주름) · 교단 옆 창가 구석 철제 청소함(빗자루 · 대걸레)
  function classExtras(x1, x2, z1, z2, y0) {
    box('alu', x1 + .5, x2 - .3, y0 + 2.5, y0 + 2.53, z2 - .11, z2 - .07);   // 커튼 레일
    for (const cx of [x1 + .78, (x1 + x2) / 2, x2 - .55]) for (let k = 0; k < 5; k++) { const xa = cx - .2 + k * .08, dz = k % 2 ? .02 : 0;   // 주름 5겹 (앞뒤 엇갈림)
      box('clsCurtain', xa, xa + .085, y0 + .95, y0 + 2.5, z2 - .1 - dz, z2 - .075 - dz); }
    const lx1 = x1 + .05, lx2 = x1 + .55, lz1 = z2 - .85, lz2 = z2 - .3;   // 청소함 (W550 D500 H1750, 문은 교실 쪽 +x)
    cabinetD(lx1, lx2, lz1, lz2, y0, 1.75, 'steelG', 'x+');
    for (let k = 0; k < 3; k++) box('rubber', lx2 - .002, lx2 + .004, y0 + 1.55, y0 + 1.6, lz1 + .12 + k * .05, lz1 + .14 + k * .05);   // 환기 갤러리
    const lbl = canvasPlane(.3, .1, 192, 64, (g, w, h) => { g.fillStyle = '#f4f0e2'; g.fillRect(0, 0, w, h); g.strokeStyle = '#333'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4); g.fillStyle = '#222'; g.font = 'bold 38px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('청 소 함', w / 2, h / 2 + 2); }, 'cleanLbl');
    lbl.position.set(lx2 + .033, y0 + 1.35, (lz1 + lz2) / 2); lbl.rotation.y = Math.PI / 2; lbl.name = 'RB_cleanLabel'; root.add(lbl);
    // 청소함 옆 (칠판 쪽) 벽 구석: 벽에 기댄 빨간 플라스틱 빗자루 · 면 대걸레 · 서서 쓰는 쓰레받기 (충돌 상자 안 — 동선 밖)
    const lean = (key, gg, x, y, z, a) => { gg.rotateZ(a); gg.translate(x, y, z); G(key, gg); };
    { const z = lz1 - .14; lean('alu', new THREE.CylinderGeometry(.012, .012, 1.2, 6), x1 + .2, y0 + .66, z, .1); box('broomR', x1 + .2, x1 + .26, y0 + .03, y0 + .12, z - .13, z + .13);   // 빗자루 자루 · 머리
      for (let k = 0; k < 6; k++) box('broomR', x1 + .21, x1 + .25, y0, y0 + .04, z - .12 + k * .045, z - .09 + k * .045); }   // 솔 다발
    { const z = lz1 - .36, yp = y0 + .2;   // 교단 위
      lean('wood', new THREE.CylinderGeometry(.013, .013, 1.3, 6), x1 + .2, yp + .72, z, .08); box('alu', x1 + .2, x1 + .3, yp + .1, yp + .14, z - .06, z + .06);   // 대걸레 자루 · 집게
      for (let k = 0; k < 7; k++) { const a = (k - 3) * .25; box('mop', x1 + .25 + Math.cos(a) * .03 - .03, x1 + .25 + Math.cos(a) * .03 + .01, yp, yp + .12, z + Math.sin(a) * .07 - .018, z + Math.sin(a) * .07 + .018); } }   // 늘어진 면 가닥
    { const z = lz1 - .56, yp = y0 + .2; box('recycB', x1 + .14, x1 + .18, yp, yp + .2, z - .08, z + .08); box('recycB', x1 + .18, x1 + .28, yp, yp + .015, z - .08, z + .08); lean('recycB', new THREE.CylinderGeometry(.01, .01, .7, 6), x1 + .17, yp + .5, z, .06); }   // 쓰레받기
    col.push({ x1: x1 + .02, x2: x1 + .36, z1: lz1 - .68, z2: lz1, y1: y0, y2: y0 + 1.4 });
  }
  // ── 특별실 집기 ──
  function desk(x, z, w = 1.4, d = .7, h = .74, key = 'deskTop') { box(key, x - w / 2, x + w / 2, y_ + h - .04, y_ + h, z - d / 2, z + d / 2);
    if (key === 'steelTop') { const g = new THREE.BoxGeometry(w - .08, .003, d - .08); g.translate(x, y_ + h + .0015, z); G('deskMat', g); }   /* 교무실 철제 책상: 녹색 고무 매트 + 유리 (매트 한 장에 텍스처 1장) */ box('steelG', x - w / 2 + .02, x - w / 2 + .45, y_, y_ + h - .04, z - d / 2 + .02, z + d / 2 - .02); box('deskLeg', x + w / 2 - .05, x + w / 2 - .02, y_, y_ + h - .04, z - d / 2 + .02, z + d / 2 - .02); box('deskLeg', x - w / 2 + .45, x + w / 2 - .05, y_ + h - .2, y_ + h - .04, z + d / 2 - .04, z + d / 2 - .02);   // 앞가림판
    for (const sz of [-1, 1]) { const fz = z + sz * (d / 2 - .02); for (let k = 1; k < 3; k++) box('rubber', x - w / 2 + .03, x - w / 2 + .44, y_ + k * (h - .04) / 3 - .004, y_ + k * (h - .04) / 3, Math.min(fz, fz + sz * .006), Math.max(fz, fz + sz * .006));   // 서랍 3단 틈
      for (let k = 0; k < 3; k++) box('alu', x - w / 2 + .17, x - w / 2 + .31, y_ + (k + .5) * (h - .04) / 3 - .01, y_ + (k + .5) * (h - .04) / 3 + .01, Math.min(fz, fz + sz * .025), Math.max(fz, fz + sz * .025)); }   // 서랍 손잡이
    col.push({ x1: x - w / 2, x2: x + w / 2, z1: z - d / 2, z2: z + d / 2, y1: y_, y2: y_ + h }); }
  // 책장 한 칸마다 책 줄 (높이 · 두께 · 색이 제각각, 가끔 비스듬히 쓰러진 책 · 빈칸)
  function books(xf, zc, y, side) {
    for (const ly of [.12, .52, .92, 1.32, 1.72]) { let z = zc - .64; while (z < zc + .62) { const t = .025 + br() * .04, h = .2 + br() * .12, dpt = .17 + br() * .05;
      if (br() < .08) { z += .12; continue; }   // 빠진 책 자리
      const key = 'book' + ((br() * 4) | 0); box(key, xf - side * dpt, xf, y + ly, y + ly + h, Math.min(z, z + t), z + t); z += t + .003; } }
  }
  function chairAt(x, z) { officeChair(x, z, y_, 1); }
  function chairAtOld(x, z) { box('rubber', x - .22, x + .22, y_ + .42, y_ + .5, z - .22, z + .22); box('rubber', x - .22, x + .22, y_ + .5, y_ + .95, z + .18, z + .24); box('deskLeg', x - .02, x + .02, y_ + .05, y_ + .42, z - .02, z + .02); }
  function cabinet(x1, x2, z1, z2, h = 1.8, key = 'steelG', glassTop = false) { const narrowX = x2 - x1 < z2 - z1, front = narrowX ? (rmx > (x1 + x2) / 2 ? 'x+' : 'x-') : (rmz > (z1 + z2) / 2 ? 'z+' : 'z-'); cabinetD(x1, x2, z1, z2, y_, h, key, front, glassTop); }
  function darkMats() {   // 원목 · 가죽 · 금속 재질 (교장실 · 교사회의실)
    UVM.dkwood = 1.4; UVM.dkpanel = 1.2;
    mat.dkwood = M('dkwood', () => new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (g, w, h) => { for (let k = 0; k < 8; k++) { const v = 52 + (k * 37 % 5) * 6; g.fillStyle = `rgb(${v + 18},${v - 6},${v - 24})`; g.fillRect(0, k * 32, w, 32); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(20,10,4,${.08 + Math.random() * .12})`; g.beginPath(); const y = k * 32 + Math.random() * 32; g.moveTo(0, y); g.bezierCurveTo(w * .3, y + 3, w * .6, y - 3, w, y); g.stroke(); } g.fillStyle = 'rgba(10,5,2,.55)'; g.fillRect(0, k * 32, w, 1.5); g.fillRect((k * 97) % w, k * 32, 1.5, 32); } }), roughness: .38, metalness: .05 }));
    mat.dkpanel = M('dkpanel', () => new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#4a2c18'; g.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { g.strokeStyle = `rgba(20,8,2,${.1 + Math.random() * .15})`; g.beginPath(); const x = Math.random() * w; g.moveTo(x, 0); g.lineTo(x + 4, h); g.stroke(); } g.strokeStyle = 'rgba(15,6,2,.7)'; g.lineWidth = 3; g.strokeRect(10, 10, w - 20, h - 20); }), roughness: .45 }));
    mat.leather = M('leather', () => new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: .42, metalness: .05 }));
    mat.gold = M('gold', () => new THREE.MeshStandardMaterial({ color: 0xc8a040, roughness: .3, metalness: .85 }));
  }
  function artHelpers() {
    const plane = (tex, w, h, x, y, z, ry, basic = false) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshStandardMaterial({ map: tex, roughness: .6 })); m.position.set(x, y, z); m.rotation.y = ry; root.add(m); return m; };
    const ctex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    return { plane, ctex };
  }
  function special(type, x1, x2, z1, z2, y0, f) {
    y_ = y0; const zm = (z1 + z2) / 2, xm = (x1 + x2) / 2; rmx = xm; rmz = zm;
    // x 방향을 보는 의자 · 원형 스툴 · 칠판 (별관 특별실 공용) — face -1 이면 서쪽(칠판)을 본다
    const chairX = (x, z, face = -1) => { box('rubber', x - .24, x + .24, y0 + .42, y0 + .5, z - .24, z + .24); const bx = x - face * .22; box('rubber', Math.min(bx, bx - face * .06), Math.max(bx, bx - face * .06), y0 + .55, y0 + 1.0, z - .22, z + .22);
      box('alu', x - .02, x + .02, y0 + .1, y0 + .42, z - .02, z + .02); box('alu', x - .25, x + .25, y0 + .05, y0 + .08, z - .02, z + .02); box('alu', x - .02, x + .02, y0 + .05, y0 + .08, z - .25, z + .25); };
    const stool = (x, z, h = .5, key = 'rubber') => { cyl(key, x, y0 + h - .04, z, .16, .05, .16, 14); [[-.1, -.1], [.1, -.1], [-.1, .1], [.1, .1]].forEach(([a, b]) => box('alu', x + a - .012, x + a + .012, y0, y0 + h - .04, z + b - .012, z + b + .012)); box('alu', x - .11, x + .11, y0 + .18, y0 + .2, z - .01, z + .01); };
    const boardX = (key, wz, w = 3.6) => { box('alu', x1 + .01, x1 + .06, y0 + .9, y0 + 2.2, wz - w / 2 - .03, wz + w / 2 + .03); if (key === 'board') { const g = new THREE.BoxGeometry(.01, 1.2, w), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * w / 4.8); g.translate(x1 + .065, y0 + 1.55, wz); G('chalk', g); } else box(key, x1 + .06, x1 + .07, y0 + .95, y0 + 2.15, wz - w / 2, wz + w / 2); box('alu', x1 + .06, x1 + .14, y0 + .9, y0 + .93, wz - w / 2 + .2, wz + w / 2 - .2); };   // 칠판: 교실 칠판 텍스처(4.8 × 1.2m 한 장)를 세로는 꽉, 가로는 폭만큼 (예전엔 세로가 4배 늘어났다)
    // ── 재편 특별실 13종 (빈 교실 · 중복 교실 · 3학년 6~9반을 헐고 새로 꾸민 방) — 복도 쪽 1.3m 는 출입 동선으로 비운다 ──
    if (NEWROOMS.has(type)) { darkMats();
      const Z0 = z1 + 1.5, sign = (txt, x, y, z, w = 1.6, ry = 0, bg = '#f4f0e4', fg = '#1a1a1a') => { const p = canvasPlane(w, w * .22, 512, 112, (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); g.fillStyle = fg; g.font = 'bold 54px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, W / 2, H / 2 + 3); }, 'sg_' + txt); p.position.set(x, y, z); p.rotation.y = ry; root.add(p); };
      const shelf = (xa, xb, za, zb, h = 2.0, levels = 5, key = 'wood', fill = true) => { box(key, xa, xb, y0, y0 + .04, za, zb); box(key, xa, xb, y0 + h - .03, y0 + h, za, zb); box(key, xa, xb, y0, y0 + h, za, za + .03); box(key, xa, xb, y0, y0 + h, zb - .03, zb);   // 옆판은 z 양 끝 (예전: x 양쪽 = 앞 · 뒤를 막아 선반이 통짜 벽처럼 보였다)
        if (xa - x1 < .2) box(key, xa, xa + .015, y0, y0 + h, za, zb); else if (x2 - xb < .2) box(key, xb - .015, xb, y0, y0 + h, za, zb);   // 벽에 붙은 선반만 뒤판
        for (let k = 1; k < levels; k++) { const y = y0 + k * h / levels; box(key, xa, xb, y - .02, y, za, zb); if (fill) for (let x = xa + .06; x < xb - .1; x += .09 + br() * .05) box('book' + ((br() * 4) | 0), x, x + .05 + br() * .03, y, y + .2 + br() * .1, za + .03, zb - .03); }
        col.push({ x1: xa, x2: xb, z1: za, z2: zb, y1: y0, y2: y0 + h }); };
      const table = (cx, cz, w, d, h = .74, key = 'wood') => { box(key, cx - w / 2, cx + w / 2, y0 + h - .04, y0 + h, cz - d / 2, cz + d / 2); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box('alu', cx + a * (w / 2 - .06) - .02, cx + a * (w / 2 - .06) + .02, y0, y0 + h - .04, cz + b * (d / 2 - .06) - .02, cz + b * (d / 2 - .06) + .02)); col.push({ x1: cx - w / 2, x2: cx + w / 2, z1: cz - d / 2, z2: cz + d / 2, y1: y0, y2: y0 + h }); };
      const search = (label, x, z, y = 1.0) => props.push({ kind: 'search', label, x, y: y0 + y, z, floor: f });
      if (type === 'council') {   // 학생회실: 회의 테이블 · 학생회 깃발 · 트로피 장 · 공약 게시판
        box('dkwood', x1, x2, y0 + .02, y0 + .03, z1, z2); table(xm, zm + .6, 3.6, 1.4, .75, 'dkwood'); for (let k = 0; k < 4; k++) { mdl('SchoolChair_01', xm - 1.35 + k * .9, y0, zm - .35, 0); mdl('SchoolChair_01', xm - 1.35 + k * .9, y0, zm + 1.55, Math.PI); }
        shelf(x2 - .5, x2 - .05, z2 - 3.4, z2 - .3, 1.9, 4, 'dkwood', false); for (let k = 0; k < 6; k++) cyl('brass', x2 - .27, y0 + .5 + (k % 3) * .48, z2 - 3.0 + ((k / 3) | 0) * 1.2, .05, .22, .09, 10);
        cyl('alu', x1 + .5, y0, z2 - .6, .02, 2.2); const fl = canvasPlane(.9, .6, 256, 170, (g, W, H) => { g.fillStyle = '#1f4f8a'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = 'bold 36px sans-serif'; g.textAlign = 'center'; g.fillText('서문고 학생회', W / 2, H / 2 + 12); }, 'council_flag'); fl.position.set(x1 + .96, y0 + 1.8, z2 - .6); fl.rotation.y = Math.PI / 2; root.add(fl);
        sign('2008 학생회 공약: 야자 선택제 · 급식 만족도 조사', xm, y0 + 1.75, z2 - .03, 3.4, Math.PI); search('학생회 회의록 철', xm + 1, zm + .6); }
      else if (type === 'avroom') {   // 시청각실: 계단식 대신 줄 맞춘 접이식 의자 · 대형 스크린 · 천장 프로젝터 · 암막 커튼
        box('dkwood', x1, x2, y0 + .02, y0 + .03, z1, z2); box('white', x1 + .03, x1 + .05, y0 + .7, y0 + 2.6, zm - 2, zm + 2); box('rubber', x1 + .05, x1 + .25, y0 + .7, y0 + .75, zm - 2.1, zm + 2.1);
        for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { const x = x1 + 2.6 + r * 1.3, z = Z0 + .4 + c * 1.15; if (z > z2 - .6) continue; mdl('SchoolChair_01', x, y0, z, -Math.PI / 2); }
        box('steelG', xm - .2, xm + .2, y0 + 2.75, y0 + 2.9, zm - .25, zm + .25); box('rubber', xm - .03, xm + .03, y0 + 2.9, y0 + 3.2, zm - .03, zm + .03);
        for (let k = 0; k < 4; k++) box('leather', x1 + 1.2 + k * 1.8, x1 + 2.6 + k * 1.8, y0 + .3, y0 + 2.9, z2 - .08, z2 - .05);   // 암막 커튼
        table(x2 - .9, zm, .8, 1.6); box('crt', x2 - 1.1, x2 - .7, y0 + .74, y0 + 1.06, zm - .2, zm + .2); search('시청각실 VHS 장', x2 - .9, zm); }
      else if (type === 'archive') {   // 교내 기록보존실: 철제 서가 줄 · 기록 상자 · 열람 책상 — 1998년 기록이 잠든 곳
        box('conc', x1, x2, y0 + .02, y0 + .03, z1, z2); for (let r = 0; r < 4; r++) { const x = x1 + 1.6 + r * 1.7; shelf(x, x + .5, Z0 + .3, z2 - .5, 2.2, 5, 'steelG', false);
          for (let lv = 0; lv < 5; lv++) for (let z = Z0 + .4; z < z2 - .8; z += .42) if (br() < .85) mdl('cardboard_box_01', x + .25, y0 + lv * .44 + (lv ? 0 : .04), z + .16, (br() - .5) * .16, { s: .78 }); }   // 실사 기록 상자
        table(x2 - .9, Z0 + .8, 1.2, .7); search('「1998 학사 기록」 상자', x1 + 2.0, zm, 1.2); sign('기록보존실 — 무단 반출 금지', xm, y0 + 2.2, z1 + .03, 2.4, 0, '#7a1a1a', '#fff'); }
      else if (type === 'teacher') {   // 교사 휴게실: 소파 · 낮은 탁자 · 전기포트 · 냉장고 · 개인 사물함
        box('dkwood', x1, x2, y0 + .02, y0 + .03, z1, z2); mdl('sf_sofa', x1 + 2.0, y0, z2 - .8, Math.PI); col.push({ x1: x1 + .9, x2: x1 + 3.1, z1: z2 - 1.28, z2: z2 - .15, y1: y0, y2: y0 + .8 });   // 실사 응접 소파 (예전: 가죽색 상자 2개)
        table(x1 + 2, z2 - 2, 1.4, .7, .42, 'dkwood'); fridgeX(x2 - .1, x2 - .8, z2 - .9, z2 - .2, y0); table(x2 - 1.6, zm, 1.2, .6, .85); cyl('alu', x2 - 1.9, y0 + .85, zm, .08, .2, .07, 14); cyl('porc', x2 - 1.4, y0 + .85, zm, .04, .09, .04, 10);
        for (let k = 0; k < 7; k++) mdl('h133/STO-001', x2 - .32, y0, Z0 + .2 + k * .37, -Math.PI / 2);   // 철제 개인 사물함 7 (예전: 니스 칠 상자 6)
        col.push({ x1: x2 - .62, x2: x2 - .02, z1: Z0, z2: Z0 + 2.62, y1: y0, y2: y0 + 1.9 }); search('교사 개인 사물함', x2 - .3, Z0 + 1.2); }
      else if (type === 'club') {   // 사진부 암실 · 동아리실: 붉은 안전등 · 현상 트레이 · 빨랫줄에 걸린 인화지 · 확대기
        box('conc', x1, x2, y0 + .02, y0 + .03, z1, z2); table(xm, z2 - 1, 3.6, .8, .9); for (let k = 0; k < 3; k++) box(['red', 'white', 'steelG'][k], xm - 1.5 + k * 1.1, xm - .7 + k * 1.1, y0 + .9, y0 + .96, z2 - 1.3, z2 - .7);
        box('steelG', x1 + .6, x1 + 1.4, y0, y0 + .9, zm - .4, zm + .4, { solid: true }); box('steelG', x1 + .95, x1 + 1.05, y0 + .9, y0 + 1.9, zm - .05, zm + .05); box('rubber', x1 + .75, x1 + 1.25, y0 + 1.6, y0 + 1.8, zm - .2, zm + .2);
        box('alu', x1 + .5, x2 - .5, y0 + 2.2, y0 + 2.21, zm - .005, zm + .005); for (let x = x1 + 1; x < x2 - 1; x += .45) box('white', x, x + .3, y0 + 1.85, y0 + 2.2, zm - .003, zm + .003);
        const rl = new THREE.PointLight(0xff2010, 2.5, 6); rl.position.set(xm, y0 + 2.6, zm); root.add(rl); cyl('red', xm, y0 + 2.6, zm, .08, .1, .08, 12); search('현상 안 된 필름 통', xm + 1, z2 - 1); }
      else if (type === 'tech') {   // 기술실: 작업대 · 바이스 · 공구 벽판 · 전동 드릴 스탠드
        box('conc', x1, x2, y0 + .02, y0 + .03, z1, z2); for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) { const cx = x1 + 2.6 + r * 3.2, cz = Z0 + 1.4 + c * 3.2; table(cx, cz, 2.2, 1.1, .82, 'wood'); box('steelG', cx + .8, cx + 1.05, y0 + .82, y0 + .98, cz - .1, cz + .1); [[-.7, 0], [.7, 0]].forEach(([a, b]) => stool(cx + a, cz + .95, .62)); }
        box('cork', x2 - .06, x2 - .03, y0 + 1.0, y0 + 2.0, Z0, z2 - .6); for (let z = Z0 + .3; z < z2 - .8; z += .35) box('steelG', x2 - .12, x2 - .06, y0 + 1.2 + br() * .6, y0 + 1.5 + br() * .3, z, z + .05); search('공구함', x2 - .4, zm, .8); sign('안전 제일 — 보안경 착용', xm, y0 + 2.2, z1 + .03, 2.2, 0, '#e0c020', '#111'); }
      else if (type === 'prep') {   // 과학준비실: 약품장(유리문) · 표본 선반 · 현미경 보관함 · 개수대
        box('tile', x1, x2, y0 + .02, y0 + .03, z1, z2); shelf(x1 + .1, x1 + .55, Z0, z2 - .3, 2.0, 5, 'white', false); for (let lv = 1; lv < 5; lv++) for (let z = Z0 + .2; z < z2 - .5; z += .22) cyl(br() < .5 ? 'glass' : 'porc', x1 + .32, y0 + lv * .4, z, .05, .16, .05, 10);
        shelf(x2 - .55, x2 - .1, Z0, z2 - .3, 2.0, 4, 'steelG', false); for (let lv = 1; lv < 4; lv++) for (let z = Z0 + .3 + lv * .25; z < z2 - .6; z += .95) mdl('h133/SCI-005', x2 - .33, y0 + lv * .5 + .005, z + .12, -Math.PI / 2 + (lv - 2) * .2, { s: .68 });
        table(xm, zm + .5, 2.4, 1.0, .9, 'white'); box('steelG', xm - .4, xm + .4, y0 + .9, y0 + .95, zm + .2, zm + .8); search('잠긴 약품장', x1 + .35, zm, 1.2); sign('과학준비실 — 관계자 외 출입금지', xm, y0 + 2.2, z1 + .03, 2.4, 0, '#2a5a8a', '#fff'); }
      else if (type === 'english') {   // 영어전용실: 원탁 모둠 · 세계지도 · 국기 줄 · "English Only" 
        box('wood', x1, x2, y0 + .02, y0 + .03, z1, z2); for (let k = 0; k < 4; k++) { const cx = x1 + 2.4 + (k % 2) * 3.4, cz = Z0 + 1.4 + ((k / 2) | 0) * 3.2; cyl('wood', cx, y0 + .7, cz, .65, .04, .65, 24); cyl('alu', cx, y0, cz, .05, .7); col.push({ x1: cx - .65, x2: cx + .65, z1: cz - .65, z2: cz + .65, y1: y0, y2: y0 + .74 }); for (let a = 0; a < 4; a++) stool(cx + Math.cos(a * 1.57) * 1, cz + Math.sin(a * 1.57) * 1, .46); }
        const map = canvasPlane(3.2, 1.7, 512, 272, (g, W, H) => { g.fillStyle = '#9cc8e0'; g.fillRect(0, 0, W, H); g.fillStyle = '#7ab060'; [[60, 60, 120, 90], [220, 50, 110, 120], [300, 150, 90, 70], [380, 60, 100, 80], [120, 170, 60, 70], [420, 190, 60, 40]].forEach(([x, y, w, h]) => { g.beginPath(); g.ellipse(x, y + h / 2, w / 2, h / 2, .3, 0, 7); g.fill(); }); g.fillStyle = '#222'; g.font = 'bold 22px serif'; g.fillText('WORLD MAP', 200, 260); }, 'worldmap');
        map.position.set(xm, y0 + 1.6, z2 - .03); map.rotation.y = Math.PI; root.add(map); sign('ENGLISH ONLY — 영어로만 말해요', xm, y0 + 2.3, z1 + .03, 2.6, 0, '#c03030', '#fff'); search('원어민 교사 책상', x2 - .8, Z0 + .6); }
      else if (type === 'math') {   // 수학교과실: 모둠 책상 · 대형 각도기·컴퍼스 교구 · 입체도형 모형 선반 · 그래프 칠판
        box('wood', x1, x2, y0 + .02, y0 + .03, z1, z2); boardX('board', zm, 4.2); for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) { const cx = x1 + 2.6 + r * 2.2, cz = Z0 + 1.2 + c * 3.4; table(cx, cz, 1.4, 1.4); [[-.5, -.85], [.5, -.85], [-.5, .85], [.5, .85]].forEach(([a, b]) => stool(cx + a, cz + b, .46)); }
        shelf(x2 - .5, x2 - .05, Z0, Z0 + 3, 1.6, 3, 'wood', false); [[0, 'red'], [1, 'white'], [2, 'brass']].forEach(([k, m]) => { box(m, x2 - .4, x2 - .15, y0 + .55 + k * .53, y0 + .8 + k * .53, Z0 + .5, Z0 + .75); cyl(m, x2 - .28, y0 + .55 + k * .53, Z0 + 1.6, .12, .25, .001, 4); });
        search('수학 경시대회 답안지 묶음', x2 - .3, Z0 + 2.2); }
      else if (type === 'dance') {   // 무용 · 다목적실: 벽면 거울 · 발레 바 · 매트 · 음향 앰프
        box('wood', x1, x2, y0 + .02, y0 + .04, z1, z2); box('glass', x2 - .05, x2 - .02, y0 + .2, y0 + 2.4, Z0 - .5, z2 - .3); box('alu', x2 - .35, x2 - .3, y0 + 1.0, y0 + 1.04, Z0 - .4, z2 - .4); [Z0, zm, z2 - .6].forEach(z => box('alu', x2 - .33, x2 - .05, y0, y0 + 1.04, z, z + .04));
        for (let k = 0; k < 4; k++) box(k % 2 ? 'red' : 'steelG', x1 + .6 + k * .7, x1 + 1.2 + k * .7, y0 + .04, y0 + .09, z2 - 2.2, z2 - .4); box('rubber', x1 + .3, x1 + .8, y0, y0 + .9, Z0, Z0 + .5, { solid: true }); search('음향 앰프 서랍', x1 + .55, Z0 + .25, .8); }
      else if (type === 'band') {   // 밴드부실: 드럼 세트 · 앰프 · 기타 거치대 · 방음 스펀지 벽
        box('leather', x1, x2, y0 + .02, y0 + .03, z1, z2); for (let z = Z0; z < z2 - .4; z += .6) box('rubber', x2 - .08, x2 - .03, y0 + .3, y0 + 2.6, z, z + .5);
        const dx = xm + 1, dz = z2 - 1.6; cyl('white', dx, y0, dz, .3, .45, .3, 20); [[-.5, -.3, .35], [.5, -.3, .5], [-.3, .4, .45]].forEach(([a, b, h]) => { cyl('white', dx + a, y0 + h, dz + b, .18, .2, .18, 16); cyl('alu', dx + a, y0, dz + b, .015, h); }); cyl('brass', dx + .7, y0 + 1.0, dz + .3, .22, .01, .22, 18); cyl('alu', dx + .7, y0, dz + .3, .012, 1.0);
        box('rubber', x1 + .6, x1 + 1.2, y0, y0 + .6, z2 - 1.2, z2 - .7, { solid: true }); box('rubber', x1 + 1.5, x1 + 2.1, y0, y0 + .6, z2 - 1.2, z2 - .7, { solid: true }); for (let k = 0; k < 3; k++) { box('dkwood', x1 + .7 + k * .5, x1 + .78 + k * .5, y0, y0 + 1.0, Z0 + .3, Z0 + .6); }
        search('밴드부 합주 녹음 카세트', x1 + .9, z2 - .95, .7); }
      else if (type === 'history') {   // 학교 역사관: 유리 진열장 · 역대 졸업 사진 액자 · 개교 기념 교기 — 1998년 칸만 비어 있다
        box('dkwood', x1, x2, y0 + .02, y0 + .03, z1, z2); for (let k = 0; k < 3; k++) { const cx = x1 + 2.2 + k * 2.4; box('dkwood', cx - .6, cx + .6, y0, y0 + .8, zm - .35, zm + .35, { solid: true }); box('glass', cx - .58, cx + .58, y0 + .8, y0 + 1.3, zm - .33, zm + .33); box(['brass', 'white', 'cork'][k], cx - .2, cx + .2, y0 + .82, y0 + .95, zm - .1, zm + .1); }
        for (let k = 0; k < 7; k++) { const yr = 1992 + k, x = x1 + 1 + k * 1.05; const fr = canvasPlane(.8, .55, 192, 132, (g, W, H) => { g.fillStyle = '#5a3a1e'; g.fillRect(0, 0, W, H); g.fillStyle = yr === 1998 ? '#2a2a2a' : '#b8b0a0'; g.fillRect(10, 10, W - 20, H - 34); g.fillStyle = '#e8d8a0'; g.font = 'bold 18px serif'; g.textAlign = 'center'; g.fillText(yr === 1998 ? '1998 — (사진 없음)' : yr + ' 졸업', W / 2, H - 9); }, 'grad' + yr); fr.position.set(x, y0 + 1.7, z2 - .03); fr.rotation.y = Math.PI; root.add(fr); }
        sign('서문고 역사관 1968 ~', xm, y0 + 2.4, z2 - .03, 2.6, Math.PI, '#5a3a1e', '#e8d8a0'); search('1998년 빈 액자 뒤', x1 + 1 + 6 * 1.05, z2 - .3, 1.7); }
      else if (type === 'lounge') {   // 학생 휴게 공간: 자판기 · 소파 벤치 · 원형 테이블 · 게시판 낙서
        box('tile', x1, x2, y0 + .02, y0 + .03, z1, z2);
        mdl('sf_vending', x2 - .37, y0, Z0 + .5, -Math.PI / 2); mdl('sf_vending', x2 - .37, y0, Z0 + 1.55, -Math.PI / 2); col.push({ x1: x2 - .9, x2: x2 - .1, z1: Z0, z2: Z0 + 2.05, y1: y0, y2: y0 + 1.85 });   // 실사 음료 자판기 2 (예전: 빨간 상자 + 유리 판)
        for (let k = 0; k < 3; k++) { const cx = x1 + 2 + k * 2.2, cz = z2 - 2; cyl('white', cx, y0 + .72, cz, .45, .03, .45, 20); cyl('alu', cx, y0, cz, .04, .72); col.push({ x1: cx - .45, x2: cx + .45, z1: cz - .45, z2: cz + .45, y1: y0, y2: y0 + .75 }); stool(cx - .7, cz, .46); stool(cx + .7, cz, .46); }
        for (let zz = Z0 + 1.1; zz + 1.0 < z2 - 3; zz += 2.1) mdl('sf_sofa', x1 + .55, y0, zz, Math.PI / 2, { s: .9 });   // 벽 따라 실사 소파 (예전: 가죽색 상자 벤치)
        col.push({ x1: x1 + .1, x2: x1 + 1.0, z1: Z0, z2: z2 - 3, y1: y0, y2: y0 + .5 }); search('자판기 반환구', x2 - .5, Z0 + .4, .5); }
      ROOMLOG.push(type); return;
    }
    if (x2 - x1 > 6 && !['principal', 'meeting', 'office', 'library'].includes(type)) corkBoard(x1 + 2.5, x2 - 2.5, y0 + .9, y0 + 1.5, z1 + .02, 1);   // 복도 쪽 코르크 게시판 (문 · 채광창 사이 벽면만)
    if (type === 'staff' || type === 'admin') {   // 교무실 · 행정실: 사무용 책상 섬 3개 × 6석, 캐비닛, 복사기
      const ni = Math.max(1, Math.min(3, Math.floor((x2 - x1 - 1.4) / 2.5))); for (let i = 0; i < ni; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 3; k++) { const x = x1 + 1.6 + i * 2.5, z = z1 + 2.1 + k * 1.5 + j * .72; desk(x, z, 1.2, .7, .74, 'steelTop'); chairAt(x, z + (j ? .55 : -.55)); { const sd = j ? 1 : -1, zc = z - sd * .12; box('crt', x - .17, x + .17, y0 + .79, y0 + 1.08, zc - .1, zc + .1); box('crt', x - .1, x + .1, y0 + .82, y0 + 1.03, zc - sd * .1 - .06, zc - sd * .1 + .06); box('screen', x - .14, x + .14, y0 + .82, y0 + 1.05, zc + sd * .1 - .005, zc + sd * .1 + .005); box('crt', x - .09, x + .09, y0 + .74, y0 + .79, zc - .08, zc + .08); box('crt', x - .2, x + .2, y0 + .74, y0 + .76, zc + sd * .2 - .07, zc + sd * .2 + .07); } }
      cabinet(x2 - .5, x2 - .05, z1 + .3, z1 + 3.5); cabinet(x1 + .05, x1 + .5, z1 + .3, z2 - 1.9, 1.2);   // 남쪽 끝 1.9m 는 키 큰 장이 선다 (겹치지 않게)
      copier(x2 - 1.2, x2 - .3, z2 - 1.2, z2 - .5, y0);   // 복사기
      if (type === 'staff' && !opt.noClues && !s_staff++) { clueNote('n3', x1 + 1.6, y0 + .74, z1 + 2.1, f, .3); clueNote('n22', x1 + 4.1, y0 + .74, z1 + 3.6, f, -.2); clueTape('ts_vice', x1 + 6.6, y0 + .74, z1 + 5.1, f); }
      if (type === 'admin' && !opt.noClues) clueNote('n21', x1 + 4.1, y0 + .74, z1 + 2.1, f, .1);
      props.push({ kind: 'search', label: type === 'staff' ? '교무실 서류함 뒤지기' : '행정실 장부 확인', x: x2 - .6, y: y0 + 1, z: z1 + 1.9, floor: f });
      mdl('drawer_cabinet', x1 + .32, y0, z2 - 1.2, Math.PI / 2); col.push({ x1: x1 + .05, x2: x1 + .6, z1: z2 - 1.8, z2: z2 - .6, y1: y0, y2: y0 + 1.9 });
      mdl('wall_clock', x1 + .03, y0 + 2.4, zm, Math.PI / 2); mdl('potted_plant_04', x2 - .4, y0, z2 - .4, 0, { s: 2.2 });
    } else if (type === 'principal') {   // 교장실 (참고 평면도 · 배치도): 다크 우드 바닥 · 원목 징두리 · 트로피/서적장 · 태극기 · 교훈 패널 · 교패 · 옷걸이 · 창가 하부장 · 응접 소파 세트(3인 + 1인 2) · 러그 · 교장 책상 + 하이백 의자 · 내방객 의자 2 · 수납장 + 액자
      darkMats(); const { plane, ctex } = artHelpers();
      box('dkwood', x1, x2, y0 + .02, y0 + .03, z1, z2);   // 다크 우드 마루
      // 벽: 원목 징두리 판넬 (서 · 동 · 창가 벽 아래 1.0m) + 걸레받이
      box('dkpanel', x1 + .005, x1 + .02, y0, y0 + 1.0, z1 + .1, z2 - .1); box('dkpanel', x2 - .02, x2 - .005, y0, y0 + 1.0, z1 + .1, z2 - .1);
      box('dkwood', x1 + .005, x1 + .03, y0 + 1.0, y0 + 1.06, z1 + .1, z2 - .1); box('dkwood', x2 - .03, x2 - .005, y0 + 1.0, y0 + 1.06, z1 + .1, z2 - .1);
      // ── 서쪽 벽: 태극기 · 트로피/서적장 · 교패 · 교훈 패널 · 옷걸이 ──
      { const fx = x1 + .45, fz = z1 + 1.85; cyl('gold', fx, y0, fz, .1, .06, .13, 12); cyl('dkwood', fx, y0 + .06, fz, .018, 2.2); cyl('gold', fx, y0 + 2.26, fz, .035, .08);
        const tg = ctex(300, 200, (g, w, h) => { g.fillStyle = '#fbfbf6'; g.fillRect(0, 0, w, h); g.save(); g.translate(w / 2, h / 2); g.rotate(Math.atan2(2, 3)); g.fillStyle = '#c8102e'; g.beginPath(); g.arc(0, 0, 50, Math.PI, 0); g.fill(); g.fillStyle = '#003478'; g.beginPath(); g.arc(0, 0, 50, 0, Math.PI); g.fill(); g.fillStyle = '#c8102e'; g.beginPath(); g.arc(-25, 0, 25, 0, Math.PI * 2); g.fill(); g.fillStyle = '#003478'; g.beginPath(); g.arc(25, 0, 25, 0, Math.PI * 2); g.fill(); g.restore();
          g.fillStyle = '#111'; const bar = (cx, cy, ang, pat) => { g.save(); g.translate(cx, cy); g.rotate(ang); pat.forEach((b, k) => { const y = (k - 1) * 14; if (b) g.fillRect(-22, y - 4, 44, 8); else { g.fillRect(-22, y - 4, 19, 8); g.fillRect(3, y - 4, 19, 8); } }); g.restore(); }; bar(60, 45, -Math.atan2(2, 3), [1, 1, 1]); bar(240, 155, -Math.atan2(2, 3), [0, 0, 0]); bar(240, 45, Math.atan2(2, 3), [1, 0, 1]); bar(60, 155, Math.atan2(2, 3), [0, 1, 0]); });
        const fl = plane(tg, .9, .6, fx + .02, y0 + 1.75, fz + .48, Math.PI / 2); fl.material.side = THREE.DoubleSide; fl.rotation.z = -.05;
        for (let k = 0; k < 6; k++) box('gold', fx - .01, fx + .01, y0 + 1.42 + k * .07, y0 + 1.46 + k * .07, fz + .03, fz + .04); }
      cabinetD(x1 + .05, x1 + .55, z1 + 2.45, z1 + 4.25, y0, .9, 'dkwood', 'x+'); box('dkwood', x1 + .05, x1 + .45, y0 + .9, y0 + 2.2, z1 + 2.45, z1 + 4.25, { solid: true }); box('glass', x1 + .45, x1 + .46, y0 + .95, y0 + 2.15, z1 + 2.5, z1 + 4.2);   // 트로피 · 서적장 (하부장 + 유리 상부장)
      for (let j = 0; j < 3; j++) { const y = y0 + 1.0 + j * .4; box('dkwood', x1 + .08, x1 + .44, y, y + .02, z1 + 2.5, z1 + 4.2); for (let k = 0; k < 4; k++) { const z = z1 + 2.7 + k * .42; if ((j + k) % 2) { cyl('gold', x1 + .25, y + .02, z, .05, .05, .07); cyl('gold', x1 + .25, y + .07, z, .015, .12); cyl('gold', x1 + .25, y + .19, z, .08, .1, .04, 14); } else for (let b = 0; b < 6; b++) box(['red', 'lockerM', 'cork', 'white'][b % 4], x1 + .12, x1 + .36, y + .02, y + .3, z - .15 + b * .05, z - .11 + b * .05); } }
      const emblem = ctex(512, 512, (g, w, h) => { g.fillStyle = '#3a2416'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c8a040'; g.lineWidth = 10; g.beginPath(); g.arc(256, 200, 120, 0, 7); g.stroke(); g.lineWidth = 4; g.beginPath(); g.arc(256, 200, 100, 0, 7); g.stroke(); g.fillStyle = '#c8a040'; g.font = 'bold 70px serif'; g.textAlign = 'center'; g.fillText('瑞文', 256, 225); g.font = 'bold 54px sans-serif'; g.fillText('서문고등학교', 256, 420); });
      box('dkpanel', x1 + .005, x1 + .04, y0 + 1.06, y0 + 2.7, z1 + 4.55, z1 + 6.05); plane(emblem, 1.3, 1.3, x1 + .045, y0 + 1.9, z1 + 5.3, Math.PI / 2);
      const motto = ctex(512, 360, (g, w, h) => { g.fillStyle = '#f2ead8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a2416'; g.lineWidth = 18; g.strokeRect(9, 9, w - 18, h - 18); g.fillStyle = '#1a1410'; g.font = 'bold 70px serif'; g.textAlign = 'center'; g.fillText('올바른 사람', 256, 150); g.fillText('더 나은 세상을', 256, 250); g.fillStyle = '#a02018'; g.fillRect(400, 280, 34, 34); });
      plane(motto, 1.4, 1.0, x1 + .03, y0 + 1.85, z1 + 7.1, Math.PI / 2);
      { const cx = x1 + .45, cz = z2 - 1.05; cyl('dkwood', cx, y0, cz, .2, .04, .22, 10); cyl('dkwood', cx, y0 + .04, cz, .025, 1.75); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; box('dkwood', cx + Math.cos(a) * .12 - .015, cx + Math.cos(a) * .12 + .015, y0 + 1.65, y0 + 1.72, cz + Math.sin(a) * .12 - .015, cz + Math.sin(a) * .12 + .015); } box('leather', cx - .18, cx + .02, y0 + .75, y0 + 1.65, cz - .2, cz + .2); col.push({ x1: cx - .25, x2: cx + .25, z1: cz - .25, z2: cz + .25, y1: y0, y2: y0 + 1.8 }); }   // 옷걸이 + 걸린 코트
      mdl('potted_plant_04', x1 + .55, y0, z1 + 4.42, 0, { s: 3.2 }); mdl('potted_plant_04', x1 + .55, y0, z2 - 1.9, 0, { s: 3.2 });
      // ── 창가: 하부장 (스탠드 · 액자 · 화분) ──
      cabinetD(x1 + 1.6, x2 - 2.0, z2 - .62, z2 - .24, y0, .72, 'dkwood', 'z-'); box('dkwood', x1 + 1.58, x2 - 1.98, y0 + .72, y0 + .76, z2 - .64, z2 - .22);
      { const lx = x1 + 2.0, lz = z2 - .43; cyl('gold', lx, y0 + .76, lz, .07, .02); cyl('gold', lx, y0 + .78, lz, .012, .3); cyl('white', lx, y0 + 1.06, lz, .16, .16, .1, 16); }
      for (let k = 0; k < 4; k++) { const x = x1 + 3.0 + k * 1.15; box('dkwood', x - .12, x + .12, y0 + .76, y0 + 1.0, z2 - .4, z2 - .37); box('white', x - .1, x + .1, y0 + .78, y0 + .98, z2 - .405, z2 - .4); }
      mdl('potted_plant_04', x2 - 2.6, y0 + .76, z2 - .43, 0, { s: 1.4 }); mdl('potted_plant_04', x2 - .55, y0, z2 - .55, 0, { s: 3.4 });
      // ── 동쪽 벽: 수납장 · 액자 · 대형 학교 그림 · 시계 ──
      cabinetD(x2 - .5, x2 - .05, z1 + 1.6, z2 - 1.3, y0, .9, 'dkwood', 'x-'); box('dkwood', x2 - .52, x2 - .04, y0 + .9, y0 + .94, z1 + 1.58, z2 - 1.28);
      for (let k = 0; k < 6; k++) { const z = z1 + 2.0 + k * 1.0; box('dkwood', x2 - .35, x2 - .32, y0 + .94, y0 + 1.22, z - .14, z + .14); box('white', x2 - .355, x2 - .35, y0 + .97, y0 + 1.19, z - .11, z + .11); }
      { const pic = ctex(512, 360, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#9ab8d0'); gr.addColorStop(.6, '#dfe8e0'); gr.addColorStop(1, '#6a8a50'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#c8b8a0'; g.fillRect(90, 140, 330, 120); g.fillStyle = '#8a4a3a'; g.fillRect(80, 120, 350, 24); for (let i = 0; i < 9; i++) { g.fillStyle = '#5a7a9a'; g.fillRect(105 + i * 35, 165, 20, 30); g.fillRect(105 + i * 35, 215, 20, 30); } g.fillStyle = '#4a6a3a'; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(30 + i * 75, 300, 40, 0, 7); g.fill(); } g.strokeStyle = '#7a5a2a'; g.lineWidth = 22; g.strokeRect(11, 11, w - 22, h - 22); });
        plane(pic, 1.7, 1.2, x2 - .03, y0 + 1.95, z1 + 5.1, -Math.PI / 2); }
      mdl('wall_clock', x2 - .03, y0 + 2.45, z1 + 2.6, -Math.PI / 2); mdl('wall_clock', x2 - .03, y0 + 2.4, z2 - 2.0, -Math.PI / 2);
      // ── 응접 공간: 러그 · 3인 소파 (창 쪽) · 1인 소파 2 · 응접 테이블 ──
      { const rug = ctex(256, 192, (g, w, h) => { g.fillStyle = '#cbb89a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${120 + Math.random() * 40},${100 + Math.random() * 30},${70 + Math.random() * 30},.25)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } g.strokeStyle = '#8a6a48'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44); });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.2), new THREE.MeshStandardMaterial({ map: rug, roughness: .98 })); m.rotation.x = -Math.PI / 2; m.position.set(xm, y0 + .035, z2 - 3.05); root.add(m); }
      const armchair = (cx, cz, face) => {   // face: 앉은 사람이 바라보는 방향 ('x+' 'x-' 'z+' 'z-')
        const ax = face[0] === 'x', s = face[1] === '+' ? 1 : -1, hw = .42;
        box('leather', cx - hw, cx + hw, y0 + .12, y0 + .45, cz - hw, cz + hw, { solid: true });
        if (ax) { const bx0 = s > 0 ? cx - hw : cx + hw - .16; box('leather', bx0, bx0 + .16, y0 + .12, y0 + .88, cz - hw, cz + hw); [cz - hw, cz + hw - .14].forEach(z => box('leather', cx - hw, cx + hw, y0 + .12, y0 + .62, z, z + .14)); }
        else { const bz0 = s > 0 ? cz - hw : cz + hw - .16; box('leather', cx - hw, cx + hw, y0 + .12, y0 + .88, bz0, bz0 + .16); [cx - hw, cx + hw - .14].forEach(x => box('leather', x, x + .14, y0 + .12, y0 + .62, cz - hw, cz + hw)); }
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cyl('dkwood', cx + a * (hw - .05), y0, cz + b * (hw - .05), .025, .12)); };
      { const sx1 = xm - 1.35, sx2 = xm + 1.35, sz1 = z2 - 2.15, sz2 = z2 - 1.3;   // 3인 소파: 등받이는 창 쪽 (앉으면 책상 쪽을 본다)
        box('leather', sx1, sx2, y0 + .12, y0 + .45, sz1, sz2, { solid: true }); box('leather', sx1, sx2, y0 + .12, y0 + .9, sz2 - .2, sz2); [sx1, sx2 - .18].forEach(x => box('leather', x, x + .18, y0 + .12, y0 + .64, sz1, sz2));
        for (let k = 1; k < 3; k++) { const x = sx1 + .18 + k * (sx2 - sx1 - .36) / 3; box('screen', x - .004, x + .004, y0 + .45, y0 + .48, sz1 + .02, sz2 - .22); }
        [[sx1 + .06, sz1 + .06], [sx2 - .06, sz1 + .06], [sx1 + .06, sz2 - .06], [sx2 - .06, sz2 - .06]].forEach(([x, z]) => cyl('dkwood', x, y0, z, .025, .12)); }
      armchair(xm - 2.1, z2 - 3.05, 'x+'); armchair(xm + 2.1, z2 - 3.05, 'x-');
      box('dkwood', xm - .75, xm + .75, y0 + .38, y0 + .44, z2 - 3.5, z2 - 2.65); box('dkwood', xm - .7, xm + .7, y0 + .08, y0 + .12, z2 - 3.45, z2 - 2.7); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => box('dkwood', xm + a * .68 - .04, xm + a * .68 + .04, y0, y0 + .38, z2 - 3.08 + b * .38 - .04, z2 - 3.08 + b * .38 + .04)); col.push({ x1: xm - .75, x2: xm + .75, z1: z2 - 3.5, z2: z2 - 2.65, y1: y0, y2: y0 + .44 });
      mdl('potted_plant_04', xm, y0 + .44, z2 - 3.08, 0, { s: 1.2 });
      // ── 교장 책상 (2.2 × .95, 앞판 · 서랍) · 하이백 가죽 의자 · 모니터 · 스탠드 · 전화 · 명패 · 내방객 의자 2 ──
      { const dz = z1 + 3.25, dx1 = xm - 1.1, dx2 = xm + 1.1, d1 = dz - .48, d2 = dz + .48;
        box('dkwood', dx1, dx2, y0 + .72, y0 + .78, d1, d2, { solid: true }); box('dkwood', dx1 + .02, dx1 + .55, y0, y0 + .72, d1 + .02, d2 - .02); box('dkwood', dx2 - .55, dx2 - .02, y0, y0 + .72, d1 + .02, d2 - .02); box('dkpanel', dx1 + .55, dx2 - .55, y0 + .15, y0 + .72, d1 + .02, d1 + .05);   // 상판 · 양쪽 서랍장 · 앞가림판 (내방객 쪽)
        for (let k = 0; k < 3; k++) [dx1 + .29, dx2 - .29].forEach(x => box('gold', x - .06, x + .06, y0 + .2 + k * .2, y0 + .22 + k * .2, d2 - .015, d2 - .005));
        box('rubber', xm - .32, xm + .32, y0 + .9, y0 + 1.27, dz + .12, dz + .15); box('rubber', xm - .03, xm + .03, y0 + .78, y0 + .9, dz + .14, dz + .2); box('rubber', xm - .12, xm + .12, y0 + .78, y0 + .79, dz + .08, dz + .25); box('screen', xm - .3, xm + .3, y0 + .92, y0 + 1.25, dz + .115, dz + .12);   // 모니터 (화면은 의자 쪽)
        box('rubber', xm - .25, xm + .25, y0 + .78, y0 + .8, dz - .15, dz + .02);   // 키보드
        cyl('gold', dx1 + .3, y0 + .78, dz + .2, .06, .02); cyl('gold', dx1 + .3, y0 + .8, dz + .2, .01, .28); cyl('white', dx1 + .3, y0 + 1.04, dz + .2, .1, .12, .06, 14);   // 스탠드
        box('rubber', dx2 - .5, dx2 - .28, y0 + .78, y0 + .84, dz + .05, dz + .25); box('dkwood', xm - .2, xm + .2, y0 + .78, y0 + .86, d1 + .04, d1 + .1); box('gold', xm - .19, xm + .19, y0 + .79, y0 + .85, d1 + .035, d1 + .04);   // 전화 · 명패
        { const np = ctex(256, 64, (g, w, h) => { g.fillStyle = '#c8a040'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a1a0a'; g.font = 'bold 40px serif'; g.textAlign = 'center'; g.fillText('교   장', 128, 46); }); plane(np, .37, .06, xm, y0 + .82, d1 + .033, Math.PI, true); }
        mdl('potted_plant_04', dx2 - .2, y0 + .78, d1 + .2, 0, { s: 1.0 });
        // 하이백 가죽 의자 (책상 뒤 · 창 쪽): 5발 받침 · 좌판 · 높은 등받이 · 팔걸이
        { const cx = xm, cz = dz + .95; for (let k = 0; k < 5; k++) { const a = k * 1.2566, gg = new THREE.BoxGeometry(.32, .03, .045); gg.translate(.16, 0, 0); gg.rotateY(a); gg.translate(cx, y0 + .08, cz); G('rubber', gg); } cyl('alu', cx, y0 + .08, cz, .03, .34);
          box('leather', cx - .3, cx + .3, y0 + .42, y0 + .55, cz - .28, cz + .28); box('leather', cx - .3, cx + .3, y0 + .55, y0 + 1.32, cz + .22, cz + .34); box('leather', cx - .24, cx + .24, y0 + 1.32, y0 + 1.4, cz + .23, cz + .33); [cx - .33, cx + .27].forEach(x => box('leather', x, x + .06, y0 + .62, y0 + .7, cz - .2, cz + .2)); }
        [xm - .55, xm + .55].forEach(cx => { const cz = d1 - .65; box('leather', cx - .27, cx + .27, y0 + .4, y0 + .5, cz - .25, cz + .25); box('leather', cx - .27, cx + .27, y0 + .5, y0 + .95, cz - .27, cz - .19); [cx - .29, cx + .25].forEach(x => { box('dkwood', x, x + .04, y0, y0 + .66, cz - .27, cz + .27); box('dkwood', x - .01, x + .05, y0 + .62, y0 + .67, cz - .29, cz + .29); }); });   // 내방객 의자 (등받이는 문 쪽)
        col.push({ x1: dx1, x2: dx2, z1: d1, z2: d2, y1: y0, y2: y0 + .8 });
        if (!opt.noClues) { clueNote('h1', dx1 + .7, y0 + .78, dz - .1, f, .2); clueNote('h4', dx2 - .75, y0 + .78, dz - .2, f, -.3); } }
      props.push({ kind: 'search', label: '교장실 트로피 · 서적장 살펴보기', x: x1 + .9, y: y0 + 1.2, z: z1 + 3.35, floor: f });
      props.push({ kind: 'search', label: '교장실 수납장 열기', x: x2 - .9, y: y0 + .8, z: z1 + 3.5, floor: f });
    } else if (type === 'nurse') {   // 보건실: 침대 3 · 칸막이 커튼 · 약품장 · 세면대
      for (let k = 0; k < 3; k++) { const z = z1 + 2.0 + k * 1.9; bed(x2 - 2.1, x2 - .2, z, y0); box('curtain', x2 - 2.1, x2 - .2, y0 + .25, y0 + 1.95, z + .6, z + .62); box('alu', x2 - 2.1, x2 - .2, y0 + 1.96, y0 + 1.99, z + .58, z + .64); }   // 침대 사이 커튼 + 레일
      cabinet(x1 + .05, x1 + .5, z1 + .5, z1 + 2.5, 1.9, 'white', true);   // 유리문 약품장
      desk(x1 + 2, z2 - 1.2); chairAt(x1 + 2, z2 - .6);
      sinkPedX(x1 + .35, z2 - 2.3, y0, x1 + .02);   // 서쪽 벽 세면대 (예전: 벽을 z 로 잘못 넘겨 도기 판이 바닥 위에 길게 떠 있었다)
      props.push({ kind: 'search', label: '보건실 약품장 열기', x: x1 + .8, y: y0 + 1.2, z: z1 + 1.5, floor: f });
      mdl('medical_box', x1 + 2, y0 + .74, z2 - 1.2, .3); if (!opt.noClues) { clueNote('n2', x1 + 1.7, y0 + .74, z2 - 1.35, f, -.4); clueTape('ts_paramedic', x1 + 2.45, y0 + .74, z2 - 1.05, f); } mdl('wheelchair_01', x1 + 3.6, y0, z2 - .9, 2.4); col.push({ x1: x1 + 3.2, x2: x1 + 4.0, z1: z2 - 1.3, z2: z2 - .5, y1: y0, y2: y0 + 1 });
    } else if (type === 'office') {   // 교무실 · 행정실 (통합 대형 사무실): 칸막이 워크스테이션 4묶음(2×2) · 가운데 회의 탁자 · 행정실 코너(관리자 책상 · 서가) · 탕비 코너 · 캐비닛 벽
      const W = x2 - x1, pod = (px, pz) => {   // 4인 칸막이 묶음: 책상 2×2 (1.2 × .7) · 가운데 · 사이 녹색 칸막이 1.15m · 모니터 · 의자
        for (const dz of [-1, 1]) for (const dx of [-1, 1]) { const x = px + dx * .62, z = pz + dz * .37; desk(x, z, 1.2, .7, .74, 'steelTop'); officeChair(x, z + dz * .72, y0, dz > 0 ? 1 : -1); const zc = z - dz * .12; retroPC(x - .12, y0 + .74, zc - dz * .06, dz > 0 ? 'z+' : 'z-', { tower: 'desk', scale: .9, lcd: true });
          deskClutter(x, z, dz, dx < 0); }
        box('pod', px - 1.24, px + 1.24, y0 + .74, y0 + 1.15, pz - .02, pz + .02); box('pod', px - .02, px + .02, y0 + .74, y0 + 1.15, pz - .72, pz + .72);   // 칸막이
        box('alu', px - 1.25, px + 1.25, y0 + 1.15, y0 + 1.17, pz - .025, pz + .025); };
      // 책상 위 잡동사니: 모니터 · 본체 반대쪽 끝에 칸막이에 기댄 서류철 3권 + 앞쪽에 머그컵 또는 아이보리 전화기(수화기 · 코일선)
      const deskClutter = (x, z, dz, tel) => { const sx = dz > 0 ? 1 : -1, bxc = x + sx * .45, ty = y0 + .74, zp = z - dz * .33, zq = z - dz * .07;
        [-.07, -.015, .04].forEach((o, i) => box('binder' + ((i + Math.round(x * 3)) % 3 + 3) % 3, bxc + o, bxc + o + .045, ty, ty + .29 - i * .02, Math.min(zp, zq), Math.max(zp, zq)));
        if (tel) { const pz = z + dz * .15; box('phone', bxc - .1, bxc + .1, ty, ty + .06, pz - .08, pz + .08); box('phone', bxc - .1, bxc + .1, ty + .06, ty + .09, pz - dz * .08, pz - dz * .03); box('rubber', bxc - .06, bxc + .06, ty + .061, ty + .063, pz - .02 + dz * .02, pz + .03 + dz * .02); }
        else { cyl('mug', bxc, ty, z + dz * .15, .04, .1, .04, 10); box('mug', bxc + sx * .04, bxc + sx * .055, ty + .025, ty + .075, z + dz * .15 - .006, z + dz * .15 + .006); }   // 머그 + 손잡이
        // 결재판 (남색 하드보드 + 끼운 공문 + 집게) · 탁상달력 2008년 10월 (삼각 받침, 의자 쪽을 본다)
        { const cx = sx > 0 ? x - .47 : x + .45, cz = z + dz * .17; box('binder0', cx - .11, cx + .11, ty, ty + .012, cz - .155, cz + .155); box('white', cx - .1, cx + .1, ty + .012, ty + .014, cz - .14, cz + .13); box('alu', cx - .05, cx + .05, ty + .012, ty + .024, cz - dz * .15 - .012, cz - dz * .15 + .012); }
        { const cx = sx > 0 ? x + .25 : x + .47, cz = z - dz * .27, cg = new THREE.PlaneGeometry(.17, .14); cg.rotateX(-.32); if (dz < 0) cg.rotateY(Math.PI); cg.translate(cx, ty + .067, cz); G('deskCal', cg);
          const bg = new THREE.BoxGeometry(.17, .14, .004); bg.rotateX(.32); bg.translate(0, 0, 0); if (dz < 0) bg.rotateY(Math.PI); bg.translate(cx, ty + .067, cz - dz * .045); G('rubber', bg); } };
      mat.pod = mat.pod || M('pod', () => new THREE.MeshStandardMaterial({ color: 0x6f8a5a, roughness: .9 }));
      const cxL = x1 + 2.2, cxR = x2 - 2.6, zr1 = z1 + 2.6, zr2 = z1 + 6.4;
      pod(cxL, zr1); pod(cxL, zr2); pod(cxR, zr1); pod(cxR, zr2);
      // 가운데 회의 탁자 (긴 원목 · 의자 8)
      const mx = (cxL + cxR) / 2; box('wood', mx - .55, mx + .55, y0 + .72, y0 + .77, zr1 - .6, zr2 + .6); [zr1 - .4, zr2 + .4].forEach(z => box('alu', mx - .05, mx + .05, y0, y0 + .72, z - .3, z + .3)); col.push({ x1: mx - .55, x2: mx + .55, z1: zr1 - .6, z2: zr2 + .6, y1: y0, y2: y0 + .77 });
      for (let k = 0; k < 4; k++) { const z = zr1 - .2 + k * (zr2 - zr1 + .4) / 3; chairAt(mx - .95, z); chairAt(mx + .95, z); }
      // 행정실 코너 (서쪽 창가): ㄱ자 관리자 책상 · 서가 · 금고
      desk(x1 + 1.2, z2 - .85, 1.6, .8, .76, 'lockerM'); desk(x1 + .55, z2 - 1.85, .7, 1.2, .76, 'lockerM'); officeChair(x1 + 1.3, z2 - 1.55, y0, -1);
      cabinet(x1 + .05, x1 + .5, z1 + .9, z1 + 3.6, 1.9, 'lockerM', true); mdl('drawer_cabinet', x1 + .32, y0, z2 - 3.6, Math.PI / 2); col.push({ x1: x1 + .05, x2: x1 + .6, z1: z2 - 4.2, z2: z2 - 3.0, y1: y0, y2: y0 + 1.9 });
      mdl('h133/OFF-010', x1 + 2.6, y0, z2 - .3, Math.PI); col.push({ x1: x1 + 2.3, x2: x1 + 2.9, z1: z2 - .5, z2: z2 - .1, y1: y0, y2: y0 + 1.1 });   // 금고 (실사 모델, 예전: 회색 상자)
      // 탕비 코너 (동쪽 · 현관 칸막이 옆): 싱크 하부장 · 정수기 · 냉장고 · 복사기
      cabinetD(x2 - .6, x2 - .05, z1 + .9, z1 + 2.7, y0, .86, 'white', 'x-'); box('rubber', x2 - .62, x2 - .04, y0 + .86, y0 + .89, z1 + .88, z1 + 2.72); sinkPedX(x2 - .35, z1 + 1.6, y0, x2 - .02);   // 동쪽 벽 (예전: x 좌표를 벽 z 로 넘겨 도기 판 · 충돌이 복도를 가로질렀다)
      fridgeX(x2 - .1, x2 - .7, z1 + 3.0, z1 + 3.6, y0);   // 냉장고 (2도어)
      mdl('sf_water_cooler', x2 - .32, y0, z1 + 4.05, -Math.PI / 2); col.push({ x1: x2 - .6, x2: x2 - .05, z1: z1 + 3.8, z2: z1 + 4.3, y1: y0, y2: y0 + 1.32 });   // 실사 생수통 정수기
      copier(x2 - 1.0, x2 - .2, z2 - 1.6, z2 - .9, y0); cabinet(x2 - .5, x2 - .05, z2 - 4.2, z2 - 1.8, 1.9, 'lockerM');
      mdl('wall_clock', x1 + .03, y0 + 2.6, zm, Math.PI / 2); mdl('potted_plant_04', x2 - .4, y0, z2 - .4, 0, { s: 2.2 }); mdl('potted_plant_04', x1 + 2.0, y0, z1 + .5, 0, { s: 2.2 });
      corkBoardZ(x1 + .02, 1, z1 + 4.0, z2 - 3.0, y0 + 1.3, y0 + 2.2);   // 서쪽 벽 게시판
      if (!opt.noClues && !s_staff++) { clueNote('n3', cxL - .62, y0 + .74, zr1 - .37, f, .3); clueNote('n22', cxR + .62, y0 + .74, zr2 - .37, f, -.2); clueTape('ts_vice', mx, y0 + .77, zm, f); clueNote('n21', x1 + 1.2, y0 + .76, z2 - .85, f, .1); }
      props.push({ kind: 'search', label: '교무실 서류함 뒤지기', x: x2 - .9, y: y0 + 1, z: z2 - 3.0, floor: f });
      props.push({ kind: 'search', label: '행정실 장부 확인', x: x1 + 1.9, y: y0 + 1, z: z2 - 1.6, floor: f });
    } else if (type === 'meeting') {   // 교사회의실 (참고 배치도 · 3D 평면도 · 가구 규격도): 다크 우드 바닥 · 모듈 회의 테이블 ㅁ자 (1600×800) + 회의 의자 10 · 연단 · 스크린 · 화이트보드 · 빔 프로젝터 · 복합기 코너 · 창가 하부장 · 유리 수납장 · 자료장 · 교훈 패널 · 게시판 · 옷걸이
      darkMats(); const { plane, ctex } = artHelpers();
      box('dkwood', x1, x2, y0 + .02, y0 + .03, z1, z2);
      box('dkpanel', x1 + .005, x1 + .02, y0, y0 + .12, z1 + .1, z2 - .1); box('dkpanel', x2 - .02, x2 - .005, y0, y0 + .12, z1 + .1, z2 - .1);   // 걸레받이
      // 회의 의자 (W620 D620 H980): 5발 받침 · 가죽 좌판 · 등받이 · 크롬 팔걸이 — face: 앉아서 바라보는 방향 (+x · -x · +z · -z)
      const mchair = (cx, cz, face) => { const ax = face[0] === 'x', s2 = face[1] === '+' ? 1 : -1;
        for (let k = 0; k < 5; k++) { const a = k * 1.2566 + .3, gg = new THREE.BoxGeometry(.3, .03, .04); gg.translate(.15, 0, 0); gg.rotateY(a); gg.translate(cx, y0 + .07, cz); G('alu', gg); } cyl('alu', cx, y0 + .07, cz, .025, .36);
        box('leather', cx - .25, cx + .25, y0 + .43, y0 + .52, cz - .25, cz + .25);
        if (ax) { const bx = cx - s2 * .25; box('leather', Math.min(bx, bx - s2 * .07), Math.max(bx, bx - s2 * .07), y0 + .55, y0 + .98, cz - .23, cz + .23); [cz - .29, cz + .25].forEach(z => box('alu', cx - .2, cx + .2, y0 + .66, y0 + .69, z, z + .04)); }
        else { const bz = cz - s2 * .25; box('leather', cx - .23, cx + .23, y0 + .55, y0 + .98, Math.min(bz, bz - s2 * .07), Math.max(bz, bz - s2 * .07)); [cx - .29, cx + .25].forEach(x => box('alu', x, x + .04, y0 + .66, y0 + .69, cz - .2, cz + .2)); } };
      // 회의 테이블: 모듈 1600×800 × 6 을 긴 변(남북)으로 두 줄 · 가운데 어두운 홈 (전선 · 화분) · 크롬 다리 — ㅁ자
      const tz1 = z1 + 2.3, tz2 = tz1 + 4.8, tx1 = xm - 1.2, tx2 = xm + 1.2, TH = .75;
      [[tx1, tx1 + .8], [tx2 - .8, tx2]].forEach(([a, b]) => { box('dkwood', a, b, y0 + TH - .04, y0 + TH, tz1, tz2); for (let k = 0; k <= 3; k++) { const z = tz1 + k * 1.6; [a + .05, b - .05].forEach(x => box('alu', x - .03, x + .03, y0, y0 + TH - .04, Math.min(Math.max(z, tz1 + .05), tz2 - .05) - .03, Math.min(Math.max(z, tz1 + .05), tz2 - .05) + .03)); } for (let k = 0; k < 3; k++) box('rubber', (a + b) / 2 - .1, (a + b) / 2 + .1, y0 + TH, y0 + TH + .005, tz1 + .8 + k * 1.6 - .04, tz1 + .8 + k * 1.6 + .04); });   // 테이블 매립 콘센트
      box('dkwood', tx1 + .8, tx2 - .8, y0 + TH - .04, y0 + TH, tz1, tz1 + .8); box('dkwood', tx1 + .8, tx2 - .8, y0 + TH - .04, y0 + TH, tz2 - .8, tz2);   // ㅁ자 양 끝
      box('rubber', tx1 + .8, tx2 - .8, y0 + TH - .12, y0 + TH - .1, tz1 + .8, tz2 - .8);   // 가운데 빈 홈 (어두운 바닥판)
      mdl('potted_plant_04', xm, y0 + TH - .1, tz1 + 1.8, 0, { s: 1.4 }); mdl('potted_plant_04', xm, y0 + TH - .1, tz2 - 1.8, 0, { s: 1.4 });
      col.push({ x1: tx1, x2: tx2, z1: tz1, z2: tz2, y1: y0, y2: y0 + TH });
      for (let k = 0; k < 4; k++) { const z = tz1 + .6 + k * 1.2; mchair(tx1 - .55, z, 'x+'); mchair(tx2 + .55, z, 'x-'); box('white', tx1 + .15, tx1 + .45, y0 + TH, y0 + TH + .01, z - .2, z + .2); box('white', tx2 - .45, tx2 - .15, y0 + TH, y0 + TH + .01, z - .2, z + .2); }
      mchair(xm, tz1 - .55, 'z+'); mchair(xm, tz2 + .55, 'z-');
      // ── 동쪽 벽: 연단 (복도 쪽 구석) · 스크린 · 화이트보드 · 교명 · 시계 · 빔 프로젝터 · 복합기 코너 (창 쪽 구석) ──
      { const px = x2 - .7, pz = z1 + 1.5; box('dkwood', px - .27, px + .27, y0, y0 + .08, pz - .35, pz + .35); box('dkwood', px - .22, px + .22, y0 + .08, y0 + 1.05, pz - .3, pz + .3, { solid: true }); box('dkwood', px - .3, px + .3, y0 + 1.05, y0 + 1.15, pz - .38, pz + .38);
        const lg = ctex(128, 128, (g, w, h) => { g.fillStyle = '#4a2c18'; g.fillRect(0, 0, w, h); g.fillStyle = '#c8a040'; g.beginPath(); g.arc(64, 64, 44, 0, 7); g.fill(); g.fillStyle = '#1a2a50'; g.beginPath(); g.arc(64, 64, 36, 0, 7); g.fill(); g.fillStyle = '#e8d8a0'; g.font = 'bold 44px serif'; g.textAlign = 'center'; g.fillText('서', 64, 80); }); plane(lg, .28, .28, px - .225, y0 + .7, pz, -Math.PI / 2); }
      { const sz = z1 + 3.9; box('rubber', x2 - .14, x2 - .04, y0 + 2.62, y0 + 2.72, sz - 1.2, sz + 1.2); box('white', x2 - .06, x2 - .05, y0 + 1.25, y0 + 2.62, sz - 1.1, sz + 1.1); box('rubber', x2 - .07, x2 - .04, y0 + 1.22, y0 + 1.26, sz - 1.12, sz + 1.12); }   // 전동 스크린 (2200×1400)
      { const wz = z1 + 6.6; box('alu', x2 - .06, x2 - .01, y0 + .95, y0 + 2.19, wz - 1.24, wz + 1.24); const wb = ctex(512, 256, (g, w, h) => { g.fillStyle = '#f6f6f2'; g.fillRect(0, 0, w, h); g.fillStyle = '#1c2a6a'; g.font = '26px sans-serif'; ['< 회의 안건 >', '1. 2학기 평가 계획', '2. 생활지도 협의', '3. 진로진학 운영 방안', '4. 기타 안건'].forEach((t, k) => g.fillText(t, 30, 44 + k * 42)); g.fillStyle = '#c03030'; g.fillText('2008. 10. 13 (월)', 300, 230); });
        plane(wb, 2.36, 1.16, x2 - .065, y0 + 1.57, wz, -Math.PI / 2); box('alu', x2 - .14, x2 - .06, y0 + .93, y0 + .96, wz - 1.1, wz + 1.1); }   // 화이트보드 (2400×1200) · 분필 받침
      { const sg = ctex(512, 160, (g, w, h) => { g.fillStyle = '#ece4d0'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a2a50'; g.beginPath(); g.arc(70, 80, 56, 0, 7); g.fill(); g.fillStyle = '#e8d8a0'; g.font = 'bold 60px serif'; g.textAlign = 'center'; g.fillText('서', 70, 102); g.fillStyle = '#1a2a50'; g.textAlign = 'left'; g.font = 'bold 50px sans-serif'; g.fillText('서문고등학교', 150, 70); g.fillText('교사회의실', 150, 132); }); plane(sg, 1.6, .5, x2 - .03, y0 + 2.75, z1 + 1.5, -Math.PI / 2); }
      mdl('wall_clock', x2 - .03, y0 + 2.75, z1 + 5.4, -Math.PI / 2);
      box('white', xm - .2, xm + .2, y0 + S.CEIL - .32, y0 + S.CEIL - .18, z1 + 3.75, z1 + 4.05); cyl('alu', xm, y0 + S.CEIL - .18, z1 + 3.9, .02, .18); cyl('rubber', xm + .21, y0 + S.CEIL - .25, z1 + 3.9, .04, .02);   // 천장 빔 프로젝터
      cabinetD(x2 - .55, x2 - .05, z2 - 1.95, z2 - .75, y0, .8, 'dkwood', 'x-'); copier(x2 - .52, x2 - .1, z2 - 1.85, z2 - 1.25, y0 + .8); box('rubber', x2 - .5, x2 - .12, y0 + .8, y0 + 1.1, z2 - 1.15, z2 - .8, { solid: true });   // 복합기 받침장 (1200×500×800) + 복합기 · 문서함
      mdl('potted_plant_04', x2 - .45, y0, z2 - .45, 0, { s: 3.2 }); mdl('potted_plant_04', x2 - .45, y0, z1 + 2.4, 0, { s: 3.0 });
      // ── 창가 하부장 (4200×450×800): 스탠드 · 상장 액자 · 책 · 화분 ──
      cabinetD(xm - 2.1, xm + 2.1, z2 - .68, z2 - .23, y0, .8, 'dkwood', 'z-'); box('dkwood', xm - 2.12, xm + 2.12, y0 + .8, y0 + .83, z2 - .7, z2 - .21);
      cyl('gold', xm - 1.8, y0 + .83, z2 - .45, .06, .02); cyl('gold', xm - 1.8, y0 + .85, z2 - .45, .01, .26); cyl('white', xm - 1.8, y0 + 1.08, z2 - .45, .14, .14, .09, 14);
      for (let k = 0; k < 3; k++) { const x = xm - 1.1 + k * .4; box('dkwood', x - .14, x + .14, y0 + .83, y0 + 1.06, z2 - .4, z2 - .37); box('white', x - .12, x + .12, y0 + .85, y0 + 1.04, z2 - .405, z2 - .4); }
      for (let b = 0; b < 10; b++) box(['red', 'lockerM', 'white', 'cork'][b % 4], xm + .4 + b * .06, xm + .45 + b * .06, y0 + .83, y0 + 1.1 - (b % 3) * .03, z2 - .55, z2 - .33);
      mdl('potted_plant_04', xm + 1.6, y0 + .83, z2 - .45, 0, { s: 1.3 });
      // ── 서쪽 벽: 유리 수납장 (3600×450×2100) · 자료장 (1800) · 옷걸이 ──
      { const sx = x1 + .05, sx2 = x1 + .5; cabinetD(sx, sx2, z1 + 2.6, z1 + 6.2, y0, .85, 'dkwood', 'x+'); box('dkwood', sx, sx2 - .05, y0 + .85, y0 + 2.1, z1 + 2.6, z1 + 6.2, { solid: true }); box('glass', sx2 - .05, sx2 - .04, y0 + .9, y0 + 2.05, z1 + 2.65, z1 + 6.15);
        for (let k = 1; k < 6; k++) box('dkwood', sx2 - .06, sx2 - .02, y0 + .85, y0 + 2.1, z1 + 2.6 + k * .6 - .015, z1 + 2.6 + k * .6 + .015);
        for (let j = 0; j < 3; j++) { const y = y0 + .9 + j * .4; box('dkwood', sx + .03, sx2 - .06, y, y + .02, z1 + 2.65, z1 + 6.15); for (let b = 0; b < 30; b++) if ((b * 7 + j) % 5) box(['white', 'lockerM', 'cork', 'red'][(b + j) % 4], sx + .1, sx2 - .1, y + .02, y + .3 - (b % 3) * .03, z1 + 2.7 + b * .115, z1 + 2.79 + b * .115); } }
      { const sx = x1 + .05, sx2 = x1 + .5, a = z1 + 6.5, b = a + 1.8; cabinetD(sx, sx2, a, b, y0, .85, 'dkwood', 'x+'); box('dkwood', sx, sx2 - .05, y0 + .85, y0 + 2.1, a, b, { solid: true });
        for (let j = 0; j < 3; j++) { const y = y0 + .9 + j * .4; box('dkwood', sx + .03, sx2 - .03, y, y + .02, a + .05, b - .05); for (let k = 0; k < 3; k++) { const z = a + .3 + k * .6; if ((j + k) % 3 === 1) { cyl('gold', sx + .25, y + .02, z, .05, .05, .07); cyl('gold', sx + .25, y + .07, z, .015, .1); cyl('gold', sx + .25, y + .17, z, .07, .09, .04, 12); } else for (let q = 0; q < 6; q++) box(['white', 'cork', 'lockerM'][q % 3], sx + .1, sx2 - .1, y + .02, y + .32, z - .2 + q * .07, z - .15 + q * .07); } } }   // 자료장 (트로피 · 서류철)
      { const cx = x1 + .5, cz = z2 - .75; cyl('dkwood', cx, y0, cz, .22, .04, .25, 10); cyl('dkwood', cx, y0 + .04, cz, .025, 1.76); for (let k = 0; k < 6; k++) { const a = k * 1.047; box('dkwood', cx + Math.cos(a) * .12 - .015, cx + Math.cos(a) * .12 + .015, y0 + 1.66, y0 + 1.72, cz + Math.sin(a) * .12 - .015, cz + Math.sin(a) * .12 + .015); } box('leather', cx + .02, cx + .2, y0 + .8, y0 + 1.66, cz - .18, cz + .18); col.push({ x1: cx - .25, x2: cx + .25, z1: cz - .25, z2: cz + .25, y1: y0, y2: y0 + 1.8 }); }   // 옷걸이 (500×500×1800)
      mdl('potted_plant_04', x1 + .5, y0, z1 + 1.9, 0, { s: 3.0 });
      // ── 복도 쪽 벽: 교훈 패널 · 게시판 (문과 문 사이) ──
      { const mt = ctex(384, 384, (g, w, h) => { g.fillStyle = '#f2ead8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#4a2c18'; g.lineWidth = 16; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = '#1a1410'; g.font = 'bold 50px serif'; g.textAlign = 'center'; ['바른 인성', '깊은 배움', '더 큰 세상으로'].forEach((t, k) => g.fillText(t, w / 2, 120 + k * 90)); });
        plane(mt, .85, .85, x1 + 2.8, y0 + 1.2, z1 + .02, 0); }   // 복도 채광창 유리 아래로
      { const bb = ctex(512, 320, (g, w, h) => { g.fillStyle = '#b08a5a'; g.fillRect(0, 0, w, h); for (let k = 0; k < 7; k++) { g.fillStyle = k % 2 ? '#f4f0e4' : '#e8f0f4'; const x = 20 + (k % 4) * 122, y = 20 + (k / 4 | 0) * 150; g.fillRect(x, y, 100, 130); g.fillStyle = '#c03030'; g.beginPath(); g.arc(x + 50, y + 6, 5, 0, 7); g.fill(); g.fillStyle = '#556'; for (let l = 0; l < 6; l++) g.fillRect(x + 10, y + 22 + l * 16, 80, 3); } g.strokeStyle = '#6a4a2a'; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14); });
        plane(bb, 1.8, .85, xm + .9, y0 + 1.2, z1 + .02, 0); }
      props.push({ kind: 'search', label: '교사회의실 유리 수납장 살펴보기', x: x1 + .95, y: y0 + 1.2, z: z1 + 4.4, floor: f });
      props.push({ kind: 'search', label: '회의 안건 화이트보드 읽기', x: x2 - .8, y: y0 + 1.5, z: z1 + 6.6, floor: f });
    } else if (type === 'career') {   // 진로상담실: 상담 원탁 · 진학 자료 책장 2 · 대학 안내 게시판 · 상담 책상
      box('lockerM', xm - .6, xm + .6, y0 + .7, y0 + .74, zm - .6, zm + .6); col.push({ x1: xm - .6, x2: xm + .6, z1: zm - .6, z2: zm + .6, y1: y0, y2: y0 + .74 });
      [[-1, 0], [1, 0], [0, 1]].forEach(([a, b]) => chairAt(xm + a * .95, zm + b * .95));
      [zm - 1.8, zm + 1.8].forEach(z => { mdl('wooden_bookshelf_worn', x2 - .32, y0, z, -Math.PI / 2); books(x2 - .47, z, y0, -1); col.push({ x1: x2 - .62, x2: x2 - .02, z1: z - .72, z2: z + .72, y1: y0, y2: y0 + 2.1 }); });
      desk(x1 + 1.6, z2 - 1.3, 1.4, .7); chairAt(x1 + 1.6, z2 - .7); corkBoardZ(x1 + .02, 1, z1 + 1.2, z2 - 2.2, y0 + 1.2, y0 + 2.2);
      mdl('potted_plant_04', x1 + .5, y0, z1 + .6, 0, { s: 2.2 });
      props.push({ kind: 'search', label: '진학 자료 책장 살펴보기', x: x2 - .9, y: y0 + 1.2, z: zm, floor: f });
    } else if (type === 'storage') {   // 창고: 철제 선반 줄 · 상자 더미 · 접이식 의자 · 낡은 책걸상 — 선반은 앵글 기둥 + 판 (예전: 속이 꽉 찬 녹슨 상자에 상자가 묻혔다)
      for (let i = 0; i < 3; i++) { const x = x1 + 1.6 + i * 2.4; for (let z = z1 + 1.2; z <= z2 - 1.6 + .01; z += (z2 - 2.8 - z1) / 5) [-1, 1].forEach(sx => box('steelG', x + sx * .3 - .02, x + sx * .3 + .02, y0, y0 + 2.0, z - .02, z + .02)); col.push({ x1: x - .32, x2: x + .32, z1: z1 + 1.2, z2: z2 - 1.6, y1: y0, y2: y0 + 2.0 }); for (let j = 0; j < 4; j++) { const yy = y0 + .2 + j * .48; box('alu', x - .32, x + .32, yy, yy + .03, z1 + 1.2, z2 - 1.6); for (let k = 0; k < 5; k++) if ((i + j + k) % 3) [0, .42].forEach(d => mdl('cardboard_box_01', x, yy + .033, z1 + 1.62 + k * 1.1 + d, ((i * 7 + j * 3 + k) % 5 - 2) * .06, { s: .78 })); } }   // 실사 골판지 상자 (예전: 코르크색 상자)
      for (let k = 0; k < 5; k++) mdl('cardboard_box_01', x2 - 1.25 + (k % 2) * .45 + (k > 3 ? .22 : 0), y0 + .007 + (k >> 1) * .335, z2 - 1.05, [.05, -.12, .2, -.04, .35][k], { s: 1 }); col.push({ x1: x2 - 1.5, x2: x2 - .55, z1: z2 - 1.35, z2: z2 - .75, y1: y0, y2: y0 + 1.0 });   // 실사 상자 더미
      props.push({ kind: 'search', label: '창고 상자 뒤지기', x: x2 - 1.2, y: y0 + .8, z: z2 - 1.6, floor: f });
    } else if (type === 'counsel') {   // 상담실: 원탁 · 의자 4 · 책장 · 칸막이
      box('lockerM', xm - .6, xm + .6, y0 + .7, y0 + .74, zm - .6, zm + .6); col.push({ x1: xm - .6, x2: xm + .6, z1: zm - .6, z2: zm + .6, y1: y0, y2: y0 + .74 });
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([a, b]) => chairAt(xm + a * .95, zm + b * .95));
      mdl('wooden_bookshelf_worn', x2 - .32, y0, zm, -Math.PI / 2); col.push({ x1: x2 - .62, x2: x2 - .02, z1: zm - .72, z2: zm + .72, y1: y0, y2: y0 + 2.1 });
      mdl('potted_plant_04', x1 + .5, y0, z2 - .5, 0, { s: 2.4 });
    } else if (type === 'bcast') {   // 18m 방송실 (두 칸): 서쪽 주조정실(MCR) | 방음 유리 칸막이 · 방음문 | 동쪽 TV · 라디오 스튜디오 — 2008년 고교 방송실 실사 배치
      {
      const X1 = x1, X2 = x1 + 17.8, XP = X1 + 9;
      UVM.carpet = .5; UVM.foam = .6; UVM.fabric = 1.2; UVM.carpetS = .5;
      const tile = (bg, ln) => canvasTex(128, 128, (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); for (let i = 0; i < 1800; i++) { const v = Math.random() * 30 - 15; g.fillStyle = `rgba(${128 + v},${128 + v},${140 + v},.08)`; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); } g.strokeStyle = ln; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); });
      // 실사 재질 (Poly Haven CC0): 카펫 타일 · 흡음 패브릭 · 벨벳 암막 · 인조가죽 의자 · 장비랙 철판
      UVM.carpet = UVM.carpetS = 1.5; UVM.fabric = 1.0; UVM.bcCurtain = 1.4; UVM.leather = .6; UVM.rack = .8;
      mat.carpet = M('carpet', () => pbr('bc_carpet', { color: 0x9aa4b8, rough: 1 }));
      mat.carpetS = M('carpetS', () => pbr('bc_carpet', { color: 0x6a6c74, rough: 1 }));
      mat.bcCurtain = M('bcCurtain', () => pbr('bc_curtain', { color: 0x4a2a30, rough: 1 }));
      mat.leather = M('leather', () => pbr('bc_leather', { color: 0x3a3c40, rough: .7, nScale: .6 }));
      mat.rack = M('rack', () => pbr('bc_metal', { color: 0x40444a, rough: .6, metal: .6 }));
      mat.foam = M('foam', () => new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g, w, h) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const gr = g.createLinearGradient(x * 32, y * 32, x * 32 + 32, y * 32 + 32); const d = (x + y) % 2; gr.addColorStop(0, d ? '#3c3f46' : '#2a2c31'); gr.addColorStop(1, d ? '#1e2024' : '#45484f'); g.fillStyle = gr; g.fillRect(x * 32, y * 32, 32, 32); } }), roughness: 1 }));
      mat.fabric = M('fabric', () => pbr('bc_fabric', { color: 0x8a96a8, rough: 1 }));
      mat.ledG = M('ledG', () => new THREE.MeshStandardMaterial({ color: 0x40ff60, emissive: 0x30e050, emissiveIntensity: 1.2 }));
      mat.ledR = M('ledR', () => new THREE.MeshStandardMaterial({ color: 0xff4030, emissive: 0xff2010, emissiveIntensity: 1.2 }));
      mat.mon = M('mon', () => new THREE.MeshStandardMaterial({ color: 0x1a2a3a, emissive: 0x284a6a, emissiveIntensity: .45, roughness: .2 }));
      const sign = (text, w, h, x, y, z, ry, bg = '#3a0806', fg = '#ff5040', glow = true) => { const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w); const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.fillStyle = fg; g.font = `bold ${Math.round(c.height * .55)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2 + 2);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glow ? new THREE.MeshBasicMaterial({ map: t }) : new THREE.MeshStandardMaterial({ map: t, roughness: .6 })); m.position.set(x, y, z); m.rotation.y = ry; root.add(m); return m; };
      const chairX = (x, z, dir) => { box('leather', x - .23, x + .23, y0 + .42, y0 + .5, z - .23, z + .23); box('leather', x + dir * .2 - .025, x + dir * .2 + .025, y0 + .55, y0 + .98, z - .21, z + .21); cyl('alu', x, y0 + .08, z, .025, .34);
        for (let k = 0; k < 5; k++) { const a = k * 1.2566, g = new THREE.BoxGeometry(.3, .03, .04); g.translate(.15, 0, 0); g.rotateY(a); g.translate(x, y0 + .08, z); G('rubber', g); } };
      // ── 바닥 · 벽 마감: 카펫 타일 (주조정실 청회색 · 스튜디오 진회색), 주조정실 벽 허리 아래 패브릭 흡음 패널
      box('carpet', X1, XP - .07, y0 + .02, y0 + .03, z1, z2); box('carpetS', XP + .07, X2, y0 + .02, y0 + .03, z1, z2);
      box('fabric', X1 + .01, X1 + .04, y0 + .1, y0 + 1.0, z1 + .2, z2 - .2); box('fabric', X1 + 1.8, XP - .1, y0 + .1, y0 + 1.0, z1 + .01, z1 + .04);
      // ── 주조정실(MCR) ──
      // 서쪽 벽 모니터 월: 랙 프레임 + 9분할 CRT + 프로그램/프리뷰 대형 모니터
      box('rack', X1 + .02, X1 + .38, y0 + .75, y0 + 2.5, z1 + 1.2, z1 + 6.6, { solid: true });
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const zc = z1 + 1.45 + i * 1.28; box('crt', X1 + .38, X1 + .42, y0 + 1.6 + j * .45, y0 + 2.0 + j * .45, zc, zc + 1.1); box('mon', X1 + .42, X1 + .43, y0 + 1.64 + j * .45, y0 + 1.96 + j * .45, zc + .05, zc + 1.05); }
      box('crt', X1 + .38, X1 + .44, y0 + .85, y0 + 1.5, z1 + 1.6, z1 + 3.6); box('mon', X1 + .44, X1 + .45, y0 + .9, y0 + 1.45, z1 + 1.7, z1 + 3.5);
      box('crt', X1 + .38, X1 + .44, y0 + .85, y0 + 1.5, z1 + 4.2, z1 + 6.2); box('mon', X1 + .44, X1 + .45, y0 + .9, y0 + 1.45, z1 + 4.3, z1 + 6.1);
      sign('PGM', .5, .14, X1 + .46, y0 + 1.52, z1 + 2.6, Math.PI / 2, '#300', '#f44'); sign('PVW', .5, .14, X1 + .46, y0 + 1.52, z1 + 5.2, Math.PI / 2, '#030', '#4f6');
      // 메인 콘솔: 하부장 + 경사 믹서 (페이더 32 · 노브 줄 · VU 미터 브리지) + 근접 모니터 스피커
      cabinetD(XP - 1.95, XP - 1.0, z1 + 1.4, z1 + 6.4, y0, .78, 'steelG', 'x-');   // 콘솔: 유리벽을 마주 보게 (운영자는 서쪽에 앉아 스튜디오를 본다)
      { const g = new THREE.BoxGeometry(1.0, .06, 5.0); g.rotateZ(.16); g.translate(XP - 1.47, y0 + .84, z1 + 3.9); G('rubber', g); }
      for (let k = 0; k < 32; k++) { const fz = z1 + 1.6 + k * .145; box('alu', XP - 1.82, XP - 1.55, y0 + .8, y0 + .82, fz - .01, fz + .01); box('white', XP - 1.64 - (k * 37 % 7) * .03, XP - 1.6 - (k * 37 % 7) * .03, y0 + .82, y0 + .85, fz - .02, fz + .02);
        for (let j = 0; j < 3; j++) cyl(j ? 'rubber' : 'red', XP - 1.12 - j * .12, y0 + .9 - j * .02, fz, .014, .03); }
      box('rubber', XP - 1.08, XP - .98, y0 + .92, y0 + 1.22, z1 + 1.5, z1 + 6.3); for (let k = 0; k < 16; k++) { const lz = z1 + 1.7 + k * .29; box(k % 5 === 4 ? 'ledR' : 'ledG', XP - 1.09, XP - 1.08, y0 + .97, y0 + .97 + .05 + (k * 13 % 5) * .03, lz - .04, lz + .04); }
      [z1 + 1.2, z1 + 6.6].forEach(z => { box('rubber', XP - 1.4, XP - 1.05, y0 + .8, y0 + 1.3, z - .17, z + .17); cyl('rubber', XP - 1.41, y0 + .95, z, .07, .02); });
      chairX(XP - 2.5, z1 + 3.0, -1); chairX(XP - 2.5, z1 + 4.8, -1);
      sign('송출 콘솔 · MASTER', .9, .16, XP - 1.96, y0 + .6, z1 + 3.9, -Math.PI / 2, '#20262c', '#d8e0e8', false);
      // 19인치 장비랙 4대 (복도 쪽 벽): VTR 데크 · 비디오 스위처 · 패치베이 · 전관방송 앰프 — 깜빡이는 LED
      for (let k = 0; k < 4; k++) { const rx = X1 + 2.3 + k * .78; cabinet(rx, rx + .66, z1 + .05, z1 + .75, 2.0, 'rack');
        for (let j = 0; j < 7; j++) { const yy = y0 + .25 + j * .24; box(j % 3 === 0 ? 'alu' : 'screen', rx + .05, rx + .61, yy, yy + .18, z1 + .75, z1 + .77); box(j % 2 ? 'ledG' : 'ledR', rx + .5, rx + .54, yy + .07, yy + .11, z1 + .77, z1 + .78); if (j % 3 === 1) box('rubber', rx + .1, rx + .4, yy + .05, yy + .1, z1 + .77, z1 + .79); } }
      sign('VTR · SWITCHER · PATCH · AMP', 3.0, .16, X1 + 3.85, y0 + 2.18, z1 + .78, 0, '#20262c', '#d8e0e8', false);
      // 전관방송 선택 패널 (서쪽 벽 남쪽): 학급별 스피커 셀렉터 단추 격자
      box('steelG', X1 + .02, X1 + .3, y0 + .95, y0 + 1.95, z1 + 7.1, z1 + 8.5, { solid: true });
      for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) box(j === 0 ? 'ledG' : 'white', X1 + .3, X1 + .32, y0 + 1.05 + j * .17, y0 + 1.15 + j * .17, z1 + 7.2 + i * .21, z1 + 7.33 + i * .21);
      sign('전관방송 선택', 1.2, .16, X1 + .33, y0 + 2.05, z1 + 7.8, Math.PI / 2, '#20262c', '#e8e0c8', false);
      // CCTV 녹화기 받침 + 모니터 (남서 구석)
      box('lockerM', X1 + .3, X1 + 1.3, y0, y0 + .72, z1 + 8.7, z2 - .3, { solid: true }); box('crt', X1 + .45, X1 + .95, y0 + .72, y0 + 1.12, z1 + 8.9, z1 + 9.4); box('mon', X1 + .95, X1 + .96, y0 + .76, y0 + 1.08, z1 + 8.95, z1 + 9.35); box('rubber', X1 + .4, X1 + 1.2, y0 + .72, y0 + .8, z1 + 9.45, z2 - .35);
      // 영상 편집석 (남쪽 창가): NLE PC 2대 · 키보드 · 조그 셔틀 · 의자
      desk(X1 + 3.6, z2 - .75, 3.0, .8, .74); [X1 + 2.9, X1 + 4.3].forEach(mx => { box('crt', mx - .25, mx + .25, y0 + .79, y0 + 1.2, z2 - .95, z2 - .55); box('mon', mx - .2, mx + .2, y0 + .84, y0 + 1.16, z2 - .96, z2 - .95); box('crt', mx - .22, mx + .22, y0 + .74, y0 + .76, z2 - 1.12, z2 - 1.0); });
      cyl('rubber', X1 + 3.6, y0 + .74, z2 - 1.05, .06, .03); chairAt(X1 + 3.6, z2 - 1.5);
      era08Bcast(X1, z2, y0);   // 2008 추가: 디지털 믹서 · LCD · DVD/VHS 콤보 카트
      // 방송 시간표 게시판 · 벽시계
      box('cork', X1 + .02, X1 + .06, y0 + 1.35, y0 + 2.15, z1 + 8.65, z2 - .25); sign('방송 편성표 2008.10', .7, .5, X1 + .07, y0 + 1.75, (z1 + 8.65 + z2 - .25) / 2, Math.PI / 2, '#f0ece0', '#203040', false);   // 창을 가리지 않게 서쪽 벽 CCTV 받침 위
      // ── 방음 유리 칸막이 · 방음문 (가운데) · ON AIR 등 ──
      // 유리벽: 허리벽(0.8m) 위로 천장 밑(2.45m)까지 이중 투명 유리 · 멀리온 — 조정실에서 녹음실이 훤히 보인다. 장비실 구간(남쪽 2.8m)만 막힌 벽
      { const ZQ = z2 - 2.8, seg = [[z1 + 1.35, ZQ]];   // 문은 북쪽 끝(장비실 반대편) — 콘솔 뒤로 비집고 들어가던 가운데 문을 옮겼다
        box('wall', XP - .1, XP + .1, y0, y0 + S.CEIL, z1, z1 + .35, { solid: true });
        seg.forEach(([a, b]) => { box('wall', XP - .1, XP + .1, y0, y0 + .8, a, b); box('wall', XP - .1, XP + .1, y0 + 2.45, y0 + S.CEIL, a, b); col.push({ x1: XP - .1, x2: XP + .1, z1: a, z2: b, y1: y0, y2: y0 + S.CEIL });
          box('glass', XP - .03, XP - .02, y0 + .8, y0 + 2.45, a + .05, b - .05); box('glass', XP + .02, XP + .03, y0 + .8, y0 + 2.45, a + .05, b - .05);
          box('alu', XP - .1, XP + .1, y0 + .78, y0 + .82, a, b); box('alu', XP - .1, XP + .1, y0 + 2.43, y0 + 2.47, a, b);
          for (let z = a + 1.2; z < b - .3; z += 1.2) box('alu', XP - .06, XP + .06, y0 + .8, y0 + 2.45, z - .03, z + .03); });
        box('wall', XP - .1, XP + .1, y0, y0 + S.CEIL, ZQ, z2, { solid: true }); }
      box('wall', XP - .1, XP + .1, y0 + 2.15, y0 + S.CEIL, z1 + .35, z1 + 1.35);
      box('steelG', XP - .12, XP + .12, y0, y0 + 2.15, z1 + .3, z1 + .37); box('steelG', XP - .12, XP + .12, y0, y0 + 2.15, z1 + 1.33, z1 + 1.4); box('steelG', XP - .12, XP + .12, y0 + 2.1, y0 + 2.18, z1 + .3, z1 + 1.4);   // 문틀
      box('alu', XP - .14, XP + .14, y0, y0 + .015, z1 + .37, z1 + 1.33);   // 알루미늄 문턱 (문짝은 game.js — 두꺼운 방음문 · 원형 창)
      sign('ON AIR', .6, .2, XP - .11, y0 + 2.4, z1 + .85, -Math.PI / 2); sign('ON AIR', .6, .2, XP + .11, y0 + 2.4, z1 + .85, Math.PI / 2);
      // ── 스튜디오 ──
      // 흡음 폼: 동쪽 벽(배경막 남쪽) · 복도 쪽 벽 위쪽, 남쪽 창은 두꺼운 암막 커튼
      box('foam', X2 - .08, X2 - .02, y0 + .3, y0 + 2.6, z1 + 5.3, z2 - .3); box('foam', XP + 1.8, X1 + 15.9, y0 + 1.4, y0 + 2.6, z1 + .01, z1 + .07);
      for (let k = 0; k < 7; k++) box('bcCurtain', XP + .4 + k * 1.2, XP + 1.6 + k * 1.2, y0 + .5, y0 + 2.55, z2 - .1, z2 - .04);
      // 뉴스 배경막 (동쪽 벽) + 앵커 데스크 · 의자 2 · 데스크 마이크
      { const c = document.createElement('canvas'); c.width = 1024; c.height = 400; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 1024, 400); gr.addColorStop(0, '#0c2a5a'); gr.addColorStop(1, '#1c5a9a'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 400);
        g.strokeStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(780, 200, 40 + i * 30, 0, 7); g.stroke(); } g.fillStyle = '#f0f4fa'; g.font = 'bold 86px sans-serif'; g.textAlign = 'left'; g.fillText('SBS 서문방송', 70, 180); g.font = '40px sans-serif'; g.fillText('서문고등학교 방송부 · Since 1987', 74, 250);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.6), new THREE.MeshStandardMaterial({ map: t, roughness: .55 })); m.position.set(X2 - .04, y0 + 1.75, z1 + 3.1); m.rotation.y = -Math.PI / 2; root.add(m); }
      box('lockerM', X1 + 15.2, X1 + 15.9, y0, y0 + .76, z1 + 1.7, z1 + 4.5, { solid: true }); box('fabric', X1 + 15.18, X1 + 15.2, y0 + .1, y0 + .7, z1 + 1.8, z1 + 4.4); box('wood', X1 + 15.1, X1 + 16.0, y0 + .76, y0 + .8, z1 + 1.6, z1 + 4.6);
      sign('서문방송', .9, .22, X1 + 15.17, y0 + .45, z1 + 3.1, -Math.PI / 2, '#0c2a5a', '#f0f4fa', false);
      chairX(X1 + 16.5, z1 + 2.5, 1); chairX(X1 + 16.5, z1 + 3.8, 1);
      [z1 + 2.5, z1 + 3.8].forEach(z => { cyl('alu', X1 + 15.4, y0 + .8, z, .01, .25); box('rubber', X1 + 15.37, X1 + 15.43, y0 + 1.03, y0 + 1.12, z - .03, z + .03); });
      // ENG 카메라 2대 (삼각대) — 앵커석을 향해
      [z1 + 2.4, z1 + 4.0].forEach(z => { const cx = X1 + 12.2; [[-.35, -.2], [.25, -.3], [.1, .38]].forEach(([dx, dz]) => { const g = new THREE.CylinderGeometry(.015, .02, 1.3, 6); g.rotateZ(dx * .5); g.rotateX(dz * .5); g.translate(cx + dx * .5, y0 + .62, z + dz * .5); G('rubber', g); });
        box('rubber', cx - .25, cx + .3, y0 + 1.2, y0 + 1.5, z - .12, z + .12); cyl('rubber', cx + .38, y0 + 1.35 - .1, z, .07, .2); box('screen', cx - .3, cx - .26, y0 + 1.25, y0 + 1.45, z - .1, z + .1); box('ledR', cx + .1, cx + .14, y0 + 1.5, y0 + 1.53, z - .02, z + .02);
        col.push({ x1: cx - .45, x2: cx + .45, z1: z - .45, z2: z + .45, y1: y0, y2: y0 + 1.6 }); });
      // 조명 그리드 (천장 파이프 2줄) + 프레넬 조명 4개
      [z1 + 1.9, z1 + 4.4].forEach(z => { box('alu', XP + .6, X2 - .4, y0 + S.CEIL - .2, y0 + S.CEIL - .15, z - .025, z + .025); [X1 + 13.2, X1 + 14.8].forEach(x => { box('alu', x - .01, x + .01, y0 + S.CEIL - .45, y0 + S.CEIL - .17, z - .01, z + .01); const g = new THREE.CylinderGeometry(.11, .14, .3, 12); g.rotateZ(-1.0); g.translate(x, y0 + S.CEIL - .55, z); G('rubber', g); }); });
      // 라디오 토크 원탁 (남쪽): 마이크 붐 3 · 헤드폰 · 의자
      const tx = X1 + 12.3, tz = z1 + 7.3; cyl('wood', tx, y0 + .72, tz, .85, .05, .85, 24); cyl('alu', tx, y0, tz, .06, .72); col.push({ x1: tx - .85, x2: tx + .85, z1: tz - .85, z2: tz + .85, y1: y0, y2: y0 + .77 });
      [[0, -1], [1, 0], [-1, 0]].forEach(([a, b2]) => { chairAt(tx + a * 1.2, tz + b2 * 1.2); cyl('alu', tx + a * .5, y0 + .77, tz + b2 * .5, .012, .35); box('rubber', tx + a * .5 - .04, tx + a * .5 + .04, y0 + 1.1, y0 + 1.24, tz + b2 * .5 - .04, tz + b2 * .5 + .04);
        const hp = new THREE.TorusGeometry(.08, .012, 6, 12, Math.PI); hp.translate(tx + a * .35, y0 + .78, tz + b2 * .35); G('rubber', hp); });
      // 마스터 테이프 보관장 (복도 쪽 벽, 유리문) · 스튜디오 소품장
      cabinet(XP + 1.3, XP + 5.4, z1 + .05, z1 + .55, 1.2, 'wood', true);   // 문 앞을 비워 둔다
      for (let k = 0; k < 33; k++) box(k % 3 ? 'screen' : 'rubber', XP + 1.4 + k * .12, XP + 1.48 + k * .12, y0 + .3, y0 + .5, z1 + .1, z1 + .5);
      cabinet(X2 - 1.6, X2 - .3, z1 + .05, z1 + .6, 1.6, 'steelG');
      if (!opt.noClues) { clueNote('n8', XP - 1.45, y0 + .9, z1 + 5.6, f, .1); clueTape('ts_mina', tx - .3, y0 + .78, tz, f); }
      props.push({ kind: 'search', label: '마스터 테이프 보관장 뒤지기', x: XP + 3.35, y: y0 + 1.0, z: z1 + .9, floor: f });
      props.push({ kind: 'search', label: '영상 편집석 서랍 열기', x: X1 + 3.6, y: y0 + .9, z: z2 - 1.25, floor: f });
      props.push({ kind: 'search', label: '스튜디오 소품장 열기', x: X2 - .95, y: y0 + 1.0, z: z1 + 1.0, floor: f });
      // ── 장비실 (조정실 남동쪽, 유리벽 뒤 3.2m × 2.8m): 칸막이벽 · 잠긴 방화 철문(문짝은 게임 쪽에서 · 열쇠로 연다) · 장비 선반 · 카세트 타이머 — 민아가 갇혀 있던 곳
      { const EX = XP - 3.2, EZ = z2 - 2.8, DX1 = XP - 2.9, DX2 = XP - 2.0;
        box('wall', EX - .06, EX + .06, y0, y0 + S.CEIL, EZ, z2, { solid: true });   // 서쪽 벽
        box('wall', EX, DX1, y0, y0 + S.CEIL, EZ - .06, EZ + .06, { solid: true }); box('wall', DX2, XP - .1, y0, y0 + S.CEIL, EZ - .06, EZ + .06, { solid: true }); box('wall', DX1, DX2, y0 + 2.1, y0 + S.CEIL, EZ - .06, EZ + .06);   // 북쪽 벽 + 문 위 상인방
        box('steelG', DX1 - .05, DX1, y0, y0 + 2.12, EZ - .08, EZ + .08); box('steelG', DX2, DX2 + .05, y0, y0 + 2.12, EZ - .08, EZ + .08); box('steelG', DX1 - .05, DX2 + .05, y0 + 2.08, y0 + 2.14, EZ - .08, EZ + .08);   // 문틀
        sign('장비실 · 관계자 외 출입금지', .9, .16, (DX1 + DX2) / 2, y0 + 2.32, EZ - .075, Math.PI, '#20242a', '#e8e8e8', false);
        // 서쪽 벽 스틸 선반 (4단): 카세트 데크 · 예약 타이머 · 테이프 상자 · 케이블 뭉치
        box('steelG', EX + .08, EX + .5, y0, y0 + 2.0, EZ + .3, z2 - .2, { solid: true });
        [.35, .8, 1.25, 1.7].forEach(h => box('alu', EX + .07, EX + .52, y0 + h - .02, y0 + h, EZ + .28, z2 - .18));
        box('rack', EX + .12, EX + .45, y0 + .82, y0 + .95, EZ + .5, EZ + .95); box('ledR', EX + .46, EX + .47, y0 + .9, y0 + .92, EZ + .88, EZ + .91);   // 카세트 데크 (빨간 대기등)
        box('white', EX + .15, EX + .4, y0 + .82, y0 + .98, EZ + 1.1, EZ + 1.32); cyl('rubber', EX + .41, y0 + .9, EZ + 1.21, .06, .015, .06, 16);   // 기계식 예약 타이머
        for (let k = 0; k < 6; k++) box(k % 2 ? 'screen' : 'rubber', EX + .12, EX + .42, y0 + 1.27, y0 + 1.47, EZ + .4 + k * .3, EZ + .62 + k * .3);   // 테이프 상자
        for (let k = 0; k < 3; k++) cyl('rubber', EX + .3, y0 + .37, EZ + .7 + k * .45, .14, .1, .14, 14);   // 케이블 뭉치
        box('rack', XP - .75, XP - .15, y0, y0 + 1.6, z2 - 1.0, z2 - .3, { solid: true }); for (let k = 0; k < 5; k++) box('ledG', XP - .77, XP - .75, y0 + .3 + k * .25, y0 + .32 + k * .25, z2 - .9, z2 - .85);   // 앰프 랙 (축전지 배선)
        props.push({ kind: 'search', label: '장비실 선반 뒤지기', x: EX + .9, y: y0 + 1.0, z: EZ + 1.4, floor: f }); }
      }
    } else if (type === 'broadcast') {   // 방송실: 주조정 콘솔 · 녹음 부스 유리벽 · 장비랙
      cabinetD(x1 + 2.1, x1 + 4.4, z1 + 2.2, z1 + 3.0, y0, .78, 'steelG', 'z+');   // 콘솔 하부장
      { const g = new THREE.BoxGeometry(2.3, .06, .8); g.rotateX(.18); g.translate(x1 + 3.25, y0 + .84, z1 + 2.6); G('rubber', g);   // 경사 믹서 상판
        for (let k = 0; k < 16; k++) { const fx = x1 + 2.25 + k * .13; box('alu', fx - .012, fx + .012, y0 + .87, y0 + .9, z1 + 2.62, z1 + 2.8); box('white', fx - .02, fx + .02, y0 + .89, y0 + .92, z1 + 2.66 + (k * 37 % 9) * .012, z1 + 2.68 + (k * 37 % 9) * .012); cyl('red', fx, y0 + .87, z1 + 2.45, .012, .03); cyl('white', fx, y0 + .86, z1 + 2.33, .012, .03); } }
      for (let k = 0; k < 3; k++) box('rubber', x1 + 2.3 + k * .7, x1 + 2.8 + k * .7, y0 + .95, y0 + 1.35, z1 + 2.9, z1 + 2.95);
      box('wall', x1 + 4.6, x1 + 4.75, y0, y0 + S.CEIL, z1, z2 - 2.4, { solid: true }); box('glass', x1 + 4.6, x1 + 4.75, y0 + .9, y0 + 2.1, z1 + 1, z2 - 3);
      for (let k = 0; k < 3; k++) cabinet(x2 - .7, x2 - .1, z1 + .4 + k * .7, z1 + 1 + k * .7, 2.0, 'rubber');
      chairAt(x1 + 3.2, z1 + 3.6);
      if (!opt.noClues) { clueNote('n8', x1 + 2.8, y0 + .96, z1 + 2.35, f, .1); clueTape('ts_mina', x1 + 3.9, y0 + .96, z1 + 2.3, f); }
      props.push({ kind: 'console', label: '방송 송출 콘솔', x: x1 + 3.2, y: y0 + 1, z: z1 + 2.6, floor: f });
    } else if (type === 'science') {   // 과학실 (참고 평면도 · 가구 규격도, 8.8 × 9.9m): 실험대 6 (1800×1200×850, 검정 상판 · 원목 하부장 · 개수대 · 가스꼭지) 2줄 × 3열 · 스툴 24 · 교사 실험대 (2400×900) · 칠판 · 시약장 (유리문 900×450×2000) · 싱크 실험대 · 안전 샤워대 · 인체 골격 모형 · 지구본 · 주기율표
      darkMats();
      const LX = [x1 + 3.7, x1 + 6.4], LZ = [zm - 2.6, zm, zm + 2.6];
      LX.forEach(x => LZ.forEach(z => {
        cabinetD(x - .9, x + .9, z - .6, z + .6, y0, .82, 'wood', 'z+'); box('rubber', x - .92, x + .92, y0 + .82, y0 + .86, z - .62, z + .62);
        box('alu', x - .2, x + .2, y0 + .861, y0 + .865, z - .18, z + .18); box('rubber', x - .17, x + .17, y0 + .862, y0 + .866, z - .15, z + .15);   // 개수대
        cyl('alu', x, y0 + .86, z, .015, .38); box('alu', x - .01, x + .01, y0 + 1.22, y0 + 1.25, z - .18, z + .01);   // 거위목 수전
        [-.6, .6].forEach(d => { cyl('red', x + d, y0 + .86, z - .45, .015, .06); cyl('red', x + d, y0 + .86, z + .45, .015, .06); });   // 가스꼭지
        for (const s of [-1, 1]) [-.5, .5].forEach(d => stool(x + d, z + s * .9, .6));
      }));
      // 실험 기구 · 현미경 · 분광기 (실험대 위)
      cyl('glass', LX[0] - .5, y0 + .86, LZ[0] + .2, .05, .18, .03); cyl('glass', LX[0] - .35, y0 + .86, LZ[0] + .25, .03, .2); box('rubber', LX[1] + .4, LX[1] + .55, y0 + .86, y0 + .9, LZ[1] - .3, LZ[1] - .1); cyl('rubber', LX[1] + .48, y0 + .9, LZ[1] - .2, .025, .28);
      box('white', LX[1] - .6, LX[1] - .2, y0 + .86, y0 + 1.15, LZ[2] + .15, LZ[2] + .45); cyl('alu', LX[0] + .5, y0 + .86, LZ[2] - .3, .04, .2);
      // 교사 실험대 (2400×900×900) + 칠판 (3600×1200) + 주기율표 · 게시물
      { const tx = x1 + 1.5; cabinetD(tx - .45, tx + .45, zm - 1.2, zm + 1.2, y0, .86, 'white', 'x+'); box('rubber', tx - .47, tx + .47, y0 + .86, y0 + .9, zm - 1.22, zm + 1.22); box('alu', tx - .15, tx + .15, y0 + .901, y0 + .905, zm + .5, zm + .9); cyl('alu', tx - .3, y0 + .9, zm + .7, .015, .35);
        retroPC(tx + .05, y0 + .9, zm - .62, 'x-', { tower: null, kb: false, scale: .85 }); chairX(tx - .7, zm - .3, 1); }
      boardX('board', zm); box('white', x1 + .02, x1 + .03, y0 + 1.25, y0 + 2.05, zm + 2.1, zm + 3.3); box('red', x1 + .03, x1 + .035, y0 + 1.3, y0 + 1.5, zm + 2.2, zm + 3.2); box('white', x1 + .02, x1 + .03, y0 + 1.2, y0 + 2.0, zm - 3.0, zm - 2.2);   // 주기율표 · 안전 수칙
      mdl('wall_clock', x1 + .03, y0 + 2.6, zm + 1.5, Math.PI / 2);
      // 인체 골격 모형 (스탠드) · 지구본 — 칠판 옆
      { const sx = x1 + .5, sz = zm - 2.1; cyl('alu', sx, y0, sz, .2, .03); cyl('alu', sx, y0, sz, .015, 1.75); const g = new THREE.SphereGeometry(.1, 12, 10); g.translate(sx, y0 + 1.62, sz); G('white', g); box('white', sx - .03, sx + .03, y0 + .95, y0 + 1.5, sz - .02, sz + .02); for (let k = 0; k < 6; k++) box('white', sx - .03, sx + .06, y0 + 1.2 + k * .05, y0 + 1.21 + k * .05, sz - .12, sz + .12); box('white', sx - .03, sx + .03, y0 + .1, y0 + .95, sz - .1, sz - .07); box('white', sx - .03, sx + .03, y0 + .1, y0 + .95, sz + .07, sz + .1); col.push({ x1: sx - .2, x2: sx + .2, z1: sz - .2, z2: sz + .2, y1: y0, y2: y0 + 1.8 }); }
      // 동쪽 벽: 시약장 (유리 상부 · 900 × 4) · 창가: 싱크 실험대 (1800×750 × 2) · 안전 샤워대 (700×700×2100)
      for (let k = 0; k < 4; k++) { const a = z1 + 2.0 + k * .9; cabinetD(x2 - .45, x2 - .05, a, a + .9, y0, 2.0, 'wood', 'x-', true); for (let j = 0; j < 3; j++) for (let q = 0; q < 4; q++) cyl(['glass', 'red', 'white'][(q + j + k) % 3], x2 - .25, y0 + 1.0 + j * .32, a + .15 + q * .2, .04, .16); }
      [x1 + 2.0, x1 + 4.0].forEach(sa => { cabinetD(sa, sa + 1.8, z2 - .65, z2 - .05, y0, .82, 'white', 'z-'); box('rubber', sa - .02, sa + 1.82, y0 + .82, y0 + .86, z2 - .67, z2 - .05); box('alu', sa + .7, sa + 1.1, y0 + .861, y0 + .865, z2 - .5, z2 - .2); cyl('alu', sa + .9, y0 + .86, z2 - .15, .015, .35); });
      { const hx = x2 - .4, hz = z2 - .4; box('alu', hx - .35, hx + .35, y0, y0 + .03, hz - .35, hz + .35); cyl('exitG', hx + .25, y0, hz + .25, .03, 2.1); box('exitG', hx - .05, hx + .25, y0 + 2.05, y0 + 2.08, hz + .23, hz + .27); cyl('exitG', hx - .05, y0 + 1.95, hz + .25, .15, .1, .05); col.push({ x1: hx - .1, x2: hx + .35, z1: hz + .1, z2: hz + .35, y1: y0, y2: y0 + 2.1 }); }
      if (!opt.noClues && !opt.noSciLib && !s_sci++) { clueNote('n5', LX[0], y0 + .87, LZ[0] - .3, f, .2); clueNote('q7a', LX[0], y0 + .87, LZ[1] + .3, f, -.3); clueTape('ts_electric', LX[1], y0 + .87, LZ[0] + .3, f); }
      props.push({ kind: 'search', label: '과학실 약품장', x: x2 - .8, y: y0 + 1.2, z: z1 + 3.4, floor: f });
    } else if (type === 'music') {   // 음악실 (참고 배치도 · 가구 규격도, 8.8 × 9.9m): 2인 1조 책상 12조 24석 (오선 칠판 쪽을 본다) · 지휘자 단상 · 업라이트 피아노 · 오선 화이트보드 · 교사 책상 · 접이식 의자 적재대 · 우측 악기장 · 타악기 · 창가 수납장 · 스피커
      darkMats(); const { plane, ctex } = artHelpers();
      box('dkwood', x1, x2, y0 + .02, y0 + .03, z1, z2);
      // 학생 책상 (700×500×720) 2개 1조 + 학생 의자 (400×490×780) + 책상 위 악보대 — 서쪽(칠판)을 본다
      const sdesk = (cx, cz) => { box('deskTop', cx - .25, cx + .25, y0 + .69, y0 + .72, cz - .35, cz + .35); box('steelG', cx - .22, cx + .22, y0 + .55, y0 + .6, cz - .32, cz + .32); [[-.22, -.32], [.22, -.32], [-.22, .32], [.22, .32]].forEach(([a, b]) => box('deskLeg', cx + a - .015, cx + a + .015, y0, y0 + .69, cz + b - .015, cz + b + .015));
        { const st = new THREE.BoxGeometry(.012, .26, .4); st.rotateZ(-.42); st.translate(cx - .1, y0 + .84, cz); G('rubber', st);   // 책상 위 접이식 악보대: 학생 쪽으로 기운 받침판 + 악보 + 아래 턱
          const sh = new THREE.BoxGeometry(.004, .22, .3); sh.rotateZ(-.42); sh.translate(cx - .09, y0 + .845, cz); G('white', sh); box('rubber', cx - .07, cx - .02, y0 + .72, y0 + .74, cz - .2, cz + .2); }
        const ch = cx + .55; box('wood', ch - .2, ch + .2, y0 + .43, y0 + .46, cz - .2, cz + .2); box('wood', ch + .17, ch + .2, y0 + .5, y0 + .78, cz - .19, cz + .19); [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]].forEach(([a, b]) => box('deskLeg', ch + a - .012, ch + a + .012, y0, y0 + (a > 0 ? .78 : .43), cz + b - .012, cz + b + .012)); };
      const RX = [x1 + 3.1, x1 + 4.45, x1 + 5.8, x1 + 7.15], GZ = [z1 + 2.45, z1 + 4.95, z1 + 7.45];
      RX.forEach(x => GZ.forEach(z => { sdesk(x, z - .35); sdesk(x, z + .35); col.push({ x1: x - .25, x2: x + .25, z1: z - .7, z2: z + .7, y1: y0, y2: y0 + .72 }); }));
      // 서쪽 벽: 오선 화이트보드 (3600×1200) · 태극기 · 벽시계 · 교훈 액자 · 게시판 (1200×900) · 스피커
      { const wz = z1 + 5.2; box('alu', x1 + .01, x1 + .06, y0 + .95, y0 + 2.15, wz - 1.8, wz + 1.8); const wb = ctex(720, 240, (g, w, h) => { g.fillStyle = '#f8f8f4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#4a4a60'; g.lineWidth = 1.5; for (let st = 0; st < 3; st++) for (let l = 0; l < 5; l++) { const y = 30 + st * 72 + l * 9; g.beginPath(); g.moveTo(20, y); g.lineTo(w - 20, y); g.stroke(); } g.fillStyle = '#20204a'; g.font = '30px serif'; for (let n = 0; n < 26; n++) g.fillText('♪', 70 + n * 24, 52 + (n % 3) * 72 - (n * 7 % 5) * 4); });
        plane(wb, 3.56, 1.16, x1 + .065, y0 + 1.55, wz, Math.PI / 2); box('alu', x1 + .06, x1 + .14, y0 + .93, y0 + .96, wz - 1.6, wz + 1.6);
        const tg = ctex(150, 100, (g, w, h) => { g.fillStyle = '#fbfbf6'; g.fillRect(0, 0, w, h); g.fillStyle = '#c8102e'; g.beginPath(); g.arc(75, 50, 22, Math.PI, 0); g.fill(); g.fillStyle = '#003478'; g.beginPath(); g.arc(75, 50, 22, 0, Math.PI); g.fill(); g.strokeStyle = '#3a2416'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); }); plane(tg, .55, .37, x1 + .03, y0 + 2.6, wz, Math.PI / 2);
        mdl('wall_clock', x1 + .03, y0 + 2.6, wz - 1.1, Math.PI / 2);
        const mt = (t, z) => { const tx = ctex(160, 100, (g, w, h) => { g.fillStyle = '#f2ead8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a2416'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = '#1a1410'; g.font = 'bold 44px serif'; g.textAlign = 'center'; g.fillText(t, 80, 66); }); plane(tx, .55, .34, x1 + .03, y0 + 2.6, z, Math.PI / 2); }; mt('성실', wz + 1.2); mt('창의', wz - 2.0);
        corkBoardZ(x1 + .02, 1, z1 + 1.9, z1 + 3.1, y0 + 1.2, y0 + 2.1); corkBoardZ(x1 + .02, 1, wz + 1.95, wz + 2.6, y0 + 1.2, y0 + 2.1);
        [[x1 + .15, z2 - .25], [x2 - .15, z2 - .25]].forEach(([x, z]) => box('rubber', x - .12, x + .12, y0 + 2.35, y0 + 2.69, z - .1, z + .1)); }   // 벽걸이 스피커
      // 업라이트 피아노 (1500×620×1210) — 서쪽 벽 창가 쪽 · 지휘자 단상 (600×900) + 보면대
      upright(x1 + .4, z2 - 1.6, y0, 1);
      { const px = x1 + 1.9, pz = z1 + 5.2; box('rubber', px - .3, px + .3, y0, y0 + .15, pz - .45, pz + .45, { solid: true }); walk.push({ x1: px - .3, x2: px + .3, z1: pz - .45, z2: pz + .45, h: () => y0 + .15, f });
        cyl('rubber', px, y0 + .15, pz, .02, .95); box('rubber', px - .02, px + .02, y0 + 1.05, y0 + 1.4, pz - .25, pz + .25); }
      // 교사 책상 (1800×800×720) + 교사 의자 · 접이식 의자 적재대 (1200×700×1350)
      desk(x1 + 1.1, z1 + 2.5, .8, 1.8, .72, 'deskTop'); officeChair(x1 + .45, z1 + 2.5, y0, 0); box('screen', x1 + 1.0, x1 + 1.3, y0 + .72, y0 + .74, z1 + 2.0, z1 + 2.3);
      { const rx = x1 + .45, rz = z1 + 1.15; box('alu', rx - .35, rx + .35, y0 + .05, y0 + .08, rz - .55, rz + .55); for (let k = 0; k < 10; k++) box('rubber', rx - .3, rx + .3, y0 + .1, y0 + 1.25, rz - .5 + k * .1, rz - .47 + k * .1); col.push({ x1: rx - .35, x2: rx + .35, z1: rz - .6, z2: rz + .6, y1: y0, y2: y0 + 1.35 }); }
      // 동쪽 벽: 우측 악기장 (900칸 × 6 · 2100) · 타악기 보관 (드럼 · 팀파니)
      for (let k = 0; k < 6; k++) { const a = z1 + 1.4 + k * .9; cabinetD(x2 - .5, x2 - .05, a, a + .9, y0, .9, 'wood', 'x-'); box('wood', x2 - .5, x2 - .05, y0 + .9, y0 + 2.1, a, a + .9, { solid: true }); box('glass', x2 - .51, x2 - .5, y0 + .95, y0 + 2.05, a + .05, a + .85);
        for (let j = 0; j < 2; j++) box(['rubber', 'lockerM', 'cork'][(k + j) % 3], x2 - .42, x2 - .12, y0 + 1.0 + j * .5, y0 + 1.4 + j * .5, a + .15, a + .75); }
      for (let k = 0; k < 3; k++) { const z = z2 - .6 - k * .62; cyl('white', x2 - .4, y0 + k * 0, z, .28, .4, .28, 16); cyl('rubber', x2 - .4, y0 + .4, z, .29, .03, .29, 16); }   // 타악기 (드럼)
      cyl('alu', x2 - .4, y0 + .4, z2 - .6, .3, .45, .3, 16);
      // 창가 수납장 (7800×400×900): 악기 케이스 · 악보 · 서류함
      cabinetD(x1 + .9, x2 - 1.0, z2 - .45, z2 - .05, y0, .9, 'wood', 'z-');
      for (let k = 0; k < 12; k++) { const x = x1 + 1.2 + k * .58; if (k % 3 === 1) box('rubber', x - .12, x + .12, y0 + .9, y0 + 1.75, z2 - .35, z2 - .15); else for (let b = 0; b < 5; b++) box(['white', 'cork', 'lockerM'][b % 3], x - .2 + b * .08, x - .14 + b * .08, y0 + .9, y0 + 1.2, z2 - .38, z2 - .12); }
      mdl('potted_plant_04', x1 + .5, y0, z2 - .45, 0, { s: 3.0 });
      box('white', xm - .2, xm + .2, y0 + S.CEIL - .3, y0 + S.CEIL - .16, zm - .15, zm + .15); cyl('alu', xm, y0 + S.CEIL - .16, zm, .02, .16);   // 빔 프로젝터
      if (!opt.noClues) { clueNote('n18', x1 + 1.1, y0 + .74, z1 + 2.9, f, 0); clueTape('ts_music', x2 - .3, y0 + 2.1, z1 + 4.0, f); }
      props.push({ kind: 'piano', label: '음악실 피아노 건반 누르기', x: x1 + 1.0, y: y0 + 1, z: z2 - 1.6, floor: f });
    } else if (type === 'art') {   // 미술실 (참고 배치도 · 가구 규격도, 8.8 × 9.9m): 작업대 4조 (1800×1200) · 스툴 24 · 화이트보드 · 교사 책상 · 이젤 보관 · 미술 재료장 · 석고상 진열대 · 건조대 · 3구 개수대 · 접이식 의자 적재대
      darkMats(); const { plane, ctex } = artHelpers();
      box('dkwood', x1, x2, y0 + .02, y0 + .03, z1, z2);
      // 작업대 (1800×1200×750, 원목 상판 · 철제 프레임) 2×2 — 긴 변이 칠판과 수직, 스툴 (Ø330 · H450) 양옆 3개씩
      const TX = [xm - 1.5, xm + 1.5], TZ = [zm - 1.7, zm + 1.7];
      const paint = ctex(256, 384, (g, w, h) => { g.fillStyle = '#b08a5a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(90,60,30,${.15 + Math.random() * .2})`; g.beginPath(); g.moveTo(0, Math.random() * h); g.lineTo(w, Math.random() * h); g.stroke(); } const cs = ['#c8102e', '#1e5aa8', '#e8c020', '#2a8a3a', '#f0f0f0', '#7a3aa0']; for (let i = 0; i < 26; i++) { g.fillStyle = cs[i % cs.length]; g.globalAlpha = .55; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 7, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1; });
      TX.forEach((cx, i) => TZ.forEach((cz, j) => {
        box('steelG', cx - .55, cx + .55, y0 + .66, y0 + .71, cz - .85, cz + .85); [[-.55, -.85], [.55, -.85], [-.55, .85], [.55, .85]].forEach(([a, b]) => box('steelG', cx + a - (a > 0 ? .04 : 0), cx + a + (a < 0 ? .04 : 0), y0, y0 + .71, cz + b - (b > 0 ? .04 : 0), cz + b + (b < 0 ? .04 : 0)));
        box('steelG', cx - .5, cx + .5, y0 + .12, y0 + .15, cz - .02, cz + .02);
        box('wood', cx - .6, cx + .6, y0 + .71, y0 + .75, cz - .9, cz + .9); const p = plane(paint, 1.2, 1.8, cx, y0 + .752, cz, 0); p.rotation.x = -Math.PI / 2;
        col.push({ x1: cx - .6, x2: cx + .6, z1: cz - .9, z2: cz + .9, y1: y0, y2: y0 + .75 });
        for (const s of [-1, 1]) for (let k = -1; k <= 1; k++) { const sx = cx + s * .95, sz = cz + k * .58; cyl('wood', sx, y0 + .42, sz, .165, .035, .165, 14); [[-.1, -.1], [.1, -.1], [-.1, .1], [.1, .1]].forEach(([a, b]) => box('deskLeg', sx + a - .012, sx + a + .012, y0, y0 + .42, sz + b - .012, sz + b + .012)); box('deskLeg', sx - .11, sx + .11, y0 + .15, y0 + .17, sz - .01, sz + .01); }
        // 상판 소품: 연필꽂이 · 팔레트 · 스케치북 · 물통
        cyl('rubber', cx - .35, y0 + .75, cz - .55, .04, .11); for (let k = 0; k < 4; k++) box(['deskTop', 'cork', 'lockerM', 'white'][k], cx - .37 + k * .012, cx - .36 + k * .012, y0 + .8, y0 + .95, cz - .56, cz - .55);
        box('white', cx + .1, cx + .4, y0 + .75, y0 + .76, cz + .2, cz + .45); [[.15, .25, 'rubber'], [.3, .3, 'cork'], [.22, .4, 'lockerM']].forEach(([a, b, k]) => box(k, cx + a - .025, cx + a + .025, y0 + .76, y0 + .765, cz + b - .025, cz + b + .025));
        box((i + j) % 2 ? 'cork' : 'white', cx - .3, cx + .05, y0 + .75, y0 + .765, cz + .5, cz + .75); cyl('glass', cx + .35, y0 + .75, cz - .3, .05, .1);
      }));
      // 서쪽 벽: 화이트보드 (3600×1200, 그림) · 게시판 (1200×900) · 태극기 · 벽시계 (Ø300)
      { const wz = zm + .3; box('alu', x1 + .01, x1 + .06, y0 + .95, y0 + 2.15, wz - 1.8, wz + 1.8);
        const wb = ctex(720, 240, (g, w, h) => { g.fillStyle = '#f8f8f4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#333'; g.lineWidth = 3; g.beginPath(); g.ellipse(150, 120, 60, 80, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(150, 40); g.lineTo(150, 200); g.moveTo(90, 120); g.lineTo(210, 120); g.stroke(); g.strokeStyle = '#1e5aa8'; g.beginPath(); g.moveTo(300, 190); g.lineTo(380, 60); g.lineTo(460, 190); g.closePath(); g.stroke(); g.strokeStyle = '#c8102e'; g.strokeRect(500, 70, 150, 110); g.fillStyle = '#222'; g.font = 'bold 26px sans-serif'; g.fillText('소묘 — 구도와 명암', 260, 34); g.font = '20px sans-serif'; g.fillText('빛 → 밝은 면 · 중간 · 어두운 면 · 그림자', 270, 225); });
        plane(wb, 3.56, 1.16, x1 + .065, y0 + 1.55, wz, Math.PI / 2); box('alu', x1 + .06, x1 + .14, y0 + .93, y0 + .96, wz - 1.6, wz + 1.6);
        const tg = ctex(150, 100, (g, w, h) => { g.fillStyle = '#fbfbf6'; g.fillRect(0, 0, w, h); g.fillStyle = '#c8102e'; g.beginPath(); g.arc(75, 50, 22, Math.PI, 0); g.fill(); g.fillStyle = '#003478'; g.beginPath(); g.arc(75, 50, 22, 0, Math.PI); g.fill(); g.strokeStyle = '#3a2416'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); });
        plane(tg, .6, .4, x1 + .03, y0 + 2.5, wz, Math.PI / 2); mdl('wall_clock', x1 + .03, y0 + 2.6, wz + 1.2, Math.PI / 2);
        corkBoardZ(x1 + .02, 1, wz + 1.95, wz + 3.0, y0 + 1.2, y0 + 2.1); }
      // 교사 책상 (1400×700×740, 다크 그레이 + 원목 상판, 서랍 3) + 검정 사무용 의자 + 스탠드
      { const dx = x1 + 1.0, dz = z1 + 2.2; box('rubber', dx - .35, dx + .35, y0, y0 + .7, dz - .7, dz - .28, { solid: true }); box('rubber', dx - .35, dx + .35, y0, y0 + .7, dz + .62, dz + .7, { solid: true }); box('wood', dx - .35, dx + .35, y0 + .7, y0 + .74, dz - .7, dz + .7);
        for (let k = 0; k < 3; k++) box('alu', dx + .35, dx + .36, y0 + .14 + k * .2, y0 + .16 + k * .2, dz - .55, dz - .43);
        col.push({ x1: dx - .35, x2: dx + .35, z1: dz - .7, z2: dz + .7, y1: y0, y2: y0 + .74 }); officeChair(x1 + .35, dz, y0, 0);
        cyl('rubber', dx - .1, y0 + .74, dz + .45, .07, .02); box('rubber', dx - .11, dx - .09, y0 + .76, y0 + 1.1, dz + .44, dz + .46); box('rubber', dx - .11, dx + .1, y0 + 1.08, y0 + 1.12, dz + .4, dz + .5);
        box('white', dx - .15, dx + .1, y0 + .74, y0 + .76, dz - .3, dz); }
      // 서쪽 창가: 이젤 보관 (600×1600 × 5, 접어 세움) · 미술 재료장 (1200×400×1800, 상부 유리)
      [[z2 - .5, Math.PI / 2 - .25], [z2 - 1.0, Math.PI / 2 + .2]].forEach(([z, ry]) => mdl('h133/ART-001', x1 + .4, y0, z, ry, { s: .9 }));   // 실사 이젤 2 (예전: 납작한 판 5)
      col.push({ x1: x1, x2: x1 + .7, z1: z2 - 1.25, z2: z2 - .1, y1: y0, y2: y0 + 1.6 });
      cabinetD(x1 + .05, x1 + .45, z2 - 2.55, z2 - 1.35, y0, 1.8, 'wood', 'x+', true);
      // 창가: 낮은 오픈 선반 (4800×400×360) — 석고상 · 책 · 석고상 진열대 (1800×400×1000)
      { const sa = x1 + 1.0, sb = sa + 4.8; box('wood', sa, sb, y0, y0 + .36, z2 - .45, z2 - .05, { solid: true }); box('rubber', sa + .02, sb - .02, y0 + .04, y0 + .32, z2 - .44, z2 - .43);
        for (let k = 0; k < 8; k++) { const x = sa + .3 + k * .6; if (k % 2) for (let b = 0; b < 6; b++) box(['white', 'cork', 'lockerM'][b % 3], x - .2 + b * .065, x - .15 + b * .065, y0 + .36, y0 + .6, z2 - .38, z2 - .18); else mdl('h133/ART-004', x, y0 + .36 - .08 * .45, z2 - .25, Math.PI + (k - 3) * .15, { s: .45 }); }   // 실사 석고상 (예전: 원기둥 + 구)
        const da = sb + .2, db = da + 1.8; box('wood', da, db, y0, y0 + 1.0, z2 - .45, z2 - .05, { solid: true }); box('glass', da + .02, db - .02, y0 + .1, y0 + .95, z2 - .46, z2 - .45);
        for (let k = 0; k < 3; k++) mdl('h133/ART-004', da + .3 + k * .6, y0 + 1.0 - .08 * .62, z2 - .25, Math.PI + (k - 1) * .3, { s: .62 }); }
      // 동쪽 창가: 건조대 (680×500×1500, 스틸) · 미술 재료장
      { const ra = x2 - .55, rz = z2 - .45; [[-.0, -.34], [.5, -.34], [0, .34], [.5, .34]].forEach(([a, b]) => box('alu', ra + a, ra + a + .02, y0, y0 + 1.5, rz + b - .01, rz + b + .01)); for (let k = 0; k < 10; k++) { box('alu', ra, ra + .52, y0 + .1 + k * .14, y0 + .11 + k * .14, rz - .34, rz + .34); if (k % 3 === 1) box('white', ra + .03, ra + .5, y0 + .115 + k * .14, y0 + .12 + k * .14, rz - .3, rz + .3); }
        col.push({ x1: ra, x2: x2, z1: rz - .36, z2: rz + .36, y1: y0, y2: y0 + 1.5 }); }
      cabinetD(x2 - .45, x2 - .05, z2 - 2.1, z2 - 1.0, y0, 1.8, 'wood', 'x-', true);
      // 동쪽 벽: 3구 개수대 (3600×600×850, 스테인리스 상판 · 회색 하부장 · 수전 3) + 게시판
      { const sa = zm - 2.2, sb = sa + 3.6; cabinetD(x2 - .6, x2 - .05, sa, sb, y0, .82, 'lockerM', 'x-'); box('alu', x2 - .62, x2 - .03, y0 + .82, y0 + .85, sa, sb);
        for (let k = 0; k < 3; k++) { const z = sa + .6 + k * 1.2; box('rubber', x2 - .5, x2 - .15, y0 + .851, y0 + .855, z - .25, z + .25); cyl('alu', x2 - .1, y0 + .85, z, .02, .3); box('alu', x2 - .32, x2 - .1, y0 + 1.13, y0 + 1.16, z - .015, z + .015); }
        box('porc', x2 - .02, x2, y0 + .85, y0 + 1.4, sa, sb); corkBoardZ(x2 - .02, -1, sa + .6, sa + 3.0, y0 + 1.6, y0 + 2.3); }
      // 접이식 의자 적재대 (900×600×1500) — 복도 쪽 동쪽
      { const rx = x2 - .35, rz = z1 + 2.3; box('alu', rx - .3, rx + .3, y0 + .05, y0 + .08, rz - .45, rz + .45); for (let k = 0; k < 8; k++) box('rubber', rx - .27, rx + .27, y0 + .1, y0 + 1.2, rz - .4 + k * .1, rz - .37 + k * .1); col.push({ x1: rx - .3, x2: rx + .3, z1: rz - .45, z2: rz + .45, y1: y0, y2: y0 + 1.5 }); }
      if (!opt.noClues) clueTape('ts_art', TX[0], y0 + .76, TZ[0] - .3, f);
      props.push({ kind: 'search', label: '미술실 이젤 뒤 살펴보기', x: x1 + .9, y: y0 + 1, z: z2 - .8, floor: f });
    } else if (type === 'computer') {   // 컴퓨터실 (참고 평면도 · 가구 규격도, 8.8 × 9.9m): 1인 PC 책상 (1000×700×720) 4줄 × 4석 (2+2, 중앙 통로) · 17인치 4:3 모니터 · PC 본체 · 학생 의자 · 교사 책상 (1600×700) · 화이트보드 (3600×1200) · 스크린 · 프로젝터 · 게시판 · 벽시계 · 서가 · 화분 · 천장형 냉난방기
      darkMats();
      const row = [x1 + 2.5, x1 + 3.85, x1 + 5.2, x1 + 6.55], seat = [zm - 2.05, zm - 1.05, zm + 1.05, zm + 2.05];
      row.forEach((x, ri) => seat.forEach(z => {
        box('wood', x - .35, x + .35, y0 + .68, y0 + .72, z - .5, z + .5); box('rubber', x - .34, x + .34, y0, y0 + .68, z - .5, z - .47); box('rubber', x - .34, x + .34, y0, y0 + .68, z + .47, z + .5); box('rubber', x - .35, x - .32, y0 + .2, y0 + .68, z - .47, z + .47);
        col.push({ x1: x - .35, x2: x + .35, z1: z - .5, z2: z + .5, y1: y0, y2: y0 + .72 });
        retroPC(x - .1, y0 + .72, z - .02, 'x+', { tower: 'floor', lcd: true });   // 2008 교체: 검은 19" LCD (예전 베이지 CRT) + 책상 밑 미니타워 + 키보드 · 마우스 (화면은 학생 쪽 +x)
        chairX(x + .65, z, -1); }));
      // 교사 책상 (1600×700×750) + 의자 · 화이트보드 · 전동 스크린 · 천장 프로젝터
      { const tx = x1 + 1.2, tz = zm; box('dkwood', tx - .35, tx + .35, y0 + .71, y0 + .75, tz - .8, tz + .8); box('rubber', tx - .33, tx + .33, y0, y0 + .71, tz - .78, tz - .4, { solid: true }); box('rubber', tx - .33, tx + .33, y0, y0 + .71, tz + .4, tz + .78, { solid: true }); box('rubber', tx - .35, tx - .32, y0 + .2, y0 + .71, tz - .4, tz + .4);
        col.push({ x1: tx - .35, x2: tx + .35, z1: tz - .8, z2: tz + .8, y1: y0, y2: y0 + .75 }); chairX(tx - .62, tz, 1);
        box('rubber', tx - .1, tx - .05, y0 + .75, y0 + 1.1, tz - .2, tz + .2); box('screen', tx - .05, tx - .045, y0 + .78, y0 + 1.08, tz - .18, tz + .18); box('rubber', tx + .1, tx + .3, y0 + .75, y0 + 1.1, tz + .45, tz + .65); }
      boardX('white', zm); box('white', x1 + .25, x1 + .3, y0 + 1.1, y0 + 2.9, zm - 1.2, zm + 1.2); box('rubber', x1 + .2, x1 + .32, y0 + 2.9, y0 + 3.0, zm - 1.3, zm + 1.3);   // 스크린 (내려 둔 상태)
      box('white', x1 + 2.8, x1 + 3.16, y0 + S.CEIL - .32, y0 + S.CEIL - .2, zm - .15, zm + .15); cyl('alu', x1 + 2.98, y0 + S.CEIL - .2, zm, .02, .2);
      corkBoardZ(x1 + .02, 1, zm + 2.1, zm + 3.3, y0 + 1.2, y0 + 2.1); corkBoardZ(x1 + .02, 1, zm - 3.3, zm - 2.1, y0 + 1.2, y0 + 2.1); mdl('wall_clock', x1 + .03, y0 + 2.65, zm + 2.7, Math.PI / 2);
      // 동쪽 벽: 서가 · 수납장 (복도 문 동선 밖) · 화분 · 냉난방기
      cabinetD(x2 - .45, x2 - .05, z2 - 3.0, z2 - 1.2, y0, 1.9, 'wood', 'x-', true); cabinetD(x2 - .45, x2 - .05, z1 + 2.0, z1 + 3.4, y0, .9, 'wood', 'x-');
      [[x1 + .45, z2 - .45], [x2 - .45, z2 - .45], [x1 + .45, z1 + 1.9]].forEach(([x, z]) => mdl('potted_plant_04', x, y0, z, 0, { s: 3.0 }));
      { const ax = x1 + 5, az = zm; box('white', ax - .42, ax + .42, y0 + S.CEIL - .06, y0 + S.CEIL - .01, az - .42, az + .42); box('rubber', ax - .3, ax + .3, y0 + S.CEIL - .065, y0 + S.CEIL - .06, az - .3, az + .3); }
      props.push({ kind: 'search', label: '교사용 PC 켜 보기', x: x1 + 1.2, y: y0 + 1, z: zm, floor: f });
    } else if (type === 'study') {   // 자율학습실 (참고 자료 · 8.8 × 9.9m): 1인 칸막이 학습 책상 28석 (4열 × 7줄, 창 쪽을 본다) · 측면 통로 1.0 / 중앙 통로 1.2 · 교사 데스크 · 화이트보드 · 게시판 · 서가 · 블라인드 · 천장형 냉난방기
      darkMats(); const { plane, ctex } = artHelpers();
      mat.studyG = mat.studyG || M('studyG', () => new THREE.MeshStandardMaterial({ color: 0x24423a, roughness: .55, metalness: .2 }));
      mat.ledS = mat.ledS || M('ledS', () => new THREE.MeshStandardMaterial({ color: 0xf4f8f0, emissive: 0xe8f2e4, emissiveIntensity: 1.0 }));
      box('dkwood', x1, x2, y0 + .02, y0 + .03, z1, z2);
      box('wain', x1 + .005, x1 + .02, y0, y0 + 1.0, z1 + .1, z2 - .1); box('wain', x2 - .02, x2 - .005, y0, y0 + 1.0, z1 + .1, z2 - .1);   // 녹색 징두리
      // 1인 학습 책상 (W1000 D600 H1200): 상판 · 좌우 · 뒤 칸막이 · 윗 선반 밑 내장 형광등 스탠드 (FL 직관 · 2008 독서실 책상) · 이동 서랍장 (W400 D600 H600) · 학습 의자
      const carrel = (cx, cz) => { const a = cx - .5, b = cx + .5, f2 = cz - .3, bk = cz + .3;   // 앉는 쪽 = 복도 쪽(-z) · 칸막이 뒤판 = 창 쪽(+z): 창을 보고 앉는다
        box('dkwood', a, b, y0 + .72, y0 + .75, f2, bk); box('dkwood', a, a + .025, y0, y0 + 1.2, f2, bk); box('dkwood', b - .025, b, y0, y0 + 1.2, f2, bk); box('dkwood', a, b, y0 + .75, y0 + 1.2, bk - .025, bk);
        box('dkwood', a + .03, b - .03, y0 + 1.0, y0 + 1.02, bk - .26, bk - .025); box('ledS', a + .1, b - .1, y0 + .985, y0 + 1.0, bk - .16, bk - .12);   // 윗 선반 · 선반 밑 형광등
        box('studyG', b - .45, b - .04, y0, y0 + .6, f2 + .05, bk - .05, { solid: true }); for (let k = 0; k < 3; k++) box('alu', b - .3, b - .19, y0 + .14 + k * .19, y0 + .16 + k * .19, f2 + .04, f2 + .05);   // 이동 서랍장
        for (let k = 0; k < 4; k++) box(['white', 'red', 'cork', 'lockerM'][(k + Math.round(cx * 3 + cz)) & 3], a + .08 + k * .05, a + .12 + k * .05, y0 + 1.02, y0 + 1.22, bk - .22, bk - .05);   // 선반 위 책
        col.push({ x1: a, x2: b, z1: f2, z2: bk, y1: y0, y2: y0 + 1.2 });
        officeChair(cx - .12, f2 - .38, y0, -1); };   // 창 쪽을 보고 앉는다 (등받이 복도 쪽)
      const pitch = 1.02, zr0 = z2 - .75, xs = [x1 + 1.0 + .5, x1 + 1.0 + 1.0 + 1.2 + .5, x1 + 1.0 + 1.0 + 1.2 + 1.5, x1 + 1.0 + 1.0 + 1.2 + 2.0 + 1.2 + .5];
      const off = ((x2 - x1) - (xs[3] + .5 + 1.0 - x1)) / 2; for (let j = 0; j < 7; j++) xs.forEach(x => carrel(x + off, zr0 - j * pitch));
      // 교사 데스크 (W1600 D700 H750) · 화이트보드 (W2400 H1200) · 게시판 2 (W1200 H900) · 낮은 수납장 · 벽시계 — 복도 쪽 벽
      { const tz = z1 + 1.15; box('dkwood', xm - .8, xm + .8, y0 + .71, y0 + .75, tz - .35, tz + .35); box('studyG', xm - .78, xm - .38, y0, y0 + .71, tz - .33, tz + .33); box('studyG', xm + .38, xm + .78, y0, y0 + .71, tz - .33, tz + .33); box('studyG', xm - .38, xm + .38, y0 + .2, y0 + .71, tz + .31, tz + .34);
        col.push({ x1: xm - .8, x2: xm + .8, z1: tz - .35, z2: tz + .35, y1: y0, y2: y0 + .75 }); officeChair(xm, tz - .65, y0, -1); retroPC(xm + .45, y0 + .75, tz - .02, 'z-', { tower: 'floor', scale: .9 }); box('white', xm - .5, xm - .2, y0 + .75, y0 + .78, tz - .1, tz + .15); }
      box('alu', xm - 1.22, xm + 1.22, y0 + .98, y0 + 2.22, z1 + .005, z1 + .03); box('white', xm - 1.18, xm + 1.18, y0 + 1.02, y0 + 2.18, z1 + .03, z1 + .035);
      [xm - 2.6, xm + 2.6].forEach(x => { if (x - .6 < x1 + 1.8 || x + .6 > x2 - 1.8) return; corkBoard(x - .6, x + .6, y0 + 1.25, y0 + 2.15, z1 + .02, 1); box('dkwood', x - .6, x + .6, y0, y0 + .8, z1 + .03, z1 + .45, { solid: true }); });
      mdl('wall_clock', xm, y0 + 2.55, z1 + .03, 0);
      // 서가 (W800 D400 H2000 × 4) — 동쪽 벽 가운데 · 서쪽 벽은 화분 · 게시물
      for (let k = 0; k < 4; k++) { const zc = (z1 + z2) / 2 - 1.6 + k * .8 + .4; box('dkwood', x2 - .42, x2 - .02, y0, y0 + 2.0, zc - .4, zc + .4, { solid: true }); for (let j = 0; j < 5; j++) { const yy = y0 + .1 + j * .38; box('dkwood', x2 - .42, x2 - .03, yy, yy + .02, zc - .38, zc + .38); for (let q = 0; q < 12; q++) if ((q + j + k) % 5) box(['white', 'red', 'cork', 'lockerM', 'screen'][(q * 3 + j) % 5], x2 - .38, x2 - .1, yy + .02, yy + .3 - (q % 3) * .03, zc - .36 + q * .06, zc - .31 + q * .06); } }
      [[x1 + .45, z1 + 1.9], [x1 + .45, z2 - .5], [x2 - .45, z2 - .5], [x2 - .45, z1 + 1.9], [x1 + 1.6, z1 + .45]].forEach(([x, z]) => mdl('potted_plant_04', x, y0, z, 0, { s: 3.2 }));
      // 블라인드 (창 전체, 반쯤 내림) · 천장형 4방향 냉난방기
      for (let k = 0; k < 18; k++) box('white', x1 + .4, x2 - .4, y0 + 2.42 - k * .05, y0 + 2.43 - k * .05, z2 - .16, z2 - .1);
      box('alu', x1 + .4, x2 - .4, y0 + 2.45, y0 + 2.52, z2 - .18, z2 - .08);
      { const ax = xm, az = (z1 + z2) / 2 + .6; box('white', ax - .42, ax + .42, y0 + S.CEIL - .06, y0 + S.CEIL - .01, az - .42, az + .42); box('rubber', ax - .3, ax + .3, y0 + S.CEIL - .065, y0 + S.CEIL - .06, az - .3, az + .3); [[0, -.36], [0, .36], [-.36, 0], [.36, 0]].forEach(([dx, dz]) => box('screen', ax + dx - (dz ? .28 : .04), ax + dx + (dz ? .28 : .04), y0 + S.CEIL - .066, y0 + S.CEIL - .062, az + dz - (dz ? .04 : .28), az + dz + (dz ? .04 : .28))); }
      props.push({ kind: 'search', label: '자율학습실 서가 살펴보기', x: x2 - .9, y: y0 + 1, z: (z1 + z2) / 2, floor: f });
      props.push({ kind: 'search', label: '교사 데스크 서랍 열기', x: xm, y: y0 + .9, z: z1 + 1.9, floor: f });
    } else if (type === 'home') {   // 가정실 (참고 평면도 · 가구 규격도, 8.8 × 9.9m): 조리 실습대 6 (1800×900×850, 가스레인지 4구 + 싱크) 2줄 × 3열 · 원형 스툴 · 환기 후드 · 교사 시연대 (2400×900) · 화이트보드 · TV · 냉장고 2 · 전자레인지 · 식기 수납장 · 창가 싱크대
      const CX = [x1 + 3.6, x1 + 6.2], CZ = [zm - 2.6, zm, zm + 2.6];
      const stove = (x, z) => { box('rubber', x - .3, x + .3, y0 + .85, y0 + .9, z - .26, z + .26); [[-.14, -.12], [.14, -.12], [-.14, .12], [.14, .12]].forEach(([a, b]) => cyl('alu', x + a, y0 + .9, z + b, .07, .012, .07, 12)); box('alu', x + .3, x + .31, y0 + .78, y0 + .82, z - .2, z + .2); };
      CX.forEach(x => CZ.forEach(z => {
        cabinetD(x - .9, x + .9, z - .45, z + .45, y0, .82, 'porc', 'z+'); box('porc', x - .92, x + .92, y0 + .82, y0 + .85, z - .47, z + .47);
        stove(x - .45, z); box('alu', x + .2, x + .7, y0 + .851, y0 + .855, z - .25, z + .25); box('rubber', x + .23, x + .67, y0 + .852, y0 + .856, z - .22, z + .22); cyl('alu', x + .45, y0 + .85, z + .35, .015, .3);
        col.push({ x1: x - .9, x2: x + .9, z1: z - .47, z2: z + .47, y1: y0, y2: y0 + .85 });
        { const hx = x - .45, hy = y0 + S.CEIL;   // 환기 후드 (900×700): 아래 넓은 갓 → 위로 좁아지는 몸통 → 천장 덕트, 헤어라인 스테인리스
          box('hood', hx - .45, hx + .45, hy - .78, hy - .72, z - .35, z + .35); const tp = new THREE.CylinderGeometry(.2, .55, .22, 4, 1); tp.rotateY(Math.PI / 4); tp.scale(1, 1, .78); tp.translate(hx, hy - .61, z); G('hood', tp);
          box('hood', hx - .14, hx + .14, hy - .5, hy, z - .12, z + .12); box('rubber', hx - .4, hx + .4, hy - .785, hy - .78, z - .3, z + .3); }
        for (const s of [-1, 1]) [-.55, .55].forEach(d => stool(x + d, z + s * .75, .55, 'cork'));
      }));
      // 교사 시연대 (2400×900×850) · 화이트보드 · TV · 벽시계
      { const tx = x1 + 1.5; cabinetD(tx - .45, tx + .45, zm - 1.2, zm + 1.2, y0, .82, 'porc', 'x+'); box('porc', tx - .47, tx + .47, y0 + .82, y0 + .85, zm - 1.22, zm + 1.22); stove(tx, zm - .5); box('alu', tx - .2, tx + .2, y0 + .851, y0 + .855, zm + .4, zm + .9); cyl('alu', tx - .35, y0 + .85, zm + .65, .015, .3);
        box('alu', tx - .45, tx + .45, y0 + S.CEIL - .75, y0 + S.CEIL - .55, zm - .85, zm - .15); chairX(tx - .7, zm + .3, 1); }
      boardX('white', zm); box('rubber', x1 + .02, x1 + .08, y0 + 1.5, y0 + 2.1, zm - 3.1, zm - 2.1); box('screen', x1 + .08, x1 + .085, y0 + 1.53, y0 + 2.07, zm - 3.07, zm - 2.13);   // TV
      mdl('wall_clock', x1 + .03, y0 + 2.6, zm + 2.4, Math.PI / 2); corkBoardZ(x1 + .02, 1, zm + 2.1, zm + 3.3, y0 + 1.1, y0 + 2.0);
      // 동쪽 벽: 냉장고 2 (700×700×1800) · 전자레인지 선반 · 식기 수납장 (유리문 900×450×2000 × 3)
      [z1 + 1.6, z2 - .5].forEach(z => fridgeX(x2 - .05, x2 - .72, z - .35, z + .35, y0, 1.8));
      cabinetD(x2 - .5, x2 - .05, z1 + 2.2, z1 + 3.8, y0, .85, 'porc', 'x-'); [z1 + 2.6, z1 + 3.4].forEach(z => { box('alu', x2 - .45, x2 - .05, y0 + .85, y0 + 1.16, z - .26, z + .26, { solid: true }); box('screen', x2 - .455, x2 - .45, y0 + .9, y0 + 1.1, z - .2, z + .1); });
      for (let k = 0; k < 3; k++) { const a = z1 + 4.1 + k * .9; cabinetD(x2 - .45, x2 - .05, a, a + .9, y0, 2.0, 'wood', 'x-', true); for (let j = 0; j < 3; j++) for (let q = 0; q < 4; q++) box('white', x2 - .35, x2 - .15, y0 + 1.0 + j * .32, y0 + 1.06 + j * .32, a + .1 + q * .2, a + .25 + q * .2); }
      // 창가 싱크대 (900×600 × 5)
      cabinetD(x1 + 1.0, x1 + 5.5, z2 - .65, z2 - .05, y0, .82, 'porc', 'z-'); box('porc', x1 + .98, x1 + 5.52, y0 + .82, y0 + .85, z2 - .67, z2 - .05); for (let k = 0; k < 5; k++) { const x = x1 + 1.45 + k * .9; box('alu', x - .3, x + .3, y0 + .851, y0 + .855, z2 - .5, z2 - .2); cyl('alu', x, y0 + .85, z2 - .12, .015, .3); }
      props.push({ kind: 'search', label: '가정실 찬장 열기', x: x2 - .9, y: y0 + 1, z: z1 + 4.9, floor: f });
    } else if (type === 'library') {   // 도서실 (참고 평면도 · 가구 규격도, 8.8 × 9.9m): 열람 테이블 6인용 (1800×900×720) 3 · 4인 테이블 · 열람 의자 · 벽면 단면 책장 (900×300×2000) · 창가 낮은 책장 · 사서 데스크 (2400×900, PC · 복합기) · 화이트보드 · 게시판 · 벽시계 · 화분
      darkMats();
      mat.studyG = mat.studyG || M('studyG', () => new THREE.MeshStandardMaterial({ color: 0x24423a, roughness: .55, metalness: .2 }));
      mat.ledS = mat.ledS || M('ledS', () => new THREE.MeshStandardMaterial({ color: 0xf4f8f0, emissive: 0xe8f2e4, emissiveIntensity: 1.0 }));
      const BK = ['white', 'red', 'cork', 'lockerM', 'screen', 'studyG'];
      const shelfX = (xa, side, za, zb, h = 2.0) => { const xb = xa + side * .3, lo = Math.min(xa, xb), hi = Math.max(xa, xb); box('wood', lo, hi, y0, y0 + h, za, zb, { solid: true }); const n = Math.max(1, Math.round(h / .4)); for (let j = 0; j < n; j++) { const yy = y0 + .08 + j * (h - .1) / n; box('wood', lo, hi + (side > 0 ? .005 : 0), yy, yy + .02, za, zb); for (let q = 0, z = za + .03; z < zb - .06; q++) { const w = .03 + ((q * 7 + j) % 3) * .012; if ((q + j) % 7) box(BK[(q * 5 + j) % BK.length], side > 0 ? hi - .02 : lo, side > 0 ? hi : lo + .02, yy + .02, yy + .22 + ((q + j) % 3) * .04, z, z + w); z += w + .005; } } };
      const shelfZ = (za, side, xa, xb, h) => { const zb = za + side * .3, lo = Math.min(za, zb), hi = Math.max(za, zb); box('wood', xa, xb, y0, y0 + h, lo, hi, { solid: true }); for (let q = 0, x = xa + .03; x < xb - .06; q++) { const w = .03 + (q % 3) * .012; if (q % 6) box(BK[q % BK.length], x, x + w, y0 + .1, y0 + .34, side > 0 ? hi : lo - .005, side > 0 ? hi + .005 : lo); x += w + .005; } };
      // 벽면 책장: 서쪽 · 동쪽 벽 (문 동선 1.6m 비움) · 창가 낮은 책장 (창대 0.9m 아래)
      shelfX(x1, 1, z1 + 1.6, z2 - .1); shelfX(x2, -1, z1 + 4.4, z2 - .1); shelfZ(z2, -1, x1 + .4, x2 - .4, .85);
      // 열람 테이블 3 (1800×900, 긴 변이 창과 수직) + 6인 열람 의자 (녹색)
      const chair6 = (x, z, s) => { box('studyG', x - .22, x + .22, y0 + .43, y0 + .48, z - .2, z + .2); box('studyG', Math.min(x - s * .2, x - s * .24), Math.max(x - s * .2, x - s * .24), y0 + .5, y0 + .82, z - .19, z + .19); [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]].forEach(([a, b]) => box('wood', x + a - .015, x + a + .015, y0, y0 + .43, z + b - .015, z + b + .015)); };
      const TXs = [xm - 2.45, xm, xm + 2.45], tz = z2 - 3.4;
      TXs.forEach((x, i) => { box('wood', x - .45, x + .45, y0 + .68, y0 + .72, tz - .9, tz + .9); [[-.4, -.85], [.4, -.85], [-.4, .85], [.4, .85]].forEach(([a, b]) => box('wood', x + a - .03, x + a + .03, y0, y0 + .68, tz + b - .03, tz + b + .03)); col.push({ x1: x - .45, x2: x + .45, z1: tz - .9, z2: tz + .9, y1: y0, y2: y0 + .72 });
        for (const s of [-1, 1]) [-.6, 0, .6].forEach(d => chair6(x + s * .72, tz + d, -s)); box('ledS', x - .05, x + .05, y0 + .72, y0 + .95, tz - .02, tz + .02); box('white', x - .3, x + .1, y0 + .72, y0 + .76, tz + .2 - i * .3, tz + .5 - i * .3); });
      // 4인 테이블 (복도 쪽 서측) · 사서 데스크 (2400×900×750, L자) + PC · 복합기
      { const x = x1 + 2.3, z = z1 + 2.6; box('wood', x - .6, x + .6, y0 + .68, y0 + .72, z - .45, z + .45); [[-.55, -.4], [.55, -.4], [-.55, .4], [.55, .4]].forEach(([a, b]) => box('wood', x + a - .03, x + a + .03, y0, y0 + .68, z + b - .03, z + b + .03)); col.push({ x1: x - .6, x2: x + .6, z1: z - .45, z2: z + .45, y1: y0, y2: y0 + .72 }); [-.3, .3].forEach(d => { chair6(x + d, z - .7, 0); chair6(x + d, z + .7, 0); }); }
      { const dx = x2 - 1.9, dz = z1 + 2.6; box('wood', dx - 1.2, dx + 1.2, y0, y0 + .72, dz - .45, dz - .4, { solid: true }); box('dkwood', dx - 1.22, dx + 1.22, y0 + .72, y0 + .76, dz - .47, dz + .45); box('wood', dx + .8, dx + 1.2, y0, y0 + .72, dz - .4, dz + 1.1, { solid: true }); box('dkwood', dx + .78, dx + 1.22, y0 + .72, y0 + .76, dz - .4, dz + 1.12);
        col.push({ x1: dx - 1.2, x2: dx + 1.2, z1: dz - .47, z2: dz + .45, y1: y0, y2: y0 + .76 }); officeChair(dx, dz + .75, y0, 0);
        box('rubber', dx - .3, dx + .1, y0 + .76, y0 + 1.06, dz - .2, dz - .15); box('screen', dx - .28, dx + .08, y0 + .79, y0 + 1.04, dz - .149, dz - .145); box('rubber', dx + .3, dx + .5, y0, y0 + .4, dz - .3, dz + .1);
        for (let k = 0; k < 4; k++) box(BK[k], dx - .9 + k * .06, dx - .85 + k * .06, y0 + .76, y0 + 1.0, dz - .3, dz - .1);
        copier(x2 - .7, x2 - .1, dz + 1.2, dz + 1.75, y0); era08Lib(dx, dz, y0); }
      box('alu', xm - .92, xm + .92, y0 + 1.15, y0 + 2.05, z1 + .005, z1 + .03); box('white', xm - .9, xm + .9, y0 + 1.17, y0 + 2.03, z1 + .03, z1 + .035);   // 화이트보드 (1800×900)
      mdl('wall_clock', xm, y0 + 2.5, z1 + .03, 0); [[x1 + .5, z1 + 1.2], [x2 - .5, z2 - .55], [x1 + .55, z2 - .6]].forEach(([x, z]) => mdl('potted_plant_04', x, y0, z, 0, { s: 3.0 }));
      if (!opt.noClues && !opt.noSciLib && !opt.noLib && !s_lib++) { clueNote('n4', x2 - 2.3, y0 + .77, z1 + 2.5, f, .2); clueNote('n25', x2 - 1.0, y0 + .77, z1 + 3.2, f, -.2); clueNote('q8a', TXs[0], y0 + .73, tz - .5, f, .4); clueTape('ts_reporter2', TXs[2], y0 + .73, tz + .4, f); }
      props.push({ kind: 'search', label: '대출 데스크 서랍', x: x2 - 1.9, y: y0 + 1, z: z1 + 3.2, floor: f });

    }
  }
  // ── 중앙 계단실 (본관 코어 옆): 복도에서 바로 오르는 U자 계단 · 양쪽 벽 · 난간 ──
  function centerStair(r, f, y0) {
    const core = LY.rooms.find(q => q.kind === 'core'), far = Math.abs(r.x1 - core.x2) < .01 ? r.x2 : r.x1;   // 코어와 맞닿지 않은 쪽 벽
    wallZ('wall', far - S.wall / 2, far + S.wall / 2, 0, zS, y0); finishZ(far + (far === r.x2 ? -1 : 1) * S.wall / 2, far === r.x2 ? -1 : 1, 0, zS, y0);
    const ops = [{ a: r.x1 + .4, b: r.x2 - .4, y1: 0, y2: 2.5 }]; wallX('wall', r.x1, r.x2, -S.wall / 2, S.wall / 2, y0, ops); finishX(r.x1, r.x2, -S.wall / 2, -1, y0, ops);
    box('terr', r.x1 + .1, r.x2 - .1, y0, y0 + .02, .1, .45);
    { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#1e3a2a'; g.fillRect(0, 0, 256, 64); g.fillStyle = '#e8f0e0'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`중앙 계단 ${f + 1}F`, 128, 34);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .3), new THREE.MeshBasicMaterial({ map: t })); m.position.set((r.x1 + r.x2) / 2, y0 + 2.62, -.12); m.rotation.y = Math.PI; root.add(m); }
    if (f > 0) box('terr', r.x1, r.x2, y0 - S.slab - .004, y0 + .018, .42, .46);
    roomSign('중앙계단', r.x1 + .25, y0 + 2.3, -.1);
    { const N = S.floors, up = f < N - 1 ? `${f + 2}층` : (opt.roofStair && r.x1 > 0 ? '옥상' : ''), dn = f > 0 ? `${f}층` : (opt.b1 !== false && r.x1 > 0 ? '' : '');   // 층 안내판: 지금 층 크게 + 위 · 아래 층 (각 층 중앙계단 입구 옆)
      const c = document.createElement('canvas'); c.width = 256; c.height = 320; const g = c.getContext('2d');
      g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, 256, 320); g.fillStyle = '#1f5a3a'; g.fillRect(0, 0, 256, 150);
      g.fillStyle = '#ffffff'; g.font = 'bold 110px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`${f + 1}F`, 128, 80);
      g.fillStyle = '#1f2a24'; g.font = 'bold 40px sans-serif'; if (up) g.fillText(`▲ ${up}`, 128, 196); if (dn) g.fillText(`▼ ${dn}`, 128, 264);
      g.strokeStyle = '#1f5a3a'; g.lineWidth = 8; g.strokeRect(4, 4, 248, 312);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(.48, .6), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
      m.position.set(r.x1 - .45 < (LY.rooms.find(q => q.kind === 'core') || r).x2 ? r.x2 + .5 : r.x1 - .5, y0 + 1.55, -.135); m.rotation.y = Math.PI; root.add(m); }
    exitSign((r.x1 + r.x2) / 2, y0 + 2.36, -.32);   // 중앙계단 입구 위 비상구 유도등
    stair(r, f, y0);
    props.push({ kind: 'room', label: '중앙 계단', x1: r.x1, x2: r.x2, z1: 0, z2: zS, floor: f });
  }
  // ── U자 계단 (층마다 2개 비행 + 중간 참) ──
  function stair(r, f, y0) {
    const w = (r.x2 - r.x1 - .6) / 2, xa = r.x1 + .15, xb = xa + w + .3, { zA, zB, zL } = SG(r), run = zB - zA, H = S.FH, n = 12, rise = H / 2 / n, tr = run / n;
    if (f < S.floors - 1 || (opt.roofStair && r.x1 > 0)) {   // 중간참 정면 벽: 층 안내판 (위층 ▲ / 아래층 ▼) + 비상구 표지 — 계단을 오르내리며 바로 보이는 벽
      const up = f < S.floors - 1 ? `${f + 2}층` : '옥상', dn = `${f + 1}층`, c = document.createElement('canvas'); c.width = 512; c.height = 384; const g = c.getContext('2d');
      g.fillStyle = '#f2f0e8'; g.fillRect(0, 0, 512, 384); g.strokeStyle = '#1f5a3a'; g.lineWidth = 14; g.strokeRect(7, 7, 498, 370);
      g.fillStyle = '#1f2a24'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 120px sans-serif'; g.fillText(up, 256, 112); g.fillText(dn, 256, 276);
      g.fillStyle = '#1f5a3a'; g.font = 'bold 70px sans-serif'; g.fillText('▲', 70, 112); g.fillText('▼', 70, 276); g.fillRect(40, 190, 432, 6);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, .75), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
      m.position.set((r.x1 + r.x2) / 2, y0 + H / 2 + 1.35, zL - .03); m.rotation.y = Math.PI; root.add(m);
      exitSign((r.x1 + r.x2) / 2, y0 + H / 2 + 1.86, zL - .06); }
    box('terr', r.x1, r.x2, y0, y0 + .02, zN, zA);   // 층 참 (보행면은 슬래브 쪽에서)
    const roofUp = opt.roofStair && f === S.floors - 1 && r.x1 > 0;   // 맨 위층 동쪽 계단실: 옥상까지 이어지는 계단 + 옥탑 계단실
    // 벽 쪽 핸드레일 (비행마다 기울어진 봉 + 받침대)
    const rail = (x, za, zb, ya, yb) => { const len = Math.hypot(zb - za, yb - ya), m = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, len, 8), mats.deskLeg); m.position.set(x, (ya + yb) / 2 + .9, (za + zb) / 2); m.rotation.x = Math.atan2(zb - za, yb - ya); root.add(m);
      for (let k = 0; k <= 3; k++) { const t = k / 3; box('deskLeg', x - .015, x + .015, ya + (yb - ya) * t + .05, ya + (yb - ya) * t + .9, za + (zb - za) * t - .015, za + (zb - za) * t + .015); } };
    if (f < S.floors - 1 || roofUp) { rail(r.x1 + .2, zA, zB, y0, y0 + H / 2); rail(r.x2 - .2, zB, zA, y0 + H / 2, y0 + H); }
    if (f === S.floors - 1 && !roofUp) {   // 맨 위층: 아래층 1비행 위로 뚫린 곳에 안전 난간
      box('steelG', xa, xa + w, y0, y0 + 1.05, zA - .03, zA + .03, { solid: true }); box('deskLeg', xa, xa + w, y0 + 1.05, y0 + 1.1, zA - .04, zA + .04);
      for (let k = 0; k <= 4; k++) box('deskLeg', xa + k * w / 4 - .02, xa + k * w / 4 + .02, y0, y0 + 1.05, zA - .02, zA + .02); }
    if (roofUp) {   // 옥탑: 옥상 높이 층 참 + 벽 + 지붕 (옥상 출입문은 북쪽 벽)
      const yr = y0 + H, ph = 2.8;
      box('terr', r.x1, r.x2, yr - .25, yr, zN, zA); walk.push({ x1: r.x1, x2: r.x2, z1: zN, z2: zA, h: () => yr, f: f + 1 });
      box('conc', r.x1 - .2, r.x2 + .2, yr, yr + ph, zN - .2, zN + .01, { solid: true });   /* 안쪽 면을 1cm 들여 옥상 파라펫 안쪽 면과 겹쳐 깜빡이지 않게 */ box('conc', r.x1 - .2, r.x2 + .2, yr, yr + ph, zL, zL + .2, { solid: true });
      box('conc', r.x1 - .2, r.x1, yr, yr + ph, zN + 1.55, zL, { solid: true }); box('conc', r.x1 - .2, r.x1, yr, yr + .02, zN, zN + .2, { solid: true }); box('conc', r.x1 - .2, r.x1, yr, yr + ph, zN, zN + .2, { solid: true }); box('conc', r.x1 - .2, r.x1, yr + 2.1, yr + ph, zN + .2, zN + 1.55);   // 서벽: 옥상 쪽 출입구 (z zN+.2 ~ zN+1.55)
      box('steelG', r.x1 - .2, r.x1 - .15, yr + 2.05, yr + 2.12, zN + .15, zN + 1.6); box('steelG', r.x1 - .22, r.x1 + .02, yr, yr + 2.1, zN + .15, zN + .2); box('steelG', r.x1 - .22, r.x1 + .02, yr, yr + 2.1, zN + 1.55, zN + 1.6);   // 문틀
      box('steelG', r.x1 - 1.3, r.x1 - .2, yr, yr + 2.05, zN + 1.55, zN + 1.6);   // 바깥으로 열어 둔 철문 짝
      walk.push({ x1: r.x1 - .3, x2: r.x1 + .1, z1: zN + .2, z2: zN + 1.55, h: () => yr, f: f + 1 });   // 출입문 문턱
      box('conc', r.x2 - .2, r.x2, yr + 1.1, yr + ph, zN, zL); box('conc', r.x2 - .2, r.x2 - .02, yr, yr + 1.1, zN, zL, { solid: true });   // 동벽: 파라펫 안쪽 (겹쳐 깜빡이지 않게)
      box('conc', r.x1 - .3, r.x2 + .3, yr + ph, yr + ph + .2, zN - .3, zL + .5);

      box('lamp', (r.x1 + r.x2) / 2 - .3, (r.x1 + r.x2) / 2 + .3, yr + 2.4, yr + 2.45, zN + .05, zN + .2); lights.push({ x: (r.x1 + r.x2) / 2, y: yr + 2.3, z: zN + .8 });
      box('lamp', r.x1 - .45, r.x1 - .25, yr + 2.25, yr + 2.32, zN + .7, zN + 1.0);   // 출입문 바깥 벽등
      box('steelG', xa, xa + w, yr, yr + 1.05, zA - .03, zA + .03, { solid: true });   // 옥상 층 참: 2비행 쪽만 열려 있게 1비행 위 난간
    }
    if (f < S.floors - 1 || roofUp) {
      // 1비행: 서측 반, 남쪽으로 올라감 / 중간참: 남쪽 끝 / 2비행: 동측 반, 북쪽으로 올라감
      for (let i = 0; i < n; i++) { box('terr', xa, xa + w, Math.max(y0, y0 + rise * (i + 1) - .3), y0 + rise * (i + 1), zA + i * tr, zA + (i + 1) * tr); box('nonslip', xa + .06, xa + w - .06, y0 + rise * (i + 1), y0 + rise * (i + 1) + .004, zA + i * tr, zA + i * tr + .05); }
      walk.push({ x1: xa, x2: xa + w, z1: zA, z2: zB, h: (x, z) => y0 + Math.min(n, Math.max(0, Math.ceil((z - zA) / tr))) * rise, f, stair: true });
      box('terr', r.x1, r.x2, y0 + H / 2 - .25, y0 + H / 2, zB, zL);
      walk.push({ x1: r.x1, x2: r.x2, z1: zB, z2: zL, h: () => y0 + H / 2, f });
      {
        for (let i = 0; i < n; i++) { box('terr', xb, xb + w, y0 + H / 2 + rise * (i + 1) - .3, y0 + H / 2 + rise * (i + 1), zB - (i + 1) * tr, zB - i * tr); box('nonslip', xb + .06, xb + w - .06, y0 + H / 2 + rise * (i + 1), y0 + H / 2 + rise * (i + 1) + .004, zB - i * tr - .05, zB - i * tr); }
        walk.push({ x1: xb, x2: xb + w, z1: zA, z2: zB, h: (x, z) => y0 + H / 2 + Math.min(n, Math.max(0, Math.ceil((zB - z) / tr))) * rise, f, stair: true });
      }
      // 계단 난간: 중앙 칸막이벽(1.1m) + 핸드레일
      box('wain', xa + w, xb, y0, y0 + H / 2 + 1.1, zA, zB, { solid: true });
      box('deskLeg', xa + w - .02, xb + .02, y0 + H / 2 + 1.1, y0 + H / 2 + 1.15, zA, zB);
      // 계단 밑면(경사 슬래브)은 아래층 천장에서 보이지 않게 계단실 반자 제거
    }
    // 계단실은 반자 없음: 위층 슬래브에 2비행 구멍 (구멍은 슬래브를 다시 쪼개는 대신 계단실 위 슬래브를 생략)
    stairwells.push({ x1: r.x1, x2: r.x2, z1: zA, z2: zL, f });
    if (zL < zS - .05) { box('conc', r.x1, r.x2, y0, y0 + H - S.slab, zL, zL + .2, { solid: true }); }   // 중간참 남쪽은 막힌 계단실 창고
    box('lamp', (r.x1 + r.x2) / 2 - .3, (r.x1 + r.x2) / 2 + .3, y0 + 2.6, y0 + 2.65, zN + .05, zN + .2); lights.push({ x: (r.x1 + r.x2) / 2, y: y0 + 2.5, z: zN + .8 });   // 층 참 벽등
    if (f < S.floors - 1) { box('lamp', (r.x1 + r.x2) / 2 - .3, (r.x1 + r.x2) / 2 + .3, y0 + H / 2 + 2.3, y0 + H / 2 + 2.35, zL - .2, zL - .05); lights.push({ x: (r.x1 + r.x2) / 2, y: y0 + H / 2 + 2.2, z: zL - .8 }); }   // 중간참 벽등
    exitSign((r.x1 + r.x2) / 2, y0 + 2.35, zN + .05);
    extinguisher(r.x2 - .4, y0, zN + .4, 0);
    // 방화문 (계단실 ↔ 복도) 표시
    props.push({ kind: 'fireDoor', label: '계단실 방화문', x: r.x1 < 0 ? r.x2 : r.x1, y: y0 + 1, z: zN + 1.35, floor: f });
  }
  // ── 중앙 코어: 남녀 화장실 · 복도 세면대 · 층별 분전반 · 교무실(1층) ──
  function toiletRoom(a, b, g, f, y0) {   // 화장실 (참고 평면도 · 배치도 · 규격도, 4.3 × 9.9m): 남 = 대변기 칸 3 (900×1500×1800) · 소변기 3 (400×700, 칸막이) · 여 = 대변기 부스 4 (1000×1600×1900) · 세면대 카운터 1800 (2구) · 거울 · 핸드타월기 · 휴지통 · 위생용품 수거함(여) · 청소도구함 · 바닥 배수구
      const man = g === '남', w = man ? b - .1 : a + .1, dir = man ? -1 : 1, ws = man ? a + .1 : b - .1, dS = -dir;   // 출입문 쪽(남 = 서, 여 = 동) 벽에 세면대, 반대 벽에 칸
      const X = (o, d1, d2) => [Math.min(o.w + o.d * d1, o.w + o.d * d2), Math.max(o.w + o.d * d1, o.w + o.d * d2)];
      const SW = { w, d: dir }, SS = { w: ws, d: dS };
      const bx = (o, key, d1, d2, y1, y2, z1, z2, opt2) => { const [p, q] = X(o, d1, d2); box(key, p, q, y0 + y1, y0 + y2, z1, z2, opt2); };
      UVM.tileW = 1.2;
      mat.tileW = mat.tileW || M('tileW', () => new THREE.MeshStandardMaterial({ map: PT.toiletTile(), normalMap: tx('d2_tex_paint_normal.webp'), normalScale: new THREE.Vector2(.08, .08), roughness: .18 }));   // 흰 자기질 200각 타일 (줄눈 때 · 금 · 녹물)
      mat.tileD = mat.tileD || M('tileD', () => new THREE.MeshStandardMaterial({ color: 0x9a8c7a, roughness: .4 }));
      mat.hpl = mat.hpl || M('hpl', () => new THREE.MeshStandardMaterial({ color: 0xd8d0c2, roughness: .45 }));
      mat.granite = mat.granite || M('granite', () => new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (c, W, H) => { c.fillStyle = '#8c8680'; c.fillRect(0, 0, W, H); for (let i = 0; i < 900; i++) { const v = 90 + Math.random() * 90 | 0; c.fillStyle = `rgb(${v},${v - 4},${v - 8})`; c.fillRect(Math.random() * W, Math.random() * H, 2, 2); } }), roughness: .3 }));
      box('tile', a + .1, b - .1, y0, y0 + .02, .1, zS);
      // 벽: 하부 진회색 띠 타일 · 상부 연베이지 300×600 · 허리선 포인트
      [[a + .1, a + .112], [b - .112, b - .1]].forEach(([p, q]) => { box('tileD', p, q, y0, y0 + 1.2, .1, zS); box('tileD', p, q, y0 + 1.45, y0 + 1.6, .1, zS); box('tileW', p, q, y0 + 1.2, y0 + 1.45, .1, zS); box('tileW', p, q, y0 + 1.6, y0 + S.CEIL, .1, zS); });
      box('tileD', a + .1, b - .1, y0, y0 + 1.2, zS - .012, zS); box('tileW', a + .1, b - .1, y0 + 1.2, y0 + S.CEIL, zS - .012, zS);
      // 대변기 칸 (안쪽 끝 벽 쪽부터)
      const n = man ? 3 : 4, cw = man ? .9 : 1.0, cd = man ? 1.5 : 1.6, ch = man ? 1.8 : 1.9, z0 = zS - .1 - (man ? .6 : 0) - n * cw;
      for (let k = 0; k <= n; k++) { const z = z0 + k * cw; bx(SW, 'hpl', 0, cd, .15, .15 + ch, z - .012, z + .012, { solid: true }); bx(SW, 'alu', cd - .03, cd + .01, 0, .15, z - .02, z + .02); }
      bx(SW, 'alu', cd - .02, cd + .02, .15 + ch - .03, .15 + ch, z0, z0 + n * cw);   // 상부 알루미늄 레일
      for (let k = 0; k < n; k++) { const za = z0 + k * cw, zc = za + cw / 2;
        bx(SW, 'hpl', cd - .015, cd + .015, .15, .15 + ch, za + .01, za + .08, { solid: true }); bx(SW, 'hpl', cd - .015, cd + .015, .15, .15 + ch, za + cw - .08, za + cw - .01, { solid: true });   // 앞판 기둥
        if (k % 2) bx(SW, 'hpl', cd - .015, cd + .015, .15, .15 + ch, za + .08, za + cw - .08); else bx(SW, 'hpl', cd, cd + .55, .15, .15 + ch, za + .08, za + .1);   // 닫힌 문 / 반쯤 열린 문
        bx(SW, 'alu', cd + .015, cd + .03, .95, 1.0, za + cw - .16, za + cw - .1);   // 표시 잠금장치
        toilet(w + dir * .38, zc, y0, -dir); bx(SW, 'alu', .02, .12, .7, .95, za + .05, za + .1);   // 휴지걸이
        if (!man) { bx(SW, 'hpl', .05, .35, 0, .6, za + cw - .3, za + cw - .1, { solid: true }); } }   // 위생용품 수거함 (부스 안)
      // 소변기 3 (400×700, 센서식) + 칸막이 — 남자만
      if (man) for (let k = 0; k < 3; k++) { const z = 2.2 + k * .8; // 벽걸이 소변기 (W450 D320 H880, 바닥에서 550): 백자 몸통 · 위 덮개 · 양 옆 날개 · 앞 턱 + 센서 창 · 플러시 밸브 · 청동 S트랩
        bx(SW, 'porc', 0, .12, .55, 1.43, z - .225, z + .225, { solid: true }); bx(SW, 'porc', .12, .3, 1.22, 1.43, z - .2, z + .2); bx(SW, 'porc', .12, .32, .62, 1.22, z - .225, z - .17); bx(SW, 'porc', .12, .32, .62, 1.22, z + .17, z + .225);
        bx(SW, 'porc', .12, .34, .55, .68, z - .225, z + .225); bx(SW, 'porc', .3, .345, .66, .74, z - .2, z + .2); bx(SW, 'white', .12, .125, .68, 1.22, z - .17, z + .17); bx(SW, 'rubber', .2, .26, .681, .684, z - .035, z + .035);
        bx(SW, 'rubber', .3, .305, 1.27, 1.35, z - .07, z + .07); bx(SW, 'exitG', .305, .307, 1.3, 1.32, z - .04, z - .025);
        bx(SW, 'alu', .03, .07, 1.43, 1.62, z - .022, z + .022); bx(SW, 'alu', .02, .08, 1.6, 1.65, z - .04, z + .04);
        bx(SW, 'brass', .04, .18, .4, .55, z - .035, z + .035); bx(SW, 'brass', .04, .1, .22, .42, z - .03, z + .03); bx(SW, 'brass', .0, .1, .2, .26, z - .035, z + .035);
        bx(SW, 'hpl', 0, .45, .4, 1.5, z + .4 - .015, z + .4 + .015); if (!k) bx(SW, 'hpl', 0, .45, .4, 1.5, z - .4 - .015, z - .4 + .015); }
      // 세면대 카운터 (1800, 인조대리석 · 2구) + 거울 (1800×900) + 핸드타월기 + 휴지통
      { const za = man ? 3.6 : 3.0, zb = za + 1.8;   // 연립 세면대 (참고 규격도): 인조대리석 상판 + 앞 턱 · 들어간 회색 하부장(발 걸이) · 뒤 선반 · 강화유리 거울 판 · 구스넥 수전 3 · 물비누 디스펜서
        bx(SS, 'white', 0, .58, .8, .86, za, zb, { solid: true }); bx(SS, 'white', .52, .58, .62, .8, za, zb); bx(SS, 'steelG', 0, .48, .08, .8, za + .03, zb - .03); bx(SS, 'rubber', 0, .44, 0, .08, za + .06, zb - .06);
        bx(SS, 'white', 0, .13, .86, .95, za, zb); bx(SS, 'alu', 0, .02, .95, 1.9, za - .01, za + .01); bx(SS, 'alu', 0, .02, .95, 1.9, zb - .01, zb + .01); bx(SS, 'glass', .015, .025, .95, 1.88, za, zb); bx(SS, 'alu', 0, .03, 1.88, 1.9, za, zb);
        [za + .32, za + .9, zb - .32].forEach(z => { bx(SS, 'porc', .16, .46, .845, .862, z - .2, z + .2); bx(SS, 'hpl', .19, .43, .846, .863, z - .16, z + .16); bx(SS, 'alu', .29, .33, .8635, .865, z - .02, z + .02);   // 하부 매입 세면볼 (안쪽 그림자 · 배수구)
          bx(SS, 'alu', .06, .09, .95, 1.17, z - .015, z + .015); bx(SS, 'alu', .06, .22, 1.15, 1.18, z - .015, z + .015); bx(SS, 'alu', .2, .225, 1.07, 1.17, z - .013, z + .013); });   // 구스넥 수전
        bx(SS, 'alu', .03, .1, .95, 1.12, zb - .1, zb - .03); bx(SS, 'rubber', .09, .1, 1.04, 1.07, zb - .08, zb - .05);   // 물비누 디스펜서
        bx(SS, 'white', 0, .2, 1.2, 1.44, za - .45, za - .17, { solid: true });   // 핸드타월기 (280×240×200)
        mdl('h133/CLS-014', ws + dS * .2, y0, za - .75, 0, { s: 1.1 }); col.push({ x1: ws + dS * .2 - .16, x2: ws + dS * .2 + .16, z1: za - .91, z2: za - .59, y1: y0, y2: y0 + .6 }); }   // 휴지통
      // 벽 스티커: 거울 위 절수 표어 · 소변기 위 '한 걸음 앞으로' (누렇게 바랜 코팅 종이)
      { const sticker = (txt, sub, w, h, x, y, z, face, key) => { const p = canvasPlane(w, h, 320, Math.round(320 * h / w), (c, W, H) => { c.fillStyle = '#f3efd8'; c.fillRect(0, 0, W, H); c.strokeStyle = '#3a6a9a'; c.lineWidth = 6; c.strokeRect(4, 4, W - 8, H - 8); c.fillStyle = '#1e3e6e'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `bold ${Math.round(H * .34)}px sans-serif`; c.fillText(txt, W / 2, sub ? H * .4 : H / 2); if (sub) { c.font = `${Math.round(H * .2)}px sans-serif`; c.fillStyle = '#444'; c.fillText(sub, W / 2, H * .76); } }, key);
          p.position.set(x, y0 + y, z); p.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2; p.name = 'RB_wcSticker'; root.add(p); };
        sticker('물을 아껴 씁시다', '서문고 환경부', .7, .2, ws + dS * .035, 2.05, (man ? 3.6 : 3.0) + .9, dS, 'wcSave');
        if (man) for (let k = 0; k < 3; k++) sticker('한 걸음 앞으로!', '', .24, .1, w + dir * .02, 1.78, 2.2 + k * .8, dir, 'wcStep'); }
      // 청소도구함 (600×500×2100) — 안쪽 끝 세면대 쪽 모서리 · 바닥 배수구
      bx(SS, 'hpl', 0, .5, 0, 2.1, zS - .7, zS - .1, { solid: true }); bx(SS, 'alu', .5, .52, 1.0, 1.15, zS - .62, zS - .58);
      box('alu', (a + b) / 2 - .1, (a + b) / 2 + .1, y0 + .021, y0 + .024, zS / 2 - .1, zS / 2 + .1);
      props.push({ kind: 'toilet', label: `${g}자 화장실`, x: (a + b) / 2, y: y0, z: 1.2, floor: f });
      props.push({ kind: 'sink', label: `${g}자 화장실 세면대`, x: ws + dS * .7, y: y0 + .9, z: (man ? 3.6 : 3.0) + .9, floor: f });
      props.push({ kind: 'room', type: 'toilet', label: `${g}자 화장실`, x: (a + b) / 2, y: y0, z: zS / 2, floor: f, x1: a + .1, x2: b - .1, z1: .1, z2: zS });   // 화장실 괴담 · 방 판정용
  }
  function coreRoom(r, f, y0) {
    const xm = (r.x1 + r.x2) / 2;
    if (!(f === 0 && opt.southEntry)) wallZ('wall', r.x1 - S.wall / 2, r.x1 + S.wall / 2, 0, zS, y0); wallZ('wall', r.x2 - S.wall / 2, r.x2 + S.wall / 2, 0, zS, y0);   // 1층: 교무실이 코어 서쪽까지 이어진다
    if (f === 0 && opt.southEntry) {   // 1층 코어 = 정문 현관 홀 (화장실은 2층부터)
      const ops = [{ a: xm - 2.2, b: xm + 2.2, y1: 0, y2: 2.6 }], lx = r.x1 + OFFICE_EXT;   // 현관은 lx ~ r.x2 (서쪽 2.25m 는 교무실)
      wallX('wall', r.x1, r.x2, -S.wall / 2, S.wall / 2, y0, ops); finishX(lx, r.x2, -S.wall / 2, -1, y0, ops); finishX(r.x1, r.x2, S.wall / 2, 1, y0, ops);
      wallZ('wall', lx - S.wall / 2, lx + S.wall / 2, S.wall / 2, zS, y0); finishZ(lx + S.wall / 2, 1, 0, zS, y0); finishZ(lx - S.wall / 2, -1, S.wall / 2, zS, y0);   // 교무실 | 현관 칸막이벽
      finishZ(r.x2 - S.wall / 2, -1, 0, zS, y0); finishX(lx, r.x2, zS, -1, y0, [{ a: r.x1 + 2.7, b: r.x2 - 2.7, y1: 0, y2: 2.6 }]);
      box('terr', lx + .1, r.x2 - .1, y0, y0 + .02, .1, zS);
      for (const sx of [-1, 1]) { const x0 = sx < 0 ? lx + S.wall / 2 + .1 : r.x2 - .55;   // 신발장 (양 벽)
        for (let k = 0; k < 3; k++) { const z = 1.2 + k * 1.3; box('lockerM', x0, x0 + .4, y0, y0 + 1.6, z, z + 1.2, { solid: true }); for (let j = 1; j < 5; j++) box('alu', x0 - .005, x0 + .405, y0 + j * .32, y0 + j * .32 + .015, z, z + 1.2);
          const fx = sx < 0 ? x0 + .4 : x0, d = sx < 0 ? 1 : -1;   // 칸마다 실내화 (흰 고무 + 파란 띠, 앞코가 칸 밖으로 살짝) — 몇 칸은 비었다
          for (let j = 0; j < 5; j++) for (let q = 0; q < 5; q++) { if (((k * 7 + j * 3 + q * 5 + (sx > 0 ? 2 : 0)) % 6) === 0) continue; const zz = z + .06 + q * .23, yy = y0 + j * .32 + .015, xa = Math.min(fx - d * .02, fx + d * .025), xb = Math.max(fx - d * .02, fx + d * .025);
            [0, .1].forEach(o => { box('white', xa, xb, yy, yy + .05, zz + o, zz + o + .085); box('recycB', xa, xb, yy + .05, yy + .065, zz + o + .01, zz + o + .075); }); } } }
      box('steelG', r.x1 + .3, r.x1 + 1.1, y0 + .6, y0 + 2.0, zN + .02, zN + .25, { solid: true });
      props.push({ kind: 'panel', label: `${f + 1}층 분전반`, x: r.x1 + .7, y: y0 + 1.3, z: zN + .3, floor: f });
      props.push({ kind: 'room', label: '중앙 현관', x1: r.x1 + OFFICE_EXT, x2: r.x2, z1: 0, z2: zS, floor: f });
      era08Hall(r, lx, y0);   // 2008: 돔 CCTV · 공중전화 · 우산꽂이 · 분실물 보관함
      return;
    }
    wallZ('wall', xm - .1, xm + .1, 0, zS, y0);
    const ops = [{ a: r.x1 + 1, b: r.x1 + 2, y1: 0, y2: 2.1 }, { a: r.x2 - 2, b: r.x2 - 1, y1: 0, y2: 2.1 }];
    wallX('wall', r.x1, r.x2, -S.wall / 2, S.wall / 2, y0, ops); finishX(r.x1, r.x2, -S.wall / 2, -1, y0, ops);
    ops.forEach((o, k) => {   // 화장실 출입구: 알루미늄 틀 반투명 간유리문 (닫힌 채 · [E] 로 여닫음) + 문 위 표지판
      box('alu', o.a - .05, o.a + .008, y0, y0 + 2.15, -.12, .12); box('alu', o.b - .008, o.b + .05, y0, y0 + 2.15, -.12, .12); box('alu', o.a, o.b, y0 + 2.088, y0 + 2.15, -.12, .12);   // 문틀이 개구부 면에서 살짝 나와 벽 면과 겹치지 않게
      doors.push({ kind: 'swing', mat: 'alu', win: false, w: o.b - o.a, h: 2.06, t: .04, px: k ? o.b : o.a, py: y0, pz: 0, ox: (k ? -1 : 1) * (o.b - o.a) / 2, oz: 0, dir: k ? 1 : -1, open: false,
        cx1: o.a, cx2: o.b, cz1: -.08, cz2: .08, mx: (o.a + o.b) / 2, mz: -.5, label: `${k ? '여' : '남'}자 화장실 문`, floor: f, glassLeaf: true, frosted: true });
      const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#f4f4f0'; g.fillRect(0, 0, 256, 64); g.fillStyle = k ? '#c8283a' : '#1f4fa8'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(32, 18, 8, 0, 7); g.fill(); if (k) { g.beginPath(); g.moveTo(32, 26); g.lineTo(46, 56); g.lineTo(18, 56); g.closePath(); g.fill(); } else g.fillRect(24, 28, 16, 28);
      g.fillStyle = '#1a1a1a'; g.font = 'bold 28px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(k ? '여자화장실' : '남자화장실', 160, 34);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(.9, .225), new THREE.MeshStandardMaterial({ map: t, roughness: .5 })); m.position.set((o.a + o.b) / 2, y0 + 2.36, -.13); m.rotation.y = Math.PI; root.add(m); });
    [[r.x1, xm, '남'], [xm, r.x2, '여']].forEach(([a, b, g]) => toiletRoom(a, b, g, f, y0));
    // 복도측 세면대 (수도 · 배관)
    // 세면대는 화장실 벽(복도 남쪽) 두 문 사이에 — 1층 현관 앞(북쪽 벽)을 막지 않게
    if (opt.bridge && f === 1) {   // 구름다리 출입구 맞은편: 세면대 대신 학교 안내도 · 게시판 · 벤치
      box('lockerM', xm - 1.6, xm + 1.6, y0 + 1.0, y0 + 2.2, -.14, -.104); box('white', xm - 1.5, xm + 1.5, y0 + 1.06, y0 + 2.14, -.16, -.14);
      { const c = document.createElement('canvas'); c.width = 512; c.height = 192; const g = c.getContext('2d'); g.fillStyle = '#f2efe4'; g.fillRect(0, 0, 512, 192); g.fillStyle = '#2a3a4a'; g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillText('서문고등학교 안내도', 256, 46);
        g.strokeStyle = '#2a3a4a'; g.lineWidth = 3; g.strokeRect(40, 70, 432, 46); g.strokeRect(120, 140, 272, 34); g.beginPath(); g.moveTo(256, 116); g.lineTo(256, 140); g.stroke(); g.font = '20px sans-serif'; g.fillText('본관 (1~4층)', 256, 100); g.fillText('별관 (1~3층)', 256, 164); g.fillStyle = '#c02020'; g.fillText('● 현재 위치: 2층 구름다리', 256, 132);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.05), new THREE.MeshStandardMaterial({ map: t, roughness: .7 })); m.position.set(xm, y0 + 1.6, -.17); m.rotation.y = Math.PI; root.add(m); }
      box('wood', xm - 1.0, xm + 1.0, y0 + .42, y0 + .47, -.75, -.35); [xm - .85, xm + .85].forEach(x => box('deskLeg', x - .03, x + .03, y0, y0 + .42, -.7, -.4)); col.push({ x1: xm - 1.0, x2: xm + 1.0, z1: -.78, z2: -.3, y1: y0, y2: y0 + .5 });
    } else {   // 복도: 세면대는 화장실 안으로 — 두 화장실 문 사이 벽에는 학생 게시판
      box('lockerM', xm - 1.5, xm + 1.5, y0 + 1.0, y0 + 2.1, -.14, -.104); box('cork', xm - 1.42, xm + 1.42, y0 + 1.07, y0 + 2.03, -.16, -.14);
      for (let k = 0; k < 6; k++) box('white', xm - 1.3 + k * .45, xm - 1.0 + k * .45, y0 + 1.25 + (k % 2) * .35, y0 + 1.65 + (k % 2) * .35, -.17, -.16);
    }

    // 층 분전반 (EPS)
    box('steelG', r.x1 + .3, r.x1 + 1.1, y0 + .6, y0 + 2.0, zN + .02, zN + .25, { solid: true });   // 코어 서쪽 (동쪽은 엘리베이터 승강장)
    props.push({ kind: 'panel', label: `${f + 1}층 분전반`, x: r.x1 + .7, y: y0 + 1.3, z: zN + .3, floor: f });
  }
  // ── 2008년 현재 시점 설비 (정수기 · CCTV · 무인경비 감지기 · 연기감지기 · 비상조명등 · 방송 스피커 · 공중전화 · 실물화상기 · 프로젝터 등) ──
  //   표지 · 게시물은 한 장의 아틀라스 텍스처(atl08)에 모아 병합 지오메트리 하나로 그린다 — 드로콜 몇 개로 끝
  function m08() { if (mat.atl08) return;
    mat.atl08 = M('atl08', () => { const t = canvasTex(1024, 1024, (g) => {
      const T = (s, x, y, font, col = '#111', al = 'center') => { g.font = font; g.fillStyle = col; g.textAlign = al; g.textBaseline = 'middle'; g.fillText(s, x, y); };
      g.fillStyle = '#ddd'; g.fillRect(0, 0, 1024, 1024);
      // 소화기 표지 (빨간 바탕 '소화기' + 사용 순서)
      g.fillStyle = '#c8161c'; g.fillRect(0, 0, 128, 256); g.fillStyle = '#fff'; g.fillRect(8, 70, 112, 178); T('소화기', 64, 36, 'bold 34px sans-serif', '#fff');
      ['사용방법', '① 안전핀을', '   뽑는다', '② 노즐을 불', '   쪽으로', '③ 손잡이를', '   움켜쥔다', '④ 골고루 쏜다'].forEach((s, i) => T(s, 14, 86 + i * 20, (i ? '' : 'bold ') + '15px sans-serif', '#222', 'left'));
      // 공중전화 (카드 · 동전 겸용)
      g.fillStyle = '#1d4f9c'; g.fillRect(128, 0, 256, 128); T('공중전화', 256, 48, 'bold 52px sans-serif', '#fff'); T('카드 · 동전 겸용', 256, 100, 'bold 24px sans-serif', '#ffe66a');
      // 분실물 보관함
      g.fillStyle = '#f2ead2'; g.fillRect(128, 128, 256, 128); g.strokeStyle = '#7a5a20'; g.lineWidth = 6; g.strokeRect(134, 134, 244, 116); T('분실물 보관함', 256, 172, 'bold 38px sans-serif', '#4a3010'); T('찾아가세요! — 학생부', 256, 222, '22px sans-serif', '#4a3010');
      // 2008년 10월 달력 (10월 1일 = 수요일 · 3일 개천절 — 한글날은 이 무렵 공휴일이 아니었다)
      { const X = 384; g.fillStyle = '#fbfaf6'; g.fillRect(X, 0, 256, 352); g.fillStyle = '#3a6a3a'; g.fillRect(X, 0, 256, 150); T('2008', X + 128, 40, 'bold 30px sans-serif', '#fff'); T('10  October', X + 128, 92, 'bold 40px serif', '#fff'); T('개교 40주년 · 학예제', X + 128, 132, '18px sans-serif', '#e6f0d0');
        ['일', '월', '화', '수', '목', '금', '토'].forEach((d, i) => T(d, X + 20 + i * 36, 166, 'bold 16px sans-serif', i === 0 ? '#c01818' : i === 6 ? '#1838a0' : '#222'));
        for (let d = 1; d <= 31; d++) { const k = d + 2, c = k % 7, r = (k / 7) | 0; T(String(d), X + 20 + c * 36, 194 + r * 30, (d === 10 ? 'bold ' : '') + '17px sans-serif', c === 0 || d === 3 ? '#c01818' : c === 6 ? '#1838a0' : '#222');
          if (d === 10) { g.strokeStyle = '#c01818'; g.lineWidth = 2; g.beginPath(); g.arc(X + 20 + c * 36, 194 + r * 30, 13, 0, 7); g.stroke(); } } }
      // 환경미화: 우리 반 목표 · 칭찬 릴레이 · 독서 마라톤
      const card = (X, Y, w, h, head, hc, lines, bg) => { g.fillStyle = bg; g.fillRect(X, Y, w, h); g.fillStyle = hc; g.fillRect(X, Y, w, 52); T(head, X + w / 2, Y + 27, 'bold 28px sans-serif', '#fff'); lines.forEach((s, i) => T(s, X + 12, Y + 80 + i * 32, '19px sans-serif', '#222', 'left')); };
      card(640, 0, 192, 256, '우리 반 목표', '#d0562a', ['★ 지각 0명 도전', '★ 수능 D-34 파이팅', '★ 학예제 합창 1등', '★ 교실 청결 유지', '★ 서로 존중하기'], '#fff6e4');
      card(832, 0, 192, 256, '칭찬 릴레이', '#2a8a5a', ['♥ 분리수거 앞장', '♥ 친구 노트 정리', '♥ 칠판 청소 담당', '♥ 학예제 준비', '  — 10월 둘째 주'], '#eef8ec');
      card(0, 256, 192, 256, '독서 마라톤', '#2a5aa0', [], '#eef2fa');
      for (let r = 0; r < 6; r++) { g.fillStyle = '#c8d2e6'; g.fillRect(14, 334 + r * 28, 164, 2); g.fillStyle = ['#e04040', '#e0a020', '#40a040', '#4070d0', '#a040c0', '#e06080'][r]; g.fillRect(70, 318 + r * 28, 20 + (r * 37 % 90), 12); T(`${r + 1}모둠`, 14, 324 + r * 28, '14px sans-serif', '#223', 'left'); }
      // CCTV 녹화중 안내 스티커
      g.fillStyle = '#ffd21c'; g.fillRect(192, 256, 256, 128); g.fillStyle = '#111'; g.fillRect(192, 256, 256, 10); g.fillRect(192, 374, 256, 10); T('CCTV 녹화중', 320, 304, 'bold 40px sans-serif'); T('24시간 녹화 · 서문고등학교장', 320, 348, '18px sans-serif');
      // 정수기 위생 점검표
      g.fillStyle = '#e8f4fb'; g.fillRect(192, 384, 256, 128); g.fillStyle = '#1a6aa8'; g.fillRect(192, 384, 256, 36); T('정수기 위생 점검표', 320, 403, 'bold 22px sans-serif', '#fff');
      ['필터 교체: 2008. 9. 22', '수질 검사: 적합 (10. 1)', '관리 책임: 행정실'].forEach((s, i) => T(s, 204, 440 + i * 24, '17px sans-serif', '#123', 'left'));
      // 디지털 믹서 액정 · DVD/VHS 콤보 앞판 · 감지기 렌즈
      g.fillStyle = '#0c2a40'; g.fillRect(448, 352, 128, 64); g.fillStyle = '#5ad0ff'; for (let i = 0; i < 12; i++) g.fillRect(456 + i * 9, 410 - (i * 29 % 34) - 6, 6, (i * 29 % 34) + 6); T('SCENE 08 조회방송', 512, 364, '11px sans-serif', '#bfefff');
      g.fillStyle = '#18191c'; g.fillRect(448, 416, 256, 64); g.fillStyle = '#2c2e33'; g.fillRect(456, 426, 100, 12); g.fillRect(588, 426, 100, 12); T('DVD  0:12:48', 470, 460, '14px monospace', '#58f070', 'left'); T('VHS', 640, 460, 'bold 12px sans-serif', '#aaa');
      { const gr = g.createRadialGradient(608, 384, 4, 608, 384, 30); gr.addColorStop(0, '#5a2a2a'); gr.addColorStop(1, '#1a1012'); g.fillStyle = gr; g.fillRect(576, 352, 64, 64); }
    }); return new THREE.MeshStandardMaterial({ map: t, roughness: .75, polygonOffset: true, polygonOffsetFactor: -2 }); });
    mat.led08 = M('led08', () => new THREE.MeshStandardMaterial({ color: 0xff3020, emissive: 0xff1808, emissiveIntensity: 2.2 }));
    mat.dome08 = M('dome08', () => new THREE.MeshStandardMaterial({ color: 0x1c2024, roughness: .08, metalness: .4 }));
    mat.ss08 = M('ss08', () => new THREE.MeshStandardMaterial({ color: 0xc4c8cc, roughness: .28, metalness: .85 }));   // 스테인리스 (우산꽂이 · 공중전화 판)
  }
  // 아틀라스 칸 하나를 붙인 판: ry = 앞면이 보는 방향 (0 = +z), rx = 먼저 x 축으로 눕힘 (-π/2 = 위를 본다)
  function a08(cell, w, h, x, y, z, ry = 0, rx = 0) { m08(); const A = { ext: [0, 0, 128, 256], phone: [128, 0, 256, 128], lost: [128, 128, 256, 128], cal: [384, 0, 256, 352], goal: [640, 0, 192, 256], praise: [832, 0, 192, 256],
      read: [0, 256, 192, 256], cctv: [192, 256, 256, 128], water: [192, 384, 256, 128], mixLcd: [448, 352, 128, 64], dvd: [448, 416, 256, 64], pir: [576, 352, 64, 64] }[cell];
    const [cx, cy, cw, ch] = A, g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + uv.getX(i) * cw) / 1024, 1 - (cy + (1 - uv.getY(i)) * ch) / 1024);
    if (rx) g.rotateX(rx); g.rotateY(ry); g.translate(x, y, z); G('atl08', g); }
  // 돔 CCTV (천장, 반구 스모크 커버 + 흰 받침 + 빨간 LED)
  function dome08(x, yc, z) { m08(); box('white', x - .08, x + .08, yc - .03, yc, z - .08, z + .08); const g = new THREE.SphereGeometry(.065, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2); g.rotateX(Math.PI); g.translate(x, yc - .03, z); G('dome08', g);
    box('led08', x + .045, x + .055, yc - .045, yc - .035, z - .005, z + .005); }
  // 무인경비 적외선 감지기 (벽 위 모서리: 흰 함체 + 검붉은 렌즈 + 빨간 LED) — (nx, nz) 벽에서 나오는 방향
  function pir08(x, y, z, nx, nz) { m08(); const s = .045;
    if (nx) { box('white', Math.min(x, x + nx * .06), Math.max(x, x + nx * .06), y - .07, y + .05, z - s, z + s); a08('pir', .06, .06, x + nx * .062, y - .01, z, nx > 0 ? Math.PI / 2 : -Math.PI / 2); box('led08', Math.min(x, x + nx * .064), Math.max(x, x + nx * .064), y - .06, y - .05, z + .02, z + .03); }
    else { box('white', x - s, x + s, y - .07, y + .05, Math.min(z, z + nz * .06), Math.max(z, z + nz * .06)); a08('pir', .06, .06, x, y - .01, z + nz * .062, nz > 0 ? 0 : Math.PI); box('led08', x + .02, x + .03, y - .06, y - .05, Math.min(z, z + nz * .064), Math.max(z, z + nz * .064)); } }
  // 광전식 연기감지기 (2000년대: 납작한 원반 + 빨간 작동 표시등)
  function smoke08(x, yc, z) { m08(); cyl('white', x, yc - .045, z, .075, .045, .07, 16); box('led08', x + .05, x + .06, yc - .05, yc - .04, z - .005, z + .005); }
  // 비상조명등 (벽부형 2구: 흰 함체 + 양쪽 헤드 + 녹색 충전 LED) — 벽에서 +z 로 나온다
  function emerg08(x, y, z) { box('white', x - .18, x + .18, y - .06, y + .06, z, z + .1);
    [-1, 1].forEach(s => { const g = new THREE.CylinderGeometry(.035, .04, .06, 10); g.rotateX(Math.PI / 2); g.translate(x + s * .12, y - .085, z + .07); G('lamp', g); }); box('exitG', x - .01, x + .01, y + .02, y + .035, z + .1, z + .103); }
  // 방송 스피커 (벽 상부, 나무 함 + 검은 그릴) — 벽에서 +z 로 나온다
  function spk08(x, y, z) { box('lockerM', x - .17, x + .17, y - .2, y + .2, z, z + .12); box('rubber', x - .14, x + .14, y - .17, y + .13, z + .12, z + .124); }
  // 복도: 층마다 (교실 칸 기준)
  function era08Corridor(f, y0) {
    const yc = y0 + S.CEIL, cls = LY.rooms.filter(r => r.kind === 'class');
    cls.forEach((r, i) => {
      a08('ext', .16, .32, r.x1 + .35, y0 + 1.02, -S.wall / 2 - .006, Math.PI);   // 소화기 위 표지
      smoke08(r.x1 + 2.2, yc, zN + .9);
      emerg08(r.x2 - .95, y0 + 2.62, zN + .02);   // 소화전 위 (북쪽 벽, 기둥 옆)
      if (i % 2) spk08(r.x2, y0 + 2.62, zN + .02);
      if (i % 3 === 0) pir08(r.x1 + .3, yc - .12, zN + .01, 0, 1);
    });
    // 계단실 층 착지 천장 돔 CCTV — 바로 위 슬래브에서 짧은 파이프로 내려온다
    LY.rooms.filter(r => r.kind === 'stair').forEach(r => { const x = (r.x1 + r.x2) / 2, yt = y0 + S.FH - S.slab; box('white', x - .012, x + .012, yc, yt, zN + 1.0 - .012, zN + 1.0 + .012); dome08(x, yc, zN + 1.0); pir08(r.x1 < 0 ? r.x2 - .12 : r.x1 + .12, yc - .12, zN + .01, 0, 1); });
    // 중앙 계단 앞: 정수기 (복도 남쪽 벽, 화장실 문 · 계단 입구 사이) + 위생 점검표 · 돔 CCTV
    if (csR) { const x = csR.x1 - .3; mdl('sf_water_cooler', x, y0, -.42, Math.PI); col.push({ x1: x - .27, x2: x + .27, z1: -.68, z2: -.12, y1: y0, y2: y0 + 1.32 });
      a08('water', .34, .17, x, y0 + 1.62, -S.wall / 2 - .006, Math.PI);
      dome08((csR.x1 + csR.x2) / 2, yc, -1.0); }
    // 복도 양 날개 돔 CCTV
    if (cls.length >= 4) [cls[1], cls[cls.length - 2]].forEach(r => dome08(r.x1 + 2.2, yc, zN + 2.2));
  }
  // 1층 중앙 현관 홀: 돔 CCTV · 녹화 안내 · 카드/동전 공중전화 2대 · 우산꽂이 · 분실물 보관함 · 감지기
  function era08Hall(r, lx, y0) {
    const yc = y0 + S.CEIL, ex = r.x2 - S.wall / 2, wx = lx + S.wall / 2;
    dome08((lx + r.x2) / 2, yc, 8.4); dome08((lx + r.x2) / 2, yc, 1.2); pir08(ex - .01, yc - .12, zS - .45, -1, 0);
    a08('cctv', .36, .18, wx + .006, y0 + 1.75, 8.2, Math.PI / 2);
    // 공중전화: 동쪽 벽 (신발장 남쪽), 스테인리스 판 + 본체 2대 (노란 카드식 · 회색 동전식)
    box('ss08', ex - .02, ex, y0 + .8, y0 + 1.95, 5.55, 6.95); a08('phone', .6, .3, ex - .022, y0 + 2.12, 6.25, -Math.PI / 2);
    [[5.9, 'recycY'], [6.6, 'crt']].forEach(([z, k]) => { box(k, ex - .2, ex - .02, y0 + 1.05, y0 + 1.72, z - .17, z + .17); box('rubber', ex - .23, ex - .2, y0 + 1.42, y0 + 1.66, z - .07, z + .03); box('screen', ex - .205, ex - .2, y0 + 1.5, y0 + 1.58, z + .06, z + .14);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) box('white', ex - .205, ex - .2, y0 + 1.12 + i * .06, y0 + 1.16 + i * .06, z + .04 + j * .035, z + .07 + j * .035); });
    box('rubber', ex - .3, ex - .02, y0 + .88, y0 + .9, 5.65, 6.85); col.push({ x1: ex - .3, x2: ex, z1: 5.55, z2: 6.95, y1: y0 + .85, y2: y0 + 1.95 });   // 전화번호부 받침
    // 우산꽂이 (스테인리스 원통 · 우산 몇 개) — 남쪽 출입문 옆 동쪽 구석
    { const x = ex - .3, z = zS - 1.0; cyl('ss08', x, y0, z, .17, .55, .17, 16);
      [['recycB', .06, .04], ['red', -.05, .05], ['rubber', 0, -.07], ['recycG', .07, -.05]].forEach(([k, a, b], i) => { const g = new THREE.CylinderGeometry(.012, .03, .85, 6); g.rotateZ(a * 1.2); g.rotateX(b * 1.2); g.translate(x + a, y0 + .42 + i * .02, z + b); G(k, g); });
      col.push({ x1: x - .18, x2: x + .18, z1: z - .18, z2: z + .18, y1: y0, y2: y0 + .9 }); }
    // 분실물 보관함 (서쪽 벽, 신발장 남쪽): 철제 캐비닛 + 위 바구니 + 표지
    cabinetD(wx, wx + .45, 6.0, 7.0, y0, 1.05, 'steelG', 'x+');
    box('recycB', wx + .05, wx + .4, y0 + 1.05, y0 + 1.2, 6.1, 6.55); box('lockerM', wx + .1, wx + .35, y0 + 1.1, y0 + 1.22, 6.65, 6.9);
    a08('lost', .5, .25, wx + .006, y0 + 1.55, 6.5, Math.PI / 2);
  }
  // 일반 교실: 실물화상기 · 10월 달력 · 환경미화 게시물 · 멀티미디어실(2학년 3반 칸 = 203)은 천장 빔 프로젝터 + 전동 스크린
  function era08Class(name, f, x1, x2, z1, z2, y0) {
    const zc = (z1 + z2) / 2, yc = y0 + S.CEIL;
    { const x = x1 + 1.8, z = zc + .26, y = y0 + 1.03;   // 실물화상기 (교탁 위, 접이식 팔 + 카메라 머리 + 전원 LED)
      box('white', x - .1, x + .1, y, y + .03, z - .12, z + .12); box('rubber', x - .1, x - .07, y + .03, y + .42, z - .015, z + .015); box('white', x - .1, x + .06, y + .4, y + .46, z - .04, z + .04); box('rubber', x + .02, x + .05, y + .38, y + .4, z - .025, z + .025); box('exitG', x + .07, x + .08, y + .03, y + .036, z + .08, z + .09); }
    a08('cal', .36, .495, x1 + .052, y0 + 1.25, zc + 3.35, Math.PI / 2);
    [['goal', zc - 1.15], ['praise', zc], ['read', zc + 1.15]].forEach(([k, z]) => a08(k, .42, .56, x2 - .048, y0 + 1.9, z, -Math.PI / 2));
    if (f === 1 && /2학년 3반$/.test(name)) {   // 멀티미디어실 (203)
      box('white', x1 + .12, x1 + .26, yc - .14, yc - .02, zc - 1.35, zc + 1.35); box('white', x1 + .17, x1 + .175, y0 + 1.95, yc - .14, zc - 1.25, zc + 1.25); box('rubber', x1 + .15, x1 + .2, y0 + 1.92, y0 + 1.96, zc - 1.27, zc + 1.27);
      const px = x1 + 3.6; box('alu', px - .01, px + .01, yc - .3, yc, zc - .01, zc + .01); box('white', px - .17, px + .17, yc - .42, yc - .3, zc - .14, zc + .14); cyl('rubber', px - .17, yc - .36, zc, .04, .02); box('led08', px + .1, px + .12, yc - .32, yc - .31, zc + .14, zc + .143); }
  }
  // 방송실 (2008 추가분만 — 콘솔 · 장비실 · 조사 지점은 그대로): 편집석 가운데 디지털 믹서 · 양 끝 19" LCD · 옆 장비 카트 (DVD/VHS 콤보 + LCD 프리뷰)
  function era08Bcast(X1, z2, y0) {
    { const x = X1 + 3.6, z = z2 - .62, y = y0 + .74;
      box('rack', x - .3, x + .3, y, y + .07, z - .22, z + .22); a08('mixLcd', .18, .09, x + .12, y + .072, z - .1, 0, -Math.PI / 2);
      for (let k = 0; k < 10; k++) box('alu', x - .28 + k * .045, x - .265 + k * .045, y + .07, y + .085, z + .02, z + .18); box('led08', x + .24, x + .26, y + .07, y + .075, z + .15, z + .17); }
    retroPC(X1 + 2.35, y0 + .74, z2 - .6, 'z-', { tower: null, kb: false, lcd: true, scale: .85 }); retroPC(X1 + 4.85, y0 + .74, z2 - .6, 'z-', { tower: null, kb: false, lcd: true, scale: .85 });
    { const x = X1 + 5.47, z = z2 - .65;
      box('rack', x - .24, x + .24, y0 + .05, y0 + .8, z - .27, z + .27, { solid: true }); box('rubber', x - .24, x + .24, y0, y0 + .05, z - .27, z + .27);
      box('rubber', x - .22, x + .22, y0 + .8, y0 + .9, z - .2, z + .2); a08('dvd', .4, .09, x, y0 + .85, z - .203, Math.PI);
      retroPC(x, y0 + .9, z + .05, 'z-', { tower: null, kb: false, lcd: true, scale: .7 }); }
  }
  // 도서실 대출 데스크: 바코드 스캐너 (거치대 + 건) · 외장 CD-ROM · 본체 ODD 슬롯
  function era08Lib(dx, dz, y0) { const y = y0 + .76;
    box('rubber', dx + .24, dx + .36, y, y + .02, dz - .02, dz + .1); box('rubber', dx + .28, dx + .32, y + .02, y + .1, dz + .02, dz + .06); { const g = new THREE.BoxGeometry(.05, .14, .06); g.rotateX(-.5); g.translate(dx + .3, y + .14, dz + .04); G('rubber', g); } box('led08', dx + .29, dx + .31, y + .2, y + .205, dz - .01, dz + .01);
    box('rubber', dx + .45, dx + .6, y, y + .03, dz - .35, dz - .15); box('alu', dx + .46, dx + .59, y + .012, y + .018, dz - .151, dz - .148);
    box('alu', dx + .33, dx + .47, y0 + .32, y0 + .34, dz + .1, dz + .104); }
  function fluor(x, y, z, alongX) {   // 2등용 매입 형광등 (1200 × 300)
    const [a, b] = alongX ? [.6, .15] : [.15, .6];
    box('lamp', x - a, x + a, y - .02, y, z - b, z + b); lights.push({ x, y: y - .1, z });
  }
  // 하향식 스프링클러 헤드: 황동 몸체 + 디플렉터 (같은 재질 키로 층 끝에서 한 메시로 합친다)
  function sprink(x, y, z) { cyl('brass', x, y - .07, z, .011, .07, .011, 6); cyl('alu', x, y - .085, z, .032, .008, .032, 10); cyl('alu', x, y - .012, z, .04, .012, .04, 10); }
  function detector(x, y, z) { const g = new THREE.CylinderGeometry(.06, .07, .04, 12); g.translate(x, y - .02, z); (geo.get('white') || geo.set('white', []).get('white')).push(g); }
  // 유도등: 흰 테 + 앞뒤 표지면. alongX = true 면 복도를 따라 보이도록(표지면이 ±x 를 향함)
  function exitSign(x, y, z, alongX = false) { const w = .2, t = .025;
    if (alongX) { box('white', x - t - .006, x + t + .006, y - .01, y + .15, z - w - .01, z + w + .01); for (const sx of [-1, 1]) { const g = new THREE.PlaneGeometry(w * 2, .14); g.rotateY(sx * Math.PI / 2); g.translate(x + sx * (t + .008), y + .07, z); G('exitSign', g); const h = new THREE.PlaneGeometry(w * 3.4, .5); h.rotateY(sx * Math.PI / 2); h.translate(x + sx * (t + .03), y + .07, z); G('exitHalo', h); } }
    else { box('white', x - w - .01, x + w + .01, y - .01, y + .15, z - t - .006, z + t + .006); for (const sz of [-1, 1]) { const g = new THREE.PlaneGeometry(w * 2, .14); if (sz < 0) g.rotateY(Math.PI); g.translate(x, y + .07, z + sz * (t + .008)); G('exitSign', g); const h = new THREE.PlaneGeometry(w * 3.4, .5); if (sz < 0) h.rotateY(Math.PI); h.translate(x, y + .07, z + sz * (t + .03)); G('exitHalo', h); } } }
  // 실사 한국식 분말 소화기
  function extinguisher(x, y0, z, ry = 0) { mdl('korean_fire_extinguisher_01', x, y0, z, ry);
    { const g = new THREE.PlaneGeometry(.05, .075); g.rotateZ(.08); g.rotateY(ry); g.translate(x + Math.sin(ry) * .125 + Math.cos(ry) * .03, y0 + .4, z + Math.cos(ry) * .125 - Math.sin(ry) * .03); G('extTag', g); }   // 목에 건 노란 점검표 '2008.03 점검'
    props.push({ kind: 'extinguisher', label: '소화기', x, y: y0 + .3, z }); }
  function hydrant(x, y0, z, f) { box('red', x - .35, x + .35, y0 + .25, y0 + 1.55, z, z + .2, { solid: true }); box('white', x - .3, x + .3, y0 + 1.2, y0 + 1.42, z + .2, z + .205); props.push({ kind: 'hydrant', label: '옥내소화전', x, y: y0 + 1.0, z: z + .3, floor: f }); }

  // 계단실 위 슬래브 · 반자 구멍: 해당 층 위 슬래브에서 계단실 영역을 뺀다 — 단순화: 계단실 영역 위 반자 제거용 표시만 남긴다
  // 병합
  for (const [key, list] of geo) { const g = mergeGeometries(list, false); const m = new THREE.Mesh(g, mat[key]); m.castShadow = !['glass', 'lamp', 'wear', 'streak', 'grime', 'exitHalo'].includes(key); m.receiveShadow = true; m.name = 'RB_' + key; root.add(m); }
  // 바닥 높이 조회 (계단 포함): 발 높이 기준으로 올라설 수 있는 가장 높은 면
  const groundAt = (x, z, feet) => { let best = null; for (const w of walk) { if (x < w.x1 || x > w.x2 || z < w.z1 || z > w.z2) continue; const h = w.h(x, z); if (h <= feet + .45 && (best == null || h > best)) best = h; } return best; };
  // 문짝: 병합하지 않은 개별 메시 (열고 닫는 애니메이션 · 닫혔을 때만 충돌)
  for (const d of doors) {
    const g = new THREE.Group(); g.position.set(d.px, d.py, d.pz); root.add(g); d.group = g;
    const leaf = new THREE.Mesh(d.axisZ ? uvBox(d.t, d.h, d.w) : uvBox(d.w, d.h, d.t), d.glassLeaf ? (d.frosted ? mat.frost : mat.glass) : mat[d.mat]); if (d.glassLeaf) { const fr = new THREE.Mesh(new THREE.BoxGeometry(d.w, .08, d.t + .01), mat.alu); fr.position.set(d.ox, .04, 0); g.add(fr); const fr2 = fr.clone(); fr2.position.y = d.h - .04; g.add(fr2); } leaf.position.set(d.ox, d.h / 2, d.oz); g.add(leaf);
    if (d.win) { const gw = d.kind === 'swing' ? d.w * .5 : .5; const gl = new THREE.Mesh(d.axisZ ? new THREE.BoxGeometry(d.t + .004, .7, gw) : new THREE.BoxGeometry(gw, .7, d.t + .004), mat.glass); gl.position.set(d.ox, d.h * .7, d.oz); g.add(gl); }
    { const hd = new THREE.Mesh(d.axisZ ? new THREE.BoxGeometry(d.t + .06, .12, .03) : new THREE.BoxGeometry(.03, .12, d.t + .06), mat.alu); const k = d.kind === 'swing' ? .42 : -.4; hd.position.set(d.ox * (d.axisZ ? 1 : 1) + (d.axisZ ? 0 : Math.sign(d.ox || 1) * d.w * Math.abs(k) * (d.kind === 'swing' ? 1 : -1)), 1.0, d.oz + (d.axisZ ? Math.sign(d.oz) * d.w * .42 : 0)); g.add(hd); }
    d.col = { x1: d.cx1, x2: d.cx2, z1: d.cz1, z2: d.cz2, y1: d.py, y2: d.py + d.h, door: d }; col.push(d.col);
    d.t01 = d.open ? 1 : 0; d.target = d.t01; applyDoor(d);
  }
  function applyDoor(d) {
    if (d.kind === 'slide') d.group.position.x = d.px + d.dir * d.w * .95 * d.t01;
    else d.group.rotation.y = d.dir * d.t01 * Math.PI * .5;
    d.col.off = d.t01 > .25;
  }
  const tickDoors = dt => { for (const d of doors) if (d.t01 !== d.target) { d.t01 += Math.sign(d.target - d.t01) * Math.min(Math.abs(d.target - d.t01), dt * 2.2); applyDoor(d); } };
  const nearDoor = (x, z, y, r = 1.6) => { let best = null, bd = r; for (const d of doors) { if (Math.abs(d.py - y) > 1) continue; const dd = Math.hypot(d.mx - x, d.mz - z); if (dd < bd) { bd = dd; best = d; } } return best; };
  // 세계 ↔ 건물 좌표 (건물은 원점 기준으로 지은 뒤 통째로 옮기고 돌린다)
  const toLocal = (x, z) => { const dx = x - OX, dz = z - OZ; return [dx * cR - dz * sR, dx * sR + dz * cR]; };
  const toWorld = (x, z) => [OX + x * cR + z * sR, OZ - x * sR + z * cR];
  const API = { moonWins, elevX: ELX, mats, root, col, walk, props, lights, groundAt, layout: LY, spec: S, stairwells, doors, tickDoors, nearDoor, models, toLocal, toWorld, name: opt.label || '본관' };
  { const refs = collectRefs({ ...API, root: null }); for (const k in mats) refs.mats.add(mats[k]); dedupeMaterials(root, refs); batchStaticChildren(root, { objs: refs.objs, band: S.FH }); }   // 중복 재질 · 정적 메시 합치기 (성능)
  return API;
}

// 본관 ↔ 별관 1층 연결 통로 (유리 커튼월 복도, 천장 2.9m)
export function buildWalkway({ x1, x2, z1, z2, y = 0 }) {   // y: 바닥 높이 (2층 구름다리면 층 높이)
  const root = new THREE.Group(); root.name = 'REBUILD_WALKWAY'; const col = [], walk = [{ x1, x2, z1, z2, h: () => y, f: y > .5 ? 1 : 0 }], lights = [];
  const mat = { terr: pbr('tile', { rough: .8 }), conc: pbr('step', { rough: 1 }), alu: new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: .35, metalness: .7 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfd6dc, roughness: .08, metalness: .1, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide }), lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f6ff, emissiveIntensity: 1.4 }) };
  const uvb = (w, h, d, u) => { const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, n = g.attributes.normal; for (let i = 0; i < uv.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)); uv.setXY(i, uv.getX(i) * (ax > .5 ? d : w) / u, uv.getY(i) * (ay > .5 ? d : h) / u); } return g; };
  const add = (m, a, b, y1, y2, c, d, solid, par = root) => { const g = new THREE.Mesh(uvb(b - a, y2 - y1, d - c, m === mat.terr ? 2.4 : 2.5), m); g.position.set((a + b) / 2, (y1 + y2) / 2, (c + d) / 2); g.receiveShadow = true; g.castShadow = true; par.add(g); if (solid) col.push({ x1: a, x2: b, z1: c, z2: d, y1, y2 }); };
  add(mat.terr, x1, x2, y - .25, y, z1, z2); add(mat.conc, x1 - .2, x2 + .2, y + 2.9, y + 3.15, z1, z2);
  [x1 - .1, x2].forEach(x => { add(mat.conc, x, x + .1, y, y + .6, z1, z2, true); add(mat.glass, x + .04, x + .06, y + .6, y + 2.85, z1, z2, true); const n = Math.round((z2 - z1) / 2); for (let k = 0; k <= n; k++) { const z = z1 + k * (z2 - z1) / n; add(mat.alu, x, x + .1, y + .6, y + 2.9, z - .04, z + .04); } });
  for (let z = z1 + 1.5; z < z2 - 1; z += 3) { add(mat.lamp, (x1 + x2) / 2 - .6, (x1 + x2) / 2 + .6, y + 2.86, y + 2.9, z - .15, z + .15); lights.push({ x: (x1 + x2) / 2, y: y + 2.7, z }); }
  // 구름다리 구조: 바닥 밑 보 · 기둥 (늘 보이게 따로 묶는다 — 실내 겉모습을 다른 것으로 바꿔도 남는다)
  const support = new THREE.Group(); support.name = 'REBUILD_BRIDGE_SUPPORT';
  if (y > .5) { add(mat.conc, x1 - .3, x2 + .3, y - .6, y - .25, z1, z2, false, support);
    for (const z of [z1 + 1.2, (z1 + z2) / 2, z2 - 1.2]) for (const x of [x1 - .1, x2 + .1]) add(mat.conc, x - .22, x + .22, 0, y - .6, z - .22, z + .22, true, support); }
  const id = (x, z) => [x, z];
  return { root, support, col, walk, lights, toLocal: id, toWorld: id, groundAt: (x, z, feet) => (x >= x1 && x <= x2 && z >= z1 && z <= z2 && Math.abs(feet - y) < .5) ? y : null, props: [], doors: [], tickDoors() {}, nearDoor() { return null; }, models: [], name: '연결 통로' };
}
