import { NextRequest, NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { buildBentleyExecutiveReport, type ExecutiveReportMode } from "@/lib/revenue-os/executive-report";
import { buildBentleyOperatorOverview } from "@/lib/revenue-os/operator-intelligence";
import { detectBentleyExceptions } from "@/lib/revenue-os/exception-detection";
import { runBentleyNotificationEngine } from "@/lib/revenue-os/notification-engine";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/operator/report", req);
    const userId = await getAuthedUserId();
    if (userId == null) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const sp = req.nextUrl.searchParams;
    const modeRaw = sp.get("mode")?.trim() || "daily_operator_report";
    const mode: ExecutiveReportMode =
      modeRaw === "weekly_executive_report" ? "weekly_executive_report" : "daily_operator_report";
    const clientId = sp.get("clientId")?.trim() || undefined;
    const trustId = sp.get("trustId")?.trim() || undefined;
    const uid = String(userId);

    const overview = await buildBentleyOperatorOverview({
      userId: uid,
      clientIds: clientId ? [clientId] : undefined,
      trustIds: trustId ? [trustId] : undefined,
    });
    const exceptions = detectBentleyExceptions({ overview });
    const report = await buildBentleyExecutiveReport({
      userId: uid,
      mode,
      clientId,
      trustId,
      overview,
    });

    const emit = sp.get("emitNotifications") === "true" || sp.get("emitNotifications") === "1";
    let notificationEngineRun = null;
    if (emit) {
      notificationEngineRun = await runBentleyNotificationEngine({
        userId: uid,
        clientId,
        trustId,
        reportHints:
          mode === "weekly_executive_report"
            ? { weeklyExecutiveReportReady: true, dailyOperatorReportReady: false }
            : { dailyOperatorReportReady: true, weeklyExecutiveReportReady: false },
        dryRun: false,
        skipIfQuiet: false,
      });
    }

    return NextResponse.json({
      ok: true,
      report,
      exceptions,
      generatedAt: overview.generatedAt,
      notificationEngineRun,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
