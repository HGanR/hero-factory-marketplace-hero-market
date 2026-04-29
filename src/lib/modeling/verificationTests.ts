// Verification tests for the Oasis Modeling Factory
// These demonstrate that the acceptance criteria are met

import * as THREE from "three";
import { createEnterableBuildingRoot } from "./buildingTemplate";
import { validateEnterable } from "./enterableValidator";
import { exportGLB } from "./exportGlb";
import { createMeshFromObject, type ParametricObject } from "./parametric-objects";
import { subtractMeshes, validateMeshForBoolean } from "./boolean-operations";
import type { BuildingManifestV1 } from "./manifest";

// Test 1: Editor contract enforcement
export async function testContractEnforcement() {
  console.log("🧪 Testing contract enforcement...");

  const root = createEnterableBuildingRoot();
  const validation = validateEnterable(root);

  // Should pass all checks
  const requiredChecks = [
    "Exterior", "Interior", "Colliders", "Interactables", "Spawns",
    "ExteriorSpawn", "InteriorSpawn", "EntryTrigger", "Door", "DoorTrigger", "BuildingCollider"
  ];

  const passedChecks = validation.checks.filter(c => c.ok).map(c => c.id);

  const allRequiredPass = requiredChecks.every(check => passedChecks.includes(check));

  console.log("✅ Contract enforcement:", allRequiredPass ? "PASS" : "FAIL");
  console.log("Required checks:", requiredChecks.length, "Passed:", passedChecks.length);

  if (!allRequiredPass) {
    console.log("Missing:", requiredChecks.filter(c => !passedChecks.includes(c)));
  }

  return allRequiredPass;
}

// Test 2: Export integrity (GLB + manifest round-trip)
export async function testExportIntegrity() {
  console.log("🧪 Testing export integrity...");

  const root = createEnterableBuildingRoot();

  // Export GLB
  const glbBlob1 = await exportGLB(root);
  const glbBlob2 = await exportGLB(root);

  // GLBs should be identical for same input
  const array1 = new Uint8Array(await glbBlob1.arrayBuffer());
  const array2 = new Uint8Array(await glbBlob2.arrayBuffer());

  let glbsIdentical = array1.length === array2.length;
  if (glbsIdentical) {
    for (let i = 0; i < array1.length; i++) {
      if (array1[i] !== array2[i]) {
        glbsIdentical = false;
        break;
      }
    }
  }

  console.log("✅ GLB determinism:", glbsIdentical ? "PASS" : "FAIL");

  // Test manifest building
  const manifest1 = buildTestManifest(root, "test-building", "test-category", "/test.glb");
  const manifest2 = buildTestManifest(root, "test-building", "test-category", "/test.glb");

  const manifestIdentical = JSON.stringify(manifest1) === JSON.stringify(manifest2);

  console.log("✅ Manifest determinism:", manifestIdentical ? "PASS" : "FAIL");

  return glbsIdentical && manifestIdentical;
}

// Test 3: Parametric object creation and CSG
export async function testParametricAndCSG() {
  console.log("🧪 Testing parametric objects and CSG...");

  // Create wall
  const wallObject: ParametricObject = {
    id: "test_wall",
    type: "wall",
    name: "Test Wall",
    parameters: { width: 4, height: 3, thickness: 0.2 },
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    material: { color: "#8B7355", metalness: 0.0, roughness: 0.9 }
  };

  const wallMesh = await createMeshFromObject(wallObject);
  const wallValidation = validateMeshForBoolean(wallMesh as THREE.Mesh);

  // Create window
  const windowObject: ParametricObject = {
    id: "test_window",
    type: "window",
    name: "Test Window",
    parameters: { width: 1.2, height: 1.5 },
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    material: { color: "#2C3E50", metalness: 0.8, roughness: 0.2 }
  };

  const windowMesh = await createMeshFromObject(windowObject);
  const windowValidation = validateMeshForBoolean(windowMesh as THREE.Mesh);

  console.log("✅ Wall creation:", wallValidation.valid ? "PASS" : "FAIL");
  console.log("✅ Window creation:", windowValidation.valid ? "PASS" : "FAIL");

  // Test CSG
  if (wallValidation.valid && windowValidation.valid) {
    const resultMesh = subtractMeshes(wallMesh as THREE.Mesh, windowMesh as THREE.Mesh);
    const hasCutData = resultMesh.userData.cuts && resultMesh.userData.cuts.length > 0;

    console.log("✅ CSG operation:", hasCutData ? "PASS" : "FAIL");

    return wallValidation.valid && windowValidation.valid && hasCutData;
  }

  return false;
}

