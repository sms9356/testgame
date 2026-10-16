// Ghosts are witnesses and story apparitions. Legacy combat state is never resumed.
export function settleStoryGhost(g) {
  Object.assign(g,{state:'story',enraged:false,hunt:null,target:null,path:[],fake:null,lockSearch:null,findT:0,lightT:0,chaseT:0,away:0});
}
export function tickStoryGhost(g,dt) {
  settleStoryGhost(g);
  g.storyTime=Math.max(0,(g.storyTime||0)-dt);
}
export function showStoryGhost(g,player,floors,seconds=8) {
  settleStoryGhost(g);g.active=true;g.floor=player.floor;
  // Use authored floor nodes, never a chase destination or the player's position.
  const nodes=(floors[player.floor]?.nodes||[]).filter(n=>Math.hypot(n.x-player.x,n.z-player.z)>=6);
  const anchor=nodes.sort((a,b)=>Math.abs(Math.hypot(a.x-player.x,a.z-player.z)-10)-Math.abs(Math.hypot(b.x-player.x,b.z-player.z)-10))[0];
  g.storyTime=anchor?seconds:0;
  if(anchor){g.x=anchor.x;g.z=anchor.z;g.yaw=Math.atan2(player.x-g.x,player.z-g.z);}
}
