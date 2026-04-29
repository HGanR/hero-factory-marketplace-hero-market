/**
 * GlassesAssets.js
 * Glasses + Sunglasses library — 8 glasses + 8 sunglasses
 */
import * as THREE from 'three';

function mkFrame(hex, roughness = 0.5, metalness = 0.1) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness, metalness });
}
function mkLens(hex, opacity = 0.15, tint = false) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex), roughness: 0.05, metalness: 0.1,
    transparent: true, opacity: tint ? 0.65 : opacity,
  });
}

// ─── Core frame builder ───────────────────────────────────────────────────────

function buildFrames(cfg) {
  const g = new THREE.Group();
  const {
    lensW = 0.030, lensH = 0.022, lensShape = 'round',
    frameColor = '#111111', lensColor = '#88BBDD',
    lensOpacity = 0.15, frameThickness = 0.004,
    bridgeWidth = 0.018, templeLength = 0.085,
    lensOffsetY = 0, tiltAngle = 0,
  } = cfg;

  const frameMat = mkFrame(frameColor);
  const lensMat  = mkLens(lensColor, lensOpacity);

  // ── Lenses ────────────────────────────────────────────────────────────────
  [-1, 1].forEach(side => {
    let lensGeo;
    if (lensShape === 'round') {
      lensGeo = new THREE.CircleGeometry(lensW * 0.5, 24);
    } else if (lensShape === 'square') {
      lensGeo = new THREE.PlaneGeometry(lensW, lensH);
    } else if (lensShape === 'cat-eye') {
      lensGeo = new THREE.CircleGeometry(lensW * 0.5, 24);
    } else if (lensShape === 'aviator') {
      lensGeo = new THREE.CircleGeometry(lensW * 0.5, 24);
    } else {
      lensGeo = new THREE.CircleGeometry(lensW * 0.5, 24);
    }
    const lens = new THREE.Mesh(lensGeo, lensMat.clone());
    lens.position.set(side * (lensW * 0.55 + bridgeWidth * 0.5), lensOffsetY, 0.001);
    if (lensShape === 'cat-eye') lens.scale.set(1.0, 0.8, 1);
    if (lensShape === 'aviator') lens.scale.set(1.0, 1.3, 1);
    lens.rotation.z = side * tiltAngle;
    g.add(lens);

    // Frame ring
    const ringGeo = new THREE.TorusGeometry(
      lensShape === 'round' ? lensW * 0.5 : lensW * 0.55,
      frameThickness, 8, 24
    );
    const ring = new THREE.Mesh(ringGeo, frameMat.clone());
    ring.position.copy(lens.position);
    ring.position.z = 0;
    if (lensShape === 'cat-eye') ring.scale.set(1.0, 0.8, 1);
    if (lensShape === 'aviator') ring.scale.set(1.0, 1.3, 1);
    ring.rotation.z = side * tiltAngle;
    g.add(ring);
  });

  // ── Bridge ────────────────────────────────────────────────────────────────
  const bridgeGeo = new THREE.CylinderGeometry(frameThickness * 0.8, frameThickness * 0.8, bridgeWidth, 8);
  const bridge = new THREE.Mesh(bridgeGeo, frameMat.clone());
  bridge.rotation.z = Math.PI / 2;
  bridge.position.set(0, lensOffsetY, 0);
  g.add(bridge);

  // ── Temples (arms) ────────────────────────────────────────────────────────
  [-1, 1].forEach(side => {
    const templeGeo = new THREE.CylinderGeometry(frameThickness * 0.6, frameThickness * 0.4, templeLength, 6);
    const temple = new THREE.Mesh(templeGeo, frameMat.clone());
    temple.rotation.z = Math.PI / 2;
    temple.position.set(side * (lensW * 0.55 + bridgeWidth * 0.5 + templeLength * 0.5), lensOffsetY, -0.005);
    g.add(temple);
  });

  // ── Nose pads ─────────────────────────────────────────────────────────────
  [-1, 1].forEach(side => {
    const padGeo = new THREE.SphereGeometry(0.003, 6, 4);
    const pad = new THREE.Mesh(padGeo, mkFrame('#CCCCCC', 0.3, 0.2));
    pad.position.set(side * 0.010, lensOffsetY - 0.010, 0.008);
    g.add(pad);
  });

  return g;
}

