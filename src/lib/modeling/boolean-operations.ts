import * as THREE from "three";

// Simple CSG implementation using Three.js operations
// For production, you'd want to use three-bvh-csg or similar

export function subtractMeshes(meshA: THREE.Mesh, meshB: THREE.Mesh): THREE.Mesh {
  // Simple implementation - in production use three-bvh-csg
  // For now, we'll just return meshA and mark where the cut should happen
  const result = meshA.clone();

  // Store cut information in userData for later processing
  if (!result.userData.cuts) {
    result.userData.cuts = [];
  }

  result.userData.cuts.push({
    cutter: meshB.clone(),
    operation: 'subtract'
  });

  return result;
}

export function unionMeshes(meshA: THREE.Mesh, meshB: THREE.Mesh): THREE.Mesh {
  // Simple implementation - combine geometries
  const result = meshA.clone();

  if (!result.userData.unions) {
    result.userData.unions = [];
  }

  result.userData.unions.push(meshB.clone());

  return result;
}

export function intersectMeshes(meshA: THREE.Mesh, meshB: THREE.Mesh): THREE.Mesh {
  // Simple implementation
  const result = meshA.clone();

  if (!result.userData.intersections) {
    result.userData.intersections = [];
  }

  result.userData.intersections.push(meshB.clone());

  return result;
}

export function validateMeshForBoolean(mesh: THREE.Mesh): { valid: boolean; reason?: string } {
  if (!mesh.geometry) {
    return { valid: false, reason: "Mesh has no geometry" };
  }

  if (!mesh.material) {
    return { valid: false, reason: "Mesh has no material" };
  }

  const geometry = mesh.geometry;
  if (geometry instanceof THREE.BufferGeometry) {
    if (!geometry.attributes.position) {
      return { valid: false, reason: "Geometry has no position attribute" };
    }
    // Normalize for deterministic validation across environments
    if (!geometry.attributes.normal || geometry.attributes.normal.count === 0) {
      geometry.computeVertexNormals();
    }
    if (!geometry.boundingBox) {
      geometry.computeBoundingBox();
    }
  }
  mesh.updateMatrixWorld(true);

  return { valid: true };
}

export function createCutOperation(targetMesh: THREE.Mesh, cutterMesh: THREE.Mesh): THREE.Mesh {
  // Mark the target mesh with cut information
  const result = targetMesh.clone();

  // Store cut data in userData
  result.userData.booleanOperations = result.userData.booleanOperations || [];
  result.userData.booleanOperations.push({
    type: 'cut',
    cutter: cutterMesh,
    operation: 'subtract'
  });

  return result;
}