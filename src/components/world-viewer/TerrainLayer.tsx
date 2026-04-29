"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { terrainHeight } from "@/lib/world-engine/terrain";

interface TerrainLayerProps {
  terrainSeed: number;
  size?: number;
  segments?: number;
  onTerrainClick?: (x: number, y: number, z: number) => void;
}

export function TerrainLayer({
  terrainSeed,
  size = 200,
  segments = 128,
  onTerrainClick,
}: TerrainLayerProps) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(size, size, segments, segments);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const cols: number[] = [];
    const cL = new THREE.Color(0x2d6a2d);
    const cM = new THREE.Color(0x4a8a3a);
    const cH = new THREE.Color(0x7ab84a);
    for (let i = 0; i < pos.count; i++) {
      const h = terrainHeight(pos.getX(i), pos.getZ(i), terrainSeed);
      pos.setY(i, h);
      const t = Math.min(1, Math.max(0, h / 8));
      const c =
        t < 0.5 ? cL.clone().lerp(cM, t * 2) : cM.clone().lerp(cH, (t - 0.5) * 2);
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    return g;
  }, [terrainSeed, size, segments]);

  return (
    <mesh
      geometry={geo}
      receiveShadow
      onClick={
        onTerrainClick
          ? (e) => {
              e.stopPropagation();
              const p = e.point;
              onTerrainClick(p.x, p.y, p.z);
            }
          : undefined
      }
      style={onTerrainClick ? { cursor: "pointer" } : undefined}
    >
      <meshLambertMaterial vertexColors />
    </mesh>
  );
}
