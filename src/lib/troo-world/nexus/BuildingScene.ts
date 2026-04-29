/**
 * BuildingScene.ts
 * Design Philosophy: Glassmorphic Night City
 * - Deep navy atmosphere, electric blue accents
 * - Warm interior office lighting visible through transparent windows (floors 1-2)
 * - 9 floors with distinct office layouts
 * - Working elevator with animated cab and door mechanics
 * - First-person walkthrough navigation
 */

import * as THREE from 'three';

// ─── Constants ────────────────────────────────────────────────────────────────
export const BUILDING_GLB_URL = '/models/nexus-tower/modern_building.glb';

// Building dimensions derived from GLB analysis
// GLB min: [-11, 0, -8.5]  max: [13.75, 28.75, 8.5]
// We'll use a normalized interior that fits inside the shell
export const BUILDING = {
  width: 24.75,   // x: -11 to 13.75
  depth: 17,      // z: -8.5 to 8.5
  height: 28.75,  // y: 0 to 28.75
  centerX: 1.375, // (13.75 + -11) / 2
  centerZ: 0,
  floors: 9,
};

export const FLOOR_HEIGHT = BUILDING.height / BUILDING.floors; // ~3.19 units per floor

// Interior is slightly inset from the shell
export const INTERIOR = {
  width: BUILDING.width - 1.0,
  depth: BUILDING.depth - 1.0,
  x: BUILDING.centerX,
  z: BUILDING.centerZ,
};

// Elevator shaft position (right side of building)
export const ELEVATOR = {
  x: BUILDING.centerX + INTERIOR.width / 2 - 2.5,
  z: BUILDING.centerZ,
  width: 2.2,
  depth: 2.2,
  shaftColor: 0x1a1a2e,
};

// ─── Color Palette ────────────────────────────────────────────────────────────
const COLORS = {
  floorConcrete: 0x2a2a3a,
  floorCarpet: [0x1e3a5f, 0x1a3a2a, 0x3a1a1a, 0x2a1a3a, 0x1a2a3a, 0x3a2a1a, 0x1a3a3a, 0x2a3a1a, 0x3a1a2a],
  ceiling: 0x1a1a2e,
  wall: 0x16213e,
  wallAccent: 0x0f3460,
  desk: 0x8b6914,
  deskTop: 0xc8a84b,
  chair: 0x2d4a6e,
  chairSeat: 0x1a3a5f,
  monitor: 0x0d0d1a,
  monitorScreen: 0x00d4ff,
  plant: 0x2d5a27,
  plantPot: 0x8b4513,
  window1F: 0x87ceeb,  // see-through tint for floors 1-2
  windowGlass: 0x4a90d9,
  elevatorCab: 0x2a2a4a,
  elevatorDoor: 0x3a3a5a,
  elevatorDoorOpen: 0x1a1a3a,
  lightWarm: 0xfff4e0,
  lightCool: 0x00d4ff,
  reception: 0x1a3a5f,
  sofa: 0x2d3a5f,
  table: 0x5a3a1a,
  bookshelf: 0x3a2a1a,
  book: [0x8b1a1a, 0x1a5a8b, 0x1a8b3a, 0x8b8b1a, 0x5a1a8b],
  whiteboard: 0xf0f0f0,
  whiteboardFrame: 0x2a2a3a,
  pillar: 0x1e2a3e,
  ground: 0x0d1117,
  sky: 0x020408,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function box(w: number, h: number, d: number, color: number, opacity = 1, transparent = false): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshLambertMaterial({ color, opacity, transparent });
  return new THREE.Mesh(geo, mat);
}

function cylinder(r: number, h: number, color: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r, r, h, 8);
  const mat = new THREE.MeshLambertMaterial({ color });
  return new THREE.Mesh(geo, mat);
}

