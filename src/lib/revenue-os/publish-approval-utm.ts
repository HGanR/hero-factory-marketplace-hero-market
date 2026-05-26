/**
 * Parse / merge Bentley publish approval fields in utmParams (string values only).
 */

import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";
import type { PublishApprovalChainRequiredRole } from "@/lib/revenue-os/publish-approval-chain";
import type { RevenueOsPublishApprovalStatus } from "@/lib/revenue-os/publish-approval-types";

export const BENTLEY_UTM_APPROVAL_STATUS = "bentley_approval_status";
export const BENTLEY_UTM_APPROVED_AT = "bentley_approved_at";
export const BENTLEY_UTM_APPROVED_BY = "bentley_approved_by";
export const BENTLEY_UTM_APPROVAL_REASON = "bentley_approval_reason";
/** Numeric marketplace user id as string (governance). */
export const BENTLEY_UTM_APPROVAL_BY_USER_ID = "bentley_approval_by_user_id";
/** ISO timestamp for the latest approval decision (any of approved / rejected / not_required). */
export const BENTLEY_UTM_APPROVAL_DECIDED_AT = "bentley_approval_decided_at";
export const BENTLEY_UTM_APPROVAL_ACTOR_ROLE = "bentley_approval_actor_role";

/** Multi-step chain progress (only when campaign uses a chain with 2+ steps). */
export const BENTLEY_UTM_APPROVAL_CHAIN_STEP = "bentley_approval_chain_step";
export const BENTLEY_UTM_APPROVAL_CHAIN_TOTAL = "bentley_approval_chain_total";
export const BENTLEY_UTM_APPROVAL_CHAIN_REQUIRED_ROLE = "bentley_approval_chain_required_role";

/** ISO instant when the post entered its current pending approval step (initial pending or chain advance). */
export const BENTLEY_UTM_APPROVAL_STEP_STARTED_AT = "bentley_approval_step_started_at";
/**
 * Logical step index (0-based) for which an SLA overdue reminder was last recorded.
 * Cleared when the awaiting step changes; prevents duplicate reminders for the same step.
 */
export const BENTLEY_UTM_APPROVAL_STEP_SLA_REMINDER_FOR_STEP = "bentley_approval_step_sla_reminder_for_step";

const CHAIN_ROLES: PublishApprovalChainRequiredRole[] = ["editor", "approver", "owner"];

export type ParsedPublishApprovalUtm = {
  status: RevenueOsPublishApprovalStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  approvalReason: string | null;
  decidedAt: string | null;
  decidedByUserId: number | null;
  actorRole: import("@/lib/revenue-os/publish-approval-governance-types").RevenueOsApprovalActorRole | null;
  /** Present only when chain keys exist on the post UTM. */
  currentApprovalStepIndex: number | null;
  totalApprovalSteps: number | null;
  currentApprovalRequiredRole: PublishApprovalChainRequiredRole | null;
  /** When the current pending step began (SLA); null if unset (legacy rows). */
  approvalStepStartedAt: string | null;
  /** Last logical step index an SLA reminder was persisted for; null if none. */
  slaReminderSentForLogicalStep: number | null;
};

const VALID: RevenueOsPublishApprovalStatus[] = [
  "not_required",
  "pending_approval",
  "approved",
  "rejected",
];

const VALID_ACTOR_ROLES: import("@/lib/revenue-os/publish-approval-governance-types").RevenueOsApprovalActorRole[] = [
  "owner",
  "operator",
  "reviewer",
  "publisher",
  "admin",
];

function parseDecidedByUserId(raw: string | null | undefined): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseActorRoleRaw(
  raw: string | null | undefined
): import("@/lib/revenue-os/publish-approval-governance-types").RevenueOsApprovalActorRole | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  return VALID_ACTOR_ROLES.includes(s as (typeof VALID_ACTOR_ROLES)[number])
    ? (s as (typeof VALID_ACTOR_ROLES)[number])
    : null;
}

