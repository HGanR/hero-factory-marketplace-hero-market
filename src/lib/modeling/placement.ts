import * as THREE from "three";

type Anchor = "center" | "near_wall" | "on_table" | "near_door";

function hashToUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function computeContainerBox(container: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(container);
}

function findNamedObject(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((child) => {
    if (!found && child.name.toLowerCase() === name.toLowerCase()) found = child;
  });
  return found;
}

/**
 * Deterministic local-space placement. Keeps object within container bounds
 * and applies tiny seeded jitter so repeated layouts do not look perfectly rigid.
 */
export function resolveAutoPlacement(params: {
  container: THREE.Object3D;
  object: THREE.Object3D;
  anchor: Anchor;
  seed: number;
  objectId: string;
}): THREE.Vector3 {
  const { container, object, anchor, seed, objectId } = params;
  const cBox = computeContainerBox(container);
  const oBox = new THREE.Box3().setFromObject(object);

  const cCenter = new THREE.Vector3();
  const cSize = new THREE.Vector3();
  cBox.getCenter(cCenter);
  cBox.getSize(cSize);

  const oSize = new THREE.Vector3();
  oBox.getSize(oSize);

  const inset = 0.25;
  const halfW = Math.max(0, cSize.x / 2 - oSize.x / 2 - inset);
  const halfD = Math.max(0, cSize.z / 2 - oSize.z / 2 - inset);
  const baseY = -oBox.min.y; // rest on floor

  const pos = new THREE.Vector3(cCenter.x, baseY, cCenter.z);
  if (anchor === "near_wall") {
    pos.z = cCenter.z + halfD;
  } else if (anchor === "near_door") {
    pos.z = cCenter.z - halfD;
  } else if (anchor === "on_table") {
    const table = findNamedObject(container, "table");
    if (table) {
      const tBox = new THREE.Box3().setFromObject(table);
      const tCenter = new THREE.Vector3();
      tBox.getCenter(tCenter);
      pos.x = tCenter.x;
      pos.z = tCenter.z;
      pos.y = tBox.max.y + oSize.y / 2 + 0.01;
    }
  }

  const jitterSeed = seed + objectId.length * 97;
  const jitterX = (hashToUnit(jitterSeed) - 0.5) * 0.06;
  const jitterZ = (hashToUnit(jitterSeed + 1) - 0.5) * 0.06;
  pos.x += jitterX;
  pos.z += jitterZ;

  // Clamp to container footprint
  pos.x = Math.min(cCenter.x + halfW, Math.max(cCenter.x - halfW, pos.x));
  pos.z = Math.min(cCenter.z + halfD, Math.max(cCenter.z - halfD, pos.z));

  return pos;
}

