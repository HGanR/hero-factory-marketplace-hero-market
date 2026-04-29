import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { isMigrationAllowed } from "@/lib/features";
import { getDb } from "@/lib/db";
import { trusts, trustResolutions, minutes, resolutions } from "@/lib/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { migrateTrustTaxonomy, mapLegacyToCanonical } from "@/lib/migrations/trust-taxonomy-migration";

const MigrationRequestSchema = z.object({
  mode: z.enum(["dryRun", "apply", "rollback"]).default("dryRun"),
  scope: z.enum(["all", "trustIds", "clientId", "entityId"]).default("all"),
  trustIds: z.array(z.string()).optional(),
  clientId: z.string().optional(),
  entityId: z.string().optional(),
  limit: z.number().min(1).max(1000).default(100),
  cursor: z.string().optional(),
  force: z.boolean().default(false), // Override safety checks
});

type MigrationRequest = z.infer<typeof MigrationRequestSchema>;
type MigrationResult = {
  scanned: number;
  wouldUpdate: number;
  updated: number;
  skipped: number;
  errors: Array<{ trustId: string; error: string }>;
  nextCursor?: string;
  hasMore: boolean;
  diffs: Array<{
    trustId: string;
    before: any;
    after: any;
    taxonomySource: string;
  }>;
};

type TaxonomySource = "inferred" | "explicit" | "migrated";

/**
 * Check for governance artifacts that indicate complex governance
 */
async function checkGovernanceArtifacts(trustId: string, dbInstance: any): Promise<boolean> {
  try {
    // Check for trust resolutions - direct governance artifacts
    const resolutionCount = await dbInstance
      .select({ count: sql<number>`count(*)` })
      .from(trustResolutions)
      .where(eq(trustResolutions.trustId, trustId));

    if (resolutionCount[0]?.count > 0) {
      return true;
    }

    // For now, we'll only check trustResolutions as the primary indicator
    // Minutes and resolutions require more complex joins through minuteBooks
    // This can be expanded later if needed

    return false;
  } catch (error) {
    console.warn(`Error checking governance artifacts for trust ${trustId}:`, error);
    return false;
  }
}

/**
 * Rollback taxonomy fields to null for trusts that were inferred
 * This provides a safe emergency rollback mechanism
 */
