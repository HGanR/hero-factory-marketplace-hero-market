import { NextRequest, NextResponse } from "next/server";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { z } from "zod";
import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureRevenueOsLiveModuleTables } from "@/lib/db/revenue-os-live-modules-ensure";
import { deriveDeploymentChannelPriority } from "@/lib/revenue-os/capital-deployment-hint";
import { capitalPlans, revenueOsMessageSequences, revenueOsSequenceSteps } from "@/lib/db/schema";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Module 3: Deployment Automation Layer
 * POST /api/revenue-os/deploy/sequences
 * Stores email/SMS sequence templates.
 * Integrations (SendGrid/Twilio) later.
 */

const SequenceSpecSchema = z
  .object({
    profileId: z.string().optional(),
    userId: z.string().min(1),
    clientId: z.string().optional(),
    trustId: z.string().optional(),
    channel: z.enum(["email", "sms"]),
    name: z.string().min(1),
    steps: z.array(
      z.object({
        dayOffset: z.number(),
        subject: z.string().optional(),
        body: z.string(),
        trigger: z.string().optional(),
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
 * GET /api/revenue-os/deploy/sequences?userId=&clientId=
 * List stored message sequences for the workspace.
 */
export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/deploy/sequences", req);
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
        id: revenueOsMessageSequences.id,
        name: revenueOsMessageSequences.name,
        channel: revenueOsMessageSequences.channel,
        status: revenueOsMessageSequences.status,
        crossModuleContext: revenueOsMessageSequences.crossModuleContext,
        createdAt: revenueOsMessageSequences.createdAt,
      })
      .from(revenueOsMessageSequences)
      .where(
        and(
          eq(revenueOsMessageSequences.userId, parsed.userId),
          eq(revenueOsMessageSequences.clientId, clientId),
          eq(revenueOsMessageSequences.trustId, trustId)
        )
      )
      .orderBy(desc(revenueOsMessageSequences.createdAt))
      .limit(parsed.limit);

    return NextResponse.json({ sequences: rows });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid query", details: e.flatten() },
        { status: 400 }
      );
    }
    console.error("[revenue-os/deploy/sequences GET]", e);
    return NextResponse.json({ error: "Failed to list sequences" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/deploy/sequences", req);
    const body = await req.json().catch(() => ({}));
    const parsed = SequenceSpecSchema.parse(body);

    await ensureRevenueOsLiveModuleTables();
    const id = crypto.randomUUID();
    const db = await getDb();
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

    await db.insert(revenueOsMessageSequences).values({
      id,
      userId: parsed.userId,
      profileId: parsed.profileId ?? null,
      clientId,
      trustId,
      channel: parsed.channel,
      name: parsed.name,
      status: "DRAFT",
      crossModuleContext: crossModuleContext ?? null,
    });

    for (let i = 0; i < parsed.steps.length; i++) {
      const step = parsed.steps[i];
      const stepId = crypto.randomUUID();
      await db.insert(revenueOsSequenceSteps).values({
        id: stepId,
        sequenceId: id,
        dayOffset: step.dayOffset,
        subject: step.subject ?? null,
        body: step.body,
        trigger: step.trigger ?? null,
        sortOrder: i,
      });
    }

    return NextResponse.json({
      id,
      status: "DRAFT",
      sequence: {
        id,
        channel: parsed.channel,
        name: parsed.name,
        steps: parsed.steps,
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
    console.error("[revenue-os/deploy/sequences]", e);
    return NextResponse.json(
      { error: "Sequence deployment failed" },
      { status: 500 }
    );
  }
}
