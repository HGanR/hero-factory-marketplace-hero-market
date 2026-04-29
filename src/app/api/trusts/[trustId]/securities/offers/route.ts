import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
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

const CreateSchema = z.object({
  offeringName: z.string().min(3).max(255),
  securityType: z.enum(["debt", "participation", "equity_like"]),
  exemptionTag: z.enum(["506b", "506c", "other"]),
  draft: z.unknown().optional(),
});

export async function GET(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  // Securities module is admin/counsel only for now. Counsel can be added later as a first-class role.
  if (!requireAdmin(request)) return NextResponse.json({ error: "Securities Module disabled" }, { status: 403 });

  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { trustId } = await ctx.params;

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
    .where(eq(securityOfferings.trustId, trustId))
    .orderBy(sql`createdAt desc`)
    .limit(100);

  return NextResponse.json({
    trustId,
    items: rows.map((r: any) => ({
      id: String(r.id),
      trustId: String(r.trustId),
      status: r.status,
      offeringName: String(r.offeringName),
      securityType: r.securityType,
      exemptionTag: String(r.exemptionTag),
      counselApproved: Boolean(r.counselApproved),
      createdAt: r.createdAt ? new Date(r.createdAt as any).toISOString() : null,
      updatedAt: r.updatedAt ? new Date(r.updatedAt as any).toISOString() : null,
    })),
  });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  if (!requireAdmin(request)) return NextResponse.json({ error: "Securities Module disabled" }, { status: 403 });

  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { trustId } = await ctx.params;

  let body: z.infer<typeof CreateSchema>;
  try {
    body = CreateSchema.parse(await request.json());
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

  const id = crypto.randomUUID();
  const draft = body.draft ?? {
    issuer: { trustName: null, governingLaw: null },
    securityType: body.securityType,
    exemptionTag: body.exemptionTag,
    offeringName: body.offeringName,
    aggregateAmountOrFormula: "",
    paymentTerms: { type: "fixed", details: "" },
    transferRestrictions: { restricted: true, trusteeConsentRequired: true },
    legends: { text: "RESTRICTED SECURITIES. NO RESALE ABSENT REGISTRATION OR EXEMPTION." },
    backingAssets: { assetIds: [], valuationApproach: "internal", valuationMemoDocClass: "private" },
    approvals: { requireAttestation: true, attestationName: "", attestedAt: null },
    package: { includePPM: true, includeSubscription: true, includeSpecimen: true, includeRiskAnnex: true },
    custody: { mode: "holder_possession", custodianName: "" },
    finalize: { counselApproved: false, holderName: "", possessionAcknowledged: false },
  };

  await db.insert(securityOfferings).values({
    id,
    trustId,
    status: "draft",
    offeringName: body.offeringName,
    securityType: body.securityType,
    exemptionTag: body.exemptionTag,
    counselApproved: false,
    draftJson: JSON.stringify(draft),
  } as any);

  return NextResponse.json({ trustId, offeringId: id });
}


