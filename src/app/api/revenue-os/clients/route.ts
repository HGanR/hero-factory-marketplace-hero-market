import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { createClientAccount, listClientsForUser } from "@/lib/revenue-os/client-hub-queries";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { CLIENT_SERVICE_OPTIONS } from "@/lib/revenue-os/client-service-options";

export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    await ensureClientHubTables();
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const clients = await listClientsForUser(userId);
    return NextResponse.json({ clients });
  } catch (e) {
    console.error("GET /api/revenue-os/clients", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    await ensureClientHubTables();
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await req.json().catch(() => null)) as {
      name?: string;
      status?: string;
      workspaceId?: string | null;
      notes?: string | null;
      logoUrl?: string | null;
      requestedServices?: string[] | null;
    } | null;
    if (!body?.name || !String(body.name).trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const requestedServices = Array.isArray(body?.requestedServices)
      ? body!.requestedServices
          .map((x) => String(x ?? "").trim())
          .filter((x): x is string => CLIENT_SERVICE_OPTIONS.includes(x as (typeof CLIENT_SERVICE_OPTIONS)[number]))
      : null;
    const { id } = await createClientAccount(userId, {
      name: body.name,
      status: body.status,
      workspaceId: body.workspaceId,
      notes: body.notes,
      logoUrl: typeof body.logoUrl === "string" ? body.logoUrl.trim().slice(0, 200000) : null,
      requestedServices,
    });
    return NextResponse.json({ id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    if (String(msg).includes("name")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("POST /api/revenue-os/clients", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
