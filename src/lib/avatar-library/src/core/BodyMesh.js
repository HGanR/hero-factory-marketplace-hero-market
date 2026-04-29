/**
 * BodyMesh.js — Cartoon Humanoid Avatar Mesh (v2)
 *
 * Fully connected cartoon-style 3D character:
 *  - Tapered torso (chest wider than waist)
 *  - CapsuleGeometry limbs (smooth, no gaps)
 *  - Sphere joints at shoulders, elbows, knees, hips
 *  - Shaped hands and feet
 *  - Face with eyes, nose, mouth, ears, eyebrows
 *  - Separate skin / clothing materials
 *  - Body shape + muscle tone morphing
 */

import * as THREE from 'three';

// ─── Shape presets ────────────────────────────────────────────────────────────
const SHAPES = {
  slim:     { torsoW:0.82, torsoD:0.86, hipW:0.84, armW:0.84, legW:0.84, headS:0.96 },
  average:  { torsoW:1.00, torsoD:1.00, hipW:1.00, armW:1.00, legW:1.00, headS:1.00 },
  athletic: { torsoW:1.14, torsoD:1.06, hipW:1.06, armW:1.16, legW:1.12, headS:1.00 },
  muscular: { torsoW:1.30, torsoD:1.18, hipW:1.10, armW:1.32, legW:1.22, headS:1.02 },
  curvy:    { torsoW:1.10, torsoD:1.08, hipW:1.22, armW:1.04, legW:1.18, headS:1.00 },
  heavy:    { torsoW:1.36, torsoD:1.32, hipW:1.30, armW:1.18, legW:1.28, headS:1.04 },
};

const GENDER_MORPHS = {
  neutral:   { torsoW:1.00, hipW:1.00, neckW:1.00 },
  masculine: { torsoW:1.08, hipW:0.94, neckW:1.12 },
  feminine:  { torsoW:0.94, hipW:1.12, neckW:0.88 },
};

// ─── Material helpers ─────────────────────────────────────────────────────────
function skinMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.0 });
}
function clothMat(color, roughness = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.0 });
}

export class BodyMesh {
  constructor(initialState = {}) {
    this.group = new THREE.Group();
    this.parts = {};
    this._skinHex = initialState.skinTone || '#F5CBA7';
    this._topColor   = '#2c3e50';
    this._botColor   = '#1a252f';
    this._currentShape = initialState.bodyShape || 'average';
    this._muscleTone   = initialState.muscleTone ?? 0.5;
    this._gender       = initialState.gender || 'neutral';
    this._height       = initialState.height ?? 1.75;

    this._build();
    this._applyShapeAndMuscle();
    if (initialState.height) this.setHeight(initialState.height);
  }

