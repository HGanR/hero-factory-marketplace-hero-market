/**
 * CartoonHair3D.js — Volumetric strand-based 3D hair system
 *
 * Builds stylized cartoon hair using chunky TubeGeometry strands with:
 * - Multiple overlapping strand layers for volume
 * - Highlight strand on top for shine
 * - 12 distinct hairstyles
 * - Color + highlight tinting
 */

import * as THREE from 'three';

function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color: new THREE.Color(color), ...opts });
}

function strand(points, radius = 0.018, segs = 10, radSegs = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  return new THREE.TubeGeometry(curve, segs, radius, radSegs, false);
}

function place(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

// ─── Hair style definitions ────────────────────────────────────────────────────

const HAIR_STYLES = {

  // 1. Long wavy (reference style — blue hair)
  longWavy: (color, highlight) => {
    const g = new THREE.Group();
    const mat = toon(color);
    const hiMat = toon(highlight, { emissive: new THREE.Color(highlight), emissiveIntensity: 0.15 });

    // Skull cap
    const capGeo = new THREE.SphereGeometry(0.155, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.55);
    g.add(place(capGeo, mat, 0, 0.215, 0));

    // Side volume puffs
    for (const sx of [-1, 1]) {
      const puffGeo = new THREE.SphereGeometry(0.072, 18, 14);
      puffGeo.scale(1, 1.3, 0.85);
      g.add(place(puffGeo, mat, sx * 0.148, 0.180, -0.010));
    }

    // Long strands — left side
    const leftStrands = [
      [[-0.155, 0.170, 0.010], [-0.170, 0.080, -0.020], [-0.165, -0.020, -0.025], [-0.155, -0.120, -0.018], [-0.140, -0.220, -0.010]],
      [[-0.130, 0.175, 0.020], [-0.148, 0.070, -0.015], [-0.145, -0.040, -0.020], [-0.132, -0.150, -0.012]],
      [[-0.110, 0.180, 0.030], [-0.125, 0.060, -0.005], [-0.120, -0.060, -0.010], [-0.108, -0.170, -0.005]],
    ];
    leftStrands.forEach(pts => g.add(new THREE.Mesh(strand(pts, 0.022, 12), mat)));

    // Long strands — right side
    const rightStrands = leftStrands.map(pts => pts.map(([x, y, z]) => [-x, y, z]));
    rightStrands.forEach(pts => g.add(new THREE.Mesh(strand(pts, 0.022, 12), mat)));

    // Back curtain
    for (let i = -2; i <= 2; i++) {
      const bx = i * 0.055;
      const bPts = [[bx, 0.155, -0.145], [bx * 0.95, 0.040, -0.158], [bx * 0.90, -0.080, -0.148], [bx * 0.85, -0.200, -0.130]];
      g.add(new THREE.Mesh(strand(bPts, 0.026, 10), mat));
    }

    // Highlight strand on top
    const hiPts = [[-0.020, 0.240, 0.100], [0.010, 0.235, 0.110], [0.040, 0.220, 0.100]];
    g.add(new THREE.Mesh(strand(hiPts, 0.010, 6), hiMat));

    // Front bangs
    const bangPts = [
      [[-0.060, 0.215, 0.130], [-0.070, 0.185, 0.148], [-0.065, 0.155, 0.145]],
      [[-0.020, 0.220, 0.138], [-0.015, 0.190, 0.155], [-0.010, 0.158, 0.152]],
      [[0.020, 0.220, 0.138], [0.015, 0.190, 0.155], [0.010, 0.158, 0.152]],
      [[0.060, 0.215, 0.130], [0.070, 0.185, 0.148], [0.065, 0.155, 0.145]],
    ];
    bangPts.forEach(pts => g.add(new THREE.Mesh(strand(pts, 0.020, 8), mat)));

    return g;
  },

  // 2. Short crop
  shortCrop: (color, highlight) => {
    const g = new THREE.Group();
    const mat = toon(color);
    const hiMat = toon(highlight, { emissive: new THREE.Color(highlight), emissiveIntensity: 0.12 });

    const capGeo = new THREE.SphereGeometry(0.158, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.52);
    g.add(place(capGeo, mat, 0, 0.218, 0));

    // Short side strands
    for (const sx of [-1, 1]) {
      const sideGeo = new THREE.SphereGeometry(0.058, 16, 12);
      sideGeo.scale(1, 0.9, 0.8);
      g.add(place(sideGeo, mat, sx * 0.148, 0.165, 0.005));
    }

    // Short top strands
    const topPts = [
      [[-0.040, 0.240, 0.080], [-0.030, 0.255, 0.095], [-0.010, 0.248, 0.105]],
      [[0.000, 0.245, 0.085], [0.005, 0.260, 0.098], [0.015, 0.252, 0.108]],
      [[0.040, 0.240, 0.080], [0.030, 0.255, 0.095], [0.010, 0.248, 0.105]],
    ];
    topPts.forEach(pts => g.add(new THREE.Mesh(strand(pts, 0.018, 6), mat)));

    const hiPts = [[-0.015, 0.248, 0.108], [0.005, 0.258, 0.115], [0.025, 0.250, 0.110]];
    g.add(new THREE.Mesh(strand(hiPts, 0.008, 5), hiMat));

    return g;
  },

  // 3. Afro
  afro: (color, highlight) => {
    const g = new THREE.Group();
    const mat = toon(color);

    // Large round afro puff
    const mainGeo = new THREE.SphereGeometry(0.205, 32, 24);
    mainGeo.scale(1, 0.95, 0.90);
    g.add(place(mainGeo, mat, 0, 0.240, -0.010));

    // Surface texture bumps
    for (let i = 0; i < 18; i++) {
      const theta = (i / 18) * Math.PI * 2;
      const phi = 0.3 + Math.random() * 0.8;
      const r = 0.195;
      const bx = r * Math.sin(phi) * Math.cos(theta);
      const by = 0.240 + r * Math.cos(phi);
      const bz = r * Math.sin(phi) * Math.sin(theta) * 0.90;
      const bGeo = new THREE.SphereGeometry(0.022 + Math.random() * 0.012, 10, 8);
      g.add(place(bGeo, mat, bx, by, bz));
    }

    return g;
  },

  // 4. High ponytail
  highPonytail: (color, highlight) => {
    const g = new THREE.Group();
    const mat = toon(color);
    const hiMat = toon(highlight, { emissive: new THREE.Color(highlight), emissiveIntensity: 0.12 });

    const capGeo = new THREE.SphereGeometry(0.155, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.50);
    g.add(place(capGeo, mat, 0, 0.215, 0));

    // Ponytail base bun
    const bunGeo = new THREE.SphereGeometry(0.048, 18, 14);
    g.add(place(bunGeo, mat, 0, 0.268, -0.060));

    // Ponytail strands flowing down
    for (let i = -1; i <= 1; i++) {
      const ox = i * 0.020;
      const pts = [[ox, 0.265, -0.065], [ox * 1.2, 0.200, -0.100], [ox * 1.4, 0.100, -0.110], [ox * 1.5, -0.010, -0.095], [ox * 1.4, -0.120, -0.070]];
      g.add(new THREE.Mesh(strand(pts, 0.022, 10), mat));
    }

    // Hair tie
    const tieGeo = new THREE.TorusGeometry(0.032, 0.008, 8, 16);
    g.add(place(tieGeo, toon('#222222'), 0, 0.265, -0.062, Math.PI / 2, 0, 0));

    const hiPts = [[-0.010, 0.268, 0.080], [0.005, 0.272, 0.090], [0.020, 0.265, 0.085]];
    g.add(new THREE.Mesh(strand(hiPts, 0.008, 5), hiMat));

    return g;
  },

  // 5. Cornrows
  cornrows: (color, highlight) => {
    const g = new THREE.Group();
    const mat = toon(color);

    const capGeo = new THREE.SphereGeometry(0.152, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.50);
    g.add(place(capGeo, mat, 0, 0.212, 0));

    // Row braids front-to-back
    for (let row = -2; row <= 2; row++) {
      const rx = row * 0.030;
      const rowPts = [[rx, 0.215, 0.120], [rx, 0.210, 0.060], [rx, 0.205, 0.000], [rx, 0.200, -0.060], [rx, 0.195, -0.120], [rx, 0.185, -0.148]];
      const rowCurve = new THREE.CatmullRomCurve3(rowPts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
      // Braid pattern — alternating bumps
      for (let b = 0; b < 5; b++) {
        const t = b / 4;
        const pt = rowCurve.getPoint(t);
        const bGeo = new THREE.SphereGeometry(0.014, 10, 8);
        bGeo.scale(1, 0.7, 1);
        g.add(place(bGeo, mat, pt.x, pt.y, pt.z));
      }
      g.add(new THREE.Mesh(strand(rowPts, 0.010, 8), mat));
    }

    return g;
  },

  // 6. Mohawk
  mohawk: (color, highlight) => {
    const g = new THREE.Group();
    const mat = toon(color);
    const hiMat = toon(highlight, { emissive: new THREE.Color(highlight), emissiveIntensity: 0.18 });

    // Shaved sides
    const sideCapGeo = new THREE.SphereGeometry(0.152, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.50);
    g.add(place(sideCapGeo, toon('#1a1a1a'), 0, 0.212, 0));

    // Mohawk strip — tall spikes along center
    const spikePts = [
      { x: 0, y: 0.215, z: 0.100, h: 0.055 },
      { x: 0, y: 0.225, z: 0.050, h: 0.070 },
      { x: 0, y: 0.232, z: 0.000, h: 0.080 },
      { x: 0, y: 0.228, z: -0.050, h: 0.068 },
      { x: 0, y: 0.218, z: -0.100, h: 0.050 },
    ];
    spikePts.forEach(({ x, y, z, h }) => {
      const spikeGeo = new THREE.ConeGeometry(0.022, h, 8);
      g.add(place(spikeGeo, mat, x, y + h / 2, z));
      const hiSpikeGeo = new THREE.ConeGeometry(0.008, h * 0.6, 6);
      g.add(place(hiSpikeGeo, hiMat, x + 0.005, y + h * 0.55, z + 0.008));
    });

    return g;
  },

  // 7. Bun
  bun: (color, highlight) => {
    const g = new THREE.Group();
    const mat = toon(color);
    const hiMat = toon(highlight, { emissive: new THREE.Color(highlight), emissiveIntensity: 0.12 });

    const capGeo = new THREE.SphereGeometry(0.155, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.50);
    g.add(place(capGeo, mat, 0, 0.215, 0));

    // Bun
    const bunGeo = new THREE.SphereGeometry(0.062, 22, 18);
    bunGeo.scale(1, 0.85, 0.85);
    g.add(place(bunGeo, mat, 0, 0.268, -0.045));

    // Spiral wrap
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const sx = Math.cos(a) * 0.048;
      const sz = Math.sin(a) * 0.038 - 0.045;
      const wrapGeo = new THREE.TorusGeometry(0.028, 0.008, 6, 12, Math.PI * 0.8);
      g.add(place(wrapGeo, mat, sx, 0.268, sz, 0, a, 0));
    }

    const hiPts = [[-0.010, 0.275, -0.010], [0.005, 0.280, -0.005], [0.020, 0.274, -0.012]];
    g.add(new THREE.Mesh(strand(hiPts, 0.007, 5), hiMat));

    return g;
  },

  // 8. Dreadlocks
  dreadlocks: (color, highlight) => {
    const g = new THREE.Group();
    const mat = toon(color);

    const capGeo = new THREE.SphereGeometry(0.155, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.52);
    g.add(place(capGeo, mat, 0, 0.215, 0));

    // Thick dread strands
    const dreadDefs = [
      { x: -0.120, z: 0.060 }, { x: -0.148, z: -0.010 }, { x: -0.130, z: -0.080 },
      { x: -0.060, z: -0.148 }, { x: 0.000, z: -0.155 }, { x: 0.060, z: -0.148 },
      { x: 0.120, z: 0.060 }, { x: 0.148, z: -0.010 }, { x: 0.130, z: -0.080 },
      { x: -0.040, z: 0.145 }, { x: 0.040, z: 0.145 },
    ];
    dreadDefs.forEach(({ x, z }) => {
      const len = 0.18 + Math.random() * 0.12;
      const pts = [
        [x, 0.195, z],
        [x * 1.05, 0.120, z * 1.02],
        [x * 1.08, 0.030, z * 1.04],
        [x * 1.06, -0.060 - len * 0.3, z * 1.03],
        [x * 1.04, -0.120 - len * 0.7, z * 1.01],
      ];
      // Bumpy dread texture
      for (let b = 0; b < pts.length - 1; b++) {
        const bGeo = new THREE.SphereGeometry(0.016, 10, 8);
        bGeo.scale(1, 1.4, 1);
        g.add(place(bGeo, mat, pts[b][0], pts[b][1], pts[b][2]));
      }
      g.add(new THREE.Mesh(strand(pts, 0.013, 8), mat));
    });

    return g;
  },

  // 9. Slicked back
  slickedBack: (color, highlight) => {
    const g = new THREE.Group();
    const mat = toon(color);
    const hiMat = toon(highlight, { emissive: new THREE.Color(highlight), emissiveIntensity: 0.20 });

    const capGeo = new THREE.SphereGeometry(0.155, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.50);
    g.add(place(capGeo, mat, 0, 0.215, 0));

    // Slicked strands flowing back
    for (let i = -2; i <= 2; i++) {
      const ox = i * 0.028;
      const pts = [[ox, 0.238, 0.110], [ox * 0.9, 0.240, 0.060], [ox * 0.8, 0.238, 0.000], [ox * 0.7, 0.228, -0.060], [ox * 0.6, 0.210, -0.120], [ox * 0.5, 0.188, -0.148]];
      g.add(new THREE.Mesh(strand(pts, 0.016, 8), mat));
    }

    // Highlight
    const hiPts = [[-0.005, 0.242, 0.108], [0.000, 0.244, 0.060], [0.005, 0.240, 0.000]];
    g.add(new THREE.Mesh(strand(hiPts, 0.009, 5), hiMat));

    return g;
  },

  // 10. Curly medium
  curlyMedium: (color, highlight) => {
    const g = new THREE.Group();
    const mat = toon(color);

    const capGeo = new THREE.SphereGeometry(0.158, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.54);
    g.add(place(capGeo, mat, 0, 0.218, 0));

    // Curly coils around the head
    for (let i = 0; i < 16; i++) {
      const theta = (i / 16) * Math.PI * 2;
      const phi = 0.25 + (i % 3) * 0.18;
      const r = 0.155 + (i % 2) * 0.018;
      const bx = r * Math.sin(phi) * Math.cos(theta);
      const by = 0.218 + r * Math.cos(phi) * 0.6;
      const bz = r * Math.sin(phi) * Math.sin(theta);
      const curlGeo = new THREE.TorusGeometry(0.018, 0.010, 6, 10, Math.PI * 1.4);
      const curl = new THREE.Mesh(curlGeo, mat);
      curl.position.set(bx, by, bz);
      curl.rotation.set(Math.random() * Math.PI, theta, Math.random() * Math.PI);
      curl.castShadow = true;
      g.add(curl);
    }

    return g;
  },

  // 11. Buzz cut
  buzzCut: (color, highlight) => {
    const g = new THREE.Group();
    const mat = toon(color);

    const capGeo = new THREE.SphereGeometry(0.153, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.48);
    capGeo.scale(1, 0.92, 0.95);
    g.add(place(capGeo, mat, 0, 0.210, 0));

    return g;
  },

  // 12. Twin buns
  twinBuns: (color, highlight) => {
    const g = new THREE.Group();
    const mat = toon(color);
    const hiMat = toon(highlight, { emissive: new THREE.Color(highlight), emissiveIntensity: 0.14 });

    const capGeo = new THREE.SphereGeometry(0.155, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.50);
    g.add(place(capGeo, mat, 0, 0.215, 0));

    // Two buns on top sides
    for (const sx of [-1, 1]) {
      const bunGeo = new THREE.SphereGeometry(0.048, 18, 14);
      g.add(place(bunGeo, mat, sx * 0.095, 0.268, -0.010));

      // Bun strands
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const wGeo = new THREE.TorusGeometry(0.022, 0.007, 6, 10, Math.PI * 0.7);
        g.add(place(wGeo, mat, sx * 0.095 + Math.cos(a) * 0.018, 0.268, -0.010 + Math.sin(a) * 0.014, 0, a, 0));
      }

      // Hair tie
      const tieGeo = new THREE.TorusGeometry(0.028, 0.007, 8, 14);
      g.add(place(tieGeo, toon('#111111'), sx * 0.095, 0.255, -0.010, Math.PI / 2, 0, 0));

      const hiPts = [[sx * 0.090, 0.272, 0.022], [sx * 0.095, 0.276, 0.028], [sx * 0.100, 0.272, 0.024]];
      g.add(new THREE.Mesh(strand(hiPts, 0.006, 4), hiMat));
    }

    return g;
  },
};

