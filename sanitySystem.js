/**
 * 〈폐교: 잊혀진 시간〉 실시간 공포 환각(Sanity) 시스템
 * - 외부 에셋 없이 Web Audio API(HRTF) + DOM 조작으로 구동
 * (사용자 제공 코드 — 게임 연결은 game.js 의 "공포 환각 연결" 부분)
 */
class SanityHallucinationSystem {
  constructor(options = {}) {
    this.audioCtx = null;
    this.isActive = false;
    this.fearLevel = 0; // 0 ~ 100
    this.threshold = options.threshold || 75; // 환각 시작 공포 수치 (기본 75%)

    // 타이머 및 쿨다운 관리
    this.heartbeatTimer = 0;
    this.eventCooldown = 3.5; // 첫 이벤트 대기 시간(초)
    this.activeTextRestorers = [];

    // 환각 텍스트 풀 (목표창, 단축키 안내, 상태창 오염용)
    this.creepyPhrases = [
      "뒤를 돌아보지 마",
      "사물함 밖에서 보고 있어",
      "숨을 참아도 소용없어",
      "도망칠 곳은 없다",
      "방금 발소리 들었어?",
      "여기서 못 나가",
      "교무실에 누군가 있어",
      "불을 꺼... 빨리",
      "네 뒤에 서 있어"
    ];

    // 가짜 휴대폰 문자 메시지 풀
    this.fakeMessages = [
      { sender: "신호 없음 (010-XXXX-XXXX)", text: "왜 아까부터 같은 복도만 돌고 있어?" },
      { sender: "서연 (나)", text: "제발 사물함 문 열지 마 내가 안에 있잖아" },
      { sender: "발신자 표시 제한", text: "손전등 켜지 마. 빛 때문에 다 보여." },
      { sender: "당직 교사", text: "23시 40분 이후 본관 잔류 학생은 즉시 교무실로 오십시오." },
      { sender: "알 수 없음", text: "방금 네 뒤로 지나간 거 나 아니야." },
      { sender: "신호 없음", text: "[사진 1장이 수신되었습니다 — 내 뒷모습]" }
    ];

    this._createFakeSmsElement();
  }

  // 오디오 컨텍스트 지연 초기화 (브라우저 자동재생 정책 대응)
  _ensureAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // 가짜 SMS 알림용 DOM 생성
  _createFakeSmsElement() {
    if (document.getElementById("sanity-fake-sms")) return;
    const el = document.createElement("div");
    el.id = "sanity-fake-sms";
    el.innerHTML = `
      <div class="sms-header">
        <span id="sanity-sms-sender">신호 없음 ✕</span>
        <span>방금 전</span>
      </div>
      <div class="sms-body" id="sanity-sms-body"></div>
    `;
    document.body.appendChild(el);
  }

  /**
   * 메인 게임 루프(requestAnimationFrame)에서 매 프레임 호출
   * @param {number} dt - 델타 타임(초 단위, 예: 0.016)
   * @param {number} currentFear - 현재 플레이어 공포 수치 (0 ~ 100)
   * @param {boolean} isPaused - 일시정지나 모달 열림 여부
   */
  update(dt, currentFear, isPaused = false) {
    this.fearLevel = currentFear;

    if (isPaused || this.fearLevel < this.threshold) {
      if (this.isActive) this._clearAllEffects();
      return;
    }

    if (!this.isActive) {
      this.isActive = true;
      document.body.classList.add("sanity-critical");
    }

    // 공포 수치가 75 -> 100으로 갈수록 강도(0.0 ~ 1.0) 증가
    const intensity = Math.min(1, (this.fearLevel - this.threshold) / (100 - this.threshold));

    // 1. 공포 수치가 높을수록 빨라지는 묵직한 심장 박동 소리
    this.heartbeatTimer -= dt;
    const beatInterval = 1.15 - intensity * 0.55; // 1.15초 ~ 0.6초 간격
    if (this.heartbeatTimer <= 0) {
      this.heartbeatTimer = beatInterval;
      this.playHeartbeat(0.18 + intensity * 0.35);
    }

    // 2. 랜덤 환각 이벤트 트리거 (공포도 80% 이상)
    if (this.fearLevel >= 80) {
      this.eventCooldown -= dt;
      if (this.eventCooldown <= 0) {
        // 다음 환각까지 대기 시간 (공포 100%에 가까울수록 4~8초마다 발생)
        this.eventCooldown = (7 - intensity * 3) + Math.random() * 5;
        this.triggerRandomHallucination(intensity);
      }
    }
  }

