import * as THREE from "three";
import type { OfficeHQPlan } from "../prompt-schema";
import { wallMaterial, floorMaterial, tableMaterial } from "./material";

function setUserData(group: THREE.Group, plan: OfficeHQPlan) {
  group.userData = {
    planKind: plan.kind,
    planVersion: plan.version,
    params: { floors: plan.floors, footprint: plan.footprint, rooms: plan.rooms },
  };
}

export function genOfficeHQ(plan: OfficeHQPlan): THREE.Group {
  const root = new THREE.Group();
  root.name = `OfficeHQ_${plan.footprint.w}x${plan.footprint.d}`;
  setUserData(root, plan);

  const { floors, footprint, rooms, style } = plan;
  const wallThickness = 0.25;
  const mat = wallMaterial(style);
  const { w, d } = footprint;
  const floorHeight = 3.2;

  for (let f = 0; f < floors; f++) {
    const floorY = f * floorHeight;

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(w + wallThickness * 2, 0.2, d + wallThickness * 2),
      floorMaterial()
    );
    slab.name = `floor_slab_${f}`;
    slab.position.set(0, floorY - 0.1, 0);
    slab.receiveShadow = true;
    root.add(slab);

    const h = floorHeight - 0.2;
    const halfW = (w + wallThickness * 2) / 2;
    const halfD = (d + wallThickness * 2) / 2;

    const back = new THREE.Mesh(
      new THREE.BoxGeometry(w + wallThickness * 2, h, wallThickness),
      mat
    );
    back.name = `wall_south_f${f}`;
    back.position.set(0, floorY + h / 2, -halfD);
    back.castShadow = true;
    root.add(back);

    const front = new THREE.Mesh(
      new THREE.BoxGeometry(w + wallThickness * 2, h, wallThickness),
      mat
    );
    front.name = `wall_north_f${f}`;
    front.position.set(0, floorY + h / 2, halfD);
    front.castShadow = true;
    root.add(front);

    const left = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, h, d + wallThickness * 2),
      mat
    );
    left.name = `wall_west_f${f}`;
    left.position.set(-halfW, floorY + h / 2, 0);
    left.castShadow = true;
    root.add(left);

    const right = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, h, d + wallThickness * 2),
      mat
    );
    right.name = `wall_east_f${f}`;
    right.position.set(halfW, floorY + h / 2, 0);
    right.castShadow = true;
    root.add(right);

    if (f === 0 && rooms.includes("reception")) {
      const table = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 1.0, 0.6),
        tableMaterial()
      );
      table.name = "reception_table";
      table.position.set(0, floorY + 0.5, halfD - 1.5);
      table.castShadow = true;
      root.add(table);
    }
  }

  return root;
}
