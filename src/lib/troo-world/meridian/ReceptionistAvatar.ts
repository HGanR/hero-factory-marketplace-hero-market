/**
 * ReceptionistAvatar.ts
 * High-poly realistic receptionist avatars using procedural Three.js geometry.
 * Two receptionists: one female (Maya), one male (Alex).
 * Features: detailed head with facial features, professional attire,
 * smooth idle/typing/greeting animations.
 */

import * as THREE from 'three';

export interface AvatarDef {
  id: string;
  name: string;
  role: string;
  x: number;
  z: number;
  facingAngle: number;
  skinTone: number;
  hairColor: number;
  outfitColor: number;
  outfitAccent: number;
  isFemale: boolean;
}

export interface AvatarMesh {
  def: AvatarDef;
  group: THREE.Group;
  // Body parts for animation
  head: THREE.Group;
  neck: THREE.Mesh;
  torso: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Mesh;
  rightForearm: THREE.Mesh;
  leftHand: THREE.Mesh;
  rightHand: THREE.Mesh;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  // Animation state
  phaseOffset: number;
  animState: 'idle' | 'type' | 'greet' | 'talk';
  animTimer: number;
}

// ─── Avatar Definitions ───────────────────────────────────────────────────────
const C_METAL = 0x8a8a9a;

export const RECEPTIONIST_DEFS: AvatarDef[] = [
  {
    id: 'maya',
    name: 'Maya Chen',
    role: 'Senior Receptionist',
    x: -2.2,
    z: -1.5,
    facingAngle: 0,
    skinTone: 0xd4956a,
    hairColor: 0x1a0a00,
    outfitColor: 0x1a2a4a,
    outfitAccent: 0xffffff,
    isFemale: true,
  },
  {
    id: 'alex',
    name: 'Alex Rivera',
    role: 'Front Desk Associate',
    x: 0.5,
    z: -1.5,
    facingAngle: 0,
    skinTone: 0xc8855a,
    hairColor: 0x2a1a0a,
    outfitColor: 0x2a2a3a,
    outfitAccent: 0x4a6a9a,
    isFemale: false,
  },
];

// ─── Material cache ───────────────────────────────────────────────────────────
function mStd(color: number, rough = 0.6, metal = 0, opacity = 1, transparent = false): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, opacity, transparent });
}

