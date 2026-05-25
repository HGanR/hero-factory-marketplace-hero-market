/**
 * Green Terrain World Page — ADMIN ONLY
 * Protected editing environment for the green terrain world.
 * Saves to "default" worldId so changes appear in public /troo-world page.
 * 
 * Features: Building dropdown labels, fly-in camera, first-person navigation,
 * functional elevators, seated agents with animations, WASD controls
 */

"use client";

import { useState, useCallback, useEffect, useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import dynamic from "next/dynamic";
import { AuthGate } from "@/components/AuthGate";
import { WorldObjectRenderer, type WorldObjectType } from "@/components/green-terrain/WorldObjects";
import WorldManagementUI from "@/components/green-terrain/WorldManagementUI";
import BuildingInfoPanel from "@/components/green-terrain/BuildingInfoPanel";
import TroothhertzInfoPanel from "@/components/green-terrain/TroothhertzInfoPanel";
import AgentChatPanel from "@/components/green-terrain/AgentChatPanel";
import { TROOTHHERTZ_AGENTS, type TroothAgent } from "@/components/green-terrain/TroothhertzTower";
import CameraController, { type CameraState, type BuildingTarget, type PlainTarget } from "@/components/green-terrain/CameraController";
import FirstPersonControls, { type BuildingBounds, type HoveredAgentInfo, type CollisionBox } from "@/components/green-terrain/FirstPersonControls";
import WorldFirstPersonControls from "@/components/green-terrain/WorldFirstPersonControls";
import FunctionalElevator from "@/components/green-terrain/FunctionalElevator";
import SeatedAgent from "@/components/green-terrain/SeatedAgent";
import type { AgentData } from "@/data/greenTerrainBuildingData";
import { BUILDING_CONFIG, getAgentsByFloor } from "@/data/greenTerrainBuildingData";

const CorporateBuilding = dynamic(() => import("@/components/green-terrain/CorporateBuilding"), { ssr: false });
const MeridianTower = dynamic(() => import("@/components/green-terrain/MeridianTower"), { ssr: false });
const TroothhertzTower = dynamic(() => import("@/components/green-terrain/TroothhertzTower"), { ssr: false });
const StadiumElyseum = dynamic(() => import("@/components/green-terrain/StadiumElyseum"), { ssr: false });
const VeritasSchool = dynamic(() => import("@/components/green-terrain/VeritasSchool"), { ssr: false });

// ─── Terrain helpers ──────────────────────────────────────────────────────────
function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerpN(a: number, b: number, t: number) { return a + t * (b - a); }
function grad(h: number, x: number, y: number) { const u = (h & 2) ? -x : x, v = (h & 1) ? -y : y; return u + v; }
const _p = new Uint8Array(512);
(() => {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let seed = 42;
  for (let i = 255; i > 0; i--) { seed = (seed * 1664525 + 1013904223) & 0xffffffff; const j = Math.abs(seed) % (i + 1); [s[i], s[j]] = [s[j], s[i]]; }
  for (let i = 0; i < 512; i++) _p[i] = s[i & 255];
})();
function noise2(x: number, y: number) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x), yf = y - Math.floor(y);
  const u = fade(xf), v = fade(yf);
  return lerpN(lerpN(grad(_p[_p[X]+Y],xf,yf),grad(_p[_p[X+1]+Y],xf-1,yf),u),lerpN(grad(_p[_p[X]+Y+1],xf,yf-1),grad(_p[_p[X+1]+Y+1],xf-1,yf-1),u),v);
}
function fbm(x: number, y: number, o = 5) { let v=0,a=0.5,f=1,m=0; for(let i=0;i<o;i++){v+=noise2(x*f,y*f)*a;m+=a;a*=0.5;f*=2;} return v/m; }
const FLAT_RADIUS = 120;
// Center City (0,0) + 4 plains further out so they feel like distinct areas (not edge of center)
const PLAIN_CENTERS: [number, number][] = [[0, 0], [0, -95], [0, 95], [95, 0], [-95, 0]];

function terrainHeight(x: number, z: number, stadiumDepress?: { pos: [number,number,number]; radius: number; depth: number }) {
  const nx = x / 200 + 0.5, nz = z / 200 + 0.5;
  let h = fbm(nx * 3, nz * 3) * 8 + fbm(nx * 7, nz * 7) * 2;
  let minD = Infinity;
  for (const [cx, cz] of PLAIN_CENTERS) {
    const d = Math.sqrt((x - cx) ** 2 + (z - cz) ** 2);
    minD = Math.min(minD, d);
  }
  if (minD < FLAT_RADIUS) h = 0;
  else {
    const t = Math.min(1, (minD - FLAT_RADIUS) / 30);
    h *= t * t * (3 - 2 * t);
  }
  // Depression near stadium so terrain doesn't overlay it
  if (stadiumDepress) {
    const dx = x - stadiumDepress.pos[0], dz = z - stadiumDepress.pos[2];
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist < stadiumDepress.radius) {
      const fade = Math.min(1, dist / stadiumDepress.radius);
      const depress = stadiumDepress.depth * (1 - fade * fade);
      h = Math.max(-1, h - depress);
    }
  }
  return h;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface TreeData { id: number; pos: [number,number,number]; scale: number; phase: number; }
interface PlacedObject {
  id: string;
  type: WorldObjectType;
  position: [number,number,number];
  rotation: [number,number,number];
}

function isInFlatZone(x: number, z: number): boolean {
  for (const [cx, cz] of PLAIN_CENTERS) {
    if (Math.sqrt((x - cx) ** 2 + (z - cz) ** 2) < FLAT_RADIUS) return true;
  }
  return false;
}

function generateInitialTrees(): TreeData[] {
  const rng=(s:number)=>{s=(s^0xdeadbeef)>>>0;s=Math.imul(s^(s>>>16),0x45d9f3b);s=Math.imul(s^(s>>>16),0x45d9f3b);return((s^(s>>>16))>>>0)/0xffffffff;};
  const out: TreeData[] = [];
  let id = 0;
  for (let i = 0; i < 200; i++) {
    const a = rng(i * 3) * Math.PI * 2, r = FLAT_RADIUS + 5 + rng(i * 3 + 1) * 55;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (isInFlatZone(x, z)) continue;
    out.push({ id: id++, pos: [x, terrainHeight(x, z), z] as [number, number, number], scale: 0.7 + rng(i * 3 + 2) * 0.8, phase: rng(i) * Math.PI * 2 });
  }
  return out;
}

// ─── Terrain ──────────────────────────────────────────────────────────────────
function Terrain({ stadiumPos }: { stadiumPos?: [number,number,number] }) {
  const geo = useMemo(() => {
    const depress = stadiumPos ? { pos: stadiumPos, radius: 45, depth: 3 } : undefined;
    const g = new THREE.PlaneGeometry(200,200,128,128);
    g.rotateX(-Math.PI/2);
    const pos=g.attributes.position as THREE.BufferAttribute;
    const cols:number[]=[];
    const cL=new THREE.Color(0x2d6a2d),cM=new THREE.Color(0x4a8a3a),cH=new THREE.Color(0x7ab84a);
    for(let i=0;i<pos.count;i++){
      const h=terrainHeight(pos.getX(i),pos.getZ(i), depress);
      pos.setY(i,h);
      const t=Math.min(1,Math.max(0,h/8));
      const c=t<0.5?cL.clone().lerp(cM,t*2):cM.clone().lerp(cH,(t-0.5)*2);
      cols.push(c.r,c.g,c.b);
    }
    g.setAttribute("color",new THREE.Float32BufferAttribute(cols,3));
    g.computeVertexNormals();
    return g;
  }, [stadiumPos?.[0], stadiumPos?.[1], stadiumPos?.[2]]);
  return <mesh geometry={geo} receiveShadow><meshLambertMaterial vertexColors /></mesh>;
}

// ─── Tree ─────────────────────────────────────────────────────────────────────
function Tree({data,isSelected}:{data:TreeData;isSelected:boolean}) {
  const ref=useRef<THREE.Group>(null);
  useFrame(({clock})=>{
    if(!ref.current)return;
    ref.current.rotation.z=Math.sin(clock.getElapsedTime()*0.8+data.phase)*0.04;
  });
  const f1=isSelected?0x4aaa4a:0x2d6a2d;
  const f2=isSelected?0x55bb50:0x3a7a35;
  const f3=isSelected?0x66cc55:0x4a8a3a;
  return (
    <group position={data.pos} scale={data.scale}>
      <mesh position={[0,0.6,0]} castShadow><cylinderGeometry args={[0.08,0.14,1.2,6]}/><meshLambertMaterial color={0x5c3a1e}/></mesh>
      <group ref={ref} position={[0,1.2,0]}>
        <mesh castShadow><coneGeometry args={[0.9,1.6,7]}/><meshLambertMaterial color={f1}/></mesh>
        <mesh position={[0,0.8,0]} castShadow><coneGeometry args={[0.65,1.3,7]}/><meshLambertMaterial color={f2}/></mesh>
        <mesh position={[0,1.5,0]} castShadow><coneGeometry args={[0.4,1.0,7]}/><meshLambertMaterial color={f3}/></mesh>
      </group>
      {isSelected&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,0.08,0]}><ringGeometry args={[0.9,1.1,32]}/><meshBasicMaterial color={0xffdd44} transparent opacity={0.8} side={THREE.DoubleSide}/></mesh>}
    </group>
  );
}

// ─── Sky dome ─────────────────────────────────────────────────────────────────
function SkyDome() {
  const geo = (() => {
    const g=new THREE.SphereGeometry(400,32,16);
    const zenith=new THREE.Color(0x1a5fa8),horizon=new THREE.Color(0x6ab8d4);
    const pos=g.attributes.position as THREE.BufferAttribute;
    const cols:number[]=[];
    for(let i=0;i<pos.count;i++){const t=Math.max(0,Math.min(1,(pos.getY(i)+400)/800));const c=horizon.clone().lerp(zenith,t*t);cols.push(c.r,c.g,c.b);}
    g.setAttribute("color",new THREE.Float32BufferAttribute(cols,3));return g;
  })();
  return <mesh geometry={geo}><meshBasicMaterial vertexColors side={THREE.BackSide}/></mesh>;
}

function Clouds() {
  const ref=useRef<THREE.Group>(null);
  const clouds=Array.from({length:14},(_,i)=>{const rng=(s:number)=>{s=(s^0xcafe1234)>>>0;s=Math.imul(s^(s>>>16),0x45d9f3b);return((s^(s>>>16))>>>0)/0xffffffff;};return{x:(rng(i*3)-0.5)*280,y:55+rng(i*3+1)*30,z:(rng(i*3+2)-0.5)*280,sx:18+rng(i)*20,sy:5+rng(i+1)*5,sz:12+rng(i+2)*14,sp:0.4+rng(i)*0.6};});
  useFrame(({clock})=>{if(!ref.current)return;const t=clock.getElapsedTime();ref.current.children.forEach((c,i)=>{c.position.x=clouds[i].x+Math.sin(t*0.05*clouds[i].sp+i)*8;});});
  return <group ref={ref}>{clouds.map((c,i)=><mesh key={i} position={[c.x,c.y,c.z]} scale={[c.sx,c.sy,c.sz]}><sphereGeometry args={[1,8,6]}/><meshBasicMaterial color={0xffffff} transparent opacity={0.82}/></mesh>)}</group>;
}

// Hills — only diagonals; no hills on bridge paths (N/S/E/W)
function DistantHills() {
  const hills = [
    { pos: [Math.cos(0.25 * Math.PI) * 150, -2, Math.sin(0.25 * Math.PI) * 150] as [number, number, number], scale: [28, 12, 28] as [number, number, number] },
    { pos: [Math.cos(0.75 * Math.PI) * 150, -2, Math.sin(0.75 * Math.PI) * 150] as [number, number, number], scale: [28, 17, 28] as [number, number, number] },
    { pos: [Math.cos(1.25 * Math.PI) * 150, -2, Math.sin(1.25 * Math.PI) * 150] as [number, number, number], scale: [36, 12, 36] as [number, number, number] },
    { pos: [Math.cos(1.75 * Math.PI) * 150, -2, Math.sin(1.75 * Math.PI) * 150] as [number, number, number], scale: [36, 17, 36] as [number, number, number] },
  ];
  return <>{hills.map((h,i)=><mesh key={i} position={h.pos} scale={h.scale}><sphereGeometry args={[1,8,6,0,Math.PI*2,0,Math.PI/2]}/><meshLambertMaterial color={0x3a7a2a} side={THREE.FrontSide}/></mesh>)}</>;
}

function GrassTufts() {
  const ref=useRef<THREE.InstancedMesh>(null);
  const dummy=new THREE.Object3D();
  const rng=(s:number)=>{s=(s^0xabcd1234)>>>0;s=Math.imul(s^(s>>>16),0x45d9f3b);return((s^(s>>>16))>>>0)/0xffffffff;};
  const positions:[number,number,number][]=[];
  const phases:number[]=[];
  for(let i=0;i<600;i++){const x=(rng(i*2)-0.5)*190,z=(rng(i*2+1)-0.5)*190;if(Math.sqrt(x*x+z*z)<28)continue;positions.push([x,terrainHeight(x,z)+0.1,z]);phases.push(rng(i)*Math.PI*2);}
  useFrame(({clock})=>{
    if(!ref.current)return;
    const t=clock.getElapsedTime();
    positions.forEach(([x,y,z],i)=>{dummy.position.set(x,y,z);dummy.rotation.y=phases[i];dummy.rotation.z=Math.sin(t*1.2+phases[i])*0.15;dummy.scale.setScalar(0.6+(phases[i]%0.4));dummy.updateMatrix();ref.current!.setMatrixAt(i,dummy.matrix);});
    ref.current.instanceMatrix.needsUpdate=true;
  });
  return <instancedMesh ref={ref} args={[undefined,undefined,positions.length]} castShadow><coneGeometry args={[0.08,0.5,4]}/><meshLambertMaterial color={0x5aaa35}/></instancedMesh>;
}

