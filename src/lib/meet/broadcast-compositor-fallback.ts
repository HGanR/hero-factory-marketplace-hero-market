import type { BroadcastCompositorRenderModel } from "./broadcast-compositor";
import { validateBroadcastCompositorRenderModel } from "./broadcast-compositor";
import { createBroadcastRenderSession } from "./broadcast-render-sessions";
import { broadcastTemplatePublicOrigin, buildBroadcastTemplateUrl } from "./broadcast-template";

export type V2PrepareResult =
  | { ok: true; customBaseUrl: string; renderSessionId: number }
  | { ok: false; reason: string };

/**
 * Prepare V2 custom template URL + render session. Returns ok:false for safe V1 fallback (no throw).
 */
export async function prepareV2RenderedCompositorOrReason(params: {
  userId: number;
  broadcastSessionId: number;
  renderModel: BroadcastCompositorRenderModel;
}): Promise<V2PrepareResult> {
  const origin = broadcastTemplatePublicOrigin();
  if (!origin) {
    return { ok: false, reason: "template_origin_unconfigured" };
  }

  const v = validateBroadcastCompositorRenderModel(params.renderModel);
  if (!v.ok) {
    return { ok: false, reason: v.errors.join(";") };
  }

  try {
    const row = await createBroadcastRenderSession({
      broadcastSessionId: params.broadcastSessionId,
      userId: params.userId,
      renderModel: v.model,
    });
    const customBaseUrl = buildBroadcastTemplateUrl(origin, row.id, row.accessToken);
    return { ok: true, customBaseUrl, renderSessionId: row.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "render_session_create_failed";
    return { ok: false, reason: msg.slice(0, 240) };
  }
}
