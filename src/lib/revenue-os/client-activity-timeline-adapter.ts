/**
 * Activity timeline for Client Hub: Site → Agent (bindings) → Widget → CRM → Campaigns
 * + optional `platform_events`. Always goes through `getOwnedClientRow` first.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  aiAgentSiteBindings,
  aiAgents,
  campaignPosts,
  campaigns,
  crm_contacts,
  crm_conversations,
  crm_messages,
  web3Sites,
  web3SiteVersions,
  widgetConversations,
} from "@/lib/db/schema";
import { getOwnedClientRow } from "@/lib/revenue-os/client-hub-ownership";
import { listAutomationEventsForClientTimeline } from "@/lib/revenue-os/client-hub-automation-events";
import { fetchPlatformEventsForClientTimeline } from "@/lib/revenue-os/client-hub-platform-events";
import type { ClientActivityItem } from "@/lib/revenue-os/client-hub-types";

/** De-dupe by `id`, sort newest first, cap length (unit-tested). */
export function mergeClientActivityByTime(items: ClientActivityItem[], limit: number): ClientActivityItem[] {
  const byId = new Map<string, ClientActivityItem>();
  for (const it of items) {
    if (!byId.has(it.id)) byId.set(it.id, it);
  }
  return [...byId.values()]
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0))
    .slice(0, limit);
}

function msgText(m: { content?: string | null; channel?: string | null }): string {
  if (m.content != null && String(m.content).trim()) return String(m.content).trim().slice(0, 120);
  if (m.channel) return `Channel: ${m.channel}`;
  return "Message";
}

