import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { insertAuditLog } from "@/lib/audit";
import { ensureClientFileColumns, ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { createClientAccount } from "@/lib/revenue-os/client-hub-queries";
import { validateCreateClientPayload } from "@/lib/clients/clients-create-payload";

function isUnknownColumnError(e: unknown): boolean {
  const m = String((e as { message?: string; code?: string; errno?: number })?.message ?? e ?? "");
  if (/1054|ER_BAD_FIELD_ERROR|Unknown column/i.test(m)) return true;
  if ((e as { errno?: number })?.errno === 1054) return true;
  return false;
}

/** Structured diagnostics — no names, emails, addresses, or logo payloads. */
function logClientCreateStage(
  stage: "received" | "auth_ok" | "validation_ok" | "insert_ok" | "validation_fail" | "insert_fail" | "unauthorized",
  fields: Record<string, string | number | boolean | null | undefined>,
) {
  const line = JSON.stringify({ event: "client_create", stage, ...fields });
  if (stage === "validation_fail" || stage === "insert_fail" || stage === "unauthorized") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export async function POST(request: NextRequest) {
  const reqId = crypto.randomUUID().slice(0, 8);
  try {
    let rawJson: unknown;
    try {
      rawJson = await request.json();
    } catch {
      logClientCreateStage("validation_fail", { reqId, reason: "invalid_json" });
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const topKeys =
      rawJson && typeof rawJson === "object" && !Array.isArray(rawJson)
        ? Object.keys(rawJson as object).join(",")
        : typeof rawJson;
    logClientCreateStage("received", { reqId, payloadKeys: topKeys });

    const userId = await getAuthedUserId();
    if (!userId) {
      logClientCreateStage("unauthorized", { reqId });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logClientCreateStage("auth_ok", { reqId, userId });

    const validated = validateCreateClientPayload(rawJson);
    if (!validated.ok) {
      logClientCreateStage("validation_fail", {
        reqId,
        userId,
        status: validated.status,
        errorCode: "validation",
      });
      return NextResponse.json({ error: validated.error }, { status: validated.status });
    }
    const body = validated.value;
    const requestedServicesList = body.requested_services ?? [];
    logClientCreateStage("validation_ok", {
      reqId,
      userId,
      payloadKeys: topKeys,
      hasEntity: Boolean((body.entity_name ?? "").trim()),
      hasLogo: body.logoDataUrlTrimmed.length > 0,
      hasRequestedServices: requestedServicesList.length > 0,
      country: body.countryCode,
    });

    const db = await getDb();

    const [dup] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.userId, userId), eq(clients.email, body.email)))
      .limit(1);
    if (dup?.id) {
      logClientCreateStage("validation_fail", {
        reqId,
        userId,
        status: 409,
        errorCode: "duplicate_email",
      });
      return NextResponse.json(
        {
          error: "A client with this email already exists for your account.",
          clientId: String(dup.id),
        },
        { status: 409 },
      );
    }

    const clientId = crypto.randomUUID();

    const entityName = (body.entity_name ?? "").trim();
    const logoIn = body.logoDataUrlTrimmed;

    await ensureClientFileColumns();

    const requestedServicesJson = JSON.stringify(requestedServicesList);
    const fullRow = {
      id: clientId,
      userId,
      firstName: body.first_name,
      middleName: body.middle_name ?? null,
      lastName: body.last_name,
      suffix: body.suffix ?? null,
      dateOfBirth: body.date_of_birth ? (body.date_of_birth as any) : null,
      email: body.email,
      phone: body.phone ?? null,
      addressLine1: body.address.line1,
      addressLine2: body.address.line2 ?? null,
      city: body.address.city,
      state: body.address.state,
      postalCode: body.address.postal_code,
      country: body.countryCode,
      clientType: "individual" as const,
      status: "active" as const,
      entityDisplayName: entityName || null,
      businessLogoDataUrl: logoIn || null,
      requestedServicesJson,
    };

    await db.transaction(async (tx) => {
      try {
        await tx.insert(clients).values(fullRow as any);
      } catch (e) {
        if (!isUnknownColumnError(e)) throw e;
        const {
          entityDisplayName: _en,
          businessLogoDataUrl: _logo,
          requestedServicesJson: _rsj,
          ...core
        } = fullRow;
        await tx.insert(clients).values(core as any);
      }

      await insertAuditLog(tx as any, {
        actorUserId: userId,
        action: "client_created",
        entityType: "client",
        entityId: clientId,
        metadata: null,
      });
    });

    logClientCreateStage("insert_ok", { reqId, userId, clientId });

    const wantHub =
      Boolean(entityName) || Boolean(logoIn) || requestedServicesList.length > 0;
    let clientHubId: string | null = null;
    if (wantHub) {
      try {
        await ensureClientHubTables();
        const displayName = entityName || `${body.first_name} ${body.last_name}`.trim() || "Client";
        const hub = await createClientAccount(userId, {
          name: displayName,
          logoUrl: logoIn || null,
          notes: `CRM_REF:${clientId}\nOnboarding contact: ${body.first_name} ${body.last_name} (${clientId})`,
          requestedServices: requestedServicesList.length ? requestedServicesList : null,
        });
        clientHubId = hub.id;
      } catch (e) {
        console.warn("[api/clients] client_accounts create skipped or failed", e);
      }
    }

    return NextResponse.json({
      clientId,
      status: "created",
      requestedServices: requestedServicesList,
      ...(clientHubId ? { clientHubId } : {}),
    });
  } catch (e) {
    const errno = (e as { errno?: number })?.errno;
    const code = (e as { code?: string })?.code;
    logClientCreateStage("insert_fail", {
      reqId,
      errno: errno ?? undefined,
      sqlState: code ?? undefined,
      errorCode: "exception",
    });
    console.error("[api/clients] POST", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Create client failed" },
      { status: 500 },
    );
  }
}



