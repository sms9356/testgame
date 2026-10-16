export const PHENOMENON_LABELS={attendance:'빈 교실의 출석 소리',clock:'반복되는 시계 소리',paper:'닫힌 창문과 종이 소리','empty-bell':'수업 없는 종소리',footsteps:'한 걸음 더 이어진 발소리','radio-memory':'전원 없는 방송의 잔향'};
// A single clock for incidental phenomena; story/dialogue/puzzles always have priority.
export function createPsychologicalDirector(random=Math.random){
 let elapsed=0,next=50,recent=[];
 return {
  quiet(seconds=20){next=Math.max(next,elapsed+seconds);},
  tick(dt,{playing,indoors,busy,chapter}){
   if(!playing)return null;
   elapsed+=Math.min(.25,Math.max(0,dt));
   if(busy){next=Math.max(next,elapsed+18);return null;}
   if(!indoors||chapter<1||elapsed<next)return null;
   const pool=['attendance','clock','paper','empty-bell','footsteps','radio-memory'].filter(k=>!recent.includes(k));
   const id=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
   recent=[...recent,id].slice(-3);next=elapsed+65+random()*35;return id;
  }
 };
}
