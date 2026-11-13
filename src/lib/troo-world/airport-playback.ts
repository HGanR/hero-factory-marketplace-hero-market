import * as THREE from 'three';
import {AIRPORT} from './airport';

/** Per-placement transforms and animation bindings; cached GLTF assets stay owned by the loader. */
export function createAirportPlayback(source:THREE.Object3D,clips:THREE.AnimationClip[]){
 const object=source.clone(true),mixer=new THREE.AnimationMixer(object);
 const clip=clips.find(c=>c.name==='AirportCycle_30min');
 if(!clip||Math.abs(clip.duration-AIRPORT.duration)>.01)throw new Error('The airport flight-cycle animation is missing or has changed.');
 // The runway/apron remain walkable. Airliners/passengers must not create a
 // moving whole-airport collision box in the shared town collision collector.
 object.getObjectByName('Airport_Static')?.traverse(node=>{
  if(node instanceof THREE.Mesh){
   const materials=Array.isArray(node.material)?node.material:[node.material];
   if(materials.some(m=>['terminal','roof','tower','glass_dark'].includes(m.name)))node.userData={...node.userData,townSolid:true};
  }
 });
 let action:THREE.AnimationAction|null=null,playing=true,rate=1;
 return {object,mixer,
  activate(){action=mixer.clipAction(clip);action.setLoop(THREE.LoopRepeat,Infinity);action.play();},
  update(delta:number){if(playing&&action&&Number.isFinite(delta)&&delta>=0)mixer.update(delta*rate);},
  seek(time:number){if(!Number.isFinite(time)||time<0||time>=AIRPORT.duration)return;mixer.setTime(time);},
  setPlaying(value:boolean){playing=value;},
  setRate(value:number){if([1,10,30].includes(value))rate=value;},
  get time(){return action?.time??0;},
  get playing(){return playing;},
  dispose(){mixer.stopAllAction();mixer.uncacheRoot(object);action=null;},
 };
}
