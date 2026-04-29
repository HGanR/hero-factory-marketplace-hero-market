/**
 * ModernBuilding.ts
 * High-poly procedural modern office building matching the reference image:
 * - 2-floor structure with curtain-wall glass facade
 * - Dark aluminum window frames
 * - Cream/beige concrete panel cladding
 * - Warm interior lighting visible through glass
 * - Landscaping: trees, hedges, paved ground
 * - Elevator shaft on right side
 */

import * as THREE from 'three';

// ─── Building Dimensions ─────────────────────────────────────────────────────
export const B = {
  width: 20,       // X
  depth: 14,       // Z
  floorH: 4.2,     // height per floor
  floors: 2,
  wallThick: 0.22,
  cx: 0,
  cz: 0,
};
export const TOTAL_H = B.floorH * B.floors;

// Elevator
export const ELEV = {
  x: B.cx + B.width / 2 - 2.0,
  z: B.cz,
  w: 2.2,
  d: 2.2,
  shaftH: TOTAL_H + 0.5,
};

// ─── Color Palette ────────────────────────────────────────────────────────────
const C = {
  concrete:    0xd4cfc8,   // cream/beige panels
  concreteDk:  0xb8b2aa,   // darker concrete
  frame:       0x2c3340,   // dark charcoal aluminum frames
  frameDk:     0x1a1f28,
  glass:       0x7ab3d4,   // blue-tinted glass
  glassInt:    0xfff8e8,   // warm interior glow
  ground:      0xc8c4bc,   // light grey pavement
  groundLine:  0xb0aba3,
  grass:       0x5a7a3a,
  hedge:       0x3d6b2a,
  bark:        0x6b4a2a,
  foliage:     0x4a8a30,
  foliage2:    0x5a9a40,
  interior:    0xfff4e0,   // warm cream interior walls
  ceiling:     0xf0ece4,
  carpet:      0xe8e0d0,
  desk:        0x8b7355,
  deskTop:     0xc4a96a,
  chair:       0x3a3a4a,
  metal:       0x8a8a9a,
  elevator:    0x4a4a5a,
  elevDoor:    0x6a6a7a,
  signage:     0x1a2a3a,
  roofEdge:    0x3a3a4a,
  sky:         0xd4e8f4,
  sunlight:    0xfff8e8,
  shadow:      0x2a2a3a,
};

// ─── Material Helpers ─────────────────────────────────────────────────────────
function mat(color: number, rough = 0.7, metal = 0, opacity = 1, transparent = false): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, opacity, transparent, side: transparent ? THREE.DoubleSide : THREE.FrontSide });
}

function box(w: number, h: number, d: number, m: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, 1, 1), m);
}

function boxSeg(w: number, h: number, d: number, ws: number, hs: number, ds: number, m: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d, ws, hs, ds), m);
}

// ─── Main Builder ─────────────────────────────────────────────────────────────
export function buildModernBuilding(scene: THREE.Scene | THREE.Group): { cab: THREE.Group; doors: THREE.Mesh[] } {
  const root = new THREE.Group();
  root.name = 'building_root';

  buildGround(root);
  buildExteriorShell(root);
  buildCurtainWallFacade(root);
  buildInterior(root);
  const { cab, doors } = buildElevatorShaft(root);
  buildRoof(root);
  buildLandscaping(root);
  buildEntrance(root);

  scene.add(root);
  return { cab, doors };
}

// ─── Ground Plane ─────────────────────────────────────────────────────────────
function buildGround(g: THREE.Group) {
  // Main pavement
  const pave = boxSeg(60, 0.15, 50, 6, 1, 5, mat(C.ground, 0.9, 0));
  pave.position.set(0, -0.075, 0);
  pave.receiveShadow = true;
  g.add(pave);

  // Pavement grid lines (subtle)
  for (let x = -25; x <= 25; x += 5) {
    const line = box(0.05, 0.02, 50, mat(C.groundLine, 1, 0));
    line.position.set(x, 0.01, 0);
    g.add(line);
  }
  for (let z = -20; z <= 20; z += 5) {
    const line = box(60, 0.02, 0.05, mat(C.groundLine, 1, 0));
    line.position.set(0, 0.01, z);
    g.add(line);
  }

  // Grass border
  const grassL = box(10, 0.12, 50, mat(C.grass, 0.95, 0));
  grassL.position.set(-35, 0.06, 0);
  g.add(grassL);
  const grassR = box(10, 0.12, 50, mat(C.grass, 0.95, 0));
  grassR.position.set(35, 0.06, 0);
  g.add(grassR);
}

