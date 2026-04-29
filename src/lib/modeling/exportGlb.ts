import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

// Geometry health check before export
function performGeometryHealthCheck(object: THREE.Object3D): { healthy: boolean; issues: string[] } {
  const issues: string[] = [];

  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Check geometry exists and is valid
      if (!(child as THREE.Mesh).geometry) {
        issues.push(`${child.name}: missing geometry`);
        return;
      }

      const geometry = (child as THREE.Mesh).geometry;

      // Check position attribute
      if (!geometry.attributes.position) {
        issues.push(`${child.name}: missing position attribute`);
        return;
      }

      // Check for NaN values in positions
      const positions = geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i++) {
        if (!isFinite(positions[i])) {
          issues.push(`${child.name}: NaN value in position attribute`);
          break;
        }
      }

      // Check bounding box is finite
      geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        const bb = geometry.boundingBox;
        if (!isFinite(bb.min.x) || !isFinite(bb.min.y) || !isFinite(bb.min.z) ||
            !isFinite(bb.max.x) || !isFinite(bb.max.y) || !isFinite(bb.max.z)) {
          issues.push(`${child.name}: invalid bounding box`);
        }
      }

      // Check material exists
      if (!(child as THREE.Mesh).material) {
        issues.push(`${child.name}: missing material`);
      }
    }
  });

  return { healthy: issues.length === 0, issues };
}

// Normalize transforms before export
function normalizeTransforms(object: THREE.Object3D): void {
  object.updateMatrixWorld(true);

  object.traverse((child) => {
    // Freeze transforms where appropriate
    if (child instanceof THREE.Mesh) {
      (child as THREE.Mesh).geometry.computeBoundingBox();
      (child as THREE.Mesh).geometry.computeBoundingSphere();
    }
  });
}

export async function exportGLB(object: THREE.Object3D): Promise<Blob> {
  // Health check before export
  const health = performGeometryHealthCheck(object);
  if (!health.healthy) {
    throw new Error(`Geometry health check failed: ${health.issues.join(', ')}`);
  }

  // Normalize transforms
  normalizeTransforms(object);

  const exporter = new GLTFExporter();
  const arrayBuffer: ArrayBuffer = await new Promise((resolve, reject) => {
    exporter.parse(
      object,
      (gltf) => resolve(gltf as ArrayBuffer),
      (err) => reject(err),
      { binary: true }
    );
  });
  return new Blob([arrayBuffer], { type: "model/gltf-binary" });
}

export function vec3ToOasis(v: THREE.Vector3) {
  return { x: v.x, y: v.y, z: v.z };
}