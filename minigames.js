// 미니게임: 자물쇠 따기 · 다이얼 자물쇠 · 배선 퍼즐 · 피아노 · 슬라이딩 퍼즐 · 갈고리 낚기 · 녹음 순서 · 짝 맞추기 · 주파수 · 순서 따라 하기 · 타이밍 · 테이프 판독
//          + 증기 배관(압력) · 어둠 속 미로(경비원 순찰) · 맞물린 고리 암호 · 틀린 그림 찾기 · 퓨즈판
// run(kind, opts) → Promise<{ ok }>. 열려 있는 동안 MG.active 가 true 이고, 키 입력은 여기서 처리한다.
import { sfx } from './audio.js?v=140';
import * as THREE from './vendor/three.module.js';

export const MG = { active: false, win: () => { if (finish) close(true); } };   // win: 디버그용 즉시 성공
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let finish = null, keyH = null, raf = 0, cleanups = [], errN = 0, hintTimer = 0;

function injectAltBar(title) {
  let bar = document.getElementById('mgAltBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'mgAltBar';
    bar.style.cssText = 'margin-top:10px;padding-top:9px;border-top:1px dashed rgba(210,195,155,0.28);display:flex;justify-content:center;gap:10px;flex-wrap:wrap;';
    $('mgBody').parentElement.appendChild(bar);
  }
  bar.innerHTML = '';
  if (!/선긋기|크로키/.test(title)) {
    const btnLine = document.createElement('button');
    btnLine.type = 'button';
    btnLine.textContent = '✏ 대안 1: 선긋기(스케치 연결)로 풀기';
    btnLine.style.cssText = 'background:#243848;color:#d8f0ff;border:1px solid #5898c8;padding:6px 13px;border-radius:4px;font-size:12.5px;font-weight:bold;cursor:pointer;';
    btnLine.onclick = () => { if (!MG.active) return; switchToSketchLine(title); };
    bar.appendChild(btnLine);
  }
  const btnDeduce = document.createElement('button'); btnDeduce.id = 'mgDeduce'; btnDeduce.style.display = 'none';
  btnDeduce.type = 'button';
  btnDeduce.textContent = '💡 대안 2: 현장 단서 추리로 즉시 해독';
  btnDeduce.style.cssText = 'display:none;background:#3a2d1d;color:#ffe6a8;border:1px solid #b89248;padding:6px 13px;border-radius:4px;font-size:12.5px;font-weight:bold;cursor:pointer;';
  btnDeduce.onclick = () => { if (!MG.active) return; sfx.unlock(); status('현장 단서 추리로 해독 성공!', 'ok'); close(true); };
  bar.appendChild(btnDeduce);
}
/* ---------- 3D 무대: 모든 미니게임 화면을 실제 사물 위에 올린다 ----------
   책상(나뭇결) · 기기 본체(주제에 따라 강철 제어반 / 종이 서류 / 검은 장비) · 마우스를 따라 움직이는 손전등 빛 · 먼지 · 화면 반사광
   게임 캔버스는 CSS 3D 로 같은 각도만큼 눕혀 기기 앞면에 얹는다 (브라우저가 기울어진 화면 위 클릭 좌표를 그대로 맞춰 준다) */
const ST = { r: null, sc: null, cam: null, slab: null, spot: null, desk: null, dust: null, raf: 0, mx: .5, my: .5, theme: '' };
function stageTheme(t) { return /배선|퓨즈|배관|단말기|밸브|오실로|회로|금고|다이얼|전력|수압|차단기|증기|고리|주파수|라디오|수신기|콘솔/.test(t) ? 'metal' : /OMR|시간표|도서|카드|승인|서류|사진|그림|쪽지|명찰|신문|필름|테이프|판독|순서|맞추기/.test(t) ? 'paper' : 'device'; }
function stageInit() {
  if (ST.r) return ST.r; try { ST.r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { ST.r = false; return false; }
  const r = ST.r; r.setPixelRatio(Math.min(1.5, devicePixelRatio || 1)); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true;
  r.domElement.className = 'mgStageBg'; const sc = ST.sc = new THREE.Scene(); sc.fog = new THREE.Fog(0x050404, 6, 14);
  ST.cam = new THREE.PerspectiveCamera(30, 1.5, .1, 40); ST.cam.position.set(0, 5.6, 2.6); ST.cam.lookAt(0, 0, .2);
  const wc = document.createElement('canvas'); wc.width = wc.height = 512; const g = wc.getContext('2d'); g.fillStyle = '#5a3a1e'; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y++) { const v = 60 + 30 * Math.sin(y * .09 + Math.sin(y * .013) * 4) + Math.random() * 14; g.fillStyle = `rgba(${v + 40},${v * .6 + 10},${v * .3},.35)`; g.fillRect(0, y, 512, 1); }
  for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(20,10,4,.25)'; g.beginPath(); const x = Math.random() * 512, y = Math.random() * 512; g.moveTo(x, y); g.lineTo(x + Math.random() * 90 - 45, y + Math.random() * 6); g.stroke(); }
  const wt = new THREE.CanvasTexture(wc); wt.colorSpace = THREE.SRGBColorSpace; wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(2, 2);
  ST.desk = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), new THREE.MeshStandardMaterial({ map: wt, roughness: .62, bumpMap: wt, bumpScale: .6 })); ST.desk.rotation.x = -Math.PI / 2; ST.desk.receiveShadow = true; sc.add(ST.desk);
  ST.slab = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x222, roughness: .5, metalness: .3 })); ST.slab.castShadow = true; sc.add(ST.slab);
  // 소품: 머그컵 · 볼펜 · 흩어진 종이 (어둑한 책상 위 현실감)
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(.22, .2, .42, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xe8e2d8, roughness: .3, side: THREE.DoubleSide })); mug.position.set(2.9, .21, -.6); mug.castShadow = true; sc.add(mug);
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.1, 10), new THREE.MeshStandardMaterial({ color: 0x1a2a60, roughness: .3, metalness: .4 })); pen.rotation.set(0, .6, Math.PI / 2); pen.position.set(-2.8, .03, 1.1); pen.castShadow = true; sc.add(pen);
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.9), new THREE.MeshStandardMaterial({ color: 0xd8cfb8, roughness: .95 })); sheet.rotation.set(-Math.PI / 2, 0, .35); sheet.position.set(-3.1, .005, -1.0); sheet.receiveShadow = true; sc.add(sheet);
  sc.add(new THREE.HemisphereLight(0x8a9ab0, 0x1a1008, .25));
  ST.spot = new THREE.SpotLight(0xfff0d8, 60, 14, .55, .6, 1.6); ST.spot.position.set(0, 5, 2.5); ST.spot.castShadow = true; ST.spot.shadow.mapSize.set(1024, 1024); sc.add(ST.spot, ST.spot.target);
  const dg = new THREE.BufferGeometry(), dp = new Float32Array(240 * 3); for (let i = 0; i < 240; i++) { dp[i * 3] = (Math.random() - .5) * 8; dp[i * 3 + 1] = Math.random() * 3; dp[i * 3 + 2] = (Math.random() - .5) * 6; } dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  ST.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffeedd, size: .02, transparent: true, opacity: .5, depthWrite: false })); sc.add(ST.dust);
  return r;
}
function stageWrap(cv) {
  const r = stageInit(); if (!r || cv.dataset.st || cv.closest('.mgStage')) return; cv.dataset.st = '1';
  const W = cv.width || cv.offsetWidth, H = cv.height || cv.offsetHeight, theme = stageTheme($('mgTitle').textContent || ''), box = document.createElement('div'); box.className = 'mgStage';
  const sw = Math.min(W + 120, 640), sh = H + 110; box.style.cssText = `position:relative;width:${sw}px;max-width:100%;height:${sh}px;perspective:2000px;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:6px;background:#050404`;
  cv.parentNode.insertBefore(box, cv); box.appendChild(r.domElement); box.appendChild(cv);
  r.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'; r.setSize(sw, sh, false); ST.cam.aspect = sw / sh; ST.cam.updateProjectionMatrix();
  cv.style.position = 'relative'; cv.style.transform = 'rotateX(9deg) translateY(-4px)'; cv.style.transformOrigin = '50% 60%'; cv.style.boxShadow = '0 18px 30px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.06)';
  cv.style.borderRadius = theme === 'paper' ? '2px' : '4px'; if (theme === 'paper') cv.style.filter = 'sepia(.25) contrast(1.05)';
  const gl = document.createElement('div'); gl.style.cssText = `position:absolute;pointer-events:none;width:${W}px;height:${H}px;transform:rotateX(9deg) translateY(-4px);transform-origin:50% 60%;background:linear-gradient(115deg,rgba(255,255,255,.10) 0%,rgba(255,255,255,0) 35%,rgba(255,255,255,0) 70%,rgba(255,255,255,.05) 100%);mix-blend-mode:screen;border-radius:4px`; box.appendChild(gl);
  // 기기 본체: 캔버스 비율에 맞춰 화면보다 한 뼘 크게 (주제별 재질)
  const k = 3.6 / Math.max(W, H * 1.2), w3 = W * k + (theme === 'paper' ? .25 : .55), d3 = H * k + (theme === 'paper' ? .3 : .6);
  ST.slab.scale.set(w3, theme === 'paper' ? .02 : .22, d3); ST.slab.position.set(0, ST.slab.scale.y / 2, .15);
  ST.slab.material.color.setHex(theme === 'metal' ? 0x4a5058 : theme === 'paper' ? 0xe0d6bc : 0x1c1c20); ST.slab.material.metalness = theme === 'metal' ? .75 : theme === 'paper' ? 0 : .3; ST.slab.material.roughness = theme === 'paper' ? .95 : theme === 'metal' ? .38 : .45;
  ST.theme = theme;
  const mv = e => { const b = box.getBoundingClientRect(); ST.mx = (e.clientX - b.left) / b.width; ST.my = (e.clientY - b.top) / b.height; }; box.addEventListener('mousemove', mv);
  cancelAnimationFrame(ST.raf); const t0 = performance.now();
  const loop = () => { if (!MG.active || !box.isConnected) return; const t = (performance.now() - t0) / 1000;
    ST.spot.target.position.set((ST.mx - .5) * 5, 0, (ST.my - .5) * 4); ST.spot.position.set((ST.mx - .5) * 2 + Math.sin(t * 1.3) * .05, 5, 2.5 + Math.cos(t * 1.1) * .05);
    ST.spot.intensity = 58 + Math.sin(t * 7) * 1.5 + (Math.random() < .01 ? -25 : 0);   // 손전등 미세 떨림 · 가끔 깜박
    ST.dust.rotation.y = t * .02; ST.dust.position.y = Math.sin(t * .3) * .05; r.render(ST.sc, ST.cam); ST.raf = requestAnimationFrame(loop); };
  ST.raf = requestAnimationFrame(loop);
}
function open(title, hint) {
  MG.active = true;
  $('mgTitle').textContent = title; $('mgHint').innerHTML = hint || ''; $('mgStatus').textContent = ''; $('mgStatus').className = '';
  $('mgBody').innerHTML = ''; $('mg').classList.add('show');
  { const body = $('mgBody'); if (ST.obs) ST.obs.disconnect(); ST.obs = new MutationObserver(() => body.querySelectorAll('canvas.mgCanvas:not([data-st]):not([data-own3d])').forEach(c => { if (c.width >= 200 && c.height >= 120) stageWrap(c); })); ST.obs.observe(body, { childList: true, subtree: true }); }
  // 캔버스 없는 미니게임(버튼 · 카드 격자 등): 첫 화면이 그려진 뒤 본문 첫 덩어리를 같은 무대에 얹는다
  setTimeout(() => { const body = $('mgBody'); if (!MG.active || body.querySelector('canvas.mgCanvas, .mgStage')) return; const el = [...body.children].find(e => !e.classList.contains('mgInfo') && e.offsetWidth >= 200 && e.offsetHeight >= 100); if (el) { el.style.background = el.style.background || 'transparent'; stageWrap(el); } }, 60);
  injectAltBar(title); errN = 0; clearTimeout(hintTimer); hintTimer = setTimeout(showDeduce, 60000);   // 단서 추리(즉시 해독)는 두 번 실패하거나 1분이 지나야 나온다
  return new Promise(res => { finish = res; });
}
function showDeduce() { const b = document.getElementById('mgDeduce'); if (b && MG.active) b.style.display = ''; }
function close(ok) {
  cancelAnimationFrame(raf); raf = 0; clearTimeout(hintTimer);
  if (keyH) { removeEventListener('keydown', keyH, true); removeEventListener('keyup', keyH, true); keyH = null; }
  cleanups.forEach(f => f()); cleanups = []; if (ST.obs) ST.obs.disconnect(); cancelAnimationFrame(ST.raf);
  const f = finish; finish = null;
  const done = () => { $('mg').classList.remove('show'); MG.active = false; if (f) f({ ok }); };
  if (ok) { $('mgStatus').textContent = '성공!'; $('mgStatus').className = 'ok'; setTimeout(done, 650); } else done();
}
const status = (t, cls = '') => { $('mgStatus').textContent = t; $('mgStatus').className = cls; if (cls === 'err' && ++errN >= 2) showDeduce(); };
function keys(fn) {
  keyH = e => {
    if (e.type === 'keydown' && (e.code === 'Escape' || e.code === 'Tab')) { e.preventDefault(); e.stopImmediatePropagation(); close(false); return; }
    e.stopImmediatePropagation(); if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    fn(e);
  };
  addEventListener('keydown', keyH, true); addEventListener('keyup', keyH, true);
}
// 3D 기기 화면: 2D 캔버스를 실제 장비(브라운관 오실로스코프·금속 단말기·나무 게임판)의 화면 텍스처로 띄운다.
//   원래 캔버스는 화면 밖에 숨기고(크기는 유지 — 기존 좌표 계산 그대로), 화면을 클릭/드래그/휠하면 같은 위치로 이벤트를 넘긴다.
//   knobs(): [0..1] 배열을 돌려주면 하단 회전 노브가 그 값대로 돈다.
function screen3D(c, { kind = 'metal', knobs = null, prop = null, anim = null, pick = null } = {}) {
  let r; try { r = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { return; }
  const W = 480, H = Math.round(480 * (c.height / c.width) + 70); r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(W, H); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
  r.domElement.className = 'mgCanvas'; r.domElement.dataset.own3d = '1'; c.dataset.st = '1'; c.parentNode.insertBefore(r.domElement, c);
  c.style.cssText += ';position:fixed;left:-10000px;top:0;opacity:0;pointer-events:none';
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0a0908); const cam = new THREE.PerspectiveCamera(30, W / H, .05, 30);
  sc.add(new THREE.HemisphereLight(0xfff2e0, 0x120c08, .55)); const L = new THREE.SpotLight(0xfff0dc, 22, 8, .7, .5, 1.3); L.position.set(.6, 2.2, 2.4); sc.add(L, L.target);
  const asp = c.width / c.height, sw = 1.6, shh = sw / asp, tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const bodyC = kind === 'scope' ? 0x8a8c84 : kind === 'wood' ? 0x5c3a1e : kind === 'paper' ? 0x6e4a2a : 0x3c424a;
  const body = new THREE.Mesh(new THREE.BoxGeometry(sw + .34, shh + .62, .7), new THREE.MeshStandardMaterial({ color: bodyC, roughness: kind === 'wood' || kind === 'paper' ? .7 : .45, metalness: kind === 'metal' ? .6 : .15 })); body.position.set(0, -.14, -.36); sc.add(body);
  const bez = new THREE.Mesh(new THREE.BoxGeometry(sw + .1, shh + .1, .04), new THREE.MeshStandardMaterial({ color: kind === 'paper' ? 0xd8ccb0 : 0x141414, roughness: .6 })); bez.position.z = .0; sc.add(bez);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(sw, shh), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); scr.position.z = .025; sc.add(scr);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(sw, shh), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .08, roughness: .05, clearcoat: 1 })); glass.position.z = .03; sc.add(glass);
  const kn = []; if (knobs) { const n = knobs().length; for (let i = 0; i < n; i++) { const g = new THREE.Group(); const k = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, .06, 24), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: .4, metalness: .3 })); k.rotation.x = Math.PI / 2; g.add(k); const m = new THREE.Mesh(new THREE.BoxGeometry(.012, .05, .01), new THREE.MeshBasicMaterial({ color: 0xffffff })); m.position.set(0, .04, .035); g.add(m); g.position.set((i - (n - 1) / 2) * .45, -shh / 2 - .26, .02); sc.add(g); kn.push(g); } }
  if (kind === 'scope') { const led = new THREE.Mesh(new THREE.SphereGeometry(.018, 10, 8), new THREE.MeshBasicMaterial({ color: 0x40ff80 })); led.position.set(sw / 2 + .07, -shh / 2 - .26, .02); sc.add(led); }
  // 기기 옆/위 소품 (실제 장비 느낌): 책상 상판 + 주제별 3D 소품
  const yTop = -.14 + (shh + .62) / 2, yBot = -.14 - (shh + .62) / 2, spin = [], M = (c3, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c3, roughness: .5 }, o));
  const desk = new THREE.Mesh(new THREE.BoxGeometry(sw + 3, .06, 1.6), M(0x4a3420, { roughness: .75 })); desk.position.set(0, yBot - .03, -.3); sc.add(desk);
  const P = new THREE.Group(); sc.add(P); let side = 0;
  if (prop === 'antenna') { const a2 = new THREE.Mesh(new THREE.CylinderGeometry(.006, .01, .6, 6), M(0xc8c8c8, { metalness: .9, roughness: .2 })); a2.position.set(sw / 2 - .05, yTop + .28, -.3); a2.rotation.z = -.35; P.add(a2); }
  if (prop === 'reels') [-.38, .38].forEach(x => { const g = new THREE.Group(); const d = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .03, 32), M(0x9aa0a8, { metalness: .8, roughness: .3 })); d.rotation.x = Math.PI / 2; g.add(d); for (let k = 0; k < 3; k++) { const h2 = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .04, 14), M(0x111111)); h2.rotation.x = Math.PI / 2; h2.position.set(Math.cos(k * 2.1) * .16, Math.sin(k * 2.1) * .16, 0); g.add(h2); } g.position.set(x, yTop + .3, -.3); P.add(g); spin.push(g); });
  const picks = []; let VL = null, VS = null;
  if (prop === 'valves') {   // 화면 아래 배관 3줄: 빨간 핸들 밸브(클릭하면 그 밸브를 돌림) + 압력계 바늘이 PSI 를 따라간다
    const pipeM = M(0x6a5a48, { metalness: .7, roughness: .45 }), red = M(0xb02020, { metalness: .4, roughness: .4 }), face = M(0xf0ece0, { roughness: .6 }), grn = new THREE.MeshBasicMaterial({ color: 0x40c070, side: THREE.DoubleSide });
    VL = [-.55, 0, .55].map((x, i) => { const pp = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .9, 16), pipeM); pp.position.set(x * sw / 1.6, yBot + .05, .5); pp.scale.y = .25; P.add(pp);
      const wh = new THREE.Group(); wh.position.set(x * sw / 1.6 - .08, yBot + .2, .6); P.add(wh); const rim = new THREE.Mesh(new THREE.TorusGeometry(.12, .016, 8, 28), red); wh.add(rim); for (let k = 0; k < 4; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(.24, .016, .016), red); sp.rotation.z = k * Math.PI / 4; wh.add(sp); }
      const hit = new THREE.Mesh(new THREE.CircleGeometry(.15, 16), new THREE.MeshBasicMaterial({ visible: false })); hit.userData.pick = i; wh.add(hit); picks.push(hit);
      const gg = new THREE.Group(); gg.position.set(x * sw / 1.6 + .14, yBot + .14, .58); P.add(gg); gg.add(new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, .03, 24).rotateX(Math.PI / 2), M(0x30343a, { metalness: .7 }))); const fc = new THREE.Mesh(new THREE.CircleGeometry(.07, 24), face); fc.position.z = .016; gg.add(fc);
      const zone = new THREE.Mesh(new THREE.RingGeometry(.05, .066, 16, 1, Math.PI / 2 - .25, .5), grn); zone.position.z = .017; gg.add(zone);
      const nd = new THREE.Mesh(new THREE.BoxGeometry(.006, .06, .004), M(0xc01010)); nd.geometry.translate(0, .03, 0); nd.position.z = .019; gg.add(nd); return { wh, nd }; });
  }
  if (prop === 'breaker') {   // 배전반 아래: R·S·T 상 트림 다이얼 3개(전압 따라 회전, 클릭하면 조절) + 큰 차단기 레버
    const blk = M(0x1c1c1c, { roughness: .4 }), crm = M(0xc8ccd0, { metalness: .9, roughness: .2 }); const cols3 = [0xd03030, 0xe0c030, 0x3070d0];
    VS = { dials: [-.5, -.15, .2].map((x, i) => { const d = new THREE.Group(); d.position.set(x * sw / 1.4, yBot + .12, .55); P.add(d); d.add(new THREE.Mesh(new THREE.CylinderGeometry(.09, .1, .06, 28).rotateX(Math.PI / 2), blk)); const mk = new THREE.Mesh(new THREE.BoxGeometry(.012, .07, .01), M(cols3[i], { emissive: cols3[i], emissiveIntensity: .4 })); mk.position.set(0, .045, .035); d.add(mk); const hit = new THREE.Mesh(new THREE.CircleGeometry(.11, 16), new THREE.MeshBasicMaterial({ visible: false })); hit.position.z = .04; hit.userData.pick = i; d.add(hit); picks.push(hit); return d; }) };
    const lv = new THREE.Group(); lv.position.set(.62 * sw / 1.4, yBot + .15, .55); P.add(lv); lv.add(new THREE.Mesh(new THREE.BoxGeometry(.2, .3, .08), M(0x30343a, { metalness: .6 }))); const arm = new THREE.Mesh(new THREE.BoxGeometry(.04, .2, .04), crm); arm.geometry.translate(0, .1, 0); arm.position.z = .06; lv.add(arm); const kn = new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 10), M(0xc02020)); kn.position.y = .2; arm.add(kn); VS.lever = arm;
  }
  let PJ = null; if (prop === 'projector') { side = 1.3;   // 16mm 영사기: 앞뒤 필름 릴이 돌고(트래킹이 어긋날수록 덜컹), 렌즈 경통이 초점 링 따라 돌며 앞뒤로 움직이고, 빛줄기가 화면으로 뻗는다
    const g = new THREE.Group(), body = M(0x3a3f44, { metalness: .6, roughness: .35 }), crm = M(0xc8ccd0, { metalness: .9, roughness: .2 }), blk = M(0x141414, { roughness: .4 });
    const box2 = new THREE.Mesh(new THREE.BoxGeometry(.5, .28, .22), body); box2.position.y = .26; g.add(box2);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(.44, .12, .2), blk); legs.position.y = .06; g.add(legs);
    const reels = [[-.12, .58], [.17, .5]].map(([x, y]) => { const r2 = new THREE.Group(); r2.position.set(x, y, 0); const d = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .02, 32), crm); d.rotation.x = Math.PI / 2; r2.add(d); const film = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .022, 32), blk); film.rotation.x = Math.PI / 2; r2.add(film); for (let k = 0; k < 3; k++) { const h2 = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .024, 12), body); h2.rotation.x = Math.PI / 2; h2.position.set(Math.cos(k * 2.1) * .07, Math.sin(k * 2.1) * .07, 0); r2.add(h2); } const arm2 = new THREE.Mesh(new THREE.BoxGeometry(.02, y - .3, .02), body); arm2.position.set(0, -(y - .3) / 2, -.03); r2.add(arm2); g.add(r2); return r2; });
    const lens = new THREE.Group(); lens.position.set(.28, .27, 0); g.add(lens); const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, .14, 20), blk); barrel.rotation.z = Math.PI / 2; barrel.position.x = .07; lens.add(barrel);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(.052, .052, .03, 20), crm); ring.rotation.z = Math.PI / 2; ring.position.x = .06; lens.add(ring); const mark = new THREE.Mesh(new THREE.BoxGeometry(.032, .008, .006), M(0xffd040)); mark.position.set(.06, .053, 0); lens.add(mark);
    const glassL = new THREE.Mesh(new THREE.CircleGeometry(.04, 20), new THREE.MeshBasicMaterial({ color: 0xfff4d0 })); glassL.rotation.y = Math.PI / 2; glassL.position.x = .141; lens.add(glassL);
    g.scale.setScalar(1.6); g.position.set(-(sw / 2 + .75), yBot, .25); g.rotation.y = -.35; P.add(g);
    const beamM = new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: .07, depthWrite: false, side: THREE.DoubleSide }); const beamLen = 1.6; const beam = new THREE.Mesh(new THREE.ConeGeometry(.55, beamLen, 24, 1, true), beamM); sc.add(beam);
    const lp0 = new THREE.Vector3(); PJ = { reels, lens, ring, beam, beamM, g, glassL, update(a) { const err = Math.abs(a.ut - a.tt), fe = Math.abs(a.uf - a.tf); reels.forEach((r2, i) => { r2.rotation.z -= (.05 + (i ? .07 : .05)) + (Math.random() < err * .6 ? .25 : 0); }); ring.rotation.x = a.uf * 8; lens.position.x = .28 + a.uf * .03; glassL.material.color.setRGB(1, .95, .8 - fe * .4);
      glassL.getWorldPosition(lp0); const to = new THREE.Vector3(0, 0, .03).sub(lp0), L2 = to.length(); beam.scale.set(1, L2 / beamLen, 1); beam.position.copy(lp0).addScaledVector(to, .5); beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), to.clone().normalize()); beamM.opacity = .05 + (1 - fe) * .05; } }; }
  let MS = null; if (prop === 'microscope') { side = 1.3;   // 실제로 움직이는 현미경: 리볼버(배율에 따라 회전) · 스테이지(WASD 위치) · 미동/조동 나사(초점) · 광원(조리개 밝기)
    const g = new THREE.Group(), blk = M(0x1c2024, { roughness: .35, metalness: .3 }), crm = M(0xd8dce0, { metalness: .9, roughness: .2 }), cream = M(0xe8e2d4, { roughness: .4 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(.34, .05, .42), cream); base.position.y = .025; g.add(base);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.08, .55, .1), cream); arm.position.set(0, .3, -.15); arm.rotation.x = .12; g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .16), cream); head.position.set(0, .56, -.06); g.add(head);
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(.025, .028, .16, 18), blk); eye.position.set(0, .64, -.13); eye.rotation.x = -.6; g.add(eye);
    const rev = new THREE.Group(); rev.position.set(0, .48, .02); g.add(rev); const revD = new THREE.Mesh(new THREE.CylinderGeometry(.06, .07, .03, 24), crm); rev.add(revD);
    [[.012, .05, 0xd0d0d0], [.014, .075, 0xd8c040], [.016, .1, 0xc83030]].forEach(([rr, ln, col], k) => { const a3 = k * Math.PI * 2 / 3, o = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr * 1.3, ln, 14), crm); o.position.set(Math.sin(a3) * .04, -ln / 2 - .01, Math.cos(a3) * .04); rev.add(o); const band = new THREE.Mesh(new THREE.CylinderGeometry(rr * 1.32, rr * 1.32, .008, 14), M(col)); band.position.copy(o.position); band.position.y = -.025; rev.add(band); });
    const stage = new THREE.Group(); stage.position.set(0, .3, .02); g.add(stage); stage.add(new THREE.Mesh(new THREE.BoxGeometry(.22, .015, .2), blk));
    const slide = new THREE.Mesh(new THREE.BoxGeometry(.15, .004, .05), new THREE.MeshPhysicalMaterial({ color: 0xddeeff, transparent: true, opacity: .55, roughness: .05 })); slide.position.y = .01; stage.add(slide);
    const spec = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .002, 12), M(0x2a7a5a)); spec.position.y = .013; slide.add(spec);
    const clipM = M(0xb0b4b8, { metalness: .8 }); [-1, 1].forEach(sd => { const cl = new THREE.Mesh(new THREE.BoxGeometry(.04, .003, .012), clipM); cl.position.set(sd * .06, .014, -.02); stage.add(cl); });
    const knob = new THREE.Group(); knob.position.set(.06, .2, -.12); g.add(knob); const kn = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .03, 24), blk); kn.rotation.z = Math.PI / 2; knob.add(kn); for (let k = 0; k < 8; k++) { const rib = new THREE.Mesh(new THREE.BoxGeometry(.032, .006, .006), crm); rib.position.set(.0, Math.cos(k * .785) * .045, Math.sin(k * .785) * .045); rib.rotation.x = k * .785; knob.add(rib); }
    const fine = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .02, 18), crm); fine.rotation.z = Math.PI / 2; fine.position.set(.085, .2, -.12); g.add(fine);
    const lampM = new THREE.MeshBasicMaterial({ color: 0xfff2c0 }); const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .01, 18), lampM); lamp.position.set(0, .056, .02); g.add(lamp);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.01, .03, .24, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: .12, depthWrite: false })); beam.position.set(0, .18, .02); g.add(beam);
    g.scale.setScalar(1.9); g.position.set(-(sw / 2 + .6), yBot + .0, -.1); g.rotation.y = .55; P.add(g); MS = { rev, stage, knob, fine, lampM, beam }; }
  if (prop === 'beakers') { side = 1; [[0, .14, 0x70b0ff], [.24, .1, 0xff8060], [-.05, .08, 0x80e090]].forEach(([dx, r2, col], k) => { const gl = new THREE.Mesh(new THREE.CylinderGeometry(r2 * .5, r2 * .5, r2 * 2.2, 20, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .25, roughness: .05, side: THREE.DoubleSide })); const lq = new THREE.Mesh(new THREE.CylinderGeometry(r2 * .47, r2 * .47, r2 * 1.2, 20), M(col, { transparent: true, opacity: .75, emissive: col, emissiveIntensity: .15 })); const x = sw / 2 + .3 + dx, z = -.1 - k * .18; gl.position.set(x, yBot + r2 * 1.1, z); lq.position.set(x, yBot + r2 * .6, z); P.add(gl, lq); }); }
  if (prop === 'ball') { side = 1; const b2 = new THREE.Mesh(new THREE.SphereGeometry(.17, 28, 20), M(0xd0682a, { roughness: .8 })); b2.position.set(sw / 2 + .4, yBot + .17, -.1); P.add(b2); spin.push(b2); }
  if (prop === 'tape') { side = 1; const t2 = new THREE.Mesh(new THREE.BoxGeometry(.4, .02, .25), M(0x1a1a1a)); t2.position.set(sw / 2 + .4, yBot + .01, -.05); t2.rotation.y = .3; P.add(t2); const lb = new THREE.Mesh(new THREE.BoxGeometry(.3, .022, .12), M(0xe8dcc0)); lb.position.copy(t2.position); lb.position.y += .002; lb.rotation.y = .3; P.add(lb); }
  if (prop === 'pipe') { const p2 = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, sw + 3, 18), M(0x6a5a48, { metalness: .7, roughness: .45 })); p2.rotation.z = Math.PI / 2; p2.position.set(0, yTop + .25, -.75); P.add(p2); const v2 = new THREE.Mesh(new THREE.TorusGeometry(.13, .025, 8, 24), M(0xb02020, { metalness: .4 })); v2.position.set(sw / 2 + .2, yTop + .25, -.62); P.add(v2); spin.push(v2); }
  if (prop === 'lamp') { side = 1; const base = new THREE.Mesh(new THREE.CylinderGeometry(.1, .12, .03, 20), M(0x2a3a2a)); base.position.set(-(sw / 2 + .4), yBot + .015, -.2); P.add(base); const pole = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .7, 8), M(0x2a3a2a)); pole.position.set(-(sw / 2 + .4), yBot + .35, -.2); P.add(pole); const shade = new THREE.Mesh(new THREE.ConeGeometry(.14, .16, 20, 1, true), M(0x2f5a3a, { side: THREE.DoubleSide })); shade.position.set(-(sw / 2 + .28), yBot + .7, -.1); shade.rotation.z = -.6; P.add(shade); const wl = new THREE.PointLight(0xffd8a0, 1.2, 3); wl.position.set(-(sw / 2 + .2), yBot + .6, 0); P.add(wl); }
  const wAll = prop === 'microscope' || prop === 'projector' ? sw + 1.9 : sw + .6 + side * 1.2;
  const extra = prop === 'reels' ? .7 : prop === 'antenna' ? .45 : prop === 'pipe' ? .4 : 0, low = prop === 'valves' || prop === 'breaker' ? .5 : 0, hAll = shh + .9 + extra + low, cy = -.14 + extra / 2 - low / 2;
  const xo = prop === 'microscope' || prop === 'projector' ? -.65 : 0; cam.position.set(xo, cy + .19, Math.max(hAll / 2 / Math.tan(15 * Math.PI / 180), wAll / 2 / Math.tan(15 * Math.PI / 180) / (W / H))); cam.lookAt(xo, cy, 0);
  const rc = new THREE.Raycaster(), mv = new THREE.Vector2();
  const fwd = (type, e) => { const b = r.domElement.getBoundingClientRect(); mv.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); rc.setFromCamera(mv, cam); const hit = rc.intersectObject(scr)[0]; if (!hit && !/move|up/.test(type)) return;
    const uv = hit ? hit.uv : { x: .5, y: .5 }, cb = c.getBoundingClientRect(), x = cb.left + Math.min(1, Math.max(0, uv.x)) * cb.width, y = cb.top + (1 - Math.min(1, Math.max(0, uv.y))) * cb.height;
    if (type === 'wheel') { e.preventDefault(); c.dispatchEvent(new WheelEvent('wheel', { clientX: x, clientY: y, deltaY: e.deltaY, bubbles: true, cancelable: true })); }
    else if (type.startsWith('pointer')) c.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, button: e.button, buttons: e.buttons, pointerId: e.pointerId, bubbles: true, cancelable: true }));
    else c.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button: e.button, buttons: e.buttons, bubbles: true, cancelable: true })); };
  r.domElement.addEventListener('mousedown', e => { if (!picks.length || !pick) return; const b = r.domElement.getBoundingClientRect(); mv.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); rc.setFromCamera(mv, cam); const h = rc.intersectObjects(picks, false)[0]; if (h) { e.stopImmediatePropagation(); pick(h.object.userData.pick, e.button === 2 ? -1 : 1); } }, true);
  ['mousedown', 'mousemove', 'mouseup', 'click', 'contextmenu', 'pointerdown', 'pointermove', 'pointerup'].forEach(t => r.domElement.addEventListener(t, e => { if (t === 'contextmenu') e.preventDefault(); fwd(t, e); }));
  r.domElement.addEventListener('wheel', e => fwd('wheel', e), { passive: false });
  const loop = () => { if (!MG.active) { r.dispose(); r.forceContextLoss && r.forceContextLoss(); return; } tex.needsUpdate = true; if (knobs) { const v = knobs(); kn.forEach((g, i) => g.rotation.z = Math.PI * .75 - v[i] * Math.PI * 1.5); } spin.forEach(o => o.rotation.z += .01); if (PJ && anim) PJ.update(anim()); if (VL && anim) { const a = anim(); VL.forEach((o, i) => { o.wh.rotation.z += ((-a.angs[i]) - o.wh.rotation.z) * .15; o.nd.rotation.z = (1 - a.psi[i] / 100) * Math.PI * 1.4 - Math.PI * .7; }); } if (VS && anim) { const a = anim(); VS.dials.forEach((d, i) => { d.rotation.z = -(a.volts[i] - 215) / 45 * 2.2; }); VS.lever.rotation.z = a.on ? -.5 : .5; } if (MS && anim) { const a = anim(); const tgt = a.mag === 40 ? 0 : a.mag === 100 ? Math.PI * 2 / 3 : Math.PI * 4 / 3; MS.rev.rotation.y += (-tgt - MS.rev.rotation.y) * .15; MS.stage.position.x = a.sx * .0008; MS.stage.position.z = .02 + a.sy * .0008; MS.knob.rotation.x = a.focus * 9; MS.fine.rotation.x = a.focus * 18; MS.lampM.color.setScalar(.3 + a.iris * .9); MS.beam.material.opacity = .04 + a.iris * .2; } r.render(sc, cam); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.className = 'mgCanvas'; $('mgBody').appendChild(c); return c; }
$('mgCancel').onclick = () => { if (finish) close(false); };