// ─── CartoonHair3D ────────────────────────────────────────────────────────────

export class CartoonHair3D {
  constructor() {
    this.group = new THREE.Group();
    this._style = 'longWavy';
    this._color = '#4a35c8';
    this._highlight = '#8a72ff';
    this._current = null;
  }

  setStyle(style) {
    this._style = style;
    this._rebuild();
  }

  setColor(hex) {
    this._color = hex;
    // Auto-compute highlight as lighter version
    const c = new THREE.Color(hex);
    c.lerp(new THREE.Color('#ffffff'), 0.35);
    this._highlight = '#' + c.getHexString();
    this._rebuild();
  }

  setHighlight(hex) {
    this._highlight = hex;
    this._rebuild();
  }

  _rebuild() {
    if (this._current) {
      this.group.remove(this._current);
      this._current.traverse(obj => {
        if (obj.isMesh) { obj.geometry?.dispose(); obj.material?.dispose(); }
      });
    }
    const builder = HAIR_STYLES[this._style];
    if (builder) {
      this._current = builder(this._color, this._highlight);
      this.group.add(this._current);
    }
  }

  getStyleNames() {
    return Object.keys(HAIR_STYLES);
  }

  dispose() {
    this.group.traverse(obj => {
      if (obj.isMesh) { obj.geometry?.dispose(); obj.material?.dispose(); }
    });
  }
}

export { HAIR_STYLES };
