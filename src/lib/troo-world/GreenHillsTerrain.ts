/**
 * GreenHillsTerrain.ts
 * Procedural green grass rolling hills terrain for "green-terrain" world.
 * Features: Perlin noise terrain, sky dome, clouds, distant hills, grass tufts, rocks.
 * Corporate Tower(s) can be placed at origin.
 */
import * as THREE from "three";

// ─── Perlin Noise Helpers ───────────────────────────────────────────────────
function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerpN(a: number, b: number, t: number) { return a + t * (b - a); }
function grad(h: number, x: number, y: number) {
  const u = (h & 2) ? -x : x;
  const v = (h & 1) ? -y : y;
  return u + v;
}

const _p = new Uint8Array(512);
(() => {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let seed = 42;
  for (let i = 255; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(seed) % (i + 1);
    [s[i], s[j]] = [s[j], s[i]];
  }
  for (let i = 0; i < 512; i++) _p[i] = s[i & 255];
})();

function noise2(x: number, y: number) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x), yf = y - Math.floor(y);
  const u = fade(xf), v = fade(yf);
  return lerpN(
    lerpN(grad(_p[_p[X] + Y], xf, yf), grad(_p[_p[X + 1] + Y], xf - 1, yf), u),
    lerpN(grad(_p[_p[X] + Y + 1], xf, yf - 1), grad(_p[_p[X + 1] + Y + 1], xf - 1, yf - 1), u),
    v
  );
}

function fbm(x: number, y: number, o = 5) {
  let v = 0, a = 0.5, f = 1, m = 0;
  for (let i = 0; i < o; i++) {
    v += noise2(x * f, y * f) * a;
    m += a;
    a *= 0.5;
    f *= 2;
  }
  return v / m;
}

export function terrainHeight(x: number, z: number): number {
  const nx = x / 200 + 0.5;
  const nz = z / 200 + 0.5;
  const h = fbm(nx * 3, nz * 3) * 8 + fbm(nx * 7, nz * 7) * 2;
  const d = Math.sqrt(x * x + z * z);
  const t0 = Math.min(1, d / 35);
  return h * t0 * t0 * (3 - 2 * t0);
}

// ─── Palette ───────────────────────────────────────────────────────────────
const C = {
  grassLow: 0x2d6a2d,
  grassMid: 0x4a8a3a,
  grassHigh: 0x7ab84a,
  treeTrunk: 0x5c3a1e,
  treeFoliage1: 0x2d6a2d,
  treeFoliage2: 0x3a7a35,
  treeFoliage3: 0x4a8a3a,
  rock: 0x8a8a7a,
  skyZenith: 0x1a5fa8,
  skyHorizon: 0x6ab8d4,
  distantHill: 0x3a7a2a,
  grassTuft: 0x5aaa35,
  cloud: 0xffffff,
};