/* ---------- 1. 자물쇠 따기 (머리핀) — 핀 텀블러 5개 ---------- */
// 실제 원통 자물쇠처럼: 텐션 렌치로 실린더에 약한 회전 압력(Q·E / 휠)을 걸고, 머리핀 끝(A·D / 마우스)으로 핀을 하나씩 밀어 올린다(W·Space / 클릭 유지).
// 압력을 받으면 핀 하나만 걸린다(바인딩). 그 핀을 전단선까지 올리면 "딸깍" 고정, 다음 핀이 걸린다. 너무 올리면 끼어 버리니 텐션을 풀어 처음부터.
// 텐션이 너무 세면 핀이 안 올라가고 머리핀이 휜다 → 부러짐. 너무 약하면 고정된 핀이 떨어진다.
// 3D 자물쇠 단면 (Three.js WebGL 미니 장면): 황동 하우징 · 플러그 · 핀 텀블러(키 핀 · 드라이버 핀 · 스프링) · 머리핀 · 텐션 렌치
//   2D 좌표(px · y)를 그대로 받아 3D 로 옮겨 그린다 (1px = 1cm). WebGL 을 못 쓰면 null → 기존 2D 그림
function lock3D(host, N, PX) {
  let r; try { r = new THREE.WebGLRenderer({ antialias: true, alpha: false }); } catch (e) { return null; }
  r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(460, 300); r.domElement.className = 'mgCanvas'; r.domElement.dataset.own3d = '1'; host.appendChild(r.domElement);
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0b0a08);
  const cam = new THREE.PerspectiveCamera(32, 460 / 300, .1, 50); cam.position.set(.9, 1.1, 5.4); cam.lookAt(0, .55, 0);
  sc.add(new THREE.HemisphereLight(0xfff2dc, 0x201810, .7)); const key = new THREE.DirectionalLight(0xfff0d0, 2.2); key.position.set(2, 4, 5); sc.add(key);
  const rim = new THREE.PointLight(0xffc880, 6, 8); rim.position.set(-2.5, 1.2, 2); sc.add(rim);
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a40, metalness: .85, roughness: .35 }), brassD = new THREE.MeshStandardMaterial({ color: 0x7a5e2a, metalness: .8, roughness: .5 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: .9, roughness: .25 }), dark = new THREE.MeshStandardMaterial({ color: 0x14100a, roughness: .9 });
  const kp = new THREE.MeshStandardMaterial({ color: 0xd0a850, metalness: .9, roughness: .3, emissive: 0x000000 });
  const X = x => (x - 260) / 100, Y = y => (178 - y) / 100;
  // 하우징 (뒤판 + 윗덩어리 단면) · 플러그 (돌아가는 실린더) · 열쇠 구멍
  const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.0, .2), brassD); back.position.set(0, .7, -.45); sc.add(back);
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.0, .22), brass); top.position.set(0, Y(70), -.26);   // 단면: 앞쪽 절반은 잘라 내 핀이 보인다 sc.add(top);
  const plug = new THREE.Group(); plug.position.set(0, Y(157), 0); sc.add(plug);
  const pc = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, 3.0, 40, 1, false, Math.PI / 2, Math.PI), brass); pc.material = brass.clone(); pc.material.side = THREE.DoubleSide; pc.rotation.z = Math.PI / 2; plug.add(pc);
  const kw = new THREE.Mesh(new THREE.BoxGeometry(3.02, .1, .14), dark); kw.position.set(0, -.2, -.05); plug.add(kw);
  // 전단선: 가는 빛줄기
  const shear = new THREE.Mesh(new THREE.BoxGeometry(3.1, .008, .01), new THREE.MeshBasicMaterial({ color: 0xffd870 })); shear.position.set(0, Y(120), .3); sc.add(shear);
  const pins = PX.map(x => { const g = new THREE.Group(); g.position.x = X(x); sc.add(g);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 1.55, 18, 1, true, Math.PI / 2, Math.PI), new THREE.MeshStandardMaterial({ color: 0x2a2012, roughness: .8, side: THREE.DoubleSide })); hole.position.y = .78; hole.position.z = .02; g.add(hole);
    const k = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 1, 20), kp.clone()); k.geometry.translate(0, .5, 0); g.add(k);
    const tipC = new THREE.Mesh(new THREE.ConeGeometry(.09, .08, 20), k.material); tipC.rotation.x = Math.PI; g.add(tipC);
    const d = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .34, 20), steel.clone()); d.geometry.translate(0, .17, 0); g.add(d);
    const pts = []; for (let j = 0; j <= 80; j++) { const a = j / 80 * Math.PI * 2 * 9; pts.push(new THREE.Vector3(Math.cos(a) * .075, j / 80, Math.sin(a) * .075)); }
    const sp = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, .009, 5), steel); g.add(sp);
    return { k, tipC, d, sp }; });
  // 머리핀 (굽은 철사) · 텐션 렌치
  const pinM = new THREE.MeshStandardMaterial({ color: 0x4a4a52, metalness: .9, roughness: .35 });
  const hp = new THREE.Group(); sc.add(hp); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, 1, 10), pinM); shaft.geometry.rotateZ(Math.PI / 2); shaft.geometry.translate(-.5, 0, 0); hp.add(shaft);
  const hook = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .14, 10), pinM); hook.position.set(0, .06, 0); hp.add(hook);
  const wr = new THREE.Mesh(new THREE.BoxGeometry(.06, .4, .05), steel); wr.position.set(X(112), Y(195), .15); sc.add(wr);
  const wr2 = new THREE.Mesh(new THREE.BoxGeometry(.6, .06, .05), steel); wr2.position.set(X(85), Y(208), .15); sc.add(wr2);
  return {
    dom: r.domElement,
    render(st) {   // st: { lift, need, set, jam, binding, px, tip, ten, turn, feel }
      const sh = st.feel > 0 ? (Math.random() - .5) * .012 : 0;
      plug.rotation.x = -st.turn * 1.2; wr.rotation.z = -st.ten * .25;
      pins.forEach((P, k) => { const kpLen = (178 - 120 - st.need[k]) / 100, base = st.lift[k] / 100, rot = k < 0 ? 0 : 0;
        P.k.scale.y = Math.max(.02, kpLen); P.k.position.y = base; P.tipC.position.y = base - .02;
        const top = base + kpLen; P.d.position.y = top; const sTop = 1.5; P.sp.position.y = top + .34; P.sp.scale.y = Math.max(.05, sTop - top - .34);
        P.k.material.color.setHex(st.set[k] ? 0x70d090 : st.binding === k && st.feel > 0 ? 0xf0d070 : 0xd0a850); P.k.material.emissive.setHex(st.set[k] ? 0x0a3018 : 0);
        P.d.material.color.setHex(st.jam[k] ? 0xc05040 : 0xb8bcc4);
        if (st.turn > 0 && st.set[k]) { P.k.position.y = base; } });
      hp.position.set(X(st.px), Y(178) + .02 + Math.min(st.tip, 8) / 100 + sh, .12); hp.rotation.z = -.08 - Math.min(st.tip, 8) / 120;
      rim.intensity = 5 + Math.sin(performance.now() / 300) * .6;
      r.render(sc, cam);
    },
    dispose() { r.dispose(); r.forceContextLoss && r.forceContextLoss(); sc.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  };
}
function lockpick({ pins, usePin, tol = 9 }) {
  const p = open('자물쇠 따기 — 핀 텀블러', '<b>Q · E / 휠</b> 텐션 · <b>A · D / 마우스</b> 핀 위치 · <b>W · Space / 클릭 유지</b> 밀어 올리기<br>걸린 핀만 뻑뻑하다 — 전단선(점선)에 맞으면 딸깍. 너무 밀면 끼니 텐션을 풀었다 다시');
  const c = canvas(460, 300), g = c.getContext('2d');
  const info = document.createElement('div'); info.className = 'mgInfo'; $('mgBody').appendChild(info);
  const N = 5, PX = [150, 205, 260, 315, 370], SL = 120, BASE = 178, TP = 2.5 + tol / 4;   // 전단선 y · 핀 바닥 y · 허용 오차(px)
  const need = PX.map(() => 10 + Math.random() * 26), order = [...Array(N).keys()].sort(() => Math.random() - .5);
  const lift = Array(N).fill(0), set = Array(N).fill(false), jam = Array(N).fill(false);
  let px = 100, up = false, tip = 0, ten = 0, strain = 0, left = pins(), turn = 0, opened = false, lastT = performance.now(), feel = 0, lastI = -1;
  MG.lp = { need, order, PX, set, lift, get ten() { return ten; }, get tip() { return tip; } };   // 테스트용 상태
  // 3D 단면 뷰: 2D 캔버스는 텐션 게이지 띠만 남기고(높이 40) 위에 3D 장면을 얹는다. 마우스 조작은 3D 화면에서도 같게
  const L3 = lock3D($('mgBody'), N, PX); if (L3) { $('mgBody').insertBefore(L3.dom, c); c.height = 40; c.style.height = 'auto'; cleanups.push(() => L3.dispose());
    L3.dom.addEventListener('mousemove', e => { const r = L3.dom.getBoundingClientRect(); px = clamp(((e.clientX - r.left) / r.width) * 460, 80, 400); });
    L3.dom.addEventListener('mousedown', () => { up = true; }); L3.dom.addEventListener('wheel', e => { e.preventDefault(); setTen(ten + (e.deltaY < 0 ? .06 : -.06)); }, { passive: false }); }
  const upd = () => { info.innerHTML = `남은 머리핀 <b>${left}</b>개 · 고정된 핀 <b>${set.filter(Boolean).length}</b> / ${N}`; }; upd();
  const binding = () => order.find(i => !set[i]);
  const under = () => { let best = -1, bd = 14; PX.forEach((x, i) => { const d = Math.abs(x - px); if (d < bd) { bd = d; best = i; } }); return best; };
  const setTen = v => { const n = clamp(v, 0, 1); if (Math.abs(n - ten) > .04) sfx.tension(n); ten = n; };
  const reset = why => { for (let i = 0; i < N; i++) { set[i] = false; jam[i] = false; } if (why) status(why, 'err'); upd(); };
  c.addEventListener('mousemove', e => { const r = c.getBoundingClientRect(); px = clamp(((e.clientX - r.left) / r.width) * 460, 80, 400); });
  c.addEventListener('mousedown', () => { up = true; }); const mu = () => { up = false; }; addEventListener('mouseup', mu); cleanups.push(() => removeEventListener('mouseup', mu));
  c.addEventListener('wheel', e => { e.preventDefault(); setTen(ten + (e.deltaY < 0 ? .06 : -.06)); }, { passive: false });
  keys(e => {
    const dn = e.type === 'keydown';
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') up = dn;
    if (dn && (e.code === 'KeyA' || e.code === 'ArrowLeft')) px = clamp(px - 9, 80, 400);
    if (dn && (e.code === 'KeyD' || e.code === 'ArrowRight')) px = clamp(px + 9, 80, 400);
    if (dn && e.code === 'KeyE') setTen(ten + .08);
    if (dn && (e.code === 'KeyQ' || e.code === 'ArrowDown')) setTen(ten - .08);
  });
  const loop = now => {
    const dt = Math.min(.1, (now - lastT) / 1000); lastT = now;
    if (opened) { turn = Math.min(1, turn + dt * 2.4); draw(); if (turn >= 1) return close(true); raf = requestAnimationFrame(loop); return; }
    const i = under(), bi = binding(), hard = ten > .78, weak = ten < .18; if (i !== lastI) { tip = 0; lastI = i; }   // 다른 핀으로 옮기면 머리핀 끝이 내려간다
    if (weak && set.some(Boolean) && Math.random() < dt * 2.5) { const k = set.lastIndexOf(true); if (k >= 0) { set[k] = false; jam[k] = false; sfx.pick(); upd(); } }
    if (weak && jam.some(Boolean)) reset();
    // 머리핀 끝 높이: 걸린 핀은 뻑뻑하고, 텐션이 세면 거의 안 올라간다
    const maxTip = i < 0 ? 4 : set[i] || jam[i] ? need[i] : 48, rate = i === bi ? (hard ? 9 : 34) : 70;
    tip = up ? Math.min(maxTip, tip + rate * dt) : Math.max(0, tip - 120 * dt);
    feel = Math.max(0, feel - dt * 3);
    for (let k = 0; k < N; k++) if (!set[k] && !jam[k]) lift[k] = k === i ? tip : Math.max(0, lift[k] - 140 * dt); else if (set[k]) lift[k] = Math.min(lift[k], need[k]);
    if (i >= 0 && !set[i] && !jam[i] && up) {
      if (i === bi && ten >= .18) {
        if (Math.random() < dt * 8) { sfx.tension(ten * .5); feel = 1; }
        if (Math.abs(lift[i] - need[i]) < TP && !hard) { set[i] = true; lift[i] = need[i]; sfx.pick(); setTimeout(() => sfx.pick(), 40); status('딸깍 — 핀 하나가 걸렸다', 'ok'); upd();
          if (set.every(Boolean)) { opened = true; sfx.tumbler(); status('실린더가 돌아간다 — 열렸다', 'ok'); } }
        else if (lift[i] > need[i] + TP + 3) { jam[i] = true; sfx.buzz(); reset('너무 밀었다 — 핀이 끼었다. 텐션을 풀었다(Q) 다시'); }
      } else if (ten < .18 && lift[i] > 30 && Math.random() < dt * 2) status('텐션이 너무 약하다 — E 로 살짝 걸어라');
    }
    if (hard && up && i === bi) { strain += dt * .9; if (Math.random() < .25) sfx.tension(strain); if (strain > 1) {
      sfx.pinBreak(); left--; usePin(); strain = 0; tip = 0; up = false; reset('텐션이 너무 셌다 — 머리핀이 부러졌다!'); setTen(.3);
      if (left <= 0) { status('머리핀이 다 떨어졌다', 'err'); draw(); setTimeout(() => close(false), 900); return; } } }
    else strain = Math.max(0, strain - dt);
    draw(); raf = requestAnimationFrame(loop);
  };
  function draw() {
    if (L3) { L3.render({ lift, need, set, jam, binding: binding(), px, tip, ten, turn, feel });   // 3D 뷰 + 아래 텐션 게이지
      g.fillStyle = '#0d0b09'; g.fillRect(0, 0, 460, 40); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(20, 20, 420, 12); g.fillStyle = 'rgba(96,224,160,.25)'; g.fillRect(20 + 420 * .18, 20, 420 * .6, 12);
      g.fillStyle = ten > .78 ? '#e05040' : ten < .18 ? '#8a8a8a' : '#60e0a0'; g.fillRect(20, 20, 420 * ten, 12); g.fillStyle = '#d8d0b8'; g.font = '11px sans-serif'; g.fillText('텐션', 22, 14); if (strain > .05) { g.fillStyle = '#e05040'; g.fillText('머리핀이 휜다!', 360, 14); } return; }
    const sh = feel > 0 ? (Math.random() - .5) * 1.5 : 0;
    g.fillStyle = '#0d0b09'; g.fillRect(0, 0, 460, 300);
    g.fillStyle = '#7d6a3e'; g.fillRect(110, 20, 300, 100);   // 몸통(하우징)
    g.save(); g.translate(0, turn * 6);
    g.fillStyle = '#a8904f'; g.fillRect(110, SL, 300, 75);    // 플러그(실린더)
    g.fillStyle = '#1a140c'; g.fillRect(110, BASE + 2, 300, 12);   // 열쇠 구멍
    g.restore();
    g.setLineDash([5, 4]); g.strokeStyle = '#e8c870'; g.lineWidth = 1; g.beginPath(); g.moveTo(105, SL); g.lineTo(415, SL); g.stroke(); g.setLineDash([]);
    PX.forEach((x, k) => {
      g.fillStyle = '#2a2014'; g.fillRect(x - 12, 24, 24, BASE - 24);   // 핀 구멍
      const kpTop = BASE - (BASE - SL) + 0 - lift[k] + (BASE - SL - need[k]) * 0, kpLen = (BASE - SL) - need[k] + 0;
      const keyTop = BASE - kpLen - lift[k], drvTop = keyTop - 34;
      const springTop = 28, springBot = drvTop;
      g.strokeStyle = '#8c8c90'; g.lineWidth = 1.5; g.beginPath(); for (let j = 0; j <= 10; j++) { const yy = springTop + (springBot - springTop) * j / 10; g.lineTo(x + (j % 2 ? 6 : -6), yy); } g.stroke();
      g.fillStyle = jam[k] ? '#c05040' : '#9a9aa2'; g.fillRect(x - 9, drvTop, 18, 34);                 // 드라이버 핀
      g.fillStyle = set[k] ? '#70d090' : k === binding() && feel > 0 ? '#f0d070' : '#c9a14a'; g.beginPath(); g.moveTo(x - 9, keyTop); g.lineTo(x + 9, keyTop); g.lineTo(x + 9, BASE - 4); g.lineTo(x, BASE + 2); g.lineTo(x - 9, BASE - 4); g.closePath(); g.fill();   // 키 핀
    });
    // 머리핀 (왼쪽에서 열쇠 구멍으로)
    g.strokeStyle = '#6a6a72'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(10, BASE + 22); g.lineTo(px - 14, BASE + 8 + sh); g.lineTo(px, BASE + 2 - tip * .0 - (tip > 0 ? Math.min(tip, 8) : 0) + sh); g.stroke();
    // 텐션 렌치 + 게이지
    g.fillStyle = '#4a4a50'; g.fillRect(60, BASE + 26, 54, 6); g.fillRect(108, BASE + 8, 6, 24);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(20, 268, 420, 12);
    g.fillStyle = 'rgba(96,224,160,.25)'; g.fillRect(20 + 420 * .18, 268, 420 * .6, 12);
    g.fillStyle = ten > .78 ? '#e05040' : ten < .18 ? '#8a8a8a' : '#60e0a0'; g.fillRect(20, 268, 420 * ten, 12);
    g.fillStyle = '#d8d0b8'; g.font = '11px sans-serif'; g.fillText('텐션', 22, 262); if (strain > .05) { g.fillStyle = '#e05040'; g.fillText('머리핀이 휜다!', 360, 262); }
  }
  raf = requestAnimationFrame(loop);
  return p;
}

/* ---------- 2. 다이얼 자물쇠 ---------- */
function dial({ code, title = '다이얼 자물쇠', hint = '', onFail }) {
  const n = code.length, val = Array(n).fill(0); let sel = 0;
  const p = open(title, `←→ 칸 선택 · ↑↓ 또는 휠 · 클릭으로 숫자 돌리기 · Enter 열기${hint ? '<br>' + hint : ''}`);
  const box = document.createElement('div'); box.className = 'dialBox'; $('mgBody').appendChild(box);
  const btn = document.createElement('button'); btn.className = 'btn pri'; btn.textContent = '열기'; btn.style.marginTop = '14px'; $('mgBody').appendChild(btn);
  const render = () => {
    box.innerHTML = val.map((v, i) => `<div class="wheel${i === sel ? ' sel' : ''}" data-i="${i}"><span>${(v + 9) % 10}</span><b>${v}</b><span>${(v + 1) % 10}</span></div>`).join('');
    box.querySelectorAll('.wheel').forEach(w => {
      const i = +w.dataset.i;
      w.onclick = e => { const r = w.getBoundingClientRect(); sel = i; turn(i, e.clientY < r.top + r.height / 2 ? 1 : -1); };
      w.onwheel = e => { e.preventDefault(); sel = i; turn(i, e.deltaY < 0 ? 1 : -1); };
    });
  };
  const turn = (i, d) => { val[i] = (val[i] + d + 10) % 10; sfx.dial(); render(); };
  const check = () => {
    if (val.join('') === code) { sfx.tumbler(); close(true); }
    else { sfx.buzz(); status('열리지 않는다', 'err'); if (onFail) onFail(); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake'); }
  };
  // 3D 황동 자물쇠: 숫자 바퀴 n개 · 걸쇠 — 화면의 바퀴 위쪽/아래쪽을 클릭(또는 휠)하면 돌아간다. 맞으면 걸쇠가 튀어 오른다
  const D3 = (() => { let r; try { r = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { return null; }
    const W = 440, H = 280; r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(W, H); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.domElement.className = 'mgCanvas'; r.domElement.dataset.own3d = '1'; $('mgBody').insertBefore(r.domElement, box); box.style.display = 'none';
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0d0b09); const cam = new THREE.PerspectiveCamera(30, W / H, .05, 20); cam.position.set(0, .15, 2.2); cam.lookAt(0, .1, 0);
    sc.add(new THREE.HemisphereLight(0xfff0dc, 0x1a1208, .6)); const L = new THREE.SpotLight(0xffe8c8, 14, 6, .6, .5, 1.5); L.position.set(.8, 1.4, 1.6); sc.add(L, L.target);
    const brass = new THREE.MeshStandardMaterial({ color: 0xb8902c, metalness: .9, roughness: .3 }), steel = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, metalness: 1, roughness: .2 });
    const wW = .16, span = n * wW + .14; const body = new THREE.Mesh(new THREE.BoxGeometry(span, .5, .32), brass); body.position.y = -.05; sc.add(body);
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(span * .34, .04, 14, 32, Math.PI), steel); shackle.position.y = .2; sc.add(shackle);
    const dig = (() => { const c = document.createElement('canvas'); c.width = 640; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#e8e0cc'; g.fillRect(0, 0, 640, 64); g.font = 'bold 48px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let d = 0; d < 10; d++) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(d * 64, 0, 2, 64); g.fillStyle = '#1a1208'; g.save(); g.translate(32 + d * 64, 32); g.rotate(Math.PI / 2); g.fillText(String(d), 0, 2); g.restore(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const wheels = []; for (let i = 0; i < n; i++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, wW * .82, 30, 1, true), new THREE.MeshStandardMaterial({ map: dig, roughness: .5, metalness: .1, side: THREE.DoubleSide })); w.rotation.z = Math.PI / 2; const piv = new THREE.Group(); piv.position.set(-((n - 1) * wW) / 2 + i * wW, -.05, .17); piv.add(w); sc.add(piv); w.userData.i = i; wheels.push({ piv, w, cur: 0 }); }
    const ring = new THREE.Mesh(new THREE.BoxGeometry(wW * .9, .25, .005), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: .35 })); ring.position.z = .29; sc.add(ring);
    const rc = new THREE.Raycaster(), mv = new THREE.Vector2();
    r.domElement.addEventListener('mousedown', e => { const b = r.domElement.getBoundingClientRect(); mv.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); rc.setFromCamera(mv, cam); const h = rc.intersectObjects(wheels.map(o => o.w))[0]; if (!h) return; const i = h.object.userData.i; sel = i; turn(i, h.point.y > -.05 ? 1 : -1); });
    r.domElement.addEventListener('wheel', e => { e.preventDefault(); turn(sel, e.deltaY < 0 ? 1 : -1); }, { passive: false });
    let open3 = 0, shake = 0; const lp = () => { if (!MG.active) { r.dispose(); r.forceContextLoss && r.forceContextLoss(); return; } wheels.forEach((o, i) => { const tgt = val[i] / 10 * Math.PI * 2; o.cur += (tgt - o.cur) * .25; o.piv.rotation.x = o.cur; });
      ring.position.x = wheels[sel].piv.position.x; if (open3 > 0) { open3 = Math.min(1, open3 + .05); shackle.position.y = .2 + open3 * .12; } shake = Math.max(0, shake - .05); body.position.x = Math.sin(performance.now() / 20) * .01 * shake;
      r.render(sc, cam); requestAnimationFrame(lp); }; requestAnimationFrame(lp);
    return { opened: () => { open3 = .01; }, fail: () => { shake = 1; } }; })();
  const check0 = check; btn.onclick = () => { if (val.join('') === code && D3) { D3.opened(); sfx.tumbler(); setTimeout(() => close(true), 700); return; } if (D3 && val.join('') !== code) D3.fail(); check0(); };
  keys(e => {
    if (e.type !== 'keydown') return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { sel = (sel + n - 1) % n; render(); }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { sel = (sel + 1) % n; render(); }
    if (e.code === 'ArrowUp' || e.code === 'KeyW') turn(sel, 1);
    if (e.code === 'ArrowDown' || e.code === 'KeyS') turn(sel, -1);
    if (/^(Digit|Numpad)\d$/.test(e.code)) { val[sel] = +e.code.slice(-1); sfx.dial(); sel = Math.min(n - 1, sel + 1); render(); }
    if (e.code === 'Enter') btn.onclick();
  });
  render();
  return p;
}

/* ---------- 3. 배선 퍼즐 (타일 회전) ---------- */
// 마스크: N=1 E=2 S=4 W=8. 왼쪽 전원에서 오른쪽 출력까지 회로를 잇는다.
function circuit({ title = '배선 퍼즐', hint = '' } = {}) {
  const R = 4, C = 5, S = 74;
  const p = open(title, `타일을 클릭해 돌려 왼쪽 <b style="color:#ffd060">전원</b>에서 오른쪽 <b style="color:#60e0ff">차단기</b>까지 전선을 이어라 (우클릭: 반대로)${hint ? '<br>' + hint : ''}`);
  const c = canvas(C * S + 80, R * S + 20), g = c.getContext('2d');
  const rot = m => ((m << 1) | (m >> 3)) & 15;
  const grid = Array.from({ length: R }, () => Array(C).fill(0));
  const r0 = (Math.random() * R) | 0, r1 = (Math.random() * R) | 0;
  // 정답 경로
  const path = []; let r = r0;
  for (let col = 0; col < C; col++) {
    const tgt = col === C - 1 ? r1 : (Math.random() * R) | 0;
    path.push([r, col]); while (r !== tgt) { r += Math.sign(tgt - r); path.push([r, col]); }
  }
  const conn = (a, b) => (b[0] < a[0] ? 1 : b[1] > a[1] ? 2 : b[0] > a[0] ? 4 : 8);
  path.forEach((cell, i) => {
    let m = 0;
    if (i === 0) m |= 8; else m |= conn(cell, path[i - 1]);
    if (i === path.length - 1) m |= 2; else m |= conn(cell, path[i + 1]);
    grid[cell[0]][cell[1]] = m;
  });
  const pieces = [5, 3, 7, 3, 10];
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (!grid[y][x]) grid[y][x] = pieces[(Math.random() * pieces.length) | 0];
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { const k = 1 + ((Math.random() * 3) | 0); for (let i = 0; i < k; i++) grid[y][x] = rot(grid[y][x]); }
  let won = false;
  const powered = () => {
    const on = Array.from({ length: R }, () => Array(C).fill(false)); const q = [];
    if (grid[r0][0] & 8) { on[r0][0] = true; q.push([r0, 0]); }
    while (q.length) {
      const [y, x] = q.shift(), m = grid[y][x];
      [[1, -1, 0, 4], [2, 0, 1, 8], [4, 1, 0, 1], [8, 0, -1, 2]].forEach(([b, dy, dx, opp]) => {
        const ny = y + dy, nx = x + dx; if (!(m & b) || ny < 0 || ny >= R || nx < 0 || nx >= C || on[ny][nx] || !(grid[ny][nx] & opp)) return;
        on[ny][nx] = true; q.push([ny, nx]);
      });
    }
    return on;
  };
  const draw = () => {
    const on = powered(); won = on[r1][C - 1] && (grid[r1][C - 1] & 2);
    g.fillStyle = '#0c1014'; g.fillRect(0, 0, c.width, c.height);
    const ox = 40, oy = 10;
    g.fillStyle = '#ffd060'; g.fillRect(4, oy + r0 * S + S / 2 - 12, 30, 24); g.fillStyle = '#000'; g.font = 'bold 12px sans-serif'; g.fillText('⚡', 12, oy + r0 * S + S / 2 + 5);
    g.fillStyle = won ? '#60ffa0' : '#60e0ff'; g.fillRect(ox + C * S + 6, oy + r1 * S + S / 2 - 12, 30, 24);
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
      const px = ox + x * S, py = oy + y * S, m = grid[y][x];
      g.fillStyle = '#1a2026'; g.fillRect(px + 2, py + 2, S - 4, S - 4); g.strokeStyle = '#2c3640'; g.strokeRect(px + 2, py + 2, S - 4, S - 4);
      g.strokeStyle = on[y][x] ? (won ? '#60ffa0' : '#ffd060') : '#5a646c'; g.lineWidth = 9; g.lineCap = 'round';
      const cx = px + S / 2, cy = py + S / 2;
      [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0]].forEach(([b, dx, dy]) => { if (m & b) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + dx * S / 2, cy + dy * S / 2); g.stroke(); } });
      g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(cx, cy, 7, 0, 7); g.fill();
    }
  };
  const turnTile = (y, x, dir) => { if (won || x < 0 || x >= C || y < 0 || y >= R) return; grid[y][x] = dir > 0 ? rot(grid[y][x]) : rot(rot(rot(grid[y][x]))); sfx.dial(); draw(); W3 && W3.spin(y, x, dir); if (won) { sfx.fuse(); setTimeout(() => close(true), 600); } };
  const click = (e, dir) => { const rc = c.getBoundingClientRect(); turnTile(((e.clientY - rc.top) * c.height / rc.height - 10) / S | 0, ((e.clientX - rc.left) * c.width / rc.width - 40) / S | 0, dir); };
  // 3D 배선반: 베이클라이트 판 위 회전 타일(구리 전선 · 단자) — 전기가 흐르면 노랗게, 차단기까지 이어지면 초록으로 · 왼쪽 전원 단자함 · 오른쪽 차단기
  const W3 = (() => { let r; try { r = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { return null; }
    r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(460, 300); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.domElement.className = 'mgCanvas'; r.domElement.dataset.own3d = '1'; $('mgBody').insertBefore(r.domElement, c); c.style.display = 'none'; c.dataset.st = '1';
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0a0c0e); const cam = new THREE.PerspectiveCamera(34, 460 / 300, .05, 20); cam.position.set(0, -.9, 2.4); cam.lookAt(0, 0, 0);
    sc.add(new THREE.HemisphereLight(0xdde6ff, 0x101010, .5)); const L = new THREE.SpotLight(0xfff0dc, 14, 6, .7, .5, 1.4); L.position.set(.6, .8, 1.8); sc.add(L, L.target);
    const T = .3, bx0 = -(C - 1) * T / 2, by0 = (R - 1) * T / 2, board = new THREE.Mesh(new THREE.BoxGeometry(C * T + .7, R * T + .2, .05), new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: .5 })); board.position.z = -.04; sc.add(board);
    const src = new THREE.Mesh(new THREE.BoxGeometry(.16, .18, .1), new THREE.MeshStandardMaterial({ color: 0xd8a820, roughness: .4 })); src.position.set(bx0 - .3, by0 - r0 * T, .02); sc.add(src);
    const brk = new THREE.Mesh(new THREE.BoxGeometry(.16, .2, .1), new THREE.MeshStandardMaterial({ color: 0x3a8ab8, roughness: .4, emissive: 0x000000 })); brk.position.set(bx0 + (C - 1) * T + .3, by0 - r1 * T, .02); sc.add(brk);
    const tiles = []; const cu = c3 => new THREE.MeshStandardMaterial({ color: c3, metalness: .7, roughness: .35, emissive: 0x000000 });
    const build = (y, x) => { const t = tiles[y * C + x]; while (t.arms.children.length) t.arms.remove(t.arms.children[0]); const m = grid[y][x];
      [[1, 0, 1], [2, 1, 0], [4, 0, -1], [8, -1, 0]].forEach(([bit, dx, dy]) => { if (!(m & bit)) return; const arm = new THREE.Mesh(new THREE.BoxGeometry(dx ? T / 2 : .045, dy ? T / 2 : .045, .03), t.mat); arm.position.set(dx * T / 4, dy * T / 4, .03); t.arms.add(arm); });
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .04, 14), t.mat); hub.rotation.x = Math.PI / 2; hub.position.z = .03; t.arms.add(hub); };
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { const g3 = new THREE.Group(); g3.position.set(bx0 + x * T, by0 - y * T, 0); sc.add(g3);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(T * .92, T * .92, .03), new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: .6 })); plate.userData = { y, x }; g3.add(plate);
      const arms = new THREE.Group(); g3.add(arms); tiles.push({ g3, plate, arms, mat: cu(0x8a6a48), spin: 0 }); build(y, x); }
    const rc = new THREE.Raycaster(), mv = new THREE.Vector2();
    const pick = (e, dir) => { const b = r.domElement.getBoundingClientRect(); mv.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); rc.setFromCamera(mv, cam); const h = rc.intersectObjects(tiles.map(t => t.plate))[0]; if (h) turnTile(h.object.userData.y, h.object.userData.x, dir); };
    r.domElement.addEventListener('mousedown', e => { if (e.button === 0) pick(e, 1); }); r.domElement.addEventListener('contextmenu', e => { e.preventDefault(); pick(e, -1); });
    const lp = () => { if (!MG.active) { r.dispose(); r.forceContextLoss && r.forceContextLoss(); return; } const on = powered(); for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { const t = tiles[y * C + x]; const hot = on[y][x];
        t.mat.color.setHex(hot ? (won ? 0x60ffa0 : 0xffd060) : 0x8a6a48); t.mat.emissive.setHex(hot ? (won ? 0x20a050 : 0x805010) : 0); t.spin *= .8; t.arms.rotation.z = t.spin; }
      brk.material.emissive.setHex(won ? 0x20a050 : 0); r.render(sc, cam); requestAnimationFrame(lp); }; requestAnimationFrame(lp);
    return { spin: (y, x, dir) => { const t = tiles[y * C + x]; build(y, x); t.spin = dir * Math.PI / 2; } }; })();
  c.addEventListener('click', e => click(e, 1)); c.addEventListener('contextmenu', e => { e.preventDefault(); click(e, -1); });
  keys(() => {});
  draw();
  if (won) { grid[r0][0] = rot(grid[r0][0]); draw(); }
  return p;
}

/* ---------- 4. 피아노 ---------- */
const NOTES = [['도', 261.6], ['레', 293.7], ['미', 329.6], ['파', 349.2], ['솔', 392.0], ['라', 440.0], ['시', 493.9], ['도²', 523.3]];
function piano({ melody, sheet, onFail }) {
  const p = open('피아노', `숫자 키 <b>1~8</b> 또는 건반 클릭 · 악보의 선율을 그대로 쳐라${sheet ? `<br>악보: <b style="color:#e8d8a8">${sheet}</b>` : '<br><span style="color:#a06a6a">어딘가에 악보가 있었을 것 같다…</span>'}`);
  const kb = document.createElement('div'); kb.className = 'pianoKb'; $('mgBody').appendChild(kb);
  const disp = document.createElement('div'); disp.className = 'pianoDisp'; $('mgBody').appendChild(disp);
  let idx = 0, played = [];
  kb.innerHTML = NOTES.map(([n], i) => `<button data-i="${i}"><small>${i + 1}</small>${n}</button>`).join('');
  let press = i => {
    const b = kb.children[i]; b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 160);
    sfx.note(NOTES[i][1]); played.push(NOTES[i][0]);
    if (i === melody[idx]) { idx++; if (idx === melody.length) { setTimeout(() => close(true), 400); } }
    else { idx = i === melody[0] ? 1 : 0; if (played.length > 1) { status('…음이 어긋났다', 'err'); if (onFail) onFail(); } played = idx ? [NOTES[i][0]] : []; }
    disp.textContent = played.join(' · ') || '…';
  };
  kb.querySelectorAll('button').forEach(b => { b.onclick = () => press(+b.dataset.i); });
  keys(e => { if (e.type === 'keydown' && /^(Digit|Numpad)[1-8]$/.test(e.code)) press(+e.code.slice(-1) - 1); });
  disp.textContent = '…';
  // 3D 업라이트 피아노: 검은 래커 본체 · 흰 건반 8 (누르면 내려간다) · 장식 검은 건반 · 보면대 악보 · 촛불 — 건반 클릭 또는 숫자 키
  (() => { let r; try { r = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { return; }
    r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(460, 280); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.domElement.className = 'mgCanvas'; r.domElement.dataset.own3d = '1'; $('mgBody').insertBefore(r.domElement, kb); kb.style.display = 'none';
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0b0908); const cam = new THREE.PerspectiveCamera(34, 460 / 280, .05, 20); cam.position.set(0, 1.05, 1.25); cam.lookAt(0, .82, 0);
    sc.add(new THREE.HemisphereLight(0xffe8cc, 0x100c08, .45)); const cl = new THREE.PointLight(0xffb060, 3.5, 4); cl.position.set(-.55, 1.25, .1); sc.add(cl); const key = new THREE.SpotLight(0xfff0dc, 10, 5, .6, .5, 1.5); key.position.set(.4, 2, 1.2); sc.add(key, key.target);
    const lac = new THREE.MeshStandardMaterial({ color: 0x0c0a0a, roughness: .18, metalness: .2 }), ivory = new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: .35 }), ebony = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: .3 });
    const add = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); sc.add(o); return o; };
    add(new THREE.BoxGeometry(1.4, 1.2, .25), lac, 0, 1.1, -.25); add(new THREE.BoxGeometry(1.4, .06, .4), lac, 0, .72, -.05); add(new THREE.BoxGeometry(1.42, .04, .08), lac, 0, .86, -.21);
    const KW = .085, keysM = NOTES.map((_, i) => { const k = add(new THREE.BoxGeometry(KW - .005, .03, .28), ivory.clone(), (i - (NOTES.length - 1) / 2) * KW, .77, .03); k.userData.i = i; return k; });
    [0, 1, 3, 4, 5].forEach(i => { if (i + 1 < NOTES.length) add(new THREE.BoxGeometry(KW * .55, .035, .17), ebony, (i + .5 - (NOTES.length - 1) / 2) * KW, .8, -.03); });
    const sh = document.createElement('canvas'); sh.width = 256; sh.height = 160; const g2 = sh.getContext('2d'); g2.fillStyle = '#e8dcc0'; g2.fillRect(0, 0, 256, 160); g2.strokeStyle = '#444'; for (let l = 0; l < 2; l++) for (let k = 0; k < 5; k++) { g2.beginPath(); g2.moveTo(10, 40 + l * 60 + k * 7); g2.lineTo(246, 40 + l * 60 + k * 7); g2.stroke(); }
    g2.fillStyle = '#1a1208'; g2.font = 'bold 22px sans-serif'; g2.textAlign = 'center'; g2.fillText((sheet || '악보 없음 …').replace(/<[^>]+>/g, '').slice(0, 30), 128, 26); const st = new THREE.CanvasTexture(sh); st.colorSpace = THREE.SRGBColorSpace;
    const stand = add(new THREE.PlaneGeometry(.42, .26), new THREE.MeshBasicMaterial({ map: st, color: 0xb8ac90, toneMapped: false }), 0, 1.02, -.12);   // 조명에 하얗게 날아가 악보 글씨가 안 보이던 문제 → 조명 영향 없는 재질 stand.rotation.x = -.25;
    add(new THREE.CylinderGeometry(.02, .02, .14, 12), new THREE.MeshStandardMaterial({ color: 0xf0e8d0 }), -.55, 1.16, -.06); const flame = add(new THREE.SphereGeometry(.012, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc060 }), -.55, 1.25, -.06);
    const down = new Array(NOTES.length).fill(0), rc = new THREE.Raycaster(), mv = new THREE.Vector2();
    r.domElement.addEventListener('mousedown', e => { const b = r.domElement.getBoundingClientRect(); mv.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); rc.setFromCamera(mv, cam); const h = rc.intersectObjects(keysM)[0]; if (h) press(h.object.userData.i); });
    const press0 = press; press = i => { down[i] = 1; keysM[i].material.color.setHex(0xffe6a0); setTimeout(() => keysM[i].material.color.setHex(0xf0ead8), 180); press0(i); };
    const lp = () => { if (!MG.active) { r.dispose(); r.forceContextLoss && r.forceContextLoss(); return; } keysM.forEach((k, i) => { down[i] = Math.max(0, down[i] - .12); k.position.y = .77 - down[i] * .012; k.rotation.x = down[i] * .06; }); cl.intensity = 3.2 + Math.sin(performance.now() / 90) * .4 + Math.random() * .3; flame.scale.y = 1 + Math.random() * .3; r.render(sc, cam); requestAnimationFrame(lp); }; requestAnimationFrame(lp); })();
  return p;
}

