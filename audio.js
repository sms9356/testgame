// WebAudio 합성 사운드 — 외부 음원 없이 공포 분위기를 만든다.
let ac = null, master, noiseBuf, proxGain, proxFilter;
const ok = () => ac && ac.state !== 'closed';

export function initAudio() {
  if (ac) { ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = 0.85; master.connect(ac.destination);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  // 낮은 드론
  [43.6, 44.4, 65.4, 87.3].forEach((f, i) => {
    const o = ac.createOscillator(); o.type = i === 3 ? 'triangle' : 'sine'; o.frequency.value = f;
    const g = ac.createGain(); g.gain.value = i === 3 ? 0.012 : 0.05;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.05 + i * 0.03;
    const lg = ac.createGain(); lg.gain.value = 0.02; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    o.connect(g); g.connect(master); o.start();
  });
  // 바람
  const w = ac.createBufferSource(); w.buffer = noiseBuf; w.loop = true;
  const wf = ac.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 380;
  const wg = ac.createGain(); wg.gain.value = 0.07;
  const wl = ac.createOscillator(); wl.frequency.value = 0.11; const wlg = ac.createGain(); wlg.gain.value = 0.05;
  wl.connect(wlg); wlg.connect(wg.gain); wl.start();
  w.connect(wf); wf.connect(wg); wg.connect(master); w.start();
  // 유령 근접음(숨소리/속삭임)
  const p = ac.createBufferSource(); p.buffer = noiseBuf; p.loop = true;
  proxFilter = ac.createBiquadFilter(); proxFilter.type = 'bandpass'; proxFilter.frequency.value = 900; proxFilter.Q.value = 3;
  proxGain = ac.createGain(); proxGain.gain.value = 0;
  p.connect(proxFilter); proxFilter.connect(proxGain); proxGain.connect(master); p.start();
}

export function setProximity(v, t) {
  if (!ok() || !proxGain) return;
  proxGain.gain.setTargetAtTime(v * 0.22, ac.currentTime, 0.2);
  proxFilter.frequency.setTargetAtTime(500 + 900 * (0.5 + 0.5 * Math.sin(t * 1.3)), ac.currentTime, 0.2);
}

function out(pan = 0, vol = 1) {
  const g = ac.createGain(); g.gain.value = vol;
  if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(master); }
  else g.connect(master);
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

export const sfx = {
  step(run = false, v = 1) { noiseBurst(0.09, run ? 900 : 600, 'lowpass', run ? 0.5 : 0.28, 0, v); },
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
  alert() { tone(300, 0.9, 'sawtooth', 0.22, 0, 1, 110); noiseBurst(0.7, 1500, 'bandpass', 0.25); },
  screech() {
    tone(500, 1.4, 'sawtooth', 0.5, 0, 1, 2400); tone(333, 1.4, 'square', 0.3, 0, 1, 1900);
    noiseBurst(1.4, 3000, 'bandpass', 0.9); tone(50, 1.4, 'sine', 1, 0, 1, 30);
  },
  stairs() { for (let i = 0; i < 6; i++) setTimeout(() => noiseBurst(0.1, 500, 'lowpass', 0.35), i * 180); },
  win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 1.6, 'sine', 0.25), i * 220)); },
  whisper() { noiseBurst(1.6, 2200, 'bandpass', 0.14); },
};