function Rocks() {
  const rng=(s:number)=>{s=(s^0x1234abcd)>>>0;s=Math.imul(s^(s>>>16),0x45d9f3b);return((s^(s>>>16))>>>0)/0xffffffff;};
  const rocks=Array.from({length:30},(_,i)=>{const a=rng(i*4)*Math.PI*2,r=35+rng(i*4+1)*60;const x=Math.cos(a)*r,z=Math.sin(a)*r;return{pos:[x,terrainHeight(x,z)-0.1,z] as [number,number,number],scale:[0.3+rng(i*4+2)*0.5,0.2+rng(i*4+3)*0.3,0.3+rng(i*4)*0.5] as [number,number,number],ry:rng(i)*Math.PI};});
  return <>{rocks.map((r,i)=><mesh key={i} position={r.pos} scale={r.scale} rotation={[0,r.ry,0]} castShadow><dodecahedronGeometry args={[0.5,0]}/><meshLambertMaterial color={0x8a8a7a}/></mesh>)}</>;
}

// ─── Building labels (dropdown with Enter Building + View Agents) ─────────────
function NexusLabel({ position, isSelected, onSelect, onViewAgents, onEnter }: {
  position:[number,number,number]; isSelected:boolean;
  onSelect:()=>void; onViewAgents:()=>void; onEnter:()=>void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Html position={[position[0], position[1]+22, position[2]]} center distanceFactor={60} zIndexRange={[50,60]}>
      <div style={{ fontFamily: "system-ui, sans-serif", userSelect: "none", textAlign: "center" }}>
        <div
          onClick={() => { onSelect(); setOpen(o => !o); }}
          style={{
            background: isSelected ? "rgba(255,221,68,0.95)" : "rgba(10,20,40,0.92)",
            border: `2px solid ${isSelected ? "#ffa500" : "#2a6fbd"}`,
            borderRadius: 10, padding: "6px 16px",
            color: isSelected ? "#000" : "#fff",
            fontSize: 13, fontWeight: 700,
            cursor: "pointer", whiteSpace: "nowrap",
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
            letterSpacing: 0.5,
          }}
        >
          🏢 {BUILDING_CONFIG.name}
          <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.7 }}>{open ? "▲" : "▼"}</span>
        </div>
        {open && (
          <div style={{
            marginTop: 6,
            background: "rgba(8,14,26,0.97)",
            border: "1px solid rgba(42,111,189,0.5)",
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
            minWidth: 200,
          }}>
            <button
              onClick={() => { setOpen(false); onEnter(); }}
              style={{
                width: "100%", padding: "10px 16px",
                background: "linear-gradient(90deg,#1a3a6b,#2a6fbd)",
                border: "none", borderBottom: "1px solid rgba(255,255,255,0.08)",
                color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
              }}
            >🚪 Enter Building</button>
            <button
              onClick={() => { setOpen(false); onViewAgents(); }}
              style={{
                width: "100%", padding: "10px 16px",
                background: "transparent",
                border: "none",
                color: "#5a9fd4", fontSize: 13, fontWeight: 600,
                cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
              }}
            >👥 View AI Agents</button>
          </div>
        )}
      </div>
    </Html>
  );
}

function MeridianLabel({ position, isSelected, onSelect, onViewAgents, onEnter }: {
  position:[number,number,number]; isSelected:boolean;
  onSelect:()=>void; onViewAgents:()=>void; onEnter:()=>void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Html position={[position[0], position[1]+32, position[2]]} center distanceFactor={70} zIndexRange={[50,60]}>
      <div style={{ fontFamily: "system-ui, sans-serif", userSelect: "none", textAlign: "center" }}>
        <div
          onClick={() => { onSelect(); setOpen(o => !o); }}
          style={{
            background: isSelected ? "rgba(0,212,255,0.18)" : "rgba(5,15,35,0.92)",
            border: `2px solid ${isSelected ? "#00d4ff" : "#1a6fbd"}`,
            borderRadius: 10, padding: "6px 18px",
            color: isSelected ? "#00d4ff" : "#e0f4ff",
            fontSize: 13, fontWeight: 700,
            cursor: "pointer", whiteSpace: "nowrap",
            boxShadow: isSelected ? "0 0 20px rgba(0,212,255,0.4)" : "0 4px 20px rgba(0,0,0,0.7)",
            letterSpacing: 0.8,
            backdropFilter: "blur(8px)",
          }}
        >
          🏙️ Meridian Tower Agents
          <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.7 }}>{open ? "▲" : "▼"}</span>
        </div>
        {open && (
          <div style={{
            marginTop: 6,
            background: "rgba(5,12,28,0.97)",
            border: "1px solid rgba(0,212,255,0.4)",
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
            minWidth: 200,
          }}>
            <button
              onClick={() => { setOpen(false); onEnter(); }}
              style={{
                width: "100%", padding: "10px 16px",
                background: "linear-gradient(90deg,#003a5c,#0066aa)",
                border: "none", borderBottom: "1px solid rgba(0,212,255,0.15)",
                color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
              }}
            >🚪 Enter Building</button>
            <button
              onClick={() => { setOpen(false); onViewAgents(); }}
              style={{
                width: "100%", padding: "10px 16px",
                background: "transparent",
                border: "none",
                color: "#00d4ff", fontSize: 13, fontWeight: 600,
                cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
              }}
            >👥 View AI Agents</button>
          </div>
        )}
      </div>
    </Html>
  );
}

function StadiumLabel({ position, isSelected, onSelect, onEnter }: {
  position: [number, number, number];
  isSelected: boolean;
  onSelect: () => void;
  onEnter: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Html position={[position[0], position[1] + 18, position[2]]} center distanceFactor={60} zIndexRange={[50, 60]}>
      <div style={{ fontFamily: "system-ui, sans-serif", userSelect: "none", textAlign: "center" }}>
        <div
          onClick={() => { onSelect(); setOpen(o => !o); }}
          style={{
            background: isSelected ? "rgba(255,221,68,0.95)" : "rgba(10,20,40,0.92)",
            border: `2px solid ${isSelected ? "#ffa500" : "#2a6fbd"}`,
            borderRadius: 10,
            padding: "6px 16px",
            color: isSelected ? "#000" : "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
            letterSpacing: 0.5,
          }}
        >
          🏟️ Stadium Elyseum
          <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.7 }}>{open ? "▲" : "▼"}</span>
        </div>
        {open && (
          <div style={{
            marginTop: 6,
            background: "rgba(8,14,26,0.97)",
            border: "1px solid rgba(42,111,189,0.5)",
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
            minWidth: 200,
          }}>
            <button
              onClick={() => { setOpen(false); onEnter(); }}
              style={{
                width: "100%", padding: "10px 16px",
                background: "linear-gradient(90deg,#1a3a6b,#2a6fbd)",
                border: "none", borderBottom: "1px solid rgba(255,255,255,0.08)",
                color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
              }}
            >🚪 Enter Stadium</button>
          </div>
        )}
      </div>
    </Html>
  );
}

function VeritasLabel({ position, isSelected, onSelect }: {
  position: [number, number, number];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Html position={[position[0], position[1] + 18, position[2]]} center distanceFactor={60} zIndexRange={[50, 60]}>
      <div style={{ fontFamily: "Georgia, serif", userSelect: "none", textAlign: "center" }}>
        <div
          onClick={() => { onSelect(); setOpen(o => !o); }}
          style={{
            background: isSelected ? "rgba(240,208,128,0.95)" : "linear-gradient(135deg,#1a0a00,#3d1f00)",
            border: `2px solid ${isSelected ? "#ffa500" : "#c8a84b"}`,
            borderRadius: 8,
            padding: "6px 16px",
            color: isSelected ? "#1a0a00" : "#f0d080",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
            letterSpacing: 1,
          }}
        >
          🏫 School of Veritas
          <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.7 }}>{open ? "▲" : "▼"}</span>
        </div>
        {open && (
          <div style={{
            marginTop: 6,
            background: "rgba(26,10,0,0.97)",
            border: "1px solid rgba(200,168,75,0.5)",
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
            minWidth: 220,
          }}>
            <a
              href="/veritas-3d/veritas-3d.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                width: "100%",
                padding: "10px 16px",
                background: "linear-gradient(90deg,#3d1f00,#6b3a1a)",
                border: "none",
                color: "#f0d080",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "left",
                textDecoration: "none",
              }}
            >🚪 Enter Building</a>
          </div>
        )}
      </div>
    </Html>
  );
}

// ─── Plain labels and bridge HUDs (direction name + Enter) ────────────────────
function PlainLabel({ position, name }: { position: [number, number, number]; name: string }) {
  return (
    <Html position={[position[0], position[1] + 25, position[2]]} center distanceFactor={90} zIndexRange={[40, 50]}>
      <div style={{
        background: "rgba(5,25,45,0.9)", border: "2px solid rgba(16,185,129,0.6)",
        borderRadius: 12, padding: "8px 20px", color: "#10b981",
        fontFamily: "system-ui", fontSize: 14, fontWeight: 800, letterSpacing: 1.5,
        whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
      }}>
        {name}
      </div>
    </Html>
  );
}

function BridgePlainHUD({ position, name, onEnter }: { position: [number, number, number]; name: string; onEnter: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Html position={[position[0], position[1] + 12, position[2]]} center distanceFactor={70} zIndexRange={[50, 60]}>
      <div style={{ fontFamily: "system-ui", userSelect: "none", textAlign: "center" }}>
        <div
          onClick={() => setOpen((o) => !o)}
          style={{
            background: "rgba(5,25,45,0.95)",
            border: "2px solid rgba(16,185,129,0.6)",
            borderRadius: 10,
            padding: "8px 18px",
            color: "#10b981",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            backdropFilter: "blur(8px)",
          }}
        >
          🛤️ {name}
          <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.7 }}>{open ? "▲" : "▼"}</span>
        </div>
        {open && (
          <div style={{ marginTop: 6, background: "rgba(5,12,28,0.97)", border: "1px solid rgba(16,185,129,0.4)", borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.7)", minWidth: 180 }}>
            <button
              onClick={() => { setOpen(false); onEnter(); }}
              style={{
                width: "100%", padding: "10px 16px",
                background: "linear-gradient(90deg,#0d4a3a,#10b981)",
                border: "none", color: "#fff", fontSize: 13, fontWeight: 700,
                cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
              }}
            >
              🚪 Enter {name}
            </button>
          </div>
        )}
      </div>
    </Html>
  );
}

// Bridge/road connecting plains — street-style asphalt with center line (matches Street object)
function Bridge({ start, end, width = 10 }: { start: [number, number, number]; end: [number, number, number]; width?: number }) {
  const dx = end[0] - start[0], dz = end[2] - start[2];
  const len = Math.sqrt(dx * dx + dz * dz);
  const midX = (start[0] + end[0]) / 2, midZ = (start[2] + end[2]) / 2;
  const rotY = Math.atan2(-dx, dz);
  const dashLength = 2.2;
  const gapLength = 4;
  const period = dashLength + gapLength;
  const stripeCount = Math.max(3, Math.floor(len / period));
  return (
    <group position={[midX, 0.35, midZ]} rotation={[-Math.PI / 2, 0, rotY]} renderOrder={1}>
      <mesh>
        <planeGeometry args={[width, len]} />
        <meshLambertMaterial color={0x333340} />
      </mesh>
      {Array.from({ length: stripeCount }, (_, i) => {
        const along = (i + 0.5) * period - len / 2;
        if (Math.abs(along) > len / 2 - dashLength / 2) return null;
        return (
          <mesh key={`stripe-${i}`} position={[0, along, 0.01]}>
            <boxGeometry args={[0.2, dashLength, 0.02]} />
            <meshBasicMaterial color={0xffee44} />
          </mesh>
        );
      })}
      <mesh position={[width / 2 + 0.15, 0.02, 0]}>
        <planeGeometry args={[0.2, len]} />
        <meshBasicMaterial color={0xffffff} />
      </mesh>
      <mesh position={[-width / 2 - 0.15, 0.02, 0]}>
        <planeGeometry args={[0.2, len]} />
        <meshBasicMaterial color={0xffffff} />
      </mesh>
    </group>
  );
}

// ─── Interaction controller ───────────────────────────────────────────────────
interface ICProps {
  trees: TreeData[];
  placedObjects: PlacedObject[];
  nexusPos: [number,number,number];
  meridianPos: [number,number,number];
  troothhertzPos: [number,number,number];
  stadiumPos: [number,number,number];
  veritasPos: [number,number,number];
  isEditorMode: boolean;
  onSelectTree: (id: number | null) => void;
  onMoveTree: (id: number, pos: [number,number,number], saveHistory?: boolean) => void;
  onSelectObject: (id: string | null) => void;
  onMoveObject: (id: string, pos: [number,number,number], saveHistory?: boolean) => void;
  onMoveNexus: (pos: [number,number,number], saveHistory?: boolean) => void;
  onMoveMeridian: (pos: [number,number,number], saveHistory?: boolean) => void;
  onMoveTroothhertz: (pos: [number,number,number], saveHistory?: boolean) => void;
  onMoveStadium: (pos: [number,number,number], saveHistory?: boolean) => void;
  onMoveVeritas: (pos: [number,number,number], saveHistory?: boolean) => void;
  orbitRef: React.RefObject<any>;
}

