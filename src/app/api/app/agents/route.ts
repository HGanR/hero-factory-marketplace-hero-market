import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { aiAgents, aiAgentCollaborators } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId")?.trim() || null;

    const db = await getDb();
    await ensureAgentTables();

    // Agents user owns
    const ownedWhere = eq(aiAgents.userId, userId);
    const ownedWorkspaceWhere = workspaceId
      ? and(ownedWhere, or(eq(aiAgents.workspaceId, workspaceId), isNull(aiAgents.workspaceId)))
      : ownedWhere;

    const ownedRows = await db
      .select({
        id: aiAgents.id,
        name: aiAgents.name,
        description: aiAgents.description,
        status: aiAgents.status,
        workspaceId: aiAgents.workspaceId,
        updatedAt: aiAgents.updatedAt,
        avatarImageUrl: aiAgents.avatarImageUrl,
        avatarAltText: aiAgents.avatarAltText,
      })
      .from(aiAgents)
      .where(ownedWorkspaceWhere)
      .orderBy(desc(aiAgents.updatedAt));

    // Agent IDs user collaborates on (same workspaceId when filtering)
    const collabAgentIds = await db
      .select({ agentId: aiAgentCollaborators.agentId })
      .from(aiAgentCollaborators)
      .where(eq(aiAgentCollaborators.userId, userId));

    const agentIds = collabAgentIds.map((c) => c.agentId).filter(Boolean);
    let collabRows: typeof ownedRows = [];
    if (agentIds.length > 0) {
      const collabWhere = workspaceId
        ? and(
            inArray(aiAgents.id, agentIds),
            or(eq(aiAgents.workspaceId, workspaceId), isNull(aiAgents.workspaceId))
          )
        : inArray(aiAgents.id, agentIds);
      collabRows = await db
        .select({
          id: aiAgents.id,
          name: aiAgents.name,
          description: aiAgents.description,
          status: aiAgents.status,
          workspaceId: aiAgents.workspaceId,
          updatedAt: aiAgents.updatedAt,
          avatarImageUrl: aiAgents.avatarImageUrl,
          avatarAltText: aiAgents.avatarAltText,
        })
        .from(aiAgents)
        .where(collabWhere)
        .orderBy(desc(aiAgents.updatedAt));
    }

    const seen = new Set<string>();
    const rows = [...ownedRows];
    for (const r of collabRows) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        rows.push(r);
      }
    }
    rows.sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime());

    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
      workspaceId: r.workspaceId,
      updatedAt: r.updatedAt,
      avatarImageUrl: r.avatarImageUrl ?? null,
      avatarAltText: r.avatarAltText ?? null,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("agents GET error:", err);
    return NextResponse.json({ error: "Failed to list agents" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = requireUserId(req);
    const body = await req.json().catch(() => ({}));

    const name = typeof body?.name === "string" ? body.name.trim() : "New Agent";
    const description = typeof body?.description === "string" ? body.description.trim() : null;
    const systemPrompt = typeof body?.systemPrompt === "string" ? body.systemPrompt : "You are a helpful assistant.";
    const status = ["draft", "active", "paused"].includes(body?.status) ? body.status : "draft";
    const toolsJson =
      typeof body?.toolsJson === "object" && body.toolsJson !== null
        ? JSON.stringify(body.toolsJson)
        : JSON.stringify({ crm: true, tasks: true, automations: false, siteContext: true });
    const consultantId = typeof body?.consultantId === "string" && body.consultantId.trim() ? body.consultantId.trim() : null;
    const workspaceId = typeof body?.workspaceId === "string" && body.workspaceId.trim() ? body.workspaceId.trim() : null;
    const avatarImageUrl = typeof body?.avatarImageUrl === "string" && body.avatarImageUrl.trim() ? body.avatarImageUrl.trim() : null;
    const avatarAltText = typeof body?.avatarAltText === "string" && body.avatarAltText.trim() ? body.avatarAltText.trim().slice(0, 160) : null;
    const allowedRt = new Set([
      "general",
      "receptionist",
      "executive_admin",
      "revenue_operator",
      "trust_advisor",
      "concierge",
    ]);
    const rawRt = typeof body?.agentRuntimeType === "string" ? body.agentRuntimeType.trim().toLowerCase() : "";
    const agentRuntimeType = rawRt && allowedRt.has(rawRt) ? rawRt : null;

    const id = crypto.randomUUID();

    const db = await getDb();
    await ensureAgentTables();

    await db.insert(aiAgents).values({
      id,
      userId,
      workspaceId,
      consultantId,
      name: name || "New Agent",
      description: description || null,
      systemPrompt,
      status,
      toolsJson,
      avatarImageUrl,
      avatarAltText,
      agentRuntimeType,
    });

    return NextResponse.json({ id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("agents POST error:", err);
    return NextResponse.json({ error: "Failed to create agent" }, { status: 500 });
  }
}
