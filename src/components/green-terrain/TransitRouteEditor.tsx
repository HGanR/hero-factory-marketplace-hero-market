'use client';
import {useEffect,useMemo,useState} from 'react';
import {transitSettings,type TransitSettings} from '@/lib/troo-world/transit-settings';
import {createTransitService} from '@/lib/troo-world/transit-route';
import {trafficTime} from '@/lib/troo-world/traffic-signals';
import type {GreenLayout} from '@/lib/troo-world/green-terrain-layout';
import type {ImportedPlacement} from '@/lib/troo-world/airport';
const EMPTY_ROADS:GreenLayout['objects']=[];
export default function TransitRouteEditor({placement,roads=EMPTY_ROADS,onChange}:{placement:ImportedPlacement;roads?:GreenLayout['objects'];onChange:(value:TransitSettings)=>void}){
 const s=transitSettings(placement),id=placement.elementKey,[time,setTime]=useState(trafficTime),service=useMemo(()=>createTransitService(placement,{objects:roads}),[placement,roads]);
 useEffect(()=>{const timer=setInterval(()=>setTime(trafficTime()),1000);return()=>clearInterval(timer)},[]);
 const pose=service(time),remaining=Math.ceil(pose?.breakRemaining??0),status=!s.enabled?'Route disabled':!pose?'Bus cannot fit this street':pose.onBreak?`30-minute break · next departure in ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:pose.stopped&&pose.visible?'Waiting for green signal':pose.visible?`Travelling to ${pose.destination}`:'Reappearing at the next street end';
 return <fieldset style={{border:'1px solid #36526b',borderRadius:8,padding:9,marginTop:10,color:'#e0f4ff'}}><legend>TROO Transit route</legend><p style={{fontSize:12}}>Parked in Editor Mode for placement. Switch to View Mode to see traffic. Save World Layout to apply for visitors.</p><label><input type="checkbox" aria-label={'Run bus route '+id} checked={s.enabled} onChange={e=>onChange({...s,enabled:e.target.checked})}/> Run route in View Mode</label>
 <p><label>Route <select aria-label={'Bus street '+id} value={s.axis} onChange={e=>onChange({...s,axis:e.target.value as TransitSettings['axis']})}><option value="both">North → South, then East → West</option><option value="north-south">North ↔ South only</option><option value="east-west">East ↔ West only</option></select></label></p>
 {s.axis==='both'?<p style={{fontSize:12}}>The bus reappears on the east side after the southbound trip, travels west, then rests off-map for 30 minutes before repeating. Both routes obey the intersection signals.</p>:<p><label>Map edge <select aria-label={'Bus edge mode '+id} value={s.mode} onChange={e=>onChange({...s,mode:e.target.value as TransitSettings['mode']})}><option value="wrap">Reappear at opposite end</option><option value="shuttle">Return on opposite lane</option></select></label></p>}
 <label>Speed · m/s <input aria-label={'Bus speed '+id} type="number" min={1} max={12} step={.5} value={s.speed} onChange={e=>{const speed=Number(e.target.value);if(Number.isFinite(speed)&&speed>=1&&speed<=12)onChange({...s,speed});}}/></label>
 <p role="status" aria-label={'Bus service status '+id} style={{fontSize:12}}>View Mode service: {status}</p><p style={{fontSize:12}}>Keep the bus near natural size to fit a lane; oversized buses remain parked.</p></fieldset>;
}
