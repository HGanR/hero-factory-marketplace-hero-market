/**
 * CorporateTowerModel.ts
 * Procedural 3D corporate office building for green-terrain world.
 * 
 * Design: Blue glass curtain-wall facade, white concrete banding,
 *         lobby atrium, working elevator, luxury interior per floor.
 */
import * as THREE from "three";

// ─── Building Config ──────────────────────────────────────────────────────
export const CORPORATE_BUILDING_CONFIG = {
  id: "corporate-tower",
  name: "Nexus Corporate Tower",
  floors: 10,
  height: 32,
  floorHeight: 3.2,
  footprint: { w: 12, d: 10 },
};

export const FLOOR_CONFIG = [
  { floor: 0, label: "Lobby", color: "#1a3a5c", purpose: "Reception & Security" },
  { floor: 1, label: "Floor 1 — Currency", color: "#1c4a2e", purpose: "Monetary Law" },
  { floor: 2, label: "Floor 2 — Finance", color: "#2d1a4a", purpose: "Financial Instruments" },
  { floor: 3, label: "Floor 3 — Transfer", color: "#2a3a1a", purpose: "Securities Transfer" },
  { floor: 4, label: "Floor 4 — Broker", color: "#1a2a4a", purpose: "Brokerage Onboarding" },
  { floor: 5, label: "Floor 5 — Compliance", color: "#3a2a1a", purpose: "SEC / FinCEN" },
  { floor: 6, label: "Floor 6 — Trustee", color: "#3a2a1a", purpose: "Trust Administration" },
  { floor: 7, label: "Floor 7 — Custodian", color: "#1a3a4a", purpose: "Asset Custody" },
  { floor: 8, label: "Floor 8 — Clearing", color: "#2a1a3a", purpose: "Settlement Systems" },
  { floor: 9, label: "Floor 9 — Architect", color: "#0d2a3a", purpose: "Financial Structuring" },
];

const { floorHeight, footprint, floors } = CORPORATE_BUILDING_CONFIG;
const W = footprint.w;
const D = footprint.d;

// ─── Materials ────────────────────────────────────────────────────────────
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0x2a6fbd,
  transparent: true,
  opacity: 0.72,
  roughness: 0.05,
  metalness: 0.3,
  side: THREE.DoubleSide,
});

const glassHighMat = new THREE.MeshPhysicalMaterial({
  color: 0x5a9fd4,
  transparent: true,
  opacity: 0.55,
  roughness: 0.02,
  metalness: 0.4,
});

const frameMat = new THREE.MeshLambertMaterial({ color: 0xd8dde4 });
const darkFrameMat = new THREE.MeshLambertMaterial({ color: 0x4a5568 });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xc8a96e, metalness: 0.8, roughness: 0.2 });
const steelMat = new THREE.MeshStandardMaterial({ color: 0xb0b8c4, metalness: 0.9, roughness: 0.15 });
const lobbyFloorMat = new THREE.MeshStandardMaterial({ color: 0x0d1f35, roughness: 0.3, metalness: 0.1 });
const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf0ece4, roughness: 0.4 });
const carpetMat = new THREE.MeshLambertMaterial({ color: 0x1a3050 });
const deskMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.4, metalness: 0.2 });
const chairMat = new THREE.MeshLambertMaterial({ color: 0x1a1a2e });

