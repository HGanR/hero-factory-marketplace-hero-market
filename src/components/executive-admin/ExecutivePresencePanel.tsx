"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ExecutivePresenceSnapshot } from "@/lib/executive-agent/executive-presence-types";
import { ExecutiveCollapsibleTile } from "./ExecutiveCollapsibleTile";

const URGENCY_STYLE: Record<string, string> = {
  routine: "border-[#00A3FF]/25 text-[#00A3FF]/90",
  elevated: "border-amber-400/35 text-amber-100",
  urgent: "border-orange-400/40 text-orange-100",
  critical: "border-rose-500/45 text-rose-100",
};

const ORB_LABEL: Record<string, string> = {
  idle: "Idle",
  monitoring: "Monitoring",
  incident: "Incident watch",
  approval_waiting: "Approval queue",
  escalation: "Escalation",
  crisis_coordination: "Crisis coordination",
  strategic_analysis: "Strategic analysis",
  workflow_recovery: "Workflow recovery",
};

const TONE_LABEL: Record<string, string> = {
  chief_of_staff: "Chief of Staff",
  operations_director: "Operations Director",
  executive_coordinator: "Executive Coordinator",
  strategic_advisor: "Strategic Advisor",
  crisis_briefing: "Crisis Briefing",
};

type Props = {
  presence: ExecutivePresenceSnapshot | null;
  loading?: boolean;
  error?: string | null;
  onDismissInterruption?: (id: string) => void;
  dismissedIds?: Set<string>;
};

