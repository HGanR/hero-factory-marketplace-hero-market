// Policy Snapshot Generator - Production Guardrails
// Generates immutable JSON snapshots of governance state for audit trails

import { getDb } from "@/lib/db";
import { governanceAssignments, workflowClientProfiles } from "@/lib/db/schema";
import { insertAuditLog } from "@/lib/audit";
import { and, eq } from "drizzle-orm";
import crypto from "crypto";

export interface GovernanceSnapshot {
  id: string;
  entityType: "trust" | "family_office" | "foundation" | "dao_wrapper";
  entityId: string;
  action: string;
  timestamp: string;
  governanceState: {
    activeProtectors: Array<{
      assignmentId: string;
      clientProfileId: string;
      fullName: string;
      powers: string[];
      triggers: any;
      activatedAt?: string;
    }>;
    policyRules: {
      requiredApprovals: string[];
      blockingConditions: string[];
    };
  };
  snapshotHash: string; // For integrity verification
}

/**
 * Generates a policy snapshot for governance decisions
 * Call this before any gated action to create immutable audit trail
 */
export async function generateGovernanceSnapshot(
  entityType: "trust" | "family_office" | "foundation" | "dao_wrapper",
  entityId: string,
  action: string
): Promise<GovernanceSnapshot> {
  const db = await getDb();
  const snapshotId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  // Get all active protectors for this entity
  const activeAssignments = await db
    .select({
      id: governanceAssignments.id,
      clientProfileId: governanceAssignments.clientProfileId,
      powersJson: governanceAssignments.powersJson,
      triggersJson: governanceAssignments.triggersJson,
      activatedAt: governanceAssignments.activatedAt,
      fullName: workflowClientProfiles.fullName,
    })
    .from(governanceAssignments)
    .innerJoin(
      workflowClientProfiles,
      eq(governanceAssignments.clientProfileId, workflowClientProfiles.id)
    )
    .where(
      and(
        eq(governanceAssignments.entityType, entityType),
        eq(governanceAssignments.entityId, entityId),
        eq(governanceAssignments.role, "trust_protector"),
        eq(governanceAssignments.status, "active")
      )
    );

  // Evaluate which protectors are currently active for this action
  const activeProtectors = activeAssignments
    .filter(assignment => {
      const powers = JSON.parse(assignment.powersJson || "{}");
      const triggers = JSON.parse(assignment.triggersJson || "{}");

      // Check if this protector has the required power
      const hasRequiredPower = powers[action] === true;

      // Evaluate trigger conditions (simplified - in production you'd have more complex logic)
      const isTriggerActive = evaluateTriggerState(triggers, entityType, entityId);

      return hasRequiredPower && isTriggerActive;
    })
    .map(assignment => ({
      assignmentId: assignment.id,
      clientProfileId: assignment.clientProfileId,
      fullName: assignment.fullName || "Unknown Protector",
      powers: Object.keys(JSON.parse(assignment.powersJson || "{}")).filter(
        power => JSON.parse(assignment.powersJson || "{}")[power] === true
      ),
      triggers: JSON.parse(assignment.triggersJson || "{}"),
      activatedAt: assignment.activatedAt || undefined,
    }));

  // Build policy rules summary
  const policyRules = {
    requiredApprovals: activeProtectors.length > 0 ? [action] : [],
    blockingConditions: activeProtectors.map(p => `${p.fullName} (${p.assignmentId})`).join(", "),
  };

  const governanceState = {
    activeProtectors,
    policyRules,
  };

  // Create snapshot object
  const snapshot: GovernanceSnapshot = {
    id: snapshotId,
    entityType,
    entityId,
    action,
    timestamp,
    governanceState,
    snapshotHash: "", // Will be set after hashing
  };

  // Generate integrity hash
  const snapshotData = JSON.stringify({
    id: snapshot.id,
    entityType: snapshot.entityType,
    entityId: snapshot.entityId,
    action: snapshot.action,
    timestamp: snapshot.timestamp,
    governanceState: snapshot.governanceState,
  });
  snapshot.snapshotHash = crypto.createHash('sha256').update(snapshotData).digest('hex');

  // Store snapshot in audit log for immutability
  await insertAuditLog(db, {
    actorUserId: 0, // System-generated
    action: "POLICY_SNAPSHOT_GENERATED",
    entityType: "governance_policy",
    entityId: snapshotId,
    metadata: {
      snapshot: snapshot,
      integrityHash: snapshot.snapshotHash,
    },
  });

  return snapshot;
}

/**
 * Simplified trigger evaluation - in production this would be more sophisticated
 */
function evaluateTriggerState(
  triggers: any,
  entityType: string,
  entityId: string
): boolean {
  // For demo purposes - evaluate based on activation mode
  switch (triggers.activationMode) {
    case "immediate":
      return true;
    case "upon_incapacity":
      // Would check entity state for incapacity indicators
      return false; // Placeholder
    case "upon_death":
      // Would check for death certificate or similar
      return false; // Placeholder
    case "upon_irrevocable_conversion":
      // Would check trust type
      return false; // Placeholder
    case "custom":
      // Would evaluate custom conditions
      return false; // Placeholder
    default:
      return false;
  }
}

/**
 * Verifies snapshot integrity during audits
 */
export function verifySnapshotIntegrity(snapshot: GovernanceSnapshot): boolean {
  const snapshotData = JSON.stringify({
    id: snapshot.id,
    entityType: snapshot.entityType,
    entityId: snapshot.entityId,
    action: snapshot.action,
    timestamp: snapshot.timestamp,
    governanceState: snapshot.governanceState,
  });

  const computedHash = crypto.createHash('sha256').update(snapshotData).digest('hex');
  return computedHash === snapshot.snapshotHash;
}

/**
 * Retrieves historical snapshots for audit purposes
 */
export async function getHistoricalSnapshots(
  entityId: string,
  action?: string,
  limit: number = 50
) {
  const db = await getDb();

  const snapshots = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.entityType, "governance_policy"),
        eq(auditLogs.action, "POLICY_SNAPSHOT_GENERATED"),
        action ? sql`JSON_EXTRACT(${auditLogs.metadata}, '$.snapshot.action') = ${action}` : undefined
      )
    )
    .where(sql`JSON_EXTRACT(${auditLogs.metadata}, '$.snapshot.entityId') = ${entityId}`)
    .orderBy(desc(auditLogs.timestamp))
    .limit(limit);

  return snapshots.map(log => {
    const snapshot = JSON.parse(log.metadata).snapshot;
    return {
      ...snapshot,
      integrityVerified: verifySnapshotIntegrity(snapshot),
    };
  });
}
