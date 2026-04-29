"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface ActivityPulse {
  id: string;
  position: [number, number, number];
  amount?: number;
  createdAt: number;
}

const PULSE_DURATION_MS = 2200;

function PulseMarker({ pulse, onComplete }: { pulse: ActivityPulse; onComplete: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const startTime = useRef(Date.now()).current;
  const completedRef = useRef(false);

  useFrame(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / PULSE_DURATION_MS, 1);

    if (meshRef.current && materialRef.current) {
      const scale = 0.5 + progress * 3;
      meshRef.current.scale.setScalar(scale);
      materialRef.current.opacity = 0.8 * (1 - progress);
    }

    if (progress >= 1 && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  });

  return (
    <group position={pulse.position}>
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1, 2.5, 32]} />
        <meshBasicMaterial
          ref={materialRef}
          color={0x4ecdc4}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

interface ActivityPulseLayerProps {
  pulses: ActivityPulse[];
  onPulseComplete: (id: string) => void;
}

export function ActivityPulseLayer({ pulses, onPulseComplete }: ActivityPulseLayerProps) {
  return (
    <group>
      {pulses.map((p) => (
        <PulseMarker
          key={p.id}
          pulse={p}
          onComplete={() => onPulseComplete(p.id)}
        />
      ))}
    </group>
  );
}
