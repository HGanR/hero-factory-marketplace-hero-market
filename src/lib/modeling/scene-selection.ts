import * as THREE from "three";

export function findSceneGroupById(root: THREE.Object3D, id: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((obj) => {
    if (!found && obj.userData?.sceneObjectId === id) {
      found = obj;
    }
  });
  return found;
}

export function getSceneObjectIdFromHit(obj: THREE.Object3D | null): string | null {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (typeof cur.userData?.sceneObjectId === "string") return cur.userData.sceneObjectId as string;
    cur = cur.parent;
  }
  return null;
}