  // ─── Build all parts ───────────────────────────────────────────────────────
  _build() {
    const sk = this._skinHex;
    const top = this._topColor;
    const bot = this._botColor;

    // HEAD
    const headGeo = new THREE.SphereGeometry(0.21, 24, 18);
    headGeo.scale(1.0, 1.08, 0.94);
    this._add('head', headGeo, skinMat(sk), 0, 1.73, 0);

    // NECK
    this._add('neck', new THREE.CylinderGeometry(0.074, 0.090, 0.13, 14), skinMat(sk), 0, 1.57, 0);

    // CHEST — tapered cylinder (wider at shoulders, narrower at waist)
    const chestGeo = new THREE.CylinderGeometry(0.175, 0.155, 0.36, 16, 3);
    this._add('chest', chestGeo, clothMat(top), 0, 1.26, 0);

    // WAIST — tapered cylinder (narrower top, slightly wider hips)
    const waistGeo = new THREE.CylinderGeometry(0.155, 0.165, 0.20, 16, 2);
    this._add('waist', waistGeo, clothMat(top), 0, 0.98, 0);

    // SHOULDER BLOBS — small, flush with chest edge to avoid protruding pads
    for (const [side, sx] of [['L',-1],['R',1]]) {
      this._add(`shoulder_${side}`, new THREE.SphereGeometry(0.072,14,10), skinMat(sk), sx*0.200, 1.38, 0);
    }

    // UPPER ARMS — close to torso, slight outward angle
    for (const [side, sx] of [['L',-1],['R',1]]) {
      const g = new THREE.CapsuleGeometry(0.065, 0.22, 8, 14);
      const m = this._add(`upperArm_${side}`, g, skinMat(sk), sx*0.255, 1.18, 0);
      m.rotation.z = sx * 0.12;
    }

    // ELBOW JOINTS
    for (const [side, sx] of [['L',-1],['R',1]]) {
      this._add(`elbow_${side}`, new THREE.SphereGeometry(0.062,12,10), skinMat(sk), sx*0.295, 0.97, 0);
    }

    // LOWER ARMS
    for (const [side, sx] of [['L',-1],['R',1]]) {
      const g = new THREE.CapsuleGeometry(0.054, 0.20, 8, 14);
      const m = this._add(`lowerArm_${side}`, g, skinMat(sk), sx*0.318, 0.78, 0);
      m.rotation.z = sx * 0.08;
    }

    // WRIST JOINTS
    for (const [side, sx] of [['L',-1],['R',1]]) {
      this._add(`wrist_${side}`, new THREE.SphereGeometry(0.050,10,8), skinMat(sk), sx*0.336, 0.61, 0);
    }

    // HANDS — flattened sphere
    for (const [side, sx] of [['L',-1],['R',1]]) {
      const g = new THREE.SphereGeometry(0.060, 14, 10);
      g.scale(1.05, 0.80, 0.68);
      this._add(`hand_${side}`, g, skinMat(sk), sx*0.348, 0.555, 0.01);
    }

    // HIP JOINTS — slightly inside the waist
    for (const [side, sx] of [['L',-1],['R',1]]) {
      this._add(`hip_${side}`, new THREE.SphereGeometry(0.094,14,10), clothMat(bot), sx*0.155, 0.86, 0);
    }

    // THIGHS
    for (const [side, sx] of [['L',-1],['R',1]]) {
      this._add(`thigh_${side}`, new THREE.CapsuleGeometry(0.088, 0.26, 8, 14), clothMat(bot), sx*0.155, 0.65, 0);
    }

    // KNEE JOINTS
    for (const [side, sx] of [['L',-1],['R',1]]) {
      this._add(`knee_${side}`, new THREE.SphereGeometry(0.080,12,10), clothMat(bot), sx*0.155, 0.44, 0);
    }

    // SHINS
    for (const [side, sx] of [['L',-1],['R',1]]) {
      this._add(`shin_${side}`, new THREE.CapsuleGeometry(0.070, 0.23, 8, 14), clothMat(bot), sx*0.155, 0.23, 0);
    }

    // ANKLE JOINTS
    for (const [side, sx] of [['L',-1],['R',1]]) {
      this._add(`ankle_${side}`, new THREE.SphereGeometry(0.064,10,8), skinMat(sk), sx*0.155, 0.068, 0);
    }

    // FEET — rounded box, angled slightly forward
    for (const [side, sx] of [['L',-1],['R',1]]) {
      const g = new THREE.BoxGeometry(0.100, 0.058, 0.185);
      const m = this._add(`foot_${side}`, g, skinMat(sk), sx*0.155, 0.029, 0.042);
      m.rotation.y = 0;
    }

    // Face features come from FaceBuilder (left panel) — not baked into the head mesh.
  }

  // ─── Tapered box (for torso/waist) ────────────────────────────────────────
  _taperedBox(topW, botW, topD, botD, height) {
    const geo = new THREE.CylinderGeometry(1, 1, height, 16, 4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const t = (y / height) + 0.5; // 0=bottom 1=top
      pos.setX(i, pos.getX(i) * THREE.MathUtils.lerp(botW, topW, t));
      pos.setZ(i, pos.getZ(i) * THREE.MathUtils.lerp(botD, topD, t));
    }
    geo.computeVertexNormals();
    return geo;
  }

