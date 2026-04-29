/**
 * Universal Identity Layer — Troo ID, wallet linkage
 * troo_identities: platform identity (Troo ID) linked to internal userId
 * troo_wallet_links: wallet addresses linked to an identity
 */
import {
  mysqlTable,
  mysqlEnum,
  int,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

export const trooIdentities = mysqlTable(
  "troo_identities",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    trooId: varchar("trooId", { length: 64 }).notNull(),
    userId: int("userId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    trooIdUidx: uniqueIndex("troo_identities_troo_id_uidx").on(table.trooId),
    userIdx: uniqueIndex("troo_identities_user_uidx").on(table.userId),
  })
);

export const trooWalletLinks = mysqlTable(
  "troo_wallet_links",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    identityId: varchar("identityId", { length: 36 }).notNull(),
    chain: varchar("chain", { length: 32 }).notNull(),
    address: varchar("address", { length: 128 }).notNull(),
    verifiedAt: timestamp("verifiedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    identityIdx: index("troo_wallet_links_identity_idx").on(table.identityId),
    chainAddressUidx: uniqueIndex("troo_wallet_links_chain_address_uidx").on(
      table.chain,
      table.address
    ),
  })
);
