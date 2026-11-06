'use client';
import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {constrainTownCamera,type TownBox,type Point3} from '@/lib/troo-world/town-collision';

/** Only marked exterior solids participate; terrain, roads, NPCs, labels and sky do not. */
export function collectTownVolumes(scene:THREE.Object3D):TownBox[]{
 const boxes:TownBox[]=[];
 scene.updateWorldMatrix(true,true);
 scene.traverseVisible(root=>{
  if(root.userData.townSolid!==true)return;
  const box=new THREE.Box3().setFromObject(root);
  if(box.isEmpty()||![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite))return;
  boxes.push({min:box.min.toArray() as Point3,max:box.max.toArray() as Point3});
 });
 return boxes;
}
export default function TownCameraCollision({active,walking,revision,orbitRef}:{active:boolean;walking:boolean;revision:unknown;orbitRef:React.RefObject<any>}){
 const {camera,scene}=useThree();const previous=useRef<Point3|null>(null),volumes=useRef<TownBox[]>([]),elapsed=useRef(1);
 useEffect(()=>{previous.current=null;elapsed.current=1;},[active,walking,revision]);
 // Registered after the outdoor controller. Drei OrbitControls updates at priority -1.
 // Priority zero preserves R3F's automatic render loop.
 useFrame((_,delta)=>{
  if(!active){previous.current=null;return;}
  elapsed.current+=delta;if(elapsed.current>=0.25){volumes.current=collectTownVolumes(scene);elapsed.current=0;}
  const wanted=camera.position.toArray() as Point3;
  const safe=constrainTownCamera(previous.current??wanted,wanted,volumes.current,walking);
  if(safe.some((v,i)=>Math.abs(v-wanted[i])>1e-7)){
   camera.position.fromArray(safe);
   if(!walking&&orbitRef.current){orbitRef.current.update();camera.position.fromArray(safe);camera.lookAt(orbitRef.current.target);}
  }
  previous.current=safe;
 });
 return null;
}
