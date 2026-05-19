"use client";

import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

type Props = {
  innerRadius?: number;
  outerRadius?: number;
  intensity: number;
  modeFactor: number;
  alert: boolean;
};

export function FrequencyRing({
  innerRadius = 0.72,
  outerRadius = 0.82,
  intensity,
  modeFactor,
  alert,
}: Props) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const spikePhase = useRef(0);
  const colorBlue = useMemo(() => new THREE.Color("#00A3FF"), []);
  const colorRed = useMemo(() => new THREE.Color("#FF3B3B"), []);
  const colorWork = useRef(new THREE.Color());

  useFrame((state, dt) => {
    const m = mesh.current;
    const material = mat.current;
    if (!m || !material) return;
    const t = state.clock.elapsedTime;
    m.rotation.z = t * (0.08 + intensity * 0.35 + modeFactor * 0.12);
    spikePhase.current += dt * (1.2 + intensity * 4);
    const pulse = 0.35 + intensity * 0.85 + Math.sin(spikePhase.current) * 0.08 * intensity;
    colorWork.current.copy(alert ? colorRed : colorBlue);
    material.color.copy(colorWork.current);
    material.opacity = THREE.MathUtils.clamp(0.12 + pulse * 0.55, 0.08, 0.95);
    const s = 1 + intensity * 0.06 + Math.sin(t * 2.2) * 0.012;
    m.scale.setScalar(s);
  });

  return (
    <mesh ref={mesh} rotation={[Math.PI / 2.35, 0, 0]} renderOrder={1}>
      <ringGeometry args={[innerRadius, outerRadius, 128]} />
      <meshBasicMaterial
        ref={mat}
        color="#00A3FF"
        transparent
        opacity={0.35}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
