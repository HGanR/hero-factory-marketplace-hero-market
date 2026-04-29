/**
 * WorldElementSystem.ts
 * Adapted from office-building-3d — Renders DB-backed world elements
 * (trees, street lights, benches, road segments, crosswalks, bushes, fountains).
 */
import * as THREE from "three";

export type WorldElementType =
  | "tree"
  | "tree_cluster"
  | "bush"
  | "flower_bed"
  | "grass_patch"
  | "street_light"
  | "bench"
  | "trash_bin"
  | "bollard"
  | "road_segment"
  | "road_cross"
  | "road_arm"
  | "crosswalk"
  | "sidewalk_tile"
  | "curb_strip"
  | "fountain"
  | "plaza_pad"
  | "planter_box"
  | "steps"
  | "wall_segment"
  | "fence_segment"
  | "lake"
  | "pond"
  | "river_segment"
  | "roundabout"
  | "ground_patch"
  | "gravel_patch"
  | "glb_import";

export interface WorldElementData {
  id: number;
  type: WorldElementType;
  posX: number;
  posY: number;
  posZ: number;
  rotY: number;
  scale: number;
  colorHex?: number | null;
  color2Hex?: number | null;
  label?: string | null;
  isDefault: boolean;
}

const DEFAULTS = {
  treeTrunk: 0x5c3d1e,
  treeLeaf: 0x2d7a2d,
  lampPost: 0x888888,
  lampGlow: 0xfff5cc,
  benchWood: 0x8b6914,
  benchMetal: 0x555555,
  road: 0x2c2c2c,
  roadLine: 0xf5f5dc,
  bush: 0x2a6e2a,
  fountainBase: 0x8899aa,
  fountainWater: 0x44aacc,
};

const elementGroups = new Map<number, THREE.Group>();

export function renderWorldElements(scene: THREE.Scene, elements: WorldElementData[]): void {
  clearWorldElements(scene);
  for (const el of elements) {
    const group = buildElementGroup(el);
    if (group) {
      group.userData.elementId = el.id;
      group.userData.elementType = el.type;
      group.traverse((child) => {
        child.userData = { ...child.userData, elementId: el.id };
      });
      scene.add(group);
      elementGroups.set(el.id, group);
    }
  }
}

export function addElementToScene(scene: THREE.Scene, el: WorldElementData): THREE.Group | null {
  const group = buildElementGroup(el);
  if (!group) return null;
  group.userData.elementId = el.id;
  group.userData.elementType = el.type;
  group.traverse((child) => {
    child.userData = { ...child.userData, elementId: el.id };
  });
  scene.add(group);
  elementGroups.set(el.id, group);
  return group;
}

export function updateElementInScene(scene: THREE.Scene, el: WorldElementData): void {
  const existing = elementGroups.get(el.id);
  if (existing) {
    scene.remove(existing);
    elementGroups.delete(el.id);
  }
  addElementToScene(scene, el);
}

export function removeElementFromScene(scene: THREE.Scene, id: number): void {
  const group = elementGroups.get(id);
  if (group) {
    scene.remove(group);
    elementGroups.delete(id);
  }
}

export function clearWorldElements(scene: THREE.Scene): void {
  Array.from(elementGroups.values()).forEach((group) => scene.remove(group));
  elementGroups.clear();
}

export function getElementGroup(id: number): THREE.Group | undefined {
  return elementGroups.get(id);
}

export function getAllElementGroups(): Map<number, THREE.Group> {
  return elementGroups;
}

