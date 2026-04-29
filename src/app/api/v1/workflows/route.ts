/**
 * Platform API v1 - Workflows
 * GET /api/v1/workflows - List workflow automations
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { workflowAutomations } from "@/lib/db/schema";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden } from "@/lib/platform-api/errors";
import { serializeWorkflow } from "@/lib/platform-api/serializers";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";

export async function GET(req: NextRequest) {
  const apiCtx = await getPlatformApiContext(req);
  if (!apiCtx) return unauthorized();
  if (!hasScope(apiCtx.scopes, "read:workflows")) return forbidden();

  if (apiCtx.authType === "api_key" && apiCtx.apiKeyId) {
    recordApiKeyUsage(apiCtx.apiKeyId);
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(workflowAutomations)
    .where(eq(workflowAutomations.userId, apiCtx.userId))
    .limit(100);

  return NextResponse.json({
    data: rows.map((r) => serializeWorkflow(r as unknown as Record<string, unknown>)),
    meta: { count: rows.length },
  });
}