// ─── Floor Interior Builder ───────────────────────────────────────────────────
function buildFloorInterior(floorIndex: number, scene: THREE.Group): void {
  const y = floorIndex * FLOOR_HEIGHT;
  const carpetColor = COLORS.floorCarpet[floorIndex % COLORS.floorCarpet.length];
  const iw = INTERIOR.width;
  const id = INTERIOR.depth;
  const ix = INTERIOR.x;
  const iz = INTERIOR.z;
  const fh = FLOOR_HEIGHT;

  // ── Floor slab ──
  const floorMesh = box(iw, 0.12, id, carpetColor);
  floorMesh.position.set(ix, y + 0.06, iz);
  scene.add(floorMesh);

  // ── Ceiling ──
  const ceilMesh = box(iw, 0.1, id, COLORS.ceiling);
  ceilMesh.position.set(ix, y + fh - 0.05, iz);
  scene.add(ceilMesh);

  // ── Walls (interior) ──
  const wallThick = 0.15;
  // North wall
  const wN = box(iw, fh, wallThick, COLORS.wall);
  wN.position.set(ix, y + fh / 2, iz - id / 2 + wallThick / 2);
  scene.add(wN);
  // South wall
  const wS = box(iw, fh, wallThick, COLORS.wall);
  wS.position.set(ix, y + fh / 2, iz + id / 2 - wallThick / 2);
  scene.add(wS);
  // East wall (elevator side - partial)
  const wE = box(wallThick, fh, id, COLORS.wallAccent);
  wE.position.set(ix + iw / 2 - wallThick / 2, y + fh / 2, iz);
  scene.add(wE);
  // West wall
  const wW = box(wallThick, fh, id, COLORS.wall);
  wW.position.set(ix - iw / 2 + wallThick / 2, y + fh / 2, iz);
  scene.add(wW);

  // ── Ceiling lights ──
  const lightSpacing = 5;
  for (let lx = -iw / 2 + 3; lx < iw / 2 - 1; lx += lightSpacing) {
    const lightPanel = box(1.5, 0.08, 0.6, 0xffffff);
    lightPanel.position.set(ix + lx, y + fh - 0.1, iz);
    scene.add(lightPanel);
    const light = new THREE.PointLight(COLORS.lightWarm, 2.5, 14);
    light.position.set(ix + lx, y + fh - 0.3, iz);
    scene.add(light);
  }

  // ── Pillars ──
  for (let px = -iw / 2 + 2; px < iw / 2 - 1; px += 8) {
    for (const pz of [-id / 2 + 1.5, id / 2 - 1.5]) {
      const pillar = box(0.5, fh, 0.5, COLORS.pillar);
      pillar.position.set(ix + px, y + fh / 2, iz + pz);
      scene.add(pillar);
    }
  }

  // ── Floor-specific furniture ──
  switch (floorIndex) {
    case 0: buildLobby(scene, ix, iz, y, iw, id, fh); break;
    case 1: buildOpenOffice(scene, ix, iz, y, iw, id, fh, 1); break;
    case 2: buildOpenOffice(scene, ix, iz, y, iw, id, fh, 2); break;
    case 3: buildConferenceFloor(scene, ix, iz, y, iw, id, fh); break;
    case 4: buildOpenOffice(scene, ix, iz, y, iw, id, fh, 4); break;
    case 5: buildExecutiveFloor(scene, ix, iz, y, iw, id, fh); break;
    case 6: buildOpenOffice(scene, ix, iz, y, iw, id, fh, 6); break;
    case 7: buildBreakRoom(scene, ix, iz, y, iw, id, fh); break;
    case 8: buildRooftopLounge(scene, ix, iz, y, iw, id, fh); break;
  }
}

