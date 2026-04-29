import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensureCrmTables } from "@/lib/db/crm-ensure";
import { runWebchatRetentionCleanup } from "@/lib/widget/retention-cleanup";

/** Manual trigger for webchat retention cleanup. Auth required, or CRON_SECRET header for scheduled runs. */
export async function POST(req: NextRequest) {
  try {
    const cronSecret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const envSecret = process.env.CRON_SECRET;
    const isCron = envSecret && cronSecret === envSecret;

    if (!isCron) {
      requireUserId(req);
    }

    const db = await getDb();
    await ensureCrmTables();

    const result = await runWebchatRetentionCleanup(db);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") return NextResponse.json({ error: msg }, { status: 401 });
    console.error("retention-cleanup POST error:", err);
    return NextResponse.json({ error: "Failed to run cleanup" }, { status: 500 });
  }
}
