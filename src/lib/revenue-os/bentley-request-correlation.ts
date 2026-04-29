/**
 * Browser-only: adds Bentley correlation headers when a pipeline run is active.
 * @see getBentleyActiveRunCorrelationContext in `bentley-run-observability.ts`
 */

import {
  X_BENTLEY_CLIENT_ID,
  X_BENTLEY_RUN_ID,
  X_BENTLEY_USER_ID,
} from "@/lib/revenue-os/bentley-correlation-headers";
import { getBentleyActiveRunCorrelationContext } from "@/lib/revenue-os/bentley-run-observability";

/** Extra headers for `fetch` when orchestration has an active run; otherwise `{}`. */
export function getBentleyPipelineFetchHeaders(): Record<string, string> {
  const ctx = getBentleyActiveRunCorrelationContext();
  if (!ctx) return {};
  const h: Record<string, string> = {
    [X_BENTLEY_RUN_ID]: ctx.runId,
    [X_BENTLEY_USER_ID]: ctx.userId,
  };
  if (ctx.clientId !== undefined && ctx.clientId !== null && String(ctx.clientId).length > 0) {
    h[X_BENTLEY_CLIENT_ID] = String(ctx.clientId);
  }
  return h;
}

/** JSON POST headers including optional Bentley correlation. */
export function bentleyJsonPostHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...getBentleyPipelineFetchHeaders(),
  };
}
