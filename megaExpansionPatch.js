// 사용자 제공 「메가 익스팬션 & 엔진 최적화」 패치 — 클래스 원문 그대로 (모듈로 감싸기만 함). 게임 연결: game.js §17
import * as THREE from './vendor/three.module.js';
/**
 * ============================================================================
 * 〈폐교: 잊혀진 시간〉 대규모 공간 확장 · 60FPS 성능 안정화 · 광대한 스토리 · 미니게임 · 수집품 패치
 * - 1) 청크 컬링(Zone Frustum/Distance Culling) & 동적 라이트 풀링(Light Pool)으로 렉 완벽 제거
 * - 2) 캠퍼스 대규모 확장 구역(대강당/체육관, 중앙 중정, 지하 보존서고) 생성기
 * - 3) 4막 스토리 매니저 & 3대 수집품(명찰 12종, 카세트테이프 6종, 비망록 8종) 도감 UI
 * - 4) 실시간 인터랙티브 미니게임 3종 (전압 타이밍, 주파수 동조, 다이얼 해정)
 * ============================================================================
 */
class MegaSchoolExpansionAndOptimizer {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.audioCtx = null;

    // 1. 성능 안정화(Optimization) 레지스트리
    this.optimConfig = {
      cullDistance: 34.0,       // 34m 밖의 방 내부 프롭은 렌더링 자동 일시 중지
      floorHeightTolerance: 2.6, // 다른 층의 세부 가구는 즉시 컬링
      maxActivePointLights: 4,  // 동시에 켜질 수 있는 최대 PointLight 개수 (스터터링 방지)
      cullCheckInterval: 0.25,  // 0.25초마다 청크 가시성 갱신 (CPU 연산 절약)
      cullTimer: 0
    };
    this.registeredChunks = []; // { id, group, centerPos, radius, floorY }
    this.managedLights = [];    // { light, baseIntensity, worldPos }
    this.sharedCache = { geometries: new Map(), materials: new Map(), textures: new Map() };

    // 2. 광대한 스토리(4막) 및 수집품(Collectibles) 상태
    this.storyState = {
      currentAct: 1,
      actTitles: {
        1: "제1막: 고립된 자정 (본관의 흔적)",
        2: "제2막: 금지된 실험 (별관 연결통로 돌파)",
        3: "제3막: 심연의 수조 (지하 시설과 봉인)",
        4: "제4막: 1998년의 새벽 (최후의 탈출)"
      },
      nametags: new Set(),  // 수집한 학생 명찰 (최대 12개)
      tapes: new Set(),     // 수집한 카세트테이프 (최대 6개)
      documents: new Set(), // 수집한 비망록 일지 (최대 8개)
      totalNametags: 12,
      totalTapes: 6,
      totalDocs: 8
    };