// ─── Exterior Shell ───────────────────────────────────────────────────────────
function buildExteriorShell(g: THREE.Group) {
  const concMat = mat(C.concrete, 0.85, 0.05);
  const concDkMat = mat(C.concreteDk, 0.85, 0.05);
  const frameMat = mat(C.frame, 0.4, 0.6);

  const W = B.width, D = B.depth, H = TOTAL_H;
  const cx = B.cx, cz = B.cz;

  // ── Back wall (solid concrete) ──
  const backWall = boxSeg(W, H, B.wallThick, 8, 4, 1, concMat);
  backWall.position.set(cx, H / 2, cz - D / 2 + B.wallThick / 2);
  backWall.castShadow = true;
  g.add(backWall);

  // ── Left wall (solid concrete with horizontal banding) ──
  const leftWall = boxSeg(B.wallThick, H, D, 1, 4, 6, concMat);
  leftWall.position.set(cx - W / 2 + B.wallThick / 2, H / 2, cz);
  leftWall.castShadow = true;
  g.add(leftWall);

  // Horizontal banding strips on left wall
  for (let f = 0; f < B.floors; f++) {
    const band = box(0.3, 0.25, D, mat(C.frame, 0.4, 0.7));
    band.position.set(cx - W / 2 + 0.15, f * B.floorH + B.floorH - 0.12, cz);
    g.add(band);
  }

  // ── Right wall (partial concrete, rest is glass) ──
  // Top concrete strip
  const rightTop = box(B.wallThick, 0.6, D, concDkMat);
  rightTop.position.set(cx + W / 2 - B.wallThick / 2, H - 0.3, cz);
  g.add(rightTop);

  // ── Floor separators (exterior horizontal bands) ──
  const bandMat = mat(C.frame, 0.3, 0.8);
  for (let f = 1; f < B.floors; f++) {
    const band = box(W + 0.1, 0.35, D + 0.1, bandMat);
    band.position.set(cx, f * B.floorH, cz);
    g.add(band);
  }

  // ── Parapet / roof edge ──
  const parapet = box(W + 0.2, 0.5, D + 0.2, mat(C.roofEdge, 0.5, 0.5));
  parapet.position.set(cx, H + 0.25, cz);
  g.add(parapet);

  // ── Corner columns ──
  const colMat = mat(C.frame, 0.3, 0.7);
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as [number, number][]) {
    const col = box(0.4, H + 0.5, 0.4, colMat);
    col.position.set(cx + sx * (W / 2 - 0.2), H / 2, cz + sz * (D / 2 - 0.2));
    col.castShadow = true;
    g.add(col);
  }

  // ── Vertical frame mullions on facade ──
  const mullionCount = 6;
  const mullionSpacing = W / (mullionCount + 1);
  for (let i = 1; i <= mullionCount; i++) {
    const mx = cx - W / 2 + i * mullionSpacing;
    const mullion = box(0.12, H, 0.12, frameMat);
    mullion.position.set(mx, H / 2, cz + D / 2 - 0.06);
    g.add(mullion);
  }
}

