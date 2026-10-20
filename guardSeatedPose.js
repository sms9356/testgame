import * as THREE from './vendor/three.module.js';

// A static seated pose for the supplied guard rig, which has no Sit clip.
// Stop only this NPC's action; intro guard and other character mixers remain intact.
export function applyGuardSeatedPose(holder, seat) {
  const model=holder?.userData?.characterModel;
  if(!model || !seat) return {ok:false,reason:'model_not_ready'};
  const bone=name=>model.getObjectByName(name);
  const pelvis=bone('pelvis');
  if(!pelvis || !bone('thigh_l') || !bone('calf_l')) return {ok:false,reason:'rig_not_supported'};
  if (!holder.userData.origPelvisPos) holder.userData.origPelvisPos = pelvis.position.clone();
  holder.userData.npcAction?.stop();
  model.traverse(n=>{if(n.isSkinnedMesh)n.skeleton.pose();});
  holder.updateWorldMatrix(true,true);
  const p=new THREE.Vector3(seat.x,seat.y+.12,seat.z);
  pelvis.position.copy(pelvis.parent.worldToLocal(p.clone()));
  pelvis.updateWorldMatrix(true,true);
  const aim=(joint,end,direction)=>{
    if(!joint || !end)return;
    joint.updateWorldMatrix(true,true);
    const origin=joint.getWorldPosition(new THREE.Vector3());
    const from=end.getWorldPosition(new THREE.Vector3()).sub(origin).normalize();
    const q=new THREE.Quaternion().setFromUnitVectors(from,direction.clone().normalize());
    q.multiply(joint.getWorldQuaternion(new THREE.Quaternion()));
    const parentQ=joint.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
    joint.quaternion.copy(parentQ.multiply(q));joint.updateWorldMatrix(true,true);
  };
  // Slightly descending thighs, vertical shins, flat forward-facing feet.
  for(const side of ['l','r']){
    aim(bone('thigh_'+side),bone('calf_'+side),new THREE.Vector3(0,-.10,.42));
    aim(bone('calf_'+side),bone('foot_'+side),new THREE.Vector3(0,-1,0));
    aim(bone('foot_'+side),bone('ball_'+side),new THREE.Vector3(0,-.015,.16));
  }
  aim(bone('spine_01'),bone('spine_02'),new THREE.Vector3(0,1,.08));
  // Elbows near armrests, forearms directed toward the desk in front of chair.
  for(const side of ['l','r']){
    const sign=side==='l'?1:-1;
    aim(bone('upperarm_'+side),bone('lowerarm_'+side),new THREE.Vector3(sign*.03,-.23,.16));
    aim(bone('lowerarm_'+side),bone('hand_'+side),new THREE.Vector3(-sign*.03,-.03,.28));
  }
  model.updateWorldMatrix(true,true);
  holder.userData.seated=true;
  const point=name=>bone(name)?.getWorldPosition(new THREE.Vector3()).toArray();
  return {ok:true,seat:[seat.x,seat.y,seat.z],pelvis:point('pelvis'),knees:[point('calf_l'),point('calf_r')],feet:[point('foot_l'),point('foot_r')]};
}