/* ---------- 5. 슬라이딩 퍼즐 ---------- */
function slide({ img, title = '그림 맞추기' }) {
  const N = 3, p = open(title, '빈칸 옆의 조각을 클릭하거나 방향키로 밀어 그림을 완성하라');
  const box = document.createElement('div'); box.className = 'slideBox'; $('mgBody').appendChild(box);
  const info = document.createElement('div'); info.className = 'mgInfo'; $('mgBody').appendChild(info);
  let t = [...Array(N * N).keys()], e0 = N * N - 1, moves = 0;
  const nb = i => [i - N, i + N, i % N ? i - 1 : -1, (i + 1) % N ? i + 1 : -1].filter(j => j >= 0 && j < N * N);
  const swap = j => { const e = t.indexOf(N * N - 1); t[e] = t[j]; t[j] = N * N - 1; };
  for (let k = 0, last = -1; k < 90; k++) { const e = t.indexOf(N * N - 1), c = nb(e).filter(j => j !== last); const j = c[(Math.random() * c.length) | 0]; last = e; swap(j); }
  if (t.every((v, i) => v === i)) swap(nb(t.indexOf(N * N - 1))[0]);
  const render = () => {
    box.innerHTML = t.map((v, i) => v === N * N - 1 ? '<div class="sl empty"></div>' : `<div class="sl" data-i="${i}" style="background-image:url(${img});background-position:${(v % N) * 50}% ${((v / N) | 0) * 50}%"></div>`).join('');
    box.querySelectorAll('.sl[data-i]').forEach(d => { d.onclick = () => move(+d.dataset.i); });
    info.textContent = `이동 ${moves}회`;
  };
  const move = j => {
    if (!nb(t.indexOf(N * N - 1)).includes(j)) return;
    swap(j); moves++; sfx.slide(); render();
    if (t.every((v, i) => v === i)) { box.innerHTML = `<img src="${img}" style="width:100%;display:block">`; close(true); }
  };
  keys(e => {
    if (e.type !== 'keydown') return; const em = t.indexOf(N * N - 1);
    const d = { ArrowUp: em + N, KeyW: em + N, ArrowDown: em - N, KeyS: em - N, ArrowLeft: (em + 1) % N ? em + 1 : -1, KeyA: (em + 1) % N ? em + 1 : -1, ArrowRight: em % N ? em - 1 : -1, KeyD: em % N ? em - 1 : -1 }[e.code];
    if (d != null && d >= 0 && d < N * N) move(d);
  });
  render();
  return p;
}

