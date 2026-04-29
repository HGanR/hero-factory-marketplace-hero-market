/**
 * ChibiAccessories3D.js — Accessories scaled for chibi creature proportions
 *
 * Provides hats, glasses/sunglasses, and necklaces that fit the oversized
 * chibi head and compact body.
 */

import * as THREE from 'three';

function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color: new THREE.Color(color), ...opts });
}

function place(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

// ─── Hat builders ─────────────────────────────────────────────────────────────

const HAT_BUILDERS = {

  baseballCap(color = '#222266', accentColor = '#ffffff') {
    const g = new THREE.Group();
    // Cap dome
    const domeGeo = new THREE.SphereGeometry(0.115, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.55);
    g.add(place(domeGeo, toon(color), 0, 0, 0));
    // Brim
    const brimGeo = new THREE.CylinderGeometry(0.155, 0.150, 0.018, 28, 1, false,
      -Math.PI * 0.15, Math.PI * 1.3);
    g.add(place(brimGeo, toon(color), 0, -0.020, 0.025));
    // Button on top
    const btnGeo = new THREE.SphereGeometry(0.014, 10, 8);
    g.add(place(btnGeo, toon(accentColor), 0, 0.108, 0));
    return g;
  },

  beanie(color = '#cc3333', stripeColor = '#ffffff') {
    const g = new THREE.Group();
    // Main beanie body
    const bodyGeo = new THREE.SphereGeometry(0.118, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.58);
    g.add(place(bodyGeo, toon(color), 0, 0, 0));
    // Cuff ring
    const cuffGeo = new THREE.TorusGeometry(0.112, 0.018, 10, 28);
    g.add(place(cuffGeo, toon(stripeColor), 0, -0.025, 0, Math.PI / 2));
    // Pom-pom
    const pomGeo = new THREE.SphereGeometry(0.030, 14, 12);
    g.add(place(pomGeo, toon(stripeColor), 0, 0.118, 0));
    return g;
  },

  topHat(color = '#111111', bandColor = '#cc9900') {
    const g = new THREE.Group();
    // Cylinder crown
    const crownGeo = new THREE.CylinderGeometry(0.088, 0.092, 0.165, 28);
    g.add(place(crownGeo, toon(color), 0, 0.072, 0));
    // Brim
    const brimGeo = new THREE.CylinderGeometry(0.162, 0.158, 0.020, 28);
    g.add(place(brimGeo, toon(color), 0, -0.010, 0));
    // Hat band
    const bandGeo = new THREE.TorusGeometry(0.092, 0.012, 8, 28);
    g.add(place(bandGeo, toon(bandColor), 0, 0.008, 0, Math.PI / 2));
    return g;
  },

  propellerHat(color = '#ff6600', propColor = '#ffcc00') {
    const g = new THREE.Group();
    // Base cap
    const capGeo = new THREE.SphereGeometry(0.112, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
    g.add(place(capGeo, toon(color), 0, 0, 0));
    // Propeller hub
    const hubGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.022, 12);
    g.add(place(hubGeo, toon('#333333'), 0, 0.115, 0));
    // 3 propeller blades
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const bladeGeo = new THREE.BoxGeometry(0.060, 0.010, 0.018);
      const blade = place(bladeGeo, toon(propColor),
        Math.cos(angle) * 0.042, 0.118, Math.sin(angle) * 0.042,
        0, angle, 0.3);
      g.add(blade);
    }
    return g;
  },

  crownHat(color = '#ffcc00', gemColor = '#cc0044') {
    const g = new THREE.Group();
    // Crown base ring
    const baseGeo = new THREE.TorusGeometry(0.105, 0.022, 10, 28);
    g.add(place(baseGeo, toon(color), 0, 0, 0, Math.PI / 2));
    // Crown points (5 spikes)
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const spikeGeo = new THREE.ConeGeometry(0.018, 0.072, 8);
      const spike = place(spikeGeo, toon(color),
        Math.cos(angle) * 0.105, 0.036, Math.sin(angle) * 0.105);
      g.add(spike);
      // Gem on spike
      const gemGeo = new THREE.SphereGeometry(0.012, 10, 8);
      const gem = place(gemGeo, toon(gemColor),
        Math.cos(angle) * 0.105, 0.080, Math.sin(angle) * 0.105);
      g.add(gem);
    }
    return g;
  },

  witchHat(color = '#220044', bandColor = '#44ff88') {
    const g = new THREE.Group();
    // Tall pointed cone
    const coneGeo = new THREE.ConeGeometry(0.095, 0.220, 24);
    g.add(place(coneGeo, toon(color), 0, 0.110, 0));
    // Wide brim
    const brimGeo = new THREE.CylinderGeometry(0.188, 0.182, 0.022, 28);
    g.add(place(brimGeo, toon(color), 0, -0.002, 0));
    // Band
    const bandGeo = new THREE.TorusGeometry(0.098, 0.010, 8, 24);
    g.add(place(bandGeo, toon(bandColor), 0, 0.022, 0, Math.PI / 2));
    return g;
  },

  halo(color = '#ffee44') {
    const g = new THREE.Group();
    const haloGeo = new THREE.TorusGeometry(0.115, 0.014, 10, 28);
    g.add(place(haloGeo, toon(color, { emissive: new THREE.Color(color), emissiveIntensity: 0.4 }),
      0, 0, 0, Math.PI / 2));
    // Support stem
    const stemGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.065, 8);
    g.add(place(stemGeo, toon('#cccccc'), 0, -0.032, 0));
    return g;
  },

  bunnyEars(color = '#ffccdd', innerColor = '#ff88aa') {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) {
      // Outer ear
      const earGeo = new THREE.CapsuleGeometry(0.028, 0.110, 6, 14);
      const ear = place(earGeo, toon(color),
        sx * 0.065, 0.085, 0, 0, 0, sx * 0.15);
      g.add(ear);
      // Inner ear
      const innerGeo = new THREE.CapsuleGeometry(0.014, 0.075, 6, 12);
      const inner = place(innerGeo, toon(innerColor),
        sx * 0.065, 0.085, 0.008, 0, 0, sx * 0.15);
      g.add(inner);
    }
    return g;
  },

};