function buildElementGroup(el: WorldElementData): THREE.Group | null {
  const group = new THREE.Group();
  group.position.set(el.posX, el.posY, el.posZ);
  group.rotation.y = (el.rotY * Math.PI) / 180; // rotY stored in degrees
  group.scale.setScalar(el.scale);

  switch (el.type) {
    case "tree":
      buildTree(group, el);
      break;
    case "tree_cluster":
      buildTreeCluster(group, el);
      break;
    case "bush":
      buildBush(group, el);
      break;
    case "flower_bed":
      buildFlowerBed(group, el);
      break;
    case "grass_patch":
      buildGrassPatch(group, el);
      break;
    case "street_light":
      buildStreetLight(group, el);
      break;
    case "bench":
      buildBench(group, el);
      break;
    case "trash_bin":
      buildTrashBin(group, el);
      break;
    case "bollard":
      buildBollard(group, el);
      break;
    case "road_segment":
      buildRoadSegment(group, el);
      break;
    case "road_cross":
      buildRoadCross(group, el);
      break;
    case "road_arm":
      buildRoadArm(group, el);
      break;
    case "crosswalk":
      buildCrosswalk(group, el);
      break;
    case "sidewalk_tile":
      buildSidewalkTile(group, el);
      break;
    case "curb_strip":
      buildCurbStrip(group, el);
      break;
    case "fountain":
      buildFountain(group, el);
      break;
    case "plaza_pad":
      buildPlazaPad(group, el);
      break;
    case "planter_box":
      buildPlanterBox(group, el);
      break;
    case "steps":
      buildSteps(group, el);
      break;
    case "wall_segment":
      buildWallSegment(group, el);
      break;
    case "fence_segment":
      buildFenceSegment(group, el);
      break;
    case "lake":
      buildLake(group, el);
      break;
    case "pond":
      buildPond(group, el);
      break;
    case "river_segment":
      buildRiverSegment(group, el);
      break;
    case "roundabout":
      buildRoundabout(group, el);
      break;
    case "ground_patch":
      buildGroundPatch(group, el);
      break;
    case "gravel_patch":
      buildGravelPatch(group, el);
      break;
    case "glb_import":
      buildGlbPlaceholder(group, el);
      break;
    default:
      return null;
  }
  return group;
}

function buildTree(group: THREE.Group, el: WorldElementData): void {
  const trunkColor = el.color2Hex ?? DEFAULTS.treeTrunk;
  const leafColor = el.colorHex ?? DEFAULTS.treeLeaf;
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.22, 1.2, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: trunkColor });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 0.6;
  trunk.castShadow = true;
  group.add(trunk);
  const leafMat = new THREE.MeshLambertMaterial({ color: leafColor });
  [{ r: 1.4, h: 1.6, y: 1.8 }, { r: 1.1, h: 1.4, y: 2.8 }, { r: 0.7, h: 1.2, y: 3.6 }].forEach(({ r, h, y }) => {
    const geo = new THREE.ConeGeometry(r, h, 7);
    const mesh = new THREE.Mesh(geo, leafMat);
    mesh.position.y = y;
    mesh.castShadow = true;
    group.add(mesh);
  });
}

function buildStreetLight(group: THREE.Group, el: WorldElementData): void {
  const poleColor = el.colorHex ?? DEFAULTS.lampPost;
  const glowColor = el.color2Hex ?? DEFAULTS.lampGlow;
  const poleMat = new THREE.MeshLambertMaterial({ color: poleColor });
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 5, 6);
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 2.5;
  pole.castShadow = true;
  group.add(pole);
  const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 4);
  const arm = new THREE.Mesh(armGeo, poleMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(0.6, 5.1, 0);
  group.add(arm);
  const headGeo = new THREE.SphereGeometry(0.22, 8, 6);
  const headMat = new THREE.MeshBasicMaterial({ color: glowColor });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(1.2, 5.1, 0);
  group.add(head);
  const light = new THREE.PointLight(glowColor, 0.6, 12);
  light.position.set(1.2, 5.0, 0);
  group.add(light);
}

