import { NextRequest, NextResponse } from "next/server";
import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import {
  socialEngagementMessages,
  socialEngagementRuleApplications,
  socialEngagementRules,
  socialEngagementThreads,
} from "@/lib/db/schema";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { batchInboxListEnrichment } from "@/lib/social/engagement/inbox-batched-list";
import { aggregateInboxInsights, type InboxInsightInput } from "@/lib/social/engagement/engagement-insights";

/**
 * GET /api/revenue-os/inbox/insights?clientId=&days=7
 */
export async function GET(req: NextRequest) {
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const clientId = (searchParams.get("clientId") || "").trim();
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  const days = Math.min(30, Math.max(1, Number(searchParams.get("days") || "7") || 7));
  const since = new Date(Date.now() - days * 86400_000);
  const db = await getDb();
  const rows = await db
    .select()
    .from(socialEngagementThreads)
    .where(
      and(
        eq(socialEngagementThreads.userId, String(userId)),
        eq(socialEngagementThreads.clientId, clientId),
        gte(socialEngagementThreads.lastMessageAt, since)
      )
    )
    .orderBy(desc(socialEngagementThreads.lastMessageAt))
    .limit(500);
  const threadIds = rows.map((r) => r.id);
  const campMap = new Map<string, string | null>();
  for (const t of rows) {
    campMap.set(t.id, t.campaignId);
  }
  const batch = threadIds.length
    ? await batchInboxListEnrichment(db, { threadIds, campaignIdByThread: campMap })
    : null;

  const msgSinceRows = await db
    .select({ c: count() })
    .from(socialEngagementMessages)
    .innerJoin(socialEngagementThreads, eq(socialEngagementThreads.id, socialEngagementMessages.threadId))
    .where(
      and(
        eq(socialEngagementThreads.userId, String(userId)),
        eq(socialEngagementThreads.clientId, clientId),
        gte(socialEngagementMessages.createdAt, since)
      )
    );
  const messagesInPeriod = Number(msgSinceRows[0]?.c ?? 0);

  const ruleRows = await db
    .select({ id: socialEngagementRules.id })
    .from(socialEngagementRules)
    .where(and(eq(socialEngagementRules.userId, String(userId)), eq(socialEngagementRules.clientId, clientId)));
  const rids = ruleRows.map((r) => r.id);
  let rulesFiredInPeriod = 0;
  if (rids.length) {
    const rfc = await db
      .select({ c: count() })
      .from(socialEngagementRuleApplications)
      .where(
        and(gte(socialEngagementRuleApplications.createdAt, since), inArray(socialEngagementRuleApplications.ruleId, rids))
      );
    rulesFiredInPeriod = Number(rfc[0]?.c ?? 0);
  }

  const inputs: InboxInsightInput[] = [];
  for (const t of rows) {
    const preview = batch?.previewBy.get(t.id) ?? "";
    const requiresManual = Boolean(t.requiresManual || String(t.status) === "manual_only");
    inputs.push({
      id: t.id,
      sourceType: String(t.sourceType),
      intent: t.intent ? String(t.intent) : null,
      sentiment: t.sentiment ? String(t.sentiment) : null,
      status: String(t.status),
      requiresManual,
      lastMessageAt: t.lastMessageAt,
      preview,
      provider: String(t.provider),
      metadataJson: t.metadataJson,
    });
  }
  const summary = aggregateInboxInsights(inputs);
  return NextResponse.json({
    days,
    since: since.toISOString(),
    ...summary,
    messagesInPeriod,
    rulesFiredInPeriod,
  });
}
