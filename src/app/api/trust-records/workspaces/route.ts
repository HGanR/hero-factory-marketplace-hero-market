/**
 * GET /api/trust-records/workspaces — List all workspaces (trusts) for the authenticated user.
 * Used by dashboard workspace selector.
 */
import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aiAgents, clientAccounts, trusts } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";

export async function GET(_request: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();

  try {
    const rows = await db
      .select({
        id: trusts.id,
        name: trusts.name,
        trustType: trusts.trustType,
        jurisdictionState: trusts.jurisdictionState,
        clientId: trusts.clientId,
        workspaceStatus: trusts.workspaceStatus,
        createdAt: trusts.createdAt,
        updatedAt: trusts.updatedAt,
        clientName: clientAccounts.name,
        logoUrl: clientAccounts.logoUrl,
        servicesJson: clientAccounts.servicesJson,
      })
      .from(trusts)
      .leftJoin(
        clientAccounts,
        and(eq(clientAccounts.id, trusts.clientId), eq(clientAccounts.ownerUserId, userId)),
      )
      .where(eq(trusts.userId, userId))
      .orderBy(desc(trusts.updatedAt))
      .limit(100);

    let fallbackRows:
      | Array<{
          workspaceId: string | null;
          name: string | null;
          logoUrl: string | null;
          servicesJson: string | null;
          updatedAt: Date | string | null;
        }>
      | null = null;
    if (rows.length === 0) {
      fallbackRows = await db
        .select({
          workspaceId: clientAccounts.workspaceId,
          name: clientAccounts.name,
          logoUrl: clientAccounts.logoUrl,
          servicesJson: clientAccounts.servicesJson,
          updatedAt: clientAccounts.updatedAt,
        })
        .from(clientAccounts)
        .where(eq(clientAccounts.ownerUserId, userId))
        .orderBy(desc(clientAccounts.updatedAt))
        .limit(100);
    }


    const workspaceIds = rows.map((r) => String(r.id));
    const agentRows = workspaceIds.length
      ? await db
          .select({
            workspaceId: aiAgents.workspaceId,
            agentName: aiAgents.name,
            agentAvatarImageUrl: aiAgents.avatarImageUrl,
          })
          .from(aiAgents)
          .where(eq(aiAgents.userId, userId))
          .orderBy(desc(aiAgents.updatedAt))
      : [];
    const bestAgentByWorkspace = new Map<string, { agentName: string | null; agentAvatarImageUrl: string | null }>();
    for (const a of agentRows) {
      const wid = String(a.workspaceId ?? "").trim();
      if (!wid || bestAgentByWorkspace.has(wid)) continue;
      bestAgentByWorkspace.set(wid, {
        agentName: typeof a.agentName === "string" ? a.agentName : null,
        agentAvatarImageUrl:
          typeof a.agentAvatarImageUrl === "string" && a.agentAvatarImageUrl.trim()
            ? a.agentAvatarImageUrl
            : null,
      });
    }

    const workspaces = rows.map((t: any) => ({
      id: String(t.id),
      name: t.name ?? "Untitled Workspace",
      trustType: t.trustType ?? null,
      jurisdictionState: t.jurisdictionState ?? null,
      clientId: t.clientId ?? null,
      clientName: t.clientName ?? null,
      logoUrl: typeof t.logoUrl === "string" && t.logoUrl.trim() ? t.logoUrl : null,
      agentName: bestAgentByWorkspace.get(String(t.id))?.agentName ?? null,
      agentAvatarImageUrl: bestAgentByWorkspace.get(String(t.id))?.agentAvatarImageUrl ?? null,
      requestedServices:
        typeof t.servicesJson === "string"
          ? (() => {
              try {
                const parsed = JSON.parse(t.servicesJson) as unknown;
                if (!Array.isArray(parsed)) return [];
                return parsed.map((x) => String(x ?? "").trim()).filter(Boolean);
              } catch {
                return [];
              }
            })()
          : [],
      workspaceStatus: t.workspaceStatus ?? null,
      createdAt: t.createdAt ? new Date(t.createdAt as any).toISOString() : null,
      updatedAt: t.updatedAt ? new Date(t.updatedAt as any).toISOString() : null,
    }));

    if (workspaces.length === 0 && fallbackRows?.length) {
      const seen = new Set<string>();
      for (const r of fallbackRows) {
        const id = String(r.workspaceId ?? "").trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        workspaces.push({
          id,
          name: r.name ?? "Workspace",
          trustType: null,
          jurisdictionState: null,
          clientId: null,
          clientName: r.name ?? null,
          logoUrl: typeof r.logoUrl === "string" && r.logoUrl.trim() ? r.logoUrl : null,
          agentName: null,
          agentAvatarImageUrl: null,
          requestedServices:
            typeof r.servicesJson === "string"
              ? (() => {
                  try {
                    const parsed = JSON.parse(r.servicesJson) as unknown;
                    return Array.isArray(parsed) ? parsed.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
                  } catch {
                    return [];
                  }
                })()
              : [],
          workspaceStatus: "draft",
          createdAt: null,
          updatedAt: r.updatedAt ? new Date(r.updatedAt as any).toISOString() : null,
        });
      }
    }

    return NextResponse.json({ workspaces });
  } catch (error) {
    console.error("Trust records workspaces GET error:", error);
    return NextResponse.json(
      { error: "Failed to load workspaces" },
      { status: 500 }
    );
  }
}
