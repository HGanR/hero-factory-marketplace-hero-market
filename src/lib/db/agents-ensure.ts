import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

/**
 * Creates core agent tables if missing. Intended as a dev/safety fallback only — deploy via SQL migrations in production.
 */
export async function ensureAgentTables() {
  const db = await getDb();

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_agents (
      id VARCHAR(36) PRIMARY KEY,
      userId INT NOT NULL,
      consultantId VARCHAR(36),
      name VARCHAR(120) NOT NULL,
      description VARCHAR(255),
      systemPrompt TEXT,
      model VARCHAR(64),
      temperature DECIMAL(4,2),
      toolsJson TEXT,
      voiceProvider VARCHAR(32),
      voiceId VARCHAR(64),
      avatarImageUrl TEXT NULL,
      avatarAltText VARCHAR(160) NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'draft',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX ai_agents_user_idx (userId),
      INDEX ai_agents_consultant_idx (consultantId),
      INDEX ai_agents_status_idx (status)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_agent_site_bindings (
      id VARCHAR(36) PRIMARY KEY,
      agentId VARCHAR(36) NOT NULL,
      siteId VARCHAR(36) NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      widgetKey VARCHAR(48) NOT NULL,
      allowedDomains TEXT,
      metadata JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX ai_agent_site_bindings_agent_idx (agentId),
      INDEX ai_agent_site_bindings_site_idx (siteId),
      UNIQUE INDEX ai_agent_site_bindings_widget_key_uidx (widgetKey)
    )
  `);

  try {
    await db.execute(sql`ALTER TABLE ai_agent_site_bindings ADD COLUMN metadata JSON`);
  } catch {
    /* column may already exist */
  }
  try {
    await db.execute(sql`ALTER TABLE ai_agents ADD COLUMN voiceProvider VARCHAR(32)`);
  } catch {
    /* column may already exist */
  }
  try {
    await db.execute(sql`ALTER TABLE ai_agents ADD COLUMN voiceId VARCHAR(64)`);
  } catch {
    /* column may already exist */
  }
  try {
    await db.execute(sql`ALTER TABLE ai_agents ADD COLUMN workspaceId VARCHAR(64)`);
  } catch {
    /* column may already exist */
  }
  try {
    await db.execute(sql`CREATE INDEX ai_agents_workspace_idx ON ai_agents(workspaceId)`);
  } catch {
    /* index may already exist */
  }
  try {
    await db.execute(sql`ALTER TABLE ai_agents ADD COLUMN llmEndpoint VARCHAR(512)`);
  } catch {
    /* column may already exist */
  }
  try {
    await db.execute(sql`ALTER TABLE ai_agents ADD COLUMN llmApiKeyEnc TEXT`);
  } catch {
    /* column may already exist */
  }
  try {
    await db.execute(sql`ALTER TABLE ai_agents ADD COLUMN language VARCHAR(16)`);
  } catch {
    /* column may already exist */
  }
  try {
    await db.execute(sql`ALTER TABLE ai_agents ADD COLUMN industriesJson TEXT`);
  } catch {
    /* column may already exist */
  }
  try {
    await db.execute(sql`ALTER TABLE ai_agents ADD COLUMN avatarImageUrl TEXT`);
  } catch {
    /* column may already exist */
  }
  try {
    await db.execute(sql`ALTER TABLE ai_agents ADD COLUMN avatarAltText VARCHAR(160)`);
  } catch {
    /* column may already exist */
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_voices (
      id VARCHAR(36) PRIMARY KEY,
      userId INT NOT NULL,
      name VARCHAR(120) NOT NULL,
      provider VARCHAR(32) NOT NULL,
      providerVoiceId VARCHAR(64) NOT NULL,
      isCustom BOOLEAN NOT NULL DEFAULT TRUE,
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      consent JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX ai_voices_user_idx (userId),
      INDEX ai_voices_status_idx (status)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_agent_knowledge_items (
      id VARCHAR(36) PRIMARY KEY,
      agentId VARCHAR(36) NOT NULL,
      type VARCHAR(32) NOT NULL,
      contentOrPointer TEXT NOT NULL,
      sortOrder INT NOT NULL DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX ai_agent_knowledge_items_agent_idx (agentId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_agent_collaborators (
      id VARCHAR(36) PRIMARY KEY,
      agentId VARCHAR(36) NOT NULL,
      userId INT NOT NULL,
      invitedByUserId INT NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'accepted',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX ai_agent_collaborators_agent_idx (agentId),
      INDEX ai_agent_collaborators_user_idx (userId),
      UNIQUE KEY ai_agent_collaborators_agent_user_uidx (agentId, userId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_agent_building_bindings (
      id VARCHAR(36) PRIMARY KEY,
      agentId VARCHAR(36),
      worldId VARCHAR(64) NOT NULL,
      buildingId VARCHAR(64) NOT NULL,
      apiKey VARCHAR(64) NOT NULL,
      userId INT NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX ai_agent_building_bindings_agent_idx (agentId),
      INDEX ai_agent_building_bindings_world_building_idx (worldId, buildingId),
      INDEX ai_agent_building_bindings_user_idx (userId),
      UNIQUE INDEX ai_agent_building_bindings_api_key_uidx (apiKey)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_plugin_installations (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      agentId VARCHAR(36) NOT NULL,
      pluginKey VARCHAR(64) NOT NULL,
      enabled TINYINT(1) NOT NULL DEFAULT 0,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY agent_plugin_installations_agent_plugin_uidx (agentId, pluginKey),
      KEY agent_plugin_installations_agent_idx (agentId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_plugin_credentials (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      agentId VARCHAR(36) NOT NULL,
      provider VARCHAR(32) NOT NULL,
      refreshTokenEnc TEXT,
      accessTokenEnc TEXT,
      expiresAt TIMESTAMP NULL,
      scopesJson TEXT,
      lastError VARCHAR(512),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY agent_plugin_credentials_agent_provider_uidx (agentId, provider),
      KEY agent_plugin_credentials_agent_idx (agentId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_tool_call_audit (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      agentId VARCHAR(36) NOT NULL,
      userId INT NOT NULL,
      actionKey VARCHAR(64) NOT NULL,
      inputSummary TEXT NOT NULL,
      success TINYINT(1) NOT NULL DEFAULT 0,
      errorCode VARCHAR(64) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY agent_tool_call_audit_agent_idx (agentId),
      KEY agent_tool_call_audit_user_idx (userId),
      KEY agent_tool_call_audit_created_idx (createdAt)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_tool_fingerprint (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      agentId VARCHAR(36) NOT NULL,
      actionKey VARCHAR(64) NOT NULL,
      inputHash VARCHAR(64) NOT NULL,
      resourceId VARCHAR(255) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY agent_tool_fingerprint_uidx (agentId, actionKey, inputHash),
      KEY agent_tool_fingerprint_agent_idx (agentId),
      KEY agent_tool_fingerprint_created_idx (createdAt)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_conversation_sessions (
      sessionKey VARCHAR(128) NOT NULL PRIMARY KEY,
      agentId VARCHAR(36) NOT NULL,
      userId INT NOT NULL,
      turnsJson TEXT NOT NULL,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY agent_conversation_sessions_agent_idx (agentId),
      KEY agent_conversation_sessions_user_idx (userId)
    )
  `);

  try {
    await db.execute(sql`ALTER TABLE agent_tool_call_audit ADD COLUMN successDescriptor VARCHAR(255) NULL`);
  } catch {
    /* column may already exist */
  }
  try {
    await db.execute(sql`ALTER TABLE agent_tool_call_audit ADD COLUMN latencyMs INT NULL`);
  } catch {
    /* column may already exist */
  }
}