// ─── Build Avatar ─────────────────────────────────────────────────────────────
export function buildAvatar(def: AvatarDef, floorY: number): AvatarMesh {
  const group = new THREE.Group();
  group.name = `avatar_${def.id}`;

  const skin = mStd(def.skinTone, 0.7, 0);
  const hair = mStd(def.hairColor, 0.8, 0);
  const outfit = mStd(def.outfitColor, 0.6, 0.05);
  const outfitAccent = mStd(def.outfitAccent, 0.5, 0.05);
  const white = mStd(0xf8f8f8, 0.7, 0);
  const darkGrey = mStd(0x2a2a2a, 0.8, 0.1);
  const lipColor = mStd(def.isFemale ? 0xcc5566 : 0xb06050, 0.7, 0);
  const eyeWhite = mStd(0xfafafa, 0.8, 0);
  const eyeIris = mStd(def.isFemale ? 0x3a5a8a : 0x4a6a3a, 0.5, 0);
  const eyePupil = mStd(0x050505, 0.9, 0);
  const browMat = mStd(def.hairColor, 0.8, 0);
  const teethMat = mStd(0xf5f5f0, 0.5, 0);

  // ── Legs ──
  const leftLegGrp = new THREE.Group();
  const rightLegGrp = new THREE.Group();

  const thighGeo = new THREE.CylinderGeometry(0.095, 0.085, 0.52, 12);
  const shinGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.48, 12);
  const footGeo = new THREE.BoxGeometry(0.13, 0.08, 0.28);

  const trouserMat = mStd(def.isFemale ? 0x1a1a2a : 0x1a1a1a, 0.7, 0.05);
  const shoeMat = mStd(0x111111, 0.4, 0.3);

  for (const [grp, side] of [[leftLegGrp, -1], [rightLegGrp, 1]] as [THREE.Group, number][]) {
    const thigh = new THREE.Mesh(thighGeo, trouserMat);
    thigh.position.set(0, -0.26, 0);
    grp.add(thigh);

    const shin = new THREE.Mesh(shinGeo, trouserMat);
    shin.position.set(0, -0.76, 0);
    grp.add(shin);

    const foot = new THREE.Mesh(footGeo, shoeMat);
    foot.position.set(0, -1.04, 0.07);
    grp.add(foot);

    grp.position.set(side * 0.12, 0, 0);
    group.add(grp);
  }

  // ── Torso ──
  const torsoGrp = new THREE.Group();

  // Shirt/jacket body
  const torsoGeo = new THREE.CylinderGeometry(
    def.isFemale ? 0.155 : 0.17,
    def.isFemale ? 0.14 : 0.155,
    0.58, 14
  );
  const torsoMesh = new THREE.Mesh(torsoGeo, outfit);
  torsoMesh.position.set(0, 0.29, 0);
  torsoGrp.add(torsoMesh);

  // Shirt collar/lapels
  if (!def.isFemale) {
    // Tie
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.04), mStd(def.outfitAccent, 0.5, 0));
    tie.position.set(0, 0.35, 0.16);
    torsoGrp.add(tie);
    const tieKnot = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.05), mStd(def.outfitAccent, 0.5, 0));
    tieKnot.position.set(0, 0.55, 0.16);
    torsoGrp.add(tieKnot);
  } else {
    // Blouse accent
    const blouse = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.04), outfitAccent);
    blouse.position.set(0, 0.38, 0.155);
    torsoGrp.add(blouse);
  }

  // Collar
  const collarGeo = new THREE.TorusGeometry(0.1, 0.025, 8, 16, Math.PI);
  const collar = new THREE.Mesh(collarGeo, white);
  collar.rotation.x = -Math.PI / 2;
  collar.position.set(0, 0.58, 0.04);
  torsoGrp.add(collar);

  // Jacket lapels
  const lapelL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.04), outfit);
  lapelL.position.set(-0.08, 0.48, 0.155);
  lapelL.rotation.z = 0.25;
  torsoGrp.add(lapelL);
  const lapelR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.04), outfit);
  lapelR.position.set(0.08, 0.48, 0.155);
  lapelR.rotation.z = -0.25;
  torsoGrp.add(lapelR);

  // Pocket square (female only)
  if (def.isFemale) {
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.03), mStd(0xff8888, 0.5, 0));
    pocket.position.set(-0.13, 0.48, 0.155);
    torsoGrp.add(pocket);
  }

  torsoGrp.position.set(0, 1.0, 0);
  group.add(torsoGrp);

  // ── Arms ──
  const leftArmGrp = new THREE.Group();
  const rightArmGrp = new THREE.Group();

  const upperArmGeo = new THREE.CylinderGeometry(0.07, 0.065, 0.32, 10);
  const forearmGeo = new THREE.CylinderGeometry(0.06, 0.055, 0.3, 10);
  const handGeo = new THREE.SphereGeometry(0.065, 10, 8);

  for (const [grp, side] of [[leftArmGrp, -1], [rightArmGrp, 1]] as [THREE.Group, number][]) {
    const upperArm = new THREE.Mesh(upperArmGeo, outfit);
    upperArm.position.set(0, -0.16, 0);
    grp.add(upperArm);

    const forearm = new THREE.Mesh(forearmGeo, skin);
    forearm.position.set(0, -0.47, 0);
    grp.add(forearm);

    const hand = new THREE.Mesh(handGeo, skin);
    hand.scale.set(1, 0.75, 0.85);
    hand.position.set(0, -0.65, 0);
    grp.add(hand);

    // Fingers (simplified)
    for (let fi = 0; fi < 4; fi++) {
      const angle = (fi - 1.5) * 0.18;
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 0.07, 6), skin);
      finger.position.set(Math.sin(angle) * 0.045, -0.72, Math.cos(angle) * 0.02 + 0.04);
      finger.rotation.x = 0.3;
      grp.add(finger);
    }
    // Thumb
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.012, 0.06, 6), skin);
    thumb.position.set(side * 0.065, -0.66, 0.03);
    thumb.rotation.z = side * 0.6;
    grp.add(thumb);

    grp.position.set(side * (def.isFemale ? 0.2 : 0.22), 1.48, 0);
    group.add(grp);
  }

  // ── Neck ──
  const neckGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.18, 12);
  const neck = new THREE.Mesh(neckGeo, skin);
  neck.position.set(0, 1.65, 0);
  group.add(neck);

  // ── Head ──
  const headGrp = new THREE.Group();

  // Skull — slightly elongated sphere
  const skullGeo = new THREE.SphereGeometry(0.175, 20, 18);
  const skull = new THREE.Mesh(skullGeo, skin);
  skull.scale.set(1, 1.08, 0.96);
  headGrp.add(skull);

  // Jaw/chin — lower face widening
  const jawGeo = new THREE.SphereGeometry(0.14, 16, 12);
  const jaw = new THREE.Mesh(jawGeo, skin);
  jaw.scale.set(1, 0.65, 0.9);
  jaw.position.set(0, -0.1, 0.04);
  headGrp.add(jaw);

  // ── Eyes ──
  for (const [ex, side] of [[0.072, -1], [-0.072, 1]] as [number, number][]) {
    // Eye socket (slight indent)
    const socket = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), skin);
    socket.scale.set(1.1, 0.9, 0.5);
    socket.position.set(ex, 0.04, 0.155);
    headGrp.add(socket);

    // Eyeball white
    const eyeball = new THREE.Mesh(new THREE.SphereGeometry(0.033, 10, 8), eyeWhite);
    eyeball.position.set(ex, 0.04, 0.158);
    headGrp.add(eyeball);

    // Iris
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.018, 12), eyeIris);
    iris.position.set(ex, 0.04, 0.191);
    headGrp.add(iris);

    // Pupil
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.009, 10), eyePupil);
    pupil.position.set(ex, 0.04, 0.192);
    headGrp.add(pupil);

    // Eyelid top
    const eyelid = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), skin);
    eyelid.position.set(ex, 0.055, 0.158);
    headGrp.add(eyelid);

    // Eyebrow
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.012, 0.015), browMat);
    brow.position.set(ex, 0.1, 0.155);
    brow.rotation.z = side * 0.08;
    headGrp.add(brow);
  }

  // ── Nose ──
  const noseGeo = new THREE.SphereGeometry(0.022, 8, 6);
  const nose = new THREE.Mesh(noseGeo, skin);
  nose.scale.set(1, 0.8, 1.2);
  nose.position.set(0, -0.02, 0.175);
  headGrp.add(nose);

  // Nose bridge
  const noseBridge = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.055, 0.018), skin);
  noseBridge.position.set(0, 0.025, 0.168);
  headGrp.add(noseBridge);

  // ── Mouth ──
  // Upper lip
  const upperLip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), lipColor);
  upperLip.scale.set(1, 0.5, 0.7);
  upperLip.position.set(0, -0.075, 0.165);
  headGrp.add(upperLip);

  // Lower lip
  const lowerLip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6, Math.PI, Math.PI * 2, 0, Math.PI / 2), lipColor);
  lowerLip.scale.set(1, 0.6, 0.7);
  lowerLip.position.set(0, -0.09, 0.165);
  headGrp.add(lowerLip);

  // Teeth (subtle)
  const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.018, 0.01), teethMat);
  teeth.position.set(0, -0.08, 0.172);
  headGrp.add(teeth);

  // ── Ears ──
  for (const ex of [-0.175, 0.175]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), skin);
    ear.scale.set(0.5, 0.85, 0.7);
    ear.position.set(ex, 0.01, 0);
    headGrp.add(ear);
  }

  // ── Hair ──
  if (def.isFemale) {
    // Long hair — back volume
    const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 14), hair);
    hairBack.scale.set(1.02, 1.15, 1.0);
    hairBack.position.set(0, 0.02, -0.04);
    headGrp.add(hairBack);

    // Hair top
    const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.185, 16, 14, 0, Math.PI * 2, 0, Math.PI / 2), hair);
    hairTop.position.set(0, 0.02, 0);
    headGrp.add(hairTop);

    // Side hair strands
    for (const [sx, sz] of [[-0.16, -0.05], [0.16, -0.05]] as [number, number][]) {
      const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.025, 0.45, 8), hair);
      strand.position.set(sx, -0.18, sz);
      strand.rotation.z = sx > 0 ? 0.2 : -0.2;
      headGrp.add(strand);
    }

    // Hair bun / ponytail hint
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), hair);
    bun.position.set(0, 0.12, -0.18);
    headGrp.add(bun);
  } else {
    // Short professional hair
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.185, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    hairCap.position.set(0, 0.02, 0);
    headGrp.add(hairCap);

    // Side parts
    for (const sx of [-0.16, 0.16]) {
      const side = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8, 0, Math.PI), hair);
      side.scale.set(0.5, 0.7, 0.8);
      side.position.set(sx, 0.01, 0.02);
      headGrp.add(side);
    }
  }

  // ── Makeup / detail (female) ──
  if (def.isFemale) {
    // Subtle blush
    const blushMat = mStd(0xffaaaa, 0.9, 0, 0.3, true);
    for (const bx of [-0.1, 0.1]) {
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.03, 10), blushMat);
      blush.position.set(bx, -0.04, 0.172);
      headGrp.add(blush);
    }
  }

  headGrp.position.set(0, 1.82, 0);
  group.add(headGrp);

  // ── Glasses (Alex only) ──
  if (!def.isFemale) {
    const glassMat = mStd(0x1a1a2a, 0.3, 0.8);
    const lensMat = mStd(0x88aacc, 0.1, 0.1, 0.35, true);

    for (const [gx] of [[-0.072], [0.072]] as [number][]) {
      const frame = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.006, 6, 16), glassMat);
      frame.position.set(gx, 0.04 + 1.82, 0.175);
      group.add(frame);

      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.033, 14), lensMat);
      lens.position.set(gx, 0.04 + 1.82, 0.178);
      group.add(lens);
    }

    // Bridge
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 6), glassMat);
    bridge.rotation.z = Math.PI / 2;
    bridge.position.set(0, 0.04 + 1.82, 0.173);
    group.add(bridge);

    // Temple arms
    for (const [tx] of [[-0.11], [0.11]] as [number][]) {
      const temple = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.14, 6), glassMat);
      temple.rotation.z = Math.PI / 2;
      temple.position.set(tx, 0.04 + 1.82, 0.16);
      group.add(temple);
    }
  }

  // ── Name badge ──
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.065, 0.02), mStd(0xffffff, 0.5, 0.1));
  badge.position.set(def.isFemale ? -0.13 : 0.13, 1.28, 0.165);
  group.add(badge);
  const badgeClip = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.01, 0.025), mStd(C_METAL, 0.2, 0.8));
  badgeClip.position.set(def.isFemale ? -0.13 : 0.13, 1.35, 0.165);
  group.add(badgeClip);

  // ── Position ──
  group.position.set(def.x, floorY, def.z);
  group.rotation.y = def.facingAngle;

  return {
    def,
    group,
    head: headGrp,
    neck,
    torso: torsoGrp,
    leftArm: leftArmGrp,
    rightArm: rightArmGrp,
    leftForearm: leftArmGrp.children[1] as THREE.Mesh,
    rightForearm: rightArmGrp.children[1] as THREE.Mesh,
    leftHand: leftArmGrp.children[2] as THREE.Mesh,
    rightHand: rightArmGrp.children[2] as THREE.Mesh,
    leftLeg: leftLegGrp,
    rightLeg: rightLegGrp,
    phaseOffset: Math.random() * Math.PI * 2,
    animState: 'type',
    animTimer: Math.random() * 10,
  };
}