// ─── Curtain Wall Glass Facade (Front) ───────────────────────────────────────
function buildCurtainWallFacade(g: THREE.Group) {
  const W = B.width, D = B.depth, H = TOTAL_H;
  const cx = B.cx, cz = B.cz;

  const glassMat = mat(C.glass, 0.05, 0.9, 0.55, true);
  const glassIntMat = mat(C.glassInt, 0.1, 0.1, 0.3, true);
  const frameMat = mat(C.frame, 0.3, 0.8);
  const frameDkMat = mat(C.frameDk, 0.2, 0.9);

  // ── Full-height curtain wall panels (front face) ──
  // Divided into sections by mullions
  const sections = [
    { x: cx - W / 2 + 2.5, w: 4.5 },   // left section (solid-ish with horizontal bars)
    { x: cx - W / 2 + 8.5, w: 7.0 },   // center-left large glass
    { x: cx + W / 2 - 4.0, w: 5.5 },   // right large glass
  ];

  for (const sec of sections) {
    // Glass panel
    const glass = box(sec.w - 0.15, H - 0.5, 0.08, glassMat);
    glass.position.set(sec.x, H / 2, cz + D / 2 + 0.04);
    g.add(glass);

    // Interior warm glow layer (slightly behind glass)
    const glow = box(sec.w - 0.2, H - 0.6, 0.04, glassIntMat);
    glow.position.set(sec.x, H / 2, cz + D / 2 - 0.05);
    g.add(glow);

    // Horizontal frame bars per floor
    for (let f = 0; f <= B.floors; f++) {
      const bar = box(sec.w, 0.18, 0.18, frameMat);
      bar.position.set(sec.x, f * B.floorH + (f === 0 ? 0.09 : 0), cz + D / 2 + 0.09);
      g.add(bar);
    }

    // Mid-floor horizontal bar
    for (let f = 0; f < B.floors; f++) {
      const midBar = box(sec.w, 0.1, 0.12, frameDkMat);
      midBar.position.set(sec.x, f * B.floorH + B.floorH * 0.5, cz + D / 2 + 0.06);
      g.add(midBar);
    }
  }

  // ── Left section: horizontal louver/brise-soleil ──
  const louverSec = sections[0];
  for (let f = 0; f < B.floors; f++) {
    const louverCount = 5;
    for (let l = 0; l < louverCount; l++) {
      const ly = f * B.floorH + 0.5 + l * (B.floorH - 0.5) / louverCount;
      const louver = box(louverSec.w - 0.2, 0.06, 0.4, mat(C.frame, 0.3, 0.8));
      louver.position.set(louverSec.x, ly, cz + D / 2 + 0.3);
      louver.rotation.x = 0.2; // slight tilt
      g.add(louver);
    }
  }

  // ── Right section: full-height glass with interior visible ──
  // Already handled above, add extra detail: window sill ledges
  for (let f = 0; f < B.floors; f++) {
    const sill = box(sections[2].w, 0.08, 0.25, mat(C.concreteDk, 0.7, 0.1));
    sill.position.set(sections[2].x, f * B.floorH + 0.04, cz + D / 2 + 0.2);
    g.add(sill);
  }

  // ── Right wall glass (partial) ──
  for (let f = 0; f < B.floors; f++) {
    const rGlass = box(0.08, B.floorH - 0.5, D * 0.6, glassMat);
    rGlass.position.set(cx + W / 2 - 0.04, f * B.floorH + B.floorH / 2, cz);
    g.add(rGlass);

    // Frame for right glass
    const rFrame = box(0.15, B.floorH, D * 0.6, frameMat);
    rFrame.position.set(cx + W / 2 - 0.075, f * B.floorH + B.floorH / 2, cz);
    g.add(rFrame);
  }
}

// ─── Interior ─────────────────────────────────────────────────────────────────
function buildInterior(g: THREE.Group) {
  const W = B.width - B.wallThick * 2;
  const D = B.depth - B.wallThick * 2;
  const cx = B.cx, cz = B.cz;

  const floorMat = mat(C.carpet, 0.9, 0);
  const ceilMat = mat(C.ceiling, 0.8, 0);
  const wallMat = mat(C.interior, 0.85, 0);

  for (let f = 0; f < B.floors; f++) {
    const y = f * B.floorH;

    // Floor slab
    const floor = boxSeg(W, 0.15, D, 10, 1, 8, floorMat);
    floor.position.set(cx, y + 0.075, cz);
    floor.receiveShadow = true;
    g.add(floor);

    // Ceiling
    const ceil = boxSeg(W, 0.12, D, 10, 1, 8, ceilMat);
    ceil.position.set(cx, y + B.floorH - 0.06, cz);
    g.add(ceil);

    // Interior walls (back and sides)
    const wBack = box(W, B.floorH, B.wallThick, wallMat);
    wBack.position.set(cx, y + B.floorH / 2, cz - D / 2 + B.wallThick / 2);
    g.add(wBack);

    // ── Ceiling light fixtures ──
    const lightMat = mat(0xffffff, 0.1, 0.1);
    const lightCount = 4;
    for (let l = 0; l < lightCount; l++) {
      const lx = cx - W / 2 + 2 + l * (W - 4) / (lightCount - 1);
      const fixture = box(1.8, 0.06, 0.5, lightMat);
      fixture.position.set(lx, y + B.floorH - 0.1, cz);
      g.add(fixture);

      const light = new THREE.PointLight(0xfff8e8, 3.5, 12);
      light.position.set(lx, y + B.floorH - 0.3, cz);
      light.castShadow = false;
      g.add(light);
    }

    // ── Floor-specific furniture ──
    if (f === 0) buildLobbyInterior(g, cx, cz, y, W, D);
    if (f === 1) buildOfficeInterior(g, cx, cz, y, W, D);
  }
}

