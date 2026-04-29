import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  socialEngagementRuleApplications,
  socialEngagementRules,
  socialEngagementThreadLabels,
  socialEngagementLabels,
  socialEngagementAssignments,
  socialEngagementThreads,
  type SocialAccountRow,
} from "@/lib/db/schema";
import { buildBentleyEngagementSuggestion, persistSuggestion } from "@/lib/revenue-os/bentley-engagement-suggestion";
import { resolveSocialEngagementCapabilities, type SocialEngagementSourceType } from "@/lib/social/engagement/social-engagement-capabilities";
import type { EngagementRuleActionsV1, EngagementRuleConditionsV1 } from "@/lib/social/engagement/engagement-rule-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const UNASSIGNED_USER = "unassigned" as const;

export function engagementRuleMatches(
  c: EngagementRuleConditionsV1,
  args: { text: string; sourceType: string; intent: string | null; sentiment: string | null }
): boolean {
  if (c.sourceTypeEquals && c.sourceTypeEquals !== (args.sourceType as EngagementRuleConditionsV1["sourceTypeEquals"])) {
    return false;
  }
  if (c.intentEquals && c.intentEquals !== (args.intent as EngagementRuleConditionsV1["intentEquals"])) {
    return false;
  }
  if (c.sentimentEquals && c.sentimentEquals !== (args.sentiment as EngagementRuleConditionsV1["sentimentEquals"])) {
    return false;
  }
  if (c.keywordsAny?.length) {
    const low = args.text.toLowerCase();
    if (!c.keywordsAny.some((k) => low.includes(String(k).toLowerCase()))) {
      return false;
    }
  }
  return true;
}

async function getOrCreateLabel(
  db: Db,
  args: { userId: string; clientId: string; slug: string; displayName: string }
): Promise<string> {
  const existing = await db
    .select()
    .from(socialEngagementLabels)
    .where(and(eq(socialEngagementLabels.clientId, args.clientId), eq(socialEngagementLabels.slug, args.slug)))
    .limit(1);
  if (existing[0]) return String(existing[0].id);
  const id = randomUUID();
  await db.insert(socialEngagementLabels).values({
    id,
    userId: args.userId,
    clientId: args.clientId,
    slug: args.slug,
    displayName: args.displayName,
    colorHex: null,
  });
  return id;
}

/**
 * On ingest, apply active client rules once per (thread, rule). Idempotent via `social_engagement_rule_applications`.
 */
export async function applyEngagementRulesOnIngest(
  db: Db,
  args: {
    userId: string;
    clientId: string;
    thread: typeof socialEngagementThreads.$inferSelect;
    /** Latest inbound / thread-driving text. */
    text: string;
    sourceType: SocialEngagementSourceType;
    flagsOverride: unknown;
    socialAccount: SocialAccountRow | null;
  }
): Promise<void> {
  const { thread } = args;
  const rules = await db
    .select()
    .from(socialEngagementRules)
    .where(and(eq(socialEngagementRules.clientId, args.clientId), eq(socialEngagementRules.isActive, true)));
  if (!rules.length) return;

  const intent = (thread as { intent?: string | null }).intent ?? null;
  const sentiment = (thread as { sentiment?: string | null }).sentiment ?? null;
  for (const rule of rules) {
    const applied = await db
      .select({ id: socialEngagementRuleApplications.id })
      .from(socialEngagementRuleApplications)
      .where(
        and(eq(socialEngagementRuleApplications.threadId, thread.id), eq(socialEngagementRuleApplications.ruleId, rule.id))
      )
      .limit(1);
    if (applied[0]) continue;

    const cond = (rule.conditionsJson ?? {}) as EngagementRuleConditionsV1;
    if (!engagementRuleMatches(cond, { text: args.text, sourceType: args.sourceType, intent, sentiment })) {
      continue;
    }
    const actions = (rule.actionsJson ?? {}) as EngagementRuleActionsV1;
    if (Object.keys(actions).length === 0) {
      continue;
    }

    if (actions.addLabelSlug) {
      const slug = actions.addLabelSlug.replace(/\s+/g, "-").toLowerCase().slice(0, 64) || "rule";
      const display = (actions.addLabelDisplayName || slug).slice(0, 160);
      const labelId = await getOrCreateLabel(db, { userId: args.userId, clientId: args.clientId, slug, displayName: display });
      const tj = await db
        .select()
        .from(socialEngagementThreadLabels)
        .where(and(eq(socialEngagementThreadLabels.threadId, thread.id), eq(socialEngagementThreadLabels.labelId, labelId)))
        .limit(1);
      if (!tj[0]) {
        await db.insert(socialEngagementThreadLabels).values({ threadId: thread.id, labelId, createdAt: new Date() });
      }
    }

    if (actions.assignRole) {
      const id = randomUUID();
      await db.insert(socialEngagementAssignments).values({
        id,
        threadId: thread.id,
        assignedUserId: UNASSIGNED_USER,
        assignedRole: actions.assignRole.slice(0, 64),
        createdAt: new Date(),
      });
    }
    if (actions.attachBentleySuggestion) {
      const cap = resolveSocialEngagementCapabilities({
        provider: thread.provider,
        flagsOverride: args.flagsOverride as never,
        socialAccount: args.socialAccount,
        sourceType: args.sourceType,
      });
      const sug = buildBentleyEngagementSuggestion({
        text: args.text,
        sourceType: args.sourceType,
        provider: thread.provider,
        capabilities: cap,
      });
      await persistSuggestion(db, thread.id, sug);
    }

    const appId = randomUUID();
    await db.insert(socialEngagementRuleApplications).values({ id: appId, threadId: thread.id, ruleId: rule.id });
  }
}