function buildBench(group: THREE.Group, el: WorldElementData): void {
  const woodColor = el.colorHex ?? DEFAULTS.benchWood;
  const metalColor = el.color2Hex ?? DEFAULTS.benchMetal;
  const woodMat = new THREE.MeshLambertMaterial({ color: woodColor });
  const metalMat = new THREE.MeshLambertMaterial({ color: metalColor });
  const seatGeo = new THREE.BoxGeometry(1.4, 0.08, 0.45);
  const seat = new THREE.Mesh(seatGeo, woodMat);
  seat.position.y = 0.45;
  group.add(seat);
  const backGeo = new THREE.BoxGeometry(1.4, 0.4, 0.06);
  const back = new THREE.Mesh(backGeo, woodMat);
  back.position.set(0, 0.7, 0.2);
  group.add(back);
  const legGeo = new THREE.BoxGeometry(0.06, 0.45, 0.45);
  [-0.6, 0.6].forEach((offset) => {
    const leg = new THREE.Mesh(legGeo, metalMat);
    leg.position.set(offset, 0.22, 0);
    group.add(leg);
  });
}

function buildRoadSegment(group: THREE.Group, el: WorldElementData): void {
  const roadColor = el.colorHex ?? DEFAULTS.road;
  const lineColor = el.color2Hex ?? DEFAULTS.roadLine;
  const roadGeo = new THREE.PlaneGeometry(20, 10);
  const roadMat = new THREE.MeshLambertMaterial({ color: roadColor });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  group.add(road);
  for (let i = -4; i <= 4; i++) {
    const dashGeo = new THREE.PlaneGeometry(1.5, 0.15);
    const dashMat = new THREE.MeshBasicMaterial({ color: lineColor });
    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(i * 2.5, 0.02, 0);
    group.add(dash);
  }
}

function buildCrosswalk(group: THREE.Group, el: WorldElementData): void {
  const stripeColor = el.colorHex ?? 0xeeeeee;
  const stripeMat = new THREE.MeshBasicMaterial({ color: stripeColor });
  for (let i = -2; i <= 2; i++) {
    const geo = new THREE.PlaneGeometry(0.5, 9);
    const mesh = new THREE.Mesh(geo, stripeMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(i * 0.8, 0.025, 0);
    group.add(mesh);
  }
}

function buildBush(group: THREE.Group, el: WorldElementData): void {
  const bushColor = el.colorHex ?? DEFAULTS.bush;
  const bushMat = new THREE.MeshLambertMaterial({ color: bushColor });
  [{ x: 0, y: 0.5, z: 0, r: 0.7 }, { x: 0.5, y: 0.4, z: 0.2, r: 0.55 }, { x: -0.4, y: 0.4, z: -0.1, r: 0.5 }].forEach(({ x, y, z, r }) => {
    const geo = new THREE.SphereGeometry(r, 7, 6);
    const mesh = new THREE.Mesh(geo, bushMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
  });
}

function buildFountain(group: THREE.Group, el: WorldElementData): void {
  const baseColor = el.colorHex ?? DEFAULTS.fountainBase;
  const waterColor = el.color2Hex ?? DEFAULTS.fountainWater;
  const baseMat = new THREE.MeshLambertMaterial({ color: baseColor });
  const waterMat = new THREE.MeshLambertMaterial({ color: waterColor, transparent: true, opacity: 0.8 });
  const basinGeo = new THREE.TorusGeometry(1.8, 0.25, 8, 24);
  const basin = new THREE.Mesh(basinGeo, baseMat);
  basin.rotation.x = Math.PI / 2;
  basin.position.y = 0.25;
  group.add(basin);
  const waterGeo = new THREE.CircleGeometry(1.6, 24);
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.3;
  group.add(water);
  const pillarGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.4, 8);
  const pillar = new THREE.Mesh(pillarGeo, baseMat);
  pillar.position.y = 0.7;
  group.add(pillar);
  const capGeo = new THREE.SphereGeometry(0.22, 8, 6);
  const cap = new THREE.Mesh(capGeo, baseMat);
  cap.position.y = 1.5;
  group.add(cap);
  const sprayMat = new THREE.MeshBasicMaterial({ color: waterColor, transparent: true, opacity: 0.5 });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const sprayGeo = new THREE.ConeGeometry(0.06, 0.5, 4);
    const spray = new THREE.Mesh(sprayGeo, sprayMat);
    spray.position.set(Math.cos(angle) * 0.3, 1.8, Math.sin(angle) * 0.3);
    spray.rotation.z = Math.PI / 6;
    spray.rotation.y = angle;
    group.add(spray);
  }
}

