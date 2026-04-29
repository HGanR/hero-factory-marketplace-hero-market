/**
 * EyeAssets.js
 * Library of 3D eye models.
 * Each eye is a Three.js Group containing:
 *   - Sclera (white)  — flattened sphere
 *   - Iris            — coloured disc
 *   - Pupil           — dark disc
 *   - Upper eyelid    — curved shell
 *   - Lower eyelid    — curved shell
 *   - Eyelashes       — thin extruded curves
 *
 * Eyes are built procedurally so they are fully colour-customisable.
 */

import * as THREE from 'three';

// ─── Shared material factories ────────────────────────────────────────────────

const mkSclera = () => new THREE.MeshStandardMaterial({ color: 0xfaf5f0, roughness: 0.3, metalness: 0.0 });
const mkIris   = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.05 });
const mkPupil  = () => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.2, metalness: 0.0 });
const mkLid    = (skinHex) => new THREE.MeshStandardMaterial({ color: new THREE.Color(skinHex), roughness: 0.6, metalness: 0.0 });
const mkLash   = () => new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8, metalness: 0.0 });

// ─── Core eye builder ─────────────────────────────────────────────────────────

/**
 * Builds a single eye group.
 * @param {object} cfg
 * @param {number}  cfg.scleraRx      horizontal radius
 * @param {number}  cfg.scleraRy      vertical radius
 * @param {number}  cfg.scleraRz      depth radius
 * @param {number}  cfg.irisRadius
 * @param {number}  cfg.pupilRadius
 * @param {string}  cfg.irisColor     hex string
 * @param {string}  cfg.skinColor     hex string for lids
 * @param {number}  cfg.lidUpperCurve 0–1 how arched the upper lid is
 * @param {number}  cfg.lidLowerCurve 0–1 how curved the lower lid is
 * @param {boolean} cfg.lashes        whether to add lashes
 * @param {number}  cfg.lashCount
 * @param {number}  cfg.tiltAngle     rotation.z in radians (almond tilt)
 * @param {number}  cfg.epicanthicFold  0–1 inner corner fold amount
 */
function buildEye(cfg) {
  const g = new THREE.Group();

  const {
    scleraRx = 0.028, scleraRy = 0.020, scleraRz = 0.016,
    irisRadius = 0.013, pupilRadius = 0.007,
    irisColor = '#5B8DB8', skinColor = '#C68642',
    lidUpperCurve = 0.5, lidLowerCurve = 0.3,
    lashes = true, lashCount = 12,
    tiltAngle = 0,
  } = cfg;

  // ── Sclera ────────────────────────────────────────────────────────────────
  const scleraGeo = new THREE.SphereGeometry(1, 24, 18);
  scleraGeo.scale(scleraRx, scleraRy, scleraRz);
  const sclera = new THREE.Mesh(scleraGeo, mkSclera());
  sclera.name = 'sclera';
  g.add(sclera);

  // ── Iris ──────────────────────────────────────────────────────────────────
  const irisGeo = new THREE.CircleGeometry(irisRadius, 32);
  const iris = new THREE.Mesh(irisGeo, mkIris(new THREE.Color(irisColor)));
  iris.position.z = scleraRz * 0.95;
  iris.name = 'iris';
  g.add(iris);

  // ── Pupil ─────────────────────────────────────────────────────────────────
  const pupilGeo = new THREE.CircleGeometry(pupilRadius, 24);
  const pupil = new THREE.Mesh(pupilGeo, mkPupil());
  pupil.position.z = scleraRz * 0.97;
  pupil.name = 'pupil';
  g.add(pupil);

  // ── Highlight (specular dot) ───────────────────────────────────────────────
  const hlGeo = new THREE.CircleGeometry(pupilRadius * 0.35, 12);
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const hl = new THREE.Mesh(hlGeo, hlMat);
  hl.position.set(irisRadius * 0.3, irisRadius * 0.3, scleraRz * 0.98);
  g.add(hl);

  // ── Upper Eyelid ──────────────────────────────────────────────────────────
  const upperLidGeo = new THREE.TorusGeometry(scleraRx * 0.9, scleraRy * 0.25, 8, 24, Math.PI);
  const upperLid = new THREE.Mesh(upperLidGeo, mkLid(skinColor));
  upperLid.position.y = scleraRy * lidUpperCurve * 0.3;
  upperLid.position.z = scleraRz * 0.5;
  upperLid.rotation.z = Math.PI;
  upperLid.name = 'upperLid';
  g.add(upperLid);

  // ── Lower Eyelid ──────────────────────────────────────────────────────────
  const lowerLidGeo = new THREE.TorusGeometry(scleraRx * 0.9, scleraRy * 0.18, 8, 24, Math.PI);
  const lowerLid = new THREE.Mesh(lowerLidGeo, mkLid(skinColor));
  lowerLid.position.y = -scleraRy * lidLowerCurve * 0.3;
  lowerLid.position.z = scleraRz * 0.5;
  lowerLid.name = 'lowerLid';
  g.add(lowerLid);

  // ── Eyelashes ─────────────────────────────────────────────────────────────
  if (lashes) {
    for (let i = 0; i < lashCount; i++) {
      const t = (i / (lashCount - 1)) * Math.PI; // 0 → π along upper arc
      const lx = Math.cos(t) * scleraRx * 0.88;
      const ly = Math.sin(t) * scleraRy * 0.5 + scleraRy * 0.15;
      const lashLen = 0.006 + Math.sin(t) * 0.004;
      const lashGeo = new THREE.CylinderGeometry(0.0005, 0.0001, lashLen, 4);
      const lash = new THREE.Mesh(lashGeo, mkLash());
      lash.position.set(lx, ly, scleraRz * 0.6);
      lash.rotation.z = -Math.cos(t) * 0.5;
      lash.rotation.x = -0.3;
      g.add(lash);
    }
  }

  // ── Overall tilt ──────────────────────────────────────────────────────────
  g.rotation.z = tiltAngle;

  return g;
}

