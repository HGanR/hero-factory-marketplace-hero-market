/**
 * CorporateBuilding.tsx
 * Procedural 3D corporate office building for the green terrain world.
 *
 * Design: Blue glass curtain-wall facade, white concrete banding,
 *         lobby atrium, working elevator, luxury interior per floor.
 *
 * Palette:
 *   Glass:   #2a6fbd (mid) / #1a4f8a (dark) / #5a9fd4 (highlight)
 *   Frame:   #d8dde4 (white concrete)
 *   Lobby:   #0d1f35 floor / #c8a96e gold accents
 *   Elevator: #c0c8d0 steel / #ffd700 indicator
 */

"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { BUILDING_CONFIG, FLOOR_CONFIG } from "@/data/greenTerrainBuildingData";

const { floorHeight, footprint } = BUILDING_CONFIG;
const W = footprint.w;
const D = footprint.d;

// ─── Materials ────────────────────────────────────────────────────────────────
// Softer materials for reduced harsh shadows and reflections
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0x4a8fcd, transparent: true, opacity: 0.65,
  roughness: 0.15, metalness: 0.15, reflectivity: 0.4,
  side: THREE.DoubleSide,
});
const glassHighMat = new THREE.MeshPhysicalMaterial({
  color: 0x6aafdd, transparent: true, opacity: 0.5,
  roughness: 0.1, metalness: 0.2,
});
const frameMat = new THREE.MeshLambertMaterial({ color: 0xe0e4e8 });
const darkFrameMat = new THREE.MeshLambertMaterial({ color: 0x5a6570 });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xd0b080, metalness: 0.5, roughness: 0.35 });
const steelMat = new THREE.MeshStandardMaterial({ color: 0xc0c8d0, metalness: 0.6, roughness: 0.3 });
const lobbyFloorMat = new THREE.MeshStandardMaterial({ color: 0x1a2a40, roughness: 0.5, metalness: 0.05 });
const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.5 });
const carpetMat = new THREE.MeshLambertMaterial({ color: 0x2a4060 });
const deskMat = new THREE.MeshStandardMaterial({ color: 0x3a4e60, roughness: 0.5, metalness: 0.1 });
const chairMat = new THREE.MeshLambertMaterial({ color: 0x2a2a3e });

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Box({ pos, size, mat }: { pos: [number,number,number]; size: [number,number,number]; mat: THREE.Material }) {
  return (
    <mesh position={pos} material={mat} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

// ─── Glass Panel Wall ─────────────────────────────────────────────────────────
function GlassWall({ pos, rot, w, h }: { pos: [number,number,number]; rot?: [number,number,number]; w: number; h: number }) {
  const panels = Math.floor(w / 1.4);
  return (
    <group position={pos} rotation={rot ?? [0,0,0]}>
      {/* Frame */}
      <Box pos={[0, 0, 0]} size={[w, h, 0.08]} mat={frameMat} />
      {/* Glass panels */}
      {Array.from({ length: panels }, (_, i) => {
        const x = -w / 2 + 0.7 + i * (w / panels);
        return (
          <mesh key={i} position={[x, 0, 0.05]} material={i % 3 === 0 ? glassHighMat : glassMat} castShadow>
            <boxGeometry args={[w / panels - 0.1, h - 0.2, 0.04]} />
          </mesh>
        );
      })}
      {/* Horizontal mullions */}
      {[0.3, -0.3].map((y, i) => (
        <Box key={i} pos={[0, y * h, 0.06]} size={[w, 0.06, 0.06]} mat={darkFrameMat} />
      ))}
    </group>
  );
}

// ─── Floor Band (concrete banding between floors) ─────────────────────────────
function FloorBand({ y }: { y: number }) {
  return (
    <group position={[0, y, 0]}>
      <Box pos={[0, 0, 0]} size={[W + 0.3, 0.25, D + 0.3]} mat={frameMat} />
    </group>
  );
}

// ─── Lobby Interior ───────────────────────────────────────────────────────────
function LobbyInterior() {
  return (
    <group position={[0, 0.05, 0]}>
      {/* Marble floor */}
      <Box pos={[0, 0, 0]} size={[W - 0.4, 0.08, D - 0.4]} mat={marbleMat} />
      {/* Reception desk */}
      <Box pos={[0, 0.5, -2.5]} size={[4, 1.0, 1.2]} mat={deskMat} />
      <Box pos={[0, 0.5, -2.5]} size={[4.1, 0.08, 1.3]} mat={goldMat} />
      {/* Gold accent strip on floor */}
      <Box pos={[0, 0.05, 0]} size={[W - 0.6, 0.04, 0.15]} mat={goldMat} />
      <Box pos={[0, 0.05, 0]} size={[0.15, 0.04, D - 0.6]} mat={goldMat} />
      {/* Lobby chairs */}
      {[[-2.5, 1.5], [2.5, 1.5]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Box pos={[0, 0.22, 0]} size={[0.7, 0.08, 0.7]} mat={chairMat} />
          <Box pos={[0, 0.55, -0.3]} size={[0.7, 0.6, 0.08]} mat={chairMat} />
          {/* Legs */}
          {[[-0.28,-0.28],[0.28,-0.28],[-0.28,0.28],[0.28,0.28]].map(([lx,lz],j)=>(
            <Box key={j} pos={[lx, 0.1, lz]} size={[0.05,0.2,0.05]} mat={steelMat} />
          ))}
        </group>
      ))}
      {/* Decorative columns */}
      {[[-4.5, -3.5], [4.5, -3.5], [-4.5, 3.5], [4.5, 3.5]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.4, 0]} material={marbleMat} castShadow>
            <cylinderGeometry args={[0.18, 0.2, 2.8, 8]} />
          </mesh>
          <Box pos={[0, 0.05, 0]} size={[0.42, 0.1, 0.42]} mat={goldMat} />
          <Box pos={[0, 2.85, 0]} size={[0.42, 0.1, 0.42]} mat={goldMat} />
        </group>
      ))}
      {/* Ceiling light strip - softer glow */}
      <mesh position={[0, floorHeight - 0.15, 0]}>
        <boxGeometry args={[6, 0.05, 0.3]} />
        <meshBasicMaterial color={0xfff8f0} />
      </mesh>
      {/* Soft ambient fill light for lobby */}
      <pointLight position={[0, floorHeight - 0.5, 0]} intensity={0.4} color={0xfff8f0} distance={8} decay={2} />
    </group>
  );
}

