/**
 * ApexBuildingScene.ts
 * 7-floor Apex Tower interior. Ported from home/ubuntu/office-building-3d.
 * Amber/gold palette, marble floors, elevator, lobby, luxury suite on floor 6.
 */
import * as THREE from "three";

export const APEX_BUILDING = {
  width: 22,
  depth: 14,
  floors: 7,
  floorHeight: 3.8,
};
export const APEX_FLOOR_HEIGHT = APEX_BUILDING.floorHeight;
export const APEX_NUM_FLOORS = APEX_BUILDING.floors;

export const APEX_INTERIOR = { width: APEX_BUILDING.width, depth: APEX_BUILDING.depth, x: 0, z: 0 };

export const APEX_ELEVATOR = {
  x: APEX_INTERIOR.x + APEX_INTERIOR.width / 2 - 2.2,
  z: APEX_INTERIOR.z,
  width: 2.0,
  depth: 2.0,
};

export interface ApexElevatorState {
  currentFloor: number;
  targetFloor: number;
  cabY: number;
  doorOpenAmount: number;
  isMoving: boolean;
  doorState: "open" | "closed" | "opening" | "closing";
  doorTimer: number;
}

function box(w: number, h: number, d: number, color: number, opacity = 1, transparent = false): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshLambertMaterial({ color, opacity, transparent });
  return new THREE.Mesh(geo, mat);
}

function cylinder(r: number, h: number, color: number, segs = 12): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r, r, h, segs);
  const mat = new THREE.MeshLambertMaterial({ color });
  return new THREE.Mesh(geo, mat);
}

function addAt<T extends THREE.Object3D>(parent: THREE.Object3D, obj: T, x: number, y: number, z: number): void {
  obj.position.set(x, y, z);
  parent.add(obj);
}

export function getApexFloorY(floor: number): number {
  return floor * APEX_FLOOR_HEIGHT;
}

const ELEV_SPEED = 3.5;
const DOOR_SPEED = 1.8;
const DOOR_HOLD = 1.8;

export function updateApexElevator(
  state: ApexElevatorState,
  cab: THREE.Group,
  doorL: THREE.Mesh,
  doorR: THREE.Mesh,
  dt: number
): void {
  const targetY = state.targetFloor * APEX_FLOOR_HEIGHT;

  if (state.isMoving) {
    if (state.doorState === "open" || state.doorState === "opening") state.doorState = "closing";
    if (state.doorState === "closing") {
      state.doorOpenAmount = Math.max(0, state.doorOpenAmount - DOOR_SPEED * dt);
      if (state.doorOpenAmount <= 0) state.doorState = "closed";
    }
    if (state.doorState === "closed") {
      const diff = targetY - state.cabY;
      if (Math.abs(diff) < 0.05) {
        state.cabY = targetY;
        state.currentFloor = state.targetFloor;
        state.isMoving = false;
        state.doorState = "opening";
      } else {
        state.cabY += Math.sign(diff) * Math.min(ELEV_SPEED * dt, Math.abs(diff));
      }
    }
  } else {
    if (state.doorState === "opening") {
      state.doorOpenAmount = Math.min(1, state.doorOpenAmount + DOOR_SPEED * dt);
      if (state.doorOpenAmount >= 1) {
        state.doorState = "open";
        state.doorTimer = 0;
      }
    } else if (state.doorState === "open") {
      state.doorTimer += dt;
      if (state.doorTimer >= DOOR_HOLD) state.doorState = "closing";
    } else if (state.doorState === "closing") {
      state.doorOpenAmount = Math.max(0, state.doorOpenAmount - DOOR_SPEED * dt);
      if (state.doorOpenAmount <= 0) state.doorState = "closed";
    }
  }

  cab.position.y = state.cabY;
  const slide = state.doorOpenAmount * 0.85;
  doorL.position.x = -slide;
  doorR.position.x = slide;
}

