/**
 * ShoeAssets.js
 * Footwear library — Sneakers (10), Shoes (8), Boots (8)
 * All procedurally built with Three.js geometry.
 * Each asset builds a PAIR (left + right) positioned at ground level.
 */
import * as THREE from 'three';

function mkMat(hex, roughness = 0.75, metalness = 0.0) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness, metalness });
}

// ─── Core shoe builder ────────────────────────────────────────────────────────

/**
 * Builds a single shoe (right foot). Left is mirrored.
 * @param {object} cfg
 * @param {number} cfg.toeH       toe box height
 * @param {number} cfg.toeW       toe box width
 * @param {number} cfg.toeL       toe box length
 * @param {number} cfg.heelH      heel height
 * @param {number} cfg.heelW      heel width
 * @param {number} cfg.shaftH     shaft height (0 = no shaft, for boots)
 * @param {number} cfg.shaftW     shaft width
 * @param {number} cfg.soleH      sole thickness
 * @param {string} cfg.upperColor
 * @param {string} cfg.soleColor
 * @param {string} cfg.accentColor
 * @param {string} cfg.toeShape   'round'|'square'|'pointed'
 */
function buildShoe(cfg) {
  const g = new THREE.Group();
  const {
    toeH = 0.040, toeW = 0.055, toeL = 0.080,
    heelH = 0.035, heelW = 0.050,
    shaftH = 0, shaftW = 0.055,
    soleH = 0.012,
    upperColor = '#111111', soleColor = '#FFFFFF', accentColor = null,
    toeShape = 'round',
  } = cfg;

  const upperMat = mkMat(upperColor);
  const soleMat  = mkMat(soleColor, 0.5);
  const accentMat = mkMat(accentColor || upperColor, 0.6);

  // ── Sole ──────────────────────────────────────────────────────────────────
  const soleGeo = new THREE.BoxGeometry(toeW * 1.1, soleH, toeL + heelW * 0.5);
  const sole = new THREE.Mesh(soleGeo, soleMat);
  sole.position.set(0, soleH * 0.5, toeL * 0.1);
  g.add(sole);

  // ── Toe box ───────────────────────────────────────────────────────────────
  let toeGeo;
  if (toeShape === 'round') {
    toeGeo = new THREE.SphereGeometry(1, 14, 10);
    toeGeo.scale(toeW * 0.5, toeH * 0.5, toeL * 0.55);
  } else if (toeShape === 'square') {
    toeGeo = new THREE.BoxGeometry(toeW, toeH, toeL * 1.0);
  } else if (toeShape === 'pointed') {
    toeGeo = new THREE.ConeGeometry(toeW * 0.4, toeL * 0.9, 8);
  }
  const toe = new THREE.Mesh(toeGeo, upperMat.clone());
  toe.position.set(0, soleH + toeH * 0.5, toeL * 0.3);
  if (toeShape === 'pointed') {
    toe.rotation.x = -Math.PI / 2;
    toe.position.z = toeL * 0.5;
  }
  g.add(toe);

  // ── Heel ──────────────────────────────────────────────────────────────────
  const heelGeo = new THREE.BoxGeometry(heelW, heelH, heelW * 0.9);
  const heel = new THREE.Mesh(heelGeo, upperMat.clone());
  heel.position.set(0, soleH + heelH * 0.5, -toeL * 0.2);
  g.add(heel);

  // ── Shaft (for boots) ─────────────────────────────────────────────────────
  if (shaftH > 0) {
    const shaftGeo = new THREE.CylinderGeometry(shaftW * 0.5, shaftW * 0.55, shaftH, 14, 2);
    const shaft = new THREE.Mesh(shaftGeo, upperMat.clone());
    shaft.position.set(0, soleH + heelH + shaftH * 0.5, -toeL * 0.05);
    g.add(shaft);
  }

  // ── Accent stripe (for sneakers) ──────────────────────────────────────────
  if (accentColor && accentColor !== upperColor) {
    const stripeGeo = new THREE.BoxGeometry(toeW * 1.05, toeH * 0.18, toeL * 0.7);
    const stripe = new THREE.Mesh(stripeGeo, accentMat);
    stripe.position.set(0, soleH + toeH * 0.55, toeL * 0.2);
    g.add(stripe);
  }

  return g;
}

