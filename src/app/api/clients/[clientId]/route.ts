import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, like, or } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { clientAccounts, clients, clientNotes } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { ensureClientFileColumns, ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import {
  MAX_BUSINESS_LOGO_DATA_URL_CHARS,
  validatePatchClientBody,
} from "@/lib/clients/clients-create-payload";
import { mergeRequestedServicesLists, parseRequestedServicesJson } from "@/lib/clients/requested-services";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ clientId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await ctx.params;
  if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

  await ensureClientFileColumns();
  const db = await getDb();
  const rows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, String(clientId)), eq(clients.userId, userId)))
    .limit(1);

  if (rows.length === 0) {
    if (process.env.CLIENT_ACCESS_DEBUG === "1") {
      console.warn(
        JSON.stringify({
          event: "client_access_check",
          route: "GET /api/clients/[clientId]",
          userId,
          clientIdPrefix: String(clientId).slice(0, 8),
          foundClient: false,
          ownerMatches: false,
          status: 404,
        })
      );
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const c: any = rows[0];

  const notes = await db
    .select()
    .from(clientNotes)
    .where(eq(clientNotes.clientId, String(clientId)))
    .orderBy(desc(clientNotes.createdAt));

  const idStr = String(clientId);
  const hubRows = await db
    .select({
      name: clientAccounts.name,
      logoUrl: clientAccounts.logoUrl,
      servicesJson: clientAccounts.servicesJson,
    })
    .from(clientAccounts)
    .where(
      and(
        eq(clientAccounts.ownerUserId, userId),
        or(
          like(clientAccounts.notes, `%CRM_REF:${idStr}%`),
          like(clientAccounts.notes, `%(${idStr})%`),
        ),
      ),
    )
    .limit(1);
  const hub = hubRows[0];
  let hubServices: string[] = [];
  if (typeof hub?.servicesJson === "string" && hub.servicesJson.trim()) {
    try {
      const parsed = JSON.parse(hub.servicesJson) as unknown;
      if (Array.isArray(parsed)) {
        hubServices = parsed.map((x) => String(x ?? "").trim()).filter(Boolean);
      }
    } catch {
      hubServices = [];
    }
  }
  const crmServices = parseRequestedServicesJson(c.requestedServicesJson as string | null | undefined);
  const requestedServices = mergeRequestedServicesLists(crmServices, hubServices);

  const nameFromHub = typeof hub?.name === "string" && hub.name.trim() ? hub.name.trim() : null;
  const nameFromRow =
    typeof c.entityDisplayName === "string" && String(c.entityDisplayName).trim()
      ? String(c.entityDisplayName).trim()
      : null;
  const logoFromHub = typeof hub?.logoUrl === "string" && hub.logoUrl.trim() ? hub.logoUrl.trim() : null;
  const logoFromRow =
    typeof c.businessLogoDataUrl === "string" && String(c.businessLogoDataUrl).trim()
      ? String(c.businessLogoDataUrl).trim()
      : null;

  return NextResponse.json({
    client: {
      id: String(c.id),
      firstName: c.firstName,
      middleName: c.middleName ?? null,
      lastName: c.lastName,
      suffix: c.suffix ?? null,
      email: c.email,
      phone: c.phone ?? null,
      address: {
        line1: c.addressLine1,
        line2: c.addressLine2 ?? null,
        city: c.city,
        state: c.state,
        postalCode: c.postalCode,
        country: c.country,
      },
      createdAt: c.createdAt ? new Date(c.createdAt as any).toISOString() : null,
      updatedAt: c.updatedAt ? new Date(c.updatedAt as any).toISOString() : null,
      existingEntityName: nameFromHub || nameFromRow,
      logoUrl: logoFromHub || logoFromRow,
      requestedServices,
    },
    notes: notes.map((n: any) => ({
      id: String(n.id),
      clientId: String(n.clientId),
      createdByUserId: n.createdByUserId,
      visibility: n.visibility,
      note: n.note,
      createdAt: n.createdAt ? new Date(n.createdAt as any).toISOString() : null,
    })),
  });
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ clientId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await ctx.params;
  if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });

  const idStr = String(clientId);
  const db = await getDb();
  const owned = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, idStr), eq(clients.userId, userId)))
    .limit(1);
  if (owned.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await db.delete(clientNotes).where(eq(clientNotes.clientId, idStr));
    await db
      .delete(clientAccounts)
      .where(
        and(
          eq(clientAccounts.ownerUserId, userId),
          or(
            like(clientAccounts.notes, `%CRM_REF:${idStr}%`),
            like(clientAccounts.notes, `%(${idStr})%`),
          ),
        ),
      );
    await db.delete(clients).where(and(eq(clients.id, idStr), eq(clients.userId, userId)));
  } catch (e) {
    console.error("[api/clients] DELETE", e);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ clientId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { clientId } = await ctx.params;
  if (!clientId) return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  const idStr = String(clientId);

  let rawJson: unknown;
  try {
    rawJson = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = validatePatchClientBody(rawJson);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  const body = parsed.value;

  const logoProvided = body.business_logo_data_url !== undefined;
  const servicesProvided = body.requested_services !== undefined;

  const rawLogo = body.business_logo_data_url;
  const logoValue = logoProvided
    ? rawLogo === null
      ? null
      : typeof rawLogo === "string" && rawLogo.trim()
        ? rawLogo.trim().slice(0, MAX_BUSINESS_LOGO_DATA_URL_CHARS)
        : null
    : undefined;

  const servicesJson =
    servicesProvided && Array.isArray(body.requested_services)
      ? JSON.stringify(body.requested_services)
      : undefined;

  await ensureClientFileColumns();
  const db = await getDb();

  const owned = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, idStr), eq(clients.userId, userId)))
    .limit(1);
  if (owned.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clientSet: Record<string, unknown> = {};
  if (logoProvided) clientSet.businessLogoDataUrl = logoValue;
  if (servicesProvided) clientSet.requestedServicesJson = servicesJson;

  try {
    if (Object.keys(clientSet).length > 0) {
      await db
        .update(clients)
        .set(clientSet as { businessLogoDataUrl?: string | null; requestedServicesJson?: string | null })
        .where(and(eq(clients.id, idStr), eq(clients.userId, userId)));
    }
  } catch (e) {
    console.error("[api/clients] PATCH clients row", e);
    return NextResponse.json(
      { error: logoProvided && !servicesProvided ? "Failed to update client logo" : "Failed to update client" },
      { status: 500 },
    );
  }

  try {
    await ensureClientHubTables();
    const hubRows = await db
      .select({ id: clientAccounts.id })
      .from(clientAccounts)
      .where(
        and(
          eq(clientAccounts.ownerUserId, userId),
          or(
            like(clientAccounts.notes, `%CRM_REF:${idStr}%`),
            like(clientAccounts.notes, `%(${idStr})%`),
          ),
        ),
      )
      .limit(1);
    const hubId = hubRows[0]?.id;
    if (hubId) {
      const hubSet: Record<string, unknown> = {};
      if (logoProvided) hubSet.logoUrl = logoValue;
      if (servicesProvided) hubSet.servicesJson = servicesJson;
      if (Object.keys(hubSet).length > 0) {
        await db.update(clientAccounts).set(hubSet as { logoUrl?: string | null; servicesJson?: string | null }).where(eq(clientAccounts.id, hubId));
      }
    }
  } catch (e) {
    console.warn("[api/clients] PATCH hub sync skipped", e);
  }

  const rows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, idStr), eq(clients.userId, userId)))
    .limit(1);
  const c: any = rows[0] ?? {};
  const hubRead = await db
    .select({
      name: clientAccounts.name,
      logoUrl: clientAccounts.logoUrl,
      servicesJson: clientAccounts.servicesJson,
    })
    .from(clientAccounts)
    .where(
      and(
        eq(clientAccounts.ownerUserId, userId),
        or(
          like(clientAccounts.notes, `%CRM_REF:${idStr}%`),
          like(clientAccounts.notes, `%(${idStr})%`),
        ),
      ),
    )
    .limit(1);
  const hub = hubRead[0];
  const nameFromHub = typeof hub?.name === "string" && hub.name.trim() ? hub.name.trim() : null;
  const nameFromRow =
    typeof c.entityDisplayName === "string" && String(c.entityDisplayName).trim()
      ? String(c.entityDisplayName).trim()
      : null;
  const logoFromHub = typeof hub?.logoUrl === "string" && hub.logoUrl.trim() ? hub.logoUrl.trim() : null;
  const logoFromRow =
    typeof c.businessLogoDataUrl === "string" && String(c.businessLogoDataUrl).trim()
      ? String(c.businessLogoDataUrl).trim()
      : null;

  let hubServices: string[] = [];
  if (typeof hub?.servicesJson === "string" && hub.servicesJson.trim()) {
    try {
      const parsedJ = JSON.parse(hub.servicesJson) as unknown;
      if (Array.isArray(parsedJ)) {
        hubServices = parsedJ.map((x) => String(x ?? "").trim()).filter(Boolean);
      }
    } catch {
      hubServices = [];
    }
  }
  const crmServices = parseRequestedServicesJson(c.requestedServicesJson as string | null | undefined);
  const requestedServices = mergeRequestedServicesLists(crmServices, hubServices);

  return NextResponse.json({
    ok: true,
    logoUrl: logoFromHub || logoFromRow,
    existingEntityName: nameFromHub || nameFromRow,
    requestedServices,
  });
}

