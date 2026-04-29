import { describe, it, expect } from "@jest/globals";
import * as THREE from "three";
import { parsePrompt } from "./prompt-parser";
import { generateFromPlan } from "./generators";
import { BuildPlanSchema } from "./prompt-schema";
import { disposeObject3D } from "./dispose";

describe("Prompt Parser", () => {
  it("conference room 12x10 → correct kind + dims", () => {
    const { plan, assumptions } = parsePrompt("conference room 12x10");
    expect(plan.kind).toBe("conference_room");
    expect(plan.version).toBe(1);
    expect((plan as { w: number }).w).toBe(12);
    expect((plan as { d: number }).d).toBe(10);
  });

  it("vault room 20ft by 30ft → meters conversion + assumptions", () => {
    const { plan, assumptions } = parsePrompt("vault room 20ft by 30ft");
    expect(plan.kind).toBe("vault_room");
    const p = plan as { w: number; d: number };
    expect(p.w).toBeCloseTo(20 * 0.3048, 2);
    expect(p.d).toBeCloseTo(30 * 0.3048, 2);
    expect(assumptions.some((a) => a.includes("Converted feet"))).toBe(true);
  });

  it("family office HQ two floors → floors=2", () => {
    const { plan } = parsePrompt("family office HQ two floors");
    expect(plan.kind).toBe("office_hq");
    expect((plan as { floors: number }).floors).toBe(2);
  });

  it("3-story headquarters → floors=3", () => {
    const { plan } = parsePrompt("3-story headquarters");
    expect(plan.kind).toBe("office_hq");
    expect((plan as { floors: number }).floors).toBe(3);
  });

  it("ambiguous 'pine tree' does not match structural", () => {
    const { assumptions } = parsePrompt("pine tree");
    expect(assumptions.some((a) => a.includes("Unrecognized prompt"))).toBe(true);
  });

  it("conference room with pine tree → suggestedAsset", () => {
    const { plan, suggestedAsset } = parsePrompt("conference room with pine tree");
    expect(plan.kind).toBe("conference_room");
    expect(suggestedAsset).toBeDefined();
    expect(suggestedAsset?.name).toBe("Pine Tree");
    expect(suggestedAsset?.assetUri).toContain("tree_pine");
  });

  it("conference room with podium → suggestedObject", () => {
    const { plan, suggestedObject } = parsePrompt("conference room 12x10 with podium");
    expect(plan.kind).toBe("conference_room");
    expect(suggestedObject).toBeDefined();
    expect(suggestedObject?.kind).toBe("podium");
    expect(suggestedObject?.placement.anchor).toBe("near_wall");
  });
});

describe("Generator Smoke", () => {
  const roomPlan = { version: 1, kind: "room" as const, w: 8, d: 6, h: 3, doors: 1, windows: 2, style: "modern" as const };
  const confPlan = { version: 1, kind: "conference_room" as const, w: 6, d: 5, h: 3, tableSeats: 8, style: "modern" as const };

  it("generateFromPlan returns THREE.Group", () => {
    const group = generateFromPlan(roomPlan);
    expect(group).toBeInstanceOf(THREE.Group);
  });

  it("group has non-zero children", () => {
    const group = generateFromPlan(roomPlan);
    expect(group.children.length).toBeGreaterThan(0);
  });

  it("group has userData with planKind", () => {
    const group = generateFromPlan(roomPlan);
    expect(group.userData?.planKind).toBe("room");
    expect(group.userData?.planVersion).toBe(1);
  });

  it("bounding box within expected range", () => {
    const group = generateFromPlan(roomPlan);
    const box = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box.getSize(size);
    expect(size.x).toBeLessThanOrEqual(250);
    expect(size.y).toBeLessThanOrEqual(250);
    expect(size.z).toBeLessThanOrEqual(250);
  });
});

