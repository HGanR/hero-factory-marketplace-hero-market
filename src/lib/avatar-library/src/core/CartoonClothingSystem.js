/**
 * CartoonClothingSystem.js — Fitted cartoon clothing that wraps the body
 *
 * Builds clothing layers that closely follow the body mesh proportions.
 * Each garment is built as a separate group so it can be swapped independently.
 * Clothing uses MeshToonMaterial for the cartoon shading look.
 */

import * as THREE from 'three';

// ─── Material helpers ─────────────────────────────────────────────────────────

function clothMat(hex, opts = {}) {
  return new THREE.MeshToonMaterial({ color: new THREE.Color(hex), roughness: 0.7, ...opts });
}

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function ovalSphere(rx, ry, rz, seg = 14) {
  const g = new THREE.SphereGeometry(1, seg, Math.floor(seg * 0.75));
  g.scale(rx, ry, rz);
  return g;
}

function taperedCyl(rTop, rBot, height, radSeg = 16, hSeg = 4) {
  return new THREE.CylinderGeometry(rTop, rBot, height, radSeg, hSeg);
}

// ─── Body proportions (must match CartoonBodyMesh.js P constants) ─────────────
const P = {
  chestY: 1.195, chestRTop: 0.175, chestH: 0.320,
  waistY: 0.960, waistRTop: 0.145, waistH: 0.130,
  hipsY:  0.840, hipsRTop:  0.160, hipsH:  0.140,
  upperArmX: 0.340, upperArmY: 1.260, upperArmR: 0.058, upperArmH: 0.220,
  lowerArmX: 0.545, lowerArmY: 1.260, lowerArmR: 0.046, lowerArmH: 0.200,
  thighX: 0.130, thighY: 0.620, thighR: 0.088, thighH: 0.280,
  shinX:  0.130, shinY:  0.240, shinR:  0.062, shinH:  0.250,
  ankleX: 0.130, ankleY: 0.075,
};

// ─── Shirt styles ─────────────────────────────────────────────────────────────

