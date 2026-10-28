// 2인 1조 무전: 고른 주인공은 학교 안을 직접 수색하고, 다른 한 명은 바깥 · 별관 쪽을 맡아 무전기로 이어진다.
//   이야기 고비마다 두 사람이 주고받는 대화 (주인공별로 대사가 다르다 — 서연은 민아의 방송부 후배, 지훈은 민아의 어릴 적 친구)
//   대사 id: pr_<장면>_<s|j 주인공>_<순번> · 화자 spk: seoyeon / jihun · 무전 쪽은 'phone' 필터로 들린다
export const PARTNER_SCENES = {
  start: {   // 정문이 잠긴 뒤 첫 무전
    s: [['j', '서연아, 들려? 정문 쪽은 내가 볼게. 넌 본관부터 가 봐. 무전기 절대 끄지 마.'], ['s', '응, 잘 들려. 지훈아… 너도 혼자 무리하지 마.'], ['j', '십 분마다 연락하자. 대답 없으면 바로 갈게.']],
    j: [['s', '지훈아, 들려? 난 별관 쪽 창문부터 확인할게. 넌 본관으로 들어가.'], ['j', '알았어. 서연아, 무서우면 바로 불러. 혼자 버티지 말고.'], ['s', '그 말, 그대로 돌려줄게. 민아 선배 꼭 찾자.']],
  },
  inside: {   // 처음 건물 안에 들어왔을 때
    s: [['s', '지훈아, 본관 안이야. 불이 하나도 안 켜져 있어… 손전등 하나로 버텨야겠어.'], ['j', '천천히 가. 발소리 줄이고. 이상한 소리 들리면 바로 말해.']],
    j: [['j', '서연아, 본관 들어왔어. 안이 완전히 깜깜해. 숨소리까지 울려.'], ['s', '조심해… 민아 선배 마지막 메시지에 1학년 1반 얘기가 있었어. 거기부터 봐.']],
  },
  cam: {   // 민아의 캠코더 발견
    s: [['s', '지훈아! 민아 선배 캠코더 찾았어. 1학년 1반 책상 밑에 떨어져 있었어.'], ['j', '영상 남아 있어? …선배가 마지막으로 뭘 찍었는지 봐야 해.'], ['s', '응… 화면이 흔들려. 선배가 누군가랑 얘기하고 있어.']],
    j: [['j', '서연아, 민아 캠코더야. 1학년 1반에 떨어져 있었어.'], ['s', '선배가 그걸 두고 갔을 리가 없어… 영상 확인해 봐, 지훈아.'], ['j', '배터리가 아직 남아 있어. 민아 목소리가… 들려.']],
  },
  ch2: {   // 제2장 — 1998년 은폐
    s: [['j', '서연아, 경비실 일지 봤어. 1998년 10월 12일 밤 기록만 찢겨 나가 있어.'], ['s', '누가 일부러 지운 거야. 학교가 그날 밤을 숨기고 있는 거지.']],
    j: [['s', '지훈아, 경비실 일지에 그날 밤 기록만 없어. 누가 찢어 갔어.'], ['j', '십 년 동안 아무도 몰랐던 게 아니야. 다들 알고 입을 다문 거야.']],
  },
  ch3: {   // 제3장 — 다섯 교직원의 비밀
    s: [['s', '지훈아, 교직원 다섯 명이 다 뭔가 하나씩 숨기고 있었어.'], ['j', '하나씩 증거를 모으자. 하나라도 빠지면 또 덮일 거야.']],
    j: [['j', '서연아, 교직원 다섯 명. 다 뭔가 숨기고 있어.'], ['s', '그럼 하나씩 다 찾아내자. 이번엔 아무것도 묻히게 두지 않을 거야.']],
  },
  ch4: {   // 제4장 — 별관
    s: [['j', '서연아, 별관 쪽 창 하나가 열려 있어. 교장 서고 얘기, 거기서 확인할 수 있을 것 같아.'], ['s', '알았어, 그쪽으로 갈게. 지훈아, 넌 바깥에서 망 좀 봐 줘.']],
    j: [['s', '지훈아, 별관 2층에 불빛이 한 번 깜빡였어. 교장 서고가 그쪽이야.'], ['j', '내가 갈게. 서연아, 넌 무전 계속 붙들고 있어.']],
  },
  ch5: {   // 제5장 — 기록부 완성
    s: [['s', '지훈아… 증거가 거의 다 모였어. 이거면 그날 밤 무슨 일이 있었는지 다 말할 수 있어.'], ['j', '끝까지 가자. 하늘이라는 애… 이제 이름이라도 제대로 불러 줘야지.']],
    j: [['j', '서연아, 거의 다 모았어. 진상 기록부 마지막 칸만 남았어.'], ['s', '하늘 선배 이름, 이번엔 꼭 방송으로 불러 주자.']],
  },
  ch6: {   // 제6장 — 폭로 방송
    s: [['j', '서연아, 방송실 전원 살아 있어. 네 목소리로 해. 방송부잖아.'], ['s', '…응. 떨리지만, 내가 할게. 지훈아, 끝까지 들어 줘.']],
    j: [['s', '지훈아, 방송실 전원 들어왔어. 원고는 내가 무전으로 불러 줄게.'], ['j', '좋아. 이번엔 아무도 이 방송 못 끊어.']],
  },
  mina: {   // 민아를 찾았을 때
    s: [['s', '지훈아! 민아 선배 찾았어… 숨은 쉬어. 살아 있어.'], ['j', '다행이다… 정말 다행이다. 선배 옆에 꼭 붙어 있어. 금방 갈게.']],
    j: [['j', '서연아… 민아 찾았어. 의식은 없는데, 숨은 쉬어.'], ['s', '정말…? 다행이다. 지훈아, 민아 선배 절대 혼자 두지 마.']],
  },
  battery: {   // 손전등 배터리 부족 (한 번)
    s: [['s', '지훈아, 손전등이 깜빡거려… 배터리가 얼마 안 남았어.'], ['j', '교실 사물함이나 교무실 서랍 뒤져 봐. 건전지 하나쯤은 있을 거야.']],
    j: [['j', '서연아, 손전등 배터리가 거의 바닥이야.'], ['s', '사물함이랑 서랍부터 찾아봐. 어둠 속에선 절대 오래 있지 마.']],
  },
};

