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
  const DESKTOOLS = ['stamp', 'omr', 'magnets', 'cards'];
  if (DESKTOOLS.includes(prop)) {   // 서류 책상 도구 (오른쪽): 직인과 인주 · 컴퓨터용 사인펜과 수정테이프 · 자석 · 도서 카드함 — 왼쪽엔 스탠드
    const tx = sw / 2 + .5, ty = yBot, TG = new THREE.Group();
    if (prop === 'stamp') { const pad = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .035, 24), M(0x222222, { metalness: .4 })); pad.position.set(tx, ty + .02, -.05); TG.add(pad); const ink = new THREE.Mesh(new THREE.CylinderGeometry(.095, .095, .005, 24), M(0xa01818, { roughness: .9 })); ink.position.set(tx, ty + .04, -.05); TG.add(ink);
      const st = new THREE.Group(); const h = new THREE.Mesh(new THREE.CylinderGeometry(.03, .045, .16, 18), M(0x5a2a14, { roughness: .4 })); h.position.y = .1; st.add(h); const base = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .03, 18), M(0xc8a860, { metalness: .6 })); base.position.y = .015; st.add(base); st.position.set(tx + .05, ty, .2); st.rotation.z = .25; TG.add(st); }
    if (prop === 'omr') { const pen = new THREE.Mesh(new THREE.CylinderGeometry(.009, .009, .3, 10), M(0x111111)); pen.rotation.z = Math.PI / 2; pen.rotation.y = .4; pen.position.set(tx, ty + .01, .1); TG.add(pen); const cap = new THREE.Mesh(new THREE.CylinderGeometry(.011, .011, .06, 10), M(0xffffff)); cap.rotation.z = Math.PI / 2; cap.rotation.y = .4; cap.position.set(tx + .14, ty + .012, .04); TG.add(cap);
      const tape = new THREE.Mesh(new THREE.BoxGeometry(.13, .035, .05), M(0x3a7ad0, { roughness: .4 })); tape.position.set(tx - .02, ty + .018, -.12); tape.rotation.y = -.3; TG.add(tape); const roll = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .055, 14), M(0xf4f4f0)); roll.rotation.x = Math.PI / 2; roll.position.set(tx + .05, ty + .02, -.15); TG.add(roll); }
    if (prop === 'magnets') { [[0xd03030, -.06, .05], [0x3070d0, .06, .1], [0xe0c020, 0, -.08], [0x30a050, .1, -.05], [0xe07020, -.1, -.12]].forEach(([c3, dx, dz]) => { const m2 = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .02, 18), M(c3, { roughness: .35 })); m2.position.set(tx + dx, ty + .01, dz); TG.add(m2); }); }
    if (prop === 'cards') { const bx2 = new THREE.Mesh(new THREE.BoxGeometry(.24, .14, .34), M(0x6a4424, { roughness: .6 })); bx2.position.set(tx, ty + .07, -.05); TG.add(bx2); for (let k = 0; k < 9; k++) { const cd = new THREE.Mesh(new THREE.BoxGeometry(.2, .16, .004), M(k % 3 ? 0xf0e8d0 : 0xe8d8a8, { roughness: .9 })); cd.position.set(tx, ty + .1 + (k % 2) * .01, -.18 + k * .03); cd.rotation.x = -.2; TG.add(cd); } const tab = new THREE.Mesh(new THREE.BoxGeometry(.06, .03, .005), M(0xc03030)); tab.position.set(tx + .05, ty + .2, -.03); TG.add(tab); }
    [...TG.children].forEach(o => { o.position.set(tx + (o.position.x - tx) * 1.8, ty + (o.position.y - ty) * 1.8, o.position.z * 1.8); o.scale.multiplyScalar(1.8); P.add(o); });   // 종이 크기에 맞게 키운다
    side = 1.3; }
  if (prop === 'lamp' || DESKTOOLS.includes(prop)) { side = 1; const base = new THREE.Mesh(new THREE.CylinderGeometry(.1, .12, .03, 20), M(0x2a3a2a)); base.position.set(-(sw / 2 + .4), yBot + .015, -.2); P.add(base); const pole = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .7, 8), M(0x2a3a2a)); pole.position.set(-(sw / 2 + .4), yBot + .35, -.2); P.add(pole); const shade = new THREE.Mesh(new THREE.ConeGeometry(.14, .16, 20, 1, true), M(0x2f5a3a, { side: THREE.DoubleSide })); shade.position.set(-(sw / 2 + .28), yBot + .7, -.1); shade.rotation.z = -.6; P.add(shade); const wl = new THREE.PointLight(0xffd8a0, 1.2, 3); wl.position.set(-(sw / 2 + .2), yBot + .6, 0); P.add(wl); }
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
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.0, .22), brass); top.position.set(0, Y(70), -.26); sc.add(top);   // 단면: 앞쪽 절반은 잘라 내 핀이 보인다
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
  const v3 = new THREE.Vector3();
  return {
    dom: r.domElement,
    // 마우스 x(0..1) → 2D 핀 좌표 px: 원근 때문에 화면의 핀 위치가 2D 좌표와 선형이 아니므로, 각 핀을 화면에 투영해 그 사이를 보간한다
    mouseToPx(fx) { const sx = PX.map(x => { v3.set(X(x), Y(120), 0).project(cam); return (v3.x + 1) / 2; });
      if (fx <= sx[0]) return PX[0] - (sx[0] - fx) / Math.max(.01, sx[1] - sx[0]) * (PX[1] - PX[0]);
      for (let k = 0; k < PX.length - 1; k++) if (fx <= sx[k + 1]) return PX[k] + (fx - sx[k]) / Math.max(.01, sx[k + 1] - sx[k]) * (PX[k + 1] - PX[k]);
      const n = PX.length - 1; return PX[n] + (fx - sx[n]) / Math.max(.01, sx[n] - sx[n - 1]) * (PX[n] - PX[n - 1]); },
    render(st) {   // st: { lift, need, set, jam, binding, px, tip, ten, turn, feel }
      const sh = st.feel > 0 ? (Math.random() - .5) * .012 : 0;
      plug.rotation.x = -(st.turn * 1.2 + st.set.filter(Boolean).length * .012 + st.ten * .01); wr.rotation.z = -st.ten * .25;
      pins.forEach((P, k) => { const kpLen = (178 - 120 - st.need[k]) / 100, base = st.lift[k] / 100, rot = k < 0 ? 0 : 0;
        P.k.scale.y = Math.max(.02, kpLen); P.k.position.y = base; P.tipC.position.y = base - .02;
        const top = base + kpLen; P.d.position.y = top; const sTop = 1.5; P.sp.position.y = top + .34; P.sp.scale.y = Math.max(.05, sTop - top - .34);
        P.k.material.color.setHex(st.set[k] ? 0x70d090 : st.binding === k && st.feel > 0 ? 0xf0d070 : 0xd0a850); P.k.material.emissive.setHex(st.set[k] ? 0x0a3018 : Math.abs(PX[k] - st.px) < 22 ? 0x2a1c06 : 0);   // 머리핀이 닿은 핀은 은은하게 밝다
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
  const p = open('자물쇠 따기 — 핀 텀블러', '<b>Q · E / 휠</b> 텐션 · <b>A · D / 마우스</b> 핀 고르기 · <b>W · Space / 클릭 유지</b> 밀어 올리기<br>텐션을 걸면 핀 하나만 뻑뻑하게 걸린다(노랗게 떨림) — 그 핀을 밀면 딸깍. 헐렁한 핀은 아직 차례가 아니다<br>텐션이 너무 세면 핀이 전단선을 지나 끼고 머리핀이 부러질 수 있다 — 끼면 Q 로 텐션을 살짝 풀어라');
  const c = canvas(460, 300), g = c.getContext('2d');
  const info = document.createElement('div'); info.className = 'mgInfo'; $('mgBody').appendChild(info);
  const N = 5, PX = [150, 205, 260, 315, 370], SL = 120, BASE = 178, TP = Math.max(4, 2.5 + tol / 3);   // 전단선 y · 핀 바닥 y · 허용 오차(px)
  const need = PX.map(() => 10 + Math.random() * 26), order = [...Array(N).keys()].sort(() => Math.random() - .5);
  const lift = Array(N).fill(0), set = Array(N).fill(false), jam = Array(N).fill(false);
  // 텐션은 적당한 값(0.35)에서 시작 — 예전엔 0 에서 시작해 E 를 세 번 눌러야 핀이 하나라도 걸렸다(모르면 영원히 진행 없음)
  let px = PX[0], up = false, tip = 0, ten = .35, left = pins(), turn = 0, opened = false, lastT = performance.now(), feel = 0, lastI = -1, msgT = 0;
  MG.lp = { need, order, PX, set, lift, jam, get ten() { return ten; }, get tip() { return tip; } };   // 테스트용 상태
  const L3 = lock3D($('mgBody'), N, PX); if (L3) { $('mgBody').insertBefore(L3.dom, c); c.height = 40; c.style.height = 'auto'; cleanups.push(() => L3.dispose());
    // 3D 화면은 원근이 있어 화면 x 와 핀 좌표가 선형이 아니다 → 핀을 투영해 맞춘다 (예전엔 보이는 핀 위에 마우스를 올려도 옆 핀이 골라졌다)
    L3.dom.addEventListener('mousemove', e => { const r = L3.dom.getBoundingClientRect(); px = clamp(L3.mouseToPx((e.clientX - r.left) / r.width), 80, 400); });
    L3.dom.addEventListener('mousedown', e => { e.preventDefault(); up = true; }); L3.dom.addEventListener('wheel', e => { e.preventDefault(); setTen(ten + (e.deltaY < 0 ? .06 : -.06)); }, { passive: false }); }
  const upd = () => { info.innerHTML = `남은 머리핀 <b>${left}</b>개 · 고정된 핀 <b>${set.filter(Boolean).length}</b> / ${N}` + (jam.some(Boolean) ? ' · <b style="color:#e07060">핀이 끼었다 — Q</b>' : ''); }; upd();
  const binding = () => order.find(i => !set[i]);
  const under = () => { let best = -1, bd = 22; PX.forEach((x, i) => { const d = Math.abs(x - px); if (d < bd) { bd = d; best = i; } }); return best; };
  const setTen = v => { const n = clamp(v, 0, 1), was = ten; if (Math.abs(n - ten) > .04) sfx.tension(n); ten = n;
    if (n < was && jam.some(Boolean)) { for (let k = 0; k < N; k++) if (jam[k]) { jam[k] = false; lift[k] = 0; } sfx.pick(); status('텐션을 살짝 풀자 끼었던 핀이 내려왔다 — 고정된 핀은 그대로', 'ok'); upd(); } };
  const pinAt = d => { const i = under(), k = clamp((i < 0 ? (d > 0 ? -1 : N) : i) + d, 0, N - 1); px = PX[k]; };
  c.addEventListener('mousemove', e => { if (L3) return; const r = c.getBoundingClientRect(); px = clamp(((e.clientX - r.left) / r.width) * 460, 80, 400); });
  c.addEventListener('mousedown', () => { if (!L3) up = true; }); const mu = () => { up = false; }; addEventListener('mouseup', mu); cleanups.push(() => removeEventListener('mouseup', mu));
  c.addEventListener('wheel', e => { e.preventDefault(); setTen(ten + (e.deltaY < 0 ? .06 : -.06)); }, { passive: false });
  keys(e => {
    const dn = e.type === 'keydown';
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Enter') up = dn;
    if (dn && !e.repeat && (e.code === 'KeyA' || e.code === 'ArrowLeft')) pinAt(-1);   // 핀 단위로 이동 (예전: 9px 씩 — 핀 하나 옮기는 데 6번)
    if (dn && !e.repeat && (e.code === 'KeyD' || e.code === 'ArrowRight')) pinAt(1);
    if (dn && e.code === 'KeyE') setTen(ten + .08);
    if (dn && (e.code === 'KeyQ' || e.code === 'ArrowDown')) setTen(ten - .08);
  });
  // 게임패드: 십자키/스틱 좌우 = 핀, A/RT = 밀기, LB/RB = 텐션, B = 그만두기
  let gpPrev = {}; const gpPoll = () => { const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null; if (!gp) return; const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed), ax = gp.axes[0] || 0;
    const s = { l: b(14) || ax < -.6, r: b(15) || ax > .6, a: b(0) || b(7), lb: b(4), rb: b(5), b: b(1) };
    if (s.l && !gpPrev.l) pinAt(-1); if (s.r && !gpPrev.r) pinAt(1); if (s.rb && !gpPrev.rb) setTen(ten + .08); if (s.lb && !gpPrev.lb) setTen(ten - .08);
    if (s.a !== !!gpPrev.a) up = s.a; const back = s.b && !gpPrev.b; gpPrev = s; if (back) close(false); };
  const loop = now => {
    if (!MG.active) return;
    const dt = Math.min(.2, (now - lastT) / 1000); lastT = now; gpPoll(); if (!MG.active) return;
    if (opened) { turn = Math.min(1, turn + dt * 2.4); draw(); if (turn >= 1) return close(true); raf = requestAnimationFrame(loop); return; }
    const i = under(), bi = binding(), hard = ten > .78, weak = ten < .12; if (i !== lastI) { tip = 0; lastI = i; }
    msgT -= dt;
    // 텐션을 완전히 풀면(거의 0) 고정된 핀이 하나씩 떨어진다 — 조금 약한 정도로는 떨어지지 않는다
    if (ten < .06 && set.some(Boolean) && Math.random() < dt * 2) { const k = set.lastIndexOf(true); if (k >= 0) { set[k] = false; lift[k] = 0; sfx.pick(); status('텐션이 풀려 핀이 떨어졌다', 'err'); upd(); } }
    // 머리핀 끝 높이: 걸린(바인딩) 핀은 뻑뻑해서 천천히, 차례가 아닌 핀은 스프링만 눌려 헐렁하게 끝까지 올라간다
    const maxTip = i < 0 ? 4 : set[i] ? need[i] : jam[i] ? need[i] + TP + 8 : 48, rate = i === bi && !weak ? 22 : 70;
    tip = up ? Math.min(maxTip, tip + rate * dt) : Math.max(0, tip - 120 * dt);
    feel = Math.max(0, feel - dt * 3);
    for (let k = 0; k < N; k++) if (!set[k] && !jam[k]) lift[k] = k === i ? tip : Math.max(0, lift[k] - 140 * dt); else if (set[k]) lift[k] = need[k];
    if (i >= 0 && !set[i] && !jam[i] && up) {
      if (i === bi && !weak) {
        feel = 1; if (Math.random() < dt * 6) sfx.tension(ten * .5);   // 걸린 핀: 손끝에 뻑뻑함 · 노랗게 떨림
        if (!hard && Math.abs(lift[i] - need[i]) < TP) { set[i] = true; lift[i] = need[i]; tip = need[i]; sfx.pick(); setTimeout(() => sfx.pick(), 40); status(`딸깍 — ${i + 1}번 핀이 전단선에 걸렸다. 플러그가 살짝 돈다`, 'ok'); upd();
          if (set.every(Boolean)) { opened = true; sfx.tumbler(); status('실린더가 돌아간다 — 열렸다', 'ok'); } }
        else if (lift[i] > need[i] + TP) {   // 과셋: 텐션이 세서 전단선을 지나쳤다 → 그 핀만 낀다. 일정 확률로 머리핀이 부러진다
          jam[i] = true; up = false; sfx.buzz(); upd();
          if (Math.random() < .3) { sfx.pinBreak(); left--; usePin(); tip = 0; for (let k = 0; k < N; k++) { set[k] = false; jam[k] = false; lift[k] = 0; } setTen(.35); status('과하게 밀었다 — 머리핀이 부러졌다! 처음부터', 'err'); upd();
            if (left <= 0) { status('머리핀이 다 떨어졌다', 'err'); draw(); setTimeout(() => close(false), 900); return; } }
          else status('너무 밀었다 — 핀이 전단선 위로 끼었다. Q 로 텐션을 살짝 풀어라 (고정된 핀은 유지)', 'err'); }
        else if (hard && msgT <= 0) { status('텐션이 너무 세다 — 핀이 멈추지 않는다. Q 로 조금 풀어라'); msgT = 2; }
      } else if (weak && lift[i] > 20 && msgT <= 0) { status('텐션이 너무 약하다 — E 로 살짝 걸어라'); msgT = 2; }
      else if (i !== bi && lift[i] > 40 && msgT <= 0) { status(`${i + 1}번 핀은 헐렁하다 — 아직 걸린 핀이 아니다`); msgT = 1.6; }
    }
    draw(); raf = requestAnimationFrame(loop);
  };
  function draw() {
    if (L3) { L3.render({ lift, need, set, jam, binding: binding(), px, tip, ten, turn, feel });   // 3D 뷰 + 아래 텐션 게이지
      g.fillStyle = '#0d0b09'; g.fillRect(0, 0, 460, 40); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(20, 20, 420, 12); g.fillStyle = 'rgba(96,224,160,.25)'; g.fillRect(20 + 420 * .12, 20, 420 * .66, 12);
      g.fillStyle = ten > .78 ? '#e05040' : ten < .12 ? '#8a8a8a' : '#60e0a0'; g.fillRect(20, 20, 420 * ten, 12); g.fillStyle = '#d8d0b8'; g.font = '11px sans-serif'; g.fillText('텐션', 22, 14); if (ten > .78) { g.fillStyle = '#e05040'; g.fillText('텐션 과다!', 380, 14); } return; }
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
    g.fillStyle = 'rgba(96,224,160,.25)'; g.fillRect(20 + 420 * .12, 268, 420 * .66, 12);
    g.fillStyle = ten > .78 ? '#e05040' : ten < .12 ? '#8a8a8a' : '#60e0a0'; g.fillRect(20, 268, 420 * ten, 12);
    g.fillStyle = '#d8d0b8'; g.font = '11px sans-serif'; g.fillText('텐션', 22, 262); if (ten > .78) { g.fillStyle = '#e05040'; g.fillText('텐션 과다!', 380, 262); }
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
    const stand = add(new THREE.PlaneGeometry(.42, .26), new THREE.MeshBasicMaterial({ map: st, color: 0xb8ac90, toneMapped: false }), 0, 1.02, -.12); stand.rotation.x = -.25;   // 조명에 하얗게 날아가 악보 글씨가 안 보이던 문제 → 조명 영향 없는 재질
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
    const backT = tex(g2 => { g2.fillStyle = '#2a3a5a'; g2.fillRect(0, 0, 128, 176); g2.strokeStyle = '#c8a860'; g2.lineWidth = 6; g2.strokeRect(8, 8, 112, 160); g2.fillStyle = '#c8a860'; g2.font = 'bold 30px serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText('서린', 64, 76); g2.font = '16px serif'; g2.fillText('1987', 64, 108); }); backT.center.set(.5, .5); backT.rotation = Math.PI;
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

/* 사실감 도우미 (종이 섬유 · 나무 책상 · 붉은 인영) — 오프스크린 캔버스라 번역(tr)을 거치지 않는다 */
const mgTexC = {};
function mgPaper(g, x, y, w, h, base = '#f2eee2', key = '') {
  const k = 'p' + base + w + 'x' + h + key; let cv = mgTexC[k];
  if (!cv) {
    cv = mgTexC[k] = document.createElement('canvas'); cv.width = w; cv.height = h; const q = cv.getContext('2d'); q.fillStyle = base; q.fillRect(0, 0, w, h);
    const id = q.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 12; d[i] += n; d[i + 1] += n; d[i + 2] += n * 1.15; } q.putImageData(id, 0, 0);
    for (let i = 0; i < w * h / 260; i++) { q.strokeStyle = `rgba(120,98,66,${Math.random() * .07})`; q.lineWidth = .6; q.beginPath(); const a = Math.random() * w, b = Math.random() * h; q.moveTo(a, b); q.quadraticCurveTo(a + Math.random() * 8 - 4, b + Math.random() * 8 - 4, a + Math.random() * 14 - 7, b + Math.random() * 14 - 7); q.stroke(); }
    const gr = q.createRadialGradient(w * .45, h * .4, Math.min(w, h) * .25, w / 2, h / 2, Math.max(w, h) * .75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(110,84,40,.2)'); q.fillStyle = gr; q.fillRect(0, 0, w, h);
  }
  g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 10; g.shadowOffsetY = 4; g.drawImage(cv, x, y); g.restore();
}
function mgWood(g, x, y, w, h, base = '#4a2f1a') {
  const k = 'w' + base + w + 'x' + h; let cv = mgTexC[k];
  if (!cv) {
    cv = mgTexC[k] = document.createElement('canvas'); cv.width = w; cv.height = h; const q = cv.getContext('2d'); q.fillStyle = base; q.fillRect(0, 0, w, h);
    for (let yy = 0; yy < h; yy += 1) { const v = Math.sin(yy * .07 + Math.sin(yy * .011) * 5) * .5 + .5; q.fillStyle = `rgba(${20 + v * 30},${10 + v * 14},0,${.12 + v * .14})`; q.fillRect(0, yy, w, 1); }
    for (let i = 0; i < 26; i++) { q.strokeStyle = `rgba(15,8,2,${.08 + Math.random() * .12})`; q.beginPath(); const yy = Math.random() * h; q.moveTo(0, yy); q.bezierCurveTo(w * .3, yy + Math.random() * 10 - 5, w * .6, yy + Math.random() * 10 - 5, w, yy + Math.random() * 8 - 4); q.stroke(); }
  }
  g.drawImage(cv, x, y);
}
// 붉은 인영(도장 자국): 글자는 오른쪽 열부터 위→아래. pwr 이 낮으면 인주가 군데군데 빠지고, spread 가 크면 번진다
function mgSeal(txt, round, pwr = .85, sz = 64) {
  const c = document.createElement('canvas'); c.width = c.height = sz; const q = c.getContext('2d');
  q.strokeStyle = q.fillStyle = '#c4121c'; q.lineWidth = sz * .07;
  if (round) { q.beginPath(); q.arc(sz / 2, sz / 2, sz * .43, 0, 7); q.stroke(); } else { q.strokeRect(sz * .08, sz * .08, sz * .84, sz * .84); q.lineWidth = sz * .02; q.strokeRect(sz * .15, sz * .15, sz * .7, sz * .7); }
  const n = txt.length, cols = round ? 1 : Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), cell = (round ? .62 : .66) * sz / Math.max(rows, cols);
  q.font = `bold ${Math.floor(cell * .98)}px serif`; q.textAlign = 'center'; q.textBaseline = 'middle';
  for (let i = 0; i < n; i++) { const cl = cols - 1 - Math.floor(i / rows), rw = i % rows; q.save(); q.translate(sz / 2 + (cl - (cols - 1) / 2) * cell, sz / 2 + (rw - (rows - 1) / 2) * cell); q.scale(round ? 1.25 : 1, 1); q.fillText(txt[i], 0, 0); q.restore(); }
  q.globalCompositeOperation = 'destination-out'; const miss = clamp(1 - pwr, 0, 1);
  for (let i = 0; i < 50 + miss * 700; i++) { q.globalAlpha = Math.random() * (.25 + miss * .9); q.beginPath(); q.arc(Math.random() * sz, Math.random() * sz, Math.random() * sz * .035 + .4, 0, 7); q.fill(); }
  q.globalCompositeOperation = 'source-over'; q.globalAlpha = 1; return c;
}
function mgDrawSeal(g, sc, x, y, ang = 0, spread = 0, alpha = .92) {
  g.save(); g.translate(x, y); g.rotate(ang); g.globalAlpha = alpha; g.globalCompositeOperation = 'multiply';
  if (spread > 0) { g.shadowColor = 'rgba(200,20,30,.75)'; g.shadowBlur = spread; g.drawImage(sc, -sc.width / 2, -sc.height / 2); }
  g.drawImage(sc, -sc.width / 2, -sc.height / 2); g.restore();
}

function stampApprove({ title = '학생회실 — 1998 해교제 야간 잔류 승인원 검수 및 직인 날인' } = {}) {
  const p = open(title, '<b>1단계:</b> 기안문에서 <b style="color:#ff8a70">조작된 위조 조항 3줄(2·4·5번)</b>을 클릭(또는 <b>W·S로 고르고 F</b>)해 적색 교정펜으로 정정하라<br><b>2단계:</b> 직인 각도<b>(A·D / 휠)</b>를 0°에 맞추고 <b>인주</b>(클릭 / E)를 묻힌 뒤, <b>교장 결재란을 꾹 눌러(마우스 · Space 홀드)</b> 압력 70~95%에서 떼어 날인하라!');
  const c = canvas(540, 350), g = c.getContext('2d');
  screen3D(c, { kind: 'paper', prop: 'stamp' });
  const items = [
    { txt: '1. 행 사 명: 제30회 해교제 전야제 합동 리허설 및 방송 점검', bad: false },
    { txt: '2. 잔류시간: 22:00 이후 전교생 강제 심야 잔류 (귀가 금지)', bad: true, fix: '2. 잔류시간: 21:30 이전 전원 하교 완료 (심야 잔류 엄금)' },
    { txt: '3. 사용구역: 본관 3층 방송실 · 별관 음악실 · 대강당 무대', bad: false },
    { txt: '4. 안전수칙: 구름다리 방화문 및 서문 출입구를 쇠사슬로 영구 봉쇄함', bad: true, fix: '4. 안전수칙: 비상시 구름다리 방화문 및 전 출입구 상시 개방 유지' },
    { txt: '5. 담당명단: 3-2 윤하늘 (※ 명부에서 영구 말소 처리할 것)', bad: true, fix: '5. 담당명단: 3-2 윤하늘 · 강민아 · 이수아 (방송반 정원 3명)' },
    { txt: '6. 첨    부: 참가자 명단 1부 · 안전계획서 1부.  끝.', bad: false },
  ];
  const LY = i => 122 + i * 33;   // 본문 줄 위치 (줄 상단)
  let fixed = items.map(() => false), inked = false, stamped = false, cur = 1, fixAnim = items.map(() => 0);
  let sealAng = -24, pressing = false, pressPwr = 0, pressT0 = 0, lastT = performance.now(), mark = null, smudge = null, slam = 0;
  const S1 = mgSeal('김정호', true, .95, 34), S2 = mgSeal('박상철', true, .9, 34);
  const fixedN = () => fixed.filter(Boolean).length;

  const releaseStamp = () => {
    if (!pressing || stamped || !finish) return;
    pressing = false; pressPwr = .08 + (performance.now() - pressT0) / 1000 * .95;
    if (fixedN() < 3) { pressPwr = 0; sfx.buzz(); status('먼저 문서 본문의 위조 조항 3곳(2·4·5번)을 모두 클릭해 정정하세요!', 'err'); return; }
    if (!inked) { pressPwr = 0; sfx.buzz(); status('관인에 붉은 인주가 묻어 있지 않습니다! [인주 패드]를 먼저 누르세요.', 'err'); return; }
    if (Math.abs(sealAng) > 8) { pressPwr = 0; sfx.buzz(); status(`관인이 기울어져 있습니다(현재 ${sealAng}°)! [A/D] 또는 각도 버튼으로 0° 수직으로 맞추세요.`, 'err'); return; }
    slam = 1; sfx.knock ? sfx.knock() : sfx.click();
    if (pressPwr >= .65 && pressPwr <= .96) {
      stamped = true; mark = { sc: mgSeal('서린고등학교장', false, .72 + pressPwr * .25, 50), ang: sealAng * Math.PI / 180, spread: Math.max(0, (pressPwr - .8) * 18) };
      setTimeout(() => sfx.unlock(), 220);
      status('쾅! — 수직 정밀 날인 성공! 1998 해교제 승인원의 위조 조항이 바로잡혔다!', 'ok');
      setTimeout(() => close(true), 900);
    } else {
      sfx.buzz(); inked = pressPwr < .65 ? inked : false;
      smudge = { sc: mgSeal('서린고등학교장', false, pressPwr < .65 ? pressPwr * .5 : .9, 50), spread: pressPwr < .65 ? 0 : 14, t: 1.6, x: 470 - 90 * Math.random(), ang: sealAng * Math.PI / 180 };
      status(pressPwr < .65 ? '누르는 힘이 부족해 인영이 흐릿합니다! 초록 구간(70~95%)까지 꾹 누르세요.' : '너무 세게 눌러 인주가 번졌습니다! 초록 구간에서 떼세요.', 'err');
      pressPwr = 0;
    }
  };
  const toggleFix = idx => {
    if (stamped) return;
    if (items[idx].bad) {
      fixed[idx] = !fixed[idx]; fixAnim[idx] = 0; sfx.paper ? sfx.paper() : sfx.click();
      const cnt = fixedN();
      status(cnt === 3 ? '위조 조항 3곳 정정 완료! 우측 관인 각도를 0°로 맞추고 인주를 찍어 날인하세요.' : `위조 조항 정정 (${cnt}/3)`);
    } else { sfx.buzz(); status('이 조항은 정상적인 공식 기록입니다. 조작된 조항(2·4·5번)을 찾으세요.', 'err'); }
  };
  const ink = () => { if (stamped) return; inked = true; sfx.click(); status('관인에 붉은 인주를 골고루 묻혔다! 이제 하단 [결재란 날인]을 꾹 누르세요.'); };
  const turn = d => { sealAng = clamp(sealAng + d, -36, 36); sfx.dial(); };

  c.addEventListener('mousedown', e => {
    if (!finish || stamped) return;
    const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width, y = (e.clientY - rc.top) * c.height / rc.height;
    if (x >= 26 && x <= 364 && y >= LY(0) && y < LY(items.length)) { const idx = Math.floor((y - LY(0)) / 33); cur = idx; toggleFix(idx); return; }
    if (y >= 62 && y <= 98 && x >= 390 && x <= 455) { turn(-6); return; }
    if (y >= 62 && y <= 98 && x >= 460 && x <= 525) { turn(6); return; }
    if (Math.hypot(x - 456, y - 150) <= 36) { ink(); return; }
    if ((x >= 290 && x <= 366 && y >= 16 && y <= 84) || (x >= 392 && x <= 522 && y >= 200 && y <= 330)) { pressing = true; pressPwr = .08; pressT0 = performance.now(); }
  });
  const mu = () => { if (pressing) releaseStamp(); };
  addEventListener('mouseup', mu); cleanups.push(() => removeEventListener('mouseup', mu));
  c.addEventListener('wheel', e => { e.preventDefault(); turn(e.deltaY < 0 ? 6 : -6); }, { passive: false });

  keys(e => {
    const dn = e.type === 'keydown';
    if (dn && (e.code === 'KeyA' || e.code === 'ArrowLeft')) turn(-6);
    if (dn && (e.code === 'KeyD' || e.code === 'ArrowRight')) turn(6);
    if (dn && (e.code === 'KeyW' || e.code === 'ArrowUp')) { cur = (cur + items.length - 1) % items.length; sfx.click(); }
    if (dn && (e.code === 'KeyS' || e.code === 'ArrowDown')) { cur = (cur + 1) % items.length; sfx.click(); }
    if (dn && e.code === 'KeyF' && !e.repeat) toggleFix(cur);
    if (dn && e.code === 'KeyE') ink();
    if (e.code === 'Space' || e.code === 'Enter') {
      if (dn && !pressing && !e.repeat && !stamped) { pressing = true; pressPwr = .08; pressT0 = performance.now(); }
      else if (!dn && pressing) releaseStamp();
    }
  });

  const loop = now => {
    const dt = Math.min(.08, (now - lastT) / 1000); lastT = now;
    if (pressing && !stamped) { pressPwr = .08 + (now - pressT0) / 1000 * .95; if (pressPwr > 1.05) releaseStamp(); }
    slam = Math.max(0, slam - dt * 4); fixAnim = fixAnim.map(v => Math.min(1, v + dt * 3));
    const jx = slam * (Math.random() - .5) * 4, jy = slam * (Math.random() - .5) * 3;
    mgWood(g, 0, 0, c.width, c.height, '#3b2414');
    g.save(); g.translate(jx, jy);
    mgPaper(g, 14, 8, 360, 334, '#f4f1e8', 'gian');
    // 머리: 기관명 · 문서 제목 (타자된 공문서)
    g.fillStyle = '#1c1a18'; g.font = 'bold 15px "Noto Serif KR", Batang, serif'; g.fillText('기   안   용   지', 40, 40);
    g.font = '9.5px "Noto Serif KR", Batang, serif'; g.fillStyle = '#34302a';
    g.fillText('문서번호  서린학생 제1998-1012호', 32, 62); g.fillText('기안일자  1998. 10. 12.', 32, 75); g.fillText('수    신  학교장', 32, 88);
    g.strokeStyle = '#2a2622'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(28, 96); g.lineTo(362, 96); g.stroke();
    g.font = 'bold 11px "Noto Serif KR", Batang, serif'; g.fillStyle = '#1c1a18'; g.fillText('제  목  1998 야간 잔류 승인 기안서', 32, 112);
    // 결재란: [결재] 담당 · 교감 · 교장
    const bx = 228, by = 16;
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(bx, by, 136, 66);
    g.strokeStyle = '#2a2622'; g.lineWidth = 1.1; g.strokeRect(bx, by, 136, 66); g.strokeRect(bx, by, 16, 66);
    g.fillStyle = '#1c1a18'; g.font = '10px "Noto Serif KR", Batang, serif'; g.fillText('결', bx + 3, by + 28); g.fillText('재', bx + 3, by + 44);
    ['담당', '교감', '교장'].forEach((lb, i) => {
      const x0 = bx + 16 + i * 40; g.strokeRect(x0, by, 40, 16); g.strokeRect(x0, by + 16, 40, 50);
      g.fillStyle = '#1c1a18'; g.font = '10px "Noto Serif KR", Batang, serif'; g.fillText(lb, x0 + 9, by + 12);
    });
    mgDrawSeal(g, S1, bx + 36, by + 41, .12); mgDrawSeal(g, S2, bx + 76, by + 42, -.08, 0, .85);
    g.fillStyle = '#5a544a'; g.font = '7.5px sans-serif'; g.fillText('10/12', bx + 25, by + 63); g.fillText('10/12', bx + 65, by + 63);
    if (mark) mgDrawSeal(g, mark.sc, bx + 116, by + 41, mark.ang, mark.spread, .95);
    else if (!pressing) { g.strokeStyle = 'rgba(200,40,30,.35)'; g.setLineDash([3, 3]); g.strokeRect(bx + 99, by + 19, 34, 44); g.setLineDash([]); }
    // 본문: 타자 글씨 / 위조 줄은 적색 교정펜 두 줄 긋기 + 정정 문구
    items.forEach((ln, idx) => {
      const y = LY(idx), sel = idx === cur && !stamped;
      if (sel) { g.fillStyle = 'rgba(255,214,90,.22)'; g.fillRect(26, y, 338, 31); g.strokeStyle = 'rgba(190,130,20,.6)'; g.lineWidth = 1; g.strokeRect(26, y, 338, 31); }
      if (fixed[idx]) {
        g.fillStyle = '#6a645a'; g.font = '9.5px "Noto Serif KR", Batang, serif'; g.fillText(ln.txt, 32, y + 11);
        const w = Math.min(326, g.measureText(ln.txt).width) * fixAnim[idx];
        g.strokeStyle = '#d0141c'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(31, y + 7); g.lineTo(31 + w, y + 6); g.moveTo(31, y + 10); g.lineTo(31 + w, y + 9.5); g.stroke();
        g.save(); g.globalAlpha = fixAnim[idx]; g.fillStyle = '#c8141c'; g.font = '14px "East Sea Dokdo", cursive, sans-serif'; g.fillText(ln.fix, 34, y + 25); g.restore();
        g.strokeStyle = '#c8141c'; g.lineWidth = 1; g.beginPath(); g.arc(352, y + 16, 7, 0, 7); g.stroke(); g.fillStyle = '#c8141c'; g.font = 'bold 8px serif'; g.fillText('정', 348, y + 19);
      } else {
        g.fillStyle = '#1e1c19'; g.font = '10.4px "Noto Serif KR", Batang, serif'; g.fillText(ln.txt, 32, y + 19);
      }
      g.strokeStyle = 'rgba(80,70,60,.18)'; g.lineWidth = .6; g.beginPath(); g.moveTo(28, y + 31); g.lineTo(362, y + 31); g.stroke();
    });
    g.fillStyle = '#1c1a18'; g.font = 'bold 14px "Noto Serif KR", Batang, serif'; g.fillText('서 린 고 등 학 교 장', 120, 334);
    if (smudge) { smudge.t -= dt; mgDrawSeal(g, smudge.sc, smudge.x - 150, 292, smudge.ang, smudge.spread, clamp(smudge.t, 0, 1) * .8); if (smudge.t <= 0) smudge = null; }
    // 내려찍는 직인 그림자 (누르는 동안)
    if (pressing && !stamped) {
      const h = 1 - clamp(pressPwr, 0, 1);
      g.save(); g.translate(bx + 116, by + 41); g.rotate(sealAng * Math.PI / 180);
      g.fillStyle = `rgba(0,0,0,${.18 + (1 - h) * .3})`; g.fillRect(-25 - h * 8 + 6, -25 - h * 8 + 8 + h * 10, 50 + h * 16, 50 + h * 16);
      g.fillStyle = '#7a4a26'; g.globalAlpha = .55 + h * .3; g.fillRect(-20 - h * 10, -20 - h * 10 - h * 14, 40 + h * 20, 40 + h * 20); g.restore();
    }
    g.restore();

    // 우측: 책상 위 도구 — 각도 버튼 · 인주함 · 직인 · 압력계
    const fc = fixedN(), angOk = Math.abs(sealAng) <= 8;
    g.fillStyle = 'rgba(20,14,8,.55)'; g.fillRect(382, 12, 146, 324);
    g.fillStyle = fc === 3 ? '#8cffb8' : '#ffd890'; g.font = 'bold 11.5px sans-serif'; g.fillText(`1. 위조 정정: ${fc} / 3`, 392, 32);
    g.fillStyle = angOk ? '#8cffb8' : '#ffb090'; g.fillText(angOk ? `2. 관인 각도: ${sealAng}° (수직)` : `2. 관인 각도: ${sealAng}°`, 392, 52);
    [[392, '◀ 좌회전[A]'], [458, '우회전[D] ▶']].forEach(([x0, t]) => { const gr = g.createLinearGradient(0, 62, 0, 90); gr.addColorStop(0, '#d8b878'); gr.addColorStop(1, '#8a6a30'); g.fillStyle = gr; g.fillRect(x0, 62, 60, 28); g.strokeStyle = '#4a3410'; g.lineWidth = 1; g.strokeRect(x0, 62, 60, 28); g.fillStyle = '#20160a'; g.font = 'bold 10.5px sans-serif'; g.fillText(t, x0 + 4, 80); });
    // 인주함: 둥근 양철 케이스 + 붉은 스펀지
    g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
    const tin = g.createRadialGradient(448, 140, 6, 456, 150, 38); tin.addColorStop(0, '#e8e8e8'); tin.addColorStop(.7, '#8a8e92'); tin.addColorStop(1, '#3a3e42'); g.fillStyle = tin; g.beginPath(); g.arc(456, 150, 36, 0, 7); g.fill(); g.restore();
    const sp = g.createRadialGradient(450, 144, 3, 456, 150, 28); sp.addColorStop(0, inked ? '#e8343a' : '#b8282a'); sp.addColorStop(1, '#6a0a10'); g.fillStyle = sp; g.beginPath(); g.arc(456, 150, 28, 0, 7); g.fill();
    for (let i = 0; i < 40; i++) { const a = i * 2.4, rr = (i * 7 % 26); g.fillStyle = 'rgba(40,0,0,.25)'; g.fillRect(456 + Math.cos(a) * rr, 150 + Math.sin(a) * rr, 1.4, 1.4); }
    g.fillStyle = '#fff2e0'; g.font = 'bold 9.5px sans-serif'; g.fillText(inked ? '인주 묻음 ✓' : '3. 인주 [E]', 428, 194);
    // 직인(나무 손잡이 · 위에서 본 모습) — 각도대로 돈다
    g.save(); g.translate(456, 262); g.rotate(sealAng * Math.PI / 180);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(-21, -17, 44, 44);
    const wd = g.createLinearGradient(-20, -20, 20, 20); wd.addColorStop(0, '#b07a44'); wd.addColorStop(1, '#5a3418'); g.fillStyle = wd; g.fillRect(-20, -20, 40, 40);
    g.strokeStyle = inked ? '#c4121c' : '#3a200c'; g.lineWidth = 3; g.strokeRect(-20, -20, 40, 40);
    const kn = g.createRadialGradient(-4, -4, 2, 0, 0, 13); kn.addColorStop(0, '#d8a060'); kn.addColorStop(1, '#6a3c18'); g.fillStyle = kn; g.beginPath(); g.arc(0, 0, 13, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -17, 2.2, 0, 7); g.fill();   // 위쪽 표시 홈
    g.restore();
    // 압력 게이지
    g.fillStyle = '#10161a'; g.fillRect(392, 206, 126, 16); g.fillStyle = 'rgba(80,255,150,0.35)'; g.fillRect(392 + 126 * .65, 206, 126 * .30, 16);
    g.fillStyle = pressPwr >= .65 && pressPwr <= .96 ? '#58ff9a' : '#ff6848'; g.fillRect(392, 206, 126 * clamp(pressPwr, 0, 1), 16); g.strokeStyle = '#c8b890'; g.lineWidth = 1; g.strokeRect(392, 206, 126, 16);
    g.fillStyle = '#ffe8c8'; g.font = 'bold 10.5px sans-serif'; g.fillText('4. 결재란 날인', 392, 304); g.font = '10px sans-serif'; g.fillText('[마우스/Space 홀드]', 392, 318); g.fillText('초록 구간에서 떼기!', 392, 331);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return p;
}

function omrGrade({ title = '교무실 — 1998학년도 기말고사 OMR 답안지 판독 및 복원' } = {}) {
  const p = open(title, '<b>1) 적색 채점 필름(상단 슬라이더 또는 A·D)</b>을 움직여 좌우 기준점(⊕)에 정렬한 뒤,<br><b>2) [1번 수정테이프]</b>로 오답 마킹을 지우고 <b>[2번 컴퓨터용 사인펜]</b>으로 붉은 정답 구멍에 마킹하여 <b>[Space / 광학 판독]</b>을 실행하라!<br>키보드: <b>방향키</b>로 칸 이동 · <b>F</b>로 선택한 도구 사용');
  const c = canvas(520, 350), g = c.getContext('2d');
  screen3D(c, { kind: 'paper', prop: 'omr' });
  const ans = [3, 1, 5, 2, 4];
  const marks = [[2], [1], [4], [5], [4]];   // 복수 마킹이나 오답이 있으면 수정테이프로 먼저 지워야 함
  const taped = new Set(), inkSeed = {};
  let filmOff = -38, tool = 1, scanY = -1, lastT = performance.now(), cq = 0, cc = 2, penT = 0;
  const RY = q => 128 + q * 32, CX = ch => 150 + (ch - 1) * 46;
  const tryScan = () => {
    if (!finish || scanY >= 0) return;
    if (Math.abs(filmOff) > 7) { sfx.buzz(); status('먼저 투명 적색 채점 필름을 좌우 기준점(⊕ 0mm)에 정확히 정렬하세요!', 'err'); return; }
    const allOk = ans.every((a, q) => marks[q].length === 1 && marks[q][0] === a);
    if (!allOk) { sfx.buzz(); status('오답 마킹이 남아 있거나 정답 칸이 비어 있습니다! [1: 수정테이프]로 오답을 지우고 [2: 사인펜]으로 마킹하세요.', 'err'); return; }
    sfx.unlock(); scanY = 100;
  };
  const useTool = (q, choice) => {
    cq = q; cc = choice; const has = marks[q].includes(choice), k = q + '-' + choice;
    if (tool === 1) {
      if (has) { marks[q] = marks[q].filter(v => v !== choice); taped.add(k); sfx.paper ? sfx.paper() : sfx.click(); }
      else { sfx.buzz(); status('수정테이프는 이미 칠해진 검은 마킹을 지울 때 사용합니다. 마킹하려면 [2번 사인펜]으로 바꾸세요!', 'err'); }
    } else if (!has) { marks[q].push(choice); inkSeed[k] = Math.random() * 1000; penT = 1; sfx.click(); }
  };
  const setTool = t => { tool = t; sfx.click(); status(t === 1 ? '도구 선택: [1] 수정테이프 — 잘못 칠해진 검은 마킹을 클릭해 지우세요.' : '도구 선택: [2] 컴퓨터용 수성사인펜 — 붉은 채점 구멍 위치에 마킹하세요.'); };

  c.addEventListener('mousedown', e => {
    if (!finish || scanY >= 0) return;
    const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width, y = (e.clientY - rc.top) * c.height / rc.height;
    if (y >= 62 && y <= 92 && x >= 220 && x <= 460) { filmOff = Math.round(clamp(((x - 340) / 110) * 48, -48, 48)); sfx.dial(); return; }
    if (y >= 292) { if (x < 175) setTool(1); else if (x < 350) setTool(2); else tryScan(); return; }
    for (let q = 0; q < 5; q++) if (Math.abs(y - RY(q)) <= 14) for (let ch = 1; ch <= 5; ch++) if (Math.abs(x - CX(ch)) <= 18) { useTool(q, ch); return; }
  });
  keys(e => {
    if (e.type !== 'keydown' || scanY >= 0) return;
    if (e.code === 'KeyA') { filmOff = clamp(filmOff - 6, -48, 48); sfx.dial(); }
    else if (e.code === 'KeyD') { filmOff = clamp(filmOff + 6, -48, 48); sfx.dial(); }
    else if (e.code === 'ArrowLeft') cc = Math.max(1, cc - 1);
    else if (e.code === 'ArrowRight') cc = Math.min(5, cc + 1);
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') cq = Math.max(0, cq - 1);
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') cq = Math.min(4, cq + 1);
    else if (e.code === 'KeyF' && !e.repeat) useTool(cq, cc);
    else if (e.code === 'Digit1') setTool(1);
    else if (e.code === 'Digit2') setTool(2);
    else if (e.code === 'Space' || e.code === 'Enter') tryScan();
  });
  // 컴퓨터용 사인펜 자국: 타원 안을 결 따라 여러 번 칠한 검은 잉크 (가장자리가 살짝 삐져나옴)
  const penMark = (cx, cy, seed) => {
    let r = seed; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
    g.save(); g.fillStyle = '#16151a'; g.beginPath(); g.ellipse(cx, cy, 8.6 + rnd(), 12 + rnd() * 1.2, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(20,20,26,.85)'; g.lineCap = 'round'; g.lineWidth = 2.2;
    for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(cx - 8 + rnd() * 3, cy - 9 + k * 4.5); g.lineTo(cx + 7 + rnd() * 3, cy - 10 + k * 4.5 + rnd() * 2); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.beginPath(); g.ellipse(cx - 2, cy - 4, 4, 5, -.3, 3.6, 4.6); g.stroke(); g.restore();
  };
  const loop = now => {
    const dt = Math.min(.08, (now - lastT) / 1000); lastT = now; penT = Math.max(0, penT - dt * 3);
    if (scanY >= 0) { scanY += dt * 260; if (scanY > 285 && finish) { status('삐빅— OMR 광학 판독 100% 일치! 답안지 뒷면의 비밀 시간 기록이 드러난다!', 'ok'); close(true); return; } }
    mgWood(g, 0, 0, c.width, c.height, '#3a2616');
    mgPaper(g, 12, 6, 496, 282, '#fbf3f1', 'omr');
    const PK = '#d9506e', PKL = '#e98aa0';
    // 타이밍 마크 (판독기가 줄을 세는 검은 막대)
    g.fillStyle = '#121214'; for (let q = 0; q < 5; q++) g.fillRect(18, RY(q) - 4, 14, 8); for (let k = 0; k < 18; k++) g.fillRect(44 + k * 25, 276, 9, 7);
    // 머리: 붉은 인쇄 (교과 · 학번 · 주의사항)
    g.strokeStyle = PK; g.lineWidth = 2; g.strokeRect(40, 14, 460, 256); g.lineWidth = .8; g.strokeRect(43, 17, 454, 250);
    g.fillStyle = PK; g.fillRect(46, 20, 448, 26); g.fillStyle = '#fff6f8'; g.font = 'bold 13px "Noto Serif KR", serif'; g.fillText('1998학년도 제2학기 기말고사 OMR 답안지 (서린고등학교)', 62, 38);
    g.fillStyle = PK; g.font = '9px sans-serif'; g.fillText('※ 컴퓨터용 사인펜만 사용 · 수정은 수정테이프로', 50, 58);
    // 채점 필름 정렬 슬라이더 (⊕ 기준점)
    const filmAligned = Math.abs(filmOff) <= 7;
    g.strokeStyle = PK; g.lineWidth = 1; g.strokeRect(230, 66, 220, 14); g.beginPath(); g.moveTo(340, 60); g.lineTo(340, 86); g.moveTo(330, 73); g.lineTo(350, 73); g.stroke(); g.beginPath(); g.arc(340, 73, 5, 0, 7); g.stroke();
    g.fillStyle = filmAligned ? '#1f8a50' : '#9a3a20'; g.font = 'bold 10.5px sans-serif'; g.fillText(`채점 필름[A/D] ${filmOff > 0 ? '+' : ''}${filmOff}mm`, 50, 77);
    // 문번 · 답란 머리줄
    g.fillStyle = PK; g.font = 'bold 10px sans-serif'; g.fillText('문번', 54, 104); g.fillText('답      란', 230, 104);
    g.strokeStyle = PKL; g.lineWidth = .8; g.beginPath(); g.moveTo(46, 108); g.lineTo(494, 108); g.moveTo(98, 92); g.lineTo(98, 268); g.moveTo(386, 92); g.lineTo(386, 268); g.stroke();
    for (let q = 0; q < 5; q++) {
      const y = RY(q), isOk = marks[q].length === 1 && marks[q][0] === ans[q], isMulti = marks[q].length > 1;
      if (q % 2) { g.fillStyle = 'rgba(233,138,160,.10)'; g.fillRect(46, y - 15, 448, 30); }
      g.fillStyle = PK; g.font = 'bold 13px "Noto Serif KR", serif'; g.fillText(String(q + 1), 66, y + 5);
      for (let ch = 1; ch <= 5; ch++) {
        const cx = CX(ch), k = q + '-' + ch;
        g.strokeStyle = PK; g.lineWidth = 1.2; g.beginPath(); g.ellipse(cx, y, 9, 12.5, 0, 0, 7); g.stroke();
        g.fillStyle = PK; g.font = '10px sans-serif'; g.fillText(String(ch), cx - 3, y + 4);
        if (taped.has(k)) { g.save(); g.translate(cx, y); g.rotate(.06 * (ch - 3)); g.fillStyle = 'rgba(252,252,250,.97)'; g.shadowColor = 'rgba(0,0,0,.25)'; g.shadowBlur = 2; g.fillRect(-12, -15, 24, 30); g.restore(); g.strokeStyle = 'rgba(160,160,170,.35)'; g.lineWidth = .6; g.beginPath(); g.ellipse(cx, y, 9, 12.5, 0, 0, 7); g.stroke(); }
        if (marks[q].includes(ch)) penMark(cx, y, inkSeed[k] || (q * 7 + ch * 13));
        if (q === cq && ch === cc && scanY < 0) { g.strokeStyle = tool === 1 ? '#2a72c8' : '#111'; g.lineWidth = 1.5; g.setLineDash([3, 2]); g.strokeRect(cx - 15, y - 16, 30, 32); g.setLineDash([]); }
      }
      g.fillStyle = isOk ? '#1e7e46' : isMulti ? '#c86010' : '#c62828'; g.font = 'bold 10.5px sans-serif';
      g.fillText(isOk ? '● 정답일치' : isMulti ? '▲ 복수마킹(지우기!)' : marks[q].length === 0 ? '○ 미기입(마킹!)' : '× 오답(지우기!)', 392, y + 4);
    }
    // 투명 적색 채점 필름: 정답 자리에 구멍이 뚫린 붉은 셀로판 (filmOff 만큼 밀려 있다)
    g.save(); g.beginPath(); g.rect(100 + filmOff, 112, 282, 152); ans.forEach((a, q) => { g.moveTo(CX(a) + filmOff + 11, RY(q)); g.arc(CX(a) + filmOff, RY(q), 11, 0, Math.PI * 2, true); });
    g.fillStyle = 'rgba(225,20,40,.2)'; g.fill('evenodd'); g.strokeStyle = 'rgba(200,20,30,.5)'; g.lineWidth = 1; g.strokeRect(100 + filmOff, 112, 282, 152);
    ans.forEach((a, q) => { g.strokeStyle = filmAligned ? 'rgba(230,20,30,.95)' : 'rgba(230,80,40,.6)'; g.lineWidth = 1.6; g.beginPath(); g.arc(CX(a) + filmOff, RY(q), 11, 0, 7); g.stroke(); });
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(100 + filmOff, 112, 282, 6); g.restore();
    g.fillStyle = filmAligned ? '#1f8a50' : '#d03020'; g.beginPath(); g.moveTo(340 + (filmOff / 48) * 110, 64); g.lineTo(334 + (filmOff / 48) * 110, 56); g.lineTo(346 + (filmOff / 48) * 110, 56); g.fill();
    g.fillRect(340 + (filmOff / 48) * 110 - 1, 64, 2, 20);
    if (scanY >= 0) { const gr = g.createLinearGradient(0, scanY - 14, 0, scanY + 6); gr.addColorStop(0, 'rgba(80,255,140,0)'); gr.addColorStop(1, 'rgba(80,255,140,.6)'); g.fillStyle = gr; g.fillRect(40, scanY - 14, 460, 20); }
    // 하단 도구: 수정테이프 · 컴퓨터용 사인펜 · 판독
    const allOk = filmAligned && ans.every((a, q) => marks[q].length === 1 && marks[q][0] === a);
    [[20, 152, tool === 1, '1. 수정테이프 (오답지우기)'], [180, 162, tool === 2, '2. 컴퓨터용 사인펜 (마킹)'], [350, 150, allOk, '3. OMR 광학 판독 [Space]']].forEach(([bx, bw, on, lbl], i) => {
      g.fillStyle = on ? (i === 2 ? '#24824c' : '#3a2a1c') : 'rgba(18,14,10,.75)'; g.fillRect(bx, 294, bw, 46);
      g.strokeStyle = on ? '#ffd890' : '#6a5a48'; g.lineWidth = on ? 2 : 1; g.strokeRect(bx, 294, bw, 46);
      if (i === 0) { g.fillStyle = '#2a6ad0'; g.fillRect(bx + 8, 300, 26, 13); g.fillStyle = '#f8f8f4'; g.beginPath(); g.arc(bx + 26, 306, 4.5, 0, 7); g.fill(); }
      if (i === 1) { g.save(); g.translate(bx + 24, 307); g.rotate(-.5 - penT * .3); g.fillStyle = '#121212'; g.fillRect(-14, -3, 24, 6); g.fillStyle = '#e8e8e8'; g.fillRect(-18, -3, 5, 6); g.fillStyle = '#000'; g.beginPath(); g.moveTo(10, -3); g.lineTo(15, 0); g.lineTo(10, 3); g.fill(); g.restore(); }
      g.fillStyle = '#fff4e4'; g.font = 'bold 10.5px sans-serif'; g.fillText(lbl, bx + 8, 334);
    });
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return p;
}

function timetableRestore({ title = '교실 게시판 — 1998년 10월 12일 학급 시간표 & 당번 자석 복원' } = {}) {
  const p = open(title, '<b>1) 하단 자석 명패(1~5번 클릭 또는 숫자키)</b> 중 단서에 맞는 과목/당번 자석을 먼저 선택한 뒤,<br><b>2) 위쪽 시간표의 알맞은 교시 칸</b>을 클릭(또는 <b>W·S로 칸을 고르고 F</b>)해 부착하고, 4칸을 모두 올바르게 채운 뒤 <b>[Space / 황동 압정 잠금]</b>을 눌러라!');
  const c = canvas(520, 350), g = c.getContext('2d');
  screen3D(c, { kind: 'paper', prop: 'magnets' });
  const slots = [
    { period: '1교시 (09:00)', hint: '시약 중화 적정 실험 (화학실 이동 수업)', want: '화 학 I', placed: '화 학 I', locked: true },
    { period: '2교시 (10:00)', hint: '1998 현대문학 시 강독 (교실 수업)', want: '국 어 II', placed: null, locked: false },
    { period: '3교시 (11:00)', hint: '합창부 해교제 지정곡 리허설 (별관 음악실)', want: '음 악', placed: null, locked: false },
    { period: '4교시 (13:00)', hint: '방송부 30주년 기념방송 송출 점검 (3F 방송실)', want: '방송반 점검', placed: null, locked: false },
    { period: '야간 (21:00)', hint: '심야 교실 소등 및 마지막 하교 방송 당번', want: '주번: 윤하늘', placed: null, locked: false },
  ];
  const magnets = ['국 어 II', '음 악', '방송반 점검', '주번: 윤하늘', '수 학 I (휴강)'];
  const MC = { '화 학 I': ['#e07a22', '#fff'], '국 어 II': ['#c8323a', '#fff'], '음 악': ['#f0c428', '#2a2008'], '방송반 점검': ['#2e66c0', '#fff'], '주번: 윤하늘': ['#2c8a52', '#fff'], '수 학 I (휴강)': ['#7a4aa8', '#fff'] };
  let selMag = 0, curSlot = 1, snap = -1, snapT = 0, lastT = performance.now();
  const strip = (x, y, w, h, name, lift = 0, tilt = 0) => {   // 고무 자석 띠: 광택 · 두께 · 그림자
    const [col, tc] = MC[name] || ['#888', '#fff'];
    g.save(); g.translate(x + w / 2, y + h / 2 - lift); g.rotate(tilt);
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 3 + lift * 2; g.shadowOffsetY = 2 + lift * 1.5;
    g.fillStyle = col; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 4); g.fill(); g.shadowColor = 'transparent';
    const gl = g.createLinearGradient(0, -h / 2, 0, h / 2); gl.addColorStop(0, 'rgba(255,255,255,.38)'); gl.addColorStop(.45, 'rgba(255,255,255,.06)'); gl.addColorStop(1, 'rgba(0,0,0,.22)');
    g.fillStyle = gl; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 4); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke();
    g.fillStyle = tc; g.font = 'bold 11px sans-serif'; g.textAlign = 'center'; g.fillText(name, 0, 4); g.restore();
  };
  function draw() {
    mgWood(g, 0, 0, c.width, c.height, '#6a6250');
    // 알루미늄 테두리 + 하얀 법랑 자석 보드
    const fr = g.createLinearGradient(0, 8, 0, 330); fr.addColorStop(0, '#dfe3e6'); fr.addColorStop(.5, '#9aa2a8'); fr.addColorStop(1, '#c8ccd0');
    g.fillStyle = fr; g.fillRect(10, 8, 500, 236);
    const wb = g.createLinearGradient(18, 16, 500, 236); wb.addColorStop(0, '#f6f8f6'); wb.addColorStop(.6, '#e8ece8'); wb.addColorStop(1, '#dde2de');
    g.fillStyle = wb; g.fillRect(18, 16, 484, 220);
    g.fillStyle = 'rgba(120,130,150,.06)'; for (let i = 0; i < 7; i++) g.fillRect(40 + i * 70, 16, 18, 220);   // 지워지다 만 마커 얼룩
    g.fillStyle = '#1c2a40'; g.font = 'bold 14px "Noto Serif KR", serif'; g.fillText('3학년 2반 시간표 — 1998. 10. 12 (월)', 30, 40);
    g.strokeStyle = '#2a3a58'; g.lineWidth = 1.4; g.strokeRect(28, 50, 464, 178);
    g.beginPath(); g.moveTo(124, 50); g.lineTo(124, 228); g.moveTo(356, 50); g.lineTo(356, 228); g.stroke();
    slots.forEach((s, i) => {
      const y = 72 + i * 35, ok = s.placed === s.want;
      if (i) { g.strokeStyle = 'rgba(42,58,88,.55)'; g.lineWidth = .8; g.beginPath(); g.moveTo(28, y - 17); g.lineTo(492, y - 17); g.stroke(); }
      if (i === curSlot) { g.fillStyle = 'rgba(255,210,80,.25)'; g.fillRect(29, y - 16, 462, 34); }
      g.fillStyle = '#1c2a40'; g.font = 'bold 11px sans-serif'; g.fillText(s.period, 34, y + 5);
      g.fillStyle = '#1d3f8a'; g.font = '15px "East Sea Dokdo", cursive, sans-serif'; g.fillText(s.hint, 130, y + 6);   // 보드마커 손글씨 단서
      if (s.placed) strip(362, y - 11, 116, 23, s.placed, 0, ok ? (i % 2 ? .01 : -.012) : .08);
      else { g.strokeStyle = 'rgba(42,58,88,.4)'; g.setLineDash([4, 3]); g.strokeRect(362, y - 11, 116, 23); g.setLineDash([]); g.fillStyle = 'rgba(40,50,70,.55)'; g.font = '10px sans-serif'; g.fillText(`[클릭: ${magnets[selMag]}]`, 366, y + 4); }
      if (s.placed && !ok) { g.strokeStyle = '#d02020'; g.lineWidth = 2; g.beginPath(); g.moveTo(482, y - 8); g.lineTo(490, y + 6); g.moveTo(490, y - 8); g.lineTo(482, y + 6); g.stroke(); }
      if (snap === i && snapT > 0) { g.strokeStyle = `rgba(255,255,255,${snapT})`; g.lineWidth = 2; g.strokeRect(360 - (1 - snapT) * 6, y - 13 - (1 - snapT) * 6, 120 + (1 - snapT) * 12, 27 + (1 - snapT) * 12); }
    });
    // 보드 아래 알루미늄 분필받이(자석 트레이)
    const tr = g.createLinearGradient(0, 248, 0, 320); tr.addColorStop(0, '#cdd2d6'); tr.addColorStop(.3, '#8e969c'); tr.addColorStop(1, '#5a6066');
    g.fillStyle = tr; g.fillRect(14, 250, 492, 70); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(14, 250, 492, 3);
    g.fillStyle = '#1c2228'; g.font = 'bold 10.5px sans-serif'; g.fillText('1단계 — 부착할 자석 명패 선택 (클릭 또는 1~5 키):', 24, 266);
    magnets.forEach((m, idx) => {
      const mx = 44 + idx * 72, isSel = selMag === idx, usedOk = slots.some(s => s.placed === m && s.want === m);
      if (usedOk && !isSel) { g.strokeStyle = 'rgba(0,0,0,.3)'; g.setLineDash([3, 3]); g.strokeRect(mx, 278, 66, 26); g.setLineDash([]); return; }
      strip(mx, 278, 66, 26, m, isSel ? 5 : 0); g.fillStyle = '#10161c'; g.font = 'bold 9px sans-serif'; g.fillText(`[${idx + 1}]`, mx + 2, 314);
      if (isSel) { g.strokeStyle = '#ffd040'; g.lineWidth = 2; g.strokeRect(mx - 2, 271, 70, 30); }
    });
    // 황동 압정 잠금 버튼
    const allOk = slots.every(s => s.placed === s.want);
    g.fillStyle = allOk ? '#2a7a48' : 'rgba(30,36,42,.85)'; g.fillRect(406, 270, 92, 40); g.strokeStyle = allOk ? '#90ffc0' : '#3a444c'; g.lineWidth = 2; g.strokeRect(406, 270, 92, 40);
    const br = g.createRadialGradient(420, 286, 1, 422, 290, 9); br.addColorStop(0, '#fff2b0'); br.addColorStop(.5, '#d0a030'); br.addColorStop(1, '#6a4a10'); g.fillStyle = br; g.beginPath(); g.arc(422, 290, 8, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.font = 'bold 10.5px sans-serif'; g.fillText(allOk ? '확정[Space]' : '압정 잠금', 434, 294);
  }
  const tryConfirm = () => {
    if (slots.every(s => s.placed === s.want)) { sfx.unlock(); status('찰칵! — 10월 12일 시간표와 야간 주번 자석이 황동 압정으로 고정되었다!', 'ok'); setTimeout(() => close(true), 450); }
    else { sfx.buzz(); status('아직 비어 있거나 잘못 배정된 교시가 있습니다! 각 교시 힌트에 맞는 자석을 골라 넣으세요.', 'err'); }
  };
  const place = i => {
    const chosen = magnets[selMag]; curSlot = i;
    slots.forEach((s, si) => { if (!s.locked && si !== i && s.placed === chosen) s.placed = null; });   // 다른 칸에 붙어 있으면 떼어 온다
    slots[i].placed = chosen; snap = i; snapT = 1;
    if (chosen === slots[i].want) { sfx.click(); status(`${slots[i].period}에 [${chosen}] 자석이 정확히 장착되었습니다!`, 'ok'); }
    else { sfx.buzz(); status(`[${chosen}] 자석은 ${slots[i].period} 힌트와 맞지 않습니다! 다른 자석을 선택해 교체하세요.`, 'err'); }
  };
  c.addEventListener('click', e => {
    if (!finish) return;
    const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width, y = (e.clientY - rc.top) * c.height / rc.height;
    if (y >= 265 && y <= 315) {
      if (x >= 404) { tryConfirm(); return; }
      const mIdx = Math.floor((x - 44) / 72);
      if (mIdx >= 0 && mIdx < magnets.length) { selMag = mIdx; sfx.click(); }
      return;
    }
    for (let i = 1; i < slots.length; i++) if (Math.abs(y - (72 + i * 35)) <= 15) { place(i); return; }
  });
  keys(e => {
    if (e.type !== 'keydown') return;
    if (/^(Digit|Numpad)[1-5]$/.test(e.code)) { selMag = +e.code.slice(-1) - 1; sfx.click(); }
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { selMag = (selMag + magnets.length - 1) % magnets.length; sfx.click(); }
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') { selMag = (selMag + 1) % magnets.length; sfx.click(); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') { curSlot = Math.max(1, curSlot - 1); sfx.click(); }
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') { curSlot = Math.min(slots.length - 1, curSlot + 1); sfx.click(); }
    else if (e.code === 'KeyF' && !e.repeat) place(curSlot);
    else if (e.code === 'Space' || e.code === 'Enter') tryConfirm();
  });
  const loop = now => { const dt = Math.min(.08, (now - lastT) / 1000); lastT = now; snapT = Math.max(0, snapT - dt * 3); draw(); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop); return p;
}

function libraryCatalog({ title = '도서실 — KDC 청구기호 도서 대출 카드 & 금서 서가 배열' } = {}) {
  const p = open(title, '<b>1단계:</b> 목록 카드 윗부분을 클릭해 두 장씩 자리를 바꿔 <b>KDC 청구기호 오름차순(100→300→400→800→900)</b>으로 배열하라<br><b>2단계:</b> 각 카드 아래 <b>[▲ / ▼]</b>로 카드 높이를 바꿔 <b>아래 구멍을 황동 고정봉</b>에 맞춘 뒤 <b>[Space / 서가 잠금 해제]</b>를 눌러라!<br>키보드: <b>A·D</b> 카드 고르기 · <b>F</b> 집기/바꾸기 · <b>W·S</b> 높이');
  const c = canvas(520, 340), g = c.getContext('2d');
  screen3D(c, { kind: 'paper', prop: 'cards' });
  const books = [
    { code: 400, label: '400 자연과학', sub: '화학실험 편람', col: '#244a38', tagLv: 1, au: '이상훈', yr: '1994' },
    { code: 100, label: '100 철학·심리', sub: '융의 그림자 원형', col: '#4a2c38', tagLv: 0, au: '정민수', yr: '1991' },
    { code: 900, label: '900 역사·교사', sub: '서린고 30년사', col: '#5a3a22', tagLv: 2, au: '서린고', yr: '1998' },
    { code: 300, label: '300 사회·교육', sub: '1998 학생생활규정', col: '#243c58', tagLv: 1, au: '교무부', yr: '1998' },
    { code: 800, label: '800 문학·희곡', sub: '제30회 해교제 대본', col: '#544626', tagLv: 0, au: '방송부', yr: '1998' },
  ];
  const ORD = [100, 300, 400, 800, 900], ROD = 166;
  let sel = -1, cur = 0, lastT = performance.now();
  const shown = books.map((b, i) => ({ x: 46 + i * 88, y: 34 + b.tagLv * 13 }));   // 애니메이션용 위치
  function draw(dt) {
    mgWood(g, 0, 0, c.width, c.height, '#2a1a0e');
    // 서랍 속 (어두운 내부 · 옆판)
    g.fillStyle = '#1a0f07'; g.fillRect(20, 14, 480, 196);
    const side = g.createLinearGradient(20, 0, 60, 0); side.addColorStop(0, '#6a4424'); side.addColorStop(1, '#3a2412'); g.fillStyle = side; g.fillRect(20, 14, 18, 196); g.save(); g.scale(-1, 1); g.fillStyle = side; g.fillRect(-500, 14, 18, 196); g.restore();
    // 황동 고정봉 (카드 아래 구멍을 꿰는 막대)
    const rodG = () => { const rg = g.createLinearGradient(0, ROD - 4, 0, ROD + 4); rg.addColorStop(0, '#fff0b0'); rg.addColorStop(.5, '#c09030'); rg.addColorStop(1, '#5a3c10'); g.fillStyle = rg; g.fillRect(30, ROD - 3.5, 460, 7); };
    rodG();
    books.forEach((b, i) => {
      const t = shown[i], tx = 46 + i * 88, ty = 34 + b.tagLv * 13 - (sel === i ? 12 : 0);
      t.x += (tx - t.x) * Math.min(1, dt * 12); t.y += (ty - t.y) * Math.min(1, dt * 12);
      const bx = t.x, by = t.y, bw = 72, bh = 150, orderOk = ORD[i] === b.code, tagOk = b.tagLv === 1;
      g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 6; g.shadowOffsetY = 3; mgPaper(g, bx, by, bw, bh, '#f1e9d2', 'card'); g.restore();
      g.strokeStyle = '#c03030'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(bx + 3, by + 26); g.lineTo(bx + bw - 3, by + 26); g.stroke();   // 붉은 머리줄
      g.strokeStyle = 'rgba(70,110,170,.35)'; g.lineWidth = .6; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(bx + 3, by + 40 + k * 13); g.lineTo(bx + bw - 3, by + 40 + k * 13); g.stroke(); }
      g.strokeStyle = 'rgba(192,48,48,.4)'; g.beginPath(); g.moveTo(bx + 18, by + 28); g.lineTo(bx + 18, by + 132); g.stroke();
      g.fillStyle = '#16120e'; g.font = 'bold 12px "Courier New", monospace'; g.fillText(String(b.code), bx + 4, by + 20); g.font = '9px "Courier New", monospace'; g.fillText('c.' + (b.code / 100), bx + 46, by + 20);
      const T = s2 => (window.__i18n ? window.__i18n.tr(s2) : s2), words = T(b.sub).split(/(?<=\S)(?=\s)|(?<=[가-힣]{4})/), lines = ['']; g.font = '9.5px "Noto Serif KR", serif';
      words.forEach(w => { const t2 = lines[lines.length - 1] + w; if (g.measureText(t2).width > bw - 24 && lines[lines.length - 1]) lines.push(w.trim()); else lines[lines.length - 1] = t2; });
      lines.slice(0, 3).forEach((ln, k) => g.fillText(ln.trim(), bx + 21, by + 38 + k * 13));
      g.font = '8.5px "Noto Serif KR", serif'; g.fillStyle = '#3a342c'; g.fillText(T(b.au + ' 저'), bx + 21, by + 77); g.fillText(b.yr + '.', bx + 21, by + 90); g.fillText(T(b.label.split(' ')[1]), bx + 21, by + 103);
      // 아래 구멍: 고정봉에 맞으면 봉이 구멍을 지나간다
      const hy = by + 119; g.fillStyle = '#1a0f07'; g.beginPath(); g.arc(bx + bw / 2, hy, 5, 0, 7); g.fill();
      if (tagOk && Math.abs(hy - ROD) < 2) { g.save(); g.beginPath(); g.arc(bx + bw / 2, hy, 5, 0, 7); g.clip(); rodG(); g.restore(); }
      g.strokeStyle = sel === i ? '#ffd040' : i === cur ? 'rgba(255,220,120,.8)' : orderOk && tagOk ? 'rgba(60,160,90,.8)' : 'rgba(80,60,40,.6)'; g.lineWidth = sel === i ? 3 : i === cur ? 2 : 1; g.strokeRect(bx, by, bw, bh);
    });
    // 서랍 앞판 (참나무 · 황동 손잡이 · 색인 꽂이)
    const fg = g.createLinearGradient(0, 200, 0, 276); fg.addColorStop(0, '#8a5a30'); fg.addColorStop(1, '#4a2c14'); g.fillStyle = fg; g.fillRect(14, 200, 492, 76);
    g.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 9; k++) g.fillRect(14, 206 + k * 8, 492, 1);
    books.forEach((b, i) => { const bx = 46 + i * 88; [[bx + 6, '▲'], [bx + 38, '▼']].forEach(([x0, t]) => { const br = g.createLinearGradient(0, 214, 0, 240); br.addColorStop(0, '#f0d890'); br.addColorStop(1, '#8a6420'); g.fillStyle = br; g.fillRect(x0, 216, 28, 24); g.strokeStyle = '#3a2408'; g.lineWidth = 1; g.strokeRect(x0, 216, 28, 24); g.fillStyle = '#2a1a06'; g.font = 'bold 11px sans-serif'; g.fillText(t, x0 + 8, 232); }); });
    g.fillStyle = '#d8c690'; g.fillRect(212, 246, 96, 22); g.strokeStyle = '#7a5a1c'; g.lineWidth = 2; g.strokeRect(212, 246, 96, 22); g.fillStyle = '#2a1a0a'; g.font = 'bold 11px "Courier New", monospace'; g.fillText('KDC 100-999', 222, 261);
    const allOk = books.every((b, i) => b.code === ORD[i] && b.tagLv === 1);
    g.fillStyle = allOk ? '#247e4c' : 'rgba(20,14,8,.85)'; g.fillRect(20, 284, 480, 42); g.strokeStyle = allOk ? '#70ffb0' : '#6a5038'; g.lineWidth = 2; g.strokeRect(20, 284, 480, 42);
    g.fillStyle = '#ffffff'; g.font = 'bold 12.5px sans-serif';
    g.fillText(allOk ? '✦ KDC 오름차순 & 고정봉 정렬 완료 — [Space / 클릭] 비밀 서가 개방!' : '100→300→400→800→900 배열 + 모든 카드 구멍을 황동 고정봉에 맞추세요', 34, 310);
  }
  const tryUnlock = () => {
    if (books.every((b, i) => b.code === ORD[i] && b.tagLv === 1)) { sfx.unlock(); status('달칵— KDC 청구기호와 라벨 자석 핀이 맞물리며 비밀 서가가 열렸다!', 'ok'); setTimeout(() => close(true), 450); }
    else { sfx.buzz(); status('카드 순서(100→300→400→800→900)와 카드 구멍 높이(황동 고정봉)를 모두 맞추세요!', 'err'); }
  };
  const pick = idx => {
    cur = idx;
    if (sel === -1) { sel = idx; sfx.paper ? sfx.paper() : sfx.click(); }
    else if (sel === idx) { sel = -1; sfx.click(); }
    else { const tmp = books[sel]; books[sel] = books[idx]; books[idx] = tmp; const ts = shown[sel]; shown[sel] = shown[idx]; shown[idx] = ts; sel = -1; sfx.slide ? sfx.slide() : sfx.click(); }
  };
  const lift = (idx, d) => { books[idx].tagLv = clamp(books[idx].tagLv + d, 0, 2); sfx.dial(); };
  c.addEventListener('click', e => {
    if (!finish) return;
    const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width, y = (e.clientY - rc.top) * c.height / rc.height;
    if (y >= 280) { tryUnlock(); return; }
    const idx = Math.floor((x - 46) / 88); if (idx < 0 || idx >= 5) return;
    const bx = 46 + idx * 88;
    if (y >= 210 && y <= 252) { cur = idx; lift(idx, x - bx < 36 ? -1 : 1); return; }
    if (y < 210) pick(idx);
  });
  keys(e => {
    if (e.type !== 'keydown') return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') cur = (cur + 4) % 5;
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') cur = (cur + 1) % 5;
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') lift(cur, -1);
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') lift(cur, 1);
    else if (e.code === 'KeyF' && !e.repeat) pick(cur);
    else if (e.code === 'Space' || e.code === 'Enter') tryUnlock();
  });
  const loop = now => { const dt = Math.min(.08, (now - lastT) / 1000); lastT = now; draw(dt); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop); return p;
}

function cassetteSplice({ title = '방송실 — 1998년 하교 방송 카세트테이프 마그네틱 필름 접합' } = {}) {
  const p = open(title, '<b>1단계:</b> 끊어진 <b>마그네틱 테이프 파단부 3곳</b>을 클릭(또는 <b>F</b>)해 가위로 다듬고 스플라이싱 테이프로 접합하라<br><b>2단계:</b> 우측 <b>[헤드 방위각(Azimuth) 드라이버 나사(A·D / 노브)]</b>를 돌려 L/R 위상 동조율을 88% 이상 맞춘 뒤 <b>[Space / 재생 검증]</b>을 눌러라!');
  const c = canvas(520, 340), g = c.getContext('2d');
  screen3D(c, { kind: 'metal', prop: 'tape' });
  const breaks = [{ x: 118, y: 228, fixed: false, t: 0 }, { x: 205, y: 240, fixed: false, t: 0 }, { x: 292, y: 228, fixed: false, t: 0 }];
  const targetAz = .25 + Math.random() * .55;
  let az = .08, playing = false, reelAng = 0, lastT = performance.now(), dn = {}, vu = [0, 0];
  const triggerPlay = () => {
    if (!breaks.every(b => b.fixed)) { sfx.buzz(); status('먼저 끊어진 마그네틱 필름 3곳을 모두 클릭해 스플라이싱 테이프로 접합하세요!', 'err'); return; }
    const sync = clamp(1 - Math.abs(az - targetAz) / .14, 0, 1);
    if (sync < .86) { sfx.buzz(); status('자기 헤드 방위각(Azimuth)이 어긋나 음성이 뭉개집니다! [A/D]로 위상 동조율을 88% 이상 맞추세요.', 'err'); return; }
    if (playing) return;
    playing = true; sfx.tape ? sfx.tape() : sfx.unlock(); setTimeout(() => sfx.unlock(), 250);
    status('철컥, 지이잉— 방위각이 완벽히 맞물리며 1998년 10월 12일의 원본 음성이 선명히 재생된다!', 'ok');
    setTimeout(() => close(true), 900);
  };
  const splice = b => { if (!b || b.fixed) return; b.fixed = true; b.t = 1; sfx.paper ? sfx.paper() : sfx.click(); setTimeout(() => sfx.click(), 180); if (breaks.every(k => k.fixed)) status('필름 3곳 접합 완료! 이제 우측 헤드 방위각(Azimuth) 나사를 조절하세요.'); };
  c.addEventListener('mousedown', e => {
    if (!finish || playing) return;
    const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width, y = (e.clientY - rc.top) * c.height / rc.height;
    const hit = breaks.find(b => !b.fixed && Math.hypot(b.x - x, b.y - y) < 28);
    if (hit) { splice(hit); return; }
    if (x >= 365 && y >= 115 && y <= 195) { az = clamp((x - 375) / 120, 0, 1); sfx.dial(); return; }
    if (y >= 272) triggerPlay();
  });
  c.addEventListener('wheel', e => { e.preventDefault(); az = clamp(az + (e.deltaY < 0 ? .03 : -.03), 0, 1); sfx.dial(); }, { passive: false });
  keys(e => {
    dn[e.code] = e.type === 'keydown';
    if (e.type !== 'keydown' || e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') triggerPlay();
    else if (e.code === 'KeyF') splice(breaks.find(b => !b.fixed));
    else if (/^Digit[1-3]$/.test(e.code)) splice(breaks[+e.code.slice(-1) - 1]);
  });
  const hub = (x, y, packR) => {   // 테이프 감긴 릴(갈색 산화철 층) + 흰 허브 6톱니
    const pk = g.createRadialGradient(x, y, 12, x, y, packR); pk.addColorStop(0, '#3a2414'); pk.addColorStop(.7, '#5a3820'); pk.addColorStop(1, '#4a2c18');
    g.fillStyle = pk; g.beginPath(); g.arc(x, y, packR, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,220,180,.08)'; for (let r = 16; r < packR; r += 3) { g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); }
    g.save(); g.translate(x, y); g.rotate(reelAng); g.fillStyle = '#f0ece2'; g.beginPath(); g.arc(0, 0, 13, 0, 7); g.fill();
    g.fillStyle = '#1a1612'; g.beginPath(); g.arc(0, 0, 7, 0, 7); g.fill(); g.fillStyle = '#f0ece2'; for (let k = 0; k < 6; k++) { g.save(); g.rotate(k * Math.PI / 3); g.fillRect(-1.5, -7, 3, 3.5); g.restore(); } g.restore();
  };
  const scissors = (x, y, k) => {   // 가위: 날이 닫히며 테이프 끝을 비스듬히 자른다
    g.save(); g.translate(x, y - 20); g.rotate(-.5); const o = (1 - k) * .45;
    [o, -o].forEach((a, i) => { g.save(); g.rotate(a); g.fillStyle = '#d8dce0'; g.beginPath(); g.moveTo(0, 0); g.lineTo(22, i ? 2 : -2); g.lineTo(0, i ? 4 : -4); g.fill(); g.strokeStyle = '#c03030'; g.lineWidth = 3; g.beginPath(); g.arc(-12, i ? 6 : -6, 6, 0, 7); g.stroke(); g.restore(); });
    g.fillStyle = '#555'; g.beginPath(); g.arc(0, 0, 2, 0, 7); g.fill(); g.restore();
  };
  const loop = now => {
    const dt = Math.min(.08, (now - lastT) / 1000); lastT = now;
    if (dn.KeyA || dn.ArrowLeft) az = clamp(az - dt * .38, 0, 1);
    if (dn.KeyD || dn.ArrowRight) az = clamp(az + dt * .38, 0, 1);
    if (playing) reelAng += dt * 4.5;
    breaks.forEach(b => b.t = Math.max(0, b.t - dt * 2.2));
    const allFixed = breaks.every(b => b.fixed), sync = allFixed ? clamp(1 - Math.abs(az - targetAz) / .14, 0, 1) : 0;
    // 편집대: 검은 고무 매트
    g.fillStyle = '#16181a'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = 'rgba(255,255,255,.025)'; for (let i = 0; i < 40; i++) g.fillRect(0, i * 9, c.width, 1);
    // 카세트 하우징: 반투명 스모크 플라스틱, 나사 5개, 라벨, 창
    g.save(); g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 12; g.shadowOffsetY = 5;
    const sh = g.createLinearGradient(0, 14, 0, 206); sh.addColorStop(0, '#4a4e54'); sh.addColorStop(1, '#25282c'); g.fillStyle = sh; g.beginPath(); g.roundRect(26, 14, 322, 196, 10); g.fill(); g.restore();
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.beginPath(); g.roundRect(27, 15, 320, 194, 10); g.stroke();
    [[38, 26], [336, 26], [38, 196], [336, 196], [187, 196]].forEach(([x, y]) => { g.fillStyle = '#8a8e92'; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); g.strokeStyle = '#2a2c30'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - 2.5, y); g.lineTo(x + 2.5, y); g.moveTo(x, y - 2.5); g.lineTo(x, y + 2.5); g.stroke(); });
    mgPaper(g, 46, 26, 282, 126, '#efe6cc', 'tdk');
    g.fillStyle = '#1e3c8a'; g.fillRect(46, 26, 282, 20); g.fillStyle = '#c8202a'; g.fillRect(46, 46, 282, 3);
    g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.fillText('TDK SA-60', 54, 41); g.font = 'bold 9px sans-serif'; g.fillText('HIGH POSITION · TYPE II', 200, 41);
    g.fillStyle = '#1a2a6a'; g.font = '16px "East Sea Dokdo", cursive, sans-serif'; g.fillText('1998.10.12 방송부 원본 (SIDE A)', 56, 66);
    g.strokeStyle = 'rgba(30,40,90,.25)'; g.lineWidth = .6; for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(54, 70 + k * 6); g.lineTo(320, 70 + k * 6); g.stroke(); }
    // 창 (투명 플라스틱 너머 테이프 팩)
    g.fillStyle = '#0e0c0a'; g.beginPath(); g.roundRect(78, 80, 218, 66, 30); g.fill();
    hub(125, 113, 31); hub(248, 113, 22);
    g.fillStyle = 'rgba(200,220,240,.08)'; g.beginPath(); g.roundRect(78, 80, 218, 66, 30); g.fill(); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(90, 84, 190, 5);
    // 아래 헤드 창(사다리꼴) — 테이프가 여기서 빠져나와 편집대로 늘어져 있다
    g.fillStyle = '#1c1e20'; g.beginPath(); g.moveTo(92, 210); g.lineTo(112, 172); g.lineTo(262, 172); g.lineTo(282, 210); g.fill();
    [130, 244].forEach(x => { g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(x, 192, 6, 0, 7); g.fill(); });
    // 늘어진 마그네틱 테이프 (갈색 리본) + 파단부
    const path = [[100, 206], [118, 228], [205, 240], [292, 228], [274, 206]];
    const ribbon = (x1, y1, x2, y2) => { g.strokeStyle = '#5a3418'; g.lineWidth = 7; g.lineCap = 'butt'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.strokeStyle = 'rgba(255,200,150,.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x1, y1 - 2.5); g.lineTo(x2, y2 - 2.5); g.stroke(); };
    for (let k = 0; k < path.length - 1; k++) {
      const [x1, y1] = path[k], [x2, y2] = path[k + 1], b1 = breaks.find(b => b.x === x1), b2 = breaks.find(b => b.x === x2);
      const sx = b1 && !b1.fixed ? x1 + (x2 - x1) * .1 : x1, sy = b1 && !b1.fixed ? y1 + (y2 - y1) * .1 : y1, ex = b2 && !b2.fixed ? x2 - (x2 - x1) * .1 : x2, ey = b2 && !b2.fixed ? y2 - (y2 - y1) * .1 + 4 : y2;
      ribbon(sx, sy, ex, ey);
    }
    breaks.forEach((b, bi) => {
      if (b.fixed) {   // 스플라이싱 테이프 (반투명 흰 조각 · 45° 이음매)
        g.save(); g.translate(b.x, b.y); g.fillStyle = 'rgba(235,240,245,.72)'; g.fillRect(-9, -6, 18, 12); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = .7; g.strokeRect(-9, -6, 18, 12); g.strokeStyle = 'rgba(20,10,4,.7)'; g.beginPath(); g.moveTo(-3, 4); g.lineTo(3, -4); g.stroke(); g.restore();
        if (b.t > 0) scissors(b.x, b.y, 1 - b.t);
      } else {
        g.strokeStyle = 'rgba(255,100,80,.6)'; g.setLineDash([3, 3]); g.lineWidth = 1.2; g.beginPath(); g.arc(b.x, b.y, 18, 0, 7); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#ffb8a8'; g.font = 'bold 10px sans-serif'; g.fillText(`파단#${bi + 1}`, b.x - 16, b.y + 30);
      }
    });
    // 우측: 재생 헤드 · 방위각 나사 · L/R VU 미터
    g.fillStyle = '#202428'; g.fillRect(362, 14, 142, 246); g.strokeStyle = '#4a5560'; g.lineWidth = 1; g.strokeRect(362, 14, 142, 246);
    g.fillStyle = '#d8e6ee'; g.font = 'bold 11.5px sans-serif'; g.fillText('헤드 방위각(Azimuth)', 370, 32); g.fillStyle = '#9ab0bc'; g.font = '10px sans-serif'; g.fillText('나사 조절: [A/D] · 휠', 370, 47);
    g.save(); g.translate(433, 92); g.rotate((az - targetAz) * .5);   // 크롬 헤드 (방위각만큼 기운다)
    const hd = g.createLinearGradient(-24, 0, 24, 0); hd.addColorStop(0, '#8a9096'); hd.addColorStop(.5, '#f4f6f8'); hd.addColorStop(1, '#6a7076'); g.fillStyle = hd; g.beginPath(); g.roundRect(-24, -16, 48, 32, 6); g.fill();
    g.fillStyle = '#1a1a1a'; g.fillRect(-.8, -14, 1.6, 28); g.restore();
    g.save(); g.translate(433, 150); g.rotate(az * Math.PI * 4);   // 방위각 나사 (십자 머리)
    const sc2 = g.createRadialGradient(-4, -4, 1, 0, 0, 16); sc2.addColorStop(0, '#fff4c0'); sc2.addColorStop(.6, '#c89a38'); sc2.addColorStop(1, '#6a4a14'); g.fillStyle = sc2; g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill();
    g.strokeStyle = sync >= .86 ? '#58ff9a' : '#3a2808'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#241c0c'; g.fillRect(-11, -2, 22, 4); g.fillRect(-2, -11, 4, 22); g.restore();
    g.fillStyle = '#8a9aa6'; g.font = '9px sans-serif'; g.fillText('◀ 0', 372, 176); g.fillText('1 ▶', 482, 176); g.fillStyle = '#3a4650'; g.fillRect(375, 180, 120, 4); g.fillStyle = '#ffd040'; g.fillRect(375 + az * 120 - 2, 177, 4, 10);
    // VU 미터 2개 (크림색 판 · 바늘 · 붉은 +구간)
    const tgtVu = playing || allFixed ? [sync * (.75 + Math.sin(now * .013) * .12), sync * (.72 + Math.sin(now * .017 + 1) * .12)] : [0, 0];
    vu = vu.map((v, i) => v + (tgtVu[i] - v) * Math.min(1, dt * 8));
    [['L', 397], ['R', 469]].forEach(([lb, cx], i) => {
      g.fillStyle = '#efe4c4'; g.fillRect(cx - 32, 194, 64, 40); g.strokeStyle = '#111'; g.strokeRect(cx - 32, 194, 64, 40);
      g.strokeStyle = '#222'; g.lineWidth = 1; g.beginPath(); g.arc(cx, 236, 30, Math.PI * 1.2, Math.PI * 1.65); g.stroke(); g.strokeStyle = '#c82020'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, 236, 30, Math.PI * 1.65, Math.PI * 1.8); g.stroke();
      const a = Math.PI * (1.22 + vu[i] * .56); g.strokeStyle = '#111'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, 234); g.lineTo(cx + Math.cos(a) * 32, 234 + Math.sin(a) * 32); g.stroke();
      g.fillStyle = '#111'; g.font = 'bold 9px sans-serif'; g.fillText(lb, cx - 28, 205); g.fillText('VU', cx + 14, 205);
    });
    g.fillStyle = sync >= .86 ? '#68ffa8' : '#e8f2f8'; g.font = 'bold 11px monospace'; g.fillText(`위상 동조율: ${Math.round(sync * 100)}%`, 370, 252);
    const ready = allFixed && sync >= .86;
    g.fillStyle = ready ? '#247a48' : '#263038'; g.fillRect(22, 272, 480, 48); g.strokeStyle = ready ? '#68ffa8' : '#586874'; g.lineWidth = 2; g.strokeRect(22, 272, 480, 48);
    g.fillStyle = '#ffffff'; g.font = 'bold 13px sans-serif';
    g.fillText(ready ? '▶ [Space / 클릭] 방위각 교정 완료 — 마스터 테이프 재생!' : `1) 필름 접합(${breaks.filter(b => b.fixed).length}/3)  +  2) 헤드 방위각 88% 이상(현재 ${Math.round(sync * 100)}%) 필요`, 40, 301);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop); return p;
}

function microscopeSlide({ title = '과학준비실 — 광학 현미경 프레파라트 표본 초점·배율 판독' } = {}) {
  const p = open(title, '<b>1) 대물렌즈[400x / 1·2·3]</b> 전환 → <b>2) 프레파라트 스테이지[WASD / 시야 드래그]</b>로 표본을 십자선 중앙에 이동 →<br><b>3) 조동 나사[Q·E] · 미동 나사[R·F / 휠]</b>로 초점을, <b>4) 조리개 광량[Z·C]</b>을 맞춘 뒤 <b>[Space / 표본 판독 확정]</b>을 눌러라!');
  const c = canvas(520, 340), g = c.getContext('2d');
  let mag = 100, focus = 0.18, targetFocus = 0.68, iris = 0.25, targetIris = 0.62;
  let sx = 46, sy = -38, dragStage = false, lastMouse = [0, 0], knobA = [0, 0];
  screen3D(c, { kind: 'metal', prop: 'microscope', anim: () => ({ mag, sx, sy, focus, iris }) });
  // 표본: 아세트산카민으로 물들인 양파 표피 세포 (벽돌 모양 세포벽 + 붉은 핵) + 슬라이드 글라스에 긁힌 표본 코드
  const SP = document.createElement('canvas'); SP.width = SP.height = 420; const sq = SP.getContext('2d');
  for (let row = 0; row < 16; row++) for (let col = 0; col < 7; col++) {
    const w = 64, h = 27, x = col * w + (row % 2) * w * .45 - 30 + Math.random() * 5, y = row * h + Math.random() * 3;
    sq.fillStyle = `rgba(${200 + Math.random() * 30},${120 + Math.random() * 30},${150 + Math.random() * 30},.22)`; sq.strokeStyle = 'rgba(120,40,80,.65)'; sq.lineWidth = 2;
    sq.beginPath(); sq.moveTo(x + 2, y + 1); sq.lineTo(x + w - 1, y + Math.random() * 3); sq.lineTo(x + w + 1, y + h - 1); sq.lineTo(x, y + h + Math.random() * 2); sq.closePath(); sq.fill(); sq.stroke();
    sq.fillStyle = 'rgba(150,30,70,.8)'; sq.beginPath(); sq.ellipse(x + w * (.3 + Math.random() * .4), y + h / 2, 5, 4, 0, 0, 7); sq.fill(); sq.fillStyle = 'rgba(90,10,40,.9)'; sq.beginPath(); sq.arc(x + w * .5, y + h / 2, 1.3, 0, 7);
  }
  sq.fillStyle = 'rgba(30,20,30,.85)'; sq.font = 'bold 22px monospace'; sq.textAlign = 'center'; sq.fillText('SAMPLE #98-1012-HN', 210, 216);
  const tint = col => { const t = document.createElement('canvas'); t.width = t.height = 420; const q = t.getContext('2d'); q.drawImage(SP, 0, 0); q.globalCompositeOperation = 'source-in'; q.fillStyle = col; q.fillRect(0, 0, 420, 420); return t; };
  const SPR = tint('rgba(255,40,40,1)'), SPB = tint('rgba(40,90,255,1)');
  const knob = (x, y, r, ang, label, key) => {   // 널링(톱니) 손잡이
    g.save(); g.translate(x, y); g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.arc(2, 3, r, 0, 7); g.fill();
    const kg = g.createRadialGradient(-r * .3, -r * .3, 1, 0, 0, r); kg.addColorStop(0, '#5a6066'); kg.addColorStop(1, '#14181c'); g.fillStyle = kg; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    g.rotate(ang); g.strokeStyle = 'rgba(200,210,220,.35)'; g.lineWidth = 1; for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12; g.beginPath(); g.moveTo(Math.cos(a) * r * .72, Math.sin(a) * r * .72); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke(); }
    const cg = g.createRadialGradient(-2, -2, 1, 0, 0, r * .5); cg.addColorStop(0, '#f0f2f4'); cg.addColorStop(1, '#7a8086'); g.fillStyle = cg; g.beginPath(); g.arc(0, 0, r * .45, 0, 7); g.fill();
    g.fillStyle = '#d02020'; g.fillRect(-1, -r, 2, r * .3); g.restore();
    g.fillStyle = '#c8d4dc'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText(label, x, y + r + 13); g.font = '9px sans-serif'; g.fillStyle = '#8a9aa6'; g.fillText(key, x, y + r + 24); g.textAlign = 'left';
  };
  function draw() {
    g.fillStyle = '#07090b'; g.fillRect(0, 0, c.width, c.height);
    const cx = 160, cy = 165, r = 126;
    const fErr = Math.abs(focus - targetFocus) + (mag === 400 ? 0 : 0.35), iErr = Math.abs(iris - targetIris), posErr = Math.hypot(sx, sy);
    // 접안렌즈 시야: 원형 · 가장자리 비네팅 · 밝기는 조리개
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
    const lum = clamp(.35 + iris * .9, .2, 1.2), bg = g.createRadialGradient(cx - 10, cy - 12, 10, cx, cy, r);
    bg.addColorStop(0, `rgb(${Math.min(255, 235 * lum)},${Math.min(255, 232 * lum)},${Math.min(255, 215 * lum)})`); bg.addColorStop(1, `rgb(${150 * lum},${145 * lum},${130 * lum})`);
    g.fillStyle = bg; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    const scale = mag / 200, blur = clamp(fErr * 14, 0, 9), fr = clamp(fErr * 9, 0, 6), dw = 420 * scale;
    g.save(); g.translate(cx + sx * scale * 1.2, cy + sy * scale * 1.2);
    g.filter = blur > .4 ? `blur(${blur.toFixed(1)}px)` : 'none'; g.globalAlpha = clamp(1 - iErr * .6, .4, 1);
    g.drawImage(SP, -dw / 2, -dw / 2, dw, dw);
    if (fr > .5) { g.globalAlpha = .28; g.globalCompositeOperation = 'multiply'; g.drawImage(SPR, -dw / 2 + fr, -dw / 2, dw, dw); g.drawImage(SPB, -dw / 2 - fr, -dw / 2 + fr * .4, dw, dw); }   // 색수차 (초점이 어긋나면 붉고 푸른 테두리)
    g.restore(); g.filter = 'none'; g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (iris > targetIris + .14) { g.fillStyle = `rgba(255,255,250,${(iris - targetIris - .14) * 1.6})`; g.fillRect(cx - r, cy - r, r * 2, r * 2); }   // 빛이 너무 세면 하얗게 날아간다
    for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(60,50,40,.25)'; g.beginPath(); g.arc(cx - 70 + i * 31, cy + 60 - (i * 37) % 90, 1.5 + i % 3, 0, 7); g.fill(); }   // 렌즈 먼지
    g.strokeStyle = 'rgba(10,10,10,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.moveTo(cx, cy - r); g.lineTo(cx, cy + r); g.stroke();
    for (let k = -10; k <= 10; k++) { g.beginPath(); g.moveTo(cx + k * 8, cy - (k % 5 ? 3 : 6)); g.lineTo(cx + k * 8, cy + (k % 5 ? 3 : 6)); g.stroke(); }   // 접안 마이크로미터 눈금
    g.strokeStyle = posErr < 18 ? 'rgba(40,160,80,.8)' : 'rgba(200,50,30,.55)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 28, 0, Math.PI * 2); g.stroke();
    const vg = g.createRadialGradient(cx, cy, r * .62, cx, cy, r); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.92)'); g.fillStyle = vg; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    g.restore();
    g.strokeStyle = '#1a1e22'; g.lineWidth = 10; g.beginPath(); g.arc(cx, cy, r + 4, 0, Math.PI * 2); g.stroke(); g.strokeStyle = 'rgba(160,170,180,.25)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, r + 9, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#7a8a96'; g.font = '10px monospace'; g.fillText(`×${mag}  (10× 접안 · ${mag / 10}× 대물)`, 22, 330);
    // 우측: 리볼버 · 재물대 · 조동/미동 나사 · 조리개
    g.fillStyle = '#12181e'; g.fillRect(304, 12, 204, 316); g.strokeStyle = '#34424e'; g.lineWidth = 1.5; g.strokeRect(304, 12, 204, 316);
    g.fillStyle = '#d8e6ee'; g.font = 'bold 11.5px sans-serif'; g.fillText('1. 리볼버 대물렌즈 배율', 316, 32);
    [[40, '#d0d0d0'], [100, '#e8c840'], [400, '#d83a3a']].forEach(([m, band], idx) => {   // 대물렌즈 색띠 (4× 흰 · 10× 노랑 · 40× 빨강)
      const bx = 316 + idx * 60, by = 40, on = mag === m; const og = g.createLinearGradient(bx, 0, bx + 52, 0); og.addColorStop(0, '#7a8086'); og.addColorStop(.5, on ? '#ffffff' : '#c8ccd0'); og.addColorStop(1, '#6a7076');
      g.fillStyle = og; g.fillRect(bx, by, 52, 26); g.fillStyle = band; g.fillRect(bx, by + 18, 52, 4); g.strokeStyle = on ? '#68ffa8' : '#3a4650'; g.lineWidth = on ? 2.5 : 1; g.strokeRect(bx, by, 52, 26);
      g.fillStyle = '#111'; g.font = 'bold 11px monospace'; g.fillText(m + 'x', bx + 12, by + 15);
    });
    const stageOk = posErr < 18, focusOk = Math.abs(focus - targetFocus) < 0.11, irisOk = Math.abs(iris - targetIris) < 0.14;
    g.fillStyle = stageOk ? '#68ffa8' : '#ffd068'; g.font = 'bold 11px sans-serif'; g.fillText(`2. 스테이지 중앙 정렬 [WASD]: ${stageOk ? 'OK' : '조절필요'}`, 316, 86);
    [['◀X', 316], ['X▶', 360], ['▲Y', 404], ['Y▼', 448]].forEach(([lb, bx]) => { g.fillStyle = '#242e36'; g.fillRect(bx, 94, 40, 22); g.strokeStyle = '#50606c'; g.lineWidth = 1; g.strokeRect(bx, 94, 40, 22); g.fillStyle = '#ffffff'; g.font = '10.5px sans-serif'; g.fillText(lb, bx + 10, 109); });
    g.fillStyle = focusOk ? '#68ffa8' : '#d8e6ee'; g.font = 'bold 11px sans-serif'; g.fillText('3. 초점 나사', 316, 136);
    knob(352, 166, 22, knobA[0], '조동', 'Q·E'); knob(430, 166, 13, knobA[1], '미동', 'R·F / 휠');
    g.fillStyle = irisOk ? '#68ffa8' : '#d8e6ee'; g.font = 'bold 11px sans-serif'; g.fillText('4. 조리개 광량 조절 [Z / C]', 316, 226);
    g.fillStyle = '#242e36'; g.fillRect(316, 234, 174, 14); const ig = g.createLinearGradient(316, 0, 490, 0); ig.addColorStop(0, '#2a2a20'); ig.addColorStop(1, '#fff6c8'); g.fillStyle = ig; g.fillRect(316, 236, 174 * iris, 10);
    g.fillStyle = '#ffd040'; g.fillRect(316 + 174 * iris - 2, 231, 4, 20);
    const ready = mag === 400 && stageOk && focusOk && irisOk;
    g.fillStyle = ready ? '#247e4c' : '#28323a'; g.fillRect(316, 262, 174, 56); g.strokeStyle = ready ? '#70ffb0' : '#52606c'; g.lineWidth = 2; g.strokeRect(316, 262, 174, 56);
    g.fillStyle = '#ffffff'; g.font = 'bold 12px sans-serif'; g.fillText(ready ? '✦ [Space / 클릭]' : '4개 항목 동조 후', 340, 286); g.fillText(ready ? '표본 코드 판독 확정!' : '판독 가능', 340, 306);
  }
  const confirmSlide = () => {
    const stageOk = Math.hypot(sx, sy) < 18, focusOk = Math.abs(focus - targetFocus) < 0.11, irisOk = Math.abs(iris - targetIris) < 0.14;
    if (mag !== 400 || !stageOk || !focusOk || !irisOk) { sfx.buzz(); status('배율(400x), 스테이지 중앙 정렬(WASD), 초점(Q/E), 조리개(Z/C) 4가지를 모두 녹색으로 맞추세요!', 'err'); return; }
    sfx.unlock(); status('표본 판독 완료 — 슬라이드 글라스의 1998.10.12 실험 기록을 확보했다!', 'ok'); setTimeout(() => close(true), 450);
  };
  const turn = (d, fine) => { focus = clamp(focus + d, 0.05, 0.95); knobA[fine ? 1 : 0] += d * 30; sfx.dial(); draw(); };
  const setMag = m => { mag = m; sfx.click(); draw(); };
  c.addEventListener('mousedown', e => {
    if (!finish) return;
    const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width, y = (e.clientY - rc.top) * c.height / rc.height;
    if (Math.hypot(x - 160, y - 165) <= 126) { dragStage = true; lastMouse = [x, y]; return; }
    if (y >= 38 && y <= 68 && x >= 314 && x <= 498) { const idx = Math.floor((x - 316) / 60); if (idx >= 0 && idx < 3) setMag([40, 100, 400][idx]); return; }
    if (y >= 92 && y <= 118 && x >= 314 && x <= 495) { const bi = Math.floor((x - 316) / 44); if (bi === 0) sx = clamp(sx - 10, -65, 65); else if (bi === 1) sx = clamp(sx + 10, -65, 65); else if (bi === 2) sy = clamp(sy - 10, -65, 65); else sy = clamp(sy + 10, -65, 65); sfx.dial(); draw(); return; }
    if (Math.hypot(x - 352, y - 166) <= 26) { turn(x < 352 ? -0.07 : 0.07, false); return; }
    if (Math.hypot(x - 430, y - 166) <= 17) { turn(x < 430 ? -0.02 : 0.02, true); return; }
    if (y >= 228 && y <= 252 && x >= 314 && x <= 495) { iris = clamp((x - 316) / 174, 0.05, 0.95); sfx.dial(); draw(); return; }
    if (y >= 260 && x >= 314) confirmSlide();
  });
  c.addEventListener('wheel', e => { e.preventDefault(); turn(e.deltaY < 0 ? 0.02 : -0.02, true); }, { passive: false });
  c.addEventListener('mousemove', e => {
    if (!dragStage) return;
    const rc = c.getBoundingClientRect(), x = (e.clientX - rc.left) * c.width / rc.width, y = (e.clientY - rc.top) * c.height / rc.height;
    sx = clamp(sx + (x - lastMouse[0]), -65, 65); sy = clamp(sy + (y - lastMouse[1]), -65, 65); lastMouse = [x, y]; draw();
  });
  const mu = () => { dragStage = false; };
  addEventListener('mouseup', mu); cleanups.push(() => removeEventListener('mouseup', mu));
  keys(e => {
    if (e.type !== 'keydown') return;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') { sx = clamp(sx - 10, -65, 65); sfx.dial(); draw(); }
    else if (e.code === 'KeyD' || e.code === 'ArrowRight') { sx = clamp(sx + 10, -65, 65); sfx.dial(); draw(); }
    else if (e.code === 'KeyW' || e.code === 'ArrowUp') { sy = clamp(sy - 10, -65, 65); sfx.dial(); draw(); }
    else if (e.code === 'KeyS' || e.code === 'ArrowDown') { sy = clamp(sy + 10, -65, 65); sfx.dial(); draw(); }
    else if (e.code === 'KeyQ') turn(-0.07, false);
    else if (e.code === 'KeyE') turn(0.07, false);
    else if (e.code === 'KeyR') turn(0.02, true);
    else if (e.code === 'KeyF') turn(-0.02, true);
    else if (e.code === 'KeyZ') { iris = clamp(iris - 0.08, 0.05, 0.95); sfx.dial(); draw(); }
    else if (e.code === 'KeyC') { iris = clamp(iris + 0.08, 0.05, 0.95); sfx.dial(); draw(); }
    else if (e.code === 'Digit1') setMag(40);
    else if (e.code === 'Digit2') setMag(100);
    else if (e.code === 'Digit3') setMag(400);
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
  const max = par + extra; let used = 0, won = false; const cur = { y: 0, x: 0 };
  const p = open(title, `퓨즈를 클릭하면 <b>자기와 상하좌우</b>가 함께 뒤집힌다 — <b>${max}</b>번 안에 ${N * N}개를 모두 켜라 · 방향키 + Space 로도 조작`);
  const S = 70, c = canvas(N * S + 40, N * S + 50), g = c.getContext('2d');
  const draw = () => {
    g.fillStyle = '#121416'; g.fillRect(0, 0, c.width, c.height);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const px = 20 + x * S, py = 20 + y * S;
      g.fillStyle = '#23272b'; g.fillRect(px + 4, py + 4, S - 8, S - 8); g.fillStyle = on[y][x] ? '#7aff9a' : '#3a1414'; g.shadowColor = on[y][x] ? '#7aff9a' : 'transparent'; g.shadowBlur = on[y][x] ? 14 : 0;
      g.fillRect(px + 18, py + 14, S - 36, S - 28); g.shadowBlur = 0; if (cur.y === y && cur.x === x) { g.strokeStyle = '#f0d070'; g.lineWidth = 2; g.strokeRect(px + 2, py + 2, S - 4, S - 4); } g.fillStyle = '#b8b0a0'; g.fillRect(px + 26, py + 8, S - 52, 6); g.fillRect(px + 26, py + S - 14, S - 52, 6); }
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
      const lc = document.createElement('canvas'); lc.width = 128; lc.height = 128; const lg = lc.getContext('2d'); lg.fillStyle = '#e8e2d4'; lg.fillRect(0, 0, 128, 128); lg.fillStyle = 'rgba(0,0,0,.08)'; for (let q = 0; q < 60; q++) lg.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
      lg.fillStyle = '#2a2420'; lg.font = 'bold 15px sans-serif'; lg.textAlign = 'center'; lg.fillText(`${String.fromCharCode(65 + y)}-${x + 1}  15A`, 64, 20); lg.font = '12px sans-serif'; lg.fillText(['교실', '복도등', '전열', '방송', '비상등'][(x + y) % 5], 64, 120);   // 회로 이름표 (손글씨 라벨)
      const lt = new THREE.CanvasTexture(lc); lt.colorSpace = THREE.SRGBColorSpace; const holdM = new THREE.MeshStandardMaterial({ map: lt, roughness: .4 });
      const hold = new THREE.Mesh(new THREE.BoxGeometry(cs * .78, cs * .78, .05), [cer, cer, cer, cer, holdM, cer]); grp.add(hold);
      const glassM = new THREE.MeshStandardMaterial({ color: 0x9ad8a8, emissive: 0x30ff60, emissiveIntensity: 1, transparent: true, opacity: .85, roughness: .1 });
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(cs * .13, cs * .13, cs * .5, 16), glassM); tube.rotation.z = Math.PI / 2; tube.position.z = .05; grp.add(tube);
      [-1, 1].forEach(sd => { const cp = new THREE.Mesh(new THREE.CylinderGeometry(cs * .15, cs * .15, cs * .08, 16), cap); cp.rotation.z = Math.PI / 2; cp.position.set(sd * cs * .27, 0, .05); grp.add(cp); });
      hold.userData = tube.userData = { y, x }; cells.push({ grp, tube, glassM, holdM, y, x, push: 0 }); }
    const rc = new THREE.Raycaster(), mv = new THREE.Vector2();
    r.domElement.addEventListener('mousedown', e => { const b = r.domElement.getBoundingClientRect(); mv.set((e.clientX - b.left) / b.width * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); rc.setFromCamera(mv, cam); const h = rc.intersectObjects(cells.map(o => o.grp), true)[0]; if (!h) return; const u = h.object.userData; cells.find(o => o.y === u.y && o.x === u.x).push = 1; doFlip(u.y, u.x); });
    const lp = () => { if (!MG.active) { r.dispose(); r.forceContextLoss && r.forceContextLoss(); return; } cells.forEach(o => { const lit = on[o.y][o.x]; o.glassM.color.setHex(lit ? 0x9ad8a8 : 0x3a1a14); o.glassM.emissive.setHex(lit ? 0x30ff60 : 0x200400); o.glassM.emissiveIntensity = lit ? .9 + Math.sin(performance.now() / 200 + o.x) * .1 : .4; o.holdM.emissive.setHex(cur.y === o.y && cur.x === o.x ? 0x3a3010 : 0); o.push = Math.max(0, o.push - .08); o.grp.position.z = -o.push * .04; });
      r.render(sc, cam); requestAnimationFrame(lp); }; requestAnimationFrame(lp); })();
  // 키보드 · 패드: 방향키/WASD 로 칸 이동(노란 테두리), Space/Enter 로 퓨즈 뒤집기 (예전엔 키보드로 풀 수 없었다)
  keys(e => { if (e.type !== 'keydown') return; const d = { ArrowUp: [-1, 0], KeyW: [-1, 0], ArrowDown: [1, 0], KeyS: [1, 0], ArrowLeft: [0, -1], KeyA: [0, -1], ArrowRight: [0, 1], KeyD: [0, 1] }[e.code];
    if (d) { cur.y = clamp(cur.y + d[0], 0, N - 1); cur.x = clamp(cur.x + d[1], 0, N - 1); sfx.dial(); draw(); } else if (e.code === 'Space' || e.code === 'Enter') doFlip(cur.y, cur.x); }); draw();
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
  const p = open(title, '<b>1번(산성 적정액)</b> · <b>2번(염기성 시약)</b> · <b>3번(완충 냉각액)</b> 버튼 클릭 또는 키 입력<br>pH를 <b>7.0 ~ 7.4</b>, 온도를 <b>40°C 이하</b>로 맞춘 뒤 <b>Space(교반 결정화)</b>를 눌러라<br>BTB 지시약 색: <b style="color:#e8ce28">노랑 = 산성</b> · <b style="color:#40c070">초록 = 중성</b> · <b style="color:#5080ff">파랑 = 염기성</b>');
  const c = canvas(460, 300), g = c.getContext('2d');
  let ph = 4.2 + (Math.random() < .5 ? -.8 : 4.4), temp = 28, stir = 0, drops = [], lastT = performance.now();
  // BTB(브로모티몰 블루) 지시약: pH 6 이하 노랑 → 7 부근 초록 → 7.6 이상 파랑
  const btb = v => { const K = [[5.8, [232, 206, 40]], [6.6, [176, 200, 50]], [7.2, [52, 168, 92]], [7.7, [40, 120, 170]], [8.4, [36, 70, 200]]]; if (v <= K[0][0]) return K[0][1]; for (let k = 1; k < K.length; k++) if (v <= K[k][0]) { const t = (v - K[k - 1][0]) / (K[k][0] - K[k - 1][0]); return K[k - 1][1].map((c0, ci) => Math.round(c0 + (K[k][1][ci] - c0) * t)); } return K[K.length - 1][1]; };
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
    const bc = btb(ph), liqCol = `rgba(${bc[0]},${bc[1]},${bc[2]},0.8)`;
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
    const gradTex = (w, h, draw) => { const cv2 = document.createElement('canvas'); cv2.width = w; cv2.height = h; const q = cv2.getContext('2d'); draw(q); const t = new THREE.CanvasTexture(cv2); t.colorSpace = THREE.SRGBColorSpace; return t; };
    const buretteTex = gradTex(64, 512, q => { q.strokeStyle = '#1a1a1a'; q.fillStyle = '#1a1a1a'; q.font = 'bold 22px sans-serif'; for (let k = 0; k <= 50; k++) { const y = 20 + k * 9.4; q.lineWidth = k % 5 ? 1.5 : 3; q.beginPath(); q.moveTo(0, y); q.lineTo(k % 5 ? 18 : 34, y); q.stroke(); if (k % 10 === 0) q.fillText(String(k), 36, y + 8); } });
    const LBL = ['HCl 0.1M', 'NaOH 0.1M', 'Buffer'], labTex = k => gradTex(128, 64, q => { q.fillStyle = '#f4efe0'; q.fillRect(0, 0, 128, 64); q.strokeStyle = '#a02020'; q.lineWidth = 4; q.strokeRect(3, 3, 122, 58); q.fillStyle = '#1a1a1a'; q.font = 'bold 22px sans-serif'; q.textAlign = 'center'; q.fillText(LBL[k], 64, 40); });
    const cols = [0xff5a5a, 0x5a9eff, 0x60ffb0], XS = [-.34, 0, .34], burs = XS.map((x, k) => { const g2 = new THREE.Group(); g2.position.set(x, .62, -.12);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .62, 16, 1, true), glass); tube.position.y = .2; g2.add(tube);
      const scale = new THREE.Mesh(new THREE.CylinderGeometry(.0305, .0305, .56, 16, 1, true, -.6, 1.2), new THREE.MeshBasicMaterial({ map: buretteTex, transparent: true, alphaTest: .1, depthWrite: false })); scale.position.y = .2; g2.add(scale);
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(.11, .055), new THREE.MeshStandardMaterial({ map: labTex(k), roughness: .8 })); tag.position.set(0, .44, .04); g2.add(tag);
      const liq = new THREE.Mesh(new THREE.CylinderGeometry(.026, .026, .5, 16), new THREE.MeshPhysicalMaterial({ color: 0xe4eef4, transparent: true, opacity: .42, roughness: .05 }));   // 무색 투명 용액 (메니스커스 위까지) liq.position.y = .16; g2.add(liq);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(.018, .09, 12), glass); tip.rotation.x = Math.PI; tip.position.y = -.15; g2.add(tip);
      const cock = new THREE.Group(); cock.position.y = -.09; g2.add(cock); const ck = new THREE.Mesh(new THREE.BoxGeometry(.09, .014, .018), M(0xf2f2ee, { roughness: .3 })); cock.add(ck); const ckb = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .03, 12), glass); ckb.rotation.x = Math.PI / 2; cock.add(ckb);   // 테플론 콕
      const clamp3 = new THREE.Mesh(new THREE.BoxGeometry(.03, .03, .22), rod.material); clamp3.position.set(0, .48, -.1); g2.add(clamp3);
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .8, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .15; hit.userData.k = k + 1; g2.add(hit);
      sc.add(g2); return { g2, liq, cock, hit }; });
    const bk = new THREE.Mesh(new THREE.CylinderGeometry(.24, .22, .36, 32, 1, true), glass); bk.position.set(0, .18, 0); sc.add(bk);
    const bkTex = gradTex(512, 256, q => { q.fillStyle = '#ffffff'; q.strokeStyle = '#ffffff'; q.font = 'bold 26px sans-serif'; for (let k = 1; k <= 5; k++) { const y = 236 - k * 40; q.lineWidth = 4; q.beginPath(); q.moveTo(196, y); q.lineTo(250, y); q.stroke(); q.fillText(k * 100 + '', 256, y + 9); q.lineWidth = 2; q.beginPath(); q.moveTo(196, y + 20); q.lineTo(224, y + 20); q.stroke(); } q.font = 'bold 30px serif'; q.fillText('PYREX', 330, 60); q.font = '22px sans-serif'; q.fillText('600 mL', 334, 92); });
    const bkScale = new THREE.Mesh(new THREE.CylinderGeometry(.242, .222, .36, 32, 1, true, -1.2, 2.4), new THREE.MeshBasicMaterial({ map: bkTex, transparent: true, alphaTest: .05, depthWrite: false, opacity: .85 })); bkScale.position.copy(bk.position); sc.add(bkScale);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(.24, .006, 6, 40), glass); lip.rotation.x = Math.PI / 2; lip.position.set(0, .36, 0); sc.add(lip);
    const btbB = new THREE.Mesh(new THREE.CylinderGeometry(.05, .055, .16, 18), new THREE.MeshStandardMaterial({ color: 0x5a3010, transparent: true, opacity: .85, roughness: .15 })); btbB.position.set(.55, .08, .28); sc.add(btbB); const btbC = new THREE.Mesh(new THREE.CylinderGeometry(.018, .03, .07, 12), M(0x1a1a1a)); btbC.position.set(.55, .2, .28); sc.add(btbC);
    const btbL = new THREE.Mesh(new THREE.PlaneGeometry(.08, .05), new THREE.MeshStandardMaterial({ map: gradTex(96, 64, q => { q.fillStyle = '#f2ecd8'; q.fillRect(0, 0, 96, 64); q.fillStyle = '#123'; q.font = 'bold 30px sans-serif'; q.fillText('BTB', 12, 44); }) })); btbL.position.set(.55, .09, .332); sc.add(btbL);
    let cloud = null;   // 방울이 떨어진 자리에서 퍼지는 시약 색 구름
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
      if (drops.length > lastDrops) { const d = drops[drops.length - 1], k = d.x < 190 ? 0 : d.x < 270 ? 1 : 2; if (cloud) sc.remove(cloud); const cc = btb(k === 0 ? 4.5 : k === 1 ? 9.5 : 7.2); cloud = new THREE.Mesh(new THREE.CircleGeometry(.05, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(cc[0] / 255, cc[1] / 255, cc[2] / 255), transparent: true, opacity: .0, depthWrite: false })); cloud.rotation.x = -Math.PI / 2; cloud.position.set(XS[k] * .3, .228, -.04); cloud.userData.t = 0; sc.add(cloud); const m = new THREE.Mesh(new THREE.SphereGeometry(.012, 8, 6), new THREE.MeshPhysicalMaterial({ color: 0xeef6ff, transparent: true, opacity: .7, roughness: 0 })); m.position.set(XS[k], .44, -.12); m.userData.v = 0; m.userData.tx = XS[k] * .3; sc.add(m); dropsG.push(m); burs[k].cock.rotation.y = 1.2; burs[k].liq.scale.y = Math.max(.2, burs[k].liq.scale.y - .02); burs[k].liq.position.y = .16 - (1 - burs[k].liq.scale.y) * .25; }
      lastDrops = drops.length;
      for (let i = dropsG.length - 1; i >= 0; i--) { const m = dropsG[i]; m.userData.v += .004; m.position.y -= m.userData.v; m.position.z += (0 - m.position.z) * .08; m.position.x += (m.userData.tx - m.position.x) * .08; if (m.position.y < .23) { sc.remove(m); dropsG.splice(i, 1); if (cloud) cloud.userData.go = true; } }
      if (cloud && cloud.userData.go) { const u = cloud.userData; u.t += .016; cloud.scale.setScalar(1 + u.t * 6 * (1 + stir * 3)); cloud.material.opacity = Math.max(0, .75 * (1 - u.t / 1.4)); cloud.rotation.z += .02 + stir * .2; if (u.t > 1.4) { sc.remove(cloud); cloud = null; } }
      burs.forEach(o => { o.cock.rotation.y *= .9; });
      const okPh = ph >= 6.95 && ph <= 7.45, bc3 = btb(ph); liqM.color.setRGB(bc3[0] / 255, bc3[1] / 255, bc3[2] / 255, THREE.SRGBColorSpace); liqM.emissive = liqM.color.clone().multiplyScalar(.12);
      sp += .05 + stir * .6; stirB.rotation.y = sp; surf.position.y = .226 + Math.sin(performance.now() / 120) * .004 * (1 + stir * 4);
      const txt = ph.toFixed(2) + '|' + temp.toFixed(0); if (txt !== lastTxt) { lastTxt = txt; mg2.fillStyle = '#0a140e'; mg2.fillRect(0, 0, 256, 160); mg2.font = 'bold 50px monospace'; mg2.fillStyle = okPh ? '#60ffa8' : '#ffd060'; mg2.fillText('pH ' + ph.toFixed(2), 14, 64); mg2.font = 'bold 40px monospace'; mg2.fillStyle = temp <= 42 ? '#80d8ff' : '#ff6060'; mg2.fillText(temp.toFixed(0) + ' °C', 14, 130); mg2.font = '18px sans-serif'; mg2.fillStyle = '#8aa'; mg2.fillText('7.0~7.4 · ≤42°C', 120, 150); mt.needsUpdate = true; }
      btn.material.emissive.setHex(okPh && temp <= 42 ? 0x40ff60 : 0x300000); btn.position.y = .03 - stir * .015; r.render(sc, cam); requestAnimationFrame(lp); }; requestAnimationFrame(lp); })();
  return p;
}

