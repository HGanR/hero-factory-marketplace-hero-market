import { getDb, getConnection } from "@/lib/db";
import { sql } from "drizzle-orm";

const NEW_COLUMNS: Array<[string, string]> = [
  ["legalStatus", "TEXT"],
  ["taxId", "VARCHAR(64)"],
  ["governingDocs", "TEXT"],
  ["complianceCerts", "TEXT"],
  ["insuranceCoverage", "TEXT"],
  ["orgLegalName", "VARCHAR(255)"],
  ["orgContactInfo", "TEXT"],
  ["orgEntityType", "VARCHAR(100)"],
  ["missionStatement", "TEXT"],
  ["visionStatement", "TEXT"],
  ["geographicAreas", "TEXT"],
  ["projectSummary", "TEXT"],
  ["primaryGoals", "TEXT"],
  ["specificFundingNeeds", "TEXT"],
  ["supportingEvidence", "TEXT"],
  ["currentEfforts", "TEXT"],
  ["stakeholders", "TEXT"],
  ["alignmentStatement", "TEXT"],
  ["alignmentSupportingDocs", "TEXT"],
  ["staffExpertise", "TEXT"],
  ["pastSuccesses", "TEXT"],
  ["financialStability", "TEXT"],
  ["resources", "TEXT"],
  ["partnerships", "TEXT"],
  ["sustainabilityPlan", "TEXT"],
  ["longTermImpact", "TEXT"],
  ["replicationScalability", "TEXT"],
  ["matchingFunds", "TEXT"],
  ["fundingSources", "TEXT"],
  ["costJustification", "TEXT"],
  ["evaluationMetrics", "TEXT"],
  ["monitoringPlan", "TEXT"],
  ["dataCollectionMethods", "TEXT"],
  ["reportingSchedule", "TEXT"],
  ["projectLeader", "TEXT"],
  ["financialContact", "TEXT"],
  ["authorizedSignatories", "TEXT"],
  ["otherRelevantDocs", "TEXT"],
  ["flexibilityModifications", "TEXT"],
  ["referralSources", "TEXT"],
  ["ethicalAcknowledgment", "TINYINT(1) DEFAULT 0"],
];

export async function ensureGrantApplicationsTable() {
  const db = await getDb();
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS grant_applications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT,
      walletAddress VARCHAR(42),
      title VARCHAR(255) NOT NULL,
      funderName VARCHAR(255),
      deadline DATE,
      amountRequested VARCHAR(64),
      status ENUM('draft','submitted','awarded','declined') NOT NULL DEFAULT 'draft',
      narrative TEXT,
      needsStatement TEXT,
      goals TEXT,
      methodology TEXT,
      budget TEXT,
      timeline TEXT,
      legalStatus TEXT,
      taxId VARCHAR(64),
      governingDocs TEXT,
      complianceCerts TEXT,
      insuranceCoverage TEXT,
      orgLegalName VARCHAR(255),
      orgContactInfo TEXT,
      orgEntityType VARCHAR(100),
      missionStatement TEXT,
      visionStatement TEXT,
      geographicAreas TEXT,
      projectSummary TEXT,
      primaryGoals TEXT,
      specificFundingNeeds TEXT,
      supportingEvidence TEXT,
      currentEfforts TEXT,
      stakeholders TEXT,
      alignmentStatement TEXT,
      alignmentSupportingDocs TEXT,
      staffExpertise TEXT,
      pastSuccesses TEXT,
      financialStability TEXT,
      resources TEXT,
      partnerships TEXT,
      sustainabilityPlan TEXT,
      longTermImpact TEXT,
      replicationScalability TEXT,
      matchingFunds TEXT,
      fundingSources TEXT,
      costJustification TEXT,
      evaluationMetrics TEXT,
      monitoringPlan TEXT,
      dataCollectionMethods TEXT,
      reportingSchedule TEXT,
      projectLeader TEXT,
      financialContact TEXT,
      authorizedSignatories TEXT,
      otherRelevantDocs TEXT,
      flexibilityModifications TEXT,
      referralSources TEXT,
      ethicalAcknowledgment TINYINT(1) DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX idx_user (userId),
      INDEX idx_status (status)
    )
  `);
  // Add new columns to existing tables (ignores duplicate column errors)
  const conn = await getConnection();
  for (const [col, def] of NEW_COLUMNS) {
    try {
      await (conn as any).query(`ALTER TABLE grant_applications ADD COLUMN \`${col}\` ${def}`);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as any).message) : "";
      if (!msg.includes("Duplicate column")) throw e;
    }
  }
}