// ─── Animation Updater ────────────────────────────────────────────────────────
export function updateAvatarAnimation(avatar: AvatarMesh, time: number): void {
  const t = time + avatar.phaseOffset;
  avatar.animTimer += 0.016;

  // State machine — cycle through animations
  if (avatar.animTimer > 8 && avatar.animState === 'type') {
    avatar.animState = Math.random() > 0.5 ? 'idle' : 'talk';
    avatar.animTimer = 0;
  } else if (avatar.animTimer > 4 && avatar.animState === 'idle') {
    avatar.animState = Math.random() > 0.3 ? 'type' : 'greet';
    avatar.animTimer = 0;
  } else if (avatar.animTimer > 3 && avatar.animState === 'greet') {
    avatar.animState = 'type';
    avatar.animTimer = 0;
  } else if (avatar.animTimer > 5 && avatar.animState === 'talk') {
    avatar.animState = 'type';
    avatar.animTimer = 0;
  }

  switch (avatar.animState) {
    case 'idle': {
      // Gentle breathing
      avatar.torso.scale.y = 1 + Math.sin(t * 0.9) * 0.012;
      avatar.head.rotation.y = Math.sin(t * 0.4) * 0.08;
      avatar.head.rotation.x = Math.sin(t * 0.3) * 0.03 - 0.05;

      // Arms relaxed at sides
      avatar.leftArm.rotation.x = 0.05;
      avatar.rightArm.rotation.x = 0.05;
      avatar.leftArm.rotation.z = 0.12;
      avatar.rightArm.rotation.z = -0.12;
      break;
    }

    case 'type': {
      // Seated typing pose
      avatar.torso.scale.y = 1 + Math.sin(t * 0.9) * 0.008;

      // Arms forward and down for keyboard
      const typeSpeed = 7;
      avatar.leftArm.rotation.x = Math.PI / 3.5 + Math.sin(t * typeSpeed) * 0.05;
      avatar.rightArm.rotation.x = Math.PI / 3.5 + Math.sin(t * typeSpeed + 0.7) * 0.05;
      avatar.leftArm.rotation.z = 0.28;
      avatar.rightArm.rotation.z = -0.28;

      // Head slightly down, reading screen
      avatar.head.rotation.x = -0.12 + Math.sin(t * 0.25) * 0.04;
      avatar.head.rotation.y = Math.sin(t * 0.2) * 0.06;
      break;
    }

    case 'greet': {
      // Raise right hand in greeting wave
      avatar.rightArm.rotation.x = -Math.PI / 2.2 + Math.sin(t * 3) * 0.15;
      avatar.rightArm.rotation.z = -0.5;
      avatar.leftArm.rotation.x = 0.05;
      avatar.leftArm.rotation.z = 0.12;

      // Head turns toward visitor
      avatar.head.rotation.y = Math.sin(t * 0.5) * 0.15 + 0.1;
      avatar.head.rotation.x = 0;
      avatar.torso.scale.y = 1 + Math.sin(t * 1.1) * 0.01;
      break;
    }

    case 'talk': {
      // Talking with subtle gestures
      avatar.leftArm.rotation.x = Math.sin(t * 1.2) * 0.25 + 0.15;
      avatar.leftArm.rotation.z = 0.2 + Math.sin(t * 1.5) * 0.15;
      avatar.rightArm.rotation.x = 0.1;
      avatar.rightArm.rotation.z = -0.15;

      // Head animation — nodding and turning
      avatar.head.rotation.y = Math.sin(t * 0.6) * 0.12;
      avatar.head.rotation.x = Math.sin(t * 0.9) * 0.05;
      avatar.torso.scale.y = 1 + Math.sin(t * 1.0) * 0.01;
      break;
    }
  }
}

// ─── Trigger Greet ────────────────────────────────────────────────────────────
export function triggerGreet(avatar: AvatarMesh): void {
  avatar.animState = 'greet';
  avatar.animTimer = 0;
}
