"use client";

import * as THREE from "three";
import type { VenueInteriorNode } from "@/types/venue-nodes";
import type { Placement } from "@/lib/world-engine/chunk-utils";
import { nodeToWorld } from "@/lib/world-editor/venue-node-transforms";

const NODE_TYPE_COLORS: Record<string, number> = {
  voice_room: 0x4ecdc4,
  event_stage: 0xe74c3c,
  seminar_room: 0x9b59b6,
  chat_room: 0x3498db,
  concert_hall: 0xe67e22,
  custom: 0x95a5a6,
};

interface VenueNodeLayerProps {
  nodes: VenueInteriorNode[];
  placement: Placement | null;
  selectedNodeId: string | null;
  /** Draft position in world space (for "Place Visually" preview while modal is open) */
  draftWorldPosition: [number, number, number] | null;
  onNodeClick: (node: VenueInteriorNode) => void;
}

function VenueMarker({
  position,
  onClick,
  selected,
  active,
  color,
}: {
  position: [number, number, number];
  onClick?: () => void;
  selected?: boolean;
  active?: boolean;
  color: number;
}) {
  const emissive = selected ? 0x224466 : active ? 0x4ecdc4 : 0;
  const emissiveIntensity = selected ? 0.5 : active ? 0.3 : 0;

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[0.8, 16, 12]} />
        <meshLambertMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.2, 0]}>
        <ringGeometry args={[1, 1.4, 24]} />
        <meshBasicMaterial
          color={selected ? 0xffdd44 : 0x88ccff}
          transparent
          opacity={active ? 0.9 : 0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function DraftMarker({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.8, 16, 12]} />
        <meshBasicMaterial
          color={0x4ecdc4}
          transparent
          opacity={0.6}
          wireframe
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.2, 0]}>
        <ringGeometry args={[1, 1.4, 24]} />
        <meshBasicMaterial
          color={0x4ecdc4}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export function VenueNodeLayer({
  nodes,
  placement,
  selectedNodeId,
  draftWorldPosition,
  onNodeClick,
}: VenueNodeLayerProps) {
  if (!placement) return null;

  return (
    <group>
      {nodes.map((node) => {
        const pos = nodeToWorld(node.posX, node.posY, node.posZ, placement);
        const color = NODE_TYPE_COLORS[node.nodeType] ?? 0x95a5a6;
        return (
          <VenueMarker
            key={node.id}
            position={pos}
            onClick={() => onNodeClick(node)}
            selected={selectedNodeId === node.id}
            active={node.isActive}
            color={color}
          />
        );
      })}
      {draftWorldPosition && <DraftMarker position={draftWorldPosition} />}
    </group>
  );
}
