/**
 * Export tests require jsdom (FileReader, Blob).
 * Run via: npm run test:browser
 *
 * Note: GLTFExporter.writeAsync uses FileReader; jsdom's impl can hang.
 * These tests are skipped in CI; run against a real browser for full coverage.
 */
import { beforeAll, describe, expect, it, jest } from "@jest/globals";
import * as THREE from "three";
import { createEnterableBuildingRoot } from "./buildingTemplate";
import { generateFromPlan } from "./generators";
import { exportGLB } from "./exportGlb";

const RUN_EXPORT_TESTS = process.env.RUN_EXPORT_TESTS === "1";

describe("exportGLB (browser)", () => {
  beforeAll(() => {
    if (RUN_EXPORT_TESTS) jest.setTimeout(15000);
  });
  it("has Blob and FileReader in environment", () => {
    expect(typeof Blob).toBe("function");
    expect(typeof FileReader).toBe("function");
  });
  (RUN_EXPORT_TESTS ? it : it.skip)(
    "exportGLB does not throw and returns valid Blob",
    async () => {
      const plan = {
        version: 1,
        kind: "conference_room" as const,
        w: 6,
        d: 5,
        h: 3,
        tableSeats: 8,
        style: "modern" as const,
      };
      const group = generateFromPlan(plan);
      const blob = await exportGLB(group);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    },
    20000
  );

  (RUN_EXPORT_TESTS ? it : it.skip)(
    "exports minimal box to valid GLB",
    async () => {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0xff0000 })
      );
      const blob = await exportGLB(box);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
      expect(blob.type).toBe("model/gltf-binary");
    },
    10000
  );

  (RUN_EXPORT_TESTS ? it : it.skip)(
    "exports building template to valid GLB",
    async () => {
      const root = createEnterableBuildingRoot();
      const glbBlob = await exportGLB(root);
      expect(glbBlob).toBeInstanceOf(Blob);
      expect(glbBlob.size).toBeGreaterThan(0);
      expect(glbBlob.type).toBe("model/gltf-binary");
    },
    30000
  );
});
