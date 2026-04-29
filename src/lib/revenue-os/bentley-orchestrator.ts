/**
 * Bentley — phase-aware workflow governor for AI Revenue OS.
 * Deterministic parsing (no LLM). Shared state is the single source of truth.
 */

import type { IndustryKey } from "@/lib/revenue-os/industry-profiles";
import { INDUSTRY_OPTIONS, INDUSTRY_PROFILES } from "@/lib/revenue-os/industry-profiles";
import type { ClientReadinessAnswers } from "@/components/ai-revenue-os/ClientReadinessQuestionnaire";
import type { SocialPlatform } from "@/lib/social/config";
import { parsePostingPlatformsFromUserText } from "@/lib/revenue-os/bentley-posting-platforms";
import type { BentleyFieldKey, BentleySectionId, BentleyWorkflowPhase, BentleyChecklistId } from "./bentley-flow-types";
import { parsePercentFromUserText } from "./percent-input";

export const BENTLEY_INTRO_EXACT =
  "I'm Bentley. I surface trending content from YouTube, TikTok, and Reddit to help consultants shape campaign strategy based on what's resonating in the market. What industry are we working on today?";

/** Required for “ready” (business-critical) */
export const BENTLEY_REQUIRED_ORDER: BentleyFieldKey[] = [
  "industryKey",
  "targetAudience",
  "businessName",
  "coreOffer",
  "transformation",
  "postingPlatforms",
  "platforms",
];

/** Optional metrics & refinements */
export const BENTLEY_OPTIONAL_ORDER: BentleyFieldKey[] = [
  "traffic",
  "conversionRate",
  "aov",
  "tone",
  "contentType",
  "imageStyle",
  "campaignNotes",
];

/**
 * Conversation order: Intake → Revenue (optional) → Content profile → Campaign notes.
 * Same keys as required/optional combined in workflow order (not alphabetical).
 */
export const BENTLEY_PROMPT_ORDER: BentleyFieldKey[] = [
  "industryKey",
  "targetAudience",
  "traffic",
  "conversionRate",
  "aov",
  "businessName",
  "coreOffer",
  "transformation",
  "postingPlatforms",
  "platforms",
  "tone",
  "contentType",
  "imageStyle",
  "campaignNotes",
];

const TONES = [
  "Professional",
  "Bold",
  "Educational",
  "Luxury",
  "Conversational",
  "Authoritative",
  "Playful",
  "Inspirational",
] as const;

const CONTENT_TYPES = [
  "Full Post",
  "Caption Only",
  "Image Prompt",
  "Viral Content Idea",
  "Hooks",
] as const;

const IMAGE_STYLES = ["cinematic", "bold", "minimal", "vibrant", "dark", "neon"] as const;

const PLATFORM_LABELS_CANON = [
  "Instagram",
  "TikTok",
  "X (Twitter)",
  "LinkedIn",
  "YouTube",
  "Facebook",
  "Other",
] as const;

const DEFAULT_TONE = "Professional";
const DEFAULT_CONTENT_TYPE = "Full Post";
const DEFAULT_IMAGE_STYLE = "cinematic";

export interface BentleyOptionalAck {
  traffic?: boolean;
  conversion?: boolean;
  aov?: boolean;
  tone?: boolean;
  contentType?: boolean;
  imageStyle?: boolean;
  campaignNotes?: boolean;
}

/** Deterministic staged pipeline — persisted on `BentleySnapshot.pipeline`. */
export interface BentleyPipelineStageState {
  intakeComplete: boolean;
  analysisComplete: boolean;
  contentGenerated: boolean;
  campaignGenerated: boolean;
  launchReady: boolean;
}

export const DEFAULT_PIPELINE_STAGES: BentleyPipelineStageState = {
  intakeComplete: false,
  analysisComplete: false,
  contentGenerated: false,
  campaignGenerated: false,
  launchReady: false,
};

/** Launch Campaign / first-post prefill — derived from campaign + content pipeline, not ad-hoc UI. */
export interface BentleyLaunchPrefill {
  campaignName?: string;
  caption?: string;
  hooks?: string;
  cta?: string;
  /** Comma-separated strategy platforms for display */
  platformsLabel?: string;
}

