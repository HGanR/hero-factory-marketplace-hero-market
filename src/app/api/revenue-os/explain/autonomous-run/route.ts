import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { getAutonomousRunByIdForUser } from "@/lib/revenue-os/autonomous-policies-db";
import { explainBentleyDecision } from "@/lib/revenue-os/explainability-engine";
import { buildExplanationCardPayload } from "@/lib/revenue-os/explainability-ui";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/explain/autonomous-run", req);
    const runId = req.nextUrl.searchParams.get("runId")?.trim() || "";
    const generatedAt = new Date().toISOString();

    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ signedOut: true, explanation: null, ui: null, generatedAt });
    }
    const uid = String(userId);

    if (!runId) {
      return NextResponse.json({ error: "runId required" }, { status: 400 });
    }

    const row = await getAutonomousRunByIdForUser({ userId: uid, runId });
    if (!row) {
      return NextResponse.json({ error: "not_found", generatedAt }, { status: 404 });
    }

    const ds = row.decisionSummaryJson && typeof row.decisionSummaryJson === "object" ? row.decisionSummaryJson : null;
    const explanation = explainBentleyDecision({
      subject: `Autonomous run ${runId.slice(0, 8)}…`,
      summary: `Run status ${row.runStatus}; action ${row.actionType}. ${JSON.stringify(ds ?? {}).slice(0, 600)}`,
      keyInputs: [
        { label: "runStatus", value: row.runStatus },
        { label: "actionType", value: row.actionType },
        { label: "executed", value: String(row.executedCount ?? 0) },
        { label: "skipped", value: String(row.skippedCount ?? 0) },
      ],
      confidenceNote: "Explanation uses persisted run summary JSON when present.",
      recommendedHumanReview: row.runStatus === "failed" || row.runStatus === "partial",
    });

    return NextResponse.json({
      signedOut: false,
      explanation,
      ui: buildExplanationCardPayload(explanation),
      generatedAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
