import type { JarvaEntryIntent } from "@/lib/jarva/jarva-entry-router";

const ENTRY_INTENTS: JarvaEntryIntent[] = [
  "trust_general",
  "trust_revocable",
  "trust_irrevocable",
  "trust_ecclesiastical",
  "trust_certificate",
  "trust_ppm",
  "trust_bond",
  "trust_estate",
  "unknown",
];

export function parseJarvaEntryIntent(v: unknown): JarvaEntryIntent | null {
  if (typeof v !== "string") return null;
  return ENTRY_INTENTS.includes(v as JarvaEntryIntent) ? (v as JarvaEntryIntent) : null;
}

export function parseJarvaTrustStyleHint(v: unknown): JarvaTrustStyleHintUi | null {
  if (v === "revocable" || v === "irrevocable" || v === "ecclesiastical") return v;
  return null;
}

export type JarvaTrustStyleHintUi = "revocable" | "irrevocable" | "ecclesiastical";

export type JarvaChatUiAction =
  | { kind: "link"; label: string; href: string }
  | { kind: "chat"; label: string; message: string };

/** Messages aligned with `classifyJarvaEntry` (revocable / irrevocable / ecclesiastical keywords). */
export const JARVA_TRUST_TYPE_CHOICE_BUTTONS: Array<{ label: string; message: string }> = [
  { label: "Revocable Trust", message: "Revocable trust" },
  { label: "Irrevocable Trust", message: "Irrevocable trust" },
  { label: "Ecclesiastical Trust", message: "Ecclesiastical trust" },
];

const SPECIALTY_INTENTS: JarvaEntryIntent[] = [
  "trust_certificate",
  "trust_ppm",
  "trust_bond",
  "trust_estate",
];

export function isJarvaSpecialtyEntryIntent(intent: JarvaEntryIntent | undefined | null): boolean {
  if (!intent) return false;
  return SPECIALTY_INTENTS.includes(intent);
}

/** Entry-routing fast actions must not compete with trust-bound workspace UI (FloatingNPCChat). */
export function shouldShowJarvaTrustTypeButtons(
  npcId: string,
  needsTrustTypeChoice: boolean,
  trustWorkspaceActive: boolean
): boolean {
  return npcId === "trust-advisor" && needsTrustTypeChoice && !trustWorkspaceActive;
}

function trustRecordsHref(trustId: string | null | undefined, tab?: string): string {
  const tid = trustId?.trim();
  const sp = new URLSearchParams();
  if (tid) sp.set("trustId", tid);
  if (tab) sp.set("tab", tab);
  const q = sp.toString();
  return q ? `/trust-records?${q}` : "/trust-records";
}

/**
 * Contextual links + one chat continuation — routes exist under `src/app/trust-records`, `/smart-trust`, `/ecclesiastical`, `trusts/[trustId]/issue-security`.
 */
export function buildJarvaSpecialtyActions(
  intent: JarvaEntryIntent,
  trustId: string | null | undefined
): JarvaChatUiAction[] {
  const tid = trustId?.trim() || undefined;
  const continueChat: JarvaChatUiAction = {
    kind: "chat",
    label: "Continue intake with Jarva",
    message: "Continue intake with Jarva on this topic.",
  };

  switch (intent) {
    case "trust_certificate":
      return [
        { kind: "link", label: "Open Trust Records", href: trustRecordsHref(tid, "issue") },
        ...(tid
          ? [
              {
                kind: "link" as const,
                label: "Issue / securities",
                href: `/trusts/${encodeURIComponent(tid)}/issue-security`,
              },
            ]
          : []),
        continueChat,
      ];
    case "trust_ppm":
      return [
        { kind: "link", label: "Open Issue / Securities", href: trustRecordsHref(tid, "issue") },
        { kind: "link", label: "Open Smart Trust", href: tid ? `/smart-trust?trustId=${encodeURIComponent(tid)}` : "/smart-trust" },
        continueChat,
      ];
    case "trust_bond":
      return [
        { kind: "link", label: "Open Bonds area", href: trustRecordsHref(tid, "bonds") },
        continueChat,
      ];
    case "trust_estate":
      return [
        { kind: "link", label: "Open Estate / Will", href: "/trust-records/estate/will" },
        { kind: "link", label: "Open Estate tab", href: trustRecordsHref(tid, "estate") },
        ...(tid
          ? [
              {
                kind: "link" as const,
                label: "Jarva intake (this trust)",
                href: `/trust-records/jarva?trustId=${encodeURIComponent(tid)}`,
              },
            ]
          : []),
        continueChat,
      ];
    default:
      return [];
  }
}

export function jarvaTrustStyleHintLabel(h: JarvaTrustStyleHintUi): string {
  switch (h) {
    case "revocable":
      return "Revocable";
    case "irrevocable":
      return "Irrevocable";
    case "ecclesiastical":
      return "Ecclesiastical";
    default:
      return "";
  }
}

/** Short label for API `jarvaWorkflowPath` (e.g. trust_revocable → revocable). */
export function formatJarvaWorkflowLaneLabel(path: string): string {
  return path.replace(/^trust_/, "").replace(/_/g, " ");
}

export function jarvaWorkflowPathSourceLabel(
  source:
    | "explicit_turn"
    | "sticky_session"
    | "transcript_fallback"
    | "lane_control"
    | "lane_clear"
    | null
    | undefined
): string {
  if (source === "sticky_session") return "Session";
  if (source === "explicit_turn") return "This turn";
  if (source === "transcript_fallback") return "Transcript";
  if (source === "lane_control") return "Lane control";
  if (source === "lane_clear") return "Cleared";
  return "";
}

export function jarvaTrustStyleHintChipClass(h: JarvaTrustStyleHintUi): string {
  switch (h) {
    case "revocable":
      return "border-emerald-500/40 bg-emerald-950/40 text-emerald-200/90";
    case "irrevocable":
      return "border-amber-500/40 bg-amber-950/35 text-amber-200/90";
    case "ecclesiastical":
      return "border-violet-500/40 bg-violet-950/40 text-violet-200/90";
    default:
      return "border-slate-600 bg-slate-800/80 text-slate-300";
  }
}
