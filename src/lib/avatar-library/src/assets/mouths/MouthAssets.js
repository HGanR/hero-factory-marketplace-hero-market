/**
 * MouthAssets.js
 * Library of 3D mouth models built procedurally with Three.js.
 * Each mouth is a Group containing:
 *   - Upper lip  — shaped torus/extruded curve
 *   - Lower lip  — shaped torus/extruded curve
 *   - Lip line   — thin dark line between lips
 *   - Corners    — small spheres at mouth corners
 *   - Philtrum   — subtle indentation above upper lip (optional)
 *   - Teeth      — visible when mouth is open (optional)
 *
 * Lip colour is separate from skin colour and is customisable.
 */

import * as THREE from 'three';

// ─── Material factories ───────────────────────────────────────────────────────

function mkLip(hex) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex),
    roughness: 0.5,
    metalness: 0.0,
  });
}
function mkSkin(hex) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.65, metalness: 0.0 });
}
function mkTeeth() {
  return new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.3, metalness: 0.0 });
}
function mkLine() {
  return new THREE.MeshStandardMaterial({ color: 0x2a1008, roughness: 0.9, metalness: 0.0 });
}

// ─── Core mouth builder ───────────────────────────────────────────────────────

/**
 * @param {object} cfg
 * @param {number} cfg.width           total mouth width
 * @param {number} cfg.upperLipHeight  vertical height of upper lip
 * @param {number} cfg.lowerLipHeight  vertical height of lower lip
 * @param {number} cfg.lipDepth        forward protrusion of lips
 * @param {number} cfg.cupidsBow       0 = flat, 1 = pronounced cupid's bow
 * @param {number} cfg.cornerLift      positive = smile, negative = frown
 * @param {number} cfg.openAmount      0 = closed, 1 = open
 * @param {string} cfg.lipColor        hex colour for lips
 * @param {string} cfg.skinColor       hex colour for surrounding skin
 */