  // 공포도가 내려갔을 때 모든 환각 상태 원상복구
  _clearAllEffects() {
    this.isActive = false;
    document.body.classList.remove("sanity-critical", "sanity-glitch-frame");
    this.activeTextRestorers.forEach(restoreFn => restoreFn());
    this.activeTextRestorers = [];
  }

  // 4가지 환각 중 하나를 가중치 랜덤으로 실행
  triggerRandomHallucination(intensity) {
    const roll = Math.random();
    if (roll < 0.32) {
      // [청각 환각 1] 플레이어 바로 등 뒤나 옆에서 들리는 가짜 발소리 (3~5보)
      this.playPhantomFootsteps();
    } else if (roll < 0.58) {
      // [청각 환각 2] 귓가 바로 옆을 스치는 기괴한 속삭임 (HRTF)
      this.playPhantomWhisper();
    } else if (roll < 0.82) {
      // [시각/UI 환각] 목표 텍스트나 상태 표시가 1.5초간 붉은 글리치 문구로 오염
      this.corruptUIElements();
    } else {
      // [심리 환각] '신호 없음' 상태인데 진동음과 함께 도착하는 가짜 문자
      this.triggerFakePhoneNotification();
    }

    // 35% 확률로 순간적인 화면 색수차 + 시야 비틀림 동반
    if (Math.random() < 0.35 + intensity * 0.25) {
      this.triggerScreenGlitch(180 + Math.random() * 220);
    }
  }

