import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { assertValidClientId, getOwnedClientRow, updateClientAccount } from "@/lib/revenue-os/client-hub-queries";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { CLIENT_SERVICE_OPTIONS } from "@/lib/revenue-os/client-service-options";

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    await ensureClientHubTables();
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { clientId: raw } = await ctx.params;
    let clientId = raw;
    try {
      assertValidClientId(clientId);
    } catch {
      return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
    }
    const row = await getOwnedClientRow(userId, clientId);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      client: {
        id: row.id,
        name: row.name,
        status: row.status,
        workspaceId: row.workspaceId ?? null,
        notes: row.notes ?? null,
        logoUrl: typeof row.logoUrl === "string" && row.logoUrl.trim() ? row.logoUrl : null,
        requestedServices:
          typeof row.servicesJson === "string"
            ? ((() => {
                try {
                  const parsed = JSON.parse(row.servicesJson) as unknown;
                  return Array.isArray(parsed)
                    ? parsed
                        .map((x) => String(x ?? "").trim())
                        .filter((x): x is string =>
                          CLIENT_SERVICE_OPTIONS.includes(x as (typeof CLIENT_SERVICE_OPTIONS)[number]),
                        )
                    : [];
                } catch {
                  return [];
                }
              })())
            : [],
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      },
    });
  } catch (e) {
    console.error("GET /api/revenue-os/clients/[clientId]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    await ensureClientHubTables();
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { clientId: raw } = await ctx.params;
    let clientId = raw;
    try {
      assertValidClientId(clientId);
    } catch {
      return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
    }
    const body = (await req.json().catch(() => null)) as {
      name?: string;
      status?: string;
      workspaceId?: string | null;
      notes?: string | null;
      logoUrl?: string | null;
      requestedServices?: string[] | null;
    } | null;
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    const requestedServices = Array.isArray(body?.requestedServices)
      ? body!.requestedServices
          .map((x) => String(x ?? "").trim())
          .filter((x): x is string => CLIENT_SERVICE_OPTIONS.includes(x as (typeof CLIENT_SERVICE_OPTIONS)[number]))
      : undefined;
    const row = await updateClientAccount(userId, clientId, {
      name: body.name,
      status: body.status,
      workspaceId: body.workspaceId,
      notes: body.notes,
      logoUrl: typeof body.logoUrl === "string" ? body.logoUrl.trim().slice(0, 200000) : body.logoUrl,
      requestedServices,
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      client: {
        id: row.id,
        name: row.name,
        status: row.status,
        workspaceId: row.workspaceId ?? null,
        notes: row.notes ?? null,
        logoUrl: typeof row.logoUrl === "string" && row.logoUrl.trim() ? row.logoUrl : null,
        requestedServices:
          typeof row.servicesJson === "string"
            ? ((() => {
                try {
                  const parsed = JSON.parse(row.servicesJson) as unknown;
                  return Array.isArray(parsed)
                    ? parsed
                        .map((x) => String(x ?? "").trim())
                        .filter((x): x is string =>
                          CLIENT_SERVICE_OPTIONS.includes(x as (typeof CLIENT_SERVICE_OPTIONS)[number]),
                        )
                    : [];
                } catch {
                  return [];
                }
              })())
            : [],
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (String(msg).includes("name") || String(msg).includes("Invalid")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("PATCH /api/revenue-os/clients/[clientId]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
