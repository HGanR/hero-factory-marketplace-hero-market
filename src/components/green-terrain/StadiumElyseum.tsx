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
import { useGLTF } from "@react-three/drei";
import {STADIUM_ACCESS} from "@/lib/troo-world/stadium-navigation";
import {stadiumSignagePlacement,STADIUM_TICKER_TEXT,cloneStadiumExterior,disposeStadiumExterior} from "@/lib/troo-world/stadium-signage";

import {displayStadiumEvent,type StadiumSettings} from '@/lib/troo-world/stadium-events';
import {loadTownTexture} from './loadTownTexture';
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
}

// Build TROO STADIUM holographic signage — bold white text with bright glow on dark blue band (matches inner ring style)
function buildSignageTexture(text: string): THREE.CanvasTexture {
  const CW = 4096;
  const CH = 64;
  const cvs = document.createElement("canvas");
  cvs.width = CW;
  cvs.height = CH;
  const ctx = cvs.getContext("2d")!;
  ctx.fillStyle = "#0a1628";
  ctx.fillRect(0, 0, CW, CH);

  const fontSize = 44;
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

export default function StadiumElyseum({ position, scale = 1, isSelected, onSelect, animate = false, activeEventTitle, tickerText=STADIUM_TICKER_TEXT,eventSettings }: StadiumElyseumProps) {
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);
  const event=displayStadiumEvent(eventSettings,now);
  const title=event?.title??activeEventTitle;
  const [poster,setPoster]=useState<THREE.Texture|null>(null);
  useEffect(()=>{setPoster(null);if(!event?.poster)return;return loadTownTexture(new THREE.TextureLoader(),event.poster,texture=>{texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;setPoster(texture);});},[event?.poster]);
  const gltf = useGLTF(MODEL_URL, ...GLTF_LOADER_OPTS);
  const groupRef = useRef<THREE.Group>(null);
  const scene = useMemo(() => cloneStadiumExterior(gltf.scene), [gltf.scene]);
  useEffect(()=>()=>disposeStadiumExterior(scene),[scene]);

  const signageRef = useRef<THREE.Mesh>(null);
  const signage = useMemo(()=>stadiumSignagePlacement(scene),[scene]);
  const signageTex = useMemo(() => buildSignageTexture(tickerText), [tickerText]);

  useEffect(()=>()=>{signageTex.dispose();},[signageTex]);

  const badge=event?(now>=Date.parse(event.startsAt)?'LIVE':now>=Date.parse(event.admissionOpensAt)?'DOORS OPEN':'UPCOMING'):'EVENT';
  const titleTex = useMemo(() => title ? buildScreenTexture(title,badge) : null, [title,badge]);
  useEffect(()=>()=>titleTex?.dispose(),[titleTex]);
  const screenTex=poster??titleTex;

  // Navy blue for outside walls (Bowl_Wall, Roof_Ring)
  const NAVY_BLUE = 0x000080;
  useEffect(() => {
    function isWallOrRoof(obj: THREE.Object3D): boolean {
      let o: THREE.Object3D | null = obj;
      while (o) {
        const n = o.name || "";
        if (n === "Bowl_Wall" || n === "Roof_Ring") return true;
        o = o.parent;
      }
      return false;
    }
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      if (!isWallOrRoof(mesh)) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (m && (m as THREE.MeshStandardMaterial).color) {
          (m as THREE.MeshStandardMaterial).color.setHex(NAVY_BLUE);
        }
      });
    });
  }, [scene]);

  useEffect(() => {
    const restore:Array<()=>void>=[];
    scene.traverse(obj=>{const mesh=obj as THREE.Mesh;if(!mesh.isMesh||(!isScreen(mesh.name)&&mesh.name!=='Ticker_Board'))return;
      const texture=isScreen(mesh.name)?screenTex:signageTex;if(!texture)return;
      for(const mat of (Array.isArray(mesh.material)?mesh.material:[mesh.material]) as THREE.MeshStandardMaterial[]){const old={map:mat.map,emissiveMap:mat.emissiveMap,color:mat.color.clone(),emissive:mat.emissive.clone(),intensity:mat.emissiveIntensity};mat.map=texture;mat.color.set('white');mat.emissiveMap=texture;mat.emissive.set('white');mat.emissiveIntensity=.65;mat.needsUpdate=true;restore.push(()=>{mat.map=old.map;mat.emissiveMap=old.emissiveMap;mat.color.copy(old.color);mat.emissive.copy(old.emissive);mat.emissiveIntensity=old.intensity;mat.needsUpdate=true});}
    });return()=>restore.forEach(fn=>fn());
  }, [scene, screenTex, signageTex]);

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
          m.emissiveIntensity = title ? 1.8 : 1.2 + 0.3 * Math.sin(t * 1.5);
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
      <group ref={groupRef} position={position} scale={scale} onClick={(e) => { e.stopPropagation(); onSelect?.(); }}>
        <primitive object={scene} />
        <StadiumDetails scene={scene} radius={signage.radius}/>
        {/* Seating canopy: the imported Roof_Ring is only a narrow torus, not a roof surface. */}
        <mesh name="Stadium_Seating_Canopy" position={[0,signage.y+4,0]} rotation={[-Math.PI/2,0,0]}>
          <ringGeometry args={[32,signage.radius-2.5,128]}/>
          <meshStandardMaterial color={0x173d69} metalness={0.45} roughness={0.55} side={THREE.DoubleSide}/>
        </mesh>
        {/* Upper concourse and central descent share coordinates with interior navigation. */}
        <mesh name="Stadium_Upper_Concourse" position={[0,STADIUM_ACCESS.landingY,0]} rotation={[-Math.PI/2,0,0]}>
          <ringGeometry args={[STADIUM_ACCESS.concourseInner,STADIUM_ACCESS.concourseOuter,128]}/>
          <meshStandardMaterial color={0x5d7185} side={THREE.DoubleSide}/>
        </mesh>
        <mesh name="Stadium_Arena_Walkway" position={[0,STADIUM_ACCESS.arenaY,0]} rotation={[-Math.PI/2,0,0]}>
          <ringGeometry args={[6.3,STADIUM_ACCESS.arenaRadius,96]}/><meshStandardMaterial color={0x334b65} roughness={.8}/>
        </mesh>
        <mesh name="Stadium_Entry_Landing" position={[0,STADIUM_ACCESS.landingY/2,60]}>
          <boxGeometry args={[STADIUM_ACCESS.width,STADIUM_ACCESS.landingY,8]}/><meshStandardMaterial color={0x667c91}/>
        </mesh>
        {Array.from({length:STADIUM_ACCESS.steps},(_,i)=>{
          const depth=(STADIUM_ACCESS.stairTopZ-STADIUM_ACCESS.stairBottomZ)/STADIUM_ACCESS.steps;
          const top=STADIUM_ACCESS.arenaY+(i+1)*(STADIUM_ACCESS.landingY-STADIUM_ACCESS.arenaY)/STADIUM_ACCESS.steps;
          return <mesh name={'Stadium_Descent_Step_'+i} key={'descent-'+i} position={[0,top/2,STADIUM_ACCESS.stairBottomZ+(i+.5)*depth]}>
            <boxGeometry args={[STADIUM_ACCESS.width,top,depth]}/><meshStandardMaterial color={i%2?0x7a91a5:0x91a5b5}/>
          </mesh>;
        })}
        {[-1,1].map(side=><group key={'rail-'+side}>
          <mesh name="Stadium_Stair_Rail" position={[side*4.2,(STADIUM_ACCESS.landingY+STADIUM_ACCESS.arenaY)/2+1,40]} rotation={[Math.atan2(32,STADIUM_ACCESS.landingY-STADIUM_ACCESS.arenaY),0,0]}>
            <cylinderGeometry args={[.07,.07,Math.hypot(32,STADIUM_ACCESS.landingY-STADIUM_ACCESS.arenaY),8]}/><meshStandardMaterial color={0x2bdeef} emissive={0x124a55}/>
          </mesh>
          {Array.from({length:9},(_,i)=>{const z=24+i*4,top=STADIUM_ACCESS.arenaY+i/8*(STADIUM_ACCESS.landingY-STADIUM_ACCESS.arenaY);return <mesh key={i} position={[side*4.2,top+.5,z]}><cylinderGeometry args={[.05,.05,1,8]}/><meshStandardMaterial color={0x86b8c1}/></mesh>})}
        </group>)}
        {/* Raised stage platform — adds depth to interior */}
        <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[6, 32]} />
          <meshStandardMaterial color={0x1a1a2e} roughness={0.9} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[5.8, 6, 32]} />
          <meshStandardMaterial color={0x00E5FF} emissive={0x003344} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
        {isSelected && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 0]}>
            <ringGeometry args={[8, 10, 32]} />
            <meshBasicMaterial color={0xffdd44} transparent opacity={0.85} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
      {/* Scrolling exterior band measured beyond the complete stadium shell. */}
      <group position={position} scale={scale}>
        <mesh ref={signageRef} position={[0, signage.y, 0]}>
          <cylinderGeometry args={[signage.radius, signage.radius, signage.height, 128, 1, true]} />
          <meshBasicMaterial map={signageTex} side={THREE.FrontSide} toneMapped={false} depthWrite={true}/>
        </mesh>
      </group>
    </>
  );
}

