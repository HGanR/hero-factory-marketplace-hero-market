
'use client';
import {useRef,type MutableRefObject} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import ProfilePortrait from './ProfilePortrait';
import type {PeerAvatar} from './useTownPresence';
import type {PresencePose,PresenceIdentity} from '@/lib/troo-world/presence-model';
/** The mobile profile image is the default representation until mesh avatars are ready. */
export default function TownPresenceLayer({active,pose,peers,fixed,zone,onSelectPeer}:{active:boolean;avatar?:'jarvon'|'member';pose:MutableRefObject<PresencePose>;peers:PeerAvatar[];fixed?:PresenceIdentity;zone:string;onSelectPeer?:(id:string)=>void}){
 const previous=useRef(new THREE.Vector3());
 useFrame(({camera})=>{if(!active)return;const euler=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');pose.current=fixed?.pose??{position:[camera.position.x,camera.position.y-1.7,camera.position.z],yaw:euler.y+Math.PI,mode:camera.position.distanceTo(previous.current)>.002?'walking':'standing',zone};previous.current.copy(camera.position);});
 if(!active)return null;
 return <group name="Town_Multiplayer_Profile_Images">{peers.filter(p=>p.pose.zone===zone).map(p=><ProfilePortrait key={p.identity} identity={p.identity} position={p.pose.position} url={p.portraitUrl} host={p.role==='host'} speaking={p.speaking} onSelect={onSelectPeer?()=>onSelectPeer(p.identity):undefined}/>)}</group>;
}
