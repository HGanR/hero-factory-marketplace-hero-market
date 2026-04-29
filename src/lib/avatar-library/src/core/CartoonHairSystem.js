/**
 * CartoonHairSystem.js — Volumetric strand-based cartoon hair
 *
 * Builds chunky, layered hair using TubeGeometry strands and CapsuleGeometry
 * clumps to achieve the look from the reference images — thick flowing hair
 * with visible strand separation and subtle highlight shading.
 */

import * as THREE from 'three';

// ─── Hair material ─────────────────────────────────────────────────────────────

function hairMat(hex, emissive = false) {
  return new THREE.MeshToonMaterial({
    color: new THREE.Color(hex),
    emissive: emissive ? new THREE.Color(hex).multiplyScalar(0.15) : new THREE.Color(0x000000),
    emissiveIntensity: emissive ? 0.4 : 0,
    roughness: 0.55,
  });
}

function highlightMat(hex) {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(0xffffff), 0.45);
  return new THREE.MeshToonMaterial({ color: c, roughness: 0.3 });
}

// ─── Helper functions ─────────────────────────────────────────────────────────
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function ovalSphere(rx, ry, rz, seg = 14) {
  const g = new THREE.SphereGeometry(1, seg, Math.floor(seg * 0.75));
  g.scale(rx, ry, rz);
  return g;
}

// ─── Hair style definitions ────────────────────────────────────────────────────

const HEAD_Y = 1.620;
const HEAD_R = 0.130;

/**
 * Each style is a function(group, color) that builds the hair geometry
 * and adds it to the provided group.
 */
