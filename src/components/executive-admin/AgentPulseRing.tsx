"use client";

import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

type Props = {
  innerRadius?: number;
  outerRadius?: number;
  intensity: number;
  alert?: boolean;
  mode: "idle" | "listening" | "speaking" | "processing" | "alert";
};

export function AgentPulseRing({
  innerRadius = 0.62,
  outerRadius = 0.72,
  intensity,
  alert = false,
  mode,
}: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const phase = useRef(0);
  const colorBlue = useMemo(() => new THREE.Color("#22d3ee"), []);
  const colorRed = useMemo(() => new THREE.Color("#f87171"), []);
  const colorPurple = useMemo(() => new THREE.Color("#a78bfa"), []);

  useFrame((state, dt) => {
    const m = mesh.current;
    const material = mat.current;
    if (!m || !material) return;
    const t = state.clock.elapsedTime;
    phase.current += dt * (1.2 + intensity * 5);
    m.rotation.z = t * (0.06 + intensity * 0.35);
    const pulse = 0.25 + intensity * 0.75 + Math.sin(phase.current) * 0.06 * intensity;
    const col = alert || mode === "alert" ? colorRed : mode === "processing" ? colorPurple : colorBlue;
    material.color.copy(col);
    material.opacity = THREE.MathUtils.clamp(0.1 + pulse * 0.55, 0.08, 0.92);
    const s = 1 + intensity * 0.05;
    m.scale.setScalar(s);
  });

  return (
    <mesh ref={mesh} rotation={[Math.PI / 2.2, 0, 0]} renderOrder={1}>
      <ringGeometry args={[innerRadius, outerRadius, 96]} />
      <meshBasicMaterial
        ref={mat}
        color="#22d3ee"
        transparent
        opacity={0.35}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
