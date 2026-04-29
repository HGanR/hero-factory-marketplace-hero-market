import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { securityOfferings, trustControls, trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded?.isAdmin) return null;
  return decoded;
}

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const PatchSchema = z.object({
  draft: z.unknown().optional(),
  counselApproved: z.boolean().optional(),
  status: z.enum(["draft", "finalized", "cancelled", "error"]).optional(),
});

export async function GET(request: NextRequest, ctx: { params: Promise<{ trustId: string; offeringId: string }> }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Securities Module disabled" }, { status: 403 });
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId, offeringId } = await ctx.params;
  const db = await getDb();

  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const controlRows = await db.select().from(trustControls).where(eq(trustControls.trustId, trustId)).limit(1);
  if (!controlRows[0]?.securitiesEnabled) {
    return NextResponse.json({ error: "Securities Module not enabled for this trust" }, { status: 403 });
  }

  const rows = await db
    .select()
    .from(securityOfferings)
    .where(and(eq(securityOfferings.id, offeringId), eq(securityOfferings.trustId, trustId)))
    .limit(1);
  if (rows.length === 0) return NextResponse.json({ error: "Offering not found" }, { status: 404 });

  const r: any = rows[0];
  let draft: unknown = null;
  try {
    draft = JSON.parse(String(r.draftJson ?? "null"));
  } catch {
    draft = null;
  }

  return NextResponse.json({
    trustId,
    offering: {
      id: String(r.id),
      status: r.status,
      offeringName: String(r.offeringName),
      securityType: r.securityType,
      exemptionTag: String(r.exemptionTag),
      counselApproved: Boolean(r.counselApproved),
      draft,
    },
  });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ trustId: string; offeringId: string }> }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Securities Module disabled" }, { status: 403 });
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId, offeringId } = await ctx.params;
  let body: z.infer<typeof PatchSchema>;
  try {
    body = PatchSchema.parse(await request.json());
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Invalid body" }, { status: 400 });
  }

  const db = await getDb();
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const controlRows = await db.select().from(trustControls).where(eq(trustControls.trustId, trustId)).limit(1);
  if (!controlRows[0]?.securitiesEnabled) {
    return NextResponse.json({ error: "Securities Module not enabled for this trust" }, { status: 403 });
  }

  const rows = await db
    .select()
    .from(securityOfferings)
    .where(and(eq(securityOfferings.id, offeringId), eq(securityOfferings.trustId, trustId)))
    .limit(1);
  if (rows.length === 0) return NextResponse.json({ error: "Offering not found" }, { status: 404 });

  await db
    .update(securityOfferings)
    .set({
      draftJson: body.draft ? JSON.stringify(body.draft) : (rows[0] as any).draftJson,
      counselApproved: typeof body.counselApproved === "boolean" ? body.counselApproved : (rows[0] as any).counselApproved,
      status: body.status ?? (rows[0] as any).status,
    } as any)
    .where(eq(securityOfferings.id, offeringId));

  return NextResponse.json({ success: true });
}


