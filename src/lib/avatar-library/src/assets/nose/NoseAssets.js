/**
 * NoseAssets.js
 * Library of 3D nose models built procedurally with Three.js.
 * Each nose is a Group containing:
 *   - Bridge      — tapered cylinder/box
 *   - Tip         — sphere
 *   - Left nostril — torus/sphere
 *   - Right nostril — torus/sphere
 *   - Columella   — thin bridge between nostrils
 *
 * All geometry is skin-coloured and inherits the avatar's skin tone.
 */

import * as THREE from 'three';

// ─── Material factory ─────────────────────────────────────────────────────────

function mkSkin(hex = '#C68642') {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex),
    roughness: 0.65,
    metalness: 0.0,
  });
}

// ─── Core nose builder ────────────────────────────────────────────────────────

/**
 * @param {object} cfg
 * @param {number} cfg.bridgeWidth      width at top of bridge
 * @param {number} cfg.bridgeHeight     vertical length of bridge
 * @param {number} cfg.bridgeDepth      forward protrusion of bridge
 * @param {number} cfg.tipRadius        sphere radius of nose tip
 * @param {number} cfg.tipOffset        forward offset of tip beyond bridge
 * @param {number} cfg.nostrilRadius    size of each nostril
 * @param {number} cfg.nostrilSpread    horizontal distance between nostrils
 * @param {number} cfg.nostrilFlare     outward flare (scale x)
 * @param {number} cfg.bridgeCurve      0 = straight, 1 = concave, -1 = convex (Roman)
 * @param {string} cfg.skinColor
 */
