/**
 * Shared world viewer — /worlds/[worldId]
 * Fetches world data, platform zone, placements, NPCs.
 * Merges layers: terrain → platform zones → user placements → NPCs.
 * Read-only. Reuses terrain/camera patterns from Troo Town.
 */
"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import type { ActivityPulse } from "@/components/world-viewer/ActivityPulseLayer";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { TerrainLayer } from "@/components/world-viewer/TerrainLayer";
import { PlatformZoneLayer, type PlatformZone } from "@/components/world-viewer/PlatformZoneLayer";
import { WorldPlacementLayer } from "@/components/world-viewer/WorldPlacementLayer";
import { CommerceNodeLayer, type CommerceNode } from "@/components/world-viewer/CommerceNodeLayer";
import { CommercePanel } from "@/components/world-viewer/CommercePanel";
import { NPCLayer, type NPCPosition } from "@/components/world-viewer/NPCLayer";
import { WorldLinksLayer, type WorldLink } from "@/components/world-viewer/WorldLinksLayer";
import { ActivityFeedHUD } from "@/components/world-viewer/ActivityFeedHUD";
import { ActivityPulseLayer } from "@/components/world-viewer/ActivityPulseLayer";
import { useWorldActivityStream } from "@/hooks/useWorldActivityStream";
import { WorldViewerDebug } from "@/components/world-viewer/WorldViewerDebug";

// ─── Sky & environment (from Troo Town) ─────────────────────────────────────
function SkyDome() {
  return (
    <mesh scale={[-400, 400, 400]}>
      <sphereGeometry args={[1, 32, 16]} />
      <meshBasicMaterial side={THREE.BackSide}>
        <primitive
          attach="map"
          object={(() => {
            const c = document.createElement("canvas");
            c.width = 256;
            c.height = 256;
            const ctx = c.getContext("2d")!;
            const g = ctx.createLinearGradient(0, 0, 0, 256);
            g.addColorStop(0, "#5a9fd4");
            g.addColorStop(0.4, "#87ceeb");
            g.addColorStop(0.7, "#b0e2ff");
            g.addColorStop(1, "#d0f0ff");
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, 256, 256);
            return new THREE.CanvasTexture(c);
          })()}
        />
      </meshBasicMaterial>
    </mesh>
  );
}

function DistantHills() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 120, 0, Math.sin(a) * 120]}
            scale={[40, 15, 25]}
          >
            <coneGeometry args={[1, 1, 6]} />
            <meshLambertMaterial color={0x3a6b2a} />
          </mesh>
        );
      })}
    </>
  );
}

// ─── Scene ─────────────────────────────────────────────────────────────────
interface SceneProps {
  terrainSeed: number;
  zones: PlatformZone[];
  chunks: Array<{ chunkKey: string; placementsJson: unknown }>;
  commerceNodes: CommerceNode[];
  worldLinks: WorldLink[];
  activityPulses: ActivityPulse[];
  onPulseComplete: (id: string) => void;
  recentlyActiveNodeIds: Set<string>;
  npcs: NPCPosition[];
  assetMap: Record<string, { modelUrl?: string; category?: string }>;
  onCommerceNodeClick?: (node: CommerceNode) => void;
  onWorldLinkClick?: (link: WorldLink) => void;
  debug: {
    chunkCount: number;
    platformPlacementCount: number;
    userPlacementCount: number;
    commerceNodeCount: number;
    linkCount: number;
    npcCount: number;
  };
}