function buildStandardFloor(scene: THREE.Scene, floorIndex: number): void {
  const y = getApexFloorY(floorIndex);
  const fw = APEX_INTERIOR.width;
  const fd = APEX_INTERIOR.depth;
  const fh = APEX_FLOOR_HEIGHT;
  const cx = APEX_INTERIOR.x;
  const cz = APEX_INTERIOR.z;

  const floorColor = floorIndex % 2 === 0 ? 0xd4b483 : 0xc8a870;
  const slab = box(fw, 0.12, fd, floorColor);
  slab.position.set(cx, y + 0.06, cz);
  slab.receiveShadow = true;
  scene.add(slab);

  const ceil = box(fw, 0.1, fd, 0x2a1a08);
  ceil.position.set(cx, y + fh - 0.05, cz);
  scene.add(ceil);

  const wallMat = new THREE.MeshLambertMaterial({ color: 0x1c0e04 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.18), wallMat);
  backWall.position.set(cx, y + fh / 2, cz - fd / 2);
  scene.add(backWall);
  const frontWallL = new THREE.Mesh(new THREE.BoxGeometry(fw / 2 - 2, fh, 0.18), wallMat);
  frontWallL.position.set(cx - fw / 4 - 1, y + fh / 2, cz + fd / 2);
  scene.add(frontWallL);
  const frontWallR = new THREE.Mesh(new THREE.BoxGeometry(fw / 2 - 2, fh, 0.18), wallMat);
  frontWallR.position.set(cx + fw / 4 + 1, y + fh / 2, cz + fd / 2);
  scene.add(frontWallR);
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, fh, fd), wallMat);
  leftWall.position.set(cx - fw / 2, y + fh / 2, cz);
  scene.add(leftWall);
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, fh, fd - 3.5), wallMat);
  rightWall.position.set(cx + fw / 2, y + fh / 2, cz - 1.5);
  scene.add(rightWall);

  const winMat = new THREE.MeshLambertMaterial({ color: 0x3a2800, transparent: true, opacity: 0.55 });
  for (let i = -1; i <= 1; i += 2) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(2.8, fh * 0.55, 0.06), winMat);
    win.position.set(cx + i * 3.5, y + fh * 0.55, cz + fd / 2 - 0.05);
    scene.add(win);
  }
  for (let i = -2; i <= 2; i++) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(2.4, fh * 0.5, 0.06), winMat);
    win.position.set(cx + i * 3.8, y + fh * 0.55, cz - fd / 2 + 0.05);
    scene.add(win);
  }

  const trimMat = new THREE.MeshLambertMaterial({ color: 0xb8860b });
  const trimF = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.08, 0.08), trimMat);
  trimF.position.set(cx, y + 0.04, cz + fd / 2 - 0.1);
  scene.add(trimF);
  const trimB = trimF.clone();
  trimB.position.set(cx, y + 0.04, cz - fd / 2 + 0.1);
  scene.add(trimB);

  const lightStrip = box(fw * 0.7, 0.06, 0.3, 0xfff0c0);
  lightStrip.position.set(cx, y + fh - 0.12, cz);
  scene.add(lightStrip);

  addAt(scene, new THREE.PointLight(0xffd080, 1.2, 12), cx, y + fh - 0.4, cz);

  addStandardFurnishings(scene, floorIndex, y, cx, cz, fw, fd);
}

