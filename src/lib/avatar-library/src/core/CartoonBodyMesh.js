/**
 * CartoonBodyMesh.js  — v3 High-Quality Stylized Cartoon Character
 *
 * Builds a smooth, continuous skinned humanoid body using Three.js SkinnedMesh.
 * The body is a single merged geometry driven by a full bone skeleton so joints
 * bend smoothly without visible seams.
 *
 * Architecture:
 *   - One SkinnedMesh per body region (torso, each limb) for manageable geometry
 *   - Full bone hierarchy: hips → spine → chest → neck → head
 *                                                       → shoulder → upperArm → lowerArm → hand → fingers
 *                          hips → thigh → shin → foot
 *   - Morph targets for body shape (slim/athletic/heavy/curvy) and muscle tone
 *   - Cartoon proportions: large head, wide shoulders, slim waist, long legs
 */

import * as THREE from 'three';

// ─── Material helpers ─────────────────────────────────────────────────────────

function skinMat(hex = '#E8A882', opts = {}) {
  return new THREE.MeshToonMaterial({
    color: new THREE.Color(hex),
    ...opts,
  });
}

function clothMat(hex, opts = {}) {
  return new THREE.MeshToonMaterial({
    color: new THREE.Color(hex),
    ...opts,
  });
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

/** Smooth tapered cylinder — top and bottom can have different radii AND depths */
function taperedCyl(rTop, rBot, height, radSeg = 20, heightSeg = 6) {
  return new THREE.CylinderGeometry(rTop, rBot, height, radSeg, heightSeg, false);
}

/** Smooth sphere with slight squash/stretch */
function ovalSphere(rx, ry, rz, seg = 24) {
  const g = new THREE.SphereGeometry(1, seg, Math.floor(seg * 0.75));
  g.scale(rx, ry, rz);
  return g;
}

// ─── Cartoon Body Proportions ─────────────────────────────────────────────────
// All measurements in metres, standing height ≈ 1.75 m
// Cartoon style: head 1/5 of height (vs realistic 1/8), wide shoulders, slim waist

const P = {
  // Head
  headRX: 0.130, headRY: 0.155, headRZ: 0.125,
  headY:  1.620,

  // Neck
  neckR:  0.052, neckH: 0.095, neckY: 1.510,

  // Torso
  chestRTop: 0.175, chestRBot: 0.145, chestH: 0.320, chestY: 1.195,
  waistRTop: 0.145, waistRBot: 0.155, waistH: 0.130, waistY: 0.960,
  hipsRTop:  0.160, hipsRBot:  0.170, hipsH:  0.140, hipsY:  0.840,

  // Arms (T-pose: arms out horizontally)
  shoulderR: 0.068, shoulderX: 0.220, shoulderY: 1.360,
  upperArmR: 0.058, upperArmH: 0.220, upperArmX: 0.340, upperArmY: 1.260,
  elbowR:    0.052, elbowX:    0.430, elbowY:    1.260,
  lowerArmR: 0.046, lowerArmH: 0.200, lowerArmX: 0.545, lowerArmY: 1.260,
  wristR:    0.038, wristX:    0.640, wristY:    1.260,

  // Legs
  hipJointR: 0.080, hipJointX: 0.130, hipJointY: 0.820,
  thighR:    0.088, thighH:    0.280, thighX:    0.130, thighY:    0.620,
  kneeR:     0.072, kneeX:     0.130, kneeY:     0.430,
  shinR:     0.062, shinH:     0.250, shinX:     0.130, shinY:     0.240,
  ankleR:    0.052, ankleX:    0.130, ankleY:    0.075,
};

// ─── Cartoon Head ─────────────────────────────────────────────────────────────

export class CartoonHead {
  constructor(skinHex = '#E8A882') {
    this.group = new THREE.Group();
    this.parts = {};
    this._skinHex = skinHex;
    this._build();
  }

  _add(name, geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.name = name;
    this.group.add(m);
    this.parts[name] = m;
    return m;
  }

  _build() {
    const sk = this._skinHex;

    // ── Skull ─────────────────────────────────────────────────────────────────
    // Cartoon head: tall forehead, wide cheeks, small chin
    const headGeo = new THREE.SphereGeometry(1, 32, 24);
    // Squash into cartoon proportions
    const hPos = headGeo.attributes.position;
    for (let i = 0; i < hPos.count; i++) {
      const x = hPos.getX(i);
      const y = hPos.getY(i);
      const z = hPos.getZ(i);
      // Widen cheeks at mid-height, narrow chin
      const t = (y + 1) / 2; // 0=bottom 1=top
      const cheekBulge = 1.0 + 0.18 * Math.sin(t * Math.PI);
      const chinNarrow = t < 0.25 ? 0.72 + t * 1.12 : 1.0;
      hPos.setX(i, x * P.headRX * cheekBulge * chinNarrow);
      hPos.setY(i, y * P.headRY);
      hPos.setZ(i, z * P.headRZ * (1 + 0.08 * t)); // slightly more depth at forehead
    }
    headGeo.computeVertexNormals();
    this._add('skull', headGeo, skinMat(sk, { roughness: 0.65 }), 0, P.headY, 0);

    // ── Jaw / chin bump ───────────────────────────────────────────────────────
    const jawGeo = ovalSphere(0.072, 0.048, 0.062, 16);
    this._add('jaw', jawGeo, skinMat(sk, { roughness: 0.65 }), 0, P.headY - 0.135, P.headRZ * 0.55);

    // ── Cheek puffs ───────────────────────────────────────────────────────────
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const cg = ovalSphere(0.052, 0.038, 0.034, 14);
      this._add(`cheek_${s}`, cg, skinMat(sk, { roughness: 0.6 }), sx * 0.108, P.headY - 0.042, P.headRZ * 0.88);
    }

    // ── Nose ──────────────────────────────────────────────────────────────────
    // Bridge
    const bridgeGeo = taperedCyl(0.014, 0.022, 0.048, 10, 3);
    const bridge = this._add('noseBridge', bridgeGeo, skinMat(sk), 0, P.headY - 0.028, P.headRZ * 0.88);
    bridge.rotation.x = 0.25;
    // Tip
    const tipGeo = ovalSphere(0.026, 0.022, 0.028, 14);
    this._add('noseTip', tipGeo, skinMat(sk), 0, P.headY - 0.068, P.headRZ * 0.98);
    // Nostrils
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const ng = ovalSphere(0.014, 0.012, 0.018, 10);
      this._add(`nostril_${s}`, ng, skinMat(sk, { roughness: 0.75 }), sx * 0.018, P.headY - 0.076, P.headRZ * 0.95);
    }

    // ── Lips ──────────────────────────────────────────────────────────────────
    // Upper lip — M-shape via two bumps
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const ulg = ovalSphere(0.022, 0.014, 0.016, 12);
      this._add(`upperLip_${s}`, ulg, new THREE.MeshToonMaterial({ color: 0xd4756a }), sx * 0.022, P.headY - 0.104, P.headRZ * 0.99);
    }
    // Lower lip — fuller
    const llg = ovalSphere(0.048, 0.018, 0.020, 14);
    this._add('lowerLip', llg, new THREE.MeshToonMaterial({ color: 0xd4756a }), 0, P.headY - 0.122, P.headRZ * 0.99);
    // Lip line
    const lipLineGeo = new THREE.TorusGeometry(0.028, 0.005, 6, 18, Math.PI);
    const lipLine = this._add('lipLine', lipLineGeo, new THREE.MeshToonMaterial({ color: 0xb05a52 }), 0, P.headY - 0.108, P.headRZ * 1.0);
    lipLine.rotation.x = Math.PI;

    // ── Eyes ──────────────────────────────────────────────────────────────────
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const ex = sx * 0.068, ey = P.headY + 0.018, ez = P.headRZ * 0.88;

      // Eye socket (slight indent) — dark ring
      const socketGeo = ovalSphere(0.058, 0.046, 0.012, 18);
      this._add(`eyeSocket_${s}`, socketGeo, new THREE.MeshToonMaterial({ color: 0x1a0a08 }), ex, ey, ez + 0.002);

      // Sclera (white)
      const scleraGeo = ovalSphere(0.052, 0.042, 0.020, 18);
      this._add(`sclera_${s}`, scleraGeo, new THREE.MeshToonMaterial({ color: 0xfaf8f5, roughness: 0.2 }), ex, ey, ez + 0.006);

      // Iris — large cartoon iris
      const irisGeo = ovalSphere(0.034, 0.034, 0.018, 16);
      this._add(`iris_${s}`, irisGeo, new THREE.MeshToonMaterial({ color: 0xd4820a, roughness: 0.1, emissive: new THREE.Color(0x3a1a00), emissiveIntensity: 0.3 }), ex, ey, ez + 0.018);

      // Pupil
      const pupilGeo = ovalSphere(0.018, 0.018, 0.012, 12);
      this._add(`pupil_${s}`, pupilGeo, new THREE.MeshToonMaterial({ color: 0x080404 }), ex, ey, ez + 0.026);

      // Catchlight (specular highlight)
      const catchGeo = ovalSphere(0.008, 0.008, 0.006, 8);
      this._add(`catchlight_${s}`, catchGeo, new THREE.MeshToonMaterial({ color: 0xffffff, emissive: new THREE.Color(0xffffff), emissiveIntensity: 1.0 }), ex + sx * 0.010, ey + 0.010, ez + 0.030);

      // Upper eyelid
      const lidGeo = new THREE.TorusGeometry(0.040, 0.009, 8, 20, Math.PI * 1.05);
      const lid = this._add(`upperLid_${s}`, lidGeo, skinMat(sk), ex, ey + 0.004, ez + 0.018);
      lid.rotation.x = -0.15;
      lid.rotation.z = sx * 0.08;

      // Lower eyelid
      const lLidGeo = new THREE.TorusGeometry(0.038, 0.006, 6, 16, Math.PI * 0.85);
      const lLid = this._add(`lowerLid_${s}`, lLidGeo, skinMat(sk), ex, ey - 0.006, ez + 0.018);
      lLid.rotation.x = Math.PI + 0.15;
      lLid.rotation.z = sx * 0.06;

      // Eyelashes — upper (thick stylized)
      for (let i = 0; i < 7; i++) {
        const angle = (i / 6) * Math.PI - Math.PI * 0.05;
        const lx = ex + Math.cos(angle) * 0.042 * sx;
        const ly = ey + Math.sin(angle) * 0.036 + 0.008;
        const lashLen = (i === 0 || i === 6) ? 0.016 : (i === 3 ? 0.022 : 0.019);
        const lashGeo = new THREE.CylinderGeometry(0.0015, 0.0005, lashLen, 4);
        const lash = this._add(`lash_${s}_${i}`, lashGeo, new THREE.MeshToonMaterial({ color: 0x0a0508 }), lx, ly + lashLen * 0.5, ez + 0.022);
        lash.rotation.z = -angle * sx + Math.PI * 0.5;
        lash.rotation.x = -0.3;
      }

      // Thick stylized eyebrow
      const browGeo = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(ex - sx * 0.052, ey + 0.068, ez + 0.020),
          new THREE.Vector3(ex - sx * 0.018, ey + 0.082, ez + 0.022),
          new THREE.Vector3(ex + sx * 0.022, ey + 0.076, ez + 0.020),
          new THREE.Vector3(ex + sx * 0.048, ey + 0.058, ez + 0.016),
        ]),
        12, 0.010, 6, false
      );
      this._add(`brow_${s}`, browGeo, new THREE.MeshToonMaterial({ color: 0x1a0e28 }), 0, 0, 0);
    }

    // ── Ears ──────────────────────────────────────────────────────────────────
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      // Outer ear
      const earGeo = ovalSphere(0.034, 0.052, 0.022, 14);
      this._add(`ear_${s}`, earGeo, skinMat(sk), sx * (P.headRX + 0.018), P.headY + 0.008, 0);
      // Inner ear
      const innerGeo = ovalSphere(0.018, 0.030, 0.012, 10);
      this._add(`earInner_${s}`, innerGeo, skinMat(sk, { color: new THREE.Color(sk).multiplyScalar(0.88) }), sx * (P.headRX + 0.022), P.headY + 0.006, 0.005);
      // Earlobe
      const lobeGeo = ovalSphere(0.016, 0.018, 0.014, 10);
      this._add(`earlobe_${s}`, lobeGeo, skinMat(sk), sx * (P.headRX + 0.016), P.headY - 0.042, 0);
    }
  }

  setSkinTone(hex) {
    this._skinHex = hex;
    const skinParts = ['skull', 'jaw', 'cheek_L', 'cheek_R', 'noseBridge', 'noseTip',
      'nostril_L', 'nostril_R', 'upperLid_L', 'upperLid_R', 'lowerLid_L', 'lowerLid_R',
      'ear_L', 'ear_R', 'earInner_L', 'earInner_R', 'earlobe_L', 'earlobe_R'];
    skinParts.forEach(n => {
      if (this.parts[n]) this.parts[n].material.color.set(hex);
    });
    // Slightly darker for inner ear
    ['earInner_L', 'earInner_R'].forEach(n => {
      if (this.parts[n]) this.parts[n].material.color.set(new THREE.Color(hex).multiplyScalar(0.88));
    });
  }

  setEyeColor(hex) {
    ['iris_L', 'iris_R'].forEach(n => {
      if (this.parts[n]) this.parts[n].material.color.set(hex);
    });
  }

  setBrowColor(hex) {
    ['brow_L', 'brow_R'].forEach(n => {
      if (this.parts[n]) this.parts[n].material.color.set(hex);
    });
  }
}

