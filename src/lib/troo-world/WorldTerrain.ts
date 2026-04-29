/**
 * WorldTerrain.ts
 * Adapted from office-building-3d Meridian Campus — green grass, roads,
 * sidewalks, building pads, trees, street lights, benches, lake.
 */
import * as THREE from "three";

// ─── Palette (Meridian Campus daytime) ─────────────────────────────────────────
const C = {
  grass: 0x4a7c3f,
  grassDark: 0x3a6230,
  road: 0x2c2c2c,
  roadLine: 0xf5f5dc,
  sidewalk: 0xd4c9b0,
  sidewalkEdge: 0xb8a990,
  lakeDeep: 0x1a6b8a,
  lakeShallow: 0x2d9cbe,
  lakeShore: 0xc8b97a,
  treeTrunk: 0x5c3d1e,
  treeLeaf: 0x2d7a2d,
  treeLeaf2: 0x3a9e3a,
  lampPost: 0x888888,
  lampGlow: 0xfff5cc,
  benchWood: 0x8b6914,
  benchMetal: 0x555555,
  curb: 0xaaaaaa,
  building_pad: 0xccbbaa,
};

// Nexus at -35, Meridian at 35
const NEXUS_X = -35;
const MERIDIAN_X = 35;

/** When true, skip trees, street lights, benches (use DB elements instead) */
export function buildTerrain(scene: THREE.Scene, options?: { skipScenery?: boolean }): void {
  const skipScenery = options?.skipScenery ?? false;
  // ── Ground plane ────────────────────────────────────────────────────────────
  const groundGeo = new THREE.PlaneGeometry(200, 140, 40, 40);
  const groundMat = new THREE.MeshLambertMaterial({ color: C.grass });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  for (let i = 0; i < 8; i++) {
    const patchGeo = new THREE.CircleGeometry(4 + Math.random() * 6, 8);
    const patchMat = new THREE.MeshLambertMaterial({ color: C.grassDark });
    const patch = new THREE.Mesh(patchGeo, patchMat);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set((Math.random() - 0.5) * 120, 0.01, (Math.random() - 0.5) * 120);
    scene.add(patch);
  }

  // ── Main road (E-W through centre, N-S cross) ───────────────────────────────
  addRoadSegment(scene, 0, 0, 160, 10, 0);
  addRoadSegment(scene, 0, 0, 10, 80, Math.PI / 2);

  // Side roads
  addRoadSegment(scene, -50, -30, 60, 8, 0);
  addRoadSegment(scene, 50, -30, 60, 8, 0);
  addRoadSegment(scene, -50, 30, 60, 8, 0);
  addRoadSegment(scene, 50, 30, 60, 8, 0);

  // ── Road centre lines ───────────────────────────────────────────────────────
  addDashedCentreLine(scene, 0, 0, 160, 0);
  addDashedCentreLine(scene, 0, 0, 80, Math.PI / 2);

  // ── Sidewalks along main road ───────────────────────────────────────────────
  addSidewalk(scene, 0, 7, 160, 3, 0);
  addSidewalk(scene, 0, -7, 160, 3, 0);
  addSidewalk(scene, 7, 0, 80, 3, Math.PI / 2);
  addSidewalk(scene, -7, 0, 80, 3, Math.PI / 2);

  // ── Curbs ───────────────────────────────────────────────────────────────────
  addCurb(scene, 0, 5.5, 160, 0);
  addCurb(scene, 0, -5.5, 160, 0);
  addCurb(scene, 5.5, 0, 80, Math.PI / 2);
  addCurb(scene, -5.5, 0, 80, Math.PI / 2);

  // ── Building pads (Nexus -35, Apex 0, Meridian 35, Harborview SW -55,-55) ──────
  addBuildingPad(scene, NEXUS_X, 0);
  addBuildingPad(scene, 0, 0);
  addBuildingPad(scene, MERIDIAN_X, 0);
  addBuildingPad(scene, -55, -55); // Harborview Tower — SW quadrant, waterfront

  // ── Lake ────────────────────────────────────────────────────────────────────
  addLake(scene, -65, -45);

  if (skipScenery) return; // Trees, lights, benches come from troo_world_elements

  // ── Trees ───────────────────────────────────────────────────────────────────
  const treePositions: [number, number][] = [
    [-70, 9], [-50, 9], [-30, 9], [-10, 9], [10, 9], [30, 9], [50, 9], [70, 9],
    [-70, -9], [-50, -9], [-30, -9], [-10, -9], [10, -9], [30, -9], [50, -9], [70, -9],
    [-65, -35], [-60, -55], [-50, -60], [-40, -55], [-45, -38],
    [60, 40], [70, -40], [-60, 40], [80, 20], [-80, -20],
    [40, 60], [-40, 60], [40, -60], [-40, -60],
    [0, 70], [0, -70],
  ];
  treePositions.forEach(([x, z]) => addTree(scene, x, z));

  // ── Street lights ────────────────────────────────────────────────────────────
  const lightPositions: [number, number][] = [
    [-60, 8], [-40, 8], [-20, 8], [0, 8], [20, 8], [40, 8], [60, 8],
    [-60, -8], [-40, -8], [-20, -8], [0, -8], [20, -8], [40, -8], [60, -8],
  ];
  lightPositions.forEach(([x, z]) => addStreetLight(scene, x, z));

  // ── Benches ──────────────────────────────────────────────────────────────────
  const benchPositions: [number, number, number][] = [
    [-45, 12, 0], [45, 12, 0], [-45, -12, 0], [45, -12, 0],
    [-55, -40, Math.PI / 4], [-45, -55, -Math.PI / 4],
  ];
  benchPositions.forEach(([x, z, ry]) => addBench(scene, x, z, ry));

  // ── Crosswalk markings ────────────────────────────────────────────────────────
  addCrosswalk(scene, -8, 0, Math.PI / 2);
  addCrosswalk(scene, 8, 0, Math.PI / 2);
  addCrosswalk(scene, 0, -8, 0);
  addCrosswalk(scene, 0, 8, 0);
}