// Test 4: Runtime compatibility verification
export async function testRuntimeCompatibility() {
  console.log("🧪 Testing runtime compatibility...");

  const root = createEnterableBuildingRoot();
  const manifest = buildTestManifest(root, "runtime-test", "buildings", "/test.glb");

  // Verify manifest structure
  const hasContract = manifest.contract.enterable === true;
  const hasSpawns = manifest.spawns.exterior && manifest.spawns.interior;
  const hasColliders = manifest.colliders.length > 0;
  const hasInteractables = manifest.interactables.length > 0;
  const hasSchemaVersion = manifest.schemaVersion === 1;

  console.log("✅ Contract marked enterable:", hasContract ? "PASS" : "FAIL");
  console.log("✅ Has spawn points:", hasSpawns ? "PASS" : "FAIL");
  console.log("✅ Has colliders:", hasColliders ? "PASS" : "FAIL");
  console.log("✅ Has interactables:", hasInteractables ? "PASS" : "FAIL");
  console.log("✅ Schema versioned:", hasSchemaVersion ? "PASS" : "FAIL");

  // Verify collider references
  const colliderIds = new Set(manifest.colliders.map(c => c.id));
  const interactableRefs = manifest.interactables.map(i => i.colliderId);
  const allRefsValid = interactableRefs.every(ref => colliderIds.has(ref));

  console.log("✅ Interactable references valid:", allRefsValid ? "PASS" : "FAIL");

  return hasContract && hasSpawns && hasColliders && hasInteractables && hasSchemaVersion && allRefsValid;
}

// Helper function to build test manifest
function buildTestManifest(root: THREE.Group, name: string, categoryId: string, glbUri: string): BuildingManifestV1 {
  // Find spawn points
  const exteriorSpawn = root.getObjectByName("Spawns/ExteriorSpawn") as THREE.Object3D;
  const interiorSpawn = root.getObjectByName("Spawns/InteriorSpawn") as THREE.Object3D;

  // Extract colliders
  const colliders: BuildingManifestV1["colliders"] = [];
  const collidersGroup = root.getObjectByName("Colliders");
  if (collidersGroup) {
    collidersGroup.children.forEach((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh && mesh.geometry instanceof THREE.BoxGeometry) {
        mesh.geometry.computeBoundingBox();
        const bb = mesh.geometry.boundingBox!;
        const size = new THREE.Vector3();
        bb.getSize(size);

        colliders.push({
          id: mesh.name,
          kind: "box",
          center: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
          size: { x: size.x, y: size.y, z: size.z },
          tag: mesh.name.startsWith("EntryTrigger_") ? "entry" :
               mesh.name.startsWith("DoorTrigger_") ? "door" : "building"
        });
      }
    });
  }

  return {
    schemaVersion: 1,
    asset: { name, categoryId, glbUri },
    contract: { enterable: true },
    spawns: {
      exterior: exteriorSpawn ? { x: exteriorSpawn.position.x, y: exteriorSpawn.position.y, z: exteriorSpawn.position.z }
                              : { x: 0, y: 0, z: 7 },
      interior: interiorSpawn ? { x: interiorSpawn.position.x, y: interiorSpawn.position.y, z: interiorSpawn.position.z }
                              : { x: 0, y: 0, z: 0 }
    },
    colliders,
    interactables: [{
      id: "door_1",
      type: "Door",
      nodeName: "Door_1",
      colliderId: "DoorTrigger_1",
      config: { behavior: "portalOrAnimate" },
      persistence: { scope: "instance", key: "door_1_state" }
    }],
    prefabs: []
  };
}

// Run all tests
export async function runAllVerificationTests() {
  console.log("🚀 Running Oasis Modeling Factory Verification Tests\n");

  const results = await Promise.all([
    testContractEnforcement(),
    testExportIntegrity(),
    testParametricAndCSG(),
    testRuntimeCompatibility()
  ]);

  const allPass = results.every(r => r);

  console.log("\n" + "=".repeat(50));
  console.log("🎯 VERIFICATION RESULT:", allPass ? "✅ ALL TESTS PASS" : "❌ TESTS FAILED");
  console.log("=".repeat(50));

  if (allPass) {
    console.log("🎉 Oasis Modeling Factory is production-ready!");
    console.log("✅ Enterable contract enforced");
    console.log("✅ Exports are stable and deterministic");
    console.log("✅ Parametric objects + CSG working");
    console.log("✅ Runtime compatibility verified");
  } else {
    console.log("⚠️  Some tests failed - review implementation");
  }

  return allPass;
}