    // 수집품 상세 로어(Lore) 데이터
    this.LORE_DB = {
      nametags: [
        { id: "tag_01", name: "2-3 김서윤", zone: "본관 1층 상담실", desc: "뒷면에 '선생님이 지하실로 내려오라고 했다'고 적혀 있다." },
        { id: "tag_02", name: "2-1 박지호", zone: "본관 지하 펌프실", desc: "배수구 철망 사이에 끼어 있던 진흙 묻은 명찰." },
        { id: "tag_03", name: "1-4 최유진", zone: "별관 3층 음악실", desc: "그랜드 피아노 건반 아래에 숨겨져 있던 명찰." },
        { id: "tag_04", name: "3-2 한도윤", zone: "별관 2층 과학준비실", desc: "시약에 부식되어 이름이 반쯤 지워져 있다." },
        { id: "tag_05", name: "2-2 이수아", zone: "별관 2층 동아리실", desc: "암실 인화 수조 안에서 건져낸 붉은 명찰." },
        { id: "tag_06", name: "3-1 정민재", zone: "본관 1층 보건실", desc: "커튼 친 침대 매트리스 밑에 끼워져 있었다." },
        { id: "tag_07", name: "1-2 강하은", zone: "별관 1층 요리실(101)", desc: "차갑게 식은 오븐 안에서 발견된 명찰." },
        { id: "tag_08", name: "2-4 윤성현", zone: "본관 3층 학생회실", desc: "학생회 투표함 바닥에 들어 있던 명찰." },
        { id: "tag_09", name: "3-3 조예린", zone: "별관 3층 전시공간", desc: "유리 쇼케이스 안에 전시품처럼 놓여 있었다." },
        { id: "tag_10", name: "1-1 신동혁", zone: "지하 수영장 탈의실", desc: "젖은 사물함 바닥에 붙어 있던 명찰." },
        { id: "tag_11", name: "2-3 오채원", zone: "대강당 무대 뒤", desc: "무대 조명 콘솔 옆에 놓여 있던 명찰." },
        { id: "tag_12", name: "3-4 배준서", zone: "옥상 물탱크 옆", desc: "옥상 철망에 걸려 바람에 흔들리던 마지막 명찰." }
      ],
      tapes: [
        { id: "tape_01", title: "테이프 #1: 상담교사의 독백", transcript: "“아이들이 하나둘씩 밤만 되면 눈이 풀린 채 지하 보일러실 쪽으로 걸어 내려갑니다... 교장 선생님은 단순한 집단 스트레스라고만 하시는데...”" },
        { id: "tape_02", title: "테이프 #2: 야간 경비원의 순찰 기록", transcript: "“23시 40분... 시계 바늘이 멈췄다. 본관과 별관 연결통로 방화문을 잠가라. 그것은 빛과 큰 공명음을 싫어한다.”" },
        { id: "tape_03", title: "테이프 #3: 과학준비실 실험 일지", transcript: "“지하 수영장 아래 수맥에서 검출된 파장이 사람들의 공포를 먹고 자란다. 주파수 98.4MHz에서 그것의 위치가 드러난다.”" },
        { id: "tape_04", title: "테이프 #4: 방송부 최후의 송출", transcript: "“누구라도 이 테이프를 듣는다면 옥상 안테나로 올라가세요. 학교 안에서는 전파가 전부 차단되어 있어요... 제발...”" },
        { id: "tape_05", title: "테이프 #5: 교장실 비밀 녹취록", transcript: "“교장실 괘종시계를 자정에 맞추면 서고로 통하는 금고가 열린다. 열쇠 조각 5개 없이는 정문 자물쇠를 절대 열 수 없을 것이다.”" },
        { id: "tape_06", title: "테이프 #6: 서연이 남긴 첫 번째 루프의 기억", transcript: "“어...? 이건 내 목소리잖아? 내가 이미 이 학교에 왔었다고...? 명찰 12개를 모두 모아야만 이 밤이 끝나...”" }
      ]
    };

    // 3. 미니게임 상태
    this.minigame = {
      active: false,
      type: null,
      cursorPos: 0,
      cursorDir: 1,
      stage: 0,
      freqValue: 92.0,
      targetFreq: 98.4,
      onSuccess: null
    };

