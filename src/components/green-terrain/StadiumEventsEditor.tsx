'use client';
import {useRef,useState} from 'react';
import StadiumDisplayEditor from './StadiumDisplayEditor';
import {prepareStadiumImage} from './stadium-media-client';
import {DEFAULT_STADIUM_SETTINGS,DEFAULT_STADIUM_CONTRACT,type StadiumSettings,type StadiumEvent} from '@/lib/troo-world/stadium-events';
const localTime=(value:string)=>{const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};
export default function StadiumEventsEditor({value=DEFAULT_STADIUM_SETTINGS,onChange,onSave,disabled=false}:{value?:StadiumSettings;onChange:(s:StadiumSettings)=>void;onSave:()=>Promise<void>;disabled?:boolean}){
 const [error,setError]=useState(''),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false),[uploading,setUploading]=useState(false);
 const latest=useRef(value);latest.current=value;
 const change=(next:StadiumSettings)=>{setSaved(false);onChange(next)};
 const patch=(id:string,changes:Partial<StadiumEvent>)=>change({...latest.current,events:latest.current.events.map(e=>e.id===id?{...e,...changes}:e)});
 const add=()=>{const start=Date.now()+3600000;change({...value,events:[...value.events,{id:crypto.randomUUID(),title:'New event',enabled:false,paid:true,admissionOpensAt:new Date(start-1800000).toISOString(),startsAt:new Date(start).toISOString(),endsAt:new Date(start+7200000).toISOString(),capacity:100,chainId:137,contractAddress:DEFAULT_STADIUM_CONTRACT,tokenId:'0'}]})};
 return <section aria-label="Stadium event scheduler" style={{display:'grid',gap:12,color:'white'}}>
  <h3>Stadium events</h3>
  <label>Stadium ring ticker text<input maxLength={160} value={value.tickerText} onChange={e=>change({...value,tickerText:e.target.value})}/></label>
  <StadiumDisplayEditor value={value} onChange={change} onBusyChange={setUploading}/>
  <p>Times use your device’s local time. Paid-event wallet checks begin at Admission opens and end when the event ends. Free entry needs no wallet.</p>
  {value.events.map(event=><fieldset key={event.id} style={{display:'grid',gap:9,border:'1px solid #52677a',padding:10}}>
   <label>Event title<input value={event.title} maxLength={100} onChange={e=>patch(event.id,{title:e.target.value})}/></label>
   <label><input type="checkbox" checked={event.enabled} onChange={e=>patch(event.id,{enabled:e.target.checked})}/> Enable event</label>
   <label><input type="checkbox" checked={event.paid} onChange={e=>patch(event.id,{paid:e.target.checked})}/> Paid / NFT ticket required</label>
   {(['admissionOpensAt','startsAt','endsAt'] as const).map((key,i)=><label key={key}>{['Admission opens','Event starts','Event ends'][i]}<input type="datetime-local" value={localTime(event[key])} onChange={e=>{if(e.target.value)patch(event.id,{[key]:new Date(e.target.value).toISOString()})}}/></label>)}
   <label>Capacity, including hosts<input type="number" min={1} max={500} value={event.capacity} onChange={e=>patch(event.id,{capacity:Number(e.target.value)})}/></label>
   {event.paid&&<><p>Polygon · ERC-721 or ERC-1155</p><label>NFT contract<input value={event.contractAddress} onChange={e=>patch(event.id,{contractAddress:e.target.value})}/></label><label>Token ID<input inputMode="numeric" value={event.tokenId} onChange={e=>patch(event.id,{tokenId:e.target.value})}/></label><small>Token ID 0 is valid. An ERC-721 ID has one owner; an ERC-1155 ID can have many holders.</small></>}
   <label>Stadium TV graphic<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setUploading(true);try{setError('');patch(event.id,{poster:await prepareStadiumImage(file)})}catch(err){setError(err instanceof Error?err.message:'Image upload failed')}finally{e.target.value='';setUploading(false)}}}/></label>
   {event.poster&&<><img src={event.poster} alt={event.title+' event graphic'} style={{width:'100%',maxHeight:140,objectFit:'contain'}}/><button type="button" onClick={()=>patch(event.id,{poster:undefined})}>Remove graphic</button></>}
   <button type="button" onClick={()=>change({...value,events:value.events.filter(e=>e.id!==event.id)})}>Remove event</button>
  </fieldset>)}
  <button type="button" disabled={disabled||value.events.length>=8} onClick={add}>Add event</button>
  <button type="button" disabled={disabled||saving||uploading} onClick={async()=>{setSaving(true);setError('');try{await onSave();setSaved(true)}catch(e){setError(e instanceof Error?e.message:'Event was not saved')}finally{setSaving(false)}}}>{saving?'Saving…':'Save events and world layout'}</button>
  <p>Saving publishes these events, graphics and ticker with the current town placement. The event room must be configured before paid admission can open.</p>
  {saved&&<p role="status">Events and town layout saved.</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
