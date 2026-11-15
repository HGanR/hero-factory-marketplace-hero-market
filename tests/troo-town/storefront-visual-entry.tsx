import React,{Suspense,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas,useFrame} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import {WorldPlacementLayer} from '../../src/components/world-viewer/WorldPlacementLayer';
import BuildingInteriorEditor from '../../src/components/world-editor/BuildingInteriorEditor';
import {STOREFRONT} from '../../src/lib/world-assets/storefront';
import type {InteriorItem} from '../../src/lib/world-assets/interior';
const placement={id:'owner-copy',assetId:STOREFRONT.id,position:[0,0,0] as [number,number,number],rotation:[0,0,0] as [number,number,number],scale:[1,1,1] as [number,number,number]};
function Probe(){useFrame(({scene,gl})=>{const visual=scene.getObjectByName('Storefront_Root');(window as any).__storefront={loaded:!!visual,calls:gl.info.render.calls,colliderVisible:scene.getObjectByName('COL_plaza')?.visible};});return null}
function App(){const [interior,setInterior]=useState<InteriorItem[]>(()=>JSON.parse(localStorage.getItem('fixture-interior')||'[]'));
 return <><aside style={{position:'absolute',top:10,left:10,zIndex:10,width:320,background:'#102437',maxHeight:'90vh',overflowY:'auto'}}><BuildingInteriorEditor placement={{...placement,interior}} onChange={setInterior}/><button onClick={()=>localStorage.setItem('fixture-interior',JSON.stringify(interior))}>Save fixture</button><output id="item-count">{interior.length}</output></aside>
 <Canvas camera={{position:[24,18,26],fov:45}}><color attach="background" args={['#bedbea']}/><ambientLight intensity={2}/><directionalLight position={[10,25,15]} intensity={3}/><Suspense fallback={null}><WorldPlacementLayer chunks={[{chunkKey:'0_0',placementsJson:[{...placement,interior}]}]} assetMap={{[STOREFRONT.id]:{modelUrl:STOREFRONT.modelUrl,category:'building'}}}/></Suspense><OrbitControls target={[0,5,0]}/><Probe/></Canvas></>;
}createRoot(document.getElementById('root')!).render(<App/>);
