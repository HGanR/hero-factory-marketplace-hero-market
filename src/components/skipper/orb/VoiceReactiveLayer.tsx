"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";

type Props = {
  children: React.ReactNode;
  intensity: number;
  mode: "idle" | "listening" | "speaking" | "processing" | "alert";
};

export function VoiceReactiveLayer({ children, intensity, mode }: Props) {
  const group = useRef<Group>(null);
  const smooth = useRef(0);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const target =
      mode === "speaking" || mode === "listening"
        ? 1 + intensity * 0.14
        : mode === "processing"
          ? 1 + Math.sin(t * 3) * 0.04 + intensity * 0.06
          : 1 + Math.sin(t * 0.9) * 0.018 + intensity * 0.04;
    smooth.current = THREE.MathUtils.lerp(smooth.current, target, 0.08);
    g.scale.setScalar(smooth.current);
  });

  return <group ref={group}>{children}</group>;
}
