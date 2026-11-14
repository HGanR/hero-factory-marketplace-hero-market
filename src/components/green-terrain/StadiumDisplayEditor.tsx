'use client';
import {useEffect,useRef,useState} from 'react';
import {validateStadiumSettings,type StadiumSettings,type StadiumMedia} from '@/lib/troo-world/stadium-events';
import {inspectStadiumMp4,MAX_STADIUM_CLIP_BYTES} from '@/lib/troo-world/stadium-mp4';
import {prepareStadiumImage} from './stadium-media-client';
export default function StadiumDisplayEditor({value,onChange,onBusyChange}:{value:StadiumSettings;onChange:(v:StadiumSettings)=>void;onBusyChange:(busy:boolean)=>void}){
 const[error,setError]=useState(''),[busy,setBusy]=useState(false),latest=useRef(value),alive=useRef(true);latest.current=value;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 const scale=value.tickerLetterScale??1,setScale=(n:number)=>onChange({...latest.current,tickerLetterScale:Math.max(.5,Math.min(1.25,Math.round(n*100)/100))});
 const upload=async(file:File)=>{setBusy(true);onBusyChange(true);setError('');try{
  let media:StadiumMedia;
  if(file.name.toLowerCase().endsWith('.mp4')){if(file.size>MAX_STADIUM_CLIP_BYTES)throw Error('MP4 clips must be at most 3 MB');inspectStadiumMp4(new Uint8Array(await file.arrayBuffer()));const form=new FormData();form.set('file',file);const response=await fetch('/api/admin/troo-world/stadium-media',{method:'POST',credentials:'same-origin',body:form});const data=await response.json();if(!response.ok)throw Error(data.error||'Video upload failed');if(!data.media)throw Error('The upload did not return saved screen media');media=data.media;}
  else media={kind:'image',url:await prepareStadiumImage(file)};
  if(alive.current)onChange(validateStadiumSettings({...latest.current,mainDisplay:{media,fit:latest.current.mainDisplay?.fit??'cover'}}));
 }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Media could not be loaded')}finally{if(alive.current){setBusy(false);onBusyChange(false)}}};
 const media=value.mainDisplay?.media;
 return <section aria-label="Stadium display controls" style={{display:'grid',gap:10,border:'1px solid #52677a',borderRadius:8,padding:10}}>
  <h3 style={{margin:0}}>Stadium displays · always available</h3>
  <label>Ticker letter size · {Math.round(scale*100)}%<input aria-label="Ticker letter size" type="range" min={.5} max={1.25} step={.05} value={scale} onChange={e=>setScale(Number(e.target.value))}/></label>
  <div style={{display:'flex',gap:8}}><button type="button" aria-label="Smaller ticker letters" disabled={scale<=.5} onClick={()=>setScale(scale-.05)}>A−</button><button type="button" aria-label="Larger ticker letters" disabled={scale>=1.25} onClick={()=>setScale(scale+.05)}>A+</button><button type="button" onClick={()=>setScale(1)}>Reset letter size</button></div>
  <label>Large stadium screen · image or MP4<input aria-label="Large stadium screen media" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,.mp4" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void upload(file)}}/></label>
  <small>No event is required. MP4: H.264, up to 30 seconds, 3 MB and 1920 × 1080. Clips loop silently. An enabled event graphic takes priority while that event is displayed.</small>
  <label>Large screen fitting<select aria-label="Large screen fitting" value={value.mainDisplay?.fit??'cover'} onChange={e=>onChange({...latest.current,mainDisplay:{media:latest.current.mainDisplay?.media??null,fit:e.target.value as 'cover'|'contain'}})}><option value="cover">Fill screen width · crop excess height</option><option value="contain">Show whole image or clip · add borders</option></select></label>
  {media?.kind==='image'&&<img src={media.url} alt="Large stadium screen preview" style={{width:'100%',aspectRatio:3,objectFit:value.mainDisplay?.fit??'cover',background:'black'}}/>}
  {media?.kind==='video'&&<video src={media.url} controls muted playsInline loop preload="metadata" aria-label="Large stadium screen clip preview" style={{width:'100%',aspectRatio:3,objectFit:value.mainDisplay?.fit??'cover',background:'black'}}/>}
  {media&&<button type="button" disabled={busy} onClick={()=>onChange({...latest.current,mainDisplay:{media:null,fit:latest.current.mainDisplay?.fit??'cover'}})}>Remove main screen media</button>}
  <label>Smaller screen billboard text · Impact<textarea aria-label="Stadium billboard text" rows={3} maxLength={500} value={value.billboardText??''} placeholder="Your message for the smaller stadium screens" onChange={e=>onChange({...latest.current,billboardText:e.target.value})}/></label>
  <small>Text wraps and sizes automatically to each smaller screen. Line breaks are supported.</small>
  {busy&&<p role="status">Uploading stadium screen media…</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
