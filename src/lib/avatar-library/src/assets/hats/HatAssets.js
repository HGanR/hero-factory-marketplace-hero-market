/**
 * HatAssets.js — 10 procedural 3D hat models
 */
import * as THREE from 'three';

function mkMat(hex, roughness = 0.8, metalness = 0.0) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness, metalness });
}

// ─── Hat builders ─────────────────────────────────────────────────────────────

function baseballCap(color = '#1565C0', logoColor = '#FFFFFF') {
  const g = new THREE.Group(); g.name = 'hat-baseball-cap';
  const mat = mkMat(color);
  // Dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), mat.clone());
  dome.position.y = 0.01;
  g.add(dome);
  // Brim
  const brimGeo = new THREE.CylinderGeometry(0.155, 0.145, 0.012, 20, 1, false, -Math.PI * 0.1, Math.PI * 1.2);
  const brim = new THREE.Mesh(brimGeo, mat.clone());
  brim.position.set(0.03, -0.04, 0.06);
  brim.rotation.x = -0.15;
  g.add(brim);
  // Button on top
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.008, 8), mkMat(logoColor));
  btn.position.y = 0.12;
  g.add(btn);
  return g;
}

function beanie(color = '#C0392B') {
  const g = new THREE.Group(); g.name = 'hat-beanie';
  const mat = mkMat(color, 0.95);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.128, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), mat.clone());
  g.add(dome);
  // Ribbed band
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.124, 0.005, 6, 24), mat.clone());
    ring.position.y = -0.04 + i * 0.008;
    g.add(ring);
  }
  // Pom-pom
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), mkMat('#FFFFFF', 0.95));
  pom.position.y = 0.13;
  g.add(pom);
  return g;
}

function fedora(color = '#4A3728', bandColor = '#1A1A1A') {
  const g = new THREE.Group(); g.name = 'hat-fedora';
  const mat = mkMat(color, 0.7);
  // Crown
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.110, 0.14, 20, 2), mat.clone());
  crown.position.y = 0.06;
  g.add(crown);
  // Indent on top
  const indent = new THREE.Mesh(new THREE.SphereGeometry(0.060, 14, 8), mkMat(color, 0.7));
  indent.scale.y = 0.3;
  indent.position.y = 0.135;
  g.add(indent);
  // Wide brim
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.210, 0.200, 0.018, 24, 1), mat.clone());
  brim.position.y = -0.01;
  g.add(brim);
  // Band
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.106, 0.010, 6, 24), mkMat(bandColor, 0.9));
  band.position.y = 0.01;
  g.add(band);
  return g;
}

function topHat(color = '#111111') {
  const g = new THREE.Group(); g.name = 'hat-top-hat';
  const mat = mkMat(color, 0.5, 0.1);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.090, 0.095, 0.22, 20, 2), mat.clone());
  crown.position.y = 0.10;
  g.add(crown);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.175, 0.016, 24, 1), mat.clone());
  brim.position.y = -0.01;
  g.add(brim);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.008, 6, 24), mkMat('#555555', 0.9));
  band.position.y = 0.01;
  g.add(band);
  return g;
}

function cowboyHat(color = '#8B6914') {
  const g = new THREE.Group(); g.name = 'hat-cowboy';
  const mat = mkMat(color, 0.75);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.13, 20, 2), mat.clone());
  crown.position.y = 0.055;
  g.add(crown);
  // Wide curved brim
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.230, 0.215, 0.015, 24, 1), mat.clone());
  brim.position.y = -0.01;
  g.add(brim);
  // Upturned sides
  [-1, 1].forEach(side => {
    const curl = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 6, 14, Math.PI * 0.6), mat.clone());
    curl.position.set(side * 0.18, -0.01, 0);
    curl.rotation.y = side * Math.PI * 0.5;
    g.add(curl);
  });
  return g;
}

function snapback(color = '#212121', meshColor = '#424242') {
  const g = new THREE.Group(); g.name = 'hat-snapback';
  const mat = mkMat(color);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.125, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.50), mat.clone());
  dome.position.y = 0.01;
  g.add(dome);
  // Flat brim
  const brimGeo = new THREE.BoxGeometry(0.30, 0.010, 0.10);
  const brim = new THREE.Mesh(brimGeo, mat.clone());
  brim.position.set(0, -0.04, 0.10);
  g.add(brim);
  // Mesh panels
  for (let i = 0; i < 3; i++) {
    const panel = new THREE.Mesh(new THREE.SphereGeometry(0.126, 8, 6, i * Math.PI * 0.65, Math.PI * 0.6, 0, Math.PI * 0.5), mkMat(meshColor, 0.95));
    g.add(panel);
  }
  return g;
}