function addStandardFurnishings(
  scene: THREE.Scene,
  floorIndex: number,
  y: number,
  cx: number,
  cz: number,
  fw: number,
  fd: number
): void {
  const stations = [
    { x: cx - 5, z: cz - 2 },
    { x: cx + 2, z: cz - 2 },
  ];
  for (const st of stations) {
    addAt(scene, box(2.4, 0.08, 1.1, 0x5c3317), st.x, y + 0.85, st.z);
    for (const [dx, dz] of [[-1, -0.4], [1, -0.4], [-1, 0.4], [1, 0.4]]) {
      addAt(scene, box(0.06, 0.85, 0.06, 0x3a1f00), st.x + dx, y + 0.42, st.z + dz);
    }
    addAt(scene, box(1.2, 0.7, 0.05, 0x0a1a2e), st.x, y + 1.55, st.z - 0.3);
    addAt(scene, box(1.1, 0.6, 0.02, 0x1a3a6e), st.x, y + 1.55, st.z - 0.27);
    addAt(scene, box(0.3, 0.04, 0.2, 0x2a1500), st.x, y + 0.91, st.z - 0.3);
    addAt(scene, box(0.7, 0.08, 0.7, 0x1a0a00), st.x, y + 0.55, st.z + 0.5);
    addAt(scene, box(0.7, 0.6, 0.06, 0x1a0a00), st.x, y + 0.9, st.z + 0.82);
  }

  if (floorIndex >= 1 && floorIndex <= 5) {
    addAt(scene, box(3.5, 0.08, 1.6, 0x6b3a1f), cx, y + 0.82, cz + 2.5);
    const tableLeg = cylinder(0.06, 0.82, 0x3a1f00);
    for (const [dx, dz] of [[-1.5, -0.6], [1.5, -0.6], [-1.5, 0.6], [1.5, 0.6]]) {
      const l = tableLeg.clone();
      l.position.set(cx + dx, y + 0.41, cz + 2.5 + dz);
      scene.add(l);
    }
  }

  addAt(scene, cylinder(0.2, 0.35, 0x8b4513), cx - fw / 2 + 1.5, y + 0.18, cz + fd / 2 - 1.5);
  addAt(scene, cylinder(0.35, 0.6, 0x2d5a1b), cx - fw / 2 + 1.5, y + 0.55, cz + fd / 2 - 1.5);
}

function buildLuxurySuite(scene: THREE.Scene): void {
  const floorIndex = 6;
  const y = getApexFloorY(floorIndex);
  const fh = APEX_FLOOR_HEIGHT;
  const fw = APEX_INTERIOR.width;
  const fd = APEX_INTERIOR.depth;
  const cx = APEX_INTERIOR.x;
  const cz = APEX_INTERIOR.z;

  const marbleSlab = box(fw, 0.14, fd, 0xf5f0e8);
  marbleSlab.position.set(cx, y + 0.07, cz);
  marbleSlab.receiveShadow = true;
  scene.add(marbleSlab);

  const tileMat = new THREE.MeshLambertMaterial({ color: 0xe8e0d0 });
  for (let xi = -4; xi <= 4; xi++) {
    for (let zi = -2; zi <= 2; zi++) {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.02, 2.1), tileMat);
      tile.position.set(cx + xi * 2.2, y + 0.15, cz + zi * 2.2);
      scene.add(tile);
    }
  }

  addAt(scene, box(fw, 0.12, fd, 0x2a1a08), cx, y + fh - 0.06, cz);
  const beamMat = new THREE.MeshLambertMaterial({ color: 0xb8860b });
  for (let i = -3; i <= 3; i++) {
    addAt(scene, new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, fd - 0.5), beamMat), cx + i * 3, y + fh - 0.2, cz);
  }
  for (let i = -2; i <= 2; i++) {
    addAt(scene, new THREE.Mesh(new THREE.BoxGeometry(fw - 0.5, 0.12, 0.12), beamMat), cx, y + fh - 0.2, cz + i * 2.5);
  }

  const glassMat = new THREE.MeshLambertMaterial({ color: 0x4a6080, transparent: true, opacity: 0.35 });
  const frameMat = new THREE.MeshLambertMaterial({ color: 0xb8860b });
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x1c0e04 });
  addAt(scene, new THREE.Mesh(new THREE.BoxGeometry(0.18, fh, fd), wallMat), cx - fw / 2, y + fh / 2, cz);
  addAt(scene, new THREE.Mesh(new THREE.BoxGeometry(0.18, fh, fd - 3.5), wallMat), cx + fw / 2, y + fh / 2, cz - 1.5);

  addAt(scene, box(7.0, 0.1, 2.8, 0x3a1a00), cx - 1, y + 0.88, cz - 0.5);
  addAt(scene, box(6.8, 0.02, 2.6, 0x5c2800), cx - 1, y + 0.94, cz - 0.5);
  for (const [dx, dz] of [[-2.5, -0.9], [2.5, -0.9], [-2.5, 0.9], [2.5, 0.9]]) {
    addAt(scene, cylinder(0.08, 0.88, 0xb8860b), cx - 1 + dx, y + 0.44, cz - 0.5 + dz);
  }

  const execChairColor = 0x0a0500;
  const chairPositions = [
    { x: cx - 3.5, z: cz + 1.0, ry: 0 }, { x: cx - 1.5, z: cz + 1.0, ry: 0 },
    { x: cx + 0.5, z: cz + 1.0, ry: 0 }, { x: cx + 2.5, z: cz + 1.0, ry: 0 },
    { x: cx - 3.5, z: cz - 2.0, ry: Math.PI }, { x: cx - 1.5, z: cz - 2.0, ry: Math.PI },
    { x: cx + 0.5, z: cz - 2.0, ry: Math.PI }, { x: cx + 2.5, z: cz - 2.0, ry: Math.PI },
  ];
  for (const cp of chairPositions) {
    addAt(scene, box(0.65, 0.1, 0.65, execChairColor), cp.x, y + 0.55, cp.z);
    addAt(scene, box(0.65, 0.85, 0.07, execChairColor), cp.x, y + 1.0, cp.z + (cp.ry === 0 ? 0.3 : -0.3));
    addAt(scene, cylinder(0.22, 0.06, 0xb8860b), cp.x, y + 0.03, cp.z);
  }

  addAt(scene, new THREE.PointLight(0xfff0c0, 2.5, 20), cx - 1, y + fh - 0.6, cz - 0.5);
}

