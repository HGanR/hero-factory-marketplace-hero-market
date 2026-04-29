import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import {
  fetchRemoteHtmlForImport,
  htmlToImportBlueprint,
  importBlueprintToSiteSchema,
  finalizeImportedSiteDocument,
  sourceDomainFromUrl,
  analyzeImportedBlueprint,
} from "@/lib/site-builder/site-import";
import { logSiteImportStage } from "@/lib/site-builder/site-import/import-pipeline-log";
import { SiteWidgetPlacementSchema } from "@/lib/site-builder/schema";
import { getOwnedSite, ensureSiteBuilderTables } from "@/lib/site-builder/db";
import { insertSiteImportRun } from "@/lib/site-builder/log-site-import-run";
import { z } from "zod";

const BodySchema = z.object({
  url: z.string().min(4).max(2000),
  widgetKey: z.string().min(8).max(80).optional(),
  loaderOrigin: z.string().max(500).optional(),
  widgetPlacement: SiteWidgetPlacementSchema.optional(),
  siteId: z.string().uuid().optional(),
  versionId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { url, widgetKey, loaderOrigin, widgetPlacement, siteId: bodySiteId, versionId: bodyVersionId } =
    parsed.data;

  const db = await getDb();
  await ensureSiteBuilderTables(db);
  if (bodySiteId) {
    const site = await getOwnedSite(db, userId, bodySiteId);
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }
  }

  logSiteImportStage("request_received", { url: url.slice(0, 500) });

  const fetched = await fetchRemoteHtmlForImport(url);
  if (!fetched.ok) {
    logSiteImportStage("error", { stage: "fetch_html", code: fetched.code, message: fetched.message });
    try {
      await insertSiteImportRun(db, {
        siteId: bodySiteId ?? null,
        versionId: bodyVersionId ?? null,
        userId,
        sourceUrl: url.slice(0, 2000),
        fetchStatus: String(fetched.code),
        httpStatus: null,
        partial: false,
        homeBlockCount: null,
        reconstructionPath: null,
        notesJson: null,
        warningsJson: null,
        diffReportJson: null,
        errorMessage: fetched.message,
      });
    } catch (logErr) {
      console.error("[site-builder] import run log failed", logErr);
    }
    return NextResponse.json(
      { ok: false, code: fetched.code, message: fetched.message, importStage: "failed" as const },
      { status: fetched.code === "blocked_host" ? 403 : 422 },
    );
  }

  logSiteImportStage("fetch_html", {
    finalUrl: fetched.finalUrl.slice(0, 500),
    bytes: fetched.html.length,
    contentType: fetched.contentType,
  });

  try {
    const rawBlueprint = htmlToImportBlueprint(fetched.html, fetched.url, fetched.finalUrl);
    logSiteImportStage("html_to_blueprint", {
      sectionCount: rawBlueprint.sections.length,
      partial: Boolean(rawBlueprint.partial),
      noteCount: rawBlueprint.notes?.length ?? 0,
    });

    const blueprint = analyzeImportedBlueprint(rawBlueprint);
    logSiteImportStage("semantic_reconstruction_applied", {
      path: blueprint.reconstruction?.path,
      sectionCount: blueprint.sections.length,
    });

    let schema = importBlueprintToSiteSchema(blueprint, {
      widgetKey: widgetKey?.trim(),
      loaderOrigin: loaderOrigin?.trim(),
      widgetPlacement: widgetPlacement ?? "body_end",
    });
    const homeBlocksBeforeFinalize = schema.pages[0]?.blocks?.length ?? 0;
    logSiteImportStage("blueprint_to_schema", { homeBlockCount: homeBlocksBeforeFinalize, pages: schema.pages.length });

    schema = finalizeImportedSiteDocument(schema);
    const homeBlockCount = schema.pages[0]?.blocks?.length ?? 0;

    logSiteImportStage("finalize_document", { homeBlockCount });
    logSiteImportStage("response_ready", { homeBlockCount, routeCount: schema.pages.length });

    const emptyFallback = Boolean(schema.metadata?.siteImport?.emptyStructureFallback);
    const reconPath = schema.metadata?.siteImport?.reconstruction?.path;
    const partial =
      Boolean(blueprint.partial) ||
      homeBlockCount === 0 ||
      emptyFallback ||
      reconPath === "metadata_mvp" ||
      reconPath === "invariant_repair";
    const mergedNotes = [
      ...(blueprint.notes ?? []),
      ...(blueprint.reconstruction?.notes ?? []),
    ].slice(0, 30);
    try {
      await insertSiteImportRun(db, {
        siteId: bodySiteId ?? null,
        versionId: bodyVersionId ?? null,
        userId,
        sourceUrl: fetched.finalUrl.slice(0, 2000),
        fetchStatus: "ok",
        httpStatus: 200,
        partial,
        homeBlockCount,
        reconstructionPath: reconPath ?? null,
        notesJson: JSON.stringify(mergedNotes.slice(0, 20)),
        warningsJson: null,
        diffReportJson: null,
        errorMessage: null,
      });
    } catch (logErr) {
      console.error("[site-builder] import run log failed", logErr);
    }

    return NextResponse.json({
      ok: true,
      schema,
      notes: mergedNotes,
      sourceDomain: sourceDomainFromUrl(fetched.finalUrl),
      routeCount: schema.pages.length,
      homeBlockCount,
      partial,
      emptyStructureFallback: emptyFallback,
      reconstructionPath: reconPath,
      importStage: partial ? ("partial-import" as const) : ("preview-ready" as const),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Conversion failed.";
    logSiteImportStage("error", { stage: "conversion", message });
    try {
      await insertSiteImportRun(db, {
        siteId: bodySiteId ?? null,
        versionId: bodyVersionId ?? null,
        userId,
        sourceUrl: url.slice(0, 2000),
        fetchStatus: "conversion_error",
        httpStatus: null,
        partial: false,
        homeBlockCount: null,
        reconstructionPath: null,
        notesJson: null,
        warningsJson: null,
        diffReportJson: null,
        errorMessage: message,
      });
    } catch (logErr) {
      console.error("[site-builder] import run log failed", logErr);
    }
    return NextResponse.json(
      { ok: false, code: "conversion_error", message, importStage: "failed" as const },
      { status: 500 },
    );
  }
}
