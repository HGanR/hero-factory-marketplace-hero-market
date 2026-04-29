"use client";

import React, { Suspense, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { buildDismissHandoffUrl, jarvaHandoffNextStepLine, jarvaHandoffWhyLine, parseJarvaHandoff } from "@/lib/jarva/jarva-handoff";
import { formatJarvaWorkflowLaneLabel } from "@/lib/jarva/jarva-chat-ui-actions";
import { Button } from "@/components/ui/button";

function JarvaHandoffStripInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handoff = useMemo(() => parseJarvaHandoff(sp), [sp]);

  if (!handoff) return null;

  const laneLabel = formatJarvaWorkflowLaneLabel(handoff.lane);
  const dismiss = () => {
    router.replace(buildDismissHandoffUrl(pathname || "/", sp));
  };

  return (
    <div
      className="mb-3 flex flex-wrap items-start gap-2 rounded-lg border border-cyan-500/35 bg-cyan-950/45 px-3 py-2.5 text-[12px] leading-snug text-cyan-50/95 shadow-sm"
      role="status"
      aria-label="Jarva workflow handoff"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-200/90">Jarva handoff</p>
        <p className="text-cyan-50/95">
          <span className="font-semibold text-white">Lane: {laneLabel}</span>
          <span className="text-cyan-200/80"> · </span>
          <span>{jarvaHandoffWhyLine(handoff.lane)}</span>
        </p>
        <p className="text-slate-300/95">{jarvaHandoffNextStepLine(handoff.lane)}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-cyan-200/80 hover:bg-cyan-900/50 hover:text-white"
        onClick={dismiss}
        aria-label="Dismiss handoff notice"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** Dismissible strip when `?jarvaFrom=1&jarvaLane=trust_*` is present (set by FloatingNPCChat workflow navigation). */
export function JarvaHandoffStrip() {
  return (
    <Suspense fallback={null}>
      <JarvaHandoffStripInner />
    </Suspense>
  );
}
