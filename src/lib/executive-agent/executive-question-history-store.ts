import "server-only";

import { randomUUID } from "crypto";
import { and, desc, eq, gte } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { executiveAgentQuestionHistory } from "@/lib/db/schema";

type Db = MySql2Database<typeof schema>;

export async function insertExecutiveQuestionHistory(
  db: Db,
  row: {
    adminUserId: number;
    source: "chat" | "voice";
    question: string;
    answer: string;
    selectedAgents?: string[] | null;
    selectedTimeRange?: string | null;
    dashboardMode?: string | null;
    plannerMeta?: Record<string, unknown> | null;
  },
) {
  const id = randomUUID();
  await db.insert(executiveAgentQuestionHistory).values({
    id,
    adminUserId: row.adminUserId,
    source: row.source,
    question: row.question.slice(0, 50_000),
    answer: row.answer.slice(0, 50_000),
    selectedAgentsJson: row.selectedAgents?.length ? JSON.stringify(row.selectedAgents) : null,
    selectedTimeRange: row.selectedTimeRange?.slice(0, 32) ?? null,
    dashboardMode: row.dashboardMode?.slice(0, 64) ?? null,
    plannerMetaJson: row.plannerMeta ? JSON.stringify(row.plannerMeta).slice(0, 20_000) : null,
  });
  return id;
}

export async function listExecutiveQuestionHistory(db: Db, adminUserId: number, limit = 40) {
  return db
    .select()
    .from(executiveAgentQuestionHistory)
    .where(eq(executiveAgentQuestionHistory.adminUserId, adminUserId))
    .orderBy(desc(executiveAgentQuestionHistory.createdAt))
    .limit(Math.min(120, Math.max(1, limit)));
}

export async function listExecutiveQuestionHistorySince(db: Db, adminUserId: number, since: Date, limit = 500) {
  const lim = Math.min(2000, Math.max(1, limit));
  return db
    .select()
    .from(executiveAgentQuestionHistory)
    .where(and(eq(executiveAgentQuestionHistory.adminUserId, adminUserId), gte(executiveAgentQuestionHistory.createdAt, since)))
    .orderBy(desc(executiveAgentQuestionHistory.createdAt))
    .limit(lim);
}
