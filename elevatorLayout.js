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
