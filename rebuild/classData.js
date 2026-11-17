// 학급 데이터 (2008학년도 2학기 · 제7차 교육과정): 반마다 다른 학생 명렬 · 담임 · 교과 담당 · 주간 시간표 — 시드 고정이라 늘 같은 결과.
//   1학년 = 국민공통기본교육과정 (국어 · 수학 · 영어 · 사회 · 국사 · 과학 · 도덕 · 체육 · 음악 · 미술 · 기술·가정 · 한문 + 재량 · 특활)
//   2 · 3학년 = 선택중심교육과정 (인문 · 사회 과정 = 문과 1~3반 / 자연 과정 = 이과 4~5반)
//   월~금 7교시 + 토요일 4교시 (2008년 = 격주 주5일 수업제: 둘째 · 넷째 토요일 휴업). 3학년은 0교시 · 야간 자율학습.
// 학생 이름: 1990~1992년생에 흔한 성 · 이름 조합. 이야기 속 인물 · 실존 유명인 이름은 쓰지 않는다 (반장 녹음 테이프의 2008 반장만 그 반에 둔다).

const hashStr = s => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h || 1; };
const rng = seed => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const pickW = (r, list) => { let t = 0; for (const [, w] of list) t += w; let x = r() * t; for (const [v, w] of list) if ((x -= w) < 0) return v; return list[0][0]; };

// 성씨 (통계청 빈도 비율 근사)
const SUR = [['김', 21.5], ['이', 14.7], ['박', 8.4], ['최', 4.7], ['정', 4.4], ['강', 2.3], ['조', 2.1], ['윤', 2.1], ['장', 2], ['임', 1.7], ['한', 1.5], ['오', 1.5], ['서', 1.4], ['신', 1.4], ['권', 1.4],
  ['황', 1.4], ['안', 1.4], ['송', 1.3], ['전', 1.1], ['홍', 1.1], ['유', 1.1], ['고', .9], ['문', .9], ['양', .9], ['손', .9], ['배', .8], ['백', .7], ['허', .6], ['남', .6], ['노', .5], ['하', .5], ['심', .5], ['곽', .4], ['성', .4], ['차', .4], ['주', .4], ['우', .4], ['구', .4], ['민', .3], ['진', .3], ['나', .3], ['류', .3]];
const BOY = ['지훈', '성민', '현우', '준호', '동현', '재현', '준영', '성훈', '상현', '승현', '민석', '현석', '정훈', '승민', '우진', '태현', '진우', '민재', '영민', '재훈', '동욱', '민호', '성진', '종현', '준혁',
  '상훈', '진혁', '승우', '경민', '용준', '대현', '원석', '기현', '형준', '석진', '주원', '재민', '현수', '동훈', '태훈', '민규', '정민', '성우', '지성', '영준', '인호', '세훈', '동민', '건우', '준수', '창민', '병철', '광수', '재영', '호준', '선우'];
const GIRL = ['지은', '수진', '혜진', '지혜', '은지', '지현', '민지', '유진', '수연', '지영', '은영', '미영', '혜원', '보람', '슬기', '다혜', '아름', '나영', '은정', '선영', '지수', '민정', '현정', '수빈', '예진',
  '하나', '소연', '정은', '은비', '가영', '유리', '혜민', '다영', '세영', '은혜', '지연', '미진', '효진', '주희', '한나', '진아', '연주', '수정', '희정', '윤정', '보미', '경은', '다은', '소희', '혜수', '은주', '선희'];
// 이야기 인물 · 실존 유명인 (무작위 생성 금지)
const BAN = new Set(['윤하늘', '정은수', '이준호', '서다은', '최동혁', '박종철', '임소연', '한석규', '강태식', '권오현', '오유진', '박지훈', '윤서경', '박정우', '김순례', '박민아', '김서연', '송지혜', '하정숙', '최순덕',
  '문정희', '배만수', '이수아', '노태수', '오석진', '김민수', '이서연', '최유진', '강도윤', '조수아', '윤재현', '장예린', '임태호', '한소영', '장동건', '한지민', '오세훈', '김연아', '박지성', '이승기', '김태희', '송혜교',
  '전지현', '김희선', '이효리', '문근영', '박태환', '이대호', '류현진', '이승엽', '김연경', '손예진', '하지원', '김수현', '이민호', '김현중', '정용화', '김종국', '유재석', '강호동', '이명박', '노무현', '박근혜', '김대중',
  '김영삼', '문재인', '윤석열', '이재명', '안철수', '김정은', '김정일', '정우성', '이병헌', '송강호', '김혜수', '이영애', '고소영', '전도연', '김하늘', '박신혜', '김유정', '이지은', '이지아', '김태현', '정준호', '최지우', '이병철', '정주영', '이순신', '안중근', '김구', '유관순', '이건희', '정몽구', '구본무', '최태원', '신동빈', '김진표', '이회창', '정동영', '손학규', '이해찬', '한명숙', '박정희', '김문수', '김경수', '이정희', '김정희', '이명수', '김영수', '정호영', '김종훈', '이영미', '박영수', '김경희', '이미숙', '김현숙', '박명수', '정형돈', '김성호', '이성호']);