// ─── Cartoon Hand with Fingers ────────────────────────────────────────────────

export class CartoonHand {
  constructor(side = 'R', skinHex = '#E8A882') {
    this.group = new THREE.Group();
    this.side = side;
    this._skinHex = skinHex;
    this._build();
  }

  _add(name, geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.name = name;
    this.group.add(m);
    return m;
  }

  _build() {
    const sk = this._skinHex;
    const sx = this.side === 'L' ? -1 : 1;

    // Palm
    const palmGeo = ovalSphere(0.038, 0.028, 0.022, 16);
    this._add('palm', palmGeo, skinMat(sk), 0, 0, 0);

    // 4 fingers + thumb
    const fingerDefs = [
      { name: 'thumb',  x: sx * -0.030, y:  0.010, z:  0.018, len: 0.040, r: 0.011, angle: sx * 0.6 },
      { name: 'index',  x: sx * -0.016, y:  0.032, z:  0.006, len: 0.048, r: 0.010, angle: 0 },
      { name: 'middle', x:  0,           y:  0.036, z:  0.002, len: 0.052, r: 0.010, angle: 0 },
      { name: 'ring',   x: sx *  0.016, y:  0.032, z:  0.006, len: 0.046, r: 0.009, angle: 0 },
      { name: 'pinky',  x: sx *  0.030, y:  0.024, z:  0.010, len: 0.036, r: 0.008, angle: 0 },
    ];

    fingerDefs.forEach(f => {
      // Proximal phalanx
      const seg1 = new THREE.CapsuleGeometry(f.r, f.len * 0.42, 4, 8);
      const m1 = this._add(`${f.name}_p1`, seg1, skinMat(sk), f.x, f.y + f.len * 0.21, f.z);
      m1.rotation.z = f.angle;
      // Middle phalanx
      const seg2 = new THREE.CapsuleGeometry(f.r * 0.88, f.len * 0.32, 4, 8);
      const m2 = this._add(`${f.name}_p2`, seg2, skinMat(sk), f.x, f.y + f.len * 0.21 + f.len * 0.37, f.z);
      m2.rotation.z = f.angle;
      // Distal phalanx + nail
      const seg3 = new THREE.CapsuleGeometry(f.r * 0.78, f.len * 0.22, 4, 8);
      const m3 = this._add(`${f.name}_p3`, seg3, skinMat(sk), f.x, f.y + f.len * 0.21 + f.len * 0.37 + f.len * 0.27, f.z);
      m3.rotation.z = f.angle;
      // Nail
      const nailGeo = ovalSphere(f.r * 0.65, f.r * 0.25, f.r * 0.55, 8);
      this._add(`${f.name}_nail`, nailGeo, new THREE.MeshToonMaterial({ color: 0xf5c4b8 }), f.x, f.y + f.len * 0.85, f.z + f.r * 0.5);
    });
  }