// ─── Lobby Interior ───────────────────────────────────────────────────────────
function buildLobbyInterior(g: THREE.Group, cx: number, cz: number, y: number, W: number, D: number) {
  // Reception desk — curved front, premium look
  const deskMat = mat(C.desk, 0.6, 0.1);
  const deskTopMat = mat(C.deskTop, 0.3, 0.3);

  // Main desk body
  const desk = boxSeg(5.5, 1.05, 1.4, 4, 2, 2, deskMat);
  desk.position.set(cx - 1, y + 0.525, cz - 1.5);
  desk.castShadow = true;
  g.add(desk);

  // Desk top surface
  const deskTop = boxSeg(5.7, 0.08, 1.6, 4, 1, 2, deskTopMat);
  deskTop.position.set(cx - 1, y + 1.08, cz - 1.5);
  g.add(deskTop);

  // Desk front panel (decorative)
  const deskFront = box(5.5, 0.8, 0.06, mat(C.frameDk, 0.3, 0.7));
  deskFront.position.set(cx - 1, y + 0.4, cz - 0.83);
  g.add(deskFront);

  // Monitors on desk
  for (const mx of [-2.5, 0.5]) {
    const monBase = box(0.2, 0.08, 0.2, mat(C.metal, 0.3, 0.8));
    monBase.position.set(cx + mx, y + 1.12, cz - 1.7);
    g.add(monBase);
    const monStem = box(0.05, 0.35, 0.05, mat(C.metal, 0.3, 0.8));
    monStem.position.set(cx + mx, y + 1.3, cz - 1.7);
    g.add(monStem);
    const monScreen = boxSeg(0.85, 0.55, 0.04, 2, 2, 1, mat(0x111122, 0.1, 0.3));
    monScreen.position.set(cx + mx, y + 1.65, cz - 1.72);
    g.add(monScreen);
    // Screen glow
    const screenGlow = box(0.78, 0.48, 0.02, mat(0x4488ff, 0.05, 0.1, 0.7, true));
    screenGlow.position.set(cx + mx, y + 1.65, cz - 1.70);
    g.add(screenGlow);
  }

  // Lobby seating area — modern sofas
  const sofaMat = mat(0x4a4a5a, 0.7, 0.1);
  const sofaCushMat = mat(0x6a6a7a, 0.6, 0.05);

  for (const [sx, sz, rot] of [[5, 1.5, 0], [5, -1.5, 0], [7.5, 0, Math.PI / 2]] as [number, number, number][]) {
    const sofaBase = boxSeg(2.2, 0.45, 0.85, 3, 1, 1, sofaMat);
    sofaBase.position.set(cx + sx, y + 0.225, cz + sz);
    sofaBase.rotation.y = rot;
    sofaBase.castShadow = true;
    g.add(sofaBase);

    const sofaBack = box(2.2, 0.55, 0.12, sofaMat);
    sofaBack.position.set(cx + sx, y + 0.7, cz + sz + (rot === 0 ? 0.42 : 0));
    sofaBack.rotation.y = rot;
    g.add(sofaBack);

    // Cushions
    for (let ci = 0; ci < 2; ci++) {
      const cush = box(0.9, 0.12, 0.7, sofaCushMat);
      const offset = (ci - 0.5) * 1.0;
      cush.position.set(cx + sx + (rot === 0 ? offset : 0), y + 0.5, cz + sz + (rot === 0 ? 0 : offset));
      cush.rotation.y = rot;
      g.add(cush);
    }
  }

  // Coffee table
  const ctMat = mat(0x2a2a3a, 0.3, 0.5);
  const ct = boxSeg(1.4, 0.06, 0.9, 2, 1, 2, ctMat);
  ct.position.set(cx + 5.5, y + 0.42, cz);
  g.add(ct);
  const ctLeg1 = box(0.06, 0.42, 0.06, ctMat);
  ctLeg1.position.set(cx + 4.9, y + 0.21, cz - 0.35);
  g.add(ctLeg1);
  const ctLeg2 = box(0.06, 0.42, 0.06, ctMat);
  ctLeg2.position.set(cx + 6.1, y + 0.21, cz + 0.35);
  g.add(ctLeg2);

  // Lobby plants — tall architectural plants
  for (const [px, pz] of [[-W / 2 + 1.2, -D / 2 + 1.2], [W / 2 - 1.5, -D / 2 + 1.2]] as [number, number][]) {
    buildTallPlant(g, cx + px, y, cz + pz);
  }

  // Lobby signage on back wall
  const signBg = box(3.5, 0.9, 0.08, mat(C.signage, 0.3, 0.5));
  signBg.position.set(cx, y + 2.8, cz - D / 2 + 0.2);
  g.add(signBg);
  const signLight = new THREE.PointLight(0x4488ff, 1.5, 4);
  signLight.position.set(cx, y + 2.8, cz - D / 2 + 0.5);
  g.add(signLight);

  // Floor accent strip (near entrance)
  const strip = box(B.width * 0.6, 0.02, 0.4, mat(C.frame, 0.2, 0.9));
  strip.position.set(cx, y + 0.16, cz + D / 2 - 1.5);
  g.add(strip);
}

