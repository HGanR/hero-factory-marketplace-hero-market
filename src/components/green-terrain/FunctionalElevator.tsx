/**
 * FunctionalElevator.tsx
 * A fully animated elevator with sliding doors and floor pad UI.
 * Now supports immersive ride experience where player enters and rides the elevator.
 */

"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

export interface ElevatorFloorConfig {
  label: string;
  y: number;
}

export type ElevatorPhase = "idle" | "entering" | "closing" | "traveling" | "opening" | "exiting";

export interface ElevatorState {
  phase: ElevatorPhase;
  currentFloor: number;
  targetFloor: number;
  cabinY: number;
  playerInside: boolean;
}

interface FunctionalElevatorProps {
  position: [number, number, number];
  floors: ElevatorFloorConfig[];
  currentFloor: number;
  onFloorChange: (floor: number) => void;
  showPad?: boolean;
  onTogglePad?: () => void;
  onElevatorStateChange?: (state: ElevatorState) => void;
  playerNearby?: boolean;
}

const DOOR_OPEN_X = 0.65;      // Wider door opening
const TRAVEL_SPEED = 2.8;
const DOOR_SPEED = 1.2;
const ENTER_DELAY = 0.8;
const EXIT_DELAY = 0.5;
const CABIN_WIDTH = 1.8;       // Wider cabin
const CABIN_DEPTH = 1.5;       // Deeper cabin

