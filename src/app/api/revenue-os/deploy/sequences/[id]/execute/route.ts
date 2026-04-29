import { NextRequest, NextResponse } from "next/server";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { z } from "zod";
import { eq, and, asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureRevenueOsLiveModuleTables } from "@/lib/db/revenue-os-live-modules-ensure";
import {
  revenueOsMessageSequences,
  revenueOsSequenceExecutionRuns,
  revenueOsSequenceSteps,
} from "@/lib/db/schema";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * POST /api/revenue-os/deploy/sequences/:id/execute
 * Mock / dry-run execution — no SendGrid/Twilio. Persists `revenue_os_sequence_execution_runs`.
 */

const BodySchema = z.object({
  userId: z.string().min(1),
  dryRun: z.boolean().optional().default(true),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  const started = new Date();
  const { id: sequenceId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);

  try {
    if (!sequenceId) {
      return NextResponse.json({ error: "Missing sequence id" }, { status: 400 });
    }
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    logBentleyCorrelationEvent("revenue-os/deploy/sequences/execute", req, { sequenceId });

    await ensureRevenueOsLiveModuleTables();
    const db = await getDb();
    const seqRows = await db
      .select()
      .from(revenueOsMessageSequences)
      .where(
        and(
          eq(revenueOsMessageSequences.id, sequenceId),
          eq(revenueOsMessageSequences.userId, parsed.data.userId)
        )
      )
      .limit(1);

    if (seqRows.length === 0) {
      return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
    }

    const seq = seqRows[0]!;
    const steps = await db
      .select()
      .from(revenueOsSequenceSteps)
      .where(eq(revenueOsSequenceSteps.sequenceId, sequenceId))
      .orderBy(asc(revenueOsSequenceSteps.sortOrder));

    const dry = parsed.data.dryRun;
    const executed = steps.map((s) => ({
      stepId: s.id,
      dayOffset: s.dayOffset,
      channel: seq.channel,
      status: dry ? "dry_run_queued" : "mock_sent",
      subjectPreview: (s.subject ?? "").slice(0, 80),
    }));

    const mode = dry ? "dry_run" : "mock";
    const summaryMessage = dry
      ? "Dry run — no external provider calls. SendGrid/Twilio not configured."
      : "Mock execution — no real delivery; providers not connected.";

    const finished = new Date();
    const runId = crypto.randomUUID();
    await db.insert(revenueOsSequenceExecutionRuns).values({
      id: runId,
      sequenceId,
      userId: seq.userId,
      clientId: seq.clientId ?? "",
      trustId: seq.trustId ?? "",
      provider: "none",
      mode,
      status: "success",
      resultSummary: {
        steps: executed,
        stepCount: executed.length,
        message: summaryMessage,
        externalProvidersAvailable: false,
      },
      errorMessage: null,
      startedAt: started,
      finishedAt: finished,
    });

    return NextResponse.json({
      ok: true,
      runId,
      sequenceId,
      mode,
      provider: "none",
      externalProvidersAvailable: false,
      message: summaryMessage,
      steps: executed,
    });
  } catch (e) {
    console.error("[revenue-os/deploy/sequences/execute]", e);
    if (parsed.success && sequenceId) {
      try {
        await ensureRevenueOsLiveModuleTables();
        const db = await getDb();
        const runId = crypto.randomUUID();
        await db.insert(revenueOsSequenceExecutionRuns).values({
          id: runId,
          sequenceId,
          userId: parsed.data.userId,
          clientId: "",
          trustId: "",
          provider: "none",
          mode: "dry_run",
          status: "failed",
          resultSummary: null,
          errorMessage: e instanceof Error ? e.message : "Execution failed",
          startedAt: started,
          finishedAt: new Date(),
        });
      } catch {
        // ignore secondary failure
      }
    }
    return NextResponse.json({ error: "Execution failed" }, { status: 500 });
  }
}