async function rollbackTaxonomyInferences(trustIds: string[], dbInstance: any): Promise<{
  rolledBack: number;
  skipped: number;
  errors: Array<{ trustId: string; error: string }>;
}> {
  const result = {
    rolledBack: 0,
    skipped: 0,
    errors: [] as Array<{ trustId: string; error: string }>
  };

  for (const trustId of trustIds) {
    try {
      // Only rollback trusts that were inferred by migration
      const trust = await dbInstance
        .select({
          id: trusts.id,
          taxonomySource: trusts.taxonomySource,
          trustCategory: trusts.trustCategory,
          formationMode: trusts.formationMode,
          governanceMode: trusts.governanceMode,
          commercialEnabled: trusts.commercialEnabled,
        })
        .from(trusts)
        .where(eq(trusts.id, trustId))
        .limit(1);

      if (!trust[0]) {
        result.errors.push({ trustId, error: 'Trust not found' });
        continue;
      }

      const trustRecord = trust[0];

      // Only rollback if it was inferred by migration
      if (trustRecord.taxonomySource === 'migration_inference') {
        const rollbackUpdates: any = {};

        // Clear inferred taxonomy fields back to null
        if (trustRecord.trustCategory) rollbackUpdates.trustCategory = null;
        if (trustRecord.formationMode) rollbackUpdates.formationMode = null;
        if (trustRecord.governanceMode !== undefined) rollbackUpdates.governanceMode = null;
        if (trustRecord.commercialEnabled !== undefined) rollbackUpdates.commercialEnabled = null;

        // Clear metadata
        rollbackUpdates.taxonomySource = null;
        rollbackUpdates.taxonomyInferredAt = null;

        if (Object.keys(rollbackUpdates).length > 0) {
          await dbInstance
            .update(trusts)
            .set(rollbackUpdates)
            .where(eq(trusts.id, trustId));

          result.rolledBack++;
          console.log(`Rolled back taxonomy inference for trust ${trustId}`);
        } else {
          result.skipped++;
        }
      } else {
        result.skipped++;
        console.log(`Skipped rollback for trust ${trustId} (source: ${trustRecord.taxonomySource})`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push({ trustId, error: errorMessage });
      console.error(`Failed to rollback trust ${trustId}:`, error);
    }
  }

  return result;
}

/**
 * Safe backfill rules for taxonomy migration using the updated migration logic
 */
async function inferTaxonomyValues(trust: any, dbInstance: any): Promise<{
  updates: any;
  taxonomySource: string;
}> {
  // Use the updated migration logic that checks for governance artifacts
  const updates = await mapLegacyToCanonical(trust, dbInstance);
  const taxonomySource = updates.taxonomySource || 'migration_inference';

  // Remove metadata fields from updates (they're handled by mapLegacyToCanonical)
  const { taxonomySource: _, taxonomyInferredAt: __, ...cleanUpdates } = updates;

  return { updates: cleanUpdates, taxonomySource };
}

/**
 * Admin API: Migrate Trust Taxonomy (Enhanced)
 *
 * Supports dry-run, paging, selective migration, and comprehensive logging.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check feature flag
    if (!isMigrationAllowed()) {
      return NextResponse.json({
        error: "Taxonomy migration is disabled. Enable TAXONOMY_MIGRATION feature flag."
      }, { status: 403 });
    }

    const body = await request.json();
    const params = MigrationRequestSchema.parse(body);

    console.log(`Starting trust taxonomy operation: mode=${params.mode}, scope=${params.scope}`);

    const dbInstance = await getDb();
    const result: MigrationResult = {
      scanned: 0,
      wouldUpdate: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      hasMore: false,
      diffs: []
    };

    // Handle rollback mode
    if (params.mode === "rollback") {
      if (params.scope !== "trustIds" || !params.trustIds?.length) {
        return NextResponse.json({
          error: "Rollback requires specific trustIds scope"
        }, { status: 400 });
      }

      const rollbackResult = await rollbackTaxonomyInferences(params.trustIds, dbInstance);

      return NextResponse.json({
        success: true,
        mode: "rollback",
        scope: params.scope,
        result: {
          rolledBack: rollbackResult.rolledBack,
          skipped: rollbackResult.skipped,
          errors: rollbackResult.errors,
          scanned: params.trustIds.length
        },
        message: `Rollback completed. ${rollbackResult.rolledBack} trusts rolled back.`,
      });
    }

    // Build query based on scope
    let whereClause = sql`1=1`; // Default: all trusts

    if (params.scope === "trustIds" && params.trustIds?.length) {
      whereClause = sql`${trusts.id} IN ${params.trustIds}`;
    } else if (params.scope === "clientId" && params.clientId) {
      whereClause = sql`${trusts.clientId} = ${params.clientId}`;
    }

    // Build query with cursor pagination
    const baseQuery = dbInstance
      .select({
        id: trusts.id,
        userId: trusts.userId,
        trustType: trusts.trustType,
        trustMode: trusts.trustMode,
        complexTrustMode: trusts.complexTrustMode,
        // Current taxonomy fields
        trustCategory: trusts.trustCategory,
        moduleType: trusts.moduleType,
        formationMode: trusts.formationMode,
        governanceMode: trusts.governanceMode,
        commercialEnabled: trusts.commercialEnabled,
        sCorpEligible: trusts.sCorpEligible,
        trustSubtype: trusts.trustSubtype,
        irsElectionConfirmed: trusts.irsElectionConfirmed,
        // Metadata
        createdAt: trusts.createdAt,
      })
      .from(trusts);

    // Apply scope filter
    const scopedQuery = params.cursor
      ? baseQuery.where(and(whereClause, sql`${trusts.id} > ${params.cursor}`))
      : baseQuery.where(whereClause);

    // Apply ordering and limit
    const trustsQuery = scopedQuery
      .orderBy(trusts.id)
      .limit(params.limit + 1); // +1 to check for more

    const trustRecords = await trustsQuery;

    // Check if there are more results
    if (trustRecords.length > params.limit) {
      result.hasMore = true;
      result.nextCursor = trustRecords[params.limit - 1].id;
      trustRecords.pop(); // Remove the extra record
    }

    result.scanned = trustRecords.length;

    // Process each trust
    for (const trust of trustRecords) {
      try {
        const { updates, taxonomySource } = await inferTaxonomyValues({ ...trust, force: params.force }, dbInstance);

        if (Object.keys(updates).length === 0) {
          result.skipped++;
          continue;
        }

        // Create diff for logging
        const beforeState = {
          trustCategory: trust.trustCategory,
          moduleType: trust.moduleType,
          formationMode: trust.formationMode,
          governanceMode: trust.governanceMode,
          commercialEnabled: trust.commercialEnabled,
          sCorpEligible: trust.sCorpEligible,
          trustSubtype: trust.trustSubtype,
          irsElectionConfirmed: trust.irsElectionConfirmed,
        };

        const afterState = { ...beforeState, ...updates };

        result.diffs.push({
          trustId: trust.id,
          before: beforeState,
          after: afterState,
          taxonomySource
        });

        if (params.mode === "dryRun") {
          result.wouldUpdate++;
        } else {
          // Apply the updates
          await dbInstance
            .update(trusts)
            .set(updates)
            .where(eq(trusts.id, trust.id));

          result.updated++;
          console.log(`Migrated trust ${trust.id}: ${taxonomySource}`);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({
          trustId: trust.id,
          error: errorMessage
        });
        console.error(`Failed to migrate trust ${trust.id}:`, error);
      }
    }

    // Create migration log entry (store in database or log file)
    const logEntry = {
      timestamp: new Date().toISOString(),
      mode: params.mode,
      scope: params.scope,
      params,
      result: {
        ...result,
        diffs: result.diffs.slice(0, 10) // Limit diffs in log
      },
      performedBy: userId
    };

    // In production, you'd store this in a migration_logs table
    console.log('Migration completed:', JSON.stringify(logEntry, null, 2));

    return NextResponse.json({
      success: true,
      mode: params.mode,
      scope: params.scope,
      result,
      message: params.mode === "dryRun"
        ? `Dry run completed. ${result.wouldUpdate} trusts would be updated.`
        : `Migration completed. ${result.updated} trusts updated.`,
    });

  } catch (error) {
    console.error('Trust taxonomy migration failed:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check migration status and get sample diffs
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sampleSize = Math.min(parseInt(searchParams.get("sampleSize") || "10"), 50);

    const dbInstance = await getDb();

    // Get migration status
    const totalTrusts = await dbInstance.$count(trusts);

    const canonicalTrusts = await dbInstance.$count(
      trusts,
      sql`${trusts.trustCategory} IS NOT NULL AND ${trusts.formationMode} IS NOT NULL`
    );

    // Get sample of non-canonical trusts for diff preview
    const sampleNonCanonical = await dbInstance
      .select({
        id: trusts.id,
        trustType: trusts.trustType,
        trustCategory: trusts.trustCategory,
        formationMode: trusts.formationMode,
        governanceMode: trusts.governanceMode,
        commercialEnabled: trusts.commercialEnabled,
        moduleType: trusts.moduleType,
      })
      .from(trusts)
      .where(sql`${trusts.trustCategory} IS NULL OR ${trusts.formationMode} IS NULL`)
      .limit(sampleSize);

    // Generate sample diffs
    const sampleDiffs = await Promise.all(sampleNonCanonical.map(async (trust) => {
      const { updates } = await inferTaxonomyValues(trust, dbInstance);
      return {
        trustId: trust.id,
        before: {
          trustCategory: trust.trustCategory,
          moduleType: trust.moduleType,
          formationMode: trust.formationMode,
          governanceMode: trust.governanceMode,
          commercialEnabled: trust.commercialEnabled,
        },
        after: {
          trustCategory: trust.trustCategory || updates.trustCategory,
          moduleType: trust.moduleType || updates.moduleType,
          formationMode: trust.formationMode || updates.formationMode,
          governanceMode: trust.governanceMode ?? updates.governanceMode,
          commercialEnabled: trust.commercialEnabled ?? updates.commercialEnabled,
        }
      };
    }));

    return NextResponse.json({
      status: {
        totalTrusts,
        canonicalTrusts,
        migrationNeeded: canonicalTrusts < totalTrusts,
        migrationPercentage: totalTrusts > 0 ? (canonicalTrusts / totalTrusts) * 100 : 0
      },
      sampleDiffs,
      features: {
        migrationAllowed: isMigrationAllowed()
      }
    });

  } catch (error) {
    console.error('Migration status check failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}