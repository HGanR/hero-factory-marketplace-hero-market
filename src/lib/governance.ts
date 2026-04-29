// Governance Enforcement & Trust Protector Utilities
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { governanceAssignments, workflowClientProfiles } from "@/lib/db/schema";
import { insertAuditLog } from "@/lib/audit";

export interface TrustProtectorPowers {
  remove_replace_trustee?: boolean;
  approve_trustee_resignation?: boolean;
  resolve_ambiguities?: boolean;
  approve_situs_change?: boolean;
  approve_decanting?: boolean;
  consent_administrative_amendments?: boolean;
  veto_extraordinary_transactions?: boolean;
}

export interface TrustProtectorTriggers {
  activationMode: "immediate" | "upon_incapacity" | "upon_death" | "upon_irrevocable_conversion" | "custom";
  customTriggerDescription?: string;
}

export interface GovernanceApproval {
  assignmentId: string;
  clientProfileId: string;
  approvedPowers: string[]; // Which powers were used for approval
  approvalTimestamp: string;
  approvedAction: string; // e.g., "trustee_replacement", "decanting", "package_approval"
  metadata?: Record<string, any>; // Additional context
}

// Check if an action requires Trust Protector approval
export async function requiresTrustProtectorApproval(
  entityType: "trust",
  entityId: string,
  action: string
): Promise<{ required: boolean; protectors: any[] }> {
  const db = await getDb();

  // Get active Trust Protector assignments for this entity
  const assignments = await db
    .select({
      assignment: governanceAssignments,
      clientProfile: {
        id: workflowClientProfiles.id,
        publicId: workflowClientProfiles.publicId,
        fullName: workflowClientProfiles.fullName,
        email: workflowClientProfiles.email,
      },
    })
    .from(governanceAssignments)
    .leftJoin(workflowClientProfiles, eq(governanceAssignments.clientProfileId, workflowClientProfiles.id))
    .where(and(
      eq(governanceAssignments.entityType, entityType),
      eq(governanceAssignments.entityId, entityId),
      eq(governanceAssignments.role, "trust_protector"),
      eq(governanceAssignments.status, "active")
    ));

  if (assignments.length === 0) {
    return { required: false, protectors: [] };
  }

  // Check if any protector has the required power for this action
  const protectorsWithPower = assignments.filter(assignment => {
    const powers: TrustProtectorPowers = JSON.parse(assignment.assignment.powersJson);

    switch (action) {
      case "trustee_replacement":
      case "trustee_removal":
        return powers.remove_replace_trustee;
      case "trustee_resignation":
        return powers.approve_trustee_resignation;
      case "decanting":
        return powers.approve_decanting;
      case "situs_change":
      case "governing_law_change":
        return powers.approve_situs_change;
      case "administrative_amendment":
        return powers.consent_administrative_amendments;
      case "extraordinary_transaction":
        return powers.veto_extraordinary_transactions;
      case "package_ready_for_review":
        // Packages might require multiple powers depending on contents
        return powers.consent_administrative_amendments || powers.approve_decanting;
      default:
        return false;
    }
  });

  return {
    required: protectorsWithPower.length > 0,
    protectors: protectorsWithPower.map(row => ({
      id: row.assignment.id,
      clientProfile: row.clientProfile,
      powers: JSON.parse(row.assignment.powersJson),
      triggers: row.assignment.triggersJson ? JSON.parse(row.assignment.triggersJson) : null,
    }))
  };
}

// Check if a Trust Protector's powers are currently active
export async function isTrustProtectorActive(
  assignmentId: string,
  currentConditions?: {
    trustIsIrrevocable?: boolean;
    incapacityDeclared?: boolean;
    grantorDeceased?: boolean;
  }
): Promise<boolean> {
  const db = await getDb();

  const assignment = await db
    .select()
    .from(governanceAssignments)
    .where(eq(governanceAssignments.id, assignmentId))
    .limit(1);

  if (assignment.length === 0) return false;

  const triggers: TrustProtectorTriggers | null = assignment[0].triggersJson
    ? JSON.parse(assignment[0].triggersJson)
    : null;

  if (!triggers) return true; // Default to active if no triggers specified

  switch (triggers.activationMode) {
    case "immediate":
      return true;
    case "upon_incapacity":
      return currentConditions?.incapacityDeclared || false;
    case "upon_death":
      return currentConditions?.grantorDeceased || false;
    case "upon_irrevocable_conversion":
      return currentConditions?.trustIsIrrevocable || false;
    case "custom":
      // For custom triggers, require explicit activation (manual process)
      return assignment[0].activatedAt !== null;
    default:
      return false;
  }
}

// Record a Trust Protector approval
export async function recordGovernanceApproval(
  assignmentId: string,
  approvedAction: string,
  approvedPowers: string[],
  userId: number,
  metadata?: Record<string, any>
): Promise<string> {
  const db = await getDb();

  const approvalId = `approval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Log the governance approval as an audit event
  await insertAuditLog(db, {
    actorUserId: userId,
    action: "TRUST_PROTECTOR_APPROVAL",
    entityType: "governance_assignment",
    entityId: assignmentId,
    metadata: {
      approvalId,
      approvedAction,
      approvedPowers,
      metadata,
      timestamp: new Date().toISOString(),
    },
  });

  // Update the assignment's last activity
  await db
    .update(governanceAssignments)
    .set({
      updatedAt: sql`NOW()`,
    })
    .where(eq(governanceAssignments.id, assignmentId));

  return approvalId;
}

// Get all governance assignments for an entity
export async function getEntityGovernanceAssignments(
  entityType: "trust" | "family_office" | "foundation" | "dao_wrapper",
  entityId: string
) {
  const db = await getDb();

  const assignments = await db
    .select({
      assignment: governanceAssignments,
      clientProfile: {
        id: workflowClientProfiles.id,
        publicId: workflowClientProfiles.publicId,
        fullName: workflowClientProfiles.fullName,
        email: workflowClientProfiles.email,
      },
    })
    .from(governanceAssignments)
    .leftJoin(workflowClientProfiles, eq(governanceAssignments.clientProfileId, workflowClientProfiles.id))
    .where(and(
      eq(governanceAssignments.entityType, entityType),
      eq(governanceAssignments.entityId, entityId)
    ));

  return assignments.map(row => ({
    id: row.assignment.id,
    entityType: row.assignment.entityType,
    entityId: row.assignment.entityId,
    clientProfileId: row.assignment.clientProfileId,
    role: row.assignment.role,
    powersJson: JSON.parse(row.assignment.powersJson),
    triggersJson: row.assignment.triggersJson ? JSON.parse(row.assignment.triggersJson) : null,
    status: row.assignment.status,
    assignedBy: row.assignment.assignedBy,
    assignedAt: row.assignment.assignedAt?.toISOString(),
    activatedAt: row.assignment.activatedAt?.toISOString(),
    clientProfile: row.clientProfile,
  }));
}