// ── Ground Floor Lobby ──
function buildLobby(g: THREE.Group, ix: number, iz: number, y: number, iw: number, id: number, fh: number) {
  // Reception desk
  const desk = box(4, 1.1, 1.5, COLORS.reception);
  desk.position.set(ix - 2, y + 0.55, iz - 1);
  g.add(desk);
  const deskTop = box(4.2, 0.1, 1.7, COLORS.deskTop);
  deskTop.position.set(ix - 2, y + 1.1, iz - 1);
  g.add(deskTop);

  // Reception monitor
  const mon = box(0.8, 0.6, 0.05, COLORS.monitor);
  mon.position.set(ix - 2, y + 1.6, iz - 1.2);
  g.add(mon);
  const screen = box(0.7, 0.5, 0.02, COLORS.monitorScreen, 0.9, true);
  screen.position.set(ix - 2, y + 1.6, iz - 1.17);
  g.add(screen);

  // Waiting sofas
  for (let si = 0; si < 3; si++) {
    const sofa = box(1.8, 0.5, 0.8, COLORS.sofa);
    sofa.position.set(ix + 3 + si * 2.5, y + 0.25, iz + 2);
    g.add(sofa);
    const sofaBack = box(1.8, 0.6, 0.15, COLORS.sofa);
    sofaBack.position.set(ix + 3 + si * 2.5, y + 0.55, iz + 2.4);
    g.add(sofaBack);
  }

  // Coffee table
  const ct = box(1.2, 0.4, 0.8, COLORS.table);
  ct.position.set(ix + 5, y + 0.2, iz + 1);
  g.add(ct);

  // Plants
  for (const [px, pz] of [[-iw / 2 + 1.5, -id / 2 + 1.5], [iw / 2 - 2, -id / 2 + 1.5]]) {
    const pot = cylinder(0.3, 0.5, COLORS.plantPot);
    pot.position.set(ix + px, y + 0.25, iz + pz);
    g.add(pot);
    const plant = cylinder(0.5, 1.2, COLORS.plant);
    plant.position.set(ix + px, y + 0.85, iz + pz);
    g.add(plant);
  }

  // Lobby sign (wall panel)
  const sign = box(3, 0.8, 0.1, COLORS.wallAccent);
  sign.position.set(ix, y + 2.2, iz - id / 2 + 0.3);
  g.add(sign);
}

// ── Open Office Floor ──
function buildOpenOffice(g: THREE.Group, ix: number, iz: number, y: number, iw: number, id: number, fh: number, fi: number) {
  const rows = 3;
  const cols = 4;
  const deskW = 1.6, deskD = 0.8, deskH = 0.75;
  const startX = ix - iw / 2 + 2.5;
  const startZ = iz - id / 2 + 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dx = startX + c * 3.2;
      const dz = startZ + r * 3.5;
      if (dx > ix + iw / 2 - 3 || dz > iz + id / 2 - 2) continue;

      // Desk
      const desk = box(deskW, deskH, deskD, COLORS.desk);
      desk.position.set(dx, y + deskH / 2, dz);
      g.add(desk);
      const top = box(deskW + 0.1, 0.06, deskD + 0.1, COLORS.deskTop);
      top.position.set(dx, y + deskH, dz);
      g.add(top);

      // Monitor
      const mon = box(0.7, 0.5, 0.04, COLORS.monitor);
      mon.position.set(dx, y + deskH + 0.35, dz - 0.25);
      g.add(mon);
      const scr = box(0.62, 0.42, 0.02, COLORS.monitorScreen, 0.85, true);
      scr.position.set(dx, y + deskH + 0.35, dz - 0.23);
      g.add(scr);

      // Chair
      const chairBase = box(0.7, 0.08, 0.7, COLORS.chair);
      chairBase.position.set(dx, y + 0.45, dz + 0.7);
      g.add(chairBase);
      const chairBack = box(0.7, 0.7, 0.08, COLORS.chairSeat);
      chairBack.position.set(dx, y + 0.85, dz + 0.7);
      g.add(chairBack);
      const chairLeg = cylinder(0.04, 0.45, 0x333333);
      chairLeg.position.set(dx, y + 0.22, dz + 0.7);
      g.add(chairLeg);
    }
  }

  // Bookshelf on west wall
  const shelf = box(0.35, fh * 0.7, id * 0.5, COLORS.bookshelf);
  shelf.position.set(ix - iw / 2 + 0.5, y + fh * 0.35, iz);
  g.add(shelf);
  // Books
  for (let bi = 0; bi < 12; bi++) {
    const bk = box(0.28, 0.3 + Math.random() * 0.2, 0.22, COLORS.book[bi % COLORS.book.length]);
    bk.position.set(ix - iw / 2 + 0.52, y + 0.4 + bi * 0.35, iz - id * 0.2 + bi * 0.18);
    g.add(bk);
  }

  // Whiteboard
  const wb = box(3, 1.5, 0.06, COLORS.whiteboard);
  wb.position.set(ix + 2, y + 1.8, iz + id / 2 - 0.3);
  g.add(wb);
  const wbf = box(3.2, 1.7, 0.04, COLORS.whiteboardFrame);
  wbf.position.set(ix + 2, y + 1.8, iz + id / 2 - 0.32);
  g.add(wbf);
}

