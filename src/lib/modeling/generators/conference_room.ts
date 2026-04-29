import * as THREE from "three";
import type { ConferenceRoomPlan } from "../prompt-schema";
import { wallMaterial, floorMaterial, tableMaterial } from "./material";

function setUserData(group: THREE.Group, plan: ConferenceRoomPlan) {
  group.userData = {
    planKind: plan.kind,
    planVersion: plan.version,
    params: { w: plan.w, d: plan.d, h: plan.h, tableSeats: plan.tableSeats },
  };
}

export function genConferenceRoom(plan: ConferenceRoomPlan): THREE.Group {
  const root = new THREE.Group();
  root.name = `ConferenceRoom_${plan.w}x${plan.d}`;
  setUserData(root, plan);

  const { w, d, h, tableSeats, style } = plan;
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

  const halfW = (w + wallThickness * 2) / 2;
  const halfD = (d + wallThickness * 2) / 2;

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(w + wallThickness * 2, h, wallThickness),
    mat
  );
  back.name = "wall_south";
  back.position.set(0, h / 2, -halfD);
  back.castShadow = true;
  root.add(back);

  const front = new THREE.Mesh(
    new THREE.BoxGeometry(w + wallThickness * 2, h, wallThickness),
    mat
  );
  front.name = "wall_north";
  front.position.set(0, h / 2, halfD);
  front.castShadow = true;
  root.add(front);

  const left = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, h, d + wallThickness * 2),
    mat
  );
  left.name = "wall_west";
  left.position.set(-halfW, h / 2, 0);
  left.castShadow = true;
  root.add(left);

  const right = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, h, d + wallThickness * 2),
    mat
  );
  right.name = "wall_east";
  right.position.set(halfW, h / 2, 0);
  right.castShadow = true;
  root.add(right);

  const tableW = Math.min(w - 1.5, 2 + tableSeats * 0.25);
  const tableD = Math.min(d - 1.5, 1.2);
  const tableH = 0.75;
  const table = new THREE.Mesh(
    new THREE.BoxGeometry(tableW, tableH, tableD),
    tableMaterial()
  );
  table.name = "table";
  table.position.set(0, tableH / 2, 0);
  table.castShadow = true;
  root.add(table);

  return root;
}