function bucket(color = '#8BC34A') {
  const g = new THREE.Group(); g.name = 'hat-bucket';
  const mat = mkMat(color, 0.85);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.100, 0.115, 0.10, 20, 2), mat.clone());
  crown.position.y = 0.04;
  g.add(crown);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.155, 0.022, 24, 1), mat.clone());
  brim.position.y = -0.02;
  g.add(brim);
  return g;
}

function visor(color = '#E53935') {
  const g = new THREE.Group(); g.name = 'hat-visor';
  const mat = mkMat(color);
  // Band
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.018, 8, 24, Math.PI * 1.6), mat.clone());
  band.rotation.x = Math.PI / 2;
  g.add(band);
  // Brim
  const brimGeo = new THREE.CylinderGeometry(0.155, 0.145, 0.012, 20, 1, false, -Math.PI * 0.1, Math.PI * 1.2);
  const brim = new THREE.Mesh(brimGeo, mat.clone());
  brim.position.set(0.03, -0.02, 0.06);
  brim.rotation.x = -0.15;
  g.add(brim);
  return g;
}

function beret(color = '#1B5E20') {
  const g = new THREE.Group(); g.name = 'hat-beret';
  const mat = mkMat(color, 0.9);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), mat.clone());
  dome.scale.set(1.0, 0.65, 1.0);
  dome.position.set(-0.025, 0.03, 0);
  g.add(dome);
  // Band
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.010, 6, 24), mkMat('#111111', 0.9));
  band.position.y = -0.02;
  g.add(band);
  return g;
}

function hardHat(color = '#FFC107') {
  const g = new THREE.Group(); g.name = 'hat-hard-hat';
  const mat = mkMat(color, 0.3, 0.1);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.130, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), mat.clone());
  dome.position.y = 0.01;
  g.add(dome);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.160, 0.150, 0.015, 24, 1), mat.clone());
  brim.position.y = -0.03;
  g.add(brim);
  // Suspension ridge
  const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.006, 6, 24), mkMat('#E65100', 0.4));
  ridge.position.y = 0.02;
  g.add(ridge);
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  HAT LIBRARY
// ═══════════════════════════════════════════════════════════════════════════════

export const HAT_LIBRARY = [
  { id: 'hat-baseball',  label: 'Baseball Cap',  category: 'casual',   thumbnail: '🧢', description: 'Classic baseball cap.',      build: (c='#1565C0') => baseballCap(c)  },
  { id: 'hat-beanie',    label: 'Beanie',         category: 'casual',   thumbnail: '🎿', description: 'Warm knit beanie.',          build: (c='#C0392B') => beanie(c)       },
  { id: 'hat-snapback',  label: 'Snapback',       category: 'casual',   thumbnail: '🧢', description: 'Flat-brim snapback.',        build: (c='#212121') => snapback(c)     },
  { id: 'hat-bucket',    label: 'Bucket Hat',     category: 'casual',   thumbnail: '🪣', description: 'Trendy bucket hat.',         build: (c='#8BC34A') => bucket(c)       },
  { id: 'hat-visor',     label: 'Visor',          category: 'casual',   thumbnail: '🏌️', description: 'Sports visor.',             build: (c='#E53935') => visor(c)        },
  { id: 'hat-beret',     label: 'Beret',          category: 'fashion',  thumbnail: '🎨', description: 'Artistic beret.',            build: (c='#1B5E20') => beret(c)        },
  { id: 'hat-fedora',    label: 'Fedora',         category: 'fashion',  thumbnail: '🎩', description: 'Stylish fedora.',            build: (c='#4A3728') => fedora(c)       },
  { id: 'hat-cowboy',    label: 'Cowboy Hat',     category: 'fashion',  thumbnail: '🤠', description: 'Wide-brim cowboy hat.',      build: (c='#8B6914') => cowboyHat(c)   },
  { id: 'hat-top',       label: 'Top Hat',        category: 'formal',   thumbnail: '🎩', description: 'Formal top hat.',            build: (c='#111111') => topHat(c)       },
  { id: 'hat-hard',      label: 'Hard Hat',       category: 'utility',  thumbnail: '⛑️', description: 'Safety hard hat.',          build: (c='#FFC107') => hardHat(c)      },
];
