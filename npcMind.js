// 서린고 — 동행 NPC(민아)의 '머리': 상황에 맞는 대사 고르기 · 기억(무엇을 말했나) · 힌트 단계(막연 → 구체) · 사건 반응 대사 · 저장
//   · THREE · DOM 없이 동작 (tests/npcAI.test.mjs). 문자열은 모두 lang/<en|ja|zh>.json 에 번역이 있다
//   · 힌트는 장소 · 방법까지만 — 퍼즐 답(번호 · 순서)은 절대 말하지 않는다

export const MIND_VER = 1;
export const HINT_GAP = 40;   // 같은 장(章) 힌트를 한 단계 더 구체적으로 올리기 전 최소 간격(초)

// ── 민아 대사 표: id → [ko, en, ja, zh] (녹음 대본 · 번역의 원본 — lang/<en|ja|zh>.json 에도 같은 번역이 들어 있다) ──
export const MINA_LINES = {
  hint_ch1_vague: ["내 캠코더… 1학년 교실 쪽 어딘가에 두고 왔던 것 같아.", "My camcorder… I think I left it somewhere near the first-year classrooms.", "私のビデオカメラ…1年生の教室のどこかに置いてきた気がする。", "我的摄像机…好像落在一年级教室那边了。"],
  hint_ch1_how: ["1학년 1반 교실이야. 영상 안에 내가 본 게 다 남아 있을 거야.", "It's in Class 1-1. Everything I saw should still be on the tape.", "1年1組の教室だよ。私が見たものは全部映像に残ってるはず。", "在1年1班教室。我看到的一切应该都还录在里面。"],
  hint_ch2_vague: ["교무실은 밤에도 서류 냄새가 나. 오래된 회의록 같은 거 말이야.", "The staff room smells of paperwork even at night. Old meeting minutes and the like.", "職員室は夜でも書類の匂いがする。古い会議録とかね。", "教务室晚上也有一股文件味。像是旧会议记录之类的。"],
  hint_ch2_how: ["금고 번호 같은 건 보통 잊으면 안 되는 날로 정하지. 기록에 자꾸 나오는 날짜를 잘 봐.", "People usually set a safe code to a day they must never forget. Watch for a date that keeps showing up in the records.", "金庫の番号って、たいてい忘れちゃいけない日にするものでしょ。記録に何度も出てくる日付をよく見て。", "保险柜密码一般会设成绝不能忘的日子。留意记录里反复出现的日期。"],
  hint_ch3_vague: ["이 학교는 선생님마다 숨겨 둔 게 하나씩 있다는 소문이 있어.", "Rumor has it every teacher here hid something away.", "この学校は先生ごとに何か一つ隠してるって噂があるんだ。", "有传言说这所学校每个老师都藏了点东西。"],
  hint_ch3_how: ["손이 안 닿는 데 있는 물건이면 주변 물건을 엮어서 도구를 만들어 봐. 소지품 창에서 합칠 수 있잖아.", "If it's out of reach, try tying things together into a tool. You can combine them in your inventory.", "手が届かない所の物なら、周りの物を組み合わせて道具を作ってみて。持ち物画面で合わせられるでしょ。", "够不着的东西，就用周围的东西拼个工具试试。在物品栏里可以组合。"],
  hint_ch4_vague: ["교장 선생님 방은 늘 잠겨 있었어. 수첩을 꼭 들고 다니셨지.", "The principal's office was always locked. He never went anywhere without his notebook.", "校長先生の部屋はいつも鍵がかかってた。手帳を必ず持ち歩いてたね。", "校长室总是锁着。他走到哪儿都带着那个笔记本。"],
  hint_ch4_how: ["별관 보안 기록하고 CCTV는 경비실 장비랑 이어져 있어. 녹화가 남아 있을지도 몰라.", "The annex security logs and CCTV are wired to the guardhouse equipment. The recordings might still be there.", "別館の警備記録と防犯カメラは警備室の機材につながってる。録画が残ってるかもしれない。", "别馆的安保记录和监控连着警卫室的设备。录像说不定还在。"],
  hint_ch5_vague: ["모은 걸 늘어놓기만 해서는 소용없어. 하나로 묶어야 이야기가 되지.", "Just laying out what you've gathered won't help. Tie it together and it becomes a story.", "集めた物を並べるだけじゃ意味がない。一つにまとめてこそ話になるんだ。", "光把收集的东西摆出来没用。要合在一起才能成为一个故事。"],
  hint_ch5_how: ["소지품 창에서 조각들을 한데 합쳐 봐. 기록부처럼 엮일 거야.", "Try putting the pieces together in your inventory. They'll bind into something like a record book.", "持ち物画面で欠片を一つに合わせてみて。記録簿みたいにまとまるはずだよ。", "在物品栏里把碎片合到一起试试。会编成像记录簿一样的东西。"],
  hint_ch6_vague: ["4층 방송실 장비는 아직 살아 있어. 전기만 들어오면 말이야.", "The broadcast equipment on the fourth floor still works. As long as there's power.", "4階の放送室の機材はまだ生きてるよ。電気さえ来ればね。", "四楼广播室的设备还能用。只要有电。"],
  hint_ch6_how: ["방송을 하려면 전력부터 살려야 해. 지하 전기실 차단기 쪽을 먼저 봐.", "To broadcast, you need power first. Check the breakers in the basement electrical room.", "放送するにはまず電力を戻さないと。地下の電気室のブレーカーを先に見て。", "要广播得先恢复电力。先去看看地下电气室的断路器。"],
  hint_where: ["{} 쪽이 계속 마음에 걸려. 같이 가 보자.", "{} keeps bothering me. Let's go together.", "{}のほうがずっと気になってる。一緒に行ってみよう。", "{}那边一直让我放心不下。一起去看看吧。"],
  hint_main: ["지금 할 일이라… \"{}\" 말이지? 천천히 해 봐.", "What you need to do… \"{}\", right? Take it slow.", "やることって…「{}」のこと？ ゆっくりやりなよ。", "你现在要做的…是\"{}\"吧？慢慢来。"],
  greet_0: ["…발소리, 우리 둘 것만 맞지?", "…Those footsteps are only ours, right?", "…足音、私たち二人のだけだよね？", "……脚步声，只有我们两个的吧？"],
  greet_1: ["조금만 천천히 가. 숨이 차.", "Go a little slower. I'm out of breath.", "もう少しゆっくり行って。息が切れる。", "走慢一点。我喘不过气了。"],
  greet_2: ["손전등 꺼지면 말해. 내 거 아직 남았어.", "Tell me if your flashlight dies. Mine still has some left.", "懐中電灯が切れたら言って。私のはまだ残ってる。", "手电筒没电了就跟我说。我的还有。"],
  situ_dark_0: ["불이 나갔네… 차단기가 내려간 거 아닐까?", "The lights went out… Maybe a breaker tripped?", "電気が消えた…ブレーカーが落ちたんじゃない？", "灯灭了…是不是断路器跳了？"],
  situ_dark_1: ["층마다 계단 근처에 철제 분전반이 있어. 거기 차단기를 확인해 봐.", "There's a steel panel box near the stairs on every floor. Check the breakers there.", "各階の階段の近くに鉄の分電盤があるよ。そこのブレーカーを確かめてみて。", "每层楼梯附近都有个铁配电盘。去看看那里的断路器。"],
  situ_late_0: ["밤이 꽤 깊었네… 그래도 너랑 같이라 덜 무서워.", "It's gotten pretty late… but with you here, it's less scary.", "だいぶ夜も更けたね…でも一緒だから、そんなに怖くない。", "夜挺深了…不过有你在，没那么怕了。"],
  situ_keys_0: ["그거, 잃어버리면 안 돼. 하나하나가 그날 밤의 증거야.", "Don't lose that. Every piece is evidence of that night.", "それ、なくしちゃだめ。一つ一つがあの夜の証拠なんだから。", "那个可不能丢。每一件都是那天晚上的证据。"],
  situ_battery_0: ["손전등 깜빡거린다. 건전지 남았어?", "Your flashlight's flickering. Got any batteries left?", "懐中電灯、ちかちかしてるよ。電池残ってる？", "你的手电在闪。还有电池吗？"],
  situ_exploreFew_0: ["별관은 2층 구름다리로 건너가면 돼. 거기도 한번 둘러봐.", "You can cross to the annex by the 2nd-floor skybridge. Have a look around there too.", "別館へは2階の渡り廊下から行けるよ。そっちも一度見てみて。", "去别馆走二楼的天桥就行。那边也去看看吧。"],
  situ_exploreMany_0: ["학교 안 다 돌아봤구나. 나보다 더 잘 알겠다.", "You've been all over the school. You probably know it better than I do.", "学校中ぜんぶ回ったんだ。私より詳しいかもね。", "你把学校都转遍了。大概比我还熟。"],
  react_lightsOut_0: ["어? 불 나갔어… 내 옆에 붙어 있어.", "Huh? The lights are out… Stay close to me.", "え？電気が消えた…私のそばにいて。", "咦？灯灭了…待在我旁边。"],
  react_lightsOut_1: ["또 정전이야. 분전반부터 보자.", "Another outage. Let's check the panel box first.", "また停電だ。まず分電盤を見よう。", "又停电了。先去看看配电盘。"],
  react_lightsFixed_0: ["불 들어왔다… 이제 좀 살 것 같아.", "The lights are back… I can breathe again.", "電気がついた…やっと生きた心地がする。", "灯亮了…总算能喘口气了。"],
  react_room_0: ["{}… 여기도 조심해서 보자.", "{}… Let's look around here carefully too.", "{}…ここも気をつけて見よう。", "{}…这里也小心看看吧。"],
  react_room_1: ["{}. 그날 밤에도 여길 지나갔었어.", "{}. I passed through here that night too.", "{}。あの夜もここを通ったんだ。", "{}。那天晚上我也经过这里。"],
  react_key_0: ["찾았다… 하나 더 모였어.", "Found it… one more piece.", "見つけた…これでまた一つ。", "找到了…又多了一件。"],
  react_key_1: ["이것도 그날 밤 기록이야. 잘 챙겨.", "This is a record of that night too. Keep it safe.", "これもあの夜の記録だよ。大事に持ってて。", "这也是那天晚上的记录。收好。"],
  react_run_0: ["같이 가… 너무 빨라!", "Wait for me… you're too fast!", "一緒に行こう…速すぎるよ！", "等等我…你太快了！"],
  react_stairs_0: ["계단은 천천히. 그날 밤에도 여기서 미끄러졌었어.", "Take the stairs slowly. I slipped here that night too.", "階段はゆっくりね。あの夜もここで滑ったんだ。", "楼梯慢点走。那天晚上我也在这儿滑了一跤。"],
  notice_0: ["저기… {} 좀 봐. 그냥 지나치면 안 될 것 같아.", "Over there… look at {}. I don't think we should walk past it.", "あそこ…{}を見て。素通りしちゃいけない気がする。", "那边…看看{}。总觉得不能就这么走过去。"],
  notice_1: ["{}… 아까부터 눈에 걸려. 한번 살펴볼래?", "{}… it keeps catching my eye. Want to take a look?", "{}…さっきから目に引っかかるの。ちょっと調べてみる？", "{}…我一直很在意。要不要看一看？"],
  stuck_0: ["계속 같은 데서 맴도는 것 같아. 내가 기억나는 걸 말해 줄게.", "Feels like we're going in circles. Let me tell you what I remember.", "同じところをぐるぐるしてる気がする。覚えてることを話すね。", "感觉我们一直在原地打转。我把记得的告诉你。"],
  stuck_fail: ["잠깐, 억지로 맞추지 말고 단서를 다시 보자.", "Wait — don't force it. Let's look at the clues again.", "待って、無理に合わせないで。手がかりをもう一度見よう。", "等等，别硬猜。我们再看看线索吧。"],
  emo_calm: ["…괜찮아. 천천히 가자.", "…It's okay. Let's take it slow.", "…大丈夫。ゆっくり行こう。", "…没事的。慢慢走吧。"],
  emo_uneasy: ["어두우니까 자꾸 그날 생각이 나… 멀리 가지 마.", "The dark keeps bringing back that night… don't go far.", "暗いと、あの夜のことばかり思い出す…遠くに行かないで。", "一黑我就老想起那天晚上…别走远。"],
  emo_curious: ["이상하다… 저건 그날 밤엔 없었던 것 같은데.", "Strange… I don't think that was there that night.", "変だな…あれ、あの夜にはなかった気がする。", "奇怪…那东西那天晚上好像不在。"],
  emo_relieved: ["휴… 조금은 숨 쉴 것 같아. 고마워.", "Phew… I can breathe a little. Thank you.", "ふう…少し息ができる気がする。ありがとう。", "呼…总算能喘口气了。谢谢你。"],
  // 무전기 상대(지훈 · 서연 중 플레이어가 아닌 쪽) — partnerRadio.js
  radio_call: ["…들려? 나야.", "…Can you hear me? It's me.", "…聞こえる？私だよ。", "…听得到吗？是我。"],
  radio_open_0: ["응, 듣고 있어. 무슨 일이야?", "Yeah, I'm listening. What's up?", "うん、聞いてるよ。どうしたの？", "嗯，我在听。怎么了？"],
  radio_open_1: ["여기 있어. 천천히 말해.", "I'm here. Take your time.", "ここにいるよ。ゆっくり話して。", "我在。慢慢说。"],
  radio_open_2: ["응, 잘 들려. 거긴 어때?", "Yeah, loud and clear. How is it over there?", "うん、よく聞こえる。そっちはどう？", "嗯，听得很清楚。你那边怎么样？"],
  radio_hint_where: ["{} 쪽부터 다시 봐. 거기서 막힌 것 같아.", "Check around {} again. I think that's where you're stuck.", "{}のほうをもう一度見て。そこで詰まってる気がする。", "再去{}那边看看。我觉得你卡在那里了。"],
  radio_hint_main: ["지금 할 일은… \"{}\" 맞지? 서두르지 말자.", "What you need to do now is… \"{}\", right? Let's not rush.", "今やることは…「{}」だよね？焦らずいこう。", "现在要做的是…“{}”对吧？别着急。"],
  radio_ch1_vague: ["민아 선배 마지막 메시지에 1학년 교실 얘기가 있었어.", "Mina's last message mentioned the first-year classrooms.", "ミナ先輩の最後のメッセージに、1年生の教室のことが書いてあった。", "敏雅学姐最后的消息里提到了一年级教室。"],
  radio_ch1_how: ["1학년 1반이야. 선배 캠코더가 거기 있을지도 몰라.", "Class 1-1. Her camcorder might be there.", "1年1組だよ。先輩のビデオカメラがそこにあるかもしれない。", "是1年1班。学姐的摄像机可能在那儿。"],
  radio_ch2_vague: ["그날 밤 기록은 교무실 쪽에 몰려 있을 거야. 회의록 같은 거.", "The records from that night are probably around the staff room. Meeting minutes, things like that.", "あの夜の記録は職員室のあたりに集まってるはず。会議録とか。", "那晚的记录应该都在教务室那边。比如会议记录。"],
  radio_ch2_how: ["번호로 잠긴 거면, 기록마다 되풀이되는 날짜가 열쇠일 거야.", "If it's a number lock, the date that keeps repeating in the records is probably the key.", "番号で鍵がかかってるなら、記録に何度も出てくる日付が鍵だと思う。", "如果是密码锁，记录里反复出现的日期大概就是钥匙。"],
  radio_ch3_vague: ["교직원 다섯 명, 각자 숨긴 게 있어. 방마다 하나씩.", "Five staff members, each hiding something. One in each room.", "教職員5人、それぞれ隠してる物がある。部屋ごとに一つずつ。", "五名教职员，各自藏了东西。每个房间一件。"],
  radio_ch3_how: ["손이 안 닿으면 도구를 만들어. 소지품에서 둘을 합칠 수 있잖아.", "If you can't reach it, make a tool. You can combine two things in your inventory.", "手が届かないなら道具を作って。持ち物で二つを合わせられるでしょ。", "够不着就做个工具。物品栏里可以把两样合在一起。"],
  radio_ch4_vague: ["교장이 끝까지 쥐고 있던 게 있어. 수첩부터 봐.", "There's something the principal held onto until the end. Start with his notebook.", "校長が最後まで手放さなかった物がある。まず手帳を見て。", "校长到最后都攥着一样东西。先看他的笔记本。"],
  radio_ch4_how: ["별관 보안 기록하고 CCTV, 경비실 장비랑 이어져 있대. 녹화를 찾아봐.", "The annex security logs and CCTV link up with the guardhouse gear. Look for the recordings.", "別館の警備記録と防犯カメラは警備室の機材とつながってるって。録画を探して。", "听说别馆的安保记录和监控跟警卫室的设备连着。找找录像。"],
  radio_ch5_vague: ["모은 증거, 따로 두면 그냥 종이야. 하나로 엮어야 해.", "The evidence is just paper if it stays apart. We have to bind it together.", "集めた証拠も、ばらばらじゃただの紙だよ。一つにまとめないと。", "收集的证据分开放就只是纸。得把它们编在一起。"],
  radio_ch5_how: ["소지품 창에서 조각들이랑 직인을 합쳐 봐.", "Try combining the pieces and the seal in your inventory.", "持ち物画面で欠片と印章を合わせてみて。", "在物品栏里把碎片和印章合起来试试。"],
  radio_ch6_vague: ["방송실 장비만 살아나면 돼. 전기가 문제야.", "We just need the broadcast gear running. Power's the problem.", "放送室の機材さえ動けばいい。問題は電気だ。", "只要广播室设备能用就行。问题在电。"],
  radio_ch6_how: ["지하 전기실 예비 퓨즈하고 차단기부터. 그다음 방송실로.", "The spare fuse and breakers in the basement electrical room first. Then the broadcast room.", "まず地下の電気室の予備ヒューズとブレーカー。それから放送室へ。", "先去地下电气室换备用保险丝、合上断路器。然后去广播室。"],
  radio_check_0: ["…들려? 괜찮은지만 말해 줘.", "…Can you hear me? Just tell me you're okay.", "…聞こえる？無事かどうかだけ教えて。", "…听得到吗？告诉我你没事就好。"],
  radio_check_1: ["무전 확인. 거기 조용해?", "Radio check. Is it quiet over there?", "無線確認。そっちは静か？", "无线电确认。你那边安静吗？"],
  radio_check_2: ["한참 연락이 없어서. 별일 없지?", "You've been quiet for a while. Everything all right?", "しばらく連絡がなかったから。何もない？", "好久没联系了。没事吧？"],
  radio_where: ["지금 {} 맞지? 거기선 서두르지 마.", "You're at {} now, right? Don't rush in there.", "今{}だよね？そこでは焦らないで。", "你现在在{}对吧？在那儿别着急。"],
  radio_stuck: ["한참 같은 데 있는 것 같아. 내가 아는 거 하나 말해 줄게.", "Seems like you've been in the same spot a while. Let me tell you something I know.", "ずっと同じところにいるみたい。知ってることを一つ教えるね。", "你好像在同一个地方待了很久。我告诉你一件我知道的事。"],
};
const K = id => MINA_LINES[id][0];
export const lineId = ko => { for (const id in MINA_LINES) if (MINA_LINES[id][0] === ko) return id; return null; };
export const lineText = (id, lang = 'ko') => { const r = MINA_LINES[id]; return r ? r[{ ko: 0, en: 1, ja: 2, zh: 3 }[lang] ?? 0] : null; };