// ─── Glasses definitions ──────────────────────────────────────────────────────

export const GLASSES_LIBRARY = [
  {
    id: 'glasses-round',
    label: 'Round',
    category: 'classic',
    thumbnail: '🔵',
    description: 'Classic round wire-frame glasses.',
    build: (frameColor = '#8B6914', lensColor = '#88BBDD') => buildFrames({
      lensW: 0.028, lensH: 0.028, lensShape: 'round',
      frameColor, lensColor, lensOpacity: 0.12,
      frameThickness: 0.003, bridgeWidth: 0.016,
    }),
  },
  {
    id: 'glasses-square',
    label: 'Square',
    category: 'classic',
    thumbnail: '🔲',
    description: 'Bold square frames.',
    build: (frameColor = '#111111', lensColor = '#88BBDD') => buildFrames({
      lensW: 0.034, lensH: 0.024, lensShape: 'square',
      frameColor, lensColor, lensOpacity: 0.12,
      frameThickness: 0.005, bridgeWidth: 0.018,
    }),
  },
  {
    id: 'glasses-cat-eye',
    label: 'Cat Eye',
    category: 'fashion',
    thumbnail: '😸',
    description: 'Retro cat-eye frames.',
    build: (frameColor = '#C0392B', lensColor = '#88BBDD') => buildFrames({
      lensW: 0.032, lensH: 0.022, lensShape: 'cat-eye',
      frameColor, lensColor, lensOpacity: 0.12,
      frameThickness: 0.005, bridgeWidth: 0.016,
      tiltAngle: 0.15,
    }),
  },
  {
    id: 'glasses-oval',
    label: 'Oval',
    category: 'classic',
    thumbnail: '⭕',
    description: 'Soft oval frames.',
    build: (frameColor = '#4A3728', lensColor = '#88BBDD') => buildFrames({
      lensW: 0.030, lensH: 0.022, lensShape: 'round',
      frameColor, lensColor, lensOpacity: 0.12,
      frameThickness: 0.004, bridgeWidth: 0.016,
    }),
  },
  {
    id: 'glasses-rimless',
    label: 'Rimless',
    category: 'minimal',
    thumbnail: '🔍',
    description: 'Minimalist rimless glasses.',
    build: (frameColor = '#C0C0C0', lensColor = '#AADDFF') => buildFrames({
      lensW: 0.030, lensH: 0.022, lensShape: 'round',
      frameColor, lensColor, lensOpacity: 0.08,
      frameThickness: 0.001, bridgeWidth: 0.016,
    }),
  },
  {
    id: 'glasses-browline',
    label: 'Browline',
    category: 'classic',
    thumbnail: '🕶️',
    description: 'Half-frame browline glasses.',
    build: (frameColor = '#2C1810', lensColor = '#88BBDD') => buildFrames({
      lensW: 0.032, lensH: 0.024, lensShape: 'round',
      frameColor, lensColor, lensOpacity: 0.12,
      frameThickness: 0.006, bridgeWidth: 0.018,
    }),
  },
  {
    id: 'glasses-rectangle',
    label: 'Rectangle',
    category: 'minimal',
    thumbnail: '▬',
    description: 'Slim rectangular frames.',
    build: (frameColor = '#1565C0', lensColor = '#88BBDD') => buildFrames({
      lensW: 0.038, lensH: 0.018, lensShape: 'square',
      frameColor, lensColor, lensOpacity: 0.12,
      frameThickness: 0.004, bridgeWidth: 0.016,
    }),
  },
  {
    id: 'glasses-oversized',
    label: 'Oversized',
    category: 'fashion',
    thumbnail: '🔭',
    description: 'Large oversized fashion frames.',
    build: (frameColor = '#E91E8C', lensColor = '#88BBDD') => buildFrames({
      lensW: 0.042, lensH: 0.032, lensShape: 'square',
      frameColor, lensColor, lensOpacity: 0.12,
      frameThickness: 0.006, bridgeWidth: 0.020,
    }),
  },
];

// ─── Sunglasses definitions ───────────────────────────────────────────────────

