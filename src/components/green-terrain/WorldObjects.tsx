/**
 * WorldObjects.tsx
 * Seven placeable environment objects for the Green Terrain world library.
 * Each is a standalone React Three Fiber component with selection highlight support.
 *
 * Objects:
 *  - Street        — two-lane asphalt road segment with lane markings
 *  - Sidewalk      — concrete pavement slab with kerb edge
 *  - Lake          — large animated water body with reflective surface
 *  - Pond          — small circular water feature with lily pads
 *  - Bench         — park bench with wooden slats and metal legs
 *  - LightPost     — street lamp with glowing head and cast light
 *  - ParkingLot    — paved lot with painted stall lines and kerb
 */

"use client";

import { useRef, type ReactElement } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

function SelectionRing({ radius }: { radius: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
      <ringGeometry args={[radius, radius + 0.25, 48]} />
      <meshBasicMaterial color={0xffdd44} transparent opacity={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
}

export interface WorldObjectProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  isSelected?: boolean;
  onSelect?: () => void;
}

export function Street({ position, rotation = [0, 0, 0], isSelected, onSelect }: WorldObjectProps) {
  return (
    <group position={position} rotation={rotation}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={onSelect}>
        <planeGeometry args={[8, 20]} />
        <meshLambertMaterial color={0x333340} />
      </mesh>
      {[-6, -2, 2, 6].map((z, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, z]}>
          <planeGeometry args={[0.18, 2.2]} />
          <meshBasicMaterial color={0xffee44} />
        </mesh>
      ))}
      {[-1, 1].map((side, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[side * 3.7, 0.02, 0]}>
          <planeGeometry args={[0.15, 20]} />
          <meshBasicMaterial color={0xffffff} />
        </mesh>
      ))}
      {[-1, 1].map((side, i) => (
        <mesh key={i} position={[side * 4.15, 0.1, 0]} castShadow>
          <boxGeometry args={[0.3, 0.2, 20]} />
          <meshLambertMaterial color={0xbbbbcc} />
        </mesh>
      ))}
      {isSelected && <SelectionRing radius={11} />}
    </group>
  );
}

export function Sidewalk({ position, rotation = [0, 0, 0], isSelected, onSelect }: WorldObjectProps) {
  const tiles: ReactElement[] = [];
  for (let x = -2; x <= 2; x++) {
    for (let z = -4; z <= 4; z++) {
      tiles.push(
        <mesh key={`${x}_${z}`} rotation={[-Math.PI / 2, 0, 0]} position={[x * 1.2, 0.01, z * 1.2]}>
          <planeGeometry args={[1.15, 1.15]} />
          <meshLambertMaterial color={x % 2 === z % 2 ? 0xd4cfc8 : 0xc8c3bc} />
        </mesh>
      );
    }
  }
  return (
    <group position={position} rotation={rotation} onClick={onSelect}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[6, 11]} />
        <meshLambertMaterial color={0xccc8c0} />
      </mesh>
      {tiles}
      <mesh position={[0, 0.06, -5.65]} castShadow>
        <boxGeometry args={[6, 0.12, 0.3]} />
        <meshLambertMaterial color={0xaaaaaa} />
      </mesh>
      {isSelected && <SelectionRing radius={7} />}
    </group>
  );
}

export function Lake({ position, rotation = [0, 0, 0], isSelected, onSelect }: WorldObjectProps) {
  const waterRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!waterRef.current) return;
    const mat = waterRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.78 + Math.sin(clock.getElapsedTime() * 0.6) * 0.04;
  });
  return (
    <group position={position} rotation={rotation} onClick={onSelect}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]} receiveShadow>
        <circleGeometry args={[18, 48]} />
        <meshLambertMaterial color={0x1a3a2a} />
      </mesh>
      <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[17.5, 48]} />
        <meshStandardMaterial
          color={0x1a6ea8}
          roughness={0.05}
          metalness={0.3}
          transparent
          opacity={0.82}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <ringGeometry args={[17.5, 19.5, 48]} />
        <meshLambertMaterial color={0x3a7a2a} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 16, 0.4, Math.sin(a) * 10.5]} castShadow>
            <cylinderGeometry args={[0.06, 0.1, 1.2, 5]} />
            <meshLambertMaterial color={0x5a8a3a} />
          </mesh>
        );
      })}
      {isSelected && <SelectionRing radius={20} />}
    </group>
  );
}

