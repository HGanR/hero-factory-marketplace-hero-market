import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";
import { evaluateOfferingRules } from "@/lib/ppm/rules";
import type { Offering, TrustProfile } from "@/lib/ppm/types";

const CreateOfferingSchema = z.object({
  type: z.enum(["private_placement", "subscription_note", "membership_units", "donation_program"]),
  name: z.string().min(1).max(200),
  targetAmount: z.string().optional(),
  pricePerUnit: z.string().optional(),
  interestRateBps: z.number().int().min(0).max(10000).optional(),
  maturityDate: z.string().optional(),
});

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

async function getTrustProfile(trustId: string): Promise<TrustProfile | null> {
  const db = await getDb();
  const trustRows = await db
    .select({
      trustKind: trusts.trustType,
      jurisdictionState: trusts.jurisdictionState,
      status: trusts.workspaceStatus,
      updatedAt: trusts.updatedAt,
    })
    .from(trusts)
    .where(eq(trusts.id, trustId))
    .limit(1);

  if (trustRows.length === 0) return null;

  const row = trustRows[0];
  const profile: TrustProfile = {
    trustKind: row.trustKind,
    jurisdictionState: row.jurisdictionState,
    taxClassification: "unknown", // Not in schema
    isCharitable: false, // Not in schema
    isFoundation: false, // Not in schema
    hasEIN: false, // Not in schema
    einLast4: null, // Not in schema
    executedAt: row.status === "executed" ? row.updatedAt?.toISOString() || null : null,
    status: row.status || "draft",
  };

  return profile;
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId || trustId.length < 10) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  let body: z.infer<typeof CreateOfferingSchema>;
  try {
    body = CreateOfferingSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const db = await getDb();

  // Verify trust ownership and get profile
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const profile = await getTrustProfile(trustId);
  if (!profile) return NextResponse.json({ error: "Trust profile not found" }, { status: 404 });

  // Evaluate rules for this trust
  const rules = evaluateOfferingRules(profile);

  // Check if offering type is allowed
  if (!rules.allowedOfferingTypes.includes(body.type)) {
    return NextResponse.json({
      error: `Offering type not allowed for this trust type. Allowed: ${rules.allowedOfferingTypes.join(", ")}`
    }, { status: 400 });
  }

  const offeringId = crypto.randomUUID();
  const now = new Date().toISOString();

  const offering: Offering = {
    id: offeringId,
    trustId,
    type: body.type,
    name: body.name,
    status: "draft",
    targetAmount: body.targetAmount,
    pricePerUnit: body.pricePerUnit,
    interestRateBps: body.interestRateBps,
    maturityDate: body.maturityDate,
    requiresPPM: rules.requiresPPM,
    requiresAccreditedOnly: rules.showAccreditedFlow,
    createdAt: now,
    updatedAt: now,
  };

  // TODO: Save offering to database (you'll need to add an offerings table to schema.ts)
  // For now, return the offering data
  console.log("Would save offering:", offering);

  return NextResponse.json({
    offeringId,
    status: offering.status,
    requiresPPM: offering.requiresPPM,
    rules,
  });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ trustId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await ctx.params;
  if (!trustId || trustId.length < 10) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

  const db = await getDb();

  // Verify trust ownership
  const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  // TODO: Fetch offerings from database
  // For now, return empty array
  return NextResponse.json({ offerings: [] });
}
