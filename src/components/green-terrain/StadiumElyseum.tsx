"use client";

/**
 * Stadium Elyseum — GLB venue asset for green-terrain / Troo Town.
 * Purchasable from World Explorer catalog; placeable in green-terrain editor.
 * Animates screens, host node, VR cams, ticker (emissive pulse) when insideBuilding.
 * TROO STADIUM holographic band on EXTERIOR (like the inner ring but outside).
 * When event is hosted, host performance/title displayed on screens.
 */
import * as THREE from "three";
import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import {renovateStadium,VENUE_NAME} from "@/lib/troo-world/stadium-renovation";
import {stadiumSignagePlacement,STADIUM_TICKER_TEXT,cloneStadiumExterior,disposeStadiumExterior} from "@/lib/troo-world/stadium-signage";

import {displayStadiumEvent,type StadiumSettings} from '@/lib/troo-world/stadium-events';
import {useStadiumScreenMedia} from './useStadiumScreenMedia';
import {billboardTexture,loadStadiumImpactFont} from './stadium-display-textures';
const isScreen=(name:string)=>/^(screen_(main|side_left|side_right)|scoreboard_screen)$/i.test(name);
const MODEL_URL = "/models/world-assets/stadium-elyseum.glb";

/** Draco on, Meshopt off — this GLB is not meshopt-compressed; skipping MeshoptDecoder avoids extra WASM + chunk init that can interact badly with WebGL/SWC bundles. */
const GLTF_LOADER_OPTS = [true, false] as const;

export interface StadiumElyseumProps {
  position: [number, number, number];
  scale?: number;
  isSelected?: boolean;
  onSelect?: () => void;
  /** When true, runs entrance animations (screens, host, VR cams, ticker pulse, rotating signage) */
  animate?: boolean;
  /** When set, displayed on stadium screens (host performance / event title) */
  activeEventTitle?: string | null;
  tickerText?:string;
  eventSettings?:StadiumSettings;
  onEnter?:()=>void;
}

// Build TROO STADIUM holographic signage — bold white text with bright glow on dark blue band (matches inner ring style)
function buildSignageTexture(text: string,letterScale=1): THREE.CanvasTexture {
  const CW = 4096;
  const CH = 64;
  const cvs = document.createElement("canvas");
  cvs.width = CW;
  cvs.height = CH;
  const ctx = cvs.getContext("2d")!;
  ctx.fillStyle = "#0a1628";
  ctx.fillRect(0, 0, CW, CH);

  const fontSize = 44*letterScale;
  ctx.font = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let rep = 0; rep < 4; rep++) {
    const cx = (CW / 4) * rep + CW / 8;
    const cy = CH / 2;
    ctx.shadowColor = "#a0d8ff";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
    ctx.fillText(text, cx, cy, CW/4-100);
    ctx.shadowBlur = 4;
    ctx.fillStyle = "rgba(200, 230, 255, 0.95)";
    ctx.fillText(text, cx, cy, CW/4-100);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, cx, cy, CW/4-100);
  }
  const tex = new THREE.CanvasTexture(cvs);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  // Two texture wraps keep letter proportions close to the 461-unit exterior circumference.
  tex.repeat.set(2, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.letterScale=letterScale;
  return tex;
}

