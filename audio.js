// WebAudio 사운드 엔진 — 합성 효과음 + 공간 음향(HRTF) + 구역별 잔향/환경음 + 음악 + 음성(더빙) 재생
let ac = null, master, comp, bus = {}, rev, revSend, noiseBuf, proxGain, proxFilter;
const ok = () => ac && ac.state !== 'closed';
const VOL = { master: .9, sfx: 1, voice: 1, amb: .8, music: .6 };
try { Object.assign(VOL, JSON.parse(localStorage.getItem('haegyo_vol') || '{}')); } catch (e) { /* ignore */ }

function makeIR(sec, decay) {   // 합성 임펄스 응답 (잔향)
  const len = ac.sampleRate * sec, b = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (i < 40 ? i / 40 : 1); }
  return b;
}
function loopNoise(freq, type, q = 1) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.loopStart = Math.random();
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; s.connect(f); s.start(); return f;
}

export function initAudio() {
  if (ac) { ac.resume(); if (bgmEl && bgmEl.paused && bgmWant > 0) bgmEl.play().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ac.destination);
  master = ac.createGain(); master.gain.value = VOL.master; master.connect(comp);
  ['sfx', 'voice', 'amb', 'music'].forEach(k => { bus[k] = ac.createGain(); bus[k].gain.value = VOL[k]; bus[k].connect(master); });
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // 잔향 (효과음·음성에서 보냄)
  rev = ac.createConvolver(); rev.buffer = makeIR(2.6, 3.2);
  revSend = ac.createGain(); revSend.gain.value = .25; revSend.connect(rev); rev.connect(bus.sfx);
  // 낮은 드론 (항상)
  [43.6, 44.4, 65.4, 87.3].forEach((f, i) => {
    const o = ac.createOscillator(); o.type = i === 3 ? 'triangle' : 'sine'; o.frequency.value = f;
    const g = ac.createGain(); g.gain.value = i === 3 ? 0.01 : 0.04;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.05 + i * 0.03;
    const lg = ac.createGain(); lg.gain.value = 0.02; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    o.connect(g); g.connect(bus.amb); o.start();
  });
  ['school-bell', 'class-chime', 'pa-chime'].forEach(name => loadVoice(`assets/sfx/${name}.mp3`).then(b => { if (b) schoolSamples.set(name, b); }));
  buildAmbience();
  // 유령 근접음(숨소리/속삭임)
  proxFilter = loopNoise(900, 'bandpass', 3);
  proxGain = ac.createGain(); proxGain.gain.value = 0; proxFilter.connect(proxGain); proxGain.connect(bus.sfx);
  buildBreath(); buildGhostVoice(); buildMusic();
}
export function setVolumes(v) {
  Object.assign(VOL, v); try { localStorage.setItem('haegyo_vol', JSON.stringify(VOL)); } catch (e) { /* ignore */ }
  if (!ok()) return;
  master.gain.setTargetAtTime(VOL.master, ac.currentTime, .05);
  ['sfx', 'voice', 'amb', 'music'].forEach(k => bus[k].gain.setTargetAtTime(VOL[k], ac.currentTime, .05));
}
export const getVolumes = () => ({ ...VOL });

/* ----- 청취자 / 3D 위치 ----- */
export function setListener(x, y, z, fx, fz) {
  if (!ok()) return; const L = ac.listener, t = ac.currentTime;
  if (L.positionX) { L.positionX.setTargetAtTime(x, t, .02); L.positionY.setTargetAtTime(y, t, .02); L.positionZ.setTargetAtTime(z, t, .02); L.forwardX.setTargetAtTime(fx, t, .02); L.forwardY.setTargetAtTime(0, t, .02); L.forwardZ.setTargetAtTime(fz, t, .02); L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
  else { L.setPosition(x, y, z); L.setOrientation(fx, 0, fz, 0, 1, 0); }
}
function panner(p) {
  const n = ac.createPanner(); n.panningModel = 'HRTF'; n.distanceModel = 'inverse'; n.refDistance = 1.5; n.maxDistance = 60; n.rolloffFactor = 1.4;
  if (n.positionX) { n.positionX.value = p.x; n.positionY.value = p.y; n.positionZ.value = p.z; } else n.setPosition(p.x, p.y, p.z);
  return n;
}
let sfxPos = null;
// at(x, y, z).doorBang() 처럼 쓰면 그 소리를 해당 3D 위치에서 재생한다
export const at = (x, y, z) => new Proxy({}, { get: (_, k) => (...args) => { sfxPos = { x, y, z }; try { sfx[k](...args); } finally { sfxPos = null; } } });

function out(pan = 0, vol = 1, b = 'sfx') {
  const g = ac.createGain(); g.gain.value = vol;
  let dest = bus[b];
  if (sfxPos) { const pn = panner(sfxPos); g.connect(pn); pn.connect(dest); const s2 = ac.createGain(); s2.gain.value = .6; pn.connect(s2); s2.connect(revSend); }
  else if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(dest); g.connect(revSend); }
  else g.connect(dest);
  return g;
}
function noiseBurst(dur, freq, type, vol, pan = 0, v = 1) {
  if (!ok()) return;
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.7 + Math.random() * 0.6;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = out(pan, v);
  const e = ac.createGain(); e.gain.setValueAtTime(vol, ac.currentTime); e.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  s.connect(f); f.connect(e); e.connect(g); s.start(ac.currentTime, Math.random()); s.stop(ac.currentTime + dur + 0.05);
}
function tone(freq, dur, type, vol, pan = 0, v = 1, slide = null) {
  if (!ok()) return;
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, ac.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, ac.currentTime + dur);
  const e = ac.createGain(); e.gain.setValueAtTime(vol, ac.currentTime); e.gain.exponentialRampToValueAtTime(0.0008, ac.currentTime + dur);
  o.connect(e); e.connect(out(pan, v)); o.start(); o.stop(ac.currentTime + dur + 0.05);
}

