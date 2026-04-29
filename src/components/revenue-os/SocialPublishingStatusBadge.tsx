"use client";

import type { PublishingPlannerItem } from "@/lib/social/publishing-planner";
import { formatPublishingPlannerStatus } from "@/lib/social/publishing-planner";

const base =
  "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide border";

export function shortSocialPublishingLabel(approvalStatus: string, publishStatusLabel: string): string {
  if (publishStatusLabel === "published") return "Published";
  if (publishStatusLabel === "failed") return "Failed";
  if (publishStatusLabel === "publishing") return "Publishing";
  if (approvalStatus === "rejected") return "Rejected";
  if (approvalStatus === "pending_approval") return "Pending approval";
  if (approvalStatus === "approved" && publishStatusLabel === "scheduled") return "Scheduled";
  if (publishStatusLabel === "scheduled") return "Scheduled";
  if (approvalStatus === "approved") return "Approved";
  return "Draft";
}

export function socialPublishingToneClasses(approvalStatus: string, publishStatusLabel: string): string {
  if (publishStatusLabel === "published") return "border-emerald-500/50 text-emerald-300 bg-emerald-950/40";
  if (publishStatusLabel === "failed") return "border-red-500/50 text-red-300 bg-red-950/40";
  if (publishStatusLabel === "publishing") return "border-amber-500/50 text-amber-200 bg-amber-950/40";
  if (approvalStatus === "rejected") return "border-rose-500/50 text-rose-300 bg-rose-950/40";
  if (approvalStatus === "pending_approval") return "border-yellow-500/50 text-yellow-200 bg-yellow-950/40";
  if (approvalStatus === "approved" && publishStatusLabel === "scheduled")
    return "border-cyan-500/50 text-cyan-200 bg-cyan-950/30";
  if (publishStatusLabel === "scheduled") return "border-sky-500/50 text-sky-200 bg-sky-950/30";
  if (approvalStatus === "approved") return "border-teal-500/50 text-teal-200 bg-teal-950/30";
  return "border-slate-600 text-slate-400 bg-slate-900/80";
}

function tone(item: PublishingPlannerItem): string {
  if (item.approvalOverdueHint) return "border-orange-500/60 text-orange-200 bg-orange-950/50";
  if (item.approvalBlocked && item.publishStatusLabel === "scheduled")
    return "border-slate-500 text-slate-300 bg-slate-800/80";
  return socialPublishingToneClasses(item.approvalStatus, item.publishStatusLabel);
}

export function SocialPublishingStatusBadge({
  item,
  className = "",
}: {
  item: PublishingPlannerItem;
  className?: string;
}) {
  const label = formatPublishingPlannerStatus(item);
  const step =
    item.totalApprovalSteps != null &&
    item.totalApprovalSteps > 1 &&
    item.currentApprovalStepIndex != null &&
    item.approvalStatus === "pending_approval"
      ? ` · Step ${item.currentApprovalStepIndex + 1}/${item.totalApprovalSteps}`
      : "";
  return (
    <span data-testid="social-publishing-status-badge" className={`${base} ${tone(item)} ${className}`.trim()}>
      {label}
      {step}
    </span>
  );
}

/** List rows that only have approval + publish labels (e.g. `/api/social/posts` list). */
export function SocialPublishingStatusBadgeInline({
  approvalStatus,
  publishStatusLabel,
  className = "",
}: {
  approvalStatus: string;
  publishStatusLabel: string;
  className?: string;
}) {
  return (
    <span
      data-testid="social-publishing-status-badge-inline"
      className={`${base} ${socialPublishingToneClasses(approvalStatus, publishStatusLabel)} ${className}`.trim()}
    >
      {shortSocialPublishingLabel(approvalStatus, publishStatusLabel)}
    </span>
  );
}