export interface BentleySnapshot {
  industryKey: IndustryKey | null;
  /** Free-text industry (Content Engine / campaign); may stand alone if no canonical key */
  contentIndustry: string;
  targetAudience: string;
  traffic: number;
  conversionRate: number;
  aov: number;
  businessName: string;
  coreOffer: string;
  transformation: string;
  platforms: string[];
  tone: string;
  contentType: string;
  imageStyle: string;
  campaignNotes: string;
  /** OAuth-connectable networks the user will post to (canonical intent). */
  postingPlatforms: SocialPlatform[];
  /** User skipped optional prompt (still uses page defaults) */
  skipTraffic?: boolean;
  skipConversion?: boolean;
  skipAov?: boolean;
  skipTone?: boolean;
  skipContentType?: boolean;
  skipImageStyle?: boolean;
  skipCampaignNotes?: boolean;
  /** Bentley or manual acknowledgment for optional UX fields */
  optionalAck?: BentleyOptionalAck;
  /**
   * Staged workflow flags. When `intakeComplete === true`, guided chat must **not** re-ask intake
   * (industry, etc.) — use `getGuidedMissingField` / `resumePipeline` instead of `getFirstMissingField`.
   */
  pipeline?: Partial<BentleyPipelineStageState>;
  /** Copy assets for Launch Campaign when `campaignGenerated` */
  launchPrefill?: BentleyLaunchPrefill;
}

export function industryResolved(s: BentleySnapshot): boolean {
  if (s.industryKey != null) return true;
  return (s.contentIndustry?.trim().length ?? 0) > 0;
}

function isSkipMessage(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return (
    /^(skip|pass|next|no|n\/a|none|later|defaults?|keep(\s+default)?|not\s+now)$/i.test(t) ||
    t === "same" ||
    t === "—" ||
    t === "-"
  );
}

/** Enhanced match to canonical industry keys */
export function parseIndustryKey(text: string): IndustryKey | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  const collapse = (s: string) => s.replace(/[\s_-]+/g, " ").trim();

  for (const opt of INDUSTRY_OPTIONS) {
    const lv = opt.label.toLowerCase();
    const vk = collapse(opt.value.replace(/_/g, " ").toLowerCase());
    const lvShort = lv.replace(/[^a-z0-9\s]/g, "");
    const tClean = collapse(t.replace(/[^a-z0-9\s]/g, ""));

    if (t === opt.value || t === lv || tClean === lvShort) return opt.value;
    if (t.includes(lv) || (lv.length > 4 && t.includes(lv.slice(0, Math.min(lv.length, 12))))) return opt.value;
    if (vk.length > 3 && (t.includes(vk) || tClean.includes(vk.replace(/\s/g, "")))) return opt.value;
  }

  const synonyms: [RegExp, IndustryKey][] = [
    [/b2b\s*(saas|software)?|enterprise\s*software/, "saas"],
    [/software\s*dev|app\s*dev|development\s*agency/, "software_development"],
    [/marketing\s*agency|digital\s*agency/, "marketing_agency"],
    [/law\s*firm|attorney|legal\s*services/, "law"],
    [/cpa|accounting|bookkeeping/, "accounting"],
    [/e-?commerce|online\s*store|dtc|shopify|amazon\s*seller/, "ecommerce"],
    [/consult(ant|ing)?|advisory/, "consulting"],
    [/coach(ing)?|mentor/, "coaching"],
    [/fitness|gym|personal\s*training/, "fitness"],
    [/real\s*estate|realtor|broker(?!age)/, "real_estate_residential"],
    [/fintech|payments|lending\s*tech/, "fintech"],
    [/health\s*tech|med\s*tech/, "health_tech"],
    [/saas|software\s*as\s*a\s*service/, "saas"],
  ];
  for (const [re, key] of synonyms) {
    if (re.test(t)) return key;
  }

  if (t.includes("consult")) return "consulting";
  if (t.includes("saas") || t.includes("software as a service")) return "saas";
  if (t.includes("ecommerce") || t.includes("e-commerce") || t.includes("shopify")) return "ecommerce";
  if (t.includes("coach")) return "coaching";
  return null;
}

export type ResolveIndustryResult =
  | { kind: "canonical"; industryKey: IndustryKey; label: string }
  | { kind: "freeform"; freeText: string }
  | { kind: "empty" };

/**
 * Map natural language to a canonical industry when possible; otherwise preserve freeform text
 * for contentIndustry (dropdown may stay empty / null key).
 */
