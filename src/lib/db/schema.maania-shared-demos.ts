import { mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const maaniaSharedDemos = mysqlTable("maania_shared_demos", {
  id: varchar("id", { length: 36 }).primaryKey(),
  slug: varchar("slug", { length: 16 }).notNull().unique(),
  kind: mysqlEnum("kind", ["buyer", "ret"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  payloadJson: text("payloadJson").notNull(),
  schemaJson: text("schemaJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaaniaSharedDemoRow = typeof maaniaSharedDemos.$inferSelect;
export type InsertMaaniaSharedDemoRow = typeof maaniaSharedDemos.$inferInsert;
