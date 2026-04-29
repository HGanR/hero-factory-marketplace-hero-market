/**
 * Platform API v1 - Workflow by ID
 * GET /api/v1/workflows/:id
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { workflowAutomations } from "@/lib/db/schema";
import { getPlatformApiContext } from "@/lib/platform-api/auth";
import { hasScope } from "@/lib/platform-api/scopes";
import { unauthorized, forbidden, notFound } from "@/lib/platform-api/errors";
import { serializeWorkflow } from "@/lib/platform-api/serializers";
import { recordApiKeyUsage } from "@/lib/platform-api/audit";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const apiCtx = await getPlatformApiContext(req);
  if (!apiCtx) return unauthorized();
  if (!hasScope(apiCtx.scopes, "read:workflows")) return forbidden();

  if (apiCtx.authType === "api_key" && apiCtx.apiKeyId) {
    recordApiKeyUsage(apiCtx.apiKeyId);
  }

  const { id } = await ctx.params;
  const db = await getDb();
  const [row] = await db
    .select()
    .from(workflowAutomations)
    .where(
      and(
        eq(workflowAutomations.id, id),
        eq(workflowAutomations.userId, apiCtx.userId)
      )
    )
    .limit(1);

  if (!row) return notFound("Workflow not found");

  return NextResponse.json({ data: serializeWorkflow(row as unknown as Record<string, unknown>) });
}