function buildTreeCluster(group: THREE.Group, el: WorldElementData): void {
  const offsets = [
    { x: 0, z: 0, s: 1.0 }, { x: 2.5, z: 1, s: 0.85 }, { x: -2, z: 1.5, s: 0.9 },
    { x: 1, z: -2, s: 0.8 }, { x: -1.5, z: -1.5, s: 0.75 },
  ];
  offsets.forEach(({ x, z, s }) => {
    const sub = new THREE.Group();
    sub.position.set(x, 0, z);
    sub.scale.setScalar(s);
    buildTree(sub, { ...el, colorHex: el.colorHex ?? DEFAULTS.treeLeaf, color2Hex: el.color2Hex ?? DEFAULTS.treeTrunk });
    group.add(sub);
  });
}

function buildFlowerBed(group: THREE.Group, el: WorldElementData): void {
  const soilMat = new THREE.MeshLambertMaterial({ color: 0x5c3d1e });
  const soilGeo = new THREE.BoxGeometry(2, 0.15, 1.2);
  const soil = new THREE.Mesh(soilGeo, soilMat);
  soil.position.y = 0.075;
  group.add(soil);
  const colors = [0xff4466, 0xff9900, 0xffee00, 0xcc44ff, 0xff6699];
  for (let i = 0; i < 8; i++) {
    const c = colors[i % colors.length];
    const mat = new THREE.MeshLambertMaterial({ color: c });
    const geo = new THREE.SphereGeometry(0.18, 5, 4);
    const flower = new THREE.Mesh(geo, mat);
    flower.position.set((Math.random() - 0.5) * 1.6, 0.3 + Math.random() * 0.15, (Math.random() - 0.5) * 0.8);
    group.add(flower);
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x2d7a2d });
    const stemGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.25, 4);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(flower.position.x, 0.17, flower.position.z);
    group.add(stem);
  }
}

function buildTrashBin(group: THREE.Group, el: WorldElementData): void {
  const col = el.colorHex ?? 0x336633;
  const mat = new THREE.MeshLambertMaterial({ color: col });
  const bodyGeo = new THREE.CylinderGeometry(0.22, 0.18, 0.7, 8);
  const body = new THREE.Mesh(bodyGeo, mat);
  body.position.y = 0.35;
  group.add(body);
  const lidMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const lidGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.06, 8);
  const lid = new THREE.Mesh(lidGeo, lidMat);
  lid.position.y = 0.73;
  group.add(lid);
}

function buildBollard(group: THREE.Group, el: WorldElementData): void {
  const col = el.colorHex ?? 0xffcc00;
  const mat = new THREE.MeshLambertMaterial({ color: col });
  const bodyGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.9, 8);
  const body = new THREE.Mesh(bodyGeo, mat);
  body.position.y = 0.45;
  group.add(body);
  const capMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const capGeo = new THREE.SphereGeometry(0.12, 6, 5);
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.y = 0.93;
  group.add(cap);
  const stripeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const stripeGeo = new THREE.CylinderGeometry(0.105, 0.105, 0.06, 8);
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.y = 0.55;
  group.add(stripe);
}