const SHIRT_STYLES = {

  // ── Jersey / T-Shirt (reference style) ──────────────────────────────────────
  jersey(group, color, accentColor) {
    const mat    = clothMat(color);
    const accent = clothMat(accentColor || '#c8b560');

    // Body — slightly larger than chest to sit on top
    const bodyGeo = taperedCyl(P.chestRTop + 0.008, P.waistRTop + 0.006, P.chestH + P.waistH, 20, 6);
    group.add(mesh(bodyGeo, mat, 0, P.chestY - P.waistH / 2, 0));

    // Collar
    const collarGeo = new THREE.TorusGeometry(0.065, 0.014, 8, 20);
    group.add(mesh(collarGeo, mat, 0, P.chestY + P.chestH / 2 - 0.015, 0));

    // Short sleeves (T-pose: horizontal)
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const sleeveGeo = taperedCyl(P.upperArmR + 0.012, P.upperArmR + 0.006, 0.110, 14, 4);
      const sm = mesh(sleeveGeo, mat, sx * (P.upperArmX - 0.055), P.upperArmY, 0);
      sm.rotation.z = sx * (Math.PI / 2);
      group.add(sm);
      // Sleeve accent stripe
      const stripeGeo = new THREE.TorusGeometry(P.upperArmR + 0.014, 0.008, 6, 16);
      const stripe = mesh(stripeGeo, accent, sx * (P.upperArmX - 0.055 + 0.040), P.upperArmY, 0);
      stripe.rotation.z = sx * (Math.PI / 2);
      group.add(stripe);
    }

    // Star logo on chest
    const starShape = new THREE.Shape();
    const starR = 0.042, starInner = 0.018, starPts = 5;
    for (let i = 0; i < starPts * 2; i++) {
      const a = (i / (starPts * 2)) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? starR : starInner;
      const sx2 = Math.cos(a) * r, sy2 = Math.sin(a) * r;
      if (i === 0) starShape.moveTo(sx2, sy2); else starShape.lineTo(sx2, sy2);
    }
    starShape.closePath();
    const starGeo = new THREE.ShapeGeometry(starShape);
    const starMesh = mesh(starGeo, accent, 0, P.chestY + 0.040, P.chestRTop + 0.009);
    group.add(starMesh);

    // Bottom hem
    const hemGeo = new THREE.TorusGeometry(P.waistRTop + 0.006, 0.008, 6, 20);
    group.add(mesh(hemGeo, accent, 0, P.chestY - P.chestH / 2 - P.waistH + 0.010, 0));
  },

  // ── Hoodie ────────────────────────────────────────────────────────────────────
  hoodie(group, color) {
    const mat = clothMat(color);
    const dark = clothMat(new THREE.Color(color).multiplyScalar(0.75).getHexString().padStart(6, '0').replace(/^/, '#'));

    const bodyGeo = taperedCyl(P.chestRTop + 0.012, P.waistRTop + 0.010, P.chestH + P.waistH + 0.020, 20, 6);
    group.add(mesh(bodyGeo, mat, 0, P.chestY - P.waistH / 2, 0));

    // Hood
    const hoodGeo = ovalSphere(0.155, 0.130, 0.140, 18);
    group.add(mesh(hoodGeo, mat, 0, P.chestY + P.chestH / 2 + 0.060, -0.040));

    // Kangaroo pocket
    const pocketGeo = new THREE.BoxGeometry(0.160, 0.072, 0.012);
    group.add(mesh(pocketGeo, dark, 0, P.chestY - P.chestH / 2 + 0.010, P.chestRTop + 0.005));

    // Long sleeves
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const upperGeo = taperedCyl(P.upperArmR + 0.014, P.upperArmR + 0.008, P.upperArmH + 0.020, 14, 4);
      const um = mesh(upperGeo, mat, sx * P.upperArmX, P.upperArmY, 0);
      um.rotation.z = sx * (Math.PI / 2);
      group.add(um);

      const lowerGeo = taperedCyl(P.lowerArmR + 0.012, P.lowerArmR + 0.006, P.lowerArmH + 0.020, 12, 4);
      const lm = mesh(lowerGeo, mat, sx * P.lowerArmX, P.lowerArmY, 0);
      lm.rotation.z = sx * (Math.PI / 2);
      group.add(lm);

      // Cuff
      const cuffGeo = new THREE.TorusGeometry(P.lowerArmR + 0.008, 0.010, 6, 16);
      const cuff = mesh(cuffGeo, dark, sx * (P.lowerArmX + P.lowerArmH / 2 - 0.010), P.lowerArmY, 0);
      cuff.rotation.z = sx * (Math.PI / 2);
      group.add(cuff);
    }
  },

  // ── Crop Top ──────────────────────────────────────────────────────────────────
  cropTop(group, color) {
    const mat = clothMat(color);
    const bodyGeo = taperedCyl(P.chestRTop + 0.006, P.waistRTop + 0.004, P.chestH * 0.65, 20, 4);
    group.add(mesh(bodyGeo, mat, 0, P.chestY + 0.040, 0));

    // Thin straps
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const strapGeo = new THREE.BoxGeometry(0.018, 0.080, 0.008);
      group.add(mesh(strapGeo, mat, sx * 0.055, P.chestY + P.chestH / 2 - 0.010, P.chestRTop * 0.85));
    }
  },

  // ── Tank Top ──────────────────────────────────────────────────────────────────
  tankTop(group, color) {
    const mat = clothMat(color);
    const bodyGeo = taperedCyl(P.chestRTop + 0.007, P.waistRTop + 0.005, P.chestH + P.waistH, 20, 6);
    group.add(mesh(bodyGeo, mat, 0, P.chestY - P.waistH / 2, 0));
    // Wide straps
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const strapGeo = new THREE.BoxGeometry(0.040, 0.060, 0.010);
      group.add(mesh(strapGeo, mat, sx * 0.070, P.chestY + P.chestH / 2 - 0.010, P.chestRTop * 0.88));
    }
  },

  // ── Turtleneck ────────────────────────────────────────────────────────────────
  turtleneck(group, color) {
    const mat = clothMat(color);
    const bodyGeo = taperedCyl(P.chestRTop + 0.010, P.waistRTop + 0.008, P.chestH + P.waistH, 20, 6);
    group.add(mesh(bodyGeo, mat, 0, P.chestY - P.waistH / 2, 0));
    // Turtleneck collar
    const neckGeo = taperedCyl(0.072, 0.068, 0.090, 16, 3);
    group.add(mesh(neckGeo, mat, 0, 1.555, 0));
    // Long sleeves
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const ug = taperedCyl(P.upperArmR + 0.012, P.upperArmR + 0.006, P.upperArmH, 14, 4);
      const um = mesh(ug, mat, sx * P.upperArmX, P.upperArmY, 0);
      um.rotation.z = sx * (Math.PI / 2);
      group.add(um);
      const lg = taperedCyl(P.lowerArmR + 0.010, P.lowerArmR + 0.004, P.lowerArmH, 12, 4);
      const lm = mesh(lg, mat, sx * P.lowerArmX, P.lowerArmY, 0);
      lm.rotation.z = sx * (Math.PI / 2);
      group.add(lm);
    }
  },

  // ── Polo ─────────────────────────────────────────────────────────────────────
  polo(group, color, accentColor) {
    const mat    = clothMat(color);
    const accent = clothMat(accentColor || '#ffffff');
    const bodyGeo = taperedCyl(P.chestRTop + 0.008, P.waistRTop + 0.006, P.chestH + P.waistH, 20, 6);
    group.add(mesh(bodyGeo, mat, 0, P.chestY - P.waistH / 2, 0));
    // Collar
    const collarGeo = new THREE.BoxGeometry(0.110, 0.048, 0.010);
    group.add(mesh(collarGeo, accent, 0, P.chestY + P.chestH / 2 - 0.010, P.chestRTop * 0.85));
    // Short sleeves
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const sg = taperedCyl(P.upperArmR + 0.010, P.upperArmR + 0.004, 0.100, 14, 3);
      const sm = mesh(sg, mat, sx * (P.upperArmX - 0.060), P.upperArmY, 0);
      sm.rotation.z = sx * (Math.PI / 2);
      group.add(sm);
    }
    // Stripe
    const stripeGeo = new THREE.BoxGeometry(0.008, P.chestH + P.waistH, 0.012);
    group.add(mesh(stripeGeo, accent, P.chestRTop * 0.6, P.chestY - P.waistH / 2, P.chestRTop + 0.005));
  },
};

