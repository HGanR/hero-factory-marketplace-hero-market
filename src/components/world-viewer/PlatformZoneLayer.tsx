"use client";

import * as THREE from "three";

export interface PlatformPlacement {
  id: string;
  assetId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  ownerLayer?: string;
}

export interface PlatformZone {
  id: string;
  name: string;
  slug: string;
  boundsJson: unknown;
  placementsJson: unknown;
  npcsJson: unknown;
  priority: number;
}

interface PlatformZoneLayerProps {
  zones: PlatformZone[];
}

function PlacementPlaceholder({
  placement,
  isPlatform,
}: {
  placement: PlatformPlacement;
  isPlatform: boolean;
}) {
  const [x, y, z] = placement.position;
  const [sx = 1, sy = 1, sz = 1] = placement.scale;
  const [rx, ry, rz] = placement.rotation;
  const color = isPlatform ? 0x2a6fbd : 0x4a8a3a;

  return (
    <group position={[x, y, z]} rotation={[rx, ry, rz]} scale={[sx, sy, sz]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2, 2, 2]} />
        <meshLambertMaterial color={color} />
      </mesh>
    </group>
  );
}

export function PlatformZoneLayer({ zones }: PlatformZoneLayerProps) {
  const placements: PlatformPlacement[] = [];
  for (const zone of zones) {
    const raw = zone.placementsJson;
    if (Array.isArray(raw)) {
      for (const p of raw) {
        if (p && typeof p === "object" && Array.isArray(p.position)) {
          placements.push({
            id: p.id ?? `plat-${zone.slug}-${placements.length}`,
            assetId: p.assetId ?? "unknown",
            position: p.position,
            rotation: p.rotation ?? [0, 0, 0],
            scale: p.scale ?? [1, 1, 1],
            ownerLayer: "platform",
          });
        }
      }
    }
  }

  return (
    <group>
      {placements.map((p) => (
        <PlacementPlaceholder key={p.id} placement={p} isPlatform />
      ))}
    </group>
  );
}
