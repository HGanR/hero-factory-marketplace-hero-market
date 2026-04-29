/**
 * Explicit rules for editing governed social posts (campaign_posts + UTM approval).
 * Keeps behavior aligned with worker gate and governance merges — no second approval model.
 */

import type { campaignPosts } from "@/lib/db/schema";
import type { RevenueOsPublishApprovalStatus } from "@/lib/revenue-os/publish-approval-types";
import {
  isMultiStepPublishApprovalChain,
  parseCampaignPublishApprovalChainJson,
  requiredReviewerRoleForChainStep,
} from "@/lib/revenue-os/publish-approval-chain";
import { mergePublishApprovalGovernanceIntoUtm } from "@/lib/revenue-os/publish-approval-governance-merge";
import type { ResolvedPublishApprovalActor } from "@/lib/revenue-os/resolve-publish-approval-actor";
import { canScheduledPostPublishUnderApprovalMode } from "@/lib/revenue-os/publish-approval-gate";
import { parsePublishApprovalFromUtm } from "@/lib/revenue-os/publish-approval-utm";
import { isCreativeTypeAllowedForProviderMedia } from "@/lib/social/social-provider-publish-capabilities";

function utmRecord(utmParams: unknown): Record<string, string> {
  if (!utmParams || typeof utmParams !== "object" || Array.isArray(utmParams)) return {};
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(utmParams as Record<string, unknown>)) {
    if (v == null) continue;
    o[k] = String(v);
  }
  return o;
}

function iso(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  if (d instanceof Date) return d.toISOString();
  return String(d);
}

/** Fields that materially affect what gets published or when — changing them invalidates prior approval when approval is required. */
export function socialPostMaterialFieldsChanged(args: {
  prevCaption: string;
  prevLinkUrl: string | null;
  prevSocialAccountId: string | null;
  prevScheduledAtIso: string | null;
  prevAssetId: string | null;
  nextCaption?: string;
  nextLinkUrl?: string | null;
  nextSocialAccountId?: string | null;
  nextScheduledAtIso?: string | null;
  nextAssetId?: string | null;
}): boolean {
  if (args.nextCaption !== undefined && args.nextCaption !== args.prevCaption) return true;
  const pl = args.prevLinkUrl ?? "";
  const nl = args.nextLinkUrl !== undefined ? args.nextLinkUrl ?? "" : pl;
  if (args.nextLinkUrl !== undefined && nl !== pl) return true;
  const pa = args.prevSocialAccountId ?? "";
  const na = args.nextSocialAccountId !== undefined ? args.nextSocialAccountId ?? "" : pa;
  if (args.nextSocialAccountId !== undefined && na !== pa) return true;
  const ps = args.prevScheduledAtIso ?? "";
  const ns = args.nextScheduledAtIso !== undefined ? args.nextScheduledAtIso ?? "" : ps;
  if (args.nextScheduledAtIso !== undefined && ns !== ps) return true;
  const pai = args.prevAssetId ?? "";
  const nai = args.nextAssetId !== undefined ? args.nextAssetId ?? "" : pai;
  if (args.nextAssetId !== undefined && nai !== pai) return true;
  return false;
}

export type SocialPostEditCapabilities = {
  readOnly: boolean;
  readOnlyReason: string | null;
  canEditContent: boolean;
  canEditSchedule: boolean;
  canEditAccount: boolean;
  /** Campaign media attachment — same states as content for governed posts. */
  canEditAsset: boolean;
  canResubmitAfterRejection: boolean;
};

/**
 * What the UI may offer for this row (server is authoritative on PATCH).
 */
export function getSocialPostEditCapabilities(args: {
  post: typeof campaignPosts.$inferSelect;
  /** Reserved for future stricter caps when session/UI gate differs from env. */
  workerRequiresApproval: boolean;
}): SocialPostEditCapabilities {
  void args.workerRequiresApproval;
  const st = String(args.post.status || "").toUpperCase();
  if (st === "POSTED" || st === "PUBLISHING") {
    return {
      readOnly: true,
      readOnlyReason: "Published or currently publishing — copy is frozen.",
      canEditContent: false,
      canEditSchedule: false,
      canEditAccount: false,
      canEditAsset: false,
      canResubmitAfterRejection: false,
    };
  }

  const utm = utmRecord(args.post.utmParams);
  const stored = parsePublishApprovalFromUtm(utm).status;

  if (st === "FAILED" || st === "RETRY_SCHEDULED") {
    return {
      readOnly: false,
      readOnlyReason: null,
      canEditContent: true,
      canEditSchedule: true,
      canEditAccount: true,
      canEditAsset: true,
      canResubmitAfterRejection: false,
    };
  }

  if (stored === "rejected") {
    return {
      readOnly: false,
      readOnlyReason: null,
      canEditContent: true,
      canEditSchedule: true,
      canEditAccount: true,
      canEditAsset: true,
      canResubmitAfterRejection: true,
    };
  }

  // Draft / scheduled paths
  return {
    readOnly: false,
    readOnlyReason: null,
    canEditContent: true,
    canEditSchedule: true,
    canEditAccount: true,
    canEditAsset: true,
    canResubmitAfterRejection: false,
  };
}

/**
 * After field updates, optionally re-seed `pending_approval` when approval is required and material changed or resubmit requested.
 */
