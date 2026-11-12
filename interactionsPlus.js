// 생활 상호작용 보강 (2008 공립 고교 본관 · 별관): 기존 'look' 조사 시스템(world.props · E 키 · 프롬프트)을 그대로 쓴다.
//   교실: 분리수거함 들여다보기 · 청소함 열어 보기 · 창밖 내다보기 · 커튼 치기/걷기 · 뒤쪽 학급 게시판 자세히 읽기
//   교무실: 수동 차임(수업 종) 울리기 — 벽걸이 차임 스위치함
//   방송실 조정실: 카세트 데크에 꽂힌 테이프 틀기 (「학교종」 반주 — 늘어진 카세트 소리)
//   새 건물 실사 모델: 정수기 물 마시기 · 벽시계 보기 · 소화기 · 화분
// 메시는 처음 쓸 때만 만든다(커튼) — 평소 그리기 비용은 차임 스위치함 하나뿐. 전등 스위치는 전기팀 담당이라 손대지 않는다.
export function installInteractionsPlus({ THREE, scene, world, RBG, sfx, showNote, P }) {
  if (!RBG || !RBG.BLD || installInteractionsPlus.done) return 0; installInteractionsPlus.done = true;
  const pk = a => a[Math.floor(Math.random() * a.length)];
  let n = 0;
  const add = (b, lx, lz, y0, h, label, fn, r = 1.3) => { const [x, z] = b.toWorld(lx, lz); world.props.push({ kind: 'look', floor: 0, rbY: y0, x, z, y: y0 + h, r, label, fn, n: 0, _rb: true, plus: true }); n++; };
  for (const b of RBG.BLD) {
    if (!b.props || !b.spec) continue; const FH = b.spec.FH || 3.6;
    const rooms = b.props.filter(p => p.kind === 'room' && p.label);
    for (const r of rooms) {
      const y0 = r.floor * FH, { x1, x2, z1, z2 } = r;
      if (r.type === 'class') {
        // 청소함 (교단 옆 창가 구석, 문은 교실 쪽 +x)
        add(b, x1 + .75, z2 - .62, y0, 1.0, '청소함 열어 보기', p => { sfx.locker(); return p.n++ % 2 ? '자루 끝이 닳은 대걸레 두 자루, 물기 마른 양동이. 문 안쪽에 청소 당번표가 붙어 있다 — 10월 12일 칸은 비어 있다.' : '빗자루 · 쓰레받기 · 걸레 · 분무기. 철문 안쪽에 매직으로 쓴 낙서 — “하늘이 청소 땡땡이 ㅋ”'; });
        // 창밖 (가운데 분단 창가 통로) — 운동장 쪽으로 몸을 돌려 바깥을 본다
        add(b, x2 - 2.0, z2 - .55, y0, 1.4, '창밖 내다보기', () => { const [ax, az] = b.toWorld(x2 - 2.0, z2 - .55), [bx, bz] = b.toWorld(x2 - 2.0, z2 + 5); P.yaw = Math.atan2(-(bx - ax), -(bz - az)); P.pitch = -.08; sfx.click();
          return pk(['운동장 저편 가로등 하나만 깜빡인다. 철봉 아래 누군가 서 있는 것 같다가… 없다.', '빗물 자국 너머로 교문이 보인다. 굳게 잠겨 있다.', '창틀에 먼지가 소복하다. 손가락 자국이 하나 — 안쪽에서 바깥으로 그은 줄.', '밤안개 속에서 별관 4층 창문 하나만 희미하게 밝다.']); });
        // 커튼 치기/걷기 (창 전체를 가리는 커튼 한 장 — 처음 칠 때 만든다)
        { let cur = null; add(b, (x1 + x2) / 2, z2 - .55, y0, 1.6, '커튼 치기', p => { sfx.slide();
          if (!cur) { const w = x2 - x1 - .9, g = new THREE.PlaneGeometry(w, 1.5, 24, 1), pos = g.attributes.position; for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 9) * .025);   // 주름
            g.computeVertexNormals(); cur = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x8a9a78, roughness: .95, side: THREE.DoubleSide })); const [cx, cz] = b.toWorld((x1 + x2) / 2 + .1, z2 - .16); cur.position.set(cx, y0 + 1.72, cz); cur.name = 'PLUS_curtain'; cur.userData.rbKeep = true; scene.add(cur); cur.visible = false; }
          cur.visible = !cur.visible; p.label = cur.visible ? '커튼 걷기' : '커튼 치기';
          return cur.visible ? '레일이 드르륵 울리며 커튼이 닫혔다. 바깥 불빛이 가려지자 교실이 더 어두워졌다.' : '커튼을 걷었다. 창 너머로 운동장이 보인다.'; }, 1.4); }
        // 뒤쪽 학급 게시판 (급식 식단표 · 청소 당번표 · 수능 D-day)
        add(b, x2 - .75, z1 + 2.4, y0, 1.7, '학급 게시판 자세히 보기', () => { sfx.paper(); showNote({ title: `${r.label} 학급 게시판`, text: '<b>[10월 급식 식단표]</b><br>6(월) 쌀밥 · 된장국 · 불고기 / 7(화) 잡곡밥 · 김치찌개 · 계란말이 / 8(수) 카레라이스 · 깍두기 · 요구르트<br><br><b>[청소 당번표]</b><br>교실 바닥 1~6번 · 칠판 7~9번 · 복도 · 창틀 10~15번 · 화장실 16~20번 · 분리수거 21~24번<br>※ 매주 월요일 교대 · 대걸레는 빨아서 널 것<br><br><b>[2009학년도 수능 D-34]</b><br>2008. 11. 13 (목) — 지금 자면 꿈을 꾸지만, 지금 공부하면 꿈을 이룬다' }); return ''; }, 1.5);
      }
      if (r.type === 'office' || /^교무실/.test(r.label)) {
        // 수동 차임(수업 종) 스위치함: 복도 쪽 벽 · 캐비닛(서쪽) 옆 — 회색 철함 · 빨간 누름단추 · 「수업 종」 라벨
        const lx = x1 + .9, lz = z1 + .02, [wx, wz] = b.toWorld(lx, lz), grp = new THREE.Group(); grp.position.set(wx, y0 + 1.45, wz); grp.name = 'PLUS_chime'; grp.userData.rbKeep = true;
        const boxM = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: .5, metalness: .4 }), red = new THREE.MeshStandardMaterial({ color: 0xc02020, roughness: .4 });
        const bx = new THREE.Mesh(new THREE.BoxGeometry(.22, .3, .06), boxM); bx.position.z = .03; grp.add(bx);
        const bt = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .025, 14), red); bt.rotation.x = Math.PI / 2; bt.position.set(0, -.04, .07); grp.add(bt);
        const c = document.createElement('canvas'); c.width = 128; c.height = 48; const q = c.getContext('2d'); q.fillStyle = '#f4f0e2'; q.fillRect(0, 0, 128, 48); q.fillStyle = '#222'; q.font = 'bold 26px sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('수업 종', 64, 25);
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const lb = new THREE.Mesh(new THREE.PlaneGeometry(.16, .06), new THREE.MeshStandardMaterial({ map: t, roughness: .7 })); lb.position.set(0, .08, .061); grp.add(lb);
        scene.add(grp);
        add(b, lx, lz + .7, y0, 1.45, '수업 종 울리기 (차임 스위치)', p => { if (p.cd && performance.now() - p.cd < 8000) return '스위치가 아직 뜨겁다. 조금 있다가.'; p.cd = performance.now(); sfx.classBell(); P.fear = Math.min(1, (P.fear || 0) + .05);
          return p.n++ ? '빈 학교에 종소리가 퍼진다. 아무도 일어서지 않는다.' : '딩동댕동— 텅 빈 복도마다 수업 종이 울려 퍼졌다. 어딘가에서 의자 끄는 소리가 따라 났다.'; }, 1.2);
      }
    }
    // 교실 분리수거함 (mainBuilding classBins 가 남긴 자리)
    for (const q of b.props.filter(p => p.kind === 'binLook')) add(b, q.x, q.z, q.y - .8, .8, '분리수거함 들여다보기', p => { sfx.clank(.4); return pk(['구겨진 방송 원고 한 장 — “모두, 집으로 돌아가세요.”', '찢어진 기사 스크랩. “서화고 ‘단순 실종’…”', '빈 우유팩과 매점 빵 봉지뿐이다.', '종이류 칸에 가정통신문 다발 — “10월 12일 야간 자율학습 없음”.']); }, 1.3);
    // 방송실 조정실 카세트 데크 (콘솔 북쪽 끝 · 근접 모니터 옆): 「학교종」 반주 테이프
    const bc = rooms.find(r => r.type === 'bcast');
    if (bc) { const XP = bc.x1 + 9, y0 = bc.floor * FH; add(b, XP - 2.25, bc.z1 + 6.95, y0, .95, '카세트 데크 재생', p => { if (p.playing) return '테이프가 돌아가고 있다.'; p.playing = true; sfx.tape(); playTape(() => { p.playing = false; });
      return p.n++ ? '늘어진 반주가 다시 흐른다.' : '덜컥 — 데크에 꽂혀 있던 테이프가 돌기 시작한다. 늘어진 「학교종」 반주… 라벨: “기념 방송 리허설 98.10.12”'; }, 1.2); }
    // 새 건물 실사 모델: 정수기 · 벽시계
    for (const m of b.models || []) {
      const y0 = Math.floor(((m.y || 0) + .2) / FH) * FH;
      if (/sf_water_cooler/.test(m.name)) add(b, m.x, m.z, y0, 1.0, '정수기에서 물 마시기', p => { sfx.sip ? sfx.sip() : sfx.drip(); P.stamina = 100; P.tired = false; P.fear = Math.max(0, (P.fear || 0) - .06); return p.n++ ? '종이컵에 미지근한 물이 반쯤 찬다.' : '종이컵을 뽑아 물을 받았다. 생수통에서 꾸르륵 거품이 올라온다. (스태미나 회복)'; }, 1.4);
    }
  }
  // 카세트 테이프 반주 (Web Audio — 늘어진 사각파 + 와우 · 히스). 「학교종」 첫 두 소절
  function playTape(done) {
    let ac; try { ac = playTape.ac ||= new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { done(); return; }
    const notes = [67, 67, 69, 69, 67, 67, 64, 0, 67, 67, 64, 64, 62, 0, 0, 0, 67, 67, 69, 69, 67, 67, 64, 0, 67, 64, 62, 64, 60], dt = .42, t0 = ac.currentTime + .35, out = ac.createGain(); out.gain.value = .07;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; out.connect(lp); lp.connect(ac.destination);
    const wow = ac.createOscillator(), wg = ac.createGain(); wow.frequency.value = .7; wg.gain.value = 6; wow.connect(wg); wow.start(t0); wow.stop(t0 + notes.length * dt + .5);
    notes.forEach((m, i) => { if (!m) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = 440 * Math.pow(2, (m - 69) / 12) * .985; wg.connect(o.detune); const t = t0 + i * dt;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + .02); g.gain.exponentialRampToValueAtTime(.01, t + dt * .95); o.connect(g); g.connect(out); o.start(t); o.stop(t + dt); });
    const len = notes.length * dt + .4, nb = ac.createBuffer(1, Math.ceil(ac.sampleRate * len), ac.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * .05;
    const ns = ac.createBufferSource(); ns.buffer = nb; ns.connect(out); ns.start(t0 - .3);
    setTimeout(() => { try { sfx.tape(); } catch (e) {} done(); }, (len + .4) * 1000);
  }
  return n;
}
