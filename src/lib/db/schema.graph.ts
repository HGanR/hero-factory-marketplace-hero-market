// src/lib/db/schema.graph.ts
// Canonical Business Graph: nodes and edges for economic relationships
import { mysqlTable, varchar, json, timestamp, index } from "drizzle-orm/mysql-core";

// -----------------------------
// Graph Nodes
// -----------------------------
export const graphNodes = mysqlTable(
  "graph_nodes",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    nodeType: varchar("nodeType", { length: 40 }).notNull(),
    refId: varchar("refId", { length: 120 }).notNull(),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    typeRefIdx: index("graph_nodes_type_ref_idx").on(table.nodeType, table.refId),
    typeIdx: index("graph_nodes_type_idx").on(table.nodeType),
  })
);

// -----------------------------
// Graph Edges
// -----------------------------
export const graphEdges = mysqlTable(
  "graph_edges",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    fromNodeId: varchar("fromNodeId", { length: 36 }).notNull(),
    toNodeId: varchar("toNodeId", { length: 36 }).notNull(),
    relationType: varchar("relationType", { length: 40 }).notNull(),
    metadata: json("metadata"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    fromIdx: index("graph_edges_from_idx").on(table.fromNodeId),
    toIdx: index("graph_edges_to_idx").on(table.toNodeId),
    relationIdx: index("graph_edges_relation_idx").on(table.relationType),
    fromToIdx: index("graph_edges_from_to_idx").on(table.fromNodeId, table.toNodeId),
  })
);