/* ---------- 6. 갈고리 낚기 (타이밍) ---------- */
function fishing({ title = '배수구 — 갈고리 걸기', need = 1 }) {
  // 진자 물리: 줄 끝 갈고리를 흔들어(A·D) 깊이를 맞춰(W·S) 물살에 떠다니는 고리에 걸고, Space 를 눌러 감는다 — 줄 장력이 한계를 넘으면 미끄러진다
  const p = open(title, '<b>A · D</b> 흔들기 · <b>W · S</b> 줄 길이 · 고리에 천천히 닿으면 걸린다<br>걸린 뒤 <b>Space 유지</b>로 감기 — 장력이 빨개지면 손을 늦춰라 (3번 놓치면 실패)');
  const c = canvas(440, 300), g = c.getContext('2d');
  const AX = 220, AY = 18;
  let len = 120, ang = .4, av = 0, hooked = false, reel = 0, tension = 0, miss = 0, caught = 0, held = {}, t = 0, lastT = performance.now();
  let rx = 120 + Math.random() * 200, ry = 210 + Math.random() * 40, rvx = 18;
  // 3D 배수 집수정 단면: 콘크리트 벽 · 철망 덮개 · 출렁이는 수면 · 낚싯줄과 갈고리 · 물살에 떠다니는 금빛 열쇠고리 (좌표는 2D 물리 그대로 옮김)
  const F3 = (() => { let r; try { r = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { return null; }
    r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(440, 300); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.domElement.className = 'mgCanvas'; r.domElement.dataset.own3d = '1'; $('mgBody').insertBefore(r.domElement, c); c.height = 40; c.style.height = 'auto';
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x05090b); sc.fog = new THREE.Fog(0x05090b, 3, 7); const cam = new THREE.PerspectiveCamera(42, 440 / 300, .05, 20); cam.position.set(0, -.2, 3.6); cam.lookAt(0, -.6, 0);
    sc.add(new THREE.HemisphereLight(0x8ab0c0, 0x101010, .5)); const fl = new THREE.SpotLight(0xfff0d8, 22, 8, .5, .6, 1.4); fl.position.set(.3, 1.6, 1.8); fl.target.position.set(0, -1.2, 0); sc.add(fl, fl.target);
    const X = x => (x - 220) / 100, Y = y => 1.3 - y / 100, conc = new THREE.MeshStandardMaterial({ color: 0x4a4e4a, roughness: .95 }), rust = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: .7, metalness: .5 });
    [-1, 1].forEach(sd => { const w = new THREE.Mesh(new THREE.BoxGeometry(.5, 3.2, 1.6), conc); w.position.set(sd * 1.95, -.3, 0); sc.add(w); }); const back = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.2), conc); back.position.set(0, -.3, -.8); sc.add(back);
    for (let x = -1.65; x < 1.7; x += .22) { const b = new THREE.Mesh(new THREE.BoxGeometry(.06, .06, 1.2), rust); b.position.set(x, 1.18, 0); sc.add(b); }
    const wg = new THREE.PlaneGeometry(3.4, 1.4, 40, 16); wg.rotateX(-Math.PI / 2); const water = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: 0x1a4a58, roughness: .12, metalness: .3, transparent: true, opacity: .82 })); water.position.y = Y(150); sc.add(water);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 1, 6), new THREE.MeshStandardMaterial({ color: 0xd8d6c8, roughness: .6 })); sc.add(line);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(.06, .012, 8, 20, Math.PI * 1.4), new THREE.MeshStandardMaterial({ color: 0xc8c0a8, metalness: .9, roughness: .3 })); sc.add(hook);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.09, .018, 10, 26), new THREE.MeshStandardMaterial({ color: 0xe0b850, metalness: 1, roughness: .25, emissive: 0x302000 })); sc.add(ring);
    const key = new THREE.Mesh(new THREE.BoxGeometry(.03, .16, .01), ring.material); sc.add(key);
    return { render(hx, hy, rx2, ry2, tt) { const pos = wg.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, Math.sin(x * 4 + tt * 2.2) * .025 + Math.cos(z * 5 + tt * 1.7) * .02); } pos.needsUpdate = true; wg.computeVertexNormals();
      const ax = X(AX), ay = Y(AY), bx = X(hx), by = Y(hy), dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy); line.scale.y = L; line.position.set((ax + bx) / 2, (ay + by) / 2, 0); line.rotation.z = Math.atan2(-dx, dy) + 0 * Math.PI;
      hook.position.set(bx + .02, by - .03, 0); ring.position.set(X(rx2), Y(ry2), .02); ring.rotation.set(Math.sin(tt) * .4, tt * .7, 0); key.position.set(X(rx2), Y(ry2) - .14, .02); key.rotation.z = Math.sin(tt * 1.3) * .3;
      fl.position.x = .3 + Math.sin(tt * .7) * .1; r.render(sc, cam); }, dispose() { r.dispose(); r.forceContextLoss && r.forceContextLoss(); } }; })();
  if (F3) cleanups.push(() => F3.dispose());
  MG.fh = { get hooked() { return hooked; }, get tension() { return tension; }, get reel() { return reel; }, get s() { return { len, ang, av, rx, ry, AX, AY }; } };
  keys(e => { held[e.code] = e.type === 'keydown'; });
  const loop = now => {
    const dt = Math.min(.05, (now - lastT) / 1000); lastT = now; t += dt;
    // 물살: 고리가 좌우로 떠다닌다
    rx += rvx * dt + Math.sin(t * 1.3) * 12 * dt; if (rx < 70 || rx > 370) rvx = -rvx; ry += Math.sin(t * .9) * 6 * dt;
    if (!hooked) {
      if (held.KeyW || held.ArrowUp) len = Math.max(40, len - 70 * dt); if (held.KeyS || held.ArrowDown) len = Math.min(250, len + 70 * dt);
      const push = (held.KeyD || held.ArrowRight ? 1 : 0) - (held.KeyA || held.ArrowLeft ? 1 : 0);
      av += (-9.8 * 40 / len * Math.sin(ang) + push * 2.6) * dt; av *= Math.pow(.55, dt); ang = clamp(ang + av * dt, -1.3, 1.3);
      const hx = AX + Math.sin(ang) * len, hy = AY + Math.cos(ang) * len, sp = Math.abs(av) * len;
      if (Math.hypot(hx - rx, hy - ry) < 13) { if (sp < 140) { hooked = true; reel = len; sfx.hook(); status('걸렸다! Space 를 눌러 천천히 감아라', 'ok'); } else if (Math.random() < dt * 6) status('너무 빠르다 — 천천히 다가가라'); }
    } else {
      const gust = .25 + .2 * Math.sin(t * 2.1) + (Math.sin(t * 7.3) > .85 ? .45 : 0);
      if (held.Space) { reel -= 38 * dt; tension = Math.min(1.2, tension + (gust + .35) * dt * 1.3); } else tension = Math.max(0, tension - dt * .9);
      ang *= Math.pow(.2, dt); len = reel; rx = AX + Math.sin(ang) * len; ry = AY + Math.cos(ang) * len;
      if (tension > 1) { miss++; hooked = false; tension = 0; len = Math.min(250, reel + 60); rx = 120 + Math.random() * 200; ry = 210 + Math.random() * 40; sfx.buzz(); status(`줄이 미끄러졌다… (${miss}/3)`, 'err'); if (miss >= 3) { draw(); return setTimeout(() => close(false), 600); } }
      else if (reel <= 30) { caught++; sfx.splash(); status(`끌어올렸다! (${caught}/${need})`, 'ok'); if (caught >= need) { draw(); return setTimeout(() => close(true), 400); } hooked = false; len = 120; rx = 120 + Math.random() * 200; tension = 0; }
    }
    draw(); raf = requestAnimationFrame(loop);
  };
  function draw() {
    if (F3) { F3.render(AX + Math.sin(ang) * len, AY + Math.cos(ang) * len, rx, ry, t); g.fillStyle = '#070d10'; g.fillRect(0, 0, 440, 40); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(60, 22, 320, 10); g.fillStyle = tension > .75 ? '#e05040' : '#60e0a0'; g.fillRect(60, 22, 320 * Math.min(1, tension), 10); g.fillStyle = '#d8d0b8'; g.font = '11px sans-serif'; g.fillText('줄 장력', 62, 16); return; }
    g.fillStyle = '#070d10'; g.fillRect(0, 0, 440, 300);
    g.fillStyle = '#20282a'; g.fillRect(0, 0, 50, 300); g.fillRect(390, 0, 50, 300);   // 배수관 벽
    for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(40,90,110,${.12 + .08 * Math.sin(t * 2 + k)})`; g.fillRect(50, 150 + k * 11 + Math.sin(t * 1.5 + k) * 3, 340, 5); }
    g.fillStyle = '#3a3a34'; for (let x = 50; x < 390; x += 22) g.fillRect(x, 10, 12, 10);   // 배수구 덮개 살
    const hx = AX + Math.sin(ang) * len, hy = AY + Math.cos(ang) * len;
    g.strokeStyle = 'rgba(214,214,200,.85)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(AX, AY); g.lineTo(hx, hy); g.stroke();
    g.strokeStyle = '#c8c0a8'; g.lineWidth = 3; g.beginPath(); g.arc(hx + 5, hy + 4, 6, Math.PI, Math.PI * 2.5); g.stroke();
    g.strokeStyle = '#e0b850'; g.lineWidth = 4; g.beginPath(); g.arc(rx, ry, 9, 0, 7); g.stroke();   // 떠다니는 열쇠고리
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(60, 280, 320, 10); g.fillStyle = tension > .75 ? '#e05040' : '#60e0a0'; g.fillRect(60, 280, 320 * Math.min(1, tension), 10);
    g.fillStyle = '#d8d0b8'; g.font = '11px sans-serif'; g.fillText('줄 장력', 62, 275);
  }
  raf = requestAnimationFrame(loop);
  return p;
}

/* ---------- 7. 녹음 순서 맞추기 (마지막 방송) ---------- */
// 카드를 클릭해 두 장씩 자리를 바꾸고, ▶ 로 들어 볼 수 있다. 자막(텍스트)과 파형을 함께 보여 준다
function order({ title, frags, showTimes, onFail }) {
  const p = open(title, `그날 밤의 녹음 조각을 <b>일어난 순서대로</b> 놓아라 — 두 카드를 차례로 눌러 자리를 바꾼다 · ▶ 다시 듣기<br>휴대폰의 <b>사건 연표</b>가 도움이 된다`);
  let cur = frags.map((f, i) => i); do { cur.sort(() => Math.random() - .5); } while (cur.every((v, i) => v === i));
  let pick = -1, fails = 0, times = !!showTimes;
  const box = document.createElement('div'); box.className = 'tapeBox'; $('mgBody').appendChild(box);
  const btn = document.createElement('button'); btn.className = 'btn pri'; btn.textContent = '이 순서로 방송 송출'; btn.style.marginTop = '10px'; $('mgBody').appendChild(btn);
  const wave = seed => { let s = seed * 9301 + 49297, out = ''; for (let k = 0; k < 28; k++) { s = (s * 9301 + 49297) % 233280; out += `<i style="height:${4 + (s / 233280) * 22}px"></i>`; } return out; };
  const render = () => {
    box.innerHTML = cur.map((fi, slot) => { const f = frags[fi]; return `<div class="tape${slot === pick ? ' pick' : ''}" data-s="${slot}"><em>${slot + 1}</em><div class="wv">${wave(fi + 3)}</div><span>${f.text}</span>${times ? `<b>${f.t}</b>` : ''}<button data-play="${fi}">▶</button></div>`; }).join('');
    box.querySelectorAll('.tape').forEach(el => { el.onclick = e => { if (e.target.dataset.play != null) { sfx.tape(); sfx.staticNoise(.6); status(frags[+e.target.dataset.play].text); return; } const s = +el.dataset.s; if (pick < 0) { pick = s; sfx.dial(); } else { [cur[pick], cur[s]] = [cur[s], cur[pick]]; pick = -1; sfx.slide(); } render(); }; });
  };
  btn.onclick = () => {
    if (cur.every((v, i) => v === i)) { sfx.broadcast(); close(true); return; }
    fails++; if (onFail) onFail(); sfx.buzz(); status('…지직. 순서가 맞지 않는다', 'err');
    if (fails >= 2 && !times) { times = true; status('녹음 테이프에 적힌 시각이 보인다', 'err'); }
    render();
  };
  keys(() => {});
  render();
  return p;
}


/* ---------- 8. 짝 맞추기 (기억력) ---------- */
// 카드를 두 장씩 뒤집어 같은 그림을 찾는다. 틀린 횟수가 많으면 실패
// 카드 앞면 그림: 이모지 대신 직접 그린 빈티지 삽화 (1990년대 학교 물건 · 컴퓨터실 · 미술실). 모르는 그림은 이모지로.
function cardArt(g, ic) {
  const W = 128, H = 176, cx = 64, cy = 92, R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); }, C = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }, S = (c, w) => { g.strokeStyle = c; g.lineWidth = w; }, L = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
  const bg = g.createRadialGradient(cx, cy, 10, cx, cy, 90); bg.addColorStop(0, '#f8f0dc'); bg.addColorStop(1, '#dccaa0'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  S('#8a6a3a', 4); g.strokeRect(6, 6, W - 12, H - 12); S('rgba(138,106,58,.5)', 1); g.strokeRect(12, 12, W - 24, H - 24);
  for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(110,80,40,${Math.random() * .08})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  g.save(); g.lineJoin = 'round';
  const D = {
    '📻': () => { R(28, 70, 72, 46, '#6a3a1e'); R(32, 74, 34, 38, '#2a1a10'); for (let y = 78; y < 110; y += 5) R(34, y, 30, 2, '#5a4030'); R(70, 76, 26, 12, '#e8d8a0'); S('#c02020', 1.5); L([[76, 76], [76, 88]]); C(76, 102, 6, '#c8a860'); C(90, 102, 6, '#c8a860'); S('#888', 2); L([[90, 70], [104, 40]]); },
    '🎹': () => { R(18, 74, 92, 40, '#111'); for (let i = 0; i < 8; i++) R(21 + i * 11, 78, 10, 32, '#f4eee0'); [0, 1, 3, 4, 5].forEach(i => R(28 + i * 11, 78, 6, 19, '#111')); R(18, 66, 92, 8, '#2a1a10'); },
    '📼': () => { R(20, 72, 88, 48, '#1c1c1c'); R(28, 78, 72, 14, '#e8dcc0'); g.fillStyle = '#c02020'; g.font = 'bold 9px sans-serif'; g.fillText('1998.10.12', 34, 89); C(46, 104, 9, '#555'); C(82, 104, 9, '#555'); C(46, 104, 3, '#111'); C(82, 104, 3, '#111'); R(52, 100, 24, 8, '#3a2a1a'); },
    '🔔': () => { g.fillStyle = '#c8a040'; g.beginPath(); g.moveTo(40, 112); g.quadraticCurveTo(42, 60, 64, 58); g.quadraticCurveTo(86, 60, 88, 112); g.closePath(); g.fill(); R(34, 110, 60, 7, '#a07a28'); C(64, 122, 6, '#7a5a20'); C(64, 54, 5, '#a07a28'); S('rgba(255,240,200,.6)', 3); L([[52, 70], [48, 104]]); },
    '📕': () => { R(34, 56, 60, 76, '#a02a22'); R(34, 56, 8, 76, '#6a1a14'); R(50, 70, 36, 20, '#e8d8b0'); g.fillStyle = '#6a1a14'; g.font = 'bold 8px serif'; g.textAlign = 'center'; g.fillText('학교 일지', 68, 84); g.textAlign = 'left'; R(94, 60, 4, 70, '#f0e8d0'); },
    '🗝': () => { S('#9a7a3a', 7); g.beginPath(); g.arc(46, 80, 14, 0, 7); g.stroke(); L([[60, 86], [100, 112]]); L([[86, 103], [80, 114]]); L([[95, 109], [89, 120]]); S('#e0c070', 2); g.beginPath(); g.arc(44, 77, 10, 3.6, 5.2); g.stroke(); },
    '💾': () => { R(30, 62, 68, 68, '#2a3a6a'); R(44, 62, 38, 22, '#c0c4c8'); R(70, 66, 8, 14, '#2a3a6a'); R(38, 96, 52, 30, '#f0ece0'); S('#3a6aca', 1); for (let y = 104; y < 124; y += 6) L([[42, y], [86, y]]); },
    '🖥': () => { R(26, 58, 76, 56, '#d8d0b8'); R(32, 64, 64, 44, '#1a2a2a'); g.fillStyle = '#40e080'; g.font = '9px monospace'; g.fillText('C:\\>_', 36, 78); R(54, 114, 20, 8, '#c8c0a8'); R(40, 122, 48, 6, '#b8b098'); },
    '📁': () => { g.fillStyle = '#d8a840'; g.beginPath(); g.moveTo(26, 72); g.lineTo(54, 72); g.lineTo(60, 80); g.lineTo(102, 80); g.lineTo(102, 124); g.lineTo(26, 124); g.closePath(); g.fill(); R(30, 86, 72, 38, '#e8bc58'); R(36, 76, 40, 6, '#f4f0e4'); },
    '🖨': () => { R(28, 82, 72, 34, '#c8c0aa'); R(40, 56, 48, 28, '#f6f2e8'); S('#555', 1); for (let y = 62; y < 80; y += 5) L([[44, y], [84, y]]); R(36, 116, 56, 16, '#f6f2e8'); C(88, 92, 3, '#40c060'); },
    '📀': () => { const gr = g.createRadialGradient(64, 92, 6, 64, 92, 40); gr.addColorStop(0, '#fff'); gr.addColorStop(.4, '#e8c860'); gr.addColorStop(.7, '#c8a0e0'); gr.addColorStop(1, '#a0d0e0'); C(64, 92, 40, gr); C(64, 92, 9, '#dccaa0'); S('rgba(0,0,0,.3)', 1); g.beginPath(); g.arc(64, 92, 40, 0, 7); g.stroke(); },
    '⌨': () => { R(16, 80, 96, 40, '#d0c8b0'); for (let r = 0; r < 4; r++) for (let k = 0; k < 9; k++) R(20 + k * 10 + (r % 2) * 3, 84 + r * 8, 8, 6, '#f0ece0'); R(36, 114, 50, 4, '#f0ece0'); },
    '🎨': () => { g.fillStyle = '#c8945a'; g.beginPath(); g.ellipse(64, 94, 42, 32, -.2, 0, 7); g.fill(); C(78, 108, 7, '#dccaa0'); [['#d02020', 44, 82], ['#2050c0', 60, 74], ['#e0c020', 78, 78], ['#20a040', 46, 102], ['#f0f0f0', 90, 92]].forEach(([c, x, y]) => C(x, y, 7, c)); },
    '🖌': () => { S('#7a4a24', 7); L([[38, 128], [76, 72]]); R(74, 60, 14, 16, '#b8b8b8'); g.fillStyle = '#2050c0'; g.beginPath(); g.moveTo(76, 62); g.lineTo(90, 62); g.lineTo(92, 44); g.lineTo(80, 38); g.closePath(); g.fill(); },
    '🗿': () => { R(40, 120, 48, 10, '#8a8478'); g.fillStyle = '#a8a294'; g.beginPath(); g.moveTo(46, 120); g.lineTo(44, 64); g.quadraticCurveTo(64, 46, 84, 64); g.lineTo(82, 120); g.closePath(); g.fill(); R(50, 78, 10, 4, '#5a554c'); R(68, 78, 10, 4, '#5a554c'); R(60, 84, 8, 18, '#8a8478'); R(54, 106, 20, 4, '#5a554c'); },
    '🖼': () => { R(26, 60, 76, 64, '#8a6a2a'); R(32, 66, 64, 52, '#7aa8c8'); g.fillStyle = '#4a7a3a'; g.beginPath(); g.moveTo(32, 118); g.lineTo(52, 90); g.lineTo(66, 104); g.lineTo(80, 84); g.lineTo(96, 118); g.fill(); C(82, 76, 6, '#f8e8a0'); },
    '✏': () => { g.save(); g.translate(64, 92); g.rotate(-.7); R(-8, -46, 16, 74, '#e8b820'); R(-8, -54, 16, 10, '#e88888'); R(-8, -46, 16, 4, '#b8b8b8'); g.fillStyle = '#e8c890'; g.beginPath(); g.moveTo(-8, 28); g.lineTo(8, 28); g.lineTo(0, 44); g.fill(); g.fillStyle = '#333'; g.beginPath(); g.moveTo(-3, 38); g.lineTo(3, 38); g.lineTo(0, 44); g.fill(); g.restore(); },
    '📐': () => { g.fillStyle = 'rgba(80,160,200,.55)'; g.beginPath(); g.moveTo(30, 124); g.lineTo(98, 124); g.lineTo(30, 56); g.closePath(); g.fill(); S('#2a6a8a', 2); g.stroke(); S('#2a6a8a', 1); for (let i = 0; i < 10; i++) L([[36 + i * 6, 124], [36 + i * 6, 118]]); },
    '🌙': () => { R(20, 50, 88, 84, '#1a2440'); C(70, 88, 26, '#f4e8b0'); C(82, 80, 24, '#1a2440'); for (let i = 0; i < 12; i++) C(24 + Math.random() * 80, 54 + Math.random() * 76, 1, '#fff'); },
  };
  if (D[ic]) D[ic](); else { g.font = '72px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#222'; g.fillText(ic, cx, cy); }
  g.restore();
}
function memory({ title = '짝 맞추기', icons = ['📻', '🎹', '📼', '🔔', '📕', '🗝'], maxMiss = 8 }) {
  const p = open(title, '카드를 클릭해 두 장씩 뒤집고 <b>같은 그림</b>을 모두 찾아라 · 틀린 횟수가 다 차면 실패');
  const deck = [...icons, ...icons].map((ic, i) => ({ ic, id: i, open: false, done: false })).sort(() => Math.random() - .5);
  const box = document.createElement('div'); box.className = 'memGrid'; box.style.gridTemplateColumns = `repeat(${deck.length > 12 ? 5 : 4}, 64px)`; $('mgBody').appendChild(box);
  const info = document.createElement('div'); info.className = 'mgInfo'; $('mgBody').appendChild(info);
  let first = null, lock = false, miss = 0, pairs = 0;
  const render = () => {
    box.innerHTML = deck.map((c, i) => `<button class="memCard${c.open || c.done ? ' open' : ''}${c.done ? ' done' : ''}" data-i="${i}">${c.open || c.done ? c.ic : '?'}</button>`).join('');
    info.innerHTML = `찾은 짝 <b>${pairs}</b> / ${icons.length} · 남은 실수 <b>${maxMiss - miss}</b>`;
    box.querySelectorAll('.memCard').forEach(b => { b.onclick = () => flip(+b.dataset.i); });
  };
  const flip = i => {
    const c = deck[i]; if (lock || c.open || c.done) return;
    c.open = true; sfx.paper(); render();
    if (!first) { first = c; return; }
    if (first.ic === c.ic) { first.done = c.done = true; first = null; pairs++; sfx.ding ? sfx.ding() : sfx.unlock(); render(); if (pairs >= icons.length) setTimeout(() => close(true), 350); return; }
    lock = true; miss++; sfx.buzz(); const a = first; first = null;
    setTimeout(() => { a.open = c.open = false; lock = false; render(); if (miss >= maxMiss) { status('…카드가 모두 뒤집혔다', 'err'); setTimeout(() => close(false), 600); } }, 650);
  };
  // 3D 카드: 책상 위 카드(뒷면 교표 · 앞면 그림) — 클릭하면 실제로 뒤집히고, 짝이 맞으면 살짝 떠오르며 금테가 빛난다
  (() => { let r; try { r = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { return; }
    r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(460, 300); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.domElement.className = 'mgCanvas'; r.domElement.dataset.own3d = '1'; $('mgBody').insertBefore(r.domElement, box); box.style.display = 'none';
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0c0a08); const cam = new THREE.PerspectiveCamera(34, 460 / 300, .05, 20); cam.position.set(0, 2.2, 1.5); cam.lookAt(0, 0, .05);
    sc.add(new THREE.HemisphereLight(0xfff0dc, 0x140c06, .5)); const L = new THREE.SpotLight(0xfff0dc, 16, 7, .7, .5, 1.4); L.position.set(.5, 2.4, 1); sc.add(L, L.target);
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: .55 })); desk.rotation.x = -Math.PI / 2; sc.add(desk);
    const tex = draw => { const c2 = document.createElement('canvas'); c2.width = 128; c2.height = 176; const g2 = c2.getContext('2d'); draw(g2); const t = new THREE.CanvasTexture(c2); t.colorSpace = THREE.SRGBColorSpace; return t; };
    const backT = tex(g2 => { g2.fillStyle = '#2a3a5a'; g2.fillRect(0, 0, 128, 176); g2.strokeStyle = '#c8a860'; g2.lineWidth = 6; g2.strokeRect(8, 8, 112, 160); g2.fillStyle = '#c8a860'; g2.font = 'bold 30px serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText('서문', 64, 76); g2.font = '16px serif'; g2.fillText('1987', 64, 108); }); backT.center.set(.5, .5); backT.rotation = Math.PI;
    const cols = deck.length > 12 ? 5 : 4, rows = Math.ceil(deck.length / cols), CW = .34, CH = .46, gap = .08;
    const cards = deck.map((d, i) => { const front = tex(g2 => cardArt(g2, d.ic));
      const m = [new THREE.MeshStandardMaterial({ color: 0xe8e0cc }), new THREE.MeshStandardMaterial({ color: 0xe8e0cc }), new THREE.MeshStandardMaterial({ map: front, roughness: .5 }), new THREE.MeshStandardMaterial({ map: backT, roughness: .5 }), new THREE.MeshStandardMaterial({ color: 0xe8e0cc }), new THREE.MeshStandardMaterial({ color: 0xe8e0cc })];
      const o = new THREE.Mesh(new THREE.BoxGeometry(CW, .012, CH), m); const x = i % cols, y = (i / cols) | 0; o.position.set((x - (cols - 1) / 2) * (CW + gap), .01, (y - (rows - 1) / 2) * (CH + gap)); o.rotation.z = Math.PI; o.userData.i = i; sc.add(o); return { o, flip: 0, lift: 0 }; });
    const rc = new THREE.Raycaster(), mv = new THREE.Vector2();
    r.domElement.addEventListener('mousedown', e => { const b = r.domElement.getBoundingClientRect(); mv.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); rc.setFromCamera(mv, cam); const h = rc.intersectObjects(cards.map(c3 => c3.o))[0]; if (h) flip(h.object.userData.i); });
    const lp = () => { if (!MG.active) { r.dispose(); r.forceContextLoss && r.forceContextLoss(); return; } cards.forEach((c3, i) => { const d = deck[i], tgt = d.open || d.done ? 1 : 0; c3.flip += (tgt - c3.flip) * .2; c3.lift += ((d.done ? 1 : 0) - c3.lift) * .1;
        c3.o.rotation.z = Math.PI * (1 - c3.flip); c3.o.position.y = .01 + Math.sin(c3.flip * Math.PI) * .12 + c3.lift * .03; if (d.done) c3.o.material[2].emissive.setHex(0x302000); });
      r.render(sc, cam); requestAnimationFrame(lp); }; requestAnimationFrame(lp); })();
  keys(() => {});
  render();
  return p;
}

/* ---------- 9. 주파수 맞추기 (라디오) ---------- */
// A · D / 마우스로 다이얼을 돌려 잡음이 사라지는 주파수를 찾고, 그 자리에서 1.5초 버티면 성공
function tune({ title = '라디오 주파수 맞추기', label = '…이 방송을 듣는 사람에게…' }) {
  const p = open(title, '<b>1) 주 동조 다이얼(A·D / 상단 스케일 드래그)</b>로 목표 주파수 대역을 찾고,<br><b>2) 미세 동조·안테나 게인 노브(W·S / 하단 노브 드래그)</b>를 맞춰 신호 감도 90% 이상에서 <b>[Space / 주파수 잠금]</b>을 눌러라');
  const c = canvas(480, 250), g = c.getContext('2d');
  screen3D(c, { kind: 'wood', prop: 'antenna' });
  const targetF = .22 + Math.random() * .58, targetG = .25 + Math.random() * .55;
  let f = .08, gain = .85, hold = 0, lastT = performance.now(), t = 0, dn = {}, dragMode = null, lastTick = 0;
  // 실제 조작(키·마우스) 전에는 절대 성공 처리하지 않는다 — 조작 없이 "성공!"으로 닫히던 현상 방지
  let touched = false; const touch = () => { touched = true; }; ['keydown', 'mousedown', 'wheel', 'pointerdown'].forEach(ev => addEventListener(ev, touch, true)); cleanups.push(() => ['keydown', 'mousedown', 'wheel', 'pointerdown'].forEach(ev => removeEventListener(ev, touch, true)));

  const setFromMouse = e => {
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) * c.width / r.width, y = (e.clientY - r.top) * c.height / r.height;
    if (dragMode === 'coarse' || (dragMode === null && y >= 108 && y <= 156)) {
      f = clamp((x - 24) / 432, 0, 1);
    } else if (dragMode === 'fine') {
      gain = clamp((x - 160) / 160, 0, 1);
    }
  };
  c.addEventListener('mousedown', e => {
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) * c.width / r.width, y = (e.clientY - r.top) * c.height / r.height;
    if (y >= 170 && y <= 238) {
      if (x >= 338 && x <= 462) { tryLock(); return; }
      if (x < 165) { dragMode = 'coarse'; return; }
      if (x >= 165 && x < 335) { dragMode = 'fine'; return; }
    }
    if (y >= 105 && y <= 160) { dragMode = 'coarse'; setFromMouse(e); }
  });
  c.addEventListener('mousemove', e => { if (dragMode) setFromMouse(e); });
  const mu = () => { dragMode = null; };
  addEventListener('mouseup', mu); cleanups.push(() => removeEventListener('mouseup', mu));
  c.addEventListener('wheel', e => {
    e.preventDefault();
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) * c.width / r.width;
    if (x < 240) f = clamp(f + (e.deltaY < 0 ? .018 : -.018), 0, 1);
    else gain = clamp(gain + (e.deltaY < 0 ? .025 : -.025), 0, 1);
    sfx.dial();
  }, { passive: false });

  const tryLock = () => {
    if (!finish || !touched) return;
    const df = Math.abs(f - targetF), dg = Math.abs(gain - targetG);
    const clear = clamp(1 - (df / .075 * .65 + dg / .18 * .35), 0, 1);
    if (clear >= .85) { sfx.radio ? sfx.radio() : sfx.unlock(); close(true); }
    else { sfx.buzz(); status('주 동조 주파수(A/D)와 안테나 미세 게인(W/S)을 모두 맞춰 감도를 85% 이상으로 올리세요!', 'err'); }
  };

  keys(e => {
    dn[e.code] = e.type === 'keydown';
    if (e.type === 'keydown' && (e.code === 'Space' || e.code === 'Enter')) tryLock();
  });

  const loop = now => {
    const dt = Math.min(.1, (now - lastT) / 1000); lastT = now; t += dt;
    if (dn.KeyA || dn.ArrowLeft) f = clamp(f - dt * .28, 0, 1);
    if (dn.KeyD || dn.ArrowRight) f = clamp(f + dt * .28, 0, 1);
    if (dn.KeyW || dn.ArrowUp) gain = clamp(gain + dt * .42, 0, 1);
    if (dn.KeyS || dn.ArrowDown) gain = clamp(gain - dt * .42, 0, 1);
    if (Math.abs(f - lastTick) > .018) { lastTick = f; sfx.dial(); }

    const df = Math.abs(f - targetF), dg = Math.abs(gain - targetG);
    const fLock = clamp(1 - df / .08, 0, 1), gLock = clamp(1 - dg / .20, 0, 1);
    const clear = clamp(fLock * .68 + gLock * .32, 0, 1);
    hold = clear >= .88 ? hold + dt : Math.max(0, hold - dt * 1.5);
    if (hold >= 1.25 && finish && touched) { sfx.radio ? sfx.radio() : sfx.unlock(); return close(true); }

    g.fillStyle = '#0a0f0d'; g.fillRect(0, 0, 480, 250);
    // 상단 오디오 스펙트럼 & S-미터
    g.fillStyle = '#111a16'; g.fillRect(18, 12, 310, 88); g.strokeStyle = '#365244'; g.strokeRect(18, 12, 310, 88);
    g.strokeStyle = `rgba(110,245,160,${.35 + clear * .65})`; g.lineWidth = 2; g.beginPath();
    for (let x = 22; x < 324; x += 4) {
      const noise = (Math.random() - .5) * 48 * (1 - clear);
      const wave = Math.sin(x * .06 + t * 7) * 20 * clear + Math.cos(x * .11 - t * 4) * 8 * clear;
      const y = 62 + noise + wave;
      x === 22 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = clear > .72 ? '#ffe088' : '#7a9284'; g.font = 'bold 12.5px sans-serif'; g.textAlign = 'center';
    g.fillText(clear > .72 ? label : '지지직… (주파수 및 안테나 게인 동조 필요)', 173, 30); g.textAlign = 'left';

    // 우측 아날로그 S-Meter 게이지
    g.fillStyle = '#141e1a'; g.fillRect(340, 12, 122, 88); g.strokeStyle = '#365244'; g.strokeRect(340, 12, 122, 88);
    g.fillStyle = '#98b8a8'; g.font = 'bold 11px monospace'; g.fillText('S-METER (감도)', 355, 28);
    g.strokeStyle = '#3a5848'; g.lineWidth = 4; g.beginPath(); g.arc(401, 82, 42, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    g.strokeStyle = '#58ff9a'; g.lineWidth = 4; g.beginPath(); g.arc(401, 82, 42, Math.PI * 1.70, Math.PI * 1.85); g.stroke();
    const sAng = Math.PI * (1.15 + clear * .70);
    g.strokeStyle = clear >= .85 ? '#60ffa0' : '#ff6850'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(401, 82); g.lineTo(401 + Math.cos(sAng) * 38, 82 + Math.sin(sAng) * 38); g.stroke();
    g.fillStyle = '#e8f4ec'; g.font = 'bold 12px monospace'; g.fillText(`${Math.round(clear * 100)}%`, 388, 95);

    // 중단 주파수 스케일 바 (88.0 ~ 108.0 MHz)
    g.fillStyle = '#16221c'; g.fillRect(24, 110, 432, 36); g.strokeStyle = '#405e4e'; g.strokeRect(24, 110, 432, 36);
    g.fillStyle = 'rgba(90,255,150,0.18)'; g.fillRect(24 + (targetF - .035) * 432, 112, .07 * 432, 32);
    g.fillStyle = '#8aa898'; g.font = '10.5px monospace';
    for (let k = 0; k <= 20; k++) {
      const kx = 24 + k * 21.6;
      g.fillRect(kx, 110, 1, k % 2 === 0 ? 12 : 6);
      if (k % 4 === 0) g.fillText((88 + k).toFixed(0), kx - 7, 141);
    }
    g.fillStyle = '#ff5840'; g.fillRect(24 + f * 432 - 1.5, 106, 3, 44);

    // 하단 듀얼 노브 패널 (1: 주동조 노브, 2: 안테나 게인/미세동조 노브, 3: 주파수 잠금 버튼)
    const drawKnob = (cx, cy, val, ok, lbl, sub) => {
      g.fillStyle = '#182226'; g.beginPath(); g.arc(cx, cy, 24, 0, 7); g.fill();
      g.strokeStyle = ok ? '#58ff9a' : '#687c84'; g.lineWidth = 2.5; g.stroke();
      const a = -Math.PI * .75 + val * Math.PI * 1.5;
      g.strokeStyle = '#ffffff'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 19, cy + Math.sin(a) * 19); g.stroke();
      g.fillStyle = '#d8e6e0'; g.font = 'bold 11.5px sans-serif'; g.fillText(lbl, cx + 32, cy - 4);
      g.fillStyle = ok ? '#68ffa8' : '#9ab0a8'; g.font = '11px monospace'; g.fillText(sub, cx + 32, cy + 14);
    };
    drawKnob(48, 204, f, fLock > .82, '1. 주 동조 [A/D]', `${(88 + f * 20).toFixed(1)} MHz`);
    drawKnob(198, 204, gain, gLock > .82, '2. 안테나 게인 [W/S]', `동조 ${Math.round(gLock * 100)}%`);

    const canLock = clear >= .85;
    g.fillStyle = canLock ? '#227848' : '#243034'; g.fillRect(340, 176, 122, 54);
    g.strokeStyle = canLock ? '#70ffb0' : '#4a5c64'; g.lineWidth = 2; g.strokeRect(340, 176, 122, 54);
    g.fillStyle = '#ffffff'; g.font = 'bold 12.5px sans-serif';
    g.fillText(canLock ? '✦ [Space / 클릭]' : '감도 85% 이상 시', 352, 199);
    g.fillText(canLock ? '주파수 고정 완료!' : '주파수 잠금 가능', 352, 218);

    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return p;
}

/* ---------- 10. 순서 따라 하기 (사이먼) ---------- */
// 불이 켜지는 순서를 기억했다가 그대로 누른다 (1 · 2 · 3 · 4 키 또는 클릭). 라운드마다 하나씩 길어진다
function simon({ title = '순서 따라 하기', pads = ['도', '레', '미', '솔'], rounds = [3 + ((Math.random() * 2) | 0), 4 + ((Math.random() * 2) | 0), 5 + ((Math.random() * 2) | 0)], notes = [262, 294, 330, 392] }) {
  const p = open(title, '불이 켜지는 <b>순서</b>를 기억했다가 그대로 눌러라 — <b>1 · 2 · 3 · 4</b> 키 또는 클릭 · 3번 틀리면 실패');
  const box = document.createElement('div'); box.className = 'simGrid'; $('mgBody').appendChild(box);
  const info = document.createElement('div'); info.className = 'mgInfo'; $('mgBody').appendChild(info);
  const cols = ['#c84a3a', '#d8b040', '#4aa86a', '#4a7ad0'];
  box.innerHTML = pads.map((n, i) => `<button class="simPad" data-i="${i}" style="--c:${cols[i]}">${i + 1}<small>${n}</small></button>`).join('');
  const el = [...box.querySelectorAll('.simPad')];
  let r = 0, seq = [], input = 0, busy = true, miss = 0;
  const light = (i, ms = 380) => { el[i].classList.add('on'); sfx.note(notes[i]); setTimeout(() => el[i].classList.remove('on'), ms); };
  const play = () => {
    busy = true; input = 0; while (seq.length < rounds[r]) seq.push((Math.random() * 4) | 0);
    info.innerHTML = `라운드 <b>${r + 1}</b> / ${rounds.length} · 실수 ${miss}/3 — 잘 봐라`;
    seq.forEach((v, k) => setTimeout(() => light(v), 600 + k * 560));
    setTimeout(() => { busy = false; info.innerHTML = `라운드 <b>${r + 1}</b> / ${rounds.length} · 실수 ${miss}/3 — 이제 따라 눌러라`; }, 600 + seq.length * 560);
  };
  const press = i => {
    if (busy || !finish) return; light(i, 200);
    if (seq[input] !== i) { miss++; sfx.buzz(); status('틀렸다…', 'err'); if (miss >= 3) { busy = true; setTimeout(() => close(false), 500); return; } seq = seq.slice(0, rounds[r]); setTimeout(play, 700); return; }
    input++;
    if (input >= seq.length) { r++; status(r >= rounds.length ? '' : '좋아!', 'ok'); if (r >= rounds.length) { busy = true; setTimeout(() => close(true), 400); return; } busy = true; setTimeout(play, 800); }
  };
  el.forEach((b, i) => { b.onclick = () => press(i); });
  keys(e => { if (e.type === 'keydown' && /^(Digit|Numpad)[1-4]$/.test(e.code)) press(+e.code.slice(-1) - 1); });
  play();
  // 3D 실로폰: 나무 틀 위 색깔 음판 4개 (길이가 음높이대로 짧아진다) — 소리가 나면 음판이 빛나며 떨리고, 클릭한 음판을 채가 친다
  (() => { let rr; try { rr = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { return; }
    rr.setPixelRatio(Math.min(2, devicePixelRatio || 1)); rr.setSize(440, 280); rr.outputColorSpace = THREE.SRGBColorSpace; rr.toneMapping = THREE.ACESFilmicToneMapping; rr.domElement.className = 'mgCanvas'; rr.domElement.dataset.own3d = '1'; $('mgBody').insertBefore(rr.domElement, box); box.style.display = 'none';
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0c0a08); const cam = new THREE.PerspectiveCamera(34, 440 / 280, .05, 20); cam.position.set(0, 1.5, 1.4); cam.lookAt(0, 0, 0);
    sc.add(new THREE.HemisphereLight(0xfff0dc, 0x140c06, .5)); const L = new THREE.SpotLight(0xfff0dc, 14, 6, .7, .5, 1.4); L.position.set(.4, 2, 1); sc.add(L, L.target);
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4424, roughness: .6 }); [-1, 1].forEach(sd => { const rail = new THREE.Mesh(new THREE.BoxGeometry(.05, .06, 1.1), wood); rail.position.set(sd * .2 * 0 + 0, -.03, 0); rail.position.z = 0; rail.rotation.y = 0; rail.position.x = sd * .55; sc.add(rail); });
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, .05, .05), wood); rail2.position.set(0, -.03, -.25); sc.add(rail2); const rail3 = rail2.clone(); rail3.position.z = .25; sc.add(rail3);
    const bars = cols.map((c3, i) => { const len = .8 - i * .1, m = new THREE.MeshStandardMaterial({ color: c3, roughness: .35, emissive: c3, emissiveIntensity: 0 }); const b = new THREE.Mesh(new THREE.BoxGeometry(.2, .04, len), m); b.position.set(-.39 + i * .26, .02, 0); b.userData.i = i; sc.add(b);
      const lab = document.createElement('canvas'); lab.width = 64; lab.height = 64; const g2 = lab.getContext('2d'); g2.fillStyle = '#fff'; g2.font = 'bold 34px sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(String(i + 1), 32, 34); const t = new THREE.CanvasTexture(lab);
      const lp = new THREE.Mesh(new THREE.PlaneGeometry(.1, .1), new THREE.MeshBasicMaterial({ map: t, transparent: true })); lp.rotation.x = -Math.PI / 2; lp.position.set(b.position.x, .042, len / 2 - .08); sc.add(lp); return { b, m, sh: 0 }; });
    const mallet = new THREE.Group(); const stick = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .5, 8), wood); stick.rotation.z = Math.PI / 2.4; mallet.add(stick); const head = new THREE.Mesh(new THREE.SphereGeometry(.035, 14, 10), new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: .8 })); head.position.set(-.2, -.1, 0); mallet.add(head); sc.add(mallet);
    let hitT = 0, hitI = 0; const rc = new THREE.Raycaster(), mv = new THREE.Vector2();
    rr.domElement.addEventListener('mousedown', e => { const bb = rr.domElement.getBoundingClientRect(); mv.set((e.clientX - bb.left) / bb.width * 2 - 1, -((e.clientY - bb.top) / bb.height) * 2 + 1); rc.setFromCamera(mv, cam); const h = rc.intersectObjects(bars.map(o => o.b))[0]; if (h) { hitI = h.object.userData.i; hitT = 1; press(hitI); } });
    const loop = () => { if (!MG.active) { rr.dispose(); rr.forceContextLoss && rr.forceContextLoss(); return; } bars.forEach((o, i) => { const on = el[i].classList.contains('on'); if (on) o.sh = 1; o.m.emissiveIntensity = on ? .9 : 0; o.sh *= .88; o.b.position.y = .02 + Math.sin(performance.now() / 18 + i) * .004 * o.sh; });
      hitT = Math.max(0, hitT - .08); const bx = bars[hitI].b.position.x; mallet.position.set(bx + .22, .12 + (1 - Math.sin(hitT * Math.PI)) * .08, .1); rr.render(sc, cam); requestAnimationFrame(loop); }; requestAnimationFrame(loop); })();
  return p;
}

/* ---------- 11. 타이밍 (게이지) ---------- */
// 왕복하는 바늘이 초록 구간에 들어왔을 때 Space / 클릭. need 번 성공하면 끝 (농구 슛 · 비커 눈금 · 증거 스티커 붙이기 등)
function timing({ title = '타이밍', hint = '바늘이 <b style="color:#60e0a0">초록 구간</b>에 들어왔을 때 <b>Space / 클릭</b>', need = 3, tries = 5, icon = '', okText = '성공!', missText = '빗나갔다…' }) {
  const p = open(title, hint + ` — <b>${tries}</b>번 중 <b>${need}</b>번`);
  const c = canvas(440, 140), g = c.getContext('2d');
  let t = 0, sp = 1.1, hits = 0, used = 0, zone = .3 + Math.random() * .4, w = .18, lastT = performance.now(), flash = 0, fc = '#60e0a0';
  const act = () => {
    if (!finish) return; const pos = (Math.sin(t * sp * 2.4) + 1) / 2; used++;
    if (Math.abs(pos - zone) < w / 2) { hits++; flash = 1; fc = '#60e0a0'; sfx.ball ? sfx.ball() : sfx.click(); status(`${okText} (${hits}/${need})`, 'ok'); zone = .15 + Math.random() * .7; w *= .88; sp *= 1.12; }
    else { flash = 1; fc = '#e06a5a'; sfx.buzz(); status(`${missText} (남은 기회 ${tries - used})`, 'err'); }
    if (hits >= need) setTimeout(() => close(true), 350);
    else if (tries - used < need - hits) setTimeout(() => close(false), 600);
  };
  c.addEventListener('click', act);
  keys(e => { if (e.type === 'keydown' && (e.code === 'Space' || e.code === 'Enter')) act(); });
  // 3D 아날로그 계기: 황동 테 반원 눈금판 위로 실제 바늘이 흔들리고, 초록 구간은 눈금판에 색칠된 호. 빨간 버튼(클릭/Space)을 누르면 눌림.
  //   기회는 위쪽 램프(회색→꺼짐), 성공은 초록 램프로 켜진다. WebGL 이 안 되면 원래 2D 막대 그대로.
  (() => { let r; try { r = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { return; }
    r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(460, 300); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.domElement.className = 'mgCanvas'; r.domElement.dataset.own3d = '1'; c.dataset.st = '1'; c.parentNode.insertBefore(r.domElement, c); c.style.display = 'none';
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0b0a09); const cam = new THREE.PerspectiveCamera(32, 460 / 300, .05, 20); cam.position.set(0, .25, 3); cam.lookAt(0, .05, 0);
    sc.add(new THREE.HemisphereLight(0xfff0dc, 0x140c06, .5)); const L = new THREE.SpotLight(0xfff0dc, 20, 8, .6, .5, 1.3); L.position.set(.8, 2, 2.5); sc.add(L, L.target);
    const M = (c3, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c3, roughness: .5 }, o));
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, .12), M(0x3a4048, { metalness: .6, roughness: .4 })); panel.position.set(0, 0, -.08); sc.add(panel);
    const R0 = .62, A0 = Math.PI * .85, A1 = Math.PI * .15, ang = v => A0 + (A1 - A0) * v, CY = -.2;
    const face = new THREE.Mesh(new THREE.CircleGeometry(R0 + .06, 48, 0, Math.PI), M(0xeee6d0, { roughness: .8 })); face.position.set(0, CY, .0); sc.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R0 + .07, .025, 10, 48, Math.PI), M(0xb08a40, { metalness: .9, roughness: .25 })); rim.position.set(0, CY, .01); sc.add(rim);
    for (let k = 0; k <= 20; k++) { const a = ang(k / 20), len = k % 5 ? .05 : .1; const tk = new THREE.Mesh(new THREE.BoxGeometry(.008, len, .004), new THREE.MeshBasicMaterial({ color: 0x222222 })); tk.position.set(Math.cos(a) * (R0 - len / 2), CY + Math.sin(a) * (R0 - len / 2), .006); tk.rotation.z = a - Math.PI / 2; sc.add(tk); }
    const zm = new THREE.MeshBasicMaterial({ color: 0x40c070, side: THREE.DoubleSide }); let zMesh = null;
    const buildZone = () => { if (zMesh) { sc.remove(zMesh); zMesh.geometry.dispose(); } const a1 = ang(Math.min(1, zone + w / 2)), a0 = ang(Math.max(0, zone - w / 2)); zMesh = new THREE.Mesh(new THREE.RingGeometry(R0 - .16, R0 - .02, 32, 1, a1, a0 - a1), zm); zMesh.position.set(0, CY, .004); sc.add(zMesh); };
    buildZone(); let lastZone = zone;
    const needle = new THREE.Group(); const nd = new THREE.Mesh(new THREE.BoxGeometry(.014, R0 - .04, .006), M(0xc02020)); nd.position.y = (R0 - .04) / 2; needle.add(nd); needle.position.set(0, CY, .02); sc.add(needle);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .03, 20), M(0x202020, { metalness: .6 })); hub.rotation.x = Math.PI / 2; hub.position.set(0, CY, .03); sc.add(hub);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(R0 + .06, 48, 0, Math.PI), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .07, roughness: .05, clearcoat: 1 })); glass.position.set(0, CY, .045); sc.add(glass);
    const btnBase = new THREE.Mesh(new THREE.CylinderGeometry(.13, .14, .05, 28), M(0x202020, { metalness: .5 })); btnBase.rotation.x = Math.PI / 2; btnBase.position.set(0, -.55, .0); sc.add(btnBase);
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .08, 28), M(0xc81e1e, { roughness: .35, emissive: 0x400000 })); btn.rotation.x = Math.PI / 2; btn.position.set(0, -.55, .05); sc.add(btn);
    const lamp = (x, y) => { const m = M(0x303030, { emissive: 0x000000 }); const o = new THREE.Mesh(new THREE.SphereGeometry(.04, 14, 10), m); o.position.set(x, y, .02); sc.add(o); return m; };
    const tryL = [...Array(tries)].map((_, k) => lamp(-.95 + k * .12, .62)), hitL = [...Array(need)].map((_, k) => lamp(.95 - k * .12, .62));
    let press = 0; const act0 = act;
    const rc = new THREE.Raycaster(), mv = new THREE.Vector2();
    let lastUsed = 0; r.domElement.addEventListener('mousedown', () => act0());
    const lp = () => { if (!MG.active) { r.dispose(); r.forceContextLoss && r.forceContextLoss(); return; } const x = (Math.sin(t * sp * 2.4) + 1) / 2; needle.rotation.z = ang(x) - Math.PI / 2;
      if (zone !== lastZone) { lastZone = zone; buildZone(); }
      tryL.forEach((m, k) => { m.emissive.setHex(k < used ? 0x000000 : 0xb08020); m.emissiveIntensity = 1; }); hitL.forEach((m, k) => { m.emissive.setHex(k < hits ? 0x30ff70 : 0x000000); });
      zm.color.setHex(flash > 0 && fc === '#e06a5a' ? 0xd04030 : flash > 0 ? 0x80ffb0 : 0x40c070);
      if (used !== lastUsed) { lastUsed = used; press = 1; } press = Math.max(0, press - .1); btn.position.z = .05 - press * .035; r.render(sc, cam); requestAnimationFrame(lp); };
    requestAnimationFrame(lp); })();
  const loop = now => {
    const dt = Math.min(.12, (now - lastT) / 1000); lastT = now; t += dt; flash = Math.max(0, flash - dt * 3);
    const x = (Math.sin(t * sp * 2.4) + 1) / 2;
    g.fillStyle = '#0a0d10'; g.fillRect(0, 0, 440, 140);
    g.fillStyle = '#1e2a30'; g.fillRect(20, 54, 400, 28);
    g.fillStyle = 'rgba(80,230,150,.6)'; g.fillRect(20 + (zone - w / 2) * 400, 54, w * 400, 28);
    if (flash > 0) { g.fillStyle = fc; g.globalAlpha = flash * .35; g.fillRect(0, 0, 440, 140); g.globalAlpha = 1; }
    g.fillStyle = '#f0e8d0'; g.fillRect(20 + x * 400 - 2, 44, 4, 48);
    if (icon) { g.font = '26px sans-serif'; g.textAlign = 'center'; g.fillText(icon, 20 + x * 400, 36); g.textAlign = 'left'; }
    for (let k = 0; k < tries; k++) { g.fillStyle = k < used ? '#3a4650' : '#8a96a0'; g.beginPath(); g.arc(160 + k * 22, 116, 6, 0, 7); g.fill(); }
    for (let k = 0; k < need; k++) { g.fillStyle = k < hits ? '#60e0a0' : '#2c3640'; g.fillRect(150 + k * 26 + 160, 110, 18, 12); }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return p;
}

/* ---------- 12. 테이프 판독 (자모 판독기) ---------- */
// 질문을 고르면 판독 커서가 손상된 녹음에서 자모를 하나씩 짚는다. 플레이어는 손을 떼지 않게 Space 를 계속 누르고 있어야 한다 (떼면 실패)
function ouija({ title = '테이프 판독', qs = [] }) {
  const p = open(title, '질문을 고른 뒤, 판독이 끝날 때까지 <b>Space / 마우스 버튼</b>으로 재생 버튼을 계속 누르고 있어라 — 떼면 테이프가 씹힌다');
  const c = canvas(440, 220), g = c.getContext('2d');
  screen3D(c, { kind: 'wood', prop: 'tape' });
  const L = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'.split('').concat(['예', '아니오']);
  const pos = L.map((ch, i) => i < 14 ? { ch, x: 40 + (i % 7) * 60, y: 70 + ((i / 7) | 0) * 56 } : { ch, x: i === 14 ? 70 : 370, y: 26 });
  const qbox = document.createElement('div'); qbox.className = 'ouQ'; $('mgBody').appendChild(qbox);
  qbox.innerHTML = qs.map((q, i) => `<button class="btn" data-i="${i}">${q.q}</button>`).join('');
  let hold = false, ans = null, k = 0, px = 220, py = 120, t = 0, lastT = performance.now(), shown = '', started = false, lost = 0;
  const down = () => { hold = true; }, up = () => { hold = false; };
  c.addEventListener('mousedown', down); addEventListener('mouseup', up); cleanups.push(() => removeEventListener('mouseup', up));
  keys(e => { if (e.code === 'Space') hold = e.type === 'keydown'; });
  qbox.querySelectorAll('button').forEach(b => { b.onclick = () => { if (ans) return; ans = qs[+b.dataset.i]; qbox.innerHTML = `<div class="mgInfo">“${ans.q}”</div>`; sfx.click && sfx.click(); started = true; }; });
  const loop = now => {
    const dt = Math.min(.12, (now - lastT) / 1000); lastT = now; t += dt;
    g.fillStyle = '#10161a'; g.fillRect(0, 0, 440, 220); g.strokeStyle = '#3a4c58'; g.strokeRect(6, 6, 428, 208);   // 판독기 LCD 패널
    g.fillStyle = 'rgba(120,220,150,.06)'; for (let yy = 10; yy < 214; yy += 4) g.fillRect(8, yy, 424, 1);
    g.font = '18px monospace'; g.textAlign = 'center'; g.fillStyle = '#8fe0a8'; pos.forEach(o => g.fillText(o.ch, o.x, o.y + 7));
    if (started && ans) {
      if (!hold) { lost += dt; if (lost > .6) { status('버튼을 뗐다 — 테이프가 늘어나 끊겼다', 'err'); sfx.buzz(); started = false; setTimeout(() => close(false), 700); } }
      else lost = 0;
      const seq = ans.a, tgt = pos.find(o => o.ch === seq[k]) || pos[0];
      px += (tgt.x - px) * Math.min(1, dt * 2.2) + Math.sin(t * 9) * .6; py += (tgt.y - py) * Math.min(1, dt * 2.2) + Math.cos(t * 7) * .6;
      if (Math.hypot(tgt.x - px, tgt.y - py) < 3) { shown += seq[k] === '예' || seq[k] === '아니오' ? `[${seq[k]}] ` : seq[k]; k++; sfx.knock ? sfx.knock() : sfx.click(); if (k >= seq.length) { started = false; status(`…${ans.r || shown}`, 'ok'); setTimeout(() => close(true), 1400); } }
    }
    g.strokeStyle = 'rgba(255,190,90,.95)'; g.lineWidth = 2; g.strokeRect(px - 16, py - 16, 32, 32); g.beginPath(); g.moveTo(px, 10); g.lineTo(px, 212); g.stroke(); g.lineWidth = 1;   // 판독 커서 (재생 헤드)
    g.fillStyle = '#e8c870'; g.font = '15px sans-serif'; g.fillText(shown, 220, 205); g.textAlign = 'left';
    if (started && !hold) { g.fillStyle = 'rgba(200,60,40,.35)'; g.fillRect(0, 0, 440, 220); }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return p;
}

/* ---------- 13. 증기 배관 (압력 제한) ---------- */
// 배관 타일을 돌려 밸브(왼쪽)에서 배출구(오른쪽 위 · 아래 두 곳)까지 증기를 보낸다. 압력계가 계속 오르고, 틀린 방향으로 새는 증기가 많을수록 더 빨리 오른다
function pipes({ title = '증기 배관 — 압력을 빼라', time = 70 } = {}) {
  const R = 5, C = 6, S = 62, ox = 46, oy = 34;
  const p = open(title, `타일을 클릭해 돌려 <b style="color:#ffb070">밸브</b>의 증기를 <b style="color:#70d8ff">배출구 두 곳</b>으로 모두 보내라 (우클릭: 반대로)<br>열린 관 끝으로 증기가 새면 <b>압력이 더 빨리</b> 오른다 — 계기판이 빨간 칸에 닿으면 터진다`);
  const c = canvas(C * S + ox * 2, R * S + oy + 30), g = c.getContext('2d');
  screen3D(c, { kind: 'metal', prop: 'pipe' });
  const rot = m => ((m << 1) | (m >> 3)) & 15, conn = (a, b) => (b[0] < a[0] ? 1 : b[1] > a[1] ? 2 : b[0] > a[0] ? 4 : 8);
  const grid = Array.from({ length: R }, () => Array(C).fill(0));
  const src = 1 + ((Math.random() * (R - 2)) | 0), outs = Math.random() < .5 ? [0, R - 1] : [[0, 2], [2, 4], [0, 3], [1, 4]][(Math.random() * 4) | 0];   // 판마다 다른 위치
  // 두 출구로 가는 경로를 무작위로 깔고 겹치는 칸은 합친다(T자 · 십자 관이 생긴다)
  outs.forEach(tr => { let r = src; const path = [];
    for (let col = 0; col < C; col++) { const tgt = col === C - 1 ? tr : col < 2 ? src : (Math.random() * R) | 0; path.push([r, col]); while (r !== tgt) { r += Math.sign(tgt - r); path.push([r, col]); } }
    path.forEach((cell, i) => { let m = grid[cell[0]][cell[1]]; m |= i === 0 ? 8 : conn(cell, path[i - 1]); m |= i === path.length - 1 ? 2 : conn(cell, path[i + 1]); grid[cell[0]][cell[1]] = m; }); });
  const filler = [5, 3, 6, 7, 11];
  for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) { if (!grid[y][x]) grid[y][x] = filler[(Math.random() * filler.length) | 0]; const k = 1 + ((Math.random() * 3) | 0); for (let i = 0; i < k; i++) grid[y][x] = rot(grid[y][x]); }
  let press = 0, leak = 0, won = false, lastT = performance.now(), puffs = [];
  const flow = () => {
    const on = Array.from({ length: R }, () => Array(C).fill(false)), q = []; let lk = 0;
    if (grid[src][0] & 8) { on[src][0] = true; q.push([src, 0]); }
    while (q.length) { const [y, x] = q.shift(), m = grid[y][x];
      [[1, -1, 0, 4], [2, 0, 1, 8], [4, 1, 0, 1], [8, 0, -1, 2]].forEach(([b, dy, dx, opp]) => { if (!(m & b)) return; const ny = y + dy, nx = x + dx;
        if (nx === C && outs.includes(y) && b === 2) return;                                   // 배출구
        if (nx < 0 && y === src && b === 8) return;                                             // 밸브
        if (ny < 0 || ny >= R || nx < 0 || nx >= C || !(grid[ny][nx] & opp)) { lk++; return; }  // 새는 관 끝
        if (!on[ny][nx]) { on[ny][nx] = true; q.push([ny, nx]); } }); }
    return { on, lk, ok: outs.every(y => on[y][C - 1] && (grid[y][C - 1] & 2)) };
  };
  const click = (e, dir) => { if (won || !finish) return; const rc = c.getBoundingClientRect(), x = ((e.clientX - rc.left) * c.width / rc.width - ox) / S | 0, y = ((e.clientY - rc.top) * c.height / rc.height - oy) / S | 0;
    if (x < 0 || x >= C || y < 0 || y >= R) return; grid[y][x] = dir > 0 ? rot(grid[y][x]) : rot(rot(rot(grid[y][x]))); sfx.dial(); };
  c.addEventListener('click', e => click(e, 1)); c.addEventListener('contextmenu', e => { e.preventDefault(); click(e, -1); });
  keys(() => {});
  const loop = now => {
    const dt = Math.min(.1, (now - lastT) / 1000); lastT = now; const F = flow(); leak = F.lk;
    if (!won) press += dt * (1 / time) * (1 + leak * .22);
    if (F.ok && !won) { won = true; sfx.fuse ? sfx.fuse() : sfx.click(); status('쉬이이— 증기가 빠져나간다', 'ok'); setTimeout(() => close(true), 700); }
    if (press >= 1 && !won && finish) { sfx.buzz(); status('펑— 배관이 터졌다!', 'err'); setTimeout(() => finish && close(false), 700); press = 1; }
    g.fillStyle = '#0b0e10'; g.fillRect(0, 0, c.width, c.height);
    // 압력계
    g.fillStyle = '#1b2228'; g.fillRect(ox, 8, C * S, 14); g.fillStyle = '#5a2020'; g.fillRect(ox + C * S * .85, 8, C * S * .15, 14);
    g.fillStyle = press > .7 ? '#ff6a4a' : '#e8c070'; g.fillRect(ox, 8, C * S * Math.min(1, press), 14);
    g.fillStyle = '#c8c0a8'; g.font = '11px sans-serif'; g.fillText(`압력 ${Math.round(press * 100)}%  · 새는 곳 ${leak}`, ox, 32 - 2);
    g.fillStyle = '#ffb070'; g.fillRect(6, oy + src * S + S / 2 - 14, 34, 28); g.fillStyle = '#000'; g.font = 'bold 11px sans-serif'; g.fillText('밸브', 10, oy + src * S + S / 2 + 4);
    outs.forEach(y => { g.fillStyle = F.on[y][C - 1] && (grid[y][C - 1] & 2) ? '#80ffb0' : '#70d8ff'; g.fillRect(ox + C * S + 6, oy + y * S + S / 2 - 14, 34, 28); });
    for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) {
      const px = ox + x * S, py = oy + y * S, m = grid[y][x], cx = px + S / 2, cy = py + S / 2;
      g.fillStyle = '#161c20'; g.fillRect(px + 2, py + 2, S - 4, S - 4);
      g.lineCap = 'butt'; g.lineWidth = 14; g.strokeStyle = '#3a3026';
      [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0]].forEach(([b, dx, dy]) => { if (m & b) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + dx * S / 2, cy + dy * S / 2); g.stroke(); } });
      g.lineWidth = 6; g.strokeStyle = F.on[y][x] ? (won ? '#9affc8' : '#f0d8b0') : '#6a5a48';
      [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0]].forEach(([b, dx, dy]) => { if (m & b) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + dx * S / 2, cy + dy * S / 2); g.stroke(); } });
      g.fillStyle = '#7a6a58'; g.beginPath(); g.arc(cx, cy, 8, 0, 7); g.fill();
      if (F.on[y][x] && Math.random() < .04) puffs.push({ x: cx + (Math.random() - .5) * 20, y: cy, a: 1 });
    }
    puffs = puffs.filter(q => (q.a -= dt * 1.2) > 0); puffs.forEach(q => { q.y -= dt * 30; g.fillStyle = `rgba(230,230,230,${q.a * .25})`; g.beginPath(); g.arc(q.x, q.y, 10 * (2 - q.a), 0, 7); g.fill(); });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return p;
}

/* ---------- 14. 어둠 속 더듬기 (손전등 미로) ---------- */
// 위에서 본 어두운 미로: 손전등 반경만 보인다. 물건을 주워 출구로. 야간 경비원이 순찰하다가 빛 안에 들어온 플레이어를 쫓는다
function maze({ title = '어둠 속 — 선반 사이를 더듬어라', item = '물건', W = [11, 13, 15][(Math.random() * 3) | 0], H = [9, 11][(Math.random() * 2) | 0] } = {}) {
  const S = 34;
  const p = open(title, `<b>WASD / 방향키</b>로 이동 · <b>Shift</b> 손전등 끄기(숨기) — 불을 끄면 야간 경비원이 놓친다<br><b style="color:#ffd070">${item}</b>을 주워 <b style="color:#80ffb0">출구</b>로. 경비원에게 들키면 실패`);
  const c = canvas(W * S, H * S), g = c.getContext('2d');
  screen3D(c, { kind: 'wood' });
  // 미로 생성 (DFS) + 고리 몇 개
  const wall = Array.from({ length: H }, () => Array(W).fill(1)), carve = (x, y) => { wall[y][x] = 0; [[2, 0], [-2, 0], [0, 2], [0, -2]].sort(() => Math.random() - .5).forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy; if (nx > 0 && ny > 0 && nx < W - 1 && ny < H - 1 && wall[ny][nx]) { wall[y + dy / 2][x + dx / 2] = 0; carve(nx, ny); } }); };
  carve(1, 1); for (let k = 0; k < 7; k++) { const x = 1 + ((Math.random() * (W - 2)) | 0), y = 1 + ((Math.random() * (H - 2)) | 0); if ((x + y) % 2) wall[y][x] = 0; }
  const free = []; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (!wall[y][x]) free.push([x, y]);
  const far = (a) => free.slice().sort((p, q) => Math.hypot(q[0] - a[0], q[1] - a[1]) - Math.hypot(p[0] - a[0], p[1] - a[1]))[0];
  const pl = { x: 1.5, y: 1.5 }, key = far([1, 1]), exit = [1, H - 2];
  const gs0 = free.filter(q => Math.hypot(q[0] - 1, q[1] - 1) > 6 && Math.hypot(q[0] - exit[0], q[1] - exit[1]) > 4); const g0 = gs0[(Math.random() * gs0.length) | 0] || far([1, 1]);
  const gh = { x: g0[0] + .5, y: g0[1] + .5, tx: 0, ty: 0, chase: 0, wake: 3 };   // 그것은 플레이어에게서 멀리 · 3초 뒤부터 움직인다
  let has = false, dark = false, lastT = performance.now(), held = {}, dead = false;
  keys(e => { held[e.code] = e.type === 'keydown'; });
  const solid = (x, y) => { const cx = x | 0, cy = y | 0; return cy < 0 || cy >= H || cx < 0 || cx >= W || wall[cy][cx]; };
  const move = (o, dx, dy, r = .28) => { if (!solid(o.x + dx + Math.sign(dx) * r, o.y) && !solid(o.x + dx + Math.sign(dx) * r, o.y + r * .9) && !solid(o.x + dx + Math.sign(dx) * r, o.y - r * .9)) o.x += dx; if (!solid(o.x, o.y + dy + Math.sign(dy) * r) && !solid(o.x + r * .9, o.y + dy + Math.sign(dy) * r) && !solid(o.x - r * .9, o.y + dy + Math.sign(dy) * r)) o.y += dy; };
  const los = (a, b) => { const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d * 4); for (let i = 1; i < n; i++) if (solid(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false; return true; };
  const loop = now => {
    const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
    if (!dead && finish) {
      dark = !!(held.ShiftLeft || held.ShiftRight);
      const sp = (dark ? 1.6 : 2.6) * dt, ix = (held.KeyD || held.ArrowRight ? 1 : 0) - (held.KeyA || held.ArrowLeft ? 1 : 0), iy = (held.KeyS || held.ArrowDown ? 1 : 0) - (held.KeyW || held.ArrowUp ? 1 : 0);
      move(pl, ix * sp, iy * sp);
      if (!has && Math.hypot(pl.x - key[0] - .5, pl.y - key[1] - .5) < .5) { has = true; sfx.pickup ? sfx.pickup() : sfx.click(); status(`${item} 확보 — 출구로!`, 'ok'); }
      if (has && Math.hypot(pl.x - exit[0] - .5, pl.y - exit[1] - .5) < .5) { dead = true; close(true); }
      // 그것: 빛이 켜져 있고 보이면 쫓고, 아니면 아무 데나 배회
      gh.wake -= dt;
      const sees = gh.wake <= 0 && !dark && Math.hypot(pl.x - gh.x, pl.y - gh.y) < 5.5 && los(pl, gh);
      if (sees) { gh.chase = 2.5; gh.tx = pl.x; gh.ty = pl.y; } else gh.chase -= dt;
      if (gh.chase <= 0 && (Math.hypot(gh.tx - gh.x, gh.ty - gh.y) < .3 || !gh.tx)) { const f2 = free[(Math.random() * free.length) | 0]; gh.tx = f2[0] + .5; gh.ty = f2[1] + .5; }
      const d = Math.hypot(gh.tx - gh.x, gh.ty - gh.y) || 1, gs = gh.wake > 0 ? 0 : (gh.chase > 0 ? 2.15 : 1.2) * dt; move(gh, (gh.tx - gh.x) / d * gs, (gh.ty - gh.y) / d * gs, .25);
      if (Math.hypot(pl.x - gh.x, pl.y - gh.y) < .55) { dead = true; sfx.stinger ? sfx.stinger(.6) : sfx.buzz(); status('야간 경비원에게 들켰다…', 'err'); setTimeout(() => finish && close(false), 800); }
      if (Math.random() < dt * .6) sfx.step ? sfx.step() : 0;
    }
    g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { g.fillStyle = wall[y][x] ? '#2a2620' : '#11100e'; g.fillRect(x * S, y * S, S, S); if (wall[y][x]) { g.fillStyle = '#3a342a'; g.fillRect(x * S + 3, y * S + 3, S - 6, 4); } }
    if (!has) { g.font = '20px sans-serif'; g.textAlign = 'center'; g.fillText('🗝', key[0] * S + S / 2, key[1] * S + S / 2 + 7); }
    g.fillStyle = has ? '#60ffa0' : '#2a5a3a'; g.fillRect(exit[0] * S + 6, exit[1] * S + 6, S - 12, S - 12);
    { const ga = Math.atan2(gh.ty - gh.y, gh.tx - gh.x) || 0; g.fillStyle = 'rgba(255,240,180,.16)'; g.beginPath(); g.moveTo(gh.x * S, gh.y * S); g.arc(gh.x * S, gh.y * S, S * 2.2, ga - .45, ga + .45); g.closePath(); g.fill(); g.fillStyle = '#2c3e66'; g.beginPath(); g.arc(gh.x * S, gh.y * S, 9, 0, 7); g.fill(); g.fillStyle = '#d8c070'; g.fillRect(gh.x * S - 3, gh.y * S - 9, 6, 3); }
    g.fillStyle = '#ffd070'; g.beginPath(); g.arc(pl.x * S, pl.y * S, 8, 0, 7); g.fill();
    // 어둠: 손전등 반경 밖은 가린다
    const r = dark ? S * .9 : S * 2.6, gr = g.createRadialGradient(pl.x * S, pl.y * S, r * .35, pl.x * S, pl.y * S, r);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.985)'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    const near = Math.hypot(pl.x - gh.x, pl.y - gh.y); if (near < 3.5) { g.fillStyle = `rgba(150,110,0,${(3.5 - near) / 3.5 * .25})`; g.fillRect(0, 0, c.width, c.height); }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return p;
}

/* ---------- 15. 맞물린 고리 암호 ---------- */
// 고리 3개에 기호가 8개씩. 오른쪽 위 '읽는 선'에 세 기호가 단서와 같게 오도록 돌린다. 바깥 고리를 돌리면 가운데 고리도 함께 돈다(맞물림)
function rings({ title = '단말기 잠금 — 고리 암호', clue = null, maxMoves = 24 } = {}) {
  const SYM = ['☾', '✦', '◆', '☂', '♪', '✚', '⌂', '☀', '✿', '☠', '⚲', '♜'].sort(() => Math.random() - .5).slice(0, 8), N = 8;
  const target = clue || [0, 1, 2].map(() => (Math.random() * N) | 0);
  const off = [0, 0, 0];
  // 정답 상태에서 무작위로 섞어 풀 수 있게 만든다 (돌리기는 맞물림 규칙 그대로)
  const turn = (i, d) => { off[i] = (off[i] + d + N) % N; if (i === 2) off[1] = (off[1] + d + N) % N; if (i === 0) off[2] = (off[2] - d + N) % N; };
  target.forEach((t, i) => { off[i] = t; }); for (let k = 0; k < 14; k++) turn((Math.random() * 3) | 0, Math.random() < .5 ? 1 : -1);
  if ([0, 1, 2].every(i => off[i] === target[i])) turn(1, 1);
  const p = open(title, `고리를 <b>클릭</b>(왼쪽 / 오른쪽 클릭 = 반대 방향)해서 <b style="color:#ffd070">읽는 선</b>에 단서의 기호 세 개를 맞춰라<br>안쪽 고리 → 바깥 고리가 반대로 · 바깥 고리 → 가운데 고리가 같은 방향으로 함께 돈다 — 남은 회전 <b id="rgLeft">${maxMoves}</b>`);
  const c = canvas(420, 340), g = c.getContext('2d'); let moves = 0, won = false;
  const draw = () => {
    g.fillStyle = '#0b0d10'; g.fillRect(0, 0, 420, 340);
    const cx = 170, cy = 170, R = [62, 104, 146];
    g.fillStyle = '#c8c0a8'; g.font = '12px sans-serif'; g.fillText('단서', 330, 40); target.forEach((t, i) => { g.font = '26px serif'; g.fillStyle = ['#e8c070', '#a8d8ff', '#e8a0c8'][i]; g.fillText(SYM[t], 330, 78 + i * 38); });
    for (let i = 2; i >= 0; i--) { g.strokeStyle = ['#e8c070', '#a8d8ff', '#e8a0c8'][i]; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R[i], 0, 7); g.stroke();
      for (let k = 0; k < N; k++) { const a = (k - off[i]) / N * Math.PI * 2 - Math.PI / 2, r2 = R[i] - 20; g.font = '22px serif'; g.textAlign = 'center'; g.fillStyle = k === off[i] ? '#fff' : '#9a9488'; g.fillText(SYM[k], cx + Math.cos(a) * r2, cy + Math.sin(a) * r2 + 8); } }
    g.textAlign = 'left'; g.strokeStyle = 'rgba(255,208,112,.7)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy - 20); g.lineTo(cx, cy - R[2] - 8); g.stroke();
    g.fillStyle = '#ffd070'; g.beginPath(); g.moveTo(cx - 7, cy - R[2] - 14); g.lineTo(cx + 7, cy - R[2] - 14); g.lineTo(cx, cy - R[2] - 4); g.fill();
  };
  const click = (e, d) => { if (won || !finish) return; const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width - 170, y = (e.clientY - rc.top) * c.height / rc.height - 170, r = Math.hypot(x, y);
    const i = r < 84 ? 0 : r < 126 ? 1 : r < 168 ? 2 : -1; doTurn(i, d); };
  const doTurn = (i, d) => { if (won || !finish || i < 0) return; turn(i, d); moves++; sfx.dial(); const L = document.getElementById('rgLeft'); if (L) L.textContent = maxMoves - moves; draw();
    if ([0, 1, 2].every(k => off[k] === target[k])) { won = true; sfx.fuse ? sfx.fuse() : sfx.click(); setTimeout(() => close(true), 400); }
    else if (moves >= maxMoves) { sfx.buzz(); status('잠금이 초기화된다…', 'err'); setTimeout(() => finish && close(false), 700); } };
  c.addEventListener('click', e => click(e, 1)); c.addEventListener('contextmenu', e => { e.preventDefault(); click(e, -1); });
  // 3D 금속 고리 자물쇠: 동심원 고리 3개(황동·강철·구리)에 기호가 새겨져 있고 클릭한 고리가 부드럽게 돈다. 위쪽 노란 화살표가 읽는 선, 오른쪽 황동 판이 단서.
  (() => { let r; try { r = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { return; }
    r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(460, 330); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.domElement.className = 'mgCanvas'; r.domElement.dataset.own3d = '1'; c.dataset.st = '1'; c.parentNode.insertBefore(r.domElement, c); c.style.display = 'none';
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0b0a09); const cam = new THREE.PerspectiveCamera(30, 460 / 330, .05, 20); cam.position.set(.3, -.3, 4.1); cam.lookAt(.3, .02, 0);
    sc.add(new THREE.HemisphereLight(0xfff0dc, 0x140c06, .55)); const Ls = new THREE.SpotLight(0xfff0dc, 24, 8, .6, .5, 1.3); Ls.position.set(1, 1.8, 2.6); sc.add(Ls, Ls.target);
    const M = (c3, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c3, roughness: .35, metalness: .85 }, o));
    const plate = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.9, .1), M(0x2a2e34, { metalness: .5, roughness: .55 })); plate.position.set(.3, 0, -.1); sc.add(plate);
    const RR = [[.12, .34], [.36, .58], [.6, .82]], cols3 = [0xc8a050, 0xa8b4c0, 0xb8704a], ringsG = [];
    const symTex = (ch, col) => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const q = cv.getContext('2d'); q.fillStyle = col; q.font = '44px serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText(ch, 32, 34); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
    RR.forEach(([a0, a1], i) => { const gr = new THREE.Group(); const shp = new THREE.Shape(); shp.absarc(0, 0, a1 - .005, 0, Math.PI * 2, false); const hh = new THREE.Path(); hh.absarc(0, 0, a0 + .005, 0, Math.PI * 2, true); shp.holes.push(hh); const ring = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: .05, bevelEnabled: true, bevelSize: .006, bevelThickness: .006, bevelSegments: 2, curveSegments: 64 }), M(cols3[i])); ring.position.z = -.02; gr.add(ring);
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(a0, a0, .2, 48), M(0x111111, { metalness: .2 })); hole.rotation.x = Math.PI / 2; if (i === 0) hole.visible = false;
      
      const rs = (a0 + a1) / 2; for (let k = 0; k < N; k++) { const ang = Math.PI / 2 - k / N * Math.PI * 2; const sp = new THREE.Mesh(new THREE.PlaneGeometry(.17, .17), new THREE.MeshBasicMaterial({ map: symTex(SYM[k], '#1a1208'), transparent: true })); sp.position.set(Math.cos(ang) * rs, Math.sin(ang) * rs, .04); sp.rotation.z = ang - Math.PI / 2; gr.add(sp); }
      gr.position.z = i * .001; sc.add(gr); ringsG.push({ gr, a: 0, z: .036 + i * .011 }); });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .12, 32), M(0x303030)); cap.rotation.x = Math.PI / 2; sc.add(cap);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(.05, .1, 3), new THREE.MeshStandardMaterial({ color: 0xffd070, emissive: 0x806020 })); arrow.rotation.z = Math.PI; arrow.position.set(0, .9, .06); sc.add(arrow);
    const clueP = new THREE.Mesh(new THREE.BoxGeometry(.42, 1.1, .03), M(0xb08a40, { roughness: .4 })); clueP.position.set(1.3, 0, -.03); sc.add(clueP);
    target.forEach((t, i) => { const sp = new THREE.Mesh(new THREE.PlaneGeometry(.26, .26), new THREE.MeshBasicMaterial({ map: symTex(SYM[t], '#201406'), transparent: true })); sp.position.set(1.3, .32 - i * .32, .0); sc.add(sp); });
    const rc = new THREE.Raycaster(), mv = new THREE.Vector2(), pl = new THREE.Plane(new THREE.Vector3(0, 0, 1), -.04), hp = new THREE.Vector3();
    const pick = (e, d) => { const b = r.domElement.getBoundingClientRect(); mv.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); rc.setFromCamera(mv, cam); if (!rc.ray.intersectPlane(pl, hp)) return; const rr = Math.hypot(hp.x, hp.y); const i = rr < .35 ? 0 : rr < .59 ? 1 : rr < .84 ? 2 : -1; doTurn(i, d); };
    r.domElement.addEventListener('click', e => pick(e, 1)); r.domElement.addEventListener('contextmenu', e => { e.preventDefault(); pick(e, -1); });
    const lp = () => { if (!MG.active) { r.dispose(); r.forceContextLoss && r.forceContextLoss(); return; } ringsG.forEach((o, i) => { const tgt = off[i] / N * Math.PI * 2; let d = tgt - o.a; d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; o.a += d * .18; o.gr.rotation.z = o.a; });
      arrow.material.emissiveIntensity = won ? 2 : 1; r.render(sc, cam); requestAnimationFrame(lp); }; requestAnimationFrame(lp); })();
  keys(() => {}); draw();
  return p;
}

/* =========================================================================
   16. 학교 테마 6대 다양성 미니게임 팩 (저퀄리티 도형 틀린그림찾기 완전 대체!)
   - 1) stampApprove: 학생회실·교장실·행정실 [1998 해교제 야간 잔류 결재서 위조 조항 정정 & 관인 날인]
   - 2) omrGrade: 교무실·교실·진로상담실 [1998학년도 기말고사 OMR 답안지 컴퓨터용 사인펜 마킹 복원]
   - 3) timetableRestore: 학년부·동아리실·특별실 [학급 주간 시간표 & 야간 당번 자석 보드 배정]
   - 4) libraryCatalog: 도서실·열람실·보관실 [도서 대출 기록 카드 & KDC 청구기호 서가 색인 배열]
   - 5) cassetteSplice: 방송실·어학실·음악실 [릴 카세트테이프 마그네틱 필름 접합 & 헤드 방위각 정렬]
   - 6) microscopeSlide: 과학실·준비실·보건실 [광학 현미경 프레파라트 배율 전환 & 표본 코드 판독]
   ========================================================================= */

function stampApprove({ title = '학생회실 — 1998 해교제 야간 잔류 승인원 검수 및 직인 날인' } = {}) {
  const p = open(title, '<b>1단계:</b> 기안문에서 <b style="color:#ff8a70">조작된 위조 조항 3줄(2·4·5번)</b>을 클릭해 적색 교정펜으로 정정하라<br><b>2단계:</b> 우측 <b>[관인 수직 각도(A·D)]</b>를 0°에 맞추고 <b>[인주 묻히기]</b> 후, <b>[결재란을 꾹 눌러(Hold)]</b> 압력 70~95%에서 떼어 날인하라!');
  const c = canvas(540, 350), g = c.getContext('2d');
  screen3D(c, { kind: 'paper', prop: 'lamp' });
  const items = [
    { txt: '문서번호: 서문학생 제1998-1012호 (기안일: 1998. 10. 12)', bad: false },
    { txt: '1. 행 사 명: 제30회 해교제 전야제 합동 리허설 및 방송 점검', bad: false },
    { txt: '2. 잔류시간: 22:00 이후 전교생 강제 심야 잔류 (귀가 금지)', bad: true, fix: '2. 잔류시간: 21:30 이전 전원 하교 완료 (심야 잔류 엄금)' },
    { txt: '3. 사용구역: 본관 3층 방송실 · 별관 음악실 · 대강당 무대', bad: false },
    { txt: '4. 안전수칙: 구름다리 방화문 및 서문 출입구를 쇠사슬로 영구 봉쇄함', bad: true, fix: '4. 안전수칙: 비상시 구름다리 방화문 및 전 출입구 상시 개방 유지' },
    { txt: '5. 담당명단: 3-2 윤하늘 (※ 명부에서 영구 말소 처리할 것)', bad: true, fix: '5. 담당명단: 3-2 윤하늘 · 강민아 · 이수아 (방송반 정원 3명)' },
  ];
  let fixed = [false, false, false, false, false, false], inked = false, stamped = false;
  let sealAng = -24, pressing = false, pressPwr = 0, lastT = performance.now();

  const releaseStamp = () => {
    if (!pressing || stamped || !finish) return;
    pressing = false;
    const fixedCount = fixed.filter(Boolean).length;
    if (fixedCount < 3) { pressPwr = 0; sfx.buzz(); status('먼저 문서 본문의 위조 조항 3곳(2·4·5번)을 모두 클릭해 정정하세요!', 'err'); return; }
    if (!inked) { pressPwr = 0; sfx.buzz(); status('관인에 붉은 인주가 묻어 있지 않습니다! [인주 패드]를 먼저 누르세요.', 'err'); return; }
    if (Math.abs(sealAng) > 8) { pressPwr = 0; sfx.buzz(); status(`관인이 기울어져 있습니다(현재 ${sealAng}°)! [A/D] 또는 각도 버튼으로 0° 수직으로 맞추세요.`, 'err'); return; }
    if (pressPwr >= .65 && pressPwr <= .96) {
      stamped = true; sfx.unlock();
      status('쾅! — 수직 정밀 날인 성공! 1998 해교제 승인원의 위조 조항이 바로잡혔다!', 'ok');
      setTimeout(() => close(true), 500);
    } else {
      sfx.buzz();
      status(pressPwr < .65 ? '누르는 힘이 부족해 인영이 흐릿합니다! 초록 구간(70~95%)까지 꾹 누르세요.' : '너무 세게 눌러 인주가 번졌습니다! 초록 구간에서 떼세요.', 'err');
      pressPwr = 0;
    }
  };

  c.addEventListener('mousedown', e => {
    if (!finish || stamped) return;
    const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width, y = (e.clientY - rc.top) * c.height / rc.height;
    if (x >= 30 && x <= 362 && y >= 76 && y <= 288) {
      const idx = Math.floor((y - 78) / 34);
      if (idx >= 0 && idx < items.length) {
        if (items[idx].bad) {
          fixed[idx] = !fixed[idx]; sfx.click();
          const cnt = fixed.filter(Boolean).length;
          status(cnt === 3 ? '위조 조항 3곳 정정 완료! 우측 관인 각도를 0°로 맞추고 인주를 찍어 날인하세요.' : `위조 조항 정정 (${cnt}/3)`);
        } else { sfx.buzz(); status('이 조항은 정상적인 공식 기록입니다. 조작된 조항(2·4·5번)을 찾으세요.', 'err'); }
      }
      return;
    }
    // 관인 각도 조절 버튼 (- / +)
    if (y >= 62 && y <= 98 && x >= 390 && x <= 455) { sealAng = clamp(sealAng - 6, -36, 36); sfx.dial(); return; }
    if (y >= 62 && y <= 98 && x >= 460 && x <= 525) { sealAng = clamp(sealAng + 6, -36, 36); sfx.dial(); return; }
    // 인주 패드 클릭
    if (Math.hypot(x - 456, y - 148) <= 34) {
      inked = true; sfx.click(); status('관인에 붉은 인주를 골고루 묻혔다! 이제 하단 [결재란 날인]을 꾹 누르세요.'); return;
    }
    // 결재란 또는 날인 버튼 홀드
    if ((x >= 300 && x <= 366 && y >= 24 && y <= 78) || (x >= 392 && x <= 522 && y >= 210 && y <= 325)) {
      pressing = true; pressPwr = .08;
    }
  });
  const mu = () => { if (pressing) releaseStamp(); };
  addEventListener('mouseup', mu); cleanups.push(() => removeEventListener('mouseup', mu));
  c.addEventListener('wheel', e => { e.preventDefault(); sealAng = clamp(sealAng + (e.deltaY < 0 ? 6 : -6), -36, 36); sfx.dial(); }, { passive: false });

  keys(e => {
    const dn = e.type === 'keydown';
    if (dn && (e.code === 'KeyA' || e.code === 'ArrowLeft')) { sealAng = clamp(sealAng - 6, -36, 36); sfx.dial(); }
    if (dn && (e.code === 'KeyD' || e.code === 'ArrowRight')) { sealAng = clamp(sealAng + 6, -36, 36); sfx.dial(); }
    if (dn && e.code === 'KeyE') { inked = true; sfx.click(); }
    if (e.code === 'Space' || e.code === 'Enter') {
      if (dn && !pressing) { pressing = true; pressPwr = .08; }
      else if (!dn && pressing) releaseStamp();
    }
  });

  const loop = now => {
    const dt = Math.min(.08, (now - lastT) / 1000); lastT = now;
    if (pressing && !stamped) {
      pressPwr += dt * .95;
      if (pressPwr > 1.05) releaseStamp();
    }
    g.fillStyle = '#111518'; g.fillRect(0, 0, c.width, c.height);
    const grd = g.createLinearGradient(16, 12, 370, 330);
    grd.addColorStop(0, '#efe8d5'); grd.addColorStop(.5, '#e5dcc4'); grd.addColorStop(1, '#d8ceb2');
    g.fillStyle = grd; g.fillRect(16, 12, 356, 324);
    g.strokeStyle = '#4a3e2e'; g.lineWidth = 2; g.strokeRect(24, 20, 340, 308);
    g.fillStyle = '#1e1a14'; g.font = 'bold 14px serif'; g.fillText('1998 야간 잔류 승인 기안서', 32, 44);
    g.font = '10px serif'; g.fillStyle = '#4a3e2e'; g.fillText('(제30회 해교제 전야제 · 방송부)', 32, 62);

    const bx = 226, by = 26, bw = 42, bh = 48;
    ['담 당', '지도교사', '최종결재'].forEach((lb, i) => {
      g.strokeStyle = '#5a4e3c'; g.lineWidth = 1.2;
      g.strokeRect(bx + i * bw, by, bw, 16); g.strokeRect(bx + i * bw, by + 16, bw, bh - 16);
      g.fillStyle = '#2a241c'; g.font = '10px sans-serif'; g.fillText(lb, bx + i * bw + 6, by + 12);
      if (i < 2 || stamped) {
        g.save(); g.translate(bx + i * bw + 21, by + 32); g.rotate(i === 2 ? (sealAng * Math.PI / 180) : 0.1 * (i ? -1 : 1));
        g.strokeStyle = 'rgba(195, 32, 24, 0.88)'; g.lineWidth = 2.2;
        g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.stroke();
        g.fillStyle = 'rgba(195, 32, 24, 0.88)'; g.font = 'bold 9px serif';
        g.fillText(i === 2 ? '서문고인' : '학우회인', -16, 3); g.restore();
      } else {
        g.fillStyle = 'rgba(180,40,30,0.35)'; g.font = '10px sans-serif'; g.fillText('날인대기', bx + i * bw + 3, by + 36);
      }
    });

    items.forEach((ln, idx) => {
      const y = 94 + idx * 35, isFixed = fixed[idx];
      g.fillStyle = isFixed ? 'rgba(40, 130, 75, 0.16)' : 'rgba(0,0,0,0.03)';
      g.fillRect(32, y - 16, 324, 29);
      g.strokeStyle = isFixed ? '#2e7d4c' : '#b8ae96'; g.lineWidth = 1; g.strokeRect(32, y - 16, 324, 29);
      g.fillStyle = isFixed ? '#184d2c' : '#241e18';
      g.font = isFixed ? 'bold 10.4px sans-serif' : '10.6px serif';
      g.fillText(isFixed ? ln.fix : ln.txt, 36, y + 2);
      if (isFixed) { g.fillStyle = '#c62828'; g.font = 'bold 9.5px sans-serif'; g.fillText('✓ 교정됨', 312, y + 2); }
    });
    g.fillStyle = '#2c241b'; g.font = 'bold 13px serif'; g.fillText('서 문 고 등 학 교 장  ·  학 생 회 장', 82, 316);

    // 우측 관인 조작 패널
    g.fillStyle = '#182026'; g.fillRect(382, 12, 146, 324); g.strokeStyle = '#485866'; g.lineWidth = 1.5; g.strokeRect(382, 12, 146, 324);
    const fixedCount = fixed.filter(Boolean).length, angOk = Math.abs(sealAng) <= 8;
    g.fillStyle = fixedCount === 3 ? '#68ffa8' : '#ffd068'; g.font = 'bold 11.5px sans-serif';
    g.fillText(`1. 위조 정정: ${fixedCount} / 3`, 392, 32);
    g.fillStyle = angOk ? '#68ffa8' : '#ff9870';
    g.fillText(`2. 관인 각도: ${sealAng}° ${angOk ? '(수직)' : ''}`, 392, 52);
    g.fillStyle = '#26323a'; g.fillRect(392, 62, 60, 28); g.fillRect(458, 62, 60, 28);
    g.strokeStyle = '#586c78'; g.strokeRect(392, 62, 60, 28); g.strokeRect(458, 62, 60, 28);
    g.fillStyle = '#ffffff'; g.font = 'bold 11px sans-serif';
    g.fillText('◀ 좌회전[A]', 396, 80); g.fillText('우회전[D] ▶', 462, 80);

    // 인주 패드 & 회전하는 관인 미리보기
    g.fillStyle = '#2d343a'; g.beginPath(); g.arc(455, 148, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = inked ? '#ff3828' : '#982018'; g.beginPath(); g.arc(455, 148, 26, 0, Math.PI * 2); g.fill();
    g.save(); g.translate(455, 148); g.rotate(sealAng * Math.PI / 180);
    g.strokeStyle = '#ffd890'; g.lineWidth = 2; g.strokeRect(-16, -16, 32, 32);
    g.fillStyle = '#ffffff'; g.font = 'bold 9.5px sans-serif'; g.fillText(inked ? '인주충전됨' : '3.인주클릭', -22, 4);
    g.restore();

    // 압착 날인 게이지 & 홀드 버튼
    g.fillStyle = '#10161a'; g.fillRect(392, 202, 126, 18); g.strokeStyle = '#485866'; g.strokeRect(392, 202, 126, 18);
    g.fillStyle = 'rgba(80,255,150,0.35)'; g.fillRect(392 + 126 * .65, 202, 126 * .30, 18);
    g.fillStyle = pressPwr >= .65 && pressPwr <= .96 ? '#58ff9a' : '#ff6848';
    g.fillRect(392, 202, 126 * clamp(pressPwr, 0, 1), 18);

    const ready = fixedCount === 3 && inked && angOk;
    g.fillStyle = ready ? '#8e241c' : '#263036'; g.fillRect(392, 228, 126, 94);
    g.strokeStyle = ready ? '#ff9880' : '#505c66'; g.lineWidth = 2; g.strokeRect(392, 228, 126, 94);
    g.fillStyle = '#f4ece0'; g.font = 'bold 12px sans-serif';
    g.fillText('4. 결재란 날인', 414, 256);
    g.font = '11px sans-serif'; g.fillStyle = '#ffd8a8';
    g.fillText('[마우스/Space 홀드]', 404, 278);
    g.fillText('초록 구간에서 떼기!', 404, 298);

    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return p;
}

function omrGrade({ title = '교무실 — 1998학년도 기말고사 OMR 답안지 판독 및 복원' } = {}) {
  const p = open(title, '<b>1) 적색 채점 필름(상단 슬라이더 또는 A·D)</b>을 움직여 좌우 기준점(⊕)에 정렬한 뒤,<br><b>2) [1번 수정테이프]</b>로 오답 마킹을 지우고 <b>[2번 컴퓨터용 사인펜]</b>으로 붉은 정답 구멍에 마킹하여 <b>[Space / 광학 판독]</b>을 실행하라!');
  const c = canvas(520, 350), g = c.getContext('2d');
  screen3D(c, { kind: 'paper', prop: 'lamp' });
  const ans = [3, 1, 5, 2, 4];
  // 각 문항의 마킹 배열 (복수 마킹이나 오답이 있으면 수정테이프로 먼저 지워야 함!)
  const marks = [[2], [1], [4], [5], [4]];
  let filmOff = -38, tool = 1, scanY = -1, lastT = performance.now();

  const tryScan = () => {
    if (!finish || scanY >= 0) return;
    if (Math.abs(filmOff) > 7) { sfx.buzz(); status('먼저 투명 적색 채점 필름을 좌우 기준점(⊕ 0mm)에 정확히 정렬하세요!', 'err'); return; }
    const allOk = ans.every((a, q) => marks[q].length === 1 && marks[q][0] === a);
    if (!allOk) {
      sfx.buzz();
      status('오답 마킹이 남아 있거나 정답 칸이 비어 있습니다! [1: 수정테이프]로 오답을 지우고 [2: 사인펜]으로 마킹하세요.', 'err');
      return;
    }
    sfx.unlock(); scanY = 90;
  };

  c.addEventListener('mousedown', e => {
    if (!finish || scanY >= 0) return;
    const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width, y = (e.clientY - rc.top) * c.height / rc.height;
    // 필름 정렬 슬라이더 클릭/조절
    if (y >= 62 && y <= 92 && x >= 195 && x <= 450) {
      filmOff = Math.round(clamp(((x - 322) / 110) * 48, -48, 48)); sfx.dial(); return;
    }
    // 하단 도구 버튼 (1: 수정테이프, 2: 컴퓨터용 사인펜, 3: OMR 광학 판독)
    if (y >= 292) {
      if (x < 175) { tool = 1; sfx.click(); status('도구 선택: [1] 수정테이프 — 잘못 칠해진 검은 마킹을 클릭해 지우세요.'); }
      else if (x < 350) { tool = 2; sfx.click(); status('도구 선택: [2] 컴퓨터용 수성사인펜 — 붉은 채점 구멍 위치에 마킹하세요.'); }
      else tryScan();
      return;
    }
    // 문항 1~5 버블 클릭
    for (let q = 0; q < 5; q++) {
      const ry = 122 + q * 34;
      if (Math.abs(y - ry) <= 15) {
        for (let choice = 1; choice <= 5; choice++) {
          const cx = 155 + (choice - 1) * 52;
          if (Math.abs(x - cx) <= 18) {
            const has = marks[q].includes(choice);
            if (tool === 1) {
              if (has) { marks[q] = marks[q].filter(v => v !== choice); sfx.paper ? sfx.paper() : sfx.click(); }
              else { sfx.buzz(); status('수정테이프는 이미 칠해진 검은 마킹을 지울 때 사용합니다. 마킹하려면 [2번 사인펜]으로 바꾸세요!', 'err'); }
            } else {
              if (!has) { marks[q].push(choice); sfx.click(); }
            }
            return;
          }
        }
      }
    }
  });

  keys(e => {
    if (e.type !== 'keydown' || scanY >= 0) return;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') { filmOff = clamp(filmOff - 6, -48, 48); sfx.dial(); }
    else if (e.code === 'KeyD' || e.code === 'ArrowRight') { filmOff = clamp(filmOff + 6, -48, 48); sfx.dial(); }
    else if (e.code === 'Digit1') { tool = 1; sfx.click(); }
    else if (e.code === 'Digit2') { tool = 2; sfx.click(); }
    else if (e.code === 'Space' || e.code === 'Enter') tryScan();
  });

  const loop = now => {
    const dt = Math.min(.08, (now - lastT) / 1000); lastT = now;
    if (scanY >= 0) {
      scanY += dt * 260;
      if (scanY > 285 && finish) {
        status('삐빅— OMR 광학 판독 100% 일치! 답안지 뒷면의 비밀 시간 기록이 드러난다!', 'ok');
        close(true); return;
      }
    }
    g.fillStyle = '#12161a'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#f5f2ea'; g.fillRect(20, 12, 480, 274);
    g.strokeStyle = '#d46a7e'; g.lineWidth = 2; g.strokeRect(28, 18, 464, 262);
    g.fillStyle = '#181818'; for (let k = 0; k < 13; k++) g.fillRect(32, 30 + k * 19, 10, 8);
    g.fillStyle = '#c84b62'; g.fillRect(50, 22, 432, 26);
    g.fillStyle = '#ffffff'; g.font = 'bold 13.5px sans-serif'; g.fillText('1998학년도 제2학기 기말고사 OMR 답안지 (서문고등학교)', 64, 40);

    // 필름 기준점 정렬 바
    const filmAligned = Math.abs(filmOff) <= 7;
    g.fillStyle = '#222830'; g.fillRect(50, 54, 432, 32);
    g.fillStyle = filmAligned ? '#60ffa8' : '#ffd068'; g.font = 'bold 11.5px sans-serif';
    g.fillText(`채점 필름 정렬[A/D]: ${filmOff > 0 ? '+' : ''}${filmOff}mm ${filmAligned ? '(⊕ 기준점 일치!)' : '(슬라이더를 중앙 ⊕에 맞추세요)'}`, 58, 74);
    g.fillStyle = '#38424c'; g.fillRect(310, 62, 160, 16);
    g.fillStyle = '#ffffff'; g.fillRect(390 - 2, 59, 4, 22);
    g.fillStyle = filmAligned ? '#58ff9a' : '#ff5848'; g.fillRect(390 + (filmOff / 48) * 72 - 5, 60, 10, 20);

    for (let q = 0; q < 5; q++) {
      const y = 122 + q * 34;
      const isOk = marks[q].length === 1 && marks[q][0] === ans[q];
      const isMulti = marks[q].length > 1;
      g.fillStyle = isOk ? 'rgba(60, 180, 110, 0.14)' : 'rgba(212, 106, 126, 0.08)';
      g.fillRect(50, y - 15, 432, 28);
      g.strokeStyle = '#e09aa8'; g.strokeRect(50, y - 15, 432, 28);
      g.fillStyle = '#8a283c'; g.font = 'bold 12.5px sans-serif'; g.fillText('문항 0' + (q + 1), 62, y + 4);
      for (let choice = 1; choice <= 5; choice++) {
        const cx = 155 + (choice - 1) * 52;
        g.strokeStyle = '#c85a70'; g.lineWidth = 1.3; g.beginPath(); g.ellipse(cx, y - 1, 12, 8, 0, 0, Math.PI * 2); g.stroke();
        g.fillStyle = '#b85066'; g.font = '11px sans-serif'; g.fillText(String(choice), cx - 3.5, y + 3);
        if (marks[q].includes(choice)) {
          g.fillStyle = '#141618'; g.beginPath(); g.ellipse(cx, y - 1, 10.5, 6.8, 0, 0, Math.PI * 2); g.fill();
        }
        // 투명 적색 채점 필름 오버레이 (filmOff 만큼 오프셋되어 표시!)
        if (ans[q] === choice) {
          g.strokeStyle = filmAligned ? 'rgba(230, 30, 30, 0.92)' : 'rgba(230, 80, 40, 0.55)';
          g.lineWidth = 2.4; g.beginPath(); g.arc(cx + filmOff, y - 1, 13.5, 0, Math.PI * 2); g.stroke();
        }
      }
      g.fillStyle = isOk ? '#1e7e46' : isMulti ? '#d86818' : '#c62828';
      g.font = 'bold 11px sans-serif';
      g.fillText(isOk ? '● 정답일치' : isMulti ? '▲ 복수마킹(지우기!)' : marks[q].length === 0 ? '○ 미기입(마킹!)' : '× 오답(지우기!)', 390, y + 4);
    }

    if (scanY >= 0) {
      g.fillStyle = 'rgba(80, 255, 140, 0.45)'; g.fillRect(28, scanY - 6, 464, 12);
    }

    // 하단 3버튼 바
    const allOk = filmAligned && ans.every((a, q) => marks[q].length === 1 && marks[q][0] === a);
    [
      [20, 152, tool === 1 ? '#2a628f' : '#222a32', '1. 수정테이프 (오답지우기)'],
      [180, 162, tool === 2 ? '#6e2842' : '#222a32', '2. 컴퓨터용 사인펜 (마킹)'],
      [350, 150, allOk ? '#24824c' : '#28323a', '3. OMR 광학 판독 [Space]']
    ].forEach(([bx, bw, bg, lbl]) => {
      g.fillStyle = bg; g.fillRect(bx, 294, bw, 44);
      g.strokeStyle = '#687c8c'; g.lineWidth = 1.5; g.strokeRect(bx, 294, bw, 44);
      g.fillStyle = '#ffffff'; g.font = 'bold 11.5px sans-serif'; g.fillText(lbl, bx + 10, 320);
    });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return p;
}

function timetableRestore({ title = '교실 게시판 — 1998년 10월 12일 학급 시간표 & 당번 자석 복원' } = {}) {
  const p = open(title, '<b>1) 하단 자석 명패(1~5번 클릭 또는 숫자키)</b> 중 단서에 맞는 과목/당번 자석을 먼저 선택한 뒤,<br><b>2) 위쪽 시간표의 알맞은 교시 칸</b>을 클릭해 부착하고, 4칸을 모두 올바르게 채운 뒤 <b>[Space / 황동 압정 잠금]</b>을 눌러라!');
  const c = canvas(520, 350), g = c.getContext('2d');
  screen3D(c, { kind: 'paper', prop: 'lamp' });
  const slots = [
    { period: '1교시 (09:00)', hint: '시약 중화 적정 실험 (화학실 이동 수업)', want: '화 학 I', placed: '화 학 I', locked: true },
    { period: '2교시 (10:00)', hint: '1998 현대문학 시 강독 (교실 수업)', want: '국 어 II', placed: null, locked: false },
    { period: '3교시 (11:00)', hint: '합창부 해교제 지정곡 리허설 (별관 음악실)', want: '음 악', placed: null, locked: false },
    { period: '4교시 (13:00)', hint: '방송부 30주년 기념방송 송출 점검 (3F 방송실)', want: '방송반 점검', placed: null, locked: false },
    { period: '야간 (21:00)', hint: '심야 교실 소등 및 마지막 하교 방송 당번', want: '주번: 윤하늘', placed: null, locked: false },
  ];
  const magnets = ['국 어 II', '음 악', '방송반 점검', '주번: 윤하늘', '수 학 I (휴강)'];
  let selMag = 0;

  function draw() {
    g.fillStyle = '#0f1714'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#5a3d24'; g.fillRect(14, 10, 492, 328);
    g.fillStyle = '#1b3b2b'; g.fillRect(22, 18, 476, 312);
    g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1.5; g.strokeRect(28, 24, 464, 300);
    g.fillStyle = '#f0ead8'; g.font = 'bold 14.5px serif'; g.fillText('1998. 10. 12 (월) — 학급 일일 시간표 및 야간 당번 자석 보드', 38, 46);

    slots.forEach((s, i) => {
      const y = 72 + i * 35, ok = s.placed === s.want;
      g.fillStyle = ok ? 'rgba(30, 95, 58, 0.55)' : 'rgba(12, 26, 20, 0.55)';
      g.fillRect(36, y - 14, 448, 29);
      g.strokeStyle = ok ? '#68ffa8' : 'rgba(180, 220, 195, 0.35)'; g.strokeRect(36, y - 14, 448, 29);
      g.fillStyle = '#b8d8c4'; g.font = 'bold 11.5px sans-serif'; g.fillText(s.period, 44, y + 5);
      g.fillStyle = '#d8d2b8'; g.font = '11px sans-serif'; g.fillText(s.hint, 134, y + 5);
      if (s.placed) {
        g.fillStyle = ok ? '#e8dec0' : '#f4b8b0'; g.fillRect(362, y - 11, 114, 23);
        g.fillStyle = ok ? '#247a48' : '#c82828'; g.beginPath(); g.arc(372, y + 1, 4, 0, 7); g.fill();
        g.fillStyle = '#1c2420'; g.font = 'bold 11.5px sans-serif'; g.fillText(s.placed, 380, y + 5);
      } else {
        g.strokeStyle = '#ffd068'; g.setLineDash([4, 3]); g.strokeRect(362, y - 11, 114, 23); g.setLineDash([]);
        g.fillStyle = '#ffd068'; g.font = '11px sans-serif'; g.fillText(`[클릭: ${magnets[selMag]}]`, 366, y + 5);
      }
    });

    // 하단 자석 트레이 & 우측 확정 버튼
    g.fillStyle = '#12261c'; g.fillRect(36, 248, 448, 68);
    g.fillStyle = '#9ec4b0'; g.font = 'bold 11px sans-serif'; g.fillText('1단계 — 부착할 자석 명패 선택 (클릭 또는 1~5 키):', 44, 265);
    magnets.forEach((m, idx) => {
      const mx = 44 + idx * 72, isSel = selMag === idx;
      const usedOk = slots.some(s => s.placed === m && s.want === m);
      g.fillStyle = isSel ? '#ffd870' : usedOk ? '#385848' : '#e6dcc2';
      g.fillRect(mx, 274, 66, 32);
      g.strokeStyle = isSel ? '#ff5828' : '#24342c'; g.lineWidth = isSel ? 2.5 : 1; g.strokeRect(mx, 274, 66, 32);
      g.fillStyle = usedOk && !isSel ? '#90a898' : '#18201c'; g.font = 'bold 10px sans-serif';
      g.fillText(`[${idx + 1}] ${m.slice(0, 6)}`, mx + 4, 294);
    });

    const allOk = slots.every(s => s.placed === s.want);
    g.fillStyle = allOk ? '#288450' : '#283832'; g.fillRect(406, 270, 72, 38);
    g.strokeStyle = allOk ? '#70ffb0' : '#586c64'; g.lineWidth = 2; g.strokeRect(406, 270, 72, 38);
    g.fillStyle = '#ffffff'; g.font = 'bold 11px sans-serif';
    g.fillText(allOk ? '✦ 확정[Space]' : '압정 잠금', 410, 293);
  }

  const tryConfirm = () => {
    if (slots.every(s => s.placed === s.want)) {
      sfx.unlock(); status('찰칵! — 10월 12일 시간표와 야간 주번 자석이 황동 압정으로 고정되었다!', 'ok');
      setTimeout(() => close(true), 450);
    } else {
      sfx.buzz(); status('아직 비어 있거나 잘못 배정된 교시가 있습니다! 각 교시 힌트에 맞는 자석을 골라 넣으세요.', 'err');
    }
  };

  c.addEventListener('click', e => {
    if (!finish) return;
    const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width, y = (e.clientY - rc.top) * c.height / rc.height;
    if (y >= 265 && y <= 315) {
      if (x >= 404) { tryConfirm(); return; }
      const mIdx = Math.floor((x - 44) / 72);
      if (mIdx >= 0 && mIdx < magnets.length) { selMag = mIdx; sfx.click(); draw(); }
      return;
    }
    for (let i = 1; i < slots.length; i++) {
      const sy = 72 + i * 35;
      if (Math.abs(y - sy) <= 15) {
        const chosen = magnets[selMag];
        // 다른 칸에 이미 붙어 있으면 떼어 옴
        slots.forEach((s, si) => { if (!s.locked && si !== i && s.placed === chosen) s.placed = null; });
        slots[i].placed = chosen;
        if (chosen === slots[i].want) { sfx.click(); status(`${slots[i].period}에 [${chosen}] 자석이 정확히 장착되었습니다!`, 'ok'); }
        else { sfx.buzz(); status(`[${chosen}] 자석은 ${slots[i].period} 힌트와 맞지 않습니다! 다른 자석을 선택해 교체하세요.`, 'err'); }
        draw();
        return;
      }
    }
  });

  keys(e => {
    if (e.type !== 'keydown') return;
    if (/^(Digit|Numpad)[1-5]$/.test(e.code)) { selMag = +e.code.slice(-1) - 1; sfx.click(); draw(); }
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { selMag = (selMag + magnets.length - 1) % magnets.length; sfx.click(); draw(); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { selMag = (selMag + 1) % magnets.length; sfx.click(); draw(); }
    else if (e.code === 'Space' || e.code === 'Enter') tryConfirm();
  });

  draw(); return p;
}

function libraryCatalog({ title = '도서실 — KDC 청구기호 도서 대출 카드 & 금서 서가 배열' } = {}) {
  const p = open(title, '<b>1단계:</b> 책 표지 상단을 클릭해 두 권씩 자리를 바꿔 <b>KDC 청구기호 오름차순(100→300→400→800→900)</b>으로 배열하라<br><b>2단계:</b> 각 책 하단의 <b>[▲ / ▼ 라벨 슬라이더]</b>를 눌러 붉은 청구기호 라벨 높이를 <b>점선 기준선</b>에 맞춘 뒤 <b>[Space / 서가 잠금 해제]</b>를 눌러라!');
  const c = canvas(520, 340), g = c.getContext('2d');
  screen3D(c, { kind: 'paper', prop: 'lamp' });
  const books = [
    { code: 400, label: '400 자연과학', sub: '화학실험 편람', col: '#244a38', tagLv: 1 },
    { code: 100, label: '100 철학·심리', sub: '융의 그림자 원형', col: '#4a2c38', tagLv: 0 },
    { code: 900, label: '900 역사·교사', sub: '서문고 30년사', col: '#5a3a22', tagLv: 2 },
    { code: 300, label: '300 사회·교육', sub: '1998 학생생활규정', col: '#243c58', tagLv: 1 },
    { code: 800, label: '800 문학·희곡', sub: '제30회 해교제 대본', col: '#544626', tagLv: 0 },
  ];
  let sel = -1;

  function draw() {
    g.fillStyle = '#120e0b'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#3d2716'; g.fillRect(20, 16, 480, 258);
    g.fillStyle = '#24160c'; g.fillRect(32, 28, 456, 224);
    g.fillStyle = '#5a3b22'; g.fillRect(20, 252, 480, 22);

    // 라벨 수평 정렬 기준선 (tagLv === 1 위치: y = 162)
    g.strokeStyle = 'rgba(255, 90, 70, 0.75)'; g.lineWidth = 2; g.setLineDash([6, 4]);
    g.beginPath(); g.moveTo(36, 166); g.lineTo(484, 166); g.stroke(); g.setLineDash([]);

    books.forEach((b, i) => {
      const bx = 46 + i * 88, by = 40, bw = 72, bh = 210;
      const orderOk = [100, 300, 400, 800, 900][i] === b.code;
      const tagOk = b.tagLv === 1;
      const dy = sel === i ? -10 : 0;
      g.fillStyle = b.col; g.fillRect(bx, by + dy, bw, bh);
      g.strokeStyle = sel === i ? '#ffd868' : (orderOk && tagOk ? '#68ffa8' : '#8a7a60');
      g.lineWidth = sel === i ? 3 : 1.5; g.strokeRect(bx, by + dy, bw, bh);

      g.fillStyle = '#f0e6d2'; g.font = 'bold 11px serif';
      g.fillText(b.sub.slice(0, 6), bx + 8, by + 36 + dy);
      if (b.sub.length > 6) g.fillText(b.sub.slice(6), bx + 8, by + 52 + dy);

      // 슬라이딩 청구기호 라벨 (tagLv: 0=상, 1=중(정렬), 2=하)
      const ly = by + 88 + b.tagLv * 26 + dy;
      g.fillStyle = '#f2ece0'; g.fillRect(bx + 6, ly, bw - 12, 42);
      g.strokeStyle = tagOk ? '#288a48' : '#c84030'; g.lineWidth = 2; g.strokeRect(bx + 8, ly + 2, bw - 16, 38);
      g.fillStyle = '#1a1612'; g.font = 'bold 13px monospace'; g.fillText('KDC ' + b.code, bx + 11, ly + 19);
      g.font = '10px sans-serif'; g.fillText(b.label.split(' ')[1], bx + 12, ly + 34);

      // 하단 라벨 높이 조절 버튼 (▲ / ▼)
      g.fillStyle = '#1c2428'; g.fillRect(bx + 6, by + 178 + dy, 28, 24); g.fillRect(bx + 38, by + 178 + dy, 28, 24);
      g.strokeStyle = '#687880'; g.strokeRect(bx + 6, by + 178 + dy, 28, 24); g.strokeRect(bx + 38, by + 178 + dy, 28, 24);
      g.fillStyle = '#e8f0f4'; g.font = 'bold 11px sans-serif';
      g.fillText('▲', bx + 14, by + 194 + dy); g.fillText('▼', bx + 46, by + 194 + dy);
    });

    const allOk = books.every((b, i) => b.code === [100, 300, 400, 800, 900][i] && b.tagLv === 1);
    g.fillStyle = allOk ? '#247e4c' : '#263038'; g.fillRect(20, 284, 480, 42);
    g.strokeStyle = allOk ? '#70ffb0' : '#586874'; g.lineWidth = 2; g.strokeRect(20, 284, 480, 42);
    g.fillStyle = '#ffffff'; g.font = 'bold 13px sans-serif';
    g.fillText(allOk ? '✦ KDC 오름차순 & 라벨 기준선 정렬 완료 — [Space / 클릭] 비밀 서가 개방!' : '100→300→400→800→900 배열 + 모든 라벨을 붉은 점선(중앙)에 맞추세요', 42, 310);
  }

  const tryUnlock = () => {
    if (books.every((b, i) => b.code === [100, 300, 400, 800, 900][i] && b.tagLv === 1)) {
      sfx.unlock(); status('달칵— KDC 청구기호와 라벨 자석 핀이 맞물리며 비밀 서가가 열렸다!', 'ok');
      setTimeout(() => close(true), 450);
    } else {
      sfx.buzz(); status('책 순서(100→300→400→800→900)와 등표지 라벨 높이(붉은 점선)를 모두 맞추세요!', 'err');
    }
  };

  c.addEventListener('click', e => {
    if (!finish) return;
    const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width, y = (e.clientY - rc.top) * c.height / rc.height;
    if (y >= 280) { tryUnlock(); return; }
    const idx = Math.floor((x - 46) / 88);
    if (idx < 0 || idx >= 5) return;
    const bx = 46 + idx * 88;
    // 하단 ▲ / ▼ 버튼 클릭 시 라벨 높이 변경
    if (y >= 210 && y <= 252) {
      if (x - bx < 36) books[idx].tagLv = Math.max(0, books[idx].tagLv - 1);
      else books[idx].tagLv = Math.min(2, books[idx].tagLv + 1);
      sfx.dial(); draw(); return;
    }
    // 책 상단 클릭 시 두 권 위치 교환
    if (sel === -1) { sel = idx; sfx.click(); draw(); }
    else if (sel === idx) { sel = -1; sfx.click(); draw(); }
    else {
      const tmp = books[sel]; books[sel] = books[idx]; books[idx] = tmp; sel = -1; sfx.slide ? sfx.slide() : sfx.click(); draw();
    }
  });

  keys(e => {
    if (e.type !== 'keydown') return;
    if (e.code === 'Space' || e.code === 'Enter') tryUnlock();
  });

  draw(); return p;
}

function cassetteSplice({ title = '방송실 — 1998년 하교 방송 카세트테이프 마그네틱 필름 접합' } = {}) {
  const p = open(title, '<b>1단계:</b> 끊어진 <b>마그네틱 테이프 파단부 3곳</b>을 클릭해 스플라이싱 테이프로 접합하라<br><b>2단계:</b> 우측 <b>[헤드 방위각(Azimuth) 드라이버 나사(A·D / 노브)]</b>를 돌려 L/R 위상 동조율을 88% 이상 맞춘 뒤 <b>[Space / 재생 검증]</b>을 눌러라!');
  const c = canvas(520, 340), g = c.getContext('2d');
  screen3D(c, { kind: 'metal', prop: 'tape' });
  const breaks = [
    { x: 118, y: 218, fixed: false },
    { x: 205, y: 232, fixed: false },
    { x: 292, y: 218, fixed: false },
  ];
  const targetAz = .25 + Math.random() * .55;
  let az = .08, playing = false, reelAng = 0, lastT = performance.now(), dn = {};

  const triggerPlay = () => {
    if (!breaks.every(b => b.fixed)) { sfx.buzz(); status('먼저 끊어진 마그네틱 필름 3곳을 모두 클릭해 스플라이싱 테이프로 접합하세요!', 'err'); return; }
    const sync = clamp(1 - Math.abs(az - targetAz) / .14, 0, 1);
    if (sync < .86) { sfx.buzz(); status('자기 헤드 방위각(Azimuth)이 어긋나 음성이 뭉개집니다! [A/D]로 위상 동조율을 88% 이상 맞추세요.', 'err'); return; }
    if (playing) return;
    playing = true; sfx.unlock();
    status('철컥, 지이잉— 방위각이 완벽히 맞물리며 1998년 10월 12일의 원본 음성이 선명히 재생된다!', 'ok');
    setTimeout(() => close(true), 600);
  };

  c.addEventListener('mousedown', e => {
    if (!finish || playing) return;
    const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width, y = (e.clientY - rc.top) * c.height / rc.height;
    const hit = breaks.find(b => !b.fixed && Math.hypot(b.x - x, b.y - y) < 28);
    if (hit) { hit.fixed = true; sfx.click(); if (breaks.every(b => b.fixed)) status('필름 3곳 접합 완료! 이제 우측 헤드 방위각(Azimuth) 나사를 조절하세요.'); return; }
    if (x >= 365 && y >= 115 && y <= 195) {
      az = clamp((x - 375) / 120, 0, 1); sfx.dial(); return;
    }
    if (y >= 272) triggerPlay();
  });
  c.addEventListener('wheel', e => { e.preventDefault(); az = clamp(az + (e.deltaY < 0 ? .03 : -.03), 0, 1); sfx.dial(); }, { passive: false });

  keys(e => {
    dn[e.code] = e.type === 'keydown';
    if (e.type === 'keydown' && (e.code === 'Space' || e.code === 'Enter')) triggerPlay();
  });

  const loop = now => {
    const dt = Math.min(.08, (now - lastT) / 1000); lastT = now;
    if (dn.KeyA || dn.ArrowLeft) az = clamp(az - dt * .38, 0, 1);
    if (dn.KeyD || dn.ArrowRight) az = clamp(az + dt * .38, 0, 1);
    if (playing) reelAng += dt * 4.5;

    const allFixed = breaks.every(b => b.fixed);
    const sync = allFixed ? clamp(1 - Math.abs(az - targetAz) / .14, 0, 1) : 0;

    g.fillStyle = '#0e1114'; g.fillRect(0, 0, c.width, c.height);
    // 좌측 카세트 본체
    g.fillStyle = '#23282e'; g.fillRect(22, 16, 330, 240); g.strokeStyle = '#586470'; g.lineWidth = 2.5; g.strokeRect(22, 16, 330, 240);
    g.fillStyle = '#e8dfc8'; g.fillRect(40, 32, 294, 134); g.fillStyle = '#b83228'; g.fillRect(40, 32, 294, 24);
    g.fillStyle = '#ffffff'; g.font = 'bold 12px sans-serif'; g.fillText('TDK SA-60  |  1998.10.12 방송부 원본 (SIDE A)', 52, 48);
    g.fillStyle = '#14181c'; g.fillRect(72, 70, 230, 80);
    [125, 248].forEach(rx => {
      g.save(); g.translate(rx, 110); g.rotate(reelAng);
      g.fillStyle = '#3d2418'; g.beginPath(); g.arc(0, 0, 32, 0, 7); g.fill();
      g.fillStyle = '#ece6d8'; g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill();
      g.restore();
    });

    g.strokeStyle = '#6e4228'; g.lineWidth = 4; g.beginPath(); g.moveTo(52, 192);
    breaks.forEach(b => { if (b.fixed) g.lineTo(b.x, b.y); else { g.lineTo(b.x - 14, b.y - 8); g.moveTo(b.x + 14, b.y + 8); } });
    g.lineTo(322, 192); g.stroke();
    breaks.forEach((b, bi) => {
      g.fillStyle = b.fixed ? 'rgba(72, 255, 152, 0.25)' : 'rgba(255, 80, 60, 0.28)'; g.beginPath(); g.arc(b.x, b.y, 19, 0, 7); g.fill();
      g.strokeStyle = b.fixed ? '#58ff9a' : '#ff6850'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#f0ece4'; g.font = 'bold 10px sans-serif'; g.fillText(b.fixed ? '접합됨' : `파단#${bi + 1}`, b.x - 18, b.y + 32);
    });

    // 우측 자기 헤드 방위각(Azimuth) 교정 패널
    g.fillStyle = '#161e24'; g.fillRect(364, 16, 138, 240); g.strokeStyle = '#485866'; g.strokeRect(364, 16, 138, 240);
    g.fillStyle = '#d8e6ee'; g.font = 'bold 12px sans-serif'; g.fillText('헤드 방위각(Azimuth)', 374, 38);
    g.fillStyle = '#9ab0bc'; g.font = '10.5px sans-serif'; g.fillText('나사 조절: [A/D] · 휠', 374, 56);

    // 방위각 황동 드라이버 나사 노브
    g.save(); g.translate(433, 128); g.rotate((az - .5) * Math.PI * 1.6);
    g.fillStyle = '#c89a38'; g.beginPath(); g.arc(0, 0, 32, 0, 7); g.fill();
    g.strokeStyle = sync >= .86 ? '#58ff9a' : '#785818'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#241c0c'; g.fillRect(-24, -3, 48, 6);
    g.restore();

    // L/R 듀얼 위상 동조 레벨 바
    g.fillStyle = '#10161a'; g.fillRect(376, 182, 114, 14); g.fillRect(376, 202, 114, 14);
    g.fillStyle = sync >= .86 ? '#58ff9a' : '#ffaa40';
    g.fillRect(376, 182, 114 * sync, 14);
    g.fillRect(376, 202, 114 * clamp(sync * (.92 + Math.sin(now * .01) * .08), 0, 1), 14);
    g.fillStyle = '#e8f2f8'; g.font = 'bold 11.5px monospace';
    g.fillText(`위상 동조율: ${Math.round(sync * 100)}%`, 378, 238);

    const ready = allFixed && sync >= .86;
    g.fillStyle = ready ? '#247a48' : '#263038'; g.fillRect(22, 272, 480, 48);
    g.strokeStyle = ready ? '#68ffa8' : '#586874'; g.lineWidth = 2; g.strokeRect(22, 272, 480, 48);
    g.fillStyle = '#ffffff'; g.font = 'bold 13.5px sans-serif';
    g.fillText(ready ? '▶ [Space / 클릭] 방위각 교정 완료 — 마스터 테이프 재생!' : `1) 필름 접합(${breaks.filter(b => b.fixed).length}/3)  +  2) 헤드 방위각 88% 이상(현재 ${Math.round(sync * 100)}%) 필요`, 52, 301);

    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop); return p;
}

