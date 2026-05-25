import { NextRequest, NextResponse } from "next/server";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { ExecutiveChatBodySchema } from "@/lib/executive-agent/executive-agent-chat-request";
import { runExecutiveOrchestrator } from "@/lib/executive-agent/executive-agent-orchestrator";
import { insertExecutiveQuestionHistory } from "@/lib/executive-agent/executive-question-history-store";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const json = await req.json();
    const body = ExecutiveChatBodySchema.parse(json);
    const db = await getDb();
    const result = await runExecutiveOrchestrator(db, {
      adminUserId,
      prompt: body.prompt,
      mode: body.mode,
      selectedClientId: body.selectedClientId ?? null,
      selectedCampaignId: body.selectedCampaignId ?? null,
      requestedTool: body.requestedTool ?? null,
      dryRun: body.dryRun,
      selectedAgents: body.selectedAgents ?? null,
      selectedTimeRange: body.selectedTimeRange ?? null,
      dashboardMode: body.dashboardMode ?? null,
      source: "chat",
    });
    try {
      await insertExecutiveQuestionHistory(db, {
        adminUserId,
        source: "chat",
        question: body.prompt,
        answer: result.answer,
        selectedAgents: body.selectedAgents ?? null,
        selectedTimeRange: body.selectedTimeRange ?? null,
        dashboardMode: body.dashboardMode ?? null,
        plannerMeta: result.plannerMeta,
      });
    } catch {
      /* non-fatal */
    }
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "INVALID_REQUEST", issues: e.flatten() }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "ORCHESTRATOR_FAILED", message: msg }, { status: 500 });
  }
}
