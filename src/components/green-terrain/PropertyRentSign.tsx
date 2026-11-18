"use client";
import { Html } from "@react-three/drei";
import { useEffect } from "react";
import { useState } from "react";
/** Lightweight procedural sign; no external GLB or asset download required. */
export default function PropertyRentSign({ onOpen, editorMode = false, selected = false, onSelect }: { onOpen?: () => void; editorMode?: boolean; selected?: boolean; onSelect?: () => void }) {
  const [night, setNight] = useState(false);
  useEffect(() => { const update = () => { const hour = new Date().getHours(); setNight(hour < 7 || hour >= 19); }; update(); const timer = setInterval(update, 60000); return () => clearInterval(timer); }, []);
  return <group name="For Rent / For Sale sign">
    {selected && <mesh name="Selected rental sign ring" rotation={[-Math.PI/2,0,0]} position={[0,0.09,0]} raycast={()=>{}}><ringGeometry args={[1.9,2.18,64]}/><meshBasicMaterial color="#ffdd44" transparent opacity={0.95} side={2} depthWrite={false}/></mesh>}
    <mesh position={[0, 1.55, 0]} castShadow>
      <boxGeometry args={[2.8, 1.3, 0.16]}/>
      <meshStandardMaterial color="#11213a" metalness={0.6} roughness={0.32}/>
    </mesh>
    <mesh position={[0, 1.55, 0.095]}>
      <planeGeometry args={[2.55, 1.06]}/>
      <meshStandardMaterial color="#16314a" emissive="#04c9ef" emissiveIntensity={night ? 0.35 : 0.08}/>
    </mesh>
    {[-1.12,1.12].map(x => <mesh key={x} position={[x, 0.83, 0]} castShadow><boxGeometry args={[0.12, 1.65, 0.14]}/><meshStandardMaterial color="#374151" metalness={0.7} roughness={0.4}/></mesh>)}
    {[-0.86,0.86].map(x => <group key={x} position={[x, 2.32, 0.42]} rotation={[-0.42, 0, 0]}>
      <mesh><cylinderGeometry args={[0.16, 0.2, 0.24, 12]}/><meshStandardMaterial color="#1f2937" metalness={0.7}/></mesh>
      {night && <spotLight color="#fff2be" intensity={2.4} distance={7} angle={0.62} penumbra={0.7} position={[0,0.08,0]} />}
    </group>)}
    <Html transform center position={[0,1.56,0.115]} distanceFactor={4.6} occlude={false} style={{pointerEvents:editorMode?"none":"auto"}}>
      <button type="button" disabled={editorMode || !onOpen} onClick={e=>{e.stopPropagation();onOpen?.();}} style={{width:240,minHeight:96,border:0,background:"transparent",color:"#fff",fontFamily:"system-ui",textAlign:"center",cursor:editorMode?"grab":"pointer",pointerEvents:editorMode?"none":"auto",textShadow:"0 0 8px #00d5ff"}}>
        <strong style={{display:"block",fontSize:23,letterSpacing:2}}>FOR RENT</strong>
        <span style={{display:"block",fontSize:13,color:"#a5f3fc"}}>FOR SALE · ASK OUR AGENT</span>
        <span style={{display:"inline-block",marginTop:4,padding:"3px 9px",borderRadius:999,background:"#00c7e8",color:"#082236",fontSize:13,fontWeight:800}}>CLICK HERE · CONTACT AGENT</span>
      </button>
    </Html>
  </group>;
}
