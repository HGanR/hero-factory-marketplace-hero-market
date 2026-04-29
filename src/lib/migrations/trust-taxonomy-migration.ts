import { getDb } from "@/lib/db";
import { trusts, trustResolutions, minutes, resolutions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Trust Taxonomy Migration Script
 *
 * Migrates existing trusts to the new canonical taxonomy schema.
 * Run this script after deploying the new database schema fields.
 */

export interface MigrationResult {
  totalProcessed: number;
  updated: number;
  errors: Array<{ trustId: string; error: string }>;
  skipped: number;
}

/**
 * Migrate all existing trusts to canonical taxonomy
 */
export async function migrateTrustTaxonomy(): Promise<MigrationResult> {
  const result: MigrationResult = {
    totalProcessed: 0,
    updated: 0,
    errors: [],
    skipped: 0,
  };

  try {
    const dbInstance = await getDb();
    // Get all existing trusts
    const existingTrusts = await dbInstance
      .select({
        id: trusts.id,
        trustType: trusts.trustType,
        trustMode: trusts.trustMode,
        complexTrustMode: trusts.complexTrustMode,
        // Include new fields that might already exist
        trustCategory: trusts.trustCategory,
        formationMode: trusts.formationMode,
        commercialEnabled: trusts.commercialEnabled,
        governanceMode: trusts.governanceMode,
      })
      .from(trusts);

    console.log(`Found ${existingTrusts.length} trusts to process`);

    for (const trust of existingTrusts) {
      result.totalProcessed++;

      try {
        // Skip if already migrated (has canonical fields set)
        if (trust.trustCategory && trust.formationMode && trust.governanceMode !== undefined) {
          result.skipped++;
          continue;
        }

        // Map legacy fields to canonical taxonomy
        const canonicalUpdate = await mapLegacyToCanonical(trust, dbInstance);

        // Update the trust
        await dbInstance
          .update(trusts)
          .set(canonicalUpdate)
          .where(eq(trusts.id, trust.id));

        result.updated++;
        console.log(`Migrated trust ${trust.id}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({
          trustId: trust.id,
          error: errorMessage,
        });
        console.error(`Failed to migrate trust ${trust.id}:`, error);
      }
    }

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }

  return result;
}

/**
 * Map legacy trust fields to canonical taxonomy
 */
export async function mapLegacyToCanonical(trust: any, dbInstance: any) {
  const update: any = {};

  // Default to private express trust for all platform trusts
  update.trustCategory = trust.trustCategory || 'private';
  update.formationMode = trust.formationMode || 'express';

  // Map trust type to module type
  if (!trust.moduleType) {
    const trustTypeToModuleType: Record<string, string> = {
      'revocable_living_trust': 'revocable_living_trust',
      'irrevocable_trust': 'private_express_trust',
      'special_purpose_trust': 'private_express_trust',
      'testamentary_trust': 'testamentary_trust',
    };
    update.moduleType = trustTypeToModuleType[trust.trustType] || 'private_express_trust';
  }

  // Map governance mode from legacy complexTrustMode AND check for actual governance artifacts
  if (trust.governanceMode === undefined) {
    let governanceMode = trust.complexTrustMode ? 'complex' : 'simple';

    // Check for actual governance artifacts that indicate complex governance
    const hasGovernanceArtifacts = await checkGovernanceArtifacts(trust.id, dbInstance);
    if (hasGovernanceArtifacts) {
      governanceMode = 'complex';
    }

    update.governanceMode = governanceMode;
  }

  // Determine commercial enablement based on trust type and legacy fields
  if (trust.commercialEnabled === undefined) {
    // Special purpose trusts (Private Express Trusts) get commercial enabled
    update.commercialEnabled = trust.trustType === 'special_purpose_trust';

    // Complex trusts get commercial enabled
    if (trust.complexTrustMode) {
      update.commercialEnabled = true;
    }
  }

  // S Corp eligibility - default to false, requires explicit qualification
  update.sCorpEligible = trust.sCorpEligible || false;
  update.trustSubtype = trust.trustSubtype || 'standard';
  update.irsElectionConfirmed = trust.irsElectionConfirmed || false;

  // Store taxonomy inference metadata
  update.taxonomySource = 'migration_inference';
  update.taxonomyInferredAt = new Date();

  return update;
}

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
 * Validation function to check migration results
 */
export async function validateMigration(): Promise<{
  totalTrusts: number;
  canonicalTrusts: number;
  invalidTrusts: Array<{ id: string; issues: string[] }>;
}> {
  const dbInstance = await getDb();
  const allTrusts = await dbInstance
    .select({
      id: trusts.id,
      trustCategory: trusts.trustCategory,
      formationMode: trusts.formationMode,
      commercialEnabled: trusts.commercialEnabled,
      governanceMode: trusts.governanceMode,
      sCorpEligible: trusts.sCorpEligible,
      trustSubtype: trusts.trustSubtype,
      irsElectionConfirmed: trusts.irsElectionConfirmed,
    })
    .from(trusts);

  const result = {
    totalTrusts: allTrusts.length,
    canonicalTrusts: 0,
    invalidTrusts: [] as Array<{ id: string; issues: string[] }>,
  };

  for (const trust of allTrusts) {
    const issues: string[] = [];

    // Check required canonical fields
    if (!trust.trustCategory) issues.push('Missing trustCategory');
    if (!trust.formationMode) issues.push('Missing formationMode');
    if (trust.governanceMode === undefined) issues.push('Missing governanceMode');
    if (trust.commercialEnabled === undefined) issues.push('Missing commercialEnabled');

    // Validate commercial trust rules
    if (trust.commercialEnabled && trust.governanceMode !== 'complex') {
      issues.push('Commercial trust must have complex governance');
    }

    // Validate S Corp eligibility
    if (trust.sCorpEligible) {
      if (!['grantor', 'QSST', 'ESBT'].includes(trust.trustSubtype || '')) {
        issues.push('S Corp eligible trust must have qualifying subtype');
      }
      if (!trust.irsElectionConfirmed) {
        issues.push('S Corp eligible trust must have IRS election confirmed');
      }
    }

    if (issues.length === 0) {
      result.canonicalTrusts++;
    } else {
      result.invalidTrusts.push({ id: trust.id, issues });
    }
  }

  return result;
}

/**
 * Safe migration that can be run multiple times
 */
export async function safeMigrateTrustTaxonomy(): Promise<MigrationResult> {
  console.log('Starting Trust Taxonomy Migration...');

  const result = await migrateTrustTaxonomy();

  console.log('\nMigration Summary:');
  console.log(`Total Processed: ${result.totalProcessed}`);
  console.log(`Updated: ${result.updated}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Errors: ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(err => {
      console.log(`- Trust ${err.trustId}: ${err.error}`);
    });
  }

  // Validate results
  const validation = await validateMigration();
  console.log('\nValidation Results:');
  console.log(`Total Trusts: ${validation.totalTrusts}`);
  console.log(`Canonical Trusts: ${validation.canonicalTrusts}`);
  console.log(`Invalid Trusts: ${validation.invalidTrusts.length}`);

  if (validation.invalidTrusts.length > 0) {
    console.log('\nInvalid Trusts:');
    validation.invalidTrusts.forEach(invalid => {
      console.log(`- Trust ${invalid.id}: ${invalid.issues.join(', ')}`);
    });
  }

  return result;
}