export async function getClientActivityTimeline(
  userId: number,
  clientId: string,
  limit = 40,
): Promise<ClientActivityItem[]> {
  const c = await getOwnedClientRow(userId, clientId);
  if (!c) return [];
  const clientAt = c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString();
  const items: ClientActivityItem[] = [];
  const db = await getDb();

  items.push(...(await fetchPlatformEventsForClientTimeline(userId, clientId, 12)));

  const siteRows = await db
    .select()
    .from(web3Sites)
    .where(and(eq(web3Sites.userId, userId), eq(web3Sites.clientId, clientId)))
    .orderBy(desc(web3Sites.updatedAt));
  for (const s of siteRows) {
    const when = s.updatedAt ? new Date(s.updatedAt) : s.createdAt ? new Date(s.createdAt) : new Date();
    items.push({
      id: `site-${s.id}-upd`,
      kind: "site",
      title: "Site activity",
      detail: s.name,
      occurredAt: when.toISOString(),
    });
  }

  const siteIds = siteRows.map((s) => s.id);
  if (siteIds.length > 0) {
    const verRows = await db
      .select({
        id: web3SiteVersions.id,
        siteId: web3SiteVersions.siteId,
        version: web3SiteVersions.version,
        createdAt: web3SiteVersions.createdAt,
        siteName: web3Sites.name,
      })
      .from(web3SiteVersions)
      .innerJoin(web3Sites, eq(web3SiteVersions.siteId, web3Sites.id))
      .where(and(inArray(web3SiteVersions.siteId, siteIds), eq(web3Sites.userId, userId)))
      .orderBy(desc(web3SiteVersions.createdAt))
      .limit(20);
    for (const v of verRows) {
      const when = v.createdAt ? new Date(v.createdAt) : new Date();
      items.push({
        id: `ver-${v.id}`,
        kind: "site_version",
        title: `New site build · v${v.version}`,
        detail: v.siteName ?? v.siteId,
        occurredAt: when.toISOString(),
      });
    }

    const bindRows = await db
      .select({
        bid: aiAgentSiteBindings.id,
        wk: aiAgentSiteBindings.widgetKey,
        active: aiAgentSiteBindings.isActive,
        createdAt: aiAgentSiteBindings.createdAt,
        updatedAt: aiAgentSiteBindings.updatedAt,
        siteName: web3Sites.name,
        agentName: aiAgents.name,
      })
      .from(aiAgentSiteBindings)
      .innerJoin(web3Sites, eq(aiAgentSiteBindings.siteId, web3Sites.id))
      .leftJoin(aiAgents, eq(aiAgents.id, aiAgentSiteBindings.agentId))
      .where(
        and(
          inArray(aiAgentSiteBindings.siteId, siteIds),
          eq(web3Sites.userId, userId),
          eq(web3Sites.clientId, clientId),
        ),
      );
    for (const b of bindRows) {
      const when = b.updatedAt ?? b.createdAt ?? new Date();
      items.push({
        id: `bind-${b.bid}`,
        kind: "binding",
        title: b.active ? "Agent ↔ site binding" : "Agent binding (inactive)",
        detail: [b.siteName, b.agentName, b.wk].filter(Boolean).join(" · "),
        occurredAt: new Date(when).toISOString(),
      });
    }
  }

  const contacts = await db
    .select()
    .from(crm_contacts)
    .where(and(eq(crm_contacts.userId, userId), eq(crm_contacts.clientId, clientId)))
    .orderBy(desc(crm_contacts.createdAt))
    .limit(20);
  for (const ct of contacts) {
    if (!ct.createdAt) continue;
    const email = ct.email ? String(ct.email).slice(0, 80) : "Lead";
    items.push({
      id: `lead-c-${ct.id}`,
      kind: "contact",
      title: "Lead captured",
      detail: email,
      occurredAt: new Date(ct.createdAt).toISOString(),
    });
  }

  const convRows = await db
    .select({ cv: crm_conversations, em: crm_contacts.email })
    .from(crm_conversations)
    .innerJoin(crm_contacts, eq(crm_conversations.contactId, crm_contacts.id))
    .where(and(eq(crm_contacts.userId, userId), eq(crm_contacts.clientId, clientId)))
    .orderBy(desc(crm_conversations.lastMessageAt))
    .limit(12);
  for (const { cv, em } of convRows) {
    const t = cv.lastMessageAt
      ? new Date(cv.lastMessageAt).toISOString()
      : cv.createdAt
        ? new Date(cv.createdAt as unknown as string).toISOString()
        : clientAt;
    const prev = cv.lastMessagePreview;
    items.push({
      id: `conv-${cv.id}`,
      kind: "conversation",
      title: cv.channel ? `Inbox thread · ${cv.channel}` : "Inbox thread opened",
      detail: prev ? String(prev).slice(0, 120) : em ? String(em) : null,
      occurredAt: t,
    });
  }

  const recentMsgs = await db
    .select({ m: crm_messages, con: crm_conversations })
    .from(crm_messages)
    .innerJoin(crm_conversations, eq(crm_messages.conversationId, crm_conversations.id))
    .innerJoin(crm_contacts, eq(crm_conversations.contactId, crm_contacts.id))
    .where(and(eq(crm_contacts.userId, userId), eq(crm_contacts.clientId, clientId)))
    .orderBy(desc(crm_messages.createdAt))
    .limit(10);
  for (const { m, con } of recentMsgs) {
    const when = m.createdAt ? new Date(m.createdAt) : new Date();
    items.push({
      id: `msg-${m.id}`,
      kind: "message",
      title: `Inbox message · ${con.channel ?? "thread"}`,
      detail: msgText(m as { content?: string | null; channel?: string | null }),
      occurredAt: when.toISOString(),
    });
  }

  if (siteIds.length) {
    const wcRows = await db
      .select({ wc: widgetConversations, siteName: web3Sites.name })
      .from(widgetConversations)
      .innerJoin(aiAgentSiteBindings, eq(widgetConversations.widgetBindingId, aiAgentSiteBindings.id))
      .innerJoin(web3Sites, eq(web3Sites.id, aiAgentSiteBindings.siteId))
      .where(
        and(
          inArray(aiAgentSiteBindings.siteId, siteIds),
          eq(widgetConversations.ownerUserId, userId),
          eq(web3Sites.clientId, clientId),
        ),
      )
      .orderBy(desc(widgetConversations.lastMessageAt))
      .limit(12);
    for (const { wc, siteName } of wcRows) {
      const t = wc.lastMessageAt ?? wc.startedAt;
      items.push({
        id: `wconv-${wc.id}`,
        kind: "widget",
        title: "Widget session",
        detail: siteName ?? "Embeddable chat on site",
        occurredAt: t ? new Date(t).toISOString() : clientAt,
      });
    }
  }

  const allCamps = await db
    .select({ id: campaigns.id, name: campaigns.name, status: campaigns.status, updatedAt: campaigns.updatedAt })
    .from(campaigns)
    .where(and(eq(campaigns.userId, String(userId)), eq(campaigns.clientId, clientId)));
  const cids = allCamps.map((x) => x.id);
  for (const camp of allCamps.slice(0, 8)) {
    const when = camp.updatedAt ? new Date(camp.updatedAt) : new Date();
    items.push({
      id: `camp-${camp.id}-snap`,
      kind: "campaign",
      title: "Campaign",
      detail: `${camp.name} · ${camp.status}`,
      occurredAt: when.toISOString(),
    });
  }
  if (cids.length > 0) {
    const postRows = await db
      .select({
        id: campaignPosts.id,
        p: campaignPosts,
        name: campaigns.name,
      })
      .from(campaignPosts)
      .innerJoin(campaigns, eq(campaigns.id, campaignPosts.campaignId))
      .where(and(inArray(campaignPosts.campaignId, cids), eq(campaignPosts.status, "POSTED")))
      .orderBy(desc(campaignPosts.postedAt))
      .limit(20);
    for (const { id, p, name: campaignName } of postRows) {
      const when = p.postedAt ?? p.updatedAt ?? p.createdAt;
      items.push({
        id: `cpost-${id}`,
        kind: "post",
        title: "Social post published",
        detail: [campaignName, p.platform, p.caption ? String(p.caption).slice(0, 80) : null]
          .filter(Boolean)
          .join(" · "),
        occurredAt: when ? new Date(when).toISOString() : clientAt,
      });
    }
  }

  items.push({
    id: `client-${c.id}`,
    kind: "client",
    title: "Client profile",
    detail: c.name,
    occurredAt: clientAt,
  });

  items.push(...(await listAutomationEventsForClientTimeline(userId, clientId, Math.min(40, limit + 8))));

  return mergeClientActivityByTime(items, limit);
}
