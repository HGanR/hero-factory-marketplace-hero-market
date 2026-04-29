import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  leadAnalysisRuns,
  leadRecords,
  leadUploads,
} from "@/lib/db/schema.bentley-social-leads";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: uploadId } = await params;
  const db = await getDb();

  const [up] = await db
    .select()
    .from(leadUploads)
    .where(and(eq(leadUploads.id, uploadId), eq(leadUploads.userId, userId)))
    .limit(1);

  if (!up) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const records = await db
    .select({
      id: leadRecords.id,
      businessName: leadRecords.businessName,
      platform: leadRecords.platform,
      handle: leadRecords.handle,
      profileUrl: leadRecords.profileUrl,
      email: leadRecords.email,
      websiteUrl: leadRecords.websiteUrl,
      notes: leadRecords.notes,
      createdAt: leadRecords.createdAt,
    })
    .from(leadRecords)
    .where(and(eq(leadRecords.uploadId, uploadId), eq(leadRecords.userId, userId)));

  const runs = await db
    .select()
    .from(leadAnalysisRuns)
    .where(and(eq(leadAnalysisRuns.uploadId, uploadId), eq(leadAnalysisRuns.userId, userId)))
    .orderBy(desc(leadAnalysisRuns.createdAt))
    .limit(20);

  return NextResponse.json({ upload: up, records, runs });
}
