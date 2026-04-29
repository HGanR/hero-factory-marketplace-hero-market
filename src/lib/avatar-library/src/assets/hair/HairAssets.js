/**
 * HairAssets.js
 * Library of 12 procedural 3D hairstyles.
 * Each style is built from layered sphere/torus/cylinder geometry
 * with a customisable hair colour.
 */

import * as THREE from 'three';

function mkHair(hex) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.9, metalness: 0.0 });
}

// ─── Hair colour palette ──────────────────────────────────────────────────────

export const HAIR_COLORS = [
  { id: 'black',       label: 'Black',         hex: '#0A0A0A' },
  { id: 'dark-brown',  label: 'Dark Brown',    hex: '#2C1810' },
  { id: 'brown',       label: 'Brown',         hex: '#6B3A2A' },
  { id: 'light-brown', label: 'Light Brown',   hex: '#A0724A' },
  { id: 'dirty-blond', label: 'Dirty Blonde',  hex: '#C8A060' },
  { id: 'blonde',      label: 'Blonde',        hex: '#E8C878' },
  { id: 'platinum',    label: 'Platinum',      hex: '#F0EAD6' },
  { id: 'auburn',      label: 'Auburn',        hex: '#8B2500' },
  { id: 'red',         label: 'Red',           hex: '#C0392B' },
  { id: 'strawberry',  label: 'Strawberry',    hex: '#E8806A' },
  { id: 'grey',        label: 'Grey',          hex: '#9E9E9E' },
  { id: 'white',       label: 'White',         hex: '#F5F5F5' },
  { id: 'blue',        label: 'Blue',          hex: '#1565C0' },
  { id: 'purple',      label: 'Purple',        hex: '#6A1B9A' },
  { id: 'pink',        label: 'Pink',          hex: '#E91E8C' },
  { id: 'green',       label: 'Green',         hex: '#2E7D32' },
  { id: 'teal',        label: 'Teal',          hex: '#00695C' },
  { id: 'orange',      label: 'Orange',        hex: '#E65100' },
];

// ─── Hairstyle builders ───────────────────────────────────────────────────────

function shortCrop(color) {
  const g = new THREE.Group(); g.name = 'hair-short-crop';
  const mat = mkHair(color);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.118, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat);
  cap.position.y = 0.02;
  g.add(cap);
  return g;
}

function buzzCut(color) {
  const g = new THREE.Group(); g.name = 'hair-buzz';
  const mat = mkHair(color);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.120, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mat);
  cap.scale.y = 0.35;
  cap.position.y = 0.065;
  g.add(cap);
  return g;
}

function mediumWavy(color) {
  const g = new THREE.Group(); g.name = 'hair-medium-wavy';
  const mat = mkHair(color);
  // Top cap
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.120, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), mat.clone());
  cap.position.y = 0.015;
  g.add(cap);
  // Side volume
  [-1, 1].forEach(side => {
    const side1 = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 10), mat.clone());
    side1.position.set(side * 0.105, -0.04, 0.01);
    side1.scale.set(0.7, 1.1, 0.75);
    g.add(side1);
    const side2 = new THREE.Mesh(new THREE.SphereGeometry(0.060, 12, 8), mat.clone());
    side2.position.set(side * 0.100, -0.10, 0.005);
    side2.scale.set(0.65, 1.0, 0.65);
    g.add(side2);
  });
  // Back
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), mat.clone());
  back.position.set(0, -0.06, -0.055);
  back.scale.set(1.0, 1.1, 0.8);
  g.add(back);
  return g;
}

function longStraight(color) {
  const g = new THREE.Group(); g.name = 'hair-long-straight';
  const mat = mkHair(color);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.120, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), mat.clone());
  cap.position.y = 0.015;
  g.add(cap);
  // Long strands
  [-1, 0, 1].forEach((x, i) => {
    const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.045 - i * 0.005, 0.030, 0.35, 10), mat.clone());
    strand.position.set(x * 0.06, -0.22, -0.02);
    g.add(strand);
  });
  return g;
}

