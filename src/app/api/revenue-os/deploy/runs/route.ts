import { NextRequest, NextResponse } from "next/server";
import { desc, eq, and } from "drizzle-orm";
import { z } from "zod";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { getDb } from "@/lib/db";
import { ensureRevenueOsLiveModuleTables } from "@/lib/db/revenue-os-live-modules-ensure";
import {
  revenueOsFunnelDeploymentRuns,
  revenueOsSequenceExecutionRuns,
} from "@/lib/db/schema";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const QuerySchema = z.object({
  userId: z.string().min(1),
  clientId: z.string().optional(),
  trustId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(30),
});

/**
 * GET /api/revenue-os/deploy/runs?userId=&clientId=
 * Recent funnel deployment runs and sequence execution runs for the workspace.
 */
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/deploy/runs", req);
    const url = new URL(req.url);
    const parsed = QuerySchema.parse({
      userId: url.searchParams.get("userId") ?? "",
      clientId: url.searchParams.get("clientId") ?? undefined,
      trustId: url.searchParams.get("trustId") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    await ensureRevenueOsLiveModuleTables();
    const db = await getDb();
    const clientId = parsed.clientId?.trim() ?? "";
    const trustId = parsed.trustId?.trim() ?? "";

    const base = and(
      eq(revenueOsFunnelDeploymentRuns.userId, parsed.userId),
      eq(revenueOsFunnelDeploymentRuns.clientId, clientId),
      eq(revenueOsFunnelDeploymentRuns.trustId, trustId)
    );
    const baseSeq = and(
      eq(revenueOsSequenceExecutionRuns.userId, parsed.userId),
      eq(revenueOsSequenceExecutionRuns.clientId, clientId),
      eq(revenueOsSequenceExecutionRuns.trustId, trustId)
    );

    const funnelRuns = await db
      .select()
      .from(revenueOsFunnelDeploymentRuns)
      .where(base)
      .orderBy(desc(revenueOsFunnelDeploymentRuns.startedAt))
      .limit(parsed.limit);

    const sequenceRuns = await db
      .select()
      .from(revenueOsSequenceExecutionRuns)
      .where(baseSeq)
      .orderBy(desc(revenueOsSequenceExecutionRuns.startedAt))
      .limit(parsed.limit);

    return NextResponse.json({
      funnelRuns,
      sequenceRuns,
      integrationNote:
        "Outbound providers (SendGrid/Twilio) are not connected; sequence runs are dry-run or mock only.",
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query", details: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[revenue-os/deploy/runs]", e);
    return NextResponse.json({ error: "Failed to list runs" }, { status: 500 });
  }
}
