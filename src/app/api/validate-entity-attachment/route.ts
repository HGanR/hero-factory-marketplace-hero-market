import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkEntityEligibility, EntityType } from "@/lib/entityEligibility";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trusts } from "@/lib/db/schema";

const ValidateEntityAttachmentSchema = z.object({
  trustId: z.string(),
  entityType: z.enum(["c_corporation", "s_corporation", "llc", "lp", "llp"]),
});

/**
 * API Endpoint: Validate Entity Attachment
 *
 * Validates whether a trust can legally own/attach a specific entity type
 * Enforces canonical trust taxonomy rules at the API level
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { trustId, entityType } = ValidateEntityAttachmentSchema.parse(body);

    // Fetch trust from database
    const dbInstance = await getDb();
    const trust = await dbInstance
      .select({
        id: trusts.id,
        trustCategory: trusts.trustCategory,
        moduleType: trusts.moduleType,
        formationMode: trusts.formationMode,
        commercialEnabled: trusts.commercialEnabled,
        governanceMode: trusts.governanceMode,
        sCorpEligible: trusts.sCorpEligible,
        trustSubtype: trusts.trustSubtype,
        irsElectionConfirmed: trusts.irsElectionConfirmed,
        userId: trusts.userId,
      })
      .from(trusts)
      .where(eq(trusts.id, trustId))
      .limit(1);

    if (!trust.length) {
      return NextResponse.json({ error: "Trust not found" }, { status: 404 });
    }

    const trustRecord = trust[0];

    // Verify ownership
    if (trustRecord.userId !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Build trust classification object for validation
    const trustClassification = {
      trustCategory: trustRecord.trustCategory || "private",
      moduleType: trustRecord.moduleType || "special_purpose_trust", // Default fallback
      formationMode: trustRecord.formationMode || "express",
      commercialEnabled: trustRecord.commercialEnabled || false,
      governanceMode: trustRecord.governanceMode || "simple",
      sCorpEligible: trustRecord.sCorpEligible || false,
      trustSubtype: trustRecord.trustSubtype || "standard",
      irsElectionConfirmed: trustRecord.irsElectionConfirmed || false,
    };

    // Validate entity attachment
    const validation = checkEntityEligibility(trustClassification, entityType);

    return NextResponse.json({
      valid: validation.eligible,
      entityType,
      trustId,
      trustClassification,
      validation: {
        eligible: validation.eligible,
        reason: validation.reason,
        requirements: validation.requirements,
        warnings: validation.warnings,
      },
    });

  } catch (error) {
    console.error("Entity attachment validation error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to retrieve entity attachment rules for a trust
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const trustId = searchParams.get("trustId");

    if (!trustId) {
      return NextResponse.json({ error: "trustId parameter required" }, { status: 400 });
    }

    // Fetch trust from database
    const dbInstance = await getDb();
    const trust = await dbInstance
      .select({
        id: trusts.id,
        trustCategory: trusts.trustCategory,
        moduleType: trusts.moduleType,
        formationMode: trusts.formationMode,
        commercialEnabled: trusts.commercialEnabled,
        governanceMode: trusts.governanceMode,
        sCorpEligible: trusts.sCorpEligible,
        trustSubtype: trusts.trustSubtype,
        irsElectionConfirmed: trusts.irsElectionConfirmed,
        userId: trusts.userId,
      })
      .from(trusts)
      .where(eq(trusts.id, trustId))
      .limit(1);

    if (!trust.length) {
      return NextResponse.json({ error: "Trust not found" }, { status: 404 });
    }

    const trustRecord = trust[0];

    // Verify ownership
    if (trustRecord.userId !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Build trust classification object
    const trustClassification = {
      trustCategory: trustRecord.trustCategory || "private",
      moduleType: trustRecord.moduleType || "special_purpose_trust",
      formationMode: trustRecord.formationMode || "express",
      commercialEnabled: trustRecord.commercialEnabled || false,
      governanceMode: trustRecord.governanceMode || "simple",
      sCorpEligible: trustRecord.sCorpEligible || false,
      trustSubtype: trustRecord.trustSubtype || "standard",
      irsElectionConfirmed: trustRecord.irsElectionConfirmed || false,
    };

    // Get all entity eligibility checks
    const entityTypes: EntityType[] = ["c_corporation", "s_corporation", "llc", "lp", "llp"];
    const eligibilityChecks = entityTypes.map(entityType => ({
      entityType,
      validation: checkEntityEligibility(trustClassification, entityType),
    }));

    return NextResponse.json({
      trustId,
      trustClassification,
      entityEligibility: eligibilityChecks,
    });

  } catch (error) {
    console.error("Entity attachment rules error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}