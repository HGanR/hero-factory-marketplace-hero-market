import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import {
  buildClientFulfillmentOperations,
  buildExecutiveFulfillmentOperationsOverview,
} from "@/lib/fulfillment/fulfillment-operations-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/executive-agent/fulfillment-operations/overview
 * GET /api/admin/executive-agent/fulfillment-operations/overview?clientId=...
 * Cross-department fulfillment orchestration — recommendations only, no autonomous execution.
 */
export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = req.nextUrl.searchParams.get("clientId")?.trim() ?? "";
  const db = await getDb();

  if (clientId) {
    const result = await buildClientFulfillmentOperations(db, { adminUserId, clientId });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, code: result.code, message: result.message },
        { status: result.code === "invalid_client_id" ? 400 : 404 }
      );
    }
    return NextResponse.json(result);
  }

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "40");
  const overview = await buildExecutiveFulfillmentOperationsOverview(db, {
    adminUserId,
    limit: Number.isFinite(limit) ? limit : 40,
  });
  return NextResponse.json(overview);
}