// at(...) 으로 부른 소리의 뒤따르는 부분도 같은 자리에서 나도록 위치를 기억해 두었다가 재생
function later(ms, fn) { const p = sfxPos; setTimeout(() => { const o = sfxPos; sfxPos = p; try { fn(); } finally { sfxPos = o; } }, ms); }
// 흐르는 물 · 바람: 대역 노이즈 + 느린 흔들림 (dur 초)
function flow(dur, freq, vol, wob = .2, q = .7) {
  if (!ok()) return; const t = ac.currentTime;
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q; f.frequency.value = freq;
  const lfo = ac.createOscillator(); lfo.frequency.value = 2 + Math.random() * 4; const lg = ac.createGain(); lg.gain.value = freq * wob; lfo.connect(lg); lg.connect(f.frequency);
  const e = ac.createGain(); e.gain.setValueAtTime(.0001, t); e.gain.exponentialRampToValueAtTime(vol, t + Math.min(.4, dur * .2)); e.gain.setValueAtTime(vol, t + dur * .7); e.gain.exponentialRampToValueAtTime(.0001, t + dur);
  s.connect(f); f.connect(e); e.connect(out(0, 1)); s.start(t, Math.random()); s.stop(t + dur + .1); lfo.start(t); lfo.stop(t + dur + .1);
}

/* ----- 구역별 환경음 ----- */
const AMB = {}, rainNodes = [];
let rainLv = -1;
// 비의 세기 (해가 지기 전에는 비가 오지 않는다)
export function setRainLevel(k) { if (!ok() || Math.abs(k - rainLv) < .01) return; rainLv = k; rainNodes.forEach(([g, v]) => g.gain.setTargetAtTime(v * k, ac.currentTime, .8)); }
function amb(name, nodes) { const g = ac.createGain(); g.gain.value = 0; nodes.forEach(n => n.connect(g)); g.connect(bus.amb); AMB[name] = g; }
function buildAmbience() {
  // 바람
  const wind = loopNoise(380, 'lowpass'); const wl = ac.createOscillator(); wl.frequency.value = .09; const wlg = ac.createGain(); wlg.gain.value = 150; wl.connect(wlg); wlg.connect(wind.frequency); wl.start();
  const windG = ac.createGain(); windG.gain.value = .14; wind.connect(windG);
  // 빗소리 (고역 노이즈 + 저역 웅웅)
  const rainHi = loopNoise(5200, 'highpass'), rainLo = loopNoise(900, 'lowpass');
  const rH = ac.createGain(); rH.gain.value = .07; rainHi.connect(rH); const rL = ac.createGain(); rL.gain.value = .05; rainLo.connect(rL); rainNodes.push([rH, .07], [rL, .05]);
  // 귀뚜라미
  const cr = ac.createOscillator(); cr.frequency.value = 4400; const crA = ac.createGain(); crA.gain.value = 0; cr.connect(crA);
  const crL = ac.createOscillator(); crL.type = 'square'; crL.frequency.value = 18; const crLG = ac.createGain(); crLG.gain.value = .006; crL.connect(crLG); crLG.connect(crA.gain); cr.start(); crL.start();
  amb('out', [windG, rH, rL, crA]);
  // 실내 복도: 룸톤 + 형광등 웅 (120Hz)
  const room = loopNoise(260, 'lowpass'); const roomG = ac.createGain(); roomG.gain.value = .05; room.connect(roomG);
  const hum = ac.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 120; const humF = ac.createBiquadFilter(); humF.type = 'lowpass'; humF.frequency.value = 600; const humG = ac.createGain(); humG.gain.value = .006; hum.connect(humF); humF.connect(humG); hum.start();
  const rainIn = loopNoise(1400, 'lowpass'); const rainInG = ac.createGain(); rainInG.gain.value = .025; rainIn.connect(rainInG); rainNodes.push([rainInG, .025]);
  amb('in', [roomG, humG, rainInG]);
  // 지하: 기계 웅웅 + 배관
  const mh = ac.createOscillator(); mh.type = 'sawtooth'; mh.frequency.value = 50; const mhF = ac.createBiquadFilter(); mhF.type = 'lowpass'; mhF.frequency.value = 180; const mhG = ac.createGain(); mhG.gain.value = .05; mh.connect(mhF); mhF.connect(mhG); mh.start();
  const pipe = loopNoise(700, 'bandpass', 6); const pipeG = ac.createGain(); pipeG.gain.value = .03; pipe.connect(pipeG);
  amb('b1', [mhG, pipeG]);
  // 넓은 공간(체육관·수영장): 공기 + 먼 울림
  const hall = loopNoise(180, 'lowpass'); const hallG = ac.createGain(); hallG.gain.value = .08; hall.connect(hallG);
  amb('hall', [hallG]);
}
let curAmb = '', dripT = 0;
const REVERB = { out: .08, in: .25, room: .18, b1: .45, hall: .7, roof: .06 };
export function setAmbience(name, dt = .016) {
  if (!ok()) return;
  const key = name === 'roof' ? 'out' : name === 'room' ? 'in' : name;
  if (curAmb !== name) {
    curAmb = name;
    Object.entries(AMB).forEach(([k, g]) => g.gain.setTargetAtTime(k === key ? (name === 'roof' ? 1.3 : 1) : 0, ac.currentTime, .8));
    revSend.gain.setTargetAtTime(REVERB[name] ?? .2, ac.currentTime, .5);
  }
  // 무작위 물방울 (지하·수영장·실내)
  dripT -= dt;
  if (dripT <= 0) { dripT = 2 + Math.random() * 6; if (name === 'b1' || name === 'hall' || (name === 'in' && Math.random() < .4)) tone(1400 + Math.random() * 900, .1, 'sine', .05, Math.random() * 1.6 - .8, 1, 600); }
}

/* ----- 숨소리 (지침·은신·공포) ----- */
let breathG, breathPh = 0;
function buildBreath() { const f = loopNoise(1100, 'bandpass', 1.4); breathG = ac.createGain(); breathG.gain.value = 0; f.connect(breathG); breathG.connect(bus.sfx); }
export function setBreath(level, rate, dt) {
  if (!ok() || !breathG) return;
  breathPh += dt * rate; const cyc = (Math.sin(breathPh * 6.283) * .5 + .5); const env = Math.pow(cyc, 2.2);
  breathG.gain.setTargetAtTime(level * env * .09, ac.currentTime, .03);
}

