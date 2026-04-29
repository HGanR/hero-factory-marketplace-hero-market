"use client";

import React, { useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Building, type BuildingComponent, type FloorConfig } from "@/lib/BuildingSystem";

type Props = {
  building: Building;
  height?: number;
  onReady?: (ctx: { scene: THREE.Scene; camera: THREE.Camera; renderer: THREE.WebGLRenderer }) => void;
};

function colorForType(type: BuildingComponent["type"]) {
  switch (type) {
    case "window":
      return "#60a5fa";
    case "door":
      return "#f59e0b";
    case "furniture":
      return "#a78bfa";
    case "stairs":
      return "#f87171";
    case "sign":
      return "#22c55e";
    case "billboard":
      return "#22c55e";
    case "awning":
      return "#38bdf8";
    case "wall":
      return "#94a3b8";
    default:
      return "#64748b";
  }
}

function BuildingMesh({ building }: { building: Building }) {
  const floors = useMemo(() => building.getAllFloors().map((f) => f.export()), [building]);
  const exterior = useMemo(() => building.getExteriorComponents(), [building]);

  const totalHeight = building.getTotalHeight();
  const baseY = totalHeight / 2;

  return (
    <group>
      {/* Main building mass */}
      <mesh position={[0, baseY, 0]} castShadow receiveShadow>
        <boxGeometry args={[building.width, totalHeight, building.depth]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </mesh>

      {/* Floor separators */}
      {floors.map((f: FloorConfig) => {
        const y = f.position.y + f.height;
        return (
          <mesh key={f.id} position={[0, y, 0]} receiveShadow>
            <boxGeometry args={[building.width * 1.01, 0.05, building.depth * 1.01]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        );
      })}

      {/* Exterior components */}
      {exterior.map((c) => (
        <mesh
          key={c.id}
          position={[c.position.x, c.position.y + 0.2 + totalHeight * 0.5, c.position.z]}
          rotation={[c.rotation.x, c.rotation.y, c.rotation.z]}
          scale={[c.scale.x, c.scale.y, c.scale.z]}
          castShadow
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={colorForType(c.type)} />
        </mesh>
      ))}

      {/* Interior components per floor */}
      {floors.flatMap((f: FloorConfig) =>
        (f.components || []).map((c) => (
          <mesh
            key={c.id}
            position={[c.position.x, f.position.y + 0.2, c.position.z]}
            rotation={[c.rotation.x, c.rotation.y, c.rotation.z]}
            scale={[c.scale.x, c.scale.y, c.scale.z]}
            castShadow
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={colorForType(c.type)} />
          </mesh>
        ))
      )}

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#0b1220" roughness={1} />
      </mesh>
    </group>
  );
}

export default function ThreeJSBuildingRenderer({ building, height = 320, onReady }: Props) {
  const camPos = useMemo(() => new THREE.Vector3(10, 10, 10), []);
  return (
    <div style={{ height }} className="w-full rounded-lg overflow-hidden border border-white/10 bg-black/30">
      <Canvas shadows camera={{ position: [camPos.x, camPos.y, camPos.z], fov: 50 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />
        <BuildingMesh building={building} />
        <SceneReadyBridge onReady={onReady} />
      </Canvas>
    </div>
  );
}

function SceneReadyBridge({ onReady }: { onReady?: (ctx: { scene: THREE.Scene; camera: THREE.Camera; renderer: THREE.WebGLRenderer }) => void }) {
  const { scene, camera, gl } = useThree();
  React.useEffect(() => {
    if (!onReady) return;
    onReady({ scene, camera, renderer: gl });
  }, [onReady, scene, camera, gl]);
  return null;
}


