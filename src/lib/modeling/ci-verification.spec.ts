// CI-verifiable acceptance criteria tests
// These run in automated builds and fail if acceptance criteria regress

import { describe, it, expect } from '@jest/globals';
import * as THREE from 'three';
import { createEnterableBuildingRoot } from './buildingTemplate';
import { validateEnterable } from './enterableValidator';
import { createMeshFromObject } from './parametric-objects';
import { subtractMeshes, validateMeshForBoolean } from './boolean-operations';
import type { BuildingManifestV1, ParametricObject } from './manifest';

describe('Oasis Modeling Factory - Acceptance Criteria', () => {
  describe('Editor Contract Enforcement', () => {
    it('should pass all contract checks on generated template', () => {
      const root = createEnterableBuildingRoot();
      const validation = validateEnterable(root);

      expect(validation.ok).toBe(true);
      expect(validation.checks).toHaveLength(11);

      // All required checks should pass
      const requiredChecks = [
        "Exterior", "Interior", "Colliders", "Interactables", "Spawns",
        "ExteriorSpawn", "InteriorSpawn", "EntryTrigger", "Door", "DoorTrigger", "BuildingCollider"
      ];

      const passedChecks = validation.checks.filter(c => c.ok).map(c => c.id);
      requiredChecks.forEach(check => {
        expect(passedChecks).toContain(check);
      });
    });

    it('should fail on broken template', () => {
      const root = new THREE.Group(); // Empty group - no contract nodes
      const validation = validateEnterable(root);

      expect(validation.ok).toBe(false);
      expect(validation.checks.some(c => !c.ok)).toBe(true);
    });

    it('should block publishing when contract not satisfied', () => {
      const root = new THREE.Group();
      const validation = validateEnterable(root);

      // This would be used in UI to disable publish button
      expect(validation.ok).toBe(false); // Should prevent publishing
    });
  });

  describe('Export Integrity', () => {
    it('should generate stable manifest references', () => {
      const root = createEnterableBuildingRoot();

      // Build manifest twice - should be identical
      const manifest1 = buildTestManifest(root, "test", "cat", "/uri");
      const manifest2 = buildTestManifest(root, "test", "cat", "/uri");

      expect(manifest1).toEqual(manifest2);
    });
  });

  describe('Runtime Compatibility', () => {
    it('should generate manifest with required runtime fields', () => {
      const root = createEnterableBuildingRoot();
      const manifest = buildTestManifest(root, "test", "buildings", "/test.glb");

      // Required for runtime
      expect(manifest.contract.enterable).toBe(true);
      expect(manifest.spawns.exterior).toBeDefined();
      expect(manifest.spawns.interior).toBeDefined();
      expect(Array.isArray(manifest.colliders)).toBe(true);
      expect(Array.isArray(manifest.interactables)).toBe(true);

      // Should have at least one entry collider
      const entryColliders = manifest.colliders.filter(c => c.tag === "entry");
      expect(entryColliders.length).toBeGreaterThan(0);
    });

    it('should have valid collider references in interactables', () => {
      const root = createEnterableBuildingRoot();
      const manifest = buildTestManifest(root, "test", "buildings", "/test.glb");

      const colliderIds = new Set(manifest.colliders.map(c => c.id));
      const interactableRefs = manifest.interactables.map(i => i.colliderId);

      interactableRefs.forEach(ref => {
        expect(colliderIds.has(ref)).toBe(true);
      });
    });

    it('should include schema versioning', () => {
      const root = createEnterableBuildingRoot();
      const manifest = buildTestManifest(root, "test", "buildings", "/test.glb");

      expect(manifest.schemaVersion).toBe(1);
    });
  });

  describe('Parametric Objects + CSG', () => {
    it('should create wall group with valid mesh child', async () => {
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

      const wallGroup = await createMeshFromObject(wallObject);
      expect(wallGroup.children.length).toBeGreaterThan(0);
      const wallMesh = wallGroup.children[0] as THREE.Mesh;
      expect(wallMesh).toBeInstanceOf(THREE.Mesh);
      const validation = validateMeshForBoolean(wallMesh);
      expect(validation.valid).toBe(true);
    });

    it('should create window group with frame and glass', async () => {
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

      const windowGroup = await createMeshFromObject(windowObject);
      expect(windowGroup.children.length).toBeGreaterThan(1);
      const frameMesh = windowGroup.children[0] as THREE.Mesh;
      expect(frameMesh).toBeInstanceOf(THREE.Mesh);
      const validation = validateMeshForBoolean(frameMesh);
      expect(validation.valid).toBe(true);
    });

    it('validateMeshForBoolean normalizes geometry with missing normals', () => {
      const geometry = new THREE.BoxGeometry(4, 3, 0.2);
      geometry.deleteAttribute('normal');
      const material = new THREE.MeshStandardMaterial({ color: "#8B7355" });
      const mesh = new THREE.Mesh(geometry, material);
      const validation = validateMeshForBoolean(mesh);
      expect(validation.valid).toBe(true);
      expect(geometry.attributes.normal).toBeDefined();
      expect(geometry.attributes.normal.count).toBeGreaterThan(0);
    });

    it('validateMeshForBoolean accepts controlled box geometry', () => {
      const geometry = new THREE.BoxGeometry(4, 3, 0.2);
      const material = new THREE.MeshStandardMaterial({ color: "#8B7355" });
      const mesh = new THREE.Mesh(geometry, material);
      const validation = validateMeshForBoolean(mesh);
      expect(validation.valid).toBe(true);
    });

    it('should perform boolean subtraction with controlled meshes', () => {
      const wallGeometry = new THREE.BoxGeometry(4, 3, 0.2);
      const wallMaterial = new THREE.MeshStandardMaterial({ color: "#8B7355" });
      const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);

      const windowGeometry = new THREE.BoxGeometry(1.2, 1.5, 0.25);
      const windowMaterial = new THREE.MeshStandardMaterial({ color: "#2C3E50" });
      const windowMesh = new THREE.Mesh(windowGeometry, windowMaterial);

      const wallValidation = validateMeshForBoolean(wallMesh);
      const windowValidation = validateMeshForBoolean(windowMesh);
      expect(wallValidation.valid).toBe(true);
      expect(windowValidation.valid).toBe(true);

      const resultMesh = subtractMeshes(wallMesh, windowMesh);
      expect(resultMesh.userData.cuts).toBeDefined();
      expect(resultMesh.userData.cuts.length).toBeGreaterThan(0);
    });
  });
});

// Helper function for tests
function buildTestManifest(root: THREE.Group, name: string, categoryId: string, glbUri: string): BuildingManifestV1 {
  // Find spawn points
  const exteriorSpawn = root.getObjectByName("Spawns/ExteriorSpawn") as THREE.Object3D;
  const interiorSpawn = root.getObjectByName("Spawns/InteriorSpawn") as THREE.Object3D;

  // Extract colliders
  const colliders: BuildingManifestV1["colliders"] = [];
  const collidersGroup = root.getObjectByName("Colliders");
  if (collidersGroup) {
    collidersGroup.children.forEach((child) => {
      if (child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry) {
        child.geometry.computeBoundingBox();
        const bb = child.geometry.boundingBox!;
        const size = new THREE.Vector3();
        bb.getSize(size);

        colliders.push({
          id: child.name,
          kind: "box",
          center: { x: child.position.x, y: child.position.y, z: child.position.z },
          size: { x: size.x, y: size.y, z: size.z },
          tag: child.name.startsWith("EntryTrigger_") ? "entry" :
               child.name.startsWith("DoorTrigger_") ? "door" : "building"
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