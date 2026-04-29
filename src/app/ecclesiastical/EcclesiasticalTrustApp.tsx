"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { v4 as uuidv4 } from "uuid";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UI_COPY } from "@/config/uiCopy";

// icons
import {
  AlertTriangle,
  BookOpen,
  Building2,
  Church,
  Landmark,
  Home,
  FileText,
  ShieldCheck,
  Download,
  Printer,
  Scale,
  ScrollText,
  Plus,
  Save,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/**
 * Ecclesiastical Trust (Compliance‑First)
 * - A neutral workflow for attorneys representing religious or faith‑based clients.
 * - Does not claim immunity/supremacy over civil law.
 * - Uses React Router inside Next.js App Router (client-only), like /smart-trust.
 */

type GoverningState =
  | "AL" | "AK" | "AZ" | "AR" | "CA" | "CO" | "CT" | "DE" | "FL" | "GA" | "HI" | "ID" | "IL" | "IN" | "IA" | "KS" | "KY" | "LA"
  | "ME" | "MD" | "MA" | "MI" | "MN" | "MS" | "MO" | "MT" | "NE" | "NV" | "NH" | "NJ" | "NM" | "NY" | "NC" | "ND" | "OH" | "OK"
  | "OR" | "PA" | "RI" | "SC" | "SD" | "TN" | "TX" | "UT" | "VT" | "VA" | "WA" | "WV" | "WI" | "WY";

const GOVERNING_STATES: { value: GoverningState; label: string }[] = [
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" }, { value: "AZ", label: "Arizona" }, { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" }, { value: "CO", label: "Colorado" }, { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" }, { value: "GA", label: "Georgia" }, { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" }, { value: "IA", label: "Iowa" }, { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" }, { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" }, { value: "MI", label: "Michigan" }, { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" }, { value: "NE", label: "Nebraska" }, { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" }, { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" }, { value: "ND", label: "North Dakota" }, { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" }, { value: "RI", label: "Rhode Island" }, { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" }, { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" }, { value: "VA", label: "Virginia" }, { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" },
];

type DraftStatus = "new" | "in_progress" | "ready_for_review";
type TrustType = "revocable" | "irrevocable";
type FormationMethod = "trust_agreement" | "declaration";
type TaxPosture = "grantor" | "non_grantor" | "unsure";
type EinStrategy = "use_corporate_trustee_ein" | "apply_for_trust_ein" | "unsure";
type CustodyModel = "corporate_trustee" | "third_party_custodian" | "self_custody" | "unsure";
type DistributionStandard = "discretionary" | "ascertainable" | "unsure";

type PartyRole =
  | "Settlor/Grantor"
  | "Trustee"
  | "Corporate Trustee"
  | "Successor Trustee"
  | "Beneficiary"
  | "Protector / Advisory Council";

type Party = {
  id: string;
  role: PartyRole;
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

type CustodianPolicyRow = {
  id: string;
  institutionName: string;
  accountType: string;
  trusteeOnlyAllowed: "yes" | "no" | "unknown";
  trustEinRequired: "yes" | "no" | "conditional" | "unknown";
  notes: string;
  verifier?: string;
  lastVerified?: string;
  evidence?: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number;
    addedAt: string;
    note?: string;
  }>;
};

type ValidatorInputs = {
  trusteeIndependenceClaimed: boolean;
  mandatoryDistributions: boolean;
  retainedControlOrVeto: boolean;
  separateTrustAccounting: boolean;
};

type DraftModel = {
  draftId: string;
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

  governingState: GoverningState | null;
  trustType: TrustType;
  formationMethod: FormationMethod;

  // Religious character & purpose
  religiousPurpose: string;
  affiliation: string;
  governingCanonsNotes: string;

  // Parties and assets
  parties: Party[];
  assets: Asset[];

  // Tax posture / EIN gate
  taxPosture: TaxPosture;
  einStrategy: EinStrategy;
  custodyModel: CustodyModel;

  distributionStandard: DistributionStandard;
  minutesAndResolutionsRef: string;

  // Clauses + custodian policy + validator signals (for downstream memo/checks)
  selectedClauseIds: string[];
  customClauses: string;
  custodianPolicies: CustodianPolicyRow[];
  validatorInputs: ValidatorInputs;

  compliance: {
    conflictCheck: boolean;
    engagementLetter: boolean;
    kycIntake: boolean;
    dataRoomCreated: boolean;
    bankingKycReady: boolean;
    charitableRegistrationReviewed: boolean;
    annualReviewScheduled: boolean;
  };

  attorneyNotes: string;
};

const defaultDraft = (): DraftModel => ({
  draftId: uuidv4(),
  status: "new",
  matterName: "",
  internalFileNumber: "",
  matterId: "",
  firmName: "",
  firmAddress: "",
  firmPhone: "",
  firmEmail: "",
  firmDisclaimer: "",
  governingState: "NY",
  trustType: "revocable",
  formationMethod: "trust_agreement",
  religiousPurpose: "",
  affiliation: "",
  governingCanonsNotes: "",
  parties: [
    { id: uuidv4(), role: "Settlor/Grantor", name: "" },
    { id: uuidv4(), role: "Trustee", name: "" },
  ],
  assets: [],
  taxPosture: "unsure",
  einStrategy: "unsure",
  custodyModel: "unsure",
  distributionStandard: "unsure",
  minutesAndResolutionsRef: "",
  selectedClauseIds: ["non_interference", "religious_purpose_precatory"],
  customClauses: "",
  custodianPolicies: [
    {
      id: uuidv4(),
      institutionName: "",
      accountType: "",
      trusteeOnlyAllowed: "unknown",
      trustEinRequired: "unknown",
      notes: "",
      verifier: "",
      lastVerified: "",
      evidence: [],
    },
  ],
  validatorInputs: {
    trusteeIndependenceClaimed: true,
    mandatoryDistributions: false,
    retainedControlOrVeto: false,
    separateTrustAccounting: true,
  },
  compliance: {
    conflictCheck: false,
    engagementLetter: false,
    kycIntake: false,
    dataRoomCreated: false,
    bankingKycReady: false,
    charitableRegistrationReviewed: false,
    annualReviewScheduled: false,
  },
  attorneyNotes: "",
});

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function useLocalDraftStorage(key = "ecclesiastical_draft_v1") {
  const hydrate = (raw: unknown): DraftModel | null => {
    if (!raw || typeof raw !== "object") return null;
    const base = defaultDraft();
    const parsed = raw as Partial<DraftModel>;
    return {
      ...base,
      ...parsed,
      validatorInputs: { ...base.validatorInputs, ...(parsed.validatorInputs ?? {}) },
      compliance: { ...base.compliance, ...(parsed.compliance ?? {}) },
      custodianPolicies: Array.isArray(parsed.custodianPolicies) ? parsed.custodianPolicies : base.custodianPolicies,
      selectedClauseIds: Array.isArray(parsed.selectedClauseIds) ? parsed.selectedClauseIds : base.selectedClauseIds,
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
  const save = (draft: DraftModel) => localStorage.setItem(key, JSON.stringify(draft));
  const clear = () => localStorage.removeItem(key);
  return { load, save, clear };
}

type DraftLockState = {
  isLocked: boolean;
  lockedAt?: string;
  lockedBy?: string;
  lockReason?: string;
  memoVersion: number;
  trusteePacketVersion: number;
};

const DRAFT_LOCK_KEY = "ecclesiastical_draft_lock_v1";
const DRAFT_LOCK_EVENT = "ecclesiastical_draft_lock_updated";

function loadDraftLock(): DraftLockState {
  try {
    const raw = window.localStorage.getItem(DRAFT_LOCK_KEY);
    if (!raw) return { isLocked: false, memoVersion: 1, trusteePacketVersion: 1 };
    const parsed = JSON.parse(raw) as Partial<DraftLockState>;
    return {
      isLocked: Boolean(parsed.isLocked),
      lockedAt: parsed.lockedAt,
      lockedBy: parsed.lockedBy,
      lockReason: parsed.lockReason,
      memoVersion: typeof parsed.memoVersion === "number" ? parsed.memoVersion : 1,
      trusteePacketVersion: typeof parsed.trusteePacketVersion === "number" ? parsed.trusteePacketVersion : 1,
    };
  } catch {
    return { isLocked: false, memoVersion: 1, trusteePacketVersion: 1 };
  }
}

function saveDraftLock(state: DraftLockState) {
  window.localStorage.setItem(DRAFT_LOCK_KEY, JSON.stringify(state));
  // Note: `storage` events do not fire in the same tab that wrote the value.
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

function bumpVersion(scope: "memo" | "trustee"): number {
  const cur = loadDraftLock();
  const next: DraftLockState = { ...cur };
  if (scope === "memo") next.memoVersion = Math.max(1, cur.memoVersion + 1);
  else next.trusteePacketVersion = Math.max(1, cur.trusteePacketVersion + 1);
  saveDraftLock(next);
  return scope === "memo" ? next.memoVersion : next.trusteePacketVersion;
}

function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [lock, setLock] = useState<DraftLockState>(() => loadDraftLock());

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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border shadow-sm">
              <Landmark className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Ecclesiastical Trust Workspace</div>
              <div className="text-xs text-muted-foreground">Compliance‑First • Intake • Draft Scaffold • Export</div>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
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
            <Button asChild variant={location.pathname === "/compliance" ? "default" : "ghost"} size="sm">
              <Link to="/compliance">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Compliance
              </Link>
            </Button>
            <Button asChild variant={location.pathname === "/validator" ? "default" : "ghost"} size="sm">
              <Link to="/validator">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Validator
              </Link>
            </Button>
            <Button asChild variant={location.pathname === "/custodians" ? "default" : "ghost"} size="sm">
              <Link to="/custodians">
                <Building2 className="mr-2 h-4 w-4" />
                Custodians
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
                <FileText className="mr-2 h-4 w-4" />
                Memo
              </Link>
            </Button>
            <Button asChild variant={location.pathname === "/annotations" ? "default" : "ghost"} size="sm">
              <Link to="/annotations">
                <BookOpen className="mr-2 h-4 w-4" />
                Annotations
              </Link>
            </Button>
            <Button asChild variant={location.pathname === "/caselaw" ? "default" : "ghost"} size="sm">
              <Link to="/caselaw">
                <Scale className="mr-2 h-4 w-4" />
                Case Law
              </Link>
            </Button>
            <Button asChild variant={location.pathname === "/trustee-onboarding" ? "default" : "ghost"} size="sm">
              <Link to="/trustee-onboarding">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Trustee Packet
              </Link>
            </Button>
            <Button asChild variant={location.pathname === "/guardrails" ? "default" : "ghost"} size="sm">
              <Link to="/guardrails">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Guardrails
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/smart-trust">Back to Smart Trust</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="https://troothhurtz.app/dashboard">Back to Dashboard</a>
            </Button>

            {lock.isLocked ? (
              <Badge variant="secondary" className="rounded-2xl">
                Locked{lock.lockReason ? ` — ${lock.lockReason}` : ""}
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-2xl">
                Unlocked
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={() => setLock(loadDraftLock())}>
              Refresh
            </Button>
            {lock.isLocked ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const ok = window.confirm(
                    "This will unlock the draft for editing. Only use for internal corrections and re-export with a new version. Continue?"
                  );
                  if (!ok) return;
                  unlockDraft();
                  setLock(loadDraftLock());
                }}
              >
                Unlock (Admin)
              </Button>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

function LegalGuardrailsCard() {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Scope & Guardrails (Compliance‑First)</CardTitle>
        <CardDescription>Neutral workflow for counsel; religious character informs purpose/governance only.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm text-muted-foreground">
        <div className="rounded-2xl border p-4">
          <div className="font-medium text-foreground">No civil‑law immunity claims</div>
          <div className="mt-1">
            This workflow does <span className="font-semibold">not</span> claim exemption from civil law. Trust validity depends on the selected state’s trust law.
          </div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="font-medium text-foreground">EIN decision is custodian‑dependent</div>
          <div className="mt-1">
            If a duly appointed <span className="font-semibold">corporate trustee</span> administers accounts, some custodians may allow operations under the trustee’s EIN.
            Otherwise a trust EIN may be required. This app flags the decision.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type PlatformBinding = {
  clientId: string | null;
  trustId: string | null;
  lastSyncedAt?: string | null;
  bindingValid?: "unknown" | "valid" | "invalid";
};

const PLATFORM_BINDING_KEY = "ecclesiastical_platform_binding_v1";
const PLATFORM_BINDING_EVENT = "ecclesiastical_platform_binding_updated";

function loadPlatformBinding(): PlatformBinding {
  if (typeof window === "undefined") return { clientId: null, trustId: null, lastSyncedAt: null };
  try {
    const raw = window.localStorage.getItem(PLATFORM_BINDING_KEY);
    if (!raw) return { clientId: null, trustId: null, lastSyncedAt: null };
    const parsed = JSON.parse(raw) as Partial<PlatformBinding>;
    return {
      clientId: typeof parsed.clientId === "string" ? parsed.clientId : null,
      trustId: typeof parsed.trustId === "string" ? parsed.trustId : null,
      lastSyncedAt: typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : null,
    };
  } catch {
    return { clientId: null, trustId: null, lastSyncedAt: null };
  }
}

function savePlatformBinding(binding: PlatformBinding) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLATFORM_BINDING_KEY, JSON.stringify(binding));
  // Note: `storage` events do not fire in the same tab that wrote the value.
  window.dispatchEvent(new Event(PLATFORM_BINDING_EVENT));
}

function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const storage = useLocalDraftStorage();
  const loaded = storage.load();
  const [draft, setDraft] = useState<DraftModel>(() => loaded ?? defaultDraft());
  const hasDraft = Boolean(loaded);
  const [lock, setLock] = useState<DraftLockState>(() => loadDraftLock());

  const [binding, setBinding] = useState<PlatformBinding>(() => loadPlatformBinding());
  const [bindBusy, setBindBusy] = useState(false);
  const [bindErr, setBindErr] = useState<string | null>(null);
  const [bindValidStatus, setBindValidStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");

  const [existingClientId, setExistingClientId] = useState("");
  const [existingTrustId, setExistingTrustId] = useState("");
  const [existingClientOnlyId, setExistingClientOnlyId] = useState("");
  const showCreatedClientBanner = useMemo(() => {
    const sp = new URLSearchParams(location.search || "");
    return sp.get("createdClient") === "1";
  }, [location.search]);

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
    if (!lock.isLocked) storage.save(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, lock.isLocked]);

  useEffect(() => {
    savePlatformBinding(binding);
  }, [binding]);

  useEffect(() => {
    const refresh = () => setBinding(loadPlatformBinding());
    const onStorage = (e: StorageEvent) => {
      if (e.key === PLATFORM_BINDING_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(PLATFORM_BINDING_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PLATFORM_BINDING_EVENT, refresh);
    };
  }, []);

  const canonicalTrustType = useMemo(() => {
    return draft.trustType === "irrevocable" ? "irrevocable_trust" : "revocable_living_trust";
  }, [draft.trustType]);

  const createClientHref = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("origin", "ecclesiastical");
    sp.set("returnTo", "/ecclesiastical");
    // Optional prefills: use the Settlor/Grantor party if present.
    const grantor = (draft.parties || []).find((p) => p.role === "Settlor/Grantor") || null;
    const name = (grantor?.name || "").trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        sp.set("first_name", parts.slice(0, -1).join(" "));
        sp.set("last_name", parts.slice(-1).join(" "));
      } else {
        sp.set("first_name", name);
      }
    }
    if (grantor?.email) sp.set("email", String(grantor.email));
    if (grantor?.phone) sp.set("phone", String(grantor.phone));
    return `/clients/new?${sp.toString()}`;
  }, [draft.parties]);

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
          if (!cancelled) setBindValidStatus("invalid");
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
        if (!cancelled) setBindValidStatus("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [binding.trustId]);

  useEffect(() => {
    // Return-from /clients/new: accept clientId and store it as a partial binding (client only).
    const sp = new URLSearchParams(location.search || "");
    const clientId = (sp.get("clientId") || "").trim();
    if (!clientId) return;
    setBinding((b) => ({ ...b, clientId: b.clientId || clientId }));
    // Clear query params so refresh doesn't re-trigger.
    navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  async function syncEcclesiasticalDraft(trustId: string) {
    if (lock.isLocked) throw new Error("Draft is locked — syncing is disabled.");
    const res = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/ecclesiastical-draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        draft,
        version: 1,
        locked: Boolean(lock.isLocked),
        lock: {
          isLocked: Boolean(lock.isLocked),
          lockedAt: lock.lockedAt,
          lockedBy: lock.lockedBy,
          lockReason: lock.lockReason,
          memoVersion: lock.memoVersion,
          trusteePacketVersion: lock.trusteePacketVersion,
        },
      }),
    });
    if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Sync failed (${res.status})`);
    setBinding((b) => ({ ...b, trustId, lastSyncedAt: new Date().toISOString() }));
  }

  async function createTrustWorkspaceForBoundClient() {
    if (bindBusy) return;
    if (!binding.clientId) {
      setBindErr("Client ID is required to create a trust workspace.");
      return;
    }
    setBindErr(null);
    setBindBusy(true);
    try {
      const trustName = (draft.matterName || "Ecclesiastical Trust Matter").trim();
      const jurisdiction = (draft.governingState || "NY") as string;

      const trustRes = await fetch(`/api/clients/${encodeURIComponent(binding.clientId)}/trusts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          trust_type: canonicalTrustType,
          jurisdiction_state: jurisdiction,
          name: trustName,
        }),
      });
      if (!trustRes.ok) throw new Error((await trustRes.text().catch(() => "")) || `Trust create failed (${trustRes.status})`);
      const trustData = await trustRes.json();
      const trustId = String(trustData?.trustId || "");
      if (!trustId) throw new Error("Trust create succeeded but returned no trustId.");

      setBinding((b) => ({ ...b, trustId, lastSyncedAt: null, bindingValid: "unknown" }));
      if (!lock.isLocked) {
        await syncEcclesiasticalDraft(trustId);
      } else {
        setBindErr("Draft is locked — trust created, but syncing is disabled until unlocked.");
      }
    } catch (e: any) {
      setBindErr(String(e?.message || e || "Failed to create trust workspace"));
    } finally {
      setBindBusy(false);
    }
  }

  async function bindClientOnly() {
    if (bindBusy) return;
    setBindErr(null);
    setBindBusy(true);
    try {
      const clientId = existingClientOnlyId.trim();
      if (!clientId) throw new Error("Client ID is required.");
      const cRes = await fetch(`/api/clients/${encodeURIComponent(clientId)}`);
      if (!cRes.ok) throw new Error((await cRes.text().catch(() => "")) || `Client validation failed (${cRes.status})`);
      setBinding((b) => ({ ...b, clientId, trustId: b.trustId || null }));
      setExistingClientOnlyId("");
    } catch (e: any) {
      setBindErr(String(e?.message || e || "Failed to bind client"));
    } finally {
      setBindBusy(false);
    }
  }

  async function bindToExisting() {
    if (bindBusy) return;
    setBindErr(null);
    setBindBusy(true);
    try {
      const trustId = existingTrustId.trim();
      const clientIdInput = existingClientId.trim() || null;
      if (!trustId) throw new Error("Trust ID is required to bind.");

      // Validate trust ownership and fetch derived clientId (if any) via existing summary endpoint.
      const wsRes = await fetch(`/api/trusts/${encodeURIComponent(trustId)}/workspace/summary`);
      if (!wsRes.ok) throw new Error((await wsRes.text().catch(() => "")) || `Trust validation failed (${wsRes.status})`);
      const ws = await wsRes.json();
      const derivedClientId = String(ws?.trust?.clientId || "") || null;

      if (clientIdInput) {
        const cRes = await fetch(`/api/clients/${encodeURIComponent(clientIdInput)}`);
        if (!cRes.ok) throw new Error((await cRes.text().catch(() => "")) || `Client validation failed (${cRes.status})`);
        if (derivedClientId && derivedClientId !== clientIdInput) {
          throw new Error("Client ID does not match the trust’s clientId.");
        }
      }

      const finalClientId = clientIdInput || derivedClientId;
      setBinding({ clientId: finalClientId, trustId, lastSyncedAt: null, bindingValid: "unknown" });

      if (!lock.isLocked) {
        await syncEcclesiasticalDraft(trustId);
      } else {
        setBindErr("Draft is locked — binding saved, but syncing is disabled until unlocked.");
      }
    } catch (e: any) {
      setBindErr(String(e?.message || e || "Failed to bind existing IDs"));
    } finally {
      setBindBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <LegalGuardrailsCard />

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Client &amp; Trust Binding (Platform Record)</CardTitle>
          <CardDescription>
            Bind this ecclesiastical draft to a canonical Client + Trust workspace so audit trails and downstream modules can attach safely.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {showCreatedClientBanner ? (
            <Alert className="rounded-2xl">
              <AlertDescription>Client created. Continue by creating a Trust workspace for this matter.</AlertDescription>
            </Alert>
          ) : null}
          {bindErr ? (
            <Alert className="rounded-2xl border-red-500/30 bg-red-500/5">
              <AlertDescription>{bindErr}</AlertDescription>
            </Alert>
          ) : null}

          <div className="rounded-2xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Binding Status</div>
              {binding.trustId ? (
                <Badge variant="default" className="rounded-2xl">
                  Bound{bindValidStatus === "invalid" ? " (invalid)" : ""}
                </Badge>
              ) : (
                <Badge variant="secondary" className="rounded-2xl">
                  Not bound
                </Badge>
              )}
            </div>

            <div className="mt-2 grid gap-2 text-sm text-muted-foreground">
              <div>
                Client ID: <span className="font-mono text-foreground">{binding.clientId || "—"}</span>
              </div>
              <div>
                Trust ID: <span className="font-mono text-foreground">{binding.trustId || "—"}</span>
              </div>
              <div>
                Last synced: <span className="font-mono text-foreground">{binding.lastSyncedAt || "—"}</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {binding.trustId ? (
                <>
                  <Button
                    className="rounded-2xl"
                    variant="outline"
                    onClick={async () => {
                      if (!binding.trustId) return;
                      setBindErr(null);
                      setBindBusy(true);
                      try {
                        await syncEcclesiasticalDraft(binding.trustId);
                      } catch (e: any) {
                        setBindErr(String(e?.message || e || "Sync failed"));
                      } finally {
                        setBindBusy(false);
                      }
                    }}
                    disabled={bindBusy || lock.isLocked || bindValidStatus === "invalid"}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Sync to Platform
                  </Button>
                  <Button className="rounded-2xl" variant="outline" onClick={() => window.open(`/trusts/${binding.trustId}`, "_blank")}>
                    <Landmark className="mr-2 h-4 w-4" />
                    Open Trust Workspace
                  </Button>
                  <Button
                    className="rounded-2xl"
                    variant="outline"
                    onClick={() => window.open(`/smart-trust?trustId=${encodeURIComponent(binding.trustId || "")}`, "_blank")}
                    disabled={!binding.trustId}
                  >
                    <ScrollText className="mr-2 h-4 w-4" />
                    Open in Smart Trust
                  </Button>
                  <Button
                    className="rounded-2xl"
                    variant="secondary"
                    onClick={() => setBinding({ clientId: null, trustId: null, lastSyncedAt: null })}
                    disabled={bindBusy}
                  >
                    Clear Binding
                  </Button>
                  {lock.isLocked ? (
                    <div className="w-full text-xs text-muted-foreground">
                      Locked — syncing disabled{lock.lockReason ? ` (${lock.lockReason})` : ""}.
                    </div>
                  ) : null}
                  {bindValidStatus === "invalid" ? (
                    <div className="w-full text-xs text-muted-foreground">Binding validation failed — clear and re-bind.</div>
                  ) : null}
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button className="rounded-2xl" variant="outline" asChild disabled={bindBusy}>
                    <a href={createClientHref}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Client Record
                    </a>
                  </Button>
                  <Button
                    className="rounded-2xl"
                    onClick={createTrustWorkspaceForBoundClient}
                    disabled={bindBusy || lock.isLocked || !binding.clientId}
                  >
                    <Landmark className="mr-2 h-4 w-4" />
                    {bindBusy ? "Working…" : "Create Trust Workspace"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {!binding.trustId ? (
            <div className="rounded-2xl border p-4">
              <div className="text-sm font-semibold">Client Linking</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Use the canonical “New Client” page to create records, or paste an existing Client ID to bind.
              </div>

              <div className="mt-4 rounded-2xl border p-4">
                <div className="text-sm font-semibold">Link Existing Client (clientId only)</div>
                <div className="mt-1 text-xs text-muted-foreground">This sets a client binding; you can create a trust workspace next.</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Existing Client ID</Label>
                    <Input
                      className="rounded-2xl"
                      value={existingClientOnlyId}
                      onChange={(e) => setExistingClientOnlyId(e.target.value)}
                      placeholder="uuid"
                    />
                  </div>
                  <div className="grid gap-2 md:self-end">
                    <Button className="rounded-2xl" variant="outline" onClick={bindClientOnly} disabled={bindBusy}>
                      Bind Client
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border p-4">
                <div className="text-sm font-semibold">Link Existing Trust (paste IDs)</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Avoid duplicate clients/trusts for repeat matters. Trust ownership is validated before saving.
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Existing Client ID (optional)</Label>
                    <Input className="rounded-2xl" value={existingClientId} onChange={(e) => setExistingClientId(e.target.value)} placeholder="uuid" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Existing Trust ID (required)</Label>
                    <Input className="rounded-2xl" value={existingTrustId} onChange={(e) => setExistingTrustId(e.target.value)} placeholder="uuid" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button className="rounded-2xl" variant="outline" onClick={bindToExisting} disabled={bindBusy}>
                    Bind + Sync Draft
                  </Button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border p-3 text-sm text-muted-foreground">
                Trust to be created from current draft: <span className="text-foreground font-medium">{draft.matterName || "(unnamed)"}</span> •{" "}
                governing law: <span className="font-mono text-foreground">{draft.governingState || "NY"}</span> • type:{" "}
                <span className="font-mono text-foreground">{canonicalTrustType}</span>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Start / Continue</CardTitle>
          <CardDescription>Build an ecclesiastical trust matter summary with an exportable packet.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-2xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Firm & Matter Metadata (for exports)</div>
              {lock.isLocked ? (
                <Badge variant="secondary" className="rounded-2xl">
                  Locked — edits disabled
                </Badge>
              ) : (
                <Badge variant="outline" className="rounded-2xl">
                  Editable
                </Badge>
              )}
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Matter name</Label>
                <Input
                  className="rounded-2xl"
                  value={draft.matterName}
                  disabled={lock.isLocked}
                  onChange={(e) => setDraft((p) => ({ ...p, matterName: e.target.value }))}
                  placeholder="e.g., Ecclesiastical Trust Matter"
                />
              </div>
              <div className="grid gap-2">
                <Label>Matter ID (watermark)</Label>
                <Input
                  className="rounded-2xl"
                  value={draft.matterId ?? ""}
                  disabled={lock.isLocked}
                  onChange={(e) => setDraft((p) => ({ ...p, matterId: e.target.value }))}
                  placeholder="e.g., 25-0148"
                />
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Firm name</Label>
                <Input
                  className="rounded-2xl"
                  value={draft.firmName ?? ""}
                  disabled={lock.isLocked}
                  onChange={(e) => setDraft((p) => ({ ...p, firmName: e.target.value }))}
                  placeholder="e.g., Smith & Doe LLP"
                />
              </div>
              <div className="grid gap-2">
                <Label>Firm email</Label>
                <Input
                  className="rounded-2xl"
                  value={draft.firmEmail ?? ""}
                  disabled={lock.isLocked}
                  onChange={(e) => setDraft((p) => ({ ...p, firmEmail: e.target.value }))}
                  placeholder="e.g., trusts@firm.com"
                />
              </div>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Firm phone</Label>
                <Input
                  className="rounded-2xl"
                  value={draft.firmPhone ?? ""}
                  disabled={lock.isLocked}
                  onChange={(e) => setDraft((p) => ({ ...p, firmPhone: e.target.value }))}
                  placeholder="e.g., (555) 123-4567"
                />
              </div>
              <div className="grid gap-2">
                <Label>Firm address</Label>
                <Input
                  className="rounded-2xl"
                  value={draft.firmAddress ?? ""}
                  disabled={lock.isLocked}
                  onChange={(e) => setDraft((p) => ({ ...p, firmAddress: e.target.value }))}
                  placeholder="e.g., 100 Main St, New York, NY"
                />
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              <Label>Disclaimer boilerplate (exports/prints)</Label>
              <Textarea
                className="rounded-2xl"
                value={draft.firmDisclaimer ?? ""}
                disabled={lock.isLocked}
                onChange={(e) => setDraft((p) => ({ ...p, firmDisclaimer: e.target.value }))}
                placeholder="Optional firm disclaimer. Avoid legal conclusions; keep it neutral."
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => navigate("/wizard")} className="rounded-2xl">
              <FileText className="mr-2 h-4 w-4" />
              {hasDraft ? "Continue Wizard" : "Start Wizard"}
            </Button>
            <Button variant="outline" onClick={() => { storage.clear(); navigate("/wizard"); }} className="rounded-2xl">
              Reset Draft
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const CLAUSE_LIBRARY: Array<{
  id: string;
  category: "Purpose" | "Governance" | "Discretion" | "Non‑interference" | "Other";
  title: string;
  text: string;
  riskNote: string;
}> = [
  {
    id: "religious_purpose_precatory",
    category: "Purpose",
    title: "Religious purpose (precatory; non‑operative)",
    text: "The religious character of this Trust expresses the Settlor’s moral and spiritual intent and is included to reflect purpose only. It shall not be construed to limit or displace the Trustee’s fiduciary duties under applicable state law.",
    riskNote: "Keep purpose language expressive/precatory; avoid doctrinal adjudication triggers.",
  },
  {
    id: "trustee_discretion_affirmation",
    category: "Discretion",
    title: "Trustee discretion affirmation",
    text: "Except as expressly required by the trust instrument and applicable law, distributions are within the Trustee’s discretion, subject to the Trustee’s fiduciary duties and any stated distribution standard.",
    riskNote: "Confirm consistency with any mandatory distribution provisions or ascertainable standards.",
  },
  {
    id: "non_interference",
    category: "Non‑interference",
    title: "Non‑interference with civil law",
    text: "Nothing in this Trust is intended to exempt the Trust, Trustee, or beneficiaries from compliance with applicable federal or state law, including fiduciary duties, reporting requirements, and lawful custodial policies.",
    riskNote: "Attorney-safety clause for banks/courts; keep it prominent.",
  },
  {
    id: "minutes_resolutions_record",
    category: "Governance",
    title: "Minutes / resolutions recordkeeping",
    text: "The Trustee (and any advisory council) should maintain contemporaneous minutes/resolutions documenting key decisions, especially discretionary distributions and significant administrative actions.",
    riskNote: "Helps demonstrate process and supports custodian onboarding packets.",
  },
];

function statusBadge(kind: "ok" | "warn" | "fail", label: string) {
  if (kind === "ok") return <Badge variant="default">{label}</Badge>;
  if (kind === "warn") return <Badge variant="secondary">{label}</Badge>;
  return (
    <Badge variant="outline" className="border-red-500 text-red-500">
      {label}
    </Badge>
  );
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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

type LegalReviewAction = "print" | "export_pdf" | "download_txt";
type LegalReviewEntry = {
  id: string;
  action: LegalReviewAction;
  scope: string;
  reviewer: string;
  reviewedAt: string;
};
const LEGAL_REVIEW_LOG_KEY = "ecclesiastical_legal_review_log_v1";

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

function ComplianceRail({ draft }: { draft: DraftModel }) {
  const corporateTrusteePresent = draft.parties.some((p) => p.role === "Corporate Trustee" && p.name.trim());
  const einWarning =
    draft.einStrategy === "use_corporate_trustee_ein" && !corporateTrusteePresent
      ? "EIN Strategy is set to “Use corporate trustee EIN” but no Corporate Trustee name is provided."
      : null;

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Legal & Tax Notes (read‑only)</CardTitle>
          <CardDescription>Guidance prompts—confirm with counsel.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-xs text-muted-foreground">
          <ul className="list-disc pl-5 space-y-1">
            <li>Trust validity is governed by the selected state’s trust law and formalities.</li>
            <li>Religious purpose informs governance; it does not displace civil law.</li>
            <li>EIN needs vary by custody model and tax posture; custodians have their own policies.</li>
          </ul>
          {einWarning ? (
            <Alert className="border-red-700/50 bg-red-900/20">
              <AlertDescription className="text-red-300">{einWarning}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ValidatorPage() {
  const storage = useLocalDraftStorage();
  const [draft, setDraft] = useState<DraftModel>(() => storage.load() ?? defaultDraft());

  useEffect(() => {
    if (!loadDraftLock().isLocked) storage.save(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const corporateTrusteePresent = draft.parties.some((p) => p.role === "Corporate Trustee" && p.name.trim());
  const governingStateSet = Boolean(draft.governingState);

  const checks = useMemo(() => {
    const items: Array<{
      title: string;
      status: "ok" | "warn" | "fail";
      detail: string;
    }> = [];

    items.push({
      title: "Governing state selected",
      status: governingStateSet ? "ok" : "fail",
      detail: governingStateSet
        ? `Governing state: ${draft.governingState}`
        : "Select a governing state. This app does not make validity determinations without a civil-law anchor.",
    });

    if (draft.einStrategy === "use_corporate_trustee_ein") {
      items.push({
        title: "Corporate trustee present (EIN strategy prerequisite)",
        status: corporateTrusteePresent ? "ok" : "fail",
        detail: corporateTrusteePresent
          ? "Corporate trustee name is provided."
          : "Add a Corporate Trustee in Parties (name required) if using a corporate trustee EIN strategy.",
      });
    } else {
      items.push({
        title: "Corporate trustee prerequisite",
        status: "warn",
        detail: "Not required unless your EIN/custody model relies on a corporate trustee; confirm custodian policy.",
      });
    }

    if (draft.validatorInputs.mandatoryDistributions && draft.validatorInputs.trusteeIndependenceClaimed) {
      items.push({
        title: "Mandatory distributions vs trustee independence",
        status: "warn",
        detail:
          "You indicated both mandatory distributions and trustee independence. Review instrument language and fiduciary obligations for consistency under state law.",
      });
    } else {
      items.push({
        title: "Distribution mechanics consistency",
        status: "ok",
        detail: "No obvious internal inconsistency flagged by the workflow inputs.",
      });
    }

    if (draft.validatorInputs.retainedControlOrVeto) {
      items.push({
        title: "Retained control / veto signals",
        status: "warn",
        detail:
          "You indicated retained control/veto power signals. Review for control retention implications and fiduciary-duty conflicts (fact-specific).",
      });
    } else {
      items.push({
        title: "Retained control / veto signals",
        status: "ok",
        detail: "No retained control/veto signals indicated.",
      });
    }

    if (!draft.validatorInputs.separateTrustAccounting) {
      items.push({
        title: "Separate trust accounting",
        status: "warn",
        detail:
          "Separate trust accounting is not indicated. Many custodians and fiduciary best practices expect separate accounting; confirm your state requirements and custodian policy.",
      });
    } else {
      items.push({
        title: "Separate trust accounting",
        status: "ok",
        detail: "Separate trust accounting is indicated.",
      });
    }

    return items;
  }, [corporateTrusteePresent, draft.einStrategy, draft.governingState, draft.validatorInputs, governingStateSet]);

  const score = useMemo(() => {
    const fail = checks.filter((c) => c.status === "fail").length;
    const warn = checks.filter((c) => c.status === "warn").length;
    return { fail, warn, ok: checks.length - fail - warn };
  }, [checks]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-6">
        <LegalGuardrailsCard />

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">State‑Law Validator (rules‑based prompts)</CardTitle>
            <CardDescription>
              Flags inconsistencies and missing prerequisites without rendering legal conclusions.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(score.fail ? "fail" : score.warn ? "warn" : "ok", `${score.ok} ok • ${score.warn} review • ${score.fail} conflicts`)}
              <Badge variant="outline">Draft: {draft.draftId.slice(0, 8)}</Badge>
            </div>

            <div className="grid gap-3">
              {checks.map((c) => (
                <div key={c.title} className="rounded-2xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="text-sm font-semibold">{c.title}</div>
                    {statusBadge(c.status, c.status === "ok" ? "✔" : c.status === "warn" ? "⚠" : "✖")}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">{c.detail}</div>
                </div>
              ))}
            </div>

            <Separator />

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm">Validator inputs</CardTitle>
                <CardDescription>These toggles drive the rule checks above.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.validatorInputs.trusteeIndependenceClaimed}
                    onCheckedChange={(v) =>
                      setDraft((p) => ({
                        ...p,
                        validatorInputs: { ...p.validatorInputs, trusteeIndependenceClaimed: Boolean(v) },
                      }))
                    }
                  />
                  Trustee independence is claimed/important to structure
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.validatorInputs.mandatoryDistributions}
                    onCheckedChange={(v) =>
                      setDraft((p) => ({
                        ...p,
                        validatorInputs: { ...p.validatorInputs, mandatoryDistributions: Boolean(v) },
                      }))
                    }
                  />
                  Mandatory distributions are contemplated (not purely discretionary)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.validatorInputs.retainedControlOrVeto}
                    onCheckedChange={(v) =>
                      setDraft((p) => ({
                        ...p,
                        validatorInputs: { ...p.validatorInputs, retainedControlOrVeto: Boolean(v) },
                      }))
                    }
                  />
                  Retained control / veto / approval rights are contemplated
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.validatorInputs.separateTrustAccounting}
                    onCheckedChange={(v) =>
                      setDraft((p) => ({
                        ...p,
                        validatorInputs: { ...p.validatorInputs, separateTrustAccounting: Boolean(v) },
                      }))
                    }
                  />
                  Separate trust accounting is planned
                </label>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <ComplianceRail draft={draft} />
      </div>
    </div>
  );
}

function CustodiansPage() {
  const storage = useLocalDraftStorage();
  const [draft, setDraft] = useState<DraftModel>(() => storage.load() ?? defaultDraft());

  useEffect(() => {
    if (!loadDraftLock().isLocked) storage.save(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const rows = draft.custodianPolicies ?? [];
  const updateRow = (id: string, patch: Partial<CustodianPolicyRow>) => {
    setDraft((p) => ({
      ...p,
      custodianPolicies: p.custodianPolicies.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const addRow = () => {
    setDraft((p) => ({
      ...p,
      custodianPolicies: [
        ...p.custodianPolicies,
        {
          id: uuidv4(),
          institutionName: "",
          accountType: "",
          trusteeOnlyAllowed: "unknown",
          trustEinRequired: "unknown",
          notes: "",
        },
      ],
    }));
  };

  const removeRow = (id: string) => {
    setDraft((p) => ({
      ...p,
      custodianPolicies: p.custodianPolicies.filter((r) => r.id !== id),
    }));
  };

  const addEvidence = (id: string, file: File) => {
    const ev = {
      id: uuidv4(),
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      addedAt: new Date().toISOString(),
    };
    setDraft((p) => ({
      ...p,
      custodianPolicies: p.custodianPolicies.map((r) =>
        r.id === id ? { ...r, evidence: [ev, ...((r.evidence ?? []) as any)] } : r
      ),
    }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-6">
        <LegalGuardrailsCard />

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Custodian Policy Matrix (reference)</CardTitle>
            <CardDescription>
              Track institutional policies (trust EIN vs corporate trustee EIN) as a fact matrix. Policies vary and change.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Button variant="outline" onClick={addRow}>
                Add institution
              </Button>
              <div className="text-xs text-muted-foreground">
                Tip: Use this as a living checklist alongside account opening packets.
              </div>
            </div>

            <div className="grid gap-3">
              {rows.length === 0 ? (
                <div className="rounded-2xl border p-6 text-sm text-muted-foreground">No custodians added.</div>
              ) : (
                rows.map((r) => (
                  <div key={r.id} className="rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid gap-3 flex-1">
                        <div className="grid gap-2 md:grid-cols-2">
                          <div className="grid gap-2">
                            <Label>Institution</Label>
                            <Input
                              className="rounded-2xl"
                              value={r.institutionName}
                              onChange={(e) => updateRow(r.id, { institutionName: e.target.value })}
                              placeholder="e.g., Bank / Broker / Custodian"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Account type</Label>
                            <Input
                              className="rounded-2xl"
                              value={r.accountType}
                              onChange={(e) => updateRow(r.id, { accountType: e.target.value })}
                              placeholder="e.g., Trust account / Brokerage / Crypto custody"
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="grid gap-2">
                            <Label>Trustee-only accounts allowed?</Label>
                            <Select
                              value={r.trusteeOnlyAllowed}
                              onValueChange={(v) => updateRow(r.id, { trusteeOnlyAllowed: v as any })}
                            >
                              <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unknown">Unknown</SelectItem>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Trust EIN required?</Label>
                            <Select
                              value={r.trustEinRequired}
                              onValueChange={(v) => updateRow(r.id, { trustEinRequired: v as any })}
                            >
                              <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unknown">Unknown</SelectItem>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="conditional">Conditional</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Label>Notes</Label>
                          <Textarea
                            className="min-h-[90px] rounded-2xl"
                            value={r.notes}
                            onChange={(e) => updateRow(r.id, { notes: e.target.value })}
                            placeholder="KYC requirements, trust certification forms, resolutions, special documentation, contacts, dates, etc."
                          />
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="grid gap-2">
                            <Label>Verifier (optional)</Label>
                            <Input
                              className="rounded-2xl"
                              value={r.verifier ?? ""}
                              onChange={(e) => updateRow(r.id, { verifier: e.target.value })}
                              placeholder="Name / role"
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Last verified (optional)</Label>
                            <Input
                              type="date"
                              className="rounded-2xl"
                              value={r.lastVerified ?? ""}
                              onChange={(e) => updateRow(r.id, { lastVerified: e.target.value })}
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label>Evidence upload</Label>
                            <Input
                              type="file"
                              className="rounded-2xl"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                addEvidence(r.id, f);
                                e.currentTarget.value = "";
                              }}
                            />
                          </div>
                        </div>

                        {(r.evidence ?? []).length > 0 ? (
                          <div className="rounded-2xl border p-3">
                            <div className="text-sm font-medium">Evidence (metadata only)</div>
                            <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                              {(r.evidence ?? []).map((ev) => (
                                <li key={ev.id}>
                                  <span className="font-medium text-foreground">{ev.name}</span>{" "}
                                  <span className="text-muted-foreground">
                                    ({Math.round((ev.size ?? 0) / 1024)} KB • {new Date(ev.addedAt).toLocaleString()})
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => removeRow(r.id)}>
                          Remove
                        </Button>
                        {draft.einStrategy === "use_corporate_trustee_ein" && r.trustEinRequired === "yes" ? (
                          <Badge variant="outline" className="border-red-500 text-red-500">
                            EIN conflict
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <ComplianceRail draft={draft} />
      </div>
    </div>
  );
}

function ClausesPage() {
  const storage = useLocalDraftStorage();
  const [draft, setDraft] = useState<DraftModel>(() => storage.load() ?? defaultDraft());

  useEffect(() => {
    if (!loadDraftLock().isLocked) storage.save(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const selected = new Set(draft.selectedClauseIds ?? []);
  const toggle = (id: string, on: boolean) => {
    setDraft((p) => {
      const set = new Set(p.selectedClauseIds ?? []);
      if (on) set.add(id);
      else set.delete(id);
      return { ...p, selectedClauseIds: Array.from(set) };
    });
  };

  const grouped = useMemo(() => {
    const map = new Map<string, typeof CLAUSE_LIBRARY>();
    for (const c of CLAUSE_LIBRARY) {
      const arr = map.get(c.category) ?? [];
      arr.push(c);
      map.set(c.category, arr);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-6">
        <LegalGuardrailsCard />

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Religious‑Purpose Clause Library (vetted, neutral)</CardTitle>
            <CardDescription>
              Clauses are drafted to express religious purpose without civil‑law displacement language. Confirm with counsel.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {grouped.map(([category, clauses]) => (
              <div key={category} className="rounded-2xl border p-4">
                <div className="text-sm font-semibold">{category}</div>
                <div className="mt-3 grid gap-3">
                  {clauses.map((c) => (
                    <div key={c.id} className="rounded-2xl border p-3">
                      <label className="flex items-start gap-3">
                        <Checkbox checked={selected.has(c.id)} onCheckedChange={(v) => toggle(c.id, Boolean(v))} />
                        <div className="grid gap-1">
                          <div className="text-sm font-medium">{c.title}</div>
                          <div className="text-xs text-muted-foreground whitespace-pre-wrap">{c.text}</div>
                          <div className="text-[11px] text-muted-foreground">
                            <span className="font-semibold">Risk note:</span> {c.riskNote}
                          </div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-sm">Custom clauses / notes (optional)</CardTitle>
                <CardDescription>Stored locally; avoid embedding sensitive client data in localStorage.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Textarea
                  className="min-h-[140px] rounded-2xl"
                  value={draft.customClauses}
                  onChange={(e) => setDraft((p) => ({ ...p, customClauses: e.target.value }))}
                  placeholder="Paste additional clauses or drafting notes for counsel review."
                />
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <ComplianceRail draft={draft} />
      </div>
    </div>
  );
}

function MemoPage() {
  const storage = useLocalDraftStorage();
  const [draft, setDraft] = useState<DraftModel>(() => storage.load() ?? defaultDraft());

  useEffect(() => {
    if (!loadDraftLock().isLocked) storage.save(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const selectedClauseText = useMemo(() => {
    const set = new Set(draft.selectedClauseIds ?? []);
    const chosen = CLAUSE_LIBRARY.filter((c) => set.has(c.id));
    const parts = chosen.map((c) => `- ${c.title}\n  ${c.text}`);
    return parts.join("\n\n");
  }, [draft.selectedClauseIds]);

  const openItems = useMemo(() => {
    const items: string[] = [];
    if (!draft.governingState) items.push("Select governing state and confirm state trust formalities.");
    if (draft.einStrategy === "use_corporate_trustee_ein") {
      const corporateTrusteePresent = draft.parties.some((p) => p.role === "Corporate Trustee" && p.name.trim());
      if (!corporateTrusteePresent) items.push("Add Corporate Trustee name (EIN strategy prerequisite).");
    }
    if (draft.validatorInputs.retainedControlOrVeto) items.push("Review retained control/veto signals for fiduciary/tax implications.");
    if (draft.validatorInputs.mandatoryDistributions && draft.validatorInputs.trusteeIndependenceClaimed)
      items.push("Review mandatory distributions vs trustee independence for consistency.");
    return items;
  }, [draft]);

  const memo = useMemo(() => {
    const settlor = draft.parties.find((p) => p.role === "Settlor/Grantor")?.name || "(not specified)";
    const trustee = draft.parties.find((p) => p.role === "Trustee")?.name || "(not specified)";
    const corp = draft.parties.find((p) => p.role === "Corporate Trustee")?.name || "(not specified)";

    const lines: string[] = [];
    lines.push("ECCLESIASTICAL TRUST — ATTORNEY MEMO (DRAFT)");
    lines.push("");
    lines.push(`Matter: ${draft.matterName || "(unnamed)"}`);
    lines.push(`Internal file: ${draft.internalFileNumber || "(none)"}`);
    lines.push(`Draft ID: ${draft.draftId}`);
    lines.push("");
    lines.push("1. Background and Client Intent");
    lines.push(draft.religiousPurpose?.trim() ? draft.religiousPurpose.trim() : "(not captured)");
    if (draft.affiliation.trim()) lines.push(`Affiliation: ${draft.affiliation.trim()}`);
    lines.push("");
    lines.push("2. Governing Law and Validity Anchor (non-conclusive)");
    lines.push(`Governing state: ${draft.governingState || "(not selected)"}`);
    lines.push(`Trust type: ${draft.trustType}`);
    lines.push(`Formation: ${draft.formationMethod === "trust_agreement" ? "Trust agreement" : "Declaration of trust"}`);
    lines.push("");
    lines.push("3. Parties (snapshot)");
    lines.push(`Settlor/Grantor: ${settlor}`);
    lines.push(`Trustee: ${trustee}`);
    lines.push(`Corporate Trustee: ${corp}`);
    lines.push("");
    lines.push("4. Tax Posture and EIN Analysis (non-advice)");
    lines.push(`Tax posture: ${draft.taxPosture.replaceAll("_", " ")}`);
    lines.push(`EIN strategy: ${draft.einStrategy.replaceAll("_", " ")}`);
    lines.push(`Custody model: ${draft.custodyModel.replaceAll("_", " ")}`);
    lines.push("");
    lines.push("5. Role of Religious Character");
    lines.push(
      "Religious/ecclesiastical references are included solely to reflect stated purpose and governance preferences, and do not alter civil-law character or compliance obligations."
    );
    lines.push("");
    lines.push("6. Selected Clauses (vetted library excerpts)");
    lines.push(selectedClauseText || "(none selected)");
    if (draft.customClauses.trim()) {
      lines.push("");
      lines.push("Custom clauses / notes");
      lines.push(draft.customClauses.trim());
    }
    lines.push("");
    lines.push("7. Open Items / Review Required");
    lines.push(openItems.length ? openItems.map((x) => `- ${x}`).join("\n") : "- None flagged by the current workflow inputs.");
    lines.push("");
    lines.push("Disclaimer: This memo is a workflow artifact for counsel. It does not constitute legal or tax advice.");
    return lines.join("\n");
  }, [draft, openItems, selectedClauseText]);

  async function exportMemoPDF() {
    const reviewer = promptReviewerName();
    if (!reviewer) return;
    appendLegalReviewEntry({ action: "export_pdf", scope: "Ecclesiastical Memo", reviewer });
    const nextVersion = bumpVersion("memo");
    lockDraft(reviewer, `Exported Memo v${nextVersion}`);

    const node = document.getElementById("ecclesiastical-memo-render");
    if (!node) return;
    const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: null });
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
    pdf.save(`${prefix}${draft.matterName || "Draft"}-EcclesiasticalTrustMemo-v${v}.pdf`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-6">
        <LegalGuardrailsCard />

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Attorney Memo Generator</CardTitle>
            <CardDescription>Generates a neutral, defensible memo for the client file.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => {
                  void navigator.clipboard.writeText(memo);
                }}
                variant="outline"
              >
                Copy Memo
              </Button>
              <Button
                onClick={() => {
                  const reviewer = promptReviewerName();
                  if (!reviewer) return;
                  appendLegalReviewEntry({ action: "download_txt", scope: "Ecclesiastical Memo", reviewer });
                  const v = loadDraftLock().memoVersion;
                  const mid = (draft.matterId || "").trim();
                  const prefix = mid ? `${mid}-` : "";
                  downloadText(`${prefix}${draft.matterName || "Draft"}-EcclesiasticalTrustMemo-v${v}.txt`, memo);
                }}
                variant="outline"
              >
                Download TXT
              </Button>
              <Button onClick={exportMemoPDF}>
                <Download className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
              <Button variant="outline" onClick={() => setDraft((p) => ({ ...p, status: "ready_for_review" }))}>
                Mark Ready
              </Button>
            </div>

            <div id="ecclesiastical-memo-render" className="rounded-2xl border p-4">
              <div className="relative">
                <Watermark text={`${(draft.matterId || "").trim()} • Memo v${loadDraftLock().memoVersion}`.trim()} />
                <DocumentBrandingHeader
                  firmName={draft.firmName}
                  firmEmail={draft.firmEmail}
                  firmPhone={draft.firmPhone}
                  firmAddress={draft.firmAddress}
                  disclaimer={draft.firmDisclaimer}
                  docTitle="Attorney Memorandum"
                  matterName={draft.matterName || "(unnamed)"}
                  matterId={draft.matterId}
                  versionLabel={`Memo v${loadDraftLock().memoVersion} • ${new Date().toLocaleDateString()}`}
                />
              </div>
              <Separator className="my-3" />
              <pre className="whitespace-pre-wrap font-mono text-xs text-foreground">{memo}</pre>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <ComplianceRail draft={draft} />
      </div>
    </div>
  );
}

function CompliancePage() {
  const storage = useLocalDraftStorage();
  const [draft, setDraft] = useState<DraftModel>(() => storage.load() ?? defaultDraft());

  useEffect(() => {
    if (!loadDraftLock().isLocked) storage.save(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const score = useMemo(() => Object.values(draft.compliance).filter(Boolean).length, [draft.compliance]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-6">
        <LegalGuardrailsCard />

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Compliance Checklist</CardTitle>
            <CardDescription>Auto-generated checkpoints; customize for your practice.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between">
              <div className="text-sm">Completion</div>
              <Badge variant={score >= 5 ? "default" : "secondary"}>{score}/7</Badge>
            </div>
            <Progress value={Math.round((score / 7) * 100)} />

            <div className="grid gap-3 rounded-2xl border p-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={draft.compliance.conflictCheck} onCheckedChange={(v) => setDraft((p) => ({ ...p, compliance: { ...p.compliance, conflictCheck: Boolean(v) } }))} />
                Conflict check completed
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={draft.compliance.engagementLetter} onCheckedChange={(v) => setDraft((p) => ({ ...p, compliance: { ...p.compliance, engagementLetter: Boolean(v) } }))} />
                Engagement letter executed
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={draft.compliance.kycIntake} onCheckedChange={(v) => setDraft((p) => ({ ...p, compliance: { ...p.compliance, kycIntake: Boolean(v) } }))} />
                Client intake / KYC completed
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={draft.compliance.dataRoomCreated} onCheckedChange={(v) => setDraft((p) => ({ ...p, compliance: { ...p.compliance, dataRoomCreated: Boolean(v) } }))} />
                Data room created and access controlled
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={draft.compliance.bankingKycReady} onCheckedChange={(v) => setDraft((p) => ({ ...p, compliance: { ...p.compliance, bankingKycReady: Boolean(v) } }))} />
                Banking/custodian KYC package ready
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={draft.compliance.charitableRegistrationReviewed} onCheckedChange={(v) => setDraft((p) => ({ ...p, compliance: { ...p.compliance, charitableRegistrationReviewed: Boolean(v) } }))} />
                Charitable solicitation registration reviewed (if applicable)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={draft.compliance.annualReviewScheduled} onCheckedChange={(v) => setDraft((p) => ({ ...p, compliance: { ...p.compliance, annualReviewScheduled: Boolean(v) } }))} />
                Annual review scheduled (minutes, accounts, tax)
              </label>
            </div>

            <Separator />
            <div className="grid gap-2">
              <Label>Attorney notes</Label>
              <Textarea className="min-h-[120px] rounded-2xl" value={draft.attorneyNotes} onChange={(e) => setDraft((p) => ({ ...p, attorneyNotes: e.target.value }))} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <ComplianceRail draft={draft} />
      </div>
    </div>
  );
}

type StateStatuteRef = {
  citation: string;
  description: string;
  sourceLabel: string;
  sourceUrl?: string;
  isOfficial?: boolean;
};

type StatuteVerification = {
  citation: string;
  verifier?: string;
  lastVerified?: string; // yyyy-mm-dd
};

const STATUTE_VERIFICATION_KEY = "ecclesiastical_statute_verification_v1";

function loadStatuteVerification(): Record<string, StatuteVerification> {
  try {
    const raw = window.localStorage.getItem(STATUTE_VERIFICATION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, StatuteVerification>;
  } catch {
    return {};
  }
}

function saveStatuteVerification(map: Record<string, StatuteVerification>) {
  window.localStorage.setItem(STATUTE_VERIFICATION_KEY, JSON.stringify(map));
}
type StateLegalPack = {
  utcAdopted: boolean;
  creationRefs: StateStatuteRef[];
  executionRefs?: StateStatuteRef[];
  fiduciaryRefs?: StateStatuteRef[];
  charitableRefs?: StateStatuteRef[];
  variationNotes: string[];
  enforcementLimits: string[];
};

// Note: These are *starting points* for attorney-curated citations. Verify current text and amendments.
const STATE_LEGAL_PACKS: Partial<Record<GoverningState, StateLegalPack>> = {
  CA: {
    utcAdopted: false,
    creationRefs: [
      {
        citation: "Cal. Prob. Code § 15200",
        description: "Methods of creating a trust",
        sourceLabel: "California Legislative Information (official)",
        sourceUrl:
          "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PROB&sectionNum=15200.",
        isOfficial: true,
      },
      {
        citation: "Cal. Prob. Code § 15201",
        description: "Intention to create trust",
        sourceLabel: "California Legislative Information (official)",
        sourceUrl:
          "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PROB&sectionNum=15201.",
        isOfficial: true,
      },
    ],
    variationNotes: ["California is not a UTC state; trusts are governed by the California Probate Code and common law."],
    enforcementLimits: ["Draft religious purpose clauses as expressive/precatory to avoid doctrinal adjudication."],
  },
  NY: {
    utcAdopted: false,
    creationRefs: [
      {
        citation: "EPTL § 7-1.17",
        description: "Execution, amendment and revocation of lifetime trusts",
        sourceLabel: "NYSenate (official)",
        sourceUrl: "https://www.nysenate.gov/legislation/laws/EPT/7-1.17",
        isOfficial: true,
      },
    ],
    variationNotes: ["New York is not a UTC state; EPTL formalities govern lifetime trusts."],
    enforcementLimits: ["Avoid doctrinal entanglement; keep religious language non-operative."],
  },
  TX: {
    utcAdopted: true,
    creationRefs: [
      {
        citation: "Tex. Prop. Code § 112.001",
        description: "Methods of creating trust",
        sourceLabel: "Texas Statutes (official)",
        sourceUrl: "https://statutes.capitol.texas.gov/Docs/PR/htm/PR.112.htm#112.001",
        isOfficial: true,
      },
      {
        citation: "Tex. Prop. Code § 112.002",
        description: "Intention to create trust",
        sourceLabel: "Texas Statutes (official)",
        sourceUrl: "https://statutes.capitol.texas.gov/Docs/PR/htm/PR.112.htm#112.002",
        isOfficial: true,
      },
    ],
    variationNotes: ["Texas Trust Code is codified in the Texas Property Code (Title 9)."],
    enforcementLimits: ["Religious purpose clauses should not conflict with fiduciary duties or public policy."],
  },
  FL: {
    utcAdopted: true,
    creationRefs: [
      {
        citation: "Fla. Stat. § 736.0401",
        description: "Methods of creating trust",
        sourceLabel: "Florida Legislature (official)",
        sourceUrl:
          "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0700-0799%2F0736%2FSections%2F0736.0401.html",
        isOfficial: true,
      },
    ],
    variationNotes: ["Florida Trust Code is codified in Chapter 736."],
    enforcementLimits: ["Use neutral-principles drafting; avoid civil-law displacement."],
  },
  GA: {
    utcAdopted: true,
    creationRefs: [
      {
        citation: "O.C.G.A. § 53-12-20",
        description: "Express trusts; writing/signature requirements",
        sourceLabel: "Public copy (unofficial; official O.C.G.A. is licensed)",
        sourceUrl: "https://law.justia.com/codes/georgia/title-53/chapter-12/article-2/section-53-12-20/",
        isOfficial: false,
      },
    ],
    variationNotes: ["Georgia’s trust code is UTC-aligned in many respects; confirm state-specific deviations."],
    enforcementLimits: ["Maintain neutral-principles posture; avoid drafting that requires doctrinal determinations."],
  },
  PA: {
    utcAdopted: true,
    creationRefs: [
      {
        citation: "20 Pa.C.S. § 7732 (UTC 402)",
        description: "Requirements for creation",
        sourceLabel: "PA General Assembly (official)",
        sourceUrl:
          "https://www.palegis.us/statutes/consolidated/view-statute?chpt=77&div=0&iFrame=true&sctn=32&subsctn=0&ttl=20&txtType=HTM",
        isOfficial: true,
      },
    ],
    variationNotes: ["Pennsylvania’s Uniform Trust Act is codified in Title 20, Chapter 77."],
    enforcementLimits: ["Draft religious purpose clauses to be enforceable under neutral civil principles."],
  },
};

function renderVerificationAppendix(state: GoverningState): {
  title: string;
  items: Array<{
    citation: string;
    section: string;
    verifier?: string;
    lastVerified?: string;
    sourceUrl?: string;
    isOfficial?: boolean;
    sourceLabel: string;
  }>;
} {
  const pack = STATE_LEGAL_PACKS[state];
  const vmap = loadStatuteVerification();

  const collect = (refs: StateStatuteRef[] | undefined, section: string) =>
    (refs ?? []).map((r) => {
      const vr = vmap[r.citation];
      return {
        citation: r.citation,
        section,
        verifier: vr?.verifier,
        lastVerified: vr?.lastVerified,
        sourceUrl: r.sourceUrl,
        isOfficial: r.isOfficial,
        sourceLabel: r.sourceLabel,
      };
    });

  const items = [
    ...collect(pack?.creationRefs, "Formation"),
    ...collect(pack?.executionRefs, "Execution"),
    ...collect(pack?.fiduciaryRefs, "Fiduciary"),
    ...collect(pack?.charitableRefs, "Charitable"),
  ];

  return {
    title: `Sources & Verification — ${state}`,
    items,
  };
}

function AnnotationsPage() {
  const storage = useLocalDraftStorage();
  const [draft] = useState<DraftModel>(() => storage.load() ?? defaultDraft());
  const state = (draft.governingState ?? "NY") as GoverningState;
  const pack = STATE_LEGAL_PACKS[state];

  const printRef = useRef<HTMLDivElement | null>(null);

  const [verificationMap, setVerificationMap] = useState<Record<string, StatuteVerification>>(() =>
    loadStatuteVerification()
  );
  useEffect(() => {
    saveStatuteVerification(verificationMap);
  }, [verificationMap]);

  const creationRefs = useMemo(() => {
    const refs = pack?.creationRefs ?? [];
    return refs.map((r) => ({ ...r, ...(verificationMap[r.citation] ?? {}) }));
  }, [pack?.creationRefs, verificationMap]);

  function updateVerification(citation: string, patch: Partial<StatuteVerification>) {
    setVerificationMap((prev) => {
      const base: StatuteVerification = prev[citation] ?? { citation };
      return {
        ...prev,
        [citation]: {
          ...base,
          ...patch,
        },
      };
    });
  }

  const utcAdopted = pack?.utcAdopted ?? false;
  const notes = pack?.variationNotes ?? [
    "No curated state pack found for this state yet. Add attorney-verified citations for your jurisdiction.",
  ];
  const limits = pack?.enforcementLimits ?? [
    "Use neutral-principles drafting; avoid doctrinal adjudication triggers.",
    "Trustee fiduciary duties remain governed by applicable statute and common law.",
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-6">
        <LegalGuardrailsCard />

        <Card className="rounded-2xl shadow-sm" ref={printRef}>
          <CardHeader>
            <CardTitle className="text-base">
              State Annotations — {state} {utcAdopted ? "(UTC-aligned)" : "(Non‑UTC)"}
            </CardTitle>
            <CardDescription>Attorney-curated notes and citations (verify current text and amendments).</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div className="rounded-2xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">Formation citations (starting points)</div>
                  <div className="text-xs text-muted-foreground">
                    Add verifier + last-verified dates for audit-ready file notes.
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const reviewer = promptReviewerName();
                    if (!reviewer) return;
                    const today = new Date().toISOString().slice(0, 10);
                    for (const r of creationRefs) {
                      updateVerification(r.citation, { verifier: reviewer, lastVerified: today });
                    }
                  }}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Mark Verified (Today)
                </Button>
              </div>

              {(pack?.creationRefs?.length ?? 0) > 0 ? (
                <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                  {creationRefs.map((r) => (
                    <li key={r.citation}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{r.citation}</span>
                        <span className="text-muted-foreground">— {r.description}</span>
                        {r.sourceUrl ? (
                          <a
                            href={r.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs underline text-muted-foreground hover:text-foreground"
                          >
                            Source ({r.isOfficial ? "official" : "public copy"})
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">Source ({r.sourceLabel})</span>
                        )}
                      </div>

                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <div className="grid gap-1">
                          <div className="text-xs font-medium text-foreground">Verifier</div>
                          <Input
                            className="h-8 rounded-2xl text-xs"
                            value={r.verifier ?? ""}
                            onChange={(e) => updateVerification(r.citation, { verifier: e.target.value })}
                            placeholder="e.g., J. Smith"
                          />
                        </div>
                        <div className="grid gap-1">
                          <div className="text-xs font-medium text-foreground">Last verified</div>
                          <Input
                            type="date"
                            className="h-8 rounded-2xl text-xs"
                            value={r.lastVerified ?? ""}
                            onChange={(e) => updateVerification(r.citation, { lastVerified: e.target.value })}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 text-sm text-muted-foreground">(No citations added for this state yet.)</div>
              )}
            </div>

            <div className="rounded-2xl border p-4">
              <div className="font-semibold">State variation notes</div>
              <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                {notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border p-4">
              <div className="font-semibold">Enforcement limits (neutral principles)</div>
              <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                {limits.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="sticky top-[86px] rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
            <CardDescription>Print for review</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!printRef.current) return;
                openPrintDialogFromNode(printRef.current, `State Annotations — ${state}`);
              }}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print for Legal Review
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CaseLawPage() {
  const storage = useLocalDraftStorage();
  const [draft] = useState<DraftModel>(() => storage.load() ?? defaultDraft());
  const [scope, setScope] = useState<"federal" | "state">("federal");
  const state = (draft.governingState ?? "NY") as GoverningState;
  const printRef = useRef<HTMLDivElement | null>(null);

  const federalCases = [
    {
      citation: "Jones v. Wolf, 443 U.S. 595 (1979)",
      holding: "Neutral principles may be applied to resolve church property disputes without deciding doctrine.",
      relevance: "Supports drafting that is enforceable under neutral civil principles; avoids doctrinal adjudication.",
    },
    {
      citation: "Presbyterian Church v. Hull Church, 393 U.S. 440 (1969)",
      holding: "Civil courts may not resolve church property disputes by interpreting religious doctrine.",
      relevance: "Reinforces the need to keep religious language precatory/non-operative for civil enforcement.",
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-6">
        <LegalGuardrailsCard />

        <Card className="rounded-2xl shadow-sm" ref={printRef}>
          <CardHeader>
            <CardTitle className="text-base">Case Law (neutral summaries)</CardTitle>
            <CardDescription>State-specific entries are attorney-curated; federal cases are neutral-principles touchpoints.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {scope === "state" ? (
              <div className="rounded-2xl border p-4 text-sm text-muted-foreground">
                No state-specific cases are preloaded. Add verified citations relevant to <span className="font-medium text-foreground">{state}</span> and your local practice.
              </div>
            ) : (
              federalCases.map((c) => (
                <div key={c.citation} className="rounded-2xl border p-4">
                  <div className="text-sm font-semibold">{c.citation}</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Holding:</span> {c.holding}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Relevance:</span> {c.relevance}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="sticky top-[86px] rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>Scope and print</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as any)}>
                <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="federal">Federal</SelectItem>
                  <SelectItem value="state">State (curated)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground">
              Governing state: <span className="font-medium text-foreground">{state}</span>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                if (!printRef.current) return;
                openPrintDialogFromNode(printRef.current, `Case Law — ${scope}`);
              }}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print for Legal Review
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TrusteeOnboardingPage() {
  const storage = useLocalDraftStorage();
  const [draft] = useState<DraftModel>(() => storage.load() ?? defaultDraft());
  const renderRef = useRef<HTMLDivElement | null>(null);
  const appendix = renderVerificationAppendix((draft.governingState ?? "NY") as GoverningState);

  async function exportPacketPDF() {
    const reviewer = promptReviewerName();
    if (!reviewer) return;
    appendLegalReviewEntry({ action: "export_pdf", scope: "Trustee Onboarding Packet", reviewer });
    const nextVersion = bumpVersion("trustee");
    lockDraft(reviewer, `Exported Trustee Packet v${nextVersion}`);
    if (!renderRef.current) return;
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
    const v = loadDraftLock().trusteePacketVersion;
    const mid = (draft.matterId || "").trim();
    const prefix = mid ? `${mid}-` : "";
    pdf.save(`${prefix}${draft.matterName || "Draft"}-TrusteeOnboardingPacket-v${v}.pdf`);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-6">
        <LegalGuardrailsCard />

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Corporate Trustee Onboarding Packet</CardTitle>
            <CardDescription>Bank-grade packet: authority, posture, and document checklist.</CardDescription>
          </CardHeader>
          <CardContent>
            <div ref={renderRef} className="grid gap-4">
              <div className="relative">
                <Watermark
                  text={`${(draft.matterId || "").trim()} • Trustee Packet v${loadDraftLock().trusteePacketVersion}`.trim()}
                />
                <DocumentBrandingHeader
                  firmName={draft.firmName}
                  firmEmail={draft.firmEmail}
                  firmPhone={draft.firmPhone}
                  firmAddress={draft.firmAddress}
                  disclaimer={draft.firmDisclaimer}
                  docTitle="Corporate Trustee Onboarding Packet"
                  matterName={draft.matterName || "(unnamed)"}
                  matterId={draft.matterId}
                  versionLabel={`Packet v${loadDraftLock().trusteePacketVersion} • ${new Date().toLocaleDateString()}`}
                />
                <div className="mt-2 text-sm text-muted-foreground">Governing law: {draft.governingState || "(none)"}</div>
              </div>

              <div className="rounded-2xl border p-6">
                <div className="text-lg font-semibold">Authority & Control</div>
                <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                  <li>The Trustee is the legal fiduciary with authority to administer trust property under applicable state law.</li>
                  <li>Religious/ecclesiastical language is included only to reflect purpose and does not alter fiduciary duties.</li>
                  <li>Distributions are made in accordance with the instrument and applicable fiduciary duties.</li>
                </ul>
              </div>

              <div className="rounded-2xl border p-6">
                <div className="text-lg font-semibold">Tax & EIN Position (to confirm)</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  EIN requirements are tax-posture- and custodian-dependent. Document custodian policy and trustee authority before account opening.
                </div>
              </div>

              <div className="rounded-2xl border p-6">
                <div className="text-lg font-semibold">Documents Checklist</div>
                <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                  <li>Trust agreement or trust certification</li>
                  <li>Trustee appointment and acceptance</li>
                  <li>Resolutions/minutes authorizing account opening and signatories</li>
                  <li>W-9/W-8 forms as applicable</li>
                  <li>Beneficial ownership / KYC questionnaires</li>
                </ul>
              </div>

              <div className="rounded-2xl border p-6">
                <div className="text-lg font-semibold">Sign-off</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border p-4">
                    <div className="text-xs text-muted-foreground">Prepared by</div>
                    <div className="mt-8 border-t pt-2 text-xs">Signature • Date</div>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <div className="text-xs text-muted-foreground">Reviewed by</div>
                    <div className="mt-8 border-t pt-2 text-xs">Signature • Date</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-6">
                <div className="text-lg font-semibold">{appendix.title}</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  This appendix records statute touchpoints and verification metadata (if entered) used by the workspace.
                </div>

                {appendix.items.length ? (
                  <div className="mt-3 grid gap-3">
                    {appendix.items.map((it) => (
                      <div key={it.section + it.citation} className="rounded-2xl border p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{it.section}</Badge>
                          <div className="text-sm font-semibold">{it.citation}</div>
                          <div className="text-xs text-muted-foreground">{it.sourceLabel}</div>
                        </div>
                        <div className="mt-2 grid gap-2 md:grid-cols-2 text-sm">
                          <div className="rounded-2xl border p-3">
                            <div className="text-xs text-muted-foreground">Verifier</div>
                            <div className="mt-1">{it.verifier || "(not recorded)"}</div>
                          </div>
                          <div className="rounded-2xl border p-3">
                            <div className="text-xs text-muted-foreground">Last verified</div>
                            <div className="mt-1">{it.lastVerified || "(not recorded)"}</div>
                          </div>
                        </div>
                        {it.sourceUrl ? (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Source: <span className="font-medium">{it.isOfficial ? "official" : "public copy"}</span> —{" "}
                            <span className="font-mono break-all">{it.sourceUrl}</span>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-muted-foreground">No statute pack is configured for the selected state.</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="sticky top-[86px] rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Export</CardTitle>
            <CardDescription>PDF / Print</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button onClick={exportPacketPDF}>
              <Download className="mr-2 h-4 w-4" />
              Export Packet PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!renderRef.current) return;
                openPrintDialogFromNode(renderRef.current, "Trustee Onboarding Packet");
              }}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print for Legal Review
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GuardrailsPage() {
  const printRef = useRef<HTMLDivElement | null>(null);

  const guardrails = [
    {
      trigger: "Claims of exemption or non-applicability of federal/state law",
      safeAlternative: "Use a non-interference clause and frame religious purpose as expressive intent.",
      rationale: "Banks/courts require civil-law compliance; exemption claims create enforceability and onboarding failures.",
    },
    {
      trigger: "Sovereignty / parallel jurisdiction framing",
      safeAlternative: "Anchor governance in state trust law; treat religious guidance as advisory/precatory.",
      rationale: "Civil enforceability relies on neutral principles; sovereignty claims are routinely rejected.",
    },
    {
      trigger: "Blanket “no EIN” statements",
      safeAlternative: "Treat EIN as custodian- and tax-posture-dependent; document policy in the custodian matrix.",
      rationale: "Reporting and KYC requirements often mandate an EIN even with a corporate trustee.",
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-6">
        <LegalGuardrailsCard />

        <Card className="rounded-2xl shadow-sm" ref={printRef}>
          <CardHeader>
            <CardTitle className="text-base">Guardrails</CardTitle>
            <CardDescription>Attorney-safe patterns that preserve enforceability and institutional acceptance.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {guardrails.map((g) => (
              <div key={g.trigger} className="rounded-2xl border p-4">
                <div className="text-sm font-semibold">Trigger</div>
                <div className="mt-1 text-sm text-muted-foreground">{g.trigger}</div>
                <Separator className="my-3" />
                <div className="text-sm font-semibold">Safe alternative</div>
                <div className="mt-1 text-sm text-muted-foreground">{g.safeAlternative}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Rationale:</span> {g.rationale}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="sticky top-[86px] rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
            <CardDescription>Print for review</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (!printRef.current) return;
                openPrintDialogFromNode(printRef.current, "Guardrails");
              }}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print for Legal Review
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function WizardPage() {
  const storage = useLocalDraftStorage();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<DraftModel>(() => storage.load() ?? defaultDraft());
  const [step, setStep] = useState(0);
  const renderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loadDraftLock().isLocked) storage.save(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const steps = useMemo(
    () =>
      [
        { key: "religious", title: "Religious Character & Purpose" },
        { key: "civil", title: "Civil Law Anchor" },
        { key: "parties", title: "Parties" },
        { key: "tax", title: "Tax Posture & EIN (Gate)" },
        { key: "assets", title: "Assets & Administration" },
        { key: "distribution", title: "Distribution Standard" },
        { key: "review", title: "Render Test & Export" },
      ] as const,
    []
  );

  const progress = Math.round(((step + 1) / steps.length) * 100);

  function addParty(role: PartyRole) {
    setDraft((p) => ({ ...p, parties: [...p.parties, { id: uuidv4(), role, name: "" }] }));
  }

  function updateParty(id: string, patch: Partial<Party>) {
    setDraft((p) => ({ ...p, parties: p.parties.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  }

  function removeParty(id: string) {
    setDraft((p) => ({ ...p, parties: p.parties.filter((x) => x.id !== id) }));
  }

  function addAsset() {
    setDraft((p) => ({
      ...p,
      assets: [
        ...p.assets,
        { id: uuidv4(), category: "Bank/Brokerage", description: "", approximateValue: "", titlingNotes: "" },
      ],
    }));
  }

  function updateAsset(id: string, patch: Partial<Asset>) {
    setDraft((p) => ({ ...p, assets: p.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
  }

  function removeAsset(id: string) {
    setDraft((p) => ({ ...p, assets: p.assets.filter((a) => a.id !== id) }));
  }

  async function exportToPDF() {
    if (!renderRef.current) return;
    const node = renderRef.current;
    const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: null });
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

    const safe = (draft.matterName || "EcclesiasticalTrust").replaceAll(/[^\w\-]+/g, "_");
    pdf.save(`${safe}-${draft.draftId.slice(0, 8)}.pdf`);
  }

  const corporateTrusteePresent = draft.parties.some((p) => p.role === "Corporate Trustee" && p.name.trim());
  const einGateError =
    draft.einStrategy === "use_corporate_trustee_ein" && !corporateTrusteePresent
      ? "If you choose “Use Corporate Trustee EIN”, add the Corporate Trustee in Parties (name required)."
      : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-6">
        <LegalGuardrailsCard />

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

        {steps[step].key === "religious" ? (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Religious Character & Purpose</CardTitle>
              <CardDescription>Capture purpose and internal governance references (without asserting civil immunity).</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label>Religious purpose statement</Label>
                <Textarea
                  className="min-h-[110px] rounded-2xl"
                  value={draft.religiousPurpose}
                  onChange={(e) => setDraft((p) => ({ ...p, religiousPurpose: e.target.value }))}
                  placeholder="Describe religious/charitable mission and governance intent in neutral, factual terms."
                />
              </div>
              <div className="grid gap-2">
                <Label>Affiliation (optional)</Label>
                <Input
                  className="rounded-2xl"
                  value={draft.affiliation}
                  onChange={(e) => setDraft((p) => ({ ...p, affiliation: e.target.value }))}
                  placeholder="e.g., denomination / congregation / ministry name"
                />
              </div>
              <div className="grid gap-2">
                <Label>Governing canons / bylaws notes (optional)</Label>
                <Textarea
                  className="min-h-[90px] rounded-2xl"
                  value={draft.governingCanonsNotes}
                  onChange={(e) => setDraft((p) => ({ ...p, governingCanonsNotes: e.target.value }))}
                  placeholder="Reference internal rules, minutes, bylaws, or canons (no uploads stored in localStorage by default)."
                />
              </div>
            </CardContent>
          </Card>
        ) : null}

        {steps[step].key === "civil" ? (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Civil Law Anchor</CardTitle>
              <CardDescription>Anchor the matter in state trust law—this is the controlling framework.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Governing state</Label>
                <Select value={draft.governingState ?? ""} onValueChange={(v) => setDraft((p) => ({ ...p, governingState: v as GoverningState }))}>
                  <SelectTrigger className="rounded-2xl"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {GOVERNING_STATES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Trust type</Label>
                <Select value={draft.trustType} onValueChange={(v) => setDraft((p) => ({ ...p, trustType: v as TrustType }))}>
                  <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revocable">Revocable</SelectItem>
                    <SelectItem value="irrevocable">Irrevocable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label>Formation method</Label>
                <Select value={draft.formationMethod} onValueChange={(v) => setDraft((p) => ({ ...p, formationMethod: v as FormationMethod }))}>
                  <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trust_agreement">Trust agreement</SelectItem>
                    <SelectItem value="declaration">Declaration of trust</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label>Matter name</Label>
                <Input className="rounded-2xl" value={draft.matterName} onChange={(e) => setDraft((p) => ({ ...p, matterName: e.target.value }))} />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label>Internal file number</Label>
                <Input className="rounded-2xl" value={draft.internalFileNumber} onChange={(e) => setDraft((p) => ({ ...p, internalFileNumber: e.target.value }))} />
              </div>
            </CardContent>
          </Card>
        ) : null}

        {steps[step].key === "parties" ? (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Parties</CardTitle>
              <CardDescription>Add/confirm parties. Add a Corporate Trustee if custody/EIN strategy requires it.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => addParty("Settlor/Grantor")}>Add Settlor/Grantor</Button>
                <Button size="sm" variant="outline" onClick={() => addParty("Trustee")}>Add Trustee</Button>
                <Button size="sm" variant="outline" onClick={() => addParty("Corporate Trustee")}>Add Corporate Trustee</Button>
                <Button size="sm" variant="outline" onClick={() => addParty("Successor Trustee")}>Add Successor Trustee</Button>
                <Button size="sm" variant="outline" onClick={() => addParty("Beneficiary")}>Add Beneficiary</Button>
                <Button size="sm" variant="outline" onClick={() => addParty("Protector / Advisory Council")}>Add Protector/Advisory Council</Button>
              </div>

              <div className="grid gap-3">
                {draft.parties.map((p) => (
                  <Card key={p.id} className="rounded-2xl">
                    <CardContent className="grid gap-3 pt-6">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary">{p.role}</Badge>
                        <Button variant="ghost" size="sm" onClick={() => removeParty(p.id)}>Remove</Button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>Name</Label>
                          <Input className="rounded-2xl" value={p.name} onChange={(e) => updateParty(p.id, { name: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Role</Label>
                          <Select value={p.role} onValueChange={(v) => updateParty(p.id, { role: v as PartyRole })}>
                            <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Settlor/Grantor">Settlor/Grantor</SelectItem>
                              <SelectItem value="Trustee">Trustee</SelectItem>
                              <SelectItem value="Corporate Trustee">Corporate Trustee</SelectItem>
                              <SelectItem value="Successor Trustee">Successor Trustee</SelectItem>
                              <SelectItem value="Beneficiary">Beneficiary</SelectItem>
                              <SelectItem value="Protector / Advisory Council">Protector / Advisory Council</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label>Email (optional)</Label>
                          <Input className="rounded-2xl" value={p.email ?? ""} onChange={(e) => updateParty(p.id, { email: e.target.value })} />
                        </div>
                        <div className="grid gap-2">
                          <Label>Phone (optional)</Label>
                          <Input className="rounded-2xl" value={p.phone ?? ""} onChange={(e) => updateParty(p.id, { phone: e.target.value })} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {steps[step].key === "tax" ? (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Tax Posture & EIN (Decision Gate)</CardTitle>
              <CardDescription>Pick the posture and an EIN strategy. The UI will flag missing prerequisites.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Tax posture</Label>
                  <Select value={draft.taxPosture} onValueChange={(v) => setDraft((p) => ({ ...p, taxPosture: v as TaxPosture }))}>
                    <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unsure">Unsure (needs counsel)</SelectItem>
                      <SelectItem value="grantor">Grantor trust (IRC §§671–679 likely)</SelectItem>
                      <SelectItem value="non_grantor">Non‑grantor trust</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>EIN strategy</Label>
                  <Select value={draft.einStrategy} onValueChange={(v) => setDraft((p) => ({ ...p, einStrategy: v as EinStrategy }))}>
                    <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unsure">Unsure</SelectItem>
                      <SelectItem value="use_corporate_trustee_ein">Use corporate trustee EIN (custodian‑dependent)</SelectItem>
                      <SelectItem value="apply_for_trust_ein">Apply for trust EIN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Custody model</Label>
                <Select value={draft.custodyModel} onValueChange={(v) => setDraft((p) => ({ ...p, custodyModel: v as CustodyModel }))}>
                  <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unsure">Unsure</SelectItem>
                    <SelectItem value="corporate_trustee">Corporate trustee administers accounts</SelectItem>
                    <SelectItem value="third_party_custodian">Third‑party custodian</SelectItem>
                    <SelectItem value="self_custody">Self‑custody (high‑risk operationally)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {einGateError ? (
                <Alert className="border-red-700/50 bg-red-900/20">
                  <AlertDescription className="text-red-300">{einGateError}</AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-cyan-700/50 bg-cyan-900/20">
                  <AlertDescription className="text-cyan-300">
                    This module is a checklist prompt. Confirm EIN/tax posture with counsel and custodian policy.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ) : null}

        {steps[step].key === "assets" ? (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Assets & Administration</CardTitle>
              <CardDescription>Capture assets and administration notes (custody, titling, evidence).</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={addAsset}>Add asset</Button>
                <div className="text-xs text-muted-foreground">{draft.assets.length} item(s)</div>
              </div>
              {draft.assets.length === 0 ? (
                <div className="rounded-2xl border p-6 text-sm text-muted-foreground">Add assets to generate administration tasks.</div>
              ) : (
                <div className="grid gap-3">
                  {draft.assets.map((a) => (
                    <Card key={a.id} className="rounded-2xl">
                      <CardContent className="grid gap-3 pt-6">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary">{a.category}</Badge>
                          <Button variant="ghost" size="sm" onClick={() => removeAsset(a.id)}>Remove</Button>
                        </div>
                        <div className="grid gap-2">
                          <Label>Description</Label>
                          <Input className="rounded-2xl" value={a.description} onChange={(e) => updateAsset(a.id, { description: e.target.value })} />
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
                            <Input className="rounded-2xl" value={a.approximateValue ?? ""} onChange={(e) => updateAsset(a.id, { approximateValue: e.target.value })} />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label>Titling / custody notes</Label>
                          <Textarea className="min-h-[90px] rounded-2xl" value={a.titlingNotes ?? ""} onChange={(e) => updateAsset(a.id, { titlingNotes: e.target.value })} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {steps[step].key === "distribution" ? (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Distribution Standard</CardTitle>
              <CardDescription>Record how distributions are governed (minutes/resolutions reference is recommended).</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label>Distribution standard</Label>
                <Select value={draft.distributionStandard} onValueChange={(v) => setDraft((p) => ({ ...p, distributionStandard: v as DistributionStandard }))}>
                  <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unsure">Unsure</SelectItem>
                    <SelectItem value="discretionary">Discretionary</SelectItem>
                    <SelectItem value="ascertainable">Ascertainable standard (e.g., HEMS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Minutes & resolutions reference</Label>
                <Input className="rounded-2xl" value={draft.minutesAndResolutionsRef} onChange={(e) => setDraft((p) => ({ ...p, minutesAndResolutionsRef: e.target.value }))} placeholder="e.g., Board minutes dated YYYY‑MM‑DD" />
              </div>
              <Separator />
              <div className="grid gap-2">
                <div className="text-sm font-semibold">Validator inputs (optional)</div>
                <div className="text-xs text-muted-foreground">
                  These toggles help the Validator page flag potential review issues. They are not legal conclusions.
                </div>
              </div>
              <div className="grid gap-2 rounded-2xl border p-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.validatorInputs.trusteeIndependenceClaimed}
                    onCheckedChange={(v) =>
                      setDraft((p) => ({
                        ...p,
                        validatorInputs: { ...p.validatorInputs, trusteeIndependenceClaimed: Boolean(v) },
                      }))
                    }
                  />
                  Trustee independence is claimed/important
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.validatorInputs.mandatoryDistributions}
                    onCheckedChange={(v) =>
                      setDraft((p) => ({
                        ...p,
                        validatorInputs: { ...p.validatorInputs, mandatoryDistributions: Boolean(v) },
                      }))
                    }
                  />
                  Mandatory distributions are contemplated
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.validatorInputs.retainedControlOrVeto}
                    onCheckedChange={(v) =>
                      setDraft((p) => ({
                        ...p,
                        validatorInputs: { ...p.validatorInputs, retainedControlOrVeto: Boolean(v) },
                      }))
                    }
                  />
                  Retained control / veto / approval rights contemplated
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.validatorInputs.separateTrustAccounting}
                    onCheckedChange={(v) =>
                      setDraft((p) => ({
                        ...p,
                        validatorInputs: { ...p.validatorInputs, separateTrustAccounting: Boolean(v) },
                      }))
                    }
                  />
                  Separate trust accounting planned
                </label>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {steps[step].key === "review" ? (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Render Test & Export</CardTitle>
              <CardDescription>Clean summary for review and export to PDF.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Status: {draft.status.replaceAll("_", " ")}</Badge>
                  <Button size="sm" variant="outline" onClick={() => setDraft((p) => ({ ...p, status: p.status === "ready_for_review" ? "in_progress" : "ready_for_review" }))}>
                    Toggle Ready for Review
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigate("/compliance")}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Compliance
                  </Button>
                  <Button size="sm" onClick={exportToPDF}>
                    <Download className="mr-2 h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="rounded-2xl border bg-background p-6" ref={renderRef}>
                <RenderTestDocument draft={draft} />
              </div>
              <div className="text-xs text-muted-foreground">
                Export tip: keep this panel free of interactive UI. The PDF export captures this element.
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
            disabled={step === steps.length - 1 || !!einGateError}
          >
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <ComplianceRail draft={draft} />
      </div>
    </div>
  );
}

function RenderTestDocument({ draft }: { draft: DraftModel }) {
  const corporateTrustee = draft.parties.find((p) => p.role === "Corporate Trustee")?.name || "(not specified)";
  const trustee = draft.parties.find((p) => p.role === "Trustee")?.name || "(not specified)";
  const settlor = draft.parties.find((p) => p.role === "Settlor/Grantor")?.name || "(not specified)";

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-lg font-semibold">{draft.matterName || "Ecclesiastical Trust Matter"}</div>
          <div className="text-sm text-muted-foreground">
            Governing law: {draft.governingState || "(select state)"} • Trust type: {draft.trustType} • Formation:{" "}
            {draft.formationMethod === "trust_agreement" ? "Trust agreement" : "Declaration"}
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
        <div className="text-sm font-semibold">Religious character & purpose</div>
        <div className="whitespace-pre-wrap rounded-2xl border p-4 text-sm text-muted-foreground">
          {draft.religiousPurpose || "(not provided)"}
        </div>
        {draft.affiliation.trim() ? (
          <div className="text-xs text-muted-foreground">Affiliation: {draft.affiliation}</div>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border p-4">
          <div className="text-sm font-semibold">Key parties</div>
          <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
            <div><span className="font-medium text-foreground">Settlor/Grantor:</span> {settlor}</div>
            <div><span className="font-medium text-foreground">Trustee:</span> {trustee}</div>
            <div><span className="font-medium text-foreground">Corporate Trustee:</span> {corporateTrustee}</div>
          </div>
        </div>
        <div className="rounded-2xl border p-4">
          <div className="text-sm font-semibold">Tax & administration</div>
          <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
            <div><span className="font-medium text-foreground">Tax posture:</span> {draft.taxPosture.replaceAll("_", " ")}</div>
            <div><span className="font-medium text-foreground">EIN strategy:</span> {draft.einStrategy.replaceAll("_", " ")}</div>
            <div><span className="font-medium text-foreground">Custody model:</span> {draft.custodyModel.replaceAll("_", " ")}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="text-sm font-semibold">Assets (summary)</div>
        <div className="rounded-2xl border p-4">
          {draft.assets.length === 0 ? (
            <div className="text-sm text-muted-foreground">(no assets captured)</div>
          ) : (
            <div className="grid gap-3">
              {draft.assets.map((a) => (
                <div key={a.id} className="rounded-2xl border p-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">{a.description || "(untitled asset)"}</div>
                      <div className="text-xs text-muted-foreground">{a.category}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">{a.approximateValue || ""}</div>
                  </div>
                  {a.titlingNotes?.trim() ? (
                    <div className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{a.titlingNotes}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3">
        <div className="text-sm font-semibold">Distribution standard</div>
        <div className="rounded-2xl border p-4 text-sm text-muted-foreground">
          <div>Standard: {draft.distributionStandard.replaceAll("_", " ")}</div>
          <div>Minutes/resolutions: {draft.minutesAndResolutionsRef || "(not provided)"}</div>
        </div>
      </div>

      {draft.attorneyNotes.trim() ? (
        <div className="grid gap-3">
          <div className="text-sm font-semibold">Attorney notes</div>
          <div className="whitespace-pre-wrap rounded-2xl border p-4 text-sm text-muted-foreground">{draft.attorneyNotes}</div>
        </div>
      ) : null}

      <div className="pt-2 text-xs text-muted-foreground">
        Prepared via Ecclesiastical Trust Workspace • For internal workflow use
      </div>
    </div>
  );
}

export function EcclesiasticalTrustApp() {
  return (
    <Router basename="/ecclesiastical">
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/wizard" element={<WizardPage />} />
          <Route path="/compliance" element={<CompliancePage />} />
          <Route path="/validator" element={<ValidatorPage />} />
          <Route path="/custodians" element={<CustodiansPage />} />
          <Route path="/clauses" element={<ClausesPage />} />
          <Route path="/memo" element={<MemoPage />} />
          <Route path="/annotations" element={<AnnotationsPage />} />
          <Route path="/caselaw" element={<CaseLawPage />} />
          <Route path="/trustee-onboarding" element={<TrusteeOnboardingPage />} />
          <Route path="/guardrails" element={<GuardrailsPage />} />
        </Routes>
      </AppShell>
    </Router>
  );
}


