import { NextRequest, NextResponse } from "next/server";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { listPendingSkipperLearningItemsForAdmin } from "@/lib/executive-agent/skipper-learning-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = (await getDb()) as MySql2Database<typeof schema>;
    const pending = await listPendingSkipperLearningItemsForAdmin(db, adminUserId);
    return NextResponse.json(pending);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "LEARNING_PENDING_FAILED", message: msg }, { status: 500 });
  }
}
