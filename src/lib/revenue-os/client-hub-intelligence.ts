/**
 * Client Hub decision engine: health scoring and next-best-action ranking.
 * Does not import `client-hub-queries` — safe to import from queries after ownership is verified.
 */
import { and, count, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { campaigns, campaignPosts, crm_contacts, crm_conversations } from "@/lib/db/schema";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { mysqlRows } from "@/lib/site-builder/db";
import { getOwnedClientRow } from "@/lib/revenue-os/client-hub-ownership";
import { getClientHubRollupForOwnedClient } from "@/lib/revenue-os/client-hub-rollup";
import type { ClientAccountRow, ClientHealthSnapshot, ClientHubRollup } from "@/lib/revenue-os/client-hub-types";

const LAUNCHED = ["LIVE", "COMPLETED"] as const;

/** Matches `crm_contacts.email NOT LIKE 'webchat+%'` (synthetic widget rows). */
export const SYNTHETIC_WEBCHAT_EMAIL_LIKE = "webchat+%";

/**
 * Mirrors batch SQL email filter for tests: null emails count; `webchat+…` excluded (case-insensitive).
 */
export function emailEligibleForLeadFollowUpMetrics(email: string | null | undefined): boolean {
  if (email == null) return true;
  return !email.toLowerCase().startsWith("webchat+");
}

/**
 * Mirrors batch SQL `customFields.clientHub.followUp` semantics for tests.
 * Missing = absent, empty string, boolean false, or string `"false"`.
 */
export function customFieldsIndicatesMissingClientHubFollowUp(customFields: unknown): boolean {
  if (customFields == null || typeof customFields !== "object" || Array.isArray(customFields)) return true;
  const hub = (customFields as Record<string, unknown>).clientHub;
  if (hub == null || typeof hub !== "object" || Array.isArray(hub)) return true;
  const fu = (hub as Record<string, unknown>).followUp;
  if (fu === undefined || fu === null) return true;
  if (fu === false) return true;
  if (typeof fu === "string") {
    const t = fu.trim();
    return t === "" || t.toLowerCase() === "false";
  }
  return true;
}

/** Raw SQL predicate: non-synthetic lead + missing Client Hub follow-up (keep in sync with TS helpers above). */
const CRM_MISSING_FOLLOW_UP_WHERE = sql.raw(`(
  (email IS NULL OR email NOT LIKE 'webchat+%')
  AND (
    customFields IS NULL
    OR JSON_EXTRACT(customFields, '$.clientHub.followUp') IS NULL
    OR JSON_TYPE(JSON_EXTRACT(customFields, '$.clientHub.followUp')) = 'NULL'
    OR NOT (
      JSON_TYPE(JSON_EXTRACT(customFields, '$.clientHub.followUp')) = 'STRING'
      AND CHAR_LENGTH(TRIM(JSON_UNQUOTE(JSON_EXTRACT(customFields, '$.clientHub.followUp')))) > 0
      AND LOWER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(customFields, '$.clientHub.followUp')))) <> 'false'
    )
  )
)`);

export type NextBestClientActionResult = {
  /** Primary line shown in UI */
  summary: string;
  detail: string | null;
  /** Stable code for tests / analytics */
  code: string;
};

export type NextBestActionContext = {
  roll: ClientHubRollup;
  hasPrimarySite: boolean;
  hasPrimaryAgent: boolean;
  leadsMissingFollowUp: number;
  campaignsAnyTotal: number;
  automationEventsLast7Days: number;
};

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return (Date.now() - t) / (1000 * 60 * 60 * 24);
}

function statusFromScore(score: number): ClientHealthSnapshot["status"] {
  if (score >= 80) return "thriving";
  if (score >= 62) return "healthy";
  if (score >= 42) return "steady";
  return "at_risk";
}

function labelFromStatus(status: ClientHealthSnapshot["status"], score: number): string {
  switch (status) {
    case "thriving":
      return "Thriving";
    case "healthy":
      return "Healthy";
    case "steady":
      return "Steady";
    default:
      return score < 25 ? "Critical" : "At risk";
  }
}

/**
 * CRM contacts attributed to this client with no `clientHub.followUp` on `customFields`.
 * Caller must only invoke after `client_accounts` ownership is verified.
 */
