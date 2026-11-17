'use client';
import {useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {signalState,trafficTime,type TrafficAxis} from '@/lib/troo-world/traffic-signals';
const colors={red:'#ff3030',yellow:'#ffbd24',green:'#24f888'};
function SignalHead({axis,rotation=0}:{axis:TrafficAxis;rotation?:number}){
 const root=useRef<THREE.Group>(null);
 useFrame(()=>{if(!root.current)return;const state=signalState(trafficTime()),active=axis==='north-south'?state.northSouth:state.eastWest;root.current.userData.signal=active;root.current.children.forEach(n=>{if(n.userData.lamp){const m=(n as THREE.Mesh).material as THREE.MeshBasicMaterial;m.color.set(n.userData.lamp===active?colors[active]:'#18232b')}});});
 return <group ref={root} name={'Traffic signal '+axis} position={[Math.sin(rotation)*.4,3.25,Math.cos(rotation)*.4]} rotation={[0,rotation,0]}>
  <mesh position={[0,0,0]}><boxGeometry args={[.48,1.35,.28]}/><meshStandardMaterial color="#d2a52a" roughness={.7}/></mesh>
  {(['red','yellow','green'] as const).map((color,i)=><mesh key={color} userData={{lamp:color}} position={[0,.4-i*.4,.17]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.145,.145,.05,16]}/><meshBasicMaterial color="#18232b" toneMapped={false}/></mesh>)}
 </group>;
}
function PedestrianSignal({rotation=0}:{rotation?:number}){
 const icon=useRef<THREE.Group>(null);
 useFrame(()=>{if(!icon.current)return;const walk=signalState(trafficTime()).walk;icon.current.userData.walk=walk;icon.current.traverse(n=>{if((n as THREE.Mesh).isMesh)((n as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(walk?'#26f394':'#ff4141');});});
 return <group rotation={[0,rotation,0]} position={[.45,2.05,0]}>
  <mesh><boxGeometry args={[.5,.65,.16]}/><meshStandardMaterial color="#14222b"/></mesh>
  <group ref={icon} name="Pedestrian walk signal" position={[0,0,.1]}>
   <mesh position={[0,.17,0]}><circleGeometry args={[.065,12]}/><meshBasicMaterial toneMapped={false}/></mesh>
   <mesh position={[0,0,0]}><planeGeometry args={[.055,.2]}/><meshBasicMaterial toneMapped={false}/></mesh>
   {[-1,1].map(side=><group key={side}><mesh position={[side*.055,-.15,0]} rotation={[0,0,side*.4]}><planeGeometry args={[.045,.16]}/><meshBasicMaterial toneMapped={false}/></mesh><mesh position={[side*.07,.02,0]} rotation={[0,0,side*.7]}><planeGeometry args={[.04,.15]}/><meshBasicMaterial toneMapped={false}/></mesh></group>)}
  </group>
 </group>;
}
/** Physical signals and zebra markings at the shared central street junction. */
export default function TownIntersection(){return <group name="Town controlled intersection">
 {[-1,1].flatMap(x=>[-1,1].map(z=><group key={x+':'+z} position={[x*8.4,.35,z*8.4]}>
  <mesh position={[0,1.9,0]}><cylinderGeometry args={[.065,.1,3.8,8]}/><meshStandardMaterial color="#24313a"/></mesh>
  <SignalHead axis="north-south" rotation={z<0?Math.PI:0}/><SignalHead axis="east-west" rotation={x<0?-Math.PI/2:Math.PI/2}/><PedestrianSignal rotation={z<0?Math.PI:0}/>
 </group>))}
 {[-1,1].flatMap(side=>Array.from({length:8},(_,i)=>{const along=-4.55+i*1.3;return <group key={side+':'+i}>
  <mesh name="North south road crosswalk" position={[along,.365,side*6.6]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.7,2]}/><meshBasicMaterial color="#f0f1e6"/></mesh>
  <mesh name="East west road crosswalk" position={[side*6.6,.365,along]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[2,.7]}/><meshBasicMaterial color="#f0f1e6"/></mesh>
 </group>}))}
 {[-1,1].map(side=><group key={side}>
  <mesh position={[side*2.5,.366,side*9]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[4.6,.2]}/><meshBasicMaterial color="#f0f1e6"/></mesh>
  <mesh position={[side*9,.366,-side*2.5]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[.2,4.6]}/><meshBasicMaterial color="#f0f1e6"/></mesh>
 </group>)}
 </group>}