// ─── Office Floor Interior ────────────────────────────────────────────────────
function OfficeFloorInterior({ floor }: { floor: number }) {
  const cfg = FLOOR_CONFIG[floor];
  const accentColor = new THREE.Color(cfg.color);
  const accentMat = useMemo(() => new THREE.MeshLambertMaterial({ color: accentColor }), [cfg.color]);
  const rows = 2, cols = 3;
  return (
    <group position={[0, 0.05, 0]}>
      {/* Carpet */}
      <Box pos={[0, 0, 0]} size={[W - 0.4, 0.06, D - 0.4]} mat={carpetMat} />
      {/* Accent strip */}
      <Box pos={[0, 0.04, 0]} size={[W - 0.5, 0.02, 0.12]} mat={accentMat} />
      {/* Desks */}
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const x = -3 + c * 3, z = -2 + r * 3.5;
          return (
            <group key={`${r}-${c}`} position={[x, 0, z]}>
              <Box pos={[0, 0.38, 0]} size={[1.4, 0.06, 0.8]} mat={deskMat} />
              {/* Monitor */}
              <Box pos={[0, 0.65, -0.25]} size={[0.7, 0.45, 0.04]} mat={darkFrameMat} />
              <Box pos={[0, 0.42, -0.22]} size={[0.1, 0.06, 0.1]} mat={steelMat} />
              {/* Chair */}
              <Box pos={[0, 0.22, 0.5]} size={[0.6, 0.06, 0.6]} mat={chairMat} />
              <Box pos={[0, 0.52, 0.8]} size={[0.6, 0.5, 0.06]} mat={chairMat} />
            </group>
          );
        })
      )}
      {/* Ceiling panel light - softer glow */}
      <mesh position={[0, floorHeight - 0.15, 0]}>
        <boxGeometry args={[5, 0.04, 0.25]} />
        <meshBasicMaterial color={0xf4f8ff} />
      </mesh>
      {/* Soft ambient fill light for office floor */}
      <pointLight position={[0, floorHeight - 0.5, 0]} intensity={0.35} color={0xf4f8ff} distance={10} decay={2} />
    </group>
  );
}

