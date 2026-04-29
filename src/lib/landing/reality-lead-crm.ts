/**
 * Upserts a landing-page REALITY lead into the operator CRM (one configured owner user).
 * Uses a synthetic email keyed by browser session so repeat messages merge into one contact.
 */

import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { crm_contacts, crm_conversations, crm_messages } from "@/lib/db/schema";

const SYNTHETIC_EMAIL_HOST = "landing-reality.internal";
const CHANNEL = "note";

export type RealityLandingBusinessStatus = "has_business" | "planning" | "neither";

export type RealityLandingPayload = {
  sessionId: string;
  displayName?: string;
  /** Visitor email — stored on `crm_contacts.email` for admin Contacts list once validated. */
  email?: string;
  businessStatus?: RealityLandingBusinessStatus;
  businessState?: string | null;
};

export type RealityLandingCustomBlock = {
  sessionId: string;
  displayName?: string;
  visitorEmail?: string;
  businessStatus?: RealityLandingBusinessStatus;
  businessState?: string | null;
  updatedAt: string;
};

function syntheticEmail(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 72) || "session";
  return `reality+${safe}@${SYNTHETIC_EMAIL_HOST}`;
}

export function splitDisplayName(raw: string): { firstName: string; lastName: string | null } {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return { firstName: "Visitor", lastName: null };
  const i = t.indexOf(" ");
  if (i === -1) return { firstName: t.slice(0, 80), lastName: null };
  return { firstName: t.slice(0, i).slice(0, 80), lastName: t.slice(i + 1).trim().slice(0, 120) || null };
}

function parseCustom(prev: unknown): Record<string, unknown> {
  if (prev == null) return {};
  if (typeof prev === "string") {
    try {
      const j = JSON.parse(prev) as unknown;
      return j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof prev === "object" && !Array.isArray(prev)) return { ...(prev as Record<string, unknown>) };
  return {};
}

function normalizeVisitorEmail(raw: string | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (t.length < 5 || t.length > 320 || !t.includes("@")) return null;
  return t;
}

function mergeRealityBlock(
  prev: unknown,
  patch: RealityLandingPayload,
): RealityLandingCustomBlock {
  let base: RealityLandingCustomBlock = {
    sessionId: patch.sessionId,
    updatedAt: new Date().toISOString(),
  };
  const p = parseCustom(prev);
  const inner = p["realityLanding"];
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    base = { ...(inner as RealityLandingCustomBlock) };
  }
  if (patch.displayName != null) base.displayName = patch.displayName;
  if (patch.email != null) {
    const ne = normalizeVisitorEmail(patch.email);
    if (ne) base.visitorEmail = ne;
  }
  if (patch.businessStatus != null) base.businessStatus = patch.businessStatus;
  if (patch.businessState !== undefined) base.businessState = patch.businessState ?? null;
  base.sessionId = patch.sessionId;
  base.updatedAt = new Date().toISOString();
  return base;
}

function summaryLine(block: RealityLandingCustomBlock): string {
  const parts: string[] = [];
  if (block.displayName) parts.push(`Name: ${block.displayName}`);
  if (block.visitorEmail) parts.push(`Email: ${block.visitorEmail}`);
  if (block.businessStatus) {
    const map: Record<string, string> = {
      has_business: "Has a current business",
      planning: "Planning to start a business",
      neither: "No business / not planning",
    };
    parts.push(`Business: ${map[block.businessStatus] ?? block.businessStatus}`);
  }
  if (block.businessState) parts.push(`State: ${block.businessState}`);
  return parts.length ? `REALITY (Hero Factory): ${parts.join(" · ")}` : "REALITY (Hero Factory): profile updated";
}

/** Same browser session may later use a real `email` column — still find row via JSON session id. */
async function findLandingContactRow(
  db: MySql2Database<Record<string, never>>,
  ownerUserId: number,
  sessionId: string,
  synthetic: string,
) {
  const bySession = await db
    .select()
    .from(crm_contacts)
    .where(
      and(
        eq(crm_contacts.userId, ownerUserId),
        sql`JSON_UNQUOTE(JSON_EXTRACT(COALESCE(${crm_contacts.customFields}, CAST('{}' AS JSON)), '$.realityLanding.sessionId')) = ${sessionId}`,
      ),
    )
    .limit(1);
  if (bySession[0]) return bySession[0];

  const bySynth = await db
    .select()
    .from(crm_contacts)
    .where(and(eq(crm_contacts.userId, ownerUserId), eq(crm_contacts.email, synthetic)))
    .limit(1);
  return bySynth[0] ?? null;
}

