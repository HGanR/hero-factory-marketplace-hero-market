/**
 * WorkerSystem.ts - Nexus Tower
 * Animated office workers with knowledge bases.
 */

import * as THREE from "three";
import { FLOOR_HEIGHT, BUILDING, INTERIOR } from "./BuildingScene";

export interface KBEntry {
  id: string;
  title: string;
  content: string;
  tag: "note" | "document" | "task" | "link";
  createdAt: string;
  updatedAt: string;
}

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
  knowledgeBase: KBEntry[];
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
const SHIRT_COLORS = [0x2d6a9f, 0x9f2d2d, 0x2d9f5a, 0x9f7a2d, 0x6a2d9f, 0x2d9f9f, 0xffffff, 0x1a1a2e];
const PANTS_COLORS = [0x1a1a2e, 0x2a2a3a, 0x3a2a1a, 0x1a2a1a, 0x2a1a2a, 0x0d1b2a];
const HAIR_COLORS = [0x1a0a00, 0x3a1a00, 0x8b4513, 0xffd700, 0x4a4a4a, 0x0a0a0a, 0xff6b6b, 0x6b4226];

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function createWorkerDefinitions(): WorkerDef[] {
  const workers: WorkerDef[] = [];
  let idCounter = 0;

  const addWorker = (
    name: string,
    role: string,
    floor: number,
    x: number,
    z: number,
    facing: number,
    anim: WorkerAnimation,
    seed: number
  ) => {
    const r = rng(seed);
    workers.push({
      id: `worker_${idCounter++}`,
      name,
      role,
      floor,
      x,
      z,
      facingAngle: facing,
      animation: anim,
      skinColor: SKIN_TONES[Math.floor(r() * SKIN_TONES.length)],
      shirtColor: SHIRT_COLORS[Math.floor(r() * SHIRT_COLORS.length)],
      pantsColor: PANTS_COLORS[Math.floor(r() * PANTS_COLORS.length)],
      hairColor: HAIR_COLORS[Math.floor(r() * HAIR_COLORS.length)],
      knowledgeBase: [],
    });
  };

  const ix = INTERIOR.x;
  const iz = INTERIOR.z;

  addWorker("Maya Chen", "Receptionist", 0, ix - 2, iz - 0.5, 0, "idle", 1);
  addWorker("James Park", "Security Guard", 0, ix - 8, iz + 3, Math.PI / 4, "walk", 2);
  addWorker("Sofia Reyes", "Visitor", 0, ix + 4, iz + 1.5, Math.PI, "talk", 3);
  addWorker("Tom Walsh", "Delivery", 0, ix + 1, iz + 3, -Math.PI / 2, "idle", 4);

  addWorker("Alex Kim", "Developer", 1, ix - 6, iz - 1, 0, "type", 5);
  addWorker("Priya Sharma", "Designer", 1, ix - 3, iz - 1, 0, "type", 6);
  addWorker("Marcus Lee", "Developer", 1, ix, iz - 1, 0, "type", 7);
  addWorker("Zoe Turner", "Analyst", 1, ix + 3, iz - 1, 0, "type", 8);
  addWorker("Raj Patel", "QA Engineer", 1, ix - 6, iz + 2, Math.PI, "type", 9);
  addWorker("Nina Scott", "Scrum Master", 1, ix + 1, iz + 3, Math.PI / 2, "talk", 10);

  addWorker("Chris Evans", "Data Scientist", 2, ix - 6, iz - 1, 0, "type", 11);
  addWorker("Amara Osei", "ML Engineer", 2, ix - 3, iz - 1, 0, "type", 12);
  addWorker("Lena Müller", "Researcher", 2, ix, iz - 1, 0, "type", 13);
  addWorker("Diego Ruiz", "Backend Dev", 2, ix + 3, iz - 1, 0, "type", 14);
  addWorker("Yuki Tanaka", "DevOps", 2, ix - 3, iz + 2, Math.PI, "type", 15);
  addWorker("Fatima Al-Amin", "Architect", 2, ix + 2, iz + 3, -Math.PI / 4, "walk", 16);

  addWorker("Robert Chen", "CEO", 3, ix - 4, iz, Math.PI / 2, "talk", 17);
  addWorker("Sarah Johnson", "CFO", 3, ix - 2, iz, Math.PI / 2, "sit", 18);
  addWorker("Mike Davis", "CTO", 3, ix, iz, Math.PI / 2, "sit", 19);
  addWorker("Emma Wilson", "VP Sales", 3, ix + 2, iz, Math.PI / 2, "sit", 20);
  addWorker("David Brown", "VP Ops", 3, ix + 4, iz, Math.PI / 2, "sit", 21);
  addWorker("Lisa Zhang", "Presenter", 3, ix - 7, iz - 2, 0, "talk", 22);

  addWorker("Kevin O'Brien", "Sales Rep", 4, ix - 6, iz - 1, 0, "phone", 23);
  addWorker("Aisha Mohammed", "Account Mgr", 4, ix - 3, iz - 1, 0, "type", 24);
  addWorker("Ben Carter", "Sales Lead", 4, ix, iz - 1, 0, "phone", 25);
  addWorker("Chloe Martin", "Marketing", 4, ix + 3, iz - 1, 0, "type", 26);
  addWorker("Omar Hassan", "BD Manager", 4, ix - 3, iz + 2, Math.PI, "talk", 27);
  addWorker("Grace Liu", "Coordinator", 4, ix + 2, iz + 3, Math.PI / 2, "walk", 28);

  addWorker("Victoria Hart", "President", 5, ix - 8, iz, 0, "type", 29);
  addWorker("James Sterling", "SVP Finance", 5, ix - 2, iz, 0, "type", 30);
  addWorker("Natasha Ivanova", "SVP Tech", 5, ix + 4, iz, 0, "type", 31);
  addWorker("Charles Webb", "Board Member", 5, ix + 8, iz + 2, -Math.PI / 2, "sit", 32);
  addWorker("Diana Prince", "Exec Assistant", 5, ix - 5, iz + 3, Math.PI / 4, "idle", 33);

  addWorker("Sam Foster", "HR Manager", 6, ix - 6, iz - 1, 0, "type", 34);
  addWorker("Mei Lin", "Recruiter", 6, ix - 3, iz - 1, 0, "phone", 35);
  addWorker("Jake Morrison", "HR Analyst", 6, ix, iz - 1, 0, "type", 36);
  addWorker("Tara Singh", "L&D Specialist", 6, ix + 3, iz - 1, 0, "type", 37);
  addWorker("Finn Murphy", "Benefits Admin", 6, ix - 3, iz + 2, Math.PI, "type", 38);
  addWorker("Isla Campbell", "HR BP", 6, ix + 1, iz + 3, Math.PI / 2, "talk", 39);

  addWorker("Tony Rossi", "Chef", 7, ix - 6, iz - 2, Math.PI / 2, "idle", 40);
  addWorker("Wendy Park", "Engineer", 7, ix - 1, iz + 1.5, 0, "idle", 41);
  addWorker("Luis Gomez", "Designer", 7, ix + 2, iz + 1.5, Math.PI, "talk", 42);
  addWorker("Hana Kobayashi", "Developer", 7, ix + 5, iz + 1.5, Math.PI / 2, "phone", 43);
  addWorker("Andre Dubois", "Analyst", 7, ix - 4, iz + 1.5, 0, "idle", 44);

  addWorker("Stella Nova", "Director", 8, ix - 3, iz - 1.5, Math.PI / 4, "talk", 45);
  addWorker("Ryan Blake", "VP Product", 8, ix - 1, iz - 0.5, -Math.PI / 4, "idle", 46);
  addWorker("Aria Patel", "Lead Designer", 8, ix + 1, iz - 1.5, Math.PI / 3, "phone", 47);
  addWorker("Max Hoffman", "CTO", 8, ix + 4, iz - 2, Math.PI / 2, "idle", 48);
  addWorker("Zara Ahmed", "CMO", 8, ix - 2, iz + 1, -Math.PI / 6, "talk", 49);

  return workers;
}

