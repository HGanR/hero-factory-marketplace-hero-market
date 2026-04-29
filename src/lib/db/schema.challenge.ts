// src/lib/db/schema.challenge.ts
// Spring 2026 Entity Build Skill Challenge
import { mysqlTable, int, varchar, text, timestamp, json, index } from "drizzle-orm/mysql-core";

export const challengeSubmissions = mysqlTable(
  "challenge_submissions",
  {
    id: int("id").autoincrement().primaryKey(),
    submissionId: varchar("submissionId", { length: 64 }).notNull().unique(),
    userId: varchar("userId", { length: 64 }).notNull(),
    challengeKey: varchar("challengeKey", { length: 64 }).notNull(),
    rulesVersion: varchar("rulesVersion", { length: 16 }).notNull(),
    rubricVersion: varchar("rubricVersion", { length: 16 }).notNull(),
    scoringVersion: varchar("scoringVersion", { length: 16 }).notNull(),
    status: varchar("status", { length: 24 }).default("draft").notNull(),
    answers: json("answers"),
    totalScore: int("totalScore"),
    phaseScores: json("phaseScores"),
    submissionHash: varchar("submissionHash", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("challenge_submissions_user_idx").on(table.userId),
    challengeKeyIdx: index("challenge_submissions_challenge_key_idx").on(table.challengeKey),
    statusIdx: index("challenge_submissions_status_idx").on(table.status),
  })
);

export const challengeCredits = mysqlTable(
  "challenge_credits",
  {
    id: int("id").autoincrement().primaryKey(),
    submissionId: varchar("submissionId", { length: 64 }).notNull().unique(),
    userId: varchar("userId", { length: 64 }).notNull(),
    challengeKey: varchar("challengeKey", { length: 64 }).notNull(),
    creditType: varchar("creditType", { length: 48 }).notNull(),
    amount: int("amount").notNull(),
    appliedAt: timestamp("appliedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("challenge_credits_user_idx").on(table.userId),
    challengeKeyIdx: index("challenge_credits_challenge_key_idx").on(table.challengeKey),
  })
);

export const challengeAuditLog = mysqlTable(
  "challenge_audit_log",
  {
    id: int("id").autoincrement().primaryKey(),
    submissionId: varchar("submissionId", { length: 64 }).notNull(),
    userId: varchar("userId", { length: 64 }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    details: text("details"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    submissionIdx: index("challenge_audit_log_submission_idx").on(table.submissionId),
  })
);
