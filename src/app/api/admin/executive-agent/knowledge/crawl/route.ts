import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { createExecutiveKnowledgeDocument } from "@/lib/executive-agent/executive-knowledge-store";
import { crawlPublicUrlToPlainText } from "@/lib/executive-agent/executive-knowledge-crawl";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  url: z.string().min(4).max(4000),
});

export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { url } = BodySchema.parse(await req.json());
    const crawled = await crawlPublicUrlToPlainText(url);
    const db = await getDb();
    const row = await createExecutiveKnowledgeDocument(db, adminUserId, {
      title: crawled.title.slice(0, 500),
      sourceType: "crawl",
      sourceUrl: crawled.finalUrl,
      contentText: crawled.text.slice(0, 400_000),
      summary: crawled.text.slice(0, 800),
      metadata: { crawledFrom: url },
    });
    return NextResponse.json({ item: row });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "INVALID_REQUEST", issues: e.flatten() }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    const status = /PRIVATE|INVALID|CREDENTIALS|UNSUPPORTED|FETCH_HTTP_4/.test(msg) ? 400 : 500;
    return NextResponse.json({ error: "CRAWL_FAILED", message: msg }, { status });
  }
}
