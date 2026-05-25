/**
 * ApexWorkerSystem.ts — 14 Apex Tower agents across 7 floors.
 * Uses APEX_FLOOR_HEIGHT and APEX_INTERIOR. Ported from home/office-building-3d.
 */
import * as THREE from "three";
import {
  APEX_FLOOR_HEIGHT,
  APEX_INTERIOR,
} from "./ApexBuildingScene";

export type WorkerAnimation = "sit" | "idle" | "walk" | "type" | "talk" | "phone";

export interface WorkerDef {
  id: string;
  name: string;
  role: string;
  floor: number;
  x: number;
  z: number;
  facingAngle: number;
  animation: WorkerAnimation;
  skinColor: number;
  shirtColor: number;
  pantsColor: number;
  hairColor: number;
}

export interface WorkerMesh {
  def: WorkerDef;
  group: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  head: THREE.Mesh;
  torso: THREE.Mesh;
  walkPath?: { points: THREE.Vector3[]; t: number; speed: number };
  phaseOffset: number;
}

const SKIN_TONES = [0xfdbcb4, 0xf1c27d, 0xe8beac, 0xc68642, 0x8d5524, 0xffcba4];
const APEX_SHIRTS = [0xb8860b, 0xcd853f, 0xd2691e, 0x8b6914, 0xa0522d, 0xdaa520, 0xffffff, 0x2c1810];
const PANTS_COLORS = [0x1a1a2e, 0x2c2c3e, 0x0a0a1a, 0x3a3a4a, 0x1c1c2c, 0x2a2a3a];
const HAIR_COLORS = [0x1a0a00, 0x3d2b1f, 0x6b4226, 0x8b6914, 0xf5deb3, 0x2c1810];

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function createApexWorkerDefinitions(): WorkerDef[] {
  const workers: WorkerDef[] = [];
  const cx = APEX_INTERIOR.x;
  const cz = APEX_INTERIOR.z;

  const add = (
    id: string,
    name: string,
    role: string,
    floor: number,
    x: number,
    z: number,
    facing: number,
    anim: WorkerAnimation,
    seed: number
  ) => {
    const r = rng(seed + 1000);
    workers.push({
      id,
      name,
      role,
      floor,
      x,
      z,
      facingAngle: facing,
      animation: anim,
      skinColor: SKIN_TONES[Math.floor(r() * SKIN_TONES.length)],
      shirtColor: APEX_SHIRTS[Math.floor(r() * APEX_SHIRTS.length)],
      pantsColor: PANTS_COLORS[Math.floor(r() * PANTS_COLORS.length)],
      hairColor: HAIR_COLORS[Math.floor(r() * HAIR_COLORS.length)],
    });
  };

  add("apex_apex_worker_0", "Victoria Lane", "Head Concierge", 0, cx - 3, cz - 1.5, 0, "idle", 10);
  add("apex_apex_worker_1", "Marcus Webb", "Security Director", 0, cx + 5, cz + 3.5, Math.PI / 4, "walk", 11);
  add("apex_apex_worker_2", "Katherine Voss", "General Counsel", 1, cx - 5, cz - 1.5, Math.PI / 3, "idle", 30);
  add("apex_apex_worker_3", "Samuel Drake", "Corporate Attorney", 1, cx + 2, cz - 2, Math.PI, "type", 31);
  add("apex_apex_worker_4", "Theodore Banks", "Chief Financial Officer", 2, cx - 4, cz - 2, Math.PI / 4, "talk", 40);
  add("apex_apex_worker_5", "Sophia Mercer", "Financial Controller", 2, cx + 3, cz - 1, Math.PI, "type", 41);
  add("apex_apex_worker_6", "Amelia Stone", "Chief People Officer", 3, cx - 4, cz - 1.5, Math.PI / 3, "idle", 50);
  add("apex_apex_worker_7", "Henry Blake", "Talent Acquisition Lead", 3, cx + 2, cz - 2, Math.PI, "talk", 51);
  add("apex_apex_worker_8", "Alexander Apex", "Chief Executive Officer", 4, cx - 3, cz - 1.5, Math.PI / 6, "idle", 70);
  add("apex_apex_worker_9", "Diana Sterling", "Chief of Staff", 4, cx + 3, cz - 2, Math.PI, "type", 71);
  add("apex_apex_worker_10", "Jordan Pierce", "Chief Technology Officer", 5, cx - 4, cz - 2, Math.PI / 4, "talk", 60);
  add("apex_apex_worker_11", "Naomi Okafor", "Chief Information Security Officer", 5, cx + 2, cz - 1, Math.PI, "type", 61);
  add("apex_apex_worker_12", "Maxwell Crane", "Chief Strategy Officer", 6, cx - 2, cz - 0.5, Math.PI / 2, "talk", 72);
  add("apex_apex_worker_13", "Vivienne Hart", "VP of Strategy & Consulting", 6, cx + 7.5, cz + 3.7, -Math.PI / 4, "idle", 73);

  return workers;
}

function boxMesh(w: number, h: number, d: number, color: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
}

function sphereMesh(r: number, color: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshLambertMaterial({ color }));
}

