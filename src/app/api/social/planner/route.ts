import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaignPosts, campaignReviewerAssignments, campaigns, socialAccounts } from "@/lib/db/schema";
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { mergeOwnedAndAssignedCampaignRows } from "@/lib/revenue-os/list-accessible-campaigns";
import {
  buildPublishingPlannerItems,
  groupPublishingPlannerItemsByDay,
} from "@/lib/social/publishing-planner";
import { fetchLinkedAssetCreativeTypeMap } from "@/lib/social/social-governed-post-public";
import { defaultSocialAccountLabelForPlatform, isGovernedSocialPublishPlatform } from "@/lib/social/social-governed-platforms";
import { getLatestAnalyticsSnapshotRowsForPostIds } from "@/lib/social/governed-post-analytics-store";
import { plannerAnalyticsHint } from "@/lib/social/governed-post-analytics-public";
import { fetchCampaignIdsWithActiveExternalReviewToken } from "@/lib/social/external-social-review-operator-db";

function parseDateParam(s: string | null, fallback: Date): Date {
  const t = s?.trim();
  if (!t) return fallback;
  const d = new Date(t.length <= 10 ? `${t}T00:00:00.000Z` : t);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

function defaultMonthRangeUtc(): { from: Date; toExclusive: Date } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return {
    from: new Date(Date.UTC(y, m, 1)),
    toExclusive: new Date(Date.UTC(y, m + 1, 1)),
  };
}

/**
 * GET /api/social/planner?clientId=&from=&to=&campaignId=&provider=linkedin|facebook|instagram
 * Normalized planner rows for accessible campaigns in the client scope.
 */
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId")?.trim() ?? "";
    if (!clientId) {
      return NextResponse.json(
        { error: "MISSING_CLIENT_ID", message: "clientId query parameter is required." },
        { status: 400 }
      );
    }

    const campaignIdFilter = searchParams.get("campaignId")?.trim() || "";
    const providerRaw = searchParams.get("provider")?.trim().toLowerCase() || "linkedin";
    if (!isGovernedSocialPublishPlatform(providerRaw)) {
      return NextResponse.json(
        {
          error: "INVALID_PROVIDER",
          message: `provider must be one of: linkedin, facebook, instagram.`,
        },
        { status: 400 }
      );
    }
    const provider = providerRaw;

    const { from: defFrom, toExclusive: defTo } = defaultMonthRangeUtc();
    const from = parseDateParam(searchParams.get("from"), defFrom);
    const toExclusive = parseDateParam(searchParams.get("to"), defTo);
    if (toExclusive.getTime() <= from.getTime()) {
      return NextResponse.json({ error: "INVALID_RANGE", message: "`to` must be after `from`." }, { status: 400 });
    }

    const db = await getDb();

    const ownedRows = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.userId, String(userId)), eq(campaigns.clientId, clientId)))
      .orderBy(desc(campaigns.createdAt))
      .limit(100);

    const assignedJoined = await db
      .select({
        campaign: campaigns,
        assignmentRole: campaignReviewerAssignments.role,
      })
      .from(campaignReviewerAssignments)
      .innerJoin(campaigns, eq(campaignReviewerAssignments.campaignId, campaigns.id))
      .where(and(eq(campaignReviewerAssignments.userId, String(userId)), eq(campaigns.clientId, clientId)))
      .orderBy(desc(campaigns.createdAt))
      .limit(100);

    const merged = mergeOwnedAndAssignedCampaignRows({
      ownedRows,
      assignedRows: assignedJoined.map((j) => ({
        campaign: j.campaign,
        assignmentRole: j.assignmentRole,
      })),
    }).slice(0, 50);

    let scoped = merged;
    if (campaignIdFilter) {
      scoped = merged.filter((m) => m.campaign.id === campaignIdFilter);
      if (scoped.length === 0) {
        return NextResponse.json({ error: "NOT_FOUND", message: "Campaign not found for this client." }, { status: 404 });
      }
    }

    const campaignIds = scoped.map((m) => m.campaign.id);
    if (campaignIds.length === 0) {
      return NextResponse.json({
        from: from.toISOString(),
        toExclusive: toExclusive.toISOString(),
        items: [],
        groups: [],
      });
    }

    const dateOr = or(
      and(
        isNotNull(campaignPosts.scheduledAt),
        gte(campaignPosts.scheduledAt, from),
        lt(campaignPosts.scheduledAt, toExclusive)
      ),
      and(
        isNotNull(campaignPosts.postedAt),
        gte(campaignPosts.postedAt, from),
        lt(campaignPosts.postedAt, toExclusive)
      ),
      and(
        isNull(campaignPosts.scheduledAt),
        gte(campaignPosts.updatedAt, from),
        lt(campaignPosts.updatedAt, toExclusive)
      )
    );

    const rows = await db
      .select()
      .from(campaignPosts)
      .where(
        and(
          inArray(campaignPosts.campaignId, campaignIds),
          eq(campaignPosts.platform, provider),
          dateOr
        )
      )
      .orderBy(desc(campaignPosts.updatedAt))
      .limit(500);

    const accIds = [...new Set(rows.map((r) => r.socialAccountId).filter(Boolean) as string[])];
    const accRows =
      accIds.length > 0
        ? await db.select().from(socialAccounts).where(inArray(socialAccounts.id, accIds))
        : [];
    const socialAccountDisplayById: Record<string, string> = {};
    for (const a of accRows) {
      socialAccountDisplayById[a.id] = a.displayName?.trim() || defaultSocialAccountLabelForPlatform(a.platform);
    }

    const creativeTypeByAssetId = await fetchLinkedAssetCreativeTypeMap(
      db,
      rows.map((r) => r.assetId)
    );

    const postedIds = rows.filter((r) => String(r.status || "").toUpperCase() === "POSTED").map((r) => r.id);
    const latestByPost =
      postedIds.length > 0 ? await getLatestAnalyticsSnapshotRowsForPostIds(db, postedIds) : new Map();
    const analyticsSummaryByPostId: Record<string, string | null> = {};
    for (const r of rows) {
      if (String(r.status || "").toUpperCase() !== "POSTED") continue;
      analyticsSummaryByPostId[r.id] = plannerAnalyticsHint({
        post: r,
        latestRow: latestByPost.get(r.id),
      });
    }

    const activeClientReviewByCampaign = await fetchCampaignIdsWithActiveExternalReviewToken(db, campaignIds);

    const items = buildPublishingPlannerItems({
      rows,
      socialAccountDisplayById,
      creativeTypeByAssetId,
      analyticsSummaryByPostId,
    }).map((item) => ({
      ...item,
      hasActiveClientReviewLink: activeClientReviewByCampaign.has(item.campaignId),
    }));
    const groups = groupPublishingPlannerItemsByDay(items).map((g) => ({
      dayKey: g.dayKey,
      itemIds: g.items.map((i) => i.id),
    }));

    return NextResponse.json({
      from: from.toISOString(),
      toExclusive: toExclusive.toISOString(),
      items,
      groups,
    });
  } catch (e) {
    console.error("[social/planner GET]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
