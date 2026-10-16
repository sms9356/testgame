// Cabin coordinates: +z points out into the real landing; the car faces west.
export const elevatorLocal = (p,x,z) => ({x:z-p.pz,z:p.px-x});
export const elevatorWorld = (p,x,z) => ({x:p.px-z,z:p.pz+x});
export const elevatorRoute = (set,from,to) => {
 const path=[...set].sort((a,b)=>(a===4?-1:b===4?1:a-b));
 const start=path.indexOf(from),end=path.indexOf(to);
 if(start<0||end<0)return [];
 const dir=Math.sign(end-start),out=[];
 for(let i=start;i!==end;){i+=dir;out.push(path[i]);}return out;
};

// Reserve the east service strip of the stairwell on every served floor.
export const elevatorBay = cx => ({
 front:cx+2.04,doorX:cx+2.10,rear:cx+3.85,z1:-9.6,z2:-1.75,
 doorZ:-7,halfOpening:.8,clearSpawnX:cx+.8
});
// Older saves may be in the floor area now reserved for the shaft.
export function restoreOutsideElevatorBay(player,bay){
 if(!bay||player.x<bay.front-.32||player.x>bay.rear+.32||player.z<bay.z1||player.z>bay.z2)return false;
 player.x=bay.front-.47;player.z=bay.doorZ;return true;
}
