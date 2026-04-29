/**
 * Financial Readiness Center — central state (persisted via persistence.ts).
 */

import type {
  CeaseCommunicationSources,
  CreditorVerificationSources,
  DebtValidationSources,
  DisputeLetterSources,
} from "./documentModels";
import { appendActivity } from "./activity";
import type { ActivityEntry } from "./activity";
import { computeFollowUpDueAt } from "./dueDateLogic";
import { applyOperationalToCase, applyOperationalToDoc, type OperationalOp } from "./operationalMap";
import { regenerateVaultText } from "./regenerateVaultText";
import type { CaseModule, FrCase, VaultDocument } from "./vaultTypes";
import { inferPrimaryParty } from "./vaultParty";

export const FR_PERSIST_VERSION = 4;

export type { OperationalOp } from "./operationalMap";

export type FoundationStepId =
  | "basics"
  | "utilization"
  | "checklist"
  | "next";

export type OptimizationStepId =
  | "report"
  | "negatives"
  | "dispute"
  | "letter"
  | "timeline";

export type ResolutionStepId =
  | "log"
  | "validation"
  | "cease"
  | "fdcpa"
  | "status";

export type NegativeItem = {
  id: string;
  creditor: string;
  amount: string;
  reason: string;
  selected: boolean;
};

export type CollectorEntry = {
  id: string;
  caseId: string | null;
  date: string;
  collector: string;
  channel: "call" | "letter" | "email" | "other";
  notes: string;
};

export type CaseStatus = "intake" | "validation_sent" | "cease_active" | "resolved";

export type HubPrimaryGoal = "foundation" | "optimization" | "resolution";

export type { VaultDocument, FrCase } from "./vaultTypes";

export type { ActivityEntry } from "./activity";

export type FinancialReadinessState = {
  meta: {
    version: number;
    updatedAt: string | null;
  };
  hub: {
    intakeCompleted: boolean;
    primaryGoal: HubPrimaryGoal | null;
    intakeCompletedAt: string | null;
  };
  cases: FrCase[];
  documents: VaultDocument[];
  activities: ActivityEntry[];
  foundation: {
    stepIndex: number;
    stepCompletion: Partial<Record<FoundationStepId, boolean>>;
    moduleCompleted: boolean;
    moduleCompletedAt: string | null;
    startedAt: string | null;
    basicsAcknowledged: boolean;
    utilization: { balance: number; limit: number };
    checklist: Record<string, boolean>;
    nextHint: string;
  };
  optimization: {
    stepIndex: number;
    stepCompletion: Partial<Record<OptimizationStepId, boolean>>;
    moduleCompleted: boolean;
    moduleCompletedAt: string | null;
    startedAt: string | null;
    activeCaseId: string | null;
    reportNotes: string;
    negativeItems: NegativeItem[];
    dispute: { creditor: string; accountLast4: string; reason: string; details: string };
    disputeMeta: {
      consumerName: string;
      consumerAddress: string;
      bureau: string;
    };
    creditorVerification: {
      itemDescription: string;
      recordsRequested: string;
    };
    letterText: string;
    letterTab: "dispute" | "creditor_verify";
    timelineAnchor: string;
  };
  resolution: {
    stepIndex: number;
    stepCompletion: Partial<Record<ResolutionStepId, boolean>>;
    moduleCompleted: boolean;
    moduleCompletedAt: string | null;
    startedAt: string | null;
    activeCaseId: string | null;
    interactions: CollectorEntry[];
    validationBody: string;
    validationSources: DebtValidationSources;
    ceaseDraft: string;
    ceaseSources: CeaseCommunicationSources;
    fdcpaHighlightsRead: boolean;
    caseStatus: CaseStatus;
  };
};

export const FOUNDATION_STEPS: { id: FoundationStepId; label: string }[] = [
  { id: "basics", label: "Credit basics" },
  { id: "utilization", label: "Utilization" },
  { id: "checklist", label: "Build profile" },
  { id: "next", label: "Next steps" },
];

