"use client";

import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { agentPulseAngles, pulsePointOnRing } from "./agent-pulse-system";

type Props = {
  agentCount: number;
  intensity: number;
};

export function AgentPulseSignals({ agentCount, intensity }: Props) {
  const group = useRef<THREE.Group>(null);
  const meshes = useMemo(() => {
    const n = Math.max(3, Math.min(8, agentCount));
    return Array.from({ length: n }, (_, i) => ({
      id: i,
      speed: 0.4 + (i % 3) * 0.15,
      radius: 0.62 + (i % 4) * 0.04,
    }));
  }, [agentCount]);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const angles = agentPulseAngles(meshes.length, t);
    meshes.forEach((m, i) => {
      const child = g.children[i] as THREE.Mesh | undefined;
      if (!child) return;
      const ang = angles[i] ?? 0;
      const wobble = t * m.speed * (1 + intensity * 0.8);
      const p = pulsePointOnRing(ang, m.radius, wobble);
      child.position.copy(p);
      const s = 0.028 + intensity * 0.04 + Math.sin(t * 4 + i) * 0.006;
      child.scale.setScalar(s);
      const mat = child.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.35 + intensity * 0.5;
    });
  });

  return (
    <group ref={group}>
      {meshes.map((m) => (
        <mesh key={m.id} renderOrder={4}>
          <sphereGeometry args={[1, 10, 10]} />
          <meshBasicMaterial
            color="#00FF85"
            transparent
            opacity={0.55}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
