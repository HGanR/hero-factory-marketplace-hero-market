import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { ensureSiteBuilderIntelligenceTables } from "@/lib/site-builder/db";
import { recordSiteVariantFeedback } from "@/lib/site-builder/intelligence/repository";

const BodySchema = z.object({
  runId: z.string().uuid().nullish(),
  variantId: z.string().uuid().nullish(),
  feedbackType: z.string().min(1).max(32),
  rating: z.number().int().min(1).max(5).nullish(),
  /** Short optional note (not CRM conversation content). */
  noteSummary: z.string().max(500).nullish(),
});

/**
 * Store lightweight variant feedback (ratings, approve/reject type). No private CRM text.
 */
export async function POST(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const db = await getDb();
    await ensureSiteBuilderIntelligenceTables(db);
    const id = await recordSiteVariantFeedback(db, {
      userId,
      runId: parsed.data.runId ?? null,
      variantId: parsed.data.variantId ?? null,
      feedbackType: parsed.data.feedbackType,
      rating: parsed.data.rating ?? null,
      noteSummary: parsed.data.noteSummary ?? null,
    });
    return NextResponse.json({ id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Record failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
