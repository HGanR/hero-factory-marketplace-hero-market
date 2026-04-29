/**
 * Feature Flags for Consultant-Guided Compliance Flow
 * Enables safe rollout and gradual deployment of taxonomy features
 */

export type FeatureFlag =
  | "TRUST_TAXONOMY"           // Enable taxonomy display (badges, classifications)
  | "PROCEDURE_OVERLAY"        // Enable guided procedure overlay
  | "PACKET_EXPORT"           // Enable legal review / print-ready export
  | "S_CORP_GUARDS"           // Enable S Corp IRS compliance guards
  | "ENTITY_VALIDATION"       // Enable entity attachment validation
  | "JURISDICTION_ADVISORY"   // Enable state/county specific guidance
  | "COMMERCIAL_ENFORCEMENT"  // Enable commercial activity enforcement
  | "TAXONOMY_MIGRATION"      // Allow taxonomy migration operations
  | "PROCEDURE_LOGGING"       // Enable procedure completion logging
  | "EXPORT_AUDIT"            // Enable export decision auditing

/**
 * Feature flag configuration by environment
 * Default: all features disabled for safety
 */
const FEATURE_FLAGS: Record<string, Record<FeatureFlag, boolean>> = {
  development: {
    TRUST_TAXONOMY: true,
    PROCEDURE_OVERLAY: true,
    PACKET_EXPORT: true,
    S_CORP_GUARDS: true,
    ENTITY_VALIDATION: true,
    JURISDICTION_ADVISORY: true,
    COMMERCIAL_ENFORCEMENT: true,
    TAXONOMY_MIGRATION: true,
    PROCEDURE_LOGGING: true,
    EXPORT_AUDIT: true,
  },
  staging: {
    TRUST_TAXONOMY: true,
    PROCEDURE_OVERLAY: true,
    PACKET_EXPORT: false, // Test overlay first
    S_CORP_GUARDS: true,
    ENTITY_VALIDATION: true,
    JURISDICTION_ADVISORY: true,
    COMMERCIAL_ENFORCEMENT: false, // Allow testing without enforcement
    TAXONOMY_MIGRATION: true,
    PROCEDURE_LOGGING: true,
    EXPORT_AUDIT: false,
  },
  production: {
    TRUST_TAXONOMY: false, // Start with display only
    PROCEDURE_OVERLAY: false,
    PACKET_EXPORT: false,
    S_CORP_GUARDS: false,
    ENTITY_VALIDATION: false,
    JURISDICTION_ADVISORY: false,
    COMMERCIAL_ENFORCEMENT: false,
    TAXONOMY_MIGRATION: false, // Require explicit enablement
    PROCEDURE_LOGGING: false,
    EXPORT_AUDIT: false,
  }
};

/**
 * Get current environment
 */
function getEnvironment(): string {
  // Check for explicit NODE_ENV
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }

  // Check for Vercel environment
  if (process.env.VERCEL_ENV) {
    return process.env.VERCEL_ENV;
  }

  // Default to production for safety
  return "production";
}

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const env = getEnvironment();
  const envFlags = FEATURE_FLAGS[env];

  if (!envFlags) {
    // Unknown environment, default to production settings
    return FEATURE_FLAGS.production[flag] || false;
  }

  return envFlags[flag] || false;
}

/**
 * Check multiple feature flags (all must be enabled)
 */
export function areFeaturesEnabled(flags: FeatureFlag[]): boolean {
  return flags.every(flag => isFeatureEnabled(flag));
}

/**
 * Get all feature flags for current environment
 */
export function getAllFeatureFlags(): Record<FeatureFlag, boolean> {
  const env = getEnvironment();
  return FEATURE_FLAGS[env] || FEATURE_FLAGS.production;
}

/**
 * Override feature flags for testing (development only)
 */
export function setFeatureFlagForTesting(flag: FeatureFlag, enabled: boolean): void {
  if (getEnvironment() === "development") {
    FEATURE_FLAGS.development[flag] = enabled;
  }
}

/**
 * Reset all feature flags to defaults (development only)
 */
export function resetFeatureFlagsForTesting(): void {
  if (getEnvironment() === "development") {
    FEATURE_FLAGS.development = { ...FEATURE_FLAGS.development };
  }
}

/**
 * Feature flag groupings for common checks
 */
export const FEATURE_GROUPS = {
  // Full compliance flow
  COMPLIANCE_FLOW: [
    "PROCEDURE_OVERLAY",
    "PACKET_EXPORT",
    "PROCEDURE_LOGGING",
    "EXPORT_AUDIT"
  ] as FeatureFlag[],

  // Taxonomy system
  TAXONOMY_SYSTEM: [
    "TRUST_TAXONOMY",
    "COMMERCIAL_ENFORCEMENT",
    "S_CORP_GUARDS",
    "ENTITY_VALIDATION"
  ] as FeatureFlag[],

  // Safe migration
  MIGRATION_SAFE: [
    "TAXONOMY_MIGRATION"
  ] as FeatureFlag[]
} as const;

/**
 * Check if compliance flow is fully enabled
 */
export function isComplianceFlowEnabled(): boolean {
  return areFeaturesEnabled(FEATURE_GROUPS.COMPLIANCE_FLOW);
}

/**
 * Check if taxonomy system is enabled
 */
export function isTaxonomySystemEnabled(): boolean {
  return areFeaturesEnabled(FEATURE_GROUPS.TAXONOMY_SYSTEM);
}

/**
 * Check if safe migration is allowed
 */
export function isMigrationAllowed(): boolean {
  return areFeaturesEnabled(FEATURE_GROUPS.MIGRATION_SAFE);
}