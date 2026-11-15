"use client";
import {Component,Suspense,useMemo,useState,type ReactNode} from 'react';
import {Html,useTexture} from '@react-three/drei';
import * as THREE from 'three';
import {INTERIOR_SLOTS,validateInterior,type InteriorItem} from '@/lib/world-assets/interior';
class ArtBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?null:this.props.children}
}
function Art({item,size}:{item:InteriorItem;size:number[]}){
 const texture=useTexture(item.image!);texture.colorSpace=THREE.SRGBColorSpace;
 return <><mesh><planeGeometry args={[size[0]+.12,size[1]+.12]}/><meshStandardMaterial color="#b29259"/></mesh>
  <mesh position={[0,0,.015]} onClick={item.href?e=>{e.stopPropagation();window.open(item.href,'_blank','noopener,noreferrer')}:undefined}><planeGeometry args={[size[0],size[1]]}/><meshBasicMaterial map={texture} side={THREE.DoubleSide}/></mesh></>;
}
function Agent({item}:{item:InteriorItem}){
 const [open,setOpen]=useState(false),[message,setMessage]=useState(''),[reply,setReply]=useState(''),[busy,setBusy]=useState(false);
 return <><mesh position={[0,.9,0]}><capsuleGeometry args={[.22,.9,4,8]}/><meshStandardMaterial color="#18c7d4" emissive="#063c49"/></mesh><Html position={[0,1.8,0]} center><button onClick={()=>setOpen(!open)}>{item.label??'AI agent'}</button>{open&&<div style={{width:240,background:'#102437',color:'white',padding:12}}><p role="status">{reply||'How can I help?'}</p><form onSubmit={async e=>{e.preventDefault();if(busy||!message.trim())return;setBusy(true);try{const r=await fetch('/api/troo-world/npc-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({npcId:item.agentId,message:message.slice(0,1000)})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Agent unavailable');setReply(data.response);setMessage('')}catch(error){setReply(error instanceof Error?error.message:'Agent unavailable')}finally{setBusy(false)}}}><input aria-label="Message agent" value={message} onChange={e=>setMessage(e.target.value)} maxLength={1000}/><button disabled={busy}>Send</button></form></div>}</Html></>;
}
export default function BuildingInteriorLayer({value}:{value:unknown}){
 const items=useMemo(()=>{try{return validateInterior(value)}catch{return []}},[value]);
 return <group>{items.map(item=>{const slot=INTERIOR_SLOTS.find(s=>s.id===item.slotId)!;return <group key={item.id} position={slot.position as [number,number,number]} rotation={[0,item.rotationY,0]}>
  {item.kind==='wall-art'?<ArtBoundary><Suspense fallback={null}><Art item={item} size={'size'in slot?slot.size:[1.6,1]}/></Suspense></ArtBoundary>:item.kind==='agent'?<Agent item={item}/>:item.kind==='lamp'?<><pointLight position={[0,1.35,0]} intensity={2} distance={5} decay={2}/><mesh position={[0,.7,0]}><cylinderGeometry args={[.035,.06,1.4,12]}/><meshStandardMaterial color="#bba979"/></mesh><mesh position={[0,1.45,0]}><coneGeometry args={[.3,.4,16]}/><meshStandardMaterial color="#ffe7ba" emissive="#f5cc78" emissiveIntensity={.5}/></mesh></>:item.kind==='desk'?<><mesh position={[0,.75,0]}><boxGeometry args={[1.6,.1,.75]}/><meshStandardMaterial color="#76543a"/></mesh>{[-.65,.65].map(x=><mesh key={x} position={[x,.35,0]}><boxGeometry args={[.08,.7,.6]}/><meshStandardMaterial color="#25323b"/></mesh>)}</>:<><mesh position={[0,.45,0]}><boxGeometry args={[.55,.12,.55]}/><meshStandardMaterial color="#176379"/></mesh><mesh position={[0,.8,-.23]}><boxGeometry args={[.55,.7,.08]}/><meshStandardMaterial color="#176379"/></mesh><mesh position={[0,.2,0]}><cylinderGeometry args={[.04,.2,.4,8]}/><meshStandardMaterial color="#333e4a"/></mesh></>}
 </group>})}</group>;
}