// 선생님 이름 (1950~1970년대생)
const TBOY = ['정호', '영수', '성호', '상철', '재식', '명수', '기태', '동수', '종훈', '승철', '경수', '병훈', '진호', '용석', '형석', '광호', '문수', '인규', '석환', '창호'], TGIRL = ['미숙', '은숙', '정희', '영미', '현숙', '경희', '미정', '은경', '혜경', '선미', '지숙', '윤희', '명희', '순영', '정란', '미경', '숙자', '영란', '혜숙', '은희'];
// 2008 반장 (반장 녹음 테이프 — 그 반에만 둔다)
const LEAD = { '1-1': ['김민수', 'm'], '1-2': ['이서연', 'f'], '1-3': ['박지훈', 'm'], '1-4': ['최유진', 'f'], '1-5': ['강도윤', 'm'], '2-1': ['조수아', 'f'], '2-2': ['윤재현', 'm'], '2-3': ['장예린', 'f'], '2-4': ['임태호', 'm'], '2-5': ['한소영', 'f'] };

const used = new Set();   // 전교에서 같은 이름이 두 번 나오지 않게 (동명이인 없이)
function personName(r, g, old = false) { const L = old ? (g === 'm' ? TBOY : TGIRL) : (g === 'm' ? BOY : GIRL); for (let k = 0; k < 200; k++) { const sn = pickW(r, SUR), n = sn + L[(r() * L.length) | 0]; if (n[1] !== sn && !BAN.has(n) && !used.has(n)) { used.add(n); return n; } } return '김' + (g === 'm' ? '철수' : '영희'); }
const ko = (a, b) => a.localeCompare(b, 'ko');

// 교과 (주당 시수 — 월~금 35칸 + 토 2칸 = 37, 토 3 · 4교시는 특별활동 CA 고정): [이름, 시수, 교과군]
const CUR = {
  g1: [['국어', 5, 'kor'], ['수학', 5, 'math'], ['영어', 5, 'eng'], ['사회', 2, 'soc'], ['국사', 2, 'hist'], ['과학', 4, 'sci'], ['도덕', 2, 'eth'], ['체육', 2, 'pe'], ['음악', 1, 'mus'], ['미술', 1, 'art'],
    ['기술·가정', 3, 'tech'], ['한문', 2, 'chn'], ['재량', 2, 'hr'], ['HR', 1, 'hr']],
  g2h: [['문학', 4, 'kor'], ['독서', 2, 'kor2'], ['작문', 2, 'kor2'], ['수학Ⅰ', 5, 'math'], ['영어Ⅰ', 5, 'eng'], ['한국지리', 3, 'geo'], ['한국근현대사', 3, 'hist'], ['윤리와사상', 2, 'eth'], ['사회·문화', 2, 'soc'],
    ['생물Ⅰ', 2, 'bio'], ['체육', 2, 'pe'], ['음악', 1, 'mus'], ['미술', 1, 'art'], ['$2', 2, 'l2'], ['HR', 1, 'hr']],
  g2s: [['문학', 4, 'kor'], ['독서', 2, 'kor2'], ['수학Ⅰ', 5, 'math'], ['수학Ⅱ', 3, 'math2'], ['영어Ⅰ', 5, 'eng'], ['물리Ⅰ', 3, 'phy'], ['화학Ⅰ', 3, 'chem'], ['생물Ⅰ', 2, 'bio'], ['지구과학Ⅰ', 2, 'earth'],
    ['한국지리', 1, 'geo'], ['체육', 2, 'pe'], ['음악', 1, 'mus'], ['미술', 1, 'art'], ['$2', 2, 'l2'], ['HR', 1, 'hr']],
  g3h: [['독서', 3, 'kor'], ['작문', 2, 'kor2'], ['문학', 2, 'kor2'], ['미적분과통계기본', 4, 'math'], ['영어Ⅱ', 4, 'eng'], ['독해와작문', 2, 'eng2'], ['경제', 2, 'econ'], ['법과사회', 2, 'law'], ['세계사', 3, 'world'],
    ['윤리와사상', 2, 'eth'], ['사회·문화', 2, 'soc'], ['한국지리', 2, 'geo'], ['체육', 2, 'pe'], ['미술', 1, 'art'], ['$2', 2, 'l2'], ['재량', 1, 'hr'], ['HR', 1, 'hr']],
  g3s: [['독서', 3, 'kor'], ['작문', 2, 'kor2'], ['수학Ⅱ', 4, 'math'], ['미분과적분', 4, 'math2'], ['영어Ⅱ', 4, 'eng'], ['독해와작문', 2, 'eng2'], ['물리Ⅱ', 3, 'phy'], ['화학Ⅱ', 3, 'chem'], ['생물Ⅱ', 3, 'bio'],
    ['지구과학Ⅰ', 2, 'earth'], ['체육', 2, 'pe'], ['음악', 1, 'mus'], ['재량', 1, 'hr'], ['$2', 2, 'l2'], ['HR', 1, 'hr']],
};
// 칸에 적는 줄임말 (2008 교실 시간표 손글씨 관행)
const SHORT = { '기술·가정': '기가', '한국근현대사': '근현대', '윤리와사상': '윤사', '사회·문화': '사문', '한국지리': '한지', '지구과학Ⅰ': '지구Ⅰ', '미적분과통계기본': '미통기', '독해와작문': '독작', '법과사회': '법사',
  '미분과적분': '미적', 'HR': '학급', '재량': '재량', '일본어Ⅰ': '일어Ⅰ', '중국어Ⅰ': '중어Ⅰ' };
