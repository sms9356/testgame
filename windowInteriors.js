// 외벽 창문 너머로 실제 3D 입체 교실 내부(천장 · 바닥 · 1998 감성 회벽/웨인스코팅 · 형광등 · 칠판 · 짝꿍 책걸상)가 비스듬한 각도에서도 막힘 없이 투시되도록 생성하는 3D 인테리어 모듈 (v156)
import * as THREE from './vendor/three.module.js';

let MATS = null;
function getMats() {
  if (MATS) return MATS;
  MATS = {
    wall: new THREE.MeshStandardMaterial({ color: 0xb8b2a2, roughness: 0.88, side: THREE.DoubleSide }),
    wainscot: new THREE.MeshStandardMaterial({ color: 0x7a806c, roughness: 0.65, side: THREE.DoubleSide }),
    floor: new THREE.MeshStandardMaterial({ color: 0x4a3624, roughness: 0.78, side: THREE.DoubleSide }),
    ceil: new THREE.MeshStandardMaterial({ color: 0xc8c4b8, roughness: 0.90, side: THREE.DoubleSide }),
    board: new THREE.MeshStandardMaterial({ color: 0x183426, roughness: 0.72 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x5c3d24, roughness: 0.68 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.45, metalness: 0.55 }),
    lampLit: new THREE.MeshBasicMaterial({ color: 0xfff6e0 }),
    lampOff: new THREE.MeshStandardMaterial({ color: 0x687074, roughness: 0.5 }),
  };
  return MATS;
}

function pushBox(pos, nor, idx, x0, x1, y0, y1, z0, z1) {
  const faces = [
    [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
    [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]],
    [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]],
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]],
    [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]],
    [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]],
  ];
  for (const [p0, p1, p2, p3, n] of faces) {
    const b = pos.length / 3;
    pos.push(...p0, ...p1, ...p2, ...p3);
    nor.push(...n, ...n, ...n, ...n);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
}