function InteractionController(props: ICProps) {
  const { camera, gl } = useThree();
  const ray = useRef(new THREE.Raycaster());
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0,1,0), 0));
  const pt = useRef(new THREE.Vector3());
  const ndc = useRef(new THREE.Vector2());
  const dragging = useRef<
    | { kind: "tree"; id: number }
    | { kind: "object"; id: string }
    | { kind: "nexus" }
    | { kind: "meridian" }
    | { kind: "troothhertz" }
    | { kind: "stadium" }
    | { kind: "veritas" }
    | null
  >(null);
  const dragStartedRef = useRef(false);

  const getNDC = (e: PointerEvent) => {
    const r = gl.domElement.getBoundingClientRect();
    ndc.current.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
    return ndc.current;
  };

  // Object size mapping for more precise hit detection
  const getObjectHitRadius = (type: string): number => {
    switch (type) {
      case "street": return 3;
      case "sidewalk": return 2.5;
      case "parkinglot": return 4;
      case "lake": return 5;
      case "pond": return 3;
      case "bench": return 1;
      case "lightpost": return 0.8;
      default: return 2;
    }
  };

  const hitTree = (e: PointerEvent) => {
    ray.current.setFromCamera(getNDC(e), camera);
    let best: { id: number; dist: number } | null = null;
    for (const t of props.trees) {
      const c = new THREE.Vector3(...t.pos).addScaledVector(new THREE.Vector3(0,1,0), 1.5*t.scale);
      // Reduced radius for more precise selection
      const s = new THREE.Sphere(c, 0.8*t.scale);
      if (ray.current.ray.intersectsSphere(s)) {
        const d = ray.current.ray.origin.distanceTo(c);
        if (!best || d < best.dist) best = { id: t.id, dist: d };
      }
    }
    return best?.id ?? null;
  };

  const hitObject = (e: PointerEvent) => {
    ray.current.setFromCamera(getNDC(e), camera);
    let best: { id: string; dist: number } | null = null;
    for (const obj of props.placedObjects) {
      const c = new THREE.Vector3(...obj.position).add(new THREE.Vector3(0, 0.5, 0));
      // Use type-specific hit radius for more precise selection
      const radius = getObjectHitRadius(obj.type);
      const s = new THREE.Sphere(c, radius);
      if (ray.current.ray.intersectsSphere(s)) {
        const d = ray.current.ray.origin.distanceTo(c);
        if (!best || d < best.dist) best = { id: obj.id, dist: d };
      }
    }
    return best?.id ?? null;
  };

  const hitBuilding = (e: PointerEvent, pos: [number,number,number], radius: number) => {
    ray.current.setFromCamera(getNDC(e), camera);
    // Use center of building footprint, not elevated
    const c = new THREE.Vector3(...pos).add(new THREE.Vector3(0, 5, 0));
    return ray.current.ray.intersectsSphere(new THREE.Sphere(c, radius));
  };

  useEffect(() => {
    if (!props.isEditorMode) return;
    const el = gl.domElement;

    const onDown = (e: PointerEvent) => {
      dragStartedRef.current = false;
      const treeHit = hitTree(e);
      if (treeHit !== null) {
        props.onSelectTree(treeHit);
        props.onSelectObject(null);
        dragging.current = { kind: "tree", id: treeHit };
        if (props.orbitRef.current) props.orbitRef.current.enabled = false;
        el.setPointerCapture(e.pointerId);
        return;
      }
      const objHit = hitObject(e);
      if (objHit !== null) {
        props.onSelectObject(objHit);
        props.onSelectTree(null);
        dragging.current = { kind: "object", id: objHit };
        if (props.orbitRef.current) props.orbitRef.current.enabled = false;
        el.setPointerCapture(e.pointerId);
        return;
      }
      // Reduced building hit radii for more precise selection
      if (hitBuilding(e, props.nexusPos, 8)) {
        dragging.current = { kind: "nexus" };
        if (props.orbitRef.current) props.orbitRef.current.enabled = false;
        el.setPointerCapture(e.pointerId);
        return;
      }
      if (hitBuilding(e, props.meridianPos, 10)) {
        dragging.current = { kind: "meridian" };
        if (props.orbitRef.current) props.orbitRef.current.enabled = false;
        el.setPointerCapture(e.pointerId);
        return;
      }
      if (hitBuilding(e, props.troothhertzPos, 8)) {
        dragging.current = { kind: "troothhertz" };
        if (props.orbitRef.current) props.orbitRef.current.enabled = false;
        el.setPointerCapture(e.pointerId);
        return;
      }
      if (hitBuilding(e, props.stadiumPos, 15)) {
        dragging.current = { kind: "stadium" };
        if (props.orbitRef.current) props.orbitRef.current.enabled = false;
        el.setPointerCapture(e.pointerId);
        return;
      }
      if (hitBuilding(e, props.veritasPos, 18)) {
        dragging.current = { kind: "veritas" };
        if (props.orbitRef.current) props.orbitRef.current.enabled = false;
        el.setPointerCapture(e.pointerId);
        return;
      }
      props.onSelectTree(null);
      props.onSelectObject(null);
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      ray.current.setFromCamera(getNDC(e), camera);
      if (!ray.current.ray.intersectPlane(dragPlane.current, pt.current)) return;
      const x = pt.current.x, z = pt.current.z;
      const shouldSaveHistory = !dragStartedRef.current;
      dragStartedRef.current = true;
      if (dragging.current.kind === "tree") {
        props.onMoveTree(dragging.current.id, [x, terrainHeight(x, z), z], shouldSaveHistory);
      } else if (dragging.current.kind === "object") {
        props.onMoveObject(dragging.current.id, [x, 0, z], shouldSaveHistory);
      } else if (dragging.current.kind === "nexus") {
        props.onMoveNexus([x, 0, z], shouldSaveHistory);
      } else if (dragging.current.kind === "meridian") {
        props.onMoveMeridian([x, 0, z], shouldSaveHistory);
      } else if (dragging.current.kind === "troothhertz") {
        props.onMoveTroothhertz([x, 0, z], shouldSaveHistory);
      } else if (dragging.current.kind === "stadium") {
        props.onMoveStadium([x, 0, z], shouldSaveHistory);
      } else if (dragging.current.kind === "veritas") {
        props.onMoveVeritas([x, 0, z], shouldSaveHistory);
      }
    };

    const onUp = () => {
      if (dragging.current) {
        dragging.current = null;
        if (props.orbitRef.current) props.orbitRef.current.enabled = true;
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
    };
  }, [props.isEditorMode, props.trees, props.placedObjects, props.nexusPos, props.meridianPos, props.troothhertzPos, props.stadiumPos, props.veritasPos, camera, gl, props]);

  return null;
}

// ─── Collision Boxes for buildings ────────────────────────────────────────────
// TROOTHHERTZ LLC Building dimensions (from TroothhertzTower.tsx)
const TROOTHHERTZ_W = 14;  // Width
const TROOTHHERTZ_D = 11;  // Depth
const WALL_THICKNESS = 0.3;
const DESK_WIDTH = 1.2;
const DESK_DEPTH = 0.7;

function getTroothhertzCollisionBoxes(
  buildingPos: [number, number, number],
  floor: number
): CollisionBox[] {
  const bx = buildingPos[0];
  const bz = buildingPos[2];
  const halfW = TROOTHHERTZ_W / 2;
  const halfD = TROOTHHERTZ_D / 2;
  
  // Common walls for all floors (exterior walls)
  const walls: CollisionBox[] = [
    // Back wall (far -Z side)
    { minX: bx - halfW, maxX: bx + halfW, minZ: bz - halfD - WALL_THICKNESS, maxZ: bz - halfD },
    // Left wall (-X side)
    { minX: bx - halfW - WALL_THICKNESS, maxX: bx - halfW, minZ: bz - halfD, maxZ: bz + halfD },
    // Right wall (+X side)
    { minX: bx + halfW, maxX: bx + halfW + WALL_THICKNESS, minZ: bz - halfD, maxZ: bz + halfD },
    // Front wall (+Z side) - with opening for elevator/entrance
    // Left section of front wall
    { minX: bx - halfW, maxX: bx + 3.5, minZ: bz + halfD, maxZ: bz + halfD + WALL_THICKNESS },
    // Right section of front wall (past elevator)
    { minX: bx + 6.5, maxX: bx + halfW, minZ: bz + halfD, maxZ: bz + halfD + WALL_THICKNESS },
  ];
  
  // Floor-specific obstacles
  if (floor === 0) {
    // Lobby floor - add reception desk collision
    // Reception desk is at [0, 0, -2.5] relative to building, with dimensions [4.5, 1.1, 1.0]
    const receptionDeskX = bx;
    const receptionDeskZ = bz - 2.5;
    walls.push({
      minX: receptionDeskX - 2.25,  // Half of 4.5 width
      maxX: receptionDeskX + 2.25,
      minZ: receptionDeskZ - 0.5,   // Half of 1.0 depth
      maxZ: receptionDeskZ + 0.5,
    });
    
    // Add Evaana's position as a small collision zone
    // Evaana (StandingReceptionist) is at [0, 0, -3.2] relative to lobby
    const evaanaX = bx;
    const evaanaZ = bz - 3.2;
    walls.push({
      minX: evaanaX - 0.3,
      maxX: evaanaX + 0.3,
      minZ: evaanaZ - 0.3,
      maxZ: evaanaZ + 0.3,
    });
  } else if (floor === 1) {
    // Executive floor - add CEO desk collision
    // CEO TroothSeatedAgent is at position [bx, y, bz - 2.5]
    // Desk within TroothSeatedAgent is at relative position [0, 0.72, -0.55]
    // So absolute desk position is [bx, y, (bz - 2.5) + (-0.55)] = [bx, y, bz - 3.05]
    const deskX = bx;
    const deskZ = bz - 2.5 - 0.55; // CEO Z position + desk relative offset
    walls.push({
      minX: deskX - DESK_WIDTH / 2,
      maxX: deskX + DESK_WIDTH / 2,
      minZ: deskZ - DESK_DEPTH / 2,
      maxZ: deskZ + DESK_DEPTH / 2,
    });
    
    // Add the CEO's chair as a collision object too
    // Chair is at same XZ as CEO: [bx, y, bz - 2.5]
    const chairX = bx;
    const chairZ = bz - 2.5;
    walls.push({
      minX: chairX - 0.4,
      maxX: chairX + 0.4,
      minZ: chairZ - 0.4,
      maxZ: chairZ + 0.4,
    });
  }
  
  return walls;
}

function getNexusCollisionBoxes(
  buildingPos: [number, number, number],
  _floor: number
): CollisionBox[] {
  const bx = buildingPos[0];
  const bz = buildingPos[2];
  const halfW = 5.5;  // Nexus building half-width
  const halfD = 5.0;  // Nexus building half-depth
  
  return [
    // Back wall
    { minX: bx - halfW, maxX: bx + halfW, minZ: bz - halfD - WALL_THICKNESS, maxZ: bz - halfD },
    // Left wall
    { minX: bx - halfW - WALL_THICKNESS, maxX: bx - halfW, minZ: bz - halfD, maxZ: bz + halfD },
    // Right wall
    { minX: bx + halfW, maxX: bx + halfW + WALL_THICKNESS, minZ: bz - halfD, maxZ: bz + halfD },
    // Front wall sections
    { minX: bx - halfW, maxX: bx + 4.0, minZ: bz + halfD, maxZ: bz + halfD + WALL_THICKNESS },
    { minX: bx + 6.5, maxX: bx + halfW, minZ: bz + halfD, maxZ: bz + halfD + WALL_THICKNESS },
  ];
}

// Stage area — non-hosts cannot enter (blocks Conference/Seminar/Concert)
function getStadiumCollisionBoxes(stadiumPos: [number, number, number], isHost: boolean): CollisionBox[] {
  if (isHost) return [];
  const [sx, , sz] = stadiumPos;
  return [{ minX: sx - 6, maxX: sx + 6, minZ: sz - 5, maxZ: sz + 5 }];
}

function getMeridianCollisionBoxes(
  buildingPos: [number, number, number],
  _floor: number
): CollisionBox[] {
  const bx = buildingPos[0];
  const bz = buildingPos[2];
  const halfW = 6.5;  // Meridian building half-width
  const halfD = 6.0;  // Meridian building half-depth
  
  return [
    // Back wall
    { minX: bx - halfW, maxX: bx + halfW, minZ: bz - halfD - WALL_THICKNESS, maxZ: bz - halfD },
    // Left wall
    { minX: bx - halfW - WALL_THICKNESS, maxX: bx - halfW, minZ: bz - halfD, maxZ: bz + halfD },
    // Right wall
    { minX: bx + halfW, maxX: bx + halfW + WALL_THICKNESS, minZ: bz - halfD, maxZ: bz + halfD },
    // Front wall sections
    { minX: bx - halfW, maxX: bx + 5.0, minZ: bz + halfD, maxZ: bz + halfD + WALL_THICKNESS },
    { minX: bx + 7.5, maxX: bx + halfW, minZ: bz + halfD, maxZ: bz + halfD + WALL_THICKNESS },
  ];
}

// ─── Scene ────────────────────────────────────────────────────────────────────
interface SceneProps {
  trees: TreeData[];
  placedObjects: PlacedObject[];
  selectedTreeId: number | null;
  selectedObjectId: string | null;
  nexusPos: [number,number,number];
  meridianPos: [number,number,number];
  troothhertzPos: [number,number,number];
  stadiumPos: [number,number,number];
  stadiumScale: number;
  veritasPos: [number,number,number];
  nexusSelected: boolean;
  meridianSelected: boolean;
  troothhertzSelected: boolean;
  stadiumSelected: boolean;
  veritasSelected: boolean;
  nexusElevatorFloor: number;
  meridianElevatorFloor: number;
  troothhertzElevatorFloor: number;
  isEditorMode: boolean;
  onSelectTree: (id: number | null) => void;
  onMoveTree: (id: number, pos: [number,number,number], saveHistory?: boolean) => void;
  onSelectObject: (id: string | null) => void;
  onMoveObject: (id: string, pos: [number,number,number], saveHistory?: boolean) => void;
  onSelectNexus: () => void;
  onSelectMeridian: () => void;
  onSelectTroothhertz: () => void;
  onSelectStadium: () => void;
  onSelectVeritas: () => void;
  onViewNexusAgents: () => void;
  onEnterNexus: () => void;
  onViewMeridianAgents: () => void;
  onEnterMeridian: () => void;
  onViewTroothhertzAgents: () => void;
  onEnterTroothhertz: () => void;
  onEnterStadium: () => void;
  onMoveNexus: (pos: [number,number,number], saveHistory?: boolean) => void;
  onMoveMeridian: (pos: [number,number,number], saveHistory?: boolean) => void;
  onMoveTroothhertz: (pos: [number,number,number], saveHistory?: boolean) => void;
  onMoveStadium: (pos: [number,number,number], saveHistory?: boolean) => void;
  onMoveVeritas: (pos: [number,number,number], saveHistory?: boolean) => void;
  onAgentClick: (agent: AgentData) => void;
  wavingAgentId: string | null;
  cameraState: CameraState;
  buildingTarget: BuildingTarget | null;
  plainTarget: PlainTarget | null;
  onEnterPlain: (name: string, position: [number, number, number]) => void;
  onCameraArrived: () => void;
  onCameraExited: () => void;
  nexusElevatorPadOpen: boolean;
  meridianElevatorPadOpen: boolean;
  troothhertzElevatorPadOpen: boolean;
  troothhertzElevatorUnlocked: boolean;
  onToggleNexusElevatorPad: () => void;
  onToggleMeridianElevatorPad: () => void;
  onToggleTroothhertzElevatorPad: () => void;
  onNexusFloorChange: (floor: number) => void;
  onMeridianFloorChange: (floor: number) => void;
  onTroothhertzFloorChange: (floor: number) => void;
  insideBuilding: "nexus" | "meridian" | "troothhertz" | "stadium" | null;
  targetFloorY: number | undefined;
  freeLook: boolean;
  onFreeLookChange: (v: boolean) => void;
  onHoverAgent: (info: HoveredAgentInfo | null) => void;
  onTroothhertzAgentChat: (agent: { id: string; name: string; role: string; floor: number; department: string; greeting: string }) => void;
  onTroothhertzElevatorAccessDenied: () => void;
  onTroothhertzElevatorCallWhileLocked: () => void;
  troothhertzElevatorState: import("@/components/green-terrain/FunctionalElevator").ElevatorState | null;
  onTroothhertzElevatorStateChange: (state: import("@/components/green-terrain/FunctionalElevator").ElevatorState) => void;
  playerNearTroothhertzElevator: boolean;
  onPlayerNearTroothhertzElevatorChange: (near: boolean) => void;
  collisionBoxes: import("@/components/green-terrain/FirstPersonControls").CollisionBox[];
  snapToPosition: [number, number, number] | null;
  onSnapComplete: () => void;
  worldFirstPerson: boolean;
  worldFreeLook: boolean;
  onWorldFreeLookChange: (v: boolean) => void;
}