function microscopeSlide({ title = '과학준비실 — 광학 현미경 프레파라트 표본 초점·배율 판독' } = {}) {
  const p = open(title, '<b>1) 대물렌즈[400x]</b> 전환 → <b>2) 프레파라트 스테이지[WASD / 뷰포트 드래그]</b>로 표본을 십자선 중앙에 이동 →<br><b>3) 미동 초점 나사[Q·E]</b>와 <b>4) 조리개 광량[Z·C]</b>을 맞춘 뒤 <b>[Space / 표본 판독 확정]</b>을 눌러라!');
  const c = canvas(520, 340), g = c.getContext('2d');
  let mag = 100, focus = 0.18, targetFocus = 0.68, iris = 0.25, targetIris = 0.62;
  let sx = 46, sy = -38, dragStage = false, lastMouse = [0, 0];
  screen3D(c, { kind: 'metal', prop: 'microscope', anim: () => ({ mag, sx, sy, focus, iris }) });

  function draw() {
    g.fillStyle = '#090c10'; g.fillRect(0, 0, c.width, c.height);
    const cx = 160, cy = 165, r = 126;
    const fErr = Math.abs(focus - targetFocus) + (mag === 400 ? 0 : 0.35);
    const iErr = Math.abs(iris - targetIris);
    const posErr = Math.hypot(sx, sy);

    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
    const bright = Math.round(180 + (iris - .5) * 110);
    const bg = g.createRadialGradient(cx, cy, 10, cx, cy, r);
    bg.addColorStop(0, `rgb(${bright},${Math.min(255, bright + 24)},${Math.min(255, bright + 12)})`);
    bg.addColorStop(0.78, '#689888'); bg.addColorStop(1, '#14221e');
    g.fillStyle = bg; g.fillRect(cx - r, cy - r, r * 2, r * 2);

    const scale = mag / 200;
    const tx = cx + sx, ty = cy + sy;
    for (let i = 0; i < 9; i++) {
      const ax = tx + Math.cos(i * 1.1) * 34 * scale, ay = ty + Math.sin(i * 1.4) * 28 * scale;
      g.fillStyle = `rgba(40, 105, 90, ${clamp(0.78 - fErr * 0.85 - iErr * 0.5, 0.12, 0.78)})`;
      g.beginPath(); g.ellipse(ax, ay, (16 + fErr * 22) * scale * 0.6, (11 + fErr * 18) * scale * 0.6, i * 0.4, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = `rgba(15, 30, 25, ${clamp(1 - fErr * 1.5 - iErr * 0.8, 0.10, 0.96)})`;
    g.font = 'bold ' + Math.round(14.5 * (mag === 400 ? 1 : 0.7)) + 'px monospace';
    g.fillText('SAMPLE #98-1012-HN', tx - 76, ty + 5);

    // 십자선 & 중앙 타겟 링
    g.strokeStyle = 'rgba(20,30,28,0.45)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.moveTo(cx, cy - r); g.lineTo(cx, cy + r); g.stroke();
    g.strokeStyle = posErr < 18 ? 'rgba(40,200,100,0.85)' : 'rgba(220,60,40,0.65)';
    g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 28, 0, Math.PI * 2); g.stroke();
    g.restore();
    g.strokeStyle = '#38444c'; g.lineWidth = 8; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();

    // 우측 4단 제어 패널
    g.fillStyle = '#151c22'; g.fillRect(304, 16, 200, 308); g.strokeStyle = '#3a4a56'; g.lineWidth = 1.5; g.strokeRect(304, 16, 200, 308);
    g.fillStyle = '#d8e6ee'; g.font = 'bold 11.5px sans-serif'; g.fillText('1. 리볼버 대물렌즈 배율', 316, 38);
    [40, 100, 400].forEach((m, idx) => {
      const bx = 316 + idx * 58, by = 46;
      g.fillStyle = mag === m ? '#2a7a56' : '#242e36'; g.fillRect(bx, by, 52, 26);
      g.strokeStyle = mag === m ? '#68ffa8' : '#50606c'; g.strokeRect(bx, by, 52, 26);
      g.fillStyle = '#ffffff'; g.font = 'bold 11px monospace'; g.fillText(m + 'x', bx + 12, by + 17);
    });

    const stageOk = posErr < 18, focusOk = Math.abs(focus - targetFocus) < 0.11, irisOk = Math.abs(iris - targetIris) < 0.14;
    g.fillStyle = stageOk ? '#68ffa8' : '#ffd068'; g.font = 'bold 11.5px sans-serif';
    g.fillText(`2. 스테이지 중앙 정렬 [WASD]: ${stageOk ? 'OK' : '조절필요'}`, 316, 94);
    g.fillStyle = '#242e36';
    [['◀X', 316], ['X▶', 360], ['▲Y', 404], ['Y▼', 448]].forEach(([lb, bx]) => {
      g.fillStyle = '#242e36'; g.fillRect(bx, 102, 40, 24); g.strokeStyle = '#50606c'; g.strokeRect(bx, 102, 40, 24);
      g.fillStyle = '#ffffff'; g.font = '10.5px sans-serif'; g.fillText(lb, bx + 10, 118);
    });

    g.fillStyle = focusOk ? '#68ffa8' : '#d8e6ee'; g.font = 'bold 11.5px sans-serif';
    g.fillText('3. 미동 초점 나사 [Q / E]', 316, 148);
    g.fillStyle = '#242e36'; g.fillRect(316, 156, 174, 16);
    g.fillStyle = focusOk ? '#58ff9a' : '#e0a838'; g.fillRect(316, 156, 174 * focus, 16);
    g.strokeStyle = '#ffffff'; g.strokeRect(316 + 174 * targetFocus - 3, 153, 6, 22);

    g.fillStyle = irisOk ? '#68ffa8' : '#d8e6ee'; g.font = 'bold 11.5px sans-serif';
    g.fillText('4. 조리개 광량 조절 [Z / C]', 316, 198);
    g.fillStyle = '#242e36'; g.fillRect(316, 206, 174, 16);
    g.fillStyle = irisOk ? '#58ff9a' : '#58b8ff'; g.fillRect(316, 206, 174 * iris, 16);
    g.strokeStyle = '#ffffff'; g.strokeRect(316 + 174 * targetIris - 3, 203, 6, 22);

    const ready = mag === 400 && stageOk && focusOk && irisOk;
    g.fillStyle = ready ? '#247e4c' : '#28323a'; g.fillRect(316, 242, 174, 66);
    g.strokeStyle = ready ? '#70ffb0' : '#52606c'; g.lineWidth = 2; g.strokeRect(316, 242, 174, 66);
    g.fillStyle = '#ffffff'; g.font = 'bold 12.5px sans-serif';
    g.fillText(ready ? '✦ [Space / 클릭]' : '4개 항목 동조 후', 346, 270);
    g.fillText(ready ? '표본 코드 판독 확정!' : '판독 가능', 346, 292);
  }

  const confirmSlide = () => {
    const stageOk = Math.hypot(sx, sy) < 18, focusOk = Math.abs(focus - targetFocus) < 0.11, irisOk = Math.abs(iris - targetIris) < 0.14;
    if (mag !== 400 || !stageOk || !focusOk || !irisOk) {
      sfx.buzz(); status('배율(400x), 스테이지 중앙 정렬(WASD), 초점(Q/E), 조리개(Z/C) 4가지를 모두 녹색으로 맞추세요!', 'err'); return;
    }
    sfx.unlock(); status('표본 판독 완료 — 슬라이드 글라스의 1998.10.12 실험 기록을 확보했다!', 'ok');
    setTimeout(() => close(true), 450);
  };

  c.addEventListener('mousedown', e => {
    if (!finish) return;
    const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width, y = (e.clientY - rc.top) * c.height / rc.height;
    if (Math.hypot(x - 160, y - 165) <= 126) { dragStage = true; lastMouse = [x, y]; return; }
    if (y >= 44 && y <= 76 && x >= 314 && x <= 495) { const idx = Math.floor((x - 316) / 58); if (idx >= 0 && idx < 3) { mag = [40, 100, 400][idx]; sfx.click(); draw(); } return; }
    if (y >= 100 && y <= 128 && x >= 314 && x <= 495) {
      const bi = Math.floor((x - 316) / 44);
      if (bi === 0) sx = clamp(sx - 10, -65, 65);
      else if (bi === 1) sx = clamp(sx + 10, -65, 65);
      else if (bi === 2) sy = clamp(sy - 10, -65, 65);
      else sy = clamp(sy + 10, -65, 65);
      sfx.dial(); draw(); return;
    }
    if (y >= 150 && y <= 180 && x >= 314 && x <= 495) { focus = clamp((x - 316) / 174, 0.05, 0.95); sfx.dial(); draw(); return; }
    if (y >= 200 && y <= 230 && x >= 314 && x <= 495) { iris = clamp((x - 316) / 174, 0.05, 0.95); sfx.dial(); draw(); return; }
    if (y >= 240 && x >= 314) confirmSlide();
  });
  c.addEventListener('mousemove', e => {
    if (!dragStage) return;
    const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width, y = (e.clientY - rc.top) * c.height / rc.height;
    sx = clamp(sx + (x - lastMouse[0]), -65, 65);
    sy = clamp(sy + (y - lastMouse[1]), -65, 65);
    lastMouse = [x, y]; draw();
  });
  const mu = () => { dragStage = false; };
  addEventListener('mouseup', mu); cleanups.push(() => removeEventListener('mouseup', mu));

  keys(e => {
    if (e.type !== 'keydown') return;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') { sx = clamp(sx - 10, -65, 65); sfx.dial(); draw(); }
    else if (e.code === 'KeyD' || e.code === 'ArrowRight') { sx = clamp(sx + 10, -65, 65); sfx.dial(); draw(); }
    else if (e.code === 'KeyW' || e.code === 'ArrowUp') { sy = clamp(sy - 10, -65, 65); sfx.dial(); draw(); }
    else if (e.code === 'KeyS' || e.code === 'ArrowDown') { sy = clamp(sy + 10, -65, 65); sfx.dial(); draw(); }
    else if (e.code === 'KeyQ') { focus = clamp(focus - 0.07, 0.05, 0.95); sfx.dial(); draw(); }
    else if (e.code === 'KeyE') { focus = clamp(focus + 0.07, 0.05, 0.95); sfx.dial(); draw(); }
    else if (e.code === 'KeyZ') { iris = clamp(iris - 0.08, 0.05, 0.95); sfx.dial(); draw(); }
    else if (e.code === 'KeyC') { iris = clamp(iris + 0.08, 0.05, 0.95); sfx.dial(); draw(); }
    else if (e.code === 'Digit3') { mag = 400; sfx.click(); draw(); }
    else if (e.code === 'Space' || e.code === 'Enter') confirmSlide();
  });
  draw(); return p;
}

function spotdiff(opts = {}) {
  const t = String(opts.title || '');
  if (/학생회|교장|회의|인쇄|행정|서무/.test(t)) return stampApprove({ title: t.replace('두 장의 같은 기록', '1998 해교제 야간 잔류 승인원 검수') });
  if (/도서|열람|창고|보관|문서|아카이브/.test(t)) return libraryCatalog({ title: t.replace('두 장의 같은 기록', 'KDC 청구기호 도서 대출 카드 배열') });
  if (/방송|어학|언어|시청각|음악|합주/.test(t)) return cassetteSplice({ title: t.replace('두 장의 같은 기록', '1998 하교 방송 카세트테이프 필름 접합') });
  if (/과학|생물|화학|보건|요리|급식|가정/.test(t)) return microscopeSlide({ title: t.replace('두 장의 같은 기록', '광학 현미경 프레파라트 표본 판독') });
  if (/동아리|미술|공예|창의|융합|진로|학급/.test(t)) return timetableRestore({ title: t.replace('두 장의 같은 기록', '1998.10.12 학급 시간표 & 당번 자석 복원') });
  return omrGrade({ title: t.replace('두 장의 같은 기록', '1998학년도 기말고사 OMR 답안지 판독') });
}
/* ---------- 17. 퓨즈판 (모두 켜기) ---------- */
// 퓨즈를 누르면 자기와 상하좌우 퓨즈가 함께 뒤집힌다. 정해진 횟수 안에 전부 켜면 전력 복구. 오래 끌면 과열(스파크)
function fuse({ title = '퓨즈판 — 모든 회로를 켜라', N = Math.random() < .4 ? 5 : 4, extra = 6 } = {}) {
  const on = Array.from({ length: N }, () => Array(N).fill(true));
  const flip = (y, x) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dy, dx]) => { const a = y + dy, b = x + dx; if (a >= 0 && a < N && b >= 0 && b < N) on[a][b] = !on[a][b]; });
  const par = 5 + ((Math.random() * 3) | 0); for (let k = 0; k < par; k++) flip((Math.random() * N) | 0, (Math.random() * N) | 0);
  if (on.flat().every(Boolean)) flip(1, 1);
  const max = par + extra; let used = 0, won = false;
  const p = open(title, `퓨즈를 클릭하면 <b>자기와 상하좌우</b>가 함께 뒤집힌다 — <b>${max}</b>번 안에 ${N * N}개를 모두 켜라`);
  const S = 70, c = canvas(N * S + 40, N * S + 50), g = c.getContext('2d');
  const draw = () => {
    g.fillStyle = '#121416'; g.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const px = 20 + x * S, py = 20 + y * S;
      g.fillStyle = '#23272b'; g.fillRect(px + 4, py + 4, S - 8, S - 8); g.fillStyle = on[y][x] ? '#7aff9a' : '#3a1414'; g.shadowColor = on[y][x] ? '#7aff9a' : 'transparent'; g.shadowBlur = on[y][x] ? 14 : 0;
      g.fillRect(px + 18, py + 14, S - 36, S - 28); g.shadowBlur = 0; g.fillStyle = '#b8b0a0'; g.fillRect(px + 26, py + 8, S - 52, 6); g.fillRect(px + 26, py + S - 14, S - 52, 6); }
    g.fillStyle = '#c8c0a8'; g.font = '12px sans-serif'; g.fillText(`남은 조작 ${max - used}`, 20, N * S + 40);
  };
  const doFlip = (y, x) => { if (won || !finish) return;
    if (x < 0 || x >= N || y < 0 || y >= N) return; flip(y, x); used++; sfx.click(); draw(); status(`남은 조작 ${max - used}`);
    if (on.flat().every(Boolean)) { won = true; sfx.fuse ? sfx.fuse() : 0; setTimeout(() => close(true), 450); }
    else if (used >= max) { sfx.spark ? sfx.spark() : sfx.buzz(); status('퓨즈가 과열됐다 — 스파크!', 'err'); setTimeout(() => finish && close(false), 700); } };
  c.addEventListener('click', e => { const rc = c.getBoundingClientRect(); doFlip(((e.clientY - rc.top) * c.height / rc.height - 20) / S | 0, ((e.clientX - rc.left) * c.width / rc.width - 20) / S | 0); });
  // 3D 분전반: 강철 패널 · 도자기 퓨즈 홀더 N×N · 유리관 퓨즈(켜지면 초록 필라멘트 발광 · 꺼지면 검붉게 탄 자국) — 클릭하면 레버처럼 눌렸다 올라온다
  (() => { let r; try { r = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { return; }
    r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(420, 320); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.domElement.className = 'mgCanvas'; r.domElement.dataset.own3d = '1'; $('mgBody').insertBefore(r.domElement, c); c.style.display = 'none'; c.dataset.st = '1';
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0a0c0d); const cam = new THREE.PerspectiveCamera(32, 420 / 320, .05, 20); cam.position.set(.15, .1, 2.75); cam.lookAt(0, 0, 0);
    sc.add(new THREE.HemisphereLight(0xd8e4ff, 0x101010, .45)); const L = new THREE.SpotLight(0xfff0dc, 14, 6, .6, .5, 1.4); L.position.set(.8, 1.2, 1.6); sc.add(L, L.target);
    const steel = new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: .45, metalness: .8 }), cer = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: .4 }), cap = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 1, roughness: .25 });
    const span = 1.3, cs = span / N; const pnl = new THREE.Mesh(new THREE.BoxGeometry(span + .25, span + .25, .06), steel); pnl.position.z = -.05; sc.add(pnl);
    const cells = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const gx = -span / 2 + (x + .5) * cs, gy = span / 2 - (y + .5) * cs, grp = new THREE.Group(); grp.position.set(gx, gy, 0); sc.add(grp);
      const hold = new THREE.Mesh(new THREE.BoxGeometry(cs * .78, cs * .78, .05), cer); grp.add(hold);
      const glassM = new THREE.MeshStandardMaterial({ color: 0x9ad8a8, emissive: 0x30ff60, emissiveIntensity: 1, transparent: true, opacity: .85, roughness: .1 });
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(cs * .13, cs * .13, cs * .5, 16), glassM); tube.rotation.z = Math.PI / 2; tube.position.z = .05; grp.add(tube);
      [-1, 1].forEach(sd => { const cp = new THREE.Mesh(new THREE.CylinderGeometry(cs * .15, cs * .15, cs * .08, 16), cap); cp.rotation.z = Math.PI / 2; cp.position.set(sd * cs * .27, 0, .05); grp.add(cp); });
      hold.userData = tube.userData = { y, x }; cells.push({ grp, tube, glassM, y, x, push: 0 }); }
    const rc = new THREE.Raycaster(), mv = new THREE.Vector2();
    r.domElement.addEventListener('mousedown', e => { const b = r.domElement.getBoundingClientRect(); mv.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); rc.setFromCamera(mv, cam); const h = rc.intersectObjects(cells.map(o => o.grp), true)[0]; if (!h) return; const u = h.object.userData; cells.find(o => o.y === u.y && o.x === u.x).push = 1; doFlip(u.y, u.x); });
    const lp = () => { if (!MG.active) { r.dispose(); r.forceContextLoss && r.forceContextLoss(); return; } cells.forEach(o => { const lit = on[o.y][o.x]; o.glassM.color.setHex(lit ? 0x9ad8a8 : 0x3a1a14); o.glassM.emissive.setHex(lit ? 0x30ff60 : 0x200400); o.glassM.emissiveIntensity = lit ? .9 + Math.sin(performance.now() / 200 + o.x) * .1 : .4; o.push = Math.max(0, o.push - .08); o.grp.position.z = -o.push * .04; });
      r.render(sc, cam); requestAnimationFrame(lp); }; requestAnimationFrame(lp); })();
  keys(() => {}); draw();
  return p;
}


