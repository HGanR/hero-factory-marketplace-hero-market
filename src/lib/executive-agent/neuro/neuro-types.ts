/** NEURO Network — governed source-backed knowledge types (Executive Administration). */

export const NEURO_ASSIGNED_AGENTS = [
  "JARVA",
  "ELEANOR",
  "MAANIA",
  "BENTLEY",
  "SKIPPER",
  "GENERAL",
] as const;

export type NeuroAssignedAgent = (typeof NEURO_ASSIGNED_AGENTS)[number];

export const NEURO_SUBJECT_AREAS = [
  "TRUST",
  "ACCOUNTING",
  "TAX",
  "CONSUMER_LAW",
  "FINANCIAL_READINESS",
  "REAL_ESTATE",
  "AI_REVENUE_OS",
  "GENERAL",
] as const;

export type NeuroSubjectArea = (typeof NEURO_SUBJECT_AREAS)[number];

export const NEURO_SOURCE_TYPES = ["pdf", "doc", "docx", "txt", "markdown", "image", "other"] as const;
export type NeuroSourceType = (typeof NEURO_SOURCE_TYPES)[number];

export const NEURO_DOCUMENT_STATUSES = [
  "uploaded",
  "processing",
  "indexed",
  "failed",
  "unsupported_for_text",
] as const;

export type NeuroDocumentStatus = (typeof NEURO_DOCUMENT_STATUSES)[number];

/** Subject region layout for brain map UI. */
export type NeuroBrainRegion = {
  id: NeuroSubjectArea;
  label: string;
  agentLabel: string;
  accent: string;
  /** Normalized 0–1 position on brain map canvas */
  x: number;
  y: number;
};

export const NEURO_BRAIN_REGIONS: NeuroBrainRegion[] = [
  { id: "TRUST", label: "TRUST / Jarva", agentLabel: "JARVA", accent: "#fbbf24", x: 0.22, y: 0.28 },
  { id: "ACCOUNTING", label: "ACCOUNTING / Eleanor", agentLabel: "ELEANOR", accent: "#34d399", x: 0.38, y: 0.18 },
  { id: "REAL_ESTATE", label: "REAL ESTATE / Maania", agentLabel: "MAANIA", accent: "#a78bfa", x: 0.62, y: 0.22 },
  { id: "AI_REVENUE_OS", label: "AI REVENUE OS / Bentley", agentLabel: "BENTLEY", accent: "#22d3ee", x: 0.78, y: 0.38 },
  { id: "FINANCIAL_READINESS", label: "FINANCIAL READINESS", agentLabel: "SKIPPER", accent: "#fcd34d", x: 0.72, y: 0.58 },
  { id: "CONSUMER_LAW", label: "CONSUMER LAW", agentLabel: "JARVA", accent: "#fb7185", x: 0.28, y: 0.62 },
  { id: "TAX", label: "TAX / IRS", agentLabel: "ELEANOR", accent: "#60a5fa", x: 0.48, y: 0.72 },
  { id: "GENERAL", label: "GENERAL EXECUTIVE", agentLabel: "SKIPPER", accent: "#94a3b8", x: 0.5, y: 0.42 },
];

export type NeuroDocumentDto = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageUri: string;
  assignedAgent: NeuroAssignedAgent;
  subjectArea: NeuroSubjectArea;
  sourceType: NeuroSourceType;
  status: NeuroDocumentStatus;
  statusMessage: string | null;
  extractedTextPreview: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
};

export type NeuroChunkDto = {
  id: string;
  documentId: string;
  chunkIndex: number;
  pageNumber: number | null;
  sectionTitle: string | null;
  text: string;
  tokenEstimate: number;
  citationLabel: string;
  sourceLocator: string;
};

export type NeuroPassageCitationDto = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  fileName: string;
  citationLabel: string;
  sourceLocator: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  snippet: string;
  highlightStart: number;
  highlightEnd: number;
  confidence: number;
  subjectArea: NeuroSubjectArea;
  assignedAgent: NeuroAssignedAgent;
};

export type NeuroSearchResultDto = {
  query: string;
  hits: NeuroPassageCitationDto[];
  totalHits: number;
  disclaimer: string | null;
  sourceBacked: boolean;
};

export type NeuroDocumentViewerDto = {
  document: NeuroDocumentDto;
  chunks: NeuroChunkDto[];
  viewerMode: "pdf" | "text" | "unsupported";
  fullText: string | null;
  storageUri: string;
  highlightChunkId: string | null;
  highlightPassage: string | null;
  citation: NeuroPassageCitationDto | null;
  disclaimer: string | null;
};

export type NeuroSourceAnswerDto = {
  query: string;
  answerSummary: string;
  citedSources: NeuroPassageCitationDto[];
  sourceConfidence: number;
  unsupportedClaims: string[];
  recommendedFollowUp: string | null;
  sourceBacked: boolean;
  disclaimer: string | null;
  noSourceMessage: string | null;
};

export type NeuroNetworkOverviewDto = {
  ok: true;
  regions: Array<NeuroBrainRegion & { documentCount: number; indexedCount: number }>;
  documents: NeuroDocumentDto[];
  totalDocuments: number;
  totalIndexed: number;
  generatedAt: string;
};

export function isNeuroSubjectArea(v: string): v is NeuroSubjectArea {
  return (NEURO_SUBJECT_AREAS as readonly string[]).includes(v);
}

export function isNeuroAssignedAgent(v: string): v is NeuroAssignedAgent {
  return (NEURO_ASSIGNED_AGENTS as readonly string[]).includes(v);
}

export function inferNeuroSourceType(fileName: string, mimeType: string): NeuroSourceType {
  const low = fileName.toLowerCase();
  const mime = mimeType.toLowerCase();
  if (low.endsWith(".pdf") || mime.includes("pdf")) return "pdf";
  if (low.endsWith(".docx") || mime.includes("wordprocessingml")) return "docx";
  if (low.endsWith(".doc") || mime === "application/msword") return "doc";
  if (low.endsWith(".md") || mime.includes("markdown")) return "markdown";
  if (low.endsWith(".txt") || mime.startsWith("text/")) return "txt";
  if (mime.startsWith("image/")) return "image";
  return "other";
}

export function mapSubjectToDefaultAgent(subject: NeuroSubjectArea): NeuroAssignedAgent {
  switch (subject) {
    case "TRUST":
    case "CONSUMER_LAW":
      return "JARVA";
    case "ACCOUNTING":
    case "TAX":
      return "ELEANOR";
    case "REAL_ESTATE":
      return "MAANIA";
    case "AI_REVENUE_OS":
      return "BENTLEY";
    case "FINANCIAL_READINESS":
      return "SKIPPER";
    default:
      return "GENERAL";
  }
}
