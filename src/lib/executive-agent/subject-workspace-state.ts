import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";
import {
  getExecutiveSubject,
  type ExecutiveSubjectId,
} from "@/lib/executive-agent/executive-subject-nav";

/** Contextual workspace focus for Skipper — read-only orchestration scope. */
export type SubjectWorkspaceKind =
  | "desk"
  | "website"
  | "trust"
  | "revenue_os"
  | "smart_trust"
  | "client"
  | "fulfillment_case";

export type SubjectWorkspaceScope = {
  subjectId: ExecutiveSubjectId;
  workspaceKind: SubjectWorkspaceKind;
  /** Active fulfillment department when department-scoped. */
  department: FulfillmentOrchestrationDepartment | null;
  clientId: string | null;
  orderId: string | null;
  label: string;
};

export type ResolveSubjectWorkspaceInput = {
  subjectId: ExecutiveSubjectId;
  clientId?: string | null;
  orderId?: string | null;
  /** When set, overrides department inference for fulfillment_case. */
  orderDepartment?: FulfillmentOrchestrationDepartment | null;
};

export function resolveSubjectWorkspace(input: ResolveSubjectWorkspaceInput): SubjectWorkspaceScope {
  const clientId = input.clientId?.trim() || null;
  const orderId = input.orderId?.trim() || null;
  const subject = getExecutiveSubject(input.subjectId);

  if (orderId) {
    const dept = input.orderDepartment ?? inferDepartmentFromSubject(input.subjectId);
    return {
      subjectId: input.subjectId,
      workspaceKind: "fulfillment_case",
      department: dept,
      clientId,
      orderId,
      label: `Fulfillment case · ${dept ?? "order"} ${orderId.slice(0, 8)}…`,
    };
  }

  if (clientId && input.subjectId === "site_builder") {
    return {
      subjectId: input.subjectId,
      workspaceKind: "website",
      department: "WEBSITE",
      clientId,
      orderId: null,
      label: `WEBSITE client · ${clientId.slice(0, 8)}…`,
    };
  }

  if (clientId && input.subjectId === "trust_jarva") {
    return {
      subjectId: input.subjectId,
      workspaceKind: "trust",
      department: "TRUST",
      clientId,
      orderId: null,
      label: `TRUST client · ${clientId.slice(0, 8)}…`,
    };
  }

  if (clientId && input.subjectId === "revenue_os") {
    return {
      subjectId: input.subjectId,
      workspaceKind: "revenue_os",
      department: "REVENUE_OS",
      clientId,
      orderId: null,
      label: `REVENUE_OS client · ${clientId.slice(0, 8)}…`,
    };
  }

  if (clientId && input.subjectId === "smart_trust") {
    return {
      subjectId: input.subjectId,
      workspaceKind: "smart_trust",
      department: "SMART_TRUST",
      clientId,
      orderId: null,
      label: `SMART_TRUST client · ${clientId.slice(0, 8)}…`,
    };
  }

  if (clientId) {
    return {
      subjectId: input.subjectId,
      workspaceKind: "client",
      department: inferDepartmentFromSubject(input.subjectId),
      clientId,
      orderId: null,
      label: `Client workspace · ${clientId.slice(0, 8)}…`,
    };
  }

  if (input.subjectId === "site_builder") {
    return {
      subjectId: input.subjectId,
      workspaceKind: "website",
      department: "WEBSITE",
      clientId: null,
      orderId: null,
      label: "WEBSITE operations workspace",
    };
  }

  if (input.subjectId === "trust_jarva") {
    return {
      subjectId: input.subjectId,
      workspaceKind: "trust",
      department: "TRUST",
      clientId: null,
      orderId: null,
      label: "TRUST legal-review workspace",
    };
  }

  if (input.subjectId === "revenue_os") {
    return {
      subjectId: input.subjectId,
      workspaceKind: "revenue_os",
      department: "REVENUE_OS",
      clientId: null,
      orderId: null,
      label: "REVENUE_OS campaign fulfillment workspace",
    };
  }

  if (input.subjectId === "smart_trust") {
    return {
      subjectId: input.subjectId,
      workspaceKind: "smart_trust",
      department: "SMART_TRUST",
      clientId: null,
      orderId: null,
      label: "Smart Trust governance workspace",
    };
  }

  if (input.subjectId === "crm_intelligence") {
    return {
      subjectId: input.subjectId,
      workspaceKind: "desk",
      department: null,
      clientId: null,
      orderId: null,
      label: "CRM intelligence desk",
    };
  }

  return {
    subjectId: input.subjectId,
    workspaceKind: "desk",
    department: inferDepartmentFromSubject(input.subjectId),
    clientId: null,
    orderId: null,
    label: `${subject.navLabel} desk`,
  };
}

function inferDepartmentFromSubject(
  subjectId: ExecutiveSubjectId
): FulfillmentOrchestrationDepartment | null {
  if (subjectId === "site_builder") return "WEBSITE";
  if (subjectId === "trust_jarva") return "TRUST";
  if (subjectId === "revenue_os") return "REVENUE_OS";
  if (subjectId === "smart_trust") return "SMART_TRUST";
  return null;
}

export function departmentFilterForScope(
  scope: SubjectWorkspaceScope
): FulfillmentOrchestrationDepartment | null {
  return scope.department;
}

export function scopeRequiresClient(scope: SubjectWorkspaceScope): boolean {
  return scope.workspaceKind === "client" || scope.workspaceKind === "fulfillment_case";
}