export async function countLeadsMissingFollowUp(userId: number, clientId: string): Promise<number> {
  try {
    const db = await getDb();
    const raw = await db.execute(sql`
      SELECT COUNT(*) AS cnt
      FROM crm_contacts
      WHERE userId = ${userId}
        AND clientId = ${clientId}
        AND ${CRM_MISSING_FOLLOW_UP_WHERE}
    `);
    const row = mysqlRows(raw)[0] as Record<string, unknown> | undefined;
    return Number(row?.["cnt"] ?? row?.["CNT"] ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Per-client counts of CRM contacts missing a Client Hub follow-up note, in one query.
 * Only `userId` + `clientId IN (...)` rows are considered; excludes synthetic `webchat+%` emails.
 */
export async function countLeadsMissingFollowUpByClientIds(
  userId: number,
  clientIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (clientIds.length === 0) return out;
  for (const id of clientIds) out.set(id, 0);
  try {
    const db = await getDb();
    const idList = sql.join(
      clientIds.map((id) => sql`${id}`),
      sql`, `,
    );
    const raw = await db.execute(sql`
      SELECT clientId, COUNT(*) AS cnt
      FROM crm_contacts
      WHERE userId = ${userId}
        AND clientId IN (${idList})
        AND clientId IS NOT NULL
        AND ${CRM_MISSING_FOLLOW_UP_WHERE}
      GROUP BY clientId
    `);
    for (const row of mysqlRows(raw)) {
      const rec = row as Record<string, unknown>;
      const cid = String(rec["clientId"] ?? rec["clientid"] ?? "");
      if (cid && out.has(cid)) {
        out.set(cid, Number(rec["cnt"] ?? rec["CNT"] ?? 0));
      }
    }
  } catch {
    /* */
  }
  return out;
}

export async function countTotalCampaignsForClient(userId: number, clientId: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ n: count() })
    .from(campaigns)
    .where(and(eq(campaigns.userId, String(userId)), eq(campaigns.clientId, clientId)));
  return Number(rows[0]?.n ?? 0);
}

export async function countAutomationEventsLastDays(
  userId: number,
  clientId: string,
  days: number,
): Promise<number> {
  await ensureClientHubTables();
  try {
    const db = await getDb();
    const raw = await db.execute(
      sql`SELECT COUNT(*) AS cnt
          FROM client_hub_automation_events
          WHERE userId = ${userId}
            AND clientId = ${clientId}
            AND createdAt >= DATE_SUB(NOW(3), INTERVAL ${days} DAY)`,
    );
    const row = mysqlRows(raw)[0] as Record<string, unknown> | undefined;
    return Number(row?.["cnt"] ?? row?.["CNT"] ?? 0);
  } catch {
    return 0;
  }
}

export function computeClientHealthScoreFromRollup(
  roll: ClientHubRollup,
  opts: {
    leadsMissingFollowUp: number;
    campaignsAnyTotal: number;
    automationEventsLast7Days: number;
  },
): ClientHealthSnapshot {
  const issues: string[] = [];
  let score = 48;

  score += Math.min(22, roll.leadsCaptured * 2);
  score += Math.min(14, Math.floor(roll.conversationsOpened * 1.4));
  score += Math.min(12, roll.publishedPosts * 2);
  score += Math.min(10, roll.bookings * 3);
  if (roll.campaignsLaunched > 0) score += 8;
  else if (opts.campaignsAnyTotal > 0) score += 3;
  else {
    score -= 6;
    issues.push("No Revenue OS campaigns for this client yet.");
  }

  if (roll.activeSites > 0) score += 6;
  else {
    score -= 12;
    issues.push("No active site linked — visitors cannot reach an attributed experience.");
  }
  if (roll.activeAgents > 0) score += 6;
  else if (roll.activeSites > 0) {
    score -= 8;
    issues.push("Sites exist but no active AI agent binding detected.");
  }

  if (roll.openConversations > 0) {
    score -= 4 + Math.min(12, roll.openConversations * 2);
    issues.push(`${roll.openConversations} open conversation(s) may need a reply.`);
  }

  if (roll.leadsCaptured > 0 && opts.leadsMissingFollowUp > 0) {
    score -= Math.min(14, 4 + opts.leadsMissingFollowUp * 2);
    issues.push(
      `${opts.leadsMissingFollowUp} lead contact(s) have no logged follow-up in Client Hub.`,
    );
  }

  const staleDays = daysSince(roll.lastActivityAt);
  if (staleDays != null && staleDays > 30) {
    score -= 14;
    issues.push("No meaningful activity in over 30 days.");
  } else if (staleDays != null && staleDays > 14) {
    score -= 7;
    issues.push("Activity has been quiet for two weeks or more.");
  }

  if (opts.automationEventsLast7Days >= 2) score += 4;
  else if (opts.automationEventsLast7Days === 1) score += 2;

  if (roll.messagesExchanged === 0 && roll.leadsCaptured > 0) {
    score -= 4;
    if (issues.length < 6) issues.push("Leads exist but no CRM or widget message traffic yet.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const status = statusFromScore(score);
  const label = labelFromStatus(status, score);
  return { score, status, label, issues: issues.slice(0, 6) };
}

export function getNextBestClientActionFromContext(ctx: NextBestActionContext): NextBestClientActionResult {
  const { roll } = ctx;
  const stale =
    (() => {
      const d = daysSince(roll.lastActivityAt);
      return d != null && d > 14;
    })();

  if (roll.openConversations > 0) {
    return {
      code: "inbox_open",
      summary: "Respond to open conversations in the smart inbox.",
      detail: `${roll.openConversations} thread(s) are still open — closing the loop protects pipeline health.`,
    };
  }
  if (roll.leadsCaptured > 0 && ctx.leadsMissingFollowUp > 0) {
    return {
      code: "lead_followup",
      summary: "Log follow-ups on qualified leads from the inbox.",
      detail: `${ctx.leadsMissingFollowUp} contact(s) have no Client Hub follow-up note yet.`,
    };
  }
  if (ctx.campaignsAnyTotal === 0 && roll.leadsCaptured > 1) {
    return {
      code: "launch_campaign",
      summary: "Launch a client-scoped campaign to nurture this pipeline.",
      detail: "You have leads but no campaigns on file — add always-on social coverage.",
    };
  }
  if (stale && (roll.activeSites > 0 || roll.leadsCaptured > 0)) {
    return {
      code: "reengage",
      summary: "Re-engage this account: traffic, posts, or outbound touches.",
      detail: "Recent activity is thin — schedule a campaign burst or refresh site content.",
    };
  }
  if (ctx.automationEventsLast7Days > 0) {
    return {
      code: "review_automation",
      summary: "Review recent automation outcomes in the activity feed.",
      detail: `${ctx.automationEventsLast7Days} automation event(s) in the last 7 days — confirm CRM state matches playbook.`,
    };
  }
  if (!ctx.hasPrimarySite) {
    return {
      code: "add_site",
      summary: "Add a landing page and link it to this client.",
      detail: "Sites unlock widget attribution and clearer health signals.",
    };
  }
  if (!ctx.hasPrimaryAgent) {
    return {
      code: "attach_agent",
      summary: "Attach an AI agent to the primary site.",
      detail: "Embeds and inbox routing work best when an agent is live on the attributed site.",
    };
  }
  return {
    code: "review_campaigns",
    summary: "Review campaign performance in the Campaigns tab.",
    detail: "Pipeline looks stable — optimize post mix and scheduling next.",
  };
}

export async function computeClientHealthScore(
  userId: number,
  clientId: string,
): Promise<ClientHealthSnapshot | null> {
  const row = await getOwnedClientRow(userId, clientId);
  if (!row) return null;
  const roll = await getClientHubRollupForOwnedClient(userId, clientId, row as ClientAccountRow);
  const [leadsMissingFollowUp, campaignsAnyTotal, automationEventsLast7Days] = await Promise.all([
    countLeadsMissingFollowUp(userId, clientId),
    countTotalCampaignsForClient(userId, clientId),
    countAutomationEventsLastDays(userId, clientId, 7),
  ]);
  return computeClientHealthScoreFromRollup(roll, {
    leadsMissingFollowUp,
    campaignsAnyTotal,
    automationEventsLast7Days,
  });
}

export async function getNextBestClientAction(
  userId: number,
  clientId: string,
  extras?: Partial<
    Pick<NextBestActionContext, "hasPrimarySite" | "hasPrimaryAgent"> & {
      roll?: ClientHubRollup;
      leadsMissingFollowUp?: number;
      campaignsAnyTotal?: number;
      automationEventsLast7Days?: number;
    }
  >,
): Promise<NextBestClientActionResult | null> {
  const row = await getOwnedClientRow(userId, clientId);
  if (!row) return null;
  const roll =
    extras?.roll ??
    (await getClientHubRollupForOwnedClient(userId, clientId, row as ClientAccountRow));
  const [leadsMissingFollowUp, campaignsAnyTotal, automationEventsLast7Days] = await Promise.all([
    extras?.leadsMissingFollowUp ?? countLeadsMissingFollowUp(userId, clientId),
    extras?.campaignsAnyTotal ?? countTotalCampaignsForClient(userId, clientId),
    extras?.automationEventsLast7Days ?? countAutomationEventsLastDays(userId, clientId, 7),
  ]);
  return getNextBestClientActionFromContext({
    roll,
    hasPrimarySite: extras?.hasPrimarySite ?? roll.activeSites > 0,
    hasPrimaryAgent: extras?.hasPrimaryAgent ?? roll.activeAgents > 0,
    leadsMissingFollowUp,
    campaignsAnyTotal,
    automationEventsLast7Days,
  });
}

/** Batch: launched campaign counts per client (same owner). */
export async function countLaunchedCampaignsByClientIds(
  userId: number,
  clientIds: string[],
): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (clientIds.length === 0) return m;
  const db = await getDb();
  const rows = await db
    .select({ clientId: campaigns.clientId, n: count() })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.userId, String(userId)),
        inArray(campaigns.clientId, clientIds),
        inArray(campaigns.status, LAUNCHED as unknown as string[]),
      ),
    )
    .groupBy(campaigns.clientId);
  for (const r of rows) {
    if (r.clientId) m.set(r.clientId, Number(r.n ?? 0));
  }
  return m;
}

