// 스마트 사물 (2008 공립 고교 본관 · 별관) — 상태를 가진 가구 · 소품 · 기기와 「조사 노트 · 단서 보드」
//   · 기존 'look' 조사 시스템(world.props · E 키 · 프롬프트)을 그대로 쓴다. 프롬프트 라벨에 사물 상태(켜짐/꺼짐 · 열림/닫힘)를 붙인다.
//   · 사물마다 상태(켜짐 · 채널 · 열람한 서랍 · 칠판 글씨)를 저장한다 — 세이브 'smart' 키 (버전 · 옛 세이브는 빈 상태로)
//   · 내용은 방 이름 + 사물 번호로 시드를 잡아 판마다 같다 (random-but-seeded)
//   · 이야기 진행(얻은 단서) · 전력 복구 · 게임 속 시각 · 민아의 감정(window.__mina — 있으면)에 따라 설명이 달라진다
//   · 메시는 방 가까이 갔을 때 처음 만든다(lazy) · 멀어지면 숨긴다. 충돌 상자는 처음부터 (보행 · 도달성 감사가 같은 세계를 보도록)
// 순수 함수(시드 · 단서 연결 추론 · 상태 직렬화)는 DOM/THREE 없이 node 테스트에서 바로 검증한다.

import { pickRoomEvent, shouldFire, ROOM_EVENTS } from './roomEvents.js?v=458';
export { pickRoomEvent, shouldFire, ROOM_EVENTS };
export const SMART_VERSION = 1;

// ── 시드 난수 ──
export function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ── 4개 언어 문자열 [ko, en, ja, zh] ──
const LI = { ko: 0, en: 1, ja: 2, zh: 3 };
export const S = {
  on: ['켜짐', 'on', 'オン', '开'], off: ['꺼짐', 'off', 'オフ', '关'], open: ['열림', 'open', '開', '开着'], closed: ['닫힘', 'closed', '閉', '关着'], nopower: ['전원 없음', 'no power', '電源なし', '无电'],
  look: ['살펴보기', 'examine', '調べる', '查看'], turnOn: ['켜기', 'turn on', 'つける', '打开'], turnOff: ['끄기', 'turn off', '消す', '关掉'], read: ['읽기', 'read', '読む', '阅读'], write: ['글씨 쓰기', 'write', '書く', '写字'],
  cabinet: ['철제 캐비닛', 'Steel cabinet', 'スチール書庫', '铁皮柜'], pc: ['교무 PC (학교 인트라넷)', 'Staff PC (school intranet)', '職員PC（校内イントラ）', '教务电脑（校内网）'], tv: ['브라운관 TV', 'CRT television', 'ブラウン管テレビ', '显像管电视'],
  radio: ['라디오', 'Radio', 'ラジオ', '收音机'], phone: ['교내 전화기', 'School phone', '校内電話', '校内电话'], intercom: ['인터폰', 'Intercom', 'インターホン', '对讲机'], clock: ['벽시계', 'Wall clock', '掛け時計', '挂钟'],
  board: ['화이트보드', 'Whiteboard', 'ホワイトボード', '白板'], fan: ['선풍기', 'Electric fan', '扇風機', '电风扇'], blinds: ['블라인드', 'Blinds', 'ブラインド', '百叶窗'], vending: ['음료 자판기', 'Drink machine', '自販機', '饮料机'],
  fountain: ['음수대', 'Drinking fountain', '水飲み場', '饮水台'], piano: ['업라이트 피아노', 'Upright piano', 'アップライトピアノ', '立式钢琴'], microscope: ['현미경', 'Microscope', '顕微鏡', '显微镜'], book: ['책', 'Book', '本', '书'],
  shelf: ['책장', 'Bookcase', '本棚', '书架'], plant: ['화분', 'Potted plant', '鉢植え', '盆栽'], metronome: ['메트로놈', 'Metronome', 'メトロノーム', '节拍器'], trophy: ['트로피 진열장', 'Trophy case', 'トロフィー棚', '奖杯柜'],
  ch: ['채널', 'ch', 'ch', '频道'], board_t: ['조사 노트 · 단서 보드', 'Case notes · Evidence board', '調査ノート・手がかりボード', '调查笔记・线索板'], close: ['닫기', 'Close', '閉じる', '关闭'],
  links: ['연결', 'Connections', 'つながり', '关联'], contra: ['모순', 'Contradictions', '矛盾', '矛盾'], sugg: ['다음에 볼 곳', 'Where to look next', '次に調べる場所', '下一步去哪'], items: ['조사한 사물 · 단서', 'Examined objects · clues', '調べた物・手がかり', '调查过的物品・线索'],
  empty: ['아직 기록이 없습니다. 사물을 조사하면 여기에 쌓입니다.', 'Nothing yet. Examine objects to fill this board.', 'まだ記録がない。物を調べるとここに溜まる。', '还没有记录。调查物品后会记在这里。'],
  shared: ['공통', 'shared', '共通', '共同'], mentioned: ['번 언급 · 아직 조사 안 함', 'mentions · not examined yet', '回言及・未調査', '次提及・尚未调查'],
  inspect: ['자세히 보기', 'Inspect', 'じっくり見る', '仔细看'], rotHint: ['드래그 · 방향키로 돌리기 · 휠/＋－ 확대', 'Drag / arrows to rotate · wheel / +- to zoom', 'ドラッグ・矢印で回転・ホイール/＋－で拡大', '拖动/方向键旋转・滚轮/＋－缩放'],
  clear: ['지우기', 'Erase', '消す', '擦掉'], done: ['완료', 'Done', '完了', '完成'], deleted: ['[삭제된 게시물입니다]', '[This post has been deleted]', '[この投稿は削除されました]', '[该帖子已被删除]'],
  intranet: ['서린고 교내 통신망 — 자유게시판', 'Seorin High intranet — open board', 'ソリン高校内ネット — 自由掲示板', '瑞林高中校内网 — 自由留言板'], boardKey: ['단서 보드 (N)', 'Evidence board (N)', '手がかりボード (N)', '线索板 (N)'],
  mina: ['민아', 'Mina', 'ミナ', '敏雅'], drawer: ['서랍', 'drawer', '引き出し', '抽屉'], emptyDr: ['비어 있다.', 'Empty.', '空だ。', '空的。'],
};
export const tl = (k, lg = 'ko') => { const e = S[k]; return e ? e[LI[lg] ?? 0] : k; };
const pick4 = (a, lg) => Array.isArray(a) ? a[LI[lg] ?? 0] ?? a[0] : a;

// ── 조사 대상 사물 설명 (4개 언어) · 태그 ──
// 서랍 · 캐비닛 내용물 풀 — 시드로 고른다. 각 항목: [ko,en,ja,zh, tags]
export const DRAWER_POOL = [
  ['2008학년도 2학기 시간표 복사본. 금요일 7교시 칸에 “방송부 — 취소”라고 볼펜으로 적혀 있다.', 'A copy of the 2008 fall timetable. Friday 7th period: "Broadcast club — cancelled" in pen.', '2008年度2学期の時間割のコピー。金曜7限に「放送部 — 中止」とペン書き。', '2008学年第二学期课表复印件。周五第七节写着“广播社——取消”。', ['bcast']],
  ['빈 카세트 테이프 케이스 두 개. 라벨: “리허설 B면 — 손대지 말 것”.', 'Two empty cassette cases. Label: "Rehearsal side B — do not touch".', '空のカセットケースが二つ。ラベル「リハーサルB面 — 触るな」。', '两个空磁带盒。标签：“彩排B面——别碰”。', ['bcast', '1012']],
  ['구겨진 가정통신문 — “10월 12일 야간 자율학습 없음”.', 'A crumpled parent letter — "No night study on Oct 12".', 'くしゃくしゃの家庭通信 — 「10月12日 夜間自習なし」。', '揉皱的家长通知——“10月12日无晚自习”。', ['1012']],
  ['열쇠고리만 남은 열쇠 꾸러미 고리. 꼬리표 끈에 “B-0…”까지만 읽힌다.', 'An empty key ring. The tag string reads only "B-0…".', '鍵のない鍵束の輪。タグには「B-0…」までしか読めない。', '只剩钥匙圈。标签上只看得清“B-0…”。', ['b1', 'staff']],
  ['도서 대출 카드 묶음. 맨 위 카드의 “반납” 도장만 잉크 색이 다르다.', 'A stack of library cards. The "returned" stamp on the top one is a different ink.', '図書貸出カードの束。一番上の「返却」印だけインクの色が違う。', '一叠借书卡。最上面那张的“已还”章墨色不同。', ['library', 'haneul']],
  ['건전지 하나와 고무줄, 다 쓴 볼펜 세 자루.', 'One battery, a rubber band, three dead pens.', '電池一本と輪ゴム、インク切れのボールペン三本。', '一节电池、橡皮筋、三支没水的圆珠笔。', []],
  ['출석부 사본. 3학년 2반 윤하늘 — 10월 13일부터 “전학” 도장.', 'Attendance copy. Class 3-2, Yoon Ha-neul — "transferred" stamp from Oct 13.', '出席簿の写し。3年2組ユン・ハヌル — 10月13日から「転校」印。', '点名册复印件。三年二班尹夏娜——10月13日起盖“转学”章。', ['haneul', '1012']],
  ['교무부 회의록 한 장. “펌프실 점검 — 다음 학기로 연기” 줄에 형광펜.', 'A page of staff minutes. "Pump room inspection — postponed" is highlighted.', '教務部会議録の一枚。「ポンプ室点検 — 来学期に延期」に蛍光ペン。', '一页教务会议记录。“泵房检修——推迟到下学期”被荧光笔划出。', ['pump', 'vp']],
  ['경비실 무전기 충전 일지. 1998년 10월 12일 칸만 찢겨 있다.', 'A guard radio charging log. The Oct 12, 1998 row is torn out.', '警備室無線の充電日誌。1998年10月12日の欄だけ破られている。', '门卫对讲机充电日志。1998年10月12日那格被撕掉了。', ['guard', '1012']],
  ['사진부 밀착 인화지 한 장 — 방송실 창문에 비친 손전등 불빛.', 'A photo club contact sheet — a flashlight glinting in the broadcast room window.', '写真部のベタ焼き — 放送室の窓に映る懐中電灯の光。', '摄影社的印样——广播室窗上映着手电光。', ['bcast']],
  ['“별관 전기 — 본관과 계통 분리 (1997 공사)” 라고 적힌 도면 쪽.', 'A plan sheet: "Annex power — separate circuit from main building (1997 works)".', '「別館電気 — 本館と系統分離（1997工事）」と書かれた図面。', '一页图纸：“别馆供电——与本馆分开（1997年施工）”。', ['annex', 'elec']],
  ['수학 쪽지시험지 한 묶음. 맨 아래 장 뒷면에 “다은아 미안” 이라는 낙서.', 'A bundle of math quizzes. On the back of the last: "Sorry, Da-eun".', '数学の小テストの束。最後の一枚の裏に「ダウン、ごめん」の落書き。', '一叠数学小测卷。最后一张背面写着“多恩，对不起”。', ['daeun']],
];
export function drawerContents(seedKey, n = 2) {
  const r = rng(hashStr(seedKey)), idx = new Set(); let guard = 0;
  while (idx.size < n && guard++ < 50) idx.add(Math.floor(r() * DRAWER_POOL.length));
  return [...idx];
}