  // ─── Add helper ───────────────────────────────────────────────────────────
  _add(name, geo, mat, x, y, z) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    this.group.add(mesh);
    this.parts[name] = mesh;
    return mesh;
  }

  // ─── Shape + muscle morphing ──────────────────────────────────────────────
  _applyShapeAndMuscle() {
    const s = SHAPES[this._currentShape] || SHAPES.average;
    const g = GENDER_MORPHS[this._gender] || GENDER_MORPHS.neutral;
    const mt = this._muscleTone;

    const tw = s.torsoW * g.torsoW;
    const td = s.torsoD;
    const hw = s.hipW * g.hipW;
    const aw = s.armW * (1 + mt * 0.12);
    const lw = s.legW * (1 + mt * 0.09);

    // Torso
    this._scale('chest',  tw, 1, td);
    this._scale('waist',  tw * 0.96, 1, td * 0.96);

    // Shoulders
    for (const side of ['L','R']) {
      this._scale(`shoulder_${side}`, aw * 0.95, 1, aw * 0.95);
      this._scale(`upperArm_${side}`, aw, 1, aw);
      this._scale(`elbow_${side}`,    aw * 0.92, 1, aw * 0.92);
      this._scale(`lowerArm_${side}`, aw * 0.88, 1, aw * 0.88);
      this._scale(`wrist_${side}`,    aw * 0.80, 1, aw * 0.80);
      this._scale(`hand_${side}`,     aw * 0.88, 1, aw * 0.88);
    }

    // Hips + legs
    for (const side of ['L','R']) {
      this._scale(`hip_${side}`,   hw, 1, hw);
      this._scale(`thigh_${side}`, lw, 1, lw);
      this._scale(`knee_${side}`,  lw * 0.92, 1, lw * 0.92);
      this._scale(`shin_${side}`,  lw * 0.88, 1, lw * 0.88);
      this._scale(`ankle_${side}`, lw * 0.82, 1, lw * 0.82);
      this._scale(`foot_${side}`,  lw * 0.94, 1, 1);
    }

    // Neck
    const nw = g.neckW;
    this._scale('neck', nw, 1, nw);

    // Head
    this._scale('head', s.headS, s.headS, s.headS);
  }

  _scale(name, x, y, z) {
    const p = this.parts[name];
    if (p) p.scale.set(x, y, z);
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  setSkinTone(hex) {
    this._skinHex = hex;
    const skinParts = [
      'head','neck',
      'shoulder_L','shoulder_R',
      'upperArm_L','upperArm_R','elbow_L','elbow_R',
      'lowerArm_L','lowerArm_R','wrist_L','wrist_R',
      'hand_L','hand_R',
      'ankle_L','ankle_R','foot_L','foot_R',
    ];
    skinParts.forEach(n => {
      const p = this.parts[n];
      if (p && p.material) p.material.color.set(hex);
    });
  }

  setBodyShape(shape) {
    this._currentShape = shape;
    this._applyShapeAndMuscle();
  }

  setMuscleTone(v) {
    this._muscleTone = v;
    this._applyShapeAndMuscle();
  }

  setGender(g) {
    this._gender = g;
    this._applyShapeAndMuscle();
  }

  setHeight(metres) {
    const scale = metres / 1.75;
    this.group.scale.setScalar(scale);
  }

  setClothingColor(slot, hex) {
    const map = {
      top:    ['chest','waist'],
      bottom: ['waist','hip_L','hip_R','thigh_L','thigh_R','knee_L','knee_R','shin_L','shin_R'],
    };
    (map[slot] || []).forEach(n => {
      const p = this.parts[n];
      if (p && p.material) p.material.color.set(hex);
    });
  }

  // Attachment anchor points for accessories
  getAttachPoint(slot) {
    const pts = {
      hair:       new THREE.Vector3(0,  1.96, 0),
      hat:        new THREE.Vector3(0,  1.98, 0),
      glasses:    new THREE.Vector3(0,  1.755, 0.21),
      sunglasses: new THREE.Vector3(0,  1.755, 0.21),
      earringL:   new THREE.Vector3(-0.215, 1.72, 0),
      earringR:   new THREE.Vector3( 0.215, 1.72, 0),
      necklace:   new THREE.Vector3(0,  1.56, 0.09),
      braceletL:  new THREE.Vector3(-0.336, 0.61, 0),
      braceletR:  new THREE.Vector3( 0.336, 0.61, 0),
      ring:       new THREE.Vector3( 0.350, 0.555, 0),
      shirt:      new THREE.Vector3(0,  1.26, 0),
      jacket:     new THREE.Vector3(0,  1.26, 0),
      pants:      new THREE.Vector3(0,  0.76, 0),
      shoes:      new THREE.Vector3(0,  0.029, 0.042),
      sneakers:   new THREE.Vector3(0,  0.029, 0.042),
      boots:      new THREE.Vector3(0,  0.029, 0.042),
    };
    return pts[slot] || new THREE.Vector3(0, 1.0, 0);
  }

  // Idle breathing animation
  update() {
    const t = performance.now() * 0.001;
    const chest = this.parts.chest;
    if (chest) {
      const s = SHAPES[this._currentShape] || SHAPES.average;
      const g = GENDER_MORPHS[this._gender] || GENDER_MORPHS.neutral;
      const base = s.torsoD * g.torsoW;
      chest.scale.z = base * (1 + Math.sin(t * 0.85) * 0.009);
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