export function resolveIndustryValue(text: string): ResolveIndustryResult {
  const raw = text.trim();
  if (!raw) return { kind: "empty" };

  const key = parseIndustryKey(raw);
  if (key) {
    const profile = INDUSTRY_PROFILES[key];
    const label =
      profile?.label ??
      INDUSTRY_OPTIONS.find((o) => o.value === key)?.label ??
      key.replace(/_/g, " ");
    return { kind: "canonical", industryKey: key, label };
  }

  return { kind: "freeform", freeText: raw };
}

function parseNumberLoose(text: string): number | null {
  const cleaned = text.replace(/[$,]/g, "").replace(/%/g, "").trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parsePlatforms(text: string): string[] {
  const parts = text.split(/[,/&]| and /i).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const low = p.toLowerCase();
    if (low.includes("instagram") || low === "ig") out.push("Instagram");
    else if (low.includes("tiktok") || low.includes("tik tok")) out.push("TikTok");
    else if (low.includes("linkedin")) out.push("LinkedIn");
    else if (low.includes("youtube") || low === "yt") out.push("YouTube");
    else if (low.includes("twitter") || low === "x" || /\bx\b/.test(low)) out.push("X (Twitter)");
    else if (low.includes("facebook") || low === "fb") out.push("Facebook");
    else {
      const match = PLATFORM_LABELS_CANON.find((c) => c.toLowerCase() === p.toLowerCase());
      if (match) out.push(match);
    }
  }
  return [...new Set(out)];
}

function matchEnum<T extends readonly string[]>(text: string, options: T): T[number] | null {
  const t = text.trim().toLowerCase();
  for (const o of options) {
    if (t === o.toLowerCase() || t.includes(o.toLowerCase())) return o;
  }
  return null;
}

function ack(s: BentleySnapshot, key: keyof BentleyOptionalAck): boolean {
  return Boolean(s.optionalAck?.[key]);
}

function optionalFieldSatisfied(s: BentleySnapshot, key: BentleyFieldKey): boolean {
  switch (key) {
    case "traffic":
      return s.traffic > 0 || s.skipTraffic === true || ack(s, "traffic");
    case "conversionRate":
      return s.conversionRate > 0 || s.skipConversion === true || ack(s, "conversion");
    case "aov":
      return s.aov > 0 || s.skipAov === true || ack(s, "aov");
    case "tone":
      return (
        s.skipTone === true ||
        ack(s, "tone") ||
        (s.tone !== DEFAULT_TONE && Boolean(s.tone))
      );
    case "contentType":
      return (
        s.skipContentType === true ||
        ack(s, "contentType") ||
        (s.contentType !== DEFAULT_CONTENT_TYPE && Boolean(s.contentType))
      );
    case "imageStyle":
      return (
        s.skipImageStyle === true ||
        ack(s, "imageStyle") ||
        (s.imageStyle !== DEFAULT_IMAGE_STYLE && Boolean(s.imageStyle))
      );
    case "campaignNotes":
      return (
        structuredGuidedIntakeCompleteForCampaign(s) ||
        (s.campaignNotes?.trim().length ?? 0) > 0 ||
        s.skipCampaignNotes === true ||
        ack(s, "campaignNotes")
      );
    default:
      return true;
  }
}

function requiredFieldSatisfied(s: BentleySnapshot, key: BentleyFieldKey): boolean {
  switch (key) {
    case "industryKey":
      return industryResolved(s);
    case "targetAudience":
      return (s.targetAudience?.trim().length ?? 0) > 0;
    case "businessName":
      return (s.businessName ?? "").trim().length > 0;
    case "coreOffer":
      return (s.coreOffer ?? "").trim().length > 0;
    case "transformation":
      return (s.transformation ?? "").trim().length > 0;
    case "postingPlatforms":
      return Array.isArray(s.postingPlatforms) && s.postingPlatforms.length > 0;
    case "platforms":
      return Array.isArray(s.platforms) && s.platforms.length > 0;
    default:
      return optionalFieldSatisfied(s, key);
  }
}

export function fieldSatisfied(s: BentleySnapshot, key: BentleyFieldKey): boolean {
  if (BENTLEY_REQUIRED_ORDER.includes(key)) return requiredFieldSatisfied(s, key);
  if (BENTLEY_OPTIONAL_ORDER.includes(key)) return optionalFieldSatisfied(s, key);
  return true;
}

