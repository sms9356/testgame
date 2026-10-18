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
  return state === 'playing' && player.floor === 0 && Math.hypot(player.x-room.cx,player.z-room.cz) < 3;
}