export const SUNGLASSES_LIBRARY = [
  {
    id: 'sunglass-aviator',
    label: 'Aviator',
    category: 'classic',
    thumbnail: '🕶️',
    description: 'Classic teardrop aviator sunglasses.',
    build: (frameColor = '#C0A020', lensColor = '#1A3A1A') => buildFrames({
      lensW: 0.030, lensH: 0.030, lensShape: 'aviator',
      frameColor, lensColor, lensOpacity: 0.75,
      frameThickness: 0.003, bridgeWidth: 0.016,
    }),
  },
  {
    id: 'sunglass-wayfarer',
    label: 'Wayfarer',
    category: 'classic',
    thumbnail: '🕶️',
    description: 'Iconic wayfarer style.',
    build: (frameColor = '#111111', lensColor = '#0A0A0A') => buildFrames({
      lensW: 0.034, lensH: 0.026, lensShape: 'square',
      frameColor, lensColor, lensOpacity: 0.85,
      frameThickness: 0.006, bridgeWidth: 0.018,
    }),
  },
  {
    id: 'sunglass-round',
    label: 'Round Tint',
    category: 'fashion',
    thumbnail: '🔵',
    description: 'Round tinted lenses.',
    build: (frameColor = '#8B6914', lensColor = '#4A1A00') => buildFrames({
      lensW: 0.030, lensH: 0.030, lensShape: 'round',
      frameColor, lensColor, lensOpacity: 0.80,
      frameThickness: 0.003, bridgeWidth: 0.016,
    }),
  },
  {
    id: 'sunglass-shield',
    label: 'Shield',
    category: 'sport',
    thumbnail: '🛡️',
    description: 'One-piece shield lens.',
    build: (frameColor = '#111111', lensColor = '#001A33') => {
      const g = new THREE.Group(); g.name = 'sunglass-shield';
      const mat = mkFrame(frameColor);
      const lensMat = mkLens(lensColor, 0.85, true);
      const shieldGeo = new THREE.BoxGeometry(0.090, 0.028, 0.004);
      const shield = new THREE.Mesh(shieldGeo, lensMat);
      shield.position.z = 0.001;
      g.add(shield);
      const frameBox = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.030, 0.005), mat);
      frameBox.position.z = -0.001;
      g.add(frameBox);
      return g;
    },
  },
  {
    id: 'sunglass-cat-eye',
    label: 'Cat Eye Sunnies',
    category: 'fashion',
    thumbnail: '😎',
    description: 'Glamorous cat-eye sunglasses.',
    build: (frameColor = '#C0392B', lensColor = '#1A0A0A') => buildFrames({
      lensW: 0.032, lensH: 0.022, lensShape: 'cat-eye',
      frameColor, lensColor, lensOpacity: 0.85,
      frameThickness: 0.005, bridgeWidth: 0.016,
      tiltAngle: 0.15,
    }),
  },
  {
    id: 'sunglass-sport',
    label: 'Sport Wrap',
    category: 'sport',
    thumbnail: '🏃',
    description: 'Wraparound sport sunglasses.',
    build: (frameColor = '#E53935', lensColor = '#001A00') => buildFrames({
      lensW: 0.038, lensH: 0.026, lensShape: 'round',
      frameColor, lensColor, lensOpacity: 0.85,
      frameThickness: 0.005, bridgeWidth: 0.014,
    }),
  },
  {
    id: 'sunglass-oversized',
    label: 'Oversized Glam',
    category: 'fashion',
    thumbnail: '🌟',
    description: 'Large glamour sunglasses.',
    build: (frameColor = '#6A1B9A', lensColor = '#1A001A') => buildFrames({
      lensW: 0.044, lensH: 0.034, lensShape: 'square',
      frameColor, lensColor, lensOpacity: 0.85,
      frameThickness: 0.007, bridgeWidth: 0.020,
    }),
  },
  {
    id: 'sunglass-mirrored',
    label: 'Mirrored',
    category: 'fashion',
    thumbnail: '🪞',
    description: 'Mirrored reflective lenses.',
    build: (frameColor = '#C0C0C0', lensColor = '#C0C0C0') => buildFrames({
      lensW: 0.030, lensH: 0.030, lensShape: 'aviator',
      frameColor, lensColor: '#8888AA', lensOpacity: 0.9,
      frameThickness: 0.003, bridgeWidth: 0.016,
    }),
  },
];