function buildNose(cfg) {
  const g = new THREE.Group();
  g.name = 'nose';

  const {
    bridgeWidth = 0.022,
    bridgeHeight = 0.045,
    bridgeDepth = 0.018,
    tipRadius = 0.018,
    tipOffset = 0.006,
    nostrilRadius = 0.010,
    nostrilSpread = 0.016,
    nostrilFlare = 1.0,
    bridgeCurve = 0,
    skinColor = '#C68642',
  } = cfg;

  const mat = mkSkin(skinColor);

  // ── Bridge ────────────────────────────────────────────────────────────────
  const bridgeGeo = new THREE.CylinderGeometry(
    bridgeWidth * 0.5,
    bridgeWidth * 0.85,
    bridgeHeight,
    10, 4
  );
  const bridge = new THREE.Mesh(bridgeGeo, mat.clone());
  bridge.name = 'bridge';
  bridge.position.set(0, bridgeHeight * 0.5, bridgeDepth * 0.3);
  bridge.rotation.x = -0.12 + bridgeCurve * 0.08;
  g.add(bridge);

  // ── Tip ───────────────────────────────────────────────────────────────────
  const tipGeo = new THREE.SphereGeometry(tipRadius, 16, 12);
  const tip = new THREE.Mesh(tipGeo, mat.clone());
  tip.name = 'tip';
  tip.position.set(0, 0, bridgeDepth + tipOffset);
  tip.scale.set(1.0, 0.85, 1.0);
  g.add(tip);

  // ── Left nostril ──────────────────────────────────────────────────────────
  const nostrilGeo = new THREE.SphereGeometry(nostrilRadius, 12, 10);
  const nostrilL = new THREE.Mesh(nostrilGeo, mat.clone());
  nostrilL.name = 'nostrilL';
  nostrilL.position.set(-nostrilSpread, -tipRadius * 0.3, bridgeDepth * 0.7);
  nostrilL.scale.set(nostrilFlare, 0.7, 0.9);
  g.add(nostrilL);

  // ── Right nostril ─────────────────────────────────────────────────────────
  const nostrilR = new THREE.Mesh(nostrilGeo.clone(), mat.clone());
  nostrilR.name = 'nostrilR';
  nostrilR.position.set(nostrilSpread, -tipRadius * 0.3, bridgeDepth * 0.7);
  nostrilR.scale.set(nostrilFlare, 0.7, 0.9);
  g.add(nostrilR);

  // ── Columella (between nostrils) ──────────────────────────────────────────
  const colGeo = new THREE.CylinderGeometry(0.004, 0.004, nostrilSpread * 1.8, 8);
  const col = new THREE.Mesh(colGeo, mat.clone());
  col.name = 'columella';
  col.rotation.z = Math.PI / 2;
  col.position.set(0, -tipRadius * 0.5, bridgeDepth * 0.55);
  g.add(col);

  return g;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  NOSE LIBRARY  — 12 distinct nose shapes
// ═══════════════════════════════════════════════════════════════════════════════

export const NOSE_LIBRARY = [
  {
    id: 'nose-straight',
    label: 'Straight',
    category: 'classic',
    description: 'A straight, balanced nose with even proportions.',
    build: (skinColor = '#C68642') => buildNose({
      bridgeWidth: 0.022, bridgeHeight: 0.046, bridgeDepth: 0.018,
      tipRadius: 0.017, tipOffset: 0.005,
      nostrilRadius: 0.010, nostrilSpread: 0.015, nostrilFlare: 1.0,
      bridgeCurve: 0, skinColor,
    }),
  },
  {
    id: 'nose-button',
    label: 'Button',
    category: 'small',
    description: 'Small, rounded button nose.',
    build: (skinColor = '#C68642') => buildNose({
      bridgeWidth: 0.016, bridgeHeight: 0.030, bridgeDepth: 0.014,
      tipRadius: 0.015, tipOffset: 0.006,
      nostrilRadius: 0.008, nostrilSpread: 0.012, nostrilFlare: 0.9,
      bridgeCurve: 0.1, skinColor,
    }),
  },
  {
    id: 'nose-roman',
    label: 'Roman',
    category: 'prominent',
    description: 'Prominent nose with a convex bridge curve.',
    build: (skinColor = '#C68642') => buildNose({
      bridgeWidth: 0.024, bridgeHeight: 0.052, bridgeDepth: 0.022,
      tipRadius: 0.018, tipOffset: 0.004,
      nostrilRadius: 0.010, nostrilSpread: 0.015, nostrilFlare: 1.0,
      bridgeCurve: -0.8, skinColor,
    }),
  },
  {
    id: 'nose-snub',
    label: 'Snub',
    category: 'small',
    description: 'Short, upturned snub nose.',
    build: (skinColor = '#C68642') => buildNose({
      bridgeWidth: 0.018, bridgeHeight: 0.032, bridgeDepth: 0.016,
      tipRadius: 0.016, tipOffset: 0.008,
      nostrilRadius: 0.010, nostrilSpread: 0.014, nostrilFlare: 1.1,
      bridgeCurve: 0.5, skinColor,
    }),
  },
  {
    id: 'nose-wide',
    label: 'Wide',
    category: 'broad',
    description: 'Wide nose with flared nostrils.',
    build: (skinColor = '#C68642') => buildNose({
      bridgeWidth: 0.030, bridgeHeight: 0.042, bridgeDepth: 0.016,
      tipRadius: 0.022, tipOffset: 0.004,
      nostrilRadius: 0.014, nostrilSpread: 0.022, nostrilFlare: 1.4,
      bridgeCurve: 0, skinColor,
    }),
  },
  {
    id: 'nose-narrow',
    label: 'Narrow',
    category: 'slim',
    description: 'Slim, narrow nose with a refined bridge.',
    build: (skinColor = '#C68642') => buildNose({
      bridgeWidth: 0.015, bridgeHeight: 0.048, bridgeDepth: 0.020,
      tipRadius: 0.014, tipOffset: 0.005,
      nostrilRadius: 0.008, nostrilSpread: 0.011, nostrilFlare: 0.85,
      bridgeCurve: 0, skinColor,
    }),
  },
  {
    id: 'nose-hawk',
    label: 'Hawk',
    category: 'prominent',
    description: 'Aquiline hawk nose with a pronounced downward curve.',
    build: (skinColor = '#C68642') => buildNose({
      bridgeWidth: 0.020, bridgeHeight: 0.055, bridgeDepth: 0.024,
      tipRadius: 0.016, tipOffset: 0.002,
      nostrilRadius: 0.009, nostrilSpread: 0.013, nostrilFlare: 0.95,
      bridgeCurve: -1.2, skinColor,
    }),
  },
  {
    id: 'nose-bulbous',
    label: 'Bulbous',
    category: 'broad',
    description: 'Large, rounded bulbous tip.',
    build: (skinColor = '#C68642') => buildNose({
      bridgeWidth: 0.024, bridgeHeight: 0.040, bridgeDepth: 0.018,
      tipRadius: 0.026, tipOffset: 0.008,
      nostrilRadius: 0.013, nostrilSpread: 0.018, nostrilFlare: 1.2,
      bridgeCurve: 0, skinColor,
    }),
  },
  {
    id: 'nose-celestial',
    label: 'Celestial',
    category: 'small',
    description: 'Delicate, slightly upturned celestial nose.',
    build: (skinColor = '#C68642') => buildNose({
      bridgeWidth: 0.017, bridgeHeight: 0.034, bridgeDepth: 0.015,
      tipRadius: 0.015, tipOffset: 0.009,
      nostrilRadius: 0.009, nostrilSpread: 0.013, nostrilFlare: 1.0,
      bridgeCurve: 0.6, skinColor,
    }),
  },
  {
    id: 'nose-flat',
    label: 'Flat',
    category: 'broad',
    description: 'Flat, low-bridge nose with wide nostrils.',
    build: (skinColor = '#C68642') => buildNose({
      bridgeWidth: 0.028, bridgeHeight: 0.028, bridgeDepth: 0.010,
      tipRadius: 0.020, tipOffset: 0.003,
      nostrilRadius: 0.013, nostrilSpread: 0.020, nostrilFlare: 1.3,
      bridgeCurve: 0.2, skinColor,
    }),
  },
  {
    id: 'nose-greek',
    label: 'Greek',
    category: 'classic',
    description: 'Perfectly straight Greek-ideal nose.',
    build: (skinColor = '#C68642') => buildNose({
      bridgeWidth: 0.020, bridgeHeight: 0.050, bridgeDepth: 0.019,
      tipRadius: 0.016, tipOffset: 0.004,
      nostrilRadius: 0.009, nostrilSpread: 0.013, nostrilFlare: 0.9,
      bridgeCurve: 0, skinColor,
    }),
  },
  {
    id: 'nose-nubian',
    label: 'Nubian',
    category: 'broad',
    description: 'Long bridge with a wide, rounded base.',
    build: (skinColor = '#C68642') => buildNose({
      bridgeWidth: 0.020, bridgeHeight: 0.054, bridgeDepth: 0.020,
      tipRadius: 0.022, tipOffset: 0.006,
      nostrilRadius: 0.014, nostrilSpread: 0.021, nostrilFlare: 1.35,
      bridgeCurve: 0, skinColor,
    }),
  },
];