function buildRoadCross(group: THREE.Group, el: WorldElementData): void {
  const roadColor = el.colorHex ?? 0x2c2c2c;
  const lineColor = el.color2Hex ?? 0xf5f5dc;
  const mat = new THREE.MeshLambertMaterial({ color: roadColor });
  const hGeo = new THREE.PlaneGeometry(30, 10);
  const h = new THREE.Mesh(hGeo, mat);
  h.rotation.x = -Math.PI / 2;
  h.position.y = 0.01;
  group.add(h);
  const vGeo = new THREE.PlaneGeometry(10, 30);
  const v = new THREE.Mesh(vGeo, mat);
  v.rotation.x = -Math.PI / 2;
  v.position.y = 0.01;
  group.add(v);
  const lineMat = new THREE.MeshBasicMaterial({ color: lineColor });
  [-1, 1].forEach((side) => {
    [-12, -8, -4, 4, 8, 12].forEach((pos) => {
      const dGeo = new THREE.PlaneGeometry(1.5, 0.15);
      const d = new THREE.Mesh(dGeo, lineMat);
      d.rotation.x = -Math.PI / 2;
      d.position.set(pos, 0.02, side * 2.5);
      group.add(d);
    });
    [-12, -8, -4, 4, 8, 12].forEach((pos) => {
      const dGeo = new THREE.PlaneGeometry(0.15, 1.5);
      const d = new THREE.Mesh(dGeo, lineMat);
      d.rotation.x = -Math.PI / 2;
      d.position.set(side * 2.5, 0.02, pos);
      group.add(d);
    });
  });
}

function buildRoadArm(group: THREE.Group, el: WorldElementData): void {
  const roadColor = el.colorHex ?? 0x2c2c2c;
  const lineColor = el.color2Hex ?? 0xf5f5dc;
  const mat = new THREE.MeshLambertMaterial({ color: roadColor });
  const geo = new THREE.PlaneGeometry(10, 50);
  const road = new THREE.Mesh(geo, mat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  group.add(road);
  const lineMat = new THREE.MeshBasicMaterial({ color: lineColor });
  for (let i = -10; i <= 10; i++) {
    const dGeo = new THREE.PlaneGeometry(0.15, 1.5);
    const d = new THREE.Mesh(dGeo, lineMat);
    d.rotation.x = -Math.PI / 2;
    d.position.set(0, 0.02, i * 2.5);
    group.add(d);
  }
  const swMat = new THREE.MeshLambertMaterial({ color: 0xc8b89a });
  [-5.5, 5.5].forEach((sx) => {
    const swGeo = new THREE.PlaneGeometry(1, 50);
    const sw = new THREE.Mesh(swGeo, swMat);
    sw.rotation.x = -Math.PI / 2;
    sw.position.set(sx, 0.015, 0);
    group.add(sw);
  });
}

function buildSidewalkTile(group: THREE.Group, el: WorldElementData): void {
  const col = el.colorHex ?? 0xc8b89a;
  const mat = new THREE.MeshLambertMaterial({ color: col });
  const geo = new THREE.BoxGeometry(4, 0.12, 4);
  const tile = new THREE.Mesh(geo, mat);
  tile.position.y = 0.06;
  group.add(tile);
  const groutMat = new THREE.MeshBasicMaterial({ color: 0x999988 });
  [-1, 1].forEach((d) => {
    const hGeo = new THREE.PlaneGeometry(4, 0.04);
    const h = new THREE.Mesh(hGeo, groutMat);
    h.rotation.x = -Math.PI / 2;
    h.position.set(0, 0.13, d);
    group.add(h);
    const vGeo = new THREE.PlaneGeometry(0.04, 4);
    const v = new THREE.Mesh(vGeo, groutMat);
    v.rotation.x = -Math.PI / 2;
    v.position.set(d, 0.13, 0);
    group.add(v);
  });
}

function buildCurbStrip(group: THREE.Group, el: WorldElementData): void {
  const col = el.colorHex ?? 0xaaaaaa;
  const mat = new THREE.MeshLambertMaterial({ color: col });
  const geo = new THREE.BoxGeometry(10, 0.18, 0.4);
  const curb = new THREE.Mesh(geo, mat);
  curb.position.y = 0.09;
  group.add(curb);
}

function buildPlazaPad(group: THREE.Group, el: WorldElementData): void {
  const col = el.colorHex ?? 0xb0a090;
  const mat = new THREE.MeshLambertMaterial({ color: col });
  const geo = new THREE.BoxGeometry(60, 0.3, 50);
  const slab = new THREE.Mesh(geo, mat);
  slab.position.y = 0.15;
  group.add(slab);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x888878 });
  for (let x = -28; x <= 28; x += 4) {
    const lGeo = new THREE.PlaneGeometry(0.08, 50);
    const l = new THREE.Mesh(lGeo, lineMat);
    l.rotation.x = -Math.PI / 2;
    l.position.set(x, 0.31, 0);
    group.add(l);
  }
  for (let z = -24; z <= 24; z += 4) {
    const lGeo = new THREE.PlaneGeometry(60, 0.08);
    const l = new THREE.Mesh(lGeo, lineMat);
    l.rotation.x = -Math.PI / 2;
    l.position.set(0, 0.31, z);
    group.add(l);
  }
}

