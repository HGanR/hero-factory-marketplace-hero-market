"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { buildApexExterior } from "@/lib/troo-world/apex/ApexExterior";
import { buildHarborviewExterior } from "@/lib/troo-world/harborview/HarborviewExterior";
import { buildMeetingNodeGizmo } from "@/lib/troo-world/meeting-node/MeetingNodeModel";

export interface Placement {
  id: string;
  assetId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  ownerLayer?: string;
}

interface ChunkData {
  chunkKey: string;
  placementsJson: unknown;
}

export type AssetMap = Record<string, { modelUrl?: string; category?: string }>;

interface WorldPlacementLayerProps {
  chunks: ChunkData[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  assetMap?: AssetMap;
}

function resolveModelUrl(url: string | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  if (u.startsWith("procedural:")) return null;
  if (u.startsWith("/")) return window.location.origin + u;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return null;
}

function isProceduralUrl(url: string | undefined): string | null {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  if (u.startsWith("procedural:")) return u;
  return null;
}

function ProceduralPlacement({
  modelUrl,
  placement,
  isSelected,
  onSelect,
}: {
  modelUrl: string;
  placement: Placement;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const model = useMemo(() => {
    const key = modelUrl.toLowerCase();
    let built: THREE.Group;
    if (key.includes("apex")) {
      built = buildApexExterior();
    } else if (key.includes("harborview")) {
      built = buildHarborviewExterior();
    } else if (key.includes("meeting_node") || key.includes("corporate_meeting")) {
      built = buildMeetingNodeGizmo();
    } else {
      built = new THREE.Group();
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(2, 2, 2),
        new THREE.MeshLambertMaterial({ color: 0x5aaa35 })
      );
      built.add(mesh);
    }
    return built.clone();
  }, [modelUrl]);

  return (
    <group
      position={placement.position}
      rotation={placement.rotation}
      scale={placement.scale}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      <primitive object={model} />
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 0]}>
          <ringGeometry args={[1.2, 1.5, 32]} />
          <meshBasicMaterial color={0xffdd44} transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

function PlacementModel({ url }: { url: string }) {
  const gltf = useGLTF(url);
  return <primitive object={gltf.scene.clone()} />;
}

function PlacementPlaceholder({
  placement,
  isSelected,
  onSelect,
  category,
}: {
  placement: Placement;
  isSelected?: boolean;
  onSelect?: () => void;
  category?: string;
}) {
  const [x, y, z] = placement.position;
  const [sx = 1, sy = 1, sz = 1] = placement.scale;
  const [rx, ry, rz] = placement.rotation;
  const color =
    category === "building" ? 0x3a7bd5 : category === "meeting_node" ? 0x10b981 : 0x5aaa35;
  const size = category === "building" ? [4, 6, 4] : category === "meeting_node" ? [1.5, 0.3, 1.5] : [1.5, 1.5, 1.5];

  return (
    <group position={[x, y, z]} rotation={[rx, ry, rz]} scale={[sx, sy, sz]}>
      <mesh
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.();
        }}
      >
        <boxGeometry args={size as [number, number, number]} />
        <meshLambertMaterial color={color} />
      </mesh>
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, (size[1] as number) * 0.6, 0]}>
          <ringGeometry args={[1.2, 1.5, 32]} />
          <meshBasicMaterial color={0xffdd44} transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

export function WorldPlacementLayer({ chunks, selectedId, onSelect, assetMap = {} }: WorldPlacementLayerProps) {
  const placements: Placement[] = [];
  for (const chunk of chunks) {
    const raw = chunk.placementsJson;
    if (Array.isArray(raw)) {
      for (const p of raw) {
        if (p && typeof p === "object" && Array.isArray(p.position)) {
          placements.push({
            id: p.id ?? `obj-${chunk.chunkKey}-${placements.length}`,
            assetId: p.assetId ?? "unknown",
            position: p.position,
            rotation: p.rotation ?? [0, 0, 0],
            scale: p.scale ?? [1, 1, 1],
            ownerLayer: p.ownerLayer ?? "user",
          });
        }
      }
    }
  }

  return (
    <group>
      {placements.map((p) => {
        const asset = assetMap[p.assetId];
        const modelUrl = asset?.modelUrl;
        const glbUrl = resolveModelUrl(modelUrl);
        const proceduralUrl = isProceduralUrl(modelUrl);
        const category = asset?.category;

        if (glbUrl) {
          return (
            <group
              key={p.id}
              position={p.position}
              rotation={p.rotation}
              scale={p.scale}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(p.id);
              }}
            >
              <PlacementModel url={glbUrl} />
              {selectedId === p.id && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 0]}>
                  <ringGeometry args={[1.2, 1.5, 32]} />
                  <meshBasicMaterial color={0xffdd44} transparent opacity={0.9} side={THREE.DoubleSide} />
                </mesh>
              )}
            </group>
          );
        }

        if (proceduralUrl) {
          return (
            <ProceduralPlacement
              key={p.id}
              modelUrl={proceduralUrl}
              placement={p}
              isSelected={selectedId === p.id}
              onSelect={onSelect ? () => onSelect(p.id) : undefined}
            />
          );
        }

        return (
          <PlacementPlaceholder
            key={p.id}
            placement={p}
            isSelected={selectedId === p.id}
            onSelect={onSelect ? () => onSelect(p.id) : undefined}
            category={category}
          />
        );
      })}
    </group>
  );
}
