/**
 * CartoonClothing3D.js — Fitted 3D clothing that wraps the cartoon body
 *
 * Clothing wraps the body using lathe profiles that match the body silhouette
 * with a slight offset (like fabric over skin). Includes:
 * - Shirts / jerseys with sleeves and collar
 * - Jackets with lapels and pockets
 * - Shorts / pants
 * - Knee-high socks with stripe bands
 * - Chunky boots / sneakers / shoes
 */

import * as THREE from 'three';

function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color: new THREE.Color(color), ...opts });
}

function lathe(points, segs = 32) {
  return new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    segs
  );
}

function sphere(rx, ry, rz, ws = 22, hs = 16) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  return g;
}

function capsule(r, len, cap = 6, rad = 12) {
  return new THREE.CapsuleGeometry(r, len, cap, rad);
}

function place(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Body reference dimensions (must match CartoonBody3D)
const B = {
  shoulderW: 0.200, chestW: 0.185, waistW: 0.145, hipW: 0.175,
  torsoH: 0.420, upperArmR: 0.058, lowerArmR: 0.048, wristR: 0.036,
  armLen: 0.320, thighR: 0.068, shinR: 0.052, ankleR: 0.038, legLen: 0.420,
};

// ─── Shirt styles ─────────────────────────────────────────────────────────────

const SHIRTS = {

  jersey: (color, accent) => {
    const g = new THREE.Group();
    const mat = toon(color);
    const acMat = toon(accent);

    // Body — slightly larger than torso lathe
    const bodyPts = [
      [0.000,  B.torsoH * 0.50],
      [B.shoulderW * 0.62, B.torsoH * 0.48],
      [B.shoulderW + 0.010, B.torsoH * 0.42],
      [B.chestW + 0.012, B.torsoH * 0.28],
      [B.waistW + 0.010, B.torsoH * 0.00],
      [B.hipW + 0.012, -B.torsoH * 0.25],
      [B.hipW + 0.008, -B.torsoH * 0.35],
    ];
    const bodyGeo = lathe(bodyPts, 48);
    const body = place(bodyGeo, mat, 0, 0, 0);
    body.scale.z = 0.74;
    g.add(body);

    // Collar
    const collarGeo = new THREE.TorusGeometry(0.052, 0.014, 8, 24);
    g.add(place(collarGeo, acMat, 0, B.torsoH * 0.48, 0, Math.PI / 2, 0, 0));

    // Star logo on chest
    const starGroup = new THREE.Group();
    starGroup.position.set(0, B.torsoH * 0.22, B.chestW * 0.74 + 0.005);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const a2 = a + Math.PI / 5;
      const outerR = 0.032;
      const innerR = 0.014;
      const ox = Math.cos(a) * outerR;
      const oy = Math.sin(a) * outerR;
      const ix = Math.cos(a2) * innerR;
      const iy = Math.sin(a2) * innerR;
      const pGeo = new THREE.SphereGeometry(0.006, 6, 6);
      starGroup.add(place(pGeo, toon(accent), ox, oy, 0));
      starGroup.add(place(pGeo.clone(), toon(accent), ix, iy, 0));
    }
    const starCenterGeo = new THREE.SphereGeometry(0.010, 8, 8);
    starGroup.add(place(starCenterGeo, toon(accent), 0, 0, 0));
    g.add(starGroup);

    // Side stripe accents
    for (const sx of [-1, 1]) {
      const stripePts = [
        [B.shoulderW + 0.012, B.torsoH * 0.42],
        [B.chestW + 0.014, B.torsoH * 0.20],
        [B.waistW + 0.012, B.torsoH * 0.00],
        [B.hipW + 0.014, -B.torsoH * 0.28],
      ];
      const stripeCurve = new THREE.CatmullRomCurve3(stripePts.map(([x, y]) => new THREE.Vector3(sx * x, y, 0)));
      const stripeGeo = new THREE.TubeGeometry(stripeCurve, 8, 0.008, 6, false);
      g.add(new THREE.Mesh(stripeGeo, acMat));
    }

    // Short sleeves
    for (const sx of [-1, 1]) {
      const sleevePts = [
        [B.upperArmR + 0.010, 0.000],
        [B.upperArmR + 0.008, 0.040],
        [B.upperArmR + 0.006, 0.075],
        [B.upperArmR + 0.004, 0.090],
      ];
      const sleeveGeo = lathe(sleevePts, 24);
      const sleeve = place(sleeveGeo, mat,
        sx * (B.shoulderW + B.upperArmR * 0.9), B.torsoH * 0.38, 0,
        0, 0, sx * Math.PI / 2);
      g.add(sleeve);

      // Sleeve accent band
      const bandGeo = new THREE.TorusGeometry(B.upperArmR + 0.012, 0.007, 6, 20);
      g.add(place(bandGeo, acMat,
        sx * (B.shoulderW + B.upperArmR * 0.9 + 0.085), B.torsoH * 0.38, 0,
        0, 0, Math.PI / 2));
    }

    return g;
  },

  tshirt: (color, accent) => {
    const g = new THREE.Group();
    const mat = toon(color);

    const bodyPts = [
      [0.000,  B.torsoH * 0.50],
      [B.shoulderW * 0.60, B.torsoH * 0.47],
      [B.shoulderW + 0.008, B.torsoH * 0.41],
      [B.chestW + 0.010, B.torsoH * 0.26],
      [B.waistW + 0.008, B.torsoH * 0.00],
      [B.hipW + 0.010, -B.torsoH * 0.28],
      [B.hipW + 0.006, -B.torsoH * 0.36],
    ];
    const bodyGeo = lathe(bodyPts, 48);
    const body = place(bodyGeo, mat, 0, 0, 0);
    body.scale.z = 0.74;
    g.add(body);

    // Round neck
    const neckGeo = new THREE.TorusGeometry(0.048, 0.012, 8, 22);
    g.add(place(neckGeo, toon(accent), 0, B.torsoH * 0.47, 0, Math.PI / 2, 0, 0));

    // Short sleeves
    for (const sx of [-1, 1]) {
      const sleeveGeo = lathe([
        [B.upperArmR + 0.010, 0.000],
        [B.upperArmR + 0.008, 0.045],
        [B.upperArmR + 0.006, 0.082],
      ], 22);
      g.add(place(sleeveGeo, mat,
        sx * (B.shoulderW + B.upperArmR * 0.85), B.torsoH * 0.38, 0,
        0, 0, sx * Math.PI / 2));
    }

    return g;
  },

  hoodie: (color, accent) => {
    const g = new THREE.Group();
    const mat = toon(color);
    const acMat = toon(accent);

    const bodyPts = [
      [0.000,  B.torsoH * 0.52],
      [B.shoulderW * 0.62, B.torsoH * 0.50],
      [B.shoulderW + 0.016, B.torsoH * 0.44],
      [B.chestW + 0.016, B.torsoH * 0.28],
      [B.waistW + 0.014, B.torsoH * 0.00],
      [B.hipW + 0.016, -B.torsoH * 0.28],
      [B.hipW + 0.012, -B.torsoH * 0.38],
    ];
    const bodyGeo = lathe(bodyPts, 48);
    const body = place(bodyGeo, mat, 0, 0, 0);
    body.scale.z = 0.76;
    g.add(body);

    // Hood
    const hoodGeo = sphere(0.110, 0.095, 0.090, 24, 18);
    g.add(place(hoodGeo, mat, 0, B.torsoH * 0.52, -0.055));

    // Hood opening
    const hoodOpenGeo = sphere(0.082, 0.070, 0.040, 22, 16);
    g.add(place(hoodOpenGeo, acMat, 0, B.torsoH * 0.52, -0.010));

    // Kangaroo pocket
    const pocketGeo = sphere(0.080, 0.035, 0.018, 18, 12);
    g.add(place(pocketGeo, acMat, 0, B.torsoH * 0.05, B.waistW * 0.74 + 0.012));

    // Long sleeves
    for (const sx of [-1, 1]) {
      const sleeveGeo = lathe([
        [B.upperArmR + 0.014, 0.000],
        [B.upperArmR + 0.012, 0.080],
        [B.lowerArmR + 0.012, 0.165],
        [B.wristR + 0.014, 0.310],
        [B.wristR + 0.016, 0.320],
      ], 24);
      g.add(place(sleeveGeo, mat,
        sx * (B.shoulderW + B.upperArmR * 0.9), B.torsoH * 0.38, 0,
        0, 0, sx * Math.PI / 2));

      // Cuff
      const cuffGeo = new THREE.TorusGeometry(B.wristR + 0.016, 0.010, 6, 18);
      g.add(place(cuffGeo, acMat,
        sx * (B.shoulderW + B.upperArmR * 0.9 + 0.318), B.torsoH * 0.38, 0,
        0, 0, Math.PI / 2));
    }

    return g;
  },

  cropTop: (color, accent) => {
    const g = new THREE.Group();
    const mat = toon(color);

    const bodyPts = [
      [0.000,  B.torsoH * 0.48],
      [B.shoulderW * 0.58, B.torsoH * 0.46],
      [B.shoulderW + 0.008, B.torsoH * 0.40],
      [B.chestW + 0.010, B.torsoH * 0.26],
      [B.waistW + 0.008, B.torsoH * 0.04],
      [B.waistW + 0.006, B.torsoH * 0.00],
    ];
    const bodyGeo = lathe(bodyPts, 44);
    const body = place(bodyGeo, mat, 0, 0, 0);
    body.scale.z = 0.74;
    g.add(body);

    // Thin straps
    for (const sx of [-1, 1]) {
      const strapCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx * 0.038, B.torsoH * 0.48, B.chestW * 0.72),
        new THREE.Vector3(sx * 0.042, B.torsoH * 0.52, B.chestW * 0.68),
        new THREE.Vector3(sx * 0.038, B.torsoH * 0.56, B.chestW * 0.60),
      ]);
      const strapGeo = new THREE.TubeGeometry(strapCurve, 6, 0.008, 6, false);
      g.add(new THREE.Mesh(strapGeo, mat));
    }

    return g;
  },

  turtleneck: (color, accent) => {
    const g = new THREE.Group();
    const mat = toon(color);

    const bodyPts = [
      [0.000,  B.torsoH * 0.50],
      [B.shoulderW * 0.60, B.torsoH * 0.48],
      [B.shoulderW + 0.010, B.torsoH * 0.42],
      [B.chestW + 0.012, B.torsoH * 0.28],
      [B.waistW + 0.010, B.torsoH * 0.00],
      [B.hipW + 0.012, -B.torsoH * 0.28],
    ];
    const bodyGeo = lathe(bodyPts, 48);
    const body = place(bodyGeo, mat, 0, 0, 0);
    body.scale.z = 0.74;
    g.add(body);

    // Turtleneck collar
    const turtlePts = [
      [0.042, B.torsoH * 0.48],
      [0.044, B.torsoH * 0.52],
      [0.046, B.torsoH * 0.56],
      [0.044, B.torsoH * 0.60],
    ];
    const turtleGeo = lathe(turtlePts, 28);
    g.add(place(turtleGeo, mat, 0, 0, 0));

    // Long sleeves
    for (const sx of [-1, 1]) {
      const sleeveGeo = lathe([
        [B.upperArmR + 0.012, 0.000],
        [B.lowerArmR + 0.010, 0.165],
        [B.wristR + 0.012, 0.310],
      ], 22);
      g.add(place(sleeveGeo, mat,
        sx * (B.shoulderW + B.upperArmR * 0.9), B.torsoH * 0.38, 0,
        0, 0, sx * Math.PI / 2));
    }

    return g;
  },
};