export const shortSubj = s => SHORT[s] || s;

// 교과별 선생님 (학년 · 교과군마다 2~3명, 반마다 다르게 배정) — 담임은 자기 반 교과 하나를 맡는다
const tPool = new Map();
function teachers(grade, grp) { const k = grade + ':' + grp; if (tPool.has(k)) return tPool.get(k);
  const r = rng(hashStr('T' + k)), n = ['pe', 'mus', 'art', 'hr', 'tech', 'chn', 'l2', 'econ', 'law'].includes(grp) ? 1 : grp === 'kor' || grp === 'math' || grp === 'eng' ? 3 : 2;
  const a = []; for (let i = 0; i < n; i++) a.push(personName(r, r() < .55 ? 'f' : 'm', true)); tPool.set(k, a); return a; }

function schedule(cls, list) {   // 37칸 (월~금 7 + 토 1 · 2교시)에 시수대로 — 하루 같은 과목 한 번(5시수 과목은 토요일 포함), 체육 · 음악 · 미술은 오후 쪽이 많다
  for (let attempt = 0; attempt < 60; attempt++) {
    const r = rng(hashStr('TT' + cls + ':' + attempt)), days = [0, 1, 2, 3, 4, 5].map(d => ({ cap: d < 5 ? 7 : 2, subj: [] }));
    const occ = []; list.forEach(([s, n]) => { for (let i = 0; i < n; i++) occ.push(s); });
    const order = [...new Set(occ)].sort((a, b) => occ.filter(x => x === b).length - occ.filter(x => x === a).length || r() - .5);
    let ok = true;
    for (const s of order) { let n = occ.filter(x => x === s).length;
      while (n--) { const cand = days.map((d, i) => i).filter(i => days[i].subj.length < days[i].cap && !days[i].subj.includes(s) && !(s === 'HR' && i === 5));
        if (!cand.length) { ok = false; break; } cand.sort((a, b) => (days[a].subj.length / days[a].cap) - (days[b].subj.length / days[b].cap) + (r() - .5) * .5); days[cand[0]].subj.push(s); }
      if (!ok) break; }
    if (!ok) continue;
    return days.map((d, i) => { const a = d.subj.slice();
      for (let k = a.length - 1; k > 0; k--) { const j = (r() * (k + 1)) | 0; [a[k], a[j]] = [a[j], a[k]]; }
      const late = s => /^(체육|음악|미술|HR|재량)$/.test(s) ? 1 : 0; a.sort((x, y) => late(x) - late(y) || 0);   // 예체능 · 학급 활동은 뒤로
      if (a.includes('HR')) { a.splice(a.indexOf('HR'), 1); a.push('HR'); }   // 학급회의는 그날 마지막 교시
      if (i === 5) a.push('CA', 'CA');
      return a; });
  }
  throw new Error('timetable ' + cls);
}

