/**
 * EarAssets.js
 * Library of 3D ear models built procedurally with Three.js.
 * Each ear is a Group containing:
 *   - Outer helix  — curved torus arc
 *   - Antihelix    — inner ridge
 *   - Concha       — bowl of the ear
 *   - Tragus       — small forward-pointing flap
 *   - Antitragus   — opposite flap
 *   - Earlobe      — lower fleshy portion
 *
 * Pairs (left + right) are mirrored automatically.
 */

import * as THREE from 'three';

function mkSkin(hex = '#C68642') {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex),
    roughness: 0.65,
    metalness: 0.0,
  });
}

// ─── Core ear builder ─────────────────────────────────────────────────────────

/**
 * Builds a single (right) ear. Left is mirrored via scale.x = -1.
 * @param {object} cfg
 * @param {number} cfg.width        overall ear width
 * @param {number} cfg.height       overall ear height
 * @param {number} cfg.depth        ear protrusion from head
 * @param {number} cfg.lobeSize     earlobe sphere radius
 * @param {number} cfg.lobeDropRatio  how far lobe hangs below helix (0–1)
 * @param {number} cfg.helixThickness
 * @param {number} cfg.protrusionAngle  angle ear sticks out from head (radians)
 * @param {string} cfg.skinColor
 */
function buildEar(cfg) {
  const g = new THREE.Group();
  g.name = 'ear';

  const {
    width = 0.030,
    height = 0.060,
    depth = 0.018,
    lobeSize = 0.012,
    lobeDropRatio = 0.15,
    helixThickness = 0.007,
    protrusionAngle = 0.15,
    skinColor = '#C68642',
  } = cfg;

  const mat = mkSkin(skinColor);

  // ── Outer helix (main ear shell) ──────────────────────────────────────────
  const helixGeo = new THREE.TorusGeometry(
    height * 0.42,       // tube ring radius
    helixThickness,      // tube radius
    8, 24,
    Math.PI * 1.4        // arc (not full circle — open at bottom)
  );
  const helix = new THREE.Mesh(helixGeo, mat.clone());
  helix.name = 'helix';
  helix.rotation.z = -Math.PI * 0.05;
  helix.scale.x = width / (height * 0.84);
  g.add(helix);

  // ── Ear body / concha (flat backing) ─────────────────────────────────────
  const conchaGeo = new THREE.SphereGeometry(1, 14, 10);
  conchaGeo.scale(width * 0.85, height * 0.45, depth * 0.5);
  const concha = new THREE.Mesh(conchaGeo, mat.clone());
  concha.name = 'concha';
  concha.position.y = height * 0.05;
  g.add(concha);

  // ── Antihelix (inner ridge) ───────────────────────────────────────────────
  const antiGeo = new THREE.TorusGeometry(height * 0.22, helixThickness * 0.6, 6, 16, Math.PI * 1.1);
  const anti = new THREE.Mesh(antiGeo, mat.clone());
  anti.name = 'antihelix';
  anti.position.set(width * 0.05, height * 0.08, depth * 0.4);
  anti.rotation.z = -Math.PI * 0.1;
  anti.scale.x = 0.7;
  g.add(anti);

  // ── Tragus ────────────────────────────────────────────────────────────────
  const tragusGeo = new THREE.SphereGeometry(helixThickness * 1.1, 8, 6);
  const tragus = new THREE.Mesh(tragusGeo, mat.clone());
  tragus.name = 'tragus';
  tragus.position.set(-width * 0.35, -height * 0.05, depth * 0.6);
  tragus.scale.set(1.4, 0.9, 0.8);
  g.add(tragus);

  // ── Antitragus ────────────────────────────────────────────────────────────
  const antiTragusGeo = new THREE.SphereGeometry(helixThickness * 0.9, 8, 6);
  const antiTragus = new THREE.Mesh(antiTragusGeo, mat.clone());
  antiTragus.name = 'antitragus';
  antiTragus.position.set(width * 0.05, -height * 0.28, depth * 0.5);
  g.add(antiTragus);

  // ── Earlobe ───────────────────────────────────────────────────────────────
  const lobeGeo = new THREE.SphereGeometry(lobeSize, 12, 10);
  const lobe = new THREE.Mesh(lobeGeo, mat.clone());
  lobe.name = 'earlobe';
  lobe.position.set(0, -(height * 0.42 + lobeSize * lobeDropRatio * 8), depth * 0.3);
  lobe.scale.set(1.0, 1.2, 0.9);
  g.add(lobe);

  // ── Protrusion tilt ───────────────────────────────────────────────────────
  g.rotation.y = protrusionAngle;

  return g;
}

// ─── Pair builder ─────────────────────────────────────────────────────────────

