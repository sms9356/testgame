// 신규 엔진(WebGPU) 효과: TSL 노드 후처리(블룸 · 색보정 · 렌즈 왜곡 · 색수차 · 비네팅 · 글리치 · 번개 · 그레인) + 손전등 광선 + 입자
//   fx.js(WebGL · GLSL)와 같은 API 를 돌려준다 — 게임 코드는 엔진을 몰라도 된다.
//   WebGPU 는 점(Points) 크기를 1px 로만 그려서, 먼지 · 꽃잎 · 불꽃 · 연기는 인스턴스 스프라이트(PointsNodeMaterial + Sprite.count)로 그린다.
import * as THREE from './vendor/three.module.js';
import { ENGINE } from './engine.js?v=289';

export async function createFXWebGPU(renderer, scene, camera) {
  const W = ENGINE.W, T = ENGINE.TSL;
  const { uniform, pass, vec2, vec3, vec4, float, Fn, uv, sin, cos, fract, floor, dot, length, smoothstep, mix, clamp, max, mod, pow, abs, step, screenCoordinate,
    positionLocal, normalView, positionViewDirection, instancedBufferAttribute, mx_noise_float, luminance } = T;
  const { bloom } = await import('./vendor/addons/tsl/display/BloomNode.js');
  const size = new THREE.Vector2(); renderer.getSize(size);
  let mode = 'high';
  const opt = { bloom: true, grain: true, glitch: 1, flash: 1 };

  // ── 후처리 파이프라인 ──
  const U = { uTime: uniform(0), uFear: uniform(0), uGlitch: uniform(0), uGrain: uniform(.016), uFlash: uniform(0), uHurt: uniform(0), uRain: uniform(0), uRes: uniform(new THREE.Vector2(1, 1)), uBloom: uniform(1) };
  const final = { uniforms: U };
  const scenePass = pass(scene, camera), sceneTex = scenePass.getTextureNode('output');
  const safe = clamp(sceneTex, 0, 24);   // 반정밀도 버퍼의 Inf 가 블룸으로 번지는 것 방지
  const bloomPass = bloom(safe, .55, .45, .82);
  const h = p => fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453));
  const grade = Fn(() => {
    const st = uv().toVar();
    // 화면 글리치: 가로 띠가 순간적으로 밀린다
    const band = floor(st.y.mul(24).add(floor(U.uTime.mul(18)).mul(7))), r = h(vec2(band, floor(U.uTime.mul(22))));
    st.x.addAssign(step(r, U.uGlitch.mul(.55)).mul(h(vec2(band, U.uTime)).sub(.5)).mul(.08).mul(U.uGlitch));
    const c = st.sub(.5), d = length(c);
    st.addAssign(c.mul(d).mul(d).mul(U.uFear.mul(.045).add(.008)));   // 렌즈 왜곡
    const ca = U.uFear.mul(.004).add(.0003).add(U.uGlitch.mul(.012));   // 색수차
    const col = vec3(sceneTex.sample(st.add(c.mul(ca))).r, sceneTex.sample(st).g, sceneTex.sample(st.sub(c.mul(ca))).b).add(bloomPass.rgb.mul(U.uBloom)).toVar();
    const l = luminance(col);
    col.assign(mix(col, vec3(l), U.uFear.mul(.25).add(.18)));
    col.mulAssign(mix(vec3(.86, .98, 1.08), vec3(1.07, 1.0, .9), smoothstep(.02, .5, l)));
    col.assign(max(col.sub(.004), 0).mul(1.02));
    const v = smoothstep(.85, U.uFear.mul(-.1).add(.25), d);   // 비네팅 (공포가 오르면 붉게, 좁게)
    col.mulAssign(mix(float(.35), float(1), v));
    col.assign(mix(col, col.mul(vec3(1.35, .45, .4)), v.oneMinus().mul(U.uFear.mul(.8).add(U.uHurt))));
    col.addAssign(vec3(.55, .62, .8).mul(U.uFlash).mul(v.mul(.5).add(.5)));   // 번개 섬광
    const fc = screenCoordinate.xy.add(vec2(5.588, 3.27).mul(floor(mod(U.uTime.mul(24), 64))));   // IGN 그레인
    const g = fract(fract(dot(fc, vec2(.06711056, .00583715))).mul(52.9829189)).sub(.5);
    col.addAssign(g.mul(U.uGrain).mul(smoothstep(0, .5, l).oneMinus()).mul(U.uFear.mul(.6).add(1).add(U.uGlitch.mul(3))));
    col.mulAssign(float(1).sub(U.uGlitch.mul(.04).mul(step(.5, fract(screenCoordinate.y.mul(.5))))));
    return vec4(col, 1);
  });
  const pipe = new W.RenderPipeline(renderer); pipe.outputNode = grade();

  // ── 손전등 광선 (볼류메트릭 느낌의 원뿔) ──
  const coneG = new THREE.ConeGeometry(2.4, 9, 40, 1, true); coneG.translate(0, -4.5, 0); coneG.rotateX(Math.PI / 2);
  const coneU = { uI: uniform(0), uTime: uniform(0) };
  const coneM = new W.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }); coneM.uniforms = coneU;
  { const vA = clamp(positionLocal.z.negate().div(9), 0, 1), edge = pow(abs(dot(normalView, positionViewDirection)), 2.5), fall = pow(vA.oneMinus(), 1.7).mul(smoothstep(0, .06, vA));
    const swirl = sin(positionLocal.z.mul(1.7).add(coneU.uTime.mul(.8)).add(sin(positionLocal.x.mul(3).add(coneU.uTime.mul(.5))).mul(1.5))).mul(.25).add(.75);
    coneM.colorNode = vec3(1, .93, .78).mul(coneU.uI).mul(edge).mul(fall).mul(swirl); }
  const cone = new THREE.Mesh(coneG, coneM); cone.position.set(.12, -.08, -.15); cone.frustumCulled = false; cone.renderOrder = 5; camera.add(cone);

  // 인스턴스 스프라이트 입자 묶음
  const sprites = (n, mat) => { const s = new THREE.Sprite(mat); s.count = n; s.frustumCulled = false; scene.add(s); return s; };
  const IA = (arr, k) => { const a = new THREE.InstancedBufferAttribute(arr, k); a.setUsage(THREE.DynamicDrawUsage); return a; };
  const round = (k = 0) => smoothstep(.5, k, length(uv().sub(.5)));

  // ── 먼지 입자 (손전등 안에서만 반짝임) ──
  const DN = 700, dpos = new Float32Array(DN * 3), dseed = new Float32Array(DN);
  for (let i = 0; i < DN; i++) { dpos[i * 3] = Math.random() * 10; dpos[i * 3 + 1] = Math.random() * 4; dpos[i * 3 + 2] = Math.random() * 10; dseed[i] = Math.random(); }
  const dU = { uCam: uniform(new THREE.Vector3()), uDir: uniform(new THREE.Vector3()), uTime: uniform(0), uI: uniform(0), uFloor: uniform(0) };
  const dustM = new W.PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: true }); dustM.uniforms = dU;
  { const p0 = instancedBufferAttribute(IA(dpos, 3)), sd = instancedBufferAttribute(IA(dseed, 1));
    const p1 = p0.add(vec3(sin(dU.uTime.mul(.13).add(sd.mul(40))).mul(.6), dU.uTime.mul(sd.mul(.04).add(.03)), cos(dU.uTime.mul(.11).add(sd.mul(30))).mul(.6)));
    const base = vec3(dU.uCam.x.sub(5), dU.uFloor, dU.uCam.z.sub(5)), p = base.add(mod(p1.sub(base), vec3(10, 4, 10)));
    const to = p.sub(dU.uCam), dist = length(to), inBeam = smoothstep(.86, .96, dot(to.div(max(dist, .001)), dU.uDir)).mul(smoothstep(9, 1, dist));
    dustM.positionNode = p; dustM.sizeNode = sd.mul(1.6).add(1).mul(.04);
    dustM.colorNode = vec3(1, .95, .85).mul(inBeam.mul(dU.uI).add(.04).mul(smoothstep(.8, 1.6, dist))).mul(round()); }
  const dust = sprites(DN, dustM);

  // ── 비 (게임에서 꺼 둔 효과 — 같은 API 를 위해 자리만) ──
  const rainG = { setDrawRange() {} }, rainM = { uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uA: { value: 0 } } }, rain = new THREE.Group(); rain.visible = false;

  // ── 벚꽃잎 (정문 근처) ──
  const PN = 500, ppos = new Float32Array(PN * 3), pseed = new Float32Array(PN);
  for (let i = 0; i < PN; i++) { ppos[i * 3] = Math.random() * 44 - 22; ppos[i * 3 + 1] = Math.random() * 9; ppos[i * 3 + 2] = Math.random() * 24 + 52; pseed[i] = Math.random(); }
  const pU = { uTime: uniform(0), uA: uniform(0) };
  const petM = new W.PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }); petM.uniforms = pU;
  { const p0 = instancedBufferAttribute(IA(ppos, 3)), sd = instancedBufferAttribute(IA(pseed, 1)), t = pU.uTime.mul(sd.mul(.2).add(.25));
    const x = mod(p0.x.add(sin(t.mul(2).add(sd.mul(30))).mul(1.2)).add(t.mul(.4)).add(22), 44).sub(22);
    petM.positionNode = vec3(x, mod(p0.y.sub(t.mul(1.4)), 9), p0.z.add(cos(t.mul(1.3).add(sd.mul(20))).mul(.8))); petM.sizeNode = float(.13);
    petM.colorNode = vec3(1, .72, .82).mul(sd.mul(.4).add(.6)).mul(pU.uA).mul(smoothstep(.5, .2, length(uv().sub(.5).mul(vec2(1, 1.8))))); }
  const petals = sprites(PN, petM);

  // ── 범용 입자: 먼지 폭발 · 그것의 연기 · 입김 ──
  const QN = 900, qpos = new Float32Array(QN * 3), qcol = new Float32Array(QN * 3), qa = new Float32Array(QN), qs = new Float32Array(QN);
  const qv = new Float32Array(QN * 3), ql = new Float32Array(QN), qm = new Float32Array(QN), qa0 = new Float32Array(QN), qg = new Float32Array(QN), qd = new Float32Array(QN), qgr = new Float32Array(QN);
  const qsd = new Float32Array(QN); for (let i = 0; i < QN; i++) qsd[i] = Math.random();
  const qA = { position: IA(qpos, 3), color: IA(qcol, 3), alpha: IA(qa, 1), size: IA(qs, 1) };
  const qM = new W.PointsNodeMaterial({ transparent: true, depthWrite: false, fog: false, sizeAttenuation: true });
  { const al = instancedBufferAttribute(qA.alpha), sd = instancedBufferAttribute(IA(qsd, 1)), q = uv().sub(.5).mul(4).add(sd.mul(17));
    const w = mx_noise_float(q).mul(.3).add(.5).mul(.6).add(mx_noise_float(q.mul(2.3)).mul(.15).add(.15)).add(mx_noise_float(q.mul(5.1)).mul(.05).add(.05));   // 뭉게뭉게한 가장자리
    qM.positionNode = instancedBufferAttribute(qA.position); qM.sizeNode = instancedBufferAttribute(qA.size).mul(.71).mul(step(.0001, al)); qM.rotationNode = sd.mul(6.283);
    qM.colorNode = instancedBufferAttribute(qA.color).mul(w.mul(.3).add(.85));
    qM.opacityNode = smoothstep(.5, .08, length(uv().sub(.5)).add(w.sub(.5).mul(.28))).mul(w.mul(.65).add(.55)).mul(al); }
  const qP = sprites(QN, qM); qP.renderOrder = 6;
  let qHead = 0;
  function emit(x, y, z, vx, vy, vz, life, col, a, size, grav = 0, drag = 0, grow = 0) {
    const i = qHead++ % QN; qpos.set([x, y, z], i * 3); qv.set([vx, vy, vz], i * 3); qcol.set(col, i * 3);
    ql[i] = qm[i] = life; qa0[i] = a; qs[i] = size; qg[i] = grav; qd[i] = drag; qgr[i] = grow; qa[i] = a;
  }
  const R = () => Math.random() - .5;
  function dustBurst(x, y, z, n = 60) { for (let k = 0; k < n; k++) { const c = .45 + Math.random() * .2; emit(x + R() * .5, y + R() * .3, z + R() * .5, R() * 2.4, Math.random() * 1.2 - .2, R() * 2.4, 1.5 + Math.random() * 2, [c, c * .93, c * .82], .35, .05 + Math.random() * .08, -.6, 1.6, .06); } }
  let smokeAcc = 0, breathAcc = 0;
  function ghostSmoke(p, dt, k = 1) {
    if (!p) return; smokeAcc += dt * 30 * k;
    while (smokeAcc > 1) { smokeAcc--; const c = .03 + Math.random() * .05; emit(p.x + R() * .5, p.y + Math.random() * 1.8, p.z + R() * .5, R() * .2, .25 + Math.random() * .3, R() * .2, 1.6 + Math.random(), [c, c * .8, c * .8], .5, .12 + Math.random() * .1, 0, .5, .12); }
  }
  const _bd = new THREE.Vector3();
  function breath(on, dt) {
    if (!on) return; breathAcc += dt; if (breathAcc < 1.7) return; breathAcc = 0;
    camera.getWorldDirection(_bd);
    for (let k = 0; k < 10; k++) emit(camera.position.x + _bd.x * .25 + R() * .05, camera.position.y - .12 + R() * .04, camera.position.z + _bd.z * .25 + R() * .05, _bd.x * .5 + R() * .2, .08 + R() * .1, _bd.z * .5 + R() * .2, 1.2 + Math.random() * .6, [.82, .85, .9], .16, .05, -.05, 1.4, .1);
  }

  // ── 전기 불꽃 ──
  const SN = 90, spos = new Float32Array(SN * 3), svel = new Float32Array(SN * 3), slife = new Float32Array(SN);
  const sA = { position: IA(spos, 3), life: IA(slife, 1) };
  const sparkM = new W.PointsNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: true });
  { const lf = instancedBufferAttribute(sA.life); sparkM.positionNode = instancedBufferAttribute(sA.position); sparkM.sizeNode = lf.mul(5).add(3).mul(.13).mul(step(.0001, lf)); sparkM.colorNode = vec3(1, .75, .35).mul(3).mul(lf).mul(round()); }
  const sparks = sprites(SN, sparkM);
  let sparkHead = 0;
  function spark(x, y, z, n = 26) { for (let k = 0; k < n; k++) { const i = sparkHead++ % SN; spos.set([x, y, z], i * 3); svel.set([(Math.random() - .5) * 3, Math.random() * 1.5 - .3, (Math.random() - .5) * 3], i * 3); slife[i] = .6 + Math.random() * .6; } }

  let flashT = 0, glitchT = 0;
  function setOpts(o) { Object.assign(opt, o); U.uBloom.value = mode === 'high' && opt.bloom ? 1 : 0; U.uGrain.value = opt.grain ? .016 : 0; }
  function lightning() { flashT = 1; }
  function glitch(s = .6) { glitchT = Math.max(glitchT, Math.min(.12, s) * opt.glitch); }
  function setQuality(q) { mode = q; U.uBloom.value = q === 'high' && opt.bloom ? 1 : 0; dust.visible = q !== 'low'; }
  function resize() {}
  const _dir = new THREE.Vector3();
  function render(dt, c) {
    U.uTime.value += dt; U.uFear.value = c.fear; U.uHurt.value = c.hurt || 0;
    glitchT = Math.max(0, glitchT - dt); U.uGlitch.value = Math.min(1, glitchT + (c.fear > .9 ? (c.fear - .9) * 1.5 * opt.glitch : 0));
    flashT = Math.max(0, flashT - dt * 3.2);
    U.uFlash.value = flashT > 0 ? (Math.sin(flashT * 40) > 0 ? flashT : flashT * .3) * (c.outdoors ? .9 : .25) * opt.flash : 0;
    renderer.getSize(size); U.uRes.value.set(size.x, size.y);
    coneU.uTime.value += dt; coneU.uI.value = c.flash * (c.outdoors ? .05 : .11); cone.visible = c.flash > .01;
    camera.getWorldDirection(_dir);
    dU.uTime.value += dt; dU.uCam.value.copy(camera.position); dU.uDir.value.copy(_dir); dU.uI.value = c.flash * .9; dU.uFloor.value = c.floorY;
    dust.visible = mode !== 'low' && !c.outdoors;
    pU.uTime.value += dt; pU.uA.value += (((c.outdoors && camera.position.z > 35 && camera.position.y < 20) ? .55 : 0) - pU.uA.value) * Math.min(1, dt * 2); petals.visible = pU.uA.value > .01;
    let any = false;
    for (let i = 0; i < SN; i++) if (slife[i] > 0) {
      any = true; slife[i] = Math.max(0, slife[i] - dt * 1.4); svel[i * 3 + 1] -= 9.8 * dt;
      spos[i * 3] += svel[i * 3] * dt; spos[i * 3 + 1] += svel[i * 3 + 1] * dt; spos[i * 3 + 2] += svel[i * 3 + 2] * dt;
      if (spos[i * 3 + 1] < c.floorY + .02) { spos[i * 3 + 1] = c.floorY + .02; svel[i * 3 + 1] *= -.3; svel[i * 3] *= .5; svel[i * 3 + 2] *= .5; }
    }
    if (any) { sA.position.needsUpdate = true; sA.life.needsUpdate = true; }
    sparks.visible = any;
    let qAny = false;
    for (let i = 0; i < QN; i++) if (ql[i] > 0) {
      qAny = true; ql[i] -= dt; const k = Math.max(0, ql[i] / qm[i]);
      const dr = Math.exp(-qd[i] * dt); qv[i * 3] *= dr; qv[i * 3 + 1] = qv[i * 3 + 1] * dr - qg[i] * dt; qv[i * 3 + 2] *= dr;
      qpos[i * 3] += qv[i * 3] * dt; qpos[i * 3 + 1] += qv[i * 3 + 1] * dt; qpos[i * 3 + 2] += qv[i * 3 + 2] * dt;
      qa[i] = ql[i] > 0 ? qa0[i] * Math.min(1, k * 2.5) * Math.min(1, (1 - k) * 8 + .2) : 0; qs[i] += qgr[i] * dt;
    }
    if (qAny) for (const a of Object.values(qA)) a.needsUpdate = true;
    qP.visible = qAny;
    if (mode === 'low') renderer.render(scene, camera); else pipe.render();
  }
  return { render, setQuality, setOpts, resize, dust: dustBurst, ghostSmoke, breath, emit, lightning, glitch, spark, composer: null, cone, pipeline: pipe, final, rain, rainG, rainM };
}