function buildPlanterBox(group: THREE.Group, el: WorldElementData): void {
  const boxCol = el.colorHex ?? 0x888878;
  const boxMat = new THREE.MeshLambertMaterial({ color: boxCol });
  const soilMat = new THREE.MeshLambertMaterial({ color: 0x5c3d1e });
  const boxGeo = new THREE.BoxGeometry(1.4, 0.6, 0.7);
  const box = new THREE.Mesh(boxGeo, boxMat);
  box.position.y = 0.3;
  group.add(box);
  const soilGeo = new THREE.BoxGeometry(1.2, 0.1, 0.5);
  const soil = new THREE.Mesh(soilGeo, soilMat);
  soil.position.y = 0.55;
  group.add(soil);
  const plantMat = new THREE.MeshLambertMaterial({ color: 0x2d7a2d });
  const plantGeo = new THREE.SphereGeometry(0.28, 6, 5);
  const plant = new THREE.Mesh(plantGeo, plantMat);
  plant.position.y = 0.85;
  group.add(plant);
}

function buildSteps(group: THREE.Group, el: WorldElementData): void {
  const col = el.colorHex ?? 0xccbbaa;
  const mat = new THREE.MeshLambertMaterial({ color: col });
  for (let i = 0; i < 4; i++) {
    const w = 8 - i * 0.5;
    const geo = new THREE.BoxGeometry(w, 0.18, 0.8);
    const step = new THREE.Mesh(geo, mat);
    step.position.set(0, i * 0.18, -i * 0.8);
    group.add(step);
  }
}

function buildWallSegment(group: THREE.Group, el: WorldElementData): void {
  const col = el.colorHex ?? 0xccbbaa;
  const mat = new THREE.MeshLambertMaterial({ color: col });
  const geo = new THREE.BoxGeometry(6, 1.8, 0.3);
  const wall = new THREE.Mesh(geo, mat);
  wall.position.y = 0.9;
  group.add(wall);
}

function buildFenceSegment(group: THREE.Group, el: WorldElementData): void {
  const col = el.colorHex ?? 0x888888;
  const mat = new THREE.MeshLambertMaterial({ color: col });
  [-0.5, 0.5].forEach((y) => {
    const railGeo = new THREE.BoxGeometry(6, 0.06, 0.06);
    const rail = new THREE.Mesh(railGeo, mat);
    rail.position.set(0, 0.8 + y * 0.6, 0);
    group.add(rail);
  });
  for (let x = -2.5; x <= 2.5; x += 1.25) {
    const postGeo = new THREE.BoxGeometry(0.06, 1.2, 0.06);
    const post = new THREE.Mesh(postGeo, mat);
    post.position.set(x, 0.6, 0);
    group.add(post);
  }
}

