/**
 * Wreck Room social space — isolated table names to avoid collisions with the rest of the app.
 */
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

export const wreckRooms = mysqlTable("wreck_rooms", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  maxUsers: int("maxUsers").default(20).notNull(),
  isPublic: int("isPublic").default(1).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const wreckMessages = mysqlTable("wreck_messages", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull(),
  userId: int("userId"),
  username: varchar("username", { length: 128 }).notNull(),
  content: text("content").notNull(),
  type: mysqlEnum("type", ["chat", "system", "emote"]).default("chat").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const wreckRoomThemes = mysqlTable("wreck_room_themes", {
  id: int("id").autoincrement().primaryKey(),
  roomId: int("roomId").notNull().unique(),
  lightingColor: varchar("lightingColor", { length: 16 }).default("#ff0080"),
  musicGenre: varchar("musicGenre", { length: 64 }).default("Electronic"),
  passwordHash: varchar("passwordHash", { length: 256 }),
  ambiance: varchar("ambiance", { length: 32 }).default("club"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WreckRoomRow = typeof wreckRooms.$inferSelect;
export type WreckMessageRow = typeof wreckMessages.$inferSelect;
export type WreckRoomThemeRow = typeof wreckRoomThemes.$inferSelect;
