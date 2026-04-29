import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { ensureSiteBuilderIntelligenceTables } from "@/lib/site-builder/db";
import { updateRunVariantSelection } from "@/lib/site-builder/intelligence/repository";

const BodySchema = z.object({
  runId: z.string().uuid(),
  selectedIndex: z.number().int().min(0).max(2),
  rejectedIndices: z.array(z.number().int().min(0).max(2)).max(3).default([]),
});

/**
 * Record which variant the user selected vs rejected (structural; updates intelligence tables).
 * Call after a `full` pipeline with `intelligenceRunId` when the user picks an alternate.
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
  if (parsed.data.rejectedIndices.includes(parsed.data.selectedIndex)) {
    return NextResponse.json({ error: "selectedIndex must not be in rejectedIndices" }, { status: 400 });
  }

  try {
    const db = await getDb();
    await ensureSiteBuilderIntelligenceTables(db);
    await updateRunVariantSelection(db, {
      runId: parsed.data.runId,
      userId,
      selectedIndex: parsed.data.selectedIndex,
      rejectedIndices: parsed.data.rejectedIndices,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