function Scene({ terrainSeed, zones, chunks, commerceNodes, worldLinks, activityPulses, onPulseComplete, recentlyActiveNodeIds, npcs, assetMap, onCommerceNodeClick, onWorldLinkClick, debug }: SceneProps) {
  const platformCount = zones.reduce((acc, z) => {
    const raw = z.placementsJson;
    return acc + (Array.isArray(raw) ? raw.length : 0);
  }, 0);
  const userCount = chunks.reduce((acc, c) => {
    const raw = c.placementsJson;
    return acc + (Array.isArray(raw) ? raw.length : 0);
  }, 0);

  useEffect(() => {
    console.log("[WorldViewer] Scene loaded", {
      terrainSeed,
      zones: zones.length,
      platformPlacements: platformCount,
      chunks: chunks.length,
      userPlacements: userCount,
      npcs: npcs.length,
    });
  }, [terrainSeed, zones.length, chunks.length, npcs.length, platformCount, userCount]);

  return (
    <>
      <ambientLight intensity={0.6} color={0xd4e8c0} />
      <directionalLight
        position={[60, 80, 40]}
        intensity={1.8}
        color={0xfff4d0}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={300}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[-40, 30, -60]} intensity={0.4} color={0xa0c8e0} />
      <hemisphereLight color={0x87ceeb} groundColor={0x3a6b2a} intensity={0.5} />
      <fog attach="fog" args={["#8ecae6", 100, 240]} />
      <SkyDome />
      <DistantHills />

      {/* 1. Terrain */}
      <TerrainLayer terrainSeed={terrainSeed} />

      {/* 2. Platform global zones */}
      <PlatformZoneLayer zones={zones} />

      {/* 3. User world placements */}
      <WorldPlacementLayer chunks={chunks} assetMap={assetMap} />

      {/* 4. Commerce nodes */}
      <CommerceNodeLayer
        nodes={commerceNodes}
        onNodeClick={onCommerceNodeClick}
        activeNodeIds={recentlyActiveNodeIds}
      />

      {/* 5. World links (portals) */}
      <WorldLinksLayer links={worldLinks} onLinkClick={onWorldLinkClick} />

      {/* 6. Activity pulses (commerce transactions) */}
      <ActivityPulseLayer pulses={activityPulses} onPulseComplete={onPulseComplete} />

      {/* 7. NPC placements */}
      <NPCLayer npcs={npcs} />

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={5}
        maxDistance={180}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.06}
      />
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function WorldViewerPage() {
  const params = useParams();
  const router = useRouter();
  const worldId = typeof params.worldId === "string" ? params.worldId : "";

  const [assetMap, setAssetMap] = useState<Record<string, { modelUrl?: string; category?: string }>>({});

  const [world, setWorld] = useState<{
    id: string;
    name: string;
    description?: string;
    terrainSeed: number;
    biomeType: string;
    status: string;
    canEdit?: boolean;
  } | null>(null);
  const [data, setData] = useState<{
    world: { terrainSeed: number };
    version: { versionType: string } | null;
    chunks: Array<{ chunkKey: string; placementsJson: unknown }>;
    reservedZones: unknown[];
  } | null>(null);
  const [zones, setZones] = useState<PlatformZone[]>([]);
  const [commerceNodes, setCommerceNodes] = useState<CommerceNode[]>([]);
  const [worldLinks, setWorldLinks] = useState<WorldLink[]>([]);
  const [npcs, setNpcs] = useState<NPCPosition[]>([]);
  const [selectedCommerceNode, setSelectedCommerceNode] = useState<CommerceNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(
    typeof window !== "undefined" && window.location.search.includes("debug")
  );

  const { events: activityEvents, connected: activityConnected } = useWorldActivityStream(
    worldId || null,
    !!worldId && !loading && !error
  );

  const [activityPulses, setActivityPulses] = useState<ActivityPulse[]>([]);
  const [recentlyActiveNodeIds, setRecentlyActiveNodeIds] = useState<Set<string>>(new Set());
  const activeNodeTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const processedEventIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const ev of activityEvents) {
      if (processedEventIds.current.has(ev.id)) continue;
      if (ev.eventType !== "commerce_transaction") continue;
      const nodeId = (ev.payload?.nodeId as string) ?? (ev.payload?.node_id as string);
      if (!nodeId) continue;
      const node = commerceNodes.find((n) => n.id === nodeId);
      if (!node) continue;
      const placement = node.placementJson as { position?: number[] } | null;
      const pos = placement?.position ?? [0, 0, 0];
      processedEventIds.current.add(ev.id);
      setActivityPulses((prev) => [
        ...prev,
        {
          id: `pulse-${ev.id}-${Date.now()}`,
          position: [pos[0], pos[1], pos[2]],
          amount: (ev.payload?.amountUSD as number) ?? (ev.payload?.amountToken as number),
          createdAt: Date.now(),
        },
      ]);
      setRecentlyActiveNodeIds((prev) => new Set(prev).add(nodeId));
      activeNodeTimeouts.current.get(nodeId) && clearTimeout(activeNodeTimeouts.current.get(nodeId)!);
      activeNodeTimeouts.current.set(
        nodeId,
        setTimeout(() => {
          setRecentlyActiveNodeIds((prev) => {
            const next = new Set(prev);
            next.delete(nodeId);
            return next;
          });
          activeNodeTimeouts.current.delete(nodeId);
        }, 6000)
      );
    }
  }, [activityEvents, commerceNodes]);

  const handlePulseComplete = useCallback((id: string) => {
    setActivityPulses((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const fetchAll = useCallback(async () => {
    if (!worldId) {
      setError("Invalid world ID");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [worldRes, dataRes, zoneRes, commerceRes, linksRes, npcRes, assetsRes] = await Promise.all([
        fetch(`/api/worlds/${worldId}`),
        fetch(`/api/worlds/${worldId}/data`),
        fetch("/api/worlds/platform-zone"),
        fetch(`/api/worlds/${worldId}/commerce`),
        fetch(`/api/worlds/${worldId}/links`),
        fetch(`/api/worlds/${worldId}/npcs`),
        fetch("/api/world-assets"),
      ]);

      if (!worldRes.ok) {
        if (worldRes.status === 404) setError("World not found");
        else setError("Failed to load world");
        setLoading(false);
        return;
      }

      const worldJson = await worldRes.json();
      setWorld(worldJson.world);

      if (!dataRes.ok) {
        console.warn("[WorldViewer] data fetch failed", dataRes.status);
        setData({
          world: { terrainSeed: worldJson.world?.terrainSeed ?? 42 },
          version: null,
          chunks: [],
          reservedZones: [],
        });
      } else {
        const dataJson = await dataRes.json();
        setData(dataJson);
      }

      if (zoneRes.ok) {
        const zoneJson = await zoneRes.json();
        setZones(zoneJson.zones ?? []);
        console.log("[WorldViewer] Platform zones loaded:", zoneJson.zones?.length ?? 0);
      } else {
        setZones([]);
      }

      if (commerceRes.ok) {
        const commerceJson = await commerceRes.json();
        setCommerceNodes(commerceJson.nodes ?? []);
      } else {
        setCommerceNodes([]);
      }

      if (linksRes.ok) {
        const linksJson = await linksRes.json();
        setWorldLinks(linksJson.links ?? []);
      } else {
        setWorldLinks([]);
      }

      if (npcRes.ok) {
        const npcJson = await npcRes.json();
        setNpcs(npcJson.npcs ?? []);
      } else {
        setNpcs([]);
      }

      if (assetsRes.ok) {
        const assetsJson = await assetsRes.json();
        const map: Record<string, { modelUrl?: string; category?: string }> = {};
        for (const a of assetsJson.assets ?? []) {
          if (a.id) map[a.id] = { modelUrl: a.modelUrl, category: a.category };
        }
        setAssetMap(map);
      } else {
        setAssetMap({});
      }
    } catch (e) {
      console.error("[WorldViewer] Fetch error", e);
      setError("Failed to load world");
    } finally {
      setLoading(false);
    }
  }, [worldId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          background: "#6ab8d4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: "3px solid #10b981",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ color: "#10b981", fontFamily: "system-ui", fontSize: 16, fontWeight: 600 }}>
            Loading world...
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error || !world) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #0a1628 0%, #1a2d4a 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
          fontFamily: "system-ui",
        }}
      >
        <p style={{ color: "#e74c3c", fontSize: 18 }}>{error ?? "World not found"}</p>
        <Link
          href="/worlds"
          style={{
            color: "#5a9fd4",
            textDecoration: "none",
            fontSize: 14,
          }}
        >
          ← Back to World Explorer
        </Link>
      </div>
    );
  }

  const terrainSeed = data?.world?.terrainSeed ?? world.terrainSeed ?? 42;
  const chunks = data?.chunks ?? [];
  const versionType = data?.version?.versionType ?? null;

  const platformPlacementCount = zones.reduce((acc, z) => {
    const raw = z.placementsJson;
    return acc + (Array.isArray(raw) ? raw.length : 0);
  }, 0);
  const userPlacementCount = chunks.reduce((acc, c) => {
    const raw = c.placementsJson;
    return acc + (Array.isArray(raw) ? raw.length : 0);
  }, 0);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#6ab8d4",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Canvas
        shadows
        camera={{ position: [0, 28, 65], fov: 55, near: 0.1, far: 500 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        scene={{ background: new THREE.Color("#6ab8d4") }}
        dpr={[1, 2]}
        style={{ position: "absolute", inset: 0 }}
      >
        <Suspense fallback={null}>
          <Scene
            terrainSeed={terrainSeed}
            zones={zones}
            chunks={chunks}
            commerceNodes={commerceNodes}
            worldLinks={worldLinks}
            activityPulses={activityPulses}
            onPulseComplete={handlePulseComplete}
            recentlyActiveNodeIds={recentlyActiveNodeIds}
            npcs={npcs}
            assetMap={assetMap}
            onCommerceNodeClick={setSelectedCommerceNode}
            onWorldLinkClick={(link) => router.push(`/worlds/${link.toWorldId}`)}
            debug={{
              chunkCount: chunks.length,
              platformPlacementCount,
              userPlacementCount,
              commerceNodeCount: commerceNodes.length,
              linkCount: worldLinks.length,
              npcCount: npcs.length,
            }}
          />
        </Suspense>
      </Canvas>

      {/* HUD */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
        <div style={{ position: "absolute", top: 18, left: 18, pointerEvents: "auto", display: "flex", gap: 8 }}>
          <Link
            href="/worlds"
            style={{
              background: "rgba(10,20,40,0.9)",
              border: "1px solid rgba(6,182,212,0.5)",
              borderRadius: 8,
              padding: "8px 16px",
              color: "#06b6d4",
              fontFamily: "system-ui",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ← Worlds
          </Link>
          {world.canEdit && (
            <Link
              href={`/worlds/${worldId}/edit`}
              style={{
                background: "rgba(42,111,189,0.9)",
                border: "1px solid rgba(42,111,189,0.5)",
                borderRadius: 8,
                padding: "8px 16px",
                color: "#fff",
                fontFamily: "system-ui",
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Edit
            </Link>
          )}
        </div>

        <div
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            background: "rgba(10,20,40,0.75)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(16,185,129,0.4)",
            borderRadius: 8,
            padding: "6px 14px",
          }}
        >
          <span
            style={{
              color: "#10b981",
              fontFamily: "system-ui",
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: 2,
            }}
          >
            {world.name}
          </span>
        </div>

        <ActivityFeedHUD events={activityEvents} connected={activityConnected} />

        <button
          onClick={() => setShowDebug((d) => !d)}
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            pointerEvents: "auto",
            background: "rgba(10,20,40,0.7)",
            border: "1px solid rgba(42,111,189,0.4)",
            borderRadius: 6,
            padding: "4px 10px",
            color: "#88aacc",
            fontSize: 10,
            cursor: "pointer",
          }}
        >
          {showDebug ? "Hide" : "Show"} debug
        </button>
      </div>

      <CommercePanel
        node={selectedCommerceNode}
        onClose={() => setSelectedCommerceNode(null)}
      />

      <WorldViewerDebug
        worldId={worldId}
        versionType={versionType}
        chunkCount={chunks.length}
        platformPlacementCount={platformPlacementCount}
        userPlacementCount={userPlacementCount}
        commerceNodeCount={commerceNodes.length}
        linkCount={worldLinks.length}
        npcCount={npcs.length}
        zoneCount={zones.length}
        show={showDebug}
      />
    </div>
  );
}
