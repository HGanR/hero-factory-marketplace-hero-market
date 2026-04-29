import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { PutSiteBuilderAiSettingsSchema, type SiteBuilderAiSettingsPublic } from "@/lib/site-builder/ai/provider-config";
import {
  ensureSiteBuilderTables,
  getOwnedSite,
  getSiteBuilderAiSettingsRow,
  upsertSiteBuilderAiSettingsRow,
} from "@/lib/site-builder/db";
import { encryptToken } from "@/lib/social/encrypt";

export async function GET(_req: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { siteId } = await params;
    const db = await getDb();
    await ensureSiteBuilderTables(db);
    const site = await getOwnedSite(db, userId, siteId);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const row = await getSiteBuilderAiSettingsRow(db, siteId);
    const body: SiteBuilderAiSettingsPublic = {
      siteId,
      llmMode: row?.llmMode ?? "platform",
      endpoint: row?.endpoint ?? null,
      model: row?.model ?? null,
      hasApiKey: Boolean(row?.apiKeyEnc?.trim()),
      fallbackToPlatform: row?.fallbackToPlatform ?? false,
      updatedAt: row?.updatedAt ?? null,
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("ai-settings GET", e);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PutSiteBuilderAiSettingsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const { siteId } = await params;
    const db = await getDb();
    await ensureSiteBuilderTables(db);
    const site = await getOwnedSite(db, userId, siteId);
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const existing = await getSiteBuilderAiSettingsRow(db, siteId);
    let apiKeyEnc = existing?.apiKeyEnc ?? null;
    const rawKey = parsed.data.apiKey?.trim();
    if (rawKey) {
      apiKeyEnc = encryptToken(rawKey);
    }

    await upsertSiteBuilderAiSettingsRow(db, userId, siteId, {
      llmMode: parsed.data.llmMode,
      endpoint: parsed.data.endpoint?.trim() || null,
      model: parsed.data.model?.trim() || null,
      apiKeyEnc,
      fallbackToPlatform: parsed.data.fallbackToPlatform ?? false,
    });

    const row = await getSiteBuilderAiSettingsRow(db, siteId);
    const body: SiteBuilderAiSettingsPublic = {
      siteId,
      llmMode: row!.llmMode,
      endpoint: row!.endpoint,
      model: row!.model,
      hasApiKey: Boolean(row!.apiKeyEnc?.trim()),
      fallbackToPlatform: row!.fallbackToPlatform,
      updatedAt: row!.updatedAt,
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("ai-settings PUT", e);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
