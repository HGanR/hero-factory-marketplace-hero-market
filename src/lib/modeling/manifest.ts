export type OasisVec3 = { x: number; y: number; z: number };

export type ColliderDef =
  | { id: string; kind: "box"; center: OasisVec3; size: OasisVec3; tag: "entry" | "door" | "building" }
  | { id: string; kind: "sphere"; center: OasisVec3; radius: number; tag: "entry" | "door" };

export type InteractableType =
  | "Door"
  | "LightSwitch"
  | "TV"
  | "Kiosk"
  | "Pickup"
  | "Seat"
  | "Teleport"
  | "Purchase";

export type InteractableDef = {
  id: string;
  type: InteractableType;
  nodeName: string; // node name in GLB or prefab instance id
  colliderId: string; // references ColliderDef.id
  config: Record<string, any>;
  persistence?: { scope: "instance" | "visitor"; key: string };
};

export type PrefabInstance = {
  id: string;
  elementId: string; // oasis element library id
  transform: { position: OasisVec3; rotation: OasisVec3; scale: OasisVec3 };
  parentGroup: "Interior" | "Exterior";
};

export type BuildingManifestV1 = {
  schemaVersion: 1;
  asset: { name: string; categoryId: string; glbUri: string };
  contract: { enterable: true };
  spawns: { exterior: OasisVec3; interior: OasisVec3 };
  colliders: ColliderDef[];
  interactables: InteractableDef[];
  prefabs: PrefabInstance[];
};