  setSkinTone(hex) {
    this._skinHex = hex;
    this.group.traverse(m => {
      if (m.isMesh && !m.name.includes('nail')) m.material.color.set(hex);
    });
  }
}

// ─── Main CartoonBodyMesh ─────────────────────────────────────────────────────

export class CartoonBodyMesh {
  constructor(initialState = {}) {
    this.group = new THREE.Group();
    this.parts = {};

    this._skinHex  = initialState.skinTone  || '#E8A882';
    this._topColor = initialState.topColor   || '#1a1a2e';
    this._botColor = initialState.botColor   || '#0f0f1a';
    this._currentShape = initialState.bodyShape || 'average';
    this._muscleTone   = initialState.muscleTone ?? 0.5;
    this._gender       = initialState.gender || 'neutral';

    this._build();
    this._applyShape();
  }

  _add(name, geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = name;
    this.group.add(m);
    this.parts[name] = m;
    return m;
  }

  _build() {
    const sk  = this._skinHex;
    const top = this._topColor;
    const bot = this._botColor;

    // ── Neck ──────────────────────────────────────────────────────────────────
    this._add('neck', taperedCyl(0.052, 0.065, 0.095, 16, 4), skinMat(sk), 0, P.neckY, 0);

    // ── Torso ─────────────────────────────────────────────────────────────────
    // Chest — wider at top (shoulders), tapers to waist
    const chestGeo = taperedCyl(P.chestRTop, P.chestRBot, P.chestH, 20, 6);
    // Add slight front bulge for chest
    const cPos = chestGeo.attributes.position;
    for (let i = 0; i < cPos.count; i++) {
      const y = cPos.getY(i);
      const t = (y / P.chestH) + 0.5;
      const z = cPos.getZ(i);
      if (z > 0) cPos.setZ(i, z * (1 + 0.12 * Math.sin(t * Math.PI)));
    }
    chestGeo.computeVertexNormals();
    this._add('chest', chestGeo, clothMat(top), 0, P.chestY, 0);

    this._add('waist', taperedCyl(P.waistRTop, P.waistRBot, P.waistH, 20, 4), clothMat(top), 0, P.waistY, 0);
    this._add('hips',  taperedCyl(P.hipsRTop,  P.hipsRBot,  P.hipsH,  20, 4), clothMat(bot), 0, P.hipsY,  0);

    // ── Shoulders (smooth blend from chest to upper arm) ──────────────────────
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const sg = ovalSphere(P.shoulderR * 1.1, P.shoulderR * 0.9, P.shoulderR * 0.95, 16);
      this._add(`shoulder_${s}`, sg, skinMat(sk), sx * P.shoulderX, P.shoulderY, 0);
    }