function addRoadSegment(
  scene: THREE.Scene,
  cx: number,
  cz: number,
  length: number,
  width: number,
  rotY: number
): void {
  const geo = new THREE.PlaneGeometry(length, width);
  const mat = new THREE.MeshLambertMaterial({ color: C.road });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = rotY;
  mesh.position.set(cx, 0.02, cz);
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function addDashedCentreLine(
  scene: THREE.Scene,
  cx: number,
  cz: number,
  length: number,
  rotY: number
): void {
  const dashLen = 3;
  const gap = 2;
  const count = Math.floor(length / (dashLen + gap));
  const start = -(count * (dashLen + gap)) / 2 + dashLen / 2;
  const mat = new THREE.MeshBasicMaterial({ color: C.roadLine });

  for (let i = 0; i < count; i++) {
    const geo = new THREE.PlaneGeometry(dashLen, 0.15);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    const offset = start + i * (dashLen + gap);
    const x = rotY === 0 ? cx + offset : cx;
    const z = rotY === 0 ? cz : cz + offset;
    mesh.position.set(x, 0.03, z);
    scene.add(mesh);
  }
}

function addSidewalk(
  scene: THREE.Scene,
  cx: number,
  cz: number,
  length: number,
  width: number,
  rotY: number
): void {
  const geo = new THREE.BoxGeometry(length, 0.12, width);
  const mat = new THREE.MeshLambertMaterial({ color: C.sidewalk });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = rotY;
  mesh.position.set(cx, 0.06, cz);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  scene.add(mesh);
}

function addCurb(
  scene: THREE.Scene,
  cx: number,
  cz: number,
  length: number,
  rotY: number
): void {
  const geo = new THREE.BoxGeometry(length, 0.1, 0.2);
  const mat = new THREE.MeshLambertMaterial({ color: C.curb });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = rotY;
  mesh.position.set(cx, 0.05, cz);
  scene.add(mesh);
}

function addBuildingPad(scene: THREE.Scene, cx: number, cz: number): void {
  const geo = new THREE.BoxGeometry(28, 0.3, 22);
  const mat = new THREE.MeshLambertMaterial({ color: C.building_pad });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(cx, 0.15, cz);
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function addLake(scene: THREE.Scene, cx: number, cz: number): void {
  const shoreGeo = new THREE.CircleGeometry(14, 32);
  const shoreMat = new THREE.MeshLambertMaterial({ color: C.lakeShore });
  const shore = new THREE.Mesh(shoreGeo, shoreMat);
  shore.rotation.x = -Math.PI / 2;
  shore.position.set(cx, 0.01, cz);
  scene.add(shore);

  const shallowGeo = new THREE.CircleGeometry(12, 32);
  const shallowMat = new THREE.MeshLambertMaterial({
    color: C.lakeShallow,
    transparent: true,
    opacity: 0.85,
  });
  const shallow = new THREE.Mesh(shallowGeo, shallowMat);
  shallow.rotation.x = -Math.PI / 2;
  shallow.position.set(cx, 0.02, cz);
  scene.add(shallow);

  const deepGeo = new THREE.CircleGeometry(9, 32);
  const deepMat = new THREE.MeshPhongMaterial({
    color: C.lakeDeep,
    transparent: true,
    opacity: 0.9,
    shininess: 120,
    specular: 0x88ccff,
  });
  const deep = new THREE.Mesh(deepGeo, deepMat);
  deep.rotation.x = -Math.PI / 2;
  deep.position.set(cx, 0.03, cz);
  scene.add(deep);

  const ripples: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const rGeo = new THREE.RingGeometry(2 + i * 2.5, 2.3 + i * 2.5, 32);
    const rMat = new THREE.MeshBasicMaterial({
      color: 0x88ddff,
      transparent: true,
      opacity: 0.3 - i * 0.08,
      side: THREE.DoubleSide,
    });
    const ripple = new THREE.Mesh(rGeo, rMat);
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.set(cx, 0.04, cz);
    ripple.userData.ripplePhase = i * ((Math.PI * 2) / 3);
    ripple.userData.rippleBase = 2 + i * 2.5;
    scene.add(ripple);
    ripples.push(ripple);
  }
  scene.userData.lakeRipples = ripples;
}

function addTree(scene: THREE.Scene, x: number, z: number): void {
  const scale = 0.7 + Math.random() * 0.6;

  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.22, 1.2 * scale, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: C.treeTrunk });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.set(x, 0.6 * scale, z);
  trunk.castShadow = true;
  scene.add(trunk);

  const leafColor = Math.random() > 0.5 ? C.treeLeaf : C.treeLeaf2;
  const leafMat = new THREE.MeshLambertMaterial({ color: leafColor });

  const layers = [
    { r: 1.4 * scale, h: 1.6 * scale, y: 1.8 * scale },
    { r: 1.1 * scale, h: 1.4 * scale, y: 2.8 * scale },
    { r: 0.7 * scale, h: 1.2 * scale, y: 3.6 * scale },
  ];
  layers.forEach(({ r, h, y }) => {
    const geo = new THREE.ConeGeometry(r, h, 7);
    const mesh = new THREE.Mesh(geo, leafMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    scene.add(mesh);
  });
}

