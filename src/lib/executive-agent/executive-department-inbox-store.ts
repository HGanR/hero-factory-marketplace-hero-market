import "server-only";

import { randomUUID } from "crypto";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { executiveDepartmentMessages, marketplaceUsers } from "@/lib/db/schema";
import { EXECUTIVE_INBOX_ATTACHMENTS_JSON_MAX } from "@/lib/executive-agent/executive-inbox-attachments";

type Db = MySql2Database<typeof schema>;

export function collectExecutiveInboxUserIds(
  rows: Array<{
    fromAdminUserId?: number | null;
    fromMarketplaceUserId?: number | null;
    toMarketplaceUserId?: number | null;
  }>,
): number[] {
  const s = new Set<number>();
  for (const r of rows) {
    if (r.fromAdminUserId != null) s.add(r.fromAdminUserId);
    if (r.fromMarketplaceUserId != null) s.add(r.fromMarketplaceUserId);
    if (r.toMarketplaceUserId != null) s.add(r.toMarketplaceUserId);
  }
  return [...s];
}

export async function fetchMarketplaceUserDirectory(
  db: Db,
  ids: number[],
): Promise<Record<number, { username: string; email: string }>> {
  const uniq = [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
  if (!uniq.length) return {};
  const rows = await db
    .select({
      id: marketplaceUsers.id,
      username: marketplaceUsers.username,
      email: marketplaceUsers.email,
    })
    .from(marketplaceUsers)
    .where(inArray(marketplaceUsers.id, uniq));
  const out: Record<number, { username: string; email: string }> = {};
  for (const r of rows) {
    out[r.id] = { username: r.username, email: r.email };
  }
  return out;
}

export async function insertUserToExecutiveMessage(
  db: Db,
  fromMarketplaceUserId: number,
  bodyText: string,
  metadata?: Record<string, unknown> | null,
  attachmentsJson?: string | null,
) {
  const id = randomUUID();
  await db.insert(executiveDepartmentMessages).values({
    id,
    kind: "user_to_executive",
    fromAdminUserId: null,
    fromMarketplaceUserId,
    toMarketplaceUserId: null,
    bodyText: bodyText.trim().slice(0, 20_000),
    metadataJson: metadata ? JSON.stringify(metadata).slice(0, 4000) : null,
    attachmentsJson: attachmentsJson?.trim() ? attachmentsJson.trim().slice(0, EXECUTIVE_INBOX_ATTACHMENTS_JSON_MAX) : null,
  });
  return id;
}

export async function insertExecutiveBroadcast(
  db: Db,
  fromAdminUserId: number,
  bodyText: string,
  metadata?: Record<string, unknown> | null,
  attachmentsJson?: string | null,
) {
  const id = randomUUID();
  await db.insert(executiveDepartmentMessages).values({
    id,
    kind: "executive_broadcast",
    fromAdminUserId,
    fromMarketplaceUserId: null,
    toMarketplaceUserId: null,
    bodyText: bodyText.trim().slice(0, 20_000),
    metadataJson: metadata ? JSON.stringify(metadata).slice(0, 4000) : null,
    attachmentsJson: attachmentsJson?.trim() ? attachmentsJson.trim().slice(0, EXECUTIVE_INBOX_ATTACHMENTS_JSON_MAX) : null,
  });
  return id;
}

export async function insertExecutiveToUserMessage(
  db: Db,
  fromAdminUserId: number,
  toMarketplaceUserId: number,
  bodyText: string,
  metadata?: Record<string, unknown> | null,
  attachmentsJson?: string | null,
) {
  const id = randomUUID();
  await db.insert(executiveDepartmentMessages).values({
    id,
    kind: "executive_to_user",
    fromAdminUserId,
    fromMarketplaceUserId: null,
    toMarketplaceUserId,
    bodyText: bodyText.trim().slice(0, 20_000),
    metadataJson: metadata ? JSON.stringify(metadata).slice(0, 4000) : null,
    attachmentsJson: attachmentsJson?.trim() ? attachmentsJson.trim().slice(0, EXECUTIVE_INBOX_ATTACHMENTS_JSON_MAX) : null,
  });
  return id;
}

export async function listDepartmentMessagesForMarketplaceUser(db: Db, marketplaceUserId: number, limit = 80) {
  return db
    .select()
    .from(executiveDepartmentMessages)
    .where(
      or(
        eq(executiveDepartmentMessages.kind, "executive_broadcast"),
        and(eq(executiveDepartmentMessages.kind, "executive_to_user"), eq(executiveDepartmentMessages.toMarketplaceUserId, marketplaceUserId)),
        and(eq(executiveDepartmentMessages.kind, "user_to_executive"), eq(executiveDepartmentMessages.fromMarketplaceUserId, marketplaceUserId)),
      ),
    )
    .orderBy(desc(executiveDepartmentMessages.createdAt))
    .limit(Math.min(200, Math.max(1, limit)));
}

export async function listDepartmentMessagesForExecutiveAdmin(db: Db, limit = 120) {
  return db
    .select()
    .from(executiveDepartmentMessages)
    .orderBy(desc(executiveDepartmentMessages.createdAt))
    .limit(Math.min(300, Math.max(1, limit)));
}

export async function listApprovedMarketplaceUsers(db: Db, limit = 500) {
  return db
    .select({
      id: marketplaceUsers.id,
      username: marketplaceUsers.username,
      email: marketplaceUsers.email,
    })
    .from(marketplaceUsers)
    .where(and(eq(marketplaceUsers.isApproved, true), eq(marketplaceUsers.isActive, true)))
    .orderBy(asc(marketplaceUsers.username))
    .limit(limit);
}