// ─── Helper: Box ──────────────────────────────────────────────────────────
function addBox(
  group: THREE.Group,
  pos: [number, number, number],
  size: [number, number, number],
  mat: THREE.Material
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

// ─── Glass Wall ───────────────────────────────────────────────────────────
function addGlassWall(
  group: THREE.Group,
  pos: [number, number, number],
  rot: [number, number, number] | null,
  w: number,
  h: number
): void {
  const wallGroup = new THREE.Group();
  wallGroup.position.set(...pos);
  if (rot) wallGroup.rotation.set(...rot);

  addBox(wallGroup, [0, 0, 0], [w, h, 0.08], frameMat);

  const panels = Math.floor(w / 1.4);
  for (let i = 0; i < panels; i++) {
    const x = -w / 2 + 0.7 + i * (w / panels);
    const geo = new THREE.BoxGeometry(w / panels - 0.1, h - 0.2, 0.04);
    const mesh = new THREE.Mesh(geo, i % 3 === 0 ? glassHighMat : glassMat);
    mesh.position.set(x, 0, 0.05);
    mesh.castShadow = true;
    wallGroup.add(mesh);
  }

  [0.3, -0.3].forEach((y) => {
    addBox(wallGroup, [0, y * h, 0.06], [w, 0.06, 0.06], darkFrameMat);
  });

  group.add(wallGroup);
}

// ─── Floor Band ───────────────────────────────────────────────────────────
function addFloorBand(group: THREE.Group, y: number): void {
  addBox(group, [0, y, 0], [W + 0.3, 0.25, D + 0.3], frameMat);
}

// ─── Lobby Interior ───────────────────────────────────────────────────────
function addLobbyInterior(group: THREE.Group): void {
  const lobby = new THREE.Group();
  lobby.position.y = 0.05;

  addBox(lobby, [0, 0, 0], [W - 0.4, 0.08, D - 0.4], marbleMat);
  addBox(lobby, [0, 0.5, -2.5], [4, 1.0, 1.2], deskMat);
  addBox(lobby, [0, 0.5, -2.5], [4.1, 0.08, 1.3], goldMat);
  addBox(lobby, [0, 0.05, 0], [W - 0.6, 0.04, 0.15], goldMat);
  addBox(lobby, [0, 0.05, 0], [0.15, 0.04, D - 0.6], goldMat);

  [[-2.5, 1.5], [2.5, 1.5]].forEach(([x, z]) => {
    addBox(lobby, [x, 0.22, z], [0.7, 0.08, 0.7], chairMat);
    addBox(lobby, [x, 0.55, z - 0.3], [0.7, 0.6, 0.08], chairMat);
    [[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.28], [0.28, 0.28]].forEach(([lx, lz]) => {
      addBox(lobby, [x + lx, 0.1, z + lz], [0.05, 0.2, 0.05], steelMat);
    });
  });

  [[-4.5, -3.5], [4.5, -3.5], [-4.5, 3.5], [4.5, 3.5]].forEach(([x, z]) => {
    const colGeo = new THREE.CylinderGeometry(0.18, 0.2, 2.8, 8);
    const col = new THREE.Mesh(colGeo, marbleMat);
    col.position.set(x, 1.4, z);
    col.castShadow = true;
    lobby.add(col);
    addBox(lobby, [x, 0.05, z], [0.42, 0.1, 0.42], goldMat);
    addBox(lobby, [x, 2.85, z], [0.42, 0.1, 0.42], goldMat);
  });

  const lightGeo = new THREE.BoxGeometry(6, 0.05, 0.3);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff8e7 });
  const light = new THREE.Mesh(lightGeo, lightMat);
  light.position.set(0, floorHeight - 0.15, 0);
  lobby.add(light);

  group.add(lobby);
}

// ─── Office Floor Interior ────────────────────────────────────────────────
function addOfficeFloorInterior(group: THREE.Group, floor: number): void {
  const office = new THREE.Group();
  office.position.y = 0.05;

  const cfg = FLOOR_CONFIG[floor];
  const accentMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(cfg.color) });

  addBox(office, [0, 0, 0], [W - 0.4, 0.06, D - 0.4], carpetMat);
  addBox(office, [0, 0.04, 0], [W - 0.5, 0.02, 0.12], accentMat);

  const rows = 2, cols = 3;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -3 + c * 3;
      const z = -2 + r * 3.5;
      addBox(office, [x, 0.38, z], [1.4, 0.06, 0.8], deskMat);
      addBox(office, [x, 0.65, z - 0.25], [0.7, 0.45, 0.04], darkFrameMat);
      addBox(office, [x, 0.42, z - 0.22], [0.1, 0.06, 0.1], steelMat);
      addBox(office, [x, 0.22, z + 0.5], [0.6, 0.06, 0.6], chairMat);
      addBox(office, [x, 0.52, z + 0.8], [0.6, 0.5, 0.06], chairMat);
    }
  }

  const lightGeo = new THREE.BoxGeometry(5, 0.04, 0.25);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xf0f4ff });
  const light = new THREE.Mesh(lightGeo, lightMat);
  light.position.set(0, floorHeight - 0.15, 0);
  office.add(light);

  group.add(office);
}

// ─── Elevator ─────────────────────────────────────────────────────────────
function addElevator(group: THREE.Group, currentFloor: number = 0): THREE.Group {
  const elevator = new THREE.Group();
  const shaftH = floors * floorHeight;
  const ex = W / 2 - 1.2;

  const shaftMat = new THREE.MeshLambertMaterial({
    color: 0x2a3540,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });
  addBox(elevator, [0, shaftH / 2, 0], [1.6, shaftH, 1.6], shaftMat);
  addBox(elevator, [-0.8, shaftH / 2, 0], [0.05, shaftH, 1.6], steelMat);
  addBox(elevator, [0.8, shaftH / 2, 0], [0.05, shaftH, 1.6], steelMat);

  const cabin = new THREE.Group();
  cabin.position.y = currentFloor * floorHeight + 0.1;
  addBox(cabin, [0, 1.1, 0], [1.4, 2.2, 1.4], steelMat);

  const doorGeo = new THREE.BoxGeometry(0.9, 2.0, 0.04);
  const door = new THREE.Mesh(doorGeo, glassMat);
  door.position.set(0, 1.1, 0.71);
  cabin.add(door);

  const indicatorGeo = new THREE.BoxGeometry(0.3, 0.12, 0.02);
  const indicatorMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
  const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
  indicator.position.set(0, 2.35, 0.72);
  cabin.add(indicator);

  elevator.add(cabin);
  elevator.position.set(ex, 0, 0);
  elevator.userData.cabin = cabin;
  elevator.userData.currentFloor = currentFloor;
  group.add(elevator);
  return elevator;
}

