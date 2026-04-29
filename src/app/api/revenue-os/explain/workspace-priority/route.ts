import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { buildBentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import { prioritizeBentleyWorkspaces } from "@/lib/revenue-os/workspace-prioritization";
import { explainWorkspacePriority } from "@/lib/revenue-os/explainability-engine";
import { buildExplanationCardPayload } from "@/lib/revenue-os/explainability-ui";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/explain/workspace-priority", req);
    const sp = req.nextUrl.searchParams;
    const clientId = sp.get("clientId")?.trim() || "";
    const trustId = sp.get("trustId")?.trim() || "";
    const generatedAt = new Date().toISOString();

    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ signedOut: true, explanation: null, ui: null, generatedAt });
    }
    const uid = String(userId);

    const overview = await buildBentleyOperatorOverview({
      userId: uid,
      clientIds: clientId ? [clientId] : undefined,
      trustIds: trustId ? [trustId] : undefined,
    });
    const p = prioritizeBentleyWorkspaces({ workspaceSummaries: overview.workspaceSummaries });
    const match =
      clientId && trustId
        ? p.rankedWorkspaces.find((r) => r.workspace.clientId === clientId && r.workspace.trustId === trustId)
        : p.rankedWorkspaces[0] ?? null;

    if (!match) {
      const empty = explainBentleyDecision({
        subject: "Workspace priority",
        summary: "No workspace summaries in scope — add distribution or lead activity.",
        recommendedHumanReview: true,
      });
      return NextResponse.json({ signedOut: false, explanation: empty, ui: buildExplanationCardPayload(empty), generatedAt });
    }

    const explanation = explainWorkspacePriority({ row: match });
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
