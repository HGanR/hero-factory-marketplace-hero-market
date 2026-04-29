/**
 * HarborviewExterior.ts — Procedural Harborview Tower exterior.
 * Glass curtain-wall waterfront building. Southwest quadrant, near lake.
 * Adapted from reference buildHarborviewBuilding.
 */
import * as THREE from "three";

export function buildHarborviewExterior(): THREE.Group {
  const root = new THREE.Group();

  const glass = (hex: number, opacity = 0.72) =>
    new THREE.MeshLambertMaterial({ color: hex, transparent: true, opacity });
  const conc = (hex: number) => new THREE.MeshLambertMaterial({ color: hex });
  const mtl = (hex: number) => new THREE.MeshLambertMaterial({ color: hex });

  // Ground plaza
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(36, 0.4, 28), conc(0xc8cdd4));
  plaza.position.set(0, 0.2, 0);
  plaza.castShadow = true;
  root.add(plaza);

  // Left wing (3-floor)
  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(14, 11, 22), glass(0x7ab4d8, 0.65));
  leftWing.position.set(-11, 5.9, 0);
  leftWing.castShadow = true;
  root.add(leftWing);
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.25, 22.4), mtl(0x8899aa));
    band.position.set(-11, i * 3.6 + 0.5, 0);
    root.add(band);
  }

  // Right wing (3-floor)
  const rightWing = new THREE.Mesh(new THREE.BoxGeometry(12, 11, 22), glass(0x6aaac8, 0.65));
  rightWing.position.set(12, 5.9, 0);
  rightWing.castShadow = true;
  root.add(rightWing);
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.25, 22.4), mtl(0x8899aa));
    band.position.set(12, i * 3.6 + 0.5, 0);
    root.add(band);
  }

  // Central tower (7-floor)
  const tower = new THREE.Mesh(new THREE.BoxGeometry(18, 26, 20), glass(0x5a9ec0, 0.7));
  tower.position.set(0, 13.4, 0);
  tower.castShadow = true;
  root.add(tower);
  for (let i = 0; i <= 7; i++) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(18.4, 0.3, 20.4), mtl(0x7a9aaa));
    band.position.set(0, i * 3.7 + 0.4, 0);
    root.add(band);
  }
  const mullionMat = mtl(0x8899aa);
  for (let col = -3; col <= 3; col++) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.18, 26, 0.18), mullionMat);
    mullion.position.set(col * 2.6, 13.4, 10.1);
    root.add(mullion);
    const mullionB = mullion.clone();
    (mullionB as THREE.Mesh).material = mullionMat.clone();
    mullionB.position.z = -10.1;
    root.add(mullionB);
  }

  // Entrance canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 6), glass(0x9ac8e0, 0.6));
  canopy.position.set(0, 4.5, 13.2);
  root.add(canopy);
  for (const cx of [-6, -2, 2, 6]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4.5, 8), mtl(0xaabbcc));
    col.position.set(cx, 2.25, 13.2);
    root.add(col);
  }

  // Outdoor café terrace
  const terrace = new THREE.Mesh(new THREE.BoxGeometry(30, 0.25, 6), conc(0xd8d4cc));
  terrace.position.set(0, 0.45, 16);
  root.add(terrace);

  // Rooftop parapet
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(18.4, 0.9, 20.4), conc(0xb0bcc8));
  parapet.position.set(0, 26.85, 0);
  root.add(parapet);

  root.traverse((child: THREE.Object3D) => {
    if ((child as THREE.Mesh).isMesh) {
      (child as THREE.Mesh).castShadow = true;
      (child as THREE.Mesh).receiveShadow = true;
    }
  });

  return root;
}