export async function countAnyCampaignsByClientIds(
  userId: number,
  clientIds: string[],
): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (clientIds.length === 0) return m;
  const db = await getDb();
  const rows = await db
    .select({ clientId: campaigns.clientId, n: count() })
    .from(campaigns)
    .where(and(eq(campaigns.userId, String(userId)), inArray(campaigns.clientId, clientIds)))
    .groupBy(campaigns.clientId);
  for (const r of rows) {
    if (r.clientId) m.set(r.clientId, Number(r.n ?? 0));
  }
  return m;
}

export async function countConversationsByClientIds(
  userId: number,
  clientIds: string[],
): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (clientIds.length === 0) return m;
  const db = await getDb();
  const rows = await db
    .select({ clientId: crm_contacts.clientId, n: count() })
    .from(crm_conversations)
    .innerJoin(crm_contacts, eq(crm_conversations.contactId, crm_contacts.id))
    .where(and(eq(crm_contacts.userId, userId), inArray(crm_contacts.clientId, clientIds)))
    .groupBy(crm_contacts.clientId);
  for (const r of rows) {
    if (r.clientId) m.set(r.clientId, Number(r.n ?? 0));
  }
  return m;
}

export async function countPostedPostsByClientIds(
  userId: number,
  clientIds: string[],
): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (clientIds.length === 0) return m;
  const db = await getDb();
  const rows = await db
    .select({ clientId: campaigns.clientId, n: count() })
    .from(campaignPosts)
    .innerJoin(campaigns, eq(campaignPosts.campaignId, campaigns.id))
    .where(
      and(
        eq(campaigns.userId, String(userId)),
        inArray(campaigns.clientId, clientIds),
        eq(campaignPosts.status, "POSTED"),
      ),
    )
    .groupBy(campaigns.clientId);
  for (const r of rows) {
    if (r.clientId) m.set(r.clientId, Number(r.n ?? 0));
  }
  return m;
}

export async function countBookingsByClientIds(
  userId: number,
  clientIds: string[],
): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (clientIds.length === 0) return m;
  const db = await getDb();
  const rows = await db
    .select({ clientId: crm_contacts.clientId, n: count() })
    .from(crm_conversations)
    .innerJoin(crm_contacts, eq(crm_conversations.contactId, crm_contacts.id))
    .where(
      and(
        eq(crm_contacts.userId, userId),
        inArray(crm_contacts.clientId, clientIds),
        or(sql`LOWER(${crm_conversations.channel}) = 'calendar'`, eq(crm_conversations.channel, "booking")),
      ),
    )
    .groupBy(crm_contacts.clientId);
  for (const r of rows) {
    if (r.clientId) m.set(r.clientId, Number(r.n ?? 0));
  }
  return m;
}