// ─── Jacket styles ────────────────────────────────────────────────────────────

const JACKET_STYLES = {

  // ── Bomber ────────────────────────────────────────────────────────────────────
  bomber(group, color, accentColor) {
    const mat    = clothMat(color);
    const accent = clothMat(accentColor || '#c8b560');

    const bodyGeo = taperedCyl(P.chestRTop + 0.018, P.waistRTop + 0.016, P.chestH + P.waistH + 0.010, 20, 6);
    group.add(mesh(bodyGeo, mat, 0, P.chestY - P.waistH / 2, 0));

    // Ribbed hem
    const hemGeo = taperedCyl(P.waistRTop + 0.018, P.waistRTop + 0.016, 0.040, 20, 3);
    group.add(mesh(hemGeo, accent, 0, P.chestY - P.chestH / 2 - P.waistH - 0.010, 0));

    // Collar
    const collarGeo = taperedCyl(0.082, 0.075, 0.055, 16, 3);
    group.add(mesh(collarGeo, accent, 0, P.chestY + P.chestH / 2 - 0.010, 0));

    // Sleeves
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const ug = taperedCyl(P.upperArmR + 0.018, P.upperArmR + 0.012, P.upperArmH + 0.020, 14, 4);
      const um = mesh(ug, mat, sx * P.upperArmX, P.upperArmY, 0);
      um.rotation.z = sx * (Math.PI / 2);
      group.add(um);
      const lg = taperedCyl(P.lowerArmR + 0.016, P.lowerArmR + 0.010, P.lowerArmH + 0.020, 12, 4);
      const lm = mesh(lg, mat, sx * P.lowerArmX, P.lowerArmY, 0);
      lm.rotation.z = sx * (Math.PI / 2);
      group.add(lm);
      // Ribbed cuff
      const cuffGeo = taperedCyl(P.lowerArmR + 0.012, P.lowerArmR + 0.010, 0.032, 12, 3);
      const cm = mesh(cuffGeo, accent, sx * (P.lowerArmX + P.lowerArmH / 2 + 0.005), P.lowerArmY, 0);
      cm.rotation.z = sx * (Math.PI / 2);
      group.add(cm);
    }
  },

  // ── Denim Jacket ─────────────────────────────────────────────────────────────
  denim(group, color) {
    const mat  = clothMat(color || '#3a5a8a');
    const dark = clothMat(new THREE.Color(color || '#3a5a8a').multiplyScalar(0.70).getStyle());

    const bodyGeo = taperedCyl(P.chestRTop + 0.016, P.waistRTop + 0.014, P.chestH + 0.020, 20, 6);
    group.add(mesh(bodyGeo, mat, 0, P.chestY, 0));

    // Lapels
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const lapelGeo = new THREE.BoxGeometry(0.055, 0.110, 0.012);
      const lm = mesh(lapelGeo, dark, sx * 0.040, P.chestY + 0.060, P.chestRTop + 0.004);
      lm.rotation.z = sx * 0.18;
      group.add(lm);
    }

    // Pockets
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const pGeo = new THREE.BoxGeometry(0.058, 0.048, 0.010);
      group.add(mesh(pGeo, dark, sx * 0.090, P.chestY - 0.060, P.chestRTop + 0.004));
    }

    // Sleeves
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const ug = taperedCyl(P.upperArmR + 0.016, P.upperArmR + 0.010, P.upperArmH, 14, 4);
      const um = mesh(ug, mat, sx * P.upperArmX, P.upperArmY, 0);
      um.rotation.z = sx * (Math.PI / 2);
      group.add(um);
      const lg = taperedCyl(P.lowerArmR + 0.014, P.lowerArmR + 0.008, P.lowerArmH, 12, 4);
      const lm = mesh(lg, mat, sx * P.lowerArmX, P.lowerArmY, 0);
      lm.rotation.z = sx * (Math.PI / 2);
      group.add(lm);
    }
  },

  // ── Leather Jacket ────────────────────────────────────────────────────────────
  leather(group, color) {
    const mat  = clothMat(color || '#1a1a1a');
    const shiny = clothMat(new THREE.Color(color || '#1a1a1a').lerp(new THREE.Color('#ffffff'), 0.15).getStyle());

    const bodyGeo = taperedCyl(P.chestRTop + 0.018, P.waistRTop + 0.016, P.chestH + P.waistH + 0.020, 20, 6);
    group.add(mesh(bodyGeo, mat, 0, P.chestY - P.waistH / 2, 0));

    // Asymmetric zip line
    const zipGeo = new THREE.BoxGeometry(0.006, P.chestH + P.waistH, 0.012);
    const zm = mesh(zipGeo, shiny, 0.030, P.chestY - P.waistH / 2, P.chestRTop + 0.008);
    zm.rotation.z = 0.08;
    group.add(zm);

    // Collar
    const collarGeo = taperedCyl(0.090, 0.082, 0.060, 16, 3);
    group.add(mesh(collarGeo, mat, 0, P.chestY + P.chestH / 2 - 0.005, 0));

    // Sleeves
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const ug = taperedCyl(P.upperArmR + 0.018, P.upperArmR + 0.012, P.upperArmH, 14, 4);
      const um = mesh(ug, mat, sx * P.upperArmX, P.upperArmY, 0);
      um.rotation.z = sx * (Math.PI / 2);
      group.add(um);
      const lg = taperedCyl(P.lowerArmR + 0.016, P.lowerArmR + 0.010, P.lowerArmH, 12, 4);
      const lm = mesh(lg, mat, sx * P.lowerArmX, P.lowerArmY, 0);
      lm.rotation.z = sx * (Math.PI / 2);
      group.add(lm);
    }
  },

  // ── Varsity ───────────────────────────────────────────────────────────────────
  varsity(group, color, accentColor) {
    const mat    = clothMat(color || '#1a2a6c');
    const accent = clothMat(accentColor || '#f5f5f5');

    const bodyGeo = taperedCyl(P.chestRTop + 0.018, P.waistRTop + 0.016, P.chestH + P.waistH + 0.010, 20, 6);
    group.add(mesh(bodyGeo, mat, 0, P.chestY - P.waistH / 2, 0));

    // Contrast sleeves
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const ug = taperedCyl(P.upperArmR + 0.018, P.upperArmR + 0.012, P.upperArmH, 14, 4);
      const um = mesh(ug, accent, sx * P.upperArmX, P.upperArmY, 0);
      um.rotation.z = sx * (Math.PI / 2);
      group.add(um);
      const lg = taperedCyl(P.lowerArmR + 0.016, P.lowerArmR + 0.010, P.lowerArmH, 12, 4);
      const lm = mesh(lg, accent, sx * P.lowerArmX, P.lowerArmY, 0);
      lm.rotation.z = sx * (Math.PI / 2);
      group.add(lm);
    }

    // Collar + hem
    const collarGeo = taperedCyl(0.082, 0.076, 0.050, 16, 3);
    group.add(mesh(collarGeo, accent, 0, P.chestY + P.chestH / 2 - 0.008, 0));
    const hemGeo = taperedCyl(P.waistRTop + 0.018, P.waistRTop + 0.016, 0.038, 20, 3);
    group.add(mesh(hemGeo, accent, 0, P.chestY - P.chestH / 2 - P.waistH - 0.008, 0));
  },
};