// ─── Pair builder ─────────────────────────────────────────────────────────────

function buildPair(cfg) {
  const g = new THREE.Group(); g.name = 'footwear';
  // Positions match new BodyMesh foot_L (x=-0.175) and foot_R (x=0.175)
  // The attach point is at (0, 0.031, 0.045) so shoes are placed relative to that
  const right = buildShoe(cfg); right.name = 'shoeRight'; right.position.set( 0.175, 0, 0);
  const left  = buildShoe(cfg); left.name  = 'shoeLeft';  left.position.set(-0.175, 0, 0);
  left.scale.x = -1;
  g.add(left); g.add(right);
  // The group is placed at the shoes attach point (0, 0.031, 0.045)
  // so offset back to world origin for the pair
  g.position.set(0, -0.031, -0.045);
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SNEAKER LIBRARY — 10 styles
// ═══════════════════════════════════════════════════════════════════════════════

export const SNEAKER_LIBRARY = [
  {
    id: 'sneaker-low-white',
    label: 'Classic Low White',
    category: 'low-top',
    thumbnail: '👟',
    description: 'Clean white low-top sneakers.',
    build: (color = '#F5F5F5', accent = '#E0E0E0') => buildPair({
      toeH: 0.042, toeW: 0.058, toeL: 0.085, heelH: 0.038, heelW: 0.052,
      soleH: 0.014, upperColor: color, soleColor: '#FFFFFF', accentColor: accent, toeShape: 'round',
    }),
  },
  {
    id: 'sneaker-low-black',
    label: 'Low Black',
    category: 'low-top',
    thumbnail: '👟',
    description: 'Black low-top sneakers.',
    build: (color = '#111111', accent = '#E53935') => buildPair({
      toeH: 0.042, toeW: 0.058, toeL: 0.085, heelH: 0.038, heelW: 0.052,
      soleH: 0.014, upperColor: color, soleColor: '#FFFFFF', accentColor: accent, toeShape: 'round',
    }),
  },
  {
    id: 'sneaker-high-top',
    label: 'High Top',
    category: 'high-top',
    thumbnail: '👟',
    description: 'Classic high-top sneakers.',
    build: (color = '#F5F5F5', accent = '#1565C0') => buildPair({
      toeH: 0.042, toeW: 0.058, toeL: 0.085, heelH: 0.038, heelW: 0.052,
      shaftH: 0.06, shaftW: 0.058,
      soleH: 0.014, upperColor: color, soleColor: '#FFFFFF', accentColor: accent, toeShape: 'round',
    }),
  },
  {
    id: 'sneaker-runner',
    label: 'Running Shoe',
    category: 'athletic',
    thumbnail: '🏃',
    description: 'Lightweight running sneakers.',
    build: (color = '#0288D1', accent = '#FFFFFF') => buildPair({
      toeH: 0.040, toeW: 0.056, toeL: 0.090, heelH: 0.042, heelW: 0.054,
      soleH: 0.018, upperColor: color, soleColor: '#E0E0E0', accentColor: accent, toeShape: 'round',
    }),
  },
  {
    id: 'sneaker-chunky',
    label: 'Chunky Dad Shoe',
    category: 'fashion',
    thumbnail: '👟',
    description: 'Chunky oversized sole sneakers.',
    build: (color = '#FFFFFF', accent = '#FF9800') => buildPair({
      toeH: 0.050, toeW: 0.065, toeL: 0.090, heelH: 0.050, heelW: 0.060,
      soleH: 0.022, upperColor: color, soleColor: '#F5F5F5', accentColor: accent, toeShape: 'square',
    }),
  },
  {
    id: 'sneaker-slip-on',
    label: 'Slip-On',
    category: 'casual',
    thumbnail: '🥿',
    description: 'Laceless slip-on sneakers.',
    build: (color = '#455A64', accent = null) => buildPair({
      toeH: 0.038, toeW: 0.055, toeL: 0.082, heelH: 0.034, heelW: 0.050,
      soleH: 0.012, upperColor: color, soleColor: '#FFFFFF', accentColor: null, toeShape: 'round',
    }),
  },
  {
    id: 'sneaker-basketball',
    label: 'Basketball Shoe',
    category: 'high-top',
    thumbnail: '🏀',
    description: 'High-top basketball sneakers.',
    build: (color = '#E53935', accent = '#FFFFFF') => buildPair({
      toeH: 0.045, toeW: 0.062, toeL: 0.088, heelH: 0.045, heelW: 0.058,
      shaftH: 0.07, shaftW: 0.062,
      soleH: 0.016, upperColor: color, soleColor: '#FFFFFF', accentColor: accent, toeShape: 'round',
    }),
  },
  {
    id: 'sneaker-skate',
    label: 'Skate Shoe',
    category: 'casual',
    thumbnail: '🛹',
    description: 'Flat-soled skate shoes.',
    build: (color = '#212121', accent = '#FFC107') => buildPair({
      toeH: 0.040, toeW: 0.060, toeL: 0.086, heelH: 0.036, heelW: 0.054,
      soleH: 0.014, upperColor: color, soleColor: '#333333', accentColor: accent, toeShape: 'square',
    }),
  },
  {
    id: 'sneaker-retro',
    label: 'Retro Trainer',
    category: 'fashion',
    thumbnail: '✨',
    description: 'Retro-style trainer.',
    build: (color = '#F5F5F5', accent = '#4CAF50') => buildPair({
      toeH: 0.042, toeW: 0.058, toeL: 0.085, heelH: 0.040, heelW: 0.054,
      soleH: 0.016, upperColor: color, soleColor: '#E8E8E8', accentColor: accent, toeShape: 'round',
    }),
  },
  {
    id: 'sneaker-platform',
    label: 'Platform Sneaker',
    category: 'fashion',
    thumbnail: '🌟',
    description: 'Platform sole sneakers.',
    build: (color = '#E91E8C', accent = '#FFFFFF') => buildPair({
      toeH: 0.042, toeW: 0.058, toeL: 0.085, heelH: 0.040, heelW: 0.054,
      soleH: 0.028, upperColor: color, soleColor: '#FFFFFF', accentColor: accent, toeShape: 'round',
    }),
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
//  SHOES LIBRARY — 8 styles
// ═══════════════════════════════════════════════════════════════════════════════

export const SHOES_LIBRARY = [
  {
    id: 'shoe-oxford',
    label: 'Oxford',
    category: 'formal',
    thumbnail: '👞',
    description: 'Classic Oxford dress shoe.',
    build: (color = '#2C1810') => buildPair({
      toeH: 0.038, toeW: 0.054, toeL: 0.088, heelH: 0.040, heelW: 0.048,
      soleH: 0.012, upperColor: color, soleColor: '#1A0A00', accentColor: null, toeShape: 'round',
    }),
  },
  {
    id: 'shoe-loafer',
    label: 'Loafer',
    category: 'casual',
    thumbnail: '🥿',
    description: 'Slip-on loafer.',
    build: (color = '#4A3728') => buildPair({
      toeH: 0.036, toeW: 0.054, toeL: 0.084, heelH: 0.034, heelW: 0.048,
      soleH: 0.010, upperColor: color, soleColor: '#2C1810', accentColor: null, toeShape: 'round',
    }),
  },
  {
    id: 'shoe-heel',
    label: 'High Heel',
    category: 'fashion',
    thumbnail: '👠',
    description: 'Classic high heel pump.',
    build: (color = '#C0392B') => {
      const g = new THREE.Group(); g.name = 'footwear';
      [-1, 1].forEach(side => {
        const shoe = new THREE.Group();
        // Toe box
        const toe = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mkMat(color));
        toe.scale.set(0.028, 0.020, 0.050);
        toe.position.set(0, 0.020, 0.040);
        shoe.add(toe);
        // Heel stiletto
        const heel = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.003, 0.060, 6), mkMat(color, 0.3));
        heel.position.set(0, 0.030, -0.030);
        shoe.add(heel);
        // Sole
        const sole = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.006, 0.080), mkMat('#1A0A00', 0.5));
        sole.position.set(0, 0.003, 0.010);
        shoe.add(sole);
        shoe.position.x = side * 0.10;
        if (side === -1) shoe.scale.x = -1;
        g.add(shoe);
      });
      return g;
    },
  },
  {
    id: 'shoe-flat',
    label: 'Ballet Flat',
    category: 'casual',
    thumbnail: '🩰',
    description: 'Delicate ballet flat.',
    build: (color = '#E91E8C') => buildPair({
      toeH: 0.028, toeW: 0.050, toeL: 0.082, heelH: 0.022, heelW: 0.044,
      soleH: 0.008, upperColor: color, soleColor: '#C2185B', accentColor: null, toeShape: 'round',
    }),
  },
  {
    id: 'shoe-derby',
    label: 'Derby',
    category: 'formal',
    thumbnail: '👞',
    description: 'Classic Derby shoe.',
    build: (color = '#111111') => buildPair({
      toeH: 0.038, toeW: 0.054, toeL: 0.086, heelH: 0.038, heelW: 0.048,
      soleH: 0.012, upperColor: color, soleColor: '#222222', accentColor: null, toeShape: 'round',
    }),
  },
  {
    id: 'shoe-mule',
    label: 'Mule',
    category: 'casual',
    thumbnail: '🥿',
    description: 'Open-back mule.',
    build: (color = '#8D6E63') => buildPair({
      toeH: 0.034, toeW: 0.052, toeL: 0.075, heelH: 0.030, heelW: 0.046,
      soleH: 0.010, upperColor: color, soleColor: '#6D4C41', accentColor: null, toeShape: 'round',
    }),
  },
  {
    id: 'shoe-wedge',
    label: 'Wedge',
    category: 'fashion',
    thumbnail: '👡',
    description: 'Platform wedge shoe.',
    build: (color = '#FF9800') => buildPair({
      toeH: 0.038, toeW: 0.054, toeL: 0.082, heelH: 0.055, heelW: 0.050,
      soleH: 0.020, upperColor: color, soleColor: '#E65100', accentColor: null, toeShape: 'round',
    }),
  },
  {
    id: 'shoe-monk',
    label: 'Monk Strap',
    category: 'formal',
    thumbnail: '👞',
    description: 'Buckle monk strap shoe.',
    build: (color = '#3E2723') => {
      const g = buildPair({
        toeH: 0.038, toeW: 0.054, toeL: 0.086, heelH: 0.038, heelW: 0.048,
        soleH: 0.012, upperColor: color, soleColor: '#1A0A00', accentColor: null, toeShape: 'round',
      });
      // Buckle strap
      g.children.forEach(shoe => {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.010, 0.006), mkMat(color));
        strap.position.set(0, 0.042, 0.010);
        shoe.add(strap);
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.004), mkMat('#C0A020', 0.2, 0.8));
        buckle.position.set(0, 0.042, 0.014);
        shoe.add(buckle);
      });
      return g;
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
//  BOOTS LIBRARY — 8 styles
// ═══════════════════════════════════════════════════════════════════════════════