/* ----- 유령 허밍 (위치 음향) ----- */
let gvPan, gvG, gvNotes = [], gvT = 0;
function buildGhostVoice() {
  gvPan = panner({ x: 0, y: -100, z: 0 }); gvPan.refDistance = 2; gvG = ac.createGain(); gvG.gain.value = 0; gvG.connect(gvPan); gvPan.connect(bus.sfx);
  const v1 = ac.createOscillator(); v1.type = 'sine'; const v2 = ac.createOscillator(); v2.type = 'triangle';
  const vib = ac.createOscillator(); vib.frequency.value = 5.2; const vibG = ac.createGain(); vibG.gain.value = 6; vib.connect(vibG); vibG.connect(v1.frequency); vibG.connect(v2.frequency); vib.start();
  // 사람의 콧노래처럼 들리도록 모음 '우' 의 포먼트 두 개(약 320 · 800Hz)로 거른다
  const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 320; f.Q.value = 2.2;
  const f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 800; f2.Q.value = 3;
  const vg = ac.createGain(); vg.gain.value = .9; v1.connect(f); v2.connect(f); v1.connect(f2); v2.connect(f2); f.connect(vg); const vg2 = ac.createGain(); vg2.gain.value = .4; f2.connect(vg2); vg2.connect(gvG); vg.connect(gvG); v1.start(); v2.start();
  gvNotes = [v1, v2];
  const wh = loopNoise(2600, 'bandpass', 2); const whG = ac.createGain(); whG.gain.value = .35; wh.connect(whG); whG.connect(gvG);
}
const MELODY = [392, 349, 311, 349, 392, 392, 392, 0, 349, 349, 349, 0, 392, 466, 466];   // "다시, 여기서" 동요풍 단조 선율
export function setGhostVoice(pos, level, chase, dt) {
  if (!ok() || !gvG) return;
  if (pos) { if (gvPan.positionX) { gvPan.positionX.setTargetAtTime(pos.x, ac.currentTime, .05); gvPan.positionY.setTargetAtTime(pos.y, ac.currentTime, .05); gvPan.positionZ.setTargetAtTime(pos.z, ac.currentTime, .05); } else gvPan.setPosition(pos.x, pos.y, pos.z); }
  gvT += dt * (chase ? 3.2 : 1.6);
  const n = MELODY[Math.floor(gvT) % MELODY.length] * (chase ? 1.06 : 1);
  if (n) gvNotes.forEach((o, i) => o.frequency.setTargetAtTime(n * (i ? 1.002 : 1) * (chase ? 1 + Math.sin(gvT * 9) * .03 : 1), ac.currentTime, .06));
  gvG.gain.setTargetAtTime(pos && n ? level * (chase ? .16 : .1) : 0, ac.currentTime, .12);
}

/* ----- 비상 발전기 웅웅거림 (디젤 엔진의 낮은 고동 + 50Hz 험) ----- */
let genG = null, genLv = 0;
function buildGen() {
  genG = ac.createGain(); genG.gain.value = 0; genG.connect(bus.amb);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.connect(genG);
  const am = ac.createGain(); am.gain.value = .6; am.connect(lp);
  [[50, 'sawtooth', .5], [25, 'square', .25], [100, 'sine', .25]].forEach(([f, t, v]) => { const o = ac.createOscillator(); o.type = t; o.frequency.value = f; const g = ac.createGain(); g.gain.value = v; o.connect(g); g.connect(am); o.start(); });
  const lfo = ac.createOscillator(); lfo.frequency.value = 7.3; const lg = ac.createGain(); lg.gain.value = .35; lfo.connect(lg); lg.connect(am.gain); lfo.start();   // 엔진 고동
  const n = loopNoise(160, 'lowpass', .8); const ng = ac.createGain(); ng.gain.value = .5; n.connect(ng); ng.connect(genG);
}
// 손전등 집중 조사: 코일 과부하처럼 높아지는 고주파 윙 소리 (level 0~1)
let coilG = null, coilO = null, coilLv = 0;
export function setCoil(level) {
  if (!ok()) return;
  if (!coilG) { coilO = ac.createOscillator(); coilO.type = 'sawtooth'; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 3; coilG = ac.createGain(); coilG.gain.value = 0; coilO.connect(f); f.connect(coilG); coilG.connect(bus.sfx); coilO.start(); }
  if (Math.abs(level - coilLv) < .01) return; coilLv = level;
  coilO.frequency.setTargetAtTime(900 + level * 3200 + Math.random() * 120, ac.currentTime, .05); coilG.gain.setTargetAtTime(level * .09, ac.currentTime, .06);
}
export function setGenHum(v, dt) { if (!ok()) return; if (!genG) buildGen(); const t = v * .09; if (Math.abs(t - genLv) > .002) { genLv = t; genG.gain.setTargetAtTime(t, ac.currentTime, .4); } }

