/**
 * World editor — /worlds/[worldId]/edit
 * User-layer editor only. Owner can place owned assets, save draft, publish.
 * Reuses: TerrainLayer, PlatformZoneLayer, WorldPlacementLayer, NPCLayer.
 * Editor-only: OwnedAssetLibrary, DraftSaveBar, placement/selection/delete.
 */
"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAccount, useSignMessage } from "wagmi";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { TerrainLayer } from "@/components/world-viewer/TerrainLayer";
import { PlatformZoneLayer, type PlatformZone } from "@/components/world-viewer/PlatformZoneLayer";
import { WorldPlacementLayer } from "@/components/world-viewer/WorldPlacementLayer";
import { NPCLayer, type NPCPosition } from "@/components/world-viewer/NPCLayer";
import { OwnedAssetLibrary } from "@/components/world-editor/OwnedAssetLibrary";
import { DraftSaveBar } from "@/components/world-editor/DraftSaveBar";
import { EditorNavBar, type EditorNavTab } from "@/components/world-editor/EditorNavBar";
import { CommerceEditorPanel, type CommerceNode } from "@/components/world-editor/CommerceEditorPanel";
import { CommerceCreateModal } from "@/components/world-editor/CommerceCreateModal";
import { LinksEditorPanel, type WorldLink } from "@/components/world-editor/LinksEditorPanel";
import { LinkCreateModal } from "@/components/world-editor/LinkCreateModal";
import { VenueInteriorNodePanel } from "@/components/world-editor/VenueInteriorNodePanel";
import { VenueNodeLayer } from "@/components/world-editor/VenueNodeLayer";
import { CommerceNodeLayer } from "@/components/world-viewer/CommerceNodeLayer";
import type { VenueInteriorNode } from "@/types/venue-nodes";
import { worldToNode } from "@/lib/world-editor/venue-node-transforms";
import { WorldLinksLayer } from "@/components/world-viewer/WorldLinksLayer";
import { getWorldEditMessage } from "@/lib/world-wallet-auth-client";
import {
  chunksToPlacements,
  placementsToChunks,
  type Placement,
} from "@/lib/world-engine/chunk-utils";
import { isInReservedZone } from "@/lib/world-engine/reserved-zone";
import { terrainHeight } from "@/lib/world-engine/terrain";

// ─── Sky & environment ─────────────────────────────────────────────────────
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

// ─── Editor scene ───────────────────────────────────────────────────────────
interface EditorSceneProps {
  terrainSeed: number;
  zones: PlatformZone[];
  placements: Placement[];
  commerceNodes: CommerceNode[];
  venueNodes: VenueInteriorNode[];
  selectedVenuePlacement: Placement | null;
  selectedVenueNodeId: string | null;
  draftVenueNodePosition: [number, number, number] | null;
  worldLinks: WorldLink[];
  npcs: NPCPosition[];
  selectedId: string | null;
  selectedCommerceId: string | null;
  assetMap: Record<string, { modelUrl?: string; category?: string }>;
  onTerrainClick: (x: number, y: number, z: number) => void;
  onPlacementSelect: (id: string) => void;
  onCommerceNodeSelect: (id: string) => void;
  onVenueNodeSelect: (node: VenueInteriorNode) => void;
}

