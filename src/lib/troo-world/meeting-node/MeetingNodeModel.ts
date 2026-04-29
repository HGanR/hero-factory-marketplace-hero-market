/**
 * MeetingNodeModel.ts — Procedural meeting node gizmo.
 * Floor disk + holographic ring for boardroom terminal / meeting anchor.
 */
import * as THREE from "three";

export function buildMeetingNodeGizmo(): THREE.Group {
  const root = new THREE.Group();
  root.name = "meeting_node_gizmo";

  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x1a3a5c,
    roughness: 0.4,
    metalness: 0.6,
  });

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0x00aaff,
    roughness: 0.2,
    metalness: 0.8,
    emissive: 0x004466,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });

  const innerMat = new THREE.MeshStandardMaterial({
    color: 0x0d2a3a,
    roughness: 0.3,
    metalness: 0.7,
    emissive: 0x0066aa,
    emissiveIntensity: 0.15,
  });

  // Base disk (floor pad)
  const baseGeo = new THREE.CylinderGeometry(2, 2.2, 0.15, 24);
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.rotation.x = 0;
  base.position.y = 0.075;
  root.add(base);

  // Inner ring
  const ringGeo = new THREE.RingGeometry(1.2, 1.8, 32);
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.16;
  root.add(ring);

  // Center podium / terminal
  const centerGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.5, 12);
  const center = new THREE.Mesh(centerGeo, innerMat);
  center.position.y = 0.41;
  root.add(center);

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      (child as THREE.Mesh).castShadow = true;
      (child as THREE.Mesh).receiveShadow = true;
    }
  });

  return root;
}
