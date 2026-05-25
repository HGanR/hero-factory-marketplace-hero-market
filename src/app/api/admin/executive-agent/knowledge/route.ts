import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import {
  createExecutiveKnowledgeDocument,
  listExecutiveKnowledgeDocuments,
} from "@/lib/executive-agent/executive-knowledge-store";

const KNOWLEDGE_SOURCE_TYPES = ["note", "url", "upload", "crawl"] as const;

export const dynamic = "force-dynamic";

const PostSchema = z.object({
  title: z.string().min(1).max(500),
  sourceType: z.enum(KNOWLEDGE_SOURCE_TYPES),
  sourceUrl: z.string().max(4000).optional().nullable(),
  contentText: z.string().min(1).max(500_000),
  summary: z.string().max(8000).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = await getDb();
    const items = await listExecutiveKnowledgeDocuments(db, adminUserId, 120);
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "LIST_FAILED", message: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = PostSchema.parse(await req.json());
    const db = await getDb();
    const row = await createExecutiveKnowledgeDocument(db, adminUserId, {
      title: body.title,
      sourceType: body.sourceType,
      sourceUrl: body.sourceUrl ?? null,
      contentText: body.contentText,
      summary: body.summary ?? null,
    });
    return NextResponse.json({ item: row });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "INVALID_REQUEST", issues: e.flatten() }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "CREATE_FAILED", message: msg }, { status: 500 });
  }
}