// ─── Bottom styles ────────────────────────────────────────────────────────────

const BOTTOM_STYLES = {

  // ── Shorts ────────────────────────────────────────────────────────────────────
  shorts(group, color, accentColor) {
    const mat    = clothMat(color);
    const accent = clothMat(accentColor || new THREE.Color(color).multiplyScalar(0.75).getStyle());

    // Waistband
    const wbGeo = taperedCyl(P.hipsRTop + 0.010, P.hipsRTop + 0.008, 0.040, 20, 3);
    group.add(mesh(wbGeo, accent, 0, P.hipsY + P.hipsH / 2 + 0.010, 0));

    // Short legs
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const lg = taperedCyl(P.thighR + 0.010, P.thighR + 0.004, 0.160, 16, 4);
      group.add(mesh(lg, mat, sx * P.thighX, P.thighY + 0.060, 0));
      // Stripe
      const stripeGeo = new THREE.BoxGeometry(0.008, 0.160, P.thighR * 2 + 0.012);
      group.add(mesh(stripeGeo, accent, sx * (P.thighX + P.thighR + 0.002), P.thighY + 0.060, 0));
    }
  },

  // ── Jeans ─────────────────────────────────────────────────────────────────────
  jeans(group, color) {
    const mat  = clothMat(color || '#1e3a5f');
    const dark = clothMat(new THREE.Color(color || '#1e3a5f').multiplyScalar(0.72).getStyle());

    // Waistband
    const wbGeo = taperedCyl(P.hipsRTop + 0.012, P.hipsRTop + 0.010, 0.045, 20, 3);
    group.add(mesh(wbGeo, dark, 0, P.hipsY + P.hipsH / 2 + 0.012, 0));

    // Full legs
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const tg = taperedCyl(P.thighR + 0.012, P.thighR + 0.006, P.thighH, 16, 5);
      group.add(mesh(tg, mat, sx * P.thighX, P.thighY, 0));
      const sg = taperedCyl(P.shinR + 0.010, P.shinR + 0.004, P.shinH, 14, 4);
      group.add(mesh(sg, mat, sx * P.shinX, P.shinY, 0));
      // Seam line
      const seamGeo = new THREE.BoxGeometry(0.005, P.thighH + P.shinH, 0.008);
      group.add(mesh(seamGeo, dark, sx * (P.thighX + P.thighR + 0.002), P.thighY - P.thighH / 4, 0));
    }
  },

  // ── Skirt ─────────────────────────────────────────────────────────────────────
  skirt(group, color) {
    const mat = clothMat(color);
    // Flared skirt using tapered cylinder
    const skirtGeo = taperedCyl(P.hipsRTop + 0.010, P.hipsRTop + 0.090, 0.280, 24, 6);
    group.add(mesh(skirtGeo, mat, 0, P.hipsY - 0.060, 0));
    // Waistband
    const wbGeo = taperedCyl(P.hipsRTop + 0.012, P.hipsRTop + 0.010, 0.040, 20, 3);
    group.add(mesh(wbGeo, new THREE.MeshToonMaterial({ color: new THREE.Color(color).multiplyScalar(0.80) }), 0, P.hipsY + P.hipsH / 2 + 0.010, 0));
  },

  // ── Leggings ──────────────────────────────────────────────────────────────────
  leggings(group, color) {
    const mat = clothMat(color);
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const tg = taperedCyl(P.thighR + 0.006, P.thighR + 0.002, P.thighH, 16, 5);
      group.add(mesh(tg, mat, sx * P.thighX, P.thighY, 0));
      const sg = taperedCyl(P.shinR + 0.004, P.shinR + 0.001, P.shinH, 14, 4);
      group.add(mesh(sg, mat, sx * P.shinX, P.shinY, 0));
    }
    // Waistband
    const wbGeo = taperedCyl(P.hipsRTop + 0.008, P.hipsRTop + 0.006, 0.040, 20, 3);
    group.add(mesh(wbGeo, new THREE.MeshToonMaterial({ color: new THREE.Color(color).multiplyScalar(0.80) }), 0, P.hipsY + P.hipsH / 2 + 0.010, 0));
  },
};