/* ---------- 18. 오실로스코프 파형 동조 (주파수 · 진폭 · 위상 3축 동조) ---------- */
function oscilloscope({ title = '오실로스코프 — 주파수·진폭·위상 파형 동조' } = {}) {
  const p = open(title, '하단 <b>3개의 로터리 다이얼(FREQ 주파수[A·D] · AMP 진폭[W·S] · PHASE 위상[Q·E])</b>을 마우스 드래그/휠 또는 키보드로 조절해<br>초록 점선 파형에 내 파형을 겹쳐 <b>동조율 86% 이상</b>을 유지하거나 <b>[Space]</b>를 눌러라');
  const c = canvas(480, 310), g = c.getContext('2d');
  const tf = 1.6 + Math.random() * 2.2, ta = 42 + Math.random() * 44, tp = Math.random() * 5.2;
  let uf = 2.5, ua = 60, up = 0, hold = 0, lastT = performance.now(), dn = {}, dragDial = -1;
  screen3D(c, { kind: 'scope', knobs: () => [(uf - .8) / 4, (ua - 18) / 80, up / (Math.PI * 2)] });

  c.addEventListener('mousedown', e => {
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) * c.width / r.width, y = (e.clientY - r.top) * c.height / r.height;
    if (y >= 205) {
      if (x < 160) dragDial = 0;
      else if (x < 320) dragDial = 1;
      else dragDial = 2;
    }
  });
  c.addEventListener('mousemove', e => {
    if (dragDial < 0) return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) * c.width / r.width;
    if (dragDial === 0) uf = clamp(.8 + ((x - 10) / 140) * 4.0, .8, 4.8);
    else if (dragDial === 1) ua = clamp(18 + ((x - 170) / 140) * 80, 18, 98);
    else up = clamp(((x - 330) / 140) * Math.PI * 2, 0, Math.PI * 2);
  });
  const mu = () => { dragDial = -1; };
  addEventListener('mouseup', mu); cleanups.push(() => removeEventListener('mouseup', mu));
  c.addEventListener('wheel', e => {
    e.preventDefault();
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) * c.width / r.width, d = e.deltaY < 0 ? 1 : -1;
    if (x < 160) uf = clamp(uf + d * .15, .8, 4.8);
    else if (x < 320) ua = clamp(ua + d * 4, 18, 98);
    else up = (up + d * .25 + Math.PI * 2) % (Math.PI * 2);
    sfx.dial ? sfx.dial() : sfx.click();
  }, { passive: false });

  keys(e => {
    dn[e.code] = e.type === 'keydown';
    if (e.type === 'keydown') sfx.dial ? sfx.dial() : sfx.click();
  });

  const loop = now => {
    const dt = Math.min(.08, (now - lastT) / 1000); lastT = now;
    if (dn.KeyA || dn.ArrowLeft) uf = clamp(uf - 1.3 * dt, .8, 4.8);
    if (dn.KeyD || dn.ArrowRight) uf = clamp(uf + 1.3 * dt, .8, 4.8);
    if (dn.KeyW || dn.ArrowUp) ua = clamp(ua + 55 * dt, 18, 98);
    if (dn.KeyS || dn.ArrowDown) ua = clamp(ua - 55 * dt, 18, 98);
    if (dn.KeyQ) up = (up - 2.4 * dt + Math.PI * 2) % (Math.PI * 2);
    if (dn.KeyE) up = (up + 2.4 * dt) % (Math.PI * 2);

    const df = Math.abs(uf - tf) / 3.0, da = Math.abs(ua - ta) / 70;
    let dp = Math.abs(up - tp) % (Math.PI * 2); if (dp > Math.PI) dp = Math.PI * 2 - dp; dp /= Math.PI;
    const sync = clamp(1 - (df * .48 + da * .32 + dp * .20), 0, 1);

    if (sync >= .86) {
      hold += dt;
      if (Math.random() < dt * 7) sfx.beep ? sfx.beep() : sfx.click();
      if ((hold >= 1.0 || dn.Space) && finish) { sfx.unlock(); close(true); return; }
    } else hold = Math.max(0, hold - dt * .5);

    g.fillStyle = '#07110d'; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = 'rgba(60,140,95,.22)'; g.lineWidth = 1;
    for (let x = 0; x <= 480; x += 30) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 200); g.stroke(); }
    for (let y = 0; y <= 200; y += 25) { g.beginPath(); g.moveTo(0, y); g.lineTo(480, y); g.stroke(); }

    const cy = 100, phShift = now * .004;
    g.save(); g.setLineDash([6, 5]); g.strokeStyle = 'rgba(90,255,150,.65)'; g.lineWidth = 2.4;
    g.beginPath();
    for (let x = 0; x <= 480; x += 3) {
      const y = cy + Math.sin((x / 480) * Math.PI * 2 * tf + tp + phShift) * ta * .88;
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke(); g.restore();

    g.strokeStyle = sync >= .86 ? '#70ffaa' : '#ffd060'; g.lineWidth = 2.8;
    g.shadowColor = g.strokeStyle; g.shadowBlur = sync >= .86 ? 12 : 4;
    g.beginPath();
    for (let x = 0; x <= 480; x += 3) {
      const y = cy + Math.sin((x / 480) * Math.PI * 2 * uf + up + phShift) * ua * .88;
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke(); g.shadowBlur = 0;

    // 하단 3노브 계기판 패널
    g.fillStyle = '#12181a'; g.fillRect(0, 202, 480, 108);
    const dials = [
      [80, (uf - .8) / 4.0, df < .08, `FREQ: ${(uf * 24.5).toFixed(1)}Hz [A/D]`],
      [240, (ua - 18) / 80, da < .08, `AMP: ${ua.toFixed(0)}mV [W/S]`],
      [400, up / (Math.PI * 2), dp < .10, `PHASE: ${((up * 180 / Math.PI) | 0)}° [Q/E]`]
    ];
    dials.forEach(([cx, norm, ok, lbl]) => {
      g.fillStyle = '#1c262a'; g.beginPath(); g.arc(cx, 236, 22, 0, 7); g.fill();
      g.strokeStyle = ok ? '#58ff9a' : '#687c84'; g.lineWidth = 2.5; g.stroke();
      const a = -Math.PI * .75 + norm * Math.PI * 1.5;
      g.strokeStyle = '#ffffff'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(cx, 236); g.lineTo(cx + Math.cos(a) * 18, 236 + Math.sin(a) * 18); g.stroke();
      g.fillStyle = ok ? '#68ffa8' : '#d8e4dc'; g.font = 'bold 11.5px monospace'; g.textAlign = 'center';
      g.fillText(lbl, cx, 274); g.textAlign = 'left';
    });

    g.fillStyle = '#22302a'; g.fillRect(14, 284, 310, 18);
    g.fillStyle = sync >= .86 ? '#48ff90' : '#e0a838';
    g.fillRect(14, 284, 310 * clamp(sync, 0, 1), 18);
    g.fillStyle = '#ffffff'; g.font = '12px sans-serif';
    g.fillText(`파형 동조율 ${(sync * 100).toFixed(0)}% · 잠금 ${Math.min(100, (hold * 100)) | 0}%`, 334, 297);
    status(sync >= .86 ? '공명 주파수 포착! 그대로 유지하세요…' : '노브를 드래그(또는 A/D, W/S, Q/E)해 두 파형을 겹치세요');
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return p;
}

/* ---------- 19. 화학 시약 적정 & 중화 반응 (과학실 / 수질관리실) ---------- */
function chemMix({ title = '실험대 — 시약 중화 적정 (목표 pH 7.2)' } = {}) {
  const p = open(title, '<b>1번(산성 적정액)</b> · <b>2번(염기성 시약)</b> · <b>3번(완충 냉각액)</b> 버튼 클릭 또는 키 입력<br>pH를 <b>7.0 ~ 7.4</b>, 온도를 <b>40°C 이하</b>로 맞춘 뒤 <b>Space(교반 결정화)</b>를 눌러라');
  const c = canvas(460, 300), g = c.getContext('2d');
  let ph = 4.2 + (Math.random() < .5 ? -.8 : 4.4), temp = 28, stir = 0, drops = [], lastT = performance.now();
  const addReagent = kind => {
    if (!finish) return;
    sfx.drip ? sfx.drip() : sfx.click();
    if (kind === 1) { ph = clamp(ph - .65, 1.5, 13.5); temp = clamp(temp + 6.5, 18, 95); drops.push({ x: 150, y: 55, c: '#ff5a5a' }); }
    else if (kind === 2) { ph = clamp(ph + .55, 1.5, 13.5); temp = clamp(temp + 5.5, 18, 95); drops.push({ x: 230, y: 55, c: '#5a9eff' }); }
    else if (kind === 3) { ph = clamp(ph + (7.2 - ph) * .22, 1.5, 13.5); temp = clamp(temp - 14, 18, 95); drops.push({ x: 310, y: 55, c: '#60ffb0' }); }
  };
  const tryStir = () => {
    if (!finish) return;
    sfx.splash ? sfx.splash() : sfx.click();
    stir = 1.0;
    if (ph >= 6.95 && ph <= 7.45 && temp <= 42) {
      status('중화 적정 완료 — 순백색 결정이 석출되었다!', 'ok');
      sfx.unlock(); setTimeout(() => close(true), 450);
    } else if (temp > 75) {
      sfx.buzz(); status('과열 반응! 완충 냉각액(3번)으로 온도를 먼저 낮춰야 한다', 'err');
    } else {
      status(`현재 pH ${ph.toFixed(2)} — 목표 중성 범위(7.0~7.4)에 맞춘 뒤 교반하세요`, 'err');
    }
  };
  c.addEventListener('click', e => {
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) * c.width / r.width, y = (e.clientY - r.top) * c.height / r.height;
    if (y > 235) {
      if (x < 145) addReagent(1);
      else if (x < 285) addReagent(2);
      else if (x < 395) addReagent(3);
      else tryStir();
    } else {
      if (x < 185) addReagent(1);
      else if (x < 275) addReagent(2);
      else addReagent(3);
    }
  });
  keys(e => {
    if (e.type !== 'keydown') return;
    if (e.code === 'Digit1' || e.code === 'KeyA') addReagent(1);
    else if (e.code === 'Digit2' || e.code === 'KeyS') addReagent(2);
    else if (e.code === 'Digit3' || e.code === 'KeyD') addReagent(3);
    else if (e.code === 'Space' || e.code === 'Enter') tryStir();
  });
  const loop = now => {
    const dt = Math.min(.08, (now - lastT) / 1000); lastT = now;
    temp = Math.max(20, temp - dt * 2.2); stir = Math.max(0, stir - dt * 2.5);
    g.fillStyle = '#0c1014'; g.fillRect(0, 0, c.width, c.height);
    // 뷰렛 3개
    [[150, '#ff5a5a', '1: 산성(-0.65)'], [230, '#5a9eff', '2: 염기(+0.55)'], [310, '#60ffb0', '3: 완충·냉각']].forEach(([bx, col, lb]) => {
      g.fillStyle = '#283038'; g.fillRect(bx - 10, 12, 20, 42);
      g.fillStyle = col; g.fillRect(bx - 6, 18, 12, 32);
      g.fillStyle = '#b8c4cc'; g.font = '11px sans-serif'; g.fillText(lb, bx - 36, 10);
    });
    // 비커 & 용액 색상 (산성=붉은빛, 중성=에메랄드 초록, 염기=푸른보라)
    const liqCol = ph < 6.95 ? `rgba(240,${Math.floor(80 + ph * 18)},90,0.78)` : ph <= 7.45 ? 'rgba(75,235,155,0.82)' : `rgba(95,130,250,0.78)`;
    g.strokeStyle = '#90a4b0'; g.lineWidth = 3; g.strokeRect(125, 75, 210, 140);
    const wave = Math.sin(now * .008) * (2 + stir * 8);
    g.fillStyle = liqCol; g.fillRect(128, 115 + wave * .3, 204, 97 - wave * .3);
    // 떨어지는 시약 방울
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]; d.y += 220 * dt;
      g.fillStyle = d.c; g.beginPath(); g.arc(d.x, d.y, 5, 0, 7); g.fill();
      if (d.y >= 115) drops.splice(i, 1);
    }
    // 우측 계기판 (pH / 온도)
    const okPh = ph >= 6.95 && ph <= 7.45, okT = temp <= 42;
    g.fillStyle = '#161c22'; g.fillRect(352, 75, 96, 140);
    g.fillStyle = okPh ? '#60ffa8' : '#ffd060'; g.font = 'bold 18px monospace';
    g.fillText(`pH ${ph.toFixed(2)}`, 362, 108);
    g.fillStyle = '#9ab0bc'; g.font = '11px sans-serif'; g.fillText('목표: 7.0 ~ 7.4', 362, 126);
    g.fillStyle = okT ? '#80d8ff' : '#ff6060'; g.font = 'bold 16px monospace';
    g.fillText(`${temp.toFixed(0)} °C`, 362, 166);
    g.fillStyle = '#9ab0bc'; g.font = '11px sans-serif'; g.fillText('안전: 42°C 이하', 362, 184);

    // 하단 조작 버튼
    const btns = [[12, 128, '#4a2024', '[1] 산성 시약'], [148, 128, '#203252', '[2] 염기 시약'], [284, 106, '#1e4638', '[3] 완충·냉각'], [396, 54, okPh && okT ? '#2a8a50' : '#384048', '교반']];
    btns.forEach(([x, w, bg, t]) => {
      g.fillStyle = bg; g.fillRect(x, 238, w, 46);
      g.strokeStyle = '#607080'; g.lineWidth = 1.5; g.strokeRect(x, 238, w, 46);
      g.fillStyle = '#f0f4f8'; g.font = 'bold 12px sans-serif'; g.fillText(t, x + 10, 266);
    });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  // 3D 실험대: 철제 스탠드에 매달린 유리 뷰렛 3개(산·염기·완충), 가운데 비커 용액이 pH 따라 색이 변하고 교반 막대가 돈다. 디지털 pH·온도계, 빨간 교반 버튼.
  //   뷰렛/버튼을 클릭하면 같은 시약 투입·교반. 방울은 실제로 떨어진다.
  (() => { let r; try { r = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { return; }
    r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(460, 300); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.domElement.className = 'mgCanvas'; r.domElement.dataset.own3d = '1'; c.dataset.st = '1'; c.parentNode.insertBefore(r.domElement, c); c.style.display = 'none';
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0d1014); const cam = new THREE.PerspectiveCamera(34, 460 / 300, .05, 20); cam.position.set(0, .75, 2.3); cam.lookAt(0, .42, 0);
    sc.add(new THREE.HemisphereLight(0xeef4ff, 0x14100c, .65)); const L = new THREE.SpotLight(0xffffff, 18, 7, .7, .5, 1.3); L.position.set(.6, 2.2, 1.6); sc.add(L, L.target);
    const M = (c3, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c3, roughness: .5 }, o)), glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .22, roughness: .05, side: THREE.DoubleSide, depthWrite: false });
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, .06, 1.1), M(0x1c2a24, { roughness: .35 })); top.position.y = -.03; sc.add(top);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 1.3, 10), M(0xb0b4b8, { metalness: .9, roughness: .25 })); rod.position.set(0, .65, -.32); sc.add(rod);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.01, .01, 1.0, 8), rod.material); bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.12, -.32); sc.add(bar);
    const cols = [0xff5a5a, 0x5a9eff, 0x60ffb0], XS = [-.34, 0, .34], burs = XS.map((x, k) => { const g2 = new THREE.Group(); g2.position.set(x, .62, -.12);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .62, 16, 1, true), glass); tube.position.y = .2; g2.add(tube);
      const liq = new THREE.Mesh(new THREE.CylinderGeometry(.026, .026, .5, 16), new THREE.MeshStandardMaterial({ color: cols[k], transparent: true, opacity: .8, emissive: cols[k], emissiveIntensity: .25 })); liq.position.y = .16; g2.add(liq);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(.018, .09, 12), glass); tip.rotation.x = Math.PI; tip.position.y = -.15; g2.add(tip);
      const cock = new THREE.Mesh(new THREE.BoxGeometry(.08, .016, .016), M(0x202020)); cock.position.y = -.09; g2.add(cock);
      const clamp3 = new THREE.Mesh(new THREE.BoxGeometry(.03, .03, .22), rod.material); clamp3.position.set(0, .48, -.1); g2.add(clamp3);
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .8, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .15; hit.userData.k = k + 1; g2.add(hit);
      sc.add(g2); return { g2, liq, cock, hit }; });
    const bk = new THREE.Mesh(new THREE.CylinderGeometry(.24, .22, .36, 32, 1, true), glass); bk.position.set(0, .18, 0); sc.add(bk);
    const bkBot = new THREE.Mesh(new THREE.CircleGeometry(.22, 32), glass); bkBot.rotation.x = -Math.PI / 2; bkBot.position.set(0, .005, 0); sc.add(bkBot);
    const liqM = new THREE.MeshStandardMaterial({ color: 0xff7060, transparent: true, opacity: .8, roughness: .1 }); const liq = new THREE.Mesh(new THREE.CylinderGeometry(.225, .215, .22, 32), liqM); liq.position.set(0, .115, 0); sc.add(liq);
    const surf = new THREE.Mesh(new THREE.CircleGeometry(.225, 32), liqM); surf.rotation.x = -Math.PI / 2; surf.position.set(0, .226, 0); sc.add(surf);
    const stirB = new THREE.Mesh(new THREE.CapsuleGeometry(.012, .12, 4, 8), M(0xf4f4f4)); stirB.rotation.z = Math.PI / 2; stirB.position.set(0, .02, 0); sc.add(stirB);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(.6, .02, .5), M(0xd8d8d0)); plate.position.set(0, -.0, 0); sc.add(plate);
    const meter = new THREE.Mesh(new THREE.BoxGeometry(.42, .3, .1), M(0x2a3036)); meter.position.set(.82, .2, 0); meter.rotation.y = -.35; sc.add(meter);
    const mc = document.createElement('canvas'); mc.width = 256; mc.height = 160; const mg2 = mc.getContext('2d'); const mt = new THREE.CanvasTexture(mc); mt.colorSpace = THREE.SRGBColorSpace;
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(.36, .225), new THREE.MeshBasicMaterial({ map: mt })); disp.position.set(0, 0, .051); meter.add(disp);
    const probe = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .5, 8), M(0x404040)); probe.position.set(.15, .35, .05); probe.rotation.z = -.2; sc.add(probe);
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .05, 24), M(0xc81e1e, { emissive: 0x300000 })); btn.position.set(-.82, .03, .15); btn.userData.stir = true; sc.add(btn);
    const btnB = new THREE.Mesh(new THREE.BoxGeometry(.24, .04, .24), M(0x30343a)); btnB.position.set(-.82, .0, .15); sc.add(btnB);
    const lc = document.createElement('canvas'); lc.width = 128; lc.height = 32; const lg = lc.getContext('2d'); lg.fillStyle = '#fff'; lg.font = 'bold 22px sans-serif'; lg.textAlign = 'center'; lg.fillText('교반', 64, 24); const lt = new THREE.CanvasTexture(lc);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(.2, .05), new THREE.MeshBasicMaterial({ map: lt, transparent: true })); lab.rotation.x = -Math.PI / 2; lab.position.set(-.82, .03, .32); sc.add(lab);
    const dropsG = []; let lastDrops = 0;
    const rc = new THREE.Raycaster(), mv = new THREE.Vector2();
    r.domElement.addEventListener('mousedown', e => { const b = r.domElement.getBoundingClientRect(); mv.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); rc.setFromCamera(mv, cam); const h = rc.intersectObjects([btn, ...burs.map(o => o.hit)])[0]; if (!h) return; if (h.object.userData.stir) tryStir(); else addReagent(h.object.userData.k); });
    let lastTxt = '', sp = 0;
    const lp = () => { if (!MG.active) { r.dispose(); r.forceContextLoss && r.forceContextLoss(); return; }
      if (drops.length > lastDrops) { const d = drops[drops.length - 1], k = d.x < 190 ? 0 : d.x < 270 ? 1 : 2; const m = new THREE.Mesh(new THREE.SphereGeometry(.014, 8, 6), new THREE.MeshBasicMaterial({ color: cols[k] })); m.position.set(XS[k], .44, -.12); m.userData.v = 0; m.userData.tx = XS[k] * .3; sc.add(m); dropsG.push(m); burs[k].cock.rotation.y = 1.2; burs[k].liq.scale.y = Math.max(.2, burs[k].liq.scale.y - .02); burs[k].liq.position.y = .16 - (1 - burs[k].liq.scale.y) * .25; }
      lastDrops = drops.length;
      for (let i = dropsG.length - 1; i >= 0; i--) { const m = dropsG[i]; m.userData.v += .004; m.position.y -= m.userData.v; m.position.z += (0 - m.position.z) * .08; m.position.x += (m.userData.tx - m.position.x) * .08; if (m.position.y < .23) { sc.remove(m); dropsG.splice(i, 1); } }
      burs.forEach(o => { o.cock.rotation.y *= .9; });
      const okPh = ph >= 6.95 && ph <= 7.45; liqM.color.setHex(ph < 6.95 ? 0xf06048 : okPh ? 0x4beb9b : 0x5f82fa); liqM.emissive = liqM.color.clone().multiplyScalar(.15);
      sp += .05 + stir * .6; stirB.rotation.y = sp; surf.position.y = .226 + Math.sin(performance.now() / 120) * .004 * (1 + stir * 4);
      const txt = ph.toFixed(2) + '|' + temp.toFixed(0); if (txt !== lastTxt) { lastTxt = txt; mg2.fillStyle = '#0a140e'; mg2.fillRect(0, 0, 256, 160); mg2.font = 'bold 50px monospace'; mg2.fillStyle = okPh ? '#60ffa8' : '#ffd060'; mg2.fillText('pH ' + ph.toFixed(2), 14, 64); mg2.font = 'bold 40px monospace'; mg2.fillStyle = temp <= 42 ? '#80d8ff' : '#ff6060'; mg2.fillText(temp.toFixed(0) + ' °C', 14, 130); mg2.font = '18px sans-serif'; mg2.fillStyle = '#8aa'; mg2.fillText('7.0~7.4 · ≤42°C', 120, 150); mt.needsUpdate = true; }
      btn.material.emissive.setHex(okPh && temp <= 42 ? 0x40ff60 : 0x300000); btn.position.y = .03 - stir * .015; r.render(sc, cam); requestAnimationFrame(lp); }; requestAnimationFrame(lp); })();
  return p;
}

