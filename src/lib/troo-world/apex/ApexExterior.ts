/**
 * ApexExterior.ts — Procedural Apex Tower exterior.
 * Ported from office-building-3d buildApexBuilding.
 * Black/chrome corporate aesthetic with see-through glass.
 */
import * as THREE from "three";

export function buildApexExterior(): THREE.Group {
  const root = new THREE.Group();

  const black = (rough = 0.2, metal = 0.85) =>
    new THREE.MeshStandardMaterial({ color: 0x0a0a0f, roughness: rough, metalness: metal });
  const chrome = (hex = 0xc8d0d8, rough = 0.1, metal = 0.95) =>
    new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal });
  const glass = (opacity = 0.45) =>
    new THREE.MeshStandardMaterial({
      color: 0x88aabb,
      roughness: 0.05,
      metalness: 0.3,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
    });

  const FLOORS = 7;
  const FLOOR_H = 3.8;
  const TOTAL_H = FLOORS * FLOOR_H;
  const W = 22;
  const D = 16;

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + 4, 0.7, D + 4), black(0.15, 0.9));
  plinth.position.set(0, 0.35, 0);
  root.add(plinth);

  const body = new THREE.Mesh(new THREE.BoxGeometry(W, TOTAL_H, D), black(0.25, 0.8));
  body.position.set(0, TOTAL_H / 2, 0);
  root.add(body);

  for (let i = 0; i <= FLOORS; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.32, D + 0.5), chrome(0xc0ccd8));
    band.position.set(0, i * FLOOR_H + 0.16, 0);
    root.add(band);
  }

  for (const [cx, cz] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]] as [number, number][]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, TOTAL_H + 1, 0.6), chrome());
    col.position.set(cx, TOTAL_H / 2, cz);
    root.add(col);
  }

  const winMat = glass(0.5);
  for (let floor = 0; floor < FLOORS; floor++) {
    for (let col = -3; col <= 3; col++) {
      const wf = new THREE.Mesh(new THREE.BoxGeometry(2.6, FLOOR_H - 0.4, 0.12), winMat);
      wf.position.set(col * 3.1, floor * FLOOR_H + FLOOR_H / 2, D / 2 + 0.06);
      root.add(wf);
      const wb = wf.clone();
      wb.position.z = -D / 2 - 0.06;
      root.add(wb);
    }
  }

  const crown = new THREE.Mesh(new THREE.BoxGeometry(W, 1.5, D), chrome(0xc0ccd8));
  crown.position.set(0, TOTAL_H + 0.75, 0);
  root.add(crown);

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return root;
}