function parseChainRequiredRoleRaw(raw: string | null | undefined): PublishApprovalChainRequiredRole | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  return CHAIN_ROLES.includes(s as PublishApprovalChainRequiredRole)
    ? (s as PublishApprovalChainRequiredRole)
    : null;
}

function parsePositiveInt(raw: string | null | undefined): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function clearPublishApprovalChainKeys(out: Record<string, string>): void {
  delete out[BENTLEY_UTM_APPROVAL_CHAIN_STEP];
  delete out[BENTLEY_UTM_APPROVAL_CHAIN_TOTAL];
  delete out[BENTLEY_UTM_APPROVAL_CHAIN_REQUIRED_ROLE];
}

export function clearPublishApprovalStepSlaState(out: Record<string, string>): void {
  delete out[BENTLEY_UTM_APPROVAL_STEP_STARTED_AT];
  delete out[BENTLEY_UTM_APPROVAL_STEP_SLA_REMINDER_FOR_STEP];
}

export function setPublishApprovalChainProgressKeys(
  out: Record<string, string>,
  args: { stepIndex: number; totalSteps: number; requiredRole: PublishApprovalChainRequiredRole }
): void {
  out[BENTLEY_UTM_APPROVAL_CHAIN_STEP] = String(args.stepIndex);
  out[BENTLEY_UTM_APPROVAL_CHAIN_TOTAL] = String(args.totalSteps);
  out[BENTLEY_UTM_APPROVAL_CHAIN_REQUIRED_ROLE] = args.requiredRole;
}

function utmStr(v: unknown): string {
  return coerceTrimmedString(v);
}

function normalizeUtmInput(utm: Record<string, string> | null | undefined): Record<string, string> {
  if (!utm || typeof utm !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(utm)) {
    if (v == null) continue;
    out[k] = utmStr(v);
  }
  return out;
}

function normStatus(raw: unknown): RevenueOsPublishApprovalStatus | null {
  const trimmed = utmStr(raw);
  if (!trimmed) return null;
  const s = trimmed.toLowerCase().replace(/-/g, "_");
  if (s === "notrequired" || s === "not_required") return "not_required";
  if (s === "pending" || s === "pending_approval") return "pending_approval";
  if (s === "approved") return "approved";
  if (s === "rejected") return "rejected";
  return VALID.includes(s as RevenueOsPublishApprovalStatus) ? (s as RevenueOsPublishApprovalStatus) : null;
}

export function rawApprovalStatusKey(utm: Record<string, string> | null | undefined): string {
  const u = utm ?? {};
  return String(u[BENTLEY_UTM_APPROVAL_STATUS] ?? u["bentley_approval_status"] ?? "").trim();
}

/**
 * Stored UTM values. Missing key → `not_required` (legacy / no explicit gate on that field).
 */