export async function upsertRealityLandingLead(
  db: MySql2Database<Record<string, never>>,
  ownerUserId: number,
  payload: RealityLandingPayload,
): Promise<{ contactId: string; conversationId: string }> {
  const synthetic = syntheticEmail(payload.sessionId);
  const realityBlock = mergeRealityBlock(null, payload);
  const visitorEmail = normalizeVisitorEmail(payload.email);

  const existingRow = await findLandingContactRow(db, ownerUserId, payload.sessionId, synthetic);

  let contactId: string;
  const tags = JSON.stringify(["reality_landing", "hero_factory_home"]);
  const rowEmail = visitorEmail ?? synthetic;

  if (existingRow) {
    contactId = existingRow.id;
    const prevCustom = existingRow.customFields;
    const prevObj = parseCustom(prevCustom);
    const mergedBlock = mergeRealityBlock(prevCustom, payload);
    const outer = {
      ...prevObj,
      realityLanding: mergedBlock,
    };
    const nameParts = payload.displayName
      ? splitDisplayName(payload.displayName)
      : { firstName: existingRow.firstName ?? "Visitor", lastName: existingRow.lastName };

    await db
      .update(crm_contacts)
      .set({
        firstName: nameParts.firstName,
        lastName: nameParts.lastName ?? existingRow.lastName,
        ...(visitorEmail ? { email: visitorEmail } : {}),
        leadSource: "reality_landing",
        tags,
        customFields: outer,
        updatedAt: new Date(),
      } as Record<string, unknown>)
      .where(eq(crm_contacts.id, contactId));
  } else {
    contactId = crypto.randomUUID();
    const nm = payload.displayName ? splitDisplayName(payload.displayName) : { firstName: "Visitor", lastName: null };
    const outer = { realityLanding: realityBlock };
    await db.insert(crm_contacts).values({
      id: contactId,
      userId: ownerUserId,
      workspaceId: null,
      email: rowEmail,
      firstName: nm.firstName,
      lastName: nm.lastName,
      phone: null,
      company: null,
      leadSource: "reality_landing",
      clientId: null,
      tags,
      customFields: outer,
    } as Record<string, unknown>);
  }

  const [finalContact] = await db
    .select()
    .from(crm_contacts)
    .where(eq(crm_contacts.id, contactId))
    .limit(1);
  const parsedFinal = parseCustom(finalContact?.customFields);
  const block =
    (parsedFinal["realityLanding"] as RealityLandingCustomBlock | undefined) ??
    mergeRealityBlock(null, payload);

  let conversationId: string;
  const convRows = await db
    .select({ id: crm_conversations.id })
    .from(crm_conversations)
    .where(
      and(
        eq(crm_conversations.contactId, contactId),
        eq(crm_conversations.userId, ownerUserId),
        eq(crm_conversations.channel, CHANNEL),
      ),
    )
    .limit(1);

  if (convRows.length) {
    conversationId = convRows[0].id;
  } else {
    conversationId = crypto.randomUUID();
    await db.insert(crm_conversations).values({
      id: conversationId,
      contactId,
      userId: ownerUserId,
      workspaceId: null,
      channel: CHANNEL,
      status: "open",
      subject: "REALITY — Hero Factory landing",
      lastMessageAt: new Date(),
      lastMessagePreview: summaryLine(block).slice(0, 255),
      unreadCount: 0,
    } as Record<string, unknown>);
  }

  const msgId = crypto.randomUUID();
  await db.insert(crm_messages).values({
    id: msgId,
    conversationId,
    direction: "inbound",
    channel: CHANNEL,
    content: summaryLine(block),
    status: "received",
    metadata: JSON.stringify({ source: "reality_landing", sessionId: payload.sessionId }),
  } as Record<string, unknown>);

  const [convRow] = await db
    .select({ unreadCount: crm_conversations.unreadCount })
    .from(crm_conversations)
    .where(eq(crm_conversations.id, conversationId))
    .limit(1);
  const nextUnread = Number(convRow?.unreadCount ?? 0) + 1;

  await db
    .update(crm_conversations)
    .set({
      lastMessageAt: new Date(),
      lastMessagePreview: summaryLine(block).slice(0, 255),
      unreadCount: nextUnread,
      updatedAt: new Date(),
    } as Record<string, unknown>)
    .where(eq(crm_conversations.id, conversationId));

  return { contactId, conversationId };
}