// 2008년 방송 (TV · 라디오) — 상표 · 실명 없음
const BROADCAST = [
  ['[9시 뉴스] 원·달러 환율이 하루 새 크게 올랐습니다… 금융 위기 여파가 계속되고 있습니다.', '[9 o\'clock news] The won-dollar rate jumped again today… the financial crisis continues.', '［9時ニュース］ウォン・ドル相場が一日で大きく上昇… 金融危機の余波が続いています。', '［九点新闻］韩元兑美元汇率一天内大幅上涨……金融危机的余波仍在持续。'],
  ['[일기예보] 내일 아침 올가을 들어 가장 쌀쌀하겠습니다. 수험생 여러분 감기 조심하세요.', '[Weather] Tomorrow morning will be the coldest this fall. Exam takers, watch out for colds.', '［天気予報］明日の朝はこの秋一番の冷え込み。受験生の皆さん風邪に注意。', '［天气预报］明早将是今秋最冷。考生们注意别感冒。'],
  ['[교육 방송] 수능 D-34, 언어 영역 마무리 특강… 비문학 지문은 첫 문단에서…', '[Edu channel] CSAT D-34, Korean language wrap-up… for non-fiction passages, the first paragraph…', '［教育放送］修能D-34、国語仕上げ講座… 非文学は最初の段落で…', '［教育频道］高考倒计时34天，语文冲刺……非文学阅读先看第一段……'],
  ['[스포츠] 올림픽 금메달의 여운… 대표팀 선수들이 모교를 찾았습니다.', '[Sports] Still glowing from the summer Olympic gold… the national team visited their old schools.', '［スポーツ］夏の五輪金メダルの余韻… 代表選手たちが母校を訪問。', '［体育］夏季奥运金牌余温未散……国家队队员回到母校。'],
  ['[심야 라디오] 다음 사연입니다. “10년 전 오늘, 친구가 집에 오지 않았어요…” …지직.', '[Late-night radio] Next letter: "Ten years ago today, my friend never came home…" …kzzt.', '［深夜ラジオ］次のお便りです。「10年前の今日、友達が帰ってこなかった…」…ザザッ。', '［深夜电台］下一封来信：“十年前的今天，朋友没有回家……”……滋滋。', ['1012']],
  ['[가요 순위] 이번 주 1위 곡이 흘러나온다. 후렴만 몇 번이고 반복된다.', '[Music chart] This week\'s No.1 plays. The chorus loops again and again.', '［歌謡ランキング］今週の1位曲が流れる。サビばかり繰り返す。', '［歌曲排行］本周第一名的歌在放，副歌一遍又一遍。'],
];

// 교내 인트라넷 게시판 (2008) — need: 그 단서를 알아야 보이는 글
export const POSTS = [
  { d: '2008.10.06', a: '교무부', t: ['[공지] 개교 기념일(10.12) 행사 안내', '[Notice] Founding day (10/12) events', '［お知らせ］開校記念日(10.12)行事', '［通知］校庆日(10.12)活动安排'], b: ['올해는 방송부 창립 40주년. 기념 방송은 하지 않습니다. 문의는 교무부로.', 'Broadcast club\'s 40th anniversary this year. No memorial broadcast. Ask the staff office.', '今年は放送部創立40周年。記念放送は行いません。教務部まで。', '今年是广播社成立40周年。不做纪念广播。详询教务部。'], tags: ['1012', 'bcast', 'staff'] },
  { d: '2008.10.08', a: '시설', t: ['[시설] 본관 분전반 교체 공사', '[Facilities] Main building breaker panel replacement', '［施設］本館分電盤の交換工事', '［设施］本馆配电盘更换工程'], b: ['10.11~12 본관 전원 수시 차단. 별관은 별도 계통이라 영향 없음. 지하 B1 전기실 출입 금지.', 'Main building power cut on and off 10/11–12. Annex is on a separate circuit. B1 electrical room off limits.', '10.11〜12 本館電源を随時遮断。別館は別系統で影響なし。地下B1電気室は立入禁止。', '10.11~12 本馆随时断电。别馆是独立线路不受影响。地下B1电气室禁止入内。'], tags: ['elec', 'annex', 'b1'] },
  { d: '2008.10.09', a: '익명', need: 'n21', t: ['[자유] 98년 방송부 리허설 얘기 아는 사람?', '[Free] Anyone know about the \'98 broadcast rehearsal?', '［自由］98年の放送部リハーサルの話、知ってる人？', '［自由］有人知道98年广播社彩排的事吗？'], b: ['선배한테 들었는데 그날 밤 리허설 끝나고 한 명이 집에 못 갔대. 학교는 전학 갔다고 했고.', 'A senior told me someone never got home after that night\'s rehearsal. The school said she transferred.', '先輩から聞いたけど、あの夜リハーサルの後、一人が家に帰れなかったって。学校は転校したと。', '听学长说那晚彩排后有一个人没回家。学校说她转学了。'], tags: ['bcast', 'haneul', '1012'] },
  { d: '2008.10.10', a: '도서실', need: 'n25', t: ['[도서] 연체 도서 일괄 정리', '[Library] Overdue books cleared', '［図書］延滞図書の一括整理', '［图书］逾期图书统一清理'], b: ['1998년 이전 연체 기록은 전산 이관 때 “반납”으로 일괄 처리합니다. 『집으로 가는 길』 포함.', 'Pre-1998 overdue records will be bulk-marked "returned" in the migration. Incl. "The Way Home".', '1998年以前の延滞記録は電算移行時に一括「返却」扱い。『家へ帰る道』含む。', '1998年以前的逾期记录在系统迁移时统一标为“已还”。包括《回家的路》。'], tags: ['library', 'haneul'] },
  { d: '2008.10.10', a: '익명', need: 'n27', t: ['[자유] 정은수 선생님 기억하는 분', '[Free] Anyone remember Ms. Jeong Eun-su?', '［自由］チョン・ウンス先生を覚えてる人', '［自由］还记得郑恩秀老师的人'], b: ['98년에 담임하시다 갑자기 전근 가셨다던데. 결석 처리 문제로 교장이랑 싸우셨다고.', 'She was a homeroom teacher in \'98 and was suddenly transferred. Fought the principal over an absence record.', '98年に担任だったのに急に転勤。欠席処理のことで校長と揉めたとか。', '98年当班主任时突然调走了。听说为缺勤处理和校长吵过。'], tags: ['jeong', 'principal'] },
  { d: '2008.10.11', a: '행정실', need: 'h3', t: ['[행정] 별관 야간 전기 사용 내역 정정', '[Admin] Correction: annex night power usage', '［行政］別館夜間電力使用の訂正', '［行政］别馆夜间用电记录更正'], b: ['1998.10.12 별관 3층 사용 기록은 “기록 오류”로 삭제 처리함.', 'The 1998-10-12 annex 3F usage record is deleted as a "logging error".', '1998.10.12 別館3階の使用記録は「記録ミス」として削除。', '1998.10.12 别馆三楼使用记录作为“记录错误”删除。'], tags: ['annex', 'principal', '1012'] },
  { d: '2008.10.11', a: '익명', need: 'n23', t: ['[자유] 펌프실 문 열려 있었다던데?', '[Free] Wasn\'t the pump room door open?', '［自由］ポンプ室の扉、開いてたって？', '［自由］听说泵房门是开着的？'], b: ['방송부 선배들은 펌프실 문이 열려 있었다고 하더라. 근데 경비 아저씨는 잠겨 있었다고…', 'The broadcast seniors say the pump room door was open. But the guard said it was locked…', '放送部の先輩はポンプ室の扉が開いていたと。でも警備員さんは鍵がかかってたって…', '广播社学长说泵房门开着。可门卫大叔说是锁着的……'], tags: ['pump', 'guard', 'bcast'] },
];

// 단서 · 사물 글에서 태그(사람 · 장소 · 날짜/시각) 뽑기 — 한국어 원문 기준
export const TAGDEF = {
  haneul: { g: 'p', re: /하늘/, n: ['윤하늘', 'Ha-neul', 'ハヌル', '夏娜'] }, mina: { g: 'p', re: /민아/, n: ['민아', 'Mina', 'ミナ', '敏雅'] }, sua: { g: 'p', re: /수아/, n: ['수아', 'Su-a', 'スア', '秀雅'] },
  daeun: { g: 'p', re: /다은/, n: ['다은', 'Da-eun', 'ダウン', '多恩'] }, junho: { g: 'p', re: /준호/, n: ['이준호', 'Jun-ho', 'ジュノ', '俊浩'] }, vp: { g: 'p', re: /교무부장/, n: ['교무부장', 'Head of academics', '教務部長', '教务部长'] },
  principal: { g: 'p', re: /교장(?!실)|교장실/, n: ['교장', 'Principal', '校長', '校长'] }, guard: { g: 'p', re: /경비/, n: ['경비원', 'Night guard', '警備員', '门卫'] }, librarian: { g: 'p', re: /사서/, n: ['사서', 'Librarian', '司書', '图书管理员'] },
  jeong: { g: 'p', re: /정은수/, n: ['정은수 선생님', 'Ms. Jeong', 'チョン先生', '郑老师'] },
  bcast: { g: 'l', re: /방송/, n: ['방송실', 'Broadcast room', '放送室', '广播室'] }, pump: { g: 'l', re: /펌프실/, n: ['펌프실', 'Pump room', 'ポンプ室', '泵房'] }, library: { g: 'l', re: /도서|대출/, n: ['도서실', 'Library', '図書室', '图书室'] },
  staff: { g: 'l', re: /교무실|교무부(?!장)/, n: ['교무실', 'Staff office', '職員室', '教务室'] }, annex: { g: 'l', re: /별관/, n: ['별관', 'Annex', '別館', '别馆'] }, pool: { g: 'l', re: /수영장|배수/, n: ['수영장', 'Pool', 'プール', '游泳池'] },
  science: { g: 'l', re: /과학실|약품/, n: ['과학실', 'Science lab', '理科室', '科学教室'] }, gym: { g: 'l', re: /체육관/, n: ['체육관', 'Gym', '体育館', '体育馆'] }, elec: { g: 'l', re: /전기실|분전반|차단기|정전|전원|전기/, n: ['전기 계통', 'Power system', '電気系統', '电力系统'] },
  music: { g: 'l', re: /음악실|피아노|악보/, n: ['음악실', 'Music room', '音楽室', '音乐教室'] }, b1: { g: 'l', re: /지하|B1/, n: ['지하 B1', 'Basement B1', '地下B1', '地下B1'] },
  '1012': { g: 't', re: /10월 12일|1012|10\.12|10\/12/, n: ['10월 12일', 'Oct 12', '10月12日', '10月12日'] }, '2200': { g: 't', re: /밤 ?10시|22:\d\d/, n: ['밤 10시', '10 p.m.', '夜10時', '晚上10点'] },
  '2320': { g: 't', re: /23:2\d/, n: ['23:20 무렵', 'around 23:20', '23:20頃', '23:20左右'] }, '2330': { g: 't', re: /23:3\d/, n: ['23:30 무렵', 'around 23:30', '23:30頃', '23:30左右'] }, '2340': { g: 't', re: /23:4\d|열한 시 사십/, n: ['23:40', '23:40', '23:40', '23:40'] },
};
export function tagsOf(text) { const out = []; if (!text) return out; for (const k in TAGDEF) if (TAGDEF[k].re.test(text)) out.push(k); return out; }
export const tagName = (k, lg = 'ko') => TAGDEF[k] ? pick4(TAGDEF[k].n, lg) : k;

