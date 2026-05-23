import "server-only";

import { randomUUID } from "crypto";
import { and, asc, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  aiAgents,
  executiveDepartmentMessages,
  marketplaceUsers,
  oasisNpcMessages,
  oasisNpcSessions,
  oasisNpcs,
  widgetConversations,
  widgetMessages,
} from "@/lib/db/schema";
import { rollupSiteAnalyticsForExecutive } from "@/lib/analytics/site-analytics-store";
import { insertExecutiveAgentAuditLog } from "@/lib/executive-agent/executive-agent-audit";
import { buildLiveMetricsResponse } from "@/lib/executive-agent/executive-live-metrics";
import {
  siteAnalyticsVoiceSnapshotFromLiveMetrics,
  type SiteAnalyticsVoiceSnapshot,
} from "@/lib/executive-agent/executive-site-analytics-voice";
import {
  collectExecutiveInboxUserIds,
  fetchMarketplaceUserDirectory,
} from "@/lib/executive-agent/executive-department-inbox-store";
import { parseAndValidateExecutiveInboxAttachmentsJson } from "@/lib/executive-agent/executive-inbox-attachments";
import {
  maskMarketplaceEmail,
  maskMarketplaceUsername,
} from "@/lib/executive-agent/pending-marketplace-users-preview-masking";
import type {
  ExecutiveInboxMessageRow,
  IdentityLinkStatus,
  InboxAudioPlayPayload,
  JarvaActivityRow,
  NewRegistrationRow,
  RealityActivityRow,
  RegistrationPhoneQueueEntry,
  VoiceOperationalSnapshot,
} from "@/lib/executive-agent/executive-voice-operational-types";
import { startOfUtcDay, summarizeConversationText } from "@/lib/executive-agent/executive-voice-operational-utils";

type Db = MySql2Database<typeof schema>;

type UserIdentity = {
  displayName: string;
  identityStatus: IdentityLinkStatus;
  userId: number | null;
};

async function loadUserIdentityMap(db: Db, userIds: number[]): Promise<Map<number, UserIdentity>> {
  const uniq = [...new Set(userIds.filter((id) => Number.isFinite(id) && id > 0))];
  const out = new Map<number, UserIdentity>();
  if (!uniq.length) return out;
  const rows = await db
    .select({
      id: marketplaceUsers.id,
      username: marketplaceUsers.username,
      email: marketplaceUsers.email,
      isApproved: marketplaceUsers.isApproved,
    })
    .from(marketplaceUsers)
    .where(inArray(marketplaceUsers.id, uniq));
  for (const r of rows) {
    const approved = Boolean(r.isApproved);
    out.set(r.id, {
      userId: r.id,
      identityStatus: approved ? "approved" : "pending",
      displayName: approved ? String(r.username ?? "approved user") : maskMarketplaceUsername(String(r.username ?? "")),
    });
  }
  return out;
}

function unlinkedIdentity(): UserIdentity {
  return { displayName: "unmatched visitor", identityStatus: "unlinked", userId: null };
}

async function fetchJarvaNpcIds(db: Db): Promise<number[]> {
  const rows = await db
    .select({ id: oasisNpcs.id })
    .from(oasisNpcs)
    .where(
      and(
        eq(oasisNpcs.isActive, true),
        or(
          sql`LOWER(${oasisNpcs.name}) LIKE '%jarva%'`,
          sql`LOWER(${oasisNpcs.npcId}) LIKE '%jarva%'`,
          sql`LOWER(${oasisNpcs.name}) LIKE '%trust%'`,
        ),
      ),
    );
  return rows.map((r) => r.id);
}