// ─── Pair builder (left + right) ─────────────────────────────────────────────

function buildEyePair(cfg) {
  const group = new THREE.Group();
  group.name = 'eyes';

  const left  = buildEye(cfg);
  const right = buildEye(cfg);

  left.name  = 'eyeLeft';
  right.name = 'eyeRight';

  // Mirror right eye tilt
  right.rotation.z = -cfg.tiltAngle || 0;

  left.position.x  = -0.031;
  right.position.x =  0.031;

  group.add(left);
  group.add(right);
  return group;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EYE LIBRARY  — 12 distinct eye shapes
// ═══════════════════════════════════════════════════════════════════════════════

export const EYE_LIBRARY = [
  {
    id: 'eye-almond',
    label: 'Almond',
    category: 'classic',
    thumbnail: '👁️',
    description: 'Classic almond-shaped eyes with a gentle upward tilt.',
    defaultIrisColor: '#5B8DB8',
    build: (irisColor = '#5B8DB8', skinColor = '#C68642') => buildEyePair({
      scleraRx: 0.028, scleraRy: 0.018, scleraRz: 0.014,
      irisRadius: 0.013, pupilRadius: 0.007,
      irisColor, skinColor,
      lidUpperCurve: 0.55, lidLowerCurve: 0.25,
      lashes: true, lashCount: 14,
      tiltAngle: 0.08,
    }),
  },
  {
    id: 'eye-round',
    label: 'Round',
    category: 'classic',
    thumbnail: '👁️',
    description: 'Wide, round eyes with a youthful, open appearance.',
    defaultIrisColor: '#4A7C59',
    build: (irisColor = '#4A7C59', skinColor = '#C68642') => buildEyePair({
      scleraRx: 0.026, scleraRy: 0.024, scleraRz: 0.016,
      irisRadius: 0.015, pupilRadius: 0.008,
      irisColor, skinColor,
      lidUpperCurve: 0.7, lidLowerCurve: 0.4,
      lashes: true, lashCount: 16,
      tiltAngle: 0.0,
    }),
  },
  {
    id: 'eye-hooded',
    label: 'Hooded',
    category: 'classic',
    thumbnail: '👁️',
    description: 'Hooded eyes with a prominent upper lid fold.',
    defaultIrisColor: '#7B5E3A',
    build: (irisColor = '#7B5E3A', skinColor = '#C68642') => buildEyePair({
      scleraRx: 0.027, scleraRy: 0.016, scleraRz: 0.013,
      irisRadius: 0.012, pupilRadius: 0.007,
      irisColor, skinColor,
      lidUpperCurve: 0.9, lidLowerCurve: 0.2,
      lashes: true, lashCount: 12,
      tiltAngle: -0.04,
    }),
  },
  {
    id: 'eye-monolid',
    label: 'Monolid',
    category: 'classic',
    thumbnail: '👁️',
    description: 'Smooth monolid with no visible crease.',
    defaultIrisColor: '#2C1810',
    build: (irisColor = '#2C1810', skinColor = '#C68642') => buildEyePair({
      scleraRx: 0.030, scleraRy: 0.015, scleraRz: 0.012,
      irisRadius: 0.013, pupilRadius: 0.008,
      irisColor, skinColor,
      lidUpperCurve: 0.2, lidLowerCurve: 0.15,
      lashes: true, lashCount: 10,
      tiltAngle: 0.05,
    }),
  },
  {
    id: 'eye-upturned',
    label: 'Upturned',
    category: 'expressive',
    thumbnail: '👁️',
    description: 'Outer corners tilt upward for a feline look.',
    defaultIrisColor: '#6B4E3D',
    build: (irisColor = '#6B4E3D', skinColor = '#C68642') => buildEyePair({
      scleraRx: 0.028, scleraRy: 0.019, scleraRz: 0.014,
      irisRadius: 0.013, pupilRadius: 0.007,
      irisColor, skinColor,
      lidUpperCurve: 0.6, lidLowerCurve: 0.3,
      lashes: true, lashCount: 14,
      tiltAngle: 0.18,
    }),
  },
  {
    id: 'eye-downturned',
    label: 'Downturned',
    category: 'expressive',
    thumbnail: '👁️',
    description: 'Outer corners droop slightly for a soft, gentle look.',
    defaultIrisColor: '#3D6B5E',
    build: (irisColor = '#3D6B5E', skinColor = '#C68642') => buildEyePair({
      scleraRx: 0.028, scleraRy: 0.019, scleraRz: 0.014,
      irisRadius: 0.013, pupilRadius: 0.007,
      irisColor, skinColor,
      lidUpperCurve: 0.5, lidLowerCurve: 0.35,
      lashes: true, lashCount: 14,
      tiltAngle: -0.18,
    }),
  },
  {
    id: 'eye-deep-set',
    label: 'Deep-Set',
    category: 'classic',
    thumbnail: '👁️',
    description: 'Eyes set deeper into the skull with prominent brow ridge.',
    defaultIrisColor: '#4A5568',
    build: (irisColor = '#4A5568', skinColor = '#C68642') => buildEyePair({
      scleraRx: 0.025, scleraRy: 0.018, scleraRz: 0.010,
      irisRadius: 0.012, pupilRadius: 0.007,
      irisColor, skinColor,
      lidUpperCurve: 0.8, lidLowerCurve: 0.2,
      lashes: true, lashCount: 12,
      tiltAngle: 0.02,
    }),
  },
  {
    id: 'eye-wide-set',
    label: 'Wide-Set',
    category: 'classic',
    thumbnail: '👁️',
    description: 'Eyes spaced further apart for a distinctive look.',
    defaultIrisColor: '#7EB8C9',
    build: (irisColor = '#7EB8C9', skinColor = '#C68642') => {
      const group = buildEyePair({
        scleraRx: 0.027, scleraRy: 0.020, scleraRz: 0.015,
        irisRadius: 0.013, pupilRadius: 0.007,
        irisColor, skinColor,
        lidUpperCurve: 0.55, lidLowerCurve: 0.28,
        lashes: true, lashCount: 13,
        tiltAngle: 0.04,
      });
      group.children[0].position.x = -0.042;
      group.children[1].position.x =  0.042;
      return group;
    },
  },
  {
    id: 'eye-close-set',
    label: 'Close-Set',
    category: 'classic',
    thumbnail: '👁️',
    description: 'Eyes placed closer together.',
    defaultIrisColor: '#8B6914',
    build: (irisColor = '#8B6914', skinColor = '#C68642') => {
      const group = buildEyePair({
        scleraRx: 0.027, scleraRy: 0.020, scleraRz: 0.015,
        irisRadius: 0.013, pupilRadius: 0.007,
        irisColor, skinColor,
        lidUpperCurve: 0.55, lidLowerCurve: 0.28,
        lashes: true, lashCount: 13,
        tiltAngle: 0.04,
      });
      group.children[0].position.x = -0.022;
      group.children[1].position.x =  0.022;
      return group;
    },
  },
  {
    id: 'eye-large',
    label: 'Large',
    category: 'expressive',
    thumbnail: '👁️',
    description: 'Oversized expressive eyes.',
    defaultIrisColor: '#6C3483',
    build: (irisColor = '#6C3483', skinColor = '#C68642') => buildEyePair({
      scleraRx: 0.034, scleraRy: 0.028, scleraRz: 0.018,
      irisRadius: 0.018, pupilRadius: 0.010,
      irisColor, skinColor,
      lidUpperCurve: 0.65, lidLowerCurve: 0.4,
      lashes: true, lashCount: 18,
      tiltAngle: 0.0,
    }),
  },
  {
    id: 'eye-narrow',
    label: 'Narrow',
    category: 'expressive',
    thumbnail: '👁️',
    description: 'Narrow, intense eyes with a focused gaze.',
    defaultIrisColor: '#1A5276',
    build: (irisColor = '#1A5276', skinColor = '#C68642') => buildEyePair({
      scleraRx: 0.030, scleraRy: 0.013, scleraRz: 0.011,
      irisRadius: 0.011, pupilRadius: 0.006,
      irisColor, skinColor,
      lidUpperCurve: 0.4, lidLowerCurve: 0.15,
      lashes: true, lashCount: 10,
      tiltAngle: 0.06,
    }),
  },
  {
    id: 'eye-protruding',
    label: 'Protruding',
    category: 'expressive',
    thumbnail: '👁️',
    description: 'Prominent, forward-set eyes.',
    defaultIrisColor: '#27AE60',
    build: (irisColor = '#27AE60', skinColor = '#C68642') => buildEyePair({
      scleraRx: 0.030, scleraRy: 0.026, scleraRz: 0.022,
      irisRadius: 0.016, pupilRadius: 0.009,
      irisColor, skinColor,
      lidUpperCurve: 0.5, lidLowerCurve: 0.35,
      lashes: true, lashCount: 15,
      tiltAngle: 0.0,
    }),
  },
];

// ─── Eye colour palette ───────────────────────────────────────────────────────

export const EYE_COLORS = [
  { id: 'brown-dark',   label: 'Dark Brown',   hex: '#2C1810' },
  { id: 'brown-med',    label: 'Brown',        hex: '#7B5E3A' },
  { id: 'brown-light',  label: 'Light Brown',  hex: '#A0785A' },
  { id: 'hazel',        label: 'Hazel',        hex: '#8B6914' },
  { id: 'amber',        label: 'Amber',        hex: '#C8860A' },
  { id: 'green-dark',   label: 'Forest Green', hex: '#2E7D32' },
  { id: 'green-med',    label: 'Green',        hex: '#4A7C59' },
  { id: 'green-light',  label: 'Sage',         hex: '#7EB8A0' },
  { id: 'blue-dark',    label: 'Navy Blue',    hex: '#1A5276' },
  { id: 'blue-med',     label: 'Blue',         hex: '#2980B9' },
  { id: 'blue-light',   label: 'Ice Blue',     hex: '#7EB8C9' },
  { id: 'grey',         label: 'Grey',         hex: '#7F8C8D' },
  { id: 'grey-blue',    label: 'Blue-Grey',    hex: '#4A5568' },
  { id: 'violet',       label: 'Violet',       hex: '#6C3483' },
  { id: 'teal',         label: 'Teal',         hex: '#148F77' },
  { id: 'black',        label: 'Black',        hex: '#0A0A0A' },
];
