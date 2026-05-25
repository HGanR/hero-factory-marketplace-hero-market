import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { aiAgents, aiAgentSiteBindings, aiAgentBuildingBindings } from "@/lib/db/schema";
import { canAccessAgent } from "@/lib/agents/agent-access";
import { encryptToken } from "@/lib/social/encrypt";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const db = await getDb();
    await ensureAgentTables();

    const canAccess = await canAccessAgent(id, userId);
    if (!canAccess) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const rows = await db
      .select({
        agent: aiAgents,
        bindingWidgetKey: aiAgentSiteBindings.widgetKey,
        bindingSiteId: aiAgentSiteBindings.siteId,
        bindingAllowedDomains: aiAgentSiteBindings.allowedDomains,
        bindingMetadata: aiAgentSiteBindings.metadata,
      })
      .from(aiAgents)
      .leftJoin(aiAgentSiteBindings, eq(aiAgentSiteBindings.agentId, aiAgents.id))
      .where(eq(aiAgents.id, id))
      .orderBy(desc(aiAgentSiteBindings.updatedAt))
      .limit(1);

    const [buildingBinding] = await db
      .select({
        worldId: aiAgentBuildingBindings.worldId,
        buildingId: aiAgentBuildingBindings.buildingId,
      })
      .from(aiAgentBuildingBindings)
      .where(eq(aiAgentBuildingBindings.agentId, id))
      .limit(1);

    const r = rows[0];
    if (!r?.agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const row = r.agent;
    const toolsJson = row.toolsJson ? (typeof row.toolsJson === "string" ? JSON.parse(row.toolsJson) : row.toolsJson) : {};
    const bindingMeta = r.bindingMetadata
      ? (typeof r.bindingMetadata === "string" ? JSON.parse(r.bindingMetadata as string) : r.bindingMetadata) as Record<string, unknown> | null
      : null;
    const allowedDomainsArr = r.bindingAllowedDomains
      ? (typeof r.bindingAllowedDomains === "string" ? JSON.parse(r.bindingAllowedDomains) : r.bindingAllowedDomains) as string[] | null
      : null;
    const retentionDays = typeof bindingMeta?.retentionDays === "number" && [7, 30, 90, 365].includes(bindingMeta.retentionDays)
      ? bindingMeta.retentionDays
      : 90;

    const item = {
      ...row,
      toolsJson,
      consultantId: row.consultantId,
      widgetKey: r.bindingWidgetKey ?? null,
      siteId: r.bindingSiteId ?? null,
      allowedDomains: Array.isArray(allowedDomainsArr) ? allowedDomainsArr.join(", ") : "",
      consentRequired: bindingMeta?.consentRequired === true,
      consentText: (typeof bindingMeta?.consentText === "string" ? bindingMeta.consentText : null) ?? "This chat may be recorded and stored for follow-up. By continuing you agree.",
      retentionDays,
      llmEndpoint: row.llmEndpoint ?? null,
      hasCustomApi: Boolean(row.llmEndpoint?.trim()),
      model: row.model ?? null,
      buildingWorldId: buildingBinding?.worldId ?? null,
      buildingBuildingId: buildingBinding?.buildingId ?? null,
    };
    delete (item as Record<string, unknown>).llmApiKeyEnc;

    return NextResponse.json({ item });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("agents [id] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch agent" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const body = await req.json().catch(() => ({}));

    const db = await getDb();
    await ensureAgentTables();

    const canAccess = await canAccessAgent(id, userId);
    if (!canAccess) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updates: Record<string, unknown> = {};
    if (typeof body?.name === "string") updates.name = body.name.trim() || "New Agent";
    if (typeof body?.description === "string") updates.description = body.description.trim() || null;
    if (typeof body?.systemPrompt === "string") updates.systemPrompt = body.systemPrompt;
    if (["draft", "active", "paused"].includes(body?.status)) updates.status = body.status;
    if (typeof body?.toolsJson === "object" && body.toolsJson !== null) {
      updates.toolsJson = JSON.stringify(body.toolsJson);
    }
    if (body && "consultantId" in body) {
      updates.consultantId =
        typeof body.consultantId === "string" && body.consultantId.trim()
          ? body.consultantId.trim()
          : null;
    }
    if (body && "voiceId" in body) {
      updates.voiceId = typeof body.voiceId === "string" && body.voiceId.trim() ? body.voiceId.trim() : null;
    }
    if (body && "voiceProvider" in body) {
      updates.voiceProvider = typeof body.voiceProvider === "string" && body.voiceProvider.trim() ? body.voiceProvider.trim() : null;
    }
    if (body && "workspaceId" in body) {
      updates.workspaceId =
        typeof body.workspaceId === "string" && body.workspaceId.trim()
          ? body.workspaceId.trim()
          : null;
    }
    if (body && "llmEndpoint" in body) {
      updates.llmEndpoint =
        typeof body.llmEndpoint === "string" && body.llmEndpoint.trim()
          ? body.llmEndpoint.trim()
          : null;
    }
    if (body && "llmApiKey" in body) {
      const raw = body.llmApiKey;
      if (typeof raw === "string") {
        updates.llmApiKeyEnc = raw.trim() ? encryptToken(raw.trim()) : null;
      }
    }
    if (body && "model" in body) {
      updates.model =
        typeof body.model === "string" && body.model.trim()
          ? body.model.trim()
          : null;
    }
    if (body && "language" in body) {
      updates.language =
        typeof body.language === "string" && body.language.trim()
          ? body.language.trim().slice(0, 16)
          : null;
    }
    if (body && "industriesJson" in body) {
      const val = body.industriesJson;
      updates.industriesJson = val === null || val === undefined || val === ""
        ? null
        : typeof val === "string"
          ? val
          : Array.isArray(val)
            ? JSON.stringify(val)
            : null;
    }

    if (body && "avatarImageUrl" in body) {
      updates.avatarImageUrl =
        typeof body.avatarImageUrl === "string" && body.avatarImageUrl.trim()
          ? body.avatarImageUrl.trim()
          : null;
    }
    if (body && "avatarAltText" in body) {
      updates.avatarAltText =
        typeof body.avatarAltText === "string" && body.avatarAltText.trim()
          ? body.avatarAltText.trim().slice(0, 160)
          : null;
    }
    if (body && "agentRuntimeType" in body) {
      const allowed = new Set([
        "general",
        "receptionist",
        "executive_admin",
        "revenue_operator",
        "trust_advisor",
        "concierge",
      ]);
      const v = typeof body.agentRuntimeType === "string" ? body.agentRuntimeType.trim().toLowerCase() : "";
      updates.agentRuntimeType = v && allowed.has(v) ? v : null;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(aiAgents).set(updates as any).where(eq(aiAgents.id, id));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("agents [id] PATCH error:", err);
    return NextResponse.json({ error: "Failed to update agent" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(req);
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const db = await getDb();
    await ensureAgentTables();

    await db.delete(aiAgentSiteBindings).where(eq(aiAgentSiteBindings.agentId, id));
    await db.delete(aiAgents).where(and(eq(aiAgents.id, id), eq(aiAgents.userId, userId)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("agents [id] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete agent" }, { status: 500 });
  }
}
