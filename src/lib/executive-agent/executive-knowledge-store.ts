import "server-only";

import { randomUUID } from "crypto";
import { and, desc, eq, like, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { executiveAgentKnowledgeDocuments } from "@/lib/db/schema";

type Db = MySql2Database<typeof schema>;

export type KnowledgeSourceType = (typeof schema.EXECUTIVE_KNOWLEDGE_SOURCE_TYPES)[number];

export async function listExecutiveKnowledgeDocuments(db: Db, adminUserId: number, limit = 80) {
  return db
    .select()
    .from(executiveAgentKnowledgeDocuments)
    .where(eq(executiveAgentKnowledgeDocuments.adminUserId, adminUserId))
    .orderBy(desc(executiveAgentKnowledgeDocuments.updatedAt))
    .limit(Math.min(200, Math.max(1, limit)));
}

export async function createExecutiveKnowledgeDocument(
  db: Db,
  adminUserId: number,
  input: {
    title: string;
    sourceType: KnowledgeSourceType;
    sourceUrl?: string | null;
    contentText: string;
    summary?: string | null;
    metadata?: Record<string, unknown> | null;
  },
) {
  const id = randomUUID();
  await db.insert(executiveAgentKnowledgeDocuments).values({
    id,
    adminUserId,
    title: input.title.trim().slice(0, 500),
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl?.trim() || null,
    contentText: input.contentText,
    summary: input.summary?.trim() || null,
    metadataJson: input.metadata ? JSON.stringify(input.metadata).slice(0, 8000) : null,
  });
  const [row] = await db.select().from(executiveAgentKnowledgeDocuments).where(eq(executiveAgentKnowledgeDocuments.id, id)).limit(1);
  return row ?? null;
}

export async function deleteExecutiveKnowledgeDocument(db: Db, adminUserId: number, id: string) {
  const res = await db
    .delete(executiveAgentKnowledgeDocuments)
    .where(and(eq(executiveAgentKnowledgeDocuments.id, id), eq(executiveAgentKnowledgeDocuments.adminUserId, adminUserId)));
  return res;
}

export async function searchExecutiveKnowledgeForPrompt(db: Db, adminUserId: number, prompt: string, limit = 6) {
  const terms = prompt
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9_-]/g, ""))
    .filter((t) => t.length > 2)
    .slice(0, 8);
  if (!terms.length) return [];
  const ors = terms.map((t) => {
    const p = `%${t}%`;
    return or(like(executiveAgentKnowledgeDocuments.title, p), like(executiveAgentKnowledgeDocuments.contentText, p))!;
  });
  const rows = await db
    .select({
      id: executiveAgentKnowledgeDocuments.id,
      title: executiveAgentKnowledgeDocuments.title,
      summary: executiveAgentKnowledgeDocuments.summary,
      contentText: executiveAgentKnowledgeDocuments.contentText,
      sourceType: executiveAgentKnowledgeDocuments.sourceType,
    })
    .from(executiveAgentKnowledgeDocuments)
    .where(and(eq(executiveAgentKnowledgeDocuments.adminUserId, adminUserId), or(...ors)))
    .orderBy(desc(executiveAgentKnowledgeDocuments.updatedAt))
    .limit(limit);
  return rows;
}
