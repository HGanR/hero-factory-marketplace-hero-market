"use client";

import type { DocumentLifecycleStatus } from "./vaultTypes";
import { statusLabel } from "./vaultLabels";

const STATUS_BADGE: Record<DocumentLifecycleStatus, string> = {
  not_started: "border-slate-500/35 bg-slate-500/15 text-slate-200",
  in_progress: "border-cyan-500/35 bg-cyan-500/15 text-cyan-100",
  awaiting_response: "border-sky-500/35 bg-sky-500/15 text-sky-100",
  follow_up_due: "border-amber-500/40 bg-amber-500/15 text-amber-100",
  completed: "border-emerald-500/35 bg-emerald-500/15 text-emerald-100",
  escalated: "border-violet-500/40 bg-violet-500/15 text-violet-100",
};

const FOLLOW_UP_DONE_CLASS =
  "border-teal-500/35 bg-teal-500/10 text-teal-100";

export function LifecycleBadge({ status }: { status: DocumentLifecycleStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STATUS_BADGE[status]}`}
    >
      {statusLabel(status)}
    </span>
  );
}

export function FollowUpDoneBadge({ tags }: { tags: string[] }) {
  if (!tags.includes("follow_up_done")) return null;
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${FOLLOW_UP_DONE_CLASS}`}
    >
      Follow-up done
    </span>
  );
}

export function MatterBadgesRow({ status, tags }: { status: DocumentLifecycleStatus; tags: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <LifecycleBadge status={status} />
      <FollowUpDoneBadge tags={tags} />
    </span>
  );
}

export function DocumentBadgesRow({ status, tags }: { status: DocumentLifecycleStatus; tags: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <LifecycleBadge status={status} />
      <FollowUpDoneBadge tags={tags} />
    </span>
  );
}