function buildMouth(cfg) {
  const g = new THREE.Group();
  g.name = 'mouth';

  const {
    width = 0.040,
    upperLipHeight = 0.010,
    lowerLipHeight = 0.013,
    lipDepth = 0.010,
    cupidsBow = 0.4,
    cornerLift = 0.0,
    openAmount = 0.0,
    lipColor = '#C0726A',
    skinColor = '#C68642',
  } = cfg;

  const lipMat = mkLip(lipColor);
  const lineMat = mkLine();

  // ── Upper lip ─────────────────────────────────────────────────────────────
  // Built from two torus arcs to create the cupid's bow shape
  const halfW = width * 0.5;

  // Left peak of cupid's bow
  const ulLeftGeo = new THREE.TorusGeometry(
    halfW * 0.5, upperLipHeight * 0.55, 8, 16, Math.PI
  );
  const ulLeft = new THREE.Mesh(ulLeftGeo, lipMat.clone());
  ulLeft.position.set(-halfW * 0.28, upperLipHeight * 0.2 + cornerLift * 0.006, lipDepth * 0.7);
  ulLeft.rotation.z = Math.PI + cupidsBow * 0.25;
  ulLeft.scale.set(0.9, 1 + cupidsBow * 0.3, 1);
  g.add(ulLeft);

  // Right peak of cupid's bow
  const ulRightGeo = new THREE.TorusGeometry(
    halfW * 0.5, upperLipHeight * 0.55, 8, 16, Math.PI
  );
  const ulRight = new THREE.Mesh(ulRightGeo, lipMat.clone());
  ulRight.position.set(halfW * 0.28, upperLipHeight * 0.2 + cornerLift * 0.006, lipDepth * 0.7);
  ulRight.rotation.z = Math.PI - cupidsBow * 0.25;
  ulRight.scale.set(0.9, 1 + cupidsBow * 0.3, 1);
  g.add(ulRight);

  // ── Lower lip ─────────────────────────────────────────────────────────────
  const llGeo = new THREE.TorusGeometry(
    halfW * 0.75, lowerLipHeight * 0.7, 8, 20, Math.PI
  );
  const ll = new THREE.Mesh(llGeo, lipMat.clone());
  ll.position.set(0, -(lowerLipHeight * 0.5) - openAmount * 0.008, lipDepth * 0.65);
  ll.rotation.z = 0;
  ll.scale.set(1, 0.9, 1);
  g.add(ll);

  // ── Lip line ──────────────────────────────────────────────────────────────
  const lineGeo = new THREE.CylinderGeometry(0.001, 0.001, width * 0.9, 8);
  const line = new THREE.Mesh(lineGeo, lineMat);
  line.rotation.z = Math.PI / 2;
  line.position.set(0, 0, lipDepth * 0.75);
  g.add(line);

  // ── Corner spheres ────────────────────────────────────────────────────────
  const cornerGeo = new THREE.SphereGeometry(upperLipHeight * 0.4, 8, 6);
  [-halfW * 0.88, halfW * 0.88].forEach((x, i) => {
    const corner = new THREE.Mesh(cornerGeo, lipMat.clone());
    corner.position.set(x, cornerLift * 0.005 * (i === 0 ? 1 : 1), lipDepth * 0.6);
    g.add(corner);
  });

  // ── Teeth (when open) ─────────────────────────────────────────────────────
  if (openAmount > 0.1) {
    const teethGeo = new THREE.BoxGeometry(width * 0.75, openAmount * 0.012, 0.006);
    const teeth = new THREE.Mesh(teethGeo, mkTeeth());
    teeth.position.set(0, -openAmount * 0.003, lipDepth * 0.3);
    g.add(teeth);
  }

  // ── Philtrum (subtle vertical groove above lip) ───────────────────────────
  const philGeo = new THREE.CylinderGeometry(0.002, 0.001, 0.012, 6);
  const phil = new THREE.Mesh(philGeo, mkSkin(skinColor));
  phil.position.set(0, upperLipHeight * 0.9, lipDepth * 0.4);
  g.add(phil);

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MOUTH LIBRARY  — 12 distinct mouth shapes
// ═══════════════════════════════════════════════════════════════════════════════

export const MOUTH_LIBRARY = [
  {
    id: 'mouth-neutral',
    label: 'Neutral',
    category: 'classic',
    description: 'Balanced, neutral mouth with natural proportions.',
    defaultLipColor: '#C0726A',
    build: (lipColor = '#C0726A', skinColor = '#C68642') => buildMouth({
      width: 0.040, upperLipHeight: 0.010, lowerLipHeight: 0.013,
      lipDepth: 0.010, cupidsBow: 0.4, cornerLift: 0.0,
      openAmount: 0.0, lipColor, skinColor,
    }),
  },
  {
    id: 'mouth-smile',
    label: 'Smile',
    category: 'expressive',
    description: 'Gentle upturned corners for a natural smile.',
    defaultLipColor: '#C0726A',
    build: (lipColor = '#C0726A', skinColor = '#C68642') => buildMouth({
      width: 0.044, upperLipHeight: 0.009, lowerLipHeight: 0.012,
      lipDepth: 0.010, cupidsBow: 0.3, cornerLift: 0.8,
      openAmount: 0.0, lipColor, skinColor,
    }),
  },
  {
    id: 'mouth-open-smile',
    label: 'Open Smile',
    category: 'expressive',
    description: 'Wide open smile showing teeth.',
    defaultLipColor: '#C0726A',
    build: (lipColor = '#C0726A', skinColor = '#C68642') => buildMouth({
      width: 0.048, upperLipHeight: 0.009, lowerLipHeight: 0.012,
      lipDepth: 0.010, cupidsBow: 0.3, cornerLift: 1.0,
      openAmount: 0.8, lipColor, skinColor,
    }),
  },
  {
    id: 'mouth-full-lips',
    label: 'Full Lips',
    category: 'prominent',
    description: 'Full, voluminous lips.',
    defaultLipColor: '#B85450',
    build: (lipColor = '#B85450', skinColor = '#C68642') => buildMouth({
      width: 0.044, upperLipHeight: 0.015, lowerLipHeight: 0.018,
      lipDepth: 0.014, cupidsBow: 0.6, cornerLift: 0.1,
      openAmount: 0.0, lipColor, skinColor,
    }),
  },
  {
    id: 'mouth-thin-lips',
    label: 'Thin Lips',
    category: 'slim',
    description: 'Thin, refined lips.',
    defaultLipColor: '#A0604A',
    build: (lipColor = '#A0604A', skinColor = '#C68642') => buildMouth({
      width: 0.038, upperLipHeight: 0.007, lowerLipHeight: 0.009,
      lipDepth: 0.007, cupidsBow: 0.3, cornerLift: 0.0,
      openAmount: 0.0, lipColor, skinColor,
    }),
  },
  {
    id: 'mouth-wide',
    label: 'Wide',
    category: 'prominent',
    description: 'Wide mouth spanning a broad smile.',
    defaultLipColor: '#C0726A',
    build: (lipColor = '#C0726A', skinColor = '#C68642') => buildMouth({
      width: 0.054, upperLipHeight: 0.010, lowerLipHeight: 0.013,
      lipDepth: 0.010, cupidsBow: 0.3, cornerLift: 0.2,
      openAmount: 0.0, lipColor, skinColor,
    }),
  },
  {
    id: 'mouth-small',
    label: 'Small',
    category: 'delicate',
    description: 'Small, delicate mouth.',
    defaultLipColor: '#C0726A',
    build: (lipColor = '#C0726A', skinColor = '#C68642') => buildMouth({
      width: 0.030, upperLipHeight: 0.009, lowerLipHeight: 0.011,
      lipDepth: 0.009, cupidsBow: 0.5, cornerLift: 0.0,
      openAmount: 0.0, lipColor, skinColor,
    }),
  },
  {
    id: 'mouth-cupids-bow',
    label: "Cupid's Bow",
    category: 'classic',
    description: 'Pronounced cupid\'s bow upper lip.',
    defaultLipColor: '#B85450',
    build: (lipColor = '#B85450', skinColor = '#C68642') => buildMouth({
      width: 0.040, upperLipHeight: 0.012, lowerLipHeight: 0.014,
      lipDepth: 0.011, cupidsBow: 1.0, cornerLift: 0.1,
      openAmount: 0.0, lipColor, skinColor,
    }),
  },
  {
    id: 'mouth-downturned',
    label: 'Downturned',
    category: 'expressive',
    description: 'Corners turned downward for a serious expression.',
    defaultLipColor: '#A0604A',
    build: (lipColor = '#A0604A', skinColor = '#C68642') => buildMouth({
      width: 0.040, upperLipHeight: 0.010, lowerLipHeight: 0.013,
      lipDepth: 0.010, cupidsBow: 0.2, cornerLift: -0.8,
      openAmount: 0.0, lipColor, skinColor,
    }),
  },
  {
    id: 'mouth-pouty',
    label: 'Pouty',
    category: 'prominent',
    description: 'Pouty lips with a slight forward protrusion.',
    defaultLipColor: '#C85A6A',
    build: (lipColor = '#C85A6A', skinColor = '#C68642') => buildMouth({
      width: 0.038, upperLipHeight: 0.014, lowerLipHeight: 0.018,
      lipDepth: 0.016, cupidsBow: 0.7, cornerLift: -0.2,
      openAmount: 0.1, lipColor, skinColor,
    }),
  },
  {
    id: 'mouth-asymmetric',
    label: 'Asymmetric',
    category: 'expressive',
    description: 'Slightly asymmetric mouth for a natural, character-rich look.',
    defaultLipColor: '#C0726A',
    build: (lipColor = '#C0726A', skinColor = '#C68642') => {
      const g = buildMouth({
        width: 0.040, upperLipHeight: 0.010, lowerLipHeight: 0.013,
        lipDepth: 0.010, cupidsBow: 0.4, cornerLift: 0.3,
        openAmount: 0.0, lipColor, skinColor,
      });
      g.rotation.z = 0.04; // subtle tilt
      return g;
    },
  },
  {
    id: 'mouth-open-neutral',
    label: 'Open Neutral',
    category: 'expressive',
    description: 'Slightly open mouth in a neutral expression.',
    defaultLipColor: '#C0726A',
    build: (lipColor = '#C0726A', skinColor = '#C68642') => buildMouth({
      width: 0.040, upperLipHeight: 0.010, lowerLipHeight: 0.013,
      lipDepth: 0.010, cupidsBow: 0.4, cornerLift: 0.0,
      openAmount: 0.4, lipColor, skinColor,
    }),
  },
];

// ─── Lip colour palette ───────────────────────────────────────────────────────

export const LIP_COLORS = [
  { id: 'nude-light',   label: 'Nude Light',    hex: '#E8C4A8' },
  { id: 'nude-med',     label: 'Nude Medium',   hex: '#C0906A' },
  { id: 'nude-dark',    label: 'Nude Dark',     hex: '#8B5E3C' },
  { id: 'pink-light',   label: 'Baby Pink',     hex: '#F4A7B9' },
  { id: 'pink-med',     label: 'Rose Pink',     hex: '#E8728A' },
  { id: 'pink-hot',     label: 'Hot Pink',      hex: '#E91E8C' },
  { id: 'red-classic',  label: 'Classic Red',   hex: '#C0392B' },
  { id: 'red-dark',     label: 'Dark Red',      hex: '#8B0000' },
  { id: 'berry',        label: 'Berry',         hex: '#8E44AD' },
  { id: 'plum',         label: 'Plum',          hex: '#6C3483' },
  { id: 'coral',        label: 'Coral',         hex: '#E8724A' },
  { id: 'peach',        label: 'Peach',         hex: '#F0A080' },
  { id: 'mauve',        label: 'Mauve',         hex: '#B07090' },
  { id: 'brown',        label: 'Brown',         hex: '#7B4A2A' },
  { id: 'black',        label: 'Black',         hex: '#1A1A1A' },
  { id: 'gloss-clear',  label: 'Clear Gloss',   hex: '#F8E8D8' },
];