// ─── Elevator Shaft & Cabin ───────────────────────────────────────────────────
function Elevator({ currentFloor }: { currentFloor: number }) {
  const cabinRef = useRef<THREE.Group>(null);
  const targetY = useRef(0);
  const currentY = useRef(0);

  targetY.current = currentFloor * floorHeight + 0.1;

  useFrame((_, delta) => {
    if (!cabinRef.current) return;
    currentY.current = THREE.MathUtils.lerp(currentY.current, targetY.current, delta * 2.5);
    cabinRef.current.position.y = currentY.current;
  });

  const shaftH = BUILDING_CONFIG.floors * floorHeight;
  const ex = W / 2 - 1.2, ez = 0;

  return (
    <group position={[ex, 0, ez]}>
      {/* Shaft walls */}
      <Box pos={[0, shaftH / 2, 0]} size={[1.6, shaftH, 1.6]} mat={new THREE.MeshLambertMaterial({ color: 0x2a3540, transparent: true, opacity: 0.4, side: THREE.DoubleSide })} />
      {/* Shaft frame */}
      <Box pos={[-0.8, shaftH / 2, 0]} size={[0.05, shaftH, 1.6]} mat={steelMat} />
      <Box pos={[0.8, shaftH / 2, 0]} size={[0.05, shaftH, 1.6]} mat={steelMat} />
      {/* Cabin */}
      <group ref={cabinRef}>
        <Box pos={[0, 1.1, 0]} size={[1.4, 2.2, 1.4]} mat={steelMat} />
        {/* Cabin door (glass) */}
        <mesh position={[0, 1.1, 0.71]} material={glassMat}>
          <boxGeometry args={[0.9, 2.0, 0.04]} />
        </mesh>
        {/* Floor indicator */}
        <mesh position={[0, 2.35, 0.72]}>
          <boxGeometry args={[0.3, 0.12, 0.02]} />
          <meshBasicMaterial color={0xffd700} />
        </mesh>
        {/* Cable */}
        <mesh position={[0, shaftH / 2 - currentY.current + 1.1, 0]}>
          <cylinderGeometry args={[0.02, 0.02, shaftH, 4]} />
          <meshStandardMaterial color={0x888888} metalness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

// ─── Roof ─────────────────────────────────────────────────────────────────────
function Roof({ y }: { y: number }) {
  return (
    <group position={[0, y, 0]}>
      <Box pos={[0, 0.15, 0]} size={[W + 0.4, 0.3, D + 0.4]} mat={frameMat} />
      {/* Parapet */}
      <Box pos={[0, 0.55, D / 2 + 0.1]} size={[W + 0.5, 0.5, 0.2]} mat={frameMat} />
      <Box pos={[0, 0.55, -D / 2 - 0.1]} size={[W + 0.5, 0.5, 0.2]} mat={frameMat} />
      <Box pos={[W / 2 + 0.1, 0.55, 0]} size={[0.2, 0.5, D + 0.5]} mat={frameMat} />
      <Box pos={[-W / 2 - 0.1, 0.55, 0]} size={[0.2, 0.5, D + 0.5]} mat={frameMat} />
      {/* Rooftop equipment */}
      <Box pos={[2, 0.8, 1]} size={[2, 1.0, 1.5]} mat={darkFrameMat} />
      <Box pos={[-2, 0.8, -1]} size={[1.5, 0.8, 1.2]} mat={darkFrameMat} />
      {/* Antenna */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 3, 6]} />
        <meshStandardMaterial color={0xaaaaaa} metalness={0.8} />
      </mesh>
      {/* Blinking light */}
      <mesh position={[0, 3.1, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color={0xff2222} />
      </mesh>
    </group>
  );
}

// ─── Name Tag (Billboard) ─────────────────────────────────────────────────────
export function BuildingNameTag({ position, name, onClick, isSelected }: {
  position: [number, number, number];
  name: string;
  onClick: () => void;
  isSelected: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (!ref.current) return;
    ref.current.quaternion.copy(camera.quaternion);
  });
  return (
    <group ref={ref} position={position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {/* Tag background */}
      <mesh>
        <planeGeometry args={[4.5, 0.9]} />
        <meshBasicMaterial color={isSelected ? 0xffdd44 : 0x0d1f35} transparent opacity={0.92} side={THREE.DoubleSide} />
      </mesh>
      {/* Border */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[4.7, 1.1]} />
        <meshBasicMaterial color={isSelected ? 0xffa500 : 0x2a6fbd} transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ─── Main Building Component ──────────────────────────────────────────────────
interface CorporateBuildingProps {
  position?: [number, number, number];
  onSelect?: () => void;
  isSelected?: boolean;
  currentElevatorFloor?: number;
  activeFloor?: number;   // which floor interior to show (null = exterior view)
}

export default function CorporateBuilding({
  position = [0, 0, 0],
  onSelect,
  isSelected = false,
  currentElevatorFloor = 0,
}: CorporateBuildingProps) {
  const totalH = BUILDING_CONFIG.floors * floorHeight;

  return (
    <group position={position}>
      {/* ── Floors ── */}
      {Array.from({ length: BUILDING_CONFIG.floors }, (_, fi) => {
        const y = fi * floorHeight;
        const isLobby = fi === 0;
        return (
          <group key={fi} position={[0, y, 0]}>
            {/* Floor slab */}
            <Box pos={[0, 0, 0]} size={[W, 0.18, D]} mat={isLobby ? lobbyFloorMat : carpetMat} />
            {/* Glass walls — front (south) */}
            <GlassWall pos={[0, floorHeight / 2, D / 2]} w={W} h={floorHeight} />
            {/* Glass walls — back (north) */}
            <GlassWall pos={[0, floorHeight / 2, -D / 2]} rot={[0, Math.PI, 0]} w={W} h={floorHeight} />
            {/* Glass walls — left (west) */}
            <GlassWall pos={[-W / 2, floorHeight / 2, 0]} rot={[0, Math.PI / 2, 0]} w={D} h={floorHeight} />
            {/* Glass walls — right (east, partial — elevator shaft side) */}
            <GlassWall pos={[W / 2, floorHeight / 2, 0]} rot={[0, -Math.PI / 2, 0]} w={D} h={floorHeight} />
            {/* Floor band */}
            <FloorBand y={floorHeight} />
            {/* Interior */}
            {isLobby ? <LobbyInterior /> : <OfficeFloorInterior floor={fi} />}
          </group>
        );
      })}

      {/* ── Elevator ── */}
      <Elevator currentFloor={currentElevatorFloor} />

      {/* ── Roof ── */}
      <Roof y={totalH} />

      {/* ── Terrain-masking base slab ──
           A thick opaque slab that sits flush with world Y=0 and extends
           1.5 units beyond the footprint on every side. It renders on top
           of the terrain mesh so no grass or hills bleed into the lobby. */}
      <mesh position={[0, -1.0, 0]} receiveShadow>
        <boxGeometry args={[W + 3, 2.0, D + 3]} />
        <meshStandardMaterial color={0x8a9098} roughness={0.9} />
      </mesh>
      {/* Polished concrete plaza surface */}
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[W + 3, 0.06, D + 3]} />
        <meshStandardMaterial color={0xb8bec6} roughness={0.55} metalness={0.05} />
      </mesh>

      {/* ── Ground base / plinth ── */}
      <Box pos={[0, -0.15, 0]} size={[W + 1.2, 0.3, D + 1.2]} mat={frameMat} />
      <Box pos={[0, -0.3, 0]} size={[W + 2, 0.15, D + 2]} mat={new THREE.MeshLambertMaterial({ color: 0xc8cdd4 })} />

      {/* ── Entry canopy ── */}
      <Box pos={[0, 1.8, D / 2 + 1.2]} size={[5, 0.12, 2.4]} mat={glassMat} />
      <Box pos={[-2.2, 0.9, D / 2 + 2.2]} size={[0.12, 1.8, 0.12]} mat={steelMat} />
      <Box pos={[2.2, 0.9, D / 2 + 2.2]} size={[0.12, 1.8, 0.12]} mat={steelMat} />

      {/* ── Selection highlight ring ── */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 0]}>
          <ringGeometry args={[8.5, 9.5, 48]} />
          <meshBasicMaterial color={0xffdd44} transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
