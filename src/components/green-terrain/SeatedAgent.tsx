/**
 * SeatedAgent.tsx
 * A 3D humanoid agent seated at a desk with animations.
 */

"use client";

import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { AgentData } from "./AgentChatPanel";

interface SeatedAgentProps {
  agent: AgentData;
  position: [number, number, number];
  rotation?: number;
  onChat: (agent: AgentData) => void;
  isWaving?: boolean;
  isSelected?: boolean;
  /** Show name HUD only when user is looking at this agent (reduces clutter) */
  showHud?: boolean;
}

const DEPT_COLORS: Record<string, number> = {
  Administration: 0x1a3a6e,
  Security:       0x1a1a2e,
  Legal:          0x1a4a2e,
  Finance:        0x2e1a4a,
  "Human Resources": 0x4a1a2e,
  Technology:     0x1a2e4a,
  Management:     0x3a2a1a,
};

export default function SeatedAgent({
  agent,
  position,
  rotation = 0,
  onChat,
  isWaving = false,
  isSelected = false,
  showHud = true,
}: SeatedAgentProps) {
  const groupRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const [waveTimer, setWaveTimer] = useState(0);

  useEffect(() => {
    if (isWaving) {
      setWaveTimer(2.5);
    }
  }, [isWaving]);

  const suitColor = DEPT_COLORS[agent.department] ?? 0x1a3a6e;
  const skinColor = 0xf5c5a3;
  const shirtColor = 0xffffff;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const phase = (agent.id.charCodeAt(agent.id.length - 1) % 10) * 0.6;

    if (headRef.current) {
      headRef.current.position.y = 0.82 + Math.sin(t * 0.9 + phase) * 0.008;
      headRef.current.rotation.z = Math.sin(t * 0.4 + phase) * 0.03;
      headRef.current.rotation.y = Math.sin(t * 0.25 + phase) * 0.12;
    }

    if (rightArmRef.current) {
      if (waveTimer > 0) {
        rightArmRef.current.rotation.z = -Math.PI * 0.6 + Math.sin(t * 6) * 0.4;
        rightArmRef.current.rotation.x = -0.3;
      } else {
        rightArmRef.current.rotation.x = -0.6 + Math.sin(t * 4.5 + phase) * 0.12;
        rightArmRef.current.rotation.z = -0.15;
      }
    }

    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = -0.5 + Math.sin(t * 3.8 + phase + 1) * 0.08;
      leftArmRef.current.rotation.z = 0.15;
    }

    if (torsoRef.current) {
      torsoRef.current.rotation.z = Math.sin(t * 0.6 + phase) * 0.015;
      torsoRef.current.position.y = Math.sin(t * 0.6 + phase) * 0.005;
    }

    if (waveTimer > 0) {
      setWaveTimer(prev => Math.max(0, prev - 0.016));
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={[0, rotation, 0]}
    >
      {/* Office Chair */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.44, 0.06, 0.44]} />
        <meshLambertMaterial color={0x2a2a2a} />
      </mesh>
      <mesh position={[0, 0.72, -0.2]} castShadow>
        <boxGeometry args={[0.42, 0.55, 0.05]} />
        <meshLambertMaterial color={0x2a2a2a} />
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.38, 8]} />
        <meshLambertMaterial color={0x555555} />
      </mesh>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 5]} />
        <meshLambertMaterial color={0x333333} />
      </mesh>
      {[-0.24, 0.24].map((x, i) => (
        <mesh key={i} position={[x, 0.58, 0]} castShadow>
          <boxGeometry args={[0.04, 0.04, 0.36]} />
          <meshLambertMaterial color={0x333333} />
        </mesh>
      ))}

      {/* Agent Body */}
      {[-0.1, 0.1].map((x, i) => (
        <mesh key={i} position={[x, 0.3, 0.1]} castShadow>
          <boxGeometry args={[0.1, 0.22, 0.12]} />
          <meshLambertMaterial color={suitColor} />
        </mesh>
      ))}
      {[-0.1, 0.1].map((x, i) => (
        <mesh key={i} position={[x, 0.18, 0.22]} castShadow>
          <boxGeometry args={[0.09, 0.06, 0.16]} />
          <meshLambertMaterial color={0x111111} />
        </mesh>
      ))}

      <group ref={torsoRef} position={[0, 0.48, 0]}>
        <mesh
          position={[0, 0.18, 0]}
          castShadow
          userData={{ agentId: agent.id, agentName: agent.name, agentRole: agent.role }}
        >
          <boxGeometry args={[0.28, 0.34, 0.18]} />
          <meshLambertMaterial color={suitColor} />
        </mesh>
        <mesh position={[0, 0.18, 0.092]} castShadow>
          <boxGeometry args={[0.12, 0.28, 0.01]} />
          <meshLambertMaterial color={shirtColor} />
        </mesh>
        <mesh position={[0, 0.14, 0.094]} castShadow>
          <boxGeometry args={[0.04, 0.2, 0.01]} />
          <meshLambertMaterial color={0x8b0000} />
        </mesh>

        <group ref={rightArmRef} position={[0.18, 0.28, 0]}>
          <mesh position={[0.06, -0.1, 0.04]} castShadow>
            <boxGeometry args={[0.08, 0.24, 0.08]} />
            <meshLambertMaterial color={suitColor} />
          </mesh>
          <mesh position={[0.06, -0.24, 0.06]} castShadow>
            <boxGeometry args={[0.07, 0.08, 0.07]} />
            <meshLambertMaterial color={skinColor} />
          </mesh>
        </group>

        <group ref={leftArmRef} position={[-0.18, 0.28, 0]}>
          <mesh position={[-0.06, -0.1, 0.04]} castShadow>
            <boxGeometry args={[0.08, 0.24, 0.08]} />
            <meshLambertMaterial color={suitColor} />
          </mesh>
          <mesh position={[-0.06, -0.24, 0.06]} castShadow>
            <boxGeometry args={[0.07, 0.08, 0.07]} />
            <meshLambertMaterial color={skinColor} />
          </mesh>
        </group>

        <mesh position={[0, 0.38, 0]} castShadow>
          <cylinderGeometry args={[0.055, 0.055, 0.1, 8]} />
          <meshLambertMaterial color={skinColor} />
        </mesh>
      </group>

      {/* Head */}
      <mesh
        ref={headRef}
        position={[0, 1.3, 0]}
        castShadow
        userData={{ agentId: agent.id, agentName: agent.name, agentRole: agent.role }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onPointerDown={(e) => { e.stopPropagation(); onChat(agent); }}
      >
        <boxGeometry args={[0.22, 0.24, 0.2]} />
        <meshLambertMaterial color={skinColor} />

        {[-0.055, 0.055].map((x, i) => (
          <mesh key={i} position={[x, 0.02, 0.101]}>
            <boxGeometry args={[0.04, 0.035, 0.01]} />
            <meshBasicMaterial color={0x1a1a2e} />
          </mesh>
        ))}
        <mesh position={[0, -0.06, 0.101]}>
          <boxGeometry args={[0.07, 0.018, 0.01]} />
          <meshBasicMaterial color={0x8b4513} />
        </mesh>
        <mesh position={[0, 0.1, -0.02]}>
          <boxGeometry args={[0.23, 0.1, 0.22]} />
          <meshLambertMaterial color={0x2a1a0a} />
        </mesh>
      </mesh>

      {/* Desk */}
      <mesh position={[0, 0.72, -0.55]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.05, 0.65]} />
        <meshLambertMaterial color={0xc8a87a} />
      </mesh>
      {[[-0.5, -0.55], [0.5, -0.55], [-0.5, -0.88], [0.5, -0.88]].map(([x, z], i) => (
        <mesh key={i} position={[x as number, 0.36, z as number]} castShadow>
          <boxGeometry args={[0.05, 0.72, 0.05]} />
          <meshLambertMaterial color={0x8a6a4a} />
        </mesh>
      ))}

      {/* Monitor */}
      <mesh position={[0, 1.08, -0.62]} castShadow>
        <boxGeometry args={[0.52, 0.32, 0.03]} />
        <meshLambertMaterial color={0x111111} />
      </mesh>
      <mesh position={[0, 1.08, -0.605]}>
        <boxGeometry args={[0.46, 0.27, 0.01]} />
        <meshBasicMaterial color={0x1a3a6e} />
      </mesh>
      <mesh position={[0, 0.82, -0.65]} castShadow>
        <boxGeometry args={[0.06, 0.2, 0.06]} />
        <meshLambertMaterial color={0x222222} />
      </mesh>
      <mesh position={[0, 0.755, -0.48]} castShadow>
        <boxGeometry args={[0.34, 0.02, 0.14]} />
        <meshLambertMaterial color={0x333333} />
      </mesh>
      <mesh position={[0.22, 0.755, -0.46]} castShadow>
        <boxGeometry args={[0.06, 0.02, 0.1]} />
        <meshLambertMaterial color={0x222222} />
      </mesh>

      {/* Name label — only when showHud (user looking at agent) */}
      {showHud && (
      <Html position={[0, 1.75, 0]} center distanceFactor={12} zIndexRange={[100, 110]}>
        <div
          onClick={() => onChat(agent)}
          style={{
            background: hovered || isSelected
              ? "rgba(42,111,189,0.95)"
              : "rgba(5,15,35,0.88)",
            border: `1px solid ${hovered || isSelected ? "#5a9fd4" : "rgba(42,111,189,0.4)"}`,
            borderRadius: 8,
            padding: "4px 12px",
            color: "#e8f4ff",
            fontFamily: "system-ui, sans-serif",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
            boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
            userSelect: "none",
            transition: "all 0.2s",
            pointerEvents: "auto",
          }}
        >
          {agent.name}
          <span style={{ marginLeft: 6, fontSize: 9, opacity: 0.75 }}>
            {agent.title || agent.role}
          </span>
          {waveTimer > 0 && (
            <span style={{ marginLeft: 6, fontSize: 12 }}>👋</span>
          )}
        </div>
      </Html>
      )}
    </group>
  );
}