function EditorScene({
  terrainSeed,
  zones,
  placements,
  commerceNodes,
  venueNodes,
  selectedVenuePlacement,
  selectedVenueNodeId,
  draftVenueNodePosition,
  worldLinks,
  npcs,
  selectedId,
  selectedCommerceId,
  assetMap,
  onTerrainClick,
  onPlacementSelect,
  onCommerceNodeSelect,
  onVenueNodeSelect,
}: EditorSceneProps) {
  const chunks = placementsToChunks(placements);
  const chunksData = chunks.map((c) => ({ chunkKey: c.chunkKey, placementsJson: c.placementsJson }));

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

      <TerrainLayer terrainSeed={terrainSeed} onTerrainClick={onTerrainClick} />

      <PlatformZoneLayer zones={zones} />
      <WorldPlacementLayer
        chunks={chunksData}
        selectedId={selectedId}
        onSelect={onPlacementSelect}
        assetMap={assetMap}
      />
      <CommerceNodeLayer
        nodes={commerceNodes}
        onNodeClick={(n) => onCommerceNodeSelect(n.id)}
        showAll
        selectedId={selectedCommerceId}
      />
      <VenueNodeLayer
        nodes={venueNodes}
        placement={selectedVenuePlacement}
        selectedNodeId={selectedVenueNodeId}
        draftWorldPosition={draftVenueNodePosition}
        onNodeClick={onVenueNodeSelect}
      />
      <WorldLinksLayer links={worldLinks} />
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

// ─── Page ───────────────────────────────────────────────────────────────────
export default function WorldEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { address: walletAddress } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const worldId = typeof params.worldId === "string" ? params.worldId : "";

  const authHeaders = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (walletAddress) h["X-Wallet-Address"] = walletAddress;
    return h;
  }, [walletAddress]);

  const authHeadersWithSign = useCallback(async () => {
    const h = authHeaders();
    if (walletAddress) {
      try {
        const message = getWorldEditMessage(worldId);
        const sig = await signMessageAsync({ message });
        h["X-Wallet-Signature"] = sig;
        h["X-Wallet-Message"] = message;
      } catch {
        // Signing failed or user rejected
      }
    }
    return h;
  }, [authHeaders, walletAddress, worldId, signMessageAsync]);

  const [world, setWorld] = useState<{
    id: string;
    name: string;
    ownerId: number;
    terrainSeed: number;
    ownerWallet?: string;
    visibility: string;
    status: string;
  } | null>(null);
  const [linkingWallet, setLinkingWallet] = useState(false);
  const [data, setData] = useState<{
    world: { terrainSeed: number };
    chunks: Array<{ chunkKey: string; placementsJson: unknown }>;
    reservedZones: Array<{ boundsJson: unknown }>;
  } | null>(null);
  const [zones, setZones] = useState<PlatformZone[]>([]);
  const [commerceNodes, setCommerceNodes] = useState<CommerceNode[]>([]);
  const [worldLinks, setWorldLinks] = useState<WorldLink[]>([]);
  const [npcs, setNpcs] = useState<NPCPosition[]>([]);
  const [ownedAssets, setOwnedAssets] = useState<
    Array<{ id: string; slug: string; name: string; category: string; modelUrl?: string }>
  >([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [venueNodes, setVenueNodes] = useState<VenueInteriorNode[]>([]);
  const [venueNodesLoading, setVenueNodesLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCommerceId, setSelectedCommerceId] = useState<string | null>(null);
  const [selectedVenueNodeId, setSelectedVenueNodeId] = useState<string | null>(null);
  const [placingVenueNode, setPlacingVenueNode] = useState(false);
  const [movingVenueNodeId, setMovingVenueNodeId] = useState<string | null>(null);
  const [pendingVenueNodeWorldPosition, setPendingVenueNodeWorldPosition] = useState<
    [number, number, number] | null
  >(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [editorNavTab, setEditorNavTab] = useState<EditorNavTab>(null);
  const [addingCommerce, setAddingCommerce] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [pendingCommercePosition, setPendingCommercePosition] = useState<
    [number, number, number] | null
  >(null);
  const [pendingLinkPosition, setPendingLinkPosition] = useState<
    [number, number, number] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const writeInFlight = useRef(false);
  const [publishing, setPublishing] = useState(false);
  const lastSavedPlacements = useRef<Placement[]>([]);

  const ownedAssetIds = new Set(ownedAssets.map((a) => a.id));
  const hasUnsavedChanges =
    placements.length !== lastSavedPlacements.current.length ||
    JSON.stringify(placements) !== JSON.stringify(lastSavedPlacements.current);

  const selectedPlacement = placements.find((p) => p.id === selectedId) ?? null;
  const selectedAsset = selectedPlacement
    ? ownedAssets.find((a) => a.id === selectedPlacement.assetId) ?? null
    : null;
  const isVenuePlacement =
    selectedPlacement &&
    selectedAsset &&
    selectedAsset.category === "venue";

  const fetchAll = useCallback(async () => {
    if (!worldId) {
      setError("Invalid world ID");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const headers = authHeaders();
      const [worldRes, dataRes, zoneRes, commerceRes, linksRes, npcRes, assetsRes] = await Promise.all([
        fetch(`/api/worlds/${worldId}`, { credentials: "include", headers }),
        fetch(`/api/worlds/${worldId}/data`, { credentials: "include" }),
        fetch("/api/worlds/platform-zone"),
        fetch(`/api/worlds/${worldId}/commerce`, { credentials: "include" }),
        fetch(`/api/worlds/${worldId}/links`, { credentials: "include" }),
        fetch(`/api/worlds/${worldId}/npcs`),
        fetch("/api/world-assets/me", { credentials: "include" }),
      ]);

      if (!worldRes.ok) {
        if (worldRes.status === 404) setError("World not found");
        else if (worldRes.status === 401) {
          setError("Please sign in to edit");
          router.push(`/worlds/${worldId}`);
          return;
        } else setError("Failed to load world");
        setLoading(false);
        return;
      }

      const worldJson = await worldRes.json();
      const w = worldJson.world;
      if (!w) {
        setError("World not found");
        setLoading(false);
        return;
      }

      if (!w.canEdit) {
        setError("You can only edit your own worlds");
        router.push(`/worlds/${worldId}`);
        return;
      }

      setWorld({
        id: w.id,
        name: w.name,
        ownerId: w.ownerId,
        terrainSeed: w.terrainSeed ?? 42,
        ownerWallet: w.ownerWallet,
        visibility: w.visibility,
        status: w.status,
      });

      if (!dataRes.ok) {
        throw new Error("Your saved world could not be loaded. Reopen the editor to retry; existing placements have been preserved.");
      } else {
        const dataJson = await dataRes.json();
        setData({
          world: dataJson.world ?? { terrainSeed: w.terrainSeed ?? 42 },
          chunks: dataJson.chunks ?? [],
          reservedZones: dataJson.reservedZones ?? [],
        });
      }

      if (zoneRes.ok) {
        const zoneJson = await zoneRes.json();
        setZones(zoneJson.zones ?? []);
      } else setZones([]);

      if (commerceRes.ok) {
        const commerceJson = await commerceRes.json();
        setCommerceNodes(commerceJson.nodes ?? []);
      } else setCommerceNodes([]);

      if (linksRes.ok) {
        const linksJson = await linksRes.json();
        setWorldLinks(linksJson.links ?? []);
      } else setWorldLinks([]);

      if (npcRes.ok) {
        const npcJson = await npcRes.json();
        setNpcs(npcJson.npcs ?? []);
      } else setNpcs([]);

      if (assetsRes.ok) {
        const assetsJson = await assetsRes.json();
        setOwnedAssets(
          (assetsJson.assets ?? []).map(
            (a: { id: string; slug?: string; name: string; category?: string; modelUrl?: string }) => ({
              id: a.id,
              slug: a.slug ?? a.id,
              name: a.name,
              category: a.category ?? "asset",
              modelUrl: a.modelUrl,
            })
          )
        );
      } else setOwnedAssets([]);
    } catch (e) {
      console.error("[WorldEditor] Fetch error", e);
      setError(e instanceof Error ? e.message : "Failed to load editor");
    } finally {
      setLoading(false);
    }
  }, [worldId, router, authHeaders]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (data?.chunks) {
      const p = chunksToPlacements(data.chunks);
      setPlacements(p);
      lastSavedPlacements.current = p;
    }
  }, [data?.chunks]);

  const refreshCommerce = useCallback(async () => {
    if (!worldId) return;
    try {
      const res = await fetch(`/api/worlds/${worldId}/commerce`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setCommerceNodes(json.nodes ?? []);
      }
    } catch {
      // ignore
    }
  }, [worldId]);

  const refreshLinks = useCallback(async () => {
    if (!worldId) return;
    try {
      const res = await fetch(`/api/worlds/${worldId}/links`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        setWorldLinks(json.links ?? []);
      }
    } catch {
      // ignore
    }
  }, [worldId]);

  const refreshVenueNodes = useCallback(async () => {
    if (!worldId || !selectedId) return;
    setVenueNodesLoading(true);
    try {
      const res = await fetch(
        `/api/worlds/${worldId}/venue-nodes?placementId=${encodeURIComponent(selectedId)}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const json = await res.json();
        setVenueNodes(json.nodes ?? []);
      } else {
        setVenueNodes([]);
      }
    } catch {
      setVenueNodes([]);
    } finally {
      setVenueNodesLoading(false);
    }
  }, [worldId, selectedId]);

  useEffect(() => {
    if (selectedId && isVenuePlacement) {
      refreshVenueNodes();
    } else {
      setVenueNodes([]);
      setVenueNodesLoading(false);
    }
  }, [selectedId, isVenuePlacement, refreshVenueNodes]);

  const handleTerrainClick = useCallback(
    (x: number, y: number, z: number) => {
      const selectedPlacement = placements.find((p) => p.id === selectedId) ?? null;
      if (placingVenueNode && selectedPlacement) {
        const seed = data?.world?.terrainSeed ?? world?.terrainSeed ?? 42;
        const h = terrainHeight(x, z, seed);
        setPendingVenueNodeWorldPosition([x, h, z]);
        setPlacingVenueNode(false);
        return;
      }
      if (movingVenueNodeId && selectedPlacement) {
        const seed = data?.world?.terrainSeed ?? world?.terrainSeed ?? 42;
        const h = terrainHeight(x, z, seed);
        const { posX, posY, posZ } = worldToNode(x, h, z, selectedPlacement);
        fetch(`/api/worlds/${worldId}/venue-nodes/${movingVenueNodeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ posX, posY, posZ }),
        }).then((res) => {
          if (res.ok) refreshVenueNodes();
        });
        setMovingVenueNodeId(null);
        return;
      }
      if (addingCommerce) {
        const seed = data?.world?.terrainSeed ?? world?.terrainSeed ?? 42;
        const reservedZones = data?.reservedZones ?? [];
        if (isInReservedZone(x, z, reservedZones)) return;
        const h = terrainHeight(x, z, seed);
        setPendingCommercePosition([x, h, z]);
        return;
      }
      if (addingLink) {
        const seed = data?.world?.terrainSeed ?? world?.terrainSeed ?? 42;
        const reservedZones = data?.reservedZones ?? [];
        if (isInReservedZone(x, z, reservedZones)) return;
        const h = terrainHeight(x, z, seed);
        setPendingLinkPosition([x, h, z]);
        return;
      }
      if (selectedCommerceId) {
        const seed = data?.world?.terrainSeed ?? world?.terrainSeed ?? 42;
        const reservedZones = data?.reservedZones ?? [];
        if (isInReservedZone(x, z, reservedZones)) return;
        const h = terrainHeight(x, z, seed);
        const node = commerceNodes.find((n) => n.id === selectedCommerceId);
        const commercePlacement = (node?.placementJson as { rotation?: number[]; scale?: number[] }) ?? {};
        const placementJson = {
          position: [x, h, z],
          rotation: commercePlacement.rotation ?? [0, 0, 0],
          scale: commercePlacement.scale ?? [1, 1, 1],
        };
        fetch(`/api/worlds/${worldId}/commerce/${selectedCommerceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ placementJson }),
        }).then((res) => {
          if (res.ok) refreshCommerce();
        });
        return;
      }
      if (!selectedAssetId || !ownedAssetIds.has(selectedAssetId)) {
        setSelectedId(null);
        return;
      }
      const seed = data?.world?.terrainSeed ?? world?.terrainSeed ?? 42;
      const reservedZones = data?.reservedZones ?? [];
      if (isInReservedZone(x, z, reservedZones)) {
        setSelectedId(null);
        return;
      }
      const h = terrainHeight(x, z, seed);
      const id = crypto.randomUUID();
      const newPlacement: Placement = {
        id,
        assetId: selectedAssetId,
        position: [x, h, z],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        ownerLayer: "user",
      };
      setPlacements((prev) => [...prev, newPlacement]);
      setSelectedId(id);
    },
    [
      placingVenueNode,
      movingVenueNodeId,
      placements,
      selectedId,
      worldId,
      refreshVenueNodes,
      addingCommerce,
      addingLink,
      selectedCommerceId,
      commerceNodes,
      refreshCommerce,
      selectedAssetId,
      ownedAssetIds,
      data?.world?.terrainSeed,
      data?.reservedZones,
      world?.terrainSeed,
    ]
  );

  const handlePlacementSelect = useCallback((id: string) => {
    setSelectedId(id);
    setSelectedCommerceId(null);
    setSelectedVenueNodeId(null);
  }, []);

  const handleCommerceNodeSelect = useCallback((id: string) => {
    setSelectedCommerceId(id);
    setSelectedId(null);
    setSelectedVenueNodeId(null);
  }, []);

  const handleVenueNodeSelect = useCallback((node: VenueInteriorNode) => {
    setSelectedVenueNodeId(node.id);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (selectedVenueNodeId) {
          fetch(`/api/worlds/${worldId}/venue-nodes/${selectedVenueNodeId}`, {
            method: "DELETE",
            credentials: "include",
          }).then((res) => {
            if (res.ok) refreshVenueNodes();
          });
          setSelectedVenueNodeId(null);
        } else if (selectedId) {
          setPlacements((prev) => prev.filter((p) => p.id !== selectedId));
          setSelectedId(null);
        } else if (selectedCommerceId) {
          fetch(`/api/worlds/${worldId}/commerce/${selectedCommerceId}`, {
            method: "DELETE",
            credentials: "include",
          }).then((res) => {
            if (res.ok) refreshCommerce();
          });
          setSelectedCommerceId(null);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, selectedCommerceId, selectedVenueNodeId, worldId, refreshCommerce, refreshVenueNodes]);

  useEffect(() => {
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      if (hasUnsavedChanges || saving || publishing) { event.preventDefault(); event.returnValue = ""; }
    }
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [hasUnsavedChanges, saving, publishing]);

  // Capture exactly the snapshot acknowledged by the server. Edits made while saving remain dirty.
  const saveSnapshot = useCallback(async () => {
    const snapshot = structuredClone(placements);
    const res = await fetch(`/api/worlds/${worldId}/draft`, {
      method: "PUT", headers: await authHeadersWithSign(), credentials: "include",
      body: JSON.stringify({ chunks: placementsToChunks(snapshot) }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.success) throw new Error(result.error ?? "World save was not confirmed. Please retry.");
    lastSavedPlacements.current = snapshot;
    setSaveMessage("My world saved to my account.");
  }, [worldId, placements, authHeadersWithSign]);

  const handleSaveDraft = useCallback(async () => {
    if (!worldId || writeInFlight.current) return;
    writeInFlight.current = true; setSaving(true);
    try { await saveSnapshot(); }
    catch (error) { setSaveMessage(error instanceof Error ? error.message : "Save failed. Please retry."); }
    finally { writeInFlight.current = false; setSaving(false); }
  }, [worldId, saveSnapshot]);

  const handlePublish = useCallback(async () => {
    if (!worldId || writeInFlight.current) return;
    writeInFlight.current = true; setPublishing(true);
    try {
      // Never publish a stale draft when the user has just placed or moved an asset.
      await saveSnapshot();
      const res = await fetch(`/api/worlds/${worldId}/publish`, {
        method: "POST", credentials: "include", headers: await authHeadersWithSign(),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) throw new Error(result.error ?? "Publication was not confirmed. Your saved world is preserved.");
      setWorld((previous) => previous ? { ...previous, status: "published" } : previous);
      setSaveMessage("World saved and published. Visitor access follows your visibility setting.");
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : "Publication failed. Please retry."); }
    finally { writeInFlight.current = false; setPublishing(false); }
  }, [worldId, saveSnapshot, authHeadersWithSign]);

  const handleVisibilityChange = useCallback(async (visibility: string) => {
    if (writeInFlight.current) return;
    writeInFlight.current = true; setSaving(true);
    try {
      const res = await fetch(`/api/worlds/${worldId}`, { method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visibility }) });
      if (!res.ok) throw new Error("Visitor access could not be saved. Please retry.");
      setWorld((previous) => previous ? { ...previous, visibility } : previous);
      setSaveMessage("Visitor access saved. Publish your world when it is ready for visitors.");
    } catch (error) { setSaveMessage(error instanceof Error ? error.message : "Could not save visitor access."); }
    finally { writeInFlight.current = false; setSaving(false); }
  }, [worldId]);

  const refreshOwnedAssets = useCallback(async () => {
    const res = await fetch("/api/world-assets/me", { credentials: "include" });
    if (!res.ok) { setSaveMessage("Asset library could not be refreshed. Your world edits are preserved."); return; }
    const result = await res.json();
    setOwnedAssets(result.assets ?? []);
  }, []);

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
            Loading editor...
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
  const reservedZones = data?.reservedZones ?? [];

  const assetMap = Object.fromEntries(
    ownedAssets.map((a) => [a.id, { modelUrl: a.modelUrl, category: a.category }])
  );

  return (
    <div
      style={{
        width: "100%",
        flex: 1,
        minHeight: 0,
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
          <EditorScene
            terrainSeed={terrainSeed}
            zones={zones}
            placements={placements}
            commerceNodes={commerceNodes}
            venueNodes={venueNodes}
            selectedVenuePlacement={isVenuePlacement ? selectedPlacement : null}
            selectedVenueNodeId={selectedVenueNodeId}
            draftVenueNodePosition={pendingVenueNodeWorldPosition}
            worldLinks={worldLinks}
            npcs={npcs}
            selectedId={selectedId}
            selectedCommerceId={selectedCommerceId}
            assetMap={assetMap}
            onTerrainClick={handleTerrainClick}
            onPlacementSelect={handlePlacementSelect}
            onCommerceNodeSelect={handleCommerceNodeSelect}
            onVenueNodeSelect={handleVenueNodeSelect}
          />
        </Suspense>
      </Canvas>

      <EditorNavBar
        activeTab={editorNavTab}
        onTabChange={setEditorNavTab}
        assetsCount={ownedAssets.length}
        commerceCount={commerceNodes.length}
        portalsCount={worldLinks.length}
        panelContent={
          editorNavTab === "assets" ? (
            <OwnedAssetLibrary
              assets={ownedAssets}
              selectedAssetId={selectedAssetId}
              onSelectAsset={setSelectedAssetId}
              loading={false}
              onAssetPurchased={() => { refreshOwnedAssets().catch(() => setSaveMessage("Asset library unavailable. Your world edits are preserved.")); }}
              embedded
            />
          ) : editorNavTab === "commerce" ? (
            <CommerceEditorPanel
              worldId={worldId}
              nodes={commerceNodes}
              selectedNodeId={selectedCommerceId}
              addingCommerce={addingCommerce}
              onSelectNode={setSelectedCommerceId}
              onAddingCommerce={setAddingCommerce}
              onNodesChange={refreshCommerce}
              embedded
            />
          ) : editorNavTab === "portals" ? (
            <LinksEditorPanel
              worldId={worldId}
              links={worldLinks}
              addingLink={addingLink}
              onSelectLink={() => {}}
              onAddingLink={setAddingLink}
              onLinksChange={refreshLinks}
              embedded
            />
          ) : editorNavTab === "venue" ? (
            isVenuePlacement && selectedPlacement ? (
              <VenueInteriorNodePanel
                worldId={worldId}
                placementId={selectedPlacement.id}
                placement={selectedPlacement}
                placementSummary={{
                  assetId: selectedPlacement.assetId,
                  position: selectedPlacement.position,
                }}
                assetSummary={{
                  name: selectedAsset?.name,
                  category: selectedAsset?.category,
                }}
                nodes={venueNodes}
                loading={venueNodesLoading}
                selectedVenueNodeId={selectedVenueNodeId}
                onSelectVenueNode={setSelectedVenueNodeId}
                pendingVenueNodeWorldPosition={pendingVenueNodeWorldPosition}
                onClearPendingPosition={() => setPendingVenueNodeWorldPosition(null)}
                placingVenueNode={placingVenueNode}
                onPlaceVisually={() => setPlacingVenueNode(true)}
                onCancelPlaceVisually={() => setPlacingVenueNode(false)}
                movingVenueNodeId={movingVenueNodeId}
                onMoveNode={(n) => setMovingVenueNodeId(n.id)}
                onCancelMoveNode={() => setMovingVenueNodeId(null)}
                onRefresh={refreshVenueNodes}
                embedded
              />
            ) : (
              <div
                style={{
                  padding: 24,
                  color: "rgba(224,244,255,0.6)",
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                Select a venue in the scene to manage interior nodes.
              </div>
            )
          ) : null
        }
      />

      {pendingCommercePosition && (
        <CommerceCreateModal
          worldId={worldId}
          position={pendingCommercePosition}
          onCreated={() => {
            setPendingCommercePosition(null);
            setAddingCommerce(false);
            refreshCommerce();
          }}
          onCancel={() => setPendingCommercePosition(null)}
        />
      )}

      {pendingLinkPosition && (
        <LinkCreateModal
          worldId={worldId}
          position={pendingLinkPosition}
          onCreated={() => {
            setPendingLinkPosition(null);
            setAddingLink(false);
            refreshLinks();
          }}
          onCancel={() => setPendingLinkPosition(null)}
        />
      )}

      <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 10 }}>
        {world && !world.ownerWallet && (
          walletAddress ? (
            /^0x[a-fA-F0-9]{40}$/.test(walletAddress) ? (
              <button
                type="button"
                onClick={async () => {
                  setLinkingWallet(true);
                  try {
                    const r = await fetch(`/api/worlds/${worldId}`, {
                      method: "PATCH",
                      headers: authHeaders(),
                      credentials: "include",
                      body: JSON.stringify({ ownerWallet: walletAddress }),
                    });
                    if (r.ok) {
                      setWorld((prev) => (prev ? { ...prev, ownerWallet: walletAddress } : prev));
                      fetchAll();
                    }
                  } finally {
                    setLinkingWallet(false);
                  }
                }}
                disabled={linkingWallet}
                style={{
                  padding: "4px 12px",
                  fontSize: 11,
                  background: "rgba(16,185,129,0.2)",
                  border: "1px solid rgba(16,185,129,0.5)",
                  borderRadius: 6,
                  color: "#6ee7b7",
                  cursor: linkingWallet ? "wait" : "pointer",
                }}
              >
                {linkingWallet ? "Linking..." : "Link wallet for NFT ownership"}
              </button>
            ) : (
              <span style={{ fontSize: 11, color: "rgba(248,250,252,0.7)" }}>
                Connect an EVM wallet (MetaMask) for NFT ownership
              </span>
            )
          ) : null
        )}
        <DraftSaveBar
          worldId={worldId}
          worldName={world.name}
          visibility={world.visibility}
          status={world.status}
          message={saveMessage}
          onVisibilityChange={handleVisibilityChange}
          hasUnsavedChanges={hasUnsavedChanges}
          saving={saving}
          publishing={publishing}
          onSaveDraft={handleSaveDraft}
          onPublish={handlePublish}
        />
      </div>


      <div
        style={{
          position: "absolute",
          top: 18,
          right: 18,
          background: "rgba(10,20,40,0.75)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(42,111,189,0.4)",
          borderRadius: 8,
          padding: "6px 14px",
          zIndex: 10,
        }}
      >
        <span style={{ color: "#10b981", fontFamily: "system-ui", fontSize: 12, fontWeight: 600 }}>
          Edit mode • {placements.length} objects • {commerceNodes.length} commerce • {worldLinks.length} portals
        </span>
      </div>
    </div>
  );
}

