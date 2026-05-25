import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { resolveSiteBuilderLlmInvokeForSite } from "@/lib/site-builder/ai/provider-resolver";
import {
  BuilderActionsRequestSchema,
  executeBuilderActions,
} from "@/lib/site-builder/builder-actions";
import { getOwnedSite } from "@/lib/site-builder/db";
import { hashSiteSchema } from "@/lib/site-builder/hash";
import { insertBuilderActionRun } from "@/lib/site-builder/log-builder-action-run";
import type { LlmMessage } from "@/lib/npc/llm";

export async function POST(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BuilderActionsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const db = await getDb();
  const hashBefore = hashSiteSchema(parsed.data.schemaJson);

  if (parsed.data.siteId) {
    const site = await getOwnedSite(db, userId, parsed.data.siteId);
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }
  }

  let invokeLlm: ((messages: LlmMessage[]) => Promise<string | null>) | undefined;
  if (parsed.data.siteId) {
    const r = await resolveSiteBuilderLlmInvokeForSite(db, userId, parsed.data.siteId);
    if (r) invokeLlm = r.invokeLlm ?? undefined;
  }

  const logSource = parsed.data.source ?? "api";
  const logSiteId = parsed.data.siteId ?? null;
  const logVersionId = parsed.data.versionId ?? null;

  try {
    const out = await executeBuilderActions({
      schemaJson: parsed.data.schemaJson,
      actions: parsed.data.actions,
      userId,
      siteId: parsed.data.siteId ?? null,
      invokeLlm,
    });
    const allOk = out.results.every((r) => r.ok);
    const hashAfter = hashSiteSchema(out.schema);
    try {
      await insertBuilderActionRun(db, {
        siteId: logSiteId,
        versionId: logVersionId,
        userId,
        source: logSource,
        actions: parsed.data.actions,
        results: out.results,
        status: allOk ? "success" : "partial",
        errorMessage: allOk ? null : out.results.find((r) => !r.ok)?.message ?? "One or more actions failed",
        schemaHashBefore: hashBefore,
        schemaHashAfter: hashAfter,
      });
    } catch (logErr) {
      console.error("[site-builder] action run log failed", logErr);
    }
    return NextResponse.json(
      {
        ok: allOk,
        schema: out.schema,
        results: out.results,
        sessionEditContext: out.sessionEditContext,
        abortedAt: out.abortedAt,
      },
      { status: allOk ? 200 : 422 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Builder actions failed";
    try {
      await insertBuilderActionRun(db, {
        siteId: logSiteId,
        versionId: logVersionId,
        userId,
        source: logSource,
        actions: parsed.data.actions,
        results: [{ action: "batch", ok: false, message }],
        status: "failed",
        errorMessage: message,
        schemaHashBefore: hashBefore,
        schemaHashAfter: null,
      });
    } catch (logErr) {
      console.error("[site-builder] action run log failed", logErr);
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