export function getFirstMissingField(s: BentleySnapshot): BentleyFieldKey | null {
  for (const key of BENTLEY_PROMPT_ORDER) {
    if (!fieldSatisfied(s, key)) return key;
  }
  return null;
}

/** True when persisted pipeline says intake is done — overrides missing-field detection for intake prompts. */
export function pipelineIntakeAuthoritative(s: BentleySnapshot): boolean {
  return s.pipeline?.intakeComplete === true;
}

/**
 * Field-level guided prompts only apply **before** pipeline intake is marked complete.
 * After `pipeline.intakeComplete`, returns `null` so Bentley never falls back to industry/intake questions.
 */
export function getGuidedMissingField(s: BentleySnapshot): BentleyFieldKey | null {
  if (pipelineIntakeAuthoritative(s)) return null;
  return getFirstMissingField(s);
}

export function mergePipelineStages(
  base: Partial<BentleyPipelineStageState> | undefined,
  patch: Partial<BentleyPipelineStageState> | undefined
): BentleyPipelineStageState {
  const d = DEFAULT_PIPELINE_STAGES;
  const a = { ...d, ...base };
  const p = patch ?? {};
  /** Monotonic OR — persisted / hydrated true flags must not be cleared by a later partial patch. */
  return {
    intakeComplete: Boolean(a.intakeComplete || p.intakeComplete),
    analysisComplete: Boolean(a.analysisComplete || p.analysisComplete),
    contentGenerated: Boolean(a.contentGenerated || p.contentGenerated),
    campaignGenerated: Boolean(a.campaignGenerated || p.campaignGenerated),
    launchReady: Boolean(a.launchReady || p.launchReady),
  };
}

/** Intake satisfied for automation — persisted pipeline flag OR legacy field checks. */
export function effectiveIntakeReadyForAutomation(s: BentleySnapshot): boolean {
  return pipelineIntakeAuthoritative(s) || intakeComplete(s);
}

/** Intake = industry + audience */
export function intakeComplete(s: BentleySnapshot): boolean {
  return industryResolved(s) && (s.targetAudience?.trim().length ?? 0) > 0;
}

/** Revenue optional block complete */
export function revenueOptionalComplete(s: BentleySnapshot): boolean {
  return (
    optionalFieldSatisfied(s, "traffic") &&
    optionalFieldSatisfied(s, "conversionRate") &&
    optionalFieldSatisfied(s, "aov")
  );
}

/** Content required + optional (tone / type / image) */
export function contentProfileComplete(s: BentleySnapshot): boolean {
  return (
    requiredFieldSatisfied(s, "businessName") &&
    requiredFieldSatisfied(s, "coreOffer") &&
    requiredFieldSatisfied(s, "transformation") &&
    requiredFieldSatisfied(s, "postingPlatforms") &&
    requiredFieldSatisfied(s, "platforms") &&
    optionalFieldSatisfied(s, "tone") &&
    optionalFieldSatisfied(s, "contentType") &&
    optionalFieldSatisfied(s, "imageStyle")
  );
}

/**
 * True when guided intake has every structured field needed to synthesize a baseline campaign brief
 * (industry, audience, revenue optionals, content profile). Does not require manual campaign notes.
 */
export function structuredGuidedIntakeCompleteForCampaign(s: BentleySnapshot): boolean {
  return intakeComplete(s) && revenueOptionalComplete(s) && contentProfileComplete(s);
}

export function campaignNotesComplete(s: BentleySnapshot): boolean {
  return optionalFieldSatisfied(s, "campaignNotes");
}

export function allRequiredComplete(s: BentleySnapshot): boolean {
  return BENTLEY_REQUIRED_ORDER.every((k) => requiredFieldSatisfied(s, k));
}

export function getWorkflowPhase(s: BentleySnapshot): BentleyWorkflowPhase {
  if (!intakeComplete(s)) return "intake";
  if (!revenueOptionalComplete(s)) return "revenue_model";
  if (!contentProfileComplete(s)) return "content_setup";
  if (!campaignNotesComplete(s)) return "campaign_prep";
  return "ready";
}