// ─── Jacket styles ────────────────────────────────────────────────────────────

const JACKETS = {
  bomber: (color, accent) => {
    const g = new THREE.Group();
    const mat = toon(color);
    const acMat = toon(accent);

    const bodyPts = [
      [0.000,  B.torsoH * 0.52],
      [B.shoulderW * 0.62, B.torsoH * 0.50],
      [B.shoulderW + 0.018, B.torsoH * 0.44],
      [B.chestW + 0.018, B.torsoH * 0.28],
      [B.waistW + 0.016, B.torsoH * 0.00],
      [B.waistW + 0.022, -B.torsoH * 0.08],
      [B.waistW + 0.018, -B.torsoH * 0.12],
    ];
    const bodyGeo = lathe(bodyPts, 48);
    const body = place(bodyGeo, mat, 0, 0, 0);
    body.scale.z = 0.76;
    g.add(body);

    // Ribbed waistband
    const wbGeo = lathe([
      [B.waistW + 0.020, -B.torsoH * 0.08],
      [B.waistW + 0.022, -B.torsoH * 0.12],
      [B.waistW + 0.020, -B.torsoH * 0.14],
    ], 36);
    g.add(place(wbGeo, acMat, 0, 0, 0));

    // Long sleeves
    for (const sx of [-1, 1]) {
      const sleeveGeo = lathe([
        [B.upperArmR + 0.016, 0.000],
        [B.lowerArmR + 0.014, 0.165],
        [B.wristR + 0.018, 0.310],
        [B.wristR + 0.022, 0.320],
      ], 24);
      g.add(place(sleeveGeo, mat,
        sx * (B.shoulderW + B.upperArmR * 0.9), B.torsoH * 0.38, 0,
        0, 0, sx * Math.PI / 2));

      // Ribbed cuff
      const cuffGeo = lathe([
        [B.wristR + 0.020, 0.316],
        [B.wristR + 0.022, 0.326],
        [B.wristR + 0.020, 0.334],
      ], 20);
      g.add(place(cuffGeo, acMat,
        sx * (B.shoulderW + B.upperArmR * 0.9), B.torsoH * 0.38, 0,
        0, 0, sx * Math.PI / 2));
    }

    // Zipper line
    const zipCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, B.torsoH * 0.50, B.chestW * 0.74 + 0.012),
      new THREE.Vector3(0, B.torsoH * 0.20, B.waistW * 0.74 + 0.014),
      new THREE.Vector3(0, B.torsoH * 0.00, B.waistW * 0.74 + 0.014),
      new THREE.Vector3(0, -B.torsoH * 0.10, B.waistW * 0.74 + 0.012),
    ]);
    const zipGeo = new THREE.TubeGeometry(zipCurve, 10, 0.005, 4, false);
    g.add(new THREE.Mesh(zipGeo, toon('#888888')));

    return g;
  },

  denim: (color, accent) => {
    const g = new THREE.Group();
    const mat = toon(color);
    const acMat = toon(accent);

    const bodyPts = [
      [0.000,  B.torsoH * 0.50],
      [B.shoulderW * 0.60, B.torsoH * 0.48],
      [B.shoulderW + 0.016, B.torsoH * 0.42],
      [B.chestW + 0.016, B.torsoH * 0.28],
      [B.waistW + 0.014, B.torsoH * 0.00],
      [B.hipW + 0.016, -B.torsoH * 0.30],
    ];
    const bodyGeo = lathe(bodyPts, 48);
    const body = place(bodyGeo, mat, 0, 0, 0);
    body.scale.z = 0.76;
    g.add(body);

    // Collar / lapels
    for (const sx of [-1, 1]) {
      const lapelCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx * 0.010, B.torsoH * 0.48, B.chestW * 0.74 + 0.012),
        new THREE.Vector3(sx * 0.040, B.torsoH * 0.42, B.chestW * 0.72 + 0.012),
        new THREE.Vector3(sx * 0.055, B.torsoH * 0.34, B.chestW * 0.70 + 0.010),
      ]);
      const lapelGeo = new THREE.TubeGeometry(lapelCurve, 6, 0.014, 6, false);
      g.add(new THREE.Mesh(lapelGeo, acMat));
    }

    // Chest pockets
    for (const sx of [-1, 1]) {
      const pGeo = sphere(0.030, 0.022, 0.010, 14, 10);
      g.add(place(pGeo, acMat, sx * 0.070, B.torsoH * 0.32, B.chestW * 0.72 + 0.010));
    }

    // Long sleeves
    for (const sx of [-1, 1]) {
      const sleeveGeo = lathe([
        [B.upperArmR + 0.014, 0.000],
        [B.lowerArmR + 0.012, 0.165],
        [B.wristR + 0.014, 0.310],
      ], 22);
      g.add(place(sleeveGeo, mat,
        sx * (B.shoulderW + B.upperArmR * 0.9), B.torsoH * 0.38, 0,
        0, 0, sx * Math.PI / 2));
    }

    return g;
  },
};

