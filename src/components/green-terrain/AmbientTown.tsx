'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {GreenLayout} from '@/lib/troo-world/green-terrain-layout';
import {walkwaysFor,pedestrianPose,pedestrianRoutes,pedestrianRoutePose,pointOn,type Walkway,type PedestrianRoute} from '@/lib/troo-world/ambient-town';
import type {ImportedFootprints} from '@/lib/troo-world/ambient-town';
import type {ModelFootprint} from '@/lib/troo-world/model-footprint';
import {measureModelFootprint} from '@/lib/troo-world/model-footprint';
function Person({walkway,index,mode,reduced,route}:{route?:PedestrianRoute;walkway:Walkway;index:number;mode:'walk'|'talk'|'sit';reduced:boolean}){
 const root=useRef<THREE.Group>(null),left=useRef<THREE.Group>(null),right=useRef<THREE.Group>(null),arm=useRef<THREE.Group>(null);
 const clothes=['#237eb9','#a35692','#d29035','#41876a','#7859b0','#c25f4b'][index%6];
 useFrame(({clock})=>{if(!root.current||document.hidden)return;const time=reduced?0:clock.elapsedTime;
  if(mode==='walk'){const pose=route?pedestrianRoutePose(route,index,time):pedestrianPose(walkway,index,time);root.current.position.set(...pose.position);root.current.rotation.y=pose.yaw;const stride=!reduced&&pose.walking?Math.sin(time*5.5+index)*.5:0;if(left.current)left.current.rotation.x=stride;if(right.current)right.current.rotation.x=-stride;}
  if(arm.current)arm.current.rotation.z=reduced?0:(mode==='talk'?Math.sin(time*1.8+index)*.2+.3:Math.sin(time*2+index)*.07);
 });
 const standing=mode==='walk'?pedestrianPose(walkway,index,0).position:pointOn(walkway,(index%3-1)*.7,mode==='sit'?.65:(index%2?-.65:.65));
 return <group ref={root} position={standing} rotation={[0,mode==='walk'?walkway.yaw:walkway.yaw+(index%2?Math.PI/2:-Math.PI/2),0]} scale={.95}>
  <mesh position={[0,1.65,0]}><sphereGeometry args={[.2,8,8]}/><meshLambertMaterial color={index%2?'#a56b49':'#d3a27f'}/></mesh>
  <mesh position={[0,mode==='sit'?1.05:1.15,0]}><boxGeometry args={[.5,.65,.27]}/><meshLambertMaterial color={clothes}/></mesh>
  <group ref={arm} position={[.34,1.35,0]}><mesh position={[0,-.23,0]}><boxGeometry args={[.14,.5,.15]}/><meshLambertMaterial color={clothes}/></mesh></group>
  <mesh position={[-.34,1.1,0]}><boxGeometry args={[.14,.5,.15]}/><meshLambertMaterial color={clothes}/></mesh>
  {[-1,1].map((side,i)=><group key={side} ref={i?right:left} position={[side*.15,.85,0]} rotation={[mode==='sit'?-Math.PI/2:0,0,0]}><mesh position={[0,-.36,0]}><boxGeometry args={[.18,.72,.2]}/><meshLambertMaterial color="#26354b"/></mesh><mesh position={[0,-.74,.07]}><boxGeometry args={[.2,.13,.35]}/><meshLambertMaterial color="#20232c"/></mesh></group>)}
 </group>;
}
export default function AmbientTown({layout}:{layout:GreenLayout}){
 const{scene}=useThree();const[measured,setMeasured]=useState<ImportedFootprints>({}),last=useRef(''),timer=useRef(1);
 useFrame((_,delta)=>{timer.current+=delta;if(timer.current<.25)return;timer.current=0;const rows:ImportedFootprints={};
  scene.traverseVisible(root=>{if(root.userData.staticBuildingKey){const ids:number[]=[];root.traverseVisible(n=>{if((n as THREE.Mesh).isMesh)ids.push((n as THREE.Mesh).geometry.id)});const stamp=ids.join(',')+':'+root.userData.footprintScale;if(stamp!==root.userData.footprintStamp){root.userData.footprintStamp=stamp;root.userData.sidewalkFootprint=measureModelFootprint(root);}}
   const f=root.userData.sidewalkFootprint as ModelFootprint|undefined;if(!f)return;let owner:THREE.Object3D|null=root;while(owner&&!owner.userData.airportPlacementKey&&!owner.userData.staticBuildingKey)owner=owner.parent;const key=owner?.userData.airportPlacementKey??owner?.userData.staticBuildingKey;if(typeof key!=='string')return;
   root.updateWorldMatrix(true,false);const m=root.matrixWorld,center=new THREE.Vector3((f.minX+f.maxX)/2,0,(f.minZ+f.maxZ)/2).applyMatrix4(m),e=m.elements,sx=Math.hypot(e[0],e[1],e[2]),sz=Math.hypot(e[8],e[9],e[10]);(rows[key]??=[]).push({x:center.x,z:center.z,halfX:(f.maxX-f.minX)*sx/2,halfZ:(f.maxZ-f.minZ)*sz/2,yaw:Math.atan2(e[8],e[10]),padding:.4});
  });const fingerprint=JSON.stringify(rows,(_,v)=>typeof v==='number'?Math.round(v*1000)/1000:v);if(fingerprint!==last.current){last.current=fingerprint;setMeasured(rows);}
 });
 const[reduced,setReduced]=useState(false);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[]);
 const paths=useMemo(()=>walkwaysFor(layout,measured),[layout,measured]);
 const routes=useMemo(()=>pedestrianRoutes(paths),[paths]);
 if(!layout.ambient.sidewalks)return null;
 return <group name="ambient-town-sidewalks">
  {paths.map(w=><mesh key={w.id} position={w.center} rotation={[0,w.yaw,0]} receiveShadow><boxGeometry args={[w.width,.16,w.length]}/><meshLambertMaterial color="#c5c6bf"/></mesh>)}
  {layout.ambient.enabled&&paths.slice(0,10).map((w,i)=><Person key={'walk'+w.id} walkway={w} route={routes[i%routes.length]} index={i} mode="walk" reduced={reduced}/>)}
  {layout.ambient.enabled&&paths.slice(0,2).flatMap((w,i)=>Array.from({length:i?3:2},(_,j)=><Person key={'talk'+w.id+j} walkway={w} index={j+i*3} mode="talk" reduced={reduced}/>))}
  {layout.ambient.enabled&&paths.slice(2,4).map((w,i)=><group key={'seat'+w.id}>
   <Person walkway={w} index={i} mode="sit" reduced={reduced}/>
   <mesh position={(()=>{const p=pointOn(w,(i%3-1)*.7,.65);p[1]+=.5;return p})()} rotation={[0,w.yaw,0]}><boxGeometry args={[.7,.4,.55]}/><meshLambertMaterial color="#79604a"/></mesh>
  </group>)}
 </group>;
}