// ─── Roof ─────────────────────────────────────────────────────────────────
function addRoof(group: THREE.Group, y: number): void {
  const roof = new THREE.Group();
  roof.position.y = y;

  addBox(roof, [0, 0.15, 0], [W + 0.4, 0.3, D + 0.4], frameMat);
  addBox(roof, [0, 0.55, D / 2 + 0.1], [W + 0.5, 0.5, 0.2], frameMat);
  addBox(roof, [0, 0.55, -D / 2 - 0.1], [W + 0.5, 0.5, 0.2], frameMat);
  addBox(roof, [W / 2 + 0.1, 0.55, 0], [0.2, 0.5, D + 0.5], frameMat);
  addBox(roof, [-W / 2 - 0.1, 0.55, 0], [0.2, 0.5, D + 0.5], frameMat);

  addBox(roof, [2, 0.8, 1], [2, 1.0, 1.5], darkFrameMat);
  addBox(roof, [-2, 0.8, -1], [1.5, 0.8, 1.2], darkFrameMat);

  const antennaGeo = new THREE.CylinderGeometry(0.04, 0.04, 3, 6);
  const antennaMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8 });
  const antenna = new THREE.Mesh(antennaGeo, antennaMat);
  antenna.position.set(0, 1.5, 0);
  roof.add(antenna);

  const lightGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  const light = new THREE.Mesh(lightGeo, lightMat);
  light.position.set(0, 3.1, 0);
  roof.add(light);

  group.add(roof);
}

// ─── Entry Canopy ─────────────────────────────────────────────────────────
function addEntryCanopy(group: THREE.Group): void {
  addBox(group, [0, 1.8, D / 2 + 1.2], [5, 0.12, 2.4], glassMat);
  addBox(group, [-2.2, 0.9, D / 2 + 2.2], [0.12, 1.8, 0.12], steelMat);
  addBox(group, [2.2, 0.9, D / 2 + 2.2], [0.12, 1.8, 0.12], steelMat);
}

// ─── Main Build Function ──────────────────────────────────────────────────
export function buildCorporateTower(
  position: [number, number, number] = [0, 0, 0],
  currentElevatorFloor: number = 0
): THREE.Group {
  const building = new THREE.Group();
  building.position.set(...position);

  const totalH = floors * floorHeight;

  // Build each floor
  for (let fi = 0; fi < floors; fi++) {
    const floorGroup = new THREE.Group();
    floorGroup.position.y = fi * floorHeight;

    const isLobby = fi === 0;
    addBox(floorGroup, [0, 0, 0], [W, 0.18, D], isLobby ? lobbyFloorMat : carpetMat);

    addGlassWall(floorGroup, [0, floorHeight / 2, D / 2], null, W, floorHeight);
    addGlassWall(floorGroup, [0, floorHeight / 2, -D / 2], [0, Math.PI, 0], W, floorHeight);
    addGlassWall(floorGroup, [-W / 2, floorHeight / 2, 0], [0, Math.PI / 2, 0], D, floorHeight);
    addGlassWall(floorGroup, [W / 2, floorHeight / 2, 0], [0, -Math.PI / 2, 0], D, floorHeight);

    addFloorBand(floorGroup, floorHeight);

    if (isLobby) {
      addLobbyInterior(floorGroup);
    } else {
      addOfficeFloorInterior(floorGroup, fi);
    }

    building.add(floorGroup);
  }

  addElevator(building, currentElevatorFloor);
  addRoof(building, totalH);

  addBox(building, [0, -0.15, 0], [W + 1.2, 0.3, D + 1.2], frameMat);
  addBox(building, [0, -0.3, 0], [W + 2, 0.15, D + 2], new THREE.MeshLambertMaterial({ color: 0xc8cdd4 }));

  addEntryCanopy(building);

  building.userData.buildingType = "corporate-tower";
  building.userData.floors = floors;
  building.userData.floorHeight = floorHeight;

  return building;
}

// ─── Animate Elevator ─────────────────────────────────────────────────────
export function animateCorporateTower(building: THREE.Group, targetFloor: number, delta: number): void {
  const elevator = building.children.find((c) => c.userData.cabin) as THREE.Group | undefined;
  if (!elevator) return;

  const cabin = elevator.userData.cabin as THREE.Group;
  const targetY = targetFloor * floorHeight + 0.1;
  cabin.position.y = THREE.MathUtils.lerp(cabin.position.y, targetY, delta * 2.5);
  elevator.userData.currentFloor = targetFloor;
}
