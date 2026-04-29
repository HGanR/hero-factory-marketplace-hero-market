import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import {
  getDistributionQueueTargetForUser,
  markDistributionQueueFailed,
} from "@/lib/revenue-os/distribution-queue-actions";
import { executePublishAction } from "@/lib/revenue-os/publish-executor";
import { buildManualExportPackage } from "@/lib/revenue-os/manual-export";
import type { ConnectorRoutingStatus } from "@/lib/revenue-os/distribution-routing";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const BodySchema = z.object({
  clientId: z.string().max(36).optional().default(""),
  trustId: z.string().max(36).optional().default(""),
  queueId: z.string().min(1).max(36),
  /** When set, resolves that queue target row (connector-aware path). */
  queueTargetId: z.string().min(1).max(36).optional().nullable(),
  externalPostRef: z.string().max(512).optional().nullable(),
  /** When true, skip real adapter and record mock/manual publish. Default false — prefer real connector when ready. */
  mockOrManual: z.boolean().optional().default(false),
  /** When true, allows publish when routing_status blocks auto path. */
  manualOverride: z.boolean().optional().default(false),
  /** Dev/test: record a failed publish without calling external APIs. */
  simulateFailure: z.boolean().optional().default(false),
  errorMessage: z.string().max(8000).optional().nullable(),
  /** Include manual export package in JSON when target is blocked/manual. */
  includeManualExportPackage: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/distribution/publish", req);
    const userId = await getAuthedUserId();
    if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = BodySchema.parse(await req.json().catch(() => ({})));
    const scope = {
      userId: String(userId),
      clientId: parsed.clientId,
      trustId: parsed.trustId,
      queueId: parsed.queueId,
    };

    if (parsed.simulateFailure) {
      const fail = await markDistributionQueueFailed({
        ...scope,
        error: (parsed.errorMessage ?? "Simulated publish failure").slice(0, 8000),
      });
      return NextResponse.json({ ok: fail.ok, row: fail.row, reason: fail.reason, simulated: true });
    }

    const exec = await executePublishAction({
      ...scope,
      queueTargetId: parsed.queueTargetId ?? undefined,
      manualOverride: parsed.manualOverride,
      mockOrManual: parsed.mockOrManual,
      externalPostRef: parsed.externalPostRef ?? undefined,
    });

    if (!exec.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: exec.reason,
          executionMode: exec.executionMode,
          targetPlatform: exec.targetPlatform,
          targetProfile: exec.targetProfileId,
          payloadWarnings: exec.payloadWarnings,
        },
        { status: 400 }
      );
    }

    let manualExport = undefined;
    if (parsed.includeManualExportPackage && parsed.queueTargetId) {
      const t = await getDistributionQueueTargetForUser({
        userId: scope.userId,
        clientId: scope.clientId,
        trustId: scope.trustId,
        queueTargetId: parsed.queueTargetId,
      });
      if (t?.payloadJson && typeof t.payloadJson === "object") {
        const p = t.payloadJson as Record<string, unknown>;
        manualExport = buildManualExportPackage({
          platform: t.targetPlatform,
          targetFormat: t.targetFormat,
          caption: typeof p.caption === "string" ? p.caption : undefined,
          body: typeof p.body === "string" ? p.body : typeof p.message === "string" ? p.message : undefined,
          hashtags: Array.isArray(p.hashtags) ? (p.hashtags as string[]) : undefined,
          cta: typeof p.cta === "string" ? p.cta : undefined,
          mediaPrompt: typeof p.mediaPrompt === "string" ? p.mediaPrompt : undefined,
          assetRefs: Array.isArray(p.assetRefs) ? (p.assetRefs as string[]) : undefined,
          routingStatus: (t.routingStatus as ConnectorRoutingStatus) ?? "requires_manual_export",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      row: exec.queue,
      executionMode: exec.executionMode,
      targetPlatform: exec.targetPlatform,
      targetProfile: exec.targetProfileId,
      payloadWarnings: exec.payloadWarnings,
      externalPostRef: exec.externalPostRef,
      manualExportPackage: manualExport,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
