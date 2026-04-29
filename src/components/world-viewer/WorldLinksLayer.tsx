"use client";

import * as THREE from "three";

export interface WorldLink {
  id: string;
  fromWorldId: string;
  toWorldId: string;
  label?: string | null;
  placementJson?: unknown;
}

interface WorldLinksLayerProps {
  links: WorldLink[];
  onLinkClick?: (link: WorldLink) => void;
}

function PortalMarker({
  link,
  onClick,
}: {
  link: WorldLink;
  onClick?: () => void;
}) {
  const placement = link.placementJson as { position?: number[]; rotation?: number[]; scale?: number[] } | null;
  const pos = placement?.position ?? [0, 0, 0];
  const rot = placement?.rotation ?? [0, 0, 0];
  const scale = placement?.scale ?? [1, 1, 1];

  return (
    <group
      position={[pos[0], pos[1], pos[2]]}
      rotation={[rot[0], rot[1], rot[2]]}
      scale={[scale[0], scale[1], scale[2]]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {/* Portal frame - arched doorway */}
      <mesh castShadow receiveShadow position={[0, 2, 0]}>
        <boxGeometry args={[3, 4, 0.4]} />
        <meshLambertMaterial color={0x6b4e71} emissive={0x2a1f2e} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 2, 0]}>
        <planeGeometry args={[2.2, 3.2]} />
        <meshBasicMaterial
          color={0x4ecdc4}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Glow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <ringGeometry args={[1.2, 1.6, 24]} />
        <meshBasicMaterial
          color={0x4ecdc4}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export function WorldLinksLayer({ links, onLinkClick }: WorldLinksLayerProps) {
  return (
    <group>
      {links.map((link) => (
        <PortalMarker
          key={link.id}
          link={link}
          onClick={onLinkClick ? () => onLinkClick(link) : undefined}
        />
      ))}
    </group>
  );
}
