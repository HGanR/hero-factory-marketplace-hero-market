import { and, eq } from "drizzle-orm";
import crypto from "crypto";
import type { getDb } from "@/lib/db";
import { aiAgentSiteBindings, web3Sites } from "@/lib/db/schema";
import { canAccessAgent } from "@/lib/agents/agent-access";
import { resolveClientIdForWidgetBinding } from "@/lib/revenue-os/client-hub-queries";
import {
  mergeWidgetBindingMetadata,
  widgetMetadataPatchFromRequestBody,
} from "@/lib/widget/widget-binding-metadata";

type Db = Awaited<ReturnType<typeof getDb>>;

function generateWidgetKey(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * Create or update `ai_agent_site_bindings` (widget key) for an agent + site.
 * `body` is the JSON POST body: requires `siteId`; honors `allowedDomains` only when that key is present.
 * Optional `clientId` sets `ai_agent_site_bindings.clientId` and, when set, `web3_sites.clientId` (both scoped to the authenticated user).
 */
export async function upsertAgentSiteWidgetBindingFromHttpBody(
  db: Db,
  userId: number,
  agentId: string,
  body: Record<string, unknown>,
): Promise<{ widgetKey: string }> {
  const siteId = typeof body.siteId === "string" ? body.siteId.trim() : "";
  if (!siteId) throw new Error("siteId required");

  const canAccess = await canAccessAgent(agentId, userId);
  if (!canAccess) throw new Error("Agent not found");

  const [site] = await db
    .select()
    .from(web3Sites)
    .where(and(eq(web3Sites.id, siteId), eq(web3Sites.userId, userId)))
    .limit(1);
  if (!site) throw new Error("Site not found or access denied");

  const resolvedClientId = await resolveClientIdForWidgetBinding(userId, site.clientId, body);

  const hasAllowedDomains = "allowedDomains" in body;
  let allowedDomains: string | null = null;
  if (hasAllowedDomains) {
    const raw = Array.isArray(body.allowedDomains)
      ? body.allowedDomains
      : typeof body.allowedDomains === "string"
        ? body.allowedDomains.split(",").map((d) => d.trim()).filter(Boolean)
        : [];
    allowedDomains = raw.length ? JSON.stringify(raw) : null;
  }

  const metaPatch = widgetMetadataPatchFromRequestBody(body);
  const hasMetaPatch = Object.keys(metaPatch).length > 0;

  const existingBinding = await db
    .select()
    .from(aiAgentSiteBindings)
    .where(and(eq(aiAgentSiteBindings.agentId, agentId), eq(aiAgentSiteBindings.siteId, siteId)))
    .limit(1);

  let widgetKey: string;

  if (existingBinding.length) {
    widgetKey = existingBinding[0].widgetKey;
    const mergedMeta = hasMetaPatch
      ? mergeWidgetBindingMetadata(existingBinding[0].metadata, metaPatch)
      : null;
    const isActiveValue =
      typeof body.isActive === "boolean" ? body.isActive : existingBinding[0].isActive;
    await db
      .update(aiAgentSiteBindings)
      .set({
        isActive: isActiveValue,
        updatedAt: new Date(),
        clientId: resolvedClientId,
        ...(hasAllowedDomains && { allowedDomains }),
        ...(mergedMeta && { metadata: JSON.stringify(mergedMeta) }),
      } as Record<string, unknown>)
      .where(eq(aiAgentSiteBindings.id, existingBinding[0].id));
  } else {
    widgetKey = generateWidgetKey();
    const bindingId = crypto.randomUUID();
    const defaults = {
      agentToolsInWidget: false,
      siteGrounding: true,
      providerStrategy: "agent" as const,
    };
    const mergedNew = mergeWidgetBindingMetadata({}, { ...defaults, ...metaPatch });
    const isActiveOnCreate = typeof body.isActive === "boolean" ? body.isActive : true;
    await db.insert(aiAgentSiteBindings).values({
      id: bindingId,
      agentId,
      siteId,
      clientId: resolvedClientId,
      isActive: isActiveOnCreate,
      widgetKey,
      allowedDomains: hasAllowedDomains ? allowedDomains : null,
      metadata: JSON.stringify(mergedNew),
    } as Record<string, unknown>);
  }

  if (resolvedClientId) {
    await db
      .update(web3Sites)
      .set({ clientId: resolvedClientId, updatedAt: new Date() })
      .where(and(eq(web3Sites.id, siteId), eq(web3Sites.userId, userId)));
  }

  return { widgetKey };
}
