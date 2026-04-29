import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/lib/db";
import { oasisEvents, oasisSpaces } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

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

async function ensureEventsTable(db: Awaited<ReturnType<typeof getDb>>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS oasis_events (
      id VARCHAR(80) PRIMARY KEY,
      spaceId VARCHAR(80) NOT NULL,
      type ENUM('SPACE_ACTIVATED') NOT NULL,
      actorWallet VARCHAR(140) NULL,
      metadata JSON NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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

export async function POST(req: NextRequest, ctx: { params: Promise<{ spaceId: string }> }) {
  const spaceId = (await ctx.params).spaceId;
  if (!spaceId) return NextResponse.json({ error: "spaceId is required" }, { status: 400 });

  try {
    const origin = req.nextUrl.origin;
    const cookie = req.headers.get("cookie");

    const readiness = await fetchJson(`${origin}/api/oasis/spaces/${spaceId}/readiness`, cookie);
    if (readiness?.status !== "READY") {
      return NextResponse.json({ error: "Space not ready", readiness }, { status: 409 });
    }

    const ownership = await fetchJson(`${origin}/api/oasis/spaces/${spaceId}/ownership`, cookie);
    if (!ownership?.isOwner && !ownership?.isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = await getDb();
    await ensureSpacesTable(db);
    await ensureEventsTable(db);

    const activatedAt = new Date();
    const readinessHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(readiness ?? {}))
      .digest("hex");

    const { existingActivatedAt } = await db.transaction(async (tx) => {
      const existing = (
        await tx.select().from(oasisSpaces).where(eq(oasisSpaces.id, spaceId)).limit(1)
      )[0];

      if (!existing) {
        await tx.insert(oasisSpaces).values({
          id: spaceId,
          status: "ACTIVE",
          activatedAt,
        });
      } else if (existing.status !== "ACTIVE") {
        await tx
          .update(oasisSpaces)
          .set({ status: "ACTIVE", activatedAt })
          .where(eq(oasisSpaces.id, spaceId));
      }

      if (!existing || existing.status !== "ACTIVE") {
        await tx.insert(oasisEvents).values({
          id: crypto.randomUUID(),
          spaceId,
          type: "SPACE_ACTIVATED",
          actorWallet: ownership?.viewerWallet ?? null,
          metadata: {
            activatedAt: activatedAt.toISOString(),
            templateId: readiness?.templateId ?? null,
            readinessHash,
          },
          createdAt: activatedAt,
        });
      }

      return {
        existingActivatedAt: existing?.activatedAt ?? null,
      };
    });

    const finalActivatedAt = existingActivatedAt ? new Date(existingActivatedAt as any) : activatedAt;
    return NextResponse.json({
      spaceId,
      status: "ACTIVE",
      activatedAt: finalActivatedAt.toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to activate space", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
