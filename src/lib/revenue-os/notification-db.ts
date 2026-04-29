/**
 * Persistence for Bentley notification channels, policies, events, deliveries.
 */

import crypto from "crypto";
import { and, desc, eq, gte, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  bentleyNotificationChannels,
  bentleyNotificationDeliveries,
  bentleyNotificationEvents,
  bentleyNotificationPolicies,
} from "@/lib/db/schema";

export type NotificationChannelRow = typeof bentleyNotificationChannels.$inferSelect;
export type NotificationPolicyRow = typeof bentleyNotificationPolicies.$inferSelect;
export type NotificationEventRow = typeof bentleyNotificationEvents.$inferSelect;
export type NotificationDeliveryRow = typeof bentleyNotificationDeliveries.$inferSelect;

const DEDUPE_LOOKBACK_MS = 24 * 60 * 60 * 1000;

export async function listNotificationChannelsForUser(userId: string): Promise<NotificationChannelRow[]> {
  const uid = String(userId).trim();
  if (!uid) return [];
  try {
    const db = await getDb();
    return await db
      .select()
      .from(bentleyNotificationChannels)
      .where(eq(bentleyNotificationChannels.userId, uid))
      .orderBy(desc(bentleyNotificationChannels.updatedAt));
  } catch (e) {
    console.warn("[notification-db] list channels failed", e);
    return [];
  }
}