function buildApexElevator(scene: THREE.Scene): {
  cab: THREE.Group;
  doorL: THREE.Mesh;
  doorR: THREE.Mesh;
} {
  const ex = APEX_ELEVATOR.x;
  const ez = APEX_ELEVATOR.z;
  const ew = APEX_ELEVATOR.width;
  const ed = APEX_ELEVATOR.depth;
  const totalH = APEX_NUM_FLOORS * APEX_FLOOR_HEIGHT + 0.5;

  const shaftMat = new THREE.MeshLambertMaterial({ color: 0x1a1a2e, transparent: true, opacity: 0.4 });
  addAt(scene, new THREE.Mesh(new THREE.BoxGeometry(ew, totalH, 0.08), shaftMat), ex, totalH / 2, ez - ed / 2);
  addAt(scene, new THREE.Mesh(new THREE.BoxGeometry(0.08, totalH, ed), shaftMat), ex - ew / 2, totalH / 2, ez);
  addAt(scene, new THREE.Mesh(new THREE.BoxGeometry(0.08, totalH, ed), shaftMat), ex + ew / 2, totalH / 2, ez);

  const cab = new THREE.Group();
  cab.position.set(ex, 0, ez);

  addAt(cab, box(ew - 0.1, 0.1, ed - 0.1, 0xdaa520), 0, 0.05, 0);
  addAt(cab, box(ew - 0.1, 0.08, ed - 0.1, 0xb8860b), 0, APEX_FLOOR_HEIGHT - 0.04, 0);

  const cabWallMat = new THREE.MeshLambertMaterial({ color: 0x2a1a00, transparent: true, opacity: 0.85 });
  addAt(cab, new THREE.Mesh(new THREE.BoxGeometry(ew - 0.1, APEX_FLOOR_HEIGHT - 0.18, 0.07), cabWallMat), 0, APEX_FLOOR_HEIGHT / 2, -ed / 2 + 0.08);
  addAt(cab, new THREE.Mesh(new THREE.BoxGeometry(0.07, APEX_FLOOR_HEIGHT - 0.18, ed - 0.1), cabWallMat), -ew / 2 + 0.08, APEX_FLOOR_HEIGHT / 2, 0);
  addAt(cab, new THREE.Mesh(new THREE.BoxGeometry(0.07, APEX_FLOOR_HEIGHT - 0.18, ed - 0.1), cabWallMat), ew / 2 - 0.08, APEX_FLOOR_HEIGHT / 2, 0);

  addAt(cab, new THREE.PointLight(0xfff0c0, 1.5, 4), 0, APEX_FLOOR_HEIGHT - 0.3, 0);

  const doorW = (ew - 0.1) / 2 - 0.02;
  const doorH = APEX_FLOOR_HEIGHT - 0.18;
  const doorMat = new THREE.MeshLambertMaterial({ color: 0xb8860b });
  const doorL = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.07), doorMat);
  doorL.position.set(-doorW / 2 - 0.01, APEX_FLOOR_HEIGHT / 2, ed / 2 - 0.04);
  cab.add(doorL);
  const doorR = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.07), doorMat);
  doorR.position.set(doorW / 2 + 0.01, APEX_FLOOR_HEIGHT / 2, ed / 2 - 0.04);
  cab.add(doorR);

  scene.add(cab);
  return { cab, doorL, doorR };
}

