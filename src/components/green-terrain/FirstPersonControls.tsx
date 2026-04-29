/**
 * FirstPersonControls.tsx
 * WASD + mouse free-look first-person controller for interior navigation.
 * Now supports immersive elevator rides where player moves with the cabin.
 */

"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { ElevatorState, ElevatorPhase } from "./FunctionalElevator";

export interface BuildingBounds {
  minX: number; maxX: number;
  minZ: number; maxZ: number;
  floorY: number;
}

// Collision box defined as { minX, maxX, minZ, maxZ }
export interface CollisionBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface HoveredAgentInfo {
  agentId: string;
  agentName: string;
  agentRole: string;
}

interface FirstPersonControlsProps {
  active: boolean;
  bounds: BuildingBounds;
  freeLook: boolean;
  onFreeLookChange: (v: boolean) => void;
  targetFloorY?: number;
  onElevatorNear?: (near: boolean) => void;
  elevatorPos?: THREE.Vector3;
  onHoverAgent?: (info: HoveredAgentInfo | null) => void;
  elevatorState?: ElevatorState | null;
  elevatorWorldPos?: [number, number, number];
  collisionBoxes?: CollisionBox[];
}

const WALK_SPEED = 6;
const SPRINT_SPEED = 12;
const SENSITIVITY = 0.0018;
const EYE_HEIGHT = 1.7;
const ELEVATOR_PROXIMITY = 2.5;
const FLOOR_LERP_SPEED = 4.5;
const AGENT_RAYCAST_DISTANCE = 8;

const MAX_PITCH = Math.PI * (35 / 180);

const _raycaster = new THREE.Raycaster();
const _center = new THREE.Vector2(0, 0);

// Player collision radius (how close to walls/objects player can get)
const PLAYER_RADIUS = 0.4;

// Check if a position collides with any collision box
function checkCollision(
  x: number, 
  z: number, 
  collisionBoxes: CollisionBox[], 
  playerRadius: number
): boolean {
  for (const box of collisionBoxes) {
    // Expand box by player radius for collision check
    const expandedMinX = box.minX - playerRadius;
    const expandedMaxX = box.maxX + playerRadius;
    const expandedMinZ = box.minZ - playerRadius;
    const expandedMaxZ = box.maxZ + playerRadius;
    
    if (x >= expandedMinX && x <= expandedMaxX && 
        z >= expandedMinZ && z <= expandedMaxZ) {
      return true; // Collision detected
    }
  }
  return false;
}

// Resolve collision by finding nearest valid position
function resolveCollision(
  oldX: number,
  oldZ: number,
  newX: number,
  newZ: number,
  collisionBoxes: CollisionBox[],
  playerRadius: number
): [number, number] {
  // Try moving only in X
  if (!checkCollision(newX, oldZ, collisionBoxes, playerRadius)) {
    return [newX, oldZ];
  }
  // Try moving only in Z
  if (!checkCollision(oldX, newZ, collisionBoxes, playerRadius)) {
    return [oldX, newZ];
  }
  // Can't move at all, stay in place
  return [oldX, oldZ];
}