// ─── Glasses builders ─────────────────────────────────────────────────────────

const GLASSES_BUILDERS = {

  roundGlasses(frameColor = '#222222', lensColor = '#88ccff') {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) {
      const lx = sx * 0.058;
      // Lens ring
      const ringGeo = new THREE.TorusGeometry(0.038, 0.008, 8, 20);
      g.add(place(ringGeo, toon(frameColor), lx, 0, 0, Math.PI / 2));
      // Lens fill
      const lensGeo = new THREE.CircleGeometry(0.030, 20);
      g.add(place(lensGeo, toon(lensColor, { transparent: true, opacity: 0.45 }),
        lx, 0, 0.002));
    }
    // Bridge
    const bridgeGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.040, 8);
    g.add(place(bridgeGeo, toon(frameColor), 0, 0, 0, 0, 0, Math.PI / 2));
    return g;
  },

  heartGlasses(frameColor = '#ff3366', lensColor = '#ffaacc') {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) {
      const lx = sx * 0.058;
      // Heart shape using 2 spheres + triangle approximation
      const s1Geo = new THREE.SphereGeometry(0.022, 14, 10);
      g.add(place(s1Geo, toon(frameColor), lx - 0.012, 0.008, 0));
      const s2Geo = new THREE.SphereGeometry(0.022, 14, 10);
      g.add(place(s2Geo, toon(frameColor), lx + 0.012, 0.008, 0));
      const tipGeo = new THREE.ConeGeometry(0.022, 0.032, 8);
      g.add(place(tipGeo, toon(frameColor), lx, -0.014, 0, 0, 0, Math.PI));
    }
    const bridgeGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.040, 8);
    g.add(place(bridgeGeo, toon(frameColor), 0, 0, 0, 0, 0, Math.PI / 2));
    return g;
  },

  starGlasses(frameColor = '#ffcc00', lensColor = '#ffffaa') {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) {
      const lx = sx * 0.058;
      // Star shape using 5 cone spikes
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const spikeGeo = new THREE.ConeGeometry(0.010, 0.038, 6);
        g.add(place(spikeGeo, toon(frameColor),
          lx + Math.cos(angle) * 0.030, Math.sin(angle) * 0.030, 0,
          0, 0, angle + Math.PI));
      }
      // Center lens
      const lensGeo = new THREE.CircleGeometry(0.022, 5);
      g.add(place(lensGeo, toon(lensColor, { transparent: true, opacity: 0.5 }), lx, 0, 0.001));
    }
    const bridgeGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.040, 8);
    g.add(place(bridgeGeo, toon(frameColor), 0, 0, 0, 0, 0, Math.PI / 2));
    return g;
  },

  aviatorSunglasses(frameColor = '#888844', lensColor = '#224422') {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) {
      const lx = sx * 0.058;
      // Teardrop shape — oval lens
      const lensGeo = new THREE.EllipseCurve(0, 0, 0.036, 0.042);
      const points = lensGeo.getPoints(20);
      const shape = new THREE.Shape(points);
      const shapeGeo = new THREE.ShapeGeometry(shape);
      g.add(place(shapeGeo, toon(lensColor, { transparent: true, opacity: 0.55 }), lx, -0.004, 0));
      // Frame ring
      const ringGeo = new THREE.TorusGeometry(0.039, 0.007, 6, 20);
      g.add(place(ringGeo, toon(frameColor), lx, -0.004, 0, Math.PI / 2));
    }
    const bridgeGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.040, 8);
    g.add(place(bridgeGeo, toon(frameColor), 0, 0.002, 0, 0, 0, Math.PI / 2));
    return g;
  },

};

