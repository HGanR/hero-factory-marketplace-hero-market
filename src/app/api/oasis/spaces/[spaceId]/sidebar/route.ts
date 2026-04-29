import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { oasisSpaces } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

type SidebarResponse = {
  ownership?: unknown;
  readiness?: unknown;
  leasingSummary?: unknown;
  recommendedPacks?: unknown;
  spaceStatus?: "DRAFT" | "ACTIVE";
  activatedAt?: string | null;
};

async function ensureSpacesTable(db: Awaited<ReturnType<typeof getDb>>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS oasis_spaces (
      id VARCHAR(80) PRIMARY KEY,
      status ENUM('DRAFT','ACTIVE') NOT NULL DEFAULT 'DRAFT',
      activatedAt TIMESTAMP NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function fetchJson(url: string, cookie: string | null) {
  const res = await fetch(url, {
    headers: cookie ? { cookie } : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed ${res.status} ${text}`);
  }
  return res.json();
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ spaceId: string }> }) {
  const spaceId = (await ctx.params).spaceId;
  if (!spaceId) return NextResponse.json({ error: "spaceId is required" }, { status: 400 });

  try {
    const origin = req.nextUrl.origin;
    const cookie = req.headers.get("cookie");

    const db = await getDb();
    await ensureSpacesTable(db);
    const spaceRow = (
      await db.select().from(oasisSpaces).where(eq(oasisSpaces.id, spaceId)).limit(1)
    )[0];

    const readiness = await fetchJson(`${origin}/api/oasis/spaces/${spaceId}/readiness`, cookie);
    const leasingSummary = await fetchJson(`${origin}/api/oasis/spaces/${spaceId}/leases/summary`, cookie);
    const ownership = await fetchJson(`${origin}/api/oasis/spaces/${spaceId}/ownership`, cookie);

    let recommendedPacks = (readiness as any)?.recommendedPacks ?? [];
    const templateId = (readiness as any)?.templateId;
    if (!recommendedPacks?.length && templateId) {
      recommendedPacks = await fetchJson(`${origin}/api/oasis/templates/${templateId}/packs`, cookie);
    }

    const body: SidebarResponse = {
      ownership,
      readiness,
      leasingSummary,
      recommendedPacks,
      spaceStatus: spaceRow?.status ?? "DRAFT",
      activatedAt: spaceRow?.activatedAt ? new Date(spaceRow.activatedAt as any).toISOString() : null,
    };
    return NextResponse.json(body);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to load sidebar", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
