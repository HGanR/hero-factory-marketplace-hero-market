// Company Affiliations API - Create and manage affiliations with cross-entity validation
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { companies, companyAffiliations, trusts } from "@/lib/db/schema";
import { verifyToken } from "@/lib/auth";

async function getAuthedUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth-token")?.value ?? null;
  if (!token) return null;
  const payload = verifyToken(token);
  const userId = payload?.userId;
  return typeof userId === "number" ? userId : null;
}

const CreateAffiliationSchema = z.object({
  affiliationType: z.enum(["parent_subsidiary", "company_trust", "company_family_office", "company_foundation", "company_dao"]),
  subsidiaryCompanyId: z.string().uuid().optional(),
  trustId: z.string().uuid().optional(),
  familyOfficeId: z.string().uuid().optional(),
  foundationId: z.string().uuid().optional(),
  subsidiaryKind: z.enum(["operating", "ip_holdco", "real_estate", "other"]).optional(),
  ownershipPercentage: z.number().int().min(1).max(100).optional(),
  relationshipRole: z.string().max(100).optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest, ctx: { params: Promise<{ companyId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await ctx.params;
  if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

  const db = await getDb();

  // Verify the requesting company belongs to the user
  const companyCheck = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.userId, userId)))
    .limit(1);

  if (companyCheck.length === 0) {
    return NextResponse.json({ error: "Company not found or access denied" }, { status: 404 });
  }

  // Get all affiliations for this company
  const affiliations = await db
    .select()
    .from(companyAffiliations)
    .where(eq(companyAffiliations.parentCompanyId, companyId));

  return NextResponse.json({ affiliations });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ companyId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId } = await ctx.params;
  if (!companyId) return NextResponse.json({ error: "Missing companyId" }, { status: 400 });

  let body: z.infer<typeof CreateAffiliationSchema>;
  try {
    body = CreateAffiliationSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid body" }, { status: 400 });
  }

  const db = await getDb();

  // Step 1: Verify parent company exists and belongs to user
  const parentCompany = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.userId, userId)))
    .limit(1);

  if (parentCompany.length === 0) {
    return NextResponse.json({ error: "Parent company not found or access denied" }, { status: 404 });
  }

  // Step 2: Validate the target entity exists and belongs to the same user
  if (body.affiliationType === "parent_subsidiary" && body.subsidiaryCompanyId) {
    const subsidiaryCheck = await db
      .select()
      .from(companies)
      .where(and(eq(companies.id, body.subsidiaryCompanyId), eq(companies.userId, userId)))
      .limit(1);

    if (subsidiaryCheck.length === 0) {
      return NextResponse.json({ error: "Subsidiary company not found or access denied" }, { status: 404 });
    }

    // Check for existing affiliation (unique constraint)
    const existingAffiliation = await db
      .select()
      .from(companyAffiliations)
      .where(and(
        eq(companyAffiliations.parentCompanyId, companyId),
        eq(companyAffiliations.subsidiaryCompanyId, body.subsidiaryCompanyId)
      ))
      .limit(1);

    if (existingAffiliation.length > 0) {
      return NextResponse.json({ error: "Affiliation already exists between these companies" }, { status: 409 });
    }

  } else if (body.affiliationType === "company_trust" && body.trustId) {
    const trustCheck = await db
      .select()
      .from(trusts)
      .where(and(eq(trusts.id, body.trustId), eq(trusts.userId, userId)))
      .limit(1);

    if (trustCheck.length === 0) {
      return NextResponse.json({ error: "Trust not found or access denied" }, { status: 404 });
    }

    // Check for existing affiliation
    const existingAffiliation = await db
      .select()
      .from(companyAffiliations)
      .where(and(
        eq(companyAffiliations.parentCompanyId, companyId),
        eq(companyAffiliations.trustId, body.trustId)
      ))
      .limit(1);

    if (existingAffiliation.length > 0) {
      return NextResponse.json({ error: "Affiliation already exists between this company and trust" }, { status: 409 });
    }

  } else if (body.affiliationType === "company_family_office" && body.familyOfficeId) {
    // Family office affiliations - table not yet implemented
    return NextResponse.json({ error: "Family office affiliations not yet implemented" }, { status: 501 });
  } else if (body.affiliationType === "company_foundation" && body.foundationId) {
    // Foundation affiliations - table not yet implemented
    return NextResponse.json({ error: "Foundation affiliations not yet implemented" }, { status: 501 });
  } else if (body.affiliationType === "company_dao") {
    // DAO affiliations - table not yet implemented
    return NextResponse.json({ error: "DAO affiliations not yet implemented" }, { status: 501 });
  }

  // Step 3: Create the affiliation
  const affiliationId = crypto.randomUUID();

  await db.insert(companyAffiliations).values({
    id: affiliationId,
    userId, // Enforce ownership isolation
    affiliationType: body.affiliationType,
    parentCompanyId: companyId,
    subsidiaryCompanyId: body.subsidiaryCompanyId,
    trustId: body.trustId,
    familyOfficeId: body.familyOfficeId,
    foundationId: body.foundationId,
    subsidiaryKind: body.subsidiaryKind,
    ownershipPercentage: body.ownershipPercentage ?? 100,
    relationshipRole: body.relationshipRole,
    notes: body.notes,
    createdBy: userId,
  });

  return NextResponse.json({
    affiliation: {
      id: affiliationId,
      affiliationType: body.affiliationType,
      parentCompanyId: companyId,
    }
  }, { status: 201 });
}
