import { eq, inArray } from "drizzle-orm";
import type { campaigns, campaignPosts } from "@/lib/db/schema";
import { campaignExternalSocialReviewTokens, campaignPosts, campaigns, socialAccounts } from "@/lib/db/schema";
import {
  clampAwaitingChainStepIndex,
  isMultiStepPublishApprovalChain,
  parseCampaignPublishApprovalChainJson,
  requiredReviewerRoleForChainStep,
} from "@/lib/revenue-os/publish-approval-chain";
import { readScheduledPublishRequireApprovalEnv } from "@/lib/revenue-os/publish-approval-gate";
import { resolveEffectiveApprovalStatus } from "@/lib/revenue-os/build-publish-approval-summary";
import { parsePublishApprovalFromUtm } from "@/lib/revenue-os/publish-approval-utm";
import type { PublishApprovalChainRequiredRole } from "@/lib/revenue-os/publish-approval-chain";
import {
  defaultSocialAccountLabelForPlatform,
  isGovernedSocialPublishPlatform,
} from "@/lib/social/social-governed-platforms";
import {
  hashExternalSocialReviewTokenRaw,
  parseExternalReviewAllowedRolesJson,
  timingSafeEqualTokenHash,
  type ExternalReviewAllowedRole,
} from "@/lib/social/external-social-review-token";
import { fetchLinkedAssetCreativeTypeMap } from "@/lib/social/social-governed-post-public";

