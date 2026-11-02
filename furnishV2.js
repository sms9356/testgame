// 방 용도에 맞는 실사 가구 보강 (furnish v2 · 디자인팀)
//   새 건물(재건축) 방 가운데 비어 있거나 상자형 소품만 있던 방에 실사 모델(Poly Haven CC0 · sf 시리즈)을 벽을 따라 놓는다.
//   빈 바닥 찾기: 그 방의 가구 · 벽 충돌 상자(b.col)와 겹치지 않고, 복도 쪽 문 앞(1.2m)과 조사 지점 근처(0.9m)는 비운다.
//   놓은 가구는 충돌 상자도 함께 넣어 통과되지 않게 하고, 지금 있는 건물 · 층에서만 그린다.
import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';
const SRC = n => n.startsWith('sf_') ? 'assets/models/sf/' + n + '.glb' : 'assets/models/' + n + '/' + n + '.gltf';
const M = { sofa: ['sf_sofa', .86, 1], cooler: ['sf_water_cooler', 1.12, 1], shelf: ['steel_frame_shelves_01', 1.85, 1], box: ['cardboard_box_01', .42, 0], chest: ['metal_tool_chest', 1.0, 1], vend: ['sf_vending', 1.82, 1], chair: ['plastic_monobloc_chair_01', .8, 0], board: ['standing_chalkboard_01', 1.65, 1] };
const PLAN = [
  [/상담실/, ['sofa', 'cooler']],
  [/교무실|행정실/, ['cooler', 'shelf']],
  [/회의실/, ['cooler']],
  [/보건실/, ['cooler']],
  [/창고/, ['shelf', 'shelf', 'chest', 'box', 'box', 'box']],
  [/방송실/, ['shelf', 'box']],
  [/빈 교실/, ['box', 'box', 'chair', 'chair', 'board']],
  [/중앙 현관/, ['vend'], 'side'],
  [/자율학습실/, ['cooler']],
];
const loader = new GLTFLoader(), cache = {};
const load = n => cache[n] || (cache[n] = new Promise((res, rej) => loader.load(SRC(n), g => res(g.scene), undefined, rej)));
export async function furnishRooms({ scene, RBG, world, getP }) {
  if (!RBG || !RBG.BLD || window.__furnishV2) return 0; window.__furnishV2 = { placed: [] };
  const placed = window.__furnishV2.placed;
  for (const b of RBG.BLD) { if (!b.props || !b.col) continue; const FH = (b.spec && b.spec.FH) || 3.6;
    for (const r of b.props.filter(p => p.kind === 'room' && p.label)) {
      const pe = PLAN.find(([re]) => re.test(r.label)), plan = pe && pe[1], side = pe && pe[2] === 'side'; if (!plan) continue;
      const y = r.floor * FH, pts = (world.props || []).filter(p => p.rbY != null && Math.abs(p.rbY - y) < 1).map(p => b.toLocal(p.x, p.z));
      for (const key of plan) { try {
        const [name, H, wall] = M[key]; const src = await load(name); src.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(src), sz = bb.getSize(new THREE.Vector3()); if (!sz.y) continue;
        const s = H / sz.y, w = sz.x * s, d = sz.z * s;
        const spot = findSpot(b, r, y, w, d, wall, pts, side); if (!spot) continue;
        const o = src.clone(true); o.scale.setScalar(s);
        const [wx, wz] = b.toWorld(spot.x, spot.z), [ax, az] = b.toWorld(spot.x + spot.fx, spot.z + spot.fz);
        o.rotation.y = Math.atan2(ax - wx, az - wz);   // 모델 앞(+z)이 방 안쪽을 보게
        o.position.set(wx, y, wz); o.updateMatrixWorld(true); const b2 = new THREE.Box3().setFromObject(o);
        o.position.x += wx - (b2.min.x + b2.max.x) / 2; o.position.z += wz - (b2.min.z + b2.max.z) / 2; o.position.y += y - b2.min.y + .002;   // 자리 가운데 · 바닥에 딱
        o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
        o.name = 'FURN2_' + name; o.userData.furn2 = { f: r.floor, b: b.name, room: r.label }; o.userData.rbKeep = true;   // 예전 건물 자리 정리(숨김) 대상에서 제외 scene.add(o);
        b.col.push({ x1: spot.x - spot.hw, x2: spot.x + spot.hw, z1: spot.z - spot.hd, z2: spot.z + spot.hd, y1: y, y2: y + H, furn2: true });
        pts.push([spot.x, spot.z]);
        placed.push({ o, b, f: r.floor, room: r.label, name });
      } catch (e) { console.warn('[furnish v2]', key, e && e.message); } await new Promise(q => setTimeout(q, 0)); }
    } }
  setInterval(() => { const P = getP(); if (!P) return; const inB = P.floor === 0 && RBG.inBuilding && RBG.inBuilding(P.x, P.z), pf = Math.round((P.sh || 0) / 3.6);
    for (const it of placed) it.o.visible = P.floor === 0 && (inB ? it.f === pf : it.f === 0 && Math.hypot(it.o.position.x - P.x, it.o.position.z - P.z) < 40); }, 400);
  return placed.length;
}
function findSpot(b, r, y, w, d, wall, pts, side) {
  const busy = (x1, x2, z1, z2) => b.col.some(c => !c.off && c.x2 > x1 && c.x1 < x2 && c.z2 > z1 && c.z1 < z2 && (c.y1 == null || (c.y1 < y + 1.8 && (c.y2 ?? 99) > y + .05)));
  const nearPt = (x, z) => pts.some(([px, pz]) => Math.hypot(px - x, pz - z) < .9);
  const m = .06, cands = [], ts = [.5, .3, .7, .15, .85];
  for (const t of ts) {
    cands.push({ x: r.x1 + .12 + d / 2, z: r.z1 + 1.2 + (r.z2 - r.z1 - 1.2) * t, fx: 1, fz: 0, hw: d / 2, hd: w / 2 });
    cands.push({ x: r.x2 - .12 - d / 2, z: r.z1 + 1.2 + (r.z2 - r.z1 - 1.2) * t, fx: -1, fz: 0, hw: d / 2, hd: w / 2 });
    if (!side) cands.push({ x: r.x1 + (r.x2 - r.x1) * t, z: r.z2 - .14 - d / 2, fx: 0, fz: -1, hw: w / 2, hd: d / 2 });   // 현관은 뒤(출입문) 벽에 두지 않는다
  }
  if (!wall) for (const t of ts) for (const u of [.4, .7]) { const h = Math.max(w, d) / 2; cands.push({ x: r.x1 + (r.x2 - r.x1) * t, z: r.z1 + (r.z2 - r.z1) * u, fx: 0, fz: 1, hw: h, hd: h }); }
  for (const c of cands) { if (c.x - c.hw < r.x1 + .05 || c.x + c.hw > r.x2 - .05 || c.z - c.hd < r.z1 + 1.15 || c.z + c.hd > r.z2 - .05) continue;
    if (busy(c.x - c.hw - m, c.x + c.hw + m, c.z - c.hd - m, c.z + c.hd + m) || nearPt(c.x, c.z)) continue; return c; }
  return null;
}