// ── Conference Floor ──
function buildConferenceFloor(g: THREE.Group, ix: number, iz: number, y: number, iw: number, id: number, fh: number) {
  // Large conference table
  const ct = box(8, 0.12, 3, COLORS.table);
  ct.position.set(ix, y + 0.8, iz);
  g.add(ct);
  const ctLegs = box(7.8, 0.8, 2.8, COLORS.table);
  ctLegs.position.set(ix, y + 0.4, iz);
  g.add(ctLegs);

  // Chairs around table
  const chairPositions: [number, number, number][] = [];
  for (let ci = 0; ci < 5; ci++) {
    chairPositions.push([ix - 3.5 + ci * 1.7, y, iz - 2.2]);
    chairPositions.push([ix - 3.5 + ci * 1.7, y, iz + 2.2]);
  }
  chairPositions.push([ix - 4.5, y, iz]);
  chairPositions.push([ix + 4.5, y, iz]);

  for (const [cx, cy, cz] of chairPositions) {
    const seat = box(0.65, 0.08, 0.65, COLORS.chair);
    seat.position.set(cx, cy + 0.45, cz);
    g.add(seat);
    const back = box(0.65, 0.6, 0.08, COLORS.chairSeat);
    back.position.set(cx, cy + 0.75, cz + (cz < iz ? 0.28 : -0.28));
    g.add(back);
  }

  // Projector screen
  const screen = box(5, 2.5, 0.05, 0xf5f5f5);
  screen.position.set(ix, y + 2, iz - id / 2 + 0.3);
  g.add(screen);

  // Projector
  const proj = box(0.5, 0.2, 0.4, 0x333333);
  proj.position.set(ix, y + fh - 0.3, iz);
  g.add(proj);

  // Side credenza
  const cred = box(4, 0.9, 0.6, COLORS.desk);
  cred.position.set(ix + 4, y + 0.45, iz + id / 2 - 0.6);
  g.add(cred);
}

// ── Executive Floor ──
function buildExecutiveFloor(g: THREE.Group, ix: number, iz: number, y: number, iw: number, id: number, fh: number) {
  // Private offices with glass partitions
  for (let oi = 0; oi < 3; oi++) {
    const ox = ix - iw / 2 + 3 + oi * 6;
    // Glass partition
    const partition = box(0.08, fh * 0.8, id * 0.4, 0x87ceeb, 0.3, true);
    partition.position.set(ox + 2.5, y + fh * 0.4, iz);
    g.add(partition);

    // Executive desk (L-shaped approximation)
    const d1 = box(2.2, 0.75, 1.0, COLORS.desk);
    d1.position.set(ox, y + 0.375, iz - 1);
    g.add(d1);
    const d2 = box(1.0, 0.75, 2.0, COLORS.desk);
    d2.position.set(ox + 0.6, y + 0.375, iz + 0.5);
    g.add(d2);
    const dt = box(2.3, 0.06, 1.1, COLORS.deskTop);
    dt.position.set(ox, y + 0.75, iz - 1);
    g.add(dt);

    // Monitor + laptop
    const mon = box(0.9, 0.65, 0.04, COLORS.monitor);
    mon.position.set(ox, y + 1.1, iz - 1.3);
    g.add(mon);
    const scr = box(0.82, 0.57, 0.02, COLORS.monitorScreen, 0.85, true);
    scr.position.set(ox, y + 1.1, iz - 1.28);
    g.add(scr);

    // Executive chair
    const ec = box(0.8, 0.1, 0.8, COLORS.chair);
    ec.position.set(ox, y + 0.5, iz);
    g.add(ec);
    const ecb = box(0.8, 0.9, 0.1, COLORS.chairSeat);
    ecb.position.set(ox, y + 0.95, iz + 0.35);
    g.add(ecb);
  }

  // Corner seating area
  const sofa1 = box(2.5, 0.5, 0.8, COLORS.sofa);
  sofa1.position.set(ix + iw / 2 - 3, y + 0.25, iz - 2);
  g.add(sofa1);
  const sofa2 = box(0.8, 0.5, 2.5, COLORS.sofa);
  sofa2.position.set(ix + iw / 2 - 1.5, y + 0.25, iz - 1);
  g.add(sofa2);
  const coffeeT = box(1.2, 0.4, 1.2, COLORS.table);
  coffeeT.position.set(ix + iw / 2 - 2.5, y + 0.2, iz - 1);
  g.add(coffeeT);
}

