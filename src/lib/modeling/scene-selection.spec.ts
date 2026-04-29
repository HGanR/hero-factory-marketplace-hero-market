import { describe, expect, it } from "@jest/globals";
import * as THREE from "three";
import { findSceneGroupById, getSceneObjectIdFromHit } from "./scene-selection";

describe("scene-selection helpers", () => {
  it("finds scene object by id in hierarchy", () => {
    const root = new THREE.Group();
    const a = new THREE.Group();
    a.userData.sceneObjectId = "a";
    const b = new THREE.Group();
    b.userData.sceneObjectId = "b";
    root.add(a);
    root.add(b);

    expect(findSceneGroupById(root, "b")).toBe(b);
    expect(findSceneGroupById(root, "missing")).toBeNull();
  });

  it("resolves sceneObjectId from clicked descendant", () => {
    const group = new THREE.Group();
    group.userData.sceneObjectId = "x";
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
    group.add(mesh);

    expect(getSceneObjectIdFromHit(mesh)).toBe("x");
  });
});

