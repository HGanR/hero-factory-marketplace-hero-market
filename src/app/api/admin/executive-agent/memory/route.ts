import { NextRequest, NextResponse } from "next/server";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { createExecutiveMemoryItem, listExecutiveMemoryItems } from "@/lib/executive-agent/executive-memory-store";

export const dynamic = "force-dynamic";

const PostBodySchema = z.object({
  memoryType: z.enum(schema.EXECUTIVE_MEMORY_TYPES),
  subjectType: z.string().max(64).optional().nullable(),
  subjectId: z.string().max(191).optional().nullable(),
  title: z.string().min(1).max(500),
  summary: z.string().min(1).max(20_000),
  source: z.enum(schema.EXECUTIVE_MEMORY_SOURCES),
  confidence: z.number().min(0).max(1).optional(),
  expiresAt: z.union([z.string().datetime(), z.null()]).optional(),
});

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const mt = req.nextUrl.searchParams.get("memoryType")?.trim();
  const memoryTypes =
    mt && (schema.EXECUTIVE_MEMORY_TYPES as readonly string[]).includes(mt)
      ? [mt as (typeof schema.EXECUTIVE_MEMORY_TYPES)[number]]
      : undefined;
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 80;
  try {
    const db = (await getDb()) as MySql2Database<typeof schema>;
    const items = await listExecutiveMemoryItems(db, {
      adminUserId,
      memoryTypes,
      searchTerm: q || undefined,
      limit: Number.isFinite(limit) ? limit : 80,
    });
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "MEMORY_LIST_FAILED", message: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const json = await req.json();
    const body = PostBodySchema.parse(json);
    const db = (await getDb()) as MySql2Database<typeof schema>;
    const expiresAt =
      body.expiresAt === undefined ? undefined : body.expiresAt === null ? null : new Date(body.expiresAt);
    const row = await createExecutiveMemoryItem(db, adminUserId, {
      memoryType: body.memoryType,
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      title: body.title,
      summary: body.summary,
      source: body.source,
      confidence: body.confidence,
      expiresAt: expiresAt ?? undefined,
    });
    return NextResponse.json({ item: row });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "INVALID_REQUEST", issues: e.flatten() }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "MEMORY_CREATE_FAILED", message: msg }, { status: 500 });
  }
}