// ─── Necklace builders ────────────────────────────────────────────────────────

const NECKLACE_BUILDERS = {

  simpleChain(color = '#ccaa00') {
    const g = new THREE.Group();
    const chainGeo = new THREE.TorusGeometry(0.088, 0.007, 8, 28);
    g.add(place(chainGeo, toon(color), 0, 0, 0, Math.PI / 2));
    return g;
  },

  starPendant(chainColor = '#ccaa00', pendantColor = '#ffee44') {
    const g = new THREE.Group();
    // Chain
    const chainGeo = new THREE.TorusGeometry(0.088, 0.006, 8, 28);
    g.add(place(chainGeo, toon(chainColor), 0, 0, 0, Math.PI / 2));
    // Star pendant
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const spikeGeo = new THREE.ConeGeometry(0.008, 0.028, 5);
      g.add(place(spikeGeo, toon(pendantColor),
        Math.cos(angle) * 0.020, -0.095 + Math.sin(angle) * 0.020, 0.005,
        0, 0, angle + Math.PI));
    }
    return g;
  },

  gemNecklace(chainColor = '#888888', gemColor = '#cc0044') {
    const g = new THREE.Group();
    const chainGeo = new THREE.TorusGeometry(0.088, 0.006, 8, 28);
    g.add(place(chainGeo, toon(chainColor), 0, 0, 0, Math.PI / 2));
    // Gem drop
    const gemGeo = new THREE.OctahedronGeometry(0.022);
    g.add(place(gemGeo, toon(gemColor, { roughness: 0.1 }), 0, -0.100, 0.005));
    return g;
  },

};

// ─── ChibiAccessories3D ───────────────────────────────────────────────────────

export class ChibiAccessories3D {
  constructor() {
    this._equipped = {};
  }

  /**
   * Build and return a hat group for the given style.
   * @param {string} style - key from HAT_BUILDERS
   * @param {string} color - primary hex color
   * @param {string} accentColor - secondary hex color
   */
  buildHat(style, color = '#222266', accentColor = '#ffffff') {
    const builder = HAT_BUILDERS[style];
    if (!builder) return null;
    return builder(color, accentColor);
  }

  /**
   * Build and return a glasses group for the given style.
   */
  buildGlasses(style, frameColor = '#222222', lensColor = '#88ccff') {
    const builder = GLASSES_BUILDERS[style];
    if (!builder) return null;
    return builder(frameColor, lensColor);
  }

  /**
   * Build and return a necklace group for the given style.
   */
  buildNecklace(style, color = '#ccaa00', accentColor = '#ffee44') {
    const builder = NECKLACE_BUILDERS[style];
    if (!builder) return null;
    return builder(color, accentColor);
  }

  static get HAT_STYLES() {
    return Object.keys(HAT_BUILDERS);
  }

  static get GLASSES_STYLES() {
    return Object.keys(GLASSES_BUILDERS);
  }

  static get NECKLACE_STYLES() {
    return Object.keys(NECKLACE_BUILDERS);
  }
}
