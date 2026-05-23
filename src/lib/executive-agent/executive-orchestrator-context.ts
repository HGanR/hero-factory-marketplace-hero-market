import "server-only";

import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { EXECUTIVE_ADMIN_CAPABILITY_INJECTION } from "@/lib/agents/executive-admin-system-prompt";
import { listExecutiveMemoryItems } from "@/lib/executive-agent/executive-memory-store";
import { listExecutiveQuestionHistory } from "@/lib/executive-agent/executive-question-history-store";
import { searchExecutiveKnowledgeForPrompt } from "@/lib/executive-agent/executive-knowledge-store";
import { rollupSiteAnalyticsForExecutive } from "@/lib/analytics/site-analytics-store";
import { rollupApprovedUserActivity } from "@/lib/analytics/approved-user-activity";
import { formatExecutivePresenceContext } from "@/lib/executive-agent/executive-presence-service";
import { EXECUTIVE_CHIEF_OF_STAFF_VOICE } from "@/lib/executive-agent/executive-presence-engine";
import { listDepartmentMessagesForExecutiveAdmin } from "@/lib/executive-agent/executive-department-inbox-store";

type Db = MySql2Database<typeof schema>;

/**
 * Read-only desk context appended to the intent planner prompt (does not grant writes).
 */
export async function formatExecutiveDeskContext(
  db: Db,
  input: {
    adminUserId: number;
    prompt: string;
    selectedAgents?: string[] | null;
    dashboardMode?: string | null;
    selectedTimeRange?: string | null;
  },
): Promise<string> {
  const parts: string[] = [EXECUTIVE_ADMIN_CAPABILITY_INJECTION];
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rollup = await rollupSiteAnalyticsForExecutive(db, { since, landingPath: "/" });
    if (rollup && rollup.landingPageVisitors + rollup.joinCommunityClicks + rollup.outboundPayPalClicks > 0) {
      parts.push(
        `Site funnel (7d, landing ${rollup.landingPath}): visitors=${rollup.landingPageVisitors}, join_clicks=${rollup.joinCommunityClicks}, paypal_outbound=${rollup.outboundPayPalClicks}.`,
      );
      if (rollup.landingCtas.length > 0) {
        const topCtas = rollup.landingCtas
          .slice(0, 5)
          .map((c) => `${c.label}:${c.clicks}`)
          .join(", ");
        parts.push(`Top landing CTAs (7d): ${topCtas}.`);
      }
    }
  } catch {
    /* optional */
  }

  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const approved = await rollupApprovedUserActivity(db, { since, limit: 8 });
    if (!approved.unavailable) {
      parts.push(
        `Approved accounts (7d): ${approved.approvedActiveTotal} active, ${approved.loginsInWindow} login(s), ${approved.usersWithTrackedEvents} with tracked session events.`,
      );
      const active = approved.recentlyActive
        .filter((u) => u.eventsInWindow > 0 || u.lastLogin)
        .slice(0, 4)
        .map((u) => `${u.userLabel} events=${u.eventsInWindow}`)
        .join(", ");
      if (active) parts.push(`Recent approved activity: ${active}.`);
    }
  } catch {
    /* optional */
  }

  try {
    const presence = await formatExecutivePresenceContext(db, input.adminUserId, input.prompt);
    if (presence.trim()) parts.push(presence);
  } catch {
    /* optional */
  }

  parts.push(EXECUTIVE_CHIEF_OF_STAFF_VOICE);

  try {
    const mem = await listExecutiveMemoryItems(db, { adminUserId: input.adminUserId, limit: 12 });
    if (mem.length) {
      parts.push(
        `Saved executive memory (most recent): ${mem
          .map((m) => `[${m.memoryType}] ${m.title}: ${(m.summary ?? "").slice(0, 220)}`)
          .join(" | ")}`,
      );
    }
  } catch {
    /* optional */
  }

  try {
    const hist = await listExecutiveQuestionHistory(db, input.adminUserId, 6);
    if (hist.length) {
      parts.push(
        `Recent Q&A: ${hist
          .map((h) => `Q:${(h.question ?? "").slice(0, 120)} A:${(h.answer ?? "").slice(0, 120)}`)
          .join(" || ")}`,
      );
    }
  } catch {
    /* optional */
  }

  try {
    const kn = await searchExecutiveKnowledgeForPrompt(db, input.adminUserId, input.prompt, 4);
    if (kn.length) {
      parts.push(
        `Knowledge hits: ${kn
          .map((k) => `${k.title}: ${(k.summary ?? k.contentText ?? "").slice(0, 200)}`)
          .join(" | ")}`,
      );
    }
  } catch {
    /* optional */
  }

  try {
    const inbox = await listDepartmentMessagesForExecutiveAdmin(db, 8);
    if (inbox.length) {
      parts.push(
        `Executive department inbox (latest): ${inbox
          .map((m) => `${m.kind}:${(m.bodyText ?? "").slice(0, 120)}`)
          .join(" || ")}`,
      );
    }
  } catch {
    /* optional */
  }

  parts.push(
    `UI filters: agents=${(input.selectedAgents ?? []).join(",") || "all"}, timeRange=${input.selectedTimeRange ?? "n/a"}, dashboardMode=${input.dashboardMode ?? "n/a"}.`,
  );

  return parts.join("\n");
}
