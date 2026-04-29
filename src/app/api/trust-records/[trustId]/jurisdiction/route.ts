import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { trusts, trustRecordRoles } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

const JurisdictionUpdateSchema = z.object({
  situsStateCode: z.string().min(2).max(2), // e.g., "NV"
  objective: z.enum(["ASSET_PROTECTION", "STATE_TAX_MINIMIZATION", "DIGITAL_ASSET_FIDUCIARY_ACCESS"]),
  selfSettled: z.boolean(),
  hasDigitalAssets: z.boolean(),
  score: z.number().int().min(0),
  reasons: z.array(z.string()),
});

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ trustId: string }> }
) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ ok: false, error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const body = await req.json();
    const parsed = JurisdictionUpdateSchema.parse(body);

    const resolvedParams = await params;
    const db = await getDb();

    // Check user role - only Managers can update jurisdiction
    const roleRows = await db.select().from(trustRecordRoles).where(eq(trustRecordRoles.userId, userId)).limit(1);
    const role = (roleRows[0]?.role ?? "Manager") as "Manager" | "Trustee";
    if (role !== "Manager") {
      return NextResponse.json({ ok: false, error: { message: "Forbidden (Manager role required)", code: "FORBIDDEN" } }, { status: 403 });
    }

    // Verify trust ownership
    const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, resolvedParams.trustId), eq(trusts.userId, userId))).limit(1);
    if (trustRows.length === 0) {
      return NextResponse.json({ ok: false, error: { message: "Trust not found", code: "NOT_FOUND" } }, { status: 404 });
    }

    // Update jurisdiction fields
    await db.update(trusts).set({
      jurisdictionStateCode: parsed.situsStateCode,
      jurisdictionObjective: parsed.objective,
      jurisdictionHasDigitalAssets: parsed.hasDigitalAssets,
      jurisdictionSelfSettled: parsed.selfSettled,
      jurisdictionScoreSnapshot: parsed.score,
      jurisdictionReasonsSnapshot: JSON.stringify(parsed.reasons),
      jurisdictionSelectedAt: new Date(),
      jurisdictionSelectedByUserId: userId,
    }).where(eq(trusts.id, resolvedParams.trustId));

    // Fetch the updated trust record
    const updatedRows = await db.select({
      id: trusts.id,
      jurisdictionStateCode: trusts.jurisdictionStateCode,
      jurisdictionObjective: trusts.jurisdictionObjective,
      jurisdictionHasDigitalAssets: trusts.jurisdictionHasDigitalAssets,
      jurisdictionSelfSettled: trusts.jurisdictionSelfSettled,
      jurisdictionScoreSnapshot: trusts.jurisdictionScoreSnapshot,
      jurisdictionReasonsSnapshot: trusts.jurisdictionReasonsSnapshot,
      jurisdictionSelectedAt: trusts.jurisdictionSelectedAt,
      jurisdictionSelectedByUserId: trusts.jurisdictionSelectedByUserId,
    }).from(trusts).where(eq(trusts.id, resolvedParams.trustId)).limit(1);

    return NextResponse.json({ ok: true, trust: updatedRows[0] });
  } catch (err: any) {
    const error = {
      message: err.message || "Jurisdiction update failed",
      code: err.code || "INTERNAL_ERROR"
    };
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ trustId: string }> }
) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ ok: false, error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const resolvedParams = await params;
    const db = await getDb();

    // Verify trust ownership
    const trustRows = await db.select({
      id: trusts.id,
      jurisdictionStateCode: trusts.jurisdictionStateCode,
      jurisdictionObjective: trusts.jurisdictionObjective,
      jurisdictionHasDigitalAssets: trusts.jurisdictionHasDigitalAssets,
      jurisdictionSelfSettled: trusts.jurisdictionSelfSettled,
      jurisdictionScoreSnapshot: trusts.jurisdictionScoreSnapshot,
      jurisdictionReasonsSnapshot: trusts.jurisdictionReasonsSnapshot,
      jurisdictionSelectedAt: trusts.jurisdictionSelectedAt,
      jurisdictionSelectedByUserId: trusts.jurisdictionSelectedByUserId,
    }).from(trusts).where(and(eq(trusts.id, resolvedParams.trustId), eq(trusts.userId, userId))).limit(1);

    if (trustRows.length === 0) {
      return NextResponse.json({ ok: false, error: { message: "Trust not found", code: "NOT_FOUND" } }, { status: 404 });
    }

    const trust = trustRows[0];
    const jurisdiction = trust.jurisdictionStateCode ? {
      situsStateCode: trust.jurisdictionStateCode,
      objective: trust.jurisdictionObjective,
      hasDigitalAssets: trust.jurisdictionHasDigitalAssets,
      selfSettled: trust.jurisdictionSelfSettled,
      score: trust.jurisdictionScoreSnapshot,
      reasons: trust.jurisdictionReasonsSnapshot ? JSON.parse(trust.jurisdictionReasonsSnapshot) : [],
      selectedAt: trust.jurisdictionSelectedAt,
      selectedByUserId: trust.jurisdictionSelectedByUserId,
    } : null;

    return NextResponse.json({ ok: true, jurisdiction });
  } catch (err: any) {
    const error = {
      message: err.message || "Failed to fetch jurisdiction",
      code: err.code || "INTERNAL_ERROR"
    };
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}