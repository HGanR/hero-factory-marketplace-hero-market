/**
 * ChibiCreature3D.js — Cute chibi creature avatar
 *
 * Matches the reference style:
 * - Oversized round head (60% of total height)
 * - Giant glossy eyes with sclera, iris, pupil, catchlight, eyelashes
 * - Small rounded ears on top of head
 * - Pudgy round belly / body
 * - Stubby arms with 3-fingered hands
 * - Short stubby legs with rounded feet
 * - Buck teeth (2 prominent front teeth)
 * - Optional tail
 * - Thick dark eyebrows
 * - Belly button detail
 *
 * All geometry uses MeshToonMaterial + MeshPhysicalMaterial for glossy eyes.
 */

import * as THREE from 'three';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({ color: new THREE.Color(color), ...opts });
}

function phys(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: 0.0,
    metalness: 0.0,
    transmission: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    ...opts,
  });
}

function sphere(rx, ry, rz, ws = 32, hs = 24) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  g.scale(rx, ry, rz);
  return g;
}

function place(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function capsule(r, len, cap = 8, rad = 16) {
  return new THREE.CapsuleGeometry(r, len, cap, rad);
}

// ─── Chibi proportions ────────────────────────────────────────────────────────

const C = {
  headR:    0.200,   // head radius (large — chibi proportions)
  bodyR:    0.145,   // body/belly radius
  bodyH:    0.160,   // body height
  armR:     0.048,   // upper arm radius
  armLen:   0.130,   // upper arm length
  legR:     0.058,   // leg radius
  legLen:   0.100,   // leg length
  earR:     0.042,   // ear radius
  eyeR:     0.068,   // eye outer radius (giant!)
  toothW:   0.022,   // tooth width
  toothH:   0.028,   // tooth height
};

// ─── ChibiCreature3D ──────────────────────────────────────────────────────────

export class ChibiCreature3D {
  constructor(bodyHex = '#e85a10') {
    this.group = new THREE.Group();
    this.parts = {};
    this._bodyHex = bodyHex;
    this._eyeHex = '#111111';
    this._earStyle = 'round';
    this._hasHat = false;
    this._hasTail = true;
    this._build(bodyHex);
  }

  _build(col) {
    this._buildBody(col);
    this._buildHead(col);
    this._buildArms(col);
    this._buildLegs(col);
    if (this._hasTail) this._buildTail(col);
  }

  // ── Body / Belly ────────────────────────────────────────────────────────────
  _buildBody(col) {
    const C_loc = C;

    // Main round belly — slightly squashed sphere
    const bodyGeo = sphere(C_loc.bodyR, C_loc.bodyR * 0.95, C_loc.bodyR * 0.88, 36, 28);
    const body = place(bodyGeo, toon(col, { roughness: 0.75 }), 0, 0, 0);
    body.name = 'body';
    this.group.add(body);
    this.parts.body = body;

    // Belly highlight — lighter patch on front belly
    const bellyGeo = sphere(C_loc.bodyR * 0.68, C_loc.bodyR * 0.60, C_loc.bodyR * 0.22, 28, 22);
    const bellyLight = new THREE.Color(col).lerp(new THREE.Color('#ffffff'), 0.28);
    const belly = place(bellyGeo, toon('#' + bellyLight.getHexString(), { roughness: 0.8 }),
      0, -C_loc.bodyR * 0.05, C_loc.bodyR * 0.80);
    belly.name = 'bellyPatch';
    this.group.add(belly);
    this.parts.bellyPatch = belly;

    // Belly button — tiny indent sphere
    const bbGeo = sphere(0.010, 0.010, 0.006, 12, 8);
    const bbDark = new THREE.Color(col).lerp(new THREE.Color('#000000'), 0.35);
    const bb = place(bbGeo, toon('#' + bbDark.getHexString()),
      0, -C_loc.bodyR * 0.12, C_loc.bodyR * 0.88);
    bb.name = 'bellyButton';
    this.group.add(bb);
    this.parts.bellyButton = bb;
  }

  // ── Head ────────────────────────────────────────────────────────────────────
  _buildHead(col) {
    const headY = C.bodyR * 0.72 + C.headR * 0.88;

    // Main head — large round sphere, slightly taller
    const headGeo = sphere(C.headR, C.headR * 1.05, C.headR * 0.96, 40, 32);
    const head = place(headGeo, toon(col, { roughness: 0.72 }), 0, headY, 0);
    head.name = 'head';
    this.group.add(head);
    this.parts.head = head;
    this._headY = headY;

    // Cheek blush — soft pink spheres
    const blushCol = new THREE.Color(col).lerp(new THREE.Color('#ff8888'), 0.45);
    for (const sx of [-1, 1]) {
      const blushGeo = sphere(0.040, 0.022, 0.010, 18, 12);
      const blush = place(blushGeo, toon('#' + blushCol.getHexString(), { transparent: true, opacity: 0.55 }),
        sx * C.headR * 0.62, headY - C.headR * 0.08, C.headR * 0.82);
      blush.name = `blush_${sx > 0 ? 'R' : 'L'}`;
      this.group.add(blush);
      this.parts[`blush_${sx > 0 ? 'R' : 'L'}`] = blush;
    }

    // Ears
    this._buildEars(col, headY);

    // Eyes
    this._buildEyes(headY);

    // Eyebrows
    this._buildEyebrows(col, headY);

    // Nose
    this._buildNose(col, headY);

    // Mouth + teeth
    this._buildMouth(col, headY);
  }

  // ── Ears ────────────────────────────────────────────────────────────────────
  _buildEars(col, headY) {
    const innerCol = new THREE.Color(col).lerp(new THREE.Color('#ff9966'), 0.5);

    for (const sx of [-1, 1]) {
      const side = sx > 0 ? 'R' : 'L';

      if (this._earStyle === 'round') {
        // Round bear-like ears
        const earGeo = sphere(C.earR, C.earR * 0.95, C.earR * 0.72, 22, 18);
        const ear = place(earGeo, toon(col, { roughness: 0.72 }),
          sx * C.headR * 0.72, headY + C.headR * 0.72, -C.headR * 0.12);
        ear.name = `ear_${side}`;
        this.group.add(ear);
        this.parts[`ear_${side}`] = ear;

        // Inner ear
        const innerGeo = sphere(C.earR * 0.58, C.earR * 0.52, C.earR * 0.22, 18, 14);
        const innerEar = place(innerGeo, toon('#' + innerCol.getHexString()),
          sx * C.headR * 0.72, headY + C.headR * 0.72, -C.headR * 0.06);
        innerEar.name = `earInner_${side}`;
        this.group.add(innerEar);
        this.parts[`earInner_${side}`] = innerEar;

      } else if (this._earStyle === 'pointy') {
        // Pointy elf-like ears
        const earGeo = new THREE.ConeGeometry(C.earR * 0.72, C.earR * 1.6, 12);
        const ear = place(earGeo, toon(col, { roughness: 0.72 }),
          sx * C.headR * 0.75, headY + C.headR * 0.78, -C.headR * 0.08,
          0, 0, sx * 0.25);
        ear.name = `ear_${side}`;
        this.group.add(ear);
        this.parts[`ear_${side}`] = ear;

      } else if (this._earStyle === 'floppy') {
        // Floppy dog-like ears hanging down
        const earGeo = sphere(C.earR * 0.75, C.earR * 1.4, C.earR * 0.45, 20, 16);
        const ear = place(earGeo, toon(col, { roughness: 0.72 }),
          sx * C.headR * 0.85, headY - C.headR * 0.15, -C.headR * 0.18,
          0, 0, sx * 0.6);
        ear.name = `ear_${side}`;
        this.group.add(ear);
        this.parts[`ear_${side}`] = ear;

      } else if (this._earStyle === 'cat') {
        // Cat triangle ears
        const earGeo = new THREE.ConeGeometry(C.earR * 0.65, C.earR * 1.4, 3);
        const ear = place(earGeo, toon(col, { roughness: 0.72 }),
          sx * C.headR * 0.68, headY + C.headR * 0.80, -C.headR * 0.08,
          0, sx * 0.15, sx * 0.12);
        ear.name = `ear_${side}`;
        this.group.add(ear);
        this.parts[`ear_${side}`] = ear;

        // Inner cat ear
        const innerGeo = new THREE.ConeGeometry(C.earR * 0.38, C.earR * 0.90, 3);
        const innerEar = place(innerGeo, toon('#' + innerCol.getHexString()),
          sx * C.headR * 0.68, headY + C.headR * 0.80, -C.headR * 0.04,
          0, sx * 0.15, sx * 0.12);
        innerEar.name = `earInner_${side}`;
        this.group.add(innerEar);
        this.parts[`earInner_${side}`] = innerEar;
      }
    }
  }

  // ── Eyes ────────────────────────────────────────────────────────────────────
  _buildEyes(headY) {
    for (const sx of [-1, 1]) {
      const side = sx > 0 ? 'R' : 'L';
      const ex = sx * C.headR * 0.38;
      const ey = headY + C.headR * 0.08;
      const ez = C.headR * 0.82;

      // White sclera — large rounded
      const scleraGeo = sphere(C.eyeR, C.eyeR * 0.95, C.eyeR * 0.55, 28, 22);
      const sclera = place(scleraGeo, toon('#ffffff', { roughness: 0.2 }), ex, ey, ez);
      sclera.name = `sclera_${side}`;
      this.group.add(sclera);
      this.parts[`sclera_${side}`] = sclera;

      // Iris — large dark glossy sphere (chibi style = almost all pupil)
      const irisGeo = sphere(C.eyeR * 0.78, C.eyeR * 0.78, C.eyeR * 0.38, 24, 18);
      const iris = place(irisGeo, phys(this._eyeHex, { roughness: 0.0, clearcoat: 1.0 }),
        ex, ey, ez + C.eyeR * 0.18);
      iris.name = `iris_${side}`;
      this.group.add(iris);
      this.parts[`iris_${side}`] = iris;

      // Pupil — deep black center
      const pupilGeo = sphere(C.eyeR * 0.48, C.eyeR * 0.48, C.eyeR * 0.22, 18, 14);
      const pupil = place(pupilGeo, phys('#050505', { roughness: 0.0 }),
        ex, ey, ez + C.eyeR * 0.28);
      pupil.name = `pupil_${side}`;
      this.group.add(pupil);
      this.parts[`pupil_${side}`] = pupil;

      // Catchlight 1 — large bright highlight
      const cl1Geo = sphere(C.eyeR * 0.22, C.eyeR * 0.22, C.eyeR * 0.10, 12, 10);
      const cl1 = place(cl1Geo, toon('#ffffff', { roughness: 0.0 }),
        ex + C.eyeR * 0.22, ey + C.eyeR * 0.26, ez + C.eyeR * 0.34);
      cl1.name = `catchlight1_${side}`;
      this.group.add(cl1);

      // Catchlight 2 — small secondary
      const cl2Geo = sphere(C.eyeR * 0.10, C.eyeR * 0.10, C.eyeR * 0.06, 10, 8);
      const cl2 = place(cl2Geo, toon('#ffffff', { roughness: 0.0 }),
        ex - C.eyeR * 0.18, ey - C.eyeR * 0.18, ez + C.eyeR * 0.34);
      cl2.name = `catchlight2_${side}`;
      this.group.add(cl2);

      // Lower eyelid — subtle curve
      const lidGeo = sphere(C.eyeR * 0.85, C.eyeR * 0.18, C.eyeR * 0.14, 20, 8);
      const lidDark = '#222222';
      const lid = place(lidGeo, toon(lidDark, { roughness: 0.5 }),
        ex, ey - C.eyeR * 0.72, ez + C.eyeR * 0.10);
      lid.name = `lid_${side}`;
      this.group.add(lid);
      this.parts[`lid_${side}`] = lid;

      // Upper eyelash — thick curved bar
      const lashGeo = sphere(C.eyeR * 0.92, C.eyeR * 0.14, C.eyeR * 0.10, 20, 8);
      const lash = place(lashGeo, toon('#111111', { roughness: 0.4 }),
        ex, ey + C.eyeR * 0.76, ez + C.eyeR * 0.08);
      lash.name = `lash_${side}`;
      this.group.add(lash);
      this.parts[`lash_${side}`] = lash;
    }
  }

  // ── Eyebrows ────────────────────────────────────────────────────────────────
  _buildEyebrows(col, headY) {
    for (const sx of [-1, 1]) {
      const side = sx > 0 ? 'R' : 'L';
      const bx = sx * C.headR * 0.38;
      const by = headY + C.headR * 0.38;
      const bz = C.headR * 0.78;

      // Thick rounded eyebrow bar
      const browGeo = new THREE.CapsuleGeometry(0.016, C.eyeR * 1.2, 6, 12);
      const brow = place(browGeo, toon('#1a1a1a', { roughness: 0.5 }),
        bx, by, bz, 0, 0, sx * 0.18);
      brow.name = `brow_${side}`;
      this.group.add(brow);
      this.parts[`brow_${side}`] = brow;
    }
  }

  // ── Nose ────────────────────────────────────────────────────────────────────
  _buildNose(col, headY) {
    const noseDark = new THREE.Color(col).lerp(new THREE.Color('#000000'), 0.45);
    // Small button nose
    const noseGeo = sphere(0.022, 0.016, 0.014, 14, 10);
    const nose = place(noseGeo, toon('#' + noseDark.getHexString()),
      0, headY - C.headR * 0.08, C.headR * 0.94);
    nose.name = 'nose';
    this.group.add(nose);
    this.parts.nose = nose;

    // Nostrils
    for (const sx of [-1, 1]) {
      const nostrilGeo = sphere(0.008, 0.006, 0.004, 10, 8);
      const nostril = place(nostrilGeo, toon('#111111'),
        sx * 0.014, headY - C.headR * 0.10, C.headR * 0.95);
      this.group.add(nostril);
    }
  }

  // ── Mouth + Buck Teeth ──────────────────────────────────────────────────────
  _buildMouth(col, headY) {
    const mouthDark = new THREE.Color(col).lerp(new THREE.Color('#000000'), 0.55);

    // Mouth opening — wide flat ellipse
    const mouthGeo = sphere(0.062, 0.028, 0.018, 20, 12);
    const mouth = place(mouthGeo, toon('#' + mouthDark.getHexString()),
      0, headY - C.headR * 0.30, C.headR * 0.88);
    mouth.name = 'mouth';
    this.group.add(mouth);
    this.parts.mouth = mouth;

    // Inner mouth darkness
    const innerGeo = sphere(0.048, 0.020, 0.012, 16, 10);
    const inner = place(innerGeo, toon('#0a0a0a'),
      0, headY - C.headR * 0.30, C.headR * 0.89);
    this.group.add(inner);

    // Buck teeth — 2 prominent front teeth
    for (let i = 0; i < 2; i++) {
      const tx = (i === 0 ? -1 : 1) * C.toothW * 0.62;
      const toothGeo = new THREE.BoxGeometry(C.toothW, C.toothH, 0.014);
      // Round the tooth slightly
      const tooth = place(toothGeo, toon('#f8f8f0', { roughness: 0.3 }),
        tx, headY - C.headR * 0.26, C.headR * 0.90);
      tooth.name = `tooth_${i}`;
      this.group.add(tooth);
      this.parts[`tooth_${i}`] = tooth;

      // Tooth groove
      const grooveGeo = new THREE.BoxGeometry(0.002, C.toothH * 0.8, 0.016);
      const groove = place(grooveGeo, toon('#cccccc'),
        tx + C.toothW * 0.5, headY - C.headR * 0.26, C.headR * 0.905);
      this.group.add(groove);
    }

    // Lower lip
    const lipGeo = sphere(0.055, 0.014, 0.010, 18, 10);
    const lipCol = new THREE.Color(col).lerp(new THREE.Color('#cc4400'), 0.4);
    const lip = place(lipGeo, toon('#' + lipCol.getHexString()),
      0, headY - C.headR * 0.36, C.headR * 0.88);
    lip.name = 'lowerLip';
    this.group.add(lip);
    this.parts.lowerLip = lip;
  }

  // ── Arms ────────────────────────────────────────────────────────────────────
  _buildArms(col) {
    for (const sx of [-1, 1]) {
      const side = sx > 0 ? 'R' : 'L';
      const armX = sx * (C.bodyR * 0.88 + C.armR * 0.6);
      const armY = C.bodyR * 0.25;

      // Shoulder blob
      const shoulderGeo = sphere(C.armR * 1.15, C.armR * 1.10, C.armR * 1.05, 20, 16);
      const shoulder = place(shoulderGeo, toon(col, { roughness: 0.72 }),
        sx * C.bodyR * 0.88, armY, 0);
      shoulder.name = `shoulder_${side}`;
      this.group.add(shoulder);
      this.parts[`shoulder_${side}`] = shoulder;

      // Upper arm — stubby capsule
      const uArmGeo = capsule(C.armR, C.armLen * 0.55, 8, 14);
      const uArm = place(uArmGeo, toon(col, { roughness: 0.72 }),
        armX, armY - C.armLen * 0.18, 0, 0, 0, sx * 0.35);
      uArm.name = `upperArm_${side}`;
      this.group.add(uArm);
      this.parts[`upperArm_${side}`] = uArm;

      // Lower arm / hand blob
      const handX = armX + sx * C.armLen * 0.55;
      const handY = armY - C.armLen * 0.55;
      const handGeo = sphere(C.armR * 1.10, C.armR * 0.95, C.armR * 0.90, 20, 16);
      const hand = place(handGeo, toon(col, { roughness: 0.72 }), handX, handY, 0);
      hand.name = `hand_${side}`;
      this.group.add(hand);
      this.parts[`hand_${side}`] = hand;

      // 3 stubby fingers
      const fingerAngles = [-0.35, 0, 0.35];
      fingerAngles.forEach((angle, fi) => {
        const fGeo = capsule(0.014, 0.028, 4, 8);
        const fx = handX + Math.sin(angle) * 0.038 * sx;
        const fy = handY - 0.032;
        const fz = Math.cos(angle) * 0.018;
        const finger = place(fGeo, toon(col, { roughness: 0.72 }), fx, fy, fz);
        finger.name = `finger_${side}_${fi}`;
        this.group.add(finger);
      });
    }
  }

  // ── Legs ────────────────────────────────────────────────────────────────────
  _buildLegs(col) {
    for (const sx of [-1, 1]) {
      const side = sx > 0 ? 'R' : 'L';
      const lx = sx * C.bodyR * 0.52;
      const legTopY = -C.bodyR * 0.72;

      // Hip blob
      const hipGeo = sphere(C.legR * 1.12, C.legR * 1.08, C.legR * 1.05, 20, 16);
      const hip = place(hipGeo, toon(col, { roughness: 0.72 }), lx, legTopY, 0);
      hip.name = `hip_${side}`;
      this.group.add(hip);
      this.parts[`hip_${side}`] = hip;

      // Leg — short stubby capsule
      const legGeo = capsule(C.legR, C.legLen * 0.60, 8, 14);
      const leg = place(legGeo, toon(col, { roughness: 0.72 }),
        lx, legTopY - C.legLen * 0.45, 0);
      leg.name = `leg_${side}`;
      this.group.add(leg);
      this.parts[`leg_${side}`] = leg;

      // Foot — rounded blob
      const footGeo = sphere(C.legR * 1.20, C.legR * 0.72, C.legR * 1.55, 22, 16);
      const foot = place(footGeo, toon(col, { roughness: 0.72 }),
        lx, legTopY - C.legLen * 0.88, C.legR * 0.28);
      foot.name = `foot_${side}`;
      this.group.add(foot);
      this.parts[`foot_${side}`] = foot;

      // Toe blobs — 3 toes
      for (let ti = 0; ti < 3; ti++) {
        const tx = lx + (ti - 1) * 0.022;
        const toeGeo = sphere(0.018, 0.014, 0.016, 12, 10);
        const toe = place(toeGeo, toon(col, { roughness: 0.72 }),
          tx, legTopY - C.legLen * 0.92, C.legR * 0.80);
        toe.name = `toe_${side}_${ti}`;
        this.group.add(toe);
      }
    }
  }

  // ── Tail ────────────────────────────────────────────────────────────────────
  _buildTail(col) {
    // Curved tail using TubeGeometry
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -C.bodyR * 0.30, -C.bodyR * 0.82),
      new THREE.Vector3(0, -C.bodyR * 0.10, -C.bodyR * 1.10),
      new THREE.Vector3(0,  C.bodyR * 0.20, -C.bodyR * 1.20),
      new THREE.Vector3(0,  C.bodyR * 0.45, -C.bodyR * 1.05),
    ]);
    const tailGeo = new THREE.TubeGeometry(tailCurve, 12, 0.028, 10, false);
    const tail = new THREE.Mesh(tailGeo, toon(col, { roughness: 0.72 }));
    tail.name = 'tail';
    tail.castShadow = true;
    this.group.add(tail);
    this.parts.tail = tail;

    // Tail tip — slightly lighter ball
    const tipCol = new THREE.Color(col).lerp(new THREE.Color('#ffffff'), 0.25);
    const tipGeo = sphere(0.038, 0.038, 0.038, 16, 12);
    const tip = place(tipGeo, toon('#' + tipCol.getHexString()),
      0, C.bodyR * 0.45, -C.bodyR * 1.05);
    tip.name = 'tailTip';
    this.group.add(tip);
    this.parts.tailTip = tip;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  setBodyColor(hex) {
    this._bodyHex = hex;
    this._rebuildColor(hex);
  }

  _rebuildColor(hex) {
    const col = new THREE.Color(hex);
    const bellyLight = new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), 0.28);
    const bbDark = new THREE.Color(hex).lerp(new THREE.Color('#000000'), 0.35);
    const noseDark = new THREE.Color(hex).lerp(new THREE.Color('#000000'), 0.45);
    const lipCol = new THREE.Color(hex).lerp(new THREE.Color('#cc4400'), 0.4);
    const blushCol = new THREE.Color(hex).lerp(new THREE.Color('#ff8888'), 0.45);
    const tipCol = new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), 0.25);

    const colorMap = {
      body:        hex,
      bellyPatch:  '#' + bellyLight.getHexString(),
      bellyButton: '#' + bbDark.getHexString(),
      head:        hex,
      ear_R:       hex, ear_L:       hex,
      earInner_R:  '#' + new THREE.Color(hex).lerp(new THREE.Color('#ff9966'), 0.5).getHexString(),
      earInner_L:  '#' + new THREE.Color(hex).lerp(new THREE.Color('#ff9966'), 0.5).getHexString(),
      blush_R:     '#' + blushCol.getHexString(),
      blush_L:     '#' + blushCol.getHexString(),
      nose:        '#' + noseDark.getHexString(),
      lowerLip:    '#' + lipCol.getHexString(),
      shoulder_R:  hex, shoulder_L:  hex,
      upperArm_R:  hex, upperArm_L:  hex,
      hand_R:      hex, hand_L:      hex,
      hip_R:       hex, hip_L:       hex,
      leg_R:       hex, leg_L:       hex,
      foot_R:      hex, foot_L:      hex,
      tail:        hex,
      tailTip:     '#' + tipCol.getHexString(),
    };

    for (const [name, color] of Object.entries(colorMap)) {
      if (this.parts[name]?.material) {
        this.parts[name].material.color.set(color);
      }
    }

    // Update finger/toe colors by traversing
    this.group.traverse(obj => {
      if (obj.isMesh && (obj.name.startsWith('finger_') || obj.name.startsWith('toe_'))) {
        obj.material.color.set(hex);
      }
    });
  }

  setEyeColor(hex) {
    this._eyeHex = hex;
    for (const side of ['R', 'L']) {
      if (this.parts[`iris_${side}`]?.material) {
        this.parts[`iris_${side}`].material.color.set(hex);
      }
    }
  }

  setEarStyle(style) {
    // Remove existing ears
    const earParts = ['ear_R', 'ear_L', 'earInner_R', 'earInner_L'];
    earParts.forEach(name => {
      if (this.parts[name]) {
        this.group.remove(this.parts[name]);
        this.parts[name].geometry?.dispose();
        this.parts[name].material?.dispose();
        delete this.parts[name];
      }
    });
    this._earStyle = style;
    this._buildEars(this._bodyHex, this._headY);
  }

  setHasTail(v) {
    if (this.parts.tail) {
      this.group.remove(this.parts.tail);
      this.parts.tail.geometry?.dispose();
      this.parts.tail.material?.dispose();
      delete this.parts.tail;
    }
    if (this.parts.tailTip) {
      this.group.remove(this.parts.tailTip);
      this.parts.tailTip.geometry?.dispose();
      this.parts.tailTip.material?.dispose();
      delete this.parts.tailTip;
    }
    this._hasTail = v;
    if (v) this._buildTail(this._bodyHex);
  }

  setChubby(v) {
    this._chubby = v;
    const s = 0.7 + v * 0.6;
    if (this.parts.body) this.parts.body.scale.set(s, 1, s);
    if (this.parts.bellyPatch) this.parts.bellyPatch.scale.set(s * 1.05, 1, s * 1.05);
    if (this.parts.bellyButton) this.parts.bellyButton.scale.set(s, 1, s);
  }

  setShowBelly(v) {
    this._showBelly = v;
    if (this.parts.bellyButton) this.parts.bellyButton.visible = v;
    if (this.parts.bellyPatch)  this.parts.bellyPatch.visible  = v;
  }

  /** Returns attach points for accessories (hats, glasses) */
  getAttachPoint(slot) {
    const hy = this._headY;
    const map = {
      hat:      new THREE.Vector3(0, hy + C.headR * 0.95, 0),
      glasses:  new THREE.Vector3(0, hy + C.headR * 0.10, C.headR * 0.92),
      necklace: new THREE.Vector3(0, C.bodyR * 0.55, C.bodyR * 0.72),
    };
    return map[slot] || new THREE.Vector3(0, 0, 0);
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

export { C as CHIBI_PROPORTIONS };