function buildEarPair(cfg) {
  const group = new THREE.Group();
  group.name = 'ears';

  const right = buildEar(cfg);
  right.name = 'earRight';
  right.position.set(0.115, 1.72, 0);

  const left = buildEar(cfg);
  left.name = 'earLeft';
  left.scale.x = -1;   // mirror
  left.position.set(-0.115, 1.72, 0);

  group.add(left);
  group.add(right);
  return group;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EAR LIBRARY  — 10 distinct ear shapes
// ═══════════════════════════════════════════════════════════════════════════════

export const EAR_LIBRARY = [
  {
    id: 'ear-average',
    label: 'Average',
    category: 'classic',
    description: 'Standard proportioned ears.',
    build: (skinColor = '#C68642') => buildEarPair({
      width: 0.030, height: 0.060, depth: 0.018,
      lobeSize: 0.012, lobeDropRatio: 0.15,
      helixThickness: 0.007, protrusionAngle: 0.15, skinColor,
    }),
  },
  {
    id: 'ear-large',
    label: 'Large',
    category: 'prominent',
    description: 'Large ears with prominent helix.',
    build: (skinColor = '#C68642') => buildEarPair({
      width: 0.038, height: 0.074, depth: 0.022,
      lobeSize: 0.016, lobeDropRatio: 0.18,
      helixThickness: 0.009, protrusionAngle: 0.20, skinColor,
    }),
  },
  {
    id: 'ear-small',
    label: 'Small',
    category: 'delicate',
    description: 'Small, delicate ears.',
    build: (skinColor = '#C68642') => buildEarPair({
      width: 0.022, height: 0.044, depth: 0.013,
      lobeSize: 0.009, lobeDropRatio: 0.10,
      helixThickness: 0.005, protrusionAngle: 0.10, skinColor,
    }),
  },
  {
    id: 'ear-protruding',
    label: 'Protruding',
    category: 'prominent',
    description: 'Ears that stick out noticeably from the head.',
    build: (skinColor = '#C68642') => buildEarPair({
      width: 0.032, height: 0.062, depth: 0.028,
      lobeSize: 0.013, lobeDropRatio: 0.15,
      helixThickness: 0.007, protrusionAngle: 0.38, skinColor,
    }),
  },
  {
    id: 'ear-flat',
    label: 'Flat',
    category: 'classic',
    description: 'Flat ears that lie close to the head.',
    build: (skinColor = '#C68642') => buildEarPair({
      width: 0.028, height: 0.058, depth: 0.010,
      lobeSize: 0.011, lobeDropRatio: 0.12,
      helixThickness: 0.006, protrusionAngle: 0.04, skinColor,
    }),
  },
  {
    id: 'ear-attached-lobe',
    label: 'Attached Lobe',
    category: 'classic',
    description: 'Ears with an attached (non-hanging) earlobe.',
    build: (skinColor = '#C68642') => buildEarPair({
      width: 0.029, height: 0.058, depth: 0.016,
      lobeSize: 0.009, lobeDropRatio: 0.04,
      helixThickness: 0.007, protrusionAngle: 0.14, skinColor,
    }),
  },
  {
    id: 'ear-free-lobe',
    label: 'Free Lobe',
    category: 'classic',
    description: 'Ears with a long, freely hanging earlobe.',
    build: (skinColor = '#C68642') => buildEarPair({
      width: 0.030, height: 0.062, depth: 0.018,
      lobeSize: 0.016, lobeDropRatio: 0.30,
      helixThickness: 0.007, protrusionAngle: 0.15, skinColor,
    }),
  },
  {
    id: 'ear-pointed',
    label: 'Pointed (Elf)',
    category: 'fantasy',
    description: 'Pointed elf-style ears.',
    build: (skinColor = '#C68642') => {
      const g = buildEarPair({
        width: 0.026, height: 0.080, depth: 0.018,
        lobeSize: 0.010, lobeDropRatio: 0.10,
        helixThickness: 0.006, protrusionAngle: 0.12, skinColor,
      });
      // Add pointed tip to each ear
      g.children.forEach(ear => {
        const ptGeo = new THREE.ConeGeometry(0.006, 0.022, 8);
        const ptMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(skinColor), roughness: 0.65 });
        const pt = new THREE.Mesh(ptGeo, ptMat);
        pt.position.set(0, 0.052, 0);
        ear.add(pt);
      });
      return g;
    },
  },
  {
    id: 'ear-round-top',
    label: 'Round Top',
    category: 'classic',
    description: 'Ears with a very rounded upper helix.',
    build: (skinColor = '#C68642') => buildEarPair({
      width: 0.034, height: 0.058, depth: 0.017,
      lobeSize: 0.013, lobeDropRatio: 0.14,
      helixThickness: 0.009, protrusionAngle: 0.15, skinColor,
    }),
  },
  {
    id: 'ear-narrow',
    label: 'Narrow',
    category: 'delicate',
    description: 'Tall, narrow ears with a slim profile.',
    build: (skinColor = '#C68642') => buildEarPair({
      width: 0.020, height: 0.068, depth: 0.016,
      lobeSize: 0.010, lobeDropRatio: 0.14,
      helixThickness: 0.005, protrusionAngle: 0.13, skinColor,
    }),
  },
];