function buildLake(group: THREE.Group, el: WorldElementData): void {
  const shoreCol = el.color2Hex ?? 0x8a9a6a;
  const deepCol = el.colorHex ?? 0x1a4a66;
  const shoreMat = new THREE.MeshLambertMaterial({ color: shoreCol });
  const shallowMat = new THREE.MeshLambertMaterial({ color: 0x5599bb, transparent: true, opacity: 0.85 });
  const deepMat = new THREE.MeshLambertMaterial({ color: deepCol, transparent: true, opacity: 0.9 });
  const shoreGeo = new THREE.CircleGeometry(18, 24);
  const shore = new THREE.Mesh(shoreGeo, shoreMat);
  shore.rotation.x = -Math.PI / 2;
  shore.scale.set(1, 0.78, 1);
  shore.position.y = 0.02;
  group.add(shore);
  const shallowGeo = new THREE.CircleGeometry(16, 24);
  const shallow = new THREE.Mesh(shallowGeo, shallowMat);
  shallow.rotation.x = -Math.PI / 2;
  shallow.scale.set(1, 0.75, 1);
  shallow.position.y = 0.04;
  group.add(shallow);
  const deepGeo = new THREE.CircleGeometry(12, 24);
  const deep = new THREE.Mesh(deepGeo, deepMat);
  deep.rotation.x = -Math.PI / 2;
  deep.scale.set(1, 0.75, 1);
  deep.position.y = 0.06;
  group.add(deep);
}

function buildPond(group: THREE.Group, el: WorldElementData): void {
  const shoreCol = el.color2Hex ?? 0x8a9a6a;
  const waterCol = el.colorHex ?? 0x2266aa;
  const shoreMat = new THREE.MeshLambertMaterial({ color: shoreCol });
  const waterMat = new THREE.MeshLambertMaterial({ color: waterCol, transparent: true, opacity: 0.88 });
  const shoreGeo = new THREE.CircleGeometry(8, 20);
  const shore = new THREE.Mesh(shoreGeo, shoreMat);
  shore.rotation.x = -Math.PI / 2;
  shore.position.y = 0.02;
  group.add(shore);
  const waterGeo = new THREE.CircleGeometry(6.5, 20);
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.04;
  group.add(water);
}

function buildRiverSegment(group: THREE.Group, el: WorldElementData): void {
  const bankCol = el.color2Hex ?? 0x8a9a6a;
  const waterCol = el.colorHex ?? 0x2266aa;
  const bankMat = new THREE.MeshLambertMaterial({ color: bankCol });
  const waterMat = new THREE.MeshLambertMaterial({ color: waterCol, transparent: true, opacity: 0.88 });
  const bankGeo = new THREE.PlaneGeometry(8, 30);
  const bank = new THREE.Mesh(bankGeo, bankMat);
  bank.rotation.x = -Math.PI / 2;
  bank.position.y = 0.01;
  group.add(bank);
  const waterGeo = new THREE.PlaneGeometry(5, 30);
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.02;
  group.add(water);
}

