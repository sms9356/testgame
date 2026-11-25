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
  // ── 자연스러운 동행 (minaDirector.js): 혼잣말 · 조사 반응 · 단서 보드 · 소리 · 대기 행동 · 무전 3인 대화 ──
  mutter_0: ["…발소리, 우리 둘 것만 맞지?","…Those footsteps are only ours, right?","…足音、私たち二人のだけだよね？","……脚步声，只有我们两个的吧？"],
  mutter_1: ["하늘 언니 방송 원고, 내가 아직 외우고 있어.","I still know Ha-neul's broadcast script by heart.","ハヌル姉さんの放送原稿、私まだ覚えてる。","夏蓝姐的广播稿，我到现在还背得出来。"],
  mutter_2: ["여기 말고 B1… 거기가 끝이야. 알잖아.","Not here — B1… that's where it ends. You know that.","ここじゃなくてB1…そこが終わりよ。わかってるでしょ。","不是这里，是B1……那里才是尽头。你知道的。"],
  mutter_3: ["조금만 천천히 가. 숨이 차.","Go a little slower. I'm out of breath.","もう少しゆっくり行って。息が切れる。","走慢一点。我喘不过气了。"],
  mutter_4: ["정문 경비실 아저씨… 그날 밤 다 들었대.","The guard at the front gate… he heard everything that night.","正門の警備員さん…あの夜、全部聞いたんだって。","正门警卫室的大叔……听说那天晚上他全都听见了。"],
  mutter_5: ["손전등 꺼지면 말해. 내 거 아직 남았어.","Tell me if your flashlight dies. Mine still has some left.","懐中電灯が切れたら言って。私のはまだ残ってる。","手电筒没电了就跟我说。我的还有。"],
  mutter_6: ["증거 다 모이면, 방송실 콘솔 내가 같이 잡아 줄게.","Once we have all the evidence, I'll run the broadcast console with you.","証拠が全部そろったら、放送室のコンソールは私が一緒に操作してあげる。","证据集齐了，广播室的控制台我陪你一起弄。"],
  mutter_7: ["복도가 이렇게 길었나. 낮에는 몰랐어.","Was this hallway always this long? I never noticed in the daytime.","廊下ってこんなに長かったっけ。昼間は気づかなかった。","走廊有这么长吗？白天都没注意。"],
  mutter_8: ["창밖에 비 소리… 그날도 이랬어.","Rain outside the window… it was like this that night too.","窓の外の雨音…あの日もこうだった。","窗外的雨声……那天也是这样。"],
  mutter_9: ["괜찮아. 나 아직 버틸 만해.","I'm fine. I can still hold on.","大丈夫。まだ平気だよ。","没事。我还撑得住。"],
  exam_cabinet: ["서랍 속은 다 그대로네. 누가 일부러 안 치운 것 같아.","Everything in the drawers is untouched. Like someone left it on purpose.","引き出しの中はそのまま。誰かがわざと片付けなかったみたい。","抽屉里都原封不动。像是有人故意没收拾。"],
  exam_screen: ["화면 속 소리… 그 시절 그대로야. 소름 돋아.","That sound from the screen… it's exactly like back then. Gives me chills.","画面の音…あの頃のまま。鳥肌が立つ。","屏幕里的声音……跟那时一模一样。我起鸡皮疙瘩了。"],
  exam_pc: ["게시판 글은 지워도 기록은 남아. 언니가 늘 그랬어.","You can delete a post, but the record stays. My sister always said that.","掲示板の書き込みは消しても記録は残る。お姉ちゃんがいつも言ってた。","帖子删了，记录也还在。姐姐总这么说。"],
  exam_phone: ["아무도 안 받네. 그날 밤에도 그랬을까.","Nobody's picking up. I wonder if it was like that that night too.","誰も出ないね。あの夜もそうだったのかな。","没人接。那天晚上也是这样吗？"],
  exam_wall: ["누가 남긴 글씨야? 글씨체, 어디서 본 것 같은데.","Who wrote that? I feel like I've seen that handwriting before.","誰が書いたの？この字、どこかで見た気がする。","谁写的？这字迹好像在哪儿见过。"],
  exam_any_0: ["그거, 내가 단서 보드에 붙여 둘게.","I'll pin that to the evidence board.","それ、手がかりボードに貼っておくね。","这个我贴到线索板上。"],
  exam_any_1: ["작은 거라도 놓치지 말자. 다 이어질지도 몰라.","Let's not miss even the small stuff. It might all connect.","小さなことも見逃さないでおこう。全部つながるかもしれない。","再小的东西也别放过。说不定都连得上。"],
  exam_any_2: ["음… 이건 기억해 두자.","Hm… let's remember this one.","うーん…これは覚えておこう。","嗯……这个记下来。"],
  exam_event: ["방금 그거… 너도 봤지? 나만 본 거 아니지?","That just now… you saw it too, right? It wasn't just me?","今の…あなたも見たよね？私だけじゃないよね？","刚才那个……你也看到了吧？不只是我吧？"],
  exam_link: ["잠깐, 이거 아까 본 {} 얘기랑 이어져.","Wait, this connects to the {} thing we saw earlier.","待って、これさっき見た{}の話とつながる。","等等，这和刚才看到的{}的事连上了。"],
  board_contra_0: ["이상해. {} 얘기가 서로 안 맞아. 누군가 거짓말을 했어.","That's strange. The {} accounts don't match. Someone lied.","変だよ。{}の話が食い違ってる。誰かが嘘をついた。","奇怪。关于{}的说法对不上。有人说了谎。"],
  board_contra_1: ["단서 보드 봐. {} 쪽 기록이 앞뒤가 안 맞아.","Look at the evidence board. The {} records contradict each other.","手がかりボード見て。{}の記録がつじつま合わない。","看线索板。{}那边的记录前后矛盾。"],
  board_sugg: ["보드에 {} 얘기가 자꾸 나와. 우리 아직 거긴 안 가 봤잖아.","{} keeps coming up on the board. We haven't been there yet.","ボードに{}の話が何度も出てくる。まだそこには行ってないよね。","线索板上一直出现{}。我们还没去过那儿。"],
  sound_look: ["방금 그 소리… 들었어?","That sound just now… did you hear it?","今の音…聞こえた？","刚才那个声音……你听到了吗？"],
  idle_sit: ["다리 아파. 잠깐 앉아 있을게, 다 보면 불러.","My legs hurt. I'll sit for a bit — call me when you're done.","足が痛い。ちょっと座ってるね、終わったら呼んで。","腿好酸。我坐一会儿，看完了叫我。"],
  idle_phone: ["…여긴 신호가 안 잡혀. 시간만 보는 거야.","…No signal in here. I'm just checking the time.","…ここ電波が入らない。時間を見てるだけ。","……这里没信号。我只是看看时间。"],
  sep_found: ["아, 여기 있었구나. 놓친 줄 알았잖아.","Oh, there you are. I thought I'd lost you.","あ、ここにいたんだ。はぐれたかと思った。","啊，你在这儿啊。我还以为跟丢了。"],
  radio_banter0_a: ["민아 옆에 있지? 안부 좀 전해 줘.","Mina's with you, right? Say hi for me.","ミナ、そばにいるよね？よろしく伝えて。","敏雅在你旁边吧？替我问个好。"],
  banter0_m: ["들려. 나 괜찮아. 걱정은 고마워.","I can hear you. I'm okay. Thanks for worrying.","聞こえてるよ。私は大丈夫。心配ありがとう。","听得到。我没事。谢谢你担心。"],
  radio_banter0_b: ["둘 다 잘 있어. 금방 끝낼게.","We're both fine. We'll wrap this up soon.","二人とも無事だよ。すぐ終わらせる。","我们俩都好。很快就结束。"],
  radio_banter1_a: ["거기 너무 조용하다. 둘이 싸운 거 아니지?","It's way too quiet over there. You two didn't fight, did you?","そっち静かすぎ。二人、けんかしてないよね？","你们那边也太安静了。俩人没吵架吧？"],
  banter1_m: ["싸울 기운도 없어. 발소리 듣느라 바빠.","Too tired to fight. We're busy listening for footsteps.","けんかする元気もないよ。足音を聞くので精一杯。","哪有力气吵架。光听脚步声就够忙了。"],
  radio_banter1_b: ["조용한 게 나아. 들어야 할 게 많거든.","Quiet is better. There's a lot to listen for.","静かな方がいい。聞かなきゃいけないことが多いから。","安静点好。要听的东西太多了。"],
  radio_banter2_a: ["끝나면 떡볶이 먹으러 가자. 셋이서.","When this is over, let's get tteokbokki. The three of us.","終わったらトッポッキ食べに行こう。三人で。","结束了我们去吃炒年糕吧。我们三个。"],
  banter2_m: ["…좋아. 언니가 좋아하던 집 알아.","…Okay. I know the place my sister loved.","…いいね。お姉ちゃんが好きだったお店、知ってる。","……好啊。我知道姐姐以前喜欢的那家。"],
  radio_banter2_b: ["약속했다. 그러니까 조심해서 가자.","It's a promise. So let's be careful.","約束だよ。だから気をつけて行こう。","说好了。所以我们小心点。"],
  radio_banter3_a: ["민아한테 물어봐. 방송부 비밀 통로 같은 거 없냐고.","Ask Mina if the broadcast club had a secret passage or something.","ミナに聞いてみて。放送部の秘密の通路とかないのか。","问问敏雅，广播部有没有什么秘密通道。"],
  banter3_m: ["그런 게 있었으면 벌써 나갔지. 장난 그만해.","If there were, we'd be out already. Quit joking.","そんなのあったらとっくに出てるよ。ふざけないで。","要是有的话早就出去了。别开玩笑了。"],
  radio_banter3_b: ["…농담 맞아. 긴장 좀 풀자고.","…It was a joke. Just trying to ease the tension.","…冗談だよ。緊張をほぐそうと思って。","……开玩笑的。想让大家放松点。"],
  // ── 가구 · 소지품 · 장식 (minaInteract.js): 앉기 · 보여주기 · 장식 반응 · 정리 · 무전 소지품 상담 ──
  item_key_see: ["열쇠네. 고리에 붙은 이름표부터 봐. 어디 문인지 적혀 있을 거야.","A key. Check the tag on the ring first. It should say which door.","鍵だね。まずリングの札を見て。どこの扉か書いてあるはず。","是钥匙。先看看环上的标签，应该写着是哪扇门。"],
  item_key_use: ["이 열쇠가 맞는 문, 우리가 지나온 길에 있었던 것 같아.","I think the door this key fits was somewhere along the way we came.","この鍵に合う扉、通ってきた道のどこかにあった気がする。","这把钥匙能开的门，好像就在我们走过的路上。"],
  item_key_how: ["잠긴 문 앞에서 그냥 지나치지 말고, 하나씩 다 대 봐.","Don't walk past locked doors. Try it on each one.","鍵のかかった扉を素通りしないで。一つずつ試してみて。","别从锁着的门前直接走过，一扇一扇试试。"],
  item_doc_see: ["종이 냄새… 누가 일부러 남겨 둔 기록 같아.","Smells like old paper… like a record someone left on purpose.","紙の匂い…誰かがわざと残した記録みたい。","一股纸的味道…像是有人故意留下的记录。"],
  item_doc_use: ["여기 적힌 장소, 단서 보드에 있는 거랑 겹치지 않아?","Doesn't the place written here overlap with something on the evidence board?","ここに書いてある場所、手がかりボードのと重ならない？","这上面写的地方，是不是和线索板上的对得上？"],
  item_doc_how: ["날짜랑 이름만 따로 떼어서 봐. 다른 기록이랑 맞춰 보면 보일 거야.","Look at just the dates and names. Line them up with the other records and you'll see.","日付と名前だけ抜き出して見て。他の記録と照らせば見えてくるよ。","只看日期和名字。和其他记录对一对就能看出来。"],
  item_media_see: ["녹음이나 영상은 거짓말을 안 해. 끝까지 들어 봐야 해.","Recordings don't lie. We have to hear it to the end.","録音や映像は嘘をつかない。最後まで聞かなきゃ。","录音和录像不会说谎。得听到最后。"],
  item_media_use: ["이건 틀 수 있는 기계가 있는 곳으로 가져가야 할 것 같아.","I think this needs to go somewhere with a machine that can play it.","これは再生できる機械がある場所に持って行かなきゃ。","这个得带到有机器能放的地方去。"],
  item_media_how: ["방송 장비 쪽이야. 전원부터 살아 있는지 봐.","It's the broadcast gear. Check whether it has power first.","放送機材のほうだよ。まず電源が生きてるか見て。","是广播设备那边。先看看有没有电。"],
  item_power_see: ["배터리다. 이런 건 아끼지 말고, 필요한 데 써.","A battery. Don't hoard these. Use them where they're needed.","電池だ。こういうのは惜しまないで、必要な所に使って。","是电池。这种东西别舍不得，该用就用。"],
  item_power_use: ["불이 꺼진 장치가 어디 있었는지 떠올려 봐.","Think back to where you saw a device that had gone dark.","明かりが消えてた装置がどこにあったか思い出して。","回想一下，哪里有灭了灯的装置。"],
  item_power_how: ["손전등이 약하면 소지품에서 바로 합쳐도 돼.","If your flashlight is weak, you can combine it right in your inventory.","懐中電灯が弱いなら、持ち物ですぐ組み合わせていいよ。","手电不够亮的话，可以直接在物品栏里组合。"],
  item_care_see: ["그건 아껴 둬. 다쳤을 때 쓰는 거야.","Save that. It's for when you get hurt.","それは取っておいて。怪我した時に使うものだよ。","那个留着。受伤的时候用。"],
  item_care_use: ["숨이 차거나 어지러우면 참지 말고 써. 나 기다려 줄 수 있어.","If you're out of breath or dizzy, don't tough it out. I can wait.","息が切れたりふらついたら我慢しないで使って。待ってるから。","要是喘不过气或者头晕，别硬撑，用吧。我可以等你。"],
  item_tool_see: ["이런 건 혼자선 쓸모없어 보여도, 뭔가랑 합치면 달라져.","Things like this look useless alone, but combined with something they change.","こういうのは単体だと役立たずに見えても、何かと合わせると変わるよ。","这种东西单独看没用，和别的组合起来就不一样了。"],
  item_tool_use: ["손이 안 닿던 데, 열리지 않던 데… 거기서 써 볼 수 있지 않을까?","Somewhere out of reach, something that wouldn't open… couldn't you try it there?","手が届かなかった所、開かなかった所…そこで使えないかな？","够不着的地方、打不开的地方…能不能在那儿试试？"],
  item_tool_how: ["소지품 창에서 다른 물건이랑 하나씩 맞춰 봐.","Try it against your other things in the inventory, one by one.","持ち物画面で他の物と一つずつ合わせてみて。","在物品栏里和其他东西一个个试着组合。"],
  item_story_see: ["그거… 그날 밤이랑 이어진 물건이야. 잘 갖고 있어.","That… it's tied to that night. Hold on to it.","それ…あの夜とつながってる物だよ。大事に持ってて。","那个…和那天晚上有关。好好拿着。"],
  item_story_use: ["언젠가 이걸 꺼내 보여 줘야 할 순간이 올 거야.","There'll come a moment when you need to show this.","いつかこれを出して見せなきゃいけない時が来るよ。","总有一天，你得把它拿出来给人看。"],
  item_again: ["아까 보여 준 거잖아. 잘 챙기고 있지?","You showed me that earlier. You're keeping it safe, right?","さっき見せてくれたやつだよね。ちゃんと持ってる？","你刚才给我看过了。有好好收着吧？"],
  item_necklace: ["…내가 준 목걸이. 아직 하고 다녔구나.","…The necklace I gave you. You still wear it.","…私があげたネックレス。まだ着けてたんだ。","……我送你的项链。你还一直戴着啊。"],
  item_nametag: ["하늘 언니 명찰… 이름을 제대로 불러 줄 날이 와야 해.","Ha-neul's name tag… the day has to come when her name is said properly.","ハヌル姉さんの名札…ちゃんと名前を呼んであげる日が来なきゃ。","夏蓝姐的名牌…一定要有一天好好叫出她的名字。"],
  item_camcorder: ["내 캠코더… 그날 찍은 거, 너도 봤지? 끝까지 봐 줘.","My camcorder… you saw what I filmed that night, right? Watch it to the end.","私のビデオカメラ…あの日撮ったもの、見たよね？最後まで見て。","我的摄像机…那天拍的你也看了吧？请看到最后。"],
  item_keypiece: ["증거 조각이야. 다섯 개가 다 모여야 이야기가 돼.","An evidence piece. It only becomes a story once all five are together.","証拠の欠片だね。五つ全部そろって初めて話になる。","是证据碎片。五块凑齐了才能说清楚。"],
  item_gatekey: ["다 엮었구나… 이제 이걸로 나갈 수 있어.","You put it all together… now we can get out with this.","全部まとめたんだ…これで出られるよ。","全都拼好了…现在可以靠它出去了。"],
  item_fuse_use: ["퓨즈는 전기실이지. 지하 어딘가에 빈 자리가 있을 거야.","A fuse belongs in the electrical room. There should be an empty slot somewhere in the basement.","ヒューズなら電気室だね。地下のどこかに空きがあるはず。","保险丝该去电气室。地下某处应该有个空位。"],
  item_hook_use: ["이거면 물 근처, 손 안 닿는 데도 건질 수 있겠다.","With this you could fish things out near the water, even out of reach.","これなら水の近くの、手が届かない所も引き上げられそう。","有了这个，水边够不着的东西也能捞上来。"],
  item_mop_use: ["자루만으론 부족해. 끝에 걸 만한 걸 찾아서 묶어 봐.","The handle alone isn't enough. Find something to hook on the end and tie it.","柄だけじゃ足りない。先に引っかける物を見つけて結んでみて。","光有杆子不够。找个能挂的东西绑在头上。"],
  item_emBattery_use: ["비상등용이네. 지하 쪽, 불이 꺼져 있던 데 기억나?","This is for an emergency light. Remember the dark spot down in the basement?","非常灯用だね。地下の、明かりが消えてた所覚えてる？","这是应急灯用的。还记得地下那片黑着的地方吗？"],
  item_tapeTrio_use: ["반주 테이프는 방송실 데스크에서 틀어야 해.","The backing tape has to be played at the broadcast room desk.","伴奏テープは放送室のデスクで流さなきゃ。","伴奏磁带得在广播室的操作台放。"],
  item_bookHome_use: ["빌린 책은 돌려줘야지. 도서실에 반납하는 데가 있었어.","Borrowed books should go back. There was a return slot in the library.","借りた本は返さなきゃ。図書室に返却口があったよ。","借的书要还。图书室有还书的地方。"],
  item_letterT_use: ["부치지 못한 편지라… 부칠 수 있는 걸 같이 찾아보자.","An unsent letter… let's look for what it needs to be sent.","出せなかった手紙か…出せるものを一緒に探そう。","没寄出的信啊…一起找找能让它寄出去的东西吧。"],
  item_valve_use: ["밸브 핸들이면 물을 다루는 곳이야. 수영장 근처 기계실 같은 데.","A valve handle means somewhere that handles water. Like a machine room near the pool.","バルブハンドルなら水を扱う所だね。プール近くの機械室とか。","阀门把手的话，就是管水的地方。比如泳池附近的机房。"],
  item_booth_use: ["체육관 위쪽에 방송 부스가 있었지. 거기 문 아닐까?","There was a broadcast booth up in the gym. Maybe it's that door?","体育館の上の方に放送ブースがあったよね。そこの扉じゃない？","体育馆上面有个广播间吧。会不会是那扇门？"],
  item_eqKey_use: ["방송실 안쪽, 장비실 문이 잠겨 있었잖아.","Inside the broadcast room, the equipment room door was locked, remember?","放送室の奥、機材室の扉が閉まってたよね。","广播室里面，器材室的门是锁着的吧。"],
  item_acid_use: ["조심해서 들어. 녹슨 자물쇠 같은 데 쓰는 거야.","Hold it carefully. That's for something like a rusted lock.","気をつけて持って。錆びた錠前みたいな物に使うんだよ。","小心拿着。那是对付生锈的锁之类的。"],
  radio_item_key: ["열쇠라고? 고리에 적힌 걸 읽어 줘. 어디 문인지 같이 생각해 보자.","A key? Read me what's on the ring. Let's figure out which door together.","鍵だって？リングに書いてあるの読んで。どこの扉か一緒に考えよう。","钥匙？把环上写的念给我听，一起想想是哪扇门。"],
  radio_item_doc: ["기록이면 날짜부터 불러 줘. 다른 데서 본 거랑 맞을지도 몰라.","If it's a record, read me the date first. It might match something we saw elsewhere.","記録なら日付から読んで。他で見たのと合うかもしれない。","是记录的话先念日期。可能和别处看到的对得上。"],
  radio_item_media: ["테이프? 틀 수 있는 기계가 있는 데로 가져가 봐.","A tape? Take it somewhere with a machine that can play it.","テープ？再生できる機械がある所に持って行ってみて。","磁带？带到有机器能放的地方试试。"],
  radio_item_power: ["배터리 아끼지 마. 꺼진 장치 생각나는 데 없어?","Don't save the battery. Any dead device come to mind?","電池は惜しまないで。消えてた装置、思い当たらない？","电池别省。想得起哪里有没电的装置吗？"],
  radio_item_care: ["다쳤으면 바로 써. 무리하지 말고.","If you're hurt, use it right away. Don't push yourself.","怪我したらすぐ使って。無理しないで。","受伤了就马上用。别逞强。"],
  radio_item_tool: ["그거 하나로는 애매하네. 가진 거랑 합쳐 봐.","That alone is iffy. Try combining it with what you have.","それ一つじゃ微妙だね。持ってる物と合わせてみて。","光那一个不太够。和手上的东西组合试试。"],
  radio_item_story: ["…그건 꼭 지켜. 나중에 꼭 필요할 거야.","…Keep that safe. You'll need it later for sure.","…それは必ず守って。後で絶対必要になる。","……那个一定要保管好。以后肯定用得上。"],
  radio_busy: ["(통화 중 — 끝나면 바로 연결)","(On a call — connecting as soon as it ends)","（通話中 — 終わり次第つなぐ）","（通话中 — 结束后马上接通）"],
  decor_trophy: ["트로피가 잔뜩이네. 상 받은 날은 다들 웃었겠지.","So many trophies. Everyone must have smiled the day they won.","トロフィーがいっぱい。賞をもらった日はみんな笑ってただろうね。","好多奖杯。拿奖那天大家一定都笑了吧。"],
  decor_motto: ["급훈… 성실과 책임. 그날 밤 어른들은 그걸 안 지켰어.","The class motto… diligence and responsibility. The adults didn't keep it that night.","級訓…誠実と責任。あの夜、大人たちはそれを守らなかった。","班训…诚实与责任。那天晚上大人们可没做到。"],
  decor_photo: ["옛날 사진들… 이 중에 언니 얼굴이 있을까 봐 무서워.","Old photos… I'm scared her face might be in one of them.","昔の写真…この中に姉さんの顔があったらと思うと怖い。","老照片…我怕里面会有姐姐的脸。"],
  decor_timetable: ["시간표 그대로네. 내일 수업이 있을 것처럼.","The timetable's still up. As if there were classes tomorrow.","時間割がそのまま。明日も授業があるみたい。","课表还贴着。好像明天还要上课一样。"],
  decor_broken: ["부서진 채로 그냥 뒀네. 아무도 치울 생각을 안 했나 봐.","Left broken just like that. Nobody thought to clean it up.","壊れたまま放ってある。誰も片付けようとしなかったんだ。","就这么坏着放在那儿。看来没人想收拾。"],
  decor_poster: ["포스터 날짜가 다 그해에 멈춰 있어.","The dates on the posters all stopped in that year.","ポスターの日付がみんなあの年で止まってる。","海报上的日期全都停在那一年。"],
  decor_flag: ["태극기 액자가 조금 기울었어. 아무도 바로잡지 않았네.","The flag frame is tilted a little. Nobody straightened it.","太極旗の額が少し傾いてる。誰も直さなかったんだ。","国旗相框有点歪了。没人扶正。"],
  tidy_cabinet: ["문 열어 두면 자꾸 뭐가 튀어나올 것 같아서. 닫을게.","Leaving it open feels like something will jump out. I'll close it.","開けっぱなしだと何か出てきそうで。閉めとくね。","开着总觉得会有什么蹦出来。我关上。"],
  tidy_blinds: ["밖에서 보일까 봐. 내려 둘게.","In case someone sees from outside. I'll lower it.","外から見えるかもしれないから。下ろしとくね。","怕外面看得到。我放下来。"],
  seat_sit: ["나도 잠깐 앉을게. 다리가 후들거려.","I'll sit for a moment too. My legs are shaking.","私もちょっと座るね。足が震えてる。","我也坐一会儿。腿在发抖。"],
  seat_across: ["마주 앉으니까 꼭 상담 시간 같다.","Sitting across from you feels like a counseling session.","向かい合って座ると、面談の時間みたい。","面对面坐着，好像在做辅导谈话。"],
  seat_up: ["가자. 나도 일어날게.","Let's go. I'm getting up too.","行こう。私も立つね。","走吧。我也起来了。"],
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
export function pickLine(id, L, c, mem, now, hintMain, hintFn = null) {   // hintFn: 공용 힌트 감독(minaDirector) — 없으면 이 기억(mem)의 단계
  const k = mem.n++, bump = key => { mem.told[key] = (mem.told[key] || 0) + 1; };
  const out = (key, text, topic, tier = 0) => { bump(key); return { key, text, topic, tier }; };
  if (k === 0) return out('g0', L.greet[0], 'greet');
  if (c.dark) {
    const t = mem.tier.dark || 0, v = pickRole(SITU.dark, id);
    if (t < 2) { mem.tier.dark = t + 1; return out('dark' + t, tierOf(v, t), 'dark', t); }
  } else if (mem.tier.dark) mem.tier.dark = 0;   // 불이 다시 들어오면 다음 정전 땐 처음부터
  if (k % 2 === 1) { const h = hintFn ? hintFn() : hintLine(L, c, mem, now, hintMain); if (h) { bump(h.key); return h; } }   // 너무 자주 물으면(HINT_GAP 안) 힌트 대신 다른 얘기
  for (const s of situations(c)) { const key = 's:' + s; if (mem.told[key]) continue; const v = pickRole(SITU[s], id); if (v == null) continue; return out(key, tierOf(v, 0), s); }
  // 인사: 안 한 것 먼저, 다 했으면 돌려 쓰기
  let gi = -1; for (let i = 0; i < L.greet.length; i++) if (!mem.told['g' + i]) { gi = i; break; }
  if (gi < 0) gi = (k >> 1) % L.greet.length;
  return out('g' + gi, L.greet[gi], 'greet');
}

