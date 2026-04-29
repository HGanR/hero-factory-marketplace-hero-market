import * as THREE from "three";

export function createEnterableBuildingRoot() {
  const root = new THREE.Group();
  root.name = "BuildingRoot";

  const exterior = new THREE.Group(); exterior.name = "Exterior";
  const interior = new THREE.Group(); interior.name = "Interior";
  const colliders = new THREE.Group(); colliders.name = "Colliders";
  const interactables = new THREE.Group(); interactables.name = "Interactables";
  const spawns = new THREE.Group(); spawns.name = "Spawns";

  // Minimal visible building shell (you'll expand later with param tools)
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(10, 6, 10),
    new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.0 })
  );
  shell.name = "Shell";
  shell.position.set(0, 3, 0);
  exterior.add(shell);

  // Spawn points
  const exteriorSpawn = new THREE.Object3D();
  exteriorSpawn.name = "ExteriorSpawn";
  exteriorSpawn.position.set(0, 0, 7);

  const interiorSpawn = new THREE.Object3D();
  interiorSpawn.name = "InteriorSpawn";
  interiorSpawn.position.set(0, 0, 0);

  spawns.add(exteriorSpawn, interiorSpawn);

  // Door placeholder
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2.2, 0.15),
    new THREE.MeshStandardMaterial({ roughness: 0.7 })
  );
  door.name = "Door_1";
  door.position.set(0, 1.1, 5.0);
  exterior.add(door);

  // Colliders are invisible meshes (used for editor + manifest extraction)
  const entryTrigger = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 2.5, 2.5),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  entryTrigger.name = "EntryTrigger_1";
  entryTrigger.position.set(0, 1.25, 6.5);
  colliders.add(entryTrigger);

  const doorTrigger = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 2.5, 1.2),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  doorTrigger.name = "DoorTrigger_1";
  doorTrigger.position.set(0, 1.25, 5.7);
  colliders.add(doorTrigger);

  const buildingCollider = new THREE.Mesh(
    new THREE.BoxGeometry(12, 7, 12),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  buildingCollider.name = "BuildingCollider";
  buildingCollider.position.set(0, 3.5, 0);
  colliders.add(buildingCollider);

  root.add(exterior, interior, colliders, interactables, spawns);
  return root;
}

/** Empty design root (no building shell) — for AI world import. */
export function createEmptyDesignRoot() {
  const root = new THREE.Group();
  root.name = "BuildingRoot";
  const exterior = new THREE.Group();
  exterior.name = "Exterior";
  const interior = new THREE.Group();
  interior.name = "Interior";
  root.add(exterior, interior);
  return root;
}