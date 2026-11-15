"use client";
import {useEffect,useState} from 'react';
import type {Placement} from '@/lib/world-engine/chunk-utils';
import {INTERIOR_SLOTS,validateInterior,type InteriorItem} from '@/lib/world-assets/interior';
async function wallImage(file:File){
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8000000)throw new Error('Choose a PNG, JPEG or WebP image under 8 MB.');
 const bitmap=await createImageBitmap(file);try{
  const canvas=document.createElement('canvas');let edge=512;
  while(edge>=96){
   const ratio=Math.min(1,edge/Math.max(bitmap.width,bitmap.height));
   canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
   canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);
   const data=canvas.toDataURL('image/png');if(data.length<=140000)return data;
   edge=Math.floor(edge*.75);
  }
  throw new Error('This image could not be prepared. Choose a smaller image.');
 }finally{bitmap.close();}
}
const kindLabels={desk:'Desk',chair:'Chair',lamp:'Lamp','wall-art':'Wall image',agent:'AI agent'};
function slotLabel(id:string){const slot=INTERIOR_SLOTS.find(s=>s.id===id);return slot?`Floor ${slot.floor} · ${slot.type==='frame'?'Wall frame':'Position'} ${Number(id.split('_').pop())}`:'Location';}
export default function BuildingInteriorEditor({placement,onChange,freePlacement=false,saveHint}:{placement:Placement|null;onChange:(items:InteriorItem[])=>void;freePlacement?:boolean;saveHint?:string}){
 const [kind,setKind]=useState<InteriorItem['kind']>('desk'),[slotId,setSlotId]=useState(''),[image,setImage]=useState(''),[href,setHref]=useState(''),[agentId,setAgentId]=useState(''),[error,setError]=useState('');
 const [position,setPosition]=useState<[number,number,number]>([0,.3,0]);
 const [agents,setAgents]=useState<Array<{id:string;name:string}>>([]);
 useEffect(()=>{let active=true;fetch('/api/troo-world/npcs').then(r=>r.ok?r.json():{npcs:[]}).then(data=>{if(active)setAgents((data.npcs??[]).map((n:{id:string;npcId?:string;name:string})=>({id:n.npcId??n.id,name:n.name})));}).catch(()=>{if(active)setAgents([])});return()=>{active=false}},[]);
 const items=placement?.interior??[];
 const category={desk:'desk',chair:'seating',lamp:'lamp',agent:'display'}[kind as 'desk'|'chair'|'lamp'|'agent'];
 const available=INTERIOR_SLOTS.filter(s=>!items.some(i=>i.slotId===s.id)&&(kind==='wall-art'?s.type==='frame':s.type==='furniture'&&s.allowedCategories.includes(category)));
 return <section className="building-interior-editor" style={{boxSizing:'border-box',padding:12,width:'100%',maxWidth:280,color:'#e0f4ff',fontFamily:'system-ui'}}>
  <style>{`.building-interior-editor label{display:grid;gap:6px;margin:12px 0;font-size:13px}.building-interior-editor select,.building-interior-editor input:not([type=range]){box-sizing:border-box;width:100%;min-width:0;padding:9px;border:1px solid #466a80;border-radius:7px;background:#16364a;color:#effaff}.building-interior-editor button{padding:8px 12px;border:1px solid #4ea6bf;border-radius:7px;background:#194b61;color:#effaff;cursor:pointer}.building-interior-editor button:disabled{opacity:.45;cursor:default}.building-interior-editor p{font-size:13px;line-height:1.5}`}</style>
  <h3>Interior library</h3>{!placement?<p>{freePlacement?'Select a building in the scene to furnish it.':'Select your placed storefront to furnish it.'}</p>:<>
  <p>{saveHint??'Changes belong to this building. Save Draft, then Publish to show visitors.'}</p>
  <label>Furnishing <select aria-label="Furnishing" value={kind} onChange={e=>{setKind(e.target.value as InteriorItem['kind']);setSlotId('')}}>{(['desk','chair','lamp','wall-art','agent'] as const).map(k=><option key={k} value={k}>{kindLabels[k]}</option>)}</select></label>
  {freePlacement?<fieldset><legend>Position inside building · metres</legend>{(['X','Y','Z'] as const).map((axis,i)=><label key={axis}>{axis}<input aria-label={`New furnishing ${axis}`} type="number" min={-150} max={150} step={.25} value={position[i]} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&Math.abs(n)<=150)setPosition(p=>p.map((v,j)=>j===i?n:v) as [number,number,number])}}/></label>)}</fieldset>:<label>Location <select aria-label="Location" value={slotId} onChange={e=>setSlotId(e.target.value)}><option value="">Choose a floor / slot</option>{available.map(s=><option key={s.id} value={s.id}>{slotLabel(s.id)}</option>)}</select></label>}
  {kind==='wall-art'&&<><label>Wall image <input aria-label="Wall image" type="file" accept="image/png,image/jpeg,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setImage('');try{setImage(await wallImage(file));setError('')}catch(err){setError(err instanceof Error?err.message:'Image failed')}}}/></label>{image&&<p role="status">Image ready</p>}<label>Optional HTTPS link <input aria-label="Optional HTTPS link" value={href} onChange={e=>setHref(e.target.value)} placeholder="https://…"/></label></>}
  {kind==='agent'&&<label>Public AI agent <select aria-label="Public AI agent" value={agentId} onChange={e=>setAgentId(e.target.value)}><option value="">Choose an existing agent</option>{agents.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
  <button disabled={(!freePlacement&&!slotId)||(kind==='wall-art'&&!image)||(kind==='agent'&&!agentId)} onClick={()=>{try{const id=crypto.randomUUID();onChange(validateInterior([...items,{id,kind,slotId:freePlacement?'custom-'+id:slotId,rotationY:0,...(freePlacement?{position}:{}),...(kind==='wall-art'?{image,href}:{}),...(kind==='agent'?{agentId,label:agents.find(a=>a.id===agentId)?.name}:{})}],freePlacement));setSlotId('');setError('')}catch(err){setError(err instanceof Error?err.message:'Unable to add')}}}>Add to building</button>
  {items.map(item=><div key={item.id} style={{padding:'8px 0',borderBottom:'1px solid #456'}}><strong>{item.label??kindLabels[item.kind]}</strong><p>{item.position?'Custom position':slotLabel(item.slotId)}</p>{item.kind==='wall-art'&&<img src={item.image} alt="Wall artwork" style={{width:80,maxHeight:50,objectFit:'contain'}}/>}
   {freePlacement&&item.position&&(['X','Y','Z'] as const).map((axis,i)=><label key={axis}>{axis}<input aria-label={`${item.kind} ${item.id} ${axis}`} type="number" step={.25} min={-150} max={150} value={item.position![i]} onChange={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&Math.abs(n)<=150)onChange(items.map(v=>v.id===item.id?{...v,position:v.position!.map((p,j)=>i===j?n:p) as [number,number,number]}:v))}}/></label>)}
   <label>Rotation <input aria-label={`Rotation ${slotLabel(item.slotId)}`} type="range" min={-Math.PI*2} max={Math.PI*2} step={Math.PI/12} value={item.rotationY} onChange={e=>onChange(items.map(i=>i.id===item.id?{...i,rotationY:Number(e.target.value)}:i))}/></label>
   <button onClick={()=>onChange(items.filter(i=>i.id!==item.id))}>Remove</button></div>)}
  </>}{error&&<p role="alert">{error}</p>}
 </section>;
}
