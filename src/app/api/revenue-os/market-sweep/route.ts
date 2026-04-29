import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import { runMarketIntelligenceSweepPipeline } from "@/lib/revenue-os/market-sweep-pipeline";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

const BodySchema = z.object({
  industry: z.string().min(2).max(240),
  targetAudience: z.string().max(600).optional().default("general audience"),
  platforms: z.array(z.string().max(120)).max(32).optional().default([]),
  clientId: z.string().max(80).optional().default(""),
  trustId: z.string().max(80).optional().default(""),
});

/**
 * POST /api/revenue-os/market-sweep
 * Hybrid market intelligence: live Reddit/YouTube signals + LLM buckets (or deterministic fallback) + finalize.
 */
export async function POST(req: NextRequest) {
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;

  try {
    logBentleyCorrelationEvent("revenue-os/market-sweep", req);

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "INVALID_JSON", message: "Request body must be JSON" }, { status: 400 });
    }

    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "INVALID_REQUEST", issues: parsed.error.flatten() }, { status: 400 });
    }

    const userId = await getAuthedUserId();

    const { result, connectedIntegrations, llmUsed, llmError } = await runMarketIntelligenceSweepPipeline({
      industry: parsed.data.industry.trim(),
      targetAudience: parsed.data.targetAudience.trim() || "general audience",
      platforms: parsed.data.platforms,
      clientId: parsed.data.clientId.trim(),
      trustId: parsed.data.trustId.trim(),
      userId: userId != null ? String(userId) : null,
    });

    return NextResponse.json({
      ...result,
      connectedIntegrations,
      sweepMeta: {
        llmUsed,
        ...(llmError ? { llmError } : {}),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[revenue-os/market-sweep]", msg);

    if (msg.includes("MARKET_SWEEP_EMPTY_OUTPUT")) {
      return NextResponse.json({ error: "SWEEP_SYNTHESIS_FAILED", message: msg }, { status: 502 });
    }

    return NextResponse.json({ error: "MARKET_SWEEP_FAILED", message: msg.slice(0, 500) }, { status: 500 });
  }
}
