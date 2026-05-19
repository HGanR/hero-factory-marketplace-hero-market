import "server-only";

import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { clientNotes, clients, marketplaceUsers } from "@/lib/db/schema";
import { parseRequestedServicesJson } from "@/lib/clients/requested-services";
import type { ExecutiveToolContext } from "@/lib/executive-agent/executive-agent-tools";
import { getPendingAccounts } from "@/lib/executive-agent/executive-agent-tools";
import {
  buildPendingClientsClaudeHandoff,
  toPublicPendingClientsHandoff,
  type PendingClientQueueItem,
  type PendingClientsClaudeHandoff,
  type PendingClientsClaudeHandoffPublic,
} from "@/lib/executive-agent/pending-clients-handoff";
import { redactSensitiveIntakeText } from "@/lib/executive-agent/pending-clients-note-redact";

export type { PendingClientQueueItem, PendingClientsClaudeHandoff, PendingClientsClaudeHandoffPublic };
export { buildPendingClientsClaudeHandoff, toPublicPendingClientsHandoff };

const MAX_NOTES_CHARS = 500;
const MAX_NAME_CHARS = 200;

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function displayNameFromClient(c: {
  firstName: string;
  lastName: string;
  entityDisplayName: string | null;
}): string {
  const entity = c.entityDisplayName?.trim();
  if (entity) return truncate(entity, MAX_NAME_CHARS);
  return truncate(`${c.firstName} ${c.lastName}`.trim(), MAX_NAME_CHARS);
}

function primaryRequestedService(services: string[]): string | null {
  if (!services.length) return null;
  return services[0] ?? null;
}

export async function listPendingClientsQueue(
  db: MySql2Database<typeof schema>,
  limit = 50,
): Promise<PendingClientQueueItem[]> {
  const cap = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const pendingUsers = await db
    .select({
      id: marketplaceUsers.id,
      email: marketplaceUsers.email,
      username: marketplaceUsers.username,
      isActive: marketplaceUsers.isActive,
      createdAt: marketplaceUsers.createdAt,
    })
    .from(marketplaceUsers)
    .where(eq(marketplaceUsers.isApproved, false))
    .orderBy(desc(marketplaceUsers.createdAt))
    .limit(cap);

  if (!pendingUsers.length) return [];

  const emails = [...new Set(pendingUsers.map((u) => String(u.email ?? "").trim().toLowerCase()).filter(Boolean))];

  const clientRows =
    emails.length > 0
      ? await db
          .select({
            id: clients.id,
            email: clients.email,
            firstName: clients.firstName,
            lastName: clients.lastName,
            entityDisplayName: clients.entityDisplayName,
            requestedServicesJson: clients.requestedServicesJson,
            createdAt: clients.createdAt,
          })
          .from(clients)
          .where(or(...emails.map((e) => eq(sql`LOWER(${clients.email})`, e))))
          .orderBy(desc(clients.createdAt))
      : [];

  const clientByEmail = new Map<string, (typeof clientRows)[number]>();
  for (const c of clientRows) {
    const key = String(c.email ?? "").trim().toLowerCase();
    if (!key || clientByEmail.has(key)) continue;
    clientByEmail.set(key, c);
  }

  const clientIds = [...clientByEmail.values()].map((c) => c.id);
  const latestNoteByClient = new Map<string, string>();

  if (clientIds.length > 0) {
    const noteRows = await db
      .select({
        clientId: clientNotes.clientId,
        note: clientNotes.note,
        createdAt: clientNotes.createdAt,
      })
      .from(clientNotes)
      .where(and(inArray(clientNotes.clientId, clientIds), eq(clientNotes.visibility, "internal")))
      .orderBy(desc(clientNotes.createdAt))
      .limit(500);

    for (const n of noteRows) {
      if (!latestNoteByClient.has(n.clientId)) {
        latestNoteByClient.set(
          n.clientId,
          redactSensitiveIntakeText(truncate(String(n.note ?? ""), MAX_NOTES_CHARS)),
        );
      }
    }
  }

  return pendingUsers.map((u) => {
    const email = String(u.email ?? "").trim();
    const emailKey = email.toLowerCase();
    const crm = clientByEmail.get(emailKey);
    const services = crm ? parseRequestedServicesJson(crm.requestedServicesJson) : [];
    const mpId = Number(u.id);

    return {
      id: `marketplace-${mpId}`,
      marketplaceUserId: mpId,
      crmClientId: crm?.id ?? null,
      name: crm ? displayNameFromClient(crm) : truncate(String(u.username ?? email.split("@")[0] ?? "Member"), MAX_NAME_CHARS),
      email,
      username: String(u.username ?? ""),
      requestedService: primaryRequestedService(services),
      requestedServices: services,
      status: "pending_approval" as const,
      intakeType: crm ? ("crm_intake" as const) : ("marketplace_signup" as const),
      createdAt:
        u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt ?? new Date().toISOString()),
      notes: crm ? latestNoteByClient.get(crm.id) ?? null : null,
      isActive: Boolean(u.isActive),
    };
  });
}

/** Orchestrator / voice / chat tools — public handoff summary only (no row-level PII). */
export async function getPendingClientsQueueForExecutive(
  ctx: ExecutiveToolContext,
  limit = 50,
): Promise<{ claudeHandoff: PendingClientsClaudeHandoffPublic }> {
  const [items, pendingCounts] = await Promise.all([
    listPendingClientsQueue(ctx.db, limit),
    getPendingAccounts(ctx),
  ]);
  const fullHandoff = buildPendingClientsClaudeHandoff(items, {
    pendingAllTime: pendingCounts.pendingAllTime,
    pendingApprox30d: pendingCounts.pendingApprox30d,
  });
  return { claudeHandoff: toPublicPendingClientsHandoff(fullHandoff) };
}
