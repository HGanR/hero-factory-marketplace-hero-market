'use client';
import {Suspense,useMemo,useRef,useState,type MutableRefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import JarvonAvatar from './JarvonAvatar';
import {initialPose,type PeerAvatar} from './useTownPresence';
import type {PresencePose,PresenceIdentity} from '@/lib/troo-world/presence-model';
/** Generic members use instanced shapes; only the owner loads the Jarvon model. */
function Members({members}:{members:PeerAvatar[]}){
 const ref=useRef<THREE.InstancedMesh>(null),dummy=useMemo(()=>new THREE.Object3D(),[]),matrix=useMemo(()=>new THREE.Matrix4(),[]);
 useFrame(()=>{const mesh=ref.current;if(!mesh)return;let i=0;for(const m of members){const p=m.pose,seated=p.mode==='seated';const parts=[{x:0,y:seated?.98:1.15,z:0,s:[.42,.60,.25]},{x:0,y:seated?1.39:1.63,z:0,s:[.25,.28,.25]},{x:-.14,y:seated?.33:.45,z:seated?.18:0,s:[.14,seated?.45:.8,.18]},{x:.14,y:seated?.33:.45,z:seated?.18:0,s:[.14,seated?.45:.8,.18]},{x:-.29,y:seated?.95:1.1,z:0,s:[.12,.5,.14]},{x:.29,y:seated?.95:1.1,z:0,s:[.12,.5,.14]}];
  dummy.position.fromArray(p.position);dummy.rotation.set(0,p.yaw,0);dummy.scale.set(1,1,1);dummy.updateMatrix();const root=dummy.matrix.clone();for(const part of parts){matrix.compose(new THREE.Vector3(part.x,part.y,part.z),new THREE.Quaternion(),new THREE.Vector3(...part.s));mesh.setMatrixAt(i,root.clone().multiply(matrix));mesh.setColorAt(i,new THREE.Color(i%6===1?'#aa795e':i%6<2?'#238eab':'#24334b'));i++;}}
  mesh.count=i;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
 });
 return <instancedMesh ref={ref} args={[undefined,undefined,Math.max(1,members.length*6)]} frustumCulled={false} name="Seated_And_Nearby_Members"><boxGeometry args={[1,1,1]}/><meshStandardMaterial roughness={.8}/></instancedMesh>;
}
export default function TownPresenceLayer({active,avatar,pose,peers,fixed,zone}:{active:boolean;avatar?:'jarvon'|'member';pose:MutableRefObject<PresencePose>;peers:PeerAvatar[];fixed?:PresenceIdentity;zone:string}){
 const previous=useRef(new THREE.Vector3()),elapsed=useRef(0);const[local,setLocal]=useState(initialPose());
 useFrame(({camera},dt)=>{if(!active)return;const euler=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');const now:PresencePose=fixed?.pose??{position:[camera.position.x,camera.position.y-1.7,camera.position.z],yaw:euler.y+Math.PI,mode:camera.position.distanceTo(previous.current)>.002?'walking':'standing',zone};pose.current=now;previous.current.copy(camera.position);elapsed.current+=dt;if(elapsed.current>.12){elapsed.current=0;setLocal({...now,position:[...now.position]})}});
 const members=peers.filter(p=>p.avatar!=='jarvon'&&p.pose.zone===zone);
 if(!active)return null;
 return <group name="Town_Multiplayer_Avatars"><Members members={members}/><Suspense fallback={null}>{avatar==='jarvon'&&<JarvonAvatar position={local.position} yaw={local.yaw} firstPerson animation={local.mode==='walking'?'Walk':local.mode==='seated'?'Seated':'Idle'}/>} {peers.filter(p=>p.avatar==='jarvon'&&p.pose.zone===zone).map(p=><JarvonAvatar key={p.identity} position={p.pose.position} yaw={p.pose.yaw} animation={p.pose.mode==='walking'?'Walk':p.pose.mode==='seated'?'Seated':'Idle'}/>)}</Suspense></group>;
}