export const OPTIMIZATION_STEPS: { id: OptimizationStepId; label: string }[] = [
  { id: "report", label: "Report input" },
  { id: "negatives", label: "Negative items" },
  { id: "dispute", label: "Dispute builder" },
  { id: "letter", label: "Letter output" },
  { id: "timeline", label: "Timeline" },
];

export const RESOLUTION_STEPS: { id: ResolutionStepId; label: string }[] = [
  { id: "log", label: "Collector log" },
  { id: "validation", label: "Validation request" },
  { id: "cease", label: "Cease communication" },
  { id: "fdcpa", label: "FDCPA basics" },
  { id: "status", label: "Case status" },
];

const emptyDebtValidation: DebtValidationSources = {
  consumerName: "",
  consumerAddress: "",
  collectorName: "",
  accountReference: "",
  allegedAmount: "",
};

const emptyCease: CeaseCommunicationSources = {
  consumerName: "",
  consumerAddress: "",
  collectorName: "",
  accountReference: "",
};

export const initialFinancialReadinessState: FinancialReadinessState = {
  meta: { version: FR_PERSIST_VERSION, updatedAt: null },
  hub: { intakeCompleted: false, primaryGoal: null, intakeCompletedAt: null },
  cases: [],
  documents: [],
  activities: [],
  foundation: {
    stepIndex: 0,
    stepCompletion: {},
    moduleCompleted: false,
    moduleCompletedAt: null,
    startedAt: null,
    basicsAcknowledged: false,
    utilization: { balance: 0, limit: 1 },
    checklist: {
      "secured-card": false,
      "autopay": false,
      "low-utilization": false,
      "diverse-credit": false,
      "monitor-reports": false,
    },
    nextHint: "",
  },
  optimization: {
    stepIndex: 0,
    stepCompletion: {},
    moduleCompleted: false,
    moduleCompletedAt: null,
    startedAt: null,
    activeCaseId: null,
    reportNotes: "",
    negativeItems: [],
    dispute: { creditor: "", accountLast4: "", reason: "inaccurate", details: "" },
    disputeMeta: { consumerName: "", consumerAddress: "", bureau: "" },
    creditorVerification: { itemDescription: "", recordsRequested: "" },
    letterText: "",
    letterTab: "dispute",
    timelineAnchor: new Date().toISOString().slice(0, 10),
  },
  resolution: {
    stepIndex: 0,
    stepCompletion: {},
    moduleCompleted: false,
    moduleCompletedAt: null,
    startedAt: null,
    activeCaseId: null,
    interactions: [],
    validationBody: "",
    validationSources: { ...emptyDebtValidation },
    ceaseDraft: "",
    ceaseSources: { ...emptyCease },
    fdcpaHighlightsRead: false,
    caseStatus: "intake",
  },
};