// ── Break Room ──
function buildBreakRoom(g: THREE.Group, ix: number, iz: number, y: number, iw: number, id: number, fh: number) {
  // Kitchen counter
  const counter = box(iw * 0.4, 0.9, 0.7, 0x2a3a4a);
  counter.position.set(ix - iw / 2 + iw * 0.2, y + 0.45, iz - id / 2 + 0.6);
  g.add(counter);
  const counterTop = box(iw * 0.4 + 0.1, 0.06, 0.8, 0x4a6a8a);
  counterTop.position.set(ix - iw / 2 + iw * 0.2, y + 0.9, iz - id / 2 + 0.6);
  g.add(counterTop);

  // Fridge
  const fridge = box(0.8, 1.8, 0.7, 0x3a4a5a);
  fridge.position.set(ix - iw / 2 + 1, y + 0.9, iz - id / 2 + 0.6);
  g.add(fridge);

  // Dining tables
  for (let ti = 0; ti < 3; ti++) {
    const dt = box(1.5, 0.75, 1.0, COLORS.table);
    dt.position.set(ix + ti * 3 - 2, y + 0.375, iz + 1.5);
    g.add(dt);
    // Chairs around each table
    for (const [dcx, dcz] of [[-0.8, 0], [0.8, 0], [0, -0.8], [0, 0.8]]) {
      const dc = box(0.5, 0.08, 0.5, COLORS.chair);
      dc.position.set(ix + ti * 3 - 2 + dcx, y + 0.45, iz + 1.5 + dcz);
      g.add(dc);
    }
  }

  // Plants
  for (const [px, pz] of [[iw / 2 - 1.5, id / 2 - 1.5], [-iw / 2 + 1.5, id / 2 - 1.5]]) {
    const pot = cylinder(0.35, 0.6, COLORS.plantPot);
    pot.position.set(ix + px, y + 0.3, iz + pz);
    g.add(pot);
    const plant = cylinder(0.6, 1.5, COLORS.plant);
    plant.position.set(ix + px, y + 1.05, iz + pz);
    g.add(plant);
  }
}

// ── Rooftop Lounge ──
function buildRooftopLounge(g: THREE.Group, ix: number, iz: number, y: number, iw: number, id: number, fh: number) {
  // Lounge sofas in U-shape
  const s1 = box(4, 0.5, 0.9, COLORS.sofa);
  s1.position.set(ix - 1, y + 0.25, iz - 2);
  g.add(s1);
  const s2 = box(0.9, 0.5, 3, COLORS.sofa);
  s2.position.set(ix - 3, y + 0.25, iz - 0.5);
  g.add(s2);
  const s3 = box(0.9, 0.5, 3, COLORS.sofa);
  s3.position.set(ix + 1, y + 0.25, iz - 0.5);
  g.add(s3);

  // Central coffee table
  const ct = box(1.5, 0.4, 1.5, COLORS.table);
  ct.position.set(ix - 1, y + 0.2, iz - 0.5);
  g.add(ct);

  // Bar counter
  const bar = box(5, 1.1, 0.8, 0x1a2a3a);
  bar.position.set(ix + 4, y + 0.55, iz - id / 2 + 1);
  g.add(bar);
  const barTop = box(5.2, 0.08, 1.0, 0x3a5a7a);
  barTop.position.set(ix + 4, y + 1.1, iz - id / 2 + 1);
  g.add(barTop);

  // Bar stools
  for (let bs = 0; bs < 4; bs++) {
    const stool = cylinder(0.2, 0.9, COLORS.chair);
    stool.position.set(ix + 2 + bs * 1.3, y + 0.45, iz - id / 2 + 2);
    g.add(stool);
  }

  // Ambient glow lights
  const glow = new THREE.PointLight(0x00d4ff, 1.2, 12);
  glow.position.set(ix, y + 2, iz);
  g.add(glow);
}