// 장마다 2단계: [0] 막연한 기억 · [1] 접근 방법 (가운데 단계는 '장소' 힌트 — hint_where)
export const CH_HINT = {}; for (let c = 1; c <= 6; c++) CH_HINT[c] = [K(`hint_ch${c}_vague`), K(`hint_ch${c}_how`)];
// 상황 대사: 주제 → { any: 문자열 또는 [단계0, 단계1] }
const tiers = pre => { const out = []; for (let t = 0; MINA_LINES[pre + t]; t++) out.push(K(pre + t)); return out.length === 1 ? out[0] : out; };
export const SITU = {}; for (const k of ['dark', 'late', 'keys', 'battery', 'exploreFew', 'exploreMany']) SITU[k] = { any: tiers(`situ_${k}_`) };
// 사건 반응 — room · notice 는 '{}' 에 이름
export const REACT = {}; for (const k of ['lightsOut', 'lightsFixed', 'room', 'key', 'run', 'stairs']) REACT[k] = { any: tiers(`react_${k}_`) };
REACT.notice = { any: [K('notice_0'), K('notice_1')] }; REACT.stuck = { any: K('stuck_0') }; REACT.stuckFail = { any: K('stuck_fail') };
// 감정: calm(평온) · uneasy(불안 — 어둠 · 정전) · curious(호기심 — 단서 발견) · relieved(안도 — 불 복구 · 증거 확보)
export const EMOTIONS = ['calm', 'uneasy', 'curious', 'relieved'];
export const EMO_LINE = { calm: K('emo_calm'), uneasy: K('emo_uneasy'), curious: K('emo_curious'), relieved: K('emo_relieved') };
// 감정에 따른 따라가기 간격(m) · 멈추는 거리
export const EMO_FOLLOW = { calm: [1.4, 2.1], uneasy: [1.0, 1.5], curious: [1.7, 2.4], relieved: [1.4, 2.1] };
// 감정 고르기: 어둠 → 불안 (가장 강함) · 그 밖엔 최근 사건(유지 시간 안)
export function emotionOf(s, now) { if (s.dark) return 'uneasy'; if (s.until > now && s.emo) return s.emo; return 'calm'; }