// ─── Office Interior (Floor 2) ────────────────────────────────────────────────
function buildOfficeInterior(g: THREE.Group, cx: number, cz: number, y: number, W: number, D: number) {
  const deskMat = mat(C.desk, 0.6, 0.1);
  const deskTopMat = mat(C.deskTop, 0.3, 0.2);
  const chairMat = mat(0x2a2a3a, 0.7, 0.1);

  // Desk clusters — 3 rows
  const rows = [
    { z: cz - D / 2 + 2.5, count: 4 },
    { z: cz, count: 4 },
    { z: cz + D / 2 - 2.5, count: 3 },
  ];

  for (const row of rows) {
    const startX = cx - W / 2 + 2.5;
    for (let i = 0; i < row.count; i++) {
      const dx = startX + i * 3.8;
      if (dx > cx + W / 2 - 3.5) continue;

      // Desk
      const desk = boxSeg(1.7, 0.72, 0.85, 2, 1, 1, deskMat);
      desk.position.set(dx, y + 0.36, row.z);
      desk.castShadow = true;
      g.add(desk);
      const top = box(1.75, 0.06, 0.9, deskTopMat);
      top.position.set(dx, y + 0.75, row.z);
      g.add(top);

      // Monitor
      const monBase = box(0.15, 0.06, 0.15, mat(C.metal, 0.3, 0.8));
      monBase.position.set(dx, y + 0.81, row.z - 0.28);
      g.add(monBase);
      const monStem = box(0.04, 0.28, 0.04, mat(C.metal, 0.3, 0.8));
      monStem.position.set(dx, y + 0.95, row.z - 0.28);
      g.add(monStem);
      const monScreen = boxSeg(0.78, 0.5, 0.035, 2, 2, 1, mat(0x111122, 0.1, 0.3));
      monScreen.position.set(dx, y + 1.22, row.z - 0.29);
      g.add(monScreen);
      const screenGlow = box(0.72, 0.44, 0.02, mat(0x3366cc, 0.05, 0.1, 0.6, true));
      screenGlow.position.set(dx, y + 1.22, row.z - 0.27);
      g.add(screenGlow);

      // Chair
      const chairSeat = box(0.65, 0.08, 0.65, chairMat);
      chairSeat.position.set(dx, y + 0.48, row.z + 0.7);
      g.add(chairSeat);
      const chairBack = boxSeg(0.65, 0.65, 0.07, 2, 3, 1, mat(0x3a3a4a, 0.7, 0.1));
      chairBack.position.set(dx, y + 0.85, row.z + 0.7);
      g.add(chairBack);
      const chairLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.48, 8), mat(C.metal, 0.3, 0.8));
      chairLeg.position.set(dx, y + 0.24, row.z + 0.7);
      g.add(chairLeg);
    }
  }

  // Whiteboard / presentation wall
  const wb = boxSeg(4, 2.2, 0.05, 4, 4, 1, mat(0xf8f8f8, 0.9, 0));
  wb.position.set(cx + 2, y + 2.0, cz - D / 2 + 0.2);
  g.add(wb);
  const wbFrame = box(4.15, 2.35, 0.04, mat(C.frame, 0.3, 0.7));
  wbFrame.position.set(cx + 2, y + 2.0, cz - D / 2 + 0.16);
  g.add(wbFrame);

  // Bookshelf
  const shelfMat = mat(0x5a4a3a, 0.7, 0.05);
  const shelf = boxSeg(0.35, B.floorH * 0.75, D * 0.4, 1, 5, 4, shelfMat);
  shelf.position.set(cx - W / 2 + 0.4, y + B.floorH * 0.375, cz);
  g.add(shelf);

  // Books on shelf
  const bookColors = [0x8b1a1a, 0x1a5a8b, 0x2a8b3a, 0x8b7a1a, 0x5a1a8b, 0x1a7a7a];
  for (let bi = 0; bi < 18; bi++) {
    const bk = box(0.28, 0.28 + Math.random() * 0.15, 0.22, mat(bookColors[bi % bookColors.length], 0.8, 0));
    bk.position.set(cx - W / 2 + 0.42, y + 0.35 + bi * 0.28, cz - D * 0.15 + (bi % 3) * 0.22);
    g.add(bk);
  }
}