// ─── Window Builder ────────────────────────────────────────────────────────────
function buildWindows(scene: THREE.Group): void {
  const iw = INTERIOR.width;
  const id = INTERIOR.depth;
  const ix = INTERIOR.x;
  const iz = INTERIOR.z;

  for (let f = 0; f < BUILDING.floors; f++) {
    const y = f * FLOOR_HEIGHT;
    const isTransparent = f === 0 || f === 1;
    const windowColor = isTransparent ? 0x87ceeb : 0x1a3a5f;
    const windowOpacity = isTransparent ? 0.35 : 0.7;
    const windowCount = 5;
    const windowW = 1.4;
    const windowH = FLOOR_HEIGHT * 0.55;
    const windowY = y + FLOOR_HEIGHT * 0.55;

    // North & South windows
    for (let wi = 0; wi < windowCount; wi++) {
      const wx = ix - iw / 2 + 2 + wi * (iw - 4) / (windowCount - 1);
      for (const wz of [iz - id / 2, iz + id / 2]) {
        const winGeo = new THREE.PlaneGeometry(windowW, windowH);
        const winMat = new THREE.MeshLambertMaterial({
          color: windowColor,
          transparent: true,
          opacity: windowOpacity,
          side: THREE.DoubleSide,
        });
        const win = new THREE.Mesh(winGeo, winMat);
        win.position.set(wx, windowY, wz);
        scene.add(win);

        // Window frame
        const frameH = box(windowW + 0.1, windowH + 0.1, 0.05, 0x2a3a4a);
        frameH.position.set(wx, windowY, wz + (wz < iz ? 0.03 : -0.03));
        scene.add(frameH);

        // Interior warm light glow on floors 1-2
        if (isTransparent) {
          const warmLight = new THREE.PointLight(0xfff4e0, 0.4, 5);
          warmLight.position.set(wx, windowY, wz + (wz < iz ? 1.5 : -1.5));
          scene.add(warmLight);
        }
      }
    }

    // East windows (non-elevator side)
    for (let wi = 0; wi < 3; wi++) {
      const wz = iz - id / 2 + 2 + wi * (id - 4) / 2;
      const winGeo = new THREE.PlaneGeometry(windowW, windowH);
      const winMat = new THREE.MeshLambertMaterial({
        color: windowColor,
        transparent: true,
        opacity: windowOpacity,
        side: THREE.DoubleSide,
      });
      const win = new THREE.Mesh(winGeo, winMat);
      win.rotation.y = Math.PI / 2;
      win.position.set(ix - iw / 2, windowY, wz);
      scene.add(win);
    }
  }
}

// ─── Elevator Builder ─────────────────────────────────────────────────────────
export interface ElevatorState {
  currentFloor: number;
  targetFloor: number;
  cabY: number;
  doorOpenAmount: number; // 0 = closed, 1 = open
  isMoving: boolean;
  doorState: 'closed' | 'opening' | 'open' | 'closing';
  doorTimer: number;
}

export function buildElevatorShaft(scene: THREE.Group): void {
  const ex = ELEVATOR.x;
  const ez = ELEVATOR.z;
  const ew = ELEVATOR.width;
  const ed = ELEVATOR.depth;
  const totalH = BUILDING.height;

  // Shaft walls
  const shaftBack = box(ew, totalH, 0.1, ELEVATOR.shaftColor);
  shaftBack.position.set(ex, totalH / 2, ez - ed / 2);
  scene.add(shaftBack);
  const shaftLeft = box(0.1, totalH, ed, ELEVATOR.shaftColor);
  shaftLeft.position.set(ex - ew / 2, totalH / 2, ez);
  scene.add(shaftLeft);
  const shaftRight = box(0.1, totalH, ed, ELEVATOR.shaftColor);
  shaftRight.position.set(ex + ew / 2, totalH / 2, ez);
  scene.add(shaftRight);

  // Guide rails
  for (const rx of [ex - ew / 2 + 0.15, ex + ew / 2 - 0.15]) {
    const rail = box(0.06, totalH, 0.06, 0x4a4a6a);
    rail.position.set(rx, totalH / 2, ez - ed / 2 + 0.1);
    scene.add(rail);
  }

  // Floor call buttons (outside each floor)
  for (let f = 0; f < BUILDING.floors; f++) {
    const fy = f * FLOOR_HEIGHT + FLOOR_HEIGHT * 0.5;
    const btnPanel = box(0.3, 0.4, 0.05, 0x1a1a3a);
    btnPanel.position.set(ex - ew / 2 - 0.2, fy, ez + ed / 2 + 0.1);
    scene.add(btnPanel);
  }
}

