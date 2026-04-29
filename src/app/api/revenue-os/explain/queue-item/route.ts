import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { getDistributionQueueItemForUser, fetchDistributionQueueTargetsForQueue } from "@/lib/revenue-os/distribution-queue-actions";
import type { RoutedTargetPlan } from "@/lib/revenue-os/distribution-routing";
import { explainBentleyQueueAction } from "@/lib/revenue-os/explainability-engine";
import { buildExplanationCardPayload } from "@/lib/revenue-os/explainability-ui";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/explain/queue-item", req);
    const sp = req.nextUrl.searchParams;
    const queueId = sp.get("queueId")?.trim() || "";
    const clientId = sp.get("clientId")?.trim() || "";
    const trustId = sp.get("trustId")?.trim() || "";
    const generatedAt = new Date().toISOString();

    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ signedOut: true, explanation: null, ui: null, generatedAt });
    }
    const uid = String(userId);

    if (!queueId || !clientId || !trustId) {
      return NextResponse.json({ error: "queueId, clientId, and trustId required" }, { status: 400 });
    }

    const queue = await getDistributionQueueItemForUser({ userId: uid, clientId, trustId, queueId });
    if (!queue) {
      return NextResponse.json({ error: "not_found", generatedAt }, { status: 404 });
    }

    const targets = await fetchDistributionQueueTargetsForQueue({ userId: uid, clientId, trustId, queueId });
    const routedTargets: RoutedTargetPlan[] = targets.map((t) => ({
      targetId: t.id,
      queueId: t.queueId,
      targetPlatform: t.targetPlatform,
      targetFormat: t.targetFormat,
      selectedProfileId: t.targetProfileId,
      routingStatus: (t.routingStatus ?? "ready") as RoutedTargetPlan["routingStatus"],
      payloadJson: (typeof t.payloadJson === "object" && t.payloadJson ? t.payloadJson : {}) as Record<string, unknown>,
      routingWarnings: Array.isArray(t.routingWarningsJson) ? (t.routingWarningsJson as string[]) : [],
    }));

    const explanation = explainBentleyQueueAction({ queue, routedTargets });
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
