"use client";

/**
 * Troo World — Public view of the saved 3D world.
 * Displays the structure created and saved in the modeling Home.tsx (TrooWorldEditor).
 * Fetches placements + elements from /api/troo-world/* and renders in view-only mode.
 */
import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Placement } from "@/components/troo-world/TrooWorldUnifiedViewer";
import type { WorldElementData } from "@/lib/troo-world/WorldElementSystem";
import { getPlacementsFromStorage } from "@/lib/troo-world/placements-storage";

const TrooWorldUnifiedViewer = dynamic(
  () => import("@/components/troo-world/TrooWorldUnifiedViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-[#0a1020] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-cyan-500 mx-auto mb-4" />
          <p className="text-cyan-400 font-semibold tracking-wider">Loading Troo World</p>
        </div>
      </div>
    ),
  }
);

const DEFAULT_WORLD_ID = "default";

const DEFAULT_PLACEMENTS: Placement[] = [
  { elementKey: "nexus-tower", glbUrl: "/models/nexus-tower/modern_building.glb", posX: -35, posY: 0, posZ: 0, scale: 1, rotY: 0 },
  { elementKey: "meridian-tower", glbUrl: "/models/meridian-tower/meridian_tower.glb", posX: 35, posY: 0, posZ: 0, scale: 1, rotY: 0 },
  { elementKey: "apex-tower", glbUrl: "procedural:apex", posX: 0, posY: 0, posZ: 0, scale: 1, rotY: 0 },
  { elementKey: "harborview-tower", glbUrl: "procedural:harborview", posX: -55, posY: 0, posZ: -55, scale: 1, rotY: 0 },
];

function mapPlacement(p: { elementKey: string; glbUrl: string; posX: number; posY: number; posZ: number; scale: number; rotY: number }): Placement {
  return {
    elementKey: p.elementKey,
    glbUrl: p.glbUrl,
    posX: p.posX,
    posY: p.posY,
    posZ: p.posZ,
    scale: p.scale,
    rotY: p.rotY,
  };
}

function mapElement(e: {
  id: number;
  type: string;
  posX: number;
  posY: number;
  posZ: number;
  rotY: number;
  scale: number;
  colorHex?: number | null;
  color2Hex?: number | null;
  label?: string | null;
  isDefault?: boolean;
}): WorldElementData {
  return {
    id: e.id,
    type: e.type as WorldElementData["type"],
    posX: e.posX,
    posY: e.posY,
    posZ: e.posZ,
    rotY: e.rotY,
    scale: e.scale,
    colorHex: e.colorHex ?? null,
    color2Hex: e.color2Hex ?? null,
    label: e.label ?? null,
    isDefault: e.isDefault ?? false,
  };
}

function TrooWorldLoading() {
  return (
    <div className="fixed inset-0 bg-[#0a1020] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-cyan-500 mx-auto mb-4" />
        <p className="text-cyan-400 font-semibold tracking-wider">Loading Troo World</p>
      </div>
    </div>
  );
}

function TrooWorldPageContent() {
  const searchParams = useSearchParams();
  const [placements, setPlacements] = useState<Placement[] | null>(null);
  const [elements, setElements] = useState<WorldElementData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [walkMode, setWalkMode] = useState(true); // true = first-person walk, false = orbit/top-down

  const building = searchParams?.get("building") as "nexus" | "meridian" | "apex" | "harborview" | undefined;
  const validBuilding = building === "nexus" || building === "meridian" || building === "apex" || building === "harborview" ? building : undefined;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [placeRes, elemRes] = await Promise.all([
          fetch(`/api/troo-world/placements?worldId=${encodeURIComponent(DEFAULT_WORLD_ID)}`, { credentials: "include" }),
          fetch(`/api/troo-world/elements?worldId=${encodeURIComponent(DEFAULT_WORLD_ID)}`, { credentials: "include" }),
        ]);
        if (cancelled) return;

        const placeData = await placeRes.json().catch(() => ({}));
        const elemData = await elemRes.json().catch(() => ({}));

        if (!placeRes.ok) {
          // Fallback: localStorage (saved from modeling), then default layout
          const stored = getPlacementsFromStorage(DEFAULT_WORLD_ID);
          if (stored?.length) {
            setPlacements(stored);
            setError("");
          } else {
            setPlacements(DEFAULT_PLACEMENTS);
            setError("");
          }
          const el = Array.isArray(elemData.elements) ? elemData.elements.map(mapElement) : [];
          setElements(el);
          return;
        }

        const pl = Array.isArray(placeData.placements)
          ? placeData.placements.map(mapPlacement)
          : [];
        const el = Array.isArray(elemData.elements)
          ? elemData.elements.map(mapElement)
          : [];

        setPlacements(pl);
        setElements(el);
      } catch (e) {
        if (!cancelled) {
          const stored = getPlacementsFromStorage(DEFAULT_WORLD_ID);
          if (stored?.length) {
            setPlacements(stored);
            setElements([]);
            setError("");
          } else {
            setError(e instanceof Error ? e.message : "Failed to load");
            setPlacements([]);
            setElements([]);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a1020] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-cyan-500 mx-auto mb-4" />
          <p className="text-cyan-400 font-semibold tracking-wider">Loading Troo World</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0a1020]" style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2 items-center">
        <Link
          href="/dashboard"
          className="px-4 py-2 text-sm text-cyan-400 border border-cyan-500/50 rounded-lg hover:bg-cyan-500/10 transition-colors"
        >
          ← Dashboard
        </Link>
        <Link
          href="/modeling"
          className="px-4 py-2 text-sm text-slate-400 border border-slate-500/50 rounded-lg hover:bg-slate-500/10 transition-colors"
        >
          Edit World (Modeling)
        </Link>
        <button
          type="button"
          onClick={() => setWalkMode((w) => !w)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            walkMode
              ? "bg-emerald-500/30 border-2 border-emerald-400 text-emerald-300"
              : "bg-slate-800/80 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
          }`}
        >
          {walkMode ? "🚶 First-person" : "🔄 Orbit view"}
        </button>
      </div>
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-red-900/80 text-red-200 rounded-lg text-sm">
          {error}
        </div>
      )}
      <TrooWorldUnifiedViewer
        worldTitle="TROO WORLD"
        initialBuilding={validBuilding}
        placements={placements ?? undefined}
        elements={elements ?? undefined}
        editMode={false}
        walkMode={walkMode}
        embedded
      />
    </div>
  );
}

export default function TrooWorldPage() {
  return (
    <Suspense fallback={<TrooWorldLoading />}>
      <TrooWorldPageContent />
    </Suspense>
  );
}