const HAIR_STYLES = {

  // ── Short Crop ──────────────────────────────────────────────────────────────
  shortCrop(group, color) {
    const mat = hairMat(color);
    const hl  = highlightMat(color);

    // Skull cap
    const capGeo = new THREE.SphereGeometry(0.138, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    capGeo.scale(1.0, 1.05, 0.96);
    group.add(mesh(capGeo, mat, 0, HEAD_Y + 0.008, 0));

    // Short side strands
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const sx = Math.cos(a) * HEAD_R * 1.05;
      const sz = Math.sin(a) * HEAD_R * 1.05;
      const sg = new THREE.CapsuleGeometry(0.018, 0.045, 4, 8);
      const sm = mesh(sg, mat, sx, HEAD_Y - 0.02, sz);
      sm.rotation.z = Math.cos(a) * 0.3;
      sm.rotation.x = Math.sin(a) * 0.3;
      group.add(sm);
    }
    // Highlight strip
    const hlGeo = ovalSphere(0.065, 0.040, 0.055, 12);
    group.add(mesh(hlGeo, hl, 0.040, HEAD_Y + 0.140, -HEAD_R * 0.5));
  },

  // ── Buzz Cut ────────────────────────────────────────────────────────────────
  buzzCut(group, color) {
    const mat = hairMat(color);
    const capGeo = new THREE.SphereGeometry(0.134, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.52);
    capGeo.scale(1.0, 1.02, 0.95);
    group.add(mesh(capGeo, mat, 0, HEAD_Y + 0.005, 0));
    // Hairline edge
    const edgeGeo = new THREE.TorusGeometry(HEAD_R * 1.02, 0.010, 6, 24, Math.PI * 1.4);
    const edgeMesh = mesh(edgeGeo, mat, 0, HEAD_Y - 0.045, 0);
    edgeMesh.rotation.x = 0.3;
    group.add(edgeMesh);
  },

  // ── Wavy Medium (reference style) ───────────────────────────────────────────
  wavyMedium(group, color) {
    const mat = hairMat(color);
    const hl  = highlightMat(color);

    // Base skull cap
    const capGeo = new THREE.SphereGeometry(0.142, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.58);
    capGeo.scale(1.02, 1.06, 0.98);
    group.add(mesh(capGeo, mat, 0, HEAD_Y + 0.010, 0));

    // Chunky wavy strands falling to shoulder level
    const strandDefs = [
      // Front-left
      { pts: [[-.055, HEAD_Y+.14, .110], [-.080, HEAD_Y+.06, .125], [-.095, HEAD_Y-.04, .115], [-.100, HEAD_Y-.14, .090]], r: 0.026 },
      { pts: [[-.085, HEAD_Y+.12, .100], [-.115, HEAD_Y+.02, .105], [-.130, HEAD_Y-.08, .085], [-.125, HEAD_Y-.20, .060]], r: 0.024 },
      // Front-right
      { pts: [[ .055, HEAD_Y+.14, .110], [ .080, HEAD_Y+.06, .125], [ .095, HEAD_Y-.04, .115], [ .100, HEAD_Y-.14, .090]], r: 0.026 },
      { pts: [[ .085, HEAD_Y+.12, .100], [ .115, HEAD_Y+.02, .105], [ .130, HEAD_Y-.08, .085], [ .125, HEAD_Y-.20, .060]], r: 0.024 },
      // Back-left
      { pts: [[-.060, HEAD_Y+.10, -.090], [-.080, HEAD_Y+.00, -.110], [-.090, HEAD_Y-.12, -.105], [-.085, HEAD_Y-.24, -.085]], r: 0.028 },
      // Back-right
      { pts: [[ .060, HEAD_Y+.10, -.090], [ .080, HEAD_Y+.00, -.110], [ .090, HEAD_Y-.12, -.105], [ .085, HEAD_Y-.24, -.085]], r: 0.028 },
      // Back-center
      { pts: [[ .000, HEAD_Y+.08, -.105], [ .000, HEAD_Y-.02, -.120], [ .000, HEAD_Y-.14, -.115], [ .000, HEAD_Y-.26, -.090]], r: 0.030 },
      // Side puffs
      { pts: [[-.130, HEAD_Y+.06, .020], [-.145, HEAD_Y-.02, .010], [-.140, HEAD_Y-.12, .005]], r: 0.022 },
      { pts: [[ .130, HEAD_Y+.06, .020], [ .145, HEAD_Y-.02, .010], [ .140, HEAD_Y-.12, .005]], r: 0.022 },
    ];

    strandDefs.forEach((def, idx) => {
      const curve = new THREE.CatmullRomCurve3(def.pts.map(p => new THREE.Vector3(...p)));
      const tubeGeo = new THREE.TubeGeometry(curve, 10, def.r, 8, false);
      group.add(mesh(tubeGeo, mat));
      // Add end cap
      const endPt = def.pts[def.pts.length - 1];
      const capG = ovalSphere(def.r * 1.1, def.r * 0.9, def.r * 1.0, 10);
      group.add(mesh(capG, mat, ...endPt));
    });

    // Highlight strands
    const hlDefs = [
      { pts: [[-.040, HEAD_Y+.15, .105], [-.055, HEAD_Y+.06, .118], [-.060, HEAD_Y-.02, .110]], r: 0.010 },
      { pts: [[ .040, HEAD_Y+.15, .105], [ .055, HEAD_Y+.06, .118], [ .060, HEAD_Y-.02, .110]], r: 0.010 },
    ];
    hlDefs.forEach(def => {
      const curve = new THREE.CatmullRomCurve3(def.pts.map(p => new THREE.Vector3(...p)));
      group.add(mesh(new THREE.TubeGeometry(curve, 8, def.r, 6, false), hl));
    });

    // Front hair flip / bang
    const bangCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.040, HEAD_Y + 0.155, 0.100),
      new THREE.Vector3(-0.010, HEAD_Y + 0.160, 0.128),
      new THREE.Vector3( 0.020, HEAD_Y + 0.155, 0.130),
      new THREE.Vector3( 0.045, HEAD_Y + 0.140, 0.118),
    ]);
    group.add(mesh(new THREE.TubeGeometry(bangCurve, 8, 0.022, 8, false), mat));
  },

  // ── Ponytail ─────────────────────────────────────────────────────────────────
  ponytail(group, color) {
    const mat = hairMat(color);
    const hl  = highlightMat(color);

    // Skull cap
    const capGeo = new THREE.SphereGeometry(0.140, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.56);
    capGeo.scale(1.0, 1.04, 0.97);
    group.add(mesh(capGeo, mat, 0, HEAD_Y + 0.008, 0));

    // Hair tie
    const tieGeo = new THREE.TorusGeometry(0.032, 0.012, 8, 16);
    group.add(mesh(tieGeo, new THREE.MeshToonMaterial({ color: 0x222222 }), 0, HEAD_Y - 0.060, -HEAD_R * 1.1));

    // Ponytail strands
    const tailDefs = [
      { pts: [[0, HEAD_Y-.06, -.130], [-.015, HEAD_Y-.18, -.140], [-.010, HEAD_Y-.32, -.120], [0, HEAD_Y-.44, -.095]], r: 0.022 },
      { pts: [[0, HEAD_Y-.06, -.130], [ .015, HEAD_Y-.18, -.140], [ .010, HEAD_Y-.32, -.120], [0, HEAD_Y-.44, -.095]], r: 0.022 },
      { pts: [[0, HEAD_Y-.06, -.130], [0, HEAD_Y-.20, -.148], [0, HEAD_Y-.34, -.128], [0, HEAD_Y-.46, -.100]], r: 0.024 },
    ];
    tailDefs.forEach(def => {
      const curve = new THREE.CatmullRomCurve3(def.pts.map(p => new THREE.Vector3(...p)));
      group.add(mesh(new THREE.TubeGeometry(curve, 10, def.r, 8, false), mat));
    });
    // Highlight
    const hlCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, HEAD_Y-.07, -.128),
      new THREE.Vector3(0, HEAD_Y-.20, -.146),
      new THREE.Vector3(0, HEAD_Y-.32, -.126),
    ]);
    group.add(mesh(new THREE.TubeGeometry(hlCurve, 8, 0.008, 6, false), hl));
  },

  // ── Afro ─────────────────────────────────────────────────────────────────────
  afro(group, color) {
    const mat = hairMat(color);
    // Large rounded afro using multiple overlapping spheres
    const clumps = [
      [0,      HEAD_Y + 0.18, 0,     0.155],
      [-.110,  HEAD_Y + 0.12, 0,     0.110],
      [ .110,  HEAD_Y + 0.12, 0,     0.110],
      [-.080,  HEAD_Y + 0.08, .090,  0.100],
      [ .080,  HEAD_Y + 0.08, .090,  0.100],
      [-.080,  HEAD_Y + 0.08, -.090, 0.100],
      [ .080,  HEAD_Y + 0.08, -.090, 0.100],
      [0,      HEAD_Y + 0.06, .120,  0.095],
      [0,      HEAD_Y + 0.06, -.120, 0.095],
      [-.130,  HEAD_Y - 0.02, 0,     0.088],
      [ .130,  HEAD_Y - 0.02, 0,     0.088],
    ];
    clumps.forEach(([x, y, z, r]) => {
      const g = new THREE.SphereGeometry(r, 14, 10);
      group.add(mesh(g, mat, x, y, z));
    });
    // Highlight
    const hl = highlightMat(color);
    group.add(mesh(new THREE.SphereGeometry(0.060, 10, 8), hl, 0.040, HEAD_Y + 0.22, 0.060));
  },

  // ── Dreadlocks ───────────────────────────────────────────────────────────────
  dreadlocks(group, color) {
    const mat = hairMat(color);
    const capGeo = new THREE.SphereGeometry(0.138, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.54);
    capGeo.scale(1.0, 1.04, 0.96);
    group.add(mesh(capGeo, mat, 0, HEAD_Y + 0.006, 0));

    // Individual dread strands
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const startR = HEAD_R * 1.02;
      const sx = Math.cos(a) * startR;
      const sz = Math.sin(a) * startR;
      const dropY = HEAD_Y - 0.08 - Math.random() * 0.22;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx, HEAD_Y + 0.02, sz),
        new THREE.Vector3(sx * 1.05, HEAD_Y - 0.06, sz * 1.05),
        new THREE.Vector3(sx * 1.02, dropY, sz * 1.02),
      ]);
      const dreadGeo = new THREE.TubeGeometry(curve, 8, 0.014 + Math.random() * 0.006, 6, false);
      group.add(mesh(dreadGeo, mat));
    }
  },

  // ── Mohawk ───────────────────────────────────────────────────────────────────
  mohawk(group, color) {
    const mat = hairMat(color);
    const hl  = highlightMat(color);
    // Shaved sides
    const sideGeo = new THREE.SphereGeometry(0.134, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.50);
    sideGeo.scale(1.0, 1.02, 0.95);
    group.add(mesh(sideGeo, new THREE.MeshToonMaterial({ color: 0x222222 }), 0, HEAD_Y + 0.004, 0));
    // Mohawk strip
    const stripPts = [
      [-0.010, HEAD_Y + 0.145, 0.060],
      [-0.005, HEAD_Y + 0.195, 0.020],
      [ 0.000, HEAD_Y + 0.215, -0.020],
      [ 0.005, HEAD_Y + 0.195, -0.060],
      [ 0.010, HEAD_Y + 0.155, -0.100],
    ];
    stripPts.forEach(([x, y, z], i) => {
      const h = 0.065 - i * 0.005;
      const sg = new THREE.CapsuleGeometry(0.022, h, 4, 8);
      const sm = mesh(sg, mat, x, y, z);
      sm.rotation.x = -0.1 + i * 0.04;
      group.add(sm);
      // Highlight
      const hlg = new THREE.CapsuleGeometry(0.008, h * 0.6, 4, 6);
      group.add(mesh(hlg, hl, x + 0.010, y + 0.010, z + 0.008));
    });
  },

  // ── Cornrows ─────────────────────────────────────────────────────────────────
  cornrows(group, color) {
    const mat = hairMat(color);
    const capGeo = new THREE.SphereGeometry(0.136, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.54);
    capGeo.scale(1.0, 1.03, 0.96);
    group.add(mesh(capGeo, mat, 0, HEAD_Y + 0.006, 0));

    // Row ridges front-to-back
    for (let row = -2; row <= 2; row++) {
      const rx = row * 0.040;
      const rowCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(rx, HEAD_Y + 0.130, 0.115),
        new THREE.Vector3(rx, HEAD_Y + 0.080, 0.050),
        new THREE.Vector3(rx, HEAD_Y + 0.020, -0.040),
        new THREE.Vector3(rx, HEAD_Y - 0.040, -0.110),
        new THREE.Vector3(rx, HEAD_Y - 0.080, -0.130),
      ]);
      const rowGeo = new THREE.TubeGeometry(rowCurve, 12, 0.014, 6, false);
      group.add(mesh(rowGeo, mat));
    }
  },

  // ── Long Straight ────────────────────────────────────────────────────────────
  longStraight(group, color) {
    const mat = hairMat(color);
    const hl  = highlightMat(color);

    const capGeo = new THREE.SphereGeometry(0.140, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.56);
    capGeo.scale(1.0, 1.04, 0.97);
    group.add(mesh(capGeo, mat, 0, HEAD_Y + 0.008, 0));

    // Long straight panels
    const panels = [
      { x: -0.080, z:  0.060, w: 0.055, len: 0.55 },
      { x:  0.080, z:  0.060, w: 0.055, len: 0.55 },
      { x: -0.100, z: -0.060, w: 0.050, len: 0.58 },
      { x:  0.100, z: -0.060, w: 0.050, len: 0.58 },
      { x:  0.000, z: -0.130, w: 0.060, len: 0.60 },
    ];
    panels.forEach(p => {
      const pg = new THREE.BoxGeometry(p.w, p.len, 0.018);
      const pm = mesh(pg, mat, p.x, HEAD_Y - p.len / 2, p.z);
      group.add(pm);
    });
    // Highlight strip
    const hlGeo = new THREE.BoxGeometry(0.018, 0.40, 0.010);
    group.add(mesh(hlGeo, hl, 0.020, HEAD_Y - 0.22, -0.128));
  },

  // ── Top Bun ──────────────────────────────────────────────────────────────────
  topBun(group, color) {
    const mat = hairMat(color);
    const hl  = highlightMat(color);

    const capGeo = new THREE.SphereGeometry(0.138, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    capGeo.scale(1.0, 1.04, 0.96);
    group.add(mesh(capGeo, mat, 0, HEAD_Y + 0.006, 0));

    // Bun
    const bunGeo = ovalSphere(0.068, 0.055, 0.062, 18);
    group.add(mesh(bunGeo, mat, 0, HEAD_Y + 0.195, -0.020));
    group.add(mesh(ovalSphere(0.028, 0.022, 0.025, 10), hl, 0.022, HEAD_Y + 0.218, 0.028));

    // Bun wrap
    const wrapGeo = new THREE.TorusGeometry(0.048, 0.010, 8, 20);
    group.add(mesh(wrapGeo, new THREE.MeshToonMaterial({ color: 0x111111 }), 0, HEAD_Y + 0.194, -0.020));
  },

  // ── Slicked Back ─────────────────────────────────────────────────────────────
  slickedBack(group, color) {
    const mat = hairMat(color);
    const hl  = highlightMat(color);

    const capGeo = new THREE.SphereGeometry(0.138, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    capGeo.scale(1.0, 1.04, 0.96);
    group.add(mesh(capGeo, mat, 0, HEAD_Y + 0.006, 0));

    // Slick strands going back
    for (let i = -2; i <= 2; i++) {
      const sx = i * 0.028;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx, HEAD_Y + 0.148, 0.100),
        new THREE.Vector3(sx, HEAD_Y + 0.120, 0.020),
        new THREE.Vector3(sx, HEAD_Y + 0.080, -0.060),
        new THREE.Vector3(sx, HEAD_Y + 0.040, -0.120),
      ]);
      group.add(mesh(new THREE.TubeGeometry(curve, 8, 0.016, 6, false), mat));
    }
    // Highlight
    const hlCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.010, HEAD_Y + 0.150, 0.098),
      new THREE.Vector3(0.010, HEAD_Y + 0.118, 0.018),
      new THREE.Vector3(0.010, HEAD_Y + 0.076, -0.062),
    ]);
    group.add(mesh(new THREE.TubeGeometry(hlCurve, 6, 0.006, 5, false), hl));
  },

  // ── Curly Short ──────────────────────────────────────────────────────────────
  curlyShort(group, color) {
    const mat = hairMat(color);
    const capGeo = new THREE.SphereGeometry(0.148, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.58);
    capGeo.scale(1.02, 1.08, 0.98);
    group.add(mesh(capGeo, mat, 0, HEAD_Y + 0.012, 0));

    // Curl clumps
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = HEAD_R * 1.06 + Math.random() * 0.020;
      const sx = Math.cos(a) * r;
      const sz = Math.sin(a) * r;
      const sy = HEAD_Y + 0.060 + Math.random() * 0.060;
      const cg = ovalSphere(0.022 + Math.random() * 0.008, 0.028, 0.020, 10);
      group.add(mesh(cg, mat, sx, sy, sz));
    }
  },
};

// // ─── CartoonHairSystem class ──────────────────────────────────────────────────

export class CartoonHairSystem {
  constructor() {
    this.group = new THREE.Group();
    this._style = null;
    this._color = '#3a1a5e';
  }

  /** Apply a named hairstyle with the given color */
  setStyle(styleName, colorHex) {
    // Clear previous
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      child.traverse(o => { if (o.isMesh) { o.geometry?.dispose(); o.material?.dispose(); } });
      this.group.remove(child);
    }

    this._style = styleName;
    this._color = colorHex || this._color;

    const buildFn = HAIR_STYLES[styleName] || HAIR_STYLES.wavyMedium;
    buildFn(this.group, this._color);
  }

  setColor(hex) {
    this._color = hex;
    if (this._style) this.setStyle(this._style, hex);
  }

  /** List of available style keys */
  static get styles() {
    return Object.keys(HAIR_STYLES);
  }
}
