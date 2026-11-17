'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useFrame} from '@react-three/fiber';
import {useGLTF} from '@react-three/drei';
import * as THREE from 'three';
import {transitPose,BUS_SIZE,transitCorridor} from '@/lib/troo-world/transit-route';
import {transitSettings} from '@/lib/troo-world/transit-settings';
import {onRoad,roadsFor} from '@/lib/troo-world/ambient-town';
import type {GreenLayout} from '@/lib/troo-world/green-terrain-layout';
export default function TransitBusModel({placement,roads=[],editorMode,selected}:{placement:GreenLayout['imports'][number];roads?:GreenLayout['objects'];editorMode:boolean;selected:boolean}){
 const{scene,animations}=useGLTF(placement.glbUrl),motion=useRef<THREE.Group>(null),[reduced,setReduced]=useState(false),settings=transitSettings(placement);
 const model=useMemo(()=>{const object=scene.clone(true),materials:THREE.Material[]=[],bySource=new Map<THREE.Material,THREE.Material>(),signs:THREE.MeshStandardMaterial[]=[],textures=new Map<string,THREE.CanvasTexture>();
  object.userData.townSolid=true;
  object.traverse(n=>{const mesh=n as THREE.Mesh;if(!mesh.isMesh)return;const clone=(source:THREE.Material)=>{let m=bySource.get(source);if(!m){m=source.clone();bySource.set(source,m);materials.push(m);if(/^LED_(north|south)/.test(m.name))signs.push(m as THREE.MeshStandardMaterial);}return m;};mesh.material=Array.isArray(mesh.material)?mesh.material.map(clone):clone(mesh.material);});
  for(const label of ['TROO NORTH','TROO SOUTH','TROO EAST','TROO WEST']){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const c=canvas.getContext('2d')!;c.fillStyle='#03151c';c.fillRect(0,0,1024,128);c.font='bold 82px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#74f5ff';c.fillText(label,512,66,980);const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;textures.set(label,t);}
  const north=object.getObjectByName('Destination_TROO_NORTH'),south=object.getObjectByName('Destination_TROO_SOUTH');if(north)north.visible=true;if(south)south.visible=false;
  const mixer=new THREE.AnimationMixer(object),clip=animations.find(a=>a.name==='InPlace_Wheels_Signs'),wheelTracks=clip?.tracks.filter(t=>/^Wheel_/.test(t.name))??[];
  if(clip&&wheelTracks.length)mixer.clipAction(new THREE.AnimationClip('Transit wheels',clip.duration,wheelTracks)).play();
  let destination='';return{object,mixer,setDestination:(value:string)=>{if(value===destination)return;destination=value;for(const m of signs){m.map=textures.get(value)!;m.emissiveMap=m.map;m.color.set('white');m.emissive.set('white');m.emissiveIntensity=1.3;m.needsUpdate=true;}},dispose:()=>{mixer.stopAllAction();mixer.uncacheRoot(object);materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
 },[scene,animations]);
 const generations=useRef(new WeakMap<object,number>());
 useEffect(()=>{const n=(generations.current.get(model)??0)+1;generations.current.set(model,n);return()=>queueMicrotask(()=>{if(generations.current.get(model)===n)model.dispose();});},[model]);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
 const phase=useMemo(()=>Array.from(placement.elementKey).reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0)%1000,[placement.elementKey]);
 const local=useMemo(()=>new THREE.Vector3(),[]),road=useMemo(()=>transitCorridor(placement,{objects:roads}),[placement,roads]),parkOnRoad=useMemo(()=>onRoad(placement.position,roadsFor({objects:roads}),0),[placement,roads]);
 useFrame((_,delta)=>{const root=motion.current;if(!root)return;const pose=transitPose(placement,{objects:roads},Date.now()/1000+phase,road),moving=!editorMode&&!reduced&&settings.enabled&&!!pose;
  if(moving&&pose){const dx=pose.position[0]-placement.position[0],dz=pose.position[2]-placement.position[2],c=Math.cos(placement.rotationY),s=Math.sin(placement.rotationY);local.set((dx*c-dz*s)/placement.scale,(pose.position[1]-placement.position[1])/placement.scale,(dx*s+dz*c)/placement.scale);root.position.copy(local);root.rotation.y=pose.yaw-placement.rotationY;root.visible=pose.visible;root.userData.destination=pose.destination;model.setDestination(pose.destination);model.mixer.update(delta*settings.speed/(8*placement.scale));}
  else{root.visible=true;root.position.set(0,0,0);root.rotation.y=0;if(road&&parkOnRoad)root.position.y=(road.height+.01)/placement.scale;model.setDestination(transitPose(placement,{objects:roads},0,road)?.destination??'TROO NORTH');}
  root.userData.moving=moving;
 });
 return <group ref={motion} name={'Transit motion '+placement.elementKey}><primitive object={model.object}/>{selected&&<mesh name="Imported building selection ring" position={[0,.09,0]} rotation={[-Math.PI/2,0,0]} raycast={()=>{}}><ringGeometry args={[Math.hypot(BUS_SIZE.width,BUS_SIZE.length)/2+.4,Math.hypot(BUS_SIZE.width,BUS_SIZE.length)/2+.62,64]}/><meshBasicMaterial color="#ffdd44" transparent opacity={.85} side={THREE.DoubleSide} depthWrite={false}/></mesh>}</group>;
}