export function newDocumentId(): string {
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function newCaseId(): string {
  return `case-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function makeVaultDocument(input: {
  type: VaultDocument["type"];
  module: VaultDocument["module"];
  text: string;
  sources: VaultDocument["sources"];
  caseId?: string | null;
  tags?: string[];
  status?: VaultDocument["status"];
}): VaultDocument {
  const now = new Date().toISOString();
  const primaryParty = inferPrimaryParty(input.type, input.sources);
  return {
    id: newDocumentId(),
    type: input.type,
    module: input.module,
    status: input.status ?? "awaiting_response",
    primaryParty,
    createdAt: now,
    updatedAt: now,
    followUpDueAt: computeFollowUpDueAt(input.type, now),
    tags: input.tags ?? [],
    text: input.text,
    sources: input.sources,
    caseId: input.caseId ?? null,
  };
}

function earliestDue(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

function resolveCaseIdForDocument(
  state: FinancialReadinessState,
  doc: VaultDocument
): { doc: VaultDocument; cases: FrCase[]; optimization: FinancialReadinessState["optimization"]; resolution: FinancialReadinessState["resolution"] } {
  if (doc.module === "foundation") {
    return { doc, cases: state.cases, optimization: state.optimization, resolution: state.resolution };
  }
  const cm = doc.module as CaseModule;
  let caseId = doc.caseId ?? (cm === "optimization" ? state.optimization.activeCaseId : state.resolution.activeCaseId);
  if (!caseId) {
    caseId = newCaseId();
    const now = new Date().toISOString();
    const nc: FrCase = {
      id: caseId,
      label: `Matter — ${doc.primaryParty}`,
      module: cm,
      status: "in_progress",
      primaryParty: doc.primaryParty,
      documentIds: [],
      interactionIds: [],
      nextAction: "Track mail and update document status when you receive a response.",
      createdAt: now,
      updatedAt: now,
      followUpDueAt: doc.followUpDueAt,
      tags: [],
    };
    return {
      doc: { ...doc, caseId },
      cases: [nc, ...state.cases],
      optimization: cm === "optimization" ? { ...state.optimization, activeCaseId: caseId } : state.optimization,
      resolution: cm === "resolution" ? { ...state.resolution, activeCaseId: caseId } : state.resolution,
    };
  }
  return {
    doc: { ...doc, caseId },
    cases: state.cases,
    optimization: state.optimization,
    resolution: state.resolution,
  };
}

export type FinancialReadinessAction =
  | { type: "hydrate"; payload: FinancialReadinessState }
  | { type: "foundation/setStep"; index: number }
  | { type: "foundation/setBasics"; acknowledged: boolean }
  | { type: "foundation/setUtilization"; balance: number; limit: number }
  | { type: "foundation/toggleChecklist"; key: string }
  | { type: "foundation/setNextHint"; text: string }
  | { type: "foundation/markStep"; step: FoundationStepId; done: boolean }
  | { type: "foundation/completeModule" }
  | { type: "optimization/setStep"; index: number }
  | { type: "optimization/setReportNotes"; text: string }
  | { type: "optimization/setNegatives"; items: NegativeItem[] }
  | { type: "optimization/toggleNegative"; id: string }
  | { type: "optimization/setDispute"; partial: Partial<FinancialReadinessState["optimization"]["dispute"]> }
  | { type: "optimization/setDisputeMeta"; partial: Partial<FinancialReadinessState["optimization"]["disputeMeta"]> }
  | { type: "optimization/setCreditorVerification"; partial: Partial<FinancialReadinessState["optimization"]["creditorVerification"]> }
  | { type: "optimization/setLetterTab"; tab: "dispute" | "creditor_verify" }
  | { type: "optimization/setLetter"; text: string }
  | { type: "optimization/setTimelineAnchor"; iso: string }
  | { type: "optimization/markStep"; step: OptimizationStepId; done: boolean }
  | { type: "optimization/completeModule" }
  | { type: "optimization/setActiveCase"; id: string | null }
  | { type: "resolution/setStep"; index: number }
  | { type: "resolution/addInteraction"; entry: Omit<CollectorEntry, "id"> }
  | { type: "resolution/setValidationBody"; text: string }
  | { type: "resolution/setValidationSources"; partial: Partial<DebtValidationSources> }
  | { type: "resolution/setCeaseDraft"; text: string }
  | { type: "resolution/setCeaseSources"; partial: Partial<CeaseCommunicationSources> }
  | { type: "resolution/setFdcpaRead"; read: boolean }
  | { type: "resolution/setCaseStatus"; status: CaseStatus }
  | { type: "resolution/markStep"; step: ResolutionStepId; done: boolean }
  | { type: "resolution/completeModule" }
  | { type: "resolution/setActiveCase"; id: string | null }
  | { type: "documents/add"; doc: VaultDocument }
  | { type: "documents/patch"; id: string; patch: Partial<VaultDocument>; skipActivity?: boolean }
  | { type: "documents/duplicate"; id: string }
  | { type: "documents/regenerate"; id: string }
  | { type: "cases/create"; payload: { label: string; module: CaseModule; primaryParty: string; tags?: string[] } }
  | { type: "cases/patch"; id: string; patch: Partial<FrCase>; skipActivity?: boolean }
  | { type: "documents/assignCase"; documentId: string; caseId: string | null; skipActivity?: boolean }
  | { type: "documents/createCaseFromDocument"; documentId: string; label?: string; caseId?: string }
  | { type: "operational/apply"; target: "document" | "case"; id: string; op: OperationalOp }
  | { type: "hub/completeIntake"; goal: HubPrimaryGoal }
  | { type: "activities/append"; entry: Omit<ActivityEntry, "id" | "at"> }
  | { type: "reset" };

function touch(state: FinancialReadinessState): FinancialReadinessState {
  return {
    ...state,
    meta: { ...state.meta, updatedAt: new Date().toISOString() },
  };
}

export function financialReadinessReducer(
  state: FinancialReadinessState,
  action: FinancialReadinessAction
): FinancialReadinessState {
  switch (action.type) {
    case "hydrate":
      return action.payload;
    case "foundation/setStep":
      return touch({
        ...state,
        foundation: {
          ...state.foundation,
          stepIndex: Math.max(0, action.index),
          startedAt: state.foundation.startedAt ?? new Date().toISOString(),
        },
      });
    case "foundation/setBasics":
      return touch({
        ...state,
        foundation: { ...state.foundation, basicsAcknowledged: action.acknowledged },
      });
    case "foundation/setUtilization":
      return touch({
        ...state,
        foundation: {
          ...state.foundation,
          utilization: { balance: action.balance, limit: Math.max(1, action.limit) },
        },
      });
    case "foundation/toggleChecklist": {
      const key = action.key;
      const next = { ...state.foundation.checklist, [key]: !state.foundation.checklist[key] };
      return touch({ ...state, foundation: { ...state.foundation, checklist: next } });
    }
    case "foundation/setNextHint":
      return touch({ ...state, foundation: { ...state.foundation, nextHint: action.text } });
    case "foundation/markStep":
      return touch({
        ...state,
        foundation: {
          ...state.foundation,
          stepCompletion: { ...state.foundation.stepCompletion, [action.step]: action.done },
        },
      });
    case "foundation/completeModule":
      return touch({
        ...state,
        foundation: {
          ...state.foundation,
          moduleCompleted: true,
          moduleCompletedAt: new Date().toISOString(),
        },
      });
    case "optimization/setStep":
      return touch({
        ...state,
        optimization: {
          ...state.optimization,
          stepIndex: Math.max(0, action.index),
          startedAt: state.optimization.startedAt ?? new Date().toISOString(),
        },
      });
    case "optimization/setReportNotes":
      return touch({ ...state, optimization: { ...state.optimization, reportNotes: action.text } });
    case "optimization/setNegatives":
      return touch({ ...state, optimization: { ...state.optimization, negativeItems: action.items } });
    case "optimization/toggleNegative": {
      const items = state.optimization.negativeItems.map((n) =>
        n.id === action.id ? { ...n, selected: !n.selected } : n
      );
      return touch({ ...state, optimization: { ...state.optimization, negativeItems: items } });
    }
    case "optimization/setDispute":
      return touch({
        ...state,
        optimization: {
          ...state.optimization,
          dispute: { ...state.optimization.dispute, ...action.partial },
        },
      });
    case "optimization/setDisputeMeta":
      return touch({
        ...state,
        optimization: {
          ...state.optimization,
          disputeMeta: { ...state.optimization.disputeMeta, ...action.partial },
        },
      });
    case "optimization/setCreditorVerification":
      return touch({
        ...state,
        optimization: {
          ...state.optimization,
          creditorVerification: { ...state.optimization.creditorVerification, ...action.partial },
        },
      });
    case "optimization/setLetterTab":
      return touch({ ...state, optimization: { ...state.optimization, letterTab: action.tab } });
    case "optimization/setLetter":
      return touch({ ...state, optimization: { ...state.optimization, letterText: action.text } });
    case "optimization/setTimelineAnchor":
      return touch({
        ...state,
        optimization: { ...state.optimization, timelineAnchor: action.iso },
      });
    case "optimization/markStep":
      return touch({
        ...state,
        optimization: {
          ...state.optimization,
          stepCompletion: { ...state.optimization.stepCompletion, [action.step]: action.done },
        },
      });
    case "optimization/completeModule":
      return touch({
        ...state,
        optimization: {
          ...state.optimization,
          moduleCompleted: true,
          moduleCompletedAt: new Date().toISOString(),
        },
      });
    case "optimization/setActiveCase":
      return touch({
        ...state,
        optimization: { ...state.optimization, activeCaseId: action.id },
      });
    case "resolution/setStep":
      return touch({
        ...state,
        resolution: {
          ...state.resolution,
          stepIndex: Math.max(0, action.index),
          startedAt: state.resolution.startedAt ?? new Date().toISOString(),
        },
      });
    case "resolution/addInteraction": {
      const id = `i-${Date.now()}`;
      let caseId = action.entry.caseId ?? state.resolution.activeCaseId;
      let cases = state.cases;
      let resolution = state.resolution;
      const collector = action.entry.collector.trim() || "Unknown collector";
      if (!caseId) {
        caseId = newCaseId();
        const now = new Date().toISOString();
        const nc: FrCase = {
          id: caseId,
          label: `Matter — ${collector}`,
          module: "resolution",
          status: "in_progress",
          primaryParty: collector,
          documentIds: [],
          interactionIds: [],
          nextAction: "Continue logging contacts and send validation/cease letters as needed.",
          createdAt: now,
          updatedAt: now,
          followUpDueAt: null,
          tags: [],
        };
        cases = [nc, ...cases];
        resolution = { ...resolution, activeCaseId: caseId };
      }
      const entry: CollectorEntry = { ...action.entry, id, caseId };
      const now = new Date().toISOString();
      cases = cases.map((c) => {
        if (c.id !== caseId) return c;
        const interactionIds = c.interactionIds.includes(id) ? c.interactionIds : [id, ...c.interactionIds];
        return { ...c, interactionIds, updatedAt: now };
      });
      let next: FinancialReadinessState = {
        ...state,
        cases,
        resolution: {
          ...resolution,
          interactions: [entry, ...resolution.interactions],
        },
      };
      next = appendActivity(next, {
        caseId: caseId,
        documentId: null,
        kind: "interaction_logged",
        summary: `Collector contact: ${collector} (${action.entry.channel})`,
        payload: { date: action.entry.date },
      });
      return touch(next);
    }
    case "resolution/setValidationBody":
      return touch({ ...state, resolution: { ...state.resolution, validationBody: action.text } });
    case "resolution/setValidationSources":
      return touch({
        ...state,
        resolution: {
          ...state.resolution,
          validationSources: { ...state.resolution.validationSources, ...action.partial },
        },
      });
    case "resolution/setCeaseDraft":
      return touch({ ...state, resolution: { ...state.resolution, ceaseDraft: action.text } });
    case "resolution/setCeaseSources":
      return touch({
        ...state,
        resolution: {
          ...state.resolution,
          ceaseSources: { ...state.resolution.ceaseSources, ...action.partial },
        },
      });
    case "resolution/setFdcpaRead":
      return touch({ ...state, resolution: { ...state.resolution, fdcpaHighlightsRead: action.read } });
    case "resolution/setCaseStatus":
      return touch({ ...state, resolution: { ...state.resolution, caseStatus: action.status } });
    case "resolution/markStep":
      return touch({
        ...state,
        resolution: {
          ...state.resolution,
          stepCompletion: { ...state.resolution.stepCompletion, [action.step]: action.done },
        },
      });
    case "resolution/completeModule":
      return touch({
        ...state,
        resolution: {
          ...state.resolution,
          moduleCompleted: true,
          moduleCompletedAt: new Date().toISOString(),
        },
      });
    case "resolution/setActiveCase":
      return touch({
        ...state,
        resolution: { ...state.resolution, activeCaseId: action.id },
      });
    case "documents/add": {
      const r = resolveCaseIdForDocument(state, action.doc);
      let cases = r.cases;
      if (r.doc.caseId) {
        const cidx = cases.findIndex((c) => c.id === r.doc.caseId);
        if (cidx >= 0) {
          const now = new Date().toISOString();
          cases = cases.map((x, i) => {
            if (i !== cidx) return x;
            const documentIds = x.documentIds.includes(r.doc.id) ? x.documentIds : [r.doc.id, ...x.documentIds];
            return {
              ...x,
              documentIds,
              updatedAt: now,
              followUpDueAt: earliestDue(x.followUpDueAt, r.doc.followUpDueAt),
            };
          });
        }
      }
      const caseCreated = r.cases.length > state.cases.length;
      let next: FinancialReadinessState = {
        ...state,
        cases,
        optimization: r.optimization,
        resolution: r.resolution,
        documents: [r.doc, ...state.documents],
      };
      if (caseCreated) {
        const newCase = r.cases.find((c) => !state.cases.some((x) => x.id === c.id));
        if (newCase) {
          next = appendActivity(next, {
            caseId: newCase.id,
            documentId: null,
            kind: "case_created",
            summary: `Matter created: ${newCase.label}`,
          });
        }
      }
      next = appendActivity(next, {
        caseId: r.doc.caseId,
        documentId: r.doc.id,
        kind: "document_generated",
        summary: `Document generated (${r.doc.type})`,
        payload: { type: r.doc.type },
      });
      return touch(next);
    }
    case "documents/patch": {
      const prev = state.documents.find((d) => d.id === action.id);
      if (!prev) return state;
      const docs = state.documents.map((d) =>
        d.id === action.id
          ? {
              ...d,
              ...action.patch,
              updatedAt: new Date().toISOString(),
              sources: action.patch.sources ?? d.sources,
            }
          : d
      );
      const nd = docs.find((d) => d.id === action.id)!;
      const p = action.patch;
      const skip = action.skipActivity === true;
      let next: FinancialReadinessState = { ...state, documents: docs };
      if (!skip) {
        if (p.status !== undefined && p.status !== prev.status) {
          next = appendActivity(next, {
            caseId: nd.caseId,
            documentId: nd.id,
            kind: "document_status_changed",
            summary: `Document status: ${prev.status} → ${p.status}`,
            payload: { from: prev.status, to: p.status },
          });
        }
        if (p.followUpDueAt !== undefined && p.followUpDueAt !== prev.followUpDueAt) {
          next = appendActivity(next, {
            caseId: nd.caseId,
            documentId: nd.id,
            kind: "document_followup_changed",
            summary: `Follow-up date: ${String(prev.followUpDueAt ?? "—")} → ${String(p.followUpDueAt ?? "—")}`,
            payload: { from: prev.followUpDueAt, to: p.followUpDueAt },
          });
        }
        if (
          (p.text !== undefined && p.text !== prev.text) ||
          (p.tags !== undefined && JSON.stringify(p.tags) !== JSON.stringify(prev.tags)) ||
          p.sources !== undefined
        ) {
          const parts: string[] = [];
          if (p.text !== undefined && p.text !== prev.text) parts.push("text");
          if (p.tags !== undefined) parts.push("tags");
          if (p.sources !== undefined) parts.push("sources");
          next = appendActivity(next, {
            caseId: nd.caseId,
            documentId: nd.id,
            kind: "document_edited",
            summary: `Document edited (${parts.join(", ")})`,
            payload: { fields: parts },
          });
        }
      }
      return touch(next);
    }
    case "documents/duplicate": {
      const src = state.documents.find((d) => d.id === action.id);
      if (!src) return state;
      const now = new Date().toISOString();
      const copy: VaultDocument = {
        ...src,
        id: newDocumentId(),
        status: "in_progress",
        createdAt: now,
        updatedAt: now,
        tags: [...src.tags, "copy"],
      };
      let cases = state.cases;
      if (copy.caseId) {
        const cidx = cases.findIndex((c) => c.id === copy.caseId);
        if (cidx >= 0) {
          cases = cases.map((x, i) => {
            if (i !== cidx) return x;
            const documentIds = [copy.id, ...x.documentIds];
            return { ...x, documentIds, updatedAt: now };
          });
        }
      }
      let next: FinancialReadinessState = { ...state, cases, documents: [copy, ...state.documents] };
      next = appendActivity(next, {
        caseId: copy.caseId,
        documentId: copy.id,
        kind: "document_generated",
        summary: `Document duplicated from ${src.id}`,
        payload: { fromId: src.id },
      });
      return touch(next);
    }
    case "documents/regenerate": {
      const src = state.documents.find((d) => d.id === action.id);
      if (!src) return state;
      const { text } = regenerateVaultText(src);
      const now = new Date().toISOString();
      const followUpDueAt = computeFollowUpDueAt(src.type, now);
      const docs = state.documents.map((d) =>
        d.id === action.id
          ? {
              ...d,
              text,
              updatedAt: now,
              followUpDueAt,
              status: "awaiting_response" as const,
            }
          : d
      );
      const nd = docs.find((d) => d.id === action.id)!;
      let next: FinancialReadinessState = { ...state, documents: docs };
      next = appendActivity(next, {
        caseId: nd.caseId,
        documentId: nd.id,
        kind: "document_edited",
        summary: "Document regenerated from sources",
      });
      return touch(next);
    }
    case "cases/create": {
      const id = newCaseId();
      const now = new Date().toISOString();
      const c: FrCase = {
        id,
        label: action.payload.label,
        module: action.payload.module,
        status: "not_started",
        primaryParty: action.payload.primaryParty,
        documentIds: [],
        interactionIds: [],
        nextAction: "Attach documents and log collector activity.",
        createdAt: now,
        updatedAt: now,
        followUpDueAt: null,
        tags: action.payload.tags ?? [],
      };
      const optimization =
        action.payload.module === "optimization" ? { ...state.optimization, activeCaseId: id } : state.optimization;
      const resolution =
        action.payload.module === "resolution" ? { ...state.resolution, activeCaseId: id } : state.resolution;
      let next: FinancialReadinessState = { ...state, cases: [c, ...state.cases], optimization, resolution };
      next = appendActivity(next, {
        caseId: c.id,
        documentId: null,
        kind: "case_created",
        summary: `Matter created: ${c.label}`,
      });
      return touch(next);
    }
    case "cases/patch": {
      const prev = state.cases.find((x) => x.id === action.id);
      if (!prev) return state;
      const now = new Date().toISOString();
      const cases = state.cases.map((c) =>
        c.id === action.id ? { ...c, ...action.patch, updatedAt: now } : c
      );
      const nc = cases.find((x) => x.id === action.id)!;
      const p = action.patch;
      const skip = action.skipActivity === true;
      let next: FinancialReadinessState = { ...state, cases };
      if (!skip) {
        if (p.status !== undefined && p.status !== prev.status) {
          next = appendActivity(next, {
            caseId: nc.id,
            documentId: null,
            kind: "case_status_changed",
            summary: `Matter status: ${prev.status} → ${p.status}`,
            payload: { from: prev.status, to: p.status },
          });
        }
        if (p.followUpDueAt !== undefined && p.followUpDueAt !== prev.followUpDueAt) {
          next = appendActivity(next, {
            caseId: nc.id,
            documentId: null,
            kind: "case_followup_changed",
            summary: `Matter follow-up: ${String(prev.followUpDueAt ?? "—")} → ${String(p.followUpDueAt ?? "—")}`,
            payload: { from: prev.followUpDueAt, to: p.followUpDueAt },
          });
        }
        if (p.nextAction !== undefined && p.nextAction !== prev.nextAction) {
          next = appendActivity(next, {
            caseId: nc.id,
            documentId: null,
            kind: "next_action_changed",
            summary: "Next action updated",
            payload: { from: prev.nextAction, to: p.nextAction },
          });
        }
      }
      return touch(next);
    }
    case "documents/assignCase": {
      const doc = state.documents.find((d) => d.id === action.documentId);
      if (!doc) return state;
      const now = new Date().toISOString();
      const oldCaseId = doc.caseId;
      const newCaseId = action.caseId;
      let cases = state.cases;
      if (oldCaseId) {
        cases = cases.map((c) =>
          c.id === oldCaseId
            ? { ...c, documentIds: c.documentIds.filter((id) => id !== doc.id), updatedAt: now }
            : c
        );
      }
      if (newCaseId) {
        cases = cases.map((c) => {
          if (c.id !== newCaseId) return c;
          const documentIds = c.documentIds.includes(doc.id) ? c.documentIds : [doc.id, ...c.documentIds];
          return { ...c, documentIds, updatedAt: now };
        });
      }
      const documents = state.documents.map((d) =>
        d.id === doc.id ? { ...d, caseId: newCaseId, updatedAt: now } : d
      );
      let next: FinancialReadinessState = { ...state, cases, documents };
      if (!action.skipActivity) {
        next = appendActivity(next, {
          caseId: newCaseId ?? oldCaseId,
          documentId: doc.id,
          kind: newCaseId ? "document_reassigned" : "document_detached",
          summary: newCaseId
            ? `Assignment: matter ${String(oldCaseId ?? "none")} → ${newCaseId}`
            : "Detached from matter",
          payload: { oldCaseId, newCaseId },
        });
      }
      return touch(next);
    }
    case "documents/createCaseFromDocument": {
      const doc = state.documents.find((d) => d.id === action.documentId);
      if (!doc || doc.module === "foundation") return state;
      const cm = doc.module as CaseModule;
      const proposed = action.caseId;
      const id =
        proposed && !state.cases.some((x) => x.id === proposed) ? proposed : newCaseId();
      const now = new Date().toISOString();
      const c: FrCase = {
        id,
        label: action.label ?? `Matter — ${doc.primaryParty}`,
        module: cm,
        status: "in_progress",
        primaryParty: doc.primaryParty,
        documentIds: [doc.id],
        interactionIds: [],
        nextAction: "Track responses and update statuses.",
        createdAt: now,
        updatedAt: now,
        followUpDueAt: doc.followUpDueAt,
        tags: [],
      };
      let cases = state.cases;
      if (doc.caseId) {
        cases = cases.map((x) => {
          if (x.id !== doc.caseId) return x;
          return { ...x, documentIds: x.documentIds.filter((i) => i !== doc.id), updatedAt: now };
        });
      }
      cases = [c, ...cases];
      const documents = state.documents.map((d) =>
        d.id === doc.id ? { ...d, caseId: id, updatedAt: now } : d
      );
      const optimization =
        cm === "optimization" ? { ...state.optimization, activeCaseId: id } : state.optimization;
      const resolution =
        cm === "resolution" ? { ...state.resolution, activeCaseId: id } : state.resolution;
      let next: FinancialReadinessState = { ...state, cases, documents, optimization, resolution };
      next = appendActivity(next, {
        caseId: id,
        documentId: doc.id,
        kind: "document_reassigned",
        summary: "New matter created from document",
      });
      return touch(next);
    }
    case "operational/apply": {
      if (action.target === "document") {
        const doc = state.documents.find((d) => d.id === action.id);
        if (!doc) return state;
        const patch = applyOperationalToDoc(doc, action.op);
        const docs = state.documents.map((d) =>
          d.id === action.id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d
        );
        let next: FinancialReadinessState = { ...state, documents: docs };
        next = appendActivity(next, {
          caseId: doc.caseId,
          documentId: doc.id,
          kind: "operational",
          summary: `Operational: ${action.op}`,
          payload: { op: action.op, target: "document" },
        });
        return touch(next);
      }
      const c = state.cases.find((x) => x.id === action.id);
      if (!c) return state;
      const patch = applyOperationalToCase(c, action.op);
      const cases = state.cases.map((x) =>
        x.id === action.id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x
      );
      let next: FinancialReadinessState = { ...state, cases };
      next = appendActivity(next, {
        caseId: c.id,
        documentId: null,
        kind: "operational",
        summary: `Operational: ${action.op}`,
        payload: { op: action.op, target: "case" },
      });
      return touch(next);
    }
    case "hub/completeIntake":
      return touch({
        ...state,
        hub: {
          intakeCompleted: true,
          primaryGoal: action.goal,
          intakeCompletedAt: new Date().toISOString(),
        },
      });
    case "activities/append":
      return touch(appendActivity(state, action.entry));
    case "reset":
      return { ...initialFinancialReadinessState, meta: { ...initialFinancialReadinessState.meta, updatedAt: new Date().toISOString() } };
    default:
      return state;
  }
}