// ─── Pants / shorts ───────────────────────────────────────────────────────────

const BOTTOMS = {
  shorts: (color, accent) => {
    const g = new THREE.Group();
    const mat = toon(color);
    const acMat = toon(accent);

    // Waistband
    const wbGeo = lathe([
      [B.hipW + 0.012, -B.torsoH * 0.26],
      [B.hipW + 0.014, -B.torsoH * 0.30],
      [B.hipW + 0.012, -B.torsoH * 0.32],
    ], 36);
    g.add(place(wbGeo, acMat, 0, 0, 0));

    // Shorts body
    const shortsPts = [
      [B.hipW + 0.010, -B.torsoH * 0.30],
      [B.hipW + 0.008, -B.torsoH * 0.40],
      [B.thighR + 0.010, -B.torsoH * 0.46 - 0.080],
    ];
    const shortsGeo = lathe(shortsPts, 44);
    const shorts = place(shortsGeo, mat, 0, 0, 0);
    shorts.scale.z = 0.78;
    g.add(shorts);

    // Side stripe
    for (const sx of [-1, 1]) {
      const stripeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx * (B.hipW + 0.014), -B.torsoH * 0.30, 0),
        new THREE.Vector3(sx * (B.thighR + 0.012), -B.torsoH * 0.46 - 0.070, 0),
      ]);
      const stripeGeo = new THREE.TubeGeometry(stripeCurve, 4, 0.008, 6, false);
      g.add(new THREE.Mesh(stripeGeo, acMat));
    }

    return g;
  },

  pants: (color, accent) => {
    const g = new THREE.Group();
    const mat = toon(color);
    const acMat = toon(accent);

    // Waistband
    const wbGeo = lathe([
      [B.hipW + 0.012, -B.torsoH * 0.26],
      [B.hipW + 0.016, -B.torsoH * 0.32],
      [B.hipW + 0.012, -B.torsoH * 0.34],
    ], 36);
    g.add(place(wbGeo, acMat, 0, 0, 0));

    // Pants legs
    for (const sx of [-1, 1]) {
      const lx = sx * B.hipW * 0.58;
      const legPts = [
        [B.thighR + 0.012, 0.000],
        [B.thighR + 0.010, 0.100],
        [B.shinR + 0.010, 0.230],
        [B.ankleR + 0.012, 0.420],
        [B.ankleR + 0.010, 0.440],
      ];
      const legGeo = lathe(legPts, 24);
      const leg = place(legGeo, mat, lx, -B.torsoH * 0.46, 0, Math.PI, 0, 0);
      g.add(leg);
    }

    return g;
  },
};