export default function FunctionalElevator({
  position,
  floors,
  currentFloor,
  onFloorChange,
  showPad = false,
  onTogglePad,
  onElevatorStateChange,
  playerNearby = false,
}: FunctionalElevatorProps) {
  const cabinRef = useRef<THREE.Group>(null);
  const leftDoorRef = useRef<THREE.Mesh>(null);
  const rightDoorRef = useRef<THREE.Mesh>(null);

  const [phase, setPhase] = useState<ElevatorPhase>("idle");
  const [targetFloor, setTargetFloor] = useState(currentFloor);
  const [displayFloor, setDisplayFloor] = useState(currentFloor);
  const [playerInside, setPlayerInside] = useState(false);

  const cabinY = useRef(floors[currentFloor]?.y ?? 0);
  const doorOpenAmount = useRef(DOOR_OPEN_X);
  const phaseRef = useRef<ElevatorPhase>("idle");
  const enterTimer = useRef(0);
  const exitTimer = useRef(0);

  // Notify parent of elevator state changes
  const notifyStateChange = useCallback(() => {
    if (onElevatorStateChange) {
      onElevatorStateChange({
        phase: phaseRef.current,
        currentFloor: displayFloor,
        targetFloor,
        cabinY: cabinY.current,
        playerInside,
      });
    }
  }, [onElevatorStateChange, displayFloor, targetFloor, playerInside]);

  useEffect(() => {
    notifyStateChange();
  }, [phase, displayFloor, targetFloor, playerInside, notifyStateChange]);

  const requestFloor = (floor: number) => {
    if (floor === displayFloor && phase === "idle") return;
    if (phase !== "idle") return;
    
    setTargetFloor(floor);
    
    // Player always enters the elevator when they request a floor
    // (they must be near enough to interact with the UI)
    setPhase("entering");
    phaseRef.current = "entering";
    setPlayerInside(true);
    enterTimer.current = ENTER_DELAY;
  };

  useEffect(() => {
    if (currentFloor !== displayFloor && phase === "idle") {
      requestFloor(currentFloor);
    }
  }, [currentFloor, displayFloor, phase]);

  useFrame((_, delta) => {
    const p = phaseRef.current;

    // Handle entering phase (player walks into elevator)
    if (p === "entering") {
      enterTimer.current -= delta;
      if (enterTimer.current <= 0) {
        setPhase("closing");
        phaseRef.current = "closing";
      }
    }

    // Handle door animations
    if (leftDoorRef.current && rightDoorRef.current) {
      if (p === "closing") {
        doorOpenAmount.current = Math.max(0, doorOpenAmount.current - DOOR_SPEED * delta);
        leftDoorRef.current.position.x = -doorOpenAmount.current;
        rightDoorRef.current.position.x = doorOpenAmount.current;
        if (doorOpenAmount.current <= 0) {
          setPhase("traveling");
          phaseRef.current = "traveling";
        }
      } else if (p === "opening") {
        doorOpenAmount.current = Math.min(DOOR_OPEN_X, doorOpenAmount.current + DOOR_SPEED * delta);
        leftDoorRef.current.position.x = -doorOpenAmount.current;
        rightDoorRef.current.position.x = doorOpenAmount.current;
        if (doorOpenAmount.current >= DOOR_OPEN_X) {
          if (playerInside) {
            setPhase("exiting");
            phaseRef.current = "exiting";
            exitTimer.current = EXIT_DELAY;
          } else {
            setPhase("idle");
            phaseRef.current = "idle";
          }
        }
      }
    }

    // Handle traveling phase
    if (p === "traveling" && cabinRef.current) {
      const targetY = floors[targetFloor]?.y ?? 0;
      const diff = targetY - cabinY.current;
      const step = Math.sign(diff) * TRAVEL_SPEED * delta;

      if (Math.abs(diff) <= Math.abs(step) + 0.01) {
        cabinY.current = targetY;
        setDisplayFloor(targetFloor);
        onFloorChange(targetFloor);
        setPhase("opening");
        phaseRef.current = "opening";
      } else {
        cabinY.current += step;
      }
      cabinRef.current.position.y = cabinY.current;
    }

    // Handle exiting phase
    if (p === "exiting") {
      exitTimer.current -= delta;
      if (exitTimer.current <= 0) {
        setPlayerInside(false);
        setPhase("idle");
        phaseRef.current = "idle";
      }
    }

    // Always notify state for camera/position sync
    notifyStateChange();
  });

  const floorLabels = floors.map((f, i) => ({ ...f, index: i }));

  return (
    <group position={position}>
      {/* Elevator shaft - wider */}
      <mesh position={[0, 5, -CABIN_DEPTH / 2 - 0.02]} castShadow>
        <boxGeometry args={[CABIN_WIDTH + 0.1, 10, 0.06]} />
        <meshLambertMaterial color={0xd0ccc8} />
      </mesh>
      {[-CABIN_WIDTH / 2 - 0.02, CABIN_WIDTH / 2 + 0.02].map((x, i) => (
        <mesh key={i} position={[x, 5, 0]} castShadow>
          <boxGeometry args={[0.06, 10, CABIN_DEPTH + 0.1]} />
          <meshLambertMaterial color={0xd0ccc8} />
        </mesh>
      ))}

      {floors.map((f, i) => (
        <mesh key={i} position={[0, f.y + 0.02, CABIN_DEPTH / 2 + 0.02]}>
          <boxGeometry args={[CABIN_WIDTH, 0.04, 0.02]} />
          <meshBasicMaterial color={i === displayFloor ? 0xffd700 : 0x888888} />
        </mesh>
      ))}

      {/* Cabin - wider and deeper */}
      <group ref={cabinRef} position={[0, cabinY.current, 0]}>
        {/* Floor */}
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[CABIN_WIDTH, 0.06, CABIN_DEPTH]} />
          <meshLambertMaterial color={0xe8e0d0} />
        </mesh>
        {/* Ceiling */}
        <mesh position={[0, 2.4, 0]}>
          <boxGeometry args={[CABIN_WIDTH, 0.06, CABIN_DEPTH]} />
          <meshLambertMaterial color={0xe8e0d0} />
        </mesh>
        {/* Back wall */}
        <mesh position={[0, 1.2, -CABIN_DEPTH / 2 + 0.03]}>
          <boxGeometry args={[CABIN_WIDTH, 2.4, 0.06]} />
          <meshLambertMaterial color={0xc8c0b0} />
        </mesh>
        {/* Side walls */}
        {[-CABIN_WIDTH / 2 + 0.03, CABIN_WIDTH / 2 - 0.03].map((x, i) => (
          <mesh key={i} position={[x, 1.2, 0]}>
            <boxGeometry args={[0.06, 2.4, CABIN_DEPTH]} />
            <meshLambertMaterial color={0xc8c0b0} />
          </mesh>
        ))}
        {/* Ceiling light */}
        <mesh position={[0, 2.3, 0]}>
          <boxGeometry args={[0.8, 0.04, 0.6]} />
          <meshBasicMaterial color={0xfffde8} />
        </mesh>
        {/* Floor indicator display */}
        <mesh position={[CABIN_WIDTH / 2 - 0.15, 2.0, -CABIN_DEPTH / 2 + 0.08]}>
          <boxGeometry args={[0.25, 0.18, 0.02]} />
          <meshBasicMaterial color={0x001122} />
        </mesh>
        {/* Handrail on back wall */}
        <mesh position={[0, 1.0, -CABIN_DEPTH / 2 + 0.1]}>
          <boxGeometry args={[CABIN_WIDTH - 0.2, 0.04, 0.04]} />
          <meshPhongMaterial color={0xd4af37} shininess={200} />
        </mesh>

        {/* Sliding doors - wider */}
        <mesh
          ref={leftDoorRef}
          position={[-doorOpenAmount.current, 1.2, CABIN_DEPTH / 2 - 0.03]}
          castShadow
        >
          <boxGeometry args={[0.72, 2.4, 0.06]} />
          <meshStandardMaterial color={0xa0a8b0} metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh
          ref={rightDoorRef}
          position={[doorOpenAmount.current, 1.2, CABIN_DEPTH / 2 - 0.03]}
          castShadow
        >
          <boxGeometry args={[0.72, 2.4, 0.06]} />
          <meshStandardMaterial color={0xa0a8b0} metalness={0.6} roughness={0.3} />
        </mesh>

        {/* Door frame */}
        <mesh position={[0, 1.2, CABIN_DEPTH / 2]}>
          <boxGeometry args={[CABIN_WIDTH + 0.06, 2.52, 0.04]} />
          <meshLambertMaterial color={0x707880} />
        </mesh>

        {/* Interior button panel */}
        <mesh
          position={[CABIN_WIDTH / 2 - 0.1, 1.1, -CABIN_DEPTH / 2 + 0.08]}
          onPointerDown={(e) => { e.stopPropagation(); if (onTogglePad) onTogglePad(); }}
        >
          <boxGeometry args={[0.12, 0.28, 0.02]} />
          <meshBasicMaterial color={0x2a4a7a} />
        </mesh>
      </group>

      {/* Physical call button (gold cylinder) */}
      <mesh
        position={[CABIN_WIDTH / 2 + 0.15, floors[0].y + 1.1, CABIN_DEPTH / 2 + 0.02]}
        onPointerDown={(e) => { e.stopPropagation(); if (onTogglePad) onTogglePad(); }}
      >
        <cylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
        <meshBasicMaterial color={0xffd700} />
      </mesh>

      {/* HTML-based call button (always visible when pad is closed) */}
      {!showPad && (
        <Html
          position={[CABIN_WIDTH / 2 + 0.3, floors[displayFloor]?.y + 1.3, CABIN_DEPTH / 2 + 0.1]}
          distanceFactor={6}
          zIndexRange={[150, 160]}
        >
          <button
            onClick={(e) => { e.stopPropagation(); if (onTogglePad) onTogglePad(); }}
            style={{
              background: "linear-gradient(135deg, #ffd700, #ffaa00)",
              border: "2px solid rgba(255,200,0,0.8)",
              borderRadius: 8,
              padding: "8px 14px",
              color: "#1a1a2e",
              fontFamily: "system-ui, sans-serif",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 4px 16px rgba(255,215,0,0.4), inset 0 1px 0 rgba(255,255,255,0.4)",
              whiteSpace: "nowrap",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            🛗 Call
          </button>
        </Html>
      )}

      {showPad && (
        <Html
          position={[CABIN_WIDTH / 2 + 1.0, floors[displayFloor]?.y + 1.5, 0]}
          distanceFactor={8}
          zIndexRange={[200, 210]}
        >
          <div
            style={{
              background: "linear-gradient(160deg, rgba(5,15,35,0.97), rgba(10,25,55,0.97))",
              border: "1px solid rgba(42,111,189,0.6)",
              borderRadius: 14,
              padding: "14px 16px",
              minWidth: 140,
              boxShadow: "0 8px 32px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
              fontFamily: "system-ui, sans-serif",
              userSelect: "none",
            }}
          >
            <div style={{
              color: "#a0c8f0",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.2,
              textTransform: "uppercase",
              marginBottom: 10,
              borderBottom: "1px solid rgba(42,111,189,0.3)",
              paddingBottom: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span>🛗 Elevator</span>
              <button
                onClick={onTogglePad}
                style={{
                  background: "none", border: "none",
                  color: "#5a7a9a", cursor: "pointer",
                  fontSize: 14, lineHeight: 1, padding: 0,
                }}
              >✕</button>
            </div>

            <div style={{
              background: "rgba(42,111,189,0.15)",
              border: "1px solid rgba(42,111,189,0.3)",
              borderRadius: 8,
              padding: "6px 10px",
              color: "#ffd700",
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 10,
              textAlign: "center",
            }}>
              {phase === "entering" ? "🚶 Entering..." : 
               phase === "closing" ? "🚪 Doors Closing..." :
               phase === "traveling" ? (targetFloor > displayFloor ? "⬆ Going Up..." : "⬇ Going Down...") : 
               phase === "opening" ? "🚪 Doors Opening..." :
               phase === "exiting" ? "🚶 Exiting..." :
               `▶ ${floors[displayFloor]?.label ?? "—"}`}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[...floorLabels].reverse().map(({ label, index }) => (
                <button
                  key={index}
                  onClick={() => requestFloor(index)}
                  disabled={phase !== "idle"}
                  style={{
                    background: index === displayFloor
                      ? "linear-gradient(135deg, rgba(42,111,189,0.8), rgba(30,80,150,0.8))"
                      : "rgba(255,255,255,0.04)",
                    border: `1px solid ${index === displayFloor ? "rgba(90,159,212,0.7)" : "rgba(42,111,189,0.2)"}`,
                    borderRadius: 7,
                    padding: "7px 12px",
                    color: index === displayFloor ? "#ffffff" : "#88aacc",
                    fontSize: 12,
                    fontWeight: index === displayFloor ? 700 : 400,
                    cursor: phase === "idle" ? "pointer" : "not-allowed",
                    textAlign: "left",
                    transition: "all 0.15s",
                    opacity: phase !== "idle" && index !== displayFloor ? 0.5 : 1,
                  }}
                >
                  {index === displayFloor ? "● " : "○ "}{label}
                </button>
              ))}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
