import * as THREE from "three";

/**
 * Dispose geometries of an Object3D and its descendants.
 * Materials are NEVER disposed—generators use shared cached materials.
 * Disposing a shared cached material would break future renders.
 * Rule: dispose geometries only; dispose materials only when per-instance (not cached).
 */
export function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      // Do NOT dispose materials - generators use shared cached materials
    }
  });
}
