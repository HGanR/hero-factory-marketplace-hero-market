/**
 * CameraController.tsx
 * Smooth lerp-based camera fly-in / fly-out animation.
 */

"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type CameraState = "world" | "flying-in" | "inside" | "flying-out";

export interface BuildingTarget {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

/** Cardinal plain fly-to uses the same camera target shape as buildings. */
export type PlainTarget = BuildingTarget;

interface CameraControllerProps {
  state: CameraState;
  buildingTarget: BuildingTarget | null;
  /** When set (and buildingTarget is null), flying-in targets this plain viewpoint. */
  plainTarget?: PlainTarget | null;
  onArrived: () => void;
  onExited: () => void;
  orbitRef: React.RefObject<any>;
}

function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

const FLIGHT_DURATION = 1.8;

export default function CameraController({
  state,
  buildingTarget,
  plainTarget = null,
  onArrived,
  onExited,
  orbitRef,
}: CameraControllerProps) {
  const { camera } = useThree();

  const flightStart = useRef<{
    fromPos: THREE.Vector3;
    fromLookAt: THREE.Vector3;
    toPos: THREE.Vector3;
    toLookAt: THREE.Vector3;
    elapsed: number;
  } | null>(null);

  const savedWorld = useRef<{
    pos: THREE.Vector3;
    lookAt: THREE.Vector3;
  } | null>(null);

  const _pos = useRef(new THREE.Vector3());
  const _look = useRef(new THREE.Vector3());
  const _dir = useRef(new THREE.Vector3());
  const _qStart = useRef(new THREE.Quaternion());
  const _qEnd = useRef(new THREE.Quaternion());
  const _qCurrent = useRef(new THREE.Quaternion());
  const _mLook = useRef(new THREE.Matrix4());

  const lookAtQuat = (pos: THREE.Vector3, target: THREE.Vector3): THREE.Quaternion => {
    _mLook.current.lookAt(pos, target, THREE.Object3D.DEFAULT_UP);
    const q = new THREE.Quaternion();
    q.setFromRotationMatrix(_mLook.current);
    return q;
  };

  useEffect(() => {
    const flyTarget = buildingTarget ?? plainTarget;
    if (state === "flying-in" && flyTarget) {
      savedWorld.current = {
        pos: camera.position.clone(),
        lookAt: new THREE.Vector3(0, 0, 0),
      };

      _dir.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const currentLookAt = camera.position.clone().add(_dir.current.multiplyScalar(10));

      flightStart.current = {
        fromPos: camera.position.clone(),
        fromLookAt: currentLookAt,
        toPos: flyTarget.position.clone(),
        toLookAt: flyTarget.lookAt.clone(),
        elapsed: 0,
      };

      if (orbitRef.current) orbitRef.current.enabled = false;
    }

    if (state === "flying-out" && savedWorld.current) {
      _dir.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
      const currentLookAt = camera.position.clone().add(_dir.current.multiplyScalar(10));

      flightStart.current = {
        fromPos: camera.position.clone(),
        fromLookAt: currentLookAt,
        toPos: savedWorld.current.pos.clone(),
        toLookAt: savedWorld.current.lookAt.clone(),
        elapsed: 0,
      };

      if (orbitRef.current) orbitRef.current.enabled = false;
    }
  }, [state, buildingTarget, plainTarget, camera, orbitRef]);

  useFrame((_, delta) => {
    if (state !== "flying-in" && state !== "flying-out") return;
    if (!flightStart.current) return;

    const f = flightStart.current;
    f.elapsed += delta;
    const rawT = Math.min(f.elapsed / FLIGHT_DURATION, 1);
    const t = smoothStep(rawT);

    _pos.current.lerpVectors(f.fromPos, f.toPos, t);
    camera.position.copy(_pos.current);

    _look.current.lerpVectors(f.fromLookAt, f.toLookAt, t);

    _qStart.current.copy(lookAtQuat(f.fromPos, f.fromLookAt));
    _qEnd.current.copy(lookAtQuat(f.toPos, f.toLookAt));
    _qCurrent.current.slerpQuaternions(_qStart.current, _qEnd.current, t);
    camera.quaternion.copy(_qCurrent.current);

    if (rawT >= 1) {
      flightStart.current = null;
      if (state === "flying-in") {
        if (orbitRef.current) {
          orbitRef.current.enabled = false;
          orbitRef.current.minDistance = 1;
          orbitRef.current.maxDistance = 20;
          orbitRef.current.maxPolarAngle = Math.PI * 0.75;
          orbitRef.current.target.copy(f.toLookAt);
          orbitRef.current.update();
        }
        onArrived();
      } else {
        if (orbitRef.current) {
          orbitRef.current.enabled = true;
          orbitRef.current.minDistance = 5;
          orbitRef.current.maxDistance = 180;
          orbitRef.current.maxPolarAngle = Math.PI / 2 - 0.05;
          orbitRef.current.target.set(0, 0, 0);
          orbitRef.current.update();
        }
        onExited();
      }
    }
  });

  return null;
}
