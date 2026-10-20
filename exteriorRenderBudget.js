// Outdoor windows use the existing lightweight classroom impostors.
// Do not turn on a whole main-building floor merely because the player approaches it.
export function applyExteriorFloorVisibility(floors, player, mainSouthZ) {
  const insideMain = player.floor === 0 && Math.abs(player.x) < 36.3 && player.z > -9.9 && player.z < mainSouthZ - .3;
  for (const f of floors) {
    f.interior.visible = f.f === player.floor && (player.floor !== 0 || insideMain);
    if (f.winFake) f.winFake.visible = !f.interior.visible;
    if (f.f <= 2) f.shell.visible = player.floor <= 3 && !(player.floor === 2 && (player.sh || 0) > 2.4);
  }
  return insideMain;
}
export function shouldStreamGuardCctv(player, state, room) {
  // 경비실 외부(앞마당/통로)에서 불필요한 씬 이중 렌더링(renderer.render)으로 인한 프레임 드랍 원천 차단:
  // 오직 플레이어가 경비실 내부(x: 4.6~7.25, z: 64.9~67.85)에 들어와 있을 때만 CCTV 캡처를 수행한다.
  return state === 'playing' && player.floor === 0 && player.x >= 4.6 && player.x <= 7.25 && player.z >= 64.9 && player.z <= 67.85;
}