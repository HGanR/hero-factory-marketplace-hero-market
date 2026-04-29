import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { executeBuilderActions } from "@/lib/site-builder/builder-actions/execute-builder-actions";
import { BuilderActionSchema } from "@/lib/site-builder/builder-actions/action-schemas";
import { filterDraftSafeBuilderActions } from "@/lib/site-builder/draft/site-builder-draft";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";

const BodySchema = z.object({
  schemaJson: z.unknown(),
  actions: z.array(BuilderActionSchema).min(1).max(48),
});

/**
 * Apply builder actions to a site schema **without** a saved site id and **without** audit DB rows.
 * Used for unsaved / draft Site Builder projects (NL edits before "Create site").
 * Does not run execute-intent; does not bind agents or import URLs.
 */
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

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { safe, dropped } = filterDraftSafeBuilderActions(parsed.data.actions);
  if (safe.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "No draft-safe actions in this request. Save a site project to use imports, full regen, or agent binding.",
        dropped,
      },
      { status: 422 },
    );
  }

  try {
    const out = await executeBuilderActions({
      schemaJson: parsed.data.schemaJson,
      actions: safe,
      userId,
      siteId: null,
    });
    SiteSchemaDocument.parse(out.schema);
    return NextResponse.json({
      ok: true,
      schema: out.schema,
      results: out.results,
      dropped,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "draft-apply failed";
    return NextResponse.json({ ok: false, error: message, dropped }, { status: 500 });
  }
}
