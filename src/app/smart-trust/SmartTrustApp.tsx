"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { useAccount } from "wagmi";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { v4 as uuidv4 } from "uuid";
import {
  accountAssetToSmartTrustAsset,
  deleteAccountAsset,
  getLastActiveAccountId,
  loadAccountAssets,
  resolveAccountId,
  setLastActiveAccountId,
  subscribeAccountAssets,
  smartTrustAssetToAccountAsset,
  upsertAccountAsset,
} from "@/lib/accountAssets";
import type { ParentCorpDraft } from "@/lib/company-wizard/types";
import type { ReligiousOrgDraft } from "@/lib/religious-org/types";

// shadcn/ui
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// icons
import {
  FileText,
  ShieldCheck,
  Gavel,
  Landmark,
  Users,
  HeartHandshake,
  Download,
  Printer,
  ClipboardList,
  ScrollText,
  BookOpen,
  Save,
  ChevronRight,
  ChevronLeft,
  Home,
  Church,
} from "lucide-react";

/**
 * Trust & Estate Planning Wizard
 * - Designed as an attorney workflow asset: intake + drafting scaffold + compliance checklist + exportable draft.
 * - Single-file demo with routing (React Router) so we can add/iterate pages as you like.
 *
 * NOTE: This component provides a practitioner-friendly workflow UI. It is not legal advice.
 */

type EntityType =
  | "revocable_living_trust"
  | "foundation"
  | "family_office"
  | "religious_organization"
  | "company";

type GoverningState =
  | "AL" | "AK" | "AZ" | "AR" | "CA" | "CO" | "CT" | "DE" | "FL" | "GA" | "HI" | "ID" | "IL" | "IN" | "IA" | "KS" | "KY" | "LA" | "ME" | "MD" | "MA" | "MI" | "MN" | "MS" | "MO" | "MT" | "NE" | "NV" | "NH" | "NJ" | "NM" | "NY" | "NC" | "ND" | "OH" | "OK" | "OR" | "PA" | "RI" | "SC" | "SD" | "TN" | "TX" | "UT" | "VT" | "VA" | "WA" | "WV" | "WI" | "WY";

const GOVERNING_STATES: { value: GoverningState; label: string }[] = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

type DraftStatus = "new" | "in_progress" | "ready_for_review";

type Party = {
  id: string;
  role:
    | "Grantor/Settlor"
    | "Trustee"
    | "Successor Trustee"
    | "Beneficiary"
    | "Protector"
    | "Officer/Director"
    | "Family Member";
  name: string;
  email?: string;
  phone?: string;
};

type Asset = {
  id: string;
  category:
    | "Real Estate"
    | "Bank/Brokerage"
    | "Business Interest"
    | "Digital Assets"
    | "Life Insurance"
    | "Art/Collectibles"
    | "Other";
  description: string;
  approximateValue?: string;
  titlingNotes?: string;
};

export type DraftModel = {
  draftId: string;
  entityType: EntityType | null;
  governingState: GoverningState | null;
  status: DraftStatus;

  matterName: string;
  internalFileNumber: string;
  /** Firm-side identifier (not a legal name). Used for watermarking and exported filenames. */
  matterId?: string;
  /** Optional firm branding for exported packets */
  firmName?: string;
  firmAddress?: string;
  firmPhone?: string;
  firmEmail?: string;
  /** Optional disclaimer boilerplate for printed/exported materials */
  firmDisclaimer?: string;

  /** Selected clause IDs for the Clause Library page */
  selectedClauses?: string[];
  /** A simple drafting pad used by Clause Library insertions (MVP editor integration). */
  clauseDraftPad?: string;
  /** Optional structured insertions for auditability (tracked clause block mode). */
  insertedClauseBlocks?: InsertedClauseBlock[];
  /** Deterministic section ranges derived from `clauseDraftPad` */
  sectionIndex?: DraftSection[];
  /** Optional: last selected section in Clause Library UI */
  clauseInsertAfterSectionId?: SectionId;
  /** Draft jurisdiction (NY/CA MVP) used for clause policy evaluation */
  jurisdiction?: "NY" | "CA";

  // Common
  parties: Party[];
  assets: Asset[];
  objectives: string;
  keyDates: {
    targetSigningDate?: string;
    targetFundingDate?: string;
  };

  /**
   * Funding checklist per asset/task with workflow metadata.
   * assetId -> taskId -> TaskMeta
   */
  fundingChecklist: Record<string, Record<string, TaskMeta>>;

  // Trust-specific
  trustName?: string;
  revocable?: boolean;
  incapacityStandard?: "Two physicians" | "Attending physician" | "Court determination" | "Other";
  distributionStyle?: "Outright" | "Staggered" | "Discretionary" | "HEMS";
  pourOverWillNeeded?: boolean;

  // Foundation-specific
  foundationType?: "Public Charity (501(c)(3))" | "Private Foundation (501(c)(3))";
  foundationAffiliation?: "standard" | "religious_organization";
  missionStatement?: string;
  governanceNotes?: string;

  // Family office-specific
  familyOfficeStructure?: "Single Family Office" | "Multi-Family Office";
  servicesScope?: string[];
  investmentAdviserConsiderations?: string;

  // Compliance toggles
  compliance: {
    kycIntake: boolean;
    conflictCheck: boolean;
    engagementLetter: boolean;
    dataRoomCreated: boolean;
    taxCounselLooped: boolean;
  };

  // Attorney notes
  attorneyNotes: string;

  /** Nested company (parent corp) wizard — persisted on draft when using Company flow */
  companyDraft?: ParentCorpDraft | null;
  /** Nested religious-organization wizard */
  religiousOrgDraft?: ReligiousOrgDraft | null;
};

const defaultDraft = (): DraftModel => ({
  draftId: uuidv4(),
  entityType: null,
  governingState: "NY",
  status: "new",

  matterName: "",
  internalFileNumber: "",
  matterId: "",
  firmName: "",
  firmAddress: "",
  firmPhone: "",
  firmEmail: "",
  firmDisclaimer: "",
  selectedClauses: [],
  clauseDraftPad: "",
  insertedClauseBlocks: [],
  sectionIndex: [],
  clauseInsertAfterSectionId: "distribution",
  jurisdiction: "NY",

  parties: [
    { id: uuidv4(), role: "Grantor/Settlor", name: "" },
    { id: uuidv4(), role: "Trustee", name: "" },
  ],
  assets: [],
  objectives: "",
  keyDates: {},

  fundingChecklist: {},

  trustName: "",
  revocable: true,
  incapacityStandard: "Two physicians",
  distributionStyle: "HEMS",
  pourOverWillNeeded: true,

  foundationType: "Public Charity (501(c)(3))",
  foundationAffiliation: "standard",
  missionStatement: "",
  governanceNotes: "",

  familyOfficeStructure: "Single Family Office",
  servicesScope: ["Tax coordination", "Bill pay / cash management"],
  investmentAdviserConsiderations: "",

  compliance: {
    kycIntake: false,
    conflictCheck: false,
    engagementLetter: false,
    dataRoomCreated: false,
    taxCounselLooped: false,
  },

  attorneyNotes: "",
});

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatEntityLabel(t: EntityType | null) {
  if (!t) return "";
  if (t === "revocable_living_trust") return "Revocable Living Trust";
  if (t === "foundation") return "Charitable Foundation";
  return "Family Office";
}

function useLocalDraftStorage(key = "te_draft_v1") {
  const hydrate = (raw: unknown): DraftModel | null => {
    if (!raw || typeof raw !== "object") return null;
    const base = defaultDraft();
    const parsed = raw as Partial<DraftModel>;
    const juris = parsed.jurisdiction ?? (parsed.governingState === "NY" || parsed.governingState === "CA" ? (parsed.governingState as any) : base.jurisdiction);
    const clauseDraftPad = ensureCanonicalSectionsText(String((parsed as any).clauseDraftPad ?? base.clauseDraftPad ?? ""));
    const sectionIndex = buildSectionIndex(clauseDraftPad);
    const inserted = Array.isArray((parsed as any).insertedClauseBlocks) ? ((parsed as any).insertedClauseBlocks as any[]) : [];
    const insertedClauseBlocks: InsertedClauseBlock[] = inserted
      .map((b) => {
        if (!b || typeof b !== "object") return null;
        // Back-compat: older shape used { insertTarget, afterSectionId, bindings, renderedText, insertedAt, ... }
        const clauseId = String((b as any).clauseId ?? "");
        if (!clauseId) return null;
        const clauseVersion = String((b as any).clauseVersion ?? (b as any).version ?? "v1");
        const insertedAt = String((b as any).insertedAt ?? new Date().toISOString());
        const renderedText = String((b as any).renderedText ?? "");
        const id = String((b as any).id ?? uuidv4());

        const legacyTarget = (b as any).insertTarget as string | undefined;
        const legacyAfter = (b as any).afterSectionId as string | undefined;
        const legacyOffset = typeof (b as any).offset === "number" ? (b as any).offset : undefined;

        let insertStrategy: InsertedClauseBlock["insertStrategy"] = { type: "append" };
        if ((b as any).insertStrategy && typeof (b as any).insertStrategy === "object") {
          insertStrategy = (b as any).insertStrategy;
        } else if (legacyTarget === "cursor") {
          insertStrategy = { type: "cursor", offset: legacyOffset ?? 0 };
        } else if (legacyTarget === "afterSection" && legacyAfter) {
          insertStrategy = { type: "after_section", sectionId: legacyAfter as any, offset: legacyOffset ?? 0 };
        } else if (legacyTarget === "append") {
          insertStrategy = { type: "append" };
        }

        const jurisdictionStatus = (b as any).jurisdictionStatus as ClauseJurisdictionStatus | undefined;
        const jurisdictionReview =
          (b as any).jurisdictionReview ??
          (jurisdictionStatus
            ? {
                draftJurisdiction: (juris ?? "NY") as any,
                status: jurisdictionStatus === "Allowed" ? "ALLOWED" : jurisdictionStatus === "Warn" ? "WARNING" : "DISCOURAGED",
                overrideApplied: (b as any).jurisdictionAcknowledged ? true : undefined,
                overrideJustification: undefined,
                reviewedAt: insertedAt,
              }
            : undefined);

        const range = (b as any).range;
        return {
          id,
          clauseId,
          clauseVersion,
          insertedAt,
          insertMode: ((b as any).insertMode ?? "tracked") as any,
          insertStrategy,
          range: range && typeof range === "object" ? range : undefined,
          bindings: (b as any).bindings ?? undefined,
          renderedText,
          jurisdictionReview,
          notes: (b as any).notes ?? undefined,
        } satisfies InsertedClauseBlock;
      })
      .filter(Boolean) as InsertedClauseBlock[];

    return {
      ...base,
      ...parsed,
      compliance: { ...base.compliance, ...(parsed.compliance ?? {}) },
      fundingChecklist: parsed.fundingChecklist ?? base.fundingChecklist,
      parties: Array.isArray(parsed.parties) ? parsed.parties : base.parties,
      assets: Array.isArray(parsed.assets) ? parsed.assets : base.assets,
      jurisdiction: juris,
      clauseDraftPad,
      sectionIndex,
      insertedClauseBlocks,
      clauseInsertAfterSectionId: (parsed as any).clauseInsertAfterSectionId ?? base.clauseInsertAfterSectionId,
    };
  };

  const load = (): DraftModel | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return hydrate(JSON.parse(raw));
    } catch {
      return null;
    }
  };

  const save = (draft: DraftModel) => {
    localStorage.setItem(key, JSON.stringify(draft));
  };

  const clear = () => localStorage.removeItem(key);

  return { load, save, clear };
}

type LegalReviewAction = "print" | "export_pdf";
type LegalReviewEntry = {
  id: string;
  action: LegalReviewAction;
  scope: string;
  reviewer: string;
  reviewedAt: string;
};

const LEGAL_REVIEW_LOG_KEY = "smarttrust_legal_review_log_v1";

