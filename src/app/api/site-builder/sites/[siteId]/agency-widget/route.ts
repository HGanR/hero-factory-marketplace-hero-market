import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { aiAgents, aiAgentSiteBindings, web3SiteVersions } from "@/lib/db/schema";
import { getOwnedSite } from "@/lib/site-builder/db";
import { upsertAgentSiteWidgetBindingFromHttpBody } from "@/lib/widget/upsert-agent-site-widget-binding";
import { parseWidgetBindingMetadata } from "@/lib/widget/widget-binding-metadata";
import { mergeWidgetIntegrationIntoSiteSchema } from "@/lib/site-builder/merge-widget-integration";

type Params = { params: Promise<{ siteId: string }> };

function publicOrigin(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return u ? u.replace(/\/$/, "") : "";
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(req);
    const { siteId } = await params;
    if (!siteId?.trim()) return NextResponse.json({ error: "siteId required" }, { status: 400 });

    const db = await getDb();
    await ensureAgentTables();

    const site = await getOwnedSite(db, userId, siteId.trim());
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const rows = await db
      .select({
        widgetKey: aiAgentSiteBindings.widgetKey,
        agentId: aiAgentSiteBindings.agentId,
        isActive: aiAgentSiteBindings.isActive,
        metadata: aiAgentSiteBindings.metadata,
        clientId: aiAgentSiteBindings.clientId,
        agentName: aiAgents.name,
        agentStatus: aiAgents.status,
      })
      .from(aiAgentSiteBindings)
      .innerJoin(aiAgents, eq(aiAgents.id, aiAgentSiteBindings.agentId))
      .where(eq(aiAgentSiteBindings.siteId, siteId.trim()))
      .limit(5);

    const origin = publicOrigin();
    const items = rows.map((r) => {
      const meta = parseWidgetBindingMetadata(r.metadata);
      const enc = encodeURIComponent(r.widgetKey);
      const snippet = origin
        ? `<script src="${origin}/widget/loader.js" data-widget-key="${r.widgetKey}" async></script>`
        : `<!-- Set NEXT_PUBLIC_SITE_URL; then: --><script src="YOUR_APP_ORIGIN/widget/loader.js" data-widget-key="${r.widgetKey}" async></script>`;
      return {
        widgetKey: r.widgetKey,
        agentId: r.agentId,
        agentName: r.agentName,
        agentStatus: r.agentStatus,
        isActive: r.isActive,
        clientId: r.clientId ?? null,
        providerStrategy: meta.providerStrategy ?? "agent",
        embedSnippet: snippet,
      };
    });

    return NextResponse.json({
      siteId: site.id,
      /** Internal Revenue OS id only — not exposed in public /api/widget/.../config. */
      siteClientId: site.clientId ?? null,
      bindings: items,
      loaderHint: origin || null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("agency-widget GET error:", err);
    return NextResponse.json({ error: "Failed to load widget bindings" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(req);
    const { siteId } = await params;
    if (!siteId?.trim()) return NextResponse.json({ error: "siteId required" }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const agentId = typeof body.agentId === "string" ? body.agentId.trim() : "";
    if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });

    const db = await getDb();
    await ensureAgentTables();
    await ensureClientHubTables();

    const site = await getOwnedSite(db, userId, siteId.trim());
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const bindBody = { ...body, siteId: site.id };
    const { widgetKey } = await upsertAgentSiteWidgetBindingFromHttpBody(db, userId, agentId, bindBody);

    const origin = publicOrigin();
    const enc = encodeURIComponent(widgetKey);
    const embedSnippet = origin
      ? `<script src="${origin}/widget/loader.js" data-widget-key="${widgetKey}" async></script>`
      : `<!-- Set NEXT_PUBLIC_SITE_URL --><script src="YOUR_APP_ORIGIN/widget/loader.js" data-widget-key="${widgetKey}" async></script>`;

    let schemaPatch: Record<string, unknown> | null = null;
    if (body.applyToSchema === true) {
      const versionId =
        typeof body.versionId === "string" && body.versionId.trim() ? body.versionId.trim() : site.currentVersionId;
      if (versionId) {
        const [ver] = await db
          .select({ schemaJson: web3SiteVersions.schemaJson })
          .from(web3SiteVersions)
          .where(and(eq(web3SiteVersions.id, versionId), eq(web3SiteVersions.siteId, site.id)))
          .limit(1);
        if (ver?.schemaJson) {
          let doc: unknown;
          try {
            doc = JSON.parse(ver.schemaJson) as unknown;
          } catch {
            doc = null;
          }
          if (doc) {
            const loaderOrigin = typeof body.loaderOrigin === "string" ? body.loaderOrigin : undefined;
            const merged = mergeWidgetIntegrationIntoSiteSchema(doc, { widgetKey, loaderOrigin });
            if (merged.ok) {
              schemaPatch = merged.schema as unknown as Record<string, unknown>;
            }
          }
        }
      }
    }

    return NextResponse.json({
      widgetKey,
      embedSnippet,
      endpoints: {
        config: `/api/widget/${enc}/config`,
        message: `/api/widget/${enc}/message`,
      },
      ...(schemaPatch ? { schema: schemaPatch } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    if (msg === "Agent not found") return NextResponse.json({ error: msg }, { status: 404 });
    if (msg === "Site not found or access denied") return NextResponse.json({ error: msg }, { status: 403 });
    if (msg === "Client not found or access denied") return NextResponse.json({ error: msg }, { status: 403 });
    if (msg === "Invalid client id") return NextResponse.json({ error: msg }, { status: 400 });
    if (msg === "clientId must be a string or null") return NextResponse.json({ error: msg }, { status: 400 });
    if (msg === "siteId required") return NextResponse.json({ error: msg }, { status: 400 });
    console.error("agency-widget POST error:", err);
    return NextResponse.json({ error: "Failed to bind widget" }, { status: 500 });
  }
}
