/**
 * VertexExterior.ts — Procedural Vertex Tower exterior (curved silo).
 * Ported from office-building-3d buildVertexBuilding.
 * Curved semi-elliptical body, cylindrical silo, red rooftop beacon.
 * Used for nexus-tower in world view to match office-building-3d look.
 */
import * as THREE from "three";

export function buildVertexExterior(): THREE.Group {
  const root = new THREE.Group();
  root.name = "vertex_building_root";

  const chrome = (hex: number, rough = 0.1, metal = 0.9) =>
    new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal });
  const glass = (hex: number, opacity = 0.55) =>
    new THREE.MeshStandardMaterial({
      color: hex,
      roughness: 0.05,
      metalness: 0.4,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
    });
  const conc = (hex: number) =>
    new THREE.MeshStandardMaterial({ color: hex, roughness: 0.7, metalness: 0 });

  const FLOORS = 9;
  const FLOOR_H = 3.2;
  const TOTAL_H = FLOORS * FLOOR_H;

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(34, 0.6, 22), conc(0xb0b8c0));
  plinth.position.set(0, 0.3, 0);
  root.add(plinth);

  const bodyGeo = new THREE.CylinderGeometry(14, 14, TOTAL_H, 32, 1, false, 0, Math.PI);
  const bodyMesh = new THREE.Mesh(bodyGeo, glass(0x8ab8d0, 0.6));
  bodyMesh.userData.isWindowGlass = true;
  bodyMesh.position.set(4, TOTAL_H / 2, 0);
  bodyMesh.rotation.y = Math.PI / 2;
  root.add(bodyMesh);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(28, TOTAL_H, 0.3), chrome(0x9aaabb, 0.2, 0.7));
  backWall.position.set(4, TOTAL_H / 2, 0);
  root.add(backWall);

  const bandMat = chrome(0xc0ccd8, 0.15, 0.85);
  for (let i = 0; i <= FLOORS; i++) {
    const bandGeo = new THREE.CylinderGeometry(14.3, 14.3, 0.28, 32, 1, false, 0, Math.PI);
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.set(4, i * FLOOR_H + 0.14, 0);
    band.rotation.y = Math.PI / 2;
    root.add(band);
  }

  const mullionMat = chrome(0xb0bcc8, 0.15, 0.9);
  for (let col = -5; col <= 5; col++) {
    const angle = (col / 6) * (Math.PI * 0.85);
    const mx = 4 + Math.sin(angle + Math.PI / 2) * 14.1;
    const mz = Math.cos(angle + Math.PI / 2) * 14.1;
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.18, TOTAL_H, 0.18), mullionMat);
    mullion.position.set(mx, TOTAL_H / 2, mz);
    root.add(mullion);
  }

  const siloH = TOTAL_H + 4;
  const siloGeo = new THREE.CylinderGeometry(4.5, 4.5, siloH, 24, 1, false);
  const silo = new THREE.Mesh(siloGeo, glass(0x9ab8cc, 0.5));
  silo.userData.isWindowGlass = true;
  silo.position.set(-11, siloH / 2, 0);
  root.add(silo);

  for (let i = 0; i <= FLOORS + 1; i++) {
    const siloBand = new THREE.Mesh(
      new THREE.CylinderGeometry(4.65, 4.65, 0.22, 24, 1, false),
      bandMat
    );
    siloBand.position.set(-11, i * FLOOR_H * (siloH / TOTAL_H) * 0.88 + 0.1, 0);
    root.add(siloBand);
  }

  const siloCap = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.8, 24), chrome(0xc0ccd8, 0.1, 0.9));
  siloCap.position.set(-11, siloH + 0.4, 0);
  root.add(siloCap);

  const beaconMastH = 3.2;
  const beaconMast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, beaconMastH, 8),
    chrome(0xc0ccd8, 0.15, 0.9)
  );
  beaconMast.position.set(-11, siloH + 0.8 + beaconMastH / 2, 0);
  root.add(beaconMast);

  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0xff2200,
    emissive: new THREE.Color(0xff2200),
    emissiveIntensity: 0.15,
    roughness: 0.3,
    metalness: 0.1,
  });
  const beaconSphere = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), beaconMat);
  beaconSphere.position.set(-11, siloH + 0.8 + beaconMastH + 0.28, 0);
  beaconSphere.userData.vertexBeacon = true;
  root.add(beaconSphere);

  const connGeo = new THREE.BoxGeometry(8, TOTAL_H, 0.5);
  const conn = new THREE.Mesh(connGeo, glass(0x8ab8d0, 0.45));
  conn.position.set(-3.5, TOTAL_H / 2, 0);
  conn.rotation.y = 0.18;
  root.add(conn);

  for (let i = 0; i <= FLOORS; i++) {
    const cb = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.25, 0.55), bandMat);
    cb.position.set(-3.5, i * FLOOR_H + 0.12, 0);
    cb.rotation.y = 0.18;
    root.add(cb);
  }

  const canopyMat = chrome(0xc8d4dc, 0.1, 0.9);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 5), canopyMat);
  canopy.position.set(4, FLOOR_H * 1.1, 14.5);
  root.add(canopy);
  for (const cx of [-5, 0, 5]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, FLOOR_H * 1.1, 8), canopyMat);
    col.position.set(cx + 4, FLOOR_H * 0.55, 14.5);
    root.add(col);
  }

  const parapetGeo = new THREE.CylinderGeometry(14.5, 14.5, 0.8, 32, 1, false, 0, Math.PI);
  const parapet = new THREE.Mesh(parapetGeo, chrome(0xc0ccd8, 0.1, 0.9));
  parapet.position.set(4, TOTAL_H + 0.4, 0);
  parapet.rotation.y = Math.PI / 2;
  root.add(parapet);

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return root;
}
