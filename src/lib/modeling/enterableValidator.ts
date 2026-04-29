import * as THREE from "three";

export type EnterableCheck = { id: string; ok: boolean; message: string };

function hasNamedChild(root: THREE.Object3D, path: string) {
  const parts = path.split("/");
  let cur: THREE.Object3D | undefined = root;
  for (const p of parts) {
    cur = cur?.children.find((c) => c.name === p);
    if (!cur) return false;
  }
  return true;
}

export function validateEnterable(root: THREE.Object3D): { ok: boolean; checks: EnterableCheck[] } {
  const checks: EnterableCheck[] = [
    { id: "Exterior", ok: hasNamedChild(root, "Exterior"), message: "Missing group: Exterior" },
    { id: "Interior", ok: hasNamedChild(root, "Interior"), message: "Missing group: Interior" },
    { id: "Colliders", ok: hasNamedChild(root, "Colliders"), message: "Missing group: Colliders" },
    { id: "Interactables", ok: hasNamedChild(root, "Interactables"), message: "Missing group: Interactables" },
    { id: "Spawns", ok: hasNamedChild(root, "Spawns"), message: "Missing group: Spawns" },
    { id: "ExteriorSpawn", ok: hasNamedChild(root, "Spawns/ExteriorSpawn"), message: "Missing: Spawns/ExteriorSpawn" },
    { id: "InteriorSpawn", ok: hasNamedChild(root, "Spawns/InteriorSpawn"), message: "Missing: Spawns/InteriorSpawn" },
    { id: "EntryTrigger", ok: hasNamedChild(root, "Colliders/EntryTrigger_1"), message: "Missing: Colliders/EntryTrigger_1" },
    { id: "Door", ok: hasNamedChild(root, "Exterior/Door_1"), message: "Missing: Exterior/Door_1" },
    { id: "DoorTrigger", ok: hasNamedChild(root, "Colliders/DoorTrigger_1"), message: "Missing: Colliders/DoorTrigger_1" },
    { id: "BuildingCollider", ok: hasNamedChild(root, "Colliders/BuildingCollider"), message: "Missing: Colliders/BuildingCollider" },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}