// ─── Elevator Shaft ───────────────────────────────────────────────────────────
export function buildElevatorShaft(g: THREE.Group): { cab: THREE.Group; doors: THREE.Mesh[] } {
  const shaftMat = mat(C.elevator, 0.5, 0.3);
  const doorMat = mat(C.elevDoor, 0.2, 0.8);
  const doorOpenMat = mat(0x3a3a5a, 0.2, 0.8);

  const ex = ELEV.x, ez = ELEV.z;
  const ew = ELEV.w, ed = ELEV.d;

  // Shaft walls
  const shaftBack = box(ew, ELEV.shaftH, B.wallThick, shaftMat);
  shaftBack.position.set(ex, ELEV.shaftH / 2, ez - ed / 2 + B.wallThick / 2);
  g.add(shaftBack);
  const shaftLeft = box(B.wallThick, ELEV.shaftH, ed, shaftMat);
  shaftLeft.position.set(ex - ew / 2 + B.wallThick / 2, ELEV.shaftH / 2, ez);
  g.add(shaftLeft);
  const shaftRight = box(B.wallThick, ELEV.shaftH, ed, shaftMat);
  shaftRight.position.set(ex + ew / 2 - B.wallThick / 2, ELEV.shaftH / 2, ez);
  g.add(shaftRight);

  // Door frame per floor
  const allDoors: THREE.Mesh[] = [];
  for (let f = 0; f < B.floors; f++) {
    const fy = f * B.floorH;
    const frameH = B.floorH - 0.3;

    // Door frame
    const frameTop = box(ew, 0.25, 0.12, mat(C.frame, 0.3, 0.8));
    frameTop.position.set(ex, fy + frameH + 0.125, ez + ed / 2 - 0.06);
    g.add(frameTop);
    const frameL = box(0.12, frameH, 0.12, mat(C.frame, 0.3, 0.8));
    frameL.position.set(ex - ew / 2 + 0.06, fy + frameH / 2, ez + ed / 2 - 0.06);
    g.add(frameL);
    const frameR = box(0.12, frameH, 0.12, mat(C.frame, 0.3, 0.8));
    frameR.position.set(ex + ew / 2 - 0.06, fy + frameH / 2, ez + ed / 2 - 0.06);
    g.add(frameR);

    // Two door panels (left and right)
    const doorW = (ew - 0.25) / 2;
    const doorL = box(doorW, frameH - 0.05, 0.07, doorMat);
    doorL.position.set(ex - doorW / 2 - 0.02, fy + (frameH - 0.05) / 2, ez + ed / 2 - 0.035);
    (doorL as any).userData = { isElevDoor: true, floor: f, side: 'left', closedX: ex - doorW / 2 - 0.02, openX: ex - ew / 2 + 0.04 };
    g.add(doorL);
    allDoors.push(doorL);

    const doorR = box(doorW, frameH - 0.05, 0.07, doorMat);
    doorR.position.set(ex + doorW / 2 + 0.02, fy + (frameH - 0.05) / 2, ez + ed / 2 - 0.035);
    (doorR as any).userData = { isElevDoor: true, floor: f, side: 'right', closedX: ex + doorW / 2 + 0.02, openX: ex + ew / 2 - 0.04 };
    g.add(doorR);
    allDoors.push(doorR);

    // Door indicator light
    const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mat(0x00ff88, 0.1, 0.3));
    indicator.position.set(ex, fy + frameH + 0.05, ez + ed / 2 + 0.1);
    g.add(indicator);
  }

  // Elevator cab
  const cab = new THREE.Group();
  cab.name = 'elevator_cab';

  const cabFloor = boxSeg(ew - 0.1, 0.1, ed - 0.1, 3, 1, 3, mat(C.deskTop, 0.3, 0.3));
  cabFloor.position.set(0, 0.05, 0);
  cab.add(cabFloor);

  const cabCeil = box(ew - 0.1, 0.1, ed - 0.1, mat(C.ceiling, 0.5, 0.1));
  cabCeil.position.set(0, B.floorH - 0.15, 0);
  cab.add(cabCeil);

  const cabWallMat = mat(0x3a3a4a, 0.4, 0.4);
  const cabWallL = box(0.06, B.floorH, ed - 0.1, cabWallMat);
  cabWallL.position.set(-ew / 2 + 0.08, B.floorH / 2, 0);
  cab.add(cabWallL);
  const cabWallR = box(0.06, B.floorH, ed - 0.1, cabWallMat);
  cabWallR.position.set(ew / 2 - 0.08, B.floorH / 2, 0);
  cab.add(cabWallR);
  const cabWallB = box(ew - 0.1, B.floorH, 0.06, cabWallMat);
  cabWallB.position.set(0, B.floorH / 2, -ed / 2 + 0.08);
  cab.add(cabWallB);

  // Cab interior light
  const cabLight = new THREE.PointLight(0xfff8e8, 2.5, 5);
  cabLight.position.set(0, B.floorH - 0.3, 0);
  cab.add(cabLight);

  // Control panel
  const panel = box(0.35, 0.8, 0.06, mat(C.metal, 0.3, 0.7));
  panel.position.set(ew / 2 - 0.12, B.floorH * 0.55, ed / 2 - 0.2);
  cab.add(panel);
  for (let f = 0; f < B.floors; f++) {
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12), mat(0xffcc44, 0.2, 0.5));
    btn.rotation.x = Math.PI / 2;
    btn.position.set(ew / 2 - 0.12, B.floorH * 0.7 - f * 0.18, ed / 2 - 0.17);
    cab.add(btn);
  }

  cab.position.set(ex, 0, ez);
  g.add(cab);

  return { cab, doors: allDoors };
}

