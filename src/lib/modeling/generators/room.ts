import * as THREE from "three";
import type { RoomPlan } from "../prompt-schema";
import { wallMaterial, floorMaterial } from "./material";

function setUserData(group: THREE.Group, plan: RoomPlan) {
  group.userData = {
    planKind: plan.kind,
    planVersion: plan.version,
    params: { w: plan.w, d: plan.d, h: plan.h, doors: plan.doors, windows: plan.windows },
  };
}

export function genRoom(plan: RoomPlan): THREE.Group {
  const root = new THREE.Group();
  root.name = `Room_${plan.w}x${plan.d}`;
  setUserData(root, plan);

  const { w, d, h, doors, windows, style } = plan;
  const wallThickness = 0.2;
  const mat = wallMaterial(style);

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(w + wallThickness * 2, 0.1, d + wallThickness * 2),
    floorMaterial()
  );
  floor.name = "floor";
  floor.position.set(0, -0.05, 0);
  floor.receiveShadow = true;
  root.add(floor);

  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(w + wallThickness * 2, h, wallThickness),
    mat
  );
  backWall.name = "wall_south";
  backWall.position.set(0, h / 2, -(d / 2 + wallThickness / 2));
  backWall.castShadow = true;
  root.add(backWall);

  if (doors === 0) {
    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(w + wallThickness * 2, h, wallThickness),
      mat
    );
    frontWall.name = "wall_north";
    frontWall.position.set(0, h / 2, d / 2 + wallThickness / 2);
    frontWall.castShadow = true;
    root.add(frontWall);
  } else {
    const doorW = 0.9;
    const halfW = (w + wallThickness * 2) / 2;
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(halfW - doorW / 2, h, wallThickness),
      mat
    );
    leftWall.name = "wall_north_left";
    leftWall.position.set(-(halfW - doorW / 2) / 2 - doorW / 2, h / 2, d / 2 + wallThickness / 2);
    leftWall.castShadow = true;
    root.add(leftWall);
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(halfW - doorW / 2, h, wallThickness),
      mat
    );
    rightWall.name = "wall_north_right";
    rightWall.position.set((halfW - doorW / 2) / 2 + doorW / 2, h / 2, d / 2 + wallThickness / 2);
    rightWall.castShadow = true;
    root.add(rightWall);
  }

  const leftSideWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, h, d + wallThickness * 2),
    mat
  );
  leftSideWall.name = "wall_west";
  leftSideWall.position.set(-w / 2 - wallThickness / 2, h / 2, 0);
  leftSideWall.castShadow = true;
  root.add(leftSideWall);

  const rightSideWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, h, d + wallThickness * 2),
    mat
  );
  rightSideWall.name = "wall_east";
  rightSideWall.position.set(w / 2 + wallThickness / 2, h / 2, 0);
  rightSideWall.castShadow = true;
  root.add(rightSideWall);

  return root;
}
