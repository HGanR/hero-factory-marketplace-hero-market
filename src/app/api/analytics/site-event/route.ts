import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { insertSiteAnalyticsEvent } from "@/lib/analytics/site-analytics-store";
import { buildSiteAnalyticsInsertPayload, parseSiteEventBody } from "@/lib/analytics/site-event-ingest";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = parseSiteEventBody(json);
    if (!parsed.ok) {
      return NextResponse.json({ error: "INVALID_REQUEST", issues: parsed.error.flatten() }, { status: 400 });
    }
    const body = parsed.body;
    const marketplaceUserId = await getAuthedUserId();
    const metadata =
      marketplaceUserId != null
        ? { ...(body.metadata ?? {}), marketplaceUserId: String(marketplaceUserId) }
        : body.metadata ?? null;
    const db = await getDb();
    await insertSiteAnalyticsEvent(
      db,
      buildSiteAnalyticsInsertPayload({ ...body, metadata }, randomUUID()),
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "INGEST_FAILED", message: msg }, { status: 500 });
  }
}
