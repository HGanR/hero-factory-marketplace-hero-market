import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetBroadcastSessions } from "@/lib/db/schema";
import { getBroadcastRenderSessionByToken } from "@/lib/meet/broadcast-render-sessions";
import { ensureBroadcastLiveSceneStateForSession } from "@/lib/meet/broadcast-live-scene-store";
import { isV2LiveSceneControlAvailable, mergeBaseRenderModelWithLiveScene } from "@/lib/meet/broadcast-live-scenes";
import { validateBroadcastCompositorRenderModel, type BroadcastCompositorRenderModel } from "@/lib/meet/broadcast-compositor";
import { ensureBroadcastOverlayStateForSession } from "@/lib/meet/broadcast-overlay-store";
import { mergeOverlaysIntoRenderModel } from "@/lib/meet/broadcast-overlays";
import {
  buildCountdownRenderPayload,
  buildScheduleSummaryForRenderSession,
  mergeCountdownIntoRenderModel,
} from "@/lib/meet/broadcast-schedule";
import { evaluateBroadcastScheduleForActiveSession } from "@/lib/meet/broadcast-scheduler";
import { evaluateBroadcastAutoDirectingForActiveSession, type SessionRow } from "@/lib/meet/broadcast-auto-directing-engine";
import {
  buildAutoDirectingPublicSummary,
  getBroadcastAutoDirectingState,
} from "@/lib/meet/broadcast-auto-directing-store";
import { buildBroadcastDirectingSignals, buildDirectingSignalsPublicSummary } from "@/lib/meet/broadcast-directing-signals";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/meet/broadcast/render-session/[id]?token=...
 * Public (token-gated) JSON for LiveKit egress template page. No cookies.
 *
 * Merges (1) frozen render model snapshot, (2) live scene when V2 active, (3) operator overlays on `model.overlays`,
 * (4) evaluated schedule + `model.countdown` when V2 active. Includes `scheduleState` summary for ops.
 * Includes `liveScene`, `liveSceneState` (alias), and `overlayState` summary. Polling failures after
 * the first successful load keep the last client-side model (see template client).
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { id: idRaw } = await ctx.params;
  const id = Number(idRaw);
  const token = req.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!Number.isFinite(id) || !token) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const row = await getBroadcastRenderSessionByToken(id, token);
  if (!row) {
    return NextResponse.json({ ok: false, error: "Expired or not found" }, { status: 404 });
  }

  const db = await getDb();
  const sessRows = await db
    .select()
    .from(meetBroadcastSessions)
    .where(eq(meetBroadcastSessions.id, row.broadcastSessionId))
    .limit(1);
  const broadcastSession = sessRows[0];

  const baseModel = row.renderModelJson;
  let responseModel: unknown = baseModel;
  let liveScene: { sceneType: string; layoutMode: string; updatedAt: string } | null = null;
  let overlayState: {
    lowerThirdVisible: boolean;
    tickerVisible: boolean;
    ctaBannerVisible: boolean;
    updatedAt: string;
  } | null = null;
  let scheduleState: ReturnType<typeof buildScheduleSummaryForRenderSession> | null = null;
  let directingSignals: ReturnType<typeof buildDirectingSignalsPublicSummary> | null = null;
  let autoDirecting: ReturnType<typeof buildAutoDirectingPublicSummary> | null = null;

  if (broadcastSession && isV2LiveSceneControlAvailable(broadcastSession)) {
    const nowIso = new Date().toISOString();
    const { schedule } = await evaluateBroadcastScheduleForActiveSession(broadcastSession, nowIso);
    scheduleState = buildScheduleSummaryForRenderSession(schedule, nowIso);
    await evaluateBroadcastAutoDirectingForActiveSession(broadcastSession as SessionRow, nowIso);
    const adState = await getBroadcastAutoDirectingState(broadcastSession.id);
    autoDirecting = buildAutoDirectingPublicSummary(adState ?? null, nowIso);

    const live = await ensureBroadcastLiveSceneStateForSession(broadcastSession);
    const merged = mergeBaseRenderModelWithLiveScene(baseModel, live);
    let core: BroadcastCompositorRenderModel | null = merged.ok ? merged.model : null;
    if (!core) {
      const vb = validateBroadcastCompositorRenderModel(baseModel);
      core = vb.ok ? vb.model : null;
    }

    if (core) {
      directingSignals = buildDirectingSignalsPublicSummary(buildBroadcastDirectingSignals({ renderModel: core }));
      const overlayEff = await ensureBroadcastOverlayStateForSession(broadcastSession);
      let merged = mergeOverlaysIntoRenderModel(core, overlayEff, live);
      const cd = buildCountdownRenderPayload(schedule.countdown, nowIso, merged.branding?.accentHex);
      responseModel = mergeCountdownIntoRenderModel(merged, cd);
      liveScene = {
        sceneType: live.sceneType,
        layoutMode: live.layoutMode,
        updatedAt: live.updatedAt,
      };
      overlayState = {
        lowerThirdVisible: overlayEff.lowerThird.visible,
        tickerVisible: overlayEff.ticker.visible,
        ctaBannerVisible: overlayEff.ctaBanner.visible,
        updatedAt: overlayEff.updatedAt,
      };
    }
  }

  return NextResponse.json({
    ok: true,
    model: responseModel,
    liveScene,
    liveSceneState: liveScene,
    overlayState,
    scheduleState,
    directingSignals,
    autoDirecting,
  });
}