function Scene(props: SceneProps) {
  const orbitRef = useRef<any>(null);
  const { camera } = useThree();
  
  // Snap camera to position when a new object is placed
  useEffect(() => {
    if (props.snapToPosition && orbitRef.current) {
      const [x, y, z] = props.snapToPosition;
      
      // Set the orbit controls target to the object position
      orbitRef.current.target.set(x, y + 2, z);
      
      // Position camera at a good viewing angle above and behind the object
      camera.position.set(x + 15, y + 20, z + 25);
      
      // Update the controls
      orbitRef.current.update();
      
      // Notify that snap is complete
      props.onSnapComplete();
    }
  }, [props.snapToPosition, camera, props.onSnapComplete]);
  
  return (
    <>
      <CameraController
        state={props.cameraState}
        buildingTarget={props.buildingTarget}
        plainTarget={props.plainTarget}
        onArrived={props.onCameraArrived}
        onExited={props.onCameraExited}
        orbitRef={orbitRef}
      />
      <ambientLight intensity={0.6} color={0xd4e8c0}/>
      <directionalLight position={[60,80,40]} intensity={1.8} color={0xfff4d0} castShadow
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-camera-near={0.5} shadow-camera-far={300}
        shadow-camera-left={-120} shadow-camera-right={120}
        shadow-camera-top={120} shadow-camera-bottom={-120}/>
      <directionalLight position={[-40,30,-60]} intensity={0.4} color={0xa0c8e0}/>
      <hemisphereLight color={0x87ceeb} groundColor={0x3a6b2a} intensity={0.5}/>
      <fog attach="fog" args={["#8ecae6",100,240]}/>
      <SkyDome/>
      <Clouds/>
      <DistantHills/>
      <Terrain stadiumPos={props.stadiumPos} />
      {/* Plain labels — TROO CENTER and cardinal plains */}
      <PlainLabel position={[0, 0, 20]} name="TROO CENTER" />
      <PlainLabel position={[0, 0, -95]} name="TROO NORTH" />
      <PlainLabel position={[0, 0, 95]} name="TROO SOUTH" />
      <PlainLabel position={[95, 0, 0]} name="TROO EAST" />
      <PlainLabel position={[-95, 0, 0]} name="TROO WEST" />
      {/* Bridges connecting TROO CENTER to N/S/E/W plains */}
      <Bridge start={[0, 0, 0]} end={[0, 0, -95]} />
      <Bridge start={[0, 0, 0]} end={[0, 0, 95]} />
      <Bridge start={[0, 0, 0]} end={[95, 0, 0]} />
      <Bridge start={[0, 0, 0]} end={[-95, 0, 0]} />
      {/* Bridge HUDs — direction name + Enter (fly to plain center) */}
      <BridgePlainHUD position={[0, 0, -65]} name="TROO NORTH" onEnter={() => props.onEnterPlain("TROO NORTH", [0, 0, -95])} />
      <BridgePlainHUD position={[0, 0, 65]} name="TROO SOUTH" onEnter={() => props.onEnterPlain("TROO SOUTH", [0, 0, 95])} />
      <BridgePlainHUD position={[65, 0, 0]} name="TROO EAST" onEnter={() => props.onEnterPlain("TROO EAST", [95, 0, 0])} />
      <BridgePlainHUD position={[-65, 0, 0]} name="TROO WEST" onEnter={() => props.onEnterPlain("TROO WEST", [-95, 0, 0])} />
      <GrassTufts/>
      <Rocks/>

      {props.trees.map(t => <Tree key={t.id} data={t} isSelected={t.id === props.selectedTreeId}/>)}

      {props.placedObjects.map(obj => (
        <WorldObjectRenderer
          key={obj.id}
          type={obj.type}
          position={obj.position}
          rotation={obj.rotation}
          isSelected={obj.id === props.selectedObjectId}
          onSelect={() => props.onSelectObject(obj.id)}
        />
      ))}

      <Suspense fallback={null}>
        <CorporateBuilding
          position={props.nexusPos}
          onSelect={props.onSelectNexus}
          isSelected={props.nexusSelected}
          currentElevatorFloor={props.nexusElevatorFloor}
        />
      </Suspense>
      <NexusLabel
        position={props.nexusPos}
        isSelected={props.nexusSelected}
        onSelect={props.onSelectNexus}
        onViewAgents={props.onViewNexusAgents}
        onEnter={props.onEnterNexus}
      />

      <Suspense fallback={null}>
        <MeridianTower
          position={props.meridianPos}
          isSelected={props.meridianSelected}
          isEditorMode={props.isEditorMode}
          onSelect={props.onSelectMeridian}
          onShowInfo={props.onSelectMeridian}
          elevatorFloor={props.meridianElevatorFloor}
        />
      </Suspense>
      <MeridianLabel
        position={props.meridianPos}
        isSelected={props.meridianSelected}
        onSelect={props.onSelectMeridian}
        onViewAgents={props.onViewMeridianAgents}
        onEnter={props.onEnterMeridian}
      />

      <Suspense fallback={null}>
        <TroothhertzTower
          position={props.troothhertzPos}
          isSelected={props.troothhertzSelected}
          onSelect={props.onSelectTroothhertz}
          onEnterBuilding={props.onEnterTroothhertz}
          onViewAgents={props.onViewTroothhertzAgents}
          onAgentChat={props.onTroothhertzAgentChat}
          currentFloor={props.troothhertzElevatorFloor}
          onFloorChange={props.onTroothhertzFloorChange}
          elevatorUnlocked={props.troothhertzElevatorUnlocked}
          showElevatorPad={props.troothhertzElevatorPadOpen}
          onToggleElevatorPad={props.onToggleTroothhertzElevatorPad}
          wavingAgentId={props.wavingAgentId}
          insideBuilding={props.insideBuilding === "troothhertz"}
          onElevatorAccessDenied={props.onTroothhertzElevatorAccessDenied}
          onElevatorCallWhileLocked={props.onTroothhertzElevatorCallWhileLocked}
          onElevatorStateChange={props.onTroothhertzElevatorStateChange}
          playerNearElevator={props.playerNearTroothhertzElevator}
        />
      </Suspense>

      <Suspense fallback={null}>
        <StadiumElyseum
          position={props.stadiumPos}
          scale={props.stadiumScale}
          isSelected={props.stadiumSelected}
          onSelect={props.onSelectStadium}
          animate={props.insideBuilding === "stadium"}
        />
      </Suspense>
      <StadiumLabel
        position={props.stadiumPos}
        isSelected={props.stadiumSelected}
        onSelect={props.onSelectStadium}
        onEnter={props.onEnterStadium}
      />
      <VeritasSchool
        position={props.veritasPos}
        isSelected={props.veritasSelected}
        onSelect={props.onSelectVeritas}
      />
      <VeritasLabel
        position={props.veritasPos}
        isSelected={props.veritasSelected}
        onSelect={props.onSelectVeritas}
      />

      {props.isEditorMode && (
        <InteractionController
          trees={props.trees}
          placedObjects={props.placedObjects}
          nexusPos={props.nexusPos}
          meridianPos={props.meridianPos}
          troothhertzPos={props.troothhertzPos}
          stadiumPos={props.stadiumPos}
          veritasPos={props.veritasPos}
          isEditorMode={props.isEditorMode}
          onSelectTree={props.onSelectTree}
          onMoveTree={props.onMoveTree}
          onSelectObject={props.onSelectObject}
          onMoveObject={props.onMoveObject}
          onMoveNexus={props.onMoveNexus}
          onMoveMeridian={props.onMoveMeridian}
          onMoveTroothhertz={props.onMoveTroothhertz}
          onMoveStadium={props.onMoveStadium}
          onMoveVeritas={props.onMoveVeritas}
          orbitRef={orbitRef}
        />
      )}

      {/* SeatedAgents on each floor of Nexus (10 floors: Lobby + 9 financial disciplines) */}
      {[0,1,2,3,4,5,6,7,8,9].map(floor => {
        const agents = getAgentsByFloor(floor);
        const floorY = props.nexusPos[1] + 0.5 + floor * 3.2;
        const bx = props.nexusPos[0];
        const bz = props.nexusPos[2];
        return agents.map((agent, idx) => {
          const spacing = 2.2;
          const totalW = (agents.length - 1) * spacing;
          const ax = bx - totalW / 2 + idx * spacing;
          return (
            <SeatedAgent
              key={agent.id}
              agent={agent}
              position={[ax, floorY, bz - 1.5]}
              rotation={0}
              onChat={props.onAgentClick}
              isWaving={props.wavingAgentId === agent.id}
            />
          );
        });
      })}

      {/* SeatedAgents on each floor of Meridian (10 floors) */}
      {[0,1,2,3,4,5,6,7,8,9].map(floor => {
        const agents = getAgentsByFloor(floor);
        const floorY = props.meridianPos[1] + 0.5 + floor * 4.0;
        const bx = props.meridianPos[0];
        const bz = props.meridianPos[2];
        return agents.map((agent, idx) => {
          const spacing = 2.4;
          const totalW = (agents.length - 1) * spacing;
          const ax = bx - totalW / 2 + idx * spacing;
          return (
            <SeatedAgent
              key={`meridian-${agent.id}`}
              agent={agent}
              position={[ax, floorY, bz - 1.5]}
              rotation={0}
              onChat={props.onAgentClick}
              isWaving={props.wavingAgentId === `meridian-${agent.id}`}
            />
          );
        });
      })}

      <FunctionalElevator
        position={[props.nexusPos[0] + 5.5, props.nexusPos[1], props.nexusPos[2] - 3]}
        floors={[
          { label: "Lobby",            y: props.nexusPos[1] + 0.0 },
          { label: "Floor 1 — Currency", y: props.nexusPos[1] + 3.2 },
          { label: "Floor 2 — Finance",  y: props.nexusPos[1] + 6.4 },
          { label: "Floor 3 — Transfer", y: props.nexusPos[1] + 9.6 },
          { label: "Floor 4 — Broker",    y: props.nexusPos[1] + 12.8 },
          { label: "Floor 5 — Compliance", y: props.nexusPos[1] + 16.0 },
          { label: "Floor 6 — Trustee",   y: props.nexusPos[1] + 19.2 },
          { label: "Floor 7 — Custodian", y: props.nexusPos[1] + 22.4 },
          { label: "Floor 8 — Clearing",  y: props.nexusPos[1] + 25.6 },
          { label: "Floor 9 — Architect", y: props.nexusPos[1] + 28.8 },
        ]}
        currentFloor={props.nexusElevatorFloor}
        onFloorChange={props.onNexusFloorChange}
        showPad={props.nexusElevatorPadOpen}
        onTogglePad={props.onToggleNexusElevatorPad}
      />

      <FunctionalElevator
        position={[props.meridianPos[0] + 6.5, props.meridianPos[1], props.meridianPos[2] - 4]}
        floors={[
          { label: "Lobby",            y: props.meridianPos[1] + 0.0 },
          { label: "Floor 1 — Currency", y: props.meridianPos[1] + 4.0 },
          { label: "Floor 2 — Finance",  y: props.meridianPos[1] + 8.0 },
          { label: "Floor 3 — Transfer", y: props.meridianPos[1] + 12.0 },
          { label: "Floor 4 — Broker",   y: props.meridianPos[1] + 16.0 },
          { label: "Floor 5 — Compliance", y: props.meridianPos[1] + 20.0 },
          { label: "Floor 6 — Trustee",   y: props.meridianPos[1] + 24.0 },
          { label: "Floor 7 — Custodian", y: props.meridianPos[1] + 28.0 },
          { label: "Floor 8 — Clearing",  y: props.meridianPos[1] + 32.0 },
          { label: "Floor 9 — Architect", y: props.meridianPos[1] + 36.0 },
        ]}
        currentFloor={props.meridianElevatorFloor}
        onFloorChange={props.onMeridianFloorChange}
        showPad={props.meridianElevatorPadOpen}
        onTogglePad={props.onToggleMeridianElevatorPad}
      />

      <FirstPersonControls
        active={props.cameraState === "inside"}
        bounds={props.insideBuilding === "nexus" ? {
          minX: props.nexusPos[0] - 5.5, maxX: props.nexusPos[0] + 5.5,
          minZ: props.nexusPos[2] - 4.5, maxZ: props.nexusPos[2] + 5.5,
          floorY: props.nexusPos[1] + props.nexusElevatorFloor * 3.2,  // 10 floors, 3.2m each
        } : props.insideBuilding === "meridian" ? {
          minX: props.meridianPos[0] - 6.5, maxX: props.meridianPos[0] + 6.5,
          minZ: props.meridianPos[2] - 5.5, maxZ: props.meridianPos[2] + 6.5,
          floorY: props.meridianPos[1] + props.meridianElevatorFloor * 4.0,
        } : props.insideBuilding === "stadium" ? {
          minX: props.stadiumPos[0] - 50, maxX: props.stadiumPos[0] + 50,
          minZ: props.stadiumPos[2] - 50, maxZ: props.stadiumPos[2] + 50,
          floorY: props.stadiumPos[1],
        } : {
          minX: props.troothhertzPos[0] - 7, maxX: props.troothhertzPos[0] + 7,
          minZ: props.troothhertzPos[2] - 5.5, maxZ: props.troothhertzPos[2] + 5.5,
          floorY: props.troothhertzPos[1] + props.troothhertzElevatorFloor * 4.2,
        }}
        freeLook={props.freeLook}
        onFreeLookChange={props.onFreeLookChange}
        targetFloorY={props.targetFloorY}
        elevatorPos={props.insideBuilding === "nexus"
          ? new THREE.Vector3(props.nexusPos[0] + 5.5, 0, props.nexusPos[2] - 3)
          : props.insideBuilding === "meridian"
          ? new THREE.Vector3(props.meridianPos[0] + 6.5, 0, props.meridianPos[2] - 4)
          : props.insideBuilding === "stadium"
          ? new THREE.Vector3(9999, 0, 9999)
          : new THREE.Vector3(props.troothhertzPos[0] + 5.2, 0, props.troothhertzPos[2] - 3.7)
        }
        onElevatorNear={(near) => {
          if (props.insideBuilding === "stadium") return;
          if (props.insideBuilding === "troothhertz") {
            props.onPlayerNearTroothhertzElevatorChange(near);
            if (near) props.onToggleTroothhertzElevatorPad();
          } else if (props.insideBuilding === "nexus") {
            props.onToggleNexusElevatorPad();
          } else {
            props.onToggleMeridianElevatorPad();
          }
        }}
        onHoverAgent={props.onHoverAgent}
        elevatorState={props.insideBuilding === "troothhertz" ? props.troothhertzElevatorState : null}
        elevatorWorldPos={props.insideBuilding === "troothhertz" 
          ? [props.troothhertzPos[0] + 5.2, props.troothhertzPos[1], props.troothhertzPos[2] - 3.7]
          : undefined
        }
        collisionBoxes={props.collisionBoxes}
      />

      {/* World first-person controls (when in world view and first-person mode enabled) */}
      <WorldFirstPersonControls
        active={props.worldFirstPerson && props.cameraState === "world"}
        freeLook={props.worldFreeLook}
        onFreeLookChange={props.onWorldFreeLookChange}
        terrainBounds={{ minX: -120, maxX: 120, minZ: -120, maxZ: 120 }}
      />

      <OrbitControls
        ref={orbitRef}
        enabled={!props.worldFirstPerson || props.cameraState !== "world"}
        enablePan={!props.worldFirstPerson || props.cameraState !== "world"}
        enableZoom={!props.worldFirstPerson || props.cameraState !== "world"}
        enableRotate={!props.worldFirstPerson || props.cameraState !== "world"}
        minDistance={5} maxDistance={180}
        maxPolarAngle={Math.PI/2-0.05}
        target={[0,0,0]}
        enableDamping={false}
      />
    </>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
// ─── Undo History Types ───────────────────────────────────────────────────────
interface HistoryState {
  trees: TreeData[];
  placedObjects: PlacedObject[];
  nexusPos: [number, number, number];
  meridianPos: [number, number, number];
  troothhertzPos: [number, number, number];
  stadiumPos: [number, number, number];
  veritasPos: [number, number, number];
}

const MAX_UNDO_HISTORY = 50;

function GreenTerrainPageContent() {
  const [trees, setTrees] = useState<TreeData[]>(() => generateInitialTrees());
  const [selectedTreeId, setSelectedTreeId] = useState<number | null>(null);

  const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  const [nexusPos, setNexusPos] = useState<[number,number,number]>([-25, 0, 0]);
  const [meridianPos, setMeridianPos] = useState<[number,number,number]>([25, 0, 0]);
  const [troothhertzPos, setTroothhertzPos] = useState<[number,number,number]>([0, 0, -35]);
  const [stadiumPos, setStadiumPos] = useState<[number,number,number]>([0, 0, 60]);
  const [stadiumScale, setStadiumScale] = useState(1);
  const [veritasPos, setVeritasPos] = useState<[number,number,number]>([-55, 0, 30]);

  // ─── Snap to Grid ───────────────────────────────────────────────────────────
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(5);

  const snapPosition = useCallback((pos: [number, number, number]): [number, number, number] => {
    if (!snapToGrid) return pos;
    return [
      Math.round(pos[0] / gridSize) * gridSize,
      pos[1],
      Math.round(pos[2] / gridSize) * gridSize,
    ];
  }, [snapToGrid, gridSize]);

  // ─── Undo History ───────────────────────────────────────────────────────────
  const [undoHistory, setUndoHistory] = useState<HistoryState[]>([]);
  const [redoHistory, setRedoHistory] = useState<HistoryState[]>([]);
  const isUndoingRef = useRef(false);

  const saveToHistory = useCallback(() => {
    if (isUndoingRef.current) return;
    setUndoHistory(prev => {
      const newHistory = [...prev, {
        trees: JSON.parse(JSON.stringify(trees)),
        placedObjects: JSON.parse(JSON.stringify(placedObjects)),
        nexusPos: [...nexusPos] as [number, number, number],
        meridianPos: [...meridianPos] as [number, number, number],
        troothhertzPos: [...troothhertzPos] as [number, number, number],
        stadiumPos: [...stadiumPos] as [number, number, number],
        veritasPos: [...veritasPos] as [number, number, number],
      }];
      if (newHistory.length > MAX_UNDO_HISTORY) {
        return newHistory.slice(-MAX_UNDO_HISTORY);
      }
      return newHistory;
    });
    setRedoHistory([]);
  }, [trees, placedObjects, nexusPos, meridianPos, troothhertzPos, stadiumPos, veritasPos]);

  const undo = useCallback(() => {
    if (undoHistory.length === 0) return;
    
    isUndoingRef.current = true;
    const currentState: HistoryState = {
      trees: JSON.parse(JSON.stringify(trees)),
      placedObjects: JSON.parse(JSON.stringify(placedObjects)),
      nexusPos: [...nexusPos] as [number, number, number],
      meridianPos: [...meridianPos] as [number, number, number],
      troothhertzPos: [...troothhertzPos] as [number, number, number],
      stadiumPos: [...stadiumPos] as [number, number, number],
      veritasPos: [...veritasPos] as [number, number, number],
    };
    
    const previousState = undoHistory[undoHistory.length - 1];
    setUndoHistory(prev => prev.slice(0, -1));
    setRedoHistory(prev => [...prev, currentState]);
    
    setTrees(previousState.trees);
    setPlacedObjects(previousState.placedObjects);
    setNexusPos(previousState.nexusPos);
    setMeridianPos(previousState.meridianPos);
    setTroothhertzPos(previousState.troothhertzPos);
    setStadiumPos(previousState.stadiumPos ?? [0, 0, 60]);
    setVeritasPos(previousState.veritasPos ?? [-55, 0, 30]);
    
    setTimeout(() => { isUndoingRef.current = false; }, 0);
  }, [undoHistory, trees, placedObjects, nexusPos, meridianPos, troothhertzPos, stadiumPos, veritasPos]);

  const redo = useCallback(() => {
    if (redoHistory.length === 0) return;
    
    isUndoingRef.current = true;
    const currentState: HistoryState = {
      trees: JSON.parse(JSON.stringify(trees)),
      placedObjects: JSON.parse(JSON.stringify(placedObjects)),
      nexusPos: [...nexusPos] as [number, number, number],
      meridianPos: [...meridianPos] as [number, number, number],
      troothhertzPos: [...troothhertzPos] as [number, number, number],
      stadiumPos: [...stadiumPos] as [number, number, number],
      veritasPos: [...veritasPos] as [number, number, number],
    };
    
    const nextState = redoHistory[redoHistory.length - 1];
    setRedoHistory(prev => prev.slice(0, -1));
    setUndoHistory(prev => [...prev, currentState]);
    
    setTrees(nextState.trees);
    setPlacedObjects(nextState.placedObjects);
    setNexusPos(nextState.nexusPos);
    setMeridianPos(nextState.meridianPos);
    setTroothhertzPos(nextState.troothhertzPos);
    setStadiumPos(nextState.stadiumPos ?? [0, 0, 60]);
    setVeritasPos(nextState.veritasPos ?? [-55, 0, 30]);
    
    setTimeout(() => { isUndoingRef.current = false; }, 0);
  }, [redoHistory, trees, placedObjects, nexusPos, meridianPos, troothhertzPos, stadiumPos, veritasPos]);

  // Load placements from database on mount so positions match what was saved
  useEffect(() => {
    async function loadPlacements() {
      try {
        console.log("[GreenTerrain] Loading placements from API...");
        const res = await fetch("/api/troo-world/placements?worldId=default");
        if (res.ok) {
          const data = await res.json();
          const placements = data.placements || [];
          console.log("[GreenTerrain] Received placements:", JSON.stringify(placements, null, 2));
          
          const loadedObjects: PlacedObject[] = [];
          
          for (const p of placements) {
            console.log("[GreenTerrain] Processing placement:", p.elementKey, "at", p.posX, p.posY, p.posZ);
            if (p.elementKey === "nexus-tower") {
              console.log("[GreenTerrain] Setting Nexus position:", [p.posX, p.posY, p.posZ]);
              setNexusPos([p.posX, p.posY, p.posZ]);
            } else if (p.elementKey === "meridian-tower") {
              console.log("[GreenTerrain] Setting Meridian position:", [p.posX, p.posY, p.posZ]);
              setMeridianPos([p.posX, p.posY, p.posZ]);
            } else if (p.elementKey === "troothhertz-tower") {
              console.log("[GreenTerrain] Setting Troothhertz position:", [p.posX, p.posY, p.posZ]);
              setTroothhertzPos([p.posX, p.posY, p.posZ]);
            } else if (p.elementKey === "stadium-elyseum") {
              console.log("[GreenTerrain] Setting Stadium Elyseum position:", [p.posX, p.posY, p.posZ], "scale:", p.scale);
              setStadiumPos([p.posX, p.posY, p.posZ]);
              if (typeof p.scale === "number" && p.scale > 0) setStadiumScale(p.scale);
            } else if (p.elementKey === "veritas-school") {
              console.log("[GreenTerrain] Setting Veritas School position:", [p.posX, p.posY, p.posZ]);
              setVeritasPos([p.posX, p.posY, p.posZ]);
            } else {
              // Check if it's an environment object (e.g., "street-0", "lake-2", etc.)
              const objectTypes = ["street", "sidewalk", "lake", "pond", "bench", "lightpost", "parkinglot"];
              const baseType = objectTypes.find(t => p.elementKey === t || p.elementKey.startsWith(`${t}-`));
              console.log("[GreenTerrain] Environment object check:", p.elementKey, "-> baseType:", baseType);
              if (baseType) {
                const newObj = {
                  id: `${p.elementKey}-${p.id || Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  type: baseType as WorldObjectType,
                  position: [p.posX, p.posY, p.posZ] as [number, number, number],
                  rotation: [0, p.rotY || 0, 0] as [number, number, number],
                };
                console.log("[GreenTerrain] Adding loaded object:", newObj);
                loadedObjects.push(newObj);
              }
            }
          }
          
          console.log("[GreenTerrain] Total loaded objects:", loadedObjects.length);
          // Always set placedObjects, even if empty (to reflect deletions)
          setPlacedObjects(loadedObjects);
        } else {
          console.error("[GreenTerrain] Failed to fetch placements:", res.status);
        }
      } catch (err) {
        console.error("[GreenTerrain] Failed to load placements:", err);
      }
    }
    loadPlacements();
  }, []);

  const [nexusSelected, setNexusSelected] = useState(false);
  const [meridianSelected, setMeridianSelected] = useState(false);
  const [troothhertzSelected, setTroothhertzSelected] = useState(false);
  const [stadiumSelected, setStadiumSelected] = useState(false);
  const [veritasSelected, setVeritasSelected] = useState(false);
  const [showNexusPanel, setShowNexusPanel] = useState(false);
  const [showMeridianPanel, setShowMeridianPanel] = useState(false);
  const [showTroothhertzPanel, setShowTroothhertzPanel] = useState(false);
  const [nexusElevatorFloor, setNexusElevatorFloor] = useState(0);
  const [meridianElevatorFloor, setMeridianElevatorFloor] = useState(0);
  const [troothhertzElevatorFloor, setTroothhertzElevatorFloor] = useState(0);

  const [isEditorMode, setIsEditorMode] = useState(false);
  const [snapToPosition, setSnapToPosition] = useState<[number, number, number] | null>(null);
  const [currentWorldId, setCurrentWorldId] = useState("green-terrain");

  const [chatActiveAgent, setChatActiveAgent] = useState<AgentData | null>(null);
  const [wavingAgentId, setWavingAgentId] = useState<string | null>(null);

  const [nexusElevatorPadOpen, setNexusElevatorPadOpen] = useState(false);
  const [meridianElevatorPadOpen, setMeridianElevatorPadOpen] = useState(false);
  const [troothhertzElevatorPadOpen, setTroothhertzElevatorPadOpen] = useState(false);
  const [troothhertzElevatorUnlocked, setTroothhertzElevatorUnlocked] = useState(false);
  const [troothhertzElevatorState, setTroothhertzElevatorState] = useState<import("@/components/green-terrain/FunctionalElevator").ElevatorState | null>(null);
  const [playerNearTroothhertzElevator, setPlayerNearTroothhertzElevator] = useState(false);

  const [targetFloorY, setTargetFloorY] = useState<number | undefined>(undefined);

  const [cameraState, setCameraState] = useState<CameraState>("world");
  const [buildingTarget, setBuildingTarget] = useState<BuildingTarget | null>(null);
  const [plainTarget, setPlainTarget] = useState<PlainTarget | null>(null);
  const [insideBuilding, setInsideBuilding] = useState<"nexus" | "meridian" | "troothhertz" | "stadium" | null>(null);

  const [freeLook, setFreeLook] = useState(false);
  const [hoveredAgent, setHoveredAgent] = useState<HoveredAgentInfo | null>(null);
  const [worldFirstPerson, setWorldFirstPerson] = useState(false);
  const [worldFreeLook, setWorldFreeLook] = useState(false);

  const handleAgentClick = useCallback((agent: AgentData) => {
    setChatActiveAgent(agent);
  }, []);

  // Troothhertz-specific handlers
  const [elevatorAccessDeniedMessage, setElevatorAccessDeniedMessage] = useState<string | null>(null);

  const handleTroothhertzAgentChat = useCallback((agent: { id: string; name: string; role: string; floor: number; department: string; greeting: string }) => {
    const agentData: AgentData = {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      floor: agent.floor,
      department: agent.department,
      greeting: agent.greeting,
      expertise: agent.id === "troothhertz-evaana" 
        ? "Visitor screening, access control, executive scheduling, gatekeeper protocols"
        : "Company vision, strategic partnerships, business development, executive decisions",
      title: agent.id === "troothhertz-evaana" ? "Head Receptionist" : "President & CEO",
      avatarEmoji: agent.id === "troothhertz-evaana" ? "👩‍💼" : "👑",
      worldId: "green-terrain",
      buildingId: "troothhertz-tower",
    };
    setChatActiveAgent(agentData);
  }, []);

  const handleTroothhertzElevatorAccessDenied = useCallback(() => {
    setElevatorAccessDeniedMessage("Access denied. Please speak with Evaana to gain elevator access.");
    setTimeout(() => setElevatorAccessDeniedMessage(null), 3000);
  }, []);

  const handleTroothhertzElevatorCallWhileLocked = useCallback(() => {
    const evaana = TROOTHHERTZ_AGENTS[0];
    const agentData: AgentData = {
      id: evaana.id,
      name: evaana.name,
      role: evaana.role,
      floor: evaana.floor,
      department: evaana.department,
      greeting: "I noticed you're trying to use the elevator. Before I can grant you access to the executive floor, I need to verify your identity and purpose. Let me ask you a few questions.",
      expertise: "Visitor screening, access control, executive scheduling, gatekeeper protocols",
      title: "Head Receptionist",
      avatarEmoji: "👩‍💼",
      worldId: "green-terrain",
      buildingId: "troothhertz-tower",
    };
    setChatActiveAgent(agentData);
  }, []);

  const handleEnterNexus = useCallback(() => {
    setBuildingTarget({
      position: new THREE.Vector3(nexusPos[0], nexusPos[1] + 1.7, nexusPos[2] + 4),
      lookAt: new THREE.Vector3(nexusPos[0], nexusPos[1] + 1.7, nexusPos[2] - 2),
    });
    setInsideBuilding("nexus");
    setCameraState("flying-in");
    setNexusSelected(true);
    setMeridianSelected(false);
    setTroothhertzSelected(false);
  }, [nexusPos]);

  const handleEnterMeridian = useCallback(() => {
    setBuildingTarget({
      position: new THREE.Vector3(meridianPos[0], meridianPos[1] + 1.7, meridianPos[2] + 5),
      lookAt: new THREE.Vector3(meridianPos[0], meridianPos[1] + 1.7, meridianPos[2] - 3),
    });
    setInsideBuilding("meridian");
    setCameraState("flying-in");
    setMeridianSelected(true);
    setNexusSelected(false);
    setTroothhertzSelected(false);
  }, [meridianPos]);

  const handleEnterTroothhertz = useCallback(() => {
    console.log("[handleEnterTroothhertz] troothhertzPos:", troothhertzPos);
    console.log("[handleEnterTroothhertz] Camera target:", {
      position: [troothhertzPos[0], troothhertzPos[1] + 1.7, troothhertzPos[2] + 5],
      lookAt: [troothhertzPos[0], troothhertzPos[1] + 1.7, troothhertzPos[2] - 3],
    });
    setBuildingTarget({
      position: new THREE.Vector3(troothhertzPos[0], troothhertzPos[1] + 1.7, troothhertzPos[2] + 5),
      lookAt: new THREE.Vector3(troothhertzPos[0], troothhertzPos[1] + 1.7, troothhertzPos[2] - 3),
    });
    setInsideBuilding("troothhertz");
    setCameraState("flying-in");
    setTroothhertzSelected(true);
    setNexusSelected(false);
    setMeridianSelected(false);
  }, [troothhertzPos]);

  const handleEnterStadium = useCallback(() => {
    // Spawn inside stadium, in audience area, facing the stage (center)
    setBuildingTarget({
      position: new THREE.Vector3(stadiumPos[0], stadiumPos[1] + 1.7, stadiumPos[2] + 15),
      lookAt: new THREE.Vector3(stadiumPos[0], stadiumPos[1] + 1, stadiumPos[2]),
    });
    setInsideBuilding("stadium");
    setCameraState("flying-in");
    setStadiumSelected(true);
    setNexusSelected(false);
    setMeridianSelected(false);
    setTroothhertzSelected(false);
  }, [stadiumPos]);

  const handleEnterPlain = useCallback((_name: string, position: [number, number, number]) => {
    if (cameraState === "inside" || cameraState === "flying-in" || cameraState === "flying-out") return;
    setBuildingTarget(null);
    // Fly to plain center — camera above plain center, looking slightly outward
    const [px, , pz] = position;
    const lookOffset = 15;
    const lookZ = pz !== 0 ? pz + (pz > 0 ? lookOffset : -lookOffset) : lookOffset;
    const lookX = px !== 0 ? px + (px > 0 ? lookOffset : -lookOffset) : 0;
    setPlainTarget({
      position: new THREE.Vector3(px, 22, pz),
      lookAt: new THREE.Vector3(lookX, 0, lookZ),
    });
    setCameraState("flying-in");
  }, [cameraState]);

  const handleCameraArrived = useCallback(() => {
    if (plainTarget) {
      setPlainTarget(null);
      setCameraState("world");
    } else {
      setCameraState("inside");
    }
  }, [plainTarget]);

  const handleCameraExited = useCallback(() => {
    setCameraState("world");
    setBuildingTarget(null);
    setInsideBuilding(null);
  }, []);

  const handleExitBuilding = useCallback(() => {
    setShowNexusPanel(false);
    setShowMeridianPanel(false);
    setShowTroothhertzPanel(false);
    setNexusSelected(false);
    setMeridianSelected(false);
    setTroothhertzSelected(false);
    setStadiumSelected(false);
    setVeritasSelected(false);
    setCameraState("flying-out");
  }, []);

  const handleViewNexusAgents = useCallback(() => {
    setShowNexusPanel(true);
    setNexusSelected(true);
    setMeridianSelected(false);
    setTroothhertzSelected(false);
  }, []);

  const handleViewMeridianAgents = useCallback(() => {
    setShowMeridianPanel(true);
    setMeridianSelected(true);
    setNexusSelected(false);
    setTroothhertzSelected(false);
  }, []);

  const handleViewTroothhertzAgents = useCallback(() => {
    setShowTroothhertzPanel(true);
    setTroothhertzSelected(true);
    setNexusSelected(false);
    setMeridianSelected(false);
  }, []);

  const handlePlaceObject = useCallback((type: WorldObjectType) => {
    saveToHistory();
    const id = `${type}-${Date.now()}`;
    const offset = placedObjects.filter(o => o.type === type).length;
    const basePos: [number, number, number] = [20 + offset * 6, 0, 20 + offset * 4];
    const snappedPos = snapPosition(basePos);
    setPlacedObjects(prev => [...prev, {
      id, type,
      position: snappedPos,
      rotation: [0, 0, 0],
    }]);
    setSelectedObjectId(id);
    setSelectedTreeId(null);
    setNexusSelected(false);
    setMeridianSelected(false);
    setTroothhertzSelected(false);
    setStadiumSelected(false);
    setVeritasSelected(false);
    // Snap camera to the newly placed object
    setSnapToPosition(snappedPos);
  }, [placedObjects, saveToHistory, snapPosition]);

  const handleSelectTree = useCallback((id: number | null) => {
    setSelectedTreeId(id);
    if (id !== null) { setNexusSelected(false); setMeridianSelected(false); setStadiumSelected(false); setVeritasSelected(false); setSelectedObjectId(null); }
  }, []);

  const handleMoveTree = useCallback((id: number, pos: [number,number,number], saveHistory = false) => {
    if (saveHistory) saveToHistory();
    const snappedPos = snapPosition(pos);
    setTrees(prev => prev.map(t => t.id === id ? { ...t, pos: snappedPos } : t));
  }, [snapPosition, saveToHistory]);

  const handleDeleteTree = useCallback(() => {
    if (selectedTreeId === null) return;
    saveToHistory();
    setTrees(prev => prev.filter(t => t.id !== selectedTreeId));
    setSelectedTreeId(null);
  }, [selectedTreeId, saveToHistory]);

  const handleSelectObject = useCallback((id: string | null) => {
    setSelectedObjectId(id);
    if (id !== null) { setSelectedTreeId(null); setNexusSelected(false); setMeridianSelected(false); setStadiumSelected(false); setVeritasSelected(false); }
  }, []);

  const handleMoveObject = useCallback((id: string, pos: [number,number,number], saveHistory = false) => {
    if (saveHistory) saveToHistory();
    const snappedPos = snapPosition(pos);
    setPlacedObjects(prev => prev.map(o => o.id === id ? { ...o, position: snappedPos } : o));
  }, [snapPosition, saveToHistory]);

  const handleDeleteObject = useCallback(() => {
    if (!selectedObjectId) return;
    saveToHistory();
    setPlacedObjects(prev => prev.filter(o => o.id !== selectedObjectId));
    setSelectedObjectId(null);
  }, [selectedObjectId, saveToHistory]);

  const handleRotateObject = useCallback((delta: number) => {
    if (!selectedObjectId) return;
    setPlacedObjects(prev => prev.map(o =>
      o.id === selectedObjectId
        ? { ...o, rotation: [o.rotation[0], o.rotation[1] + delta, o.rotation[2]] as [number,number,number] }
        : o
    ));
  }, [selectedObjectId]);

  const handleSelectNexus = useCallback(() => {
    setNexusSelected(true);
    setMeridianSelected(false);
    setTroothhertzSelected(false);
    setStadiumSelected(false);
    setVeritasSelected(false);
    setSelectedTreeId(null);
    setSelectedObjectId(null);
    // Only show panel if NOT in editor mode
    if (!isEditorMode) {
      setShowNexusPanel(true);
    }
  }, [isEditorMode]);

  const handleSelectMeridian = useCallback(() => {
    setMeridianSelected(true);
    setNexusSelected(false);
    setTroothhertzSelected(false);
    setStadiumSelected(false);
    setVeritasSelected(false);
    setSelectedTreeId(null);
    setSelectedObjectId(null);
    // Only show panel if NOT in editor mode
    if (!isEditorMode) {
      setShowMeridianPanel(true);
    }
  }, [isEditorMode]);

  const handleSelectTroothhertz = useCallback(() => {
    setTroothhertzSelected(true);
    setNexusSelected(false);
    setMeridianSelected(false);
    setStadiumSelected(false);
    setVeritasSelected(false);
    setSelectedTreeId(null);
    setSelectedObjectId(null);
    // Only show panel if NOT in editor mode
    if (!isEditorMode) {
      setShowTroothhertzPanel(true);
    }
  }, [isEditorMode]);

  const handleSelectStadium = useCallback(() => {
    setStadiumSelected(true);
    setNexusSelected(false);
    setMeridianSelected(false);
    setTroothhertzSelected(false);
    setVeritasSelected(false);
    setSelectedTreeId(null);
    setSelectedObjectId(null);
  }, []);

  const handleSelectVeritas = useCallback(() => {
    setVeritasSelected(true);
    setNexusSelected(false);
    setMeridianSelected(false);
    setTroothhertzSelected(false);
    setStadiumSelected(false);
    setSelectedTreeId(null);
    setSelectedObjectId(null);
  }, []);

  const handleMoveTroothhertz = useCallback((pos: [number,number,number], saveHistory = false) => {
    if (saveHistory) saveToHistory();
    const snappedPos = snapPosition(pos);
    setTroothhertzPos(snappedPos);
  }, [snapPosition, saveToHistory]);

  const handleMoveNexus = useCallback((pos: [number,number,number], saveHistory = false) => {
    if (saveHistory) saveToHistory();
    const snappedPos = snapPosition(pos);
    setNexusPos(snappedPos);
  }, [snapPosition, saveToHistory]);

  const handleMoveMeridian = useCallback((pos: [number,number,number], saveHistory = false) => {
    if (saveHistory) saveToHistory();
    const snappedPos = snapPosition(pos);
    setMeridianPos(snappedPos);
  }, [snapPosition, saveToHistory]);

  const handleMoveStadium = useCallback((pos: [number,number,number], saveHistory = false) => {
    if (saveHistory) saveToHistory();
    const snappedPos = snapPosition(pos);
    setStadiumPos(snappedPos);
  }, [snapPosition, saveToHistory]);

  const handleMoveVeritas = useCallback((pos: [number,number,number], saveHistory = false) => {
    if (saveHistory) saveToHistory();
    const snappedPos = snapPosition(pos);
    setVeritasPos(snappedPos);
  }, [snapPosition, saveToHistory]);

  // Arrow key movement step size (hold Shift for larger steps)
  const MOVE_STEP = 1;
  const MOVE_STEP_LARGE = 5;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedTreeId !== null) handleDeleteTree();
        else if (selectedObjectId !== null) handleDeleteObject();
      }
      if (e.key === "Escape") {
        setSelectedTreeId(null); setSelectedObjectId(null);
        setNexusSelected(false); setMeridianSelected(false); setTroothhertzSelected(false); setStadiumSelected(false); setVeritasSelected(false);
        setShowNexusPanel(false); setShowMeridianPanel(false); setShowTroothhertzPanel(false);
      }
      if (e.key === "q" || e.key === "Q") handleRotateObject(-Math.PI / 8);
      if (e.key === "e" || e.key === "E") handleRotateObject(Math.PI / 8);
      
      // Arrow key movement for selected objects/trees
      const step = e.shiftKey ? MOVE_STEP_LARGE : MOVE_STEP;
      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        
        // Move selected object
        if (selectedObjectId) {
          const obj = placedObjects.find(o => o.id === selectedObjectId);
          if (obj) {
            const [x, y, z] = obj.position;
            let newPos: [number, number, number] = [x, y, z];
            if (e.key === "ArrowUp") newPos = [x, y, z - step];
            if (e.key === "ArrowDown") newPos = [x, y, z + step];
            if (e.key === "ArrowLeft") newPos = [x - step, y, z];
            if (e.key === "ArrowRight") newPos = [x + step, y, z];
            handleMoveObject(selectedObjectId, newPos, true);
          }
        }
        // Move selected tree
        else if (selectedTreeId !== null) {
          const tree = trees.find(t => t.id === selectedTreeId);
          if (tree) {
            const [x, y, z] = tree.pos;
            let newPos: [number, number, number] = [x, y, z];
            if (e.key === "ArrowUp") newPos = [x, y, z - step];
            if (e.key === "ArrowDown") newPos = [x, y, z + step];
            if (e.key === "ArrowLeft") newPos = [x - step, y, z];
            if (e.key === "ArrowRight") newPos = [x + step, y, z];
            handleMoveTree(selectedTreeId, newPos, true);
          }
        }
        // Move stadium
        else if (stadiumSelected) {
          const [x, y, z] = stadiumPos;
          let newPos: [number, number, number] = [x, y, z];
          if (e.key === "ArrowUp") newPos = [x, y, z - step];
          if (e.key === "ArrowDown") newPos = [x, y, z + step];
          if (e.key === "ArrowLeft") newPos = [x - step, y, z];
          if (e.key === "ArrowRight") newPos = [x + step, y, z];
          handleMoveStadium(newPos, true);
        }
        else if (veritasSelected) {
          const [x, y, z] = veritasPos;
          let newPos: [number, number, number] = [x, y, z];
          if (e.key === "ArrowUp") newPos = [x, y, z - step];
          if (e.key === "ArrowDown") newPos = [x, y, z + step];
          if (e.key === "ArrowLeft") newPos = [x - step, y, z];
          if (e.key === "ArrowRight") newPos = [x + step, y, z];
          handleMoveVeritas(newPos, true);
        }
      }
      
      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo: Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && ((e.key === "z" && e.shiftKey) || e.key === "y")) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedTreeId, selectedObjectId, stadiumSelected, stadiumPos, veritasSelected, veritasPos, trees, placedObjects, handleDeleteTree, handleDeleteObject, handleRotateObject, handleMoveTree, handleMoveObject, handleMoveStadium, handleMoveVeritas, undo, redo]);

  const selectedTree = trees.find(t => t.id === selectedTreeId) ?? null;
  const selectedObject = placedObjects.find(o => o.id === selectedObjectId) ?? null;

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#6ab8d4", position: "relative", overflow: "hidden" }}>
      <Canvas
        shadows
        camera={{ position: [0, 28, 65], fov: 55, near: 0.1, far: 500 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        scene={{ background: new THREE.Color("#6ab8d4") }}
        dpr={[1, 2]}
        style={{ position: "absolute", inset: 0 }}
      >
        <Scene
          trees={trees}
          placedObjects={placedObjects}
          selectedTreeId={selectedTreeId}
          selectedObjectId={selectedObjectId}
          nexusPos={nexusPos}
          meridianPos={meridianPos}
          troothhertzPos={troothhertzPos}
          stadiumPos={stadiumPos}
          stadiumScale={stadiumScale}
          veritasPos={veritasPos}
          nexusSelected={nexusSelected}
          meridianSelected={meridianSelected}
          troothhertzSelected={troothhertzSelected}
          stadiumSelected={stadiumSelected}
          veritasSelected={veritasSelected}
          nexusElevatorFloor={nexusElevatorFloor}
          meridianElevatorFloor={meridianElevatorFloor}
          troothhertzElevatorFloor={troothhertzElevatorFloor}
          isEditorMode={isEditorMode}
          onSelectTree={handleSelectTree}
          onMoveTree={handleMoveTree}
          onSelectObject={handleSelectObject}
          onMoveObject={handleMoveObject}
          onSelectNexus={handleSelectNexus}
          onSelectMeridian={handleSelectMeridian}
          onSelectTroothhertz={handleSelectTroothhertz}
          onSelectStadium={handleSelectStadium}
          onSelectVeritas={handleSelectVeritas}
          onViewNexusAgents={handleViewNexusAgents}
          onEnterNexus={handleEnterNexus}
          onViewMeridianAgents={handleViewMeridianAgents}
          onEnterMeridian={handleEnterMeridian}
          onViewTroothhertzAgents={handleViewTroothhertzAgents}
          onEnterTroothhertz={handleEnterTroothhertz}
          onEnterStadium={handleEnterStadium}
          onAgentClick={handleAgentClick}
          wavingAgentId={wavingAgentId}
          onMoveNexus={handleMoveNexus}
          onMoveMeridian={handleMoveMeridian}
          onMoveTroothhertz={handleMoveTroothhertz}
          onMoveStadium={handleMoveStadium}
          onMoveVeritas={handleMoveVeritas}
          cameraState={cameraState}
          buildingTarget={buildingTarget}
          plainTarget={plainTarget}
          onEnterPlain={handleEnterPlain}
          onCameraArrived={handleCameraArrived}
          onCameraExited={handleCameraExited}
          nexusElevatorPadOpen={nexusElevatorPadOpen}
          meridianElevatorPadOpen={meridianElevatorPadOpen}
          troothhertzElevatorPadOpen={troothhertzElevatorPadOpen}
          troothhertzElevatorUnlocked={troothhertzElevatorUnlocked}
          onToggleNexusElevatorPad={() => setNexusElevatorPadOpen(v => !v)}
          onToggleMeridianElevatorPad={() => setMeridianElevatorPadOpen(v => !v)}
          onToggleTroothhertzElevatorPad={() => setTroothhertzElevatorPadOpen(v => !v)}
          onNexusFloorChange={(floor) => {
            setNexusElevatorFloor(floor);
            setNexusElevatorPadOpen(false);
            setTargetFloorY(nexusPos[1] + floor * 3.2);
          }}
          onMeridianFloorChange={(floor) => {
            setMeridianElevatorFloor(floor);
            setMeridianElevatorPadOpen(false);
            setTargetFloorY(meridianPos[1] + floor * 4.0);
          }}
          onTroothhertzFloorChange={(floor) => {
            setTroothhertzElevatorFloor(floor);
            setTroothhertzElevatorPadOpen(false);
            // Only set targetFloorY if player is NOT riding the elevator
            // When riding, FirstPersonControls handles Y position via elevatorState
            if (!troothhertzElevatorState?.playerInside) {
              setTargetFloorY(troothhertzPos[1] + floor * 4.2);
            }
          }}
          insideBuilding={insideBuilding}
          targetFloorY={targetFloorY}
          freeLook={freeLook}
          onFreeLookChange={setFreeLook}
          onHoverAgent={setHoveredAgent}
          onTroothhertzAgentChat={handleTroothhertzAgentChat}
          onTroothhertzElevatorAccessDenied={handleTroothhertzElevatorAccessDenied}
          onTroothhertzElevatorCallWhileLocked={handleTroothhertzElevatorCallWhileLocked}
          troothhertzElevatorState={troothhertzElevatorState}
          onTroothhertzElevatorStateChange={setTroothhertzElevatorState}
          playerNearTroothhertzElevator={playerNearTroothhertzElevator}
          onPlayerNearTroothhertzElevatorChange={setPlayerNearTroothhertzElevator}
          collisionBoxes={
            insideBuilding === "troothhertz" 
              ? getTroothhertzCollisionBoxes(troothhertzPos, troothhertzElevatorFloor)
              : insideBuilding === "nexus"
              ? getNexusCollisionBoxes(nexusPos, nexusElevatorFloor)
              : insideBuilding === "meridian"
              ? getMeridianCollisionBoxes(meridianPos, meridianElevatorFloor)
              : insideBuilding === "stadium"
              ? getStadiumCollisionBoxes(stadiumPos, false)
              : []
          }
          snapToPosition={snapToPosition}
          onSnapComplete={() => setSnapToPosition(null)}
          worldFirstPerson={worldFirstPerson}
          worldFreeLook={worldFreeLook}
          onWorldFreeLookChange={setWorldFreeLook}
        />
      </Canvas>

      {/* Dashboard Button */}
      <a
        href="/dashboard"
        style={{
          position: "absolute",
          top: 18,
          left: 18,
          background: "linear-gradient(135deg, rgba(10,20,40,0.9), rgba(20,40,80,0.9))",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(42,111,189,0.5)",
          borderRadius: 10,
          padding: "10px 18px",
          color: "#a0d4ff",
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 8,
          zIndex: 10,
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "linear-gradient(135deg, rgba(20,40,80,0.95), rgba(42,80,140,0.95))";
          e.currentTarget.style.borderColor = "rgba(42,111,189,0.8)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "linear-gradient(135deg, rgba(10,20,40,0.9), rgba(20,40,80,0.9))";
          e.currentTarget.style.borderColor = "rgba(42,111,189,0.5)";
        }}
      >
        <span style={{ fontSize: 16 }}>📊</span>
        Dashboard
      </a>

      {/* World Management Sidebar */}
      <WorldManagementUI
        isEditorMode={isEditorMode}
        onToggleEditor={() => setIsEditorMode(e => !e)}
        currentWorldId={currentWorldId}
        onWorldChange={setCurrentWorldId}
        nexusPosition={nexusPos}
        meridianPosition={meridianPos}
        troothhertzPosition={troothhertzPos}
        stadiumPosition={stadiumPos}
        stadiumScale={stadiumScale}
        onStadiumScaleChange={setStadiumScale}
        veritasPosition={veritasPos}
        trees={trees}
        placedObjects={placedObjects}
        onPlaceObject={handlePlaceObject}
        canUndo={undoHistory.length > 0}
        canRedo={redoHistory.length > 0}
        onUndo={undo}
        onRedo={redo}
        snapToGrid={snapToGrid}
        onSnapToGridChange={setSnapToGrid}
        gridSize={gridSize}
        onGridSizeChange={setGridSize}
      />

      {/* HUD overlays */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
        {/* Stats badge */}
        <div style={{
          position: "absolute", top: 18, right: 18,
          background: "rgba(10,20,40,0.75)", backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
          padding: "6px 14px", color: "rgba(255,255,255,0.85)",
          fontFamily: "system-ui, sans-serif", fontSize: 12,
        }}>
          🌲 {trees.length} · 🏢 Nexus · 🏙️ Meridian · 🏫 Veritas · 📦 {placedObjects.length}
        </div>

        {/* First-person toggle (only in world view, not editor mode) */}
        {cameraState === "world" && !isEditorMode && (
          <div style={{
            position: "absolute", top: 60, right: 18,
            pointerEvents: "auto",
          }}>
            <button
              onClick={() => {
                setWorldFirstPerson(prev => !prev);
                if (worldFirstPerson) {
                  setWorldFreeLook(false);
                }
              }}
              style={{
                background: worldFirstPerson 
                  ? "linear-gradient(135deg, rgba(42,111,189,0.9), rgba(30,80,150,0.9))"
                  : "rgba(10,20,40,0.75)",
                backdropFilter: "blur(6px)",
                border: worldFirstPerson 
                  ? "1px solid rgba(90,159,212,0.7)"
                  : "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                padding: "8px 14px",
                color: worldFirstPerson ? "#fff" : "rgba(255,255,255,0.85)",
                fontFamily: "system-ui, sans-serif",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{worldFirstPerson ? "🚶" : "👁️"}</span>
              {worldFirstPerson ? "First Person" : "Orbit View"}
            </button>
          </div>
        )}

        {/* First-person mode instructions */}
        {worldFirstPerson && cameraState === "world" && (
          <div style={{
            position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
            background: "rgba(10,20,40,0.85)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(42,111,189,0.4)", borderRadius: 10,
            padding: "10px 20px", color: "rgba(255,255,255,0.9)",
            fontFamily: "system-ui, sans-serif", fontSize: 12,
            display: "flex", alignItems: "center", gap: 16,
            pointerEvents: "auto",
          }}>
            <span style={{ fontWeight: 600, color: "#a0d4ff" }}>
              {worldFreeLook ? "🔓 Free Look Active" : "🔒 Click to Look Around"}
            </span>
            <span style={{ opacity: 0.7 }}>|</span>
            <span><kbd style={{ background: "rgba(255,255,255,0.15)", padding: "2px 6px", borderRadius: 4, marginRight: 4 }}>W</kbd><kbd style={{ background: "rgba(255,255,255,0.15)", padding: "2px 6px", borderRadius: 4, marginRight: 4 }}>A</kbd><kbd style={{ background: "rgba(255,255,255,0.15)", padding: "2px 6px", borderRadius: 4, marginRight: 4 }}>S</kbd><kbd style={{ background: "rgba(255,255,255,0.15)", padding: "2px 6px", borderRadius: 4 }}>D</kbd> Move</span>
            <span style={{ opacity: 0.7 }}>|</span>
            <span><kbd style={{ background: "rgba(255,255,255,0.15)", padding: "2px 6px", borderRadius: 4 }}>Shift</kbd> Sprint</span>
            <span style={{ opacity: 0.7 }}>|</span>
            <span><kbd style={{ background: "rgba(255,255,255,0.15)", padding: "2px 6px", borderRadius: 4 }}>Esc</kbd> Release</span>
          </div>
        )}

        {/* Fly-in progress overlay */}
        {(cameraState === "flying-in" || cameraState === "flying-out") && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}>
            {cameraState === "flying-in" && insideBuilding === "stadium" ? (
              <div style={{
                position: "absolute", inset: 0, background: "#000", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 16,
              }}>
                <h1 style={{
                  fontFamily: "system-ui, sans-serif", fontSize: 48, fontWeight: 900, letterSpacing: 4,
                  color: "#00E5FF", textShadow: "0 0 40px #00E5FF, 0 0 80px #00CCFF",
                  margin: 0,
                }}>
                  TROO STADIUM
                </h1>
                <p style={{
                  fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: 400, letterSpacing: 3,
                  color: "rgba(255,255,255,0.9)", margin: 0,
                }}>
                  AI CONSULTING VENUE  ·  CAPACITY 424
                </p>
                <div style={{ marginTop: 24, color: "rgba(0,229,255,0.6)", fontSize: 12 }}>Entering...</div>
              </div>
            ) : (
              <div style={{
                background: "rgba(5,12,28,0.72)", backdropFilter: "blur(12px)",
                border: "1px solid rgba(42,111,189,0.4)", borderRadius: 14,
                padding: "14px 32px", color: "#a0c8f0",
                fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: 600,
                letterSpacing: 0.5, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
              }}>
                {cameraState === "flying-in" ? "✈ Entering building..." : "✈ Returning to world..."}
              </div>
            )}
          </div>
        )}

        {/* Interior HUD (visible when inside a building) */}
        {cameraState === "inside" && (
          <>
            <div style={{
              position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
              display: "flex", alignItems: "center", gap: 10,
              pointerEvents: "auto",
            }}>
              <button
                onClick={handleExitBuilding}
                style={{
                  background: "linear-gradient(135deg, rgba(5,15,35,0.95), rgba(20,40,80,0.95))",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(42,111,189,0.6)",
                  borderRadius: 10, padding: "9px 20px",
                  color: "#a0d4ff", fontFamily: "system-ui, sans-serif",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                  letterSpacing: 0.4,
                }}
              >
                ← Exit Building
              </button>

              <button
                onClick={() => setFreeLook(v => !v)}
                style={{
                  background: freeLook
                    ? "linear-gradient(135deg, rgba(42,111,189,0.9), rgba(20,60,120,0.9))"
                    : "linear-gradient(135deg, rgba(5,15,35,0.92), rgba(20,40,80,0.92))",
                  backdropFilter: "blur(10px)",
                  border: freeLook
                    ? "1px solid rgba(100,180,255,0.8)"
                    : "1px solid rgba(42,111,189,0.45)",
                  borderRadius: 10, padding: "9px 20px",
                  color: freeLook ? "#e0f0ff" : "#6a9fc8",
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                  boxShadow: freeLook ? "0 0 14px rgba(42,111,189,0.5)" : "0 4px 20px rgba(0,0,0,0.5)",
                  letterSpacing: 0.4,
                  transition: "all 0.2s",
                }}
              >
                {freeLook ? "🔓 Free Look ON" : "🔒 Free Look"}
              </button>

              {insideBuilding !== "stadium" && (
                <button
                  onClick={() => {
                    if (insideBuilding === "nexus") setShowNexusPanel(v => !v);
                    if (insideBuilding === "meridian") setShowMeridianPanel(v => !v);
                    if (insideBuilding === "troothhertz") setShowTroothhertzPanel(v => !v);
                  }}
                  style={{
                    background: (insideBuilding === "nexus" ? showNexusPanel : insideBuilding === "meridian" ? showMeridianPanel : showTroothhertzPanel)
                      ? "linear-gradient(135deg, rgba(60,120,60,0.9), rgba(30,80,30,0.9))"
                      : "linear-gradient(135deg, rgba(5,15,35,0.92), rgba(20,40,80,0.92))",
                    backdropFilter: "blur(10px)",
                    border: (insideBuilding === "nexus" ? showNexusPanel : insideBuilding === "meridian" ? showMeridianPanel : showTroothhertzPanel)
                      ? "1px solid rgba(100,220,100,0.7)"
                      : "1px solid rgba(42,111,189,0.45)",
                    borderRadius: 10, padding: "9px 20px",
                    color: (insideBuilding === "nexus" ? showNexusPanel : insideBuilding === "meridian" ? showMeridianPanel : showTroothhertzPanel) ? "#c0ffc0" : "#6a9fc8",
                    fontFamily: "system-ui, sans-serif",
                    fontSize: 13, fontWeight: 700, cursor: "pointer",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                    letterSpacing: 0.4,
                    transition: "all 0.2s",
                  }}
                >
                  👥 Office Directory
                </button>
              )}
            </div>

            {/* Crosshair dot */}
            <div style={{
              position: "absolute",
              top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: hoveredAgent ? 14 : 8,
              height: hoveredAgent ? 14 : 8,
              borderRadius: "50%",
              background: hoveredAgent ? "rgba(100,200,255,0.95)" : "rgba(255,255,255,0.75)",
              boxShadow: hoveredAgent
                ? "0 0 0 2px rgba(42,111,189,0.8), 0 0 12px rgba(100,200,255,0.6)"
                : "0 0 0 1.5px rgba(0,0,0,0.5)",
              pointerEvents: "none",
              transition: "all 0.12s ease",
              zIndex: 10,
            }} />

            {/* Agent hover tooltip */}
            {hoveredAgent && !chatActiveAgent && (
              <div style={{
                position: "absolute",
                top: "calc(50% + 22px)", left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(5,15,40,0.94)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(100,180,255,0.55)",
                borderRadius: 10,
                padding: "8px 18px",
                pointerEvents: "none",
                zIndex: 10,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                boxShadow: "0 4px 24px rgba(0,0,0,0.55), 0 0 0 1px rgba(100,180,255,0.15)",
              }}>
                <span style={{
                  color: "#e0f2ff",
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 14, fontWeight: 700,
                  letterSpacing: 0.3,
                }}>
                  {hoveredAgent.agentName}
                </span>
                <span style={{
                  color: "rgba(140,195,240,0.85)",
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 11, fontWeight: 500,
                  letterSpacing: 0.2,
                }}>
                  {hoveredAgent.agentRole}
                </span>
                <span style={{
                  marginTop: 4,
                  color: "rgba(100,180,255,0.7)",
                  fontFamily: "system-ui, sans-serif",
                  fontSize: 10,
                }}>
                  Click to chat
                </span>
              </div>
            )}

            {/* Bottom WASD hint */}
            {!chatActiveAgent && (
              <div style={{
                position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
                background: "rgba(5,12,28,0.78)", backdropFilter: "blur(8px)",
                border: "1px solid rgba(42,111,189,0.3)", borderRadius: 10,
                padding: "7px 16px", color: "rgba(140,185,230,0.8)",
                fontFamily: "system-ui, sans-serif", fontSize: 11,
                display: "flex", alignItems: "center", gap: 10,
                pointerEvents: "none",
              }}>
                <span>
                  <kbd style={{ background: "rgba(255,255,255,0.1)", borderRadius: 4, padding: "1px 5px" }}>W</kbd>
                  <kbd style={{ background: "rgba(255,255,255,0.1)", borderRadius: 4, padding: "1px 5px" }}>A</kbd>
                  <kbd style={{ background: "rgba(255,255,255,0.1)", borderRadius: 4, padding: "1px 5px" }}>S</kbd>
                  <kbd style={{ background: "rgba(255,255,255,0.1)", borderRadius: 4, padding: "1px 5px" }}>D</kbd>
                  {" "}Move
                </span>
                <span style={{ opacity: 0.4 }}>|</span>
                <span><kbd style={{ background: "rgba(255,255,255,0.1)", borderRadius: 4, padding: "1px 5px" }}>Shift</kbd> Sprint</span>
                <span style={{ opacity: 0.4 }}>|</span>
                <span>🛗 Walk near elevator to call it</span>
                <span style={{ opacity: 0.4 }}>|</span>
                <span>Click agent to chat</span>
              </div>
            )}
          </>
        )}

        {/* Editor mode badge */}
        {isEditorMode && cameraState === "world" && (
          <div style={{
            position: "absolute", top: 18, left: "50%", transform: "translateX(-50%)",
            background: "rgba(255,221,68,0.12)", backdropFilter: "blur(6px)",
            border: "1px solid rgba(255,221,68,0.45)", borderRadius: 8,
            padding: "6px 16px", color: "#ffdd44",
            fontFamily: "system-ui, sans-serif", fontSize: 12, fontWeight: 700,
          }}>
            ✏️ EDITOR MODE — Drag buildings/trees/objects · Q/E rotate · Delete to remove
          </div>
        )}

        {/* Object selection HUD */}
        {isEditorMode && selectedObject && (
          <div style={{
            position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
            background: "rgba(10,20,40,0.9)", backdropFilter: "blur(10px)",
            border: "1px solid rgba(42,111,189,0.5)", borderRadius: 12,
            padding: "10px 20px", display: "flex", alignItems: "center", gap: 14,
            color: "#fff", fontFamily: "system-ui, sans-serif", fontSize: 13,
            boxShadow: "0 4px 24px rgba(0,0,0,0.5)", pointerEvents: "auto",
          }}>
            <span style={{ color: "#5a9fd4", fontWeight: 700 }}>
              📦 {selectedObject.type.charAt(0).toUpperCase() + selectedObject.type.slice(1)}
            </span>
            <span style={{ color: "#88aacc", fontSize: 11 }}>Drag · Q/E rotate</span>
            <button onClick={() => handleRotateObject(-Math.PI/8)} style={{ background: "rgba(42,111,189,0.2)", color: "#5a9fd4", border: "1px solid rgba(42,111,189,0.35)", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 13 }}>↺ Q</button>
            <button onClick={() => handleRotateObject(Math.PI/8)} style={{ background: "rgba(42,111,189,0.2)", color: "#5a9fd4", border: "1px solid rgba(42,111,189,0.35)", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 13 }}>↻ E</button>
            <button onClick={handleDeleteObject} style={{ background: "#c0392b", color: "#fff", border: "none", borderRadius: 7, padding: "5px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>✕ Delete</button>
            <button onClick={() => setSelectedObjectId(null)} style={{ background: "rgba(255,255,255,0.07)", color: "#ccc", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>Deselect</button>
          </div>
        )}

        {/* Tree selection HUD */}
        {isEditorMode && selectedTree && !selectedObject && (
          <div style={{
            position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
            background: "rgba(10,30,10,0.88)", backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,221,68,0.5)", borderRadius: 12,
            padding: "10px 20px", display: "flex", alignItems: "center", gap: 14,
            color: "#fff", fontFamily: "system-ui, sans-serif", fontSize: 13,
            boxShadow: "0 4px 24px rgba(0,0,0,0.5)", pointerEvents: "auto",
          }}>
            <span style={{ color: "#ffdd44", fontWeight: 700 }}>🌲 Tree #{selectedTree.id + 1}</span>
            <span style={{ color: "#aad4aa", fontSize: 11 }}>Drag to move</span>
            <button onClick={handleDeleteTree} style={{ background: "#c0392b", color: "#fff", border: "none", borderRadius: 7, padding: "5px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>✕ Delete</button>
            <button onClick={() => setSelectedTreeId(null)} style={{ background: "rgba(255,255,255,0.07)", color: "#ccc", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>Deselect</button>
          </div>
        )}

        {/* Idle hint */}
        {!isEditorMode && !showNexusPanel && !showMeridianPanel && cameraState === "world" && (
          <div style={{
            position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)",
            background: "rgba(10,20,40,0.6)", backdropFilter: "blur(6px)",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
            padding: "8px 18px", color: "rgba(255,255,255,0.7)",
            fontFamily: "system-ui, sans-serif", fontSize: 12,
          }}>
            Click 🏢 Nexus or 🏙️ Meridian labels to meet AI agents · Enable Editor Mode to place & move objects
          </div>
        )}
      </div>

      {/* Nexus agent panel */}
      {showNexusPanel && (
        <BuildingInfoPanel
          buildingName={BUILDING_CONFIG.name}
          worldId={currentWorldId}
          onClose={() => { setShowNexusPanel(false); setNexusSelected(false); }}
          onElevatorFloor={setNexusElevatorFloor}
        />
      )}

      {/* Meridian agent panel */}
      {showMeridianPanel && (
        <BuildingInfoPanel
          buildingName="Meridian Tower"
          worldId={currentWorldId}
          onClose={() => { setShowMeridianPanel(false); setMeridianSelected(false); }}
          onElevatorFloor={setMeridianElevatorFloor}
        />
      )}

      {/* Troothhertz agent panel */}
      {showTroothhertzPanel && (
        <TroothhertzInfoPanel
          onClose={() => { setShowTroothhertzPanel(false); setTroothhertzSelected(false); }}
          onAgentChat={(agent: TroothAgent) => {
            setShowTroothhertzPanel(false);
            const agentData: AgentData = {
              id: agent.id,
              name: agent.name,
              role: agent.role,
              floor: agent.floor,
              department: agent.department,
              greeting: agent.greeting,
              expertise: agent.id === "troothhertz-evaana"
                ? "Visitor screening, access control, executive scheduling, gatekeeper protocols"
                : "Company vision, strategic partnerships, business development, executive decisions",
              title: agent.role,
              avatarEmoji: agent.id === "troothhertz-evaana" ? "👩‍💼" : "👑",
              worldId: "green-terrain",
              buildingId: "troothhertz-tower",
            };
            setChatActiveAgent(agentData);
          }}
          currentFloor={troothhertzElevatorFloor}
          elevatorUnlocked={troothhertzElevatorUnlocked}
        />
      )}

      {/* Agent chatbot */}
      {chatActiveAgent && (
        <AgentChatPanel
          agent={chatActiveAgent}
          worldId={currentWorldId}
          onClose={() => {
            setWavingAgentId(chatActiveAgent.id);
            setChatActiveAgent(null);
            setTimeout(() => setWavingAgentId(null), 3000);
          }}
          onElevatorAccessGranted={() => {
            if (chatActiveAgent.id === "troothhertz-evaana") {
              setTroothhertzElevatorUnlocked(true);
            }
          }}
        />
      )}

      {/* Elevator access denied notification */}
      {elevatorAccessDeniedMessage && (
        <div style={{
          position: "fixed",
          top: 100,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(139, 0, 0, 0.95)",
          border: "2px solid #ff4444",
          borderRadius: 12,
          padding: "16px 24px",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          fontSize: 14,
          fontWeight: 600,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          zIndex: 1000,
          textAlign: "center",
        }}>
          🔒 {elevatorAccessDeniedMessage}
        </div>
      )}
    </div>
  );
}

// ─── Protected Export ─────────────────────────────────────────────────────────
// Wraps entire page with authentication gate - requires admin login
export default function GreenTerrainPage() {
  return (
    <AuthGate redirectTo="/green-terrain" showWalletAuth={false}>
      <GreenTerrainPageContent />
    </AuthGate>
  );
}