describe("BuildPlanSchema", () => {
  it("validates room plan with version", () => {
    const raw = { version: 1, kind: "room", w: 8, d: 6, h: 3, doors: 1, windows: 2, style: "modern" };
    const plan = BuildPlanSchema.parse(raw);
    expect(plan.kind).toBe("room");
    expect(plan.version).toBe(1);
  });

  it("rejects dimensions > 200", () => {
    const raw = { version: 1, kind: "room", w: 300, d: 6, h: 3, doors: 1, windows: 2, style: "modern" };
    expect(() => BuildPlanSchema.parse(raw)).toThrow();
  });

  it("vault wallThickness < min(w,d)/2", () => {
    const raw = { version: 1, kind: "vault_room", w: 4, d: 4, h: 3, wallThickness: 0.4, hasTable: true, style: "classic" };
    const plan = BuildPlanSchema.parse(raw);
    expect(plan.kind).toBe("vault_room");
  });

  it("rejects vault with wallThickness >= min(w,d)/2", () => {
    const raw = { version: 1, kind: "vault_room", w: 4, d: 4, h: 3, wallThickness: 2.5, hasTable: true, style: "classic" };
    expect(() => BuildPlanSchema.parse(raw)).toThrow();
  });

  it("tableSeats bounded 2..40", () => {
    const raw = { version: 1, kind: "conference_room", w: 6, d: 5, h: 3, tableSeats: 25, style: "modern" };
    const plan = BuildPlanSchema.parse(raw);
    expect((plan as { tableSeats: number }).tableSeats).toBe(25);
  });

  it("rejects unknown keys (strict schema)", () => {
    const raw = { version: 1, kind: "room", w: 8, d: 6, h: 3, doors: 1, windows: 2, style: "modern", unknownKey: "nope" };
    expect(() => BuildPlanSchema.parse(raw)).toThrow();
  });

  it("accepts scene plan with nested objects", () => {
    const raw = {
      version: 1,
      kind: "scene",
      seed: 42,
      objects: [
        { id: "a", plan: { version: 1, kind: "conference_room", w: 6, d: 5, h: 3, tableSeats: 8, style: "modern" } },
        { id: "b", plan: { version: 1, kind: "podium", w: 0.6, d: 0.4, h: 1.1, hasPlaque: true, style: "classic" }, placement: { mode: "auto", anchor: "near_wall" } },
      ],
    };
    const scene = BuildPlanSchema.parse(raw);
    expect(scene.kind).toBe("scene");
    expect((scene as { objects: unknown[] }).objects.length).toBe(2);
  });
});

describe("Disposal", () => {
  it("regenerate twice without object count ballooning", () => {
    const plan = { version: 1, kind: "room", w: 8, d: 6, h: 3, doors: 1, windows: 2, style: "modern" };
    const countMeshes = (obj: THREE.Object3D): number => {
      let n = 0;
      obj.traverse((c) => { if (c instanceof THREE.Mesh) n++; });
      return n;
    };
    const g1 = generateFromPlan(plan);
    const n1 = countMeshes(g1);
    disposeObject3D(g1);
    const g2 = generateFromPlan(plan);
    const n2 = countMeshes(g2);
    disposeObject3D(g2);
    const g3 = generateFromPlan(plan);
    const n3 = countMeshes(g3);
    expect(n1).toBe(n2);
    expect(n2).toBe(n3);
    disposeObject3D(g3);
  });
});

describe("Roundtrip persistence", () => {
  it("save planJson → reload → generate → bounding box consistent", () => {
    const plan = { version: 1, kind: "room", w: 8, d: 6, h: 3, doors: 1, windows: 2, style: "modern" };
    const g1 = generateFromPlan(plan);
    const box1 = new THREE.Box3().setFromObject(g1);
    const size1 = new THREE.Vector3();
    box1.getSize(size1);
    const reloaded = BuildPlanSchema.parse(JSON.parse(JSON.stringify(plan)));
    const g2 = generateFromPlan(reloaded);
    const box2 = new THREE.Box3().setFromObject(g2);
    const size2 = new THREE.Vector3();
    box2.getSize(size2);
    expect(size1.x).toBeCloseTo(size2.x, 5);
    expect(size1.y).toBeCloseTo(size2.y, 5);
    expect(size1.z).toBeCloseTo(size2.z, 5);
    disposeObject3D(g1);
    disposeObject3D(g2);
  });
});
