import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { logBentleyCorrelationEvent } from "@/lib/revenue-os/bentley-correlation-server";
import type { RevenueOsLaunchModePlan } from "@/lib/revenue-os/launch-mode-types";
import {
  createLaunchCycleForUser,
  listLaunchCycleEventsForUser,
  listLaunchCyclesForUser,
  loadLatestLaunchCycleForUser,
  saveLaunchCycleProgressForUser,
  type LaunchCycleDbScope,
} from "@/lib/revenue-os/launch-progress-db";
import { coerceLaunchCycleProgress } from "@/lib/revenue-os/launch-progress-storage";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const ScopeQuerySchema = z.object({
  scopeKey: z.string().min(1).max(200),
  clientId: z.string().max(36).optional(),
  trustId: z.string().max(36).optional(),
  historyLimit: z.coerce.number().int().min(0).max(25).optional(),
  eventLimit: z.coerce.number().int().min(0).max(100).optional(),
});

const ScopeBodySchema = z.object({
  scopeKey: z.string().min(1).max(200),
  clientId: z.string().max(36).optional(),
  trustId: z.string().max(36).optional(),
});

function toScope(parsed: z.infer<typeof ScopeBodySchema>, userIdStr: string): LaunchCycleDbScope {
  return {
    userIdStr,
    clientId: (parsed.clientId ?? "").trim(),
    trustId: (parsed.trustId ?? "").trim(),
    scopeKey: parsed.scopeKey.trim(),
  };
}

function coercePlan(raw: unknown): RevenueOsLaunchModePlan | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.summary !== "string" || !Array.isArray(p.days)) return null;
  return raw as RevenueOsLaunchModePlan;
}

export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/launch-cycle", req);
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL(req.url);
    const parsed = ScopeQuerySchema.parse({
      scopeKey: url.searchParams.get("scopeKey") ?? "",
      clientId: url.searchParams.get("clientId") ?? undefined,
      trustId: url.searchParams.get("trustId") ?? undefined,
      historyLimit: url.searchParams.get("historyLimit") ?? undefined,
      eventLimit: url.searchParams.get("eventLimit") ?? undefined,
    });
    const scope = toScope(parsed, String(userId));
    const latest = await loadLatestLaunchCycleForUser(scope);
    let recent: Awaited<ReturnType<typeof listLaunchCyclesForUser>> = [];
    if (parsed.historyLimit && parsed.historyLimit > 0) {
      recent = await listLaunchCyclesForUser(scope, parsed.historyLimit);
    }
    let events: Awaited<ReturnType<typeof listLaunchCycleEventsForUser>> = [];
    if (latest && parsed.eventLimit && parsed.eventLimit > 0) {
      events = await listLaunchCycleEventsForUser(
        String(userId),
        latest.progress.cycleId,
        parsed.eventLimit
      );
    }
    return NextResponse.json({
      latest: latest ? { progress: latest.progress, plan: latest.plan } : null,
      recent: recent.map((b) => ({ progress: b.progress, plan: b.plan })),
      events,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid query", details: e.flatten() }, { status: 400 });
    }
    console.error("[revenue-os/launch-cycle GET]", e);
    return NextResponse.json({ error: "Failed to load launch cycle" }, { status: 500 });
  }
}

const PostBodySchema = ScopeBodySchema.extend({
  progress: z.unknown(),
  plan: z.unknown().optional(),
  signalsSnapshot: z.unknown().optional(),
});

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/launch-cycle", req);
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = PostBodySchema.parse(await req.json());
    const progress = coerceLaunchCycleProgress(body.progress);
    if (!progress) {
      return NextResponse.json({ error: "Invalid progress payload" }, { status: 400 });
    }
    const scope = toScope(body, String(userId));
    const plan = body.plan !== undefined ? coercePlan(body.plan) : null;
    const bundle = await createLaunchCycleForUser(scope, {
      progress,
      plan,
      signalsSnapshot: body.signalsSnapshot ?? null,
    });
    return NextResponse.json({ bundle: { progress: bundle.progress, plan: bundle.plan } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid body", details: e.flatten() }, { status: 400 });
    }
    console.error("[revenue-os/launch-cycle POST]", e);
    return NextResponse.json({ error: "Failed to create launch cycle" }, { status: 500 });
  }
}

const PatchBodySchema = ScopeBodySchema.extend({
  progress: z.unknown(),
  plan: z.unknown().optional(),
  signalsSnapshot: z.unknown().optional(),
});

export async function PATCH(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    logBentleyCorrelationEvent("revenue-os/launch-cycle", req);
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = PatchBodySchema.parse(await req.json());
    const progress = coerceLaunchCycleProgress(body.progress);
    if (!progress) {
      return NextResponse.json({ error: "Invalid progress payload" }, { status: 400 });
    }
    const userIdStr = String(userId);
    const plan =
      body.plan !== undefined ? (coercePlan(body.plan) ?? undefined) : undefined;
    const bundle = await saveLaunchCycleProgressForUser(userIdStr, progress, {
      ...(plan !== undefined ? { plan } : {}),
      ...(body.signalsSnapshot !== undefined ? { signalsSnapshot: body.signalsSnapshot } : {}),
    });
    if (!bundle) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }
    return NextResponse.json({ bundle: { progress: bundle.progress, plan: bundle.plan } });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid body", details: e.flatten() }, { status: 400 });
    }
    console.error("[revenue-os/launch-cycle PATCH]", e);
    return NextResponse.json({ error: "Failed to update launch cycle" }, { status: 500 });
  }
}
