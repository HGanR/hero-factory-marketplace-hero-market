import { sql } from "drizzle-orm";
import type { getDb } from "@/lib/db";

type Db = Awaited<ReturnType<typeof getDb>>;

/** Dev/safety DDL — production should migrate via SQL. */
export async function ensureWidgetConversationTables(db: Db) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS widget_conversations (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      widget_binding_id VARCHAR(36) NOT NULL,
      widget_key_snapshot VARCHAR(48) NOT NULL,
      site_id VARCHAR(36) NULL,
      site_version_id VARCHAR(36) NULL,
      agent_id VARCHAR(36) NULL,
      owner_user_id INT NULL,
      public_conversation_id VARCHAR(48) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'active',
      started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_message_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      origin_host VARCHAR(255) NULL,
      visitor_id VARCHAR(64) NULL,
      session_id VARCHAR(128) NULL,
      provider_strategy_snapshot VARCHAR(32) NULL,
      metadata_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY widget_conversations_public_id_uidx (public_conversation_id),
      KEY widget_conversations_binding_idx (widget_binding_id),
      KEY widget_conversations_site_idx (site_id),
      KEY widget_conversations_last_msg_idx (last_message_at)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS widget_messages (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      conversation_id VARCHAR(36) NOT NULL,
      role VARCHAR(16) NOT NULL,
      content_text TEXT NOT NULL,
      provider_strategy_snapshot VARCHAR(32) NULL,
      model_snapshot VARCHAR(128) NULL,
      token_usage_json JSON NULL,
      latency_ms INT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'ok',
      error_code VARCHAR(64) NULL,
      metadata_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY widget_messages_conversation_idx (conversation_id),
      KEY widget_messages_created_idx (created_at)
    )
  `);
}