const cache = new Map();
// classInfo('3학년 2반') 또는 classInfo(3, 2)
export function classInfo(gradeOrName, num) {
  let grade = gradeOrName, cls = num; if (typeof gradeOrName === 'string') { const m = /(\d)학년\s*(\d+)반/.exec(gradeOrName); if (!m) return null; grade = +m[1]; cls = +m[2]; }
  if (!cache.size) for (let g = 1; g <= 3; g++) for (let c = 1; c <= 5; c++) make(g, c);   // 전교 이름 중복을 막으려면 늘 같은 순서로 만든다
  return cache.get(grade + '-' + cls) || make(grade, cls);
}
function make(grade, cls) {
  const key = grade + '-' + cls; if (cache.has(key)) return cache.get(key);
  const r = rng(hashStr('CLS' + key)), track = grade === 1 ? null : cls <= 3 ? '인문' : '자연';
  const lang2 = grade === 1 ? null : (cls % 2 ? '일본어Ⅰ' : '중국어Ⅰ');
  const list = (grade === 1 ? CUR.g1 : grade === 2 ? (track === '인문' ? CUR.g2h : CUR.g2s) : (track === '인문' ? CUR.g3h : CUR.g3s)).map(([s, n, grp]) => [s === '$2' ? lang2 : s, n, grp]);
  // 학생 명렬: 남 17~19 · 여 16~18 (합반), 번호는 남학생 먼저 가나다순 (2008 관행)
  const nb = 17 + ((r() * 3) | 0), ng = 16 + ((r() * 3) | 0), lead = LEAD[key];
  const boys = [], girls = []; if (lead) { used.add(lead[0]); (lead[1] === 'm' ? boys : girls).push(lead[0]); }
  while (boys.length < nb) boys.push(personName(r, 'm')); while (girls.length < ng) girls.push(personName(r, 'f'));
  boys.sort(ko); girls.sort(ko);
  const students = [...boys.map(n => ({ name: n, g: 'm' })), ...girls.map(n => ({ name: n, g: 'f' }))].map((s, i) => ({ ...s, no: i + 1 }));
  // 교과 담당: 학년 교사 풀에서 반 번호로 돌려 배정
  const subjT = {}; list.forEach(([s, , grp]) => { if (s === 'HR' || s === '재량') return; const p = teachers(grade, grp); subjT[s] = p[(cls + grp.length) % p.length]; });
  const homeroom = key === '3-2' ? '정은수' : (() => { const pool = Object.keys(subjT).filter(s => !/체육|음악|미술/.test(s)); for (let k = 0; k < pool.length; k++) { const s = pool[(cls * 3 + k) % pool.length], t = subjT[s]; if (![...cache.values()].some(c => c.homeroom === t)) return t; } return personName(r, 'f'); })();
  const homeSubj = key === '3-2' ? '문학' : Object.keys(subjT).find(s => subjT[s] === homeroom);
  if (key === '3-2') { subjT['문학'] = '정은수'; }
  subjT.HR = subjT['재량'] = homeroom; subjT.CA = '동아리';
  const days = schedule(key, list);
  const leader = lead ? lead[0] : students[(r() * students.length) | 0].name;
  const info = { grade, cls, key, label: `${grade}학년 ${cls}반`, track, lang2, students, homeroom, homeSubj, subjT, days, leader, subjects: list };
  cache.set(key, info); return info;
}
export const DAYS = ['월', '화', '수', '목', '금', '토'];
export const PERIOD_TIME = ['08:50', '09:50', '10:50', '11:50', '13:30', '14:30', '15:30'];
// 주번 (10월 둘째 주): 번호 두 명
export const weekDuty = info => { const n = info.students.length, a = (info.cls * 7 + 11) % n; return [info.students[a].name, info.students[(a + 1) % n].name]; };
// 청소 당번 구역: 6개 모둠
export function cleaningRota(info) { const st = info.students, out = [], area = ['교실 바닥', '칠판 · 교탁', '복도 · 창틀', '화장실', '분리수거', '특별실'], per = Math.ceil(st.length / area.length);
  area.forEach((a, i) => out.push([a, st.slice(i * per, i * per + per)])); return out; }