export async function fetchJarvaActivityToday(db: Db): Promise<JarvaActivityRow[]> {
  const since = startOfUtcDay();
  const npcIds = await fetchJarvaNpcIds(db);
  if (!npcIds.length) return [];

  const sessions = await db
    .select({
      id: oasisNpcSessions.id,
      sessionId: oasisNpcSessions.sessionId,
      userId: oasisNpcSessions.userId,
      lastActivity: oasisNpcSessions.lastActivity,
      jarvaWorkflowPath: oasisNpcSessions.jarvaWorkflowPath,
    })
    .from(oasisNpcSessions)
    .where(and(inArray(oasisNpcSessions.npcId, npcIds), gte(oasisNpcSessions.lastActivity, since)))
    .orderBy(desc(oasisNpcSessions.lastActivity))
    .limit(40);

  if (!sessions.length) return [];

  const userIds = sessions.map((s) => s.userId).filter((id): id is number => id != null);
  const identityMap = await loadUserIdentityMap(db, userIds);
  const sessionDbIds = sessions.map((s) => s.id);

  const msgRows = await db
    .select({
      sessionId: oasisNpcMessages.sessionId,
      role: oasisNpcMessages.role,
      content: oasisNpcMessages.content,
      createdAt: oasisNpcMessages.createdAt,
    })
    .from(oasisNpcMessages)
    .where(inArray(oasisNpcMessages.sessionId, sessionDbIds))
    .orderBy(asc(oasisNpcMessages.createdAt));

  const bySession = new Map<number, typeof msgRows>();
  for (const m of msgRows) {
    const list = bySession.get(m.sessionId) ?? [];
    list.push(m);
    bySession.set(m.sessionId, list);
  }

  return sessions.map((s) => {
    const msgs = bySession.get(s.id) ?? [];
    const userExcerpts = msgs
      .filter((m) => m.role === "user")
      .map((m) => String(m.content ?? "").trim())
      .filter(Boolean)
      .slice(0, 3);
    const identity = s.userId != null ? identityMap.get(s.userId) ?? unlinkedIdentity() : unlinkedIdentity();
    return {
      sessionId: s.sessionId,
      accountDisplayName: identity.displayName,
      identityStatus: identity.identityStatus,
      timestamp: new Date(s.lastActivity as unknown as string).toISOString(),
      conversationSummary: summarizeConversationText(userExcerpts),
      userRequestExcerpts: userExcerpts.map((x) => x.slice(0, 200)),
      jarvaWorkflowPath: s.jarvaWorkflowPath ?? null,
      marketplaceUserId: s.userId ?? null,
    };
  });
}

async function fetchRealityAgentIds(db: Db): Promise<string[]> {
  const rows = await db
    .select({ id: aiAgents.id })
    .from(aiAgents)
    .where(sql`LOWER(${aiAgents.name}) LIKE '%reality%'`);
  return rows.map((r) => r.id);
}

export async function fetchRealityActivityToday(db: Db): Promise<RealityActivityRow[]> {
  const since = startOfUtcDay();
  const agentIds = await fetchRealityAgentIds(db);
  if (!agentIds.length) return [];

  const convs = await db
    .select({
      id: widgetConversations.id,
      ownerUserId: widgetConversations.ownerUserId,
      visitorId: widgetConversations.visitorId,
      lastMessageAt: widgetConversations.lastMessageAt,
    })
    .from(widgetConversations)
    .where(and(inArray(widgetConversations.agentId, agentIds), gte(widgetConversations.lastMessageAt, since)))
    .orderBy(desc(widgetConversations.lastMessageAt))
    .limit(40);

  if (!convs.length) return [];

  const userIds = convs.map((c) => c.ownerUserId).filter((id): id is number => id != null);
  const identityMap = await loadUserIdentityMap(db, userIds);
  const convIds = convs.map((c) => c.id);

  const msgRows = await db
    .select({
      conversationId: widgetMessages.conversationId,
      role: widgetMessages.role,
      contentText: widgetMessages.contentText,
    })
    .from(widgetMessages)
    .where(inArray(widgetMessages.conversationId, convIds))
    .orderBy(asc(widgetMessages.createdAt));

  const byConv = new Map<string, string[]>();
  for (const m of msgRows) {
    if (m.role !== "user") continue;
    const list = byConv.get(m.conversationId) ?? [];
    list.push(String(m.contentText ?? "").trim());
    byConv.set(m.conversationId, list);
  }

  return convs.map((c) => {
    const excerpts = (byConv.get(c.id) ?? []).slice(0, 3);
    const identity =
      c.ownerUserId != null ? identityMap.get(c.ownerUserId) ?? unlinkedIdentity() : { ...unlinkedIdentity(), displayName: "unlinked user" };
    return {
      conversationId: c.id,
      userDisplayName: identity.displayName,
      identityStatus: c.ownerUserId != null ? identity.identityStatus : "visitor",
      timestamp: new Date(c.lastMessageAt as unknown as string).toISOString(),
      conversationSummary: summarizeConversationText(excerpts),
      ownerUserId: c.ownerUserId ?? null,
      visitorId: c.visitorId ?? null,
    };
  });
}

