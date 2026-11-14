import React,{Suspense,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import * as THREE from 'three';
import StadiumElyseum from '../../src/components/green-terrain/StadiumElyseum';
import StadiumEventsEditor from '../../src/components/green-terrain/StadiumEventsEditor';
import {DEFAULT_STADIUM_SETTINGS,validateStadiumSettings,type StadiumSettings} from '../../src/lib/troo-world/stadium-events';
function Probe(){useFrame(({scene})=>{const main=scene.getObjectByName('Screen_Main') as THREE.Mesh;const m=main?.material as THREE.MeshStandardMaterial;const seats=scene.getObjectByName('Stadium_Event_Details')?.children.filter(n=>(n as THREE.InstancedMesh).isInstancedMesh).map(n=>(n as THREE.InstancedMesh).count);(window as any).__stadium={screenLoaded:!!main,posterImage:!!m?.map?.image?.src,screenColorSpace:m?.map?.colorSpace,seats};});return null;}
function App(){const [settings,setSettings]=useState<StadiumSettings>(DEFAULT_STADIUM_SETTINGS);return <main style={{display:'grid',gridTemplateColumns:'1fr 360px',height:'100vh',background:'#07192c',color:'white'}}><div><Canvas camera={{position:[90,95,120],fov:50}}><ambientLight intensity={1.5}/><directionalLight position={[50,100,50]} intensity={3}/><Suspense fallback={null}><StadiumElyseum position={[0,0,0]} eventSettings={settings} tickerText={settings.tickerText}/></Suspense><Probe/><OrbitControls target={[0,7,0]}/></Canvas></div><aside style={{overflow:'auto',padding:18}}><StadiumEventsEditor value={settings} onChange={setSettings} onSave={async()=>{const valid=validateStadiumSettings(settings);const response=await fetch('/fixture-layout',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(valid)});if(!response.ok)throw Error('Save failed')}}/></aside></main>}
createRoot(document.getElementById('root')!).render(<App/>);