/* ---------- 20. 물리 포물선 농구 자유투 (각도 조준 + 파워 차징 + 림/백보드 탄성 물리) ---------- */
function hoopShot({ title = '체육관 코트 — 물리 궤적 자유투 (3골 성공)' } = {}) {
  const p = open(title, '마우스 위·아래(또는 <b>W · S</b>)로 발사 각도 조준 · <b>마우스 버튼 / Space</b>를 누르고 있다가 떼면 슛!<br>백보드 반동을 이용하거나 클린샷으로 <b>3골</b>을 성공시켜라');
  const c = canvas(480, 300), g = c.getContext('2d');
  let ang = 54 * Math.PI / 180, pwr = 0, charging = false, dir = 1, goals = 0, shots = 0;
  let ball = null, rimX = 392, rimY = 118, rimR = 22, boardX = 420, lastT = performance.now();

  const shoot = () => {
    if (ball || !finish) return;
    charging = false;
    const v = 340 + pwr * 280;
    ball = { x: 74, y: 220, vx: Math.cos(ang) * v, vy: -Math.sin(ang) * v, r: 13, scored: false, RimHit: false };
    sfx.throwIt ? sfx.throwIt() : sfx.click();
  };
  c.addEventListener('mousemove', e => {
    if (ball) return;
    const r = c.getBoundingClientRect(), ny = (e.clientY - r.top) / r.height;
    ang = clamp((.85 - ny * .65) * Math.PI * .5, 32 * Math.PI / 180, 76 * Math.PI / 180);
  });
  c.addEventListener('mousedown', () => { if (!ball) { charging = true; pwr = .15; } });
  const mu = () => { if (charging) shoot(); };
  addEventListener('mouseup', mu); cleanups.push(() => removeEventListener('mouseup', mu));
  keys(e => {
    const dn = e.type === 'keydown';
    if (dn && (e.code === 'KeyW' || e.code === 'ArrowUp')) ang = clamp(ang + .04, .55, 1.32);
    if (dn && (e.code === 'KeyS' || e.code === 'ArrowDown')) ang = clamp(ang - .04, .55, 1.32);
    if (e.code === 'Space') {
      if (dn && !ball && !charging) { charging = true; pwr = .15; }
      else if (!dn && charging) shoot();
    }
  });
  const loop = now => {
    const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
    if (charging && !ball) {
      pwr += dir * dt * 1.25;
      if (pwr >= 1) { pwr = 1; dir = -1; } else if (pwr <= .1) { pwr = .1; dir = 1; }
    }
    if (ball) {
      const prevY = ball.y;
      ball.vy += 560 * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      // 백보드 반사
      if (ball.x + ball.r > boardX && ball.x - ball.r < boardX + 10 && ball.y > 54 && ball.y < 132 && ball.vx > 0) {
        ball.x = boardX - ball.r; ball.vx = -ball.vx * .62; sfx.ball ? sfx.ball() : sfx.click();
      }
      // 앞뒤 림 엣지 탄성 충돌
      for (const rx of [rimX - rimR, rimX + rimR]) {
        const dx = ball.x - rx, dy = ball.y - rimY, d = Math.hypot(dx, dy);
        if (d < ball.r + 4) {
          const nx = dx / (d || 1), ny = dy / (d || 1);
          ball.x = rx + nx * (ball.r + 4.5); ball.y = rimY + ny * (ball.r + 4.5);
          const dot = ball.vx * nx + ball.vy * ny;
          if (dot < 0) { ball.vx = (ball.vx - 1.65 * dot * nx) * .72; ball.vy = (ball.vy - 1.65 * dot * ny) * .72; sfx.ball ? sfx.ball() : sfx.click(); }
        }
      }
      // 골인 판정 (림 위에서 아래로 통과)
      if (!ball.scored && prevY <= rimY && ball.y > rimY && ball.vy > 0 && Math.abs(ball.x - rimX) < rimR - 4) {
        ball.scored = true; goals++; shots++;
        sfx.win ? sfx.win() : sfx.unlock();
        status(`나이스 슛! (${goals} / 3골 성공)`, 'ok');
        if (goals >= 3 && finish) { setTimeout(() => close(true), 450); return; }
      }
      if (ball.y > 290 || ball.x > 490 || ball.x < 0) {
        if (!ball.scored) { shots++; sfx.ball ? sfx.ball() : sfx.buzz(); status(`아깝다! 각도와 파워를 조절해 보세요 (성공 ${goals}/3)`, ''); }
        ball = null; pwr = 0;
      }
    }

    g.fillStyle = '#12151c'; g.fillRect(0, 0, c.width, c.height);
    // 체육관 마룻바닥
    g.fillStyle = '#4a321e'; g.fillRect(0, 255, 480, 45);
    // 예상 포물선 가이드 (절반까지만 표시)
    if (!ball) {
      const v0 = 340 + (charging ? pwr : .55) * 280;
      g.fillStyle = 'rgba(255,215,110,.55)';
      for (let i = 1; i <= 11; i++) {
        const tt = i * .055, gx = 74 + Math.cos(ang) * v0 * tt, gy = 220 - Math.sin(ang) * v0 * tt + .5 * 560 * tt * tt;
        g.beginPath(); g.arc(gx, gy, 2.5, 0, 7); g.fill();
      }
    }
    // 백보드 · 림 · 그물
    g.fillStyle = '#d8dee4'; g.fillRect(boardX, 54, 8, 78);
    g.fillStyle = '#d83828'; g.fillRect(rimX - rimR, rimY - 3, rimR * 2 + 8, 6);
    g.strokeStyle = 'rgba(230,230,220,.55)'; g.lineWidth = 1.5;
    for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(rimX + k * 6, rimY + 3); g.lineTo(rimX + k * 4, rimY + 34); g.stroke(); }

    // 농구공
    const bx = ball ? ball.x : 74, by = ball ? ball.y : 220;
    g.fillStyle = '#d86224'; g.beginPath(); g.arc(bx, by, 13, 0, 7); g.fill();
    g.strokeStyle = '#2a1408'; g.lineWidth = 1.5; g.stroke();

    // 좌측 파워 게이지 & 점수
    g.fillStyle = '#222830'; g.fillRect(18, 80, 16, 150);
    g.fillStyle = '#58ff98'; g.fillRect(18, 230 - 150 * pwr, 16, 150 * pwr);
    g.fillStyle = '#e8e0d0'; g.font = 'bold 14px sans-serif';
    g.fillText(`성공: ${goals} / 3골   |   발사각: ${(ang * 180 / Math.PI).toFixed(0)}°`, 16, 30);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  // 3D 체육관 코트 (옆에서 본 시점): 마루 · 3점 라인, 유리 백보드 · 주황 림 · 그물, 실제 공이 2D 물리 좌표(1px=1cm)를 그대로 따라 난다.
  //   조준 점선 · 파워 게이지 · 점수판도 3D. 마우스 입력은 숨긴 원래 캔버스의 같은 위치로 넘긴다.
  (() => { let r; try { r = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { return; }
    r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(480, 300); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.domElement.className = 'mgCanvas'; r.domElement.dataset.own3d = '1'; c.dataset.st = '1'; c.parentNode.insertBefore(r.domElement, c);
    c.style.cssText += ';position:fixed;left:-10000px;top:0;opacity:0;pointer-events:none';
    const X = x => (x - 240) / 100, Y = y => (255 - y) / 100;
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x101318); const cam = new THREE.PerspectiveCamera(34, 480 / 300, .05, 40); cam.position.set(0, 1.25, 4.6); cam.lookAt(0, .95, 0);
    sc.add(new THREE.HemisphereLight(0xfff4e0, 0x2a1a10, .7)); const L = new THREE.SpotLight(0xfff2dc, 40, 14, .7, .5, 1.2); L.position.set(.5, 4.5, 2.5); L.target.position.set(.5, .8, 0); sc.add(L, L.target);
    const M = (c3, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c3, roughness: .5 }, o));
    const fc = document.createElement('canvas'); fc.width = 512; fc.height = 128; const fg = fc.getContext('2d'); fg.fillStyle = '#b07a44'; fg.fillRect(0, 0, 512, 128); for (let k = 0; k < 32; k++) { fg.fillStyle = `rgba(60,30,10,${.05 + Math.random() * .12})`; fg.fillRect(k * 16, 0, 1, 128); } fg.fillStyle = '#f2f2ee'; fg.fillRect(0, 60, 512, 4); fg.fillRect(330, 0, 4, 128);
    const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace; const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), M(0xffffff, { map: ft, roughness: .35 })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -.5); sc.add(floor);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), M(0x5a6470, { roughness: .9 })); wall.position.set(0, 2, -2); sc.add(wall);
    const bx0 = X(boardX + 4); const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, 2.4, 14), M(0x30343a, { metalness: .6 })); pole.position.set(bx0 + .45, 1.2, -.15); sc.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.5, .06, .06), M(0x30343a, { metalness: .6 })); arm.position.set(bx0 + .22, Y(93), -.15); sc.add(arm);
    const board = new THREE.Mesh(new THREE.BoxGeometry(.04, .78, 1.05), new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, transparent: true, opacity: .45, roughness: .05 })); board.position.set(bx0, Y(93), 0); sc.add(board);
    const sq = new THREE.Mesh(new THREE.BoxGeometry(.045, .3, .4), M(0xffffff, { transparent: true, opacity: .0 })); sc.add(sq);
    const sqL = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(.046, .3, .42)), new THREE.LineBasicMaterial({ color: 0xd04020 })); sqL.position.set(bx0 - .005, Y(rimY) + .2, 0); sc.add(sqL);
    const rimM = M(0xe0501c, { metalness: .5, roughness: .35 }); const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR / 100 + .02, .012, 8, 32), rimM); rim.rotation.x = Math.PI / 2; rim.position.set(X(rimX + 4), Y(rimY), 0); sc.add(rim);
    const netG = new THREE.CylinderGeometry(rimR / 100 + .02, rimR / 100 - .06, .34, 12, 3, true); const net = new THREE.Mesh(netG, new THREE.MeshBasicMaterial({ color: 0xf0f0e8, wireframe: true, transparent: true, opacity: .7 })); net.position.set(rim.position.x, Y(rimY) - .17, 0); sc.add(net);
    const bc = document.createElement('canvas'); bc.width = 128; bc.height = 64; const bg2 = bc.getContext('2d'); bg2.fillStyle = '#d86a28'; bg2.fillRect(0, 0, 128, 64); bg2.strokeStyle = '#1a0c04'; bg2.lineWidth = 3; [16, 48, 80, 112].forEach(x => { bg2.beginPath(); bg2.moveTo(x, 0); bg2.lineTo(x, 64); bg2.stroke(); }); bg2.beginPath(); bg2.moveTo(0, 32); bg2.lineTo(128, 32); bg2.stroke();
    const btx = new THREE.CanvasTexture(bc); btx.colorSpace = THREE.SRGBColorSpace; const bm = new THREE.Mesh(new THREE.SphereGeometry(.12, 28, 20), M(0xffffff, { map: btx, roughness: .75 })); sc.add(bm);
    const dots = [...Array(11)].map(() => { const d = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd76e, transparent: true, opacity: .7 })); sc.add(d); return d; });
    const gaugeBg = new THREE.Mesh(new THREE.BoxGeometry(.1, 1.2, .05), M(0x222830)); gaugeBg.position.set(X(55), 1.0, 0); sc.add(gaugeBg);
    const gauge = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.2, .06), new THREE.MeshBasicMaterial({ color: 0x58ff98 })); sc.add(gauge);
    const scC = document.createElement('canvas'); scC.width = 256; scC.height = 96; const scG = scC.getContext('2d'); const scT = new THREE.CanvasTexture(scC); scT.colorSpace = THREE.SRGBColorSpace;
    const board2 = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .41), new THREE.MeshBasicMaterial({ map: scT })); board2.position.set(-.6, 2.25, -1.95); sc.add(board2); let lastScore = '';
    const fwd = (type, e) => { const b = r.domElement.getBoundingClientRect(), cb = c.getBoundingClientRect(); c.dispatchEvent(new MouseEvent(type, { clientX: cb.left + (e.clientX - b.left) / b.width * cb.width, clientY: cb.top + (e.clientY - b.top) / b.height * cb.height, bubbles: true })); };
    ['mousemove', 'mousedown'].forEach(t => r.domElement.addEventListener(t, e => fwd(t, e)));
    let spin = 0;
    const lp = () => { if (!MG.active) { r.dispose(); r.forceContextLoss && r.forceContextLoss(); return; } const bx = ball ? ball.x : 74, by = ball ? ball.y : 220; bm.position.set(X(bx), Y(by), 0); if (ball) { spin -= ball.vx * .0006; bm.rotation.z = spin; }
      const v0 = 340 + (charging ? pwr : .55) * 280; dots.forEach((d, i) => { const tt = (i + 1) * .055; d.visible = !ball; d.position.set(X(74 + Math.cos(ang) * v0 * tt), Y(220 - Math.sin(ang) * v0 * tt + .5 * 560 * tt * tt), 0); });
      gauge.scale.y = Math.max(.001, pwr); gauge.position.set(X(55), 1.0 - .6 + .6 * pwr, .01);
      const sTxt = goals + '/' + shots + '/' + Math.round(ang * 180 / Math.PI); if (sTxt !== lastScore) { lastScore = sTxt; scG.fillStyle = '#0a0a0a'; scG.fillRect(0, 0, 256, 96); scG.fillStyle = '#ff4030'; scG.font = 'bold 44px monospace'; scG.textAlign = 'center'; scG.fillText(`${goals} / 3`, 80, 62); scG.fillStyle = '#ffd050'; scG.font = 'bold 26px monospace'; scG.fillText(`${Math.round(ang * 180 / Math.PI)}°`, 196, 60); scT.needsUpdate = true; }
      net.scale.y = ball && ball.scored && ball.y < rimY + 60 ? .8 : 1; r.render(sc, cam); requestAnimationFrame(lp); }; requestAnimationFrame(lp); })();
  return p;
}

