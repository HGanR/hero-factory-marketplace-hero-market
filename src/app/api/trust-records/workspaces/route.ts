/**
 * GET /api/trust-records/workspaces — List all workspaces (trusts) for the authenticated user.
 * Used by dashboard workspace selector.
 */
import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aiAgents, clientAccounts, clients, trusts } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { CRM_ONLY_WORKSPACE_PREFIX } from "@/lib/smart-trust-platform-binding";
import { parseRequestedServicesJson } from "@/lib/clients/requested-services";

export async function GET(_request: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();

  try {
    /** `trusts.clientId` is the CRM `clients.id` (UUID), not `client_accounts.id` — join the clients table. */
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
        crmFirstName: clients.firstName,
        crmLastName: clients.lastName,
        crmEntityDisplayName: clients.entityDisplayName,
        crmLogoDataUrl: clients.businessLogoDataUrl,
        crmRequestedServicesJson: clients.requestedServicesJson,
      })
      .from(trusts)
      .leftJoin(
        clients,
        and(eq(clients.id, trusts.clientId), eq(clients.userId, userId)),
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

    const workspaces: Array<Record<string, unknown>> = rows.map((t: any) => {
      const person = [t.crmFirstName, t.crmLastName].filter(Boolean).join(" ").trim();
      const entity =
        typeof t.crmEntityDisplayName === "string" && String(t.crmEntityDisplayName).trim()
          ? String(t.crmEntityDisplayName).trim()
          : null;
      const crmLogo =
        typeof t.crmLogoDataUrl === "string" && String(t.crmLogoDataUrl).trim()
          ? String(t.crmLogoDataUrl).trim()
          : null;
      return {
        kind: "trust" as const,
        id: String(t.id),
        name: t.name ?? "Untitled Workspace",
        trustType: t.trustType ?? null,
        jurisdictionState: t.jurisdictionState ?? null,
        clientId: t.clientId ?? null,
        clientName: entity || (person || null),
        logoUrl: crmLogo,
      agentName: bestAgentByWorkspace.get(String(t.id))?.agentName ?? null,
      agentAvatarImageUrl: bestAgentByWorkspace.get(String(t.id))?.agentAvatarImageUrl ?? null,
      requestedServices: parseRequestedServicesJson(
          typeof t.crmRequestedServicesJson === "string" ? t.crmRequestedServicesJson : null,
        ),
        workspaceStatus: t.workspaceStatus ?? null,
        createdAt: t.createdAt ? new Date(t.createdAt as any).toISOString() : null,
        updatedAt: t.updatedAt ? new Date(t.updatedAt as any).toISOString() : null,
      };
    });

    const trustBoundCrmIds = new Set(
      rows.map((r: { clientId?: string | null }) => String(r.clientId ?? "").trim()).filter(Boolean),
    );
    const crmOnly = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, userId))
      .orderBy(desc(clients.updatedAt))
      .limit(200);
    for (const c of crmOnly) {
      const cid = String(c.id);
      if (trustBoundCrmIds.has(cid)) continue;
      const person = [c.firstName, c.middleName, c.lastName].filter(Boolean).join(" ").trim() || "Unnamed";
      const rowLogo =
        typeof c.businessLogoDataUrl === "string" && String(c.businessLogoDataUrl).trim()
          ? String(c.businessLogoDataUrl).trim()
          : null;
      workspaces.push({
        kind: "crm_client" as const,
        id: `${CRM_ONLY_WORKSPACE_PREFIX}${cid}`,
        name: `Client file · ${person}`,
        trustType: null,
        jurisdictionState: null,
        clientId: cid,
        clientName: person,
        logoUrl: rowLogo,
        agentName: null,
        agentAvatarImageUrl: null,
        requestedServices: parseRequestedServicesJson(
          typeof c.requestedServicesJson === "string" ? c.requestedServicesJson : null,
        ),
        workspaceStatus: "client_file" as const,
        createdAt: c.createdAt ? new Date(c.createdAt as any).toISOString() : null,
        updatedAt: c.updatedAt ? new Date(c.updatedAt as any).toISOString() : null,
      });
    }

    if (workspaces.length === 0 && fallbackRows?.length) {
      const seen = new Set<string>();
      for (const r of fallbackRows) {
        const id = String(r.workspaceId ?? "").trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        workspaces.push({
          kind: "hub_account" as const,
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
