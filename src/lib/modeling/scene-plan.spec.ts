import { describe, expect, it } from "@jest/globals";
import * as THREE from "three";
import type { ScenePlan } from "./prompt-schema";
import {
  clearAddons,
  duplicateSceneObject,
  getContainerIndex,
  normalizeScene,
  removeSceneObject,
  reorderSceneObject,
} from "./scene-plan";
import { generateFromPlan } from "./generators";

function sampleScene(): ScenePlan {
  return {
    version: 1,
    kind: "scene",
    seed: 7,
    objects: [
      {
        id: "primary",
        plan: { version: 1, kind: "conference_room", w: 6, d: 5, h: 3, tableSeats: 8, style: "modern" },
      },
      {
        id: "podium_1",
        plan: { version: 1, kind: "podium", w: 0.6, d: 0.4, h: 1.1, hasPlaque: true, style: "classic" },
        placement: { mode: "auto", anchor: "near_wall" },
      },
      {
        id: "podium_2",
        plan: { version: 1, kind: "podium", w: 0.6, d: 0.4, h: 1.1, hasPlaque: true, style: "classic" },
        placement: { mode: "auto", anchor: "near_wall" },
      },
    ],
  };
}

describe("scene-plan utilities", () => {
  it("locks container and prevents removal", () => {
    const scene = normalizeScene(sampleScene());
    const container = scene.objects[getContainerIndex(scene)];
    expect(container.locked).toBe(true);
    const next = removeSceneObject(scene, container.id);
    expect(next.objects.length).toBe(scene.objects.length);
  });

  it("remove add-on reduces object count and still generates", () => {
    const scene = normalizeScene(sampleScene());
    const next = removeSceneObject(scene, "podium_2");
    expect(next.objects.length).toBe(scene.objects.length - 1);
    expect(() => generateFromPlan(next)).not.toThrow();
  });

  it("reorder is deterministic for same seed", () => {
    const scene = normalizeScene(sampleScene());
    const moved = reorderSceneObject(scene, "podium_2", -1);
    const g1 = generateFromPlan(moved);
    const g2 = generateFromPlan(moved);
    const b1 = (g1.children[1] as THREE.Object3D).position.clone();
    const b2 = (g2.children[1] as THREE.Object3D).position.clone();
    expect(b1.x).toBeCloseTo(b2.x, 6);
    expect(b1.z).toBeCloseTo(b2.z, 6);
  });

  it("clearAddons keeps only container", () => {
    const scene = normalizeScene(sampleScene());
    const cleared = clearAddons(scene);
    expect(cleared.objects.length).toBe(1);
  });

  it("duplicate appends new object", () => {
    const scene = normalizeScene(sampleScene());
    const next = duplicateSceneObject(scene, "podium_1");
    expect(next.objects.length).toBe(scene.objects.length + 1);
  });
});