export function mergeUtmAfterSocialPostEdit(args: {
  prevUtm: Record<string, string>;
  campaignPublishApprovalChainJson: unknown;
  actor: ResolvedPublishApprovalActor;
  nowIso: string;
  workerRequiresApproval: boolean;
  /** True when client sends `resubmitForApproval` for a rejected post. */
  resubmitForApproval: boolean;
  storedApprovalStatus: RevenueOsPublishApprovalStatus;
  materialChanged: boolean;
}): { utmParams: Record<string, string>; approvalReset: boolean } {
  const chain = parseCampaignPublishApprovalChainJson(args.campaignPublishApprovalChainJson);
  const multi = Boolean(chain && isMultiStepPublishApprovalChain(chain));

  let approvalReset = false;
  let nextUtm = { ...args.prevUtm };

  const needPending =
    args.workerRequiresApproval &&
    args.materialChanged &&
    args.storedApprovalStatus !== "rejected" &&
    (args.storedApprovalStatus === "approved" ||
      args.storedApprovalStatus === "pending_approval" ||
      args.storedApprovalStatus === "not_required");

  if (args.resubmitForApproval) {
    if (args.storedApprovalStatus !== "rejected") {
      return { utmParams: nextUtm, approvalReset: false };
    }
    approvalReset = true;
    if (args.workerRequiresApproval) {
      if (multi && chain) {
        const first = requiredReviewerRoleForChainStep(chain, 0);
        nextUtm = mergePublishApprovalGovernanceIntoUtm({
          base: nextUtm,
          status: "pending_approval",
          actor: args.actor,
          nowIso: args.nowIso,
          pendingChainSeed: first
            ? { totalSteps: chain.steps.length, stepIndex: 0, requiredRole: first }
            : null,
        });
      } else {
        nextUtm = mergePublishApprovalGovernanceIntoUtm({
          base: nextUtm,
          status: "pending_approval",
          actor: args.actor,
          nowIso: args.nowIso,
        });
      }
    } else {
      nextUtm = mergePublishApprovalGovernanceIntoUtm({
        base: nextUtm,
        status: "not_required",
        actor: args.actor,
        nowIso: args.nowIso,
      });
    }
    return { utmParams: nextUtm, approvalReset: true };
  }

  if (needPending) {
    approvalReset = true;
    if (multi && chain) {
      const first = requiredReviewerRoleForChainStep(chain, 0);
      nextUtm = mergePublishApprovalGovernanceIntoUtm({
        base: nextUtm,
        status: "pending_approval",
        actor: args.actor,
        nowIso: args.nowIso,
        pendingChainSeed: first
          ? { totalSteps: chain.steps.length, stepIndex: 0, requiredRole: first }
          : null,
      });
    } else {
      nextUtm = mergePublishApprovalGovernanceIntoUtm({
        base: nextUtm,
        status: "pending_approval",
        actor: args.actor,
        nowIso: args.nowIso,
      });
    }
  }

  return { utmParams: nextUtm, approvalReset };
}

export function buildPublishReadinessMessage(args: {
  post: typeof campaignPosts.$inferSelect;
  workerRequiresApproval: boolean;
  now?: Date;
  linkedAssetCreativeType?: string | null;
}): string {
  const now = args.now ?? new Date();
  const utm = utmRecord(args.post.utmParams);
  const st = String(args.post.status || "").toUpperCase();
  const parsed = parsePublishApprovalFromUtm(utm);
  const gate =
    st === "SCHEDULED" || st === "RETRY_SCHEDULED"
      ? canScheduledPostPublishUnderApprovalMode({ requireApproval: args.workerRequiresApproval, utmParams: utm })
      : { ok: true as const };

  if (st === "POSTED") return "Published";
  if (st === "PUBLISHING") return "Publishing in progress";
  if (st === "FAILED") return "Failed to publish — edit and reschedule if needed.";
  const plat = String(args.post.platform || "").toLowerCase();
  if (plat === "instagram" && !args.post.assetId) {
    return "Instagram — attach a campaign image or video asset before this post can publish (API requires media).";
  }
  if (
    plat === "instagram" &&
    args.post.assetId &&
    args.linkedAssetCreativeType != null &&
    String(args.linkedAssetCreativeType).trim() !== "" &&
    !isCreativeTypeAllowedForProviderMedia("instagram", args.linkedAssetCreativeType)
  ) {
    return "Instagram — replace the linked asset with IMAGE or VIDEO (current creative type is not publishable).";
  }
  if (parsed.status === "rejected") return "Rejected — revise and resubmit for approval.";
  if (!gate.ok) {
    if (parsed.status === "pending_approval" || gate.reason.includes("approval")) {
      return "Waiting for approval before scheduled publish.";
    }
    return gate.reason;
  }
  if (st === "SCHEDULED" || st === "RETRY_SCHEDULED") {
    const when = args.post.scheduledAt;
    if (when && when instanceof Date && when > now) return "Scheduled and ready — will publish after the scheduled time when due.";
    if (when && when instanceof Date && when <= now) return "Due — worker should publish soon if approved.";
    return "Scheduled and ready.";
  }
  if (parsed.status === "pending_approval") return "Waiting for approval.";
  if (parsed.status === "approved") return "Approved — schedule a time to publish or wait for the worker.";
  return "Draft — set schedule and complete approval if required.";
}

/** Hours after step start to flag “overdue” in UI (lightweight; SLA scans remain authoritative). */
const APPROVAL_OVERDUE_HOURS = 48;

export function isApprovalOverdueUiHint(args: {
  approvalStatus: RevenueOsPublishApprovalStatus;
  approvalStepStartedAt: string | null;
  now?: Date;
}): boolean {
  if (args.approvalStatus !== "pending_approval" || !args.approvalStepStartedAt) return false;
  const t = Date.parse(args.approvalStepStartedAt);
  if (!Number.isFinite(t)) return false;
  const now = args.now ?? new Date();
  return now.getTime() - t > APPROVAL_OVERDUE_HOURS * 3600000;
}
