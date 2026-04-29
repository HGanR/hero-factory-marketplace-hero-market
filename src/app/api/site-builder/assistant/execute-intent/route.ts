import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { web3SiteVersions } from "@/lib/db/schema";
import { ensureSiteBuilderTables, getOwnedSite } from "@/lib/site-builder/db";
import { hashSiteSchema } from "@/lib/site-builder/hash";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import { resolveSiteBuilderLlmInvokeForSite } from "@/lib/site-builder/ai/provider-resolver";
import { ExecuteIntentRequestSchema } from "@/lib/site-builder/assistant/execute-intent-types";
import { runExecuteIntentAnalysis } from "@/lib/site-builder/assistant/run-execute-intent";

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

  const parsed = ExecuteIntentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { message, siteId, versionId, schemaSnapshotHash, sessionId, editContext } = parsed.data;
  void sessionId;

  try {
    const db = await getDb();
    await ensureSiteBuilderTables(db);

    const site = await getOwnedSite(db, userId, siteId);
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const targetVersionId = (versionId?.trim() || site.currentVersionId || "").trim();
    if (!targetVersionId) {
      return NextResponse.json(
        { error: "No version available. Save a version first or pass versionId." },
        { status: 400 },
      );
    }

    const [version] = await db
      .select()
      .from(web3SiteVersions)
      .where(and(eq(web3SiteVersions.id, targetVersionId), eq(web3SiteVersions.siteId, site.id)))
      .limit(1);
    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    let schemaJson: unknown;
    try {
      schemaJson = JSON.parse(version.schemaJson || "{}");
    } catch {
      return NextResponse.json({ error: "Stored schema is not valid JSON" }, { status: 500 });
    }

    const schemaParse = SiteSchemaDocument.safeParse(schemaJson);
    if (!schemaParse.success) {
      return NextResponse.json({ error: "Stored schema is invalid", issues: schemaParse.error.issues }, { status: 400 });
    }

    const serverHash = hashSiteSchema(schemaParse.data);
    if (schemaSnapshotHash && schemaSnapshotHash.trim() && schemaSnapshotHash.trim() !== serverHash) {
      return NextResponse.json(
        {
          error: "schema_snapshot_mismatch",
          actions: [],
          assistantReply: "Your editor is out of sync with the saved version. Refresh or re-save, then try again.",
          meta: {
            intent: "unclear",
            needsClarification: true,
            clarificationQuestion: "Refresh the page or save the latest version so the assistant matches your preview.",
          },
        },
        { status: 409 },
      );
    }

    const llmR = await resolveSiteBuilderLlmInvokeForSite(db, userId, siteId);
    const invokeLlm = llmR?.invokeLlm ?? undefined;

    const out = await runExecuteIntentAnalysis({
      message,
      schema: schemaParse.data,
      editContext,
      invokeLlm: invokeLlm ?? undefined,
    });

    return NextResponse.json(out, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "execute-intent failed";
    console.error("[site-builder] assistant/execute-intent", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
