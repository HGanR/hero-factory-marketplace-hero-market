'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useFrame,type ThreeEvent} from '@react-three/fiber';
import {Html,useGLTF} from '@react-three/drei';
import {AIRPORT,airportStage,type ImportedPlacement} from '@/lib/troo-world/airport';
import AirportDepartures from './AirportDepartures';
import {createAirportPlayback} from '@/lib/troo-world/airport-playback';

const panelPosition=(_object:unknown,_camera:unknown,size:{width:number}):[number,number]=>[size.width-16,90];

export default function AirportModel({placement,onFocus,canFocus=true,editorMode=false,selected=false,onSelect}:{placement:ImportedPlacement;onFocus?:(placement:ImportedPlacement)=>void;canFocus?:boolean;editorMode?:boolean;selected?:boolean;onSelect?:()=>void}){
 const {scene,animations}=useGLTF(placement.glbUrl);
 const playback=useMemo(()=>createAirportPlayback(scene,animations),[scene,animations]);
 const [open,setOpen]=useState(false),[playing,setPlaying]=useState(true),[time,setTime]=useState(0),[rate,setRate]=useState(1);
 const elapsed=useRef(0);
 useEffect(()=>{playback.activate();return()=>playback.dispose();},[playback]);
 useFrame((_,delta)=>{playback.update(delta);elapsed.current+=delta;if(open&&editorMode&&elapsed.current>=.5){setTime(playback.time);elapsed.current=0;}});
 const seek=(value:number)=>{playback.seek(value);setTime(playback.time);};
 const buttonStyle={padding:'7px 10px',border:'1px solid #65bfff',borderRadius:7,background:'#102c45',color:'white',cursor:'pointer'};
 return <>
  <primitive object={playback.object} onClick={(event:ThreeEvent<MouseEvent>)=>{event.stopPropagation();if(editorMode)onSelect?.();else setOpen(true);}}/>
  {editorMode&&selected&&<mesh name="Airport selection ring" rotation={[-Math.PI/2,0,0]} position={[0,1,59.5]}><ringGeometry args={[308,312,64]}/><meshBasicMaterial color="#ffdd44" transparent opacity={.85} side={2} depthTest={false}/></mesh>}
  <Html position={[0,45,80]} center={!open} {...(open?{calculatePosition:panelPosition}:{})} style={{pointerEvents:'auto',...(open?{transform:'translateX(-100%)'}:{})}}>
   <div onPointerDown={event=>event.stopPropagation()} style={{fontFamily:'system-ui',fontSize:12,color:'white',background:'#081b2fed',border:'1px solid #65bfff',borderRadius:10,padding:9,width:open?270:undefined,maxWidth:'calc(100vw - 32px)',maxHeight:'calc(100vh - 190px)',overflowY:'auto'}}>
    <button type="button" aria-expanded={open} onClick={()=>setOpen(value=>!value)} style={buttonStyle}>✈ Airport · Departures</button>
    {open&&<><AirportDepartures destinations={placement.destinations??[]}/>{editorMode&&<details><summary>Animation preview (editor only)</summary><section aria-label="Airport animation preview">
     <p>30-minute animated flight cycle. Controls affect only your view.</p>
     <p role="status">{airportStage(time).name} · {Math.floor(time/60)}:{String(Math.floor(time%60)).padStart(2,'0')} / 30:00</p>
     <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
      <button type="button" style={buttonStyle} onClick={()=>{playback.setPlaying(!playing);setPlaying(!playing);}}>{playing?'Pause cycle':'Play cycle'}</button>
      <button type="button" style={buttonStyle} onClick={()=>seek(0)}>Restart cycle</button>
      {onFocus&&<button type="button" style={buttonStyle} disabled={!canFocus} onClick={()=>onFocus(placement)}>View airport</button>}
     </div>
     <label>Playback speed <select aria-label="Airport playback speed" value={rate} onChange={event=>{const value=Number(event.target.value);playback.setRate(value);setRate(value);}}>{[1,10,30].map(speed=><option key={speed} value={speed}>{speed}×</option>)}</select></label>
     <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:8}}>{AIRPORT.stages.map(stage=><button type="button" key={stage.time} style={buttonStyle} onClick={()=>seek(stage.time)}>{stage.name}</button>)}</div>
    </section></details>}</>}
   </div>
  </Html>
 </>;
}