export function Pond({ position, rotation = [0, 0, 0], isSelected, onSelect }: WorldObjectProps) {
  const waterRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!waterRef.current) return;
    const mat = waterRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = 0.8 + Math.sin(clock.getElapsedTime() * 0.9) * 0.05;
  });
  return (
    <group position={position} rotation={rotation} onClick={onSelect}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]}>
        <circleGeometry args={[5.5, 32]} />
        <meshLambertMaterial color={0x1a3020} />
      </mesh>
      <mesh ref={waterRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[5.2, 32]} />
        <meshStandardMaterial color={0x2a7aaa} roughness={0.08} metalness={0.25} transparent opacity={0.84} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <ringGeometry args={[5.2, 6.5, 32]} />
        <meshLambertMaterial color={0x3a7a2a} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[Math.cos(a) * 2.8, 0.04, Math.sin(a) * 2.8]}>
            <circleGeometry args={[0.45, 8]} />
            <meshLambertMaterial color={0x3a8a2a} />
          </mesh>
        );
      })}
      <mesh position={[3.5, 0.15, 2]} castShadow>
        <dodecahedronGeometry args={[0.35, 0]} />
        <meshLambertMaterial color={0x888880} />
      </mesh>
      {isSelected && <SelectionRing radius={7} />}
    </group>
  );
}

export function Bench({ position, rotation = [0, 0, 0], isSelected, onSelect }: WorldObjectProps) {
  return (
    <group position={position} rotation={rotation} onClick={onSelect}>
      {[-0.12, 0, 0.12].map((x, i) => (
        <mesh key={i} position={[x, 0.52, 0]} castShadow>
          <boxGeometry args={[0.08, 0.06, 1.4]} />
          <meshLambertMaterial color={0x8b5e3c} />
        </mesh>
      ))}
      {[-0.1, 0.04].map((x, i) => (
        <mesh key={i} position={[x, 0.88, -0.55]} rotation={[0.22, 0, 0]} castShadow>
          <boxGeometry args={[0.07, 0.05, 1.4]} />
          <meshLambertMaterial color={0x8b5e3c} />
        </mesh>
      ))}
      {[-0.55, 0.55].map((z, i) => (
        <group key={i} position={[0, 0, z]}>
          <mesh position={[-0.28, 0.26, 0]} rotation={[0, 0, 0.18]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.55, 6]} />
            <meshStandardMaterial color={0x555566} metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0.28, 0.26, 0]} rotation={[0, 0, -0.18]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.55, 6]} />
            <meshStandardMaterial color={0x555566} metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.08, 0]} castShadow>
            <boxGeometry args={[0.58, 0.04, 0.04]} />
            <meshStandardMaterial color={0x555566} metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {[-0.55, 0.55].map((z, i) => (
        <mesh key={i} position={[-0.22, 0.72, z]} rotation={[0.22, 0, 0.1]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.55, 6]} />
          <meshStandardMaterial color={0x555566} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {isSelected && <SelectionRing radius={1.8} />}
    </group>
  );
}

export function LightPost({ position, rotation = [0, 0, 0], isSelected, onSelect }: WorldObjectProps) {
  const glowRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!glowRef.current) return;
    const mat = glowRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.7 + Math.sin(clock.getElapsedTime() * 2.2) * 0.08;
  });
  return (
    <group position={position} rotation={rotation} onClick={onSelect}>
      <mesh position={[0, 0.06, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.28, 0.12, 8]} />
        <meshStandardMaterial color={0x444455} metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 3.2, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.09, 6.2, 8]} />
        <meshStandardMaterial color={0x3a3a4a} metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0.55, 6.1, 0]} rotation={[0, 0, -0.18]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 1.2, 6]} />
        <meshStandardMaterial color={0x3a3a4a} metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[1.1, 5.95, 0]} castShadow>
        <boxGeometry args={[0.5, 0.28, 0.32]} />
        <meshStandardMaterial color={0x2a2a3a} metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh ref={glowRef} position={[1.1, 5.88, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.18, 16]} />
        <meshBasicMaterial color={0xfff8d0} transparent opacity={0.85} />
      </mesh>
      <pointLight position={[1.1, 5.7, 0]} intensity={18} distance={14} color={0xfff5cc} decay={2} />
      {isSelected && <SelectionRing radius={2} />}
    </group>
  );
}

