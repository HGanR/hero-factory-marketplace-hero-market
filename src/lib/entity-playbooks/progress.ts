import type { EntityPlaybook } from "./types";
import { DaoTokenVotingConstitutionSchema } from "@/lib/governance/constitution/dao-token-voting/schema";
import { DAO_FIELD_BINDINGS, DAO_FIELD_ORDER } from "@/lib/governance/constitution/dao-token-voting/bindings";
import {
  FamilyOfficePlaybookStateSchema,
  evaluateFamilyOfficeReadiness,
} from "@/lib/playbooks/family-office/schema";

type DocumentStatus = "complete" | "blocked" | "in_progress";

export type PlaybookDocumentStatus = {
  docId: string;
  docType: string;
  subtype?: string;
  status: DocumentStatus;
  missingRequired: number;
};

function getDaoMissingFields(payload: unknown): string[] {
  const parsed = DaoTokenVotingConstitutionSchema.safeParse(payload);
  if (parsed.success) return [];
  const keys = parsed.error.issues
    .map((issue) => String(issue.path[0] ?? ""))
    .filter((key) => Boolean(key) && DAO_FIELD_BINDINGS[key]);
  const unique = Array.from(new Set(keys));
  return DAO_FIELD_ORDER.filter((key) => unique.includes(key));
}

export function getPlaybookDocumentStatuses(playbook: EntityPlaybook, draft: any): PlaybookDocumentStatus[] {
  return playbook.documents.map((doc) => {
    const docId = `${doc.docType}:${doc.subtype ?? "base"}:${doc.schemaVersion}`;
    if (doc.docType === "constitution" && doc.subtype === "dao_token_voting") {
      const payload = draft?.constitutionDraft?.data ?? draft?.constitutionDraft ?? {};
      const missingFields = getDaoMissingFields(payload);
      const missingRequired = missingFields.filter((key) => {
        const binding = DAO_FIELD_BINDINGS[key];
        return binding?.required === true || binding?.required === "conditional";
      });
      if (missingRequired.length === 0) {
        return { docId, docType: doc.docType, subtype: doc.subtype, status: "complete", missingRequired: 0 };
      }
      const hasAny = payload && typeof payload === "object" && Object.keys(payload).length > 0;
      return {
        docId,
        docType: doc.docType,
        subtype: doc.subtype,
        status: hasAny ? "in_progress" : "blocked",
        missingRequired: missingRequired.length,
      };
    }
    if (doc.subtype === "family_office_playbook") {
      const payload = draft?.familyOfficePlaybookState ?? draft?.playbookState ?? {};
      const parsed = FamilyOfficePlaybookStateSchema.safeParse(payload);
      if (!parsed.success) {
        return { docId, docType: doc.docType, subtype: doc.subtype, status: "blocked", missingRequired: 1 };
      }
      const readiness = evaluateFamilyOfficeReadiness(parsed.data);
      return {
        docId,
        docType: doc.docType,
        subtype: doc.subtype,
        status: readiness.isReady ? "complete" : "in_progress",
        missingRequired: readiness.blockers.length,
      };
    }
    return { docId, docType: doc.docType, subtype: doc.subtype, status: "in_progress", missingRequired: 0 };
  });
}

export function getPlaybookProgress(playbook: EntityPlaybook, draft: any) {
  const statuses = getPlaybookDocumentStatuses(playbook, draft);
  const total = statuses.length;
  const completed = statuses.filter((s) => s.status === "complete").length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  const current = statuses.find((s) => s.status !== "complete") ?? statuses[statuses.length - 1];
  return {
    completed,
    total,
    percent,
    currentDocId: current?.docId ?? null,
    currentDocTitle: current ? `${current.docType}${current.subtype ? `:${current.subtype}` : ""}` : null,
  };
}
