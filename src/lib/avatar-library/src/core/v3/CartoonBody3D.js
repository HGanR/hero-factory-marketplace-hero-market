/**
 * CartoonBody3D.js — Smooth continuous cartoon humanoid body
 *
 * Builds a stylized cartoon body using lathe profiles and merged geometry:
 * - Smooth torso with chest/waist/hip curves
 * - Seamless arms with shoulder-to-wrist taper
 * - Smooth legs with thigh-to-ankle taper
 * - Detailed hands with 4 fingers + thumb
 * - Stylized feet
 * - No visible joint seams
 */

import * as THREE from 'three';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color: new THREE.Color(color), ...opts });
}

function lathe(points, segs = 32) {
  return new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    segs
  );
}

function sphere(rx, ry, rz, ws = 28, hs = 20) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  return g;
}

function capsule(r, len, cap = 8, rad = 16) {
  return new THREE.CapsuleGeometry(r, len, cap, rad);
}

function place(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Body proportions — can be scaled by body shape
const BASE = {
  // Torso
  shoulderW: 0.200,
  chestW:    0.185,
  waistW:    0.145,
  hipW:      0.175,
  torsoH:    0.420,
  // Arms
  upperArmR: 0.058,
  lowerArmR: 0.048,
  wristR:    0.036,
  armLen:    0.320,
  // Legs
  thighR:    0.068,
  shinR:     0.052,
  ankleR:    0.038,
  legLen:    0.420,
  // Positions
  shoulderY: 0.180,  // relative to torso center
  hipY:     -0.210,
};

// ─── CartoonBody3D ────────────────────────────────────────────────────────────

export class CartoonBody3D {
  constructor(skinHex = '#f4c5a0') {
    this.group = new THREE.Group();
    this.parts = {};
    this._skinHex = skinHex;
    this._shape = 'average';
    this._muscle = 0.5;
    this._gender = 0.5;
    /** Depth scale from shape/muscle; breathing multiplies this in CartoonAvatarStudio._loop */
    this._torsoBaseZ = 0.72;
    this._build(skinHex);
    this._applyShape();
  }

  _build(sk) {
    this._buildTorso(sk);
    this._buildArms(sk);
    this._buildLegs(sk);
  }

  // ── Torso ──────────────────────────────────────────────────────────────────
  _buildTorso(sk) {
    const B = BASE;

    // Main torso body using lathe — creates smooth hourglass shape
    // Profile from hip bottom to shoulder top
    const torsoPts = [
      [0.000,  B.torsoH * 0.50],   // shoulder top center
      [B.shoulderW * 0.60, B.torsoH * 0.48],
      [B.shoulderW,        B.torsoH * 0.42],  // shoulder width
      [B.chestW,           B.torsoH * 0.28],  // chest
      [B.chestW * 0.92,    B.torsoH * 0.14],
      [B.waistW,           B.torsoH * 0.00],  // waist (center)
      [B.waistW * 1.05,   -B.torsoH * 0.10],
      [B.hipW,            -B.torsoH * 0.28],  // hips
      [B.hipW * 0.92,     -B.torsoH * 0.42],
      [B.hipW * 0.72,     -B.torsoH * 0.50],  // crotch
    ];
    const torsoGeo = lathe(torsoPts, 48);
    const torsoMat = toon(sk, { roughness: 0.7 });
    const torso = place(torsoGeo, torsoMat, 0, 0, 0);
    torso.name = 'torso';
    this.group.add(torso);
    this.parts.torso = torso;

    // Chest depth — torso is a lathe (rotationally symmetric) so we scale Z
    torso.scale.z = 0.72; // flatten front-to-back for realistic body depth

    // Neck cylinder — bridges torso top to head neck base
    const neckPts = [
      [0.000, B.torsoH * 0.50],
      [0.032, B.torsoH * 0.50],
      [0.038, B.torsoH * 0.52],
      [0.036, B.torsoH * 0.56],
      [0.034, B.torsoH * 0.60],
      [0.042, B.torsoH * 0.62],
    ];
    const neckGeo = lathe(neckPts, 28);
    const neck = place(neckGeo, toon(sk, { roughness: 0.7 }), 0, 0, 0);
    neck.name = 'neck';
    this.group.add(neck);
    this.parts.neck = neck;

    // Collar bone area — slight protrusion
    const collarGeo = new THREE.CapsuleGeometry(0.014, B.shoulderW * 1.4, 6, 12);
    const collar = place(collarGeo, toon(sk, { roughness: 0.65 }),
      0, B.torsoH * 0.44, B.chestW * 0.55, 0, 0, Math.PI / 2);
    collar.name = 'collarBone';
    this.group.add(collar);
    this.parts.collarBone = collar;

    // Spine line — subtle back detail
    const spineCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0,  B.torsoH * 0.40, -B.chestW * 0.55),
      new THREE.Vector3(0,  B.torsoH * 0.10, -B.waistW * 0.62),
      new THREE.Vector3(0, -B.torsoH * 0.20, -B.hipW * 0.58),
      new THREE.Vector3(0, -B.torsoH * 0.45, -B.hipW * 0.52),
    ]);
    const spineGeo = new THREE.TubeGeometry(spineCurve, 10, 0.008, 6, false);
    const spine = new THREE.Mesh(spineGeo, toon(sk, { roughness: 0.8 }));
    spine.name = 'spine';
    this.group.add(spine);
  }

  // ── Arms ───────────────────────────────────────────────────────────────────
  _buildArms(sk) {
    const B = BASE;

    for (const sx of [-1, 1]) {
      const side = sx > 0 ? 'R' : 'L';

      // Shoulder cap — smooth sphere blending torso to arm
      const shoulderGeo = sphere(B.upperArmR * 1.15, B.upperArmR * 1.10, B.upperArmR * 1.10, 24, 18);
      const shoulder = place(shoulderGeo, toon(sk, { roughness: 0.65 }),
        sx * (B.shoulderW + B.upperArmR * 0.8), B.torsoH * 0.42, 0);
      shoulder.name = `shoulder_${side}`;
      this.group.add(shoulder);
      this.parts[`shoulder_${side}`] = shoulder;

      // Upper arm — tapered capsule
      const uArmPts = [
        [B.upperArmR,       0.000],
        [B.upperArmR * 0.98, 0.040],
        [B.upperArmR * 0.95, 0.090],
        [B.upperArmR * 0.90, 0.140],
        [B.lowerArmR * 1.05, 0.165],  // elbow
        [B.lowerArmR,        0.175],
      ];
      const uArmGeo = lathe(uArmPts, 28);
      const uArm = place(uArmGeo, toon(sk, { roughness: 0.65 }),
        sx * (B.shoulderW + B.upperArmR * 1.4), B.torsoH * 0.38, 0,
        0, 0, sx * Math.PI / 2);
      uArm.name = `upperArm_${side}`;
      this.group.add(uArm);
      this.parts[`upperArm_${side}`] = uArm;

      // Elbow — smooth sphere
      const elbowGeo = sphere(B.lowerArmR * 1.05, B.lowerArmR * 1.05, B.lowerArmR * 1.05, 20, 16);
      const elbowX = sx * (B.shoulderW + B.upperArmR * 1.4 + B.armLen * 0.50 * 0.95);
      const elbow = place(elbowGeo, toon(sk, { roughness: 0.7 }), elbowX, B.torsoH * 0.38, 0);
      elbow.name = `elbow_${side}`;
      this.group.add(elbow);
      this.parts[`elbow_${side}`] = elbow;

      // Lower arm — tapered
      const lArmPts = [
        [B.lowerArmR,       0.000],
        [B.lowerArmR * 0.96, 0.050],
        [B.lowerArmR * 0.90, 0.110],
        [B.wristR * 1.08,    0.155],
        [B.wristR,           0.165],
      ];
      const lArmGeo = lathe(lArmPts, 24);
      const lArm = place(lArmGeo, toon(sk, { roughness: 0.65 }),
        elbowX + sx * 0.005, B.torsoH * 0.38, 0,
        0, 0, sx * Math.PI / 2);
      lArm.name = `lowerArm_${side}`;
      this.group.add(lArm);
      this.parts[`lowerArm_${side}`] = lArm;

      // Wrist
      const wristGeo = sphere(B.wristR, B.wristR * 0.85, B.wristR * 0.78, 18, 14);
      const wristX = elbowX + sx * (B.armLen * 0.50);
      const wrist = place(wristGeo, toon(sk, { roughness: 0.65 }), wristX, B.torsoH * 0.38, 0);
      wrist.name = `wrist_${side}`;
      this.group.add(wrist);
      this.parts[`wrist_${side}`] = wrist;

      // Hand
      this._buildHand(sk, sx, wristX, B.torsoH * 0.38);
    }
  }

  // ── Hand with fingers ──────────────────────────────────────────────────────
  _buildHand(sk, sx, baseX, baseY) {
    const side = sx > 0 ? 'R' : 'L';
    const B = BASE;
    const handGroup = new THREE.Group();
    handGroup.position.set(baseX + sx * 0.040, baseY, 0);
    handGroup.name = `hand_${side}`;
    this.group.add(handGroup);
    this.parts[`hand_${side}`] = handGroup;

    // Palm
    const palmGeo = sphere(0.042, 0.028, 0.020, 20, 14);
    const palm = place(palmGeo, toon(sk, { roughness: 0.65 }), 0, 0, 0);
    palm.name = 'palm';
    handGroup.add(palm);

    // 4 Fingers
    const fingerDefs = [
      { name: 'index',  ox: sx * 0.010, oy: 0.010, len: 0.048, r: 0.010 },
      { name: 'middle', ox: sx * 0.022, oy: 0.012, len: 0.054, r: 0.010 },
      { name: 'ring',   ox: sx * 0.034, oy: 0.008, len: 0.050, r: 0.009 },
      { name: 'pinky',  ox: sx * 0.044, oy: 0.002, len: 0.038, r: 0.008 },
    ];
    fingerDefs.forEach(f => {
      // Proximal phalanx
      const p1Geo = capsule(f.r, f.len * 0.40, 4, 8);
      const p1 = place(p1Geo, toon(sk, { roughness: 0.65 }),
        f.ox, f.oy + f.len * 0.22, 0);
      handGroup.add(p1);
      // Middle phalanx
      const p2Geo = capsule(f.r * 0.92, f.len * 0.32, 4, 8);
      const p2 = place(p2Geo, toon(sk, { roughness: 0.65 }),
        f.ox, f.oy + f.len * 0.58, 0);
      handGroup.add(p2);
      // Distal phalanx (fingertip)
      const p3Geo = sphere(f.r * 0.88, f.r * 0.88, f.r * 0.80, 14, 10);
      const p3 = place(p3Geo, toon(sk, { roughness: 0.65 }),
        f.ox, f.oy + f.len * 0.88, 0);
      handGroup.add(p3);
    });

    // Thumb
    const thumbGeo = capsule(0.012, 0.032, 4, 8);
    const thumb = place(thumbGeo, toon(sk, { roughness: 0.65 }),
      sx * -0.038, 0.008, 0.008, 0, 0, sx * 0.5);
    handGroup.add(thumb);
    const thumbTipGeo = sphere(0.012, 0.012, 0.010, 12, 10);
    const thumbTip = place(thumbTipGeo, toon(sk, { roughness: 0.65 }),
      sx * -0.048, 0.028, 0.010);
    handGroup.add(thumbTip);
  }

  // ── Legs ───────────────────────────────────────────────────────────────────
  _buildLegs(sk) {
    const B = BASE;

    for (const sx of [-1, 1]) {
      const side = sx > 0 ? 'R' : 'L';
      const lx = sx * B.hipW * 0.58;

      // Hip joint — smooth sphere
      const hipGeo = sphere(B.thighR * 1.08, B.thighR * 1.08, B.thighR * 1.08, 22, 16);
      const hip = place(hipGeo, toon(sk, { roughness: 0.65 }), lx, -B.torsoH * 0.46, 0);
      hip.name = `hip_${side}`;
      this.group.add(hip);
      this.parts[`hip_${side}`] = hip;

      // Thigh — tapered lathe
      const thighPts = [
        [B.thighR,           0.000],
        [B.thighR * 0.98,    0.060],
        [B.thighR * 0.94,    0.130],
        [B.thighR * 0.88,    0.200],
        [B.shinR * 1.08,     0.230],  // knee
        [B.shinR,            0.240],
      ];
      const thighGeo = lathe(thighPts, 28);
      const thigh = place(thighGeo, toon(sk, { roughness: 0.65 }),
        lx, -B.torsoH * 0.46, 0, Math.PI, 0, 0);
      thigh.name = `thigh_${side}`;
      this.group.add(thigh);
      this.parts[`thigh_${side}`] = thigh;

      // Knee cap
      const kneeGeo = sphere(B.shinR * 1.08, B.shinR * 1.0, B.shinR * 1.05, 20, 16);
      const kneeY = -B.torsoH * 0.46 - B.legLen * 0.48;
      const knee = place(kneeGeo, toon(sk, { roughness: 0.7 }), lx, kneeY, 0.008);
      knee.name = `knee_${side}`;
      this.group.add(knee);
      this.parts[`knee_${side}`] = knee;

      // Shin — tapered
      const shinPts = [
        [B.shinR,            0.000],
        [B.shinR * 0.96,     0.060],
        [B.shinR * 0.88,     0.130],
        [B.shinR * 0.78,     0.195],
        [B.ankleR * 1.05,    0.225],
        [B.ankleR,           0.235],
      ];
      const shinGeo = lathe(shinPts, 24);
      const shin = place(shinGeo, toon(sk, { roughness: 0.65 }),
        lx, kneeY, 0, Math.PI, 0, 0);
      shin.name = `shin_${side}`;
      this.group.add(shin);
      this.parts[`shin_${side}`] = shin;

      // Ankle
      const ankleGeo = sphere(B.ankleR, B.ankleR * 0.88, B.ankleR * 0.82, 18, 14);
      const ankleY = kneeY - B.legLen * 0.50;
      const ankle = place(ankleGeo, toon(sk, { roughness: 0.65 }), lx, ankleY, 0);
      ankle.name = `ankle_${side}`;
      this.group.add(ankle);
      this.parts[`ankle_${side}`] = ankle;

      // Foot
      this._buildFoot(sk, sx, lx, ankleY);
    }
  }

  // ── Foot ───────────────────────────────────────────────────────────────────
  _buildFoot(sk, sx, baseX, baseY) {
    const side = sx > 0 ? 'R' : 'L';
    const footGroup = new THREE.Group();
    footGroup.position.set(baseX, baseY - 0.040, 0.028);
    footGroup.name = `foot_${side}`;
    this.group.add(footGroup);
    this.parts[`foot_${side}`] = footGroup;

    // Heel
    const heelGeo = sphere(0.038, 0.034, 0.040, 18, 14);
    const heel = place(heelGeo, toon(sk, { roughness: 0.7 }), 0, 0, -0.032);
    footGroup.add(heel);

    // Mid foot
    const midGeo = sphere(0.035, 0.028, 0.055, 18, 14);
    const mid = place(midGeo, toon(sk, { roughness: 0.65 }), 0, -0.006, 0.020);
    footGroup.add(mid);

    // Toe box
    const toeGeo = sphere(0.040, 0.026, 0.042, 18, 14);
    const toe = place(toeGeo, toon(sk, { roughness: 0.65 }), 0, -0.010, 0.068);
    footGroup.add(toe);
  }

  // ── Body shape morphing ────────────────────────────────────────────────────

  setBodyShape(shape) {
    this._shape = shape;
    this._applyShape();
  }

  setMuscleTone(v) {
    this._muscle = Math.max(0, Math.min(1, v));
    this._applyShape();
  }

  setGender(g) {
    this._gender = Math.max(0, Math.min(1, g));
    this._applyShape();
  }

  _applyShape() {
    const t = this.parts.torso;
    if (!t) return;

    const shapeScales = {
      slim:     { x: 0.82, y: 1.02, z: 0.72 },
      average:  { x: 1.00, y: 1.00, z: 0.72 },
      athletic: { x: 1.08, y: 1.00, z: 0.74 },
      heavy:    { x: 1.22, y: 0.98, z: 0.80 },
      tall:     { x: 0.94, y: 1.10, z: 0.72 },
      petite:   { x: 0.88, y: 0.92, z: 0.70 },
      // Wreck Room / UI labels
      curvy:    { x: 1.12, y: 1.00, z: 0.76 },
      plus:     { x: 1.25, y: 0.95, z: 0.82 },
      muscular: { x: 1.14, y: 1.02, z: 0.76 },
    };
    const sc = shapeScales[this._shape] || shapeScales.average;
    const muscleBoost = this._muscle * 0.08;

    t.scale.set(
      sc.x + muscleBoost * 0.5,
      sc.y,
      sc.z + muscleBoost * 0.2
    );
    this._torsoBaseZ = t.scale.z;

    // Adjust arm thickness with muscle
    ['L', 'R'].forEach(s => {
      const ua = this.parts[`upperArm_${s}`];
      if (ua) ua.scale.set(1 + muscleBoost, 1, 1 + muscleBoost * 0.5);
      const la = this.parts[`lowerArm_${s}`];
      if (la) la.scale.set(1 + muscleBoost * 0.6, 1, 1 + muscleBoost * 0.3);
    });

    // Adjust leg thickness
    ['L', 'R'].forEach(s => {
      const th = this.parts[`thigh_${s}`];
      if (th) th.scale.set(1 + muscleBoost * 0.6, 1, 1 + muscleBoost * 0.3);
      const sh = this.parts[`shin_${s}`];
      if (sh) sh.scale.set(1 + muscleBoost * 0.4, 1, 1 + muscleBoost * 0.2);
    });

    // Gender blend — hip/shoulder ratio
    const genderScale = 0.85 + this._gender * 0.30;
    ['hip_L', 'hip_R'].forEach(n => {
      if (this.parts[n]) this.parts[n].scale.setScalar(genderScale);
    });
  }

  setSkinTone(hex) {
    this._skinHex = hex;
    this.group.traverse(obj => {
      if (obj.isMesh && obj.material && obj.material.isMeshToonMaterial) {
        // Only update skin-colored parts (not clothing)
        const c = obj.material.color;
        if (c.r > 0.4 || c.g > 0.3) { // rough heuristic for skin tones
          obj.material.color.set(hex);
        }
      }
    });
  }

  setHeight(metres) {
    this.group.scale.setScalar(metres / 1.75);
  }

  getAttachPoint(slot) {
    const B = BASE;
    const pts = {
      shirt:    new THREE.Vector3(0,  B.torsoH * 0.10, 0),
      jacket:   new THREE.Vector3(0,  B.torsoH * 0.10, 0),
      pants:    new THREE.Vector3(0, -B.torsoH * 0.28, 0),
      shoes:    new THREE.Vector3(0, -B.torsoH * 0.46 - BASE.legLen - 0.06, 0.028),
      sneakers: new THREE.Vector3(0, -B.torsoH * 0.46 - BASE.legLen - 0.06, 0.028),
      boots:    new THREE.Vector3(0, -B.torsoH * 0.46 - BASE.legLen - 0.06, 0.028),
      necklace: new THREE.Vector3(0,  B.torsoH * 0.44, 0.042),
      braceletL:new THREE.Vector3(-B.shoulderW - B.armLen * 0.82, B.torsoH * 0.38, 0),
      braceletR:new THREE.Vector3( B.shoulderW + B.armLen * 0.82, B.torsoH * 0.38, 0),
    };
    return pts[slot] || new THREE.Vector3(0, 0, 0);
  }

  update() {
    // Idle breathing
    const t = performance.now() * 0.001;
    if (this.parts.torso) {
      const breathe = 1 + Math.sin(t * 0.9) * 0.006;
      this.parts.torso.scale.z = 0.72 * breathe;
    }
  }

  dispose() {
    this.group.traverse(obj => {
      if (obj.isMesh) {
        obj.geometry?.dispose();
        obj.material?.dispose();
      }
    });
  }
}