// 장 힌트 한 단계: 막연(0) → 장소(1) → 방법(2). HINT_GAP 안에 다시 부르면 null (단계가 한꺼번에 올라가지 않게) — 말 걸 때 · 막혔을 때 함께 쓴다
export function hintLine(L, c, mem, now, hintMain, gap = HINT_GAP) {
  const ch = c.ch || 1, ck = 'ch' + ch, H = L.ch || CH_HINT; if (!H[ch]) return null;
  const t = mem.tier[ck] || 0, last = mem.hintAt[ck]; if (last != null && now - last < gap && now >= last) return null;
  const text = t === 0 ? H[ch][0] : t === 1 ? (c.where ? L.hint.replace('{}', c.where) : c.main ? hintMain.replace('{}', c.main) : H[ch][0]) : H[ch][1];
  mem.tier[ck] = Math.min(2, t + 1); mem.hintAt[ck] = now;
  return { key: 'h' + ch + ':' + t, text, topic: 'hint', tier: t };
}
// 반응 쿨다운: 같은 NPC · 같은 종류는 cd 초에 한 번
export function canReact(mem, kind, now, cd) { const t = mem.react[kind]; return t == null || now - t >= cd || now < t; }
export function markReact(mem, kind, now) { mem.react[kind] = now; mem.told['r:' + kind] = (mem.told['r:' + kind] || 0) + 1; return mem.told['r:' + kind] - 1; }
