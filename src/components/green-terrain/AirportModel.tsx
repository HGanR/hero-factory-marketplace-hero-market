'use client';
import {AIRPORT_PIVOTS,airportGate,identityAirportParts,partPoint,type AirportPartId} from '@/lib/troo-world/airport-parts';
import {useEffect,useMemo,useRef,useState} from 'react';
import {useFrame,type ThreeEvent} from '@react-three/fiber';
import {Html,useGLTF} from '@react-three/drei';
import {AIRPORT,airportStage,type ImportedPlacement} from '@/lib/troo-world/airport';
import RunwayLights from './AirportRunwayLights';
import AirportDepartures from './AirportDepartures';
import {createAirportPlayback,airportTerminalAnchor} from '@/lib/troo-world/airport-playback';

export default function AirportModel({placement,onFocus,canFocus=true,editorMode=false,selected=false,selectedPart='whole',onSelect}:{placement:ImportedPlacement;onFocus?:(placement:ImportedPlacement)=>void;canFocus?:boolean;editorMode?:boolean;selected?:boolean;selectedPart?:AirportPartId|'whole';onSelect?:(part?:AirportPartId)=>void}){
 const {scene,animations}=useGLTF(placement.glbUrl);
 const playback=useMemo(()=>createAirportPlayback(scene,animations),[scene,animations]);
 const parts=placement.airportParts;
 const terminalAnchor=useMemo(()=>{const point=airportTerminalAnchor(scene);return parts?partPoint(point,'terminal',parts):point},[scene,parts]);
 const runway=parts?.runway,stretch=runway?.stretch??[1,1,1];
 const ringParts=parts??identityAirportParts(),ringPart=selectedPart==='whole'?'runway':selectedPart;
 const ringCenter=ringPart==='airplane'?airportGate(ringParts):partPoint(AIRPORT_PIVOTS[ringPart],ringPart,ringParts);
 const radius=selectedPart==='whole'?Math.max(308,(parts?.runway.scale??1)*300*(parts?.runway.stretch?.[0]??1)):ringPart==='runway'?Math.hypot(300*ringParts.runway.scale*(ringParts.runway.stretch?.[0]??1),12*ringParts.runway.scale*(ringParts.runway.stretch?.[2]??1)):ringPart==='terminal'?105*ringParts.terminal.scale:ringPart==='tower'?8*ringParts.tower.scale:27*ringParts.airplane.scale;
 const [open,setOpen]=useState(false),[playing,setPlaying]=useState(true),[time,setTime]=useState(0),[rate,setRate]=useState(1);
 const elapsed=useRef(0);
 useEffect(()=>{playback.activate();return()=>playback.dispose();},[playback]);
 useEffect(()=>{playback.configure(parts,placement.scale)},[playback,parts,placement.scale]);
 useFrame((_,delta)=>{playback.update(delta);elapsed.current+=delta;if(open&&editorMode&&elapsed.current>=.5){setTime(playback.time);elapsed.current=0;}});
 const seek=(value:number)=>{playback.seek(value);setTime(playback.time);};
 const buttonStyle={padding:'7px 10px',border:'1px solid #65bfff',borderRadius:7,background:'#102c45',color:'white',cursor:'pointer'};
 return <>
  <RunwayLights source={scene} parts={parts} parentScale={placement.scale}/>
  <primitive object={playback.object} onClick={(event:ThreeEvent<MouseEvent>)=>{event.stopPropagation();let node=event.object;let part:AirportPartId|undefined;while(node){if(node.userData.airportPart){part=node.userData.airportPart;break;}node=node.parent!;}onSelect?.(parts?part:undefined);if(!editorMode)setOpen(true);}}/>
  {editorMode&&selected&&<mesh name="Airport selection ring" rotation={[-Math.PI/2,0,0]} position={[ringCenter[0],1,ringCenter[2]]}><ringGeometry args={[radius,radius+4,64]}/><meshBasicMaterial color="#ffdd44" transparent opacity={.85} side={2}/></mesh>}
  {selected&&<Html position={terminalAnchor} center distanceFactor={45} occlude style={{pointerEvents:'auto'}}>
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
  </Html>}
 </>;
}