// Build screen texture for host performance / event title
function buildScreenTexture(title: string,badge: string): THREE.CanvasTexture {
  const W = 512;
  const H = 256;
  const cvs = document.createElement("canvas");
  cvs.width = W;
  cvs.height = H;
  const ctx = cvs.getContext("2d")!;
  ctx.fillStyle = "#0a1628";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#00E5FF";
  ctx.strokeStyle = "#00E5FF";
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  ctx.font = `900 48px "Arial Black", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(badge, W / 2, 50);
  ctx.font = `700 36px Arial, sans-serif`;
  ctx.fillStyle = "#a0d8ff";
  const lines = title.length > 40 ? [title.slice(0, 40) + "..."] : title.match(/.{1,25}/g) || [title];
  lines.slice(0, 3).forEach((line, i) => ctx.fillText(line, W / 2, 120 + i * 45));
  const tex=new THREE.CanvasTexture(cvs);tex.colorSpace=THREE.SRGBColorSpace;tex.flipY=false;return tex;
}

function buildVenueTexture():THREE.CanvasTexture{
 const canvas=document.createElement('canvas');canvas.width=1536;canvas.height=512;const ctx=canvas.getContext('2d')!;
 ctx.fillStyle='#071a28';ctx.fillRect(0,0,1536,512);
 for(let i=0;i<14;i++){ctx.fillStyle=i%2?'#175463':'#9a7843';ctx.fillRect(60+i*10,440-i*5,1416-i*20,2);}
 if(ctx.beginPath){for(let i=0;i<16;i++){ctx.beginPath();ctx.strokeStyle=i%2?'#c59b54':'#257e8a';ctx.lineWidth=1.5;for(let x=0;x<=1536;x+=12){const y=410+Math.sin(x/370+i*.04)*45-i*3;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();}}
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f2ddb2';ctx.font='600 99px Arial, sans-serif';ctx.fillText('TROOTHHERTZ',768,210,1390);ctx.font='500 60px Arial, sans-serif';ctx.fillText('STADIUM',768,315,1390);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.userData.venueName=VENUE_NAME;return texture;
}

export default function StadiumElyseum({ position, scale = 1, isSelected, onSelect, animate = false, activeEventTitle, tickerText=STADIUM_TICKER_TEXT,eventSettings,onEnter }: StadiumElyseumProps) {
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);
  const event=displayStadiumEvent(eventSettings,now);
  const title=event?.title??activeEventTitle;
  const selectedMedia=useMemo(()=>event?.poster?{kind:'image' as const,url:event.poster}:eventSettings?.mainDisplay?.media,[event?.poster,eventSettings?.mainDisplay?.media]);
  const media=useStadiumScreenMedia(selectedMedia,eventSettings?.mainDisplay?.fit??'cover');
  const [fontReady,setFontReady]=useState(false);
  useEffect(()=>{if(!eventSettings?.billboardText)return;let active=true;void loadStadiumImpactFont().then(()=>{if(active)setFontReady(true)});return()=>{active=false};},[Boolean(eventSettings?.billboardText)]);
  const billboards=useMemo(()=>eventSettings?.billboardText?.trim()?{side:billboardTexture(eventSettings.billboardText,14/8),score:billboardTexture(eventSettings.billboardText,16/5)}:null,[eventSettings?.billboardText,fontReady]);
  useEffect(()=>()=>{billboards?.side.dispose();billboards?.score.dispose();},[billboards]);
  const gltf = useGLTF(MODEL_URL, ...GLTF_LOADER_OPTS);
  const groupRef = useRef<THREE.Group>(null);
  const venue = useMemo(() => {const scene=cloneStadiumExterior(gltf.scene);return{scene,renovation:renovateStadium(scene)}}, [gltf.scene]);
  const scene=venue.scene;
  useEffect(()=>()=>{venue.renovation.dispose();disposeStadiumExterior(scene)},[venue,scene]);
  useEffect(()=>{venue.renovation.root.traverse(o=>{const light=o as THREE.Light & {distance?:number};if(light.userData.venueBaseIntensity){light.intensity=light.userData.venueBaseIntensity*scale*scale;if(light.distance!==undefined)light.distance=light.userData.venueBaseDistance*scale;}})},[venue,scale]);

  const signageRef = useRef<THREE.Mesh>(null);
  const signage = useMemo(()=>stadiumSignagePlacement(scene),[scene]);
  const signageTex = useMemo(() => buildSignageTexture(tickerText,eventSettings?.tickerLetterScale??1), [tickerText,eventSettings?.tickerLetterScale]);

  useEffect(()=>()=>{signageTex.dispose();},[signageTex]);

  const badge=event?(now>=Date.parse(event.startsAt)?'LIVE':now>=Date.parse(event.admissionOpensAt)?'DOORS OPEN':'UPCOMING'):'EVENT';
  const titleTex = useMemo(() => title ? buildScreenTexture(title,badge) : null, [title,badge]);
  useEffect(()=>()=>titleTex?.dispose(),[titleTex]);
  const venueTex=useMemo(()=>buildVenueTexture(),[]);
  useEffect(()=>()=>venueTex.dispose(),[venueTex]);
  const screenTex=media.texture??titleTex??venueTex;

  useEffect(() => {
    const restore:Array<()=>void>=[];
    scene.traverse(obj=>{const mesh=obj as THREE.Mesh;if(!mesh.isMesh||(!isScreen(mesh.name)&&mesh.name!=='Ticker_Board'))return;
      const texture=mesh.name==='Ticker_Board'?signageTex:mesh.name==='Screen_Main'?screenTex:billboards?(mesh.name==='Scoreboard_Screen'?billboards.score:billboards.side):(event?.poster?screenTex:titleTex??venueTex);if(!texture)return;
      for(const mat of (Array.isArray(mesh.material)?mesh.material:[mesh.material]) as THREE.MeshStandardMaterial[]){const old={map:mat.map,emissiveMap:mat.emissiveMap,color:mat.color.clone(),emissive:mat.emissive.clone(),intensity:mat.emissiveIntensity};mat.map=texture;mat.color.set('white');mat.emissiveMap=texture;mat.emissive.set('white');mat.emissiveIntensity=.65;mat.needsUpdate=true;restore.push(()=>{mat.map=old.map;mat.emissiveMap=old.emissiveMap;mat.color.copy(old.color);mat.emissive.copy(old.emissive);mat.emissiveIntensity=old.intensity;mat.needsUpdate=true});}
    });return()=>restore.forEach(fn=>fn());
  }, [scene, screenTex, signageTex, billboards, titleTex, venueTex, event?.poster]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (animate && scene) {
      scene.traverse((obj) => {
        if (!(obj as THREE.Mesh).isMesh) return;
        const mesh = obj as THREE.Mesh;
        const n = mesh.name;
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (!mat || !(mat as THREE.MeshStandardMaterial).emissive) return;
        const m = mat as THREE.MeshStandardMaterial;
        if (n === "SPAWN_HOST") {
          mesh.scale.y = 1 + 0.3 * Math.sin(t * 3);
          m.emissiveIntensity = 0.6 + 0.4 * Math.sin(t * 3);
        } else if (n.startsWith("VR_CAM")) {
          m.emissiveIntensity = 0.4 + 0.3 * Math.sin(t * 2 + 1);
        } else if (n === "Ticker_Board") {
          m.emissiveIntensity = 0.8 + 0.2 * Math.sin(t * 4);
        } else if (isScreen(n)) {
          m.emissiveIntensity = .65;
        }
      });
    }
    if (signageRef.current?.material) {
      const m = signageRef.current.material as THREE.MeshBasicMaterial;
      if (m.map) m.map.offset.x = (t * 0.04) % 1;

    }
  });

  return (
    <>
      <group ref={groupRef} position={position} scale={scale} onClick={(e) => { e.stopPropagation();let o:THREE.Object3D|null=e.object;while(o){if(onEnter&&o.name.startsWith("Venue_Exterior_Doors_")){onEnter?.();return;}o=o.parent;}onSelect?.(); }}>
        <primitive object={scene} />
        {(media.needsPlay||media.error)&&<Html position={[0,18,-60]} center><div style={{background:'#07182d',color:'white',padding:8,borderRadius:8}}>{media.needsPlay&&<button type="button" onClick={e=>{e.stopPropagation();media.play()}}>Play stadium screen video</button>}{media.error&&<span role="status">{media.error}</span>}</div></Html>}
        {isSelected && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 0]}>
            <ringGeometry args={[8, 10, 32]} />
            <meshBasicMaterial color={0xffdd44} transparent opacity={0.85} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
      {/* Scrolling exterior band measured beyond the complete stadium shell. */}
      <group position={position} scale={scale}>
        <mesh name="Stadium_Exterior_Ticker" ref={signageRef} position={[0, signage.y, 0]}>
          <cylinderGeometry args={[signage.radius, signage.radius, signage.height, 128, 1, true]} />
          <meshBasicMaterial map={signageTex} side={THREE.FrontSide} toneMapped={false} depthWrite={true}/>
        </mesh>
      </group>
    </>
  );
}

useGLTF.preload(MODEL_URL, ...GLTF_LOADER_OPTS);

