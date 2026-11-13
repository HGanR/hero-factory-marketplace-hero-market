'use client';
import {isAirport,type ImportedPlacement} from '@/lib/troo-world/airport';
import AirportModel from './AirportModel';
import {Component,Suspense,type ReactNode,useMemo} from 'react';
import {useGLTF,Html} from '@react-three/drei';
import type {GreenLayout} from '@/lib/troo-world/green-terrain-layout';
import {buildApexExterior} from '@/lib/troo-world/apex/ApexExterior';
import {buildHarborviewExterior} from '@/lib/troo-world/harborview/HarborviewExterior';
class ModelBoundary extends Component<{name:string;children:ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return{failed:true}}
 render(){return this.state.failed?<Html><span style={{color:'#ffe0d0',background:'#492011',padding:6}}>Model unavailable: {this.props.name}</span></Html>:this.props.children}
}
function GlbModel({url}:{url:string}){const{scene}=useGLTF(url);const object=useMemo(()=>scene.clone(true),[scene]);return <primitive object={object}/>}
function ProceduralModel({kind}:{kind:string}){const object=useMemo(()=>kind==='procedural:apex'?buildApexExterior():buildHarborviewExterior(),[kind]);return <primitive object={object}/>}
export default function ImportedTownModels({placements,onFocusAirport,canFocusAirport=true}:{placements:GreenLayout['imports'];onFocusAirport?:(placement:ImportedPlacement)=>void;canFocusAirport?:boolean}){return <group>{placements.map(p=><group userData={{townSolid:!isAirport(p)}} key={p.elementKey+':'+p.glbUrl} position={p.position} scale={p.scale} rotation={[0,p.rotationY,0]}><ModelBoundary name={p.elementKey}><Suspense fallback={null}>{isAirport(p)?<AirportModel placement={p} onFocus={onFocusAirport} canFocus={canFocusAirport}/>:p.glbUrl.startsWith('procedural:')?<ProceduralModel kind={p.glbUrl}/>:<GlbModel url={p.glbUrl}/>}</Suspense></ModelBoundary></group>)}</group>}
