import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

/** Creates challenge tables if they don't exist. Call before first challenge API use. */
export async function ensureChallengeTables() {
  const db = await getDb();

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS challenge_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      submissionId VARCHAR(64) NOT NULL,
      userId VARCHAR(64) NOT NULL,
      challengeKey VARCHAR(64) NOT NULL,
      rulesVersion VARCHAR(16) NOT NULL,
      rubricVersion VARCHAR(16) NOT NULL,
      scoringVersion VARCHAR(16) NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'draft',
      answers JSON,
      totalScore INT,
      phaseScores JSON,
      submissionHash VARCHAR(64),
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      UNIQUE KEY challenge_submissions_submissionId_unique (submissionId),
      INDEX challenge_submissions_user_idx (userId),
      INDEX challenge_submissions_challenge_key_idx (challengeKey),
      INDEX challenge_submissions_status_idx (status)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS challenge_credits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      submissionId VARCHAR(64) NOT NULL,
      userId VARCHAR(64) NOT NULL,
      challengeKey VARCHAR(64) NOT NULL,
      creditType VARCHAR(48) NOT NULL,
      amount INT NOT NULL,
      appliedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      UNIQUE KEY challenge_credits_submissionId_unique (submissionId),
      INDEX challenge_credits_user_idx (userId),
      INDEX challenge_credits_challenge_key_idx (challengeKey)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS challenge_audit_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      submissionId VARCHAR(64) NOT NULL,
      userId VARCHAR(64) NOT NULL,
      action VARCHAR(64) NOT NULL,
      details TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      INDEX challenge_audit_log_submission_idx (submissionId)
    )
  `);
}