function afro(color) {
  const g = new THREE.Group(); g.name = 'hair-afro';
  const mat = mkHair(color);
  const positions = [
    [0, 0.04, 0, 1.0], [-0.07, 0.02, 0.04, 0.85], [0.07, 0.02, 0.04, 0.85],
    [0, 0.02, -0.06, 0.85], [-0.05, 0.06, -0.04, 0.8], [0.05, 0.06, -0.04, 0.8],
    [-0.08, -0.02, 0, 0.75], [0.08, -0.02, 0, 0.75],
  ];
  positions.forEach(([x, y, z, s]) => {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.085 * s, 14, 10), mat.clone());
    sphere.position.set(x, y, z);
    g.add(sphere);
  });
  return g;
}

function cornrows(color) {
  const g = new THREE.Group(); g.name = 'hair-cornrows';
  const mat = mkHair(color);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.118, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat.clone());
  cap.scale.y = 0.4;
  cap.position.y = 0.06;
  g.add(cap);
  // Cornrow ridges
  for (let i = -3; i <= 3; i++) {
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 6), mat.clone());
    ridge.position.set(i * 0.018, 0.04, 0.02);
    g.add(ridge);
  }
  return g;
}

function ponytail(color) {
  const g = new THREE.Group(); g.name = 'hair-ponytail';
  const mat = mkHair(color);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.120, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), mat.clone());
  cap.position.y = 0.015;
  g.add(cap);
  // Tail
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.014, 0.28, 10), mat.clone());
  tail.position.set(0, -0.14, -0.10);
  tail.rotation.x = 0.3;
  g.add(tail);
  // Hair tie
  const tieGeo = new THREE.TorusGeometry(0.025, 0.005, 6, 12);
  const tieMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
  const tie = new THREE.Mesh(tieGeo, tieMat);
  tie.position.set(0, -0.01, -0.09);
  tie.rotation.x = Math.PI / 2;
  g.add(tie);
  return g;
}

function bun(color) {
  const g = new THREE.Group(); g.name = 'hair-bun';
  const mat = mkHair(color);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.120, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), mat.clone());
  cap.position.y = 0.015;
  g.add(cap);
  // Bun sphere
  const bunSphere = new THREE.Mesh(new THREE.SphereGeometry(0.040, 14, 10), mat.clone());
  bunSphere.position.set(0, 0.12, -0.06);
  g.add(bunSphere);
  return g;
}

function dreadlocks(color) {
  const g = new THREE.Group(); g.name = 'hair-dreadlocks';
  const mat = mkHair(color);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.118, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat.clone());
  cap.position.y = 0.015;
  g.add(cap);
  const angles = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5];
  angles.forEach(a => {
    const r = 0.095;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.7;
    const loc = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.007, 0.20 + Math.random() * 0.08, 6), mat.clone());
    loc.position.set(x, -0.12, z);
    loc.rotation.x = (x / r) * 0.25;
    loc.rotation.z = -(x / r) * 0.15;
    g.add(loc);
  });
  return g;
}

function curlyShort(color) {
  const g = new THREE.Group(); g.name = 'hair-curly-short';
  const mat = mkHair(color);
  const positions = [
    [0, 0.04, 0.04], [-0.06, 0.02, 0.04], [0.06, 0.02, 0.04],
    [-0.09, 0.00, 0], [0.09, 0.00, 0],
    [-0.06, 0.02, -0.06], [0.06, 0.02, -0.06], [0, 0.04, -0.06],
    [-0.04, 0.08, 0], [0.04, 0.08, 0],
  ];
  positions.forEach(([x, y, z]) => {
    const curl = new THREE.Mesh(new THREE.SphereGeometry(0.050, 12, 8), mat.clone());
    curl.position.set(x, y, z);
    g.add(curl);
  });
  return g;
}