/* ----- 음악 (메뉴 테마 · 추격) ----- */
let musG = {}, musMode = '', mbT = 0, mbI = 0, chaseT = 0;
// 게임 BGM 「폐교의 그림자」 (music/bgm_shadow.mp3): 스트리밍 재생, 대사 · 추격 때 자동으로 줄어든다
let bgmEl = null, bgmG = null, duckG = null, bgmOk = false, bgmWant = 0;
function buildTrack() {
  duckG = ac.createGain(); duckG.connect(bus.music);
  try {
    bgmEl = new Audio('music/bgm_shadow.mp3'); bgmEl.loop = true; bgmEl.preload = 'auto';
    bgmEl.addEventListener('playing', () => { bgmOk = true; }); bgmEl.addEventListener('error', () => { bgmOk = false; });
    const src = ac.createMediaElementSource(bgmEl); bgmG = ac.createGain(); bgmG.gain.value = 0; src.connect(bgmG); bgmG.connect(duckG);
  } catch (e) { bgmEl = null; }
}
export function duckMusic(on) { if (duckG) duckG.gain.setTargetAtTime(on ? .4 : 1, ac.currentTime, on ? .15 : .8); }
function buildMusic() {
  buildTrack();
  musG.menu = ac.createGain(); musG.menu.gain.value = 0; musG.menu.connect(bus.music);
  musG.chase = ac.createGain(); musG.chase.gain.value = 0; musG.chase.connect(bus.music);
  // 추격: 불협 현악 드론
  [55, 58.3, 82.4, 87.3].forEach(f => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 500; const g = ac.createGain(); g.gain.value = .025; o.connect(fl); fl.connect(g); g.connect(musG.chase); o.start(); });
}
const BOX = [659, 587, 523, 587, 659, 659, 659, 0, 587, 587, 587, 0, 659, 784, 784, 0];
function musicTone(f, dur, vol, type, g) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; const e = ac.createGain(); e.gain.setValueAtTime(vol, ac.currentTime); e.gain.exponentialRampToValueAtTime(.0005, ac.currentTime + dur); o.connect(e); e.connect(g); e.connect(revSend); o.start(); o.stop(ac.currentTime + dur + .05); }
// 타이틀 BGM: Am – F – C – E 진행의 느린 피아노 아르페지오 + 현악 패드 + 낮은 드론 + 음이 살짝 나간 오르골(학교종) 선율
const CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [130.8, 196, 261.6], [164.8, 207.7, 246.9]];
const BELL = [784, 784, 880, 880, 784, 784, 659, 0, 784, 784, 659, 659, 587, 0, 0, 0];
let bgmT = 0, bgmStep = 0, padNodes = null;
function piano(f, vol, dur = 3.2) {
  const t = ac.currentTime;
  [[1, 'triangle', 1], [2.001, 'sine', .35], [3.003, 'sine', .12]].forEach(([k, type, a]) => {
    const o = ac.createOscillator(); o.type = type; o.frequency.value = f * k;
    const e = ac.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(vol * a, t + .008); e.gain.exponentialRampToValueAtTime(.0004, t + dur / k);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; o.connect(lp); lp.connect(e); e.connect(musG.menu); e.connect(revSend); o.start(t); o.stop(t + dur + .1);
  });
}
function setPad(ch) {
  if (!padNodes) { padNodes = ch.map(() => { const o = ac.createOscillator(), o2 = ac.createOscillator(); o.type = o2.type = 'sawtooth'; o2.detune.value = 9; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; const g = ac.createGain(); g.gain.value = .011; o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(musG.menu); o.start(); o2.start(); return [o, o2]; }); }
  ch.forEach((f, i) => padNodes[i].forEach(o => o.frequency.setTargetAtTime(f / 2, ac.currentTime, .9)));
}
function menuBGM(dt) {
  bgmT -= dt; if (bgmT > 0) return; bgmT = .6;
  const bar = (bgmStep / 8 | 0) % 4, ch = CHORDS[bar], i = bgmStep % 8;
  if (i === 0) { setPad(ch); musicTone(ch[0] / 2, 5.2, .05, 'sine', musG.menu); }
  const arp = [0, 1, 2, 1, 0, 2, 1, 2][i]; piano(ch[arp] * (i > 3 ? 2 : 1), .045 + (i === 0 ? .02 : 0));
  const b = BELL[bgmStep % BELL.length]; if (b && bgmStep % 2 === 0 && (bgmStep / 16 | 0) % 2 === 1) { const d = 1 + (Math.random() - .5) * .01; musicTone(b * d, 2.2, .03, 'sine', musG.menu); musicTone(b * 2.004 * d, 1.1, .01, 'sine', musG.menu); }
  if (bgmStep % 32 === 31) { const t = ac.currentTime; const n = ac.createBufferSource(); n.buffer = noiseBuf; n.loop = true; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3000, t + 2.2); const e = ac.createGain(); e.gain.setValueAtTime(.0001, t); e.gain.exponentialRampToValueAtTime(.05, t + 2.2); e.gain.linearRampToValueAtTime(0, t + 2.3); n.connect(f); f.connect(e); e.connect(musG.menu); n.start(t); n.stop(t + 2.4); }
  bgmStep++;
}
// mode: menu | chase | none · game: 게임 중 BGM 크기(0 이면 끔)
export function setMusic(mode, dt, game = 0) {
  if (!ok() || !musG.menu) return;
  const want = mode === 'menu' ? 1 : mode === 'chase' ? 0 : game;
  if (bgmEl && Math.abs(want - bgmWant) > .01) { bgmWant = want; bgmG.gain.setTargetAtTime(want * .9, ac.currentTime, want > .5 ? .5 : 1.2); if (want > 0 && bgmEl.paused) bgmEl.play().catch(() => {}); }
  const synth = mode === 'menu' && !bgmOk;   // 음악 파일을 못 읽으면 합성 테마로 대신한다
  if (mode + synth !== musMode) { musMode = mode + synth; musG.menu.gain.setTargetAtTime(synth ? 1 : 0, ac.currentTime, .6); musG.chase.gain.setTargetAtTime(mode === 'chase' ? 1 : 0, ac.currentTime, mode === 'chase' ? .15 : 1.2); }
  if (synth) menuBGM(dt);
  if (mode === 'chase') { chaseT -= dt; if (chaseT <= 0) { chaseT = .42; musicTone(52, .25, .25, 'sine', musG.chase); setTimeout(() => ok() && musicTone(48, .2, .16, 'sine', musG.chase), 210); } }
}