// 장소 이름(방 라벨) → 장소 태그
export function placeTagOfRoom(label) { const t = tagsOf(label || '').filter(k => TAGDEF[k].g === 'l'); return t[0] || null; }

// ── 단서 연결 추론 (규칙 기반) ──
//   entries: [{ id, text(ko 원문), tags?: [] , place?: 조사한 장소 태그 }]
//   · 연결: 사람 · 장소 · 날짜/시각 태그를 공유하는 두 항목 (공유 태그가 많을수록 강하게)
//   · 모순: 같은 장소/사람을 두고 '열려 있었다' ↔ '잠겨 있었다', '집에 갔다/반납' ↔ '집에 못 갔다' 처럼 서로 어긋나는 진술
//   · 제안: 여러 항목에서 언급됐지만 아직 직접 조사한 적 없는 장소 (답은 말하지 않는다)
const CONTRA = [
  { a: /열려 있|열린 |열려있/, b: /잠겨|잠긴|닫혀 있/, on: ['pump', 'bcast', 'b1', 'staff'] },
  { a: /하교|반납|집에 갔|전학/, b: /집에 (가지 )?못|못 갔|돌아오지 않|집에 오지 않/, on: ['haneul'] },
  { a: /멀쩡|불이 켜져|영향 없/, b: /정전|차단|꺼졌/, on: ['annex'] },
];
export function inferLinks(entries, visitedPlaces = []) {
  const E = (entries || []).filter(e => e && e.id).map(e => ({ ...e, tags: [...new Set([...(e.tags || []), ...tagsOf(e.text || '')])] }));
  const links = [], contradictions = [];
  for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
    const A = E[i], B = E[j], sh = A.tags.filter(t => B.tags.includes(t));
    if (sh.length) links.push({ a: A.id, b: B.id, tags: sh, w: sh.length + (sh.some(t => TAGDEF[t] && TAGDEF[t].g === 'p') ? .5 : 0) });
    for (const c of CONTRA) {
      const on = sh.filter(t => c.on.includes(t)); if (!on.length) continue;
      const at = A.text || '', bt = B.text || '';
      if ((c.a.test(at) && c.b.test(bt)) || (c.b.test(at) && c.a.test(bt))) contradictions.push({ a: A.id, b: B.id, tags: on });
    }
  }
  links.sort((x, y) => y.w - x.w || (x.a + x.b < y.a + y.b ? -1 : 1));
  const vis = new Set(visitedPlaces.filter(Boolean)), cnt = {};
  for (const e of E) { if (e.place) vis.add(e.place); for (const t of e.tags) if (TAGDEF[t] && TAGDEF[t].g === 'l') cnt[t] = (cnt[t] || 0) + 1; }
  const suggestions = Object.entries(cnt).filter(([t, n]) => n >= 2 && !vis.has(t)).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 3).map(([place, n]) => ({ place, n }));
  return { links, contradictions, suggestions, tags: Object.fromEntries(E.map(e => [e.id, e.tags])) };
}

// ── 상태 저장 (세이브 'smart' 키) ──
export function emptyState() { return { v: SMART_VERSION, objs: {}, notes: [], visits: {} }; }
export function serializeState(st) {
  const s = st || emptyState(), objs = {};
  for (const k in s.objs) { const o = s.objs[k]; if (!o || typeof o !== 'object') continue; const c = {}; for (const f of ['on', 'ch', 'open', 'n', 'text', 'seen', 'page', 'dr']) if (o[f] != null && o[f] !== false && o[f] !== '') c[f] = o[f]; if (Object.keys(c).length) objs[k] = c; }
  const visits = {}; for (const k in (s.visits || {})) if (Number.isFinite(s.visits[k])) visits[k] = s.visits[k] | 0;
  return { v: SMART_VERSION, objs, visits, notes: (s.notes || []).slice(-200).map(n => ({ id: String(n.id), k: n.k, room: n.room || '', ko: String(n.ko || '').slice(0, 400), tags: (n.tags || []).slice(0, 12), place: n.place || null, t: Math.round(n.t || 0) })) };
}
export function restoreState(raw) {
  const st = emptyState(); if (!raw || typeof raw !== 'object') return st;
  const v = +raw.v || 0; if (v > SMART_VERSION) return st;   // 더 새 버전 세이브는 건드리지 않는다
  const objs = raw.objs && typeof raw.objs === 'object' ? raw.objs : (v === 0 && raw.objects && typeof raw.objects === 'object' ? raw.objects : {});   // v0(시험판) 키 이름
  for (const k in objs) { const o = objs[k]; if (!o || typeof o !== 'object') continue; const c = {};
    if (typeof o.on === 'boolean') c.on = o.on; if (Number.isFinite(o.ch)) c.ch = o.ch | 0; if (typeof o.open === 'boolean') c.open = o.open; if (Number.isFinite(o.n)) c.n = o.n | 0; if (typeof o.text === 'string') c.text = o.text.slice(0, 80);
    if (typeof o.seen === 'boolean') c.seen = o.seen; if (Number.isFinite(o.page)) c.page = o.page | 0; if (Array.isArray(o.dr)) c.dr = o.dr.filter(Number.isFinite).slice(0, 8); st.objs[k] = c; }
  if (raw.visits && typeof raw.visits === 'object') for (const k in raw.visits) if (Number.isFinite(raw.visits[k])) st.visits[k] = raw.visits[k] | 0;
  if (Array.isArray(raw.notes)) for (const n of raw.notes) if (n && n.id != null) st.notes.push({ id: String(n.id), k: n.k || 'obj', room: String(n.room || ''), ko: String(n.ko || ''), tags: Array.isArray(n.tags) ? n.tags.filter(t => typeof t === 'string') : [], place: n.place || null, t: +n.t || 0 });
  return st;
}

// 민아 한마디 — window.__mina 가 있을 때만 (감정 · 상태는 다른 모듈 담당: 모양이 바뀌어도 죽지 않게 읽는다)
const MINA_LINES = {
  scared: [['…빨리 보고 가자. 여기 오래 있기 싫어.', '…Look quick and let\'s go. I don\'t want to stay here.', '…早く見て行こう。ここに長くいたくない。', '……快看完走吧。我不想在这儿久留。'], ['손 떨려서 못 만지겠어. 네가 봐 줘.', 'My hands are shaking. You look.', '手が震えて触れない。見てくれる？', '我手在抖，你来看吧。']],
  sad: [['언니도 이런 걸 만졌겠지… 그날.', 'My sister must have touched things like this… that day.', 'お姉ちゃんもこういうのに触ったのかな…あの日。', '姐姐那天也碰过这种东西吧……'], ['괜찮아. 계속 찾아보자.', 'It\'s okay. Let\'s keep looking.', '大丈夫。探し続けよう。', '没事。继续找吧。']],
  calm: [['이거, 단서 보드에 적어 둘게.', 'I\'ll put this on the evidence board.', 'これ、手がかりボードに書いとくね。', '这个我记到线索板上。'], ['10년 전이랑 똑같네. 아무도 안 치웠어.', 'Same as ten years ago. Nobody cleaned up.', '10年前と同じ。誰も片付けてない。', '和十年前一模一样。没人收拾过。'], ['음… 이건 그날이랑 상관있을까?', 'Hmm… does this have to do with that night?', 'うーん…これ、あの夜と関係あるかな？', '嗯……这跟那晚有关吗？']],
};
export function minaMood(m) {
  if (!m) return null; let e = m.emotion; if (e && typeof e === 'object') e = e.name || e.label || e.state || e.id || ''; e = String(e || m.state || '').toLowerCase();
  if (/fear|scar|afraid|panic|anx|겁|무서|불안/.test(e)) return 'scared'; if (/sad|grief|cry|슬|울/.test(e)) return 'sad'; return 'calm';
}
export function minaLine(m, seedKey, lg = 'ko') { const mood = minaMood(m); if (!mood) return ''; const L = MINA_LINES[mood], r = rng(hashStr(seedKey + mood)); return pick4(L[Math.floor(r() * L.length)], lg); }

// ═════════════════════════════ 브라우저 쪽 ═════════════════════════════
// 방 종류 → 둘 사물 (kind, 벽걸이 여부). 교실 · 방송실은 이미 촘촘해서 건너뛴다.
const ROOM_PLAN = {
  staff: ['pc', 'cabinet', 'phone', 'plant'], nurse: ['radio', 'cabinet'], counsel: ['fan', 'shelf', 'plant'], principal: ['blinds', 'phone', 'trophy'], meeting: ['board', 'plant', 'clock'],
  library: ['pc', 'book', 'shelf'], career: ['cabinet', 'book'], study: ['board', 'clock'], council: ['cabinet', 'radio', 'intercom'], storage: ['shelf'], computer: ['pc', 'pc'],
  avroom: ['tv'], archive: ['cabinet', 'book'], teacher: ['tv', 'fan', 'clock'], club: ['book', 'cabinet'], music: ['piano', 'metronome'], art: ['plant', 'cabinet'], tech: ['cabinet', 'radio'],
  home: ['radio', 'plant'], science: ['microscope', 'cabinet'], prep: ['cabinet'], english: ['tv'], math: ['board'], dance: ['clock', 'fan'], band: ['radio'], history: ['book', 'trophy'], lounge: ['vending', 'fountain', 'tv'],
};
// 크기 [가로(벽 따라), 깊이, 높이] · 벽걸이(wall) · 높이(바닥에서 조사 지점)
const DIM = {
  cabinet: [.9, .45, 1.8, 0, 1.1], pc: [.9, .6, .75, 0, 1.0], tv: [.8, .5, 1.25, 0, 1.1], radio: [.5, .35, .95, 0, .95], phone: [.5, .4, .78, 0, .9], intercom: [.25, .08, 1.5, 1, 1.45], clock: [.34, .06, 2.3, 1, 1.6],
  board: [1.6, .06, 1.95, 1, 1.4], fan: [.45, .45, 1.2, 0, 1.0], blinds: [1.4, .08, 2.3, 1, 1.5], vending: [.9, .75, 1.8, 0, 1.2], fountain: [.6, .45, .95, 0, .95], piano: [1.45, .6, 1.25, 0, 1.0],
  microscope: [.6, .5, 1.05, 0, 1.0], book: [.7, .45, .9, 0, .95], shelf: [.9, .32, 1.8, 0, 1.1], plant: [.45, .45, 1.0, 0, .8], metronome: [.5, .4, .95, 0, .95], trophy: [1.0, .4, 1.6, 0, 1.2],
};
const DBG = { door: 0, foot: 0, stand: 0, ground: 0, used: 0 }; if (typeof window !== 'undefined') window.__smartDbg = DBG;
const TALL = new Set(['cabinet', 'shelf', 'vending', 'trophy']);

