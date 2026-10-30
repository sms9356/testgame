// 서문고 — 잊혀진 시간 : 1인칭 학교 공포 게임 (Three.js)
import * as THREE from './vendor/three.module.js';
import { MeshBVH } from './vendor/addons/bvh/three-mesh-bvh.module.js';
import { createRenderer, ENGINE } from './engine.js?v=306';
import { createFXWebGPU } from './fxWebGPU.js?v=306';
import { autoDetail, setupEnv, sharpenTextures, slimHeavyProps } from './surfaceDetail.js?v=306';
// 광선 검사 가속 (three-mesh-bvh, MIT): 건물 통짜 메시에 광선을 쏘는 배치 보정 · 상호작용 검사가 삼각형을 전부 훑느라
//   로딩 중 수십 초 멈추던 것('응답 없는 페이지') → 큰 정적 메시는 처음 검사할 때 BVH 를 한 번 만들어 쓴다
{ const base = THREE.Mesh.prototype.raycast, R = new THREE.Ray(), M4 = new THREE.Matrix4(), S = new THREE.Sphere();
  THREE.Mesh.prototype.raycast = function (raycaster, hits) {
    const g = this.geometry, idx = g && g.index, n = idx ? idx.count : g && g.attributes.position ? g.attributes.position.count : 0;
    if (this.isSkinnedMesh || this.morphTargetInfluences || !g || n < 600 || g.groups.length > 1 || Array.isArray(this.material) || g.userData.noBVH) return base.call(this, raycaster, hits);
    if (!g.boundsTree) { try { g.boundsTree = new MeshBVH(g, { maxLeafSize: 12 }); } catch (e) { g.userData.noBVH = true; return base.call(this, raycaster, hits); } }
    if (!g.boundingSphere) g.computeBoundingSphere(); S.copy(g.boundingSphere).applyMatrix4(this.matrixWorld); if (!raycaster.ray.intersectsSphere(S)) return;
    M4.copy(this.matrixWorld).invert(); R.copy(raycaster.ray).applyMatrix4(M4);
    const side = this.material && this.material.side != null ? this.material.side : THREE.FrontSide, list = raycaster.firstHitOnly ? [g.boundsTree.raycastFirst(R, side)].filter(Boolean) : g.boundsTree.raycast(R, side);
    for (const h of list) { h.point.applyMatrix4(this.matrixWorld); h.distance = h.point.distanceTo(raycaster.ray.origin); h.object = this; if (h.distance >= raycaster.near && h.distance <= raycaster.far) hits.push(h); }
  }; }
import { elevatorLocal, elevatorWorld, elevatorRoute, restoreOutsideElevatorBay } from './elevatorLayout.js';
import { buildMissionGroups, recordCompleted, normalizeCompletedLog } from './mysteryMissions.js';
import { settleStoryGhost } from './storyGhost.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';
import { createNPCVisuals } from './npcVisuals.js?v=306';
import { applyGuardSeatedPose } from './guardSeatedPose.js?v=306';
import { createCampusCctvLive, collectCampusCctvFeeds } from './campusCctvLive.js';
import { applyExteriorFloorVisibility, shouldStreamGuardCctv } from './exteriorRenderBudget.js?v=306';
import { GUARD_LAYOUT } from './guardRoomLayout.js?v=306';
import { ANNEX_KEYS, CABINET_CODE } from './guardAnnex.js?v=306';
import { installGuardRoom } from './guardRoom.js?v=306';
import { prepareModelGeometry } from './modelGeometry.js';
import { modelFootprint, overlaps, removeDuplicateModels } from './placement.js';
import { turfMaterial } from './campusVisuals.js?v=306';
import { installInfirmaryAssets, updateInfirmaryCabinets } from './infirmaryAssets.js';
import { installRebuild } from './rebuildGame.js?v=306';
import { buildWorld, collide, los, FH, GATE_Z, KEY_NAMES, KEY_ROOMS, AREA_NAMES, SLOTS, LAYOUT, ANNEX, LAYOUT_S, ANNEX_S, MAIN_ZS, WALKWAY, NORTH_Z, MEGA, CH as CH_, ROOF_Y } from './world.js?v=306'; import { updateWindowFakes } from './windowInteriors.js?v=306';
import { drawMap } from './map.js?v=306';
import { buildMegaCampus15000, MEGA_CAMPUS_ZONES } from './megaCampus15000.js?v=306';
import { installFacilityRebuild, inTwoStory, ZONES as FAC_ZONES } from './facilityRebuild.js?v=306';
import { relayoutCampus } from './campusRelayout.js?v=306';
import { makeDress, makeHair, makeGhostFace, makeGraffiti, makeKeypad, loadPBR, pbr, makeGlow as makeGlowTex, makePaintingStare, makeSign, makeBlood } from './tex.js';
import { warmUp } from './bake.js';
import { createStaticDistanceLOD } from './staticDistanceLOD.js';
import { createTextureBudget } from './textureBudget.js';
import { createFX } from './fx.js';
import { GhostCameraSystem } from './ghostCamera.js';   // 야간 카메라 엔진 (사용자 제공)
import { CraftingSystem } from './craftingSystem.js';   // 조합 · 생존 도구 (사용자 제공)
import { SchoolPowerEventSystem } from './schoolPowerSystem.js';   // 배전반 · 차임벨 (사용자 제공)
import { RestroomSystem } from './restroomSystem.js';   // 화장실 세면대 · 변기 (사용자 제공)
import './fiveZonesPatch.js';         // 5대 구역 확장 (사용자 제공) → window.fiveZonesPatch
import './indoorPassagePatch.js';     // 본관 ↔ 별관 실내 연결복도 (사용자 제공) → window.indoorPassagePatch
import './corridorLockerPatch.js';    // 3D 철제 캐비닛 사물함 · 복도 리모델링 (사용자 제공) → window.corridorLockerPatch
import './basementRoomsPatch.js';     // 지하 전기실 · 보일러실 (사용자 제공) → window.basementRoomsPatch
import './classroomRemodelPatch.js';  // 교실 리모델링 · 의자에 앉기 (사용자 제공) → window.classroomRemodelPatch
import './school37RoomsPatch.js';    // 본관 · 별관 37개 특별실 가구 · 동선 (사용자 제공) → window.school37RoomsPatch
import './new37UniquePatch.js';     // 37개 구역 신규 특수 설비 · 벽면 레일 (사용자 제공) → window.new37UniquePatch
import './megaExpansionPatch.js?v=306';   // 메가 익스팬션 · 최적화 · 4막 사건 기록 · 수집품 · 미니게임 (사용자 제공) → window.megaSchoolPatch
import './poolMachineryPatch.js';     // 수영장 · 남/녀 탈의실·샤워실 · 기계실 철문 (사용자 제공) → window.poolAndMachineryPatch
import { initAudio, sfx, at, setProximity, setListener, setAmbience, setBreath, setGhostVoice, setMusic, setVolumes, getVolumes, setGenHum, setRainLevel, setCoil, sfxCtx, setSfxBusyCheck } from './audio.js?v=306'; import { installSchoolDoors, updateSchoolDoors } from './schoolDoors.js?v=306'; import { installPerf, perfTick as perfStabTick, prewarmFloors, withPerfCamera, perfInstanceSource } from './perfStabilizer.js?v=306'; window.__perfInst = perfInstanceSource; import { upgradePlainMaterials } from './plainUpgrade.js?v=306'; import { relayCampusPaths, cleanupCampus } from './campusPaths.js?v=306'; import { installHudV2, tickHudV2 } from './hudV2.js?v=306'; import { installPartnerRadio, tickPartnerRadio } from './partnerRadio.js?v=306';
import { installRoomUI } from './roomUI.js?v=306';   // 방별 현장 조사 카드 · 상호작용 아이콘 · 획득/목표 애니메이션
import { furnishRooms } from './furnishV2.js?v=310';   // 방 용도별 실사 가구 보강 (상담실 소파 · 교무실 냉온수기 · 창고 선반 …)
import { VS, saveVS, loadManifest, speak, stopSpeak, subtitle, line, preload, hasBrowserVoice, hasNaturalVoice, engineLabel, lineInfo, registerLines, SUBLOG, logLine } from './voice.js?v=306';
import { CHARACTERS, FACE, LINES, VO, ITEMS, RECIPES, CHAPTERS, CREDITS, OPTIONAL, CLUES, CHAR_NOTE, TIMELINE, HYPOTHESES, EPILOGUE, DEATH_LOG, NOTES as STORY_NOTES, MEMORIES, FINAL_CHOICE, FINAL_EPI, COVER_END, ENDING_OUTRO, OUTRO_TYPE, SIDEQUESTS, HEADQUEST, COLLECT, } from './story.js?v=306';
import { isSpeechBusy } from './voice.js?v=306';
import { SET, saveSET, resetSET, DIFF, keyLabel } from './settings.js';
import { initI18n, setLang, lang as curLang } from './i18n.js?v=306';   // 언어 패치 (한국어 · English · 日本語 · 中文)
initI18n();
const K = () => SET.keys;
let guardRoomController = null, guardControlProps = [], guardCctvData = null, campusCctv = null;
function openGuardCctv() { if(!campusCctv) return; state='cctv'; for(const k in keys) keys[k]=false; $('prompt').style.display='none'; document.exitPointerLock?.(); campusCctv.open(); }
function closeGuardCctv() { campusCctv?.close(); if(state==='cctv') { state='playing'; for(const k in keys) keys[k]=false; refreshHud(); lock(); } }
function guardDeviceState() { return { cctvOn: FL.guardCctvOn ?? true, lightOn: FL.guardLightOn ?? false, doorOpen: FL.guardDoorOpen ?? true }; }
function syncGuardDevices() {
  if (typeof anxCabinetVisual === 'function') anxCabinetVisual();
  if (typeof case5Visual === 'function') case5Visual();
  { const du = world.guardAnnex?.duty, on = (FL.guardLightOn ?? false) && !blackout; if (du) { du.light.intensity = on ? 1.1 : 0; du.panelM.color.setHex(on ? 0xfff4dc : 0x9a9890); } }
  const q = guardDeviceState(); guardRoomController?.applyState(q);
  for (const p of guardControlProps) { if (p.k === 'guarddoor') p.label = q.doorOpen ? '경비실 문 닫기' : '경비실 문 열기'; else if (p.k === 'guardlight') p.label = q.lightOn ? '경비실 전등 끄기' : '경비실 전등 켜기'; else if (p.k === 'guardcctv' || p.fz?.id === 'guard_cctv') p.label = q.cctvOn ? 'CCTV 실시간 화면 보기' : 'CCTV 관제 화면 (전원 꺼짐)'; }
  if (guardCctvData) guardCctvData.promptText = '[E] CCTV 실시간 화면 보기';
  return q;
}
function toggleGuardCCTV(persist = true) { FL.guardCctvOn = !(FL.guardCctvOn ?? true); sfx.click(); syncGuardDevices(); if (persist) save(true); return FL.guardCctvOn; }
function toggleGuardLight() { FL.guardLightOn = !(FL.guardLightOn ?? false); sfx.click(); syncGuardDevices(); say(FL.guardLightOn ? '경비실 전등을 켰다' : '경비실 전등을 껐다', 1800); save(true); return FL.guardLightOn; }

import { run as runMini, MG } from './minigames.js?v=306';
import { SCHEMA, BUILD, storageKeys, itemUid, propUid, doorUid, assignUids, readSlot, writeSlot, hasSlot, clearSlot, repairProgress } from './saveSystem.js';
const NOTE_CAST = {
  n_seomun_ilbo: { spk: 'reporter', audioId: 'call_119', stage: '(📰 서문일보 사회부 한진우 기자의 긴급 특보 리포팅)' },
  n_guard_diary: { spk: 'guard', audioId: 'mtape_2', stage: '(🔦 당직 경비원 박종철 아저씨의 순찰 기록 증언)' },
  n24:           { spk: 'guard', audioId: 'mtape_2', stage: '(🔦 당직 경비원 박종철 아저씨의 1998.10.12 야간 순찰 일지)' },
  n_principal_tape: { spk: 'principal', audioId: 'mtape_5', stage: '(📼 제9대 교장 한석규의 비상대책회의 극비 녹취)' },
  n21:           { spk: 'principal', audioId: 'mtape_5', stage: '(📋 제9대 교장 명의의 30주년 기념 방송 가정통신문)' },
  h1:            { spk: 'principal', audioId: 'mtape_5', stage: '(✒ 제9대 교장이 새벽에 남긴 비밀 수첩 독백)' },
  h2:            { spk: 'principal', audioId: 'note_h2', stage: '(별관 개교 머릿돌에 새겨진 기록)' },
  h3:            { spk: 'scienceTeacher', audioId: 'mtape_3', stage: '(별관 분전반 차단 점검 기록)' },
  h4:            { spk: 'principal', audioId: 'mtape_5', stage: '(보안 PC에 남은 교장의 심야 통화 녹취 기록)' },
  h5:            { spk: 'principal', audioId: 'mtape_5', stage: '(진열장 속 마스터 코어와 함께 봉인된 교장의 고백서)' },
  n2:            { spk: 'nurse', audioId: 'tape1', stage: '(💊 보건교사 임소연 선생님의 정전 당일 보건 일지)' },
  q3a:           { spk: 'nurse', audioId: 'tape1', stage: '(💧 보건교사 임소연 선생님이 눈물로 쓴 고백 편지)' },
  q3b:           { spk: 'nurse', audioId: 'tape1', stage: '(수영장 배수구 물길 앞에 남겨진 보건교사의 흔적)' },
  n27:           { spk: 'homeroom', audioId: 'teacher2', stage: '(✒ 3학년 2반 담임 정은수 선생님의 결석 거부 수첩)' },
  q1a:           { spk: 'homeroom', audioId: 'teacher2', stage: '(윤하늘의 3년 개근 스티커판 기록)' },
  q1b:           { spk: 'homeroom', audioId: 'teacher2', stage: '(10년 만에 출석으로 바로잡힌 3학년 2반 출석부)' },
  q5a:           { spk: 'homeroom', audioId: 'teacher2', stage: '(✉ 3-2 담임 정은수 선생님이 하늘이 어머니께 쓴 편지)' },
  q5b:           { spk: 'homeroom', audioId: 'teacher2', stage: '(교사 휴게실 우편함에 보관된 반송 봉투)' },
  q5c:           { spk: 'homeroom', audioId: 'teacher2', stage: '(10년 늦게 정문 우편함에 부쳐진 담임선생님의 편지)' },
  n5:            { spk: 'scienceTeacher', audioId: 'note_n5', stage: '(🧪 과학부장 최동혁 선생님의 실험 노트)' },
  n17:           { spk: 'scienceTeacher', audioId: 'mtape_3', stage: '(🧪 과학부장 최동혁 선생님이 남긴 약품장 다이얼 메모)' },
  q7a:           { spk: 'scienceTeacher', audioId: 'mtape_3', stage: '(🔦 3회 연속 묵살된 과학부장의 비상등 배터리 점검 메모)' },
  q7b:           { spk: 'scienceTeacher', audioId: 'mtape_3', stage: '(10년 만에 불이 켜진 지하 펌프실 비상등)' },
  n9:            { spk: 'peTeacher', audioId: 'tape3', stage: '(🏀 체육부장 강태식 선생님의 10월 12일 야간 당직 일지)' },
  n10:           { spk: 'peTeacher', audioId: 'tape3', stage: '(🏊 체육부장이 기록한 실내수영장 및 펌프실 연결 안전 일지)' },
  n20:           { spk: 'peTeacher', audioId: 'tape3', stage: '(🏊 수영장 배수구 아래 비밀 증거 조각에 관한 관리 메모)' },
  n4:            { spk: 'librarian', audioId: 'mtape_1', stage: '(📚 도서실 사서 송지혜 선생님이 보관한 윤하늘 대출 카드)' },
  n19:           { spk: 'librarian', audioId: 'mtape_1', stage: '(📚 도서실 대출 데스크 잠긴 서랍에 대한 사서의 메모)' },
  n25:           { spk: 'librarian', audioId: 'mtape_1', stage: '(📚 대출 기록 조작을 자백하는 도서실 사서 선생님의 메모)' },
  n26:           { spk: 'librarian', audioId: 'mtape_1', stage: '(오늘 날짜 반납 도장이 찍힌 도서 대출 카드)' },
  q8a:           { spk: 'haneul', audioId: 'tape4', stage: '(하늘이가 도서실에서 빌린 『집으로 가는 길』 여백 메모)' },
  q8b:           { spk: 'librarian', audioId: 'mtape_1', stage: '(도서실 반납함에 돌아온 『집으로 가는 길』)' },
  n3:            { spk: 'headTeacher', audioId: 'tape3', stage: '(📁 교무부장 권오현이 작성한 1998.10.13 대외비 교무회의록)' },
  n11:           { spk: 'headTeacher', audioId: 'tape3', stage: '(지하 B1 비상 통로 및 마스터 기록부 봉인 점검표)' },
  n22:           { spk: 'headTeacher', audioId: 'tape5', stage: '(📁 5인 책임자(교무·보건·사서·과학·체육)의 1998 은폐 봉인 서약서)' },
  n_bunker_audit:{ spk: 'headTeacher', audioId: 'tape3', stage: '(방공호 보존서고에 은닉된 1998 재단 비공개 감사 보고서)' },
  q4b:           { spk: 'headTeacher', audioId: 'tape5', stage: '(교무부장이 외부 유출 금지로 봉인한 방송부원 진술서 4장)' },
  q4c:           { spk: 'headTeacher', audioId: 'tape5', stage: '(지하 펌프실의 두 문에 관한 진실 도면)' },
  n1:            { spk: 'haneul', audioId: 'tape4', stage: '(🕯 기념 방송 리허설을 앞둔 윤하늘과 친구의 일기)' },
  n8:            { spk: 'haneul', audioId: 'tape4', stage: '(🕯 3학년 2반 윤하늘이 직접 쓴 마지막 하교 방송 원고)' },
  n12:           { spk: 'mother', audioId: 'ghThanks', stage: '(붉게 지워진 졸업생 명부를 보고 전화를 걸어 온 하늘이 어머니)' },
  n18:           { spk: 'haneul', audioId: 'tape4', stage: '(하늘이가 피아노 반주를 맡기로 한 학교종 악보)' },
  n28:           { spk: 'friend', audioId: 'echo1', stage: '(하늘·수아·다은 세 단짝 친구의 교환일기)' },
  n29:           { spk: 'haneul', audioId: 'tape4', stage: '(리허설 시간과 담력 체험 장소가 적힌 하늘이의 첫 번째 메모)' },
  q2a:           { spk: 'friend', audioId: 'echo1', stage: '(기념 방송 끝곡 학교종을 약속한 교환일기 마지막 장)' },
  q2b:           { spk: 'mother', audioId: 'ghThanks', stage: '(폭로 방송을 들은 하늘이 어머니의 전화)' },
  q6a:           { spk: 'mina', audioId: 'tape2', stage: '(📱 언니 서다은을 위해 서문고에 들어온 민아 선배의 임시저장 글)' },
  q6b:           { spk: 'mina', audioId: 'cam1', stage: '(방송실 앞 하늘·수아·다은과 어린 민아의 사진)' },
  q6c:           { spk: 'mina', audioId: 'mw_s', stage: '(📱 민아 선배가 언니 서다은에게 남긴 마지막 음성 녹음)' },
};
// 문서별 전용 증언 녹음(nv_*) — 예전엔 60여 개 문서가 녹음 12개를 돌려 써서 같은 목소리·대사가 계속 겹쳤다
const NV_SPK = {"n_guard_diary": "guard", "n24": "guard", "n2": "nurse", "q3a": "nurse", "n27": "homeroom", "q5a": "homeroom", "q5b": "homeroom", "n_principal_tape": "principal", "h1": "principal", "h3": "electrician", "h4": "principal", "h5": "principal", "n21": "principal", "n3": "headTeacher", "n22": "headTeacher", "n_bunker_audit": "headTeacher", "n5": "scienceTeacher", "n17": "scienceTeacher", "q7a": "scienceTeacher", "n9": "peTeacher", "n10": "peTeacher", "n20": "peTeacher", "n4": "librarian", "n25": "librarian", "n26": "librarian", "q4b": "junho", "q8a": "haneul", "q8b": "narrator", "n8": "haneul", "n1": "friend", "n18": "haneul", "q2b": "narrator", "q1b": "narrator", "q5c": "narrator", "n28": "friend", "q2a": "friend2", "n23": "friend2", "n7": "friend2", "n14": "junho", "n29": "haneul", "n_dorm2f_diary": "dormMother", "q4a": "junho", "q4c": "reporter", "n6": "mina", "n15": "mina", "q6a": "mina", "q6b": "friend2", "q6c": "mina", "n16": "narrator", "h2": "narrator", "q3b": "narrator", "n11": "guard", "q7b": "narrator", "n12": "narrator", "q1a": "homeroom", "n13": "snackLady", "n19": "librarian"};
for (const [k, spk] of Object.entries(NV_SPK)) NOTE_CAST[k] = { ...(NOTE_CAST[k] || {}), spk, audioId: 'nv_' + k };
NOTE_CAST.n_seomun_ilbo = { ...NOTE_CAST.n_seomun_ilbo, audioId: 'news_rep' };
// 문서 원문 낭독(nd_*): 각 문서를 쓴 사람의 목소리로 원문 그대로 읽는다 (감정 태그 · ElevenLabs v4) — 자막과 음성이 글자 하나까지 같다
const ND_IDS = ["n_guard_diary", "n_principal_tape", "n_bunker_audit", "n_dorm2f_diary", "n1", "n2", "n3", "n4", "n6", "n7", "n8", "n9", "n10", "n11", "n12", "n13", "n17", "n18", "n19", "n20", "n21", "n22", "n23", "n24", "n25", "n26", "n27", "n28", "n29", "q1a", "q1b", "q2a", "q2b", "q3a", "q3b", "q4a", "q4b", "q4c", "q5a", "q5b", "q5c", "q7a", "q7b", "q8a", "h1", "h3", "h4", "h5", "q8b", "n14", "n15", "n16"];
for (const k of ND_IDS) NOTE_CAST[k] = { ...(NOTE_CAST[k] || {}), audioId: 'nd_' + k };
const RECAST_LINE_KEYS = new Set(['gate', 'office', 'key', 'keyLast', 'headMissing', 'headFound', 'keyMade', 'needCombine', 'pumpPolice', 'seomunPaper', 'dorm2fClimb', 'bunkerEnter', 'westGateReloc']);
loadManifest().then(() => {
  const protagLines = {};
  Object.entries(LINES).forEach(([k, v]) => {
    const recast = RECAST_LINE_KEYS.has(k);
    protagLines['l_' + k + '_j'] = { spk: 'jihun', text: v.j, recast };
    protagLines['l_' + k + '_s'] = { spk: 'seoyeon', text: v.s, recast };
  });
  const noteLines = Object.fromEntries(Object.entries(STORY_NOTES).filter(([, n]) => n.text).map(([k, n]) => {
    const cast = NOTE_CAST[k] || { spk: 'narrator' };
    const keepExact = k === 'n5' || k === 'n6';
    return ['note_' + k, {
      spk: cast.spk,
      audioId: NV_SPK[k] ? cast.audioId : keepExact ? ('note_' + k) : (cast.audioId || ('note_' + k)),
      customTimbre: !NV_SPK[k] && !keepExact && !!cast.audioId,
      stage: cast.stage || '',
      text: n.title + '. ' + n.text,
      parts: [n.title, n.text],
    }];
  }));
  registerLines({ ...VO, ...protagLines, ...noteLines });
});

const $ = id => document.getElementById(id);
// 매 프레임 갱신하는 HUD 글자: 바뀔 때만 쓴다 (같은 글자를 다시 쓰면 레이아웃 · 번역 감시가 매 프레임 돈다)
const setTxt = (el, v, html) => { if (el._v === v) return; el._v = v; if (html) el.innerHTML = v; else el.textContent = v; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const NORENDER = params.has('norender') && DEBUG;   // 자동 점검용: 화면을 그리지 않고 게임 진행만 (느린 소프트웨어 렌더러에서도 실시간으로)
const TEST = params.has('test');
const TST = { god: false, noGhost: false };
const TEST_NOLOCK = params.has('nolock'), BRIGHT = params.has('bright');   // bright: 화면 점검용 균일 조명
// 주인공 (캐릭터 선택)
const CHAR_KEY = TEST ? 'haegyo_test_char' : 'haegyo_char';
const ENDINGS_KEY = TEST ? 'haegyo_test_endings' : 'haegyo_endings';
const DEATHS_KEY = TEST ? 'haegyo_test_deaths' : 'haegyo_deaths';
const SHOTS_KEY = TEST ? 'haegyo_test_shots' : 'haegyo_shots';
const AUTO_KEY = TEST ? 'haegyo_test_auto' : 'haegyo_auto';
let CHAR = 'seoyeon';
try { CHAR = localStorage.getItem(CHAR_KEY) || 'seoyeon'; } catch (e) { /* ignore */ }
if (!CHARACTERS[CHAR]) CHAR = 'seoyeon';
const CH = () => CHARACTERS[CHAR], CK = () => (CHAR === 'jihun' ? 'j' : 's');
const DF = () => DIFF[SET.diff] || DIFF.normal;
// 이야기 진행 플래그
const FL = { cam: false, tag: false, calm: false, mina: false, gatekey: false, opt: false, fuse: false, mop: false, wire: false, hook: false };
const msgs = [], clues = [], newItems = new Set();
let storySession = 0;
const pendingMessages = new Map();
function beginStorySession(){++storySession;elvReset();voBusy=false;stopSpeak();document.getElementById('memTint')?.classList.remove('on');++talkRequest;clearTimeout(talkTimer);document.getElementById('dlg')?.classList.remove('show');for(const timer of pendingMessages.values())clearTimeout(timer);pendingMessages.clear();}
let voBusy = false;   // 중요한 연출(하교 방송) 중에는 휴대폰 메시지를 미룬다
let chapterShown = 0;

/* ---------- 렌더러 / 씬 ---------- */
const canvas = $('c');
const renderer = await createRenderer({ canvas, pref: SET.engine || 'auto' });   // 신규 엔진: WebGPU(지원 시) · 아니면 WebGL — engine.js
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
// GPU 확인: 브라우저 하드웨어 가속이 꺼져 소프트웨어 렌더러(SwiftShader · llvmpipe)로 그리면 안내한다
{ const gl = renderer.getContext(), ext = !ENGINE.webgpu && gl && gl.getExtension ? gl.getExtension('WEBGL_debug_renderer_info') : null, gpu = ENGINE.webgpu ? 'WebGPU' : ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  window.__gpu = gpu; window.__gpuSoftware = /swiftshader|llvmpipe|software|basic render/i.test(gpu);
  if (window.__gpuSoftware && !new URLSearchParams(location.search).has('norender')) setTimeout(() => { try { say('⚠ 그래픽카드(GPU)를 쓰지 못하고 있습니다 — 브라우저 설정에서 “하드웨어 가속 사용”을 켜고 다시 시작하세요', 9000); } catch (e) {} }, 4000); }
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3 * SET.bright;
// 안정화: 그래픽 장치 초기화(WebGL 컨텍스트 손실 — 드라이버 재시작 · 메모리 부족 · 오래 잠든 탭)면 검은 화면에 멈추지 않게 자동 저장 후 다시 불러온다
renderer.domElement.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  try { if (typeof state !== 'undefined' && (state === 'playing' || state === 'ui')) { state = 'playing'; save(true); } } catch (er) { /* ignore */ }
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#05070a;color:#d8d0c0;font:16px sans-serif;text-align:center;padding:20px';
  d.textContent = '그래픽 장치가 초기화되었습니다 — 진행 상황을 저장하고 다시 불러옵니다…'; document.body.appendChild(d);
  setTimeout(() => location.reload(), 1800);
}, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const staticLOD = createStaticDistanceLOD(scene);
const textureBudget = createTextureBudget({ quality: SET.quality === 'auto' ? 'high' : SET.quality });
scene.background = new THREE.Color(0x05070d);
scene.fog = new THREE.FogExp2(0x070a12, 0.03);
const FOG_IN = new THREE.Color(0x060708), FOG_OUT = new THREE.Color(0x0c1424);
const camera = new THREE.PerspectiveCamera(SET.fov, innerWidth / innerHeight, 0.05, 320);
scene.add(camera);
// 야간 카메라: scene · camera · renderer 생성 직후 초기화. 장면에 조명을 더하면 모든 재질 셰이더가 다시 컴파일되고 매 프레임 비용이 늘어나서,
// 클래스의 야간투시 · 플래시 보조광(PointLight 2개) 대신 CSS 야간투시 필터 · 화면 섬광 · 손전등 감광으로 같은 연출을 낸다
class GameGhostCam extends GhostCameraSystem { _initLights() {} }
const ghostCam = window.ghostCam = new GameGhostCam({ scene, camera, renderer, audioCtx: sfxCtx });   /* 효과음 볼륨 설정을 따르게 (예전엔 모듈마다 AudioContext 를 따로 만들었다) */

const hemi = new THREE.HemisphereLight(0x8aa0d0, 0x2a2018, 0.4);
scene.add(hemi);
const moonLight = new THREE.DirectionalLight(0x7f9ae0, 1.0);
moonLight.position.set(-40, 90, -120); scene.add(moonLight);
const fillLight = new THREE.DirectionalLight(0x8a9ac8, 0); fillLight.position.set(30, 50, 150); scene.add(fillLight);   // 운동장 쪽 건물 정면을 비추는 보조 달빛
// 하늘 돔: 위 · 지평선 · 아래 세 색 + 해 주변 노을 — 낮(흐린 늦은 오후) → 해 질 녘 → 밤
const skyU = { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uBot: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(-.8, .12, .55).normalize() }, uGlow: { value: 0 } };
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), new THREE.ShaderMaterial({
  uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; }',
  fragmentShader: `uniform vec3 uTop, uHor, uBot, uSun; uniform float uGlow; varying vec3 vD;
    void main(){ float y = vD.y; vec3 c = y > 0.0 ? mix(uHor, uTop, pow(smoothstep(0.0, .55, y), .8)) : mix(uHor, uBot, smoothstep(0.0, .2, -y));
      float s = max(dot(normalize(vD), uSun), 0.0); c += vec3(1.0, .55, .25) * (pow(s, 6.0) * .35 + pow(s, 60.0) * .6) * uGlow * smoothstep(-.1, .15, y);
      gl_FragColor = vec4(c, 1.0); }`,
}));
if (ENGINE.webgpu) {   // 신규 엔진: 같은 하늘을 TSL 노드 재질로 (GLSL ShaderMaterial 은 WebGPU 에서 못 쓴다)
  const T = ENGINE.TSL, top = T.uniform(skyU.uTop.value), hor = T.uniform(skyU.uHor.value), bot = T.uniform(skyU.uBot.value), sun = T.uniform(skyU.uSun.value), glow = T.uniform(0);
  skyU.uGlow = glow; const D = T.normalize(T.positionLocal), y = D.y;
  const c = T.select(y.greaterThan(0), T.mix(hor, top, T.pow(T.smoothstep(0, .55, y), .8)), T.mix(hor, bot, T.smoothstep(0, .2, y.negate())));
  const sd = T.max(T.dot(D, sun), 0), m = new ENGINE.W.MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  m.colorNode = c.add(T.vec3(1, .55, .25).mul(T.pow(sd, 6).mul(.35).add(T.pow(sd, 60).mul(.6))).mul(glow).mul(T.smoothstep(-.1, .15, y))); skyDome.material = m;
}
skyDome.renderOrder = -10; skyDome.frustumCulled = false; scene.add(skyDome);
// 하루의 흐름: dayK 1 = 흐린 늦은 오후, 0 = 비 오는 밤. 정문이 닫히면 해가 진다 (스토리 연계)
const DAY = { k: .92, start: -1, dur: 75, done: false };
const C_ = h => new THREE.Color(h);
const SKY_N = [C_(0x03050b), C_(0x0c1424), C_(0x020304)], SKY_D = [C_(0x5d6e88), C_(0xd8a27a), C_(0x3a3430)];
const FOG_DAY = C_(0xa69a92), FOG_IN_DAY = C_(0x2c2a28), BG_DAY = C_(0x8d97a6);
const SUN_POS = new THREE.Vector3(-150, 42, 70), MOON_POS = new THREE.Vector3(-40, 90, -120);
const SUN_COL = C_(0xffc896), MOON_COL = C_(0x7f9ae0), HEMI_SKY_N = C_(0x8aa0d0), HEMI_SKY_D = C_(0xc8ccd4), HEMI_GND_N = C_(0x2a2018), HEMI_GND_D = C_(0x6a5a48);
const _c1 = new THREE.Color();
const flash = new THREE.SpotLight(0xfff0d0, 0, 30, 0.56, 0.82, 1.3);   // 가장자리를 부드럽게 (딱딱한 원 밖이 완전히 깜깜해 보이던 문제)
// 손전등 산란광: 빛이 벽 · 바닥에 튀어 주변이 희미하게 보이는 효과 (항상 장면에 있어 셰이더 재컴파일 없음)
const spill = new THREE.PointLight(0xffe8cc, 0, 7, 2); camera.add(spill); spill.position.set(0, .1, -1.2);
flash.position.set(0.12, -0.08, 0); flash.target.position.set(0, 0, -6);
camera.add(flash, flash.target);
flash.castShadow = true; flash.shadow.mapSize.set(1024, 1024); flash.shadow.camera.near = .15; flash.shadow.camera.far = 26;
flash.shadow.bias = -.0006; flash.shadow.normalBias = .03;
const pool = [];
for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xcfe6d6, 0, 12, 1.7); scene.add(l); pool.push(l); }

const _t0 = performance.now();
await Promise.race([loadPBR(), new Promise(r => setTimeout(r, 2500))]);
const _t1 = performance.now();
const world = buildWorld(scene);
let RBG = null;   // 재건축 본관 · 별관 (항상 — 예전 건물 모드 ?oldmap 은 폐지) — rebuildGame.js
const npcVisuals = createNPCVisuals({ THREE, GLTFLoader, prepare: async obj => {
  const tex = new Set(); obj.traverse(o => { if (o.material) [].concat(o.material).forEach(m => ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'emissiveMap'].forEach(k => m[k] && tex.add(m[k]))); });
  await textureBudget.prepareTextures(tex);
  for (const t of tex) { renderer.initTexture(t); await new Promise(r => requestAnimationFrame(r)); }   // 한 프레임에 하나씩
  if(renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(obj,camera,scene); else renderer.compile(obj,camera,scene);
} });   // assets/characters/{guard,mina}.glb 가 있으면 절차적 모델 대신 쓴다
// 캐릭터 GLB 는 assets/characters/manifest.json 에 true 로 적힌 것만 요청한다 (없는 파일을 매번 요청해 404 가 나던 문제)
const NPC_AVAIL = fetch('assets/characters/manifest.json').then(r => (r.ok ? r.json() : {})).catch(() => ({}));
function npcLoad(id, holder, opts) { NPC_AVAIL.then(m => { if (m && m[id]) npcVisuals.load(id, holder, opts).catch(e => console.warn('[npc]', id, e && e.message)); }); }
// 실사 스캔 소품 (Poly Haven CC0): 모델별 · 층별로 InstancedMesh 를 만들어 드로콜을 줄인다
function loadModels() {
  world.modelAudit.duplicatesRemoved += removeDuplicateModels(world.MODELS);
  const byName = {}; world.MODELS.forEach(m => (byName[m.model] = byName[m.model] || []).push(m));
  const loader = new GLTFLoader(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  // 끊김 방지 (게임 시작 직후 버벅임): 예전엔 모든 모델이 다 오면 텍스처 업로드 + 장면 전체 셰이더 컴파일을 한 프레임에 동기로 했다 →
  //   모델을 한 프레임에 하나씩 처리하고, 새 메시는 텍스처를 먼저 올리고 셰이더를 비동기(병렬) 컴파일한 뒤에 장면에 넣는다
  let left = Object.keys(byName).length;
  const state = window.__modelLoadState = { total:left, completed:0, failed:[], active:0 };
  const done = () => { state.completed++; if (--left > 0) return; window.__modelsDone = performance.now(); setTimeout(itemUnbury,0); };
  if (!left) window.__modelsDone = performance.now();
  const queue = []; let busy = false, upTex = new Set();
  const pump = () => { if (busy || !queue.length) return; busy = true; const job = queue.shift();
    setTimeout(() => requestAnimationFrame(async () => { const t0 = performance.now(); try { await job(); } catch (e) { console.warn('[model]', e && e.message); } (window.__modelJobs ||= []).push(Math.round(performance.now() - t0)); busy = false; pump(); }), 28); };
  const stage = async (pairs) => {   // pairs: [parent, mesh]
    const texs = []; pairs.forEach(([, m]) => ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].forEach(k => { const t = m.material[k]; if (t && !upTex.has(t)) { upTex.add(t); texs.push(t); } }));
    await Promise.all(texs.map(t=>t.userData.ready).filter(Boolean));
    await textureBudget.prepareTextures(texs);
    for (let i=0;i<texs.length;i++) { if(texs[i].image) renderer.initTexture(texs[i]); await new Promise(r => requestAnimationFrame(r)); }   // 한 프레임에 텍스처 하나 (큰 텍스처 4장 동시 업로드가 끊김을 만들었다)
    pairs.forEach(([parent, m]) => parent.add(m));
  };
  // 사용자 3D 소품 133종 팩 (h133/ID): 정점 색뿐인 저폴리곤 → 면 법선 · 상자 투영 UV 를 만들고, 부품 이름으로 게임 PBR 재질을 골라 재질별로 합친다
  // (요리실 101 팩 cr101/ID: 재질 이름(steel · steel_dirty · rust …)으로 고른다)
  // (인쇄실 팩 pr/ID: 부품 이름의 재질 표기로 고르고, Z-up 으로 저장된 GLB 를 Y-up 으로 세운다)
  const h133Parts = (root, id, cr, pr) => {
    const groups = new Map();
    root.traverse(o => { if (!o.isMesh) return; const nm = (o.name || o.parent?.name || '').replace(/^\d+_/, ''), mat = pr === 'v2' ? world.v2Mat(nm) : pr ? world.prMat(nm) : cr ? world.crMat(o.material && o.material.name) : world.h133Mat(id, nm);
      const g = prepareModelGeometry(o.geometry, o.matrixWorld, pr === true);
      (groups.get(mat) || groups.set(mat, []).get(mat)).push(g); });
    const out = []; groups.forEach((gs, mat) => { const m = new THREE.Mesh(gs.length > 1 ? mergeGeometries(gs) : gs[0], mat); out.push(m); });
    return out;
  };
  const packed = name => name.startsWith('h133/') || name.startsWith('cr101/') || name.startsWith('th102/') || name.startsWith('pr/') || name.startsWith('v2/');
  // 기술·가정실 102 팩: UV 가 있는 실제 메시 — 재질별로 합쳐(그리기 호출 절약) 팩 PBR 텍스처를 입힌다
  const thParts = root => { const groups = new Map();
    root.traverse(o => { if (!o.isMesh) return; const mat = world.thMat(o.material && o.material.name);
      const g = prepareModelGeometry(o.geometry, o.matrixWorld);
      (groups.get(mat) || groups.set(mat, []).get(mat)).push(g); });
    const out = []; groups.forEach((gs, mat) => out.push(new THREE.Mesh(gs.length > 1 ? mergeGeometries(gs) : gs[0], mat))); return out; };
  const pending = Object.entries(byName);
  const requestNext = () => { if (!pending.length) return; const [name,list] = pending.shift(); state.active++;
  const finish = () => { state.active--; done(); requestNext(); };
  loader.load(name.startsWith('sf_') ? `assets/models/sf/${name}.glb` : packed(name) ? `assets/models/${name}.glb` : `assets/models/${name}/${name}.gltf`, gltf => { queue.push(async () => { try {
    const root = gltf.scene; root.updateMatrixWorld(true); const pairs = [];
    const cr = name.startsWith('cr101/') || name.startsWith('th102/');
    const parts = []; if (name.startsWith('th102/')) parts.push(...thParts(root)); else if (name.startsWith('sf_')) root.traverse(o => { if (!o.isMesh) return; const g2 = o.geometry.clone().applyMatrix4(o.matrixWorld); g2.computeBoundingBox(); g2.computeBoundingSphere(); parts.push(new THREE.Mesh(g2, o.material)); }); else if (packed(name)) parts.push(...h133Parts(root, name.split('/')[1], cr, name.startsWith('pr/') || (name.startsWith('v2/') && 'v2'))); else root.traverse(o => { if (o.isMesh) parts.push(o); });
    const byFloor = {}; list.forEach(m => (byFloor[m.f] = byFloor[m.f] || []).push(m));
    Object.entries(byFloor).forEach(([f, ms]) => {
      const parent = f === 'out' ? world.OUT : floors.find(F => String(F.f) === f).interior;
      parts.forEach(part => {
        const mat = part.material; if (mat.isMeshStandardMaterial && mat.roughness < .14) mat.roughness = .14;
        const im = new THREE.InstancedMesh(part.geometry, mat, ms.length); im.userData.dynamic = true;
        im.name = `model:${name}:${f}`; im.userData.model = name; im.userData.placements = ms;
        ms.forEach((m, i) => { _e.set(m.rx, m.ry, m.rz, 'YXZ'); _q.setFromEuler(_e); _p.set(m.x, m.y, m.z); _s.setScalar(m.s); _m.compose(_p, _q, _s).multiply(part.matrixWorld); im.setMatrixAt(i, _m); });
        im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = cr; im.receiveShadow = true;   // 큰 조리대 (요리실 팩) 만 손전등 그림자   // 작은 소품은 그림자 패스에서 제외 (프레임 안정)
        pairs.push([parent, im]);
      });
    });
    await stage(pairs);
    if (cr || name.startsWith('pr/') || name.startsWith('v2/')) floors.forEach(F => F.interior.traverse(o => { if (o.userData.cr && o.userData.cr === name.split('/')[1]) o.visible = false; }));   // 새 모델이 들어간 뒤에 같은 자리의 절차적 대체 메시를 숨긴다
    } catch(e) { state.failed.push({name,error:String(e.message || e)}); console.warn('[model]',name,e); }
    finally { finish(); } }); pump();
  }, undefined, e => { state.failed.push({name,error:String(e.message || e)}); console.warn('[model]', name, e && e.message); finish(); }); };
  for (let i = 0; i < Math.min(4,Object.keys(byName).length); i++) requestNext();
}
// 첫 화면이 늦게 뜨지 않도록 페이지 로드가 끝난 뒤에 불러온다
// Scheduled after initial world preparation below; do not wait for unrelated
// fonts/images to fire window.load before starting the furniture queue.
// 거울처럼 매끈한 재질은 손전등이 아주 가까울 때 반사광이 과하게 튄다 → 최소 거칠기 (화면이 까매지는 문제의 원인 중 하나)
scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach(m => { if (m && m.isMeshStandardMaterial && m.roughness < .14) m.roughness = .14; }); });
const _t2 = performance.now();
const fx = ENGINE.webgpu ? await createFXWebGPU(renderer, scene, camera) : createFX(renderer, scene, camera);   // 엔진별 효과 (같은 API)
// 이벤트 연출 강화: 강한 글리치에는 화면 줄무늬 흔들림, 출현 · 추격 시작에는 가장자리 붉은 맥동
const evFx = id => { if (SET.flashReduce || id==='evPulse' || id==='evStreak') return; const el = document.getElementById(id); if (!el) return; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); };
const isDialogueActive = () => isSpeechBusy() || (typeof CALL !== 'undefined' && (CALL.active || CALL.ringT > 0)) || !!document.getElementById('sub')?.classList.contains('show');
setSfxBusyCheck(isDialogueActive);
{ const g0 = fx.glitch; fx.glitch = (s = .6) => { if (isDialogueActive() && s < .9) return; g0(s); if (s >= .45) evFx('evStreak'); }; }
let hurtFx = 0, lightningT = 25, sparkT = 3;
const floors = world.floors;

/* ---------- 상태 ---------- */
let state = 'menu';            // menu | playing | paused | note | dead | won
let tNow = 0, playTime = 0;
// 플레이 시간 표시 · 누적 기록 (세이브와 별개: 엔딩을 봐도 남는다 · 테스트 모드는 별도 키)
let ptShown = -1, statAcc = 0;
const STAT_KEY = TEST ? 'haegyo_test_stats' : 'haegyo_stats';
function fmtPT(sec, words, secs) {
  sec = Math.max(0, Math.floor(sec || 0)); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s2 = sec % 60;
  if (words) return h ? `${h}시간 ${m}분${secs ? ` ${s2}초` : ''}` : secs || !m ? `${m ? m + '분 ' : ''}${s2}초` : `${m}분`;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s2).padStart(2, '0')}` : `${m}:${String(s2).padStart(2, '0')}`;
}
addEventListener('pagehide', () => statFlush());
function statRead() { try { const v = JSON.parse(localStorage.getItem(STAT_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
function statWrite(v) { try { localStorage.setItem(STAT_KEY, JSON.stringify(v)); } catch (e) { /* ignore */ } }
function statFlush() { if (statAcc <= 0) return; const v = statRead(); v.total = (v.total || 0) + statAcc; statAcc = 0; statWrite(v); }
// 엔딩: 엔딩별 최단 시간 기록 → { best: 이전 최단, isBest }
function statClear(end, fin) {
  statFlush(); const v = statRead(); v.best = v.best || {}; const prev = v.best[end], isBest = !prev || playTime < prev;
  if (isBest) v.best[end] = Math.floor(playTime); v.clears = (v.clears || 0) + 1; v.last = { end, fin, t: Math.floor(playTime), at: Date.now() }; statWrite(v);
  return { best: prev, isBest: isBest && !!prev };
}
const P = {
  x: 0, z: 77.5, floor: 0, yaw: 0, pitch: 0, light: true, breath: 100, battery: 100, stamina: 100, tired: false,
  keys: 0, hp: 100, invuln: 0, fear: 0, roofSeen: false, moving: false, sprinting: false, hiding: null, bob: 0, stepD: 0, noise: 0, fade: 0,
};
const TOTAL = KEY_NAMES.length;
const got = KEY_NAMES.map(() => false);
const inv = { battery: 0, medkit: 0, hairpin: 0, can: 0, candy: 0, thermos: 0, salt: 0, charm: 0, musicbox: 0, matches: 0, tape: 0, sedative: 0, alarm: 0, shock: 0, firstaid: 0 }, docs = [];
let gateClosed = false, gateAnim = 0, gateState = 'open';
let lookBack = 0, introT = 0, introText = false;
const CAM = { on: false, layer: 2, clues: [], arrow: null, shotCD: 0 };   // 휴대폰 야간 카메라 (아래 확장 기능)
const MIC = { on: false, level: 0, risk: 0, an: null, buf: null, ctx: null, stream: null, wave: null };
const SAN = { lvl: 0, t: 8, fov: 0, fovT: 0 };
let STH = null;   // 계단 길게 누르기 { code, dir, t }
let repelK = 0;   // 손전등 집중 조사 진행도 (0~1): 빛 색 떨림 · 시야 좁힘 · 흔들림 · 코일 소리
let blackout = 0, shake = 0, nextEvent = 40, lampTimer = 0, introDone = false, escaped = false;
const keys = {};

/* ---------- 유령 ---------- */
// 의문의 학생(유령): 10년 전 교복 — 남색 재킷 · 붉은 리본 · 주름치마 · 검은 스타킹, 얼굴을 가린 긴 머리. 반투명하게 비친다
function buildGhost() {
  const g = new THREE.Group(), inner = new THREE.Group(); g.add(inner);
  const DS = THREE.DoubleSide;
  const ghostM = (col, o = {}) => new THREE.MeshStandardMaterial({ color: col, roughness: .85, transparent: true, opacity: .9, emissive: 0x0c1218, side: DS, depthWrite: true, ...o });
  const jacket = ghostM(0x1a2030), shirt = ghostM(0x9a9c98, { emissive: 0x141818 }), skirtM = ghostM(0x2c2a34), stock = ghostM(0x0c0c10);
  const skinM = new THREE.MeshStandardMaterial({ color: 0x8c8a86, roughness: .9, emissive: 0x101214 });
  const faceM = new THREE.MeshStandardMaterial({ map: makeGhostFace(), color: 0x9a9690, roughness: .9 });
  const hairM = new THREE.MeshStandardMaterial({ map: makeHair(), color: 0x0e0c0b, roughness: .75, side: DS, alphaTest: .3 });
  const capM = new THREE.MeshStandardMaterial({ color: 0x060505, roughness: .8 });
  const ribbon = new THREE.MeshStandardMaterial({ color: 0x6a1018, roughness: .6, emissive: 0x1a0204 });
  const part = (geo, m, x, y, z, p = inner) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); p.add(o); return o; };
  // 다리 (검은 스타킹 · 발끝이 바닥에서 살짝 뜬다)
  [-1, 1].forEach(s => { const l = part(new THREE.CylinderGeometry(.052, .04, .78, 12), stock, s * .085, .55, 0); l.rotation.z = s * .02; part(new THREE.BoxGeometry(.08, .05, .2), stock, s * .085, .15, -.03); });
  // 주름치마: 각진 원뿔 + 주름 굴곡
  const sk = new THREE.CylinderGeometry(.17, .29, .38, 24, 2, true), sp = sk.attributes.position;
  for (let i = 0; i < sp.count; i++) { const x = sp.getX(i), z = sp.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z), k = 1 + .06 * Math.sign(Math.sin(a * 12)) * (sp.getY(i) < 0 ? 1 : .3); sp.setXYZ(i, Math.cos(a) * r * k, sp.getY(i), Math.sin(a) * r * k); }
  sk.computeVertexNormals(); part(sk, skirtM, 0, 1.02, 0);
  // 몸통: 셔츠 + 재킷 + 리본
  const torso = new THREE.LatheGeometry([[.12, 0], [.165, .05], [.175, .25], [.16, .42], [.12, .5], [.05, .53]].map(p => new THREE.Vector2(p[0], p[1])), 20);
  const t = part(torso, jacket, 0, 1.18, 0); t.scale.set(1, 1, .72);
  part(new THREE.BoxGeometry(.1, .2, .02), shirt, 0, 1.55, -.115);
  const rb = part(new THREE.BoxGeometry(.12, .045, .03), ribbon, 0, 1.63, -.13); [-1, 1].forEach(s => { const tl = part(new THREE.BoxGeometry(.03, .1, .02), ribbon, s * .02, 1.57, -.135); tl.rotation.z = s * .25; }); rb.rotation.z = .05;
  part(new THREE.CylinderGeometry(.04, .05, .12, 10), skinM, 0, 1.75, 0);
  // 머리: 고개를 숙이고, 앞머리가 얼굴을 덮는다
  const head = new THREE.Group(); head.position.set(0, 1.86, 0); head.rotation.x = .32; inner.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(.105, 24, 18), faceM); face.scale.set(.88, 1.12, .95); head.add(face);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.118, 18, 14, 0, Math.PI * 2, 0, Math.PI * .62), capM); cap.position.set(0, .015, .01); cap.rotation.x = -.3; head.add(cap);
  const hair = [];
  const strand = (a, w, L, fwd = 0) => {
    const pg = new THREE.PlaneGeometry(w, L, 1, 6); pg.translate(0, -L / 2, 0);
    const m = new THREE.Mesh(pg, hairM); const r = .112 + fwd;
    m.position.set(Math.sin(a) * r, .06, Math.cos(a) * r); m.rotation.order = 'YXZ'; m.rotation.y = a; m.rotation.x = fwd ? -.2 : -.12; head.add(m); hair.push(m); return m;
  };
  for (let i = 0; i < 26; i++) strand(Math.PI * (.3 + i / 25 * 1.4), .1 + Math.random() * .05, .75 + Math.random() * .35);
  [-.5, -.28, -.08, .12, .32, .52].forEach((a, i) => strand(a + Math.PI, .07, .62 + (i % 2) * .1, .01));   // 얼굴을 가리는 앞머리
  // 팔: 소매 + 창백한 손, 손가락
  const arms = [];
  [-1, 1].forEach(s => {
    const sh = new THREE.Group(); sh.position.set(s * .2, 1.62, 0); inner.add(sh);
    part(new THREE.CylinderGeometry(.045, .04, .3, 10), jacket, 0, -.15, 0, sh);
    const el = new THREE.Group(); el.position.y = -.3; el.rotation.x = -.25; sh.add(el);
    part(new THREE.CylinderGeometry(.04, .035, .26, 10), jacket, 0, -.12, 0, el);
    part(new THREE.CylinderGeometry(.024, .018, .1, 8), skinM, 0, -.29, 0, el);
    const hand = part(new THREE.BoxGeometry(.045, .08, .02), skinM, 0, -.38, 0, el);
    for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.CylinderGeometry(.005, .003, .1, 4), skinM); f.position.set(-.016 + k * .011, -.46, 0); f.rotation.z = (k - 1.5) * .06; el.add(f); }
    sh.rotation.set(-.15, 0, s * .06); arms.push(sh);
  });
  inner.position.y = .1;   // 살짝 떠 있다
  // 조명은 그룹 밖(씬)에 항상 둔다 — 보였다 안 보였다 하면 조명 개수가 바뀌어 모든 셰이더가 다시 컴파일되며 크게 끊긴다
  const glow = new THREE.PointLight(0x6a8aa8, 0, 5); scene.add(glow);
  g.visible = false; scene.add(g);
  return { group: g, inner, head, arms, hair, glow };
}
const ghost = {
  ...buildGhost(), active: false, floor: 1, x: -30, z: 0, yaw: 0, state: 'patrol', path: [], target: null, wait: 2,
  lose: 0, away: 0, replan: 0, enraged: false, stepT: 0, findT: 0, hunt: null, speedMul: 1, spawnGrace: 0,
};

function ghostLeave() {
  const G = ghost, opts = [0, 1, 2, 4].filter(f => f !== P.floor);
  G.floor = opts[(Math.random() * opts.length) | 0]; G.state = 'patrol'; G.path = []; G.hunt = null; G.away = 0; G.warned = false; G.visitT = 0; G.chaseT = 0;
  const n = floors[G.floor].nodes[0]; if (n) { G.x = n.x; G.z = n.z; }
  if (state === 'playing') { sfx.stairs(); caption('발소리가 계단 쪽으로 멀어진다'); }
}
function ghostRelocate() {}   // 귀신 삭제: 아무것도 나타나지 않는다

function ghostTick(dt, t) {}

scene.traverse(o => {
  if (!o.isMesh) return;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  if (m.isMeshBasicMaterial || m.transparent) return;
  o.castShadow = true; o.receiveShadow = true;
});

function ghostVisual(dt, t) {
  const G = ghost; G.group.visible = false; G.glow.intensity = 0; return;   // 귀신 삭제
  G.group.visible = G.floor === P.floor && !(P.floor === 0 && P.z > 1.9 && G.z > 1.8 && false);
  G.group.position.set(G.x, floors[G.floor].y0 + .08 + Math.sin(t * 2) * .05, G.z);
  G.group.rotation.y = G.yaw;
  const chasing = G.state === 'chase' || G.hunt;
  G.inner.rotation.z = Math.sin(t * 1.7) * .05;
  G.head.rotation.z = Math.sin(t * .9) * .15 + (chasing ? Math.sin(t * 30) * .06 : 0);
  G.inner.position.x = chasing ? (Math.random() - .5) * .04 : 0;
  G.arms.forEach((a, i) => { a.rotation.x = -.35 + Math.sin(t * (chasing ? 7 : 1.4) + i * 2) * (chasing ? .5 : .12) - (chasing ? .6 : 0); });
  G.glow.position.set(G.x, floors[G.floor].y0 + 1.8, G.z);
  G.glow.intensity = G.group.visible ? .5 + .4 * Math.sin(t * 5) : 0;
  G.hair.forEach((h, i) => { h.rotation.z = Math.sin(t * (chasing ? 6 : 1.3) + i * .7) * (chasing ? .12 : .04); });
}

/* ---------- UI ---------- */
let msgTimer = 0;
const SEEN_T = new Map();   // 같은 문장이 짧은 시간 안에 되풀이되지 않게 (say 4초 · caption 25초)
const recent = (k, sec) => { const now = performance.now(), t = SEEN_T.get(k); if (t && now - t < sec * 1000) return true; SEEN_T.set(k, now); if (SEEN_T.size > 300) SEEN_T.clear(); return false; };
const _sayQueue = [];
function say(text, ms = 3000) {
  if (recent('s:' + text, 4)) return;
  if (isDialogueActive()) {
    if (!_sayQueue.some(q => q.text === text)) _sayQueue.push({ text, ms });
    return;
  }
  const m = $('msg'); m.textContent = text; m.classList.add('show'); clearTimeout(msgTimer);
  msgTimer = setTimeout(() => {
    m.classList.remove('show');
    if (_sayQueue.length && !isDialogueActive()) { const nx = _sayQueue.shift(); setTimeout(() => say(nx.text, nx.ms), 250); }
  }, ms);
}
setInterval(() => {
  if (_sayQueue.length && !isDialogueActive() && !$('msg')?.classList.contains('show')) {
    const nx = _sayQueue.shift(); say(nx.text, nx.ms);
  }
}, 400);
/* ----- 목표 · 챕터 ----- */
const LOC = {
  entrance: { f: 0, x: 0, z: 2.5, where: '본관 현관' }, cam: { f: 0, x: 10.95, z: -8.55, where: '본관 1층 · 1-1 교실' },
  office: { f: 0, x: -8, z: -5.5, where: '본관 1층 · 교무실' }, gate: { f: 0, x: 0, z: GATE_Z - 2.5, where: '정문' },
  tag: { f: 4, x: 29, z: -4.5, where: '지하 B1 · 펌프실' }, breaker: { f: 4, x: -19, z: -5.4, where: '지하 B1 · 전기실' },
  console: { f: 2, x: -25.1, z: -7, where: '본관 4층 · 방송실' }, mina: { f: 2, x: -21.7, z: -8.1, where: '본관 4층 · 방송실 장비실' },
};
const KEY_WHERE = [
  '본관 1층 · 교무실 금고 (제1비밀: 펌프실 열쇠 은닉 기록)',
  '별관 2층 · 도서실 대출 데스크 (제2비밀: 하교 위조 대출 카드)',
  '별관 2층 · 과학실 약품장 (제3비밀: 묵살된 배선·비상등 결함 보고서)',
  '체육관 · 기록석 기구함 (제4비밀: 담력체험 묵인 및 당직 은폐 일지)',
  '수영장 · 배수구 (제5비밀: 물길에 버려진 펌프실 침수·방치 증거)'
];
const KEY_HINT = [
  '금고 번호: 참사 당일 날짜(1012)',
  '잠긴 서랍 — 머리핀으로 개봉',
  '다이얼 — 칠판 원주율 메모(314)',
  '다이얼 — 전광판 마지막 점수',
  '갈고리 장대 필요 — 대걸레 자루(지하 청소도구실) + 철사(별관 1층 가정실)'
];
function objective() { const o = objective0(); return o && o.loc && typeof liveLoc === 'function' ? { ...o, loc: liveLoc(o.loc) } : o; }
function objective0() {
  if (FL.gatePower) return { ch: 6, main: FL.mina ? '학교의 모든 비밀을 밝혔다 — 민아와 함께 정문 밖 세상으로 나가 폭로하자' : '봉인이 풀린 정문을 통해 세상에 학교의 비밀을 알리자', loc: LOC.gate, subs: [['서문고 은폐 사건 진상 규명 완료', true], ['정문 밖으로 나가 세상에 진실 폭로하기', false]] };
  const n3 = docs.some(d => d.id === 'n3');
  if (!FL.mina && !FL.cam && P.keys === 0) { const inCampusNow = (typeof gateClosed !== 'undefined' && gateClosed) || (typeof introDone !== 'undefined' && introDone) || P.floor !== 0 || P.z < (typeof GATE_Z !== 'undefined' ? GATE_Z - 2.5 : 67.5); return { ch: 1, main: inCampusNow ? '1998년 그날 밤의 비밀을 조사하러 들어간 민아 선배의 캠코더를 찾아라' : '밤의 학교 안으로 들어가 10년 전 은폐된 사건의 첫 단서를 찾아라', loc: inCampusNow ? LOC.cam : LOC.entrance,
    subs: [['본관 진입 및 단서 수색', introDone], ['1-1 교실에서 민아의 캠코더 영상 확인하기', FL.cam]] }; }
  if (!got[0]) return { ch: 2, main: '교무회의록과 경비실·교장실 기록으로 참사 당일(1012) 금고를 열어 제1비밀 증거를 확보하라', loc: LOC.office,
    subs: [['민아의 캠코더 녹화 확인', FL.cam], ['교무회의록 · 심야 은폐 기록 읽기', n3], ['교무실 금고(1012) 열기 — 제1비밀 증거 확보', got[0]]] };
  if (P.keys < TOTAL) {
    const left = KEY_ROOMS.map((r, i) => ({ ...r, i })).filter(r => !got[r.i]);
    const k = left.find(r => r.f === P.floor) || left[0];
    const subs = KEY_NAMES.map((n, i) => [`[${i + 1}번째 비밀 · ${n}] ${KEY_HINT[i]}`, got[i]]);
    if (!got[4] && !FL.hook) {
      subs.push(['  ↳ 대걸레 자루 — 지하 B1 청소도구실', FL.mop], ['  ↳ 철사 뭉치 — 별관 1층 가정실', FL.wire], ['  ↳ 소지품(Tab)에서 둘을 조합 → 갈고리 장대', false]);
      if (k.i === 4 || left.length === 1) {
        const tl = n => { const it = world.items.find(i => i.kind === n); return it && { f: it.floor, x: it.pos.x, z: it.pos.z }; };
        if (!FL.mop) return { ch: 3, main: `수영장 배수구의 5번째 비밀 증거를 건져낼 갈고리 재료를 찾아라 (${P.keys}/${TOTAL})`, loc: { ...tl('mop'), where: '지하 B1 · 청소도구실 — 대걸레 자루' }, subs };
        if (!FL.wire) return { ch: 3, main: `수영장 배수구의 5번째 비밀 증거를 건져낼 갈고리 재료를 찾아라 (${P.keys}/${TOTAL})`, loc: { ...tl('wire'), where: '별관 1층 · 가정실 — 철사 뭉치' }, subs };
        return { ch: 3, main: '소지품(Tab) › 핵심 증거 탭에서 대걸레 자루와 철사를 조합하라', loc: null, subs };
      }
    }
    return { ch: 3, main: `다섯 교직원이 숨긴 학교의 5대 은폐 비밀 증거를 찾아내라 (${P.keys}/${TOTAL})`, loc: { ...keyLoc(k), where: `${KEY_WHERE[k.i]} — ${KEY_HINT[k.i]}` }, subs };
  }
  if (!FL.gatekey && !FL.keyhead) {
    const s = (FL.sq && FL.sq.head) || 0, st = HEADQUEST.steps[Math.min(s, HEADQUEST.steps.length - 1)], hp = world.props.find(q => q.uid === `sq:head:${s}`);
    return { ch: 4, main: s === 0 ? '5대 비밀 증거를 결속할 교장 직인 코어가 없다 — 교장실 비밀 수첩을 조사하라' : '별관의 봉인된 보안 기록과 CCTV를 복구해 교장 직인 마스터 코어를 찾아라', loc: hp ? { f: hp.floor, x: hp.x, z: hp.z, where: st.where } : null,
      subs: HEADQUEST.steps.map((x, i) => [x.goal, s > i]) };
  }
  if (!FL.gatekey) return { ch: 5, main: '소지품(Tab)에서 5대 비밀 증거 조각과 교장 직인 코어를 조합해 『서문고 진상 규명 기록부』를 완성하라', loc: null, subs: [[`학교 5대 비밀 증거 (${TOTAL}/${TOTAL})`, true], ['교장 직인 마스터 코어', true], ['서문고 진상 규명 마스터 기록부 완성하기', false]] };
  if (!FL.mina) {
    const i=optSteps().indexOf(false), steps=['지하 펌프실에서 윤하늘의 명찰로 진실 확인','지하 전기실 예비 퓨즈와 차단기로 본관 전력 복구','4층 방송실에서 1998년 하교 방송 및 은폐 진실 송출','방송실 장비실에서 민아 선배 구출'];
    const fuse=world.items.find(it=>it.kind==='fuse');
    const loc=i===1&&!FL.fuse&&fuse?{f:fuse.floor,x:fuse.pos.x,z:fuse.pos.z,where:'예비 퓨즈 — 지하 창고'}:optLoc();
    return {ch:6,main:'4층 방송실에서 학교가 숨긴 1998년 10월 12일의 진실을 폭로 방송으로 송출하고 민아 선배를 구출하라',loc,subs:steps.map((t,k)=>[t,optSteps()[k]])};
  }
  return {ch:6,main:'학교의 모든 비밀을 규명했다 — 민아 선배와 함께 정문 밖으로 나가 세상에 진실을 폭로하라',loc:LOC.gate,subs:[['진상 규명 기록부 완성 및 민아 구출',true],['정문을 열고 세상에 학교의 비밀 폭로하기',false]]};
}
function missionGroups() { return buildMissionGroups({flags:FL,documents:docs,quests:SIDEQUESTS,objective:objective()}); }
function optSteps() { return [FL.tag, power, FL.calm, FL.mina]; }
function optLoc() { const s = optSteps(), i = s.indexOf(false); if (i < 0) return null;
  if (i <= 1 && !FL.b1Open) { if (!got[0]) return { ...LOC.office, where: '본관 1층 · 교무실 금고 — 지하 B1 철문 열쇠 꾸러미 (번호: 참사 당일 날짜)' }; const d = world.props.find(q => q.kind === 'b1door'); if (d) return { f: d.floor, x: d.x, z: d.z, where: '지하 B1 · 쇠사슬 철문 — 금고에서 나온 열쇠로 열기' }; }
  return [LOC.tag, LOC.breaker, LOC.console, LOC.mina][i]; }
function unlockOptional() {
  if (FL.opt) return; FL.opt = true;
  setTimeout(() => toast('수색 단서가 연결되었습니다', '그날의 방송을 복원하면 선배가 멈춘 기억을 풀 수 있을지도 모른다', 'opt'), 1200); refreshHud();
}
function showChapter(n) {
  const c = CHAPTERS[n - 1]; if (!c) return;
  $('ccNum').textContent = `CHAPTER ${n}`; $('ccTitle').textContent = c.title.split('·')[1].trim();
  const el = $('chapterCard'); el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 3800);
}
// 목표 바 모드: 펼침 → 한 줄(상태 표시줄) → 숨김 → 펼침 (J 키 · 버튼). 새 목표가 생기면 접혀 있어도 4.5초 동안 펼쳐 보여 준다
const OBJ_MODES = ['full', 'compact', 'hidden'], OBJ_ICON = { full: '▾', compact: '▸', hidden: '◂' };
let objPeekT = 0, objLastMain = null;
function objApply() {
  const m = OBJ_MODES.includes(SET.objMode) ? SET.objMode : 'full', peek = objPeekT > performance.now(), el = $('objP');
  const eff = peek ? 'full' : m;
  el.classList.toggle('compact', eff === 'compact'); el.classList.toggle('hidden', eff === 'hidden'); el.classList.toggle('peek', peek && m !== 'full');
  $('objTab').classList.toggle('on', eff === 'hidden'); $('objTogI').textContent = OBJ_ICON[m];
}
function objModeCycle() { SET.objMode = OBJ_MODES[(OBJ_MODES.indexOf(SET.objMode) + 1) % OBJ_MODES.length]; saveSET(); objPeekT = 0; objApply(); sfx.ui && sfx.ui(); toast('목표 바', { full: '펼침', compact: '한 줄로 접기', hidden: '숨김 — O 키로 다시 펼치기' }[SET.objMode], 'info'); }
function objMini(o) {
  $('omCh').textContent = 'CH ' + o.ch; $('omText').textContent = o.main;
  const n = o.subs.length, d = o.subs.filter(s => s[1]).length; $('omProg').textContent = n ? `${d}/${n}` : '';
  if (objLastMain !== null && objLastMain !== o.main && SET.objMode !== 'full') { objPeekT = performance.now() + 4500; setTimeout(objApply, 4600); }
  objLastMain = o.main; objApply();
}
$('objTog').onclick = e => { e.stopPropagation(); objModeCycle(); };
$('objTab').onclick = e => { e.stopPropagation(); SET.objMode = 'hidden'; objModeCycle(); };
// 목표 바: 끝낸 항목은 '완료된 목표' 목록으로 빼고, 지금 할 일만 남긴다 (주 미션 · 선택 미션 · 의뢰 · 구역 미션별). 완료 목록은 저장되고 클릭(또는 K 키)으로 펼친다
const DONE_SEC = { subs: '메인 미션', optSubs: '특별 미션', sqSubs: '서브 미션', zoneSubs: '서브 미션 · 구역', phSubs: '서브 미션 · 사진' };
let objDoneOpen = false;
function objDoneSplit() {
  FL.doneLog = normalizeCompletedLog(FL.doneLog);
  Object.entries(DONE_SEC).forEach(([id, sec]) => {
    const el = $(id); if (!el) return;
    el.querySelectorAll('.chk.done').forEach(c => { const t = c.textContent.trim(); recordCompleted(FL.doneLog, sec, t, objective().ch); c.remove(); });
    const box = id === 'subs' ? null : el.parentElement;   // 남은 항목이 없는 상자는 숨긴다 (주 미션 목록은 메인 목표 아래라 그대로)
    if (box && box.style.display !== 'none' && !el.children.length) box.style.display = 'none';
  });
  let d = $('objDone');
  if (!d) { d = document.createElement('div'); d.id = 'objDone'; $('objP').appendChild(d); d.onclick = e => { e.stopPropagation(); objDoneOpen = !objDoneOpen; objDoneSplit(); }; }
  const L = FL.doneLog, by = {};
  L.forEach(x => (by[x.s] ||= []).push(x.t));
  d.style.display = L.length ? '' : 'none';
  d.innerHTML = `<b>✓ 완료된 목표 ${L.length}</b> <span class="odT">${objDoneOpen ? '▾ 접기' : '▸ 펼치기'} <kbd>K</kbd></span>` + (objDoneOpen ? Object.entries(by).map(([sec, ts]) => `<div class="odS">${sec}</div>` + ts.slice(-8).map(t => `<div class="chk done">${t}</div>`).join('')).join('') : '');
}
function refreshHud() {
  const o = objective();
  if (o.ch !== chapterShown) { const prev = chapterShown; chapterShown = o.ch; if (prev && state === 'playing') { showChapter(o.ch); sfx.alert && o.ch > 1 && toast('새로운 장', CHAPTERS[o.ch - 1].title, 'info'); } }
  $('chapter').textContent = CHAPTERS[o.ch - 1].title;
  $('objText').textContent = o.main; $('objWhere').textContent = o.loc ? '📍 ' + o.loc.where : '';
  objMini(o);
  $('subs').innerHTML = o.subs.map(([t, d]) => `<div class="chk${d ? ' done' : ''}">${t}</div>`).join('');
  $('optBox').style.display = FL.opt ? 'block' : 'none';
  const special=missionGroups()[2];
  $('optTitle').textContent = special.title;
  $('optSubs').innerHTML = special.items.map(t=>`<div class="chk${t.done?' done':''}">${t.title}${t.progress?` (${t.progress})`:''}</div>`).join('');
  sqSync(); const aq = SIDEQUESTS.filter(q => sqStep(q.id) > 0 && sqStep(q.id) < q.steps.length);
  zoneHud(); pqHud();
  $('sqBox').style.display = aq.length || sqDoneCount() ? 'block' : 'none'; $('sqTitle').textContent = `서브 미션 · 남겨진 부탁 (${sqDoneCount()}/${SIDEQUESTS.length})`;
  $('sqSubs').innerHTML = aq.slice(0, 3).map(q => `<div class="chk">${q.title} — ${q.steps[sqStep(q.id)].goal}</div>`).join('') + (aq.length > 3 ? `<div class="chk" style="opacity:.6">외 ${aq.length - 3}건 (휴대폰 › 사건)</div>` : '');
  $('c2').textContent = inv.battery; $('c3').textContent = inv.medkit; $('c5').textContent = inv.can; $('s5').classList.toggle('off', !inv.can); $('c4').textContent = FL.gatekey ? '진상완성' : `비밀 ${P.keys}/${TOTAL}`;
  $('s2').classList.toggle('off', !inv.battery); $('s3').classList.toggle('off', !inv.medkit); $('s4').classList.toggle('off', !P.keys);
  objDoneSplit();
  const un = msgs.filter(m => !m.read).length; $('phoneBadge').textContent = un; $('phoneBadge').classList.toggle('on', un > 0);
  const con = world.props.find(p => p.kind === 'console'); if (con) con.label = FL.calm ? '방송 장비 (조용하다)' : FL.tag && power ? '하늘을 위해 하교 방송하기' : '방송 장비 사용';
}
function toast(title, desc = '', kind = '') {
  const t = document.createElement('div'); t.className = 'toast panel ' + kind; t.innerHTML = `<b>${title}</b>${desc}`;
  $('toasts').appendChild(t); setTimeout(() => t.remove(), 4200);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
}
let talkTimer = 0, talkRequest = 0;
// 주인공 대사: story.js LINES 의 id 로 부른다 (선택한 캐릭터의 대사 · 목소리)
function talk(id, ms = 3200) {
  const request = ++talkRequest;
  const L = LINES[id], text = L ? L[CK()] : id;
  logLine(CH().name, text);
  $('dlgText').textContent = text; $('dlgName').textContent = CH().name;
  $('dlg').classList.toggle('show', VS.subs || !VS.dub); clearTimeout(talkTimer);
  talkTimer = setTimeout(() => $('dlg').classList.remove('show'), ms);
  const vid = L && `l_${id}_${CK()}`;
  if (vid && lineInfo(vid)) speak(vid).then(sec => { if (request !== talkRequest) return; clearTimeout(talkTimer); talkTimer = setTimeout(() => $('dlg').classList.remove('show'), Math.max(ms, sec * 1000 + 700)); });
}
// 이야기 장면(녹화 · 녹음 · 메시지 · 문서 · 퍼즐) 직후 잠시 그것이 물러나 있게 한다
function storyCalm(sec = 40) { ghost.calmT = Math.max(ghost.calmT || 0, sec); if (ghost.active && !ghost.enraged && ghost.floor === P.floor && ghost.state !== 'chase') { ghost.state = 'patrol'; ghost.path = []; ghost.wait = 3; } }
function addClue(id) { storyCalm(30); if (clues.includes(id)) return; clues.push(id); }
// 게임 시각: 17:50 에 도착, 해가 지는 동안 한 시간 남짓 흐르고, 이후 실제 1분 = 게임 4분 (한 시간 플레이 ≈ 23시)
const gameMin = (extra = 0) => Math.floor(17 * 60 + 50 + (playTime + extra) * 4 / 60 + 70 * (1 - DAY.k / .92));
function clockText(extra = 0) { const m = gameMin(extra), h = Math.floor(m / 60) % 24; return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }

/* ----- 문서 (쪽지 · 사진 · 녹음 · 캠코더) ----- */
function docInfo(d) {
  if (d.kind === 'note') { const n = d.id === 'nC' ? CHAR_NOTE[CK()] : world.NOTES[d.id]; const nv = noteVoiceFor(d.id); return n && { icon: '📄', title: n.title, text: n.text, tape: nv.id, fx: nv.fx, spk: nv.who }; }
  if (d.kind === 'photo') { const p = world.PHOTOS[d.id]; return p && { icon: '🖼', title: p.title, text: p.text, img: p.img }; }
  if (d.kind === 'tape') { const t = world.TAPES[d.id]; const i = lineInfo(d.id) || VO[d.id]; return t && { icon: '📼', title: t.title, text: i ? i.text : '', tape: d.id, spk: '📼 ' + t.spk }; }
  if (d.kind === 'cam') return { icon: '📹', title: '캠코더 녹화 — 민아', text: VO.cam1.text, tape: 'cam1', spk: '📹 민아', fx: 'phone' };
  return null;
}
function addDoc(d) { if (docs.some(x => x.id === d.id)) return; const i = docInfo(d); if (i) docs.push({ ...d, ...i }); }
const DOC_TOTAL = () => world.items.filter(i => i.kind === 'note' || i.kind === 'photo').length + Object.keys(world.TAPES).length + 1;
async function playCam() {
  const epoch=storySession;
  storyCalm(45);
  const sec = await line('cam1', 'phone', '📹 민아 (녹화)');
  setTimeout(() => { if (epoch===storySession&&(state === 'playing' || state === 'ui')) talk('afterCam', 3200); }, (sec + .6) * 1000);
}

/* ----- 소지품 ----- */
let invTab = 'items', invSel = 0, combineFrom = null, invMsg = '', mapFloor = 0;
const TABS = ['items', 'docs', 'keys', 'col', 'craft'];
const iconHTML = ic => /^[a-z_0-9]+$/.test(ic) ? `<img src="assets/ui/${ic}.webp" alt="">` : ic;
function bagList() {
  const L = CH().items.map(id => ({ id }));
  if (inv.battery) L.push({ id: 'battery', n: inv.battery });
  if (inv.medkit) L.push({ id: 'medkit', n: inv.medkit });
  if (FL.gatekey) L.push({ id: 'gatekey' });
  if (FL.keyhead && !FL.gatekey) L.push({ id: 'keyhead' });
  if (P.keys && !FL.gatekey) L.push({ id: 'keypiece', n: P.keys });
  if (inv.hairpin) L.push({ id: 'hairpin', n: inv.hairpin });
  if (inv.can) L.push({ id: 'can', n: inv.can });
  ['candy', 'thermos', 'tape', 'sedative', 'firstaid'].forEach(k => { if (inv[k]) L.push({ id: k, n: inv[k] }); });   // 사물함 수색 · 방 이벤트 소모품
  if (FL.tag) L.push({ id: 'nametag' });
  ['hook', 'fuse', 'mop', 'wire'].forEach(k => { if (FL[k]) L.push({ id: k }); });
  if (FL.cam) L.push({ id: 'camcorder' });
  if (FL.fz && FL.fz.scienceAcidCrafted && !FL.fz.rooftopDoorMelted) L.push({ id: 'acid' });   // 구역 미션 열쇠 아이템
  if (FL.fz && FL.fz.frozenKeyObtained && !FL.fz.frozenKeyMelted) L.push({ id: 'frozenkey' });
  ['tapeTrio', 'emBattery', 'bookHome', 'letterT'].forEach(k => { if (FL.qi && FL.qi[k]) L.push({ id: k }); });   // 의뢰 아이템
  return L.map(x => ({ ...ITEMS[x.id], ...x }));
}
function itemDesc(it) {
  if (it.id === 'flashlight') return `${it.desc}<br>배터리 <b>${Math.round(P.battery)}%</b> · ${P.light ? '켜짐' : '꺼짐'}`;
  if (it.id === 'keypiece') return `${it.desc}<br>확보한 학교 비밀 증거: <b>${P.keys} / ${TOTAL}</b>`;
  return it.desc;
}
const USE = {
  flashlight: () => { P.light = !P.light; sfx.click(); return P.light ? '손전등을 켰다.' : '손전등을 껐다.'; },
  battery: () => (useBattery() ? '손전등에 건전지를 넣었다.' : ''),
  medkit: () => (useMedkit() ? '응급 밴드를 붙였다.' : ''),
  camcorder: () => { closeUI(); playCam(); },
  phone_jihun: () => { closeUI(); openPhone('msg'); }, phone_seoyeon: () => { closeUI(); openPhone('msg'); },
  memo_jihun: () => { closeUI(); openPhone('memo'); }, memo_seoyeon: () => { closeUI(); openPhone('memo'); },
  keypiece: () => { startCombine('keypiece'); return '비밀 증거 조각과 교장 직인 코어를 맞춰 보자 — 결합할 대상을 선택'; },
  gatekey: () => { closeUI(); window.__showSchoolTruthDossier(); return '1998 서문고 진상 규명 마스터 기록부를 열람합니다.'; },
  candy: () => { inv.candy--; P.stamina = 100; P.tired = false; P.fear = Math.max(0, P.fear - .3); sfx.pickup(); refreshHud(); return '사탕을 깨물었다. 단맛에 숨이 돌아온다.'; },
  thermos: () => { inv.thermos--; P.hp = Math.min(100, P.hp + 20); calmDown(30, '따뜻한 차가 목을 타고 내려간다'); refreshHud(); return '유자차를 마셨다. 체력 +20'; },
  nametag: () => (power ? '4층 방송실에서 폭로 방송을 할 때 이 이름을 제대로 불러 줄 수 있다.' : '방송실 장비를 쓰려면 먼저 전기를 살려야 한다.'),
  necklace: () => '“첫 녹음 기념. 우리 방송, 오래 하자.” — 민아',
  keys_jihun: () => '민아가 맡겨 둔 열쇠. 꼭 돌려줘야 한다.',
  hairpin: () => '잠긴 서랍이나 보관함 앞에서 E — 자물쇠 따기',
  can: () => { closeUI(); setTimeout(throwCan, 80); },
  tape: () => { startCombine('tape'); return '빈 캔과 묶어 볼까?'; }, sedative: () => { startCombine('sedative'); return '응급 밴드와 함께 쓰면 좋겠다'; },
  alarm: () => { closeUI(); setTimeout(placeAlarm, 80); }, shock: () => { closeUI(); setTimeout(throwShock, 80); }, firstaid: () => useFirstAid(),
  fuse: () => '지하 전기실 주 차단기에 끼울 수 있다.',
  hook: () => '수영장 배수구에서 쓸 수 있다.',
  mop: () => { startCombine('mop'); return '무엇과 묶을까?'; }, wire: () => { startCombine('wire'); return '무엇에 감을까?'; },
};
const canCombine = id => RECIPES.some(r => r.a === id || r.b === id);
function craftNow() { const r = craftingSystem.recipes[invSel]; if (!r) return; const ok = craftingSystem.craft(r.resultId, m => { invMsg = m; }); if (ok) { newItems.add({ trap_can: 'alarm', short_bomb: 'shock', med_kit: 'firstaid' }[r.resultId]); refreshHud(); } else sfx.buzz(); renderInv(); }
function startCombine(id) { combineFrom = id; invMsg = `「${ITEMS[id].name}」과(와) 조합할 아이템을 고르세요 · Esc 취소`; renderInv(); }
function tryCombine(a, b) {
  combineFrom = null;
  const r = RECIPES.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  if (!r) { talk('combineFail', 2200); invMsg = '이 둘은 함께 쓸 수 없다.'; sfx.buzz(); renderInv(); return; }
  if (r.fn === 'recharge') invMsg = useBattery() ? '손전등 배터리를 갈아 끼웠다.' : '';
  else if (r.fn === 'hook') { FL.hook = true; FL.mop = false; FL.wire = false; newItems.add('hook'); sfx.hook(); invMsg = '대걸레 자루에 철사를 감아 갈고리 장대를 만들었다!'; talk('hookMade', 3000); toast('조합 성공', '갈고리 장대 — 수영장 배수구에서 사용'); save(true); }
  else if (CRAFT_ID[r.fn]) { const ok = craftingSystem.craft(CRAFT_ID[r.fn], m => { invMsg = m; }); if (ok) { newItems.add(r.fn); toast('조합 성공', ITEMS[r.fn].name, 'info'); refreshHud(); } else sfx.buzz(); }
  else if (r.fn === 'gatekey') {
    if (P.keys < TOTAL) { invMsg = `학교 비밀 증거 조각이 부족하다 — ${P.keys} / ${TOTAL}`; sfx.buzz(); }
    else if (!FL.keyhead) { invMsg = '5대 비밀 증거는 모였으나 이를 결속할 교장 직인 마스터 코어가 없다.'; sfx.buzz(); talk('headMissing', 3000); }
    else { makeGateKey(); invMsg = '5대 비밀 증거와 교장 직인 코어가 결합되어 『서문고 진상 규명 마스터 기록부』가 완성되었다!'; }
  }
  renderInv();
}
// 점프: 앉아 있으면 일어서며 뛴다 · 숨이 차면 낮게 뛴다 (예전엔 아무 반응 없이 무시돼 '점프가 안 된다'로 보였다)
//   착지 직전에 누른 입력은 잠깐 기억했다가 착지하자마자 뛴다
let jumpBuf = 0;
function tryJump() {
  if (P.hiding) return;
  if (Math.abs(P.vy || 0) > .01) { jumpBuf = .18; return; }
  P.crouch = false;
  const weak = P.tired || P.stamina < 8;
  P.vy = weak ? 3.2 : 4.7; P.jy = (P.jy || 0) + .001; P.stamina = Math.max(0, P.stamina - (weak ? 2 : 8)); sfx.throwIt();
  if (weak) say('숨이 차서 높이 뛸 수 없다', 1400);
}
window.__showSchoolTruthDossier = () => {
  showNote({
    title: '📁 『1998 서문고등학교 심야 참사 완전 진상 규명 기록부』',
    text: [
      '<div style="background:#1d1916;color:#f2ead8;padding:12px 14px;border:1px solid #b58c44;margin-bottom:10px;font-size:13px;line-height:1.55;">',
        '<b style="color:#ff8066;font-size:15px;">■ 사건 실체: 1998년 10월 12일 밤 윤하늘(3-2) 지하 펌프실 감금·침수 사망 및 학교 측 5인 조직적 은폐</b><br>',
        '단순 가출·실종으로 발표되었던 1998년 서문고 방송부 윤하늘 실종 사건은 학내 폭력(담력체험 감금), 시설 안전 방치(비상등·펌프 배선 합선), 그리고 교장 이하 5인의 책임자가 학교 명예를 위해 구조 골든타임을 포기하고 기록을 조작한 <b>조직적 은폐 범죄</b>임이 최종 규명되었다.',
      '</div>',
      '<b>1. [교무실 비밀 증거]</b> 교무부장은 방송부장 이준호에게서 지하 펌프실 철문 열쇠를 건네받고도 “버릇을 고쳐준다”며 방치했고, 정전 직후 경비원이 열쇠를 요청했으나 문을 열지 않고 은폐를 주도함.<br>',
      '<b>2. [도서실 비밀 증거]</b> 사서는 교장의 지시로 『집으로 가는 길』 대출 카드를 사후 위조하여 윤하늘이 하교 도중 실종된 것처럼 알리바이를 조작함.<br>',
      '<b>3. [과학실 비밀 증거]</b> 지하 펌프실 노후 배선 및 비상등 배터리 교체 건의가 3차례나 “예산 부족”으로 묵살되어 정전 시 배수 펌프와 비상등이 동시에 정지함.<br>',
      '<b>4. [체육관 비밀 증거]</b> 당직 체육부장은 심야 리허설 중 벌어진 위험한 담력체험 관행을 묵인하고 사고 직후 출입 기록을 말소함.<br>',
      '<b>5. [수영장 비밀 증거]</b> 보건교사는 펌프실이 침수된 뒤 죄책감에 자신의 봉인 증거 조각을 수영장 배수구 물길에 유기함.<br>',
      '<b>6. [별관 교장 직인 코어]</b> 제9대 교장은 별관 전원이 살아 있었음에도 구조를 지시하지 않고 5대 증거를 봉인한 뒤 별관을 폐쇄함.'
    ].join(''),
    tape: true,
    voiceKey: 'vo_bunker_tape',
    voiceWho: '📁 1998 서문고 진상 규명 마스터 기록부'
  });
};
function makeGateKey() {
  if (FL.gatekey) return;
  if (!FL.keyhead) { toast('진상 기록부가 완성되지 않는다', '교장 직인 마스터 코어가 없다 — 제4장 목표를 확인하세요', 'warn'); return; }
  FL.gatekey = true; newItems.add('gatekey'); sfx.unlock(); setFace('resolve', 3);
  toast('『서문고 진상 규명 마스터 기록부』 완성!', '이 학교가 은폐한 5대 비밀이 하나로 증명되었다 · 이제 방송실 송출 및 교문 봉인 해제가 가능하다');
  setTimeout(() => talk('keyMade', 3000), 300);
  if (FL.calm) setTimeout(() => toast('진실이 밝혀졌다', '꺼지지 않던 방송이 멎고, 기억 속 교실이 조용해졌다. ' + (FL.mina ? '민아와 함께 정문 밖으로 나가 세상에 알리자.' : '…4층 방송실의 민아 선배를 구출하자.'), 'opt'), 2600);
  else setTimeout(() => { if (state === 'ui') closeUI(); enrage(); }, 1600);
  refreshHud(); save(true);
}
function invUse(it) {
  const f = USE[it.id]; const r = f ? f() : '지금은 쓸 곳이 없다.';
  if (typeof r === 'string') invMsg = r;
  if (state === 'ui' && $('inv').classList.contains('show')) renderInv();
}
function zoom(title, big, text) {
  $('izName').textContent = title; $('izBig').innerHTML = big; $('izText').innerHTML = text; $('invZoom').classList.add('show');
}
function renderInv() {
  document.querySelectorAll('#invTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === invTab));
  const grid = $('invGrid'), det = $('invDetail'); grid.innerHTML = ''; det.innerHTML = '';
  const actBtns = acts => `<div id="invMsg">${invMsg}</div><div id="invActs">${acts.map(([l, k, dis], i) => `<button data-a="${i}"${dis ? ' disabled' : ''}>${l}${k ? ` <kbd>${k}</kbd>` : ''}</button>`).join('')}</div>`;
  const bindActs = fns => det.querySelectorAll('#invActs button').forEach(b => { b.onclick = () => fns[+b.dataset.a](); });
  if (invTab === 'items' || invTab === 'keys') {
    grid.className = '';
    const all = bagList(), its = all.filter(i => (i.cat === 'key') === (invTab === 'keys'));
    invSel = clamp(invSel, 0, Math.max(0, its.length - 1));
    const slots = Math.max(invTab === 'items' ? 15 : 5, Math.ceil(its.length / 5) * 5);
    for (let i = 0; i < slots; i++) {
      const it = its[i], c = document.createElement('div');
      if (!it) { c.className = 'cell empty'; grid.appendChild(c); continue; }
      c.className = 'cell' + (i === invSel ? ' sel' : '') + (combineFrom ? ' pick' : '');
      { const rs = RECIPES.filter(r => r.a === it.id || r.b === it.id); c.title = it.name + (rs.length ? '\n조합: ' + rs.map(r => `${ITEMS[r.a === it.id ? r.b : r.a].name} → ${RESULT[r.fn]}`).join(' · ') : ''); }
      c.innerHTML = iconHTML(it.icon) + (it.n > 1 ? `<em>×${it.n}</em>` : '') + (newItems.has(it.id) ? '<span class="new">NEW</span>' : '');
      c.onclick = () => { if (combineFrom) { tryCombine(combineFrom, it.id); return; } invSel = i; invMsg = ''; renderInv(); };
      grid.appendChild(c);
    }
    $('invCap').innerHTML = `<span>${its.length}개 · ${invTab === 'items' ? '아이템' : '열쇠 아이템'}</span><span>←→↑↓ 선택 · Enter 사용 · C 조합 · Z 자세히</span>`;
    const it = its[invSel];
    if (!it) { det.innerHTML = invTab === 'keys' ? keyPieceHTML() : '<p>비어 있다.</p>'; return; }
    newItems.delete(it.id);
    det.innerHTML = `<div class="big">${iconHTML(it.icon)}</div><h3>${it.name}${it.n > 1 ? ` <small style="color:var(--dim)">×${it.n}</small>` : ''}</h3><div class="cat">${it.cat === 'key' ? '열쇠 아이템' : '아이템'}</div><div>${itemDesc(it)}</div>${recipeHTML(it.id)}${invTab === 'keys' ? keyPieceHTML() : ''}` +
      actBtns([['사용', 'Enter'], ['조합', 'C', !canCombine(it.id)], ['자세히', 'Z']]);
    bindActs([() => invUse(it), () => startCombine(it.id), () => zoom(it.name, iconHTML(it.icon), itemDesc(it))]);
  } else if (invTab === 'craft') {   // 조합 — CraftingSystem 레시피 목록 (재료 개수 · 클릭 / Enter 로 제작)
    grid.className = 'craftList'; const rs = craftingSystem.recipes; invSel = clamp(invSel, 0, rs.length - 1);
    const label = { can: '빈 캔', tape: '절연 테이프', battery: '건전지', bandage: '응급 밴드', pill: '보건실 진정제' }, own = { trap_can: 'alarm', short_bomb: 'shock', med_kit: 'firstaid' };
    rs.forEach((r, i) => { const ok = craftingSystem.canCraft(r), c = document.createElement('div'); c.className = 'cell craftRow' + (i === invSel ? ' sel' : '') + (ok ? '' : ' empty');
      c.innerHTML = `${iconHTML(ITEMS[own[r.resultId]].icon)}<div><b>${r.resultName}</b> <small>보유 ${inv[own[r.resultId]] || 0}</small><br><small>${Object.entries(r.ingredients).map(([k, q]) => `${label[k]} ${craftingSystem.inventory.items[k]}/${q}`).join(' + ')}</small></div>`;
      c.onclick = () => { if (invSel === i) craftNow(); else { invSel = i; invMsg = ''; renderInv(); } }; grid.appendChild(c); });
    const r = rs[invSel]; det.innerHTML = `<div class="big">${iconHTML(ITEMS[own[r.resultId]].icon)}</div><h3>${r.resultName}</h3><div class="cat">조합</div><div>${r.desc}</div>` + actBtns([['제작', 'Enter', !craftingSystem.canCraft(r)]]);
    bindActs([craftNow]);
  } else if (invTab === 'col') {   // 수집품 — 하늘의 물건들
    grid.className = ''; FL.col = FL.col || {};
    const n = COLLECT.filter(c => FL.col[c.id]).length; invSel = clamp(invSel, 0, COLLECT.length - 1);
    COLLECT.forEach((cdef, i) => { const has = FL.col[cdef.id], c = document.createElement('div'); c.className = 'cell' + (i === invSel ? ' sel' : '') + (has ? '' : ' empty'); c.innerHTML = has ? cdef.icon + (newItems.has(cdef.id) ? '<span class="new">NEW</span>' : '') : '<span style="opacity:.35">?</span>'; c.onclick = () => { invSel = i; renderInv(); }; grid.appendChild(c); });
    $('invCap').innerHTML = `<span>수집품 ${n} / ${COLLECT.length}${n >= COLLECT.length ? ' · 모두 모았다' : ''}</span><span>사물함 · 방 곳곳에서 찾을 수 있다</span>`;
    const cd = COLLECT[invSel], has = FL.col[cd.id]; newItems.delete(cd.id);
    det.innerHTML = has ? `<div class="big">${cd.icon}</div><h3>${cd.name}</h3><div class="cat">수집품 · ${invSel + 1}번</div><div>${cd.desc}</div>` + actBtns([['자세히', 'Z']]) : `<div class="big" style="opacity:.3">?</div><h3>???</h3><div class="cat">아직 찾지 못했다</div><div style="color:var(--dim)">어딘가의 사물함이나 방에 남아 있다.</div>`;
    if (has) bindActs([() => zoom(cd.name, cd.icon, cd.desc)]);
  } else {
    grid.className = 'list';
    if (!docs.length) { grid.innerHTML = '<p style="color:#8d897d">아직 모은 문서가 없다.</p>'; $('invCap').innerHTML = `<span>문서 0 / ${DOC_TOTAL()}</span>`; return; }
    invSel = clamp(invSel, 0, docs.length - 1);
    docs.forEach((d, i) => { const c = document.createElement('div'); c.className = 'doc' + (i === invSel ? ' sel' : ''); c.innerHTML = `${d.icon} ${d.title}<small>${{ note: '쪽지', photo: '사진', tape: '녹음', cam: '영상' }[d.kind]}</small>`; c.onclick = () => { invSel = i; renderInv(); }; grid.appendChild(c); });
    $('invCap').innerHTML = `<span>찾은 기록 ${docs.length} / ${DOC_TOTAL()}</span><span>↑↓ 선택 · Enter 다시 듣기 · Z 자세히</span>`;
    const d = docs[invSel];
    det.innerHTML = `<h3>${d.title}</h3><div class="cat">${{ note: '쪽지 · 문서', photo: '사진', tape: '녹음 테이프', cam: '캠코더 영상' }[d.kind]}</div>${d.img ? `<img class="photo" src="assets/img/${d.img}.webp" alt="">` : ''}<div class="paper">${d.text}</div>` +
      actBtns([['▶ 다시 듣기', 'Enter', !d.tape], ['자세히', 'Z']]);
    bindActs([() => line(d.tape, d.fx || 'radio', d.spk), () => zoom(d.title, d.img ? `<img src="assets/img/${d.img}.webp" alt="">` : d.icon, d.text)]);
  }
}
const RESULT = { recharge: '손전등 배터리 충전', gatekey: '서문고 진상 규명 마스터 기록부 (비밀 증거 5개 + 교장 직인 코어)', hook: '갈고리 장대', alarm: '경보 함정', shock: '쇼트 폭탄', firstaid: '응급 처치 키트' };
function recipeHTML(id) {
  const rs = RECIPES.filter(r => r.a === id || r.b === id); if (!rs.length) return '';
  return `<div style="margin-top:8px;font-size:12px;color:#8cc0e8">${rs.map(r => `조합: ${ITEMS[r.a].name} + ${ITEMS[r.b].name} → <b>${RESULT[r.fn]}</b>`).join('<br>')}</div>`;
}
function keyPieceHTML() {
  return `<div class="pieceList" style="margin-top:10px;border-top:1px solid #2c3640;padding-top:8px"><b style="font-size:12px;color:var(--dim)">정문 열쇠 조각 ${P.keys}/${TOTAL}</b>${KEY_NAMES.map((n, i) => `<div class="chk${got[i] ? ' done' : ''}">${KEY_WHERE[i]}</div>`).join('')}</div>`;
}
function invKey(e) {
  const c = e.code, list = invTab === 'craft' ? craftingSystem.recipes : invTab === 'docs' ? docs : invTab === 'col' ? COLLECT : bagList().filter(i => (i.cat === 'key') === (invTab === 'keys'));
  if ($('invZoom').classList.contains('show')) { if (['Escape', 'KeyZ', 'Enter', 'Tab'].includes(c)) $('invZoom').classList.remove('show'); return true; }
  if (c === 'Escape' && combineFrom) { combineFrom = null; invMsg = ''; renderInv(); return true; }
  if (c === 'KeyQ' || c === 'KeyE') { invTab = TABS[(TABS.indexOf(invTab) + (c === 'KeyE' ? 1 : TABS.length - 1)) % TABS.length]; invSel = 0; combineFrom = null; invMsg = ''; renderInv(); return true; }
  const cols = invTab === 'docs' || invTab === 'craft' ? 1 : 5;
  if (invTab === 'craft' && (c === 'Enter' || c === 'Space' || c === 'KeyC')) { craftNow(); return true; }
  const mv = { ArrowRight: 1, KeyD: 1, ArrowLeft: -1, KeyA: -1, ArrowDown: cols, KeyS: cols, ArrowUp: -cols, KeyW: -cols }[c];
  if (mv) { invSel = clamp(invSel + mv, 0, Math.max(0, list.length - 1)); invMsg = combineFrom ? invMsg : ''; renderInv(); return true; }
  if (c === 'Enter' || c === 'Space') { const b = $('invActs') && $('invActs').querySelector('[data-a="0"]'); if (combineFrom && invTab !== 'docs') { const it = list[invSel]; if (it) tryCombine(combineFrom, it.id); } else if (b && !b.disabled) b.click(); return true; }
  if (c === 'KeyC' && invTab !== 'docs' && invTab !== 'col') { const it = list[invSel]; if (it && canCombine(it.id)) startCombine(it.id); return true; }
  if (c === 'KeyZ') { const b = $('invActs') && [...$('invActs').querySelectorAll('button')].pop(); if (b) b.click(); return true; }
  return false;
}

/* ----- 휴대폰 ----- */
let phoneTab = 'msg';
// 야외 · 시설의 수집 조사 지점(테이프 · 명찰 등)이 받침 없이 떠 있으면 아래 바닥 · 탁자에 내려놓는다
function settleOutdoorProps() {
  const rc = new THREE.Raycaster(), bx = new THREE.Box3(), ms = []; scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh) { for (let a = o; a; a = a.parent) if (!a.visible || a.isCamera) return; ms.push(o); } });
  for (const p of world.props) { if (p.floor !== 0 || !(p.mega || p.kind === 'gradio') || !p.mesh || (RBG && RBG.inBuilding(p.x, p.z))) continue;
    bx.setFromObject(p.mesh); if (bx.isEmpty()) continue; const own = new Set(); p.mesh.traverse(x => own.add(x)); const c = bx.getCenter(new THREE.Vector3());
    rc.set(new THREE.Vector3(c.x, bx.min.y + .02, c.z), new THREE.Vector3(0, -1, 0)); rc.far = 4; const h = rc.intersectObjects(ms, false).find(h => !own.has(h.object) && !h.object.isSprite);
    if (h && h.distance > .06) { const dy = h.distance - .02; p.mesh.position.y -= dy; if (p.y != null) p.y = Math.max(.2, p.y - dy); } }
}
const PTABS = ['msg', 'call', 'rec', 'photo', 'cam', 'memo', 'tl', 'missions', 'tool', 'log'];
const phoneSeen = { photo: 0, memo: 0, tl: 0 };
const hasDoc = id => docs.some(d => d.id === id);
// 가설 노트: 지지·반박 증거를 모은 개수로 상태가 바뀐다 (미확인 → 지지/반박 → 입증/반박 확정)
function hypoHTML() {
  if (!hasDoc('n_seomun_ilbo')) return '';
  return '<div class="tlHead">🧩 가설 노트 — 민아가 파헤치던 1998년의 비밀</div>' + HYPOTHESES.map(h => {
    const p = h.pro.filter(hasDoc).length, c = h.con.filter(hasDoc).length, need = Math.min(3, h.pro.length + h.con.length);
    const done = (h.verdict === '입증' ? p : c) >= need;
    const st = done ? h.verdict : (p || c) ? (c > p ? '반박 쪽으로 기움' : '지지 증거 있음') : '미확인';
    const col = done ? (h.verdict === '입증' ? '#7fdc8a' : '#ff8a7a') : (p || c) ? '#ffd27a' : '#8a8a8a';
    return `<div class="tl${p || c ? '' : ' unk'}"><b style="color:${col}">${h.id}</b><span>${h.q}<em style="color:${col};font-style:normal"> · ${st} (지지 ${p} / 반박 ${c})</em>${done ? `<br><small>${h.end}</small>` : ''}</span></div>`;
  }).join('');
}
const tlKnown = () => TIMELINE.filter(e => hasDoc(e.need)).length;
let recPlaying = null;
function openPhone(tab = 'msg') { if (state !== 'playing') return; phoneTab = tab; openUI('phone'); renderPhone(); sfx.click(); }
function renderPhone() {
  document.querySelectorAll('.pTabs button').forEach(b => b.classList.toggle('on', b.dataset.p === phoneTab));
  { const tb = document.querySelector(`.pTabs button[data-p="${phoneTab}"]`); if ($('pTitle')) $('pTitle').textContent = tb ? (tb.lastChild && tb.lastChild.textContent || '').trim() : ''; const sg = P.floor === 4 ? 0 : (RBG && RBG.inBuilding && RBG.inBuilding(P.x, P.z)) ? 2 : 4; document.querySelectorAll('.pSig i').forEach((b, i) => b.style.opacity = i < sg ? 1 : .3); }
  $('pClock').textContent = clockText(); $('pBat').textContent = `🔋 ${Math.round(P.pbat ?? 100)}%`;
  const B = $('pBody');
  if (phoneTab === 'msg') {
    const fk = fakeMsgs.slice().reverse().map(m => `<div class="bubble unread" style="border-color:#a02020"><small style="color:#ff6060">${m.who} · ${m.t}</small>${m.text}</div>`).join('');
    const banner = '<div style="background:rgba(35,52,72,0.55);border:1px solid rgba(110,165,230,0.35);border-radius:6px;padding:7px 10px;margin-bottom:8px;font-size:11.5px;color:#cfe4ff;display:flex;justify-content:space-between;align-items:center;"><span>📱 <b>음성 사서함</b> (자동 재생 꺼짐 — 메시지를 클릭하면 음성이 재생됩니다)</span></div>';
    B.innerHTML = banner + fk + (msgs.length ? msgs.slice().reverse().map(m => `<div class="bubble${m.read ? '' : ' unread'}" data-id="${m.id}" style="cursor:pointer;transition:transform .12s,border-color .15s;"><img class="av" src="assets/ui/mina_portrait.webp" alt=""><small style="display:flex;justify-content:space-between;align-items:center;"><span>📱 민아 선배 · ${m.t}</span><span style="background:#1e6b45;color:#fff;padding:2px 8px;border-radius:10px;font-weight:bold;font-size:10.5px;">🔊 클릭하여 음성 재생</span></small>${VO[m.id].text}</div>`).join('') : '<div class="pEmpty">수신된 음성 메시지가 없습니다.<br>신호 없음</div>');
    B.querySelectorAll('.bubble[data-id]').forEach(b => {
      b.onclick = () => window.__playPhoneMsg(b.dataset.id);
    });
    refreshHud();
  } else if (phoneTab === 'photo') {
    const ph = docs.filter(d => d.img).map(d => ({ src: `assets/img/${d.img}.webp`, title: d.title })).concat([].map((x, i) => ({ src: spiritPhoto(x), title: `현장 사진 #${i + 1} — ${x.text}` })));
    B.innerHTML = shotsHtml() + (ph.length ? `<div class="pPhotos">${ph.map(d => `<img src="${d.src}" alt="" title="${d.title}" data-t="${d.title}">`).join('')}</div>` : SHOT.list.length ? '' : '<div class="pEmpty">저장된 사진이 없습니다.</div>');
    B.querySelectorAll('img').forEach(im => { im.onclick = () => { $('lbImg').src = im.src; $('lbCap').textContent = im.dataset.t; $('lightbox').classList.add('show'); }; });
  } else if (phoneTab === 'memo') {
    const sp = [].slice().reverse().map(x => `<div class="memo">📷 <b>현장 사진</b> (${x.t || ''}) — ${x.text}<br><i>${x.subText}</i></div>`).join('');
    const observations='';
    B.innerHTML = observations + (clues.length || sp ? sp + clues.slice().reverse().map(c => `<div class="memo">${CLUES[c]}</div>`).join('') : '<div class="pEmpty">아직 기록한 단서가 없습니다.</div>');
  } else if (phoneTab === 'missions') {
    B.innerHTML='<nav class="missionNav"><button data-mission-nav="main">메인</button><button data-mission-nav="side">서브</button><button data-mission-nav="special">특별</button></nav>'+missionGroups().map(g=>`<section class="missionGroup" data-mission="${g.id}" id="mission-${g.id}"><h3>${g.title}</h3><p>${g.purpose}</p>${g.items.map(it=>`<div class="memo${it.done?' missionDone':''}"><b>${it.done?'✓ ':''}${it.title}</b>${it.progress?` · ${it.progress}`:''}${it.where?`<br><small>${it.where}</small>`:''}</div>`).join('')}</section>`).join('');
    B.querySelectorAll('[data-mission-nav]').forEach(b=>{b.onclick=()=>B.querySelector('#mission-'+b.dataset.missionNav).scrollIntoView({block:'start',behavior:'smooth'});});
  } else if (phoneTab === 'tool') {
    const o = objective(), d = objDir(), cd = Math.ceil(P.flashCD || 0), pb = Math.round(P.pbat ?? 100);
    B.innerHTML = `<div class="pTool"><div class="pCard"><small>📍 현재 위치</small><b>${whereText()}</b><span>${o.main}${o.loc ? `<br>목표 위치: ${o.loc.where}` : ''}${d ? `<br><em>${d.text}</em>` : ''}</span></div>
      <button data-t="flash"${cd || pb < 15 ? ' disabled' : ''}>📸 카메라 플래시<small>${cd ? `충전 중 ${cd}초` : '어둠 속 흔적을 비춘다 · 배터리 15%'}</small></button>
      <button data-t="radar"${pb < 5 ? ' disabled' : ''}>📡 잡음 탐지<small>같은 층의 이상한 전파 흔적을 확인 · 배터리 5%</small></button>
      <button data-t="save"${ghost.state === 'chase' && ghost.active && ghost.floor === P.floor ? ' disabled' : ''}>💾 빠른 저장<small>F5 — 현재 진행을 저장합니다</small></button>
      <div class="pNote">휴대폰 배터리는 천천히 충전된다 (보조 배터리 내장)</div></div>`;
    B.querySelectorAll('button[data-t]').forEach(b => { b.onclick = () => phoneTool(b.dataset.t); });
  } else if (phoneTab === 'call') { renderCallTab(B);
  } else if (phoneTab === 'cam') {   // [📷 카메라] — 휴대폰을 닫고 바로 야간 카메라
    phoneTab = 'msg'; closeUI(); setTimeout(() => camMode(true), 60); return;
  } else if (phoneTab === 'rec') {   // 🎙️ 녹음 — 모은 증거 녹음(증언 테이프 · 녹음 쪽지 · 캠코더)을 다시 듣는다
    const list = docs.filter(d => d.tape);
    B.innerHTML = `<div class="pRecHead"><span>증거 녹음 ${list.length}개</span><span>▶ 눌러 다시 듣기</span></div>` + (list.length ? list.slice().reverse().map(d => { const L = lineInfo(d.tape); return `<div class="pRec${recPlaying === d.id ? ' playing' : ''}" data-id="${d.id}"><span class="ic">${d.icon}</span><span class="tx"><b>${d.title}</b><small>${(d.spk || '').replace(/^\S+\s/, '')}${L && L.dur ? ` · ${Math.floor(L.dur / 60)}:${String(Math.round(L.dur % 60)).padStart(2, '0')}` : ''}</small></span><button>${recPlaying === d.id ? '■' : '▶'}</button></div>`; }).join('') : '<div class="pEmpty">아직 모은 녹음이 없습니다.<br>녹음기 · 테이프를 찾아 재생하면 여기에 쌓입니다.</div>');
    B.querySelectorAll('.pRec').forEach(r => { r.querySelector('button').onclick = () => { const d = docs.find(x => x.id === r.dataset.id); if (!d) return;
      if (recPlaying === d.id) { stopSpeak(); recPlaying = null; renderPhone(); return; }
      stopSpeak(); recPlaying = d.id; renderPhone(); const id = d.id; Promise.resolve(line(d.tape, d.fx || 'radio', d.spk)).then(sec => setTimeout(() => { if (recPlaying === id) { recPlaying = null; if (state === 'ui' && phoneTab === 'rec') renderPhone(); } }, ((sec || 0) + .4) * 1000)); }; });
  } else if (phoneTab === 'log') {
    B.innerHTML = SUBLOG.length ? SUBLOG.slice().reverse().map(l => `<div class="pLog"><b>${l.who === '·' ? '♪' : l.who || '…'}</b><span>${l.who === '·' ? `[${l.text}]` : l.text}</span></div>`).join('') : '<div class="pEmpty">기록된 대화가 없습니다.</div>';
  } else {
    const n = tlKnown();
    B.innerHTML = hypoHTML() + `<div class="tlHead">10월 12일 밤 — 사건 연표 <b>${n} / ${TIMELINE.length}</b></div>` + TIMELINE.map(e => {
      const ok = hasDoc(e.need), cf = ok && e.conflict && hasDoc(e.conflict);
      return `<div class="tl${ok ? '' : ' unk'}${cf ? ' cf' : ''}"><b>${e.t}</b><span>${ok ? e.text : '??? — 아직 모르는 일'}${cf ? '<em>⚠ 다른 증언과 모순</em>' : ''}</span></div>`;
    }).join('') + (n === TIMELINE.length ? '<div class="tlEnd">모든 조각이 맞춰졌다. 문은 밖에서 잠겨 있었고, 하늘이는 집에 가지 못했다.</div>' : '');
  }
  if (phoneTab === 'photo') phoneSeen.photo = docs.filter(d => d.img).length;
  if (phoneTab === 'memo') phoneSeen.memo = clues.length;
  if (phoneTab === 'tl') phoneSeen.tl = tlKnown();
  document.querySelectorAll('.pTabs button').forEach(b => { const k = b.dataset.p; b.classList.toggle('dot', k === 'photo' ? docs.filter(d => d.img).length > phoneSeen.photo : k === 'memo' ? clues.length > phoneSeen.memo : k === 'tl' ? tlKnown() > phoneSeen.tl : false); });
}
document.querySelectorAll('.pTabs button').forEach(b => { b.onclick = () => { phoneTab = b.dataset.p; renderPhone(); }; });
// 휴대폰 도구: 카메라 플래시(그것을 물러나게 함) · 잡음 탐지 · 빠른 저장
function phoneTool(t) {
  const G = ghost, same = G.active && G.floor === P.floor, dist = same ? Math.hypot(G.x - P.x, G.z - P.z) : 99;
  if (t === 'flash') {
    if ((P.flashCD || 0) > 0 || (P.pbat ?? 100) < 15) return;
    P.pbat = (P.pbat ?? 100) - 15; P.flashCD = 60; sfx.photo(); fx.lightning(); closeUI();
    const lx = -Math.sin(P.yaw), lz = -Math.cos(P.yaw), F = floors[P.floor];
    if (same && dist < 10 && ((G.x - P.x) * lx + (G.z - P.z) * lz) / Math.max(dist, .01) > .8 && los(F.walls, P.x, P.z, G.x, G.z)) {
      G.repelCD = 22; G.hunt = null; G.state = 'search'; G.spawnGrace = 3; G.path = []; G.replan = 0; G.wait = 0;
      let far = F.nodes[0]; F.nodes.forEach(n => { if (Math.hypot(n.x - P.x, n.z - P.z) > Math.hypot(far.x - P.x, far.z - P.z)) far = n; });
      G.target = { x: far.x, z: far.z }; sfx.screech(); fx.glitch(.6); shake = .3; talk('repel', 2600); fx.dust(G.x, floors[G.floor].y0 + 1, G.z, 25);
    } else caption('찰칵 — 섬광이 어둠을 잠깐 밀어냈다');
    return;
  }
  if (t === 'radar') {
    if ((P.pbat ?? 100) < 5) return; P.pbat = (P.pbat ?? 100) - 5; sfx.staticNoise(.8);
    const msg = !same ? '잡음 없음 — 이 층에는 없다' : dist < 10 ? '⚠ 잡음 최대 — 아주 가까이 있다' : dist < 22 ? '잡음 강함 — 같은 층, 가깝다' : '잡음 약함 — 같은 층 어딘가에 있다';
    toast('📡 잡음 탐지', msg, same && dist < 22 ? 'warn' : 'info'); renderPhone(); return;
  }
  if (t === 'save') { if (G.active && G.state === 'chase' && same) { toast('저장할 수 없습니다', '쫓기는 중', 'warn'); return; } save(); renderPhone(); }
}
// 주변 살피기 (H): 가까운 조사 대상 이름을 화면에 3초 동안 띄운다
let pingList = [], pingT = 0, scanCD = 0;
const PING_NAME = { switch: '형광등 스위치', elevator: '엘리베이터', robj: null, clue: '책상 밑', safe: '금고', breaker: '차단기', console: '방송 장비', tape: '녹음기', piano: '피아노', lock: '보관함', drain: '배수구' };
function scanAround() {
  if (state !== 'playing' || scanCD > 0) return; scanCD = 4; sfx.ui();
  const F = floors[P.floor], near = [];
  const add = (x, y, z, name) => { const d = Math.hypot(x - P.x, z - P.z); if (d < 9 && (d < 3.5 || los(F.walls, P.x, P.z, x, z))) near.push({ x, y: F.y0 + y, z, name, d }); };
  world.props.forEach(p => { if (p.floor !== P.floor || p.done || p.k === 'light_switch') return; const n = p.kind === 'robj' ? p.label : PING_NAME[p.kind] ?? p.label; if (n) add(p.px ?? p.x, p.y ?? 1, p.pz ?? p.z, n); });
  world.items.forEach(it => { if (it.floor === P.floor && !it.taken && it.pos && it.mesh && it.mesh.visible) add(it.pos.x, it.pos.y - F.y0 + .25, it.pos.z, it.kind === 'note' ? '쪽지' : it.kind === 'battery' ? '건전지' : it.kind === 'medkit' ? '응급 밴드' : it.kind === 'key' ? '열쇠 조각' : '물건'); });
  world.lockers.forEach(l => { if (l.floor === P.floor) add(l.x, 1.2, l.z, '숨을 곳'); });
  pingList = near.sort((a, b) => a.d - b.d).slice(0, 10); pingT = 3;
  const box = $('pings'); box.innerHTML = pingList.map(q => `<div>${q.name}</div>`).join('');
  if (!pingList.length) caption('주변에 눈에 띄는 것이 없다');
}
const _pv = new THREE.Vector3();
function updatePings(dt) {
  scanCD = Math.max(0, scanCD - dt); if (pingT <= 0) return; pingT -= dt;
  const els = $('pings').children;
  pingList.forEach((q, i) => { const el = els[i]; if (!el) return; _pv.set(q.x, q.y, q.z).project(camera); const on = _pv.z < 1 && Math.abs(_pv.x) < 1.1 && Math.abs(_pv.y) < 1.1; el.style.display = on ? '' : 'none'; if (on) { el.style.left = ((_pv.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - _pv.y) / 2 * innerHeight) + 'px'; } });
  if (pingT <= 0) $('pings').innerHTML = '';
}
let objDirT = 0;
function updateObjDir(dt) {
  if ((objDirT -= dt) > 0) return; objDirT = .12;
  const el = $('objDir'), d = SET.objArrow && state === 'playing' ? objDir() : null; el.classList.toggle('on', !!d); if (!d) return;
  setTxt(el.querySelector('span'), d.text);
  el.querySelector('i').style.transform = d.other ? 'rotate(-90deg)' : `rotate(${(-(d.ang - P.yaw) * 180 / Math.PI) - 90}deg)`;
}
// 목표 방향: 같은 층이면 방위 · 거리, 다른 층이면 계단/엘리베이터 안내
function objDir() {
  const o = objective(); let l = o && o.loc; if (!l) return null;
  if (RBG) { l = RBG.mapLoc(l, world);   // 새 건물: 예전 좌표 목표를 옮긴 자리로, 층이 다르면 계단 안내
    if (l.rbY != null && P.floor === 0) { const df = Math.round((l.rbY - (P.sh || 0)) / 3.6); if (df) return { other: true, text: `${RBG.floorLabel(l.x, l.z, l.rbY) || '다른 층'} — ${df > 0 ? '위층' : '아래층'} (양 끝 계단)` }; }
    else if (l.rbY != null && P.floor !== 0) return { other: true, text: `${RBG.floorLabel(l.x, l.z, l.rbY) || '새 건물'} — 밖으로 나가 본관 · 별관으로` }; }
  if (l.f !== P.floor && (l.f >= 8 || P.floor >= 8)) return { other: true, text: l.f >= 8 && P.floor >= 8 ? `${FLOOR_LABEL[l.f] || '별관'} — ${l.f > P.floor ? '위층' : '아래층'} (별관 계단)` : l.f >= 8 ? `${FLOOR_LABEL[l.f] || '별관'} — 본관 1층 중앙계단실 북쪽 유리 통로로` : '별관 1층 현관 → 유리 통로로 본관에 돌아갈 것' };
  if (l.f !== P.floor) { const up = (l.f === 3 || (l.f >= 1 && l.f <= 2 && P.floor < l.f && P.floor !== 4) || (P.floor === 4 && l.f !== 4)); return { other: true, text: `${FLOOR_LABEL[l.f] || '다른 장소'} — ${l.f >= 5 && l.f <= 7 ? '밖으로 나가 건물을 찾을 것' : up ? '위층 (계단 · 엘리베이터)' : '아래층 (계단 · 엘리베이터)'}` }; }
  const dx = l.x - P.x, dz = l.z - P.z, d = Math.hypot(dx, dz), ang = Math.atan2(-dx, -dz);
  const dirs = ['북', '북서', '서', '남서', '남', '남동', '동', '북동'], i = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
  const py = (l.rbY != null ? l.rbY : (floors[l.f] && floors[l.f].y0) || 0) + 1.1;   // HUD v2 3D 목표 마커용 위치
  return { other: false, d, ang, pos: { x: l.x, y: py, z: l.z }, text: d < 2.5 ? '바로 이 근처' : `${dirs[i]}쪽 ${Math.round(d)}m` };
}

/* ----- 열기 / 닫기 ----- */
const UI_PANELS = ['inv', 'mapOv', 'testOv', 'keypad', 'phone', 'invZoom', 'chalk', 'annexOv'];
function openUI(kind) { if (state !== 'playing') return; $('chapterCard').classList.remove('show');$('dlg').classList.remove('show'); if (CAM.on) camMode(false); state = 'ui'; for (const k in keys) keys[k] = false; $('prompt').style.display = 'none'; $(kind).classList.add('show'); document.exitPointerLock?.(); }
function closeUI() { if (state !== 'ui') return; try { if (cabIsOpen && anxView === 'keys' && $('annexOv').classList.contains('show')) setTimeout(() => cabSwing(false), 250); } catch (e) { /* 초기화 전 */ } if($('keypad').classList.contains('show')){++keypadSequence;kpOpening=false;} UI_PANELS.forEach(k => $(k).classList.remove('show')); combineFrom = null; invMsg = ''; state = 'playing'; refreshHud(); lock(); }
function openInv(tab = 'items') { if (state !== 'playing') return; invTab = tab; invSel = 0; openUI('inv'); renderInv(); sfx.paper(); }
document.querySelectorAll('[data-close]').forEach(b => { b.onclick = () => closeUI(); });
$('izClose').onclick = () => $('invZoom').classList.remove('show');
document.querySelectorAll('#invTabs button').forEach(b => { b.onclick = () => { invTab = b.dataset.tab; invSel = 0; combineFrom = null; invMsg = ''; renderInv(); }; });

/* ----- 지도 ----- */
let mapZoom = 1, mapPan = { x: 0, z: 0 };
function openMap() { if (state !== 'playing') return; mapFloor = P.floor; if (RBG && P.floor === 0 && RBG.inside(P.x, P.z)) mapFloor = (P.z < -10 ? 'A' : 'M') + Math.min(P.z < -10 ? 2 : 3, Math.max(0, Math.round((P.sh || 0) / 3.6))); const inB = P.floor === 0 && !isOutdoors() && typeof mapFloor === 'number'; mapZoom = inB ? 2.1 : 1; mapPan = { x: 0, z: inB ? -26 : 0 }; openUI('mapOv'); renderMap(); }
// 목표 · 핀을 지금 건물 기준으로: 열쇠 조각은 실제 놓인 자리, 예전 좌표는 옮긴 자리로 → 지도 탭('M0'~'A2' · 숫자 층)과 안내 문구도 새 방 이름으로
function keyLoc(r) { const it = world.items.find(q => q.kind === 'key' && q.idx === r.i && !q.taken); return it ? { f: it.floor, x: it.pos.x, z: it.pos.z, rbY: it.rbY } : r; }
function liveLoc(t) { if (!t || t._live) return t; if (t.f === LOC.office.f && t.x === LOC.office.x && t.z === LOC.office.z) { const sf = world.props.find(q => q.kind === 'safe'); if (sf && sf.rbY != null) t = { ...t, x: sf.x, z: sf.z, rbY: sf.rbY, f: 0 }; } if (RBG) t = RBG.mapLoc(t, world); if (t.rbY == null) return t;
  const w = RBG.where(t.x, t.z, t.rbY + .5), lab = w || RBG.floorLabel(t.x, t.z, t.rbY), fl = RBG.floorLabel(t.x, t.z, t.rbY) || '', tab = /^별관/.test(fl) ? 'A' + Math.round(t.rbY / 3.6) : /^본관/.test(fl) ? 'M' + Math.round(t.rbY / 3.6) : 0;
  const ow = String(t.where || ''), cut = ow.search(/\(| — /), rest = cut < 0 ? '' : ow.slice(cut).replace(/^ — /, '').trim();
  return { ...t, _live: true, tab, where: lab ? (rest ? `${lab} — ${rest}` : lab) : ow }; }
function tabOf(t) { return t ? (t.tab != null ? t.tab : t.f) : null; }
function mapPins(f) { return KEY_ROOMS.map((r, i) => ({ ...r, i })).map(r => got[r.i] ? { ...r, tab: r.f } : liveLoc(keyLoc(r)) && { ...liveLoc(keyLoc(r)), i: r.i }).filter(r => r && String(tabOf(r)) === String(f)).map(r => ({ x: r.x, z: r.z, done: got[r.i] })); }
function mapTarget(f) { const o = objective(), t = liveLoc(o.loc || (FL.opt && optLoc())); return t && (String(tabOf(t)) === String(f) || (f === 0 && typeof t.tab === 'string')) ? t : null; }   // 바깥 지도(0)에선 건물 안 목표도 보이게
function curTab() { if (RBG && P.floor === 0) { const fl = RBG.floorLabel(P.x, P.z, P.sh || 0) || '', st = Math.round((P.sh || 0) / 3.6); if (/^별관/.test(fl)) return 'A' + st; if (/^본관/.test(fl)) return 'M' + st; } return P.floor; }
function mapExtras(f) {
  return {
    doors: [ ...world.doorList.filter(d => d.floor === f).map(d => ({ x: d.x, z: d.kind === 'slide' ? (d.z > 0 ? 1.55 : -1.55) : d.z, open: d.target > .5, slide: d.kind === 'slide' })), ...world.doors.filter(d => d.floor === f && d.to).map(d => ({ x: d.x, z: d.z, transition: true })), ],
    props: world.props.filter(p => p.floor === f && p.kind !== 'bell' && p.kind !== 'switch' && p.kind !== 'robj' && p.kind !== 'search' && p.kind !== 'chalk').map(p => ({ x: p.x, z: p.z, done: !!p.done, label: { safe: '금고', breaker: '차단기', console: '방송 장비', tape: '녹음기', mina: '민아', lock: '잠긴 보관함', drain: '배수구', piano: '피아노', easel: '그림', phone: '전화', elevator: '엘리베이터', mspot: '🎲' }[p.kind] })),
    elevatorBay:floors[f]?.elevatorBay, target: mapTarget(f), zones: ZONE_MAP[f] || [],
    rb: RBG && f === 0 ? RBG.mapData(P.x, P.z, P.sh || 0) : null,
  };
}
function renderMap() {
  document.querySelectorAll('#mapTabs button').forEach(b => b.classList.toggle('on', b.dataset.f === String(mapFloor)));
  const guide = mapFloor === 'guide'; $('bigMap').style.display = guide ? 'none' : 'block'; $('guide').style.display = guide ? 'grid' : 'none';
  const o = objective(), t = liveLoc(o.loc || (FL.opt && optLoc())), tt = tabOf(t);
  $('mapObj').textContent = t ? `★ ${o.main} — ${t.where}${t.tab ? '' : `  ·  목표 층: ${AREA_NAMES[t.f]}`}${String(tt) === String(mapFloor) ? ' (지금 보는 층)' : ''}` : `★ ${o.main}`;
  document.querySelectorAll('#mapTabs button').forEach(b => b.classList.toggle('tgt', !!t && b.dataset.f === String(tt)));
  if (guide) return;
  const c = $('bigMap'), ctx = c.getContext('2d');
  const rbTab = typeof mapFloor === 'string' && /^[MA]\d$/.test(mapFloor);
  if (rbTab && RBG) {   // 새 본관 · 별관 층별 평면
    const bk = mapFloor[0], st = +mapFloor[1], rb = RBG.mapStory(bk, st), here = P.floor === 0 && RBG.inside(P.x, P.z) && Math.round((P.sh || 0) / 3.6) === st && (bk === 'A') === (P.z < -10);
    drawMap(ctx, c.width, c.height, { floor: 0, cx: mapPan.x, cz: (bk === 'A' ? -22.5 : 2.4) + mapPan.z, scale: 9.6 * mapZoom, labels: true, pins: mapPins(mapFloor), target: mapTarget(mapFloor), doors: [], props: [], zones: [], rb, t: tNow, player: here ? { x: P.x, z: P.z, yaw: P.yaw } : null });
    return;
  }
  const V = { 0: [0, -14, 3.05], 1: [0, 0, 10.5], 2: [0, 0, 10.5], 4: [0, 0, 10.5], 5: [38, 19, 22], 6: [-42, 39, 12.5], 7: [-39, 15, 24], 8: [0, -4, 21], 9: [0, -4, 21], 10: [0, -4, 21] }[mapFloor] || [0, -4, 11];
  drawMap(ctx, c.width, c.height, { floor: mapFloor, cx: V[0] + mapPan.x, cz: V[1] + mapPan.z, scale: V[2] * mapZoom, labels: true, pins: mapPins(mapFloor), ...mapExtras(mapFloor), t: tNow,
    lockers: world.lockers.filter(l => l.floor === mapFloor), player: P.floor === mapFloor ? { x: P.x, z: P.z, yaw: P.yaw } : null });
  // 3D 아이소메트릭 캠퍼스 맵 HUD 헤더 & 3대 섹션 범례 배지 렌더링
  ctx.save();
  ctx.fillStyle = 'rgba(10, 16, 22, 0.84)';
  ctx.fillRect(14, 14, 620, 34);
  ctx.strokeStyle = 'rgba(130, 195, 235, 0.55)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(14, 14, 620, 34);
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#88d4ff';
  ctx.fillText('🌐 3D ISOMETRIC CAMPUS MAP', 26, 35);
  ctx.fillStyle = '#9ad8ff';
  ctx.fillText('■ ① 학술·교사·기숙사 섹션', 215, 35);
  ctx.fillStyle = '#86e8b0';
  ctx.fillText('■ ② 종합 운동·스포츠 섹션', 375, 35);
  ctx.fillStyle = '#f4d068';
  ctx.fillText('■ ③ 제1·제2 대형주차장 섹션', 518, 35);
  ctx.restore();
}
document.querySelectorAll('#mapTabs button').forEach(b => { b.onclick = () => { mapFloor = b.dataset.f === 'guide' || /^[MA]\d$/.test(b.dataset.f) ? b.dataset.f : +b.dataset.f; mapZoom = 1; mapPan = { x: 0, z: 0 }; renderMap(); }; });
$('bigMap').addEventListener('wheel', e => { e.preventDefault(); mapZoom = clamp(mapZoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), .5, 4); renderMap(); }, { passive: false });
{ let drag = null; const c = $('bigMap');
  c.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; c.setPointerCapture(e.pointerId); });
  c.addEventListener('pointermove', e => { if (!drag) return; const V = { 0: 5.2, 5: 22, 6: 12.5, 7: 24, 8: 21, 9: 21, 10: 21 }[mapFloor] || 11, k = c.width / c.clientWidth / (V * mapZoom); mapPan.x -= (e.clientX - drag.x) * k; mapPan.z -= (e.clientY - drag.y) * k; drag = { x: e.clientX, y: e.clientY }; renderMap(); });
  c.addEventListener('pointerup', () => { drag = null; }); }

function useBattery() {
  if (inv.battery <= 0) { toast('건전지가 없습니다', '', 'warn'); return false; }
  if (P.battery >= 95 && (P.pbat ?? 100) >= 95) { say('손전등 · 휴대폰 배터리 모두 충분하다', 1800); return false; }
  inv.battery--; P.battery = Math.min(100, P.battery + 45); P.pbat = Math.min(100, (P.pbat ?? 100) + 50);   // 휴대폰도 +50% if (!P.light) P.light = true; sfx.pickup(); toast('건전지를 교체했습니다', '손전등 배터리 +45% · 휴대폰 +50%', 'info'); refreshHud(); return true;
}
function useMedkit() {
  if (inv.medkit <= 0) { toast('응급 밴드가 없습니다', '', 'warn'); return false; }
  if (P.hp >= 100) { say('다친 곳이 없다', 1800); return false; }
  inv.medkit--; P.hp = Math.min(100, P.hp + 50); setFace('relief', 3); sfx.paper(); toast('응급 밴드를 사용했습니다', '체력 +50', 'info'); talk('heal', 2400); refreshHud(); return true;
}
const WOOD_ROOMS = ['class', 'office', 'library', 'music', 'art', 'counsel', 'nurse', 'club', 'craft'];
function surfaceAt() {
  const f = P.floor;
  if (f === 0 && isOutdoors()) return (Math.abs(P.x) < 3.4 || (P.z > MAIN_ZS && P.z < 14 && Math.abs(P.x) < 46)) ? 'tile' : 'dirt';
  if (f === 5) return 'wood';
  if (f >= 0 && f !== 3 && f < 11) { const r = roomAt(f, P.x, P.z); if (r && WOOD_ROOMS.includes(r.type)) return 'wood'; if (r && r.type === 'stair') return 'metal'; }
  return 'tile';
}
const _fwd = new THREE.Vector3();
function updateSound(dt) {
  camera.getWorldDirection(_fwd);
  setListener(camera.position.x, camera.position.y, camera.position.z, _fwd.x, _fwd.z);
  let a = 'in';
  if (isOutdoors()) a = P.floor === 3 ? 'roof' : 'out'; else if (P.floor === 4) a = 'b1'; else if (P.floor === 5 || P.floor === 6) a = 'hall'; else if (roomAt(P.floor, P.x, P.z)) a = 'room';
  setAmbience(a, dt);
  const chase = false;
  const gprox = ghost.active && ghost.storyTime > 0 && ghost.floor === P.floor ? clamp(1 - Math.hypot(ghost.x - P.x, ghost.z - P.z) / 16, 0, 1) : 0;
  setMusic(state === 'menu' ? 'menu' : chase ? 'chase' : 'none', dt, SET.bgm && (state === 'playing' || state === 'ui' || state === 'trans') ? SET.bgmVol * (1 - gprox * .85) : state === 'dead' || state === 'won' ? .35 : 0);
  const lvl = P.hiding ? .8 : P.tired ? 1 : Math.max(P.fear > .45 ? P.fear * .8 : 0, P.stamina < 45 ? (45 - P.stamina) / 45 * .8 : 0);
  setBreath(state === 'playing' ? lvl : 0, P.tired || P.sprinting ? 1.1 : P.hiding ? .4 : .55, dt);
  if (ghost.active && ghost.storyTime > 0 && ghost.floor === P.floor && state === 'playing') setGhostVoice({ x: ghost.x, y: floors[ghost.floor].y0 + 1.7, z: ghost.z }, 1, chase, dt);
  else setGhostVoice(null, 0, false, dt);
}
// 본관 안 또는 본관-별관 연결 통로(지붕 · 유리벽이 있는 실내 통로) 안
const inBldg = (x, z) => (z < MAIN_ZS - .3 && z > -9.9 && Math.abs(x) < 36.3);
function isOutdoors() { return state === 'menu' || state === 'intro' || P.floor === 3 || (P.floor === 0 && !(RBG ? RBG.inBuilding(P.x, P.z) : inBldg(P.x, P.z))); }
function hit() {
  // Compatibility for legacy event/debug callers: ghosts never deal damage.
  settleStoryGhost(ghost);
}

// 문서/일지/수첩별 실제 작성자 성우 감정 연기 매핑 (딱딱한 내레이션 낭독 대신 경비일지는 경비원 목소리, 보건일지는 보건교사 목소리, 교장수첩은 교장 목소리 등 실제 인물 성우의 생생한 감정 연기로 재생!)
function noteVoiceFor(id) {
  const isJ = CHAR === 'jihun';
  const pWho = isJ ? '🎙 박지훈 (서현고 2학년)' : '🎙 김서연 (방송부 2학년)';
  const pLine = k => ({ id: 'l_' + k + '_' + (isJ ? 'j' : 's'), fx: 'none', who: pWho });
  const NV_WHO = { guard: '🔦 당직 경비원 · 박종철 아저씨', nurse: '📼 보건교사 · 임소연 선생님', homeroom: '📼 3-2 담임 · 정은수 선생님', principal: '📼 제9대 교장 · 한석규', headTeacher: '📼 교무부장 · 권오현', scienceTeacher: '📼 과학부장 · 최동혁 선생님', peTeacher: '📼 체육부장 · 강태식 선생님', librarian: '📼 도서실 사서 · 송지혜 선생님', junho: '📼 전 방송부 3학년 · 이준호', haneul: '🕯 윤하늘 (1998년 3-2 방송부)', friend: '📼 단짝 친구 · 이수아', friend2: '📼 단짝 친구 · 서다은', mina: '📱 선배 박민아 (방송부 3학년)', reporter: '📰 서문일보 · 한진우 기자', dormMother: '📼 청운학사 사감 · 문정희', electrician: '📼 전기 기사 · 배만수', snackLady: '📼 매점 아주머니', narrator: '📖 내레이션' };
  if (id === 'nC') return { id: 'nv_nC_' + (isJ ? 'j' : 's'), fx: 'none', who: pWho };
  if (id === 'n_seomun_ilbo') return { id: 'news_rep', fx: 'radio', who: NV_WHO.reporter };
  if (NV_SPK[id]) { const spk = NV_SPK[id]; return { id: 'nv_' + id, fx: spk === 'mina' ? 'phone' : /^(n_guard_diary|n_principal_tape|n_bunker_audit|q2b)$/.test(id) ? 'radio' : 'none', who: NV_WHO[spk] || '📼 증언' }; }
  const MAP = {
    // 경비원 박종철 아저씨 육성 (충청도 사투리 · 다급함과 걱정)
    n24:              { id: 'mtape_2',   fx: 'none',  who: '🔦 당직 경비원 · 박종철 아저씨' },
    n_guard_diary:    { id: 'mtape_2',   fx: 'radio', who: '🔦 당직 경비원 · 박종철 아저씨' },
    // 보건교사 임소연 선생님 육성 (정전 직후 공포와 떨림)
    n2:               { id: 'tape1',     fx: 'none',  who: '📼 보건교사 · 임소연 선생님' },
    q3a:              { id: 'tape1',     fx: 'none',  who: '📼 보건교사 · 임소연 선생님' },
    // 3-2 담임 정은수 선생님 육성 (결석 기재를 거부한 단호함과 슬픔)
    n27:              { id: 'teacher2',  fx: 'none',  who: '📼 3-2 담임 · 정은수 선생님' },
    q5a:              { id: 'teacher2',  fx: 'none',  who: '📼 3-2 담임 · 정은수 선생님' },
    q5b:              { id: 'teacher2',  fx: 'none',  who: '📼 3-2 담임 · 정은수 선생님' },
    // 제9대 교장 한석규 육성 (위엄 뒤에 숨겨진 무거운 죄책감과 떨림)
    n_principal_tape: { id: 'mtape_5',   fx: 'radio', who: '📼 제9대 교장 · 한석규' },
    h1:               { id: 'mtape_5',   fx: 'none',  who: '📼 제9대 교장 · 한석규' },
    h3:               { id: 'mtape_5',   fx: 'none',  who: '📼 제9대 교장 · 한석규' },
    h4:               { id: 'mtape_5',   fx: 'none',  who: '📼 제9대 교장 · 한석규' },
    h5:               { id: 'mtape_5',   fx: 'none',  who: '📼 제9대 교장 · 한석규' },
    n21:              { id: 'mtape_5',   fx: 'none',  who: '📼 제9대 교장 · 한석규' },
    // 교무부장 권오현 육성 (5인 은폐 지시 및 오열하는 마지막 참회)
    n3:               { id: 'tape3',     fx: 'none',  who: '📼 교무부장 · 권오현' },
    n22:              { id: 'tape5',     fx: 'none',  who: '📼 교무부장 · 권오현 (참회)' },
    n_bunker_audit:   { id: 'tape3',     fx: 'radio', who: '📼 교무부장 · 권오현' },
    // 과학부장 최동혁 선생님 육성 (긴박한 실험실 기록과 후회)
    n5:               { id: 'mtape_3',   fx: 'none',  who: '📼 과학부장 · 최동혁 선생님' },
    n17:              { id: 'mtape_3',   fx: 'none',  who: '📼 과학부장 · 최동혁 선생님' },
    q7a:              { id: 'mtape_3',   fx: 'none',  who: '📼 과학부장 · 최동혁 선생님' },
    // 상담교사 · 사서 선생님 육성 (눈물 섞인 고백과 미안함)
    n25:              { id: 'mtape_1',   fx: 'none',  who: '📼 도서실 사서 · 상담교사' },
    n4:               { id: 'mtape_1',   fx: 'none',  who: '📼 도서실 사서 · 상담교사' },
    n26:              { id: 'mtape_1',   fx: 'none',  who: '📼 도서실 사서 · 상담교사' },
    q4b:              { id: 'mtape_1',   fx: 'none',  who: '📼 상담교사 · 오유진 선생님' },
    q8a:              { id: 'mtape_1',   fx: 'none',  who: '📼 도서실 사서 · 송지혜 선생님' },
    q8b:              { id: 'ghThanks',  fx: 'none',  who: '📞 윤하늘 어머니' },
    // 3-2 윤하늘 육성 (설레는 생전 방송 연습 & 안도의 작별 인사)
    n8:               { id: 'tape4',     fx: 'none',  who: '📞 윤하늘 어머니' },
    n1:               { id: 'tape4',     fx: 'none',  who: '📞 윤하늘 어머니' },
    n18:              { id: 'tape4',     fx: 'none',  who: '📞 윤하늘 어머니' },
    q2b:              { id: 'tape4',     fx: 'radio', who: '🕯 윤하늘 · 수아 · 다은 (하교 방송)' },
    q1b:              { id: 'ghThanks',  fx: 'none',  who: '📞 윤하늘 어머니' },
    q5c:              { id: 'ghThanks',  fx: 'none',  who: '📞 윤하늘 어머니' },
    // 단짝 친구 이수아 & 방송부 후배 서다은 육성 (다정한 우정과 울먹이는 참회)
    n28:              { id: 'echo1',     fx: 'none',  who: '📼 단짝 친구 · 이수아' },
    q2a:              { id: 'echo2',     fx: 'none',  who: '📼 단짝 친구 · 서다은' },
    n23:              { id: 'mtape_4',   fx: 'none',  who: '📼 방송부 2학년 · 서다은' },
    n7:               { id: 'mtape_4',   fx: 'none',  who: '📼 방송부 2학년 · 서다은' },
    n14:              { id: 'mtape_4',   fx: 'none',  who: '📼 방송부 2학년 · 서다은' },
    n29:              { id: 'echo2',     fx: 'none',  who: '📼 방송부 2학년 · 서다은' },
    n_dorm2f_diary:   { id: 'mtape_4',   fx: 'none',  who: '📼 청운학사 사생 · 서다은' },
    q4a:              { id: 'mtape_4',   fx: 'none',  who: '📼 방송부 2학년 · 서다은' },
    q4c:              { id: 'mtape_4',   fx: 'none',  who: '📼 방송부 2학년 · 서다은' },
    // 선배 박민아 육성 (다급한 추격과 떨리는 숨소리)
    n6:               { id: 'phone1',    fx: 'phone', who: '📱 선배 박민아 (방송부 3학년)' },
    n15:              { id: 'phone2',    fx: 'phone', who: '📱 선배 박민아 (방송부 3학년)' },
    q6a:              { id: 'cam1',      fx: 'phone', who: '📱 선배 박민아 (방송부 3학년)' },
    q6b:              { id: 'phone2',    fx: 'phone', who: '📱 선배 박민아 (방송부 3학년)' },
    q6c:              { id: 'mw_' + (isJ ? 'j' : 's'), fx: 'none', who: '📱 선배 박민아 (방송부 3학년)' },
    // 어둠 속 남겨진 아이의 속삭임
    n16:              { id: 'call_unk1', fx: 'phone', who: '📞 발신번호 표시제한 (익명 제보)' },
    h2:               { id: 'call_unk1', fx: 'phone', who: '📞 발신번호 표시제한 (익명 제보)' },
    // 현장 일지를 발견한 주인공(서연/지훈)의 생생한 감정 연기 톤
    n9:               pLine('gym'),
    n10:              pLine('pool'),
    q3b:              pLine('pool'),
    n11:              pLine('b1'),
    q7b:              pLine('breaker'),
    n12:              pLine('tagFound'),
    q1a:              pLine('tagFound'),
    n13:              pLine('cafe'),
    n19:              pLine('needPin'),
    n20:              pLine('needHook'),
    n_seomun_ilbo:    pLine('office'),
    nC:               pLine('arrive'),
  };
  return MAP[id] || pLine('safeOpen');
}
window.__readSeomunNewspaper = () => {
  const isJ = CHAR === 'jihun';
  const protagWho = isJ ? '🎙 박지훈 (현장 추리)' : '🎙 김서연 (현장 추리)';
  stopSpeak();
  line('news_rep', 'radio', '📰 서문일보 사회부 · 한진우 기자').then(() => {
    if (state === 'note') line(isJ ? 'news_j' : 'news_s', 'none', protagWho);
  });
};
function showNote(it) {
  storyCalm(35);
  state = 'note';
  if (it.id === 'n_seomun_ilbo' || it.newspaper) {
    const whoName = CHAR === 'jihun' ? '지훈' : '서연';
    $('note').innerHTML = [
      '<div style="background:#e8dfc8;color:#181512;padding:18px 22px;border:3px double #2b241d;box-shadow:inset 0 0 28px rgba(60,42,20,0.28);font-family:serif;line-height:1.55;max-width:640px;margin:0 auto;text-align:left;">',
        '<div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #181512;padding-bottom:6px;margin-bottom:10px;">',
          '<span style="font-size:11px;font-family:sans-serif;color:#4a3e30;">제4102호 [특별 호외] · 발행처: 서문일보사</span>',
          '<span style="font-size:24px;font-weight:900;letter-spacing:4px;color:#111;white-space:nowrap;">西 門 日 報 <small style="font-size:13px;letter-spacing:0px;">(서문일보)</small></span>',
          '<span style="font-size:11px;font-family:sans-serif;color:#4a3e30;">1998년 10월 13일 (화요일)</span>',
        '</div>',
        '<div style="background:#1c1815;color:#f4ebd4;padding:8px 12px;margin-bottom:12px;text-align:center;">',
          '<div style="color:#ff6850;font-size:11px;font-family:sans-serif;font-weight:bold;letter-spacing:2px;">[긴급 사회면 특보 · 서문경찰서 수사속보]</div>',
          '<div style="font-size:19px;font-weight:900;margin-top:3px;line-height:1.3;">“서문고 3학년 윤하늘 양 심야 실종… 지하 펌프실 폴리스라인 설치”</div>',
        '</div>',
        '<div style="display:grid;grid-template-columns:1.05fr 1.25fr;gap:14px;font-size:12.5px;border-bottom:1.5px solid #5a4e3e;padding-bottom:12px;">',
          '<div style="background:#d8ceb4;border:1px solid #5a4e3e;padding:10px;">',
            '<div style="background:#e6b818;color:#111;font-weight:900;font-family:sans-serif;font-size:11px;text-align:center;padding:3px 0;margin-bottom:6px;border:1px solid #111;">POLICE LINE DO NOT CROSS · 사건현장 통제</div>',
            '<div style="font-weight:bold;color:#7a1c18;margin-bottom:4px;">■ 감식반 현장 증거물 목록 (지하 B1 펌프실)</div>',
            '<div style="font-size:11.5px;line-height:1.45;color:#221d18;">• <b>증거 01호</b>: 복도 쪽 철문 바깥에서 걸린 빗장 (교무부장 보관 열쇠 계통)<br>• <b>증거 02호</b>: 3회 이상 교체 건의가 묵살된 노후 비상등 배선 합선 흔적<br>• <b>증거 03호</b>: 23시 40분에 멈춘 방수 손목시계와 방송 원고</div>',
          '</div>',
          '<div style="text-align:justify;line-height:1.55;color:#1e1914;">',
            '<b>【서문=특별취재반】</b> 지난 12일 밤 11시 20분경 서문고 본관 대정전 직후 방송부 3학년 2반 <b>윤하늘(18)</b> 양이 실종돼 경찰이 지하 배수 펌프실에 폴리스라인을 설치했다.<br>',
            '학교 측은 단순 귀가 지연이라 해명했으나, 당직 경비원의 순찰 일지와 <b>교장실 심야 비상대책회의</b> 정황이 포착되며 조직적 은폐 의혹이 일고 있다.<br>',
            '특히 그날 밤 남아 있던 <b>5명의 책임자(교무실·도서실·과학실·체육관·수영장)</b>가 그날 밤의 원본 기록과 증거를 다섯 몫으로 나눠 각자의 구역에 숨겼다는 증언이 확보됐다. 학교 측은 오늘 아침 추가 취재를 일절 거부했다.',
          '</div>',
        '</div>',
        '<div style="margin-top:10px;display:flex;justify-content:space-between;align-items:center;font-family:sans-serif;">',
          '<span style="font-size:12px;color:#5a281e;font-weight:bold;">📰 서문일보 사회부 한진우 기자 특보 리포팅 & ' + whoName + '의 현장 추리</span>',
          '<button onclick="window.__readSeomunNewspaper()" style="background:#7a241c;color:#fff;border:1px solid #221;padding:5px 12px;font-size:12px;font-weight:bold;cursor:pointer;border-radius:3px;">🔊 뉴스 기자 목소리로 특보 다시 듣기</button>',
        '</div>',
      '</div>'
    ].join('');
    $('noteBox').classList.add('show'); sfx.paper();
    window.__readSeomunNewspaper();
    return;
  }
  const tStr = String(it.title || '기록 문서');
  const isOfficial = /회의록|감사|서약서|진술서|안내문|기록부|보고서|호외/.test(tStr);
  const isLogbook = /일지|점검표|명부|출석부|카드|명단|메모/.test(tStr) && !/일기|편지/.test(tStr);
  const isDiary = /일기|편지|원고|수첩|악보|쪽지|글/.test(tStr);
  const isTape = !!it.tape || /녹취|녹음|테이프/.test(tStr);
  let docHTML = '';
  if (isTape) {
    docHTML = [
      '<div style="background:linear-gradient(180deg,#23201d 0%,#181614 100%);color:#f0e6d2;padding:18px 22px;border:2px solid #6e5a3e;border-radius:6px;box-shadow:0 12px 32px rgba(0,0,0,0.65),inset 0 0 18px rgba(0,0,0,0.6);text-align:left;font-family:sans-serif;line-height:1.65;">',
        '<div style="display:flex;justify-content:space-between;align-items:center;background:#12100e;border:1px solid #4a3c2a;padding:8px 12px;border-radius:4px;margin-bottom:14px;">',
          '<span style="color:#ff5240;font-weight:900;font-size:12px;letter-spacing:1.5px;">● REC // MICRO-CASSETTE TRANSCRIPT</span>',
          '<span style="color:#a89878;font-family:monospace;font-size:11.5px;">TAPE-1998-1012 · SIDE A</span>',
        '</div>',
        '<div style="font-size:18px;font-weight:900;color:#ffdca0;border-bottom:1px solid #4a3c2a;padding-bottom:8px;margin-bottom:12px;">📼 ' + tStr + '</div>',
        (it.img ? '<img class="photo" src="assets/img/' + it.img + '.webp" alt="" style="border:3px solid #3a3228;margin-bottom:12px;">' : ''),
        '<div style="font-size:14px;color:#efe6d5;background:rgba(255,245,220,0.04);padding:12px 14px;border-left:3px solid #d48838;border-radius:2px;">' + it.text + '</div>',
        '<div style="margin-top:12px;display:flex;justify-content:space-between;font-size:11px;color:#9a8c74;font-family:monospace;"><span>AUDIO MAGNETIC ARCHIVE · SEOMUN HIGH</span><span>[클릭 또는 Esc로 닫기]</span></div>',
      '</div>'
    ].join('');
  } else if (isOfficial) {
    docHTML = [
      '<div style="background:#f3ebd8;color:#1a1612;padding:20px 24px;border:2px solid #3a3024;box-shadow:0 14px 36px rgba(0,0,0,0.6),inset 0 0 32px rgba(90,68,38,0.18);text-align:left;font-family:serif;line-height:1.65;position:relative;">',
        '<div style="display:flex;justify-content:space-between;align-items:stretch;border-bottom:2px solid #1a1612;padding-bottom:10px;margin-bottom:14px;">',
          '<div>',
            '<div style="font-size:11px;font-family:sans-serif;color:#6a241c;font-weight:bold;letter-spacing:1.5px;">서문고등학교 대외비 문서 · 제1998-1012호</div>',
            '<div style="font-size:20px;font-weight:900;color:#111;margin-top:4px;">' + tStr + '</div>',
          '</div>',
          '<table style="border-collapse:collapse;font-family:sans-serif;font-size:10.5px;text-align:center;color:#222;background:#ebe1ca;">',
            '<tr><td style="border:1px solid #333;padding:2px 7px;background:#dfd3b8;font-weight:bold;">담 당</td><td style="border:1px solid #333;padding:2px 7px;background:#dfd3b8;font-weight:bold;">교무부장</td><td style="border:1px solid #333;padding:2px 7px;background:#dfd3b8;font-weight:bold;">교 장</td></tr>',
            '<tr><td style="border:1px solid #333;padding:5px 7px;color:#b8281e;font-weight:900;">印</td><td style="border:1px solid #333;padding:5px 7px;color:#b8281e;font-weight:900;">결재印</td><td style="border:1px solid #333;padding:5px 7px;color:#c41e18;font-weight:900;border-radius:2px;">校長印</td></tr>',
          '</table>',
        '</div>',
        (it.img ? '<img class="photo" src="assets/img/' + it.img + '.webp" alt="" style="border:2px solid #4a3e30;margin-bottom:12px;">' : ''),
        '<div style="font-size:14.5px;color:#1c1814;min-height:90px;">' + it.text + '</div>',
        '<div style="margin-top:16px;padding-top:8px;border-top:1px solid #8a7b62;display:flex;justify-content:space-between;align-items:center;font-family:sans-serif;font-size:11px;color:#5a4d3c;">',
          '<span>발행처: 서문고등학교 교무처 · 보존연한: 영구(봉인)</span>',
          '<span style="border:2px solid #b82218;color:#b82218;padding:1px 6px;font-weight:900;transform:rotate(-4deg);display:inline-block;">대 외 비 (極秘)</span>',
        '</div>',
      '</div>'
    ].join('');
  } else if (isLogbook) {
    docHTML = [
      '<div style="background:#ece5d3;color:#1c1915;padding:18px 22px;border-top:10px solid #3a4852;border-left:1px solid #7a6e58;border-right:1px solid #7a6e58;border-bottom:2px solid #5a4e3c;box-shadow:0 12px 30px rgba(0,0,0,0.55),inset 0 0 20px rgba(70,55,35,0.14);text-align:left;font-family:sans-serif;line-height:1.62;">',
        '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #3a4852;padding-bottom:7px;margin-bottom:12px;">',
          '<span style="font-size:18px;font-weight:900;color:#18222a;">📋 ' + tStr + '</span>',
          '<span style="background:#3a4852;color:#f0ead8;font-size:11px;padding:2px 8px;border-radius:3px;">시설 · 근무 점검 기록부</span>',
        '</div>',
        (it.img ? '<img class="photo" src="assets/img/' + it.img + '.webp" alt="" style="margin-bottom:10px;">' : ''),
        '<div style="font-size:14px;color:#201c18;background:#f7f2e6;border:1px solid #b8ac94;padding:12px 14px;">' + it.text + '</div>',
        '<div style="margin-top:10px;text-align:right;font-size:11px;color:#5a5042;">서문고등학교 행정관리실 · 확인필</div>',
      '</div>'
    ].join('');
  } else {
    docHTML = [
      '<div style="background:repeating-linear-gradient(transparent,transparent 27px,rgba(90,115,145,0.22) 28px),linear-gradient(180deg,#f7f0dc 0%,#eadfc4 100%);color:#221c16;padding:20px 24px 18px 34px;border:1px solid #8a785c;box-shadow:0 12px 32px rgba(0,0,0,0.58),inset 24px 0 0 rgba(190,60,50,0.12);text-align:left;font-family:serif;line-height:28px;position:relative;">',
        '<div style="font-size:19px;font-weight:900;color:#2c1e14;margin-bottom:10px;border-bottom:1.5px dashed #7a684c;padding-bottom:4px;">✒ ' + tStr + '</div>',
        (it.img ? '<div style="background:#fff;padding:8px 8px 18px 8px;box-shadow:0 4px 12px rgba(0,0,0,0.28);margin-bottom:12px;transform:rotate(-1.2deg);"><img class="photo" src="assets/img/' + it.img + '.webp" alt="" style="margin:0;width:100%;display:block;"></div>' : ''),
        '<div style="font-size:14.5px;color:#241d16;">' + it.text + '</div>',
        '<div style="margin-top:10px;text-align:right;font-size:11.5px;color:#6e5c44;font-family:sans-serif;">' + (it.img ? '— 빛바랜 폴라로이드 사진 기록' : isDiary ? '— 손글씨 육필 기록' : '— 1998년 현장 보관 기록') + '</div>',
      '</div>'
    ].join('');
  }
  $('note').innerHTML = docHTML;
  $('noteBox').classList.add('show'); it.img ? sfx.photo() : sfx.paper();
  stopSpeak();
  if (it.voiceKey) line(it.voiceKey, 'tape', it.voiceWho || '📼 녹취록 재생');
  else if (it.kind === 'note' && it.id && VS.readNotes) {
    const nv = noteVoiceFor(it.id);
    line(nv.id, nv.fx, nv.who);
  }
}
let noteAfter = null;   // 인트로 직후 호외처럼 문서를 닫은 다음 이어질 진행
let keepNoteVo = false;   // 인트로 직후 호외: 닫아도 더빙은 끝까지
function closeNote() { $('noteBox').classList.remove('show'); if (state === 'note') { state = 'playing'; if (!keepNoteVo) stopSpeak(); } if (noteAfter) { const f = noteAfter; noteAfter = null; f(); } }

/* ---------- 상호작용 ---------- */
let target = null;
const needText = p => p.kind === 'sq' ? sqNeedText(p) : p.kind === 'lock' && p.lockType === 'pick' && !inv.hairpin ? '  — 머리핀 필요' : p.kind === 'drain' && !FL.hook ? '  — 갈고리 필요' : p.kind === 'breaker' && !FL.fuse ? '  — 퓨즈 필요' : p.kind === 'console' && !power ? '  — 전원 없음' : p.kind === 'lock' && p.lockType === 'dial' && !docs.some(d => d.id === p.clue) ? '  — 번호 모름' : '';
function findInteract() {
  if (P.inElev) return elvTarget();
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
  let best = null, bs = 0;
  for (const it of world.items) {
    if (it.taken || it.locked || it.floor !== P.floor) continue;
    if (it.rbY != null && Math.abs(it.rbY - (P.sh || 0)) > 1.6) continue;   // 새 건물: 다른 층
    const dx = it.pos.x - P.x, dz = it.pos.z - P.z, d = Math.hypot(dx, dz);
    if (d > 2.3 || !los(floors[P.floor].walls, P.x, P.z, it.pos.x, it.pos.z) || !los(floors[P.floor].doorWalls || [], P.x, P.z, it.pos.x, it.pos.z)) continue;
    const f = (dx * fx + dz * fz) / Math.max(d, .01);
    const s = f - d * .1; if (f > .72 && s > bs) { bs = s; best = { type: 'item', it, label: it.label }; }
  }
  // 사물함 숨기 기능 제거: 일반 사물함은 모두 파밍(search) 지점으로 작동하며, 화장실 칸막이(stallDoor)만 문을 닫을 수 있다
  for (const l of world.lockers) {
    if (l.floor !== P.floor || l.noPick || !l.stallDoor) continue;
    if (l.rbY != null && Math.abs(l.rbY - (P.sh || 0)) > 1.6) continue;
    const dx = l.x - P.x, dz = l.z - P.z, d = Math.hypot(dx, dz);
    if (d > 1.7 || !los(floors[P.floor].walls, P.x, P.z, l.x, l.z)) continue; const f = (dx * fx + dz * fz) / Math.max(d, .01);
    const s = f - d * .1; if (f > .35 && s > bs) { bs = s; best = { type: 'locker', l, label: l.label || '칸막이 안에 들어가기' }; }
  }
  for (const d of world.doorList) {
    if (d.floor !== P.floor) continue;
    const dzc = d.kind === 'slide' ? (d.z > 0 ? 1.55 : -1.55) : d.z;
    const dx = d.x - P.x, dz = dzc - P.z, dd = Math.hypot(dx, dz);
    if (dd > (d.kind === 'slide' ? 1.9 : 1.4)) continue;
    const f = (dx * fx + dz * fz) / Math.max(dd, .01), s = f - dd * .15 - .15;
    if (f > .2 && s > bs) { bs = s; best = { type: 'idoor', d, label: (d.target > .5 ? `${d.name} 닫기` : `${d.name} 열기`) }; }
  }
  for (const p of world.props) {
    if (p.floor !== P.floor || p.done || (p.after && !p.after.done)) continue;
    if (p.rbY != null && Math.abs(p.rbY - (P.sh || 0)) > 1.6) continue;   // 새 건물: 다른 층
    if (p.floor === 0 && p.rbY == null && p.y != null && inTwoStory(p.x, p.z) && (p.y > 3.2) !== ((P.jy || 0) > 2.5)) continue;   // 청운학사: 2층 물건은 2층에서만 · 1층 물건은 1층에서만   /* after: 수색을 마친 뒤에야 나오는 조사 (사물함 문 여닫기) */
    let dx = p.x - P.x, dz = p.z - P.z, dd = Math.hypot(dx, dz);
    if (p.kind === 'switch') {   // 스위치: 벽 앞쪽(방 안)에서, 스위치를 바라볼 때만
      if ((P.x - p.px) * (p.x - p.px) + (P.z - p.pz) * (p.z - p.pz) <= 0) continue;
      dx = p.px - P.x; dz = p.pz - P.z; dd = Math.hypot(dx, dz); if (dd > 1.7) continue;
      const f2 = (dx * fx + dz * fz) / Math.max(dd, .01); if (f2 < .55) continue;
      const s2 = f2 - dd * .2 - .1; if (s2 > bs) { bs = s2; best = { type: 'prop', p, label: `${p.name ? p.name + ' ' : ''}형광등 ${p.on ? '끄기' : '켜기'}` }; } continue;
    }
    if (dd > Math.min(p.r || 1.6, p.kind === 'piano' || p.kind === 'console' || p.kind === 'mina' ? 2.2 : 1.7)) continue;   // 멀리서 뜨지 않게: 그 물건 바로 앞(1.7m 안)에서만
    if (RBG && p.rbY != null && dd > .5) { let blk = false; const reach = Math.max(0, dd - .6); for (let t = .25; t < 1.001 && reach > .2; t += .25) { const x = P.x + dx / dd * reach * t, z = P.z + dz / dd * reach * t; if (RBG.blocked(x, z, (P.sh || 0) + 1.25, .04)) { blk = true; break; } } if (blk) continue; }   // 새 건물 벽 · 칸막이 너머는 X
    if (p.minSh != null && (P.sh || 0) < p.minSh) continue;   // 계단 위 문: 그 높이에 올라왔을 때만
    // 벽 너머(복도에서 교실 안 · 바깥에서 실내) 조사 지점은 고르지 않는다: 플레이어 → 지점 쪽으로 0.35m 당긴 점까지 벽 · 닫힌 문에 막히는지
    if (dd > .45 && p.kind !== 'switch') { const k = Math.max(0, dd - .35) / dd, tx = P.x + dx * k, tz = P.z + dz * k, F = floors[P.floor];
      if (!los(F.walls, P.x, P.z, tx, tz) || !los(F.doorWalls || [], P.x, P.z, tx, tz)) continue; }
    const f = (dx * fx + dz * fz) / Math.max(dd, .01), s = f - dd * .1 + (p.kind === 'search' ? -.05 : .1);   // 수색은 숨기(사물함)보다 뒤로 — 쫓길 때 숨는 게 먼저
    if (f > (p.kind === 'search' ? .6 : dd < .8 ? .2 : .55) && s > bs) { bs = s; best = { type: 'prop', p, label: p.label + needText(p) }; }   // 그 물건을 바라볼 때만 (약 ±55°)
  }
  if (!best) {
    const si = STAIRS[P.floor];
    const inStair = !si || (RBG && P.floor === 0) ? false : P.floor === 3 ? (Math.abs(P.x) < 4.5 && P.z < -4.35 && P.z > -9.5) : (() => { const z = floors[P.floor].stairZone || { x1: -1, x2: 4, z1: -9.3, z2: -2 }; return P.x > z.x1 && P.x < z.x2 && P.z > z.z1 && P.z < z.z2; })();
    const dr = world.doors.find(d => !d.seamless && d.floor === P.floor && (d.rbY == null || Math.abs(d.rbY - (P.sh || 0)) < 1.6) && Math.hypot(d.x - P.x, d.z - P.z) < d.r);
    if (inStair && floors[P.floor].stairCx == null && P.floor !== 3 && !(dr && Math.hypot(dr.x - P.x, dr.z - P.z) < 1.5)) {   // 걸어 다니는 계단이 있는 층은 순간이동 없음
      const up = si.up != null, down = si.down != null;
      const ul = si.up === 3 ? '옥상으로' : si.up === 0 ? '1층으로' : '위층', dl = si.down === 4 ? '지하층 (B1)' : '아래층';
      best = { type: 'stairs', label: [up ? `E 길게 · ${ul}` : '', down ? `Q · ${dl}` : ''].filter(Boolean).join('  /  '), raw: true };
    } else if (dr) best = { type: 'door', d: dr, label: dr.label + (dr.need && !FL.gatekey ? ' 🔒' : '') };
    else if (P.floor === 0 && P.z > GATE_Z - 4.2 && P.z < GATE_Z + 2.8 && Math.abs(P.x) < 2.8 && (gateClosed || FL.gatekey) && !escaped) best = { type: 'gate', label: gateClosed ? '봉인된 정문 열고 학교의 비밀 폭로하기' : '정문을 통해 학교의 비밀을 세상에 폭로하기' };
  }
  if (!best && RBG && P.floor === 0) { const e = RBG.nearElev(P.x, P.z, P.sh || 0); if (e) { const E = e.E, here = !e.inCar && Math.abs(E.y - e.rbY) < .05 && !E.moving; best = { type: 'rbelev', e, raw: true, label: E.moving ? `엘리베이터 운행 중… (${Math.round(E.y / E.b.spec.FH) + 1}층)` : e.inCar ? `E · 층 버튼 누르기  (${E.b.name} 엘리베이터 · 지금 ${e.f + 1}층)` : here ? `E · 엘리베이터 문 열기 (${E.b.name} ${e.f + 1}층)` : `E · 엘리베이터 호출 (지금 ${Math.round(E.y / E.b.spec.FH) + 1}층)` }; } }
  if (!best && RBG && P.floor === 0) { const d = RBG.nearDoor(P.x, P.z, P.sh || 0); if (d) best = { type: 'rbdoor', d, label: `${d.label || '문'} ${d.target > .5 ? '닫기' : '열기'}` }; }
  return best;
}
function interact() {
  if (!target) return;
  if (target.type === 'rbdoor') { RBG.toggleDoor(target.d); sfx.door && sfx.door(); return; }
  if (target.type === 'rbelev') { rbElev(target.e, 1); return; }
  if (target.type === 'item') {
    triggerInteractAnim('low');
    const it = target.it;
    if (it.kind === 'key' && got[it.idx]) { it.taken = true; it.mesh.visible = false; return; }   // 다른 경로(구역 미션)로 이미 얻은 조각
    if (it.kind === 'note') { readNote(it); return; }
    if (it.kind === 'photo') { if (!it.taken) { it.taken = true; it.mesh.visible = false; addDoc({ id: it.id, kind: 'photo' }); toast('사진을 획득했습니다', it.title + ' — 휴대폰 사진첩에 저장', 'info'); refreshHud(); } showNote(it); return; }
    it.taken = true; it.mesh.visible = false;
    if (it.kind === 'key') {
      got[it.idx] = true; P.keys++; sfx.key(); if (it.idx === 0 && !FL.b1Open) setTimeout(() => toast('🔑 열쇠 꾸러미', '금고 안 증거 봉투에 녹슨 열쇠 꾸러미가 함께 있다 — 꼬리표 「B1 철문 · B-07」. 지하 B1 철문(본관 중앙 계단 아래)을 열 수 있다.', 'info'), 1600); newItems.add('keypiece'); setFace(P.keys < TOTAL ? 'resolve' : 'relief', 3);
      toast('학교 비밀 증거를 확보했습니다', `${KEY_NAMES[it.idx]} 은폐 비밀 증거 (${P.keys}/${TOTAL})`);
      talk(P.keys < TOTAL ? 'key' : 'keyLast', 3000);
      if (P.keys === 1) setTimeout(() => phoneMessage(1), 9000);
      if (P.keys === 1) activateGhost();
      if (P.keys === 3) setTimeout(() => phoneMessage(2), 14000);
      if (P.keys === TOTAL && !FL.keyhead) setTimeout(() => { toast('학교의 5대 비밀 증거를 모두 모았습니다', '…이를 하나로 결속할 교장 직인 마스터 코어를 교장실과 별관에서 찾아내자', 'opt'); talk('headMissing', 3400); }, 3200);
      refreshHud(); save(true);
    } else if (it.kind === 'camcorder') {
      FL.cam = true; newItems.add('camcorder'); sfx.pickup(); toast('아이템을 획득했습니다', '민아의 캠코더 — 녹화 파일이 남아 있다');
      addDoc({ id: 'cam1', kind: 'cam' }); addClue('cam'); refreshHud();
      setTimeout(playCam, 700); save(true);
    } else if (it.kind === 'nametag') {
      FL.tag = true; FL.opt = true; newItems.add('nametag'); sfx.key(); setFace('calm', 3);
      toast('이름 단서 발견', '방송 기록 속 윤하늘의 명찰을 찾았다', 'opt'); talk('tagFound', 3600); addClue('tag'); refreshHud(); save(true);
    } else if (it.kind === 'hairpin' || it.kind === 'can') {
      inv[it.kind]++; newItems.add(it.kind); sfx.pickup(); toast('아이템을 획득했습니다', `${ITEMS[it.kind].name} (보유 ${inv[it.kind]})` + (it.kind === 'can' ? ' — G 키로 던지기' : ''));
      refreshHud();
    } else if (it.kind === 'fuse' || it.kind === 'mop' || it.kind === 'wire') {
      FL[it.kind] = true; newItems.add(it.kind); sfx.pickup(); toast('아이템을 획득했습니다', ITEMS[it.kind].name + (it.kind === 'fuse' ? ' — 지하 전기실 차단기' : ' — 소지품에서 조합'));
      if (it.kind === 'fuse') addClue('fuse');
      if ((it.kind === 'mop' && FL.wire) || (it.kind === 'wire' && FL.mop)) setTimeout(() => toast('조합 가능', '대걸레 자루 + 철사 → 갈고리 장대 (소지품 › 열쇠 아이템 › 조합)', 'info'), 1500);
      refreshHud(); save(true);
    } else if (it.kind === 'battery') { inv.battery++; newItems.add('battery'); sfx.pickup(); toast('아이템을 획득했습니다', '건전지 (2번 키로 사용)'); refreshHud(); }
    else { inv.medkit++; newItems.add('medkit'); sfx.pickup(); toast('아이템을 획득했습니다', '응급 밴드 (3번 키로 사용)'); refreshHud(); }
  } else if (target.type === 'locker') enterLocker(target.l);
  else if (target.type === 'stairs') changeFloor(1);
  else if (target.type === 'door') {
    const d = target.d;
    if (d.win) {
      if (!FL.gatekey) { sfx.click(); if (P.keys >= TOTAL) talk('needCombine'); say(d.locked, 2800); return; }
      escaped = true; sfx.gateOpen(); say('쇠사슬이 힘없이 끊어졌다…', 3000); winGame(); return;
    }
    if (d.locked) { sfx.click(); say(d.locked, 2600); return; }
    if (d.to && d.to.floor === 4 && d.floor !== 4 && !FL.b1Open && d.floor !== 0) { sfx.click(); say('아래쪽 출입구가 철망으로 막혀 있다. 지하로 가는 길은 본관 계단의 철문뿐이다.', 2800); return; }
    if (d.needPower && !power) { sfx.click(); say('철제 덮개가 전자 잠금으로 묶여 있다 — B1 전기실에서 전력을 먼저 복구해야 한다', 3200); addClue('fuse'); return; }
    if (d.needPower && !FL.ev14) { FL.ev14 = true; sfx.alert(); fx.glitch(.4); blackout = .3; caption('삐— 붉은 경광등이 돌며 덮개 잠금이 풀렸다'); }
    if (passDoorBlocked(d)) { sfx.click(); at(.8, 1.2, PASS.doorZ).doorBang(0, .6); say(d.floor === 8 ? '방화문에 반대편에서 빗장이 걸려 꿈쩍도 하지 않는다' : '방화문이 닫혀 빗장이 걸려 있다 — 열려면 방화문에서 E', 2800); return; }
    if (d.need && !FL.gatekey) { sfx.click(); say(`굳게 봉인되어 있다. 『서문고 진상 규명 마스터 기록부』가 있어야 열린다 (비밀 증거 ${P.keys}/${TOTAL})`, 2600); return; }
    if (d.blastDoor) {
      sfx.clank ? sfx.clank(.85) : sfx.doorHinge?.();
      triggerInteractAnim('heavy');
      let bt = 0;
      const biv = setInterval(() => {
        bt += 0.08;
        if (d.blastDoor.wheelPiv) d.blastDoor.wheelPiv.rotation.z = bt * 3.2;
        if (d.blastDoor.doorPiv && bt > 0.25) d.blastDoor.doorPiv.rotation.y = -Math.min(1.15, (bt - 0.25) * 1.8);
        if (bt >= 1) { clearInterval(biv); setTimeout(() => { if (d.blastDoor.doorPiv) d.blastDoor.doorPiv.rotation.y = 0; }, 900); }
      }, 24);
    }
    teleport(d.to);
  }
  else if (target.type === 'gate') openGate();
  else if (target.type === 'idoor') { triggerInteractAnim('reach'); toggleDoor(target.d); }
  else if (target.type === 'prop') useProp(target.p);
}
function toggleDoor(d, silent) {
  if (d.target < .5 && !d.locked) doorDir(d, P.x, P.z);   // 여는 방향 (§18)
  if (d.locked && d.target < .5) { at(d.x, floors[d.floor].y0 + 1.1, d.z).knock(); say('안에서 잠겨 있다… 녹슨 잠금쇠가 안쪽으로 걸려 있다', 2400); return; }   // 여자화장실 3번 칸
  if (d.target > .5) {
    const r = d.rect, m = .33;
    if (P.floor === d.floor && P.x > r.x1 - m && P.x < r.x2 + m && P.z > r.z1 - m && P.z < r.z2 + m) { say('문틀에서 비켜야 닫을 수 있다', 1600); return; }
    d.target = 0;
  } else d.target = 1;
  if (!silent) { if (d.door2) { const sp = at(d.x, floors[d.floor].y0 + 1.2, d.z); d.target > .5 ? sp.doorOpen() : sp.doorClose(d.kind === 'slide' ? .45 : .38); } else d.kind === 'slide' && !d.leaves ? sfx.doorSlide() : sfx.doorHinge(); P.noiseT = .6; }
}

function readNote(it) {
  if (it.id === 'nC') { it.title = CHAR_NOTE[CK()].title; it.text = CHAR_NOTE[CK()].text; }
  if (!it.taken) {
    it.taken = true; it.mesh.visible = false; addDoc({ id: it.id, kind: 'note' }); toast('새로운 문서를 획득했습니다', it.title, 'info');
    if (CLUES[it.id]) addClue(it.id);
    if (['n7', 'n8', 'n12', 'n14', 'n22', 'n23', 'n24', 'nC'].includes(it.id)) unlockOptional();
    if (it.id === 'n27' && !VS.readNotes) setTimeout(() => line('teacher2'), 1800);
    if (it.id === 'n24' && docs.some(d => d.id === 'n23') || it.id === 'n23' && docs.some(d => d.id === 'n24')) setTimeout(() => toast('⚠ 증언 불일치', '방송부원과 경비의 말이 다르다 — 휴대폰 › 사건 연표', 'opt'), 1600);
    refreshHud();
  }
  showNote(it);
}
function activateGhost() {}   // 귀신 삭제
function enrage() {
  if (TEST && TST.noGhost) return;
  caption('이제 정문으로 돌아가자');
  const epoch=storySession;setTimeout(() => phoneMessage(3,epoch), 16000);
}

const STAIRS = { 0: { up: 1, down: 4 }, 1: { up: 2, down: 0 }, 2: { up: 3, down: 1 }, 3: { down: 2 }, 4: { up: 0 }, 8: { up: 9 }, 9: { up: 10, down: 8 }, 10: { down: 9 } };
async function rbElev(e, dir) {
  if (e.inCar && RBG.elevGo) {   // 칸 안: 조작반에서 갈 층을 고른다 (본관 1~4층 · 별관 1~3층)
    const E = e.E, nf = await choose(`${E.b.name} 엘리베이터 조작반`, `지금 <b>${e.f + 1}층</b> — 갈 층 버튼을 누른다`, Array.from({ length: e.n }, (_, k) => ({ label: `${k + 1}층${k === e.f ? ' (현재 층)' : ''}`, sub: elvFloorNote(E.b.name, k) })));
    sfx.elevatorButton ? sfx.elevatorButton() : sfx.click(); const r = RBG.elevGo(e, nf); if (r === 'here') say('문이 다시 열린다', 1000); return; }
  rbElevStep(e, dir); }
function elvFloorNote(bn, k) { return bn === '본관' ? ['1학년 교실 · 교무실 · 보건실', '2학년 교실 · 교장실 · 도서실', '3학년 교실 · 진로상담실', '방송실 · 컴퓨터실 · 옥상 계단'][k] || '' : ['음악실 · 미술실 · 가정실', '과학실 · 도서실 · 자율학습실', '3학년 6~9반'][k] || ''; }
function rbElevStep(e, dir) { if (!e.inCar && dir < 0) dir = 1; const r = RBG.elevAct ? RBG.elevAct(e, dir) : null; sfx.elevatorButton ? sfx.elevatorButton() : sfx.click(); if (r === 'end') say('더 갈 층이 없다', 1200); else if (r === 'call') say('엘리베이터를 불렀다 — 칸이 오는 소리가 들린다', 1800); }
function teleport(to) {
  if (state !== 'playing') return;
  if (RBG) to = RBG.mapTeleport(to, P.floor, world);   // 새 건물: B1 · 옥상 · 예전 층으로 가는 이동은 새 건물의 같은 자리로
  state = 'trans'; $('fade').style.opacity = 1; sfx.stairs();
  setTimeout(() => {
    P.floor = to.floor; P.x = to.x; P.z = to.z; P.yaw = to.yaw; P.pitch = 0; P.sh = to.sh ?? null; P.shV = to.sh ?? 0; toastFloor(to.floor);
    if (to.floor === 3 && !P.roofSeen) { P.roofSeen = true; refreshHud(); setTimeout(() => talk('roof', 3200), 600); }
    if (to.floor === 4 && !P.b1Seen) { P.b1Seen = true; setTimeout(() => talk('b1', 3000), 600); }
    if (to.floor === 5 && !P.gymSeen) { P.gymSeen = true; setTimeout(() => talk('gym', 3400), 600); }
    if (to.floor === 7 && !P.cafeSeen) { P.cafeSeen = true; setTimeout(() => talk('cafe', 3400), 600); }
    if (to.floor === 6 && !P.poolSeen) { P.poolSeen = true; setTimeout(() => talk('pool', 3400), 600); }
    $('fade').style.opacity = 0; state = 'playing';
  }, 700);
}
function changeFloor(dir) {
  const info = STAIRS[P.floor]; const nf = info && (dir > 0 ? info.up : info.down); if (nf == null) return;
  const sz = floors[nf].stairZone; teleport(nf === 3 ? { floor: 3, x: 0, z: -7.5, yaw: 0 } : { floor: nf, x: sz ? sz.spawn.x : (floors[nf].stairCx||0)+.8, z: sz ? sz.spawn.z : -5.2, yaw: Math.PI });
}
// 가구 높이: 발이 윗면보다 높으면 그 가구는 막지 않는다 · 발 아래 윗면이 지지면
// 낮은 단(계단 한 단 높이 STEP_UP 이하: 현관 계단 · 단상 등)은 그냥 걸어 올라가고, 그보다 높은 가구는 점프로 오른다
const STEP_UP = .34, _nearCols = [];
const colsAt = F => {
  _nearCols.length = 0;
  const foot = P.jy || 0, px = P.x, pz = P.z, cols = F.col;
  for (let i = 0, n = cols.length; i < n; i++) {
    const r = cols[i];
    if (r.off || (r.h != null && r.h <= foot + STEP_UP) || (r.y0 != null && foot + 1.5 < r.y0) || (r.maxY != null && foot > r.maxY)) continue;
    if (px > r.x1 - 2.5 && px < r.x2 + 2.5 && pz > r.z1 - 2.5 && pz < r.z2 + 2.5) _nearCols.push(r);
  }
  return _nearCols;
};
function supportAt(F, x, z, foot) {
  let s = 0; for (const r of F.col) if (r.h != null && r.h <= foot + STEP_UP && r.h > s && x > r.x1 - .1 && x < r.x2 + .1 && z > r.z1 - .1 && z < r.z2 + .1) s = r.h;
  return s;
}
// 걸어서 오르내리는 계단 (world.js stairRoom): 1번 계단(서쪽, 북쪽으로 오름 0→2.0m) → 층참 → 2번 계단(동쪽, 남쪽으로 오름 2.0→4.0m = 위층 바닥)
// 2번 계단 꼭대기를 지나면 위층, 위층에서 2번 계단 칸으로 들어서면 아래층 계단 꼭대기로 이어진다
const STK = .2 / .48, SZB = -2.9, SZL = -7.7, SLND = FH / 2;   // 한 단 0.2m · 너비 0.48m, 층참 2.0m — 2번 계단 꼭대기 = 위층 바닥 (world.js stairRoom 과 같은 치수)
function stairH(F, x, z) {
  const c = F.stairCx; if (c == null || x < c - 3.85 || x > c - 1.2 || z > SZB || z < -9.6) return null;
  if (F.f === 10) return (x >= c - 2.5 && z > SZB - .85) ? Math.min(FH, SLND + (z - SZL) * STK) : null; // 별관 3층(맨 위층)은 위층 오름 계단이 없고, 동쪽 내림 계단 진입부만 아래층(9층) 연결용으로 판정!
  if (z <= SZL) return SLND;
  return x < c - 2.5 ? Math.min(SLND, (SZB - z) * STK) : Math.min(FH, SLND + (z - SZL) * STK);
}
function stairStep(px, pz) {
  const F = floors[P.floor], c = F ? F.stairCx : null;
  if (c == null) return false;
  const h = stairH(F, P.x, P.z), hp = stairH(F, px, pz), lane2 = P.x >= c - 2.5;
  const info = STAIRS[P.floor] || {};
  // 1) 2번 계단(동쪽 오름 계단) 꼭대기(z = SZB)에 도달하면 순간이동/좌표 점프 없이 연속된 위치 그대로 위층 바닥(P.sh = 0)으로 이어진다!
  if (lane2 && P.z > pz && (P.sh || 0) > FH - .45 && (h == null ? P.z >= SZB - .05 : (P.z >= SZB - .02 && h >= FH - .02))) {
    const nf = info.up; if (nf == null) { P.sh = 0; P.shV = 0; P.z = Math.max(P.z, SZB + .04); return false; }
    if (nf === 3) { P.x = px; P.z = pz; if (performance.now() > (P.roofCD || 0)) { P.roofCD = performance.now() + 4000; roofDoor(false); } return true; }
    const NF = floors[nf]; if (!NF || NF.stairCx == null) { P.x = px; P.z = pz; return true; }
    const prevShV = P.shV ?? P.sh ?? FH;
    P.floor = nf; P.x += NF.stairCx - c;
    P.z = Math.max(P.z, SZB + .04);
    P.sh = 0;
    P.shV = Math.max(0, prevShV - FH);
    stairArrive(nf); return false;
  }
  // 2) 위층 계단참에서 2번 계단(동쪽 내림 계단)으로 걸어 들어서면 순간이동/좌표 점프 없이 연속된 위치 그대로 아래층 계단 꼭대기로 이어진다!
  if (h != null && (P.sh == null || P.sh < .45) && h > FH - .85 && lane2 && P.z > SZB - .75) {
    const nf = info.down, NF = nf != null && floors[nf];
    if (NF && NF.stairCx != null) {
      const prevShV = P.shV ?? P.sh ?? 0;
      P.floor = nf; P.x += NF.stairCx - c;
      P.sh = stairH(NF, P.x, P.z) ?? FH;
      P.shV = prevShV + FH;
      stairArrive(nf); return false;
    }
  }
  if (P.floor === 10) { P.sh = 0; return false; }
  if (P.sh == null || (hp == null ? P.sh > .3 && h == null : Math.abs(hp - P.sh) > .55)) P.sh = hp ?? (h != null && h < .55 ? h : 0);
  if (h == null) { if (P.sh > .35) { P.x = px; P.z = pz; return true; } P.sh = 0; return false; }
  if (Math.abs(h - P.sh) > .55) { P.x = px; P.z = pz; return true; }
  P.sh = h;
  return false;
}
// 옥상 문: 3층 계단 꼭대기의 철문을 열면 옥상 계단탑 앞, 옥상 계단탑 문을 열면 3층 계단 꼭대기(내려가면 3 → 2 → 1층 → B1)
const ROOF = { open: false };
function roofDoor(fromRoof) {
  if (state !== 'playing') return;
  sfx.creak ? sfx.creak() : sfx.doorHinge(); ROOF.open = true; ROOF.anim = 1;
  state = 'trans'; $('fade').style.opacity = 1;
  setTimeout(() => {
    if (fromRoof) { const F = floors[2], c = F.stairCx; P.floor = 2; P.x = c - 1.85; P.z = SZB - .45; P.sh = stairH(F, P.x, P.z) ?? FH - .2; P.shV = 0; P.yaw = 0; P.pitch = -.25; toastFloor(2); }
    else { P.floor = 3; P.x = 0; P.z = -6.0; P.sh = 0; P.shV = 0; P.yaw = 0; P.pitch = 0; toastFloor(3); }   // 계단탑(z −4.5 ~ 1.9) 북쪽 문 밖, 옥상 쪽을 보고 선다
    sfx.doorBang ? sfx.doorBang(0, .6) : 0; $('fade').style.opacity = 0; state = 'playing';
    setTimeout(() => { ROOF.open = false; sfx.doorHinge && sfx.doorHinge(); }, 1500);   // 뒤에서 문이 천천히 닫힌다
  }, 650);
}
function stairArrive(f) {
  sfx.step(false, .8, 'tile');
  if (f === 4 && !P.b1Seen) { P.b1Seen = true; setTimeout(() => talk('b1', 3000), 400); }
  toastFloor(f);
}
const FLOOR_LABEL = { 0: '본관 1층', 1: '본관 2층', 2: '본관 3층', 3: '옥상', 4: '지하 1층 (B1)', 5: '체육관', 6: '수영장', 7: '급식실', 8: '별관 1층', 9: '별관 2층', 10: '별관 3층' };
function toastFloor(f) { const t = $('floorTag'); if (!t) return; t.textContent = FLOOR_LABEL[f] || ''; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 1800); }
// 엘리베이터: 직접 타고 움직인다 — 바깥 호출 버튼(E) → 문이 열리면 걸어 들어간다 → 안쪽 벽의 버튼 패널을 바라보고 E → 문이 닫히고 카가 움직인다 → 도착하면 걸어 나간다
// One real cabin docks inside the stairwell footprint at each landing. No off-map room or portal teleport.
const EL_SET = { main: [4, 0, 1, 2], annex: [8, 9, 10] };
const EL_BTN = { 4: 'B1', 0: '1', 1: '2', 2: '3', 8: '1', 9: '2', 10: '3' };
const ELV = { token:0, g: null, doors: [], open: 0, want: 0, cur: 0, p: null, moving: false, btns: [], disp: null, ray: new THREE.Raycaster(), hallT: [] };
function elvBuild() {
  if (ELV.g) return;
  const g = new THREE.Group(); g.rotation.y=-Math.PI/2; g.visible=false; scene.add(g); ELV.g = g;
  // 사용자 제공 엘리베이터 시트(A-102 평면 · A-204 모델 뷰 · A-205 재질표) 기준: 카 안쪽 1.7 × 1.6m (5'6" × 5'0")
  //   A 조명 천장 패널(격자) · B 목재 무늬 벽판(세로 줄눈) · F 스테인리스 벽(조작반 쪽) · D 뒷벽 거울 · H 석재 타일 바닥 + 스테인리스 걸레받이 · C 원형 스테인리스 손잡이 · J 조작반(파란 표시창 · 버튼) · E 문 위 표시등
  const cvT = (w, h, draw, rep = [1, 1]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); return t; };
  const woodT = cvT(256, 512, (x, w, h) => { x.fillStyle = '#8a5a32'; x.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { x.strokeStyle = `rgba(${60 + Math.random() * 40},${35 + Math.random() * 20},15,${.15 + Math.random() * .2})`; x.lineWidth = 1 + Math.random() * 2; const xx = Math.random() * w; x.beginPath(); x.moveTo(xx, 0); x.bezierCurveTo(xx + 8, h * .3, xx - 8, h * .7, xx + 3, h); x.stroke(); }
    x.fillStyle = 'rgba(30,18,8,.85)'; x.fillRect(w - 3, 0, 3, h); }, [3, 1]);   // 세로 줄눈 (판 3장)
  const slateT = cvT(256, 256, (x, w, h) => { x.fillStyle = '#2c3032'; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const v = 30 + Math.random() * 30; x.fillStyle = `rgba(${v},${v + 4},${v + 6},.5)`; x.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 10, 1 + Math.random() * 3); } x.strokeStyle = '#15181a'; x.lineWidth = 3; x.strokeRect(0, 0, w, h); }, [2, 2]);
  const ceilT = cvT(256, 256, (x, w, h) => { x.fillStyle = '#efe6d2'; x.fillRect(0, 0, w, h); x.strokeStyle = '#8a8478'; x.lineWidth = 6; [0, 128, 256].forEach(v => { x.beginPath(); x.moveTo(v, 0); x.lineTo(v, h); x.moveTo(0, v); x.lineTo(w, v); x.stroke(); });
    x.fillStyle = 'rgba(120,110,95,.35)'; for (let i = 0; i < 400; i++) x.fillRect(Math.random() * w, Math.random() * h, 3, 1); }, [1, 1]);
  const steel = new THREE.MeshStandardMaterial({ color: 0xa8aeb2, roughness: .32, metalness: .85 }), steelD = new THREE.MeshStandardMaterial({ color: 0x80868a, roughness: .45, metalness: .8 });
  const wood = new THREE.MeshStandardMaterial({ map: woodT, roughness: .55, metalness: 0 }), dark = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: .8, metalness: .2 });
  const floorM = new THREE.MeshStandardMaterial({ map: slateT, roughness: .7, metalness: .05 }), mirror = new THREE.MeshStandardMaterial({ color: 0x8a9298, roughness: .18, metalness: .55, emissive: 0x1a1e22 });
  const S = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .62, metalness: .45, ...o });
  const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  const H = 2.45;
  box(1.8, .05, 1.7, 0, -.025, -.8, floorM); box(1.8, .06, 1.7, 0, H + .03, -.8, dark);
  box(.05, H, 1.7, -.875, H / 2, -.8, wood);                       // B 왼쪽 벽: 목재
  box(.05, H, 1.7, .875, H / 2, -.8, steel);                       // F 오른쪽 벽(조작반): 스테인리스
  box(1.8, H, .05, 0, H / 2, -1.625, wood);                        // B 뒷벽: 목재
  box(.62, 1.15, .012, 0, 1.45, -1.597, mirror); box(.66, .03, .02, 0, 2.04, -1.595, steelD); box(.66, .03, .02, 0, .86, -1.595, steelD);   // D 뒷벽 거울 + 테
  [[1.75, .02, -1.598, 0], [.02, 1.66, -.8, -.85], [.02, 1.66, -.8, .85]].forEach(([w, d, z, x]) => box(w, .12, d, x, .06, z, steelD));   // H 걸레받이
  box(.35, H, .06, -.7, H / 2, 0, steel); box(.35, H, .06, .7, H / 2, 0, steel); box(1.05, H - 2.1, .06, 0, 2.1 + (H - 2.1) / 2, 0, steel);   // 앞벽 (스테인리스)
  { const hr = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: .2, metalness: 1 }), tb = (x1, z1, x2, z2) => { const L = Math.hypot(x2 - x1, z2 - z1), m = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, L, 10), hr); m.rotation.z = Math.PI / 2; m.rotation.y = -Math.atan2(z2 - z1, x2 - x1); m.position.set((x1 + x2) / 2, .92, (z1 + z2) / 2); g.add(m); };
    tb(-.8, -1.4, -.8, -.25); [-1.4, -.25].forEach(z => box(.06, .03, .03, -.83, .92, z, hr)); tb(-.6, -1.55, .6, -1.55); [-.6, .6].forEach(x => box(.03, .03, .06, x, .92, -1.58, hr)); }   // C 원형 손잡이 (왼쪽 · 뒤)
  const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1.7,1.6),new THREE.MeshStandardMaterial({map:ceilT,color:0xece7dc,roughness:.7}));
  lamp.rotation.x=Math.PI/2;lamp.position.set(0,H-.005,-.8);g.add(lamp);
  const diffuser=new THREE.MeshBasicMaterial({color:0xfff2d5});
  [-.48,.48].forEach(x=>{box(.31,.045,1.18,x,H-.045,-.8,steelD);box(.26,.012,1.1,x,H-.075,-.8,diffuser);});
  ELV.light=null;ELV.lamp=lamp; // Cabin uses the existing four-light pool; no new shader light variant.
  [-.25, .25].forEach(dx => { const d = box(.52, 2.1, .03, dx, 1.05, .02, steel); d.userData.x0 = dx; ELV.doors.push(d); });
  // 층 표시기 (문 위 안쪽)
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 48; const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const dsp = new THREE.Mesh(new THREE.PlaneGeometry(.3, .11), new THREE.MeshBasicMaterial({ map: tx })); dsp.position.set(0, 2.25, -.04); dsp.rotation.y = Math.PI; g.add(dsp);
  ELV.disp = (t, dir = '') => { const c = cv.getContext('2d'); c.fillStyle = '#04070e'; c.fillRect(0, 0, 128, 48); c.fillStyle = '#5aa8ff'; c.shadowColor = '#2a70ff'; c.shadowBlur = 8; c.font = 'bold 34px monospace'; c.textAlign = 'center'; c.fillText(`${dir}${t}`, 64, 37); c.shadowBlur = 0; tx.needsUpdate = true; };
  // 버튼 패널 (문 오른쪽 안 벽 — 들어서서 오른쪽)
  box(.025, 1.1, .3, .855, 1.2, -.3, steelD);   // J 조작반 (스테인리스 판)
  { const cd = new THREE.Mesh(new THREE.PlaneGeometry(.16, .09), new THREE.MeshBasicMaterial({ map: tx })); cd.position.set(.84, 1.66, -.3); cd.rotation.y = -Math.PI / 2; g.add(cd); }   // 조작반 위 표시창 (같은 층 표시)
  ELV.panel = { x: .84 };
  g.traverse(o => { o.userData.dynamic = true; });
}
function elvButtons(set) {
  ELV.btns.forEach(b=>{b.mesh.removeFromParent();b.mesh.geometry.dispose();b.mesh.material.map?.dispose();b.mesh.material.dispose();}); ELV.btns = [];
  const order = set.slice().sort((a, b) => (a === 4 ? -1 : b === 4 ? 1 : a - b)).reverse();
  const list = [...order.map(f => ({ a: 'f', f, t: EL_BTN[f] })), { a: 'open', t: '◀▶' }, { a: 'close', t: '▶◀' }, { a: 'bell', t: '🔔' }];
  list.forEach((b, i) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d');
    c.fillStyle = '#9aa0a4'; c.beginPath(); c.arc(32, 32, 30, 0, 7); c.fill(); c.strokeStyle = b.a === 'bell' ? '#e04030' : '#4a90ff'; c.lineWidth = 3; c.beginPath(); c.arc(32, 32, 26, 0, 7); c.stroke(); c.fillStyle = b.a === 'bell' ? '#c8a040' : '#d8dcdc'; c.beginPath(); c.arc(32, 32, 23, 0, 7); c.fill(); c.fillStyle = '#222'; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.fillText(b.t, 32, 41);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.CircleGeometry(.04, 16), new THREE.MeshBasicMaterial({ map: tx, transparent: true, color: 0xcccccc }));
    const row = i < order.length ? i : order.length + (i - order.length);
    m.position.set(ELV.panel.x - .012, 1.52 - row * .085, -.3); m.rotation.y = -Math.PI / 2; m.userData.dynamic = true; ELV.g.add(m);
    ELV.btns.push({ kind: 'elBtn', a: b.a, f: b.f, mesh: m, floor: -1, x: 0, z: 0,
      label: b.a === 'f' ? `${FLOOR_LABEL[b.f]} 버튼 누르기` : b.a === 'open' ? '문 열림 버튼' : b.a === 'close' ? '문 닫힘 버튼' : '비상벨 누르기' });
  });
}
const elvHere = f => world.props.find(q => q.kind === 'elevator' && q.floor === f);
function elvHallOpen(p,open,snap=false){p.hallOpen=open;if(snap)p.hallK=open?1:0;if(p.doorBlock)p.doorBlock.off=open;}
function elvReset(){
 ++ELV.token;P.inElev=false;ELV.moving=false;ELV.open=ELV.want=0;ELV.p=null;
 if(ELV.g)ELV.g.visible=false;
 for(const p of world.props.filter(q=>q.kind==='elevator')){elvHallOpen(p,false,true);p.closeT=0;p.callPending=false;}
}
function elvDock(p){
 elvBuild();preload(['elv_open','elv_close','elv_up','elv_down',...['B1','1','2','3'].flatMap(f=>['elv_floor_'+f,'elv_select_'+f])]);const set=p.floor>=8?EL_SET.annex:EL_SET.main;if(ELV.set!==set){ELV.set=set;elvButtons(set);}
 ELV.p=p;ELV.cur=p.floor;ELV.g.position.set(p.px,floors[p.floor].y0,p.pz);ELV.g.visible=true;ELV.disp(EL_BTN[p.floor]);ELV.cabinLamp={x:p.px+.8,y:floors[p.floor].y0+2.2,z:p.pz,kind:'steady',cabin:true};lampTimer=0;
}
async function elvAnnounce(id,valid=()=>true){
 if(!valid())return false;const sec=await line('elv_'+id,'pa','승강기 안내');
 if(!valid())return false;await wait((sec+.12)*1000);return valid();
}
function elvDoor(open,announce=true){
 const p=ELV.p;if(!p)return;const changed=ELV.want!==+open;ELV.want=+open;elvHallOpen(p,open);
 if(changed&&p.floor===P.floor&&Math.hypot(P.x-p.px,P.z-p.pz)<8){sfx.doorSlide(.7);if(announce&&!isSpeechBusy())elvAnnounce(open?'open':'close',()=>ELV.p===p&&p.floor===P.floor&&state==='playing');}
 ELV.idle=performance.now();
}
async function elvCall(p){
 sfx.elevatorButton();if(p.callPending||p.hallOpen||P.inElev||ELV.moving)return;
 const epoch=storySession;p.callPending=true;
 await wait(power?240:520);if(epoch!==storySession)return;p.callPending=false;if(P.floor!==p.floor||state!=='playing')return;
 if(ELV.p&&ELV.p!==p)elvHallOpen(ELV.p,false,true);
 elvDock(p);ELV.open=0;ELV.want=0;sfx.elevatorChime();elvDoor(true);p.closeT=performance.now()+9000;
}
function elvEnter(p){
 elvDock(p);P.inElev=true;ELV.idle=performance.now();P.jy=P.sh=P.vy=0;
}
function elvLeave(){
 P.inElev=false;const p=ELV.p;if(p)p.closeT=performance.now()+5000;
 if(P.floor===4&&!P.b1Seen){P.b1Seen=true;const epoch=storySession;setTimeout(()=>{if(epoch===storySession)talk('b1',3000);},600);}
 toastFloor(P.floor);
}
async function elvPress(b){
 sfx.elevatorButton();ELV.idle=performance.now();
 if(ELV.moving){return;}
 b.mesh.material.color.setHex(0xffc060);setTimeout(()=>{if(b.a!=='f'||!ELV.moving)b.mesh.material.color.setHex(0xcccccc);},300);
 if(b.a==='bell'){sfx.bell();say('…아무도 대답하지 않는다',2000);return;}
 if(b.a==='open'||b.a==='close'){elvDoor(b.a==='open');return;}
 if(b.f===ELV.cur){elvDoor(true);return;}
 if(elevatorLocal(ELV.p,P.x,P.z).z>-.35){say('문에서 한 걸음 안쪽으로 들어간 뒤 층 버튼을 눌러 주세요',2500);return;}
 if(b.f===4&&!FL.b1Open){say('B1 버튼에 「관리자 키 필요」 스티커가 붙어 있다. 지하 철문을 먼저 열어야 한다.',2800);return;}
 const route=elevatorRoute(ELV.set,ELV.cur,b.f);if(!route.length||!elvHere(b.f))return;
 const token=++ELV.token,epoch=storySession,valid=()=>token===ELV.token&&epoch===storySession&&P.inElev;
 ELV.moving=true;b.mesh.material.color.setHex(0xffc060);
 try{
  if(!await elvAnnounce('select_'+EL_BTN[b.f],valid))return;
  if(ELV.want){elvDoor(false,false);if(!await elvAnnounce('close',valid))return;}
  await wait(340);if(!valid())return;
  const up=floors[b.f].y0>floors[ELV.cur].y0;
  if(!await elvAnnounce(up?'up':'down',valid))return;
  sfx.elevator((power?1.2:2)*route.length);
  for(const f of route){
   await wait(power?520:880);if(!valid())return;
   const old=ELV.p,local=elevatorLocal(old,P.x,P.z),next=elvHere(f);
   elvHallOpen(old,false,true);elvDock(next);Object.assign(P,elevatorWorld(next,local.x,local.z));P.floor=f;P.jy=P.sh=P.vy=0;
   ELV.disp(EL_BTN[f],up?'▲':'▼');
  }
  ELV.disp(EL_BTN[ELV.cur]);sfx.elevatorChime();
  if(!await elvAnnounce('floor_'+EL_BTN[ELV.cur],valid))return;
  if(!await elvAnnounce('open',valid))return;
  elvDoor(true,false);ELV.idle=performance.now();
 }finally{if(token===ELV.token){ELV.moving=false;b.mesh.material.color.setHex(0xcccccc);}}
}
// 카 안 조준: 카메라 정면 광선이 맞는 버튼
function elvTarget() {
  if (!ELV.btns.length) return null;
  ELV.ray.setFromCamera({ x: 0, y: 0 }, camera); ELV.ray.far = 1.6;
  const hit = ELV.ray.intersectObjects(ELV.btns.map(b => b.mesh), false)[0]; if (!hit) return null;
  const b = ELV.btns.find(q => q.mesh === hit.object); return { type: 'prop', p: b, label: b.label };
}
function elvTick(dt){
 const now=performance.now();
 for(const p of (ELV.list ||=world.props.filter(q=>q.kind==='elevator'&&q.hall))){
  const atDoor=p.floor===P.floor&&Math.abs(P.x-p.px)<.65&&Math.abs(P.z-p.pz)<.7;
  if(p.hallOpen&&p.closeT&&now>p.closeT&&!atDoor&&!P.inElev){elvHallOpen(p,false);if(ELV.p===p)elvDoor(false);p.closeT=0;}
  p.hallK=Math.max(0,Math.min(1,(p.hallK||0)+(p.hallOpen?dt:-dt)/.8));
  p.hall.forEach((d,i)=>{const sc=Math.max(.04,1-p.hallK*.96);d.scale.x=sc;d.position.x=(i?1:-1)*(.8-.4*sc);});
  if(p.doorBlock)p.doorBlock.off=p.hallK>.85;
  if(!P.inElev&&state==='playing'&&p.floor===P.floor&&p.hallK>.85&&P.x>p.px-.4&&P.x<p.px+1.65&&Math.abs(P.z-p.pz)<.45)elvEnter(p);
 }
 if(!ELV.g||!ELV.p)return;
 ELV.g.visible=ELV.cur===P.floor;
 ELV.open=Math.max(0,Math.min(1,ELV.open+(ELV.want?dt:-dt)/.8));
 ELV.doors.forEach(d=>{d.position.x=d.userData.x0+Math.sign(d.userData.x0)*.5*ELV.open;});
 if(!P.inElev)return;
 const local=elevatorLocal(ELV.p,P.x,P.z),R=.3;
 // Reopen instead of closing on a passenger crossing the threshold.
 if(!ELV.moving&&local.z>-.35&&Math.abs(local.x)<.55&&!ELV.want)elvDoor(true);
 if(ELV.want&&!ELV.moving&&now-ELV.idle>9000&&local.z<-.35)elvDoor(false);
 let x=Math.max(-.85+R,Math.min(.85-R,local.x));
 let z=Math.max(-1.6+R,Math.min(ELV.open<.85||ELV.moving?-R:1,local.z));
 if(z>-R)x=Math.max(-.5+R,Math.min(.5-R,x));
 Object.assign(P,elevatorWorld(ELV.p,x,z));
 if(z>.42&&ELV.open>.85&&!ELV.moving)elvLeave();
}
// 방마다 고유 오브젝트 — 선택 화면(1·2·3 키)으로 조작하고, 보급 · 안정 · 기록 · 공포 효과가 있다
const calmDown = (sec, msg) => { storyCalm(sec); P.fear = Math.max(0, P.fear - .4); setFace('relief', 3); if (msg) caption(msg); };
async function useRoomObj(p) {
  const k = p.k, room = roomAt(p.floor, p.x, p.z - .6) || roomAt(p.floor, p.x, p.z + .6), rn = room ? room.name : '';
  if (k === 'east_fountain') {
    sfx.drip ? sfx.drip() : sfx.click();
    P.fear = Math.max(0, P.fear - .18); P.stamina = 100; refreshHud();
    say('야외 타일 수돗가의 황동 수도꼭지를 틀어 차가운 수돗물로 세수를 했다 — 정신이 맑아지고 숨이 가라앉는다 (긴장 -18% · 스태미나 100%)', 3800);
    return;
  }
  if (k === 'east_bikes') {
    sfx.click();
    if (!p.done) { p.done = true; giveItem('battery', 1, true); lootCard('battery', '자전거 보관소', ITEMS.battery.name, '녹슨 학생 자전거 앞바구니에서 찾았다'); refreshHud(); return; }
    say('녹슨 체인 자물쇠로 묶인 1998년식 학생용 자전거들이 주인을 기다리듯 줄지어 서 있다.', 3400);
    return;
  }
  if (k === 'east_ssireum') {
    sfx.click();
    if (!p.done) { p.done = true; giveItem('thermos', 1, true); lootCard('thermos', '씨름장 모래판', ITEMS.thermos.name, '모래판 가장자리 벤치 아래에서 찾았다'); refreshHud(); return; }
    say('체육부 씨름장 모래판 위에 청샅바와 홍샅바가 그대로 놓여 있다.', 3400);
    return;
  }
  if (k === 'east_museum') {
    sfx.click();
    say('서문고 역사관(1968~1998) — 『1998년 10월 12일 개교 30주년 기념방송 특별전: 3학년 2반 윤하늘 아나운서 선서문』이 유리관 안에 전시되어 있다.', 4200);
    return;
  }
  if (k === 'east_bell') {
    sfx.bell ? sfx.bell() : sfx.click(); shake = Math.max(shake, .32);
    lureTo(0, p, 38);
    say('댕—! 구관 청동 학교 종소리가 동편 캠퍼스 전체에 무겁게 울려 퍼진다!', 3800);
    return;
  }
  if (k === 'east_payphone') {
    sfx.click();
    if (!p.done) { p.done = true; giveItem('candy', 2, true); sfx.pickup(); }
    say('90년대 옥색 공중전화 수화기를 들자 지직거리는 신호음 너머로 누군가의 마지막 통화 잔향이 들린다… “…엄마, 나 오늘 방송 리허설 끝나고 금방 갈게…”', 4400);
    return;
  }
  if (k === 'east_incinerator') {
    sfx.click(); fx.glitch(.18);
    say('구식 벽돌 소각로 철문을 열자 붉은 잔불 속에 타다 남은 『1998.10.12 지하 펌프실 당직 교사 은폐 서약서』 조각이 보인다!', 4200);
    return;
  }
  if (k === 'med') {
    const i = await choose('약품함', `${rn} 벽에 걸린 약품함. 유통기한이 지난 약이 대부분이지만 쓸 만한 것이 몇 개 남아 있다.`, [{ label: '진통제 먹기', sub: '체력 +30' }, { label: '안정제 먹기', sub: '40초 동안 마음이 가라앉는다 (긴장 완화)' }, { label: '응급 밴드 챙기기', sub: '소지품 +1' }, { label: '닫는다' }]);
    if (i === 3) return;
    if (i === 0) { P.hp = Math.min(100, P.hp + 30); toast('진통제', '체력 +30', 'info'); }
    else if (i === 1) calmDown(40, '숨이 조금 고르게 돌아온다');
    else { inv.medkit++; toast('응급 밴드를 챙겼습니다', '소지품 +1', 'info'); }
    sfx.pickup(); p.done = true; refreshHud(); return;
  }
  if (k === 'phone') {
    sfx.click(); const i = await choose('교내 내선 전화기', `${rn || '복도'} 벽에 걸린 구형 내선 전화기. 수화기를 들자 낮은 교환기 신호음이 울린다.`, [{ label: '100 — 정문 경비실', sub: DAY.k > .3 && !FL.night ? '경비 아저씨에게 내선 연결' : '야간 무인 상태' }, { label: '201 — 4층 방송실', sub: '주조정실 내선' }, { label: '302 — 3학년 2반', sub: '폐쇄된 교실 내선' }, { label: '수화기를 내려놓는다' }]);
    if (i === 3) { sfx.click(); return; }
    sfx.staticNoise(.8);
    if (i === 0) {
      if (DAY.k > .3 && !FL.night) { callTalk('경비실 자동응답기 (내선 100)', ['gd_call'], false, 'guard'); }
      else setTimeout(() => { caption('(수화기 너머로 빈 경비실의 전화벨만 공허하게 울린다…)'); }, 800);
    } else if (i === 1) {
      setTimeout(() => { line('pa1', 'phone', '📞 내선 201 (방송실 자동응답 녹음)'); }, 600);
    } else {
      setTimeout(() => { say('📞 내선 302 — 신호만 가고 아무도 받지 않는다. 회선 대장엔 1999년 폐쇄로 적혀 있다', 3000); }, 700);
    }
    return;
  }
  if (k === 'mirror') {
    const i = await choose('거울', '금이 간 거울에 지친 얼굴이 비친다.', [{ label: '세수한다', sub: '마음을 가라앉힌다' }, { label: '거울을 오래 들여다본다' }, { label: '돌아선다' }]);
    if (i === 0) { sfx.drip(); calmDown(25, '차가운 물에 정신이 든다'); }
    else if (i === 1) caption('…지친 내 얼굴뿐이다');
    return;
  }
  if (k === 'cards') {
    const i = await choose('대출 카드함', '서랍마다 손때 묻은 카드가 빼곡하다.', [{ label: 'ㄱ ~ ㅅ 서랍' }, { label: 'ㅇ 서랍' }, { label: 'ㅈ ~ ㅎ 서랍' }]);
    sfx.paper();
    if (i === 1) showNote({ title: '대출 카드 — 윤하늘 (3-2)', text: '『어린 왕자』 1998.09.14 대출 · <b>반납 안 됨</b><br>『방송 대본 쓰는 법』 1998.10.02 대출 · <b>반납 안 됨</b><br>『집으로 가는 길』 1998.10.12 대출 · <b>반납 안 됨</b><br><br>10년 전(1998년) 마지막 카드 뒷면에 연필로: <i>“내일 돌려줄게요.”</i>' });
    else caption(i === 0 ? '이름들 사이에 같은 필체가 반복된다 — 모두 반납되지 않았다' : '카드 몇 장이 젖어 붙어 있다');
    return;
  }
  if (k === 'term') {
    sfx.beep(); const o = objective();
    $('note').innerHTML = `<pre style="font:13px/1.55 monospace;color:#7fe0a0;background:#061008;padding:14px;border:1px solid #1d4a2a;white-space:pre-wrap;text-align:left">SEOMUN-NET v2.3  (현재 시스템 일시: 2008-10-12)\n&gt; login: guest\n&gt; 마지막 로그 기록: 1998-10-12 23:31 (10년 전 참사 당일 · 3F 방송실)\n&gt; 남은 작업 1건:\n    ${o.main}${o.loc ? '\n    위치: ' + o.loc.where : ''}\n&gt; 시스템 메시지: <span style="color:#e06060">하교 방송이 아직 끝나지 않았습니다</span>\n&gt; _</pre><small>— 단말기 화면</small>`;
    state = 'note'; $('noteBox').classList.add('show'); storyCalm(10); return;
  }
  if (k === 'chem') {
    const i = await choose('약품 선반', '색이 다른 시약병 세 개. 라벨은 번져서 읽을 수 없다.', [{ label: '파란 용액에 노란 용액을 섞는다' }, { label: '붉은 용액의 냄새를 맡는다' }, { label: '건드리지 않는다' }]);
    if (i === 0) { sfx.splash(); P.battery = Math.min(100, P.battery + 35); toast('형광 용액', '병이 초록빛으로 빛난다 — 손전등 배터리 +35%', 'info'); p.done = true; refreshHud(); }
    else if (i === 1) { sfx.gasp(); shake = .3; fx.glitch(.4); caption('머리가 핑 돈다 — 눈앞이 잠깐 흐려졌다'); P.stamina = Math.max(0, P.stamina - 40); }
    return;
  }
  if (k === 'snack') { sfx.paper(); P.stamina = 100; P.tired = false; P.snackT = 60; toast('간식 바구니', '오래된 사탕과 초코바 — 1분 동안 덜 지친다', 'info'); p.done = true; return; }
  if (k === 'emo') {
    const i = await choose('감정 카드', '상담 선생님이 쓰던 카드. "오늘의 마음을 골라 보세요."', [{ label: '무서워요' }, { label: '괜찮아요' }, { label: '보고 싶어요' }]);
    sfx.paper();
    if (i === 2) { calmDown(45); setTimeout(() => caption('(카드 뒷면) 하늘: 엄마, 방송 꼭 들어 줘.'), 600); }
    else calmDown(i === 0 ? 35 : 25, i === 0 ? '무섭다고 인정하니 조금 나아졌다' : '…괜찮아. 괜찮아.');
    return;
  }
  if (k === 'copier') {
    sfx.beep(); setTimeout(() => { sfx.slide(); fx.glitch(.2); }, 400);
    setTimeout(() => showNote({ img: 'old_class', title: '복사된 종이', text: '복사기 급지대에 걸려 있던 마지막 한 장.<br>교실 사진 — 맨 뒷자리만 <b>까맣게</b> 칠해져 있다.' }), 1300);
    p.done = true; return;
  }
  if (k === 'water') { sfx.drip(); setTimeout(() => { caption('오래된 배관에서 녹물이 한참 흐르다 맑아진다'); }, 500); return; }
  if (k === 'ballot') { sfx.paper(); showNote({ title: '학생회 투표함 (1998년 봉인)', text: '1998학년도 2학기 방송부장 선거.<br>10년 동안 개표되지 않은 용지 41장 — 전부 같은 이름이다.<br><br><b>윤하늘 ○</b>' }); p.done = true; return; }
  if (k === 'guardlog') {
    if (!docs.some(d => d.id === 'n_guard_diary')) { addDoc({ id: 'n_guard_diary', kind: 'note' }); addClue('c1'); }
    showNote({
      title: '경비실 심야 순찰 일지 (1998.10.12 & 오늘)',
      text: '<b>[1998년 10월 12일 밤 순찰 기록 — 당직 경비원 박종철]</b><br>• <b>22:15</b> — 지하 펌프실 쪽에서 문 두드리는 소리가 들림. 열쇠는 교무부장이 가져갔다고 함.<br>• <b>23:30</b> — 지하 펌프실 문이 <b>밖에서 잠겨 있음</b>. 교무실에 열쇠를 찾으러 갔으나 교무부장이 오늘 밤 일은 입도 뻥긋하지 말고 정문만 지키라고 호통침.<br><br><b>[10년 뒤 오늘 기록]</b><br>• 17:42 방송부 조끼를 입은 여학생(민아) 정문 진입.<br>• 17:50 친구를 찾겠다며 또 한 명 진입. <i>밤 11시 40분 전엔 반드시 나와야 한다.</i>',
      tape: true,
      voiceKey: 'tape_guard_patrol',
      voiceWho: '📼 경비원 박종철 아저씨 순찰 녹음'
    });
    return;
  }
  if (k === 'guard_recorder') {
    sfx.click();
    if (!docs.some(d => d.id === 'n_guard_diary')) addDoc({ id: 'n_guard_diary', kind: 'note' });
    line('tape_guard_patrol', 'tape', '🔦 당직 경비원 · 박종철 아저씨 (순찰 녹음)').then(() => {
      if (state === 'playing') setTimeout(() => line('vo_guard_logbook', 'none', '🔦 당직 경비원 · 박종철 아저씨 (10년 전 회상)'), 350);
    });
    say('경비실 보이스레코더에서 1998년 10월 12일 밤 박씨 아저씨가 남긴 순찰 육성 녹음이 흘러나온다!', 4200);
    return;
  }
  if (k === 'principal_recorder') {
    sfx.click();
    if (!docs.some(d => d.id === 'n_principal_tape')) { addDoc({ id: 'n_principal_tape', kind: 'note' }); giveItem('battery', 1); }
    showNote({
      title: '교장실 비상대책회의 비밀 녹취록 (제9대 교장)',
      text: '<b>[1998. 10. 12 23:10 교장실 극비 녹취 테이프]</b><br>“보고서에는 단순 실종이라고 썼네. 학교 이름이 『서문일보』 신문에 나는 게 두려웠어… 그 아이 부모에게조차 지하 펌프실 정전 얘기는 절대 하지 말라고 입단속을 시켰지.<br><br>오늘 밤 남아 있던 <b>우리 다섯(교무실·도서실·과학실·체육관·수영장)</b>이 정문 열쇠를 한 조각씩 나누어 맡기로 했네. <b>교장실 괘종시계를 자정(12:00)</b>에 맞추면 서고 금고가 열리네. 정문 열쇠 다섯 조각과 함께 우리가 감춘 기록도 부디 찾아 주게.”',
      tape: true,
      voiceKey: 'tape_principal_secret',
      voiceWho: '📼 당시 교장선생님 비밀 육성 녹음'
    });
    return;
  }
  if (k === 'guarddoor') {
    if ((FL.guardDoorOpen ?? true) && guardRoomController && !guardRoomController.canClose(P)) { say('문 앞에서 조금 물러나야 한다',1800); return; }
    FL.guardDoorOpen = !(FL.guardDoorOpen ?? true); sfx.click(); syncGuardDevices(); save(true); return;
  }
  if (k === 'guardlight') { toggleGuardLight(); return; }
  if (k === 'fac_door') {   // 캠퍼스 시설(대강당 등) 실내 문: 여닫기
    const D = p.fdoor; D.target = D.target > .5 ? 0 : 1; D.open = D.target > .5; p.label = D.open ? '문 닫기' : '문 열기'; sfx.click(); return; }
  if (k === 'light_switch') {   // 형광등 스위치 (새 본관 · 별관 방마다 + 캠퍼스 건물 출입문 옆)
    const sw = p.sw; sfx.click();
    if (sw.lamps) RBG.toggleSwitch(sw);
    else { sw.on = !sw.on; const r = sw.rect;
      if (!sw.fx) { sw.fx = []; sw.grp.traverse(o => { if (!(o.isMesh || o.isSprite)) return; const em = o.isMesh && o.material && o.material.emissiveIntensity > .5 && o.material.emissive && o.material.emissive.getHex() !== 0, gl = o.isSprite && o.material.blending === THREE.AdditiveBlending; if (!em && !gl) return;
        const w = o.getWorldPosition(new THREE.Vector3()); if (w.x > r.x1 && w.x < r.x2 && w.z > r.z1 && w.z < r.z2 && w.y > (r.y1 ?? 0) + 1.8 && w.y < (r.y2 ?? 99) + .5) sw.fx.push(o); }); }
      sw.fx.forEach(o => { o.visible = sw.on; }); }
    p.label = `${sw.base} ${sw.on ? '끄기' : '켜기'}`; say(sw.on ? '딸깍 — 형광등이 몇 번 깜빡이다 켜졌다' : '딸깍 — 형광등이 꺼졌다', 1600); return; }
  if (k === 'guardcctv') { openGuardCctv(); sfx.click(); return; }
  if (k === 'plazaboard') { sfx.paper(); say('「제32회 해교 학예제 및 추계 체육대회」 — 대강당 합창 리허설 및 실내체육관 결승전 안내문이 붙어 있다', 3400); return; }
  if (k === 'plazawater') { sfx.splash ? sfx.splash() : sfx.drip(); P.fear = Math.max(0, P.fear - .2); P.stamina = Math.min(100, P.stamina + 35); say('차가운 수돗물로 얼굴을 씻었다 — 정신이 맑아지고 숨이 고르게 돌아온다', 2800); return; }
  if (k === 'plazarecycle') { if (!p.gotCan) { p.gotCan = true; giveItem('can', 1); sfx.pickup(); } else say('분리수거함 안에 1998년 가을 가정통신문 다발이 묶여 있다', 2400); return; }
  if (k === 'greenhouse_herb') { if (!p.gotHerb) { p.gotHerb = true; giveItem('medkit', 1); sfx.pickup(); say('생물부 온실 약초 선반에서 응급 밴드와 「야간 발광 식물 배양 일지」를 찾았다', 3200); } else say('온실 화분마다 1998년 10월 12일에 멈춘 물주기 기록표가 꽂혀 있다', 2600); return; }
  if (k === 'weather_box') { if (!p.gotBat) { p.gotBat = true; giveItem('battery', 1); sfx.pickup(); say('백엽상 안에서 예비 건전지와 10월 12일 밤 기상 관측 기록표를 발견했다', 3200); } else say('1998.10.12 23:00 기상 관측 기록 — “맑음 · 강수 없음 · 기온 9℃”', 2800); return; }
  if (k === 'canteen_counter') { if (!p.gotSnack) { p.gotSnack = true; giveItem('candy', 1); giveItem('thermos', 1); sfx.pickup(); say('학우 매점 진열대에서 막대사탕과 보온병 유자차를 챙겼다', 3000); } else say('매점 창구 유리창에 “축제 당일 야간 연장 영업!” 안내문이 붙어 있다', 2400); return; }
  if (k === 'amphitheater_stand') { if (!p.gotBox) { p.gotBox = true; giveItem('candy', 1); giveItem('battery', 1); sfx.pickup(); say('야외 음악당 지휘 보면대 아래에서 건전지와 합창단 리허설 메모를 발견했다', 3200); } else say('보면대 위에 「1998 추계 학예제 피날레 — 교가 & 학교종」 악보가 펼쳐져 있다', 2600); return; }
  if (k === 'campus_wc') { sfx.drip ? sfx.drip() : sfx.click(); P.fear = Math.max(0, (P.fear || 0) - .05); say('차가운 물로 손을 씻었다. 수도꼭지에서 녹물이 조금 섞여 나온다', 2600); return; }
  if (k === 'campus_map_board') { sfx.paper(); say('15,000평 캠퍼스 전역(청운학사 기숙사·청운호 수변공원·과학천문관·중앙학술정보관·스포츠단지·학생회관)이 타일 보행로로 연결되어 있다', 3400); return; }
  if (k === 'pump_newspaper') {
    if (!docs.some(d => d.id === 'n_seomun_ilbo')) { addDoc({ id: 'n_seomun_ilbo', kind: 'note' }); }
    showNote({ id: 'n_seomun_ilbo', newspaper: true, title: '『서문일보』 1998.10.13 지역신문 특별 호외', text: '' });
    return;
  }
  if (k === 'bunker_light') {
    sfx.click();
    if (p.bkLightGroup) {
      p.bkLightGroup.visible = !p.bkLightGroup.visible;
      say(p.bkLightGroup.visible ? '방공호 천장 트윈 형광등과 격벽 벌크헤드 전등을 켰다' : '방공호 주 전등을 껐다', 2400);
    }
    return;
  }
  if (k === 'bunker_audit') {
    sfx.clank ? sfx.clank(.7) : sfx.click();
    if (!docs.some(d => d.id === 'n_bunker_audit')) { addDoc({ id: 'n_bunker_audit', kind: 'note' }); giveItem('battery', 1); }
    showNote({
      title: '지하 방공호 · 1998 재단 비공개 특별감사 녹취록',
      text: '<b>[1998. 10. 12 심야 5인 책임자 봉인 회의 녹취록 — 제1특수보존서고]</b><br>“오늘 밤 지하 펌프실 건은 단순 실종 사고로 정리한다. 경찰이나 교육청, 『서문일보』에 절대 새어 나가선 안 돼.<br><br>오늘 밤 학교에 남아 있던 <b>우리 다섯 사람(교무실 금고 · 도서실 · 과학실 · 체육관 · 수영장)</b>이 정문 열쇠를 한 조각씩 나눠 맡기로 했다. 다섯 명이 모두 모이기 전엔, 그 누구도 오늘 밤을 다시 열 수 없다.”',
      tape: true,
      voiceKey: 'vo_bunker_tape',
      voiceWho: '📼 방공호 5인 책임자 비밀 회의 녹취'
    });
    return;
  }
  if (k === 'dorm_log') {
    if (!p.got) { p.got = true; giveItem('thermos', 1); sfx.pickup(); line('vo_dorm2f_student', 'tape', '📼 청운학사 사감실 음성 기록'); say('기숙사 1층 사감실 점호 일지 — “10월 12일 22:30, 3-2 윤하늘·강민아 미복귀” 기록과 함께 보온병 유자차를 얻었다', 3800); }
    else { line('vo_dorm2f_student', 'tape', '📼 청운학사 사감실 음성 기록'); say('사감실 열쇠함에 1층·2층 호실 열쇠가 걸려 있다. 북쪽 실내 계단으로 걸어 올라가면 2층 침실과 심야 정독실이 나온다', 3200); }
    return;
  }
  if (k === 'dorm_locker') { if (!p.got) { p.got = true; giveItem('battery', 1); giveItem('medkit', 1); sfx.locker(); talk('dorm2fClimb', 3400); say('기숙사 2층 204호 사생 사물함을 파밍해 건전지와 응급 밴드를 획득했다!', 3200); } else say('이미 파밍을 마친 기숙사 2층 사물함이다', 1800); return; }
  if (k === 'dorm_study') {
    if (!p.got) {
      const r = await mini('timetableRestore', { title: '청운학사 2층 심야 정독실 — 1998.10.12 사생 일과표 복원' });
      if (r.ok) {
        p.got = true; giveItem('medkit', 1);
        if (!docs.some(d => d.id === 'n_dorm2f_diary')) addDoc({ id: 'n_dorm2f_diary', kind: 'note' });
        sfx.unlock(); line('vo_dorm2f_student', 'tape', '📓 2층 정독실 사생 일기');
        say('2층 심야 정독실 비밀 수첩을 해독해 『청운학사 2층 정독실 일기』와 응급 밴드를 얻었다!', 3600);
      }
    } else say('2층 정독실 책상 위에 1998학년도 수능 특강과 방송반 큐시트 초안이 놓여 있다', 2400);
    return;
  }
  if (k === 'lake_capsule') { if (!p.got) { p.got = true; giveItem('candy', 2); sfx.unlock(); say('청운호 호심정 정자 위 봉인함에서 1998년 세 친구의 타임캡슐 편지를 발견했다!', 3600); } else say('호심정 기둥에 “우리의 노래가 호수 위로 영원히 퍼지길”이라 새겨져 있다', 2600); return; }
  if (k === 'astro_console') { if (!p.got) { const r = await mini('oscilloscope', { title: '과학천문관 — 천체관측 돔 성도 주파수 동조' }); if (r.ok) { p.got = true; giveItem('battery', 2); sfx.unlock(); say('천문대 성도 좌표가 맞춰지며 예비 건전지 2개를 획득했다!', 3200); } } else say('천체망원경이 1998년 10월 12일 밤의 페가수스자리를 가리키고 있다', 2600); return; }
  if (k === 'astro_scope') { say('관측 돔 굴절 망원경 — 접안렌즈 너머로 1998년 10월 12일 밤의 페가수스자리가 희미하게 보인다', 3000); return; }
  if (k === 'astro_case') { if (!p.got) { p.got = true; giveItem('battery', 1); sfx.pickup(); say('광물 표본 진열장 아래 서랍에서 예비 건전지를 찾았다', 3000); } else say('각종 운석과 형광 광물 표본이 유리 진열장 안에 전시되어 있다', 2200); return; }
  if (k === 'lib_microfilm') { if (!p.got) { const r = await mini('filmFocus', { title: '중앙학술정보관 — 1998년 마이크로필름 신문 복원' }); if (r.ok) { p.got = true; giveItem('hairpin', 2); giveItem('medkit', 1); sfx.photo(); say('마이크로필름 속 1998년 실종 사건 기사를 판독하고 머리핀 2개·응급 밴드를 얻었다!', 3400); } } else say('마이크로필름 화면에 1974년 개교 당시 지하 보존서고 도면이 비친다', 2600); return; }
  if (k === 'lib_desk') { line('vo_lib_confess', 'tape', '📼 상담교사 · 사서 증언 녹음'); if (!p.got) { p.got = true; giveItem('hairpin', 1); sfx.pickup(); say('대도서관 사서 데스크 서랍에서 머리핀을 챙겼다', 2800); } else say('미반납 도서 목록 맨 위에 『집으로 가는 길 — 3-2 윤하늘』이 적혀 있다', 2600); return; }
  if (k === 'sports_cooler') { P.stamina = 100; P.tired = false; if (!p.got) { p.got = true; giveItem('candy', 2); giveItem('can', 1); sfx.pickup(); say('선수용 아이스박스에서 막대사탕 2개와 음료 캔을 꺼내고 숨을 돌렸다 (스태미나 100% 회복)', 3200); } else say('시원한 얼음물에 손을 적시자 피로가 가신다 (스태미나 회복)', 2200); return; }
  if (k === 'union_console') { if (!p.got) { const r = await mini('fuse', { title: '학생회관 소극장 — 무대 음향·조명 회로 복구', N: 4 }); if (r.ok) { p.got = true; giveItem('medkit', 1); giveItem('battery', 1); sfx.unlock(); say('소극장 무대 전원이 들어오며 보관함에서 응급 밴드와 건전지를 획득했다!', 3200); } } else say('소극장 콘솔 위에 제32회 해교제 연극부 대본이 놓여 있다', 2400); return; }
  if (k === 'union_locker') { if (!p.got) { p.got = true; giveItem('candy', 1); giveItem('hairpin', 1); sfx.locker(); say('동아리연합회 사물함을 파밍해 막대사탕과 머리핀을 얻었다!', 2800); } else say('이미 파밍을 마친 동아리 사물함이다', 1800); return; }
  if (k === 'radio') {
    sfx.staticNoise(1.6); const ga = ghost.active && ghost.floor === P.floor, d = ga ? Math.hypot(ghost.x - P.x, ghost.z - P.z) : 99;
    setTimeout(() => caption(ga ? (d < 12 ? '(지지직!) 잡음이 거세다 — 가까이 있다' : '(지직…) 잡음이 일정하다 — 같은 층 어딘가에 있다') : '(지직…) 낡은 라디오에서 지역 방송 잡음만 흘러나온다'), 700);
    return;
  }
}
function openGate() {
  if (FL.gatePower) return;   // 이미 모터로 열리는 중
  if (!FL.gatekey) {
    sfx.click();
    if (P.keys >= TOTAL) { talk('needCombine', 3200); say('먼저 소지품(Tab)에서 5대 비밀 증거와 교장 직인 코어를 조합해 진상 기록부를 완성해야 한다', 3200); }
    else say(`아직 이 학교의 비밀을 다 밝히지 못했다 — 5대 은폐 비밀 증거를 먼저 수집해야 한다 (비밀 증거 ${P.keys}/${TOTAL})`, 3200);
    return;
  }
  escaped = true; gateState = 'opening'; sfx.gateOpen(); say('열쇠가 맞물렸다…', 3000);
  gate.blockRect.x1 = 1e9; gate.blockRect.x2 = 1e9 + 1;
  winGame();
}
// 엔딩: 민아를 깨워 함께 나가면 진 엔딩, 아니면 노멀 엔딩
const wait = ms => new Promise(r => setTimeout(r, ms));
// 선택지 UI (기획서: 컷신 · 대화 선택지 전면 표시). 1 · 2 · 3 키 또는 클릭
function choose(title, text, opts) {
  return new Promise(res => {
    const prev = state; state = 'ui'; for (const k in keys) keys[k] = false; document.exitPointerLock?.(); $('prompt').style.display = 'none';
    const hudOn = $('hud').classList.contains('show'); $('hud').classList.remove('show');
    $('choiceTitle').textContent = title; $('choiceText').innerHTML = text || '';
    const box = $('choiceBtns'); box.innerHTML = '';
    let settled=false;
    const done = i => { if(settled)return;settled=true; removeEventListener('keydown', kd, true); $('choice').classList.remove('show'); if (hudOn) $('hud').classList.add('show'); sfx.ui(); if (state === 'ui') { state = prev === 'ui' ? 'playing' : prev; if (state === 'playing') lock(); } res(i); };
    const kd = e => { const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code); if (i >= 0 && i < opts.length) { e.preventDefault(); e.stopPropagation(); done(i); } };
    opts.forEach((o, i) => { const b = document.createElement('button'); b.innerHTML = `${i + 1}. ${o.label}${o.sub ? `<small>${o.sub}</small>` : ''}`; b.onclick = () => done(i); box.appendChild(b); });
    addEventListener('keydown', kd, true);
    $('choice').classList.add('show'); sfx.beep();
  });
}
// 엔딩 아웃트로: 결말마다 다른 뉴스 · 경찰 · 학교 · 문자 자료 세 장 (클릭 · Space 로 넘김)
function playOutro(fin) {
  const cards = ENDING_OUTRO[fin]; if (!cards) return Promise.resolve();
  return new Promise(res => {
    const box = $('outro'), card = box.querySelector('.card'), dots = box.querySelector('.dots');
    state = 'ui'; $('hud').classList.remove('show'); document.exitPointerLock?.();
    dots.innerHTML = cards.map(() => '<i></i>').join('');
    let i = -1, tm = 0, done = false;
    const end = () => { if (done) return; done = true; clearTimeout(tm); removeEventListener('keydown', kd, true); removeEventListener('pointerdown', pd, true); box.classList.remove('show'); res(); };
    function next() {
      clearTimeout(tm); if (++i >= cards.length) { end(); return; }
      const c = cards[i]; card.classList.remove('on');
      setTimeout(() => {
        if (done) return;
        card.className = 'card ' + c.t;
        card.innerHTML = `<div class="ty">${OUTRO_TYPE[c.t]}</div><div class="meta">${c.meta}</div><div class="head">${c.head}</div><div class="body">${c.body}</div>`;
        [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
        requestAnimationFrame(() => card.classList.add('on'));
        c.t === 'sms' ? sfx.phone() : sfx.paper();
      }, i ? 450 : 0);
      tm = setTimeout(next, 6500);
    }
    const kd = e => { if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); e.code === 'Escape' ? end() : next(); } };
    const pd = e => { e.preventDefault(); e.stopPropagation(); next(); };   // 다른 요소가 포인터를 잡고 있어도 넘어가도록 창 단계에서 받는다
    addEventListener('keydown', kd, true); addEventListener('pointerdown', pd, true);
    box.classList.add('show'); next();
  });
}
async function winGame() {
  const allTags = !!(FL.mega && FL.mega.tags && FL.mega.tags.length >= megaP.storyState.totalNametags);   // 1998 실종 학생 명찰 12개 → TRUE END「모든 영혼의 구원」
  let end = FL.mina || FL.sos || allTags ? 'true' : 'normal'; const aired = end === 'true', sosOnly = !!FL.sos && !FL.mina && !allTags;   // 옥상 구조 신호(구역 미션 D)도 진 엔딩
  P.invuln = 999; ghost.active = false;
  if (FL.mina) setTimeout(() => talk('withMina', 2800), 400);
  await wait(2400);
  // 마지막 선택 (EV-23): 기록 수 · 민아 구출 여부에 따라 후일담이 달라진다
  const nd = docs.length, ci = await choose('마지막 선택', `정문이 열렸다. 손에는 오늘 밤 모은 기록 ${nd}개가 있다.${FL.mina ? ' 민아가 곁에 서 있다.' : ''}`, FINAL_CHOICE);
  const pk = FINAL_CHOICE[ci].id;
  let fin = pk === 'A' ? (nd >= 14 ? (sqDoneCount() === SIDEQUESTS.length ? 'Aplus' : 'A') : 'A0') : pk === 'B' ? (FL.mina ? 'B' : 'B0') : 'C', cover = null;
  if (pk === 'C') {   // 은폐 엔딩: 교장실의 전화 → 혼자 묻을지, 거래할지
    sfx.phone(); await wait(900);
    const k = await choose(COVER_END.ask.title, COVER_END.ask.text, COVER_END.ask.opts);
    cover = COVER_END.ask.opts[k].id; if (cover === 'deal') fin = 'C2';
  }
  if (cover) end = 'cover';
  FL.final = fin;
  await playOutro(fin);
  setTimeout(() => {
    state = 'won'; sfx.win(); stopSpeak(); $('hud').classList.remove('show');
    try { const e = new Set(JSON.parse(localStorage.getItem(ENDINGS_KEY) || '[]')); e.add(end); e.add('final' + fin[0]); localStorage.setItem(ENDINGS_KEY, JSON.stringify([...e])); clearSlot(localStorage, SKEYS); } catch (err) { /* ignore */ }
    if (end === 'cover') {
      $('endTag').textContent = 'COVER-UP END'; $('endTag').className = end; $('endTitle').textContent = COVER_END.title[cover];
      $('winText').innerHTML = COVER_END.text + (FL.mina ? ' <span>' + COVER_END.mina + '</span>' : '') + (aired ? `<br><br><span class="epi">${COVER_END.aired}</span>` : '') + `<br><br><span class="epi">${FINAL_EPI[fin]}</span><br><br><small style="color:#8a8678">…진실을 밝히는 다른 결말도 있다.</small>`;
      const rec = statClear(end, fin);
      $('endStats').innerHTML = `<span>주인공</span><b>${CH().name}</b><span>플레이 시간</span><b>${fmtPT(playTime, true, true)}${rec.isBest ? ' <em style="color:#e8c870;font-style:normal">· 최단 기록!</em>' : ''}</b><span>찾은 기록</span><b>${docs.length} / ${DOC_TOTAL()}</b><span>마지막 선택</span><b>END ${fin}</b><span>난이도</span><b>${DF().label}</b><span>쓰러진 횟수</span><b>${deaths}</b>`;
      $('win').classList.add('show'); document.exitPointerLock?.(); return;
    }
    const vo = end === 'true' && !sosOnly ? 'endTrue' : 'endNormal';
    $('endTag').textContent = end === 'true' ? 'TRUE END' : 'NORMAL END'; $('endTag').className = end;
    $('endTitle').textContent = sosOnly ? '옥상의 구조 신호' : allTags ? '열두 개의 이름' : end === 'true' ? '폭로 방송' : '다시 닫힌 문';
    if (allTags) setTimeout(() => toast('TRUE END — 열두 개의 이름', '열두 개의 명찰이 유족에게 돌아갔다. 1998년의 진실이 공식 기록이 되었다', 'opt'), 2500);
    $('winText').innerHTML = (sosOnly ? '정문을 나서자 멀리서 사이렌이 들렸다. 옥상에서 보낸 단 한 통의 문자가, 십 년 동안 아무도 오지 않던 학교에 사람들을 불러왔다.' : VO[vo].text) + `<br><br><span class="epi">${sosOnly ? '— 이튿날 새벽, 구조대는 본관 4층 방송실 장비실에서 잠든 학생 한 명을 더 찾아냈다. 민아였다. 그녀는 아무것도 기억하지 못했다.' : EPILOGUE[end]}</span><br><br><span class="epi">${FINAL_EPI[fin]}</span>` + (end === 'true' ? '' : '<br><br><small style="color:#8a8678">…민아는 아직 방송실에 있다. 하늘의 이야기를 끝내면 다른 결말을 볼 수 있다.</small>');
    if (end === 'normal') setTimeout(() => line('pa1', 'pa'), 9000);
    const nd = docs.length, tot = DOC_TOTAL(), rec = statClear(end, fin);
    $('endStats').innerHTML = `<span>주인공</span><b>${CH().name}</b><span>플레이 시간</span><b>${fmtPT(playTime, true, true)}${rec.isBest ? ' <em style="color:#e8c870;font-style:normal">· 최단 기록!</em>' : rec.best ? ` <small style="color:#8a8678">(최단 ${fmtPT(rec.best, true, true)})</small>` : ''}</b><span>찾은 기록</span><b>${nd} / ${tot}</b><span>교실의 기억</span><b>${memCount()} / ${MEM_TOTAL()}</b><span>마지막 선택</span><b>END ${fin}</b><span>난이도</span><b>${DF().label}</b><span>쓰러진 횟수</span><b>${deaths}</b>`;
    if (!sosOnly) setTimeout(() => line(vo), 1200);
    $('win').classList.add('show'); document.exitPointerLock?.();
  }, 1200);
}
const gate = world.gate;

function enterLocker(l) {
  if (l && !l.stallDoor) {
    const sp = world.props.find(p => p.kind === 'search' && p.floor === l.floor && Math.hypot(p.x - l.x, p.z - l.z) < 1.2);
    if (sp && !sp.done) { startSearch(sp); return; }
    say('이미 파밍을 마친 사물함이다', 1600);
    return;
  }
  const G = ghost;
  P.hiding = l; steelHide(l, true); sfx.locker(); P.hideCount = (P.hideCount || 0) + 1; if (l.stallDoor) { l.stallDoor.target = 0; sfx.doorHinge(.6); }   // 칸막이: 들어가서 문을 닫는다
  const dr = l.dir || { x: 0, z: 1 }; l.yaw = Math.atan2(-dr.x, -dr.z);
  P.x = l.x + dr.x * .12; P.z = l.z + dr.z * .12; P.yaw = l.yaw; P.pitch = 0;
  $('hide').classList.add('show');
  say('칸막이 안에 몸을 숨겼다  (E 나가기)', 2500);
}
function leaveLocker(silent) {
  const l = P.hiding; if (!l) return;
  steelHide(l, false); const dr = l.dir || { x: 0, z: 1 }; P.hiding = null; $('hide').classList.remove('show'); P.x = l.x + dr.x * .85; P.z = l.z + dr.z * .85; P.yaw = l.yaw; P.pitch = 0;
  if (l.stallDoor && !l.stallDoor.locked) l.stallDoor.target = 1;
  ghost.hunt = null; ghost.findT = 0; ghost.fake = null; ghost.lockSearch = null; $('peekEye').classList.remove('on'); if (!silent) sfx.locker();
}

/* ---------- 죽음 / 점프스케어 ---------- */
function die() {
  if (state === 'dead' || state === 'won') return;
  state = 'dead';
  settleStoryGhost(ghost); ghost.storyTime = 0; ghost.group.visible = false;
  if (P.hiding) { P.hiding = null; $('hide').classList.remove('show'); }
  sfx.screech(); shake = 1.2;
  const fl = $('flash'); fl.style.transition = 'none'; fl.style.opacity = SET.flashReduce ? .25 : .9; requestAnimationFrame(() => { fl.style.transition = 'opacity 1.2s'; fl.style.opacity = 0; });
  $('prompt').style.display = 'none';
  deaths++; try { localStorage.setItem(DEATHS_KEY, deaths); } catch (e) { /* ignore */ }
  $('deadText').innerHTML = `칠판에 한 줄이 더 늘었다.<br>“다시, 여기서.”<br><br><span class="epi">${DEATH_LOG[Math.min(DEATH_LOG.length, deaths) - 1]}</span>`;
  setTimeout(() => { $('hud').classList.remove('show'); $('dead').classList.add('show'); $('retryBtn').disabled = !hasSave(); document.exitPointerLock?.(); setTimeout(() => line('endBad'), 700); }, 1900);
}

/* ---------- 이벤트(랜덤 공포 연출) ---------- */

/* ---------- 입력 ---------- */
addEventListener('keydown', e => {
  if (e.code === 'Tab') e.preventDefault();
  if (MG.active) return;
  if (e.repeat) return;
  keys[e.code] = true;
  if (campusCctv?.isOpen) { e.stopImmediatePropagation(); if(e.code==='Escape'){e.preventDefault();closeGuardCctv();} return; }
  if (state === 'note' && (e.code === K().interact || e.code === 'KeyE' || e.code === 'Escape' || e.code === 'Space')) { closeNote(); return; }
  if (state === 'ui' && $('keypad').classList.contains('show')) { keypadKey(e); return; }
  if (state === 'ui') {
    if ($('inv').classList.contains('show') && e.code !== 'Tab' && e.code !== 'KeyI' && invKey(e)) return;
    if ($('phone').classList.contains('show') && (e.code === 'KeyQ' || e.code === 'KeyE')) { phoneTab = PTABS[(PTABS.indexOf(phoneTab) + (e.code === 'KeyE' ? 1 : PTABS.length - 1)) % PTABS.length]; renderPhone(); return; }
    if ($('mapOv').classList.contains('show') && (e.code === 'KeyZ' || e.code === 'KeyX')) { mapZoom = clamp(mapZoom * (e.code === 'KeyZ' ? 1.25 : .8), .5, 4); renderMap(); return; }
    if (['Tab', 'Escape', 'KeyI', 'KeyT', K().inv, K().map, K().phone].includes(e.code)) closeUI();
    return;
  }
  if (state !== 'playing') return;
  if (e.code === 'Escape') { e.preventDefault(); pauseGame(); document.exitPointerLock?.(); return; } if (P.sitting && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', K().interact, K().jump].includes(e.code)) { standUp(); return; }   // 의자에서 일어나기
  if (e.code === K().inv || e.code === 'KeyI') { openInv(); return; }
  if (e.code === K().map) { openMap(); return; }
  if (e.code === 'F5') { e.preventDefault(); phoneTool('save'); return; }
  if (e.code === K().scan) { scanAround(); return; }
  if (e.code === K().quest) { objModeCycle(); return; }
  if (e.code === 'KeyK') { objDoneOpen = !objDoneOpen; objDoneSplit(); return; }
  if (CALL.ring && (e.code === K().phone || e.code === 'Backspace')) { e.preventDefault(); e.code === 'Backspace' ? callDecline(false) : callAnswer(); return; }   // 걸려 온 전화: P 받기 · Backspace 끊기
  if (e.code === K().phone) { openPhone(msgs.some(m => !m.read) ? 'msg' : phoneTab); return; }
  if (TEST && e.code === 'KeyT') { openTest(); return; }
  if (e.code === 'Digit1' || e.code === K().flash) { P.light = !P.light; sfx.click(); if (P.light && P.battery <= 0) toast('배터리가 없습니다', inv.battery > 0 ? '2번 키로 건전지를 교체하세요 — 지금은 휴대폰 불빛' : '휴대폰 불빛으로 비춥니다 — 건전지를 찾으세요', 'warn'); }
  if (e.code === 'Digit2') useBattery();
  if (e.code === 'Digit3') useMedkit();
  if (SET.runToggle && (e.code === K().run || e.code === 'ShiftRight')) P.runOn = !P.runOn;
  if (e.code === K().view) toggleView();
  if (e.code === K().camera) camMode(!CAM.on);
  if (e.code === 'KeyR' && CAM.on) camShoot();
  if (e.code === K().crouch || e.code === 'ControlLeft') { P.crouch = !P.crouch; if (P.crouch) P.runOn = false; }
  if (e.code === K().jump && !e.repeat) tryJump();
  if (e.code === K().throwCan) { if (inv.shock > 0) throwShock(); else throwCan(); }   // 쇼트 폭탄이 있으면 캔 대신
  if (target && target.type === 'rbelev' && e.code === K().down) { rbElev(target.e, -1); return; }
  if (target && target.type === 'stairs' && !P.hiding && e.code === K().down) { STH = null; changeFloor(-1); return; }   // Q 는 다른 기능이 없어 한 번 누르면 바로 내려간다
  if (target && target.type === 'stairs' && !P.hiding && e.code === K().interact) { if (!e.repeat) STH = { code: e.code, dir: 1, t: 0 }; return; }   // E 는 조사 키와 같아서 길게 눌러야 올라간다 (파밍 중 실수 방지)   // 계단: 길게 눌러야 층 이동 (파밍 중 실수 방지)
  if (e.code === K().interact) { if (P.hiding) leaveLocker(); else interact(); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('mousemove', e => {
  if (state !== 'playing' && state !== 'dead') return;
  if (!document.pointerLockElement && !DEBUG) return;
  if (state === 'dead' || lookBack > 0) return;
  // 포인터 락 직후·창 전환 시 브라우저가 보내는 비정상적으로 큰 값은 무시 (시점이 순간이동하는 문제)
  if (Math.abs(e.movementX) > 220 || Math.abs(e.movementY) > 220) return;
  const ms = .0022 * SET.sens * (1 - .55 * ZOOM.k); P.yaw -= e.movementX * ms; P.pitch = clamp(P.pitch - e.movementY * ms * (SET.invertY ? -1 : 1), -1.45, 1.45);
  if (P.hiding) P.yaw = clamp(P.yaw, P.hiding.yaw - .7, P.hiding.yaw + .7);
});
canvas.addEventListener('click', () => { if (state === 'playing' && !document.pointerLockElement) lock(); });
$('noteBox').addEventListener('click', closeNote);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); fx.resize(innerWidth, innerHeight, renderer.getPixelRatio()); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && (state === 'playing' || state === 'note') && !DEBUG) { if (state === 'note') closeNote(); pauseGame(); }
});
function pauseGame() {
  state = 'paused'; for (const k in keys) keys[k] = false;
  const o = objective(); $('pauseInfo').textContent = `${CHAPTERS[o.ch - 1].title}  ·  ${CH().name}  ·  ⏱ ${fmtPT(playTime, true, true)}`;
  $('loadBtn2').disabled = !hasSave(); $('bakBtn').disabled = !hasSave();
  $('saveInfo').textContent = lastSave ? `마지막 저장: ${fmtAgo(lastSave.savedAt)} · ${lastSave.where || ''}` : '아직 저장하지 않았습니다';
  $('pause').classList.add('show');
}
function lock() {
  try { const r = canvas.requestPointerLock({ unadjustedMovement: true }); if (r && r.catch) r.catch(() => { try { const r2 = canvas.requestPointerLock(); if (r2 && r2.catch) r2.catch(() => {}); } catch (e) { /* ignore */ } }); }
  catch (e) { try { canvas.requestPointerLock(); } catch (e2) { /* ignore */ } }
}

/* ---------- 저장 / 불러오기 ---------- */
// 저장 · 불러오기는 saveSystem.js (스키마 버전 · 고유 ID · 백업 슬롯 · 구버전 변환)
let deaths = 0; try { deaths = +localStorage.getItem(DEATHS_KEY) || 0; } catch (e) { /* ignore */ }
let SKEYS = storageKeys(TEST), SCTX = { itemUids: [], propUids: [] };   // 월드 생성 뒤 initSaveIds() 에서 채운다
const hasSave = () => { try { return hasSlot(localStorage, SKEYS); } catch (e) { return false; } };
// ── 전 층 가구·소품·사물 위치 자동 감사 교정(벽 이탈 · 문 앞 가로막음 · 공중/바닥 오프셋 교정) 및 텍스처 고화질(Max Anisotropy + PBR Micro-Detail) 업그레이드 ──
function auditAndFixFurnitureAndQuality() {
  const maxAniso = Math.min(16, renderer.capabilities.getMaxAnisotropy?.() || 8);
  const B = new THREE.Box3();
  let clampedFurn = 0, clearedDoorFurn = 0, upgradedTex = 0;
  // 1) S37 & N37 37개 특별실 가구: 문 입구(1.45m)를 가로막는 가구 제거 및 방 벽(cx±3.68, 북쪽 z -9.35..-1.96 / 남쪽 z 1.96..9.35) 이탈 가구 실내 정위치 클램프!
  for (const rm of (S37.rooms || [])) {
    const { f, cx, s, g } = rm;
    if (!g) continue;
    const minX = cx - 3.66, maxX = cx + 3.66;
    const minZ = s > 0 ? -9.32 : 1.98, maxZ = s > 0 ? -1.98 : 9.32;
    const fDoors = (world.doorList || []).filter(d => d.floor === f && Math.abs(d.x - cx) < 3.8 && Math.sign(d.z) === -s);
    g.updateMatrixWorld(true);
    for (const piece of [...g.children]) {
      B.setFromObject(piece);
      if (B.isEmpty()) continue;
      const px = (B.min.x + B.max.x) / 2, pz = (B.min.z + B.max.z) / 2;
      // 문 바로 앞(반경 1.35m)을 막거나 기존 방 고유 가구 충돌체(F.col)와 겹치는 중복 가구는 즉시 숨김 처리하여 가구 겹침 원천 해결!
      const baseCols = (floors[f]?.col || []).filter(c => !c.s37 && !c.n37 && !(floors[f].walls || []).includes(c));
      const overlapsBase = baseCols.some(c => B.min.x < c.x2 - 0.08 && B.max.x > c.x1 + 0.08 && B.min.z < c.z2 - 0.08 && B.max.z > c.z1 + 0.08);
      if ((fDoors.some(d => Math.hypot(px - d.x, pz - d.z) < 1.35) || overlapsBase) && (B.max.y - B.min.y) > 0.25) {
        piece.visible = false; clearedDoorFurn++; continue;
      }
      // 방 벽 바깥으로 삐져나간 가구를 실내 벽 안쪽으로 정밀 이동!
      let dx = 0, dz = 0;
      if (B.min.x < minX) dx = minX - B.min.x;
      else if (B.max.x > maxX) dx = maxX - B.max.x;
      if (B.min.z < minZ) dz = minZ - B.min.z;
      else if (B.max.z > maxZ) dz = maxZ - B.max.z;
      if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
        piece.position.x += dx * s;
        piece.position.z += dz * s;
        clampedFurn++;
      }
      if (B.min.y < -0.05 && piece.position.y < 0) piece.position.y = 0;
    }
    g.updateMatrixWorld(true);
  }
  // 2) 모든 층의 S37/N37 충돌 상자(F.col)도 방 벽 경계 안쪽으로 클램프하여 복도나 외벽 밖에서 보이지 않는 충돌체에 걸리지 않도록 교정!
  for (let f = 0; f < floors.length; f++) {
    const F = floors[f]; if (!F || !F.col) continue;
    F.col = F.col.filter(c => {
      if (!c.s37 && !c.n37) return true;
      if (c.z1 < 1.82 && c.z2 > -1.82) return false; // 복도 침범 충돌체 제거
      if (c.z1 < -9.38) c.z1 = -9.38;
      if (c.z2 > 9.38) c.z2 = 9.38;
      return (c.x2 - c.x1) > 0.08 && (c.z2 - c.z1) > 0.08;
    });
  }
  // 3) 전 씬(가구·소품·사물·장식·벽·바닥) 텍스처 Anisotropy 최대치(8~16x) 및 Mipmap 필터링 일괄 고화질화!
  const seenTex = new Set();
  scene.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'bumpMap', 'emissiveMap']) {
        const t = m[k];
        if (t && t.isTexture && !seenTex.has(t)) {
          seenTex.add(t);
          if ((t.anisotropy || 1) < maxAniso) { t.anisotropy = maxAniso; upgradedTex++; }   // needsUpdate 를 켜면 이미 올라간 텍스처 수백 장을 통째로 다시 올려 프레임이 무너진다 — 아직 안 올라간 것에만 적용
        }
      }
    }
  });
  window.__furnitureAuditStats = { clampedFurn, clearedDoorFurn, upgradedTex, maxAniso };
}
function initSaveIds() {
  assignUids(world.items, itemUid); assignUids(world.props, propUid); assignUids(world.doorList, doorUid);
  SCTX = { itemUids: world.items.map(i => i.uid), propUids: world.props.map(p => p.uid) };
}
function whereText() { if (RBG && P.floor === 0 && !isOutdoors()) return RBG.where(P.x, P.z, P.sh || 0) || RBG.floorLabel(P.x, P.z, P.sh || 0) || '본관'; if (P.floor === 0 && isOutdoors()) return '학교 밖'; const r = roomAt(P.floor, P.x, P.z); return AREA_NAMES[P.floor] + (r ? ' · ' + r.name : ''); }
let lastSave = null;
function save(silent) {
  if (state === 'dead' || state === 'won' || state === 'menu' || state === 'intro') return;
  const d = {
    schemaVersion: SCHEMA, build: BUILD,
    meta: { char: CHAR, ch: objective().ch, time: playTime, savedAt: Date.now(), where: whereText() },
    player: { ...(P.inElev ? (q => ({ x: q.px - .9, z: q.pz, yaw: Math.PI / 2 }))(elvHere(P.floor) || ELV.p) : { x: P.x, z: P.z, yaw: P.yaw }), floor: P.floor, sh: P.sh || 0, hp: P.hp, battery: P.battery, stamina: P.stamina, keys: P.keys, light: P.light, pbat: Math.round(P.pbat ?? 100), roofSeen: !!P.roofSeen, b1Seen: !!P.b1Seen, gymSeen: !!P.gymSeen, cafeSeen: !!P.cafeSeen, poolSeen: !!P.poolSeen, bcast: !!P.bcast },
    progress: { got: [...got], FL: { ...FL }, power, gateClosed, introDone, playTime },
    inv: { ...inv }, docs: docs.map(x => ({ id: x.id, kind: x.kind })), msgs: msgs.map(m => ({ ...m })), clues: [...clues],
    events: [...EV.done], tips: [...tipsDone], cards: [...seenCards], b33: EV.b33,
    world: {
      items: Object.fromEntries(world.items.filter(i => i.taken).map(i => [i.uid, 1])),
      props: Object.fromEntries(world.props.filter(p => p.done || p.on || p.fused || p.tried || p.fails).map(p => [p.uid, { done: !!p.done, on: !!p.on, fused: !!p.fused, tried: !!p.tried, fails: p.fails || 0 }])),
      doors: Object.fromEntries(world.doorList.map(dd => [dd.uid, dd.target > .5 ? 1 : 0])),
    },
    ghost: { active: ghost.active, enraged: ghost.enraged, floor: ghost.floor, x: ghost.x, z: ghost.z },
  };
  try { writeSlot(localStorage, SKEYS, d); lastSave = d.meta; toast('저장되었습니다', `${silent ? '자동 저장 · ' : ''}${d.meta.where} · ⏱ ${fmtPT(playTime)}`, 'info'); statFlush(); }
  catch (e) { toast('저장 실패', '브라우저 저장 공간을 확인하세요', 'warn'); }
}
function readSave(preferBackup) { try { return readSlot(localStorage, SKEYS, SCTX, preferBackup).data; } catch (e) { return null; } }
// 장치 상태 복원 (시각 연출까지 맞춘다)
function restoreProp(p, s) {
  p.tried = !!s.tried; p.fails = s.fails || 0;
  if (p.kind === 'breaker') { p.fused = !!s.fused; if (s.on) { p.on = true; p.done = true; if (p.lev) p.lev.rotation.z = -0.45; } return; }
  if (p.kind === 'switch') { flipSwitch(p, !!s.on); return; }
  if (p.kind === 'clue' && s.done) { p.done = true; p.mesh.visible = false; return; }
  if (!s.done) return;
  p.done = true;
  if (p.kind === 'safe') { p.open = 1; p.opening = true; if (p.piv) p.piv.rotation.y = 1.95; p.key.locked = false; p.key.mesh.visible = !p.key.taken; }
  else if (p.kind === 'lock') openLockVisual(p);
  else if (p.kind === 'mina') { if (FL.mina) minaFollowStart(); else { mina.visible = false; minaProps.visible = false; } }
}
function load(preferBackup) {
  const r = (() => { try { return readSlot(localStorage, SKEYS, SCTX, preferBackup); } catch (e) { return { data: null }; } })();
  const d = r.data;
  if (!d) { toast('세이브를 불러올 수 없습니다', '저장 데이터가 없거나 손상되었습니다', 'warn'); return false; }
  beginStorySession();
  const fixes = repairProgress(d, TOTAL);
  // 1) 주인공 — 세이브의 캐릭터로 맞춘다 (외형 · 능력 · 대사)
  if (CHARACTERS[d.meta.char]) { CHAR = d.meta.char; try { localStorage.setItem(CHAR_KEY, CHAR); } catch (e) { /* ignore */ } }
  applyChar();
  // 2) 플레이어 · 진행
  Object.assign(P, d.player); if (RBG) { const m = RBG.mapTeleport({ floor: P.floor, x: P.x, z: P.z, yaw: P.yaw, sh: d.player.sh }, -1, world); P.floor = m.floor; P.x = m.x; P.z = m.z; P.sh = m.sh ?? 0; }   // 예전 건물 기준 세이브도 새 건물의 같은 자리로
  if(restoreOutsideElevatorBay(P,floors[P.floor]?.elevatorBay)){P.sh=P.shV=P.jy=P.jyV=P.vy=0;} P.hiding = null; $('hide').classList.remove('show');$('peekEye').classList.remove('on');
  got.splice(0, TOTAL, ...d.progress.got.slice(0, TOTAL).map(Boolean));
  Object.assign(inv, d.inv); Object.assign(FL, d.progress.FL || {}); B1D && B1D.sync(); campusCctv?.restoreChannels(FL.guardCctvChannels||[]); power = !!d.progress.power;
  msgs.length = 0; msgs.push(...(d.msgs || [])); clues.length = 0; clues.push(...(d.clues || []));
  docs.length = 0; (d.docs || []).forEach(x => addDoc(x));
  EV.done.clear(); (d.events || []).forEach(e => EV.done.add(e)); EV.b33 = d.b33 || 0;
  tipsDone.clear(); (d.tips || []).forEach(t => tipsDone.add(t)); seenCards.clear(); (d.cards || []).forEach(c => seenCards.add(c));
  introDone = !!d.progress.introDone; playTime = d.progress.playTime || 0;
  if (!FL.night && playTime > 200) FL.night = true;   // 이전 버전 세이브: 이미 밤
  DAY.done = false; DAY.start = -1; DAY.k = FL.night ? 0 : .92;
  // 3) 월드: 아이템 → 장치 → 문 (장치 복원이 아이템 상태를 참고하므로 순서 중요)
  world.items.forEach(it => { if (d.world.items[it.uid]) { it.taken = true; it.mesh.visible = false; } });
  world.props.forEach(p => { const s = d.world.props[p.uid]; if (s) restoreProp(p, s); });
  world.doorList.forEach(dd => { const v = d.world.doors && d.world.doors[dd.uid]; if (v != null) { dd.target = v; dd.open = v; dd.rect.off = v > .4; dd._slideE = -1; if (dd.leafCols) dd.leafCols.forEach(c => { c.off = true; c.o = -1; }); } }); updateSchoolDoors(world);
  // 4) 필수 아이템 영구 소실 방지: 열쇠 조각 상태를 진행 기록과 맞춘다
  world.items.filter(i => i.kind === 'key').forEach(it => {
    if (got[it.idx] && !it.taken) { it.taken = true; it.mesh.visible = false; }
    if (!got[it.idx] && it.taken) { it.taken = false; it.mesh.visible = !it.locked; fixes.push(`열쇠 조각 ${it.idx + 1} 복구`); }
  });
  if (d.progress.gateClosed) { gateClosed = true; gateState = 'closed'; gateAnim = 1; gate.setOpen(0); }
  if (false && d.ghost) Object.assign(ghost, { active: true, enraged: !!d.ghost.enraged, floor: d.ghost.floor, x: d.ghost.x, z: d.ghost.z, state: 'patrol', path: [], wait: 2, spawnGrace: 4 });
  settleStoryGhost(ghost); ghost.storyTime = 0;
  lastSave = d.meta;
  sqSync(true); patchRestore(); chapterShown = objective().ch; refreshHud();
  toast(r.source === 'backup' ? '백업 세이브에서 불러왔습니다' : r.source === 'legacy' ? '이전 버전 세이브를 변환했습니다' : '불러오기 완료', `${CHAPTERS[chapterShown - 1].title} · ${d.meta.where || ''}`, r.source === 'main' ? 'info' : 'warn');
  if (fixes.length) console.info('[save] 진행 상태 보정:', fixes);
  return true;
}

// 그림자 드리우는 메시 8천여 개 → 손전등 그림자 패스가 장면을 한 번 더 통째로 그렸다. 벽 · 바닥 · 천장 같은 큰 판과 작은 잡동사니는 그림자를 받기만 한다
function trimShadowCasters() { const bb = new THREE.Box3(), sz = new THREE.Vector3(); let n = 0;
  scene.traverse(o => { if (!o.isMesh || !o.castShadow || o.isSkinnedMesh || o.userData.keepShadow) return; if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const r = o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z); if (o.isInstancedMesh || r > 2.2 || r < .18) { o.castShadow = false; n++; } });
  if (n) console.info(`[그림자] 그림자 드리우기 끔 ${n}개 (큰 판 · 작은 소품)`); }
[20000, 60000].forEach(ms => setTimeout(() => { try { trimShadowCasters(); } catch (e) {} }, ms));
function start(skipIntro = false) {
  beginStorySession(); const epoch=storySession;
  initAudio(); closeMenus(); applyChar(); { const par = renderer.extensions.has('KHR_parallel_shader_compile');   // 병렬 컴파일이 없으면 씬 전체 컴파일이 동기라 한 번에 수십 초 멈춘다 → 한 번만
  (par ? [400, 6000, 15000, 30000, 50000] : [400]).forEach(ms => setTimeout(() => { if (ms <= 6000) try { upgradePlainMaterials(scene); } catch (e) {} prewarmFloors(true, (fx.composer ? fx.composer.renderTarget1 : null)).catch(() => {}); }, ms));
  if (!par) setTimeout(() => { try { upgradePlainMaterials(scene); } catch (e) {} }, 6000); }   // 늦게 들어오는 GLB(민아 · 소품)까지 시작 연출 동안 미리 컴파일   // 시작 연출 동안 나중에 생긴 재질까지 한 번 더 예열
  if (!readingSave) { DAY.k = .92; DAY.start = -1; DAY.done = false; delete FL.night; GUARD_WALK.startedWalk = false; GUARD_WALK.greetedGate = false; }
  refreshHud(); chapterShown = objective().ch;
  if (skipIntro || TEST) { finishIntro(); return; }
  state = 'intro'; introT = 0; introText = true; introCue = 0; introGuardEnd = 0; introEndT = 99; $('intro').classList.add('show'); $('cine').classList.add('on');
  // 캐릭터 성별 분기 인트로: 서연(여성 캐릭터)은 여성 성우 독백(intro1_s~intro4_s), 지훈(남성 캐릭터)은 남성 성우 독백(intro1_j~intro4_j)으로 재생!
  const isSeoyeon = CHAR === 'seoyeon';
  const ids = isSeoyeon ? ['intro1_s', 'intro2_s', 'intro3_s', 'intro4_s'] : ['intro1_j', 'intro2_j', 'intro3_j', 'intro4_j'];
  const charLabel = isSeoyeon ? '🎙 김서연 (방송부 2학년)' : '🎙 박지훈 (서현고 2학년)';
  const labelFor = i => i === 2 ? '📱 선배 박민아 · 음성 사서함 (사흘 전 23:52)' : (i === 3 ? charLabel : '📖 내레이션');
  const ps = [...$('intro').querySelectorAll('p')];
  ps.forEach((p, i) => {
    p.classList.remove('on');
    p.classList.toggle('msg', i === 2);
    p.dataset.from = labelFor(i);
    p.textContent = (VO[ids[i]] || VO['intro' + (i + 1)]).text;
  });
  preload([...ids, 'guard1']);
  const W = s => new Promise(r => setTimeout(r, s * 1000 / (DEBUG && window.__introJump ? 6 : 1)));
  (async () => {
    await W(.9);
    for (let i = 0; i < 4; i++) {
      if (epoch!==storySession || state !== 'intro') return;
      if (i === 2) { sfx.vibrate(); await W(1.2); if (epoch!==storySession || state !== 'intro') return; }
      ps[i].classList.add('on');
      const vEntry = VO[ids[i]] || VO['intro' + (i + 1)];
      const whoBadge = labelFor(i);
      const sec = await speak(ids[i], i === 2 ? 'phone' : 'none', true);
      subtitle(whoBadge, vEntry.text, Math.max(sec, 2.2), vEntry.spk, vEntry.stage || '');
      await W(Math.max(sec, 1.8) + .45);
    }
    if (epoch===storySession && state === 'intro') { sfx.swell(1.6, .35); await W(1.5); if(epoch!==storySession||state!=='intro')return;introText = false; introT = 6; }
  })();
}
// 정문 입구에서 초반 대화 후 순간이동하지 않고 실제 통로·정문·경비실 문을 따라 걸어가 의자에 착석하는 경비원 AI
let introGuard = null, introCue = 0, introGuardEnd = 0, introEndT = 0;
// 경비실 외벽(x: 4.1~7.9, z: 65.0~68.1)을 절대 관통하지 않고 보도블록과 출입문(x=6.95, z=68.01)으로만 정확히 다니도록 학습된 16-노드 AI 순찰 네비게이션 그래프
const GUARD_WAYPOINTS = [
  { x: 1.30, z: 73.60, label: 'gate_front' },
  { x: 1.25, z: 69.15, label: 'spur_junction', pose: 'inspect', pause: 2.8, lookYaw: 0 },
  { x: 4.50, z: 69.15, label: 'booth_approach_south' },
  { x: 6.95, z: 69.15, label: 'booth_door_out', doorCheck: true },
  { x: 6.95, z: 67.35, label: 'booth_door_in', doorCheck: true, insideSeatPass: true },
  { x: 6.95, z: 66.22, label: 'booth_aisle', insideSeatPass: true },
  { x: GUARD_LAYOUT.npc.x, z: GUARD_LAYOUT.npc.z, label: 'booth_seat', insideSeatPass: true, seatPause: 9.0 },
  { x: 6.95, z: 66.22, label: 'patrol_exit_aisle', insideSeatPass: true },
  { x: 6.95, z: 67.35, label: 'patrol_exit_threshold', doorCheck: true, insideSeatPass: true },
  { x: 6.95, z: 69.15, label: 'patrol_exit_door', doorCheck: true },
  { x: 1.25, z: 69.15, label: 'patrol_to_main_road' },
  { x: 1.25, z: 62.50, label: 'main_road_mid' },
  { x: -3.80, z: 57.00, label: 'plaza_west', pose: 'radio', pause: 3.6, lookYaw: 2.85 },
  { x: 0.00, z: 46.20, label: 'main_steps', pose: 'stand', pause: 4.2, lookYaw: Math.PI },
  { x: 3.60, z: 57.00, label: 'plaza_east', pose: 'stance', pause: 3.4, lookYaw: -2.75 },
  { x: 1.25, z: 62.50, label: 'return_main_road' }
];
const GUARD_WALK = {
  state: 'walking', // 'gate_talk' | 'walking' | 'patrol_pause' | 'seated' | 'leaving_duty' | 'off_duty'
  wpIndex: 1,
  phase: 0,
  stepAcc: 0,
  doorWait: 0,
  pauseTimer: 0,
  seatTimer: 8.5,
  talkWait: 0,
  talking: false,
  startedWalk: true,
  greetedGate: false,
  stuckT: 0
};
function buildGuardNPC() {
  const g = new THREE.Group(), M = (c, r = .8, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...o });
  const uni = M(0x283450, .82), pants = M(0x1c2130, .85), skin = M(0xc9a088, .62), boot = M(0x111111, .4), badge = M(0xc8a040, .35, { metalness: .7 }), blk = M(0x15161a, .5), gray = M(0x8a8a88, .7);
  const cap = (r, h, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 6, 12), m);
  const seatedBody = new THREE.Group(); seatedBody.position.y = -.36; g.add(seatedBody);
  const put = (o, ...a) => { if (o.isBufferGeometry) o = new THREE.Mesh(o, a.shift()); const [x, y, z, p = seatedBody] = a; o.position.set(x, y, z); p.add(o); return o; };
  const legs = [];
  [-1, 1].forEach(s => {
    const thigh = put(cap(.085, .30, pants), s * .11, .56, .21, g); thigh.rotation.x = Math.PI / 2;
    const shin = put(cap(.075, .31, pants), s * .11, .27, .42, g);
    const foot = put(new THREE.BoxGeometry(.12, .10, .26), boot, s * .11, .05, .49, g);
    legs.push({ s, thigh, shin, foot });
  });
  put(new THREE.BoxGeometry(.4, .07, .24), blk, 0, .9, 0);   // 근무 벨트
  put(new THREE.BoxGeometry(.07, .12, .05), blk, -.2, .87, .1); put(new THREE.BoxGeometry(.06, .16, .04), blk, .2, .88, .1);   // 파우치 · 무전기
  const body = put(cap(.2, .42, uni), 0, 1.22, 0); body.scale.set(1.05, 1, .74);
  put(new THREE.BoxGeometry(.08, .45, .02), M(0x23283a, .7), 0, 1.25, .15);   // 지퍼 · 넥타이 선
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(.12, .045), new THREE.MeshBasicMaterial({ map: makeSign('SECURITY', '#20242c', '#d8d4c4', 22), color: 0xb0aca0 })); put(patch, .1, 1.37, .152);
  put(new THREE.CircleGeometry(.035, 12), badge, -.11, 1.37, .152);
  put(new THREE.BoxGeometry(.11, .025, .01), M(0xd8d8d0, .6), .1, 1.31, .152);   // 명찰
  const arms = [];
  [-1, 1].forEach(s => { const a = put(cap(.06, .44, uni), s * .26, 1.15, 0); a.rotation.z = s * .1; const hand = put(new THREE.SphereGeometry(.045, 10, 8), skin, s * .29, .88, .02); arms.push({ s, a, hand }); });
  put(new THREE.CylinderGeometry(.05, .055, .08, 10), skin, 0, 1.53, 0);
  const head = put(new THREE.SphereGeometry(.105, 18, 14), skin, 0, 1.66, .01); head.scale.set(.95, 1.08, 1);
  put(new THREE.BoxGeometry(.14, .02, .01), gray, 0, 1.6, .1);   // 희끗한 콧수염
  [-1, 1].forEach(s => { put(new THREE.SphereGeometry(.012, 8, 6), blk, s * .036, 1.685, .094); put(new THREE.BoxGeometry(.04, .008, .01), gray, s * .036, 1.708, .095); put(new THREE.SphereGeometry(.026, 8, 6), skin, s * .1, 1.66, 0).scale.set(.5, 1, .8); });   // 눈 · 눈썹 · 귀
  put(new THREE.BoxGeometry(.024, .04, .03), skin, 0, 1.65, .105);   // 코
  put(new THREE.CylinderGeometry(.108, .104, .07, 18, 1, true, Math.PI * .6, Math.PI * .8), gray, 0, 1.7, 0);   // 모자 아래 희끗한 옆 · 뒷머리
  put(new THREE.CylinderGeometry(.115, .118, .08, 18), uni, 0, 1.77, 0);
  put(new THREE.BoxGeometry(.2, .015, .13), blk, 0, 1.735, .1);   // 모자 챙
  put(new THREE.CircleGeometry(.025, 12), badge, 0, 1.79, .118);
  put(new THREE.CylinderGeometry(.025, .02, .2, 10), blk, .3, .95, .1).rotation.x = Math.PI / 2;   // 손전등
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData.procParts = { seatedBody, legs, arms };
  return g;
}
function buildGuard() { return guardNPC; }
const NO_GUARD = true;   // 일요일 밤의 서문고 — 당직 경비원은 순찰을 나가 자리에 없고, 경비실엔 그날 밤의 무전기와 일지만 남았다
const guardNPC = buildGuardNPC(); guardNPC.position.set(GUARD_LAYOUT.npc.x, .02, GUARD_LAYOUT.npc.z); guardNPC.rotation.y = 0; guardNPC.name = 'GUARD_SEATED_NPC'; world.OUT.add(guardNPC);
introGuard = guardNPC;
if (NO_GUARD) { guardNPC.visible = false; Object.defineProperty(guardNPC, 'visible', { get: () => false, set: () => {} }); }   // 어떤 경로로도 다시 나타나지 않게
const guardPropRef = { kind: 'guardnpc', floor: NO_GUARD ? -1 : 0, x: GUARD_LAYOUT.npc.x, z: GUARD_LAYOUT.npc.z, y: 1.15, label: '경비 아저씨와 이야기하기' };
world.props.push(guardPropRef);
// 경비실 책상: 1998년 무전기(교신 3개) · 근무 일지 묶음(3장) · 2008년 증언 카세트
{
  const M = (c, r = .6, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const put = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; world.OUT.add(m); return m; };
  const rx = 6.55, rz = 64.45, dy = .79, ry0 = .79;   // 무전기: 관제실 콘솔 책상 (CCTV 모니터 앞) · 일지 · 녹음기 · 카세트: 당직실 근무 책상   // 무전기: 간이침대 머리맡 (책상 가운데 CCTV · 일지와 떨어지게)   // 책상(x 4.98~6.38 · z 66.52~67.17) 귀퉁이마다 하나씩 — 몰려 있으면 서로 가려 고를 수 없었다
  put(new THREE.BoxGeometry(.07, .2, .045), M(0x1a1b1e, .5, .2), rx, ry0 + .1, rz, .3);
  put(new THREE.CylinderGeometry(.008, .008, .16, 6), M(0x111111, .4), rx + .02, ry0 + .28, rz, .3);
  const led = put(new THREE.BoxGeometry(.012, .012, .006), new THREE.MeshBasicMaterial({ color: 0x401010 }), rx - .015, ry0 + .185, rz + .024, .3);
  const lx = 6.2, lz = 66.78;
  put(new THREE.BoxGeometry(.22, .035, .3), M(0x6a5a3a, .9), lx, dy + .018, lz, -.15);
  put(new THREE.BoxGeometry(.21, .006, .29), M(0xe8e0c8, .95), lx, dy + .038, lz, -.12);
  { const vr = put(new THREE.BoxGeometry(.11, .028, .06), M(0x2c2e33, .4, .3), 6.28, dy + .014, 67.08, -.2); put(new THREE.BoxGeometry(.012, .006, .012), new THREE.MeshBasicMaterial({ color: 0xb02020 }), 6.31, dy + .03, 67.07); }   // 보이스레코더 (책상 동쪽)
  const tx = 5.68, tz = 66.72, ty = .79;   // 증언 카세트: 책상이 꽉 차서 옆 간이침대 위에
  put(new THREE.BoxGeometry(.11, .018, .07), M(0x222226, .45), tx, ty + .01, tz, .5);
  put(new THREE.BoxGeometry(.09, .004, .05), M(0xd8c8a0, .8), tx, ty + .021, tz, .5);
  world.props.push({ kind: 'gradio', floor: 0, x: rx, z: rz, y: ry0 + .1, r: 1.5, n: 0, led, label: '경비 무전기 켜기 — 1998.10.12 교신 기록' });
  world.props.push({ kind: 'glog', floor: 0, x: lx, z: lz, y: dy, r: 1.5, n: 0, label: '경비 근무 일지 묶음 넘기기' });
  world.props.push({ kind: 'tape', id: 'ts_guard', floor: 0, x: tx, z: tz, y: ty, r: 1.5, label: '증언 카세트 재생', ...world.TAPES.ts_guard });
}
npcLoad('guard', guardNPC, { url: 'assets/characters/guard.glb', height: 1.75, native: true, clipNames: ['idle'], onLoad: () => {
  guardNPC.userData.seatedReport = applyGuardSeatedPose(guardNPC,GUARD_LAYOUT.seat);
  if (GUARD_WALK.state !== 'seated') setGuardPoseMode(GUARD_WALK.state === 'walking' ? 'walk' : 'stand', GUARD_WALK.phase);
} });
{
  const torchFx = new THREE.Group(); torchFx.name = 'GUARD_TORCH_FX'; torchFx.visible = false;
  const lens = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex(), color: 0xfff0d0, blending: THREE.AdditiveBlending, depthWrite: false }));
  lens.scale.setScalar(.55); lens.position.set(.24, 1.10, .46); torchFx.add(lens);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(.85, 4.6, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0d0, transparent: true, opacity: .075, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  beam.geometry.translate(0, -2.3, 0); beam.rotation.x = -Math.PI / 2 - .22; beam.position.set(.24, 1.10, .46); torchFx.add(beam);
  guardNPC.add(torchFx); guardNPC.userData.torchFx = torchFx;
}
const guardCap = new THREE.Mesh(new THREE.CylinderGeometry(.115, .118, .08, 18), new THREE.MeshStandardMaterial({ color: 0x283450, roughness: .8 })); guardCap.position.set(GUARD_LAYOUT.cap.x, GUARD_LAYOUT.cap.y, GUARD_LAYOUT.cap.z); guardCap.visible = false; world.OUT.add(guardCap);

function syncGuardPropPosition() {
  guardPropRef.x = guardNPC.position.x;
  guardPropRef.z = guardNPC.position.z;
  guardPropRef.y = GUARD_WALK.state === 'seated' ? 1.15 : 1.42;
}
function setGuardPoseMode(mode, phase = 0) {
  const pp = guardNPC.userData.procParts;
  const tfx = guardNPC.userData.torchFx;
  if (tfx) tfx.visible = mode !== 'seated';
  if (mode === 'seated') {
    if (pp) {
      pp.seatedBody.position.y = -.36;
      pp.legs.forEach(({ s, thigh, shin, foot }) => {
        thigh.position.set(s * .11, .56, .21); thigh.rotation.x = Math.PI / 2;
        shin.position.set(s * .11, .27, .42); shin.rotation.x = 0;
        foot.position.set(s * .11, .05, .49); foot.rotation.x = 0;
      });
      pp.arms.forEach(({ s, a }) => { a.rotation.x = 0; a.rotation.z = s * .1; });
    }
    guardNPC.position.set(GUARD_LAYOUT.npc.x, .02, GUARD_LAYOUT.npc.z);
    guardNPC.rotation.y = 0;
    if (guardNPC.userData.characterModel) {
      guardNPC.userData.curClipName = 'Seated';
      guardNPC.userData.npcAction?.getMixer?.()?.stopAllAction();
      guardNPC.userData.seatedReport = applyGuardSeatedPose(guardNPC, GUARD_LAYOUT.seat);
    }
    syncGuardPropPosition();
    return;
  }
  if (pp) {
    const breath = Math.sin(performance.now() * 0.002) * 0.015;
    pp.seatedBody.position.y = breath;
    const sw = mode === 'walk' ? Math.sin(phase) * .46 : Math.sin(performance.now() * 0.0015) * 0.03;
    pp.legs.forEach(({ s, thigh, shin, foot }) => {
      const lsw = sw * s;
      thigh.position.set(s * .11, .62, Math.sin(lsw) * .09); thigh.rotation.x = lsw;
      shin.position.set(s * .11, .28, Math.sin(lsw) * .17 - Math.max(0, -lsw) * .07); shin.rotation.x = Math.max(0, -lsw * .68);
      foot.position.set(s * .11, .05, .05 + Math.sin(lsw) * .19); foot.rotation.x = lsw * .28;
    });
    pp.arms.forEach(({ s, a }) => {
      if (mode === 'radio' && s < 0) { a.rotation.x = -1.35; a.rotation.z = 0.25; }
      else if (mode === 'inspect') { a.rotation.x = s > 0 ? -1.05 : -0.35; a.rotation.z = s * 0.1; }
      else { a.rotation.x = s > 0 ? -.85 : -sw * s * .58; a.rotation.z = s * .08; }
    });
  }
  const cm = guardNPC.userData.characterModel;
  if (cm) {
    if (guardNPC.userData.seated) {
      const pel = cm.getObjectByName('pelvis');
      if (pel && guardNPC.userData.origPelvisPos) pel.position.copy(guardNPC.userData.origPelvisPos);
      guardNPC.userData.seated = false;
    }
    const clipMap = {
      walk: 'Walk',
      stand: 'Idle',
      inspect: 'Inspect',
      radio: 'RadioUse',
      stance: 'GuardStance',
      torch: 'FlashlightHold'
    };
    const want = clipMap[mode] || 'Idle';
    if (guardNPC.userData.curClipName !== want) {
      guardNPC.userData.curClipName = want;
      npcVisuals.play(guardNPC, want, { fade: .28, speed: mode === 'walk' ? 1.08 : 1.0 });
    }
  }
  syncGuardPropPosition();
}
function placeGuardAtGateForIntro() {
  const wp0 = GUARD_WAYPOINTS[0];
  GUARD_WALK.state = 'gate_talk';
  GUARD_WALK.wpIndex = 1;
  GUARD_WALK.phase = 0;
  GUARD_WALK.stepAcc = 0;
  GUARD_WALK.doorWait = 0;
  GUARD_WALK.pauseTimer = 0;
  GUARD_WALK.talkWait = 4.2;
  GUARD_WALK.talking = false;
  GUARD_WALK.startedWalk = false;
  guardNPC.visible = true;
  guardNPC.position.set(wp0.x, .02, wp0.z);
  guardNPC.rotation.y = -.15;
  setGuardPoseMode('stand', 0);
}
function startGuardWalkToBooth() {
  GUARD_WALK.state = 'walking';
  GUARD_WALK.startedWalk = true;
  if (GUARD_WALK.wpIndex < 1 || GUARD_WALK.wpIndex >= GUARD_WAYPOINTS.length) GUARD_WALK.wpIndex = 1;
  setGuardPoseMode('walk', GUARD_WALK.phase);
}
function startGuardPatrolRound(startWp = 1) {
  GUARD_WALK.state = 'walking';
  GUARD_WALK.startedWalk = true;
  GUARD_WALK.talking = false;
  GUARD_WALK.wpIndex = startWp;
  const wp = GUARD_WAYPOINTS[startWp] || GUARD_WAYPOINTS[1];
  guardNPC.position.set(wp.x, .02, wp.z);
  setGuardPoseMode('walk', GUARD_WALK.phase);
}
function resetGuardToSeatedImmediate() {
  GUARD_WALK.state = 'seated';
  GUARD_WALK.wpIndex = 6;
  GUARD_WALK.seatTimer = 9.0;
  GUARD_WALK.startedWalk = true;
  GUARD_WALK.talking = false;
  setGuardPoseMode('seated', 0);
}
function lockMainGateByGuard() {
  if (gateClosed) return;
  gateClosed = true;
  gateState = 'closing';
  sfx.gateClang();
  shake = Math.max(shake, .75);
  if (P.floor === 0 && P.z > GATE_Z - 12) lookBack = 1.6;
  setTimeout(() => {
    if (state === 'playing') {
      toast('🔒 정문 야간 자동 잠금', '19:00 — 전동 철문이 경고음과 함께 닫히고 잠금장치가 걸렸다', 'warn');
      talk('gate', 4200);
      refreshHud();
    }
  }, 650);
}
function triggerGuard7PMClockOut() {
  if (GUARD_WALK.state === 'off_duty' || GUARD_WALK.state === 'leaving_duty') return;
  GUARD_WALK.state = 'leaving_duty';
  GUARD_WALK.talking = false;
  guardNPC.visible = true;
  if (state === 'playing') {
    toast('19:00 · 경비원 퇴근 및 정문 폐쇄', '퇴근 시간이 되어 경비 아저씨가 정문을 걸어 잠그러 이동합니다', 'info');
    if (P.floor === 0 && P.z > 20) line('guardBye', 'none', '🔦 당직 경비원 · 박종철 아저씨');
  }
  setGuardPoseMode('walk', GUARD_WALK.phase);
}
function updateGuardWalk(dt) {
  if (NO_GUARD) {   // 당직 경비원은 순찰 중: 몸체 · 대화를 끄고, 저녁 7시엔 아무도 없는 정문이 혼자 닫힌다
    guardNPC.visible = false; guardPropRef.floor = -1;
    if (state === 'playing' && (FL.night || DAY.k <= 0.32) && !gateClosed) lockMainGateByGuard();
    return;
  }
  if (GUARD_WALK.state === 'off_duty') {
    if (!gateClosed && state === 'playing') lockMainGateByGuard();
    guardNPC.visible = false;
    guardPropRef.floor = -1;
    return;
  }
  // 저녁 7시(19:00, 해가 기울어 DAY.k <= 0.32 또는 FL.night)가 되면 경비원이 정문으로 걸어 나가 정문을 잠그고 퇴근한다!
  if (state === 'playing' && (FL.night || DAY.k <= 0.32) && GUARD_WALK.state !== 'leaving_duty') {
    triggerGuard7PMClockOut();
  }
  if (!guardNPC.visible) return;
  const gx = guardNPC.position.x, gz = guardNPC.position.z;
  const turnToward = (targetYaw, rate = 7) => {
    let diff = ((targetYaw - guardNPC.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    guardNPC.rotation.y += diff * Math.min(1, dt * rate);
  };
  // 19:00 퇴근 이동 중: 경비실에서 나와 정문(z = 70.0)을 통과한 직후(z >= 70.8) 정문 철문을 쾅 닫고 잠근 뒤 밖(z = 75.8)으로 퇴근 완료!
  if (GUARD_WALK.state === 'leaving_duty') {
    const exitTarget = (gz < 68.8 && gx > 4.2) ? { x: 6.95, z: 69.2 } : (gz < 69.5 && gx > 2.2) ? { x: 1.25, z: 69.2 } : { x: 1.25, z: 75.8 };
    if (gz <= 68.6 && gz >= 67.5 && gx >= 6.0 && !(FL.guardDoorOpen ?? true)) {
      FL.guardDoorOpen = true; sfx.doorOpen(); syncGuardDevices();
    }
    // 경비 아저씨가 정문(GATE_Z = 70) 바깥쪽(z >= 70.75)에 도달하는 순간 정문을 닫고 쇠사슬 자물쇠를 잠근다!
    if (!gateClosed && gz >= GATE_Z + 0.75) {
      lockMainGateByGuard();
    }
    const dx = exitTarget.x - gx, dz = exitTarget.z - gz, dist = Math.hypot(dx, dz);
    if (dist < 0.22 && exitTarget.z > 74.5) {
      if (!gateClosed) lockMainGateByGuard();
      GUARD_WALK.state = 'off_duty';
      guardNPC.visible = false;
      guardPropRef.floor = -1;
      if (state === 'playing') caption('철컥 — 경비 아저씨가 정문을 밖에서 걸어 잠그고 퇴근하며 야간 무인 경비 상태로 전환되었다.');
      return;
    }
    const step = Math.min(dist, 2.15 * dt);
    guardNPC.position.set(gx + (dx / Math.max(0.01, dist)) * step, .02, gz + (dz / Math.max(0.01, dist)) * step);
    turnToward(Math.atan2(dx, dz), 8.0);
    GUARD_WALK.phase += step * 3.8;
    setGuardPoseMode('walk', GUARD_WALK.phase);
    syncGuardPropPosition();
    return;
  }
  if (GUARD_WALK.talking) {
    if (GUARD_WALK.state !== 'seated') {
      setGuardPoseMode('stand', GUARD_WALK.phase);
      turnToward(Math.atan2(P.x - gx, P.z - gz), 8);
    }
    return;
  }
  if (GUARD_WALK.state === 'seated') {
    if (guardNPC.userData.characterModel && !guardNPC.userData.seated) setGuardPoseMode('seated', 0);
    syncGuardPropPosition();
    if (state === 'playing' && P.floor === 0) {
      GUARD_WALK.seatTimer = (GUARD_WALK.seatTimer ?? 9.0) - dt;
      if (GUARD_WALK.seatTimer <= 0) {
        GUARD_WALK.state = 'walking';
        GUARD_WALK.wpIndex = 7;
        guardNPC.position.set(6.85, .02, 66.22);
        setGuardPoseMode('walk', GUARD_WALK.phase);
      }
    }
    return;
  }
  if (GUARD_WALK.state === 'gate_talk') {
    setGuardPoseMode('stand', 0);
    turnToward(Math.atan2(P.x - gx, P.z - gz), 6);
    if (state === 'playing') {
      GUARD_WALK.talkWait -= dt;
      if (GUARD_WALK.talkWait <= 0 || P.z < GATE_Z + 1.2) {
        startGuardWalkToBooth();
      }
    }
    return;
  }
  if (GUARD_WALK.state === 'patrol_pause') {
    const curWp = GUARD_WAYPOINTS[GUARD_WALK.wpIndex] || {};
    setGuardPoseMode(curWp.pose || 'stand', GUARD_WALK.phase);
    if (curWp.lookYaw != null) turnToward(curWp.lookYaw + Math.sin(performance.now() * 0.0012) * 0.35, 5);
    GUARD_WALK.pauseTimer -= dt;
    if (GUARD_WALK.pauseTimer <= 0) {
      GUARD_WALK.state = 'walking';
      GUARD_WALK.wpIndex = (GUARD_WALK.wpIndex + 1) % GUARD_WAYPOINTS.length;
      if (GUARD_WALK.wpIndex === 0) GUARD_WALK.wpIndex = 1;
      setGuardPoseMode('walk', GUARD_WALK.phase);
    }
    return;
  }
  if (GUARD_WALK.state !== 'walking') return;
  const wp = GUARD_WAYPOINTS[GUARD_WALK.wpIndex];
  if (!wp) { startGuardPatrolRound(1); return; }
  if (wp.doorCheck || (gz <= 68.6 && gz >= 67.7 && gx >= 6.2)) {
    if (!(FL.guardDoorOpen ?? true)) {
      FL.guardDoorOpen = true;
      sfx.doorOpen();
      syncGuardDevices();
      GUARD_WALK.doorWait = .42;
    }
  }
  if (GUARD_WALK.doorWait > 0) {
    GUARD_WALK.doorWait -= dt;
    setGuardPoseMode('stand', GUARD_WALK.phase);
    turnToward(Math.PI, 8);
    return;
  }
  const dx = wp.x - gx, dz = wp.z - gz, dist = Math.hypot(dx, dz);
  if (dist < .16) {
    guardNPC.position.x = wp.x;
    guardNPC.position.z = wp.z;
    syncGuardPropPosition();
    if (wp.seatPause) {
      resetGuardToSeatedImmediate();
      GUARD_WALK.seatTimer = wp.seatPause;
      return;
    }
    if (wp.pause > 0) {
      GUARD_WALK.state = 'patrol_pause';
      GUARD_WALK.pauseTimer = wp.pause;
      setGuardPoseMode(wp.pose || 'stand', GUARD_WALK.phase);
      return;
    }
    GUARD_WALK.wpIndex++;
    if (GUARD_WALK.wpIndex >= GUARD_WAYPOINTS.length) GUARD_WALK.wpIndex = 1;
    return;
  }
  if (state === 'playing' && P.floor === 0) {
    const pdx = P.x - gx, pdz = P.z - gz, pDist = Math.hypot(pdx, pdz);
    const dot = (pdx * dx + pdz * dz) / ((pDist * dist) || 1);
    if (pDist < 1.15 && dot > .35) {
      setGuardPoseMode('stand', GUARD_WALK.phase);
      turnToward(Math.atan2(pdx, pdz), 7);
      return;
    }
  }
  const speed = 1.66;
  const step = Math.min(dist, speed * dt);
  const baseAng = Math.atan2(dx, dz);
  const pos = { x: gx + Math.sin(baseAng) * step, z: gz + Math.cos(baseAng) * step };
  const cols = floors[0]?.col;
  const filtered = cols ? (wp.insideSeatPass
    ? (floors[0]._seatPassCols ||= cols.filter(c => !(c.x1 >= 5.3 && c.x2 <= 6.2 && c.z1 >= 65.6 && c.z2 <= 66.55)))
    : cols) : null;
  if (filtered) collide(filtered, pos, .21);
  let moved = Math.hypot(pos.x - gx, pos.z - gz);
  let moveAng = baseAng;
  if (filtered && moved < step * 0.55) {
    for (const off of [0.65, -0.65, 1.22, -1.22, 1.65, -1.65]) {
      const tryAng = baseAng + off;
      const cand = { x: gx + Math.sin(tryAng) * step, z: gz + Math.cos(tryAng) * step };
      collide(filtered, cand, .21);
      const cmv = Math.hypot(cand.x - gx, cand.z - gz);
      if (cmv > moved * 1.25) {
        pos.x = cand.x; pos.z = cand.z; moved = cmv; moveAng = tryAng; break;
      }
    }
  }
  guardNPC.position.set(pos.x, .02, pos.z);
  turnToward(moveAng, 7.8);
  GUARD_WALK.phase += moved * 3.8;
  GUARD_WALK.stepAcc += moved;
  if (GUARD_WALK.stepAcc >= .56) {
    GUARD_WALK.stepAcc = 0;
    if (state === 'playing' && P.floor === 0) at(pos.x, .1, pos.z).step(false, .48, pos.z < 67.9 ? 'tile' : 'stone');
  }
  setGuardPoseMode('walk', GUARD_WALK.phase);
}
window.__guardWalk = { state: GUARD_WALK, waypoints: GUARD_WAYPOINTS, startAtGate: placeGuardAtGateForIntro, walkToBooth: startGuardWalkToBooth, startPatrol: startGuardPatrolRound, clockOut7PM: triggerGuard7PMClockOut, seatImmediate: resetGuardToSeatedImmediate, step: updateGuardWalk };

function finishIntro() {
  // 새 게임: 민아의 음성 메시지("서문일보 호외부터 봐") 다음엔 정문으로 가기 전에 호외부터 펼친다 — 가설은 여기서 시작
  if (state === 'intro' && !readingSave && !TEST && !FL.newsIntro) {
    FL.newsIntro = true; stopSpeak(); introText = false; keepNoteVo = true;
    $('intro').classList.remove('show'); $('introTitle').classList.remove('show');
    addDoc({ id: 'n_seomun_ilbo', kind: 'note' });
    const np = world.items.find(i => i.kind === 'note' && i.id === 'n_seomun_ilbo'); if (np) { np.taken = true; np.mesh.visible = false; }
    showNote({ id: 'n_seomun_ilbo', newspaper: true, title: '『서문일보』 1998.10.13 지역신문 특별 호외', text: '' });
    noteAfter = () => { toast('🧩 가설 노트', '휴대폰 › 연표 탭에 다섯 가설이 기록됐다. 증언 테이프와 문서로 하나씩 검증하자.', 'info'); finishIntro(); };
    return;
  }
  const epoch=storySession;
  if (!keepNoteVo) stopSpeak(); keepNoteVo = false; introText = false;
  preload(['phone1', 'phone2', 'phone3', 'pa1', 'cam1', ...Object.keys(LINES).map(k => `l_${k}_${CK()}`)]);
  $('intro').classList.remove('show'); $('introTitle').classList.remove('show'); $('hud').classList.add('show'); $('cine').classList.remove('on');
  if (!readingSave && !SET.flashReduce) { const b = $('blink'); b.classList.remove('go'); void b.offsetWidth; b.classList.add('go'); setTimeout(() => b.classList.remove('go'), 2700); }   // 눈을 뜨듯 시작
  if (!readingSave) { P.x = 0; P.z = 77.5; P.yaw = 0; P.pitch = 0; }
  state = 'playing';
  if (readingSave) {
    resetGuardToSeatedImmediate();
  } else {
    // 인트로를 스킵했거나 아직 정문 대화를 시작하지 않았다면 정문 입구에 서서 첫 대사를 건넨 뒤 경비실로 걸어가게 한다
    if (!NO_GUARD && !GUARD_WALK.startedWalk) {
      placeGuardAtGateForIntro();
      GUARD_WALK.talkWait = 2.6;
      if (!GUARD_WALK.greetedGate) {
        GUARD_WALK.greetedGate = true;
        setTimeout(async () => {
          if (epoch !== storySession || state !== 'playing') return;
          sfx.flashlightClick();
          const sec = await speak('guard1');
          subtitle('경비 아저씨', VO.guard1.text, Math.max(sec, 2.8) + .4);
          npcVisuals.portrait('guard', '경비원', (Math.max(sec, 2.8) + .4) * 1000);
          setTimeout(() => { if (epoch === storySession && state === 'playing') startGuardWalkToBooth(); }, 1800);
        }, 350);
      } else {
        setTimeout(() => { if (epoch === storySession && state === 'playing') startGuardWalkToBooth(); }, 900);
      }
    }
    startQuietT = performance.now() + 6500;
    setTimeout(() => {if(epoch===storySession&&state==='playing')showChapter(1);}, 600);
    setTimeout(() => {if(epoch===storySession&&state==='playing')talk('arrive', 4200);}, NO_GUARD || GUARD_WALK.startedWalk ? 1500 : 3600);
    setTimeout(() => { if (epoch===storySession && state === 'playing' && P.floor === 0 && isOutdoors()) phoneMessage(0,epoch); }, 10500);   /* 아직 정문 · 운동장에 있을 때만 */
  }
}
let guardGift = false;
async function talkGuard(p) {
  GUARD_WALK.talking = true;
  try {
    const say2 = async id => { const sec = await speak(id); subtitle('경비 아저씨', VO[id].text, Math.max(2.5, sec) + .4); npcVisuals.portrait('guard', '경비 아저씨', (Math.max(2.5, sec) + .4) * 1000); return sec; };
    await say2('guardHi');
    for (let n = 0; n < 4 && state === 'playing'; n++) {
      const opts = [{ label: '민아라는 학생 못 보셨어요?' }, { label: '이 학교에 무슨 일이 있었어요?' }, { label: guardGift ? '(건전지는 이미 받았다)' : '손전등 건전지 좀 있으세요?' }, { label: '이만 가 볼게요' }];
      const desc = GUARD_WALK.state === 'seated'
        ? '경비실 창가 의자에 앉아 있던 경비원이 손전등을 만지작거린다.'
        : '정문에서 경비실로 걸어가던 경비원이 발걸음을 멈추고 손전등을 고쳐 쥔다.';
      const i = await choose('경비 아저씨', desc, opts);
      if (i === 3) { say2('guardBye'); setTimeout(() => triggerGuard7PMClockOut(), 1200); break; }
      if (i === 0) await wait(1000 * await say2('guardMina'));
      else if (i === 1) await wait(1000 * await say2('guardPast'));
      else if (!guardGift) { guardGift = true; inv.battery += 2; refreshHud(); sfx.pickup(); toast('건전지 2개를 받았다', '경비 아저씨: 열한 시 사십 분 전에는 나와야 한다', 'info'); await wait(1000 * await say2('guardGift')); }
    }
  } finally {
    GUARD_WALK.talking = false;
    if (GUARD_WALK.state === 'gate_talk') startGuardWalkToBooth();
  }
}
// 인트로: 검은 화면 텍스트 → 공중 전경(번개 · 타이틀) → 정문으로 하강(경비원이 첫 대사 후 정문을 통과해 경비실로 걸어간다) → 플레이 시작
function updateIntro(dt) {
  introT += dt * (DEBUG && window.__introJump ? 6 : 1);
  if (introText) introT = Math.min(introT, 5.99);
  const ease = t => t * t * (3 - 2 * t), T = introT;
  if (T < 6) { camera.position.set(0, 10, 106); camera.rotation.set(-.1, 0, 0, 'YXZ'); }
  else {
    if ($('intro').classList.contains('show')) { $('intro').classList.remove('show'); }
    const cue = (n, fn) => { if (introCue < n && T >= [0, 6.6, 8.2, 9.4, 12.8, 13.6, 17.2][n]) { introCue = n; fn(); } };
    cue(1, () => { fx.lightning(); sfx.thunder(.6); });
    cue(2, () => { sfx.swell(1.2, .4); });
    cue(3, () => { fx.lightning(); sfx.boom(); $('introTitle').classList.add('show'); sfx.musicBox(7, .6); if (!NO_GUARD) placeGuardAtGateForIntro(); });
    cue(4, () => { $('introTitle').classList.remove('show'); if (!NO_GUARD) placeGuardAtGateForIntro(); sfx.flashlightClick(); });
    if (NO_GUARD) cue(5, () => { GUARD_WALK.greetedGate = true; introGuardEnd = 0; introEndT = T + 1.6; sfx.gateClang(); caption('녹슨 정문이 바람에 삐걱인다. 불 꺼진 경비실 창문 너머엔 아무도 없다.'); });
    else cue(5, async () => { GUARD_WALK.greetedGate = true; introGuardEnd = T + 12; const sec = await speak('guard1'); introGuardEnd = introT + Math.max(sec, 3) + .3; subtitle('경비 아저씨', VO.guard1.text, Math.max(sec, 3) + .4); npcVisuals.portrait('guard', '경비원', (Math.max(sec, 3) + .4) * 1000); });
    // 대사가 끝난 뒤 사라지지 않고 몸을 돌려 정문 안쪽 경비실로 걸어가기 시작한다
    if (!NO_GUARD && introCue === 5 && T >= Math.max(17.2, introGuardEnd)) { introCue = 6; startGuardWalkToBooth(); caption('경비 아저씨가 손전등을 비추며 경비실 쪽으로 걸어간다'); introEndT = T + 2.2; }
    updateGuardWalk(dt);
    // 공중 전경 → 정문 앞으로 하강
    const k1 = ease(clamp((T - 6) / 6.2, 0, 1)), k2 = ease(clamp((T - 12.2) / 5.4, 0, 1));
    const ax = lerp(-26, 0, k1), ay = lerp(24, 8, k1), az = lerp(104, 92, k1);
    camera.position.set(lerp(ax, 0, k2) + Math.sin(T * .7) * .05, lerp(ay, 1.62, k2), lerp(az, 77.5, k2));
    const tx = lerp(0, 0, k2), ty = lerp(5, 1.4, k2), tz = lerp(0, GATE_Z - 6, k2);
    camera.lookAt(tx, ty, tz); camera.rotation.reorder('YXZ'); camera.rotation.z = 0;
  }
  updateLighting(dt);
  if (T > Math.max(19.2, introEndT)) finishIntro();
}
addEventListener('keydown', e => { if (state === 'intro' && ['Space', 'Enter', 'Escape'].includes(e.code)) finishIntro(); });
$('intro').addEventListener('click', () => { if (state === 'intro') finishIntro(); });

/* ---------- 타이틀 · 캐릭터 선택 ---------- */
let readingSave = false;
const fmtAgo = t => { if (!t) return ''; const m = Math.round((Date.now() - t) / 60000); return m < 1 ? '방금 전' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : new Date(t).toLocaleDateString('ko-KR'); };
const tipsDone = new Set();
const MENUS = ['title', 'charsel', 'newConfirm', 'settings', 'gallery', 'credits'];
function closeMenus() { MENUS.forEach(k => $(k).classList.remove('show')); }
function applyChar() {
  const c = CH();
  document.documentElement.style.setProperty('--acc', c.color);
  $('pName').textContent = c.name; $('pAge').textContent = `${c.age} · ${c.school.split(' ')[1] || ''}`; $('dlgName').textContent = c.name;
  curFace = ''; updateFace(0);
}
// 소품 모델 · 텍스처가 아직 들어오는 중이면 시작 전에 마저 받는다: 플레이 중에 매 프레임 텍스처를 올리면 움직일 때마다 끊겼다
function whenAssetsReady(go) {
  const st = window.__modelLoadState; if (window.__modelsDone || !st || TEST) return go();
  const ov = $('loading'), msg = $('loadMsg'), t0 = performance.now(); ov.classList.add('show');
  const iv = setInterval(() => { const s = window.__modelLoadState; if (msg && s) msg.textContent = `교실 소품을 들여놓는 중 · ${s.completed} / ${s.total}`;
    if (window.__modelsDone || performance.now() - t0 > 90000) { clearInterval(iv); setTimeout(() => { ov.classList.remove('show'); go(); }, 400); } }, 250);
}
function newGame() {
  try { clearSlot(localStorage, SKEYS); } catch (e) { /* ignore */ }
  lock(); whenAssetsReady(() => start());
}
function continueGame(preferBackup) {
  const d = readSave(preferBackup); if (d && CHARACTERS[d.meta.char]) CHAR = d.meta.char;   // 시작 전에 주인공부터 맞춘다
  lock(); whenAssetsReady(() => { readingSave = true; start(true); if (!load(preferBackup)) { readingSave = false; P.x = 0; P.z = 77.5; } });
}
function refreshTitle() {
  const d = readSave();
  $('mContinue').style.display = d ? 'block' : 'none';
  if (d && d.meta) { const c = CHARACTERS[d.meta.char]; $('mContInfo').textContent = `${c ? c.name : ''} · 제${d.meta.ch}장 · ${d.meta.where || ''} · ⏱ ${fmtPT(d.meta.time || 0, true)} · ${fmtAgo(d.meta.savedAt)}`; }
  $('mCharName').textContent = CH().name;
  let ends = []; try { ends = JSON.parse(localStorage.getItem(ENDINGS_KEY) || '[]'); } catch (e) { /* ignore */ }
  const ST = statRead(), tot = ST.total ? `총 플레이 ${fmtPT(ST.total, true)}  ·  ` : '';
  $('tEnd').textContent = (ends.length ? `달성한 엔딩: ${ends.filter(e => e === 'true' || e === 'normal' || e === 'cover').map(e => e === 'true' ? 'TRUE' : e === 'cover' ? 'COVER-UP' : 'NORMAL').join(' · ')}  ·  ` : '') + tot;
  const btns = [...$('tMenu').querySelectorAll('button')].filter(b => b.style.display !== 'none'); btns.forEach((b, i) => b.classList.toggle('sel', i === 0));
}
let csMode = 'view', csPick = CHAR;
function openCharsel(mode) {
  csMode = mode; csPick = CHAR; $('title').classList.remove('show'); $('charsel').classList.add('show');
  $('csOk').textContent = mode === 'new' ? '결정 · 시작' : '결정'; renderCharsel(); sfx.ui && sfx.ui();
}
let csShowSheet = false, cs3dState = null;
function ensureCharsel3D() {
  if (cs3dState) return cs3dState;
  const st = { scenes: {}, mixers: {}, models: {}, yaw: { jihun: 0.25, seoyeon: -0.25 }, drag: null, renderer: null, cam: null, raf: 0, last: performance.now() };
  const loader = new GLTFLoader();
  ['jihun', 'seoyeon'].forEach(k => {
    const sc = new THREE.Scene();
    const hemi = new THREE.HemisphereLight(0xf6f2ec, 0x3a4052, 1.4);
    const key = new THREE.DirectionalLight(0xfff4e8, 1.9); key.position.set(1.8, 2.6, 2.8);
    const fill = new THREE.DirectionalLight(0xc8daf8, 0.95); fill.position.set(-2.0, 1.8, 1.6);
    const rim = new THREE.DirectionalLight(0xffd6e0, 0.85); rim.position.set(0, 2.4, -2.5);
    sc.add(hemi, key, fill, rim);
    st.scenes[k] = sc;
    loader.load(`assets/characters/${k}.glb?v=306`, gltf => {
      const m = gltf.scene;
      npcVisuals.enhanceCharacterMaterials?.(m, k);
      m.traverse(o => { if (o.isMesh || o.isSkinnedMesh) o.frustumCulled = false; });
      const b = new THREE.Box3().setFromObject(m);
      m.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
      const piv = new THREE.Group(); piv.add(m); sc.add(piv);
      st.models[k] = { piv, h: b.max.y - b.min.y };
      const clip = (gltf.animations || []).find(c => c.name.toLowerCase() === 'idle') || gltf.animations?.[0];
      if (clip) { const mx = new THREE.AnimationMixer(m); mx.clipAction(clip).play(); st.mixers[k] = mx; }
    });
  });
  st.cam = new THREE.PerspectiveCamera(36, 240 / 380, 0.05, 15);
  const tick = now => {
    st.raf = requestAnimationFrame(tick);
    if (!$('charsel')?.classList.contains('show') || csShowSheet) return;
    const dt = Math.min(0.05, (now - st.last) / 1000); st.last = now;
    if (!st.renderer) {
      try {
        st.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        st.renderer.setSize(240, 380);
        st.renderer.outputColorSpace = THREE.SRGBColorSpace;
        st.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        st.renderer.toneMappingExposure = 1.08;
      } catch (e) { return; }
    }
    document.querySelectorAll('canvas.cs3d').forEach(cv => {
      const k = cv.dataset.char, md = st.models[k], sc = st.scenes[k];
      if (!md || !sc) return;
      if (st.drag?.k !== k) st.yaw[k] += dt * 0.45;
      md.piv.rotation.y = st.yaw[k];
      st.mixers[k]?.update(dt);
      const topY = k === 'jihun' ? 0.90 : 0.84, dist = k === 'jihun' ? 2.68 : 2.48;
      st.cam.position.set(0, topY, dist); st.cam.lookAt(0, topY - 0.03, 0);
      st.renderer.render(sc, st.cam);
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(st.renderer.domElement, 0, 0, cv.width, cv.height);
    });
  };
  st.raf = requestAnimationFrame(tick);
  return (cs3dState = st);
}
function renderCharsel() {
  ensureCharsel3D();
  $('csCards').innerHTML = Object.entries(CHARACTERS).map(([k, c]) => `
    <div class="cs${k === csPick ? ' on' : ''}" data-k="${k}" style="--c:${c.color}">
      <img class="pt" src="assets/ui/${c.portrait}.webp" alt="">
      <div><h3>${c.name}<small>${c.age} · ${c.sex}</small></h3>
        <table><tr><td>학교</td><td>${c.school}</td></tr><tr><td>성격</td><td>${c.pers}</td></tr><tr><td>특징</td><td>${c.trait}</td></tr><tr><td>소개</td><td>${c.intro}</td></tr></table>
        <div class="q">“${c.quote}”</div></div>
      <div class="bd" style="position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden">
        <canvas class="cs3d" data-char="${k}" width="240" height="380" style="width:100%;height:100%;object-fit:contain;cursor:grab;${csShowSheet ? 'display:none' : 'display:block'}" title="드래그하여 360° 회전"></canvas>
        <img src="assets/ui/${c.body}.webp" alt="" style="width:100%;height:100%;object-fit:contain;${csShowSheet ? 'display:block' : 'display:none'}">
        <button type="button" class="csViewToggle" style="position:absolute;bottom:6px;right:6px;z-index:3;font-size:11px;padding:3px 7px;background:rgba(12,15,22,.82);color:#e8e4dc;border:1px solid rgba(255,255,255,.22);border-radius:4px;cursor:pointer">${csShowSheet ? '3D 렌더링 보기' : '2D 시트지 보기'}</button>
      </div>
      <div class="faces">${c.faces.map((f, i) => `<figure><img src="assets/ui/${f}.webp" alt="">${c.faceNames[i]}</figure>`).join('')}</div>
      <div class="perk">${c.perk.map(p => `<span>★ ${p}</span>`).join('')}</div>
      <div class="kit"><b>시작 아이템</b><div class="its">${c.items.map(id => `<div class="it">${iconHTML(ITEMS[id].icon)}<span>${ITEMS[id].name.replace(/ \(.*\)/, '')}</span></div>`).join('')}</div></div>
    </div>`).join('');
  $('csCards').querySelectorAll('.cs').forEach(el => { el.onclick = () => { csPick = el.dataset.k; renderCharsel(); sfx.ui && sfx.ui(); }; el.ondblclick = () => $('csOk').click(); });
  $('csCards').querySelectorAll('.csViewToggle').forEach(btn => { btn.onclick = e => { e.stopPropagation(); csShowSheet = !csShowSheet; renderCharsel(); }; });
  $('csCards').querySelectorAll('canvas.cs3d').forEach(cv => {
    cv.onpointerdown = e => { e.stopPropagation(); const k = cv.dataset.char; cs3dState.drag = { k, x: e.clientX, y0: cs3dState.yaw[k] }; cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = e => { if (cs3dState?.drag?.k === cv.dataset.char) cs3dState.yaw[cv.dataset.char] = cs3dState.drag.y0 + (e.clientX - cs3dState.drag.x) * 0.015; };
    cv.onpointerup = cv.onpointercancel = () => { if (cs3dState) cs3dState.drag = null; };
  });
}
$('csOk').onclick = () => {
  CHAR = csPick; try { localStorage.setItem(CHAR_KEY, CHAR); } catch (e) { /* ignore */ }
  applyChar();
  if (csMode === 'new') { $('charsel').classList.remove('show'); newGame(); }
  else { $('charsel').classList.remove('show'); $('title').classList.add('show'); refreshTitle(); toast('주인공 선택', `${CH().name}(으)로 플레이합니다`, 'info'); }
};
$('csPrev').onclick = $('csBack').onclick = () => { $('charsel').classList.remove('show'); $('title').classList.add('show'); refreshTitle(); };
$('mContinue').onclick = () => { closeMenus(); continueGame(); };
$('mNew').onclick = () => { if (hasSave()) $('newConfirm').classList.add('show'); else openCharsel('new'); };
$('ncYes').onclick = () => { $('newConfirm').classList.remove('show'); openCharsel('new'); };
$('ncNo').onclick = () => $('newConfirm').classList.remove('show');
$('mChar').onclick = () => openCharsel('view');
$('mSet').onclick = () => openSettings('title');
$('mGal').onclick = () => openGallery();
$('mCred').onclick = () => { $('credTable').innerHTML = CREDITS.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join(''); $('credits').classList.add('show'); };
$('credClose').onclick = () => $('credits').classList.remove('show');
$('mQuit').onclick = () => { $('bye').classList.add('show'); };
$('byeBack').onclick = () => $('bye').classList.remove('show');
document.querySelectorAll('#tMenu button').forEach(b => b.addEventListener('mouseenter', () => { document.querySelectorAll('#tMenu button').forEach(x => x.classList.toggle('sel', x === b)); sfx.ui && sfx.ui(); }));
addEventListener('keydown', e => {
  if (state !== 'menu') return;
  if ($('charsel').classList.contains('show')) {
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) { csPick = csPick === 'jihun' ? 'seoyeon' : 'jihun'; renderCharsel(); }
    else if (e.code === 'Enter') $('csOk').click(); else if (e.code === 'Escape') $('csBack').click();
    return;
  }
  if (!$('title').classList.contains('show') || MENUS.slice(2).some(k => $(k).classList.contains('show'))) { if (e.code === 'Escape') MENUS.slice(2).forEach(k => $(k).classList.remove('show')); return; }
  const btns = [...$('tMenu').querySelectorAll('button')].filter(b => b.style.display !== 'none'); let i = btns.findIndex(b => b.classList.contains('sel'));
  if (e.code === 'ArrowDown' || e.code === 'ArrowUp' || e.code === 'KeyS' || e.code === 'KeyW') { i = (i + (e.code === 'ArrowDown' || e.code === 'KeyS' ? 1 : btns.length - 1)) % btns.length; btns.forEach((b, k) => b.classList.toggle('sel', k === i)); sfx.ui && sfx.ui(); }
  else if (e.code === 'Enter' && i >= 0) btns[i].click();
});
$('saveBtn').addEventListener('click', () => save());
$('titleBtn').addEventListener('click', () => location.reload());
$('bakBtn').addEventListener('click', () => { try { sessionStorage.setItem(AUTO_KEY, 'backup'); } catch (e) { /* ignore */ } location.reload(); });
$('loadBtn2').addEventListener('click', () => { try { sessionStorage.setItem(AUTO_KEY, 'continue'); } catch (e) { /* ignore */ } location.reload(); });
$('resumeBtn').addEventListener('click', () => { lock(); $('pause').classList.remove('show'); state = 'playing'; });
$('retryBtn').addEventListener('click', () => { try { sessionStorage.setItem(AUTO_KEY, 'continue'); } catch (e) { /* ignore */ } location.reload(); });
$('restartBtn').addEventListener('click', () => { try { clearSlot(localStorage, SKEYS); sessionStorage.setItem(AUTO_KEY, 'new'); } catch (e) { /* ignore */ } location.reload(); });
$('deadTitleBtn').addEventListener('click', () => location.reload());
$('againBtn').addEventListener('click', () => location.reload());

/* ---------- 업데이트 ---------- */
const _v = new THREE.Vector3();
function updatePlayer(dt) {
  const F = floors[P.floor];
  const fw = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const sd = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  P.moving = false; P.sprinting = false;
  if (lookBack > 0) {
    lookBack -= dt; let dy = Math.PI - P.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283;
    P.yaw += dy * Math.min(1, dt * 5); P.pitch = lerp(P.pitch, .04, Math.min(1, dt * 5));
  } else if (!P.hiding && !P.sitting && state === 'playing') {
    const want = !!(fw || sd);
    const wantRun = (SET.runToggle ? P.runOn : (keys[K().run] || keys.ShiftRight)) && want && !P.tired && P.stamina > 0 && !P.crouch;
    if (wantRun) { P.sprinting = true; P.stamina = Math.max(0, P.stamina - (CHAR === 'jihun' ? 16 : 20) * ((P.snackT || 0) > 0 ? .5 : 1) * dt); if (P.stamina <= 0) { P.tired = true; P.runOn = false; talk('sprint', 2200); sfx.gasp(); } }
    else { P.stamina = Math.min(100, P.stamina + (want ? 9 : 18) * dt); if (P.tired && P.stamina > 30) P.tired = false; }
    if (want) {
      const sp = P.sprinting ? 5.0 : P.crouch ? 1.45 : 2.8;
      const l = Math.hypot(fw, sd) || 1;
      const dx = (-Math.sin(P.yaw) * fw + Math.cos(P.yaw) * sd) / l, dz = (-Math.cos(P.yaw) * fw - Math.sin(P.yaw) * sd) / l;
      const ox = P.x, oz = P.z;
      // 한 프레임 이동을 짧은 구간으로 나눠 충돌을 처리한다 (프레임이 길어도 벽을 넘거나 튀지 않게)
      const tot = sp * dt, n = Math.max(1, Math.ceil(tot / .06));
      for (let i = 0; i < n; i++) {
        P.x += dx * tot / n; P.z += dz * tot / n;
        const px = P.x - dx * tot / n, pz = P.z - dz * tot / n;
        if(!P.inElev)collide(colsAt(floors[P.floor]), P, .32);
        if (P.floor === 0 && gateClosed) collide([gate.blockRect], P, .32);
        if (RBG && !P.inElev && P.floor === 0 && RBG.step(P, px, pz)) continue;   // 새 건물: 높이 · 충돌은 rebuildGame 이 맡는다
        if (!P.inElev && stairStep(px, pz)) break;
        // 본관 ↔ 구름다리/필로티 통로 ↔ 별관(1·2·3층) 완전 무순간이동 연속 보행 (남쪽 출입구 임계구간 WALKWAY.z1 - 2.2 ~ WALKWAY.z1 에서만 작동하여 별관 뒤쪽 야외 보행 시 오작동 원천 차단!)
        if (!P.inElev && P.floor <= 2 && P.z < WALKWAY.z1 && P.z > WALKWAY.z1 - 2.2 && P.x > -.85 && P.x < 2.45 && !(P.floor === 1 && ipP.state.fireDoorClosed)) {
          P.floor = P.floor + 8; P.z += 30.1; P.sh = P.jy = 0;
          toastFloor(P.floor); refreshHud();
        } else if (!P.inElev && P.floor >= 8 && P.floor <= 10 && P.z > 9.65 && P.x > -.85 && P.x < 2.45 && !(P.floor === 9 && ipP.state.fireDoorClosed)) {
          P.floor = P.floor - 8; P.z -= 30.1; P.sh = P.jy = 0;
          toastFloor(P.floor); refreshHud();
        } else if (!P.inElev && P.floor === 8 && (P.z < -9.95 || P.x < -20.5 || P.x > 28.5)) {
          P.floor = 0; P.z -= 30.1; P.sh = P.jy = 0;
          toastFloor(0); refreshHud();
        }
      }
      const mv = Math.hypot(P.x - ox, P.z - oz);
      P.moving = mv > .0005; P.bob += mv * (P.sprinting ? 2.4 : 2.9); P.stepD += mv;
      if (P.stepD > (P.sprinting ? 1.9 : 1.45)) { P.stepD = 0; sfx.step(P.sprinting, 1, surfaceAt()); }
    } else P.stepD = 0;
  } else if (P.hiding) P.stamina = Math.min(100, P.stamina + 25 * dt);
  P.flashCD = Math.max(0, (P.flashCD || 0) - dt); P.pbat = Math.min(100, (P.pbat ?? 100) + dt * .35);
  P.noiseT = Math.max(0, (P.noiseT || 0) - dt); P.snackT = Math.max(0, (P.snackT || 0) - dt);
  P.noise = P.hiding ? 0 : P.noiseT > 0 ? 9 : P.sprinting ? 12 : P.moving ? (P.crouch ? 1.5 : 4) : 0;
  // 점프 · 웅크리기
  // 점프 · 가구 위: 발 아래 가장 높은 가구 윗면이 바닥이 된다 (가장자리를 벗어나면 떨어진다)
  { const sup = P.sh ? 0 : supportAt(floors[P.floor], P.x, P.z, P.jy || 0);
    if (P.vy > 0 || (P.jy || 0) > sup + .001) { P.vy -= 13 * dt; P.jy = Math.max(sup, (P.jy || 0) + P.vy * dt);
      if (P.jy <= sup + 1e-4 && P.vy <= 0) { if (P.vy < -1.5) { sfx.step(true, 1.1, sup > .1 ? 'wood' : surfaceAt()); P.noiseT = Math.max(P.noiseT, .25); } P.vy = 0; P.jy = sup; if (jumpBuf > 0) { jumpBuf = 0; tryJump(); } } }
    if (jumpBuf > 0) jumpBuf -= dt;
    else if ((P.jy || 0) < sup) P.jy = sup;
    if (!Number.isFinite(P.jy) || P.jy < 0) P.jy = 0;
    if (!Number.isFinite(P.sh) || (P.sh < 0 && !(RBG && P.floor === 0 && RBG.inPit(P.x, P.z)))) P.sh = 0; }   // 지하 계단 구덩이 안은 음수 높이 허용
  P.crouchK = lerp(P.crouchK || 0, P.crouch && !P.hiding ? 1 : 0, Math.min(1, dt * 9));

  // 정문 개방 유지: 초반에는 정문이 바로 잠기지 않고 열려 있으며, 경비원이 퇴근하는 시점(19:00)에 맞춰 잠긴다!
  if (GUARD_WALK.state === 'gate_talk' && state === 'playing' && P.z < GATE_Z + 1.5) startGuardWalkToBooth();
  if (!gateClosed && state === 'playing' && P.floor === 0 && P.z < GATE_Z - 3 && DAY.start < 0) {
    DAY.start = playTime;
  }
  // 아직 정문이 열려 있을 때(경비원 퇴근 전) 플레이어가 민아와 비밀 증거를 두고 정문 밖(z > GATE_Z + 0.6)으로 나가려 하면 발걸음을 멈춘다
  if (!gateClosed && !FL.gatekey && state === 'playing' && P.floor === 0 && P.z > GATE_Z + 0.6 && DAY.start >= 0) {
    P.z = GATE_Z + 0.55;
    say(CHAR === 'jihun' ? '아직 자동 잠금 전이라 정문이 열려 있지만… 민아를 두고 나 혼자 돌아갈 순 없어.' : '아직 정문이 잠기기 전이지만… 민아 선배를 두고 혼자 갈 순 없어!', 3200);
  }
  if (!introDone && P.floor === 0 && P.z < MAIN_ZS - .5) { introDone = true; talk('inside', 3500); refreshHud(); setTimeout(() => toast('팁', '쪽지를 읽고, 사물함을 파밍해 아이템과 단서를 모으세요. (Tab 소지품 · P 휴대폰 · M 지도)', 'info'), 1500); }

  P.invuln = Math.max(0, P.invuln - dt);
  if (!P.bcast && ((P.floor === 2 && P.x > -35.8 && P.x < -20.2 && P.z < -2) || /방송실/.test(rbHere()))) { P.bcast = true; sfx.broadcast(); setTimeout(() => line('pa1', 'pa'), 900); setTimeout(() => talk('speakers', 3600), 8500); }
  // 손전등/배터리
  if (P.light && P.battery > 0) P.battery = Math.max(0, P.battery - .26 * dt * (CHAR === 'seoyeon' ? .75 : 1) * DF().battery);   // 100% ≈ 7~9분
  if (P.battery <= 0 && P.light && !P.phoneLight) { if (inv.battery > 0) useBattery(); else { P.phoneLight = true; toast('손전등이 꺼졌습니다', '휴대폰 불빛으로 비춘다 — 건전지를 찾으세요', 'warn'); caption('손전등 전구가 꺼진다'); } }
  if (P.battery > 0) P.phoneLight = false;
}

function updateSupernaturalChalkboards(dt) {
  if (state !== 'playing') return;
  const f = P.floor;
  if (f < 0 || f > 2) return;
  const room = roomAt(f, P.x, P.z);
  if (!room || room.type !== 'class') return;
  const key = 'cls' + f + ':' + room.cx + (room.south ? 's' : '');
  const br = world.boardRefs[key];
  if (!br || !br.mat || !br.targetLines || br.done) return;
  const bz = room.south ? 9.5 : -9.5;
  const dist = Math.hypot(P.x - room.cx, P.z - bz);
  if (dist < 7.2) {   // 칠판 글씨는 이미 쓰여 있다 (초자연 자동 필기 연출 폐기) — 가까이 왔을 때 한 번만 전체 글씨를 그린다
    const old = br.mat.map; br.mat.map = world.makeBoardTex(br.targetLines, { seed: br.seed }); if (old && old.userData && old.userData.boardGen) old.dispose(); br.mat.map.userData.boardGen = true;
    br.mat.needsUpdate = true; br.done = true; br.writing = false;
  }
}
function updateGate(dt) {
  updateSupernaturalChalkboards(dt);
  if (gateState === 'closing') { gateAnim = Math.min(1, gateAnim + dt / .9); gate.setOpen(1 - easeOut(gateAnim)); if (gateAnim >= 1) { gateState = 'closed'; gate.setOpen(0); } }
  else if (gateState === 'opening') { gateAnim = Math.max(0, gateAnim - dt / 3); gate.setOpen(1 - easeOut(gateAnim)); }
  gate.lockParts.forEach(m => { m.visible = gateState === 'closed'; });
}
const easeOut = t => 1 - Math.pow(1 - t, 3);

function updateLighting(dt) {
  const F = floors[P.floor];
  const indoors = P.inElev || P.floor >= 4 || (P.floor > 0 && P.floor < 3) || (P.floor === 0 && (RBG ? RBG.inBuilding(P.x, P.z) : inBldg(P.x, P.z))); perfStabTick(dt, indoors);
  const k = Math.min(1, dt * 3);
  updateDay(dt);
  const dk = DAY.k;
  moonLight.color.copy(MOON_COL).lerp(SUN_COL, dk); moonLight.position.copy(MOON_POS).lerp(SUN_POS, dk);
  moonLight.intensity = lerp(moonLight.intensity, indoors ? 0 : lerp(1.6, 2.3, dk), k);
  lightFlash = Math.max(0, lightFlash - dt * 3);
  updateWindowFakes(dk); hemi.color.copy(HEMI_SKY_N).lerp(HEMI_SKY_D, dk); hemi.groundColor.copy(HEMI_GND_N).lerp(HEMI_GND_D, dk);
  hemi.intensity = BRIGHT ? 1.5 : lerp(hemi.intensity, indoors ? lerp(.34, .66, dk) : lerp(.68, 1.15, dk), k) + (indoors && P.floor <= 2 ? lightFlash * (Math.sin(tNow * 60) > 0 ? .9 : .3) : 0);
  if (scene.environment) scene.environmentIntensity = Math.min(.3, hemi.intensity * .28);   // 반사 환경광은 밝기를 따라간다 (어두운 밤 실내는 거의 0)
  fillLight.intensity = lerp(fillLight.intensity, indoors ? 0 : lerp(.85, .5, dk), k);
  scene.fog.density = lerp(scene.fog.density, indoors ? lerp(.05, .03, dk) : lerp(.014, .0075, dk), k);
  scene.fog.color.lerp(indoors ? _c1.copy(FOG_IN).lerp(FOG_IN_DAY, dk) : _c1.copy(FOG_OUT).lerp(FOG_DAY, dk), k);
  // Outside window impostors avoid a sudden full-floor render on approach.
  applyExteriorFloorVisibility(floors,P,MAIN_ZS);
  if (RBG) RBG.hideOld();   // 새 건물: 예전 본관 · 별관 층(껍데기 · 가짜 창 포함)은 다시 켜지 않는다
  if (P.floor === 0 && P.z > -22 && P.z < 36 && Math.abs(P.x) < 42) {
    floors[0].interior.visible = true;
    if (floors[0].winFake) floors[0].winFake.visible = false;
  }
  if (indoors || P.floor !== 0 || (P.z > -22 && P.z < MAIN_ZS && Math.abs(P.x) < 36.5)) {
    for (let fk = 0; fk < floors.length; fk++) if (floors[fk]?.winFake) floors[fk].winFake.visible = false;
  }
  // 야외: 손전등 그림자 범위를 줄여 그림자 패스가 캠퍼스 전체를 다시 그리지 않게 (셰이더 재컴파일 없이)
  const sf = indoors ? 26 : 6; if (flash.shadow.camera.far !== sf) { flash.shadow.camera.far = sf; flash.shadow.camera.updateProjectionMatrix(); }
  world.OUT.visible = P.floor <= 3 || state === 'menu' || state === 'intro';   // 2 · 3층 창밖 풍경은 높음 품질에서만 (캠퍼스 전체를 더 그리는 비용)
  // 형광등 풀: 가장 가까운 켜진 램프 4개에 PointLight 배치
  if (P.floor === 2 && window.__broadcastAnims) {
    const ba = window.__broadcastAnims, now = performance.now() * .001;
    const rSpd = (ba.reelBoostT && performance.now() < ba.reelBoostT) ? 6.5 : 1.6;
    ba.reels.forEach(r => { r.mesh.rotation.z += dt * rSpd * r.dir; });
    ba.vuBars.forEach((vb, i) => {
      const boost = (ba.vuBoostT && performance.now() < ba.vuBoostT) ? 1.85 : 1.0;
      vb.scale.y = Math.max(.25, (.55 + Math.sin(now * 7.5 + i * .9) * .35 + Math.cos(now * 13.0 + i) * .15) * boost);
    });
    if (ba.tBar) {
      const targetZ = -7.55 + .26 + Math.sin(ba.tBarPhase || 0) * .12;
      ba.tBar.position.z += (targetZ - ba.tBar.position.z) * Math.min(1, dt * 8);
    }
    ba.tallyMats.forEach(tm => { if (tm) tm.emissiveIntensity = 1.6 + Math.sin(now * 4.2) * .65; });
  }
  lampTimer -= dt;
  if (lampTimer <= 0) {
    lampTimer = .2;
    const baseLamps = !indoors && P.floor === 0 ? world.campusDesign.lights : F.lamps;
    const lamps=ELV.p&&ELV.cur===P.floor&&ELV.cabinLamp?[...baseLamps,ELV.cabinLamp]:baseLamps;
    const pyEye = (F ? F.y0 : 0) + (P.sh || 0) + 2.2; const c = lamps.filter(l => l.kind !== 'dead' && !l.off).map(l => ({ l, d: l.cabin&&P.inElev?-1:Math.hypot(l.x - P.x, l.z - P.z, (l.y - pyEye) * .75) })).filter(o => o.d < 16).sort((a, b) => a.d - b.d).slice(0, 4);
    pool.forEach((p, i) => { const o = c[i]; if (o) { p.position.set(o.l.x, o.l.y, o.l.z); p.color.setHex(o.l.cabin?0xfff0d4:o.l.street ? 0xffd4a1 : 0xcfe6d6); p.distance = o.l.cabin?5:o.l.street ? 15 : 12; p.userData.kind = o.l.kind; p.userData.lamp = o.l; p.userData.on = true; } else p.userData.on = false; });
  }
  ELV.light=pool.find(p=>p.userData.on&&p.userData.lamp?.cabin)||null;
  updateGenerator(dt, indoors);
  pool.forEach((p, i) => {
    if(p.userData.on&&p.userData.lamp?.cabin){p.intensity=power?3.5:2.5;return;}
    if (!p.userData.on || blackout > 0 || (!indoors && !p.userData.lamp?.street)) { p.intensity = 0; return; }
    if (p.userData.lamp?.street) { p.intensity = 22 * (1 - DAY.k * .65); return; }
    const lp = p.userData.lamp, st = lp && lp.start ? tNow - lp.start : 9;
    if (st < 0) { p.intensity = 0; return; }
    // 켤 때: 스타터가 두 번 깜빡인 뒤 안정 (무작위 점멸 대신 정해진 짧은 패턴) · 고장 램프: 램프 재질과 같은 부드러운 감광
    const fl = st < .9 ? (SET.flashReduce || SET.noFlicker ? Math.min(1, st / .9) : st < .12 || (st > .3 && st < .42) ? .55 : st < .6 ? .25 + st : 1) : p.userData.kind === 'flick' ? (lp.mat && lp.mat.userData.v != null ? lp.mat.userData.v : 1) : 1;
    p.intensity = 7 * fl * GEN.gain * (power ? 1 : .86);
  });
  // 손전등
  const near = ghost.active && ghost.floor === P.floor ? clamp(1 - Math.hypot(ghost.x - P.x, ghost.z - P.z) / 9, 0, 1) : 0;
  let fi = P.light && P.battery > 0 ? 45 : 0;   // 80 → 45: 모든 면이 번들거리던 반사 줄이기
  if (P.battery < 15 && fi) fi *= .72 + .28 * Math.sin(tNow * 11) * Math.sin(tNow * 2.7 + 1);   // 부드러운 깜빡임
  if (P.light && P.battery <= 0) { fi = 42; flash.distance = 14; } else flash.distance = 32;   // 배터리가 다 떨어지면 휴대폰 불빛
  if (near > .4 && fi && Math.random() < near * .12) fi = 0;
  if (repelK > .02 && fi) {   // 집중 조사: 창백한 푸른빛 ↔ 붉은빛으로 미세하게 떨리고 세기가 요동친다
    const j = Math.random(); flash.color.setRGB(.75 + .25 * (j > .8 ? 1 : 0) * repelK, .82 - .25 * repelK * j, 1 - .15 * repelK * (1 - j)); fi *= 1.1 + .35 * repelK * (Math.random() - .3);
  } else flash.color.setHex(0xfff0d0);
  setCoil(fi ? repelK : 0); if (repelK > .05) shake = Math.max(shake, .22 * repelK);
  if (CAM.on) fi *= .3;   // 야간 카메라: 야간 투시라 손전등 빛을 줄인다 (흔적이 묻히지 않게)
  // 가까운 벽 · 가구를 비출 때 하얗게 날아가던 반사: 앞쪽 장애물까지 거리에 따라 세기를 줄인다 (2.5m 안)
  const nd = fi ? flashNear() : 9, nk = nd < 3.5 ? clamp(Math.pow(nd / 3.5, 2), .03, 1) : 1;   /* 거리 감쇠(decay 1.3)를 상쇄 → 가까워도 비친 면 밝기가 거의 같다 */
  flash.intensity = fi * nk;
  spill.intensity = fi ? (fi / 95) * .8 * Math.max(.12, nk) : 0;
  antiGlareTick();
}

// 손전등 앞 장애물까지 거리 (2D 충돌 상자 · 0.1초마다): 시선 방향으로 0.1m 씩 3m 까지
const FN = { t: 0, d: 9 };
function flashNear() {
  const now = performance.now(); if (now - FN.t < 90) return FN.d; FN.t = now;
  const F = floors[P.floor], fx0 = -Math.sin(P.yaw), fz0 = -Math.cos(P.yaw), down = Math.max(0, -P.pitch);
  let d = 9; const floorD = down > .25 ? 1.55 / Math.tan(down) : 9;   /* 바닥을 비추면 바닥까지 거리 */
  const nc = F.col.filter(c => !c.off && c.x2 > P.x - 3.2 && c.x1 < P.x + 3.2 && c.z2 > P.z - 3.2 && c.z1 < P.z + 3.2);   // 주변 3m 충돌 상자만 (전체 수천 개를 30번 훑던 비용)
  for (let s = .1; s < 3; s += .1) { const x = P.x + fx0 * s, z = P.z + fz0 * s; if (nc.some(c => x >= c.x1 && x <= c.x2 && z >= c.z1 && z <= c.z2)) { d = s; break; } }
  // 새 본관 · 별관 안: 숨겨진 예전 층 전체를 광선으로 훑던 비용(프레임 끊김) 대신 새 건물 충돌 상자로 잰다
  if (P.floor === 0 && RBG && RBG.inBuilding(P.x, P.z)) { const y = P.sh || 0; for (let s = .2; s < d; s += .2) if (RBG.blocked(P.x + fx0 * s, P.z + fz0 * s, y, .05)) { d = s; break; } return (FN.d = Math.min(d, floorD)); }
  // 충돌 상자가 없는 벽 · 칸막이 · 가구(메시)도: 시선 광선으로 3m 안 실제 면까지 거리
  FN.ray.set(camera.getWorldPosition(FN.v), camera.getWorldDirection(FN.w)); FN.ray.far = 3;
  const hitM = d < 3 ? null : FN.ray.intersectObjects((P.floor === 0 && isOutdoors() ? [world.OUT] : [F.interior, F.shell]).filter(Boolean), true).find(h => h.object.visible && h.object.isMesh && !(h.object.material && h.object.material.transparent && h.object.material.opacity < .5));
  if (hitM) d = Math.min(d, hitM.distance);
  return (FN.d = Math.min(d, floorD));
}
FN.ray = new THREE.Raycaster(); FN.ray.camera = camera; FN.v = new THREE.Vector3(); FN.w = new THREE.Vector3();
// 반사 줄이기: 손전등이 닿는 불투명 재질은 거칠기 하한(0.62)을 두어 반짝이는 하이라이트(타일 · 니스 칠 · 금속)가 하얗게 터지지 않게 한다.
// 유리 · 물 · 거울(투명 · 아주 매끈하게 일부러 만든 것)은 그대로. 나중에 불러오는 모델도 5초마다 새 재질만 처리
const AG = { seen: new WeakSet(), t: 0 };
function antiGlare(root) {
  root.traverse(o => { if (!o.isMesh) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
    if (!m || AG.seen.has(m)) return; AG.seen.add(m);
    if (!m.isMeshStandardMaterial || m.transparent || m.roughness < .12 || /water|glass|mirror|pool/i.test(m.name || '')) return;
    m.roughness = Math.max(m.roughness, .62); m.metalness = Math.min(m.metalness, .5); m.envMapIntensity = Math.min(m.envMapIntensity ?? 1, .6); }); });
}
function antiGlareTick() { const now = performance.now(); if (now - AG.t < 700) return; AG.t = now; const ch = scene.children; if (!ch.length) return; AG.i = ((AG.i || 0) + 1) % ch.length; antiGlare(ch[AG.i]); }   // 한 번에 장면 전체를 훑던 것(5초마다 끊김) → 0.7초마다 그룹 하나씩

// 비상 발전기: 전력 복구 전에는 건물 조명이 지하 발전기로 돌아간다 — 누런 빛, 아주 약한 전압 출렁임,
// 수십 초마다 발전기가 헛돌며 층 전체 조명이 함께 처지고(비상등이 켜짐) 다시 올라온다. 복구 후에는 드물고 약하게.
const GEN = { gain: 1, emerg: 0, t: 25, dip: null };
function updateGenerator(dt, indoors) {
  GEN.t -= dt;
  if (GEN.t <= 0 && state === 'playing') {
    GEN.t = power ? 150 + Math.random() * 150 : 28 + Math.random() * 40;
    GEN.dip = { t: 0, dur: power ? .5 : .8 + Math.random() * 1.4, depth: power ? .25 : .55 + Math.random() * .3 };
    if (indoors && P.floor !== 3) { sfx.genChug(power ? .4 : 1); if (!power && Math.random() < .5) setTimeout(() => caption('지하에서 발전기가 덜컹거린다'), 300); }
  }
  let g = power ? 1 : 1 - .035 * (.5 + .5 * Math.sin(tNow * 1.7)) * (.6 + .4 * Math.sin(tNow * .43));
  if (GEN.dip) {
    const d = GEN.dip; d.t += dt; const x = d.t / d.dur;
    if (x >= 1) GEN.dip = null;
    else { const sh = Math.sin(Math.PI * x) * (SET.flashReduce || SET.noFlicker ? 1 : .8 + .2 * Math.sin(d.t * 31)); g *= 1 - d.depth * sh; }
  }
  GEN.gain = g;
  const em = blackout > 0 ? 1 : clamp((.8 - g) * 3.5, 0, 1);
  GEN.emerg = lerp(GEN.emerg, em, Math.min(1, dt * (em > GEN.emerg ? 12 : 3)));
  // 발전기 소리: 실내에서 전력 복구 전, 지하 발전기실(B1 동쪽)에 가까울수록 크게
  const nearGen = P.floor === 4 ? clamp(1 - Math.hypot(P.x - 24, P.z + 5.5) / 22, 0, 1) : 0;
  setGenHum(state === 'playing' && indoors && !power ? .25 + nearGen * .75 + (GEN.dip ? .4 : 0) : 0, dt);
}

// 해 질 녘 → 밤: 정문이 닫히면 75초에 걸쳐 해가 지고, 다 지면 비가 쏟아진다 (밖에서 오래 머물러도 2분 반 뒤엔 시작)
function updateDay(dt) {
  if (!DAY.done && DAY.start < 0 && state === 'playing' && (gateClosed || playTime > 150)) { DAY.start = playTime; caption('해가 학교 뒤로 넘어가기 시작한다'); sfx.swell(3, .25); }
  if (!DAY.done && DAY.start >= 0) {
    const x = clamp((playTime - DAY.start) / DAY.dur, 0, 1), e = x * x * (3 - 2 * x); DAY.k = .92 * (1 - e);
    if (x >= 1) { DAY.done = true; FL.night = true; DAY.k = 0; sfx.swell(2.4, .3); toast('밤이 되었다', '학교에 어둠이 내려앉았다', 'warn'); }
  }
  if (FL.night && !DAY.done) { DAY.done = true; DAY.k = 0; }
  const dk = DAY.k, sky = world.sky;
  skyDome.position.copy(camera.position); skyDome.scale.setScalar(camera.far * .9);   // 시야 거리 안쪽에서 카메라를 따라간다
  for (let i = 0; i < 3; i++) [skyU.uTop, skyU.uHor, skyU.uBot][i].value.copy(SKY_N[i]).lerp(SKY_D[i], dk);
  skyU.uGlow.value = clamp(dk * 1.6 - .1, 0, 1) * clamp(1.6 - dk, 0, 1);   // 해 질 녘에 가장 붉게
  scene.background.setHex(0x05070d).lerp(BG_DAY, dk);
  const night = clamp(1 - dk * 3, 0, 1); sky.stars.visible = sky.moon.visible = sky.moonGlow.visible = night > .02;
  sky.stars.material.opacity = night; sky.stars.material.transparent = true; sky.moonGlow.material.opacity = night;
  DAY.rain = 0; setRainLevel(0);   // 비 효과 제거 (요청)
  world.winMats[9].emissiveIntensity = night * 2.4;
  { const here = GUARD_WALK.state !== 'off_duty' && !FL.night; guardNPC.visible = here; guardCap.visible = !here; const gp = world.props.find(q => q.kind === 'guardnpc'); if (gp) gp.done = !here || GUARD_WALK.state === 'leaving_duty'; }   // 해가 지면 경비원은 사라지고 모자만 남는다   // 밤이 되면 불 켜진 교실 창 몇 개 (아무도 없는데)
  // 낮의 소리: 가끔 까마귀
  if (dk > .3 && state === 'playing' && isOutdoors() && Math.random() < dt / 14) sfx.crow(Math.random() * 2 - 1);
}

let beatT = 0, camShakeT = 0;
function updateCamera(dt, t) {
  const F = floors[P.floor];
  const bob = SET.bob ? Math.sin(P.bob) * (P.sprinting ? .05 : .028) : 0;
  P.shV = lerp(P.shV || 0, P.sh || 0, Math.min(1, dt * 14));
  P.jyV = (P.vy || 0) !== 0 ? (P.jy || 0) : lerp(P.jyV || 0, P.jy || 0, Math.min(1, dt * 16));   // 낮은 단을 걸어 오를 때 시점이 툭 튀지 않게 (점프 중엔 그대로)
  let ey = P.hiding ? 1.45 : P.sitting ? 1.12 + P.shV : 1.62 - (P.crouchK || 0) * .55 + P.jyV + P.shV + (INT_ANIM.dipY || 0) + bob * (1 - (P.crouchK || 0) * .5);
  camera.position.set(P.x, F.y0 + ey, P.z);
  let yaw = P.yaw, pitch = P.pitch + (INT_ANIM.pitchAdd || 0);
  if (shake > 0) { shake = Math.max(0, shake - dt * 1.4); const k = SET.shake ? .05 : .008; yaw += (Math.random() - .5) * k * shake; pitch += (Math.random() - .5) * k * shake; }
  const G = ghost; let prox = 0, chase = false;
  if (G.active && G.storyTime > 0 && G.floor === P.floor) prox = clamp(1 - Math.hypot(G.x - P.x, G.z - P.z) / 14, 0, 1);
  camera.rotation.set(pitch, yaw, INT_ANIM.rollAdd || 0, 'YXZ');
  applyThirdPerson(dt, yaw, pitch);
  const fov = SET.fov + (P.sprinting ? 6 : 0) + (chase ? 4 : 0) + (state === 'dead' ? -10 : 0) - repelK * 8;
  const nextFov = lerp(camera.fov, fov * (1 - .55 * ZOOM.k), Math.min(1, dt * 6));
  if (Math.abs(nextFov - camera.fov) > .001) { camera.fov = nextFov; camera.updateProjectionMatrix(); }
  $('fear').style.opacity = SET.fearFx ? clamp(prox * (chase ? 1.2 : .7), 0, 1) : 0;
  document.body.classList.toggle('chase', chase && state === 'playing');
  setProximity(prox * (chase ? 1 : .6), t);
  // 심장박동
  if (state === 'playing' && (prox > .25 || chase)) {
    beatT -= dt; if (beatT <= 0) { sfx.heartbeat(.5 + prox * .5); beatT = lerp(1.15, .45, prox); }
  }
  // 체력/배터리 바
  updateHud(dt, prox, chase);
  
}


let miniT = 0;
/* ---------- 레퍼런스 이미지: 표정 / 장소 컷 / 자료집 ---------- */
let faceOver = null, faceT = 0, curFace = '';
function setFace(k, t) { faceOver = k; faceT = t; }
function updateFace(dt) {
  faceT -= dt;
  const want = faceT > 0 ? faceOver : P.fear > .6 ? 'fear' : P.hp <= 50 ? 'resolve' : 'basic';
  const src = `assets/ui/${CH().faces[FACE[want] ?? 0]}.webp`;
  if (src !== curFace) { curFace = src; $('portrait').src = $('dlgFace').src = src; }
}
// [이미지, 제목, 설명, 그 시절 사진 여부]
const CARDS = {
  gate: ['gate_night', '서문고 정문', '버려진 시간 속, 멈춘 교실의 풍경'], corridor: ['v_corridor', '본관 복도', '게시판 공지가 모두 뜯겨 나간 복도'],
  class: ['old_class', '교실', '칠판 구석에 지워지다 만 날짜'], office: ['old_office', '교무실', '파쇄기 옆에 쌓인 1998년 서류철'],
  library: ['v_library', '도서실', '반납되지 않은 대출 카드 세 장'], lab: ['v_lab', '과학실', '잠긴 약품장, 지워진 사용 기록'], music: ['v_music', '음악실', '피아노 뚜껑이 열려 있다'],
  art: ['v_art', '미술실', '1998년 졸업 앨범 표지 시안이 남아 있다'], computer: ['v_computer', '컴퓨터실', '포맷된 하드디스크, 남은 로그 하나'], nurse: ['v_nurse', '보건실', '그날 밤의 보건일지가 찢겨 있다'],
  toilet: ['v_toilet', '화장실', '거울에 금이 가 있다'], stair: ['v_stairs', '중앙 계단', '계단참에 새로 채운 자물쇠'], broadcast: ['bc_main', '방송실', '마지막 방송이 끊긴 자리'],
  roof: ['v_roof', '옥상', '가장 높은 곳, 여전히 바람이 부는 공간'], b1: ['b1_corr', '지하층 B1', '아무도 오지 않는, 더 깊은 곳'],
  gym: ['gym_full', '체육관', '먼지 낀 코트 위에 공 하나가 굴러간다'], gymStage: ['gym_stage', '체육관 무대', '1998년 축제 무대 배치도가 붙어 있다'],
  pool: ['pool_main', '수영장 (폐쇄)', '물이 빠진 채 조용히 남아있는 수영장'], poolLocker: ['pool_locker', '탈의실', '그 시절 사진 — 누군가의 사물함이 아직 잠겨 있다', 1],
  cafe: ['cafe_hall', '급식실', '그 시절 사진 — 한 명분이 모자란 식판', 1], annex: ['annex_ext', '별관 (특별교실동)', '그 시절 사진 — 다양한 꿈과 재능을 키우던 곳', 1],
  annexOut: ['annex_ext', '별관 (특별교실동)', '그 시절 사진 — 본관 뒤편의 특별교실동', 1], westGate: ['west_gate', '서문', '그 시절 사진 — 행복한 배움, 함께 만드는 미래', 1],
};
Object.values(CARDS).forEach(c => { const im = new Image(); im.src = `assets/img/${c[0]}.webp`; });
Object.values(CHARACTERS).forEach(c => c.faces.forEach(k => { const im = new Image(); im.src = `assets/ui/${k}.webp`; }));
const seenCards = new Set(); let cardTimer = 0, areaT = 0;
let startQuietT = 0;   // 게임 시작 직후 장 카드 · 첫 대사와 겹치지 않게 장소 카드를 잠시 미룬다
function showCard(k) {
  if (performance.now() < startQuietT) { setTimeout(() => showCard(k), startQuietT - performance.now() + 50); return; }
  if (seenCards.has(k)) return; seenCards.add(k);
  const c = CARDS[k]; if (!c) return;
  const el = $('card'); el.querySelector('img').src = `assets/img/${c[0]}.webp`; el.classList.toggle('noimg', !SET.areaPhotos);
  el.querySelector('b').textContent = c[1]; el.querySelector('span').textContent = c[2];
  el.classList.toggle('old', !!c[3]); el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(cardTimer); cardTimer = setTimeout(() => el.classList.remove('show'), 4600);
}
function areaCheck(dt) {
  areaT -= dt; if (areaT > 0) return; areaT = .3;
  const f = P.floor; let k = null;
  if (f === 5) k = P.z < 15.5 ? 'gymStage' : 'gym';
  else if (f === 6) k = P.z < 30.2 ? 'poolLocker' : 'pool';
  else if (f === 7) k = 'cafe'; else if (f === 3) k = 'roof';
  else if (f === 0 && !(RBG ? RBG.inBuilding(P.x, P.z) : inBldg(P.x, P.z))) {
    if (P.z > 60) k = 'gate'; else if (P.x < -40 && Math.abs(P.z - 32) < 9) k = 'westGate'; else if (Math.abs(P.x) < 22 && P.z < -10.5) k = 'annexOut';
  } else if (f === 0 && RBG && RBG.inBuilding(P.x, P.z)) {   // 새 건물: 예전 층 배치(roomAt)로 고르면 음악실에 '교실', 방송실에 '본관 복도' 카드가 떴다 → 새 방 이름으로
    const w = RBG.where(P.x, P.z, (P.sh || 0) + .5) || '';
    k = /교무실|행정실/.test(w) ? 'office' : /도서실/.test(w) ? 'library' : /과학실/.test(w) ? 'lab' : /음악실/.test(w) ? 'music' : /미술실/.test(w) ? 'art' : /컴퓨터실/.test(w) ? 'computer' : /보건실/.test(w) ? 'nurse' : /화장실/.test(w) ? 'toilet' : /계단/.test(w) ? 'stair' : /방송실/.test(w) ? 'broadcast' : /\d학년 \d+반|빈 교실|자율학습/.test(w) ? 'class' : !w ? (P.z < -10 ? 'annex' : 'corridor') : null;
  } else if (f <= 2 || f === 4 || f >= 8) {
    const an = f >= 8, sl = an ? ANNEX.slots : SLOTS, lay = an ? ANNEX.floors[f - 8] : LAYOUT[f];
    const sr = roomAt(f, P.x, P.z);
    if (sr && sr.south) k = sr.type;
    else if (P.z > -1.75) k = f === 4 ? 'b1' : an ? 'annex' : 'corridor';
    else { const i = sl.findIndex(c => Math.abs(P.x - c) < 4); if (i >= 0) k = lay.types[i]; }
  }
  if (k) showCard(k);
}
const REF_TITLES = ['서문고 실내 공간 3D 모델링 시트', '서문고 정문 3D 배경 시트', '교실 소품 오브젝트 시트', '서문고 내부 3D 배치도', '서문고 배치도 / 건물 도면', '주인공 캐릭터 시트', '인게임 화면 · UI 구성', '특수 공간 상세 배치도', '상호작용 UI 시트', '체육관 내부 시트', '방송실 내부 배치', '수영장 내부 배치', '방송실 · 수영장 · 지하 B1', '학교 지도', '급식실 배치도', '별관 (특별교실동)', '서문 상세 안내도', '방송실 상세 배치도', '수영장 샤워실 · 탈의실', '전체 배치도 · 오브젝트 · 이펙트 시트', '학교 외부 창문 텍스처 시트', '서문고 외부 설정도', '학교 외관 디자인 시트', '서브 캐릭터 — 민아', '서브 캐릭터 — 경비원'];
let galTab = 'ref';
function openGallery(tab = galTab) {
  galTab = tab; document.querySelectorAll('#galTabs button').forEach(b => b.classList.toggle('on', b.dataset.g === galTab));
  const gw = $('galGrid'); gw.innerHTML = '';
  const fig = (thumb, big, cap, lock) => {
    const d = document.createElement('figure'); if (lock) d.className = 'lock';
    d.innerHTML = `<img src="${lock ? 'assets/ui/charsel_blur.webp' : thumb}" alt="" loading="lazy" style="${thumb.includes('/ui/') && !lock ? 'object-fit:contain;background:#0a0d10' : ''}"><figcaption>${lock ? '🔒 ' + cap : cap}</figcaption>`;
    if (!lock) d.onclick = () => { $('lbImg').src = big; $('lbCap').textContent = cap; $('lightbox').classList.add('show'); };
    gw.appendChild(d);
  };
  if (galTab === 'ref') REF_TITLES.forEach((t, i) => { const n = String(i + 1).padStart(2, '0'); fig(`assets/ref/${n}_t.webp`, `assets/ref/${n}.webp`, `${i + 1}. ${t}`); });
  else if (galTab === 'props') {   // 사용자 제공 3D 소품 133종 팩 — 미리보기 렌더 (게임에 배치한 것은 이름 앞에 ●)
    const used = new Set(world.MODELS.filter(m => m.model.startsWith('h133/')).map(m => m.model.slice(5)));
    fetch('assets/models/h133/manifest.json').then(r => r.json()).then(list => { if (galTab !== 'props') return; list.forEach(m => fig(`assets/models/h133/thumbs/${m.id}.webp`, `assets/models/h133/thumbs/${m.id}.webp`, `${used.has(m.id) ? '● ' : ''}${m.id} ${m.name} — ${m.category_kr} · ${m.description}`)); }).catch(() => {});
  }
  else if (galTab === 'char') Object.values(CHARACTERS).forEach(c => {
    fig(`assets/ui/${c.portrait}.webp`, `assets/ui/${c.portrait}.webp`, `${c.name} — 초상`); fig(`assets/ui/${c.body}.webp`, `assets/ui/${c.body}.webp`, `${c.name} — 전신`);
    c.faces.forEach((f, i) => fig(`assets/ui/${f}.webp`, `assets/ui/${f}.webp`, `${c.name} — ${c.faceNames[i]}`));
  });
  else {
    let ends = []; try { ends = JSON.parse(localStorage.getItem(ENDINGS_KEY) || '[]'); } catch (e) { /* ignore */ }
    statFlush(); const ST = statRead(), gs = document.createElement('div'); gs.className = 'galStats';
    gs.innerHTML = `<span>총 플레이 시간</span><b>${fmtPT(ST.total, true)}</b><span>엔딩 본 횟수</span><b>${ST.clears || 0}회</b><span>TRUE END 최단</span><b>${ST.best && ST.best.true ? fmtPT(ST.best.true, true, true) : '—'}</b><span>NORMAL END 최단</span><b>${ST.best && ST.best.normal ? fmtPT(ST.best.normal, true, true) : '—'}</b><span>COVER-UP END 최단</span><b>${ST.best && ST.best.cover ? fmtPT(ST.best.cover, true, true) : '—'}</b><span>마지막 엔딩</span><b>${ST.last ? `${ST.last.end === 'true' ? 'TRUE' : ST.last.end === 'cover' ? 'COVER-UP' : 'NORMAL'} · END ${ST.last.fin} · ${fmtPT(ST.last.t, true, true)}` : '—'}</b>`;
    gw.appendChild(gs);
    fig('assets/ui/title_main.webp', 'assets/ui/title_main.webp', 'TRUE END — 폭로 방송', !ends.includes('true'));
    fig('assets/img/gate_night.webp', 'assets/img/gate_night.webp', 'NORMAL END — 다시 닫힌 문', !ends.includes('normal'));
    fig('assets/img/west_gate.webp', 'assets/img/west_gate.webp', 'COVER-UP END — 침묵의 서약', !ends.includes('cover'));
    
  }
  $('gallery').classList.add('show');
}
document.querySelectorAll('#galTabs button').forEach(b => { b.onclick = () => openGallery(b.dataset.g); });
addEventListener('pointerdown', () => initAudio(), { once: true });
addEventListener('keydown', () => initAudio(), { once: true });   // 타이틀 BGM: 첫 클릭 · 키 입력 때 바로 시작
$('galBtn2').addEventListener('click', () => openGallery());
$('galClose').addEventListener('click', () => $('gallery').classList.remove('show'));
$('lightbox').addEventListener('click', () => $('lightbox').classList.remove('show'));


let _ecgX = 0, _hudInitDone = false;
function updateRealisticHudWidgets(dt, prox, chase, outdoors) {
  if (!_hudInitDone) {
    _hudInitDone = true;
    const hud = $('hud');
    if (hud && !$('hudTopBar')) {
      const tb = document.createElement('div'); tb.id = 'hudTopBar';
      tb.innerHTML = '<span id="compDir">N</span><span id="compTape">NW · N · NE</span><b id="compDeg">000°</b><span class="tbSep">|</span><span id="tbDate">2008.10.12 · 17:50</span><span class="tbSep">|</span><span id="envTemp">🌡 12.4°C</span><span id="envHum">💧 76%</span>';
      hud.appendChild(tb);
    }
    const whoBars = document.querySelector('#who .bars');
    if (whoBars && !$('hudBioRow')) {
      const bio = document.createElement('div'); bio.id = 'hudBioRow';
      bio.innerHTML = '<span id="bioBpm">♥ 72 BPM</span><canvas id="ecgCanvas" width="68" height="18"></canvas><span id="bioDb">🔊 22dB</span>';
      whoBars.appendChild(bio);
    }
    const s1 = $('s1');
    if (s1 && !$('batPct')) {
      const bp = document.createElement('span'); bp.id = 'batPct'; bp.textContent = '100%';
      s1.appendChild(bp);
    }
  }
  // 1) 방위각 나침반
  const deg = ((Math.round((-P.yaw * 180 / Math.PI) % 360) + 360) % 360);
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], di = Math.round(deg / 45) % 8;
  setTxt($('compDir'), dirs[di]);
  setTxt($('compTape'), `${dirs[(di + 7) % 8]} · · ${dirs[di]} · · ${dirs[(di + 1) % 8]}`);
  setTxt($('compDeg'), String(deg).padStart(3, '0') + '°');
  // 2) 구역별 실시간 기온 · 습도
  const baseT = P.floor === 4 ? 9.4 : P.floor === 6 ? (P.x < -50 && P.z < 30 ? 36.8 : 18.2) : outdoors ? (11.2 - (1 - DAY.k) * 2.4) : 15.6;
  const temp = (baseT - prox * 4.5).toFixed(1);
  const hum = Math.round(P.floor === 6 ? 88 : P.floor === 4 ? 84 : outdoors ? 74 : 62);
  setTxt($('envTemp'), `🌡 ${temp}°C`);
  setTxt($('envHum'), `💧 ${hum}%`);
  // 3) 심박수(BPM) · 소음(dB) · 배터리 퍼센트
  const bpm = Math.round(68 + P.fear * 52 + (P.sprinting ? 26 : P.moving ? 10 : 0) + (chase ? 24 : 0));
  const db = Math.round(18 + (P.noise || 0) * 4.2 + (P.sprinting ? 14 : 0));
  const bpmEl = $('bioBpm'); if (bpmEl) { setTxt(bpmEl, `♥ ${bpm}`); bpmEl.style.color = bpm > 120 ? '#ff6868' : '#70ffaa'; }
  setTxt($('bioDb'), `🔊 ${db}dB`);
  setTxt($('batPct'), Math.round(P.battery) + '%');
  // 현재 날짜(2008.10.12, 1998년 사건 10주기) 및 시각 표시 (17:50 시작 → 해 지면 19:00 경비원 퇴근 → 심야)
  const curMin = FL.night ? Math.min(23 * 60 + 39, 19 * 60 + Math.floor(playTime / 8)) : Math.round(17 * 60 + 50 + (1 - (DAY.k / .92)) * 70);
  const hh = String(Math.floor(curMin / 60)).padStart(2, '0'), mm = String(curMin % 60).padStart(2, '0');
  setTxt($('tbDate'), `2008.10.12 (${hh}:${mm})`);
  // 4) 실시간 ECG 심전도 파형
  const ecg = $('ecgCanvas');
  if (ecg) {
    const ctx = ecg.getContext('2d');
    _ecgX = (_ecgX + dt * (28 + bpm * 0.25)) % 68;
    ctx.fillStyle = 'rgba(6,14,12,0.18)'; ctx.fillRect(0, 0, 68, 18);
    const phase = (_ecgX % 22) / 22;
    const y = phase > .42 && phase < .48 ? 2 : phase >= .48 && phase < .54 ? 16 : phase >= .54 && phase < .62 ? 6 : 9 + Math.sin(tNow * 8) * 1.2;
    ctx.fillStyle = bpm > 120 ? '#ff5858' : '#58ff9a';
    ctx.fillRect(_ecgX | 0, y | 0, 2, 2);
  }
}

function updateHud(dt, prox, chase) {
  updateFace(dt); if (state === 'playing') areaCheck(dt);
  { const ft = clamp(prox * (chase ? 1.2 : .7), 0, 1); P.fear = P.fear > ft ? Math.max(ft, P.fear - dt * .05) : lerp(P.fear, ft, Math.min(1, dt * 3)); }   // 사건으로 오른 공포는 천천히 가라앉는다
  $('who').classList.toggle('panic', P.fear > .75); $('who').classList.toggle('pale', P.hp < 35 && P.fear <= .75);
  $('hpBar').style.width = P.hp + '%'; $('hpBar').style.background = P.hp > 50 ? '#5fc47a' : '#d0583c';
  $('sta').style.width = P.stamina + '%'; $('sta').style.background = P.tired ? '#a85040' : '#5a9ac8';
  $('fearBar').style.width = P.fear * 100 + '%';
  const st = $('stat'); setTxt(st, (P.hp > 50 ? (P.fear > .6 ? '긴장' : '정상') : '부상') + (P.sitting ? ' · 의자에 앉음' : P.crouch ? ' · 앉음' : '')); st.style.color = P.hp > 50 ? (P.fear > .6 ? '#e86870' : '#6fd08c') : '#e0884c';
  $('batBar').style.width = P.battery + '%'; $('s1').classList.toggle('off', !P.light);
  const outdoors = P.floor === 0 && !(RBG ? RBG.inBuilding(P.x, P.z) : inBldg(P.x, P.z));   // 새 건물이면 새 건물 경계로
  setTxt($('floor'), (RBG && P.floor === 0 && !outdoors && RBG.floorLabel(P.x, P.z, P.sh || 0)) || zoneLabel() || (P.floor === 0 && outdoors ? '외부' : AREA_NAMES[P.floor]));
  const m = gameMin(), h24 = Math.floor(m / 60) % 24, sec60 = Math.floor((playTime * 4) % 60);
  setTxt($('clock'), `${h24 >= 12 ? 'PM' : 'AM'} ${String(h24 % 12 || 12).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(sec60).padStart(2, '0')}`);
  updateRealisticHudWidgets(dt, prox, chase, outdoors);
  const ps = Math.floor(playTime); if (ps !== ptShown) { ptShown = ps; $('ptime').textContent = '⏱ ' + fmtPT(ps); }
  miniT -= dt;
  if (miniT <= 0) {
    miniT = .1; const c = $('miniMap'), g = c.getContext('2d');
    g.save(); g.beginPath(); g.arc(75, 75, 75, 0, 6.3); g.clip();
    drawMap(g, 150, 150, { floor: P.floor, cx: P.x, cz: P.z, scale: 2.6, pins: mapPins(curTab()), ...mapExtras(P.floor), target: mapTarget(curTab()), t: tNow, mini: true, player: { x: P.x, z: P.z, yaw: P.yaw } });
    g.restore();
  }
  updatePerks(dt);
  // 사물함 숨 참기
  const hold = !!P.hiding && keys.Space && P.breath > 0;
  /* breath VO 제거 */
  P.holdBreath = hold;
  if (hold) { P.breath = Math.max(0, P.breath - 17 * dt); if (P.breath <= 0) { sfx.gasp(); P.breathCD = 2.5; if (ghost.active && ghost.floor === P.floor && Math.hypot(ghost.x - P.x, ghost.z - P.z) < 4) ghost.findT += 2.5; } }
  else P.breath = Math.min(100, (P.breath ?? 100) + (P.breathCD > 0 ? 0 : 11) * dt);
  P.breathCD = Math.max(0, (P.breathCD || 0) - dt);
  $('breath').classList.toggle('show', !!P.hiding); $('breathBar').style.width = (P.breath ?? 100) + '%';
  const dang = Math.max(MIC.risk, P.hiding && ghost.active && ghost.floor === P.floor ? (ghost.fake && ghost.fake.phase !== 'away' ? 1 : clamp(ghost.findT / 5.2, 0, 1)) : 0); $('dangerBar').style.width = dang * 100 + '%';
  if (dang > .45 && Math.random() < dt * 3) { shake = Math.max(shake, .12); sfx.locker && Math.random() < .3 && at(P.x, floors[P.floor].y0 + 1, P.z).click(); }
}
// 고유 능력 — 서연: 가까운 단서의 방향 감지 / 지훈: 조사 가능한 단서가 빛나 보인다
const glintTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,250,220,1)'); r.addColorStop(.15, 'rgba(255,230,160,.8)'); r.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); g.fillStyle = 'rgba(255,255,235,.9)'; g.fillRect(31, 4, 2, 56); g.fillRect(4, 31, 56, 2);
  return new THREE.CanvasTexture(c); })();
const glints = [];
for (let i = 0; i < 8; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); sp.visible = false; scene.add(sp); glints.push(sp); }
let glintT = 0;
function updatePerks(dt) {
  const sense = $('sense');
  if (CHAR === 'seoyeon' && state === 'playing') {   // 서연: 가장 가까운, 아직 줍지 않은 단서(쪽지 · 사진 · 테이프)의 방향
    let best = null, bd = 18; for (const it of world.items) { if (it.taken || it.locked || it.floor !== P.floor || !(it.kind === 'note' || it.kind === 'photo')) continue; if (it.rbY != null && Math.abs(it.rbY - (P.sh || 0)) > 1.6) continue; const d = Math.hypot(it.pos.x - P.x, it.pos.z - P.z); if (d < bd) { bd = d; best = it; } }
    if (best) { const dx = best.pos.x - P.x, dz = best.pos.z - P.z, rx = dx * Math.cos(P.yaw) - dz * Math.sin(P.yaw), fw = -dx * Math.sin(P.yaw) - dz * Math.cos(P.yaw);
      sense.style.opacity = clamp((18 - bd) / 12, .15, .8); sense.style.transform = `rotate(${Math.atan2(rx, fw)}rad)`; } else sense.style.opacity = 0;
  } else sense.style.opacity = 0;
  glintT -= dt;
  if (CHAR !== 'jihun' || state !== 'playing') { glints.forEach(g => { g.visible = false; }); return; }
  if (glintT <= 0) {
    glintT = .3;
    const c = world.items.filter(i => !i.taken && !i.locked && i.floor === P.floor && i.kind !== 'battery' && i.kind !== 'medkit')
      .map(i => ({ p: i.pos, d: Math.hypot(i.pos.x - P.x, i.pos.z - P.z) }))
      .concat(world.props.filter(p => p.floor === P.floor && !p.done && (p.kind === 'tape' || p.kind === 'mina' || p.kind === 'safe')).map(p => ({ p: { x: p.x, y: floors[p.floor].y0 + (p.y ?? 1) , z: p.z }, d: Math.hypot(p.x - P.x, p.z - P.z) })))
      .filter(o => o.d < 11).sort((a, b) => a.d - b.d).slice(0, glints.length);
    if (c.length && !glints[0].visible) perkFlash('✦ 단서 감지 — 지훈');
    glints.forEach((g, i) => { const o = c[i]; g.visible = !!o; if (o) g.position.set(o.p.x, o.p.y + .18, o.p.z); g.userData.d = o ? o.d : 99; });
  }
  glints.forEach((g, i) => { if (!g.visible) return; const k = .5 + .5 * Math.sin(tNow * 3 + i * 1.7); g.scale.setScalar(.28 + k * .22); g.material.opacity = (.35 + k * .5) * clamp((11 - g.userData.d) / 4, 0, 1); });
}

function updatePrompt() {
  const pr = $('prompt');
  if (state !== 'playing') { pr.style.display = 'none'; return; }
  if (P.hiding) { pr.style.display = 'block'; setTxt(pr, '<kbd>E</kbd>사물함에서 나가기', true); return; }
  const now = performance.now(), key = P.floor + ':' + P.x.toFixed(2) + ':' + P.z.toFixed(2) + ':' + P.yaw.toFixed(2) + ':' + P.pitch.toFixed(2); if (now - (updatePrompt.t || 0) < 90 && updatePrompt.k === key) { if (!target) pr.style.display = 'none'; return; } updatePrompt.t = now; updatePrompt.k = key;   // 제자리에서 같은 곳을 보면 다시 찾지 않는다 (움직이면 바로 갱신)   // 조사 대상 찾기는 0.09초마다 (매 프레임 전체 소품 검사)
  target = findInteract();
  if (target) { pr.style.display = 'block'; setTxt(pr, target.raw ? target.label.replace(/\b([EQ]) /g, '<kbd>$1</kbd>') : `<kbd>E</kbd>${target.label}`, true); } else pr.style.display = 'none';
}

let last = performance.now();
function frameBody(now) {
  const dt = Math.min(.066, Math.max(0, (now - last) / 1000)); last = now; tNow += dt;
  perfTick(dt);
  if (RBG) RBG.cull(dt, P);
  minaFollowTick(dt);   // 새 건물 실내 소품: 지금 층만 (인트로 · 메뉴 중에도)
  npcVisuals.update(dt);
  if (state === 'ui') { updateSound(dt); return; }
  $('clickHint').classList.toggle('show', state === 'playing' && !document.pointerLockElement && !DEBUG && !TEST_NOLOCK);   // 소지품 · 지도 · 미니게임 중에는 3D를 다시 그리지 않는다 (마지막 화면 유지)
  if (state === 'playing' || state === 'trans' || state === 'dead') {
    if (state === 'playing') { playTime += dt; statAcc += dt; if (statAcc > 30) statFlush(); }
    if (state !== 'dead') updatePlayer(dt);
    updateGate(dt);
    updateGuardWalk(dt);
    if (blackout > 0) blackout -= dt;
    if (state === 'playing') {
      ghostTick(dt, tNow);
      // 랜덤 이벤트
      updatePrompt();
      updateEvents(dt);
    }
    updateLighting(dt); if (RBG) { RBG.tick(dt, P, sfx); RBG.setPower(blackout > 0, GEN.gain, power); }
    ghostVisual(dt, tNow);
    updateCamera(dt, tNow);
  } else if (state === 'intro') {
    updateIntro(dt);
    if ($('intro').classList.contains('show')) { return; }   // 검은 화면 텍스트 동안은 3D를 그리지 않는다
  } else if (state === 'menu') {
    if (MENUS.some(k => $(k).classList.contains('show'))) { return; }
    camera.position.set(Math.sin(tNow * .1) * 3, 2.2, 74); camera.rotation.set(-.05, Math.sin(tNow * .1) * .1, 0, 'YXZ');
    updateLighting(dt);
  }
  world.update(tNow, blackout > 0, GEN.gain, power ? 0 : 1, GEN.emerg); syncGuardDevices(); if (guardRoomController?.closing && !guardRoomController.canClose(P)) { FL.guardDoorOpen=true; syncGuardDevices(); save(true); } guardRoomController?.tick(dt);
  // 날씨: 번개 (밖이거나 창가에서), 전기 불꽃
  const outdoorsNow = isOutdoors();
  if (state === 'playing' || state === 'menu' || state === 'intro') {
    lightningT -= dt;
    if (lightningT <= 0 && DAY.k < .2) { lightningT = 50 + Math.random() * 50; fx.lightning(); lightningEvent(); const far = 1 + Math.random() * 2.5; setTimeout(() => sfx.thunder && sfx.thunder(far), far * 700); }
  }
  if (state === 'playing') {
    sparkT -= dt;
    if (sparkT <= 0) {
      sparkT = 1.5 + Math.random() * 3;
      const sp = (floors[P.floor].sparks || []).filter(s => Math.hypot(s.x - P.x, s.z - P.z) < 9);
      if (sp.length && Math.random() < .5) { const s = sp[(Math.random() * sp.length) | 0]; fx.spark(s.x, floors[P.floor].y0 + s.y, s.z); sfx.spark && sfx.spark(); }
    }
  }
  hurtFx = Math.max(0, hurtFx - dt * .8);
  // 그것 주변의 검은 연기 · 추운 곳의 입김
  if (state === 'playing' && ghost.active && ghost.floor === P.floor && ghost.group.visible) fx.ghostSmoke({ x: ghost.x, y: floors[ghost.floor].y0, z: ghost.z }, dt, ghost.state === 'chase' ? 1.6 : .8);
  if (state === 'playing') fx.breath(P.floor === 4 || P.floor === 6 || isOutdoors() || P.fear > .5, dt);
  updateSound(dt);
  updatePings(dt); updateObjDir(dt); tickHudV2(dt); tickPartnerRadio(dt);
  campusCctv?.tick(dt,{powered:FL.guardCctvOn??true,near:shouldStreamGuardCctv(P,state,GUARD_LAYOUT),quality:qCur});
  if (!NORENDER) staticLOD.render(camera, now, qCur, () => fx.render(dt, { fear: P.fear || 0, flash: flash.intensity / 95, outdoors: outdoorsNow, floorY: floors[P.floor].y0, hurt: hurtFx, rain: 0 }));
  if (SHOT.req) shotGrab();   // 카메라 앨범: 방금 그린 화면
  
}

// 안정화: 다음 프레임을 먼저 예약하고 본문은 오류를 잡아 실행한다 — 어느 기능에서 예외가 나도 게임 전체가 멈추지 않는다
let frameErrs = 0;
// 60fps 고정: 120 · 144Hz 모니터에서도 60프레임으로 그려 GPU 부하 · 발열 · 프레임 흔들림을 줄인다 (SET.fpsCap = 0 이면 제한 없음)
let lastFrameT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const cap = SET.fpsCap ?? 60;
  if (cap > 0 && !NORENDER) { const iv = 1000 / cap; if (now - lastFrameT < iv - 1.5) return; lastFrameT = now - ((now - lastFrameT) % iv); }
  try { frameBody(now); }
  catch (e) { if (frameErrs++ < 5) console.error('[frame]', e); window.__frameErrs = frameErrs; }
}
requestAnimationFrame(frame);


/* ---------- 형광등 스위치 ---------- */
// 같은 room 키의 형광등을 켜고 끈다. 켤 때는 형광등 특유의 '틱- 틱-' 점등 깜빡임이 있다.
const roomLamps = p => floors[p.floor].lamps.filter(l => l.room === p.room);
function flipSwitch(p, on, byPlayer = false) {
  p.on = on; p.tried = true;
  if (p.key) p.key.rotation.x = on ? -0.32 : 0.32;
  if (p.led && p.led.material) p.led.material.color.setHex(on ? 0x163822 : 0x40ff80);
  const ls = roomLamps(p), t0 = tNow;
  ls.forEach(l => { l.off = !on; l.start = on ? t0 + Math.random() * .25 : 0; l.mesh && (l.mesh.material = (!on || l.kind === 'dead') ? world.mats.matLampDead : l.mat); });
  lampTimer = 0;
  if (!byPlayer) return;
  at(p.px, floors[p.floor].y0 + 1.3, p.pz).click();
  if (on) {
    sfx.lightOn();
    if (ls.length && ls.every(l => l.kind === 'dead')) say('스위치를 올렸지만… 형광등이 모두 나갔다', 2400);
    else if (!FL.switchTip) { FL.switchTip = true; toast('형광등을 켰습니다', '켜진 방은 밝아서 단서를 찾기 쉽다 — 손전등 배터리도 아낄 수 있다', 'info'); }
  }
  P.noiseT = Math.max(P.noiseT || 0, .4);
}
const syncSwitches = () => world.props.forEach(p => { if (p.kind === 'switch') flipSwitch(p, p.on); });
// 지금 위치가 켜진 방 안인지 (그것은 밝은 방을 꺼린다)
function litAt(f, x, z) {
  const F = floors[f]; if (!F) return false;
  return F.lamps.some(l => l.room && !l.off && l.kind !== 'dead' && Math.abs(l.x - x) < 3.6 && Math.abs(l.z - z) < 4.2) && blackout <= 0;
}

/* ---------- 수영장의 기억 (EV-17~19): 플래시백 → 관람석의 소녀 → 선택 ---------- */
async function poolFlashback() {
  const epoch=storySession,current=()=>epoch===storySession&&P.floor===6&&['playing','ui','note'].includes(state);
  try {
  storyCalm(120); $('memTint').classList.add('on'); fx.glitch(.5); sfx.drip(); setFace('fear', 3);
  caption('…타일 틈의 물때. 물이 가득하던 그날의 수영장을 떠올린다');
  if (false) for (let k = 0; k < 40; k++) fx.emit(-46 + Math.random() * 8, floors[6].y0 - 1.3, 33 + Math.random() * 12, 0, 1.5 + Math.random(), 0, 1.6, [.6, .9, .95], .3, .03, -2);
  const e1=await line('echo1');await wait((e1+.4)*1000);if(!current())return;const e2=await line('echo2');await wait((e2+.4)*1000);if(!current())return;
  $('memTint').classList.remove('on'); addClue('pool3'); FL.mem3 = true;
  toast('기억 조각을 얻었다', '물이 가득하던 수영장 — 관람석 난간에 낡은 명찰 끈이 걸려 있다', 'opt');
   await wait(2000);
  if (!current() || state !== 'playing') { if(epoch===storySession)apparT = .3; return; }
  const i = await choose('관람석의 명찰', '난간에 걸린 1998년 명찰 — 윤하늘. 누군가 그날 밤 여기 있었다.', [{ label: '사과한다', sub: '“미안해. 아무도 너를 찾으러 오지 않았어.”' }, { label: '묻는다', sub: '“그날 밤, 무슨 일이 있었어?”' }, { label: '조용히 자리를 뜬다', sub: '지금 본 장면을 기록해 두고 돌아간다' }]);
  if(!current())return;
  apparT = .4; FL.girl = ['sorry', 'ask', 'run'][i];
  if (i === 0) { caption('명찰을 조심스레 거두었다. 이제, 누군가는 안다.'); storyCalm(160); setFace('calm', 3); }
  else if (i === 1) { caption('명찰 뒤 메모: “문은 밖에서 잠겨 있었다. 열쇠는 선생님 주머니에.”'); addClue('girl'); storyCalm(110); }
  else {
    caption('명찰과 난간을 사진으로 남겨 두고 자리를 떴다.');
    settleStoryGhost(ghost);
  }
  save(true);
  } finally { if(epoch===storySession)$('memTint').classList.remove('on'); }
}

/* ---------- 교실의 기억 (수집 요소) ---------- */
const MEM_TOTAL = () => world.props.filter(p => p.kind === 'clue').length;
const memCount = () => world.props.filter(p => p.kind === 'clue' && p.done).length;
function readMemory(p) {
  p.done = true; p.mesh.visible = false; sfx.paper();
  const n = memCount(), tot = MEM_TOTAL();
  showNote({ title: `${p.title} — 교실의 기억 ${n}/${tot}`, text: (MEMORIES[p.room] || p.state) + `<br><br><span style="color:#9a9488">(${p.room} · ${p.state})</span>` });
  if (n % 3 === 0 || n === tot) {
    const r = n === tot ? { medkit: 1, battery: 2 } : n / 3 % 2 ? { battery: 1 } : { medkit: 1 };
    Object.entries(r).forEach(([k, v]) => { inv[k] = (inv[k] || 0) + v; });
    setTimeout(() => toast(n === tot ? '교실의 기억을 모두 모았다' : `교실의 기억 ${n}/${tot}`, '누군가 남겨 둔 보급품을 찾았다 — ' + Object.entries(r).map(([k, v]) => `${ITEMS[k].name} ×${v}`).join(', '), 'opt'), 1200);
  } else setTimeout(() => toast('교실의 기억', `${n}/${tot} — 교실마다 그날의 흔적이 하나씩 남아 있다`, 'info'), 1200);
  refreshHud(); save(true);
}

/* ---------- 퍼즐 · 장치 ---------- */
let power = false, consoleCD = 0, kpBuf = '', kpProp = null, keypadSequence = 0, kpOpening = false;
const setTarget = t => { target = t; };
// 주변 사물 살펴보기: 실제로 놓인 3D 소품(정수기 · 소화기 · TV · 게시판 …) 위치에 자연스러운 상호작용을 붙인다
const LOOKS = [
  [/water_cooler/, '정수기에서 물 마시기', p => { P.stamina = 100; P.tired = false; P.fear = Math.max(0, P.fear - .08); sfx.drip(); return p.n++ ? '미지근한 물이 똑똑 떨어진다.' : '물이 아직 나온다. 숨이 조금 고른다.'; }],
  [/fire_extinguisher/, '소화기 점검표 보기', () => { sfx.paper(); return pk(['점검표 마지막 서명: 1998. 10. 12. — 그 뒤 칸은 전부 비어 있다.', '압력계 바늘이 0에 붙어 있다. 아무도 이걸 다시 채우지 않았다.', '안전핀에 붉은 리본이 묶여 있다. “쓰지 마시오 — 교무부”']); }],
  [/crt_tv/, 'TV 전원 눌러 보기', () => { sfx.staticNoise(.8); fx.glitch(.25); return pk(['지지직… 화면에 23:40이 잠깐 떴다가 사라진다.', '방송실 화면조정 패턴. 오른쪽 아래 자막: 송출 대기.', '전원이 들어오지 않는다. 그런데 화면에 손자국이 남아 있다.']); }],
  [/bulletin_board/, '게시판 읽기', () => { sfx.paper(); return pk(['방송부 창립 30주년 기념 하교 방송 — 10월 12일(목) 밤 10시. 진행: 3-2 윤하늘', '분실물: 방수 손목시계(검정) — 찾아가지 않으면 폐기', '공지: 지하 펌프실 출입 금지. 열쇠는 교무실에서만 관리함.']); }],
  [/fuse_box|power_box/, '분전반 표시 보기', () => { sfx.click(); return pk(['차단기 이름표: B1 펌프실 · 비상등 — 누군가 붉은 테이프로 덮어 놓았다.', '합선 위험 — 교체 요망 (1998.9). 결재란은 비어 있다.']); }],
  [/wooden_bookshelf|bookshelf/, '책장 살펴보기', () => { sfx.paper(); return pk(['『집으로 가는 길』 — 빈 자리만 남아 있다. 대출 중.', '1998 졸업앨범. 3학년 2반 한 페이지가 뜯겨 나갔다.', '먼지 쌓인 학급문집. 마지막 글: “내일도 1등으로 올게.”']); }],
  [/sf_vending/, '자판기 버튼 눌러 보기', () => { sfx.clank(); return pk(['덜컹. 아무것도 나오지 않는다. 가격표는 1998년 그대로다.', '동전 반환구에 500원짜리가 하나 남아 있다. 1998년 발행.']); }],
  [/wheelchair/, '휠체어 살펴보기', () => { sfx.creak(); return '바퀴가 혼자 반 바퀴 굴렀다. 손잡이에 보건실 이름표.'; }],
  [/standing_chalkboard/, '이동식 칠판 보기', () => { sfx.ui(); return '분필로 쓴 글씨: “리허설 22:00 · 끝곡 학교종 · 늦지 마!”'; }],
  [/medical_box/, '구급함 열어 보기', () => { sfx.click(); return '붕대 포장지만 잔뜩. 누군가 급하게 다 써 버렸다.'; }],
  [/fire_alarm/, '화재경보기 살펴보기', () => { sfx.click(); return '유리가 이미 깨져 있다. 그날 밤, 누군가 눌렀지만 울리지 않았다.'; }],
  [/metal_trash_can/, '쓰레기통 뒤져 보기', () => { sfx.clank(); return pk(['구겨진 방송 원고 한 장 — “모두, 집으로 돌아가세요.”', '찢어진 기사 스크랩. “서문고 ‘단순 실종’…”', '빈 우유팩뿐이다.']); }],
];
const pk = a => a[Math.floor(Math.random() * a.length)];
function addLookProps() {
  const seen = [];
  world.MODELS.forEach(m => {
    if (m.f === 'out' || typeof m.f !== 'number') return;
    const L = LOOKS.find(([re]) => re.test(m.model)); if (!L) return;
    if (seen.some(q => q.f === m.f && Math.hypot(q.x - m.x, q.z - m.z) < 1.2)) return;
    if (world.props.some(q => q.floor === m.f && Math.hypot(q.x - m.x, q.z - m.z) < .5)) return;   // 이미 다른 상호작용이 있는 자리는 피한다
    seen.push(m);
    world.props.push({ kind: 'look', floor: m.f, x: m.x, z: m.z, y: (m.y || 0) + .9, r: 1.6, label: L[1], fn: L[2], n: 0 });
  });
}
/* ----- 경비동 별관: 관제실(1998 녹화 테이프) · 열쇠보관실(보관함 · 열쇠 3종) ----- */
const ANX_CAMS = ['CAM-01 정문', 'CAM-02 본관 1F 복도', 'CAM-03 B1 펌프실 복도', 'CAM-04 교무실 앞'];
const ANX_T0 = 21 * 60, ANX_STEP = 10, ANX_N = 55;   // 21:00 ~ 06:00, 10분 간격
const anxTime = i => { const m = (ANX_T0 + i * ANX_STEP) % 1440; return String(m / 60 | 0).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
// 장면: [카메라, 시각] → 사람 실루엣 · 자막 · 증거 여부
const ANX_SCENES = {
  '0|21:40': { who: [{ x: .5, s: .8, c: '#d8d8d0' }], cap: '교복 차림 여학생 1명 정문 통과 — 가방에 방송 원고' },
  '1|22:10': { who: [{ x: .3, s: 1, c: '#b8b0a0' }, { x: .45, s: 1, c: '#b8b0a0' }, { x: .6, s: 1, c: '#b8b0a0' }, { x: .72, s: 1, c: '#b8b0a0' }, { x: .55, s: .9, c: '#e0e0d8' }], cap: '학생 5명이 계단 쪽으로 이동' },
  '1|22:20': { who: [{ x: .7, s: 1.2, c: '#30343a', badge: 1 }], cap: '양복 차림 교사 1명 — 교무실 방향' },
  '2|22:30': { who: [{ x: .3, s: 1, c: '#b8b0a0' }, { x: .4, s: 1, c: '#b8b0a0' }, { x: .5, s: .9, c: '#e0e0d8' }, { x: .62, s: 1, c: '#b8b0a0' }, { x: .72, s: 1, c: '#b8b0a0' }], cap: '펌프실 철문 앞에 학생 5명', door: 1 },
  '2|22:40': { who: [{ x: .25, s: 1, c: '#b8b0a0' }, { x: .35, s: 1, c: '#b8b0a0' }, { x: .45, s: 1, c: '#b8b0a0' }, { x: .55, s: 1, c: '#b8b0a0' }], cap: '학생 4명만 계단으로 돌아감 — 철문 닫힘', door: 0 },
  '2|22:50': { who: [{ x: .62, s: 1.25, c: '#30343a', badge: 1, key: 1 }], cap: '양복 교사가 철문 앞에 섰다 — 손에 열쇠 꾸러미 · 문은 열지 않는다', door: 0, ev: 'cctv_b1' },
  '3|22:55': { who: [{ x: .4, s: 1.25, c: '#30343a', badge: 1, key: 1 }], cap: '같은 교사, 열쇠를 쥔 채 교장실 쪽으로', ev: 'cctv_office' },
  '3|23:10': { who: [{ x: .45, s: 1.25, c: '#30343a', badge: 1 }, { x: .6, s: 1.3, c: '#2a2a2a' }], cap: '교장실 앞 — 두 사람이 오래 서 있다' },
  '1|22:15': { who: [{ x: .2, s: 1.1, c: '#4a5a6a', run: 1 }], cap: '경비원이 교무실 쪽으로 뛰어간다' },
  '0|05:50': { who: [{ x: .5, s: 1.2, c: '#30343a', key: 1 }], cap: '새벽 — 교무부장이 정문으로 들어온다. 구급차는 없다' },
};
const anxDark = (cam, i) => cam >= 1 && cam <= 3 && ANX_T0 + i * ANX_STEP >= 23 * 60 + 20 && ANX_T0 + i * ANX_STEP < 29 * 60 + 50;
let anxCam = 2, anxIdx = 0, anxView = '';
function anxDraw(cv) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, t = anxTime(anxIdx);
  g.fillStyle = '#0b0f0d'; g.fillRect(0, 0, W, H);
  if (anxDark(anxCam, anxIdx)) { g.fillStyle = '#9bb5aa'; g.font = '20px monospace'; g.fillText('NO SIGNAL — 본관 정전', W / 2 - 120, H / 2); }
  else {
    g.strokeStyle = '#2c3a33'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, H); g.lineTo(W * .35, H * .38); g.lineTo(W * .65, H * .38); g.lineTo(W, H); g.moveTo(W * .35, H * .38); g.lineTo(W * .35, 0); g.moveTo(W * .65, H * .38); g.lineTo(W * .65, 0); g.stroke();
    if (anxCam === 2) { g.fillStyle = '#3a3226'; g.fillRect(W * .55, H * .2, W * .16, H * .45); g.fillStyle = '#c9b060'; g.fillRect(W * .69, H * .42, 4, 6); g.fillStyle = '#d0d0c0'; g.font = '10px sans-serif'; g.fillText('펌프실', W * .58, H * .18); }
    const sc = ANX_SCENES[anxCam + '|' + t];
    for (const w of sc?.who || []) {
      const x = w.x * W, base = H * .85, hh = 70 * w.s;
      g.fillStyle = w.c; g.beginPath(); g.ellipse(x, base - hh, 9 * w.s, 10 * w.s, 0, 0, 7); g.fill(); g.fillRect(x - 12 * w.s, base - hh + 10 * w.s, 24 * w.s, hh - 10 * w.s);
      if (w.badge) { g.fillStyle = '#e8e0b0'; g.fillRect(x - 8 * w.s, base - hh + 20 * w.s, 6, 3); }
      if (w.key) { g.fillStyle = '#ffd860'; g.beginPath(); g.arc(x + 15 * w.s, base - hh * .45, 3.5, 0, 7); g.fill(); g.fillRect(x + 14 * w.s, base - hh * .45, 2, 8); }
    }
    for (let i = 0; i < 900; i++) { const v = Math.random() * 60 | 0; g.fillStyle = `rgba(${v},${v + 10},${v},.35)`; g.fillRect(Math.random() * W, Math.random() * H, 2, 1); }
  }
  for (let y = 0; y < H; y += 3) { g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, y, W, 1); }
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, W, 20); g.fillStyle = '#c8ffd6'; g.font = '12px monospace'; g.fillText(ANX_CAMS[anxCam], 6, 14); g.fillStyle = '#ff5050'; g.fillText('▶ PLAY', W - 70, 14);
  g.fillStyle = '#c8ffd6'; g.fillText('1998-10-' + (anxIdx * ANX_STEP + ANX_T0 >= 1440 ? '13' : '12') + '  ' + t, 6, H - 8);
  const sc = !anxDark(anxCam, anxIdx) && ANX_SCENES[anxCam + '|' + t]; $('anxCap').textContent = sc ? '● ' + sc.cap : '— 움직임 없음 —';
}
function anxRender() {
  const box = $('anxBody');
  if (anxView === 'archive') {
    box.innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${ANX_CAMS.map((c, i) => `<button data-cam="${i}" style="${i === anxCam ? 'background:#2f5a44' : ''}">${c}</button>`).join('')}</div>
      <canvas id="anxCv" width="560" height="315" style="width:100%;background:#000;border:1px solid #3b5546"></canvas>
      <div id="anxCap" style="min-height:22px;margin:6px 0;color:#cfe"></div>
      <div style="display:flex;gap:8px;align-items:center"><button data-step="-6">◀◀ 1시간</button><button data-step="-1">◀ 10분</button>
      <input id="anxSlide" type="range" min="0" max="${ANX_N - 1}" value="${anxIdx}" style="flex:1"><button data-step="1">10분 ▶</button><button data-step="6">1시간 ▶▶</button></div>
      <div style="margin-top:10px;display:flex;gap:8px"><button id="anxCapture" style="background:#5a2f2f">📸 이 장면 증거로 캡처</button><span style="opacity:.75;font-size:12px">녹화 테이프 3개 · 21:00 ~ 06:00 · 장면을 찾아 캡처하세요 (${['cctv_b1', 'cctv_office'].filter(k => FL[k]).length}/2)</span></div>`;
    box.querySelectorAll('[data-cam]').forEach(b => b.onclick = () => { anxCam = +b.dataset.cam; sfx.click(); anxRender(); });
    box.querySelectorAll('[data-step]').forEach(b => b.onclick = () => { anxIdx = Math.max(0, Math.min(ANX_N - 1, anxIdx + +b.dataset.step)); sfx.beep(); anxRender(); });
    $('anxSlide').oninput = e => { anxIdx = +e.target.value; anxDraw($('anxCv')); };
    $('anxCapture').onclick = () => {
      const sc = !anxDark(anxCam, anxIdx) && ANX_SCENES[anxCam + '|' + anxTime(anxIdx)]; sfx.camera ? sfx.camera() : sfx.click();
      if (!sc?.ev) { $('anxCap').textContent = '이 장면만으로는 아무것도 증명할 수 없다…'; return; }
      if (FL[sc.ev]) { $('anxCap').textContent = '이미 캡처한 장면이다.'; return; }
      FL[sc.ev] = true; const id = sc.ev === 'cctv_b1' ? 'n_cctv_b1' : 'n_cctv_office'; addDoc({ id, kind: 'note' }); addClue(id);
      toast('📸 CCTV 증거 캡처', world.NOTES[id].title, 'info'); storyCalm(60); save(true); anxRender();
      if (FL.cctv_b1 && FL.cctv_office) setTimeout(() => say('두 장면이 이어진다 — 열쇠를 쥔 교무부장은 철문을 열지 않고, 교장실로 갔다.', 4200), 600);
    };
    anxDraw($('anxCv'));
  } else if (anxView === 'keys') {
    box.innerHTML = `<div style="opacity:.8;margin-bottom:8px">녹색 철제 열쇠함 — 고리마다 이름표가 붙어 있다.</div><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">${ANNEX_KEYS.map(k => `<div style="border:1px solid #556;padding:10px;border-radius:6px;background:#141a17"><b style="color:${k.color}">🔑 ${k.name}</b><div style="font-size:12px;opacity:.75">${k.tag}</div>${FL['key_' + k.id] ? '<div style="margin-top:6px;opacity:.6">— 가져감 —</div>' : `<button data-key="${k.id}" style="margin-top:6px">가져가기</button>`}</div>`).join('')}
      <div style="border:1px dashed #844;padding:10px;border-radius:6px;background:#1a1212"><b style="color:#c66">🔑 지하 펌프실 열쇠</b><div style="font-size:12px;opacity:.85">빈 고리. 꼬리표만 남아 있다:<br>「10/12 22:50 대출 — 교무부장. <b>미반납</b>」</div></div></div>`;
    box.querySelectorAll('[data-key]').forEach(b => b.onclick = () => {
      const k = ANNEX_KEYS.find(q => q.id === b.dataset.key); FL['key_' + k.id] = true; sfx.pickup(); toast('🔑 ' + k.name, k.tag + ' 를 열 수 있다', 'info');
      const i = ANNEX_KEYS.indexOf(k); if (world.guardAnnex?.hookKeys[i]) world.guardAnnex.hookKeys[i].visible = false; if (!FL.anxKeyHint) { FL.anxKeyHint = true; setTimeout(() => say('열쇠 이름표마다 잠긴 함의 위치가 적혀 있다 — 본관 교무실, 체육관 창고, 지하 시설창고.', 4200), 400); }
      save(true); anxRender();
    });
  }
}
function anxOpen(view, title) { anxView = view; $('anxTitle').textContent = title; openUI('annexOv'); anxRender(); }
const ANX_BOX_NOTES = {
  main: 'n_box_main', gym: 'n_box_gym', base: 'n_box_base',
};
function useAnnex(p) {
  const k = p.k;
  if (k === 'live') { if (campusCctv) { openGuardCctv(); sfx.click(); } else say('모니터에는 노이즈만 흐른다', 2000); return; }
  if (k === 'archive') { sfx.click(); setTimeout(() => sfx.staticNoise?.(.3), 100); anxOpen('archive', '관제실 VCR — 1998.10.12 녹화 테이프'); return; }
  if (k === 'ledger') { sfx.paper(); if (!docs.some(d => d.id === 'n_key_ledger')) { addDoc({ id: 'n_key_ledger', kind: 'note' }); addClue('n_key_ledger'); } showNote(world.NOTES.n_key_ledger); return; }
  if (k === 'lost') { sfx.paper(); if (!p.done) { p.done = true; giveItem('battery', 1); FL.anxLost = true; } showNote(world.NOTES.n_lost_badge); if (!docs.some(d => d.id === 'n_lost_badge')) addDoc({ id: 'n_lost_badge', kind: 'note' }); return; }
  if (k === 'cabinet') {
    if (cabIsOpen) { sfx.click(); anxOpen('keys', '열쇠보관실 — 열쇠함'); return; }   // 문이 아직 열려 있을 때(자동 잠금 전)
    kpProp = { code: CABINET_CODE, prop: p, onOpen: () => { FL.cabOpen = true; cabSwing(true); save(true); setTimeout(() => anxOpen('keys', '열쇠보관실 — 열쇠함'), 650); },
      hints: ['힌트 ① 경비장 지시: 번호는 <b>“마지막으로 나간 열쇠의 시각”</b>', '힌트 ② 관제실 책상 위 <b>열쇠 대출 장부</b>를 보라', '힌트 ③ 펌프실 열쇠 대출 22:50 → 2 2 5 0'] };
    kpBuf = ''; ++keypadSequence; kpOpening = false; $('kpTitle').textContent = '열쇠보관함 (전자식 · 자동 잠금)'; $('kpHint').innerHTML = FL.cabOpen ? '닫으면 자동으로 잠기는 함 — 장부에서 본 번호를 다시 누른다' : '숫자 4자리 — 경비장만 아는 번호'; renderKeypad(); openUI('keypad'); sfx.beep(); return;
  }
  if (k === 'roster' || k === 'calendar' || k === 'contacts') { const id = { roster: 'n_duty_roster', calendar: 'n_guard_calendar', contacts: 'n_guard_contacts' }[k]; sfx.paper(); if (!docs.some(d => d.id === id)) { addDoc({ id, kind: 'note' }); addClue(id); } showNote(world.NOTES[id]); return; }
  if (k === 'glocker') { sfx.clank?.(); if (!FL.gLocker) { FL.gLocker = true; giveItem('medkit', 1); giveItem('battery', 1, true); addDoc({ id: 'n_guard_locker', kind: 'note' }); addClue('n_guard_locker'); save(true); } showNote(world.NOTES.n_guard_locker); return; }
  if (k === 'kettle') { const n = (FL.kettleN = (FL.kettleN || 0) + 1); if (n === 3) { caption('주전자 바닥에 1998년 10월자 보리차 티백 포장지가 눌어붙어 있다.'); } else say(n === 1 ? '보온 주전자가 비어 있다. 누군가 최근까지 이 방을 드나든 것 같다.' : '주전자 뚜껑 안쪽에 물기가 맺혀 있다.', 2600); return; }
  if (k === 'box') {
    const key = ANNEX_KEYS.find(q => q.id === p.key), nid = ANX_BOX_NOTES[p.key];
    if (FL['box_' + p.key]) { sfx.paper(); showNote(world.NOTES[nid]); return; }
    if (!FL['key_' + p.key]) { sfx.clank?.(); say(`자물쇠가 채워져 있다 — 꼬리표: 『경비실 보관 · ${key.name}』. 정문 경비실 열쇠보관함(전자식)에 있다 — 번호는 관제실 열쇠 대출 장부의 마지막 대출 시각.`, 4600); addClue && CLUES.anxbox && addClue('anxbox'); return; }
    FL['box_' + p.key] = true; sfx.unlock(); p.label = p.label.replace('잠긴 ', '열린 '); if (p.mesh?.userData.lid) p.mesh.userData.lid.rotation.x = -1.2;
    addDoc({ id: nid, kind: 'note' }); addClue(nid); toast('🗝 ' + key.name + '로 열었다', world.NOTES[nid].title, 'info'); storyCalm(60); save(true);
    setTimeout(() => showNote(world.NOTES[nid]), 500); return;
  }
}
// 열쇠보관함: 비밀번호가 맞으면 양문이 열리고, 열쇠함 창을 닫으면 문이 닫힌 뒤 전자 잠금이 자동으로 걸린다 (열린 채로 남지 않는다)
let cabIsOpen = false, cabRaf = 0, cabLockT = 0;
function cabSwing(open) {
  const a = world.guardAnnex; if (!a) return; const D = a.cabDoor; cabIsOpen = open; D.target = open ? 1 : 0; clearTimeout(cabLockT);
  if (open) { a.cabPad.material.color.setHex(0x40ff80); sfx.unlock(); } else sfx.click();
  cancelAnimationFrame(cabRaf); let last = performance.now();
  const step = now => { const dt = Math.min(.05, (now - last) / 1000); last = now; const t = D.t + Math.sign(D.target - D.t) * Math.min(Math.abs(D.target - D.t), dt * 2.6); D.set(t); if (t !== D.target) cabRaf = requestAnimationFrame(step); };
  cabRaf = requestAnimationFrame(step);
  if (!open) cabLockT = setTimeout(() => { if (cabIsOpen) return; a.cabPad.material.color.setHex(0xff4030); sfx.beep(); if (state === 'playing') say('삑— 철컥. 열쇠보관함이 자동으로 잠겼다', 2000); }, 700);
}
function anxCabinetVisual() { const a = world.guardAnnex; if (!a) return; cabIsOpen = false; a.cabDoor.set(0); a.cabDoor.target = 0; a.cabPad.material.color.setHex(0xff4030); ANNEX_KEYS.forEach((k, i) => { if (a.hookKeys[i]) a.hookKeys[i].visible = !FL['key_' + k.id]; }); for (const q of world.props) if (q.kind === 'ganx' && q.k === 'box' && FL['box_' + q.key] && q.mesh?.userData.lid) { q.mesh.userData.lid.rotation.x = -1.2; q.label = q.label.replace('잠긴 ', '열린 '); } }
function setupAnnex() {
  Object.assign(world.NOTES, {
    n_duty_roster: { title: '경비실 근무 교대표 (1998년 10월)', text: '<b>[정문 경비실 근무 교대표]</b><br>• 주간 06:00~18:00 — 김영수<br>• 야간 18:00~06:00 — <b>박종철</b> (10/12 당직)<br><br>10/12 칸 옆 빨간 펜: <i>“22:40 교무부장 지시 — 오늘 B1 순찰 제외. 지하는 내가 본다고 함.”</i><br>그 아래 다른 글씨: <i>“10/13부터 박종철 근무 제외 (재단 지시)”</i>' },
    n_guard_calendar: { title: '경비실 달력 — 1998년 10월', text: '10월 12일에 동그라미 — <b>“개교기념 방송 · 늦게까지 학생 있음”</b>.<br>10월 13일 칸: <i>“재단 이사장 방문 09:00 — 아무 말도 하지 말 것”</i><br>10월 20일 칸이 볼펜으로 세게 지워져 있다. 뒤로 비치는 글씨 — <b>“사직서”</b>.' },
    n_guard_contacts: { title: '비상연락망 (1998)', text: '<b>[서문고 비상연락망]</b><br>• 교장실 — 내선 101<br>• 교무부장 — 내선 103 · 자택 (지워짐)<br>• 방송실 — 내선 201<br>• 정문 경비실 — 내선 100<br>• 야간 경비 박종철 — 자택 <b>031-562-0915</b><br>• 서문일보 사회부 — 02-735-1998 <i>(연필로 나중에 적어 넣은 듯)</i>' },
    n_guard_locker: { title: '경비원 사물함 — 박종철', text: '구겨진 근무복 아래, 가족사진 한 장과 <b>쓰다 만 사직서</b>.<br><i>“본인은 1998년 10월 12일 밤, 상부 지시로 지하 순찰을 하지 않았으며, 그 결정에 따른 결과를 평생…”</i><br>마지막 줄은 비어 있다. 구급 밴드와 건전지가 함께 들어 있었다.' },
    n_key_ledger: { title: '경비실 열쇠 대출 장부 (1998.10)', text: '<b>[열쇠 대출 장부 — 1998년 10월 12일]</b><br>• 18:05 방송실 열쇠 — 방송부 윤하늘 · 반납 21:55<br>• 19:30 체육관 열쇠 — 체육부장 강태식 · 반납 21:10<br>• 20:40 본관 숙직실 — 교무부장 · 반납 20:50<br>• <b>22:50 지하 펌프실 열쇠 — 교무부장 (서명)</b> · 반납 <b>—</b><br><br>장부 맨 아래, 경비장 글씨: <i>“보관함 번호는 마지막으로 나간 열쇠의 시각으로 바꿀 것.”</i><br><br>표지 안쪽 연필 메모: <i>박종철 (야간) 자택 031-562-0915</i>' },
    n_lost_badge: { title: '분실물 상자 — 방송부 명찰', text: '먼지 쌓인 분실물 상자 맨 밑, <b>“방송부 · 윤하늘”</b> 명찰이 있다.<br>뒷면에 볼펜으로 — <i>“10/12 기념 방송 끝나면 엄마한테 바로 전화.”</i><br>상자 구석에서 손전등 건전지 하나를 찾았다.' },
    n_cctv_b1: { title: 'CCTV 캡처 ① — B1 펌프실 복도 22:50', text: '<b>[CAM-03 · 1998.10.12 22:50]</b><br>펌프실 철문 앞, 명찰을 단 양복 교사. 손에 열쇠 꾸러미가 빛난다.<br>그는 문 앞에 30초쯤 서 있다가 — <b>열지 않고 돌아선다.</b><br>10분 전, 학생 4명만 계단으로 돌아갔다. 들어간 사람은 5명이었다.' },
    n_cctv_office: { title: 'CCTV 캡처 ② — 교무실 앞 22:55', text: '<b>[CAM-04 · 1998.10.12 22:55]</b><br>같은 교사가 열쇠를 쥔 채 교장실 쪽으로 걸어간다.<br>23:10, 교장실 앞에 두 사람. 23:20 — 본관 전체 정전, 화면이 끊긴다.' },
    n_box_main: { title: '본관 교무실 숙직 서류함 — 숙직 일지', text: '<b>[숙직 일지 1998.10.12]</b><br>• 22:52 교무부장 숙직실 들름. 펌프실 열쇠를 서랍에 넣으려다 <b>다시 주머니에 넣음.</b> “아침에 내가 연다.”<br>• 23:25 정전. 교무부장 “지하는 내려가지 말 것” 지시.<br>• 06:10 119 신고 — <b>사고 7시간 뒤.</b>' },
    n_box_gym: { title: '체육관 창고 당직함 — 비상 랜턴 수령부', text: '<b>[비상 장비 수령부]</b><br>• 23:30 비상 랜턴 2개 — 체육부장 강태식 수령.<br>• 사용처: <b>“B1 진입 대기 — 교무부장 지시로 대기.”</b><br>• 반납 06:20 · 미사용.<br>아래 메모: <i>“내려갔어야 했다.”</i>' },
    n_box_base: { title: '지하 시설창고 기밀 상자 — 펌프실 자물쇠', text: '상자 안에 녹슨 <b>펌프실 철문 자물쇠</b>와 감식 메모가 있다.<br><i>“자물쇠 안쪽 수십 군데 긁힘 — 안에서 두드린 흔적. 열쇠 홈 각인 B-07 = 교무부장 열쇠 꾸러미.”</i><br>학교는 이 자물쇠를 경찰에 넘기지 않았다.' },
  });
  // 잠긴 증거함 3개: 본관(예전 1층 → 새 본관으로 옮겨짐) · 체육관(5층 공간) · 지하(4층 공간)
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x3a5a44, roughness: .5, metalness: .5 }), lockMat = new THREE.MeshStandardMaterial({ color: 0xc9a64a, metalness: .8, roughness: .3 });
  const mkBox = () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(.55, .32, .38), boxMat); b.position.y = .16; g.add(b); const lid = new THREE.Group(); lid.position.set(0, .32, -.19); const lm = new THREE.Mesh(new THREE.BoxGeometry(.56, .05, .39), boxMat); lm.position.z = .195; lid.add(lm); g.add(lid); g.userData.lid = lid; const lk = new THREE.Mesh(new THREE.BoxGeometry(.07, .08, .03), lockMat); lk.position.set(0, .26, .2); g.add(lk); g.userData.dynamic = true; g.traverse(o => o.userData.dynamic = true); return { g, lid }; };
  const freeSpot = (f, x, z) => { const cs = floors[f].col; for (let r = 0; r < 4; r += .3) for (let a = 0; a < 12; a++) { const px = x + Math.cos(a * .52) * r, pz = z + Math.sin(a * .52) * r; if (!cs.some(c => !c.off && px > c.x1 - .45 && px < c.x2 + .45 && pz > c.z1 - .45 && pz < c.z2 + .45)) return [px, pz]; } return [x, z]; };
  const place = (key, f, x, z, label) => { const { g, lid } = mkBox(); const [px, pz] = f === 1 ? [x, z] : freeSpot(f, x, z); floors[f].interior.add(g); g.position.set(px, floors[f].y0 - floors[f].interior.getWorldPosition(new THREE.Vector3()).y, pz); world.props.push({ kind: 'ganx', k: 'box', key, floor: f, x: px, z: pz, y: .4, r: 1.4, label, mesh: g }); };
  const safe = world.props.find(q => q.kind === 'safe' && q.floor === 1) || { x: -20, z: -4 };
  place('main', 1, safe.x + .9, safe.z + .9, '잠긴 본관 교무실 숙직 서류함 (본관 열쇠 필요)');
  const gymRef = world.props.find(q => q.floor === 5 && q.kind === 'search') || { x: 29, z: 24 };
  place('gym', 5, gymRef.x, gymRef.z + 1, '잠긴 체육관 창고 당직함 (체육관 열쇠 필요)');
  const baseRef = world.props.find(q => q.floor === 4 && q.kind === 'fz' && /시설창고/.test(q.label || '')) || { x: -9, z: -6 };
  place('base', 4, baseRef.x + .6, baseRef.z + 1, '잠긴 지하 시설창고 기밀 상자 (지하실 열쇠 필요)');
  anxCabinetVisual();
}

/* ----- 5단계: 추가 퍼즐 · 증거 · 증언 · 아이템 ----- */
const PRINCIPAL_CODE = '2310';
const EVIDENCE5 = ['cctv_b1', 'cctv_office', 'box_main', 'box_gym', 'box_base', 'ev_fund', 'ev_testimony', 'attend'];
const evCount = () => EVIDENCE5.filter(k => FL[k]).length;
function useCase5(p) {
  const k = p.k, N = world.NOTES;
  if (k === 'psafe') {
    if (FL.ev_fund) { sfx.paper(); showNote(N.n_fund_receipt); return; }
    kpProp = { code: PRINCIPAL_CODE, prop: p, onOpen: () => { FL.ev_fund = true; p.label = '열린 교장실 금고 (재단 서류)'; sfx.unlock(); addDoc({ id: 'n_fund_receipt', kind: 'note' }); addClue('n_fund_receipt'); toast('🗄 교장실 금고가 열렸다', N.n_fund_receipt.title, 'info'); storyCalm(50); save(true); setTimeout(() => showNote(N.n_fund_receipt), 500); },
      hints: ['힌트 ① 교장은 <b>“그날 밤 그 사람과 만난 시각”</b>을 번호로 썼다', '힌트 ② 관제실 CCTV 캡처 ② — 교장실 앞에 두 사람', '힌트 ③ 23:10 → 2 3 1 0'] };
    kpBuf = ''; ++keypadSequence; kpOpening = false; $('kpTitle').textContent = '교장실 금고'; $('kpHint').innerHTML = '다이얼 금고 — 숫자 4자리'; renderKeypad(); openUI('keypad'); sfx.beep(); return;
  }
  if (k === 'attend') {
    sfx.paper();
    if (FL.attend) { showNote(N.n_attend); return; }
    choose('📚 3-2 출석부 — 1998년 10월 12일', '윤하늘 이름 옆 마지막 칸만 비어 있다. 십 년 동안 아무도 채우지 않았다. 볼펜을 든다.', [
      { label: '“출석”', sub: FL.hrAsk ? '담임 선생님의 부탁대로' : '그날 밤, 하늘이는 학교에 있었다' },
      { label: '“결석”', sub: '학교가 적으라고 했던 대로' },
      { label: '비워 둔다', sub: '아직은 쓸 수 없다' }]).then(i => {
      if (i === 0) { FL.attend = true; addDoc({ id: 'n_attend', kind: 'note' }); addClue('n_attend'); calmDown(40, '마지막 칸에 “출석”을 적었다. 십 년 만에 기록이 바로잡혔다.'); storyCalm(60); save(true); setTimeout(() => showNote(N.n_attend), 700); }
      else if (i === 1) { P.fear = Math.min(1, P.fear + .1); caption('…학교가 시킨 대로 비워 두는 건, 그날의 거짓말을 한 번 더 하는 일이다.'); }
    });
    return;
  }
  if (k === 'recorder') {
    if (p.done) { say('빈 녹음기 거치대다.', 1800); return; }
    p.done = true; giveItem('recorder', 1); sfx.click(); case5Visual();
    say('카세트가 들어 있는 녹음기다. 통화 증언을 남길 수 있겠다.', 3000); save(true); return;
  }
}
// 통화 증언을 녹음기로 남긴다 (녹음기가 없으면 다음 통화로 미룬다)
function recordTestimony(who) {
  if (!inv.recorder) { toast('🎙 녹음기가 없다', '방송실의 휴대용 녹음기가 있었다면 이 증언을 남길 수 있었을 텐데. 녹음기를 찾아 다시 전화하자.', 'info'); return false; }
  if (FL.ev_testimony) return true;
  FL.ev_testimony = true; addDoc({ id: 'n_junho_testimony', kind: 'note' }); addClue('n_junho_testimony');
  toast('🎙 증언 녹음 완료', `${who}의 실명 증언을 카세트에 담았다 (증거 ${evCount()}/${EVIDENCE5.length})`, 'info'); save(true); return true;
}
function case5Visual() {
  for (const q of world.props) { if (q.kind !== 'case5') continue;
    if (q.k === 'psafe') q.label = FL.ev_fund ? '열린 교장실 금고 (재단 서류)' : '교장실 금고 (다이얼 4자리)';
    if (q.k === 'recorder') { q.done = !!inv.recorder; if (q.mesh) q.mesh.children[0].visible = !q.done; q.label = q.done ? '빈 녹음기 거치대' : '방송부 휴대용 녹음기'; } }
}
// 새 본관에서는 이름으로 방을 찾아 놓는다 (교장실 · 3학년 2반 · 방송실)
function case5Place() {
  if (!RBG) return; const FH = 3.6, want = { psafe: ['교장실'], attend: ['3학년 2반', '3학년'], recorder: ['방송실'] };
  const rooms = new Map();
  for (let f = 0; f < 4; f++) for (let x = -45; x <= 45; x += 1.5) for (const z of [2.5, 4.5]) { const r = RBG.inside(x, z) && RBG.roomAt(x, z, f * FH + .1); if (r && r.name && !rooms.has(r.name)) rooms.set(r.name, { ...r, y: f * FH }); }
  for (const p of world.props) { if (p.kind !== 'case5' || p._c5) continue;
    const names = want[p.k]; let r = null; for (const n of names) { for (const [k, v] of rooms) if (k === n || k.startsWith(n)) { r = v; break; } if (r) break; }
    if (!r) continue;
    // 방송실 녹음기 거치대: 방 한가운데(통로)가 아니라 스튜디오 복도 쪽 벽 — 마스터 테이프장과 소품장 사이
    let spot = p.k === 'recorder' ? [r.cx - r.hw + 15.0, r.cz - r.hd + .5] : null;
    if (spot && RBG.blocked(spot[0], spot[1] + .1, r.y + .5, .15)) spot = null;
    for (let rr = .5; rr < 4 && !spot; rr += .35) for (let a = 0; a < 16 && !spot; a++) { const x = r.cx + Math.cos(a * .39) * rr, z = r.cz + Math.sin(a * .39) * rr * .7;
      if (Math.abs(x - r.cx) > r.hw - .6 || Math.abs(z - r.cz) > r.hd - .6) continue; if (!RBG.blocked(x, z, r.y, .5) && !RBG.blocked(x, z, r.y, .9)) { spot = [x, z]; break; } }
    if (!spot) continue;
    p._c5 = p._rb = true; scene.attach(p.mesh); p.mesh.position.set(spot[0], r.y, spot[1]); p.mesh.rotation.set(0, 0, 0);
    p.floor = 0; p.rbY = r.y; p.x = spot[0]; p.z = spot[1]; }
}
function setupCase5() {
  Object.assign(world.NOTES, {
    n_fund_receipt: { title: '교장실 금고 — 재단 송금 확인서 (1998.10.13)', text: '<b>[서문학원 재단 → 학교 · 긴급 집행]</b><br>• 일자: 1998년 10월 13일 (사고 다음 날)<br>• 항목: <b>“언론 대응비”</b> 3,000만 원 · <b>“유가족 합의 선지급”</b> 2,000만 원<br>• 비고: <i>“B1 관련 기록 일체 재단 보관. 교무부장 전보 조치.”</i><br><br>결재란 서명 — 교장, 재단 이사장.' },
    n_attend: { title: '3-2 출석부 — 마지막 칸', text: '<b>[1998.10.12 · 3학년 2반]</b><br>윤하늘 — <b>출석</b><br><br>십 년 만에 채워진 칸. 펜 자국 아래로, 지워진 연필 글씨가 비친다.<br><i>“결석 처리 요망 — 교무부”</i>' },
    n_junho_testimony: { title: '증언 녹음 — 이준호 (전 방송부)', text: '<b>[카세트 녹음 · 실명 증언]</b><br>“저는 1998년 10월 12일 밤, 교무부장 선생님 지시로 펌프실 철문을 잠갔습니다. 안에 하늘이가 있는 걸 알았습니다.<br>열쇠는 바로 교무부장 선생님께 드렸고, <b>‘아침에 내가 연다’</b>고 하셨습니다.<br>그 문은 아침까지 열리지 않았습니다.”<br><br>— 이준호, 서명 대신 이름을 세 번 또박또박 말했다.' },
  });
  const safeMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: .45, metalness: .7 }), dialMat = new THREE.MeshStandardMaterial({ color: 0xc8b06a, roughness: .3, metalness: .85 });
  const paperMat = new THREE.MeshStandardMaterial({ color: 0x6b3b2a, roughness: .8 }), recMat = new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: .5, metalness: .3 });
  const mk = kind => { const g = new THREE.Group();
    if (kind === 'psafe') { const b = new THREE.Mesh(new THREE.BoxGeometry(.6, .7, .55), safeMat); b.position.y = .35; g.add(b); const d = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .03, 20), dialMat); d.rotation.x = Math.PI / 2; d.position.set(.1, .45, .29); g.add(d); }
    else if (kind === 'attend') { const t = new THREE.Mesh(new THREE.BoxGeometry(.6, .72, .45), new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: .7 })); t.position.y = .36; g.add(t); const bk = new THREE.Mesh(new THREE.BoxGeometry(.32, .04, .24), paperMat); bk.position.y = .74; g.add(bk); }
    else { const t = new THREE.Mesh(new THREE.BoxGeometry(.24, .07, .14), recMat); t.position.y = .78; g.add(t); const s = new THREE.Mesh(new THREE.BoxGeometry(.5, .74, .4), new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: .6, metalness: .4 })); s.position.y = .37; g.add(s); }
    return g; };
  const freeSpot = (f, x, z) => { const cs = floors[f].col; for (let r = 0; r < 4; r += .3) for (let a = 0; a < 12; a++) { const px = x + Math.cos(a * .52) * r, pz = z + Math.sin(a * .52) * r; if (!cs.some(c => !c.off && px > c.x1 - .45 && px < c.x2 + .45 && pz > c.z1 - .45 && pz < c.z2 + .45)) return [px, pz]; } return [x, z]; };
  const place = (k, f, x, z, label) => { if (!floors[f]) return; const g = mk(k), [px, pz] = freeSpot(f, x, z); g.position.set(px, floors[f].y0, pz); floors[f].interior.add(g); world.props.push({ kind: 'case5', k, floor: f, x: px, z: pz, r: 1.4, label, mesh: g }); };
  const safe = world.props.find(q => q.kind === 'safe' && q.floor === 1) || { x: -20, z: -4 };
  place('psafe', 1, safe.x - 2.4, safe.z + .6, '교장실 금고 (다이얼 4자리)');
  place('attend', 2, 6, -4, '3-2 출석부 — 윤하늘 마지막 칸');
  place('recorder', 2, -27.5, -5.2, '방송부 휴대용 녹음기');
  case5Visual();
}

/* ----- 민아 동행: 방송실에서 깨운 뒤 사라지지 않고 플레이어를 따라다닌다 ----- */
const MINA_F = { on: false, anim: '', talkT: 40, lastFloor: -1 };
const MINA_TALK = ['…발소리, 우리 둘 것만 맞지?', '하늘 언니 방송 원고, 내가 아직 외우고 있어.', '여기 말고 B1… 거기가 끝이야. 알잖아.', '조금만 천천히 가. 숨이 차.', '정문 경비실 아저씨… 그날 밤 다 들었대.', '손전등 꺼지면 말해. 내 거 아직 남았어.', '증거 다 모이면, 방송실 콘솔 내가 같이 잡아 줄게.'];
function minaFollowStart() {
  if (!mina) return; MINA_F.on = true; FL.minaFollow = true;
  scene.attach(mina); mina.visible = true; mina.traverse(o => { if (o.material && o.material.transparent && o.material.opacity < 1) { o.material.opacity = 1; o.material.transparent = false; } });
  MINA_F.anim = ''; MINA_F.lastFloor = -1;
}
function minaPlay(n) { if (MINA_F.anim === n) return; MINA_F.anim = n; if (npcVisuals.has(mina)) npcVisuals.play(mina, n, { fade: .25 }); }
function minaFollowTick(dt) {
  if (!MINA_F.on || !mina) return;
  const fy = (floors[P.floor]?.y0 || 0) + (P.sh || 0), bx = P.x + Math.sin(P.yaw) * 1.5, bz = P.z + Math.cos(P.yaw) * 1.5;
  const dx = bx - mina.position.x, dz = bz - mina.position.z, d = Math.hypot(dx, dz), dp = Math.hypot(P.x - mina.position.x, P.z - mina.position.z);
  if (MINA_F.lastFloor !== P.floor || Math.abs(mina.position.y - fy) > 1.6 || dp > 14) { mina.position.set(bx, fy, bz); MINA_F.lastFloor = P.floor; minaPlay('Idle'); return; }
  mina.position.y += (fy - mina.position.y) * Math.min(1, dt * 8);
  if (dp > 1.9 && d > .25) { const sp = dp > 5 ? 3.8 : 1.6, st = Math.min(d, sp * dt); mina.position.x += dx / d * st; mina.position.z += dz / d * st; mina.rotation.y = Math.atan2(dx, dz); minaPlay(dp > 5 ? 'Run' : 'Walk'); }
  else { minaPlay(ghost.active && ghost.floor === P.floor ? 'ScaredIdle' : 'Idle'); const ty = Math.atan2(P.x - mina.position.x, P.z - mina.position.z); mina.rotation.y += Math.atan2(Math.sin(ty - mina.rotation.y), Math.cos(ty - mina.rotation.y)) * Math.min(1, dt * 4); }
  if (state === 'playing' && !isSpeechBusy() && (MINA_F.talkT -= dt) <= 0) { MINA_F.talkT = 70 + Math.random() * 60; subtitle('민아', MINA_TALK[(Math.random() * MINA_TALK.length) | 0], 3.4); }
}
/* ----- 방송실 주조정 콘솔: 전원 → 앰프 예열 → 송출 구역 → 마이크 페이더 → (테이프) → ON AIR ----- */
const BC = { power: false, amp: 0, ch: '', fader: 0, tape: false, raf: 0, hum: null };
const BC_CH = [['all', '교내 전체'], ['main', '본관'], ['annex', '별관'], ['yard', '운동장'], ['dorm', '청운학사']];
function bcHum(on) {
  try { const ac = sfxCtx; if (!ac || !ac.createOscillator) return;
    if (on && !BC.hum) { const g = ac.createGain(); g.gain.value = 0; g.connect(ac.destination); const o1 = ac.createOscillator(), o2 = ac.createOscillator(); o1.frequency.value = 60; o2.frequency.value = 120; o2.type = 'triangle'; o1.connect(g); o2.connect(g); o1.start(); o2.start(); g.gain.setTargetAtTime(.035, ac.currentTime, .4); BC.hum = { g, o1, o2 }; }
    if (!on && BC.hum) { const h = BC.hum; BC.hum = null; h.g.gain.setTargetAtTime(0, ac.currentTime, .15); setTimeout(() => { try { h.o1.stop(); h.o2.stop(); } catch (e) { /* stopped */ } }, 600); }
  } catch (e) { /* 오디오 없음 */ }
}
function bcSqueal() { try { const ac = sfxCtx, o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(2400, ac.currentTime); o.frequency.linearRampToValueAtTime(3100, ac.currentTime + .9); g.gain.setValueAtTime(.0, ac.currentTime); g.gain.linearRampToValueAtTime(.08, ac.currentTime + .15); g.gain.linearRampToValueAtTime(0, ac.currentTime + 1); o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 1.05); } catch (e) { /* 오디오 없음 */ } }
function bcRender() {
  const box = $('anxBody'), ok = BC.power && BC.amp >= 1 && BC.ch === 'all' && BC.fader >= 60;
  const led = on => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;background:${on ? '#4f4' : '#422'};box-shadow:${on ? '0 0 8px #4f4' : 'none'}"></span>`;
  box.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
   <div style="background:#141816;border:1px solid #445;padding:10px;border-radius:6px"><b>① 메인 전원</b><div style="margin:8px 0">${led(BC.power)}${BC.power ? 'AC 220V 입력' : '꺼짐'}</div><button id="bcPow">${BC.power ? '전원 끄기' : '전원 켜기'}</button></div>
   <div style="background:#141816;border:1px solid #445;padding:10px;border-radius:6px"><b>② 파워 앰프</b><div style="margin:8px 0">${led(BC.amp >= 1)}${BC.amp >= 1 ? '예열 완료' : BC.amp > 0 ? `예열 중 ${Math.round(BC.amp * 100)}%` : '대기'}</div><div style="height:6px;background:#222"><div style="height:6px;width:${BC.amp * 100}%;background:#c93"></div></div><button id="bcAmp" style="margin-top:6px" ${BC.power ? '' : 'disabled'}>앰프 ON</button></div>
   <div style="background:#141816;border:1px solid #445;padding:10px;border-radius:6px;grid-column:1/3"><b>③ 송출 구역</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${BC_CH.map(([k, n]) => `<button data-ch="${k}" style="${BC.ch === k ? 'background:#2f5a44' : ''}">${n}</button>`).join('')}</div></div>
   <div style="background:#141816;border:1px solid #445;padding:10px;border-radius:6px"><b>④ 마이크 페이더</b><input id="bcFad" type="range" min="0" max="100" value="${BC.fader}" style="width:100%"><canvas id="bcMeter" width="260" height="22" style="width:100%;background:#000"></canvas><button id="bcTest">마이크 테스트</button></div>
   <div style="background:#141816;border:1px solid #445;padding:10px;border-radius:6px"><b>⑤ 카세트 데크</b><div style="margin:8px 0">${led(BC.tape)}${FL.tag ? '명찰 녹음 테이프 장착' : '빈 데크'}</div><button id="bcTape" ${BC.power ? '' : 'disabled'}>${BC.tape ? '■ 정지' : '▶ 재생 대기'}</button></div>
  </div>
  <div style="margin-top:12px;display:flex;align-items:center;gap:12px"><button id="bcAir" ${ok ? '' : 'disabled'} style="font-size:18px;padding:10px 22px;background:${ok ? '#a01818' : '#3a2222'};color:#fff;border-radius:6px">● ON AIR</button>
  <span style="font-size:12px;opacity:.8">${ok ? (FL.tag ? '폭로 방송 준비 완료 — 그날 밤의 진실을 송출한다' : '교내 방송 송출 가능') : '전원 · 앰프 예열 · 교내 전체 · 페이더 60 이상'}</span></div>`;
  $('bcPow').onclick = () => { BC.power = !BC.power; if (!BC.power) { BC.amp = 0; BC.tape = false; bcHum(false); } else { sfx.clank ? sfx.clank() : sfx.click(); } sfx.click(); bcRender(); };
  $('bcAmp').onclick = () => { if (!BC.power || BC.amp > 0) return; sfx.click(); bcHum(true); BC.amp = .01; bcRender(); };
  box.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => { BC.ch = b.dataset.ch; sfx.beep(); bcRender(); });
  $('bcFad').oninput = e => { BC.fader = +e.target.value; if (BC.fader > 92 && BC.amp >= 1) bcSqueal(); };
  $('bcFad').onchange = () => bcRender();
  $('bcTest').onclick = () => { if (!BC.power || BC.amp < 1) { say('앰프가 켜져 있지 않다', 1400); return; } if (BC.fader > 85) { bcSqueal(); say('하울링! 페이더를 조금 내리자', 1600); } else { sfx.beep(); setTimeout(() => sfx.beep(), 180); } };
  $('bcTape').onclick = () => { BC.tape = !BC.tape; sfx.click(); if (BC.tape) sfx.staticNoise?.(.5); bcRender(); };
  $('bcAir').onclick = () => { closeUI(); bcHum(false); bcOnAir(); };
}
function bcLoop() {
  if (anxView !== 'bcast' || !$('annexOv').classList.contains('show')) { cancelAnimationFrame(BC.raf); BC.raf = 0; bcHum(false); return; }
  if (BC.amp > 0 && BC.amp < 1) { BC.amp = Math.min(1, BC.amp + .008); if (BC.amp >= 1) { sfx.beep(); bcRender(); } }
  const c = $('bcMeter'); if (c) { const g = c.getContext('2d'), lv = BC.power && BC.amp >= 1 ? BC.fader / 100 * (.55 + Math.random() * .45) : 0; g.fillStyle = '#000'; g.fillRect(0, 0, 260, 22); for (let i = 0; i < 26; i++) { if (i / 26 > lv) break; g.fillStyle = i > 21 ? '#f33' : i > 16 ? '#fc3' : '#3f6'; g.fillRect(i * 10 + 1, 3, 8, 16); } }
  BC.raf = requestAnimationFrame(bcLoop);
}
function bcOnAir() { if (FL.tag) { haneulBroadcast(); return; } useProp({ kind: 'bcOnAir' }); }
function bcOpen() { anxView = 'bcast'; $('anxTitle').textContent = '방송실 주조정 콘솔'; openUI('annexOv'); bcRender(); cancelAnimationFrame(BC.raf); BC.raf = requestAnimationFrame(bcLoop); }

async function useProp(p) {
  if (p.kind === 'ganx') return useAnnex(p);
  if (p.kind === 'case5') return useCase5(p);
  if (p.kind === 'b1door') {
    if (FL.b1Open) { say('철문은 열려 있다. 아래에서 차가운 물 냄새가 올라온다.', 2400); return; }
    if (!got[0]) { sfx.clank(); at(0, floors[4].y0 + 1.1, -1.6).doorBang(0, .8); shake = .25; say('쇠사슬과 자물쇠로 묶인 철문이다. 꼬리표 『교무실 관리 · B-07』 — 열쇠 꾸러미는 본관 1층 교무실 금고 안에 있다 (번호: 참사 당일 날짜).', 4200); addClue && CLUES.b1lock && addClue('b1lock'); return; }
    triggerInteractAnim('heavy'); sfx.unlock(); setTimeout(() => sfx.gateClang(), 400); B1D && B1D.open(); p.label = '열린 철문';
    toast('🔓 지하 B1 철문', '교무실 금고에서 나온 열쇠 꾸러미 중 하나가 맞았다. 자물쇠가 떨어지고 쇠사슬이 풀렸다.', 'info'); save(true); return;
  }
  if (p.kind === 'gradio' || p.kind === 'glog') {   // 경비실: 누를 때마다 다음 교신 · 다음 일지 장으로
    const radio = p.kind === 'gradio', id = (radio ? 'gd_radio' : 'gd_log') + (p.n % 3 + 1); p.n++;
    stopSpeak(); radio ? sfx.staticNoise(.6) : sfx.paper(); storyCalm(30);
    if (radio && p.led) p.led.material.color.setHex(0xff3020);
    setTimeout(() => line(id, radio ? 'radio' : 'none', '🔦 당직 경비원 · 박종철 (1998)').then(() => { if (radio && p.led) p.led.material.color.setHex(0x401010); }), 250);
    p.label = radio ? `경비 무전기 — 다음 교신 듣기 (${p.n % 3 + 1}/3)` : `경비 근무 일지 — 다음 장 (${p.n % 3 + 1}/3)`;
    if (radio && !guardGift) { guardGift = true; inv.battery += 2; sfx.pickup(); toast('건전지 2개', '무전기 옆 서랍에 손전등용 건전지가 남아 있었다', 'info'); }
    if (!docs.find(d => d.id === id)) { addDoc({ id, kind: 'tape' }); if (CLUES[id]) addClue(id); refreshHud(); toast(radio ? '📻 1998.10.12 경비 무전 교신' : '📒 경비 근무 일지', world.TAPES[id]?.title || '', 'info'); }
    return;
  }
  if (p.kind === 'look') { const msg = p.fn(p); if (msg) say(msg, 3200); return; }
  triggerPropAnim(p);
  if (p.kind === 'fz') { fzUse(p); return; }   // 사용자 패치(5대 구역 · 실내 연결복도) 상호작용
  if (p.kind === 'switch') { flipSwitch(p, !p.on, true); return; }
  if (p.kind === 'elevator') { elvCall(p); return; }
  if (p.kind === 'elBtn') { elvPress(p); return; }
  if (p.kind === 'robj') { useRoomObj(p); return; }
  if (p.kind === 'guardnpc') { talkGuard(p); return; }
  if (p.kind === 'sq') { p.main ? useHead(p) : useSideQuest(p); return; }
  if (p.kind === 'search') { startSearch(p); return; }
  if (p.kind === 'ldoor') { lockerDoorToggle(p); return; }
  if (p.kind === 'mspot') { useMiniSpot(p); return; }
  if (p.kind === 'clue') { readMemory(p); return; }
  if (p.kind === 'cctvRec') { p.label = 'CCTV 다시 보기'; sfx.staticNoise(1.2); fx.glitch(.5); showNote({ title: 'CCTV 녹화 — 10.12 23:31 · B1 복도', img: 'b1_corr', text: '정지 화면이 지직거린다. 복도 끝 <b>배수실</b> 쪽에서 누군가 바닥의 <b>철제 덮개</b>를 끌어 덮고 있다.<br>23:33 — 화면이 검게 끊긴다. 마지막 프레임, 렌즈 바로 앞에 젖은 손바닥 자국.' }); addClue('cctv'); return; }
  if (p.kind === 'footprints') { p.done = true; poolFlashback(); return; }
  if (p.kind === 'safe') {
    if (p.open > 0) return;
    kpProp = p; kpBuf = '';++keypadSequence;kpOpening=false; $('kpTitle').textContent = '교무실 금고'; if (!p.fails) $('kpHint').textContent = '숫자 키 · Enter · Backspace 사용 가능'; renderKeypad(); openUI('keypad'); sfx.beep();
  } else if (p.kind === 'sink') { useSink(p);
  } else if (p.kind === 'flush') { useFlush(p);
  } else if (p.kind === 'cbreaker') { useCBreaker(p);
  } else if (p.kind === 'pick') { usePick(p);
  } else if (p.kind === 'breaker') {
    if (!FL.fuse) { sfx.click(); talk('needFuse', 3200); say('퓨즈 홀더가 비어 있다 — 예비 퓨즈가 필요하다', 2800); addClue('fuse'); return; }
    if (!p.fused) { sfx.fuse(); p.fused = true; toast('퓨즈를 끼웠습니다', '배선을 이어 전원을 살려라'); }
    const r = await mini('circuit', { title: '주 차단기 — 배선 연결' }); if (!r.ok) return;
    p.on = true; p.done = true; power = true; sfx.breaker(); shake = .5; P.noiseT = 2.5;
    blackout = Math.max(blackout, .7); GEN.dip = null; GEN.t = 160; setTimeout(() => { sfx.lightOn(); caption('발전기가 멈추고 본전원으로 넘어갔다 — 형광등이 하얗게 안정된다'); }, 800);
    toast('전력이 복구되었습니다', '4층 방송실 장비를 쓸 수 있다. 큰 소리가 났다…', 'warn');
    talk('breaker', 3200); addClue('power'); refreshHud();
    
  } else if (p.kind === 'tape') {
    sfx.tape(); p.label = '녹음기 다시 재생'; storyCalm(40);
    stopSpeak();
    setTimeout(() => line(p.id, 'radio', '📼 ' + p.spk), 250);
    if (!docs.find(d => d.id === p.id)) { addDoc({ id: p.id, kind: 'tape' }); toast('📼 녹음 테이프 재생 — ' + p.spk, p.title + ' (하단 자막 및 성우 육성 재생 중)', 'info'); if (CLUES[p.id]) addClue(p.id); if (p.id === 'tape4' || p.id === 'tape2') unlockOptional(); refreshHud(); }
  } else if (p.kind === 'bell') {
    if (p.cd > 0) { sfx.click(); say('벨이 아직 울리지 않는다…', 1500); return; }
    p.cd = 60; at(p.bx, floors[p.floor].y0 + 1.5, p.bz).bell(); P.noiseT = 1; shake = .25;
    toast('비상벨', '빈 교실마다 같은 종소리가 돌아온다. 응답은 없다.', 'warn');
    if (ghost.active) {
      if (ghost.floor !== p.floor) { const sz = floors[p.floor].stairZone; ghost.floor = p.floor; ghost.x = sz ? sz.spawn.x : 2.2; ghost.z = sz ? sz.spawn.z : -5.2; ghost.spawnGrace = 2; }
      ghost.state = 'search'; ghost.target = { x: p.bx, z: p.bz + .8 }; ghost.path = []; ghost.replan = 0; ghost.wait = 0; ghost.lureT = 20; ghost.hunt = null;
    }
  } else if (p.kind === 'console') {
    if (!power) { sfx.click(); talk('needPower', 3200); say('전원이 들어오지 않는다. 지하 전기실의 차단기를 올려야 한다.', 2800); return; }
    if (FL.calm) { say('스피커는 이제 조용하다.', 2000); return; }
    if (consoleCD > 0 && !FL.tag) { sfx.buzz(); say(`장비가 과열됐다… (${Math.ceil(consoleCD)}초)`, 2000); return; }
    bcOpen(); return;
  } else if (p.kind === 'bcOnAir') {
    consoleCD = 90; sfx.broadcast(); setTimeout(() => line('pa1', 'pa'), 800);
    toast('교내 방송', '빈 교실의 스피커에서 같은 문장이 반복된다', 'warn');
    talk('lure', 3200); if (FL.opt) setTimeout(() => talk('needTag', 3400), 5200);
    if (ghost.active) { ghost.floor = 2; ghost.x = -24; ghost.z = -5.5; ghost.state = 'search'; ghost.target = { x: -24, z: -5.5 }; ghost.path = []; ghost.lureT = 25; ghost.spawnGrace = 2; ghost.hunt = null; }
  } else if (p.kind === 'lock') openLock(p);
  else if (p.kind === 'drain') {
    if (!FL.hook) { talk('needHook', 3400); say(FL.mop && FL.wire ? '대걸레 자루와 철사가 있다 — 소지품(Tab)에서 조합해 갈고리를 만들자' : `손이 닿지 않는다 — 갈고리 재료: ${FL.mop ? '' : '대걸레 자루(지하 청소도구실) '}${FL.wire ? '' : '철사(별관 1층 기술·가정실)'}`, 4200); if (!FL.mop || !FL.wire) toast('갈고리 재료', '목표 안내와 지도(M)에 재료 위치를 표시했다', 'info'); if (!docs.some(d => d.id === 'n20')) toast('단서', '수영장 감시대 위 메모를 확인해 보자', 'info'); return; }
    const r = await mini('fishing', {}); if (!r.ok) { say('갈고리가 미끄러졌다… 다시 해 보자', 2000); return; }
    p.done = true; sfx.splash(); const it = world.items.find(i => i.kind === 'key' && i.idx === 4);
    it.locked = false; setTarget({ type: 'item', it, label: '' }); interact();
  } else if (p.kind === 'passSwitch') { usePassSwitch();
  } else if (p.kind === 'roofDoor') { roofDoor(!!p.roof);
  } else if (p.kind === 'megaRadio') { const ok = await megaMini('radio'); if (ok) { megaP.advanceStoryAct(2, m => megaNotify(m)); if (!p.got) { p.got = true; giveItem('battery', 1, true); } say('98.4MHz — 잡음 너머로 목소리: “교장실 괘종시계… 자정… 금고…”', 4200); }
  } else if (p.kind === 'piano') {
    const r = await mini('piano', { melody: [4, 4, 5, 5, 4, 4, 2], sheet: (docs.some(d => d.id === 'n18') || (p.fails || 0) >= 2) ? '솔 솔 라 라 솔 솔 미' : null, onFail: () => { p.fails = (p.fails || 0) + 1; } });
    if (!r.ok) return;
    p.done = true; sfx.drip(); talk('pianoOk', 3000); inv.battery++; inv.hairpin++; newItems.add('hairpin');
    addDoc({ id: 'p4', kind: 'photo' }); addClue('piano'); unlockOptional();
    toast('피아노 속 숨은 칸', '사진 — 방송부 앨범 · 건전지 · 머리핀'); refreshHud(); save(true);
    setTimeout(() => { if (state === 'playing') showNote({ ...world.PHOTOS.p4, kind: 'photo' }); }, 900);
  } else if (p.kind === 'easel') {
    const r = await mini('sketchLine', { img: 'assets/img/old_lab.webp', title: '🎨 미술실 이젤 — 1998 과학실 목탄 크로키 선긋기 복원' });
    if (!r.ok) return;
    p.done = true; talk('slideOk', 3000); inv.medkit++; newItems.add('medkit'); addDoc({ id: 'p5', kind: 'photo' }); unlockOptional();
    toast('그림 뒤에서', '사진 — 과학실 (10년 전) · 응급 밴드'); refreshHud(); save(true);
    setTimeout(() => { if (state === 'playing') showNote({ ...world.PHOTOS.p5, kind: 'photo' }); }, 900);
  } else if (p.kind === 'phone') {
    p.done = true; p.ring = false; sfx.click(); fx.glitch(.5); shake = .3;
    say('📞 수화기 너머엔 테이프가 늘어지는 듯한 잡음뿐 — 누군가 방송실 회선에 녹음기를 물려 둔 것 같다', 3200); setTimeout(() => { if (state === 'playing') talk('steps', 2400); }, 3400);
  } else if (p.kind === 'mina') {
    npcVisuals.portrait('mina', '민아 · 방송부장', 4500);
    if (!docs.some(d => d.id === 'n_timer')) { addDoc({ id: 'n_timer', kind: 'note' }); addClue('n_timer'); }
    if (!FL.calm) {
      talk(p.tried ? 'minaAsleep' : 'minaFound', 3200); p.tried = true; say('숨은 쉬고 있다… 무언가가 아직 그녀를 붙잡고 있다.', 3000); unlockOptional();
      if (npcVisuals.has(mina)) { npcVisuals.setExpression(mina, 'Pain', .6); setTimeout(() => npcVisuals.setExpression(mina, 'Pain', 0), 1800); }   // 잠결에 얼굴을 찌푸린다
      return;
    }
    p.done = true; FL.mina = true; sfx.paper();
    line(`mw_${CK()}`, 'none', '민아').then(sec => setTimeout(() => { talk('withMina', 3000); }, (sec + .5) * 1000));
    minaWake(); addClue('mina'); toast('민아를 찾았습니다', '함께 정문으로 — 진 엔딩 조건 달성', 'opt'); refreshHud(); save(true);
  }
}
// 진 엔딩 루트: 명찰을 가진 채 방송 → 학교 은폐를 폭로하는 방송 → 그것이 사라진다
async function haneulBroadcast() {
  const epoch=storySession, current=()=>epoch===storySession&&['playing','ui','note'].includes(state);
  if(voBusy)return;
  voBusy=true;
  try {
    if(!FL.tapesDone){
      const r=await mini('order',{title:'마지막 방송 — 그날 밤의 녹음 복원',frags:TAPE_FRAGS,showTimes:tlKnown()>=6,onFail:()=>{FL.tapeFails=(FL.tapeFails||0)+1;}});
      if(!current())return;
      if(!r.ok){say('시간이 맞지 않는다. 사건 연표의 기록을 다시 비교해 보자',2800);return;}
      FL.tapesDone=true;
    }
    if(!current())return;
    FL.calm=true;consoleCD=999;sfx.broadcast();storyCalm(40);refreshHud();save(true);
    toast('방송 복원','기록 속 이름과 시간이 이어졌다. 장비실의 선배를 확인하자','opt');
    await wait(900);if(!current())return;
    const sec=await line(`bc_${CK()}`,'pa',`📢 ${CH().name}`);
    await wait((sec+.8)*1000);if(!current())return;
    ghost.active=false;ghost.enraged=false;ghost.hunt=null;
    const thanks=await line('ghThanks','phone','📞 하늘이 어머니');
    await wait((thanks+.6)*1000);if(!current())return;
    talk('calm',3200);addClue('calm');refreshHud();save(true);
    toast('방송 복원 완료','꺼지지 않던 방송이 멎고, 기억 속 교실이 조용해졌다','opt');
    setTimeout(()=>{if(state==='playing'&&!CALL.talking&&!(FL.calls&&FL.calls.haneul)){CALL.ring=null;callRing({id:'haneul',who:'하늘이 어머니',num:'010-****-1012',lines:['call_hn1','call_hn2']});}},38000);
  } finally {if(epoch===storySession)voBusy=false;}
}
// 민아 깨우기: 3D 모델이면 깨어남(이마 짚기 · 두리번) → 일어서기 → 안도 표정 뒤 사라짐. 아니면 바로 사라짐
async function minaWake() {
  if (!npcVisuals.has(mina)) { minaFollowStart(); return; }
  const E = (n, v) => npcVisuals.setExpression(mina, n, v);
  E('Asleep', 0); mina.userData.noBlink = false; E('Pain', .55);
  await npcVisuals.play(mina, 'Recovery', { once: true, fade: .4 });
  E('Pain', 0); E('Sad', .35);
  await npcVisuals.play(mina, 'StandUp', { once: true, fade: .25 });
  E('Sad', 0); E('Relief', .8); npcVisuals.play(mina, 'Idle', { fade: .4 });
  setTimeout(() => minaFollowStart(), 1600);   // 사라지지 않고 같이 다닌다
}
function fadeOut(obj, sec) {
  const ms = []; obj.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; ms.push(o.material); } });
  let t = 0; const iv = setInterval(() => { t += .05; ms.forEach(m => { m.opacity = Math.max(0, 1 - t / sec); }); if (t >= sec) { clearInterval(iv); obj.visible = false; } }, 50);
}
function renderKeypad() {
  const d = $('kpDisp'); d.textContent = (kpBuf + '____').slice(0, 4).split('').join(' '); d.className = '';
}
function keypadPress(k) {
  if(kpOpening)return;
  if (k === 'C') { kpBuf = ''; sfx.beep(); renderKeypad(); return; }
  if (k === 'OK') return keypadCheck();
  if (kpBuf.length < 4) { kpBuf += k; sfx.beep(); renderKeypad(); if (kpBuf.length === 4) {const sequence=keypadSequence,epoch=storySession;setTimeout(()=>{if(sequence===keypadSequence&&epoch===storySession)keypadCheck();},250);} }
}
function keypadCheck() {
  if(kpOpening||!kpProp||kpBuf.length!==4||state!=='ui')return;
  const sequence=keypadSequence,epoch=storySession,targetPad=kpProp,current=()=>sequence===keypadSequence&&epoch===storySession&&kpProp===targetPad&&state==='ui';
  if (kpProp.code) {   // 제4장 별관 진열장 (전자식 잠금)
    const p = kpProp.prop;
    if (kpBuf === kpProp.code) { kpOpening=true;$('kpDisp').textContent = 'O P E N'; $('kpDisp').className = 'ok'; sfx.unlock(); const done = kpProp.onOpen || headAdvance; setTimeout(() => { if(!current())return;closeUI();done(p); }, 700); return; }
    $('kpDisp').textContent = 'E R R'; $('kpDisp').className = 'err'; sfx.buzz(); kpBuf = ''; setTimeout(()=>{if(current())renderKeypad();}, 700);
    p.fails = (p.fails || 0) + 1;
    if (kpProp.hints) { $('kpHint').innerHTML = kpProp.hints[Math.min(2, p.fails - 1)]; return; }
    $('kpHint').innerHTML = p.fails >= 3 ? '힌트 ③ 머릿돌: 1974년 <b>3월 2일</b> 개교 → 0 3 0 2' : p.fails === 2 ? '힌트 ② 별관 현관의 <b>개교 머릿돌</b> — 월일 4자리' : '힌트 ① 교장 수첩: 잠금 번호는 <b>“이 학교가 태어난 날”</b>';
    return;
  }
  if (kpBuf === '1012') {
    kpOpening=true;
    $('kpDisp').textContent = 'O P E N'; $('kpDisp').className = 'ok'; sfx.unlock();
    setTimeout(() => { if(!current())return;closeUI();targetPad.opening = true; targetPad.done = true; targetPad.key.locked = false; targetPad.key.mesh.visible = true; toast('금고가 열렸다', '안에 열쇠 조각이 있다'); talk('safeOpen', 3000); addClue('safe'); }, 700);
  } else {
    $('kpDisp').textContent = 'E R R'; $('kpDisp').className = 'err'; sfx.buzz(); kpBuf = '';
    setTimeout(()=>{if(current())renderKeypad();}, 700);
    kpProp.fails = (kpProp.fails || 0) + 1;
    if (kpProp.fails === 1) setTimeout(() => {if(current())talk('safeHint',3000);},900);
    $('kpHint').innerHTML = kpProp.fails >= 3 ? '힌트 ③ 달력의 붉은 동그라미 — <b>10월 12일</b> → 1 0 1 2' : kpProp.fails === 2 ? '힌트 ② 교무회의록: 비밀번호는 <b>그날의 날짜</b> (월일 4자리)' : '힌트 ① 그날… 무슨 날이었지? 교무실 어딘가에 기록이 있을 것이다';
  }
}
function keypadKey(e) {
  if (e.code === 'Escape' || e.code === 'Tab') { closeUI(); return; }
  if (/^(Digit|Numpad)\d$/.test(e.code)) keypadPress(e.code.slice(-1));
  else if (e.code === 'Backspace') { kpBuf = kpBuf.slice(0, -1); renderKeypad(); }
  else if (e.code === 'Enter' || e.code === 'NumpadEnter') keypadCheck();
}
document.querySelectorAll('#kpGrid button').forEach(b => b.onclick = () => keypadPress(b.dataset.k));
$('kpClose').onclick = () => closeUI();

/* ---------- 스크립트 이벤트 ---------- */
// 환영: 유령과 같은 모델이지만 해치지 않는다. 잠깐 보였다 사라진다.
const appar = ghost.group.clone(true); appar.visible = false; scene.add(appar);
let apparT = 0, apparWatch = null;
function showApparition() {}   // 귀신 삭제: 환영도 나타나지 않는다
const EV = { done: new Set(), t: 0, inRoom: null, roomT: 0, slamCD: 60, b33T: 0, b33: 0, corrT: 0 };
const evOnce = (id, fn) => { if (EV.done.has(id)) return false; EV.done.add(id); fn(); return true; };
function roomAt(f, x, z) {
  if (typeof RBG !== 'undefined' && RBG && f === 0 && RBG.inside(x, z)) return RBG.roomAt(x, z, P.sh || 0);   // 새 건물: 예전 방 배치 대신 새 본관 · 별관 방 (층 높이로)
  // 본관 남쪽 방 줄 (복도 남쪽, z 1.75 ~ 9.6)
  if (z > 1.8 && z < MAIN_ZS - .3 && f >= 0 && f <= 2) { const i = SLOTS.findIndex(c => Math.abs(x - c) < 4); if (i < 0) return null; const L = LAYOUT_S[f]; return { type: L.types[i], name: L.names[i], cx: SLOTS[i], id: f + ':s' + i, south: true }; }
  if (z > 1.8 && z < MAIN_ZS - .3 && f >= 8 && f <= 10) { const i = ANNEX.slots.findIndex(c => Math.abs(x - c) < 4); if (i < 0) return null; const L = ANNEX_S[f - 8]; return { type: L.types[i], name: L.names[i], cx: ANNEX.slots[i], id: f + ':s' + i, south: true }; }
  if (z > -1.8 || z <= -9.6) return null;
  const an = f >= 8 && f <= 10, sl = an ? ANNEX.slots : SLOTS, lay = an ? ANNEX.floors[f - 8] : LAYOUT[f];
  if (!lay || (f > 4 && !an)) return null;
  const i = sl.findIndex(c => Math.abs(x - c) < 4); if (i < 0) return null;
  return { type: lay.types[i], name: lay.names[i], cx: sl[i], id: f + ':' + i };
}
// 민아의 음성 메시지 — 휴대폰(P) 메시지함에 쌓인다
window.__playPhoneMsg = id => {
  if (!id || !VO[id]) return;
  const m = msgs.find(x => x.id === id);
  if (m) m.read = true;
  stopSpeak();
  sfx.beep && sfx.beep();
  line(id, 'phone', '📱 선배 박민아 (음성 메시지)');
  refreshHud();
  if (state === 'ui' && phoneTab === 'msg') renderPhone();
};
function phoneMessage(n,epoch=storySession) {
  if(epoch!==storySession||['won','dead'].includes(state))return;
  const id = 'phone' + n;
  if (msgs.some(m => m.id === id) || (n === 3 && FL.calm)) return;
  msgs.push({ id, t: clockText(), read: false }); storyCalm(35); sfx.phone(); if (n === 0) sfx.vibrate();
  // 자동 음성 재생을 하지 않고(메인 대사 겹침 방지!), 휴대폰(P) 메시지 UI에서 클릭할 때만 재생되도록 안내
  toast('📱 새 음성 메시지 도착 — 민아 선배', '자동 재생 안 됨 · 휴대폰(P 또는 1) › [메시지] 탭에서 클릭하여 음성 듣기', 'info');
  if (CLUES[id]) addClue(id);
  if (n === 2) unlockOptional();
  refreshHud();
}
const INT_ANIM = { t: 0, dur: 0.42, kind: 'reach', dipY: 0, pitchAdd: 0, rollAdd: 0, reachK: 0 };
function triggerInteractAnim() {
  INT_ANIM.t = 0; INT_ANIM.dipY = INT_ANIM.pitchAdd = INT_ANIM.rollAdd = INT_ANIM.reachK = 0;
}
function triggerPropAnim(p) {
  if (!p) return;
  const py = p.y ?? 1.0;
  triggerInteractAnim(py < 0.75 ? 'low' : (p.kind === 'safe' || p.kind === 'breaker' || p.k === 'bunker_audit') ? 'heavy' : 'reach');
  const a = p.anim; if (!a) return;
  a.active = !a.active; a.t = 0;
  if (a.type === 'tape') { a.playT = 18.5; if (a.playBtn) a.playBtn.position.y = 0.066; }
  else if (a.type === 'copier') { a.playT = 2.6; if (a.scanBar) { a.scanBar.visible = true; a.scanBar.position.x = -0.09; } if (a.paperOut) { a.paperOut.visible = true; a.paperOut.position.z = 0.08; } }
  else if (a.type === 'water') { a.playT = 3.2; if (a.stream) { a.stream.visible = true; a.stream.material.color.setHex(0x8a6a48); } }
  else if (a.type === 'chem') { a.playT = 4.0; }
  else if (a.type === 'phone') { a.playT = 5.5; }
  else if (a.type === 'orrery') { a.playT = 8.0; }
}
function updatePropAnims(dt) {
  if (INT_ANIM.t > 0) {
    INT_ANIM.t = Math.max(0, INT_ANIM.t - dt);
    const ph = 1 - INT_ANIM.t / INT_ANIM.dur;
    const s = Math.sin(ph * Math.PI);
    INT_ANIM.reachK = s;
    if (INT_ANIM.kind === 'low') { INT_ANIM.dipY = -0.18 * s; INT_ANIM.pitchAdd = -0.14 * s; INT_ANIM.rollAdd = 0.015 * s; }
    else if (INT_ANIM.kind === 'heavy') { INT_ANIM.dipY = -0.05 * s; INT_ANIM.pitchAdd = 0.05 * Math.sin(ph * Math.PI * 2); INT_ANIM.rollAdd = -0.025 * s; }
    else { INT_ANIM.dipY = -0.025 * s; INT_ANIM.pitchAdd = -0.035 * s; INT_ANIM.rollAdd = 0.018 * s; }
  } else {
    INT_ANIM.dipY = INT_ANIM.pitchAdd = INT_ANIM.rollAdd = INT_ANIM.reachK = 0;
  }
  for (let i = 0; i < world.props.length; i++) {
    const p = world.props[i];
    if (p.kind === 'safe' && p.opening) {
      if (p.open < 1) p.open = Math.min(1, p.open + dt * 1.25);
      if (p.piv) p.piv.rotation.y = easeOut(p.open) * 1.95;
    }
    if (p.kind === 'breaker' && p.lev) {
      const tz = p.on ? -0.45 : -2.4;
      p.lev.rotation.z += (tz - p.lev.rotation.z) * Math.min(1, dt * 10);
    }
    if (p.kind === 'bell' && p.cd > 0) p.cd -= dt;
    const a = p.anim; if (!a || p.floor !== P.floor) continue;
    a.t += dt;
    if (a.type === 'tape') {
      if (a.playT > 0) {
        a.playT = Math.max(0, a.playT - dt);
        if (a.reelL) a.reelL.rotation.y -= dt * 4.8;
        if (a.reelR) a.reelR.rotation.y -= dt * 4.2;
        if (a.led) { const pulse = 0.65 + 0.35 * Math.sin(tNow * 14); if (a.led.scale) a.led.scale.setScalar(0.11 + pulse * 0.04); }
        if (a.playT <= 0 && a.playBtn) a.playBtn.position.y = 0.076;
      }
    } else if (a.type === 'med' && a.doorPiv) {
      const targetY = (a.active || p.done) ? -1.35 : 0;
      a.doorPiv.rotation.y += (targetY - a.doorPiv.rotation.y) * Math.min(1, dt * 8);
    } else if (a.type === 'hinge' && a.doorPiv) {
      const targetY = (a.active || p.got) ? (a.openAngle || 1.45) : 0;
      a.doorPiv.rotation.y += (targetY - a.doorPiv.rotation.y) * Math.min(1, dt * 8);
    } else if (a.type === 'lid' && a.lidPiv) {
      const targetX = (a.active || p.got) ? (a.openAngle || -1.45) : 0;
      a.lidPiv.rotation.x += (targetX - a.lidPiv.rotation.x) * Math.min(1, dt * 8);
    } else if (a.type === 'cards' && a.drawer) {
      const targetZ = a.active ? 0.45 : 0.305;
      a.drawer.position.z += (targetZ - a.drawer.position.z) * Math.min(1, dt * 9);
    } else if (a.type === 'phone' && a.handset) {
      if (a.playT > 0) a.playT = Math.max(0, a.playT - dt);
      const on = a.playT > 0;
      a.handset.position.z += ((on ? 0.17 : 0.09) - a.handset.position.z) * Math.min(1, dt * 8);
      a.handset.position.y += ((on ? 0.04 : 0) - a.handset.position.y) * Math.min(1, dt * 8);
      a.handset.rotation.z += ((on ? -0.32 : 0) - a.handset.rotation.z) * Math.min(1, dt * 8);
    } else if (a.type === 'copier') {
      if (a.playT > 0) {
        a.playT = Math.max(0, a.playT - dt);
        const k = 1 - a.playT / 2.6;
        if (a.scanBar) a.scanBar.position.x = -0.09 + Math.sin(k * Math.PI) * 0.18;
        if (a.paperOut && k > 0.4) a.paperOut.position.z = 0.08 + Math.min(1, (k - 0.4) / 0.6) * 0.11;
        if (a.playT <= 0 && a.scanBar) a.scanBar.visible = false;
      }
    } else if (a.type === 'water') {
      if (a.playT > 0) {
        a.playT = Math.max(0, a.playT - dt);
        if (a.stream) {
          a.stream.visible = true;
          if (a.playT < 1.6) a.stream.material.color.setHex(0x88ccff);
          a.stream.scale.x = a.stream.scale.z = 0.85 + 0.25 * Math.sin(tNow * 24);
        }
        if (a.playT <= 0 && a.stream) a.stream.visible = false;
      }
    } else if (a.type === 'chem' && a.flasks) {
      if (a.playT > 0) {
        a.playT = Math.max(0, a.playT - dt);
        a.flasks.forEach((f, idx) => {
          f.rotation.z = Math.sin(tNow * 16 + idx) * 0.12;
          if (p.done && idx === 0) { f.material.color.setHex(0x30ff88); f.material.emissive.setHex(0x30ff88); f.material.emissiveIntensity = 1.2; }
        });
      } else {
        a.flasks.forEach(f => { f.rotation.z = 0; });
      }
    } else if (a.type === 'orrery' && a.orreryPiv) {
      if (a.playT > 0) a.playT = Math.max(0, a.playT - dt);
      const spd = (a.playT > 0 ? 2.6 : 0.28) * dt;
      a.orreryPiv.children.forEach((rg, ri) => { rg.rotation.y += spd * (ri === 0 ? 1.4 : ri === 1 ? -0.9 : 0.6); });
    } else if ((a.type === 'snack' || a.type === 'ballot') && a.box) {
      const bounce = a.t < 0.45 ? Math.sin((a.t / 0.45) * Math.PI) * 0.12 : 0;
      a.box.rotation.x = bounce;
    } else if (a.type === 'radio' && a.ant) {
      const targetY = a.active ? 0.28 : 0.22;
      a.ant.position.y += (targetY - a.ant.position.y) * Math.min(1, dt * 8);
    }
  }
}
function updateEvents(dt) {
  if (consoleCD > 0) consoleCD -= dt;
  updatePropAnims(dt);
  // 환영 처리: 손전등으로 바라보면 사라진다
  if (appar.visible) {
    apparT -= dt;
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), dx = appar.position.x - P.x, dz = appar.position.z - P.z, d = Math.hypot(dx, dz);
    const look = (dx * fx + dz * fz) / Math.max(d, .01) > .93;
    if (apparWatch === 'look' && look) { apparWatch = 'seen'; apparT = .45; sfx.screech(); shake = .6; }
    if (apparT <= 0 || appar.userData.floor !== P.floor) { appar.visible = false; if (apparWatch === 'seen') { blackout = .4; } }
  }
  updateEvents2(dt);
  EV.t -= dt; if (EV.t > 0) return; EV.t = .2; const step = .2;
  const f = P.floor, room = roomAt(f, P.x, P.z);
  moreEvents(f, room, step);
  // 방에 들어온 시간
  if (room && EV.inRoom === room.id) EV.roomT += step; else { EV.inRoom = room ? room.id : null; EV.roomT = 0; }
  // ⑧ 방송실 도착 시 두 번째 메시지
  if (room && room.type === 'broadcast') evOnce('bcMsg', () => setTimeout(() => phoneMessage(2), 4000));
}

/* ---------- 이야기 오브젝트: 민아의 캠코더 · 윤하늘의 명찰 · 장비실의 민아 ---------- */
function storyItem(kind, f, x, y, z, mesh, label, glowColor) {
  const F = floors[f]; mesh.position.set(x, y, z); mesh.userData.dynamic = true; F.interior.add(mesh);   // interior 는 이미 y0 만큼 올라가 있다
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, color: glowColor, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .55 }));
  sp.scale.setScalar(.55); sp.position.y = .06; mesh.add(sp);
  world.items.push({ kind, floor: f, pos: new THREE.Vector3(x, F.y0 + y, z), mesh, taken: false, label });
}
{ // 캠코더 (1-1 교실 교탁 위)
  const g = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: .45, metalness: .3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(.08, .075, .17), dark); body.position.y = .04; g.add(body);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(.03, .032, .06, 18).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: .2, metalness: .6 })); lens.position.set(0, .045, -.11); g.add(lens);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(.024, 18), new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: .05, metalness: .9 })); glass.position.set(0, .045, -.141); glass.rotation.y = Math.PI; g.add(glass);
  const scr = new THREE.Mesh(new THREE.BoxGeometry(.005, .05, .07), new THREE.MeshBasicMaterial({ color: 0x4a6a8a })); scr.position.set(.045, .045, .0); scr.rotation.y = .5; g.add(scr);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(.035, .006, 6, 16, Math.PI), dark); strap.position.set(-.042, .06, .02); strap.rotation.y = Math.PI / 2; g.add(strap);
  const rec = new THREE.Mesh(new THREE.SphereGeometry(.006, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 })); rec.position.set(.02, .08, -.06); g.add(rec);
  g.rotation.y = .6;
  storyItem('camcorder', 0, SLOTS[5] + 2.95, .77, -8.5, g, '민아의 캠코더 줍기', 0xffd0a0);
}
{ // 윤하늘의 명찰 (지하 펌프실 바닥)
  const c = document.createElement('canvas'); c.width = 256; c.height = 80; const x = c.getContext('2d');
  x.fillStyle = '#e9e3d0'; x.fillRect(0, 0, 256, 80); x.fillStyle = '#2a4a7a'; x.fillRect(0, 0, 256, 16); x.fillStyle = 'rgba(120,90,50,.35)'; x.beginPath(); x.ellipse(170, 52, 70, 26, .3, 0, 7); x.fill();
  x.fillStyle = '#1a1a1a'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.fillText('3-2 윤하늘', 128, 60);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(.09, .004, .028), [0, 0, new THREE.MeshStandardMaterial({ map: t, roughness: .5 }), 0, 0, 0].map(m => m || new THREE.MeshStandardMaterial({ color: 0xd8d0b8, roughness: .5 })));
  g.add(plate); const pin = new THREE.Mesh(new THREE.BoxGeometry(.06, .003, .004), new THREE.MeshStandardMaterial({ color: 0x999999, metalness: .8, roughness: .3 })); pin.position.set(0, -.003, 0); g.add(pin);
  g.rotation.y = .9;
  storyItem('nametag', 4, SLOTS[8] - 3, .02, -4.5, g, '명찰 줍기', 0xc8a0ff);
}
// 장비실에 주저앉은 민아 (서현고 교복)
const mina = new THREE.Group(), minaProps = new THREE.Group();
// 민아 (서브 캐릭터 시트): 17세 · 162cm · 남색 블레이저(교표) · 흰 셔츠 · 버건디 리본 · 남색/버건디 체크 플리츠 스커트 · 흰 양말 · 검정 로퍼
// 낮게 묶은 포니테일 + 앞머리 · 검정 백팩(토끼 키링) · 손전등 · 작은 노트 · 스마트폰 — 장비실 벽에 기대 잠든 자세
{
  const F = floors[2], M = (c, r = .8, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...o });
  const plaid = (() => { const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
    g.fillStyle = '#2a2f45'; g.fillRect(0, 0, N, N); g.globalAlpha = .55; g.fillStyle = '#6a2232'; [8, 72].forEach(v => { g.fillRect(v, 0, 14, N); g.fillRect(0, v, N, 14); });
    g.globalAlpha = .35; g.fillStyle = '#9a9aa8'; [40, 104].forEach(v => { g.fillRect(v, 0, 3, N); g.fillRect(0, v, N, 3); }); g.globalAlpha = .25; g.fillStyle = '#c8b070'; [56, 120].forEach(v => { g.fillRect(v, 0, 2, N); g.fillRect(0, v, N, 2); });
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const navy = M(0x1a1f30, .78), shirt = M(0xe6e2da, .8), skin = M(0xe2bfa8, .55), hairM = M(0x1c1410, .5), skirt = M(0xffffff, .9, { map: plaid, side: THREE.DoubleSide });
  const ribbon = M(0x6e1a28, .55), sock = M(0xe8e6e0, .85), loafer = M(0x0c0c0e, .3, { metalness: .1 }), bagM = M(0x16171a, .75), gold = M(0xb89850, .4, { metalness: .6 });
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); mina.add(o); return o; };
  const cap = (r, h, m, x, y, z, rx = 0, ry = 0, rz = 0) => add(new THREE.CapsuleGeometry(r, h, 6, 12), m, x, y, z, rx, ry, rz);
  // 앉은 하체: 플리츠 스커트(주름 원뿔) · 무릎을 세운 다리 · 흰 양말 · 로퍼
  add(new THREE.CylinderGeometry(.17, .27, .2, 24, 1, true), skirt, 0, .12, .06, -.25);
  [-1, 1].forEach(s => {
    cap(.058, .3, skin, s * .1, .26, .26, Math.PI / 2 - .55);   // 허벅지 → 무릎
    cap(.05, .28, skin, s * .1, .2, .5, .55);                  // 정강이
    add(new THREE.CylinderGeometry(.052, .048, .14, 10), sock, s * .1, .07, .6, .2);
    add(new THREE.BoxGeometry(.085, .06, .22), loafer, s * .1, .03, .67);
  });
  // 상체 (벽에 기대 고개를 떨군 자세)
  const torso = new THREE.Group(); torso.position.set(0, .22, -.05); torso.rotation.x = -.22; mina.add(torso);
  const tadd = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); torso.add(o); return o; };
  tadd(new THREE.CapsuleGeometry(.15, .22, 6, 14), navy, 0, .24, 0).scale.set(1.08, 1, .72);   // 블레이저
  tadd(new THREE.BoxGeometry(.11, .2, .02), shirt, 0, .32, .105);
  [-1, 1].forEach(s => tadd(new THREE.BoxGeometry(.06, .2, .015), navy, s * .065, .3, .11, 0, 0, s * .25));  // 라펠
  [-1, 1].forEach(s => tadd(new THREE.ConeGeometry(.035, .07, 4), ribbon, s * .035, .4, .125, 0, 0, s * Math.PI / 2));   // 리본 양쪽
  tadd(new THREE.SphereGeometry(.018, 8, 6), ribbon, 0, .4, .13);
  tadd(new THREE.CircleGeometry(.022, 12), gold, -.085, .36, .113);   // 교표
  [-1, 1].forEach(s => { const arm = tadd(new THREE.CapsuleGeometry(.045, .3, 6, 10), navy, s * .19, .2, .08, -.7, 0, s * .2); tadd(new THREE.SphereGeometry(.04, 10, 8), skin, s * .16, .02, .24); });
  tadd(new THREE.CylinderGeometry(.04, .045, .07, 10), skin, 0, .45, 0);
  const head = tadd(new THREE.SphereGeometry(.1, 20, 16), skin, .02, .56, .03, .45, 0, .25); head.scale.set(.88, 1.08, .95);
  tadd(new THREE.SphereGeometry(.112, 20, 14, 0, Math.PI * 2, 0, Math.PI * .58), hairM, .02, .585, .01, .3, 0, .25);   // 머리
  tadd(new THREE.BoxGeometry(.17, .07, .03), hairM, .03, .6, .11, .7, 0, .25);   // 앞머리
  [-1, 1].forEach(s => tadd(new THREE.BoxGeometry(.03, .16, .05), hairM, .02 + s * .085, .5, .05, .3, 0, .25));   // 옆머리
  tadd(new THREE.CapsuleGeometry(.035, .2, 6, 8), hairM, -.02, .44, -.1, .5, 0, .1);   // 낮게 묶은 포니테일
  // 소품: 백팩(토끼 키링) · 바닥의 손전등(희미하게 켜짐) · 노트 · 스마트폰(화면 빛)
  add(new THREE.BoxGeometry(.3, .38, .16), bagM, .38, .19, .1, 0, -.4).geometry.translate(0, 0, 0);
  add(new THREE.BoxGeometry(.22, .14, .05), bagM, .43, .14, .2, 0, -.4);
  add(new THREE.SphereGeometry(.035, 10, 8), M(0xf0c8cc, .9), .5, .3, .25); add(new THREE.SphereGeometry(.022, 8, 6), M(0xf0c8cc, .9), .5, .35, .25);
  [-1, 1].forEach(s => add(new THREE.CapsuleGeometry(.008, .03, 4, 6), M(0xf0c8cc, .9), .5 + s * .012, .385, .25));   // 토끼 귀
  // 바닥 소품은 따로 둔다 (3D 모델로 바뀌어도 남는다): 오른손 옆 손전등(희미하게 켜짐) · 발치의 스마트폰(화면 빛) · 왼쪽 노트
  const padd = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); minaProps.add(o); return o; };
  const fl = padd(new THREE.CylinderGeometry(.022, .03, .2, 12), M(0x1a1a1a, .4, { metalness: .5 }), -.5, .03, .18, 0, 0, Math.PI / 2); fl.rotation.y = .6;
  padd(new THREE.CircleGeometry(.026, 12), new THREE.MeshBasicMaterial({ color: 0xffe8c0 }), -.42, .03, .24, 0, -1.0);
  padd(new THREE.BoxGeometry(.12, .015, .16), M(0x5a6a4a, .8), .36, .008, .5, 0, .3);   // 작은 노트
  padd(new THREE.BoxGeometry(.07, .008, .14), M(0x111216, .3), -.2, .006, .78, 0, -.2); padd(new THREE.PlaneGeometry(.06, .12), new THREE.MeshBasicMaterial({ color: 0x8ab4e8 }), -.2, .012, .78, -Math.PI / 2, 0, .2);
  mina.position.set(-21.65, 0, -8.45); mina.userData.dynamic = true; F.interior.add(mina);   // interior 그룹이 이미 층 높이(y0)만큼 올라가 있다
  minaProps.position.copy(mina.position); minaProps.userData.dynamic = true; F.interior.add(minaProps);
  [mina, minaProps].forEach(g => g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }));
  world.props.push({ kind: 'mina', floor: 2, x: -21.65, z: -7.9, y: .8, label: '민아 깨우기' });
  // 3D 모델(162cm 실제 크기 · native): 서 있는 몸 그대로 '벽에 기대 앉기' 동작으로 앉힌다 — 크기를 앉은 키에 맞춰 줄이지 않는다(비율 왜곡 없음)
  // offset z: 앉은 자세의 백팩 뒷면이 장비 랙 앞면(z -8.94)에 닿도록
  npcLoad('mina', mina, { url: 'assets/characters/mina.glb', native: true, offset: [0, 0, .36], clipNames: ['sittingagainstwall'],
    onLoad: () => { mina.userData.noBlink = true; npcVisuals.setExpression(mina, 'Asleep', 1); } });
}

/* ---------- 추가 상호작용 오브젝트: 잠긴 보관함 · 다이얼 · 배수구 · 피아노 · 그림 · 도구 ---------- */
const metalM = new THREE.MeshStandardMaterial({ color: 0x4a5258, roughness: .45, metalness: .65 });
const brassM = new THREE.MeshStandardMaterial({ color: 0xb08a3a, roughness: .35, metalness: .8 });
const paperM = new THREE.MeshStandardMaterial({ color: 0xd8d0b4, roughness: .95, side: THREE.DoubleSide });
function addNoteAt(id, f, x, y, z, ry = 0) {
  const F = floors[f], n = world.NOTES[id], m = new THREE.Mesh(new THREE.PlaneGeometry(.3, .22), paperM);
  m.rotation.set(-Math.PI / 2, 0, ry); m.position.set(x, y + .012, z); m.userData.dynamic = true; F.interior.add(m);
  world.items.push({ kind: 'note', id, floor: f, pos: new THREE.Vector3(x, F.y0 + y, z), mesh: m, title: n.title, text: n.text, taken: false, label: '쪽지 읽기' });
}
// 잠긴 금속 보관함: type 'pick'(맹꽁이 자물쇠) | 'dial'(다이얼 자물쇠). keyIdx 가 있으면 열쇠 조각을 안에 숨긴다
function lockBox(f, x, y, z, ry, type, o = {}) {
  const F = floors[f], g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.userData.dynamic = true; F.interior.add(g);
  const body = new THREE.Mesh(new THREE.BoxGeometry(.38, .14, .26), metalM); body.position.y = .07; g.add(body);
  const lid = new THREE.Group(); lid.position.set(0, .14, -.13); g.add(lid);
  const lm = new THREE.Mesh(new THREE.BoxGeometry(.39, .05, .27), metalM); lm.position.set(0, .025, .135); lid.add(lm);
  const hasp = new THREE.Mesh(new THREE.BoxGeometry(.05, .07, .015), brassM); hasp.position.set(0, .1, .14); g.add(hasp);
  const lock = new THREE.Group(); lock.position.set(0, .06, .15); g.add(lock);
  lock.add(new THREE.Mesh(new THREE.BoxGeometry(.07, .07, .03), type === 'dial' ? new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: .4, metalness: .6 }) : brassM));
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(.025, .007, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0xc0c0c8, metalness: .9, roughness: .3 })); shackle.position.y = .035; lock.add(shackle);
  if (type === 'dial') for (let k = 0; k < 3; k++) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .02, 10).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a8a90, metalness: .8, roughness: .3 })); w.position.set(0, -.015, .018 + 0); w.position.x = -.02 + k * .02; lock.add(w); }
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  const p = { kind: 'lock', lockType: type, floor: f, x, z, y: y + .1, lid, lockMesh: lock, label: o.label || (type === 'dial' ? '다이얼 자물쇠 맞추기' : '잠긴 보관함 따기'), ...o };
  if (o.keyIdx != null) {
    const it = world.items.find(i => i.kind === 'key' && i.idx === o.keyIdx);
    it.locked = true; it.mesh.visible = false; it.mesh.position.set(x, y + .2 - (it.pos.y - F.y0 - it.mesh.position.y), z); it.pos.set(x, F.y0 + y + .2, z); p.keyItem = it;
  }
  world.props.push(p); return p;
}
function openLockVisual(p) {
  p.done = true; p.lockMesh.visible = false;
  let t = 0; const iv = setInterval(() => { t = Math.min(1, t + .08); p.lid.rotation.x = -t * 1.9; if (t >= 1) clearInterval(iv); }, 30);
  if (p.keyItem && !p.keyItem.taken) { p.keyItem.locked = false; p.keyItem.mesh.visible = true; }
}
const tool = (kind, f, x, y, z, mesh, label, col) => storyItem(kind, f, x, y, z, mesh, label, col);
const canM = new THREE.MeshStandardMaterial({ color: 0xb02a28, roughness: .4, metalness: .6 });
const mkCan = () => { const g = new THREE.Group(), c = new THREE.Mesh(new THREE.CylinderGeometry(.033, .033, .12, 12), canM); c.rotation.z = Math.PI / 2; c.position.y = .033; g.add(c); g.rotation.y = Math.random() * 6; return g; };
const mkPin = () => { const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x1e1e22, metalness: .8, roughness: .35 }); [-.006, .006].forEach((o, i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(.07 - i * .01, .003, .003), m); b.position.set(i * .005, .003, o); g.add(b); }); const pearl = new THREE.Mesh(new THREE.SphereGeometry(.007, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe8d8e0, roughness: .2 })); pearl.position.set(-.035, .006, 0); g.add(pearl); g.rotation.y = Math.random() * 6; return g; };
const mkFuse = () => { const g = new THREE.Group(); const gl = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .06, 10).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc8e0e8, roughness: .05, transparent: true, opacity: .6 })); gl.position.y = .013; g.add(gl); [-.034, .034].forEach(x => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.013, .013, .012, 10).rotateZ(Math.PI / 2), brassM); c.position.set(x, .013, 0); g.add(c); }); return g; };
const mkMop = () => { const g = new THREE.Group(), m = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, 1.3, 8).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a6a40, roughness: .8 })); m.position.y = .016; g.add(m); g.rotation.y = .4; return g; };
const mkWire = () => { const g = new THREE.Group(), m = new THREE.Mesh(new THREE.TorusGeometry(.06, .006, 6, 24), new THREE.MeshStandardMaterial({ color: 0x9a9aa0, metalness: .85, roughness: .35 })); m.rotation.x = Math.PI / 2; m.position.y = .01; g.add(m); const m2 = m.clone(); m2.scale.setScalar(.8); m2.position.y = .02; g.add(m2); return g; };
// 쪽지 (단서)
addNoteAt('n19', 8, ANNEX.slots[4], .02, -7.25, .3);   // 별관 1F 도서실
addNoteAt('n17', 9, ANNEX.slots[4] + 2.6, .92, -5.3, -.2);   // 별관 2F 과학실
addNoteAt('n18', 10, ANNEX.slots[1] - 2.6, .02, -6.3, .5);    // 별관 3F 음악실 악보
addNoteAt('n20', 6, -35.8, 1.68, 44, .2);   // 수영장 감시대
addNoteAt('n21', 0, 5.5, .02, 1.2, .4);                       // 1층 복도 — 행사 안내문
addNoteAt('n22', 4, SLOTS[5] + 1.85, .77, -7.5, .2);   // 지하 기록실 — 봉인 서약서 (녹음기와 겹치지 않게 0.8m 옆)           // 지하 기록실 — 봉인 서약서
addNoteAt('n23', 9, ANNEX.slots[4], .02, 3.0, -.3);          // 별관 2F 동아리실(남쪽) — 방송부원 진술서
addNoteAt('n24', 8, ANNEX.slots[4], .02, 3.0, .5);           // 별관 1F 진로상담실(남쪽) — 경비 일지
addNoteAt('n25', 9, ANNEX.slots[2], .02, -3.0, .1);           // 별관 2F 언어실 — 사서의 메모
addNoteAt('nC', 2, SLOTS[1] + .8, .02, -3.0, -.4);            // 방송실 — 캐릭터 전용 기록
addNoteAt('n29', 0, SLOTS[7] + 2.6, .76, -8.6, .2);           // EV-04 1-3 교실 교사용 책상 — 첫 번째 메모
addNoteAt('n27', 2, SLOTS[5] + 2.6, .76, -8.6, .3);           // 3-4 교실 교사용 책상 — 담임 수첩
addNoteAt('n28', 2, SLOTS[6] - 2.9, .02, -2.3, .6);           // 3-5 교실 사물함 앞 — 교환일기
addNoteAt('n26', 8, ANNEX.slots[4] - .2, .77, -8.45, .1);           // 별관 1F 도서실 — 이벤트로 나타나는 대출 카드
{ const it = world.items.find(i => i.kind === 'note' && i.id === 'n26'); it.locked = true; it.mesh.visible = false; }
// 도구 · 소모품
tool('hairpin', 0, SLOTS[3] - 2.4, .66, 8.0, mkPin(), '머리핀 줍기', 0xffd0e0);               // 본관 1F 보건실 침대
tool('hairpin', 1, SLOTS[1] + 2.3, .77, -8.45, mkPin(), '머리핀 줍기', 0xffd0e0);         // 2-1 교탁
tool('hairpin', 6, -37.6, .45, 28.3, mkPin(), '머리핀 줍기', 0xffd0e0);                   // 여자 탈의실 벤치
tool('fuse', 4, SLOTS[7] - 1.5, .91, -4.15, mkFuse(), '예비 퓨즈 줍기', 0xa0e0ff);          // 지하 기계실 정비 작업대
tool('mop', 4, SLOTS[6] - 1.0, .02, -6.8, mkMop(), '대걸레 자루 줍기', 0xffe0a0);          // 지하 청소도구실
tool('wire', 8, ANNEX.slots[3] + 2.9, .77, -4.8, mkWire(), '철사 뭉치 줍기', 0xffe0a0);    // 별관 1F 기술·가정실 (cx = 8)
[[0, -20, -1.25], [0, 12, -1.25], [1, -4, -1.25], [1, 28, -1.25], [2, 4, -1.25], [2, -30, -1.25], [5, 35, 25], [7, -36, 18.5]].forEach(([f, x, z]) => tool('can', f, x, .0, z, mkCan(), '빈 캔 줍기', 0xffffff));
// 열쇠 조각을 지키는 자물쇠들
lockBox(8, ANNEX.slots[4] + .6, .75, -8.6, 0, 'pick', { keyIdx: 1, label: '대출 데스크 서랍 따기', tol: 10 });
lockBox(9, ANNEX.slots[4] - 2.4, .92, -4.8, Math.PI / 2, 'dial', { keyIdx: 2, code: '314', label: '약품장 다이얼 자물쇠', clue: 'n17', clueText: '칠판 메모 — 원주율 앞 세 자리' });
lockBox(5, 29.2, .8, 20.6, Math.PI / 2, 'dial', { keyIdx: 3, code: '0723', label: '기구함 다이얼 자물쇠', clue: 'n9', clueText: '체육 일지 — 전광판의 마지막 경기 점수' });
// 덤 보관함 (머리핀으로 따면 보급품)
lockBox(1, SLOTS[6] + 2.2, .76, -8.6, 0, 'pick', { loot: { battery: 2, can: 1 }, tol: 8 });
lockBox(2, SLOTS[5] + 2.2, .76, -8.6, 0, 'pick', { loot: { medkit: 1, battery: 1 }, tol: 7 });
// 수영장 배수구: 열쇠 조각이 바닥 배수구 철망 아래에 빠져 있다
{
  const F = floors[6], it = world.items.find(i => i.kind === 'key' && i.idx === 4);
  it.mesh.position.set(-41.5, -1.6 + .05, 44.85); it.pos.set(-41.5, F.y0 - 1.55, 44.85); it.locked = true;
  const grate = new THREE.Mesh(new THREE.PlaneGeometry(.6, .6), new THREE.MeshStandardMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#111'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#6a6a6a'; g.lineWidth = 3; for (let k = 4; k < 64; k += 10) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 64); g.stroke(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })(), metalness: .6, roughness: .5, transparent: true, alphaTest: .1 }));
  grate.rotation.x = -Math.PI / 2; grate.position.set(-41.5, -1.58, 44.85); grate.userData.dynamic = true; F.interior.add(grate);
  world.props.push({ kind: 'drain', floor: 6, x: -41.5, z: 46.1, y: 0, label: '배수구 들여다보기' });
}
world.props.push({ kind: 'cctvRec', floor: 2, x: SLOTS[1] - 1.3, z: -7.0, y: 1.0, label: 'CCTV 녹화 화면 보기' });   // EV-10
world.props.push({ kind: 'footprints', floor: 6, x: -46.6, z: 46.9, y: .1, label: '젖은 발자국 조사' });            // EV-17
{ const fm = new THREE.MeshBasicMaterial({ color: 0x0a1012, transparent: true, opacity: .55, depthWrite: false });
  for (let k = 0; k < 9; k++) { const m = new THREE.Mesh(new THREE.CircleGeometry(.07, 10), fm); m.scale.set(1, 1.9, 1); m.rotation.x = -Math.PI / 2; m.rotation.z = .2; m.position.set(-46.6 - k * .12 + (k % 2) * .15, .021, 46.9 - k * .65); m.userData.dynamic = true; floors[6].interior.add(m); } }
world.props.push({ kind: 'piano', floor: 10, x: ANNEX.slots[1] + 2.2, z: -7.1, y: 1, label: '피아노 치기' });
world.props.push({ kind: 'easel', floor: 10, x: ANNEX.slots[2] + 1.0, z: -5.5, y: 1.1, label: '찢어진 그림 맞추기' });
// ── 지하 B1 진입 철문 (스토리: 교무부장이 잠근 지하 — 교무실 금고에서 나온 열쇠로만 연다) ──
//   B1 계단실 ↔ B1 복도 사이 2m 개구부(x -1~1, z -1.75~-1.45)에 갑종 철제 양개문. 엘리베이터 B1 · 수영장 사다리도 같이 막는다
const b1Open = () => !!FL.b1Open;
const B1D = (() => {
  const F = floors[4]; if (!F) return null;
  const steel = new THREE.MeshStandardMaterial({ color: 0x55605c, roughness: .55, metalness: .6 }), rust = new THREE.MeshStandardMaterial({ color: 0x6a3a22, roughness: .9, metalness: .3 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.24, 2.36, .22), steel); frame.position.set(0, 1.18, -1.6); frame.scale.set(1, 1, 1);
  const holeL = [], piv = [];
  [-1, 1].forEach(sx => {
    const p = new THREE.Group(); p.position.set(sx * 1.0, 0, -1.6); F.interior.add(p); piv.push(p);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.2, .07), steel); leaf.position.set(-sx * .5, 1.1, 0); p.add(leaf);
    for (let k = 0; k < 3; k++) { const st = new THREE.Mesh(new THREE.BoxGeometry(.9, .04, .08), rust); st.position.set(-sx * .5, .4 + k * .7, .01); p.add(st); }   // 녹슨 보강대
    const bar = new THREE.Mesh(new THREE.BoxGeometry(.7, .05, .06), new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: .3, metalness: .85 })); bar.position.set(-sx * .45, 1.05, .07); p.add(bar);
  });
  const chain = new THREE.Mesh(new THREE.TorusGeometry(.09, .018, 6, 14), new THREE.MeshStandardMaterial({ color: 0x8a8a84, roughness: .4, metalness: .8 })); chain.position.set(0, 1.05, -1.5); F.interior.add(chain);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(.1, .14, .05), new THREE.MeshStandardMaterial({ color: 0xb08a30, roughness: .35, metalness: .8 })); lock.position.set(0, .94, -1.48); F.interior.add(lock);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, .32), new THREE.MeshBasicMaterial({ map: makeSign('출입금지 · 지하 B1 (교무실 관리)', '#3a0e0a', '#f0d8c0', 22) })); sign.position.set(0, 2.5, -1.44); F.interior.add(sign);
  const rect = { x1: -1, x2: 1, z1: -1.78, z2: -1.42 }; F.col.push(rect); (F.walls ||= []).push(rect);
  const prop = { kind: 'b1door', floor: 4, x: 0, z: -2.3, y: 1.1, r: 1.9, label: '지하 B1 철문 열기' };
  world.props.push(prop);
  // 바깥(복도) 쪽에서도 같은 문
  world.props.push({ ...prop, z: -.9, outer: true });
  return { piv, chain, lock, rect, open() { if (FL.b1Open) return; FL.b1Open = true; rect.off = true; F.walls = F.walls.filter(r => r !== rect); chain.visible = lock.visible = false;
    let t = 0; const iv = setInterval(() => { t = Math.min(1, t + .05); piv[0].rotation.y = -t * 1.45; piv[1].rotation.y = t * 1.45; if (t >= 1) clearInterval(iv); }, 30); },
    sync() { if (FL.b1Open) { rect.off = true; F.walls = F.walls.filter(r => r !== rect); chain.visible = lock.visible = false; piv[0].rotation.y = -1.45; piv[1].rotation.y = 1.45; } } };
})();
// 장소에 맞는 인물 증언 카세트: 실제 놓일 표면 높이를 광선으로 찾아(모델 로드 뒤) 그 위에 둔다
function placeSiteTapes() {
  const meshes = []; scene.traverse(o => { if (o.isMesh && !o.isSprite && o.visible !== false && o.geometry) meshes.push(o); });
  const rc = new THREE.Raycaster(), V = THREE.Vector3, nearM = nearSolids(meshes);   // 씬 전체(1만여 메시)에 광선을 쏘면 시작 직후 0.4초 멈췄다 → 근처 메시만
  const surf = (f, x, z) => { const y0 = floors[f]?.y0 || 0; rc.set(new V(x, y0 + 1.4, z), new V(0, -1, 0)); rc.far = 1.5;
    const h = rc.intersectObjects(nearM(x, y0 + .7, z, 1.5), false).find(i => i.point.y < y0 + 1.25); return h ? h.point.y - y0 : 0; };
  const near = (pick, dx, dz) => { const q = pick(); return q && [q.floor, (q.x ?? q.pos.x) + dx, (q.z ?? q.pos.z) + dz]; };
  const spots = [
    ['ts_snack', () => [0, 66.4, 19.75]],   // 학우매점 계산대
    ['ts_snack2', () => [0, 67.6, 15.6]],
    ['ts_dorm', () => near(() => world.props.find(q => q.k === 'dorm_log'), -.55, .1)],   // 청운학사 사감실 책상
    ['ts_music', () => near(() => world.props.find(q => q.kind === 'piano'), -.6, .35)],   // 음악실 피아노 옆
    ['ts_art', () => near(() => world.props.find(q => q.kind === 'easel'), .55, .2)],     // 미술실 이젤 옆
    ['ts_janitor', () => near(() => world.items.find(q => q.kind === 'mop'), .45, .25)],  // 지하 청소도구실
    // 새 증언 카세트 10종 (재건축된 시설 · 캠퍼스 단서 옆)
    ['ts_lib2', () => near(() => world.props.find(q => q.k === 'lib_microfilm'), .7, -.2)],      // 대도서관 마이크로필름 판독기 옆
    ['ts_astro', () => near(() => world.props.find(q => q.k === 'astro_console'), .9, .35)],     // 과학천문관 관측 제어실 콘솔
    ['ts_history', () => near(() => world.props.find(q => q.k === 'east_museum'), -.9, -.35)],   // 역사관 타임캡슐 진열장 옆
    ['ts_union', () => near(() => world.props.find(q => q.k === 'union_locker'), 1.3, .4)],      // 학생회관 학생회실
    ['ts_auditor', () => near(() => world.props.find(q => q.kind === 'fz' && /카세트테이프/.test(q.label || '') && q.x < -14 && q.z < -34), .6, -.55)],   // 대강당 음향 · 조명 조정실 믹서
    ['ts_lake', () => near(() => world.props.find(q => q.k === 'lake_capsule'), .7, .3)],        // 호심정
    ['ts_pool2', () => near(() => world.props.find(q => q.kind === 'drain' && q.floor === 6), 1.4, -.6)],   // 수영장 배수구 옆
    ['ts_bunker', () => near(() => world.props.find(q => q.k === 'bunker_audit'), .8, .6)],      // 방공호 서고
    ['ts_incin', () => near(() => world.props.find(q => q.k === 'east_incinerator') || world.props.find(q => q.k === 'east_fountain'), 1.4, .3)],  // 소각로 투입구 옆 (소각장 철거 뒤: 야외 수돗가 옆 — 용역 기사가 쉬던 곳)
    ['ts_green', () => near(() => world.props.find(q => q.k === 'greenhouse_herb'), .6, .3)],    // 생물부 온실 약초 선반
  ];
  const mat = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: .5, metalness: .3 }), btn = new THREE.MeshStandardMaterial({ color: 0xb83228, roughness: .4 });
  for (const [id, fn] of spots) {
    if (world.props.some(q => q.kind === 'tape' && q.id === id) || !world.TAPES[id]) continue;
    const p = fn(); if (!p) continue; const [f, x, z] = p, F = floors[f]; if (!F) continue;
    const y = surf(f, x, z), g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = (x * 7 + z * 3) % 6.28;
    const b = new THREE.Mesh(new THREE.BoxGeometry(.26, .07, .15), mat); b.position.y = .035; g.add(b);
    const k = new THREE.Mesh(new THREE.BoxGeometry(.038, .018, .026), btn); k.position.set(.045, .076, .05); g.add(k);
    g.userData.dynamic = true; (f === 0 ? scene : F.interior).add(g); if (f === 0) g.position.y += 0;
    world.props.push({ kind: 'tape', id, floor: f, x, z, y: y + .1, r: 1.6, label: '증언 카세트 재생', ...world.TAPES[id] });
  }
}
{ const t = setInterval(() => { if (window.__modelsDone) { clearInterval(t); try { placeSiteTapes(); } catch (e) { console.warn('[site tapes]', e); } } }, 500); }
// 지하 기계실 원심 송풍기: 조사 지점이 송풍기 몸체와 옆 설비 사이 0.3m 틈에 끼어 다가설 수 없었다 → 송풍기 남쪽 앞면으로
{ const t = setInterval(() => { const p = world.props.find(q => q.floor === 4 && /원심 송풍기 터빈/.test(q.label || '')); if (!p) return; clearInterval(t); if (p.z < -5) { p.x = -22.4; p.z = -4.6; } }, 1500); setTimeout(() => clearInterval(t), 60000); }
// 반장 증언 녹음기 (1998.10.13 학급 조사): 새 본관 1 · 2학년 교실마다 반장 자리(앞줄 책상) 위에 — 일부는 거짓 증언(연표에서 다른 증언과 어긋남 표시)
async function placeClassReps() {
  if (!RBG || !RBG.classRooms) return; const st = { t: performance.now() };
  const meshes = []; scene.traverse(o => { if (o.isMesh && o.geometry && o.visible !== false) meshes.push(o); }); const near = nearSolids(meshes);
  const rc = new THREE.Raycaster(), V = THREE.Vector3, mat = new THREE.MeshStandardMaterial({ color: 0x3a3226, roughness: .5, metalness: .2 }), btn = new THREE.MeshStandardMaterial({ color: 0xb83228, roughness: .4 });
  for (const room of RBG.classRooms) {
    const m = /^(\d)학년 (\d+)반$/.exec(room.label); if (!m) continue; const id = `cr_${m[1]}_${m[2]}`;
    if (!world.TAPES[id] || world.props.some(q => q.kind === 'tape' && q.id === id)) continue;
    // 책상 높이 띠(바닥 +0.6~0.9)에 걸치는 메시만 — 건물 통짜 메시까지 광선을 쏘면 수십 초 멈춘다
    const bx = new THREE.Box3(), loc = near(room.fx, room.y0 + 1, room.fz, 4).map(o => [o, bx.setFromObject(o).clone()]).filter(([, b]) => b.max.y > room.y0 + .6 && b.max.y < room.y0 + 1.4 && b.max.x - b.min.x < 4 && b.max.z - b.min.z < 4); let spot = null;
    for (let rr = 0; rr <= 2.4 && !spot; rr += .4) for (let a = 0; a < 8 && !spot; a++) { if (!a) await sliceYield(st); const an = a / 8 * Math.PI * 2, x = room.fx + Math.cos(an) * rr, z = room.fz + Math.sin(an) * rr;
      const col = loc.filter(([, b]) => x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z).map(([o]) => o); if (!col.length) continue;
      rc.set(new V(x, room.y0 + 1.4, z), new V(0, -1, 0)); rc.far = 1.2; const h = rc.intersectObjects(col, false)[0]; if (h && h.point.y > room.y0 + .6 && h.point.y < room.y0 + .9) spot = [x, h.point.y, z]; }
    if (!spot) spot = [room.fx, room.y0 + .76, room.fz];
    const g = new THREE.Group(); g.position.set(...spot); g.rotation.y = Math.PI / 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(.24, .06, .14), mat); b.position.y = .03; g.add(b);
    const k = new THREE.Mesh(new THREE.BoxGeometry(.036, .016, .024), btn); k.position.set(.045, .068, .045); g.add(k);
    g.userData.dynamic = true; g.userData.rbKeep = true; scene.add(g);
    world.props.push({ kind: 'tape', id, floor: 0, rbY: room.y0, x: spot[0], z: spot[2], y: spot[1] + .1, r: 1.6, label: '반장 녹음기 재생', ...world.TAPES[id] });
  }
}
{ let n = 0; const t = setInterval(() => { if (RBG && (window.__modelsDone || ++n > 40)) { clearInterval(t); placeClassReps().catch(e => console.warn('[class reps]', e)); } }, 600); }

world.PHOTOS.p4 = { img: 'old_music', title: '사진 — 방송부 앨범', text: '음악실 피아노 앞에서 웃고 있는 3학년 2반 윤하늘.<br>뒷면: <b>“기념 방송 반주는 내 몫! — 방송부 하늘”</b>' };
world.PHOTOS.p5 = { img: 'old_lab', title: '사진 — 과학실 (10년 전)', text: '방과 후 과학실. 창가에 교복 차림의 아이가 흐릿하게 서 있다.<br>뒷면: <b>“10.12 담력 체험 — 4명. 하늘이는 빼자고 했는데…”</b>' };

// 미니게임 실행: 게임을 멈추고(사물함처럼 안전) 결과를 돌려준다
async function mini(kind, opts) {
  if (state !== 'playing') return { ok: false };
  const epoch=storySession;
  storyCalm(20);
  state = 'ui'; for (const k in keys) keys[k] = false; $('prompt').style.display = 'none'; document.exitPointerLock?.();
  const r = await runMini(kind, opts);
  if(epoch!==storySession)return {ok:false,cancelled:true};
  if (state === 'ui') { state = 'playing'; refreshHud(); lock(); }
  return r;
}
function usePassSwitch() {
  sfx.click(); PASS.lightOn = !PASS.lightOn;
  if (ipP.state.blackoutTriggered && PASS.lightOn) { ipP.ceilingLights.forEach((l, i) => setTimeout(() => { l.intensity = .7; setTimeout(() => { l.intensity = .05; }, 120); }, i * 90)); say('딸깍— 형광등이 한 번 깜빡이고 다시 꺼졌다. 전기가 약하다', 2600); PASS.lightOn = false; return; }
  ipP.ceilingLights.forEach((l, i) => setTimeout(() => { l.intensity = PASS.lightOn ? .85 : 0; }, i * 70));
  say(PASS.lightOn ? '딸깍— 복도 형광등이 차례로 켜진다' : '딸깍— 복도가 어두워졌다. 어둠 속이 더 안전할지도', 2200);
}
async function openLock(p) {
  if (p.lockType === 'pick') {
    if (!inv.hairpin) { sfx.click(); talk('needPin', 3000); say('잠겨 있다 — 머리핀이 있으면 딸 수 있을 것 같다', 2600); return; }
    const r = await mini('lockpick', { pins: () => inv.hairpin, usePin: () => { inv.hairpin = Math.max(0, inv.hairpin - 1); }, tol: p.tol || 9 });
    if (!r.ok) { if (!inv.hairpin) toast('머리핀이 없습니다', '다른 핀을 찾아야 한다', 'warn'); return; }
  } else {
    const known = docs.some(d => d.id === p.clue) || (p.fails || 0) >= 2;
    const hint = (known ? `단서: <b style="color:#e8d8a8">${p.clueText}</b>` : '<span style="color:#a06a6a">번호를 알려 주는 단서가 어딘가에 있을 것이다</span>') + ((p.fails || 0) >= 4 ? `<br>힌트 ③ 첫 자리는 <b>${p.code[0]}</b>` : '');
    const r = await mini('dial', { code: p.code, title: p.label, hint, onFail: () => { p.fails = (p.fails || 0) + 1; if (p.fails === 1) talk('dialWrong', 2400); } });
    if (!r.ok) return;
  }
  openLockVisual(p); sfx.unlock(); talk('unlocked', 2000);
  if (p.loot) { const got2 = []; for (const [k, n] of Object.entries(p.loot)) { inv[k] = (inv[k] || 0) + n; newItems.add(k); got2.push(`${ITEMS[k].name} ×${n}`); } toast('보관함을 열었습니다', got2.join(' · ')); }
  else toast('잠금 해제', '안에 열쇠 조각이 있다');
  refreshHud(); save(true);
}

/* ---------- 빈 캔 던지기: 떨어진 곳의 소리로 그것을 유인 ---------- */
const throws = [];
function throwCan() {
  if (state !== 'playing' || P.hiding) return;
  if (!inv.can) { say('던질 빈 캔이 없다', 1400); return; }
  inv.can--; refreshHud(); sfx.throwIt();
  const F = floors[P.floor], fx2 = -Math.sin(P.yaw), fz2 = -Math.cos(P.yaw), maxD = clamp(6 + P.pitch * 8, 3, 11);
  let d = 0, lx = P.x, lz = P.z;
  while (d < maxD) { const nx = P.x + fx2 * (d + .25), nz = P.z + fz2 * (d + .25); if (!los(F.walls, P.x, P.z, nx, nz) || !los(F.doorWalls || [], P.x, P.z, nx, nz)) break; d += .25; lx = nx; lz = nz; }
  const m = mkCan(); m.scale.setScalar(1); scene.add(m);
  throws.push({ m, t: 0, dur: .45 + d * .05, a: camera.position.clone(), b: new THREE.Vector3(lx, F.y0 + .03, lz), f: P.floor, h: 1 + d * .12, kind: 'can' });
}
function updateThrows(dt) {
  for (let i = throws.length - 1; i >= 0; i--) {
    const T = throws[i]; T.t += dt; const k = Math.min(1, T.t / T.dur);
    T.m.position.lerpVectors(T.a, T.b, k); T.m.position.y += Math.sin(k * Math.PI) * T.h; T.m.rotation.x += dt * 14; T.m.rotation.z += dt * 9;
    if (k >= 1) {
      if (T.kind === 'visual') { T.m.parent?.remove(T.m); throws.splice(i, 1); continue; }
      at(T.b.x, T.b.y + .1, T.b.z).clank(1); fx.dust(T.b.x, T.b.y + .05, T.b.z, 6);
      const G = ghost;
      if (G.active && !G.enraged && G.floor === T.f && Math.hypot(G.x - T.b.x, G.z - T.b.z) < 30) { G.state = 'search'; G.target = { x: T.b.x, z: T.b.z }; G.path = []; G.replan = 0; G.wait = 0; G.hunt = null; G.lure2 = 6; say('깡— 소리가 복도에 울렸다', 1600); }
      T.m.rotation.set(Math.PI / 2, Math.random() * 6, 0); T.m.position.y = T.b.y; floors[T.f].interior.attach(T.m);
      throws.splice(i, 1);
    }
  }
}


// 조합 재료 줍기: 절연 테이프(공예실 · 별관 작업실 · 방송실) · 보건실 진정제(보건실 · 보건실 보조)
const PICK_SPOTS = [['tape', 2, -13.8, .87, -4.6], ['tape', 9, -18.0, .87, 4.8], ['tape', 1, 10.0, .02, 1.35], ['sedative', 0, -18.6, .02, .7], ['sedative', 8, 6.0, .02, 1.35]];
function spawnPicks() {
  const tapeG = new THREE.TorusGeometry(.06, .028, 8, 18), botG = new THREE.CylinderGeometry(.035, .035, .1, 12);
  const tapeM = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: .55 }), botM = new THREE.MeshStandardMaterial({ color: 0x8a5a24, roughness: .25, transparent: true, opacity: .9 });
  PICK_SPOTS.forEach(([item, f, x, y, z], i) => {
    if (!floors[f]) return; const m = item === 'tape' ? new THREE.Mesh(tapeG, tapeM) : new THREE.Mesh(botG, botM);
    if (item === 'tape') { m.rotation.x = Math.PI / 2; m.position.set(x, y + .03, z); } else m.position.set(x, y + .05, z);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .5 })); sp.scale.setScalar(.45); m.add(sp);
    m.userData.dynamic = true; floors[f].interior.add(m);
    world.props.push({ kind: 'pick', id: item + i, item, floor: f, x, z, y: y + .1, mesh: m, label: `${ITEMS[item].name} 줍기` });
  });
}
function usePick(p) { if (p.done) return; p.done = true; p.mesh.visible = false; giveItem(p.item, 1, true); sfx.pickup(); lootCard(ITEMS[p.item].icon, '조합 재료', ITEMS[p.item].name, ITEMS[p.item].desc); refreshHud(); save(true); }
// 오른쪽 클릭: 야간 카메라 켜기/끄기 · 카메라 모드에서 클릭: 촬영
addEventListener('contextmenu', e => { if (state === 'playing') e.preventDefault(); });
addEventListener('mousedown', e => {
  if (state !== 'playing' || (!document.pointerLockElement && !DEBUG)) return;
  if (e.button === 2) camMode(!CAM.on); else if (e.button === 0 && CAM.on) camShoot();
});

/* ---------- 3인칭 시점: 주인공 모델 ---------- */
// 캐릭터 시트 기반 3인칭 모델 — 관절(엉덩이 · 무릎 · 어깨 · 팔꿈치)이 있는 캡슐 인체
function buildPlayerModel(c) {
  const g = new THREE.Group(), j = c === 'jihun', H = j ? 1 : .955;   // 서연은 약간 작다
  const M = (col, r = .8, o = {}) => new THREE.MeshStandardMaterial({ color: col, roughness: r, ...o });
  const blazer = M(0x15171d, .7), shirt = M(0xe4e2da, .8), skin = M(0xe0b9a0, .55), hairM = M(j ? 0x0d0c0c : 0x2a1a14, .5);
  const pants = M(j ? 0x22262e : 0x15151a, .85), skirtM = M(0x4a4048, .9), sock = M(0x111114, .8), shoe = M(0xe8e6e0, .5), sole = M(0x2a2a2a, .7);
  const tie = M(0x7a1a22, .6), hood = M(0x6a6c70, .95), bag = M(j ? 0x111214 : 0xd8c4b4, .7);
  const cap = (r, h, m, seg = 12) => new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 6, seg), m);
  const at = (o, x, y, z, p) => { o.position.set(x, y, z); p.add(o); return o; };
  const root = new THREE.Group(); root.scale.setScalar(H); g.add(root);
  const hips = new THREE.Group(); hips.position.y = .92; root.add(hips);
  // 다리: 허벅지 → 무릎 → 정강이 → 발
  const legs = [], knees = [];
  [-1, 1].forEach(s => {
    const hip = new THREE.Group(); hip.position.set(s * .095, 0, 0); hips.add(hip);
    at(cap(j ? .068 : .058, .32, j ? pants : skin), 0, -.21, 0, hip);
    if (!j) at(cap(.066, .02, skirtM), 0, -.04, 0, hip).scale.set(1, .4, 1);
    const knee = new THREE.Group(); knee.position.y = -.43; hip.add(knee);
    at(cap(j ? .058 : .05, .3, j ? pants : sock), 0, -.2, 0, knee);
    const foot = new THREE.Group(); foot.position.y = -.42; knee.add(foot);
    at(new THREE.Mesh(new THREE.BoxGeometry(.1, .07, .26), shoe), 0, -.02, -.05, foot);
    at(new THREE.Mesh(new THREE.BoxGeometry(.105, .025, .27), sole), 0, -.06, -.05, foot);
    legs.push(hip); knees.push(knee);
  });
  // 치마 (서연) — 주름이 잡힌 짧은 원뿔
  if (!j) {
    const sk = new THREE.CylinderGeometry(.17, .27, .3, 28, 1, true), p = sk.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z) * (1 + .05 * Math.sign(Math.sin(a * 14)) * (p.getY(i) < 0 ? 1 : .2)); p.setXYZ(i, Math.cos(a) * r, p.getY(i), Math.sin(a) * r); }
    sk.computeVertexNormals(); const skm = new THREE.Mesh(sk, new THREE.MeshStandardMaterial({ color: 0x4a4048, roughness: .9, side: THREE.DoubleSide })); skm.position.y = -.05; hips.add(skm);
  }
  // 상체: 허리 → 가슴 (재킷 · 셔츠 · 넥타이/리본)
  const chest = new THREE.Group(); chest.position.y = .06; hips.add(chest);
  const torso = new THREE.LatheGeometry([[.13, 0], [.15, .08], [.175, .3], [.18, .42], [.13, .5], [.06, .52]].map(q => new THREE.Vector2(q[0], q[1])), 22);
  const tm = new THREE.Mesh(torso, blazer); tm.scale.set(1, 1, .7); chest.add(tm);
  at(new THREE.Mesh(new THREE.BoxGeometry(.1, .26, .02), shirt), 0, .36, -.118, chest);
  if (j) { at(new THREE.Mesh(new THREE.BoxGeometry(.035, .24, .02), tie), 0, .34, -.13, chest); const hd = new THREE.Mesh(new THREE.TorusGeometry(.12, .045, 8, 18, Math.PI), hood); hd.rotation.set(-.3, 0, 0); hd.position.set(0, .47, .07); chest.add(hd); }
  else { at(new THREE.Mesh(new THREE.BoxGeometry(.13, .045, .03), tie), 0, .44, -.13, chest); [-1, 1].forEach(s => { const t = at(new THREE.Mesh(new THREE.BoxGeometry(.03, .09, .02), tie), s * .025, .39, -.135, chest); t.rotation.z = s * .3; }); }
  // 가방
  at(new THREE.Mesh(new THREE.BoxGeometry(.28, .34, .13), bag), 0, .27, .18, chest);
  // 목 · 머리 · 머리카락
  at(cap(.045, .05, skin), 0, .57, 0, chest);
  const head = new THREE.Group(); head.position.y = .7; chest.add(head);
  const hm = at(new THREE.Mesh(new THREE.SphereGeometry(.1, 24, 18), skin), 0, 0, 0, head); hm.scale.set(.9, 1.08, .97);
  const hc = at(new THREE.Mesh(new THREE.SphereGeometry(.112, 24, 16, 0, Math.PI * 2, 0, Math.PI * .58), hairM), 0, .018, .012, head); hc.rotation.x = -.15;
  if (j) { for (let k = 0; k < 7; k++) { const f = at(new THREE.Mesh(new THREE.ConeGeometry(.03, .1, 5), hairM), -.07 + k * .023, .05, -.085, head); f.rotation.set(-2.3 + (k % 2) * .2, 0, (k - 3) * .08); } at(new THREE.Mesh(new THREE.BoxGeometry(.2, .1, .08), hairM), 0, -.04, .07, head); }
  else { at(new THREE.Mesh(new THREE.BoxGeometry(.2, .05, .05), hairM), 0, .06, -.085, head).rotation.x = .4; const tail = at(cap(.05, .3, hairM), .02, -.2, .1, head); tail.rotation.x = .15; [-1, 1].forEach(s => at(new THREE.Mesh(new THREE.BoxGeometry(.03, .22, .05), hairM), s * .095, -.07, -.02, head)); }
  // 팔: 어깨 → 팔꿈치 → 손
  const arms = [], elbows = [];
  [-1, 1].forEach(s => {
    const sh = new THREE.Group(); sh.position.set(s * .215, .44, 0); chest.add(sh);
    at(cap(.05, .2, blazer), 0, -.14, 0, sh);
    const el = new THREE.Group(); el.position.y = -.3; sh.add(el);
    at(cap(.044, .18, blazer), 0, -.12, 0, el);
    at(new THREE.Mesh(new THREE.SphereGeometry(.04, 10, 8), skin), 0, -.27, 0, el);
    arms.push(sh); elbows.push(el);
  });
  const torch = at(new THREE.Mesh(new THREE.CylinderGeometry(.022, .02, .2, 12).rotateX(Math.PI / 2), M(0x2a2a2e, .4, { metalness: .6 })), 0, -.28, -.08, elbows[1]);
  const hand = new THREE.Object3D(); hand.position.set(0, -.28, -.2); elbows[1].add(hand);
  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });
  g.visible = false; scene.add(g);
  npcLoad(c, g, { url: `assets/characters/${c}.glb`, height: j ? 1.75 : 1.62, native: true, yawDegrees: 180, clipNames: ['idle'] });
  return { g, root, hips, chest, legs, knees, arms, elbows, head, hand, torch };
}
let pm = null, view = SET.view === 3 ? 3 : 1, camDistNow = 0;
function ensureModel() { if (!pm || pm.char !== CHAR) { if (pm) scene.remove(pm.g); pm = buildPlayerModel(CHAR); pm.char = CHAR; } }
function toggleView() {
  view = view === 3 ? 1 : 3; const t = $('viewTag'); t.textContent = view === 3 ? '3인칭 시점' : '1인칭 시점'; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 1400);
}
const _hand = new THREE.Vector3();
// 카메라 배치 후 호출: 3인칭이면 모델을 움직이고 카메라를 어깨 뒤로 뺀다
function applyThirdPerson(dt, yaw, pitch) {
  ensureModel();
  if(P.inElev)camDistNow=0;
  const third = view === 3 && !P.inElev && !P.hiding && state !== 'dead' && state !== 'intro' && state !== 'menu';
  camDistNow = lerp(camDistNow, third ? SET.camDist : 0, Math.min(1, dt * 7));
  const F = floors[P.floor];
  if (camDistNow < .05) { pm.g.visible = false; const rk = INT_ANIM.reachK || 0; flash.position.set(.12 - rk * .03, -.08 + rk * .025, -rk * .08); fx.cone.position.set(.12 - rk * .03, -.08 + rk * .025, -.15 - rk * .08); return; }
  const fx3 = -Math.sin(yaw) * Math.cos(pitch), fy3 = Math.sin(pitch), fz3 = -Math.cos(yaw) * Math.cos(pitch), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const pivY = F.y0 + 1.62 - (P.crouchK || 0) * .5 + (P.jy || 0) + (P.shV || 0);
  let d = camDistNow; const side = .42 * Math.min(1, camDistNow / 1.2);
  const ok = (x, z) => los(F.walls, P.x, P.z, x, z) && los(F.doorWalls || [], P.x, P.z, x, z);
  let cx, cz;
  for (; d > .3; d -= .12) { cx = P.x - fx3 * d + rx * side; cz = P.z - fz3 * d + rz * side; const ex = cx - fx3 * .25, ez = cz - fz3 * .25; if (ok(cx, cz) && ok(ex, ez)) break; }
  if (d <= .3) { cx = P.x; cz = P.z; d = 0; }
  let cy = pivY - fy3 * d + .18; const ceil = P.floor === 3 || (P.floor === 0 && isOutdoors()) ? 60 : (P.floor === 5 ? 7.5 : P.floor === 6 ? 5.8 : 3.0);
  cy = clamp(cy, F.y0 + .35 + (P.shV || 0), F.y0 + ceil - .15 + (P.shV || 0));
  camera.position.set(cx, cy, cz);
  // 모델 — 걷기 · 달리기 · 웅크리기 · 점프 자세
  const g = pm.g; g.visible = d > .55; g.position.set(P.x, F.y0 + (P.jy || 0) + (P.shV || 0), P.z); g.rotation.y = yaw;
  const cr = P.crouchK || 0, air = (P.jy || 0) > .02, run = P.sprinting ? 1 : 0;
  const ph = P.bob * 1.0, amp = P.moving ? (run ? .8 : .5) * (1 - cr * .4) : 0;
  const sw = Math.sin(ph) * amp, breath = Math.sin(tNow * 1.8) * .018;
  pm.hips.position.y = .92 - cr * .32 + (P.moving ? Math.abs(Math.cos(ph)) * .028 : breath * .4);
  pm.hips.rotation.y = P.moving ? sw * .14 : Math.sin(tNow * .9) * .02;
  pm.chest.rotation.x = cr * .35 + run * .20 + breath;
  pm.chest.rotation.y = P.moving ? -sw * .18 : 0;
  pm.legs.forEach((l, i) => { const s2 = i ? -sw : sw; l.rotation.x = (air ? -.7 : 0) + s2 - cr * 1.05; });
  pm.knees.forEach((k, i) => { const s2 = i ? -Math.sin(ph) : Math.sin(ph); k.rotation.x = (air ? 1.1 : 0) + Math.max(0, s2) * amp * 1.2 + cr * 1.7; });
  const rk = INT_ANIM.reachK || 0;
  pm.arms[0].rotation.x = -sw * .9 - cr * .3 - rk * 1.15; pm.arms[0].rotation.z = .1 - rk * .08; pm.elbows[0].rotation.x = -.25 - run * .9 - rk * .45;
  pm.arms[1].rotation.x = P.light ? -1.2 - pitch * .8 : sw * .9; pm.arms[1].rotation.z = -.1; pm.elbows[1].rotation.x = P.light ? -.15 : -.25 - run * .9;
  pm.head.rotation.x = -pitch * .45 - pm.chest.rotation.x * .6;
  pm.torch.visible = !g.userData.characterModel;
  if (g.userData.characterModel) {
    const wantClip = P.moving ? (run ? 'Run' : 'Walk') : 'Idle';
    const wantSpd = P.moving ? (run ? 1.15 : (cr > .3 ? .75 : 1.0)) : 1.0;
    if (g.userData.curPlayerClip !== wantClip) {
      g.userData.curPlayerClip = wantClip;
      npcVisuals.play(g, wantClip, { fade: .2, speed: wantSpd });
    }
    g.userData.characterModel.position.y = -cr * .34;
    g.userData.characterModel.rotation.x = -cr * .22;
  }
  camera.updateMatrixWorld(); g.updateMatrixWorld(true);
  pm.hand.getWorldPosition(_hand); camera.worldToLocal(_hand);
  _hand.z -= .45; flash.position.copy(_hand); _hand.z -= .25; fx.cone.position.copy(_hand);
}

/* ---------- 추가 이벤트 ---------- */
const staticTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 48; const t = new THREE.CanvasTexture(c); t.userData.c = c; return t; })();
function drawStatic(text) {
  const c = staticTex.userData.c, g = c.getContext('2d'), im = g.createImageData(64, 48);
  for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 200; im.data[i] = v * .8; im.data[i + 1] = v; im.data[i + 2] = v * .9; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0);
  if (text) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 16, 64, 16); g.fillStyle = '#ff4040'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center'; g.fillText(text, 32, 28); }
  staticTex.needsUpdate = true;
}
const screens = [];
{ // 컴퓨터실(2층) 모니터 위에 화면 패널 — 평소엔 꺼져 있다 (world 가 모니터 화면 위치를 알려 준다)
  const scrM = new THREE.MeshBasicMaterial({ map: staticTex, toneMapped: false });
  (floors[1].pcScreens || []).forEach(p => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), scrM); m.position.set(p.x, p.y, p.z); m.rotation.y = p.ry; m.visible = false; m.userData.dynamic = true; floors[1].interior.add(m); screens.push(m);
  });
}
let screenT = 0;
const footM = new THREE.MeshStandardMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = 32; c.height = 64; const g = c.getContext('2d'); g.fillStyle = 'rgba(10,14,16,.9)'; g.beginPath(); g.ellipse(16, 40, 9, 18, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(16, 12, 7, 9, 0, 0, 7); g.fill(); const t = new THREE.CanvasTexture(c); return t; })(), transparent: true, roughness: .1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const feet = [];
function spawnFootprints(f, x0, z0, dir) {
  for (let k = 0; k < 10; k++) setTimeout(() => {
    if (P.floor !== f) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.13, .26), footM.clone()); m.rotation.set(-Math.PI / 2, 0, dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    m.position.set(x0 + dir * k * .55, .015, z0 + (k % 2 ? .13 : -.13)); floors[f].interior.add(m); feet.push({ m, t: 25 }); if (k % 2 === 0) sfx.drip();
  }, k * 380);
}
function updateFeet(dt) { for (let i = feet.length - 1; i >= 0; i--) { const F = feet[i]; F.t -= dt; if (F.t < 3) F.m.material.opacity = Math.max(0, F.t / 3); if (F.t <= 0) { F.m.parent && F.m.parent.remove(F.m); F.m.material.dispose(); feet.splice(i, 1); } } }
const fallTiles = [];
function dropCeilingTile(f, x, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(.6, .02, .6), new THREE.MeshStandardMaterial({ color: 0x9a968a, roughness: .95 }));
  m.position.set(x, 2.9, z); floors[f].interior.add(m); fallTiles.push({ m, v: 0, f, x, z });
  fx.dust(x, floors[f].y0 + 2.9, z, 30);
}
function updateFallTiles(dt) {
  for (let i = fallTiles.length - 1; i >= 0; i--) {
    const T = fallTiles[i]; T.v += 9.8 * dt; T.m.position.y -= T.v * dt; T.m.rotation.x += dt * 2; T.m.rotation.z += dt * 1.3;
    if (T.m.position.y <= .02) { T.m.position.y = .02; T.m.rotation.set(0, Math.random() * 3, 0); sfx.crumble(); fx.dust(T.x, floors[T.f].y0 + .1, T.z, 70); if (P.floor === T.f && Math.hypot(P.x - T.x, P.z - T.z) < 6) shake = .5; fallTiles.splice(i, 1); }
  }
}
let phoneProp = null;
{ phoneProp = { kind: 'phone', floor: 0, x: SLOTS[3] - 2.05, z: -5.5, y: .9, label: '울리는 전화 받기', done: true, ring: false }; world.props.push(phoneProp);
  const g = new THREE.Group(), beige = new THREE.MeshStandardMaterial({ color: 0xc8bfa8, roughness: .5 }); g.position.set(phoneProp.x, .76, -5.5); g.rotation.y = -Math.PI / 2; g.userData.dynamic = true; floors[0].interior.add(g);
  const base = new THREE.Mesh(new THREE.BoxGeometry(.2, .07, .22), beige); base.position.y = .035; g.add(base);
  const hs = new THREE.Mesh(new THREE.BoxGeometry(.22, .04, .06), beige); hs.position.set(0, .09, -.04); g.add(hs);
  [-.1, .1].forEach(x => { const e = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .05, 10), beige); e.position.set(x, .08, -.04); g.add(e); });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(.1, .08), new THREE.MeshStandardMaterial({ map: makeKeypad(), roughness: .6 })); pad.rotation.x = -Math.PI / 2 + .3; pad.position.set(0, .075, .06); g.add(pad);
  phoneProp.mesh = hs; }
// 기억의 잔상: 따뜻한 빛으로 된 두 학생의 실루엣이 잠깐 나타나 대화하고 사라진다
let echo = null;
function updateEcho(dt) {
  if (!echo) return;
  echo.t += dt; const t = echo.t, a = t < 1.5 ? t / 1.5 : t < 11 ? 1 : Math.max(0, 1 - (t - 11) / 2.5);
  echo.mat.opacity = a * (.32 + Math.sin(t * 7) * .03); echo.glow.material.opacity = a * .35;
  if (t > 13.6) { echo.grp.parent.remove(echo.grp); echo = null; fx.glitch(.2); }
}
let hintT = 0, hintKey = '';
function updateEvents2(dt) {
  updateEcho(dt);
  updateTips(dt); updateSafe(dt); perkCD -= dt;
  // 4분 동안 목표가 바뀌지 않으면 힌트
  const o = objective(), k = o.main + (o.loc ? o.loc.where : '');
  if (k !== hintKey) { hintKey = k; hintT = 0; } else if ((hintT += dt) > 240) { hintT = 0; toast('💡 힌트', o.loc ? `${o.main} — ${o.loc.where}` : o.main, 'info'); }
  updateThrows(dt); updateFeet(dt); updateFallTiles(dt); extrasTick(dt);
  if (screenT > 0) { screenT -= dt; if (Math.random() < .5) drawStatic(screenT < 3.5 ? '다시, 여기서' : null); if (screenT <= 0) screens.forEach(s => { s.visible = false; }); }
  if (phoneProp.ring) { phoneProp.mesh.position.y = .09 + (Math.sin(tNow * 60) > .6 ? .008 : 0); phoneProp.ringT -= dt; if (phoneProp.ringT <= 0) { phoneProp.ringT = 2.2; if (P.floor === 0) { at(phoneProp.x, 1, phoneProp.z).phone(); caption('교무실 전화벨'); } } phoneProp.life -= dt; if (phoneProp.life <= 0) { phoneProp.ring = false; phoneProp.done = true; } }
}
/* ---------- 심리적 공포: 따라오는 발소리 · 바뀐 칠판 · 시야 끝의 그림자 · 이름을 부르는 속삭임 ---------- */
function moreEvents(f, room, step) {   // 초자연 현상 연출은 모두 걷어 내고, 이야기 진행에 필요한 장면만 남긴다
  if (state !== 'playing' || isSpeechBusy() || voBusy) return;
  // 도서실: 마지막 반납 (대출 카드를 읽은 뒤 다시 오면 — 다음 쪽지가 나타난다)
  if (room && room.type === 'library' && f === 0 && docs.some(d => d.id === 'n4') && EV.roomT > 2) evOnce('libReturn', libraryReturn);
  // 지하 비밀 자료실: 그날 밤의 방 (그것은 들어오지 못한다)
  if (f === 4 && P.z > 2.1) evOnce('secretRoom', () => { storyCalm(80); caption('공기가 멈춘 방. 벽의 사진들이 모두 같은 밤을 찍었다'); });
  // 지하 보일러실: 전력이 돌아온 뒤 보일러가 다시 불붙는다
  if (f === 4 && power && room && room.type === 'boiler' && EV.roomT > 1) evOnce('boilerFire', () => { sfx.boom(.6); shake = .5; fx.dust(room.cx - 1.8, floors[4].y0 + 2.4, -6.5, 40); caption('쿠르릉— 전력이 돌아오자 보일러에 불이 붙었다'); });
  // 3-2 — 하늘의 교실 (그것은 이 방에 들어오지 않는다)
  if (room && room.south && room.name === '3-2') { evOnce('room32', () => { storyCalm(120); caption('국화가 놓인 책상 하나 — 윤하늘의 자리'); }); ghost.calmT = Math.max(ghost.calmT || 0, 3); }
  if (f === 5) evOnce('gymEcho', () => caption('체육관 — 작은 소리도 크게 울린다'));
}
// ⑮ 번개가 칠 때 창밖(운동장 쪽)에 누군가 서 있다
function lightningEvent() { lightFlash = 1; }
let lightFlash = 0;

/* ---------- 첫 10분 튜토리얼 팁 (장면 안에서 한 번씩) ---------- */
const TIPS = [
  { id: 'move', when: () => playTime > 2, text: '<kbd>W A S D</kbd> 이동 · 마우스 시선 · <kbd>Shift</kbd> 달리기 (소리가 납니다)' },
  { id: 'flash', when: () => playTime > 9, text: '<kbd>F</kbd> 손전등 — 배터리는 켜 둔 만큼 닳습니다' },
  { id: 'interact', when: () => !!target && target.type !== 'stairs', text: '<kbd>E</kbd> 조사 — 쪽지 · 문 · 사물함 · 장치' },
  { id: 'map', when: () => gateClosed && playTime > 20, text: '<kbd>M</kbd> 지도(★ 현재 목표) · <kbd>Tab</kbd> 소지품 · <kbd>P</kbd> 휴대폰' },
  { id: 'hide', when: () => world.lockers.some(l => l.floor === P.floor && Math.hypot(l.x - P.x, l.z - P.z) < 2.6), text: '복도와 교실의 사물함에서 <kbd>E</kbd> 를 눌러 수집품·퀘스트아이템·생존물품을 파밍할 수 있다' },
  { id: 'safe', when: () => !!safeRoomAt(), text: '<b>쉼터</b> — 들어오면 자동 저장된다' },
  { id: 'can', when: () => inv.can > 0, text: '<kbd>G</kbd> 빈 캔 던지기 — 떨어진 곳에서 소리가 난다' },
  { id: 'combine', when: () => P.keys >= TOTAL || (FL.mop && FL.wire), text: '<kbd>Tab</kbd> 소지품 › 아이템 선택 › <kbd>C</kbd> 조합 › 상대 아이템 선택' },
  { id: 'crouch', when: () => playTime > 30, text: '<kbd>C</kbd> 앉기 — 느리지만 발소리가 거의 없고 잘 보이지 않는다 · <kbd>Space</kbd> 점프' },
  { id: 'view', when: () => playTime > 240, text: '<kbd>V</kbd> 1인칭 / 3인칭 시점 전환' },
];
let tipT = 0, tipShowT = 0;
function updateTips(dt) {
  tipShowT -= dt; if (tipShowT <= 0) $('tip').classList.remove('show');
  if (!SET.tips || state !== 'playing' || performance.now() < startQuietT || (tipT -= dt) > 0) return; tipT = .5;
  if (tipShowT > 0) return;
  const t = TIPS.find(x => !tipsDone.has(x.id) && x.when()); if (!t) return;
  tipsDone.add(t.id); $('tipText').innerHTML = t.text; $('tip').classList.add('show'); tipShowT = 6.5; sfx.ui();
}
/* ---------- 효과음 자막 ([발소리] 등) ---------- */
let capTimer = 0;
function caption(text) {
  if (!SET.captions || recent('c:' + text, 25)) return;
  if (isDialogueActive()) {
    setTimeout(() => {
      if (!isDialogueActive() && SET.captions) {
        logLine('·', text);
        const el = $('cap'); el.textContent = `[${text}]`; el.classList.add('show'); clearTimeout(capTimer); capTimer = setTimeout(() => el.classList.remove('show'), 2600);
      }
    }, 3200);
    return;
  }
  logLine('·', text);
  const el = $('cap'); el.textContent = `[${text}]`; el.classList.add('show'); clearTimeout(capTimer); capTimer = setTimeout(() => el.classList.remove('show'), 2600);
}
/* ---------- 안전 구역: 그것이 들어오지 않는 방 (보건실 · 별관 진로상담실) ---------- */
const SAFE_ROOMS = [{ f: 0, cx: SLOTS[1], name: '상담실', south: false }, { f: 8, cx: ANNEX.slots[1], name: '보건실', south: false }, { f: 8, cx: ANNEX.slots[4], name: '진로상담실', south: true }];
const safeRoomAt = (f = P.floor, x = P.x, z = P.z) => SAFE_ROOMS.find(r => r.f === f && Math.abs(x - r.cx) < 3.9 && (r.south ? (z > 1.9 && z < 9.5) : (z < -1.9 && z > -9.5)));
let safeSaveT = 0, wasSafe = false;
function updateSafe(dt) {
  const s = state === 'playing' && safeRoomAt(); safeSaveT -= dt;
  $('safeTag').classList.toggle('show', !!s);
  if (s && !wasSafe) { caption('안전 구역 — 숨이 고르게 돌아온다'); if (safeSaveT <= 0) { safeSaveT = 60; save(true); } }
  wasSafe = !!s;
  if (s) { P.fear = Math.max(0, P.fear - dt * .5); P.stamina = Math.min(100, P.stamina + 10 * dt); }
}
/* ---------- 능력 발동 피드백 ---------- */
let perkCD = 0;
function perkFlash(text) { if (perkCD > 0) return; perkCD = 8; const el = $('perkTag'); el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); sfx.tension(.2); }
/* ---------- 마지막 방송: 그날 밤의 녹음 조각을 순서대로 복원 ---------- */
const TAPE_FRAGS = [
  { id: 'a', t: '23:05', text: '“…담력 체험 시작. 하늘이 들어갔다. 문 잠갔어. 10분만 있다가 열어 주자.”' },
  { id: 'b', t: '23:20', text: '“…정전이다! 다들 나가, 빨리! …하늘이는? 하늘이는 누가 꺼냈어?”' },
  { id: 'c', t: '23:30', text: '“…펌프실 문이 밖에서 잠겨 있습니다. 열쇠는… 교무부장님이 가져가셨습니다.”' },
  { id: 'd', t: '23:40', text: '“…3학년 2반 윤하늘. 오늘 방송은… 오늘 하루도 수고 많—” (끊김)' },
];
/* ---------- 도서실 · 수영장 대표 장면 ---------- */
function libraryReturn() {
  const it = world.items.find(i => i.kind === 'note' && i.id === 'n26'); if (!it || !it.locked) return;
  it.locked = false; it.mesh.visible = true; say('반납대 위에 대출 카드 한 장이 끼워져 있다', 2600);
}

/* ---------- 성능 / 그래픽 품질 ---------- */
const QUAL = { ultra: { pr: 2, sh: 2048, label: '최고' }, high: { pr: 1.5, sh: 1024, label: '높음' }, mid: { pr: 1, sh: 512, label: '보통' }, low: { pr: 1, sh: 0, label: '낮음' } };
let perfUp = 0; const perfDowned = {};
let qCur = SET.quality === 'auto' ? 'mid' : SET.quality, perfAcc = 0, perfN = 0, perfWin = 0, fpsShown = 60;
function applyQuality(q) {
  qCur = q; const c = SET.quality === 'auto' && q === 'low' ? { pr: .85, sh: 256 } : QUAL[q];   // 자동 조정: 그림자를 끄면 모든 재질 셰이더를 다시 만들어 수 초 멈춘다 → 끄지 않고 해상도 · 그림자 크기만 줄인다
  const q3 = q === 'ultra' ? 'high' : q;   // 텍스처 예산 · 후처리는 high 와 같은 단계 (픽셀 비율 · 그림자만 더 높다)
  if (SET.quality !== 'auto' || !textureBudget._autoSet) { textureBudget._autoSet = SET.quality === 'auto'; textureBudget.setQuality(SET.quality === 'auto' ? 'high' : q === 'ultra' ? 'ultra' : q3).catch(e => console.warn('[texture budget]', e)); }   // 자동 품질이 오르내릴 때마다 모든 텍스처를 줄였다 다시 올리며(수백 장 재업로드) 렉이 반복됐다 → 자동 조정은 해상도 · 그림자만
  renderer.setPixelRatio(Math.min(devicePixelRatio, c.pr) * SET.scale); renderer.setSize(innerWidth, innerHeight); fx.resize(innerWidth, innerHeight, renderer.getPixelRatio()); fx.setQuality(q3);
  const sh = c.sh > 0;
  if (sh && flash.shadow.mapSize.x !== c.sh) { flash.shadow.mapSize.set(c.sh, c.sh); if (flash.shadow.map) { flash.shadow.map.dispose(); flash.shadow.map = null; } }
  if (renderer.shadowMap.enabled !== sh || flash.castShadow !== sh) {
    renderer.shadowMap.enabled = sh; flash.castShadow = sh;
    scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); });
  }
}
function perfTick(dt) {
  if (state !== 'playing') return;
  perfAcc += dt; perfN++; perfWin += dt;
  if (perfWin >= 2.5) {
    const fps = perfN / perfAcc; fpsShown = fps; perfAcc = 0; perfN = 0; perfWin = 0;
    $('fps').textContent = `${fps.toFixed(0)} FPS · ${QUAL[qCur].label}`;
    if (SET.quality === 'auto' && fps < 38 && qCur !== 'low') { perfUp = 0; applyQuality(qCur === 'high' ? 'mid' : 'low'); toast('그래픽 품질 자동 조정', `${QUAL[qCur].label}(으)로 낮췄습니다`, 'info'); }
    else if (SET.quality === 'auto' && fps > 56 && qCur !== 'high' && !perfDowned[qCur]) { if (++perfUp >= 3) { perfUp = 0; const from = qCur; applyQuality(qCur === 'low' ? 'mid' : 'high'); perfDowned[from] = false; toast('그래픽 품질 자동 조정', `여유가 있어 ${QUAL[qCur].label}(으)로 올렸습니다`, 'info'); } }
    else perfUp = 0;
    if (SET.quality === 'auto' && fps < 38) perfDowned[qCur] = (perfDowned[qCur] || 0) + 1;
  }
}
// 설정을 실제 화면 · 조작에 반영
function applySettings() {
  renderer.toneMappingExposure = 1.3 * SET.bright;
  world.flickCfg.calm = SET.flashReduce || SET.noFlicker;
  fx.setOpts({ bloom: SET.bloom, grain: SET.grain, glitch: SET.flashReduce ? .2 : 1, flash: SET.flashReduce ? .25 : 1 });
  $('fps').classList.toggle('on', SET.showFps || TEST); $('ptime').classList.toggle('off', SET.showPlay === false); $('hints').style.display = SET.hints ? '' : 'none';
  document.documentElement.style.setProperty('--subBg', SET.subBg);
  document.body.classList.toggle('noNames', !SET.subNames); document.body.classList.toggle('contrast', !!SET.contrast);
  document.documentElement.style.setProperty('--ui', SET.ui);
  if (state !== 'playing') { camera.fov = SET.fov; camera.updateProjectionMatrix(); }
}
/* ---------- 의뢰 (서브 퀘스트): 교실마다 남겨진 부탁 — story.js SIDEQUESTS ----------
   진행은 FL.sq[id] = 현재 단계(0 = 아직 시작 전, steps.length = 완료) · 퀘스트 아이템은 FL.qi — FL 째로 저장된다.
   단계마다 조사 지점(prop kind 'sq')을 하나씩 만들고, 지금 단계의 지점만 활성화한다 */
const sqStep = id => (FL.sq && FL.sq[id]) || 0;
const sqDoneCount = () => SIDEQUESTS.filter(q => sqStep(q.id) >= q.steps.length).length;
const sqProps = [];
{ // 방 이름 → 방 중심 · 남쪽 줄 여부
  const roomOf = (f, name) => {
    const clean = s => String(s || '').replace(/\s*\(.*\)$/, '').trim();
    const order = [f, 0, 1, 2, 4, 8, 9, 10];
    for (const qf of order) {
      const an = qf >= 8, rows = an ? [[ANNEX.floors[qf - 8], ANNEX.slots, false], [ANNEX_S[qf - 8], ANNEX.slots, true]] : [[LAYOUT[qf], SLOTS, false], [LAYOUT_S[qf], SLOTS, true]];
      for (const [L, sl, south] of rows) {
        if (!L) continue;
        let i = L.names.indexOf(name);
        if (i < 0) i = L.names.findIndex(n => clean(n) === clean(name));
        if (i >= 0) return { f: qf, cx: sl[i], south };
      }
    }
    return null;
  };
  // 가구 · 벽 충돌을 피해 비어 있는 자리로 옮기되, 방(rm)이 지정된 경우 절대 복도나 옆방으로 벽을 뚫고 나가지 않도록 방 내부 경계로 제한한다!
  const freeSpot = (F, x, z, r = .32, rm = null) => {
    const inBounds = (a, b) => {
      if (!rm) return true;
      if (Math.abs(a - rm.cx) > 3.35) return false;
      return rm.south ? (b >= 2.25 && b <= 8.95) : (b <= -2.25 && b >= -8.95);
    };
    const hit = (a, b) => !inBounds(a, b) || F.col.some(c => a > c.x1 - r && a < c.x2 + r && b > c.z1 - r && b < c.z2 + r);
    if (!hit(x, z)) return [x, z];
    for (let k = 1; k < 18; k++) for (let a = 0; a < 12; a++) {
      const ang = a * (Math.PI * 2 / 12);
      const ax = x + Math.cos(ang) * k * .18, az = z + Math.sin(ang) * k * .18;
      if (!hit(ax, az)) return [ax, az];
    }
    return rm ? [Math.max(rm.cx - 3.2, Math.min(rm.cx + 3.2, x)), rm.south ? Math.max(2.4, Math.min(8.8, z)) : Math.max(-8.8, Math.min(-2.4, z))] : [x, z];
  };
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .75, ...o });
  const boardTex98 = (() => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 384;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#f2ead4'; ctx.fillRect(0, 0, 512, 384);
    ctx.strokeStyle = '#3b2818'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 502, 374);
    ctx.fillStyle = '#1d4430'; ctx.fillRect(18, 18, 476, 54);
    ctx.fillStyle = '#f8efd8'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('★ 1998학년도 3년 개근 도전 현황판 ★', 256, 53);
    ctx.fillStyle = '#2c2218'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('성명 : 윤 하 늘 (무결석 개근 도전 중)', 28, 100);
    ctx.strokeStyle = '#7a6c55'; ctx.lineWidth = 2;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      const bx = 28 + c * 76, by = 116 + r * 76;
      ctx.strokeRect(bx, by, 70, 68);
      ctx.fillStyle = '#5a4e3c'; ctx.font = '12px sans-serif';
      ctx.fillText((r * 6 + c + 1) + '주차', bx + 6, by + 16);
      const isLast = r === 2 && c === 5;
      if (!isLast) {
        ctx.fillStyle = '#d98a18'; ctx.font = 'bold 30px sans-serif';
        ctx.fillText('★', bx + 20, by + 54);
      } else {
        ctx.fillStyle = '#a82820'; ctx.font = 'bold 13px sans-serif';
        ctx.fillText('10.13 공란', bx + 5, by + 46);
      }
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const mkLabelTex = (bg, border, title, sub, lines = []) => {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 320;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 256, 320);
    ctx.strokeStyle = border; ctx.lineWidth = 8; ctx.strokeRect(8, 8, 240, 304);
    ctx.fillStyle = border; ctx.fillRect(20, 24, 216, 44);
    ctx.fillStyle = '#f8f2e4'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(title, 128, 53);
    ctx.fillStyle = '#2b241c'; ctx.font = 'bold 15px sans-serif';
    ctx.fillText(sub, 128, 96);
    ctx.strokeStyle = 'rgba(60,50,40,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const y = 126 + i * 24;
      ctx.beginPath(); ctx.moveTo(28, y); ctx.lineTo(228, y); ctx.stroke();
      if (lines[i]) {
        ctx.fillStyle = '#3a2e22'; ctx.font = '13px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(lines[i], 32, y - 5);
      }
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const bookCoverTex = mkLabelTex('#4e2022', '#d4af37', '1998 학급 출석부', '서문고등학교 제3학년', ['담임 : 정 은 수', '학급 인원 : 36명', '10월 13일 : 윤하늘']);
  const docSheetTex = mkLabelTex('#f3ebd8', '#3c4e5c', '1998 방송부 기록서', '창립 30주년 기념방송', ['일시 : 1998. 10. 12', '장소 : 4층 방송실 / B1', '담당 : 3-2 윤하늘']);
  const letterEnvTex = mkLabelTex('#f6efe0', '#8c3b32', '하늘이 어머님께', '3학년 2반 담임 정은수 올림', ['학교의 발표는 사실이', '아닙니다. 하늘이는', '그날 밤 학교에 있었습니다.']);

  // 받침대 상판 높이 = 0.472m 에 모든 오브젝트 바닥이 오차 0.0mm 로 완벽히 밀착되도록 설계 (공중부양 · 깨진 블록 현상 100% 제거!)
  const TOP_Y = 0.472;
  const LOOK = {
    board: () => {
      const g = new THREE.Group();
      // 하단 원목 받침대 베이스 (상판 위에 단단히 고정!)
      const base = new THREE.Mesh(new THREE.BoxGeometry(.44, .03, .16), M(0x3b2414, { roughness: .5 }));
      base.position.set(0, TOP_Y + .015, 0); g.add(base);
      [-0.16, 0.16].forEach(px => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(.035, .10, .035), M(0x3b2414));
        post.position.set(px, TOP_Y + .06, 0); g.add(post);
      });
      // 정면 수직 원목 프레임 + 개근 스티커판 캔버스 텍스처 (기울어져 깨져 보이지 않도록 깔끔한 수직 스탠드형!)
      const frame = new THREE.Mesh(new THREE.BoxGeometry(.54, .38, .032), M(0x3b2414, { roughness: .5 }));
      frame.position.set(0, TOP_Y + .25, 0); g.add(frame);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(.49, .33), new THREE.MeshStandardMaterial({ map: boardTex98, roughness: .6 }));
      face.position.set(0, TOP_Y + .25, .018); g.add(face);
      const faceBack = new THREE.Mesh(new THREE.PlaneGeometry(.49, .33), new THREE.MeshStandardMaterial({ map: boardTex98, roughness: .6 }));
      faceBack.position.set(0, TOP_Y + .25, -.018); faceBack.rotation.y = Math.PI; g.add(faceBack);
      return g;
    },
    book: () => {
      const g = new THREE.Group();
      const pages = new THREE.Mesh(new THREE.BoxGeometry(.25, .042, .33), M(0xf2ead8, { roughness: .85 }));
      pages.position.set(.006, TOP_Y + .024, 0); g.add(pages);
      const covBot = new THREE.Mesh(new THREE.BoxGeometry(.265, .008, .345), M(0x4e2022, { roughness: .6 }));
      covBot.position.set(0, TOP_Y + .004, 0); g.add(covBot);
      const covTop = new THREE.Mesh(new THREE.BoxGeometry(.265, .008, .345), new THREE.MeshStandardMaterial({ map: bookCoverTex, roughness: .55 }));
      covTop.position.set(0, TOP_Y + .046, 0); g.add(covTop);
      const spine = new THREE.Mesh(new THREE.BoxGeometry(.016, .050, .345), M(0x361416, { roughness: .5 }));
      spine.position.set(-.126, TOP_Y + .025, 0); g.add(spine);
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(.018, .004, .09), M(0xb82420));
      ribbon.position.set(.04, TOP_Y + .01, .19); g.add(ribbon);
      return g;
    },
    tape: () => {
      const g = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.BoxGeometry(.18, .026, .115), M(0x222428, { roughness: .4, metalness: .3 }));
      shell.position.set(0, TOP_Y + .013, 0); g.add(shell);
      const label = new THREE.Mesh(new THREE.BoxGeometry(.15, .004, .075), M(0xebe2cc));
      label.position.set(0, TOP_Y + .027, -.006); g.add(label);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(.15, .005, .018), M(0xc83828));
      stripe.position.set(0, TOP_Y + .0275, -.026); g.add(stripe);
      [-.042, .042].forEach(rx => {
        const reel = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .030, 12), M(0xf0f0f0));
        reel.position.set(rx, TOP_Y + .014, 0); g.add(reel);
      });
      return g;
    },
    deck: () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(.42, .11, .28), M(0x282c32, { roughness: .42, metalness: .45 }));
      body.position.set(0, TOP_Y + .055, 0); g.add(body);
      const faceplate = new THREE.Mesh(new THREE.BoxGeometry(.38, .08, .012), M(0x181a1e, { metalness: .3 }));
      faceplate.position.set(0, TOP_Y + .058, .142); g.add(faceplate);
      const well = new THREE.Mesh(new THREE.BoxGeometry(.16, .06, .016), M(0x3a4652, { roughness: .2 }));
      well.position.set(-.08, TOP_Y + .06, .144); g.add(well);
      [-0.02, 0.015, 0.05, 0.085].forEach((bx, i) => {
        const btn = new THREE.Mesh(new THREE.BoxGeometry(.026, .018, .024), M(i === 0 ? 0xc83228 : 0x9aa2a8, { metalness: .5 }));
        btn.position.set(bx, TOP_Y + .018, .148); g.add(btn);
      });
      [0.12, 0.16].forEach(kx => {
        const knob = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .022, 12), M(0xd0d4d8, { metalness: .7 }));
        knob.rotation.x = Math.PI / 2; knob.position.set(kx, TOP_Y + .065, .148); g.add(knob);
      });
      return g;
    },
    letter: () => {
      const g = new THREE.Group();
      const pad = new THREE.Mesh(new THREE.BoxGeometry(.30, .012, .22), M(0x523622, { roughness: .65 }));
      pad.position.set(0, TOP_Y + .006, 0); g.add(pad);
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(.25, .008, .18), new THREE.MeshStandardMaterial({ map: letterEnvTex, roughness: .75 }));
      sheet.position.set(-.01, TOP_Y + .016, 0); g.add(sheet);
      const seal = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .006, 12), M(0xa8201a, { roughness: .4 }));
      seal.position.set(.06, TOP_Y + .022, .03); g.add(seal);
      return g;
    },
    paper: () => {
      const g = new THREE.Group();
      // 원목 클립보드 + 금속 집게 + 인쇄 문서 시트
      const board = new THREE.Mesh(new THREE.BoxGeometry(.28, .014, .36), M(0x6e4726, { roughness: .55 }));
      board.position.set(0, TOP_Y + .007, 0); g.add(board);
      const doc = new THREE.Mesh(new THREE.BoxGeometry(.24, .008, .31), new THREE.MeshStandardMaterial({ map: docSheetTex, roughness: .75 }));
      doc.position.set(0, TOP_Y + .017, .01); g.add(doc);
      const clip = new THREE.Mesh(new THREE.BoxGeometry(.09, .022, .035), M(0xb8c0c8, { metalness: .8, roughness: .25 }));
      clip.position.set(0, TOP_Y + .024, -.145); g.add(clip);
      return g;
    },
    drawer: () => {
      const g = new THREE.Group();
      // 바닥에서부터 서 있는 2단 철제 서류 캐비닛 (보조 스툴 없이 자체 바닥 스탠딩!)
      const cab = new THREE.Mesh(new THREE.BoxGeometry(.48, .68, .44), M(0x485258, { roughness: .45, metalness: .55 }));
      cab.position.set(0, .34, 0); g.add(cab);
      [0.19, 0.51].forEach(dy => {
        const front = new THREE.Mesh(new THREE.BoxGeometry(.43, .26, .018), M(0x56626a, { roughness: .4, metalness: .5 }));
        front.position.set(0, dy, .222); g.add(front);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(.11, .022, .028), M(0xc8d0d8, { metalness: .85, roughness: .2 }));
        handle.position.set(0, dy + .02, .236); g.add(handle);
        const tag = new THREE.Mesh(new THREE.BoxGeometry(.09, .032, .006), M(0xf0ead8));
        tag.position.set(0, dy + .075, .232); g.add(tag);
      });
      return g;
    },
    box: () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(.38, .22, .28), M(0x5c3d24, { roughness: .55 }));
      body.position.set(0, TOP_Y + .11, 0); g.add(body);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(.40, .035, .30), M(0x422a17, { roughness: .5 }));
      lid.position.set(0, TOP_Y + .235, 0); g.add(lid);
      const clasp = new THREE.Mesh(new THREE.BoxGeometry(.06, .05, .018), M(0xd4af37, { metalness: .8, roughness: .3 }));
      clasp.position.set(0, TOP_Y + .21, .148); g.add(clasp);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(.18, .045, .008), M(0xf2ead4));
      plate.position.set(0, TOP_Y + .12, .143); g.add(plate);
      return g;
    },
    monitor: () => {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(.32, .035, .26), M(0xc2b9a3, { roughness: .6 }));
      base.position.set(0, TOP_Y + .0175, 0); g.add(base);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, .05, 12), M(0xb4ab96));
      neck.position.set(0, TOP_Y + .055, -.02); g.add(neck);
      const crt = new THREE.Mesh(new THREE.BoxGeometry(.38, .31, .28), M(0xc8bfa8, { roughness: .55 }));
      crt.position.set(0, TOP_Y + .22, 0); g.add(crt);
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(.34, .26, .016), M(0x22262a));
      bezel.position.set(0, TOP_Y + .225, .138); g.add(bezel);
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(.30, .22), new THREE.MeshBasicMaterial({ color: 0x3b78c4 }));
      sc.position.set(0, TOP_Y + .225, .148); g.add(sc);
      const kb = new THREE.Mesh(new THREE.BoxGeometry(.34, .022, .12), M(0xcbc2ac));
      kb.position.set(0, TOP_Y + .011, .16); g.add(kb);
      return g;
    },
    photo: () => {
      const g = new THREE.Group();
      // 원목 사진 액자 스탠드 + 폴라로이드 사진 프레임
      const frame = new THREE.Mesh(new THREE.BoxGeometry(.24, .28, .022), M(0x422a18, { roughness: .5 }));
      frame.position.set(0, TOP_Y + .14, 0); frame.rotation.x = -.12; g.add(frame);
      const border = new THREE.Mesh(new THREE.BoxGeometry(.20, .24, .006), M(0xf6f2e8));
      border.position.set(0, TOP_Y + .14, .012); border.rotation.x = -.12; g.add(border);
      const pic = new THREE.Mesh(new THREE.BoxGeometry(.16, .17, .006), M(0x3a4856, { roughness: .4 }));
      pic.position.set(0, TOP_Y + .155, .015); pic.rotation.x = -.12; g.add(pic);
      const stand = new THREE.Mesh(new THREE.BoxGeometry(.04, .20, .018), M(0x362010));
      stand.position.set(0, TOP_Y + .10, -.06); stand.rotation.x = .28; g.add(stand);
      return g;
    },
    flower: () => {
      const g = new THREE.Group();
      const vase = new THREE.Mesh(new THREE.CylinderGeometry(.045, .055, .14, 12), M(0xd8e2e8, { roughness: .2, metalness: .1 }));
      vase.position.y = .07; g.add(vase);
      for (let i = 0; i < 3; i++) {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .28, 6), M(0x2e5e24));
        st.position.set(i * .03 - .03, .18, (i % 2) * .02 - .01);
        const fl = new THREE.Mesh(new THREE.SphereGeometry(.034, 10, 8), M(0xf8f6f0));
        fl.position.set(i * .03 - .03, .32, (i % 2) * .02 - .01);
        g.add(st, fl);
      }
      return g;
    },
    post: () => {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.16, .18, .08, 14), M(0x383a3e));
      base.position.y = .04; g.add(base);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, .78, 12), M(0x26282c, { metalness: .6, roughness: .4 }));
      pole.position.y = .42; g.add(pole);
      const box = new THREE.Mesh(new THREE.BoxGeometry(.42, .52, .32), M(0xb8221a, { roughness: .38, metalness: .2 }));
      box.position.y = 1.04; g.add(box);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(.46, .05, .36), M(0x8e1610, { roughness: .4 }));
      roof.position.y = 1.31; g.add(roof);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(.26, .035, .02), M(0x111111));
      slot.position.set(0, 1.16, .162); g.add(slot);
      const plaque = new THREE.Mesh(new THREE.BoxGeometry(.28, .12, .01), M(0xf2ead8));
      plaque.position.set(0, .96, .162); g.add(plaque);
      return g;
    },
    plaque: () => {
      const g = new THREE.Group();
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(.96, .14, .38), M(0x5c5852, { roughness: .85 }));
      plinth.position.y = .07; g.add(plinth);
      const st = new THREE.Mesh(new THREE.BoxGeometry(.88, .68, .28), M(0x7a756c, { roughness: .88 }));
      st.position.y = .46; g.add(st);
      const pl = new THREE.Mesh(new THREE.BoxGeometry(.64, .42, .025), M(0x9a7840, { metalness: .75, roughness: .35 }));
      pl.position.set(0, .48, .145); g.add(pl);
      return g;
    },
    panel: () => {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(.52, .72, .16), M(0x6e767a, { metalness: .55, roughness: .45 }));
      b.position.y = 1.35; g.add(b);
      const d = new THREE.Mesh(new THREE.BoxGeometry(.46, .64, .022), M(0x889094, { metalness: .5, roughness: .42 }));
      d.position.set(0, 1.35, .085); g.add(d);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(.03, .12, .035), M(0x222628, { metalness: .7 }));
      handle.position.set(.18, 1.35, .10); g.add(handle);
      const w = new THREE.Mesh(new THREE.BoxGeometry(.20, .06, .01), M(0xe8c020));
      w.position.set(0, 1.54, .098); g.add(w);
      return g;
    },
    case: () => {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, .8, .6), M(0x3a2c22, { roughness: .55 }));
      base.position.y = .4;
      const gl = new THREE.Mesh(new THREE.BoxGeometry(.96, .5, .56), new THREE.MeshStandardMaterial({ color: 0xbfd8e0, roughness: .05, metalness: .1, transparent: true, opacity: .22, depthWrite: false }));
      gl.position.y = 1.06;
      const km = M(0xc8a050, { metalness: .9, roughness: .3 });
      const key = new THREE.Mesh(new THREE.TorusGeometry(.06, .015, 8, 20), km);
      key.position.set(0, .9, 0); key.rotation.x = Math.PI / 2;
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(.14, .012, .02), km);
      shaft.position.set(.12, .9, 0);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(.12, .16, .03), M(0x202428, { emissive: 0x30ff60, emissiveIntensity: .25 }));
      pad.position.set(.38, .6, .31);
      g.add(base, gl, key, shaft, pad);
      g.userData.key = [key, shaft];
      return g;
    },
    lamp: () => {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(.36, .16, .1), M(0xd8d4c4));
      b.position.y = 2.2;
      const h = new THREE.Mesh(new THREE.BoxGeometry(.3, .08, .04), sqLampMat);
      h.position.set(0, 2.18, .06);
      g.add(b, h);
      return g;
    },
  };
  const sqLampMat = new THREE.MeshStandardMaterial({ color: 0x2a2a26, emissive: 0xfff0c8, emissiveIntensity: 0 });
  const standWoodTop = M(0x7c5332, { roughness: .52 }), standWoodDark = M(0x3e2716, { roughness: .58 }), standLegMetal = M(0x3a4044, { roughness: .45, metalness: .55 });
  const buildQuestStand = () => {
    const sg = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(.52, .035, .42), standWoodTop); top.position.y = .455; sg.add(top);
    const apron = new THREE.Mesh(new THREE.BoxGeometry(.46, .05, .36), standWoodDark); apron.position.y = .415; sg.add(apron);
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(.44, .02, .34), standWoodTop); shelf.position.y = .14; sg.add(shelf);
    [[-.21, -.16], [.21, -.16], [-.21, .16], [.21, .16]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.016, .014, .44, 8), standLegMetal);
      leg.position.set(lx, .22, lz); sg.add(leg);
    });
    return sg;
  };
  [...SIDEQUESTS, HEADQUEST].forEach(q => q.steps.forEach((st, k) => {
    let x = st.x, z = st.z, F = floors[st.f], rmInfo = null;
    if (st.room) { const r = roomOf(st.f, st.room); if (!r) { console.warn('[sq] 방 없음', st.room); return; } rmInfo = r; st.f = r.f; F = floors[st.f]; x = r.cx + st.dx; z = r.south ? 1.75 + st.d : -1.75 - st.d; }
    if (st.look !== 'post' && st.look !== 'lamp' && st.look !== 'panel') [x, z] = freeSpot(F, x, z, .32, rmInfo);
    const g = new THREE.Group(); g.position.set(x, 0, z); g.userData.dynamic = true;
    if (!['post', 'lamp', 'flower', 'plaque', 'panel', 'case', 'drawer'].includes(st.look)) g.add(buildQuestStand());
    const v = LOOK[st.look](); g.add(v);
    if (rmInfo && rmInfo.south) g.rotation.y = Math.PI;
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTex, color: 0xffd8a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .24 })); gl.scale.setScalar(.28); gl.position.y = st.look === 'lamp' ? 2.2 : st.look === 'post' ? 1.1 : st.look === 'panel' ? 1.4 : st.look === 'case' ? 1.0 : .78; g.add(gl);
    (st.f === 0 && !st.room ? world.OUT : F.interior).add(g);
    if (st.look === 'case' || st.look === 'plaque') { const r = st.room && roomOf(st.f, st.room); if (r && r.south) g.rotation.y = Math.PI; }   // 문 쪽(복도)을 보게
    const p = { kind: 'sq', q: q.id, k, st, floor: st.f, x, z, y: st.look === 'lamp' ? 2.0 : st.look === 'panel' ? 1.3 : .7, mesh: g, glint: gl, label: st.label, uid: `sq:${q.id}:${k}`, main: q === HEADQUEST, keyMeshes: v.userData.key };
    if (st.look === 'lamp') p.lampMat = sqLampMat;
    world.props.push(p); sqProps.push(p);
  }));
}
// 지금 단계의 지점만 보이고 조사할 수 있다. init: 불러오기 직후 (비상등처럼 완료 상태가 남는 연출 복원)
function sqSync(init) {
  FL.sq = FL.sq || {}; FL.qi = FL.qi || {};
  if (FL.gatekey || FL.keyhead) FL.sq.head = HEADQUEST.steps.length;   // 이전 버전 세이브(이미 정문 열쇠를 만든 경우)
  for (const p of sqProps) {
    const s = sqStep(p.q), q = p.main ? HEADQUEST : SIDEQUESTS.find(x => x.id === p.q);
    if (p.main) {   // 제4장: 조각 다섯 개를 모은 뒤에만 · 고정물(머릿돌 · 분전반 · 진열장)은 늘 보인다
      const on = s === p.k && P.keys >= TOTAL && !FL.keyhead;
      p.done = !on; p.mesh.visible = on || ['plaque', 'panel', 'case'].includes(p.st.look); if (p.glint) p.glint.visible = on;
      if (p.keyMeshes) p.keyMeshes.forEach(m => { m.visible = !FL.keyhead; });
      continue;
    }
    // 첫 단계는 언제나 열려 있다(발견형). 이후 단계는 그 단계가 됐을 때만
    const active = s === p.k && s < q.steps.length;
    p.done = !active; p.mesh.visible = active || (p.st.look === 'lamp' && s >= q.steps.length) || (p.st.look === 'post' && s >= p.k);
    if (p.glint) p.glint.visible = active;
    if (p.lampMat) p.lampMat.emissiveIntensity = s >= q.steps.length ? 2.2 : 0;
  }
}
function sqNeedOk(n) { return !n || (n === 'anPow' ? !!FL.anPow : n === 'power' ? power : n === 'mina' ? FL.mina : n === 'key4' ? !!got[4] : n === 'hairpin' ? inv.hairpin > 0 : true); }
function sqNeedText(p) { const n = p.st.need; if (sqNeedOk(n)) return ''; return { anPow: '  — 전원 없음 (별관 1층 가정실 분전반)', power: '  — 전원 없음 (지하 전기실 차단기)', mina: '  — 민아를 먼저 찾아야 한다', key4: '  — 아직 다섯 번째 조각이 없다', hairpin: '  — 머리핀 필요' }[n] || ''; }
async function useSideQuest(p) {
  const q = SIDEQUESTS.find(x => x.id === p.q), st = p.st;
  if (!sqNeedOk(st.need)) { sfx.click(); say(sqNeedText(p).replace(/^\s*—\s*/, ''), 2400); return; }
  if (st.need === 'hairpin') { inv.hairpin--; sfx.pick && sfx.pick(); }
  let ci = 0;
  if (st.choice) { ci = await choose(st.choice.title, st.choice.text, st.choice.opts); }
  if (st.take) delete FL.qi[st.take];
  if (st.give) { FL.qi[st.give] = true; newItems.add(st.give); sfx.pickup(); toast('아이템을 획득했습니다', ITEMS[st.give].name, 'info'); }
  FL.sq[q.id] = p.k + 1;
  const first = p.k === 0, last = p.k + 1 >= q.steps.length;
  if (st.doc) { addDoc({ id: st.doc, kind: 'note' }); sfx.paper(); }
  sqEvent(st.event, ci, p);
  if (st.doc) setTimeout(() => { if (state === 'playing') showNote({ title: world.NOTES[st.doc].title, text: world.NOTES[st.doc].text }); }, st.event ? 1800 : 300);
  if (first && !last) setTimeout(() => toast('새 의뢰', `${q.title} — 다음: ${q.steps[1].goal}`, 'opt'), 900);
  else if (!last) setTimeout(() => toast(q.title, `다음: ${q.steps[p.k + 1].goal}`, 'info'), 900);
  if (last) {
    const r = ci === 0 ? (st.reward || {}) : {};
    Object.entries(r).forEach(([k, v]) => { inv[k] = (inv[k] || 0) + v; });
    addClue('q' + (SIDEQUESTS.indexOf(q) + 1)); storyCalm(40);
    setTimeout(() => toast('의뢰 완료 — ' + q.title, Object.keys(r).length ? '보답: ' + Object.entries(r).map(([k, v]) => `${ITEMS[k].name} ×${v}`).join(', ') : '마음 한구석이 무겁다', 'opt'), 2400);
    if (sqDoneCount() === SIDEQUESTS.length) setTimeout(() => { inv.medkit++; inv.battery += 2; toast('모든 부탁을 들어주었다', '남겨진 사람들의 이야기를 모두 모았다 — 진실을 알리면 다른 결말이 기다린다', 'opt'); refreshHud(); }, 6500);
  }
  refreshHud(); save(true);
}
// 의뢰 연출 — 기존 효과음 · 화면 효과 · 자막만 쓴다
function sqEvent(ev, ci, p) {
  if (!ev) return;
  if (ev === 'bell') { if (ci === 0) { setTimeout(() => sfx.classBell(), 300); setTimeout(() => caption('출석부 마지막 칸 — 윤하늘 이름 옆만 비어 있다'), 1400); } else { sfx.creak && sfx.creak(); caption('출석부를 덮자, 교실 쪽에서 의자 끄는 소리가 났다'); } }
  else if (ev === 'song') { const mel = [392, 392, 440, 440, 392, 392, 330, 392, 392, 330, 330, 294]; sfx.tape && sfx.tape(); mel.forEach((f, i) => setTimeout(() => sfx.note(f), 900 + i * 420)); setTimeout(() => caption('스피커에서 세 사람의 노래가 흘러나온다'), 1200); setTimeout(() => { caption('“…모두, 수고 많았습니다. 집으로 돌아가세요.”'); fx.glitch(.25); }, 900 + mel.length * 420); }
  else if (ev === 'water') { if (ci === 0) { sfx.drip(); setTimeout(() => caption('물소리가 멎었다'), 900); } else caption('물소리는 계속된다'); }
  else if (ev === 'pick') { sfx.tumbler && sfx.tumbler(); setTimeout(() => sfx.unlock(), 700); }
  else if (ev === 'truth') { sfx.staticNoise(.8); fx.glitch(.4); setTimeout(() => caption('두 진술이 모두 사실이었다 — 문은 두 개였다'), 900); }
  else if (ev === 'post') { sfx.paper(); setTimeout(() => sfx.click(), 500); setTimeout(() => caption('편지가 우편함 바닥에 닿는 소리'), 900); }
  else if (ev === 'mina') { sfx.tape && sfx.tape(); setTimeout(() => caption('📼 민아: “언니. 하늘 언니 방송, 내가 끝까지 들었어.”'), 900); }
  else if (ev === 'light') { sfx.lightOn ? sfx.lightOn() : sfx.click(); setTimeout(() => caption('10년 늦은 불빛'), 900); }
  else if (ev === 'library') { sfx.lightsOff ? sfx.lightsOff() : sfx.click(); setTimeout(() => caption('반납함 바닥에 1998년 10월자 대출 카드 한 장이 남아 있다'), 1500); }
}
/* ---------- 제4장 · 열쇠의 머리 (별관) — story.js HEADQUEST · 진행은 FL.sq.head ---------- */
async function useHead(p) {
  const st = p.st;
  if (!sqNeedOk(st.need)) { sfx.click(); say(sqNeedText(p).replace(/^\s*—\s*/, ''), 2600); if (st.need === 'anPow') talk('needPower', 2600); return; }
  if (st.mini) {
    const r = await mini(st.mini, st.mini === 'slide' ? { img: 'assets/img/annex_ext.webp', title: '보안 PC — 끊긴 CCTV 화면 맞추기' } : { title: '별관 분전반 — 배선 연결' });
    if (!r.ok) return;
  }
  if (st.code) { kpProp = { code: st.code, prop: p }; kpBuf = '';++keypadSequence;kpOpening=false; $('kpTitle').textContent = '자율학습실 진열장'; $('kpHint').innerHTML = p.fails ? '힌트 ① 교장 수첩: 잠금 번호는 <b>“이 학교가 태어난 날”</b>' : '전자식 잠금 — 숫자 4자리'; renderKeypad(); openUI('keypad'); sfx.beep(); return; }
  headAdvance(p);
}
function headAdvance(p) {
  const st = p.st; FL.sq.head = p.k + 1;
  if (st.doc) { addDoc({ id: st.doc, kind: 'note' }); sfx.paper(); if (CLUES[st.doc]) addClue(st.doc); }
  headEvent(st.event, p);
  if (st.doc) setTimeout(() => { if (state === 'playing') showNote({ title: world.NOTES[st.doc].title, text: world.NOTES[st.doc].text }); }, st.event ? 2600 : 300);
  const nx = HEADQUEST.steps[p.k + 1];
  if (nx) setTimeout(() => toast('제4장 · 열쇠의 머리', `다음: ${nx.goal}`, 'info'), 1200);
  refreshHud(); save(true);
}
// 그것이 플레이어가 있는 층(별관)으로 온다 — 방송 뒤(고요)엔 오지 않는다
function headLure(sec) {
  if (!ghost.active || FL.calm || ghost.enraged) return;
  if (ghost.floor !== P.floor) { ghostRelocate(); ghost.spawnGrace = 4; }
  ghost.state = 'search'; ghost.target = { x: P.x, z: P.z }; ghost.path = []; ghost.replan = 0; ghost.wait = 0; ghost.lureT = sec; ghost.hunt = null;
}
function headEvent(ev, p) {
  if (ev === 'annexPower') {
    FL.anPow = true; sfx.breaker(); shake = .4; P.noiseT = 2.5; blackout = Math.max(blackout, .6);
    setTimeout(() => { sfx.lightOn(); caption('별관 복도 끝에서부터 형광등이 하나씩 켜진다'); }, 900);
    toast('별관 전원이 들어왔다', '분전반 소리가 별관 전체에 울렸다…', 'warn');
    setTimeout(() => { if (state === 'playing' && ghost.active && !FL.calm) { sfx.stairs(); caption('계단 쪽에서 무언가 올라온다'); headLure(20); } }, 4000);
  } else if (ev === 'cctv') {
    sfx.staticNoise(1.4); fx.glitch(.6);
    setTimeout(() => caption('화면 속 자율학습실 진열장 — 녹화가 중간에 잘려 있다. 누군가 지운 흔적이다'), 1000);
    setTimeout(() => { sfx.staticNoise && sfx.staticNoise(.4); caption('…녹화 시각이 1998.10.12 23:10으로 찍혀 있다'); }, 2200);
  } else if (ev === 'head') {
    FL.keyhead = true; newItems.add('keyhead'); sfx.key(); setFace('resolve', 3); if (p.keyMeshes) p.keyMeshes.forEach(m => { m.visible = false; });
    toast('교장 직인 마스터 코어를 확보했습니다!', '소지품(Tab)에서 5대 비밀 증거와 조합하면 『서문고 진상 규명 기록부』가 완성된다', 'opt'); setTimeout(() => talk('headFound', 3200), 400);
    if (!FL.calm) setTimeout(() => {
      setTimeout(() => { caption('“…그 사람은, 내려오지 않았어.”'); headLure(25); }, 1800);
    }, 3800);
  }
}

/* ---------- 사물함 수색 · 소모품 · 수집품 · 방 미니게임 · 칠판 · 초자연 현상 ----------
   수색 지점(kind 'search'): 교실 뒤 사물함 · 복도 사물함(숨는 칸 양옆) · 체육관/수영장 탈의실. 내용물은 지점 순서로 정해져(시드 고정) 저장/복원과 맞는다.
   방 미니게임(kind 'mspot'): 방마다 하나씩 — 보답은 처음 한 번 (FL.ms). 칠판(kind 'chalk'): 교실마다 분필로 질문 */
const XT = { search: null, para: 75 + Math.random() * 40, paraLast: [], mbox: null };
{
  const roomC = (f, name) => {
    const clean = s => String(s || '').replace(/\s*\(.*\)$/, '').trim();
    const order = [f, 0, 1, 2, 4, 8, 9, 10];
    for (const qf of order) {
      const an = qf >= 8, rows = an ? [[ANNEX.floors[qf - 8], ANNEX.slots, false], [ANNEX_S[qf - 8], ANNEX.slots, true]] : [[LAYOUT[qf], SLOTS, false], [LAYOUT_S[qf], SLOTS, true]];
      for (const [L, sl, south] of rows) {
        if (!L) continue;
        let i = L.names.indexOf(name);
        if (i < 0) i = L.names.findIndex(n => clean(n) === clean(name));
        if (i >= 0) return { f: qf, cx: sl[i], south };
      }
    }
    return null;
  };
  const free = (F, x, z, r = .32) => { const hit = (a, b) => F.col.some(c => a > c.x1 - r && a < c.x2 + r && b > c.z1 - r && b < c.z2 + r);
    if (!hit(x, z)) return [x, z]; for (let k = 1; k < 16; k++) for (let a = 0; a < 8; a++) { const ax = x + Math.cos(a * .785) * k * .18, az = z + Math.sin(a * .785) * k * .18; if (!hit(ax, az)) return [ax, az]; } return [x, z]; };
  // 1) 사물함 파밍 지점 (숨기 기능 대신 모든 교실·복도·별관·체육관·수영장·급식실 사물함에서 수집품·퀘스트아이템·생존물품을 파밍)
  const spots = [];
  for (let f = 0; f <= 2; f++) {
    LAYOUT[f].types.forEach((t, i) => { if (t === 'class') spots.push({ f, x: SLOTS[i] - 2.65, z: -2.35, where: LAYOUT[f].names[i], what: '교실 사물함' }); });
    LAYOUT_S[f].types.forEach((t, i) => { if (t === 'class') spots.push({ f, x: SLOTS[i] + 2.65, z: 2.35, where: LAYOUT_S[f].names[i], what: '교실 사물함' }); });
    [1, 3, 6, 8].forEach(i => [0, 1, 2].forEach(k => spots.push({ f, x: SLOTS[i] + 2.35 + k * .66, z: -.75, where: '복도', what: '복도 사물함' })));
  }
  for (let f = 8; f <= 10; f++) {
    [2, 3].forEach(i => [0, 1, 2].forEach(k => spots.push({ f, x: ANNEX.slots[i] + 2.35 + k * .66, z: -.75, where: '별관 복도', what: '별관 사물함' })));
  }
  spots.push(
    { f: 5, x: 28.9, z: 24.4, where: '체육관', what: '체육관 사물함', fixedLoot: { quest: 'stageReel', col: 'c23' } },
    { f: 5, x: 21.8, z: 18.9, where: '체육교사실', what: '체육교사실 사물함', fixedLoot: { quest: 'gymBoothKey', item: 'battery' } },
    { f: 5, x: 23.1, z: 18.9, where: '체육교사실', what: '체육교사실 보관함', fixedLoot: { col: 'c16', item: 'medkit' } },
    { f: 6, x: -46.1, z: 25.4, where: '수영장 탈의실', what: '탈의실 사물함', fixedLoot: { quest: 'poolValveKey', col: 'c17' } },
    { f: 6, x: -47.6, z: 25.4, where: '수영장 탈의실', what: '탈의실 사물함', fixedLoot: { quest: 'chlorineLog', item: 'thermos' } },
    { f: 6, x: -48.1, z: 29.2, where: '수영장 탈의실', what: '탈의실 사물함' },
    { f: 6, x: -35.6, z: 29.2, where: '수영장 샤워실', what: '샤워실 사물함' },
    { f: 7, x: -46.9, z: 20.5, where: '급식실', what: '직원 사물함', fixedLoot: { col: 'c29', item: 'candy' } }
  );
  // 내용물: 수집품 32종 + 퀘스트 아이템 4종 + 소모품 + 기본 물품 (시드 고정 셔플)
  let seed = 20061012; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const freeIdx = spots.map((sp, i) => sp.fixedLoot ? -1 : i).filter(i => i >= 0).sort(() => rng() - .5);
  const usedCols = new Set(['c16', 'c17', 'c23', 'c29']);
  const pool = [
    ...COLLECT.filter(c => !usedCols.has(c.id)).map(c => ({ col: c.id })),
    ...['candy', 'candy', 'candy', 'candy', 'candy', 'thermos', 'thermos', 'thermos', 'candy', 'candy', 'thermos', 'battery', 'battery', 'medkit', 'hairpin'].map(k => ({ item: k })),
    ...['battery', 'battery', 'battery', 'battery', 'battery', 'medkit', 'medkit', 'medkit', 'can', 'can', 'can', 'hairpin', 'hairpin', 'hairpin'].map(k => ({ item: k })),
  ];
  freeIdx.forEach((si, n) => { spots[si].loot = pool[n % pool.length] || { item: 'battery' }; });
  spots.forEach((sp, i) => {
    if (sp.fixedLoot) sp.loot = sp.fixedLoot;
    const F = floors[sp.f]; if (!F) return;
    world.props.push({ kind: 'search', floor: sp.f, x: sp.x, z: sp.z, y: 1.0, label: `${sp.what} 파밍하기`, loot: sp.loot, where: sp.where, uid: `srch:${i}` });
  });
  // 2) 방 미니게임 지점
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .7, ...o });
  const box = (g, w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
  const table4 = (g, w, h, d, topC = 0x6e4828, legC = 0x34383c) => {
    const tm = M(topC, { roughness: .52 }), lm = M(legC, { roughness: .45, metalness: .55 });
    box(g, w, .04, d, 0, h - .02, 0, tm);
    box(g, w - .06, .05, d - .06, 0, h - .06, 0, M(0x3a2414, { roughness: .6 }));
    const lx = w / 2 - .04, lz = d / 2 - .04;
    [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.018, .016, h - .04, 8), lm);
      leg.position.set(x, (h - .04) / 2, z); g.add(leg);
    });
  };
  const LOOKS = {
    xylo: g => {
      table4(g, .92, .70, .44, 0x5c3a20, 0x2e3236);
      box(g, .78, .03, .32, 0, .715, 0, M(0x3a2210));
      ['#c84a3a', '#d8b040', '#4aa86a', '#4a7ad0', '#a050c0', '#e08040'].forEach((c, i) => box(g, .10, .025, .28 - i * .025, -.3 + i * .12, .74, 0, M(c, { metalness: .35, roughness: .35 })));
    },
    pc: g => {
      table4(g, .92, .74, .60, 0x7a5434, 0x383c40);
      box(g, .40, .32, .28, 0, .92, -.04, M(0xc8bfa8, { roughness: .55 }));
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(.33, .23), new THREE.MeshBasicMaterial({ color: 0x3a6ab0 }));
      sc.position.set(0, .93, .102); g.add(sc);
      box(g, .34, .022, .12, 0, .752, .16, M(0xcbc2ac));
    },
    radioTop: g => {
      box(g, .44, .24, .22, 0, .12, 0, M(0x383c42, { metalness: .45, roughness: .42 }));
      box(g, .26, .11, .012, -.05, .14, .112, M(0x163828, { emissive: 0x185838, emissiveIntensity: .65 }));
      [0.12, 0.12].forEach((kx, i) => {
        const k = new THREE.Mesh(new THREE.CylinderGeometry(.024, .024, .022, 12), M(0xd0d4d8, { metalness: .7 }));
        k.rotation.x = Math.PI / 2; k.position.set(kx, .16 - i * .07, .115); g.add(k);
      });
    },
    radio: g => {
      table4(g, .72, .74, .50, 0x5c3d22, 0x34383c);
      box(g, .48, .26, .22, 0, .87, 0, M(0x423020, { roughness: .5 }));
      box(g, .28, .10, .012, -.05, .89, .112, M(0xd8c890, { emissive: 0x403010, emissiveIntensity: .6 }));
    },
    beaker: g => {
      table4(g, 1.0, .86, .60, 0x2c3236, 0x42484e);
      box(g, .86, .02, .46, 0, .87, 0, M(0x1e2226));
      [0, .22, -.22].forEach((x, i) => {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, .18, 14), M([0x60a0e0, 0xe0d060, 0xd06060][i], { transparent: true, opacity: .78, roughness: .12 }));
        b.position.set(x, .97, 0); g.add(b);
      });
    },
    hoop: g => {
      // 체육관 바퀴 달린 철제 농구공 케이지 카트
      table4(g, .76, .58, .48, 0x3a4046, 0x586068);
      [-0.34, 0.34].forEach(x => box(g, .03, .28, .44, x, .72, 0, M(0x586068, { metalness: .6 })));
      [-0.20, 0.20].forEach(z => box(g, .72, .28, .03, 0, .72, z, M(0x586068, { metalness: .6 })));
      [-.18, .18].forEach(x => {
        const b = new THREE.Mesh(new THREE.SphereGeometry(.12, 14, 10), M(0xc85a20, { roughness: .6 }));
        b.position.set(x, .70, 0); g.add(b);
      });
    },
    gacha: g => {
      table4(g, .56, .52, .50, 0x383c42, 0x282c30);
      box(g, .48, .38, .44, 0, .71, 0, M(0xc83a3a, { roughness: .35 }));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(.24, 16, 12), M(0xdde8ee, { transparent: true, opacity: .35, roughness: .05 }));
      dome.position.y = 1.12; g.add(dome);
      for (let i = 0; i < 9; i++) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), M([0xe0c040, 0x40a0e0, 0xe06090][i % 3]));
        c.position.set(Math.sin(i) * .13, 1.00 + (i % 3) * .05, Math.cos(i * 1.7) * .11); g.add(c);
      }
      box(g, .14, .14, .04, 0, .66, .23, M(0xe8e0c8, { metalness: .4 }));
    },
    ouija: g => {
      table4(g, .88, .72, .58, 0x4e3420, 0x2c2016);
      box(g, .58, .022, .38, 0, .732, 0, M(0xc8a878, { roughness: .55 }));
      box(g, .52, .006, .32, 0, .745, 0, M(0x3a2618));
      // 테이프 판독 작업대: 판독용 카세트 데크 · 릴 두 개 · 헤드폰 (예전 분신사바 말판 · 촛불 대체)
      box(g, .34, .09, .22, .02, .80, -.02, M(0x2a2c30, { roughness: .5 }));
      [-.07, .09].forEach(x => { const r = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .012, 14), M(0xd8d0c0)); r.position.set(x, .852, -.02); g.add(r); });
      box(g, .10, .03, .16, -.30, .77, .10, M(0x1a1a1c));
    },
    easel: g => {
      box(g, .045, 1.52, .045, -.25, .76, 0, M(0x7a5834));
      box(g, .045, 1.52, .045, .25, .76, 0, M(0x7a5834));
      box(g, .045, 1.48, .045, 0, .72, -.22, M(0x684828));
      box(g, .66, .04, .08, 0, .86, .04, M(0x5c3e20));
      box(g, .68, .54, .03, 0, 1.15, .04, M(0xe8e0d0));
      box(g, .62, .48, .008, 0, 1.15, .058, M(0x384654));
    },
    projector: g => {
      table4(g, .80, .74, .50, 0x42464a, 0x2a2e32);
      box(g, .36, .22, .32, 0, .85, 0, M(0x2a2c30, { metalness: .5, roughness: .4 }));
      const l = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .11, 14), M(0x15171a, { metalness: .6 }));
      l.rotation.x = Math.PI / 2; l.position.set(0, .86, .20); g.add(l);
      [-0.08, 0.08].forEach(z => {
        const reel = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .02, 16), M(0x9aa2a8, { metalness: .7 }));
        reel.rotation.z = Math.PI / 2; reel.position.set(0, 1.02, z); g.add(reel);
      });
    },
    drum: g => {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .32, 18), M(0xb03a2a, { roughness: .35, metalness: .25 }));
      d.rotation.x = Math.PI / 2; d.position.y = .30; g.add(d);
      const sn = new THREE.Mesh(new THREE.CylinderGeometry(.19, .19, .14, 16), M(0xd8d8d8, { metalness: .6, roughness: .3 }));
      sn.position.set(.38, .58, 0); g.add(sn);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(.015, .02, .52, 8), M(0xb8c0c8, { metalness: .8 }));
      st.position.set(.38, .26, 0); g.add(st);
    },
  };
  const MS = [
    { id: 'music', f: 2, room: '음악실', dx: -1.6, d: 3.4, look: 'xylo', label: '실로폰 — 남겨진 음 따라 치기', game: 'simon', opts: { title: '실로폰 — 하늘의 연습곡' }, reward: { col: 'c07', item: { candy: 1 } }, cap: '마지막 음이 끝나자, 누군가 박수를 쳤다. 두 번.' },
    { id: 'comp', f: 1, room: '컴퓨터실', dx: 1.8, d: 3.4, look: 'pc', label: '고장 난 PC — 깨진 파일 복구', game: 'memory', opts: { title: '깨진 파일 아이콘 짝 맞추기', icons: ['💾', '🖥', '📁', '🖨', '📀', '⌨'] }, reward: { item: { battery: 2 } }, cap: '복구된 폴더 이름: 「HANEUL_방송원고_최종_진짜최종」' },
    { id: 'bcast', f: 2, x: -20.45, z: -2.72, onTop: .7, look: 'radioTop', label: '오실로스코프 수신기 — 파형 동조하기', game: 'oscilloscope', opts: { title: '방송실 오실로스코프 — 주파수·진폭·위상 동조' }, reward: { col: 'c28', item: { candy: 1 } }, cap: '파형이 겹쳐지자 잡음 너머로 목소리가 또렷해졌다. “…고마워.”' },
    { id: 'lab', f: 1, room: '과학실', dx: 1.4, d: 4.2, look: 'beaker', label: '실험대 — 시약 중화 적정 실험 (pH 7.2)', game: 'chemMix', opts: { title: '과학실 실험대 — 시약 중화 적정 (목표 pH 7.2)' }, reward: { col: 'c27', item: { medkit: 1 } }, cap: '중화된 비커 바닥에 순백색 결정이 맺혔다 — 굵은 소금과 발광 시약이다.' },
    { id: 'gym', f: 5, x: 32.4, z: 18.5, look: 'hoop', label: '농구공 — 물리 궤적 자유투 슛 (3골)', game: 'hoopShot', opts: { title: '체육관 코트 — 물리 포물선 자유투 (3골 성공)' }, reward: { item: { candy: 2, battery: 1 } }, replay: true, cap: '마지막 슛이 림을 통과하자, 2층 관람석에서 환호성이 아주 작게 들렸다.' },
    { id: 'gymBooth', f: 5, x: 44.9, z: 26.4, onTop: 1.6, look: 'radioTop', label: '체육관 2층 방송부스 콘솔 — 리허설 릴테이프 파형 복원', game: 'oscilloscope', opts: { title: '체육관 방송·조명 제어부스 — 1998 학예제 리허설 파형 동조' }, reward: { col: 'c31', item: { candy: 1, battery: 1 } }, cap: '스포트라이트가 무대를 비추며 그날의 리허설 음성이 울려 퍼진다 — “하늘아, 내일 본방송 꼭 성공하자!”' },
    { id: 'poolValve', f: 6, x: -51.6, z: 33.3, onTop: .85, look: 'beaker', label: '수질관리실 제어반 — 3연동 다이빙풀 수압 밸브 동조', game: 'valveBalance', opts: { title: '수질관리실 — 3연동 다이빙풀 배수 수압 동조 (42~58 PSI)' }, reward: { col: 'c24', item: { medkit: 1, battery: 1 } }, cap: '다이빙 보조풀의 배수 밸브가 열리며 바닥에 가라앉아 있던 1998년 수영부 초시계가 모습을 드러냈다!' },
    { id: 'poolSauna', f: 6, x: -54.8, z: 23.2, onTop: .42, look: 'radioTop', label: '체온유지실 온열 제어기 — 회로 복구', game: 'fuse', opts: { title: '체온유지실 맥반석 스토브 — 온열 회로 켜기', N: 4 }, reward: { col: 'c32', item: { thermos: 1 } }, cap: '스토브에 따뜻한 온기가 돌며 얼어붙었던 숨이 가라앉는다.' },
    { id: 'cafe', f: 7, x: -34.6, z: 21.1, look: 'gacha', label: '뽑기 기계 돌리기', game: 'gacha', replay: true },
    { id: 'art', f: 2, room: '미술실', dx: -1.2, d: 4.0, look: 'easel', label: '이젤 — 그림 조각 짝 맞추기', game: 'memory', opts: { title: '찢긴 그림 조각 짝 맞추기', icons: ['🎨', '🖌', '🗿', '🖼', '✏', '📐', '🌙'] }, reward: { col: 'c06', item: { thermos: 1 } }, cap: '맞춰진 그림 속 소녀가, 눈을 깜빡인 것 같다.' },
    { id: 'av', f: 1, room: '시청각실', dx: 0, d: 3.8, look: 'projector', label: '영사기 — 듀얼 렌즈 초점 & 트래킹 복원', game: 'filmFocus', opts: { title: '시청각실 영사기 — 렌즈 초점 & 필름 트래킹 동기화' }, reward: { item: { thermos: 1, battery: 1 } }, cap: '스크린에 졸업식 장면이 선명하게 멈춘다. 3학년 2반 줄, 한 자리가 비어 있다.' },
    { id: 'club', f: 9, room: '동아리실 (204)', dx: 1.2, d: 3.6, look: 'drum', label: '드럼 — 박자 따라 치기', game: 'simon', opts: { title: '밴드부 드럼 — 따라 치기', pads: ['킥', '스네어', '하이햇', '심벌'], notes: [110, 196, 523, 784] }, reward: { item: { thermos: 1 } }, cap: '마지막 심벌이 울리자 동아리실 불이 한 번 깜빡였다.' },
  ];
  MS.forEach(m => {
    let x = m.x, z = m.z, ry = 0;
    if (m.room) { const r = roomC(m.f, m.room); if (!r) { console.warn('[mspot] 방 없음', m.room); return; } m.f = r.f; x = r.cx + m.dx; z = r.south ? 1.75 + m.d : -1.75 - m.d; ry = r.south ? Math.PI : 0; }
    const F = floors[m.f]; if (!F) return; if (!m.onTop) [x, z] = free(F, x, z, .5);
    const g = new THREE.Group(); g.position.set(x, m.onTop || 0, z); g.rotation.y = ry; g.userData.dynamic = true; LOOKS[m.look](g); F.interior.add(g);
    if (!m.onTop) F.col.push({ x1: x - .4, x2: x + .4, z1: z - .3, z2: z + .3, h: .9 });   // 가구 위에 올린 것은 새 충돌 없음
    world.props.push({ kind: 'mspot', m, floor: m.f, x, z, y: 1.0, label: m.label, uid: `ms:${m.id}` });
  });
  // 3) 교실 칠판 (분필로 질문하기) & 2008년식 천장형 냉난방기·빔프로젝터 통합 제어기 & 방송실 전관방송 셀렉터 상호작용
  for (let f = 0; f <= 2; f++) {
    LAYOUT[f].types.forEach((t, i) => {
      if (t === 'class') {
        const rm = LAYOUT[f].names[i];
        fzProp({
          id: `ac08_${f}_${i}`,
          promptText: `[E] ${rm} 교실 2008년형 냉난방기 · 빔프로젝터 제어반 조작`,
          onInteract: () => {
            sfx.click();
            toast(`${rm} 멀티미디어 · 냉난방 제어반`, '2008년형 LG 휘센 4-Way 천장형 냉난방기 (희망온도 22°C) 및 DLP 빔프로젝터 대기 전원이 확인되었다.', 'info');
          }
        }, f, SLOTS[i] - 1.22, -1.85, 1.38, { r: 1.45 });
      } else if (t === 'broadcast' && SLOTS[i] === -24) {
        fzProp({
          id: `pa08_rack_${f}`,
          promptText: '[E] 19인치 오픈랙 DVCAM VTR 데크 & 전관방송 스피커 셀렉터(1~3학년 1~5반) 조작',
          onInteract: () => {
            sfx.click();
            const A = window.__broadcastAnims; if (A) A.reelBoostT = performance.now() + 4500;
            toast('19" VTR · PA 전관방송 패치랙', 'DVCAM 마스터 VTR 스풀이 고속 회전하며 1~3학년(1~5반) 전 학급 스피커 셀렉터 릴레이가 [ON]으로 점등되었다.', 'info');
          }
        }, f, -22.35, -8.45, 1.25, { r: 1.85 });
        fzProp({
          id: `pa08_switcher_${f}`,
          promptText: '[E] 주조정실 SD 아날로그 비디오 스위처 (T-Bar 전환) & CRT 브라운관 모니터 조작',
          onInteract: () => {
            sfx.click(); fx.glitch(.16);
            const A = window.__broadcastAnims; if (A) A.tBarPhase = (A.tBarPhase || 0) + Math.PI;
            toast('SD 아날로그 비디오 스위처 (PGM/PST)', 'T-Bar 전환 레버를 당기자 4:3 CRT 브라운관 모니터의 PGM 송출 화면이 [CAM 1 스튜디오 앵커석]으로 전환되었다.', 'info');
          }
        }, f, -29.55, -7.45, .95, { r: 1.85 });
        fzProp({
          id: `pa08_mixer_${f}`,
          promptText: '[E] 24채널 아날로그 오디오 믹서 & 유선 다이내믹 마이크 게인 테스트',
          onInteract: () => {
            sfx.broadcast ? sfx.broadcast() : sfx.click();
            const A = window.__broadcastAnims; if (A) A.vuBoostT = performance.now() + 3500;
            toast('24CH 아날로그 오디오 믹서', '마스터 페이더를 올리자 VU 레벨 미터가 피크까지 치솟으며 스튜디오 유선 마이크 회선이 활성화되었다.', 'info');
          }
        }, f, -29.55, -5.95, .95, { r: 1.85 });
        fzProp({
          id: `pa08_nle_${f}`,
          promptText: '[E] 방송편집실 2008년형 NLE 영상편집 PC — 미송출 DV 테이프 타임라인 확인',
          onInteract: () => {
            sfx.click(); fx.glitch(.2);
            toast('2008 NLE 영상편집 워크스테이션', '듀얼 4:3 LCD 모니터 타임라인에 「1998.10.12_30주년_하교방송_미송출원본.avi (TC 01:11:40:12)」 클립이 정지해 있다.', 'info');
          }
        }, f, -34.55, -6.55, 1.0, { r: 1.85 });
      }
    });
    LAYOUT_S[f].types.forEach((t, i) => {
      if (t === 'class') {
        const rm = LAYOUT_S[f].names[i];
      }
    });
  }
}
// ── 사물함 수색: 1.1초 동안 가만히 뒤진다 (움직이면 멈춤 · 작은 소리가 난다)
function startSearch(p) {
  if (p.done || XT.search) return;
  XT.search = { p, t: 0, x: P.x, z: P.z, steel: steelOpen(p.floor, p.x, p.z, true) }; sfx.locker ? sfx.locker() : sfx.click(); $('searchBar').classList.add('on'); $('searchBar').querySelector('b').style.width = '0%';
  $('searchBar').firstChild.textContent = `${p.label.replace(' 뒤지기', '')}을 뒤지는 중…`;
}
function searchTick(dt) {
  const S = XT.search; if (!S) return;
  if (state !== 'playing' || Math.hypot(P.x - S.x, P.z - S.z) > .35 || (ghost.active && ghost.floor === P.floor && ghost.state === 'chase')) { if (S.steel) S.steel.data.toggleDoor(false); XT.search = null; $('searchBar').classList.remove('on'); if (state === 'playing') say('수색을 멈췄다', 1000); return; }
  S.t += dt; P.noiseT = Math.max(P.noiseT, .3); if (Math.random() < dt * 5) sfx.paper();
  $('searchBar').querySelector('b').style.width = Math.min(100, S.t / .55 * 100) + '%';
  if (S.t >= .55) { XT.search = null; $('searchBar').classList.remove('on'); searchResult(S.p); }
}
let lootTimer = 0;
function lootCard(icon, tag, name, text, scare) {
  const el = $('lootCard'); el.className = scare ? 'scare' : ''; el.innerHTML = `<div class="ic">${iconHTML(icon)}</div><div class="tag">${tag}</div><h4>${name}</h4>${text ? `<p>${text}</p>` : ''}`;
  void el.offsetWidth; el.classList.add('on'); clearTimeout(lootTimer); lootTimer = setTimeout(() => el.classList.remove('on'), scare ? 3200 : 2600);
}
function giveItem(k, n = 1, quiet) { inv[k] = (inv[k] || 0) + n; newItems.add(k); if (!quiet) toast('아이템을 획득했습니다', `${ITEMS[k].name}${n > 1 ? ` ×${n}` : ''}`, 'info'); }
function giveCol(id) {
  FL.col = FL.col || {}; if (FL.col[id]) return false; FL.col[id] = 1; newItems.add(id);
  const n = COLLECT.filter(c => FL.col[c.id]).length;
  if (n === COLLECT.length) { giveItem('medkit', 1, true); giveItem('thermos', 1, true); setTimeout(() => { toast('수집품을 모두 모았다', `하늘의 물건 ${COLLECT.length}개 — 보답: 응급 밴드 · 보온병 유자차`, 'opt'); sfx.win ? sfx.win() : sfx.unlock(); refreshHud(); }, 2800); }
  return true;
}
function searchResult(p) {
  p.done = true; p.label = '파밍을 마친 사물함'; const L = p.loot || {};
  if (L.quest && ITEMS[L.quest]) {
    FL[L.quest] = true; inv[L.quest] = 1; newItems.add(L.quest);
    if (L.col) giveCol(L.col);
    if (L.item) giveItem(L.item, 1, true);
    sfx.key();
    lootCard(ITEMS[L.quest].icon, '✦ 퀘스트 아이템 획득', ITEMS[L.quest].name, ITEMS[L.quest].desc);
    toast('퀘스트 아이템 획득', ITEMS[L.quest].name, 'opt');
  } else if (L.col) {
    const c = COLLECT.find(x => x.id === L.col);
    if (c) { giveCol(c.id); if (L.item) giveItem(L.item, 1, true); sfx.pickup(); lootCard(c.icon, `수집품 ${COLLECT.filter(x => FL.col[x.id]).length} / ${COLLECT.length}`, c.name, c.desc); }
  } else if (L.item) {
    giveItem(L.item, 1, true); sfx.pickup(); lootCard(ITEMS[L.item].icon, '사물함 파밍 성공', ITEMS[L.item].name, ITEMS[L.item].desc);
  } else {
    giveItem('candy', 1, true); sfx.pickup(); lootCard(ITEMS.candy.icon, '사물함 파밍', ITEMS.candy.name, ITEMS.candy.desc);
  }
  refreshHud(); save(true);
}
// ── 소모품
function useSalt() {
  const G = ghost, d = G.active && G.floor === P.floor ? Math.hypot(G.x - P.x, G.z - P.z) : 99;
  if (d > 6) return '소금 한 봉지 — 지금은 쓸 데가 없다.';
  inv.salt--; closeUI(); sfx.splash ? sfx.splash() : sfx.paper(); fx.dust(P.x, floors[P.floor].y0 + 1, P.z, 18); shake = .3;
  setTimeout(() => { if (!G.enraged) ghostLeave(); else { G.slowT = 6; G.state = 'search'; G.hunt = null; G.path = []; } caption('소금이 닿자 그것이 몸을 뒤틀며 물러났다'); sfx.ghostCrack ? sfx.ghostCrack() : sfx.screech(); }, 200);
  refreshHud(); return '';
}
function placeMusicBox() {
  if (state !== 'playing') return; inv.musicbox--; refreshHud();
  const F = floors[P.floor], x = P.x, z = P.z, f = P.floor;
  XT.mbox = { f, x, z, t: 12 }; caption('오르골 태엽을 감아 바닥에 내려놓았다 — 어서 떨어지자');
  at(x, F.y0 + .2, z).musicBox(16, .7);
  const G = ghost;
  if (G.active && !G.enraged && G.floor === f) { G.state = 'search'; G.target = { x, z }; G.path = []; G.replan = 0; G.wait = 0; G.hunt = null; G.lureT = 14; }
}
function strikeMatch() {
  if (state !== 'playing') return; inv.matches--; refreshHud(); sfx.spark ? sfx.spark() : sfx.click(); fx.spark && fx.spark(P.x, floors[P.floor].y0 + 1.3, P.z);
  const G = ghost, d = G.active && G.floor === P.floor ? Math.hypot(G.x - P.x, G.z - P.z) : 99;
  blackout = 0; $('paraVig').classList.remove('on');
  if (d < 9) { G.slowT = 8; G.hunt = null; caption('성냥불이 확 일었다 — 그것이 멈칫한다'); } else caption('성냥불에 주변이 잠깐 따뜻해진다');
  P.fear = Math.max(0, P.fear - .25);
}
// ── 방 미니게임
async function useMiniSpot(p) {
  const m = p.m; FL.ms = FL.ms || {};
  if (m.game === 'gacha') { gacha(p); return; }
  if (FL.ms[m.id] && !m.replay) { say('이미 끝냈다', 1200); return; }
  if (m.id === 'gymBooth' && !FL.gymBoothKey) {
    say('체육관 서쪽 「체육교사실」 사물함에서 방송부스 열쇠를 먼저 찾아도 좋고, 지금 바로 수동 동조를 시도할 수도 있다', 2400);
  }
  if (m.id === 'poolValve' && sfx.waterDrain) sfx.waterDrain();
  const r = await mini(m.game, m.opts || {}); if (!r.ok) { if (false) {} return; }
  const first = !FL.ms[m.id]; FL.ms[m.id] = (FL.ms[m.id] || 0) + 1;
  if (m.cap) setTimeout(() => caption(m.cap), 500);
  /* scare removed */
  if (first && m.reward) {
    const got = [];
    if (m.reward.col && giveCol(m.reward.col)) { const c = COLLECT.find(x => x.id === m.reward.col); got.push(c.name); lootCard(c.icon, '수집품', c.name, c.desc); }
    Object.entries(m.reward.item || {}).forEach(([k, n]) => { giveItem(k, n, true); got.push(`${ITEMS[k].name} ×${n}`); });
    toast('보답을 얻었다', got.join(' · '), 'opt'); if (!m.reward.col) { const k0 = Object.keys(m.reward.item || {})[0]; if (k0) lootCard(ITEMS[k0].icon, '보답', ITEMS[k0].name, ITEMS[k0].desc); }
    if (!m.replay) { p.done = true; p.label = m.label.split(' — ')[0] + ' (끝)'; }
  } else if (m.replay) say(`또 성공! (${FL.ms[m.id]}번째)`, 1400);
  refreshHud(); save(true);
}
async function gacha(p) {
  FL.ms = FL.ms || {}; const n = FL.ms.cafe || 0;
  if (n >= 3) { sfx.buzz(); say('손잡이가 더 이상 돌아가지 않는다. 안이 텅 비었다.', 2000); p.done = true; p.label = '뽑기 기계 (빈 통)'; return; }
  const r = await mini('gachaCrank', { title: `급식실 캡슐 뽑기 기계 (${n + 1} / 3회차) — 동전 투입 & 크랭크 360° 회전` });
  if (!r.ok) return;
  FL.ms.cafe = n + 1;
  const table = [['candy', '🍭'], ['thermos', '🍵'], ['battery', '🔋'], ['hairpin', '📍'], ['can', '🥫']], k = n === 2 && !(FL.col || {}).c11 ? null : table[(Math.random() * table.length) | 0][0];
  if (!k) { giveCol('c11'); const c = COLLECT.find(x => x.id === 'c11'); lootCard(c.icon, '캡슐 속 — 수집품', c.name, c.desc); }
  else { giveItem(k, 1, true); lootCard(ITEMS[k].icon, `캡슐 ${n + 1} / 3`, ITEMS[k].name, ITEMS[k].desc); }
  refreshHud(); save(true);
}
// ── 칠판: 질문을 쓰면 대답이 적힌다 (3D 칠판 텍스처도 바뀐다)
let chalkProp = null, chalkBusy = false;
function openChalk(p) {
  chalkProp = p; chalkBusy = false; $('chalkTitle').textContent = `${p.room} 교실 칠판`;
  $('chalkBoard').innerHTML = '<span style="opacity:.55">분필 가루가 남아 있다. 무엇을 써 볼까…</span>';
  $('chalkOpts').innerHTML = CHALK_QA.map((q, i) => `<button class="btn" data-i="${i}">${q.q}</button>`).join('') + '<button class="btn" data-i="-1">그만둔다</button>';
  $('chalkOpts').querySelectorAll('button').forEach(b => { b.onclick = () => chalkAsk(+b.dataset.i); });
  openUI('chalk'); sfx.paper();
}
function chalkType(el, text, ms, done) { let i = 0; const iv = setInterval(() => { el.textContent = text.slice(0, ++i); if (i % 2) sfx.click(); if (i >= text.length) { clearInterval(iv); done && done(); } }, ms); }
function chalkAsk(i) {
  if (chalkBusy) return; if (i < 0) { closeUI(); return; }
  const qa = CHALK_QA[i], a = FL.mina && qa.mina ? qa.mina : FL.calm && qa.calm ? qa.calm : qa.a;
  chalkBusy = true; const B = $('chalkBoard'); B.innerHTML = '<div class="q"></div><div class="reply" style="margin-top:22px"></div>';
  chalkType(B.querySelector('.q'), qa.q, 70, () => setTimeout(() => {
    sfx.creak(); fx.glitch(.25);
    chalkType(B.querySelector('.reply'), '— ' + a, 140, () => {
      FL.chalk = (FL.chalk || 0) + 1; chalkBusy = false; sfx.whisper(); P.fear = Math.min(1, P.fear + .2);
      const br = world.boardRefs[chalkProp.br]; if (br && br.mat) { br.mat.map = world.makeBoardTex([qa.q, '— ' + a]); br.mat.needsUpdate = true; }
      if (FL.chalk === 1) toast('칠판', '누군가 대답했다 — 다른 교실 칠판에도 물어볼 수 있다', 'info');
      if (Math.random() < .18 && !FL.calm) setTimeout(() => { if (state !== 'ui') return; B.innerHTML = '<div class="reply" style="font-size:22px;line-height:1.2">' + '다시, 여기서. '.repeat(26) + '</div>'; sfx.screech(); fx.glitch(.8); shake = .4; if (br && br.mat) { br.mat.map = world.makeBoardTex(['다시, 여기서', '다시, 여기서', '다시, 여기서']); br.mat.needsUpdate = true; } }, 1400);
    });
  }, 900));
}
$('chalkClose').onclick = () => closeUI();
$('anxClose').onclick = () => closeUI();
// ── 초자연 현상 감독: 쫓기지 않을 때 1~2분마다 하나씩 (장이 진행될수록 잦아진다)
/* ---------- 초자연 현상 2: 손자국 · 붉은 눈 · 핏방울 · 화장실 괴담 · 주변 소리 ---------- */
const tmpFx = [];   // 잠깐 나타났다 사라지는 3D 연출 (각자 재질을 복제해 투명도를 따로 조절)
function addTmp(f, o, life, fadeIn = .4, fadeOut = 1.2) {
  o.userData.dynamic = true; o.traverse(m => { if (m.material) { m.material = m.material.clone(); m.material.transparent = true; m.material.userData.op = m.material.opacity; m.material.opacity = 0; } });
  floors[f].interior.add(o); const e = { o, t: 0, life, fadeIn, fadeOut, f }; tmpFx.push(e); return e;
}
function tmpTick(dt) {
  for (let i = tmpFx.length - 1; i >= 0; i--) {
    const e = tmpFx[i]; e.t += dt; if (e.o.userData.tick) e.o.userData.tick(e);
    const k = Math.min(1, e.t / e.fadeIn, Math.max(0, e.life - e.t) / e.fadeOut);
    e.o.traverse(m => { if (m.material) m.material.opacity = (m.material.userData.op ?? 1) * k; });
    if (e.t >= e.life) { e.o.parent?.remove(e.o); e.o.traverse(m => { m.geometry?.dispose(); m.material?.dispose(); }); tmpFx.splice(i, 1); }
  }
}
// 바라보는 방향의 가장 가까운 벽 (축 정렬 벽으로 가정)
function wallAhead(maxD = 9) {
  const F = floors[P.floor], fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw); let d = .5;
  while (d < maxD && los(F.walls, P.x, P.z, P.x + fx * d, P.z + fz * d)) d += .2;
  const ry = Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? -Math.PI / 2 : Math.PI / 2) : (fz > 0 ? Math.PI : 0);
  return { d, fx, fz, ry, x: P.x + fx * (d - .25), z: P.z + fz * (d - .25), hit: d < maxD };
}
let _handTex = null, _poolTex = null;
const rbLift = (o, y) => { o.position.y += y; return o; };
// 새 건물 화장실(r.rb): 예전 화장실(폭 7.7m · z −9.6 ~ −1.75) 기준 자리를 새 화장실 크기로 줄여 옮긴다
const tPos = (r, lx, lz, ry = 0) => r.rb ? { x: r.cx + (lx - r.cx) * r.hw / 3.85, z: r.cz + (lz + 5.675) * r.hd / 3.92, ry } : r.south ? { x: 2 * r.cx - lx, z: -lz, ry: ry + Math.PI } : { x: lx, z: lz, ry };
const stallDoor = (f, r, n) => world.doorList.find(o => o.stall && o.floor === f && o.stallNo === n && Math.abs(o.x - r.cx) < 4);
function vig(id, ms) { const v = $(id); if (!v) return; v.classList.add('on'); clearTimeout(v._t); v._t = setTimeout(() => v.classList.remove('on'), ms); }
// 주변 소리: 자막 없이 14~36초마다 어딘가에서 들리는 소리 (긴장감 유지)
const AMB_SFX = [['pipeKnock', 3], ['creak', 3], ['drip', 2], ['wind', 2], ['buzz', 1]];   // 건물 소리만 (속삭임 · 발소리 같은 초자연 소리는 뺐다)
function ambientTick(dt) {
  if (isDialogueActive()) { XT.amb = Math.max(XT.amb ?? 6, 6); return; }
  XT.amb = (XT.amb ?? 20) - dt; if (XT.amb > 0) return; XT.amb = 14 + Math.random() * 22;
  if (state !== 'playing' || !introDone || P.hiding) return;
  const out = isOutdoors(), list = AMB_SFX.filter(([k]) => !out || ['wind', 'creak'].includes(k)), tot = list.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * tot, k = list[0][0]; for (const [n, w] of list) { r -= w; if (r <= 0) { k = n; break; } }
  const a = Math.random() * 6.28, d = 6 + Math.random() * 10, y = floors[P.floor].y0 + (k === 'thump' ? 3.6 : 1 + Math.random() * 1.5), S = at(P.x + Math.cos(a) * d, y, P.z + Math.sin(a) * d);
  S[k]();
}
/* ====================================================================
   확장 기능: 마이크 소리 감지 · 휴대폰 야간 카메라 · 환각(Sanity) · 조합 3종 · 복도 배전반 · 학교 차임벨 · 그것의 사물함 수색 · 페이크 퇴장
   ==================================================================== */
// ── 1. 마이크 소리 감지 (선택, 기본 끔) ──
async function micStart() {
  if (MIC.on) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); ctx.resume?.(); const src = ctx.createMediaStreamSource(stream); const an = ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
    Object.assign(MIC, { on: true, stream, ctx, an, buf: new Float32Array(an.fftSize), wave: new Float32Array(48) });
    $('micMeter').classList.add('on'); toast('마이크 감지 켜짐', '주변 소리를 파형으로 표시합니다', 'info'); return true;
  } catch (e) { SET.mic = false; saveSET(); $('setMic') && ($('setMic').checked = false); toast('마이크를 쓸 수 없습니다', '권한이 거부되었거나 마이크가 없습니다 — 기능을 껐습니다', 'warn'); return false; }
}
function micStop() { if (MIC.stream) MIC.stream.getTracks().forEach(t => t.stop()); if (MIC.ctx) MIC.ctx.close().catch(() => {}); Object.assign(MIC, { on: false, level: 0, risk: 0, an: null, stream: null, ctx: null }); $('micMeter').classList.remove('on'); }
function micTick(dt) {
  if (!MIC.on || !MIC.an) return;
  MIC.an.getFloatTimeDomainData(MIC.buf); let s = 0; for (let i = 0; i < MIC.buf.length; i++) s += MIC.buf[i] * MIC.buf[i];
  const rms = Math.sqrt(s / MIC.buf.length), lv = clamp((Math.log10(Math.max(rms, 1e-5)) + 2.6) / 1.9, 0, 1);   // -52dB → 0 · -13dB → 1
  MIC.level = Math.max(lv, MIC.level - dt * 1.6);
  MIC.wave.copyWithin(0, 1); MIC.wave[MIC.wave.length - 1] = lv;
  const TH = .42; MIC.risk = 0;
  // 미터: 파형 + 볼륨 · 위험
  const c = $('micCv'), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  g.strokeStyle = MIC.level > TH ? '#ff5a4a' : '#8fd0a0'; g.lineWidth = 2; g.beginPath();
  MIC.wave.forEach((v, i) => { const x = i / (MIC.wave.length - 1) * c.width, y = c.height / 2 + (i % 2 ? -1 : 1) * v * c.height * .45; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(TH * c.width, 0, 1, c.height);
  $('micLv').style.width = MIC.level * 100 + '%'; $('micRisk').style.width = MIC.risk * 100 + '%';
}

// ── 2. 휴대폰 야간 카메라 (오른쪽 클릭 · X · 휴대폰 › 카메라) ──
camera.layers.disable(2);
const ghostTarget = { position: new THREE.Vector3() };
const ghostAim = () => { const G = ghost; if (!G.active || G.floor !== P.floor) return null; ghostTarget.position.set(G.x, floors[G.floor].y0 + 1.4, G.z); return ghostTarget; };
function camMode(on) {
  if (on === ghostCam.isActive) return;
  if (on && (P.pbat ?? 100) <= 1) { say('휴대폰 배터리가 없다', 1600); return; }
  ghostCam.phoneBattery = P.pbat ?? 100;
  ghostCam.toggleCamera(m => say(m, 2200)); CAM.on = ghostCam.isActive;
  if (CAM.on && !FL.camTip) { FL.camTip = true; toast('야간 카메라', '어두운 곳의 흔적을 플래시로 찍어 남긴다 · 클릭/R: 플래시 촬영(20%) · 오른쪽 클릭/X: 끄기', 'info'); }
}
function camShoot() {
  if (!CAM.on) return;
  ghostCam.phoneBattery = P.pbat ?? 100;
  photoCheck();
  const ok = ghostCam.triggerFlash({ monsterObj: ghostAim(), stunMonsterCallback: sec => stunGhost(sec, null), notifyUI: m => say(m, 2600), onClueCaptured: captureClue });
  P.pbat = ghostCam.phoneBattery; if (ok) { fx.lightning(); fx.glitch(.15); SHOT.req = true; }
}
// ── 사진 미션: 「사라진 앨범」 (사진부 의뢰 · 6단계 연계) ──
// 제2장부터. 단계마다 힌트가 오고, 그 장소를 야간 카메라(X)로 겨누고 찍으면(클릭 · R) 다음 단계가 열린다. 단계마다 다른 대사 · 마지막에 수집품
const PHOTOQ = [
  { f: 0, x: -10.2, z: 17.2, r: 7, hint: '운동장 조회대 — 10년 전 아침 조회 사진과 같은 자리', where: '운동장 조회대', ok: '찰칵 — 10년 전 조회 사진과 겹쳐 보니, 조회대 옆 게시판만 새로 칠해져 있다' },
  { f: 0, x: -10.4, z: -8.6, r: 5, hint: '교무실 금고 앞 — “선생님들이 숨긴 것”', where: '본관 1층 교무실', ok: '찰칵 — 확대하니 금고 문 아래 긁힌 자국. 최근에 누군가 억지로 연 흔적이다' },
  { f: 10, x: -5.8, z: -6.6, r: 5, hint: '별관 1층 음악실 피아노 — 반주 연습하던 자리', where: '별관 1층 음악실', ok: '찰칵 — 피아노 보면대에 1998년 10월 반주 악보가 그대로 꽂혀 있다', col: 'c21' },
  { f: 1, x: -.4, z: -15.2, r: 5, hint: '본관 ↔ 별관 2층 구름다리 — 증기 배관이 지나는 곳', where: '2층 연결 구름다리', ok: '찰칵 — 플래시에 비친 유리창 구석, 오래전 긁어 새긴 글씨: “나 여기 있었어”' },
  { f: 6, x: -41.5, z: 46.4, r: 6, hint: '수영장 배수구 — 물이 빠지지 않는 곳', where: '수영장', ok: '찰칵 — 배수구 철망에 새 자물쇠가 채워져 있다. 사건 뒤에 누군가 바꿔 단 것이다' },
  { f: 3, x: 14.5, z: 4.6, r: 7, hint: '옥상 발전기 옆 — 마지막 롤', where: '옥상', ok: '찰칵 — 노을 진 옥상, 세 아이가 웃고 있다. 그리고 그날 찍은 원본과 달리, 이 자리에 있던 네 번째 아이가 빠져 있다', col: 'c22' },
];
const PQ_MSG = ['사진부 선배가 남긴 메모: “앨범의 빈 칸을 채워 줘. 처음은 조회대.”', '두 번째 칸: 교무실 금고. 거기서 그날 밤 회의가 있었어.', '세 번째 칸은 음악실. 하늘이는 반주를 맡았었지.', '네 번째: 두 건물 사이 통로. 그날 밤 거기로 뛰어갔대.', '다섯 번째… 수영장. 미안, 이건 나도 못 찍었어.', '마지막 칸. 옥상. 우리가 처음 찍었던 곳.'];
const pqStep = () => FL.pq || 0;
function pqTarget(T) {   // 새 건물: 예전 층 좌표의 사진 자리 → 옮긴 금고 · 피아노 · 2층 높이 연결 통로 자리 (층 높이 rbY 포함)
  if (!RBG || !T) return T; let m = null;
  if (T.f === 1 && T.x > -1.7 && T.x < 3.7 && T.z > -20.6 && T.z < -9.8 && RBG.passToNew) { const [x, z] = RBG.passToNew(T.x, T.z); m = { x, z, rbY: 3.6 }; }
  else { const pk = T.col === 'c21' ? 'piano' : /금고/.test(T.hint) ? 'safe' : null, p = pk && world.props.find(q => q.kind === pk && q.rbY != null);
    m = p ? { x: p.x, z: p.z, rbY: p.rbY } : RBG.mapLoc({ f: T.f, x: T.x, z: T.z }, world); }
  if (!m || m.rbY == null) return T;
  const lab = RBG.where(m.x, m.z, m.rbY + .5) || (RBG.inWalkway && RBG.inWalkway({ floor: 0, x: m.x, z: m.z, sh: m.rbY }) ? '본관 ↔ 별관 연결 통로 (2층 높이)' : null);
  return { ...T, f: 0, x: m.x, z: m.z, rbY: m.rbY, where: lab || T.where, hint: lab ? (([h, ...r]) => { const core = h.replace(/^(본관 ↔ 별관 2층 |본관 |별관 )?(\d층 )?/, ''); return `${lab}${lab.includes(core) ? '' : ' · ' + core}${r.length ? ' — ' + r.join(' — ') : ''}`; })(T.hint.split(' — ')) : T.hint };
}
// 새 건물: 지금 서 있는 방 이름 (예전 층 번호로만 걸려 있던 이벤트를 새 건물 방에서도 발동)
function rbHere() { return RBG && P.floor === 0 && RBG.where ? (RBG.where(P.x, P.z, (P.sh || 0) + .5) || '') : ''; }
function photoCheck(force) {
  const k = pqStep(), T = pqTarget(PHOTOQ[k]); if (!T || (!force && objective().ch < 2) || T.f !== P.floor || (T.rbY != null && Math.abs((P.sh || 0) - T.rbY) > 1.8)) return;
  const dx = T.x - P.x, dz = T.z - P.z, d = Math.hypot(dx, dz); if (d > T.r || d < .4) return;
  const fx0 = -Math.sin(P.yaw), fz0 = -Math.cos(P.yaw); if ((dx * fx0 + dz * fz0) / d < Math.cos(.5)) { say('조금 더 정면으로 — 그 자리가 화면 가운데 오게', 1800); return; }
  FL.pq = k + 1; FL.pqShots ||= []; FL.pqShots.push({ k, t: clockText() });
  sfx.photo ? sfx.photo() : sfx.pickup(); caption(T.ok);
  if (T.col) { if (giveCol(T.col)) { const c = COLLECT.find(q => q.id === T.col); lootCard(c.icon, '사진 미션', c.name, '앨범 사이에서 떨어졌다'); } }
  if (k + 1 < PHOTOQ.length) setTimeout(() => { toast('사진 미션 — 사라진 앨범', PQ_MSG[k + 1], 'opt'); }, 2600);
  else { giveItem('battery', 2, true); setTimeout(() => toast('사진 미션 완료', '앨범이 채워졌다 — 보답: 건전지 ×2 · 빛바랜 필름 통', 'opt'), 2600); }
  refreshHud(); save(true);
}
function pqHud() {
  const box = $('phBox'); if (!box) return; const k = pqStep(), on = objective().ch >= 2;
  if (on && !FL.pqStart) { FL.pqStart = true; setTimeout(() => toast('사진 미션 — 사라진 앨범', PQ_MSG[0] + ' (야간 카메라 X · 클릭으로 촬영)', 'opt'), 1500); }
  box.style.display = on ? 'block' : 'none';
  $('phTitle').textContent = `서브 미션 · 사라진 앨범 (${k}/${PHOTOQ.length})`;
  $('phSubs').innerHTML = PHOTOQ.map(pqTarget).map((T, i) => i < k ? `<div class="chk done">📷 ${T.where}</div>` : i === k ? `<div class="chk">📷 ${T.hint}</div>` : '').join('');
}
// 현장 사진: FL.spirit 에 저장(세이브 유지) → 휴대폰 사진 · 메모 탭
function captureClue(c) {
  FL.spirit ||= []; if (FL.spirit.some(x => x.id === c.id)) return;
  FL.spirit.push({ id: c.id, text: c.text, subText: c.subText, t: clockText() }); sfx.pickup(); toast('현장 사진 저장', `${c.text} — 휴대폰 › 사진 · 메모`, 'opt'); save(true);
}
function spiritPhoto(x) {   // 저장된 글씨로 사진을 다시 그린다 (초록 야간투시 톤)
  const c = document.createElement('canvas'); c.width = 320; c.height = 180; const g = c.getContext('2d');
  const gr = g.createRadialGradient(160, 90, 10, 160, 90, 190); gr.addColorStop(0, '#1d3a22'); gr.addColorStop(1, '#030805'); g.fillStyle = gr; g.fillRect(0, 0, 320, 180);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(160,255,180,${Math.random() * .08})`; g.fillRect(Math.random() * 320, Math.random() * 180, 1, 1); }
  g.shadowColor = '#33ff88'; g.shadowBlur = 12; g.fillStyle = '#c8ffd8'; g.font = `bold 24px ${"'Noto Sans KR',sans-serif"}`; g.fillText(x.text, 18, 82);
  g.shadowColor = '#ff1133'; g.fillStyle = '#ff6677'; g.font = '15px sans-serif'; g.fillText(x.subText, 20, 116);
  g.shadowBlur = 0; g.fillStyle = '#ff3b3b'; g.font = 'bold 12px monospace'; g.fillText('● REC ' + (x.t || ''), 14, 20); return c.toDataURL('image/png');
}
function stunGhost(sec, msg) {
  const G = ghost, F = floors[G.floor]; G.stunT = Math.max(G.stunT || 0, sec); G.hunt = null; G.lockSearch = null; G.fake = null; G.state = 'search'; G.path = []; G.replan = 0; G.wait = 0;
  let far = F.nodes[0]; F.nodes.forEach(n => { if (Math.hypot(n.x - P.x, n.z - P.z) > Math.hypot(far.x - P.x, far.z - P.z)) far = n; }); G.target = { x: far.x, z: far.z };
  at(G.x, F.y0 + 1.5, G.z).screech(); fx.glitch(.5); shake = .3; if (msg) caption(msg);
}
// 숨겨진 단서 (카메라로만 보이는 레이어): 층마다 빛나는 발자국 · 벽의 글씨 · 금고 힌트 · 목표 방향 화살표
function buildCamClues() {
  const glowM = (col, op = .9) => new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const foot = new THREE.PlaneGeometry(.13, .3), footM = glowM(0xffffff, .95);
  const mk = (f, o) => { o.layers.set(CAM.layer); o.userData.dynamic = true; floors[f].interior.add(o); CAM.clues.push(o); return o; };
  const textPlane = (f, txt, w, x, y, z, ry, rx = 0, col = '#c8ffd8') => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshBasicMaterial({ map: makeGraffiti(txt, col), transparent: true, depthWrite: false, fog: false })); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); return mk(f, m); };
  // 발자국: 복도를 따라 계단 쪽에서 방 하나로 이어진다
  [0, 1, 2, 8, 9, 10, 4].forEach((f, k) => {
    if (!floors[f]) return; const x0 = (k % 2 ? -1 : 1) * (6 + k * 2), x1 = x0 + (k % 2 ? -14 : 14);
    for (let i = 0; i < 18; i++) { const t = i / 17, x = x0 + (x1 - x0) * t, z = (i % 2 ? .18 : -.18) + Math.sin(t * 3) * .4; const m = new THREE.Mesh(foot, footM); m.rotation.set(-Math.PI / 2, 0, Math.sign(x1 - x0) > 0 ? -Math.PI / 2 : Math.PI / 2); m.position.set(x, .02, z); mk(f, m); }
    textPlane(f, ['여기 있어', '나를 찾아', '돌아가', '같이 놀자', '3-2', '보고 있어', '밑에 있어'][k], 1.6, x1, 1.6, -1.72, 0, 0, '#ffffff');
  });
  // 금고 힌트: 교무실 금고 앞 바닥의 손글씨 — 그날의 날짜
  const sf = world.props.find(p => p.kind === 'safe');
  if (sf) { const r = roomAt(sf.floor, sf.x, sf.z), cx = r ? r.cx : sf.x, dx = cx - sf.x, dz = -5.6 - sf.z, d = Math.hypot(dx, dz) || 1; textPlane(sf.floor, '10 월 12 일', 1.4, sf.x + dx / d * 1.1, .03, sf.z + dz / d * 1.1, Math.atan2(dx, dz) + Math.PI, -Math.PI / 2, '#ffffff'); }
  // 사용자 지정 숨은 단서 3곳 (GhostCameraSystem.createHiddenWallClue · 촬영하면 휴대폰 사진 · 메모에 저장)
  const V = (f, x, y, z) => new THREE.Vector3(x, floors[f].y0 + y, z);
  ghostCam.createHiddenWallClue({ position: V(0, -5.4, 1.75, -9.5), rotationY: 0, text: '금고: 그날의 날짜', subText: '10월 12일 — 네 자리 숫자', clueId: 'sp_safe' });
  ghostCam.createHiddenWallClue({ position: V(1, -35.88, 1.6, .5), rotationY: Math.PI / 2, text: `조각 → ${KEY_WHERE[2]}`, subText: '약품장 맨 아래 칸을 봐', clueId: 'sp_key' });
  ghostCam.createHiddenWallClue({ position: V(0, -28.2, 2.0, -3.0), rotationY: -Math.PI / 2, text: '3번 칸 — 1998.10.12 23:10', subText: '“관리인 아저씨가 열쇠 꾸러미를 들고 지나감” — 낙서', clueId: 'sp_toilet' });
  // 목표 방향 화살표 (매 프레임 위치 갱신)
  const ar = new THREE.Mesh(new THREE.ConeGeometry(.12, .4, 12).rotateX(Math.PI / 2), glowM(0xffe070)); ar.layers.set(CAM.layer); ar.userData.dynamic = true; scene.add(ar); CAM.arrow = ar;
}
function camTick(dt) {
  if (ghostCam.isActive || ghostCam.flashCooldown > 0) { ghostCam.phoneBattery = P.pbat ?? 100; ghostCam.update(dt, ghostAim(), state !== 'playing'); P.pbat = ghostCam.phoneBattery; }
  if (CAM.on && !ghostCam.isActive) { CAM.on = false; say('휴대폰 배터리가 꺼졌다', 1800); }
  if (!CAM.on) { if (CAM.arrow) CAM.arrow.visible = false; return; }
  const d = objDir(), ar = CAM.arrow; ar.visible = !!(d && !d.other);
  if (ar.visible) { const fx2 = -Math.sin(P.yaw), fz2 = -Math.cos(P.yaw); ar.position.set(P.x + fx2 * 1.6, floors[P.floor].y0 + 1.25 + Math.sin(tNow * 3) * .05, P.z + fz2 * 1.6); ar.rotation.set(0, d.ang + Math.PI, 0); }
}

// ── 3. 환각 (공포 75% 이상) ──
// 공포 환각 연결 (사용자 제공 SanityHallucinationSystem): 공포 0~100 · 접근성 '공포 화면 효과'를 끄면 실행하지 않는다
const fakeMsgs = [];   // 환각 문자 — 휴대폰 메시지함에 잠시 끼어들었다가 공포가 50% 이하로 내려가면 사라진다 (저장하지 않음)
if (window.sanitySystem) window.sanitySystem.audioCtx = sfxCtx;
if (window.sanitySystem) { const S = window.sanitySystem, orig = S.triggerFakePhoneNotification.bind(S);
  S.triggerFakePhoneNotification = () => { orig(); fakeMsgs.push({ who: $('sanity-sms-sender').textContent, text: $('sanity-sms-body').textContent, t: clockText() }); refreshHud(); }; }
function sanityTick(dt) {
  const S = window.sanitySystem;
  if (SET.fearFx) S.update(dt, P.fear * 100, state !== 'playing'||isSpeechBusy()||voBusy, false); else if (S.isActive) S.update(dt, 0, true);
  if (fakeMsgs.length && P.fear <= .5) fakeMsgs.length = 0;
  const gl = document.body.classList.contains('sanity-glitch-frame');   // 화면이 뒤틀리는 순간 시야각 +6° → 원래 FOV 로 부드럽게 (매 프레임 보간)
  if (gl && !SAN.gl && P.fear >= .8) { camera.fov += 6; camera.updateProjectionMatrix(); } SAN.gl = gl;
}

// ── 4. 조합 연결 (사용자 제공 CraftingSystem): 클래스의 인벤토리를 게임 소지품(inv)에 그대로 연결한다 ──
const playerRef = { position: new THREE.Vector3() };   // 플레이어 발 위치 (층 높이 포함) — 조합 · 배전반 시스템 공용
const CRAFT_MAP = { bandage: 'medkit', pill: 'sedative', trap_can: 'alarm', short_bomb: 'shock', med_kit: 'firstaid' };
const CRAFT_ID = { alarm: 'trap_can', shock: 'short_bomb', firstaid: 'med_kit' };
const PS = { get hp() { return P.hp; }, set hp(v) { P.hp = v; }, get fear() { return P.fear * 100; }, set fear(v) { P.fear = clamp(v / 100, 0, 1); }, set staminaInfiniteTimer(v) { P.stamInfT = v; }, get staminaInfiniteTimer() { return P.stamInfT || 0; } };   // 공포는 0~100 으로
const notify = m => say(m, 2800);
// 층이 여러 개라 바닥 높이 · 벽을 게임에 맞춘다. 클래스의 빈 효과음 자리는 게임 효과음으로 채운다
class GameCrafting extends CraftingSystem {
  deployTrap(n) {
    if (P.hiding) return false; const ok = super.deployTrap(n); if (!ok) return ok;
    const T = this.activeTraps[this.activeTraps.length - 1]; T.position.y = playerRef.position.y + .05; T.group.position.y = T.position.y; T.floor = P.floor;
    const cm = new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: .4, metalness: .7 });
    [[0, 0], [.09, .05], [-.08, .06]].forEach(([x, z], i) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.033, .033, .12, 10), cm); c.position.set(x, .08 + (i === 2 ? .12 : 0), z); T.group.add(c); });
    sfx.clank(.4); refreshHud(); return ok;
  }
  throwShortBomb(dir, n, alertFn) {
    const f = P.floor, F = floors[f]; let d = 0; while (d < 4.5 && los(F.walls, P.x, P.z, P.x + dir.x * (d + .25), P.z + dir.z * (d + .25))) d += .25;   // 벽 앞에서 멈춘다
    const ok = super.throwShortBomb(dir.clone().multiplyScalar(d / 4.5), n, (pos, r, st) => { pos.y = F.y0 + .2; alertFn(pos, r, st, f); });
    if (ok) { const m = mkCan(); scene.add(m);
      throws.push({ m, t: 0, dur: 1.15, a: camera.position.clone(), b: new THREE.Vector3(P.x + dir.x * d, F.y0 + .05, P.z + dir.z * d), f, h: .8, kind: 'visual' }); }
    refreshHud(); return ok;
  }
  playThrowSound() { sfx.throwIt(); } playHealSound() { sfx.pickup(); } playTrapTriggerSound() {} playSparkExplosionSound() {}
}
const craftingSystem = window.craftingSystem = new GameCrafting(scene, playerRef, sfxCtx);
craftingSystem.inventory.items = new Proxy({}, { get: (_, k) => inv[CRAFT_MAP[k] || k] || 0, set: (_, k, v) => { inv[CRAFT_MAP[k] || k] = v; return true; } });
// 함정 · 쇼트 폭탄이 터질 때: 소리 · 스파크 · 그것을 끌어들이거나 마비 · (함정) 12초 위치 표시
function alertMonsterFn(pos, radius, stunSec, f) {
  const G = ghost; f ??= floors.findIndex(F => F && Math.abs(F.y0 - (pos.y - .05)) < 1.5); const A = at(pos.x, pos.y + .2, pos.z);
  if (stunSec > 0) { for (let k = 0; k < 40; k++) fx.emit(pos.x, pos.y + .1, pos.z, (Math.random() - .5) * 4, Math.random() * 3, (Math.random() - .5) * 4, .5 + Math.random() * .5, [.4, .7, 1], .9, .03, 6); A.spark(); setTimeout(() => A.spark(), 180); A.buzz(); }
  else { A.rattle(22); A.clank(1.2); XT.revealT = 12; XT.revealF = f; fx.glitch(.2); }
  if (!G.active || G.floor !== f) return; const d = Math.hypot(G.x - pos.x, G.z - pos.z);
  if (stunSec > 0 && d < 5) stunGhost(stunSec, '푸른 스파크 — 그것이 경련하며 멈췄다');
  else if (d < radius && !G.enraged) { G.state = 'search'; G.target = { x: pos.x, z: pos.z }; G.path = []; G.replan = 0; G.wait = 0; G.hunt = null; }
}
const camDir = () => new THREE.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
function placeAlarm() { craftingSystem.deployTrap(notify); refreshHud(); }
function throwShock() { craftingSystem.throwShortBomb(camDir(), notify, alertMonsterFn); }
function useFirstAid() { const ok = craftingSystem.useMedKit(PS, notify); if (ok) { P.stamina = 100; P.tired = false; calmDown(30); refreshHud(); } return ok ? '응급 처치 키트: 체력 100 · 긴장 0 · 25초 동안 지치지 않는다' : ''; }
const ghostFoot = new THREE.Vector3();
function trapTick(dt) {
  if (XT.revealT > 0) XT.revealT -= dt;
  playerRef.position.set(P.x, floors[P.floor] ? floors[P.floor].y0 : 0, P.z);
  const G = ghost; craftingSystem.update(G.active ? ghostFoot.set(G.x, floors[G.floor].y0 + .05, G.z) : null, m => (G.floor === P.floor ? caption(m) : toast('경보 함정이 울렸다', `${FLOOR_LABEL[G.floor]} — 12초 동안 위치 표시`, 'warn')), alertMonsterFn);
}
// 그것 위치 표시 (함정이 울린 뒤 12초): 미니맵 붉은 점 + 화면 마커
function revealDraw(g) {
  const G = ghost; const on = XT.revealT > 0 && G.active && G.floor === P.floor; const mk = $('ghostMark'); mk.classList.toggle('on', on); if (!on) return;
  if (g) { const S = 2.6, x = 75 + (G.x - P.x) * S, y = 75 + (G.z - P.z) * S; g.fillStyle = '#ff2a2a'; g.beginPath(); g.arc(clamp(x, 6, 144), clamp(y, 6, 144), 5 + Math.sin(tNow * 8) * 1.5, 0, 6.3); g.fill(); }
  const v = new THREE.Vector3(G.x, floors[G.floor].y0 + 1.5, G.z).project(camera), behind = v.z > 1;
  mk.style.left = clamp((behind ? -v.x : v.x) * .5 + .5, .03, .97) * innerWidth + 'px'; mk.style.top = clamp(behind ? .9 : -v.y * .5 + .5, .05, .95) * innerHeight + 'px';
}

// ── 5. 배전반 · 차임벨 연결 (사용자 제공 SchoolPowerEventSystem) ──
//   배전반은 층마다 복도 서쪽 끝(본관 2층 복도 끝 포함) + 교무실 앞 복도. 비상등 불빛 · 안전 구역(배전반 6m 안 공포 감소) · 3분 30초 뒤 과부하
const schoolPower = window.schoolPowerSystem = new SchoolPowerEventSystem(scene, playerRef, sfxCtx);
const BRK = {};   // f → { on, lamps, box } — 비상등 연출 (전구 · 빛무리)
function buildBreakers() {
  const lampM = new THREE.MeshBasicMaterial({ color: 0xffb060 }), offM = new THREE.MeshBasicMaterial({ color: 0x2a2620 });
  const spots = [0, 1, 2, 8, 9, 10].map(f => [f, f >= 8 ? -19.93 : -35.93, -1.0, Math.PI / 2]).concat([[0, -10.6, -1.43, 0]]);   // 마지막: 교무실 앞 복도 벽 (문 옆 벽 — 예전 x −8 은 교무실 문 한가운데였다)
  spots.forEach(([f, x, z, ry], i) => {
    const F = floors[f]; if (!F) return;
    const grp = schoolPower.createPowerBox(new THREE.Vector3(x, F.y0, z), ry, `pb_${f}_${i}`), box = schoolPower.powerBoxes[schoolPower.powerBoxes.length - 1];
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(.4, .1), new THREE.MeshBasicMaterial({ map: makeSign('배 전 반', '#d8c020', '#111', 26) })); sign.position.set(0, 1.68, .02); grp.add(sign);
    if (!BRK[f]) {
      const lamps = []; for (let k = 0; k < 6; k++) { const lx = (f >= 8 ? -16 : -30) + k * (f >= 8 ? 6.4 : 12); const lm = new THREE.Mesh(new THREE.BoxGeometry(.3, .08, .12), offM); lm.position.set(lx, 3.2, 1.6); lm.userData.dynamic = true; F.interior.add(lm);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('255,190,110'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); sp.scale.set(3, 2, 1); sp.position.set(lx, 3.0, 1.3); F.interior.add(sp); lamps.push({ lm, sp }); }
      BRK[f] = { on: false, lamps, lampM, offM, boxes: [] };
    }
    BRK[f].boxes.push(box);
    const nx = Math.sin(ry), nz = Math.cos(ry);
    world.props.push({ kind: 'cbreaker', floor: f, x: x + nx * .6, z: z + nz * .6, y: 1.25, box, label: '배전반(두꺼비집) 열기 — 전력 복구' });
  });
}
async function useCBreaker(p) {
  const box = p.box;
  box.onInteract(PS, notify, async () => {   // 클래스의 상호작용 → 스위치 미니게임 → restorePower
    sfx.click(); const r = { ok: await megaMini('voltage') }; if (!r.ok) { sfx.spark(); P.noiseT = 1.2; say('스파크가 튄다 — 소리가 복도로 퍼졌다', 1800); return; }
    schoolPower.restorePower(notify); box.isRestored = true; box.led.material.color.setHex(0x22ff44); setBreaker(p.floor, true); sfx.breaker(); P.noiseT = 1.5;
  });
}
function setBreaker(f, on) {
  const B = BRK[f]; if (!B) return; B.on = on;
  B.lamps.forEach(({ lm, sp }) => { lm.material = on ? B.lampM : B.offM; sp.material.opacity = on ? .55 : 0; });
}
let chimeWas = false;
function breakerTick(dt) {
  playerRef.position.set(P.x, floors[P.floor] ? floors[P.floor].y0 : 0, P.z);
  if (state === 'playing' && introDone) schoolPower.update(dt, PS, notify);
  for (const f in BRK) { const B = BRK[f]; if (B.on && !B.boxes.some(b => b.isRestored)) { setBreaker(+f, false); if (+f === P.floor) { sfx.spark(); sfx.lightsOff(); blackout = Math.max(blackout, .4); } } }   // 과부하로 꺼짐
  const ch = schoolPower.isChimeActive;   // 차임벨: 15초 동안 발소리 은폐 (그것의 청각 판정에서 제외)
  if (ch && !chimeWas) sfx.chimeWarp(15); $('chimeBar').classList.toggle('on', ch); chimeWas = ch;
}


// ── 7. 화장실 연결 (사용자 제공 RestroomSystem): 세면대 세수(공포 -25) ↔ 핏물 역류(28% · 같은 세면대 3번째부터, 공포 +18 · 거울 핏빛 글씨) · 물소리 14m 유인 ──
//   세면대 모양은 이미 화장실에 있으므로 클래스가 만드는 상자 세면대는 숨기고 상호작용만 쓴다. 변기 물 내리기는 22m 유인
class GameRestroom extends RestroomSystem {
  createSinkUnit(position, rotationY, sinkId, ctx) {
    const grp = super.createSinkUnit(position, rotationY, sinkId), obj = this.interactables[this.interactables.length - 1]; obj.mesh.visible = false; obj.uses = 0;
    obj.onInteract = (ps, notifyUI, alertFn) => {
      obj.uses++; const blood = false;
      sinkStream(ctx, blood); at(position.x, position.y + .9, position.z).faucet(5);
      if (blood) { ps.fear = Math.min(100, ps.fear + 18); notifyUI('수도꼭지에서 검붉은 핏물이 쏟아진다! 거울이 붉게 물든다 (공포 +18%)'); sinkMirror(ctx); sfx.stinger(.6); fx.glitch(.5); shake = .3; setFace('surprise', 2.4); }
      else { ps.fear = Math.max(0, ps.fear - 25); notifyUI('시원한 수돗물로 세수를 했다 (긴장 -25%) — 물소리가 복도로 퍼진다'); setFace('relief', 2.4); }
      alertFn(position, 14);
    };
    return grp;
  }
}
const restroom = window.restroomSystem = new GameRestroom(scene);
function buildRestrooms() {
  world.props.filter(p => p.kind === 'sink').forEach((p, i) => {
    const r = roomAt(p.floor, p.x, p.z) || { type: 'toilet', name: '화장실', cx: Math.round(p.x / 8) * 8, south: p.z > 0 }, wx = r && r.south ? p.x - .3 : p.x + .3;   // 벽 쪽 수전 위치 (남쪽 방은 반대)
    const zl = r.south ? -p.z : p.z; p.ctx = { f: p.floor, r, tap: tPos(r, r.cx + 3.85 - .21, zl), zl };
    p.sink = restroom.createSinkUnit(new THREE.Vector3(wx, floors[p.floor].y0, p.z), r && r.south ? Math.PI / 2 : -Math.PI / 2, `sink_${p.floor}_${i}`, p.ctx);
    p.sinkObj = restroom.interactables[restroom.interactables.length - 1];
  });
}
function sinkStream(c, blood) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(.008, .012, .19, 8), new THREE.MeshStandardMaterial({ color: blood ? 0x6a0606 : 0xa8c8d0, roughness: .05, transparent: true, opacity: .8 }));
  m.position.set(c.tap.x, .875 + (c.rb || 0) + (c.rb != null ? .09 : 0), c.tap.z); m.userData.tick = () => { m.scale.x = m.scale.z = .8 + Math.random() * .5; if (Math.random() < .35) fx.emit(c.tap.x, (c.rb != null ? c.rb + .05 : floors[c.f].y0) + .8, c.tap.z, (Math.random() - .5) * .4, .4, (Math.random() - .5) * .4, .3, blood ? [.45, .03, .03] : [.7, .8, .85], .4, .015, 6); };
  addTmp(c.f, m, 5, .2, .4);
}
function sinkMirror(c) {   // 거울이 핏빛으로 번지고 '뒤에 누구야'
  if (c.mirror) { const g = new THREE.Group(), red = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .7), new THREE.MeshBasicMaterial({ color: 0x5a0000, transparent: true, opacity: .55, depthWrite: false })); g.add(red); const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .28), new THREE.MeshBasicMaterial({ map: makeGraffiti('뒤에 누구야', '#c01010'), transparent: true, depthWrite: false })); w.position.set(0, .05, .002); g.add(w); g.position.set(c.mirror.x, c.mirror.y, c.mirror.z); g.rotation.y = c.mirror.ry; addTmp(0, g, 12, 1.2, 3); return; }   // 새 건물: 세면대 유리판에
  const r = c.r, p = tPos(r, r.cx + 3.85 - .043, c.zl, -Math.PI / 2), g = new THREE.Group();
  const red = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .9), new THREE.MeshBasicMaterial({ color: 0x5a0000, transparent: true, opacity: .55, depthWrite: false })); g.add(red);
  const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .28), new THREE.MeshBasicMaterial({ map: makeGraffiti('뒤에 누구야', '#c01010'), transparent: true, depthWrite: false })); w.position.set(0, .1, .002); g.add(w);
  g.position.set(p.x, 1.65, p.z); g.rotation.y = p.ry; addTmp(c.f, g, 12, 1.2, 3);
}
const lureTo = (f, pos, radius) => { const G = ghost; if (!G.active || G.floor !== f || G.enraged || Math.hypot(G.x - pos.x, G.z - pos.z) > radius) return false; G.state = 'search'; G.target = { x: pos.x, z: pos.z }; G.path = []; G.replan = 0; G.wait = 0; G.hunt = null; return true; };
function useSink(p) { p.sinkObj.onInteract(PS, notify, (pos, radius) => lureTo(p.floor, pos, radius)); P.noiseT = 1.2; }
function useFlush(p) {
  at(p.x, floors[p.floor].y0 + .5, p.z).flush(); P.noiseT = 2.5; shake = .15;
  const lured = lureTo(p.floor, p, 22); caption(lured ? '쏴아 — 요란한 물소리에 발소리가 이쪽으로 방향을 튼다' : '쏴아 — 물 내려가는 소리가 화장실을 울린다');
}

/* ───────── 7 ~ 9. 사용자 제공 패치 3종 연결 ─────────
   7. 5대 구역(경비실 · 운동장 · 과학실 · 급식실 · 옥상) — fiveZonesPatch.js
   8. 본관 ↔ 별관 실내 연결복도 — indoorPassagePatch.js
   9. 3D 철제 캐비닛 사물함 + 본관 복도 리모델링 — corridorLockerPatch.js
   클래스 코드는 그대로 두고, 클래스가 만든 메시를 실제 맵 좌표 · 층 그룹으로 옮겨 붙이고, E 상호작용 · 저장 · 그것 AI · HUD 에 연결한다.
   (클래스가 만드는 PointLight 는 장면 조명 수가 바뀌어 모든 재질 셰이더가 다시 컴파일되고 매 프레임 비용이 커서 → 발광 메시로 바꾼다) */
const fzP = window.fiveZonesPatch, ipP = window.indoorPassagePatch, clP = window.corridorLockerPatch;
[fzP, ipP, clP].forEach(p => p.init({ scene, camera, audioCtx: sfxCtx }));
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const FLR = f => floors[f].interior;
const srgb = t => { if (t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; } return t; };
const PM = (c, r = .6, m = 0, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...o });
const pmesh = (geo, mat, x, y, z, parent, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz; m.castShadow = o.cast !== false; m.receiveShadow = true; m.userData.dynamic = true; parent.add(m); return m; };
const pbox = (w, h, d, mat, x, y, z, parent, o) => pmesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent, o);
const pcyl = (r1, r2, h, mat, x, y, z, parent, o = {}) => pmesh(new THREE.CylinderGeometry(r1, r2, h, o.seg || 14), mat, x, y, z, parent, o);
// 클래스가 장면에 바로 넣은 그룹 → 층 그룹으로 (좌표는 층 기준으로 다시 놓는다)
const adopt = (g, parent) => { parent.add(g); g.position.set(0, 0, 0); g.rotation.set(0, 0, 0); g.traverse(o => { o.userData.dynamic = true; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; };
const IA = (pp, id) => pp.interactables.find(i => i.id === id);
// 공포 · 체력 연결 (클래스는 window.schoolPatchAddon / window.player 를 찾는다)
const FZ = { cctvScareT: 0, cctvT: 0, skel: null, skelSeenAt: null, skelScareCD: 0, prevLocked: false, genT: 0, beacon: null, lamp: null, led: null, freezerDoor: null, freezerCol: null, doorCol: null, hole: null, flameT: 0, lastLockFx: 0 };
window.schoolPatchAddon = { addFear(a) {
  P.fear = Math.min(1, P.fear + a / 100);
  if (a >= 20) { FZ.cctvScareT = 4; fx.glitch(.8); shake = .5; evFx('evPulse'); setFace('fear', 3); }
  else { sfx.stinger(.5); fx.glitch(.3); }
} };
window.player = { get hp() { return P.hp; }, set hp(v) { P.hp = clamp(v, 0, 100); }, get fear() { return P.fear * 100; }, set fear(v) { P.fear = clamp(v / 100, 0, 1); } };
FL.fz = fzP.missions;

// E 상호작용: 클래스가 등록한 상호작용(id · promptText · onInteract)을 게임 상호작용 지점(kind 'fz')으로 만든다
function fzProp(data, f, x, z, y, extra = {}) {
  const p = { kind: 'fz', floor: f, x, z, y, label: data.promptText.replace(/^\[E\]\s*/, ''), fz: data, uid: 'fz:' + data.id, ...extra };
  world.props.push(p); return p;
}
const fzCtx = {
  notify: m => say(m, 4600),
  revealMonsterOnMap: s => { XT.revealT = s; XT.revealF = ghost.floor; if (!ghost.active) toast('CCTV', '네 화면 모두 텅 빈 복도뿐이다', 'info'); else if (ghost.floor !== P.floor) toast('CCTV — 그것의 위치', `${FLOOR_LABEL[ghost.floor]} 채널에서 움직임이 잡혔다 (${s}초)`, 'warn'); },
  triggerFinalGateOpen: () => fzGateOpen(),
  alertMonster: (pos, r) => fzLure(pos, r),
  alertMonsterFn: (pos, r) => fzLure(pos, r),
  giveKeyPiece: () => fzKeyPiece(),
  blockMonsterPathFn: on => passBlock(on),
};
function fzUse(p) {
  const ctx = { ...fzCtx, togglePlayerHide: p.hide ? () => enterLocker(p.hide) : null };
  p.fz.onInteract(ctx);
  fzAfter(p.fz.id); refreshHud(); save(true);
}
// 그것 유인: 소리 난 곳 층으로 올라오거나(옥상) 운동장으로 뛰쳐나온다(조회대 마이크)
function fzLure(pos, r) {
  const f = floors.findIndex(F => F && Math.abs(F.y0 - pos.y) < 1.5), G = ghost;
  if (f < 0) return; XT.revealT = 8; XT.revealF = f;
  if (!G.active || G.enraged) { if (!G.active) caption('소리가 텅 빈 복도에 울려 퍼졌다'); return; }
  const yard = f === 0 && pos.z > MAIN_ZS;
  if (G.floor !== f || yard) {
    G.floor = f; G.away = 0; G.visitT = 0; G.spawnGrace = 1.5; G.lose = 0;
    if (yard) { G.x = 0; G.z = MAIN_ZS + 1.4; G.outT = 28; at(0, 1.2, MAIN_ZS).doorBang(0, 1.2); caption('본관 현관문이 부서질 듯 열린다 — 그것이 밖으로 뛰쳐나왔다'); }
    else { const sz = floors[f].stairZone, s = sz ? sz.spawn : (floors[f].nodes[0] || { x: 0, z: -5.2 }); G.x = s.x; G.z = s.z; sfx.stairs(); caption(f === 3 ? '계단실 쪽에서 무언가 뛰어 올라온다' : '발소리가 이쪽으로 몰려온다'); }
  }
  G.state = 'search'; G.target = { x: pos.x, z: pos.z - (yard ? 2.5 : 0) }; G.path = []; G.replan = 0; G.wait = 0; G.hunt = null; G.lureT = 0; G.lockSearch = null;
}
// 열쇠 조각 +1: 아직 못 찾은 조각 하나를 대신한다 (어려운 것부터: 수영장 → 체육관 → 과학실 → 도서실 → 교무실). 기존 획득 처리(토스트 · 대사 · 저장)를 그대로 탄다
function fzKeyPiece() {
  const i = [4, 3, 2, 1, 0].find(k => !got[k]);
  if (i == null) { inv.battery += 2; newItems.add('battery'); toast('열쇠 조각은 이미 모두 모았다', '대신 쓸 만한 건전지 2개가 들어 있었다', 'info'); return; }
  const it = world.items.find(q => q.kind === 'key' && q.idx === i); if (!it) return;
  it.locked = false; setTarget({ type: 'item', it, label: '' }); interact();
  const dr = world.props.find(q => q.kind === 'drain'); if (i === 4 && dr) dr.done = true;
  setTimeout(() => toast('열쇠 조각 (' + P.keys + '/' + TOTAL + ')', `${KEY_WHERE[i]} 조각과 똑같이 생겼다 — 그곳은 더 뒤지지 않아도 된다`, 'opt'), 2600);
}
// 미션 A 마지막: 정문 전동 개폐기 — 열쇠 조각 다섯 개가 모이면(정문 열쇠를 만들지 않아도) 모터가 쇠사슬을 끊고 철문이 열린다 → 최종 추격
function fzGateOpen() {
  if (FL.gatePower || escaped) return;
  if (P.keys < TOTAL && !FL.gatekey) {
    sfx.gateClang(); shake = .4; fzLure(V3(0, 0, GATE_Z - 4), 40);
    setTimeout(() => say(`모터가 돌지만 정문 쇠사슬 자물쇠에 걸려 철문이 덜컹거리다 멈췄다 — 자물쇠를 풀 열쇠 조각이 더 필요하다 (${P.keys}/${TOTAL})`, 5200), 1400);
    return;
  }
  FL.gatePower = true; gateState = 'opening'; gate.blockRect.x1 = 1e9; gate.blockRect.x2 = 1e9 + 1; sfx.gateOpen(); shake = .5;
  setTimeout(() => { sfx.gateClang(); caption('쇠사슬이 모터 힘에 끊어져 나갔다 — 정문이 열린다'); }, 900);
  enrage(); refreshHud();
}

/* ── 7-1. 구역별 바닥 텍스처 (클래스 절차 텍스처: 운동장 마사토 · 옥상 우레탄 · 과학실 내산 타일 · 조리실 논슬립 타일) ── */
function fzFloor(parent, tex, x1, x2, z1, z2, y, rep, rough = .9) {
  const t = srgb(tex.clone()); t.repeat.set((x2 - x1) / rep, (z2 - z1) / rep);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), new THREE.MeshStandardMaterial({ map: t, roughness: rough }));
  m.rotation.x = -Math.PI / 2; m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); m.receiveShadow = true; m.userData.dynamic = true; parent.add(m); return m;
}
{
  const tx = fzP.textures;
  fzFloor(FLR(3), tx.rooftopUrethane, -36.3, 36.3, -9.9, MAIN_ZS, .014, 5, .95);
  fzFloor(FLR(1), tx.scienceLabTile, 28.15, 35.85, -9.45, -1.75, .014, 2.4, .55);
  fzFloor(FLR(7), tx.kitchenTile, -47.7, -30.3, 8.3, 12.45, .014, 2.6, .7);
  // 운동장: 트랙 안쪽 축구장(직선 22m + 양끝 반원) 모양으로 — 트랙 · 선 아래
  const CZ = 40, SX = 11, R0 = 9.56, sh = new THREE.Shape();
  sh.moveTo(-SX, -CZ - R0); sh.lineTo(SX, -CZ - R0); sh.absarc(SX, -CZ, R0, -Math.PI / 2, Math.PI / 2, false); sh.lineTo(-SX, -CZ + R0); sh.absarc(-SX, -CZ, R0, Math.PI / 2, Math.PI * 1.5, false);
  const g = new THREE.ShapeGeometry(sh, 32); g.rotateX(-Math.PI / 2);
  const turf = turfMaterial(), mat = turf.clone(); mat.map = turf.map.clone(); mat.map.repeat.set(1 / 2, 1 / 2); mat.normalMap = turf.normalMap.clone(); mat.normalMap.repeat.copy(mat.map.repeat); mat.polygonOffset=true;mat.polygonOffsetFactor=-.5;mat.polygonOffsetUnits=-.5;
  const m = new THREE.Mesh(g, mat); m.name = 'grass-football-field'; m.position.y = .009; m.receiveShadow = true; m.userData.dynamic = true; world.OUT.add(m);
}

/* 경비실: 제공 350×280cm 내부, 기존 감시·정문 미션 보존 */
{
  const g = adopt(fzP.buildGuardhouseProps(V3(GUARD_LAYOUT.cx, 0, GUARD_LAYOUT.cz)), world.OUT), [desk, mon, sw] = g.children;
  desk.visible = false; mon.visible = false;
  const cctvTex = srgb(mon.material.map); guardCctvData = IA(fzP, 'guard_cctv');
  pbox(.11, .17, .025, PM(0xc6c0b3, .7, .05), GUARD_LAYOUT.lightSwitch.x, GUARD_LAYOUT.lightSwitch.y, GUARD_LAYOUT.lightSwitch.z, g); pbox(.035, .065, .025, PM(0xeee9df, .5, 0), GUARD_LAYOUT.lightSwitch.x, GUARD_LAYOUT.lightSwitch.y, GUARD_LAYOUT.lightSwitch.z - .023, g);
  const scan = guardCctvData.onInteract; guardCctvData.onInteract = ctx => { if (FL.guardCctvOn ?? true) scan(ctx); openGuardCctv(); };
  sw.position.set(GUARD_LAYOUT.gateSwitch.x, GUARD_LAYOUT.gateSwitch.y, GUARD_LAYOUT.gateSwitch.z); sw.rotation.y = -Math.PI / 2;
  FZ.lamp = pmesh(new THREE.SphereGeometry(.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0x601008 }), GUARD_LAYOUT.gateSwitch.x - .06, 1.62, GUARD_LAYOUT.gateSwitch.z, g, { cast: false });
  fzProp(guardCctvData, 0, GUARD_LAYOUT.cctv.x, GUARD_LAYOUT.cctv.z, GUARD_LAYOUT.cctv.y);
  fzProp(IA(fzP, 'guard_gate_switch'), 0, GUARD_LAYOUT.gateSwitch.x - .35, GUARD_LAYOUT.gateSwitch.z, 1.35, { r: 1.5 });
  { const dup = world.props.findIndex(p => p.fz?.id === 'guard_cctv'), main = world.props.find(p => p.k === 'guardcctv'); if (dup >= 0 && main && Math.hypot(world.props[dup].x - main.x, world.props[dup].z - main.z) < .3) world.props.splice(dup, 1); }   // 같은 CCTV 가 두 번 등록돼 있었다 (하나만 고른다)
  guardControlProps = world.props.filter(p => p.k === 'guarddoor' || p.k === 'guardcctv' || p.k === 'guardlight' || p.fz?.id === 'guard_cctv');
  const feeds=collectCampusCctvFeeds(world.CCTV_CAMERAS);
  campusCctv=createCampusCctvLive({renderer,scene,feeds,floorRoots:floors.map(F=>({floor:F.f,interior:F.interior,shell:F.shell,windowFake:F.winFake})),
    getPowered:()=>FL.guardCctvOn??true,initialChannels:FL.guardCctvChannels||[],
    onChannelsChanged:ids=>{FL.guardCctvChannels=ids;save(true);},onPowerToggle:()=>toggleGuardCCTV(),onClose:closeGuardCctv,
    renderCapture:(cam,feed)=>{ if (state === 'playing') return; return withPerfCamera(cam,!feed.outdoor,()=>staticLOD.render(cam,performance.now(),qCur,()=>renderer.render(scene,cam))); },
    visibilityForFeed:feed=>{const old=ghost.group.visible;ghost.group.visible=ghost.active&&ghost.floor===feed.floor;return()=>{ghost.group.visible=old;};}
  });
  window.__campusCctv=campusCctv; if (world.guardAnnex) world.guardAnnex.screens.slice(0, 3).forEach((m, i) => { if (campusCctv.textures[i]) m.material = new THREE.MeshBasicMaterial({ map: campusCctv.textures[i], toneMapped: false }); });
  guardRoomController = installGuardRoom({ renderer, scene, camera, guardRoom: world.guardRoom, cctvTexture: cctvTex });
  syncGuardDevices(); guardRoomController.tick(1); window.__guardRoom = guardRoomController;
  guardRoomController.ready.then(async () => { campusCctv.setMonitors(guardRoomController.refs.screens || [guardRoomController.refs.screen].filter(Boolean)); guardRoomController.setLiveTextures(campusCctv.textures); setTimeout(() => textureBudget.prepare(scene), 500); syncGuardDevices(); if (guardRoomController.status === 'error') console.warn('[guardroom]', guardRoomController.error); });
}

/* ── 7-3. 운동장: 조회대 위 마이크 스탠드 · 앰프 · 나팔 스피커 / 모래밭 타임캡슐 (단상은 기존 조회대를 쓴다) ── */
{
  const g = adopt(fzP.buildSchoolYardProps(V3(-11, 0, 18.6)), world.OUT), [podium, mic, sand] = g.children;
  podium.visible = false;
  mic.position.set(-10.2, 1.1 + .625, 18.0);
  const blk = PM(0x1a1a1c, .4, .6);
  pmesh(new THREE.CylinderGeometry(.16, .18, .03, 16), blk, -10.2, 1.115, 18.0, g);
  pcyl(.012, .012, .36, blk, -10.2, 2.48, 17.88, g, { rx: -.6 }); pmesh(new THREE.CapsuleGeometry(.03, .09, 4, 10), PM(0x2a2a2c, .5, .4), -10.2, 2.6, 17.74, g, { rx: -1.0 });
  pbox(.55, .38, .32, PM(0x2c2a26, .7, .2), -12.7, 1.1 + .19, 18.9, g); pmesh(new THREE.PlaneGeometry(.4, .1), new THREE.MeshBasicMaterial({ map: makeSign('AMP 120W', '#151515', '#c8b070', 24) }), -12.7, 1.4, 19.065, g, { cast: false });
  pcyl(.035, .04, 2.4, PM(0x6a6e70, .5, .7), -13.7, 1.1 + 1.2, 17.4, g);
  [-1, 1].forEach(s => pmesh(new THREE.ConeGeometry(.22, .42, 14, 1, true), PM(0xb8b4a8, .6, .3, { side: THREE.DoubleSide }), -13.7 + s * .22, 3.35, 17.55, g, { rx: Math.PI / 2 + .25, rz: s * .5 }));
  sand.position.set(-21.6, .03, 59.3); sand.scale.set(.42, .45, .42); sand.material.color.setHex(0x9a8460);
  // 녹슨 모종삽 (모래에 꽂힘) — 파낸 뒤엔 구덩이 + 타임캡슐 통
  const trowel = pbox(.08, .2, .02, PM(0x6a4a30, .7, .5), -20.95, .12, 59.7, g, { rz: .3 });
  const hole = new THREE.Group(); g.add(hole); hole.visible = false;
  pmesh(new THREE.CircleGeometry(.55, 20), PM(0x2a2016, 1), -21.6, .075, 59.3, hole, { rx: -Math.PI / 2, cast: false });
  pmesh(new THREE.TorusGeometry(.62, .12, 6, 20), PM(0x8a7454, 1), -21.6, .06, 59.3, hole, { rx: Math.PI / 2 });
  const tin = pcyl(.13, .13, .38, PM(0x6a5034, .5, .7), -20.75, .16, 58.85, hole, { rz: Math.PI / 2, ry: .4 });
  pmesh(new THREE.PlaneGeometry(.28, .1), new THREE.MeshBasicMaterial({ map: makeSign('1998 졸업', '#c8b890', '#3a2a18', 26) }), -20.75, .3, 58.85, hole, { rx: -Math.PI / 2, rz: .4, cast: false });
  FZ.hole = hole; FZ.trowel = trowel;
  fzProp(IA(fzP, 'yard_mic'), 0, -10.2, 18.0, 2.2, { r: 1.6 });
  fzProp(IA(fzP, 'yard_sandpit_capsule'), 0, -21.6, 59.3, .4, { r: 1.7 });
}

/* ── 7-4. 과학실 (본관 2층): 실험대 위 시약 세트 · 시선을 돌리면 다가오는 인체 골격 모형 ── */
function skeletonModel(parent) {
  const bone = PM(0xd8d0bc, .55), dark = PM(0x2a2622, .6, .4);
  pmesh(new THREE.SphereGeometry(.105, 16, 12).scale(.85, 1.05, 1), bone, 0, 1.58, 0, parent);
  pmesh(new THREE.BoxGeometry(.12, .06, .1), bone, 0, 1.47, .03, parent);   // 턱
  [-1, 1].forEach(s => pmesh(new THREE.SphereGeometry(.022, 8, 6), new THREE.MeshBasicMaterial({ color: 0x050505 }), s * .035, 1.6, .085, parent, { cast: false }));   // 눈구멍
  for (let k = 0; k < 14; k++) pcyl(.022, .022, .035, bone, 0, .98 + k * .034, -.03, parent, { seg: 8 });   // 척추
  for (let k = 0; k < 6; k++) pmesh(new THREE.TorusGeometry(.12 - k * .006, .009, 4, 18, Math.PI * 1.6).scale(1, 1, .75), bone, 0, 1.33 - k * .055, -.01, parent, { rx: Math.PI / 2, rz: -Math.PI * .3 });   // 갈비뼈
  pmesh(new THREE.TorusGeometry(.1, .03, 6, 14).scale(1.3, 1, .7), bone, 0, .95, 0, parent, { rx: Math.PI / 2 });   // 골반
  [-1, 1].forEach(s => {
    pcyl(.016, .016, .36, bone, s * .15, 1.18, 0, parent, { rz: s * .12, seg: 8 }); pcyl(.013, .013, .32, bone, s * .19, .84, .02, parent, { rz: s * .06, seg: 8 });   // 팔
    pcyl(.022, .018, .44, bone, s * .08, .66, 0, parent, { seg: 8 }); pcyl(.017, .015, .42, bone, s * .085, .24, 0, parent, { seg: 8 });   // 다리
    pmesh(new THREE.BoxGeometry(.06, .025, .14), bone, s * .085, .02, .04, parent);
  });
  pcyl(.012, .012, 1.0, dark, 0, .5, -.12, parent, { seg: 6 }); pcyl(.2, .22, .03, dark, 0, .015, -.05, parent, { seg: 18 });   // 받침대(바퀴 달린 거치대)
}
{
  const g = adopt(fzP.buildScienceLabProps(V3(16, floors[9].y0, -5)), FLR(9)), [table, flask, skel] = g.children;
  table.visible = false;
  flask.position.set(18.0, .92 + .16, -4.25);
  const glass = PM(0xd8e8e8, .08, 0, { transparent: true, opacity: .35, depthWrite: false });
  pbox(.36, .12, .12, PM(0x6a4a30, .7), 18.45, .98, -4.2, g);
  [[18.33, 0xd8c040], [18.45, 0x9a2a20], [18.57, 0xe8e8d0]].forEach(([x, c]) => { pcyl(.016, .016, .2, glass, x, 1.06, -4.2, g, { seg: 8 }); pcyl(.014, .014, .1, PM(c, .2, 0, { transparent: true, opacity: .8 }), x, 1.0, -4.2, g, { seg: 8 }); });
  [['H₂SO₄', 17.7, -4.55], ['HNO₃', 17.86, -4.62]].forEach(([n, x, z]) => { pcyl(.045, .05, .18, PM(0x4a2a14, .25, 0, { transparent: true, opacity: .85 }), x, 1.01, z, g); pmesh(new THREE.PlaneGeometry(.07, .05), new THREE.MeshBasicMaterial({ map: makeSign(n, '#e8e4d0', '#2a1a10', 34) }), x, 1.02, z + .05, g, { cast: false }); });
  pmesh(new THREE.PlaneGeometry(.3, .2), new THREE.MeshBasicMaterial({ map: makeSign('☠ 강산 취급 주의', '#e8c020', '#1a1a1a', 22) }), 18.0, .925, -3.98, g, { rx: -Math.PI / 2, cast: false });
  skel.children.forEach(c => { c.visible = false; }); skeletonModel(skel);
  FLR(9).add(skel); skel.position.set(12.75, 0, -8.85); skel.rotation.y = .6;
  FZ.skel = skel; FZ.skelHome = skel.position.clone();
  fzProp(IA(fzP, 'science_acid_craft'), 9, 18.0, -4.25, 1.1, { r: 1.7 });
}

/* ── 7-5. 급식실: 조리실 안쪽 워크인 냉동창고(새로 지음) · 대형 국솥(숨기) · 가스 화구 ── */
{
  const y0 = floors[7].y0, F7 = floors[7];
  const g = adopt(fzP.buildCafeteriaProps(V3(-37.5, y0, 10)), FLR(7)), [vat, stove, ice, lever] = g.children;
  // 냉동창고: x -38.8 ~ -36.0, z 8.3 ~ 10.6 · 남쪽 문 (x -37.75 ~ -36.95)
  const steel = PM(0xb8bec4, .35, .65), steelD = PM(0x7a8086, .4, .6), H = 2.5;
  const fw = (x1, x2, z1, z2, h1 = 0, h2 = H) => { pbox(x2 - x1, h2 - h1, z2 - z1, steel, (x1 + x2) / 2, (h1 + h2) / 2, (z1 + z2) / 2, g); if (h1 < .5) { const r = { x1, x2, z1, z2 }; F7.col.push(r); F7.walls.push(r); } };
  fw(-38.8, -38.65, 8.3, 10.6); fw(-36.15, -36.0, 8.3, 10.6); fw(-38.8, -37.75, 10.45, 10.6); fw(-36.95, -36.0, 10.45, 10.6); fw(-37.75, -36.95, 10.45, 10.6, 2.1, H);
  pbox(2.8, .1, 2.3, steel, -37.4, H + .05, 9.45, g);
  pmesh(new THREE.PlaneGeometry(2.5, 2.0), PM(0x9ab8c8, .3, .2, { emissive: 0x0a1820 }), -37.4, .02, 9.45, g, { rx: -Math.PI / 2, cast: false });   // 서리 낀 바닥
  pbox(.06, .03, 1.2, new THREE.MeshStandardMaterial({ color: 0xc8e8ff, emissive: 0x8ac8ff, emissiveIntensity: 1.4 }), -37.4, H - .05, 9.45, g, { cast: false });
  pmesh(new THREE.PlaneGeometry(.5, .16), new THREE.MeshBasicMaterial({ map: makeSign('냉동실 −18℃', '#1a3a5a', '#e0f0ff', 26) }), -37.35, 2.28, 10.61, g, { cast: false });
  [.45, .95, 1.45].forEach(y => { pbox(.42, .03, 1.9, steelD, -38.42, y, 9.4, g); [8.6, 9.5, 10.1].forEach((z, k) => { if ((y * 7 + k) % 3 > .6) pbox(.3, .18 + (k % 2) * .08, .26, PM(k % 2 ? 0x8a3a30 : 0xd8d4c8, .8), -38.42, y + .1 + (k % 2) * .04, z, g); }); });
  F7.col.push({ x1: -38.65, x2: -38.2, z1: 8.3, z2: 10.4 });
  ice.position.set(-38.4, 1.08, 9.05);
  pbox(.07, .02, .2, PM(0x8a7030, .3, .9), -38.4, 1.08, 9.05, g);   // 얼음 속 열쇠
  lever.position.set(-36.12, 1.35, 9.3); lever.rotation.y = Math.PI / 2;
  pcyl(.02, .02, .3, PM(0x1a1a1a, .4, .6), -36.2, 1.48, 9.3, g, { rx: -.5 });
  pmesh(new THREE.PlaneGeometry(.34, .14), new THREE.MeshBasicMaterial({ map: makeSign('비상 개방', '#e8c020', '#1a1a1a', 30) }), -36.14, 1.65, 9.3, g, { ry: -Math.PI / 2, cast: false });
  // 문짝: 경첩 x -36.95 · 평소 바깥(+z)으로 열려 있다
  const dp = new THREE.Group(); dp.position.set(-36.95, 0, 10.52); dp.rotation.y = Math.PI / 2; dp.userData.dynamic = true; g.add(dp);
  pbox(.8, 2.05, .1, steel, -.4, 1.025, 0, dp); pbox(.06, .5, .08, PM(0x30343a, .3, .8), -.7, 1.1, .08, dp); pmesh(new THREE.PlaneGeometry(.22, .3), PM(0x9ab4c4, .1, .2, { transparent: true, opacity: .5 }), -.4, 1.6, .055, dp, { cast: false });
  FZ.freezerDoor = { piv: dp, t: Math.PI / 2, target: Math.PI / 2 }; FZ.freezerCol = { x1: -37.75, x2: -36.95, z1: 10.42, z2: 10.62 };
  // 국솥: 스테인리스 원통 + 테두리 + 손잡이 + 기울여 둔 뚜껑
  vat.position.set(-45.35, .45, 11.6); vat.scale.setScalar(.85);
  pmesh(new THREE.TorusGeometry(.575, .035, 8, 28), steel, -45.35, .9, 11.6, g, { rx: Math.PI / 2 });
  [-1, 1].forEach(s => pmesh(new THREE.TorusGeometry(.09, .018, 6, 12, Math.PI), steelD, -45.35 + s * .6, .8, 11.6, g, { ry: Math.PI / 2, rz: s * Math.PI / 2 }));
  pcyl(.6, .6, .04, steelD, -44.7, .6, 12.15, g, { rx: 1.2, rz: .3 });
  F7.col.push({ x1: -45.95, x2: -44.75, z1: 11.0, z2: 12.2, h: .9 });
  const vatHide = { floor: 7, x: -45.35, z: 11.6, y: y0, dir: { x: 1, z: 0 }, noPick: true, label: '국솥 안에 숨기' }; world.lockers.push(vatHide);
  // 가스 화구: 기존 조리대(-41, 10) 위에 버너 받침 · 밸브 손잡이
  stove.visible = false;
  [[-40.55, 9.8], [-40.55, 10.25]].forEach(([x, z]) => { pmesh(new THREE.TorusGeometry(.13, .012, 6, 18), PM(0x1a1a1a, .5, .6), x, .915, z, g, { rx: Math.PI / 2 }); pcyl(.05, .06, .03, PM(0x3a3a3a, .5, .7), x, .91, z, g); });
  [-40.3, -40.0].forEach(x => pcyl(.025, .025, .04, PM(0xc81a10, .5), x, .75, 10.52, g, { rx: Math.PI / 2 }));
  FZ.stoveAt = { x: -40.55, y: y0 + .95, z: 10.0 };
  fzProp(IA(fzP, 'cafeteria_vat'), 7, -45.35, 11.6, .9, { r: 1.5, hide: vatHide });
  fzProp(IA(fzP, 'cafeteria_gas_stove'), 7, -40.6, 10.6, .95, { r: 1.4 });
  fzProp(IA(fzP, 'cafeteria_frozen_key'), 7, -38.3, 9.1, 1.1, { r: 1.25 });
  fzProp(IA(fzP, 'cafeteria_freezer_lever'), 7, -36.3, 9.3, 1.35, { r: 1.2 });
}

/* ── 7-6. 옥상: 철망 울타리로 둘러싼 비상발전기 구역(녹슨 철문) · 통신 안테나 단자함 ── */
{
  const R = floors[3], g = adopt(fzP.buildRooftopProps(V3(19, ROOF_Y, 5.2)), FLR(3)), [door, gen, ant] = g.children;
  const X1 = 16.5, X2 = 21.5, Z1 = 3.0, Z2 = 7.4, D1 = 4.65, D2 = 5.75, rust = PM(0x5a3a28, .8, .5), pole = PM(0x6a6e70, .55, .6);
  const net = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.strokeStyle = '#a8aca8'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(0, 32); x.lineTo(32, 0); x.lineTo(64, 32); x.lineTo(32, 64); x.closePath(); x.stroke(); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const fence = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), t = net.clone(); t.repeat.set(L / .12, 2.1 / .12); t.needsUpdate = true;
    pmesh(new THREE.PlaneGeometry(L, 2.1), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: .3, side: THREE.DoubleSide, roughness: .6, metalness: .5, color: 0xb0b4b0 }), (ax + bx) / 2, 1.05, (az + bz) / 2, g, { ry: Math.atan2(-(bz - az), bx - ax), cast: false });
    pcyl(.025, .025, L, pole, (ax + bx) / 2, 2.12, (az + bz) / 2, g, { rz: Math.PI / 2, ry: Math.atan2(-(bz - az), bx - ax), seg: 6 }); };
  fence(X1, Z1, X2, Z1); fence(X1, Z2, X2, Z2); fence(X2, Z1, X2, Z2); fence(X1, Z1, X1, D1); fence(X1, D2, X1, Z2);
  [[X1, Z1], [X2, Z1], [X1, Z2], [X2, Z2], [X1, D1], [X1, D2], [X2, 5.2], [19, Z1], [19, Z2]].forEach(([x, z]) => pcyl(.04, .04, 2.2, pole, x, 1.1, z, g, { seg: 8 }));
  [{ x1: X1 - .05, x2: X2 + .05, z1: Z1 - .05, z2: Z1 + .05 }, { x1: X1 - .05, x2: X2 + .05, z1: Z2 - .05, z2: Z2 + .05 }, { x1: X2 - .05, x2: X2 + .05, z1: Z1, z2: Z2 }, { x1: X1 - .05, x2: X1 + .05, z1: Z1, z2: D1 }, { x1: X1 - .05, x2: X1 + .05, z1: D2, z2: Z2 }].forEach(r => { R.col.push(r); R.walls.push(r); });
  // 녹슨 철문: 경첩(x 16.5, z 4.65)을 축으로 — 부식액으로 녹이면 클래스가 회전시킨다
  door.geometry.translate(.55, 0, 0); door.position.set(X1, 1.05, D1); door.rotation.y = -Math.PI / 2; door.material.color.setHex(0x3a2216); door.material.roughness = .9; door.material.metalness = .35;
  const lock = new THREE.Group(); door.add(lock);
  pmesh(new THREE.TorusGeometry(.06, .012, 6, 12), PM(0x6a4a30, .7, .6), .98, .05, .07, lock); pbox(.07, .08, .03, PM(0x4a3a2a, .6, .7), .98, -.02, .08, lock);
  pmesh(new THREE.PlaneGeometry(.5, .3), new THREE.MeshBasicMaterial({ map: makeSign('관계자 외 출입금지 · 비상발전기', '#c8a020', '#1a1a1a', 20) }), .55, .45, .055, door, { cast: false });
  FZ.doorLock = lock; FZ.doorCol = { x1: X1 - .06, x2: X1 + .06, z1: D1, z2: D2, gate: true }; R.col.push(FZ.doorCol); R.walls.push(FZ.doorCol);
  // 발전기: 받침 · 라디에이터 · 배기관 · 연료통 · 조작반 + 경광등
  gen.position.set(19.6, .62, 4.4); gen.material.color.setHex(0x3a4a34);
  pbox(1.6, .12, 1.0, PM(0x2a2a2a, .7, .5), 19.6, .06, 4.4, g);
  pmesh(new THREE.PlaneGeometry(.8, .7), PM(0x1a1a1a, .8, .5), 18.88, .66, 4.4, g, { ry: -Math.PI / 2, cast: false });
  pcyl(.05, .05, 1.1, PM(0x3a3a38, .6, .7), 20.15, 1.55, 4.1, g); pcyl(.07, .05, .12, PM(0x2a2a28, .6, .7), 20.15, 2.1, 4.1, g);
  pmesh(new THREE.CylinderGeometry(.28, .28, .9, 16), PM(0x8a2a20, .5, .5), 19.6, .4, 5.55, g, { rz: Math.PI / 2 });
  pbox(.36, .3, .06, PM(0x1e1e20, .4, .5), 19.6, .95, 4.88, g);
  pcyl(.012, .012, .2, PM(0xc81a10, .4, .3), 19.5, .95, 4.95, g, { rx: Math.PI / 2 });
  R.col.push({ x1: 18.85, x2: 20.35, z1: 3.9, z2: 4.9 }, { x1: 19.1, x2: 20.1, z1: 5.25, z2: 5.85, h: .7 });
  FZ.beacon = pmesh(new THREE.SphereGeometry(.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3a0804 }), X2, 2.22, Z1, g, { cast: false });
  FZ.beaconGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('255,60,30'), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })); FZ.beaconGlow.scale.setScalar(1.6); FZ.beaconGlow.position.set(X2, 2.3, Z1); g.add(FZ.beaconGlow);
  // 안테나: 기존 철탑(22, -6) 아래 단자함 + 짧은 안테나
  ant.position.set(21.1, 1.6, -5.25); ant.scale.set(.6, .6, .6);
  pbox(.42, .55, .22, PM(0x8a8e88, .5, .5), 21.1, 1.0, -5.0, g); pcyl(.03, .03, 1.0, pole, 21.1, .4, -5.0, g, { seg: 6 });
  FZ.led = pmesh(new THREE.SphereGeometry(.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0x300404 }), 21.1, 1.2, -4.885, g, { cast: false });
  pmesh(new THREE.PlaneGeometry(.34, .1), new THREE.MeshBasicMaterial({ map: makeSign('통신 단자함', '#d8d4c4', '#1a1a1a', 28) }), 21.1, .86, -4.885, g, { cast: false });
  R.col.push({ x1: 20.85, x2: 21.35, z1: -5.15, z2: -4.85 });
  fzProp(IA(fzP, 'rooftop_rusted_door'), 3, 16.05, 5.2, 1.2, { r: 1.4 });
  fzProp(IA(fzP, 'rooftop_generator'), 3, 19.6, 5.15, .9, { r: 1.3 });
  fzProp(IA(fzP, 'rooftop_antenna_signal'), 3, 21.1, -4.5, 1.2, { r: 1.5 });
}
// 상호작용 직후: 클래스가 바꾼 미션 상태를 맵 · 소지품 · 진행 기록에 반영
function fzAfter(id) {
  const M = fzP.missions;
  if (id === 'yard_sandpit_capsule' && M.yardCapsuleDug) { sfx.crumble ? sfx.crumble() : sfx.thump(); fx.dust(-21.6, .2, 59.3, 30); }
  if (id === 'science_acid_craft' && M.scienceAcidCrafted) { newItems.add('acid'); sfx.drip(); }
  if (id === 'rooftop_rusted_door' && M.rooftopDoorMelted) { sfx.spark(); for (let k = 0; k < 24; k++) fx.emit(16.5, ROOF_Y + 1.0, 4.7, (Math.random() - .5) * .4, Math.random() * .8, (Math.random() - .5) * .4, 1.6, [.5, .9, .4], .45, .35, -.2, .6, 1.2); }
  if (id === 'rooftop_generator' && M.rooftopGeneratorOn) { sfx.genChug(1.2); shake = .3; }
  if (id === 'rooftop_antenna_signal' && M.rooftopSignalSent) { FL.sos = true; sfx.phone(); setTimeout(() => toast('📱 문자 전송됨 — 119', '“서문고 본관 옥상. 갇혀 있음. 살려 주세요.” · 진 엔딩 조건', 'opt'), 1600); }
  if (id === 'cafeteria_frozen_key' && M.frozenKeyObtained) newItems.add('frozenkey');
  if (id === 'cafeteria_gas_stove' && M.frozenKeyMelted) FZ.flameT = 3.5;
  if (id === 'cafeteria_gas_stove' && !M.frozenKeyObtained) FZ.flameT = 1.5;
  fzApply();
}
// 미션 상태 → 장면 (불러오기 · 상호작용 후)
function fzApply() {
  const M = fzP.missions, R = floors[3];
  const dr = IA(fzP, 'rooftop_rusted_door').mesh;
  if (M.rooftopDoorMelted) { dr.rotation.y = Math.PI * .55; FZ.doorLock.visible = false; R.col = R.col.filter(r => r !== FZ.doorCol); R.walls = R.walls.filter(r => r !== FZ.doorCol); }
  IA(fzP, 'cafeteria_frozen_key').mesh.visible = !M.frozenKeyObtained;
  FZ.hole.visible = M.yardCapsuleDug; FZ.trowel.visible = !M.yardCapsuleDug;
  IA(fzP, 'yard_sandpit_capsule').mesh.visible = !M.yardCapsuleDug;
  if (M.rooftopSignalSent) { FL.sos = true; const b = document.querySelector('.pStatus b'); if (b) b.textContent = '📶 미약한 신호 연결됨'; }
  world.props.forEach(p => { if (p.kind !== 'fz') return; const id = p.fz.id;
    if (id === 'yard_sandpit_capsule' && M.yardCapsuleDug) p.label = '파헤쳐진 구덩이';
    if (id === 'cafeteria_frozen_key') p.done = M.frozenKeyObtained;
    if (id === 'science_acid_craft' && M.scienceAcidCrafted) p.label = '실험대 — 부식액은 이미 만들었다';
    if (id === 'rooftop_rusted_door' && M.rooftopDoorMelted) p.done = true;
    if (id === 'rooftop_antenna_signal' && M.rooftopSignalSent) p.label = '안테나 — 구조 문자를 이미 보냈다'; });
}
// 구역 미션 HUD (메인 목표 아래 '구역 미션' 상자)
function zoneMissions() {
  const M = fzP.missions;
  return [
    ['A · 정문 전력 복구', [['과학실 실험대에서 강산성 부식액 조합', M.scienceAcidCrafted], ['옥상 발전기 구역 녹슨 철문 녹이기', M.rooftopDoorMelted], ['옥상 비상발전기 가동', M.rooftopGeneratorOn], [`경비실 정문 개폐기 작동${P.keys < TOTAL && !FL.gatekey ? ` (비밀 증거 ${P.keys}/${TOTAL} 필요)` : ''}`, !!FL.gatePower]]],
    ['B · 냉동창고의 비밀 증거', [['급식실 냉동창고 — 얼어붙은 기밀 캡슐 꺼내기', M.frozenKeyObtained], ['비상 레버로 냉동창고 탈출', M.frozenKeyObtained && !fzP.events.freezerLocked], ['조리실 가스 화구로 얼음 녹이기 (학교 비밀 증거 조각)', M.frozenKeyMelted]]],
    ['C · 1998 타임캡슐', [['운동장 모래밭 파헤치기 (학교 비밀 증거 조각)', M.yardCapsuleDug]]],
    ['D · 구조 신호', [['옥상 안테나에서 휴대폰 전파 잡기 (진 엔딩)', M.rooftopSignalSent]]],
  ];
}
function zoneHud() {
  const box = $('zoneBox'); if (!box) return;
  box.style.display = FL.fzSeen || Object.values(fzP.missions).some(Boolean) ? 'block' : 'none';
  const L = zoneMissions(), done = L.filter(([, s]) => s.every(([, d]) => d)).length;
  $('zoneTitle').textContent = `서브 미션 · 구역 조사 (${done}/${L.length})`;
  $('zoneSubs').innerHTML = L.map(([t, s]) => { const n = s.filter(([, d]) => d).length, nx = s.find(([, d]) => !d);
    return `<div class="chk${nx ? '' : ' done'}">${t} (${n}/${s.length})${nx ? ` — ${nx[0]}` : ''}</div>`; }).join('');
}
// 우측 상단 구역 표시 · 지도 표시
function zoneLabel() {
  const f = P.floor, x = P.x, z = P.z;
  if (f === 1 && inPassage()) return '2층 연결 구름다리';
  if (f === 0 && x > GUARD_LAYOUT.originX - .9 && x < GUARD_LAYOUT.originX + GUARD_LAYOUT.width + .9 && z > GUARD_LAYOUT.originZ - GUARD_LAYOUT.depth - .8 && z < GUARD_LAYOUT.originZ + .8) return '경비실';
  if (f === 0 && z > MAIN_ZS + 1 && z < 62 && Math.abs(x) < 30 && !(RBG ? RBG.inBuilding(x, z) : inBldg(x, z))) return '운동장';
  if (f === 1 && x > 28.1 && x < 35.9 && z < -1.75) return '과학실';
  if (f === 10) { const r = roomAt(f, x, z); if (r && r.type === 'lab') return '과학실'; }
  if (f === 7) return z < 12.5 ? '급식실 · 조리실' : '급식실';
  if (f === 3) return '옥상';
  if (f === 0) {
    for (const zc of MEGA_CAMPUS_ZONES) {
      if (Math.abs(x - zc.x) <= zc.w / 2 + 2.5 && Math.abs(z - zc.z) <= zc.d / 2 + 2.5) return zc.name;
    }
    if (x > 53 && x < 67 && z > -54 && z < -46) return '생물부 생태온실 · 기상관측소';
    if (x > 58 && x < 69 && z > 14 && z < 26) return '서문 학교 매점';
    if (x > 29 && x < 41 && z > -54 && z < -39) return '해교 야외 음악당';
    if (Math.abs(x - FAC_ZONES.aud.cx) < 10 && Math.abs(z - FAC_ZONES.aud.cz) < 14) return '대강당';
    if (Math.abs(x - MEGA.court.x) < 9 && Math.abs(z - MEGA.court.z) < 9) return '중앙 중정';
    if (Math.abs(x) < 6 && z > WALKWAY.z1 && z < WALKWAY.z2) return '필로티 중앙광장';
  }
  return null;
}
const ZONE_MAP = { 0: [[GUARD_LAYOUT.cx, GUARD_LAYOUT.cz, '경비실 · 정문 개폐기'], [-11, 15.6, '조회대 마이크'], [-21.6, 61.4, '모래밭 · 타임캡슐'], [.8, (WALKWAY.z1 + WALKWAY.z2) / 2, '실내 연결복도']],
  1: [[32, -6.2, '과학실 · 시약'], [28.8, -8.6, '골격 모형']], 3: [[19, 2.3, '비상발전기'], [21.1, -4.2, '안테나']], 7: [[-37.4, 9.4, '냉동창고'], [-45.4, 11.6, '국솥'], [-40.6, 10.2, '가스 화구']] };

/* ── 8. 실내 연결복도: 유리 통로(x -1.6 ~ 3.6) 안쪽에 막힌 실내 복도(폭 3.4m · 천장 2.9m)를 짓는다 ──
   본관 계단실 북문(x 1.25) · 별관 현관(x 0)이 모두 안에 들어오게 가운데 x 0.8. 방화문은 별관 현관 바로 앞(z −12.95) — 닫으면 별관 출입이 막힌다 */
// 사물함 수색 지점 앞에 가구가 붙어 설 자리가 없으면(예전엔 벽 너머에서만 고를 수 있었다) 옆으로 설 자리가 있는 곳까지 지점을 민다
world.props.filter(q => q.kind === 'search').forEach(q => {
  const F = floors[q.floor]; if (!F || Math.abs(q.z) < 1.8) return; const into = q.z < 0 ? -1 : 1, R = .32;   // 교실 사물함만 (복도 사물함은 복도 쪽을 본다)
  const free = (x, z) => !F.col.some(c => !(c.h != null && c.h <= .225) && x > c.x1 - R && x < c.x2 + R && z > c.z1 - R && z < c.z2 + R);
  const ok = x => free(x, q.z + into * .6) || free(x, q.z + into * .8);
  if (ok(q.x)) return;
  for (let d = .15; d <= 1.35; d += .15) for (const s of [1, -1]) { const x = q.x + s * d; if (ok(x)) { q.x = x; return; } }
});
// 수영장 출입문 자리 동쪽 벽 틈(z 37 ~ 39): 걸어서 건물 밖 빈 공간으로 빠져나가던 문제 — 문은 E 로만 (순간이동 문)
floors[6].col.push({ x1: -34.65, x2: -34.05, z1: 36.9, z2: 39.15 }); floors[6].walls.push(floors[6].col[floors[6].col.length - 1]);
// 옥상 문 지점 · 3층 계단 꼭대기 철문
{ const c = floors[2].stairCx; if (c != null) world.props.push({ kind: 'roofDoor', floor: 2, x: c - 1.85, z: SZB - .2, y: FH + 1.2, r: 1.3, minSh: FH - .7, label: '옥상 문 열기' });
  // 옥상 계단탑: 문만 서 있고 계단 구멍이 그대로 보이던 것 → 사방 벽 · 지붕 슬래브 (남쪽 벽 가운데 문) · 충돌
  // 옥상 계단탑: 충돌 상자(x −5 ~ 5, z −4.5 ~ 1.9)만 있고 벽이 없어 문만 서 있고 안의 계단 구멍이 보였다 → 그 자리에 벽 · 지붕 (문은 북쪽 면 가운데)
  { const R = FLR(3), cm = PM(0x8a8780, .9), X1 = -5, X2 = 5, Z1 = -4.5, Z2 = 1.9, H = 3.0, T = .2, g = new THREE.Group(); R.add(g); g.userData.dynamic = true;
    pbox(X2 - X1, H, T, cm, 0, H / 2, Z2, g); pbox(T, H, Z2 - Z1, cm, X1, H / 2, (Z1 + Z2) / 2, g); pbox(T, H, Z2 - Z1, cm, X2, H / 2, (Z1 + Z2) / 2, g);
    pbox(-.6 - X1, H, T, cm, (X1 - .6) / 2, H / 2, Z1, g); pbox(X2 - .6, H, T, cm, (X2 + .6) / 2, H / 2, Z1, g); pbox(1.2, H - 2.3, T, cm, 0, 2.3 + (H - 2.3) / 2, Z1, g);
    pbox(X2 - X1 + .4, .25, Z2 - Z1 + .4, PM(0x5a5852, .9), 0, H + .12, (Z1 + Z2) / 2, g); }
  world.props.push({ kind: 'roofDoor', floor: 3, x: 0, z: -5.2, y: 1.2, r: 1.6, roof: true, label: '옥상 문 열고 계단으로 내려가기' });
  // 3층 계단 꼭대기 철문 (보이는 문)
  if (c != null) { const g = new THREE.Group(); g.position.set(c - 1.85, FH, SZB + .05); FLR(2).add(g); g.userData.dynamic = true;
    pbox(1.3, 2.2, .06, PM(0x4a4e50, .55, .6), 0, 1.1, 0, g); pbox(1.5, .12, .14, PM(0x2a2c2e, .6), 0, 2.26, 0, g);
    pmesh(new THREE.PlaneGeometry(.7, .16), new THREE.MeshBasicMaterial({ map: makeSign('옥상 출입문', '#3a1a10', '#e8d0b0', 24) }), 0, 1.75, -.04, g, { ry: Math.PI, cast: false }); } }
const PASS_DOOR = WALKWAY.z1 + .55, PASS_MID = (WALKWAY.z1 + WALKWAY.z2) / 2;   // 통로 10.6m: 방화문은 별관 끝 · 밸브는 가운데 · 청소도구함은 본관 끝
const PASS = { x1: -.9, x2: 2.5, z1: WALKWAY.z1, z2: WALKWAY.z2, doorZ: PASS_DOOR, valveZ: PASS_MID, frameZ: PASS_MID + 2.4, pileZ: PASS_MID + 1.2, col: { x1: -.9, x2: 2.5, z1: PASS_DOOR - .07, z2: PASS_DOOR + .07 }, bangT: 0, warned: false, frame: null, frameFell: false, prevBlack: false, tubes: [] };
function inPassage() { if (RBG) return RBG.inWalkway(P); return (P.floor === 1 || P.floor === 2) && P.x > PASS.x1 && P.x < PASS.x2 && P.z > PASS.z1 && P.z < PASS.z2; }
{
  const O = new THREE.Group(); O.name = 'skybridge2F'; O.position.y = FH; O.userData.dynamic = true; world.OUT.add(O);
  const F0 = floors[1], cz = (WALKWAY.z1 + WALKWAY.z2) / 2;
  ipP.buildIndoorPassage(V3(.8, 0, cz), { length: WALKWAY.z2 - WALKWAY.z1, width: 3.4, height: 2.9, rotationY: Math.PI });
  const pg = ipP.passageGroup; O.add(pg); pg.traverse(o => { o.userData.dynamic = true; if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  { const wp = new THREE.Vector3(); pg.updateMatrixWorld(true); pg.traverse(o => { if (o.isMesh && o.getWorldPosition(wp).y > 2.3) o.castShadow = false; }); }   // 천장 등기구 · 배관이 손전등 그림자를 천장에 크게 드리워 천장이 뚫린 것처럼 보였다
  const [floor, , eWall, wWall, , , valve, steam, lPiv, rPiv, mop] = pg.children;
  ['indoorWall', 'indoorFloor', 'fireDoorTex'].forEach(k => srgb(ipP.textures[k]));
  floor.position.y = -.07;   // 기존 통로 바닥(0.015) 위로
  const L2 = z => cz - z;    // 월드 z → 그룹 z (그룹이 180° 돌아 있다)
  lPiv.position.z = rPiv.position.z = L2(PASS.doorZ);
  valve.position.z = L2(PASS.valveZ); steam.position.set(0, 1.5, L2(PASS.valveZ + .1));
  // 증기: 구 하나 대신 둥근 그라데이션 판 3장을 엇갈려 — 가장자리가 부드럽다 (클래스는 material.opacity 만 바꾼다)
  { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.5, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    const gs = [0, 1, 2].map(k => new THREE.PlaneGeometry(2.8, 2.4).rotateY(k * Math.PI / 3)); steam.geometry = mergeGeometries(gs); steam.material.alphaMap = new THREE.CanvasTexture(c); steam.material.side = THREE.DoubleSide; steam.material.needsUpdate = true; steam.material.visible = false; }   // 판 대신 입자 증기 (steamTick)
  mop.position.set(.8 + .42, .925, L2(-11.95));   // 본관 문(x 0.8)이 통로 가운데로 옮겨져 문 앞 E 가 도구함 숨기와 겹치지 않게 1.5m 안쪽으로
  // 청소도구함 정면(복도 쪽 +x) 디테일: 루버 · 손잡이 · 명판
  const grn = PM(0x2c3d33, .55, .5);
  for (let k = 0; k < 5; k++) pbox(.01, .025, .42, grn, -.38, .55 - k * .06, 0, mop);
  pbox(.03, .14, .03, PM(0xb8c0c0, .25, .9), -.39, 0, -.22, mop);
  pmesh(new THREE.PlaneGeometry(.3, .1), new THREE.MeshBasicMaterial({ map: makeSign('청소도구함', '#d8d4c4', '#1a2a1a', 28) }), -.38, .7, 0, mop, { ry: -Math.PI / 2, cast: false });
  // 방화문 틀 · 문 위 벽 · 투톤 경계(별관 쪽 벽은 다른 색) · 시멘트 보수 자국
  const wallMat = eWall.material, tw = srgb(ipP.textures.indoorWall.clone()); tw.repeat.set(1, 1);
  pbox(3.4, .6, .22, wallMat, .8, 2.6, PASS.doorZ, O);
  [-.85, 2.45].forEach(x => pbox(.12, 2.32, .26, PM(0x3a3e40, .45, .6), x, 1.16, PASS.doorZ, O));
  const annexTone = new THREE.MeshStandardMaterial({ map: tw, color: 0xa8c0b8, roughness: .8 });
  [[-.79, Math.PI / 2], [2.39, -Math.PI / 2]].forEach(([x, ry]) => { pmesh(new THREE.PlaneGeometry(PASS.doorZ - WALKWAY.z1 - .02, 2.9), annexTone, x, 1.45, (WALKWAY.z1 + PASS.doorZ) / 2, O, { ry, cast: false });
    pmesh(new THREE.PlaneGeometry(.32, 2.6), PM(0x8a8a84, .95), x + (x < 0 ? .002 : -.002), 1.35, PASS.doorZ + .3, O, { ry, cast: false }); });
  pmesh(new THREE.PlaneGeometry(1.2, .32), new THREE.MeshBasicMaterial({ map: makeSign('별관 (증축 1998)', '#1e2a2e', '#d9e4d0', 24), color: 0x9aa59a }), .8, 2.62, PASS.doorZ + .115, O, { cast: false });
  // 천장 형광등 3개 (점광원 대신 발광 메시) — 별관 쪽부터 순서대로 꺼지게 배열 순서를 맞춘다
  ipP.ceilingLights.forEach(l => pg.remove(l));
  ipP.ceilingLights = [0, 1, 2, 3, 4].map(k => WALKWAY.z1 + .65 + k * (WALKWAY.z2 - WALKWAY.z1 - 1.3) / 4).map(z => {   // 별관 끝부터 5개
    const m = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, emissive: 0xd8f0ff, emissiveIntensity: 1.5 });
    pbox(.34, .05, 1.3, PM(0xc8ccce, .4, .5), .8, 2.86, z, O, { cast: false }); pbox(.12, .04, 1.2, m, .8, 2.82, z, O, { cast: false });
    let v = .85; return { get intensity() { return v; }, set intensity(x) { v = x; m.emissiveIntensity = x * 1.8; m.color.setScalar(x > .3 ? 1 : .35); } };
  });
  // 졸업 앨범 액자 · 학급 게시판 (비뚤게) — 소등이 끝나는 순간 하나가 떨어져 깨진다
  const photo = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 192; const x = c.getContext('2d'); x.fillStyle = '#8a7a5a'; x.fillRect(0, 0, 256, 192); x.fillStyle = '#d8cca8'; x.fillRect(10, 10, 236, 150);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) { x.fillStyle = '#3a3226'; x.beginPath(); x.arc(30 + k * 25 + (r % 2) * 6, 55 + r * 34, 8, 0, 7); x.fill(); x.fillRect(22 + k * 25 + (r % 2) * 6, 63 + r * 34, 16, 18); }
    x.fillStyle = '#2a2016'; x.font = 'bold 16px sans-serif'; x.textAlign = 'center'; x.fillText('제 47 회 졸업 · 1998', 128, 182); return srgb(new THREE.CanvasTexture(c)); })();
  const frame = (z, rz) => { const f = new THREE.Group(); f.position.set(2.38, 1.78, z); f.rotation.set(0, -Math.PI / 2, rz); f.userData.dynamic = true; O.add(f);
    pbox(.72, .56, .04, PM(0x3a2416, .6), 0, 0, 0, f); pmesh(new THREE.PlaneGeometry(.64, .48), new THREE.MeshStandardMaterial({ map: photo, roughness: .3 }), 0, 0, .022, f, { cast: false }); return f; };
  frame(-10.55, .05); frame(PASS_DOOR + 2.2, .03); PASS.frame = frame(PASS.frameZ, -.07);
  const board = pbox(.04, .7, 1.0, PM(0x2a4a34, .9), -.78, 1.6, PASS_DOOR + .55, O, { rx: .04 });
  for (let k = 0; k < 4; k++) pmesh(new THREE.PlaneGeometry(.2, .27), PM(0xe0d8c0, .9), .025, (k % 2) * .25 - .1, -.3 + k * .18, board, { ry: Math.PI / 2, rz: (Math.random() - .5) * .2, cast: false });
  // ── 긴 창문 (밖의 안뜰이 보인다): 클래스의 통짜 옆벽을 숨기고, 허리벽 · 창틀 · 기둥 · 상인방으로 다시 짓는다 ──
  //    창: 서쪽 [-18.7, -16.2] · [-14.2, -11.4] (가운데 스팀 밸브 · 끝의 게시판 · 청소도구함 자리는 벽) · 동쪽 [-16.9, -13.4]
  eWall.visible = wWall.visible = false;
  { const mLow = PM(0x42524c, .85), mUp = PM(0xb8b3a6, .92), mRail = PM(0x2b241d, .7), mFr = PM(0x6a6e6c, .45, .6);
    const mGlass = new THREE.MeshStandardMaterial({ color: 0x9ab0b8, roughness: .08, metalness: .1, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide, name: 'passGlass' });
    const z0 = WALKWAY.z1, z1 = WALKWAY.z2, SILL = 1.0, HEAD = 2.3, H = 2.9;
    const WIN = { w: [[-18.7, -16.2], [-14.2, -11.4]], e: [[-16.9, -13.4]] };
    [['w', -.85], ['e', 2.45]].forEach(([side, x]) => {
      const ins = side === 'w' ? .055 : -.055;   // 복도 쪽 면
      pbox(.1, SILL, z1 - z0, mLow, x, SILL / 2, (z0 + z1) / 2, O);                 // 허리벽 (청록 유성페인트)
      pbox(.12, .06, z1 - z0, mRail, x + ins * .2, SILL, (z0 + z1) / 2, O);           // 창턱 겸 띠
      pbox(.1, H - HEAD, z1 - z0, mUp, x, (HEAD + H) / 2, (z0 + z1) / 2, O);          // 상인방 위 벽
      // 창 사이 기둥 벽
      let zc = z0; const ws = WIN[side].slice().sort((a, b) => a[0] - b[0]);
      ws.concat([[z1, z1]]).forEach(([a, b]) => { if (a - zc > .01) pbox(.1, HEAD - SILL, a - zc, mUp, x, (SILL + HEAD) / 2, (zc + a) / 2, O); zc = b; });
      ws.forEach(([a, b]) => {
        pmesh(new THREE.PlaneGeometry(b - a, HEAD - SILL), mGlass, x, (SILL + HEAD) / 2, (a + b) / 2, O, { ry: Math.PI / 2, cast: false });
        const n = Math.max(2, Math.round((b - a) / .9));   // 세로 창살 · 가로 창틀
        for (let k = 0; k <= n; k++) pbox(.08, HEAD - SILL, .05, mFr, x, (SILL + HEAD) / 2, a + (b - a) * k / n, O);
        [SILL + .03, (SILL + HEAD) / 2 + .2, HEAD - .03].forEach(y => pbox(.08, .05, b - a, mFr, x, y, (a + b) / 2, O));
      });
    });
    // 별관 쪽 연결부 상부 인방 마감 (막혀 있던 가짜 끝벽 z0 - 6.45 은 제거하여 실제 별관 1·2·3층 연결 홀 및 복도가 구름다리에서 막힘 없이 직통으로 보이게 함!)
    pbox(3.4, .38, .12, mUp, .8, H - .19, z0 + .06, O);

    // ── 3층 구름다리(skybridge3F, y = 2 * FH = 8.0m) 실내 통로 (본관 3F ⇄ 별관 3F 직통 오픈!) ──
    {
      const O3 = new THREE.Group(); O3.name = 'skybridge3F'; O3.position.y = 2 * FH; O3.userData.dynamic = true; world.OUT.add(O3);
      pbox(3.4, .14, z1 - z0 + .4, floor.material, .8, -.06, (z0 + z1) / 2, O3, { cast: false });
      pbox(3.4, .16, z1 - z0 + .4, PM(0x6e6c64, .85), .8, H + .06, (z0 + z1) / 2, O3, { cast: false });
      [['w', -.85], ['e', 2.45]].forEach(([side, x]) => {
        const ins = side === 'w' ? .055 : -.055;
        pbox(.1, SILL, z1 - z0, mLow, x, SILL / 2, (z0 + z1) / 2, O3);
        pbox(.12, .06, z1 - z0, mRail, x + ins * .2, SILL, (z0 + z1) / 2, O3);
        pbox(.1, H - HEAD, z1 - z0, mUp, x, (HEAD + H) / 2, (z0 + z1) / 2, O3);
        let zc = z0; const ws = WIN[side].slice().sort((a, b) => a[0] - b[0]);
        ws.concat([[z1, z1]]).forEach(([a, b]) => { if (a - zc > .01) pbox(.1, HEAD - SILL, a - zc, mUp, x, (SILL + HEAD) / 2, (zc + a) / 2, O3); zc = b; });
        ws.forEach(([a, b]) => {
          pmesh(new THREE.PlaneGeometry(b - a, HEAD - SILL), mGlass, x, (SILL + HEAD) / 2, (a + b) / 2, O3, { ry: Math.PI / 2, cast: false });
          const n = Math.max(2, Math.round((b - a) / .9));
          for (let k = 0; k <= n; k++) pbox(.08, HEAD - SILL, .05, mFr, x, (SILL + HEAD) / 2, a + (b - a) * k / n, O3);
          [SILL + .03, (SILL + HEAD) / 2 + .2, HEAD - .03].forEach(y => pbox(.08, .05, b - a, mFr, x, y, (a + b) / 2, O3));
        });
      });
      pbox(3.4, .6, .22, wallMat, .8, 2.6, PASS.doorZ, O3);
      [-.85, 2.45].forEach(x => pbox(.12, 2.32, .26, PM(0x3a3e40, .45, .6), x, 1.16, PASS.doorZ, O3));
      pmesh(new THREE.PlaneGeometry(1.35, .32), new THREE.MeshBasicMaterial({ map: makeSign('별관 3층 연결 홀 ↑', '#1e2a2e', '#d9e4d0', 24), color: 0x9aa59a }), .8, 2.62, PASS.doorZ + .115, O3, { cast: false });
      pbox(3.4, .38, .12, mUp, .8, H - .19, z0 + .06, O3);
      const mLit3 = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, emissive: 0xd8f0ff, emissiveIntensity: 1.5 });
      [0, 1, 2, 3, 4].map(k => z0 + .65 + k * (z1 - z0 - 1.3) / 4).forEach(lz => {
        pbox(.34, .05, 1.3, PM(0xc8ccce, .4, .5), .8, 2.86, lz, O3, { cast: false });
        pbox(.12, .04, 1.2, mLit3, .8, 2.82, lz, O3, { cast: false });
      });
    }
  }
  // ── 전등 스위치 (본관 쪽 서쪽 벽): 통로 형광등 켜기 · 끄기. 순차 소등 뒤 비상 전력일 때는 깜빡이기만 한다 ──
  { const plate = pbox(.02, .14, .09, PM(0xd8d4c8, .6), -.79, 1.35, -11.05, O); pbox(.025, .05, .03, PM(0x8a8478, .5), -.775, 1.35, -11.05, O);
    pmesh(new THREE.PlaneGeometry(.2, .06), new THREE.MeshBasicMaterial({ map: makeSign('복도 전등', '#d8d4c4', '#2a2a2a', 26) }), -.785, 1.5, -11.05, O, { ry: Math.PI / 2, cast: false });
    PASS.lightOn = true;
    [0, 1, 2].forEach(pf => {
      if (floors[pf]?.lamps) {
        [-12.5, -16.5, -20.5, -24.5].forEach(lz => floors[pf].lamps.push({ x: .8, y: floors[pf].y0 + 2.75, z: lz, kind: 'on', mat: floors[pf].lamps[0]?.mat }));
      }
      const af = floors[pf + 8];
      if (af?.lamps) {
        [13.5, 17.5].forEach(lz => af.lamps.push({ x: .8, y: af.y0 + 2.75, z: lz, kind: 'on', mat: af.lamps[0]?.mat }));
      }
    });
    world.props.push({ kind: 'passSwitch', floor: 1, x: -.4, z: -11.05, y: 1.35, label: '전등 스위치 (2층 구름다리)', plate }); }
  { const wp = new THREE.Vector3(); O.traverse(o => { if (o.isMesh && o.castShadow) { o.getWorldPosition(wp); if (wp.y > 2.3 && wp.y < 3.2 && wp.x > -1.7 && wp.x < 3.7 && wp.z > WALKWAY.z1 && wp.z < WALKWAY.z2) o.castShadow = false; } }); }   // 통로 천장 등기구: 그림자 끔
  // 폐책걸상 더미 (동쪽 벽 · 일직선으로 못 달리고 돌아가야 한다)
  const PZ = PASS.pileZ + 11.85;   // 책걸상 더미 위치 (예전 z −11.85 기준 상대값)
  F0.col.push({ x1: 1.0, x2: 2.4, z1: -12.1 + PZ, z2: -11.55 + PZ });
  // 벽 · 문 충돌: 새 벽 안쪽 + 옛 유리 통로 동쪽 바깥문(이제 막힌 실내 복도) · 벽 뒤 빈틈
  [{ x1: -1.62, x2: -.8, z1: WALKWAY.z1, z2: WALKWAY.z2 }, { x1: 2.4, x2: 3.75, z1: WALKWAY.z1, z2: WALKWAY.z2 }].forEach(r => { F0.col.push(r); F0.walls.push(r); });
  F0.col.push({ x1: -.42 - .38, x2: -.42 + .38, z1: -10.73, z2: -10.07 });
  const mopHide = { floor: 1, x: -.42, z: -11.95, y: FH, dir: { x: 1, z: 0 }, noPick: true, mop: true, label: '청소도구함에 숨기' }; world.lockers.push(mopHide);
  const fd = IA(ipP, 'passage_fire_door'), sv = IA(ipP, 'passage_steam_valve'), mp = IA(ipP, 'passage_mop_locker');
  fzProp(fd, 1, -.55, PASS_DOOR + .25, 1.3, { r: .95, pass: 'door' });
  fzProp(sv, 1, -.6, PASS.valveZ, 1.35, { r: 1.15 });
  fzProp(mp, 1, .2, -11.95, 1.0, { r: 1.0, hide: mopHide });
  // 책걸상 모델 (실사 소품) 따로 불러와 쌓는다
  const ld = new GLTFLoader(), put = (name, list) => ld.load(`assets/models/${name}/${name}.gltf`, gl => list.forEach(([x, y, z, ry, rx = 0, rz = 0]) => { const m = gl.scene.clone(); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.traverse(o => { o.userData.dynamic = true; if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); O.add(m); }), undefined, () => {});
  // 뒤집힌 위 책상은 원점이 다리 끝이라 상판 높이만큼 올려야 아래 책상 위에 얹힌다 (예전엔 아래 책상 속에 묻혀 그 위 의자가 허공에 떠 있었다)
  // 쌓아 둔 책걸상은 구름다리(z 1.32배 늘림)로 옮기면 기울어져 서로 · 바닥을 뚫었다 → 쌓지 않고 바닥에 밀어 둔 모양으로
  put('SchoolDesk_01', [[1.75, 0, -12.75 + PZ, .2], [1.7, 0, -11.55 + PZ, 2.9]]);
  put('SchoolChair_01', [[1.0, .28, -12.4 + PZ, 1.3, 0, Math.PI / 2], [2.35, 0, -13.2 + PZ, .6], [2.25, 0, -11.0 + PZ, 2.2]]);
}
function passBlock(on) {
  const F0 = floors[1];
  F0.col = F0.col.filter(r => r !== PASS.col); F0.walls = F0.walls.filter(r => r !== PASS.col);
  if (on) { F0.col.push(PASS.col); F0.walls.push(PASS.col); PASS.warned = false; shake = .35; }
}
// 방화문이 닫혀 있으면 본관 ↔ 별관(별관 1~3층) 사이를 그것도 플레이어도 지나지 못한다
const passSide = f => (f >= 8 && f <= 10) ? 'annex' : 'main';
function passBlocks(fa, fb) { return ipP.state.fireDoorClosed && passSide(fa) !== passSide(fb); }
function passDoorBlocked(d) { return ipP.state.fireDoorClosed && d.to && ((d.floor === 1 && d.to.floor === 9) || (d.floor === 9 && d.to.floor === 1)); }
function passBang(dt) {   // 그것이 반대편에서 방화문을 쾅쾅
  PASS.bangT -= dt; if (PASS.bangT > 0) return; PASS.bangT = 1.6 + Math.random() * 1.2;
  const near = inPassage() || P.floor === 9; if (!near) return;
  const A = P.floor === 9 ? at(0, floors[9].y0 + 1.2, 9.4) : at(.8, FH + 1.2, PASS.doorZ); A.doorBang(0, 1.3); A.thump();
  if (inPassage()) { shake = .4; fx.dust(.8, 2.4, PASS.doorZ + .2, 8); }
  if (!PASS.warned) { PASS.warned = true; caption('쾅! 쾅! — 방화문 너머에서 무언가가 문을 부수려 한다'); }
}

/* ── 9. 3D 철제 캐비닛 사물함: 맵의 상자형 사물함(복도 · 교실 뒤 · 교무실 · 체육관 · 수영장 탈의실 · 급식실)을 같은 자리 · 같은 크기의 캐비닛 묶음으로 ── */
const STEEL = [];   // { f, x, z, data } — 문짝 하나
{
  // 문짝 텍스처: 같은 번호 · 녹 조합은 한 번만 그리고 줄여서 공유한다 (사물함 수백 칸 × 512×1024 두 장이면 GPU 메모리가 수백 MB)
  const orig = clP.textures.buildLockerDoorMaps, cache = new Map();
  const shrink = (tex, w, h, color) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(tex.image, 0, 0, w, h); const t = new THREE.CanvasTexture(c); if (color) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  clP.textures.buildLockerDoorMaps = (num, rust) => { const k = num + (rust ? 'r' : ''); if (!cache.has(k)) { const m = orig(num, rust); cache.set(k, { map: shrink(m.map, 192, 384, true), bumpMap: shrink(m.bumpMap, 96, 192) }); } return cache.get(k); };
  const LB = world.LOCKER_BOXES;
  LB.forEach(b => { if (b.slot) b.slot.visible = false; });
  const boxes = LB.filter(b => b.mesh && b.w <= .8 && b.h >= 1.3).map(b => {
    const l = world.lockers.find(q => q.floor === b.f && !q.stallDoor && Math.hypot(q.x - b.x, q.z - b.z) < 1.05);
    const dir = b.ry !== 0 ? { x: Math.sin(b.ry), z: Math.cos(b.ry) } : (l && l.dir) || { x: 0, z: 1 };
    const th = Math.round(Math.atan2(dir.x, dir.z) / (Math.PI / 2)) * (Math.PI / 2), rx = Math.cos(th), rz = -Math.sin(th);
    const sw = Math.abs(Math.sin(b.ry)) > .7, ex = sw ? b.d : b.w, ez = sw ? b.w : b.d;
    return { ...b, th, along: b.x * rx + b.z * rz, perp: b.x * Math.sin(th) + b.z * Math.cos(th), wAl: Math.abs(rx) > .7 ? ex : ez, dep: Math.abs(rx) > .7 ? ez : ex };
  });
  const runs = new Map();
  boxes.forEach(b => { const k = `${b.f}|${b.th.toFixed(2)}|${Math.round(b.perp * 10)}|${b.h.toFixed(2)}`; (runs.get(k) || runs.set(k, []).get(k)).push(b); });
  const num = {}; let misc = 0;
  runs.forEach(list => {
    list.sort((a, b) => a.along - b.along);
    const groups = [[list[0]]];
    for (let i = 1; i < list.length; i++) { const g = groups[groups.length - 1], pr = g[g.length - 1]; if (list[i].along - pr.along < Math.max(pr.wAl, list[i].wAl) + .12) g.push(list[i]); else groups.push([list[i]]); }
    groups.forEach(g => {
      const a = g[0], n = g.length, pitch = n > 1 ? (g[n - 1].along - a.along) / (n - 1) : a.wAl + .02;
      const corridor = Math.abs(a.z + 1.2) < .05 && a.th === 0;
      const start = corridor ? (num[a.f] = (num[a.f] || 0)) + 1 : 13 + (misc++ % 8);
      if (corridor) num[a.f] += n;
      const bank = clP.create3DSteelLockerBank(V3(a.x, a.y, a.z), { count: n, rotationY: a.th, startNumber: start });
      FLR(a.f).add(bank); bank.scale.set(pitch / .64, a.h / 1.88, a.dep / .54);
      g.forEach(b => { b.mesh.visible = false; });
      // 몸체 판(뒷판 · 옆판 · 위아래 · 선반)은 묶음마다 재질별로 합친다 (그리기 호출 절약) — 문짝만 따로 움직인다
      bank.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(bank.matrixWorld).invert(), byMat = new Map(), dead = [];
      bank.children.forEach(u => u.children.forEach(m => { if (!m.isMesh) return; const gg = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); (byMat.get(m.material) || byMat.set(m.material, []).get(m.material)).push(gg); dead.push(m); }));
      dead.forEach(m => m.parent.remove(m));
      byMat.forEach((gs, mat) => { const mm = new THREE.Mesh(mergeGeometries(gs), mat); mm.castShadow = mm.receiveShadow = true; bank.add(mm); });
      bank.traverse(o => { o.userData.dynamic = true; if (o.isMesh) { o.castShadow = o.receiveShadow = true; if (o.material.map) { o.material.map.colorSpace = THREE.SRGBColorSpace; } } });
      const datas = clP.lockers.slice(-n), wp = new THREE.Vector3();
      datas.forEach(d => { d.unitGroup.getWorldPosition(wp); STEEL.push({ f: a.f, x: wp.x, z: wp.z, data: d }); });
    });
  });
}
const steelNear = (f, x, z, r = .7) => { let best = null, bd = r; for (const s of STEEL) { if (s.f !== f) continue; const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } } return best; };
function steelHide(l, on) {
  const s = l._steel !== undefined ? l._steel : (l._steel = steelNear(l.floor, l.x, l.z, .6));
  if (s) s.data.setPlayerHiding(on); else if (l.mop) document.body.classList.toggle('patch-inside-locker', on);
}
function steelOpen(f, x, z, open, r = .9) { const s = steelNear(f, x, z, r); if (s && s.data.isOpen !== open) s.data.toggleDoor(open); return s; }

// 수색을 마친 철제 사물함: E 로 문을 열고 닫는다 (닫아 둔 상태는 저장된다)
world.props.filter(p => p.kind === 'search').forEach(p => {
  const s = steelNear(p.floor, p.x, p.z, .9); if (!s) return;
  world.props.push({ kind: 'ldoor', floor: p.floor, x: p.x, z: p.z, y: 1.0, after: p, steel: s, uid: 'ld:' + p.uid, get label() { return s.data.isOpen ? '사물함 문 닫기' : '사물함 문 열기'; } });
});
function lockerDoorToggle(p) {
  const s = p.steel, open = !s.data.isOpen; s.data.toggleDoor(open);
  FL.ldShut ||= {}; if (open) delete FL.ldShut[p.after.uid]; else FL.ldShut[p.after.uid] = 1;
  sfx.locker ? sfx.locker() : sfx.click(); P.noiseT = Math.max(P.noiseT, open ? .3 : .5);   /* 닫을 때 쾅 — 조금 더 시끄럽다 */
}

/* ── 9-2. 본관 1 · 2 · 3층 복도 리모델링: 18m 구간 4개씩 — 클래스가 만든 소품을 실제 벽 · 문 · 형광등 자리로 옮긴다 ── */
{
  const CW = 2.9, segs = [[-27, [0, 1]], [-9, [2, 3]], [9, [4, 5, 6]], [27, [7, 8]]];
  const sizeIs = (m, a, b, c) => { const p = m.geometry && m.geometry.parameters; return p && Math.abs(p.width - a) < 1e-3 && Math.abs(p.height - b) < 1e-3 && Math.abs(p.depth - c) < 1e-3; };
  [0, 1, 2].forEach(f => {
    const lay = LAYOUT[f], LS = LAYOUT_S[f], trims = [], lamps = floors[f].lamps.filter(l => !l.room && Math.abs(l.z) < .1).map(l => l.x).sort((a, b) => a - b);
    let trimMat = null;
    segs.forEach(([cx, idx]) => {
      const labels = [];
      idx.forEach(i => { if (lay.types[i] !== 'stair') labels.push({ t: lay.names[i], x: SLOTS[i], north: true }); if (LS && !['stair', 'lobby', 'hall'].includes(LS.types[i])) labels.push({ t: LS.names[i], x: SLOTS[i], north: false }); });
      const g = clP.upgradeCorridorSegment(V3(cx, 0, 0), { length: 18, width: CW, height: CH_, roomLabels: labels.map(l => l.t) });
      FLR(f).add(g); g.rotation.y = Math.PI / 2; g.updateMatrixWorld(true);
      const put = (m, X, Y, Zl) => m.position.set(Zl, Y, X - cx);   // (월드 x, 높이, 그룹 x(= −월드 z))
      const kids = g.children.slice(), wins = [], signs = [], fixtures = [];
      kids.forEach(m => {
        if (m.isPointLight) { g.remove(m); return; }
        if (sizeIs(m, .06, .09, 18) || sizeIs(m, .05, .12, 18)) { trimMat = m.material; g.remove(m); return; }
        if (sizeIs(m, .08, 1.05, 3.2)) wins.push(m); else if (sizeIs(m, .46, .24, .03)) signs.push(m); else if (sizeIs(m, .32, .07, 1.25)) fixtures.push(m);
        else if (sizeIs(m, .14, .95, .68)) { if (cx === -27 || cx === 9) put(m, cx === -27 ? -29.5 : 5.5, 1.35, m.position.x); else m.visible = false; m.material.map && srgb(m.material.map); }
        else if (m.geometry && m.geometry.type === 'SphereGeometry') { if (cx === -27 || cx === 9) { put(m, cx === -27 ? -29.5 : 5.5, 1.92, m.position.x); const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('255,40,30'), blending: THREE.AdditiveBlending, depthWrite: false, opacity: .55 })); gl.scale.setScalar(.6); gl.position.copy(m.position); g.add(gl); } else m.visible = false; }
        else if (sizeIs(m, .06, 1.1, 2.1)) { if (cx === 9 || cx === 27) { put(m, cx === 9 ? 13.6 : 21.5, 1.6, m.position.x); for (let k = 0; k < 6; k++) { const pp = new THREE.Mesh(new THREE.PlaneGeometry(.26, .34), PM([0xe8e0c8, 0xd8c8a0, 0xc8d8e0][k % 3], .9)); pp.position.set(-.032, (k % 2) * .4 - .2, -.8 + k * .32); pp.rotation.set(0, -Math.PI / 2, (Math.random() - .5) * .25); m.add(pp); } } else m.visible = false; }
      });
      // 채광창: 남쪽 교실 벽(문 사이 3m 벽) 위쪽
      const spots = []; idx.forEach(i => { if (LS && !['lobby', 'hall'].includes(LS.types[i])) spots.push(SLOTS[i] - 2.55, SLOTS[i] + 2.55); });   /* 문틀(±1.1) 과 방 칸막이(±4) 사이 벽 가운데 */
      wins.forEach(w => { w.visible = false; });
      signs.forEach(s => { s.visible = false; });
      const myLamps = lamps.filter(x => x >= cx - 9 && x < cx + 9);
      fixtures.forEach((fx_, k) => { if (k < myLamps.length) { put(fx_, myLamps[k], CH_ - .04, 0); fx_.scale.z = 1.22; } else fx_.visible = false; });
      g.traverse(o => { o.userData.dynamic = true; if (o.isMesh) o.receiveShadow = true; });
    });
    // 허리 몰딩 · 걸레받이: 문 · 개구부를 뺀 실제 벽 구간에만 (한 층에 메시 하나)
    SLOTS.forEach((cx, i) => {
      [[cx - 4, cx - 1], [cx + 1, cx + 4]].forEach(([a, b]) => trims.push([a, b, -1]));
      const open = LS && ['lobby', 'hall'].includes(LS.types[i]);
      (open ? [[cx - 4, cx - 3], [cx + 3, cx + 4]] : [[cx - 4, cx - 1], [cx + 1, cx + 4]]).forEach(([a, b]) => trims.push([a, b, 1]));
    });
    const gs = []; trims.forEach(([a, b, s]) => { const zf = s * (CW / 2); gs.push(new THREE.BoxGeometry(b - a, .09, .06).translate((a + b) / 2, 1.15, zf - s * .03), new THREE.BoxGeometry(b - a, .12, .05).translate((a + b) / 2, .06, zf - s * .025)); });
    const tm = new THREE.Mesh(mergeGeometries(gs), trimMat || PM(0x38281c, .65)); tm.receiveShadow = true; tm.userData.dynamic = true; FLR(f).add(tm);
  });
}

/* ── 매 프레임 ── */
const _pp = new THREE.Vector3(), _far = new THREE.Vector3(0, 1e4, 0);
let patchSyncT = 0;
function patchTick(dt) {
  const G = ghost, M = fzP.missions, E = fzP.events;
  // 9. 철제 사물함 문 보간 · 수색 끝난 사물함은 열린 채로(불러오기 포함)
  clP.update(dt);
  if ((patchSyncT -= dt) <= 0) { patchSyncT = 1;
    world.props.forEach(p => { if (p.kind === 'search' && p.done && !(FL.ldShut && FL.ldShut[p.uid])) { const s = steelNear(p.floor, p.x, p.z, .9); if (s && !s.data.isOpen && !s.data.isPlayerInside) { s.data.isOpen = true; s.data.targetRotationY = -Math.PI * .62; } } });
    if (!P.hiding && document.body.classList.contains('patch-inside-locker')) document.body.classList.remove('patch-inside-locker');
    const z = zoneLabel(); if (z && z !== '실내 연결복도' && !FL.fzSeen && state === 'playing') { FL.fzSeen = true; refreshHud(); toast('서브 미션 · 구역 조사', `${z} — 남겨진 설비와 기록을 조사할 수 있다`, 'info'); }
  }
  // 7. 5대 구역: 냉동창고 저체온 · 해골 모형 (해골은 과학실 안에 있을 때만, 층 기준 좌표로)
  const inLab = P.floor === 9 && P.x > 12.1 && P.x < 19.9 && P.z < -1.75 && P.z > -9.6;
  fzP.update(dt, inLab ? _pp.set(P.x, 0, P.z) : null, notify);
  if (FZ.skel) {
    const s = FZ.skel.position; s.x = clamp(s.x, 12.6, 19.4); s.z = clamp(s.z, -9.2, -2.2); const q = { x: s.x, z: s.z }; collide(floors[9].col, q, .22); s.x = q.x; s.z = q.z; s.y = 0;
    if (inLab) {
      const d = Math.hypot(s.x - P.x, s.z - P.z), lx = -Math.sin(P.yaw), lz = -Math.cos(P.yaw), sees = ((s.x - P.x) * lx + (s.z - P.z) * lz) / Math.max(d, .01) > .2;
      if (sees) { if (false && FZ.skelSeenAt && Math.hypot(FZ.skelSeenAt.x - s.x, FZ.skelSeenAt.z - s.z) > .7) { at(s.x, FH + .5, s.z).chairScrape(); P.fear = Math.min(1, P.fear + .05); caption('…해골 모형이 아까보다 가까이 와 있다'); } FZ.skelSeenAt = { x: s.x, z: s.z }; }
      FZ.skelScareCD -= dt;
      if (false && d < 1.55 && FZ.skelScareCD <= 0) { FZ.skelScareCD = 25; window.schoolPatchAddon.addFear(22); caption('뒤에 — 하얀 손가락뼈가 어깨에 닿았다'); setTimeout(() => { FZ.skel.position.copy(FZ.skelHome); FZ.skelSeenAt = null; }, 2600); }
    }
  }
  // 냉동창고 문 · 서리 · 체온 경고 · 자동 개방
  const lockedNow = E.freezerLocked;
  if (lockedNow !== FZ.prevLocked) {
    const F7 = floors[7]; F7.col = F7.col.filter(r => r !== FZ.freezerCol); F7.walls = F7.walls.filter(r => r !== FZ.freezerCol);
    if (lockedNow) { F7.col.push(FZ.freezerCol); F7.walls.push(FZ.freezerCol); FZ.freezerDoor.target = 0; at(-37.35, floors[7].y0 + 1.2, 10.5).doorBang(0, 1.3); shake = .5; vig('frostVig', 30000); }
    else { FZ.freezerDoor.target = Math.PI / 2; sfx.doorHinge(.8); $('frostVig').classList.remove('on'); if (E.freezerTimer <= 0) say('…문 잠금이 얼어서 터지듯 풀렸다. 손발이 감각이 없다.', 4000); }
    FZ.prevLocked = lockedNow; refreshHud();
  }
  { const D = FZ.freezerDoor; D.t += (D.target - D.t) * Math.min(1, dt * (D.target < D.t ? 9 : 3)); D.piv.rotation.y = D.t; }
  if (lockedNow && state === 'playing') { FZ.lastLockFx -= dt; if (FZ.lastLockFx <= 0) { FZ.lastLockFx = 5; caption(`❄ 체온이 떨어진다 — 비상 레버까지 ${Math.ceil(E.freezerTimer)}초`); } if (Math.random() < dt * 6) fx.emit(P.x - Math.sin(P.yaw) * .3, floors[7].y0 + 1.5, P.z - Math.cos(P.yaw) * .3, (Math.random() - .5) * .1, .05, (Math.random() - .5) * .1, 1.2, [.9, .95, 1], .25, .12, 0, .5, .8); }
  // 가스 화구 불꽃
  if (FZ.flameT > 0) { FZ.flameT -= dt; const S = FZ.stoveAt; for (let k = 0; k < 3; k++) fx.emit(S.x + (Math.random() - .5) * .2, S.y, S.z + (Math.random() - .5) * .5, (Math.random() - .5) * .1, .6 + Math.random() * .4, (Math.random() - .5) * .1, .45, [.3, .5, 1], .7, .1, 0, .4, -.4); }
  // Real CCTV render targets replace the former drawn placeholder frames.
  FZ.cctvScareT=Math.max(0,FZ.cctvScareT-dt);
  FZ.lamp.material.color.setHex(M.rooftopGeneratorOn ? (FL.gatePower ? 0x30ff60 : 0x20c040) : 0x601008);
  // 옥상 발전기: 경광등 · 엔진 소리
  if (M.rooftopGeneratorOn) { const on = ((tNow * 2.4) | 0) % 2 === 0; FZ.beacon.material.color.setHex(on ? 0xff3018 : 0x5a0a04); FZ.beaconGlow.material.opacity = on ? .8 : .1;
    if (P.floor === 3 && (FZ.genT -= dt) <= 0) { FZ.genT = 1.3; at(19.6, ROOF_Y + .6, 4.4).genChug(.5); } }
  if (M.rooftopSignalSent) FZ.led.material.color.setHex(((tNow * 1.5) | 0) % 2 ? 0x30ff40 : 0x0a3a0a);
  // 미션 A 끝: 열린 정문을 지나면 탈출
  if (FL.gatePower && !escaped && state === 'playing' && P.floor === 0 && P.z > GATE_Z + .4 && Math.abs(P.x) < 4.2) { escaped = true; winGame(); }
  // 그것이 운동장으로 나왔다가 돌아간다
  if (G.outT > 0) { G.outT -= dt; if (G.outT <= 0 && G.floor === 0 && G.z > MAIN_ZS - .4 && !G.enraged && G.state !== 'chase') { ghostLeave(); } }
  // 8. 실내 연결복도 (복도 안에 있을 때만 실제 위치를 넘긴다 — 바깥 · 다른 층에서 소등 이벤트가 먼저 터지지 않게)
  ipP.update(dt, inPassage() ? (RBG ? _pp.set(...(([a, b]) => [a, 0, b])(RBG.passToOld(P.x, P.z))) : _pp.set(P.x, 0, P.z)) : _far, notify);
  if (ipP.state.blackoutTriggered && !PASS.prevBlack) { PASS.prevBlack = true; setTimeout(() => {
    if (PASS.frameFell) return; PASS.frameFell = true; const f = PASS.frame; let t = 0; at(2.3, 1.7, PASS.frameZ).glassCrack();
    const iv = setInterval(() => { t = Math.min(1, t + .08); f.position.y = 1.78 - t * t * 1.72; f.position.x = 2.38 - t * .25; f.rotation.z = -.07 - t * 1.2; f.rotation.x = t * .5; if (t >= 1) { clearInterval(iv); sfx.glassCrack(); at(2.1, .1, -11.85).thump(); fx.dust(2.1, .1, -11.85, 14); shake = .25; caption('…졸업 앨범 액자가 떨어져 유리가 산산이 깨졌다'); } }, 30);
  }, 2250); }
  if (!ipP.state.fireDoorClosed && floors[1].col.includes(PASS.col)) passBlock(false);
  if (ipP.state.steamActive) steamTick(dt); else steamOff();
  if (ghost.active && passBlocks(G.floor, P.floor) && G.away > 4) passBang(dt);
  world.props.forEach(p => { if (p.pass === 'door') p.label = ipP.state.fireDoorClosed ? `방화문 빗장 풀고 열기 (${Math.ceil(ipP.state.barricadeTimer)}초 뒤 저절로 부서진다)` : p.fz.promptText.replace(/^\[E\]\s*/, ''); });
}
// 증기: 밸브 노즐에서 고압 분사(가늘고 빠른 심) → 공기와 섞이며 퍼지는 뭉게구름 → 바닥에 깔리는 옅은 안개. 가까이 있으면 화면에 김이 서린다
const STM = { acc: 0, haze: 0, el: null };
function steamTick(dt) {
  const R = Math.random, vz = PASS.valveZ, nx = -.6;
  STM.acc += dt * 70;
  while (STM.acc > 1) { STM.acc--;
    const k = R();
    if (k < .35) fx.emit(nx, 2.5, vz + (R() - .5) * .06, 2.6 + R() * 1.2, -.25 + (R() - .5) * .3, (R() - .5) * .35, .45 + R() * .25, [.96, .97, .98], .35, .09, 0, 2.2, 1.1);   // 분사 심
    else if (k < .85) fx.emit(nx + .5 + R() * .8, 2.3 + (R() - .5) * .4, vz + (R() - .5) * .5, .5 + R() * .7, .05 + R() * .25, (R() - .5) * .6, 2.2 + R() * 1.4, [.86, .88, .9], .2 + R() * .1, .4 + R() * .3, -.04, .9, .9);   // 퍼지는 뭉게구름
    else fx.emit(nx + .6 + R() * 2, .25 + R() * .3, vz + (R() - .5) * 2.2, (R() - .5) * .3, .02, (R() - .5) * .3, 3.5 + R() * 2, [.7, .74, .76], .05, .6 + R() * .4, 0, .4, .35);   // 바닥 안개
  }
  // 화면 김 서림 (가까울수록) + 쉭 하는 미세 흔들림
  const near = P.floor === 0 && !P.inElev ? Math.max(0, 1 - Math.hypot(P.x - (nx + 1), P.z - vz) / 3.2) : 0;
  STM.haze += (near - STM.haze) * Math.min(1, dt * 2.5);
  if (!STM.el) { STM.el = document.createElement('div'); STM.el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4;background:radial-gradient(ellipse at 50% 60%,rgba(230,236,240,.0) 20%,rgba(220,228,232,.55) 75%,rgba(210,218,224,.8));opacity:0;transition:none'; document.body.appendChild(STM.el); }
  STM.el.style.opacity = (STM.haze * .85).toFixed(3); if (near > .4) shake = Math.max(shake, .02 * near);
}
function steamOff() { if (STM.el && STM.haze > 0) { STM.haze *= .9; STM.el.style.opacity = (STM.haze * .85).toFixed(3); } }
/* ── 18. 문: 모두 닫힌 채 시작 · 방 안쪽으로 열림 · 열린 문짝 충돌 · 초자연 현상으로 저절로 열림 ──
   · 처음엔 모든 문이 닫혀 있다 (불러오기는 저장된 문 상태가 덮어씀)
   · 여는 방향: 복도(본관 · 별관 z −1.75 ~ 1.75) 쪽 문은 방 안쪽으로, 그 밖의 문은 연 사람 반대쪽으로 — 문짝이 플레이어를 향해 휘둘러 오지 않는다
   · 열린 문짝도 얇은 충돌 판이 된다 (예전엔 열린 문짝을 그대로 뚫고 지나갔다) · 문틀에 서 있으면 문이 닫히지 않는다 (그것 · 이벤트가 닫아도) */
const DOORX = { v: new THREE.Vector3(), haunt: 70 + Math.random() * 40 };
function doorLeaves(d) { return d.leaves ? d.leaves.map(l => ({ p: l.piv, a: l.a })) : d.piv ? [{ p: d.piv, a: d.angOpen }] : null; }
function doorDir(d, ox, oz) {
  const L = doorLeaves(d); if (!L) return; const r = d.rect, cx = (r.x1 + r.x2) / 2, cz = (r.z1 + r.z2) / 2, zThin = (r.z2 - r.z1) <= (r.x2 - r.x1);
  const F = floors[d.floor], corr = zThin && Math.abs(cz) > 1.2 && Math.abs(cz) < 2.2 && (d.floor <= 2 || d.floor >= 8) && !F.area;
  const want = corr ? Math.sign(cz) : -Math.sign(zThin ? oz - cz : ox - cx) || 1;   // 문짝이 갈 쪽: 복도 문은 방 안쪽(복도 반대), 아니면 연 사람 반대쪽
  let s = 0; const keep = d.dir;
  L.forEach(({ p, a }) => { const r0 = p.rotation.y; p.rotation.y = a; p.updateMatrixWorld(true); p.children[0].getWorldPosition(DOORX.v); s += zThin ? DOORX.v.z - cz : DOORX.v.x - cx; p.rotation.y = r0; p.updateMatrixWorld(true); });
  d.dir = Math.sign(s) === want ? 1 : -1; if (keep != null && keep !== d.dir && d.open > .05) d.dir = keep;   // 열려 있는 도중엔 방향을 바꾸지 않는다
}
// 시작: 모두 닫힘 + 방향 미리 정함 + 문짝 충돌 판
world.doorList.forEach(d => { d.target = d.open = 0; d.rect.off = false; doorDir(d, P.x, P.z);
  const L = doorLeaves(d); if (L) { d.leafCols = L.map(() => ({ x1: 0, x2: 0, z1: 0, z2: 0, off: true, leaf: true })); d.leafCols.forEach(c => floors[d.floor].col.push(c)); } }); installSchoolDoors(world).catch(e => console.warn('school doors', e));   // 사용자 제공 양개문 모델로 교실 · 특별실 문짝 교체 (제외 구역은 schoolDoors.js)
const _lb = new THREE.Box3();
function doorTick(dt) {
  if (world.facDoors) for (const D of world.facDoors) if (D.t !== D.target) { D.t += Math.sign(D.target - D.t) * Math.min(Math.abs(D.target - D.t), dt * 2.4); D.sync(); }
  for (const d of world.doorList) {
    const r = d.rect, m = .42;
    // 문틀에 사람이 있으면 닫히지 않는다 (닫히는 문이 플레이어를 밀어 벽 너머로 튕기던 문제)
    if (d.target < .5 && d.open > .02 && d.floor === P.floor && !P.inElev && P.x > r.x1 - m && P.x < r.x2 + m && P.z > r.z1 - m && P.z < r.z2 + m) d.target = 1;
    if (!d.leafCols) continue;
    if (d.door2 || d.kind === 'slide' || (d.leaves && d.leaves[0]?.slide)) { d.leafCols.forEach(c => { c.off = true; }); continue; }
    const L = doorLeaves(d), on = d.open > .9;
    L.forEach(({ p, a }, i) => { const c = d.leafCols[i]; if (!on) { c.off = true; return; } p.rotation.y = a * d.open * (d.dir || 1); p.updateWorldMatrix(true, true); if (!c.off && c.o === d.open) return; c.o = d.open;
      _lb.setFromObject(p.children[0]); c.x1 = _lb.min.x; c.x2 = _lb.max.x; c.z1 = _lb.min.z; c.z2 = _lb.max.z; c.off = false; });
  }
}
function patchRestore() {
  if (FL.fz && FL.fz !== fzP.missions) Object.assign(fzP.missions, FL.fz);
  FL.fz = fzP.missions; fzApply(); poolRestore(); s37Restore(); n37Restore(); megaRestore();
}

/* ── 10. 지하 전기실 · 보일러실 (basementRoomsPatch.js · 사용자 제공) ──
   전기실: 북쪽 벽 빈자리에 고압 분전반 2면 + 파란 스파크(점광원 대신 빛무리 + 불꽃 입자) · 보일러실: 기존 보일러 자리에 같은 크기의 녹슨 대형 보일러로 교체
   스파크 · 팽창음은 지하층 그 방 근처에 있을 때만 (게임 어디서나 방전음이 들리지 않게) */
const bmP = window.basementRoomsPatch; bmP.init({ scene, audioCtx: sfxCtx });
const BM = { ex: SLOTS[2], bx: SLOTS[1], boomT: 6, steamT: 9, said: false };
{
  const y0 = floors[4].y0, F4 = floors[4], R = FLR(4);
  ['electricalPanel', 'rustedBoiler', 'basementWall'].forEach(k => srgb(bmP.textures[k]));
  const ex = BM.ex + .6;
  const eg = bmP.buildElectricalRoom(V3(ex, y0, -6.8), 0); R.add(eg); eg.position.set(ex, 0, -6.8); eg.traverse(o => { o.userData.dynamic = true; if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  [-.9, .9].forEach(dx => { F4.col.push({ x1: ex + dx - .6, x2: ex + dx + .6, z1: -9.56, z2: -9.05 });
    pmesh(new THREE.PlaneGeometry(.8, .22), new THREE.MeshBasicMaterial({ map: makeSign('⚡ 고압위험 · 접근금지', '#d8b020', '#111', 22) }), ex + dx, 1.82, -9.07, R, { cast: false });
    pmesh(new THREE.CircleGeometry(.32, 18), new THREE.MeshBasicMaterial({ color: 0x0a0806, transparent: true, opacity: .55, depthWrite: false }), ex + dx + (dx < 0 ? .25 : -.2), 1.3, -9.068, R, { cast: false }); });   // 탄 자국
  // 천장으로 올라가는 알록달록한 전선 다발
  { const gs = [], cols = [0xb02020, 0x2040b0, 0xd0b020, 0x202020, 0x30a040]; cols.forEach((c, k) => { const g = []; for (let i = 0; i < 4; i++) { const x = ex - 1.4 + i * .9 + k * .05; g.push(new THREE.CatmullRomCurve3([new THREE.Vector3(x, 2.1, -9.3), new THREE.Vector3(x + .1, 2.6 + k * .05, -9.2), new THREE.Vector3(x - .2, CH_ - .05, -9.0 + k * .04)])); }
      const m = new THREE.Mesh(mergeGeometries(g.map(cv => new THREE.TubeGeometry(cv, 10, .018, 5))), PM(c, .6, .1)); m.userData.dynamic = true; R.add(m); }); }
  bmP.electricalSparks.forEach((sp, i) => {
    eg.remove(sp.light); const px = ex + (i ? .9 : -.9), py = 1.4, pz = -9.0;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('130,185,255'), blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 })); glow.scale.setScalar(2.6); glow.position.set(px, py, pz); R.add(glow);
    let v = 0; sp.light = { get intensity() { return v; }, set intensity(x) { v = x; glow.material.opacity = Math.min(1, x / 5);
      if (x > 1) { for (let k = 0; k < 28; k++) fx.emit(px + (Math.random() - .5) * .3, y0 + py, pz, (Math.random() - .5) * 3, Math.random() * 2.4, Math.random() * 1.6, .4, [.55, .78, 1], 1, .05, 6); if (Math.random() < .3) blackout = Math.max(blackout, .08); } } };
  });
  // 보일러: 기존 원통 · 화실 문을 숨기고 같은 자리 · 같은 크기로
  const B = world.B_BOIL; if (B.b) {
    B.m.forEach(m => { m.visible = false; });
    const b = B.b, len = b.d * .92, k = 1.15 / 1.35;
    const bg = bmP.buildBoilerRoom(V3(b.x, y0, b.z), -Math.PI / 2); R.add(bg); bg.position.set(b.x, 1.35 - 1.3 * k, b.z); bg.scale.set(len / 2.6, k, k);
    bg.traverse(o => { o.userData.dynamic = true; if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    BM.boiler = { x: b.x, z: b.z, front: b.z + len / 2 + .2 };
    if (B.b2) { const bg2 = bg.clone(); bg2.position.x = B.b2.x; R.add(bg2); const h2 = bg2.children[1]; if (h2) h2.rotation.set(0, 0, Math.PI / 2); }   // 2호기 (참고 시트: 보일러 2대)
    // 클래스 버그 보정: 앞 해치(원판)를 rotation.y 로 돌려 바닥과 평행한 판처럼 튀어나왔다 → 원통 축(앞쪽)을 보게 세운다
    const hatch = bg.children[1]; if (hatch) hatch.rotation.set(0, 0, Math.PI / 2);
    // 원래 보일러의 받침대는 숨긴 메시와 함께 사라져 새 보일러가 바닥에서 20cm 떠 있었다 → 콘크리트 받침 + 철제 새들 2개
    const conc = PM(0x5a5a56, .95), sad = PM(0x2a2622, .6, .6);
    pbox(1.9, .1, len * .95, conc, b.x, .05, b.z, R);
    [-.3, .3].forEach(t => { pbox(1.5, .42, .22, sad, b.x, .31, b.z + t * len, R); pbox(1.7, .05, .32, sad, b.x, .125, b.z + t * len, R); });
    if (B.b2) [-.3, .3].forEach(t => { pbox(1.5, .42, .22, sad, B.b2.x, .31, b.z + t * len, R); pbox(1.7, .05, .32, sad, B.b2.x, .125, b.z + t * len, R); });
    // 바닥 기름때 · 찢어진 단열재 배관
    pmesh(new THREE.CircleGeometry(.95, 24).scale(1.3, .8, 1), PM(0x050403, .06, .4), b.x + 1.7, .012, b.z + 1.2, R, { rx: -Math.PI / 2, cast: false });
    const ins = PM(0xb8bcc0, .45, .7); pcyl(.13, .13, 2.4, ins, b.x + 1.6, 2.7, b.z - .6, R, { rx: Math.PI / 2 });
    for (let q = 0; q < 5; q++) pmesh(new THREE.PlaneGeometry(.18, .35), PM(0xc8ccd0, .5, .6, { side: THREE.DoubleSide }), b.x + 1.6 + (Math.random() - .5) * .2, 2.48, b.z - 1.4 + q * .4, R, { rz: (Math.random() - .5) * .6, ry: Math.random() * 3 });
  }
}
function basementTick(dt) {
  if (P.floor !== 4 || state !== 'playing') return;
  if (Math.abs(P.x - BM.ex) < 7 && P.z < 1.5) bmP.update(dt);
  const B = BM.boiler; if (!B || Math.abs(P.x - BM.bx) > 4.2 || P.z > -1.6) return;
  if ((BM.boomT -= dt) <= 0) { BM.boomT = 7 + Math.random() * 6; const A = at(B.x, floors[4].y0 + 1.3, B.z); A.thump(); setTimeout(() => A.pipeKnock(), 380); shake = Math.max(shake, .18); if (!BM.said) { BM.said = true; caption('보일러 안에서 쿵— 쾅— 철판이 팽창하는 소리'); } }
  if ((BM.steamT -= dt) <= 0) { BM.steamT = 10 + Math.random() * 8; BM.puff = 2.2; ipP._playSound('steam_burst'); }
  if (BM.puff > 0) { BM.puff -= dt; for (let k = 0; k < 4; k++) fx.emit(B.x + (Math.random() - .5) * .3, floors[4].y0 + 1.8, B.front, (Math.random() - .5) * .8, .3 + Math.random() * .6, .8 + Math.random() * 1.2, 2.4, [.78, .8, .8], .3, .55, -.05, .6, 1.5); }
}

/* ── 11. 수영장 · 남/녀 탈의실·샤워실 · 기계실/장비창고 철문 (poolMachineryPatch.js · 사용자 제공) ──
   수영장(별동 6번 층)은 이미 물이 빠진 수조 + 배수구 갈고리 퍼즐(열쇠 조각)이 있어 그 퍼즐은 그대로 둔다.
   · 수조: 클래스의 청록 타일 바닥 · 수면을 기존 수조(8.2 × 13.5m) 크기에 맞춰 바닥과 고인 물(0.3m) 높이에 놓는다
   · 수중등: 점광원 대신 수조 벽의 발광 렌즈 + 청록 빛무리 (장면 조명 수가 바뀌면 모든 셰이더가 다시 컴파일된다)
   · 서쪽 = 남자 탈의실·샤워실, 동쪽 = 여자 탈의실·샤워실 (두 방은 원래 벽으로 완전히 나뉘어 있고 입구도 따로) — 표지판 · 입구 띠 · 가림 발 · 남자 쪽 샤워기
   · 철문: 기계실 입구(홀 북쪽) · 장비창고 입구(기계실 칸막이) — E 로 덜컹거리며 열고 닫는다. 닫히면 막히고, 그것은 문을 쾅 밀어 연다 */
const plP = window.poolAndMachineryPatch; plP.init({ scene, audioCtx: sfxCtx });
const PL = { doors: [], water: null, glows: [], mist: [], dripT: 1, t: 0 };
{
  const F6 = floors[6], R = FLR(6), bx0 = -45.6, bx1 = -37.4, bz0 = 32.0, bz1 = 45.5, WL = -1.3, cx = (bx0 + bx1) / 2, cz = (bz0 + bz1) / 2, wz = 30, zh = 50;
  ['poolTile', 'heavySteelDoor'].forEach(k => srgb(plP.textures[k]));
  // 1) 수조: 클래스 그룹을 수조 가운데로 — 바닥 타일은 수조 바닥 바로 위, 수면은 고인 물 높이
  const pg = adopt(plP.buildSwimmingPoolArea(V3(cx, F6.y0, cz), 0), R); pg.position.set(cx, 0, cz);
  const [pFloor, pWater, ...pSigns] = pg.children;
  pFloor.scale.set((bx1 - bx0) / 8, 1, (bz1 - bz0) / 14); pFloor.position.y = -1.595 - .1;
  plP.textures.poolTile.repeat.set(7, 12);
  pWater.scale.set((bx1 - bx0) / 7.8, (bz1 - bz0) / 13.8, 1); pWater.position.y = WL - .01; pWater.castShadow = false;
  if (world.POOL.water) world.POOL.water.visible = false;   // 기존 탁한 녹색 물 → 클래스의 청록 수면
  { // 일렁이는 물결(코스틱) 발광 무늬 — 매 프레임 흐른다
    const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(120,255,240,.32)'; g.lineWidth = 1.6;
    for (let k = 0; k < 46; k++) { g.beginPath(); let x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y); for (let s = 0; s < 5; s++) { x += (Math.random() - .5) * 60; y += (Math.random() - .5) * 60; g.quadraticCurveTo(x + 10, y - 10, x, y); } g.stroke(); }
    const ct = new THREE.CanvasTexture(c); ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(3, 5);
    Object.assign(pWater.material, { emissive: new THREE.Color(0x2fd8c8), emissiveMap: ct, emissiveIntensity: .35, depthWrite: false }); pWater.material.needsUpdate = true;
    PL.water = { m: pWater.material, ct };
  }
  // 수중등: 수조 긴 벽(동 · 서)에 4개씩 — 발광 렌즈 + 빛무리 (물 바로 아래)
  const lensM = PM(0x9ffff0, .2, .1, { emissive: 0x4ff0e0, emissiveIntensity: 2.2 });
  [bx0 + .02, bx1 - .02].forEach((x, s) => [34, 37.2, 40.4, 43.6].forEach((z, i) => {
    pmesh(new THREE.CircleGeometry(.16, 18), lensM, x, -1.45, z, R, { ry: s ? -Math.PI / 2 : Math.PI / 2, cast: false });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('70,235,220'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .55 }));
    sp.scale.set(2.6, 1.3, 1); sp.position.set(x + (s ? -.5 : .5), -1.35, z); R.add(sp); PL.glows.push({ sp, ph: i * 1.7 + s });
  }));
  // 수조 바닥에서 올라오는 청록 반사광 (넓고 옅게)
  { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('60,220,210'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .22 })); sp.scale.set(9, 4, 1); sp.position.set(cx, -.6, cz); R.add(sp); PL.glows.push({ sp, ph: 0, base: .22 }); }
  // 테두리 습기 안개: 수조 가장자리 낮게 깔린 옅은 김
  for (let k = 0; k < 10; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('200,225,225'), depthWrite: false, transparent: true, opacity: .08 }));
    const e = k % 2 ? bx1 + .2 : bx0 - .2; sp.scale.set(3.4, 1.0, 1); sp.position.set(e, .25, bz0 + 1 + (k >> 1) * 2.9); R.add(sp); PL.mist.push({ sp, z0: sp.position.z, ph: k }); }
  // (예전: 끊어진 레인 줄 토막을 데크에 흩뿌려 두었는데 바닥에 빨간 덩어리가 흩어진 깨진 모델처럼 보여 걷어 냈다)
  // 2) 남/녀 표지판 (클래스 아크릴 표지판을 두 입구 위로 · 글자가 잘리지 않게 다시 그린다) + 입구 색 띠 · 가림 발
  pSigns.forEach((sm, i) => {
    const male = i === 0, c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = male ? '#1a3852' : '#521a28'; g.fillRect(0, 0, 512, 128); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 4; g.strokeRect(6, 6, 500, 116);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 42, 15, 0, 7); g.fill();   // 사람 그림 (남: 몸통 · 여: 치마)
    if (male) g.fillRect(48, 60, 32, 48); else { g.beginPath(); g.moveTo(64, 58); g.lineTo(86, 108); g.lineTo(42, 108); g.closePath(); g.fill(); }
    g.font = `bold 44px ${"'Noto Sans KR',sans-serif"}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(male ? '남자 탈의실 · 샤워실' : '여자 탈의실 · 샤워실', 296, 66);
    sm.material.map = srgb(new THREE.CanvasTexture(c)); sm.material.needsUpdate = true;
    pg.remove(sm); R.add(sm); sm.scale.set(2.2, 1.05, 1); sm.rotation.set(0, 0, 0); sm.position.set(male ? -44.5 : -37.5, 2.82, wz + .3 + .045);
    const ex = male ? -44.5 : -37.5, col = male ? 0x2a60b8 : 0xb82a48;
    pbox(1.62, .07, .03, PM(col, .5, .1, { emissive: col, emissiveIntensity: .15 }), ex, 2.47, wz + .32, R, { cast: false });   // 입구 위 색 띠
    // 가림 발: 출입구 안쪽에 늘어진 비닐 발 (지나갈 수 있다)
    const stripM = PM(male ? 0x9ab8d8 : 0xd8a0b0, .35, 0, { transparent: true, opacity: .42, side: THREE.DoubleSide, depthWrite: false });
    for (let k = 0; k < 7; k++) pmesh(new THREE.PlaneGeometry(.2, 1.9), stripM, ex - .63 + k * .21, 1.43, wz - .02, R, { rz: (Math.random() - .5) * .05, cast: false });
  });
  // 남자 탈의실 샤워 구역: 칸막이벽(동쪽)에 샤워기 2 · 배수구 · 매트 (여자 샤워실엔 원래 부스 6칸)
  const chrome = PM(0xcfd4d6, .18, .95), tileW = PM(0xdfe3e0, .3, .05);
  [26.9, 28.2].forEach(z => {
    pbox(.03, 1.9, 1.15, tileW, -41.665, 1.05, z, R, { cast: false });
    pmesh(mergeGeometries([new THREE.CylinderGeometry(.013, .013, .28, 6).rotateZ(Math.PI / 2).translate(-.14, 2.05, 0), new THREE.CylinderGeometry(.08, .04, .06, 12).rotateZ(Math.PI / 2).translate(-.3, 2.0, 0), new THREE.CylinderGeometry(.012, .012, .22, 6).translate(-.03, 1.1, 0)]), chrome, -41.65, 0, z, R);
    pmesh(new THREE.CircleGeometry(.09, 14), PM(0x2a2c2e, .4, .7), -42.15, .012, z, R, { rx: -Math.PI / 2, cast: false });
  });
  pmesh(new THREE.PlaneGeometry(.75, 2.2), PM(0x2a5ab0, .8), -42.1, .008, 27.55, R, { rx: -Math.PI / 2, cast: false });
  // 젖은 실내화 (두 방 바닥에 뒹군다)
  { const sl = mergeGeometries([new THREE.BoxGeometry(.11, .025, .27).translate(0, .013, 0), new THREE.BoxGeometry(.115, .035, .1).translate(0, .04, .07)]);
    [[-47.9, 26.0, .4, 0x2a4aa0], [-47.6, 26.25, 2.6, 0x2a4aa0], [-43.4, 23.4, 1.2, 0x3a3a3a], [-39.6, 27.4, -.7, 0xc04060], [-39.2, 27.65, 2.0, 0xc04060], [-35.8, 25.5, .2, 0xe8e0d0]].forEach(([x, z, r, c]) =>
      pmesh(sl, PM(c, .15, .05), x, 0, z, R, { ry: r, rz: Math.abs(r) > 2 ? Math.PI : 0 })); }
  PL.drip = { x: -40.5 + 2 * 1.05, y: 2.0, z: 20.58 };   // 여자 샤워실 셋째 칸 — 저절로 물이 뚝뚝
  // 3) 철문 2짝: 클래스 문을 경첩 축 그룹으로 옮겨 실제 출입구 크기로
  const mg = adopt(plP.buildMachineryAndStorageRooms(V3(-40, F6.y0, zh), 0), R);
  const spots = [   // [경첩 x, z, 문 폭, 높이, 닫힌 각도, 열린 각도, 충돌 상자]
    { hx: -40.98, hz: zh + .15, w: 1.96, h: 2.46, c: 0, o: -1.5, col: { x1: -41, x2: -39, z1: zh + .02, z2: zh + .28 } },
    { hx: -43.35, hz: 53.02, w: 1.56, h: 2.36, c: -Math.PI / 2, o: -Math.PI / 2 - 1.5, col: { x1: -43.52, x2: -43.18, z1: 53, z2: 54.6 } },
  ];
  plP.heavyDoors = plP.interactables.filter(d => d.type === 'heavy_door');
  plP.heavyDoors.forEach((d, i) => {
    const S = spots[i], piv = new THREE.Group(); piv.position.set(S.hx, 0, S.hz); piv.userData.dynamic = true; R.add(piv);
    mg.remove(d.mesh); piv.add(d.mesh); d.mesh.scale.set(S.w / 1.2, S.h / 2.2, 1); d.mesh.position.set(S.w / 2, S.h / 2, 0); d.mesh.rotation.set(0, 0, 0);
    const iron = PM(0x2a2e30, .5, .85), rust = PM(0x5a2c16, .85, .4);
    // 원형 핸들 잠금장치 (양면) · 경첩 3개 · 아래쪽 녹 번짐 · 위험 표지
    const wheel = new THREE.Group(); wheel.position.set(S.w - .32, 1.15, 0); piv.add(wheel);
    [-1, 1].forEach(s => { const wg = mergeGeometries([new THREE.TorusGeometry(.17, .022, 8, 22), ...[0, 1.05, 2.1].map(a => new THREE.BoxGeometry(.32, .018, .018).rotateZ(a)), new THREE.CylinderGeometry(.035, .035, .08, 10).rotateX(Math.PI / 2)]);
      pmesh(wg, PM(0xa82018, .45, .55), 0, 0, s * .11, wheel); });
    [.3, S.h / 2, S.h - .3].forEach(y => pcyl(.035, .035, .16, iron, .02, y, 0, piv));
    pbox(S.w * .96, .22, .125, rust, S.w / 2, .12, 0, piv, { cast: false });
    pmesh(new THREE.PlaneGeometry(.55, .2), new THREE.MeshBasicMaterial({ map: makeSign(i ? '장비창고' : '기계실  관계자 외 출입금지', '#c8a018', '#111', 20) }), S.w / 2, 1.75, .065, piv, { cast: false });
    d.isOpen = true; piv.rotation.y = S.o;   // 길을 막지 않게 처음엔 열어 둔다
    const p = fzProp(d, 6, S.hx + Math.cos(S.c) * S.w / 2 + (i ? .55 : 0), S.hz - Math.sin(S.c) * S.w / 2 - (i ? 0 : .55), 1.3, { r: 1.5 });
    const orig = d.onInteract;
    d.onInteract = ctx => { orig(ctx); d.mesh.rotation.set(0, 0, 0); door.target = d.isOpen ? S.o : S.c; door.t = 0; door.jolt = .35; doorLabel(); shake = Math.max(shake, .22); sfx.clank(.8); FL.plDoors = PL.doors.map(q => q.d.isOpen); };
    const door = { d, S, piv, wheel, p, target: S.o, t: 1, jolt: 0 };
    const doorLabel = () => { p.label = `${i ? '장비창고 철문' : '기계실 헤비 스틸 도어'} ${d.isOpen ? '닫기' : '열기'}`; };
    doorLabel(); door.label = doorLabel; PL.doors.push(door);
  });
  mg.parent && mg.parent.remove(mg);
  // 4) 기계실 · 장비창고 소품 보강: 예비 타일 박스 더미 · 깨진 타일 · 소화기
  { const box = PM(0x9a7a50, .9), lab = new THREE.MeshBasicMaterial({ map: makeSign('예비 타일 20×20', '#d8c8a8', '#3a2a1a', 22) });
    [[-48.1, .17, 51.0, .1], [-47.55, .17, 51.15, -.2], [-47.85, .51, 51.05, .35], [-48.25, .17, 51.75, 1.4], [-47.6, .51, 51.2, -.5]].forEach(([x, y, z, r]) => {
      pbox(.5, .34, .38, box, x, y, z, R, { ry: r }); pmesh(new THREE.PlaneGeometry(.36, .1), lab, x + Math.sin(r) * .193, y + .05, z + Math.cos(r) * .193, R, { ry: r, cast: false }); });
    F6.col.push({ x1: -48.55, x2: -47.25, z1: 50.75, z2: 52.0 });
    for (let k = 0; k < 9; k++) pbox(.2, .012, .2, PM(k % 3 ? 0x7aa8b8 : 0xdde2e0, .3), -46.9 + Math.random() * .9, .006, 50.9 + Math.random() * .9, R, { ry: Math.random() * 3, cast: false });
    const ext = new THREE.Group(); ext.position.set(-38.55, 0, 50.6); R.add(ext);
    pcyl(.09, .09, .5, PM(0xc01818, .4, .3), 0, .28, 0, ext); pcyl(.035, .035, .09, PM(0x222222, .5, .6), 0, .58, 0, ext); pbox(.14, .03, .03, PM(0x222222, .5), .05, .64, 0, ext);
    pmesh(new THREE.TorusGeometry(.07, .012, 6, 12, 3), PM(0x111111, .7), .1, .38, 0, ext, { ry: Math.PI / 2 }); }
}
function poolRestore() {
  if (!Array.isArray(FL.plDoors)) return;
  PL.doors.forEach((q, i) => { if (typeof FL.plDoors[i] !== 'boolean') return; q.d.isOpen = FL.plDoors[i]; q.target = q.d.isOpen ? q.S.o : q.S.c; q.piv.rotation.y = q.target; q.t = 1; q.label(); });
  poolCols();
}
function poolCols() {   // 닫힌 철문만 막는다 (플레이어 · 그것의 시야)
  const F6 = floors[6], cs = PL.doors.map(q => q.S.col);
  F6.col = F6.col.filter(r => !cs.includes(r)); F6.walls = F6.walls.filter(r => !cs.includes(r));
  PL.doors.forEach(q => { if (!q.d.isOpen) { F6.col.push(q.S.col); F6.walls.push(q.S.col); } });
}
function poolTick(dt) {
  PL.t += dt; let moved = false;
  PL.doors.forEach(q => {   // 덜컹: 처음 0.35초는 걸쇠가 걸린 듯 덜덜 떨리다가 무겁게 돈다
    if (q.jolt > 0) { q.jolt -= dt; q.piv.rotation.y += (Math.random() - .5) * .03; q.wheel.rotation.z += dt * 9; if (q.jolt <= 0) { const A = at(q.S.hx, floors[6].y0 + 1.2, q.S.hz); A.creak(); } return; }
    const dy = q.target - q.piv.rotation.y; if (Math.abs(dy) > .002) { q.piv.rotation.y += Math.sign(dy) * Math.min(Math.abs(dy), dt * 1.6); moved = true; if (Math.abs(q.target - q.piv.rotation.y) <= .002) { at(q.S.hx, floors[6].y0 + 1.2, q.S.hz).doorBang(0, .8); if (P.floor === 6) shake = Math.max(shake, .25); } }
  });
  if (moved || PL.doors.some(q => q.jolt > 0)) poolCols();
  if (P.floor !== 6 || state !== 'playing') return;
  if (PL.water) { PL.water.ct.offset.set(Math.sin(PL.t * .21) * .08, PL.t * .018); PL.water.m.emissiveIntensity = .3 + Math.sin(PL.t * 1.3) * .08; }
  PL.glows.forEach(g => { g.sp.material.opacity = (g.base || .55) * (.8 + .2 * Math.sin(PL.t * 1.1 + g.ph)); });
  PL.mist.forEach(m => { m.sp.position.z = m.z0 + Math.sin(PL.t * .15 + m.ph) * .6; m.sp.material.opacity = .06 + .03 * Math.sin(PL.t * .4 + m.ph); });
  // 샤워기 물방울 (여자 샤워실 셋째 칸) — 샤워실 근처에서만
  const D = PL.drip; if (Math.hypot(P.x - D.x, P.z - D.z) < 9 && (PL.dripT -= dt) <= 0) { PL.dripT = .9 + Math.random() * 1.6; at(D.x, floors[6].y0 + D.y, D.z).drip(); fx.emit(D.x - .3, floors[6].y0 + 1.95, D.z + .28, 0, -.2, 0, .6, [.7, .85, .9], .4, .03, -9); }
  // 그것은 닫힌 철문을 밀어젖힌다
  const G = ghost; if (G.active && G.floor === 6) PL.doors.forEach(q => { if (!q.d.isOpen && Math.hypot(G.x - (q.S.col.x1 + q.S.col.x2) / 2, G.z - (q.S.col.z1 + q.S.col.z2) / 2) < 1.3) { q.d.isOpen = true; q.target = q.S.o; q.jolt = .2; q.label(); FL.plDoors = PL.doors.map(r => r.d.isOpen); shake = .5; caption('쾅! — 무언가가 철문을 밀어젖혔다'); } });
}

/* ── 12. 교실 리모델링 · 의자에 앉기 (classroomRemodelPatch.js · 사용자 제공) ──
   · 교실별 배치(layoutSeed 1/2/3)는 world.js 의 교실 생성에 붙였다 — 반 이름으로 정해지는 씨앗: 1 기본 · 2 좌우 반전 + 정돈 · 3 폐허(빈 자리 · 쓰러진 의자 · 뒤집힌 책상)
   · 의자: 교실마다 학생 의자 4개 + 교탁 의자에 [E] 앉기 — 시점이 낮아지고, 가만히 앉아 있으면 그것이 멀리서는 알아보지 못한다(3.6m 밖)
     앉아 있는 동안 그것의 발소리가 가깝게 크게 들린다 · W A S D / Space / E 로 일어난다
   · 클래스의 update() 는 프레임마다 keydown 리스너를 새로 붙이므로 쓰지 않고, 같은 동작(이동 키 → standUp)을 게임 입력에 붙였다 */
const crP = window.classroomRemodelPatch; crP.init({ scene, audioCtx: sfxCtx });
['woodFloor', 'chalkboard'].forEach(k => srgb(crP.textures[k]));
const SIT = { chair: null, back: null };
{
  const byRoom = new Map();
  (world.CHAIRS || []).forEach(c => { const k = c.f + ':' + c.room; if (!byRoom.has(k)) byRoom.set(k, []); byRoom.get(k).push(c); });
  byRoom.forEach(list => {
    const st = list.filter(c => !c.teacher && Math.abs(c.z) > 3.3).sort((a, b) => Math.abs(b.z) - Math.abs(a.z) || a.x - b.x), pick = [];   /* 남쪽 방도 (|z|) · 뒷줄 사물함 옆은 뺀다 */
    // 앞 · 뒤 · 창가 · 복도 쪽으로 고르게 4개
    [[0, 0], [.33, 1], [.66, 0], [1, 1]].forEach(([q]) => { const c = st[Math.min(st.length - 1, Math.round(q * (st.length - 1)))]; if (c && !pick.includes(c)) pick.push(c); });
    /* 교탁 의자는 앉기 지점을 두지 않는다 — 교탁 위 이야기 소품(캠코더 등)과 조사 지점이 겹친다 */
    pick.forEach((c, i) => {
      const label = c.teacher ? '교탁 의자' : `${c.room} 교실 의자`;
      const data = { id: `chair_${c.f}_${c.room}_${i}`, type: 'classroom_chair', label, promptText: `[E] ${label}에 앉기 (숨기 / 경계)`, chairGroup: { position: V3(c.x, floors[c.f].y0, c.z) },
        onInteract: () => sitDown(c, data) };
      crP.interactables.push(data);
      fzProp(data, c.f, c.x, c.z, .6, { r: 1.1, chair: true });
    });
  });
}
function sitDown(c, data) {
  if (SIT.chair || P.hiding) return;
  SIT.back = { x: P.x, z: P.z };
  const ref = { position: V3(P.x, floors[P.floor].y0, P.z) };
  crP.sitOnChair(data.chairGroup, ref, m => say(m, 4200));
  P.x = ref.position.x; P.z = ref.position.z; P.crouch = false; P.runOn = false;
  P.yaw = c.teacher ? Math.PI : 0; P.pitch = 0;   // 학생 의자는 칠판 쪽, 교탁 의자는 교실 쪽을 본다
  SIT.chair = c; P.sitting = true; sfx.creak();
}
function standUp() {
  if (!SIT.chair) { P.sitting = false; return; }
  const ref = { position: V3(SIT.back.x, floors[P.floor].y0, SIT.back.z) };
  crP.playerOriginalPos = ref.position.clone(); crP.standUp(ref);
  // 클래스는 원래 자리에서 0.6m 뒤로 비켜선다 — 그 자리가 책상 · 벽이면 원래 자리로
  const F = floors[P.floor], nx = ref.position.x, nz = ref.position.z, hit = r => nx > r.x1 - .25 && nx < r.x2 + .25 && nz > r.z1 - .25 && nz < r.z2 + .25 && !(r.h != null && r.h < .5);
  const ok = !F.col.some(hit);
  P.x = ok ? nx : SIT.back.x; P.z = ok ? nz : SIT.back.z;
  SIT.chair = null; P.sitting = false;
}
function sitTick() {
  if (!SIT.chair) { P.sitting = false; return; }   // 불러온 세이브 등 의자 없이 앉은 상태로 남지 않게
  if (state === 'dead' || P.floor !== SIT.chair.f || P.hiding) { standUp(); return; }
  P.moving = false; P.sprinting = false;
}

/* ── 13. 시야 확대(Z) · 휴대폰 카메라 앨범 · 전화 앱 · 걸려 오는 전화 ──
   · Z 를 누르고 있으면 시야가 천천히 당겨진다 (마우스 감도도 같이 낮아져 멀리 있는 글씨 · 그림자를 살피기 좋다)
   · 야간 카메라로 찍은 장면은 화면 그대로 휴대폰 › 사진 › '내가 찍은 사진' 에 남는다 (최근 12장 · 이 브라우저에 저장)
   · 휴대폰 › 전화: 연락처 · 최근 기록 — 신호가 없으면 대부분 걸리지 않는다 (옥상 안테나로 신호를 잡으면 119 · 집에 걸 수 있다)
   · 이야기 중간중간 전화가 걸려 온다 — P 로 받고, Backspace 로 끊는다. 벨소리를 오래 두면 그것이 소리를 듣고 온다 */
const ZOOM = { k: 0 };
function zoomTick(dt) {
  const want = state === 'playing' && !!keys.KeyZ && !P.hiding && !$('mapOv').classList.contains('show') ? 1 : 0;
  ZOOM.k += (want - ZOOM.k) * Math.min(1, dt * (want ? 4.5 : 7));
  document.body.classList.toggle('zooming', ZOOM.k > .08);
}
// ── 카메라 앨범 ──
const SHOT = { req: false, list: [] };
try { SHOT.list = JSON.parse(localStorage.getItem(SHOTS_KEY) || '[]').slice(-12); } catch (e) { SHOT.list = []; }
function shotGrab() {   // fx.render 바로 뒤 (같은 프레임이라 WebGL 화면을 그대로 읽을 수 있다)
  SHOT.req = false;
  try {
    const src = renderer.domElement, w = 320, h = Math.round(w * src.height / src.width), c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0, w, h);
    g.fillStyle = 'rgba(255,60,60,.9)'; g.font = 'bold 11px monospace'; g.fillText('● REC  ' + clockText(), 8, 15);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText((FLOOR_LABEL[P.floor] || '') + (roomAt(P.floor, P.x, P.z)?.name ? ' · ' + roomAt(P.floor, P.x, P.z).name : ''), 8, h - 8);
    SHOT.list.push({ src: c.toDataURL('image/jpeg', .72), t: clockText(), where: whereText() }); SHOT.list = SHOT.list.slice(-12);
    try { localStorage.setItem(SHOTS_KEY, JSON.stringify(SHOT.list)); } catch (e) { SHOT.list.splice(0, 4); }
    toast('📷 사진 저장', '휴대폰 › 사진 › 내가 찍은 사진', 'opt');
  } catch (e) { console.warn('[shot]', e && e.message); }
}
// ── 전화 통화 시스템 2.0 (실시간 파형 · 통화 타이머 · 쌍방향 응답 · 내선/주파수 다이얼 · 자동 통화 녹음 아카이브) ──
registerLines({
  call_mina1: { spk: 'mina', text: '……여보세요? 들려? 나야, 민아! 아직 학교 안이지? 복도에서 계속 누가 발소리를 내며 걸어 다녀. 내가 나올 때까지 3층 복도 끝은 조심해야 해.' },
  call_mina2: { spk: 'mina', text: '……여보세요? 아직 거기 있어? 방금 본관 뒤쪽 별관 건물에 불이 켜졌어. 아무도 없는 곳인데 누가 켠 거야…… 제발 끊지 마, 나 지금 방송실 장비실 안에 숨어 있어……' },
  call_unk1: { spk: 'junho', text: '……누군지는 묻지 마. 해마다 23시 40분에 나오는 그 방송, 귀신 같은 거 아니야. 방송실 장비실 선반 위를 봐. 타이머가 있을 거야.' },
  call_unk2: { spk: 'guard', text: '학생, 지금 3-2 교실 의자에 앉아 있지? 경비실 CCTV에 다 보여. 그 자리… 하늘이 자리여. 십 년째 아무도 못 치웠어.' },
  call_guard: { spk: 'guard', text: '어이, 학생! 나 경비실이여. 아직도 본관 안에 있는 겨? 해가 다 떨어졌는디 거기 혼자 돌아댕기믄 큰일 나유! 복도에서 무슨 소리가 나도 절대 대답허지 말고, 어서 정문 쪽으로 나와유!' },
  call_home: { spk: 'mom', text: '여보세요? 얘, 너 지금 어디야! 왜 이렇게 전화가 끊겨…… 서문고 앞이라고? 거기 위험하니까 꼼짝 말고 정문 쪽에 나와 있어, 엄마가 지금 바로 갈게!' },
  // 4단계: 은폐를 밝히는 사람들 — 문서에서 번호를 찾으면 연락처가 생긴다 (외부 번호라 신호 필요)
  call_rep_a1: { spk: 'reporter', text: '서문일보 사회부입니다. …서문고요? 그 사건이라면, 십 년 전에 제가 쓴 기사가 하루 만에 내려갔습니다.' },
  call_rep_a2: { spk: 'reporter', text: '증거 없이는 한 줄도 못 씁니다. 학교가 뭘 숨겼는지, 손에 잡히는 걸 가져오세요. 기록이든, 녹화든.' },
  call_rep_a3: { spk: 'reporter', text: '그리고 학생, 거기 오래 있지 말아요. 그 학교는… 아직 그날 밤을 안 끝냈습니다.' },
  call_rep_b1: { spk: 'reporter', text: 'CCTV 캡처라고요? 열쇠를 쥔 교무부장이 문을 안 열었다… 십 년 동안 바로 그 한 장면이 없었어요.' },
  call_rep_b2: { spk: 'reporter', text: '숙직 일지, 장비 수령부, 펌프실 자물쇠까지 모이면 재단도 더는 못 덮습니다.' },
  call_rep_b3: { spk: 'reporter', text: '학생 목소리로, 지금 본 걸 그대로 남겨 두세요. 그게 제일 강한 증언이 됩니다.' },
  call_rep_c1: { spk: 'reporter', text: '들었습니다. 방송이요. 우리 신문사 라디오에서도 잡혔어요. 데스크가 1면을 통째로 비워 두라네요.' },
  call_rep_c2: { spk: 'reporter', text: '십 년 만에 기사 제목을 다시 씁니다. 실종이 아니라, 은폐라고.' },
  call_rep_c3: { spk: 'reporter', text: '고마워요. 그리고… 윤하늘 학생에게도. 이제 집에 갈 수 있겠네요.' },
  call_og1: { spk: 'guard', text: '여보세유? …서문고? 아이고, 이 밤에 그 학교 얘기를 누가 묻는댜.' },
  call_og2: { spk: 'guard', text: '경비실 열쇠함 말이여? 그거 번호는 경비장이 바꾸랬어. 마지막으로 나간 열쇠 시각으로. 장부 보면 나와유.' },
  call_og3: { spk: 'guard', text: '그날 밤 마지막으로 나간 게… 펌프실 열쇠여. 교무부장이 가져가서, 끝내 안 돌려줬지.' },
  call_og4: { spk: 'guard', text: '학생, 그 함 안에 지하실 열쇠도 있을 거여. 내가 못 한 거… 학생이 대신 좀 해 줘유.' },
  call_hr1: { spk: 'homeroom', text: '…네, 하늘이 담임이었던 사람입니다. 이 번호는 어떻게 아셨어요?' },
  call_hr2: { spk: 'homeroom', text: '그 편지요. 끝내 못 부쳤어요. 학교가 결석으로 적으라고 했을 때, 저는 그 칸을 비워 뒀습니다.' },
  call_hr3: { spk: 'homeroom', text: '부탁 하나만 할게요. 출석부 마지막 칸, 하늘이 이름 옆에… 출석이라고 적어 주세요. 저 대신.' },
  call_jh1: { spk: 'junho', text: '…이준호입니다. 이 번호로 전화가 올 줄은 몰랐어요.' },
  call_jh2: { spk: 'junho', text: '잠근 건 저예요. 열쇠는 교무부장님께 드렸고요. 꺼내 주신다고 했어요. 그 말을 믿었어요.' },
  call_jh3: { spk: 'junho', text: '증언이 필요하면 할게요. 제 이름 걸고요. 십 년 동안, 하고 싶었던 말이에요.' },
  call_jh4: { spk: 'junho', text: '하늘이한테… 미안하다고 전해 줄 수 있어요? 저는 아직, 그 이름을 소리 내서 못 부르겠어요.' },
  call_hn1: { spk: 'mother', text: '……방송 들었어요. 우리 하늘이 이름, 끝까지 불러 줬지요.' },
  call_hn2: { spk: 'mother', text: '십 년 동안 아무도 대답해 주지 않았어요. 고마워요. 이제 그 애를… 제대로 보내 줄 수 있겠어요.' },
  // 엄마와의 통화 — 진행에 따라 세 번 (처음 · 증거를 모은 뒤 · 폭로 방송 뒤)
  call_home_a1: { spk: 'mom', text: '여보세요? 얘, 너 지금 어디야! 왜 이렇게 전화가 자꾸 끊겨……' },
  call_home_a2: { spk: 'mom', text: '서문고? 이 밤에 거길 왜 들어가. 거기서 십 년 전에 애 하나 없어졌던 거, 너도 알잖아.' },
  call_home_a3: { spk: 'mom', text: '민아가 거길 왜 들어가…… 알았어. 엄마가 지금 바로 차 끌고 갈게. 정문 쪽에서 절대 움직이지 마.' },
  call_home_a4: { spk: 'mom', text: '그리고 얘…… 누가 이름 불러도 대답하지 마. 그 학교 얘긴…… 아니다. 그냥, 조심해. 알았지?' },
  call_home_b1: { spk: 'mom', text: '또 너구나…… 엄마 지금 고가도로 위야. 비가 와서 차가 꼼짝도 안 해.' },
  call_home_b2: { spk: 'mom', text: '뭐? 그 애가 실종된 게 아니라고? 그때 교장이 뉴스에 나와서 그랬어. 아이가 하교하다가 사라졌다고…… 다들 그 말을 믿었어.' },
  call_home_b3: { spk: 'mom', text: '그게 정말 증거면…… 사진 찍어 둬, 전부. 엄마 친구가 신문사에 있어. 근데 너부터 살아서 나와야 해. 약속해.' },
  call_home_c1: { spk: 'mom', text: '방금 라디오에서…… 네 목소리가 나왔어. 서문고등학교 방송실이라고.' },
  call_home_c2: { spk: 'mom', text: '그 애 엄마도 지금 이 방송을 듣고 있겠지…… 십 년 동안, 얼마나 기다렸을까.' },
  call_home_c3: { spk: 'mom', text: '정문 앞에 경찰차가 와 있어. 천천히, 침착하게 나와. 엄마 여기 있어. 장하다, 우리 애.' },
  // 119 종합상황실 — 처음 신고 · 지하 펌프실 기록을 찾은 뒤
  call_119_a1: { spk: 'dispatcher', text: '네, 119 종합상황실입니다. 신고자분, 천천히 말씀해 주세요.' },
  call_119_a2: { spk: 'dispatcher', text: '이 시간에 서문고등학교 안이요? 전파가 많이 끊깁니다. 지금 다치신 데는 없으십니까?' },
  call_119_a3: { spk: 'dispatcher', text: '위치 추적 들어갑니다. 잠시만요…… 확인됐습니다. 본관 쪽이네요. 서문소방서 구조대에 출동 지시했습니다.' },
  call_119_a4: { spk: 'dispatcher', text: '도착까지 이십 분 정도 걸립니다. 잠긴 공간에는 들어가지 마시고, 휴대폰 배터리를 아끼세요.' },
  call_119_a5: { spk: 'dispatcher', text: '혹시 거기 다른 분도 계십니까? …… 여보세요? 신고자분? 방금 뒤에서 들린 목소리는…… 누구죠?' },
  call_119_b1: { spk: 'dispatcher', text: '네, 상황실입니다. 아까 서문고에서 신고하신 분 맞으시죠? 구조대가 정문 쇠사슬을 끊고 있습니다.' },
  call_119_b2: { spk: 'dispatcher', text: '지하 펌프실이요? 잠시만요…… 1998년 10월 13일 새벽, 같은 학교 같은 장소로 구급 출동 기록이 있네요. 신고는 사고 일곱 시간 뒤에 들어왔습니다.' },
  call_119_b3: { spk: 'dispatcher', text: '그 기록, 저희 쪽에도 남아 있습니다. 경찰에 같이 넘기겠습니다. 지금은 신고자분 안전이 먼저입니다. 정문으로 오세요.' },
  call_119: { spk: 'narrator', text: '119 종합상황실입니다. 전파 상태가 매우 불안정합니다. 이 시간에 서문고등학교 내부라고요? 위치 추적 완료했습니다. 구조대가 정문으로 출동 중이니 즉시 정문 쪽으로 대피하십시오.' },
  call_fail: { spk: 'narrator', text: '지금 거신 전화는 전파 음영 지역이거나 연결할 수 없습니다. 옥상 중계기를 점검하거나 내선 번호를 이용해 주십시오.' },
});
const CONTACTS = [
  { id: 'mina', name: '민아 선배', num: '010-2481-1012', icon: '🎙', role: '서현고 방송부 · 실종' },
  { id: 'guard', name: '정문 경비실', num: '내선 100', icon: '🛡', role: '교내 유선 내선망 (상시 연결)' },
  { id: 'home', name: '집 (엄마)', num: '02-542-3381', icon: '🏠', role: '외부 기지국 신호 필요' },
  { id: '119', name: '119 종합상황실', num: '119', icon: '🚑', role: '긴급 구조 요청 (신호 필요)' },
  { id: 'ext201', name: '4층 방송실 부스', num: '내선 201', icon: '📻', role: '교내 방송국 내선' },
  { id: 'unk', name: '발신번호 표시제한', num: '000-0000-1012', icon: '❓', role: '추적 불가 주파수', hidden: true },
  // 문서에서 번호를 찾으면 생긴다
  { id: 'reporter', name: '서문일보 한진우 기자', num: '02-735-1998', icon: '📰', role: '1998년 기사를 쓴 기자 (신호 필요)', show: () => docs.some(d => ['ts_reporter2', 'n_seomun_ilbo', 'news_rep'].includes(d.id)) || !!FL.newsRead },
  { id: 'oldguard', name: '전 경비원 박종철 (자택)', num: '031-562-0915', icon: '🔦', role: '1998년 당직 경비원 (신호 필요)', show: () => docs.some(d => d.id === 'n_key_ledger') },
  { id: 'homeroom', name: '3-2 담임 정은수 선생님', num: '010-7331-0313', icon: '📚', role: '하늘이의 담임 · 전근 (신호 필요)', show: () => docs.some(d => /^(nv_q5|vo_homeroom_tape|nv_n7)/.test(d.id)) },
  { id: 'junho', name: '이준호 (전 방송부)', num: '010-4120-2250', icon: '🎚', role: '그날 밤 문을 잠근 학생 (신호 필요)', show: () => docs.some(d => /^(nv_q4|ts_junho)/.test(d.id)) },
];
const INCALLS = [
  { id: 'mina1', who: '민아 선배', num: '010-2481-1012', lines: ['call_mina1'], topic: 'mina1', summary: '복도의 발소리 경고 · 4층 방송실 근처', when: () => P.keys >= 1 && FL.cam },
  { id: 'unk1', who: '발신번호 표시제한', num: '— — —', lines: ['call_unk1'], topic: 'unk1', summary: '익명 제보 — 방송실 장비실의 타이머', when: () => P.keys >= 2 && (P.floor === 2 || P.floor === 1 || /^본관 [2-4]층/.test(rbHere())) && !isOutdoors() },
  { id: 'guard', who: '정문 경비실 (내선 100)', num: '내선 100', lines: ['gd_call'], topic: 'guard', summary: '무인 경비실 자동응답기 — 1998년 녹음 · 소리에 대답하지 말 것', when: () => P.keys >= 3 },
  { id: 'mina2', who: '민아 선배', num: '010-2481-1012', lines: ['call_mina2'], topic: 'mina2', summary: '별관 점등 목격 · 방송실 장비실 은신 중', when: () => !!FL.anPow },
  { id: 'unk2', who: '발신번호 표시제한', num: '경비실', lines: ['call_unk2'], topic: 'unk2', summary: '경비실 CCTV — 하늘이의 자리', when: () => !!SIT.chair },
  { id: 'home', who: '집 (엄마)', num: '02-542-3381', lines: ['call_home'], topic: 'home', summary: '정문 앞 대기 당부 · 즉시 출발', when: () => !!FL.sos },
];
const CALL = { ring: null, ringT: 0, bellT: 0, talking: null, talkSec: 0, coolT: 75, log: [], dialBuf: '' };
{
  const st = document.createElement('style');
  st.textContent = `
    #callUI { min-width: 286px; padding: 12px 14px; border-radius: 10px; background: rgba(10,14,22,.95); border: 1px solid rgba(110,160,220,.38); box-shadow: 0 12px 32px rgba(0,0,0,.75); backdrop-filter: blur(8px); }
    #callUI.ring { border-color: #48c878; box-shadow: 0 0 24px rgba(72,200,120,.32), 0 12px 32px rgba(0,0,0,.8); }
    #callUI .cTop { display: flex; align-items: center; gap: 11px; width: 100%; }
    #callUI .cMeta { flex: 1; min-width: 0; }
    #callUI .cMeta b { display: block; font-size: 14px; color: #f2eee6; letter-spacing: .02em; }
    #callUI .cMeta small { display: block; font-size: 11px; color: #8fa4be; margin-top: 1px; }
    #callUI .cWave { display: flex; align-items: flex-end; gap: 3px; height: 18px; padding: 0 4px; }
    #callUI .cWave s { display: block; width: 3px; background: #58d68d; border-radius: 2px; animation: cWaveAnim .65s ease-in-out infinite alternate; }
    #callUI .cWave s:nth-child(2){ animation-delay: .12s } #callUI .cWave s:nth-child(3){ animation-delay: .24s } #callUI .cWave s:nth-child(4){ animation-delay: .08s } #callUI .cWave s:nth-child(5){ animation-delay: .20s }
    @keyframes cWaveAnim { 0% { height: 4px; opacity: .45; } 100% { height: 17px; opacity: 1; } }
    #callUI .cBtns { display: flex; gap: 8px; margin-top: 9px; width: 100%; }
    #callUI .cBtns button { flex: 1; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; border: 1px solid rgba(255,255,255,.18); color: #fff; pointer-events: auto; }
    #callUI .cBtns .ans { background: #1e7e48; border-color: #38b86c; }
    #callUI .cBtns .dec { background: #7a2228; border-color: #b83c44; }
    .pDialBox { background: rgba(16,22,30,.9); border: 1px solid rgba(90,120,150,.3); border-radius: 8px; padding: 9px; margin-bottom: 10px; }
    .pDialRow { display: flex; gap: 6px; margin-bottom: 7px; }
    .pDialRow input { flex: 1; background: #090d12; color: #e8f0f8; border: 1px solid #2c3a48; border-radius: 5px; padding: 6px 9px; font: bold 14px monospace; letter-spacing: .08em; }
    .pDialRow button { background: #1f6f43; color: #fff; border: 1px solid #359c63; border-radius: 5px; padding: 0 12px; font-size: 12px; font-weight: 700; cursor: pointer; }
    .pDialChips { display: flex; gap: 5px; flex-wrap: wrap; }
    .pDialChips span { font-size: 10px; padding: 3px 7px; border-radius: 4px; background: rgba(45,62,80,.55); color: #b8cce0; border: 1px solid rgba(100,130,160,.25); cursor: pointer; }
    .pDialChips span:hover { background: rgba(70,100,135,.75); color: #fff; }
  `;
  document.head.appendChild(st);
}
const callEl = (() => { const d = document.createElement('div'); d.id = 'callUI'; document.body.appendChild(d); return d; })();
function fmtCallSec(s) { const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`; }
function callRender() {
  if (CALL.ring) {
    callEl.innerHTML = `<div class="cTop"><div class="cIco">📞</div><div class="cMeta"><b>${CALL.ring.who}</b><small>${CALL.ring.num || '수신 전화'} · 벨 울리는 중…</small></div></div>
      <div class="cBtns"><button type="button" class="ans" id="cBtnAns">📞 받기 (P)</button><button type="button" class="dec" id="cBtnDec">📵 거절 (⌫)</button></div>
      <i style="width:${Math.max(0, 1 - CALL.ringT / 11) * 100}%"></i>`;
    const bA = document.getElementById('cBtnAns'), bD = document.getElementById('cBtnDec');
    if (bA) bA.onclick = e => { e.stopPropagation(); callAnswer(); };
    if (bD) bD.onclick = e => { e.stopPropagation(); callDecline(false); };
  } else if (CALL.talking) {
    callEl.innerHTML = `<div class="cTop"><div class="cIco on">📞</div><div class="cMeta"><b>${CALL.talking.who}</b><small>통화 중 · ${fmtCallSec(CALL.talkSec || 0)}</small></div>
      <div class="cWave"><s></s><s></s><s></s><s></s><s></s></div></div>
      <div class="cBtns"><button type="button" class="dec" id="cBtnEnd">통화 종료</button></div>`;
    const bE = document.getElementById('cBtnEnd');
    if (bE) bE.onclick = e => { e.stopPropagation(); callHangup(); };
  }
  callEl.classList.toggle('show', !!(CALL.ring || CALL.talking));
  callEl.classList.toggle('ring', !!CALL.ring);
}
function callHangup() {
  if (!CALL.talking) return;
  stopSpeak();
  CALL.talking = null;
  CALL.coolT = 65;
  sfx.beep();
  callRender();
}
function callRing(c) {
  CALL.ring = c; CALL.ringT = 0; CALL.bellT = 0; FL.calls ||= {}; FL.calls[c.id] = 'ring'; callRender();
}
function callAnswer() {
  const c = CALL.ring; if (!c) return; CALL.ring = null; FL.calls[c.id] = 'answered';
  CALL.log.push({ who: c.who, t: clockText(), kind: '수신', lines: c.lines, summary: c.summary || '' });
  callTalk(c.who, c.lines, c.id.startsWith('unk'), c.topic);
}
function callDecline(missed) {
  const c = CALL.ring; if (!c) return; CALL.ring = null; FL.calls[c.id] = 'missed';
  CALL.log.push({ who: c.who, t: clockText(), kind: missed ? '부재중' : '거절', lines: c.lines, summary: c.summary || '음성 사서함 보관됨' });
  callRender();
  if (missed) toast('📵 부재중 전화', `${c.who} — 휴대폰(P) › 전화 탭에서 음성 사서함을 들을 수 있습니다`, 'info'); else sfx.beep();
  CALL.coolT = 60; save(true);
}
async function callTalk(who, ids, creepy, topic = null) {
  CALL.talking = { who }; CALL.talkSec = 0; callRender(); sfx.beep();
  if (creepy) { P.fear = Math.min(1, P.fear + .12); }
  for (const id of ids) {
    const sec = await line(id, 'phone', '📞 ' + who);
    await new Promise(r => setTimeout(r, (sec + .35) * 1000));
    if (!CALL.talking) break;
  }
  // 쌍방향 통화 응답: 주요 통화에서 주인공이 응답하거나 선택지를 고른다
  if (CALL.talking && state === 'playing') {
    if (topic === 'mina1') {
      const i = await choose('📞 민아 선배와 통화 중', '수화기 너머로 민아의 거친 숨소리와 복도 울림이 들린다.', [
        { label: '“선배! 지금 어디예요? 제가 바로 갈게요!”', sub: '민아를 안심시키고 위치 단서를 확인한다' },
        { label: '“소리 내지 말고 숨어 있어요! 절대 대답하지 마요!”', sub: '주변 경계를 당부하고 침착함을 되찾는다 (마음 안정)' }
      ]);
      if (i === 0) { talk('findMina', 3200); addClue('phone1'); }
      else { calmDown(30, '민아에게 숨어 있으라고 당부했다. 호흡을 가다듬자.'); addClue('phone1'); }
    } else if (topic === 'guard') {
      const i = await choose('📞 정문 경비실 자동응답기', '십 년 전 녹음된 경비 아저씨의 응답기 메시지가 끝났다. 테이프 뒷면에 메모 녹음이 이어진다.', [
        { label: '“민아 선배를 찾기 전엔 혼자 못 나가요.”', sub: '결의를 다진다 (마음 안정)' },
        { label: '“열쇠 조각이 잠겨 있어요. 힌트가 없을까요?”', sub: '현재 남은 열쇠 위치에 대한 조언을 듣는다' }
      ]);
      if (i === 0) calmDown(25, '응답기 속 목소리: “정 그라믄 11시 40분 전엔 꼭 나와야 혀!”');
      else toast('응답기 메모 녹음', '“교무실 금고는 오늘 날짜(1012), 도서실 서랍은 머리핀, 수영장 배수구는 긴 갈고리를 써 봐유.”', 'info');
    } else if (topic === 'rep_b') {
      const i = await choose('📞 한진우 기자와 통화 중', '“학생 목소리로 남겨 두세요.”', [
        { label: '“녹음해서 보낼게요. 끝까지 써 주세요.”', sub: '증언 녹음을 약속한다 (엔딩 기사에 반영)' },
        { label: '“아직은… 무서워요. 조금만 더 모을게요.”', sub: '마음을 가라앉힌다' }]);
      if (i === 0) { FL.repRecord = true; toast('📰 증언 약속', '기자에게 증언 녹음을 보내기로 했다.', 'info'); } else calmDown(20, '기자의 차분한 목소리에 숨이 고르게 돌아온다.');
    } else if (topic === 'junho') {
      const i = await choose('📞 이준호와 통화 중', '수화기 너머로 오래 참은 울음이 들린다.', [
        { label: '“증언해 주세요. 하늘이를 위해서요.”', sub: '실명 증언을 부탁한다' },
        { label: '“…당신 잘못만은 아니었어요.”', sub: '그를 위로한다 (마음 안정)' }]);
      if (i === 0) { FL.junhoTestify = true; recordTestimony('이준호'); } else calmDown(25, '“…고마워요.” 짧은 대답 뒤로 숨소리가 잦아든다.');
    } else if (topic === 'homeroom') {
      calmDown(20, '담임 선생님의 부탁이 마음에 남는다. 출석부를 찾아보자.');
    } else if (topic === 'mina2') {
      talk('findMina', 3000);
    } else if (topic === 'home' || topic === '119') {
      calmDown(35, '외부와 통화가 연결되었다는 사실만으로도 숨통이 트인다.');
    }
  }
  if (creepy && CALL.talking) { sfx.stinger(.6); shake = Math.max(shake, .3); caption('뚜— 뚜— 뚜—'); }
  CALL.talking = null; CALL.coolT = 75; callRender(); save(true);
}
function dialNumber(rawNum) {
  const num = String(rawNum || '').replace(/[^0-9]/g, '');
  if (!num) return;
  if (num === '100') { callOut('guard'); return; }
  const known = CONTACTS.find(c => c.show && c.num.replace(/[^0-9]/g, '') === num && c.show()); if (known) { callOut(known.id); return; }
  if (num === '119') { callOut('119'); return; }
  if (num === '201' || num === '01024811012' || num === '2481') {
    if (num === '201') { callOut('ext201'); return; }
    callOut('mina'); return;
  }
  if (num === '302') {
    CALL.log.push({ who: '내선 302 (3-2 교실)', t: clockText(), kind: '발신', lines: [], summary: '1999년 폐쇄된 회선 — 연결되지 않음' });
    closeUI(); say('📞 내선 302 — 1999년에 폐쇄된 회선입니다', 2600); return;
  }
  if (num === '1012') {
    CALL.log.push({ who: '주파수 1012 (기억의 전파)', t: clockText(), kind: '수신', lines: ['tape4'], summary: '윤하늘의 생전 하교 방송 리허설 전파' });
    closeUI(); calmDown(30, '수화기 너머로 10년 전 하늘이의 따뜻한 방송 연습 목소리가 흘러나온다…');
    callTalk('10월 12일의 전파', ['tape4'], false); return;
  }
  if (num.includes('3381')) { callOut('home'); return; }
  closeUI();
  CALL.talking = { who: `발신 (${rawNum})` }; CALL.talkSec = 0; callRender(); sfx.phone();
  setTimeout(() => { line('call_fail', 'phone', '📞 ' + rawNum); setTimeout(() => { CALL.talking = null; callRender(); }, 3500); }, 1200);
}
function callOut(id) {
  if (CALL.talking || CALL.ring) return;
  const c = CONTACTS.find(x => x.id === id) || { id, name: id, num: id };
  closeUI();
  const sig = !!FL.sos;
  if (id === 'unk') {
    CALL.log.push({ who: c.name, t: clockText(), kind: '발신', lines: ['call_unk1'], summary: '익명 제보' });
    callTalk(c.name, ['call_unk1'], true, 'unk1'); return;
  }
  if (id === 'guard') {
    const guardHere = DAY.k > .3 && !FL.night;
    const lines = guardHere ? ['gd_call'] : ['call_unk1'];
    CALL.log.push({ who: c.name, t: clockText(), kind: '발신', lines, summary: guardHere ? '무인 경비실 자동응답기 (1998년 녹음)' : '야간 무인 경비실 수화기 너머의 숨소리' });
    callTalk(c.name, lines, !guardHere, guardHere ? 'guard' : 'unk1'); return;
  }
  if (id === 'ext201') {
    CALL.log.push({ who: c.name, t: clockText(), kind: '발신', lines: ['pa1'], summary: '4층 방송실 부스 내선 모니터' });
    callTalk(c.name, ['pa1'], true); return;
  }
  if (id === '119' && sig) {
    const late = FL.call119 && (P.keys >= 3 || FL.tag), lines = late ? ['call_119_b1', 'call_119_b2', 'call_119_b3'] : ['call_119_a1', 'call_119_a2', 'call_119_a3', 'call_119_a4', 'call_119_a5'];
    CALL.log.push({ who: '119 종합상황실', t: clockText(), kind: '발신', lines, summary: late ? '1998년 펌프실 구급 출동 기록 확인 · 경찰 이관' : '서문고 위치 추적 및 정문 구조대 출동 확인' });
    callTalk('119 종합상황실', lines, false, '119'); FL.call119 = true; return;
  }
  if (id === 'home' && sig) {
    const st = FL.calm || FL.gatePower ? 'c' : P.keys >= 3 ? 'b' : 'a', lines = { a: ['call_home_a1', 'call_home_a2', 'call_home_a3', 'call_home_a4'], b: ['call_home_b1', 'call_home_b2', 'call_home_b3'], c: ['call_home_c1', 'call_home_c2', 'call_home_c3'] }[st];
    CALL.log.push({ who: '집 (엄마)', t: clockText(), kind: '발신', lines, summary: { a: '정문 앞 대기 당부 · 누가 불러도 대답하지 말 것', b: '증거 사진을 찍어 두라는 당부', c: '라디오로 폭로 방송을 들은 엄마' }[st] });
    callTalk('집 (엄마)', lines, false, 'home'); return;
  }
  if (['reporter', 'oldguard', 'homeroom', 'junho'].includes(id) && sig) {
    let lines, summary, topic = id;
    if (id === 'reporter') { const ev = evCount(), st = FL.calm ? 'c' : ev >= 2 ? 'b' : 'a';
      lines = ['call_rep_' + st + '1', 'call_rep_' + st + '2', 'call_rep_' + st + '3']; topic = 'rep_' + st;
      summary = { a: '증거부터 가져오라는 기자', b: `증거 ${ev}건 확인 · 기사화 준비`, c: '폭로 방송 수신 · 1면 기사 확정' }[st]; }
    else if (id === 'oldguard') { lines = ['call_og1', 'call_og2', 'call_og3', 'call_og4']; summary = '열쇠함 번호 = 마지막으로 나간 열쇠 시각 (펌프실 22:50)'; FL.ogHint = true; }
    else if (id === 'homeroom') { lines = ['call_hr1', 'call_hr2', 'call_hr3']; summary = '출석부 마지막 칸에 출석을 적어 달라는 부탁'; FL.hrAsk = true; }
    else { lines = ['call_jh1', 'call_jh2', 'call_jh3', 'call_jh4']; summary = '이준호의 자백 · 실명 증언 의사'; }
    CALL.log.push({ who: c.name, t: clockText(), kind: '발신', lines, summary });
    callTalk(c.name, lines, false, topic); return;
  }
  if (id === 'mina') {
    if (FL.mina) { toast('민아 선배', '선배는 이미 구출되어 내 곁에 있다. 함께 정문으로 나가자.', 'info'); return; }
    if (FL.anPow || (FL.calls && FL.calls.mina1)) {
      const lns = FL.anPow ? ['call_mina2'] : ['call_mina1'];
      CALL.log.push({ who: '민아 선배', t: clockText(), kind: '발신', lines: lns, summary: '교내 미약 전파를 통한 민아와의 통화' });
      callTalk('민아 선배', lns, false, FL.anPow ? 'mina2' : 'mina1'); return;
    }
  }
  CALL.log.push({ who: c.name, t: clockText(), kind: '발신 실패', lines: ['call_fail'], summary: '전파 음영 지역 (연결 실패)' });
  CALL.talking = { who: c.name }; CALL.talkSec = 0; callRender(); sfx.phone();
  setTimeout(() => { line('call_fail', 'phone', '📞 ' + c.name); setTimeout(() => { CALL.talking = null; callRender(); if (!sig) toast('📵 외부 신호 없음', '교내 내선(경비실 100 · 방송실 201)은 연결 가능하며, 외부 통화는 옥상 안테나 복구가 필요합니다.', 'info'); }, 3800); }, 1400);
}
function callTick(dt) {
  if (state !== 'playing') return;
  if (CALL.talking) {
    const prevSec = Math.floor(CALL.talkSec || 0);
    CALL.talkSec = (CALL.talkSec || 0) + dt;
    if (Math.floor(CALL.talkSec) !== prevSec) callRender();
    return;
  }
  if (CALL.ring) {
    CALL.ringT += dt; CALL.bellT -= dt;
    if (CALL.bellT <= 0) {
      CALL.bellT = 1.8; sfx.vibrate(); sfx.phone();
      const G = ghost; if (G.active && G.floor === P.floor && G.state !== 'chase' && Math.hypot(G.x - P.x, G.z - P.z) < 18 && !P.hiding) { G.state = 'search'; G.target = { x: P.x, z: P.z }; G.wait = 0; G.replan = 0; if (!CALL.warned) { CALL.warned = true; caption('벨소리가 복도에 울려 퍼진다…'); } }
    }
    if (P.hiding && CALL.ringT > 1) callDecline(false);
    else if (CALL.ringT > 11) callDecline(true);
    callRender(); return;
  }
  if ((CALL.coolT -= dt) > 0) return;
  const G = ghost; if (G.active && G.floor === P.floor && G.state === 'chase') return;
  const c = INCALLS.find(c => !(FL.calls && FL.calls[c.id]) && c.when());
  if (c) callRing(c); else CALL.coolT = 12;
}
function renderCallTab(B) {
  const rec = (FL.calls && Object.keys(FL.calls).some(k => k.startsWith('unk')));
  const vm = INCALLS.filter(c => FL.calls && FL.calls[c.id] === 'missed');
  B.innerHTML = `<div class="pCall">
    <div class="pDialBox">
      <div class="pCHead" style="margin-top:0">다이얼 키패드 <em>${FL.sos ? '📶 옥상 중계기 연결됨' : '📵 외부 음영 · 내선망 연결'}</em></div>
      <div class="pDialRow">
        <input id="pDialIn" type="text" placeholder="번호 입력 (예: 100, 201, 119, 1012)" value="${CALL.dialBuf || ''}" maxlength="16">
        <button type="button" id="pDialGo">📞 통화</button>
      </div>
      <div class="pDialChips">
        <span data-num="100">#100 경비실</span>
        <span data-num="201">#201 방송실</span>
        <span data-num="302">#302 3-2교실</span>
        <span data-num="119">#119 구조대</span>
        <span data-num="1012">#1012 기억주파수</span>
      </div>
    </div>
    ${vm.length ? `<div class="pCHead">📼 미확인 음성 사서함 (${vm.length})</div>` + vm.map(c => `<button data-vm="${c.id}">▶ ${c.who} (${c.num || ''})<small>부재중 녹음 메시지 재생 · ${c.summary || ''}</small></button>`).join('') : ''}
    <div class="pCHead">연락처 목록</div>
    ${CONTACTS.filter(c => c.show ? c.show() : (!c.hidden || rec)).map(c => `<button data-c="${c.id}">${c.icon} ${c.name} <em style="font-style:normal;opacity:.65;font-size:11px">(${c.num})</em><small>${c.role || ''}</small></button>`).join('')}
    <div class="pCHead">통화 기록 & 자동 녹음 아카이브</div>
    ${CALL.log.length ? CALL.log.slice(-8).reverse().map((l, idx) => `<div class="pLog" style="display:flex;align-items:center;justify-content:space-between;gap:6px"><div><b>[${l.kind}] ${l.who}</b><span>${l.t}${l.summary ? ' · ' + l.summary : ''}</span></div>${l.lines && l.lines.length ? `<button type="button" data-replay="${CALL.log.length - 1 - idx}" style="padding:3px 8px;font-size:11px;background:#1c2836;color:#9cd0ff;border:1px solid #385270;border-radius:4px;cursor:pointer;white-space:nowrap">▶ 녹음 듣기</button>` : ''}</div>`).join('') : '<div class="pEmpty">통화 기록이 없습니다.</div>'}
  </div>`;
  const dIn = document.getElementById('pDialIn'), dGo = document.getElementById('pDialGo');
  if (dIn) {
    dIn.oninput = () => { CALL.dialBuf = dIn.value; };
    dIn.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') dialNumber(dIn.value); };
  }
  if (dGo) dGo.onclick = () => dialNumber(dIn ? dIn.value : CALL.dialBuf);
  B.querySelectorAll('.pDialChips span[data-num]').forEach(sp => {
    sp.onclick = () => { CALL.dialBuf = sp.dataset.num; if (dIn) dIn.value = sp.dataset.num; dialNumber(sp.dataset.num); };
  });
  B.querySelectorAll('button[data-c]').forEach(b => { b.onclick = () => callOut(b.dataset.c); });
  B.querySelectorAll('button[data-vm]').forEach(b => {
    b.onclick = () => { const c = INCALLS.find(x => x.id === b.dataset.vm); if (!c) return; FL.calls[c.id] = 'heard'; closeUI(); callTalk(c.who + ' (음성 사서함)', c.lines, c.id.startsWith('unk'), c.topic); };
  });
  B.querySelectorAll('button[data-replay]').forEach(b => {
    b.onclick = () => { const entry = CALL.log[+b.dataset.replay]; if (!entry || !entry.lines) return; closeUI(); callTalk(entry.who + ' (통화 녹음)', entry.lines, false); };
  });
}
function shotsHtml() {
  return SHOT.list.length ? `<div class="pCHead">📷 내가 찍은 사진 <em>${SHOT.list.length} / 12</em></div><div class="pPhotos">${SHOT.list.slice().reverse().map(s => `<img src="${s.src}" alt="" data-t="${s.t} · ${s.where}">`).join('')}</div>` : '';
}

/* ── 14. 서브 유령 8종 (subGhostSystem.js · 사용자 제공 시트지 엔진) ──
   · 시트지 이미지(assets/img/sub_ghost_sheet.webp 또는 .png)가 있을 때만 구역 유령 8명을 배치한다
     (없으면 클래스의 절차적 실루엣으로만 그려져 품질이 떨어지므로 배치하지 않고, T 메뉴 테스트 스폰으로만 확인)
   · 클래스의 점광원(오라)은 빛무리 스프라이트로 바꾼다 · 장면 좌표(층 y0 기준)에 그대로 둔다 (빌보드가 카메라 높이를 쓴다)
   · 평소 슬픔/무표정/울음/공허 → 손전등을 똑바로 비추거나 2.3m 안으로 오면 비명/소름 + 손 뻗기 → 근접 연출(공포 +22 · 대사) → 사라짐
   · 설정 › 접근성 › 점프 스케어 '약하게'면 전체 화면 클로즈업 없이 소리 · 자막만 */
const sgP = null;
const SG = { ready: false, sheet: false, list: [], spawned: false };
const SG_ZONES = [
  { id: 'sg_class', ch: [2, 2], aggro: false, f: 2, x: -9.5, z: -5.6, outfit: 'default_uniform', exp: 'blank', anim: 'idle', prop: 'sketchbook', beh: 'haunt', line: '다들... 여기 있어... 내 자리 지우지 마...' },
  { id: 'sg_corr', ch: [3, 3], aggro: false, f: 1, x: 14, z: 0, outfit: 'white_dress', exp: 'empty', anim: 'float', prop: null, beh: 'haunt', line: '집에 갈 시간이 지났는데...' },
  { id: 'sg_toilet', ch: [1, 3], aggro: false, f: 0, x: -30.6, z: -3.4, outfit: 'bloody_uniform', exp: 'crying', anim: 'behind_you', prop: null, beh: 'mirror', line: '거울 속에... 내가 안 보여...' },
  { id: 'sg_stairs', ch: [4, 5], aggro: true, f: 1, x: 1.6, z: -6.2, outfit: 'old_uniform', exp: 'sad', anim: 'idle', prop: null, beh: 'stairs_ambush', line: '위층엔... 아무도 없어...' },
  { id: 'sg_art', ch: [3, 4], aggro: false, f: 10, x: 1.5, z: -7.4, outfit: 'art_apron', exp: 'blank', anim: 'idle', prop: 'palette', beh: 'art_event', line: '빨간색이... 아직 부족해...' },
  { id: 'sg_music', ch: [3, 4], aggro: false, f: 10, x: -7.4, z: -7.8, outfit: 'umbrella_girl', exp: 'sad', anim: 'idle', prop: 'doll', beh: 'haunt', line: '피아노... 같이 칠래...?' },
  { id: 'sg_gym', ch: [3, 4], aggro: false, f: 5, x: 34, z: 26, outfit: 'gym_suit', exp: 'empty', anim: 'idle', prop: 'schoolbag', beh: 'haunt', line: '체육 시간... 끝났어...?' },
  { id: 'sg_roof', ch: [5, 6], aggro: false, f: 3, x: -10, z: -7.5, outfit: 'rooftop_suicide', exp: 'sad', anim: 'idle', prop: 'umbrella', beh: 'haunt', line: '아래에서... 누가 내 이름을 불렀어...' },
  { id: 'sg_pool', ch: [5, 5], aggro: false, f: 6, x: -43, z: 30.9, outfit: 'white_dress', exp: 'sad', anim: 'idle', prop: null, beh: 'haunt', line: '물이... 아직도 차가워...' },   // 3D 모델 전용 (사용자 제공 수영장 유령)
];
registerLines(Object.fromEntries(SG_ZONES.map(z => ['sg_' + z.id, { spk: 'ghost', text: z.line }])));
// 귀신 삭제: 구역 유령 8종은 만들지 않는다 (SG.ready 가 false 라 관련 처리는 모두 건너뛴다)
function sgSpawn(z, pos) { return null;   // 설정 변경: 유령 폐기 — 서브 유령은 만들지 · 불러오지 않는다

  const pre = !pos && SG.pool && SG.pool[z.id];   // 미리 만들어 둔 유령을 꺼낸다
  if (pre) { delete SG.pool[z.id]; pre.root.visible = true; sgP.ghostInstances.push(pre); SG.list.push(pre); sg3dAttach(pre); return pre; }
  const F = floors[z.f], g = sgP.spawnGhostNPC({ id: z.id, position: pos || V3(z.x, F.y0, z.z), outfitKey: z.outfit, expressionKey: z.exp, animState: z.anim, propKey: z.prop, behavior: z.beh, dialogue: z.line });
  if (!g) return null;
  // 점광원 → 차가운 빛무리 (클래스는 ghostLight.intensity 만 바꾼다)
  g.root.remove(g.ghostLight);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('120,160,210'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .35 }));
  glow.scale.set(1.6, 2.4, 1); glow.position.set(0, 1.1, 0); g.root.add(glow);
  let v = .45; g.ghostLight = { get intensity() { return v; }, set intensity(x) { v = x; glow.material.opacity = x / .45 * .35; } };
  g.root.traverse(o => { o.userData.dynamic = true; });
  g.setAnimationPose('idle');
  g.f = z.f; g.zone = z; SG.list.push(g); sg3dAttach(g); return g;
}
// 이야기 장(章)마다 정해진 유령만 나온다 — 한꺼번에 1~3명 · 장이 지나면 조용히 사라지고, 마지막 장(제6장)이 끝나면 아무도 남지 않는다
// 모든 구역 유령은 이야기 증언자다: 다가가거나 비추면 한마디를 남기고 사라진다.
function sgSpawnZones() { return;   // 설정 변경: 유령 폐기

  if (!SG.ready || !SG.sheet || state !== 'playing') return;
  const now = performance.now(); if (now - (SG.chkT || 0) < 1000) return; SG.chkT = now;   // 1초마다
  FL.sgSeen ||= {}; const ch = objective().ch, end = state === 'win';
  SG_ZONES.forEach(z => {
    const on = !end && ch >= z.ch[0] && ch <= z.ch[1], g = SG.list.find(q => q.zone && q.zone.id === z.id && !q.test);
    if (on && !g && !FL.sgSeen[z.id]) { const n = sgSpawn(z); if (n) { n.passive = true; n.isTriggered = true; n.behavior = 'haunt'; n.setAnimationPose('idle'); } }
    else if (!on && g && g.behavior !== 'fading_out') g.behavior = 'fading_out';   // 장이 지나면 사라진다
  });
}
function sgPassiveMeet(g) {   // 공격성 없는 유령: 슬픈 얼굴로 한마디 → 연기처럼 사라짐 (공포 약간)
  if (g.met) return; g.met = true; FL.sgSeen[g.zone.id] = true;
  g.setExpression(Math.random() < .5 ? 'crying' : 'sad'); g.setAnimationPose('fade');
  sgSub(g)('???', g.zone.line); P.fear = Math.min(1, P.fear + .06); sfx.stinger(.25);
  setTimeout(() => { g.behavior = 'fading_out'; }, 1600);
}
function sgTestSpawn() { return;   // T 메뉴: 플레이어 앞 반원에 8종을 늘어놓는다 (근접 연출은 하지 않는다)
  if (!SG.ready) { toast('서브 유령', '아직 불러오는 중', 'info'); return; }
  sgP.ghostInstances.filter(g => g.test).forEach(g => { scene.remove(g.root); sgP.ghostInstances.splice(sgP.ghostInstances.indexOf(g), 1); });   // 이전 테스트 유령은 지운다
  const F = floors[P.floor], fx0 = -Math.sin(P.yaw), fz0 = -Math.cos(P.yaw), sx = Math.cos(P.yaw), sz = -Math.sin(P.yaw);
  const mid = (SG_ZONES.length - 1) / 2;
  SG_ZONES.forEach((z, i) => { const s = (i - mid) * 1.15, d = 4.2 + Math.abs(i - mid) * .2;
    const g = sgSpawn({ ...z, id: 'test_' + z.id + '_' + Date.now(), beh: 'test' }, V3(P.x + fx0 * d + sx * s, F.y0, P.z + fz0 * d + sz * s));
    if (g) { g.test = true; g.isTriggered = true; g.setExpression(['sad', 'blank', 'crying', 'empty', 'scream', 'creepy', 'angry', 'neutral'][i]); } });
  toast('서브 유령 8종 테스트', SG.sheet ? '복장 · 표정 · 소품 확인 (근접 연출 없음)' : '시트지 이미지가 없어 절차적 실루엣으로 표시 — assets/img/sub_ghost_sheet.webp 를 넣으면 시트지 그림으로', 'info');
}
const sgSub = g => (who, text) => { const id = 'sg_' + (g.zone && SG_ZONES.some(z => z.id === g.zone.id) ? g.zone.id : ''); if (lineInfo(id)) line(id, 'none', '???'); else subtitle('???', text, 3.2); };
function sgTick(dt) { return;   // 설정 변경: 유령 폐기

  if (!SG.ready) return;
  sgSpawnZones();
  if (!SG.list.length) return;
  const cl = document.getElementById('patch-subghost-closeup'); if (cl) cl.style.display = SET.jump === 'full' ? '' : 'none';   // 점프 스케어 '약하게': 클로즈업 이미지 없이
  const y0 = floors[P.floor].y0, fx0 = -Math.sin(P.yaw) * Math.cos(P.pitch), fz0 = -Math.cos(P.yaw) * Math.cos(P.pitch);
  // Looking at a witness reveals their testimony; no lunge or attack pose.
  if (P.light && P.battery > 0 && state === 'playing') SG.list.forEach(g => {
    if (g.met || g.test || g.f !== P.floor) return;
    const dx=g.root.position.x-P.x, dz=g.root.position.z-P.z, d=Math.hypot(dx,dz);
    if(d>.5 && d<9 && (dx*fx0+dz*fz0)/d>.978 && los(floors[P.floor].walls,P.x,P.z,g.root.position.x,g.root.position.z)) sgPassiveMeet(g);
  });
  SG.list.forEach(g => { if (g.passive && !g.met && g.f === P.floor && Math.hypot(g.root.position.x - P.x, g.root.position.z - P.z) < 3) sgPassiveMeet(g); });
  // 다른 층 유령은 멀리 둔 것처럼 (클래스는 3D 거리로 판정한다 — 층마다 y0 가 달라 위아래 층은 저절로 멀다)
  const before = new Set(SG.list.filter(g => g.isTriggered));
  sgP.update(dt, V3(P.x, y0, P.z), m => say(m, 3000), (w, t) => { const g = SG.list.find(q => q.isTriggered && !before.has(q)); if (g) sgSub(g)(w, t); else subtitle('???', t, 3.2); });
  SG.list.forEach(g => { if (g.isTriggered && !before.has(g) && g.zone && FL.sgSeen) { FL.sgSeen[g.zone.id] = true; fx.glitch(.4); shake = Math.max(shake, .35); setFace('fear', 2.5); } });
  for (let i = SG.list.length - 1; i >= 0; i--) if (!sgP.ghostInstances.includes(SG.list[i])) SG.list.splice(i, 1);
  // 층에 따라 보이기 (다른 층 유령이 바닥 · 천장을 뚫고 보이지 않게)
  SG.list.forEach(g => { g.root.visible = g.f === P.floor && !(RBG && g.f === 0 && RBG.inside(g.root.position.x, g.root.position.z)); });   // 새 건물: 예전 건물 땅에 서 있던 유령은 감춘다
  sg3dTick(dt);
}

/* ── 14-b. 서브 유령 3D 모델 (사용자 제공 .blend 7종 → GLB, tools/ghost_blend_to_glb.py) ──
   · 옥상 · 수영장 · 음악실 · 미술실 · 화장실 · 복도 · 교실 유령은 시트지 그림(빌보드) 대신 3D 모델로 보인다 (체육관 · 계단 유령은 그대로 시트지)
   · 원본은 리깅 · 애니메이션이 없는 정지 모델이라 움직임은 코드로: 플레이어 쪽으로 천천히 고개(몸)를 돌림 · 숨 · 미세한 흔들림 ·
     손전등에 비치면 앞으로 기울며 떨림 · 사라질 때 깜빡이며 투명해짐. 차가운 자체광을 약하게 넣어 어둠 속에서도 형체가 보인다
   · 모델은 그 유령이 나올 장(章)이 가까워지면 미리 받아 두고, 받기 전에는 시트지 그림으로 보인다 */
const SG3D_FILE = { sg_roof: 'rooftop', sg_pool: 'pool', sg_music: 'music', sg_art: 'art', sg_toilet: 'restroom', sg_corr: 'corridor', sg_class: 'classroom' };
const SG3D = { cache: new Map(), loader: new GLTFLoader() };
const sg3dKey = g => g.zone && SG3D_FILE[g.zone.id.replace(/^test_(sg_[a-z]+)_\d+$/, '$1')];
function sg3dLoad(name) { return Promise.resolve(null);   // 설정 변경: 유령 폐기 — 서브 유령은 만들지 · 불러오지 않는다

  let p = SG3D.cache.get(name);
  if (!p) {
    p = SG3D.loader.loadAsync(`assets/characters/ghosts/${name}.glb`).then(async gl => {
      gl.scene.traverse(o => { if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = false;
        const m = o.material; if (m.map) { srgb(m.map); m.map.anisotropy = 16; m.emissiveMap = m.map; }
        m.emissive = new THREE.Color(0x8fa4c0); m.emissiveIntensity = m.map ? .22 : .08; m.side = THREE.DoubleSide; });
      // 처음 나타날 때 셰이더 컴파일로 화면이 멈칫하지 않게: 받자마자 보이지 않는 곳에서 미리 컴파일 · 텍스처 업로드
      await textureBudget.prepare(gl.scene);
      gl.scene.traverse(o => { if (o.isMesh && o.material.map) renderer.initTexture(o.material.map); });
      const tmp = gl.scene.clone(true); tmp.position.set(0, -500, 0); scene.add(tmp);
      const compile = Promise.resolve();
      return compile.catch(() => {}).then(() => { scene.remove(tmp); return gl.scene; });
    }).catch(e => { console.warn('[SubGhost3D]', name, e && e.message); return null; });
    SG3D.cache.set(name, p);
  }
  return p;
}
function sg3dAttach(g) {
  const name = sg3dKey(g); if (!name || g.model3d !== undefined) return;
  g.model3d = null;
  sg3dLoad(name).then(src => {
    if (!src || !g.root.parent) return;
    const m = src.clone(true), mats = [];
    m.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); mats.push(o.material); o.userData.dynamic = true; } });
    m.scale.setScalar(.95); g.root.add(m); g.model3d = m; g.mats3d = mats; g.yaw3d = null;
    [g.mainPlane, g.volumeCore, g.faceOverlay, g.propMesh].forEach(o => { if (o) o.visible = false; });
  });
}
function sg3dTick(dt) {
  // 다음 장에 나올 유령 모델을 미리 받아 둔다
  if (SG.sheet !== undefined && state === 'playing') { const ch = objective().ch; SG_ZONES.forEach(z => { if (SG3D_FILE[z.id] && ch + 1 >= z.ch[0] && ch <= z.ch[1]) sg3dLoad(SG3D_FILE[z.id]); }); }
  SG.list.forEach(g => {
    const m = g.model3d; if (!m) return;
    // 숨겨 둔 빌보드를 클래스가 다시 보이게 해도(표정 · 동작 바꿈) 3D 모델만 보이게
    [g.mainPlane, g.faceOverlay, g.propMesh].forEach(o => { if (o) o.visible = false; });
    const t = performance.now() / 1000 + (g.phase || 0), dx = camera.position.x - g.root.position.x, dz = camera.position.z - g.root.position.z;
    const want = Math.atan2(dx, dz); if (g.yaw3d == null) g.yaw3d = want;
    let d = want - g.yaw3d; d = Math.atan2(Math.sin(d), Math.cos(d)); g.yaw3d += d * Math.min(1, dt * (g.litT ? 6 : .9));   // 천천히 돌아본다
    const lit = !!g.litT || g.animState === 'attack', fade = g.behavior === 'fading_out';
    m.rotation.set(lit ? .16 : Math.sin(t * .7) * .012, g.yaw3d, Math.sin(t * .9) * .018);
    m.position.set(lit ? Math.sin(t * 41) * .012 : 0, Math.sin(t * 1.3) * .012, lit ? Math.cos(t * 37) * .01 : 0);
    m.scale.set(.95, .95 * (1 + Math.sin(t * 1.9) * .006), .95);
    let op = fade ? Math.max(0, g.opacity) : 1;
    if (g.animState === 'fade' || fade) op *= .75 + .25 * Math.sin(t * 23) * Math.sin(t * 7.3);   // 깜빡이며 옅어짐
    else if (Math.sin(t * .37) > .985) op *= .55;                                                // 가끔 지직— 흐려짐
    g.mats3d.forEach(mt => { if (!mt.transparent) { mt.transparent = true; mt.needsUpdate = true; } mt.opacity = op; mt.depthWrite = op > .5; });   // 투명 여부를 매번 바꾸면 깜빡일 때마다 셰이더 재컴파일 → 끊김. 처음 한 번만 투명으로 고정
  });
}

/* ── 15. 본관 18실 · 별관 19실 (37개 특별실 · 보조실) 가구 · PBR · 동선 (school37RoomsPatch.js · 사용자 제공) ──
   · 37개 방은 모두 이미 맵에 있다 (본관 B1 4 · 1층 6 · 2층 4 · 3층 4 · 별관 1층 7 · 2층 6 · 3층 6) — 방마다 populateRoomByType 으로 이름에 맞는 가구를 채운다
   · 겹침 방지: 배치 전에 그 방의 기존 가구 충돌 상자 · 아이템 · 조사 지점 · 사물함 · 그것의 이동 경로 점을 roomOccupancyMap 에 먼저 등록하고,
     실제 문 위치(문 목록)를 doors 로 넘겨 문 앞 1.65m · 가운데 통로는 클래스의 _canPlaceFurniture 가 비운다 (자리가 없으면 클래스가 그 가구를 건너뛴다)
   · 남쪽 방은 그룹을 180° 돌려 클래스의 '뒷벽(−z)'이 복도 반대쪽이 되게 한다
   · 새 가구의 바닥 상자는 게임 충돌(벽 타고 미끄러지는 기존 충돌)에 넣고, 클래스의 resolvePlayerMovementCollision 도 매 프레임 이동 뒤에 부른다
   · 클래스의 상호작용(promptText 만 있음)은 방 성격대로 실제 동작에 연결: 커튼 침대 숨기 · 소파 숨 고르기(공포 −15%) · 피아노 · 밸브(소리로 그것 유인) · 선반 수색(소모품) · 서류 읽기 · 단말기 · 수도 · 가마 */
const s37 = window.school37RoomsPatch; s37.init({ scene, audioCtx: sfxCtx });
// Use the installed PBR pack on furniture too; keep display/label artwork on
// its own materials rather than spreading a coarse colour atlas over a room.
for (const [key,source] of [['mahogany','wood'],['oakWood','wood'],['stainless','paint'],['industrialBlue','paint'],['industrialRed','paint']]) {
  const t=pbr(source,()=>null),m=s37.materials[key];if(!t||!m)continue;
  m.map=t.map;m.normalMap=t.normalMap;m.roughnessMap=t.roughnessMap;m.normalScale.set(.2,.2);m.roughness=Math.max(.55,m.roughness);m.needsUpdate=true;
}
s37.materials.glassCase.metalness = .05;
// 방 성격과 안 맞는 클래스 기본 가구를 그 방에 맞는 것으로 바꾼다 (클래스 코드는 그대로 두고, 그 방을 지을 동안만 프리팹 함수를 갈아 끼운다)
//   청소도구실의 가스 조리대 → 대걸레 싱크 · 음악실의 어학 부스 → 보면대 · 드럼 · 동아리실(사진부)의 그랜드 피아노 → 앨범 · 장비 선반
const RB = (() => {
  const G = () => new THREE.Group(), B = (g, w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  const C = (g, r1, r2, h, x, y, z, m, n = 16) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, n), m); c.position.set(x, y, z); g.add(c); return c; };
  const conc = PM(0x8c8a84, .9), steel = PM(0xb8bec2, .3, .8), dark = PM(0x24262a, .6, .4), wood = PM(0x6a4a30, .7), blue = PM(0x2a5a9a, .6), white = PM(0xe4e2dc, .5), red = PM(0xa82a2a, .5), glass = PM(0x9ab8c8, .1, .2, { transparent: true, opacity: .45 });
  return {
    mopSink() { const g = G(); B(g, 1.0, .5, .6, 0, .25, 0, conc); B(g, .86, .06, .46, 0, .48, 0, dark); C(g, .02, .02, .35, 0, .7, -.22, steel); B(g, .2, .03, .03, 0, .86, -.13, steel);
      C(g, .19, .16, .34, .75, .17, .05, PM(0xd8b020, .6)); C(g, .012, .012, 1.3, .62, .65, -.18, wood).rotation.z = .2; B(g, .3, .06, .1, .5, .03, -.18, PM(0xd0d0c8, .9)); return g; },
    musicStands() { const g = G(); [-.7, 0, .7].forEach(x => { C(g, .012, .012, 1.1, x, .55, 0, dark); B(g, .45, .32, .02, x, 1.15, .02, dark).rotation.x = -.35; });
      C(g, .25, .25, .32, 1.15, .4, .1, white); C(g, .26, .26, .03, 1.15, .57, .1, red); C(g, .16, .16, .18, .85, .62, .05, white); C(g, .2, .2, .02, .95, 1.05, -.1, PM(0xc8a040, .3, .8)); C(g, .01, .01, .5, .95, .8, -.1, steel); return g; },
    clubShelf() { const g = G(); B(g, 1.6, 1.8, .4, 0, .9, 0, wood); for (let k = 0; k < 4; k++) B(g, 1.5, .02, .36, 0, .3 + k * .45, .02, PM(0x4a3020, .7));
      [[-.5, .5, blue], [-.2, .5, red], [.3, .95, white], [.5, 1.4, dark]].forEach(([x, y, m]) => B(g, .25, .3, .3, x, y, .03, m)); B(g, .35, .22, .25, -.4, 1.42, .05, dark); C(g, .05, .05, .12, -.25, 1.42, .1, glass); return g; },
    // 요리실 · 세척실: 초음파 세척기 + 식기 건조대 (예전엔 보건실 시력검사표 · UV 소독기가 그대로 붙었다)
    sonicWasher() { const g = G(); B(g, 1.2, .9, .6, -.3, .45, 0, steel); B(g, 1.0, .05, .45, -.3, .91, .02, PM(0x6a8a9a, .05, .3, { transparent: true, opacity: .7 })); B(g, .3, .15, .05, -.3, .7, .31, dark);
      B(g, .7, .6, .35, .7, 1.25, -.1, steel); for (let k = 0; k < 6; k++) C(g, .09, .09, .01, .45 + k * .1, 1.25, -.05, white, 20).rotation.x = Math.PI / 2; return g; },
    // 실습 · 과학 준비실: 시약 카트 + 액체질소 듀어 병
    labCart() { const g = G(); B(g, 1.0, .05, .5, -.3, .85, 0, steel); B(g, 1.0, .05, .5, -.3, .35, 0, steel); [-.75, .15].forEach(x => [-.22, .22].forEach(z => C(g, .015, .015, .85, x, .43, z, steel)));
      [-.6, -.4, -.2].forEach((x, i) => C(g, .04, .05, .18, x, .97, 0, [glass, PM(0x7ab05a, .2, 0, { transparent: true, opacity: .6 }), glass][i]));
      C(g, .2, .2, .9, .6, .45, 0, steel, 20); C(g, .07, .07, .12, .6, .96, 0, dark); B(g, .02, .25, .2, .81, .5, 0, PM(0x2a7ac8, .5)); return g; },
    // 회의실 · 학생회실: 빔 프로젝터 스크린 + 방송 콘솔 (예전엔 서버 랙)
    projector() { const g = G(); B(g, 1.7, 1.1, .02, 0, 1.75, 0, white); B(g, 1.8, .08, .08, 0, 2.33, .02, dark); B(g, .9, .8, .5, 0, .4, .3, wood);
      B(g, .35, .12, .28, 0, .86, .3, dark); C(g, .04, .04, .03, 0, .86, .45, glass).rotation.x = Math.PI / 2; B(g, .2, .02, .14, .3, .81, .3, dark); return g; },
  };
})();
const RB_S37 = { 청소도구실: { _prefabCookingStation: RB.mopSink }, 음악실: { _prefabLanguageBoothRow: RB.musicStands }, 동아리실: { _prefabGrandPiano: RB.clubShelf } };
const RB_N37 = { 요리실: { _buildUVSterilizerAndEyeChart: RB.sonicWasher }, '요리실(101)': { _buildUVSterilizerAndEyeChart: RB.sonicWasher }, 세척실: { _buildUVSterilizerAndEyeChart: RB.sonicWasher },
  실습준비실: { _buildUVSterilizerAndEyeChart: RB.labCart }, 과학준비실: { _buildUVSterilizerAndEyeChart: RB.labCart }, 회의실: { _buildServerRackAndUPS: RB.projector }, 학생회실: { _buildServerRackAndUPS: RB.projector } };
function roomSwap(obj, fnName, table) { const orig = obj[fnName].bind(obj); obj[fnName] = a => { const sw = table[a.roomName] || {}, keep = {}; for (const k in sw) { keep[k] = obj[k]; obj[k] = sw[k]; } try { return orig(a); } finally { Object.assign(obj, keep); } }; }
roomSwap(s37, 'populateRoomByType', RB_S37);
Object.values(s37.textures).forEach(srgb);
const S37 = { rooms: [], props: [], placed: 0, skipped: 0 };
const S37_LIST = { 4: ['청소도구실', '기계실 (보일러)', '펌프실', '창고'], 0: ['상담실', '교사 휴게실', '보건실'], 1: ['회의실', '2층 홀', '교사 휴게실', '상담실'], 2: ['3층 홀', '교사 휴게실', '상담실'],
  8: ['상담실', '요리실', '기술·가정실 (102)', '보건실 보조', '공구실', '인쇄실', '진로상담실 (104)', '세척실'], 9: ['언어실 (202)', '스마트교실 (203)', '과학 준비실', '디지털실습실', '기록 보관실', '동아리실 (204)'], 10: ['공예실', '창의융합실 (103)', '시청각실', '학생회실', '열람실', '작업실'] };
const S37_TYPE = { '기계실 (보일러)': '기계실', '창고': '시설창고실', '자재실 · 창고': '시설창고실', '시설 창고': '시설창고실', '보건실 보조': '보건실보조', '교사 휴게실': '교사휴게실', '2층 홀': '2층홀', '3층 홀': '3층홀', '실습 준비실': '실습준비실', '자재 창고': '자재창고', '진로상담실 (104)': '진로상담실', '창의융합실 (103)': '창의융합실(103)', '요리실': '요리실(101)', '요리실 (101)': '요리실(101)', '과학 준비실': '과학준비실', '언어실 (202)': '언어실', '교재 창고': '교재창고실', '스마트교실 (203)': '스마트교실', '동아리실 (204)': '동아리실', '음악실': '음악실', '음악실 (301)': '음악실', '전시 공간': '전시공간', '공예실': '공예실', '공예실 (303)': '공예실' };
{
  const RW = 7.6, RD = 7.5, _mFootByFloor = {};
  const getFloorModelRects = f => _mFootByFloor[f] || (_mFootByFloor[f] = world.MODELS.filter(m => m.f === f).map(modelFootprint).filter(b => b && b.y1 < 1.8 && b.y2 > .1));
  Object.entries(S37_LIST).forEach(([fs, names]) => {
    const f = +fs, F = floors[f]; if (!F) return;
    const an = f >= 8, north = an ? ANNEX.floors[f - 8] : LAYOUT[f], south = an ? ANNEX_S[f - 8] : LAYOUT_S[f], sl = an ? ANNEX.slots : SLOTS;
    const rooms = []; north && north.names.forEach((n, i) => rooms.push({ n, cx: sl[i], s: 1 })); south && south.names.forEach((n, i) => rooms.push({ n, cx: sl[i], s: -1 })); if (an) rooms.push({ n: ['세척실', '화장실', '작업실'][f - 8], cx: 24, s: -1 });
    names.forEach(nm => {
      const R = rooms.find(r => r.n === nm); if (!R) { console.warn('[37실] 방 없음', f, nm); return; }
      const cx = R.cx, s = R.s, cz = -s * 5.675, key = `${f}:${cx}:${s}`;
      const toL = (x, z) => [(x - cx) * s, (z - cz) * s], inR = (x, z) => Math.abs(x - cx) < 3.9 && Math.abs(z - cz) < 3.9;
      // 1) 기존 점유 등록: 가구 충돌 상자(방 둘레 벽은 빼고) · 아이템 · 조사 지점 · 사물함 · 그것의 경로 점
      const occ = [];
      F.col.forEach(c => { const x = (c.x1 + c.x2) / 2, z = (c.z1 + c.z2) / 2; if (!inR(x, z)) return; const w = c.x2 - c.x1, d = c.z2 - c.z1; if (F.walls.includes(c) && Math.max(w, d) > 2) return; const [lx, lz] = toL(x, z); occ.push({ x: lx, z: lz, w, d }); });
      // Decorative models & uncollided furniture without colliders still occupy visual space.
      getFloorModelRects(f).forEach(b => { if (b.y1 > 1.7) return; const x=(b.x1+b.x2)/2,z=(b.z1+b.z2)/2;if(!inR(x,z))return;const [lx,lz]=toL(x,z);occ.push({x:lx,z:lz,w:b.x2-b.x1,d:b.z2-b.z1}); });
      (F.furnOcc || []).forEach(fo => { if (!inR(fo.x, fo.z)) return; const [lx, lz] = toL(fo.x, fo.z); occ.push({ x: lx, z: lz, w: fo.w, d: fo.d }); });
      const pt = (x, z, r = .8) => { if (inR(x, z)) { const [lx, lz] = toL(x, z); occ.push({ x: lx, z: lz, w: r, d: r }); } };
      world.items.forEach(it => it.floor === f && pt(it.pos.x, it.pos.z));
      world.props.forEach(p => p.floor === f && pt(p.x, p.z));
      world.lockers.forEach(l => l.floor === f && pt(l.x, l.z));
      (F.nodes || []).forEach(n => pt(n.x, n.z, .9));
      s37.roomOccupancyMap.set(key, occ);
      // 2) 문: 문 목록에서 이 방 쪽 문을 찾는다 (홀처럼 트인 방은 개구부 전체)
      let doors = world.doorList.filter(d => d.floor === f && Math.abs(d.x - cx) < 3.5 && Math.sign(d.z) === -s).map(d => ({ x: (d.x - cx) * s, z: RD / 2 }));
      if (/홀|전시/.test(nm)) doors = [-2.4, -1.2, 0, 1.2, 2.4].map(x => ({ x, z: RD / 2 }));
      if (!doors.length) doors = [{ x: 0, z: RD / 2 }];
      const before = s37.walkableColliders.length, beforeI = s37.interactables.length;
      const g = s37.populateRoomByType({ roomKey: key, roomName: S37_TYPE[nm] || nm, centerPos: V3(cx, F.y0, cz), roomW: RW, roomD: RD, doors });
      if (!g) return;
      FLR(f).add(g); g.position.set(cx, 0, cz); g.rotation.y = s > 0 ? 0 : Math.PI;
      g.traverse(o => { o.userData.dynamic = true; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.updateMatrixWorld(true);
      // 3) 새 가구 바닥 상자 → 게임 충돌 (실제 좌표)
      const cols = s37.walkableColliders.slice(before);
      cols.forEach(c => {
        if (Math.abs(c.localZ - RD / 2) < 1.85 && Math.abs(c.localX) < 1.55) return;
        const x = cx + c.localX * s, z = cz + c.localZ * s;
        F.col.push({ x1: x - c.width / 2, x2: x + c.width / 2, z1: z - c.depth / 2, z2: z + c.depth / 2, s37: true });
      });
      S37.placed += cols.length;
      S37.rooms.push({ f, name: nm, cx, cz, s, g, placed: cols.length });
      // 4) 상호작용 → 게임 조사 지점
      s37.interactables.slice(beforeI).forEach((it, k) => {
        const wp = new THREE.Vector3(); it.mesh.getWorldPosition(wp); const x = wp.x, z = wp.z;
        const data = { id: `s37_${f}_${cx}_${s}_${k}`, promptText: it.promptText, onInteract: ctx => s37Act(p, ctx) };
        const p = fzProp(data, f, x + (cx - x) * .25, z + (cz - z) * .25, 1.0, { r: 1.7, s37: true, room: nm });
        if (/숨기/.test(it.promptText)) { const L = { floor: f, x, z, y: F.y0, dir: { x: Math.sign(cx - x) || 1, z: 0 }, noPick: true, label: '커튼 침대에 숨기' }; world.lockers.push(L); p.hide = L; }
        S37.props.push(p);
      });
    });
  });
  console.info(`[37실] 방 ${S37.rooms.length}개 · 새 가구 ${S37.placed}개 배치 (겹치거나 동선을 막는 자리는 건너뜀)`);
}
const infirmaryExtraSlots = [], infirmaryCabinetViews = []; for (const room of S37.rooms.filter(r => r.name === "보건실")) room.g.traverse(holder => { const kind = holder.userData.infirmaryKind; if (!kind) return; const fallback = new THREE.Group(); fallback.userData.dynamic = true; const old = [...holder.children].filter(o => !(kind === "bed" && o.geometry?.type === "PlaneGeometry")); holder.add(fallback); old.forEach(o => fallback.add(o)); const id = "nurse-s37-" + kind + "-" + infirmaryExtraSlots.length; if (kind === "cabinetOpen") { const closedHolder = new THREE.Group(), openHolder = new THREE.Group(); closedHolder.userData.dynamic = openHolder.userData.dynamic = true; openHolder.visible = false; holder.add(closedHolder, openHolder); const closedId = id + "-closed", openId = id + "-open", prop = S37.props.find(p => p.room === "보건실" && /약품장/.test(p.fz.promptText)); infirmaryExtraSlots.push({ id: closedId, kind: "cabinetClosed", holder: closedHolder, fallback }, { id: openId, kind: "cabinetOpen", holder: openHolder, fallback: null }); infirmaryCabinetViews.push({ closedId, openId, closedHolder, openHolder, fallback, getOpen: () => !!prop?.done }); } else infirmaryExtraSlots.push({ id, kind, holder, fallback }); }); const infirmaryAssets = installInfirmaryAssets({ renderer, scene, camera, slots: [...(world.INFIRMARY_SLOTS || []), ...infirmaryExtraSlots], batchOpaque: true }); window.__infirmaryAssets = infirmaryAssets; function syncInfirmaryCabinets() { updateInfirmaryCabinets(infirmaryCabinetViews, infirmaryAssets.records); } infirmaryAssets.ready.then(async records => { await textureBudget.prepare(scene); syncInfirmaryCabinets(); const bad = records.filter(r => r.status === "error"); if (bad.length) console.warn("[infirmary]", bad.map(r => [r.id, r.error?.message])); }); async function s37Act(p, ctx) {
  const t = p.fz.promptText, F = floors[p.floor], pos = V3(p.x, F.y0 + 1, p.z);
  if (/숨기/.test(t) && ctx.togglePlayerHide) { ctx.togglePlayerHide(); return; }
  if (/숨 고르기/.test(t)) { if ((p.restT || 0) > performance.now()) { say('아직 숨이 진정되지 않았다 — 조금 뒤에 다시', 2200); return; } p.restT = performance.now() + 60000; P.fear = Math.max(0, P.fear - .15); sfx.breath ? sfx.breath() : sfx.click(); say('소파에 기대 숨을 골랐다 — 공포가 조금 가라앉는다', 3000); return; }
  if (/피아노/.test(t)) { sfx.musicBox ? sfx.musicBox(2.5, .8) : sfx.stinger(.4); caption('쾅— 건반 소리가 건물 전체에 울려 퍼진다'); fzLure(pos, 26); return; }
  if (/밸브/.test(t) && !p.solved) { const r = await mini('pipes', { title: `${p.room} — 증기 배관 압력 빼기` }); if (!r.ok) { sfx.boom ? sfx.boom() : sfx.bang(); P.fear = Math.min(1, P.fear + .12); fzLure(pos, 30); say('펑— 배관이 터지며 증기가 쏟아진다. 소리가 퍼졌다', 3000); return; } p.solved = true; }
  if (/밸브/.test(t)) { const A = at(p.x, F.y0 + 1.2, p.z); A.pipeKnock ? A.pipeKnock() : A.thump(); shake = Math.max(shake, .25); caption('배관이 쿵쿵 울린다'); fzLure(pos, 18); return; }
  if (/수색|뒤지기|탐색|파밍|약품장/.test(t)) {
    if (p.done) return;
    if (p.floor === 4) { const r = await mini('maze', { title: `${p.room} — 어둠 속 선반 사이`, item: '물건' }); if (!r.ok) {  P.fear = Math.min(1, P.fear + .2); sfx.stinger(.5); shake = Math.max(shake, .4); say('어둠 속에서 길을 놓쳤다 — 다시 방향을 살펴보자', 2600); refreshHud(); return; } }   // B1: 손전등 미로
    p.done = true; syncInfirmaryCabinets(); FL.s37 ||= {}; FL.s37[p.uid] = 1;
    const loot = ['battery', 'candy', 'medkit', 'hairpin', 'candy', 'thermos'][Math.floor(Math.random() * 6)];
    giveItem(loot, 1, true); sfx.pickup(); lootCard(loot, '수색', ITEMS[loot].name, `${p.room}에서 찾았다`); refreshHud(); return;
  }
  if (/전원/.test(t) && !p.solved) { const r = await mini('rings', { title: `${p.room} — 단말기 잠금 해제` }); if (!r.ok) { sfx.buzz(); say('삐— 잠금이 다시 걸렸다', 2000); return; } p.solved = true; giveItem('battery', 1, true); lootCard('battery', '단말기', ITEMS.battery.name, '보조 전원함에서 꺼냈다'); }
  if (/전원/.test(t)) { sfx.click(); fx.glitch(.2); say('지직— 꺼져 있던 화면에 한 줄이 떠올랐다: "아직 수업 중"', 3600); return; }
  if (/수도/.test(t)) { sfx.drip(); say('녹물이 콸콸 쏟아지다가 뚝 멈췄다', 2800); return; }
  if (/전시|작품|명패/.test(t)) { say('유리 너머 상패 — 수상자 이름 한 줄만 날카롭게 긁혀 지워져 있다', 3600); return; }
  if (/가마|물레/.test(t)) { say('가마 안에 굳은 점토 인형 하나 — 누군가 이름을 새겨 두었다. "하늘"', 3800); return; }
  if (!p.solved) {
    const rm = p.room || '';
    const mKind = /학생회|교장|회의|인쇄/.test(rm) ? 'stampApprove'
      : /도서|열람|창고|보관/.test(rm) ? 'libraryCatalog'
      : /방송|어학|언어|시청각|음악/.test(rm) ? 'cassetteSplice'
      : /과학|보건|요리|기술/.test(rm) ? 'microscopeSlide'
      : /동아리|미술|공예|창의|진로/.test(rm) ? 'timetableRestore'
      : 'omrGrade';
    const r = await mini(mKind, { title: rm + ' — 1998.10.12 학교 기록 복원' });
    if (r.ok) {
      p.solved = true; P.fear = Math.max(0, P.fear - .12);
      say(rm + ' — 1998년 10월 12일 밤의 조작된 학교 기록을 복원해 숨겨진 진실 한 조각을 확인했다', 4200);
      return;
    }
  }
  say(`${p.room} — 서류는 모두 10월 12일에서 멈춰 있다`, 3400);
}
function s37Tick() { syncInfirmaryCabinets();   // 클래스의 미끄러짐 충돌 보정 (게임 충돌 다음 · 같은 층 가구만)
  if (state !== 'playing' || P.hiding || !S37.placed || Math.abs(P.z) < 1.65) return;
  const y0 = floors[P.floor].y0, pp = V3(P.x, y0, P.z); s37.resolvePlayerMovementCollision(pp, .3);
  if (pp.x !== P.x || pp.z !== P.z) { P.x = pp.x; P.z = pp.z; }
}
function s37Restore() { if (FL.s37) S37.props.forEach(p => { if (FL.s37[p.uid]) p.done = true; }); }

/* ── 16. 37개 구역 신규 특수 설비 · 벽면 레일 (new37UniquePatch.js · 사용자 제공) ──
   · 방마다 buildNewUniqueRoom(그 방 이름) → 벽면 레일(북 · 동 · 서)에만 붙이고 방 가운데는 비운다 (클래스가 문 앞 1.8m 를 건너뛴다)
   · 겹침 방지: 이미 있는 가구 · 아이템 · 조사 지점 · 사물함 · 문과 바닥 상자가 겹치는 설비는 빼낸다 (같은 레일 자리에 37실 가구가 먼저 놓였을 수 있다)
   · 남은 설비의 바닥 상자는 게임 충돌(벽 타고 미끄러짐)에 넣는다 — 클래스의 미끄러짐 보정과 같은 효과. 송풍기 날개는 매 프레임 update(dt) 로 돈다
   · 점광원(UV 소독기 · 암실 안전등)은 셰이더 재컴파일 · 끊김을 피하려고 같은 색 빛무리로 바꾼다
   · 상호작용: 클래스의 알림 · 소음 유인에 더해 실제 효과 — 자판기 스태미나 · UPS 배터리 충전 · 소독기 공포 감소 · 징 · 할로겐 그것 경직 (쿨다운) */
const n37 = window.new37UniquePatch; n37.init({ scene, audioCtx: sfxCtx });
roomSwap(n37, 'buildNewUniqueRoom', RB_N37);
Object.values(n37.textures).forEach(srgb);
const N37 = { rooms: [], props: [], placed: 0, removed: 0, cd: {} };
{
  const RW = 7.6, RD = 7.5;
  Object.entries(S37_LIST).forEach(([fs, names]) => {
    const f = +fs, F = floors[f]; if (!F) return;
    const an = f >= 8, north = an ? ANNEX.floors[f - 8] : LAYOUT[f], south = an ? ANNEX_S[f - 8] : LAYOUT_S[f], sl = an ? ANNEX.slots : SLOTS;
    const rooms = []; north && north.names.forEach((n, i) => rooms.push({ n, cx: sl[i], s: 1 })); south && south.names.forEach((n, i) => rooms.push({ n, cx: sl[i], s: -1 })); if (an) rooms.push({ n: ['세척실', '화장실', '작업실'][f - 8], cx: 24, s: -1 });
    names.forEach(nm => {
      const R = rooms.find(r => r.n === nm); if (!R) return;
      const cx = R.cx, s = R.s, cz = -s * 5.675, type = S37_TYPE[nm] || nm;
      let doors = world.doorList.filter(d => d.floor === f && Math.abs(d.x - cx) < 3.5 && Math.sign(d.z) === -s).map(d => ({ x: (d.x - cx) * s, z: RD / 2 }));
      if (/홀|전시/.test(nm)) doors = [-2.4, -1.2, 0, 1.2, 2.4].map(x => ({ x, z: RD / 2 }));
      if (!doors.length) doors = [{ x: 0, z: RD / 2 }];
      const c0 = n37.railColliders.length, i0 = n37.interactables.length;
      const g = n37.buildNewUniqueRoom({ roomName: type, centerPos: V3(0, 0, 0), roomW: RW, roomD: RD, doors });
      if (!g) return;
      scene.remove(g); FLR(f).add(g); g.position.set(cx, 0, cz); g.rotation.y = s > 0 ? 0 : Math.PI; g.updateMatrixWorld(true);
      // 점광원 → 빛무리
      const pls = []; g.traverse(o => { if (o.isPointLight) pls.push(o); });
      pls.forEach(l => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex(`${(l.color.r * 255) | 0},${(l.color.g * 255) | 0},${(l.color.b * 255) | 0}`), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .5 })); sp.scale.setScalar(1.6); sp.position.copy(l.position); l.parent.add(sp); l.parent.remove(l); });
      g.traverse(o => { o.userData.dynamic = true; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      // 겹침 검사 (월드 바닥 상자)
      const B = new THREE.Box3(), rectOf = m => { B.setFromObject(m); return { x1: B.min.x, x2: B.max.x, z1: B.min.z, z2: B.max.z }; };
      const modelRects = [...(floors[f]._cachedModelRects || (floors[f]._cachedModelRects = world.MODELS.filter(m=>m.f===f).map(modelFootprint).filter(b=>b&&b.y1<1.8&&b.y2>.1))), ...(F.furnOcc||[]).map(fo=>({x1:fo.x-fo.w/2,x2:fo.x+fo.w/2,z1:fo.z-fo.d/2,z2:fo.z+fo.d/2}))];
      const hits = (r, pad = .05) => F.col.some(c => !(F.walls.includes(c) && Math.max(c.x2 - c.x1, c.z2 - c.z1) > 2) && c.x1 < r.x2 - pad && c.x2 > r.x1 + pad && c.z1 < r.z2 - pad && c.z2 > r.z1 + pad)
        || modelRects.some(b => overlaps(r,b,.08))
        || [...world.items.filter(it => it.floor === f).map(it => [it.pos.x, it.pos.z]), ...world.props.filter(p => p.floor === f).map(p => [p.x, p.z]), ...world.lockers.filter(l => l.floor === f).map(l => [l.x, l.z]), ...world.doorList.filter(d => d.floor === f).map(d => [d.x, d.z])]
          .some(([x, z]) => x > r.x1 - .45 && x < r.x2 + .45 && z > r.z1 - .45 && z < r.z2 + .45);
      const cols = n37.railColliders.slice(c0), its = n37.interactables.slice(i0), keep = new Set();
      // 겹치면 같은 벽의 다른 자리 → 다른 벽(북 · 서 · 동) 순서로 옮겨 본다 (문 앞 1.8m · 방 가운데 통로는 그대로 비운다)
      const relocate = c => { const m = c.mesh, ry = m.rotation.y, side = Math.abs(Math.sin(ry)) > .5, pw = side ? c.d : c.w, pd = side ? c.w : c.d, M = .14;
        for (const wall of ['W', 'E']) for (const off of [0, -1.2, 1.2, -2.0, 2.0]) {
          let x = 0, z = 0, r = 0;
          if (wall === 'N') { x = off; z = -RD / 2 + pd / 2 + M; } else if (wall === 'W') { x = -RW / 2 + pd / 2 + M; z = off; r = Math.PI / 2; } else { x = RW / 2 - pd / 2 - M; z = off; r = -Math.PI / 2; }
          if ((wall === 'N' ? Math.abs(x) + pw / 2 : Math.abs(z) + pw / 2) > (wall === 'N' ? RW : RD) / 2 - .15) continue;
          if (doors.some(d => Math.hypot(x - d.x, z - d.z) < 1.8)) continue;
          if (Math.abs(wall === 'N' ? z : x) - pd / 2 < .8) continue;
          m.position.set(x, 0, z); m.rotation.y = r; g.updateMatrixWorld(true);
          const rr = rectOf(m); if (!hits(rr)) return rr;
        }
        return null; };
      cols.forEach(c => { let r = rectOf(c.mesh); if (hits(r)) r = relocate(c); if (!r) { c.mesh.parent && c.mesh.parent.remove(c.mesh); N37.removed++; return; }
        const col = { ...r, n37: true }; F.col.push(col); c.rect = col; keep.add(c.mesh); N37.placed++; });
      its.forEach((it, k) => {
        if (!it.mesh.parent) return;   // 겹쳐서 빠진 설비
        const wp = new THREE.Vector3(); it.mesh.getWorldPosition(wp);
        const data = { id: `n37_${f}_${cx}_${s}_${k}`, promptText: it.promptText, onInteract: () => {} };
        const p = fzProp(data, f, wp.x + (cx - wp.x) * .3, wp.z + (cz - wp.z) * .3, 1.0, { r: 1.8, n37: true, room: nm, type });
        data.onInteract = () => n37Act(p, it, cols.find(c => c.mesh === it.mesh));
        N37.props.push(p);
      });
      N37.rooms.push({ f, name: nm, type, g, placed: cols.filter(c => keep.has(c.mesh)).length });
    });
  });
  console.info(`[신규37] 방 ${N37.rooms.length}개 · 설비 ${N37.placed}개 배치 · 겹쳐서 뺀 설비 ${N37.removed}개`);
}
function n37Act(p, it, col) {
  const now = performance.now(), cd = (k, sec) => { if ((N37.cd[k] || 0) > now) { say('아직 쓸 수 없다 — 잠시 뒤에', 1800); return false; } N37.cd[k] = now + sec * 1000; return true; };
  const t = p.type, pos = V3(p.x, floors[p.floor].y0 + 1, p.z);
  if (/UPS/.test(it.promptText) && !cd('ups' + p.uid, 120)) return;
  if (/자판기/.test(it.promptText) && !cd('vend' + p.uid, 90)) return;
  if (/소독기/.test(it.promptText) && !cd('uv' + p.uid, 90)) return;
  if (/징/.test(it.promptText) && !cd('gong', 45)) return;
  if (/할로겐/.test(it.promptText) && !cd('halo' + p.uid, 60)) return;
  it.onInteract({ notify: m => say(m.replace(/^\S+\s/, ''), 4200), alertMonster: (q, r) => fzLure(pos, r) });
  // 실제 효과
  if (/UPS/.test(it.promptText)) { P.battery = 100; P.pbat = 100; refreshHud(); }
  else if (/자판기/.test(it.promptText)) { P.stamina = 100; P.tired = false; }
  else if (/소독기/.test(it.promptText)) { P.fear = Math.max(0, P.fear - .3); }
  else if (/징/.test(it.promptText)) { if (ghost.active && ghost.floor === p.floor) stunGhost(4, '징의 공명에 그것이 귀를 막고 굳어 버렸다'); shake = Math.max(shake, .35); }
  else if (/할로겐/.test(it.promptText)) { fx.lightning(); if (ghost.active && ghost.floor === p.floor && Math.hypot(ghost.x - p.x, ghost.z - p.z) < 12) stunGhost(3, '눈부신 빛에 그것이 뒤로 물러난다'); }
  else if (/집수정/.test(it.promptText) && !p.got) { p.got = true; FL.n37 ||= {}; FL.n37[p.uid] = 1; giveItem('battery', 1, true); lootCard('battery', '집수정', ITEMS.battery.name, '방수 케이스 안에 들어 있었다'); }
  else if (/모빌랙/.test(it.promptText) && col && col.rect) { const r = new THREE.Box3().setFromObject(col.mesh); Object.assign(col.rect, { x1: r.min.x, x2: r.max.x, z1: r.min.z, z2: r.max.z }); if (!p.got) { p.got = true; FL.n37 ||= {}; FL.n37[p.uid] = 1; giveItem('medkit', 1, true); lootCard('medkit', '모빌랙 뒤', ITEMS.medkit.name, '서가 뒤 벽 틈에 끼워져 있었다'); } }
}
function n37Restore() { if (FL.n37) N37.props.forEach(p => { if (FL.n37[p.uid]) p.got = true; }); }

/* ── 17. 메가 익스팬션 · 엔진 최적화 · 1998 사건 기록 (megaExpansionPatch.js · 사용자 제공) ──
   · 캠퍼스 확장: 별관 뒤 북쪽(담장 z −33 → −64)에 ① 대강당 겸 실내체육관(18 × 26m · 층고 7.2m — 벽 · 지붕 · 출입구는 연결 코드가 짓는다)
     ② 중앙 중정(창립자 석상 정원). ③ 지하 보존서고(방공호 · 12 × 20m)는 B1 복도 북쪽 방공호 통로로 들어간다 (B1 좌표계 안, 본관 밑 바깥)
   · 최적화: 클래스의 청크 컬링(34m 밖 · 다른 층 방 가구 그룹 숨김)에 37실 · 신규 37실 · 확장 구역 그룹을 등록.
     단, 클래스의 '그림자 자동 갱신 끄기'(손전등 그림자가 멈춘다)와 '점광원 켜고 끄기 풀링'(켤 때마다 셰이더 재컴파일 → 끊김)은 이 게임과 맞지 않아 끈다
     (이 게임은 이미 점광원 대신 빛무리 · 발광 메시를 쓰고, 픽셀 비율은 설정 › 그래픽 해상도가 정한다)
   · 1998 사건 기록 (4막 · 실종 학생 명찰 12 · 카세트테이프 6): 37실 · 확장 구역 곳곳에 배치, J 키 사건 기록 도감 (목표 바 키는 O 로 옮김)
     테이프는 기존 자막 · 더빙으로 녹취록을 들려준다. 명찰 12개를 모두 모아 탈출하면 TRUE END「모든 영혼의 구원」
   · 미니게임: 복도 배전반 → 전압 동기화(바늘을 초록 구간에 3번 · 빗나가면 스파크 소음), 대강당 단상 · 별관 어학실 → 주파수 동조(98.4MHz) */
const megaP = window.megaSchoolPatch;
megaP._applyRendererPerformanceTuning = () => {};                 // 손전등 그림자 · 해상도 설정을 지킨다
megaP._scanAndPoolExistingLights = function () { this.managedLights = []; };   // 점광원 풀링 끔 (재컴파일 끊김)
megaP.init({ scene, camera, renderer, audioCtx: sfxCtx });
const MEGA_Z = { act: 1 };
const megaFz = (i0, f, extra = {}) => megaP.interactables.slice(i0).map((it, k) => {
  const wp = new THREE.Vector3(); it.mesh.getWorldPosition(wp);
  const data = { id: `mega_${it.id || k}`, promptText: it.promptText, onInteract: () => {} };
  const p = fzProp(data, f, wp.x, wp.z, wp.y - floors[f].y0, { r: 1.8, mega: true, mesh: it.mesh, ...extra });
  data.onInteract = async () => {
    if (it.id === 'gym_stage_podium') {
      const r = await mini('tune', { title: '대강당 단상 방송 콘솔 — 98.4MHz 비상 주파수 & 안테나 위상 동조', label: '…교장실 액자 뒤 금고… 코드는 개교기념일…' });
      if (r.ok) { megaP.advanceStoryAct(2, m => megaNotify(m)); megaNotify('📻 [주파수 98.4MHz 동조 성공] 스피커에서 교장실 비밀 금고 힌트와 함께 실종 사건의 진실이 흘러나옵니다!'); }
      return;
    }
    if (it.id === 'courtyard_founder_statue') {
      const r = await mini('rings', { title: '중정 창립자 석상 — 3중 동심원 석상 암호 해독' });
      if (r.ok) { megaNotify('🗝 석상 받침대 비밀 홈이 열리며 [1998년 카세트테이프 #5]와 비상 배터리를 획득했습니다!'); megaP.collectLoreItem('tape', 'tape_05', m => megaNotify(m)); giveItem('battery', 1, true); refreshHud(); }
      return;
    }
    it.onInteract({ notify: m => megaNotify(m) });
    if (it.id && it.id.startsWith('collect_')) p.done = true;
  };
  return p;
});
function megaNotify(m) { const t = String(m).split('\n'); say(t[0].replace(/^\S+\s/, ''), 4200); }
{
  const F0 = floors[0], O = world.OUT, G = MEGA.gym, C = MEGA.court;
  const facTpl = world.guardRoom?.templates?.wall;
  const wallM = facTpl ? facTpl.clone() : PM(0x867e74, .86), roofM = PM(0x363a3e, .82, .18);
  const i0 = megaP.interactables.length;
  megaP.buildExpandedCampusMegaZones(V3(G.x + 28, 0, G.z + 18));   // 클래스 기준점: 대강당 = 기준 + (−28, 0, −18)
  const [gymC, courtC, bunkerC] = megaP.registeredChunks.slice(-3);
  courtC.group.position.set(C.x, 0, C.z); courtC.centerPos.set(C.x, 0, C.z);
  [gymC, courtC].forEach(c => { scene.remove(c.group); O.add(c.group); c.group.traverse(o => { o.userData.dynamic = true; if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); });
  const audN0 = O.children.length;   // 대강당 메시: 예전 별관 땅(z −34) 바로 앞이라 rebuild 잔재 정리가 정면 벽 · 기둥을 감추던 문제 → rbKeep
  // ① 대강당(실내체육관): PBR 콘크리트·벽돌 기단 + 필라스터 기둥 + 채광 고창 + 돌출 포치 캐노피 & 전면 현판 + 양개 유리문 + 실내 코트 골대/무대
  {
    const H = 7.2, x0 = G.x - G.w / 2, x1 = G.x + G.w / 2, z0 = G.z - G.d / 2, z1 = G.z + G.d / 2, t = .35, dw = 3.2, dh = 3.0;
    const baseM = facTpl ? Object.assign(facTpl.clone(), { color: new THREE.Color(0x5a5450), roughness: .9 }) : PM(0x524c48, .88),
      pilM = PM(0xa69e92, .76),
      trimM = PM(0xb2aa9e, .72), frameM = PM(0x242a30, .42, .62), chromeM = PM(0xd4dade, .22, .88),
      glassM = new THREE.MeshStandardMaterial({ color: 0x263848, roughness: .14, metalness: .25, transparent: true, opacity: .52 });
    const wall = (ax, bx, az, bz, h = H, y0 = 0, mat = wallM) => { pbox(bx - ax, h, bz - az, mat, (ax + bx) / 2, y0 + h / 2, (az + bz) / 2, O); if (y0 === 0) { const r = { x1: ax, x2: bx, z1: az, z2: bz }; F0.col.push(r); F0.walls.push(r); } };
    wall(x0 - t, x0, z0 - t, z1 + t); wall(x1, x1 + t, z0 - t, z1 + t); wall(x0, x1, z0 - t, z0);
    wall(x0, G.x - dw / 2, z1, z1 + t); wall(G.x + dw / 2, x1, z1, z1 + t);
    pbox(dw, H - dh, t, wallM, G.x, dh + (H - dh) / 2, z1 + t / 2, O);
    // 1) 하부 벽돌/석재 기단 (높이 1.2m) + 상단 두겁돌 몰딩
    pbox((G.w - dw) / 2 + t, 1.2, .14, baseM, (x0 - t + G.x - dw / 2) / 2, .6, z1 + t + .07, O);
    pbox((G.w - dw) / 2 + t, 1.2, .14, baseM, (G.x + dw / 2 + x1 + t) / 2, .6, z1 + t + .07, O);
    pbox(G.w + 2 * t + .24, 1.2, .14, baseM, G.x, .6, z0 - t - .07, O);
    [-1, 1].forEach(sd => pbox(.14, 1.2, G.d + 2 * t + .24, baseM, G.x + sd * (G.w / 2 + t + .07), .6, G.z, O));
    pbox((G.w - dw) / 2 + t + .06, .1, .20, trimM, (x0 - t + G.x - dw / 2) / 2, 1.23, z1 + t + .09, O);
    pbox((G.w - dw) / 2 + t + .06, .1, .20, trimM, (G.x + dw / 2 + x1 + t) / 2, 1.23, z1 + t + .09, O);
    // 2) 수직 필라스터 기둥 (정면 6개 · 좌우 측면 각 6개)
    [-8.8, -5.6, -2.15, 2.15, 5.6, 8.8].forEach(dx => {
      pbox(.46, H + .2, .24, pilM, G.x + dx, (H + .2) / 2, z1 + t + .10, O);
      pbox(.54, .35, .30, trimM, G.x + dx, H + .12, z1 + t + .12, O);
    });
    for (let dz = -10; dz <= 10; dz += 5) [-1, 1].forEach(sd => pbox(.22, H + .2, .44, pilM, G.x + sd * (G.w / 2 + t + .09), (H + .2) / 2, G.z + dz, O));
    // 3) 상단 코니스 처마 몰딩 · 파라펫 · 아치형 박공 지붕
    pbox(G.w + 2 * t + .7, .32, G.d + 2 * t + .7, trimM, G.x, H + .16, G.z, O);
    pbox(G.w + 2 * t + .35, .42, G.d + 2 * t + .35, roofM, G.x, H + .52, G.z, O);
    pbox(G.w - 1.6, .50, G.d - 1.4, PM(0x2c3238, .75, .25), G.x, H + .96, G.z, O);
    for (let dz = -10; dz <= 10; dz += 4) pbox(G.w - .4, .22, .28, frameM, G.x, H - .14, G.z + dz, O, { cast: false });
    // 4) 대강당 채광 고창(Clerestory Windows) + 1층 창문 (정면 8개 + 좌우 측면 12개)
    const addGymWin = (wx, wy, wz, ww, wh, ry = 0) => {
      const wg = new THREE.Group(); wg.position.set(wx, wy, wz); wg.rotation.y = ry; wg.userData.dynamic = true; O.add(wg);
      pbox(ww + .18, wh + .18, .12, frameM, 0, 0, 0, wg, { cast: false });
      pmesh(new THREE.PlaneGeometry(ww - .06, wh - .06), glassM, 0, 0, .068, wg, { cast: false });
      pbox(.05, wh, .14, frameM, 0, 0, .02, wg, { cast: false });
      pbox(ww, .05, .14, frameM, 0, 0, .02, wg, { cast: false });
      pbox(ww + .30, .10, .24, trimM, 0, -wh / 2 - .08, .06, wg, { cast: false });
      pbox(ww + .26, .12, .20, trimM, 0, wh / 2 + .08, .05, wg, { cast: false });
    };
    [-7.2, -3.85, 3.85, 7.2].forEach(dx => {
      addGymWin(G.x + dx, 5.15, z1 + t + .07, 2.1, 1.55, 0);
      addGymWin(G.x + dx, 2.55, z1 + t + .07, 1.85, 1.35, 0);
    });
    [-7.5, -2.5, 2.5, 7.5].forEach(dz => {
      addGymWin(x0 - t - .07, 5.15, G.z + dz, 2.3, 1.45, -Math.PI / 2);
      addGymWin(x1 + t + .07, 5.15, G.z + dz, 2.3, 1.45, Math.PI / 2);
    });
    // 5) 정면 출입구 포치(진입 계단 · 원형 기둥 2개 · 캐노피 지붕 — 북부 메인 보행로 z=-35.2~-32.4 를 침범하지 않도록 z1+t=-34.65 에 밀착 시공!)
    pbox(5.2, .10, .85, trimM, G.x, .05, z1 + t + .42, O, { cast: false });
    [-2.15, 2.15].forEach(dx => {
      pbox(.44, .38, .44, baseM, G.x + dx, .19, z1 + t + .38, O);
      pcyl(.17, .19, 3.30, trimM, G.x + dx, 1.98, z1 + t + .38, O);
      pbox(.42, .22, .42, trimM, G.x + dx, 3.55, z1 + t + .38, O);
    });
    pbox(5.5, .28, 1.15, trimM, G.x, 3.74, z1 + t + .45, O);
    pbox(5.66, .48, .20, frameM, G.x, 4.02, z1 + t + .96, O);
    pbox(3.76, .58, .08, PM(0x3a3228, .5, .4), G.x, 4.06, z1 + t + 1.06, O, { cast: false });
    pmesh(new THREE.PlaneGeometry(3.6, .50), new THREE.MeshBasicMaterial({ map: makeSign('대강당 · 실내체육관', '#18242c', '#f2ead2', 30) }), G.x, 4.06, z1 + t + 1.11, O, { cast: false });
    // 상부 본벽 중앙 장식 현판
    pbox(3.2, .52, .08, trimM, G.x, 6.25, z1 + t + .10, O, { cast: false });
    pmesh(new THREE.PlaneGeometry(3.0, .42), new THREE.MeshBasicMaterial({ map: makeSign('1998 · 체육관 · 대강당', '#22282e', '#d8d0bc', 24) }), G.x, 6.25, z1 + t + .15, O, { cast: false });
    // 출입구 문틀 + 상부 트랜섬 창 + 양쪽으로 살짝 열린 강화유리 양개문
    pbox(.16, dh + .12, t + .18, frameM, G.x - dw / 2 + .08, (dh + .12) / 2, z1 + t / 2, O);
    pbox(.16, dh + .12, t + .18, frameM, G.x + dw / 2 - .08, (dh + .12) / 2, z1 + t / 2, O);
    pbox(dw, .14, t + .20, frameM, G.x, dh, z1 + t / 2, O);
    pbox(dw, .12, t + .18, frameM, G.x, 2.38, z1 + t / 2, O);
    pmesh(new THREE.PlaneGeometry(dw - .32, .52), glassM, G.x, 2.68, z1 + t / 2 + .06, O, { cast: false });
    const leafW = (dw - .36) / 2, leafH = 2.32;
    [[-1, .62], [1, -.62]].forEach(([sd, openAng]) => {
      const piv = new THREE.Group(); piv.position.set(G.x + sd * (dw / 2 - .16), 0, z1 + t - .04); piv.rotation.y = openAng; piv.userData.dynamic = true; O.add(piv);
      const lx = -sd * (leafW / 2);
      pbox(leafW, .10, .06, frameM, lx, leafH - .05, 0, piv);
      pbox(leafW, .16, .06, frameM, lx, .08, 0, piv);
      pbox(leafW, .08, .06, frameM, lx, 1.05, 0, piv);
      pbox(.09, leafH, .06, frameM, lx - sd * (leafW / 2 - .045), leafH / 2, 0, piv);
      pbox(.09, leafH, .06, frameM, lx + sd * (leafW / 2 - .045), leafH / 2, 0, piv);
      pmesh(new THREE.PlaneGeometry(leafW - .18, leafH - .26), glassM, lx, leafH / 2, 0, piv, { cast: false });
      pbox(leafW * .72, .045, .10, chromeM, lx, 1.05, .05, piv, { cast: false });
      pbox(.04, .28, .12, chromeM, lx + sd * (leafW * .30), 1.18, .06, piv, { cast: false });
    });
    // 포치 좌우 따뜻한 벽부등 2기
    [-2.05, 2.05].forEach(dx => {
      pbox(.18, .32, .16, frameM, G.x + dx, 2.48, z1 + t + .10, O, { cast: false });
      pbox(.12, .22, .12, new THREE.MeshStandardMaterial({ color: 0xffe4b5, emissive: 0xffb85c, emissiveIntensity: .95 }), G.x + dx, 2.48, z1 + t + .16, O, { cast: false });
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('255,205,130'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .38 }));
      sp.scale.setScalar(2.0); sp.position.set(G.x + dx, 2.48, z1 + t + .32); sp.userData.dynamic = true; O.add(sp);
    });
    // 7) 서북 광장 소품군 — 별관 뒤쪽 보행로(z=-35.2~-32.4), 서관 아케이드 인도(x=-39.6~-37.0), 필로티 인도(z=-16.8~-13.6)와
    //    겹침이 0.0mm가 되도록 서관 아케이드 인도 서쪽의 넓은 잔디 광장(x = -52.0 ~ -43.5)에 정연하게 재배치!
    {
      const woodP = PM(0x5c3e26, .78), roofDark = PM(0x28323a, .65, .35), tileBlue = PM(0x4a7898, .45, .1),
        tileWhite = PM(0xd8ddd8, .5), greenFence = PM(0x285838, .6, .3), redBin = PM(0xb82c28, .55),
        blueBin = PM(0x2458a8, .55), yelBin = PM(0xc89620, .55), grnBin = PM(0x287848, .55);

      // (A) 화강암 면학 흉상(독서하는 학생상) 화단 (x = -43.5, z = -30.0 — 북부 보행로 z=-32.4 남쪽 여유 잔디밭)
      const sxA = -43.5, szA = -30.0;
      pbox(2.2, .38, 2.2, baseM, sxA, .19, szA, O);
      pbox(1.9, .12, 1.9, PM(0x364a2e, .95), sxA, .40, szA, O);
      pbox(.72, 1.25, .72, trimM, sxA, 1.0, szA, O);
      pcyl(.22, .26, .55, PM(0x3a4640, .4, .65), sxA, 1.9, szA, O);
      pmesh(new THREE.SphereGeometry(.19, 14, 12), PM(0x3a4640, .4, .65), sxA, 2.32, szA, O);
      pmesh(new THREE.PlaneGeometry(.68, .28), new THREE.MeshBasicMaterial({ map: makeSign('오늘의 땀방울이 내일의 별이 된다', '#222628', '#e8dec0', 18) }), sxA, 1.12, szA + .38, O, { cast: false });
      F0.col.push({ x1: sxA - 1.1, x2: sxA + 1.1, z1: szA - 1.1, z2: szA + 1.1 });

      // 캠퍼스 방향 안내 키오스크 (x = -41.5, z = -36.5 — 북부 보행로 z=-35.2 북쪽 바깥)
      const kxK = -41.5, kzK = -36.5;
      pbox(.36, 2.45, .16, frameM, kxK, 1.225, kzK, O);
      pbox(1.85, .92, .12, frameM, kxK, 1.95, kzK, O);
      pmesh(new THREE.PlaneGeometry(1.72, .80), new THREE.MeshBasicMaterial({ map: makeSign('▲ 대강당 · 실내체육관  |  ▶ 중앙 중정 · 본관', '#162836', '#eaf0e6', 22) }), kxK, 1.95, kzK + .07, O, { cast: false });
      F0.col.push({ x1: kxK - .9, x2: kxK + .9, z1: kzK - .15, z2: kzK + .15 });

      // (B) 지붕 달린 학교 야외 종합 게시판 (x = -43.5, z = -25.2)
      const bxB = -43.5, bzB = -25.2;
      [-1.45, 1.45].forEach(dx => pbox(.14, 2.55, .14, woodP, bxB + dx, 1.275, bzB, O));
      pbox(3.3, .18, .85, roofDark, bxB, 2.60, bzB, O);
      pbox(2.9, 1.35, .12, woodP, bxB, 1.65, bzB, O);
      pbox(2.74, 1.18, .04, PM(0x8c6d46, .9), bxB, 1.65, bzB + .05, O);
      pmesh(new THREE.PlaneGeometry(2.65, .28), new THREE.MeshBasicMaterial({ map: makeSign('해교고 학사 공지 · 제32회 학예제 & 체육대회 안내', '#1b3228', '#f2ead2', 22) }), bxB, 2.12, bzB + .08, O, { cast: false });
      [[-0.90, 1.62, '합창제 리허설 안내', '#f4eed8', '#222'], [-0.28, 1.66, '야간 자율학습 수칙', '#dcecf4', '#182838'], [0.32, 1.60, '방송부원 모집 공고', '#f8e0dc', '#481818'], [0.92, 1.64, '수영장 휴장 안내', '#e2f2e4', '#183820']].forEach(([ox, oy, txt, bg, fg]) => {
        pmesh(new THREE.PlaneGeometry(.52, .68), new THREE.MeshBasicMaterial({ map: makeSign(txt, bg, fg, 18) }), bxB + ox, oy, bzB + .085, O, { cast: false });
      });
      F0.col.push({ x1: bxB - 1.55, x2: bxB + 1.55, z1: bzB - .25, z2: bzB + .25 });
      world.props.push({ kind: 'robj', k: 'plazaboard', t: 'plaza', floor: 0, x: bxB, z: bzB + .85, y: 1.5, r: 2.0, label: '야외 학사 게시판 대자보 읽기' });

      // (C) 서편 야외 타일 수돗가 · 음수대 (x = -43.5, z = -20.5)
      const wx = -43.5, wz = -20.5;
      pbox(3.2, .82, .58, tileBlue, wx, .41, wz, O);
      pbox(3.26, .08, .64, tileWhite, wx, .84, wz, O);
      pbox(3.2, .12, .95, trimM, wx, .06, wz + .48, O);
      pbox(3.2, 1.35, .16, tileBlue, wx, .675, wz - .26, O);
      pmesh(new THREE.PlaneGeometry(2.2, .26), new THREE.MeshBasicMaterial({ map: makeSign('수돗물 아껴 쓰기 · 음용수 적합', '#18364a', '#e8f4fa', 22) }), wx, 1.18, wz - .17, O, { cast: false });
      for (let f = -1.1; f <= 1.1; f += .55) {
        pcyl(.022, .022, .18, chromeM, wx + f, .98, wz - .10, O, { rx: Math.PI / 2 });
        pcyl(.018, .018, .08, chromeM, wx + f, .92, wz - .02, O);
      }
      F0.col.push({ x1: wx - 1.65, x2: wx + 1.65, z1: wz - .38, z2: wz + .38 });
      world.props.push({ kind: 'robj', k: 'plazawater', t: 'plaza', floor: 0, x: wx, z: wz + .95, y: 1.0, r: 2.0, label: '야외 수돗가 수도꼭지 틀기' });

      // (D) 서편 학생 자전거 보관소 (x = -51.5, z = -28.5 — 서관 아케이드 인도 x=-39.6 에서 10m 이격!)
      const kx = -51.5, kz = -28.5;
      pbox(4.0, .08, 2.2, trimM, kx, .04, kz, O, { cast: false });
      [-1.85, 1.85].forEach(dx => [-.95, .95].forEach(dz => pcyl(.045, .045, 2.25, frameM, kx + dx, 1.125, kz + dz, O)));
      pbox(4.2, .12, 2.4, new THREE.MeshStandardMaterial({ color: 0x3a6478, roughness: .25, metalness: .2, transparent: true, opacity: .65 }), kx, 2.28, kz, O);
      pmesh(new THREE.PlaneGeometry(2.4, .30), new THREE.MeshBasicMaterial({ map: makeSign('학생 자전거 보관소 — 잠금장치 확인', '#1c2e3a', '#e6f0f4', 22) }), kx, 2.12, kz + 1.22, O, { cast: false });
      for (let b = 0; b < 5; b++) {
        const bx0 = kx - 1.3 + b * .65, bCol = PM([0x982828, 0x244888, 0x286840, 0xd0a028, 0x383c42][b], .4, .6);
        const bg = new THREE.Group(); bg.position.set(bx0, 0, kz); if (b === 4) { bg.rotation.z = 1.25; bg.position.y = .12; } bg.userData.dynamic = true; O.add(bg);
        [-.42, .42].forEach(wz2 => {
          const wh = new THREE.Mesh(new THREE.TorusGeometry(.28, .025, 8, 18), frameM);
          wh.rotation.y = Math.PI / 2; wh.position.set(0, .30, wz2); bg.add(wh);
        });
        pbox(.04, .48, .82, bCol, 0, .48, 0, bg);
        pbox(.42, .03, .03, chromeM, 0, .82, .36, bg);
        pbox(.14, .06, .24, PM(0x1e1c1a, .8), 0, .74, -.22, bg);
      }
      F0.col.push({ x1: kx - 2.0, x2: kx + 2.0, z1: kz - 1.1, z2: kz + 1.1 });

      // (E) 서편 분리수거 보관함 (x = -51.5, z = -23.0)
      const rx = -51.5, rz = -23.0;
      pbox(3.2, 1.35, .08, greenFence, rx, .675, rz - .55, O);
      pmesh(new THREE.PlaneGeometry(2.5, .32), new THREE.MeshBasicMaterial({ map: makeSign('깨끗한 학교 — 분리수거함 (종이 · 캔 · 병 · 플라스틱)', '#1c3e28', '#e8f4e8', 20) }), rx, 1.15, rz - .49, O, { cast: false });
      [[-1.05, blueBin, '종이류'], [-.35, yelBin, '캔 · 고철'], [.35, grnBin, '유리병'], [1.05, redBin, '플라스틱']].forEach(([dx, bm, lb]) => {
        pbox(.55, .82, .50, bm, rx + dx, .41, rz, O);
        pmesh(new THREE.PlaneGeometry(.44, .20), new THREE.MeshBasicMaterial({ map: makeSign(lb, '#ffffff', '#111111', 22) }), rx + dx, .52, rz + .26, O, { cast: false });
      });
      F0.col.push({ x1: rx - 1.6, x2: rx + 1.6, z1: rz - .6, z2: rz + .3 });
      world.props.push({ kind: 'robj', k: 'plazarecycle', t: 'plaza', floor: 0, x: rx, z: rz + .85, y: .8, r: 2.0, label: '분리수거함 살펴보기' });

      // (F) 등나무 파고라(Pergola) 야외 휴게 정자 & 목재 평상 (x = -51.5, z = -17.5 — 필로티 보행로와 겹침 0건!)
      const px = -51.5, pz = -17.5;
      [-1.35, 1.35].forEach(dx => [-1.05, 1.05].forEach(dz => pbox(.15, 2.55, .15, woodP, px + dx, 1.275, pz + dz, O)));
      pbox(3.1, .14, .16, woodP, px, 2.55, pz - .98, O); pbox(3.1, .14, .16, woodP, px, 2.55, pz + .98, O);
      for (let sx = -1.35; sx <= 1.35; sx += .45) pbox(.08, .10, 2.4, woodP, px + sx, 2.66, pz, O);
      pbox(2.1, .44, 1.4, woodP, px, .22, pz, O);
      F0.col.push({ x1: px - 1.1, x2: px + 1.1, z1: pz - .75, z2: pz + .75 });
    }
    // 8) [캠퍼스 빈 공간 대규모 확장] ①1층 필로티 중앙광장 ②생물부 유리온실 & 기상관측소 ③학교 야외 매점 & 파라솔 테라스 ④야외 원형 음악당 ⑤교직원 주차장 & 육각정 쉼터
    {
      const woodM = PM(0x5c3e24, .78), brickM = PM(0x6e4438, .85), darkF = PM(0x242c32, .45, .6),
        whiteM = PM(0xe8e6de, .55), greenM = PM(0x285a3a, .65), glassG = new THREE.MeshStandardMaterial({ color: 0x98c8d8, roughness: .12, metalness: .2, transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false }),
        canopyW = PM(0xf0ece0, .6), goldM = PM(0xc89a28, .4, .6), leafM = PM(0x2d6834, .85), terracotta = PM(0xa84c28, .75);

      // ① 구름다리 아래 1층 필로티 중앙 광장 (천장 다운라이트 조명 + 동서남북 이정표 + 화단 벤치)
      [[-15.2, 0.8], [-12.2, 0.8], [-18.2, 0.8]].forEach(([lz, lx]) => {
        pbox(.36, .06, .36, darkF, lx, 3.82, lz, O, { cast: false });
        pbox(.26, .04, .26, new THREE.MeshStandardMaterial({ color: 0xfff4dc, emissive: 0xffd28a, emissiveIntensity: .9 }), lx, 3.79, lz, O, { cast: false });
      });
      // 필로티 광장 동쪽 기념 식수 화단 & 안내 이정표 (x = 5.4, z = -15.2 — 중앙 보행 통로 x -1..+2.8 을 완전히 비움!)
      pbox(2.2, .36, 2.2, baseM, 5.4, .18, -15.2, O);
      pbox(1.9, .14, 1.9, PM(0x32482a, .95), 5.4, .38, -15.2, O);
      pcyl(.16, .22, 2.4, woodM, 5.4, 1.5, -15.2, O);
      pmesh(new THREE.DodecahedronGeometry(1.15, 1), leafM, 5.4, 2.85, -15.2, O);
      pbox(.14, 2.2, .14, darkF, -3.8, 1.1, -15.2, O);
      pbox(1.75, .72, .10, darkF, -3.8, 1.85, -15.2, O);
      pmesh(new THREE.PlaneGeometry(1.65, .62), new THREE.MeshBasicMaterial({ map: makeSign('▲ 별관 1F 정문 | ◀ 대강당·온실 | ▶ 중정·매점', '#182c34', '#eaf2ec', 20) }), -3.8, 1.85, -15.14, O, { cast: false });
      F0.col.push({ x1: 4.3, x2: 6.5, z1: -16.3, z2: -14.1 }, { x1: -4.6, x2: -3.0, z1: -15.4, z2: -15.0 });

      // ② 서쪽 공터: 「생물부 생태 유리온실(Greenhouse) & 과학 기상관측소(백엽상)」 (x: -44.5 ~ -31.5, z: -6.5 ~ +4.5)
      {
        // 생태온실 리모델링 (참고 평면도 · 7.50 × 6.00m · 유리 온실 · 최고 약 3.5m): 알루미늄 프레임 + 유리 박공 지붕 · 동측 유리문 (보행로 쪽) · 중앙 통로 / 남측 재배대 2 (1800×600) · 스테인리스 작업대 (1800×700) / 북측 실험·관찰 테이블 (1500×750) + 스툴 2 · 화분 보관 선반 · 식물 선반 · 물뿌리개 · 원예 도구 · 안내 표지판
        const gx = 61.75, gz = -50.0, gw = 7.5, gd = 6.0, gh = 2.4, gr = 3.5, x0 = gx - gw / 2, x1 = gx + gw / 2, z0 = gz - gd / 2, z1 = gz + gd / 2, dz0 = gz - .6, dz1 = gz + .6;
        const aluM = PM(0xc8ccd0, .35, .75), steelT = PM(0xb8bcc0, .3, .8), blackT = PM(0x1a1c1e, .5), soilM = PM(0x4a3424, .95);
        pbox(gw, .06, gd, PM(0xd8d0c0, .6), gx, .03, gz, O, { cast: false }); pbox(1.2, .065, gd, PM(0xc8b8a0, .6), gx + .5, .035, gz, O, { cast: false });
        // 기단 (낮은 콘크리트) · 유리벽 · 기둥 · 박공 지붕 (용마루 동서 방향)
        const plinth = (ax, bx, az, bz) => pbox(bx - ax, .45, bz - az, PM(0xa8a49a, .8), (ax + bx) / 2, .225, (az + bz) / 2, O);
        plinth(x0, x1, z0 - .1, z0); plinth(x0, x1, z1, z1 + .1); plinth(x0 - .1, x0, z0, z1); plinth(x1, x1 + .1, z0, dz0); plinth(x1, x1 + .1, dz1, z1);
        pmesh(new THREE.PlaneGeometry(gw, gh - .45), glassG, gx, .45 + (gh - .45) / 2, z0, O, { cast: false }); pmesh(new THREE.PlaneGeometry(gw, gh - .45), glassG, gx, .45 + (gh - .45) / 2, z1, O, { cast: false });
        pmesh(new THREE.PlaneGeometry(gd, gh - .45), glassG, x0, .45 + (gh - .45) / 2, gz, O, { ry: Math.PI / 2, cast: false });
        [[z0, dz0], [dz1, z1]].forEach(([a, b]) => pmesh(new THREE.PlaneGeometry(b - a, gh - .45), glassG, x1, .45 + (gh - .45) / 2, (a + b) / 2, O, { ry: Math.PI / 2, cast: false }));
        pmesh(new THREE.PlaneGeometry(1.2, gr - gh), glassG, x1, gh + (gr - gh) / 2 - .3, gz, O, { ry: Math.PI / 2, cast: false });
        { const sl = Math.hypot(gd / 2, gr - gh), a = Math.atan2(gr - gh, gd / 2); [-1, 1].forEach(s => { const m = pmesh(new THREE.PlaneGeometry(gw + .1, sl), glassG, gx, (gh + gr) / 2, gz + s * gd / 4, O, { cast: false }); m.rotation.x = -Math.PI / 2 + s * a; });
          [x0, x0 + gw / 4, gx, x1 - gw / 4, x1].forEach(x => { [-1, 1].forEach(s => { const r = pbox(.06, .06, sl, aluM, x, (gh + gr) / 2, gz + s * gd / 4, O, { cast: false }); r.rotation.x = s * a; }); }); }
        for (let x = x0; x <= x1 + .01; x += gw / 4) [z0, z1].forEach(z => pbox(.07, gh, .07, aluM, x, gh / 2, z, O, { cast: false }));
        [z0, z0 + gd / 4, gz, z1 - gd / 4, z1].forEach(z => { if (z > dz0 - .05 && z < dz1 + .05) return; [x0, x1].forEach(x => pbox(.07, gh, .07, aluM, x, gh / 2, z, O, { cast: false })); });
        pbox(gw, .07, .07, aluM, gx, gr, gz, O, { cast: false }); [z0, z1].forEach(z => pbox(gw, .07, .07, aluM, gx, gh, z, O, { cast: false })); [x0, x1].forEach(x => pbox(.07, .07, gd, aluM, x, gh, gz, O, { cast: false }));
        [dz0, dz1].forEach(z => pbox(.08, 2.2, .08, aluM, x1, 1.1, z, O, { cast: false })); pbox(.08, .08, 1.2, aluM, x1, 2.2, gz, O, { cast: false });
        { const lp = new THREE.Group(); lp.position.set(x1, 0, dz0); lp.rotation.y = -1.2; lp.userData.dynamic = true; O.add(lp); pmesh(new THREE.PlaneGeometry(.6, 2.1), glassG, 0, 1.05, .3, lp, { ry: Math.PI / 2, cast: false }); pbox(.04, 2.1, .04, aluM, 0, 1.05, .58, lp, { cast: false }); }
        pbox(.08, .4, 1.6, woodM, x1 + .05, 2.6, gz, O, { cast: false }); pmesh(new THREE.PlaneGeometry(1.5, .34), new THREE.MeshBasicMaterial({ map: makeSign('생태온실', '#5a3a1c', '#f4e4c0', 28) }), x1 + .1, 2.6, gz, O, { ry: Math.PI / 2, cast: false });
        F0.col.push({ x1: x0 - .1, x2: x1 + .1, z1: z0 - .12, z2: z0 + .05 }, { x1: x0 - .1, x2: x1 + .1, z1: z1 - .05, z2: z1 + .12 }, { x1: x0 - .12, x2: x0 + .05, z1: z0, z2: z1 }, { x1: x1 - .05, x2: x1 + .12, z1: z0, z2: dz0 }, { x1: x1 - .05, x2: x1 + .12, z1: dz1, z2: z1 });
        // 남측: 재배대 2 (1800×600×750, 화분 · 식물) · 스테인리스 작업대 (1800×700×850) + 공구 걸이 · 물뿌리개
        const pot = (x, y, z, s = 1) => { pcyl(.12 * s, .09 * s, .2 * s, terracotta, x, y + .1 * s, z, O); pmesh(new THREE.DodecahedronGeometry(.2 * s, 1), leafM, x, y + .32 * s, z, O); };
        [x0 + 1.2, x0 + 3.2].forEach(x => { pbox(1.8, .06, .6, woodM, x, .75, z1 - .45, O); [-.8, .8].forEach(d => pbox(.05, .72, .55, aluM, x + d, .36, z1 - .45, O, { cast: false })); pbox(1.7, .04, .5, woodM, x, .2, z1 - .45, O, { cast: false }); for (let k = 0; k < 5; k++) pot(x - .72 + k * .36, .78, z1 - .45); F0.col.push({ x1: x - .9, x2: x + .9, z1: z1 - .75, z2: z1 - .15, h: .78 }); });
        { const x = x1 - 1.4; pbox(1.8, .04, .7, steelT, x, .85, z1 - .5, O); [[-.85, -.3], [.85, -.3], [-.85, .3], [.85, .3]].forEach(([a, b]) => pbox(.04, .83, .04, steelT, x + a, .415, z1 - .5 + b, O, { cast: false })); pbox(1.7, .03, .6, steelT, x, .25, z1 - .5, O, { cast: false });
          pbox(1.0, .04, .3, PM(0x8a6a48, .8), x - .3, .87, z1 - .45, O, { cast: false }); F0.col.push({ x1: x - .9, x2: x + .9, z1: z1 - .85, z2: z1 - .15, h: .87 });
          pmesh(new THREE.TorusGeometry(.1, .025, 6, 12, Math.PI), PM(0x2a7a3a, .5), x + .6, 1.02, z1 - .55, O); pcyl(.1, .12, .22, PM(0x2a7a3a, .5), x + .6, .98, z1 - .55, O); }
        // 북측: 실험·관찰 테이블 (1500×750×750 · 검정 상판) + 실험용 스툴 2 · 현미경 · 화분 보관 선반 · 식물 선반 (1200×450×1800)
        { const x = x0 + 1.2, z = z0 + .55; pbox(1.5, .04, .75, blackT, x, .75, z, O); [[-.7, -.33], [.7, -.33], [-.7, .33], [.7, .33]].forEach(([a, b]) => pbox(.05, .73, .05, aluM, x + a, .365, z + b, O, { cast: false })); F0.col.push({ x1: x - .75, x2: x + .75, z1: z - .38, z2: z + .38, h: .77 });
          [-.4, .4].forEach(d => { pcyl(.17, .17, .04, woodM, x + d, .45, z + .7, O); pcyl(.025, .025, .43, aluM, x + d, .215, z + .7, O); }); pcyl(.06, .08, .3, PM(0x222428, .4, .6), x + .3, .9, z, O); pot(x - .4, .77, z, .7); }
        const shelf = (x, z, potsOnly) => { [[-.58, -.2], [.58, -.2], [-.58, .2], [.58, .2]].forEach(([a, b]) => pbox(.04, 1.8, .04, aluM, x + a, .9, z + b, O, { cast: false })); for (let r = 0; r < 4; r++) { pbox(1.2, .03, .45, aluM, x, .15 + r * .52, z, O, { cast: false }); for (let k = 0; k < 4; k++) potsOnly && r < 2 ? pcyl(.1, .08, .16, terracotta, x - .45 + k * .3, .25 + r * .52, z, O) : pot(x - .45 + k * .3, .17 + r * .52, z, .8); } F0.col.push({ x1: x - .6, x2: x + .6, z1: z - .23, z2: z + .23 }); };
        shelf(x0 + 3.4, z0 + .3, false); shelf(x1 - 1.3, z0 + .3, true);
        pbox(.5, .35, .5, PM(0x8a7a58, .9), x1 - .5, .18, z0 + 1.0, O); F0.col.push({ x1: x1 - .75, x2: x1 - .25, z1: z0 + .75, z2: z0 + 1.25, h: .35 });   // 배양토 포대
        // 외부: 화단 화분 · 안내 표지판
        [[x0 - .5, z1 + .5], [x1 + .5, z1 + .3], [x0 - .5, z0 - .5]].forEach(([x, z]) => pot(x, 0, z, 1.6));
        { const sx = x1 + 1.4, sz = gz + 1.8; pbox(.08, 1.8, .08, greenM, sx - .4, .9, sz, O); pbox(.08, 1.8, .08, greenM, sx + .4, .9, sz, O); pbox(.9, 1.1, .06, greenM, sx, 1.25, sz, O); pmesh(new THREE.PlaneGeometry(.8, 1.0), new THREE.MeshBasicMaterial({ map: makeSign('생태온실 · 식물 재배 · 생태 교육 · 실험 관찰', '#f2f6ee', '#1e4a2a', 14) }), sx, 1.25, sz + .035, O, { cast: false }); F0.col.push({ x1: sx - .45, x2: sx + .45, z1: sz - .05, z2: sz + .05 }); }
        const spG = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('140,245,160'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .3 }));
        spG.scale.setScalar(3.5); spG.position.set(gx, 2.2, gz); O.add(spG);
        world.props.push({ kind: 'robj', k: 'greenhouse_herb', t: 'campus', floor: 0, x: x0 + 2.2, z: z1 - 1.2, y: .9, r: 2.0, label: '생물부 온실 약초 재배대 조사하기' });

        // 과학 기상관측소 (백엽상 · 풍향계 · 우량계, x = -33.2, z = 2.8)
        const wx0 = 54.5, wz0 = -50.0;
        pbox(3.2, .08, 3.2, trimM, wx0, .04, wz0, O, { cast: false });
        // 백엽상 (하얀 목재 루버 상자 + 4다리)
        [-.28, .28].forEach(dx => [-.28, .28].forEach(dz => pbox(.06, 1.05, .06, whiteM, wx0 + dx, .525, wz0 + dz, O)));
        pbox(.76, .78, .76, whiteM, wx0, 1.38, wz0, O);
        pbox(.88, .10, .88, whiteM, wx0, 1.82, wz0, O);
        // 풍향·풍속계 기둥 & 우량계
        pcyl(.03, .04, 2.8, chromeM, wx0 - 1.0, 1.4, wz0 - .8, O);
        pbox(.55, .04, .04, chromeM, wx0 - 1.0, 2.82, wz0 - .8, O);
        pcyl(.14, .14, .55, chromeM, wx0 + 1.0, .275, wz0 - .8, O);
        pmesh(new THREE.PlaneGeometry(1.4, .26), new THREE.MeshBasicMaterial({ map: makeSign('과학 기상 관측소 (백엽상)', '#1e342b', '#e8f4ec', 20) }), wx0, .92, wz0 + .42, O, { cast: false });
        F0.col.push({ x1: wx0 - .55, x2: wx0 + .55, z1: wz0 - .55, z2: wz0 + .55 });
        world.props.push({ kind: 'robj', k: 'weather_box', t: 'campus', floor: 0, x: wx0, z: wz0 + .95, y: 1.3, r: 1.9, label: '백엽상 기상 관측 기록 열어보기' });
      }

      // ③ 학우매점 신축 (참고 계획안 · 9.20 × 6.40m · 남측 중앙 출입구): 적벽돌 외벽 · 녹색 차양 · '학우매점' 간판 · 전면 유리창 / 북서 소형 창고 (2.0×1.8) · 직원 준비공간 (3.0×1.8) · 북동 컵라면 코너 (전자레인지 · 온수기 · 스툴) · 서벽 음료 냉장고 · 중앙 스낵 진열대 2열 · 남서 빵·간식 진열대 · 동남 판매대/계산대
      {
        const cxC = 63.5, czC = 18.0, cw = 9.2, cd = 6.4, ch = 3.4;
        const x0 = cxC - cw / 2, x1 = cxC + cw / 2, z0 = czC - cd / 2, z1 = czC + cd / 2, t = .24, dg = .8;
        const brick = PM(0x8a4a38, .85), cement = PM(0x8a8a82, .9), floorT = PM(0xcfc8b8, .55), ceilM = PM(0xe8e6de, .85), plaster = PM(0xe4dccb, .85), awnM = PM(0x1e6a46, .6), frameM = PM(0x3a3e40, .45, .6), creamM = PM(0xe8dcc0, .6);
        const W = (ax, bx, az, bz, h = ch, y0 = 0, m = brick, col = true) => { pbox(bx - ax, h, bz - az, m, (ax + bx) / 2, y0 + h / 2, (az + bz) / 2, O); if (col && y0 === 0) F0.col.push({ x1: ax, x2: bx, z1: az, z2: bz }); };
        pbox(cw + .6, .14, cd + .6, cement, cxC, .07, czC, O, { cast: false }); pbox(cw - .1, .03, cd - .1, floorT, cxC, .155, czC, O, { cast: false });
        pbox(cw - .1, .06, cd - .1, ceilM, cxC, ch - .03, czC, O, { cast: false }); pbox(cw + .5, .3, cd + .5, cement, cxC, ch + .15, czC, O); pbox(cw + .7, .14, cd + .7, PM(0x5a5c58, .8), cxC, ch + .37, czC, O);
        // 외벽: 북 · 서 · 동 (벽돌 + 하부 시멘트 띠) · 남 정면 (중앙 양개 유리문 1.6m · 좌우 대형 유리창)
        W(x0 - t, x1 + t, z0 - t, z0); W(x0 - t, x0, z0, z1 + t); W(x1, x1 + t, z0, z1 + t);
        [[x0 - t - .02, x1 + t + .02, z0 - t - .02, z0 - t], [x0 - t - .02, x0 - t, z0, z1 + t], [x1 + t, x1 + t + .02, z0, z1 + t]].forEach(([a, b, c, d]) => pbox(b - a, .6, d - c, cement, (a + b) / 2, .3, (c + d) / 2, O, { cast: false }));
        W(x0, cxC - dg, z1, z1 + t, .7, 0, cement); W(cxC + dg, x1, z1, z1 + t, .7, 0, cement);
        W(x0, cxC - dg, z1, z1 + t, ch - 2.6, 2.6, brick); W(cxC + dg, x1, z1, z1 + t, ch - 2.6, 2.6, brick); pbox(dg * 2, ch - 2.3, t, brick, cxC, 2.3 + (ch - 2.3) / 2, z1 + t / 2, O);
        [[x0 + .1, cxC - dg - .1], [cxC + dg + .1, x1 - .1]].forEach(([a, b]) => { pmesh(new THREE.PlaneGeometry(b - a, 1.85), glassG, (a + b) / 2, 1.65, z1 + .12, O, { cast: false }); for (let k = 0; k <= 3; k++) pbox(.05, 1.9, .06, frameM, a + k * (b - a) / 3, 1.65, z1 + .12, O, { cast: false }); });
        [-1, 1].forEach(s => { pbox(.05, 2.3, .07, frameM, cxC + s * dg, 1.15, z1 + .12, O, { cast: false }); const lp = new THREE.Group(); lp.position.set(cxC + s * dg, 0, z1 + .12); lp.rotation.y = s * .9; lp.userData.dynamic = true; O.add(lp); pmesh(new THREE.PlaneGeometry(dg - .05, 2.2), glassG, -s * dg / 2, 1.12, 0, lp, { cast: false }); pbox(.04, 2.2, .05, frameM, -s * (dg - .03), 1.12, 0, lp, { cast: false }); });
        // 녹색 차양 · 간판 (학우매점 · 녹색/노랑 띠) · 측면 문구판
        pbox(cw + .3, .06, 1.3, awnM, cxC, 2.55, z1 + .8, O, { rx: .22, cast: false });
        pbox(4.6, .9, .12, PM(0xf4f4f0, .5), cxC, 3.05, z1 + .3, O, { cast: false });
        pmesh(new THREE.PlaneGeometry(3.0, .8), new THREE.MeshBasicMaterial({ map: makeSign('학 우 매 점', '#f4f4f0', '#1e3a8a', 52) }), cxC, 3.05, z1 + .37, O, { cast: false });
        [-1, 1].forEach(s => { pbox(.6, .12, .02, PM(0x2a8a3a, .6), cxC + s * 1.95, 3.15, z1 + .38, O, { cast: false }); pbox(.6, .12, .02, PM(0xd8b020, .6), cxC + s * 1.95, 2.98, z1 + .38, O, { cast: false }); });
        pmesh(new THREE.PlaneGeometry(1.3, 1.5), new THREE.MeshBasicMaterial({ map: makeSign('맛있는 간식 · 행복한 학교생활', '#f6f2e6', '#2a3a2a', 18) }), x0 - t - .03, 1.9, czC + .6, O, { ry: -Math.PI / 2, cast: false });
        // 실내 칸막이: 소형 창고 (북서 2.0×1.8) · 직원 준비공간 (3.0×1.8) — 판매장 쪽 출입구
        const zP = z0 + 1.8, xS = x0 + 2.0, xP = xS + 3.0;
        [[x0, xS - 1.1], [xS - .2, xP - 1.15], [xP - .25, xP]].forEach(([a, b]) => W(a, b, zP, zP + .12, ch, 0, plaster));
        [[xS - 1.1, xS - .2], [xP - 1.15, xP - .25]].forEach(([a, b]) => pbox(b - a, ch - 2.1, .12, plaster, (a + b) / 2, 2.1 + (ch - 2.1) / 2, zP + .06, O, { cast: false }));
        pbox(.1, ch, 1.8, plaster, xS, ch / 2, z0 + .9, O); F0.col.push({ x1: xS - .05, x2: xS + .05, z1: z0, z2: zP }); pbox(.1, ch, 1.8, plaster, xP, ch / 2, z0 + .9, O); F0.col.push({ x1: xP - .05, x2: xP + .05, z1: z0, z2: zP });
        // 창고: 철제 선반 · 상자 / 준비공간: 싱크대 · 작업대
        [x0 + .5, x0 + 1.45].forEach(x => { pbox(.9, 1.8, .45, PM(0x7a7e82, .5, .5), x, .9, z0 + .25, O); for (let r = 0; r < 3; r++) pbox(.75, .3, .35, PM(0xb08a58, .9), x, .35 + r * .55, z0 + .27, O); }); F0.col.push({ x1: x0, x2: x0 + 1.95, z1: z0, z2: z0 + .5 });
        pbox(2.4, .85, .6, PM(0xc8ccd0, .35, .6), xS + 1.4, .425, z0 + .3, O); pbox(.5, .02, .4, PM(0x30363a, .3, .7), xS + .9, .86, z0 + .3, O); F0.col.push({ x1: xS + .2, x2: xS + 2.6, z1: z0, z2: z0 + .6, h: .85 });
        // 서벽 음료 냉장고 (1200×700×2000 · 유리문)
        { const fx = x0 + .35, fz = zP + 1.3; pbox(.7, 2.0, 1.2, PM(0x1a3a6a, .4, .3), fx, 1.0, fz, O); pmesh(new THREE.PlaneGeometry(1.1, 1.75), new THREE.MeshStandardMaterial({ color: 0xc8e4f0, emissive: 0x8ac8e8, emissiveIntensity: .45, transparent: true, opacity: .55 }), fx + .36, 1.05, fz, O, { ry: Math.PI / 2, cast: false });
          for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) pcyl(.035, .035, .22, PM([0xd83a2a, 0x2a8a3a, 0xe8b020, 0x3a6ad8][(r + k) % 4], .4), fx + .2, .35 + r * .42, fz - .45 + k * .18, O);
          pbox(1.1, .24, .04, PM(0x1e3a8a, .5), fx + .37, 1.98, fz, O, { ry: Math.PI / 2, cast: false }); F0.col.push({ x1: x0, x2: x0 + .72, z1: fz - .6, z2: fz + .6 }); }
        // 중앙 스낵 · 간식 진열대 2열 (900×450×1500 × 3) · 남서 빵 · 간식 진열대
        const snackC = [0xd83a2a, 0xe8b020, 0x2a8a3a, 0x3a6ad8, 0xe86a20, 0x8a3ab0];
        const gondola = (x, z, len, alongX = true) => { const n = Math.round(len / .9); pbox(alongX ? len : .45, 1.5, alongX ? .45 : len, creamM, x, .75, z, O);
          for (let r = 0; r < 4; r++) for (let k = 0; k < n * 3; k++) { const tt = -len / 2 + (k + .5) * len / (n * 3); [-1, 1].forEach(sd => pbox(alongX ? .26 : .06, .24, alongX ? .06 : .26, PM(snackC[(k + r + (sd > 0 ? 2 : 0)) % 6], .55), x + (alongX ? tt : sd * .2), .32 + r * .33, z + (alongX ? sd * .2 : tt), O, { cast: false })); }
          F0.col.push({ x1: x - (alongX ? len / 2 : .23), x2: x + (alongX ? len / 2 : .23), z1: z - (alongX ? .23 : len / 2), z2: z + (alongX ? .23 : len / 2) }); };
        gondola(cxC - .7, zP + 1.35, 2.7); gondola(cxC - .7, zP + 2.65, 2.7);
        gondola(x0 + 1.2, z1 - .35, 1.8);
        // 동남 판매대 / 계산대 (1800×700×850) + 금전등록기 · POS 모니터 · 가격표
        { const kx = x1 - 1.4, kz = z1 - 1.45; pbox(1.8, .85, .7, creamM, kx, .425, kz, O); pbox(1.84, .04, .74, PM(0x2a6a46, .5), kx, .87, kz, O); pbox(.3, .14, .3, PM(0x2a2c2e, .4, .5), kx - .4, .96, kz, O); pbox(.36, .26, .04, PM(0x101418, .4, .5), kx + .3, 1.06, kz - .1, O); pbox(.32, .22, .01, new THREE.MeshBasicMaterial({ color: 0x3a8ad8 }), kx + .3, 1.06, kz - .07, O, { cast: false });
          F0.col.push({ x1: kx - .9, x2: kx + .9, z1: kz - .35, z2: kz + .35, h: .9 });
          pmesh(new THREE.PlaneGeometry(1.0, 1.2), new THREE.MeshBasicMaterial({ map: makeSign('학우매점 · 라면 600 · 삼각김밥 700 · 빵 800 · 음료수 1,000', '#f2f2ea', '#1e3a8a', 14) }), x1 - .03, 1.8, kz, O, { ry: -Math.PI / 2, cast: false }); }
        world.props.push({ kind: 'robj', k: 'canteen_counter', t: 'campus', floor: 0, x: x1 - 1.4, z: z1 - .7, y: 1.15, r: 2.3, label: '학우매점 계산대 금전등록기 · 호빵 온장고 조사하기' });
        // 북동 컵라면 코너: 컵라면 진열대 · 전자레인지 2 · 온수기 · 바 카운터 + 스툴 3
        { const rx = x1 - .35; pbox(.6, .9, 2.4, woodM, rx, .45, z0 + 1.4, O); F0.col.push({ x1: x1 - .65, x2: x1, z1: z0 + .2, z2: z0 + 2.6, h: .9 });
          [z0 + .6, z0 + 1.2].forEach(z => { pbox(.42, .3, .52, PM(0xe8e8e4, .4, .3), rx, 1.05, z, O); pbox(.01, .2, .32, PM(0x1a1a1a, .3), rx - .22, 1.05, z - .05, O, { cast: false }); });
          pcyl(.15, .15, .52, PM(0xc8ccd0, .25, .8), rx, 1.16, z0 + 2.0, O);
          pbox(.45, 1.5, .9, creamM, x1 - .3, .75, z0 + 3.3, O); for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) pcyl(.06, .05, .1, PM([0xd83a2a, 0xe8b020, 0x2a6ad8][k], .5), x1 - .52, .35 + r * .33, z0 + 3.0 + k * .3, O); F0.col.push({ x1: x1 - .55, x2: x1, z1: z0 + 2.85, z2: z0 + 3.75 });
          pmesh(new THREE.PlaneGeometry(1.4, .3), new THREE.MeshBasicMaterial({ map: makeSign('컵라면 코너', '#f2e8c8', '#a82020', 22) }), x1 - .03, 2.3, z0 + 1.4, O, { ry: -Math.PI / 2, cast: false });
          [z0 + .7, z0 + 1.4, z0 + 2.1].forEach(z => { pcyl(.17, .17, .05, PM(0x3a4a4a, .5), x1 - 1.1, .65, z, O); pcyl(.03, .03, .63, darkF, x1 - 1.1, .32, z, O); }); }
        // 천장 형광등 · 실외 쓰레기통 · 화분 · 벤치
        const lampM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 1.1 });
        [[-2, .3], [1.6, .3], [-2, 2], [1.6, 2]].forEach(([dx, dz]) => pbox(1.2, .04, .3, lampM, cxC + dx, ch - .08, czC + dz - .6, O, { cast: false }));
        [[x1 - 1.0, 0x2a5aa8], [x1 - .55, 0x7a7e82]].forEach(([x, c]) => { pbox(.4, .7, .4, PM(c, .5, .3), x, .35, z1 + .7, O); F0.col.push({ x1: x - .2, x2: x + .2, z1: z1 + .5, z2: z1 + .9 }); });
        [[cxC - 2.2, z1 + .7], [cxC + 2.2, z1 + .7]].forEach(([x, z]) => { pbox(.9, .4, .4, cement, x, .2, z, O); pmesh(new THREE.DodecahedronGeometry(.32, 1), leafM, x, .62, z, O); F0.col.push({ x1: x - .45, x2: x + .45, z1: z - .2, z2: z + .2 }); });
        pbox(1.6, .42, .45, cement, x0 - .8, .21, z1 + 1.6, O); F0.col.push({ x1: x0 - 1.6, x2: x0, z1: z1 + 1.37, z2: z1 + 1.83, h: .45 });
        // 매점 양옆 야외 파라솔 테이블 세트 2조
        [56.8, 66.8].forEach((tx, ti) => {
          const tz = 24.5;
          pcyl(.68, .68, .06, PM(0x4e4c46, .85), tx, .74, tz, O);
          pcyl(.06, .08, .74, darkF, tx, .37, tz, O);
          pcyl(.04, .04, 2.15, darkF, tx, 1.08, tz, O);
          pmesh(new THREE.ConeGeometry(1.45, .48, 12), ti % 2 ? PM(0x2e3c36, .85) : PM(0x4c2824, .85), tx, 2.28, tz, O);
          [0, 1.57, 3.14, 4.71].forEach(a => pbox(.38, .44, .38, woodM, tx + Math.cos(a) * 1.05, .22, tz + Math.sin(a) * 1.05, O));
          F0.col.push({ x1: tx - .85, x2: tx + .85, z1: tz - .85, z2: tz + .85 });
        });
      }
      // ④ 북동쪽 공터: 「해교 야외 원형 음악당(Amphitheater) & 야외 공연 무대」 (x: 30.6 ~ 39.4, z: -52.5 ~ -40.5 — 북부 메인 보행로 z=-35.2~-32.4 북쪽에 배치하여 도로·별관 침범 0건!)
      {
        // 야외음악당 리모델링 (참고 평면도 · 7.60 × 7.00m · 철골 + 방수 아치 지붕 · 높이 약 4.0m): 북측 목재 데크 무대 (약 6.0 × 3.0m · 걸어 오를 수 있는 높이) · 무대 뒷벽 · 아치형 캐노피 + 기둥 4 · 조명 트러스 (PAR 조명) · 메인 스피커 2 · 드럼 · 마이크 스탠드 · 장비 보관함 · 전기 분전함 / 남측 계단식 관람석 3열 (목재 벤치 · 중앙 통로) · 화단
        const ax = 35.0, az = -48.5, x0 = ax - 3.8, x1 = ax + 3.8, z0 = az - 3.5, z1 = az + 3.5;
        const paveM = PM(0xb8b4aa, .8), deckM = PM(0xb07a44, .7), concM = PM(0xa8a49a, .85), steelM = PM(0x8a9094, .45, .6), roofM2 = new THREE.MeshStandardMaterial({ color: 0xc8bca4, roughness: .7, side: THREE.DoubleSide });
        pbox(7.6, .05, 7.0, paveM, ax, .025, az, O, { cast: false });
        // 무대 (6.0 × 3.0 · 높이 0.32) + 뒷벽 (높이 1.8) + 측면 블록
        const sz0 = z0 + .2, sz1 = sz0 + 3.0; pbox(6.0, .32, 3.0, deckM, ax, .16, (sz0 + sz1) / 2, O); for (let k = 0; k < 15; k++) pbox(.01, .005, 3.0, PM(0x6a4424, .8), ax - 3 + k * .4, .322, (sz0 + sz1) / 2, O, { cast: false });
        F0.col.push({ x1: ax - 3.0, x2: ax + 3.0, z1: sz0, z2: sz1, h: .32 });
        pbox(6.4, 1.8, .3, concM, ax, .9, z0 + .05, O); F0.col.push({ x1: ax - 3.2, x2: ax + 3.2, z1: z0 - .1, z2: z0 + .2 });
        [-1, 1].forEach(s => { pbox(.7, .9, 2.0, concM, ax + s * 3.45, .45, sz0 + 1.0, O); F0.col.push({ x1: ax + s * 3.45 - .35, x2: ax + s * 3.45 + .35, z1: sz0, z2: sz0 + 2.0 }); });
        // 아치형 캐노피 (현 7.6m · 높이 0.8m) + 기둥 4
        { const R = 9.4, th = 2 * Math.asin(3.9 / R), top = 4.1, geo = new THREE.CylinderGeometry(R, R, 4.4, 24, 1, true, -th / 2, th); geo.rotateX(-Math.PI / 2); pmesh(geo, roofM2, ax, top - R, sz0 + 1.5, O); }
        [[-3.6, sz0 - .1], [3.6, sz0 - .1], [-3.6, sz1 + .2], [3.6, sz1 + .2]].forEach(([dx, z]) => { pbox(.18, 3.4, .18, steelM, ax + dx, 1.7, z, O); F0.col.push({ x1: ax + dx - .1, x2: ax + dx + .1, z1: z - .1, z2: z + .1 }); });
        // 조명 트러스 · PAR 조명 · 스피커 · 드럼 · 마이크 스탠드 · 장비 보관함 · 분전함
        pbox(6.8, .2, .2, steelM, ax, 3.3, sz1, O, { cast: false });
        [0xff3030, 0x30a0ff, 0xffd030, 0x30ff80, 0xd040ff, 0xffffff].forEach((c, k) => { pcyl(.11, .13, .22, PM(0x1a1a1a, .5, .4), ax - 2.5 + k * 1.0, 3.12, sz1, O); pmesh(new THREE.CircleGeometry(.1, 12), new THREE.MeshBasicMaterial({ color: c }), ax - 2.5 + k * 1.0, 3.0, sz1 + .001, O, { rx: Math.PI / 2, cast: false }); });
        [-1, 1].forEach(s => { pbox(.6, 1.0, .6, PM(0x141416, .6), ax + s * 2.6, .82, sz1 - .4, O); pmesh(new THREE.CircleGeometry(.2, 16), PM(0x2a2a2e, .4, .3), ax + s * 2.6, .9, sz1 - .099, O, { cast: false }); F0.col.push({ x1: ax + s * 2.6 - .3, x2: ax + s * 2.6 + .3, z1: sz1 - .7, z2: sz1 - .1 }); });
        { const dx = ax, dz = sz0 + .9; [[0, 0, .28], [.45, .25, .18], [-.45, .25, .18]].forEach(([a, b, r]) => pcyl(r, r, .3, PM(0xe8e8e4, .5), dx + a, .5 + b, dz + b * .5, O)); pcyl(.35, .35, .4, PM(0xe8e8e4, .5), dx, .52, dz - .45, O); F0.col.push({ x1: dx - .7, x2: dx + .7, z1: dz - .8, z2: dz + .45 }); }
        [-1.2, 0, 1.2].forEach(d => { pcyl(.12, .12, .02, PM(0x1a1a1a, .5), ax + d, .33, sz1 - .5, O); pcyl(.012, .012, 1.4, PM(0x1a1a1a, .4, .5), ax + d, 1.02, sz1 - .5, O); });
        pcyl(.04, .18, 1.05, darkF, ax + .6, .84, sz0 + 1.9, O); pbox(.52, .34, .04, woodM, ax + .6, 1.38, sz0 + 1.9, O, { rx: -.35 });   // 지휘 보면대
        [-1, 1].forEach(s => { pbox(1.2, .8, .8, PM(0x1a1a1c, .5, .4), ax + s * 2.4, .72, z0 + .7, O); F0.col.push({ x1: ax + s * 2.4 - .6, x2: ax + s * 2.4 + .6, z1: z0 + .3, z2: z0 + 1.1 }); });
        pbox(.5, .7, .2, PM(0xc8ccd0, .4, .5), ax + 3.0, 1.2, z0 + .3, O);
        // 남측 계단식 관람석 3열 (목재 벤치 · 중앙 통로 · 높이 0.15 단씩)
        { const cxA = ax, czA = sz1 - .3; [2.3, 3.0, 3.7].forEach((R, r) => { const h = .15 * (r + 1), n = 7; [-1, 1].forEach(s => { for (let k = 0; k < n; k++) { const a = s * (.18 + (k + .5) * (1.0 / n)), px = cxA + Math.sin(a) * R, pz = czA + Math.cos(a) * R; const L = 2 * R * Math.sin(.5 / n) + .05;
              if (pz > z1 - .1) continue; const m1 = pbox(L, h, .6, concM, px, h / 2, pz, O); m1.rotation.y = a; const m2 = pbox(L, .05, .4, deckM, px, h + .025, pz, O, { cast: false }); m2.rotation.y = a; F0.col.push({ x1: px - .3, x2: px + .3, z1: pz - .3, z2: pz + .3, h: h + .05 }); } }); }); }
        // 화단 (남서 · 남동 모서리)
        [[x0 + .5, z1 - .5], [x1 - .5, z1 - .5]].forEach(([x, z]) => { pbox(1.0, .4, 1.0, concM, x, .2, z, O); pmesh(new THREE.DodecahedronGeometry(.45, 1), leafM, x, .7, z, O); F0.col.push({ x1: x - .5, x2: x + .5, z1: z - .5, z2: z + .5 }); });
        pmesh(new THREE.PlaneGeometry(3.4, .44), new THREE.MeshBasicMaterial({ map: makeSign('해교 야외 음악당 — 청춘의 선율', '#1b2838', '#f2e8cc', 24) }), ax, 2.6, z0 - .12, O, { ry: Math.PI, cast: false });
        world.props.push({ kind: 'robj', k: 'amphitheater_stand', t: 'campus', floor: 0, x: ax + .6, z: sz0 + 2.6, y: 1.2, r: 2.2, label: '야외 음악당 지휘 보면대 조사하기' });
      }

      // ⑤ 정문 안쪽 동·서 공터: 「교직원 전용 주차장 & 전통 목조 육각정 쉼터 · 캠퍼스 종합 안내도」
      {
        // 정문 동편 교직원 주차장 (x: 15.5 ~ 36.5, z: 60.5 ~ 67.2)
        pbox(21.0, .02, 6.8, PM(0x282a2e, .9), 26.0, .01, 63.8, O, { cast: false });
        for (let k = 0; k <= 6; k++) pbox(.10, .025, 4.8, whiteM, 17.0 + k * 3.0, .015, 64.5, O, { cast: false });
        for (let k = 0; k < 6; k++) pbox(1.8, .10, .14, goldM, 18.5 + k * 3.0, .05, 66.2, O, { cast: false });
        pbox(.12, 1.8, .12, darkF, 15.2, .9, 61.2, O);
        pmesh(new THREE.PlaneGeometry(1.7, .42), new THREE.MeshBasicMaterial({ map: makeSign('교직원 및 방문객 전용 주차장', '#182c38', '#f0ece0', 20) }), 15.2, 1.65, 61.12, O, { ry: Math.PI, cast: false });
        // 주차된 교직원 승용차 2대 (x = 21.5, 27.5, z = 64.2)
        [[21.5, 0x384454], [27.5, 0x543838]].forEach(([cxP, colP]) => {
          const cg = new THREE.Group(); cg.position.set(cxP, 0, 64.2); cg.userData.dynamic = true; O.add(cg);
          pbox(1.85, .68, 4.2, PM(colP, .35, .5), 0, .68, 0, cg);
          pbox(1.65, .55, 2.1, PM(0x181c22, .2, .4), 0, 1.28, -.15, cg);
          [[-.88, 1.3], [.88, 1.3], [-.88, -1.3], [.88, -1.3]].forEach(([wx, wz]) => pcyl(.34, .34, .24, darkF, wx, .34, wz, cg, { rz: Math.PI / 2 }));
          F0.col.push({ x1: cxP - 1.0, x2: cxP + 1.0, z1: 62.0, z2: 66.4 });
        });

        // 정문 서편 전통 목조 육각정 쉼터 & 캠퍼스 종합 안내도 (x = -11.5, z = 63.5)
        const pxP = -11.5, pzP = 63.5;
        pcyl(2.3, 2.4, .28, baseM, pxP, .14, pzP, O, { seg: 6 });
        for (let a = 0; a < 6; a++) {
          const an = a * Math.PI / 3;
          pcyl(.10, .10, 2.4, woodM, pxP + Math.cos(an) * 1.85, 1.48, pzP + Math.sin(an) * 1.85, O);
        }
        pmesh(new THREE.ConeGeometry(2.85, 1.15, 6), darkF, pxP, 3.22, pzP, O);
        pmesh(new THREE.PlaneGeometry(1.4, .30), new THREE.MeshBasicMaterial({ map: makeSign('청 운 정 (학부모 쉼터)', '#2a1c12', '#e8d8b0', 22) }), pxP, 2.55, pzP - 1.88, O, { ry: Math.PI, cast: false });
        F0.col.push({ x1: pxP - 1.9, x2: pxP + 1.9, z1: pzP - 1.9, z2: pzP + 1.9, h: .28 });

        // 정문 진입로 서편 대형 「캠퍼스 종합 안내도」 입간판 (x = -5.8, z = 62.2)
        pbox(.14, 2.3, .14, darkF, -6.8, 1.15, 62.2, O); pbox(.14, 2.3, .14, darkF, -4.4, 1.15, 62.2, O);
        pbox(2.6, 1.35, .12, woodM, -5.6, 1.65, 62.2, O);
        pmesh(new THREE.PlaneGeometry(2.42, 1.18), new THREE.MeshBasicMaterial({ map: makeSign('서문고 캠퍼스 종합 안내도 — 본관·별관(2F구름다리)·대강당·체육관·수영장·온실·매점·음악당', '#162834', '#f0ead6', 18) }), -5.6, 1.65, 62.13, O, { ry: Math.PI, cast: false });
        F0.col.push({ x1: -6.9, x2: -4.3, z1: 62.0, z2: 62.4 });
        world.props.push({ kind: 'robj', k: 'campus_map_board', t: 'campus', floor: 0, x: -5.6, z: 61.3, y: 1.5, r: 2.0, label: '캠퍼스 종합 안내도 살펴보기' });
      }
    }
    buildMegaCampus15000({ THREE, OUT: O, F0, PM, pbox, pmesh, pcyl, makeSign, makeGlowTex, world, megaP });
    // 안쪽 무대 뒤편 대형 자주빛 벨벳 막과 현수막
    [-6.2, 6.2].forEach(dx => pbox(2.8, 5.4, .18, PM(0x581822, .85), G.x + dx, 2.7, z0 + .55, O));
    pbox(14.8, .85, .16, PM(0x4a121b, .85), G.x, 5.2, z0 + .62, O);
    pmesh(new THREE.PlaneGeometry(7.2, .62), new THREE.MeshBasicMaterial({ map: makeSign('제 42 회  해 교 고 등 학 교  졸 업 식', '#1e2836', '#f2e8cc', 26) }), G.x, 5.18, z0 + .72, O, { cast: false });
    for (let k = 0; k < 6; k++) { const lx = G.x + (k % 2 ? 4.5 : -4.5), lz = G.z - 9 + ((k / 2) | 0) * 9;
      pbox(1.4, .08, .5, new THREE.MeshStandardMaterial({ color: 0xe8f0ff, emissive: 0xc8d8f0, emissiveIntensity: .9 }), lx, H - .2, lz, O, { cast: false });
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('200,215,240'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .25 })); gl.scale.setScalar(5); gl.position.set(lx, H - .8, lz); gl.userData.dynamic = true; O.add(gl); }
    // 무대(높이 1.1) · 커튼 충돌 — 무대는 앞쪽 계단으로 오른다
    F0.col.push({ x1: G.x - 8, x2: G.x + 8, z1: z0, z2: z0 + 4.75, h: 1.1 });
    [0, 1, 2, 3].forEach(k => { pbox(2.4, .275, .35, PM(0x3a2a1e, .8), G.x + 5, .1375 + k * .275, z0 + 5.1 + (3 - k) * .35, O); F0.col.push({ x1: G.x + 3.8, x2: G.x + 6.2, z1: z0 + 4.75 + (3 - k) * .35, z2: z0 + 5.1 + (3 - k) * .35, h: .275 * (k + 1) }); });
    F0.col.push({ x1: x0 + 1.3, x2: x0 + 3.7, z1: z0 + 4.45, z2: z0 + 4.75 });
    // 대강당 리모델링 (참고 배치도 · 18.0 × 26.0m · 층고 약 8m): 북측 무대 (기존) + 무대 커튼 (프로시니엄 · 상부 막) · 태극기 · 그랜드피아노 · 무대 조명 바 · 메인 스피커 / 객석 (좌우 2블록 · 중앙 통로 2m · 측면 통로) / 남동 음향·조명 조정실 (창 · 음향 콘솔 · 랙) · 남서 준비실 (대기실) · 비상구 2 (동 · 서)
    { const red = PM(0x8a1420, .85), fab = PM(0xa8743c, .75), legM = PM(0x2a2c2e, .5, .5);
      [-1, 1].forEach(s => pbox(1.6, 6.0, .3, red, G.x + s * 8.1, 3.0, z0 + 4.6, O)); pbox(17.6, 1.0, .3, red, G.x, 6.6, z0 + 4.6, O);
      { const c = document.createElement('canvas'); c.width = 900; c.height = 600; const g2 = c.getContext('2d'), D = 300, cx = 450, cy = 300, R = D / 2;
        // 태극기 (국기의 제작 방법 기준: 가로:세로 3:2 · 태극 지름 = 세로의 1/2 · 괘 길이 D/2 · 획 굵기 D/12 · 간격 D/24 · 태극과 괘 사이 D/4)
        g2.fillStyle = '#ffffff'; g2.fillRect(0, 0, 900, 600);
        const ang = Math.atan2(2, 3); g2.save(); g2.translate(cx, cy); g2.rotate(ang);
        g2.fillStyle = '#0047a0'; g2.beginPath(); g2.arc(0, 0, R, 0, Math.PI * 2); g2.fill();
        g2.fillStyle = '#cd2e3a'; g2.beginPath(); g2.arc(0, 0, R, Math.PI, 0); g2.fill();
        g2.beginPath(); g2.arc(-R / 2, 0, R / 2, 0, Math.PI * 2); g2.fill();
        g2.fillStyle = '#0047a0'; g2.beginPath(); g2.arc(R / 2, 0, R / 2, 0, Math.PI * 2); g2.fill(); g2.restore();
        const bw = D / 12, gap = D / 24, len = D / 2;
        // [대각선 방향(x부호, y부호), 안쪽부터 획 3개 (1 = 이은 획, 0 = 끊은 획)]: 건(좌상 ☰) · 곤(우하 ☷) · 감(우상 ☵) · 리(좌하 ☲)
        [[-1, -1, [1, 1, 1]], [1, 1, [0, 0, 0]], [1, -1, [0, 1, 0]], [-1, 1, [1, 0, 1]]].forEach(([sx, sy, bars]) => {
          g2.save(); g2.translate(cx, cy); g2.rotate(Math.atan2(sy * 2, sx * 3)); g2.fillStyle = '#000000';
          bars.forEach((solid, k) => { const x = R + D / 4 + k * (bw + gap);
            if (solid) g2.fillRect(x, -len / 2, bw, len); else { const h = (len - gap) / 2; g2.fillRect(x, -len / 2, bw, h); g2.fillRect(x, gap / 2, bw, h); } });
          g2.restore(); });
        const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; pmesh(new THREE.PlaneGeometry(2.4, 1.6), new THREE.MeshStandardMaterial({ map: tx, roughness: .7 }), G.x, 3.4, z0 + .66, O, { cast: false }); }
      { const px = G.x - 2.6, pz = z0 + 2.4; pbox(1.5, .32, 1.9, PM(0x0c0c0e, .25, .4), px, 1.1 + .62, pz, O); pbox(1.45, .04, 1.85, PM(0x0c0c0e, .2, .4), px - .2, 2.1, pz, O, { rz: .5 }); [[-.6, -.8], [.6, -.8], [0, .8]].forEach(([a, b]) => pbox(.08, .62, .08, PM(0x0c0c0e, .3, .4), px + a, 1.1 + .31, pz + b, O, { cast: false })); pbox(1.4, .06, .3, PM(0xf4f4f0, .4), px, 1.1 + .79, pz + .95, O, { cast: false }); F0.col.push({ x1: px - .75, x2: px + .75, z1: pz - .95, z2: pz + 1.05 }); }
      pbox(17.0, .2, .3, PM(0x1a1a1c, .5, .5), G.x, 6.2, z0 + 5.6, O, { cast: false }); for (let k = 0; k < 8; k++) pcyl(.12, .15, .3, PM(0x1a1a1c, .5, .5), G.x - 7 + k * 2, 5.95, z0 + 5.6, O);
      [-1, 1].forEach(s => { pbox(.6, 1.0, .6, PM(0x141416, .6), G.x + s * 5.4, 1.6, z0 + .6, O); F0.col.push({ x1: G.x + s * 5.4 - .3, x2: G.x + s * 5.4 + .3, z1: z0 + .3, z2: z0 + .9 }); });
      // 객석 (좌석 W540 · 좌우 각 12석 · 열 간격 0.9m) — 좌석은 재질별로 합쳐 메시 수를 줄인다
      const gS = [], gL = [], rows = []; for (let zr = z0 + 7.8; zr < z1 - 4.4; zr += .9) rows.push(zr);
      rows.forEach(zr => [[G.x - 7.6, G.x - 1.0], [G.x + 1.0, G.x + 7.6]].forEach(([a, b]) => { const n = Math.floor((b - a) / .55);
        for (let k = 0; k < n; k++) { const x = a + .275 + k * .55; gS.push(new THREE.BoxGeometry(.5, .08, .45).translate(x, .45, zr), new THREE.BoxGeometry(.5, .5, .07).translate(x, .75, zr + .24)); gL.push(new THREE.BoxGeometry(.04, .45, .04).translate(x - .22, .225, zr), new THREE.BoxGeometry(.04, .45, .04).translate(x + .22, .225, zr), new THREE.BoxGeometry(.05, .3, .45).translate(x + .27, .6, zr)); }
        F0.col.push({ x1: a, x2: b, z1: zr - .25, z2: zr + .3, h: .5 }); }));
      const mS = new THREE.Mesh(mergeGeometries(gS), fab), mL = new THREE.Mesh(mergeGeometries(gL), legM); [mS, mL].forEach(m => { m.userData.dynamic = true; O.add(m); });
      // 남동 음향·조명 조정실 · 남서 준비실 (대기실)
      const room = (ax, bx, az, bz, doorX) => { const h = 3.0; [[ax, bx, az, az + .12, true], [ax, ax + .12, az, bz], [bx - .12, bx, az, bz]].forEach(([a, b, c, d, front]) => { if (front) { [[a, doorX - .5], [doorX + .5, b]].forEach(([p, q]) => { pbox(q - p, h, d - c, wallM, (p + q) / 2, h / 2, (c + d) / 2, O); F0.col.push({ x1: p, x2: q, z1: c, z2: d }); }); pbox(1.0, h - 2.1, d - c, wallM, doorX, 2.1 + (h - 2.1) / 2, (c + d) / 2, O); } else { pbox(b - a, h, d - c, wallM, (a + b) / 2, h / 2, (c + d) / 2, O); F0.col.push({ x1: a, x2: b, z1: c, z2: d }); } }); pbox(bx - ax, .1, bz - az, wallM, (ax + bx) / 2, h, (az + bz) / 2, O, { cast: false }); };
      room(x1 - 4.2, x1, z1 - 3.6, z1, x1 - 1.2); room(x0, x0 + 4.2, z1 - 3.6, z1, x0 + 1.2);
      pmesh(new THREE.PlaneGeometry(2.2, 1.0), new THREE.MeshStandardMaterial({ color: 0x98c8d8, roughness: .1, transparent: true, opacity: .4, side: THREE.DoubleSide }), x1 - 2.8, 1.6, z1 - 3.66, O, { cast: false });
      { const kx = x1 - 2.6, kz = z1 - 2.8; pbox(1.6, .78, .8, PM(0x1e2024, .5, .4), kx, .39, kz, O); pbox(1.5, .05, .7, PM(0x2a2e34, .4, .5), kx, .8, kz, O, { rx: -.2 }); F0.col.push({ x1: kx - .8, x2: kx + .8, z1: kz - .4, z2: kz + .4, h: .8 }); pbox(.6, 1.8, .6, PM(0x141416, .5, .5), x1 - .5, .9, z1 - .5, O); F0.col.push({ x1: x1 - .8, x2: x1 - .2, z1: z1 - .8, z2: z1 - .2 }); }
      { pbox(.04, 1.2, 1.6, PM(0xd8e4ec, .1, .9), x0 + .15, 1.5, z1 - 1.9, O, { cast: false }); [0, 1, 2].forEach(k => { pbox(.45, .45, .45, PM(0x3a3e42, .6), x0 + 1.2 + k * .8, .22, z1 - .6, O); }); F0.col.push({ x1: x0 + .95, x2: x0 + 3.1, z1: z1 - .85, z2: z1 - .35, h: .45 });
        pmesh(new THREE.PlaneGeometry(1.0, .26), new THREE.MeshBasicMaterial({ map: makeSign('준비실 (대기실)', '#2a2c2e', '#f0ece0', 20) }), x0 + 2.6, 2.4, z1 - 3.5, O, { ry: Math.PI, cast: false });
        pmesh(new THREE.PlaneGeometry(1.0, .26), new THREE.MeshBasicMaterial({ map: makeSign('음향 · 조명 조정실', '#2a2c2e', '#f0ece0', 18) }), x1 - 2.2, 2.4, z1 - 3.5, O, { ry: Math.PI, cast: false }); }
      // 비상구 (동 · 서 측벽 앞쪽)
      [-1, 1].forEach(s => { const wx = s < 0 ? x0 + .02 : x1 - .02; pbox(.06, 2.2, 1.4, PM(0x5a5e60, .5, .5), wx, 1.1, z0 + 7.5, O, { cast: false }); pmesh(new THREE.PlaneGeometry(.6, .22), new THREE.MeshBasicMaterial({ map: makeSign('비 상 구', '#0a3a1a', '#7dffa0', 22) }), wx + s * -.04, 2.5, z0 + 7.5, O, { ry: s < 0 ? Math.PI / 2 : -Math.PI / 2, cast: false }); }); }
    world.lockers.push({ floor: 0, x: x0 + 2.5, z: z0 + 5.2, y: 0, dir: { x: 0, z: 1 }, noPick: false, label: '벨벳 커튼 뒤에 숨기' }); }
  { const bb = new THREE.Box3(), c = new THREE.Vector3(); O.children.slice(audN0).forEach(o => { bb.setFromObject(o); if (bb.isEmpty()) return; bb.getCenter(c); if (Math.abs(c.x - G.x) < G.w / 2 + 2 && Math.abs(c.z - G.z) < G.d / 2 + 2.5) o.userData.rbKeep = true; }); }
  // ② 중정: 석상 받침대 충돌 · 고목 몇 그루
  F0.col.push({ x1: C.x - 2.5, x2: C.x + 2.5, z1: C.z - 2.5, z2: C.z + 2.5, h: .6 }, { x1: C.x - .55, x2: C.x + .55, z1: C.z + 3.05, z2: C.z + 4.15 });   // 중앙 원형 화단 · 창립자 흉상
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => { const px = C.x + sx * 5.2, pz = C.z + sz * 5.2;
    [[C.x + sx * 7.0, pz, 1.8, 3.4], [px, C.z + sz * 7.0, 3.4, 1.8]].forEach(([x, z, w, d]) => F0.col.push({ x1: x - w / 2, x2: x + w / 2, z1: z - d / 2, z2: z + d / 2, h: .6 }));
    [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(([a, b]) => F0.col.push({ x1: px + a - .1, x2: px + a + .1, z1: pz + b - .1, z2: pz + b + .1 }));
    F0.col.push({ x1: px - .9, x2: px + .9, z1: pz + sz * .9 - .3, z2: pz + sz * .9 + .3, h: .5 }); });
  // ③ 지하 방공호(보존서고) 대폭 리모델링 (강화 콘크리트 늑골 아치 · 헤비 스틸 방폭문 · 수동 환기 송풍기 · 기밀 서류함 · 군용 보급상자 · 상황판)
  //    + 지하 펌프실(cx = 24) 폴리스라인 & 1998 서문일보 지역신문 호외 GLB 배치!
  { const F4 = floors[4], bx = 18, bz = -24; scene.remove(bunkerC.group); FLR(4).add(bunkerC.group); bunkerC.group.position.set(bx, 0, bz); bunkerC.centerPos.set(bx, F4.y0, bz); bunkerC.floorY = F4.y0;
    bunkerC.group.traverse(o => { o.userData.dynamic = true; });
    const R = FLR(4), bw = PM(0x363a38, .92), ribM = PM(0x282c2e, .78, .35), rustPipeM = PM(0x5a3424, .65, .55), H = 3.4, x0 = bx - 6, x1 = bx + 6, z0 = bz - 10, z1 = bz + 10, t = .32;
    const wall = (ax, bx2, az, bz2) => { pbox(bx2 - ax, H, bz2 - az, bw, (ax + bx2) / 2, H / 2, (az + bz2) / 2, R); const r = { x1: ax, x2: bx2, z1: az, z2: bz2 }; F4.col.push(r); F4.walls.push(r); };
    wall(x0 - t, x0, z0 - t, z1 + t); wall(x1, x1 + t, z0 - t, z1 + t); wall(x0, x1, z0 - t, z0); wall(x0, x1, z1, z1 + t);
    pbox(12.6, .24, 20.6, PM(0x242628, .95), bx, H + .12, bz, R);
    [-8, -4, 0, 4, 8].forEach(dz => {
      pbox(.28, H, .32, ribM, x0 + .16, H / 2, bz + dz, R, { cast: false });
      pbox(.28, H, .32, ribM, x1 - .16, H / 2, bz + dz, R, { cast: false });
      pbox(12.0, .28, .34, ribM, bx, H - .14, bz + dz, R, { cast: false });
    });
    pcyl(.09, .09, 19.6, rustPipeM, x0 + .55, H - .35, bz, R, { rx: Math.PI / 2 });
    pcyl(.07, .07, 19.6, ribM, x1 - .55, H - .35, bz, R, { rx: Math.PI / 2 });
    pmesh(new THREE.PlaneGeometry(3.6, 1.1), new THREE.MeshBasicMaterial({ map: makeSign('지하 방공호 · 제1특수보존서고 (CIVIL DEFENSE SHELTER & ARCHIVE) | 1998 비공개 감사 기록 봉인 구역', '#141e1a', '#98ffb8', 20) }), bx, 2.25, z0 + .08, R, { cast: false });
    for (let k = 0; k < 4; k++) { const sx = k % 2 ? x0 + .65 : x1 - .65, sz = bz - 6.5 + ((k / 2) | 0) * 8.5; pbox(.72, 2.3, 3.0, PM(0x3e4648, .5, .6), sx, 1.15, sz, R); F4.col.push({ x1: sx - .38, x2: sx + .38, z1: sz - 1.5, z2: sz + 1.5 }); }
    // 방공호 천장 산업용 트윈 형광등 3기 + 좌우 격벽 철망 벌크헤드 전등 6기 + 벽면 전등 스위치!
    const bkLampMat = new THREE.MeshStandardMaterial({ color: 0xfff5dc, emissive: 0xffe4a8, emissiveIntensity: 1.6, roughness: .2 });
    const bkCageMat = PM(0x8a7240, .35, .75);
    const bkLightGroup = new THREE.Group(); bkLightGroup.userData.dynamic = true; R.add(bkLightGroup);
    for (let k = 0; k < 3; k++) {
      const lz = bz - 6 + k * 6;
      // 천장 트윈 형광등 하우징 & 발광 튜브 2열
      pbox(1.5, .08, .36, ribM, bx, H - .06, lz, R, { cast: false });
      pbox(1.38, .04, .08, bkLampMat, bx, H - .11, lz - .08, bkLightGroup, { cast: false });
      pbox(1.38, .04, .08, bkLampMat, bx, H - .11, lz + .08, bkLightGroup, { cast: false });
      const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('255,225,165'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .68 }));
      gl.scale.setScalar(5.2); gl.position.set(bx, H - .32, lz); gl.userData.dynamic = true; bkLightGroup.add(gl);
      // 좌우 벽면 황동 철망 벌크헤드 방폭 전등 (Bulkhead Caged Lamps)
      [x0 + .22, x1 - .22].forEach((wx, wi) => {
        pbox(.10, .28, .20, ribM, wx, 2.38, lz, R, { cast: false });
        pbox(.08, .20, .14, bkLampMat, wx + (wi ? -.04 : .04), 2.38, lz, bkLightGroup, { cast: false });
        pbox(.11, .24, .02, bkCageMat, wx + (wi ? -.06 : .06), 2.38, lz - .04, R, { cast: false });
        pbox(.11, .24, .02, bkCageMat, wx + (wi ? -.06 : .06), 2.38, lz + .04, R, { cast: false });
        const wgl = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTex('255,205,130'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .48 }));
        wgl.scale.setScalar(2.8); wgl.position.set(wx + (wi ? -.25 : .25), 2.38, lz); wgl.userData.dynamic = true; bkLightGroup.add(wgl);
      });
    }
    // 방공호 입구(B1 복도 x=13.5, z=-1.52) 및 방공호 내부 출구(x=bx, z=z1-0.08) 3D 중량 방폭 철문(Heavy Steel Blast Door + 붉은 주철 핸들 휠 + 비상 유도등) 설치!
    const buildBlastDoor3D = (dx, dz, ry) => {
      const dg = new THREE.Group(); dg.userData.dynamic = true; dg.position.set(dx, 0, dz); dg.rotation.y = ry; R.add(dg);
      const frameM = PM(0x222628, .45, .75), leafM = PM(0x3a4246, .5, .68), wheelM = PM(0xb82820, .35, .6), brassM2 = PM(0xb89644, .3, .8);
      // 강철 문틀 (좌·우·상단 헤더)
      pbox(.16, 2.36, .18, frameM, -.68, 1.18, 0, dg);
      pbox(.16, 2.36, .18, frameM,  .68, 1.18, 0, dg);
      pbox(1.52, .18, .20, frameM, 0, 2.38, 0, dg);
      // 상단 초록색 발광 비상 방공호 유도등
      pbox(.62, .18, .08, new THREE.MeshStandardMaterial({ color: 0x20d860, emissive: 0x18c050, emissiveIntensity: 1.2 }), 0, 2.56, .06, dg, { cast: false });
      // 방폭 철문 짝 (doorPiv) + 경첩 3개 + 리벳 + 중앙 붉은 주철 압력 휠 핸들
      const doorPiv = new THREE.Group(); doorPiv.userData.dynamic = true; doorPiv.position.set(-.58, 1.16, .02); dg.add(doorPiv);
      pbox(1.18, 2.24, .10, leafM, .58, 0, 0, doorPiv);
      pbox(1.02, 1.96, .12, frameM, .58, 0, 0, doorPiv);
      [-0.75, 0, 0.75].forEach(hy => pcyl(.045, .045, .18, brassM2, .02, hy, .05, doorPiv));
      // 중앙 주철 핸들 휠
      const wheelPiv = new THREE.Group(); wheelPiv.userData.dynamic = true; wheelPiv.position.set(.74, -.02, .08); doorPiv.add(wheelPiv);
      pcyl(.04, .04, .08, brassM2, 0, 0, 0, wheelPiv, { rx: Math.PI / 2 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.18, .022, 8, 20), wheelM); wheelPiv.add(ring);
      for (let s = 0; s < 3; s++) { const spk = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .34, 8), wheelM); spk.rotation.z = s * Math.PI / 3; wheelPiv.add(spk); }
      return { dg, doorPiv, wheelPiv };
    };
    const bdCorr = buildBlastDoor3D(13.5, -1.52, 0);
    const bdIn   = buildBlastDoor3D(bx, z1 - .08, Math.PI);
    // 방공호 내부 벽면 전등 개폐 스위치 (x = bx + 1.15, z = z1 - .14)
    pbox(.12, .18, .06, ribM, bx + 1.15, 1.35, z1 - .14, R);
    pbox(.04, .06, .04, new THREE.MeshBasicMaterial({ color: 0x40ff80 }), bx + 1.15, 1.38, z1 - .18, R);
    world.props.push({ kind: 'robj', k: 'bunker_light', t: 'bunker', floor: 4, x: bx + 1.15, z: z1 - .85, y: 1.35, r: 2.0, label: '방공호 주 전등 스위치 조작하기', bkLightGroup });
    {
      const bLoader = new GLTFLoader();
      bLoader.load('assets/models/sf/sf_bunker_props_pack.glb?v=306', gltf => {
        const bm = gltf.scene; bm.position.set(bx, 0, z0 + .45);
        if (window.__upgradePure3DScene) window.__upgradePure3DScene(bm); else bm.traverse(o => { o.userData.dynamic = true; });
        R.add(bm);
        if (gltf.animations && gltf.animations.length) { const mx = new THREE.AnimationMixer(bm); mx.userData = { floor: 4, x: bx, z: z0 + .45 }; gltf.animations.forEach(c => mx.clipAction(c).play()); (window.__campusAnimMixers ||= []).push(mx); }
      }, undefined, () => {});
      bLoader.load('assets/models/sf/sf_pump_policeline_scene.glb?v=306', gltf => {
        const pm = gltf.scene; pm.position.set(32.0, 0, -3.65);
        pm.traverse(o => { o.userData.dynamic = true; if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; if (o.material?.map) o.material.map.colorSpace = THREE.SRGBColorSpace; } });
        R.add(pm);
        if (gltf.animations && gltf.animations.length) { const mx = new THREE.AnimationMixer(pm); mx.userData = { floor: 4, x: 32.0, z: -3.65 }; gltf.animations.forEach(c => mx.clipAction(c).play()); (window.__campusAnimMixers ||= []).push(mx); }
      }, undefined, () => {});
    }
    // 특수보존서고 리모델링 (참고 시트 12.0 × 20.0m · 천장 3.4m): 벽면 고정 서고 선반 (900×450×2100) · 중앙 양면 서가 2열 · 가운데 열람/작업 테이블 (1800×900×740) + 사무용 의자 · 이동식 서가 (모바일랙) 블록 · 문서 카트 · 제습기 · 소화기함 — 기존 철제 캐비닛 4 · 서류함(감사 기록) · 방폭문 동선 유지
    { const shG = [], bxG = [], mobG = [], stM = PM(0x2e3a30, .55, .55), cbM = PM(0xb08a58, .9, 0), mobM = PM(0x8a8a70, .5, .4);
      const B = (arr, w, h, d, x, y, z) => arr.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
      const shelf = (cx, cz, len, alongZ, dep = .45) => { const W = alongZ ? dep : len, D = alongZ ? len : dep, n = Math.max(1, Math.round(len / .9));
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => B(shG, .04, 2.1, .04, cx + a * (W / 2 - .02), 1.05, cz + b * (D / 2 - .02)));
        for (let k = 1; k < n; k++) { const t = -len / 2 + k * len / n; B(shG, alongZ ? dep : .04, 2.1, alongZ ? .04 : dep, cx + (alongZ ? 0 : t), 1.05, cz + (alongZ ? t : 0)); }
        for (let r = 0; r < 5; r++) { const y = .08 + r * .48; B(shG, W, .025, D, cx, y, cz); if (r < 4) for (let k = 0; k < n * 2; k++) { const t = -len / 2 + (k + .5) * len / (n * 2); if ((k * 7 + r * 3) % 9 === 0) continue; B(bxG, alongZ ? .3 : .38, .25, alongZ ? .38 : .3, cx + (alongZ ? 0 : t), y + .14, cz + (alongZ ? t : 0)); } }
        F4.col.push({ x1: cx - W / 2, x2: cx + W / 2, z1: cz - D / 2, z2: cz + D / 2 }); };
      // 벽면 고정 선반 (기존 철제 캐비닛 자리 비움)
      [[z0 + .55, -32.1], [-28.9, -23.6], [-20.4, z1 - .7]].forEach(([a, b]) => { shelf(x0 + .57, (a + b) / 2, b - a, true); shelf(x1 - .57, (a + b) / 2, b - a, true); });
      // 중앙 양면 서가 2열 (가운데 교차 통로)
      [x0 + 2.7, x1 - 2.7].forEach(x => [[-31.5, -26.6], [-24.4, -17.6]].forEach(([a, b]) => shelf(x, (a + b) / 2, b - a, true, .9)));
      // 이동식 서가 블록 (900×600×2100 × 4, 핸들 휠)
      for (let k = 0; k < 4; k++) { const x = bx - .9 + k * .6, z = -22.0; B(mobG, .58, 2.1, 1.8, x, 1.05, z); [-.5, .5].forEach(d => B(shG, .04, .04, .2, x, 1.2, z + d + (d > 0 ? .9 : -.9) * 0)); }
      F4.col.push({ x1: bx - 1.2, x2: bx + 1.2, z1: -22.9, z2: -21.1 });
      R.add(new THREE.Mesh(mergeGeometries(shG), stM), new THREE.Mesh(mergeGeometries(bxG), cbM), new THREE.Mesh(mergeGeometries(mobG), mobM));
      for (let k = 0; k < 4; k++) pbox(.04, .3, .3, PM(0x1a1a1a, .5, .6), bx - .9 + k * .6, 1.2, -20.98, R, { cast: false });   // 손잡이 휠
      // 열람/작업 테이블 + 사무용 의자 + 보존 상자
      { const tz = -29.0, tM = PM(0x9a7a50, .6, 0), lM = PM(0x1e1e1e, .5, .6); pbox(.9, .04, 1.8, tM, bx, .72, tz, R); [[-.4, -.85], [.4, -.85], [-.4, .85], [.4, .85]].forEach(([a, b]) => pbox(.05, .7, .05, lM, bx + a, .35, tz + b, R));
        F4.col.push({ x1: bx - .45, x2: bx + .45, z1: tz - .9, z2: tz + .9, h: .74 });
        pbox(.5, .08, .5, lM, bx + .85, .48, tz + .3, R); pbox(.06, .5, .45, lM, bx + 1.08, .8, tz + .3, R); pcyl(.03, .03, .45, lM, bx + .85, .22, tz + .3, R);
        [[-.1, -.4], [.15, .1]].forEach(([a, b]) => pbox(.4, .25, .3, cbM, bx + a, .865, tz + b, R)); }
      // 문서 카트 (900×600×1000) · 제습기 (700×600×1800) · 소화기함 (700×250×1000)
      { const x = bx + 1.6, z = -17.6, cM = PM(0x2e3a30, .5, .5); pbox(.6, .03, .9, cM, x, .35, z, R); pbox(.6, .03, .9, cM, x, .95, z, R); [[-.28, -.43], [.28, -.43], [-.28, .43], [.28, .43]].forEach(([a, b]) => pbox(.03, .95, .03, cM, x + a, .5, z + b, R));
        pbox(.38, .3, .4, cbM, x, 1.12, z - .2, R); pbox(.38, .3, .4, cbM, x, .52, z + .2, R); F4.col.push({ x1: x - .3, x2: x + .3, z1: z - .45, z2: z + .45 }); }
      pbox(.7, 1.8, .6, PM(0xe0ddd4, .5, .1), x0 + 1.4, .9, z1 - .4, R); F4.col.push({ x1: x0 + 1.05, x2: x0 + 1.75, z1: z1 - .7, z2: z1 - .1 });
      pbox(.7, 1.0, .25, PM(0xb81e1e, .5, .2), x1 - 1.4, 1.0, z1 - .14, R); }
    world.props.push({ kind: 'robj', k: 'bunker_audit', t: 'bunker', floor: 4, x: bx - 1.6, z: z0 + 1.4, y: 1.1, r: 2.4, label: '방공호 기밀 철제 서류함 & 수동 환기 송풍기 조사하기' });
    world.props.push({ kind: 'robj', k: 'pump_newspaper', t: 'pump', floor: 4, x: 32.0, z: -3.45, y: .8, r: 2.5, label: '폴리스라인 안쪽 1998년 『서문일보』 지역신문 호외 읽기' });
    world.doors.push({ floor: 4, x: 13.5, z: -1.1, r: 1.6, label: '방공호 방폭문 열기 (제1특수보존서고 진입)', to: { floor: 4, x: bx, z: z1 - 1.35, yaw: 0 }, blastDoor: bdCorr });
    world.doors.push({ floor: 4, x: bx, z: z1 - .55, r: 1.6, label: '방공호 방폭문 열기 (B1 복도로 나가기)', to: { floor: 4, x: 13.5, z: -.6, yaw: Math.PI }, blastDoor: bdIn });
    pmesh(new THREE.PlaneGeometry(1.6, .34), new THREE.MeshBasicMaterial({ map: makeSign('◀ 지하 방공호 · 특수보존서고', '#1a2420', '#98ffb8', 22) }), 13.5, 2.3, -1.43, R, { cast: false }); }
  megaFz(i0, 0).forEach(p => { if (p.mesh && bunkerC.group.getObjectById(p.mesh.id)) { const wp = new THREE.Vector3(); p.mesh.getWorldPosition(wp); p.floor = 4; p.x = wp.x; p.z = wp.z; p.y = wp.y - floors[4].y0; } });
  // 37실 · 신규 37실 · 확장 구역 그룹을 청크 컬링에 등록
  [...S37.rooms.map(r => [r, r.f]), ...N37.rooms.map(r => [r, r.f])].forEach(([r, f]) => { const g = r.g || null; if (g) megaP.registerRoomChunk(`r_${f}_${r.name}`, g, V3(g.position.x, floors[f].y0, g.position.z), 6, floors[f].y0); });
}
// 1998 사건 기록: 명찰 · 테이프를 37실 · 확장 구역에 배치 (방 가운데가 아닌 벽 쪽 빈자리)
{
  const cleanNm = s => String(s || '').replace(/\s*\(.*\)$/, '').trim();
  const roomPos = (f, nm) => {
    for (const qf of [f, 0, 1, 2, 4, 8, 9, 10]) {
      const an = qf >= 8, north = an ? ANNEX.floors[qf - 8] : LAYOUT[qf], south = an ? ANNEX_S[qf - 8] : LAYOUT_S[qf], sl = an ? ANNEX.slots : SLOTS;
      let i = north ? north.names.findIndex(n => n === nm || cleanNm(n) === cleanNm(nm)) : -1;
      if (i >= 0) return { f: qf, cx: sl[i], cz: -5.675, s: 1 };
      i = south ? south.names.findIndex(n => n === nm || cleanNm(n) === cleanNm(nm)) : -1;
      if (i >= 0) return { f: qf, cx: sl[i], cz: 5.675, s: -1 };
    }
    return null;
  };
  const freeAt = (f, x, z) => !floors[f].col.some(c => !(c.h != null && c.h <= .225) && x > c.x1 - .3 && x < c.x2 + .3 && z > c.z1 - .3 && z < c.z2 + .3) && !world.props.some(p => p.floor === f && Math.hypot(p.x - x, p.z - z) < .7);
  const spot = (f, nm, k = 0) => { const R = roomPos(f, nm); if (!R) return null;
    const cand = [[2.9, -2.9], [-2.9, -2.9], [2.9, 0], [-2.9, 0], [1.5, -3.1], [-1.5, -3.1], [2.9, 1.8], [-2.9, 1.8]].map(([lx, lz]) => [R.cx + lx * R.s, R.cz + lz * R.s]);
    const pt = cand.filter(([x, z]) => freeAt(R.f, x, z))[k] || [R.cx, R.cz];
    return [pt[0], pt[1], R.f]; };
  const PLACE = [['nametag', 'tag_01', 0, '상담실'], ['nametag', 'tag_03', 10, '음악실'], ['nametag', 'tag_04', 9, '과학 준비실'], ['nametag', 'tag_05', 9, '동아리실 (204)'], ['nametag', 'tag_06', 0, '보건실'],
    ['nametag', 'tag_07', 8, '요리실'], ['nametag', 'tag_08', 10, '학생회실'], ['nametag', 'tag_09', 10, '전시 공간'], ['nametag', 'tag_10', 6, null, -46.1, 26.6], ['nametag', 'tag_12', 3, null, 21.5, -7.6],
    ['tape', 'tape_01', 2, '상담실'], ['tape', 'tape_02', 0, null, 21.0, 64.7], ['tape', 'tape_03', 9, '과학 준비실', 0, 0, 1]];
  PLACE.forEach(([cat, id, f, nm, x, z, k]) => { const pt = nm ? spot(f, nm, k || 0) : [x, z, f]; if (!pt) return; const tf = pt[2] ?? f; const i0 = megaP.interactables.length;
    megaP.spawnCollectibleItem(FLR(tf), V3(pt[0], .05, pt[1]), cat, id); megaFz(i0, tf); });
  // 별관 어학실: 방송 수신기 → 주파수 동조
  { const R = roomPos(9, '언어실 (202)'); if (R) world.props.push({ kind: 'megaRadio', floor: 9, x: R.cx - 2.6 * R.s, z: R.cz - 2.4 * R.s, y: 1.1, label: '어학실 방송 수신기 — 주파수 맞추기' }); }
}
registerLines(Object.fromEntries(megaP.LORE_DB.tapes.map((t, i) => [`mtape_${i + 1}`, { spk: ['witness_counselor', 'guard', 'witness_science', 'friend2', 'witness_principal', 'seoyeon'][i], text: t.transcript.replace(/[“”]/g, '') }])));
{ const orig = megaP.collectLoreItem.bind(megaP);
  megaP.collectLoreItem = (cat, id, notify) => { orig(cat, id, notify); FL.mega ||= { tags: [], tapes: [] };
    const L = cat === 'nametag' ? FL.mega.tags : cat === 'tape' ? FL.mega.tapes : null; if (L && !L.includes(id)) L.push(id); FL.mega.act = megaP.storyState.currentAct;
    if (cat === 'tape') { const n = megaP.LORE_DB.tapes.findIndex(t => t.id === id) + 1; if (n) setTimeout(() => line('mtape_' + n), 900); }
    world.props.forEach(p => { if (p.mega && p.fz && p.fz.id === 'mega_collect_' + id) p.done = true; });
    refreshHud(); save(true); }; }
function megaRestore() {
  const M = FL.mega; if (!M) return;
  (M.tags || []).forEach(id => megaP.storyState.nametags.add(id)); (M.tapes || []).forEach(id => megaP.storyState.tapes.add(id));
  if (M.act) megaP.storyState.currentAct = Math.max(megaP.storyState.currentAct, M.act);
  world.props.forEach(p => { if (!p.mega || !p.fz) return; const id = p.fz.id.replace(/^mega_collect_/, ''); if ([...(M.tags || []), ...(M.tapes || [])].includes(id)) { p.done = true; if (p.mesh) p.mesh.visible = false; } });
  megaP._updateJournalUI();
}
// 클래스 미니게임을 게임 흐름에 맞춰 연다: 그동안 게임을 멈추고(사물함처럼 안전), 닫히면 성공 여부를 돌려준다
async function megaMini(kind) {
  if (state !== 'playing') return false;
  if (kind === 'voltage') {
    const r = await mini('voltageSync', { title: '⚡ 노후 배전반 — 3상(R·S·T) 전압 트림 & 위상 동기화 차단기' });
    return !!r.ok;
  }
  const r = await mini('tune', { title: '📻 비상 방송 수신기 — 98.4MHz 주동조 · 미세동조 · 스켈치 정밀 동조', label: '…하늘아, 옥상 안테나로 올라와…' });
  return !!r.ok;
}
{ const hit = megaP._handleVoltageHit.bind(megaP);   // 빗나가면 스파크 소리가 복도로 퍼진다
  megaP._handleVoltageHit = () => { const st = megaP.minigame.stage; hit(); if (megaP.minigame.active && megaP.minigame.stage === 0 && st > 0 || (megaP.minigame.active && megaP.minigame.stage === 0)) { sfx.spark(); P.noiseT = 1.2; fzLure(V3(P.x, floors[P.floor].y0 + 1, P.z), 14); } }; }
// 사건 기록 도감(J): 열려 있는 동안 게임을 멈춘다 · Esc 로 닫기 · 메뉴에서는 열리지 않는다
addEventListener('keydown', e => {
  const jr = document.getElementById('patch-lore-journal'); if (!jr) return;
  if (e.code === 'KeyJ' && !(state === 'playing' || jr.style.display === 'flex')) { e.stopImmediatePropagation(); return; }
  if (e.code === 'Escape' && jr.style.display === 'flex') { jr.style.display = 'none'; e.stopImmediatePropagation(); }
}, true);
let megaJ = false;
function megaTick(dt) { if (megaP.minigame.active) return; megaP.update(dt, V3(P.x, floors[P.floor].y0, P.z)); }
setInterval(() => {   // 도감 열림 감시 (게임이 멈춰 있어도 돈다)
  const jr = document.getElementById('patch-lore-journal'), open = !!jr && jr.style.display === 'flex';
  if (open && !megaJ) { megaJ = true; megaP._updateJournalUI(); if (state === 'playing') { state = 'ui'; document.exitPointerLock?.(); } }
  else if (!open && megaJ) { megaJ = false; if (state === 'ui' && !megaP.minigame.active) { state = 'playing'; lock(); } }
}, 100);
{ const adv = megaP.advanceStoryAct.bind(megaP); megaP.advanceStoryAct = (n, fn) => { adv(n, fn); FL.mega ||= { tags: [], tapes: [] }; FL.mega.act = megaP.storyState.currentAct; }; }

function featTick(dt) {
  if (STH) { if (!keys[STH.code] || !target || target.type !== 'stairs' || state !== 'playing') STH = null; else if ((STH.t += dt) > .18) { const d = STH.dir; STH = null; changeFloor(d); } }
  { const pr = $('prompt'), k = STH ? Math.min(1, STH.t / .18) : 0; pr.style.backgroundImage = k > 0 ? `linear-gradient(90deg, rgba(232,200,112,.45) ${k * 100}%, transparent ${k * 100}%)` : ''; }   // 계단 길게 누르기 진행 표시
  for (const p of world.props) if (p.kind === 'pick' && p.done && p.mesh.visible) p.mesh.visible = false;
  micTick(dt); camTick(dt); trapTick(dt); breakerTick(dt); patchTick(dt); if (P.floor === 4) basementTick(dt); if (P.floor === 6 || P.floor === 0) poolTick(dt); sitTick(); zoomTick(dt); callTick(dt); sgTick(dt); s37Tick(); elvTick(dt); updateSchoolDoors(world); doorTick(dt); n37.update(dt); megaTick(dt); if ((P.stamInfT || 0) > 0) { P.stamInfT -= dt; if (P.stamInfT < 0) P.stamInfT = 0; P.stamina = 100; P.tired = false; } }

function extrasTick(dt) {
  searchTick(dt); tmpTick(dt); ambientTick(dt); featTick(dt);
  if (XT.mbox) { XT.mbox.t -= dt; if (XT.mbox.t <= 0) XT.mbox = null; }
  if (ghost.slowT > 0) ghost.slowT -= dt;
  // Incidental phenomena are scheduled by one psychological director above.
}

  // 본관 중앙현관 가짜 쉘 구조물 제거 완료 (실제 lobby 가구·테라조 바닥과 겹침 원천 해결)
buildCamClues(); buildBreakers(); buildRestrooms(); spawnPicks();
sqSync();
auditAndFixFurnitureAndQuality();
// 텍스처 선명도: 늦게 불러온 모델 · 새 건물 재질도 비등방성 필터를 최대로 (먼 바닥 · 벽 무늬 뭉개짐 방지)
{ const maxA = Math.min(16, renderer.capabilities.getMaxAnisotropy?.() || 8), seen = new WeakSet();
  const upAniso = () => { const q = []; scene.traverse(o => { if (!o.isMesh) return; for (const m of Array.isArray(o.material) ? o.material : [o.material]) { if (!m) continue; for (const k of ['map', 'normalMap', 'roughnessMap', 'bumpMap', 'emissiveMap']) { const t = m[k]; if (t && t.isTexture && !seen.has(t)) { seen.add(t); if ((t.anisotropy || 1) < maxA) q.push(t); } } } }); q.forEach(t => { t.anisotropy = maxA; }); };   // 다시 올리기(needsUpdate) 없이 — 플레이 중 텍스처 재업로드로 프레임이 크게 떨어지던 원인   // 한 프레임에 6장씩 (다시 올리는 끊김 분산)
  [8000, 25000, 60000, 120000].forEach(ms => setTimeout(upAniso, ms)); }
// 캠퍼스 8개 시설 재건축 (사용자 제공 콘셉트 설계 PDF · CSV): 옛 터를 걷어 내고 새로 짓는다 — 저장 ID 를 매기기 전에
// 캠퍼스 재배치: 동쪽 스포츠 섹션 · 서쪽 학술 · 생활 섹션 · 주차장 등 철거 (시설 재건축보다 먼저 — 옮긴 것은 재건축 철거에서 지킨다)
try { console.info('[캠퍼스 재배치]', relayoutCampus({ scene, floors, world })); } catch (e) { console.error('[campus relayout]', e); }
try { installFacilityRebuild({ THREE, scene, floors, world }); } catch (e) { console.error('[facility rebuild]', e); }
initSaveIds();
applyQuality(SET.quality === 'auto' ? 'mid' : SET.quality);   // 자동: 보통(해상도 1배)에서 시작해 여유가 있으면 올린다 (높음 1.5배로 시작하면 저사양에서 처음부터 버벅였다)
applySettings();
// 로딩 화면을 즉시 닫고(동기식), 텍스처 예산·성능 풀·모델 로드는 백그라운드에서 비동기로 진행한다 (초기 로딩 멈춤 원천 차단)
setupAnnex(); setupCase5();
// ── 설정 변경(학교의 은폐를 파헤치는 사실 기반 조사물) : 새 건물 주요 방 벽에 조사용 게시물 · 공문 · 스크랩을 건다 ──
//   유령 · 초자연 현상은 폐기. 사건의 단서는 사람이 남긴 기록(공문 · 일지 · 신문 · 명단)으로만 이어진다.
const INV_BOARDS = [
  { b: '본관', f: 0, room: '교무실 · 행정실', id: 'inv_office', head: '교무부 공람 — 1998.10.13', title: '교무부 내부 공람 (1998.10.13 · 대외비)', text: '<b>[대외비] 10월 12일 야간 사고 관련 대응 지침</b><br>1. 외부(언론·학부모) 문의는 교무부장 단일 창구로 응대한다.<br>2. 당일 야간 자율학습 출석부는 <b>“전원 정상 하교”</b>로 정리한다.<br>3. 지하 배수실 출입 기록은 시설 점검 일지로 대체한다.<br>4. 방송실 23:40 송출분 테이프는 회수 후 교장실에 보관.<br><br><span style="color:#8a2a1a">— 결재란: 교무부장 (서명) · 교감 (서명) · 교장 (직인 누락)</span>' },
  { b: '본관', f: 1, room: ['교장실', '회의실'], id: 'inv_principal', head: '감사 지적 사항', title: '교육청 감사 지적 사항 (1999.03 · 게시판 사본)', text: '<b>서문고 1998학년도 종합감사 지적 사항</b><br>· 10.12 야간 자율학습 감독 교사 배치 기록 <b>없음</b><br>· 지하 배수실 철문 외부 시정 장치 설치 경위 <b>소명 불충분</b><br>· 당일 출석부 정정 흔적(수정액) 확인 — <b>원본 미제출</b><br><br>조치: “기관 경고”. 관련자 징계 요구는 <b>철회됨</b> (사유란 공란).' },
  { b: '별관', f: 1, room: '도서실', id: 'inv_library', head: '서문일보 스크랩', title: '게시판 스크랩 — 서문일보 1998.10~11', text: '<b>10.13</b> 「서문고 3학년 여학생 심야 실종… 지하 펌프실 폴리스라인」<br><b>10.15</b> 「학교 측 “자율학습은 정상 종료, 사고는 개인 일탈”」<br><b>10.21</b> 「유족 “문이 밖에서 잠겨 있었다” 진상 요구」<br><b>11.02</b> 「경찰, 단순 사고로 내사 종결」 — 기사 아래 누군가 연필로: <b>“그날 밤 열쇠는 누가 갖고 있었나?”</b>' },
  { b: '본관', f: 3, room: ['창고'], id: 'inv_broadcast', head: '송출 기록표 1998.10', title: '방송 송출 기록표 (1998년 10월분)', text: '<b>10.12 (월)</b><br>· 18:30 석식 안내 — 담당 윤하늘 ✔<br>· 21:00 자율학습 2부 안내 — 담당 윤하늘 ✔<br>· <b>23:40 하교 방송 — 담당 윤하늘 (미송출)</b><br>· 23:52 <b>“긴급 하교”</b> — 담당란 공란, 필체 다름<br><br>비고란: <span style="color:#8a2a1a">“23:40 테이프 원본 교장실 회수 — 10.13”</span>' },
  { b: '본관', f: 0, room: '보건실', id: 'inv_nurse', head: '보건일지 1998.10.12', title: '보건일지 사본 (1998.10.12 · 뒷장이 찢겨 있음)', text: '<b>10.12 (월) 야간</b><br>· 23:05 3-2 학생 2명 — 과호흡, 안정 후 귀가<br>· 23:30 <b>지하에서 올라온 학생 3명 — 손바닥 찰과상, “문이 안 열린다”고 진술</b><br>· 23:48 교무부장 내방 — “일지 정리는 내일 하라”<br><br>이후 쪽은 찢겨 나갔다. 찢긴 자국 아래에 볼펜 자국만 남았다: <b>「…하늘이는 아직 아래에…」</b>' },
];
function boardTex(head) { const c = document.createElement('canvas'); c.width = 512; c.height = 320; const g = c.getContext('2d');
  g.fillStyle = '#7a5a36'; g.fillRect(0, 0, 512, 320); g.fillStyle = '#b08a5a'; g.fillRect(14, 14, 484, 292);   // 코르크 게시판
  const papers = [[30, 70, 150, 200, '#efe6d0'], [196, 60, 130, 120, '#e6dcc2'], [340, 74, 142, 210, '#f2ead8'], [196, 196, 130, 92, '#e8e0cc']];
  papers.forEach(([x, y, w, h, col], i) => { g.save(); g.translate(x + w / 2, y + h / 2); g.rotate((i % 2 ? 1 : -1) * .03); g.fillStyle = col; g.fillRect(-w / 2, -h / 2, w, h); g.fillStyle = 'rgba(40,30,20,.55)'; for (let k = 0; k < 8; k++) g.fillRect(-w / 2 + 10, -h / 2 + 18 + k * 13, w - 20 - (k % 3) * 14, 3); g.fillStyle = '#b22'; g.beginPath(); g.arc(0, -h / 2 + 6, 5, 0, 7); g.fill(); g.restore(); });
  g.fillStyle = '#1c1612'; g.fillRect(14, 14, 484, 40); g.fillStyle = '#f0e2c0'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.fillText(head, 256, 44);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
let _invMeshes = null;
function invSpot(b, r, y) {   // 방 벽에서 가구 · 칠판 · 창문에 가리지 않는 빈 자리 (벽 쪽으로 쏜 광선이 모두 벽에 닿는 곳)
  if (!_invMeshes) { _invMeshes = []; const v = new THREE.Vector3(); scene.updateMatrixWorld(); scene.traverse(o => { if (!o.isMesh || o.isInstancedMesh || !o.geometry || /^INV_BOARD_/.test(o.parent && o.parent.name || '')) return; const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const bs = g.boundingSphere; if (!bs || !isFinite(bs.radius)) return; v.copy(bs.center).applyMatrix4(o.matrixWorld); _invMeshes.push({ o, x: v.x, y: v.y, z: v.z, r: bs.radius * o.matrixWorld.getMaxScaleOnAxis() }); }); }
  // 이 방 둘레(±1.6m · 이 층 높이)에 걸친 메시만 광선 검사 (전체 씬 검사로 로딩 직후 1~2초 멈추던 것 방지)
  { const [ax, az] = b.toWorld(r.x1, r.z1), [bx, bz] = b.toWorld(r.x2, r.z2), x1 = Math.min(ax, bx) - 1.6, x2 = Math.max(ax, bx) + 1.6, z1 = Math.min(az, bz) - 1.6, z2 = Math.max(az, bz) + 1.6; invSpot.near = _invMeshes.filter(q => q.x + q.r > x1 && q.x - q.r < x2 && q.z + q.r > z1 && q.z - q.r < z2 && q.y + q.r > y - .2 && q.y - q.r < y + 3.6).map(q => q.o); }
  const rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(), W = (lx, lz) => b.toWorld(lx, lz);
  const walls = [ // [로컬 벽 위 점 (t: 0~1), 로컬 안쪽 법선]
    t => [r.x1 + .02, r.z1 + (r.z2 - r.z1) * t, 1, 0], t => [r.x2 - .02, r.z1 + (r.z2 - r.z1) * t, -1, 0], t => [r.x1 + (r.x2 - r.x1) * t, r.z1 + .02, 0, 1], t => [r.x1 + (r.x2 - r.x1) * t, r.z2 - .02, 0, -1]];
  for (const t of [.5, .4, .6, .3, .7, .2, .8, .14, .86]) for (const wf of walls) {
    const [lx, lz, lnx, lnz] = wf(t), [x, z] = W(lx, lz), [ix, iz] = W(lx + lnx, lz + lnz), nx = ix - x, nz = iz - z, tx = -nz, tz = nx;   // 세계 좌표 법선 · 접선
    const cx1 = Math.min(lx + lnx * .14, lx + lnx * .5) - Math.abs(lnz) * .85, cx2 = Math.max(lx + lnx * .14, lx + lnx * .5) + Math.abs(lnz) * .85, cz1 = Math.min(lz + lnz * .14, lz + lnz * .5) - Math.abs(lnx) * .85, cz2 = Math.max(lz + lnz * .14, lz + lnz * .5) + Math.abs(lnx) * .85;
    if ((b.col || []).some(c => c.x2 > cx1 && c.x1 < cx2 && c.z2 > cz1 && c.z1 < cz2 && (c.y1 == null || (c.y1 < y + 2.1 && c.y2 > y + .9)))) continue;   // 가구 · 기둥 충돌 상자와 겹치면 안 된다
    let ok = true, wallD = null, dMin = 9, dMax = 0; const hitObjs = new Set();
    for (const s of [-.85, -.4, 0, .4, .85]) for (const h of [1.05, 1.55, 2.05]) { if (!ok) break;
      o.set(x + nx * 1.4 + tx * s, y + h, z + nz * 1.4 + tz * s); d.set(-nx, 0, -nz); rc.set(o, d); rc.far = 1.6;
      const hit = rc.intersectObjects(invSpot.near, false)[0]; const m = hit && (Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material); if (!hit || hit.distance < 1.3 || (m && (m.transparent || m.opacity < 1 || m.transmission > 0)) || /glass|window|유리|창/i.test(hit.object.name || '')) { ok = false; break; } wallD = hit.distance; hitObjs.add(hit.object); dMin = Math.min(dMin, wallD); dMax = Math.max(dMax, wallD); }
    if (ok && (dMax - dMin > (invSpot.tol || .012) || hitObjs.size > (invSpot.tol ? 2 : 1))) ok = false;   // 같은 벽 한 장에만 닿아야 (액자 · 화이트보드 · 현수막 겹침 금지)   // 벽면이 평평해야 (흡음판 · 게시물 · 칠판 돌출 금지)
    if (ok) { const off = (wallD != null ? 1.4 - wallD : 0) + .03; return { x: x + nx * off, z: z + nz * off, ry: Math.atan2(nx, nz), nx, nz }; } }
  return null;
}
async function installInvestigationBoards() {
  if (!RBG || !RBG.BLD || world._invBoards) return; world._invBoards = true;
  for (const B of INV_BOARDS) { await new Promise(r => setTimeout(r, 30)); try {   // 게시물 하나씩 나눠서 (한 프레임에 몰아 계산하지 않는다)
    const b = RBG.BLD.find(q => q.name === B.b); if (!b || !b.props) continue;
    const FHb = (b.spec && b.spec.FH) || 3.6, y = B.f * FHb; let sp = null;
    for (const r of b.props.filter(p => p.kind === 'room' && p.floor === B.f && [].concat(B.room).includes(p.label)).sort((a, c) => [].concat(B.room).indexOf(a.label) - [].concat(B.room).indexOf(c.label))) { sp = invSpot(b, r, y); if (sp) break; }
    if (!sp) { invSpot.tol = .045; for (const r of b.props.filter(p => p.kind === 'room' && p.floor === B.f && [].concat(B.room).includes(p.label)).sort((a, c) => [].concat(B.room).indexOf(a.label) - [].concat(B.room).indexOf(c.label))) { sp = invSpot(b, r, y); if (sp) break; } invSpot.tol = 0; }
    if (!sp) { console.warn('[조사 게시물] 빈 벽 없음', B.id); continue; }
    const { x, z, ry, nx, nz } = sp;
    const grp = new THREE.Group(); grp.name = 'INV_BOARD_' + B.id;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, .96, .04), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: .8 })); grp.add(frame);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.42, .88), new THREE.MeshStandardMaterial({ map: boardTex(B.head), roughness: .9 })); face.position.z = .022; grp.add(face);
    grp.position.set(x, y + 1.55, z); grp.rotation.y = ry; scene.add(grp);
    const px = x + nx * .75, pz = z + nz * .75;
    world.props.push({ kind: 'look', _rb: true, floor: 0, x: px, z: pz, rbY: y, y: y + 1.5, r: 1.6, label: B.head + ' 읽기', n: 0, fn: () => { showNote({ kind: 'board', id: B.id, title: B.title, text: B.text }); return ''; } });
  } catch (e) { console.warn('[조사 게시물]', B.id, e); } }
}
// 상호작용 지점 위치 보정 (방 밖 · 외벽 속으로 밀려난 녹음기 · 쪽지 · 단서를 가장 가까운 방 안 가구 위로, 쪽지 상호작용 높이를 실제 쪽지 높이에 맞춤)
function repairStrayInteractables() {
  if (!RBG || !RBG.BLD || !RBG.where) return 0; let n = 0; const v = new THREE.Vector3();
  const KINDS = new Set(['tape', 'clue', 'note', 'pick', 'lock', 'case5', 'search', 'mspot', 'photo', 'key', 'battery', 'medkit', 'hairpin', 'can']);
  const objs = p => ['mesh', 'anim', 'visMesh', 'piv', 'grp', 'obj'].map(k => p[k]).filter(o => o && o.isObject3D);
  const moveTo = (p, x, z) => { const ox = p.pos ? p.pos.x : p.x, oz = p.pos ? p.pos.z : p.z, dx = x - ox, dz = z - oz; if (p.pos) { p.pos.x = x; p.pos.z = z; } else { p.x = x; p.z = z; } if (p.px != null) { p.px += dx; p.pz += dz; } for (const o of objs(p)) { o.position.x += dx; o.position.z += dz; o.updateMatrixWorld(true); } };
  for (const p of [...world.props, ...world.items]) {
    if (p.rbY == null || p.taken || p._strayFixed || !KINDS.has(p.kind)) continue;
    const x = p.pos ? p.pos.x : p.x, z = p.pos ? p.pos.z : p.z; if (x == null) continue;
    // 쪽지 · 아이템: 상호작용 높이(pos.y)를 실제로 그려진 쪽지 높이에 맞춘다
    if (p.pos && p.mesh && p.mesh.getWorldPosition) { p.mesh.getWorldPosition(v); if (Math.abs(v.y - p.pos.y) > .3 && v.y > p.rbY - .1 && v.y < p.rbY + 2.4) { p.pos.y = v.y; n++; } }
    if (RBG.where(x, z, p.rbY + .5)) continue;   // 방 안이면 그대로
    let best = null;
    for (const b of RBG.BLD) { if (!b.props || !b.layout) continue; const [lx, lz] = b.toLocal(x, z); const f = Math.round(p.rbY / ((b.spec && b.spec.FH) || 3.6));
      for (const r of b.props) { if (r.kind !== 'room' || r.floor !== f || /비상구|계단|현관/.test(r.label || '')) continue; const cx = Math.max(r.x1 + .6, Math.min(r.x2 - .6, lx)), cz = Math.max(r.z1 + .9, Math.min(r.z2 - .6, lz)), d = Math.hypot(cx - lx, cz - lz); if (d < 1.6 && (!best || d < best.d)) best = { b, cx, cz, d }; } }
    if (!best) continue;
    const [wx, wz] = best.b.toWorld(best.cx, best.cz); moveTo(p, wx, wz); p._strayFixed = true; n++;
  }
  // 녹음기인데 눈에 보이는 모형이 하나도 없는 것 → 카세트 녹음기 모형을 그 자리 가구 윗면에 (프롬프트만 허공에 뜨던 것)
  const rc = new THREE.Raycaster(), dn = new THREE.Vector3(0, -1, 0); rc.camera = camera;
  for (const p of world.props) { if (p.kind !== 'tape' || p.rbY == null || p.done || p._recVis) continue;
    const has = ['mesh', 'anim', 'visMesh', 'piv', 'grp', 'obj'].some(k => p[k] && p[k].isObject3D && !new THREE.Box3().setFromObject(p[k]).isEmpty()); if (has) continue;
    const near = []; scene.traverse(o => { if (o.isMesh && o.visible !== false && !o.isInstancedMesh && o.geometry) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const s = o.geometry.boundingSphere; if (!s) return; v.copy(s.center).applyMatrix4(o.matrixWorld); if (Math.hypot(v.x - p.x, v.z - p.z) < s.radius * o.matrixWorld.getMaxScaleOnAxis() + .3) near.push(o); } });
    { // 같은 방의 책상 · 탁자(충돌 상자 윗면 0.6~1.0m) 가운데 가장 가까운 곳으로 — 바닥 · 휠체어 밑에 놓이지 않게
      const room = RBG.where(p.x, p.z, p.rbY + .5); let bs = null;
      for (const b of RBG.BLD) { if (!b.col) continue; for (const c of b.col) { if (c.y2 == null || c.furn2) continue; const rel = c.y2 - p.rbY; if (rel < .6 || rel > 1.0 || (c.x2 - c.x1) < .45 || (c.z2 - c.z1) < .35 || (c.x2 - c.x1) > 3 || (c.z2 - c.z1) > 3) continue;
        const [cx, cz] = b.toWorld((c.x1 + c.x2) / 2, (c.z1 + c.z2) / 2); if (RBG.where(cx, cz, p.rbY + .5) !== room) continue; const d = Math.hypot(cx - p.x, cz - p.z); const pref = (rel >= .68 && rel <= .86) ? 0 : 1.5, dd = d + pref; if (d > 4 || (bs && dd >= bs.d)) continue;
          rc.set(new THREE.Vector3(cx, c.y2 + .5, cz), dn); rc.far = .7; const hs = rc.intersectObjects(scene.children, true).filter(h => h.object.isMesh && !h.object.isSprite && h.object.visible !== false && !h.object.material?.transparent), h0 = hs[0]; if (!h0 || !hs.some(h => Math.abs(h.point.y - c.y2) < .15)) continue;   // 실제 평평한 윗면(책상 상판)이 있는 곳만
          bs = { x: cx, z: cz, top: Math.max(c.y2, ...hs.filter(h => Math.abs(h.point.y - c.y2) < .15).map(h => h.point.y)), d: dd }; } }
      if (bs) { let tx = bs.x, tz = bs.z; if (world.props.some(q => q !== p && q.kind === 'tape' && Math.hypot(q.x - tx, q.z - tz) < .3)) tx += .32;   // 같은 책상의 다른 녹음기와 겹치지 않게
        const dx = tx - p.x, dz = tz - p.z; p.x = tx; p.z = tz; if (p.px != null) { p.px += dx; p.pz += dz; } p._deskTop = bs.top; } }
    rc.set(new THREE.Vector3(p.x, p.rbY + 1.3, p.z), dn); rc.far = 1.35; const hit = rc.intersectObjects(near, false).find(h => !h.object.material?.transparent && h.point.y > p.rbY - .05);
    const colTop = hit && RBG.BLD.some(b => b.col && (([lx, lz]) => b.col.some(c => c.y2 != null && Math.abs(c.y2 - hit.point.y) < .08 && lx > c.x1 && lx < c.x2 && lz > c.z1 && lz < c.z2))(b.toLocal(p.x, p.z)));   // 레이가 맞은 곳이 실제 가구 윗면일 때만 (모서리 · 틈새에 걸려 허공에 뜨던 것)
    const top = p._deskTop != null ? p._deskTop : (hit && colTop) ? hit.point.y : p.rbY, g = new THREE.Group(), body = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: .55, metalness: .2 }), reel = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: .6 });
    const bm = new THREE.Mesh(new THREE.BoxGeometry(.26, .08, .15), body); bm.position.y = .04; g.add(bm);
    for (const sx of [-.055, .055]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .012, 14), reel); r.position.set(sx, .085, -.01); g.add(r); }
    const led = new THREE.Mesh(new THREE.BoxGeometry(.012, .008, .012), new THREE.MeshBasicMaterial({ color: 0xff3020 })); led.position.set(.1, .084, .05); g.add(led);
    g.position.set(p.x, top + .004, p.z); g.rotation.y = (p.x * 7 + p.z * 3) % 6.28; g.name = 'REC_VIS_' + (p.id || ''); g.userData.rbKeep = true; scene.add(g); p.visMesh = g; p._recVis = true; n++; }
  return n;
}
{ RBG = installRebuild({ THREE, scene, floors, world }); window.__rbg = RBG; try { RBG.allOff(); } catch (e) { console.warn('[all off]', e); } renderer.localClippingEnabled = true; setTimeout(() => { installInvestigationBoards().catch(e => console.warn('[조사 게시물]', e)); }, 2500); setTimeout(() => { furnishRooms({ scene, RBG, world, getP: () => P }).then(n => n && console.info('[가구 보강]', n)).catch(e => console.warn('[furnish v2]', e)); }, 4000); [6000, 16000, 32000].forEach(t => setTimeout(() => { try { const n = repairStrayInteractables(); if (n) console.info('[상호작용 위치 보정]', n); } catch (e) { console.warn('[stray fix]', e); } }, t)); try { installRoomUI({ P, world, getRBG: () => RBG, getState: () => state, getTarget: () => target, keyInteract: () => (K().interact || 'KeyE') }); } catch (e) { console.warn('[room ui]', e); }
  // 2단계: 예전 건물의 열쇠 · 쪽지 · 조사 지점을 새 방으로 (나중에 생기는 조사 지점도 몇 번 더 옮긴다)
  const sz4 = floors[4] && floors[4].stairZone, b1 = sz4 ? sz4.spawn : { x: ((floors[4] && floors[4].stairCx) || 0) + .8, z: -5.2 };
  const rel = () => { const r = RBG.relocate({ world, floors, stairSpawnB1: b1 }); if (r.moved || r.dropped) console.info('[rebuild] 옮김', r); const f = RBG.fixRoomRefs(world); if (f.moved || f.relabeled || f.dup) console.info('[rebuild] 방 이름 맞춤', f); const g2 = RBG.relinkGeneric(world); if (g2.n || g2.drop) console.info('[rebuild] 공용 조사 지점 다시 잇기', g2); const s3 = RBG.settleMoved(world); if (s3.n) console.info('[rebuild] 허공 물건 내려놓기', s3); const fv = RBG.fixVisible(world); if (fv.re || fv.up) console.info('[rebuild] 안 보이던 · 묻힌 물건 바로잡기', fv); };
  RBG.adoptPassage(world.OUT, PASS_DOOR); if (RBG.gate) RBG.gate.closed = () => ipP.state.fireDoorClosed;   // 구름다리 방화문 연출 → 새 연결 통로
  // 새 본관 · 별관 엘리베이터: 문 여닫는 소리 · 안내 음성 (예전 건물 엘리베이터와 같은 녹음) — 칸 안이나 승강장 근처일 때만
  { const Q = []; let busy = false; const AV = new Set(['open', 'close', 'up', 'down', 'floor_1', 'floor_2', 'floor_3']);
    const pump = async () => { if (busy) return; busy = true; while (Q.length) { const id = Q.shift(); if (state !== 'playing' || isSpeechBusy()) continue; try { await elvAnnounce(id); } catch (e) {} } busy = false; };
    RBG.onElev = (ev, E, near) => { if (!near) return; if (ev === 'open' || ev === 'close') sfx.doorSlide(.7); if (!AV.has(ev)) return; if (ev.startsWith('floor_')) Q.length = 0; if (Q[Q.length - 1] !== ev) Q.push(ev); pump(); }; }
  try { const pr = relayCampusPaths({ world, footprints: RBG.footprints }); console.info('[인도 재배치]', pr); } catch (e) { console.error('[campus paths]', e); }
  { const cl = () => { try { const r = cleanupCampus({ scene, floors }); if (r.hid || r.inst) console.info('[캠퍼스 정리]', r); settleOutdoorProps(); try { setupEnv(renderer, scene); } catch (e) { console.warn('[env]', e); } if (RBG && campusCctv && RBG.cctvFeeds && !RBG._cctvSet) { RBG._cctvSet = true; const keep = collectCampusCctvFeeds(world.CCTV_CAMERAS).filter(f => !(f.floor >= 1 && f.floor <= 2) && !(f.floor >= 8) && !(f.floor === 0 && RBG.inside(f.position[0], f.position[2]))); campusCctv.setFeeds([...RBG.cctvFeeds(), ...keep]); campusCctv.restoreChannels(FL.guardCctvChannels || []); }   // CCTV: 옛 본관 · 별관 카메라 → 새 건물 복도 · 현관 · 구름다리
    const nd = autoDetail(scene); try { sharpenTextures(scene, renderer); const sl = slimHeavyProps(scene); if (sl.n) console.info('[경량화]', sl); } catch (e) {} if (nd) console.info('[표면 디테일]', nd); } catch (e) { console.warn('[cleanup]', e); } }; cl(); [8000, 30000, 80000, 200000].forEach(ms => setTimeout(cl, ms)); }   // 재배치 잔재 · 인도 위 소품 (늦게 오는 모델 포함)
  case5Place();   rel(); setInterval(rel, 4000); window.__rbRel = rel; }   // 새 게임 · 이어하기 · 이벤트로 나중에 생기는 조사 지점도 계속 옮긴다 (이미 옮긴 것은 건너뜀)
installPerf({ THREE, renderer, scene, camera, floors, world });
const _t3 = performance.now();
window.__loadTimes = { textures: Math.round(_t1 - _t0), build: Math.round(_t2 - _t1), warmup: Math.round(_t3 - _t2) };
$('loading').classList.remove('show');
setTimeout(() => {
  textureBudget.prepare(scene).catch(() => {});
  // warmUp & prewarmFloors 비활성화: 초반 정문·경비실 앞에서 전 층 셰이더 동시 컴파일로 발생하던 렉 원천 제거
  loadModels(); addLookProps();
}, 120);
setTimeout(() => prewarmFloors(false, fx.composer ? fx.composer.renderTarget1 : null).catch(() => {}), 2200);

/* ---------- 설정 화면 ---------- */
let settingsFrom = null, setTab = 'gfx';
function showSetTab(t) { setTab = t; document.querySelectorAll('#setTabs button').forEach(b => b.classList.toggle('on', b.dataset.s === t)); document.querySelectorAll('.setPage').forEach(p => p.classList.toggle('on', p.dataset.s === t)); }
function fillSettings() {
  $('setScreen').value = document.fullscreenElement ? 'full' : 'win';
  $('quality2').value = SET.quality; $('setScale').value = SET.scale * 100; $('setBright').value = SET.bright * 100; $('setFov').value = SET.fov;
  $('setNoFlicker').checked = !!SET.noFlicker; $('setObjArrow').checked = SET.objArrow; $('setBgm').checked = SET.bgm; $('setBgmVol').value = Math.round(SET.bgmVol * 100); $('setBloom').checked = SET.bloom; $('setGrain').checked = SET.grain; $('setBob').checked = SET.bob; $('setShake').checked = SET.shake; $('setFps').checked = SET.showFps; $('setPlay').checked = SET.showPlay !== false;
  const v = getVolumes(); ['master', 'sfx', 'voice', 'amb', 'music'].forEach(k => { $('vol_' + k).value = Math.round(v[k] * 100); });
  $('setView').value = String(SET.view); $('setDist').value = SET.camDist * 10;
  $('setSens').value = SET.sens * 100; $('setInvY').checked = SET.invertY; $('setRun').value = SET.runToggle ? 'toggle' : 'hold'; $('setHints').checked = SET.hints;
  $('setDub').checked = VS.dub; $('setVoice').value = VS.engine; $('setVoice').querySelector('[value=browser]').disabled = !hasBrowserVoice(); $('vEngine').textContent = '현재: ' + engineLabel() + (hasNaturalVoice() ? '' : ' · 이 브라우저에는 자연스러운 한국어 음성이 없습니다 (Edge 권장)');
  $('setSubs').checked = VS.subs; $('setNotes').checked = VS.readNotes; $('setSubSize').value = String(VS.subSize); $('setNames').checked = SET.subNames; $('setSubBg').value = SET.subBg * 100;
  $('setCaps').checked = SET.captions; $('setTips').checked = SET.tips; $('setPhotos').checked = SET.areaPhotos; $('setMic').checked = !!SET.mic; $('setContrast').checked = SET.contrast; $('setUi').value = Math.round(SET.ui * 100); renderKeys();
  $('setDiff').value = SET.diff; $('setLang').value = curLang(); $('setJump').value = SET.jump; $('setFlash').checked = SET.flashReduce; $('setFearFx').checked = SET.fearFx;
  vals();
}
function vals() {
  $('vScale').textContent = Math.round(SET.scale * 100) + '%'; $('vBright').textContent = Math.round(SET.bright * 100) + '%'; $('vFov').textContent = SET.fov + '°';
  $('vUi').textContent = Math.round(SET.ui * 100) + '%';
  $('vSens').textContent = SET.sens.toFixed(2) + '×'; $('vDist').textContent = SET.camDist.toFixed(1) + 'm'; $('vSubBg').textContent = Math.round(SET.subBg * 100) + '%';
}
function openSettings(from) {
  settingsFrom = from; if (from === 'pause') $('pause').classList.remove('show');
  fillSettings(); showSetTab(setTab); $('settings').classList.add('show');
}
function closeSettings() { $('settings').classList.remove('show'); if (settingsFrom === 'pause') $('pause').classList.add('show'); }
$('settingsClose').onclick = $('settingsClose2').onclick = closeSettings;
document.querySelectorAll('#setTabs button').forEach(b => { b.onclick = () => showSetTab(b.dataset.s); });
$('setBtn2').onclick = () => openSettings('pause');
const setS = (k, v) => { SET[k] = v; saveSET(); applySettings(); vals(); };
$('setScreen').onchange = e => { try { if (e.target.value === 'full') document.documentElement.requestFullscreen(); else if (document.fullscreenElement) document.exitFullscreen(); } catch (err) { /* ignore */ } };
$('quality2').onchange = e => { setS('quality', e.target.value); applyQuality(SET.quality === 'auto' ? 'mid' : SET.quality); };
$('setScale').oninput = e => { setS('scale', e.target.value / 100); };
$('setScale').onchange = () => applyQuality(qCur);
$('setBright').oninput = e => setS('bright', e.target.value / 100);
$('setFov').oninput = e => setS('fov', +e.target.value);
$('setNoFlicker').onchange = e => setS('noFlicker', e.target.checked); $('setObjArrow').onchange = e => setS('objArrow', e.target.checked); $('setBgm').onchange = e => setS('bgm', e.target.checked); $('setBgmVol').oninput = e => setS('bgmVol', e.target.value / 100);
$('setBloom').onchange = e => setS('bloom', e.target.checked); $('setGrain').onchange = e => setS('grain', e.target.checked);
$('setBob').onchange = e => setS('bob', e.target.checked); $('setShake').onchange = e => setS('shake', e.target.checked); $('setFps').onchange = e => setS('showFps', e.target.checked); $('setPlay').onchange = e => setS('showPlay', e.target.checked);
['master', 'sfx', 'voice', 'amb', 'music'].forEach(k => { $('vol_' + k).oninput = e => { setVolumes({ [k]: e.target.value / 100 }); }; });
$('vol_voice').onchange = () => speak(`l_heal_${CK()}`);
$('vol_sfx').onchange = () => sfx.doorBang(0, .6);
$('setView').onchange = e => { setS('view', +e.target.value); view = SET.view; };
$('setDist').oninput = e => setS('camDist', e.target.value / 10);
$('setSens').oninput = e => setS('sens', e.target.value / 100); $('setInvY').onchange = e => setS('invertY', e.target.checked);
$('setRun').onchange = e => setS('runToggle', e.target.value === 'toggle'); $('setHints').onchange = e => setS('hints', e.target.checked);
$('setVoice').onchange = e => { VS.engine = e.target.value; saveVS(); stopSpeak(); fillSettings(); speak('intro1'); };
$('setDub').onchange = e => { VS.dub = e.target.checked; saveVS(); stopSpeak(); fillSettings(); refreshDubBtns(); if (VS.dub) speak(`l_heal_${CK()}`); };
function refreshDubBtns() { ['mDub', 'dubBtn2'].forEach(id => { const b = $(id); if (b) b.textContent = `더빙 ${VS.dub ? 'ON' : 'OFF'}`; }); }
$('mDub').onclick = () => { VS.dub = !VS.dub; saveVS(); stopSpeak(); refreshDubBtns(); };
$('dubBtn2').onclick = () => { VS.dub = !VS.dub; saveVS(); stopSpeak(); refreshDubBtns(); };
refreshDubBtns();
$('setSubs').onchange = e => { VS.subs = e.target.checked; saveVS(); };
$('setNotes').onchange = e => { VS.readNotes = e.target.checked; saveVS(); };
$('setSubSize').onchange = e => { VS.subSize = +e.target.value; saveVS(); subtitle('미리보기', '자막 크기가 이렇게 보입니다.', 2.5); };
$('setNames').onchange = e => { setS('subNames', e.target.checked); subtitle('미리보기', '화자 이름 표시', 2); };
$('setSubBg').oninput = e => { setS('subBg', e.target.value / 100); subtitle('미리보기', '자막 배경 진하기', 1.5); };
$('setLang').onchange = e => { if (state === 'playing' || state === 'paused' || state === 'ui') { try { save(true); } catch (er) { /* ignore */ } } setLang(e.target.value); };
document.querySelectorAll('#tLang button').forEach(b => { b.classList.toggle('on', b.dataset.lang === curLang()); b.onclick = () => { if (b.dataset.lang !== curLang()) setLang(b.dataset.lang); }; });
$('setDiff').onchange = e => setS('diff', e.target.value); $('setJump').onchange = e => setS('jump', e.target.value);
$('setFlash').onchange = e => setS('flashReduce', e.target.checked); $('setFearFx').onchange = e => setS('fearFx', e.target.checked);
$('setCaps').onchange = e => { setS('captions', e.target.checked); caption('효과음 자막 미리보기'); }; $('setTips').onchange = e => setS('tips', e.target.checked); $('setPhotos').onchange = e => setS('areaPhotos', e.target.checked);
$('setMic').onchange = async e => { setS('mic', e.target.checked); if (e.target.checked) await micStart(); else micStop(); };
if (SET.mic) { SET.mic = false; saveSET(); }   // 마이크 소리 감지: 소리를 듣고 오는 존재가 없어져 게임에 쓸모가 없다 → 끔 (권한 요청도 하지 않는다)
{ const row = $('setMic') && $('setMic').closest('label, .row, div'); if (row) row.style.display = 'none'; }
if (matchMedia('(pointer: coarse)').matches || !('exitPointerLock' in document)) $('mobileNote').style.display = 'block';
$('setContrast').onchange = e => setS('contrast', e.target.checked); $('setUi').oninput = e => setS('ui', e.target.value / 100);
// 키 재지정
const KEY_ACTIONS = [['camera', '휴대폰 야간 카메라'], ['crouch', '앉기 (웅크리기)'], ['jump', '점프'], ['interact', '조사 · 상호작용'], ['flash', '손전등'], ['inv', '소지품'], ['map', '지도'], ['phone', '휴대폰'], ['throwCan', '캔 던지기'], ['view', '시점 전환'], ['run', '달리기'], ['down', '계단 내려가기'], ['scan', '주변 살피기'], ['quest', '목표 바 펼치기 · 한 줄 · 숨기기']];
let remapping = null;
function renderKeys() {
  $('keyRemap').innerHTML = KEY_ACTIONS.map(([k, n]) => `<span>${n}</span><button data-k="${k}" class="${remapping === k ? 'wait' : ''}">${remapping === k ? '키를 누르세요…' : keyLabel(SET.keys[k])}</button>`).join('');
  $('keyRemap').querySelectorAll('button').forEach(b => { b.onclick = () => { remapping = b.dataset.k; renderKeys(); }; });
}
addEventListener('keydown', e => {
  if (!remapping) return; e.preventDefault(); e.stopImmediatePropagation();
  if (e.code !== 'Escape') { const old = SET.keys[remapping], dup = Object.keys(SET.keys).find(k => k !== remapping && SET.keys[k] === e.code); if (dup) SET.keys[dup] = old; SET.keys[remapping] = e.code; saveSET(); }
  remapping = null; renderKeys(); refreshHints();
}, true);
function refreshHints() { const k = SET.keys; $('hints').innerHTML = `<div>이동 <kbd>WASD</kbd></div><div>달리기 <kbd>${keyLabel(k.run)}</kbd></div><div>손전등 <kbd>${keyLabel(k.flash)}</kbd></div><div>상호작용 <kbd>${keyLabel(k.interact)}</kbd></div><div>던지기 <kbd>${keyLabel(k.throwCan)}</kbd></div><div>앉기 <kbd>${keyLabel(k.crouch)}</kbd> · 점프 <kbd>${keyLabel(k.jump)}</kbd></div><div>시점 <kbd>${keyLabel(k.view)}</kbd></div><div>주변 살피기 <kbd>${keyLabel(k.scan)}</kbd> · 빠른 저장 <kbd>F5</kbd></div><div>일시정지 <kbd>Esc</kbd></div>`; }
refreshHints();
$('setReset').onclick = () => { resetSET(); setVolumes({ master: 1, sfx: 1, voice: 1, amb: 1, music: 1 }); VS.dub = true; VS.engine = 'auto'; VS.subs = true; VS.readNotes = true; VS.subSize = 1; saveVS(); applySettings(); applyQuality(SET.quality === 'auto' ? 'mid' : SET.quality); fillSettings(); refreshHints(); toast('설정', '기본값으로 되돌렸습니다', 'info'); };
document.querySelectorAll('.btn').forEach(b => b.addEventListener('mouseenter', () => sfx.ui()));

/* ---------- 테스트 모드 (?test) ---------- */
// 37개 특별실 · 보조실 순간이동 (방 문 안쪽에서 방을 바라보게)
function S37_TP() { return S37.rooms.map(r => [`[37실] ${{ 4: 'B1', 0: '1F', 1: '2F', 2: '3F', 8: '별관 1F', 9: '별관 2F', 10: '별관 3F' }[r.f]} ${r.name}`, { floor: r.f, x: r.cx, z: -r.s * 2.6, yaw: r.s > 0 ? 0 : Math.PI }]); }
function rbTpList(old) { try { return rbTpBuild(old); } catch (e) { console.warn('[tp]', e); return old; } }
function rbTpBuild(old) {   // 새 건물(재건축): 예전 층(1·2·8~10층 · 예전 본관 땅) 순간이동 대신 새 건물의 실제 복도 · 방 · 퍼즐 앞으로
  const B = RBG && RBG.BLD; if (!B) return old;
  const isOldTo = t => t.floor === 1 || t.floor === 2 || (t.floor >= 8 && t.floor <= 10) || (t.floor === 0 && RBG.inside(t.x, t.z));
  const out = old.filter(([, t]) => !isOldTo(t) );
  const yawOf = (b, lx, lz, lx2, lz2) => { const [x, z] = b.toWorld(lx, lz), [x2, z2] = b.toWorld(lx2, lz2); return Math.atan2(-(x2 - x), -(z2 - z)); };
  const fhOf = b => (b.spec && b.spec.FH) || 3.6;
  for (const b of B) { if (!b.layout || !b.props) continue; const fl = [...new Set(b.props.filter(p => p.kind === 'room').map(p => p.floor))].sort((a, c) => a - c);
    for (const f of fl) { const [x, z] = b.toWorld(0, -1.8); out.push([b.name + ' ' + (f + 1) + 'F 복도', { floor: 0, x, z, sh: f * fhOf(b), yaw: yawOf(b, 0, -1.8, 1, -1.8) }]); } }
  if (RBG.passToNew) { const [x, z] = RBG.passToNew(.8, -15.2); out.push(['본관 ↔ 별관 연결 통로 (2층 높이)', { floor: 0, x, z, sh: 3.6, yaw: 0 }]); }
  for (const b of B) { if (!b.props) continue; const seen = {};
    for (const r of b.props.filter(p => p.kind === 'room' && p.label && !/비상구/.test(p.label))) { const key = r.floor + r.label; seen[key] = (seen[key] || 0) + 1;
      const cx = (r.x1 + r.x2) / 2, ez = r.z1 + 1.1, [x, z] = b.toWorld(cx, ez);
      out.push(['[방] ' + b.name + ' ' + (r.floor + 1) + '층 ' + r.label + (seen[key] > 1 ? ' ' + seen[key] : ''), { floor: 0, x, z, sh: r.floor * fhOf(b), yaw: yawOf(b, cx, ez, cx, ez + 1) }]); } }
  const OBJ = ['safe', 'case5', 'lock', 'piano', 'easel', 'mspot', 'megaRadio', 'mina', 'console', 'cctvRec'];
  for (const p of world.props.filter(q => q.rbY != null && OBJ.includes(q.kind)).sort((a, c) => OBJ.indexOf(a.kind) - OBJ.indexOf(c.kind))) {
    const b = B.find(q => q.layout && (([lx, lz]) => Math.abs(lx) < q.layout.L / 2 + .5 && lz > q.layout.zN - .5 && lz < q.layout.zS + .5)(q.toLocal(p.x, p.z))); if (!b) continue;
    const [lx, lz] = b.toLocal(p.x, p.z), f = Math.round(p.rbY / fhOf(b)), rm = b.props.find(r => r.kind === 'room' && r.floor === f && lx > r.x1 && lx < r.x2 && lz > r.z1 && lz < r.z2);
    let dx = 0, dz = lz > -1.8 ? -1 : 1; if (rm) { dx = (rm.x1 + rm.x2) / 2 - lx; dz = (rm.z1 + rm.z2) / 2 - lz; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl; }
    const sx = lx + dx * 1.3, sz = lz + dz * 1.3, [x, z] = b.toWorld(sx, sz);
    out.push(['[퍼즐] ' + (p.label || p.kind) + ' — ' + (RBG.where(p.x, p.z, p.rbY + .5) || b.name), { floor: 0, x, z, sh: p.rbY, yaw: yawOf(b, sx, sz, lx, lz) }]); }
  return out;
}
const TP_OLD = [
  ['정문 앞 (도로)', { floor: 0, x: 0, z: 76, yaw: 0 }], ['운동장 · 본관 현관', { floor: 0, x: 0, z: 4, yaw: 0 }],
  ['본관 1F 복도', { floor: 0, x: 0, z: 0, yaw: -Math.PI / 2 }], ['본관 2F 복도', { floor: 1, x: 0, z: 0, yaw: -Math.PI / 2 }],
  ['본관 3F (방송실 앞)', { floor: 2, x: -24, z: 0, yaw: 0 }], ['옥상', { floor: 3, x: 0, z: -7.5, yaw: 0 }],
  ['지하 B1', { floor: 4, x: 0, z: 0, yaw: -Math.PI / 2 }], ['체육관', { floor: 5, x: 38, z: 28.1, yaw: 0 }],
  ['수영장', { floor: 6, x: -35.5, z: 38, yaw: Math.PI / 2 }], ['급식실', { floor: 7, x: -39, z: 20.5, yaw: 0 }],
  ['별관 1F', { floor: 8, x: 0, z: .2, yaw: -Math.PI / 2 }], ['별관 2F', { floor: 9, x: 0, z: 0, yaw: -Math.PI / 2 }],
  ['별관 3F', { floor: 10, x: 0, z: 0, yaw: -Math.PI / 2 }], ['서문 앞', { floor: 0, x: -49, z: 32, yaw: Math.PI / 2 }],
  ['1-1 교실 (캠코더)', { floor: 0, x: 8, z: -3, yaw: 0 }], ['B1 펌프실 (명찰)', { floor: 4, x: 32, z: -3, yaw: 0 }], ['방송실 장비실 (민아)', { floor: 2, x: -21.4, z: -5.0, yaw: 0 }],
  ['구역: 경비실', { floor: 0, x: GUARD_LAYOUT.cx, z: GUARD_LAYOUT.cz + .6, yaw: 0 }], ['구역: 운동장 조회대', { floor: 0, x: -10.2, z: 16.2, yaw: 0 }], ['구역: 과학실 (본관 2층)', { floor: 1, x: 32, z: -2.6, yaw: 0 }],
  ['구역: 급식실 조리실', { floor: 7, x: -33.5, z: 11.6, yaw: Math.PI / 2 }], ['구역: 옥상 발전기', { floor: 3, x: 14.5, z: 5.2, yaw: -Math.PI / 2 }], ['실내 연결복도', { floor: 0, x: 1.6, z: -11.0, yaw: 0 }], ['B1 전기실 (고압 분전반)', { floor: 4, x: -15.4, z: -3.0, yaw: 0 }], ['B1 보일러실', { floor: 4, x: -21.5, z: -2.6, yaw: 0 }], ['수영장 수조 (청록 수중등)', { floor: 6, x: -36.6, z: 32.6, yaw: Math.PI * .75 }], ['남/녀 탈의실·샤워실 입구', { floor: 6, x: -41.0, z: 34.0, yaw: 0 }], ['기계실 철문', { floor: 6, x: -40.0, z: 47.6, yaw: Math.PI }], ...S37_TP(),
  ['교무실 금고', { floor: 0, x: -10.4, z: -8.0, yaw: Math.PI / 2 }], ['도서실 서랍 (자물쇠 따기)', { floor: 0, x: 32.6, z: -7.4, yaw: 0 }], ['과학실 약품장 (다이얼)', { floor: 1, x: 31, z: -4.8, yaw: Math.PI / 2 }],
  ['체육관 기구함 (다이얼)', { floor: 5, x: 30.6, z: 20.6, yaw: Math.PI / 2 }], ['수영장 배수구 (갈고리)', { floor: 6, x: -41.5, z: 46.9, yaw: 0 }], ['음악실 피아노', { floor: 10, x: -6.2, z: -6.2, yaw: 0 }], ['미술실 그림 퍼즐', { floor: 10, x: -1.2, z: -4.6, yaw: 0 }], ['보건실 녹음기', { floor: 0, x: -5.6, z: 4.6, yaw: -Math.PI / 2 }], ['B1 전기실', { floor: 4, x: -16, z: -4, yaw: Math.PI / 2 }], ['3-3 교실', { floor: 2, x: -8, z: -3, yaw: 0 }], ['음악실', { floor: 10, x: -8, z: -3, yaw: 0 }],
];
const TP = RBG ? rbTpList(TP_OLD) : TP_OLD;   // 새 건물이면 예전 층 · [37실] 좌표 대신 새 건물 복도 · 방 · 퍼즐 앞으로
function testAct(fn) { closeUI(); setTimeout(fn, 60); }
function renderTest() {
  const b = (label, on, fn) => { const el = document.createElement('button'); el.textContent = label; if (on) el.classList.add('on'); el.onclick = fn; return el; };
  const tp = $('testTp'), ac = $('testAct'); tp.innerHTML = ''; ac.innerHTML = '';
  (RBG ? rbTpList(TP_OLD) : TP_OLD).forEach(([n, to]) => tp.appendChild(b(n, false, () => testAct(() => { if (!gateClosed && to.z < GATE_Z - 3) { gateClosed = true; gateState = 'closed'; gateAnim = 1; gate.setOpen(0); } teleport(to); }))));
  ac.appendChild(b(`무적 ${TST.god ? 'ON' : 'OFF'}`, TST.god, () => { TST.god = !TST.god; renderTest(); }));
  ac.appendChild(b('열쇠 조각 모두 획득', false, () => testAct(() => { world.items.filter(i => i.kind === 'key').forEach(i => { i.taken = true; i.mesh.visible = false; got[i.idx] = true; }); P.keys = TOTAL; refreshHud(); toast('테스트', `열쇠 ${TOTAL}/${TOTAL} — 정문·서문·비상 통로가 열립니다.`, 'info'); })));
  ac.appendChild(b('정문 열쇠 조합', false, () => testAct(() => { if (P.keys < TOTAL) { world.items.filter(i => i.kind === 'key').forEach(i => { i.taken = true; i.mesh.visible = false; got[i.idx] = true; }); P.keys = TOTAL; } FL.keyhead = true; FL.anPow = true; makeGateKey(); })));
  ac.appendChild(b('특별 목표 준비 (명찰+전력)', false, () => testAct(() => { const t = world.items.find(i => i.kind === 'nametag'); if (t && !t.taken) { t.taken = true; t.mesh.visible = false; } FL.tag = true; FL.opt = true; power = true; world.props.forEach(p => { if (p.kind === 'breaker') { p.on = true; p.done = true; } }); refreshHud(); toast('테스트', '명찰 획득 · 전력 복구 — 방송실에서 하교 방송', 'opt'); })));
  ac.appendChild(b('전화 걸려 오기 (테스트)', false, () => testAct(() => { CALL.ring = null; callRing({ id: 'test' + Date.now(), who: '발신번호 표시제한', lines: ['call_unk1'] }); })));
  ac.appendChild(b('도구 모두 지급', false, () => testAct(() => { inv.hairpin = 5; inv.can = 5; FL.fuse = true; FL.hook = true; refreshHud(); toast('테스트', '머리핀 5 · 빈 캔 5 · 퓨즈 · 갈고리', 'info'); })));
  ac.appendChild(b(`시점: ${view === 3 ? '3인칭' : '1인칭'}`, view === 3, () => { toggleView(); renderTest(); }));
  ac.appendChild(b('정문 개방 연출 (엔딩 직전)', false, () => testAct(() => enrage())));
  ac.appendChild(b('보급품 채우기', false, () => testAct(() => { P.hp = 100; P.battery = 100; P.stamina = 100; inv.battery = 5; inv.medkit = 5; refreshHud(); toast('테스트', 'HP·배터리·건전지·응급 밴드 보충', 'info'); })));
  ac.appendChild(b('모든 문 열기', false, () => testAct(() => world.doorList.forEach(d => { d.target = 1; }))));
  ac.appendChild(b('전력 복구', false, () => testAct(() => { power = true; world.props.forEach(p => { if (p.kind === 'breaker') { p.on = true; p.done = true; } }); toast('테스트', '전력 복구', 'info'); })));
  ac.appendChild(b('열쇠 머리 획득 (제4장 건너뛰기)', false, () => testAct(() => { FL.anPow = true; FL.keyhead = true; FL.sq.head = HEADQUEST.steps.length; refreshHud(); toast('테스트', '열쇠 머리 — 소지품에서 조합', 'info'); })));
  ac.appendChild(b('모든 문서 획득', false, () => testAct(() => { world.items.filter(i => i.kind === 'note' && !i.taken).forEach(i => { i.taken = true; i.mesh.visible = false; addDoc({ id: i.id, kind: 'note' }); if (CLUES[i.id]) addClue(i.id); }); refreshHud(); toast('테스트', `문서 ${docs.length}개`, 'info'); })));
  $('testInfo').textContent = `현재: ${AREA_NAMES[P.floor]} (${P.x.toFixed(1)}, ${P.z.toFixed(1)})  ·  열쇠 ${P.keys}/${TOTAL}`;
}
function openTest() { if (state !== 'playing') return; openUI('testOv'); renderTest(); }
if (TEST) {
  document.body.classList.add('test');
  $('testBadge').style.display = 'block';
  $('tTest').style.display = 'block';
}
// 시작: 타이틀 표시 (재시도 · 처음부터는 바로 이어서)
applyChar(); refreshTitle();
{ let auto = null; try { auto = sessionStorage.getItem(AUTO_KEY); sessionStorage.removeItem(AUTO_KEY); } catch (e) { /* ignore */ }
  if ((auto === 'continue' || auto === 'backup') && hasSave()) { closeMenus(); continueGame(auto === 'backup'); } else if (auto === 'new') { closeMenus(); newGame(); } }

// 휴대폰 · 무전기 HUD: 시계 · 배터리 · 신호(실내는 약함) / 무전 수신(초록) · 송신(빨강) 표시
function devRadio(st, who) { const w = $('dvWt'); if (!w) return; w.classList.toggle('rx', st === 'rx'); w.classList.toggle('tx', st === 'tx'); $('dvWtTxt').textContent = st === 'rx' ? `수신 중 — ${who}` : st === 'tx' ? `송신 중 — ${who}` : '대기 중'; if (st === 'rx' && sfx.staticNoise) try { sfx.staticNoise(.12); } catch (e) {} }
setInterval(() => { if (!$('hud').classList.contains('show')) return; try {
  $('dvClock').textContent = clockText(); $('dvBat').textContent = `🔋 ${Math.round(P.pbat ?? 100)}%`; $('dvPKey').textContent = (K().phone || 'KeyP').replace('Key', '');
  const sig = P.floor === 4 ? 0 : (RBG && RBG.inBuilding && RBG.inBuilding(P.x, P.z)) ? 2 : 4; [...$('dvSig').children].forEach((b, i) => b.classList.toggle('on', i < sig)); } catch (e) {} }, 500);
try { installPartnerRadio({ P, FL, char: () => CHAR, state: () => state, busy: isDialogueActive, speak, subtitle, chapter: () => objective().ch, introDone: () => introDone, inside: () => !!(RBG && RBG.inBuilding && RBG.inBuilding(P.x, P.z)), radio: devRadio }); } catch (e) { console.warn('[partner radio]', e); }
try { installHudV2({ THREE, P, camera, objDir, getState: () => state, objArrow: () => SET.objArrow !== false }); } catch (e) { console.warn('[hud v2]', e); }
if (DEBUG) {
  window.__g = {
    P, ghost, floors, world, scene, camera, renderer, THREE, start: () => start(true),
    setIntroT(t) { introText = false; introT = t; }, introInfo: () => ({ state, introT: +introT.toFixed(1), cue: introCue, guard: !!(introGuard && introGuard.visible), cam: camera.position.toArray().map(v => +v.toFixed(1)) }),
    photoCheck, PHOTOQ,
    flashNearProbe: () => { FN.t = 0; return flashNear(); }, agProbe: () => { const t = performance.now(); AG.t = 0; antiGlareTick(); return performance.now() - t; },
    bcAuto() { BC.power = true; BC.amp = 1; BC.ch = 'all'; BC.fader = 70; closeUI(); bcOnAir(); },   // 자동 점검: 콘솔 순서를 건너뛰고 ON AIR
    minaF: MINA_F, CONTACTS, CALL, callOut,
    tp(x, z, f = 0, yaw = 0, pitch = 0) { P.x = x; P.z = z; P.floor = f; P.yaw = yaw; P.pitch = pitch; },
    give() { world.items.filter(i => i.kind === 'key').forEach(i => { i.taken = true; i.mesh.visible = false; got[i.idx] = true; }); P.keys = TOTAL; refreshHud(); },
    get state() { return state; }, set state(v) { state = v; }, get tNow() { return tNow; }, openTest, EV, appar, applyQuality,
    interact, findInteract, hit, die, activateGhost, enrage, FL, MG, throwCan, throws, set playTime(v) { playTime = v; }, toggleView, get view() { return view; }, useProp, docs, msgs, clues, objective, makeGateKey, openInv, openPhone, openMap, openCharsel, openSettings, refreshHud, save, load, inv, mina,
    get power() { return power; }, set power(v) { power = v; }, get CHAR() { return CHAR; }, newGame, continueGame,
    ELV,elvCall,elvEnter,elvLeave,elvPress,elvTick,elvReset,setTarget(t) { target = t; }, DAY, GEN, SIDEQUESTS, sqStep, sqDoneCount, useSideQuest, HEADQUEST, useHead, COLLECT, tmpFx, roomAt, camMode, camShoot, CAM, MIC, SAN, BRK, setBreaker, schoolPower, craftingSystem, ghostCam, restroom, useSink, useFlush, placeAlarm, throwShock, useFirstAid, tryCombine, stunGhost, enterLocker, leaveLocker, startSearch, useMiniSpot, openChalk, chalkAsk, XT, winGame,
    choose, missionGroups, ghostTick, enrage, activateGhost, textureBudget, SG, sgTestSpawn, sgSpawn, SG_ZONES, PL, CALL, SIT, ZOOM, SHOT, closeUI, TP, whereText, FLOOR_LABEL, S37,
    get target() { return target; },
  };
}
// 형광등 스위치 초기 상태 반영 (방마다 일부만 켜져 있다)
syncSwitches();
// 소비 아이템 · 쪽지가 가구 속에 박혀 있으면(사물함 · 장 · 37실 설비가 나중에 놓여 겹친 경우) 바로 아래 가구 윗면으로 올린다 — 위에서 아래로 광선
async function itemUnbury() {
  const rc = new THREE.Raycaster(), dn = new THREE.Vector3(0, -1, 0); let moved = 0; rc.camera = camera;
  scene.updateMatrixWorld(true);
  const list = world.items.filter(it => !it.taken && it.mesh);
  for (let i = 0; i < list.length; i++) {
    if (i % 3 === 2) await new Promise(r => requestAnimationFrame(r)); // 프레임당 3개씩 비동기 분할하여 끊김(Hitch) 원천 차단!
    const it = list[i]; if (it.taken || !it.mesh) continue;
    const F = floors[it.floor]; if (!F || !F.interior) continue;
    rc.set(new THREE.Vector3(it.pos.x, it.pos.y + .9, it.pos.z), dn); rc.far = .88;
    let hits = []; try { hits = rc.intersectObjects([F.interior], true); } catch (e) { continue; }
    const hit = hits.find(h => h.object !== it.mesh && h.object.visible && !it.mesh.getObjectById?.(h.object.id) && h.object.isMesh && !h.object.material?.transparent);
    if (!hit) continue; const top = hit.point.y;
    if (top > it.pos.y + .04 && top - F.y0 < 1.95) { const dy = top + .03 - it.pos.y; it.pos.y += dy; it.mesh.position.y += dy; moved++; }
  }
  if (moved) console.info(`[아이템] 가구 속에 박힌 ${moved}개를 윗면으로 옮김`);
}
setTimeout(() => itemUnbury().catch(() => {}), 1500);
// 공중에 뜬 조사 대상 · 아이템 내려놓기: 새 건물로 옮기면서 받치던 가구가 사라졌거나 다른 높이의 자리에 놓인 것
//   (전수조사: 61개가 0.2 ~ 0.9m 떠 있었다) → 바로 아래 면(바닥 · 가구 윗면)까지 내린다. 벽에 붙은 것(액자 · 게시물)은 그대로.
//   바닥 밑으로 꺼진 것은 위에서 다시 찾아 올린다. 한 프레임에 몇 개씩 나눠서.

// 광선 검사용: 메시 목록을 월드 경계구로 한 번 정리해 두고, 질의 지점 근처 것만 골라 쓴다 (1만 개 전체를 매번 훑으면 수 초씩 멈췄다)
function nearSolids(solids) {
  const items = solids.map(o => { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); const s = o.geometry.boundingSphere.clone().applyMatrix4(o.matrixWorld); return { o, s }; });
  return (x, y, z, r) => { const out = []; for (const it of items) { const s = it.s, dx = s.center.x - x, dy = s.center.y - y, dz = s.center.z - z, R = s.radius + r; if (dx * dx + dy * dy + dz * dz < R * R) out.push(it.o); } return out; };
}
const SETTLED = new WeakMap();
async function settleFloating() {
  const T = THREE, rc = new T.Raycaster(), bb = new T.Box3(), c = new T.Vector3(), DN = new T.Vector3(0, -1, 0), solids = [];
  let tmpSet = new Set(); const vis = o => { for (let a = o; a; a = a.parent) if (!a.visible && !tmpSet.has(a)) return false; return true; };   // 광선 검사는 visible 을 보지 않는다 → 숨겨진 실내를 실제로 켜지 않고 '보이는 셈' 치고 잰다 (켜 둔 채 프레임을 넘기면 화면에 비쳤다)
  let moved = 0; const st = { t: performance.now() };
  for (const fl of [0, 4, 5, 6, 7]) {   // 바깥 · 새 본관/별관(0) + 지하 · 체육관 · 수영장 · 급식실 실내
  const Fi = floors[fl]; if (!Fi) continue; const tmp = fl ? [Fi.interior, Fi.shell].filter(Boolean).filter(r => !r.visible) : []; tmpSet = new Set(tmp);
  scene.updateMatrixWorld(true); solids.length = 0;
  scene.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && vis(o)) { const m = [].concat(o.material)[0]; if (m && !m.transparent && m.opacity >= 1 && !m.isMeshBasicMaterial) solids.push(o); } });
  const near = nearSolids(solids);
  const list = [...world.props.filter(q => q.floor === fl && !q.taken && (q.mesh || (q.kind === 'tape' && q.anim && q.anim.g))).map(q => ({ o: q, m: q.mesh || q.anim.g, prop: true, tape: !q.mesh })), ...world.items.filter(i => i.floor === fl && i.mesh && !i.taken).map(i => ({ o: i, m: i.mesh }))];
  for (let n = 0; n < list.length; n++) {
    await sliceYield(st);   // 6ms 쓰면 한 프레임 쉰다 (실내 층을 한 번에 돌리던 것이 플레이 중 0.1~1초 멈춤을 만들었다)
    const { o, m, prop, tape } = list[n]; if ((o.anim && !tape) || o.hang) continue;
    { const k = (prop ? o.x + ',' + o.z : o.pos.x + ',' + o.pos.z) + ',' + m.position.y; if (SETTLED.get(o) === k) continue; SETTLED.set(o, k); }   // 이미 검사했고 그대로면 건너뜀
    { const wp = m.getWorldPosition(c), ox = prop ? o.x : o.pos.x, oz = prop ? o.z : o.pos.z;   // 조사 지점만 옮겨지고 물건은 옛 자리에 남은 경우 → 물건을 조사 지점으로
      if (!fl && Math.hypot(wp.x - ox, wp.z - oz) > 1.2 && m.parent) { const lp = m.parent.worldToLocal(new T.Vector3(ox, wp.y, oz)); m.position.x = lp.x; m.position.z = lp.z; m.updateMatrixWorld(true); moved++; } }
    if (!vis(m)) continue;
    const own = new Set(); m.traverse(x => own.add(x));
    bb.setFromObject(m); if (bb.isEmpty()) continue; bb.getCenter(c);
    const loc = near(c.x, c.y, c.z, 5); const first = (from, dir, far) => { rc.set(from, dir); rc.far = far; return rc.intersectObjects(loc, false).find(h => !own.has(h.object)); };
    // 벽걸이(얇은 판): 수평 0.25m 안에 벽이 있으면 건너뜀
    if (Math.min(bb.max.x - bb.min.x, bb.max.z - bb.min.z) < .06 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => first(new T.Vector3(c.x, c.y, c.z), new T.Vector3(dx, 0, dz), Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2 + .25))) continue;
    let h = first(new T.Vector3(c.x, bb.min.y + .02, c.z), DN, 4), dy = 0;
    if (h) { const gap = bb.min.y - h.point.y;
      if (tape && gap > .3) {   // 녹음기: 받치던 책상이 없어졌다 → 2.5m 안 가구 윗면으로 옮기고, 없을 때만 그 높이의 작은 탁자를 놓는다
        let pick = null; const fy = h.point.y;
        for (let rr = .4; rr <= 2.5 && !pick; rr += .3) for (let a2 = 0; a2 < 16 && !pick; a2++) { const an = a2 / 16 * Math.PI * 2, px = c.x + Math.cos(an) * rr, pz = c.z + Math.sin(an) * rr;
          const h2 = first(new T.Vector3(px, fy + 1.4, pz), DN, 1.2); if (!h2 || h2.point.y < fy + .55 || h2.point.y > fy + 1.1) continue;
          const wall = first(new T.Vector3(c.x, fy + 1.3, c.z), new T.Vector3(px - c.x, 0, pz - c.z).normalize(), rr); if (wall) continue;   // 벽 너머(다른 방 · 복도)는 안 됨
          pick = [px - c.x, h2.point.y - bb.min.y + .005, pz - c.z]; }
        if (pick) { m.position.x += pick[0]; m.position.y += pick[1]; m.position.z += pick[2]; o.x += pick[0]; o.z += pick[2]; if (o.y != null) o.y += pick[1]; moved++; continue; }
        dy = -gap + .005;   // 받칠 가구가 없으면 바닥에 내려놓는다 (복도 한가운데 탁자를 세우면 책상이 밖에 나와 있는 것처럼 보였다)
      } else if (gap > .06) dy = -gap + .005; }
    else { h = first(new T.Vector3(c.x, bb.min.y + 1.2, c.z), DN, 1.3); if (h && h.point.y > bb.min.y + .02) dy = h.point.y - bb.min.y + .005; }   // 바닥 밑으로 꺼진 것
    if (!dy) continue;
    m.position.y += dy; if (prop) { if (o.y != null) { o.y += dy; if (o.rbY != null && o.y < o.rbY - .1 && o.y < .02) o.y = .02; } }   // 층 기준 상대 높이가 바닥 아래로 내려가지 않게 else if (o.pos) { o.pos.y += dy; if (o.baseY != null) o.baseY += dy; }
    moved++;
  }
  tmpSet = new Set(); }
  if (moved) console.info(`[정착] 떠 있던 조사 대상 · 아이템 ${moved}개를 바로 아래 면으로 내림`);
  return moved;
}
[9000, 40000].forEach(ms => setTimeout(() => settleFloating().catch(e => console.warn('[settle]', e)), ms));
// 손전등 그림자: 그림자를 드리우는 물체가 3천 개가 넘어 그림자 패스가 화면을 한 번 더 그리는 만큼 무거웠다 → 손바닥보다 작은 소품은 그림자에서 뺀다
async function trimTinyCasters() { const st = { t: performance.now() }, sp = new THREE.Sphere(); let n = 0; const list = []; scene.traverse(o => { if (o.isMesh && o.castShadow && !o.isSkinnedMesh) list.push(o); });
  for (const o of list) { await sliceYield(st); const g = o.geometry; if (!g) continue; if (!g.boundingSphere) g.computeBoundingSphere(); sp.copy(g.boundingSphere).applyMatrix4(o.matrixWorld); if (sp.radius < .22) { o.castShadow = false; n++; } }
  if (n) console.info(`[그림자] 작은 소품 ${n}개를 그림자 계산에서 뺌`); }
[22000, 75000].forEach(ms => setTimeout(() => trimTinyCasters().catch(e => console.warn('[casters]', e)), ms));
// 허공 조사 지점: 새 건물로 옮기면서 기대던 물체(칠판 · 배전반 · 카드함 · 전화기 …)가 없는 자리에 놓인 것 (전수조사 76곳)
//   → 가까운 벽(3m 안)이 있으면 벽 앞 0.3m 로 옮기고 벽걸이 물체를, 없으면 그 자리에 낮은 수납장을 놓는다 (+ 충돌 상자)
const PH_LOOK = [[/칠판/, 'board'], [/배전반|두꺼비집|제어반|단말기|게시판|대자보|약품함|약품 선반/, 'panel'], [/수화기|전화/, 'phone']];
let phDone = new WeakSet();
// 한 번에 다 돌리면 메인 스레드가 수십 초 멈춘다(크롬 '응답 없는 페이지') → 6ms 쓰면 한 프레임 쉰다
const sliceYield = async st => { if (performance.now() - st.t > 6) { await new Promise(r => setTimeout(r, 16)); st.t = performance.now(); } };
async function fixPhantoms() { const st = { t: performance.now() };
  const T = THREE, rc = new T.Raycaster(), solids = [], vis = o => { for (let a = o; a; a = a.parent) if (!a.visible) return false; return true; };
  scene.updateMatrixWorld(true); scene.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && vis(o)) solids.push(o); }); const nearS = nearSolids(solids);
  const M = (c, r = .6, m = .1) => new T.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const mats = { board: M(0x1e3a2c, .85), frame: M(0x8a6a44, .6), panel: M(0x9aa0a4, .45, .5), phone: M(0x2a2c30, .4, .2), cab: M(0x8a7458, .7) };
  let n = 0;
  for (const q of world.props) {
    if (q.floor !== 0 || q.mesh || q.taken || phDone.has(q) || !['robj', 'fz', 'chalk', 'cbreaker', 'look'].includes(q.kind)) continue;
    await sliceYield(st);
    const y = q.rbY != null ? (q.y != null && q.y > q.rbY - .1 ? q.y : q.rbY + (q.y ?? 1)) : (q.y ?? 1), o = new T.Vector3(q.x, y, q.z);
    { const loc = nearS(q.x, y, q.z, 4); solids.length = 0; solids.push(...loc); }
    let best = null, md = 9;
    for (const d of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0], [0, 1, 0]]) { rc.set(o, new T.Vector3(...d)); rc.far = 3; const h = rc.intersectObjects(solids, false)[0]; if (h) { md = Math.min(md, h.distance); if (d[1] === 0 && (!best || h.distance < best.distance)) best = { ...h, dir: d }; } }
    phDone.add(q); if (md <= 1.2) continue;
    const label = q.label || '', kind = q.kind === 'chalk' ? 'board' : q.kind === 'cbreaker' ? 'panel' : (PH_LOOK.find(([re]) => re.test(label)) || [0, null])[1];
    const floorY = q.rbY ?? 0, g = new T.Group(); g.name = 'PH_STANDIN'; g.userData.rbKeep = true; g.userData.facKeep = true;
    { // 1순위: 3m 안 기존 가구 윗면(바닥 +0.55 ~ 1.15m)으로 조사 지점만 옮긴다 — 같은 방 쪽(벽 너머 아님)
      let pick = null;
      for (let rr = .4; rr <= 3 && !pick; rr += .5) for (let a2 = 0; a2 < 8 && !pick; a2++) { if (a2 === 0) await sliceYield(st); const an = a2 / 8 * Math.PI * 2, px = q.x + Math.cos(an) * rr, pz = q.z + Math.sin(an) * rr;
        rc.set(new T.Vector3(px, floorY + 1.6, pz), new T.Vector3(0, -1, 0)); rc.far = 1.2; const h2 = rc.intersectObjects(solids, false)[0];
        if (!h2 || h2.point.y < floorY + .55 || h2.point.y > floorY + 1.15 || (h2.face && h2.face.normal.clone().transformDirection(h2.object.matrixWorld).y < .7)) continue;
        rc.set(new T.Vector3(q.x, y, q.z), new T.Vector3(px - q.x, 0, pz - q.z).normalize()); rc.far = rr; const wall = rc.intersectObjects(solids, false)[0]; if (wall && wall.point.y > floorY + 1.2) continue;
        pick = [px, pz, h2.point.y]; }
      if (pick && kind !== 'board') { q.x = pick[0]; q.z = pick[1]; if (q.y != null) q.y = pick[2] + .1; n++; continue; } }
    // 새 본관 · 별관 안에서는 받침 물체를 새로 만들지 않는다 — 벽 대신 문짝 · 문틀에 붙은 칠판이 출입문 쪽으로 돌아가고,
    //   복도 벽을 따라 임시 수납장이 줄지어 서던 원인. 조사 지점은 그대로 두고(바닥 조사) 실제 가구만 쓴다
    if (RBG && RBG.inBuilding && RBG.inBuilding(q.x, q.z)) continue;
    if (best && best.distance < 3 && kind) {   // 벽걸이
      const [dx, , dz] = best.dir, wx = q.x + dx * best.distance, wz = q.z + dz * best.distance, ry = Math.atan2(-dx, -dz);
      const W = kind === 'board' ? 1.8 : kind === 'phone' ? .22 : .5, H = kind === 'board' ? 1.1 : kind === 'phone' ? .32 : .6, D = kind === 'phone' ? .1 : .06, cy = floorY + (kind === 'board' ? 1.45 : 1.35);
      const box = new T.Mesh(new T.BoxGeometry(W, H, D), mats[kind]); box.position.set(wx - dx * D / 2, cy, wz - dz * D / 2); box.rotation.y = ry; g.add(box);
      if (kind === 'board') { const fr = new T.Mesh(new T.BoxGeometry(W + .08, .06, .1), mats.frame); fr.position.set(wx - dx * .05, cy - H / 2 - .03, wz - dz * .05); fr.rotation.y = ry; g.add(fr); }
      q.x = wx - dx * .45; q.z = wz - dz * .45; if (q.y != null) q.y = cy;
    } else {   // 낮은 수납장 (윗면에 조사 대상)
      { let w = best && best.distance < 3 ? best : null;   // 통로 한가운데 말고 가까운 벽(8m 안)에 붙여서
        if (!w) { const all = nearS(q.x, y, q.z, 9); for (const d of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) { rc.set(new T.Vector3(q.x, floorY + 1.3, q.z), new T.Vector3(...d)); rc.far = 8; const h3 = rc.intersectObjects(all, false)[0]; if (h3 && (!w || h3.distance < w.distance)) w = { distance: h3.distance, dir: d }; } }
        if (w) { const [dx, , dz] = w.dir; q.x += dx * (w.distance - .26); q.z += dz * (w.distance - .26); } }
      const cab = new T.Mesh(new T.BoxGeometry(.7, .85, .45), mats.cab); cab.position.set(q.x, floorY + .425, q.z); g.add(cab);
      if (RBG && RBG.inBuilding(q.x, q.z) && RBG.extra) RBG.extra.push({ x1: q.x - .35, x2: q.x + .35, z1: q.z - .23, z2: q.z + .23, y: floorY });
      else floors[0].col.push({ x1: q.x - .35, x2: q.x + .35, z1: q.z - .23, z2: q.z + .23, h: floorY + .85, ...(floorY > 2 ? { y0: floorY } : {}) });
      if (q.y != null) q.y = floorY + .95;
    }
    scene.add(g); n++;
  }
  if (n) console.info(`[허공 조사 지점] ${n}곳에 받침 물체를 놓음`);
}
[25000, 55000].forEach(ms => setTimeout(() => fixPhantoms().catch(e => console.warn('[phantom]', e)), ms));
// 벽걸이 설비(비상벨 · 배전반 · 분전반 · 화재경보기 · 소화기 점검표)가 벽에서 떨어져 복도 한가운데 떠 있던 것 → 가장 가까운 벽(4m 안)에 붙이고 설비 모양을 단다
async function fixWallMounts() { const st = { t: performance.now() };
  const T = THREE, rc = new T.Raycaster(), solids = [], vis = o => { for (let a = o; a; a = a.parent) if (!a.visible) return false; return true; };
  scene.updateMatrixWorld(true); scene.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && vis(o)) solids.push(o); }); const nearS = nearSolids(solids);
  const RE = /비상벨|배전반|분전반|두꺼비집|화재경보기|소화기/, red = new T.MeshStandardMaterial({ color: 0xb8231c, roughness: .4 }), grey = new T.MeshStandardMaterial({ color: 0x9aa0a4, roughness: .45, metalness: .5 });
  let n = 0;
  for (const q of world.props) {
    if (q.floor !== 0 || q.taken || q.mesh || q._wm || (await sliceYield(st), false) || !(q.kind === 'bell' || q.kind === 'cbreaker' || RE.test(q.label || ''))) continue;
    const y = q.rbY != null ? (q.y != null && q.y > q.rbY - .1 ? q.y : q.rbY + (q.y ?? 1)) : (q.y ?? 1), loc = nearS(q.x, y, q.z, 5); let best = null;
    for (const d of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { rc.set(new T.Vector3(q.x, Math.max(y, (q.rbY ?? 0) + 1.3), q.z), new T.Vector3(d[0], 0, d[1])); rc.far = 4; const h = rc.intersectObjects(loc, false)[0]; if (h && (!best || h.distance < best.distance)) best = { d: h.distance, distance: h.distance, dir: d }; }
    q._wm = true; if (!best || best.distance <= .55) continue;
    if (RBG && RBG.inBuilding && RBG.inBuilding(q.x, q.z)) continue;   // 새 건물엔 진짜 배전반 · 비상벨이 있다 — 칠판 · 창 · 게시판 · 문틀 위에 덧붙던 것 방지
    const [dx, dz] = best.dir, wx = q.x + dx * best.distance, wz = q.z + dz * best.distance, fy = q.rbY ?? 0, bell = q.kind === 'bell' || /비상벨|화재경보기/.test(q.label || '');
    const m = bell ? new T.Mesh(new T.CylinderGeometry(.09, .09, .05, 20), red) : new T.Mesh(new T.BoxGeometry(.45, .6, .1), grey);
    if (bell) m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dx, 0, dz)); else m.rotation.y = Math.atan2(-dx, -dz);
    m.position.set(wx - dx * .05, fy + (bell ? 1.5 : 1.45), wz - dz * .05); m.userData.rbKeep = true; m.name = 'WALL_MOUNT'; scene.add(m);
    q.x = wx - dx * .45; q.z = wz - dz * .45; if (q.y != null) q.y = fy + 1.4; n++;
  }
  if (n) console.info(`[벽걸이 설비] ${n}개를 벽에 붙임`);
}
// 옛 화장실 조사 지점이 새 건물 교실로 옮겨져 '막힌 소변기' 같은 이름이 맞지 않던 것 → 근처(6m)에 변기 · 세면대가 없으면 장소에 맞는 이름으로
function fixToiletLabels() { let n = 0;
  for (const q of world.props) { if (q.floor !== 0 || q.taken || !/소변기|변기|세면대/.test(q.label || '') || q.kind === 'flush' || q.kind === 'sink') continue;
    const near = world.props.some(o => o !== q && o.floor === 0 && (o.kind === 'flush' || o.kind === 'sink') && Math.hypot(o.x - q.x, o.z - q.z) < 6 && Math.abs((o.rbY ?? 0) - (q.rbY ?? 0)) < 1);
    if (near) continue; q.label = q.kind === 'search' ? '청소도구함 뒤지기' : q.label.replace(/막힌 소변기|소변기|변기|세면대/g, '청소도구함'); n++; }
  if (n) console.info(`[이름 정리] 화장실 밖 조사 지점 ${n}곳`); }
[26000, 56000].forEach(ms => setTimeout(() => { try { fixToiletLabels(); } catch (e) { console.warn('[labels]', e); } fixWallMounts().catch(e => console.warn('[wallmount]', e)); }, ms));



window.__quest = { liveLoc, keyLoc, LOC, objective, KEY_ROOMS };