// ─── Socks ────────────────────────────────────────────────────────────────────

const SOCKS = {
  kneeHigh: (color, stripeColor) => {
    const g = new THREE.Group();
    const mat = toon(color);
    const stripeMat = toon(stripeColor);

    for (const sx of [-1, 1]) {
      const lx = sx * B.hipW * 0.58;
      const ankleY = -B.torsoH * 0.46 - B.legLen * 0.50;

      // Sock tube — from knee to ankle
      const sockPts = [
        [B.shinR + 0.008, 0.000],
        [B.shinR + 0.006, 0.100],
        [B.shinR + 0.004, 0.200],
        [B.ankleR + 0.008, 0.300],
        [B.ankleR + 0.010, 0.340],
      ];
      const sockGeo = lathe(sockPts, 22);
      const sock = place(sockGeo, mat, lx, ankleY + 0.340, 0, Math.PI, 0, 0);
      g.add(sock);

      // 3 stripe bands near top
      for (let i = 0; i < 3; i++) {
        const sy = ankleY + 0.340 - i * 0.022;
        const bandGeo = new THREE.TorusGeometry(B.shinR + 0.010, 0.006, 6, 20);
        g.add(place(bandGeo, stripeMat, lx, sy, 0, Math.PI / 2, 0, 0));
      }
    }

    return g;
  },

  ankle: (color, stripeColor) => {
    const g = new THREE.Group();
    const mat = toon(color);

    for (const sx of [-1, 1]) {
      const lx = sx * B.hipW * 0.58;
      const ankleY = -B.torsoH * 0.46 - B.legLen * 0.50;

      const sockPts = [
        [B.ankleR + 0.010, 0.000],
        [B.ankleR + 0.008, 0.060],
        [B.ankleR + 0.010, 0.090],
      ];
      const sockGeo = lathe(sockPts, 20);
      g.add(place(sockGeo, mat, lx, ankleY + 0.090, 0, Math.PI, 0, 0));
    }

    return g;
  },
};