export function buildApexWorkerMesh(def: WorkerDef): WorkerMesh {
  const group = new THREE.Group();
  group.name = `worker_${def.id}`;
  group.userData.workerDef = def;

  const SCALE = 0.85;

  const torso = boxMesh(0.32 * SCALE, 0.42 * SCALE, 0.18 * SCALE, def.shirtColor);
  torso.position.set(0, 0.9 * SCALE, 0);
  group.add(torso);

  const head = sphereMesh(0.16 * SCALE, def.skinColor);
  head.position.set(0, 1.42 * SCALE, 0);
  group.add(head);

  const hair = boxMesh(0.34 * SCALE, 0.1 * SCALE, 0.34 * SCALE, def.hairColor);
  hair.position.set(0, 1.54 * SCALE, 0);
  group.add(hair);
  const eyeL = boxMesh(0.04, 0.04, 0.02, 0x111111);
  eyeL.position.set(-0.06 * SCALE, 1.44 * SCALE, 0.15 * SCALE);
  group.add(eyeL);
  const eyeR = boxMesh(0.04, 0.04, 0.02, 0x111111);
  eyeR.position.set(0.06 * SCALE, 1.44 * SCALE, 0.15 * SCALE);
  group.add(eyeR);
  const nose = boxMesh(0.1 * SCALE, 0.1 * SCALE, 0.1 * SCALE, def.skinColor);
  nose.position.set(0, 1.26 * SCALE, 0);
  group.add(nose);

  const leftArm = new THREE.Group();
  const leftArmUpper = boxMesh(0.1 * SCALE, 0.28 * SCALE, 0.1 * SCALE, def.shirtColor);
  leftArmUpper.position.set(0, -0.14 * SCALE, 0);
  leftArm.add(leftArmUpper);
  const leftArmLower = boxMesh(0.09 * SCALE, 0.26 * SCALE, 0.09 * SCALE, def.skinColor);
  leftArmLower.position.set(0, -0.42 * SCALE, 0);
  leftArm.add(leftArmLower);
  leftArm.position.set(-0.21 * SCALE, 1.05 * SCALE, 0);
  group.add(leftArm);

  const rightArm = new THREE.Group();
  const rightArmUpper = boxMesh(0.1 * SCALE, 0.28 * SCALE, 0.1 * SCALE, def.shirtColor);
  rightArmUpper.position.set(0, -0.14 * SCALE, 0);
  rightArm.add(rightArmUpper);
  const rightArmLower = boxMesh(0.09 * SCALE, 0.26 * SCALE, 0.09 * SCALE, def.skinColor);
  rightArmLower.position.set(0, -0.42 * SCALE, 0);
  rightArm.add(rightArmLower);
  rightArm.position.set(0.21 * SCALE, 1.05 * SCALE, 0);
  group.add(rightArm);

  const leftLeg = new THREE.Group();
  const leftLegUpper = boxMesh(0.12 * SCALE, 0.3 * SCALE, 0.12 * SCALE, def.pantsColor);
  leftLegUpper.position.set(0, -0.15 * SCALE, 0);
  leftLeg.add(leftLegUpper);
  const leftLegLower = boxMesh(0.11 * SCALE, 0.28 * SCALE, 0.11 * SCALE, def.pantsColor);
  leftLegLower.position.set(0, -0.44 * SCALE, 0);
  leftLeg.add(leftLegLower);
  const leftFoot = boxMesh(0.13 * SCALE, 0.07 * SCALE, 0.18 * SCALE, 0x1a1a1a);
  leftFoot.position.set(0, -0.61 * SCALE, 0.03 * SCALE);
  leftLeg.add(leftFoot);
  leftLeg.position.set(-0.1 * SCALE, 0.68 * SCALE, 0);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  const rightLegUpper = boxMesh(0.12 * SCALE, 0.3 * SCALE, 0.12 * SCALE, def.pantsColor);
  rightLegUpper.position.set(0, -0.15 * SCALE, 0);
  rightLeg.add(rightLegUpper);
  const rightLegLower = boxMesh(0.11 * SCALE, 0.28 * SCALE, 0.11 * SCALE, def.pantsColor);
  rightLegLower.position.set(0, -0.44 * SCALE, 0);
  rightLeg.add(rightLegLower);
  const rightFoot = boxMesh(0.13 * SCALE, 0.07 * SCALE, 0.18 * SCALE, 0x1a1a1a);
  rightFoot.position.set(0, -0.61 * SCALE, 0.03 * SCALE);
  rightLeg.add(rightFoot);
  rightLeg.position.set(0.1 * SCALE, 0.68 * SCALE, 0);
  group.add(rightLeg);

  group.rotation.y = def.facingAngle;

  const floorY = def.floor * APEX_FLOOR_HEIGHT;
  group.position.set(def.x, floorY, def.z);

  let walkPath: WorkerMesh["walkPath"] | undefined;
  if (def.animation === "walk") {
    const halfW = APEX_INTERIOR.width / 2 - 1.5;
    const halfD = APEX_INTERIOR.depth / 2 - 1.5;
    const icx = APEX_INTERIOR.x;
    const icz = APEX_INTERIOR.z;
    walkPath = {
      points: [
        new THREE.Vector3(icx + halfW * 0.5, floorY, icz - halfD * 0.5),
        new THREE.Vector3(icx - halfW * 0.5, floorY, icz - halfD * 0.5),
        new THREE.Vector3(icx - halfW * 0.5, floorY, icz + halfD * 0.5),
        new THREE.Vector3(icx + halfW * 0.5, floorY, icz + halfD * 0.5),
      ],
      t: Math.random(),
      speed: 0.04 + Math.random() * 0.03,
    };
  }

  return {
    def,
    group,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    head: head as THREE.Mesh,
    torso: torso as THREE.Mesh,
    walkPath,
    phaseOffset: Math.random() * Math.PI * 2,
  };
}

