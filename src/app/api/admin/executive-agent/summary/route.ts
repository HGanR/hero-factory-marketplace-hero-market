import { NextRequest } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { handleExecutiveAgentSummaryGet } from "@/app/api/admin/executive-agent/summary/summary-route-handler";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handleExecutiveAgentSummaryGet(req, {
    getExecutiveAdminUserId,
    getDb,
  });
}
