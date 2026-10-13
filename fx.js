// 렌더링 효과: 후처리(블룸·색보정·그레인·비네팅·색수차·글리치), 손전등 광선, 먼지, 비, 번개, 전기 불꽃
import * as THREE from './vendor/three.module.js';
import { EffectComposer } from './vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/addons/postprocessing/RenderPass.js';
import { ShaderPass } from './vendor/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from './vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './vendor/addons/postprocessing/OutputPass.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uFear: { value: 0 }, uGlitch: { value: 0 },
    uGrain: { value: .035 }, uRes: { value: new THREE.Vector2(1, 1) }, uFlash: { value: 0 }, uHurt: { value: 0 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uFear, uGlitch, uGrain, uFlash, uHurt; uniform vec2 uRes; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      // 화면 글리치: 가로 띠가 순간적으로 밀린다
      if (uGlitch > 0.0) {
        float band = floor(uv.y * 24.0 + floor(uTime * 18.0) * 7.0);
        float r = h(vec2(band, floor(uTime * 22.0)));
        if (r < uGlitch * .55) uv.x += (h(vec2(band, uTime)) - .5) * .08 * uGlitch;
      }
      vec2 c = uv - .5; float d = length(c);
      // 렌즈 왜곡 + 색수차
      uv += c * d * d * (.035 + uFear * .05);
      float ca = .0012 + uFear * .006 + uGlitch * .012;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * ca).b;
      // 색보정: 어두운 곳은 청록, 밝은 곳은 따뜻하게, 채도 약간 낮춤
      float l = dot(col, vec3(.2126, .7152, .0722));
      col = mix(col, vec3(l), .18 + uFear * .25);
      col *= mix(vec3(.86, .98, 1.08), vec3(1.07, 1.0, .9), smoothstep(.02, .5, l));
      col = max(col - .004, 0.0) * 1.02;
      // 비네팅 (공포가 오르면 붉게, 좁게)
      float v = smoothstep(.85, .25 - uFear * .1, d);
      col *= mix(.35, 1.0, v);
      col = mix(col, col * vec3(1.35, .45, .4), (1.0 - v) * (uFear * .8 + uHurt));
      // 번개 섬광
      col += uFlash * vec3(.55, .62, .8) * (.5 + .5 * v);
      // 필름 그레인 (어두운 곳에 더 강하게) + 약한 주사선
      float g = h(uv * uRes + fract(uTime * 37.0) * 91.0) - .5;
      col += g * uGrain * (1.2 - smoothstep(0.0, .6, l)) * (1.0 + uFear * 1.5 + uGlitch * 3.0);
      col *= 1.0 - .035 * (uGlitch + uFear * .4) * step(.5, fract(gl_FragCoord.y * .5));
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function createFX(renderer, scene, camera) {
  const size = new THREE.Vector2(); renderer.getSize(size);
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), .55, .45, .82);
  const final = new ShaderPass(FinalShader);
  const output = new OutputPass();
  composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(final); composer.addPass(output);
  let mode = 'high';

  /* ----- 손전등 광선 (볼류메트릭 느낌의 원뿔) ----- */
  const coneG = new THREE.ConeGeometry(2.4, 9, 40, 1, true); coneG.translate(0, -4.5, 0); coneG.rotateX(Math.PI / 2);
  const coneM = new THREE.ShaderMaterial({
    uniforms: { uI: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying float vA; varying vec3 vN, vV, vP;
      void main(){ vA = clamp(-position.z / 9.0, 0.0, 1.0); vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uI, uTime; varying float vA; varying vec3 vN, vV, vP;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9, 78.2, 37.7))) * 43758.5); }
      void main(){
        float edge = pow(abs(dot(vN, vV)), 2.5);
        float fall = pow(1.0 - vA, 1.7) * smoothstep(0.0, .06, vA);
        float swirl = .75 + .25 * sin(vP.z * 1.7 + uTime * .8 + sin(vP.x * 3.0 + uTime * .5) * 1.5);
        gl_FragColor = vec4(vec3(1.0, .93, .78) * uI * edge * fall * swirl, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  });
  const cone = new THREE.Mesh(coneG, coneM); cone.position.set(.12, -.08, -.15); cone.frustumCulled = false; cone.renderOrder = 5;
  camera.add(cone);

  /* ----- 먼지 입자 (손전등 안에서만 반짝임) ----- */
  const DN = 700, dpos = new Float32Array(DN * 3), dseed = new Float32Array(DN);
  for (let i = 0; i < DN; i++) { dpos[i * 3] = Math.random() * 10; dpos[i * 3 + 1] = Math.random() * 4; dpos[i * 3 + 2] = Math.random() * 10; dseed[i] = Math.random(); }
  const dustG = new THREE.BufferGeometry(); dustG.setAttribute('position', new THREE.BufferAttribute(dpos, 3)); dustG.setAttribute('seed', new THREE.BufferAttribute(dseed, 1));
  const dustM = new THREE.ShaderMaterial({
    uniforms: { uCam: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3() }, uTime: { value: 0 }, uI: { value: 0 }, uFloor: { value: 0 } },
    vertexShader: `attribute float seed; uniform vec3 uCam, uDir; uniform float uTime, uI, uFloor; varying float vB;
      void main(){
        vec3 p = position + vec3(sin(uTime * .13 + seed * 40.0) * .6, uTime * (.03 + seed * .04), cos(uTime * .11 + seed * 30.0) * .6);
        vec3 base = uCam - vec3(5.0, 0.0, 5.0); base.y = uFloor;
        p = base + mod(p - base, vec3(10.0, 4.0, 10.0));
        vec3 to = p - uCam; float dist = length(to);
        float inBeam = smoothstep(.86, .96, dot(to / max(dist, .001), uDir)) * smoothstep(9.0, 1.0, dist);
        vB = (.04 + inBeam * uI) * smoothstep(.8, 1.6, dist);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp((1.0 + seed * 1.6) * (18.0 / -mv.z), 1.0, 4.0);
      }`,
    fragmentShader: `varying float vB; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(1.0, .95, .85) * vB * smoothstep(.5, 0.0, d), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const dust = new THREE.Points(dustG, dustM); dust.frustumCulled = false; scene.add(dust);

  /* ----- 비 ----- */
  const RN = 2600, rpos = new Float32Array(RN * 6);
  for (let i = 0; i < RN; i++) { const x = Math.random() * 50, y = Math.random() * 22, z = Math.random() * 50; rpos.set([x, y, z, x + .04, y + .55, z + .02], i * 6); }
  const rainG = new THREE.BufferGeometry(); rainG.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
  const rainM = new THREE.ShaderMaterial({
    uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uA: { value: 0 } },
    vertexShader: `uniform vec3 uCam; uniform float uTime; varying float vA;
      void main(){ vec3 p = position; p.y -= uTime * 14.0; p.x -= uTime * .6;
        vec3 base = uCam - vec3(25.0, 6.0, 25.0); p = base + mod(p - base, vec3(50.0, 22.0, 50.0));
        vA = smoothstep(26.0, 4.0, length(p.xz - uCam.xz));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: 'uniform float uA; varying float vA; void main(){ gl_FragColor = vec4(vec3(.62, .7, .82) * uA * vA, 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const rain = new THREE.LineSegments(rainG, rainM); rain.frustumCulled = false; scene.add(rain);

  /* ----- 벚꽃잎 (정문 근처) ----- */
  const PN = 500, ppos = new Float32Array(PN * 3), pseed = new Float32Array(PN);
  for (let i = 0; i < PN; i++) { ppos[i * 3] = Math.random() * 44 - 22; ppos[i * 3 + 1] = Math.random() * 9; ppos[i * 3 + 2] = Math.random() * 24 + 52; pseed[i] = Math.random(); }
  const petG = new THREE.BufferGeometry(); petG.setAttribute('position', new THREE.BufferAttribute(ppos, 3)); petG.setAttribute('seed', new THREE.BufferAttribute(pseed, 1));
  const petM = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: 0 } },
    vertexShader: `attribute float seed; uniform float uTime; varying float vS;
      void main(){ vec3 p = position; float t = uTime * (.25 + seed * .2);
        p.y = mod(p.y - t * 1.4, 9.0); p.x += sin(t * 2.0 + seed * 30.0) * 1.2 + t * .4; p.z += cos(t * 1.3 + seed * 20.0) * .8;
        p.x = mod(p.x + 22.0, 44.0) - 22.0; vS = seed;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = clamp(60.0 / -mv.z, 1.0, 6.0); }`,
    fragmentShader: `uniform float uA; varying float vS; void main(){ vec2 c = gl_PointCoord - .5; float d = length(c * vec2(1.0, 1.8)); gl_FragColor = vec4(vec3(1.0, .72, .82) * (.6 + vS * .4) * uA * smoothstep(.5, .2, d), 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const petals = new THREE.Points(petG, petM); petals.frustumCulled = false; scene.add(petals);

  /* ----- 전기 불꽃 ----- */
  const SN = 90, spos = new Float32Array(SN * 3), svel = new Float32Array(SN * 3), slife = new Float32Array(SN);
  const sparkG = new THREE.BufferGeometry(); sparkG.setAttribute('position', new THREE.BufferAttribute(spos, 3)); sparkG.setAttribute('life', new THREE.BufferAttribute(slife, 1));
  const sparkM = new THREE.ShaderMaterial({
    vertexShader: 'attribute float life; varying float vL; void main(){ vL = life; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = life > 0.0 ? (3.0 + life * 5.0) * (60.0 / -mv.z) : 0.0; }',
    fragmentShader: 'varying float vL; void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(1.0, .75, .35) * 3.0 * vL * smoothstep(.5, 0.0, d), 1.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const sparks = new THREE.Points(sparkG, sparkM); sparks.frustumCulled = false; scene.add(sparks);
  let sparkHead = 0;
  function spark(x, y, z, n = 26) {
    for (let k = 0; k < n; k++) {
      const i = sparkHead++ % SN; spos.set([x, y, z], i * 3);
      svel.set([(Math.random() - .5) * 3, Math.random() * 1.5 - .3, (Math.random() - .5) * 3], i * 3); slife[i] = .6 + Math.random() * .6;
    }
  }

  let flashT = 0, glitchT = 0;
  const opt = { bloom: true, grain: true, glitch: 1, flash: 1 };   // 설정 · 접근성
  function setOpts(o) { Object.assign(opt, o); bloom.enabled = mode === 'high' && opt.bloom; final.uniforms.uGrain.value = opt.grain ? .035 : 0; }
  function lightning() { flashT = 1; }
  function glitch(s = .6) { glitchT = Math.max(glitchT, s * opt.glitch); }
  function setQuality(q) { mode = q; bloom.enabled = q === 'high' && opt.bloom; dust.visible = q !== 'low'; }
  function resize(w, h, pr) { composer.setPixelRatio(pr); composer.setSize(w, h); bloom.setSize(w / 2, h / 2); }

  const _dir = new THREE.Vector3();
  function render(dt, c) {
    const u = final.uniforms;
    u.uTime.value += dt; u.uFear.value = c.fear; u.uHurt.value = c.hurt || 0;
    glitchT = Math.max(0, glitchT - dt); u.uGlitch.value = Math.min(1, glitchT + (c.fear > .75 ? (c.fear - .75) * 1.2 * opt.glitch : 0));
    flashT = Math.max(0, flashT - dt * 3.2);
    u.uFlash.value = flashT > 0 ? (Math.sin(flashT * 40) > 0 ? flashT : flashT * .3) * (c.outdoors ? .9 : .25) * opt.flash : 0;
    renderer.getSize(size); u.uRes.value.set(size.x, size.y);
    // 손전등 광선 & 먼지
    coneM.uniforms.uTime.value += dt;
    coneM.uniforms.uI.value = c.flash * (c.outdoors ? .05 : .11);
    cone.visible = c.flash > .01;
    camera.getWorldDirection(_dir);
    dustM.uniforms.uTime.value += dt; dustM.uniforms.uCam.value.copy(camera.position); dustM.uniforms.uDir.value.copy(_dir);
    dustM.uniforms.uI.value = c.flash * .9; dustM.uniforms.uFloor.value = c.floorY;
    dust.visible = mode !== 'low' && !c.outdoors;
    // 비
    rainM.uniforms.uTime.value += dt; rainM.uniforms.uCam.value.copy(camera.position);
    rainM.uniforms.uA.value += ((c.outdoors ? .32 : 0) - rainM.uniforms.uA.value) * Math.min(1, dt * 3);
    rain.visible = rainM.uniforms.uA.value > .01;
    petM.uniforms.uTime.value += dt; petM.uniforms.uA.value += (((c.outdoors && camera.position.z > 35 && camera.position.y < 20) ? .55 : 0) - petM.uniforms.uA.value) * Math.min(1, dt * 2); petals.visible = petM.uniforms.uA.value > .01;
    // 불꽃
    let any = false;
    for (let i = 0; i < SN; i++) if (slife[i] > 0) {
      any = true; slife[i] -= dt * 1.4; svel[i * 3 + 1] -= 9.8 * dt;
      spos[i * 3] += svel[i * 3] * dt; spos[i * 3 + 1] += svel[i * 3 + 1] * dt; spos[i * 3 + 2] += svel[i * 3 + 2] * dt;
      if (spos[i * 3 + 1] < c.floorY + .02) { spos[i * 3 + 1] = c.floorY + .02; svel[i * 3 + 1] *= -.3; svel[i * 3] *= .5; svel[i * 3 + 2] *= .5; }
    }
    if (any) { sparkG.attributes.position.needsUpdate = true; sparkG.attributes.life.needsUpdate = true; }
    sparks.visible = any;
    if (mode === 'low') renderer.render(scene, camera); else composer.render(dt);
  }
  return { render, setQuality, setOpts, resize, lightning, glitch, spark, composer, cone };
}
