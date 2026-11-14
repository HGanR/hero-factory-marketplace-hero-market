import React,{Suspense,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as THREE from 'three';
import CameraController from '../../src/components/green-terrain/CameraController';
import {Canvas,useFrame} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import InteractionController from '../../src/components/green-terrain/TownEditorInteraction';
import ModelScaleControl from '../../src/components/green-terrain/ModelScaleControl';
import AirportModel from '../../src/components/green-terrain/AirportModel';
import {placeAirport,airportView} from '../../src/lib/troo-world/airport';
const placement={...placeAirport([])[0],destinations:[{id:'abc',name:'ABC',url:'/member-world'}]},view=airportView(placement);
const editorMode=new URLSearchParams(window.location.search).get('editor')==='1';
function Probe(){useFrame(({scene,gl,camera,size})=>{const plane=scene.getObjectByName('Airliner');let terminal:any;scene.getObjectByName('Airport_Static')?.traverse((node:any)=>{if(!terminal&&node.isMesh&&node.material?.name==='terminal')terminal=node;});const point=terminal?new THREE.Box3().setFromObject(terminal).getCenter(new THREE.Vector3()).project(camera):null;(window as any).__airport={camera:camera.position.toArray(),calls:gl.info.render.calls,plane:plane?.position.toArray(),selected:!!scene.getObjectByName('Airport selection ring'),pick:point?[(point.x+1)*size.width/2,(1-point.y)*size.height/2]:null};});return null;}
function App(){
 const orbit=useRef<any>(null),[flying,setFlying]=useState(false),[model,setModel]=useState(placement),[selected,setSelected]=useState<string|null>(null),[veritasScale,setVeritasScale]=useState(1);
 const moves=useRef(0),history=useRef(0);const target={position:new THREE.Vector3(...view.position),lookAt:new THREE.Vector3(...view.lookAt)};
 const noop=()=>{};
 return <>{editorMode&&<aside style={{position:'absolute',left:12,top:12,zIndex:10,background:'#102030',color:'white',padding:12,width:250}}><ModelScaleControl label="Airport" value={model.scale} resetValue={.1} onChange={scale=>setModel(value=>({...value,scale}))}/><ModelScaleControl label="Veritas" value={veritasScale} onChange={setVeritasScale}/><output id="editor-state">{JSON.stringify({position:model.position,scale:model.scale,veritasScale,moves:moves.current,history:history.current})}</output></aside>}
 <Canvas camera={{position:[0,28,65],fov:55,near:.1,far:500}}><color attach="background" args={['#9fcbe8']}/><ambientLight intensity={2}/><directionalLight position={[30,50,20]} intensity={3}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,-.03,-55]}><planeGeometry args={[180,140]}/><meshStandardMaterial color="#607b48"/></mesh><Suspense fallback={null}><group position={model.position} scale={model.scale} userData={{airportPlacementKey:model.elementKey}}><AirportModel editorMode={editorMode} selected={selected===model.elementKey} onSelect={()=>setSelected(model.elementKey)} placement={model} canFocus={!flying} onFocus={()=>setFlying(true)}/></group></Suspense>
 {editorMode&&<InteractionController imports={[model]} terrainHeight={()=>0} onSelectAirport={setSelected} onMoveAirport={(key,position,save)=>{moves.current++;if(save)history.current++;setModel(value=>({...value,position}));}} trees={[]} placedObjects={[]} nexusPos={[900,0,900]} meridianPos={[900,0,900]} troothhertzPos={[900,0,900]} stadiumPos={[900,0,900]} veritasPos={[900,0,900]} isEditorMode onSelectTree={noop} onMoveTree={noop} onSelectObject={noop} onMoveObject={noop} onMoveNexus={noop} onMoveMeridian={noop} onMoveTroothhertz={noop} onMoveStadium={noop} onMoveVeritas={noop} orbitRef={orbit}/>}
 <CameraController state={flying?"flying-in":"world"} buildingTarget={null} plainTarget={flying?target:null} orbitRef={orbit} onArrived={()=>setFlying(false)} onExited={()=>setFlying(false)}/><OrbitControls ref={orbit} enabled={!flying} minDistance={5} maxDistance={180}/><Probe/></Canvas></>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