const pickRole = (tbl, id) => (tbl[id] != null ? tbl[id] : tbl.any);
const tierOf = (v, t) => (Array.isArray(v) ? v[Math.min(t, v.length - 1)] : v);
export function reactLine(kind, id, count = 0) { const T = REACT[kind]; if (!T) return null; const v = pickRole(T, id); return v == null ? null : tierOf(v, count); }

// 모든 번역 대상 문자열 (테스트 · 번역 점검용)
export function mindStrings() {
  const out = [];
  for (const id in MINA_LINES) out.push(MINA_LINES[id][0]);
  return out;
}

// ── 기억 ──
// told: 이미 한 말(키 → 횟수) · tier: 장별 힌트 단계 · hintAt: 장별 마지막 단계 올린 때 · n: 말 건 횟수
export function newMemory() { return { n: 0, told: {}, tier: {}, hintAt: {}, react: {}, convo: {} }; }
export function sanitizeMemory(m) {
  const o = newMemory(); if (!m || typeof m !== 'object') return o;
  o.n = Number.isFinite(m.n) ? Math.max(0, m.n | 0) : 0;
  for (const k of ['told', 'tier', 'hintAt', 'react', 'convo']) if (m[k] && typeof m[k] === 'object' && !Array.isArray(m[k])) for (const q in m[k]) { const v = m[k][q]; if (Number.isFinite(v)) o[k][q] = v; }
  for (const q in o.tier) o.tier[q] = Math.max(0, Math.min(2, o.tier[q] | 0));
  return o;
}

