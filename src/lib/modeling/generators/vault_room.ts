import * as THREE from "three";
import type { VaultRoomPlan } from "../prompt-schema";
import { wallMaterial, floorMaterial, tableMaterial } from "./material";

function setUserData(group: THREE.Group, plan: VaultRoomPlan) {
  group.userData = {
    planKind: plan.kind,
    planVersion: plan.version,
    params: { w: plan.w, d: plan.d, h: plan.h, wallThickness: plan.wallThickness },
  };
}

export function genVaultRoom(plan: VaultRoomPlan): THREE.Group {
  const root = new THREE.Group();
  root.name = `VaultRoom_${plan.w}x${plan.d}`;
  setUserData(root, plan);

  const { w, d, h, wallThickness: wt, hasTable, style } = plan;
  const mat = wallMaterial(style);

  const halfW = (w + wt * 2) / 2;
  const halfD = (d + wt * 2) / 2;

  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(w + wt * 2, 0.2, d + wt * 2),
    floorMaterial()
  );
  floor.name = "floor";
  floor.position.set(0, -0.1, 0);
  floor.receiveShadow = true;
  root.add(floor);

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(w + wt * 2, h, wt),
    mat
  );
  back.name = "wall_south";
  back.position.set(0, h / 2, -halfD);
  back.castShadow = true;
  root.add(back);

  const doorW = 0.9;
  const leftFront = new THREE.Mesh(
    new THREE.BoxGeometry(halfW - doorW / 2, h, wt),
    mat
  );
  leftFront.name = "wall_north_left";
  leftFront.position.set(-(halfW - doorW / 2) / 2 - doorW / 2, h / 2, halfD);
  leftFront.castShadow = true;
  root.add(leftFront);
  const rightFront = new THREE.Mesh(
    new THREE.BoxGeometry(halfW - doorW / 2, h, wt),
    mat
  );
  rightFront.name = "wall_north_right";
  rightFront.position.set((halfW - doorW / 2) / 2 + doorW / 2, h / 2, halfD);
  rightFront.castShadow = true;
  root.add(rightFront);

  const left = new THREE.Mesh(
    new THREE.BoxGeometry(wt, h, d + wt * 2),
    mat
  );
  left.name = "wall_west";
  left.position.set(-halfW, h / 2, 0);
  left.castShadow = true;
  root.add(left);

  const right = new THREE.Mesh(
    new THREE.BoxGeometry(wt, h, d + wt * 2),
    mat
  );
  right.name = "wall_east";
  right.position.set(halfW, h / 2, 0);
  right.castShadow = true;
  root.add(right);

  if (hasTable) {
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.8, 0.7),
      tableMaterial()
    );
    table.name = "table";
    table.position.set(0, 0.4, 0);
    table.castShadow = true;
    root.add(table);
  }

  return root;
}
