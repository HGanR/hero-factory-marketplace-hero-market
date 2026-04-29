import { NextRequest, NextResponse } from "next/server";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { z } from "zod";
import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureRevenueOsLiveModuleTables } from "@/lib/db/revenue-os-live-modules-ensure";
import { deriveDeploymentChannelPriority } from "@/lib/revenue-os/capital-deployment-hint";
import {
  capitalPlans,
  revenueOsFunnelDeploymentRuns,
  revenueOsFunnelPages,
  revenueOsFunnels,
} from "@/lib/db/schema";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Module 3: Deployment Automation Layer
 * POST /api/revenue-os/deploy/funnel
 * Stores funnel config (pages, sections, copy blocks).
 */

const FunnelSpecSchema = z
  .object({
    profileId: z.string().optional(),
    userId: z.string().min(1),
    clientId: z.string().optional(),
    trustId: z.string().optional(),
    name: z.string().min(1),
    pages: z.array(
      z.object({
        title: z.string(),
        sections: z.array(
          z.object({
            type: z.string(),
            copy: z.string().optional(),
            blocks: z.array(z.record(z.unknown())).optional(),
          })
        ),
      })
    ),
    capitalPlanId: z.string().min(1).optional(),
    applyCapitalPlanHints: z.boolean().optional(),
  })
  .refine(
    (d) => !d.capitalPlanId || d.applyCapitalPlanHints === true,
    {
      message: "applyCapitalPlanHints must be true when capitalPlanId is set",
      path: ["applyCapitalPlanHints"],
    }
  );

const ListQuerySchema = z.object({
  userId: z.string().min(1),
  clientId: z.string().optional(),
  trustId: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(25),
});

/**
 * GET /api/revenue-os/deploy/funnel?userId=&clientId=&trustId=
 * List stored funnel artifacts for the workspace.
 */
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/deploy/funnel", req);
    const url = new URL(req.url);
    const parsed = ListQuerySchema.parse({
      userId: url.searchParams.get("userId") ?? "",
      clientId: url.searchParams.get("clientId") ?? undefined,
      trustId: url.searchParams.get("trustId") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    await ensureRevenueOsLiveModuleTables();
    const db = await getDb();
    const clientId = parsed.clientId?.trim() ?? "";
    const trustId = parsed.trustId?.trim() ?? "";

    const rows = await db
      .select({
        id: revenueOsFunnels.id,
        name: revenueOsFunnels.name,
        status: revenueOsFunnels.status,
        crossModuleContext: revenueOsFunnels.crossModuleContext,
        createdAt: revenueOsFunnels.createdAt,
      })
      .from(revenueOsFunnels)
      .where(
        and(
          eq(revenueOsFunnels.userId, parsed.userId),
          eq(revenueOsFunnels.clientId, clientId),
          eq(revenueOsFunnels.trustId, trustId)
        )
      )
      .orderBy(desc(revenueOsFunnels.createdAt))
      .limit(parsed.limit);

    return NextResponse.json({ funnels: rows });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query", details: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[revenue-os/deploy/funnel GET]", e);
    return NextResponse.json({ error: "Failed to list funnels" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/deploy/funnel", req);
    const body = await req.json().catch(() => ({}));
    const parsed = FunnelSpecSchema.parse(body);

    await ensureRevenueOsLiveModuleTables();
    const id = crypto.randomUUID();
    const db = await getDb();
    const started = new Date();
    const clientId = parsed.clientId?.trim() ?? "";
    const trustId = parsed.trustId?.trim() ?? "";

    let crossModuleContext: Record<string, unknown> | undefined;
    let capitalPlanHints: ReturnType<typeof deriveDeploymentChannelPriority> | undefined;

    if (parsed.capitalPlanId && parsed.applyCapitalPlanHints) {
      const planRows = await db
        .select()
        .from(capitalPlans)
        .where(
          and(
            eq(capitalPlans.id, parsed.capitalPlanId),
            eq(capitalPlans.userId, parsed.userId),
            eq(capitalPlans.clientId, clientId),
            eq(capitalPlans.trustId, trustId)
          )
        )
        .limit(1);
      if (planRows.length === 0) {
        return NextResponse.json(
          { error: "Capital plan not found for this workspace", capitalPlanId: parsed.capitalPlanId },
          { status: 400 }
        );
      }
      const plan = planRows[0]!;
      capitalPlanHints = deriveDeploymentChannelPriority({
        payload: plan.payload as Record<string, unknown> | null,
        channelMix: plan.channelMix as Record<string, unknown> | null,
      });
      crossModuleContext = {
        capitalPlanId: parsed.capitalPlanId,
        channelPriority: capitalPlanHints.channelPriority,
        rationale: capitalPlanHints.rationale,
        budgetAllocationSnapshot: capitalPlanHints.budgetAllocationSnapshot,
        crossModuleAudit: [
          {
            at: new Date().toISOString(),
            sourceModule: "capital_allocation",
            action: "deployment_channel_hints",
            ids: { capitalPlanId: parsed.capitalPlanId },
          },
        ],
      };
    }

    await db.insert(revenueOsFunnels).values({
      id,
      userId: parsed.userId,
      profileId: parsed.profileId ?? null,
      clientId,
      trustId,
      name: parsed.name,
      status: "DRAFT",
      crossModuleContext: crossModuleContext ?? null,
    });

    for (let i = 0; i < parsed.pages.length; i++) {
      const page = parsed.pages[i];
      const pageId = crypto.randomUUID();
      await db.insert(revenueOsFunnelPages).values({
        id: pageId,
        funnelId: id,
        title: page.title,
        sortOrder: i,
        sections: page.sections ?? [],
      });
    }

    const finished = new Date();
    const runId = crypto.randomUUID();
    await db.insert(revenueOsFunnelDeploymentRuns).values({
      id: runId,
      funnelId: id,
      userId: parsed.userId,
      clientId,
      trustId,
      provider: "artifact",
      mode: "stored",
      status: "success",
      resultSummary: {
        pageCount: parsed.pages.length,
        name: parsed.name,
        durationMs: finished.getTime() - started.getTime(),
        ...(capitalPlanHints
          ? {
              capitalPlanHints: {
                channelPriority: capitalPlanHints.channelPriority,
                rationale: capitalPlanHints.rationale,
              },
            }
          : {}),
      },
      errorMessage: null,
      startedAt: started,
      finishedAt: finished,
    });

    return NextResponse.json({
      id,
      status: "DRAFT",
      deploymentRunId: runId,
      providerMode: "artifact_stored",
      funnel: {
        id,
        name: parsed.name,
        pages: parsed.pages,
      },
      ...(capitalPlanHints
        ? {
            capitalPlanHints: {
              channelPriority: capitalPlanHints.channelPriority,
              suggestedChannelPriority: capitalPlanHints.channelPriority,
              rationale: capitalPlanHints.rationale,
            },
          }
        : {}),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[revenue-os/deploy/funnel]", e);
    return NextResponse.json(
      { error: "Funnel deployment failed" },
      { status: 500 }
    );
  }
}