function inboxSenderLabel(
  row: typeof executiveDepartmentMessages.$inferSelect,
  directory: Record<number, { username: string; email: string }>,
): string {
  if (row.fromMarketplaceUserId != null) {
    const u = directory[row.fromMarketplaceUserId];
    return u?.username?.trim() || `User #${row.fromMarketplaceUserId}`;
  }
  if (row.fromAdminUserId != null) return "Executive admin";
  if (row.kind === "executive_broadcast") return "Executive broadcast";
  return "Unknown sender";
}

export async function fetchExecutiveInboxNewMessagesToday(db: Db): Promise<ExecutiveInboxMessageRow[]> {
  const since = startOfUtcDay();
  const rows = await db
    .select()
    .from(executiveDepartmentMessages)
    .where(gte(executiveDepartmentMessages.createdAt, since))
    .orderBy(desc(executiveDepartmentMessages.createdAt))
    .limit(50);

  const directory = await fetchMarketplaceUserDirectory(db, collectExecutiveInboxUserIds(rows));

  return rows.map((r) => {
    const attachments = parseAndValidateExecutiveInboxAttachmentsJson(r.attachmentsJson);
    const audio = attachments?.find((a) => a.kind === "audio") ?? null;
    const body = String(r.bodyText ?? "").trim();
    return {
      messageId: r.id,
      senderName: inboxSenderLabel(r, directory),
      subjectOrPreview: body.slice(0, 240) || "(attachment only)",
      receivedAt: new Date(r.createdAt as unknown as string).toISOString(),
      hasAttachment: Boolean(attachments?.length),
      hasAudioAttachment: Boolean(audio),
      firstAudioAttachmentId: audio?.id ?? null,
      attachmentCount: attachments?.length ?? 0,
    };
  });
}

export async function fetchNewRegistrationsToday(db: Db): Promise<NewRegistrationRow[]> {
  const since = startOfUtcDay();
  const rows = await db
    .select({
      id: marketplaceUsers.id,
      username: marketplaceUsers.username,
      email: marketplaceUsers.email,
      phone: marketplaceUsers.phone,
      isApproved: marketplaceUsers.isApproved,
      createdAt: marketplaceUsers.createdAt,
    })
    .from(marketplaceUsers)
    .where(gte(marketplaceUsers.createdAt, since))
    .orderBy(desc(marketplaceUsers.createdAt))
    .limit(50);

  return rows.map((r) => {
    const approved = Boolean(r.isApproved);
    const phone = String(r.phone ?? "").trim();
    return {
      userId: r.id,
      accountDisplayName: approved
        ? String(r.username ?? "approved user")
        : maskMarketplaceUsername(String(r.username ?? "")),
      createdAt: new Date(r.createdAt as unknown as string).toISOString(),
      emailMasked: maskMarketplaceEmail(String(r.email ?? "")),
      phoneAvailable: phone.length >= 7,
      isApproved: approved,
    };
  });
}