function makeGeo(b) {
  if (!b.pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
  g.setIndex(b.idx);
  return g;
}

export function buildWindowFakes(slots, seed = 0) {
  const g = new THREE.Group();
  g.name = 'windowFakes';
  g.userData.dynamic = true;
  const M = getMats();
  const buckets = {};
  for (const k of Object.keys(M)) buckets[k] = { pos: [], nor: [], idx: [] };

  slots.forEach((s, i) => {
    const [x, w, z, yc = 1.7, hw2 = 1.6, variant] = s;
    if (variant === 4) return;
    const south = z >= 0;
    const dir = south ? -1 : 1;
    const zFront = z + dir * 0.32;
    const depth = 4.4;
    const zBack = zFront + dir * depth;
    const zMin = Math.min(zFront, zBack), zMax = Math.max(zFront, zBack);
    if (Math.abs(x) < 4.2 && z < 0) return; // 중앙 계단실 구간 제외
    const hw = w * 1.15;
    const slotCx = Math.round(x / 8) * 8;
    const x0 = Math.max(x - hw, slotCx - 3.82), x1 = Math.min(x + hw, slotCx + 3.82);
    const yFloor = yc - hw2 * 0.5 - 0.65;
    const yCeil = yc + hw2 * 0.5 + 0.55;
    const yWain = yFloor + 1.05;
    const lit = ((i * 3 + seed * 2) % 3) !== 0;

    pushBox(buckets.floor.pos, buckets.floor.nor, buckets.floor.idx, x0, x1, yFloor - 0.04, yFloor, zMin, zMax);
    pushBox(buckets.ceil.pos, buckets.ceil.nor, buckets.ceil.idx, x0, x1, yCeil, yCeil + 0.05, zMin, zMax);
    // 안쪽 복도벽 (상단 아이보리 회벽 + 원목 몰딩 + 하단 세이지 웨인스코팅 + 복도쪽 창문/문판)
    pushBox(buckets.wall.pos, buckets.wall.nor, buckets.wall.idx, x0, x1, yWain, yCeil, zBack - 0.04, zBack + 0.04);
    pushBox(buckets.wainscot.pos, buckets.wainscot.nor, buckets.wainscot.idx, x0, x1, yFloor, yWain, zBack - 0.03, zBack + 0.03);
    pushBox(buckets.wood.pos, buckets.wood.nor, buckets.wood.idx, x0, x1, yWain - 0.03, yWain + 0.03, zBack - 0.05, zBack + 0.05);

    // 안쪽 벽 칠판 / 환경미화 게시판
    pushBox(buckets.wood.pos, buckets.wood.nor, buckets.wood.idx, x - hw * 0.55, x + hw * 0.55, yFloor + 1.15, yFloor + 2.15, zBack - 0.06, zBack + 0.06);
    pushBox(buckets.board.pos, buckets.board.nor, buckets.board.idx, x - hw * 0.50, x + hw * 0.50, yFloor + 1.22, yFloor + 2.08, zBack - 0.07, zBack + 0.07);

    // 천장 트윈 형광등
    for (const dx of [-hw * 0.36, hw * 0.36]) {
      const lz0 = zFront + dir * 1.1, lz1 = zFront + dir * 3.1;
      pushBox(buckets.metal.pos, buckets.metal.nor, buckets.metal.idx, x + dx - 0.12, x + dx + 0.12, yCeil - 0.05, yCeil, Math.min(lz0, lz1), Math.max(lz0, lz1));
      const lb = lit ? buckets.lampLit : buckets.lampOff;
      pushBox(lb.pos, lb.nor, lb.idx, x + dx - 0.07, x + dx + 0.07, yCeil - 0.08, yCeil - 0.05, Math.min(lz0, lz1) + 0.05, Math.max(lz0, lz1) - 0.05);
    }

    // 교실 안쪽 책걸상 (창문 바로 앞 1m는 비워 시야를 가리지 않고 1.6m / 2.9m 깊이에 배치!)
    for (const r of [1.65, 2.95]) {
      for (const c of [-hw * 0.35, hw * 0.35]) {
        const dx = x + c, dz = zFront + dir * r;
        pushBox(buckets.wood.pos, buckets.wood.nor, buckets.wood.idx, dx - 0.34, dx + 0.34, yFloor + 0.72, yFloor + 0.76, dz - 0.24, dz + 0.24);
        pushBox(buckets.metal.pos, buckets.metal.nor, buckets.metal.idx, dx - 0.30, dx - 0.26, yFloor, yFloor + 0.72, dz - 0.20, dz + 0.20);
        pushBox(buckets.metal.pos, buckets.metal.nor, buckets.metal.idx, dx + 0.26, dx + 0.30, yFloor, yFloor + 0.72, dz - 0.20, dz + 0.20);
        const cz = dz + dir * 0.34;
        pushBox(buckets.wood.pos, buckets.wood.nor, buckets.wood.idx, dx - 0.20, dx + 0.20, yFloor + 0.42, yFloor + 0.45, cz - 0.18, cz + 0.18);
        pushBox(buckets.wood.pos, buckets.wood.nor, buckets.wood.idx, dx - 0.20, dx + 0.20, yFloor + 0.45, yFloor + 0.78, cz + dir * 0.14, cz + dir * 0.18);
      }
    }
  });

  for (const [k, b] of Object.entries(buckets)) {
    const geo = makeGeo(b);
    if (!geo) continue;
    const m = new THREE.Mesh(geo, M[k]);
    m.userData.dynamic = true;
    m.castShadow = false;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

export function updateWindowFakes(dk) {
  if (!MATS) return;
  const v = 0.55 + 0.45 * Math.max(0, Math.min(1, dk));
  MATS.wall.color.setRGB(0.72 * v, 0.70 * v, 0.64 * v);
  MATS.wainscot.color.setRGB(0.48 * v, 0.50 * v, 0.42 * v);
  MATS.ceil.color.setRGB(0.78 * v, 0.76 * v, 0.72 * v);
}