/* ----- 음성 (더빙 파일 재생) ----- */
const vcache = new Map();
export async function loadVoice(url) {
  if (!ok()) return null; if (vcache.has(url)) return vcache.get(url);
  const p = fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status)).then(b => ac.decodeAudioData(b)).catch(() => null);
  vcache.set(url, p); return p;
}
// Samples use the effects bus, never the single dialogue source.
const schoolSamples = new Map(), schoolCueTimes = new Map();
function schoolCue(name, volume = .5, rate = 1) {
  if (!ok()) return false;
  const buffer = schoolSamples.get(name); if (!buffer) return false;
  const last = schoolCueTimes.get(name) ?? -Infinity;
  if (ac.currentTime - last < .5) return true;
  schoolCueTimes.set(name, ac.currentTime);
  const source = ac.createBufferSource(); source.buffer = buffer; source.playbackRate.value = rate;
  const gain = out(0, volume); source.connect(gain); source.start();
  source.addEventListener('ended', () => { source.disconnect(); gain.disconnect(); });
  return true;
}
let curVoice = null, voiceRequest = 0;
export const isVoicePlaying = () => !!curVoice;
export async function playVoice(url, fx = 'none', emo = null) {
  const request = ++voiceRequest;
  const buf = await loadVoice(url); if (request !== voiceRequest || !buf || !ok()) return null;
  if (curVoice) { try { curVoice.stop(); } catch (e) { /* ignore */ } }
  const s = ac.createBufferSource(); s.buffer = buf;
  // 감정: 재생 속도(=약간의 음높이) · 크기 · 떨림(공포) · 숨소리(속삭임)
  const rate = emo ? Math.max(.85, Math.min(1.15, (emo.rate + emo.pitch) / 2)) : 1; s.playbackRate.value = rate;
  let node = s;
  if (emo && (emo.trem || emo.airy)) {
    const tg = ac.createGain(); tg.gain.value = 1; s.connect(tg); node = tg;
    if (emo.trem) { const lfo = ac.createOscillator(); lfo.frequency.value = emo.trem; const lg = ac.createGain(); lg.gain.value = .14; lfo.connect(lg); lg.connect(tg.gain); lfo.start(); lfo.stop(ac.currentTime + buf.duration / rate + .2); }
    if (emo.airy) { const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 260; tg.connect(hp); node = hp; }
  }
  if (fx === 'phone' || fx === 'radio' || fx === 'pa') {
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = fx === 'pa' ? 350 : 500;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = fx === 'pa' ? 4200 : 3000;
    const sh = ac.createWaveShaper(); const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * (fx === 'radio' ? 3 : 1.8)); } sh.curve = c;
    node.connect(hp); hp.connect(lp); lp.connect(sh); node = sh;
    if (fx !== 'phone') { const source = ac.createBufferSource(); source.buffer = noiseBuf; source.loop = true;
      const n = ac.createBiquadFilter(); n.type = 'bandpass'; n.frequency.value = 3000; n.Q.value = .7; source.connect(n); source.start();
      const ng = ac.createGain(); ng.gain.value = fx === 'radio' ? .05 : .015; n.connect(ng); ng.connect(bus.voice); s.addEventListener('ended', () => { source.stop(); source.disconnect(); n.disconnect(); ng.disconnect(); }); }
  }
  const g = ac.createGain(); g.gain.value = (fx === 'whisper' ? .7 : 1) * (emo && emo.gain || 1); node.connect(g); g.connect(bus.voice);
  const sendG = ac.createGain(); sendG.gain.value = fx === 'pa' ? .9 : emo && emo.dry ? .05 : .25;
  g.connect(sendG); sendG.connect(revSend);
  const finished = new Promise(resolve => s.addEventListener('ended', resolve, { once: true }));
  s.start(); curVoice = s; duckMusic(true); s.addEventListener('ended', () => { if (curVoice === s) { curVoice = null; duckMusic(false); } });
  return { duration: buf.duration / rate, finished, stop: () => { try { s.stop(); } catch (e) { /* ignore */ } } };
}
export function stopVoice() { ++voiceRequest; if (curVoice) { try { curVoice.stop(); } catch (e) { /* ignore */ } curVoice = null; } duckMusic(false); }

export function setProximity(v, t) {
  if (!ok() || !proxGain) return;
  proxGain.gain.setTargetAtTime(v * 0.18, ac.currentTime, 0.2);
  proxFilter.frequency.setTargetAtTime(500 + 900 * (0.5 + 0.5 * Math.sin(t * 1.3)), ac.currentTime, 0.2);
}

