import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { canAccessAgent } from "@/lib/agents/agent-access";
import { AGENT_PLUGIN_REGISTRY, getPluginByKey } from "@/lib/agent-plugins/registry";
import { resolveAgentCapabilities } from "@/lib/agent-plugins/resolve-agent-capabilities";
import { buildLlmToolDefinitions } from "@/lib/agent-plugins/tool-metadata";
import { humanizeStoredCredentialError } from "@/lib/agent-plugins/google-api-errors";
import { agentPluginInstallations } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(_req);
    const { id: agentId } = await params;
    if (!agentId) return NextResponse.json({ error: "id required" }, { status: 400 });

    const ok = await canAccessAgent(agentId, userId);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const resolved = await resolveAgentCapabilities(agentId);
    const db = await getDb();
    const instRows = await db
      .select({ pluginKey: agentPluginInstallations.pluginKey, enabled: agentPluginInstallations.enabled })
      .from(agentPluginInstallations)
      .where(eq(agentPluginInstallations.agentId, agentId));

    const enabledMap = new Map(instRows.map((r) => [r.pluginKey, r.enabled]));
    const executableKeys = new Set(resolved.executableActions.map((a) => a.actionKey));

    const plugins = AGENT_PLUGIN_REGISTRY.map((p) => ({
      pluginKey: p.pluginKey,
      displayName: p.displayName,
      purpose: p.purpose,
      authType: p.authType,
      runtimeImplemented: p.runtimeImplemented,
      enabled: enabledMap.get(p.pluginKey) ?? false,
      actions: p.actions.map((a) => ({
        actionKey: a.actionKey,
        displayName: a.displayName,
        description: a.description,
        kind: a.kind,
        invocationHint: a.invocationHint,
        runtimeImplemented: a.runtimeImplemented,
        executable: executableKeys.has(a.actionKey),
      })),
    }));

    return NextResponse.json({
      providerAuthorized: resolved.providerAuthorized,
      grantedScopes: resolved.grantedScopes,
      lastError: resolved.lastError,
      lastErrorHint: humanizeStoredCredentialError(resolved.lastError),
      gating: resolved.gating,
      tools: buildLlmToolDefinitions(resolved),
      plugins,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("[agent capabilities GET]", e);
    return NextResponse.json({ error: "Failed to load capabilities" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const userId = requireUserId(req);
    const { id: agentId } = await params;
    if (!agentId) return NextResponse.json({ error: "id required" }, { status: 400 });

    await ensureAgentTables();
    const ok = await canAccessAgent(agentId, userId);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = (await req.json().catch(() => ({}))) as { pluginKey?: string; enabled?: boolean };
    const pluginKey = typeof body.pluginKey === "string" ? body.pluginKey.trim() : "";
    if (!pluginKey || !getPluginByKey(pluginKey)) {
      return NextResponse.json({ error: "Invalid pluginKey" }, { status: 400 });
    }
    const enabled = Boolean(body.enabled);

    const db = await getDb();
    await db
      .insert(agentPluginInstallations)
      .values({
        id: crypto.randomUUID(),
        agentId,
        pluginKey,
        enabled,
      })
      .onDuplicateKeyUpdate({
        set: {
          enabled,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("[agent capabilities POST]", e);
    return NextResponse.json({ error: "Failed to update capability" }, { status: 500 });
  }
}
