'use client';
import {useEffect,useMemo} from 'react';
import {useGLTF} from '@react-three/drei';
import {useFrame} from '@react-three/fiber';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
export default function JarvonAvatar({position=[0,0,0],yaw=0,animation='Idle',firstPerson=false}:{position?:[number,number,number];yaw?:number;animation?:'Idle'|'Walk'|'Seated';firstPerson?:boolean}){
 const gltf=useGLTF('/models/avatars/jarvon-holographic-v1.glb');
 const rig=useMemo(()=>clone(gltf.scene),[gltf.scene]);const mixer=useMemo(()=>new THREE.AnimationMixer(rig),[rig]);
 useEffect(()=>{const head=rig.getObjectByName('Head');if(head)head.scale.setScalar(firstPerson?.001:1);return()=>{if(head)head.scale.setScalar(1)}},[rig,firstPerson]);
 useEffect(()=>{const clip=gltf.animations.find(c=>c.name===animation)??gltf.animations[0];if(!clip)return;const action=mixer.clipAction(clip);action.reset().fadeIn(.15).play();return()=>{action.stop()}},[animation,gltf.animations,mixer]);
 useEffect(()=>()=>{mixer.stopAllAction();mixer.uncacheRoot(rig);rig.traverse(o=>{const skin=o as THREE.SkinnedMesh;if(skin.isSkinnedMesh)skin.skeleton.dispose()})},[mixer,rig]);
 useFrame((_,delta)=>{mixer.update(Math.min(delta,.1));if(firstPerson)rig.getObjectByName('Head')?.scale.setScalar(.001)});
 return <group position={position} rotation={[0,yaw,0]} name="Jarvon_Avatar"><primitive object={rig}/></group>;
}
