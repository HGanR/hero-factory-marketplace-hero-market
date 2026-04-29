/**
 * MeridianTower.tsx
 * Faithful R3F port of ModernBuilding.ts — daytime corporate office building:
 *  - Cream/beige concrete panel cladding (0xd4cfc8)
 *  - Dark charcoal aluminum window frames (0x2c3340)
 *  - Blue-tinted glass curtain wall (0x7ab3d4) with warm interior glow (0xfff8e8)
 *  - 9-floor tower
 *  - Animated elevator with sliding doors
 *  - Lobby: reception desk, sofas, plants, signage
 *  - Upper floors: open office, conference, executive, break room, generic offices
 *  - Landscaping: hedges, trees, entrance canopy, steps
 */

"use client";

import { useRef, ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

const FLOORS = 9;
const FLOOR_H = 4.2;
const TOTAL_H = FLOORS * FLOOR_H;
const BW = 20;
const BD = 14;
const WALL = 0.22;

const ELEV_X = BW / 2 - 2.0;
const ELEV_Z = 0;
const ELEV_W = 2.2;
const ELEV_D = 2.2;
const ELEV_SHAFT_H = TOTAL_H + 0.5;

const C = {
  concrete: 0xd4cfc8,
  concreteDk: 0xb8b2aa,
  frame: 0x2c3340,
  frameDk: 0x1a1f28,
  glass: 0x7ab3d4,
  glassInt: 0xfff8e8,
  interior: 0xfff4e0,
  ceiling: 0xf0ece4,
  carpet: [0xe8e0d0, 0xd4c8b8, 0xc8d4c0, 0xd4c8d0, 0xc8d0d4, 0xd4d0c8, 0xc8d4d4, 0xd0d4c8, 0xd4c8c8],
  desk: 0x8b7355,
  deskTop: 0xc4a96a,
  chair: 0x3a3a4a,
  metal: 0x8a8a9a,
  elevator: 0x4a4a5a,
  elevDoor: 0x6a6a7a,
  signage: 0x1a2a3a,
  roofEdge: 0x3a3a4a,
  hedge: 0x3d6b2a,
  bark: 0x6b4a2a,
  foliage: 0x4a8a30,
  foliage2: 0x5a9a40,
  sofa: 0x4a4a5a,
  sofaCush: 0x6a6a7a,
  whiteboard: 0xf8f8f8,
  bookshelf: 0x5a4a3a,
};

function Box({
  pos,
  size,
  color,
  opacity = 1,
  castShadow = false,
  receiveShadow = false,
}: {
  pos: [number, number, number];
  size: [number, number, number];
  color: number;
  opacity?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  return (
    <mesh position={pos} castShadow={castShadow} receiveShadow={receiveShadow}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        side={opacity < 1 ? THREE.DoubleSide : THREE.FrontSide}
      />
    </mesh>
  );
}

function Cyl({
  pos,
  rTop,
  rBot,
  h,
  segs = 8,
  color,
}: {
  pos: [number, number, number];
  rTop: number;
  rBot: number;
  h: number;
  segs?: number;
  color: number;
}) {
  return (
    <mesh position={pos}>
      <cylinderGeometry args={[rTop, rBot, h, segs]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function ExteriorShell() {
  const meshes: ReactNode[] = [];

  meshes.push(<Box key="bk" pos={[0, TOTAL_H / 2, -BD / 2 + WALL / 2]} size={[BW, TOTAL_H, WALL]} color={C.concrete} castShadow />);
  meshes.push(<Box key="lw" pos={[-BW / 2 + WALL / 2, TOTAL_H / 2, 0]} size={[WALL, TOTAL_H, BD]} color={C.concrete} castShadow />);

  for (let f = 0; f < FLOORS; f++) {
    meshes.push(<Box key={`lb${f}`} pos={[-BW / 2 + 0.15, f * FLOOR_H + FLOOR_H - 0.12, 0]} size={[0.3, 0.25, BD]} color={C.frame} />);
  }

  for (let f = 1; f < FLOORS; f++) {
    meshes.push(<Box key={`band${f}`} pos={[0, f * FLOOR_H, 0]} size={[BW + 0.1, 0.35, BD + 0.1]} color={C.frame} />);
  }

  meshes.push(<Box key="par" pos={[0, TOTAL_H + 0.25, 0]} size={[BW + 0.2, 0.5, BD + 0.2]} color={C.roofEdge} />);

  for (const [sx, sz] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ] as [number, number][]) {
    meshes.push(<Box key={`col${sx}${sz}`} pos={[sx * (BW / 2 - 0.2), TOTAL_H / 2, sz * (BD / 2 - 0.2)]} size={[0.4, TOTAL_H + 0.5, 0.4]} color={C.frame} castShadow />);
  }

  for (let i = 1; i <= 6; i++) {
    const mx = -BW / 2 + i * (BW / 7);
    meshes.push(<Box key={`mul${i}`} pos={[mx, TOTAL_H / 2, BD / 2 - 0.06]} size={[0.12, TOTAL_H, 0.12]} color={C.frame} />);
  }

  return <>{meshes}</>;
}

function CurtainWall() {
  const meshes: ReactNode[] = [];

  const sections = [
    { x: -BW / 2 + 2.5, w: 4.5 },
    { x: -BW / 2 + 8.5, w: 7.0 },
    { x: BW / 2 - 4.0, w: 5.5 },
  ];

  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si];
    meshes.push(
      <mesh key={`g${si}`} position={[sec.x, TOTAL_H / 2, BD / 2 + 0.04]}>
        <boxGeometry args={[sec.w - 0.15, TOTAL_H - 0.5, 0.08]} />
        <meshStandardMaterial color={C.glass} roughness={0.05} metalness={0.9} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
    );
    meshes.push(
      <mesh key={`gi${si}`} position={[sec.x, TOTAL_H / 2, BD / 2 - 0.05]}>
        <boxGeometry args={[sec.w - 0.2, TOTAL_H - 0.6, 0.04]} />
        <meshStandardMaterial color={C.glassInt} roughness={0.1} transparent opacity={0.28} side={THREE.DoubleSide} />
      </mesh>
    );
    for (let f = 0; f <= FLOORS; f++) {
      meshes.push(<Box key={`fb${si}_${f}`} pos={[sec.x, f * FLOOR_H + (f === 0 ? 0.09 : 0), BD / 2 + 0.09]} size={[sec.w, 0.18, 0.18]} color={C.frame} />);
    }
    for (let f = 0; f < FLOORS; f++) {
      meshes.push(<Box key={`mb${si}_${f}`} pos={[sec.x, f * FLOOR_H + FLOOR_H * 0.5, BD / 2 + 0.06]} size={[sec.w, 0.1, 0.12]} color={C.frameDk} />);
    }
  }

  const louverSec = sections[0];
  for (let f = 0; f < FLOORS; f++) {
    for (let l = 0; l < 5; l++) {
      const ly = f * FLOOR_H + 0.5 + (l * (FLOOR_H - 0.5)) / 5;
      meshes.push(
        <mesh key={`lv${f}_${l}`} position={[louverSec.x, ly, BD / 2 + 0.3]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[louverSec.w - 0.2, 0.06, 0.4]} />
          <meshStandardMaterial color={C.frame} roughness={0.3} metalness={0.8} />
        </mesh>
      );
    }
  }

  for (let f = 0; f < FLOORS; f++) {
    meshes.push(<Box key={`sill${f}`} pos={[sections[2].x, f * FLOOR_H + 0.04, BD / 2 + 0.2]} size={[sections[2].w, 0.08, 0.25]} color={C.concreteDk} />);
  }

  for (let f = 0; f < FLOORS; f++) {
    meshes.push(
      <mesh key={`rg${f}`} position={[BW / 2 - 0.04, f * FLOOR_H + FLOOR_H / 2, 0]}>
        <boxGeometry args={[0.08, FLOOR_H - 0.5, BD * 0.6]} />
        <meshStandardMaterial color={C.glass} roughness={0.05} metalness={0.9} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
    );
  }

  return <>{meshes}</>;
}

function FloorInterior({ floorIndex }: { floorIndex: number }) {
  const y = floorIndex * FLOOR_H;
  const iw = BW - WALL * 2;
  const id = BD - WALL * 2;
  const carpet = C.carpet[floorIndex % C.carpet.length];
  const meshes: ReactNode[] = [];
  const key = (s: string) => `f${floorIndex}_${s}`;

  meshes.push(<Box key={key("fl")} pos={[0, y + 0.075, 0]} size={[iw, 0.15, id]} color={carpet} receiveShadow />);
  meshes.push(<Box key={key("cl")} pos={[0, y + FLOOR_H - 0.06, 0]} size={[iw, 0.12, id]} color={C.ceiling} />);
  meshes.push(<Box key={key("wN")} pos={[0, y + FLOOR_H / 2, -id / 2 + WALL / 2]} size={[iw, FLOOR_H, WALL]} color={C.interior} />);

  for (let l = 0; l < 4; l++) {
    const lx = -iw / 2 + 2.5 + (l * (iw - 5)) / 3;
    meshes.push(<Box key={key(`lt${l}`)} pos={[lx, y + FLOOR_H - 0.1, 0]} size={[1.8, 0.06, 0.5]} color={0xffffff} />);
  }

  if (floorIndex === 0) {
    meshes.push(<Box key={key("rd")} pos={[-1, y + 0.525, -1.5]} size={[5.5, 1.05, 1.4]} color={C.desk} castShadow />);
    meshes.push(<Box key={key("rdt")} pos={[-1, y + 1.08, -1.5]} size={[5.7, 0.08, 1.6]} color={C.deskTop} />);
    meshes.push(<Box key={key("rdf")} pos={[-1, y + 0.4, -0.83]} size={[5.5, 0.8, 0.06]} color={C.frameDk} />);

    for (const [mx, i] of [
      [-2.5, 0],
      [0.5, 1],
    ] as [number, number][]) {
      meshes.push(<Box key={key(`mb${i}`)} pos={[mx, y + 1.12, -1.7]} size={[0.2, 0.08, 0.2]} color={C.metal} />);
      meshes.push(<Box key={key(`ms${i}`)} pos={[mx, y + 1.3, -1.7]} size={[0.05, 0.35, 0.05]} color={C.metal} />);
      meshes.push(<Box key={key(`msc${i}`)} pos={[mx, y + 1.65, -1.72]} size={[0.85, 0.55, 0.04]} color={0x111122} />);
      meshes.push(
        <mesh key={key(`msg${i}`)} position={[mx, y + 1.65, -1.7]}>
          <boxGeometry args={[0.78, 0.48, 0.02]} />
          <meshStandardMaterial color={0x4488ff} transparent opacity={0.7} />
        </mesh>
      );
    }

    for (const [sx, sz, rot] of [
      [5, 1.5, 0],
      [5, -1.5, 0],
      [7.5, 0, Math.PI / 2],
    ] as [number, number, number][]) {
      meshes.push(
        <mesh key={key(`sf${sx}${sz}`)} position={[sx, y + 0.225, sz]} rotation={[0, rot, 0]} castShadow>
          <boxGeometry args={[2.2, 0.45, 0.85]} />
          <meshStandardMaterial color={C.sofa} />
        </mesh>
      );
      meshes.push(
        <mesh key={key(`sfb${sx}${sz}`)} position={[sx, y + 0.7, sz + (rot === 0 ? 0.42 : 0)]} rotation={[0, rot, 0]}>
          <boxGeometry args={[2.2, 0.55, 0.12]} />
          <meshStandardMaterial color={C.sofa} />
        </mesh>
      );
    }

    meshes.push(<Box key={key("ct")} pos={[5.5, y + 0.42, 0]} size={[1.4, 0.06, 0.9]} color={0x2a2a3a} />);
    meshes.push(<Box key={key("sign")} pos={[0, y + 2.8, -id / 2 + 0.2]} size={[3.5, 0.9, 0.08]} color={C.signage} />);
    meshes.push(<Box key={key("strip")} pos={[0, y + 0.16, id / 2 - 1.5]} size={[BW * 0.6, 0.02, 0.4]} color={C.frame} />);

    for (const [px, pz] of [
      [-iw / 2 + 1.2, -id / 2 + 1.2],
      [iw / 2 - 1.5, -id / 2 + 1.2],
    ] as [number, number][]) {
      meshes.push(<Cyl key={key(`pot${px}`)} pos={[px, y + 0.225, pz]} rTop={0.22} rBot={0.18} h={0.45} segs={12} color={0x8b6914} />);
      meshes.push(<Cyl key={key(`stem${px}`)} pos={[px, y + 0.45 + 0.9, pz]} rTop={0.04} rBot={0.06} h={1.8} segs={8} color={C.foliage} />);
      for (let l = 0; l < 5; l++) {
        const angle = (l / 5) * Math.PI * 2;
        meshes.push(
          <mesh key={key(`leaf${px}_${l}`)} position={[px + Math.cos(angle) * 0.35, y + 1.8 + l * 0.12, pz + Math.sin(angle) * 0.35]} scale={[1, 0.4, 1]}>
            <sphereGeometry args={[0.28, 8, 6]} />
            <meshStandardMaterial color={C.foliage} />
          </mesh>
        );
      }
      meshes.push(
        <mesh key={key(`topleaf${px}`)} position={[px, y + 2.5, pz]} scale={[1, 0.5, 1]}>
          <sphereGeometry args={[0.4, 10, 8]} />
          <meshStandardMaterial color={C.foliage2} />
        </mesh>
      );
    }
  } else if (floorIndex === 1) {
    const rows = [
      { z: -id / 2 + 2.5, count: 4 },
      { z: 0, count: 4 },
      { z: id / 2 - 2.5, count: 3 },
    ];
    for (const row of rows) {
      const startX = -iw / 2 + 2.5;
      for (let i = 0; i < row.count; i++) {
        const dx = startX + i * 3.8;
        if (dx > iw / 2 - 3.5) continue;
        meshes.push(<Box key={key(`dk${dx}${row.z}`)} pos={[dx, y + 0.36, row.z]} size={[1.7, 0.72, 0.85]} color={C.desk} castShadow />);
        meshes.push(<Box key={key(`dkt${dx}${row.z}`)} pos={[dx, y + 0.75, row.z]} size={[1.75, 0.06, 0.9]} color={C.deskTop} />);
        meshes.push(<Box key={key(`mon${dx}${row.z}`)} pos={[dx, y + 0.81, row.z - 0.28]} size={[0.15, 0.06, 0.15]} color={C.metal} />);
        meshes.push(<Box key={key(`mons${dx}${row.z}`)} pos={[dx, y + 0.95, row.z - 0.28]} size={[0.04, 0.28, 0.04]} color={C.metal} />);
        meshes.push(<Box key={key(`monsc${dx}${row.z}`)} pos={[dx, y + 1.22, row.z - 0.29]} size={[0.78, 0.5, 0.035]} color={0x111122} />);
        meshes.push(
          <mesh key={key(`monsg${dx}${row.z}`)} position={[dx, y + 1.22, row.z - 0.27]}>
            <boxGeometry args={[0.72, 0.44, 0.02]} />
            <meshStandardMaterial color={0x3366cc} transparent opacity={0.6} />
          </mesh>
        );
        meshes.push(<Box key={key(`ch${dx}${row.z}`)} pos={[dx, y + 0.48, row.z + 0.7]} size={[0.65, 0.08, 0.65]} color={C.chair} />);
        meshes.push(<Box key={key(`chb${dx}${row.z}`)} pos={[dx, y + 0.85, row.z + 0.7]} size={[0.65, 0.65, 0.07]} color={0x3a3a4a} />);
      }
    }
    meshes.push(<Box key={key("wb")} pos={[2, y + 2.0, -id / 2 + 0.2]} size={[4, 2.2, 0.05]} color={C.whiteboard} />);
    meshes.push(<Box key={key("wbf")} pos={[2, y + 2.0, -id / 2 + 0.16]} size={[4.15, 2.35, 0.04]} color={C.frame} />);
    meshes.push(<Box key={key("shelf")} pos={[-iw / 2 + 0.4, y + (FLOOR_H * 0.375), 0]} size={[0.35, FLOOR_H * 0.75, id * 0.4]} color={C.bookshelf} />);
  } else if (floorIndex === 2) {
    meshes.push(<Box key={key("ct")} pos={[0, y + 0.8, 0]} size={[8, 0.12, 3]} color={C.desk} />);
    meshes.push(<Box key={key("ctl")} pos={[0, y + 0.4, 0]} size={[7.8, 0.8, 2.8]} color={C.desk} />);
    for (let ci = 0; ci < 8; ci++) {
      const cx2 = -3.5 + ci * 1.0;
      for (const cz2 of [-2.2, 2.2]) {
        meshes.push(<Box key={key(`cc${ci}${cz2}`)} pos={[cx2, y + 0.25, cz2]} size={[0.8, 0.5, 0.7]} color={C.chair} />);
      }
    }
    meshes.push(<Box key={key("pscr")} pos={[-iw / 2 + 0.3, y + 2.2, 0]} size={[0.08, 3, 2]} color={C.whiteboard} />);
  } else if (floorIndex === 3) {
    meshes.push(<Box key={key("exd")} pos={[0, y + 0.45, -1]} size={[4, 0.9, 2]} color={C.desk} castShadow />);
    meshes.push(<Box key={key("exdt")} pos={[0, y + 0.9, -1]} size={[4.2, 0.08, 2.2]} color={C.deskTop} />);
    meshes.push(<Box key={key("exch")} pos={[0, y + 0.5, 1.2]} size={[0.8, 0.1, 0.8]} color={C.chair} />);
    meshes.push(<Box key={key("exchb")} pos={[0, y + 0.9, 1.2]} size={[0.8, 0.8, 0.1]} color={0x2a2a3a} />);
    for (const vx of [-1.2, 0, 1.2]) {
      meshes.push(<Box key={key(`vc${vx}`)} pos={[vx, y + 0.4, -2.8]} size={[0.7, 0.08, 0.7]} color={C.sofaCush} />);
      meshes.push(<Box key={key(`vcb${vx}`)} pos={[vx, y + 0.75, -2.8]} size={[0.7, 0.7, 0.08]} color={C.sofa} />);
    }
    meshes.push(<Box key={key("bsw")} pos={[-iw / 2 + 0.3, y + FLOOR_H * 0.4, 0]} size={[0.4, FLOOR_H * 0.8, id * 0.6]} color={C.bookshelf} />);
  } else if (floorIndex === 4) {
    meshes.push(<Box key={key("kc")} pos={[-iw / 2 + 1, y + 0.9, -id / 2 + 1]} size={[4, 1.8, 1]} color={0xd0d0d0} />);
    meshes.push(<Box key={key("kct")} pos={[-iw / 2 + 1, y + 1.8, -id / 2 + 1]} size={[4.2, 0.06, 1.2]} color={0xe8e8e8} />);
    for (const [tx, tz] of [
      [2, -1],
      [2, 2],
      [5, 0],
    ] as [number, number][]) {
      meshes.push(<Box key={key(`dt${tx}${tz}`)} pos={[tx, y + 0.75, tz]} size={[2, 0.08, 1.2]} color={C.deskTop} />);
      for (const [cx3, cz3] of [
        [tx - 0.7, tz - 0.8],
        [tx + 0.7, tz - 0.8],
        [tx - 0.7, tz + 0.8],
        [tx + 0.7, tz + 0.8],
      ] as [number, number][]) {
        meshes.push(<Box key={key(`dc${cx3}${cz3}`)} pos={[cx3, y + 0.35, cz3]} size={[0.6, 0.07, 0.6]} color={C.chair} />);
      }
    }
  } else {
    const deskCount = 3 + (floorIndex % 3);
    for (let di = 0; di < deskCount; di++) {
      const dx = -iw / 2 + 2.5 + di * 4;
      if (dx > iw / 2 - 2) continue;
      for (const dz of [-id / 4, id / 4]) {
        meshes.push(<Box key={key(`gd${di}${dz}`)} pos={[dx, y + 0.36, dz]} size={[1.7, 0.72, 0.85]} color={C.desk} />);
        meshes.push(<Box key={key(`gdt${di}${dz}`)} pos={[dx, y + 0.75, dz]} size={[1.75, 0.06, 0.9]} color={C.deskTop} />);
        meshes.push(<Box key={key(`gch${di}${dz}`)} pos={[dx, y + 0.48, dz + 0.7]} size={[0.65, 0.08, 0.65]} color={C.chair} />);
      }
    }
  }

  return <>{meshes}</>;
}

function Elevator({ currentFloor }: { currentFloor: number }) {
  const cabRef = useRef<THREE.Group>(null);
  const currentY = useRef(0);
  const doorLRefs = useRef<(THREE.Mesh | null)[]>([]);
  const doorRRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((_, delta) => {
    const target = currentFloor * FLOOR_H;
    currentY.current += (target - currentY.current) * Math.min(1, delta * 1.5);
    if (cabRef.current) cabRef.current.position.y = currentY.current;

    const doorW = (ELEV_W - 0.25) / 2;
    for (let f = 0; f < FLOORS; f++) {
      const isCurrentFloor = f === currentFloor;
      const closedLX = ELEV_X - doorW / 2 - 0.02;
      const closedRX = ELEV_X + doorW / 2 + 0.02;
      const openLX = ELEV_X - ELEV_W / 2 + 0.04;
      const openRX = ELEV_X + ELEV_W / 2 - 0.04;
      if (doorLRefs.current[f]) {
        doorLRefs.current[f]!.position.x += ((isCurrentFloor ? openLX : closedLX) - doorLRefs.current[f]!.position.x) * Math.min(1, delta * 3);
      }
      if (doorRRefs.current[f]) {
        doorRRefs.current[f]!.position.x += ((isCurrentFloor ? openRX : closedRX) - doorRRefs.current[f]!.position.x) * Math.min(1, delta * 3);
      }
    }
  });

  const doorW = (ELEV_W - 0.25) / 2;
  const frameH = FLOOR_H - 0.3;

  return (
    <>
      <Box pos={[ELEV_X, ELEV_SHAFT_H / 2, ELEV_Z - ELEV_D / 2 + WALL / 2]} size={[ELEV_W, ELEV_SHAFT_H, WALL]} color={C.elevator} />
      <Box pos={[ELEV_X - ELEV_W / 2 + WALL / 2, ELEV_SHAFT_H / 2, ELEV_Z]} size={[WALL, ELEV_SHAFT_H, ELEV_D]} color={C.elevator} />
      <Box pos={[ELEV_X + ELEV_W / 2 - WALL / 2, ELEV_SHAFT_H / 2, ELEV_Z]} size={[WALL, ELEV_SHAFT_H, ELEV_D]} color={C.elevator} />

      {Array.from({ length: FLOORS }, (_, f) => {
        const fy = f * FLOOR_H;
        return (
          <group key={`ef${f}`}>
            <Box pos={[ELEV_X, fy + frameH + 0.125, ELEV_Z + ELEV_D / 2 - 0.06]} size={[ELEV_W, 0.25, 0.12]} color={C.frame} />
            <Box pos={[ELEV_X - ELEV_W / 2 + 0.06, fy + frameH / 2, ELEV_Z + ELEV_D / 2 - 0.06]} size={[0.12, frameH, 0.12]} color={C.frame} />
            <Box pos={[ELEV_X + ELEV_W / 2 - 0.06, fy + frameH / 2, ELEV_Z + ELEV_D / 2 - 0.06]} size={[0.12, frameH, 0.12]} color={C.frame} />
            <mesh position={[ELEV_X, fy + frameH + 0.05, ELEV_Z + ELEV_D / 2 + 0.1]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshStandardMaterial color={0x00ff88} emissive={0x00ff44} emissiveIntensity={0.5} />
            </mesh>
            <mesh ref={(el) => (doorLRefs.current[f] = el)} position={[ELEV_X - doorW / 2 - 0.02, fy + (frameH - 0.05) / 2, ELEV_Z + ELEV_D / 2 - 0.035]}>
              <boxGeometry args={[doorW, frameH - 0.05, 0.07]} />
              <meshStandardMaterial color={C.elevDoor} roughness={0.2} metalness={0.8} />
            </mesh>
            <mesh ref={(el) => (doorRRefs.current[f] = el)} position={[ELEV_X + doorW / 2 + 0.02, fy + (frameH - 0.05) / 2, ELEV_Z + ELEV_D / 2 - 0.035]}>
              <boxGeometry args={[doorW, frameH - 0.05, 0.07]} />
              <meshStandardMaterial color={C.elevDoor} roughness={0.2} metalness={0.8} />
            </mesh>
          </group>
        );
      })}

      <group ref={cabRef} position={[ELEV_X, 0, ELEV_Z]}>
        <Box pos={[0, 0.05, 0]} size={[ELEV_W - 0.1, 0.1, ELEV_D - 0.1]} color={C.deskTop} />
        <Box pos={[0, FLOOR_H - 0.15, 0]} size={[ELEV_W - 0.1, 0.1, ELEV_D - 0.1]} color={C.ceiling} />
        <Box pos={[-ELEV_W / 2 + 0.08, FLOOR_H / 2, 0]} size={[0.06, FLOOR_H, ELEV_D - 0.1]} color={0x3a3a4a} />
        <Box pos={[ELEV_W / 2 - 0.08, FLOOR_H / 2, 0]} size={[0.06, FLOOR_H, ELEV_D - 0.1]} color={0x3a3a4a} />
        <Box pos={[0, FLOOR_H / 2, -ELEV_D / 2 + 0.08]} size={[ELEV_W - 0.1, FLOOR_H, 0.06]} color={0x3a3a4a} />
        <Box pos={[ELEV_W / 2 - 0.12, FLOOR_H * 0.55, ELEV_D / 2 - 0.2]} size={[0.06, FLOOR_H * 0.4, 0.3]} color={C.metal} />
        {Array.from({ length: FLOORS }, (_, f) => (
          <mesh key={`btn${f}`} position={[ELEV_W / 2 - 0.12, FLOOR_H * 0.7 - f * 0.18, ELEV_D / 2 - 0.17]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.03, 12]} />
            <meshStandardMaterial color={0xffcc44} roughness={0.2} metalness={0.5} />
          </mesh>
        ))}
      </group>
    </>
  );
}

function Roof() {
  return (
    <>
      <Box pos={[0, TOTAL_H + 0.125, 0]} size={[BW, 0.25, BD]} color={C.concreteDk} castShadow />
      {(
        [
          [-4, -2],
          [2, 3],
          [-6, 3],
        ] as [number, number][]
      ).map(([rx, rz], i) => (
        <group key={`hvac${i}`}>
          <Box pos={[rx, TOTAL_H + 0.65, rz]} size={[1.5, 0.8, 1.0]} color={C.metal} />
          <Cyl pos={[rx, TOTAL_H + 1.1, rz]} rTop={0.35} rBot={0.35} h={0.15} segs={16} color={C.frameDk} />
        </group>
      ))}
      <Box pos={[0, TOTAL_H + 0.55, 0]} size={[BW + 0.4, 0.6, BD + 0.4]} color={C.frame} />
      <Box pos={[ELEV_X, TOTAL_H + 1.0, ELEV_Z]} size={[ELEV_W + 0.4, 1.5, ELEV_D + 0.4]} color={C.concrete} />
    </>
  );
}

function Landscaping() {
  const meshes: ReactNode[] = [];

  for (let i = 0; i < 8; i++) {
    const hx = -BW / 2 + 1.2 + (i * (BW - 2.4)) / 7;
    meshes.push(
      <mesh key={`hedge${i}`} position={[hx, 0.35, BD / 2 + 1.2]} castShadow>
        <boxGeometry args={[1.1, 0.7, 0.55]} />
        <meshStandardMaterial color={C.hedge} roughness={0.95} />
      </mesh>
    );
  }

  meshes.push(<Box key="path" pos={[0, 0.025, BD / 2 + 2.5]} size={[4, 0.05, 4]} color={0xd8d0c8} />);

  for (let s = 0; s < 3; s++) {
    meshes.push(<Box key={`step${s}`} pos={[0, 0.06 + s * 0.12, BD / 2 + 0.25 - s * 0.5]} size={[4, 0.12, 0.5]} color={C.concreteDk} />);
  }

  const treePos: [number, number][] = [
    [-BW / 2 - 2, BD / 2 + 2],
    [BW / 2 + 2, BD / 2 + 2],
    [-BW / 2 - 2, -BD / 2 - 2],
    [BW / 2 + 2, -BD / 2 - 2],
    [-BW / 2 - 5, 0],
    [BW / 2 + 5, 0],
  ];
  for (const [tx, tz] of treePos) {
    const trunkH = 2.5;
    meshes.push(<Cyl key={`tr${tx}${tz}`} pos={[tx, trunkH / 2, tz]} rTop={0.12} rBot={0.18} h={trunkH} segs={8} color={C.bark} />);
    for (let l = 0; l < 3; l++) {
      meshes.push(
        <mesh key={`tf${tx}${tz}_${l}`} position={[tx, trunkH + l * 0.6, tz]} castShadow>
          <coneGeometry args={[0.9 - l * 0.15, 1.2 - l * 0.1, 10]} />
          <meshStandardMaterial color={l % 2 === 0 ? C.foliage : C.foliage2} />
        </mesh>
      );
    }
  }

  return <>{meshes}</>;
}

function Entrance() {
  return (
    <>
      <Box pos={[0, FLOOR_H * 0.85, BD / 2 + 0.06]} size={[3.2, 0.2, 0.12]} color={C.frame} />
      <Box pos={[-1.6, FLOOR_H * 0.425, BD / 2 + 0.06]} size={[0.12, FLOOR_H * 0.85, 0.12]} color={C.frame} />
      <Box pos={[1.6, FLOOR_H * 0.425, BD / 2 + 0.06]} size={[0.12, FLOOR_H * 0.85, 0.12]} color={C.frame} />
      <Box pos={[0, FLOOR_H * 0.425, BD / 2 + 0.06]} size={[0.1, FLOOR_H * 0.85, 0.1]} color={C.frame} />
      <mesh position={[-0.78, FLOOR_H * 0.41, BD / 2 + 0.06]}>
        <boxGeometry args={[1.4, FLOOR_H * 0.82, 0.06]} />
        <meshStandardMaterial color={C.glass} roughness={0.05} metalness={0.9} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.78, FLOOR_H * 0.41, BD / 2 + 0.06]}>
        <boxGeometry args={[1.4, FLOOR_H * 0.82, 0.06]} />
        <meshStandardMaterial color={C.glass} roughness={0.05} metalness={0.9} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
      {([-0.2, 0.2] as number[]).map((hx) => (
        <mesh key={`h${hx}`} position={[hx, FLOOR_H * 0.42, BD / 2 + 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.5, 8]} />
          <meshStandardMaterial color={C.metal} roughness={0.1} metalness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, FLOOR_H * 0.9, BD / 2 + 0.75]}>
        <boxGeometry args={[4.5, 0.12, 1.5]} />
        <meshStandardMaterial color={C.frame} roughness={0.3} metalness={0.7} transparent opacity={0.85} />
      </mesh>
      {([-1.8, 1.8] as number[]).map((sx) => (
        <Box key={`cs${sx}`} pos={[sx, FLOOR_H * 0.9 - 0.25, BD / 2 + 1.4]} size={[0.06, 0.5, 0.06]} color={C.frame} />
      ))}
    </>
  );
}

interface MeridianTowerProps {
  position: [number, number, number];
  onSelect?: () => void;
  onShowInfo?: () => void;
  isSelected?: boolean;
  currentElevatorFloor?: number;
  elevatorFloor?: number;
  isEditorMode?: boolean;
}

export default function MeridianTower({
  position,
  onSelect,
  onShowInfo,
  elevatorFloor,
  isSelected = false,
  currentElevatorFloor = 0,
}: MeridianTowerProps) {
  const activeFloor = elevatorFloor ?? currentElevatorFloor;
  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onSelect?.(); }}>
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[12, 14, 64]} />
          <meshBasicMaterial color={0xffdd44} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}

      <ExteriorShell />
      <CurtainWall />
      <Roof />
      <Entrance />
      <Landscaping />

      {Array.from({ length: FLOORS }, (_, f) => (
        <FloorInterior key={f} floorIndex={f} />
      ))}

      <Elevator currentFloor={activeFloor} />

      <pointLight position={[0, TOTAL_H * 0.5, BD / 2 + 3]} intensity={3} color={0xfff8e8} distance={50} />
      <pointLight position={[0, 2, BD / 2 + 4]} intensity={2} color={0xfff4d0} distance={25} />

      <Html position={[0, TOTAL_H + 4, 0]} center distanceFactor={60} zIndexRange={[50, 60]}>
        <div
          onClick={(e) => { e.stopPropagation(); onShowInfo?.(); }}
          style={{
            background: isSelected ? "rgba(255,221,68,0.95)" : "rgba(10,20,40,0.92)",
            border: `2px solid ${isSelected ? "#ffa500" : "#2a6fbd"}`,
            borderRadius: 10,
            padding: "6px 16px",
            color: isSelected ? "#000" : "#fff",
            fontFamily: "system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
            userSelect: "none",
            letterSpacing: 0.5,
          }}
        >
          🏢 Meridian Tower
          <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.7 }}>▼ Agents</span>
        </div>
      </Html>
    </group>
  );
}
