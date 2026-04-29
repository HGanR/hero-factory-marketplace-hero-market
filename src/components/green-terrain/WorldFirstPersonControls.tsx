/**
 * WorldFirstPersonControls.tsx
 * WASD + mouse free-look first-person controller for world exploration.
 * Allows walking around the green terrain world.
 */

"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface WorldFirstPersonControlsProps {
  active: boolean;
  freeLook: boolean;
  onFreeLookChange: (v: boolean) => void;
  terrainBounds?: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };
}

const WALK_SPEED = 12;
const SPRINT_SPEED = 24;
const SENSITIVITY = 0.002;
const EYE_HEIGHT = 2.0;
const MAX_PITCH = Math.PI * 0.45;

export default function WorldFirstPersonControls({
  active,
  freeLook,
  onFreeLookChange,
  terrainBounds = { minX: -150, maxX: 150, minZ: -150, maxZ: 150 },
}: WorldFirstPersonControlsProps) {
  const { camera, gl } = useThree();

  const keys = useRef<Record<string, boolean>>({});
  const yaw = useRef(0);
  const pitch = useRef(0);
  const isLocked = useRef(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!active) {
      initialized.current = false;
      return;
    }
    // Snap: lock to current position and orientation when switching to first person
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    yaw.current = euler.y;
    pitch.current = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, euler.x));
    // Ensure camera Y stays at EYE_HEIGHT when activating (no drift from orbit)
    camera.position.y = EYE_HEIGHT;
    initialized.current = true;
  }, [active, camera]);

  useEffect(() => {
    if (!active) return;
    if (freeLook) {
      gl.domElement.requestPointerLock();
    } else {
      if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock();
      }
    }
  }, [freeLook, active, gl]);

  useEffect(() => {
    if (!active) return;

    const onKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const onKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; };

    const onMouseMove = (e: MouseEvent) => {
      if (!isLocked.current) return;
      yaw.current -= e.movementX * SENSITIVITY;
      pitch.current -= e.movementY * SENSITIVITY;
      pitch.current = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch.current));
    };

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === gl.domElement;
      isLocked.current = locked;
      onFreeLookChange(locked);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      if (document.pointerLockElement === gl.domElement) {
        document.exitPointerLock();
      }
    };
  }, [active, gl, onFreeLookChange]);

  useFrame((_, delta) => {
    if (!active || !initialized.current) return;

    // Update camera rotation
    const euler = new THREE.Euler(pitch.current, yaw.current, 0, "YXZ");
    camera.quaternion.setFromEuler(euler);

    // Calculate movement
    const sprint = keys.current["ShiftLeft"] || keys.current["ShiftRight"];
    const speed = (sprint ? SPRINT_SPEED : WALK_SPEED) * delta;

    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));

    const move = new THREE.Vector3();
    if (keys.current["KeyW"] || keys.current["ArrowUp"])    move.addScaledVector(forward, speed);
    if (keys.current["KeyS"] || keys.current["ArrowDown"])  move.addScaledVector(forward, -speed);
    if (keys.current["KeyA"] || keys.current["ArrowLeft"])  move.addScaledVector(right, -speed);
    if (keys.current["KeyD"] || keys.current["ArrowRight"]) move.addScaledVector(right, speed);

    // Apply movement with terrain bounds
    const newX = Math.max(terrainBounds.minX, Math.min(terrainBounds.maxX, camera.position.x + move.x));
    const newZ = Math.max(terrainBounds.minZ, Math.min(terrainBounds.maxZ, camera.position.z + move.z));
    
    camera.position.set(newX, EYE_HEIGHT, newZ);
  });

  return null;
}
