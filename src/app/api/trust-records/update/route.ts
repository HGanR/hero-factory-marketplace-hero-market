import { NextResponse } from "next/server";
import { TrustRecordUpdateSchema } from "@/lib/trust/schemas";
import { getDb } from "@/lib/db";
import { trusts, trustRecordRoles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

export async function POST(req: Request) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ ok: false, error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const body = await req.json();
    const parsed = TrustRecordUpdateSchema.parse(body);

    const db = await getDb();

    // Check user role - only Managers can update trust records
    const roleRows = await db.select().from(trustRecordRoles).where(eq(trustRecordRoles.userId, userId)).limit(1);
    const role = (roleRows[0]?.role ?? "Manager") as "Manager" | "Trustee";
    if (role !== "Manager") {
      return NextResponse.json({ ok: false, error: { message: "Forbidden (Manager role required)", code: "FORBIDDEN" } }, { status: 403 });
    }

    // Verify trust ownership
    const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, parsed.trustId), eq(trusts.userId, userId))).limit(1);
    if (trustRows.length === 0) {
      return NextResponse.json({ ok: false, error: { message: "Trust not found", code: "NOT_FOUND" } }, { status: 404 });
    }

    // NOTE: In private_safe, do NOT require governingState/situsState and never set defaults.
    // We simply persist what user provided (or null).

    await db.update(trusts).set({
      ...(parsed.name ? { name: parsed.name } : {}),
      ...(parsed.trustMode ? { trustMode: parsed.trustMode } : {}),
      governingLawState: parsed.governingState ?? null,
      situsState: parsed.situsState ?? null,
      executedAt: parsed.executedAt ? new Date(parsed.executedAt) : undefined,
    }).where(eq(trusts.id, parsed.trustId));

    // Fetch the updated trust record
    const updatedRows = await db.select({
      id: trusts.id,
      publicId: trusts.publicId,
      name: trusts.name,
      trustMode: trusts.trustMode,
      governingLawState: trusts.governingLawState,
      situsState: trusts.situsState,
      executedAt: trusts.executedAt,
      updatedAt: trusts.updatedAt,
    }).from(trusts).where(eq(trusts.id, parsed.trustId)).limit(1);

    return NextResponse.json({ ok: true, trust: updatedRows[0] });
  } catch (err: any) {
    const error = {
      message: err.message || "Update failed",
      code: err.code || "INTERNAL_ERROR"
    };
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
