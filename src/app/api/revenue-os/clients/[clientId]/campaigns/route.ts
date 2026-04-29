import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { assertValidClientId, getOwnedClientRow } from "@/lib/revenue-os/client-hub-queries";
import { listCampaignsForClientHub } from "@/lib/revenue-os/client-hub-campaigns-adapter";
import { recordClientHubAutomationEvent } from "@/lib/revenue-os/client-hub-automation-events";
import { resolveClientIdForCampaignOrReject } from "@/lib/revenue-os/validate-campaign-client-id";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

const CreateForClient = z
  .object({
    name: z.string().min(1).max(200),
    objective: z.string().optional(),
  })
  .strict();

type Ctx = { params: Promise<{ clientId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    await ensureClientHubTables();
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { clientId } = await ctx.params;
    try {
      assertValidClientId(clientId);
    } catch {
      return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
    }
    const { items, adapterNote } = await listCampaignsForClientHub(userId, clientId);
    return NextResponse.json({ campaigns: items, adapterNote });
  } catch (e) {
    console.error("GET .../campaigns", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/**
 * Create a DRAFT campaign with `clientId` forced to the path client (owner-checked).
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    await ensureClientHubTables();
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { clientId: pathClient } = await ctx.params;
    try {
      assertValidClientId(pathClient);
    } catch {
      return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
    }
    if (!(await getOwnedClientRow(userId, pathClient))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const resolved = await resolveClientIdForCampaignOrReject(userId, pathClient);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    if (resolved.clientId !== pathClient) {
      return NextResponse.json({ error: "Client scope mismatch" }, { status: 500 });
    }

    const body = await req.json();
    const parsed = CreateForClient.parse(body);
    const id = crypto.randomUUID();
    const db = await getDb();
    await db.insert(campaigns).values({
      id,
      userId: String(userId),
      clientId: pathClient,
      name: parsed.name,
      objective: parsed.objective?.trim() || null,
      status: "DRAFT",
    });

    await recordClientHubAutomationEvent(userId, pathClient, "campaign_created", {
      refId: id,
      metadata: { name: parsed.name, source: "client_hub_create" },
    });

    return NextResponse.json({ id, status: "DRAFT" });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: e.flatten() }, { status: 400 });
    }
    console.error("POST .../clients/.../campaigns", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
