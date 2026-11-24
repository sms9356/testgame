// 2인 1조 무전: 고른 주인공은 학교 안을 직접 수색하고, 다른 한 명은 바깥 · 별관 쪽을 맡아 무전기로 이어진다.
//   이야기 고비마다 두 사람이 주고받는 대화 (주인공별로 대사가 다르다 — 서연은 민아의 방송부 후배, 지훈은 민아의 어릴 적 친구)
//   대사 id: pr_<장면>_<s|j 주인공>_<순번> · 화자 spk: seoyeon / jihun · 무전 쪽은 'phone' 필터로 들린다
import { MINA_LINES, pickLine, hintLine, newMemory, sanitizeMemory, canReact, markReact } from './npcMind.js?v=460';
import { hintDirector as HD, BANTER_N } from './minaDirector.js?v=460';
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
  if ((C.t -= dt) > 0) return; C.t = .5; if ((C.pt = (C.pt || 0) - .5) <= 0) { C.pt = 5; ctxNow(); }   // 막힌 시간 추적 (5초마다)
  const { P, FL } = C, ch = C.chapter(), want = [];
  if (C.introDone()) want.push('start');
  if (C.inside()) want.push('inside');
  if (FL.cam) want.push('cam');
  if (FL.mina) want.push('mina');
  if (P.light && P.battery < 15) want.push('battery');
  for (let k = 2; k <= ch && k <= 6; k++) want.push('ch' + k);
  const next = want.find(s => !done().includes(s));
  if (next) { play(next).catch(() => { busyUntil = 0; }); return; }
  if (banterReady()) { banter().catch(() => { busyUntil = 0; }); return; }
  checkIn().catch(() => { busyUntil = 0; });
}