export function buildElevatorCab(scene: THREE.Group): {
  cab: THREE.Group;
  doorL: THREE.Mesh;
  doorR: THREE.Mesh;
} {
  const ex = ELEVATOR.x;
  const ez = ELEVATOR.z;
  const ew = ELEVATOR.width;
  const ed = ELEVATOR.depth;

  const cabGroup = new THREE.Group();

  // Cab floor
  const cabFloor = box(ew - 0.1, 0.08, ed - 0.1, 0x2a2a4a);
  cabFloor.position.set(0, 0.04, 0);
  cabGroup.add(cabFloor);

  // Cab ceiling
  const cabCeil = box(ew - 0.1, 0.08, ed - 0.1, 0x1a1a3a);
  cabCeil.position.set(0, FLOOR_HEIGHT - 0.1, 0);
  cabGroup.add(cabCeil);

  // Cab walls (3 sides - front is doors)
  const cabBack = box(ew - 0.1, FLOOR_HEIGHT - 0.18, 0.08, COLORS.elevatorCab);
  cabBack.position.set(0, FLOOR_HEIGHT / 2, -ed / 2 + 0.1);
  cabGroup.add(cabBack);
  const cabLeft = box(0.08, FLOOR_HEIGHT - 0.18, ed - 0.1, COLORS.elevatorCab);
  cabLeft.position.set(-ew / 2 + 0.1, FLOOR_HEIGHT / 2, 0);
  cabGroup.add(cabLeft);
  const cabRight = box(0.08, FLOOR_HEIGHT - 0.18, ed - 0.1, COLORS.elevatorCab);
  cabRight.position.set(ew / 2 - 0.1, FLOOR_HEIGHT / 2, 0);
  cabGroup.add(cabRight);

  // Interior mirror panel (back wall)
  const mirror = box(ew - 0.3, FLOOR_HEIGHT * 0.6, 0.04, 0x3a4a6a, 0.7, true);
  mirror.position.set(0, FLOOR_HEIGHT * 0.5, -ed / 2 + 0.15);
  cabGroup.add(mirror);

  // Interior light
  const intLight = new THREE.PointLight(0xfff4e0, 0.8, 4);
  intLight.position.set(0, FLOOR_HEIGHT - 0.3, 0);
  cabGroup.add(intLight);

  // Floor number display panel
  const display = box(0.6, 0.3, 0.04, 0x0a0a1a);
  display.position.set(0, FLOOR_HEIGHT - 0.5, ed / 2 - 0.1);
  cabGroup.add(display);

  // Button panel inside cab
  const btnPanel = box(0.25, 1.2, 0.04, 0x1a1a3a);
  btnPanel.position.set(-ew / 2 + 0.15, FLOOR_HEIGHT * 0.5, ed / 2 - 0.1);
  cabGroup.add(btnPanel);
  for (let f = 0; f < BUILDING.floors; f++) {
    const btn = box(0.08, 0.08, 0.02, 0x3a5a8a);
    btn.position.set(-ew / 2 + 0.15, 0.3 + f * 0.13, ed / 2 - 0.08);
    cabGroup.add(btn);
  }

  // Doors (split in middle, slide apart)
  const doorH = FLOOR_HEIGHT - 0.18;
  const doorW = (ew - 0.1) / 2 - 0.02;

  const doorL = box(doorW, doorH, 0.08, COLORS.elevatorDoor) as THREE.Mesh;
  doorL.position.set(-doorW / 2 - 0.01, FLOOR_HEIGHT / 2, ed / 2 - 0.1);
  cabGroup.add(doorL);

  const doorR = box(doorW, doorH, 0.08, COLORS.elevatorDoor) as THREE.Mesh;
  doorR.position.set(doorW / 2 + 0.01, FLOOR_HEIGHT / 2, ed / 2 - 0.1);
  cabGroup.add(doorR);

  cabGroup.position.set(ex, 0, ez);
  scene.add(cabGroup);

  return { cab: cabGroup, doorL, doorR };
}