export function updateApexWorkerAnimation(worker: WorkerMesh, time: number): void {
  const { def, leftArm, rightArm, leftLeg, rightLeg, head, phaseOffset } = worker;
  const t = time + phaseOffset;
  const SCALE = 0.85;
  const floorY = () => def.floor * APEX_FLOOR_HEIGHT;

  switch (def.animation) {
    case "idle":
      worker.group.position.y = floorY() + Math.sin(t * 0.8) * 0.008;
      head.rotation.y = Math.sin(t * 0.5) * 0.1;
      leftArm.rotation.z = 0.15 + Math.sin(t * 0.6) * 0.03;
      rightArm.rotation.z = -0.15 - Math.sin(t * 0.6) * 0.03;
      leftArm.rotation.x = 0;
      rightArm.rotation.x = 0;
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
      break;
    case "walk":
      if (worker.walkPath) {
        const path = worker.walkPath;
        path.t = (path.t + path.speed * 0.016) % 1;
        const pts = path.points;
        const segCount = pts.length;
        const totalT = path.t * segCount;
        const seg = Math.floor(totalT) % segCount;
        const segT = totalT - Math.floor(totalT);
        const from = pts[seg];
        const to = pts[(seg + 1) % segCount];
        const pos = from.clone().lerp(to, segT);
        worker.group.position.set(pos.x, pos.y + Math.abs(Math.sin(t * 6)) * 0.02, pos.z);
        const dir = to.clone().sub(from).normalize();
        if (dir.length() > 0.01) worker.group.rotation.y = Math.atan2(dir.x, dir.z);
      }
      leftLeg.rotation.x = Math.sin(t * 6) * 0.5;
      rightLeg.rotation.x = -Math.sin(t * 6) * 0.5;
      leftArm.rotation.x = -Math.sin(t * 6) * 0.4;
      rightArm.rotation.x = Math.sin(t * 6) * 0.4;
      leftArm.rotation.z = 0.1;
      rightArm.rotation.z = -0.1;
      head.rotation.y = Math.sin(t * 0.5) * 0.05;
      break;
    case "sit":
      worker.group.position.y = floorY() - 0.28 * SCALE;
      leftLeg.rotation.x = -Math.PI / 2.2;
      rightLeg.rotation.x = -Math.PI / 2.2;
      leftArm.rotation.x = Math.PI / 8;
      rightArm.rotation.x = Math.PI / 8;
      leftArm.rotation.z = 0.2;
      rightArm.rotation.z = -0.2;
      head.rotation.y = Math.sin(t * 0.3) * 0.08;
      break;
    case "type":
      worker.group.position.y = floorY() - 0.28 * SCALE;
      leftLeg.rotation.x = -Math.PI / 2.2;
      rightLeg.rotation.x = -Math.PI / 2.2;
      leftArm.rotation.x = Math.PI / 3 + Math.sin(t * 8) * 0.06;
      rightArm.rotation.x = Math.PI / 3 + Math.sin(t * 8 + 0.5) * 0.06;
      leftArm.rotation.z = 0.25;
      rightArm.rotation.z = -0.25;
      head.rotation.x = Math.sin(t * 0.4) * 0.04 - 0.05;
      head.rotation.y = Math.sin(t * 0.2) * 0.06;
      break;
    case "talk":
      worker.group.position.y = floorY() + Math.sin(t * 1.2) * 0.005;
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
      leftArm.rotation.x = Math.sin(t * 1.5) * 0.4 + 0.2;
      leftArm.rotation.z = 0.3 + Math.sin(t * 1.5) * 0.2;
      rightArm.rotation.x = Math.sin(t * 1.2 + 1) * 0.2;
      rightArm.rotation.z = -0.2;
      head.rotation.y = Math.sin(t * 0.8) * 0.2;
      head.rotation.x = Math.sin(t * 1.1) * 0.05;
      break;
    case "phone":
      worker.group.position.y = floorY() + Math.sin(t * 0.9) * 0.005;
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
      rightArm.rotation.x = Math.PI / 2.5 + Math.sin(t * 0.5) * 0.03;
      rightArm.rotation.z = -0.5;
      leftArm.rotation.x = 0.1;
      leftArm.rotation.z = 0.15;
      head.rotation.z = -0.15;
      head.rotation.y = Math.sin(t * 0.3) * 0.05 - 0.1;
      break;
  }
}
