"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { JarvaTrustIntakeMvp } from "@/components/jarva/JarvaTrustIntakeMvp";
import { parseJarvaHandoff, jarvaHandoffTrustDraftingLaneKind } from "@/lib/jarva/jarva-handoff";
import { cn } from "@/lib/utils";

export function JarvaTrustIntakeRouteBody({ trustId }: { trustId: string }) {
  const searchParams = useSearchParams();
  const handoffDraftingKind = useMemo(() => {
    const h = parseJarvaHandoff(new URLSearchParams(searchParams?.toString() ?? ""));
    if (!h) return null;
    return jarvaHandoffTrustDraftingLaneKind(h.lane);
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl p-1",
          handoffDraftingKind &&
            "ring-2 ring-violet-500/35 ring-offset-2 ring-offset-slate-950 rounded-2xl",
        )}
      >
        <div>
          <h1 className="text-2xl font-bold text-white">Build with Jarva</h1>
          <p className="text-sm text-slate-400">Workspace: {trustId}</p>
        </div>
        <Link
          href={`/trust-records?trustId=${encodeURIComponent(trustId)}`}
          className="text-sm font-medium text-amber-400 hover:text-amber-300"
        >
          ← Trust Records
        </Link>
      </div>
      <JarvaTrustIntakeMvp trustId={trustId} handoffDraftingKind={handoffDraftingKind} />
    </div>
  );
}
