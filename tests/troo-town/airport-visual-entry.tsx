import React,{Suspense,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as THREE from 'three';
import CameraController from '../../src/components/green-terrain/CameraController';
import {Canvas,useFrame} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import AirportModel from '../../src/components/green-terrain/AirportModel';
import {placeAirport,airportView} from '../../src/lib/troo-world/airport';
const placement=placeAirport([])[0],view=airportView(placement);
function Probe(){useFrame(({scene,gl,camera})=>{const plane=scene.getObjectByName('Airliner');(window as any).__airport={camera:camera.position.toArray(),calls:gl.info.render.calls,plane:plane?.position.toArray()};});return null;}
function App(){const orbit=useRef(null),[flying,setFlying]=useState(false);const target={position:new THREE.Vector3(...view.position),lookAt:new THREE.Vector3(...view.lookAt)};return <Canvas camera={{position:[0,28,65],fov:55,near:.1,far:500}}><color attach="background" args={['#9fcbe8']}/><ambientLight intensity={2}/><directionalLight position={[30,50,20]} intensity={3}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,-.03,-55]}><planeGeometry args={[180,140]}/><meshStandardMaterial color="#607b48"/></mesh><Suspense fallback={null}><group position={placement.position} scale={placement.scale}><AirportModel placement={placement} canFocus={!flying} onFocus={()=>setFlying(true)}/></group></Suspense><CameraController state={flying?"flying-in":"world"} buildingTarget={null} plainTarget={flying?target:null} orbitRef={orbit} onArrived={()=>setFlying(false)} onExited={()=>setFlying(false)}/><OrbitControls ref={orbit} enabled={!flying} minDistance={5} maxDistance={180}/><Probe/></Canvas>;}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
