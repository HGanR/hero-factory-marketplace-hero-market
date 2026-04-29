import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { trustDrafts, trustRecordRoles, trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUser(): Promise<{ userId: number; username?: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  if (typeof userId !== "number") return null;
  const username = typeof payload?.username === "string" ? payload.username : undefined;
  return { userId, username };
}

function sha256Hex(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ trustId: string; certificateId: string }> }) {
  const authed = await getAuthedUser();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId, certificateId } = await ctx.params;
  if (!trustId || !certificateId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const db = await getDb();

  // Trust must belong to user
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, authed.userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  // Trustee-only
  const roleRows = await db.select().from(trustRecordRoles).where(eq(trustRecordRoles.userId, authed.userId)).limit(1);
  const role = (roleRows[0]?.role ?? "Manager") as "Manager" | "Trustee";
  if (role !== "Trustee") return NextResponse.json({ error: "Forbidden (Trustee role required)" }, { status: 403 });

  // Load latest trust-records draft
  const draftRows = await db
    .select()
    .from(trustDrafts)
    .where(and(eq(trustDrafts.trustId, trustId), eq(trustDrafts.draftType, "trust-records-state")))
    .orderBy(sql`version desc`)
    .limit(1);
  if (draftRows.length === 0) return NextResponse.json({ error: "No trust-records draft found" }, { status: 404 });

  let state: any;
  try {
    state = JSON.parse(String((draftRows[0] as any).payloadJson ?? "null"));
  } catch {
    return NextResponse.json({ error: "Corrupt draft payload" }, { status: 500 });
  }

  const certs: any[] = Array.isArray(state?.certificates) ? state.certificates : [];
  const idx = certs.findIndex((c) => c?.id === certificateId);
  if (idx === -1) return NextResponse.json({ error: "Certificate not found" }, { status: 404 });

  const cert = certs[idx];
  const signedAt = new Date().toISOString();
  const signer = authed.username || `user_${authed.userId}`;
  const secret = process.env.JWT_SECRET || "fallback-secret";
  const signatureHash = sha256Hex(`${String(cert.documentHash || "")}:${authed.userId}:${signedAt}:${secret}`);

  certs[idx] = {
    ...cert,
    signedBy: signer,
    signedAt,
    signatureHint: "Server-attested signature (demo)",
    signatureHash,
  };
  state.certificates = certs;

  // Append draft version
  const nextVersion = Number((draftRows[0] as any).version ?? 0) + 1;
  await db.insert(trustDrafts).values({
    id: crypto.randomUUID(),
    trustId,
    draftType: "trust-records-state",
    schemaVersion: 1,
    version: nextVersion,
    payloadJson: JSON.stringify(state),
  } as any);

  return NextResponse.json({ success: true, trustId, version: nextVersion, state });
}




