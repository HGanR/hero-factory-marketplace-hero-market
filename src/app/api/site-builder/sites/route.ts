import crypto from "crypto";
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { web3Sites } from "@/lib/db/schema";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { getOwnedClientRow } from "@/lib/revenue-os/client-hub-queries";
import { CreateSiteSchema } from "@/lib/site-builder/schema";
import { ensureSiteBuilderTables, ensureTrustAccess } from "@/lib/site-builder/db";

export async function GET(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = await getDb();
    await ensureSiteBuilderTables(db);

    const { searchParams } = new URL(req.url);
    const trustId = (searchParams.get("trustId") || "").trim();
    const status = (searchParams.get("status") || "").trim();

    const whereClause =
      trustId && status
        ? and(eq(web3Sites.userId, userId), eq(web3Sites.trustId, trustId), eq(web3Sites.status, status as any))
        : trustId
        ? and(eq(web3Sites.userId, userId), eq(web3Sites.trustId, trustId))
        : status
        ? and(eq(web3Sites.userId, userId), eq(web3Sites.status, status as any))
        : eq(web3Sites.userId, userId);

    const items = await db
      .select()
      .from(web3Sites)
      .where(whereClause)
      .orderBy(desc(web3Sites.updatedAt));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("site-builder/sites GET failed", error);
    return NextResponse.json({ error: "Failed to list sites" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = CreateSiteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
    }

    const db = await getDb();
    await ensureSiteBuilderTables(db);

    if (parsed.data.trustId) {
      const hasTrustAccess = await ensureTrustAccess(db, userId, parsed.data.trustId);
      if (!hasTrustAccess) return NextResponse.json({ error: "No access to trust" }, { status: 403 });
    }

    let siteClientId: string | null = null;
    if (parsed.data.clientId) {
      await ensureClientHubTables();
      const client = await getOwnedClientRow(userId, parsed.data.clientId);
      if (!client) {
        return NextResponse.json({ error: "Client not found or access denied" }, { status: 403 });
      }
      siteClientId = client.id;
    }

    const siteId = crypto.randomUUID();
    await db.insert(web3Sites).values({
      id: siteId,
      userId,
      clientId: siteClientId,
      trustId: parsed.data.trustId ?? null,
      workspaceId: parsed.data.workspaceId ?? parsed.data.trustId ?? null,
      name: parsed.data.name.trim(),
      slug: parsed.data.slug?.trim() || null,
      status: "DRAFT",
      ownerWallet: parsed.data.ownerWallet?.trim() || null,
      currentVersionId: null,
    });

    const [site] = await db.select().from(web3Sites).where(eq(web3Sites.id, siteId)).limit(1);
    return NextResponse.json({ site }, { status: 201 });
  } catch (error) {
    console.error("site-builder/sites POST failed", error);
    return NextResponse.json({ error: "Failed to create site" }, { status: 500 });
  }
}