export default function FirstPersonControls({
  active,
  bounds,
  freeLook,
  onFreeLookChange,
  targetFloorY,
  onElevatorNear,
  elevatorPos,
  onHoverAgent,
  elevatorState,
  elevatorWorldPos,
  collisionBoxes = [],
}: FirstPersonControlsProps) {
  const { camera, scene, gl } = useThree();

  const keys = useRef<Record<string, boolean>>({});
  const yaw = useRef(Math.PI);
  const pitch = useRef(0);
  const isLocked = useRef(false);
  const wasNearElevator = useRef(false);
  const initialized = useRef(false);
  const lastHoveredAgentId = useRef<string | null>(null);

  const currentEyeY = useRef<number | null>(null);
  const targetEyeY = useRef<number | null>(null);
  const isLerpingFloor = useRef(false);
  const prevTargetFloorY = useRef<number | undefined>(undefined);
  
  // Elevator ride state
  const inElevator = useRef(false);
  const elevatorBaseY = useRef(0);

  // Check if player is in elevator ride mode
  const isRidingElevator = elevatorState?.playerInside && 
    (elevatorState.phase === "entering" || 
     elevatorState.phase === "closing" || 
     elevatorState.phase === "traveling" || 
     elevatorState.phase === "opening" ||
     elevatorState.phase === "exiting");

  useEffect(() => {
    if (targetFloorY === undefined) return;
    if (isRidingElevator) return; // Don't lerp floor if riding elevator
    if (targetFloorY === prevTargetFloorY.current) return;
    prevTargetFloorY.current = targetFloorY;
    targetEyeY.current = targetFloorY + EYE_HEIGHT;
    isLerpingFloor.current = true;
  }, [targetFloorY, isRidingElevator]);

  useEffect(() => {
    if (!active) {
      initialized.current = false;
      currentEyeY.current = null;
      if (onHoverAgent) onHoverAgent(null);
      lastHoveredAgentId.current = null;
      return;
    }
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    yaw.current = euler.y;
    pitch.current = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, euler.x));
    currentEyeY.current = camera.position.y;
    initialized.current = true;
  }, [active, camera, onHoverAgent]);

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

    const euler = new THREE.Euler(pitch.current, yaw.current, 0, "YXZ");
    camera.quaternion.setFromEuler(euler);

    const standingY = bounds.floorY + EYE_HEIGHT;

    // Handle elevator ride - player moves with cabin
    if (isRidingElevator && elevatorState && elevatorWorldPos) {
      const elevatorCabinY = elevatorWorldPos[1] + elevatorState.cabinY + EYE_HEIGHT;
      const elevatorCenterX = elevatorWorldPos[0];
      const elevatorCenterZ = elevatorWorldPos[2];
      
      // During entering phase, smoothly move player into elevator
      if (elevatorState.phase === "entering") {
        const targetX = elevatorCenterX;
        const targetZ = elevatorCenterZ + 0.3; // Stand slightly back from center
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 4 * delta);
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, 4 * delta);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, elevatorCabinY, 4 * delta);
        
        // Face the doors (toward +Z)
        const targetYaw = 0;
        yaw.current = THREE.MathUtils.lerp(yaw.current, targetYaw, 3 * delta);
      } 
      // During closing, traveling, opening - stay locked in elevator
      else if (elevatorState.phase === "closing" || elevatorState.phase === "traveling" || elevatorState.phase === "opening") {
        camera.position.x = elevatorCenterX;
        camera.position.z = elevatorCenterZ + 0.3;
        camera.position.y = elevatorCabinY;
        
        // Allow looking around but not moving
        // Movement is blocked by not processing WASD below
      }
      // During exiting phase, smoothly walk player out and face toward CEO/center
      else if (elevatorState.phase === "exiting") {
        currentEyeY.current = elevatorCabinY;
        
        // If on executive floor (floor 1), exit and face toward CEO desk (toward -Z)
        // CEO is positioned at center-back of room
        const isExecutiveFloor = elevatorState.targetFloor === 1;
        
        // Move player out of elevator toward room center
        const exitTargetX = bounds.minX + (bounds.maxX - bounds.minX) / 2; // Center X
        const exitTargetZ = isExecutiveFloor 
          ? bounds.minZ + (bounds.maxZ - bounds.minZ) * 0.6  // Closer to CEO
          : bounds.minZ + (bounds.maxZ - bounds.minZ) * 0.5; // Center for lobby
        
        // Smoothly move player to exit position
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, exitTargetX, 3 * delta);
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, exitTargetZ, 3 * delta);
        camera.position.y = currentEyeY.current;
        
        // Face toward CEO (toward -Z, which is Math.PI)
        const targetYaw = isExecutiveFloor ? Math.PI : Math.PI; // Face into room
        yaw.current = THREE.MathUtils.lerp(yaw.current, targetYaw, 2.5 * delta);
      }
      
      return; // Skip normal movement processing
    }

    // Normal floor movement (not in elevator)
    if (isLerpingFloor.current && targetEyeY.current !== null) {
      if (currentEyeY.current === null) currentEyeY.current = camera.position.y;
      const diff = targetEyeY.current - currentEyeY.current;
      const step = diff * Math.min(1, FLOOR_LERP_SPEED * delta);
      currentEyeY.current += step;
      if (Math.abs(diff) < 0.005) {
        currentEyeY.current = targetEyeY.current;
        isLerpingFloor.current = false;
      }
    } else {
      if (currentEyeY.current === null) {
        currentEyeY.current = standingY;
      } else {
        currentEyeY.current = THREE.MathUtils.lerp(currentEyeY.current, standingY, Math.min(1, 8 * delta));
      }
    }

    const sprint = keys.current["ShiftLeft"] || keys.current["ShiftRight"];
    const speed = (sprint ? SPRINT_SPEED : WALK_SPEED) * delta;

    const forward = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));

    const move = new THREE.Vector3();
    if (keys.current["KeyW"] || keys.current["ArrowUp"])    move.addScaledVector(forward, speed);
    if (keys.current["KeyS"] || keys.current["ArrowDown"])  move.addScaledVector(forward, -speed);
    if (keys.current["KeyA"] || keys.current["ArrowLeft"])  move.addScaledVector(right, -speed);
    if (keys.current["KeyD"] || keys.current["ArrowRight"]) move.addScaledVector(right, speed);

    // Calculate proposed new position (clamped to building bounds)
    let newX = Math.max(bounds.minX, Math.min(bounds.maxX, camera.position.x + move.x));
    let newZ = Math.max(bounds.minZ, Math.min(bounds.maxZ, camera.position.z + move.z));
    
    // Check for collisions with walls/obstacles
    if (collisionBoxes.length > 0 && checkCollision(newX, newZ, collisionBoxes, PLAYER_RADIUS)) {
      // Try to resolve collision (slide along walls)
      [newX, newZ] = resolveCollision(
        camera.position.x, 
        camera.position.z, 
        newX, 
        newZ, 
        collisionBoxes, 
        PLAYER_RADIUS
      );
    }
    
    camera.position.set(newX, currentEyeY.current!, newZ);

    if (elevatorPos && onElevatorNear) {
      const dx = camera.position.x - elevatorPos.x;
      const dz = camera.position.z - elevatorPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const near = dist < ELEVATOR_PROXIMITY;
      if (near !== wasNearElevator.current) {
        onElevatorNear(near);
      }
      wasNearElevator.current = near;
    }

    if (onHoverAgent) {
      _raycaster.setFromCamera(_center, camera);
      _raycaster.far = AGENT_RAYCAST_DISTANCE;

      const hits = _raycaster.intersectObjects(scene.children, true);

      let foundAgent: HoveredAgentInfo | null = null;
      for (const hit of hits) {
        const ud = hit.object.userData;
        if (ud && ud.agentId) {
          foundAgent = {
            agentId: ud.agentId as string,
            agentName: ud.agentName as string,
            agentRole: ud.agentRole as string,
          };
          break;
        }
      }

      const newId = foundAgent?.agentId ?? null;
      if (newId !== lastHoveredAgentId.current) {
        lastHoveredAgentId.current = newId;
        onHoverAgent(foundAgent);
      }
    }
  });

  return null;
}
