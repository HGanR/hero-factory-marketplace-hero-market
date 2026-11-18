"use client";
import { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Matches the existing walkable world's 240 x 240 terrain footprint. */
export const OASIS_WIDTH = 240;
export const OASIS_HEIGHT = 85;
export type WorldTier = "metropolis" | "oasis";

export function OasisPlatform() {
  const edge = OASIS_WIDTH / 2;
  const falls = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return { x: Math.cos(a) * (edge - 3), z: Math.sin(a) * (edge - 3), a };
  });
  return <group name="Preview Oasis upper tier">
    <mesh position={[0, OASIS_HEIGHT - 3, 0]} receiveShadow castShadow>
      <cylinderGeometry args={[edge, edge - 6, 6, 96]}/>
      <meshStandardMaterial color="#253b43" metalness={0.5} roughness={0.65}/>
    </mesh>
    <mesh position={[0, OASIS_HEIGHT + 0.1, 0]} receiveShadow>
      <cylinderGeometry args={[edge - 1, edge - 1, 0.25, 96]}/>
      <meshStandardMaterial color="#438a62" roughness={0.9}/>
    </mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,OASIS_HEIGHT-1,0]}>
      <torusGeometry args={[edge - 1,1.6,12,128]}/>
      <meshStandardMaterial color="#13e6ff" emissive="#00bce8" emissiveIntensity={2.2} toneMapped={false}/>
    </mesh>
    {falls.map((f,i)=><group key={i} position={[f.x,OASIS_HEIGHT-17,f.z]}>
      <mesh><cylinderGeometry args={[2.1,3.3,30,8,1,true]}/><meshStandardMaterial color="#27b9e8" transparent opacity={0.5} emissive="#007fa5" emissiveIntensity={0.7} side={THREE.DoubleSide}/></mesh>
      <pointLight color="#19d7ff" intensity={1.2} distance={20}/>
    </group>)}
    {[0,1,2,3,4,5,6,7].map(i=>{const a=i*Math.PI/4;return <group key={i} position={[Math.cos(a)*94,OASIS_HEIGHT-7,Math.sin(a)*94]}>
      <mesh><cylinderGeometry args={[3.5,4.5,4,12]}/><meshStandardMaterial color="#536675" metalness={0.8}/></mesh>
      <mesh position={[0,-5,0]}><coneGeometry args={[2.8,10,12]}/><meshBasicMaterial color="#2acbff" transparent opacity={0.6}/></mesh>
      <pointLight color="#1abaff" intensity={2} distance={24} position={[0,-6,0]}/>
    </group>})}
    <mesh position={[0,OASIS_HEIGHT/2,0]}>
      <cylinderGeometry args={[4.5,4.5,OASIS_HEIGHT,32,1,true]}/>
      <meshBasicMaterial color="#00d7ff" transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide}/>
    </mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,OASIS_HEIGHT,0]}>
      <torusGeometry args={[7,0.8,12,64]}/>
      <meshBasicMaterial color="#8af8ff"/>
    </mesh>
  </group>;
}

/** Camera floor and ceiling limits are enforced on every render frame, including panning. */
export function TierCameraGuard({ tier, orbitEnabled }: { tier: WorldTier; orbitEnabled: boolean }) {
  const { camera, controls } = useThree();
  const previous = useRef<WorldTier>(tier);
  useEffect(() => {
    if (!orbitEnabled || previous.current === tier) return;
    previous.current = tier;
    const y = tier === "oasis" ? OASIS_HEIGHT + 16 : 18;
    camera.position.set(35, y + 20, 60);
    const orbit = controls as unknown as {target?: THREE.Vector3; update?:()=>void} | null;
    orbit?.target?.set(0,y,0);orbit?.update?.();
  }, [tier,orbitEnabled,camera,controls]);
  useFrame(() => {
    if (!orbitEnabled) return;
    const lower = tier === "oasis" ? OASIS_HEIGHT + 2 : 2;
    const upper = tier === "metropolis" ? OASIS_HEIGHT - 3 : OASIS_HEIGHT + 180;
    camera.position.y = THREE.MathUtils.clamp(camera.position.y,lower,upper);
    const orbit = controls as unknown as {target?: THREE.Vector3} | null;
    if (orbit?.target) orbit.target.y = THREE.MathUtils.clamp(orbit.target.y,lower,upper);
  });
  return null;
}