// ── 상황 판단 ──
// c: { ch, main, where, dark, late, keys, cam, lowBattery, visited } — 게임이 말 걸 때마다 만든다
export function situations(c) {
  const s = [];
  if (c.keys > 0) s.push('keys');
  if (c.lowBattery) s.push('battery');
  if (c.late) s.push('late');
  if (c.visited != null && c.visited < 5) s.push('exploreFew');
  if (c.visited != null && c.visited >= 15) s.push('exploreMany');
  return s;
}

// 대사 고르기 → { key, text, topic, tier }.  L: NPC_LINES[id] (greet[] · hint 틀) · hintMain: '{}' 틀 (목표 문장)
//  1) 처음 말 걸면 인사  2) 어두우면(정전 · 차단기) 그 얘기부터, 단계적으로  3) 홀수 번째마다 장 힌트 — 막연 → 장소 → 방법 (HINT_GAP 초 지나야 한 단계 올림)
//  4) 아직 안 한 상황 대사(소지품 · 시간 · 돌아본 곳)  5) 인사 돌려 쓰기 (안 한 것 먼저)
export function pickLine(id, L, c, mem, now, hintMain) {
  const k = mem.n++, bump = key => { mem.told[key] = (mem.told[key] || 0) + 1; };
  const out = (key, text, topic, tier = 0) => { bump(key); return { key, text, topic, tier }; };
  if (k === 0) return out('g0', L.greet[0], 'greet');
  if (c.dark) {
    const t = mem.tier.dark || 0, v = pickRole(SITU.dark, id);
    if (t < 2) { mem.tier.dark = t + 1; return out('dark' + t, tierOf(v, t), 'dark', t); }
  } else if (mem.tier.dark) mem.tier.dark = 0;   // 불이 다시 들어오면 다음 정전 땐 처음부터
  if (k % 2 === 1) { const h = hintLine(L, c, mem, now, hintMain); if (h) { bump(h.key); return h; } }   // 너무 자주 물으면(HINT_GAP 안) 힌트 대신 다른 얘기
  for (const s of situations(c)) { const key = 's:' + s; if (mem.told[key]) continue; const v = pickRole(SITU[s], id); if (v == null) continue; return out(key, tierOf(v, 0), s); }
  // 인사: 안 한 것 먼저, 다 했으면 돌려 쓰기
  let gi = -1; for (let i = 0; i < L.greet.length; i++) if (!mem.told['g' + i]) { gi = i; break; }
  if (gi < 0) gi = (k >> 1) % L.greet.length;
  return out('g' + gi, L.greet[gi], 'greet');
}