function loadLegalReviewLog(): LegalReviewEntry[] {
  try {
    const raw = window.localStorage.getItem(LEGAL_REVIEW_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as LegalReviewEntry[];
  } catch {
    return [];
  }
}

function appendLegalReviewEntry(entry: Omit<LegalReviewEntry, "id" | "reviewedAt">) {
  const next: LegalReviewEntry = {
    id: uuidv4(),
    reviewedAt: new Date().toISOString(),
    ...entry,
  };
  const log = loadLegalReviewLog();
  log.unshift(next);
  window.localStorage.setItem(LEGAL_REVIEW_LOG_KEY, JSON.stringify(log.slice(0, 200)));
}

function promptReviewerName(): string | null {
  const name = window.prompt("Reviewer name (for legal review log):");
  if (!name) return null;
  const trimmed = name.trim();
  return trimmed.length ? trimmed : null;
}

function openPrintDialogFromNode(node: HTMLElement, title: string) {
  const reviewer = promptReviewerName();
  if (!reviewer) return;
  appendLegalReviewEntry({ action: "print", scope: title, reviewer });

  const win = window.open("", "_blank", "noopener,noreferrer");
  if (!win) return;

  const styles = `
    <style>
      @page { size: letter; margin: 0.75in; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: #111; }
      h1,h2,h3 { margin: 0 0 8px 0; }
      .muted { color: #555; font-size: 12px; }
      .box { border: 1px solid #ddd; border-radius: 12px; padding: 12px; margin: 10px 0; }
      ul { margin: 8px 0 0 18px; }
      .sig { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .sig .line { border-top: 1px solid #999; padding-top: 6px; font-size: 12px; margin-top: 26px; }
    </style>
  `;

  win.document.open();
  win.document.write(`<!doctype html><html><head><title>${title}</title>${styles}</head><body>${node.innerHTML}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}

function DocumentBrandingHeader({
  firmName,
  firmEmail,
  firmPhone,
  firmAddress,
  disclaimer,
  docTitle,
  matterName,
  matterId,
  versionLabel,
}: {
  firmName?: string;
  firmEmail?: string;
  firmPhone?: string;
  firmAddress?: string;
  disclaimer?: string;
  docTitle: string;
  matterName: string;
  matterId?: string;
  versionLabel: string;
}) {
  return (
    <div className="rounded-2xl border p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">{firmName?.trim() ? firmName : "(Firm Name)"}</div>
          {firmAddress?.trim() ? <div className="mt-1 text-sm text-muted-foreground">{firmAddress}</div> : null}
          {firmEmail?.trim() ? <div className="text-sm text-muted-foreground">{firmEmail}</div> : null}
          {firmPhone?.trim() ? <div className="text-sm text-muted-foreground">{firmPhone}</div> : null}
        </div>
        <div className="text-right">
          <div className="text-sm font-medium">{docTitle}</div>
          <div className="text-xs text-muted-foreground">{versionLabel}</div>
          {matterId?.trim() ? <div className="text-xs text-muted-foreground">Matter ID: {matterId}</div> : null}
        </div>
      </div>
      <div className="mt-4 text-sm text-muted-foreground">
        Matter: <span className="font-medium text-foreground">{matterName}</span>
      </div>
      {disclaimer?.trim() ? (
        <div className="mt-3 rounded-2xl bg-muted/40 p-3 text-xs text-muted-foreground whitespace-pre-wrap">{disclaimer}</div>
      ) : null}
    </div>
  );
}

function Watermark({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="pointer-events-none select-none absolute inset-0 flex items-center justify-center">
      <div className="text-5xl font-semibold opacity-[0.06] rotate-[-18deg]">{text}</div>
    </div>
  );
}

type DraftLockState = {
  isLocked: boolean;
  lockedAt?: string;
  lockedBy?: string;
  lockReason?: string;
  memoVersion: number;
  trusteePacketVersion: number;
  fundingReportVersion: number;
};

const DRAFT_LOCK_KEY = "smarttrust_draft_lock_v1";
const DRAFT_LOCK_EVENT = "smarttrust_draft_lock_updated";

const REVIEW_MODE_KEY = "smarttrust_review_mode_v1";
const REVIEW_MODE_EVENT = "smarttrust_review_mode_updated";

function loadReviewMode(): boolean {
  try {
    const raw = window.localStorage.getItem(REVIEW_MODE_KEY);
    if (!raw) return false;
    return raw === "1" || raw === "true";
  } catch {
    return false;
  }
}

function saveReviewMode(on: boolean) {
  window.localStorage.setItem(REVIEW_MODE_KEY, on ? "1" : "0");
  window.dispatchEvent(new Event(REVIEW_MODE_EVENT));
}

function loadDraftLock(): DraftLockState {
  try {
    const raw = window.localStorage.getItem(DRAFT_LOCK_KEY);
    if (!raw) return { isLocked: false, memoVersion: 1, trusteePacketVersion: 1, fundingReportVersion: 1 };
    const parsed = JSON.parse(raw) as Partial<DraftLockState>;
    return {
      isLocked: Boolean(parsed.isLocked),
      lockedAt: parsed.lockedAt,
      lockedBy: parsed.lockedBy,
      lockReason: parsed.lockReason,
      memoVersion: typeof parsed.memoVersion === "number" ? parsed.memoVersion : 1,
      trusteePacketVersion: typeof parsed.trusteePacketVersion === "number" ? parsed.trusteePacketVersion : 1,
      fundingReportVersion: typeof parsed.fundingReportVersion === "number" ? parsed.fundingReportVersion : 1,
    };
  } catch {
    return { isLocked: false, memoVersion: 1, trusteePacketVersion: 1, fundingReportVersion: 1 };
  }
}

function saveDraftLock(state: DraftLockState) {
  window.localStorage.setItem(DRAFT_LOCK_KEY, JSON.stringify(state));
  // `storage` events do not fire in the same tab that wrote the value.
  window.dispatchEvent(new Event(DRAFT_LOCK_EVENT));
}

function lockDraft(by: string, reason: string) {
  const cur = loadDraftLock();
  saveDraftLock({ ...cur, isLocked: true, lockedAt: new Date().toISOString(), lockedBy: by, lockReason: reason });
}

function unlockDraft() {
  const cur = loadDraftLock();
  saveDraftLock({ ...cur, isLocked: false, lockedAt: undefined, lockedBy: undefined, lockReason: undefined });
}

function bumpVersion(scope: "memo" | "trustee" | "funding"): number {
  const cur = loadDraftLock();
  const next: DraftLockState = { ...cur };
  if (scope === "memo") next.memoVersion = Math.max(1, cur.memoVersion + 1);
  else if (scope === "trustee") next.trusteePacketVersion = Math.max(1, cur.trusteePacketVersion + 1);
  else next.fundingReportVersion = Math.max(1, cur.fundingReportVersion + 1);
  saveDraftLock(next);
  return scope === "memo" ? next.memoVersion : scope === "trustee" ? next.trusteePacketVersion : next.fundingReportVersion;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [reviewMode, setReviewMode] = useState<boolean>(() => loadReviewMode());

  useEffect(() => {
    const refresh = () => setReviewMode(loadReviewMode());
    const onStorage = (e: StorageEvent) => {
      if (e.key === REVIEW_MODE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(REVIEW_MODE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(REVIEW_MODE_EVENT, refresh);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border shadow-sm">
              <Landmark className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Trust & Estate Planning Workspace</div>
              <div className="text-xs text-muted-foreground">Intake • Draft Scaffold • Compliance • Export</div>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant={location.pathname === "/" ? "default" : "ghost"} size="sm">
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Link>
            </Button>
            <Button asChild variant={location.pathname.startsWith("/wizard") ? "default" : "ghost"} size="sm">
              <Link to="/wizard">
                <FileText className="mr-2 h-4 w-4" />
                Wizard
              </Link>
            </Button>
            <Button asChild variant={location.pathname === "/clauses" ? "default" : "ghost"} size="sm">
              <Link to="/clauses">
                <ScrollText className="mr-2 h-4 w-4" />
                Clauses
              </Link>
            </Button>
            <Button asChild variant={location.pathname === "/memo" ? "default" : "ghost"} size="sm">
              <Link to="/memo">
                <BookOpen className="mr-2 h-4 w-4" />
                Memo
              </Link>
            </Button>
            <Button asChild variant={location.pathname === "/funding" ? "default" : "ghost"} size="sm">
              <Link to="/funding">
                <ClipboardList className="mr-2 h-4 w-4" />
                Funding
              </Link>
            </Button>
            <Button asChild variant={location.pathname === "/references" ? "default" : "ghost"} size="sm">
              <Link to="/references">
                <Gavel className="mr-2 h-4 w-4" />
                References
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/ecclesiastical">
                <Church className="mr-2 h-4 w-4" />
                Ecclesiastical Trust
              </a>
            </Button>
            <div className="ml-2 hidden items-center gap-2 rounded-2xl border px-3 py-1 text-xs md:flex">
              <span className="text-muted-foreground">Review mode</span>
              <Checkbox
                checked={reviewMode}
                onCheckedChange={(v) => {
                  const next = Boolean(v);
                  setReviewMode(next);
                  saveReviewMode(next);
                }}
              />
            </div>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      <footer className="border-t">
        <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-muted-foreground">
          {/* Footer intentionally left blank */}
        </div>
      </footer>
    </div>
  );
}

type SmartTrustPlatformBinding = {
  clientId: string | null;
  trustId: string | null;
  lastUpdatedAt?: string | null;
  bindingValid?: "unknown" | "valid" | "invalid";
};

const SMART_TRUST_BINDING_KEY = "smart_trust_platform_binding_v1";
const SMART_TRUST_BINDING_EVENT = "smart_trust_platform_binding_updated";

function loadSmartTrustBinding(): SmartTrustPlatformBinding {
  if (typeof window === "undefined") return { clientId: null, trustId: null, lastUpdatedAt: null };
  try {
    const raw = window.localStorage.getItem(SMART_TRUST_BINDING_KEY);
    if (!raw) return { clientId: null, trustId: null, lastUpdatedAt: null };
    const parsed = JSON.parse(raw) as Partial<SmartTrustPlatformBinding>;
    return {
      clientId: typeof parsed.clientId === "string" ? parsed.clientId : null,
      trustId: typeof parsed.trustId === "string" ? parsed.trustId : null,
      lastUpdatedAt: typeof parsed.lastUpdatedAt === "string" ? parsed.lastUpdatedAt : null,
      bindingValid: parsed.bindingValid === "valid" || parsed.bindingValid === "invalid" ? parsed.bindingValid : "unknown",
    };
  } catch {
    return { clientId: null, trustId: null, lastUpdatedAt: null };
  }
}

function saveSmartTrustBinding(binding: SmartTrustPlatformBinding) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SMART_TRUST_BINDING_KEY, JSON.stringify(binding));
  window.dispatchEvent(new Event(SMART_TRUST_BINDING_EVENT));
}

function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [binding, setBinding] = useState<SmartTrustPlatformBinding>(() => loadSmartTrustBinding());
  const [bindValidStatus, setBindValidStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");

  const createdClient = useMemo(() => {
    const sp = new URLSearchParams(location.search || "");
    return sp.get("createdClient") === "1";
  }, [location.search]);

  const createClientHref = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("origin", "smart-trust");
    sp.set("returnTo", "/smart-trust/dashboard");
    return `/clients/new?${sp.toString()}`;
  }, []);

  useEffect(() => {
    saveSmartTrustBinding(binding);
  }, [binding]);

  useEffect(() => {
    const refresh = () => setBinding(loadSmartTrustBinding());
    const onStorage = (e: StorageEvent) => {
      if (e.key === SMART_TRUST_BINDING_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(SMART_TRUST_BINDING_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SMART_TRUST_BINDING_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams(location.search || "");
    const clientId = (sp.get("clientId") || "").trim();
    const trustId = (sp.get("trustId") || "").trim();
    if (!clientId && !trustId) return;
    setBinding((b) => ({
      ...b,
      clientId: clientId || b.clientId,
      trustId: trustId || b.trustId,
      bindingValid: trustId ? "unknown" : b.bindingValid ?? "unknown",
      lastUpdatedAt: new Date().toISOString(),
    }));
    // Clear query params after capturing.
    navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!binding.trustId) {
        setBindValidStatus("idle");
        return;
      }
      setBindValidStatus("checking");
      try {
        const res = await fetch(`/api/trusts/${encodeURIComponent(binding.trustId)}/workspace/summary`);
        if (!res.ok) {
          if (!cancelled) {
            setBindValidStatus("invalid");
            setBinding((b) => ({ ...b, bindingValid: "invalid" }));
          }
          return;
        }
        const data = await res.json();
        const derivedClientId = String(data?.trust?.clientId || "") || null;
        if (!cancelled) {
          setBindValidStatus("valid");
          setBinding((b) => ({
            ...b,
            clientId: b.clientId || derivedClientId,
            bindingValid: "valid",
          }));
        }
      } catch {
        if (!cancelled) {
          setBindValidStatus("invalid");
          setBinding((b) => ({ ...b, bindingValid: "invalid" }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [binding.trustId]);

  return (
    <div className="grid gap-6">
      {createdClient ? (
        <Alert className="rounded-2xl">
          <AlertDescription>Client created. Continue the Smart Trust wizard to create a Trust workspace.</AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Client Record (Canonical)</CardTitle>
          <CardDescription>Create the Client once, then attach it to a Trust workspace from within the wizard.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="text-sm text-muted-foreground">
            Client ID: <span className="font-mono text-foreground">{binding.clientId || "—"}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Trust ID:{" "}
            <span className="font-mono text-foreground">
              {binding.trustId || "—"}
              {binding.trustId && bindValidStatus === "invalid" ? " (invalid)" : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="rounded-2xl" variant="outline">
              <a href={createClientHref}>Create Client Record</a>
            </Button>
            {binding.clientId ? (
              <Button
                className="rounded-2xl"
                variant="secondary"
                onClick={() => setBinding({ clientId: null, trustId: binding.trustId || null, lastUpdatedAt: null })}
              >
                Clear Client
              </Button>
            ) : null}
            {binding.trustId ? (
              <Button
                className="rounded-2xl"
                variant="secondary"
                onClick={() => setBinding({ clientId: null, trustId: null, lastUpdatedAt: null, bindingValid: "unknown" })}
              >
                Clear Binding
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Start a new matter</CardTitle>
          <CardDescription>
            Choose what you are setting up. The wizard will walk through intake, drafting scaffolding, and compliance.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <EntityCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Revocable Living Trust"
              desc="Client-centric intake, funding checklist, successor trustee + incapacity planning."
              onClick={() => navigate("/wizard?type=revocable_living_trust")}
            />
            <div className="grid gap-2">
              <EntityCard
                icon={<HeartHandshake className="h-5 w-5" />}
                title="Charitable Foundation"
                desc="Public charity or private foundation pathway, governance and IRS filing readiness."
                onClick={() => navigate("/wizard?type=foundation")}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-2xl justify-start"
                onClick={() => navigate("/wizard?type=foundation&affiliation=religious_organization")}
              >
                <Church className="mr-2 h-4 w-4" />
                Religious Organization
              </Button>
            </div>
            <EntityCard
              icon={<Users className="h-5 w-5" />}
              title="Family Office"
              desc="Service scope, governance, and regulatory considerations (incl. adviser act family office rule)."
              onClick={() => navigate("/wizard?type=family_office")}
            />
          </div>
          <Separator />
          <div className="text-sm text-muted-foreground">
            Tip: Use this as a structured client interview. Export the Render Test to PDF for internal review or client-facing drafts.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">What this includes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex items-start gap-2">
              <Badge variant="secondary">1</Badge>
              <div>Entity-type guided workflow with reusable drafting scaffold.</div>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="secondary">2</Badge>
              <div>Governing-law (state) selection and state-aware issue prompts.</div>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="secondary">3</Badge>
              <div>Compliance checklist (conflicts, engagement, data room, tax counsel).</div>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="secondary">4</Badge>
              <div>Render Test panel with save-to-PDF export.</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EntityCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="group text-left" type="button">
      <Card className="h-full rounded-2xl shadow-sm transition-all group-hover:shadow-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border shadow-sm">{icon}</div>
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <CardDescription>{desc}</CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Launch wizard <ChevronRight className="inline h-3 w-3" />
        </CardContent>
      </Card>
    </button>
  );
}

type FundingTask = { id: string; label: string; notes?: string };

type TaskStatus = "not_started" | "in_progress" | "blocked" | "complete";

type TaskEvidence = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** dataUrl is optional; storing binaries in localStorage is not ideal. */
  dataUrl?: string;
  uploadedAt: string;
};

type TaskMeta = {
  completed: boolean;
  status: TaskStatus;
  assignee?: string;
  dueDate?: string;
  notes?: string;
  proof?: string;
  evidence: TaskEvidence[];
};

type ClauseDocType = "HEMS Trust" | "POA" | "Admin";
type ClauseTopic = "Distribution" | "Trustees" | "Tax" | "Powers" | "Administration";

type SectionId = "overview" | "distribution" | "poa" | "administration" | "trustees" | "tax" | "misc";

export type DraftSection = {
  id: SectionId;
  title: string;
  startOffset: number;
  endOffset: number;
};

export const SMART_TRUST_SECTIONS = [
  { id: "overview", title: "Trust Overview" },
  { id: "distribution", title: "Distribution Provisions" },
  { id: "poa", title: "Powers of Appointment" },
  { id: "administration", title: "Administrative Provisions" },
  { id: "trustees", title: "Trustee Provisions" },
  { id: "tax", title: "Tax Provisions" },
  { id: "misc", title: "Miscellaneous / Boilerplate" },
] as const;

function sectionHeaderLine(s: { title: string }) {
  return `## ${s.title}`;
}

function ensureCanonicalSectionsText(text: string) {
  const trimmed = (text ?? "").trim();
  if (trimmed.length) return text;
  return SMART_TRUST_SECTIONS.map((s) => `${sectionHeaderLine(s)}\n\n`).join("\n");
}

function buildSectionIndex(text: string): DraftSection[] {
  const t = text ?? "";

  // Find all headings (first occurrence each) using a robust multiline regex.
  const found: Array<{ id: SectionId; title: string; pos: number }> = [];
  for (const s of SMART_TRUST_SECTIONS) {
    const esc = s.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^##\\s+${esc}\\s*$`, "m");
    const m = re.exec(t);
    if (m?.index != null) found.push({ id: s.id, title: s.title, pos: m.index });
  }

  found.sort((a, b) => a.pos - b.pos);

  const sections: DraftSection[] = [];
  for (const def of SMART_TRUST_SECTIONS) {
    const cur = found.find((x) => x.id === def.id);
    const start = cur ? cur.pos : t.length;
    const nextFound = found.filter((x) => x.pos > start).sort((a, b) => a.pos - b.pos)[0];
    const end = nextFound ? nextFound.pos : t.length;
    sections.push({ id: def.id, title: def.title, startOffset: start, endOffset: end });
  }

  return sections;
}

type VariableSchema = {
  key: string;
  label: string;
  type: "string" | "number" | "date" | "enum" | "boolean";
  required: boolean;
  defaultValue?: string | number | boolean;
  options?: string[];
  validation?: { regex?: string; min?: number; max?: number };
};

type InsertedClauseBlock = {
  id: string;
  clauseId: string;
  clauseVersion: string;
  insertedAt: string;
  insertMode: "plain" | "tracked";
  insertStrategy:
    | { type: "cursor"; offset: number }
    | { type: "append" }
    | { type: "after_section"; sectionId: SectionId; offset: number };
  range?: { start: number; end: number };
  bindings?: Record<string, string>;
  renderedText: string;
  jurisdictionReview?: {
    draftJurisdiction: "NY" | "CA";
    status: "ALLOWED" | "WARNING" | "DISCOURAGED";
    overrideApplied?: boolean;
    overrideJustification?: string;
    reviewedAt: string;
  };
  notes?: string;
};

type ClauseCategory = "HEMS" | "POA" | "ADMIN";
type ClauseRisk = "Low" | "Medium" | "High";
type ClauseJurisdictionStatus = "Allowed" | "Warn" | "Discouraged" | "Unmapped";

type ClauseDefinition = {
  id: string;
  category: ClauseCategory;
  title: string;
  version: string; // e.g., v1
  trustTypes: EntityType[];
  risk: ClauseRisk;
  docTypes: ClauseDocType[];
  topics: ClauseTopic[];
  tags: string[];
  bodyTemplate: string;
  variables: VariableSchema[];
  updatedAt: string; // ISO date
  sourceNote?: string;
  notes: string[];
  jurisdictionRules: Partial<Record<GoverningState, { status: ClauseJurisdictionStatus; note?: string }>>;
  defaultStatus?: { status: ClauseJurisdictionStatus; note?: string };
};

const SMART_TRUST_CLAUSES: ClauseDefinition[] = [
  {
    id: "hems_standard_v1",
    version: "v1",
    category: "HEMS",
    title: "HEMS — Baseline (Ascertainable Standard)",
    trustTypes: ["revocable_living_trust"],
    risk: "Low",
    docTypes: ["HEMS Trust"],
    topics: ["Distribution", "Tax"],
    tags: ["HEMS", "ascertainable standard", "IRC 2041", "IRC 2514"],
    bodyTemplate:
      "The Trustee may distribute to or apply for the benefit of any beneficiary so much of the net income and principal of the trust as the Trustee, in the Trustee’s discretion, deems advisable for the beneficiary’s health, education, maintenance, and support, within the meaning of Internal Revenue Code Sections 2041 and 2514 and the regulations promulgated thereunder, taking into consideration other resources reasonably available to the beneficiary.",
    variables: [],
    updatedAt: "2026-01-01",
    sourceNote: "Canonical firm clause set (MVP). Attorney review required.",
    notes: [
      "Intended to preserve ascertainable standard treatment.",
      "Suitable where trustee-beneficiary overlap is possible.",
      "Common baseline for creditor and transfer-tax containment.",
    ],
    jurisdictionRules: {
      NY: { status: "Allowed" },
      CA: { status: "Allowed" },
    },
    defaultStatus: { status: "Unmapped", note: "No state-specific override mapped in MVP; attorney review required." },
  },
  {
    id: "hems_discretionary_overlay_v1",
    version: "v1",
    category: "HEMS",
    title: "HEMS + Discretionary Overlay",
    trustTypes: ["revocable_living_trust"],
    risk: "Medium",
    docTypes: ["HEMS Trust"],
    topics: ["Distribution", "Tax"],
    tags: ["HEMS", "discretionary", "estate inclusion guardrail"],
    bodyTemplate:
      "In addition to distributions permitted under the ascertainable standard described above, the Trustee may, in the Trustee’s sole and absolute discretion, make distributions of income or principal to or for the benefit of any beneficiary in such amounts and at such times as the Trustee determines to be in the best interests of the beneficiary, provided that such discretion shall not be exercised in a manner that would cause inclusion of the trust assets in any beneficiary’s gross estate for federal estate tax purposes.",
    variables: [],
    updatedAt: "2026-01-01",
    sourceNote: "Canonical firm clause set (MVP). Attorney review required.",
    notes: [
      "Blends flexibility with tax-conscious restraint.",
      "Must be coordinated carefully if trustee is also a beneficiary.",
      "Consider adding an independent trustee safeguard if risk tolerance is low.",
    ],
    jurisdictionRules: {
      NY: { status: "Warn", note: "New York courts may scrutinize discretionary language when trustee-beneficiary overlap exists." },
      CA: { status: "Allowed" },
    },
    defaultStatus: { status: "Unmapped", note: "No state-specific override mapped in MVP; attorney review required." },
  },
  {
    id: "lpoa_testamentary_v1",
    version: "v1",
    category: "POA",
    title: "Limited (Special) Power of Appointment — Testamentary",
    trustTypes: ["revocable_living_trust"],
    risk: "Low",
    docTypes: ["POA"],
    topics: ["Powers", "Tax"],
    tags: ["limited power of appointment", "testamentary", "non-inclusion"],
    bodyTemplate:
      "Upon the death of the beneficiary, the beneficiary shall have a limited testamentary power of appointment to appoint all or any portion of the remaining trust property, by specific reference in the beneficiary’s last will and testament, to or among the settlor’s descendants and such qualified charitable organizations as are described in Section 170(c) of the Internal Revenue Code, in such proportions and upon such terms as the beneficiary directs. This power shall not be exercisable in favor of the beneficiary, the beneficiary’s estate, the beneficiary’s creditors, or the creditors of the beneficiary’s estate.",
    variables: [],
    updatedAt: "2026-01-01",
    sourceNote: "Canonical firm clause set (MVP). Attorney review required.",
    notes: [
      "Preserves non-inclusion treatment.",
      "Commonly used to add flexibility without estate tax exposure.",
      "Confirm intended class of permissible appointees.",
    ],
    jurisdictionRules: {
      NY: { status: "Allowed" },
      CA: { status: "Allowed" },
    },
    defaultStatus: { status: "Unmapped", note: "No state-specific override mapped in MVP; attorney review required." },
  },
  {
    id: "gpoa_warning_v1",
    version: "v1",
    category: "POA",
    title: "General Power of Appointment — Warning Use Only",
    trustTypes: ["revocable_living_trust"],
    risk: "High",
    docTypes: ["POA"],
    topics: ["Powers", "Tax"],
    tags: ["general power of appointment", "estate inclusion", "IRC 2041"],
    bodyTemplate:
      "The beneficiary shall have a general power of appointment over the remaining trust property, exercisable by specific reference in the beneficiary’s last will and testament.",
    variables: [],
    updatedAt: "2026-01-01",
    sourceNote: "Canonical firm clause set (MVP). Attorney review required.",
    notes: [
      "Triggers estate inclusion under IRC §2041.",
      "Use only where inclusion is affirmatively intended (basis planning, estate equalization, etc.).",
      "Should almost always be paired with explicit tax rationale in attorney memo.",
    ],
    jurisdictionRules: {
      NY: { status: "Discouraged", note: "Estate inclusion and potential elective share exposure; document rationale." },
      CA: { status: "Warn", note: "Estate inclusion; review community property implications." },
    },
    defaultStatus: { status: "Unmapped", note: "No state-specific override mapped in MVP; attorney review required." },
  },
  {
    id: "spendthrift_standard_v1",
    version: "v1",
    category: "ADMIN",
    title: "Spendthrift Provision",
    trustTypes: ["revocable_living_trust", "foundation"],
    risk: "Low",
    docTypes: ["Admin"],
    topics: ["Administration"],
    tags: ["spendthrift", "creditor protection"],
    bodyTemplate:
      "No interest of any beneficiary in the income or principal of the trust shall be subject to assignment, anticipation, pledge, attachment, or claims of creditors prior to its actual receipt by the beneficiary, to the fullest extent permitted by applicable law.",
    variables: [],
    updatedAt: "2026-01-01",
    sourceNote: "Canonical firm clause set (MVP). Attorney review required.",
    notes: [
      "Standard creditor-protection provision.",
      "Effectiveness varies by jurisdiction and trust type.",
      "Not effective against certain statutory creditors.",
    ],
    jurisdictionRules: {
      NY: { status: "Allowed" },
      CA: { status: "Allowed" },
    },
    defaultStatus: { status: "Unmapped", note: "No state-specific override mapped in MVP; attorney review required." },
  },
  {
    id: "trustee_powers_condensed_v1",
    version: "v1",
    category: "ADMIN",
    title: "Trustee Powers — Condensed Administrative Authority",
    trustTypes: ["revocable_living_trust", "foundation", "family_office"],
    risk: "Low",
    docTypes: ["Admin"],
    topics: ["Trustees", "Administration"],
    tags: ["trustee powers", "UTC-style", "prudent fiduciary"],
    bodyTemplate:
      "The Trustee shall have all powers necessary or advisable to administer the trust and carry out its purposes, including, without limitation, the powers to retain, invest, reinvest, exchange, or dispose of trust property; to open, maintain, and close accounts; to employ and compensate professional advisers; to allocate receipts and disbursements in accordance with applicable law; and to take all actions a prudent fiduciary would take under similar circumstances.",
    variables: [],
    updatedAt: "2026-01-01",
    sourceNote: "Canonical firm clause set (MVP). Attorney review required.",
    notes: [
      "Drafted to align with UTC-style default powers.",
      "Should be reconciled with governing statute (EPTL, Probate Code, etc.).",
      "Expand or constrain for directed-trust or corporate trustee use.",
    ],
    jurisdictionRules: {
      NY: { status: "Allowed" },
      CA: { status: "Allowed" },
    },
    defaultStatus: { status: "Unmapped", note: "No state-specific override mapped in MVP; attorney review required." },
  },
];

function clauseJurisdictionStatus(clause: ClauseDefinition, state: GoverningState | null) {
  if (!state) return { status: "Unmapped" as ClauseJurisdictionStatus, note: "Select a governing state in the Wizard to evaluate rules." };
  return clause.jurisdictionRules[state] ?? clause.defaultStatus ?? { status: "Unmapped" as ClauseJurisdictionStatus };
}

const CLAUSE_FAVORITES_KEY = "smarttrust_clause_favorites_v1";
const CLAUSE_BINDINGS_KEY = "smarttrust_clause_bindings_v1";

function loadClauseFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(CLAUSE_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function saveClauseFavorites(ids: string[]) {
  window.localStorage.setItem(CLAUSE_FAVORITES_KEY, JSON.stringify(Array.from(new Set(ids)).slice(0, 500)));
}

function loadClauseBindingsCache(): Record<string, Record<string, string>> {
  try {
    const raw = window.localStorage.getItem(CLAUSE_BINDINGS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, Record<string, string>>;
  } catch {
    return {};
  }
}

function saveClauseBindingsCache(map: Record<string, Record<string, string>>) {
  window.localStorage.setItem(CLAUSE_BINDINGS_KEY, JSON.stringify(map));
}

function renderClauseTemplate(template: string, bindings: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key) => {
    const v = bindings[key];
    return v && v.trim().length ? v : `[[MISSING: ${key}]]`;
  });
}

function renderClauseTemplateNodes(template: string, bindings: Record<string, string>) {
  const parts: Array<string | { key: string; missing: boolean; value: string }> = [];
  let last = 0;
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) {
    const start = m.index;
    const end = re.lastIndex;
    if (start > last) parts.push(template.slice(last, start));
    const key = m[1];
    const v = (bindings[key] ?? "").trim();
    parts.push({ key, missing: !v, value: v || `MISSING: ${key}` });
    last = end;
  }
  if (last < template.length) parts.push(template.slice(last));

  return parts.map((p, idx) => {
    if (typeof p === "string") return <React.Fragment key={idx}>{p}</React.Fragment>;
    return (
      <span
        key={idx}
        className={cn(
          "px-1 rounded",
          p.missing ? "bg-destructive/15 text-destructive" : "bg-foreground/10 text-foreground"
        )}
        title={p.missing ? "Missing required variable" : `{{${p.key}}}`}
      >
        {p.missing ? `[[${p.value}]]` : p.value}
      </span>
    );
  });
}

type ReviewRow = {
  block: InsertedClauseBlock;
  clauseTitle: string;
  sectionTitle: string;
  status: "ALLOWED" | "WARNING" | "DISCOURAGED";
  hasOverride: boolean;
  jumpAnchor: { type: "range" | "heading" | "none"; offset?: number; sectionId?: SectionId };
};

function clauseBlockMarkerStart(blockId: string) {
  return `[[CLAUSE_BLOCK:${blockId}]]`;
}

function clauseBlockMarkerEnd() {
  return `[[/CLAUSE_BLOCK]]`;
}

function wrapTrackedClauseText(blockId: string, renderedClauseText: string) {
  return `${clauseBlockMarkerStart(blockId)}\n${renderedClauseText}\n${clauseBlockMarkerEnd()}`;
}

function findClauseBlockMarkerOffset(text: string, blockId: string): number | null {
  const needle = clauseBlockMarkerStart(blockId);
  const idx = (text ?? "").indexOf(needle);
  return idx >= 0 ? idx : null;
}

function stripClauseBlockMarkers(text: string): string {
  const lines = String(text ?? "").split("\n");
  const filtered = lines.filter((line) => {
    const t = line.trim();
    if (t.startsWith("[[CLAUSE_BLOCK:") && t.endsWith("]]")) return false;
    if (t === "[[/CLAUSE_BLOCK]]") return false;
    return true;
  });
  // normalize excessive blank lines a bit
  return filtered.join("\n").replace(/\n{3,}/g, "\n\n");
}

function deriveReviewRows(draft: DraftModel, clauseById: Map<string, ClauseDefinition>): ReviewRow[] {
  const text = draft.clauseDraftPad ?? "";
  const idx = (draft.sectionIndex ?? []) as DraftSection[];

  const sectionById = new Map<SectionId, DraftSection>();
  for (const s of idx) sectionById.set(s.id, s);

  const rows: ReviewRow[] = [];
  const blocks = (draft.insertedClauseBlocks ?? []) as InsertedClauseBlock[];
  for (const b of blocks) {
    const clause = clauseById.get(b.clauseId);
    const clauseTitle = clause?.title ?? `Unknown clause (ID: ${b.clauseId})`;

    // Determine sectionId (best-effort)
    let sectionId: SectionId | undefined = undefined;
    if (b.insertStrategy?.type === "after_section") {
      sectionId = b.insertStrategy.sectionId;
    } else if (typeof b.range?.start === "number") {
      const start = b.range.start;
      const hit = idx.find((s) => start >= s.startOffset && start < s.endOffset);
      sectionId = hit?.id;
    }

    const sectionTitle = sectionId ? sectionById.get(sectionId)?.title ?? "Unassigned" : "Unassigned";

    // Determine status + override
    const status = b.jurisdictionReview?.status ?? "WARNING";
    const hasOverride = Boolean(b.jurisdictionReview?.overrideApplied);

    // Jump anchor selection
    const start = b.range?.start;
    if (typeof start === "number" && start >= 0 && start < text.length) {
      rows.push({
        block: b,
        clauseTitle,
        sectionTitle,
        status,
        hasOverride,
        jumpAnchor: { type: "range", offset: start, sectionId },
      });
      continue;
    }

    if (sectionId) {
      const sec = sectionById.get(sectionId);
      if (sec && sec.startOffset >= 0 && sec.startOffset <= text.length) {
        rows.push({
          block: b,
          clauseTitle,
          sectionTitle,
          status,
          hasOverride,
          jumpAnchor: { type: "heading", offset: sec.startOffset, sectionId },
        });
        continue;
      }
    }

    rows.push({
      block: b,
      clauseTitle,
      sectionTitle,
      status,
      hasOverride,
      jumpAnchor: { type: "none" },
    });
  }

  return rows;
}

function jumpToAnchor(
  anchor: ReviewRow["jumpAnchor"],
  draftingPadRef: React.RefObject<HTMLTextAreaElement>,
  draftText: string,
  blockId?: string
) {
  const el = draftingPadRef.current;
  if (!el) return;
  // Prefer deterministic marker anchor if present
  const markerOff = blockId ? findClauseBlockMarkerOffset(draftText, blockId) : null;
  const off =
    typeof markerOff === "number"
      ? markerOff
      : typeof anchor.offset === "number"
        ? Math.max(0, Math.min(anchor.offset, draftText.length))
        : null;
  if (off == null) return;
  el.focus();
  try {
    el.setSelectionRange(off, off);
  } catch {
    // ignore
  }
}

function getFundingTasks(entityType: EntityType | null, category: Asset["category"]): FundingTask[] {
  if (!entityType) return [];

  const common: FundingTask[] = [
    { id: "collect-statements", label: "Collect current statements / ownership evidence" },
    { id: "confirm-beneficiaries", label: "Confirm beneficiary designations (if applicable)" },
    { id: "confirm-tax", label: "Confirm tax sensitivities and reporting triggers" },
  ];

  const byCategory: Record<Asset["category"], FundingTask[]> = {
    "Real Estate": [
      { id: "title-review", label: "Title review (deed, liens, lender consent)" },
      { id: "deed-prep", label: "Prepare deed / assignment to trust/entity" },
      { id: "transfer-tax", label: "Evaluate transfer/recording taxes + exemptions" },
      { id: "record", label: "Record deed + confirm post-recording indexing" },
      { id: "insurance", label: "Update homeowner/umbrella insurance + additional insureds" },
    ],
    "Bank/Brokerage": [
      { id: "account-opening", label: "Open trust/entity account (if needed)" },
      { id: "retitle", label: "Retitle account / update account registration" },
      { id: "poa-auth", label: "Confirm signatory authority + POA acceptance (if used)" },
      { id: "tod-pod", label: "Review TOD/POD vs trust titling (avoid conflicts)" },
    ],
    "Business Interest": [
      { id: "governing-docs", label: "Review operating/shareholder agreements for transfer restrictions" },
      { id: "consents", label: "Obtain required consents / approvals" },
      { id: "assignment", label: "Prepare assignment / joinder / amendment as needed" },
      { id: "cap-table", label: "Update cap table / ownership ledger" },
    ],
    "Digital Assets": [
      { id: "inventory", label: "Inventory wallets / accounts + access protocols" },
      { id: "custody", label: "Define custody model (self-custody vs institutional)" },
      { id: "keys", label: "Document key management + successor access plan" },
      { id: "terms", label: "Review platform ToS and transferability" },
    ],
    "Life Insurance": [
      { id: "beneficiary", label: "Confirm beneficiary designations align with plan" },
      { id: "ownership", label: "Confirm policy ownership (individual vs trust/entity)" },
      { id: "carrier-forms", label: "Submit carrier forms + confirm acceptance" },
      { id: "premium", label: "Confirm premium payment workflow (avoid lapse)" },
    ],
    "Art/Collectibles": [
      { id: "appraisal", label: "Obtain/confirm appraisal + provenance documentation" },
      { id: "title", label: "Document title / bill of sale / consignments" },
      { id: "storage", label: "Confirm storage, insurance, and location records" },
      { id: "loan", label: "Check museum loan agreements or restrictions" },
    ],
    "Other": [
      { id: "classify", label: "Classify asset and identify transfer mechanics" },
      { id: "paperwork", label: "Draft required paperwork / assignments" },
      { id: "confirm", label: "Confirm post-transfer evidence (letters, statements, filings)" },
    ],
  };

  const overlays: FundingTask[] =
    entityType === "revocable_living_trust"
      ? [
          { id: "schedule-a", label: "Update Schedule A / funding schedule" },
          { id: "pour-over", label: "Confirm pour-over will coordination for unfunded assets" },
        ]
      : entityType === "foundation"
        ? [
            { id: "capitalization", label: "Document initial capitalization / donor restrictions" },
            { id: "custody", label: "Confirm custody + investment policy alignment" },
          ]
        : [
            { id: "ops", label: "Confirm operating entity/structure + intercompany agreements" },
            { id: "controls", label: "Confirm signatory matrix + internal controls" },
          ];

  return [...byCategory[category], ...overlays, ...common];
}

function isCommunityPropertyState(state: GoverningState | null): boolean {
  if (!state) return false;
  // Common community property jurisdictions (not exhaustive; counsel should confirm).
  return ["AZ", "CA", "ID", "LA", "NV", "NM", "TX", "WA", "WI"].includes(state);
}

function taskMetaFor(draft: DraftModel, assetId: string, taskId: string): TaskMeta {
  const existing = draft.fundingChecklist?.[assetId]?.[taskId];
  return (
    existing ?? {
      completed: false,
      status: "not_started",
      evidence: [],
      notes: "",
      proof: "",
    }
  );
}

function FundingChecklistPage() {
  const storage = useLocalDraftStorage();
  const [draft, setDraft] = useState<DraftModel>(() => storage.load() ?? defaultDraft());
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [lock, setLock] = useState<DraftLockState>(() => loadDraftLock());

  // Packet export controls
  const [packetCategory, setPacketCategory] = useState<Asset["category"] | "ALL">("ALL");
  const packetRef = useRef<HTMLDivElement | null>(null);
  const [storeEvidenceData, setStoreEvidenceData] = useState(false);

  useEffect(() => {
    if (!loadDraftLock().isLocked) storage.save(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  useEffect(() => {
    const refresh = () => setLock(loadDraftLock());
    const onStorage = (e: StorageEvent) => {
      if (e.key === DRAFT_LOCK_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(DRAFT_LOCK_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(DRAFT_LOCK_EVENT, refresh);
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<Asset["category"], Asset[]>();
    for (const a of draft.assets) {
      if (!map.has(a.category)) map.set(a.category, []);
      map.get(a.category)!.push(a);
    }
    return Array.from(map.entries());
  }, [draft.assets]);

  function patchTask(assetId: string, taskId: string, patch: Partial<TaskMeta>) {
    setDraft((p) => {
      const current = { ...(p.fundingChecklist ?? {}) };
      const assetTasks = { ...(current[assetId] ?? {}) };
      const meta = { ...taskMetaFor(p, assetId, taskId), ...patch };
      if (meta.status === "complete") meta.completed = true;
      if (meta.completed) meta.status = "complete";
      assetTasks[taskId] = meta;
      current[assetId] = assetTasks;
      return { ...p, fundingChecklist: current };
    });
  }

  async function addEvidence(assetId: string, taskId: string, file: File) {
    const evBase: TaskEvidence = {
      id: uuidv4(),
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };

    const ev = storeEvidenceData
      ? {
          ...evBase,
          dataUrl: await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
          }),
        }
      : evBase;

    setDraft((p) => {
      const current = { ...(p.fundingChecklist ?? {}) };
      const assetTasks = { ...(current[assetId] ?? {}) };
      const meta = taskMetaFor(p, assetId, taskId);
      const next = { ...meta, evidence: [...(meta.evidence ?? []), ev] };
      assetTasks[taskId] = next;
      current[assetId] = assetTasks;
      return { ...p, fundingChecklist: current };
    });
  }

  function removeEvidence(assetId: string, taskId: string, evidenceId: string) {
    setDraft((p) => {
      const current = { ...(p.fundingChecklist ?? {}) };
      const assetTasks = { ...(current[assetId] ?? {}) };
      const meta = taskMetaFor(p, assetId, taskId);
      const next = { ...meta, evidence: (meta.evidence ?? []).filter((e) => e.id !== evidenceId) };
      assetTasks[taskId] = next;
      current[assetId] = assetTasks;
      return { ...p, fundingChecklist: current };
    });
  }

  const completion = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const a of draft.assets) {
      const tasks = getFundingTasks(draft.entityType, a.category);
      total += tasks.length;
      for (const t of tasks) {
        const meta = taskMetaFor(draft, a.id, t.id);
        if (meta.completed || meta.status === "complete") done += 1;
      }
    }
    return { total, done, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
  }, [draft.assets, draft.entityType, draft.fundingChecklist]);

  const assigneeOptions = useMemo(() => {
    const names = draft.parties.map((p) => p.name).filter((n) => n && n.trim().length > 0) as string[];
    return Array.from(new Set(names));
  }, [draft.parties]);

  async function exportPacketPDF() {
    if (!packetRef.current) return;
    const node = packetRef.current;
    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let y = 0;
    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    } else {
      while (y < imgHeight) {
        pdf.addImage(imgData, "PNG", 0, -y, imgWidth, imgHeight);
        y += pageHeight;
        if (y < imgHeight) pdf.addPage();
      }
    }

    const label = packetCategory === "ALL" ? "FundingPacket" : packetCategory.replaceAll(" ", "");
    pdf.save(`${draft.matterName || "Draft"}-${label}.pdf`);
  }

  async function exportFundingReportPDF() {
    if (!reportRef.current) return;

    const reviewer = promptReviewerName();
    if (!reviewer) return;

    appendLegalReviewEntry({ action: "export_pdf", scope: "Funding Status Report", reviewer });

    const nextVersion = bumpVersion("funding");
    lockDraft(reviewer, `Exported Funding Report v${nextVersion}`);

    const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "pt", "letter");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let y = 0;
    pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);

    while (imgHeight + y > pageHeight) {
      y -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
    }

    const currentLock = loadDraftLock();
    const mid = (draft.matterId || "").trim();
    const prefix = mid ? `${mid}-` : "";
    pdf.save(`${prefix}${draft.matterName || "Draft"}-FundingStatusReport-v${currentLock.fundingReportVersion}.pdf`);
  }

  function printFundingReport() {
    if (!reportRef.current) return;
    openPrintDialogFromNode(reportRef.current, "Funding Status Report");
  }

  const community = isCommunityPropertyState(draft.governingState);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <div className="text-lg font-semibold">Funding Checklist</div>
          <div className="text-sm text-muted-foreground">
            Matter: <span className="font-medium">{draft.matterName || "(unnamed)"}</span> • Entity:{" "}
            {formatEntityLabel(draft.entityType) || "(select in Wizard)"}
          </div>
          <div className="text-xs text-muted-foreground">
            Execution workstream: retitling, consents, forms, evidence capture, and attorney review.
          </div>
        </div>
        <div className="grid gap-2 text-right">
          <div className="text-xs text-muted-foreground">Overall completion</div>
          <div className="flex items-center justify-end gap-2">
            <Badge variant={completion.pct >= 80 ? "default" : "secondary"}>
              {completion.done}/{completion.total}
            </Badge>
            <Badge variant="outline">{completion.pct}%</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Printable Funding Packet</CardTitle>
              <CardDescription>
                Generate a category-specific packet (cover sheet + checklist + signature block) suitable for internal routing or institutional submissions.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Packet scope</Label>
                  <Select value={packetCategory} onValueChange={(v) => setPacketCategory(v as Asset["category"] | "ALL")}>
                    <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All categories</SelectItem>
                      <SelectItem value="Real Estate">Real Estate</SelectItem>
                      <SelectItem value="Bank/Brokerage">Bank/Brokerage</SelectItem>
                      <SelectItem value="Business Interest">Business Interest</SelectItem>
                      <SelectItem value="Digital Assets">Digital Assets</SelectItem>
                      <SelectItem value="Life Insurance">Life Insurance</SelectItem>
                      <SelectItem value="Art/Collectibles">Art/Collectibles</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Export</Label>
                  <Button onClick={exportPacketPDF} className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Export Packet PDF
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl border p-3">
                <div className="text-xs text-muted-foreground">
                  Store evidence file contents locally (Data URLs). Not recommended for large files.
                </div>
                <Checkbox checked={storeEvidenceData} onCheckedChange={(v) => setStoreEvidenceData(Boolean(v))} />
              </div>

              <div className="text-xs text-muted-foreground">
                Local-storage caution: evidence file binaries can exceed browser quotas. For production, store evidence in a secure backend (S3/Drive) with audit logs.
              </div>

              <div className="sr-only" aria-hidden="true">
                <div ref={packetRef} className="bg-background p-6">
                  <FundingPacketDocument draft={draft} scope={packetCategory} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Funding Taskboard</CardTitle>
              <CardDescription>Asset-level tasks with assignees, due dates, status, notes, and evidence.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {draft.assets.length === 0 ? (
                <div className="rounded-2xl border p-6 text-sm text-muted-foreground">
                  No assets found. Add assets in the Wizard → “Assets / Funding”, then return here.
                </div>
              ) : (
                <div className="grid gap-6">
                  {grouped.map(([category, assets]) => (
                    <div key={category} className="grid gap-3">
                      <div>
                        <div className="text-sm font-semibold">{category}</div>
                        <div className="text-xs text-muted-foreground">{assets.length} asset(s)</div>
                      </div>

                      <div className="grid gap-4">
                        {assets.map((a) => {
                          const tasks = getFundingTasks(draft.entityType, a.category);
                          const done = tasks.filter((t) => {
                            const m = taskMetaFor(draft, a.id, t.id);
                            return m.completed || m.status === "complete";
                          }).length;
                          const pct = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100);

                          return (
                            <div key={a.id} className="rounded-2xl border p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold">{a.description || "(untitled asset)"}</div>
                                  <div className="text-xs text-muted-foreground">{a.approximateValue || ""}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-muted-foreground">Completion</div>
                                  <div className="flex items-center justify-end gap-2">
                                    <Badge variant={pct >= 80 ? "default" : "secondary"}>{done}/{tasks.length}</Badge>
                                    <Badge variant="outline">{pct}%</Badge>
                                  </div>
                                </div>
                              </div>

                              {a.titlingNotes?.trim() ? (
                                <div className="mt-3 whitespace-pre-wrap rounded-2xl bg-muted/40 p-3 text-xs text-muted-foreground">
                                  {a.titlingNotes}
                                </div>
                              ) : null}

                              <Separator className="my-4" />

                              <div className="grid gap-3">
                                {tasks.map((t) => {
                                  const meta = taskMetaFor(draft, a.id, t.id);
                                  const assignee = meta.assignee ?? "";
                                  const dueDate = meta.dueDate ?? "";

                                  return (
                                    <div key={t.id} className="rounded-2xl border p-3">
                                      <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="flex items-start gap-3">
                                          <Checkbox
                                            checked={meta.completed || meta.status === "complete"}
                                            onCheckedChange={(v) =>
                                              patchTask(a.id, t.id, { completed: Boolean(v), status: Boolean(v) ? "complete" : "in_progress" })
                                            }
                                            className="mt-1"
                                          />
                                          <div>
                                            <div className="text-sm font-medium">{t.label}</div>
                                            {t.notes ? <div className="text-xs text-muted-foreground">{t.notes}</div> : null}
                                          </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                          <Select
                                            value={meta.status}
                                            onValueChange={(v) => patchTask(a.id, t.id, { status: v as TaskStatus, completed: v === "complete" })}
                                          >
                                            <SelectTrigger className="h-8 w-[150px] rounded-2xl text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="not_started">Not started</SelectItem>
                                              <SelectItem value="in_progress">In progress</SelectItem>
                                              <SelectItem value="blocked">Blocked</SelectItem>
                                              <SelectItem value="complete">Complete</SelectItem>
                                            </SelectContent>
                                          </Select>

                                          <Select
                                            value={assignee || "unassigned"}
                                            onValueChange={(v) => patchTask(a.id, t.id, { assignee: v === "unassigned" ? "" : v })}
                                          >
                                            <SelectTrigger className="h-8 w-[170px] rounded-2xl text-xs"><SelectValue placeholder="Assignee" /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="unassigned">Unassigned</SelectItem>
                                              {assigneeOptions.map((n) => (
                                                <SelectItem key={n} value={n}>{n}</SelectItem>
                                              ))}
                                              <SelectItem value="Attorney">Attorney</SelectItem>
                                              <SelectItem value="Paralegal">Paralegal</SelectItem>
                                              <SelectItem value="Client">Client</SelectItem>
                                              <SelectItem value="CPA">CPA</SelectItem>
                                              <SelectItem value="Institution">Institution</SelectItem>
                                            </SelectContent>
                                          </Select>

                                          <Input
                                            type="date"
                                            className="h-8 w-[150px] rounded-2xl text-xs"
                                            value={dueDate}
                                            onChange={(e) => patchTask(a.id, t.id, { dueDate: e.target.value })}
                                          />
                                        </div>
                                      </div>

                                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                                        <div className="grid gap-2">
                                          <Label className="text-xs">Notes</Label>
                                          <Textarea
                                            className="min-h-[72px] rounded-2xl text-xs"
                                            value={meta.notes ?? ""}
                                            onChange={(e) => patchTask(a.id, t.id, { notes: e.target.value })}
                                            placeholder="Internal notes, calls, required forms, reference numbers."
                                          />
                                        </div>
                                        <div className="grid gap-2">
                                          <Label className="text-xs">Proof / Evidence summary</Label>
                                          <Textarea
                                            className="min-h-[72px] rounded-2xl text-xs"
                                            value={meta.proof ?? ""}
                                            onChange={(e) => patchTask(a.id, t.id, { proof: e.target.value })}
                                            placeholder="e.g., Recorded deed book/page; custodian confirmation; amended ledger date; carrier acceptance."
                                          />
                                        </div>
                                      </div>

                                      <div className="mt-3 grid gap-2">
                                        <div className="text-xs font-medium">Evidence uploads</div>

                                        <div className="flex flex-wrap items-center gap-2">
                                          <Input
                                            type="file"
                                            className="rounded-2xl text-xs"
                                            onChange={async (e) => {
                                              const f = e.target.files?.[0];
                                              if (!f) return;
                                              await addEvidence(a.id, t.id, f);
                                              e.currentTarget.value = "";
                                            }}
                                          />
                                          <Button size="sm" variant="outline" onClick={() => patchTask(a.id, t.id, { status: "complete", completed: true })}>
                                            Mark complete
                                          </Button>
                                        </div>

                                        {(meta.evidence ?? []).length === 0 ? (
                                          <div className="text-xs text-muted-foreground">No evidence attached.</div>
                                        ) : (
                                          <div className="grid gap-2">
                                            {(meta.evidence ?? []).map((ev) => (
                                              <div key={ev.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2">
                                                <div className="text-xs">
                                                  <div className="font-medium">{ev.name}</div>
                                                  <div className="text-muted-foreground">
                                                    {Math.round(ev.size / 1024)} KB • {new Date(ev.uploadedAt).toLocaleString()}
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                  {ev.dataUrl ? (
                                                    <Button asChild size="sm" variant="outline">
                                                      <a href={ev.dataUrl} download={ev.name}>Download</a>
                                                    </Button>
                                                  ) : null}
                                                  <Button size="sm" variant="ghost" onClick={() => removeEvidence(a.id, t.id, ev.id)}>
                                                    Remove
                                                  </Button>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>

                                      <div className="mt-3 text-xs text-muted-foreground">
                                        Evidence to capture: recorded instrument / account confirmation / amended ledger / carrier acceptance letter.
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Funding Status Report Preview</CardTitle>
              <CardDescription>This is the exact content printed/exported.</CardDescription>
            </CardHeader>
            <CardContent>
              <div ref={reportRef} className="relative rounded-2xl border p-6 overflow-hidden">
                <Watermark text={`${(draft.matterId || "").trim()} • Funding v${loadDraftLock().fundingReportVersion}`.trim()} />

                <DocumentBrandingHeader
                  firmName={draft.firmName}
                  firmEmail={draft.firmEmail}
                  firmPhone={draft.firmPhone}
                  firmAddress={draft.firmAddress}
                  disclaimer={draft.firmDisclaimer}
                  docTitle="Funding Status Report"
                  matterName={draft.matterName || "(unnamed)"}
                  matterId={draft.matterId}
                  versionLabel={`Funding v${loadDraftLock().fundingReportVersion} • ${new Date().toLocaleDateString()}`}
                />

                <div className="mt-4 text-sm text-muted-foreground">
                  Governing law: <span className="font-medium text-foreground">{draft.governingState || "(none)"}</span>
                </div>

                <div className="mt-6 grid gap-4">
                  {draft.assets.map((a) => {
                    const tasks = getFundingTasks(draft.entityType, a.category);
                    const completedIds = new Set(
                      tasks
                        .filter((t) => {
                          const m = taskMetaFor(draft, a.id, t.id);
                          return m.completed || m.status === "complete";
                        })
                        .map((t) => t.id)
                    );

                    const pct = Math.round((completedIds.size / Math.max(1, tasks.length)) * 100);
                    const status = pct >= 100 ? "complete" : pct === 0 ? "not_started" : "in_progress";

                    const evidenceUploads = tasks.flatMap((t) => taskMetaFor(draft, a.id, t.id).evidence ?? []);
                    const notes = tasks
                      .map((t) => {
                        const m = taskMetaFor(draft, a.id, t.id);
                        const parts = [m.notes?.trim(), m.proof?.trim()].filter(Boolean);
                        return parts.length ? `${t.label}: ${parts.join(" • ")}` : "";
                      })
                      .filter(Boolean)
                      .join("\n");

                    const recommendedTitle =
                      (a.titlingNotes && a.titlingNotes.trim()) ||
                      (draft.trustName?.trim()
                        ? `Retitle to: ${draft.trustName.trim()} (confirm with counsel/institution).`
                        : "Retitle to the trust/entity as appropriate (confirm with counsel/institution).");

                    return (
                      <div key={a.id} className="rounded-2xl border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold">{a.description || "(asset)"}</div>
                            <div className="text-xs text-muted-foreground">
                              Class: <span className="font-medium text-foreground">{a.category}</span> • Status:{" "}
                              <span className="font-medium text-foreground">{status}</span>
                            </div>
                          </div>
                          <Badge variant="secondary">{pct}%</Badge>
                        </div>

                        <div className="mt-3">
                          <div className="text-xs font-medium">Titling template</div>
                          <div className="mt-1 whitespace-pre-wrap rounded-2xl bg-muted/40 p-3 text-xs font-mono">
                            {recommendedTitle}
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="text-xs font-medium">Checklist</div>
                          <ul className="mt-2 grid gap-2">
                            {tasks.map((t) => {
                              const done = completedIds.has(t.id);
                              return (
                                <li key={t.id} className="rounded-2xl border p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="text-xs font-semibold">{t.label}</div>
                                    <Badge variant={done ? "default" : "secondary"}>{done ? "Done" : "Open"}</Badge>
                                  </div>
                                  {t.notes ? <div className="mt-1 text-xs text-muted-foreground">{t.notes}</div> : null}
                                </li>
                              );
                            })}
                          </ul>
                        </div>

                        {evidenceUploads.length ? (
                          <div className="mt-3 rounded-2xl border p-3">
                            <div className="text-xs font-medium">Evidence log</div>
                            <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                              {evidenceUploads.map((ev) => (
                                <li key={ev.id}>
                                  {ev.name} — {new Date(ev.uploadedAt).toLocaleDateString()}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {notes.trim() ? (
                          <div className="mt-3 rounded-2xl border p-3">
                            <div className="text-xs font-medium">Notes</div>
                            <div className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{notes}</div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Evidence & Outputs</CardTitle>
              <CardDescription>Print/export artifacts for attorney workflow.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button onClick={exportFundingReportPDF} disabled={lock.isLocked || !draft.assets.length}>
                Export Funding Status Report (PDF)
              </Button>
              <Button variant="outline" onClick={printFundingReport} disabled={!draft.assets.length}>
                <Printer className="mr-2 h-4 w-4" />
                Print for Legal Review
              </Button>
              <div className="text-xs text-muted-foreground">
                Exports include: asset list, class, titling template, checklist completion, evidence log, and notes.
              </div>
            </CardContent>
          </Card>

          <Card className="sticky top-[86px] rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Jurisdiction Toggles</CardTitle>
              <CardDescription>State-aware prompts for funding work. Expand with firm-specific citations and checklists.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Governing: {draft.governingState ?? "(none)"}</Badge>
                {community ? <Badge variant="outline">Community property</Badge> : <Badge variant="outline">Not community property</Badge>}
              </div>

              <div className="rounded-2xl border p-4">
                <div className="text-sm font-semibold">Real estate funding prompts</div>
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                  <li>Confirm execution formalities (witnessing/notary) and county-specific recording requirements.</li>
                  <li>Evaluate transfer/recording taxes and exemptions; confirm documentary stamps where applicable.</li>
                  <li>Review lender due-on-sale / consent requirements; confirm title insurance endorsements if needed.</li>
                  {community ? <li>Community property characterization: confirm spousal consent and title implications.</li> : null}
                </ul>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="text-sm font-semibold">Accounts and beneficiary designations</div>
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                  <li>Coordinate POD/TOD designations with trust/entity titling to avoid inconsistent dispositive outcomes.</li>
                  <li>Confirm institution’s trust certification requirements and signatory authority matrix.</li>
                </ul>
              </div>

              <div className="rounded-2xl border p-4">
                <div className="text-sm font-semibold">Business interests</div>
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                  <li>Transfer restrictions and consent mechanics often control timing; plan around meeting schedules.</li>
                  <li>Update registers/cap tables and obtain written evidence of acceptance.</li>
                </ul>
              </div>

              <div className="rounded-2xl border p-4 text-xs text-muted-foreground">
                Production recommendation: replace this prompt set with state-by-state modules (UTC adoption, decanting, directed trust statutes, recording taxes) and attach citations.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FundingPacketDocument({ draft, scope }: { draft: DraftModel; scope: Asset["category"] | "ALL" }) {
  const entity = formatEntityLabel(draft.entityType) || "(select entity)";
  const state = draft.governingState || "(select state)";

  const assets = scope === "ALL" ? draft.assets : draft.assets.filter((a) => a.category === scope);
  const grouped = new Map<Asset["category"], Asset[]>();
  for (const a of assets) {
    if (!grouped.has(a.category)) grouped.set(a.category, []);
    grouped.get(a.category)!.push(a);
  }

  const coverTitle = scope === "ALL" ? "Funding Packet" : `${scope} Funding Packet`;

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border p-6">
        <div className="text-2xl font-semibold">{coverTitle}</div>
        <div className="mt-2 text-sm text-muted-foreground">
          Matter: <span className="font-medium text-foreground">{draft.matterName || "(unnamed)"}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          Entity: {entity} • Governing law: {state}
        </div>
        <div className="mt-4 grid gap-2 text-sm">
          <div className="rounded-2xl border p-4">
            <div className="font-semibold">Purpose</div>
            <div className="mt-1 text-muted-foreground">
              This packet supports the implementation of the asset funding plan. It includes asset inventory, execution tasks, and sign-off blocks.
            </div>
          </div>
          <div className="rounded-2xl border p-4">
            <div className="font-semibold">Routing</div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border p-3">
                <div className="text-xs text-muted-foreground">Prepared by</div>
                <div className="mt-6 border-t pt-2 text-xs">Signature</div>
              </div>
              <div className="rounded-2xl border p-3">
                <div className="text-xs text-muted-foreground">Reviewed by</div>
                <div className="mt-6 border-t pt-2 text-xs">Signature</div>
              </div>
              <div className="rounded-2xl border p-3">
                <div className="text-xs text-muted-foreground">Client approval (if applicable)</div>
                <div className="mt-6 border-t pt-2 text-xs">Signature</div>
              </div>
              <div className="rounded-2xl border p-3">
                <div className="text-xs text-muted-foreground">Institution / counterparty receipt</div>
                <div className="mt-6 border-t pt-2 text-xs">Signature</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {Array.from(grouped.entries()).map(([category, list]) => (
        <div key={category} className="rounded-2xl border p-6">
          <div className="text-lg font-semibold">{category}</div>
          <div className="mt-3 grid gap-4">
            {list.map((a) => {
              const tasks = getFundingTasks(draft.entityType, a.category);
              return (
                <div key={a.id} className="rounded-2xl border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold">{a.description || "(untitled asset)"}</div>
                      <div className="text-xs text-muted-foreground">{a.approximateValue || ""}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Asset ID: <span className="font-mono">{a.id.slice(0, 8)}</span>
                    </div>
                  </div>

                  {a.titlingNotes?.trim() ? (
                    <div className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{a.titlingNotes}</div>
                  ) : null}

                  <div className="mt-3">
                    <div className="text-sm font-medium">Execution checklist</div>
                    <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                      {tasks.map((t) => (
                        <li key={t.id}>{t.label}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border p-3">
                      <div className="text-xs text-muted-foreground">Prepared / submitted</div>
                      <div className="mt-6 border-t pt-2 text-xs">Signature • Date</div>
                    </div>
                    <div className="rounded-2xl border p-3">
                      <div className="text-xs text-muted-foreground">Confirmed complete</div>
                      <div className="mt-6 border-t pt-2 text-xs">Signature • Date</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="text-xs text-muted-foreground">
        Packet generated via Trust & Estate Planning Workspace • For internal workflow use
      </div>
    </div>
  );
}

function ClauseLibraryPage() {
  const storage = useLocalDraftStorage();
  const [draft, setDraft] = useState<DraftModel>(() => storage.load() ?? defaultDraft());
  const draftingPadRef = useRef<HTMLTextAreaElement | null>(null);
  const [lock, setLock] = useState<DraftLockState>(() => loadDraftLock());
  const [reviewMode, setReviewMode] = useState<boolean>(() => loadReviewMode());

  useEffect(() => {
    if (!loadDraftLock().isLocked) storage.save(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  useEffect(() => {
    const refresh = () => setLock(loadDraftLock());
    const onStorage = (e: StorageEvent) => {
      if (e.key === DRAFT_LOCK_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(DRAFT_LOCK_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(DRAFT_LOCK_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    const refresh = () => setReviewMode(loadReviewMode());
    const onStorage = (e: StorageEvent) => {
      if (e.key === REVIEW_MODE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(REVIEW_MODE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(REVIEW_MODE_EVENT, refresh);
    };
  }, []);

  // -----------------------------
  // Page-level UI state (minimal but scalable)
  // -----------------------------
  const [searchText, setSearchText] = useState("");
  const [docTypesSelected, setDocTypesSelected] = useState<ClauseDocType[]>([]);
  const [jurisdictionsSelected, setJurisdictionsSelected] = useState<GoverningState[]>([]);
  const [topicsSelected, setTopicsSelected] = useState<ClauseTopic[]>([]);
  const [riskSelected, setRiskSelected] = useState<Array<"Conservative" | "Standard" | "Aggressive">>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "configure" | "notes">("preview");
  const [insertTarget, setInsertTarget] = useState<"cursor" | "afterSection" | "append">("cursor");
  const [afterSectionId, setAfterSectionId] = useState<SectionId>(() => draft.clauseInsertAfterSectionId ?? "distribution");
  const [insertMode, setInsertMode] = useState<"plain" | "tracked">("tracked");

  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(loadClauseFavorites()));
  const [bindingsCache, setBindingsCache] = useState<Record<string, Record<string, string>>>(() => loadClauseBindingsCache());
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [bindingErrors, setBindingErrors] = useState<Record<string, string>>({});
  const [cursorSel, setCursorSel] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [jurisdictionAcknowledged, setJurisdictionAcknowledged] = useState(false);
  const [overrideJustification, setOverrideJustification] = useState("");

  const effectiveJurisdiction: "NY" | "CA" = (draft.jurisdiction ?? "NY") as any;

  useEffect(() => saveClauseFavorites(Array.from(favorites)), [favorites]);
  useEffect(() => saveClauseBindingsCache(bindingsCache), [bindingsCache]);

  // Ensure canonical section headings exist in the drafting pad (MVP).
  useEffect(() => {
    setDraft((p) => {
      const ensured = ensureCanonicalSectionsText(p.clauseDraftPad ?? "");
      if (ensured === (p.clauseDraftPad ?? "")) return p;
      return { ...p, clauseDraftPad: ensured };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Maintain deterministic section index from drafting pad.
  useEffect(() => {
    const text = draft.clauseDraftPad ?? "";
    const idx = buildSectionIndex(text);
    setDraft((p) => {
      // avoid churn if unchanged
      const prev = p.sectionIndex ?? [];
      if (JSON.stringify(prev) === JSON.stringify(idx)) return p;
      return { ...p, sectionIndex: idx };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.clauseDraftPad]);

  const visibleClauses = useMemo(() => {
    const byTrustType = draft.entityType
      ? SMART_TRUST_CLAUSES.filter((c) => c.trustTypes.includes(draft.entityType!))
      : SMART_TRUST_CLAUSES;

    const q = searchText.trim().toLowerCase();
    return byTrustType.filter((c) => {
      if (favoritesOnly && !favorites.has(c.id)) return false;

      const textMatch = !q
        ? true
        : `${c.title} ${c.tags.join(" ")} ${c.bodyTemplate}`.toLowerCase().includes(q);

      if (!textMatch) return false;

      if (docTypesSelected.length && !c.docTypes.some((d) => docTypesSelected.includes(d))) return false;
      if (topicsSelected.length && !c.topics.some((t) => topicsSelected.includes(t))) return false;

      if (jurisdictionsSelected.length) {
        const supported = Object.keys(c.jurisdictionRules) as GoverningState[];
        if (!supported.some((s) => jurisdictionsSelected.includes(s))) return false;
      }

      if (riskSelected.length) {
        // MVP mapping: Conservative=Low, Standard=Medium, Aggressive=High
        const bucket = c.risk === "Low" ? "Conservative" : c.risk === "Medium" ? "Standard" : "Aggressive";
        if (!riskSelected.includes(bucket)) return false;
      }

      return true;
    });
  }, [draft.entityType, docTypesSelected, favorites, favoritesOnly, jurisdictionsSelected, riskSelected, searchText, topicsSelected]);

  const selectedClause = useMemo(
    () => (selectedClauseId ? SMART_TRUST_CLAUSES.find((c) => c.id === selectedClauseId) ?? null : null),
    [selectedClauseId]
  );

  function validateAll(nextBindings: Record<string, string>, clause: ClauseDefinition | null) {
    const nextErrors: Record<string, string> = {};
    if (!clause) return nextErrors;
    for (const v of clause.variables) {
      const raw = (nextBindings[v.key] ?? "").trim();
      if (v.required && !raw) nextErrors[v.key] = "Required";
      if (!raw) continue;
      if (v.type === "number") {
        const n = Number(raw);
        if (Number.isNaN(n)) nextErrors[v.key] = "Must be a number";
        if (typeof v.validation?.min === "number" && n < v.validation.min) nextErrors[v.key] = `Min ${v.validation.min}`;
        if (typeof v.validation?.max === "number" && n > v.validation.max) nextErrors[v.key] = `Max ${v.validation.max}`;
      }
      if (v.type === "enum" && v.options?.length && !v.options.includes(raw)) nextErrors[v.key] = "Invalid option";
      if (v.validation?.regex) {
        try {
          const re = new RegExp(v.validation.regex);
          if (!re.test(raw)) nextErrors[v.key] = "Invalid format";
        } catch {
          // ignore invalid regex config
        }
      }
    }
    return nextErrors;
  }

  // Selection & default bindings
  useEffect(() => {
    if (!selectedClause) return;
    const cached = bindingsCache[selectedClause.id];
    const init: Record<string, string> = {};
    for (const v of selectedClause.variables) {
      const val = cached?.[v.key];
      if (typeof val === "string") init[v.key] = val;
      else if (typeof v.defaultValue === "string" || typeof v.defaultValue === "number" || typeof v.defaultValue === "boolean")
        init[v.key] = String(v.defaultValue);
      else init[v.key] = "";
    }
    setBindings(init);
    const errs = validateAll(init, selectedClause);
    setBindingErrors(errs);
    setActiveTab(selectedClause.variables.some((vv) => vv.required) ? "configure" : "preview");
    setJurisdictionAcknowledged(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClauseId]);

  const renderedText = useMemo(() => {
    if (!selectedClause) return "";
    return renderClauseTemplate(selectedClause.bodyTemplate, bindings);
  }, [bindings, selectedClause]);

  const canInsert = useMemo(() => {
    if (!selectedClause) return false;
    const errs = validateAll(bindings, selectedClause);
    if (Object.keys(errs).length !== 0) return false;
    const rule = clauseJurisdictionStatus(selectedClause, effectiveJurisdiction as any);
    // Warning: allow insert, but record in block. Discouraged: require override.
    if (rule.status === "Discouraged" || rule.status === "Unmapped") return jurisdictionAcknowledged;
    return true;
  }, [bindings, effectiveJurisdiction, jurisdictionAcknowledged, selectedClause]);

  function statusBadgeVariant(s: ClauseJurisdictionStatus): "default" | "secondary" | "outline" | "destructive" {
    if (s === "Allowed") return "default";
    if (s === "Warn") return "secondary";
    if (s === "Discouraged") return "destructive";
    return "outline";
  }

  async function exportSelectedClausePDF() {
    if (!selectedClause) return;
    const reviewer = promptReviewerName();
    if (!reviewer) return;

    appendLegalReviewEntry({ action: "export_pdf", scope: `Clause Export: ${selectedClause.id}`, reviewer });

    const node = document.getElementById("smarttrust-clause-preview-export");
    if (!node) return;

    const canvas = await html2canvas(node, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "pt", "letter");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let y = 0;
    pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
    while (imgHeight + y > pageHeight) {
      y -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, y, imgWidth, imgHeight);
    }

    const mid = (draft.matterId || "").trim();
    const prefix = mid ? `${mid}-` : "";
    pdf.save(`${prefix}${draft.matterName || "Draft"}-Clause-${selectedClause.id}.pdf`);
  }

  function printSelectedClause() {
    const node = document.getElementById("smarttrust-clause-preview-export");
    if (!node) return;
    openPrintDialogFromNode(node, "Clause Export");
  }

  function clearFilters() {
    setSearchText("");
    setDocTypesSelected([]);
    setJurisdictionsSelected([]);
    setTopicsSelected([]);
    setRiskSelected([]);
    setFavoritesOnly(false);
  }

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function insertSelected() {
    if (!selectedClause) return;
    const errs = validateAll(bindings, selectedClause);
    if (Object.keys(errs).length) {
      setBindingErrors(errs);
      setActiveTab("configure");
      return;
    }

    const payloadText = renderedText;
    const target = insertTarget;
    const mode = insertMode;
    const rule = clauseJurisdictionStatus(selectedClause, effectiveJurisdiction as any);
    if ((rule.status === "Discouraged" || rule.status === "Unmapped") && !jurisdictionAcknowledged) return;

    setDraft((p) => {
      const current = p.clauseDraftPad ?? "";
      const blockId = mode === "tracked" ? uuidv4() : "";
      const insertedTextForPad = mode === "tracked" ? wrapTrackedClauseText(blockId, payloadText) : payloadText;

      let insertAtStart = 0;
      let nextText = current;
      if (target === "append") {
        insertAtStart = current.length;
        nextText = current.trim().length ? `${current}\n\n${insertedTextForPad}` : insertedTextForPad;
      } else if (target === "afterSection") {
        const idx = buildSectionIndex(current);
        const hit = idx.find((s) => s.id === afterSectionId);
        insertAtStart = hit ? hit.endOffset : current.length;
        const prefix = current.slice(0, insertAtStart);
        const suffix = current.slice(insertAtStart);
        const glue = prefix.endsWith("\n") ? "\n" : "\n\n";
        nextText = prefix + glue + insertedTextForPad + "\n\n" + suffix.replace(/^\n+/, "");
      } else {
        const start = Math.max(0, Math.min(cursorSel.start, current.length));
        const end = Math.max(0, Math.min(cursorSel.end, current.length));
        insertAtStart = start;
        nextText = current.slice(0, start) + insertedTextForPad + current.slice(end);
      }

      const next: DraftModel = { ...p, clauseDraftPad: nextText };
      if (mode === "tracked") {
        const insertedAt = new Date().toISOString();
        const clauseVersion = selectedClause.version;
        const jurStatus =
          rule.status === "Allowed"
            ? "ALLOWED"
            : rule.status === "Warn"
              ? "WARNING"
              : "DISCOURAGED";

        const block: InsertedClauseBlock = {
          id: blockId,
          clauseId: selectedClause.id,
          clauseVersion,
          insertedAt,
          insertMode: mode,
          insertStrategy:
            target === "append"
              ? { type: "append" }
              : target === "afterSection"
                ? { type: "after_section", sectionId: afterSectionId, offset: insertAtStart }
                : { type: "cursor", offset: insertAtStart },
          range: { start: insertAtStart, end: insertAtStart + insertedTextForPad.length },
          bindings: { ...bindings },
          renderedText: payloadText,
          jurisdictionReview: {
            draftJurisdiction: effectiveJurisdiction,
            status: jurStatus,
            overrideApplied: jurStatus === "DISCOURAGED" ? true : undefined,
            overrideJustification: jurStatus === "DISCOURAGED" ? overrideJustification.trim() || undefined : undefined,
            reviewedAt: insertedAt,
          },
        };
        next.insertedClauseBlocks = [block, ...((p.insertedClauseBlocks ?? []) as InsertedClauseBlock[])].slice(0, 500);
      }
      next.clauseInsertAfterSectionId = afterSectionId;
      return next;
    });

    setBindingsCache((prev) => ({ ...prev, [selectedClause.id]: { ...bindings } }));
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <div className="text-lg font-semibold">Clause Library</div>
          <div className="text-sm text-muted-foreground">MVP, jurisdiction-aware, defensible. Review-first; clause blocks only.</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden items-center gap-2 rounded-2xl border px-3 py-1 text-xs md:flex">
            <span className="text-muted-foreground">Jurisdiction</span>
            <Select
              value={draft.jurisdiction ?? "NY"}
              onValueChange={(v) => setDraft((p) => ({ ...p, jurisdiction: v as any }))}
            >
              <SelectTrigger className="h-8 w-[92px] rounded-2xl text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NY">NY</SelectItem>
                <SelectItem value="CA">CA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={insertSelected} disabled={!selectedClause || !canInsert}>
            Insert selected
          </Button>
          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
          {lock.isLocked ? <Badge variant="secondary">Locked — {lock.lockReason || "Reviewed"}</Badge> : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* Left Panel: Search + Filters + Clause List */}
        <div className="space-y-6">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Search</CardTitle>
              <CardDescription>Full-text over title, tags, and clause body.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Input value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search… (e.g., HEMS, spendthrift, 2041)" className="rounded-2xl" />
              <label className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Favorites only</span>
                <Checkbox checked={favoritesOnly} onCheckedChange={(v) => setFavoritesOnly(Boolean(v))} />
              </label>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Filters</CardTitle>
              <CardDescription>Stacked multi-select filters (MVP).</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-xs">
              <div className="grid gap-2">
                <div className="font-medium">Document type</div>
                {(["HEMS Trust", "POA", "Admin"] as ClauseDocType[]).map((d) => (
                  <label key={d} className="flex items-center justify-between gap-2">
                    <span>{d}</span>
                    <Checkbox
                      checked={docTypesSelected.includes(d)}
                      onCheckedChange={(v) =>
                        setDocTypesSelected((prev) => (v ? [...prev, d] : prev.filter((x) => x !== d)))
                      }
                    />
                  </label>
                ))}
              </div>

              <div className="grid gap-2">
                <div className="font-medium">Jurisdiction (supported)</div>
                {(["NY", "CA"] as GoverningState[]).map((s) => (
                  <label key={s} className="flex items-center justify-between gap-2">
                    <span>{s}</span>
                    <Checkbox
                      checked={jurisdictionsSelected.includes(s)}
                      onCheckedChange={(v) =>
                        setJurisdictionsSelected((prev) => (v ? [...prev, s] : prev.filter((x) => x !== s)))
                      }
                    />
                  </label>
                ))}
              </div>

              <div className="grid gap-2">
                <div className="font-medium">Topic</div>
                {(["Distribution", "Trustees", "Tax", "Powers", "Administration"] as ClauseTopic[]).map((t) => (
                  <label key={t} className="flex items-center justify-between gap-2">
                    <span>{t}</span>
                    <Checkbox
                      checked={topicsSelected.includes(t)}
                      onCheckedChange={(v) => setTopicsSelected((prev) => (v ? [...prev, t] : prev.filter((x) => x !== t)))}
                    />
                  </label>
                ))}
              </div>

              <div className="grid gap-2">
                <div className="font-medium">Risk level</div>
                {(["Conservative", "Standard", "Aggressive"] as Array<"Conservative" | "Standard" | "Aggressive">).map((r) => (
                  <label key={r} className="flex items-center justify-between gap-2">
                    <span>{r}</span>
                    <Checkbox
                      checked={riskSelected.includes(r)}
                      onCheckedChange={(v) => setRiskSelected((prev) => (v ? [...prev, r] : prev.filter((x) => x !== r)))}
                    />
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Clause List</CardTitle>
              <CardDescription>
                Results: <span className="font-medium text-foreground">{visibleClauses.length}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {visibleClauses.map((c) => {
                const rule = clauseJurisdictionStatus(c, effectiveJurisdiction);
                const reqVars = c.variables.filter((v) => v.required).length;
                const isSelected = selectedClauseId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedClauseId(c.id)}
                    className={cn("rounded-2xl border p-3 text-left transition", isSelected ? "border-foreground" : "hover:bg-muted/30")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{c.title}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{c.docTypes[0]}</Badge>
                          <Badge variant={statusBadgeVariant(rule.status)}>{rule.status}</Badge>
                          <Badge variant="secondary">Vars: {reqVars}</Badge>
                          <Badge variant="secondary">Risk: {c.risk}</Badge>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFavorite(c.id);
                        }}
                      >
                        {favorites.has(c.id) ? "★" : "☆"}
                      </Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {c.tags.slice(0, 6).map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Preview + Configure + Insert */}
        <div className="space-y-6">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Preview + Configure + Insert</CardTitle>
              <CardDescription>Selection drives the preview; configure variables (if any) before inserting.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {!selectedClause ? (
                <div className="rounded-2xl border p-4 text-sm text-muted-foreground">Select a clause on the left.</div>
              ) : (
                <>
                  <div id="smarttrust-clause-preview-export" className="rounded-2xl border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{selectedClause.title}</div>
                        {reviewMode ? (
                          <>
                            <div className="text-xs text-muted-foreground">
                              ID: <span className="font-mono">{selectedClause.id}</span> • Version: {selectedClause.version} • Updated: {selectedClause.updatedAt}
                            </div>
                            {selectedClause.sourceNote ? <div className="text-xs text-muted-foreground">{selectedClause.sourceNote}</div> : null}
                          </>
                        ) : null}
                      </div>
                      {reviewMode ? (
                        <Badge variant={statusBadgeVariant(clauseJurisdictionStatus(selectedClause, effectiveJurisdiction).status)}>
                          {clauseJurisdictionStatus(selectedClause, effectiveJurisdiction).status}
                        </Badge>
                      ) : null}
                    </div>

                    {reviewMode ? (
                      (() => {
                        const r = clauseJurisdictionStatus(selectedClause, effectiveJurisdiction);
                        if (r.status === "Allowed") return null;
                        const border =
                          r.status === "Discouraged" ? "border-destructive/50" : r.status === "Warn" ? "border-foreground/20" : "";
                        return (
                          <div className={cn("mt-3 rounded-2xl border p-3 text-xs", border)}>
                            <div className="font-medium">
                              Jurisdiction banner: {effectiveJurisdiction ?? "(none)"} — {r.status}
                            </div>
                            {r.note ? <div className="mt-1 text-muted-foreground">{r.note}</div> : null}
                            {r.status === "Warn" || r.status === "Discouraged" ? (
                              <div className="mt-2 text-muted-foreground">Insert requires acknowledgment (tracked on the clause block).</div>
                            ) : null}
                          </div>
                        );
                      })()
                    ) : null}

                    <Separator className="my-3" />

                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                      <TabsList className="grid w-full grid-cols-3 rounded-2xl">
                        <TabsTrigger value="preview">Preview</TabsTrigger>
                        <TabsTrigger value="configure">Configure</TabsTrigger>
                        <TabsTrigger value="notes">Notes</TabsTrigger>
                      </TabsList>

                      <TabsContent value="preview" className="mt-4">
                        <div className="whitespace-pre-wrap text-sm">
                          {renderClauseTemplateNodes(selectedClause.bodyTemplate, bindings)}
                        </div>
                        {Object.keys(bindingErrors).length ? (
                          <div className="mt-3 text-xs text-destructive">Missing/invalid variables: {Object.keys(bindingErrors).join(", ")}</div>
                        ) : null}
                      </TabsContent>

                      <TabsContent value="configure" className="mt-4">
                        {selectedClause.variables.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No variables for this clause.</div>
                        ) : (
                          <div className="grid gap-3">
                            {selectedClause.variables.map((v) => (
                              <div key={v.key} className="grid gap-1">
                                <Label className="text-xs">
                                  {v.label} {v.required ? <span className="text-destructive">*</span> : null}
                                </Label>
                                {v.type === "enum" ? (
                                  <Select
                                    value={bindings[v.key] ?? ""}
                                    onValueChange={(val) => {
                                      const next = { ...bindings, [v.key]: val };
                                      setBindings(next);
                                      setBindingErrors(validateAll(next, selectedClause));
                                    }}
                                  >
                                    <SelectTrigger className="rounded-2xl"><SelectValue placeholder="Select…" /></SelectTrigger>
                                    <SelectContent>
                                      {(v.options ?? []).map((opt) => (
                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input
                                    className="rounded-2xl"
                                    value={bindings[v.key] ?? ""}
                                    onChange={(e) => {
                                      const next = { ...bindings, [v.key]: e.target.value };
                                      setBindings(next);
                                      setBindingErrors(validateAll(next, selectedClause));
                                    }}
                                  />
                                )}
                                {bindingErrors[v.key] ? <div className="text-xs text-destructive">{bindingErrors[v.key]}</div> : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="notes" className="mt-4">
                        {selectedClause.notes.length ? (
                          <ul className="list-disc pl-5 text-sm text-muted-foreground">
                            {selectedClause.notes.map((n, i) => (
                              <li key={i}>{n}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-sm text-muted-foreground">No drafting notes.</div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>

                  <div className="grid gap-3 rounded-2xl border p-4">
                    <div className="text-sm font-semibold">Insert controls</div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label className="text-xs">Insert position</Label>
                        <Select value={insertTarget} onValueChange={(v) => setInsertTarget(v as any)}>
                          <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cursor">At cursor</SelectItem>
                            <SelectItem value="afterSection">After section…</SelectItem>
                            <SelectItem value="append">Append to end</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-xs">Insert mode</Label>
                        <Select value={insertMode} onValueChange={(v) => setInsertMode(v as any)}>
                          <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="plain">Plain text</SelectItem>
                            <SelectItem value="tracked">Tracked clause block</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {insertTarget === "afterSection" ? (
                      <div className="grid gap-2">
                        <Label className="text-xs">After section</Label>
                        <Select value={afterSectionId} onValueChange={(v) => setAfterSectionId(v as any)}>
                          <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SMART_TRUST_SECTIONS.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    {selectedClause ? (() => {
                      const r = clauseJurisdictionStatus(selectedClause, effectiveJurisdiction as any);
                      if (r.status === "Allowed") return null;
                      const needsOverride = r.status === "Discouraged" || r.status === "Unmapped";
                      return (
                        <div className={cn("rounded-2xl border p-3 text-xs", r.status === "Discouraged" ? "border-destructive/50" : "")}>
                          <div className="font-medium">
                            Jurisdiction check: {effectiveJurisdiction} — {needsOverride ? "Discouraged" : "Warning"}
                          </div>
                          {r.note ? <div className="mt-1 text-muted-foreground">{r.note}</div> : null}
                          {needsOverride ? (
                            <>
                              <label className="mt-2 flex items-center justify-between gap-2">
                                <span>Override required to insert</span>
                                <Checkbox checked={jurisdictionAcknowledged} onCheckedChange={(v) => setJurisdictionAcknowledged(Boolean(v))} />
                              </label>
                              <div className="mt-2 grid gap-1">
                                <Label className="text-[11px]">Override justification (recommended)</Label>
                                <Textarea
                                  className="min-h-[72px] rounded-2xl text-xs"
                                  value={overrideJustification}
                                  onChange={(e) => setOverrideJustification(e.target.value)}
                                  placeholder="Short attorney justification for using a discouraged clause in this jurisdiction."
                                />
                              </div>
                            </>
                          ) : (
                            <div className="mt-2 text-muted-foreground">Warning will be recorded on tracked insertions.</div>
                          )}
                        </div>
                      );
                    })() : null}

                    <div className="flex flex-wrap gap-2">
                      <Button onClick={insertSelected} disabled={!canInsert}>Insert selected</Button>
                      <Button variant="outline" onClick={exportSelectedClausePDF} disabled={!selectedClause}>
                        <Download className="mr-2 h-4 w-4" />
                        Export (PDF)
                      </Button>
                      <Button variant="outline" onClick={printSelectedClause} disabled={!selectedClause}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs">Drafting Pad (MVP editor integration)</Label>
                    {!reviewMode ? (
                      <div className="rounded-2xl border p-3 text-xs text-muted-foreground">
                        Clean view (markers hidden). Switch <span className="font-medium text-foreground">Review mode</span> ON to edit raw text (includes markers).
                      </div>
                    ) : null}
                    <Textarea
                      ref={draftingPadRef}
                      className="min-h-[220px] rounded-2xl"
                      value={reviewMode ? (draft.clauseDraftPad ?? "") : stripClauseBlockMarkers(draft.clauseDraftPad ?? "")}
                      readOnly={!reviewMode}
                      onChange={(e) => {
                        if (!reviewMode) return;
                        setDraft((p) => ({ ...p, clauseDraftPad: e.target.value }));
                      }}
                      onSelect={(e) => {
                        const el = e.currentTarget;
                        setCursorSel({ start: el.selectionStart ?? 0, end: el.selectionEnd ?? 0 });
                      }}
                      placeholder="Insert clause blocks here. (At-cursor insertion is supported in this pad.)"
                    />
                    <div className="text-xs text-muted-foreground">
                      Governing state (from Wizard): <span className="font-medium text-foreground">{draft.governingState ?? "(none)"}</span> •
                      Trust type: <span className="font-medium text-foreground">{draft.entityType ? formatEntityLabel(draft.entityType) : "(none)"}</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ReferencesPage() {
  return (
    <div className="grid gap-6">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Reference Framework (high-level)</CardTitle>
          <CardDescription>This page is intentionally non-exhaustive. We can expand into a jurisdiction-aware library.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <div className="grid gap-2">
            <div className="font-semibold">Grantor / Estate planning (common federal touchpoints)</div>
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>Grantor trust rules (IRC §§ 671–679) and resulting income tax attribution.</li>
              <li>
                Federal transfer tax concepts: gift/estate tax, portability, valuation, and reporting triggers (e.g., Forms 709/706 where applicable).
              </li>
              <li>Income tax administration for trusts/estates (Form 1041) and distributable net income (DNI) mechanics (non-legal summary).</li>
            </ul>
          </div>
          <div className="grid gap-2">
            <div className="font-semibold">Charitable entities</div>
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>501(c)(3) formation pathways; public charity vs private foundation distinction.</li>
              <li>Private foundation excise-tax regime (IRC Chapter 42): self-dealing, minimum distributions, excess business holdings, jeopardizing investments, taxable expenditures.</li>
              <li>Federal reporting: Form 990 / 990-PF (depending on classification).</li>
            </ul>
          </div>
          <div className="grid gap-2">
            <div className="font-semibold">Family office considerations</div>
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>SEC “family office” exclusion (rule-based analysis required based on structure and services).</li>
              <li>Entity selection + governance: LLC/LP management, investment committee charter, policies and controls.</li>
              <li>Privacy, cybersecurity, and operational risk controls (vendor management, access controls, incident response).</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SmartTrustAttorneyMemoPage() {
  const storage = useLocalDraftStorage();
  const [draft] = useState<DraftModel>(() => storage.load() ?? defaultDraft());
  const renderRef = useRef<HTMLDivElement | null>(null);

  const byId = useMemo(() => new Map(SMART_TRUST_CLAUSES.map((c) => [c.id, c] as const)), []);
  const blocks = (draft.insertedClauseBlocks ?? []) as InsertedClauseBlock[];
  const flagged = blocks.filter((b) => b.jurisdictionReview?.status === "WARNING" || b.jurisdictionReview?.status === "DISCOURAGED");
  const overrides = blocks.filter((b) => b.jurisdictionReview?.status === "DISCOURAGED" && b.jurisdictionReview?.overrideApplied);

  async function exportPDF() {
    if (!renderRef.current) return;
    const reviewer = promptReviewerName();
    if (!reviewer) return;
    appendLegalReviewEntry({ action: "export_pdf", scope: "Smart Trust Attorney Memo", reviewer });
    const nextVersion = bumpVersion("memo");
    lockDraft(reviewer, `Exported Smart Trust Memo v${nextVersion}`);

    const canvas = await html2canvas(renderRef.current, { scale: 2, useCORS: true, backgroundColor: null });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let y = 0;
    while (y < imgHeight) {
      pdf.addImage(imgData, "PNG", 0, -y, imgWidth, imgHeight);
      y += pageHeight;
      if (y < imgHeight) pdf.addPage();
    }
    const v = loadDraftLock().memoVersion;
    const mid = (draft.matterId || "").trim();
    const prefix = mid ? `${mid}-` : "";
    pdf.save(`${prefix}${draft.matterName || "Draft"}-SmartTrustMemo-v${v}.pdf`);
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <div className="text-lg font-semibold">Attorney Memo (Smart Trust)</div>
          <div className="text-sm text-muted-foreground">Defensible summary of clause selections and jurisdiction acknowledgements.</div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={exportPDF}>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!renderRef.current) return;
              openPrintDialogFromNode(renderRef.current, "Smart Trust Attorney Memo");
            }}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print for Legal Review
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="pt-6">
          <div ref={renderRef} className="grid gap-4">
            <div className="relative">
              <Watermark text={`${(draft.matterId || "").trim()} • Memo v${loadDraftLock().memoVersion}`.trim()} />
              <DocumentBrandingHeader
                firmName={draft.firmName}
                firmEmail={draft.firmEmail}
                firmPhone={draft.firmPhone}
                firmAddress={draft.firmAddress}
                disclaimer={draft.firmDisclaimer}
                docTitle="Attorney Memorandum (Clause Library)"
                matterName={draft.matterName || "(unnamed)"}
                matterId={draft.matterId}
                versionLabel={`Memo v${loadDraftLock().memoVersion} • ${new Date().toLocaleDateString()}`}
              />
              <div className="mt-2 text-sm text-muted-foreground">Governing law: {draft.governingState || "(none)"}</div>
            </div>

            <div className="rounded-2xl border p-6">
              <div className="text-lg font-semibold">1. Selected Clauses</div>
              {(draft.selectedClauses ?? []).length === 0 ? (
                <div className="mt-2 text-sm text-muted-foreground">(none)</div>
              ) : (
                <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                  {(draft.selectedClauses ?? []).map((id) => {
                    const c = byId.get(id);
                    return (
                      <li key={id}>
                        <span className="font-medium text-foreground">{c?.title ?? id}</span>{" "}
                        <span className="text-muted-foreground">({id})</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border p-6">
              <div className="text-lg font-semibold">2. Jurisdiction Flags & Acknowledgements</div>
              <div className="mt-2 text-sm text-muted-foreground">
                This section records clause-level jurisdiction statuses (Allowed/Warn/Discouraged) and whether warnings were acknowledged at insertion.
              </div>

              {(flagged.length === 0) ? (
                <div className="mt-3 text-sm text-muted-foreground">(no warnings recorded)</div>
              ) : (
                <div className="mt-3 grid gap-3">
                  {flagged.map((b, i) => {
                    const c = byId.get(b.clauseId);
                    const jr = b.jurisdictionReview;
                    return (
                      <div key={`${b.insertedAt}-${i}`} className="rounded-2xl border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold">{c?.title ?? b.clauseId}</div>
                            <div className="text-xs text-muted-foreground">
                              Clause ID: <span className="font-mono">{b.clauseId}</span> • Status: {jr?.status ?? "(n/a)"} • State: {jr?.draftJurisdiction ?? "(n/a)"}
                            </div>
                            {jr?.overrideJustification ? <div className="mt-1 text-xs text-muted-foreground">Justification: {jr.overrideJustification}</div> : null}
                          </div>
                          <Badge variant={jr?.status === "DISCOURAGED" ? "destructive" : "secondary"}>
                            {jr?.status === "DISCOURAGED" ? "Override" : "Warning"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {overrides.length ? (
                <div className="mt-4 text-xs text-muted-foreground">
                  Overrides recorded: <span className="font-medium text-foreground">{overrides.length}</span>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border p-6">
              <div className="text-lg font-semibold">3. Drafting Pad (Snapshot)</div>
              <div className="mt-2 whitespace-pre-wrap rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
                {stripClauseBlockMarkers(draft.clauseDraftPad ?? "").trim()
                  ? stripClauseBlockMarkers(draft.clauseDraftPad ?? "")
                  : "(empty)"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WizardPage() {
  const storage = useLocalDraftStorage();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const preselect = params.get("type") as EntityType | null;
  const affiliation = params.get("affiliation");
  const [binding, setBinding] = useState<SmartTrustPlatformBinding>(() => loadSmartTrustBinding());
  const [platformBusy, setPlatformBusy] = useState(false);
  const [platformErr, setPlatformErr] = useState<string | null>(null);
  const [bindValidStatus, setBindValidStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const { address } = useAccount();
  const accountId = useMemo(() => {
    // Prefer connected wallet; fallback to last active wallet or logged-in user.
    const userRaw = typeof window !== "undefined" ? window.localStorage.getItem("user") : null;
    let userKey: string | null = null;
    try {
      if (userRaw) {
        const parsed = JSON.parse(userRaw);
        userKey = String(parsed?.email || parsed?.username || "").trim() || null;
      }
    } catch {
      userKey = null;
    }
    return (
      resolveAccountId({ walletAddress: address, userKey }) ||
      getLastActiveAccountId()
    );
  }, [address]);

  const [draft, setDraft] = useState<DraftModel>(() => {
    const loaded = storage.load();
    if (loaded) return loaded;
    const d = defaultDraft();
    if (preselect) d.entityType = preselect;

    if (preselect === "foundation") {
      d.foundationAffiliation =
        affiliation === "religious_organization" ? "religious_organization" : "standard";
    }

    return d;
  });

  // Sync draft assets with shared account assets so "assets anywhere" reflect the current account.
  useEffect(() => {
    if (!accountId) return;
    setLastActiveAccountId(accountId);

    const shared = loadAccountAssets(accountId);
    if (shared.length === 0 && draft.assets.length === 0) return;

    setDraft((prev) => {
      const sharedNow = loadAccountAssets(accountId);
      const fromDraft = prev.assets.map((a) => smartTrustAssetToAccountAsset(a));
      const merged = [...fromDraft, ...sharedNow.filter((sa) => !fromDraft.some((da) => da.id === sa.id))];
      // Persist merged registry as the single source of truth.
      for (const a of merged) upsertAccountAsset(accountId, a);
      return {
        ...prev,
        assets: loadAccountAssets(accountId).map((a) => accountAssetToSmartTrustAsset(a)),
        fundingChecklist: prev.fundingChecklist
          ? Object.fromEntries(Object.entries(prev.fundingChecklist).filter(([assetId]) => merged.some((a) => a.id === assetId)))
          : prev.fundingChecklist,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  // Live-refresh asset UI if assets change elsewhere (e.g., Trust Records).
  useEffect(() => {
    if (!accountId) return;
    return subscribeAccountAssets(accountId, () => {
      const shared = loadAccountAssets(accountId);
      setDraft((prev) => ({
        ...prev,
        assets: shared.map((a) => accountAssetToSmartTrustAsset(a)),
        fundingChecklist: prev.fundingChecklist
          ? Object.fromEntries(Object.entries(prev.fundingChecklist).filter(([assetId]) => shared.some((a) => a.id === assetId)))
          : prev.fundingChecklist,
      }));
    });
  }, [accountId]);

  useEffect(() => {
    if (preselect && draft.entityType !== preselect) {
      setDraft((prev) => ({ ...prev, entityType: preselect }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect]);

  useEffect(() => {
    storage.save(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const [step, setStep] = useState(0);

  const steps = useMemo(() => {
    const base = [
      { key: "setup", title: "Matter Setup" },
      { key: "parties", title: "Parties" },
      { key: "assets", title: "Assets / Funding" },
      { key: "terms", title: "Core Terms" },
      { key: "compliance", title: "Compliance" },
      { key: "review", title: "Review & Export" },
    ] as const;
    return base;
  }, [draft.entityType]);

  const progress = Math.round(((step + 1) / steps.length) * 100);

  const renderRef = useRef<HTMLDivElement | null>(null);
  const taxPanel = useMemo(() => getTaxHighlights(draft), [draft]);

  useEffect(() => {
    saveSmartTrustBinding(binding);
  }, [binding]);

  useEffect(() => {
    const refresh = () => setBinding(loadSmartTrustBinding());
    const onStorage = (e: StorageEvent) => {
      if (e.key === SMART_TRUST_BINDING_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(SMART_TRUST_BINDING_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(SMART_TRUST_BINDING_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!binding.trustId) {
        setBindValidStatus("idle");
        return;
      }
      setBindValidStatus("checking");
      try {
        const res = await fetch(`/api/trusts/${encodeURIComponent(binding.trustId)}/workspace/summary`);
        if (!res.ok) {
          if (!cancelled) {
            setBindValidStatus("invalid");
            setBinding((b) => ({ ...b, bindingValid: "invalid" }));
          }
          return;
        }
        const data = await res.json();
        const derivedClientId = String(data?.trust?.clientId || "") || null;
        if (!cancelled) {
          setBindValidStatus("valid");
          setBinding((b) => ({
            ...b,
            clientId: b.clientId || derivedClientId,
            bindingValid: "valid",
          }));
        }
      } catch {
        if (!cancelled) {
          setBindValidStatus("invalid");
          setBinding((b) => ({ ...b, bindingValid: "invalid" }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [binding.trustId]);

  async function createTrustWorkspace() {
    if (platformBusy) return;
    setPlatformErr(null);
    const clientId = binding.clientId;
    if (!clientId) {
      setPlatformErr("Client ID is required. Create or bind a Client first.");
      return;
    }
    if (!draft.governingState) {
      setPlatformErr("Select a governing state first (Matter Setup).");
      return;
    }
    const trust_type =
      draft.entityType === "revocable_living_trust" ? "revocable_living_trust" : "special_purpose_trust";
    const jurisdiction_state = String(draft.governingState || "NY");
    const name = (draft.matterName || "Trust Workspace").trim();
    if (!name) {
      setPlatformErr("Matter name is required.");
      return;
    }

    setPlatformBusy(true);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/trusts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trust_type, jurisdiction_state, name }),
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Failed (${res.status})`);
      const data = await res.json();
      const trustId = String(data?.trustId || "");
      if (!trustId) throw new Error("Trust creation succeeded but no trustId was returned.");

      // Persist the Smart Trust draft snapshot under this trustId before redirecting.
      try {
        await fetch(`/api/trusts/${encodeURIComponent(trustId)}/smart-trust-draft`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            draft,
            schemaVersion: 1,
            meta: {
              source: "smart-trust",
              draftId: draft.draftId,
              step,
              entityType: draft.entityType,
              governingState: draft.governingState,
              accountId: accountId ?? null,
            },
          }),
        }).catch(() => {});
      } catch {
        // best-effort
      }

      setBinding((b) => ({ ...b, trustId, bindingValid: "unknown", lastUpdatedAt: new Date().toISOString() }));
      // Hand off to the canonical Trust dashboard.
      window.location.href = `/trusts/${encodeURIComponent(trustId)}`;
    } catch (e: any) {
      setPlatformErr(String(e?.message || e || "Failed to create trust workspace"));
    } finally {
      setPlatformBusy(false);
    }
  }

  async function syncDraftToPlatform() {
    if (platformBusy) return;
    setPlatformErr(null);
    if (!binding.trustId) {
      setPlatformErr("Trust ID is required to sync. Create a Trust workspace first.");
      return;
    }
    if (bindValidStatus === "invalid") {
      setPlatformErr("Trust binding is invalid. Clear binding and re-bind.");
      return;
    }
    setPlatformBusy(true);
    try {
      const res = await fetch(`/api/trusts/${encodeURIComponent(binding.trustId)}/smart-trust-draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draft,
          schemaVersion: 1,
          meta: {
            source: "smart-trust",
            draftId: draft.draftId,
            step,
            entityType: draft.entityType,
            governingState: draft.governingState,
            accountId: accountId ?? null,
          },
        }),
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Sync failed (${res.status})`);
      setBinding((b) => ({ ...b, lastUpdatedAt: new Date().toISOString() }));
    } catch (e: any) {
      setPlatformErr(String(e?.message || e || "Failed to sync draft"));
    } finally {
      setPlatformBusy(false);
    }
  }

  async function exportRenderToPDF() {
    if (!renderRef.current) return;
    const node = renderRef.current;
    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "letter",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let y = 0;
    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
    } else {
      while (y < imgHeight) {
        pdf.addImage(imgData, "PNG", 0, -y, imgWidth, imgHeight);
        y += pageHeight;
        if (y < imgHeight) pdf.addPage();
      }
    }

    pdf.save(`${draft.matterName || "Draft"}-${draft.draftId}.pdf`);
  }

  function addParty(role: Party["role"]) {
    setDraft((prev) => ({
      ...prev,
      parties: [...prev.parties, { id: uuidv4(), role, name: "" }],
    }));
  }

  function updateParty(id: string, patch: Partial<Party>) {
    setDraft((prev) => ({
      ...prev,
      parties: prev.parties.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }

  function removeParty(id: string) {
    setDraft((prev) => ({
      ...prev,
      parties: prev.parties.filter((p) => p.id !== id),
    }));
  }

  function addAsset() {
    const next = {
      id: uuidv4(),
      category: "Bank/Brokerage" as const,
      description: "",
      approximateValue: "",
      titlingNotes: "",
    };
    setDraft((prev) => ({ ...prev, assets: [...prev.assets, next] }));
    if (accountId) upsertAccountAsset(accountId, smartTrustAssetToAccountAsset(next));
  }

  function updateAsset(id: string, patch: Partial<Asset>) {
    setDraft((prev) => {
      const assets = prev.assets.map((a) => (a.id === id ? { ...a, ...patch } : a));
      if (accountId) {
        const updated = assets.find((a) => a.id === id);
        if (updated) upsertAccountAsset(accountId, smartTrustAssetToAccountAsset(updated));
      }
      return { ...prev, assets };
    });
  }

  function removeAsset(id: string) {
    setDraft((prev) => ({
      ...prev,
      assets: prev.assets.filter((a) => a.id !== id),
      fundingChecklist: prev.fundingChecklist
        ? Object.fromEntries(Object.entries(prev.fundingChecklist).filter(([assetId]) => assetId !== id))
        : prev.fundingChecklist,
    }));
    if (accountId) deleteAccountAsset(accountId, id);
  }

  function resetDraft() {
    storage.clear();
    const d = defaultDraft();
    if (preselect) d.entityType = preselect;

    if (preselect === "foundation") {
      d.foundationAffiliation =
        affiliation === "religious_organization" ? "religious_organization" : "standard";
    }

    setDraft(d);
    setStep(0);
  }

  const canAdvance = useMemo(() => {
    if (!draft.entityType) return false;
    if (!draft.matterName.trim()) return false;
    if (!draft.governingState) return false;
    return true;
  }, [draft.entityType, draft.matterName, draft.governingState]);

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold">Wizard</div>
            {draft.entityType ? (
              <Badge variant="secondary">{formatEntityLabel(draft.entityType)}</Badge>
            ) : (
              <Badge variant="outline">Select an entity to begin</Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            Draft ID: <span className="font-mono">{draft.draftId}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate("/")}>Back to Home</Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Reset</Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>Reset this draft?</DialogTitle>
                <DialogDescription>This clears the saved local draft and starts a fresh matter.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => {}}>Cancel</Button>
                <Button onClick={() => resetDraft()}>Reset</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Platform Binding</CardTitle>
          <CardDescription>Use the canonical Client record, then create a Trust workspace from this draft.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {platformErr ? (
            <Alert variant="destructive">
              <AlertTitle>Platform action failed</AlertTitle>
              <AlertDescription>{platformErr}</AlertDescription>
            </Alert>
          ) : null}
          <div className="text-sm text-muted-foreground">
            Client ID: <span className="font-mono text-foreground">{binding.clientId || "—"}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Trust ID: <span className="font-mono text-foreground">{binding.trustId || "—"}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Last synced: <span className="font-mono text-foreground">{binding.lastUpdatedAt || "—"}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="rounded-2xl"
              onClick={createTrustWorkspace}
              disabled={platformBusy || !binding.clientId}
            >
              <Landmark className="mr-2 h-4 w-4" />
              {platformBusy ? "Creating…" : "Create Trust Workspace"}
            </Button>
            <Button
              className="rounded-2xl"
              variant="outline"
              onClick={syncDraftToPlatform}
              disabled={platformBusy || !binding.trustId || bindValidStatus === "invalid"}
            >
              <Save className="mr-2 h-4 w-4" />
              Sync Draft
            </Button>
            <Button className="rounded-2xl" variant="outline" asChild>
              <a href="/clients/new?origin=smart-trust&returnTo=/smart-trust/dashboard">Create Client Record</a>
            </Button>
            <Button
              className="rounded-2xl"
              variant="secondary"
              onClick={() => setBinding({ clientId: null, trustId: null, lastUpdatedAt: null })}
              disabled={platformBusy}
            >
              Clear Binding
            </Button>
          </div>
          {bindValidStatus === "invalid" ? (
            <div className="text-xs text-muted-foreground">Binding validation failed — clear and re-bind.</div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="pt-6">
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm font-medium">Progress</div>
              <div className="text-xs text-muted-foreground">
                Step {step + 1} of {steps.length}
              </div>
            </div>
            <Progress value={progress} />
            <div className="flex flex-wrap gap-2">
              {steps.map((s, idx) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStep(idx)}
                  className={cn(
                    "rounded-2xl border px-3 py-1 text-xs transition",
                    idx === step ? "bg-foreground text-background" : "hover:bg-muted"
                  )}
                >
                  {idx + 1}. {s.title}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          {steps[step].key === "setup" && <SetupStep draft={draft} setDraft={setDraft} />}
          {steps[step].key === "parties" && (
            <PartiesStep draft={draft} addParty={addParty} updateParty={updateParty} removeParty={removeParty} />
          )}
          {steps[step].key === "assets" && (
            <AssetsStep draft={draft} addAsset={addAsset} updateAsset={updateAsset} removeAsset={removeAsset} />
          )}
          {steps[step].key === "terms" && <TermsStep draft={draft} setDraft={setDraft} />}
          {steps[step].key === "compliance" && <ComplianceStep draft={draft} setDraft={setDraft} />}
          {steps[step].key === "review" && (
            <ReviewStep draft={draft} setDraft={setDraft} onExportPDF={exportRenderToPDF} renderRef={renderRef} />
          )}

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
              disabled={step === steps.length - 1 || (step === 0 && !canAdvance)}
            >
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <TaxHighlightsCard entityType={draft.entityType} governingState={draft.governingState} highlights={taxPanel} />
          <RenderTestQuickCard draft={draft} onExportPDF={exportRenderToPDF} />
        </div>
      </div>
    </div>
  );
}

function SetupStep({ draft, setDraft }: { draft: DraftModel; setDraft: React.Dispatch<React.SetStateAction<DraftModel>> }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Matter Setup</CardTitle>
        <CardDescription>Establish the entity type, governing law, and internal matter metadata.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Entity type</Label>
            <Select value={draft.entityType ?? ""} onValueChange={(v) => setDraft((p) => ({ ...p, entityType: v as EntityType }))}>
              <SelectTrigger className="rounded-2xl">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revocable_living_trust">Revocable Living Trust</SelectItem>
                <SelectItem value="foundation">Charitable Foundation</SelectItem>
                <SelectItem value="family_office">Family Office</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Governing law (state)</Label>
            <Select value={draft.governingState ?? ""} onValueChange={(v) => setDraft((p) => ({ ...p, governingState: v as GoverningState }))}>
              <SelectTrigger className="rounded-2xl">
                <SelectValue placeholder="Select a state..." />
              </SelectTrigger>
              <SelectContent>
                {GOVERNING_STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">This selection is used for issue-spotting prompts and drafting preferences.</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Matter name</Label>
            <Input className="rounded-2xl" value={draft.matterName} onChange={(e) => setDraft((p) => ({ ...p, matterName: e.target.value }))} placeholder="e.g., Smith Family Revocable Trust (2026)" />
          </div>
          <div className="grid gap-2">
            <Label>Internal file number</Label>
            <Input className="rounded-2xl" value={draft.internalFileNumber} onChange={(e) => setDraft((p) => ({ ...p, internalFileNumber: e.target.value }))} placeholder="e.g., 25-1147-TE" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label>Target signing date</Label>
            <Input type="date" className="rounded-2xl" value={draft.keyDates.targetSigningDate ?? ""} onChange={(e) => setDraft((p) => ({ ...p, keyDates: { ...p.keyDates, targetSigningDate: e.target.value } }))} />
          </div>
          <div className="grid gap-2">
            <Label>Target funding/implementation date</Label>
            <Input type="date" className="rounded-2xl" value={draft.keyDates.targetFundingDate ?? ""} onChange={(e) => setDraft((p) => ({ ...p, keyDates: { ...p.keyDates, targetFundingDate: e.target.value } }))} />
          </div>
        </div>

        <Separator />

        <div className="grid gap-2">
          <Label>Client objectives (plain language)</Label>
          <Textarea className="min-h-[120px] rounded-2xl" value={draft.objectives} onChange={(e) => setDraft((p) => ({ ...p, objectives: e.target.value }))} placeholder="Summarize what success looks like: probate avoidance, incapacity planning, philanthropy goals, governance, privacy, etc." />
        </div>
      </CardContent>
    </Card>
  );
}

function PartiesStep({
  draft,
  addParty,
  updateParty,
  removeParty,
}: {
  draft: DraftModel;
  addParty: (role: Party["role"]) => void;
  updateParty: (id: string, patch: Partial<Party>) => void;
  removeParty: (id: string) => void;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Parties</CardTitle>
        <CardDescription>
          Capture role-based information. For foundations and family offices, use Officers/Directors and Family Members as needed.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => addParty("Grantor/Settlor")}>Add Grantor/Settlor</Button>
          <Button variant="outline" size="sm" onClick={() => addParty("Trustee")}>Add Trustee</Button>
          <Button variant="outline" size="sm" onClick={() => addParty("Successor Trustee")}>Add Successor Trustee</Button>
          <Button variant="outline" size="sm" onClick={() => addParty("Beneficiary")}>Add Beneficiary</Button>
          <Button variant="outline" size="sm" onClick={() => addParty("Protector")}>Add Protector</Button>
          <Button variant="outline" size="sm" onClick={() => addParty("Officer/Director")}>Add Officer/Director</Button>
          <Button variant="outline" size="sm" onClick={() => addParty("Family Member")}>Add Family Member</Button>
        </div>

        <div className="grid gap-3">
          {draft.parties.map((p) => (
            <Card key={p.id} className="rounded-2xl shadow-sm">
              <CardContent className="grid gap-3 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{p.role}</Badge>
                    <div className="text-sm font-medium">{p.name?.trim() ? p.name : "Unnamed"}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeParty(p.id)}>Remove</Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Name</Label>
                    <Input className="rounded-2xl" value={p.name} onChange={(e) => updateParty(p.id, { name: e.target.value })} placeholder="Full legal name" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Role</Label>
                    <Select value={p.role} onValueChange={(v) => updateParty(p.id, { role: v as Party["role"] })}>
                      <SelectTrigger className="rounded-2xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Grantor/Settlor">Grantor/Settlor</SelectItem>
                        <SelectItem value="Trustee">Trustee</SelectItem>
                        <SelectItem value="Successor Trustee">Successor Trustee</SelectItem>
                        <SelectItem value="Beneficiary">Beneficiary</SelectItem>
                        <SelectItem value="Protector">Protector</SelectItem>
                        <SelectItem value="Officer/Director">Officer/Director</SelectItem>
                        <SelectItem value="Family Member">Family Member</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input className="rounded-2xl" value={p.email ?? ""} onChange={(e) => updateParty(p.id, { email: e.target.value })} placeholder="optional" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Phone</Label>
                    <Input className="rounded-2xl" value={p.phone ?? ""} onChange={(e) => updateParty(p.id, { phone: e.target.value })} placeholder="optional" />
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Attorney note: Consider capacity/fitness, fiduciary sophistication, and backup succession.
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AssetsStep({
  draft,
  addAsset,
  updateAsset,
  removeAsset,
}: {
  draft: DraftModel;
  addAsset: () => void;
  updateAsset: (id: string, patch: Partial<Asset>) => void;
  removeAsset: (id: string) => void;
}) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Assets / Funding</CardTitle>
        <CardDescription>
          Capture high-level asset inventory. For trusts, this becomes your funding checklist; for foundations and family offices, it becomes your capitalization and custody map.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={addAsset}>Add asset</Button>
          <div className="text-xs text-muted-foreground">{draft.assets.length} item(s)</div>
        </div>

        {draft.assets.length === 0 ? (
          <div className="rounded-2xl border p-6 text-sm text-muted-foreground">Add assets to build a working funding/capitalization list.</div>
        ) : (
          <div className="grid gap-3">
            {draft.assets.map((a) => (
              <Card key={a.id} className="rounded-2xl shadow-sm">
                <CardContent className="grid gap-3 pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{a.category}</Badge>
                      <div className="text-sm font-medium">{a.description?.trim() ? a.description : "Untitled asset"}</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeAsset(a.id)}>Remove</Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Category</Label>
                      <Select value={a.category} onValueChange={(v) => updateAsset(a.id, { category: v as Asset["category"] })}>
                        <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Real Estate">Real Estate</SelectItem>
                          <SelectItem value="Bank/Brokerage">Bank/Brokerage</SelectItem>
                          <SelectItem value="Business Interest">Business Interest</SelectItem>
                          <SelectItem value="Digital Assets">Digital Assets</SelectItem>
                          <SelectItem value="Life Insurance">Life Insurance</SelectItem>
                          <SelectItem value="Art/Collectibles">Art/Collectibles</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Approximate value</Label>
                      <Input className="rounded-2xl" value={a.approximateValue ?? ""} onChange={(e) => updateAsset(a.id, { approximateValue: e.target.value })} placeholder="$ or range" />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Description</Label>
                    <Input className="rounded-2xl" value={a.description} onChange={(e) => updateAsset(a.id, { description: e.target.value })} placeholder="Institution / address / entity name / wallet type" />
                  </div>

                  <div className="grid gap-2">
                    <Label>Titling / custody / transfer notes</Label>
                    <Textarea className="min-h-[90px] rounded-2xl" value={a.titlingNotes ?? ""} onChange={(e) => updateAsset(a.id, { titlingNotes: e.target.value })} placeholder="Current title, proposed title, transfer steps, beneficiaries, authorized signers, custody contact, etc." />
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Attorney note: Confirm whether retitling triggers lender consent, transfer taxes, or operational disruption.
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TermsStep({ draft, setDraft }: { draft: DraftModel; setDraft: React.Dispatch<React.SetStateAction<DraftModel>> }) {
  const type = draft.entityType;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Core Terms</CardTitle>
        <CardDescription>
          Entity-type specific provisions. Keep this client-readable; detailed clause work can be added via a clause library page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!type ? (
          <div className="rounded-2xl border p-6 text-sm text-muted-foreground">Select an entity type in Matter Setup.</div>
        ) : (
          <Tabs defaultValue={type} value={type}>
            <TabsList className="grid w-full grid-cols-3 rounded-2xl">
              <TabsTrigger value="revocable_living_trust">Revocable Trust</TabsTrigger>
              <TabsTrigger value="foundation">Foundation</TabsTrigger>
              <TabsTrigger value="family_office">Family Office</TabsTrigger>
            </TabsList>

            <TabsContent value="revocable_living_trust" className="mt-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Trust name</Label>
                  <Input className="rounded-2xl" value={draft.trustName ?? ""} onChange={(e) => setDraft((p) => ({ ...p, trustName: e.target.value }))} placeholder="e.g., The John Q. Smith Revocable Trust" />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Revocability</Label>
                    <Select value={draft.revocable ? "revocable" : "irrevocable"} onValueChange={(v) => setDraft((p) => ({ ...p, revocable: v === "revocable" }))}>
                      <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="revocable">Revocable</SelectItem>
                        <SelectItem value="irrevocable">Irrevocable (rare for this pathway)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Incapacity standard</Label>
                    <Select value={draft.incapacityStandard ?? "Two physicians"} onValueChange={(v) => setDraft((p) => ({ ...p, incapacityStandard: v as DraftModel["incapacityStandard"] }))}>
                      <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Two physicians">Two physicians</SelectItem>
                        <SelectItem value="Attending physician">Attending physician</SelectItem>
                        <SelectItem value="Court determination">Court determination</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Distribution style (at death)</Label>
                    <Select value={draft.distributionStyle ?? "HEMS"} onValueChange={(v) => setDraft((p) => ({ ...p, distributionStyle: v as DraftModel["distributionStyle"] }))}>
                      <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Outright">Outright</SelectItem>
                        <SelectItem value="Staggered">Staggered</SelectItem>
                        <SelectItem value="Discretionary">Discretionary</SelectItem>
                        <SelectItem value="HEMS">HEMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3">
                    <Label>Related documents</Label>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={!!draft.pourOverWillNeeded} onCheckedChange={(v) => setDraft((p) => ({ ...p, pourOverWillNeeded: Boolean(v) }))} />
                      <div className="text-sm">Pour-over will needed</div>
                    </div>
                    <div className="text-xs text-muted-foreground">Add DPOA / HCP / HIPAA in a later module if desired.</div>
                  </div>
                </div>

                <Separator />
                <div className="grid gap-2">
                  <Label>Attorney notes (trust terms)</Label>
                  <Textarea className="min-h-[120px] rounded-2xl" value={draft.attorneyNotes} onChange={(e) => setDraft((p) => ({ ...p, attorneyNotes: e.target.value }))} placeholder="Administrative powers, tax allocation, trustee succession, fiduciary accounting, spendthrift, trust protector scope, etc." />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="foundation" className="mt-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Affiliation</Label>
                  <Select
                    value={draft.foundationAffiliation ?? "standard"}
                    onValueChange={(v) =>
                      setDraft((p) => ({
                        ...p,
                        foundationAffiliation: v as DraftModel["foundationAffiliation"],
                      }))
                    }
                  >
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard charitable organization</SelectItem>
                      <SelectItem value="religious_organization">Religious organization</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Foundation type</Label>
                  <Select value={draft.foundationType ?? "Public Charity (501(c)(3))"} onValueChange={(v) => setDraft((p) => ({ ...p, foundationType: v as DraftModel["foundationType"] }))}>
                    <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Public Charity (501(c)(3))">Public Charity (501(c)(3))</SelectItem>
                      <SelectItem value="Private Foundation (501(c)(3))">Private Foundation (501(c)(3))</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Mission statement</Label>
                  <Textarea className="min-h-[100px] rounded-2xl" value={draft.missionStatement ?? ""} onChange={(e) => setDraft((p) => ({ ...p, missionStatement: e.target.value }))} placeholder="Charitable purpose, target beneficiaries, geographic scope, program vs grantmaking." />
                </div>

                <div className="grid gap-2">
                  <Label>Governance notes</Label>
                  <Textarea className="min-h-[120px] rounded-2xl" value={draft.governanceNotes ?? ""} onChange={(e) => setDraft((p) => ({ ...p, governanceNotes: e.target.value }))} placeholder="Board composition, committees, conflict policy, grantmaking policy, compensation, related-party transactions, investment policy." />
                </div>

                <Separator />
                <div className="grid gap-2">
                  <Label>Attorney notes (formation + compliance)</Label>
                  <Textarea className="min-h-[120px] rounded-2xl" value={draft.attorneyNotes} onChange={(e) => setDraft((p) => ({ ...p, attorneyNotes: e.target.value }))} placeholder="Articles, bylaws, state charity registration, 1023/1023-EZ pathway, donor restrictions, fiscal sponsorship, etc." />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="family_office" className="mt-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Family office structure</Label>
                  <Select value={draft.familyOfficeStructure ?? "Single Family Office"} onValueChange={(v) => setDraft((p) => ({ ...p, familyOfficeStructure: v as DraftModel["familyOfficeStructure"] }))}>
                    <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single Family Office">Single Family Office</SelectItem>
                      <SelectItem value="Multi-Family Office">Multi-Family Office</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Services scope</Label>
                  <div className="grid gap-2 rounded-2xl border p-4">
                    {[
                      "Investment oversight",
                      "Manager selection",
                      "Tax coordination",
                      "Bill pay / cash management",
                      "Bookkeeping / reporting",
                      "Philanthropy administration",
                      "Risk management / insurance",
                      "Family governance",
                      "Concierge / lifestyle",
                    ].map((s) => (
                      <label key={s} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={(draft.servicesScope ?? []).includes(s)}
                          onCheckedChange={(v) => {
                            setDraft((p) => {
                              const current = new Set(p.servicesScope ?? []);
                              if (v) current.add(s);
                              else current.delete(s);
                              return { ...p, servicesScope: Array.from(current) };
                            });
                          }}
                        />
                        {s}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Investment adviser / regulatory considerations</Label>
                  <Textarea className="min-h-[120px] rounded-2xl" value={draft.investmentAdviserConsiderations ?? ""} onChange={(e) => setDraft((p) => ({ ...p, investmentAdviserConsiderations: e.target.value }))} placeholder="Describe whether advice is provided, to whom, compensation, and whether you aim to satisfy the SEC family office rule exclusion." />
                </div>

                <Separator />
                <div className="grid gap-2">
                  <Label>Attorney notes (governance + ops)</Label>
                  <Textarea className="min-h-[120px] rounded-2xl" value={draft.attorneyNotes} onChange={(e) => setDraft((p) => ({ ...p, attorneyNotes: e.target.value }))} placeholder="Operating agreement, investment committee charter, conflicts, data security, vendor contracts, signatory matrix, reporting cadence, policies binder." />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function ComplianceStep({ draft, setDraft }: { draft: DraftModel; setDraft: React.Dispatch<React.SetStateAction<DraftModel>> }) {
  const c = draft.compliance;
  const score = [c.kycIntake, c.conflictCheck, c.engagementLetter, c.dataRoomCreated, c.taxCounselLooped].filter(Boolean).length;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Compliance</CardTitle>
        <CardDescription>Internal control checkpoints. Customize to match firm policy.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center justify-between">
          <div className="text-sm">Completion</div>
          <Badge variant={score >= 4 ? "default" : "secondary"}>{score}/5</Badge>
        </div>

        <div className="grid gap-3 rounded-2xl border p-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={c.conflictCheck} onCheckedChange={(v) => setDraft((p) => ({ ...p, compliance: { ...p.compliance, conflictCheck: Boolean(v) } }))} />
            Conflict check completed
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={c.engagementLetter} onCheckedChange={(v) => setDraft((p) => ({ ...p, compliance: { ...p.compliance, engagementLetter: Boolean(v) } }))} />
            Engagement letter executed
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={c.kycIntake} onCheckedChange={(v) => setDraft((p) => ({ ...p, compliance: { ...p.compliance, kycIntake: Boolean(v) } }))} />
            Client intake / KYC completed
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={c.dataRoomCreated} onCheckedChange={(v) => setDraft((p) => ({ ...p, compliance: { ...p.compliance, dataRoomCreated: Boolean(v) } }))} />
            Data room created and access controlled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={c.taxCounselLooped} onCheckedChange={(v) => setDraft((p) => ({ ...p, compliance: { ...p.compliance, taxCounselLooped: Boolean(v) } }))} />
            Tax counsel looped in (as needed)
          </label>
        </div>

        <Separator />
        <div className="grid gap-2">
          <Label>Attorney operational notes</Label>
          <Textarea className="min-h-[120px] rounded-2xl" value={draft.attorneyNotes} onChange={(e) => setDraft((p) => ({ ...p, attorneyNotes: e.target.value }))} placeholder="Client communications, open items, delegation, deadlines, special approvals." />
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewStep({
  draft,
  setDraft,
  onExportPDF,
  renderRef,
}: {
  draft: DraftModel;
  setDraft: React.Dispatch<React.SetStateAction<DraftModel>>;
  onExportPDF: () => Promise<void>;
  renderRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const draftingPadRef = useRef<HTMLTextAreaElement | null>(null);
  const [reviewMode, setReviewMode] = useState<boolean>(() => loadReviewMode());
  const [sectionFilter, setSectionFilter] = useState<SectionId | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ALLOWED" | "WARNING" | "DISCOURAGED">("ALL");

  useEffect(() => {
    const refresh = () => setReviewMode(loadReviewMode());
    const onStorage = (e: StorageEvent) => {
      if (e.key === REVIEW_MODE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(REVIEW_MODE_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(REVIEW_MODE_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    // Seed canonical headings to enable deterministic section indexing.
    setDraft((p) => {
      const ensured = ensureCanonicalSectionsText(p.clauseDraftPad ?? "");
      if (ensured === (p.clauseDraftPad ?? "")) return p;
      return { ...p, clauseDraftPad: ensured };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Keep deterministic section index in sync with pad changes.
    const text = draft.clauseDraftPad ?? "";
    const nextIndex = buildSectionIndex(text);
    setDraft((p) => {
      const prev = p.sectionIndex ?? [];
      if (JSON.stringify(prev) === JSON.stringify(nextIndex)) return p;
      return { ...p, sectionIndex: nextIndex };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.clauseDraftPad]);

  const clauseById = useMemo(() => new Map(SMART_TRUST_CLAUSES.map((c) => [c.id, c] as const)), []);
  const reviewRows = useMemo(() => deriveReviewRows(draft, clauseById), [draft, clauseById]);

  const filteredRows = useMemo(() => {
    return reviewRows
      .filter((r) => (sectionFilter === "ALL" ? true : r.jumpAnchor.sectionId === sectionFilter))
      .filter((r) => (statusFilter === "ALL" ? true : r.status === statusFilter))
      .sort((a, b) => (a.block.insertedAt < b.block.insertedAt ? 1 : -1)); // most recent first
  }, [reviewRows, sectionFilter, statusFilter]);

  function statusBadgeVariant(s: "ALLOWED" | "WARNING" | "DISCOURAGED"): "default" | "secondary" | "destructive" {
    if (s === "ALLOWED") return "default";
    if (s === "WARNING") return "secondary";
    return "destructive";
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Review & Export</CardTitle>
        <CardDescription>
          Use the Render Test as the attorney-facing or client-facing draft scaffold. Save locally or export to PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Status: {draft.status.replaceAll("_", " ")}</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDraft((p) => ({ ...p, status: p.status === "ready_for_review" ? "in_progress" : "ready_for_review" }))}
            >
              Toggle Ready for Review
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Save className="mr-2 h-4 w-4" />
              Save Draft
            </Button>
            <Button size="sm" onClick={onExportPDF}>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Save draft</DialogTitle>
              <DialogDescription>
                This demo persists the draft in local storage. You can extend this to your backend (Matter ID, client ID, audit log).
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
              <Button onClick={() => setOpen(false)}>Saved</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Separator />

        <div className="grid gap-3">
          <div className="text-sm font-medium">Render Test (authoritative drafting pad + review)</div>
          <div ref={renderRef} className="rounded-2xl border bg-background p-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              {/* Left: Drafting Pad (authoritative text) */}
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold">Drafting Pad</div>
                  <div className="text-xs text-muted-foreground">
                    Inserted clauses: <span className="font-medium text-foreground">{reviewRows.length}</span>
                  </div>
                </div>
                <Textarea
                  ref={draftingPadRef}
                  className="min-h-[520px] rounded-2xl font-mono text-xs"
                  value={reviewMode ? (draft.clauseDraftPad ?? "") : stripClauseBlockMarkers(draft.clauseDraftPad ?? "")}
                  readOnly={!reviewMode}
                  onChange={(e) => {
                    if (!reviewMode) return;
                    setDraft((p) => ({ ...p, clauseDraftPad: e.target.value }));
                  }}
                  placeholder="Drafting pad (plain text)."
                />
                {!reviewMode ? (
                  <div className="rounded-2xl border p-3 text-xs text-muted-foreground">
                    Clean view (markers hidden). Switch <span className="font-medium text-foreground">Review mode</span> ON to edit raw text (includes markers).
                  </div>
                ) : null}
                <div className="text-xs text-muted-foreground">
                  Governing law: <span className="font-medium text-foreground">{draft.governingState ?? "(none)"}</span> • Jurisdiction:{" "}
                  <span className="font-medium text-foreground">{draft.jurisdiction ?? "(unset)"}</span>
                </div>
              </div>

              {/* Right: Review Sidebar */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Review</div>
                    <div className="text-xs text-muted-foreground">
                      Showing <span className="font-medium text-foreground">{filteredRows.length}</span>
                    </div>
                  </div>
                  {reviewMode ? <Badge variant="secondary">Review mode</Badge> : null}
                </div>

                <div className="grid gap-2 rounded-2xl border p-3">
                  <div className="grid gap-2">
                    <Label className="text-xs">Section</Label>
                    <Select value={sectionFilter} onValueChange={(v) => setSectionFilter(v as any)}>
                      <SelectTrigger className="h-8 rounded-2xl text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All sections</SelectItem>
                        {SMART_TRUST_SECTIONS.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs">Jurisdiction status</Label>
                    <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                      <SelectTrigger className="h-8 rounded-2xl text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        <SelectItem value="ALLOWED">Allowed</SelectItem>
                        <SelectItem value="WARNING">Warning</SelectItem>
                        <SelectItem value="DISCOURAGED">Discouraged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="max-h-[520px] overflow-auto rounded-2xl border p-3">
                  {filteredRows.length === 0 ? (
                    <div className="text-sm text-muted-foreground">(no inserted clauses match filters)</div>
                  ) : (
                    <div className="grid gap-3">
                      {filteredRows.map((r) => {
                        const b = r.block;
                        const canJump = r.jumpAnchor.type !== "none" && typeof r.jumpAnchor.offset === "number";
                        const isDiscouraged = r.status === "DISCOURAGED";
                        const insertModeLabel = b.insertMode === "tracked" ? "Tracked" : "Plain";
                        const sectionLabel = r.sectionTitle;
                        const ts = new Date(b.insertedAt).toLocaleString();

                        return (
                          <div key={b.id} className={cn("rounded-2xl border p-3", isDiscouraged ? "border-destructive/50" : "")}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-sm font-semibold">{r.clauseTitle}</div>
                                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                  <Badge variant="outline">{sectionLabel}</Badge>
                                  <Badge variant={statusBadgeVariant(r.status)}>{r.status}</Badge>
                                  <Badge variant="secondary">{insertModeLabel}</Badge>
                                  {r.hasOverride ? <Badge variant="destructive">Override</Badge> : null}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!canJump}
                                onClick={() => jumpToAnchor(r.jumpAnchor, draftingPadRef as any, draft.clauseDraftPad ?? "", b.id)}
                              >
                                Jump
                              </Button>
                            </div>

                            <div className="mt-2 text-[11px] text-muted-foreground">{ts}</div>

                            {isDiscouraged ? (
                              <div className="mt-2 text-xs text-muted-foreground">
                                Override justification:{" "}
                                <span className="font-medium text-foreground">
                                  {b.jurisdictionReview?.overrideJustification?.trim()
                                    ? b.jurisdictionReview.overrideJustification
                                    : "No justification provided"}
                                </span>
                              </div>
                            ) : null}

                            {reviewMode ? (
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    const summary = {
                                      id: b.id,
                                      clauseId: b.clauseId,
                                      clauseVersion: b.clauseVersion,
                                      insertedAt: b.insertedAt,
                                      insertMode: b.insertMode,
                                      insertStrategy: b.insertStrategy,
                                      jurisdictionReview: b.jurisdictionReview,
                                      range: b.range,
                                    };
                                    navigator.clipboard?.writeText(JSON.stringify(summary, null, 2));
                                  }}
                                >
                                  Copy audit
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">Export tip: keep this panel free of interactive UI. The PDF export captures this element.</div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaxHighlightsCard({
  entityType,
  governingState,
  highlights,
}: {
  entityType: EntityType | null;
  governingState: GoverningState | null;
  highlights: { title: string; bullets: string[]; caution?: string }[];
}) {
  return (
    <Card className="sticky top-[86px] rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Tax & Regulatory Highlights</CardTitle>
        <CardDescription>For the Grantor/Creator and counsel; prompts for issue-spotting.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{entityType ? formatEntityLabel(entityType) : "No entity selected"}</Badge>
          {governingState ? <Badge variant="outline">Governing: {governingState}</Badge> : null}
        </div>

        {highlights.length === 0 ? (
          <div className="text-sm text-muted-foreground">Select an entity type to view tailored highlights.</div>
        ) : (
          <div className="grid gap-4">
            {highlights.map((h) => (
              <div key={h.title} className="rounded-2xl border p-4">
                <div className="text-sm font-semibold">{h.title}</div>
                <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                  {h.bullets.map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
                {h.caution ? (
                  <div className="mt-3 text-xs">
                    <span className="font-semibold">Caution:</span>{" "}
                    <span className="text-muted-foreground">{h.caution}</span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-2xl border p-4 text-xs text-muted-foreground">
          Firm note: Replace these prompts with your preferred jurisdictional citations and checklists.
        </div>
      </CardContent>
    </Card>
  );
}

function RenderTestQuickCard({ draft, onExportPDF }: { draft: DraftModel; onExportPDF: () => Promise<void> }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Render Test (Quick)</CardTitle>
        <CardDescription>Snapshot of the matter model for attorney review.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="rounded-2xl border p-3">
          <div className="text-xs text-muted-foreground">Matter</div>
          <div className="text-sm font-medium">{draft.matterName || "(unnamed)"}</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {draft.entityType ? <Badge variant="secondary">{formatEntityLabel(draft.entityType)}</Badge> : <Badge variant="outline">No entity</Badge>}
            {draft.governingState ? <Badge variant="outline">{draft.governingState}</Badge> : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-2xl border p-3">
            <div className="text-muted-foreground">Parties</div>
            <div className="font-semibold">{draft.parties.length}</div>
          </div>
          <div className="rounded-2xl border p-3">
            <div className="text-muted-foreground">Assets</div>
            <div className="font-semibold">{draft.assets.length}</div>
          </div>
          <div className="rounded-2xl border p-3">
            <div className="text-muted-foreground">Status</div>
            <div className="font-semibold">{draft.status.replaceAll("_", " ")}</div>
          </div>
        </div>

        <Button onClick={onExportPDF} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
      </CardContent>
    </Card>
  );
}

function RenderTestDocument({ draft }: { draft: DraftModel }) {
  const entity = formatEntityLabel(draft.entityType);
  const grantor = draft.parties.find((p) => p.role === "Grantor/Settlor")?.name || "(not specified)";
  const trustee = draft.parties.find((p) => p.role === "Trustee")?.name || "(not specified)";
  const reviewMode = useMemo(() => loadReviewMode(), []);
  const clauseById = useMemo(() => new Map(SMART_TRUST_CLAUSES.map((c) => [c.id, c] as const)), []);
  const blocks = (draft.insertedClauseBlocks ?? []) as InsertedClauseBlock[];
  const blocksBySection = useMemo(() => {
    const map = new Map<SectionId, InsertedClauseBlock[]>();
    for (const s of SMART_TRUST_SECTIONS) map.set(s.id, []);
    for (const b of blocks) {
      const sid =
        b.insertStrategy?.type === "after_section"
          ? (b.insertStrategy.sectionId as SectionId)
          : ("misc" as SectionId);
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid)!.push(b);
    }
    return map;
  }, [blocks]);

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-lg font-semibold">{draft.matterName || "Draft Matter"}</div>
          <div className="text-sm text-muted-foreground">
            Entity: {entity || "(select entity)"} • Governing law: {draft.governingState || "(select state)"}
          </div>
          <div className="text-xs text-muted-foreground">Internal file: {draft.internalFileNumber || "(none)"}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Draft ID</div>
          <div className="font-mono text-xs">{draft.draftId}</div>
          <div className="mt-2 inline-flex items-center gap-2 rounded-2xl border px-3 py-1 text-xs">
            <span className="text-muted-foreground">Status</span>
            <span className="font-semibold">{draft.status.replaceAll("_", " ")}</span>
          </div>
        </div>
      </div>

      <Separator />

      <div className="grid gap-3">
        <div className="text-sm font-semibold">Client objectives</div>
        <div className="whitespace-pre-wrap rounded-2xl border p-4 text-sm text-muted-foreground">
          {draft.objectives || "(no objectives captured yet)"}
        </div>
      </div>

      <div className="grid gap-3">
        <div className="text-sm font-semibold">Drafting Pad (Authoritative Text)</div>
        <div className="whitespace-pre-wrap rounded-2xl border p-4 text-sm text-muted-foreground">
          {stripClauseBlockMarkers(draft.clauseDraftPad ?? "").trim()
            ? stripClauseBlockMarkers(draft.clauseDraftPad ?? "")
            : "(empty)"}
        </div>
      </div>

      <div className="grid gap-3">
        <div className="text-sm font-semibold">Selected Clauses (Tracked)</div>
        {reviewMode ? (
          (draft.selectedClauses ?? []).length === 0 ? (
            <div className="rounded-2xl border p-4 text-sm text-muted-foreground">(none selected)</div>
          ) : (
            <div className="rounded-2xl border p-4">
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {(draft.selectedClauses ?? []).map((id) => {
                  const c = clauseById.get(id);
                  return (
                    <li key={id}>
                      <span className="font-medium text-foreground">{c?.title ?? id}</span>{" "}
                      <span className="text-muted-foreground">({id})</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )
        ) : (
          <div className="rounded-2xl border p-4 text-sm text-muted-foreground">
            (hidden — enable Review mode to show clause metadata)
          </div>
        )}
      </div>

      <div className="grid gap-3">
        <div className="text-sm font-semibold">Clause Blocks by Section</div>
        <div className="grid gap-4">
          {SMART_TRUST_SECTIONS.map((s) => {
            const list = blocksBySection.get(s.id) ?? [];
            return (
              <div key={s.id} className="rounded-2xl border p-4">
                <div className="text-sm font-semibold">{s.title}</div>
                {list.length === 0 ? (
                  <div className="mt-2 text-sm text-muted-foreground">(no inserted clause blocks)</div>
                ) : (
                  <div className="mt-3 grid gap-3">
                    {list.map((b, idx) => {
                      const c = clauseById.get(b.clauseId);
                      const jurLabel = b.jurisdictionReview?.draftJurisdiction ?? "(n/a)";
                      const status = b.jurisdictionReview?.status ?? "WARNING";
                      return (
                        <div key={`${b.insertedAt}-${idx}`} className="rounded-2xl border p-3">
                          {reviewMode ? (
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="text-xs text-muted-foreground">
                                  Clause: <span className="font-mono">{b.clauseId}</span>
                                  {b.clauseVersion ? ` • ${b.clauseVersion}` : c?.version ? ` • ${c.version}` : ""} • Jurisdiction: {jurLabel} • {status}
                                </div>
                                {status === "WARNING" || status === "DISCOURAGED" ? (
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    Acknowledged:{" "}
                                    <span className="font-medium text-foreground">
                                      {b.jurisdictionReview?.overrideApplied ? "Yes" : status === "WARNING" ? "Recorded" : "No"}
                                    </span>
                                    {b.jurisdictionReview?.overrideJustification ? ` • ${b.jurisdictionReview.overrideJustification}` : ""}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                          <div className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{b.renderedText}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border p-4">
          <div className="text-sm font-semibold">Key parties</div>
          <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
            <div><span className="font-medium text-foreground">Grantor/Creator:</span> {grantor}</div>
            <div><span className="font-medium text-foreground">Trustee / Manager:</span> {trustee}</div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">Full party roster appears below.</div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm font-semibold">Timeline</div>
          <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
            <div><span className="font-medium text-foreground">Target signing:</span> {draft.keyDates.targetSigningDate || "(not set)"}</div>
            <div><span className="font-medium text-foreground">Target implementation:</span> {draft.keyDates.targetFundingDate || "(not set)"}</div>
          </div>
        </div>
      </div>

      <div className="pt-2 text-xs text-muted-foreground">
        Prepared via Trust & Estate Planning Workspace • For internal drafting workflow
      </div>
    </div>
  );
}

function getTaxHighlights(draft: DraftModel): { title: string; bullets: string[]; caution?: string }[] {
  const t = draft.entityType;
  if (!t) return [];

  if (t === "revocable_living_trust") {
    return [
      {
        title: "Grantor trust / income tax posture",
        bullets: [
          "Revocable living trusts are typically treated as grantor trusts during the grantor’s lifetime (income tax reported on the grantor’s return).",
          "Confirm whether any provisions could trigger non-grantor treatment (rare in standard revocable forms, but issue-spot when adding special powers).",
        ],
        caution: "Treat grantor-trust classification and reporting as fact-specific; coordinate with CPA for client’s filing posture.",
      },
      {
        title: "Transfer tax + basis considerations",
        bullets: [
          "Revocable trusts generally do not remove assets from the taxable estate; focus is probate avoidance and administration efficiency.",
          "Coordinate funding/titling and beneficiary designations to avoid unintended gift characterization or inconsistent dispositive plan.",
          "At death, basis step-up rules are often central to planning; confirm asset-by-asset and entity-by-entity posture.",
        ],
      },
      {
        title: "State-level items",
        bullets: [
          `Governing-law state: ${draft.governingState ?? "(not selected)"}. Confirm local execution formalities, notarization/witnessing, and trustee powers defaults.`,
          "If real property is in multiple states, coordinate ancillary issues and local deed/transfer requirements.",
        ],
      },
    ];
  }

  if (t === "foundation") {
    return [
      {
        title: "Entity classification (public charity vs private foundation)",
        bullets: [
          "Determine whether the organization will qualify as a public charity or be treated as a private foundation—this impacts excise taxes, reporting, and governance.",
          "Document donor restrictions, related-party transactions policies, and grantmaking controls early.",
        ],
      },
      {
        title: "Private foundation regime (if applicable)",
        bullets: [
          "If classified as a private foundation, issue-spot Chapter 42 excise tax traps: self-dealing, minimum distributions, excess business holdings, jeopardizing investments, taxable expenditures.",
          "Align investment policy and grantmaking policy to minimize compliance risk.",
        ],
        caution: "Chapter 42 compliance is highly technical; build policies and an annual compliance calendar.",
      },
      {
        title: "Reporting + state registrations",
        bullets: [
          "Federal reporting typically includes Form 990 or 990-PF depending on classification.",
          "Many states require charitable solicitation registration and annual renewals—confirm for governing state and states of fundraising activity.",
        ],
      },
    ];
  }

  return [
    {
      title: "Regulatory posture (family office rule)",
      bullets: [
        "If providing investment advice, analyze whether you can rely on the SEC ‘family office’ exclusion based on ownership, clients served, and holding-out.",
        "Define the services scope carefully; consider whether any services drift into adviser/broker-dealer territory.",
      ],
      caution: "The family office exclusion is rule-specific. Counsel should document assumptions and structure accordingly.",
    },
    {
      title: "Tax and operational architecture",
      bullets: [
        "Entity selection and intercompany agreements affect deductibility, allocations, and governance. Coordinate with tax counsel.",
        "Build controls for expenses, related-party transactions, and reporting cadence; align with privacy and cybersecurity controls.",
      ],
    },
    {
      title: "State-level + employment considerations",
      bullets: [
        `Governing-law state: ${draft.governingState ?? "(not selected)"}. Consider employment law, withholding, and nexus if staff operate across states.`,
        "If using multiple entities (LLCs/LPs), confirm registered agent, annual reports, and signatory authority matrix.",
      ],
    },
  ];
}

export function SmartTrustApp(props: { basename?: string } = {}) {
  const basename = props.basename ?? "/smart-trust";
  return (
    <Router basename={basename}>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/wizard" element={<WizardPage />} />
          <Route path="/clauses" element={<ClauseLibraryPage />} />
          <Route path="/memo" element={<SmartTrustAttorneyMemoPage />} />
          <Route path="/funding" element={<FundingChecklistPage />} />
          <Route path="/references" element={<ReferencesPage />} />
        </Routes>
      </AppShell>
    </Router>
  );
}