function boxMesh(w: number, h: number, d: number, color: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
}

function sphereMesh(r: number, color: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshLambertMaterial({ color }));
}

export function buildWorkerMesh(def: WorkerDef): WorkerMesh {
  const group = new THREE.Group();
  group.name = `worker_${def.id}`;

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

  const neck = boxMesh(0.1 * SCALE, 0.1 * SCALE, 0.1 * SCALE, def.skinColor);
  neck.position.set(0, 1.26 * SCALE, 0);
  group.add(neck);

  const leftArm = new THREE.Group();
  const leftUpperArm = boxMesh(0.1 * SCALE, 0.28 * SCALE, 0.1 * SCALE, def.shirtColor);
  leftUpperArm.position.set(0, -0.14 * SCALE, 0);
  leftArm.add(leftUpperArm);
  const leftForearm = boxMesh(0.09 * SCALE, 0.26 * SCALE, 0.09 * SCALE, def.skinColor);
  leftForearm.position.set(0, -0.42 * SCALE, 0);
  leftArm.add(leftForearm);
  leftArm.position.set(-0.21 * SCALE, 1.05 * SCALE, 0);
  group.add(leftArm);

  const rightArm = new THREE.Group();
  const rightUpperArm = boxMesh(0.1 * SCALE, 0.28 * SCALE, 0.1 * SCALE, def.shirtColor);
  rightUpperArm.position.set(0, -0.14 * SCALE, 0);
  rightArm.add(rightUpperArm);
  const rightForearm = boxMesh(0.09 * SCALE, 0.26 * SCALE, 0.09 * SCALE, def.skinColor);
  rightForearm.position.set(0, -0.42 * SCALE, 0);
  rightArm.add(rightForearm);
  rightArm.position.set(0.21 * SCALE, 1.05 * SCALE, 0);
  group.add(rightArm);

  const leftLeg = new THREE.Group();
  const leftUpperLeg = boxMesh(0.12 * SCALE, 0.3 * SCALE, 0.12 * SCALE, def.pantsColor);
  leftUpperLeg.position.set(0, -0.15 * SCALE, 0);
  leftLeg.add(leftUpperLeg);
  const leftLowerLeg = boxMesh(0.11 * SCALE, 0.28 * SCALE, 0.11 * SCALE, def.pantsColor);
  leftLowerLeg.position.set(0, -0.44 * SCALE, 0);
  leftLeg.add(leftLowerLeg);
  const leftShoe = boxMesh(0.13 * SCALE, 0.07 * SCALE, 0.18 * SCALE, 0x1a1a1a);
  leftShoe.position.set(0, -0.61 * SCALE, 0.03 * SCALE);
  leftLeg.add(leftShoe);
  leftLeg.position.set(-0.1 * SCALE, 0.68 * SCALE, 0);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  const rightUpperLeg = boxMesh(0.12 * SCALE, 0.3 * SCALE, 0.12 * SCALE, def.pantsColor);
  rightUpperLeg.position.set(0, -0.15 * SCALE, 0);
  rightLeg.add(rightUpperLeg);
  const rightLowerLeg = boxMesh(0.11 * SCALE, 0.28 * SCALE, 0.11 * SCALE, def.pantsColor);
  rightLowerLeg.position.set(0, -0.44 * SCALE, 0);
  rightLeg.add(rightLowerLeg);
  const rightShoe = boxMesh(0.13 * SCALE, 0.07 * SCALE, 0.18 * SCALE, 0x1a1a1a);
  rightShoe.position.set(0, -0.61 * SCALE, 0.03 * SCALE);
  rightLeg.add(rightShoe);
  rightLeg.position.set(0.1 * SCALE, 0.68 * SCALE, 0);
  group.add(rightLeg);

  group.rotation.y = def.facingAngle;

  const floorY = def.floor * FLOOR_HEIGHT;
  group.position.set(def.x, floorY, def.z);

  let walkPath: WorkerMesh["walkPath"] | undefined;
  if (def.animation === "walk") {
    const halfW = INTERIOR.width / 2 - 1.5;
    const halfD = INTERIOR.depth / 2 - 1.5;
    const cx = INTERIOR.x;
    const cz = INTERIOR.z;
    walkPath = {
      points: [
        new THREE.Vector3(cx + halfW * 0.5, floorY, cz - halfD * 0.5),
        new THREE.Vector3(cx - halfW * 0.5, floorY, cz - halfD * 0.5),
        new THREE.Vector3(cx - halfW * 0.5, floorY, cz + halfD * 0.5),
        new THREE.Vector3(cx + halfW * 0.5, floorY, cz + halfD * 0.5),
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

export function updateWorkerAnimation(worker: WorkerMesh, time: number): void {
  const { def, leftArm, rightArm, leftLeg, rightLeg, head, phaseOffset } = worker;
  const t = time + phaseOffset;
  const SCALE = 0.85;

  switch (def.animation) {
    case "idle":
      worker.group.position.y = def.floor * FLOOR_HEIGHT + Math.sin(t * 0.8) * 0.008;
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
        if (dir.length() > 0.01) {
          worker.group.rotation.y = Math.atan2(dir.x, dir.z);
        }
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
      worker.group.position.y = def.floor * FLOOR_HEIGHT - 0.28 * SCALE;
      leftLeg.rotation.x = -Math.PI / 2.2;
      rightLeg.rotation.x = -Math.PI / 2.2;
      leftArm.rotation.x = Math.PI / 8;
      rightArm.rotation.x = Math.PI / 8;
      leftArm.rotation.z = 0.2;
      rightArm.rotation.z = -0.2;
      head.rotation.y = Math.sin(t * 0.3) * 0.08;
      break;
    case "type":
      worker.group.position.y = def.floor * FLOOR_HEIGHT - 0.28 * SCALE;
      leftLeg.rotation.x = -Math.PI / 2.2;
      rightLeg.rotation.x = -Math.PI / 2.2;
      const typeSpeed = 8;
      leftArm.rotation.x = Math.PI / 3 + Math.sin(t * typeSpeed) * 0.06;
      rightArm.rotation.x = Math.PI / 3 + Math.sin(t * typeSpeed + 0.5) * 0.06;
      leftArm.rotation.z = 0.25;
      rightArm.rotation.z = -0.25;
      head.rotation.x = Math.sin(t * 0.4) * 0.04 - 0.05;
      head.rotation.y = Math.sin(t * 0.2) * 0.06;
      break;
    case "talk":
      worker.group.position.y = def.floor * FLOOR_HEIGHT + Math.sin(t * 1.2) * 0.005;
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
      worker.group.position.y = def.floor * FLOOR_HEIGHT + Math.sin(t * 0.9) * 0.005;
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

const STORAGE_KEY = "troo_nexus_tower_knowledge_bases";

export function loadAllKnowledgeBases(): Record<string, KBEntry[]> {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveWorkerKB(workerId: string, entries: KBEntry[]): void {
  try {
    if (typeof window === "undefined") return;
    const all = loadAllKnowledgeBases();
    all[workerId] = entries;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export function loadWorkerKB(workerId: string): KBEntry[] {
  const all = loadAllKnowledgeBases();
  return all[workerId] ?? [];
}

export function generateKBId(): string {
  return `kb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