// ─── Roof ─────────────────────────────────────────────────────────────────────
function buildRoof(g: THREE.Group) {
  const W = B.width, D = B.depth;
  const cx = B.cx, cz = B.cz;
  const y = TOTAL_H;

  // Flat roof surface
  const roof = boxSeg(W, 0.25, D, 8, 1, 6, mat(C.concreteDk, 0.9, 0));
  roof.position.set(cx, y + 0.125, cz);
  roof.castShadow = true;
  g.add(roof);

  // Rooftop HVAC units
  for (const [rx, rz] of [[-4, -2], [2, 3], [-6, 3]] as [number, number][]) {
    const hvac = box(1.5, 0.8, 1.0, mat(C.metal, 0.5, 0.4));
    hvac.position.set(cx + rx, y + 0.65, cz + rz);
    g.add(hvac);
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.15, 16), mat(C.frameDk, 0.3, 0.6));
    fan.position.set(cx + rx, y + 1.1, cz + rz);
    g.add(fan);
  }

  // Parapet detail
  const parapet = box(W + 0.4, 0.6, D + 0.4, mat(C.frame, 0.3, 0.6));
  parapet.position.set(cx, y + 0.55, cz);
  g.add(parapet);

  // Elevator penthouse
  const penthouse = box(ELEV.w + 0.4, 1.5, ELEV.d + 0.4, mat(C.concrete, 0.7, 0.1));
  penthouse.position.set(ELEV.x, y + 1.0, ELEV.z);
  g.add(penthouse);
}

// ─── Landscaping ─────────────────────────────────────────────────────────────
function buildLandscaping(g: THREE.Group) {
  const W = B.width, D = B.depth;
  const cx = B.cx, cz = B.cz;

  // Hedge row (front of building)
  const hedgeCount = 8;
  for (let i = 0; i < hedgeCount; i++) {
    const hx = cx - W / 2 + 1.2 + i * (W - 2.4) / (hedgeCount - 1);
    const hedge = boxSeg(1.1, 0.7, 0.55, 2, 2, 1, mat(C.hedge, 0.95, 0));
    hedge.position.set(hx, 0.35, cz + D / 2 + 1.2);
    hedge.castShadow = true;
    g.add(hedge);
  }

  // Trees (corners and sides)
  const treePositions: [number, number][] = [
    [-W / 2 - 2, D / 2 + 2],
    [W / 2 + 2, D / 2 + 2],
    [-W / 2 - 2, -D / 2 - 2],
    [W / 2 + 2, -D / 2 - 2],
    [-W / 2 - 5, 0],
    [W / 2 + 5, 0],
  ];
  for (const [tx, tz] of treePositions) {
    buildTree(g, cx + tx, cz + tz);
  }

  // Entrance path
  const path = box(4, 0.05, 4, mat(0xd8d0c8, 0.9, 0));
  path.position.set(cx, 0.025, cz + D / 2 + 2.5);
  g.add(path);

  // Entrance steps
  for (let s = 0; s < 3; s++) {
    const step = box(4, 0.12, 0.5, mat(C.concreteDk, 0.8, 0.1));
    step.position.set(cx, 0.06 + s * 0.12, cz + D / 2 + 0.25 - s * 0.5);
    g.add(step);
  }
}

