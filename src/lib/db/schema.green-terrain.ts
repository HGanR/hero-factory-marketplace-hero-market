import { mysqlTable, varchar, int, json, timestamp } from 'drizzle-orm/mysql-core';
import type {GreenLayout} from '@/lib/troo-world/green-terrain-layout';
export const greenTerrainLayouts=mysqlTable('green_terrain_layouts',{
 worldId:varchar('worldId',{length:64}).primaryKey(),
 revision:int('revision').notNull(),
 layout:json('layout').$type<GreenLayout>().notNull(),
 updatedAt:timestamp('updatedAt').defaultNow().onUpdateNow().notNull(),
});
