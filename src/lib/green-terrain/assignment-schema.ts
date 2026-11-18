import { mysqlTable, varchar, timestamp, mysqlEnum } from "drizzle-orm/mysql-core";

/** Independent assignments: never overwrite NPCs or world placements. */
export const greenTerrainAgentAssignments = mysqlTable("green_terrain_agent_assignments", {
  worldId: varchar("world_id", { length: 128 }).notNull(),
  buildingId: varchar("building_id", { length: 128 }).notNull(),
  source: mysqlEnum("source", ["npc", "ai-agency"]).notNull(),
  agentId: varchar("agent_id", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["published", "unlisted"]).notNull().default("unlisted"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