/* ---------- 21. 아날로그 영사기 렌즈 초점 & 필름 트래킹 동기화 (시청각실) ---------- */
function filmFocus({ title = '영사기 — 듀얼 렌즈 초점 & 필름 트래킹 복원' } = {}) {
  const p = open(title, '<b>A · D(또는 마우스 좌우)</b>로 대물렌즈 초점 링 조절 · <b>W · S(또는 마우스 상하)</b>로 필름 수직 트래킹 동기화<br>화면 떨림과 초점 흐림이 사라졌을 때 <b>Space / 클릭</b>으로 프레임 고정!');
  const c = canvas(460, 290), g = c.getContext('2d');
  const tf = .22 + Math.random() * .56, tt = .22 + Math.random() * .56;
  let uf = .88, ut = .12, dn = {}, lastT = performance.now();
  screen3D(c, { kind: 'wood', prop: 'projector', anim: () => ({ uf, ut, tf, tt }) });
  c.addEventListener('mousemove', e => {
    const r = c.getBoundingClientRect();
    uf = clamp((e.clientX - r.left) / r.width, .05, .95);
    ut = clamp((e.clientY - r.top) / r.height, .05, .95);
  });
  const snap = () => {
    if (!finish) return;
    const err = Math.hypot(uf - tf, ut - tt);
    if (err < .13) { sfx.photo ? sfx.photo() : sfx.unlock(); close(true); }
    else { sfx.buzz(); status('아직 초점이나 수직 트래킹이 어긋나 글씨가 흐릿하다!', 'err'); }
  };
  c.addEventListener('click', snap);
  keys(e => {
    dn[e.code] = e.type === 'keydown';
    if (e.type === 'keydown' && (e.code === 'Space' || e.code === 'Enter')) snap();
  });
  const loop = now => {
    const dt = Math.min(.08, (now - lastT) / 1000); lastT = now;
    if (dn.KeyA || dn.ArrowLeft) uf = clamp(uf - .45 * dt, .05, .95);
    if (dn.KeyD || dn.ArrowRight) uf = clamp(uf + .45 * dt, .05, .95);
    if (dn.KeyW || dn.ArrowUp) ut = clamp(ut - .45 * dt, .05, .95);
    if (dn.KeyS || dn.ArrowDown) ut = clamp(ut + .45 * dt, .05, .95);

    const df = Math.abs(uf - tf), dt2 = Math.abs(ut - tt), err = Math.hypot(df, dt2);
    const roll = (ut - tt) * 140 + Math.sin(now * .025) * dt2 * 28;
    const split = df * 36;

    g.fillStyle = '#0e0c0a'; g.fillRect(0, 0, c.width, c.height);
    // 영사 스크린 프레임
    g.save();
    g.beginPath(); g.rect(40, 20, 380, 200); g.clip();
    g.fillStyle = '#221e18'; g.fillRect(40, 20, 380, 200);

    [-split, 0, split].forEach((ox, idx) => {
      const oy = ((roll % 200) + 200) % 200 - 100;
      g.save();
      g.translate(ox, oy);
      g.globalAlpha = idx === 1 ? clamp(1 - df * 1.3, .25, 1) : .38;
      g.fillStyle = idx === 0 ? '#ff6050' : idx === 2 ? '#50a8ff' : '#ece2c8';
      g.strokeStyle = g.fillStyle; g.lineWidth = 2;
      g.strokeRect(75, 42, 310, 156);
      g.font = 'bold 18px serif';
      g.fillText('1998. 10. 12 — 제30주년 리허설 기록', 92, 82);
      g.font = '14px sans-serif';
      g.fillText('3학년 2반 방송반: 윤하늘 · 강민아 · 이수아', 96, 118);
      g.fillText('“마지막 하교 방송 테이프는 방송부스에…”', 96, 148);
      g.restore();
    });
    // 필름 퍼포레이션 구멍
    g.fillStyle = '#090807';
    for (let y = 26; y < 215; y += 24) { g.fillRect(46, y, 10, 14); g.fillRect(404, y, 10, 14); }
    g.restore();

    g.fillStyle = err < .13 ? '#60ffa0' : '#d8c8a8'; g.font = 'bold 13px monospace';
    g.fillText(`초점 선명도: ${Math.max(0, (1 - df * 1.8) * 100).toFixed(0)}% [A/D]   |   트래킹 고정: ${Math.max(0, (1 - dt2 * 1.8) * 100).toFixed(0)}% [W/S]`, 42, 246);
    g.fillStyle = '#9aa4a8'; g.font = '12px sans-serif';
    g.fillText(err < .13 ? '✦ 화면이 또렷하게 맞았습니다! Space 또는 클릭으로 고정하세요' : '두 수치를 85% 이상으로 맞춰 화면 흔들림과 번짐을 잡으세요', 42, 270);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return p;
}

/* ---------- 22. 3연동 수압 밸브 평형 퍼즐 (수영장 수질관리실 / 기계실) ---------- */
function valveBalance({ title = '수질관리실 — 3연동 배수 수압 밸브 동조' } = {}) {
  const p = open(title, '밸브 1 · 2 · 3을 클릭(또는 <b>1 · 2 · 3 키</b>)해 회전시켜 세 배관의 수압을 모두 <b style="color:#60ffa0">안전 구역(42 ~ 58 PSI)</b>에 맞춘 뒤 <b>배수 레버(Space)</b>를 당겨라');
  const c = canvas(460, 290), g = c.getContext('2d');
  let psi = [24, 72, 30], angs = [0, 0, 0];
  screen3D(c, { kind: 'metal', prop: 'valves', anim: () => ({ psi, angs }), pick: i => turnValve(i) });
  const turnValve = i => {
    if (!finish) return;
    sfx.clank ? sfx.clank(.6) : sfx.click();
    angs[i] += Math.PI / 3;
    if (i === 0) { psi[0] = clamp(psi[0] + 12, 10, 90); psi[1] = clamp(psi[1] - 7, 10, 90); }
    else if (i === 1) { psi[1] = clamp(psi[1] + 11, 10, 90); psi[2] = clamp(psi[2] - 8, 10, 90); psi[0] = clamp(psi[0] - 4, 10, 90); }
    else if (i === 2) { psi[2] = clamp(psi[2] + 13, 10, 90); psi[0] = clamp(psi[0] - 6, 10, 90); }
    draw();
  };
  const pullLever = () => {
    if (!finish) return;
    if (psi.every(v => v >= 42 && v <= 58)) {
      sfx.unlock(); status('3연동 수압 평형 달성! 다이빙 풀 배수 밸브가 개방됩니다!', 'ok');
      setTimeout(() => close(true), 450);
    } else {
      sfx.buzz(); status('수압 불균형! 세 게이지 모두 42~58 PSI 초록 구간에 들어와야 합니다.', 'err');
    }
  };
  c.addEventListener('click', e => {
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) * c.width / r.width, y = (e.clientY - r.top) * c.height / r.height;
    if (y > 232) { pullLever(); return; }
    if (x < 160) turnValve(0);
    else if (x < 305) turnValve(1);
    else turnValve(2);
  });
  keys(e => {
    if (e.type !== 'keydown') return;
    if (e.code === 'Digit1' || e.code === 'KeyA') turnValve(0);
    else if (e.code === 'Digit2' || e.code === 'KeyS') turnValve(1);
    else if (e.code === 'Digit3' || e.code === 'KeyD') turnValve(2);
    else if (e.code === 'Space' || e.code === 'Enter') pullLever();
  });
  function draw() {
    g.fillStyle = '#0d1316'; g.fillRect(0, 0, c.width, c.height);
    const xs = [88, 230, 372];
    xs.forEach((cx, i) => {
      const v = psi[i], ok = v >= 42 && v <= 58;
      // 압력 게이지 원판
      g.fillStyle = '#1d262b'; g.beginPath(); g.arc(cx, 82, 52, 0, 7); g.fill();
      g.strokeStyle = ok ? '#58ff9a' : '#687880'; g.lineWidth = 3.5; g.stroke();
      // 초록 안전 구간 호
      g.strokeStyle = 'rgba(88,255,154,.45)'; g.lineWidth = 7;
      g.beginPath(); g.arc(cx, 82, 42, -Math.PI * .65, -Math.PI * .35); g.stroke();
      // 게이지 바늘
      const na = -Math.PI + (v / 100) * Math.PI;
      g.strokeStyle = ok ? '#60ffa0' : '#ff6850'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx, 82); g.lineTo(cx + Math.cos(na) * 40, 82 + Math.sin(na) * 40); g.stroke();
      g.fillStyle = '#e8f0f2'; g.font = 'bold 14px monospace';
      g.fillText(`${v.toFixed(0)} PSI`, cx - 26, 118);

      // 붉은 주철 밸브 핸들
      g.save(); g.translate(cx, 184); g.rotate(angs[i]);
      g.strokeStyle = '#c83228'; g.lineWidth = 6;
      g.beginPath(); g.arc(0, 0, 28, 0, 7); g.stroke();
      for (let k = 0; k < 3; k++) {
        const a = k * Math.PI / 1.5;
        g.beginPath(); g.moveTo(Math.cos(a) * -28, Math.sin(a) * -28); g.lineTo(Math.cos(a) * 28, Math.sin(a) * 28); g.stroke();
      }
      g.restore();
      g.fillStyle = '#b8c4c8'; g.font = '12px sans-serif'; g.fillText(`[${i + 1}] 밸브 ${i + 1} 돌리기`, cx - 42, 226);
    });
    const allOk = psi.every(v => v >= 42 && v <= 58);
    g.fillStyle = allOk ? '#288854' : '#28343c'; g.fillRect(60, 238, 340, 42);
    g.strokeStyle = allOk ? '#70ffb0' : '#586870'; g.lineWidth = 2; g.strokeRect(60, 238, 340, 42);
    g.fillStyle = '#ffffff'; g.font = 'bold 14px sans-serif';
    g.fillText(allOk ? '✦ 수압 동조 완료 — [Space / 클릭] 배수 개방!' : '[Space / 클릭] 메인 배수 레버 (모두 42~58 PSI 필요)', 88, 264);
  }
  draw();
  return p;
}


/* ---------- 미술실 목탄 데생 선긋기 (sketchLine) & 범용 선긋기 대안 미니게임 ---------- */
function mountSketchLineCanvas(title) {
  $('mgTitle').textContent = title || '🎨 미술실 이젤 — 1998 목탄 크로키 선긋기 복원';
  $('mgHint').innerHTML = '마우스를 <b>드래그하여 ① → ⑥ 점선 가이드를 따라 선을 긋거나</b>, 각 번호 점을 클릭(또는 <b>Space / 1~6 키</b>)하여 스케치 선을 완성하세요!';
  $('mgBody').innerHTML = '';
  injectAltBar($('mgTitle').textContent);
  const c = canvas(460, 290), g = c.getContext('2d');
  screen3D(c, { kind: 'paper' });
  c.style.cursor = 'crosshair';
  // 6개의 데생 윤곽 포인트 (1998 과학실/방송실 창가와 실험대·마이크 실루엣)
  const pts = [
    { x: 68,  y: 224, label: '① 실험대 좌측' },
    { x: 142, y: 112, label: '② 창문 프레임' },
    { x: 232, y: 72,  label: '③ 천장 조명등' },
    { x: 324, y: 116, label: '④ 시약장 상단' },
    { x: 392, y: 220, label: '⑤ 배수구 라인' },
    { x: 230, y: 236, label: '⑥ 1998.10.12 서명' }
  ];
  let curIdx = 0; // 연결 완료된 선 개수 (0..5)
  let dragging = false, mx = pts[0].x, my = pts[0].y;
  const userStrokes = [];

  function advancePoint() {
    if (curIdx >= pts.length - 1) return;
    curIdx++;
    sfx.paper ? sfx.paper() : sfx.click();
    status(`목탄 데생 선긋기 진행: ${curIdx} / ${pts.length - 1} 획 완성`);
    draw();
    if (curIdx >= pts.length - 1) {
      sfx.unlock();
      status('✦ 목탄 크로키 선긋기 완성! 숨겨진 1998년 스케치가 복원되었습니다!', 'ok');
      setTimeout(() => close(true), 450);
    }
  }

  const toLocal = e => {
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };

  c.onpointerdown = e => {
    const p = toLocal(e);
    dragging = true; mx = p.x; my = p.y;
    userStrokes.push([{ x: p.x, y: p.y }]);
    const nextPt = pts[Math.min(pts.length - 1, curIdx + 1)];
    const curPt = pts[curIdx];
    if (Math.hypot(p.x - nextPt.x, p.y - nextPt.y) < 38 || Math.hypot(p.x - curPt.x, p.y - curPt.y) < 38) {
      advancePoint();
    } else {
      draw();
    }
  };
  c.onpointermove = e => {
    if (!dragging) return;
    const p = toLocal(e);
    mx = p.x; my = p.y;
    if (userStrokes.length) userStrokes[userStrokes.length - 1].push({ x: p.x, y: p.y });
    const nextPt = pts[Math.min(pts.length - 1, curIdx + 1)];
    if (Math.hypot(p.x - nextPt.x, p.y - nextPt.y) < 34) {
      advancePoint();
    } else {
      draw();
    }
  };
  c.onpointerup = () => { dragging = false; draw(); };

  if (keyH) { removeEventListener('keydown', keyH, true); removeEventListener('keyup', keyH, true); keyH = null; }
  keys(e => {
    if (e.type !== 'keydown') return;
    if (e.code === 'Space' || e.code === 'Enter' || /^Digit[1-6]$/.test(e.code)) advancePoint();
  });

  function draw() {
    // 빈티지 화실 스케치북 종이 질감 배경
    g.fillStyle = '#ece3ce'; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = 'rgba(110,92,68,0.14)'; g.lineWidth = 1;
    for (let y = 18; y < c.height; y += 22) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
    // 액자 테두리
    g.strokeStyle = '#4a3b2a'; g.lineWidth = 4; g.strokeRect(8, 8, c.width - 16, c.height - 16);
    // 배경 연필 밑그림 가이드 (전체 점선 루프)
    g.save();
    g.setLineDash([6, 6]); g.strokeStyle = '#9a8c76'; g.lineWidth = 2.2;
    g.beginPath();
    pts.forEach((pt, i) => { if (i === 0) g.moveTo(pt.x, pt.y); else g.lineTo(pt.x, pt.y); });
    g.closePath(); g.stroke();
    g.restore();

    // 사용자가 자유 드래그한 목탄 터치 흔적
    g.strokeStyle = 'rgba(45,38,32,0.45)'; g.lineWidth = 3.5; g.lineCap = 'round';
    userStrokes.forEach(st => {
      if (st.length < 2) return;
      g.beginPath(); st.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke();
    });

    // 확정된 목탄 데생 굵은 선 (0 .. curIdx)
    if (curIdx > 0) {
      g.strokeStyle = '#1e1915'; g.lineWidth = 4.5; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i <= curIdx; i++) {
        if (i === 0) g.moveTo(pts[i].x, pts[i].y); else g.lineTo(pts[i].x, pts[i].y);
      }
      if (curIdx >= pts.length - 1) g.closePath();
      g.stroke();
      // 목탄 해칭 음영 효과
      g.fillStyle = 'rgba(40,32,24,0.10)';
      g.fill();
    }

    // 드래그 중일 때 현재 포인트에서 마우스까지 고무줄 가이드라인
    if (dragging && curIdx < pts.length - 1) {
      g.strokeStyle = '#b84a28'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(pts[curIdx].x, pts[curIdx].y); g.lineTo(mx, my); g.stroke();
    }

    // 각 포인트 원형 마커 및 라벨
    pts.forEach((pt, i) => {
      const done = i <= curIdx, isNext = i === curIdx + 1;
      g.fillStyle = done ? '#287a48' : isNext ? '#d44820' : '#7a6c58';
      g.beginPath(); g.arc(pt.x, pt.y, isNext ? 14 : 11, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff8e8'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#ffffff'; g.font = 'bold 12px sans-serif';
      g.fillText(String(i + 1), pt.x - 4, pt.y + 4);
      g.fillStyle = isNext ? '#9e2812' : '#3a3024'; g.font = (isNext ? 'bold ' : '') + '11.5px sans-serif';
      g.fillText(pt.label, pt.x - 34, pt.y + (pt.y < 120 ? -18 : 26));
    });
  }
  draw();
}
function switchToSketchLine(origTitle) {
  mountSketchLineCanvas((origTitle || '퍼즐') + ' — ✏ 선긋기 대안 모드');
}
function sketchLine(opts = {}) {
  const p = open(opts.title || '🎨 미술실 이젤 — 1998 목탄 크로키 선긋기 복원', '');
  mountSketchLineCanvas(opts.title || '🎨 미술실 이젤 — 1998 목탄 크로키 선긋기 복원');
  return p;
}
/* ---------- 23. 3상(R·S·T) 배전반 전압 트림 & 위상 동기화 차단기 (voltageSync) ---------- */
function voltageSync({ title = '⚡ 노후 배전반 — 3상(R·S·T) 전압 트림 & 위상 동기화 차단기' } = {}) {
  const p = open(title, '<b>1단계:</b> R상 · S상 · T상 <b>전압 트림 다이얼(클릭 또는 1·2·3 키)</b>을 조절해 세 변압기 전압을 모두 <b style="color:#60ffa0">215 ~ 225V 정격 구간</b>에 맞춰라<br><b>2단계:</b> 우측 <b>위상 동기경(Synchroscope) 바늘</b>이 상단 12시 초록 구간에 들어왔을 때 <b>[Space / 차단기 투입]</b>을 눌러라!');
  const c = canvas(500, 310), g = c.getContext('2d');
  let volts = [190, 240, 200], syncAng = Math.PI, lastT = performance.now();
  screen3D(c, { kind: 'metal', prop: 'breaker', anim: () => ({ volts, on: !finish }), pick: (i, d) => adjustPhase(i, d * 5) });

  const adjustPhase = (i, dv) => {
    if (!finish) return;
    volts[i] = clamp(volts[i] + dv, 170, 260);
    sfx.dial ? sfx.dial() : sfx.click();
  };

  const tripBreaker = () => {
    if (!finish) return;
    const vOk = volts.every(v => v >= 215 && v <= 225);
    if (!vOk) { sfx.buzz(); status('먼저 R·S·T 3상 전압을 모두 215~225V 정격 초록 구간에 맞추세요!', 'err'); return; }
    const normA = ((syncAng % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const diff12 = Math.min(Math.abs(normA - Math.PI * 1.5), Math.abs(normA + Math.PI * 2 - Math.PI * 1.5));
    if (diff12 <= 0.48) {
      sfx.fuse ? sfx.fuse() : sfx.unlock();
      status('철컥! — 3상 220V 정격 전압 및 위상 동기 투입 성공!', 'ok');
      setTimeout(() => close(true), 450);
    } else {
      sfx.spark ? sfx.spark() : sfx.buzz();
      status('위상 불일치 스파크! 우측 동기경 바늘이 12시 초록 구간에 왔을 때 투입하세요!', 'err');
    }
  };

  c.addEventListener('mousedown', e => {
    if (!finish) return;
    const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width, y = (e.clientY - rc.top) * c.height / rc.height;
    if (x >= 340 && y >= 195) { tripBreaker(); return; }
    if (x < 330 && y >= 155 && y <= 280) {
      const idx = Math.floor((x - 18) / 104);
      if (idx >= 0 && idx < 3) {
        const bx = 18 + idx * 104;
        adjustPhase(idx, (x - bx) < 48 ? -5 : 5);
      }
    }
  });

  keys(e => {
    if (e.type !== 'keydown') return;
    if (e.code === 'Digit1' || e.code === 'KeyA') adjustPhase(0, volts[0] < 220 ? 5 : -5);
    else if (e.code === 'Digit2' || e.code === 'KeyS') adjustPhase(1, volts[1] < 220 ? 5 : -5);
    else if (e.code === 'Digit3' || e.code === 'KeyD') adjustPhase(2, volts[2] < 220 ? 5 : -5);
    else if (e.code === 'Space' || e.code === 'Enter') tripBreaker();
  });

  const loop = now => {
    const dt = Math.min(.08, (now - lastT) / 1000); lastT = now;
    syncAng = (syncAng + dt * 2.8) % (Math.PI * 2);

    g.fillStyle = '#0d1216'; g.fillRect(0, 0, c.width, c.height);
    ['R상 (L1)', 'S상 (L2)', 'T상 (L3)'].forEach((lb, i) => {
      const cx = 66 + i * 104, v = volts[i], ok = v >= 215 && v <= 225;
      g.fillStyle = '#182026'; g.fillRect(cx - 46, 18, 92, 268);
      g.strokeStyle = ok ? '#58ff9a' : '#465662'; g.lineWidth = 2; g.strokeRect(cx - 46, 18, 92, 268);
      g.fillStyle = '#d8e4ec'; g.font = 'bold 12px sans-serif'; g.fillText(lb, cx - 26, 40);

      // 아날로그 전압계
      g.fillStyle = '#10161a'; g.beginPath(); g.arc(cx, 102, 38, 0, 7); g.fill();
      g.strokeStyle = ok ? '#58ff9a' : '#687882'; g.lineWidth = 2.5; g.stroke();
      const na = -Math.PI + ((v - 170) / 90) * Math.PI;
      g.strokeStyle = ok ? '#60ffa0' : '#ff6850'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(cx, 102); g.lineTo(cx + Math.cos(na) * 32, 102 + Math.sin(na) * 32); g.stroke();
      g.fillStyle = ok ? '#68ffa8' : '#ffd068'; g.font = 'bold 14px monospace';
      g.fillText(`${v}V`, cx - 18, 132);

      // -5V / +5V 트림 버튼
      g.fillStyle = '#26323c'; g.fillRect(cx - 40, 176, 38, 36); g.fillRect(cx + 2, 176, 38, 36);
      g.strokeStyle = '#5c7080'; g.strokeRect(cx - 40, 176, 38, 36); g.strokeRect(cx + 2, 176, 36, 36);
      g.fillStyle = '#ffffff'; g.font = 'bold 12px monospace';
      g.fillText('-5V', cx - 32, 199); g.fillText('+5V', cx + 8, 199);
      g.fillStyle = '#9ab0bc'; g.font = '11px sans-serif'; g.fillText(`[${i + 1}키] 자동보정`, cx - 36, 242);
    });

    // 우측 위상 동기경(Synchroscope) & 주 차단기 스위치
    g.fillStyle = '#161e24'; g.fillRect(338, 18, 146, 268); g.strokeStyle = '#485866'; g.strokeRect(338, 18, 146, 268);
    g.fillStyle = '#d8e6ee'; g.font = 'bold 12px sans-serif'; g.fillText('위상 동기경 (SYNC)', 356, 40);
    g.fillStyle = '#0e1418'; g.beginPath(); g.arc(411, 112, 48, 0, 7); g.fill();
    g.strokeStyle = '#485c68'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = '#58ff9a'; g.lineWidth = 6;
    g.beginPath(); g.arc(411, 112, 42, -Math.PI * .5 - .45, -Math.PI * .5 + .45); g.stroke();
    g.strokeStyle = '#ff5840'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(411, 112); g.lineTo(411 + Math.cos(syncAng) * 40, 112 + Math.sin(syncAng) * 40); g.stroke();

    const vOk = volts.every(v => v >= 215 && v <= 225);
    g.fillStyle = vOk ? '#247e4c' : '#28323a'; g.fillRect(348, 198, 126, 74);
    g.strokeStyle = vOk ? '#70ffb0' : '#52606c'; g.lineWidth = 2; g.strokeRect(348, 198, 126, 74);
    g.fillStyle = '#ffffff'; g.font = 'bold 12.5px sans-serif';
    g.fillText(vOk ? '⚡ [Space / 클릭]' : '3상 220V 맞춘 후', 360, 228);
    g.fillText(vOk ? '12시 방향에 투입!' : '차단기 투입 가능', 360, 250);

    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop); return p;
}

/* ---------- 24b. 캡슐 뽑기 기계 3D (gacha3D) — 실제 기계: 유리 돔 속 캡슐 · 동전 투입 · 크랭크 360° · 배출구로 굴러 나온 캡슐을 열기 ---------- */
function gacha3D({ title = '급식실 캡슐 뽑기 기계' } = {}) {
  let r; try { r = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { return gachaCrank({ title }); }
  const p = open(title, '<b>① 동전 넣기</b> 버튼(또는 C) → <b>② 크랭크를 마우스로 둥글게 끌어</b>(또는 D/Space 연타) 한 바퀴 → <b>③ 굴러 나온 캡슐 클릭</b>(또는 Enter)으로 열기');
  const W = 460, H = 330; r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(W, H); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.shadowMap.enabled = true;
  r.domElement.className = 'mgCanvas'; r.domElement.dataset.own3d = '1'; $('mgBody').appendChild(r.domElement);
  const btn = document.createElement('button'); btn.className = 'btn'; btn.textContent = '🪙 100원 동전 넣기 (C)'; $('mgBody').appendChild(btn);
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0c0a0a); sc.fog = new THREE.Fog(0x0c0a0a, 6, 12);
  const cam = new THREE.PerspectiveCamera(34, W / H, .05, 30); cam.position.set(.55, 1.15, 3.1); cam.lookAt(0, .78, 0);
  sc.add(new THREE.HemisphereLight(0xfff0e0, 0x201410, .55)); const key = new THREE.SpotLight(0xffe8c8, 30, 10, .6, .5, 1.5); key.position.set(1.6, 3, 2.4); key.castShadow = true; sc.add(key, key.target);
  const rim = new THREE.PointLight(0x80b0ff, 3, 6); rim.position.set(-1.6, 1.4, -1); sc.add(rim);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: 0x5a5048, roughness: .8 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
  const red = new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: .32, metalness: .2 }), chrome = new THREE.MeshStandardMaterial({ color: 0xd8dce0, roughness: .18, metalness: 1 }), dark = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: .6 });
  const M = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; sc.add(o); return o; };
  M(new THREE.CylinderGeometry(.42, .46, .06, 40), chrome, 0, .03, 0);   // 받침
  const body = M(new THREE.BoxGeometry(.72, .62, .66), red, 0, .37, 0);   // 본체
  M(new THREE.CylinderGeometry(.36, .36, .05, 40), chrome, 0, .705, 0);   // 돔 받침 링
  const dome = M(new THREE.SphereGeometry(.34, 40, 28), new THREE.MeshStandardMaterial({ color: 0xdfefff, roughness: .05, metalness: .1, transparent: true, opacity: .16, depthWrite: false }), 0, 1.02, 0); dome.castShadow = false;
  M(new THREE.CylinderGeometry(.09, .12, .07, 24), red, 0, 1.37, 0);   // 뚜껑
  // 라벨판 (가격 · 이름)
  { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#f4e8c8'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#c8202a'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.fillText('행운 캡슐', 128, 52); g.fillStyle = '#222'; g.font = 'bold 34px sans-serif'; g.fillText('₩100', 128, 104);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; M(new THREE.PlaneGeometry(.38, .19), new THREE.MeshStandardMaterial({ map: t, roughness: .5 }), 0, .55, .331); }
  // 동전 투입구 · 크랭크 · 배출구
  M(new THREE.BoxGeometry(.12, .1, .02), chrome, .2, .36, .335); M(new THREE.BoxGeometry(.06, .012, .01), dark, .2, .38, .347);
  const crank = new THREE.Group(); crank.position.set(-.12, .34, .345); sc.add(crank);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .04, 30), chrome); hub.rotation.x = Math.PI / 2; crank.add(hub);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.2, .04, .03), chrome); arm.position.set(.07, 0, .03); crank.add(arm);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.03, 16, 12), dark); knob.position.set(.16, 0, .05); crank.add(knob);
  const chute = M(new THREE.BoxGeometry(.2, .14, .06), dark, 0, .14, .34); const flap = M(new THREE.BoxGeometry(.19, .12, .01), new THREE.MeshStandardMaterial({ color: 0xdfefff, transparent: true, opacity: .3, depthWrite: false }), 0, .14, .372);
  // 돔 속 캡슐 (반반 색 · 위아래 반구)
  const COL = [0xff4060, 0x40a0ff, 0xffd030, 0x50d080, 0xc060ff, 0xff8030], caps = [];
  const capsule = col => { const g = new THREE.Group(), top = new THREE.Mesh(new THREE.SphereGeometry(.05, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: col, roughness: .18, metalness: .05 })), bot = new THREE.Mesh(new THREE.SphereGeometry(.05, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: .3 })); top.castShadow = bot.castShadow = true; g.add(top, bot); g.userData = { top, bot }; return g; };
  for (let i = 0; i < 38; i++) { const c = capsule(COL[i % COL.length]), a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * .27, y = .78 + Math.random() * .3 * (1 - rr / .34); c.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr); c.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); c.userData.base = c.position.clone(); sc.add(c); caps.push(c); }
  const coin = M(new THREE.CylinderGeometry(.025, .025, .005, 24), new THREE.MeshStandardMaterial({ color: 0xd8c070, metalness: 1, roughness: .3 }), .2, .55, .5); coin.rotation.x = Math.PI / 2; coin.visible = false;
  let coinIn = false, coinT = -1, ang = 0, last = null, drop = null, dropT = 0, opened = false, openT = 0, shake = 0;
  const insert = () => { if (coinIn || coinT >= 0) return; coinT = 0; coin.visible = true; sfx.click(); btn.disabled = true; };
  btn.onclick = insert;
  const turn = da => { if (!coinIn) { status('먼저 동전을 넣으세요', 'err'); sfx.buzz(); return; } if (drop) return; if (da <= 0) return; const before = Math.floor(ang / (Math.PI / 4)); ang += da; shake = .25;
    if (Math.floor(ang / (Math.PI / 4)) > before) { sfx.dial && sfx.dial(); sfx.tumbler && Math.random() < .3 && sfx.tumbler(); }
    if (ang >= Math.PI * 2) { ang = Math.PI * 2; const c = caps.splice((Math.random() * caps.length) | 0, 1)[0]; drop = c; dropT = 0; c.userData.from = c.position.clone(); sfx.unlock && sfx.unlock(); status('덜컥 — 캡슐이 굴러 나온다!', 'ok'); } };
  const cv = r.domElement, crankScreen = () => { const v = crank.getWorldPosition(new THREE.Vector3()).project(cam), b = cv.getBoundingClientRect(); return { x: b.left + (v.x + 1) / 2 * b.width, y: b.top + (1 - v.y) / 2 * b.height }; };
  const angAt = e => { const c0 = crankScreen(); return Math.atan2(e.clientY - c0.y, e.clientX - c0.x); };
  cv.addEventListener('mousedown', e => { if (drop && dropT > 1.1 && !opened) { opened = true; openT = 0; sfx.pickup && sfx.pickup(); return; } last = angAt(e); });
  const mm = e => { if (last == null) return; const a = angAt(e); let d = a - last; if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; last = a; turn(d); };
  const mu = () => { last = null; }; addEventListener('mousemove', mm); addEventListener('mouseup', mu); cleanups.push(() => { removeEventListener('mousemove', mm); removeEventListener('mouseup', mu); r.dispose(); r.forceContextLoss && r.forceContextLoss(); });
  keys(e => { if (e.type !== 'keydown') return; if (e.code === 'KeyC') insert(); if (e.code === 'KeyD' || e.code === 'Space') turn(Math.PI / 6); if (e.code === 'Enter' && drop && dropT > 1.1 && !opened) { opened = true; openT = 0; sfx.pickup && sfx.pickup(); } });
  let lt = performance.now();
  const loop = now => { const dt = Math.min(.05, (now - lt) / 1000); lt = now;
    if (coinT >= 0) { coinT += dt; coin.position.set(.2, .55 - Math.min(1, coinT / .5) * .17, .5 - Math.min(1, coinT / .5) * .15); if (coinT > .55) { coin.visible = false; coinT = -1; coinIn = true; sfx.clank ? sfx.clank(.6) : sfx.click(); status('동전이 떨어졌다 — 크랭크를 돌리세요', 'ok'); } }
    crank.rotation.z = -ang; shake = Math.max(0, shake - dt * 2);
    caps.forEach((c, i) => { const b = c.userData.base; c.position.set(b.x + Math.sin(now / 60 + i) * .006 * shake * 4, b.y + Math.abs(Math.sin(now / 45 + i * 1.7)) * .012 * shake * 4, b.z + Math.cos(now / 55 + i) * .006 * shake * 4); c.rotation.y += shake * dt * 3; });
    if (drop && !opened) { dropT += dt; const f = drop.userData.from; if (dropT < .5) drop.position.lerpVectors(f, new THREE.Vector3(0, .72, 0), dropT / .5); else if (dropT < 1.1) { const k = (dropT - .5) / .6; drop.position.set(0, .26 - k * .14 + Math.abs(Math.sin(k * 9)) * .04 * (1 - k), .3 + k * .22); drop.rotation.x += dt * 9; flap.rotation.x = -Math.sin(Math.min(1, k * 2) * Math.PI) * .9; } else { drop.position.y = .12 + Math.sin(now / 300) * .004; flap.rotation.x = 0; } }
    if (opened) { openT += dt; const k = Math.min(1, openT / .6); drop.userData.top.position.y = k * .09; drop.userData.top.rotation.x = -k * 1.2; drop.userData.bot.position.y = -k * .02; drop.rotation.x = 0; cam.position.lerp(new THREE.Vector3(.1, .5, 1.1), dt * 2); cam.lookAt(drop.position); if (openT > 1.1) { r.render(sc, cam); return close(true); } }
    else { cam.position.x = .55 + Math.sin(now / 2400) * .05; cam.lookAt(0, .78, 0); }
    r.render(sc, cam); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop); return p;
}
/* ---------- 24. 1998 캡슐 뽑기 기계 — 동전 투입 & 크랭크 360° 회전 (gachaCrank) ---------- */
function gachaCrank({ title = '급식실 캡슐 뽑기 기계 — 동전 투입 & 크랭크 360° 회전' } = {}) {
  const p = open(title, '<b>1) [100원 주화 투입]</b>을 누른 뒤, <b>2) 크랭크 손잡이를 마우스로 둥글게 드래그(또는 Space/D 연타)</b>해 360° 한 바퀴를 끝까지 돌려 캡슐을 뽑아라!');
  const c = canvas(440, 310), g = c.getContext('2d');
  let coinIn = false, ang = 0, dragging = false, lastClickStep = 0;

  const advanceCrank = da => {
    if (!coinIn) { sfx.buzz(); status('먼저 좌측 [100원 동전 투입구]를 클릭해 동전을 넣으세요!', 'err'); return; }
    ang = clamp(ang + da, 0, Math.PI * 2);
    const step = Math.floor(ang / (Math.PI / 2));
    if (step > lastClickStep) { lastClickStep = step; sfx.dial ? sfx.dial() : sfx.click(); }
    draw();
    if (ang >= Math.PI * 2 - .08 && finish) {
      sfx.clank ? sfx.clank(.6) : sfx.unlock();
      status('드르륵— 철컥! 캡슐 토출구로 플라스틱 캡슐이 떨어졌다!', 'ok');
      setTimeout(() => close(true), 450);
    }
  };

  c.addEventListener('mousedown', e => {
    if (!finish) return;
    const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width, y = (e.clientY - rc.top) * c.height / rc.height;
    if (x < 175 && y >= 150 && y <= 245) {
      coinIn = true; sfx.pickup ? sfx.pickup() : sfx.click();
      status('찰랑— 100원 주화가 투입되었다! 이제 우측 크랭크 핸들을 360° 돌리세요!');
      draw(); return;
    }
    if (Math.hypot(x - 295, y - 185) <= 75) {
      if (!coinIn) { coinIn = true; sfx.pickup ? sfx.pickup() : sfx.click(); }
      dragging = true; advanceCrank(Math.PI / 3);
    }
  });
  c.addEventListener('mousemove', e => {
    if (!dragging || !coinIn) return;
    advanceCrank(0.09);
  });
  const mu = () => { dragging = false; };
  addEventListener('mouseup', mu); cleanups.push(() => removeEventListener('mouseup', mu));

  keys(e => {
    if (e.type !== 'keydown') return;
    if (!coinIn) { coinIn = true; sfx.pickup ? sfx.pickup() : sfx.click(); draw(); return; }
    if (e.code === 'Space' || e.code === 'KeyD' || e.code === 'ArrowRight' || e.code === 'Enter') advanceCrank(Math.PI / 2);
  });

  function draw() {
    g.fillStyle = '#101418'; g.fillRect(0, 0, c.width, c.height);
    // 뽑기 기계 상단 투명 돔 & 캡슐들
    g.fillStyle = '#b82828'; g.fillRect(40, 120, 360, 175);
    g.strokeStyle = '#ff9888'; g.lineWidth = 2; g.strokeRect(40, 120, 360, 175);
    g.fillStyle = 'rgba(210, 235, 248, 0.22)'; g.beginPath(); g.arc(220, 115, 96, Math.PI, 0); g.fill();
    g.strokeStyle = '#b8d0dc'; g.lineWidth = 3; g.stroke();
    const cols = ['#ffcc38', '#48a8ff', '#ff5888', '#58e890', '#b868ff'];
    for (let i = 0; i < 9; i++) {
      const a = i * .7 + ang * .6, cx = 220 + Math.cos(a) * (25 + (i % 3) * 20), cy = 88 + Math.sin(a) * 18;
      g.fillStyle = cols[i % cols.length]; g.beginPath(); g.arc(cx, cy, 15, 0, 7); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.stroke();
    }

    // 좌측 100원 주화 투입구
    g.fillStyle = coinIn ? '#246844' : '#28323a'; g.fillRect(62, 154, 112, 82);
    g.strokeStyle = coinIn ? '#68ffa8' : '#ffd068'; g.lineWidth = 2; g.strokeRect(62, 154, 112, 82);
    g.fillStyle = '#ffffff'; g.font = 'bold 12px sans-serif';
    g.fillText(coinIn ? '✓ 100원 투입됨' : '1. 100원 동전', 74, 186);
    g.fillText(coinIn ? '핸들을 돌리세요!' : '투입구 [클릭]', 74, 208);

    // 우측 크롬 크랭크 회전 핸들
    const cx = 295, cy = 195;
    g.fillStyle = '#d4dade'; g.beginPath(); g.arc(cx, cy, 52, 0, 7); g.fill();
    g.strokeStyle = '#58646c'; g.lineWidth = 4; g.stroke();
    g.save(); g.translate(cx, cy); g.rotate(ang);
    g.fillStyle = '#384048'; g.fillRect(-42, -10, 84, 20);
    g.fillStyle = '#ff4838'; g.beginPath(); g.arc(32, 0, 12, 0, 7); g.fill();
    g.restore();

    g.fillStyle = '#fff4e0'; g.font = 'bold 13px monospace';
    g.fillText(`2. 크랭크 회전: ${Math.round((ang / (Math.PI * 2)) * 360)}° / 360° [드래그 / Space]`, 88, 276);
  }
  draw(); return p;
}

export function run(kind, opts = {}) {
  if (MG.active) return Promise.resolve({ ok: false });
  return ({ lockpick, dial, circuit, piano, slide, fishing, order, memory, tune, simon, timing, ouija, pipes, maze, rings, spotdiff, fuse, oscilloscope, chemMix, hoopShot, filmFocus, valveBalance, stampApprove, omrGrade, timetableRestore, libraryCatalog, cassetteSplice, microscopeSlide, sketchLine, voltageSync, gachaCrank, gacha3D })[kind](opts);
}
