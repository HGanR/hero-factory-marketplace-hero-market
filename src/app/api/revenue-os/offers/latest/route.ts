import { NextRequest, NextResponse } from "next/server";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { ensureRevenueOsLiveModuleTables } from "@/lib/db/revenue-os-live-modules-ensure";
import { offerPackages, offerVersions } from "@/lib/db/schema";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const QuerySchema = z.object({
  userId: z.string().min(1),
  clientId: z.string().optional(),
  trustId: z.string().optional(),
});

/**
 * GET /api/revenue-os/offers/latest?userId=&clientId=&trustId=
 * Read-only: latest offer version + provenance fields from raw_payload (for dashboard UI).
 */
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/offers/latest", req);
    const url = new URL(req.url);
    const parsed = QuerySchema.parse({
      userId: url.searchParams.get("userId") ?? "",
      clientId: url.searchParams.get("clientId") ?? undefined,
      trustId: url.searchParams.get("trustId") ?? undefined,
    });

    await ensureRevenueOsLiveModuleTables();
    const db = await getDb();
    const clientId = parsed.clientId?.trim() ?? "";
    const trustId = parsed.trustId?.trim() ?? "";

    const pkgRows = await db
      .select()
      .from(offerPackages)
      .where(
        and(
          eq(offerPackages.userId, parsed.userId),
          eq(offerPackages.clientId, clientId),
          eq(offerPackages.trustId, trustId)
        )
      )
      .orderBy(desc(offerPackages.updatedAt))
      .limit(1);

    if (pkgRows.length === 0) {
      return NextResponse.json({ packageId: null, latest: null });
    }

    const packageId = pkgRows[0]!.id;
    const verRows = await db
      .select()
      .from(offerVersions)
      .where(eq(offerVersions.packageId, packageId))
      .orderBy(desc(offerVersions.version))
      .limit(1);

    if (verRows.length === 0) {
      return NextResponse.json({ packageId, latest: null });
    }

    const v = verRows[0]!;
    const raw =
      v.rawPayload && typeof v.rawPayload === "object"
        ? (v.rawPayload as Record<string, unknown>)
        : {};

    const crossModuleAudit = raw.crossModuleAudit;
    const marketIntelligenceHints = raw.marketIntelligenceHints;
    const marketScanMergeSkipped =
      typeof raw.marketScanMergeSkipped === "string"
        ? raw.marketScanMergeSkipped
        : null;

    return NextResponse.json({
      packageId,
      latest: {
        id: v.id,
        version: v.version,
        createdAt: v.createdAt,
        provenance: {
          crossModuleAudit,
          marketIntelligenceHints: marketIntelligenceHints ?? null,
          marketScanMergeSkipped,
        },
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query", details: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[revenue-os/offers/latest]", e);
    return NextResponse.json({ error: "Failed to load offer" }, { status: 500 });
  }
}
