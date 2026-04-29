import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aiAgents, aiAgentSiteBindings } from "@/lib/db/schema";
import { isOriginAllowed, parseAllowedDomains } from "@/lib/widget/allowed-domains";
import { parseWidgetBindingMetadata } from "@/lib/widget/widget-binding-metadata";

type Params = { params: Promise<{ widgetKey: string }> };

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * Public read: returns safe display config for the chat widget. No auth required.
 * Intentionally does not expose `client_accounts` ids or other internal Revenue OS attribution.
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { widgetKey } = await params;
    if (!widgetKey) return NextResponse.json({ error: "widgetKey required" }, { status: 400 });

    const db = await getDb();

    const origin = req.headers.get("origin") || req.headers.get("referer") || "";

    const rows = await db
      .select({
        agentName: aiAgents.name,
        agentDescription: aiAgents.description,
        allowedDomains: aiAgentSiteBindings.allowedDomains,
        metadata: aiAgentSiteBindings.metadata,
        status: aiAgents.status,
      })
      .from(aiAgentSiteBindings)
      .innerJoin(aiAgents, eq(aiAgents.id, aiAgentSiteBindings.agentId))
      .where(
        and(
          eq(aiAgentSiteBindings.widgetKey, widgetKey),
          eq(aiAgentSiteBindings.isActive, true)
        )
      )
      .limit(1);

    const row = rows[0];
    if (!row || row.status !== "active") {
      return NextResponse.json({ error: "Widget not found or inactive" }, { status: 404, headers: corsHeaders });
    }

    const allowed = parseAllowedDomains(row.allowedDomains);
    if (allowed.length > 0 && !isOriginAllowed(origin, allowed)) {
      return NextResponse.json({ error: "Origin not allowed" }, { status: 403, headers: corsHeaders });
    }

    const meta = parseWidgetBindingMetadata(row.metadata);
    const consentRequired = meta.consentRequired === true;
    const consentText =
      meta.consentText?.trim() ||
      "This chat may be recorded and stored for follow-up. By continuing you agree.";
    const welcomeMessage =
      meta.welcomeMessage?.trim() ||
      (row.agentDescription ? `Hi — ${row.agentDescription} How can I help?` : "Hi — how can I help?");
    const starterPrompts =
      meta.starterPrompts?.length ? meta.starterPrompts : ["What can you help me with?", "Tell me about your services."];

    const encKey = encodeURIComponent(widgetKey);
    const providerStrategy = meta.providerStrategy ?? "agent";

    return NextResponse.json(
      {
        config: {
          name: meta.title?.trim() || row.agentName,
          description: row.agentDescription,
          tagline: row.agentDescription || "Ask a question",
          welcomeMessage,
          placeholder: meta.placeholder?.trim() || "Type your message…",
          starterPrompts,
          mode: meta.mode ?? "public_chat",
          consentRequired,
          consentText: consentText.slice(0, 500),
          visual: {
            launcherPosition: meta.visual?.launcherPosition ?? "right",
            theme: meta.visual?.theme ?? "dark",
            accent: meta.visual?.accent ?? "#22d3ee",
            launcherLabel: meta.visual?.launcherLabel?.trim() || "AI",
          },
          widgetAppearance: {
            avatarImageUrl: meta.widgetAppearance?.avatarImageUrl ?? null,
            avatarAltText: meta.widgetAppearance?.avatarAltText ?? null,
            avatarShape: "circle",
            avatarBorderColor: meta.widgetAppearance?.avatarBorderColor ?? "#2563eb",
            avatarBorderWidth: meta.widgetAppearance?.avatarBorderWidth ?? 2,
            widgetBubbleColor: meta.widgetAppearance?.widgetBubbleColor ?? "#ffffff",
            widgetWindowBackgroundColor: meta.widgetAppearance?.widgetWindowBackgroundColor ?? "#0f172a",
            widgetHeaderColor: meta.widgetAppearance?.widgetHeaderColor ?? "#1e293b",
            widgetTextColor: meta.widgetAppearance?.widgetTextColor ?? "#e2e8f0",
            widgetAccentColor: meta.widgetAppearance?.widgetAccentColor ?? "#22d3ee",
          },
          capabilities: {
            fileUpload: false,
            /** Omitted on legacy bindings = tools may run; explicit false disables. */
            agentTools: meta.agentToolsInWidget !== false,
          },
          /** Opaque — no secrets. `site_builder` means LLM follows site AI settings when configured. */
          providerMode: providerStrategy,
          endpoints: {
            config: `/api/widget/${encKey}/config`,
            message: `/api/widget/${encKey}/message`,
          },
        },
      },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("widget config GET error:", err);
    return NextResponse.json({ error: "Failed to load widget config" }, { status: 500, headers: corsHeaders });
  }
}