// ─── Scene Builder ─────────────────────────────────────────────────────────────
export function buildScene(scene: THREE.Scene): {
  buildingGroup: THREE.Group;
  interiorGroup: THREE.Group;
  elevatorCab: THREE.Group;
  elevatorDoorL: THREE.Mesh;
  elevatorDoorR: THREE.Mesh;
} {
  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshLambertMaterial({ color: COLORS.ground });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);

  // Grid lines on ground
  const gridHelper = new THREE.GridHelper(100, 50, 0x1a2a3a, 0x0d1a2a);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  // Building group (exterior GLB)
  const buildingGroup = new THREE.Group();
  scene.add(buildingGroup);

  // Interior group
  const interiorGroup = new THREE.Group();
  scene.add(interiorGroup);

  // Build all 9 floors
  for (let f = 0; f < BUILDING.floors; f++) {
    buildFloorInterior(f, interiorGroup);
  }

  // Build windows
  buildWindows(interiorGroup);

  // Build elevator shaft
  buildElevatorShaft(interiorGroup);

  // Build elevator cab
  const { cab, doorL, doorR } = buildElevatorCab(interiorGroup);

  // Ambient city lights around building
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const r = 30;
    const cityLight = new THREE.PointLight(0x003366, 1.0, 25);
    cityLight.position.set(Math.cos(angle) * r, 5, Math.sin(angle) * r);
    scene.add(cityLight);
  }

  // Ground-level neon accent lights
  const neonColors = [0x00d4ff, 0x0066ff, 0x00ffaa, 0xff6600];
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const neon = new THREE.PointLight(neonColors[i], 2.0, 15);
    neon.position.set(
      BUILDING.centerX + Math.cos(angle) * 12,
      1,
      BUILDING.centerZ + Math.sin(angle) * 10
    );
    scene.add(neon);
  }

  // Rooftop beacon
  const beacon = new THREE.PointLight(0x00d4ff, 3.0, 30);
  beacon.position.set(BUILDING.centerX, BUILDING.height + 2, BUILDING.centerZ);
  scene.add(beacon);

  return {
    buildingGroup,
    interiorGroup,
    elevatorCab: cab,
    elevatorDoorL: doorL,
    elevatorDoorR: doorR,
  };
}

// ─── Elevator Animation ────────────────────────────────────────────────────────
export function updateElevator(
  state: ElevatorState,
  cab: THREE.Group,
  doorL: THREE.Mesh,
  doorR: THREE.Mesh,
  delta: number
): ElevatorState {
  const s = { ...state };
  const targetY = s.targetFloor * FLOOR_HEIGHT;
  const doorW = (ELEVATOR.width - 0.1) / 2 - 0.02;
  const maxDoorSlide = doorW * 0.95;

  // Door animation
  if (s.doorState === 'opening') {
    s.doorOpenAmount = Math.min(1, s.doorOpenAmount + delta * 1.5);
    if (s.doorOpenAmount >= 1) {
      s.doorState = 'open';
      s.doorTimer = 0;
    }
  } else if (s.doorState === 'open') {
    s.doorTimer += delta;
    if (s.isMoving || s.doorTimer > 3.0) {
      s.doorState = 'closing';
    }
  } else if (s.doorState === 'closing') {
    s.doorOpenAmount = Math.max(0, s.doorOpenAmount - delta * 1.5);
    if (s.doorOpenAmount <= 0) {
      s.doorState = 'closed';
      if (s.currentFloor !== s.targetFloor) {
        s.isMoving = true;
      }
    }
  }

  // Apply door positions
  const slide = s.doorOpenAmount * maxDoorSlide;
  doorL.position.x = -doorW / 2 - 0.01 - slide;
  doorR.position.x = doorW / 2 + 0.01 + slide;

  // Elevator movement
  if (s.isMoving && s.doorState === 'closed') {
    const speed = 4.0;
    const diff = targetY - s.cabY;
    if (Math.abs(diff) < 0.05) {
      s.cabY = targetY;
      s.currentFloor = s.targetFloor;
      s.isMoving = false;
      s.doorState = 'opening';
    } else {
      s.cabY += Math.sign(diff) * Math.min(speed * delta, Math.abs(diff));
    }
  }

  cab.position.y = s.cabY;

  return s;
}

// ─── Camera / Navigation ───────────────────────────────────────────────────────
export interface CameraState {
  mode: 'exterior' | 'interior';
  floor: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  isInElevator: boolean;
}

export function getFloorCameraY(floor: number): number {
  return floor * FLOOR_HEIGHT + 1.7; // eye height
}

export function getDefaultExteriorCamera(): { position: THREE.Vector3; target: THREE.Vector3 } {
  return {
    position: new THREE.Vector3(30, 20, 35),
    target: new THREE.Vector3(BUILDING.centerX, BUILDING.height / 2, BUILDING.centerZ),
  };
}
