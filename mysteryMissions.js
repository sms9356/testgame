// Read existing save flags only: mission categories never create a second quest state.
export function buildMissionGroups({flags={},documents=[],quests=[],objective}) {
  const count=value=>new Set(Array.isArray(value)?value.filter(v=>typeof v==='string'):[]).size;
  const has=id=>documents.some(d=>d.id===id);
  const stage=q=>Math.min(q.steps.length,Math.max(0,Math.floor(Number(flags.sq?.[q.id])||0)));
  return [
    {id:'main',title:flags.mina?'메인 미션 · 함께 돌아가는 길':'메인 미션 · 실종된 선배',purpose:'민아 선배의 흔적을 추적하고, 방송실의 기억을 풀어 함께 돌아간다.',items:[{id:'current',title:objective.main,done:false,where:objective.loc?.where},...objective.subs.map(([title,done],i)=>({id:`step-${i}`,title,done:!!done}))]},
    {id:'side',title:'서브 미션 · 남겨진 부탁',purpose:'학교의 일상과 증언을 복원한다. 진행 중인 메인 미션과 별개로 조사할 수 있다.',items:quests.map(q=>{const n=stage(q);return {id:q.id,title:q.title,done:n===q.steps.length,where:n===q.steps.length?'조사 완료':q.steps[n].goal,progress:`${n}/${q.steps.length}`};})},
    {id:'special',title:'특별 미션 · 그날의 진실',purpose:'발견한 기록을 대조해 과거 사건의 모순과 빠진 이름을 확인한다. 선배 수색과 별도의 진상 조사다.',items:[
      {id:'contradiction',title:'방송부원과 경비의 진술 대조',done:has('n23')&&has('n24')},
      {id:'witnesses',title:'사건 증언 테이프 6개 복원',done:count(flags.mega?.tapes)>=6,progress:`${Math.min(6,count(flags.mega?.tapes))}/6`},
      {id:'names',title:'잊힌 이름의 명찰 12개 확인',done:count(flags.mega?.tags)>=12,progress:`${Math.min(12,count(flags.mega?.tags))}/12`}
    ]}
  ];
}
export function recordCompleted(log,section,text,chapter){
  if(!text||log.some(x=>x.s===section&&x.t===text))return;
  log.push({s:section,t:text,ch:chapter});if(log.length>80)log.shift();
}

export function normalizeCompletedLog(value){
 return Array.isArray(value)?value.filter(x=>x&&typeof x.s==='string'&&typeof x.t==='string').slice(-80):[];
}
