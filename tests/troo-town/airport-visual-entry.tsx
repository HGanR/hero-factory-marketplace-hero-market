import React,{Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import AirportModel from '../../src/components/green-terrain/AirportModel';
import {placeAirport,airportView} from '../../src/lib/troo-world/airport';
const placement=placeAirport([])[0],view=airportView(placement);
function Probe(){useFrame(({scene,gl})=>{const plane=scene.getObjectByName('Airliner');(window as any).__airport={calls:gl.info.render.calls,plane:plane?.position.toArray()};});return null;}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Canvas camera={{position:view.position,fov:55,near:.1,far:500}}><color attach="background" args={['#9fcbe8']}/><ambientLight intensity={2}/><directionalLight position={[30,50,20]} intensity={3}/><mesh rotation={[-Math.PI/2,0,0]} position={[0,-.03,-55]}><planeGeometry args={[180,140]}/><meshStandardMaterial color="#607b48"/></mesh><Suspense fallback={null}><group position={placement.position} scale={placement.scale}><AirportModel placement={placement}/></group></Suspense><OrbitControls target={view.lookAt}/><Probe/></Canvas></React.StrictMode>);
