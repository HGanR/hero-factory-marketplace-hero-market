"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const ELECTRIC_BLUE = "#00D1FF";

export function LandingPlanet() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Glow outer sphere */}
      <mesh>
        <sphereGeometry args={[1.35, 32, 24]} />
        <meshBasicMaterial
          color={ELECTRIC_BLUE}
          transparent
          opacity={0.12}
          wireframe
        />
      </mesh>
      {/* Main neon sphere */}
      <mesh>
        <sphereGeometry args={[1.2, 64, 48]} />
        <meshStandardMaterial
          color={ELECTRIC_BLUE}
          emissive={ELECTRIC_BLUE}
          emissiveIntensity={0.8}
          metalness={0.2}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}