export const sfx = {
  step(run = false, v = 1, surf = 'tile') {
    const k = run ? 1.5 : 1;
    if (surf === 'wood') { noiseBurst(.11, 420, 'lowpass', .32 * k, 0, v); tone(95 + Math.random() * 20, .09, 'sine', .14 * k, 0, v); }
    else if (surf === 'dirt') { noiseBurst(.16, 1800, 'bandpass', .22 * k, 0, v); noiseBurst(.1, 500, 'lowpass', .15 * k, 0, v); }
    else if (surf === 'metal') { noiseBurst(.08, 1400, 'bandpass', .3 * k, 0, v); tone(240 + Math.random() * 60, .18, 'triangle', .05 * k, 0, v); }
    else { noiseBurst(.07, 2400, 'bandpass', .26 * k, 0, v); noiseBurst(.08, 600, 'lowpass', .22 * k, 0, v); }
    if (Math.random() < .06) noiseBurst(.12, 3200, 'highpass', .08, 0, v);   // 종이·유리 조각 밟는 소리
  },
  ghostStep(dist, pan) { const v = Math.max(0, 1 - dist / 22); if (v > 0.02) { noiseBurst(0.14, 300, 'lowpass', 0.9 * v, pan); tone(70, 0.12, 'sine', 0.5 * v, pan); } },
  heartbeat(v = 1) { tone(58, 0.14, 'sine', 0.8 * v); setTimeout(() => tone(46, 0.18, 'sine', 0.6 * v), 130); },
  pickup() { tone(880, 0.5, 'sine', 0.25); setTimeout(() => tone(1320, 0.7, 'sine', 0.2), 90); },
  key() { [660, 880, 1320, 1760].forEach((f, i) => setTimeout(() => tone(f, 0.9, 'triangle', 0.22), i * 110)); },
  paper() { noiseBurst(0.25, 3000, 'highpass', 0.25); },
  click() { noiseBurst(0.03, 2500, 'highpass', 0.35); },
  locker() { noiseBurst(0.18, 700, 'bandpass', 0.5); tone(110, 0.25, 'square', 0.12, 0, 1, 70); },
  gateClang() { noiseBurst(0.9, 2200, 'bandpass', 0.7); [180, 243, 351].forEach(f => tone(f, 1.6, 'square', 0.09, 0, 1, f * 0.97)); tone(55, 0.8, 'sine', 0.9); },
  gateOpen() { tone(90, 3, 'sawtooth', 0.12, 0, 1, 60); noiseBurst(2.5, 600, 'bandpass', 0.2); },
  bang(pan = 0, v = 1) { noiseBurst(0.35, 500, 'lowpass', 1.0, pan, v); tone(60, 0.4, 'sine', 1.0, pan, v, 35); },
  creak(pan = 0) { tone(150, 1.2, 'sawtooth', 0.07, pan, 1, 95); },
  alert() { tone(392, 1.8, 'sine', .025); },
  screech() { flow(2.4, 780, .04, .35, 1.1); },
  stairs() { for (let i = 0; i < 6; i++) setTimeout(() => noiseBurst(0.1, 500, 'lowpass', 0.35), i * 180); },
  win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 1.6, 'sine', 0.25), i * 220)); },
  broadcast() { if (schoolCue('pa-chime', .6)) { noiseBurst(.3, 1800, 'bandpass', .025); return; } noiseBurst(.4, 1800, 'bandpass', .08); tone(880, .6, 'sine', .2, 0, 1, 660); setTimeout(() => tone(660, .9, 'sine', .2, 0, 1, 440), 700); setTimeout(() => noiseBurst(1.2, 2500, 'bandpass', .4), 1500); },
  doorSlide(v = 1) { noiseBurst(.55, 420, 'lowpass', .35 * v); tone(140, .5, 'sawtooth', .04 * v, 0, 1, 110); },
  doorHinge(v = 1) { tone(220, .6, 'sawtooth', .05 * v, 0, 1, 330); noiseBurst(.3, 900, 'bandpass', .15 * v); },
  doorBang(pan = 0, v = 1) { noiseBurst(.4, 380, 'lowpass', 1.1 * v, pan); tone(70, .35, 'sine', .9 * v, pan, 1, 40); noiseBurst(.15, 2500, 'bandpass', .3 * v, pan); },
  piano() { [196, 233, 220, 185, 196, 156, 175].forEach((f, i) => setTimeout(() => { tone(f, 2.2, 'triangle', .18); tone(f * 2.01, 1.6, 'sine', .05); }, i * 520 + Math.random() * 60)); },
  phone() { for (let i = 0; i < 3; i++) setTimeout(() => { noiseBurst(.35, 160, 'lowpass', .5); tone(120, .35, 'square', .05); }, i * 600); },
  beep() { tone(1400, .08, 'square', .07); },
  genChug(v = 1) { tone(38, .9, 'sawtooth', .22 * v, 0, 1, 26); noiseBurst(.7, 140, 'lowpass', .55 * v); setTimeout(() => { tone(44, .6, 'sawtooth', .16 * v, 0, 1, 52); noiseBurst(.35, 2600, 'highpass', .05 * v); }, 650); },
  crow(pan = 0) { [0, 380, 760].forEach((d, i) => setTimeout(() => { tone(620 - i * 30, .28, 'sawtooth', .05, pan, 1, 420); noiseBurst(.22, 1300, 'bandpass', .07, pan); }, d)); },
  ding() { tone(1318, 1.4, 'sine', .14); tone(2636, .6, 'sine', .03); setTimeout(() => { tone(1046, 1.8, 'sine', .12); tone(2092, .7, 'sine', .025); }, 260); },
  elevatorButton() { tone(1046.5,.09,'sine',.055);tone(1568,.055,'sine',.014); },
  elevatorChime() { tone(1046.5,.55,'sine',.08);later(150,()=>tone(1318.5,.8,'sine',.065)); },
  elevator(d = 2) { tone(62, d, 'sawtooth', .05, 0, 1, 58); tone(124, d, 'sine', .05); noiseBurst(d, 260, 'lowpass', .22); for (let i = 1; i < d * 2; i++) setTimeout(() => noiseBurst(.06, 900, 'bandpass', .12), i * 500 + Math.random() * 200); },
  buzz() { tone(110, .35, 'square', .15); tone(116, .35, 'square', .12); },
  unlock() { [880, 1175, 1568].forEach((f, i) => setTimeout(() => tone(f, .25, 'square', .06), i * 90)); setTimeout(() => { noiseBurst(.25, 600, 'lowpass', .5); tone(90, .4, 'sine', .4); }, 320); },
  breaker() { noiseBurst(.2, 300, 'lowpass', 1.2); tone(60, .5, 'sine', .9, 0, 1, 40); setTimeout(() => { tone(50, 2.5, 'sawtooth', .05); tone(100, 2.5, 'sine', .04); }, 250); },
  ball() { [0, 520, 960, 1330, 1640, 1890, 2090, 2250].forEach((t, i) => setTimeout(() => { noiseBurst(.12, 220, 'lowpass', .9 - i * .09); tone(85, .14, 'sine', .7 - i * .07); }, t)); },
  drip() { for (let i = 0; i < 6; i++) setTimeout(() => tone(1500 + Math.random() * 600, .12, 'sine', .08, Math.random() - .5, 1, 700), i * 800 + Math.random() * 400); },
  splash() { noiseBurst(1.2, 1200, 'bandpass', .5); noiseBurst(.6, 400, 'lowpass', .5); },
  lightsOff() { for (let i = 0; i < 6; i++) setTimeout(() => { noiseBurst(.05, 3000, 'highpass', .4); tone(60, .1, 'square', .05); }, i * 260); },
  thunder(far = 2) { const v = Math.max(.25, 1.2 - far * .3); noiseBurst(2.8 + far, 140, 'lowpass', v, 0, 1); noiseBurst(.4, 900, 'lowpass', v * .7, 0, 1); setTimeout(() => noiseBurst(2.2, 90, 'lowpass', v * .8), 300); },
  spark() { for (let i = 0; i < 5; i++) setTimeout(() => { noiseBurst(.04, 4000, 'highpass', .35); tone(120, .05, 'square', .04); }, i * 45 + Math.random() * 40); },
  classBell() { if (!schoolCue('class-chime', .65)) sfx.bell(); },
  bell() { if (schoolCue('school-bell', .65)) return; for (let i = 0; i < 16; i++) setTimeout(() => { tone(1250, .09, 'square', .12); tone(1880, .09, 'square', .06); }, i * 110); },
  tape() { noiseBurst(.25, 800, 'bandpass', .4); tone(60, .15, 'square', .06); },
  photo() { noiseBurst(.06, 3000, 'highpass', .4); tone(2200, .05, 'square', .04); },
  ui() { tone(880, .05, 'sine', .05); },
  // 미니게임 · 상호작용
  pick() { noiseBurst(.02, 5200, 'highpass', .18); tone(2600 + Math.random() * 600, .03, 'square', .02); },
  tension(v = .5) { tone(90 + v * 60, .08, 'sawtooth', .04 * v); noiseBurst(.04, 1800, 'bandpass', .08 * v); },
  pinBreak() { noiseBurst(.08, 6000, 'highpass', .5); tone(3200, .06, 'square', .05, 0, 1, 1800); },
  tumbler() { noiseBurst(.12, 900, 'bandpass', .5); tone(180, .2, 'square', .08, 0, 1, 120); setTimeout(() => { noiseBurst(.08, 2400, 'bandpass', .4); tone(520, .12, 'square', .05); }, 120); },
  dial() { noiseBurst(.025, 3800, 'bandpass', .3); tone(1900, .02, 'square', .02); },
  note(f) { tone(f, 1.8, 'triangle', .22); tone(f * 2.003, 1.2, 'sine', .06); tone(f * 3.01, .5, 'sine', .02); },
  clank(v = 1) { tone(1250, .25, 'square', .05 * v, 0, 1, 1100); tone(1840, .18, 'square', .03 * v); noiseBurst(.15, 3000, 'bandpass', .35 * v); setTimeout(() => { tone(1150, .15, 'square', .03 * v); noiseBurst(.08, 3000, 'bandpass', .2 * v); }, 160); },
  throwIt() { noiseBurst(.18, 1400, 'bandpass', .12); },
  hook() { noiseBurst(.4, 700, 'bandpass', .3); tone(240, .3, 'triangle', .06, 0, 1, 180); },
  slide() { noiseBurst(.08, 1200, 'bandpass', .25); tone(160, .06, 'sine', .08); },
  gasp() { noiseBurst(.6, 1500, 'bandpass', .5); tone(240, .4, 'sawtooth', .04, 0, 1, 160); },
  fuse() { noiseBurst(.1, 2600, 'highpass', .4); tone(70, .3, 'sine', .4); },
  crumble() { noiseBurst(1.1, 260, 'lowpass', .8); for (let i = 0; i < 8; i++) setTimeout(() => noiseBurst(.07, 1600 + Math.random() * 1500, 'bandpass', .25), 80 + i * 70 + Math.random() * 60); },
  staticNoise(d = 1.5) { noiseBurst(d, 4500, 'highpass', .18); noiseBurst(d, 900, 'bandpass', .08); },
  knock() { for (let i = 0; i < 3; i++) setTimeout(() => { noiseBurst(.07, 420, 'lowpass', .9); tone(95, .1, 'sine', .5); }, i * 280); },
  whisper() { noiseBurst(1.6, 2200, 'bandpass', 0.14); },
  // 그것의 소리 (at(x, y, z).ghostGiggle() 처럼 3D 위치에서 재생)
  ghostGiggle() {   // 높고 짧게 끊기는 어린 웃음
    const base = 560 + Math.random() * 120;
    for (let i = 0; i < 6; i++) setTimeout(() => { tone(base * (1 - i * .035), .09, 'sine', .07, 0, 1, base * .9); noiseBurst(.07, 1900 + Math.random() * 600, 'bandpass', .12); }, i * 115 + Math.random() * 25);
  },
  ghostSob() {     // 숨 섞인 흐느낌 세 번
    for (let i = 0; i < 3; i++) setTimeout(() => { noiseBurst(.45, 950, 'bandpass', .22); tone(330 - i * 18, .5, 'triangle', .035, 0, 1, 270 - i * 15); }, i * 720 + Math.random() * 120);
  },
  ghostWhisper() { // 알아들을 수 없는 속삭임 (음절처럼 끊기는 숨소리)
    const n = 4 + (Math.random() * 4 | 0); let t = 0;
    for (let i = 0; i < n; i++) { const d = .08 + Math.random() * .12, f = 1300 + Math.random() * 2200; setTimeout(() => noiseBurst(d, f, 'bandpass', .2), t * 1000); t += d + .05 + Math.random() * .12; }
  },
  ghostDrag() {    // 젖은 무언가를 끄는 소리 + 물방울
    for (let i = 0; i < 7; i++) setTimeout(() => noiseBurst(.28, 300 + Math.random() * 200, 'lowpass', .35), i * 210);
    setTimeout(() => { for (let i = 0; i < 4; i++) setTimeout(() => tone(1300 + Math.random() * 700, .1, 'sine', .05, 0, 1, 600), i * 260); }, 1500);
  },
  ghostBreath() {  // 아주 가까운 들숨 · 날숨
    noiseBurst(1.1, 700, 'bandpass', .18); setTimeout(() => noiseBurst(1.4, 420, 'bandpass', .22), 1250);
  },
  ghostCrack() { noiseBurst(.7, 1000, 'bandpass', .025); },
  ghostLaugh() {   // 늘어진 낮은 웃음 (놓쳤을 때)
    for (let i = 0; i < 5; i++) setTimeout(() => { tone(240 - i * 12, .22, 'sawtooth', .025, 0, 1, 200 - i * 10); noiseBurst(.18, 800, 'bandpass', .1); }, i * 260);
  },
  lightOn() {   // 형광등 점등: 스타터 '틱 틱' + 웅 하는 안정기 소리
    [0, 140, 420].forEach((d, i) => setTimeout(() => { noiseBurst(.03, 3500, 'highpass', .3); tone(100, .12, 'square', .03); }, d));
    setTimeout(() => tone(120, 1.4, 'sawtooth', .02, 0, 1, 119), 600);
  },
  // 인트로 · 연출
  vibrate() { for (let k = 0; k < 3; k++) [0, 170].forEach(d => setTimeout(() => { tone(150, .14, 'square', .05); tone(156, .14, 'square', .04); noiseBurst(.14, 220, 'lowpass', .35); }, k * 900 + d)); },
  swell(dur = 2.4, v = .5) {   // 역재생 심벌처럼 차오르다 끊기는 소리
    if (!ok()) return; const t = ac.currentTime;
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = .8; f.frequency.setValueAtTime(250, t); f.frequency.exponentialRampToValueAtTime(4200, t + dur);
    const e = ac.createGain(); e.gain.setValueAtTime(.0001, t); e.gain.exponentialRampToValueAtTime(v, t + dur); e.gain.linearRampToValueAtTime(0, t + dur + .06);
    s.connect(f); f.connect(e); e.connect(out(0, 1)); s.start(t); s.stop(t + dur + .1);
  },
  boom(v = 1) { tone(48, 3.2, 'sine', .9 * v, 0, 1, 30); tone(96, 1.4, 'triangle', .2 * v, 0, 1, 60); noiseBurst(1.8, 160, 'lowpass', .8 * v); noiseBurst(.25, 1400, 'lowpass', .35 * v); },
  musicBox(n = 8, step = .55) {   // 살짝 음이 나간 오르골 (학교종 선율)
    const M = [784, 784, 880, 880, 784, 784, 659, 0, 784, 784, 659, 659, 587];
    for (let i = 0; i < Math.min(n, M.length); i++) if (M[i]) setTimeout(() => { const d = 1 + (Math.random() - .5) * .012; tone(M[i] * d, 1.8, 'sine', .07); tone(M[i] * 2.005 * d, .9, 'sine', .025); tone(M[i] * 3.01, .3, 'triangle', .01); }, i * step * 1000 * (1 + i * .02));
  },
  rainGust() { noiseBurst(3.5, 1800, 'bandpass', .18); noiseBurst(3, 5200, 'highpass', .1); },
  flashlightClick() { noiseBurst(.03, 3000, 'highpass', .4); tone(900, .03, 'square', .03); },
  // ── 초자연 현상 · 화장실 ──
  flush() {   // 변기 물 내리는 소리: 손잡이 → 쏟아지는 물 → 꾸르륵 → 물탱크 채우는 쉿 소리
    noiseBurst(.06, 1800, 'bandpass', .4); tone(260, .08, 'square', .03);
    later(120, () => { flow(2.4, 700, .45, .45, .5); noiseBurst(1.6, 260, 'lowpass', .55); });
    for (let i = 0; i < 9; i++) later(1500 + i * 150 + Math.random() * 60, () => tone(160 + Math.random() * 180, .1, 'sine', .07, 0, 1, 80));
    later(2700, () => flow(4.5, 2600, .07, .08, 1.5));
  },
  faucet(d = 6) { noiseBurst(.1, 700, 'bandpass', .25); tone(320, .15, 'square', .02, 0, 1, 240); later(150, () => flow(d, 2300, .2, .12, .9)); later(d * 1000 + 200, () => this.drip()); },
  scream() { flow(2.8, 1100, .035, .4, 1.2); },
  thump(n = 4) { for (let i = 0; i < n; i++) later(i * 640 + Math.random() * 80, () => { noiseBurst(.28, 120, 'lowpass', .95); tone(46, .32, 'sine', .7, 0, 1, 30); noiseBurst(.4, 2600, 'highpass', .03); }); },
  chairScrape() { tone(210, .9, 'sawtooth', .05, 0, 1, 150); noiseBurst(.9, 700, 'bandpass', .3); later(1150, () => { tone(180, .5, 'sawtooth', .045, 0, 1, 140); noiseBurst(.5, 650, 'bandpass', .22); }); },
  glassCrack() { noiseBurst(.07, 6500, 'highpass', .65); tone(3400, .4, 'sine', .05, 0, 1, 2900); for (let i = 1; i < 5; i++) later(i * 70 + Math.random() * 50, () => { noiseBurst(.04, 5000, 'highpass', .35); tone(2800 + Math.random() * 1500, .15, 'sine', .03); }); },
  rattle(n = 16) { for (let i = 0; i < n; i++) later(i * 65 + Math.random() * 35, () => { noiseBurst(.05, 800 + Math.random() * 700, 'bandpass', .55); tone(150 + Math.random() * 90, .05, 'square', .04); }); },
  stinger(v = 1) { tone(196, 2.8, 'sine', .018 * Math.min(1,v)); tone(207.7, 3.1, 'sine', .012 * Math.min(1,v)); },
  pipeKnock() { for (let i = 0; i < 3; i++) later(i * 300 + Math.random() * 90, () => { tone(310 + Math.random() * 40, .22, 'square', .035, 0, 1, 280); noiseBurst(.12, 1100, 'bandpass', .4); tone(95, .15, 'sine', .25); }); },
  wind() { flow(4, 420, .16, .6, 1.2); tone(300, 3.5, 'sine', .015, 0, 1, 420); },
  stepBehind(v = 1) { noiseBurst(.07, 2400, 'bandpass', .24 * v); noiseBurst(.08, 600, 'lowpass', .24 * v); },
  bellFar() { if (schoolCue('school-bell', .14)) return; for (let i = 0; i < 18; i++) later(i * 110, () => { tone(1250, .1, 'square', .03); tone(1880, .08, 'square', .012); }); },
  tissue() { noiseBurst(.5, 4200, 'highpass', .18); later(380, () => noiseBurst(.35, 3600, 'highpass', .14)); },
  stallCreak() { tone(180, 2.4, 'sawtooth', .045, 0, 1, 120); noiseBurst(2.2, 900, 'bandpass', .08); },
  heartWall() { for (let i = 0; i < 6; i++) later(i * 820, () => { tone(52, .16, 'sine', .55); later(140, () => tone(44, .2, 'sine', .4)); }); },
  chimeWarp(d = 15) {   // 기괴하게 늘어진 학교 종 (딩동댕동을 반음 낮추고 느리게, 음이 흔들린다) + 지지직 잡음
    if (schoolCue('class-chime', .42, .58)) { noiseBurst(.4, 2800, 'bandpass', .025); return; }
    const M = [659, 523, 587, 392, 0, 392, 587, 659, 523];
    M.forEach((f, i) => { if (f) later(i * 1300, () => { const g = f * .5 * (1 - i * .012); tone(g, 2.6, 'sine', .14, 0, 1, g * .94); tone(g * 2.01, 1.8, 'sine', .05, 0, 1, g * 1.9); tone(g * 2.98, .9, 'triangle', .02); }); });
    for (let k = 0; k < d / 1.5; k++) later(k * 1500 + Math.random() * 400, () => { noiseBurst(1.6, 3200 + Math.random() * 1500, 'bandpass', .07); noiseBurst(.3, 900, 'bandpass', .06); });
  },
  slap() { noiseBurst(.09, 900, 'lowpass', .55); noiseBurst(.05, 2600, 'bandpass', .12); },
  radioVoice() { noiseBurst(2.4, 2600, 'bandpass', .22); for (let i = 0; i < 9; i++) later(300 + i * 190, () => { const f = 300 + Math.random() * 260; tone(f, .16, 'sawtooth', .02, 0, 1, f * .85); noiseBurst(.12, 1400 + Math.random() * 800, 'bandpass', .12); }); },
};
// 사용자 제공 패치 모듈(자체 Web Audio 합성음)이 쓰는 컨텍스트: 게임 오디오 컨텍스트를 그대로 주되, 출력(destination)은 효과음 버스로 —
// 설정의 마스터 · 효과음 볼륨이 패치 소리에도 적용된다
export const sfxCtx = new Proxy({}, { get(_, k) { if (!ac) initAudio(); if (!ac) return undefined; if (k === 'destination') return bus.sfx; const v = ac[k]; return typeof v === 'function' ? v.bind(ac) : v; } });