  /* =========================================================
     [오디오 합성 1] 심장 박동 소리 (두근-두근)
     ========================================================= */
  playHeartbeat(volume = 0.3) {
    const ctx = this._ensureAudio();
    const now = ctx.currentTime;

    const makeThump = (startTime, pitch, gainVal) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(pitch, startTime);
      osc.frequency.exponentialRampToValueAtTime(28, startTime + 0.14);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.17);
    };

    makeThump(now, 65, volume);
    makeThump(now + 0.18, 52, volume * 0.75);
  }

  /* =========================================================
     [오디오 합성 2] 등 뒤에서 다가오는 가짜 복도 발소리 (HRTF 3D)
     ========================================================= */
  playPhantomFootsteps() {
    const ctx = this._ensureAudio();
    const steps = 3 + Math.floor(Math.random() * 3); // 3~5걸음
    const side = Math.random() < 0.5 ? -1 : 1; // 왼쪽 뒤 or 오른쪽 뒤
    const stepInterval = 0.34 + Math.random() * 0.12; // 걸음 속도

    for (let i = 0; i < steps; i++) {
      const stepTime = ctx.currentTime + i * stepInterval;

      // 3D HRTF 패너 생성 (플레이어 뒤쪽 z = 2.5m -> 0.8m로 점점 가까워짐)
      const panner = ctx.createPanner();
      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      const zDist = 2.4 - (i * 0.4); // 뒤에서 등 바로 뒤로 접근
      panner.positionX.setValueAtTime(side * (0.8 - i * 0.1), stepTime);
      panner.positionY.setValueAtTime(-0.5, stepTime);
      panner.positionZ.setValueAtTime(zDist, stepTime); // +Z가 플레이어 등 뒤

      // 나무 마루바닥 쿵 소리 + 모래/먼지 쓸리는 노이즈 합성
      const bufferSize = ctx.sampleRate * 0.09;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) {
        output[j] = (Math.random() * 2 - 1) * Math.exp(-j / (ctx.sampleRate * 0.025));
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(220 + (i % 2) * 45, stepTime);
      filter.Q.setValueAtTime(2.5, stepTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.55, stepTime);
      gain.gain.exponentialRampToValueAtTime(0.01, stepTime + 0.09);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);

      whiteNoise.start(stepTime);
    }
  }

  /* =========================================================
     [오디오 합성 3] 귓가를 스치는 기괴한 속삭임 (포먼트 필터 노이즈)
     ========================================================= */
  playPhantomWhisper() {
    const ctx = this._ensureAudio();
    const now = ctx.currentTime;
    const duration = 1.4;

    // 핑크/화이트 노이즈 버퍼 생성
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      // 숨소리처럼 끊어지는 엔벨로프 변조
      const mod = Math.sin((i / ctx.sampleRate) * Math.PI * 5) * 0.5 + 0.5;
      data[i] = (Math.random() * 2 - 1) * mod * 0.35;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // 사람의 속삭이는 주파수 대역(Formant)을 흉내 내는 밴드패스 필터
    const formant = ctx.createBiquadFilter();
    formant.type = "bandpass";
    formant.Q.setValueAtTime(6.0, now);
    formant.frequency.setValueAtTime(900, now);
    formant.frequency.linearRampToValueAtTime(2400, now + 0.5);
    formant.frequency.linearRampToValueAtTime(1100, now + 1.1);

    // 왼쪽 귀에서 오른쪽 귀 뒤로 스쳐 지나가는 HRTF 이동
    const panner = ctx.createPanner();
    panner.panningModel = "HRTF";
    const startSide = Math.random() < 0.5 ? -0.6 : 0.6;
    panner.positionX.setValueAtTime(startSide, now);
    panner.positionX.linearRampToValueAtTime(-startSide, now + duration);
    panner.positionY.setValueAtTime(0.1, now);
    panner.positionZ.setValueAtTime(0.35, now); // 귀 바로 뒤

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.005, now + duration);

    noise.connect(formant);
    formant.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    noise.start(now);
  }

  /* =========================================================
     [DOM 조작 1] HUD 텍스트 오염 (1.5초간 기괴한 문구로 변환 후 복구)
     ========================================================= */
  corruptUIElements() {
    // 현재 게임 DOM에서 텍스트가 들어있는 주요 HUD 요소 탐색
    const candidates = Array.from(document.querySelectorAll("div, span, b")).filter(el => {
      const txt = el.textContent.trim();
      return (
        el.children.length === 0 &&
        (txt === "메인 목표" || txt === "정상" || txt === "안전 구역" || txt === "외부" || txt.includes("열쇠") || txt.includes("교무실"))
      );
    });

    if (candidates.length === 0) return;

    const target = candidates[Math.floor(Math.random() * candidates.length)];
    if (target.dataset.corrupted === "true") return;

    const originalText = target.textContent;
    const creepyText = this.creepyPhrases[Math.floor(Math.random() * this.creepyPhrases.length)];

    target.dataset.corrupted = "true";
    target.textContent = creepyText;
    target.classList.add("hallucination-text");

    const restore = () => {
      target.textContent = originalText;
      target.classList.remove("hallucination-text");
      delete target.dataset.corrupted;
    };

    this.activeTextRestorers.push(restore);
    setTimeout(() => {
      restore();
      this.activeTextRestorers = this.activeTextRestorers.filter(fn => fn !== restore);
    }, 1600);
  }

  /* =========================================================
     [DOM + 오디오 2] 신호 없음 상태의 가짜 휴대폰 진동 및 문자 수신
     ========================================================= */
  triggerFakePhoneNotification() {
    const ctx = this._ensureAudio();
    const now = ctx.currentTime;

    // 휴대폰 웅-웅- 진동음 합성 (130Hz 사각파/사인파 변조)
    const playBuzz = (start) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(135, start);

      gain.gain.setValueAtTime(0.12, start);
      gain.gain.setValueAtTime(0.001, start + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.19);
    };

    playBuzz(now);
    playBuzz(now + 0.25);

    // 가짜 문자 토스트 표시
    const msg = this.fakeMessages[Math.floor(Math.random() * this.fakeMessages.length)];
    const box = document.getElementById("sanity-fake-sms");
    const senderEl = document.getElementById("sanity-sms-sender");
    const bodyEl = document.getElementById("sanity-sms-body");

    if (box && senderEl && bodyEl) {
      senderEl.textContent = `📱 ${msg.sender}`;
      bodyEl.textContent = msg.text;
      box.classList.add("show");

      setTimeout(() => {
        box.classList.remove("show");
      }, 4200);
    }
  }

  /* =========================================================
     [시각 연출] 순간적인 캔버스 색수차 및 프레임 왜곡
     ========================================================= */
  triggerScreenGlitch(durationMs = 220) {
    document.body.classList.add("sanity-glitch-frame");
    setTimeout(() => {
      document.body.classList.remove("sanity-glitch-frame");
    }, durationMs);
  }
}

// 전역 인스턴스 생성
window.sanitySystem = new SanityHallucinationSystem({ threshold: 75 });
export { SanityHallucinationSystem };
