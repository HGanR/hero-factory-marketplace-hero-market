"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { WorldBlueprint } from "@/lib/oasis/world-blueprint-schema";

const OasisWorldSceneViewer = dynamic(
  () => import("@/components/oasis/OasisWorldSceneViewer"),
  { ssr: false, loading: () => <div className="h-[400px] flex items-center justify-center text-slate-400">Loading 3D viewer…</div> }
);

type WorldResponse = {
  worldId: string;
  worldName: string;
  versionId: string;
  seed: number;
  readinessHash: string | null;
  createdAt: string;
  sceneGraph: WorldBlueprint;
};

function OasisWorldViewerPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const worldId = params?.worldId as string | undefined;
  const versionId = searchParams?.get("versionId") ?? undefined;
  const [data, setData] = useState<WorldResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!worldId) {
      setLoading(false);
      setError("No world ID");
      return;
    }

    let cancelled = false;
    const url = versionId
      ? `/api/oasis/worlds/${worldId}?versionId=${encodeURIComponent(versionId)}`
      : `/api/oasis/worlds/${worldId}`;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "World or version not found." : "Failed to load world.");
        return r.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Failed to load world");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [worldId, versionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4" />
          <p className="text-slate-300">Loading world…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4">
        <p className="text-red-300">{error || "World not found"}</p>
        <Link href="/modeling" className="text-cyan-400 hover:underline">
          ← Back to Modeling
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-white">{data.worldName}</h1>
            <p className="text-sm text-slate-400">
              Version {data.versionId.slice(0, 8)}… • {new Date(data.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/modeling"
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              ← Modeling
            </Link>
            <Link
              href="/oasis-world"
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              OASIS World
            </Link>
          </div>
        </div>
        <OasisWorldSceneViewer sceneGraph={data.sceneGraph} />
      </div>
    </div>
  );
}

export default function OasisWorldViewerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
          Loading world…
        </div>
      }
    >
      <OasisWorldViewerPageContent />
    </Suspense>
  );
}
