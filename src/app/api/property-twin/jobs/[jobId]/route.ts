import { NextRequest, NextResponse } from "next/server";
import { ptCanAccessJob, ptGetJob, ptUpdateJob } from "@/lib/property-twin/queries";
import { isAllowedTransition } from "@/lib/property-twin/job-state";
import { canUsePropertyTwinInternalRoutes } from "@/lib/property-twin/internal-auth";
import { propertyTwinRequireAuth } from "@/lib/property-twin/auth-guard";
import { ptPatchJobInternalSchema, ptPatchJobPublicSchema } from "@/lib/property-twin/schemas";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ jobId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const auth = await propertyTwinRequireAuth();
    if (auth instanceof NextResponse) return auth;

    const jobId = Number((await ctx.params).jobId);
    if (!Number.isFinite(jobId)) {
      return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
    }
    const row = await ptGetJob(jobId);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const ok = await ptCanAccessJob(jobId, auth.userId);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json(row);
  } catch (e) {
    console.error("[property-twin/jobs/jobId GET]", e);
    return NextResponse.json({ error: "Failed to load job" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const jobId = Number((await ctx.params).jobId);
    if (!Number.isFinite(jobId)) {
      return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
    }
    const job = await ptGetJob(jobId);
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const internal = canUsePropertyTwinInternalRoutes(req);
    const body = await req.json().catch(() => ({}));

    if (internal) {
      const parsed = ptPatchJobInternalSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid payload", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
      const data = parsed.data;
      if (data.status !== undefined) {
        if (!isAllowedTransition(job.status, data.status, true)) {
          return NextResponse.json(
            { error: `Illegal status transition ${job.status} → ${data.status}` },
            { status: 400 }
          );
        }
      }
      const patch: Parameters<typeof ptUpdateJob>[1] = {};
      if (data.status !== undefined) patch.status = data.status;
      if (data.progress !== undefined) patch.progress = data.progress;
      if (data.errorMessage !== undefined) patch.errorMessage = data.errorMessage;
      if (data.outputUrl !== undefined) patch.outputUrl = data.outputUrl;
      if (data.inputAssetIds !== undefined) patch.inputAssetIds = data.inputAssetIds;
      if (data.resultJson !== undefined) {
        patch.resultJson = data.resultJson;
        if (data.resultJson?.outputUrl && data.outputUrl === undefined) {
          patch.outputUrl = data.resultJson.outputUrl;
        }
      }
      if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: "No fields to update" }, { status: 400 });
      }
      const row = await ptUpdateJob(jobId, patch);
      return NextResponse.json(row);
    }

    const auth = await propertyTwinRequireAuth();
    if (auth instanceof NextResponse) return auth;
    const allowed = await ptCanAccessJob(jobId, auth.userId);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsed = ptPatchJobPublicSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload (public clients may only PATCH { status })" },
        { status: 400 }
      );
    }
    const next = parsed.data.status;
    if (!isAllowedTransition(job.status, next, false)) {
      return NextResponse.json(
        {
          error: `Transition not allowed for public client: ${job.status} → ${next}`,
          hint: "Submit (draft→queued) or cancel (draft|queued→cancelled). Worker updates require x-property-twin-internal.",
        },
        { status: 403 }
      );
    }
    const row = await ptUpdateJob(jobId, { status: next });
    return NextResponse.json(row);
  } catch (e) {
    console.error("[property-twin/jobs/jobId PATCH]", e);
    return NextResponse.json({ error: "Failed to update job" }, { status: 500 });
  }
}