// ─── Main Build ────────────────────────────────────────────────────────────
export function buildGreenHillsTerrain(scene: THREE.Scene, options?: { skipScenery?: boolean }): void {
  const skipScenery = options?.skipScenery ?? false;

  // ── Terrain mesh with vertex colors ─────────────────────────────────────
  const terrainGeo = new THREE.PlaneGeometry(200, 200, 128, 128);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position as THREE.BufferAttribute;
  const cols: number[] = [];
  const cL = new THREE.Color(C.grassLow);
  const cM = new THREE.Color(C.grassMid);
  const cH = new THREE.Color(C.grassHigh);

  for (let i = 0; i < pos.count; i++) {
    const h = terrainHeight(pos.getX(i), pos.getZ(i));
    pos.setY(i, h);
    const t = Math.min(1, Math.max(0, h / 8));
    const c = t < 0.5 ? cL.clone().lerp(cM, t * 2) : cM.clone().lerp(cH, (t - 0.5) * 2);
    cols.push(c.r, c.g, c.b);
  }
  terrainGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  terrainGeo.computeVertexNormals();

  const terrain = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshLambertMaterial({ vertexColors: true })
  );
  terrain.receiveShadow = true;
  scene.add(terrain);

  // ── Sky dome ────────────────────────────────────────────────────────────
  const skyGeo = new THREE.SphereGeometry(400, 32, 16);
  const skyPos = skyGeo.attributes.position as THREE.BufferAttribute;
  const skyCols: number[] = [];
  const zenith = new THREE.Color(C.skyZenith);
  const horizon = new THREE.Color(C.skyHorizon);
  for (let i = 0; i < skyPos.count; i++) {
    const t = Math.max(0, Math.min(1, (skyPos.getY(i) + 400) / 800));
    const c = horizon.clone().lerp(zenith, t * t);
    skyCols.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute("color", new THREE.Float32BufferAttribute(skyCols, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
  scene.add(sky);

  // ── Clouds (instanced) ──────────────────────────────────────────────────
  const cloudGroup = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({ color: C.cloud, transparent: true, opacity: 0.82 });
  const cloudGeo = new THREE.SphereGeometry(1, 8, 6);
  const rng = (s: number) => {
    s = (s ^ 0xcafe1234) >>> 0;
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    return ((s ^ (s >>> 16)) >>> 0) / 0xffffffff;
  };
  const clouds: { x: number; y: number; z: number; sx: number; sy: number; sz: number; sp: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const cloud = {
      x: (rng(i * 3) - 0.5) * 280,
      y: 55 + rng(i * 3 + 1) * 30,
      z: (rng(i * 3 + 2) - 0.5) * 280,
      sx: 18 + rng(i) * 20,
      sy: 5 + rng(i + 1) * 5,
      sz: 12 + rng(i + 2) * 14,
      sp: 0.4 + rng(i) * 0.6,
    };
    clouds.push(cloud);
    const mesh = new THREE.Mesh(cloudGeo, cloudMat);
    mesh.position.set(cloud.x, cloud.y, cloud.z);
    mesh.scale.set(cloud.sx, cloud.sy, cloud.sz);
    cloudGroup.add(mesh);
  }
  scene.add(cloudGroup);
  scene.userData.greenHillsClouds = { group: cloudGroup, data: clouds };

  // ── Distant hills ───────────────────────────────────────────────────────
  const hillMat = new THREE.MeshLambertMaterial({ color: C.distantHill, side: THREE.FrontSide });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = 110 + (i % 3) * 15;
    const hillGeo = new THREE.SphereGeometry(1, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const hill = new THREE.Mesh(hillGeo, hillMat);
    hill.position.set(Math.cos(a) * r, -2, Math.sin(a) * r);
    hill.scale.set(20 + (i % 4) * 8, 12 + (i % 3) * 5, 20 + (i % 4) * 8);
    scene.add(hill);
  }

  // ── Flat building pad at origin ─────────────────────────────────────────
  const padGeo = new THREE.CylinderGeometry(18, 20, 0.5, 32);
  const padMat = new THREE.MeshLambertMaterial({ color: 0xc8cdd4 });
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.position.set(0, 0.25, 0);
  pad.receiveShadow = true;
  scene.add(pad);

  if (skipScenery) return;

  // ── Trees ───────────────────────────────────────────────────────────────
  const treeRng = (s: number) => {
    s = (s ^ 0xdeadbeef) >>> 0;
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    return ((s ^ (s >>> 16)) >>> 0) / 0xffffffff;
  };
  for (let i = 0; i < 80; i++) {
    const a = treeRng(i * 3) * Math.PI * 2;
    const r = 32 + treeRng(i * 3 + 1) * 68;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const scale = 0.7 + treeRng(i * 3 + 2) * 0.8;
    addGreenTree(scene, x, terrainHeight(x, z), z, scale);
  }

  // ── Grass tufts (instanced) ─────────────────────────────────────────────
  const tufts: { pos: [number, number, number]; phase: number }[] = [];
  const tuftRng = (s: number) => {
    s = (s ^ 0xabcd1234) >>> 0;
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    return ((s ^ (s >>> 16)) >>> 0) / 0xffffffff;
  };
  for (let i = 0; i < 400; i++) {
    const x = (tuftRng(i * 2) - 0.5) * 190;
    const z = (tuftRng(i * 2 + 1) - 0.5) * 190;
    if (Math.sqrt(x * x + z * z) < 28) continue;
    tufts.push({ pos: [x, terrainHeight(x, z) + 0.1, z], phase: tuftRng(i) * Math.PI * 2 });
  }
  const tuftGeo = new THREE.ConeGeometry(0.08, 0.5, 4);
  const tuftMat = new THREE.MeshLambertMaterial({ color: C.grassTuft });
  const tuftMesh = new THREE.InstancedMesh(tuftGeo, tuftMat, tufts.length);
  tuftMesh.castShadow = true;
  const dummy = new THREE.Object3D();
  tufts.forEach(({ pos, phase }, i) => {
    dummy.position.set(...pos);
    dummy.rotation.y = phase;
    dummy.rotation.z = 0;
    dummy.scale.setScalar(0.6 + (phase % 0.4));
    dummy.updateMatrix();
    tuftMesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(tuftMesh);
  scene.userData.greenHillsTufts = { mesh: tuftMesh, data: tufts };

  // ── Rocks ───────────────────────────────────────────────────────────────
  const rockRng = (s: number) => {
    s = (s ^ 0x1234abcd) >>> 0;
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    return ((s ^ (s >>> 16)) >>> 0) / 0xffffffff;
  };
  const rockMat = new THREE.MeshLambertMaterial({ color: C.rock });
  const rockGeo = new THREE.DodecahedronGeometry(0.5, 0);
  for (let i = 0; i < 30; i++) {
    const a = rockRng(i * 4) * Math.PI * 2;
    const r = 35 + rockRng(i * 4 + 1) * 60;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(x, terrainHeight(x, z) - 0.1, z);
    rock.scale.set(0.3 + rockRng(i * 4 + 2) * 0.5, 0.2 + rockRng(i * 4 + 3) * 0.3, 0.3 + rockRng(i * 4) * 0.5);
    rock.rotation.y = rockRng(i) * Math.PI;
    rock.castShadow = true;
    scene.add(rock);
  }
}

function addGreenTree(scene: THREE.Scene, x: number, y: number, z: number, scale: number): void {
  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.14, 1.2 * scale, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: C.treeTrunk });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.set(x, y + 0.6 * scale, z);
  trunk.castShadow = true;
  scene.add(trunk);

  const layers = [
    { color: C.treeFoliage1, r: 0.9, h: 1.6, yOff: 1.2 },
    { color: C.treeFoliage2, r: 0.65, h: 1.3, yOff: 2.0 },
    { color: C.treeFoliage3, r: 0.4, h: 1.0, yOff: 2.7 },
  ];
  layers.forEach(({ color, r, h, yOff }) => {
    const geo = new THREE.ConeGeometry(r * scale, h * scale, 7);
    const mat = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + yOff * scale, z);
    mesh.castShadow = true;
    scene.add(mesh);
  });
}

// ─── Animation ─────────────────────────────────────────────────────────────
export function animateGreenHillsTerrain(scene: THREE.Scene, elapsed: number): void {
  // Animate clouds
  const cloudData = scene.userData.greenHillsClouds as { group: THREE.Group; data: typeof clouds } | undefined;
  if (cloudData) {
    cloudData.group.children.forEach((mesh, i) => {
      const cd = cloudData.data[i];
      mesh.position.x = cd.x + Math.sin(elapsed * 0.05 * cd.sp + i) * 8;
    });
  }

  // Animate grass tufts (wind sway)
  const tuftData = scene.userData.greenHillsTufts as { mesh: THREE.InstancedMesh; data: typeof tufts } | undefined;
  if (tuftData) {
    const dummy = new THREE.Object3D();
    tuftData.data.forEach(({ pos, phase }, i) => {
      dummy.position.set(...pos);
      dummy.rotation.y = phase;
      dummy.rotation.z = Math.sin(elapsed * 1.2 + phase) * 0.15;
      dummy.scale.setScalar(0.6 + (phase % 0.4));
      dummy.updateMatrix();
      tuftData.mesh.setMatrixAt(i, dummy.matrix);
    });
    tuftData.mesh.instanceMatrix.needsUpdate = true;
  }
}

const clouds: { x: number; y: number; z: number; sx: number; sy: number; sz: number; sp: number }[] = [];
const tufts: { pos: [number, number, number]; phase: number }[] = [];