// ─── Entrance ─────────────────────────────────────────────────────────────────
function buildEntrance(g: THREE.Group) {
  const cx = B.cx, cz = B.cz;
  const D = B.depth;

  // Glass entrance doors (double)
  const doorGlassMat = mat(C.glass, 0.05, 0.9, 0.5, true);
  const doorFrameMat = mat(C.frame, 0.2, 0.9);

  // Door frame
  const topFrame = box(3.2, 0.2, 0.12, doorFrameMat);
  topFrame.position.set(cx, B.floorH * 0.85, cz + D / 2 + 0.06);
  g.add(topFrame);
  const leftFrame = box(0.12, B.floorH * 0.85, 0.12, doorFrameMat);
  leftFrame.position.set(cx - 1.6, B.floorH * 0.425, cz + D / 2 + 0.06);
  g.add(leftFrame);
  const rightFrame = box(0.12, B.floorH * 0.85, 0.12, doorFrameMat);
  rightFrame.position.set(cx + 1.6, B.floorH * 0.425, cz + D / 2 + 0.06);
  g.add(rightFrame);
  const midFrame = box(0.1, B.floorH * 0.85, 0.1, doorFrameMat);
  midFrame.position.set(cx, B.floorH * 0.425, cz + D / 2 + 0.06);
  g.add(midFrame);

  // Glass panels
  const doorL = box(1.4, B.floorH * 0.82, 0.06, doorGlassMat);
  doorL.position.set(cx - 0.78, B.floorH * 0.41, cz + D / 2 + 0.06);
  g.add(doorL);
  const doorR = box(1.4, B.floorH * 0.82, 0.06, doorGlassMat);
  doorR.position.set(cx + 0.78, B.floorH * 0.41, cz + D / 2 + 0.06);
  g.add(doorR);

  // Door handles
  const handleMat = mat(C.metal, 0.1, 0.9);
  for (const hx of [-0.2, 0.2]) {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), handleMat);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(cx + hx, B.floorH * 0.42, cz + D / 2 + 0.1);
    g.add(handle);
  }

  // Canopy above entrance
  const canopy = boxSeg(4.5, 0.12, 1.5, 4, 1, 2, mat(C.frame, 0.3, 0.7, 0.85, true));
  canopy.position.set(cx, B.floorH * 0.9, cz + D / 2 + 0.75);
  g.add(canopy);

  // Canopy supports
  for (const sx of [-1.8, 1.8]) {
    const support = box(0.06, 0.5, 0.06, mat(C.frame, 0.2, 0.9));
    support.position.set(cx + sx, B.floorH * 0.9 - 0.25, cz + D / 2 + 1.4);
    g.add(support);
  }
}

// ─── Tree Helper ──────────────────────────────────────────────────────────────
function buildTree(g: THREE.Group, x: number, z: number) {
  const trunkH = 2.5 + Math.random() * 1.0;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, trunkH, 8), mat(C.bark, 0.9, 0));
  trunk.position.set(x, trunkH / 2, z);
  trunk.castShadow = true;
  g.add(trunk);

  // Foliage layers
  for (let l = 0; l < 3; l++) {
    const r = 0.9 - l * 0.15;
    const h = 1.2 - l * 0.1;
    const fy = trunkH + l * 0.6;
    const foliage = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10), mat(l % 2 === 0 ? C.foliage : C.foliage2, 0.9, 0));
    foliage.position.set(x, fy, z);
    foliage.castShadow = true;
    g.add(foliage);
  }
}

// ─── Tall Plant Helper ────────────────────────────────────────────────────────
function buildTallPlant(g: THREE.Group, x: number, y: number, z: number) {
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.45, 12), mat(0x8b6914, 0.7, 0.1));
  pot.position.set(x, y + 0.225, z);
  g.add(pot);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.8, 8), mat(C.foliage, 0.9, 0));
  stem.position.set(x, y + 0.45 + 0.9, z);
  g.add(stem);

  for (let l = 0; l < 5; l++) {
    const angle = (l / 5) * Math.PI * 2;
    const lx = x + Math.cos(angle) * 0.35;
    const lz = z + Math.sin(angle) * 0.35;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), mat(C.foliage, 0.9, 0));
    leaf.scale.set(1, 0.4, 1);
    leaf.position.set(lx, y + 1.8 + l * 0.12, lz);
    g.add(leaf);
  }

  const topLeaf = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), mat(C.foliage2, 0.9, 0));
  topLeaf.scale.set(1, 0.5, 1);
  topLeaf.position.set(x, y + 2.5, z);
  g.add(topLeaf);
}