export function ExecutivePresencePanel({
  presence,
  loading,
  error,
  onDismissInterruption,
  dismissedIds,
}: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[#00A3FF]/15 bg-[#000814]/70 p-4 text-xs text-slate-500">
        Loading executive presence…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-amber-400/25 bg-amber-950/20 p-4 text-xs text-amber-100/90">
        {error}
      </div>
    );
  }
  if (!presence) return null;

  const urgencyClass = URGENCY_STYLE[presence.urgency] ?? URGENCY_STYLE.routine;
  const visibleInterruptions = presence.interruptions.filter((i) => !dismissedIds?.has(i.id));

  return (
    <div className="space-y-3">
      <motion.div
        layout
        className={`rounded-2xl border bg-[#000814]/80 p-4 backdrop-blur-md ${urgencyClass}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] opacity-70">
              Executive posture · {TONE_LABEL[presence.toneMode] ?? presence.toneMode}
            </p>
            <p className="mt-1 text-sm font-medium text-white">{presence.postureHeadline}</p>
            <p className="mt-1 text-xs text-slate-400">{presence.postureDetail.slice(0, 280)}</p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="rounded-full border border-current/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
              {presence.urgency}
            </span>
            <span className="text-[9px] uppercase tracking-[0.2em] text-violet-300/80">
              {ORB_LABEL[presence.orbState] ?? presence.orbState}
            </span>
            <span className="text-[9px] capitalize text-slate-500">{presence.emotion}</span>
          </div>
        </div>
        {presence.activeIncidents.length > 0 ? (
          <div className="mt-3 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
            </span>
            <span className="text-[11px] text-rose-200/90">
              Active incident pulse: {presence.activeIncidents[0]}
            </span>
          </div>
        ) : null}
        {presence.topRecommendedAction ? (
          <p className="mt-2 text-[11px] text-emerald-200/90">
            Top action: <span className="text-white">{presence.topRecommendedAction}</span>
          </p>
        ) : null}
      </motion.div>

      <AnimatePresence mode="popLayout">
        {visibleInterruptions.slice(0, 4).map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-[#00A3FF]/20 bg-[#000814]/55 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#00A3FF]/70">
                  {item.kind.replace(/_/g, " ")} · {item.severity}
                </p>
                <p className="mt-0.5 text-xs font-medium text-slate-100">{item.title}</p>
                <p className="mt-1 text-[11px] text-slate-400">{item.detail}</p>
                <p className="mt-1 text-[10px] text-violet-300/75">{item.routeHint}</p>
              </div>
              {onDismissInterruption ? (
                <button
                  type="button"
                  onClick={() => onDismissInterruption(item.id)}
                  className="shrink-0 text-[10px] uppercase tracking-wide text-slate-500 hover:text-slate-300"
                >
                  Dismiss
                </button>
              ) : null}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {presence.activeEntities.length > 0 ? (
        <ExecutiveCollapsibleTile
          title="Active operational entities"
          subtitle={`${presence.activeEntities.length} entity${presence.activeEntities.length === 1 ? "" : "ies"} on desk`}
          defaultCollapsed
        >
          <ul className="flex flex-wrap gap-2">
            {presence.activeEntities.map((e) => (
              <li
                key={e.id}
                className="rounded-full border border-[#00A3FF]/15 bg-[#00050A]/80 px-2 py-1 text-[10px] text-slate-300"
              >
                <span className="font-medium text-white">{e.label}</span>
                <span className="ml-1 opacity-60">· {e.status}</span>
              </li>
            ))}
            <li className="rounded-full border border-dashed border-[#00A3FF]/20 px-2 py-1 text-[10px] text-slate-500">
              Jarva · TRUST desk
            </li>
          </ul>
        </ExecutiveCollapsibleTile>
      ) : null}

      {presence.timeline.length > 0 ? (
        <ExecutiveCollapsibleTile
          title="Session timeline"
          subtitle={`${presence.timeline.length} recent signal${presence.timeline.length === 1 ? "" : "s"}`}
          defaultCollapsed
        >
          <ul className="max-h-36 space-y-1 overflow-y-auto text-[11px]">
            {presence.timeline.map((t) => (
              <li
                key={t.id}
                className={`border-b border-slate-800/80 py-1 ${t.deltaSinceLastSession ? "text-slate-200" : "text-slate-500"}`}
              >
                <span className="text-[9px] uppercase tracking-wide text-violet-400/70">{t.category}</span>
                <span className="ml-2">{t.summary}</span>
              </li>
            ))}
          </ul>
        </ExecutiveCollapsibleTile>
      ) : null}
    </div>
  );
}

/** Collapsible sidebar tiles — posture, entities, timeline (matches other right-stack dropdowns). */
export function ExecutivePresenceSidebarTiles({
  presence,
  loading,
  error,
}: Pick<Props, "presence" | "loading" | "error">) {
  if (loading) {
    return (
      <ExecutiveCollapsibleTile title="Executive posture" subtitle="Loading…" defaultCollapsed>
        <p className="text-xs text-slate-500">Loading executive presence…</p>
      </ExecutiveCollapsibleTile>
    );
  }
  if (error) {
    return (
      <ExecutiveCollapsibleTile title="Executive posture" subtitle="Unavailable" defaultCollapsed>
        <p className="text-xs text-amber-100/90">{error}</p>
      </ExecutiveCollapsibleTile>
    );
  }
  if (!presence) return null;

  const tone = TONE_LABEL[presence.toneMode] ?? presence.toneMode;
  const urgencyClass = URGENCY_STYLE[presence.urgency] ?? URGENCY_STYLE.routine;

  return (
    <>
      <ExecutiveCollapsibleTile
        title="Executive posture"
        subtitle={`Chief of Staff · ${tone}`}
        defaultCollapsed
        className={urgencyClass}
      >
        <div className="space-y-2 text-xs">
          <p className="font-medium text-white">{presence.postureHeadline}</p>
          <p className="text-slate-400">{presence.postureDetail.slice(0, 280)}</p>
          <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wide">
            <span className="rounded-full border border-current/30 px-2 py-0.5">{presence.urgency}</span>
            <span className="text-violet-300/80">{ORB_LABEL[presence.orbState] ?? presence.orbState}</span>
            <span className="capitalize text-slate-500">{presence.emotion}</span>
          </div>
          {presence.activeIncidents.length > 0 ? (
            <p className="text-[11px] text-rose-200/90">Active incident: {presence.activeIncidents[0]}</p>
          ) : null}
          {presence.topRecommendedAction ? (
            <p className="text-[11px] text-emerald-200/90">
              Top action: <span className="text-white">{presence.topRecommendedAction}</span>
            </p>
          ) : null}
        </div>
      </ExecutiveCollapsibleTile>

      {presence.activeEntities.length > 0 ? (
        <ExecutiveCollapsibleTile
          title="Active operational entities"
          subtitle={`${presence.activeEntities.length} entity${presence.activeEntities.length === 1 ? "" : "ies"} on desk`}
          defaultCollapsed
        >
          <ul className="flex flex-wrap gap-2">
            {presence.activeEntities.map((e) => (
              <li
                key={e.id}
                className="rounded-full border border-[#00A3FF]/15 bg-[#00050A]/80 px-2 py-1 text-[10px] text-slate-300"
              >
                <span className="font-medium text-white">{e.label}</span>
                <span className="ml-1 opacity-60">· {e.status}</span>
              </li>
            ))}
          </ul>
        </ExecutiveCollapsibleTile>
      ) : null}

      {presence.timeline.length > 0 ? (
        <ExecutiveCollapsibleTile
          title="Session timeline"
          subtitle={`${presence.timeline.length} recent signal${presence.timeline.length === 1 ? "" : "s"}`}
          defaultCollapsed
        >
          <ul className="max-h-36 space-y-1 overflow-y-auto text-[11px]">
            {presence.timeline.map((t) => (
              <li
                key={t.id}
                className={`border-b border-slate-800/80 py-1 ${t.deltaSinceLastSession ? "text-slate-200" : "text-slate-500"}`}
              >
                <span className="text-[9px] uppercase tracking-wide text-violet-400/70">{t.category}</span>
                <span className="ml-2">{t.summary}</span>
              </li>
            ))}
          </ul>
        </ExecutiveCollapsibleTile>
      ) : null}
    </>
  );
}

export function operationalOrbBadgeLabel(state: string): string {
  return ORB_LABEL[state] ?? state;
}