export function createSmart() {
  let st = emptyState(), ctx = null, built = false;
  const objs = [];   // { id, kind, b, room, y0, wx, wz, yaw, prop, grp, built }
  const api = {
    get state() { return st; }, objs,
    serialize: () => serializeState(st),
    restore(raw) { st = restoreState(raw); if (built) objs.forEach(o => { syncLabel(o); if (o.grp) applyVisual(o); }); },
    reset() { st = emptyState(); if (built) objs.forEach(o => { syncLabel(o); if (o.grp) applyVisual(o); }); },
    install(c) { if (built) return objs.length; ctx = c; try { place(); } catch (e) { console.warn('[smart]', e); } built = true; startLoop(); hookUI(); return objs.length; },
    openBoard: () => openBoard(), entries: () => boardEntries(), infer: () => inferLinks(boardEntries()),
  };
  const lg = () => (ctx && ctx.lang ? ctx.lang() : 'ko');
  const T = k => tl(k, lg());
  const O = id => (st.objs[id] ||= {});
  const powered = () => !!(ctx && ctx.power && ctx.power());

  // ── 배치 ──
  function place() {
    const { RBG, world } = ctx; if (!RBG || !RBG.BLD) return;
    const deco = RBG.wallDeco || [];
    const usedPts = world.props.filter(p => p.x != null).map(p => ({ x: p.x, z: p.z, y: p.rbY ?? 0 }));
    for (const b of RBG.BLD) {
      if (!b.props || !b.spec || !b.toWorld) continue; const FH = b.spec.FH || 3.6;
      const rooms = b.props.filter(p => p.kind === 'room' && p.label && ROOM_PLAN[p.type]);
      const seenType = {};
      for (const r of rooms) {
        const plan = ROOM_PLAN[r.type]; const y0 = r.floor * FH;
        const rk = `${b.name}:${r.floor}:${r.label}:${seenType[r.type + r.floor] = (seenType[r.type + r.floor] || 0) + 1}`;
        plan.forEach((kind, i) => {
          const spot = findSpot(b, r, y0, kind, usedPts, deco, rk + i); if (!spot) return;
          const id = `so:${rk}:${kind}:${i}`;
          const o = { id, kind, b, room: r, y0, ...spot, grp: null };
          usedPts.push({ x: spot.px, z: spot.pz, y: y0 });
          // 충돌 상자 (건물 지역 좌표) — 벽걸이는 없음
          if (!DIM[kind][3]) { const c = { x1: spot.lx - spot.hx, x2: spot.lx + spot.hx, z1: spot.lz - spot.hz, z2: spot.lz + spot.hz, y1: y0, y2: y0 + DIM[kind][2], smart: true }; (b.col ||= []).push(c); o.col = c; }
          else { const cs = [[spot.lx - spot.hx, spot.lz - spot.hz], [spot.lx + spot.hx, spot.lz + spot.hz]].map(([x, z]) => b.toWorld(x, z)); deco.push({ id: 'SMART_' + id, x1: Math.min(cs[0][0], cs[1][0]), x2: Math.max(cs[0][0], cs[1][0]), z1: Math.min(cs[0][1], cs[1][1]), z2: Math.max(cs[0][1], cs[1][1]), y1: y0 + DIM[kind][2] - .6, y2: y0 + DIM[kind][2] + .4 }); }
          const H = DIM[kind][4];
          o.prop = { kind: 'look', floor: 0, rbY: y0, x: spot.px, z: spot.pz, y: y0 + H, r: 1.5, label: '', fn: () => use(o), n: 0, _rb: true, smart: id };
          world.props.push(o.prop); objs.push(o); syncLabel(o);
        });
      }
    }
    if (RBG.wallDeco !== deco) RBG.wallDeco = deco;
  }
  // 방 벽을 따라 빈자리 찾기: 사물 발자국이 비어 있고 · 문에서 1.9m · 다른 조사 지점에서 1.3m 떨어지고 · 앞에 설 자리가 있는 곳
  function findSpot(b, r, y0, kind, used, deco, seed) {
    const [W, D, , wall] = DIM[kind], R = ctx.RBG, rr = rng(hashStr(seed)), cands = [];
    const walls = [['x1', 1, 0], ['x2', -1, 0], ['z1', 0, 1], ['z2', 0, -1]];
    for (const [w, nx, nz] of walls) {
      if (TALL.has(kind) && nz) continue;   // 키 큰 가구는 옆벽(이웃 방과 맞댄 벽)에만 — 창 · 복도 쪽 벽은 창문 · 문
      const along = nx ? [r.z1 + .9 + W / 2, r.z2 - .9 - W / 2] : [r.x1 + .9 + W / 2, r.x2 - .9 - W / 2];
      for (let t = along[0]; t <= along[1]; t += .45) {
        for (const ins of wall ? [.14, .2] : [.2, .3, .45]) { const lx = nx ? r[w] + nx * (D / 2 + ins) : t, lz = nx ? t : r[w] + nz * (D / 2 + ins);
          cands.push({ lx, lz, nx, nz, k: rr() + ins }); }
      }
    }
    cands.sort((a, c) => a.k - c.k);
    for (const c of cands) {
      const hx = c.nx ? D / 2 : W / 2, hz = c.nx ? W / 2 : D / 2;
      // 문 (지역 좌표)
      if ((b.doors || []).some(d => Math.abs((d.py || 0) - y0) < 1.5 && Math.hypot((d.px ?? 99) - c.lx, (d.pz ?? 99) - c.lz) < 1.9)) { DBG.door++; continue; }
      // 발자국 · 앞 공간
      let bad = false;
      for (const [ax, az] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const [wx, wz] = b.toWorld(c.lx + ax * hx, c.lz + az * hz); if (wall ? false : R.blocked(wx, wz, y0, .06)) { bad = true; break; } }
      if (bad) { DBG.foot++; continue; }
      const sx = c.lx + c.nx * (hx + .75), sz = c.lz + c.nz * (hz + .75), [swx, swz] = b.toWorld(sx, sz);
      if (R.blocked(swx, swz, y0, .32)) { DBG.stand++; continue; } const g = R.groundAt(swx, swz, y0 + .1); if (g == null || Math.abs(g - y0) > .25) { DBG.ground++; continue; }
      // 벽걸이: 그 벽 앞 키 높이까지 가구가 없어야(조사 지점까지 손이 닿게) · 다른 벽 장식과 겹치지 않게
      const [wx, wz] = b.toWorld(c.lx, c.lz), [fx, fz] = b.toWorld(c.lx + c.nx, c.lz + c.nz);
      const px0 = c.lx + c.nx * (hx + .3), pz0 = c.lz + c.nz * (hz + .3), [px, pz] = b.toWorld(px0, pz0);
      if (wall) { const [mx, mz] = b.toWorld(c.lx + c.nx * .35, c.lz + c.nz * .35); if (R.blocked(mx, mz, y0, .2)) continue; const yy = y0 + DIM[kind][2];
        if (deco.some(d => wx > d.x1 - W / 2 - .15 && wx < d.x2 + W / 2 + .15 && wz > d.z1 - W / 2 - .15 && wz < d.z2 + W / 2 + .15 && yy + .4 > d.y1 && yy - .6 < d.y2)) continue; }
      if (used.some(u => Math.abs(u.y - y0) < 1.6 && Math.hypot(u.x - px, u.z - pz) < 1.3)) { DBG.used++; continue; }
      return { lx: c.lx, lz: c.lz, hx, hz, wx, wz, px, pz, yaw: Math.atan2(fx - wx, fz - wz) };
    }
    return null;
  }

  // ── 라벨 (프롬프트에 상태 표시) ──
  function stateText(o) {
    const s = O(o.id), k = o.kind;
    if (['tv', 'radio', 'pc', 'fan'].includes(k)) return !powered() && k !== 'radio' ? T('nopower') : s.on ? T('on') + (k === 'tv' || k === 'radio' ? ` · ${T('ch')} ${(s.ch || 0) + 1}` : '') : T('off');
    if (k === 'cabinet') return s.open ? T('open') : T('closed');
    if (k === 'blinds') return s.open ? T('open') : T('closed');
    if (k === 'board') return s.text ? `“${s.text.slice(0, 12)}${s.text.length > 12 ? '…' : ''}”` : '';
    if (k === 'clock') return ctx.clockText ? ctx.clockText() : '';
    return s.seen ? '✓' : '';
  }
  function verb(o) { const s = O(o.id), k = o.kind; if (['tv', 'radio', 'fan'].includes(k)) return s.on ? T('turnOff') : T('turnOn'); if (k === 'pc' || k === 'book') return T('read'); if (k === 'board') return T('write'); return T('look'); }
  function syncLabel(o) { const st0 = stateText(o); o.prop.label = `${T(o.kind)} ${verb(o)}${st0 ? '  [' + st0 + ']' : ''}`; }

  // ── 노트 기록 ──
  function note(o, ko, tags = []) {
    const id = o.id; if (st.notes.some(n => n.id === id && n.ko === ko)) return;
    st.notes.push({ id: id + '#' + st.notes.filter(n => n.id.startsWith(id)).length, k: o.kind, room: o.room.label, ko, tags: [...new Set([...tags, ...tagsOf(ko)])], place: placeTagOfRoom(o.room.label), t: ctx.playTime ? ctx.playTime() : 0 });
    if (st.notes.length > 200) st.notes.splice(0, st.notes.length - 200);
    try { const m = window.__mina; if (m && typeof m.remember === 'function') m.remember({ type: 'object', id, kind: o.kind, room: o.room.label, text: ko }); } catch (e) { /* 다른 모듈 */ }
  }
  function mina(o) { try { const m = window.__mina, n = O(o.id).n || 0; if (!m || (n !== 1 && n % 5)) return; const line = minaLine(m, o.id + (O(o.id).n || 0), lg()); if (line) setTimeout(() => ctx.say && ctx.say(`${T('mina')}: ${line}`, 2600), 3300); } catch (e) { /* ignore */ } }

  // ── 사용 ──
  function use(o) {
    const s = O(o.id), k = o.kind, L = lg(), sfx = ctx.sfx || {}, snd = (n, a) => { try { sfx[n] && sfx[n](a); } catch (e) { /* ignore */ } };
    s.n = (s.n || 0) + 1; ensureBuilt(o);
    let msg = '';
    const prog = ctx.clues ? ctx.clues().length : 0;
    if (k === 'cabinet') {
      s.open = !s.open; snd('locker');
      if (s.open) { const dr = s.dr || (s.dr = drawerContents(o.id, 2)); const lines = dr.map(i => DRAWER_POOL[i]); lines.forEach(e => note(o, e[0], e[4])); msg = lines.map(e => pick4(e, L)).join(' / '); inspectLater(o, msg); }
      else msg = T('closed') + '.';
    } else if (k === 'tv' || k === 'radio') {
      if (k === 'tv' && !powered()) { snd('click'); msg = [`전원이 들어오지 않는다. 화면에 내 얼굴만 비친다.`, 'No power. Only my reflection on the screen.', '電源が入らない。画面に自分の顔だけ映る。', '没有电。屏幕上只映出我的脸。'][LI[L] ?? 0]; }
      else if (!s.on) { s.on = true; s.ch = s.ch || 0; snd('staticNoise', .4); const bc = BROADCAST[(s.ch + (k === 'radio' && !powered() ? 4 : 0)) % BROADCAST.length]; msg = pick4(bc, L); note(o, bc[0], bc[4] || []); }
      else if (s.n % 3 === 0) { s.on = false; snd('click'); msg = T('off') + '.'; }
      else { s.ch = ((s.ch || 0) + 1) % BROADCAST.length; snd('staticNoise', .3); const bc = BROADCAST[s.ch]; msg = pick4(bc, L); note(o, bc[0], bc[4] || []); }
    } else if (k === 'pc') {
      if (!powered()) { snd('click'); msg = ['모니터가 까맣다. 전원 버튼을 눌러도 반응이 없다 — 전기가 먼저다.', 'The monitor is black. The power button does nothing — power first.', 'モニターは真っ暗。電源ボタンも反応しない — まず電気だ。', '显示器一片黑，按电源也没反应——得先来电。'][LI[L] ?? 0]; }
      else { s.on = true; snd('click'); openIntranet(o); return ''; }
    } else if (k === 'phone') {
      snd('click'); msg = powered() ? ['수화기를 들자 뚜— 신호음. 단축번호 1번 “경비실” 을 누르자 한참 신호만 가다 끊겼다.', 'Dial tone. Speed dial 1 "Guard room" rings and rings, then cuts off.', 'ツー…と発信音。短縮1番「警備室」は鳴り続けて切れた。', '嘟——拨号音。快捷键1“门卫室”响了很久后断了。'][LI[L] ?? 0] : ['수화기 너머가 조용하다. 아주 멀리서 숨소리 같은 잡음.', 'Silence on the line. Far away, a hiss like breathing.', '受話器の向こうは静かだ。遠くで息のような雑音。', '听筒那头很安静。远处有像呼吸的杂音。'][LI[L] ?? 0];
      note(o, '교내 전화 단축번호 1번 — 경비실. 아무도 받지 않는다.', ['guard']);
    } else if (k === 'intercom') {
      snd('staticNoise', .3); msg = ['인터폰 버튼을 누르자 치직— “…방송실입니다. 리허설 중이니 …” 녹음된 목소리처럼 끊긴다.', 'Kzzt— "…Broadcast room. Rehearsal in progress, so…" cuts off like a recording.', 'ザッ—「…放送室です。リハーサル中なので…」録音のように途切れる。', '滋——“……这里是广播室，正在彩排……”像录音一样断了。'][LI[L] ?? 0];
      note(o, '인터폰 — “방송실입니다. 리허설 중이니…” 녹음 같은 목소리.', ['bcast']);
    } else if (k === 'clock') {
      const c = ctx.clockText ? ctx.clockText() : '23:00'; snd('click');
      msg = powered() ? [`초침이 째깍거린다. ${c}.`, `The second hand ticks. ${c}.`, `秒針が刻む。${c}。`, `秒针滴答作响。${c}。`][LI[L] ?? 0] : [`시계는 11시 40분에 멈춰 있다. 내 시계는 ${c}.`, `The clock is stopped at 11:40. My watch says ${c}.`, `時計は11時40分で止まっている。自分の時計は${c}。`, `钟停在11点40分。我的表是${c}。`][LI[L] ?? 0];
      if (!powered()) note(o, '벽시계가 11시 40분(23:40)에 멈춰 있다.', ['2340']);
    } else if (k === 'board') { openWriter(o); return ''; }
    else if (k === 'fan') {
      if (!powered()) { msg = ['스위치를 돌려도 날개가 꿈쩍 않는다.', 'The blades won\'t budge.', 'スイッチを回しても羽根は動かない。', '转了开关，扇叶纹丝不动。'][LI[L] ?? 0]; snd('click'); }
      else { s.on = !s.on; snd('click'); msg = s.on ? ['덜덜거리며 선풍기가 돈다. 먼지 냄새.', 'The fan rattles to life. Smell of dust.', 'ガタガタと扇風機が回る。埃の匂い。', '电扇哐哐地转起来，一股灰味。'][LI[L] ?? 0] : T('off') + '.'; }
    } else if (k === 'blinds') { s.open = !s.open; snd('slide'); msg = s.open ? ['블라인드를 올렸다. 운동장 가로등 불빛이 줄무늬로 들어온다.', 'Blinds up. Streetlight comes in stripes.', 'ブラインドを上げた。街灯が縞模様に差し込む。', '拉起百叶窗，路灯光一条条照进来。'][LI[L] ?? 0] : T('closed') + '.'; }
    else if (k === 'vending') { snd('clank', .3); msg = powered() ? ['불이 들어온 자판기. 300원짜리 캔커피 칸만 “품절”.', 'The machine glows. Only the 300-won canned coffee is "sold out".', '自販機が光る。300ウォンの缶コーヒーだけ「売切」。', '饮料机亮着。只有300韩元的罐装咖啡“售罄”。'][LI[L] ?? 0] : ['전원이 꺼진 자판기. 동전 반환구에 1998년 발행 500원 동전 하나.', 'Unpowered. A 1998 500-won coin sits in the return slot.', '電源の切れた自販機。返却口に1998年発行の500ウォン硬貨。', '饮料机没电。退币口里有一枚1998年的500韩元硬币。'][LI[L] ?? 0]; if (!powered()) note(o, '자판기 반환구의 1998년 500원 동전.', ['1012']); }
    else if (k === 'fountain') { snd('drip'); if (ctx.P) { ctx.P.stamina = 100; ctx.P.tired = false; } msg = ['녹 맛이 나는 물이 졸졸 나온다. (스태미나 회복)', 'Rusty-tasting water trickles out. (stamina restored)', '錆の味の水がちょろちょろ出る。（スタミナ回復）', '流出带锈味的水。（体力恢复）'][LI[L] ?? 0]; }
    else if (k === 'piano') { snd('click'); playNotes([67, 67, 69, 69, 67, 67, 64]); msg = ['건반 몇 개를 눌렀다 — 솔 솔 라 라 솔 솔 미. 조율이 반음쯤 내려앉아 있다.', 'A few keys — G G A A G G E. About a semitone flat.', '鍵盤をいくつか — ソソララソソミ。半音ほど狂っている。', '按了几个键——索索拉拉索索米。音准低了半音。'][LI[L] ?? 0]; note(o, '음악실 피아노 — 솔 솔 라 라 솔 솔 미 (학교종).', ['music']); }
    else if (k === 'metronome') { snd('click'); msg = ['태엽을 감자 똑딱똑딱 — 템포 표시가 60에 테이프로 고정돼 있다.', 'Tick-tock — the tempo is taped at 60.', 'ゼンマイを巻くとカチカチ — テンポは60でテープ止め。', '上了发条，滴答滴答——速度被胶带固定在60。'][LI[L] ?? 0]; }
    else if (k === 'microscope') {
      const SL = [['양파 껍질 세포 — 교과서 그림 그대로다.', 'Onion skin cells — just like the textbook.', 'タマネギの表皮細胞 — 教科書通り。', '洋葱表皮细胞——和课本一模一样。'], ['연못물 표본. 짚신벌레가 빙글빙글 돈다.', 'Pond water. A paramecium spins.', '池の水。ゾウリムシがくるくる回る。', '池塘水样本，草履虫在打转。'], ['라벨 “98.10.12 펌프실 배수” — 탁한 물 속에 녹 부스러기.', 'Label "98.10.12 pump room drain" — murky water, rust flakes.', 'ラベル「98.10.12 ポンプ室排水」— 濁った水に錆の粉。', '标签“98.10.12 泵房排水”——浑水里有铁锈渣。', ['pump', '1012']]];
      const sl = SL[(s.n - 1) % SL.length]; snd('click'); msg = pick4(sl, L); note(o, sl[0], sl[4] || []);
    } else if (k === 'book') { openBook(o); return ''; }
    else if (k === 'shelf') { snd('paper'); const BK = [['『수학의 정석』 열 권이 나란히. 한 권만 거꾸로 꽂혀 있다.', 'Ten math workbooks; one is upside down.', '数学の参考書が十冊。一冊だけ逆さま。', '十本数学参考书，只有一本倒着插。'], ['졸업 앨범 1995~2007. 1999년판만 없다.', 'Yearbooks 1995–2007. 1999 is missing.', '卒業アルバム1995〜2007。1999年版だけない。', '1995~2007届毕业相册，独缺1999年。']]; const e = BK[(s.n - 1) % 2]; msg = pick4(e, L); note(o, e[0]); }
    else if (k === 'trophy') { snd('clank', .2); msg = ['“1997 교내 방송제 대상 — 방송부”. 트로피 받침에 이름 다섯 개, 하나는 긁혀 지워져 있다.', '"1997 school broadcast festival grand prize". Five names on the base, one scratched out.', '「1997 校内放送祭 大賞 — 放送部」。台座の五人の名前、一つは削られている。', '“1997校园广播节大奖——广播社”。底座刻着五个名字，一个被刮掉了。'][LI[L] ?? 0]; note(o, '1997 방송제 대상 트로피 — 방송부원 이름 다섯 중 하나(하늘?)가 긁혀 있다.', ['bcast', 'haneul']); }
    else if (k === 'plant') { snd('paper'); msg = prog > 10 ? ['누군가 최근에 물을 준 것 같다. 흙이 젖어 있다.', 'Someone watered it recently. The soil is damp.', '最近誰かが水をやったようだ。土が湿っている。', '好像最近有人浇过水，土是湿的。'][LI[L] ?? 0] : ['말라 버린 고무나무. 화분 받침에 “3-2 환경미화”.', 'A dried-up rubber plant. The saucer says "3-2 classroom decor".', '枯れたゴムの木。受け皿に「3-2 環境美化」。', '干枯的橡皮树。花盆托上写着“3-2 环境美化”。'][LI[L] ?? 0]; }
    s.seen = true; syncLabel(o); applyVisual(o); mina(o); ctx.onChange && ctx.onChange();
    return msg;
  }
  function inspectLater(o, text) { o._last = text; }

  // ── 피아노 · 짧은 음 ──
  function playNotes(ns, vol = .06) { try { const ac = playNotes.ac ||= new (window.AudioContext || window.webkitAudioContext)(); const t0 = ac.currentTime + .05, g = ac.createGain(); g.gain.value = vol; g.connect(ac.destination);
    ns.forEach((m, i) => { const o = ac.createOscillator(), e = ac.createGain(), t = t0 + i * .35; o.type = 'triangle'; o.frequency.value = 440 * Math.pow(2, (m - 69 - 1) / 12); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(1, t + .01); e.gain.exponentialRampToValueAtTime(.01, t + .33); o.connect(e); e.connect(g); o.start(t); o.stop(t + .35); }); } catch (e) { /* ignore */ } }

  // ── 메시 (게으른 생성) ──
  let MAT = null;
  function mats() { const { THREE } = ctx; if (MAT) return MAT; const M = (c, r = .7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    return MAT = { steel: M(0x8b9196, .5, .4), dark: M(0x1d1f22, .6), wood: M(0x7a5a3a, .75), beige: M(0xd8d0bc, .8), green: M(0x3f6b3a, .9), pot: M(0xa0522d, .9), black: M(0x0b0b0c, .4), white: M(0xeeeeea, .6), red: M(0xa83232, .6), gold: M(0xb8963c, .35, .6), glass: M(0x99aabb, .2, .1) }; }
  function canvasTex(w, h, draw) { const { THREE } = ctx, c = document.createElement('canvas'); c.width = w; c.height = h; const q = c.getContext('2d'); draw(q, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData = { c, q }; return t; }
  function ensureBuilt(o) {
    if (o.grp) return o.grp; const { THREE, scene } = ctx, M = mats(), g = new THREE.Group(), [W, D, H, wall] = DIM[o.kind];
    const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); g.add(me); return me; };
    const cyl = (r1, r2, h, m, x = 0, y = 0, z = 0, s = 10) => { const me = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, s), m); me.position.set(x, y, z); g.add(me); return me; };
    const desk = (w = W, d = D, h = .72) => { box(w, .04, d, M.wood, 0, h, 0); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, c]) => box(.04, h, .04, M.steel, a * (w / 2 - .04), h / 2, c * (d / 2 - .04))); };
    const k = o.kind;
    if (k === 'cabinet') { box(W, H, D, M.steel, 0, H / 2, 0); o.doorL = box(W / 2 - .01, H - .06, .02, M.steel, -W / 4, H / 2, D / 2 + .01); o.doorR = box(W / 2 - .01, H - .06, .02, M.steel, W / 4, H / 2, D / 2 + .01); box(.02, .14, .03, M.dark, -.03, H / 2, D / 2 + .03); box(.02, .14, .03, M.dark, .03, H / 2, D / 2 + .03); }
    else if (k === 'pc' || k === 'phone' || k === 'radio' || k === 'microscope' || k === 'book' || k === 'metronome' || k === 'tv') {
      if (k === 'tv') { box(.7, .7, .45, M.dark, 0, .35, 0); } else desk(W, D, k === 'pc' ? .72 : .75);
      const top = k === 'tv' ? .7 : k === 'pc' ? .74 : .77;
      if (k === 'pc' || k === 'tv') { const sw = k === 'tv' ? .56 : .36, sh = k === 'tv' ? .44 : .3; box(sw + .06, sh + .06, .38, k === 'tv' ? M.dark : M.beige, 0, top + sh / 2 + .05, -.02); o.scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ color: 0x050607 })); o.scr.position.set(0, top + sh / 2 + .05, .175); g.add(o.scr); if (k === 'pc') { box(.42, .02, .14, M.beige, 0, top + .01, .2); box(.36, .1, .4, M.beige, .5 * 0, top - .2, 0).visible = false; } }
      if (k === 'phone') { box(.22, .07, .2, M.beige, 0, top + .035, 0); box(.2, .045, .05, M.beige, 0, top + .09, -.05); }
      if (k === 'radio') { box(.34, .2, .12, M.dark, 0, top + .1, 0); cyl(.05, .05, .01, M.steel, -.08, top + .1, .065).rotation.x = Math.PI / 2; box(.006, .006, .4, M.steel, .14, top + .32, -.04).rotation.x = -.3; o.led = box(.02, .02, .01, M.red, .1, top + .16, .062); }
      if (k === 'microscope') { box(.16, .03, .2, M.dark, 0, top + .015, 0); cyl(.025, .025, .25, M.dark, 0, top + .16, -.05); cyl(.018, .018, .12, M.black, 0, top + .32, -.01).rotation.x = .5; box(.1, .01, .1, M.steel, 0, top + .1, .02); }
      if (k === 'book') { o.bookL = box(.2, .025, .28, M.white, -.1, top + .015, 0); o.bookL.rotation.z = .06; o.bookR = box(.2, .025, .28, M.white, .1, top + .015, 0); o.bookR.rotation.z = -.06; box(.42, .012, .3, M.red, 0, top + .003, 0); }
      if (k === 'metronome') { const geo = new THREE.ConeGeometry(.07, .22, 4); const me = new THREE.Mesh(geo, M.wood); me.position.set(0, top + .11, 0); g.add(me); o.arm = box(.008, .18, .008, M.steel, 0, top + .1, .045); }
    } else if (k === 'intercom') { box(W, .32, D, M.beige, 0, H, 0); cyl(.06, .06, .01, M.dark, 0, H + .04, D / 2 + .002, 12).rotation.x = Math.PI / 2; box(.05, .04, .01, M.red, 0, H - .1, D / 2 + .004); }
    else if (k === 'clock') { cyl(.17, .17, .05, M.white, 0, H, 0, 20).rotation.x = Math.PI / 2; o.hands = new THREE.Group(); o.hands.position.set(0, H, .03); g.add(o.hands); const h1 = new THREE.Mesh(new THREE.BoxGeometry(.012, .09, .004), M.black); h1.position.y = .045; const p1 = new THREE.Group(); p1.add(h1); o.hands.add(p1); const h2 = new THREE.Mesh(new THREE.BoxGeometry(.008, .13, .004), M.black); h2.position.y = .065; const p2 = new THREE.Group(); p2.add(h2); o.hands.add(p2); o.hh = p1; o.mh = p2; }
    else if (k === 'board') { box(W + .06, 1.0, .03, M.steel, 0, H - .5, 0); o.btex = canvasTex(256, 160, (q, w, h) => { q.fillStyle = '#f4f4f0'; q.fillRect(0, 0, w, h); }); const me = new THREE.Mesh(new THREE.PlaneGeometry(W, .94), new THREE.MeshStandardMaterial({ map: o.btex, roughness: .4 })); me.position.set(0, H - .5, .018); g.add(me); box(.4, .03, .06, M.steel, 0, H - 1.0, .03); }
    else if (k === 'fan') { cyl(.15, .17, .04, M.white, 0, .02, 0); cyl(.02, .02, 1.0, M.white, 0, .52, 0); box(.12, .12, .16, M.white, 0, 1.05, -.04); o.blades = new THREE.Group(); o.blades.position.set(0, 1.05, .07); g.add(o.blades); for (let i = 0; i < 3; i++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(.06, .16, .005), M.glass); bl.position.y = .09; const pv = new THREE.Group(); pv.rotation.z = i * 2.094; pv.add(bl); o.blades.add(pv); } }
    else if (k === 'blinds') { o.slats = new THREE.Group(); g.add(o.slats); for (let i = 0; i < 14; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(W, .012, .05), M.beige); s.position.y = H - .05 - i * .1; o.slats.add(s); } box(W + .04, .04, .06, M.beige, 0, H, 0); }
    else if (k === 'vending') { box(W, H, D, M.red, 0, H / 2, 0); o.scr = box(W - .2, H * .45, .01, M.glass, -.05, H * .68, D / 2 + .005); box(.12, .3, .02, M.dark, W / 2 - .12, H * .6, D / 2 + .01); box(W - .2, .14, .03, M.dark, -.05, .3, D / 2 + .01); }
    else if (k === 'fountain') { box(W, .85, D, M.steel, 0, .425, 0); box(W, .06, D, M.steel, 0, .88, 0); cyl(.015, .015, .06, M.steel, 0, .93, .05); }
    else if (k === 'piano') { box(W, H - .55, D, M.black, 0, (H - .55) / 2 + .55, -.05); box(W, .55, D * .5, M.black, 0, .275, -.15); box(W - .1, .03, .18, M.white, 0, .74, .2); box(W - .1, .2, .04, M.black, 0, .62, .29); box(.08, .74, .05, M.black, -W / 2 + .04, .37, .25); box(.08, .74, .05, M.black, W / 2 - .04, .37, .25); }
    else if (k === 'shelf' || k === 'trophy') { box(W, H, .02, M.wood, 0, H / 2, -D / 2 + .01); box(.03, H, D, M.wood, -W / 2, H / 2, 0); box(.03, H, D, M.wood, W / 2, H / 2, 0); const r = rng(hashStr(o.id));
      for (let i = 0; i < 5; i++) { const y = .05 + i * (H - .1) / 4; box(W, .025, D, M.wood, 0, y, 0); if (i === 4) continue;
        if (k === 'shelf') { let x = -W / 2 + .05; while (x < W / 2 - .08) { const bw = .025 + r() * .03, bh = .2 + r() * .12; const bk = box(bw, bh, D * .8, [M.red, M.green, M.beige, M.dark][Math.floor(r() * 4)], x + bw / 2, y + bh / 2 + .012, 0); bk.rotation.z = (r() - .5) * .06; x += bw + .004; } }
        else if (i > 0) { for (let j = 0; j < 3; j++) { cyl(.03, .05, .16, M.gold, -.3 + j * .3, y + .1, 0, 8); } } }
      if (k === 'trophy') { const gl = box(W, H, .01, M.glass, 0, H / 2, D / 2); gl.material = gl.material.clone(); gl.material.transparent = true; gl.material.opacity = .25; } }
    else if (k === 'plant') { cyl(.16, .12, .3, M.pot, 0, .15, 0); for (let i = 0; i < 7; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(.12, 6, 4), M.green); lf.position.set(Math.sin(i * 2.1) * .1, .45 + i * .07, Math.cos(i * 2.1) * .1); lf.scale.set(1, .5, .6); g.add(lf); } }
    g.position.set(o.wx, o.y0 + (wall ? 0 : 0), o.wz); g.rotation.y = o.yaw; g.name = 'SMART_' + o.kind; g.userData.rbKeep = true; g.userData.dynamic = true;
    g.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true; } });
    scene.add(g); o.grp = g; applyVisual(o); return g;
  }
  function applyVisual(o) {
    if (!o.grp) return; const s = O(o.id), k = o.kind;
    if (k === 'cabinet' && o.doorL) { o.doorL.rotation.y = s.open ? -1.2 : 0; o.doorR.rotation.y = s.open ? 1.2 : 0; o.doorL.position.z = DIM.cabinet[1] / 2 + (s.open ? .17 : .01); o.doorR.position.z = o.doorL.position.z; o.doorL.position.x = s.open ? -DIM.cabinet[0] / 2 + .07 : -DIM.cabinet[0] / 4; o.doorR.position.x = -o.doorL.position.x; }
    if (o.scr) { const on = s.on && powered(); o.scr.material.color && o.scr.material.color.setHex(on ? (k === 'pc' ? 0x2a4c8a : k === 'vending' ? 0xddeeff : 0x7f99b0) : (k === 'vending' ? 0x334455 : 0x050607)); if (k === 'vending') o.scr.material.color.setHex(powered() ? 0xcfe4f5 : 0x334455); }
    if (o.led) o.led.material = s.on ? mats().red : mats().dark;
    if (o.slats) { o.slats.children.forEach((sl, i) => { sl.rotation.x = s.open ? 1.3 : .1; sl.position.y = DIM.blinds[2] - .05 - (s.open ? i * .02 : i * .1); }); }
    if (o.btex) { const { c, q } = o.btex.userData; q.fillStyle = '#f4f4f0'; q.fillRect(0, 0, c.width, c.height); q.fillStyle = '#1a3a8a'; q.font = 'bold 26px sans-serif'; q.textBaseline = 'top'; wrap(q, s.text || '', 12, 14, c.width - 24, 32); o.btex.needsUpdate = true; }
    if (o.bookL) { const open = !!s.page; o.bookL.rotation.z = open ? .02 : .06; }
  }
  function wrap(q, text, x, y, w, lh) { let line = ''; for (const ch of [...text]) { const t = line + ch; if (q.measureText(t).width > w) { q.fillText(line, x, y); y += lh; line = ch; } else line = t; } if (line) q.fillText(line, x, y); }

  // ── 루프: 가까운 방만 메시 생성 · 먼 것은 숨김 · 선풍기 · 시계 바늘 (가벼움) ──
  let lastScan = 0, lastLbl = 0, lastPow = null, lastLang = null, lastEv = 0, lastWhere = '', evBusy = 0;
  const evMem = { last: {}, visits: null }, musicRooms = [];
  function roomEvents(now, P) {
    if (!ctx.where || (ctx.getState && ctx.getState() !== 'playing') || now < evBusy) return;
    evMem.visits = st.visits;
    if (!musicRooms.length && ctx.RBG) for (const b of ctx.RBG.BLD || []) for (const r of (b.props || []).filter(q => q.kind === 'room' && /음악실/.test(q.label || ''))) { const [x, z] = b.toWorld((r.x1 + r.x2) / 2, (r.z1 + r.z2) / 2); musicRooms.push({ x, z, y: r.floor * (b.spec ? b.spec.FH : 3.6), label: r.label }); }
    const where = String(ctx.where() || '');
    if (where !== lastWhere) { lastWhere = where; const ev = shouldFire(evMem, where, now); if (ev) return fireEvent(ev, where, 1); }
    // 가까이에서 들리는 이벤트 (음악실 피아노): 방 밖 · 같은 층 · near 거리 안
    for (const m of musicRooms) { const d = Math.hypot(m.x - P.x, m.z - P.z); if (d < 14 && d > 4.5 && Math.abs(m.y - (P.sh || 0)) < 1.5 && !/음악실/.test(where)) { const ev = shouldFire(evMem, m.label + ' (near)', now, 240000); if (ev) return fireEvent(ev, m.label, Math.max(.15, 1 - d / 14)); } }
  }
  function fireEvent(ev, label, vol) {
    evBusy = performance.now() + 4000; const L = lg(), visits = st.visits[label] || 0;
    const r = pickRoomEvent(label, { power: powered(), clues: ctx.clues ? ctx.clues() : [], visits: Math.max(0, visits - 1), lang: L, seed: 'ev' });
    if (!r) return; const sfx = ctx.sfx || {};
    setTimeout(() => { if (ctx.getState && ctx.getState() !== 'playing') return;
      try { if (ev.snd === 'notes') playNotes([67, 67, 69, 69, 67], .02 + .05 * vol); else if (sfx[ev.snd]) sfx[ev.snd](ev.snd === 'staticNoise' ? .25 : undefined); } catch (e) { /* ignore */ }
      ctx.say && ctx.say(r.text, 3600);
      if (ev.log || ev.tags) { const ko = r.progressed || !ev.log ? r.ko : ev.log; const id = 'ev:' + ev.id + ':' + label; if (!st.notes.some(n => n.id === id && n.ko === ko)) { st.notes.push({ id: id + (st.notes.some(n => n.id === id) ? '#' + st.notes.length : ''), k: 'event', room: label, ko, tags: [...new Set([...(ev.tags || []), ...tagsOf(ko)])], place: placeTagOfRoom(label), t: ctx.playTime ? ctx.playTime() : 0 }); if (st.notes.length > 200) st.notes.splice(0, st.notes.length - 200); } }
      try { const m = window.__mina; if (m) { const line = minaLine(m, 'ev' + ev.id + visits, L); if (line) setTimeout(() => ctx.getState && ctx.getState() === 'playing' && ctx.say && ctx.say(`${T('mina')}: ${line}`, 2600), 3900); if (typeof m.remember === 'function') m.remember({ type: 'roomEvent', id: ev.id, room: label, text: r.ko }); } } catch (e) { /* 다른 모듈 */ }
    }, 700);
  }
  function startLoop() {
    const tick = now => {
      requestAnimationFrame(tick); const P = ctx.P; if (!P) return;
      if (now - lastScan > 500) { lastScan = now; const py = P.sh || 0;
        for (const o of objs) { const d = Math.hypot(o.wx - P.x, o.wz - P.z), same = Math.abs(o.y0 - py) < 2.5 && P.floor === 0;
          if (!o.grp && same && d < 14) ensureBuilt(o); if (o.grp) o.grp.visible = same ? d < 30 : d < 12 && Math.abs(o.y0 - py) < 4; } }
      if (now - lastEv > 700) { lastEv = now; try { roomEvents(now, P); } catch (e) { /* ignore */ } }
      const pw = powered(), l = lg();
      if (now - lastLbl > 1000 || pw !== lastPow || l !== lastLang) { lastLbl = now; if (pw !== lastPow) objs.forEach(applyVisual); lastPow = pw; lastLang = l; objs.forEach(syncLabel); }
      for (const o of objs) { if (!o.grp || !o.grp.visible) continue; const s = st.objs[o.id];
        if (o.blades && s && s.on && pw) o.blades.rotation.z -= .35;
        if (o.arm && s && s.n) o.arm.rotation.z = Math.sin(now / 500 * Math.PI) * .4;
        if (o.hh && now - (o._ct || 0) > 1000) { o._ct = now; const [hh, mm] = pw && ctx.clockText ? ctx.clockText().split(':').map(Number) : [11, 40]; o.hh.rotation.z = -((hh % 12) + mm / 60) / 12 * Math.PI * 2; o.mh.rotation.z = -mm / 60 * Math.PI * 2; } }
    };
    requestAnimationFrame(tick);
  }

  // ── UI ──
  let ov = null, insp = { rx: -10, ry: 20, s: 1 };
  const css = `#smartOv{position:fixed;inset:0;display:none;z-index:60;background:rgba(6,8,10,.82);color:#e8e4d8;font:14px/1.5 system-ui,sans-serif;align-items:center;justify-content:center}
#smartOv.show{display:flex}#smartOv .sw{width:min(920px,94vw);max-height:88vh;overflow:auto;background:#16191c;border:1px solid #3a4048;border-radius:8px;padding:14px 16px;box-shadow:0 8px 40px #000}
#smartOv h3{margin:0 0 8px;font-size:17px;display:flex;justify-content:space-between;align-items:center;gap:8px}#smartOv h4{margin:12px 0 6px;font-size:13px;color:#b9c2cc;letter-spacing:.05em}
#smartOv button{background:#262c32;color:#e8e4d8;border:1px solid #444c55;border-radius:5px;padding:5px 10px;margin:2px;font:inherit;cursor:pointer}#smartOv button.on,#smartOv button.gpFocus,#smartOv button:focus{outline:2px solid #e0b04a}
#smartOv .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px}#smartOv .card{text-align:left;font-size:12.5px;line-height:1.4;white-space:normal}#smartOv .card.hl{background:#3a3220}#smartOv .card.ct{background:#3a1f1f}
#smartOv .tag{display:inline-block;white-space:nowrap;font-size:11px;padding:0 5px;margin:1px;border-radius:3px;background:#2e3a46}#smartOv .tag.p{background:#46302e}#smartOv .tag.t{background:#2e4632}
#smartOv .row{font-size:12.5px;margin:3px 0}#smartOv .post{border-bottom:1px solid #2a3036;padding:6px 0}#smartOv .post b{color:#9ec3ff}#smartOv .meta{color:#8a949e;font-size:11.5px}
#smartOv .stage{height:260px;display:flex;align-items:center;justify-content:center;perspective:700px;touch-action:none;cursor:grab}#smartOv .cube{position:relative;width:150px;height:150px;transform-style:preserve-3d}
#smartOv .cube div{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font-size:13px;padding:8px;background:#2a2f35;border:1px solid #59626c;backface-visibility:hidden}
#smartOv input{width:100%;box-sizing:border-box;background:#0f1214;color:#fff;border:1px solid #555;border-radius:4px;padding:6px;font:inherit}`;
  function hookUI() {
    if (typeof document === 'undefined') return;
    const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);
    ov = ensureOv();
    ov.addEventListener('click', e => { const a = e.target.closest('[data-act]'); if (!a) return; act(a.dataset.act, a.dataset.v, a); });
    ov.addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') { e.stopPropagation(); if (e.code === 'Enter') act('wdone'); if (e.code === 'Escape') close(); } }, false);
    addEventListener('keydown', e => { if (!ov.classList.contains('show')) return; if (mode === 'insp') { const d = { ArrowLeft: [0, -15], ArrowRight: [0, 15], ArrowUp: [-12, 0], ArrowDown: [12, 0] }[e.code]; if (d) { e.preventDefault(); e.stopPropagation(); rot(d[0], d[1]); } if (e.code === 'Equal' || e.code === 'Minus') { e.stopPropagation(); zoom(e.code === 'Equal' ? 1.1 : .9); } } }, true);
    addEventListener('keydown', e => { if (e.code === 'KeyN' && !e.repeat && ctx.getState && ctx.getState() === 'playing' && !(e.target && e.target.tagName === 'INPUT')) { openBoard(); } });
    ov.addEventListener('pointerdown', e => { const st0 = e.target.closest('.stage'); if (st0) { insp.drag = [e.clientX, e.clientY, insp.rx, insp.ry]; } });
    addEventListener('pointermove', e => { if (!insp.drag) return; const [x0, y0, rx, ry] = insp.drag; insp.rx = Math.max(-80, Math.min(80, rx - (e.clientY - y0) * .5)); insp.ry = ry + (e.clientX - x0) * .6; applyRot(); });
    addEventListener('pointerup', () => { insp.drag = null; });
    ov.addEventListener('wheel', e => { if (mode !== 'insp') return; e.preventDefault(); zoom(e.deltaY < 0 ? 1.1 : .9); }, { passive: false });
    // 일시정지 메뉴에 「단서 보드」 버튼 (게임패드로도 열 수 있게)
    const mb = document.querySelector('#pause .menuBtns'); if (mb && !document.getElementById('smartBoardBtn')) { const bt = document.createElement('button'); bt.className = 'btn'; bt.id = 'smartBoardBtn'; bt.textContent = T('boardKey'); bt.addEventListener('click', () => { const r = document.getElementById('resumeBtn'); r && r.click(); setTimeout(openBoard, 120); }); mb.insertBefore(bt, mb.children[2] || null); setInterval(() => { bt.textContent = T('boardKey'); }, 2000); }
  }
  let mode = '', cur = null, sel = null;
  function ensureOv() { if (typeof document === 'undefined') return null; let e = document.getElementById('smartOv'); if (!e) { e = document.createElement('div'); e.id = 'smartOv'; (document.body || document.documentElement).appendChild(e); } return e; }
  ensureOv();   // game.js closeUI 가 설치 전에도 이 패널을 찾는다
  function show(html, m) { mode = m; ov.innerHTML = `<div class="sw">${html}</div>`; if (!ov.classList.contains('show')) { if (ctx.openUI) ctx.openUI('smartOv'); else ov.classList.add('show'); } const f = ov.querySelector('input'); if (f) setTimeout(() => f.focus(), 30); }
  function close() { if (ctx.closeUI) ctx.closeUI(); ov.classList.remove('show'); }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const head = t => `<h3><span>${esc(t)}</span><span><button data-act="close" data-close>${esc(T('close'))}</button></span></h3>`;
  function act(a, v) {
    const o = cur; if (a === 'close') return close();
    if (a === 'wclear' && o) { O(o.id).text = ''; applyVisual(o); syncLabel(o); return openWriter(o); }
    if (a === 'wadd' && o) { const s = O(o.id); s.text = ((s.text || '') + (s.text ? ' ' : '') + v).slice(0, 80); applyVisual(o); syncLabel(o); const i = ov.querySelector('input'); if (i) i.value = s.text; return; }
    if (a === 'wdone' && o) { const i = ov.querySelector('input'), s = O(o.id); if (i) s.text = i.value.slice(0, 80); applyVisual(o); syncLabel(o); if (s.text) note(o, `${o.room.label} 화이트보드에 적었다: “${s.text}”`); ctx.onChange && ctx.onChange(); return close(); }
    if (a === 'page' && o) { const s = O(o.id); s.page = Math.max(0, Math.min(BOOK.length - 1, (s.page || 0) + (+v))); return openBook(o); }
    if (a === 'insp') { return openInspect(v ? objs.find(x => v === x.id || v.startsWith(x.id + '#')) : o); }
    if (a === 'rot') { const [x, y] = v.split(',').map(Number); return rot(x, y); }
    if (a === 'zoom') return zoom(+v);
    if (a === 'sel') { sel = sel === v ? null : v; return openBoard(); }
  }
  // 화이트보드 쓰기 (키보드 입력 + 패드용 낱말 칩)
  const CHIPS = [['10월 12일', 'Oct 12', '10月12日', '10月12日'], ['방송실?', 'Broadcast room?', '放送室？', '广播室？'], ['펌프실 열쇠', 'pump room key', 'ポンプ室の鍵', '泵房钥匙'], ['23:40', '23:40', '23:40', '23:40'], ['하늘', 'Ha-neul', 'ハヌル', '夏娜'], ['→', '→', '→', '→'], ['왜?', 'why?', 'なぜ？', '为什么？']];
  function openWriter(o) { cur = o; const s = O(o.id); show(`${head(T('board') + ' — ' + o.room.label)}<input maxlength="80" value="${esc(s.text || '')}"><div style="margin-top:6px">${CHIPS.map(c => `<button data-act="wadd" data-v="${esc(pick4(c, lg()))}">${esc(pick4(c, lg()))}</button>`).join('')}</div><div style="margin-top:8px"><button data-act="wclear">${esc(T('clear'))}</button><button data-act="wdone">${esc(T('done'))}</button></div>`, 'write'); }
  // 인트라넷 게시판 — 단서를 알수록 삭제됐던 글이 읽힌다 (글 자체는 2008년에 쓰였다)
  function openIntranet(o) { cur = o; const known = new Set(ctx.clues ? ctx.clues() : []), L = lg();
    const rows = POSTS.map(p => { const vis = !p.need || known.has(p.need); if (vis) note(o, `[인트라넷 ${p.d}] ${p.t[0]} — ${p.b[0]}`, p.tags);
      return `<div class="post"><div class="meta">${p.d} · ${esc(p.a)}</div>${vis ? `<b>${esc(pick4(p.t, L))}</b><div>${esc(pick4(p.b, L))}</div>` : `<i class="meta">${esc(T('deleted'))}</i>`}</div>`; }).join('');
    show(`${head(T('intranet'))}${rows}<div style="margin-top:8px"><button data-act="close">${esc(T('close'))}</button></div>`, 'pc'); syncLabel(o); applyVisual(o); mina(o); }
  // 책 — 펼쳐 읽기 + 자세히 보기(돌려 보기)
  const BOOK = [
    ['『서린고 30년사』 — 1974년 3월 2일 개교. 방송부는 1968년 지역 청소년 방송반에서 이어졌다.', '"Seorin High: 30 Years" — opened March 2, 1974. The broadcast club grew out of a 1968 youth radio group.', '『ソリン高校30年史』— 1974年3月2日開校。放送部は1968年の地域青少年放送班から。', '《瑞林高中三十年史》——1974年3月2日建校。广播社源自1968年的地区青少年广播班。', ['annex']],
    ['1998년 학교 일지 — 10월 12일 칸: “개교 기념 방송 리허설. 이상 없음.” 볼펜 자국이 두 번 덧칠돼 있다.', '1998 school log — Oct 12: "Founding broadcast rehearsal. No issues." The pen strokes were traced twice.', '1998年学校日誌 — 10月12日：「開校記念放送リハーサル。異常なし。」ペン跡が二度なぞられている。', '1998年校务日志——10月12日：“校庆广播彩排，无异常。”笔迹被描过两遍。', ['1012', 'bcast']],
    ['책 사이에 끼워진 대출증 — 윤하늘, 『집으로 가는 길』, 반납 예정 10.19.', 'A library slip tucked inside — Yoon Ha-neul, "The Way Home", due 10/19.', '本に挟まった貸出票 — ユン・ハヌル、『家へ帰る道』、返却予定10.19。', '书里夹着借书条——尹夏娜，《回家的路》，应还日期10.19。', ['haneul', 'library']],
  ];
  function openBook(o) { cur = o; const s = O(o.id), p = s.page || 0, e = BOOK[p], L = lg(); s.seen = true; note(o, e[0], e[4]);
    show(`${head(T('book') + ' — ' + o.room.label)}<p style="font-family:serif;font-size:15px;background:#e9e2cf;color:#1d1a14;padding:14px;border-radius:4px">${esc(pick4(e, L))}</p><div class="meta">${p + 1} / ${BOOK.length}</div><div><button data-act="page" data-v="-1">◀</button><button data-act="page" data-v="1">▶</button><button data-act="insp">${esc(T('inspect'))}</button><button data-act="close">${esc(T('close'))}</button></div>`, 'book'); syncLabel(o); applyVisual(o); mina(o); }
  // 자세히 보기 — CSS 3D 상자(가벼움: WebGL 컨텍스트를 새로 만들지 않는다)
  const ICON = { event: '✦', cabinet: '🗄', pc: '🖥', tv: '📺', radio: '📻', phone: '☎', intercom: '🔈', clock: '🕚', board: '📝', fan: '🌀', blinds: '🪟', vending: '🥤', fountain: '🚰', piano: '🎹', microscope: '🔬', book: '📖', shelf: '📚', plant: '🪴', metronome: '⏱', trophy: '🏆' };
  function openInspect(o) { if (!o) return; cur = o; const s = O(o.id), L = lg(), nts = st.notes.filter(n => n.id.startsWith(o.id)).map(n => n.ko), desc = o._last || (nts[nts.length - 1] || '');
    const faces = [['', 0, 0], ['', 0, 90], ['', 0, 180], ['', 0, -90], ['', 90, 0], ['', -90, 0]].map(([, x, y], i) => `<div style="transform:rotateX(${x}deg) rotateY(${y}deg) translateZ(75px)">${i === 0 ? `<span style="font-size:58px">${ICON[o.kind] || '?'}</span>` : i === 1 ? esc(T(o.kind)) : i === 2 ? esc(o.room.label) : i === 3 ? esc(stateText(o) || '—') : ''}</div>`).join('');
    show(`${head(T('inspect') + ' — ' + T(o.kind))}<div class="stage"><div class="cube">${faces}</div></div><div class="meta">${esc(T('rotHint'))}</div><div><button data-act="rot" data-v="0,-20">◀</button><button data-act="rot" data-v="0,20">▶</button><button data-act="rot" data-v="-15,0">▲</button><button data-act="rot" data-v="15,0">▼</button><button data-act="zoom" data-v="1.15">＋</button><button data-act="zoom" data-v="0.87">－</button><button data-act="close">${esc(T('close'))}</button></div><p class="row">${esc(desc && L === 'ko' ? desc : (o._last || desc))}</p>`, 'insp'); applyRot(); }
  function rot(x, y) { insp.rx = Math.max(-80, Math.min(80, insp.rx + x)); insp.ry += y; applyRot(); }
  function zoom(f) { insp.s = Math.max(.6, Math.min(2.2, insp.s * f)); applyRot(); }
  function applyRot() { const c = ov && ov.querySelector('.cube'); if (c) c.style.transform = `rotateX(${insp.rx}deg) rotateY(${insp.ry}deg) scale(${insp.s})`; }

  // ── 단서 보드 ──
  function boardEntries() {
    const out = [], CL = ctx && ctx.CLUES ? ctx.CLUES : {};
    for (const id of (ctx && ctx.clues ? ctx.clues() : [])) if (CL[id]) out.push({ id: 'clue:' + id, text: String(CL[id]).replace(/<[^>]+>/g, ''), src: 'clue' });
    for (const n of st.notes) out.push({ id: n.id, text: n.ko, tags: n.tags, place: n.place, src: 'obj', k: n.k, room: n.room });
    return out;
  }
  function openBoard() {
    if (!ov) return; cur = null; const L = lg(), E = boardEntries(), inf = inferLinks(E), tr = ctx.tr || (x => x);
    const tagH = t => `<span class="tag ${TAGDEF[t] ? TAGDEF[t].g : ''}">${esc(tagName(t, L))}</span>`;
    const short = e => e.src === 'obj' ? `${ICON[e.k] || '•'} ${esc(tr(e.text))}` : `🔎 ${esc(tr(e.text))}`;
    const rel = sel ? new Set(inf.links.filter(l => l.a === sel || l.b === sel).flatMap(l => [l.a, l.b])) : null, ctr = new Set(inf.contradictions.flatMap(c => [c.a, c.b]));
    const cards = E.length ? `<div class="cards">${E.slice().reverse().slice(0, 60).map(e => `<button class="card ${sel === e.id ? 'on' : ''} ${rel && rel.has(e.id) && e.id !== sel ? 'hl' : ''} ${ctr.has(e.id) ? 'ct' : ''}" data-act="sel" data-v="${esc(e.id)}">${short(e)}<br>${(inf.tags[e.id] || []).map(tagH).join('')}</button>`).join('')}</div>` : `<p class="meta">${esc(T('empty'))}</p>`;
    const byId = Object.fromEntries(E.map(e => [e.id, e])), nm = id => { const e = byId[id]; return e ? esc(tr(e.text)).slice(0, 60) + (e.text.length > 60 ? '…' : '') : id; };
    const lk = (sel ? inf.links.filter(l => l.a === sel || l.b === sel) : inf.links).slice(0, 8).map(l => `<div class="row">${nm(l.a)} ⇄ ${nm(l.b)} — ${esc(T('shared'))}: ${l.tags.map(tagH).join('')}</div>`).join('') || '<div class="row meta">—</div>';
    const ct = inf.contradictions.slice(0, 6).map(c => `<div class="row">⚠ ${nm(c.a)} ⟷ ${nm(c.b)} ${c.tags.map(tagH).join('')}</div>`).join('') || '<div class="row meta">—</div>';
    const sg = inf.suggestions.map(s => `<div class="row">→ ${tagH(s.place)} (${s.n}${esc(T('mentioned'))})</div>`).join('') || '<div class="row meta">—</div>';
    show(`${head(T('board_t'))}<h4>${esc(T('sugg'))}</h4>${sg}<h4>${esc(T('contra'))}</h4>${ct}<h4>${esc(T('links'))}</h4>${lk}<h4>${esc(T('items'))} (${E.length})</h4>${sel && byId[sel] && byId[sel].src === 'obj' ? `<button data-act="insp" data-v="${esc(sel)}">${esc(T('inspect'))}</button>` : ''}${cards}`, 'board');
  }
  return api;
}