// ─── Footwear ─────────────────────────────────────────────────────────────────

const FOOTWEAR = {
  chunkyBoots: (color, accent) => {
    const g = new THREE.Group();
    const mat = toon(color);
    const acMat = toon(accent);
    const soleMat = toon('#111111');

    for (const sx of [-1, 1]) {
      const lx = sx * B.hipW * 0.58;
      const ankleY = -B.torsoH * 0.46 - B.legLen * 0.50 - 0.040;
      const bg = new THREE.Group();
      bg.position.set(lx, ankleY, 0.028);

      // Shaft
      const shaftPts = [
        [B.ankleR + 0.018, 0.000],
        [B.ankleR + 0.020, 0.060],
        [B.ankleR + 0.022, 0.120],
        [B.ankleR + 0.020, 0.155],
      ];
      const shaftGeo = lathe(shaftPts, 22);
      bg.add(place(shaftGeo, mat, 0, 0, 0, Math.PI, 0, 0));

      // Toe box — rounded chunky
      const toeGeo = sphere(0.048, 0.034, 0.058, 20, 14);
      bg.add(place(toeGeo, mat, 0, -0.024, 0.062));

      // Sole
      const soleGeo = sphere(0.050, 0.014, 0.068, 20, 10);
      bg.add(place(soleGeo, soleMat, 0, -0.038, 0.030));

      // Heel
      const heelGeo = sphere(0.040, 0.028, 0.038, 18, 12);
      bg.add(place(heelGeo, mat, 0, -0.018, -0.030));

      // Lace eyelets
      for (let i = 0; i < 4; i++) {
        const ey = -0.010 + i * 0.034;
        for (const ex of [-0.022, 0.022]) {
          const eyeletGeo = new THREE.TorusGeometry(0.005, 0.003, 4, 8);
          bg.add(place(eyeletGeo, toon('#888888'), ex, ey, B.ankleR + 0.022, Math.PI / 2, 0, 0));
        }
      }

      // Laces
      const laceCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.022, -0.010, B.ankleR + 0.024),
        new THREE.Vector3(0, 0.000, B.ankleR + 0.028),
        new THREE.Vector3(0.022, 0.010, B.ankleR + 0.024),
        new THREE.Vector3(-0.022, 0.030, B.ankleR + 0.024),
        new THREE.Vector3(0, 0.040, B.ankleR + 0.028),
        new THREE.Vector3(0.022, 0.050, B.ankleR + 0.024),
      ]);
      const laceGeo = new THREE.TubeGeometry(laceCurve, 12, 0.003, 4, false);
      bg.add(new THREE.Mesh(laceGeo, toon('#ffffff')));

      // Star accent on side
      const starGeo = sphere(0.016, 0.016, 0.006, 10, 8);
      bg.add(place(starGeo, toon(accent), sx * (B.ankleR + 0.024), 0.040, 0.020));

      g.add(bg);
    }

    return g;
  },

  sneakers: (color, accent) => {
    const g = new THREE.Group();
    const mat = toon(color);
    const acMat = toon(accent);
    const soleMat = toon('#f0f0f0');

    for (const sx of [-1, 1]) {
      const lx = sx * B.hipW * 0.58;
      const ankleY = -B.torsoH * 0.46 - B.legLen * 0.50 - 0.040;
      const sg = new THREE.Group();
      sg.position.set(lx, ankleY, 0.028);

      // Upper
      const upperGeo = sphere(0.042, 0.030, 0.058, 20, 14);
      sg.add(place(upperGeo, mat, 0, -0.010, 0.045));

      // Sole — chunky
      const soleGeo = sphere(0.046, 0.016, 0.065, 20, 10);
      sg.add(place(soleGeo, soleMat, 0, -0.036, 0.035));

      // Heel counter
      const heelGeo = sphere(0.038, 0.028, 0.032, 16, 12);
      sg.add(place(heelGeo, acMat, 0, -0.012, -0.028));

      // Tongue
      const tongueGeo = sphere(0.022, 0.028, 0.010, 14, 10);
      sg.add(place(tongueGeo, toon('#ffffff'), 0, 0.010, 0.062));

      // Laces
      for (let i = 0; i < 3; i++) {
        const laceGeo = new THREE.CapsuleGeometry(0.003, 0.038, 3, 6);
        sg.add(place(laceGeo, toon('#ffffff'), 0, 0.002 + i * 0.014, 0.060, 0, 0, Math.PI / 2));
      }

      // Swoosh-style accent stripe
      const swooshCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx * 0.010, -0.020, 0.025),
        new THREE.Vector3(sx * 0.030, -0.010, 0.048),
        new THREE.Vector3(sx * 0.042, 0.005, 0.060),
        new THREE.Vector3(sx * 0.038, 0.015, 0.068),
      ]);
      const swooshGeo = new THREE.TubeGeometry(swooshCurve, 8, 0.006, 5, false);
      sg.add(new THREE.Mesh(swooshGeo, acMat));

      g.add(sg);
    }

    return g;
  },

  heels: (color, accent) => {
    const g = new THREE.Group();
    const mat = toon(color);

    for (const sx of [-1, 1]) {
      const lx = sx * B.hipW * 0.58;
      const ankleY = -B.torsoH * 0.46 - B.legLen * 0.50 - 0.040;
      const hg = new THREE.Group();
      hg.position.set(lx, ankleY, 0.028);

      // Toe box — pointed
      const toeGeo = sphere(0.032, 0.022, 0.068, 18, 12);
      hg.add(place(toeGeo, mat, 0, -0.018, 0.058));

      // Heel stiletto
      const stilettoGeo = new THREE.CylinderGeometry(0.008, 0.004, 0.055, 8);
      hg.add(place(stilettoGeo, mat, 0, -0.028, -0.032, 0.2, 0, 0));

      // Strap
      const strapGeo = new THREE.TorusGeometry(0.036, 0.007, 6, 16, Math.PI);
      hg.add(place(strapGeo, toon(accent), 0, 0.010, 0.040, 0, 0, 0));

      g.add(hg);
    }

    return g;
  },
};

