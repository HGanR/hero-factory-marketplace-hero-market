import * as THREE from "three";
import type { PodiumPlan } from "../prompt-schema";
import { podiumMaterial } from "./material";

function setUserData(group: THREE.Group, plan: PodiumPlan) {
  group.userData = {
    planKind: plan.kind,
    planVersion: plan.version,
    params: { w: plan.w, d: plan.d, h: plan.h, hasPlaque: plan.hasPlaque },
  };
}

export function genPodium(plan: PodiumPlan): THREE.Group {
  const root = new THREE.Group();
  root.name = `Podium_${plan.w}x${plan.d}`;
  setUserData(root, plan);

  const { w, d, h, hasPlaque, style } = plan;
  const mat = podiumMaterial(style);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h * 0.85, d),
    mat
  );
  body.name = "body";
  body.position.set(0, (h * 0.85) / 2, 0);
  body.castShadow = true;
  root.add(body);

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.05, h * 0.1, d * 1.05),
    mat
  );
  top.name = "top";
  top.position.set(0, h * 0.85 + (h * 0.1) / 2, 0);
  top.castShadow = true;
  root.add(top);

  if (hasPlaque) {
    const plaque = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.7, h * 0.04, 0.02),
      new THREE.MeshStandardMaterial({
        color: 0x2c3e50,
        roughness: 0.6,
        metalness: 0.2,
      })
    );
    plaque.name = "plaque";
    plaque.position.set(0, h - 0.02, d / 2 + 0.02);
    root.add(plaque);
  }

  return root;
}
