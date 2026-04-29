"use client";

import * as THREE from "three";

export interface CommerceNode {
  id: string;
  worldId: string;
  ownerId: number;
  nodeType: string;
  placementJson: unknown;
  assetId?: string;
  title: string;
  description?: string;
  agentId?: string;
  entityId?: string;
  priceToken?: number;
  priceUSD?: number;
  revenueShare?: number;
  status: string;
}

interface CommerceNodeLayerProps {
  nodes: CommerceNode[];
  onNodeClick?: (node: CommerceNode) => void;
  /** When true, show all nodes (including draft/paused). Default: only active. */
  showAll?: boolean;
  /** ID of selected node (for editor highlight) */
  selectedId?: string | null;
  /** Node IDs with recent activity — show warm glow */
  activeNodeIds?: Set<string>;
}

const NODE_TYPE_COLORS: Record<string, number> = {
  store: 0xe67e22,
  service: 0x3498db,
  consultation: 0x9b59b6,
  ad_space: 0xf1c40f,
  product_display: 0x1abc9c,
  event_space: 0xe74c3c,
  course: 0x2ecc71,
  npc_service: 0x8e44ad,
};

function NodeMarker({
  node,
  onClick,
  selected,
  active,
}: {
  node: CommerceNode;
  onClick?: () => void;
  selected?: boolean;
  active?: boolean;
}) {
  const placement = node.placementJson as { position?: number[]; rotation?: number[]; scale?: number[] };
  const pos = placement?.position ?? [0, 0, 0];
  const rot = placement?.rotation ?? [0, 0, 0];
  const scale = placement?.scale ?? [1, 1, 1];
  const color = NODE_TYPE_COLORS[node.nodeType] ?? 0x95a5a6;
  const emissive = selected ? 0x224466 : active ? 0x4ecdc4 : 0;
  const emissiveIntensity = selected ? 0.4 : active ? 0.5 : 0;

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
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.5, 2.5, 2.5]} />
        <meshLambertMaterial color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.4, 0]}>
        <ringGeometry args={[1.4, 1.8, 24]} />
        <meshBasicMaterial
          color={0xffdd44}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export function CommerceNodeLayer({ nodes, onNodeClick, showAll, selectedId, activeNodeIds }: CommerceNodeLayerProps) {
  const visibleNodes = showAll ? nodes : nodes.filter((n) => n.status === "active");

  return (
    <group>
      {visibleNodes.map((node) => (
        <NodeMarker
          key={node.id}
          node={node}
          onClick={onNodeClick ? () => onNodeClick(node) : undefined}
          selected={selectedId === node.id}
          active={activeNodeIds?.has(node.id)}
        />
      ))}
    </group>
  );
}