function buildRoundabout(group: THREE.Group, el: WorldElementData): void {
  const roadCol = el.colorHex ?? 0x2c2c2c;
  const kerbCol = el.color2Hex ?? 0xaaaaaa;
  const roadMat = new THREE.MeshLambertMaterial({ color: roadCol });
  const kerbMat = new THREE.MeshLambertMaterial({ color: kerbCol });
  const grassMat = new THREE.MeshLambertMaterial({ color: 0x4a7c3f });
  const roadGeo = new THREE.RingGeometry(8, 14, 32);
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.01;
  group.add(road);
  const outerKerbGeo = new THREE.TorusGeometry(14, 0.25, 6, 32);
  const outerKerb = new THREE.Mesh(outerKerbGeo, kerbMat);
  outerKerb.rotation.x = Math.PI / 2;
  outerKerb.position.y = 0.15;
  group.add(outerKerb);
  const innerKerbGeo = new THREE.TorusGeometry(8, 0.25, 6, 32);
  const innerKerb = new THREE.Mesh(innerKerbGeo, kerbMat);
  innerKerb.rotation.x = Math.PI / 2;
  innerKerb.position.y = 0.15;
  group.add(innerKerb);
  const islandGeo = new THREE.CircleGeometry(7.5, 32);
  const island = new THREE.Mesh(islandGeo, grassMat);
  island.rotation.x = -Math.PI / 2;
  island.position.y = 0.05;
  group.add(island);
  const flowerMat = new THREE.MeshLambertMaterial({ color: 0xff6699 });
  const flowerGeo = new THREE.CircleGeometry(2.5, 16);
  const flowers = new THREE.Mesh(flowerGeo, flowerMat);
  flowers.rotation.x = -Math.PI / 2;
  flowers.position.y = 0.06;
  group.add(flowers);
  const baseMat = new THREE.MeshLambertMaterial({ color: 0xccbbaa });
  const baseGeo = new THREE.CylinderGeometry(1.2, 1.5, 0.5, 8);
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.25;
  group.add(base);
  const shaftGeo = new THREE.CylinderGeometry(0.3, 0.5, 3.5, 8);
  const shaft = new THREE.Mesh(shaftGeo, baseMat);
  shaft.position.y = 2.25;
  group.add(shaft);
  const tipGeo = new THREE.ConeGeometry(0.35, 1.2, 8);
  const tip = new THREE.Mesh(tipGeo, baseMat);
  tip.position.y = 4.6;
  group.add(tip);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf5f5dc });
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const r = 11;
    const dGeo = new THREE.PlaneGeometry(0.15, 1.2);
    const d = new THREE.Mesh(dGeo, lineMat);
    d.rotation.x = -Math.PI / 2;
    d.rotation.z = angle;
    d.position.set(Math.cos(angle) * r, 0.02, Math.sin(angle) * r);
    group.add(d);
  }
}

function buildGroundPatch(group: THREE.Group, el: WorldElementData): void {
  const col = el.colorHex ?? 0x8a7a6a;
  const mat = new THREE.MeshLambertMaterial({ color: col });
  const geo = new THREE.PlaneGeometry(20, 20);
  const patch = new THREE.Mesh(geo, mat);
  patch.rotation.x = -Math.PI / 2;
  patch.position.y = 0.005;
  group.add(patch);
}

function buildGrassPatch(group: THREE.Group, el: WorldElementData): void {
  const col = el.colorHex ?? 0x4a7c3f;
  const mat = new THREE.MeshLambertMaterial({ color: col });
  const geo = new THREE.PlaneGeometry(20, 20);
  const patch = new THREE.Mesh(geo, mat);
  patch.rotation.x = -Math.PI / 2;
  patch.position.y = 0.005;
  group.add(patch);
}

function buildGravelPatch(group: THREE.Group, el: WorldElementData): void {
  const col = el.colorHex ?? 0xb0a090;
  const mat = new THREE.MeshLambertMaterial({ color: col });
  const geo = new THREE.PlaneGeometry(20, 20);
  const patch = new THREE.Mesh(geo, mat);
  patch.rotation.x = -Math.PI / 2;
  patch.position.y = 0.005;
  group.add(patch);
}

function buildGlbPlaceholder(group: THREE.Group, _el: WorldElementData): void {
  const mat = new THREE.MeshLambertMaterial({ color: 0x4488ff, transparent: true, opacity: 0.5, wireframe: true });
  const geo = new THREE.BoxGeometry(4, 4, 4);
  const box = new THREE.Mesh(geo, mat);
  box.position.y = 2;
  group.add(box);
}

export function animateWorldElements(elapsed: number): void {
  Array.from(elementGroups.values()).forEach((group) => {
    if (group.userData.elementType === "fountain") {
      const water = group.children[1] as THREE.Mesh;
      if (water) {
        const s = 1 + 0.03 * Math.sin(elapsed * 1.5);
        water.scale.set(s, s, 1);
      }
    }
  });
}