// ─── Sock styles ─────────────────────────────────────────────────────────────

const SOCK_STYLES = {
  kneeSocks(group, color, stripeColor) {
    const mat    = clothMat(color);
    const stripe = clothMat(stripeColor || '#88ccff');
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      // Knee-high sock body
      const sg = taperedCyl(P.shinR + 0.008, P.shinR + 0.004, P.shinH + 0.040, 14, 4);
      group.add(mesh(sg, mat, sx * P.shinX, P.shinY - 0.020, 0));
      // Stripes at top
      for (let i = 0; i < 3; i++) {
        const stripeGeo = new THREE.TorusGeometry(P.shinR + 0.010, 0.007, 6, 16);
        group.add(mesh(stripeGeo, stripe, sx * P.shinX, P.shinY + P.shinH / 2 - 0.010 - i * 0.020, 0));
      }
    }
  },
  ankletSocks(group, color) {
    const mat = clothMat(color);
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const sg = taperedCyl(P.shinR + 0.006, P.shinR + 0.002, 0.080, 14, 3);
      group.add(mesh(sg, mat, sx * P.shinX, P.ankleY + 0.060, 0));
    }
  },
};

// ─── Shoe styles ─────────────────────────────────────────────────────────────

const SHOE_STYLES = {

  // ── Chunky Boots (reference style) ───────────────────────────────────────────
  chunkyBoots(group, color, accentColor) {
    const mat    = clothMat(color || '#0a1a3a');
    const sole   = clothMat('#1a1a1a');
    const accent = clothMat(accentColor || '#00aaff');
    const lace   = clothMat('#ffffff');

    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const bx = sx * 0.130;

      // Boot shaft (ankle to mid-shin)
      const shaftGeo = taperedCyl(0.068, 0.064, 0.160, 14, 4);
      group.add(mesh(shaftGeo, mat, bx, 0.160, 0.010));

      // Boot body
      const bodyGeo = new THREE.BoxGeometry(0.105, 0.072, 0.195);
      const bm = mesh(bodyGeo, mat, bx, 0.036, 0.042);
      // Round toe
      const toeGeo = ovalSphere(0.048, 0.036, 0.052, 12);
      group.add(mesh(toeGeo, mat, bx, 0.048, 0.130));
      group.add(bm);

      // Chunky sole
      const soleGeo = new THREE.BoxGeometry(0.115, 0.028, 0.205);
      group.add(mesh(soleGeo, sole, bx, 0.014, 0.042));

      // Sole accent stripe
      const soleStripeGeo = new THREE.BoxGeometry(0.117, 0.010, 0.207);
      group.add(mesh(soleStripeGeo, accent, bx, 0.028, 0.042));

      // Laces
      for (let i = 0; i < 4; i++) {
        const laceGeo = new THREE.BoxGeometry(0.072, 0.006, 0.006);
        group.add(mesh(laceGeo, lace, bx, 0.105 + i * 0.020, 0.098));
      }

      // Star logo on side
      const starShape = new THREE.Shape();
      const sr = 0.018, si = 0.008;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? sr : si;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (i === 0) starShape.moveTo(px, py); else starShape.lineTo(px, py);
      }
      starShape.closePath();
      const starGeo = new THREE.ShapeGeometry(starShape);
      const starM = mesh(starGeo, accent, bx + sx * 0.058, 0.042, 0.042);
      starM.rotation.y = sx * (Math.PI / 2);
      group.add(starM);
    }
  },

  // ── Sneakers ──────────────────────────────────────────────────────────────────
  sneakers(group, color, accentColor) {
    const mat    = clothMat(color || '#f0f0f0');
    const sole   = clothMat('#e0e0e0');
    const accent = clothMat(accentColor || '#ff4444');
    const lace   = clothMat('#cccccc');

    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const bx = sx * 0.130;
      const bodyGeo = new THREE.BoxGeometry(0.100, 0.058, 0.180);
      group.add(mesh(bodyGeo, mat, bx, 0.030, 0.035));
      const toeGeo = ovalSphere(0.044, 0.030, 0.048, 12);
      group.add(mesh(toeGeo, mat, bx, 0.036, 0.118));
      const soleGeo = new THREE.BoxGeometry(0.108, 0.022, 0.188);
      group.add(mesh(soleGeo, sole, bx, 0.011, 0.035));
      // Accent stripe
      const stripeGeo = new THREE.BoxGeometry(0.008, 0.048, 0.160);
      group.add(mesh(stripeGeo, accent, bx + sx * 0.052, 0.030, 0.028));
      // Laces
      for (let i = 0; i < 3; i++) {
        const laceGeo = new THREE.BoxGeometry(0.068, 0.005, 0.005);
        group.add(mesh(laceGeo, lace, bx, 0.055 + i * 0.014, 0.080));
      }
    }
  },

  // ── High Heels ────────────────────────────────────────────────────────────────
  highHeels(group, color) {
    const mat  = clothMat(color || '#cc2244');
    const sole = clothMat('#1a1a1a');

    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const bx = sx * 0.130;
      const bodyGeo = new THREE.BoxGeometry(0.090, 0.045, 0.160);
      group.add(mesh(bodyGeo, mat, bx, 0.052, 0.018));
      const toeGeo = ovalSphere(0.038, 0.022, 0.044, 12);
      group.add(mesh(toeGeo, mat, bx, 0.052, 0.100));
      // Heel
      const heelGeo = taperedCyl(0.014, 0.010, 0.065, 8, 3);
      group.add(mesh(heelGeo, sole, bx, 0.033, -0.062));
      // Sole
      const soleGeo = new THREE.BoxGeometry(0.092, 0.010, 0.050);
      group.add(mesh(soleGeo, sole, bx, 0.010, 0.070));
    }
  },

  // ── Chelsea Boots ─────────────────────────────────────────────────────────────
  chelseaBoots(group, color) {
    const mat  = clothMat(color || '#2a1a0a');
    const sole = clothMat('#1a1a1a');
    const elastic = clothMat('#4a3a2a');

    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const bx = sx * 0.130;
      const shaftGeo = taperedCyl(0.065, 0.062, 0.130, 14, 4);
      group.add(mesh(shaftGeo, mat, bx, 0.135, 0.010));
      const bodyGeo = new THREE.BoxGeometry(0.100, 0.065, 0.185);
      group.add(mesh(bodyGeo, mat, bx, 0.033, 0.038));
      const toeGeo = ovalSphere(0.046, 0.032, 0.050, 12);
      group.add(mesh(toeGeo, mat, bx, 0.044, 0.128));
      const soleGeo = new THREE.BoxGeometry(0.108, 0.024, 0.192);
      group.add(mesh(soleGeo, sole, bx, 0.012, 0.038));
      // Elastic panel
      const elasticGeo = new THREE.BoxGeometry(0.008, 0.080, 0.080);
      group.add(mesh(elasticGeo, elastic, bx + sx * 0.052, 0.100, 0.040));
    }
  },
};