export async function fetchRegistrationPhoneQueue(db: Db): Promise<RegistrationPhoneQueueEntry[]> {
  const since = startOfUtcDay();
  const rows = await db
    .select({
      id: marketplaceUsers.id,
      username: marketplaceUsers.username,
      phone: marketplaceUsers.phone,
      isApproved: marketplaceUsers.isApproved,
      createdAt: marketplaceUsers.createdAt,
    })
    .from(marketplaceUsers)
    .where(and(gte(marketplaceUsers.createdAt, since), eq(marketplaceUsers.isApproved, false)))
    .orderBy(asc(marketplaceUsers.createdAt))
    .limit(50);

  return rows
    .filter((r) => String(r.phone ?? "").trim().length >= 7)
    .map((r) => ({
      userId: r.id,
      accountDisplayName: maskMarketplaceUsername(String(r.username ?? "")),
      phone: String(r.phone ?? "").trim(),
      createdAt: new Date(r.createdAt as unknown as string).toISOString(),
    }));
}

export async function resolveInboxAudioPlayPayload(
  db: Db,
  messageId: string,
  attachmentId: string,
): Promise<InboxAudioPlayPayload | null> {
  const [row] = await db
    .select()
    .from(executiveDepartmentMessages)
    .where(eq(executiveDepartmentMessages.id, messageId))
    .limit(1);
  if (!row) return null;
  const attachments = parseAndValidateExecutiveInboxAttachmentsJson(row.attachmentsJson);
  const audio = attachments?.find((a) => a.id === attachmentId && a.kind === "audio");
  if (!audio) return null;
  return {
    messageId,
    attachmentId,
    url: audio.url,
    filename: audio.filename,
    mimeType: audio.mimeType,
  };
}

export async function auditSensitiveOperationalRead(
  db: Db,
  adminUserId: number,
  prompt: string | null,
  toolName: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
): Promise<void> {
  await insertExecutiveAgentAuditLog(db, {
    id: randomUUID(),
    adminUserId,
    prompt,
    toolName,
    actionType: "sensitive_pii_read",
    targetType: "platform",
    inputJson: JSON.stringify(input).slice(0, 50_000),
    outputJson: JSON.stringify(output).slice(0, 50_000),
    approvalStatus: "not_required",
  });
}

export async function fetchVisitorsToday(db: Db): Promise<number | null> {
  try {
    const since = startOfUtcDay();
    const rollup = await rollupSiteAnalyticsForExecutive(db, { since, until: new Date() });
    return rollup?.landingPageVisitors ?? null;
  } catch {
    return null;
  }
}

const SITE_ANALYTICS_VOICE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export async function fetchSiteAnalyticsVoiceSnapshot(db: Db): Promise<SiteAnalyticsVoiceSnapshot> {
  try {
    const until = new Date();
    const since = new Date(until.getTime() - SITE_ANALYTICS_VOICE_WINDOW_MS);
    const rollup = await rollupSiteAnalyticsForExecutive(db, { since, until });
    if (!rollup) {
      return {
        activeVisitors: null,
        pageViews: null,
        conversions: null,
        bounceRate: null,
        unavailable: true,
      };
    }
    const metrics = buildLiveMetricsResponse({
      pendingAllTime: null,
      pendingApprox30d: null,
      approvedActive: null,
      approvedInactive: null,
      activeUsers: null,
      marketplaceUsers: null,
      crmClients: null,
      socialCampaigns: null,
      threadsLast7d: null,
      inboxUnavailable: true,
      siteTraffic: rollup,
    });
    return siteAnalyticsVoiceSnapshotFromLiveMetrics(metrics);
  } catch {
    return {
      activeVisitors: null,
      pageViews: null,
      conversions: null,
      bounceRate: null,
      unavailable: true,
    };
  }
}

export async function buildVoiceOperationalSnapshot(db: Db): Promise<VoiceOperationalSnapshot> {
  const [jarva, reality, inbox, registrations, visitorsToday] = await Promise.all([
    fetchJarvaActivityToday(db),
    fetchRealityActivityToday(db),
    fetchExecutiveInboxNewMessagesToday(db),
    fetchNewRegistrationsToday(db),
    fetchVisitorsToday(db),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    jarva,
    reality,
    inbox,
    registrations,
    visitorsToday,
  };
}
