import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export async function ensureCrmTables() {
  const db = await getDb();

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_workspaces (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      userId INT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_user (userId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_contacts (
      id VARCHAR(36) PRIMARY KEY,
      workspaceId VARCHAR(36),
      userId INT,
      email VARCHAR(320),
      firstName VARCHAR(100),
      lastName VARCHAR(100),
      phone VARCHAR(50),
      company VARCHAR(255),
      leadSource VARCHAR(100),
      tags TEXT,
      customFields JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_workspace (workspaceId),
      INDEX idx_user (userId),
      INDEX idx_email (email)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_pipelines (
      id VARCHAR(36) PRIMARY KEY,
      workspaceId VARCHAR(36),
      userId INT,
      name VARCHAR(255) NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_workspace (workspaceId),
      INDEX idx_user (userId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
      id VARCHAR(36) PRIMARY KEY,
      pipelineId VARCHAR(36) NOT NULL,
      name VARCHAR(100) NOT NULL,
      sortOrder INT DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_pipeline (pipelineId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_opportunities (
      id VARCHAR(36) PRIMARY KEY,
      pipelineId VARCHAR(36) NOT NULL,
      stageId VARCHAR(36),
      contactId VARCHAR(36),
      userId INT,
      title VARCHAR(255) NOT NULL,
      value DECIMAL(14,2) DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_pipeline (pipelineId),
      INDEX idx_stage (stageId),
      INDEX idx_contact (contactId),
      INDEX idx_user (userId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_tasks (
      id VARCHAR(36) PRIMARY KEY,
      contactId VARCHAR(36),
      userId INT,
      workspaceId VARCHAR(36),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      dueAt TIMESTAMP NULL,
      status VARCHAR(32) DEFAULT 'open',
      priority VARCHAR(32) DEFAULT 'normal',
      source VARCHAR(32) DEFAULT 'manual',
      metadata JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_user (userId),
      INDEX idx_contact (contactId),
      INDEX idx_status (status),
      INDEX idx_due (dueAt),
      INDEX idx_user_status (userId, status),
      INDEX idx_user_due (userId, dueAt)
    )
  `);
  try {
    await db.execute(sql`ALTER TABLE crm_tasks ADD COLUMN description TEXT`);
  } catch {
    /* column may already exist */
  }
  try {
    await db.execute(sql`ALTER TABLE crm_tasks ADD COLUMN source VARCHAR(32) DEFAULT 'manual'`);
  } catch {
    /* column may already exist */
  }
  try {
    await db.execute(sql`ALTER TABLE crm_tasks ADD COLUMN metadata JSON`);
  } catch {
    /* column may already exist */
  }
  try {
    await db.execute(sql`ALTER TABLE crm_tasks ADD INDEX idx_user_status (userId, status)`);
  } catch {
    /* index may already exist */
  }
  try {
    await db.execute(sql`ALTER TABLE crm_tasks ADD INDEX idx_user_due (userId, dueAt)`);
  } catch {
    /* index may already exist */
  }
  try {
    await db.execute(sql`ALTER TABLE crm_tasks ADD INDEX idx_contact (contactId)`);
  } catch {
    /* index may already exist */
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_conversations (
      id VARCHAR(36) PRIMARY KEY,
      contactId VARCHAR(36),
      userId INT,
      workspaceId VARCHAR(36),
      channel VARCHAR(32) NOT NULL DEFAULT 'sms',
      status VARCHAR(50) DEFAULT 'open',
      subject VARCHAR(255),
      lastMessageAt TIMESTAMP NULL,
      lastMessagePreview VARCHAR(255),
      unreadCount INT NOT NULL DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_contact (contactId),
      INDEX idx_user (userId),
      INDEX idx_channel (channel),
      INDEX idx_last_message (lastMessageAt)
    )
  `);
  try {
    await db.execute(sql`ALTER TABLE crm_conversations ADD COLUMN lastMessagePreview VARCHAR(255)`);
  } catch {
    /* column may already exist */
  }
  try {
    await db.execute(sql`ALTER TABLE crm_conversations ADD COLUMN unreadCount INT NOT NULL DEFAULT 0`);
  } catch {
    /* column may already exist */
  }
  try {
    await db.execute(sql`ALTER TABLE crm_conversations ADD INDEX idx_user_contact (userId, contactId)`);
  } catch {
    /* index may already exist */
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_messages (
      id VARCHAR(36) PRIMARY KEY,
      conversationId VARCHAR(36) NOT NULL,
      direction VARCHAR(16) NOT NULL DEFAULT 'inbound',
      channel VARCHAR(32) NOT NULL DEFAULT 'sms',
      content TEXT,
      subject VARCHAR(255),
      callLogId VARCHAR(36),
      status VARCHAR(32) DEFAULT 'received',
      metadata JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_conversation (conversationId),
      INDEX idx_call_log (callLogId),
      INDEX idx_created (createdAt)
    )
  `);
  try {
    await db.execute(sql`ALTER TABLE crm_messages ADD COLUMN status VARCHAR(32) DEFAULT 'received'`);
  } catch {
    /* column may already exist */
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_automation_idempotency (
      idempotencyKey VARCHAR(128) PRIMARY KEY,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_call_logs (
      id VARCHAR(36) PRIMARY KEY,
      conversationId VARCHAR(36),
      contactId VARCHAR(36),
      userId INT,
      voiceAgentId VARCHAR(36),
      fromNumber VARCHAR(50) NOT NULL,
      toNumber VARCHAR(50) NOT NULL,
      direction VARCHAR(16) NOT NULL DEFAULT 'inbound',
      status VARCHAR(50) DEFAULT 'initiated',
      duration INT,
      recordingUrl TEXT,
      transcript TEXT,
      twilioCallSid VARCHAR(100),
      metadata JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_contact (contactId),
      INDEX idx_user (userId),
      INDEX idx_voice_agent (voiceAgentId),
      INDEX idx_twilio_sid (twilioCallSid),
      INDEX idx_created (createdAt)
    )
  `);
  try {
    await db.execute(sql`ALTER TABLE crm_call_logs ADD UNIQUE INDEX uniq_twilio_sid (twilioCallSid)`);
  } catch {
    /* unique index may already exist, or duplicates prevent it */
  }
  try {
    await db.execute(sql`ALTER TABLE crm_call_logs ADD INDEX idx_user_contact (userId, contactId)`);
  } catch {
    /* index may already exist */
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_automations (
      id VARCHAR(36) PRIMARY KEY,
      userId INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      isActive BOOLEAN DEFAULT TRUE,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_user (userId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_automation_triggers (
      id VARCHAR(36) PRIMARY KEY,
      automationId VARCHAR(36) NOT NULL,
      type VARCHAR(64) NOT NULL,
      config JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_automation (automationId),
      INDEX idx_type (type)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_automation_steps (
      id VARCHAR(36) PRIMARY KEY,
      automationId VARCHAR(36) NOT NULL,
      sortOrder INT DEFAULT 0,
      type VARCHAR(64) NOT NULL,
      config JSON,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_automation (automationId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_automation_runs (
      id VARCHAR(36) PRIMARY KEY,
      automationId VARCHAR(36) NOT NULL,
      contactId VARCHAR(36),
      opportunityId VARCHAR(36),
      status VARCHAR(50) DEFAULT 'running',
      triggeredAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      completedAt TIMESTAMP NULL,
      metadata JSON,
      INDEX idx_automation (automationId),
      INDEX idx_contact (contactId),
      INDEX idx_status (status),
      INDEX idx_triggered (triggeredAt)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS crm_automation_run_steps (
      id VARCHAR(36) PRIMARY KEY,
      runId VARCHAR(36) NOT NULL,
      stepId VARCHAR(36) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      result JSON,
      executedAt TIMESTAMP NULL,
      INDEX idx_run (runId)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_voice_agents (
      id VARCHAR(36) PRIMARY KEY,
      userId INT,
      npcId VARCHAR(128),
      name VARCHAR(255) NOT NULL,
      type ENUM('chat','voice') DEFAULT 'voice',
      phoneNumber VARCHAR(50),
      siteId VARCHAR(36),
      consultantId VARCHAR(36),
      twilioConfig JSON,
      isActive BOOLEAN DEFAULT TRUE,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_user (userId),
      INDEX idx_site (siteId),
      INDEX idx_consultant (consultantId),
      INDEX idx_npc (npcId)
    )
  `);
}