export function ParkingLot({ position, rotation = [0, 0, 0], isSelected, onSelect }: WorldObjectProps) {
  const stalls = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const x = -7.5 + col * 2.8;
      const z = -5 + row * 5.2;
      stalls.push(
        <group key={`${row}_${col}`} position={[x, 0.02, z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.25, 0, 0]}>
            <planeGeometry args={[0.1, 4.8]} />
            <meshBasicMaterial color={0xffffff} />
          </mesh>
          {col === 5 && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1.25, 0, 0]}>
              <planeGeometry args={[0.1, 4.8]} />
              <meshBasicMaterial color={0xffffff} />
            </mesh>
          )}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -1.8]}>
            <planeGeometry args={[0.6, 0.6]} />
            <meshBasicMaterial color={0xffffff} />
          </mesh>
        </group>
      );
    }
  }

  return (
    <group position={position} rotation={rotation} onClick={onSelect}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 16]} />
        <meshLambertMaterial color={0x2a2a35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[18, 0.15]} />
        <meshBasicMaterial color={0xffffff} />
      </mesh>
      {stalls}
      {[-1, 1].map((side, i) => (
        <mesh key={i} position={[0, 0.1, side * 8.15]} castShadow>
          <boxGeometry args={[18, 0.2, 0.3]} />
          <meshLambertMaterial color={0xbbbbcc} />
        </mesh>
      ))}
      {[-1, 1].map((side, i) => (
        <mesh key={i} position={[side * 9.15, 0.1, 0]} castShadow>
          <boxGeometry args={[0.3, 0.2, 16]} />
          <meshLambertMaterial color={0xbbbbcc} />
        </mesh>
      ))}
      {isSelected && <SelectionRing radius={13} />}
    </group>
  );
}

export type WorldObjectType = "street" | "sidewalk" | "lake" | "pond" | "bench" | "lightpost" | "parkinglot";

export const WORLD_OBJECT_DEFS: {
  type: WorldObjectType;
  label: string;
  icon: string;
  description: string;
  defaultScale: number;
}[] = [
  { type: "street",     label: "Street",      icon: "🛣️",  description: "Two-lane asphalt road with lane markings and kerb", defaultScale: 1 },
  { type: "sidewalk",   label: "Sidewalk",    icon: "🚶",  description: "Concrete pavement slab with tile pattern and kerb", defaultScale: 1 },
  { type: "lake",       label: "Lake",        icon: "🏞️",  description: "Large animated water body with shoreline and reeds", defaultScale: 1 },
  { type: "pond",       label: "Pond",        icon: "🌊",  description: "Small circular pond with lily pads and rocks", defaultScale: 1 },
  { type: "bench",      label: "Bench",       icon: "🪑",  description: "Park bench with wooden slats and metal legs", defaultScale: 1 },
  { type: "lightpost",  label: "Light Post",  icon: "💡",  description: "Street lamp with glowing head and point light", defaultScale: 1 },
  { type: "parkinglot", label: "Parking Lot", icon: "🅿️",  description: "Paved lot with 18 stalls, lane divider, and kerb", defaultScale: 1 },
];

export function WorldObjectRenderer({
  type, position, rotation, isSelected, onSelect,
}: {
  type: WorldObjectType;
  position: [number, number, number];
  rotation?: [number, number, number];
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const props = { position, rotation, isSelected, onSelect };
  switch (type) {
    case "street":     return <Street {...props} />;
    case "sidewalk":   return <Sidewalk {...props} />;
    case "lake":       return <Lake {...props} />;
    case "pond":       return <Pond {...props} />;
    case "bench":      return <Bench {...props} />;
    case "lightpost":  return <LightPost {...props} />;
    case "parkinglot": return <ParkingLot {...props} />;
  }
}