export function getChecklistStatus(s: BentleySnapshot): Record<BentleyChecklistId, "pending" | "complete"> {
  return {
    intake: intakeComplete(s) ? "complete" : "pending",
    revenue_inputs: revenueOptionalComplete(s) ? "complete" : "pending",
    content_profile: contentProfileComplete(s) ? "complete" : "pending",
    campaign_notes: campaignNotesComplete(s) ? "complete" : "pending",
    ready_to_run:
      intakeComplete(s) &&
      revenueOptionalComplete(s) &&
      contentProfileComplete(s) &&
      campaignNotesComplete(s)
        ? "complete"
        : "pending",
  };
}

export function questionForField(key: BentleyFieldKey): string {
  const q: Record<BentleyFieldKey, string> = {
    industryKey: "What industry are we working on today? (You can describe it in your own words.)",
    targetAudience: "Who is the target audience?",
    traffic: "Optional: what’s your current monthly traffic (visitors or leads per month)? Say **skip** to move on.",
    conversionRate: "Optional: what’s your current conversion rate (e.g. 2.5 or 2.5%)? Say **skip** to move on.",
    aov: "Optional: what’s your average order value in dollars? Say **skip** to move on.",
    businessName: "What is the business name?",
    coreOffer: "What is the core offer?",
    transformation: "What transformation or result are you promising?",
    postingPlatforms:
      "Which platforms will you post to? Name any of: LinkedIn, Instagram, Facebook, TikTok, Pinterest, Snapchat (we’ll connect these with OAuth on the dashboard).",
    platforms: "Which platforms should we focus on for content strategy? (e.g. Instagram, TikTok, LinkedIn, YouTube, X)",
    tone: `Optional: what tone do you want? (${TONES.join(", ")}) Say **skip** to keep the current default.`,
    contentType: `Optional: what type of content? (${CONTENT_TYPES.join(", ")}) Say **skip** for default.`,
    imageStyle: `Optional: image style? (${IMAGE_STYLES.join(", ")}) Say **skip** for default.`,
    campaignNotes:
      "Optional: paste extra research, links, or trends — or say **skip**. If guided intake is already complete, campaign notes are synthesized from your answers automatically.",
  };
  return q[key];
}

export function sectionForField(key: BentleyFieldKey): BentleySectionId {
  if (
    key === "industryKey" ||
    key === "targetAudience" ||
    key === "traffic" ||
    key === "conversionRate" ||
    key === "aov" ||
    key === "postingPlatforms" ||
    key === "platforms"
  ) {
    return "industry-intelligence";
  }
  if (
    key === "businessName" ||
    key === "coreOffer" ||
    key === "transformation" ||
    key === "tone" ||
    key === "contentType" ||
    key === "imageStyle"
  ) {
    return "content-engine";
  }
  if (key === "campaignNotes") return "campaign-from-notes";
  return "industry-intelligence";
}

/** Scroll target after a workflow phase completes */
export function sectionForPhaseHandoff(phase: BentleyWorkflowPhase): BentleySectionId {
  switch (phase) {
    case "intake":
      return "industry-intelligence";
    case "revenue_model":
      return "industry-intelligence";
    case "content_setup":
      return "content-engine";
    case "campaign_prep":
      return "campaign-from-notes";
    case "ready":
      return "research-assistant";
    default:
      return "industry-intelligence";
  }
}

export function phaseLabel(phase: BentleyWorkflowPhase): string {
  const m: Record<BentleyWorkflowPhase, string> = {
    intake: "Intake",
    revenue_model: "Revenue Model",
    content_setup: "Content Setup",
    campaign_prep: "Campaign Prep",
    ready: "Ready to Run",
  };
  return m[phase];
}

export function fieldLabelShort(key: BentleyFieldKey): string {
  const m: Record<BentleyFieldKey, string> = {
    industryKey: "Industry",
    targetAudience: "Target audience",
    traffic: "Monthly traffic",
    conversionRate: "Conversion rate",
    aov: "Average order value",
    businessName: "Business name",
    coreOffer: "Core offer",
    transformation: "Transformation / outcome",
    postingPlatforms: "Posting platforms",
    platforms: "Content platforms",
    tone: "Tone",
    contentType: "Content type",
    imageStyle: "Image style",
    campaignNotes: "Campaign notes",
  };
  return m[key];
}

export type BentleyApplyResult = {
  patch: Partial<BentleySnapshot>;
  questionnairePatch?: Partial<ClientReadinessAnswers>;
  confirm: string;
};