// ─── CartoonClothingSystem class ──────────────────────────────────────────────

export class CartoonClothingSystem {
  constructor() {
    this.groups = {
      shirt:   new THREE.Group(),
      jacket:  new THREE.Group(),
      bottom:  new THREE.Group(),
      socks:   new THREE.Group(),
      shoes:   new THREE.Group(),
    };
    this._equipped = {};
  }

  /** Equip a clothing item in a slot */
  equip(slot, styleName, primaryColor, accentColor) {
    const group = this.groups[slot];
    if (!group) return;

    // Clear slot
    while (group.children.length > 0) {
      const child = group.children[0];
      child.traverse(o => { if (o.isMesh) { o.geometry?.dispose(); o.material?.dispose(); } });
      group.remove(child);
    }

    this._equipped[slot] = { styleName, primaryColor, accentColor };

    const styleMap = {
      shirt:  SHIRT_STYLES,
      jacket: JACKET_STYLES,
      bottom: BOTTOM_STYLES,
      socks:  SOCK_STYLES,
      shoes:  SHOE_STYLES,
    };

    const styles = styleMap[slot];
    if (styles && styles[styleName]) {
      styles[styleName](group, primaryColor, accentColor);
    }
  }

  /** Remove a clothing item from a slot */
  unequip(slot) {
    const group = this.groups[slot];
    if (!group) return;
    while (group.children.length > 0) {
      const child = group.children[0];
      child.traverse(o => { if (o.isMesh) { o.geometry?.dispose(); o.material?.dispose(); } });
      group.remove(child);
    }
    delete this._equipped[slot];
  }

  /** Get all groups to add to scene */
  getAllGroups() {
    return Object.values(this.groups);
  }

  /** Serialize current outfit */
  serialize() {
    return { ...this._equipped };
  }

  /** Restore outfit from serialized data */
  restore(data) {
    Object.entries(data).forEach(([slot, { styleName, primaryColor, accentColor }]) => {
      this.equip(slot, styleName, primaryColor, accentColor);
    });
  }

  static get shirtStyles()  { return Object.keys(SHIRT_STYLES); }
  static get jacketStyles() { return Object.keys(JACKET_STYLES); }
  static get bottomStyles() { return Object.keys(BOTTOM_STYLES); }
  static get sockStyles()   { return Object.keys(SOCK_STYLES); }
  static get shoeStyles()   { return Object.keys(SHOE_STYLES); }
}
