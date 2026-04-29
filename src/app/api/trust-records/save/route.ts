import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { trustDrafts, trusts, trustRecordRoles, trustRecordStates } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

const BodySchema = z.object({
  trustId: z.string().min(10).optional(),
  state: z.unknown(),
});

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

export async function POST(request: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const db = await getDb();

  const roleRows = await db.select().from(trustRecordRoles).where(eq(trustRecordRoles.userId, userId)).limit(1);
  const role = (roleRows[0]?.role ?? "Manager") as "Manager" | "Trustee";
  if (role !== "Manager") {
    return NextResponse.json({ error: "Forbidden (Manager role required)" }, { status: 403 });
  }

  const stateJson = JSON.stringify(body.state ?? null);

  // Compatibility wrapper:
  // - ensure we have a canonical trustId
  // - append a versioned draft row
  let trustId = body.trustId;
  if (!trustId) {
    trustId = crypto.randomUUID();
    await db.insert(trusts).values({ id: trustId, userId, status: "draft", source: "trust-records" } as any);
  } else {
    // Enforce ownership if provided.
    const rows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
    if (rows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });
  }

  const { nextVersion } = await db.transaction(async (tx) => {
    const maxRows = await tx
      .select({ maxV: sql<number>`max(${trustDrafts.version})` })
      .from(trustDrafts)
      .where(and(eq(trustDrafts.trustId, trustId!), eq(trustDrafts.draftType, "trust-records-state")))
      .limit(1);
    const nextVersion = Number(maxRows[0]?.maxV ?? 0) + 1;
    await tx.insert(trustDrafts).values({
      id: crypto.randomUUID(),
      trustId: trustId!,
      draftType: "trust-records-state",
      schemaVersion: 1,
      version: nextVersion,
      payloadJson: stateJson,
    } as any);
    // Touch parent for updatedAt
    await tx.update(trusts).set({ source: "trust-records" } as any).where(eq(trusts.id, trustId!));
    return { nextVersion };
  });

  // Legacy persistence (transition window). Kept so existing reads continue to work.
  const existing = await db.select().from(trustRecordStates).where(eq(trustRecordStates.userId, userId)).limit(1);
  if (existing.length === 0) {
    await db.insert(trustRecordStates).values({ userId, stateJson } as any);
  } else {
    await db.update(trustRecordStates).set({ stateJson } as any).where(eq(trustRecordStates.userId, userId));
  }

  return NextResponse.json({ success: true, trustId, draftVersion: nextVersion });
}












