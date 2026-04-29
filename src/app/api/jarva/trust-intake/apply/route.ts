import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { trusts } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { listPopulatedJarvaIntakeFieldKeys, parseJarvaTrustIntake, TRUST_INTAKE_SCHEMA_VERSION } from "@/lib/jarva/trust-intake-schema";
import { appendJarvaLineage, defaultMappedHintsFromFieldKeys } from "@/lib/jarva/jarva-lineage";
import { loadLatestJarvaIntakePayload, saveJarvaIntakeDraft } from "@/lib/jarva/persist-jarva-intake-draft";
import { runJarvaTrustApply } from "@/lib/jarva/run-jarva-apply";

const BodySchema = z.object({
  trustId: z.string().min(10).max(64),
  intake: z.unknown(),
  force: z.boolean().optional(),
  /** Default true: also merge Trust Records store draft */
  syncTrustRecords: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsedBody = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid body", details: parsedBody.error.flatten() }, { status: 400 });
  }
  const { trustId, force, syncTrustRecords } = parsedBody.data;

  const intakeParsed = parseJarvaTrustIntake({
    ...(typeof parsedBody.data.intake === "object" && parsedBody.data.intake !== null ? parsedBody.data.intake : {}),
    schemaVersion: TRUST_INTAKE_SCHEMA_VERSION,
    collectedByUserId: userId,
    collectedAt: new Date().toISOString(),
  });
  if (!intakeParsed.ok) return NextResponse.json({ error: intakeParsed.error }, { status: 400 });

  const db = await getDb();
  const trustRows = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  try {
    const result = await runJarvaTrustApply({
      db,
      userId,
      trustId,
      intake: intakeParsed.data,
      force,
      syncTrustRecords: syncTrustRecords !== false,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: "READINESS_BLOCKED",
          readiness: result.readiness,
          message: "Complete required intake fields or pass force=true to override (not recommended).",
        },
        { status: 409 }
      );
    }

    try {
      const { payload: prevPayload } = await loadLatestJarvaIntakePayload(db, trustId);
      const fieldKeys = listPopulatedJarvaIntakeFieldKeys(intakeParsed.data);
      const lineage = appendJarvaLineage(prevPayload?.lineage, {
        at: new Date().toISOString(),
        messageSnippet: "(manual apply — Jarva UI or chat)",
        extractedFieldKeys: fieldKeys,
        targets: ["jarva_intake", "smart_trust_draft", "trust_records_state"],
        applyKind: "manual_apply",
        actorUserId: userId,
        mappedDestinationHints: ["smart_trust_draft", "trust_records_state", ...defaultMappedHintsFromFieldKeys(fieldKeys)],
        note: "Jarva apply merged intake into Smart Trust draft and Trust Records store (drafts for review).",
      });
      await saveJarvaIntakeDraft({
        db,
        userId,
        trustId,
        trustRow: trustRows[0]!,
        intake: intakeParsed.data,
        lineage,
        auditAction: "jarva_manual_apply_lineage",
      });
    } catch {
      // Non-fatal — workspace apply already succeeded
    }

    return NextResponse.json({
      ok: true,
      trustId,
      readiness: result.readiness,
      version: result.smartTrustVersion,
      draftId: result.smartDraftId,
      trustRecordsVersion: result.trustRecordsVersion,
      trustRecordsSynced: result.trustRecordsSynced,
      workspaceSummary: result.workspaceSummary,
      message:
        "Draft workspace updated from Jarva intake. Trust Records store merged when enabled. Review Smart Trust and Trust Records; export remains subject to existing gates and counsel workflow.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Apply failed";
    if (msg === "Payload too large") return NextResponse.json({ error: msg }, { status: 413 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
