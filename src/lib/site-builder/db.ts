import { and, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trusts, web3Sites } from "@/lib/db/schema";

type Db = Awaited<ReturnType<typeof getDb>>;

export function mysqlRows(result: unknown): Record<string, unknown>[] {
  const t = result as [unknown, unknown];
  const r0 = t?.[0];
  if (Array.isArray(r0)) return r0 as Record<string, unknown>[];
  return [];
}

function parseLlmMode(raw: unknown): "off" | "platform" | "byok" {
  const s = String(raw || "").toLowerCase();
  if (s === "off" || s === "platform" || s === "byok") return s;
  return "platform";
}

export async function ensureSiteBuilderTables(db: Awaited<ReturnType<typeof getDb>>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS web3_sites (
      id VARCHAR(36) PRIMARY KEY,
      userId INT NOT NULL,
      trustId VARCHAR(36) NULL,
      workspaceId VARCHAR(36) NULL,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(191) NULL,
      status ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
      ownerWallet VARCHAR(140) NULL,
      nftChainId INT NULL,
      nftContract VARCHAR(140) NULL,
      nftTokenId VARCHAR(120) NULL,
      currentVersionId VARCHAR(36) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX web3_sites_user_idx (userId),
      INDEX web3_sites_trust_idx (trustId),
      INDEX web3_sites_workspace_idx (workspaceId),
      INDEX web3_sites_status_idx (status),
      INDEX web3_sites_slug_idx (slug)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS web3_site_versions (
      id VARCHAR(36) PRIMARY KEY,
      siteId VARCHAR(36) NOT NULL,
      version INT NOT NULL,
      schemaJson TEXT NOT NULL,
      schemaHash VARCHAR(64) NOT NULL,
      buildManifestJson TEXT NULL,
      ipfsCid VARCHAR(191) NULL,
      previewImageCid VARCHAR(191) NULL,
      glbScenePlanId VARCHAR(64) NULL,
      createdByUserId INT NOT NULL,
      createdByWallet VARCHAR(140) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      UNIQUE KEY web3_site_versions_site_version_uidx (siteId, version),
      INDEX web3_site_versions_site_idx (siteId),
      INDEX web3_site_versions_hash_idx (schemaHash)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS web3_site_templates (
      id VARCHAR(36) PRIMARY KEY,
      userId INT NOT NULL,
      name VARCHAR(191) NOT NULL,
      description TEXT NULL,
      schemaJson TEXT NOT NULL,
      trustId VARCHAR(36) NULL,
      workspaceId VARCHAR(36) NULL,
      clientId VARCHAR(36) NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX web3_site_templates_user_idx (userId),
      INDEX web3_site_templates_trust_idx (trustId),
      INDEX web3_site_templates_workspace_idx (workspaceId),
      INDEX web3_site_templates_name_idx (name)
    )
  `);
}

export async function ensureTrustAccess(db: Awaited<ReturnType<typeof getDb>>, userId: number, trustId: string) {
  const [trust] = await db
    .select({ id: trusts.id })
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);
  return Boolean(trust);
}

export async function getOwnedSite(db: Awaited<ReturnType<typeof getDb>>, userId: number, siteId: string) {
  const [site] = await db
    .select()
    .from(web3Sites)
    .where(and(eq(web3Sites.id, siteId), eq(web3Sites.userId, userId)))
    .limit(1);
  return site ?? null;
}

/** Per-site BYOK / LLM mode for site-builder (optional row). */
export type SiteBuilderAiSettingsRow = {
  siteId: string;
  userId: number;
  llmMode: "off" | "platform" | "byok";
  endpoint: string | null;
  model: string | null;
  apiKeyEnc: string | null;
  fallbackToPlatform: boolean;
  updatedAt: string | null;
};

export async function ensureSiteBuilderAiSettingsTable(db: Db) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS web3_site_builder_ai_settings (
      site_id VARCHAR(36) NOT NULL PRIMARY KEY,
      user_id INT NOT NULL,
      llm_mode VARCHAR(16) NOT NULL DEFAULT 'platform',
      endpoint VARCHAR(512) NULL,
      model VARCHAR(120) NULL,
      api_key_enc TEXT NULL,
      fallback_to_platform TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
    )
  `);
}

export async function getSiteBuilderAiSettingsRow(db: Db, siteId: string): Promise<SiteBuilderAiSettingsRow | null> {
  await ensureSiteBuilderAiSettingsTable(db);
  const raw = await db.execute(sql`
    SELECT site_id, user_id, llm_mode, endpoint, model, api_key_enc, fallback_to_platform, updated_at
    FROM web3_site_builder_ai_settings
    WHERE site_id = ${siteId}
    LIMIT 1
  `);
  const rows = mysqlRows(raw);
  const r = rows[0];
  if (!r) return null;
  return {
    siteId: String(r.site_id),
    userId: Number(r.user_id),
    llmMode: parseLlmMode(r.llm_mode),
    endpoint: r.endpoint != null ? String(r.endpoint) : null,
    model: r.model != null ? String(r.model) : null,
    apiKeyEnc: r.api_key_enc != null ? String(r.api_key_enc) : null,
    fallbackToPlatform: Boolean(Number(r.fallback_to_platform)),
    updatedAt: r.updated_at != null ? String(r.updated_at) : null,
  };
}

export async function upsertSiteBuilderAiSettingsRow(
  db: Db,
  userId: number,
  siteId: string,
  data: {
    llmMode: "off" | "platform" | "byok";
    endpoint: string | null;
    model: string | null;
    apiKeyEnc: string | null;
    fallbackToPlatform: boolean;
  },
) {
  await ensureSiteBuilderAiSettingsTable(db);
  await db.execute(sql`
    REPLACE INTO web3_site_builder_ai_settings
      (site_id, user_id, llm_mode, endpoint, model, api_key_enc, fallback_to_platform)
    VALUES
      (
        ${siteId},
        ${userId},
        ${data.llmMode},
        ${data.endpoint},
        ${data.model},
        ${data.apiKeyEnc},
        ${data.fallbackToPlatform ? 1 : 0}
      )
  `);
}

export async function ensureSiteBuilderRunLogTables(db: Db) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS web3_site_action_runs (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      site_id VARCHAR(36) NULL,
      version_id VARCHAR(36) NULL,
      user_id INT NOT NULL,
      source VARCHAR(32) NOT NULL,
      action_count INT NOT NULL,
      actions_json TEXT NOT NULL,
      results_json TEXT NOT NULL,
      status VARCHAR(16) NOT NULL,
      error_message TEXT NULL,
      schema_hash_before VARCHAR(64) NULL,
      schema_hash_after VARCHAR(64) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX web3_site_action_runs_site_idx (site_id),
      INDEX web3_site_action_runs_user_idx (user_id)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS web3_site_import_runs (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      site_id VARCHAR(36) NULL,
      version_id VARCHAR(36) NULL,
      user_id INT NOT NULL,
      source_url TEXT NULL,
      fetch_status VARCHAR(32) NOT NULL,
      http_status INT NULL,
      partial_import TINYINT(1) NOT NULL DEFAULT 0,
      home_block_count INT NULL,
      reconstruction_path VARCHAR(64) NULL,
      notes_json TEXT NULL,
      warnings_json TEXT NULL,
      diff_report_json TEXT NULL,
      error_message TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX web3_site_import_runs_site_idx (site_id),
      INDEX web3_site_import_runs_user_idx (user_id)
    )
  `);
}

/**
 * Site Builder generation intelligence (adaptive memory). Mirrors `drizzle/0108_site_builder_generation_intelligence.sql`.
 * Idempotent `CREATE TABLE IF NOT EXISTS` only — does **not** run runtime `ALTER TABLE`.
 * Legacy databases missing columns from `drizzle/0109_site_generation_intelligence_publish_perf.sql` should apply that
 * migration (or call `patchSiteGenerationIntelligenceColumns` from a maintenance job), not from user-facing generation.
 */
export async function ensureSiteBuilderIntelligenceTables(db: Db) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS site_generation_runs (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      userId INT NOT NULL,
      siteId VARCHAR(36) NULL,
      clientId VARCHAR(36) NULL,
      pipelineStep VARCHAR(32) NOT NULL,
      promptHash VARCHAR(64) NOT NULL,
      promptSummary VARCHAR(512) NULL,
      industry VARCHAR(200) NULL,
      businessName VARCHAR(200) NULL,
      primaryOffer VARCHAR(800) NULL,
      audience VARCHAR(800) NULL,
      ctaGoal VARCHAR(500) NULL,
      siteType VARCHAR(32) NULL,
      designDirection VARCHAR(32) NULL,
      styleIntensity INT NULL,
      web3VisualMode TINYINT(1) NULL,
      layoutVariantIndex INT NULL,
      selectedVariantIndex INT NULL,
      variantCount INT NULL,
      rejectedVariantIndicesJson JSON NULL,
      schemaMetadataJson JSON NOT NULL,
      sectionRegistryKeysJson JSON NOT NULL,
      designTokensJson JSON NULL,
      agentAttached TINYINT(1) NOT NULL DEFAULT 0,
      publishStatus VARCHAR(32) NULL,
      publishedAt TIMESTAMP NULL,
      deployedUrl VARCHAR(512) NULL,
      publishedVersionId VARCHAR(36) NULL,
      leadCount INT NULL,
      conversionRateBps INT NULL,
      rollupLeadsCaptured INT NULL,
      rollupConversationsOpened INT NULL,
      rollupWidgetMessages INT NULL,
      rollupBookingsScheduled INT NULL,
      evaluationScore INT NULL,
      llmEnriched TINYINT(1) NOT NULL DEFAULT 0,
      createdAt TIMESTAMP NOT NULL DEFAULT (NOW()),
      updatedAt TIMESTAMP NOT NULL DEFAULT (NOW()) ON UPDATE CURRENT_TIMESTAMP,
      KEY sgr_user_created (userId, createdAt),
      KEY sgr_user_industry (userId, industry),
      KEY sgr_prompt_hash (promptHash),
      KEY sgr_score (evaluationScore),
      KEY sgr_site_user_created (siteId, userId, createdAt),
      CONSTRAINT sgr_user_fk FOREIGN KEY (userId) REFERENCES marketplace_users (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS site_generation_variants (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      runId VARCHAR(36) NOT NULL,
      variantIndex INT NOT NULL,
      seed VARCHAR(191) NULL,
      schemaHash VARCHAR(64) NULL,
      wasSelected TINYINT(1) NOT NULL DEFAULT 0,
      wasRejected TINYINT(1) NOT NULL DEFAULT 0,
      evaluationScore INT NULL,
      layoutFingerprintJson JSON NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT (NOW()),
      UNIQUE KEY sgv_run_idx (runId, variantIndex),
      KEY sgv_run (runId),
      CONSTRAINT sgv_run_fk FOREIGN KEY (runId) REFERENCES site_generation_runs (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS site_variant_feedback (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      runId VARCHAR(36) NULL,
      variantId VARCHAR(36) NULL,
      userId INT NOT NULL,
      feedbackType VARCHAR(32) NOT NULL,
      rating INT NULL,
      noteSummary VARCHAR(500) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT (NOW()),
      KEY svf_user (userId),
      KEY svf_run (runId),
      KEY svf_variant (variantId),
      CONSTRAINT svf_user_fk FOREIGN KEY (userId) REFERENCES marketplace_users (id),
      CONSTRAINT svf_run_fk FOREIGN KEY (runId) REFERENCES site_generation_runs (id) ON DELETE SET NULL,
      CONSTRAINT svf_variant_fk FOREIGN KEY (variantId) REFERENCES site_generation_variants (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

/**
 * Idempotent ALTERs for installs created before `0109_site_generation_intelligence_publish_perf.sql`.
 * Intended for one-off migrations or admin repair — **not** for `/api/site-builder/ai/pipeline` or other hot paths.
 */
export async function patchSiteGenerationIntelligenceColumns(db: Db) {
  const alters = [
    sql`ALTER TABLE site_generation_runs ADD COLUMN publishedAt TIMESTAMP NULL`,
    sql`ALTER TABLE site_generation_runs ADD COLUMN deployedUrl VARCHAR(512) NULL`,
    sql`ALTER TABLE site_generation_runs ADD COLUMN publishedVersionId VARCHAR(36) NULL`,
    sql`ALTER TABLE site_generation_runs ADD COLUMN rollupLeadsCaptured INT NULL`,
    sql`ALTER TABLE site_generation_runs ADD COLUMN rollupConversationsOpened INT NULL`,
    sql`ALTER TABLE site_generation_runs ADD COLUMN rollupWidgetMessages INT NULL`,
    sql`ALTER TABLE site_generation_runs ADD COLUMN rollupBookingsScheduled INT NULL`,
  ];
  for (const q of alters) {
    try {
      await db.execute(q);
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : String(e);
      if (!/Duplicate column name/i.test(m)) throw e;
    }
  }
  try {
    await db.execute(sql`ALTER TABLE site_generation_runs ADD INDEX sgr_site_user_created (siteId, userId, createdAt)`);
  } catch (e: unknown) {
    const m = e instanceof Error ? e.message : String(e);
    if (!/Duplicate key name/i.test(m) && !/already exists/i.test(m)) throw e;
  }
}

/** Mirrors `drizzle/0112_site_domain_connections.sql`. */
export async function ensureSiteDomainConnectionsTable(db: Db) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS site_domain_connections (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      siteId VARCHAR(36) NOT NULL,
      clientId VARCHAR(36) NULL,
      ownerUserId INT NOT NULL,
      domain VARCHAR(255) NOT NULL,
      domainType VARCHAR(24) NOT NULL,
      provider VARCHAR(24) NOT NULL,
      targetUrl VARCHAR(2000) NOT NULL,
      vercelProjectId VARCHAR(120) NULL,
      vercelDeploymentUrl VARCHAR(2000) NULL,
      status VARCHAR(32) NOT NULL,
      verificationMethod VARCHAR(64) NULL,
      requiredRecordsJson TEXT NULL,
      lastCheckedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      UNIQUE KEY uq_sdc_site (siteId),
      INDEX idx_sdc_owner (ownerUserId),
      INDEX idx_sdc_client (clientId),
      INDEX idx_sdc_status (status)
    )
  `);
}
