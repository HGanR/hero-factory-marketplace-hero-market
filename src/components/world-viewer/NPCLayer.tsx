"use client";

export interface NPCPosition {
  id: string;
  agentId: string;
  placementJson: unknown;
  role?: string;
}

interface NPCLayerProps {
  npcs: NPCPosition[];
}

function NPCMarker({ npc }: { npc: NPCPosition }) {
  const raw = npc.placementJson;
  const pos =
    raw && typeof raw === "object" && "position" in raw && Array.isArray((raw as any).position)
      ? (raw as { position: [number, number, number] }).position
      : [0, 0, 0];
  const [x, y, z] = pos;

  return (
    <group position={[x, y, z]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.3, 0.35, 1.2, 8]} />
        <meshLambertMaterial color={0x5a9fd4} />
      </mesh>
    </group>
  );
}

export function NPCLayer({ npcs }: NPCLayerProps) {
  return (
    <group>
      {npcs.map((n) => (
        <NPCMarker key={n.id} npc={n} />
      ))}
    </group>
  );
}
