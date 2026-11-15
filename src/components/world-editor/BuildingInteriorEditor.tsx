"use client";
import {useEffect,useState} from 'react';
import type {Placement} from '@/lib/world-engine/chunk-utils';
import {INTERIOR_SLOTS,validateInterior,type InteriorItem} from '@/lib/world-assets/interior';
async function wallImage(file:File){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8000000)throw new Error('Choose a PNG, JPEG or WebP image under 8 MB.');
 const bitmap=await createImageBitmap(file);try{
  const canvas=document.createElement('canvas'),ratio=Math.min(1,512/Math.max(bitmap.width,bitmap.height));
  canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const data=canvas.toDataURL('image/png');if(data.length>140000)throw new Error('Image is too detailed. Choose a smaller image (PNG under 100 KB).');return data;
 }finally{bitmap.close();}
}
export default function BuildingInteriorEditor({placement,onChange}:{placement:Placement|null;onChange:(items:InteriorItem[])=>void}){
 const [kind,setKind]=useState<InteriorItem['kind']>('desk'),[slotId,setSlotId]=useState(''),[image,setImage]=useState(''),[href,setHref]=useState(''),[agentId,setAgentId]=useState(''),[error,setError]=useState('');
 const [agents,setAgents]=useState<Array<{id:string;name:string}>>([]);
 useEffect(()=>{let active=true;fetch('/api/troo-world/npcs').then(r=>r.ok?r.json():{npcs:[]}).then(data=>{if(active)setAgents((data.npcs??[]).map((n:{id:string;npcId?:string;name:string})=>({id:n.npcId??n.id,name:n.name})));}).catch(()=>{if(active)setAgents([])});return()=>{active=false}},[]);
 const items=placement?.interior??[];
 const category={desk:'desk',chair:'seating',lamp:'lamp',agent:'display'}[kind as 'desk'|'chair'|'lamp'|'agent'];
 const available=INTERIOR_SLOTS.filter(s=>!items.some(i=>i.slotId===s.id)&&(kind==='wall-art'?s.type==='frame':s.type==='furniture'&&s.allowedCategories.includes(category)));
 return <section style={{padding:12,width:300,color:'#e0f4ff',fontFamily:'system-ui'}}>
  <h3>Interior library</h3>{!placement?<p>Select your placed storefront to furnish it.</p>:<>
  <p>Changes belong to this building. Save Draft, then Publish to show visitors.</p>
  <label>Furnishing <select value={kind} onChange={e=>{setKind(e.target.value as InteriorItem['kind']);setSlotId('')}}>{(['desk','chair','lamp','wall-art','agent'] as const).map(k=><option key={k} value={k}>{k}</option>)}</select></label>
  <label>Location <select value={slotId} onChange={e=>setSlotId(e.target.value)}><option value="">Choose a floor / slot</option>{available.map(s=><option key={s.id} value={s.id}>{s.id}</option>)}</select></label>
  {kind==='wall-art'&&<><label>Wall image <input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{setImage(await wallImage(file));setError('')}catch(err){setError(err instanceof Error?err.message:'Image failed')}}}/></label><label>Optional HTTPS link <input value={href} onChange={e=>setHref(e.target.value)} placeholder="https://…"/></label></>}
  {kind==='agent'&&<label>Public AI agent <select value={agentId} onChange={e=>setAgentId(e.target.value)}><option value="">Choose an existing agent</option>{agents.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
  <button disabled={!slotId} onClick={()=>{try{onChange(validateInterior([...items,{id:crypto.randomUUID(),kind,slotId,rotationY:0,...(kind==='wall-art'?{image,href}:{}),...(kind==='agent'?{agentId,label:agents.find(a=>a.id===agentId)?.name}:{})}]));setSlotId('');setError('')}catch(err){setError(err instanceof Error?err.message:'Unable to add')}}}>Add to building</button>
  {items.map(item=><div key={item.id} style={{padding:'8px 0',borderBottom:'1px solid #456'}}><strong>{item.label??item.kind}</strong><br/>{item.slotId}
   <label>Rotation <input aria-label={`Rotation ${item.slotId}`} type="range" min={-Math.PI*2} max={Math.PI*2} step={Math.PI/12} value={item.rotationY} onChange={e=>onChange(items.map(i=>i.id===item.id?{...i,rotationY:Number(e.target.value)}:i))}/></label>
   <button onClick={()=>onChange(items.filter(i=>i.id!==item.id))}>Remove</button></div>)}
  </>}{error&&<p role="alert">{error}</p>}
 </section>;
}