function addStreetLight(scene: THREE.Scene, x: number, z: number): void {
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.08, 5, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: C.lampPost });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(x, 2.5, z);
  pole.castShadow = true;
  scene.add(pole);

  const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.2, 4);
  const arm = new THREE.Mesh(armGeo, poleMat);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(x + 0.6, 5.1, z);
  scene.add(arm);

  const headGeo = new THREE.SphereGeometry(0.22, 8, 6);
  const headMat = new THREE.MeshBasicMaterial({ color: C.lampGlow });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(x + 1.2, 5.1, z);
  scene.add(head);

  const light = new THREE.PointLight(0xfff5cc, 0.5, 14);
  light.position.set(x + 1.2, 5.0, z);
  scene.add(light);
}

function addBench(scene: THREE.Scene, x: number, z: number, rotY: number): void {
  const woodMat = new THREE.MeshLambertMaterial({ color: C.benchWood });
  const metalMat = new THREE.MeshLambertMaterial({ color: C.benchMetal });

  const seatGeo = new THREE.BoxGeometry(1.4, 0.08, 0.45);
  const seat = new THREE.Mesh(seatGeo, woodMat);
  seat.position.set(x, 0.45, z);
  seat.rotation.y = rotY;
  scene.add(seat);

  const backGeo = new THREE.BoxGeometry(1.4, 0.4, 0.06);
  const back = new THREE.Mesh(backGeo, woodMat);
  back.position.set(
    x + Math.sin(rotY) * 0.2,
    0.7,
    z + Math.cos(rotY) * 0.2
  );
  back.rotation.y = rotY;
  scene.add(back);

  const legGeo = new THREE.BoxGeometry(0.06, 0.45, 0.45);
  [-0.6, 0.6].forEach((offset) => {
    const leg = new THREE.Mesh(legGeo, metalMat);
    leg.position.set(
      x + Math.cos(rotY) * offset,
      0.22,
      z - Math.sin(rotY) * offset
    );
    leg.rotation.y = rotY;
    scene.add(leg);
  });
}

function addCrosswalk(
  scene: THREE.Scene,
  cx: number,
  cz: number,
  rotY: number
): void {
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
  for (let i = -2; i <= 2; i++) {
    const geo = new THREE.PlaneGeometry(0.5, 9);
    const mesh = new THREE.Mesh(geo, stripeMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = rotY;
    const offset = i * 0.8;
    mesh.position.set(
      cx + (rotY === 0 ? offset : 0),
      0.025,
      cz + (rotY === 0 ? 0 : offset)
    );
    scene.add(mesh);
  }
}

export function animateTerrain(scene: THREE.Scene, elapsed: number): void {
  const ripples = scene.userData.lakeRipples as THREE.Mesh[] | undefined;
  if (!ripples) return;
  ripples.forEach((r) => {
    const phase = r.userData.ripplePhase as number;
    const base = r.userData.rippleBase as number;
    const scale = 1 + 0.06 * Math.sin(elapsed * 0.8 + phase);
    r.scale.set(scale, scale, 1);
    const mat = r.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.15 + 0.06 * Math.sin(elapsed * 0.8 + phase);
  });
}