export async function getNotificationChannelForUser(params: {
  userId: string;
  channelId: string;
}): Promise<NotificationChannelRow | null> {
  const uid = String(params.userId).trim();
  if (!uid || !params.channelId) return null;
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(bentleyNotificationChannels)
      .where(
        and(eq(bentleyNotificationChannels.userId, uid), eq(bentleyNotificationChannels.id, params.channelId))
      )
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function upsertNotificationChannel(params: {
  userId: string;
  id?: string;
  channelType: string;
  channelLabel: string;
  channelConfigJson?: Record<string, unknown> | null;
  isEnabled: boolean;
}): Promise<{ row: NotificationChannelRow | null; ok: boolean }> {
  const uid = String(params.userId).trim();
  if (!uid) return { row: null, ok: false };
  const id = params.id?.trim() || crypto.randomUUID();
  try {
    const db = await getDb();
    const existing = await getNotificationChannelForUser({ userId: uid, channelId: id });
    if (existing) {
      await db
        .update(bentleyNotificationChannels)
        .set({
          channelType: params.channelType,
          channelLabel: params.channelLabel,
          channelConfigJson: params.channelConfigJson ?? null,
          isEnabled: params.isEnabled,
        })
        .where(and(eq(bentleyNotificationChannels.userId, uid), eq(bentleyNotificationChannels.id, id)));
    } else {
      await db.insert(bentleyNotificationChannels).values({
        id,
        userId: uid,
        channelType: params.channelType,
        channelLabel: params.channelLabel,
        channelConfigJson: params.channelConfigJson ?? null,
        isEnabled: params.isEnabled,
      });
    }
    const row = await getNotificationChannelForUser({ userId: uid, channelId: id });
    return { row, ok: true };
  } catch (e) {
    console.warn("[notification-db] upsert channel failed", e);
    return { row: null, ok: false };
  }
}

export async function toggleNotificationChannel(params: {
  userId: string;
  channelId: string;
  isEnabled: boolean;
}): Promise<{ ok: boolean }> {
  const row = await getNotificationChannelForUser({ userId: params.userId, channelId: params.channelId });
  if (!row) return { ok: false };
  try {
    const db = await getDb();
    await db
      .update(bentleyNotificationChannels)
      .set({ isEnabled: params.isEnabled })
      .where(
        and(eq(bentleyNotificationChannels.userId, String(params.userId)), eq(bentleyNotificationChannels.id, params.channelId))
      );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function listNotificationPoliciesForUser(params: {
  userId: string;
  clientId?: string;
  trustId?: string;
}): Promise<NotificationPolicyRow[]> {
  const uid = String(params.userId).trim();
  if (!uid) return [];
  const c = params.clientId?.trim() ?? "";
  const t = params.trustId?.trim() ?? "";
  try {
    const db = await getDb();
    const scopeOrGlobal =
      c !== "" || t !== ""
        ? or(
            and(eq(bentleyNotificationPolicies.clientId, c), eq(bentleyNotificationPolicies.trustId, t)),
            and(eq(bentleyNotificationPolicies.clientId, ""), eq(bentleyNotificationPolicies.trustId, ""))
          )
        : null;
    return await db
      .select()
      .from(bentleyNotificationPolicies)
      .where(scopeOrGlobal ? and(eq(bentleyNotificationPolicies.userId, uid), scopeOrGlobal) : eq(bentleyNotificationPolicies.userId, uid))
      .orderBy(desc(bentleyNotificationPolicies.updatedAt));
  } catch (e) {
    console.warn("[notification-db] list policies failed", e);
    return [];
  }
}

export async function getNotificationPolicyForUser(params: {
  userId: string;
  policyId: string;
}): Promise<NotificationPolicyRow | null> {
  const uid = String(params.userId).trim();
  const id = String(params.policyId).trim();
  if (!uid || !id) return null;
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(bentleyNotificationPolicies)
      .where(and(eq(bentleyNotificationPolicies.userId, uid), eq(bentleyNotificationPolicies.id, id)))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function upsertNotificationPolicy(params: {
  userId: string;
  id?: string;
  clientId: string;
  trustId: string;
  eventType: string;
  minimumSeverity: string;
  channelId: string;
  isEnabled: boolean;
  policyConfigJson?: Record<string, unknown> | null;
}): Promise<{ row: NotificationPolicyRow | null; ok: boolean }> {
  const uid = String(params.userId).trim();
  if (!uid) return { row: null, ok: false };
  const id = params.id?.trim() || crypto.randomUUID();
  try {
    const db = await getDb();
    const existing = await db
      .select()
      .from(bentleyNotificationPolicies)
      .where(and(eq(bentleyNotificationPolicies.userId, uid), eq(bentleyNotificationPolicies.id, id)))
      .limit(1);
    if (existing[0]) {
      await db
        .update(bentleyNotificationPolicies)
        .set({
          clientId: params.clientId,
          trustId: params.trustId,
          eventType: params.eventType,
          minimumSeverity: params.minimumSeverity,
          channelId: params.channelId,
          isEnabled: params.isEnabled,
          policyConfigJson: params.policyConfigJson ?? null,
        })
        .where(and(eq(bentleyNotificationPolicies.userId, uid), eq(bentleyNotificationPolicies.id, id)));
    } else {
      await db.insert(bentleyNotificationPolicies).values({
        id,
        userId: uid,
        clientId: params.clientId,
        trustId: params.trustId,
        eventType: params.eventType,
        minimumSeverity: params.minimumSeverity,
        channelId: params.channelId,
        isEnabled: params.isEnabled,
        policyConfigJson: params.policyConfigJson ?? null,
      });
    }
    const rows = await db
      .select()
      .from(bentleyNotificationPolicies)
      .where(and(eq(bentleyNotificationPolicies.userId, uid), eq(bentleyNotificationPolicies.id, id)))
      .limit(1);
    return { row: rows[0] ?? null, ok: true };
  } catch (e) {
    console.warn("[notification-db] upsert policy failed", e);
    return { row: null, ok: false };
  }
}

export async function toggleNotificationPolicy(params: {
  userId: string;
  policyId: string;
  isEnabled: boolean;
}): Promise<{ ok: boolean }> {
  try {
    const db = await getDb();
    await db
      .update(bentleyNotificationPolicies)
      .set({ isEnabled: params.isEnabled })
      .where(
        and(eq(bentleyNotificationPolicies.userId, String(params.userId)), eq(bentleyNotificationPolicies.id, params.policyId))
      );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function fetchRecentDedupeKeysForUser(params: {
  userId: string;
  sinceMs: number;
}): Promise<Set<string>> {
  const uid = String(params.userId).trim();
  if (!uid) return new Set();
  const since = new Date(params.sinceMs);
  try {
    const db = await getDb();
    const rows = await db
      .select({ dedupeKey: bentleyNotificationEvents.dedupeKey })
      .from(bentleyNotificationEvents)
      .where(
        and(
          eq(bentleyNotificationEvents.userId, uid),
          gte(bentleyNotificationEvents.createdAt, since),
          isNotNull(bentleyNotificationEvents.dedupeKey)
        )
      );
    const s = new Set<string>();
    for (const r of rows) {
      if (r.dedupeKey?.trim()) s.add(r.dedupeKey.trim());
    }
    return s;
  } catch {
    return new Set();
  }
}

export async function insertNotificationEvent(params: {
  userId: string;
  clientId: string;
  trustId: string;
  sourceType: string;
  eventType: string;
  severity: string;
  title: string;
  body: string;
  eventPayloadJson?: Record<string, unknown> | null;
  dedupeKey?: string | null;
}): Promise<{ id: string; ok: boolean }> {
  const id = crypto.randomUUID();
  try {
    const db = await getDb();
    await db.insert(bentleyNotificationEvents).values({
      id,
      userId: params.userId,
      clientId: params.clientId,
      trustId: params.trustId,
      sourceType: params.sourceType,
      eventType: params.eventType,
      severity: params.severity,
      title: params.title.slice(0, 512),
      body: params.body,
      eventPayloadJson: params.eventPayloadJson ?? null,
      dedupeKey: params.dedupeKey?.slice(0, 191) ?? null,
    });
    return { id, ok: true };
  } catch (e) {
    console.warn("[notification-db] insert event failed", e);
    return { id, ok: false };
  }
}

export async function insertNotificationDelivery(params: {
  eventId: string;
  channelId: string;
  deliveryStatus: "pending" | "sent" | "failed" | "skipped";
  deliveryAttemptCount?: number;
  lastDeliveryError?: string | null;
  deliveredAt?: Date | null;
  deliveryPayloadJson?: Record<string, unknown> | null;
}): Promise<{ id: string; ok: boolean }> {
  const id = crypto.randomUUID();
  try {
    const db = await getDb();
    await db.insert(bentleyNotificationDeliveries).values({
      id,
      eventId: params.eventId,
      channelId: params.channelId,
      deliveryStatus: params.deliveryStatus,
      deliveryAttemptCount: params.deliveryAttemptCount ?? 0,
      lastDeliveryError: params.lastDeliveryError ?? null,
      deliveredAt: params.deliveredAt ?? null,
      deliveryPayloadJson: params.deliveryPayloadJson ?? null,
    });
    return { id, ok: true };
  } catch (e) {
    console.warn("[notification-db] insert delivery failed", e);
    return { id, ok: false };
  }
}

export async function updateNotificationDelivery(params: {
  deliveryId: string;
  deliveryStatus?: "pending" | "sent" | "failed" | "skipped";
  deliveryAttemptCount?: number;
  lastDeliveryError?: string | null;
  deliveredAt?: Date | null;
  deliveryPayloadJson?: Record<string, unknown> | null;
}): Promise<{ ok: boolean }> {
  try {
    const db = await getDb();
    await db
      .update(bentleyNotificationDeliveries)
      .set({
        ...(params.deliveryStatus ? { deliveryStatus: params.deliveryStatus } : {}),
        ...(params.deliveryAttemptCount != null ? { deliveryAttemptCount: params.deliveryAttemptCount } : {}),
        ...(params.lastDeliveryError !== undefined ? { lastDeliveryError: params.lastDeliveryError } : {}),
        ...(params.deliveredAt !== undefined ? { deliveredAt: params.deliveredAt } : {}),
        ...(params.deliveryPayloadJson !== undefined ? { deliveryPayloadJson: params.deliveryPayloadJson } : {}),
      })
      .where(eq(bentleyNotificationDeliveries.id, params.deliveryId));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function markNotificationDeliveryRead(params: {
  userId: string;
  deliveryId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const uid = String(params.userId).trim();
  try {
    const db = await getDb();
    const d = await db
      .select()
      .from(bentleyNotificationDeliveries)
      .where(eq(bentleyNotificationDeliveries.id, params.deliveryId))
      .limit(1);
    const row = d[0];
    if (!row) return { ok: false, reason: "not_found" };
    const ev = await db
      .select()
      .from(bentleyNotificationEvents)
      .where(eq(bentleyNotificationEvents.id, row.eventId))
      .limit(1);
    if (!ev[0] || ev[0].userId !== uid) return { ok: false, reason: "forbidden" };
    await db
      .update(bentleyNotificationDeliveries)
      .set({ readAt: new Date() })
      .where(eq(bentleyNotificationDeliveries.id, params.deliveryId));
    return { ok: true };
  } catch {
    return { ok: false, reason: "db_error" };
  }
}

export async function listNotificationEventsForUser(params: {
  userId: string;
  limit?: number;
  clientId?: string;
  trustId?: string;
}): Promise<NotificationEventRow[]> {
  const uid = String(params.userId).trim();
  if (!uid) return [];
  const limit = Math.min(200, Math.max(1, params.limit ?? 80));
  try {
    const db = await getDb();
    const c = params.clientId?.trim() ?? "";
    const t = params.trustId?.trim() ?? "";
    const scope =
      c !== "" || t !== ""
        ? and(eq(bentleyNotificationEvents.clientId, c), eq(bentleyNotificationEvents.trustId, t))
        : null;
    return await db
      .select()
      .from(bentleyNotificationEvents)
      .where(scope ? and(eq(bentleyNotificationEvents.userId, uid), scope) : eq(bentleyNotificationEvents.userId, uid))
      .orderBy(desc(bentleyNotificationEvents.createdAt))
      .limit(limit);
  } catch (e) {
    console.warn("[notification-db] list events failed", e);
    return [];
  }
}

export async function listNotificationDeliveriesForUser(params: {
  userId: string;
  limit?: number;
  eventId?: string;
}): Promise<Array<NotificationDeliveryRow & { eventUserId?: string }>> {
  const uid = String(params.userId).trim();
  if (!uid) return [];
  const limit = Math.min(200, Math.max(1, params.limit ?? 80));
  try {
    const db = await getDb();
    if (params.eventId) {
      const ev = await db
        .select()
        .from(bentleyNotificationEvents)
        .where(and(eq(bentleyNotificationEvents.id, params.eventId), eq(bentleyNotificationEvents.userId, uid)))
        .limit(1);
      if (!ev[0]) return [];
      return await db
        .select()
        .from(bentleyNotificationDeliveries)
        .where(eq(bentleyNotificationDeliveries.eventId, params.eventId))
        .orderBy(desc(bentleyNotificationDeliveries.createdAt))
        .limit(limit);
    }
    const events = await db
      .select({ id: bentleyNotificationEvents.id })
      .from(bentleyNotificationEvents)
      .where(eq(bentleyNotificationEvents.userId, uid));
    const ids = events.map((e) => e.id);
    if (!ids.length) return [];
    return await db
      .select()
      .from(bentleyNotificationDeliveries)
      .where(inArray(bentleyNotificationDeliveries.eventId, ids))
      .orderBy(desc(bentleyNotificationDeliveries.createdAt))
      .limit(limit);
  } catch (e) {
    console.warn("[notification-db] list deliveries failed", e);
    return [];
  }
}

export async function countUnreadInAppDeliveriesForUser(userId: string): Promise<number> {
  const uid = String(userId).trim();
  if (!uid) return 0;
  try {
    const db = await getDb();
    const channels = await db
      .select({ id: bentleyNotificationChannels.id })
      .from(bentleyNotificationChannels)
      .where(and(eq(bentleyNotificationChannels.userId, uid), eq(bentleyNotificationChannels.channelType, "in_app")));
    const chIds = channels.map((c) => c.id);
    if (!chIds.length) return 0;
    const events = await db
      .select({ id: bentleyNotificationEvents.id })
      .from(bentleyNotificationEvents)
      .where(eq(bentleyNotificationEvents.userId, uid));
    const eids = events.map((e) => e.id);
    if (!eids.length) return 0;
    const rows = await db
      .select()
      .from(bentleyNotificationDeliveries)
      .where(
        and(
          inArray(bentleyNotificationDeliveries.eventId, eids),
          inArray(bentleyNotificationDeliveries.channelId, chIds),
          eq(bentleyNotificationDeliveries.deliveryStatus, "sent"),
          isNull(bentleyNotificationDeliveries.readAt)
        )
      );
    return rows.length;
  } catch {
    return 0;
  }
}

export { DEDUPE_LOOKBACK_MS };