    this.interactables = [];
  }

  /* =========================================================
     1. 초기화 및 기존 렌더러/씬 성능 최적화 패치 적용
     ========================================================= */
  init({ scene, camera, renderer, audioCtx } = {}) {
    this.scene = scene || window.scene;
    this.camera = camera || window.camera;
    this.renderer = renderer || window.renderer;
    this.audioCtx = audioCtx || window.audioCtx;

    this._applyRendererPerformanceTuning();
    this._scanAndPoolExistingLights();
    this._injectMegaUI();
    this._bindMegaHotkeys();

    console.log("[MegaExpansion] 대규모 공간 확장 · 60FPS 최적화 · 스토리/미니게임 엔진 가동 완료");
  }

  // WebGL 렌더러 해상도 및 섀도우맵 최적화로 저사양/고해상도 모니터 프레임 드랍 방지
  _applyRendererPerformanceTuning() {
    if (!this.renderer) return;
    // 픽셀 비율을 최대 1.5로 제한해 4K/레티나 화면에서 프레임이 반토막 나는 현상 방지
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    if (this.renderer.shadowMap) {
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  // 씬 내의 모든 PointLight를 수집하여 플레이어 주변 4개만 켜지도록 풀링(Pooling) 등록
  _scanAndPoolExistingLights() {
    if (!this.scene) return;
    this.managedLights = [];
    this.scene.traverse((obj) => {
      if (obj.isPointLight && obj.name !== "player_flashlight") {
        const wp = new THREE.Vector3();
        obj.getWorldPosition(wp);
        this.managedLights.push({
          light: obj,
          baseIntensity: obj.intensity || 0.8,
          worldPos: wp
        });
      }
      // 불필요한 연산을 줄이기 위해 정적 메쉬의 matrixAutoUpdate 비활성화 지원
      if (obj.isMesh && obj.userData.isStaticWall) {
        obj.updateMatrix();
        obj.matrixAutoUpdate = false;
      }
    });
  }

  // 대규모 구역(방/층/별관)을 청크 컬링 대상에 등록하는 헬퍼
  registerRoomChunk(id, group, centerPos, radius = 12.0, floorY = 0) {
    this.registeredChunks.push({ id, group, centerPos: centerPos.clone(), radius, floorY });
  }

  /* =========================================================
     2. 학교 공간 대규모 스케일 확장 빌더 (대강당/체육관, 중앙 중정, 지하 보존서고)
     * - 기존 본관/별관을 잇는 광활한 대형 아레나 구역 3곳 추가!
     ========================================================= */
  buildExpandedCampusMegaZones(originOffset = new THREE.Vector3(0, 0, 0)) {
    if (!this.scene) return;

    // ① [대강당 겸 실내체육관 (Grand Gymnasium)] — 폭 18m × 길이 26m × 층고 7.5m 초대형 공간!
    const gymCenter = new THREE.Vector3(originOffset.x - 28, originOffset.y, originOffset.z - 18);
    const gymGroup = this._createGrandGymnasium(gymCenter);
    this.registerRoomChunk("mega_gymnasium", gymGroup, gymCenter, 22.0, originOffset.y);

    // ② [본관-별관 야외 중앙 중정 (Central Courtyard)] — 폭 16m × 길이 16m 고목나무와 석상 정원
    const courtCenter = new THREE.Vector3(originOffset.x, originOffset.y, originOffset.z - 22);
    const courtGroup = this._createCentralCourtyard(courtCenter);
    this.registerRoomChunk("mega_courtyard", courtGroup, courtCenter, 18.0, originOffset.y);

    // ③ [지하 심층 보존서고 & 방공호 통로 (Underground Bunker Archive)] — 폭 12m × 길이 20m
    const bunkerCenter = new THREE.Vector3(originOffset.x + 18, originOffset.y - 4.0, originOffset.z - 12);
    const bunkerGroup = this._createUndergroundBunker(bunkerCenter);
    this.registerRoomChunk("mega_bunker", bunkerGroup, bunkerCenter, 18.0, originOffset.y - 4.0);
  }

  _createGrandGymnasium(centerPos) {
    const g = new THREE.Group();
    g.position.copy(centerPos);
    const W = 18.0, D = 26.0, H = 7.2;

    // 우레탄 코트 마루 바닥 (농구 코트 라인 포함)
    const courtCanvas = document.createElement("canvas");
    courtCanvas.width = 512; courtCanvas.height = 512;
    const ctx = courtCanvas.getContext("2d");
    ctx.fillStyle = "#5c3c24"; ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = "rgba(235, 230, 215, 0.55)"; ctx.lineWidth = 6;
    ctx.strokeRect(30, 30, 452, 452);
    ctx.beginPath(); ctx.arc(256, 256, 75, 0, Math.PI * 2); ctx.stroke();

    const floorMat = new THREE.MeshStandardMaterial({
      map: Object.assign(new THREE.CanvasTexture(courtCanvas), { colorSpace: THREE.SRGBColorSpace }),
      roughness: 0.35
    });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.25, D), floorMat);
    floor.position.y = -0.125;
    g.add(floor);

    // 정면 단상 무대 (Stage) & 붉은 벨벳 커튼 (뒤에 숨기 가능)
    const stage = new THREE.Mesh(
      new THREE.BoxGeometry(W - 2.0, 1.1, 4.5),
      new THREE.MeshStandardMaterial({ color: 0x332218, roughness: 0.7 })
    );
    stage.position.set(0, 0.55, -D / 2 + 2.5);

    const velvetCurtain = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 4.8, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x5e1218, roughness: 0.9 })
    );
    velvetCurtain.position.set(-W / 2 + 2.5, 3.5, -D / 2 + 4.6);

    // 단상 위 연설대 (1998년 졸업식 방송 미니게임 트리거)
    const podium = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.25, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x4a2c1a })
    );
    podium.position.set(0, 1.72, -D / 2 + 3.8);

    g.add(stage, velvetCurtain, podium);

    // 상호작용: 대강당 단상 방송 콘솔 (주파수 동조 미니게임 실행)
    podium.userData.interactable = {
      id: "gym_stage_podium",
      promptText: "[E] 대강당 단상 음향 콘솔 조작 — [미니게임: 주파수 동조] 실행",
      onInteract: ({ notify }) => {
        this.openRadioTunerMinigame(() => {
          this.advanceStoryAct(2, notify);
          if (notify) notify("📻 [주파수 98.4MHz 동조 성공] 스피커에서 교장실 비밀 금고 힌트와 함께 실종 사건의 진실이 흘러나옵니다!");
        });
      }
    };
    this.interactables.push({ mesh: podium, ...podium.userData.interactable });

    // 대강당 수집품 스폰 (학생 명찰 #11 & 카세트테이프 #4)
    this.spawnCollectibleItem(g, new THREE.Vector3(-W / 2 + 2.2, 1.15, -D / 2 + 3.2), "nametag", "tag_11");
    this.spawnCollectibleItem(g, new THREE.Vector3(W / 2 - 2.2, 0.2, 4.0), "tape", "tape_04");

    this.scene.add(g);
    return g;
  }

  _createCentralCourtyard(centerPos) {
    const g = new THREE.Group();
    g.position.copy(centerPos);

    // 이끼 낀 보도블록 바닥 + 중앙 고목나무 & 학교 창립자 흉상 좌대
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.2, 16),
      new THREE.MeshStandardMaterial({ color: 0x2d362e, roughness: 0.9 })
    );
    ground.position.y = -0.1;

    const statueBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.6, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x55585a, roughness: 0.8 })
    );
    statueBase.position.set(0, 0.8, 0);

    g.add(ground, statueBase);

    statueBase.userData.interactable = {
      id: "courtyard_founder_statue",
      promptText: "[E] 중정 창립자 석상 비문 조사 — [미니게임: 석상 다이얼 퍼즐]",
      onInteract: ({ notify }) => {
        this.openVoltageTimingMinigame(() => {
          if (notify) notify("🗝 석상 받침대 비밀 홈이 열리며 [1998년 카세트테이프 #5]와 비상 배터리를 획득했습니다!");
          this.collectLoreItem("tape", "tape_05", notify);
        });
      }
    };
    this.interactables.push({ mesh: statueBase, ...statueBase.userData.interactable });

    this.scene.add(g);
    return g;
  }

  _createUndergroundBunker(centerPos) {
    const g = new THREE.Group();
    g.position.copy(centerPos);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.2, 20),
      new THREE.MeshStandardMaterial({ color: 0x1e2224, roughness: 0.85 })
    );
    floor.position.y = -0.1;
    g.add(floor);

    // 지하 보존서고 철제 금고 캐비닛 & 수집품 배치
    this.spawnCollectibleItem(g, new THREE.Vector3(0, 0.2, -6.0), "tape", "tape_06");
    this.spawnCollectibleItem(g, new THREE.Vector3(-3.5, 0.2, 2.0), "nametag", "tag_02");

    this.scene.add(g);
    return g;
  }

  /* =========================================================
     3. 3대 수집품(명찰 12종 / 카세트테이프 6종) 3D 오브젝트 생성 및 습득
     ========================================================= */
  spawnCollectibleItem(parentGroup, localPos, category = "nametag", itemId = "tag_01") {
    const isTape = category === "tape";
    const mesh = new THREE.Mesh(
      isTape ? new THREE.BoxGeometry(0.28, 0.06, 0.18) : new THREE.BoxGeometry(0.22, 0.03, 0.12),
      new THREE.MeshStandardMaterial({
        color: isTape ? 0x222629 : 0xd4cfc2,
        emissive: isTape ? 0x113344 : 0x443311,
        roughness: 0.3
      })
    );
    mesh.position.copy(localPos);
    parentGroup.add(mesh);

    const itemInfo = (isTape ? this.LORE_DB.tapes : this.LORE_DB.nametags).find(x => x.id === itemId) || {
      id: itemId, name: itemId, title: itemId, desc: "오래된 기록물이다.", transcript: "..."
    };

    mesh.userData.interactable = {
      id: `collect_${itemId}`,
      promptText: isTape ? `[E] 📼 카세트테이프 수거 및 재생 (${itemInfo.title})` : `[E] 🏷️ 실종 학생 명찰 수거 (${itemInfo.name})`,
      onInteract: ({ notify }) => {
        if (!mesh.visible) return;
        mesh.visible = false;
        this.collectLoreItem(category, itemId, notify);
      }
    };
    this.interactables.push({ mesh, ...mesh.userData.interactable });
    return mesh;
  }

  collectLoreItem(category, itemId, notifyFn) {
    this._playSFX("collect");
    if (category === "nametag") {
      this.storyState.nametags.add(itemId);
      const info = this.LORE_DB.nametags.find(x => x.id === itemId);
      const count = this.storyState.nametags.size;
      if (notifyFn) {
        notifyFn(`🏷️ [학생 명찰 수집 (${count}/12)] '${info ? info.name : itemId}' — ${info ? info.desc : ""}`);
      }
      if (count >= 4 && this.storyState.currentAct < 2) this.advanceStoryAct(2, notifyFn);
      if (count >= 8 && this.storyState.currentAct < 3) this.advanceStoryAct(3, notifyFn);
      if (count >= 12) this.advanceStoryAct(4, notifyFn);
    } else if (category === "tape") {
      this.storyState.tapes.add(itemId);
      const info = this.LORE_DB.tapes.find(x => x.id === itemId);
      const count = this.storyState.tapes.size;
      this._playTapeVoiceEffect();
      if (notifyFn && info) {
        notifyFn(`📼 [녹음테이프 (${count}/6) 재생] ${info.title}\n${info.transcript}`);
      }
    }
    this._updateJournalUI();
  }

  advanceStoryAct(actNum, notifyFn) {
    if (actNum <= this.storyState.currentAct) return;
    this.storyState.currentAct = actNum;
    const title = this.storyState.actTitles[actNum];
    const banner = document.getElementById("patch-act-banner");
    if (banner && title) {
      banner.textContent = title;
      banner.classList.add("show");
      setTimeout(() => banner.classList.remove("show"), 4500);
    }
    if (notifyFn && title) notifyFn(`📖 [스토리 챕터 갱신] ${title}`);
    this._updateJournalUI();
  }

  /* =========================================================
     4. 인게임 미니게임 UI & 로직 (① 전압 타이밍 퍼즐  ② 주파수 동조 퍼즐)
     ========================================================= */
  openVoltageTimingMinigame(onSuccessCallback) {
    this.minigame.active = true;
    this.minigame.type = "voltage";
    this.minigame.cursorPos = 0;
    this.minigame.stage = 0;
    this.minigame.onSuccess = onSuccessCallback;

    const modal = document.getElementById("patch-minigame-modal");
    const content = document.getElementById("patch-mg-body");
    if (modal && content) {
      modal.style.display = "flex";
      content.innerHTML = `
        <div style="font-size:16px;font-weight:bold;color:#ffcc44;margin-bottom:8px;">⚡ [미니게임] 노후 배전반 전압 동기화 (3단계)</div>
        <div style="font-size:12px;color:#ccc;margin-bottom:14px;">움직이는 바늘이 <b style="color:#33ff77;">초록색 안전 구간(40%~65%)</b>에 들어왔을 때 <b>[Space]</b> 또는 <b>[클릭]</b>하세요! (<span id="mg-volt-stage">0</span> / 3 성공)</div>
        <div style="position:relative;width:100%;height:28px;background:#181c20;border:2px solid #556;border-radius:4px;overflow:hidden;">
          <div style="position:absolute;left:40%;width:25%;top:0;bottom:0;background:rgba(40,220,100,0.38);border-left:2px solid #2f8;border-right:2px solid #2f8;"></div>
          <div id="mg-volt-cursor" style="position:absolute;left:0%;top:0;bottom:0;width:8px;background:#ff3333;box-shadow:0 0 8px #ff3333;"></div>
        </div>
        <div style="margin-top:14px;display:flex;justify-content:space-between;">
          <button id="mg-volt-hit-btn" style="padding:8px 20px;background:#2b6e44;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">⚡ 스위치 투입 (Space)</button>
          <button id="mg-close-btn" style="padding:8px 14px;background:#444;color:#ddd;border:none;border-radius:4px;cursor:pointer;">닫기 (Esc)</button>
        </div>
      `;
      document.getElementById("mg-volt-hit-btn").onclick = () => this._handleVoltageHit();
      document.getElementById("mg-close-btn").onclick = () => this.closeMinigame();
    }
  }

  _handleVoltageHit() {
    if (!this.minigame.active || this.minigame.type !== "voltage") return;
    const p = this.minigame.cursorPos;
    if (p >= 38 && p <= 67) {
      this.minigame.stage++;
      this._playSFX("collect");
      const stEl = document.getElementById("mg-volt-stage");
      if (stEl) stEl.textContent = String(this.minigame.stage);
      if (this.minigame.stage >= 3) {
        const cb = this.minigame.onSuccess;
        this.closeMinigame();
        if (cb) cb();
      }
    } else {
      // 실패 시 스파크 사운드 및 처음 단계로 리셋
      this.minigame.stage = 0;
      this._playSFX("spark_fail");
      const stEl = document.getElementById("mg-volt-stage");
      if (stEl) stEl.textContent = "0 (과부하 리셋!)";
    }
  }

  openRadioTunerMinigame(onSuccessCallback) {
    this.minigame.active = true;
    this.minigame.type = "radio";
    this.minigame.freqValue = 90.2;
    this.minigame.targetFreq = 98.4;
    this.minigame.onSuccess = onSuccessCallback;

    const modal = document.getElementById("patch-minigame-modal");
    const content = document.getElementById("patch-mg-body");
    if (modal && content) {
      modal.style.display = "flex";
      content.innerHTML = `
        <div style="font-size:16px;font-weight:bold;color:#77ffaa;margin-bottom:8px;">📻 [미니게임] 비상 방송 주파수 동조기</div>
        <div style="font-size:12px;color:#ccc;margin-bottom:12px;">슬라이더를 조절해 신호 감도가 100%가 되는 <b>목표 공명 주파수(98.4 MHz)</b>에 맞추세요.</div>
        <div style="font-size:26px;font-family:monospace;text-align:center;color:#55ff99;margin:10px 0;" id="mg-freq-display">90.2 MHz (신호 감도: 12%)</div>
        <input id="mg-freq-slider" type="range" min="88.0" max="108.0" step="0.2" value="90.2" style="width:100%;cursor:pointer;" />
        <div style="margin-top:14px;text-align:right;">
          <button id="mg-close-btn" style="padding:8px 14px;background:#444;color:#ddd;border:none;border-radius:4px;cursor:pointer;">닫기</button>
        </div>
      `;
      const slider = document.getElementById("mg-freq-slider");
      const disp = document.getElementById("mg-freq-display");
      slider.oninput = (e) => {
        const val = parseFloat(e.target.value);
        const diff = Math.abs(val - this.minigame.targetFreq);
        const strength = Math.max(0, Math.round((1 - diff / 10) * 100));
        disp.textContent = `${val.toFixed(1)} MHz (신호 감도: ${strength}%)`;
        if (diff < 0.25) {
          this._playSFX("collect");
          const cb = this.minigame.onSuccess;
          this.closeMinigame();
          if (cb) cb();
        }
      };
      document.getElementById("mg-close-btn").onclick = () => this.closeMinigame();
    }
  }

  closeMinigame() {
    this.minigame.active = false;
    const modal = document.getElementById("patch-minigame-modal");
    if (modal) modal.style.display = "none";
  }

  /* =========================================================
     5. 매 프레임 업데이트: 60FPS 구역 청크 컬링 + 라이트 풀링 + 미니게임 커서
     ========================================================= */
  update(dt = 0.016, playerPos) {
    // 1) 전압 타이밍 미니게임 바늘 이동
    if (this.minigame.active && this.minigame.type === "voltage") {
      this.minigame.cursorPos += this.minigame.cursorDir * dt * 88.0;
      if (this.minigame.cursorPos >= 96) { this.minigame.cursorPos = 96; this.minigame.cursorDir = -1; }
      if (this.minigame.cursorPos <= 0)  { this.minigame.cursorPos = 0;  this.minigame.cursorDir = 1; }
      const curEl = document.getElementById("mg-volt-cursor");
      if (curEl) curEl.style.left = `${this.minigame.cursorPos}%`;
    }

    if (!playerPos) return;

    // 2) 0.25초 주기로 구역 청크 가시성(Chunk Culling) 및 라이트 풀링 최적화 수행!
    this.optimConfig.cullTimer -= dt;
    if (this.optimConfig.cullTimer <= 0) {
      this.optimConfig.cullTimer = this.optimConfig.cullCheckInterval;
      this._performChunkAndLightCulling(playerPos);
    }
  }

  _performChunkAndLightCulling(playerPos) {
    // A. 멀리 있거나 다른 층에 있는 방 그룹을 통째로 비가시화하여 드로우콜 대폭 절감
    for (const chunk of this.registeredChunks) {
      if (!chunk.group) continue;
      const distXZ = Math.hypot(playerPos.x - chunk.centerPos.x, playerPos.z - chunk.centerPos.z);
      const diffY = Math.abs(playerPos.y - chunk.floorY);
      const shouldShow = (distXZ <= this.optimConfig.cullDistance + chunk.radius) &&
                         (diffY <= this.optimConfig.floorHeightTolerance * 2.2);
      if (chunk.group.visible !== shouldShow) {
        chunk.group.visible = shouldShow;
      }
    }

    // B. 라이트 풀링: 플레이어와 가장 가까운 상위 4개의 PointLight만 켜고 나머지는 visible=false 처리!
    if (this.managedLights.length > this.optimConfig.maxActivePointLights) {
      this.managedLights.sort((a, b) => {
        return a.worldPos.distanceToSquared(playerPos) - b.worldPos.distanceToSquared(playerPos);
      });
      for (let i = 0; i < this.managedLights.length; i++) {
        const item = this.managedLights[i];
        item.light.visible = (i < this.optimConfig.maxActivePointLights);
      }
    }
  }

  /* =========================================================
     6. 스토리/수집품 도감(`J` 키) 및 미니게임 모달 UI 주입
     ========================================================= */
  _injectMegaUI() {
    if (document.getElementById("patch-minigame-modal")) return;

    const style = document.createElement("style");
    style.textContent = `
      #patch-act-banner {
        position: fixed; top: 18%; left: 50%; transform: translateX(-50%);
        background: rgba(8, 10, 14, 0.92); border-top: 2px solid #b82828; border-bottom: 2px solid #b82828;
        color: #f0e8dc; padding: 14px 38px; font-size: 20px; font-family: serif; letter-spacing: 3px;
        z-index: 9994; pointer-events: none; opacity: 0; transition: opacity 0.45s ease;
      }
      #patch-act-banner.show { opacity: 1; }
      #patch-minigame-modal, #patch-lore-journal {
        position: fixed; inset: 0; background: rgba(0, 0, 0, 0.78);
        z-index: 9996; display: none; align-items: center; justify-content: center;
      }
      .patch-modal-card {
        width: 440px; max-width: 92vw; background: #14181c; border: 1px solid #4a5560;
        border-radius: 8px; padding: 20px; color: #e8e2d8; font-family: sans-serif;
        box-shadow: 0 12px 40px rgba(0,0,0,0.9);
      }
    `;
    document.head.appendChild(style);

    const banner = document.createElement("div");
    banner.id = "patch-act-banner";
    document.body.appendChild(banner);

    const mgModal = document.createElement("div");
    mgModal.id = "patch-minigame-modal";
    mgModal.innerHTML = `<div class="patch-modal-card" id="patch-mg-body"></div>`;
    document.body.appendChild(mgModal);

    const journal = document.createElement("div");
    journal.id = "patch-lore-journal";
    journal.innerHTML = `
      <div class="patch-modal-card" style="width:540px;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #333;padding-bottom:10px;margin-bottom:12px;">
          <b style="font-size:17px;color:#ffd277;">📖 1998 성운고 사건 기록 & 수집품 도감 [J]</b>
          <button onclick="document.getElementById('patch-lore-journal').style.display='none'" style="background:#333;color:#fff;border:none;padding:4px 10px;cursor:pointer;">✕</button>
        </div>
        <div id="patch-journal-content" style="font-size:13px;line-height:1.6;max-height:360px;overflow-y:auto;"></div>
      </div>
    `;
    document.body.appendChild(journal);
    this._updateJournalUI();
  }

  _updateJournalUI() {
    const box = document.getElementById("patch-journal-content");
    if (!box) return;
    const actTitle = this.storyState.actTitles[this.storyState.currentAct];
    box.innerHTML = `
      <div style="background:#1c2228;padding:10px;border-left:3px solid #d93838;margin-bottom:12px;">
        <b>현재 진행 챕터:</b> ${actTitle}<br/>
        <span style="color:#aaa;font-size:12px;">진엔딩 조건: 실종 학생 명찰 12개 전원 수거 후 옥상 구조 신호 발송 및 정문 탈출</span>
      </div>
      <div style="margin-bottom:8px;"><b>🏷️ 실종 학생 명찰 수집 현황:</b> ${this.storyState.nametags.size} / 12</div>
      <div style="margin-bottom:12px;"><b>📼 1998년 카세트테이프 수집 현황:</b> ${this.storyState.tapes.size} / 6</div>
      <div style="font-size:12px;color:#99aabb;">※ 각 특별실(교장실, 상담실, 보건실, 음악실, 동아리실, 수영장, 대강당 등)을 수색해 단서를 모으세요.</div>
    `;
  }

  _bindMegaHotkeys() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyJ") {
        const el = document.getElementById("patch-lore-journal");
        if (el) el.style.display = (el.style.display === "flex") ? "none" : "flex";
      } else if (e.code === "Space" && this.minigame.active && this.minigame.type === "voltage") {
        e.preventDefault();
        this._handleVoltageHit();
      } else if (e.code === "Escape" && this.minigame.active) {
        this.closeMinigame();
      }
    });
  }

  _ensureAudio() {
    if (!this.audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AC();
    }
    if (this.audioCtx.state === "suspended") this.audioCtx.resume();
    return this.audioCtx;
  }

  _playSFX(type) {
    const ctx = this._ensureAudio();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);

    if (type === "collect") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(783.99, now + 0.09);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.28);
      osc.start(now); osc.stop(now + 0.3);
    } else if (type === "spark_fail") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.25);
      osc.start(now); osc.stop(now + 0.26);
    }
  }

  _playTapeVoiceEffect() {
    const ctx = this._ensureAudio();
    const now = ctx.currentTime;
    // 카세트테이프 돌아가는 아날로그 로우파이 험(Hum) 사운드
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(120, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now); osc.stop(now + 1.55);
  }
}

window.megaSchoolPatch = new MegaSchoolExpansionAndOptimizer();
export default window.megaSchoolPatch;
