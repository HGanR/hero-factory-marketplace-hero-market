"use client";

/**
 * Veritas Education — School of Veritas exterior for green-terrain / Troo Town.
 * Procedural port of buildExterior() from veritas-3d/veritas-3d.html.
 */

import { useMemo } from "react";
import * as THREE from "three";

const brickMat = new THREE.MeshStandardMaterial({ color: 0x8b3a2a, roughness: 0.85, side: THREE.DoubleSide });
const concreteMat = new THREE.MeshStandardMaterial({ color: 0xc8c0b0, roughness: 0.8, side: THREE.DoubleSide });
const glassMat = new THREE.MeshStandardMaterial({
  color: 0x88aacc,
  roughness: 0.1,
  metalness: 0.3,
  transparent: true,
  opacity: 0.7,
});
const roofMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9, side: THREE.DoubleSide });
const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide });
const signBackMat = new THREE.MeshStandardMaterial({ color: 0x1a0a00, roughness: 0.8, side: THREE.DoubleSide });
const poleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.8 });
const flagMat = new THREE.MeshStandardMaterial({ color: 0xcc0000, roughness: 0.8, side: THREE.DoubleSide });
const slabMat = new THREE.MeshStandardMaterial({ color: 0xd0c8b8, roughness: 0.9 });
const walkMat = new THREE.MeshStandardMaterial({ color: 0xd0c8b8, roughness: 0.85 });

function Box({
  pos,
  size,
  mat,
}: {
  pos: [number, number, number];
  size: [number, number, number];
  mat: THREE.Material;
}) {
  return (
    <mesh position={pos} material={mat} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}

function useVeritasSignTexture(): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = "#f0d080";
    ctx.font = "bold 48px Georgia";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("VERITAS EDUCATION", 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, []);
}

export interface VeritasSchoolProps {
  position?: [number, number, number];
  scale?: number;
  isSelected?: boolean;
  onSelect?: () => void;
}

export default function VeritasSchool({
  position = [0, 0, 0],
  scale = 1,
  isSelected = false,
  onSelect,
}: VeritasSchoolProps) {
  const signTex = useVeritasSignTexture();
  const signPlaneMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: signTex, transparent: true, depthWrite: false }),
    [signTex],
  );
  const winPositions = [-18, -12, -6, 6, 12, 18];
  const columnXs = [-4, 0, 4];

  return (
    <group
      position={position}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {/* Terrain-masking base */}
      <mesh position={[0, -1, 0]} receiveShadow>
        <boxGeometry args={[74, 2, 44]} />
        <meshStandardMaterial color={0x8a9098} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.02, 4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={walkMat}>
        <planeGeometry args={[14, 22]} />
      </mesh>
      <mesh position={[0, 0.02, 18]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={slabMat}>
        <planeGeometry args={[42, 20]} />
      </mesh>

      {/* Main building body */}
      <Box pos={[0, 7, -4]} size={[50, 14, 24]} mat={brickMat} />
      <Box pos={[0, 14.75, -4]} size={[52, 1.5, 26]} mat={roofMat} />
      <Box pos={[0, 15.5, 9]} size={[52, 2, 1]} mat={concreteMat} />
      <Box pos={[0, 15.5, -17]} size={[52, 2, 1]} mat={concreteMat} />
      <Box pos={[26, 15.5, -4]} size={[1, 2, 26]} mat={concreteMat} />
      <Box pos={[-26, 15.5, -4]} size={[1, 2, 26]} mat={concreteMat} />

      {/* Central entrance portico */}
      <Box pos={[0, 8, 9]} size={[14, 16, 4]} mat={concreteMat} />
      {columnXs.map((x) => (
        <mesh key={`col-${x}`} position={[x, 7, 11]} castShadow receiveShadow material={whiteMat}>
          <cylinderGeometry args={[0.4, 0.4, 14, 12]} />
        </mesh>
      ))}
      <Box pos={[0, 15, 9]} size={[16, 1.5, 6]} mat={concreteMat} />

      {/* Main entrance doors */}
      <Box pos={[-1.5, 5, 11.2]} size={[4, 8, 0.3]} mat={glassMat} />
      <Box pos={[1.5, 5, 11.2]} size={[4, 8, 0.3]} mat={glassMat} />

      {/* Front windows */}
      {winPositions.map((x) => (
        <group key={`win-${x}`}>
          <Box pos={[x, 9, 8.2]} size={[3.5, 4, 0.2]} mat={glassMat} />
          <Box pos={[x, 4, 8.2]} size={[3.5, 4, 0.2]} mat={glassMat} />
          <Box pos={[x, 9, 8.1]} size={[4, 4.5, 0.15]} mat={concreteMat} />
          <Box pos={[x, 4, 8.1]} size={[4, 4.5, 0.15]} mat={concreteMat} />
        </group>
      ))}

      {/* Side wings */}
      <Box pos={[-30, 5, -4]} size={[10, 10, 24]} mat={brickMat} />
      <Box pos={[30, 5, -4]} size={[10, 10, 24]} mat={brickMat} />
      <Box pos={[-30, 10.5, -4]} size={[12, 1, 26]} mat={roofMat} />
      <Box pos={[30, 10.5, -4]} size={[12, 1, 26]} mat={roofMat} />

      {/* School name sign */}
      <Box pos={[0, 13, 8.5]} size={[20, 2.5, 0.4]} mat={signBackMat} />
      <mesh position={[0, 13, 9.2]} material={signPlaneMat}>
        <planeGeometry args={[8, 2]} />
      </mesh>

      {/* Flag pole */}
      <mesh position={[8, 6, 14]} castShadow material={poleMat}>
        <cylinderGeometry args={[0.08, 0.08, 12, 8]} />
      </mesh>
      <Box pos={[9, 11.5, 14]} size={[2, 1.2, 0.05]} mat={flagMat} />

      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 0]}>
          <ringGeometry args={[34, 36, 48]} />
          <meshBasicMaterial color={0xc8a84b} transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
