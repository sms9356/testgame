// 외벽 창문 너머로 실제 3D 입체 교실 내부(천장 · 바닥 · 안쪽 복도벽/창 · 형광등 · 칠판 · 입체 책상/의자)가 투시되도록 생성하는 3D 인테리어 모듈 (2D 이미지 미사용)
import * as THREE from './vendor/three.module.js';

let MATS = null;
function getMats() {
  if (MATS) return MATS;
  MATS = {
    wall: new THREE.MeshStandardMaterial({ color: 0x383e40, roughness: 0.9, side: THREE.DoubleSide }),
    wainscot: new THREE.MeshStandardMaterial({ color: 0x243436, roughness: 0.85, side: THREE.DoubleSide }),
    floor: new THREE.MeshStandardMaterial({ color: 0x2e2218, roughness: 0.8, side: THREE.DoubleSide }),
    ceil: new THREE.MeshStandardMaterial({ color: 0x424648, roughness: 0.92, side: THREE.DoubleSide }),
    board: new THREE.MeshStandardMaterial({ color: 0x162820, roughness: 0.75 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.75 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.5, metalness: 0.5 }),
    lampLit: new THREE.MeshBasicMaterial({ color: 0xd8ece8 }),
    lampOff: new THREE.MeshStandardMaterial({ color: 0x586064, roughness: 0.5 }),
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
    const zFront = z + dir * 0.16;
    const depth = 3.2;
    const zBack = zFront + dir * depth;
    const zMin = Math.min(zFront, zBack), zMax = Math.max(zFront, zBack);
    const hw = w * 0.68;
    const x0 = x - hw, x1 = x + hw;
    const yFloor = yc - hw2 * 0.5 - 0.65;
    const yCeil = yc + hw2 * 0.5 + 0.55;
    const yWain = yFloor + 1.05;
    const lit = ((i * 5 + seed * 3) % 5) === 0;

    pushBox(buckets.floor.pos, buckets.floor.nor, buckets.floor.idx, x0, x1, yFloor - 0.04, yFloor, zMin, zMax);
    pushBox(buckets.ceil.pos, buckets.ceil.nor, buckets.ceil.idx, x0, x1, yCeil, yCeil + 0.05, zMin, zMax);
    pushBox(buckets.wall.pos, buckets.wall.nor, buckets.wall.idx, x0, x1, yWain, yCeil, zBack - 0.04, zBack + 0.04);
    pushBox(buckets.wainscot.pos, buckets.wainscot.nor, buckets.wainscot.idx, x0, x1, yFloor, yWain, zBack - 0.03, zBack + 0.03);
    pushBox(buckets.wall.pos, buckets.wall.nor, buckets.wall.idx, x0 - 0.04, x0, yFloor, yCeil, zMin, zMax);
    pushBox(buckets.wall.pos, buckets.wall.nor, buckets.wall.idx, x1, x1 + 0.04, yFloor, yCeil, zMin, zMax);

    const zBoard0 = zFront + dir * 0.55, zBoard1 = zFront + dir * 2.45;
    pushBox(buckets.board.pos, buckets.board.nor, buckets.board.idx, x0 + 0.01, x0 + 0.05, yFloor + 0.85, yFloor + 2.05, Math.min(zBoard0, zBoard1), Math.max(zBoard0, zBoard1));
    pushBox(buckets.wood.pos, buckets.wood.nor, buckets.wood.idx, x - hw * 0.65, x + hw * 0.65, yFloor + 1.15, yFloor + 2.15, zBack - 0.06, zBack + 0.06);
    pushBox(buckets.board.pos, buckets.board.nor, buckets.board.idx, x - hw * 0.58, x + hw * 0.58, yFloor + 1.22, yFloor + 2.08, zBack - 0.07, zBack + 0.07);

    for (const dx of [-hw * 0.38, hw * 0.38]) {
      const lz0 = zFront + dir * 0.85, lz1 = zFront + dir * 2.15;
      pushBox(buckets.metal.pos, buckets.metal.nor, buckets.metal.idx, x + dx - 0.11, x + dx + 0.11, yCeil - 0.05, yCeil, Math.min(lz0, lz1), Math.max(lz0, lz1));
      const lb = lit ? buckets.lampLit : buckets.lampOff;
      pushBox(lb.pos, lb.nor, lb.idx, x + dx - 0.06, x + dx + 0.06, yCeil - 0.08, yCeil - 0.05, Math.min(lz0, lz1) + 0.05, Math.max(lz0, lz1) - 0.05);
    }

    for (const r of [0.95, 2.05]) {
      for (const c of [-hw * 0.42, hw * 0.42]) {
        const dx = x + c, dz = zFront + dir * r;
        pushBox(buckets.wood.pos, buckets.wood.nor, buckets.wood.idx, dx - 0.32, dx + 0.32, yFloor + 0.70, yFloor + 0.74, dz - 0.22, dz + 0.22);
        pushBox(buckets.metal.pos, buckets.metal.nor, buckets.metal.idx, dx - 0.28, dx - 0.24, yFloor, yFloor + 0.70, dz - 0.18, dz + 0.18);
        pushBox(buckets.metal.pos, buckets.metal.nor, buckets.metal.idx, dx + 0.24, dx + 0.28, yFloor, yFloor + 0.70, dz - 0.18, dz + 0.18);
        const cz = dz + dir * 0.32;
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
  const v = 0.45 + 0.45 * Math.max(0, Math.min(1, dk));
  MATS.wall.color.setRGB(0.22 * v, 0.24 * v, 0.25 * v);
  MATS.ceil.color.setRGB(0.26 * v, 0.28 * v, 0.29 * v);
}