// 장 힌트 한 단계: 막연(0) → 장소(1) → 방법(2). HINT_GAP 안에 다시 부르면 null (단계가 한꺼번에 올라가지 않게) — 말 걸 때 · 막혔을 때 함께 쓴다
export function hintLine(L, c, mem, now, hintMain) {
  const ch = c.ch || 1, ck = 'ch' + ch, H = L.ch || CH_HINT; if (!H[ch]) return null;
  const t = mem.tier[ck] || 0, last = mem.hintAt[ck]; if (last != null && now - last < HINT_GAP && now >= last) return null;
  const text = t === 0 ? H[ch][0] : t === 1 ? (c.where ? L.hint.replace('{}', c.where) : c.main ? hintMain.replace('{}', c.main) : H[ch][0]) : H[ch][1];
  mem.tier[ck] = Math.min(2, t + 1); mem.hintAt[ck] = now;
  return { key: 'h' + ch + ':' + t, text, topic: 'hint', tier: t };
}
// 반응 쿨다운: 같은 NPC · 같은 종류는 cd 초에 한 번
export function canReact(mem, kind, now, cd) { const t = mem.react[kind]; return t == null || now - t >= cd || now < t; }
export function markReact(mem, kind, now) { mem.react[kind] = now; mem.told['r:' + kind] = (mem.told['r:' + kind] || 0) + 1; return mem.told['r:' + kind] - 1; }
