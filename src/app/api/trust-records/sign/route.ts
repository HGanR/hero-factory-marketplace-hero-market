import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { trustRecordRoles, trustRecordStates } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

const BodySchema = z.object({
  certificateId: z.string().min(1),
});

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

export async function POST(request: NextRequest) {
  const authed = await getAuthedUser();
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const db = await getDb();

  const roleRows = await db.select().from(trustRecordRoles).where(eq(trustRecordRoles.userId, authed.userId)).limit(1);
  const role = (roleRows[0]?.role ?? "Manager") as "Manager" | "Trustee";
  if (role !== "Trustee") {
    return NextResponse.json({ error: "Forbidden (Trustee role required)" }, { status: 403 });
  }

  const stateRows = await db.select().from(trustRecordStates).where(eq(trustRecordStates.userId, authed.userId)).limit(1);
  if (stateRows.length === 0) return NextResponse.json({ error: "No trust record state found" }, { status: 404 });

  let state: any;
  try {
    state = JSON.parse(stateRows[0].stateJson);
  } catch {
    return NextResponse.json({ error: "Corrupt trust record state JSON" }, { status: 500 });
  }

  const certs: any[] = Array.isArray(state?.certificates) ? state.certificates : [];
  const idx = certs.findIndex((c) => c?.id === body.certificateId);
  if (idx === -1) return NextResponse.json({ error: "Certificate not found" }, { status: 404 });

  const cert = certs[idx];
  const signedAt = new Date().toISOString();
  const signer = authed.username || `user_${authed.userId}`;
  const secret = process.env.JWT_SECRET || "fallback-secret";

  const signatureHash = sha256Hex(`${cert.documentHash}:${authed.userId}:${signedAt}:${secret}`);

  certs[idx] = {
    ...cert,
    signedBy: signer,
    signedAt,
    signatureHint: "Server-attested signature (demo)",
    signatureHash,
  };

  state.certificates = certs;
  await db.update(trustRecordStates).set({ stateJson: JSON.stringify(state) } as any).where(eq(trustRecordStates.userId, authed.userId));

  return NextResponse.json({ success: true, signedBy: signer, signedAt, signatureHash });
}














