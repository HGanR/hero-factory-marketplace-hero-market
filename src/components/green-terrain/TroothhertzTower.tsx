/**
 * TroothhertzTower.tsx
 * TROOTHHERTZ LLC. TOWER — 2-floor dark glass building
 *
 * Floor 0 — Lobby: Reception desk, Evaana the gatekeeper receptionist,
 *            elevator (locked until Evaana grants access), door with logo
 * Floor 1 — Presidential Office: Agent Charles (CEO) at a luxury glass desk,
 *            fish tank, wall-mounted TV (TVDISPLAY), wall art, framed desk photo,
 *            open office door with door logo
 *
 * All image textures are loaded from CDN URLs.
 * Building follows the same patterns as CorporateBuilding.tsx:
 *   - Terrain-masking ground slab
 *   - Polygon offset on all flat ground meshes
 *   - userData tags on agent meshes for raycaster hover
 */

import { useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { TextureLoader } from "three";
import FunctionalElevator, { ElevatorFloorConfig } from "./FunctionalElevator";

const CDN_AVATAR      = "https://d2xsxph8kpxj0f.cloudfront.net/310519663036034904/KNw7A3XaWgEkMi9WkgGpSw/trooth-avatar_b03b1212.png";
const CDN_DESK_PHOTO  = "https://d2xsxph8kpxj0f.cloudfront.net/310519663036034904/KNw7A3XaWgEkMi9WkgGpSw/trooth-desk-photo_248d7c8d.jpg";
const CDN_WALL_ART    = "https://d2xsxph8kpxj0f.cloudfront.net/310519663036034904/KNw7A3XaWgEkMi9WkgGpSw/trooth-wall-art_9cdd832a.png";
const CDN_DOOR_LOGO   = "https://d2xsxph8kpxj0f.cloudfront.net/310519663036034904/KNw7A3XaWgEkMi9WkgGpSw/trooth-door-logo_18be19d0.jpg";
const LOBBY_WALL_IMAGE = "/images/hero-factory-lobby.png";

function useMarbleTexture(width: number, depth: number): THREE.CanvasTexture {
  return useMemo(() => {
    const SIZE = 512;
    const canvas = document.createElement("canvas");
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#f0ede8";
    ctx.fillRect(0, 0, SIZE, SIZE);

    for (let i = 0; i < 6; i++) {
      const gx = Math.random() * SIZE, gy = Math.random() * SIZE;
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, SIZE * 0.4);
      gr.addColorStop(0, "rgba(245,240,232,0.4)");
      gr.addColorStop(1, "rgba(255,252,248,0)");
      ctx.fillStyle = gr; ctx.fillRect(0, 0, SIZE, SIZE);
    }

    const drawVein = (x0: number, y0: number, angle: number, length: number, w: number, opacity: number) => {
      ctx.save();
      ctx.strokeStyle = `rgba(20,18,16,${opacity})`;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      let x = x0, y = y0;
      const steps = Math.floor(length / 4);
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const wobble = Math.sin(t * Math.PI * 6 + angle) * 18;
        x += Math.cos(angle) * 4 + Math.sin(angle + 1.2) * wobble * 0.08;
        y += Math.sin(angle) * 4 + Math.cos(angle + 0.8) * wobble * 0.08;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    };

    for (let i = 0; i < 8; i++) {
      drawVein(
        Math.random() * SIZE, Math.random() * SIZE,
        Math.random() * Math.PI,
        80 + Math.random() * 200,
        0.8 + Math.random() * 1.8,
        0.18 + Math.random() * 0.22
      );
    }
    for (let i = 0; i < 14; i++) {
      drawVein(
        Math.random() * SIZE, Math.random() * SIZE,
        Math.random() * Math.PI,
        30 + Math.random() * 80,
        0.3 + Math.random() * 0.7,
        0.08 + Math.random() * 0.12
      );
    }

    for (let i = 0; i < 120; i++) {
      const sx = Math.random() * SIZE, sy = Math.random() * SIZE;
      const r = 0.5 + Math.random() * 1.8;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${180 + Math.random() * 60},${140 + Math.random() * 40},0,${0.4 + Math.random() * 0.5})`;
      ctx.fill();
    }

    const tilesX = Math.round(width / 1.2);
    const tilesZ = Math.round(depth / 1.2);
    ctx.strokeStyle = "rgba(200,160,0,0.25)";
    ctx.lineWidth = 1.5;
    for (let i = 1; i < tilesX; i++) {
      const px = (i / tilesX) * SIZE;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, SIZE); ctx.stroke();
    }
    for (let i = 1; i < tilesZ; i++) {
      const py = (i / tilesZ) * SIZE;
      ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(SIZE, py); ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(width / 3, depth / 3);
    return tex;
  }, [width, depth]);
}

function MarbleFloor({ w, d, yOffset = 0.01 }: { w: number; d: number; yOffset?: number }) {
  const tex = useMarbleTexture(w, d);
  return (
    <mesh position={[0, yOffset, 0]} receiveShadow>
      <boxGeometry args={[w, 0.05, d]} />
      <meshPhongMaterial map={tex} shininess={120} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  );
}

const W  = 14;
const D  = 11;
const FH = 4.2;
const LOBBY_Y  = 0;
const OFFICE_Y = FH;

const ELEVATOR_FLOORS: ElevatorFloorConfig[] = [
  { label: "Lobby",            y: LOBBY_Y  },
  { label: "Presidential Office", y: OFFICE_Y },
];

export interface TroothAgent {
  id: string;
  name: string;
  role: string;
  floor: number;
  department: string;
  greeting: string;
}

export const TROOTHHERTZ_AGENTS: TroothAgent[] = [
  {
    id: "troothhertz-evaana",
    name: "Evaana",
    role: "Head Receptionist",
    floor: 0,
    department: "Reception",
    greeting: "Welcome to TROOTHHERTZ LLC. I'm Evaana. Before I can grant you access to the executive floor, I'll need to ask you a few questions. Are you ready?",
  },
  {
    id: "troothhertz-trooth",
    name: "Charles",
    role: "President & CEO",
    floor: 1,
    department: "Executive",
    greeting: "Welcome. I'm Charles, President of TROOTHHERTZ LLC. What brings you to my office today?",
  },
];

import type { ElevatorState } from "./FunctionalElevator";

interface TroothhertzTowerProps {
  position: [number, number, number];
  isSelected?: boolean;
  onSelect?: () => void;
  onEnterBuilding?: () => void;
  onViewAgents?: () => void;
  onAgentChat?: (agent: TroothAgent) => void;
  currentFloor?: number;
  onFloorChange?: (floor: number) => void;
  elevatorUnlocked?: boolean;
  showElevatorPad?: boolean;
  onToggleElevatorPad?: () => void;
  onElevatorRideStart?: () => void;
  onElevatorRideEnd?: (floor: number) => void;
  onEnterCabin?: () => void;
  wavingAgentId?: string | null;
  insideBuilding?: boolean;
  hoveredAgentId?: string | null;
  cameraPos?: [number, number, number];
  onElevatorAccessDenied?: () => void;
  onElevatorCallWhileLocked?: () => void;
  onElevatorStateChange?: (state: ElevatorState) => void;
  playerNearElevator?: boolean;
}

function ExteriorShell({ position, isSelected, onSelect, hideExteriorDecor }: {
  position: [number, number, number];
  isSelected?: boolean;
  onSelect?: () => void;
  hideExteriorDecor?: boolean;
}) {
  const glassColor = 0x88ddff;  // Light cyan-blue glass
  const frameColor = 0x1a1a2a;  // Dark frame for contrast
  const accentBlue = 0x4488cc;  // Brighter accent
  const roofColor  = 0x1a1a2a;

  return (
    <group position={position}>
      <mesh position={[0, -0.25, 0]} receiveShadow>
        <boxGeometry args={[W + 2, 0.5, D + 2]} />
        <meshLambertMaterial color={0x1a1a1a} />
      </mesh>

      {/* ─── Back Wall (Floor 1) - Glass with frame ─── */}
      {/* Frame pillars for back wall */}
      {[-W/2 + 0.15, -W/4, 0, W/4, W/2 - 0.15].map((x, i) => (
        <mesh key={`back-frame-f1-${i}`} position={[x, FH * 0.5, -D / 2]} castShadow>
          <boxGeometry args={[0.15, FH, 0.15]} />
          <meshLambertMaterial color={frameColor} />
        </mesh>
      ))}
      {/* Horizontal frame bars */}
      <mesh position={[0, FH - 0.1, -D / 2]} castShadow>
        <boxGeometry args={[W, 0.12, 0.15]} />
        <meshLambertMaterial color={frameColor} />
      </mesh>
      <mesh position={[0, 0.1, -D / 2]} castShadow>
        <boxGeometry args={[W, 0.12, 0.15]} />
        <meshLambertMaterial color={frameColor} />
      </mesh>
      {/* Glass panels for back wall floor 1 */}
      {[-W*3/8, -W/8, W/8, W*3/8].map((x, i) => (
        <mesh key={`back-glass-f1-${i}`} position={[x, FH * 0.5, -D / 2 + 0.02]}>
          <boxGeometry args={[W/4 - 0.2, FH - 0.3, 0.06]} />
          <meshPhongMaterial color={glassColor} transparent opacity={0.2} shininess={300} side={THREE.DoubleSide} />
        </mesh>
      ))}
      
      {/* ─── Left Wall (Floor 1) - Glass with frame ─── */}
      {/* Frame pillars for left wall */}
      {[-D/2 + 0.15, -D/4, 0, D/4, D/2 - 0.15].map((z, i) => (
        <mesh key={`left-frame-f1-${i}`} position={[-W / 2, FH * 0.5, z]} castShadow>
          <boxGeometry args={[0.15, FH, 0.15]} />
          <meshLambertMaterial color={frameColor} />
        </mesh>
      ))}
      {/* Horizontal frame bars */}
      <mesh position={[-W / 2, FH - 0.1, 0]} castShadow>
        <boxGeometry args={[0.15, 0.12, D]} />
        <meshLambertMaterial color={frameColor} />
      </mesh>
      <mesh position={[-W / 2, 0.1, 0]} castShadow>
        <boxGeometry args={[0.15, 0.12, D]} />
        <meshLambertMaterial color={frameColor} />
      </mesh>
      {/* Glass panels for left wall floor 1 */}
      {[-D*3/8, -D/8, D/8, D*3/8].map((z, i) => (
        <mesh key={`left-glass-f1-${i}`} position={[-W / 2 + 0.02, FH * 0.5, z]}>
          <boxGeometry args={[0.06, FH - 0.3, D/4 - 0.2]} />
          <meshPhongMaterial color={glassColor} transparent opacity={0.2} shininess={300} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[W / 2, 0.5, 0]} castShadow>
        <boxGeometry args={[0.25, 1.0, D]} />
        <meshLambertMaterial color={frameColor} />
      </mesh>
      <mesh position={[W / 2, FH - 0.3, 0]} castShadow>
        <boxGeometry args={[0.25, 0.6, D]} />
        <meshLambertMaterial color={frameColor} />
      </mesh>
      {[-2.5, 0, 2.5].map((z, i) => (
        <group key={i} position={[W / 2, FH * 0.5, z]}>
          <mesh>
            <boxGeometry args={[0.12, FH - 1.6, 1.8]} />
            <meshLambertMaterial color={frameColor} />
          </mesh>
          <mesh position={[0.0, 0, 0]}>
            <boxGeometry args={[0.08, FH - 1.8, 1.6]} />
            <meshPhongMaterial color={glassColor} transparent opacity={0.35} shininess={200} />
          </mesh>
        </group>
      ))}
      {[-3.75, -1.25, 1.25, 3.75].map((z, i) => (
        <mesh key={i} position={[W / 2, FH * 0.5, z]} castShadow>
          <boxGeometry args={[0.25, FH, 0.5]} />
          <meshLambertMaterial color={frameColor} />
        </mesh>
      ))}

      <mesh position={[-4.5, FH * 0.5, D / 2]} castShadow>
        <boxGeometry args={[4, FH, 0.12]} />
        <meshPhongMaterial color={glassColor} transparent opacity={0.35} shininess={200} />
      </mesh>
      <mesh position={[4.5, FH * 0.5, D / 2]} castShadow>
        <boxGeometry args={[4, FH, 0.12]} />
        <meshPhongMaterial color={glassColor} transparent opacity={0.35} shininess={200} />
      </mesh>
      <mesh position={[0, FH - 0.3, D / 2]}>
        <boxGeometry args={[3, 0.6, 0.14]} />
        <meshLambertMaterial color={frameColor} />
      </mesh>
      {[-1.4, 1.4].map((x, i) => (
        <mesh key={i} position={[x, FH * 0.4, D / 2]}>
          <boxGeometry args={[0.15, FH * 0.8, 0.14]} />
          <meshLambertMaterial color={frameColor} />
        </mesh>
      ))}
      {[-0.65, 0.65].map((x, i) => (
        <mesh key={i} position={[x, FH * 0.38, D / 2]}>
          <boxGeometry args={[1.1, FH * 0.76, 0.08]} />
          <meshPhongMaterial color={accentBlue} transparent opacity={0.6} shininess={200} />
        </mesh>
      ))}

      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[-W / 2 - 0.05, 0.6 + i * 0.55, D / 2 - 1.5]} castShadow>
          <boxGeometry args={[0.3, 0.08, 2.2]} />
          <meshLambertMaterial color={accentBlue} />
        </mesh>
      ))}

      {/* ─── Back Wall (Floor 2) - Glass with frame ─── */}
      {/* Frame pillars for back wall floor 2 */}
      {[-W/2 + 0.15, -W/4, 0, W/4, W/2 - 0.15].map((x, i) => (
        <mesh key={`back-frame-f2-${i}`} position={[x, FH + FH * 0.5, -D / 2]} castShadow>
          <boxGeometry args={[0.15, FH, 0.15]} />
          <meshLambertMaterial color={frameColor} />
        </mesh>
      ))}
      {/* Horizontal frame bars floor 2 */}
      <mesh position={[0, FH * 2 - 0.1, -D / 2]} castShadow>
        <boxGeometry args={[W, 0.12, 0.15]} />
        <meshLambertMaterial color={frameColor} />
      </mesh>
      <mesh position={[0, FH + 0.1, -D / 2]} castShadow>
        <boxGeometry args={[W, 0.12, 0.15]} />
        <meshLambertMaterial color={frameColor} />
      </mesh>
      {/* Glass panels for back wall floor 2 */}
      {[-W*3/8, -W/8, W/8, W*3/8].map((x, i) => (
        <mesh key={`back-glass-f2-${i}`} position={[x, FH + FH * 0.5, -D / 2 + 0.02]}>
          <boxGeometry args={[W/4 - 0.2, FH - 0.3, 0.06]} />
          <meshPhongMaterial color={glassColor} transparent opacity={0.2} shininess={300} side={THREE.DoubleSide} />
        </mesh>
      ))}
      
      {/* ─── Left Wall (Floor 2) - Glass with frame ─── */}
      {/* Frame pillars for left wall floor 2 */}
      {[-D/2 + 0.15, -D/4, 0, D/4, D/2 - 0.15].map((z, i) => (
        <mesh key={`left-frame-f2-${i}`} position={[-W / 2, FH + FH * 0.5, z]} castShadow>
          <boxGeometry args={[0.15, FH, 0.15]} />
          <meshLambertMaterial color={frameColor} />
        </mesh>
      ))}
      {/* Horizontal frame bars floor 2 */}
      <mesh position={[-W / 2, FH * 2 - 0.1, 0]} castShadow>
        <boxGeometry args={[0.15, 0.12, D]} />
        <meshLambertMaterial color={frameColor} />
      </mesh>
      <mesh position={[-W / 2, FH + 0.1, 0]} castShadow>
        <boxGeometry args={[0.15, 0.12, D]} />
        <meshLambertMaterial color={frameColor} />
      </mesh>
      {/* Glass panels for left wall floor 2 */}
      {[-D*3/8, -D/8, D/8, D*3/8].map((z, i) => (
        <mesh key={`left-glass-f2-${i}`} position={[-W / 2 + 0.02, FH + FH * 0.5, z]}>
          <boxGeometry args={[0.06, FH - 0.3, D/4 - 0.2]} />
          <meshPhongMaterial color={glassColor} transparent opacity={0.2} shininess={300} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[W / 2, FH + 0.5, 0]} castShadow>
        <boxGeometry args={[0.25, 1.0, D]} />
        <meshLambertMaterial color={frameColor} />
      </mesh>
      <mesh position={[W / 2, FH * 2 - 0.3, 0]} castShadow>
        <boxGeometry args={[0.25, 0.6, D]} />
        <meshLambertMaterial color={frameColor} />
      </mesh>
      {[-2.5, 0, 2.5].map((z, i) => (
        <group key={i} position={[W / 2, FH + FH * 0.5, z]}>
          <mesh>
            <boxGeometry args={[0.12, FH - 1.6, 1.8]} />
            <meshLambertMaterial color={frameColor} />
          </mesh>
          <mesh position={[0.0, 0, 0]}>
            <boxGeometry args={[0.08, FH - 1.8, 1.6]} />
            <meshPhongMaterial color={glassColor} transparent opacity={0.35} shininess={200} />
          </mesh>
        </group>
      ))}
      {[-3.75, -1.25, 1.25, 3.75].map((z, i) => (
        <mesh key={i} position={[W / 2, FH + FH * 0.5, z]} castShadow>
          <boxGeometry args={[0.25, FH, 0.5]} />
          <meshLambertMaterial color={frameColor} />
        </mesh>
      ))}

      {[-4, 0, 4].map((x, i) => (
        <mesh key={i} position={[x, FH + FH * 0.5, D / 2]} castShadow>
          <boxGeometry args={[3.6, FH - 0.3, 0.12]} />
          <meshPhongMaterial color={glassColor} transparent opacity={0.35} shininess={200} />
        </mesh>
      ))}
      {[0.3, 0.65].map((frac, i) => (
        <mesh key={i} position={[0, FH + FH * frac, D / 2]}>
          <boxGeometry args={[W, 0.1, 0.14]} />
          <meshLambertMaterial color={frameColor} />
        </mesh>
      ))}
      {[-W / 2 + 3.6, -W / 2 + 7.2, W / 2 - 3.6].map((x, i) => (
        <mesh key={i} position={[x, FH + FH * 0.5, D / 2]}>
          <boxGeometry args={[0.12, FH, 0.14]} />
          <meshLambertMaterial color={frameColor} />
        </mesh>
      ))}

      <mesh position={[0, FH * 2 + 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[W + 0.5, 0.3, D + 0.5]} />
        <meshLambertMaterial color={roofColor} />
      </mesh>
      {[
        [0, FH * 2 + 0.5, -D / 2],
        [0, FH * 2 + 0.5,  D / 2],
        [-W / 2, FH * 2 + 0.5, 0],
        [ W / 2, FH * 2 + 0.5, 0],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]} castShadow>
          <boxGeometry args={[i < 2 ? W + 0.5 : 0.3, 0.7, i < 2 ? 0.3 : D + 0.5]} />
          <meshLambertMaterial color={roofColor} />
        </mesh>
      ))}
      {[[-3, 0], [3, 0]].map(([x, z], i) => (
        <mesh key={i} position={[x as number, FH * 2 + 0.55, z as number]} castShadow>
          <boxGeometry args={[1.2, 0.6, 1.2]} />
          <meshLambertMaterial color={0x1a1a1a} />
        </mesh>
      ))}

      <mesh position={[0, FH, 0]} receiveShadow>
        <boxGeometry args={[W, 0.2, D]} />
        <meshLambertMaterial color={0x111111} />
      </mesh>

      {[
        [-W / 2, -D / 2], [-W / 2, D / 2],
        [ W / 2, -D / 2], [ W / 2, D / 2],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x as number, FH, z as number]} castShadow>
          <boxGeometry args={[0.4, FH * 2 + 0.3, 0.4]} />
          <meshLambertMaterial color={0x080808} />
        </mesh>
      ))}
      {!hideExteriorDecor && [
        [-W / 2 - 1.2, 0, D / 2 - 1],
        [-W / 2 - 1.2, 0, -D / 2 + 1],
        [ W / 2 + 1.2, 0, D / 2 - 1],
        [ W / 2 + 1.2, 0, -D / 2 + 1],
        [0, 0, D / 2 + 1.5],
      ].map(([tx, ty, tz], i) => (
        <group key={i} position={[tx as number, ty as number, tz as number]}>
          <mesh position={[0, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.14, 1.4, 6]} />
            <meshLambertMaterial color={0x5c3a1e} />
          </mesh>
          <mesh position={[0, 1.8, 0]} castShadow>
            <coneGeometry args={[0.7, 1.4, 7]} />
            <meshLambertMaterial color={0x2d6a2d} />
          </mesh>
          <mesh position={[0, 2.5, 0]} castShadow>
            <coneGeometry args={[0.5, 1.1, 7]} />
            <meshLambertMaterial color={0x3a7a35} />
          </mesh>
        </group>
      ))}

      {!hideExteriorDecor && [-5, -3, -1, 1, 3, 5].map((x, i) => (
        <mesh key={i} position={[x, 0.2, D / 2 + 0.4]} castShadow>
          <boxGeometry args={[0.6, 0.4, 0.6]} />
          <meshLambertMaterial color={0x1a5a1a} />
        </mesh>
      ))}

      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[W * 0.72, W * 0.78, 64]} />
          <meshBasicMaterial color={0xffdd44} transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function LobbyInterior({ position, doorLogoTexture, lobbyWallTexture, onAgentChat, isAgentWaving, showAgentHud = true }: {
  position: [number, number, number];
  doorLogoTexture: THREE.Texture | null;
  lobbyWallTexture: THREE.Texture | null;
  onAgentChat: () => void;
  isAgentWaving?: boolean;
  showAgentHud?: boolean;
}) {
  const screenRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!screenRef.current) return;
    const t = clock.getElapsedTime();
    const hue = 0.55 + Math.sin(t * 0.4) * 0.08;
    const sat = 0.7 + Math.sin(t * 0.6) * 0.15;
    const lit = 0.28 + Math.sin(t * 0.3) * 0.08;
    screenRef.current.color.setHSL(hue, sat, lit);
  });
  return (
    <group position={position}>
      <MarbleFloor w={W - 0.5} d={D - 0.5} />

      <mesh position={[0, FH - 0.1, 0]}>
        <boxGeometry args={[W - 0.5, 0.1, D - 0.5]} />
        <meshLambertMaterial color={0x0d0d1a} />
      </mesh>

      {/* Wall behind receptionist with company logo/art */}
      <mesh position={[0, 2.2, -D / 2 + 0.15]} castShadow>
        <boxGeometry args={[6, 3.2, 0.1]} />
        <meshLambertMaterial color={0x0a0a14} />
      </mesh>
      {lobbyWallTexture && (
        <mesh position={[0, 2.2, -D / 2 + 0.22]}>
          <boxGeometry args={[5.4, 2.8, 0.01]} />
          <meshBasicMaterial map={lobbyWallTexture} />
        </mesh>
      )}
      {/* Gold frame around wall art */}
      {[
        [0, 3.85, -D / 2 + 0.24, 5.6, 0.1, 0.02],
        [0, 0.55, -D / 2 + 0.24, 5.6, 0.1, 0.02],
        [-2.75, 2.2, -D / 2 + 0.24, 0.1, 3.4, 0.02],
        [2.75, 2.2, -D / 2 + 0.24, 0.1, 3.4, 0.02],
      ].map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]}>
          <boxGeometry args={[w as number, h as number, d as number]} />
          <meshPhongMaterial color={0xd4af37} shininess={200} />
        </mesh>
      ))}

      {/* Reception desk */}
      <group position={[0, 0, -2.5]}>
        <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.5, 1.1, 1.0]} />
          <meshPhongMaterial color={0x0d0d1a} shininess={60} />
        </mesh>
        <mesh position={[0, 1.11, 0]}>
          <boxGeometry args={[4.55, 0.05, 1.05]} />
          <meshPhongMaterial color={0xc8a000} shininess={200} />
        </mesh>
        <mesh position={[0, 0.55, 0.52]}>
          <boxGeometry args={[4.55, 1.12, 0.04]} />
          <meshPhongMaterial color={0xb89000} shininess={150} />
        </mesh>
        <mesh position={[0, 0.55, 0.54]}>
          <boxGeometry args={[3.0, 0.3, 0.01]} />
          <meshPhongMaterial color={0xd4af37} shininess={180} />
        </mesh>

        {/* Monitor on desk */}
        <mesh position={[1.2, 1.17, -0.18]} castShadow>
          <boxGeometry args={[0.32, 0.03, 0.22]} />
          <meshLambertMaterial color={0x222222} />
        </mesh>
        <mesh position={[1.2, 1.32, -0.22]} castShadow>
          <boxGeometry args={[0.05, 0.28, 0.05]} />
          <meshLambertMaterial color={0x222222} />
        </mesh>
        <mesh position={[1.2, 1.52, -0.23]} castShadow>
          <boxGeometry args={[0.58, 0.38, 0.04]} />
          <meshLambertMaterial color={0x111111} />
        </mesh>
        <mesh position={[1.2, 1.52, -0.21]}>
          <boxGeometry args={[0.52, 0.32, 0.01]} />
          <meshBasicMaterial ref={screenRef} color={0x1a3a6e} />
        </mesh>
      </group>

      {/* Evaana - Standing Receptionist NPC */}
      <StandingReceptionist
        agentId="evaana-receptionist"
        agentName="Evaana"
        agentRole="Head Receptionist"
        position={[0, 0, -3.2]}
        rotation={0}
        onChat={onAgentChat}
        isWaving={isAgentWaving}
        showHud={showAgentHud}
      />

      {/* LED accent strips */}
      {[-W / 2 + 0.5, W / 2 - 0.5].map((x, i) => (
        <mesh key={i} position={[x, FH - 0.3, 0]}>
          <boxGeometry args={[0.08, 0.06, D - 1]} />
          <meshBasicMaterial color={0x4488ff} />
        </mesh>
      ))}

      {/* ─── Glass Wall Panels - Left Side ─── */}
      <group position={[-W / 2 + 0.12, 0, 0]}>
        {/* Glass panels - transparent see-through */}
        {[-3.5, -1.5, 0.5, 2.5].map((z, i) => (
          <group key={i}>
            <mesh position={[0.02, FH / 2, z]}>
              <boxGeometry args={[0.04, FH - 0.4, 1.8]} />
              <meshPhongMaterial 
                color={0xaaddff} 
                transparent 
                opacity={0.15} 
                shininess={300}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Vertical frame dividers - thin */}
            <mesh position={[0, FH / 2, z - 0.95]}>
              <boxGeometry args={[0.06, FH, 0.04]} />
              <meshLambertMaterial color={0x1a1a2a} />
            </mesh>
            <mesh position={[0, FH / 2, z + 0.95]}>
              <boxGeometry args={[0.06, FH, 0.04]} />
              <meshLambertMaterial color={0x1a1a2a} />
            </mesh>
          </group>
        ))}
        {/* Horizontal frame divider - thin */}
        <mesh position={[0, FH / 2, 0]}>
          <boxGeometry args={[0.06, 0.06, D - 0.5]} />
          <meshLambertMaterial color={0x1a1a2a} />
        </mesh>
      </group>

      {/* ─── Glass Wall Panels - Right Side ─── */}
      <group position={[W / 2 - 0.12, 0, 0]}>
        {/* Glass panels - transparent see-through */}
        {[-3.5, -1.5, 0.5, 2.5].map((z, i) => (
          <group key={i}>
            <mesh position={[-0.02, FH / 2, z]}>
              <boxGeometry args={[0.04, FH - 0.4, 1.8]} />
              <meshPhongMaterial 
                color={0xaaddff} 
                transparent 
                opacity={0.15} 
                shininess={300}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Vertical frame dividers - thin */}
            <mesh position={[0, FH / 2, z - 0.95]}>
              <boxGeometry args={[0.06, FH, 0.04]} />
              <meshLambertMaterial color={0x1a1a2a} />
            </mesh>
            <mesh position={[0, FH / 2, z + 0.95]}>
              <boxGeometry args={[0.06, FH, 0.04]} />
              <meshLambertMaterial color={0x1a1a2a} />
            </mesh>
          </group>
        ))}
        {/* Horizontal frame divider - thin */}
        <mesh position={[0, FH / 2, 0]}>
          <boxGeometry args={[0.06, 0.06, D - 0.5]} />
          <meshLambertMaterial color={0x1a1a2a} />
        </mesh>
      </group>

      {/* ─── Glass Wall Panels - Back Side (Lobby) ─── */}
      <group position={[0, 0, -D / 2 + 0.12]}>
        {/* Glass panels - transparent see-through, full width */}
        {[-5, -2.5, 0, 2.5, 5].map((x, i) => (
          <group key={i}>
            <mesh position={[x, FH / 2, 0.02]}>
              <boxGeometry args={[2.2, FH - 0.4, 0.04]} />
              <meshPhongMaterial 
                color={0xaaddff} 
                transparent 
                opacity={0.15} 
                shininess={300}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Vertical frame dividers - thin */}
            <mesh position={[x - 1.15, FH / 2, 0]}>
              <boxGeometry args={[0.04, FH, 0.06]} />
              <meshLambertMaterial color={0x1a1a2a} />
            </mesh>
            <mesh position={[x + 1.15, FH / 2, 0]}>
              <boxGeometry args={[0.04, FH, 0.06]} />
              <meshLambertMaterial color={0x1a1a2a} />
            </mesh>
          </group>
        ))}
        {/* Horizontal frame divider - thin */}
        <mesh position={[0, FH / 2, 0]}>
          <boxGeometry args={[W - 0.5, 0.06, 0.06]} />
          <meshLambertMaterial color={0x1a1a2a} />
        </mesh>
      </group>


      {/* ─── Glass Wall Panels - Front Side (Lobby) ─── */}
      <group position={[0, 0, D / 2 - 0.12]}>
        {/* Glass panels - transparent see-through */}
        {[-5, -2.5, 0, 2.5, 5].map((x, i) => (
          <group key={i}>
            <mesh position={[x, FH / 2, -0.02]}>
              <boxGeometry args={[2.2, FH - 0.4, 0.04]} />
              <meshPhongMaterial 
                color={0xaaddff} 
                transparent 
                opacity={0.15} 
                shininess={300}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Vertical frame dividers - thin */}
            <mesh position={[x - 1.15, FH / 2, 0]}>
              <boxGeometry args={[0.04, FH, 0.06]} />
              <meshLambertMaterial color={0x1a1a2a} />
            </mesh>
            <mesh position={[x + 1.15, FH / 2, 0]}>
              <boxGeometry args={[0.04, FH, 0.06]} />
              <meshLambertMaterial color={0x1a1a2a} />
            </mesh>
          </group>
        ))}
        {/* Horizontal frame divider - thin */}
        <mesh position={[0, FH / 2, 0]}>
          <boxGeometry args={[W - 0.5, 0.06, 0.06]} />
          <meshLambertMaterial color={0x1a1a2a} />
        </mesh>
      </group>

      <pointLight position={[0, 2.5, 0]} intensity={0.8} color={0x3355aa} distance={12} />
      <pointLight position={[-4, 2, -3]} intensity={0.4} color={0xffffff} distance={8} />
    </group>
  );
}

function useRugTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const W = 512;
    const H = 320;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, W, H);
    const gr = ctx.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, "#0a0a0a");
    gr.addColorStop(0.5, "#111111");
    gr.addColorStop(1, "#0a0a0a");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, W - 16, H - 16);
    ctx.strokeStyle = "#c8a000";
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 16, W - 32, H - 32);
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 80px Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TROOTHHERTZ LLC", W / 2, H / 2);
    return new THREE.CanvasTexture(canvas);
  }, []);
}

function PresidentialOffice({ position, deskPhotoTexture, wallArtTexture, doorLogoTexture }: {
  position: [number, number, number];
  deskPhotoTexture: THREE.Texture | null;
  wallArtTexture: THREE.Texture | null;
  doorLogoTexture: THREE.Texture | null;
}) {
  const tvRef = useRef<THREE.Mesh>(null);
  const fishRef = useRef<THREE.Group>(null);
  const rugTex = useRugTexture();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (tvRef.current) {
      const mat = tvRef.current.material as THREE.MeshBasicMaterial;
      const hue = (t * 0.05) % 1;
      mat.color.setHSL(hue, 0.6, 0.35);
    }
    if (fishRef.current) {
      fishRef.current.position.y = Math.sin(t * 1.2) * 0.04;
    }
  });

  return (
    <group position={position}>
      {/* Marble floor - same as lobby */}
      <MarbleFloor w={W - 0.5} d={D - 0.5} />

      {/* Area rug under CEO desk — TROOTHHERTZ LLC (yellow gold & black) */}
      <mesh position={[0, 0.05, -1.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4.2, 2.8]} />
        <meshPhongMaterial map={rugTex} shininess={30} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>

      <mesh position={[0, FH - 0.1, 0]}>
        <boxGeometry args={[W - 0.5, 0.1, D - 0.5]} />
        <meshLambertMaterial color={0x0a0a0f} />
      </mesh>
      {[[-3.5, -2.5], [0, -2.5], [3.5, -2.5], [-3.5, 0.5], [0, 0.5], [3.5, 0.5]].map(([x, z], i) => (
        <mesh key={i} position={[x as number, FH - 0.22, z as number]}>
          <boxGeometry args={[2.8, 0.06, 2.8]} />
          <meshLambertMaterial color={0x0d0d18} />
        </mesh>
      ))}

      <group position={[0, 0, -1.5]}>
        <mesh position={[0, 0.82, 0]} castShadow receiveShadow>
          <boxGeometry args={[3.2, 0.06, 1.4]} />
          <meshPhongMaterial color={0x0a2a2a} transparent opacity={0.75} shininess={300} />
        </mesh>
        <mesh position={[0, 0.82, 0]}>
          <boxGeometry args={[3.26, 0.03, 1.46]} />
          <meshPhongMaterial color={0xc8a000} shininess={200} wireframe={false} />
        </mesh>
        {[[-1.4, -0.55], [1.4, -0.55], [-1.4, 0.55], [1.4, 0.55]].map(([x, z], i) => (
          <mesh key={i} position={[x as number, 0.41, z as number]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.82, 8]} />
            <meshPhongMaterial color={0xd4af37} shininess={300} />
          </mesh>
        ))}
        {/* Photo frame sitting ON desk - raised to proper height */}
        <mesh position={[1.3, 1.18, 0.45]} rotation={[0.15, -0.3, 0]} castShadow>
          <boxGeometry args={[0.5, 0.65, 0.04]} />
          <meshLambertMaterial color={0xd4af37} />
        </mesh>
        {deskPhotoTexture && (
          <mesh position={[1.3, 1.18, 0.47]} rotation={[0.15, -0.3, 0]}>
            <boxGeometry args={[0.44, 0.58, 0.01]} />
            <meshBasicMaterial map={deskPhotoTexture} />
          </mesh>
        )}
        <mesh position={[-0.8, 1.18, -0.3]} castShadow>
          <boxGeometry args={[0.7, 0.44, 0.04]} />
          <meshLambertMaterial color={0x0a0a0a} />
        </mesh>
        <mesh position={[-0.8, 1.18, -0.27]}>
          <boxGeometry args={[0.64, 0.38, 0.01]} />
          <meshBasicMaterial color={0x1a3a6e} />
        </mesh>
        <mesh position={[-0.2, 0.86, -0.1]} castShadow>
          <boxGeometry args={[0.44, 0.02, 0.16]} />
          <meshLambertMaterial color={0x111111} />
        </mesh>
      </group>

      <mesh position={[0, 2.4, -D / 2 + 0.2]} castShadow>
        <boxGeometry args={[4.2, 2.4, 0.1]} />
        <meshLambertMaterial color={0x080808} />
      </mesh>
      <mesh ref={tvRef} position={[0, 2.4, -D / 2 + 0.26]}>
        <boxGeometry args={[4.0, 2.2, 0.01]} />
        <meshBasicMaterial color={0x1a2a3a} />
      </mesh>

      {[-2.5, 0, 2.5].map((z, i) => (
        <group key={i} position={[W / 2 - 0.13, 0, z]}>
          <mesh>
            <boxGeometry args={[0.08, 2.6, 1.8]} />
            <meshLambertMaterial color={0x0d0d1a} />
          </mesh>
          <mesh position={[0.02, 0, 0]}>
            <boxGeometry args={[0.04, 2.4, 1.6]} />
            <meshPhongMaterial color={0x4488cc} transparent opacity={0.35} shininess={200} />
          </mesh>
          <mesh position={[0.01, 0.2, 0]}>
            <boxGeometry args={[0.06, 0.06, 1.82]} />
            <meshLambertMaterial color={0x1a1a2a} />
          </mesh>
        </group>
      ))}

      <group position={[W / 2 - 1.2, 0, 0]}>
        <mesh position={[0, 1.2, 0]} castShadow>
          <boxGeometry args={[0.2, 2.0, 2.4]} />
          <meshPhongMaterial color={0x0a2a3a} transparent opacity={0.35} shininess={200} />
        </mesh>
        <mesh position={[0, 1.15, 0]}>
          <boxGeometry args={[0.16, 1.9, 2.3]} />
          <meshPhongMaterial color={0x0a4a6a} transparent opacity={0.4} shininess={100} />
        </mesh>
        <mesh position={[0, 0.12, 0]} castShadow>
          <boxGeometry args={[0.25, 0.24, 2.5]} />
          <meshLambertMaterial color={0x0d0d1a} />
        </mesh>
        <group ref={fishRef} position={[0, 1.2, 0]}>
          {[[-0.5, 0.2], [0.4, -0.3], [0, 0.5]].map(([fz, fy], i) => (
            <mesh key={i} position={[0, fy as number, fz as number]}>
              <sphereGeometry args={[0.06, 6, 4]} />
              <meshBasicMaterial color={[0xff6600, 0xff2200, 0xffaa00][i]} />
            </mesh>
          ))}
        </group>
        <mesh position={[0, 2.22, 0]}>
          <boxGeometry args={[0.22, 0.06, 2.42]} />
          <meshLambertMaterial color={0x1a1a1a} />
        </mesh>
        <pointLight position={[0, 1.5, 0]} intensity={0.5} color={0x00aaff} distance={4} />
      </group>

      {/* ─── Glass Wall Panels - Left Side (Executive) ─── */}
      <group position={[-W / 2 + 0.12, 0, 0]}>
        {/* Glass panels - transparent see-through */}
        {[-3.5, -1.5, 0.5, 2.5].map((z, i) => (
          <group key={i}>
            <mesh position={[0.02, FH / 2, z]}>
              <boxGeometry args={[0.04, FH - 0.4, 1.8]} />
              <meshPhongMaterial 
                color={0xaaddff} 
                transparent 
                opacity={0.15} 
                shininess={300}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Vertical frame dividers - thin */}
            <mesh position={[0, FH / 2, z - 0.95]}>
              <boxGeometry args={[0.06, FH, 0.04]} />
              <meshLambertMaterial color={0x1a1a2a} />
            </mesh>
            <mesh position={[0, FH / 2, z + 0.95]}>
              <boxGeometry args={[0.06, FH, 0.04]} />
              <meshLambertMaterial color={0x1a1a2a} />
            </mesh>
          </group>
        ))}
        {/* Horizontal frame divider - thin */}
        <mesh position={[0, FH / 2, 0]}>
          <boxGeometry args={[0.06, 0.06, D - 0.5]} />
          <meshLambertMaterial color={0x1a1a2a} />
        </mesh>
      </group>

      {/* Wall art (smaller, mounted on glass) */}
      <mesh position={[-W / 2 + 0.2, 2.2, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <boxGeometry args={[1.8, 2.4, 0.06]} />
        <meshLambertMaterial color={0x1a0d05} />
      </mesh>
      {wallArtTexture && (
        <mesh position={[-W / 2 + 0.24, 2.2, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[1.6, 2.2, 0.01]} />
          <meshBasicMaterial map={wallArtTexture} />
        </mesh>
      )}

      {/* ─── Glass Wall Panels - Back Side (Executive) ─── */}
      <group position={[0, 0, -D / 2 + 0.12]}>
        {/* Glass panels - avoiding TV area in center and door on right */}
        {[-5, -2.5].map((x, i) => (
          <group key={i}>
            <mesh position={[x, FH / 2, 0.02]}>
              <boxGeometry args={[2.2, FH - 0.4, 0.04]} />
              <meshPhongMaterial 
                color={0xaaddff} 
                transparent 
                opacity={0.15} 
                shininess={300}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Vertical frame dividers - thin */}
            <mesh position={[x - 1.15, FH / 2, 0]}>
              <boxGeometry args={[0.04, FH, 0.06]} />
              <meshLambertMaterial color={0x1a1a2a} />
            </mesh>
            <mesh position={[x + 1.15, FH / 2, 0]}>
              <boxGeometry args={[0.04, FH, 0.06]} />
              <meshLambertMaterial color={0x1a1a2a} />
            </mesh>
          </group>
        ))}
        {/* Horizontal frame divider - thin (left side only, avoiding TV) */}
        <mesh position={[-3.75, FH / 2, 0]}>
          <boxGeometry args={[5.5, 0.06, 0.06]} />
          <meshLambertMaterial color={0x1a1a2a} />
        </mesh>
      </group>

      {/* Door frame section on back right corner */}
      <group position={[4, 0, -D / 2 + 0.15]}>
        <mesh position={[0, 1.5, 0]}>
          <boxGeometry args={[1.4, 3.0, 0.12]} />
          <meshLambertMaterial color={0x0a0a14} />
        </mesh>
        <group position={[0.65, 0, 0.08]} rotation={[0, Math.PI * 0.44, 0]}>
          <mesh position={[-0.6, 1.5, 0]} castShadow>
            <boxGeometry args={[1.2, 2.8, 0.06]} />
            <meshPhongMaterial color={0x0d0d1a} shininess={40} />
          </mesh>
          {doorLogoTexture && (
            <mesh position={[-0.6, 1.5, -0.04]}>
              <boxGeometry args={[0.9, 0.9, 0.01]} />
              <meshBasicMaterial map={doorLogoTexture} transparent />
            </mesh>
          )}
        </group>
      </group>

      {/* ─── Glass Wall Panels - Front Side (Executive) ─── */}
      <group position={[0, 0, D / 2 - 0.12]}>
        {/* Glass panels - transparent see-through */}
        {[-5, -2.5, 0, 2.5, 5].map((x, i) => (
          <group key={i}>
            <mesh position={[x, FH / 2, -0.02]}>
              <boxGeometry args={[2.2, FH - 0.4, 0.04]} />
              <meshPhongMaterial 
                color={0xaaddff} 
                transparent 
                opacity={0.15} 
                shininess={300}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Vertical frame dividers - thin */}
            <mesh position={[x - 1.15, FH / 2, 0]}>
              <boxGeometry args={[0.04, FH, 0.06]} />
              <meshLambertMaterial color={0x1a1a2a} />
            </mesh>
            <mesh position={[x + 1.15, FH / 2, 0]}>
              <boxGeometry args={[0.04, FH, 0.06]} />
              <meshLambertMaterial color={0x1a1a2a} />
            </mesh>
          </group>
        ))}
        {/* Horizontal frame divider - thin */}
        <mesh position={[0, FH / 2, 0]}>
          <boxGeometry args={[W - 0.5, 0.06, 0.06]} />
          <meshLambertMaterial color={0x1a1a2a} />
        </mesh>
      </group>

      <pointLight position={[0, 3.5, 0]} intensity={1.2} color={0xfff0d0} distance={14} />
      <pointLight position={[-5, 2, -3]} intensity={0.5} color={0xd4af37} distance={8} />
      <pointLight position={[5, 2, 2]} intensity={0.4} color={0x3355aa} distance={6} />
    </group>
  );
}

interface TroothSeatedAgentProps {
  agentId: string;
  agentName: string;
  agentRole: string;
  skinTone: number;
  suitColor: number;
  position: [number, number, number];
  rotation?: number;
  onChat: () => void;
  isWaving?: boolean;
  hasBeanie?: boolean;
  hasChain?: boolean;
  chairColor?: number;
  showHud?: boolean;
  showMonitor?: boolean;
}

function TroothSeatedAgent({
  agentId, agentName, agentRole, skinTone, suitColor,
  position, rotation = 0, onChat, isWaving = false,
  hasBeanie = false, hasChain = false, chairColor = 0x1a1a1a,
  showHud = true, showMonitor = true,
}: TroothSeatedAgentProps) {
  const headRef   = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftArmRef  = useRef<THREE.Group>(null);
  const torsoRef  = useRef<THREE.Group>(null);
  const [waveTimer, setWaveTimer] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (isWaving) setWaveTimer(2.5);
  }, [isWaving]);

  const phase = agentId.charCodeAt(agentId.length - 1) * 0.6;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (headRef.current) {
      headRef.current.position.y = 0.82 + Math.sin(t * 0.9 + phase) * 0.008;
      headRef.current.rotation.z = Math.sin(t * 0.4 + phase) * 0.03;
      headRef.current.rotation.y = Math.sin(t * 0.25 + phase) * 0.12;
    }
    if (rightArmRef.current) {
      if (waveTimer > 0) {
        rightArmRef.current.rotation.z = -Math.PI * 0.6 + Math.sin(t * 6) * 0.4;
        rightArmRef.current.rotation.x = -0.3;
      } else {
        rightArmRef.current.rotation.x = -0.6 + Math.sin(t * 4.5 + phase) * 0.12;
        rightArmRef.current.rotation.z = -0.15;
      }
    }
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = -0.5 + Math.sin(t * 3.8 + phase + 1) * 0.08;
      leftArmRef.current.rotation.z = 0.15;
    }
    if (torsoRef.current) {
      torsoRef.current.rotation.z = Math.sin(t * 0.6 + phase) * 0.015;
      torsoRef.current.position.y = Math.sin(t * 0.6 + phase) * 0.005;
    }
    if (waveTimer > 0) setWaveTimer(prev => Math.max(0, prev - 0.016));
  });

  // Professional suit colors
  const suitJacket = 0x1a1a2a;      // Dark navy suit
  const suitPants = 0x1a1a2a;       // Matching pants
  const shirtColor = 0xffffff;      // Crisp white shirt
  const tieColor = 0x8b0000;        // Deep burgundy/maroon tie
  const shoeColor = 0x1a0a00;       // Black dress shoes
  const hairColor = 0x1a0a00;       // Dark hair

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* ─── Executive Chair ─── */}
      {/* Chair seat - leather cushion */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.48, 0.08, 0.48]} />
        <meshPhongMaterial color={chairColor} shininess={60} />
      </mesh>
      {/* Chair back - tall executive style */}
      <mesh position={[0, 0.82, -0.22]} castShadow>
        <boxGeometry args={[0.46, 0.72, 0.06]} />
        <meshPhongMaterial color={chairColor} shininess={60} />
      </mesh>
      {/* Chair headrest */}
      <mesh position={[0, 1.22, -0.22]} castShadow>
        <boxGeometry args={[0.32, 0.12, 0.06]} />
        <meshPhongMaterial color={chairColor} shininess={60} />
      </mesh>
      {/* Chair stem */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.38, 8]} />
        <meshPhongMaterial color={0xc0c0c0} shininess={200} />
      </mesh>
      {/* Chair base */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 0.04, 5]} />
        <meshLambertMaterial color={0x333333} />
      </mesh>
      {/* Chair armrests */}
      {[-0.26, 0.26].map((x, i) => (
        <group key={i}>
          <mesh position={[x, 0.58, 0]} castShadow>
            <boxGeometry args={[0.04, 0.04, 0.38]} />
            <meshPhongMaterial color={0xc0c0c0} shininess={200} />
          </mesh>
          <mesh position={[x, 0.61, 0]} castShadow>
            <boxGeometry args={[0.06, 0.02, 0.34]} />
            <meshPhongMaterial color={chairColor} shininess={60} />
          </mesh>
        </group>
      ))}

      {/* ─── Legs with Dress Pants ─── */}
      {[-0.1, 0.1].map((x, i) => (
        <group key={i}>
          {/* Upper leg (thigh) - seated position */}
          <mesh position={[x, 0.38, 0.08]} castShadow>
            <boxGeometry args={[0.12, 0.14, 0.32]} />
            <meshLambertMaterial color={suitPants} />
          </mesh>
          {/* Lower leg (calf) - bent at knee */}
          <mesh position={[x, 0.2, 0.22]} castShadow>
            <boxGeometry args={[0.11, 0.36, 0.11]} />
            <meshLambertMaterial color={suitPants} />
          </mesh>
          {/* Dress shoes - polished black */}
          <mesh position={[x, 0.04, 0.28]} castShadow>
            <boxGeometry args={[0.1, 0.06, 0.18]} />
            <meshPhongMaterial color={shoeColor} shininess={150} />
          </mesh>
          {/* Shoe sole */}
          <mesh position={[x, 0.01, 0.28]} castShadow>
            <boxGeometry args={[0.11, 0.02, 0.19]} />
            <meshLambertMaterial color={0x0a0a0a} />
          </mesh>
        </group>
      ))}

      {/* ─── Torso with Suit Jacket ─── */}
      <group ref={torsoRef} position={[0, 0.48, 0]}>
        {/* Main torso - suit jacket */}
        <mesh
          position={[0, 0.18, 0]}
          castShadow
          userData={{ agentId, agentName, agentRole }}
        >
          <boxGeometry args={[0.32, 0.38, 0.2]} />
          <meshPhongMaterial color={suitJacket} shininess={40} />
        </mesh>
        
        {/* Suit jacket lapels */}
        <mesh position={[-0.08, 0.28, 0.1]}>
          <boxGeometry args={[0.08, 0.2, 0.02]} />
          <meshPhongMaterial color={suitJacket} shininess={50} />
        </mesh>
        <mesh position={[0.08, 0.28, 0.1]}>
          <boxGeometry args={[0.08, 0.2, 0.02]} />
          <meshPhongMaterial color={suitJacket} shininess={50} />
        </mesh>
        
        {/* White dress shirt visible under jacket */}
        <mesh position={[0, 0.24, 0.1]}>
          <boxGeometry args={[0.12, 0.24, 0.02]} />
          <meshLambertMaterial color={shirtColor} />
        </mesh>
        
        {/* Necktie */}
        <mesh position={[0, 0.28, 0.115]}>
          <boxGeometry args={[0.06, 0.06, 0.01]} />
          <meshPhongMaterial color={tieColor} shininess={80} />
        </mesh>
        <mesh position={[0, 0.18, 0.115]}>
          <boxGeometry args={[0.055, 0.16, 0.01]} />
          <meshPhongMaterial color={tieColor} shininess={80} />
        </mesh>
        <mesh position={[0, 0.08, 0.115]}>
          <boxGeometry args={[0.07, 0.06, 0.01]} />
          <meshPhongMaterial color={tieColor} shininess={80} />
        </mesh>
        
        {/* Shirt collar */}
        <mesh position={[-0.06, 0.34, 0.09]} rotation={[0, 0, 0.3]}>
          <boxGeometry args={[0.05, 0.04, 0.02]} />
          <meshLambertMaterial color={shirtColor} />
        </mesh>
        <mesh position={[0.06, 0.34, 0.09]} rotation={[0, 0, -0.3]}>
          <boxGeometry args={[0.05, 0.04, 0.02]} />
          <meshLambertMaterial color={shirtColor} />
        </mesh>
        
        {/* Suit jacket buttons */}
        {[0.12, 0.02].map((y, i) => (
          <mesh key={i} position={[0, y, 0.105]}>
            <cylinderGeometry args={[0.012, 0.012, 0.01, 8]} />
            <meshPhongMaterial color={0x2a2a3a} shininess={100} />
          </mesh>
        ))}
        
        {/* Pocket square */}
        <mesh position={[-0.1, 0.28, 0.105]}>
          <boxGeometry args={[0.04, 0.03, 0.01]} />
          <meshLambertMaterial color={0xffffff} />
        </mesh>

        {/* ─── Right Arm with Suit Sleeve ─── */}
        <group ref={rightArmRef} position={[0.2, 0.28, 0]}>
          {/* Upper arm - suit sleeve */}
          <mesh position={[0.06, -0.08, 0.04]} castShadow>
            <boxGeometry args={[0.1, 0.2, 0.1]} />
            <meshPhongMaterial color={suitJacket} shininess={40} />
          </mesh>
          {/* Lower arm - suit sleeve */}
          <mesh position={[0.06, -0.22, 0.06]} castShadow>
            <boxGeometry args={[0.09, 0.12, 0.09]} />
            <meshPhongMaterial color={suitJacket} shininess={40} />
          </mesh>
          {/* Shirt cuff visible */}
          <mesh position={[0.06, -0.29, 0.06]} castShadow>
            <boxGeometry args={[0.075, 0.02, 0.075]} />
            <meshLambertMaterial color={shirtColor} />
          </mesh>
          {/* Hand */}
          <mesh position={[0.06, -0.33, 0.06]} castShadow>
            <boxGeometry args={[0.07, 0.08, 0.07]} />
            <meshLambertMaterial color={skinTone} />
          </mesh>
          {/* Watch */}
          <mesh position={[0.06, -0.27, 0.1]}>
            <boxGeometry args={[0.04, 0.03, 0.015]} />
            <meshPhongMaterial color={0xd4af37} shininess={300} />
          </mesh>
        </group>
        
        {/* ─── Left Arm with Suit Sleeve ─── */}
        <group ref={leftArmRef} position={[-0.2, 0.28, 0]}>
          {/* Upper arm - suit sleeve */}
          <mesh position={[-0.06, -0.08, 0.04]} castShadow>
            <boxGeometry args={[0.1, 0.2, 0.1]} />
            <meshPhongMaterial color={suitJacket} shininess={40} />
          </mesh>
          {/* Lower arm - suit sleeve */}
          <mesh position={[-0.06, -0.22, 0.06]} castShadow>
            <boxGeometry args={[0.09, 0.12, 0.09]} />
            <meshPhongMaterial color={suitJacket} shininess={40} />
          </mesh>
          {/* Shirt cuff visible */}
          <mesh position={[-0.06, -0.29, 0.06]} castShadow>
            <boxGeometry args={[0.075, 0.02, 0.075]} />
            <meshLambertMaterial color={shirtColor} />
          </mesh>
          {/* Hand */}
          <mesh position={[-0.06, -0.33, 0.06]} castShadow>
            <boxGeometry args={[0.07, 0.08, 0.07]} />
            <meshLambertMaterial color={skinTone} />
          </mesh>
        </group>

        {/* Neck */}
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.06, 0.08, 8]} />
          <meshLambertMaterial color={skinTone} />
        </mesh>
      </group>

      {/* ─── Head ─── */}
      <mesh
        ref={headRef}
        position={[0, 1.3, 0]}
        castShadow
        userData={{ agentId, agentName, agentRole }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onPointerDown={(e) => { e.stopPropagation(); onChat(); }}
      >
        <sphereGeometry args={[0.14, 12, 10]} />
        <meshLambertMaterial color={skinTone} />

        {/* Eyes - professional, focused look */}
        {[-0.045, 0.045].map((x, i) => (
          <group key={i} position={[x, 0.02, 0.12]}>
            <mesh>
              <sphereGeometry args={[0.028, 8, 8]} />
              <meshBasicMaterial color={0xffffff} />
            </mesh>
            <mesh position={[0, 0, 0.015]}>
              <sphereGeometry args={[0.016, 6, 6]} />
              <meshBasicMaterial color={0x3a2a1a} />
            </mesh>
            <mesh position={[0, 0, 0.022]}>
              <sphereGeometry args={[0.008, 4, 4]} />
              <meshBasicMaterial color={0x111111} />
            </mesh>
          </group>
        ))}
        
        {/* Eyebrows - distinguished */}
        {[-0.045, 0.045].map((x, i) => (
          <mesh key={i} position={[x, 0.06, 0.12]} rotation={[0, 0, i === 0 ? 0.1 : -0.1]}>
            <boxGeometry args={[0.05, 0.012, 0.01]} />
            <meshBasicMaterial color={hairColor} />
          </mesh>
        ))}
        
        {/* Nose */}
        <mesh position={[0, -0.01, 0.13]}>
          <boxGeometry args={[0.025, 0.04, 0.025]} />
          <meshLambertMaterial color={skinTone} />
        </mesh>
        
        {/* Confident smile */}
        <mesh position={[0, -0.05, 0.12]} rotation={[0.15, 0, 0]}>
          <torusGeometry args={[0.03, 0.005, 4, 8, Math.PI]} />
          <meshBasicMaterial color={0x8b5a5a} />
        </mesh>
        
        {/* Ears */}
        {[-0.13, 0.13].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]}>
            <sphereGeometry args={[0.025, 6, 6]} />
            <meshLambertMaterial color={skinTone} />
          </mesh>
        ))}
        
        {/* Professional short haircut */}
        <mesh position={[0, 0.08, -0.02]}>
          <sphereGeometry args={[0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshLambertMaterial color={hairColor} />
        </mesh>
        {/* Side hair */}
        <mesh position={[-0.12, 0.02, 0]}>
          <boxGeometry args={[0.04, 0.1, 0.12]} />
          <meshLambertMaterial color={hairColor} />
        </mesh>
        <mesh position={[0.12, 0.02, 0]}>
          <boxGeometry args={[0.04, 0.1, 0.12]} />
          <meshLambertMaterial color={hairColor} />
        </mesh>
        {/* Back of head hair */}
        <mesh position={[0, 0, -0.1]}>
          <boxGeometry args={[0.2, 0.14, 0.06]} />
          <meshLambertMaterial color={hairColor} />
        </mesh>
      </mesh>

      {/* ─── Executive Desk ─── */}
      <mesh position={[0, 0.72, -0.55]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.06, 0.7]} />
        <meshPhongMaterial color={0x2a1a0a} shininess={80} />
      </mesh>
      {/* Desk edge trim */}
      <mesh position={[0, 0.7, -0.2]}>
        <boxGeometry args={[1.22, 0.02, 0.02]} />
        <meshPhongMaterial color={0xd4af37} shininess={200} />
      </mesh>
      {/* Desk legs */}
      {[[-0.55, -0.55], [0.55, -0.55], [-0.55, -0.88], [0.55, -0.88]].map(([x, z], i) => (
        <mesh key={i} position={[x as number, 0.36, z as number]} castShadow>
          <boxGeometry args={[0.06, 0.72, 0.06]} />
          <meshPhongMaterial color={0x2a1a0a} shininess={60} />
        </mesh>
      ))}

      {/* ─── Monitor ─── */}
      {showMonitor && (
        <>
          <mesh position={[0, 1.08, -0.62]} castShadow>
            <boxGeometry args={[0.56, 0.36, 0.03]} />
            <meshLambertMaterial color={0x111111} />
          </mesh>
          <mesh position={[0, 1.08, -0.605]}>
            <boxGeometry args={[0.5, 0.3, 0.01]} />
            <meshBasicMaterial color={0x1a3a6e} />
          </mesh>
          <mesh position={[0, 0.82, -0.65]} castShadow>
            <boxGeometry args={[0.06, 0.2, 0.06]} />
            <meshLambertMaterial color={0x222222} />
          </mesh>
          <mesh position={[0, 0.755, -0.48]} castShadow>
            <boxGeometry args={[0.38, 0.02, 0.16]} />
            <meshLambertMaterial color={0x333333} />
          </mesh>
        </>
      )}

      {showHud && (
        <Html position={[0, 1.75, 0]} center distanceFactor={12} zIndexRange={[100, 110]}>
          <div
            onClick={onChat}
            style={{
              background: hovered ? "rgba(200,160,0,0.95)" : "rgba(8,12,24,0.9)",
              border: `1px solid ${hovered ? "#ffd700" : "rgba(200,160,0,0.5)"}`,
              borderRadius: 8,
              padding: "4px 12px",
              color: hovered ? "#000" : "#ffd700",
              fontFamily: "system-ui, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 12px rgba(0,0,0,0.6)",
              userSelect: "none",
              transition: "all 0.2s",
            }}
          >
            {agentName}
            <span style={{ marginLeft: 6, fontSize: 9, opacity: 0.75 }}>{agentRole}</span>
            {waveTimer > 0 && <span style={{ marginLeft: 6 }}>👋</span>}
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Standing Receptionist NPC (Evaana) ───────────────────────────────────────
interface StandingReceptionistProps {
  agentId: string;
  agentName: string;
  agentRole: string;
  position: [number, number, number];
  rotation?: number;
  onChat: () => void;
  isWaving?: boolean;
  showHud?: boolean;
}

function StandingReceptionist({
  agentId, agentName, agentRole, position, rotation = 0, onChat, isWaving = false,
  showHud = true,
}: StandingReceptionistProps) {
  const headRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const hairRef = useRef<THREE.Group>(null);
  const [waveTimer, setWaveTimer] = useState(0);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (isWaving) setWaveTimer(3.0);
  }, [isWaving]);

  const phase = agentId.charCodeAt(agentId.length - 1) * 0.6;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    
    // Head movement - looking around, slight tilt
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.3 + phase) * 0.15;
      headRef.current.rotation.z = Math.sin(t * 0.5 + phase) * 0.03;
      headRef.current.position.y = 1.55 + Math.sin(t * 0.8 + phase) * 0.005;
    }
    
    // Hair sway
    if (hairRef.current) {
      hairRef.current.rotation.z = Math.sin(t * 0.4 + phase) * 0.02;
    }
    
    // Torso slight sway
    if (torsoRef.current) {
      torsoRef.current.rotation.z = Math.sin(t * 0.4 + phase) * 0.01;
      torsoRef.current.position.y = Math.sin(t * 0.5 + phase) * 0.003;
    }
    
    // Arms - waving or idle gestures
    if (rightArmRef.current) {
      if (waveTimer > 0) {
        rightArmRef.current.rotation.z = -Math.PI * 0.55 + Math.sin(t * 7) * 0.35;
        rightArmRef.current.rotation.x = -0.2;
      } else {
        // Idle gesture - slight movement
        rightArmRef.current.rotation.z = -0.1 + Math.sin(t * 2.5 + phase) * 0.08;
        rightArmRef.current.rotation.x = Math.sin(t * 1.5 + phase) * 0.06;
      }
    }
    if (leftArmRef.current) {
      // Left arm resting on desk gesture
      leftArmRef.current.rotation.z = 0.15 + Math.sin(t * 2 + phase) * 0.05;
      leftArmRef.current.rotation.x = -0.4 + Math.sin(t * 1.8 + phase) * 0.04;
    }
    
    if (waveTimer > 0) setWaveTimer(prev => Math.max(0, prev - 0.016));
  });

  // Brown-skinned supermodel appearance
  const skinTone = 0x8B5A2B;      // Rich brown skin tone
  const blouseColor = 0x1a3a6e;   // Navy blouse
  const skirtColor = 0x0d0d1a;    // Dark skirt
  const hairColor = 0x1a0a00;     // Dark black hair

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Legs */}
      {[-0.08, 0.08].map((x, i) => (
        <mesh key={i} position={[x, 0.45, 0]} castShadow>
          <boxGeometry args={[0.1, 0.9, 0.1]} />
          <meshLambertMaterial color={skinTone} />
        </mesh>
      ))}
      
      {/* Skirt */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.5, 8]} />
        <meshLambertMaterial color={skirtColor} />
      </mesh>
      
      {/* Torso */}
      <group ref={torsoRef} position={[0, 1.1, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.32, 0.45, 0.18]} />
          <meshLambertMaterial color={blouseColor} />
        </mesh>
        
        {/* Collar */}
        <mesh position={[0, 0.2, 0.08]}>
          <boxGeometry args={[0.15, 0.08, 0.04]} />
          <meshLambertMaterial color={0xffffff} />
        </mesh>
        
        {/* Necklace */}
        <mesh position={[0, 0.12, 0.1]}>
          <torusGeometry args={[0.06, 0.008, 6, 12, Math.PI]} />
          <meshPhongMaterial color={0xd4af37} shininess={300} />
        </mesh>
        
        {/* Name badge */}
        <mesh position={[0.1, 0.05, 0.1]}>
          <boxGeometry args={[0.12, 0.06, 0.01]} />
          <meshPhongMaterial color={0xd4af37} shininess={200} />
        </mesh>
        
        {/* Right arm */}
        <group ref={rightArmRef} position={[0.2, 0.15, 0]}>
          <mesh position={[0.06, -0.15, 0]} castShadow>
            <boxGeometry args={[0.08, 0.3, 0.08]} />
            <meshLambertMaterial color={blouseColor} />
          </mesh>
          <mesh position={[0.06, -0.32, 0]} castShadow>
            <boxGeometry args={[0.07, 0.08, 0.07]} />
            <meshLambertMaterial color={skinTone} />
          </mesh>
        </group>
        
        {/* Left arm */}
        <group ref={leftArmRef} position={[-0.2, 0.15, 0]}>
          <mesh position={[-0.06, -0.15, 0]} castShadow>
            <boxGeometry args={[0.08, 0.3, 0.08]} />
            <meshLambertMaterial color={blouseColor} />
          </mesh>
          <mesh position={[-0.06, -0.32, 0]} castShadow>
            <boxGeometry args={[0.07, 0.08, 0.07]} />
            <meshLambertMaterial color={skinTone} />
          </mesh>
        </group>
        
        {/* Neck */}
        <mesh position={[0, 0.28, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 0.1, 8]} />
          <meshLambertMaterial color={skinTone} />
        </mesh>
      </group>
      
      {/* Head */}
      <mesh
        ref={headRef}
        position={[0, 1.55, 0]}
        castShadow
        userData={{ agentId, agentName, agentRole }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onPointerDown={(e) => { e.stopPropagation(); onChat(); }}
      >
        <sphereGeometry args={[0.14, 12, 10]} />
        <meshLambertMaterial color={skinTone} />
        
        {/* Eyes - larger expressive eyes */}
        {[-0.045, 0.045].map((x, i) => (
          <group key={i} position={[x, 0.02, 0.12]}>
            <mesh>
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshBasicMaterial color={0xffffff} />
            </mesh>
            <mesh position={[0, 0, 0.016]}>
              <sphereGeometry args={[0.018, 6, 6]} />
              <meshBasicMaterial color={0x4a3020} />
            </mesh>
            <mesh position={[0, 0, 0.024]}>
              <sphereGeometry args={[0.008, 4, 4]} />
              <meshBasicMaterial color={0x111111} />
            </mesh>
            {/* Eye highlight */}
            <mesh position={[0.005, 0.005, 0.026]}>
              <sphereGeometry args={[0.003, 4, 4]} />
              <meshBasicMaterial color={0xffffff} />
            </mesh>
          </group>
        ))}
        
        {/* Eyebrows - defined arched brows */}
        {[-0.045, 0.045].map((x, i) => (
          <mesh key={i} position={[x, 0.06, 0.12]} rotation={[0, 0, i === 0 ? 0.2 : -0.2]}>
            <boxGeometry args={[0.045, 0.01, 0.01]} />
            <meshBasicMaterial color={0x1a0a00} />
          </mesh>
        ))}
        
        {/* Nose */}
        <mesh position={[0, -0.01, 0.13]}>
          <boxGeometry args={[0.02, 0.03, 0.02]} />
          <meshLambertMaterial color={skinTone} />
        </mesh>
        
        {/* Smile */}
        <mesh position={[0, -0.05, 0.12]} rotation={[0.2, 0, 0]}>
          <torusGeometry args={[0.03, 0.006, 4, 8, Math.PI]} />
          <meshBasicMaterial color={0xcc6666} />
        </mesh>
        
        {/* Lips - fuller supermodel lips */}
        <mesh position={[0, -0.045, 0.13]}>
          <boxGeometry args={[0.05, 0.018, 0.012]} />
          <meshLambertMaterial color={0xb85050} />
        </mesh>
        {/* Upper lip highlight */}
        <mesh position={[0, -0.04, 0.135]}>
          <boxGeometry args={[0.035, 0.006, 0.005]} />
          <meshPhongMaterial color={0xd06060} shininess={100} />
        </mesh>
        
        {/* Ears */}
        {[-0.13, 0.13].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]}>
            <sphereGeometry args={[0.025, 6, 6]} />
            <meshLambertMaterial color={skinTone} />
          </mesh>
        ))}
        
        {/* Earrings */}
        {[-0.14, 0.14].map((x, i) => (
          <mesh key={i} position={[x, -0.04, 0]}>
            <sphereGeometry args={[0.012, 6, 6]} />
            <meshPhongMaterial color={0xd4af37} shininess={300} />
          </mesh>
        ))}
      </mesh>
      
      {/* Hair */}
      <group ref={hairRef} position={[0, 1.55, 0]}>
        {/* Main hair - long flowing */}
        <mesh position={[0, 0.08, -0.02]} castShadow>
          <sphereGeometry args={[0.16, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          <meshLambertMaterial color={hairColor} />
        </mesh>
        
        {/* Hair bangs */}
        <mesh position={[0, 0.1, 0.08]}>
          <boxGeometry args={[0.22, 0.06, 0.08]} />
          <meshLambertMaterial color={hairColor} />
        </mesh>
        
        {/* Side hair - left */}
        <mesh position={[-0.12, -0.1, 0]} castShadow>
          <boxGeometry args={[0.08, 0.35, 0.1]} />
          <meshLambertMaterial color={hairColor} />
        </mesh>
        
        {/* Side hair - right */}
        <mesh position={[0.12, -0.1, 0]} castShadow>
          <boxGeometry args={[0.08, 0.35, 0.1]} />
          <meshLambertMaterial color={hairColor} />
        </mesh>
        
        {/* Back hair - long */}
        <mesh position={[0, -0.2, -0.06]} castShadow>
          <boxGeometry args={[0.2, 0.55, 0.08]} />
          <meshLambertMaterial color={hairColor} />
        </mesh>
      </group>
      
      {/* Interactive HUD */}
      {showHud && (
        <Html position={[0, 2.0, 0]} center distanceFactor={10} zIndexRange={[100, 110]}>
          <div
            onClick={onChat}
            style={{
              background: hovered ? "rgba(26,58,110,0.95)" : "rgba(8,12,24,0.9)",
              border: `2px solid ${hovered ? "#4488ff" : "rgba(68,136,255,0.5)"}`,
              borderRadius: 10,
              padding: "6px 14px",
              color: hovered ? "#fff" : "#88bbff",
              fontFamily: "system-ui, sans-serif",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 16px rgba(0,0,0,0.6)",
              userSelect: "none",
              transition: "all 0.2s",
            }}
          >
            💬 {agentName}
            <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.8 }}>{agentRole}</span>
            {waveTimer > 0 && <span style={{ marginLeft: 6 }}>👋</span>}
          </div>
        </Html>
      )}
    </group>
  );
}

export default function TroothhertzTower({
  position,
  isSelected,
  onSelect,
  onEnterBuilding,
  onViewAgents,
  onAgentChat,
  currentFloor = 0,
  onFloorChange,
  elevatorUnlocked = false,
  showElevatorPad = false,
  onToggleElevatorPad,
  onElevatorRideStart,
  onElevatorRideEnd,
  onEnterCabin,
  wavingAgentId,
  insideBuilding = false,
  hoveredAgentId = null,
  cameraPos,
  onElevatorAccessDenied,
  onElevatorCallWhileLocked,
  onElevatorStateChange,
  playerNearElevator = false,
}: TroothhertzTowerProps) {
  const [deskPhotoTex, setDeskPhotoTex] = useState<THREE.Texture | null>(null);
  const [wallArtTex, setWallArtTex] = useState<THREE.Texture | null>(null);
  const [doorLogoTex, setDoorLogoTex] = useState<THREE.Texture | null>(null);
  const [lobbyWallTex, setLobbyWallTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new TextureLoader();
    loader.crossOrigin = "anonymous";
    loader.load(CDN_DESK_PHOTO, (t) => setDeskPhotoTex(t));
    loader.load(CDN_WALL_ART,   (t) => setWallArtTex(t));
    loader.load(CDN_DOOR_LOGO,  (t) => setDoorLogoTex(t));
    loader.load(LOBBY_WALL_IMAGE, (t) => setLobbyWallTex(t));
  }, []);

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const evaana = TROOTHHERTZ_AGENTS[0];
  const trooth = TROOTHHERTZ_AGENTS[1];

  const lobbyWorldPos: [number, number, number] = [
    position[0], position[1] + LOBBY_Y, position[2],
  ];
  const officeWorldPos: [number, number, number] = [
    position[0], position[1] + OFFICE_Y, position[2],
  ];

  const deskWorldZ = position[2] - 2.5;
  const nearDesk = insideBuilding && currentFloor === 0 && cameraPos != null &&
    Math.abs(cameraPos[0] - position[0]) < 3.5 &&
    Math.abs(cameraPos[2] - deskWorldZ) < 3.5;

  return (
    <group>
      <ExteriorShell
        position={position}
        isSelected={isSelected}
        onSelect={onSelect}
        hideExteriorDecor={insideBuilding}
      />

      {!insideBuilding && (
        <Html
          position={[position[0], position[1] + FH * 2 + 1.5, position[2]]}
          center
          distanceFactor={80}
          zIndexRange={[50, 60]}
        >
          <div style={{ fontFamily: "system-ui, sans-serif", userSelect: "none", textAlign: "center" }}>
            <div
              onClick={() => setDropdownOpen(v => !v)}
              style={{
                background: isSelected ? "rgba(255,215,0,0.95)" : "rgba(8,12,24,0.92)",
                border: `2px solid ${isSelected ? "#ffa500" : "#c8a000"}`,
                borderRadius: 12,
                padding: "7px 18px",
                color: isSelected ? "#000" : "#ffd700",
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 24px rgba(0,0,0,0.7)",
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}
            >
              🏢 TROOTHHERTZ LLC.
              <span style={{ marginLeft: 10, fontSize: 10, opacity: 0.75, fontWeight: 400, textTransform: "none" }}>
                {dropdownOpen ? "▲" : "▼"}
              </span>
            </div>
            {dropdownOpen && (
              <div style={{
                marginTop: 6,
                background: "rgba(8,10,20,0.97)",
                border: "1px solid rgba(200,160,0,0.5)",
                borderRadius: 10,
                overflow: "hidden",
                boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
                minWidth: 210,
              }}>
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setDropdownOpen(false); 
                    onEnterBuilding?.(); 
                  }}
                  style={{
                    width: "100%", padding: "10px 16px",
                    background: "linear-gradient(90deg,#5a3a00,#c8a000)",
                    border: "none", borderBottom: "1px solid rgba(200,160,0,0.2)",
                    color: "#fff", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                    pointerEvents: "auto",
                  }}
                >🚪 Enter Building</button>
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setDropdownOpen(false); 
                    if (onViewAgents) {
                      onViewAgents();
                    }
                  }}
                  style={{
                    width: "100%", padding: "10px 16px",
                    background: "transparent",
                    border: "none",
                    color: "#ffd700", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                    pointerEvents: "auto",
                  }}
                >👥 View AI Agents</button>
              </div>
            )}
          </div>
        </Html>
      )}

      <LobbyInterior
        position={lobbyWorldPos}
        doorLogoTexture={doorLogoTex}
        lobbyWallTexture={lobbyWallTex}
        onAgentChat={() => onAgentChat?.(evaana)}
        isAgentWaving={wavingAgentId === evaana.id}
        showAgentHud={hoveredAgentId === "evaana-receptionist"}
      />

      {nearDesk && (
        <Html
          position={[position[0], position[1] + LOBBY_Y + 1.6, position[2] - 1.8]}
          center
          distanceFactor={10}
          zIndexRange={[200, 210]}
        >
          <div style={{
            background: "rgba(8,10,20,0.92)",
            border: "1px solid rgba(212,175,55,0.7)",
            borderRadius: 8,
            padding: "6px 14px",
            color: "#ffd700",
            fontFamily: "system-ui, sans-serif",
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: "nowrap",
            boxShadow: "0 2px 12px rgba(0,0,0,0.7)",
            userSelect: "none",
            pointerEvents: "none",
            letterSpacing: 0.3,
          }}>
            💬 Click Evaana to chat
          </div>
        </Html>
      )}

      <PresidentialOffice
        position={officeWorldPos}
        deskPhotoTexture={deskPhotoTex}
        wallArtTexture={wallArtTex}
        doorLogoTexture={doorLogoTex}
      />

      {currentFloor === 1 && (
        <TroothSeatedAgent
          agentId={trooth.id}
          agentName={trooth.name}
          agentRole={trooth.role}
          skinTone={0xc87941}
          suitColor={0x1a1a2a}
          chairColor={0x1a1a1a}
          position={[position[0], position[1] + OFFICE_Y + 0.55, position[2] - 2.5]}
          rotation={0}
          onChat={() => onAgentChat?.(trooth)}
          isWaving={wavingAgentId === trooth.id}
          showHud={hoveredAgentId === trooth.id}
        />
      )}

      <FunctionalElevator
        position={[position[0] + W / 2 - 1.8, position[1], position[2] - D / 2 + 1.8]}
        floors={ELEVATOR_FLOORS}
        currentFloor={currentFloor}
        onFloorChange={(floor) => {
          if (floor > 0 && !elevatorUnlocked) {
            onElevatorAccessDenied?.();
            onElevatorCallWhileLocked?.();
            return;
          }
          onFloorChange?.(floor);
        }}
        showPad={showElevatorPad}
        onTogglePad={onToggleElevatorPad}
        onElevatorStateChange={onElevatorStateChange}
        playerNearby={playerNearElevator}
      />

      {/* Elevator access denied message */}
      {insideBuilding && currentFloor === 0 && !elevatorUnlocked && (
        <Html
          position={[position[0] + W / 2 - 1.8, position[1] + 2.5, position[2] - D / 2 + 2.5]}
          center
          distanceFactor={8}
          zIndexRange={[150, 160]}
        >
          <div style={{
            background: "rgba(139, 0, 0, 0.95)",
            border: "2px solid #ff4444",
            borderRadius: 10,
            padding: "8px 16px",
            color: "#fff",
            fontFamily: "system-ui, sans-serif",
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 20px rgba(0,0,0,0.7)",
            userSelect: "none",
            pointerEvents: "none",
          }}>
            🔒 Access Restricted
            <div style={{ fontSize: 10, opacity: 0.85, marginTop: 4 }}>
              Speak with Evaana to gain access
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