/** One draw call for all audience seat markers; aisle positions stay those of the source model. */
function StadiumDetails({scene,radius}:{scene:THREE.Object3D;radius:number}){
 const seats=useRef<THREE.InstancedMesh>(null),backs=useRef<THREE.InstancedMesh>(null);
 const markers=useMemo(()=>{scene.updateMatrixWorld(true);const matrices:THREE.Matrix4[]=[];scene.traverse(obj=>{if(obj.name.startsWith('SPAWN_AUDIENCE_'))matrices.push(obj.matrixWorld.clone())});return matrices;},[scene]);
 useEffect(()=>{for(const[ref,y,z]of [[seats,.45,0],[backs,.88,-.32]] as const){if(!ref.current)continue;markers.forEach((matrix,i)=>ref.current!.setMatrixAt(i,matrix.clone().multiply(new THREE.Matrix4().makeTranslation(0,y,z))));ref.current.instanceMatrix.needsUpdate=true;}},[markers]);
 return <group name="Stadium_Event_Details">
  <instancedMesh ref={seats} args={[undefined,undefined,markers.length]}><boxGeometry args={[.8,.18,.75]}/><meshStandardMaterial color="#245988" roughness={.6}/></instancedMesh>
  <instancedMesh ref={backs} args={[undefined,undefined,markers.length]}><boxGeometry args={[.8,.75,.12]}/><meshStandardMaterial color="#3478ab" roughness={.6}/></instancedMesh>
  {Array.from({length:24},(_,i)=>{const a=(i+.5)*Math.PI/12;return <mesh key={i} name="Exterior_Column" position={[Math.sin(a)*(radius+.2),11,Math.cos(a)*(radius+.2)]}><boxGeometry args={[.65,22,.65]}/><meshStandardMaterial color="#51849e" metalness={.6} roughness={.45}/></mesh>})}
  {[-1,1].map(side=><group key={side} position={[side*20,0,-32]}>{Array.from({length:4},(_,i)=><group key={i} position={[0,1.2+i*2.2,0]}><mesh><boxGeometry args={[2.2,2,1.6]}/><meshStandardMaterial color="#101820"/></mesh><mesh position={[0,0,.82]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.65,.65,.08,16]}/><meshStandardMaterial color="#243849"/></mesh></group>)}</group>)}
 </group>;
}
useGLTF.preload(MODEL_URL, ...GLTF_LOADER_OPTS);

