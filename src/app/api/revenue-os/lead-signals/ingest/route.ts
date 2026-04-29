import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { extractLeadSignalsFromFeedback } from "@/lib/revenue-os/lead-signal-extractor";
import { insertLeadSignals } from "@/lib/revenue-os/persist-lead-signals";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/lead-signals/ingest", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
    const trustId = typeof body.trustId === "string" ? body.trustId.trim() : "";

    const contentFeedbackRows = Array.isArray(body.contentFeedbackRows)
      ? (body.contentFeedbackRows as Record<string, unknown>[])
      : undefined;
    const experimentResultNotes = Array.isArray(body.experimentResultNotes)
      ? body.experimentResultNotes.map((x) => String(x))
      : undefined;
    const rawInteractions = Array.isArray(body.rawInteractions)
      ? (body.rawInteractions as Record<string, unknown>[])
      : undefined;

    const extracted = extractLeadSignalsFromFeedback({
      contentFeedbackRows,
      experimentResultNotes,
      rawInteractions,
    });

    const persisted = await insertLeadSignals({
      userId: String(userId),
      clientId,
      trustId,
      signals: extracted,
    });

    const totalSignals = extracted.length;
    const handoffReadyCount = extracted.filter((s) => s.handoffReadiness >= 0.62).length;
    const objectionCount = extracted.filter((s) => s.signalClass === "objection").length;
    const highIntentCount = extracted.filter((s) => s.commercialIntentScore >= 0.65).length;

    return NextResponse.json({
      ok: true,
      persistedIds: persisted?.ids ?? [],
      summary: {
        totalSignals,
        handoffReadyCount,
        objectionCount,
        highIntentCount,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ingest failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
