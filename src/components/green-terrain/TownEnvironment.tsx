'use client';
import {useEffect,useMemo,useState} from 'react';
import * as THREE from 'three';
import {townDaylight} from '@/lib/troo-world/day-night';
/** Shared by public towns and their editors. No new network requests or persisted layout changes. */
export default function TownEnvironment({interior=false,at}:{interior?:boolean;at?:Date}){
 const[time,setTime]=useState(()=>Date.now());
 useEffect(()=>{if(at)return;const refresh=()=>setTime(Date.now());const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh)}},[at]);
 const phase=townDaylight(at??new Date(time)),d=phase.daylight;
 const horizon=new THREE.Color('#10253c').lerp(new THREE.Color('#8ecae6'),d).lerp(new THREE.Color('#c48a74'),phase.twilight*.4);
 const zenith=new THREE.Color('#030818').lerp(new THREE.Color('#1a5fa8'),d);
 const sky=useMemo(()=>({uniforms:{horizon:{value:horizon},zenith:{value:zenith}},vertexShader:'varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 horizon;uniform vec3 zenith;varying vec3 vDirection;void main(){float h=clamp(normalize(vDirection).y,0.0,1.0);gl_FragColor=vec4(mix(horizon,zenith,h),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',side:THREE.BackSide,depthWrite:false}),[]);
 sky.uniforms.horizon.value.copy(horizon);sky.uniforms.zenith.value.copy(zenith);
 const stars=useMemo(()=>{const a=[];for(let i=0;i<350;i++){const yaw=i*2.399963,up=.08+((i*73)%350)/390,r=Math.sqrt(1-up*up);a.push(Math.cos(yaw)*r*350,up*350,Math.sin(yaw)*r*350)}return new Float32Array(a)},[]);
 return <group name="Town day and night" userData={{daylight:d,clockHour:phase.hour}}>
  <ambientLight intensity={interior?.24:.32+d*.28} color={d>.5?'#d4e8c0':'#9dbbe6'}/>
  <directionalLight position={d>.05?phase.sun:[-60,90,40]} intensity={interior?.25:.24+d*1.56} color={d>.5?'#fff4d0':'#aec8ff'} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-near={.5} shadow-camera-far={400} shadow-camera-left={-120} shadow-camera-right={120} shadow-camera-top={120} shadow-camera-bottom={-120} shadow-bias={-.0001}/>
  <hemisphereLight intensity={interior?.18:.25+d*.25} color={horizon} groundColor="#28342b"/>
  <fog attach="fog" args={[horizon,100,300]}/>
  <mesh name="Town sky" renderOrder={-100} raycast={()=>{}}><sphereGeometry args={[390,32,16]}/><shaderMaterial args={[sky]}/></mesh>
  <points name="Night stars" raycast={()=>{}}><bufferGeometry><bufferAttribute attach="attributes-position" args={[stars,3]}/></bufferGeometry><pointsMaterial color="#d4e9ff" size={.8} transparent opacity={(1-d)*.8} depthWrite={false} sizeAttenuation fog={false}/></points>
  <mesh name={d>.05?'Sun':'Moon'} position={d>.05?phase.sun:[-60,110,40]} raycast={()=>{}}><sphereGeometry args={[d>.05?5:3,16,12]}/><meshBasicMaterial color={d>.05?'#ffe5ab':'#dbeaff'} fog={false}/></mesh>
 </group>;
}
