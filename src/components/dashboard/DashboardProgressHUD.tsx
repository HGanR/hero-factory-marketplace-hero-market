"use client";

import Link from "next/link";
import { CheckCircle, Circle } from "lucide-react";
import { HolographicCard } from "./HolographicCard";
import { useUserMissionPathProgress } from "@/hooks/useUserMissionPathProgress";
import { MISSION_STEP_IDS } from "@/lib/user-mission-path/mission-path-types";

const STEP_LINKS: Record<(typeof MISSION_STEP_IDS)[number], string> = {
  entity: "/entity-maps",
  website: "/site-builder",
  agent: "/app/agents",
  campaign: "/revenue-os/dashboard",
  lead: "/app/contacts",
};

/**
 * Compact checklist — same server-backed state as the Mission Path card.
 */
export function DashboardProgressHUD() {
  const { data, isLoading, isError } = useUserMissionPathProgress();

  if (isLoading) {
    return (
      <HolographicCard accent="cyan">
        <div className="p-6 space-y-3 animate-pulse">
          <div className="h-5 w-40 bg-white/10 rounded" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 bg-white/5 rounded-lg" />
          ))}
        </div>
      </HolographicCard>
    );
  }

  if (isError || !data) {
    return (
      <HolographicCard accent="cyan">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-cyan-100 mb-1">Business Creation Progress</h2>
          <p className="text-sm text-slate-500">Load mission path to see live progress.</p>
        </div>
      </HolographicCard>
    );
  }

  return (
    <HolographicCard accent="cyan">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-cyan-100 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400/80" />
          Business Creation Progress
        </h2>
        <div className="space-y-1">
          {data.steps.map((step) => (
            <Link
              key={step.id}
              href={STEP_LINKS[step.id]}
              className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-white/5 transition-colors"
            >
              {step.done ? (
                <CheckCircle className="w-5 h-5 text-cyan-400 shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-slate-500 shrink-0" />
              )}
              <span className={step.done ? "text-slate-300" : "text-slate-200"}>{step.title}</span>
            </Link>
          ))}
        </div>
      </div>
    </HolographicCard>
  );
}
