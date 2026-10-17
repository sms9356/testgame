import * as THREE from './vendor/three.module.js';
import { localBounds } from './guardRoomV6.js';

// The supplied placement bakes XY into all meshes, but _hi_ details omit
// the manifest's support/wall Z offset. Repair the game clone, never the GLB.
export function arrangeGuardRoomV6(root) {
  const report={correctedDetails:0,excluded:[],moved:[]};
  const heights={F04:1.65,F09:.75,F10:.75,F11:.75,F12:.75,F13:1.3,F14:1.82,F15:1.4,F19:.75,F20:.75,F21:.75,F22:.75,F23:1.38,F24:1.96,F25:2.4,F26:1.05,F28:2.09,F30:.75,F31:.75,F33:1.5,F34:.95,F35:.83,F36:1.86,F37:1.6};
  for(const [id,z] of Object.entries(heights)) {
    const group=root.getObjectByName(id+'_GROUP'); if(!group) continue;
    group.traverse(n=>{if(n.isMesh && /_hi_/.test(n.name)){n.position.z+=z;report.correctedDetails++;}});
  }
  // Outdoor equipment is already represented by the campus gate. The shell
  // supplies glazing. Reduce optional tabletop clutter around the log/cap.
  for(const id of ['F19','F22','F26','F27','F31','F32']) {
    const group=root.getObjectByName(id+'_GROUP'); if(group){group.removeFromParent();report.excluded.push(id);}
  }
  const shift=(id,x=0,y=0,z=0)=>{const g=root.getObjectByName(id+'_GROUP');if(g){g.position.add(new THREE.Vector3(x,y,z));report.moved.push(id);}};
  const wall=(id,angle,x,y)=>{
    const g=root.getObjectByName(id+'_GROUP');if(!g)return;
    root.updateMatrixWorld(true);const c=localBounds(root,g).getCenter(new THREE.Vector3());
    g.rotation.z=angle;g.position.x=x-Math.cos(angle)*c.x+Math.sin(angle)*c.y;
    g.position.y=y-Math.sin(angle)*c.x-Math.cos(angle)*c.y;report.moved.push(id);
  };
  shift('F02',0,0,-.027); // caster bottoms meet the floor
  shift('F16',0,0,-.0093669258);
  shift('F18',0,0,-.045);
  shift('F29',0,0,-.014);
  shift('F09',0,0,.01); // small appliances meet the actual 0.76m worktop
  shift('F11',0,0,.007);
  shift('F12',0,0,.008);
  shift('F21',0,0,.0075);
  shift('F20',0,0,-.01); // kettle meets refrigerator top
  shift('F10',0,0,-.085); // weighted monitor feet now sit on the 0.76m worktop
  shift('F30',-1.19,-1.62,.00825); // coffee machine: clear desk corner, not inside kettle/fridge
  shift('F13',0,-.95,0); // key rack: solid west wall, not west glazing
  shift('F14',1.1,0,.25); // clock: solid north wall above the shelf
  shift('F24',-.18,0,0); // fan: solid north-west wall, clear of the window
  shift('F36',0,0,-.019); // binder bases meet the shelf top
  wall('F23',Math.PI,.77,.14); // notices on solid south wall, clear of door and glass
  wall('F33',Math.PI,1.4,.14); // clipboard beside notices, before the door jamb
  wall('F34',-Math.PI/2,3.39,.87); // raincoat on east wall above bed, not inside shelf
  root.updateMatrixWorld(true);
  return report;
}