function buildLobby(scene: THREE.Scene): void {
  const y = 0;
  const fh = APEX_FLOOR_HEIGHT;
  const cx = APEX_INTERIOR.x;
  const cz = APEX_INTERIOR.z;

  addAt(scene, box(4.5, 1.05, 1.2, 0x8b6914), cx - 3, y + 0.52, cz - 1.5);
  addAt(scene, box(4.7, 0.08, 1.4, 0xdaa520), cx - 3, y + 1.06, cz - 1.5);

  addAt(scene, box(5.0, 0.8, 0.1, 0xb8860b), cx, y + 2.2, cz - APEX_INTERIOR.depth / 2 + 0.12);

  for (const px of [-2.5, 2.5]) {
    addAt(scene, cylinder(0.25, fh, 0xdaa520, 16), cx + px, y + fh / 2, cz + APEX_INTERIOR.depth / 2 - 0.5);
    addAt(scene, cylinder(0.35, 0.15, 0xb8860b, 16), cx + px, y + fh - 0.08, cz + APEX_INTERIOR.depth / 2 - 0.5);
  }

  addAt(scene, box(3.5, 0.04, 1.5, 0x8b0000), cx, y + 0.02, cz + APEX_INTERIOR.depth / 2 - 1.2);

  addAt(scene, box(1.8, 0.45, 0.6, 0x2a1500), cx + 6, y + 0.22, cz + 3);
  addAt(scene, box(1.8, 0.45, 0.6, 0x2a1500), cx + 6, y + 0.22, cz + 4.5);

  addAt(scene, new THREE.PointLight(0xffd080, 2.0, 18), cx, y + fh - 0.5, cz);
}

export function buildApexScene(scene: THREE.Scene): {
  cab: THREE.Group;
  doorL: THREE.Mesh;
  doorR: THREE.Mesh;
} {
  for (let f = 0; f < APEX_NUM_FLOORS; f++) {
    if (f === 6) buildLuxurySuite(scene);
    else buildStandardFloor(scene, f);
  }
  buildLobby(scene);
  const { cab, doorL, doorR } = buildApexElevator(scene);
  addAt(scene, box(APEX_INTERIOR.width + 4, 0.2, APEX_INTERIOR.depth + 4, 0x1a0f00), APEX_INTERIOR.x, -0.1, APEX_INTERIOR.z);
  return { cab, doorL, doorR };
}