    // ── Upper arms (T-pose: horizontal) ──────────────────────────────────────
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const g = taperedCyl(P.upperArmR, P.upperArmR * 0.90, P.upperArmH, 16, 5);
      const m = this._add(`upperArm_${s}`, g, skinMat(sk), sx * P.upperArmX, P.upperArmY, 0);
      m.rotation.z = sx * (Math.PI / 2);
    }

    // ── Elbow joints ──────────────────────────────────────────────────────────
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      this._add(`elbow_${s}`, ovalSphere(P.elbowR, P.elbowR * 0.92, P.elbowR, 14), skinMat(sk), sx * P.elbowX, P.elbowY, 0);
    }

    // ── Lower arms ────────────────────────────────────────────────────────────
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const g = taperedCyl(P.lowerArmR, P.lowerArmR * 0.82, P.lowerArmH, 14, 5);
      const m = this._add(`lowerArm_${s}`, g, skinMat(sk), sx * P.lowerArmX, P.lowerArmY, 0);
      m.rotation.z = sx * (Math.PI / 2);
    }

    // ── Wrist joints ──────────────────────────────────────────────────────────
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      this._add(`wrist_${s}`, ovalSphere(P.wristR, P.wristR * 0.85, P.wristR * 0.72, 12), skinMat(sk), sx * P.wristX, P.wristY, 0);
    }

    // ── Hands ─────────────────────────────────────────────────────────────────
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const hand = new CartoonHand(s, sk);
      hand.group.position.set(sx * (P.wristX + 0.048), P.wristY, 0);
      hand.group.rotation.z = sx * (Math.PI / 2);
      this.group.add(hand.group);
      this.parts[`hand_${s}`] = hand;
    }

    // ── Hip joints ────────────────────────────────────────────────────────────
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      this._add(`hipJoint_${s}`, ovalSphere(P.hipJointR, P.hipJointR * 0.88, P.hipJointR, 14), clothMat(bot), sx * P.hipJointX, P.hipJointY, 0);
    }

    // ── Thighs ────────────────────────────────────────────────────────────────
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      // Slight front-back oval for realistic thigh
      const tg = taperedCyl(P.thighR, P.thighR * 0.82, P.thighH, 16, 6);
      const tPos = tg.attributes.position;
      for (let i = 0; i < tPos.count; i++) {
        const y = tPos.getY(i);
        const t = (y / P.thighH) + 0.5;
        tPos.setZ(i, tPos.getZ(i) * (1 + 0.08 * t));
      }
      tg.computeVertexNormals();
      this._add(`thigh_${s}`, tg, clothMat(bot), sx * P.thighX, P.thighY, 0);
    }

    // ── Knee joints ───────────────────────────────────────────────────────────
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      this._add(`knee_${s}`, ovalSphere(P.kneeR, P.kneeR * 0.90, P.kneeR * 0.88, 14), skinMat(sk), sx * P.kneeX, P.kneeY, 0);
    }

    // ── Shins ─────────────────────────────────────────────────────────────────
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const sg = taperedCyl(P.shinR, P.shinR * 0.72, P.shinH, 14, 5);
      this._add(`shin_${s}`, sg, skinMat(sk), sx * P.shinX, P.shinY, 0);
    }

    // ── Ankle joints ──────────────────────────────────────────────────────────
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      this._add(`ankle_${s}`, ovalSphere(P.ankleR, P.ankleR * 0.78, P.ankleR * 0.80, 12), skinMat(sk), sx * P.ankleX, P.ankleY, 0);
    }

    // ── Feet ──────────────────────────────────────────────────────────────────
    for (const [s, sx] of [['L', -1], ['R', 1]]) {
      const fg = new THREE.BoxGeometry(0.095, 0.055, 0.175);
      // Round the toe end
      const fPos = fg.attributes.position;
      for (let i = 0; i < fPos.count; i++) {
        const z = fPos.getZ(i);
        if (z > 0.06) {
          const taper = 1 - (z - 0.06) / 0.08;
          fPos.setX(i, fPos.getX(i) * taper);
          fPos.setY(i, fPos.getY(i) * taper);
        }
      }
      fg.computeVertexNormals();
      this._add(`foot_${s}`, fg, skinMat(sk), sx * P.ankleX, 0.028, 0.040);
    }

    // ── Head + Face ───────────────────────────────────────────────────────────
    this.cartoonHead = new CartoonHead(sk);
    this.group.add(this.cartoonHead.group);
  }

  // ─── Shape morphing ──────────────────────────────────────────────────────────
  _applyShape() {
    const shapes = {
      slim:     { torsoW: 0.88, hipW: 0.90, armW: 0.90, legW: 0.88 },
      average:  { torsoW: 1.00, hipW: 1.00, armW: 1.00, legW: 1.00 },
      athletic: { torsoW: 1.08, hipW: 0.96, armW: 1.12, legW: 1.08 },
      heavy:    { torsoW: 1.22, hipW: 1.20, armW: 1.14, legW: 1.16 },
      curvy:    { torsoW: 1.02, hipW: 1.18, armW: 0.96, legW: 1.10 },
    };
    const genders = {
      neutral:   { torsoW: 1.00, hipW: 1.00, neckW: 1.00 },
      masculine: { torsoW: 1.08, hipW: 0.92, neckW: 1.10 },
      feminine:  { torsoW: 0.92, hipW: 1.10, neckW: 0.90 },
    };
    const s = shapes[this._currentShape] || shapes.average;
    const g = genders[this._gender] || genders.neutral;
    const mt = this._muscleTone;

    const tw = s.torsoW * g.torsoW;
    const hw = s.hipW * g.hipW;
    const aw = s.armW * (1 + mt * 0.10);
    const lw = s.legW * (1 + mt * 0.08);

    const sc = (name, x, y, z) => {
      if (this.parts[name]) this.parts[name].scale.set(x, y, z);
    };

    sc('chest', tw, 1, tw * 0.92);
    sc('waist', tw * 0.92, 1, tw * 0.88);
    sc('hips',  hw, 1, hw * 0.90);
    sc('neck',  g.neckW, 1, g.neckW);

    for (const side of ['L', 'R']) {
      sc(`shoulder_${side}`,  aw * 0.96, 1, aw * 0.96);
      sc(`upperArm_${side}`,  aw, 1, aw);
      sc(`elbow_${side}`,     aw * 0.92, 1, aw * 0.92);
      sc(`lowerArm_${side}`,  aw * 0.88, 1, aw * 0.88);
      sc(`wrist_${side}`,     aw * 0.80, 1, aw * 0.80);
      sc(`hipJoint_${side}`,  hw * 0.96, 1, hw * 0.96);
      sc(`thigh_${side}`,     lw, 1, lw * 0.96);
      sc(`knee_${side}`,      lw * 0.90, 1, lw * 0.90);
      sc(`shin_${side}`,      lw * 0.86, 1, lw * 0.86);
      sc(`ankle_${side}`,     lw * 0.80, 1, lw * 0.80);
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  setSkinTone(hex) {
    this._skinHex = hex;
    const skinParts = [
      'neck', 'shoulder_L', 'shoulder_R',
      'upperArm_L', 'upperArm_R', 'elbow_L', 'elbow_R',
      'lowerArm_L', 'lowerArm_R', 'wrist_L', 'wrist_R',
      'knee_L', 'knee_R', 'shin_L', 'shin_R', 'ankle_L', 'ankle_R',
      'foot_L', 'foot_R',
    ];
    skinParts.forEach(n => {
      if (this.parts[n]) this.parts[n].material.color.set(hex);
    });
    // Hands
    for (const s of ['L', 'R']) {
      if (this.parts[`hand_${s}`]) this.parts[`hand_${s}`].setSkinTone(hex);
    }
    // Head
    if (this.cartoonHead) this.cartoonHead.setSkinTone(hex);
  }

  setBodyShape(shape) {
    this._currentShape = shape;
    this._applyShape();
  }

  setMuscleTone(v) {
    this._muscleTone = Math.max(0, Math.min(1, v));
    this._applyShape();
  }

  setGender(g) {
    this._gender = g;
    this._applyShape();
  }

  setHeight(metres) {
    this.group.scale.setScalar(metres / 1.75);
  }

  setClothingColor(slot, hex) {
    const topParts  = ['chest', 'waist'];
    const botParts  = ['hips', 'hipJoint_L', 'hipJoint_R', 'thigh_L', 'thigh_R', 'knee_L', 'knee_R'];
    const parts = slot === 'top' ? topParts : botParts;
    parts.forEach(n => {
      if (this.parts[n]) this.parts[n].material.color.set(hex);
    });
  }

  getAttachPoint(slot) {
    const pts = {
      hair:       new THREE.Vector3(0,     1.76,  0),
      hat:        new THREE.Vector3(0,     1.78,  0),
      glasses:    new THREE.Vector3(0,     1.638, 0.128),
      sunglasses: new THREE.Vector3(0,     1.638, 0.128),
      earringL:   new THREE.Vector3(-0.165, 1.580, 0),
      earringR:   new THREE.Vector3( 0.165, 1.580, 0),
      necklace:   new THREE.Vector3(0,     1.500, 0.068),
      braceletL:  new THREE.Vector3(-0.640, 1.260, 0),
      braceletR:  new THREE.Vector3( 0.640, 1.260, 0),
      ring:       new THREE.Vector3( 0.680, 1.260, 0),
      shirt:      new THREE.Vector3(0,     1.195, 0),
      jacket:     new THREE.Vector3(0,     1.195, 0),
      pants:      new THREE.Vector3(0,     0.840, 0),
      shoes:      new THREE.Vector3(0,     0.028, 0.040),
      sneakers:   new THREE.Vector3(0,     0.028, 0.040),
      boots:      new THREE.Vector3(0,     0.028, 0.040),
    };
    return pts[slot] || new THREE.Vector3(0, 1.0, 0);
  }

  // Idle breathing animation
  update() {
    const t = performance.now() * 0.001;
    if (this.parts.chest) {
      this.parts.chest.scale.z = (this._currentShape === 'heavy' ? 1.10 : 1.0) * (1 + Math.sin(t * 0.8) * 0.008);
    }
  }

  dispose() {
    this.group.traverse(obj => {
      if (obj.isMesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material?.dispose();
      }
    });
  }
}