export function parsePublishApprovalFromUtm(
  utm: Record<string, string> | null | undefined
): ParsedPublishApprovalUtm {
  const u = normalizeUtmInput(utm);
  const rawKey = u[BENTLEY_UTM_APPROVAL_STATUS] ?? u["bentley_approval_status"];
  const st = normStatus(rawKey) ?? (utmStr(rawKey) ? "pending_approval" : "not_required");
  const approvedAt = utmStr(u[BENTLEY_UTM_APPROVED_AT] ?? u["bentley_approved_at"]) || null;
  const approvedBy = utmStr(u[BENTLEY_UTM_APPROVED_BY] ?? u["bentley_approved_by"]) || null;
  const approvalReason = utmStr(u[BENTLEY_UTM_APPROVAL_REASON] ?? u["bentley_approval_reason"]) || null;
  const decidedAtRaw = utmStr(u[BENTLEY_UTM_APPROVAL_DECIDED_AT] ?? u["bentley_approval_decided_at"]) || null;
  const decidedAt = decidedAtRaw || approvedAt;
  const decidedByUserId = parseDecidedByUserId(
    u[BENTLEY_UTM_APPROVAL_BY_USER_ID] ?? u["bentley_approval_by_user_id"]
  );
  const actorRole = parseActorRoleRaw(
    u[BENTLEY_UTM_APPROVAL_ACTOR_ROLE] ?? u["bentley_approval_actor_role"]
  );
  const stepRaw = utmStr(u[BENTLEY_UTM_APPROVAL_CHAIN_STEP] ?? u["bentley_approval_chain_step"]);
  const totalRaw = utmStr(u[BENTLEY_UTM_APPROVAL_CHAIN_TOTAL] ?? u["bentley_approval_chain_total"]);
  const roleRaw = utmStr(
    u[BENTLEY_UTM_APPROVAL_CHAIN_REQUIRED_ROLE] ?? u["bentley_approval_chain_required_role"]
  );
  const hasChainKeys = Boolean(stepRaw && totalRaw && roleRaw);
  const currentApprovalStepIndex = hasChainKeys ? parsePositiveInt(stepRaw) : null;
  const totalApprovalSteps = hasChainKeys ? parsePositiveInt(totalRaw) : null;
  const currentApprovalRequiredRole = hasChainKeys ? parseChainRequiredRoleRaw(roleRaw) : null;
  const approvalStepStartedAt =
    utmStr(u[BENTLEY_UTM_APPROVAL_STEP_STARTED_AT] ?? u["bentley_approval_step_started_at"]) || null;
  const reminderStepRaw = utmStr(
    u[BENTLEY_UTM_APPROVAL_STEP_SLA_REMINDER_FOR_STEP] ?? u["bentley_approval_step_sla_reminder_for_step"]
  );
  const slaReminderSentForLogicalStep = reminderStepRaw ? parsePositiveInt(reminderStepRaw) : null;
  return {
    status: st,
    approvedAt,
    approvedBy,
    approvalReason,
    decidedAt,
    decidedByUserId,
    actorRole,
    currentApprovalStepIndex,
    totalApprovalSteps,
    currentApprovalRequiredRole,
    approvalStepStartedAt,
    slaReminderSentForLogicalStep,
  };
}

export function mergePublishApprovalIntoUtm(
  prev: Record<string, string> | null | undefined,
  patch: {
    status: RevenueOsPublishApprovalStatus;
    approvedAt?: string | null;
    approvedBy?: string | null;
    approvalReason?: string | null;
  }
): Record<string, string> {
  const next = { ...(prev ?? {}) };
  next[BENTLEY_UTM_APPROVAL_STATUS] = patch.status;
  if (patch.approvedAt != null) {
    if (patch.approvedAt === "") {
      delete next[BENTLEY_UTM_APPROVED_AT];
    } else {
      next[BENTLEY_UTM_APPROVED_AT] = patch.approvedAt;
    }
  }
  if (patch.approvedBy != null) {
    if (patch.approvedBy === "") {
      delete next[BENTLEY_UTM_APPROVED_BY];
    } else {
      next[BENTLEY_UTM_APPROVED_BY] = patch.approvedBy.slice(0, 200);
    }
  }
  if (patch.approvalReason != null) {
    if (patch.approvalReason === "") {
      delete next[BENTLEY_UTM_APPROVAL_REASON];
    } else {
      next[BENTLEY_UTM_APPROVAL_REASON] = patch.approvalReason.slice(0, 500);
    }
  }
  return next;
}

export function publishApprovalRecordFromUtm(
  postId: string,
  utm: Record<string, string> | null | undefined
): import("@/lib/revenue-os/publish-approval-governance-types").RevenueOsPublishApprovalRecord {
  const p = parsePublishApprovalFromUtm(utm);
  const decision =
    p.status === "approved"
      ? "approved"
      : p.status === "rejected"
        ? "rejected"
        : ("pending" as const);
  return {
    postId,
    decision,
    decidedAt: p.decidedAt ?? undefined,
    decidedByUserId: p.decidedByUserId,
    decidedByLabel: p.approvedBy,
    actorRole: p.actorRole,
    reason: p.approvalReason,
  };
}
