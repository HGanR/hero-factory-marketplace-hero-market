import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { trustDrafts, trustRecordRoles, trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const BodySchema = z.object({
  signatureSealDataUrl: z.string().min(20),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ trustId: string; certificateId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId, certificateId } = await ctx.params;
  if (!trustId || !certificateId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid body" }, { status: 400 });
  }

  // Very basic safety cap (data URL length). This is not perfect but prevents accidental megabytes.
  if (body.signatureSealDataUrl.length > 350_000) {
    return NextResponse.json({ error: "Seal image too large. Please upload a smaller image." }, { status: 413 });
  }

  const db = await getDb();

  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const roleRows = await db.select().from(trustRecordRoles).where(eq(trustRecordRoles.userId, userId)).limit(1);
  const role = (roleRows[0]?.role ?? "Manager") as "Manager" | "Trustee";
  if (role !== "Trustee") return NextResponse.json({ error: "Forbidden (Trustee role required)" }, { status: 403 });

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
  if (!cert?.signedBy) {
    return NextResponse.json({ error: "Seal upload requires an existing signature" }, { status: 409 });
  }

  certs[idx] = { ...cert, signatureSealDataUrl: body.signatureSealDataUrl };
  state.certificates = certs;

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




