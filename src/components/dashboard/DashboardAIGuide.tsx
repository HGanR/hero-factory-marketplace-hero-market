"use client";

import Link from "next/link";
import { HolographicCard } from "./HolographicCard";
import { useUserMissionPathProgress } from "@/hooks/useUserMissionPathProgress";

const FALLBACK = {
  label: "Open AI Agency",
  href: "/app/agents",
  description: "Create and manage AI agents.",
};

/**
 * Suggested next action follows the server-backed Mission Path (not a hardcoded first step).
 */
export function DashboardAIGuide() {
  const { data, isLoading, isError } = useUserMissionPathProgress();

  if (isLoading) {
    return (
      <HolographicCard accent="violet">
        <div className="p-6 animate-pulse">
          <div className="h-5 w-32 bg-white/10 rounded mb-2" />
          <div className="h-4 w-full max-w-xs bg-white/5 rounded" />
        </div>
      </HolographicCard>
    );
  }

  if (isError) {
    return (
      <HolographicCard accent="violet">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-cyan-100 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            AI Assistant
          </h2>
          <p className="text-sm text-slate-400 mb-0">Sign in to load your next recommended step.</p>
        </div>
      </HolographicCard>
    );
  }

  const allDone = data?.allComplete;
  const cta = data?.continue;
  const label = cta?.label ?? FALLBACK.label;
  const href = cta?.href ?? FALLBACK.href;
  const description = allDone
    ? "Mission Path complete. Explore agents, campaigns, and the Client Hub anytime."
    : cta
      ? `Next step: ${data?.steps.find((s) => s.id === cta.stepId)?.title ?? label}`
      : FALLBACK.description;

  return (
    <HolographicCard accent="violet">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-cyan-100 mb-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          AI Assistant
        </h2>
        <p className="text-sm text-slate-400 mb-4">{description}</p>
        <Link
          href={href}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-white transition-all"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            border: "1px solid rgba(139,92,246,0.5)",
            boxShadow: "0 0 20px rgba(139,92,246,0.2)",
          }}
        >
          {allDone ? "Open AI Agency" : label}
        </Link>
      </div>
    </HolographicCard>
  );
}
