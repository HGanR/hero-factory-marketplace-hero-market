import React from 'react';
import {_roots} from '@react-three/fiber';
import * as THREE from 'three';
import {createRoot} from 'react-dom/client';
import GreenTerrainExperience from '../../src/components/green-terrain/GreenTerrainExperience';
createRoot(document.getElementById('root')!).render(<GreenTerrainExperience/>);

(window as any).__officePick=()=>{const canvas=document.querySelector('canvas');const state=(_roots as any).get(canvas)?.store.getState();const object=state?.scene.getObjectByName('Imported office-a');if(!object?.getObjectByProperty("isMesh",true))return null;const point=new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()).project(state.camera);const rect=canvas!.getBoundingClientRect();return[rect.left+(point.x+1)*rect.width/2,rect.top+(1-point.y)*rect.height/2]};
(window as any).__terrainAssetNodes=()=>{const canvas=document.querySelector('canvas'),scene=(_roots as any).get(canvas)?.store.getState().scene;return{forest:!!scene?.getObjectByName('GF_WallFrontL'),bus:!!scene?.getObjectByName('TROO_Transit_Bus'),busPosition:scene?.getObjectByName('TROO_Transit_Bus')?.position.toArray(),selected:!!scene?.getObjectByName('Imported building selection ring')};};
