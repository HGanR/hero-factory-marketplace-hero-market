import crypto from "crypto";
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { web3SiteTemplates } from "@/lib/db/schema";
import { ensureSiteBuilderTables } from "@/lib/site-builder/db";

const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(191),
  description: z.string().max(2000).optional(),
  schemaJson: z.record(z.string(), z.unknown()),
  trustId: z.string().optional(),
  workspaceId: z.string().optional(),
  clientId: z.string().optional(),
});

export async function GET(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = await getDb();
    await ensureSiteBuilderTables(db);
    const { searchParams } = new URL(req.url);
    const trustId = (searchParams.get("trustId") || "").trim();
    const whereClause = trustId
      ? and(eq(web3SiteTemplates.userId, userId), eq(web3SiteTemplates.trustId, trustId))
      : eq(web3SiteTemplates.userId, userId);
    const items = await db
      .select()
      .from(web3SiteTemplates)
      .where(whereClause)
      .orderBy(desc(web3SiteTemplates.updatedAt));
    return NextResponse.json({ items });
  } catch (error) {
    console.error("site-builder/templates GET failed", error);
    return NextResponse.json({ error: "Failed to list templates" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = CreateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
    }
    const db = await getDb();
    await ensureSiteBuilderTables(db);
    const id = crypto.randomUUID();
    await db.insert(web3SiteTemplates).values({
      id,
      userId,
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      schemaJson: JSON.stringify(parsed.data.schemaJson),
      trustId: parsed.data.trustId?.trim() || null,
      workspaceId: parsed.data.workspaceId?.trim() || null,
      clientId: parsed.data.clientId?.trim() || null,
    });
    const [template] = await db.select().from(web3SiteTemplates).where(eq(web3SiteTemplates.id, id)).limit(1);
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error("site-builder/templates POST failed", error);
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 });
  }
}

