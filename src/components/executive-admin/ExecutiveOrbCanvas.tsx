"use client";

import * as THREE from "three";
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MeshDistortMaterial, Sparkles } from "@react-three/drei";
import { AgentPulseRing } from "./AgentPulseRing";

export type ExecutiveOrbMode = "idle" | "listening" | "speaking" | "processing" | "alert";

export type ExecutiveOrbCanvasProps = {
  intensity: number;
  mode: ExecutiveOrbMode;
};

function Scene({ intensity, mode }: ExecutiveOrbCanvasProps) {
  const group = useRef<THREE.Group>(null);
  const alert = mode === "alert";

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const breathe = Math.sin(t * 0.85) * 0.018 + 1;
    const boost = mode === "speaking" ? intensity * 0.12 : mode === "listening" ? intensity * 0.08 : intensity * 0.05;
    g.scale.setScalar(breathe + boost);
  });

  return (
    <>
      <color attach="background" args={["#030712"]} />
      <ambientLight intensity={0.22} />
      <pointLight position={[2.2, 1.6, 2.8]} intensity={0.85} color="#67e8f9" />
      <group ref={group}>
        <mesh renderOrder={2}>
          <sphereGeometry args={[0.48, 64, 64]} />
          <MeshDistortMaterial
            color="#0ea5e9"
            emissive="#22d3ee"
            emissiveIntensity={0.18 + intensity * 0.72}
            distort={0.18 + intensity * 0.5 + (mode === "processing" ? 0.12 : 0)}
            speed={1.1 + intensity * 2.8 + (mode === "processing" ? 1.4 : 0)}
            roughness={0.18}
            metalness={0.88}
            clearcoat={1}
          />
        </mesh>
        <Sparkles count={28} scale={1.15} size={1.8} opacity={0.32 + intensity * 0.35} color="#a78bfa" />
        <AgentPulseRing intensity={intensity} alert={alert} mode={mode} />
        <AgentPulseRing innerRadius={0.78} outerRadius={0.86} intensity={intensity * 0.78} alert={alert} mode={mode} />
      </group>
    </>
  );
}

export function ExecutiveOrbCanvas(props: ExecutiveOrbCanvasProps) {
  return (
    <Canvas
      className="h-full w-full"
      dpr={[1, 2]}
      gl={{ alpha: false, antialias: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 2.55], fov: 42, near: 0.1, far: 24 }}
    >
      <Scene {...props} />
    </Canvas>
  );
}
