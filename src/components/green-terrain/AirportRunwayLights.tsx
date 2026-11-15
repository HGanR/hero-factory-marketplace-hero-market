'use client';
import {useMemo,useRef,useLayoutEffect} from 'react';
import * as THREE from 'three';
import {partPoint,type AirportParts} from '@/lib/troo-world/airport-parts';
import {airportRunwayLightPositions} from '@/lib/troo-world/airport-playback';
export default function RunwayLights({source,parts,parentScale=.1}:{source:THREE.Object3D;parts?:AirportParts;parentScale?:number}){
 const positions=useMemo(()=>airportRunwayLightPositions(source).map(p=>{if(!parts)return p;const out=partPoint(p,'runway',parts);out[1]=parts.runway.offset[1]+(p[1]-.9)*parts.runway.scale*(parts.runway.stretch?.[1]??1)+.08/parentScale;return out}),[source,parts,parentScale]),lamps=useRef<THREE.InstancedMesh>(null),glow=useRef<THREE.InstancedMesh>(null);
 useLayoutEffect(()=>{const matrix=new THREE.Matrix4();positions.forEach((p,i)=>{matrix.makeTranslation(...p);lamps.current?.setMatrixAt(i,matrix);glow.current?.setMatrixAt(i,matrix)});if(lamps.current)lamps.current.instanceMatrix.needsUpdate=true;if(glow.current)glow.current.instanceMatrix.needsUpdate=true},[positions]);
 return <group name="Airport blue runway lights"><instancedMesh ref={lamps} args={[undefined,undefined,positions.length]} raycast={()=>{}}><sphereGeometry args={[parts?.08/parentScale:.65,8,6]}/><meshBasicMaterial color="#2386ff" toneMapped={false}/></instancedMesh><instancedMesh ref={glow} args={[undefined,undefined,positions.length]} raycast={()=>{}}><sphereGeometry args={[parts?.22/parentScale:1.7,8,6]}/><meshBasicMaterial color="#227dff" transparent opacity={.15} depthWrite={false} toneMapped={false}/></instancedMesh></group>;
}