/* ---------- 20. 물리 포물선 농구 자유투 (각도 조준 + 파워 차징 + 림/백보드 탄성 물리) ---------- */
function hoopShot({ title = '체육관 코트 — 물리 궤적 자유투 (3골 성공)' } = {}) {
  const p = open(title, '마우스 위·아래(또는 <b>W · S</b>)로 발사 각도 조준 · <b>마우스 버튼 / Space</b>를 누르고 있다가 떼면 슛!<br>백보드 반동을 이용하거나 클린샷으로 <b>3골</b>을 성공시켜라');
  const c = canvas(480, 300), g = c.getContext('2d');
  let ang = 54 * Math.PI / 180, pwr = 0, charging = false, chargeT0 = 0, goals = 0, shots = 0;
  // 파워는 누르고 있던 실제 시간으로 정한다 (프레임이 느려도 같은 감각) — 0.1 ↔ 1 왕복
  const pwrAt = t => { const m = (.05 + t * 1.25) % 1.8; return .1 + (m < .9 ? m : 1.8 - m); };
  const startCharge = () => { charging = true; chargeT0 = performance.now(); pwr = .15; };
  let ball = null, rimX = 392, rimY = 118, rimR = 22, boardX = 420, lastT = performance.now();

  const shoot = () => {
    if (ball || !finish) return;
    if (charging) pwr = pwrAt((performance.now() - chargeT0) / 1000);
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
  c.addEventListener('mousedown', () => { if (!ball && !charging) startCharge(); });
  const mu = () => { if (charging) shoot(); };
  addEventListener('mouseup', mu); cleanups.push(() => removeEventListener('mouseup', mu));
  keys(e => {
    const dn = e.type === 'keydown';
    if (dn && (e.code === 'KeyW' || e.code === 'ArrowUp')) ang = clamp(ang + .04, .55, 1.32);
    if (dn && (e.code === 'KeyS' || e.code === 'ArrowDown')) ang = clamp(ang - .04, .55, 1.32);
    if (e.code === 'Space') {
      if (dn && !ball && !charging && !e.repeat) startCharge();
      else if (!dn && charging) shoot();
    }
  });
  const loop = now => {
    const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
    if (charging && !ball) pwr = pwrAt((now - chargeT0) / 1000);
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
    const wc = document.createElement('canvas'); wc.width = 1024; wc.height = 512; const wg = wc.getContext('2d');   // 체육관 벽: 아래 나무 판벽 · 파란 보호 매트 · 위 연두색 페인트 · 높은 창
    wg.fillStyle = '#9aa892'; wg.fillRect(0, 0, 1024, 512); for (let k = 0; k < 6; k++) { wg.fillStyle = '#1a2230'; wg.fillRect(60 + k * 170, 40, 120, 90); wg.fillStyle = 'rgba(120,150,190,.35)'; wg.fillRect(64 + k * 170, 44, 112, 82); wg.fillStyle = '#d8d8d0'; wg.fillRect(118 + k * 170, 40, 4, 90); wg.fillRect(60 + k * 170, 84, 120, 3); }
    wg.fillStyle = '#7a5530'; wg.fillRect(0, 300, 1024, 212); for (let k = 0; k < 64; k++) { wg.fillStyle = `rgba(30,15,5,${.15 + (k % 3) * .05})`; wg.fillRect(k * 16, 300, 2, 212); } wg.fillStyle = '#2a4a8a'; wg.fillRect(0, 380, 1024, 110); for (let k = 0; k < 8; k++) { wg.fillStyle = 'rgba(0,0,0,.25)'; wg.fillRect(k * 128, 380, 3, 110); }
    wg.fillStyle = '#c8a040'; wg.fillRect(0, 296, 1024, 6);
    const wt = new THREE.CanvasTexture(wc); wt.colorSpace = THREE.SRGBColorSpace; const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), M(0xffffff, { map: wt, roughness: .9 })); wall.position.set(0, 2, -2); sc.add(wall);
    const bx0 = X(boardX + 4); const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, 2.4, 14), M(0x30343a, { metalness: .6 })); pole.position.set(bx0 + .45, 1.2, -.15); sc.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.5, .06, .06), M(0x30343a, { metalness: .6 })); arm.position.set(bx0 + .22, Y(93), -.15); sc.add(arm);
    const bdc = document.createElement('canvas'); bdc.width = 512; bdc.height = 384; const bdg = bdc.getContext('2d');   // 백보드 앞면: 흰 판 · 검은 테두리 · 붉은 슈팅 사각형
    bdg.fillStyle = '#f4f4f0'; bdg.fillRect(0, 0, 512, 384); bdg.strokeStyle = '#151515'; bdg.lineWidth = 18; bdg.strokeRect(9, 9, 494, 366); bdg.strokeStyle = '#d02a1a'; bdg.lineWidth = 12; bdg.strokeRect(160, 170, 192, 150); bdg.fillStyle = 'rgba(0,0,0,.05)'; for (let k = 0; k < 40; k++) bdg.fillRect(Math.random() * 512, Math.random() * 384, 30, 2);
    const bdt = new THREE.CanvasTexture(bdc); bdt.colorSpace = THREE.SRGBColorSpace; const edgeM = M(0xd8d8d4, { roughness: .4 }), faceM = M(0xffffff, { map: bdt, roughness: .35 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(.04, .78, 1.05), [edgeM, faceM, edgeM, edgeM, edgeM, edgeM]); board.position.set(bx0, Y(93), 0); sc.add(board);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(.07, .06, 1.07), M(0x1e3e8a, { roughness: .8 })); pad.position.set(bx0, Y(93) - .41, 0); sc.add(pad);
    const brace = new THREE.Mesh(new THREE.BoxGeometry(.18, .08, .04), M(0x30343a, { metalness: .6 })); brace.position.set(bx0 - .06, Y(rimY) + .02, 0); sc.add(brace);
    const sq = new THREE.Mesh(new THREE.BoxGeometry(.045, .3, .4), M(0xffffff, { transparent: true, opacity: .0 })); sc.add(sq);
    
    const rimM = M(0xe0501c, { metalness: .5, roughness: .35 }); const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR / 100 + .02, .012, 8, 32), rimM); rim.rotation.x = Math.PI / 2; rim.position.set(X(rimX + 4), Y(rimY), 0); sc.add(rim);
    const netP = [], NL = 5, NS = 12;   // 그물: 마름모로 엇갈려 묶인 흰 나일론 끈 (아래로 갈수록 좁아짐)
    for (let L = 0; L < NL; L++) for (let k = 0; k < NS; k++) { const r0 = (rimR / 100 + .02) * (1 - L * .09), r1 = (rimR / 100 + .02) * (1 - (L + 1) * .09), a0 = (k + (L % 2) * .5) / NS * Math.PI * 2, y0 = -L * .07, y1 = -(L + 1) * .07; [-.5, .5].forEach(o => { const a1 = a0 + o / NS * Math.PI * 2; netP.push(Math.cos(a0) * r0, y0, Math.sin(a0) * r0, Math.cos(a1) * r1, y1, Math.sin(a1) * r1); }); }
    const netGeo = new THREE.BufferGeometry(); netGeo.setAttribute('position', new THREE.Float32BufferAttribute(netP, 3)); const net = new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({ color: 0xf4f4ec, transparent: true, opacity: .85 })); net.position.set(rim.position.x, Y(rimY), 0); sc.add(net);
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
      net.scale.y = ball && ball.scored && ball.y < rimY + 60 ? 1.25 : 1; net.rotation.y += ball && ball.scored ? .05 : 0; r.render(sc, cam); requestAnimationFrame(lp); }; requestAnimationFrame(lp); })();
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

    // 어두운 시청각실 벽 + 줄로 내린 흰 스크린 (살짝 사다리꼴로 비친다)
    g.fillStyle = '#0b0a09'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#1a1712'; g.fillRect(28, 8, 404, 8); g.fillStyle = '#e8e4da'; g.fillRect(36, 16, 388, 210); g.fillStyle = '#16130f'; g.fillRect(36, 16, 388, 4); g.fillRect(36, 222, 388, 4);
    g.fillStyle = '#2a2620'; g.fillRect(222, 226, 16, 10);
    const flick = .9 + Math.random() * .1, fx0 = 54, fy0 = 26, fw = 352, fh = 190;
    g.save(); g.beginPath(); g.moveTo(fx0 + 4, fy0); g.lineTo(fx0 + fw - 4, fy0); g.lineTo(fx0 + fw, fy0 + fh); g.lineTo(fx0, fy0 + fh); g.closePath(); g.clip();
    const lamp = g.createRadialGradient(230, 118, 20, 230, 121, 230); lamp.addColorStop(0, `rgba(255,244,214,${flick})`); lamp.addColorStop(1, `rgba(150,128,90,${flick * .9})`); g.fillStyle = lamp; g.fillRect(fx0, fy0, fw, fh);
    const oy = (((roll + 100) % 200) + 200) % 200 - 100, blur = clamp(df * 16, 0, 10);
    g.filter = blur > .3 ? `blur(${blur.toFixed(1)}px)` : 'none';
    [-1, 0, 1].forEach(fi => {   // 위아래로 이어진 필름 프레임 (트래킹이 어긋나면 프레임 경계 검은 띠가 화면을 지나간다)
      const yy = oy + fi * 200;
      g.save(); g.translate(0, yy);
      [[split, 'rgba(200,40,30,.35)'], [-split, 'rgba(30,80,200,.35)'], [0, 'rgba(40,30,20,.88)']].forEach(([ox, col]) => {   // 색수차: 초점이 어긋나면 붉고 푸른 겹상
        if (ox === 0 && col.startsWith('rgba(200') ) return;
        g.save(); g.translate(ox, 0); g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 2;
        g.strokeRect(80, 44, 300, 150); g.font = 'bold 18px "Noto Serif KR", serif'; g.fillText('1998. 10. 12 — 제30주년 리허설 기록', 92, 82);
        g.font = '14px sans-serif'; g.fillText('3학년 2반 방송반: 윤하늘 · 강민아 · 이수아', 96, 118); g.fillText('“마지막 하교 방송 테이프는 방송부스에…”', 96, 148); g.restore();
      });
      g.fillStyle = 'rgba(10,8,6,.92)'; g.fillRect(fx0, 216, fw, 10);   // 프레임 사이 검은 띠
      g.restore();
    });
    g.filter = 'none';
    for (let k = 0; k < 14; k++) { g.fillStyle = `rgba(20,14,8,${Math.random() * .35})`; g.fillRect(fx0 + Math.random() * fw, fy0 + Math.random() * fh, 1 + Math.random() * 2.5, 1 + Math.random() * 2.5); }   // 필름 먼지
    if (Math.random() < .5) { g.strokeStyle = 'rgba(30,20,10,.25)'; g.lineWidth = 1; const sx2 = fx0 + Math.random() * fw; g.beginPath(); g.moveTo(sx2, fy0); g.lineTo(sx2 + 2, fy0 + fh); g.stroke(); }   // 세로 긁힘
    const vg = g.createRadialGradient(230, 121, 90, 230, 121, 240); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,12,4,.55)'); g.fillStyle = vg; g.fillRect(fx0, fy0, fw, fh);
    g.restore();
    g.fillStyle = 'rgba(255,240,200,.04)'; g.beginPath(); g.moveTo(0, 290); g.lineTo(fx0, fy0); g.lineTo(fx0 + fw, fy0 + fh); g.lineTo(60, 290); g.fill();   // 먼지 낀 빛줄기
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
  const p = open(title, '밸브 1 · 2 · 3을 클릭(또는 <b>1 · 2 · 3 키</b>)해 회전시켜 세 배관의 수압을 모두 <b style="color:#60ffa0">안전 구역(42 ~ 58 PSI)</b>에 맞춘 뒤 <b>배수 레버(Space)</b>를 당겨라<br>반대로 잠그기: <b>우클릭</b> 또는 <b>Q · W · E</b>');
  const c = canvas(460, 290), g = c.getContext('2d');
  let psi = [24, 72, 30], angs = [0, 0, 0], shown = [24, 72, 30], lastT = performance.now(), lever = 0;
  screen3D(c, { kind: 'metal', prop: 'valves', anim: () => ({ psi: shown, angs }), pick: (i, d) => turnValve(i, d) });
  const turnValve = (i, dir = 1) => {
    if (!finish) return;
    sfx.clank ? sfx.clank(.6) : sfx.click();
    angs[i] += dir * Math.PI / 3;
    const d = dir;
    if (i === 0) { psi[0] = clamp(psi[0] + 12 * d, 10, 90); psi[1] = clamp(psi[1] - 7 * d, 10, 90); }
    else if (i === 1) { psi[1] = clamp(psi[1] + 11 * d, 10, 90); psi[2] = clamp(psi[2] - 8 * d, 10, 90); psi[0] = clamp(psi[0] - 4 * d, 10, 90); }
    else if (i === 2) { psi[2] = clamp(psi[2] + 13 * d, 10, 90); psi[0] = clamp(psi[0] - 6 * d, 10, 90); }
  };
  const pullLever = () => {
    if (!finish) return;
    if (psi.every(v => v >= 42 && v <= 58)) { lever = 1; sfx.unlock(); sfx.splash && setTimeout(() => sfx.splash(), 200); status('3연동 수압 평형 달성! 다이빙 풀 배수 밸브가 개방됩니다!', 'ok'); setTimeout(() => close(true), 650); }
    else { lever = .4; sfx.buzz(); status('수압 불균형! 세 게이지 모두 42~58 PSI 초록 구간에 들어와야 합니다.', 'err'); }
  };
  const pickAt = e => { const r = c.getBoundingClientRect(), x = (e.clientX - r.left) * c.width / r.width, y = (e.clientY - r.top) * c.height / r.height; return { x, y, i: x < 160 ? 0 : x < 305 ? 1 : 2 }; };
  c.addEventListener('click', e => { const { y, i } = pickAt(e); if (y > 232) { pullLever(); return; } turnValve(i, e.shiftKey ? -1 : 1); });
  c.addEventListener('contextmenu', e => { e.preventDefault(); const { y, i } = pickAt(e); if (y <= 232) turnValve(i, -1); });
  keys(e => {
    if (e.type !== 'keydown') return;
    const rev = e.shiftKey ? -1 : 1;
    if (e.code === 'Digit1' || e.code === 'KeyA') turnValve(0, rev);
    else if (e.code === 'Digit2' || e.code === 'KeyS') turnValve(1, rev);
    else if (e.code === 'Digit3' || e.code === 'KeyD') turnValve(2, rev);
    else if (e.code === 'KeyQ') turnValve(0, -1);
    else if (e.code === 'KeyW') turnValve(1, -1);
    else if (e.code === 'KeyE') turnValve(2, -1);
    else if (e.code === 'Space' || e.code === 'Enter') pullLever();
  });
  const brass = (x0, y0, r) => { const b = g.createRadialGradient(x0 - r * .35, y0 - r * .35, r * .1, x0, y0, r); b.addColorStop(0, '#fff2b8'); b.addColorStop(.45, '#c89a3a'); b.addColorStop(1, '#5a3c10'); return b; };
  const A0 = Math.PI * .75, SW = Math.PI * 1.5, vA = v => A0 + v / 100 * SW;   // 게이지 눈금: 0~100 PSI 를 270° 에
  function draw(now) {
    // 페인트 벗겨진 콘크리트 벽 + 가로 주관(아연도 강관)
    g.fillStyle = '#4c524c'; g.fillRect(0, 0, c.width, c.height);
    for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(${k % 2 ? 30 : 120},${k % 2 ? 34 : 120},${k % 2 ? 30 : 110},.06)`; g.fillRect((k * 97) % 460, (k * 53) % 290, 30 + k % 20, 12 + k % 9); }
    const pipe = g.createLinearGradient(0, 140, 0, 162); pipe.addColorStop(0, '#9aa0a2'); pipe.addColorStop(.4, '#e0e4e4'); pipe.addColorStop(1, '#4a5052'); g.fillStyle = pipe; g.fillRect(0, 141, 460, 20);
    g.fillStyle = 'rgba(120,70,30,.35)'; for (let k = 0; k < 9; k++) g.fillRect(20 + k * 50, 156, 14, 5);   // 녹물 자국
    [88, 230, 372].forEach((cx, i) => {
      const v = shown[i], ok = psi[i] >= 42 && psi[i] <= 58;
      // 게이지 연결관 · 황동 압력계
      g.fillStyle = '#8a7a4a'; g.fillRect(cx - 5, 132, 10, 12);
      g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 8; g.shadowOffsetY = 3; g.fillStyle = brass(cx, 74, 54); g.beginPath(); g.arc(cx, 74, 54, 0, 7); g.fill(); g.restore();
      g.fillStyle = '#f2efe4'; g.beginPath(); g.arc(cx, 74, 46, 0, 7); g.fill();
      g.lineWidth = 6; g.strokeStyle = 'rgba(40,180,90,.8)'; g.beginPath(); g.arc(cx, 74, 38, vA(42), vA(58)); g.stroke();
      g.strokeStyle = 'rgba(210,40,30,.8)'; g.beginPath(); g.arc(cx, 74, 38, vA(80), vA(100)); g.stroke();
      g.strokeStyle = '#1a1a1a'; for (let t = 0; t <= 100; t += 2) { const a = vA(t), r1 = t % 10 ? 40 : 36; g.lineWidth = t % 10 ? .8 : 1.6; g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, 74 + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * 44, 74 + Math.sin(a) * 44); g.stroke(); }
      g.fillStyle = '#1a1a1a'; g.font = '7.5px sans-serif'; g.textAlign = 'center'; for (let t = 0; t <= 100; t += 20) { const a = vA(t); g.fillText(String(t), cx + Math.cos(a) * 28, 74 + Math.sin(a) * 28 + 3); }
      g.font = 'bold 8px sans-serif'; g.fillText('PSI', cx, 98); g.font = '6.5px sans-serif'; g.fillStyle = '#555'; g.fillText('SEOIL GAUGE', cx, 60); g.textAlign = 'left';
      const na = vA(v) + Math.sin(now / 90 + i) * .006 * (v > 75 ? 3 : 1);
      g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - Math.cos(na) * 8, 74 - Math.sin(na) * 8); g.lineTo(cx + Math.cos(na) * 40, 74 + Math.sin(na) * 40); g.stroke();
      g.strokeStyle = '#c01818'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + Math.cos(na) * 30, 74 + Math.sin(na) * 30); g.lineTo(cx + Math.cos(na) * 41, 74 + Math.sin(na) * 41); g.stroke();
      g.fillStyle = brass(cx, 74, 5); g.beginPath(); g.arc(cx, 74, 4.5, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(cx - 14, 56, 22, 10, -.6, 0, 7); g.fill();   // 유리 반사
      g.fillStyle = ok ? '#b8ffcc' : '#ffd8c8'; g.font = 'bold 12px monospace'; g.fillText(`${psi[i].toFixed(0)} PSI`, cx - 24, 138 - 6 + 0);
      // 황동 게이트 밸브 몸체 + 핸들 휠 (돌린 만큼 회전)
      g.fillStyle = brass(cx, 182, 22); g.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; g[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * 20, 162 + Math.sin(a) * 14); } g.fill();
      g.fillStyle = '#8a6a2a'; g.fillRect(cx - 3, 162, 6, 22);
      g.save(); g.translate(cx, 192); g.rotate(angs[i]);
      g.strokeStyle = '#3a2408'; g.lineWidth = 9; g.beginPath(); g.arc(0, 0, 28, 0, 7); g.stroke();
      g.strokeStyle = brass(-6, -6, 30); g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 28, 0, 7); g.stroke();
      for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; g.strokeStyle = '#a07a2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 27, Math.sin(a) * 27); g.stroke(); }
      for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5; g.fillStyle = '#6a4a14'; g.beginPath(); g.arc(Math.cos(a) * 28, Math.sin(a) * 28, 2, 0, 7); g.fill(); }
      g.fillStyle = brass(-2, -2, 9); g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill(); g.restore();
      g.fillStyle = '#e4e8e0'; g.font = '11px sans-serif'; g.fillText(`[${i + 1}] 밸브 ${i + 1} 돌리기`, cx - 42, 234);
    });
    const allOk = psi.every(v => v >= 42 && v <= 58);
    g.fillStyle = allOk ? '#2a7a4c' : '#2c3236'; g.fillRect(60, 242, 340, 40); g.strokeStyle = allOk ? '#70ffb0' : '#5a6468'; g.lineWidth = 2; g.strokeRect(60, 242, 340, 40);
    g.save(); g.translate(82, 262); g.rotate(-.6 + lever * 1.1); g.fillStyle = '#c8202a'; g.fillRect(-3, -18, 6, 18); g.fillStyle = '#111'; g.beginPath(); g.arc(0, -18, 5, 0, 7); g.fill(); g.restore();
    g.fillStyle = '#ffffff'; g.font = 'bold 13px sans-serif';
    g.fillText(allOk ? '✦ 수압 동조 완료 — [Space / 클릭] 배수 개방!' : '[Space / 클릭] 메인 배수 레버 (모두 42~58 PSI 필요)', 98, 267);
  }
  const loop = now => { const dt = Math.min(.08, (now - lastT) / 1000); lastT = now; shown = shown.map((v, i) => v + (psi[i] - v) * Math.min(1, dt * 6)); lever = Math.max(0, lever - dt * .8); draw(now); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
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
  let hover = false;
  c.onpointerleave = () => { hover = false; draw(); };
  c.onpointermove = e => {
    const p = toLocal(e);
    mx = p.x; my = p.y; hover = true;
    if (!dragging) { draw(); return; }
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

  // 흑연 선: 여러 겹의 가는 선을 살짝 어긋나게 겹쳐 연필 결을 낸다
  const graphite = (pts2, alpha, width, close = false) => {
    if (pts2.length < 2) return;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let k = 0; k < 4; k++) {
      g.strokeStyle = `rgba(48,46,52,${alpha * (k ? .45 : 1)})`; g.lineWidth = k ? width * .45 : width;
      g.beginPath(); pts2.forEach((p2, i) => { const j1 = Math.sin(i * 12.9 + k * 3.1) * (k ? .9 : .3), j2 = Math.cos(i * 7.3 + k * 1.7) * (k ? .9 : .3); i ? g.lineTo(p2.x + j1, p2.y + j2) : g.moveTo(p2.x + j1, p2.y + j2); }); if (close) g.closePath(); g.stroke();
    }
  };
  function draw() {
    // 화실 스케치북: 종이 결 + 위쪽 스프링 제본
    mgPaper(g, 0, 0, c.width, c.height, '#efe9da', 'sketch');
    g.fillStyle = '#c8c0ae'; g.fillRect(0, 0, c.width, 14);
    for (let x = 18; x < c.width; x += 20) { g.fillStyle = '#2a2622'; g.beginPath(); g.arc(x, 8, 3, 0, 7); g.fill(); g.strokeStyle = '#9aa0a6'; g.lineWidth = 2; g.beginPath(); g.arc(x, 4, 5, Math.PI * .1, Math.PI * .9, true); g.stroke(); }
    // 연한 밑그림 가이드 (HB 로 가볍게)
    g.save(); g.setLineDash([5, 7]); graphite([...pts, pts[0]], .16, 1.3); g.restore();
    // 사용자가 자유롭게 그은 연필 자국
    userStrokes.forEach(st => graphite(st, .28, 1.6));
    // 확정된 4B 윤곽선 (0 .. curIdx) + 끝나면 사선 해칭 음영
    if (curIdx > 0) {
      graphite(pts.slice(0, curIdx + 1), .85, 2.6, curIdx >= pts.length - 1);
      if (curIdx >= pts.length - 1) {
        g.save(); g.beginPath(); pts.forEach((pt, i) => i ? g.lineTo(pt.x, pt.y) : g.moveTo(pt.x, pt.y)); g.closePath(); g.clip();
        g.strokeStyle = 'rgba(50,48,54,.18)'; g.lineWidth = 1; for (let k = -300; k < 500; k += 7) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 220, 290); g.stroke(); } g.restore();
      }
    }
    // 드래그 중: 현재 점에서 연필 끝까지 이어지는 선
    if (dragging && curIdx < pts.length - 1) graphite([pts[curIdx], { x: mx, y: my }], .5, 1.8);
    // 번호 점: 연필로 그린 동그라미 · 다음 점은 붉은 색연필
    pts.forEach((pt, i) => {
      const done = i <= curIdx, isNext = i === curIdx + 1;
      g.strokeStyle = isNext ? 'rgba(190,50,30,.9)' : done ? 'rgba(40,40,46,.85)' : 'rgba(80,76,70,.55)'; g.lineWidth = isNext ? 2 : 1.3;
      g.beginPath(); g.ellipse(pt.x, pt.y, isNext ? 13 : 10, isNext ? 12 : 9.5, .3, 0, Math.PI * 1.92); g.stroke();
      if (done) { g.fillStyle = 'rgba(40,40,46,.75)'; g.beginPath(); g.arc(pt.x, pt.y, 3, 0, 7); g.fill(); }
      g.fillStyle = isNext ? '#a8301a' : '#3a3630'; g.font = '16px "East Sea Dokdo", cursive, sans-serif';
      g.fillText(String(i + 1), pt.x + 9, pt.y - 9);
      g.font = (isNext ? 'bold ' : '') + '11px sans-serif'; g.fillStyle = isNext ? '#9e2812' : 'rgba(58,48,36,.8)';
      g.fillText(pt.label, pt.x - 34, pt.y + (pt.y < 120 ? -18 : 26));
    });
    g.strokeStyle = '#4a3b2a'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, c.width - 3, c.height - 3);
    // 연필 커서 (노란 육각 연필 · 깎은 나무 · 흑연 심)
    if (hover || dragging) {
      g.save(); g.translate(mx, my); g.rotate(-.75);
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(6, 4, 70, 9);
      g.fillStyle = '#2a2a2e'; g.beginPath(); g.moveTo(0, 0); g.lineTo(5, -2); g.lineTo(5, 2); g.fill();
      g.fillStyle = '#e2c49a'; g.beginPath(); g.moveTo(5, -2); g.lineTo(16, -5); g.lineTo(16, 5); g.lineTo(5, 2); g.fill();
      g.fillStyle = '#e8b818'; g.fillRect(16, -5, 52, 10); g.fillStyle = '#c89a10'; g.fillRect(16, 1.5, 52, 3.5); g.fillStyle = '#f8d850'; g.fillRect(16, -5, 52, 2);
      g.fillStyle = '#b0b4b8'; g.fillRect(68, -5, 7, 10); g.fillStyle = '#e88a9a'; g.fillRect(75, -5, 8, 10);
      g.fillStyle = '#1a1a1a'; g.font = 'bold 5px sans-serif'; g.fillText('4B', 50, 1); g.restore();
    }
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

  const nv = volts.slice(), nvv = [0, 0, 0];   // 바늘: 스프링-댐퍼로 따라가며 살짝 넘쳤다 돌아온다
  const rivet = (x, y) => { const rg = g.createRadialGradient(x - 1, y - 1, .5, x, y, 3.5); rg.addColorStop(0, '#e8ece8'); rg.addColorStop(1, '#4a524c'); g.fillStyle = rg; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); };
  const loop = now => {
    const dt = Math.min(.08, (now - lastT) / 1000); lastT = now;
    syncAng = (syncAng + dt * 2.8) % (Math.PI * 2);
    for (let k = 0; k < 3; k++) { nvv[k] += ((volts[k] - nv[k]) * 60 - nvv[k] * 7) * dt; nv[k] += nvv[k] * dt; }
    // 배전반 철판 (회녹색 도장 · 리벳)
    const pn = g.createLinearGradient(0, 0, 0, 310); pn.addColorStop(0, '#5e6e64'); pn.addColorStop(1, '#46544c'); g.fillStyle = pn; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(255,255,255,.03)'; for (let k = 0; k < 30; k++) g.fillRect((k * 71) % 500, (k * 37) % 310, 40, 1);
    [[8, 8], [492, 8], [8, 302], [492, 302], [334, 8], [334, 302]].forEach(([x, y]) => rivet(x, y));
    ['R상 (L1)', 'S상 (L2)', 'T상 (L3)'].forEach((lb, i) => {
      const cx = 66 + i * 104, v = volts[i], ok = v >= 215 && v <= 225, PC = ['#c83030', '#d8b020', '#2a5ab0'][i];
      // 상 표시 명판
      g.fillStyle = '#1a1c1a'; g.fillRect(cx - 40, 18, 80, 18); g.fillStyle = PC; g.fillRect(cx - 40, 18, 6, 18); g.fillStyle = '#f0f0e8'; g.font = 'bold 11px sans-serif'; g.fillText(lb, cx - 28, 31);
      // 사각 베이클라이트 계기 + 크림색 눈금판
      g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 6; g.shadowOffsetY = 3; g.fillStyle = '#141414'; g.fillRect(cx - 46, 42, 92, 104); g.restore();
      g.fillStyle = '#efe8d4'; g.fillRect(cx - 40, 48, 80, 74);
      const mx = cx, my = 120, R = 56, a0 = -Math.PI / 2 - .78, a1 = -Math.PI / 2 + .78, va = x => a0 + clamp((x - 170) / 90, -.03, 1.03) * (a1 - a0);
      g.lineWidth = 5; g.strokeStyle = 'rgba(40,170,80,.75)'; g.beginPath(); g.arc(mx, my, R - 6, va(215), va(225)); g.stroke();
      g.strokeStyle = '#1a1a1a'; for (let t = 170; t <= 260; t += 5) { const a = va(t), l = t % 20 === 0 ? 9 : 5; g.lineWidth = t % 20 === 0 ? 1.4 : .8; g.beginPath(); g.moveTo(mx + Math.cos(a) * (R - l), my + Math.sin(a) * (R - l)); g.lineTo(mx + Math.cos(a) * R, my + Math.sin(a) * R); g.stroke(); }
      g.fillStyle = '#1a1a1a'; g.font = '7px sans-serif'; g.textAlign = 'center'; [180, 200, 220, 240, 260].forEach(t => { const a = va(t); g.fillText(String(t), mx + Math.cos(a) * (R - 15), my + Math.sin(a) * (R - 15) + 2); });
      g.strokeStyle = '#c01818'; g.lineWidth = 1.2; const ar = va(220); g.beginPath(); g.moveTo(mx + Math.cos(ar) * (R - 2), my + Math.sin(ar) * (R - 2)); g.lineTo(mx + Math.cos(ar) * (R + 4), my + Math.sin(ar) * (R + 4)); g.stroke();
      g.fillStyle = '#2a2a2a'; g.font = 'bold 12px serif'; g.fillText('V', mx, 98); g.font = '6px sans-serif'; g.fillText('AC  CLASS 1.5', mx, 108); g.textAlign = 'left';
      g.fillStyle = 'rgba(180,190,200,.35)'; g.fillRect(cx - 34, 62, 68, 2);   // 시차 방지 거울띠
      const na = va(nv[i]); g.strokeStyle = '#111'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + Math.cos(na) * (R - 1), my + Math.sin(na) * (R - 1)); g.stroke();
      g.fillStyle = '#141414'; g.fillRect(cx - 40, 122, 80, 18); g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.moveTo(cx - 40, 48); g.lineTo(cx + 10, 48); g.lineTo(cx - 40, 100); g.fill();   // 유리 반사
      g.fillStyle = ok ? '#7dffb0' : '#ffd890'; g.font = 'bold 12px monospace'; g.fillText(`${v}V`, cx - 16, 136);
      // -5V / +5V 베이클라이트 누름 단추
      [[cx - 40, '-5V'], [cx + 2, '+5V']].forEach(([x0, t]) => { const bg = g.createRadialGradient(x0 + 12, 186, 2, x0 + 19, 194, 22); bg.addColorStop(0, '#4a4a4a'); bg.addColorStop(1, '#0e0e0e'); g.fillStyle = bg; g.fillRect(x0, 176, 38, 36); g.strokeStyle = '#7a847e'; g.lineWidth = 1; g.strokeRect(x0, 176, 38, 36); g.fillStyle = '#f0f0e8'; g.font = 'bold 12px monospace'; g.fillText(t, x0 + 7, 199); });
      g.fillStyle = '#d8e0d8'; g.font = '11px sans-serif'; g.fillText(`[${i + 1}키] 자동보정`, cx - 36, 232);
      g.fillStyle = ok ? '#40ff70' : '#3a1a14'; g.beginPath(); g.arc(cx, 254, 6, 0, 7); g.fill(); if (ok) { g.fillStyle = 'rgba(80,255,120,.25)'; g.beginPath(); g.arc(cx, 254, 12, 0, 7); g.fill(); }   // 정격 표시등
    });
    // 동기경 (SYNCHROSCOPE) — 바늘이 12시 초록 구간을 지날 때 투입
    g.fillStyle = '#1a1c1a'; g.fillRect(346, 18, 136, 18); g.fillStyle = '#f0f0e8'; g.font = 'bold 11px sans-serif'; g.fillText('위상 동기경 (SYNC)', 356, 31);
    g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 6; g.fillStyle = '#141414'; g.beginPath(); g.arc(411, 106, 56, 0, 7); g.fill(); g.restore();
    g.fillStyle = '#efe8d4'; g.beginPath(); g.arc(411, 106, 48, 0, 7); g.fill();
    g.strokeStyle = 'rgba(40,170,80,.85)'; g.lineWidth = 7; g.beginPath(); g.arc(411, 106, 40, -Math.PI * .5 - .45, -Math.PI * .5 + .45); g.stroke();
    g.strokeStyle = '#1a1a1a'; for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12; g.lineWidth = k % 6 ? .8 : 1.6; g.beginPath(); g.moveTo(411 + Math.cos(a) * 44, 106 + Math.sin(a) * 44); g.lineTo(411 + Math.cos(a) * 48, 106 + Math.sin(a) * 48); g.stroke(); }
    g.fillStyle = '#1a1a1a'; g.font = 'bold 7px sans-serif'; g.fillText('SLOW', 368, 140); g.fillText('FAST', 432, 140);
    g.strokeStyle = '#111'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(411 - Math.cos(syncAng) * 10, 106 - Math.sin(syncAng) * 10); g.lineTo(411 + Math.cos(syncAng) * 42, 106 + Math.sin(syncAng) * 42); g.stroke();
    g.fillStyle = '#333'; g.beginPath(); g.arc(411, 106, 4, 0, 7); g.fill();
    const normA = ((syncAng % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), inSync = Math.abs(normA - Math.PI * 1.5) <= .48;
    [[372, 172], [450, 172]].forEach(([x, y]) => { g.fillStyle = inSync ? '#fff4b0' : '#5a4a20'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); if (inSync) { g.fillStyle = 'rgba(255,240,150,.3)'; g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); } });   // 동기 램프
    // 주 차단기 (검은 손잡이 레버)
    const vOk = volts.every(v => v >= 215 && v <= 225);
    g.fillStyle = vOk ? '#2a6a44' : '#2a302c'; g.fillRect(348, 198, 126, 78); g.strokeStyle = vOk ? '#80ffb8' : '#5a6660'; g.lineWidth = 2; g.strokeRect(348, 198, 126, 78);
    g.fillStyle = '#121212'; g.fillRect(360, 208, 30, 58); g.fillStyle = '#2a2a2a'; g.fillRect(366, 212 + (finish ? 26 : 0), 18, 24); g.fillStyle = '#e8e8e0'; g.font = 'bold 7px sans-serif'; g.fillText('ON', 368, 206 + 0); g.fillText('OFF', 366, 274);
    g.fillStyle = '#ffffff'; g.font = 'bold 11px sans-serif'; g.fillText(vOk ? '⚡ [Space / 클릭]' : '3상 220V 맞춘 후', 396, 230); g.fillText(vOk ? '12시 방향에 투입!' : '차단기 투입 가능', 396, 250);
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
  // 2008 문방구 앞 뽑기 기계: 네모난 투명 아크릴 창(캡슐이 쌓여 있음) · 위 광고판 · 옆에 한 대 더
  const win = M(new THREE.BoxGeometry(.66, .5, .6), new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, roughness: .04, transparent: true, opacity: .14, depthWrite: false }), 0, .93, 0); win.castShadow = false;
  [[-.33, -.3], [.33, -.3], [-.33, .3], [.33, .3]].forEach(([x, z]) => M(new THREE.BoxGeometry(.03, .5, .03), red, x, .93, z));   // 창틀 기둥
  M(new THREE.BoxGeometry(.74, .04, .68), red, 0, 1.2, 0);
  { const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, '#ffe048'); gr.addColorStop(1, '#ff9a20'); g.fillStyle = gr; g.fillRect(0, 0, 512, 160);
    for (let k = 0; k < 14; k++) { g.fillStyle = ['#ff4060', '#40a0ff', '#50d080', '#c060ff'][k % 4]; g.beginPath(); const x = 20 + k * 36, y = 18 + (k % 2) * 120; for (let q = 0; q < 10; q++) { const a = q * Math.PI / 5, r = q % 2 ? 6 : 14; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); }
    g.fillStyle = '#c8101a'; g.font = 'bold 76px sans-serif'; g.textAlign = 'center'; g.lineWidth = 10; g.strokeStyle = '#fff'; g.strokeText('행운뽑기', 256, 100); g.fillText('행운뽑기', 256, 100); g.fillStyle = '#1a3aa0'; g.font = 'bold 30px sans-serif'; g.fillText('★ 신상 입고! 꽝 없음 ★', 256, 146);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; M(new THREE.BoxGeometry(.74, .23, .04), [red, red, red, red, new THREE.MeshStandardMaterial({ map: t, roughness: .4 }), red], 0, 1.34, .3); }
  { const tw = M(new THREE.BoxGeometry(.6, 1.3, .6), new THREE.MeshStandardMaterial({ color: 0x2a6ad0, roughness: .35 }), -.9, .65, -.25); const tw2 = M(new THREE.BoxGeometry(.5, .4, .5), new THREE.MeshPhysicalMaterial({ color: 0xe8f4ff, transparent: true, opacity: .2, depthWrite: false }), -.9, 1.05, -.2); tw2.castShadow = false;
    const wc = document.createElement('canvas'); wc.width = 256; wc.height = 256; const wg = wc.getContext('2d'); wg.fillStyle = '#d8d0c0'; wg.fillRect(0, 0, 256, 256); wg.fillStyle = '#b8b0a0'; for (let y = 0; y < 256; y += 16) for (let x = (y / 16 % 2) * 8; x < 256; x += 16) wg.fillRect(x, y, 3, 3);   // 문방구 유공보드 벽
    const wt = new THREE.CanvasTexture(wc); wt.wrapS = wt.wrapT = THREE.RepeatWrapping; wt.repeat.set(4, 2); const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshStandardMaterial({ map: wt, roughness: .9 })); wall.position.set(0, 2, -1.2); sc.add(wall);
    [[-1.6, 1.5, 0xff6080], [-1.3, 1.7, 0x60b0ff], [1.4, 1.6, 0xffd040], [1.7, 1.35, 0x60d080]].forEach(([x, y, col]) => { const tg = new THREE.Mesh(new THREE.BoxGeometry(.22, .3, .03), new THREE.MeshStandardMaterial({ color: col, roughness: .5 })); tg.position.set(x, y, -1.17); sc.add(tg); }); }
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
  for (let i = 0; i < 46; i++) { const c = capsule(COL[i % COL.length]), y = .73 + Math.pow(Math.random(), 1.6) * .32; c.position.set((Math.random() - .5) * .54, y, (Math.random() - .5) * .48); c.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3); c.userData.base = c.position.clone(); sc.add(c); caps.push(c); }
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
  const loop = now => { const dt = Math.min(.2, (now - lt) / 1000); lt = now;   // 느린 프레임에서도 동전 · 캡슐 연출이 실제 시간대로 끝나게
    if (coinT >= 0) { coinT += dt; coin.position.set(.2, .55 - Math.min(1, coinT / .5) * .17, .5 - Math.min(1, coinT / .5) * .15); if (coinT > .55) { coin.visible = false; coinT = -1; coinIn = true; sfx.clank ? sfx.clank(.6) : sfx.click(); status('동전이 떨어졌다 — 크랭크를 돌리세요', 'ok'); } }
    crank.rotation.z = -ang; shake = Math.max(0, shake - dt * 2);
    caps.forEach((c, i) => { const b = c.userData.base; c.position.set(b.x + Math.sin(now / 60 + i) * .006 * shake * 4, b.y + Math.abs(Math.sin(now / 45 + i * 1.7)) * .012 * shake * 4, b.z + Math.cos(now / 55 + i) * .006 * shake * 4); c.rotation.y += shake * dt * 3; });
    if (drop && !opened) { dropT += dt; const f = drop.userData.from; if (dropT < .5) drop.position.lerpVectors(f, new THREE.Vector3(0, .66, 0), dropT / .5); else if (dropT < 1.1) { const k = (dropT - .5) / .6; drop.position.set(0, .26 - k * .14 + Math.abs(Math.sin(k * 9)) * .04 * (1 - k), .3 + k * .22); drop.rotation.x += dt * 9; flap.rotation.x = -Math.sin(Math.min(1, k * 2) * Math.PI) * .9; } else { drop.position.y = .12 + Math.sin(now / 300) * .004; flap.rotation.x = 0; } }
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

  const CAPS = Array.from({ length: 26 }, (_, k) => ({ x: 84 + (k * 47) % 272, y: 132 - Math.floor(k / 6) * 17 - (k % 3) * 3, c: ['#ffcc38', '#48a8ff', '#ff5888', '#58e890', '#b868ff', '#ff8a30'][k % 6], r: (k * 1.7) % 6 }));
  function draw() {
    // 문방구 앞: 유공보드 벽 · 시멘트 바닥
    g.fillStyle = '#d4ccbc'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#b4ac9c'; for (let y = 6; y < 250; y += 14) for (let x = (y / 14 % 2) * 7 + 4; x < 440; x += 14) g.fillRect(x, y, 3, 3);
    g.fillStyle = '#7a766e'; g.fillRect(0, 290, 440, 20);
    // 빨간 철제 함 + 노란 광고판
    g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 12; g.shadowOffsetX = 6; const bd = g.createLinearGradient(56, 0, 384, 0); bd.addColorStop(0, '#9a1418'); bd.addColorStop(.5, '#d8262c'); bd.addColorStop(1, '#8a1216'); g.fillStyle = bd; g.fillRect(56, 26, 328, 270); g.restore();
    const hd = g.createLinearGradient(0, 30, 0, 60); hd.addColorStop(0, '#ffe048'); hd.addColorStop(1, '#ff9a20'); g.fillStyle = hd; g.fillRect(64, 32, 312, 30);
    g.fillStyle = '#c8101a'; g.font = 'bold 20px sans-serif'; g.fillText('행운뽑기  ₩100', 150, 55);
    // 투명 아크릴 창 속 캡슐 더미 (크랭크를 돌리면 들썩인다)
    g.fillStyle = 'rgba(200,225,240,.25)'; g.fillRect(70, 66, 300, 84); g.strokeStyle = '#f0f4f8'; g.lineWidth = 2; g.strokeRect(70, 66, 300, 84);
    g.save(); g.beginPath(); g.rect(70, 66, 300, 84); g.clip();
    CAPS.forEach((k, n) => { const jy = Math.sin(ang * 3 + n) * 3 * Math.min(1, ang), x = k.x, y = k.y + jy; g.save(); g.translate(x, y); g.rotate(k.r);
      g.fillStyle = '#f4f4f0'; g.beginPath(); g.arc(0, 0, 11, 0, Math.PI); g.fill(); g.fillStyle = k.c; g.beginPath(); g.arc(0, 0, 11, Math.PI, 0); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.beginPath(); g.arc(0, 0, 11, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(-4, -5, 3, 0, 7); g.fill(); g.restore(); });
    g.restore(); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(76, 70, 40, 76);
    // 동전 투입구 (크롬 판)
    const cp = g.createLinearGradient(66, 156, 176, 236); cp.addColorStop(0, '#f4f6f8'); cp.addColorStop(1, '#8a9096'); g.fillStyle = cp; g.fillRect(66, 156, 108, 80); g.strokeStyle = coinIn ? '#58ff9a' : '#ffd068'; g.lineWidth = 2.5; g.strokeRect(66, 156, 108, 80);
    g.fillStyle = '#1a1a1a'; g.fillRect(114, 166, 6, 30); g.fillStyle = '#3a3a3a'; g.font = 'bold 9px sans-serif'; g.fillText('100', 108, 210);
    g.fillStyle = '#1a1a1a'; g.font = 'bold 11px sans-serif'; g.fillText(coinIn ? '✓ 100원 투입됨' : '1. 100원 동전', 74, 224 - 0); g.font = '10px sans-serif'; g.fillText(coinIn ? '핸들을 돌리세요!' : '투입구 [클릭]', 74, 232 + 0);
    // 크롬 손잡이 (T자 그립)
    const cx = 295, cy = 195;
    const kb = g.createRadialGradient(cx - 14, cy - 14, 4, cx, cy, 52); kb.addColorStop(0, '#ffffff'); kb.addColorStop(.6, '#b8c0c6'); kb.addColorStop(1, '#5a6268'); g.fillStyle = kb; g.beginPath(); g.arc(cx, cy, 46, 0, 7); g.fill(); g.strokeStyle = '#3a4046'; g.lineWidth = 3; g.stroke();
    g.save(); g.translate(cx, cy); g.rotate(ang); const tg = g.createLinearGradient(0, -12, 0, 12); tg.addColorStop(0, '#f0f2f4'); tg.addColorStop(1, '#6a7076'); g.fillStyle = tg; g.fillRect(-40, -11, 80, 22); g.strokeStyle = '#2a2e32'; g.lineWidth = 1; g.strokeRect(-40, -11, 80, 22); g.fillStyle = '#ff4838'; g.beginPath(); g.arc(34, 0, 5, 0, 7); g.fill(); g.restore();
    // 배출구 (반투명 덮개)
    g.fillStyle = '#1a1a1a'; g.fillRect(180, 252, 80, 34); g.fillStyle = 'rgba(220,235,245,.3)'; g.fillRect(182, 254, 76, 30);
    if (ang >= Math.PI * 2 - .08) { g.fillStyle = '#ff5888'; g.beginPath(); g.arc(220, 272, 11, Math.PI, 0); g.fill(); g.fillStyle = '#f4f4f0'; g.beginPath(); g.arc(220, 272, 11, 0, Math.PI); g.fill(); }
    g.fillStyle = '#1a1208'; g.font = 'bold 12px monospace'; g.fillText(`2. 크랭크 회전: ${Math.round((ang / (Math.PI * 2)) * 360)}° / 360° [드래그 / Space]`, 40, 306);
  }
  draw(); return p;
}

export function run(kind, opts = {}) {
  if (MG.active) return Promise.resolve({ ok: false });
  // 미니게임 하나가 열리다 예외를 내면 MG.active 가 켜진 채 남아 이후 모든 미니게임 · 조작이 막혔다 → 닫고 실패로 돌려준다
  try { return ({ lockpick, dial, circuit, piano, slide, fishing, order, memory, tune, simon, timing, ouija, pipes, maze, rings, spotdiff, fuse, oscilloscope, chemMix, hoopShot, filmFocus, valveBalance, stampApprove, omrGrade, timetableRestore, libraryCatalog, cassetteSplice, microscopeSlide, sketchLine, voltageSync, gachaCrank, gacha3D })[kind](opts); }
  catch (e) { console.warn('[minigame]', kind, e); try { if (MG.active) close(false); } catch (e2) { $('mg').classList.remove('show'); MG.active = false; } return Promise.resolve({ ok: false }); }
}