export const BOOTS_LIBRARY = [
  {
    id: 'boot-chelsea',
    label: 'Chelsea Boot',
    category: 'fashion',
    thumbnail: '🥾',
    description: 'Classic Chelsea boot.',
    build: (color = '#2C1810') => buildPair({
      toeH: 0.040, toeW: 0.056, toeL: 0.086, heelH: 0.040, heelW: 0.050,
      shaftH: 0.10, shaftW: 0.058,
      soleH: 0.014, upperColor: color, soleColor: '#1A0A00', accentColor: null, toeShape: 'round',
    }),
  },
  {
    id: 'boot-combat',
    label: 'Combat Boot',
    category: 'casual',
    thumbnail: '🥾',
    description: 'Heavy-duty combat boots.',
    build: (color = '#1A1A1A') => buildPair({
      toeH: 0.045, toeW: 0.060, toeL: 0.088, heelH: 0.042, heelW: 0.054,
      shaftH: 0.14, shaftW: 0.062,
      soleH: 0.018, upperColor: color, soleColor: '#111111', accentColor: '#333333', toeShape: 'square',
    }),
  },
  {
    id: 'boot-cowboy',
    label: 'Cowboy Boot',
    category: 'fashion',
    thumbnail: '🤠',
    description: 'Western cowboy boots.',
    build: (color = '#8B4513') => buildPair({
      toeH: 0.038, toeW: 0.052, toeL: 0.092, heelH: 0.048, heelW: 0.046,
      shaftH: 0.18, shaftW: 0.060,
      soleH: 0.012, upperColor: color, soleColor: '#5C2A00', accentColor: '#C0A020', toeShape: 'pointed',
    }),
  },
  {
    id: 'boot-knee-high',
    label: 'Knee-High Boot',
    category: 'fashion',
    thumbnail: '👢',
    description: 'Tall knee-high boots.',
    build: (color = '#111111') => buildPair({
      toeH: 0.038, toeW: 0.054, toeL: 0.086, heelH: 0.042, heelW: 0.050,
      shaftH: 0.28, shaftW: 0.058,
      soleH: 0.012, upperColor: color, soleColor: '#222222', accentColor: null, toeShape: 'round',
    }),
  },
  {
    id: 'boot-ankle',
    label: 'Ankle Boot',
    category: 'casual',
    thumbnail: '👢',
    description: 'Versatile ankle boots.',
    build: (color = '#4A3728') => buildPair({
      toeH: 0.040, toeW: 0.056, toeL: 0.086, heelH: 0.040, heelW: 0.050,
      shaftH: 0.07, shaftW: 0.058,
      soleH: 0.014, upperColor: color, soleColor: '#2C1810', accentColor: null, toeShape: 'round',
    }),
  },
  {
    id: 'boot-snow',
    label: 'Snow Boot',
    category: 'utility',
    thumbnail: '❄️',
    description: 'Insulated snow boots.',
    build: (color = '#455A64') => buildPair({
      toeH: 0.050, toeW: 0.065, toeL: 0.090, heelH: 0.045, heelW: 0.058,
      shaftH: 0.16, shaftW: 0.068,
      soleH: 0.020, upperColor: color, soleColor: '#263238', accentColor: '#FFFFFF', toeShape: 'round',
    }),
  },
  {
    id: 'boot-hiking',
    label: 'Hiking Boot',
    category: 'utility',
    thumbnail: '🥾',
    description: 'Rugged hiking boots.',
    build: (color = '#5D4037') => buildPair({
      toeH: 0.045, toeW: 0.060, toeL: 0.090, heelH: 0.044, heelW: 0.054,
      shaftH: 0.10, shaftW: 0.062,
      soleH: 0.020, upperColor: color, soleColor: '#3E2723', accentColor: '#FF9800', toeShape: 'square',
    }),
  },
  {
    id: 'boot-rain',
    label: 'Rain Boot',
    category: 'utility',
    thumbnail: '🌧️',
    description: 'Rubber rain boots.',
    build: (color = '#E53935') => buildPair({
      toeH: 0.045, toeW: 0.060, toeL: 0.088, heelH: 0.040, heelW: 0.054,
      shaftH: 0.22, shaftW: 0.064,
      soleH: 0.016, upperColor: color, soleColor: '#B71C1C', accentColor: null, toeShape: 'round',
    }),
  },
];