function mohawk(color) {
  const g = new THREE.Group(); g.name = 'hair-mohawk';
  const mat = mkHair(color);
  // Shaved sides (thin layer)
  [-1, 1].forEach(side => {
    const side1 = new THREE.Mesh(new THREE.SphereGeometry(0.115, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), mat.clone());
    side1.scale.set(0.3, 0.25, 0.9);
    side1.position.set(side * 0.09, 0.04, 0);
    g.add(side1);
  });
  // Central strip
  for (let i = 0; i < 7; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06 + i * 0.005, 8), mat.clone());
    spike.position.set(0, 0.08 + i * 0.01, -0.06 + i * 0.02);
    g.add(spike);
  }
  return g;
}

function slickedBack(color) {
  const g = new THREE.Group(); g.name = 'hair-slicked-back';
  const mat = mkHair(color);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.120, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), mat.clone());
  cap.scale.set(1.0, 0.55, 1.05);
  cap.position.set(0, 0.07, -0.01);
  g.add(cap);
  // Slicked back volume
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 10), mat.clone());
  back.scale.set(1.0, 0.6, 1.2);
  back.position.set(0, 0.04, -0.06);
  g.add(back);
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HAIR LIBRARY
// ═══════════════════════════════════════════════════════════════════════════════

export const HAIR_LIBRARY = [
  { id: 'hair-short-crop',    label: 'Short Crop',    category: 'short',    thumbnail: '✂️',  description: 'Clean short crop.',                  build: (c='#0A0A0A') => shortCrop(c)    },
  { id: 'hair-buzz',          label: 'Buzz Cut',      category: 'short',    thumbnail: '✂️',  description: 'Military-style buzz cut.',            build: (c='#0A0A0A') => buzzCut(c)      },
  { id: 'hair-curly-short',   label: 'Curly Short',   category: 'short',    thumbnail: '🌀',  description: 'Short curly hair.',                   build: (c='#2C1810') => curlyShort(c)   },
  { id: 'hair-mohawk',        label: 'Mohawk',        category: 'short',    thumbnail: '⚡',  description: 'Bold mohawk strip.',                  build: (c='#0A0A0A') => mohawk(c)       },
  { id: 'hair-slicked-back',  label: 'Slicked Back',  category: 'medium',   thumbnail: '💈',  description: 'Classic slicked-back style.',         build: (c='#2C1810') => slickedBack(c)  },
  { id: 'hair-medium-wavy',   label: 'Medium Wavy',   category: 'medium',   thumbnail: '〰️', description: 'Shoulder-length wavy hair.',           build: (c='#6B3A2A') => mediumWavy(c)  },
  { id: 'hair-cornrows',      label: 'Cornrows',      category: 'medium',   thumbnail: '〰️', description: 'Traditional cornrow braids.',          build: (c='#0A0A0A') => cornrows(c)    },
  { id: 'hair-ponytail',      label: 'Ponytail',      category: 'long',     thumbnail: '🎀',  description: 'Classic ponytail.',                   build: (c='#6B3A2A') => ponytail(c)     },
  { id: 'hair-bun',           label: 'Top Bun',       category: 'long',     thumbnail: '🎀',  description: 'Hair pulled into a top bun.',         build: (c='#6B3A2A') => bun(c)          },
  { id: 'hair-long-straight', label: 'Long Straight', category: 'long',     thumbnail: '💇',  description: 'Long, straight flowing hair.',        build: (c='#0A0A0A') => longStraight(c) },
  { id: 'hair-afro',          label: 'Afro',          category: 'voluminous', thumbnail: '🌟', description: 'Full, natural afro.',                build: (c='#0A0A0A') => afro(c)         },
  { id: 'hair-dreadlocks',    label: 'Dreadlocks',    category: 'voluminous', thumbnail: '🌿', description: 'Long dreadlocks.',                   build: (c='#2C1810') => dreadlocks(c)   },
];