let C = null, busyUntil = 0;

export function installPartnerRadio(ctx) { C = { ...ctx, t: 0 }; return C; }
const done = () => (C.FL.prDone ||= []);   // 들은 장면 (FL 에 넣어 세이브와 함께 저장)
export const partnerLineIds = () => Object.entries(PARTNER_SCENES).flatMap(([sc, v]) => ['s', 'j'].flatMap(p => v[p].map((_, i) => `pr_${sc}_${p}_${i}`)));

export async function play(scene) {   // 점검용으로도 쓴다
  const p = C.char() === 'jihun' ? 'j' : 's', lines = PARTNER_SCENES[scene][p]; if (!done().includes(scene)) done().push(scene);
  busyUntil = performance.now() + 60000;
  for (let i = 0; i < lines.length; i++) {
    if (C.state() !== 'playing' && C.state() !== 'ui') break;
    const [who, text] = lines[i], id = `pr_${scene}_${p}_${i}`, radio = who !== p, name = (who === 'j' ? '지훈' : '서연') + (radio ? ' 📻' : '');
    C.radio && C.radio(radio ? 'rx' : 'tx', who === 'j' ? '지훈' : '서연');   // 무전기 HUD: 상대 목소리는 수신 · 내 목소리는 송신 (PTT)
    const sec = await C.speak(id, radio ? 'phone' : 'none', true);
    C.subtitle(name, text, Math.max(sec, 2.4) + .3, who === 'j' ? 'jihun' : 'seoyeon');
    await new Promise(r => setTimeout(r, (Math.max(sec, 2.4) + .5) * 1000));
  }
  C.radio && C.radio('idle');
  busyUntil = performance.now() + 4000;
}

export function tickPartnerRadio(dt) {
  if (!C || C.state() !== 'playing' || performance.now() < busyUntil || C.busy()) return;
  if ((C.t -= dt) > 0) return; C.t = .5;
  const { P, FL } = C, ch = C.chapter(), want = [];
  if (C.introDone()) want.push('start');
  if (C.inside()) want.push('inside');
  if (FL.cam) want.push('cam');
  if (FL.mina) want.push('mina');
  if (P.light && P.battery < 15) want.push('battery');
  for (let k = 2; k <= ch && k <= 6; k++) want.push('ch' + k);
  const next = want.find(s => !done().includes(s));
  if (next) play(next).catch(() => { busyUntil = 0; });
}
