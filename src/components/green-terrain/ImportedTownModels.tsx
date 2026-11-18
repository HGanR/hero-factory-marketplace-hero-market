'use client';
import type {AirportPartId} from '@/lib/troo-world/airport-parts';
import {isAirport,type ImportedPlacement} from '@/lib/troo-world/airport';
import {isOffice,importedBuildingName} from '@/lib/troo-world/office-building';
import AirportModel from './AirportModel';
import TransitBusModel from './TransitBusModel';
import PropertyRentSign from './PropertyRentSign';
import {isTransitBus} from '@/lib/troo-world/transit-settings';
import {measureModelFootprint} from '@/lib/troo-world/model-footprint';
import BuildingInteriorLayer from '../world-viewer/BuildingInteriorLayer';
import {Component,Suspense,type ReactNode,useMemo} from 'react';
import {useGLTF,Html} from '@react-three/drei';
import * as THREE from 'three';
import type {GreenLayout} from '@/lib/troo-world/green-terrain-layout';
import {buildApexExterior} from '@/lib/troo-world/apex/ApexExterior';
import {buildHarborviewExterior} from '@/lib/troo-world/harborview/HarborviewExterior';
class ModelBoundary extends Component<{name:string;children:ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return{failed:true}}
 render(){return this.state.failed?<Html><span style={{color:'#ffe0d0',background:'#492011',padding:6}}>Model unavailable: {this.props.name}</span></Html>:this.props.children}
}
function GlbModel({placement,selected,onEnter,onSelect}:{placement:ImportedPlacement;selected:boolean;onEnter?:()=>void;onSelect?:()=>void}){
 const {scene}=useGLTF(placement.glbUrl);
 const object=useMemo(()=>{const copy=scene.clone(true);copy.traverse(node=>{if(/^(COL_|COLLISION$|SLOT_.*_placeholder$|AUDIO_|TRIGGER_|INTERACT_|SPAWN_)/.test(node.name))node.visible=false});copy.userData.sidewalkFootprint=measureModelFootprint(copy);return copy},[scene]);
 const box=useMemo(()=>new THREE.Box3().setFromObject(object),[object]);const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),radius=Math.hypot(size.x,size.z)/2+.5;
 return <><primitive object={object}/>{selected&&<mesh name="Imported building selection ring" rotation={[-Math.PI/2,0,0]} position={[center.x,.08,center.z]} raycast={()=>{}}><ringGeometry args={[radius,radius+.22,64]}/><meshBasicMaterial color="#ffdd44" transparent opacity={.85} side={THREE.DoubleSide} depthWrite={false}/></mesh>}
 {selected&&onEnter&&isOffice(placement)&&<Html center position={[center.x,box.max.y+1.2,center.z]}><div style={{whiteSpace:'nowrap',background:'#102b40ed',border:'1px solid #62c8ef',borderRadius:10,padding:10,color:'white',textAlign:'center'}}>{onSelect?<button aria-label={'Select '+importedBuildingName(placement)} style={{background:'transparent',color:'white',border:0,fontWeight:700,cursor:'pointer'}} onClick={e=>{e.stopPropagation();onSelect()}}>{importedBuildingName(placement)}</button>:<strong>{importedBuildingName(placement)}</strong>}<br/><button style={{marginTop:7,padding:'8px 14px',background:'#164b63',border:'1px solid #62c8ef',borderRadius:8,color:'white',cursor:'pointer'}} onClick={e=>{e.stopPropagation();onEnter()}}>Enter the Building</button></div></Html>}
 </>;
}
function ProceduralModel({kind,selected}:{kind:string;selected:boolean}){const object=useMemo(()=>{const model=kind==='procedural:apex'?buildApexExterior():buildHarborviewExterior();model.userData.sidewalkFootprint=measureModelFootprint(model);return model},[kind]);return <><primitive object={object}/>{selected&&<mesh name="Imported building selection ring" rotation={[-Math.PI/2,0,0]} position={[0,.1,0]}><ringGeometry args={[14,14.3,64]}/><meshBasicMaterial color="#ffdd44" side={THREE.DoubleSide}/></mesh>}</>}
export default function ImportedTownModels({placements,roads=[],onFocusAirport,canFocusAirport=true,editorMode=false,selectedAirportKey,selectedAirportPart='whole',onSelectAirport,onEnterBuilding}:{placements:GreenLayout['imports'];roads?:GreenLayout['objects'];onFocusAirport?:(placement:ImportedPlacement)=>void;canFocusAirport?:boolean;editorMode?:boolean;selectedAirportKey?:string|null;selectedAirportPart?:AirportPartId|'whole';onSelectAirport?:(key:string|null,part?:AirportPartId|'whole')=>void;onEnterBuilding?:(placement:ImportedPlacement)=>void}){
 return <group>{placements.map(p=><group name={'Imported '+p.elementKey} userData={{townSolid:!isAirport(p)&&!isTransitBus(p),airportPlacementKey:p.elementKey}} key={p.elementKey+':'+p.glbUrl} position={p.position} scale={p.scale} rotation={[0,p.rotationY,0]} onClick={event=>{event.stopPropagation();onSelectAirport?.(p.elementKey)}}>
 <ModelBoundary name={p.elementKey}><Suspense fallback={null}>{isAirport(p)?<AirportModel placement={p} onFocus={onFocusAirport} canFocus={canFocusAirport} editorMode={editorMode} selected={selectedAirportKey===p.elementKey} selectedPart={selectedAirportPart} onSelect={part=>onSelectAirport?.(p.elementKey,part??'whole')}/>:p.glbUrl==='procedural:for-rent-sign'?<PropertyRentSign editorMode={editorMode} onOpen={() => window.dispatchEvent(new CustomEvent("green-terrain:open-property-listings", { detail: { buildingId: p.propertyBuildingId || null } }))}/>:isTransitBus(p)?<TransitBusModel placement={p} roads={roads} editorMode={editorMode} selected={selectedAirportKey===p.elementKey}/>:p.glbUrl.startsWith('procedural:')?<ProceduralModel kind={p.glbUrl} selected={selectedAirportKey===p.elementKey}/>:<GlbModel placement={p} onSelect={editorMode?()=>onSelectAirport?.(p.elementKey):undefined} selected={selectedAirportKey===p.elementKey} onEnter={onEnterBuilding?()=>onEnterBuilding(p):undefined}/>}
 <BuildingInteriorLayer value={p.interior} allowPosition/>
 </Suspense></ModelBoundary></group>)}</group>;
}