// ── 무전기 호출(B · 패드는 일시정지 메뉴 '무전 호출'): 상대가 지금 상황(장소 · 목표 · 소지품 · 정전 · 막힌 시간)에 맞춰 답하고, 힌트는 막연 → 장소 → 방법 (답은 말하지 않는다) ──
//   기억: FL.prMem (세이브와 함께) · 대사: npcMind.js MINA_LINES 의 radio_* (녹음 대본 표)
const RL = id => MINA_LINES[id][0];
export const RADIO_L = { greet: [RL('radio_open_0'), RL('radio_open_1'), RL('radio_open_2')], hint: RL('radio_hint_where'), ch: {} };
for (let c = 1; c <= 6; c++) RADIO_L.ch[c] = [RL(`radio_ch${c}_vague`), RL(`radio_ch${c}_how`)];
const mem = () => (C.FL.prMem = sanitizeMemory(C.FL.prMem));
// 목표가 바뀌지 않은 시간(초): 진행이 막혔는지 — 무전 상대가 힌트를 먼저 꺼내는 기준
let progKey = null, progT = 0;
function ctxNow() { const c = (C.mind && C.mind()) || { ch: C.chapter() }, k = (c.ch || 0) + '|' + (c.main || ''), t = nowS(); if (k !== progKey) { progKey = k; progT = t; } c.stuckSec = t - progT; return c; }
const nowS = () => (C.now ? C.now() : performance.now() / 1000);
let lastRadio = -1e9;
const names = () => { const me = C.char() === 'jihun' ? 'j' : 's', pa = me === 'j' ? 's' : 'j'; return { me, pa, meN: me === 'j' ? '지훈' : '서연', paN: pa === 'j' ? '지훈' : '서연', paCls: pa === 'j' ? 'jihun' : 'seoyeon', meCls: me === 'j' ? 'jihun' : 'seoyeon' }; };
const wait = ms => new Promise(r => setTimeout(r, ms));
// 녹음된 무전 대사(한국어): 말하는 사람(j · s) 목소리로 재생 — 상대 목소리는 무전 필터 · 녹음이 없으면 자막만
const say = (who, text, radio) => { try { C.voice && C.voice(text, who === 'j' ? 'jihun' : 'seoyeon', radio ? 'phone' : 'none'); } catch (e) { /* 자막만 */ } };
function fx(kind) { try { if (kind === 'beep') C.sfx.beep(); else C.sfx.staticNoise ? C.sfx.staticNoise(.25) : C.sfx.beep(); } catch (e) { /* 소리 없음 */ } }
// 상대의 답 고르기 (순수 — 테스트에서도 쓴다): 막힌 지 오래면 힌트 먼저 · 처음 온 곳이면 장소 얘기 · 그 밖엔 대사 규칙(npcMind.pickLine)
export function partnerReply(c, m, t, hd = null) {   // hd: 공용 힌트 감독 — 민아와 같은 단계를 쓴다(겹치거나 어긋난 힌트 없음)
  const H = () => (hd ? hd.request('radio', RADIO_L, c, t, RL('radio_hint_main')) : hintLine(RADIO_L, c, m, t, RL('radio_hint_main')));
  if (c.stuckSec > (hd ? hd.stuckAfter(180) : 180)) { const h = H(); if (h) { m.n++; m.told[h.key] = (m.told[h.key] || 0) + 1; return { ...h, intro: RL('radio_stuck') }; } }
  if (c.room && !m.told['p:' + c.room] && m.n > 0 && m.n % 3 === 2) { m.n++; m.told['p:' + c.room] = 1; return { key: 'p:' + c.room, text: RL('radio_where').replace('{}', c.room), topic: 'place', tier: 0 }; }
  return pickLine('partner', RADIO_L, c, m, t, RL('radio_hint_main'), hd ? H : null);
}
export async function callPartner() {
  if (!C || C.state() !== 'playing' || performance.now() < busyUntil || C.busy()) return false;
  const N = names(), c = ctxNow(), r = partnerReply(c, mem(), nowS(), HD); busyUntil = performance.now() + 15000; lastRadio = nowS();
  try {
    C.radio && C.radio('tx', N.meN); fx('beep'); say(N.me, RL('radio_call'), false); C.subtitle(N.meN, RL('radio_call'), 1.8, N.meCls); await wait(1700);
    C.radio && C.radio('rx', N.paN); fx('static'); await wait(500);
    if (r.intro) { say(N.pa, r.intro, true); C.subtitle(N.paN + ' 📻', r.intro, 3, N.paCls); await wait(3100); }
    say(N.pa, r.text, true); C.subtitle(N.paN + ' 📻', r.text, 5, N.paCls); await wait(5000); fx('beep');
  } finally { C.radio && C.radio('idle'); busyUntil = performance.now() + 2500; }
  return r;
}
// 세 사람 잡담 (무전 상대 → 민아 → 주인공): 조용할 때만(민아 큐 비었고 1분 넘게 아무도 말 안 함 · 이야기 대사 없음) · 짧게 · 세트마다 한 번
const banterDone = () => (C.FL.prBanter ||= []);
let lastBanter = -1e9;
export function banterPick(done, n = BANTER_N) { for (let k = 0; k < n; k++) if (!done.includes(k)) return k; return -1; }
function banterReady() {
  const M = C.mina && C.mina(), t = nowS(); if (!M || !C.FL.minaFollow || !M.mina || !M.mina.active) return false;
  if (t - lastRadio < 180 || t - lastBanter < 420 || !M.quiet(60) || Math.hypot(M.mina.x - C.P.x, M.mina.z - C.P.z) > 4.5) return false;
  return banterPick(banterDone()) >= 0 && Math.random() < .03;
}
async function banter() {
  const M = C.mina(), k = banterPick(banterDone()); if (k < 0) return; banterDone().push(k); const t = nowS(); lastBanter = t; lastRadio = t;
  const N = names(), a = RL(`radio_banter${k}_a`), m = RL(`banter${k}_m`), b = RL(`radio_banter${k}_b`);
  busyUntil = performance.now() + 16000; M.queue.hold(t, 14);
  try { C.radio && C.radio('rx', N.paN); fx('static'); await wait(400); say(N.pa, a, true); C.subtitle(N.paN + ' 📻', a, 3.2, N.paCls); await wait(3300);
    C.radio && C.radio('idle'); if (C.state() !== 'playing') return; try { C.voice && C.voice(m, 'mina'); } catch (e) { /* 자막만 */ } C.subtitle('민아', m, 3.2); await wait(3300);
    if (C.state() !== 'playing') return; C.radio && C.radio('tx', N.meN); say(N.me, b, false); C.subtitle(N.meN, b, 3, N.meCls); await wait(3000); fx('beep');
  } finally { C.radio && C.radio('idle'); busyUntil = performance.now() + 3000; }
}
// 먼저 걸어오는 확인 무전: 마지막 무전 뒤 4분 이상 · 같은 대사는 기억 · 오래 막혀 있으면 힌트 한 단계 덧붙임
async function checkIn() {
  const t = nowS(), m = mem(); if (t - lastRadio < 240 || !canReact(m, 'checkin', t, 240) || Math.random() > .02) return;
  markReact(m, 'checkin', t); lastRadio = t; const N = names(), k = (m.told['r:checkin'] - 1) % 3, c = ctxNow();
  busyUntil = performance.now() + 12000;
  try { C.radio && C.radio('rx', N.paN); fx('static'); await wait(400); say(N.pa, RL('radio_check_' + k), true); C.subtitle(N.paN + ' 📻', RL('radio_check_' + k), 3.4, N.paCls); await wait(3500);
    if (c.stuckSec > HD.stuckAfter(300) && !HD.recently(t, 90)) { const h = HD.request('radio', RADIO_L, c, t, RL('radio_hint_main')); if (h) { say(N.pa, h.text, true); C.subtitle(N.paN + ' 📻', h.text, 5, N.paCls); await wait(5000); } } fx('beep');
  } finally { C.radio && C.radio('idle'); busyUntil = performance.now() + 3000; }
}