function utmRecord(utmParams: unknown): Record<string, string> | null {
  if (!utmParams || typeof utmParams !== "object" || Array.isArray(utmParams)) return null;
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

/**
 * Logical role the external queue is waiting on (non-pending → null).
 * Single-step / no chain: treat as **approver** (client sign-off).
 */
export function getAwaitingRoleForExternalSocialReview(
  chain: ReturnType<typeof parseCampaignPublishApprovalChainJson>,
  parsed: ReturnType<typeof parsePublishApprovalFromUtm>
): PublishApprovalChainRequiredRole | null {
  if (parsed.status !== "pending_approval") return null;
  if (chain && isMultiStepPublishApprovalChain(chain)) {
    const idx = clampAwaitingChainStepIndex(chain, parsed.currentApprovalStepIndex);
    return requiredReviewerRoleForChainStep(chain, idx);
  }
  return "approver";
}

export function externalAllowedRolesCoverAwaitingRole(
  allowed: ExternalReviewAllowedRole[],
  awaiting: PublishApprovalChainRequiredRole | null
): boolean {
  if (!awaiting) return false;
  return allowed.includes(awaiting);
}

export function campaignPostVisibleOnExternalSocialReviewQueue(args: {
  post: typeof campaignPosts.$inferSelect;
  campaign: typeof campaigns.$inferSelect;
  allowedRoles: ExternalReviewAllowedRole[];
}): boolean {
  const { post, allowedRoles } = args;
  if (!isGovernedSocialPublishPlatform(post.platform)) return false;
  const st = String(post.status || "").toUpperCase();
  if (st === "POSTED" || st === "PUBLISHING") return false;

  const workerRequiresApproval = readScheduledPublishRequireApprovalEnv();
  const utm = utmRecord(post.utmParams);
  const effective = resolveEffectiveApprovalStatus(workerRequiresApproval, utm);
  if (effective !== "pending_approval") return false;

  const parsed = parsePublishApprovalFromUtm(utm);
  const chain = parseCampaignPublishApprovalChainJson(args.campaign.publishApprovalChainJson);
  const awaiting = getAwaitingRoleForExternalSocialReview(chain, parsed);
  return externalAllowedRolesCoverAwaitingRole(allowedRoles, awaiting);
}

export type ExternalSocialReviewTokenContext = {
  tokenRow: typeof campaignExternalSocialReviewTokens.$inferSelect;
  campaign: typeof campaigns.$inferSelect;
  allowedRoles: ExternalReviewAllowedRole[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolveExternalSocialReviewTokenContext(
  db: any,
  rawToken: string
): Promise<ExternalSocialReviewTokenContext | null> {
  const trimmed = rawToken?.trim();
  if (!trimmed) return null;
  const hash = hashExternalSocialReviewTokenRaw(trimmed);
  const rows = await db
    .select()
    .from(campaignExternalSocialReviewTokens)
    .where(eq(campaignExternalSocialReviewTokens.tokenHash, hash))
    .limit(1);
  const tokenRow = rows[0];
  if (!tokenRow) return null;
  if (!timingSafeEqualTokenHash(trimmed, tokenRow.tokenHash)) return null;
  if (tokenRow.revokedAt) return null;
  if (tokenRow.expiresAt) {
    const exp = tokenRow.expiresAt instanceof Date ? tokenRow.expiresAt : new Date(tokenRow.expiresAt);
    if (exp.getTime() < Date.now()) return null;
  }

  const campRows = await db.select().from(campaigns).where(eq(campaigns.id, tokenRow.campaignId)).limit(1);
  const campaign = campRows[0];
  if (!campaign) return null;

  const allowedRoles = parseExternalReviewAllowedRolesJson(tokenRow.allowedRolesJson);

  return { tokenRow, campaign, allowedRoles };
}

export type ExternalSocialReviewPostDto = {
  id: string;
  provider: string;
  accountLabel: string | null;
  content: string;
  linkUrl: string | null;
  mediaSummary: string | null;
  scheduledFor: string | null;
  approvalStatus: string;
  rejectionReason: string | null;
  updatedAt: string | null;
  canDecide: boolean;
  awaitingRole: PublishApprovalChainRequiredRole | null;
  approvalReviewSnapshot: {
    expectedApprovalStatus: string;
    postUpdatedAt: string;
    expectedApprovalStepIndex?: number;
  };
};

function buildSnapshotForPost(
  post: typeof campaignPosts.$inferSelect,
  campaign: typeof campaigns.$inferSelect
): ExternalSocialReviewPostDto["approvalReviewSnapshot"] {
  const utm = utmRecord(post.utmParams);
  const parsed = parsePublishApprovalFromUtm(utm);
  const chain = parseCampaignPublishApprovalChainJson(campaign.publishApprovalChainJson);
  const awaitingIdx =
    chain && isMultiStepPublishApprovalChain(chain) && parsed.status === "pending_approval"
      ? clampAwaitingChainStepIndex(chain, parsed.currentApprovalStepIndex)
      : undefined;
  return {
    expectedApprovalStatus: parsed.status,
    postUpdatedAt: iso(post.updatedAt) ?? new Date().toISOString(),
    ...(awaitingIdx != null ? { expectedApprovalStepIndex: awaitingIdx } : {}),
  };
}

export async function buildExternalSocialReviewPostDto(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  post: typeof campaignPosts.$inferSelect;
  campaign: typeof campaigns.$inferSelect;
  allowedRoles: ExternalReviewAllowedRole[];
  socialAccountDisplayById: Record<string, string>;
  creativeTypeByAssetId: Record<string, string | null>;
}): Promise<ExternalSocialReviewPostDto> {
  const { post, campaign, allowedRoles, socialAccountDisplayById, creativeTypeByAssetId } = args;
  const workerRequiresApproval = readScheduledPublishRequireApprovalEnv();
  const utm = utmRecord(post.utmParams);
  const effective = resolveEffectiveApprovalStatus(workerRequiresApproval, utm);
  const parsed = parsePublishApprovalFromUtm(utm);
  const chain = parseCampaignPublishApprovalChainJson(campaign.publishApprovalChainJson);
  const awaiting = getAwaitingRoleForExternalSocialReview(chain, parsed);
  const canDecide = campaignPostVisibleOnExternalSocialReviewQueue({ post, campaign, allowedRoles });

  const accLabel = post.socialAccountId
    ? socialAccountDisplayById[post.socialAccountId] ??
      defaultSocialAccountLabelForPlatform(post.platform)
    : null;
  const ct = post.assetId ? creativeTypeByAssetId[post.assetId] ?? null : null;
  const mediaSummary = ct ? `Attached: ${ct}` : post.assetId ? "Media attached" : null;

  return {
    id: post.id,
    provider: post.platform,
    accountLabel: accLabel,
    content: post.caption ?? "",
    linkUrl: post.linkUrl ?? null,
    mediaSummary,
    scheduledFor: iso(post.scheduledAt),
    approvalStatus: effective,
    rejectionReason: parsed.approvalReason ?? null,
    updatedAt: iso(post.updatedAt),
    canDecide,
    awaitingRole: awaiting,
    approvalReviewSnapshot: buildSnapshotForPost(post, campaign),
  };
}

export async function listExternalSocialReviewPostsForTokenContext(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  ctx: ExternalSocialReviewTokenContext;
}): Promise<ExternalSocialReviewPostDto[]> {
  const { db, ctx } = args;
  const rows = await db
    .select()
    .from(campaignPosts)
    .where(eq(campaignPosts.campaignId, ctx.campaign.id));

  const governed = rows.filter(
    (p: typeof campaignPosts.$inferSelect) =>
      isGovernedSocialPublishPlatform(p.platform) &&
      String(p.status || "").toUpperCase() !== "POSTED" &&
      String(p.status || "").toUpperCase() !== "PUBLISHING"
  );

  const accIds = [...new Set(governed.map((p: typeof campaignPosts.$inferSelect) => p.socialAccountId).filter(Boolean))] as string[];
  const accRows =
    accIds.length > 0 ? await db.select().from(socialAccounts).where(inArray(socialAccounts.id, accIds)) : [];
  const socialAccountDisplayById: Record<string, string> = {};
  for (const a of accRows) {
    socialAccountDisplayById[a.id] = a.displayName?.trim() || defaultSocialAccountLabelForPlatform(a.platform);
  }

  const creativeTypeByAssetId = await fetchLinkedAssetCreativeTypeMap(
    db,
    governed.map((p: typeof campaignPosts.$inferSelect) => p.assetId)
  );

  const out: ExternalSocialReviewPostDto[] = [];
  for (const post of governed) {
    out.push(
      await buildExternalSocialReviewPostDto({
        db,
        post,
        campaign: ctx.campaign,
        allowedRoles: ctx.allowedRoles,
        socialAccountDisplayById,
        creativeTypeByAssetId,
      })
    );
  }
  return out.sort((a, b) => {
    const da = a.canDecide ? 0 : 1;
    const db_ = b.canDecide ? 0 : 1;
    if (da !== db_) return da - db_;
    return (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? "");
  });
}