// ─── CartoonClothing3D ────────────────────────────────────────────────────────

export class CartoonClothing3D {
  constructor() {
    this.group = new THREE.Group();
    this._equipped = {};
  }

  equip(slot, style, color = '#1a2a6c', accent = '#c8a800') {
    this.unequip(slot);

    let builder;
    if (slot === 'shirt')    builder = SHIRTS[style];
    if (slot === 'jacket')   builder = JACKETS[style];
    if (slot === 'bottom')   builder = BOTTOMS[style];
    if (slot === 'socks')    builder = SOCKS[style];
    if (slot === 'footwear') builder = FOOTWEAR[style];

    if (!builder) return;

    const item = builder(color, accent);
    item.name = `${slot}_${style}`;
    this.group.add(item);
    this._equipped[slot] = item;
  }

  unequip(slot) {
    if (this._equipped[slot]) {
      this.group.remove(this._equipped[slot]);
      this._equipped[slot].traverse(obj => {
        if (obj.isMesh) { obj.geometry?.dispose(); obj.material?.dispose(); }
      });
      delete this._equipped[slot];
    }
  }

  recolor(slot, color, accent) {
    const style = this._equipped[slot]?.name?.split('_')[1];
    if (style) this.equip(slot, style, color, accent);
  }

  getShirtStyles()    { return Object.keys(SHIRTS); }
  getJacketStyles()   { return Object.keys(JACKETS); }
  getBottomStyles()   { return Object.keys(BOTTOMS); }
  getSockStyles()     { return Object.keys(SOCKS); }
  getFootwearStyles() { return Object.keys(FOOTWEAR); }

  dispose() {
    this.group.traverse(obj => {
      if (obj.isMesh) { obj.geometry?.dispose(); obj.material?.dispose(); }
    });
  }
}

export { SHIRTS, JACKETS, BOTTOMS, SOCKS, FOOTWEAR };