export function mergeBentleySnapshot(snap: BentleySnapshot, applied: BentleyApplyResult): BentleySnapshot {
  const next: BentleySnapshot = { ...snap, ...applied.patch };
  if (applied.questionnairePatch?.targetAudience !== undefined) {
    next.targetAudience = applied.questionnairePatch.targetAudience ?? "";
  }
  if (applied.questionnairePatch?.socialPlatforms) {
    next.platforms = applied.questionnairePatch.socialPlatforms;
  }
  if (applied.patch.optionalAck) {
    next.optionalAck = { ...snap.optionalAck, ...applied.patch.optionalAck };
  }
  if (applied.patch.pipeline !== undefined) {
    next.pipeline = mergePipelineStages(snap.pipeline, applied.patch.pipeline);
  }
  if (applied.patch.launchPrefill !== undefined) {
    next.launchPrefill = { ...snap.launchPrefill, ...applied.patch.launchPrefill };
  }
  return next;
}

function ackPatch(key: keyof BentleyOptionalAck): Partial<BentleySnapshot> {
  return { optionalAck: { [key]: true } };
}

/** Apply user reply to the current missing field */
export function applyAnswerForField(
  field: BentleyFieldKey,
  text: string
): BentleyApplyResult | { error: string } {
  const raw = text.trim();
  if (!raw) return { error: "I didn’t catch that — try a short answer." };

  switch (field) {
    case "industryKey": {
      const resolved = resolveIndustryValue(raw);
      if (resolved.kind === "empty") return { error: "Tell me the industry (a phrase is fine)." };
      if (resolved.kind === "canonical") {
        return {
          patch: {
            industryKey: resolved.industryKey,
            contentIndustry: resolved.label,
          },
          confirm: `Saved industry as **${resolved.label}** (matched to your catalog).`,
        };
      }
      return {
        patch: {
          industryKey: null,
          contentIndustry: resolved.freeText,
        },
        confirm: `Saved industry as “${resolved.freeText}” (free text — you can refine it on the page).`,
      };
    }
    case "targetAudience":
      return {
        patch: { targetAudience: raw },
        questionnairePatch: { targetAudience: raw },
        confirm: `Saved **target audience**: ${raw}`,
      };
    case "traffic": {
      if (isSkipMessage(raw)) {
        return {
          patch: { skipTraffic: true, ...ackPatch("traffic") },
          confirm:
            "Skipped **monthly traffic** — the revenue model can still be completed later in **Industry Intelligence**; benchmarks will use your numbers once you add them.",
        };
      }
      const n = parseNumberLoose(raw);
      if (n === null || n <= 0) return { error: "Enter a positive number (e.g. 5000) or say **skip**." };
      return {
        patch: { traffic: Math.round(n), ...ackPatch("traffic") },
        confirm: `Saved **monthly traffic**: ${Math.round(n).toLocaleString()}.`,
      };
    }
    case "conversionRate": {
      if (isSkipMessage(raw)) {
        return {
          patch: { skipConversion: true, ...ackPatch("conversion") },
          confirm:
            "Skipped **conversion rate** — you can enter it anytime; the equation engine will reflect it when you do.",
        };
      }
      const parsed = parsePercentFromUserText(raw);
      if (!parsed.ok) {
        if (parsed.reason === "over_max") {
          return { error: "Use a percent between 0 and 100 (e.g. 2.5 or 2.5%)." };
        }
        return { error: "Enter a rate (e.g. 2.5 or 1%) or say **skip**." };
      }
      const n = parsed.percentPoints;
      return {
        patch: { conversionRate: n, ...ackPatch("conversion") },
        confirm: `Saved **conversion rate**: ${n.toFixed(2)}%.`,
      };
    }
    case "aov": {
      if (isSkipMessage(raw)) {
        return {
          patch: { skipAov: true, ...ackPatch("aov") },
          confirm:
            "Skipped **AOV** — revenue modeling can be refined later; nothing is locked in.",
        };
      }
      const n = parseNumberLoose(raw);
      if (n === null || n <= 0) return { error: "Enter AOV in dollars (e.g. 1500) or say **skip**." };
      return {
        patch: { aov: n, ...ackPatch("aov") },
        confirm: `Saved **average order value**: $${n.toLocaleString()}.`,
      };
    }
    case "businessName":
      return { patch: { businessName: raw }, confirm: `Saved **business name**: ${raw}` };
    case "coreOffer":
      return { patch: { coreOffer: raw }, confirm: `Saved **core offer**.` };
    case "transformation":
      return { patch: { transformation: raw }, confirm: `Saved **transformation / outcome**.` };
    case "postingPlatforms": {
      const pp = parsePostingPlatformsFromUserText(raw);
      if (pp.length === 0) {
        return {
          error:
            "Name at least one connectable network: LinkedIn, Instagram, Facebook, TikTok, Pinterest, or Snapchat (YouTube and X are not OAuth-connected here yet).",
        };
      }
      return {
        patch: { postingPlatforms: pp },
        confirm: `Saved **posting platforms** for OAuth: ${pp.join(", ")}.`,
      };
    }
    case "platforms": {
      const plats = parsePlatforms(raw);
      if (plats.length === 0) return { error: "Name at least one platform (e.g. Instagram, TikTok)." };
      return {
        patch: { platforms: plats },
        questionnairePatch: { socialPlatforms: plats },
        confirm: `Saved **platforms**: ${plats.join(", ")}.`,
      };
    }
    case "tone": {
      if (isSkipMessage(raw)) {
        return {
          patch: { skipTone: true, ...ackPatch("tone") },
          confirm: `Keeping the default **tone: ${DEFAULT_TONE}** — you can change it anytime in Content Engine.`,
        };
      }
      const m = matchEnum(raw, TONES);
      if (!m) return { error: `Pick a tone (${TONES.join(", ")}) or say **skip**.` };
      return { patch: { tone: m, ...ackPatch("tone") }, confirm: `Saved **tone**: ${m}.` };
    }
    case "contentType": {
      if (isSkipMessage(raw)) {
        return {
          patch: { skipContentType: true, ...ackPatch("contentType") },
          confirm: `Keeping the default **content type: ${DEFAULT_CONTENT_TYPE}**.`,
        };
      }
      const m = matchEnum(raw, CONTENT_TYPES);
      if (!m) return { error: `Choose a type (${CONTENT_TYPES.join(", ")}) or say **skip**.` };
      return { patch: { contentType: m, ...ackPatch("contentType") }, confirm: `Saved **content type**: ${m}.` };
    }
    case "imageStyle": {
      if (isSkipMessage(raw)) {
        return {
          patch: { skipImageStyle: true, ...ackPatch("imageStyle") },
          confirm: `Keeping the default **image style: ${DEFAULT_IMAGE_STYLE}** (used when you copy prompts for external apps).`,
        };
      }
      const m = matchEnum(raw, IMAGE_STYLES);
      if (!m) return { error: `Image style: ${IMAGE_STYLES.join(", ")} — or **skip**.` };
      return { patch: { imageStyle: m, ...ackPatch("imageStyle") }, confirm: `Saved **image style**: ${m}.` };
    }
    case "campaignNotes": {
      if (isSkipMessage(raw)) {
        return {
          patch: { skipCampaignNotes: true, ...ackPatch("campaignNotes") },
          confirm:
            "Skipped **campaign notes** — with guided intake complete, a baseline brief is still available; add research or links anytime in **Generate Campaign**.",
        };
      }
      return {
        patch: { campaignNotes: raw, ...ackPatch("campaignNotes") },
        confirm: "Saved **campaign notes** — edit in the campaign section if needed.",
      };
    }
    default:
      return { error: "Unknown step." };
  }
}

export function checklistMilestoneLabel(id: BentleyChecklistId): string {
  const m: Record<BentleyChecklistId, string> = {
    intake: "Intake",
    revenue_inputs: "Revenue Inputs",
    content_profile: "Content Profile",
    campaign_notes: "Campaign Notes",
    ready_to_run: "Ready to Run",
  };
  return m[id];
}

/** Milestone just finished when leaving `phase` forward */
export function completedMilestoneForPhaseLeft(phase: BentleyWorkflowPhase): BentleyChecklistId | null {
  switch (phase) {
    case "intake":
      return "intake";
    case "revenue_model":
      return "revenue_inputs";
    case "content_setup":
      return "content_profile";
    case "campaign_prep":
      return "campaign_notes";
    case "ready":
      return "ready_to_run";
    default:
      return null;
  }
}

export function handoffMessage(): string {
  return (
    "**You’re ready to run the OS.** Use **Research Assistant**, then **Trends Library**, then **Content Engine**, then **Generate Campaign** — tap each section when you want. I won’t auto-run paid or heavy actions."
  );
}
