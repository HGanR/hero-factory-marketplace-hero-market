import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import {
  AdminManualPaymentConfirmBodySchema,
  confirmPaymentManuallyForAdmin,
  listPaymentConfirmationsForAdmin,
} from "@/lib/fulfillment/payment-confirmation-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/executive-agent/payment-confirmations
 * List manual payment confirmations for CRM clients owned by this admin.
 */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = req.nextUrl.searchParams.get("clientId");
  const statusRaw = req.nextUrl.searchParams.get("status");
  const status =
    statusRaw === "pending" || statusRaw === "confirmed" || statusRaw === "failed"
      ? statusRaw
      : undefined;
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 50;

  const db = await getDb();
  const result = await listPaymentConfirmationsForAdmin(db, {
    adminUserId,
    clientId,
    status: status ?? null,
    limit: Number.isFinite(limit) ? limit : 50,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    confirmations: result.rows.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      marketplaceUserId: r.marketplaceUserId,
      provider: r.provider,
      externalRef: r.externalRef,
      amountCents: r.amountCents,
      currency: r.currency,
      status: r.status,
      confirmedAt: r.confirmedAt?.toISOString() ?? null,
      consumedAt: r.consumedAt?.toISOString() ?? null,
      consumedByOrderId: r.consumedByOrderId,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

/**
 * POST /api/admin/executive-agent/payment-confirmations
 * Manual "Confirm Payment" after owner reviews PayPal (no webhook / no PayPal API).
 */
export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = AdminManualPaymentConfirmBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const db = await getDb();
  const result = await confirmPaymentManuallyForAdmin(db, {
    adminUserId,
    body: parsed.data,
  });

  if (!result.ok) {
    const status = result.message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: result.message }, { status });
  }

  const c = result.confirmation;
  return NextResponse.json({
    ok: true,
    confirmation: {
      id: c.id,
      clientId: c.clientId,
      provider: c.provider,
      externalRef: c.externalRef,
      amountCents: c.amountCents,
      currency: c.currency,
      status: c.status,
      confirmedAt: c.confirmedAt?.toISOString() ?? null,
      message:
        "Payment confirmed manually. Claude may submit fulfillment handoff using this confirmationId.",
    },
  });
}
