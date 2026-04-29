import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export async function ensureNpcTables(db?: Awaited<ReturnType<typeof getDb>>) {
  const targetDb = db ?? (await getDb());

  await targetDb.execute(sql`
    CREATE TABLE IF NOT EXISTS oasis_npcs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      npcId VARCHAR(128) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      role VARCHAR(32) NOT NULL,
      title VARCHAR(200),
      avatarEmoji VARCHAR(16) NOT NULL DEFAULT '🤖',
      voiceStyle VARCHAR(32) DEFAULT 'friendly',
      worldId VARCHAR(128),
      ownerId INT,
      greeting TEXT,
      farewell TEXT,
      personalityJson TEXT,
      mood VARCHAR(32) NOT NULL DEFAULT 'neutral',
      isDefault BOOLEAN NOT NULL DEFAULT false,
      isActive BOOLEAN NOT NULL DEFAULT true,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
    )
  `);

  try {
    await targetDb.execute(sql`ALTER TABLE oasis_npcs ADD COLUMN language VARCHAR(16)`);
  } catch {
    /* column may already exist */
  }
  try {
    await targetDb.execute(sql`ALTER TABLE oasis_npcs ADD COLUMN buildingId VARCHAR(64)`);
  } catch {
    /* column may already exist */
  }
  try {
    await targetDb.execute(sql`ALTER TABLE oasis_npcs ADD COLUMN floor INT`);
  } catch {
    /* column may already exist */
  }
  try {
    await targetDb.execute(sql`ALTER TABLE oasis_npcs ADD COLUMN telegramBotToken VARCHAR(256)`);
  } catch {
    /* column may already exist */
  }
  try {
    await targetDb.execute(sql`ALTER TABLE oasis_npcs ADD COLUMN telegramWebhookKey VARCHAR(64)`);
  } catch {
    /* column may already exist */
  }
  try {
    await targetDb.execute(sql`ALTER TABLE oasis_npcs ADD COLUMN telegramConnectedAt TIMESTAMP NULL`);
  } catch {
    /* column may already exist */
  }

  await targetDb.execute(sql`
    CREATE TABLE IF NOT EXISTS oasis_npc_knowledge (
      id INT AUTO_INCREMENT PRIMARY KEY,
      npcId INT NOT NULL,
      topic VARCHAR(255) NOT NULL,
      keywords TEXT NOT NULL,
      content TEXT NOT NULL,
      priority INT NOT NULL DEFAULT 5,
      category VARCHAR(32) NOT NULL DEFAULT 'general',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_npc (npcId),
      CONSTRAINT fk_oasis_npc_knowledge_npc FOREIGN KEY (npcId) REFERENCES oasis_npcs(id) ON DELETE CASCADE
    )
  `);

  await targetDb.execute(sql`
    CREATE TABLE IF NOT EXISTS oasis_npc_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sessionId VARCHAR(128) NOT NULL UNIQUE,
      npcId INT NOT NULL,
      npcNpcId VARCHAR(128) NOT NULL,
      userId INT,
      currentTopic VARCHAR(255),
      messageCount INT NOT NULL DEFAULT 0,
      startedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      lastActivity TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      endedAt TIMESTAMP NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_session_npc (npcId),
      CONSTRAINT fk_oasis_npc_sessions_npc FOREIGN KEY (npcId) REFERENCES oasis_npcs(id) ON DELETE CASCADE
    )
  `);

  try {
    await targetDb.execute(sql`ALTER TABLE oasis_npc_sessions ADD COLUMN jarvaWorkflowPath VARCHAR(64) NULL`);
  } catch {
    /* column may already exist */
  }

  await targetDb.execute(sql`
    CREATE TABLE IF NOT EXISTS oasis_npc_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sessionId INT NOT NULL,
      role VARCHAR(16) NOT NULL,
      content TEXT NOT NULL,
      intent VARCHAR(100),
      intentConfidence INT,
      sentiment VARCHAR(16),
      responseSource VARCHAR(16),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_session (sessionId),
      CONSTRAINT fk_oasis_npc_messages_session FOREIGN KEY (sessionId) REFERENCES oasis_npc_sessions(id) ON DELETE CASCADE
    )
  `);
}
