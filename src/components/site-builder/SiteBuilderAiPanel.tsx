"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ClipboardList,
  Wand2,
  RefreshCw,
  ShieldCheck,
  Download,
  LayoutTemplate,
  FileText,
  User,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { useMemo, useState, useRef, forwardRef, useImperativeHandle, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import type { BuilderWorkflowStage } from "@/components/site-builder/builder-workflow-stage";
import {
  DescribeOutputProofStrip,
  type OutputProofFeelId,
} from "@/components/site-builder/DescribeOutputProofStrip";
import { tryExtractBuilderActionsFromMessage } from "@/lib/site-builder/ai/assistant-builder-actions-bridge";
import type { SitePlannerInput } from "@/lib/site-builder/ai/schemas";
import type { InspirationBrief } from "@/lib/site-builder/inspiration/inspiration-brief-schema";
import {
  buildNarrativeFromIntake,
  conversationalIntakeProgress,
  getNextConversationalIntakeStep,
  hashPipelineInputPayload,
  intakeToSitePlannerInput,
  type ConversationalIntakeStepKey,
  type SiteBuilderIntakeFields,
  validateIntakeForFullBuild,
  type FullBuildClientGate,
} from "@/lib/site-builder/ai/site-builder-intake";
import type { BatchRegenerateMeta, SessionEditContext, SectionEditMeta } from "@/lib/site-builder/ai/regenerate-section";
import {
  applySessionBiasToScope,
  classifyBatchEditIntents,
  classifyEditIntents,
  primaryBatchIntent,
  primaryIntent,
  resolveBatchEditScope,
  resolveEditScope,
} from "@/lib/site-builder/ai/section-edit-intelligence";
import { pickAgencyLaunchActions } from "@/lib/site-builder/agency-launch-pipeline";
import type { AgencyTask } from "@/lib/site-builder/agency-launch-schema";
import {
  applyBrandBrainAfterTroothertz,
  applyBrandBrainFixByCode,
  pickProactiveSuggestionLabels,
} from "@/lib/site-builder/brand-brain-pipeline";
import type { BrandBrainQueueItem } from "@/lib/site-builder/brand-brain-schema";
import {
  applyTroothertzVisualPostProcessToDocument,
  styleModeFromSiteDocument,
} from "@/lib/site-builder/ai/troothertz-visual-postprocess";
import {
  compactSectionIdPrefixes,
  filterSectionIdsStillInSchema,
  normalizeRefineSectionIds,
} from "@/lib/site-builder/refine-selection-utils";
import type { BuilderAction } from "@/lib/site-builder/builder-actions/action-schemas";
import { trackSiteBuilderEvent } from "@/lib/site-builder/siteBuilderAnalytics";
import type { SiteBuilderAnalyticsProps } from "@/lib/site-builder/siteBuilderAnalytics";
import { runSiteBuilderTrackedAction } from "@/lib/site-builder/siteBuilderTrackedAction";
import type { DeploymentTarget, SiteBuilderRefinementAnswers } from "@/lib/site-builder/refinement-schema";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import {
  applyImportRestructureOpportunity,
  markImportRestructureQueueStatus,
  pickImportRestructureSuggestionsForUi,
} from "@/lib/site-builder/import-restructure-apply";
import { assembleDeliverablesFromSchema, deliverablesToBundledFiles } from "@/lib/site-builder/assemble-deliverables";
import { buildClientHandoffContext, renderClientHandoffMarkdown } from "@/lib/site-builder/deliverables/client-handoff-render";
import type { DeliverablesDocument } from "@/lib/site-builder/deliverables-schema";
import { syncImportRestructureIntoDocument } from "@/lib/site-builder/import-restructure-sync";
import type { ImportRestructureQueueItem } from "@/lib/site-builder/import-restructure-schema";
import type { SiteBuilderAssetRecord } from "@/lib/site-builder/site-builder-asset";
import type { PaymentIntegration } from "@/lib/site-builder/payment-integration-schema";
import { PaymentIntegrationSchema } from "@/lib/site-builder/payment-integration-schema";
import { sanitizePaypalButtonHtml, sanitizePaypalPaymentUrl } from "@/lib/site-builder/payment-sanitize";
import { friendlyLabelsForSectionIds, sectionTypeToFriendlyLabel } from "@/lib/site-builder/preview/blockPreviewUtils";
import { buildSiteBuilderEditExplanation } from "@/lib/site-builder/site-builder-edit-explanation";
import { chunkSectionIdsForBatch, listRefinableSectionIdsOnPage } from "@/lib/site-builder/site-builder-light-page";
import { resolveOmnibarSubmitRoute } from "@/lib/site-builder/site-builder-omnibar-routing";
import { normalizeSchemaJsonStringForTargeting } from "@/lib/site-builder/schema/ensure-block-targeting";
import {
  applyAssistantImagePlacement,
  ASSISTANT_IMAGE_PLACEMENT_PROMPT,
  parseImagePlacementFromPrompt,
  shouldAskImagePlacement,
  stripImagePlacementPhrasesFromPrompt,
} from "@/lib/site-builder/assistant-image-placement";
import { SiteBuilderVariantPicker } from "@/components/site-builder/SiteBuilderVariantPicker";
import { hashSiteSchema } from "@/lib/site-builder/hash";
import { builderActionTouchSectionIds } from "@/lib/site-builder/assistant/builder-action-touch-ids";
import { computeVariantSelectionIndices } from "@/lib/site-builder/variant-selection-indices";
import {
  CHAT_FULL_BUILD_SUCCESS,
  filterChatMessagesForStorage,
  shouldPersistChatMessage,
  shouldSkipConsecutiveChatMessage,
} from "@/lib/site-builder/assistant-chat-persistence";
import type { AssistantChatMessage, AssistantChatRole } from "@/lib/site-builder/assistant-chat-persistence";
import {
  STEPHON_DISPLAY_NAME,
  STEPHON_FIRST_RUN_WELCOME,
} from "@/lib/site-builder/stephon-persona";
import {
  analyzeAssistantPrompt,
  type AssistantUiBuildPhase,
  buildPostEditFollowup,
  deriveAssistantStatusLabel,
} from "@/lib/site-builder/assistant/assistantBehavior";
import {
  applyStreamingBuildPhasePatch,
  createInstantSkeletonSchema,
  type StreamingBuildPhase,
} from "@/lib/site-builder/streaming-build";
import { mapExecuteIntentMessage } from "@/lib/site-builder/assistant/map-execute-intent-message";
import {
  filterDraftSafeBuilderActions,
  isSiteBuilderDraftMode,
  persistDraftContextToSession,
  persistDraftSchemaToSession,
  tryAttachToThemeOnlyDraft,
} from "@/lib/site-builder/draft/site-builder-draft";

export type { AssistantChatMessage, AssistantChatRole } from "@/lib/site-builder/assistant-chat-persistence";

type SiteTypeOption =
  | "auto"
  | "landing"
  | "portfolio"
  | "saas"
  | "web3_product"
  | "community"
  | "ecommerce_light"
  | "local_business"
  | "trust_operator";

type DesignDir = "minimal" | "bold" | "luxe" | "cyber" | "operator";

type SiteBuilderPipelineContentIntelligence = {
  contentScore: number;
  repaired: boolean;
  issues: string[];
  genericContentWarning?: boolean;
};

type SiteBuilderPipelineGenerationMeta = {
  layoutFamilyId?: string;
  diversityScore?: number;
  retryCount?: number;
  plannerPath?: "llm_enriched" | "deterministic_fallback";
  llmUsed?: boolean;
  llmModel?: string;
  llmProvider?: string;
  fallbackReason?: string;
  contentIntelligence?: SiteBuilderPipelineContentIntelligence;
  inspirationPatternsUsed?: boolean;
  critiqueScore?: number;
  critiqueIssues?: string[];
  autoRepaired?: boolean;
  layoutEnforced?: boolean;
  designSystemApplied?: boolean;
  sectionRolesAssigned?: boolean;
};

function schemaHasWidgetIntegration(schema: unknown): boolean {
  const wk = (schema as { metadata?: { widgetIntegration?: { widgetKey?: string } } })?.metadata?.widgetIntegration
    ?.widgetKey;
  return typeof wk === "string" && wk.trim().length > 0;
}

const ASSISTANT_CHAT_MAX = 100;
/** v2: persist only user + meaningful assistant; session-only error/status; deduped. */
const chatStorageKey = (siteId: string | undefined) => `site-builder-assistant-chat-v2:${(siteId ?? "draft").trim() || "draft"}`;

const REFINE_QUICK_SUGGESTIONS: ReadonlyArray<{ label: string; text: string }> = [
  { label: "Add pricing", text: "Add a pricing section with clear tiers, feature bullets, and a primary CTA." },
  { label: "Rewrite hero", text: "Rewrite the hero headline and subcopy to be clearer and more compelling for the target audience." },
  { label: "Improve design", text: "Improve the visual design: spacing, typography hierarchy, and color harmony across sections." },
];

const FIRST_RUN_WELCOME_TEXT = STEPHON_FIRST_RUN_WELCOME;

const WELCOME_EXAMPLE_CHIPS: ReadonlyArray<{ label: string; prompt: string }> = [
  { label: "Consulting firm landing page", prompt: "A polished consulting firm landing page with services, team credibility, and a clear contact CTA." },
  { label: "Tax professional site", prompt: "A trustworthy site for a tax professional with services, credentials, and a path to book an appointment." },
  { label: "Real estate tokenization page", prompt: "A modern real estate tokenization page: what it is, benefits, and a strong next step for investors." },
  { label: "Salon booking page", prompt: "A salon website with services, team or gallery, and online booking CTA." },
  { label: "AI agency website", prompt: "An AI agency website with offerings, social proof, and a hero that speaks to B2B clients." },
];

function readStyleModeFromSchemaJson(text: string): string | undefined {
  try {
    const doc = JSON.parse(text) as { metadata?: { theme?: { styleMode?: string } } };
    const m = doc.metadata?.theme?.styleMode;
    return typeof m === "string" && m.length > 0 ? m : undefined;
  } catch {
    return undefined;
  }
}

export type IntakeQuestion = { key: string; prompt: string };

export function nextMissingIntakeQuestion(fields: SiteBuilderIntakeFields): IntakeQuestion | null {
  if (!fields.businessName.trim()) return { key: "businessName", prompt: "What is the business name?" };
  if (!fields.industry.trim()) return { key: "industry", prompt: "What industry or niche are you in?" };
  if (!fields.primaryOffer.trim()) return { key: "primaryOffer", prompt: "What is the main offer or service?" };
  if (!fields.audience.trim()) return { key: "audience", prompt: "Who is the target audience?" };
  if (!fields.market.trim()) return { key: "market", prompt: "What location or service area should we target?" };
  const note = fields.additionalNotes.toLowerCase();
  if (!/\b(keyword|seo|ranking|search)\b/.test(note)) {
    return { key: "seoKeyword", prompt: "What primary SEO keyword should we optimize for?" };
  }
  if (!/\b(call to action|cta|book|contact|schedule|buy|start|quote)\b/.test(note)) {
    return { key: "ctaGoal", prompt: "What is your main CTA goal (book a call, get a quote, sign up, etc.)?" };
  }
  if (!/\b(style|look|visual|minimal|bold|modern|luxe|cyber|operator)\b/.test(note)) {
    return { key: "style", prompt: "What visual style do you prefer (minimal, bold, luxe, cyber, operator)?" };
  }
  return null;
}

export function isShowCodeRequest(message: string): boolean {
  const lower = message.toLowerCase();
  return /\b(show|open|view)\b/.test(lower) && /\b(code|files?|schema|json)\b/.test(lower);
}

function mergeBrandBrainDismiss(prev: SessionEditContext | undefined, code: string): SessionEditContext {
  const cur = prev?.brandBrainSession?.dismissedSuggestionCodes ?? [];
  const next = [...new Set([...cur, code])].slice(-30);
  return {
    ...prev,
    brandBrainSession: {
      ...prev?.brandBrainSession,
      dismissedSuggestionCodes: next,
    },
  };
}

function mergeBrandBrainAccept(prev: SessionEditContext | undefined, item: BrandBrainQueueItem): SessionEditContext {
  const cur = prev?.brandBrainSession?.acceptedSuggestionCodes ?? [];
  const nextCodes = [...new Set([...cur, item.code])].slice(-30);
  const tokenDelta = item.fixability === "safe_auto" ? 1 : 0;
  const structuralDelta = item.fixability === "structural" ? 1 : 0;
  const tok = (prev?.brandBrainSession?.tokenLevelSuggestionAccepts ?? 0) + tokenDelta;
  const str = (prev?.brandBrainSession?.structuralSuggestionAccepts ?? 0) + structuralDelta;
  return {
    ...prev,
    brandBrainSession: {
      ...prev?.brandBrainSession,
      acceptedSuggestionCodes: nextCodes,
      tokenLevelSuggestionAccepts: tok,
      structuralSuggestionAccepts: str,
      prefersStrongConsistencyHeuristic: tok >= str * 2 && tok + str > 0,
    },
  };
}

function mergeAgencyDismiss(prev: SessionEditContext | undefined, taskId: string): SessionEditContext {
  const cur = prev?.agencySession?.dismissedTaskIds ?? [];
  const next = [...new Set([...cur, taskId])].slice(-36);
  return {
    ...prev,
    agencySession: {
      ...prev?.agencySession,
      dismissedTaskIds: next,
    },
  };
}

function mergeAgencyAccept(prev: SessionEditContext | undefined, task: AgencyTask): SessionEditContext {
  const cur = prev?.agencySession?.acceptedTaskIds ?? [];
  const nextIds = [...new Set([...cur, task.id])].slice(-36);
  const conv = (prev?.agencySession?.conversionSuggestionAccepts ?? 0) + (task.type === "conversion_improvement" ? 1 : 0);
  const del = (prev?.agencySession?.deliverableSuggestionAccepts ?? 0) + (task.type === "launch_asset" ? 1 : 0);
  const sum = conv + del;
  return {
    ...prev,
    agencySession: {
      ...prev?.agencySession,
      acceptedTaskIds: nextIds,
      conversionSuggestionAccepts: conv,
      deliverableSuggestionAccepts: del,
      prefersLaunchReadiness: sum >= 2,
      movingTowardLaunch: conv >= 1 && (Boolean(prev?.agencySession?.movingTowardLaunch) || conv >= 2),
    },
  };
}

function emitAgencyLaunchAnalyticsForSchema(schema: unknown, workflowStage: BuilderWorkflowStage) {
  const al = (
    schema as {
      metadata?: {
        agencyLaunch?: {
          readiness?: string;
          conversionPathIssues?: Array<{ code: string; severity: string; scope: string }>;
          companionPageSuggestions?: Array<{ code: string; priority: string }>;
        };
      };
    }
  )?.metadata?.agencyLaunch;
  if (!al) return;
  const style_mode = readStyleModeFromSchemaJson(JSON.stringify(schema));
  const base = { workflow_stage: workflowStage, ...(style_mode ? { style_mode } : {}) };
  trackSiteBuilderEvent("site_builder_launch_readiness_evaluated", {
    readiness: String(al.readiness ?? "unknown"),
    ...base,
  });
  for (const issue of al.conversionPathIssues ?? []) {
    trackSiteBuilderEvent("site_builder_conversion_path_issue_detected", {
      code: issue.code,
      severity: issue.severity,
      scope: issue.scope,
      ...base,
    });
  }
  for (const c of al.companionPageSuggestions ?? []) {
    trackSiteBuilderEvent("site_builder_companion_page_suggested", {
      code: c.code,
      priority: c.priority,
      scope: "site",
      ...base,
    });
  }
}

function emitBrandBrainAnalyticsForSchema(schema: unknown, workflowStage: BuilderWorkflowStage) {
  const meta = (
    schema as {
      metadata?: {
        brandBrain?: {
          findings?: Array<{ code: string; severity: string; scope: string }>;
          lastAppliedCodes?: string[];
        };
      };
    }
  )?.metadata?.brandBrain;
  if (!meta) return;
  const style_mode = readStyleModeFromSchemaJson(JSON.stringify(schema));
  const base = { workflow_stage: workflowStage, ...(style_mode ? { style_mode } : {}) };
  for (const f of meta.findings ?? []) {
    trackSiteBuilderEvent("site_builder_brand_brain_evaluated", {
      finding_code: f.code,
      severity: f.severity,
      scope: f.scope,
      ...base,
    });
  }
  for (const code of meta.lastAppliedCodes ?? []) {
    trackSiteBuilderEvent("site_builder_brand_brain_fix_applied", { finding_code: code, ...base });
  }
}

function emptyPayPalFormState(): {
  enabled: boolean;
  mode: PaymentIntegration["mode"];
  intent: PaymentIntegration["intent"];
  placement: PaymentIntegration["placement"];
  pageSlug: string;
  paymentLink: string;
  buttonHtml: string;
  clientId: string;
  environment: "sandbox" | "live";
  currency: string;
} {
  return {
    enabled: false,
    mode: "payment_link",
    intent: "full_payment",
    placement: "cta_section",
    pageSlug: "",
    paymentLink: "",
    buttonHtml: "",
    clientId: "",
    environment: "sandbox",
    currency: "USD",
  };
}

const DEPLOYMENT_TARGET_OPTIONS: ReadonlyArray<{ value: DeploymentTarget; label: string }> = [
  { value: "static", label: "Static hosting" },
  { value: "vercel_nextjs", label: "Vercel / Next.js" },
  { value: "netlify_static", label: "Netlify static" },
  { value: "ipfs", label: "IPFS" },
  { value: "wordpress_theme", label: "WordPress theme" },
  { value: "gohighlevel_embed", label: "GoHighLevel embed" },
  { value: "custom", label: "Custom / unsure" },
];

/** Concise briefs + matching planner hints—click fills the form without new workflow steps. */
const INSPIRATION_EXAMPLES: ReadonlyArray<{
  id: string;
  label: string;
  /** 3–6 words, outcome-focused—when this feel fits. */
  fitCue: string;
  prompt: string;
  siteType: SiteTypeOption;
  designDirection: DesignDir;
  styleIntensity: number;
  web3VisualMode: boolean;
}> = [
  {
    id: "web3",
    label: "Web3 launch",
    fitCue: "Launches, drops, reveals",
    prompt:
      "Product launch for a wallet-connected app: clear promise, trust without hype, one obvious next step for new visitors.",
    siteType: "web3_product",
    designDirection: "cyber",
    styleIntensity: 58,
    web3VisualMode: true,
  },
  {
    id: "corporate",
    label: "B2B / services",
    fitCue: "Services, operator trust",
    prompt:
      "Credible services landing: who it’s for, what changes after they work with you, and a calm path to book or contact.",
    siteType: "saas",
    designDirection: "operator",
    styleIntensity: 52,
    web3VisualMode: false,
  },
  {
    id: "bold",
    label: "Bold offer",
    fitCue: "One offer, strong conversion",
    prompt:
      "High-impact offer page: one main conversion, strong headline, proof strip, and a single clear CTA—no clutter.",
    siteType: "landing",
    designDirection: "bold",
    styleIntensity: 68,
    web3VisualMode: false,
  },
  {
    id: "minimal",
    label: "Minimal story",
    fitCue: "Stories, editorial clarity",
    prompt:
      "Quiet, editorial page for a product story: lots of air, refined type, and one soft invitation to learn more.",
    siteType: "portfolio",
    designDirection: "minimal",
    styleIntensity: 32,
    web3VisualMode: false,
  },
];

type PlannerOut = Record<string, unknown>;
type EvaluationOut = {
  score: number;
  passed: boolean;
  findings: Array<{ severity: string; message: string; category?: string; blockIndex?: number }>;
};

type JsonFetchInit = RequestInit & {
  timeoutMs?: number;
};

async function jsonFetch<T>(url: string, init?: JsonFetchInit): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = typeof init?.timeoutMs === "number" ? init.timeoutMs : 0;
  const timer = timeoutMs > 0 ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
  const signal = init?.signal ?? controller.signal;
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      ...init,
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Build timed out before preview was generated. Try again or switch to template fallback.");
    }
    throw e;
  } finally {
    if (timer != null) window.clearTimeout(timer);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    let msg = String(data?.error || `Request failed (${res.status})`);
    if (typeof data?.stage === "string") {
      msg = `${msg} [stage: ${data.stage}]`;
    }
    if (Array.isArray(data?.issues) && data.issues.length) {
      const snippet = JSON.stringify(data.issues).slice(0, 800);
      msg = `${msg} ${snippet}`;
    }
    throw new Error(msg);
  }
  return data as T;
}

/** Result of a full pipeline build; `variantPickPending` means the user must pick a layout before Refine. */
export type FullBuildRunResult = {
  ok: boolean;
  variantPickPending: boolean;
  /** When `ok` and a schema was applied (not variant-pick), false means the output matched the prior preview hash. */
  previewContentChanged?: boolean;
  /** Populated when `ok` is false and the pipeline threw or rejected the request. */
  errorMessage?: string;
  /** Present after a successful full build when SEO intelligence wrote `metadata.seoAssistantSummary`. */
  seoAssistantSummary?: string;
};

type BuildDebugInfo = {
  stage: string;
  apiDurationMs: number | null;
  schemaApplied: boolean;
  variantPickerOpened: boolean;
};

export type SiteBuilderClientLifecyclePhase = "post_agent_attach" | "post_publish_deploy";

export type SiteBuilderAssistantCapability =
  | "build_site"
  | "import_url"
  | "change_style"
  | "add_image"
  | "ai_widget"
  | "share_preview"
  | "open_engines";

export type SiteBuilderAiPanelHandle = {
  /** `ok: false` when validation fails or the pipeline request errors. */
  runFullBuild: (opts?: { source?: "panel" | "sticky_bar" }) => Promise<FullBuildRunResult>;
  /** One-shot or guided full build; check `variantPickPending` before advancing UI to Refine. */
  runFullBuildWithRefinement: (opts?: { source?: "panel" | "sticky_bar" }) => Promise<FullBuildRunResult>;
  runPlan: () => Promise<void>;
  /** Primary omnibar submit (plan, generate, section regen, light page refine, or publish hint). */
  submitOmnibarCommand: () => Promise<void>;
  /**
   * Refine: regenerate a section by id with the same adaptive pipeline as the panel button.
   * Re-throws on failure when `withBusyRethrowing` is provided on the panel.
   */
  runRefineSectionRegenerate: (
    instruction: string,
    opts?: { sectionId?: string; sectionIds?: string[]; source?: "panel" | "canvas" },
  ) => Promise<void>;
  /** Consultant → client lifecycle nudges (attach agent, deploy) from the parent shell. */
  notifyClientLifecycle?: (phase: SiteBuilderClientLifecyclePhase) => void;
  /** Prefill the omnibar without submitting. */
  prefillUserPrompt: (text: string) => void;
  /** Clear staged composer image attachments (after apply or cancel). */
  clearComposerImageAttachments: () => void;
};

type Props = {
  schemaText: string;
  onApplySchema: (json: string) => void;
  onNotice: (msg: string) => void;
  onError: (msg: string | null) => void;
  withBusy: (task: () => Promise<void>) => Promise<void>;
  busy: boolean;
  workflowStage: BuilderWorkflowStage;
  /** When true, hide the large “Plan + build + evaluate” button (e.g. sticky bar owns it). */
  suppressPrimaryGenerate?: boolean;
  /** After “Generate my site” / plan completes from the panel, move workflow to Review. */
  onPlanReadyGoReview?: () => void;
  /** After a successful URL import (blueprint), skip planner Review and open Refine. */
  onImportBlueprintReady?: () => void;
  /** When set, Refine section dropdown is controlled (sync with on-canvas selection). */
  refineTargetSectionId?: string;
  onRefineTargetSectionIdChange?: (id: string) => void;
  /** Ordered Refine targets (max 3); preferred when wiring multi-select from the parent page. */
  refineTargetSectionIds?: string[];
  onRefineTargetSectionIdsChange?: (ids: string[]) => void;
  /** While a section-only regen runs, parent can suppress the full-preview loading veil. */
  onSectionRegenerationVisualMask?: (masked: boolean) => void;
  /** Same as withBusy but rethrows after surfacing the error (for canvas callers). */
  withBusyRethrowing?: (task: () => Promise<void>) => Promise<void>;
  /** When set, planner/regeneration and builder-actions use per-site BYOK / platform LLM resolution. */
  builderSiteId?: string;
  /** Optional version id for import/action audit logs. */
  builderVersionId?: string;
  /** After successful AI edits — preview scroll/highlight + friendly confirmation. */
  onAiEditCompleted?: (payload: {
    changedSectionIds: string[];
    headline: string;
    scope: "section" | "full" | "light_page";
  }) => void;
  /** When execute-intent returns 409 (schema hash mismatch), reload editor schema from the server. */
  onExecuteIntentSchemaConflict?: () => Promise<void>;
  /** After user picks a generated layout (including single-layout fallback). Typically moves workflow to Refine. */
  onVariantSelectionComplete?: (payload: { selectedIndex: number; schemaHasWidget?: boolean }) => void;
  /** When enabled, full generation requires a Revenue OS hub client (see hub props). */
  fullBuildClientGate?: FullBuildClientGate;
  buildForClient?: boolean;
  onBuildForClientChange?: (next: boolean) => void;
  hubClients?: Array<{ id: string; name: string }>;
  hubClientPick?: string;
  onHubClientPickChange?: (clientId: string) => void;
  /** POST /api/revenue-os/clients — same list as Client Hub / onboarding contacts. */
  onCreateHubClient?: (name: string) => Promise<void>;
  hubClientCreateBusy?: boolean;
  /** Disable client picker actions until a site project exists (create flow still allows toggle + pick for POST). */
  hasSelectedProject?: boolean;
  /** Parent can open the Files/Code drawer when user asks to "show code". */
  onOpenCodeDrawerRequest?: () => void;
  /** Linked Revenue OS client id (hub pick or site row) — drives post-build client handoff copy. */
  handoffSiteClientId?: string;
  /** v0-style surface: tuck marketing strips and tuck debug behind disclosure. */
  builderSurface?: boolean;
  /** Compact capability chips (parent may wire run build, open engines, etc.). */
  onCapabilityAction?: (id: SiteBuilderAssistantCapability) => void;
};

export const SiteBuilderAiPanel = forwardRef<SiteBuilderAiPanelHandle, Props>(function SiteBuilderAiPanel(
  {
    schemaText,
    onApplySchema,
    onNotice,
    onError,
    withBusy,
    busy,
    workflowStage,
    suppressPrimaryGenerate = false,
    onPlanReadyGoReview,
    onImportBlueprintReady,
    refineTargetSectionId,
    onRefineTargetSectionIdChange,
    refineTargetSectionIds,
    onRefineTargetSectionIdsChange,
    onSectionRegenerationVisualMask,
    withBusyRethrowing,
    builderSiteId,
    builderVersionId,
    onAiEditCompleted,
    onExecuteIntentSchemaConflict,
    onVariantSelectionComplete,
    fullBuildClientGate,
    buildForClient = false,
    onBuildForClientChange,
    hubClients = [],
    hubClientPick = "",
    onHubClientPickChange,
    onCreateHubClient,
    hubClientCreateBusy = false,
    hasSelectedProject = false,
    onOpenCodeDrawerRequest,
    handoffSiteClientId = "",
    builderSurface = false,
    onCapabilityAction,
  },
  ref
) {
  const [newHubClientDraft, setNewHubClientDraft] = useState("");
  type ComposerImageAttachment = { assetId: string; publicUrl: string; mimeType?: string; name: string };
  const [composerImageAttachments, setComposerImageAttachments] = useState<ComposerImageAttachment[]>([]);
  const [composerDropActive, setComposerDropActive] = useState(false);
  const [userPrompt, setUserPrompt] = useState(
    "A credible landing page for a trust-linked Web3 product: clear next step for visitors, calm tone, operator-grade trust."
  );
  const [industry, setIndustry] = useState("");
  const [market, setMarket] = useState("");
  /** Structured intake — synthesized into pipeline `userPrompt` via `intakeToSitePlannerInput`. */
  const [businessName, setBusinessName] = useState("");
  const [primaryOffer, setPrimaryOffer] = useState("");
  const [audience, setAudience] = useState("");
  /** Extended guided fields — combined into `SitePlannerInput` and narrative via `intakeToSitePlannerInput`. */
  const [intakeConversionGoal, setIntakeConversionGoal] = useState("");
  const [intakeBrandTone, setIntakeBrandTone] = useState("");
  const [intakeDesignPreference, setIntakeDesignPreference] = useState("");
  const [intakeTrustAndProof, setIntakeTrustAndProof] = useState("");
  /** One question at a time; answers also sync to the Manual Tools form fields. */
  const [conversationalIntakeActive, setConversationalIntakeActive] = useState(false);
  const [conversationalIntakeAnswers, setConversationalIntakeAnswers] = useState<
    Partial<Record<ConversationalIntakeStepKey, string>>
  >({});
  const [conversationalIntakeSkipped, setConversationalIntakeSkipped] = useState<ConversationalIntakeStepKey[]>([]);
  const [layoutVariantIndex, setLayoutVariantIndex] = useState(0);
  const [variantCount, setVariantCount] = useState(1);
  /** When set, sent as `variantSeed` on full/generate; each build can use a fresh UUID for layout exploration. */
  const [exploreVariantSeed, setExploreVariantSeed] = useState<string | null>(null);
  const lastPipelineInputHashRef = useRef<string | null>(null);
  const [pipelineInputUnchangedWarning, setPipelineInputUnchangedWarning] = useState(false);
  const [schemaAlternates, setSchemaAlternates] = useState<
    Array<{ seed: string; schema: unknown; generationMeta?: SiteBuilderPipelineGenerationMeta }>
  >([]);
  /** When set, full generation produced alternates — user must pick a layout before continuing. */
  const [variantPickSession, setVariantPickSession] = useState<{
    primary: unknown;
    alternates: Array<{ seed: string; schema: unknown; generationMeta?: SiteBuilderPipelineGenerationMeta }>;
    primaryGenerationMeta?: SiteBuilderPipelineGenerationMeta;
  } | null>(null);
  const [deterministicFallbackNotice, setDeterministicFallbackNotice] = useState<string | null>(null);
  const [contentIntelligenceMeta, setContentIntelligenceMeta] = useState<SiteBuilderPipelineContentIntelligence | null>(
    null,
  );
  const [buildCritiqueMeta, setBuildCritiqueMeta] = useState<{
    critiqueScore: number;
    critiqueIssues?: string[];
    autoRepaired?: boolean;
  } | null>(null);
  const [inspirationPatternsUsedLast, setInspirationPatternsUsedLast] = useState(false);
  /** From last `step: "full"` response — used when confirming a multi-variant layout. */
  const [intelligenceRunId, setIntelligenceRunId] = useState<string | null>(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);
  const [sessionEditContextSnapshot, setSessionEditContextSnapshot] = useState<SessionEditContext | undefined>(undefined);
  const [siteType, setSiteType] = useState<SiteTypeOption>("auto");
  const [designDirection, setDesignDirection] = useState<DesignDir>("operator");
  const [styleIntensity, setStyleIntensity] = useState(58);
  const [web3VisualMode, setWeb3VisualMode] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [inspirationUrl, setInspirationUrl] = useState("");
  const [inspirationCompetitorUrls, setInspirationCompetitorUrls] = useState("");
  const [inspirationIndustryOnly, setInspirationIndustryOnly] = useState(false);
  const [inspirationBrief, setInspirationBrief] = useState<InspirationBrief | null>(null);
  const [inspirationAnalyzeBusy, setInspirationAnalyzeBusy] = useState(false);
  const [inspirationAnalyzeError, setInspirationAnalyzeError] = useState<string | null>(null);
  const [importWidgetKey, setImportWidgetKey] = useState("");
  const [importWidgetPlacement, setImportWidgetPlacement] = useState<"body_end" | "head_script" | "page_body_end">(
    "body_end",
  );
  /** Sub-states for URL import (server does fetch+parse+map in one request; we surface honest client phases). */
  const [blueprintImportPhase, setBlueprintImportPhase] = useState<
    "idle" | "fetching" | "parsing" | "mapping" | "preview-ready" | "partial-import" | "failed"
  >("idle");
  const [blueprintImportDetail, setBlueprintImportDetail] = useState<string | null>(null);
  const [builderActionsDraft, setBuilderActionsDraft] = useState<string>('{\n  "actions": []\n}');
  const [planner, setPlanner] = useState<PlannerOut | null>(null);
  const [llmEnriched, setLlmEnriched] = useState<boolean | null>(null);
  /** Short line from last full build: model + provider when LLM structured output succeeded. */
  const [plannerLlmStatusLine, setPlannerLlmStatusLine] = useState<string | null>(null);
  const [plannerLlmFallbackDetail, setPlannerLlmFallbackDetail] = useState<{
    reason?: string;
    model?: string;
    provider?: string;
  } | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationOut | null>(null);
  const [uncontrolledSectionIds, setUncontrolledSectionIds] = useState<string[]>([]);
  const refineMultiControlled =
    Array.isArray(refineTargetSectionIds) && typeof onRefineTargetSectionIdsChange === "function";
  const refineSingleControlled =
    typeof refineTargetSectionId === "string" && typeof onRefineTargetSectionIdChange === "function";

  const effectiveSectionIds = useMemo(() => {
    if (refineMultiControlled) {
      return normalizeRefineSectionIds(refineTargetSectionIds!, 3);
    }
    if (refineSingleControlled) {
      const id = refineTargetSectionId!.trim();
      return id ? [id] : [];
    }
    return normalizeRefineSectionIds(uncontrolledSectionIds, 3);
  }, [
    refineMultiControlled,
    refineSingleControlled,
    refineTargetSectionIds,
    refineTargetSectionId,
    uncontrolledSectionIds,
  ]);

  const sectionId = effectiveSectionIds[0] ?? "";
  const sectionIdsRef = useRef(effectiveSectionIds);
  useEffect(() => {
    sectionIdsRef.current = effectiveSectionIds;
  }, [effectiveSectionIds]);

  type NlAssistStrip =
    | { kind: "idle" }
    | { kind: "applying" }
    | { kind: "applied"; message: string }
    | { kind: "clarify"; message: string }
    | { kind: "error"; message: string };

  const [nlAssistStrip, setNlAssistStrip] = useState<NlAssistStrip>({ kind: "idle" });
  /** Shown during full builds only; cleared when the request finishes. */
  const [autoBuildProgressLabel, setAutoBuildProgressLabel] = useState<string | null>(null);
  /** Sub-states during full build (Building → Critiquing → Improving). */
  const [assistantBuildPhase, setAssistantBuildPhase] = useState<AssistantUiBuildPhase>("idle");
  const [showBuildRetry, setShowBuildRetry] = useState(false);
  const [buildDebugInfo, setBuildDebugInfo] = useState<BuildDebugInfo>({
    stage: "idle",
    apiDurationMs: null,
    schemaApplied: false,
    variantPickerOpened: false,
  });
  const [chatMessages, setChatMessages] = useState<AssistantChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastExecuteIntentChatReplyRef = useRef<string | null>(null);
  const chatHydratedFromSessionRef = useRef(false);
  const executeIntentSessionId = useMemo(
    () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `sess-${Date.now()}`),
    [],
  );

  const primaryEditorPageSlug = useCallback((): string => {
    try {
      const d = JSON.parse(schemaText) as { pages?: Array<{ slug?: string }> };
      const s = d.pages?.[0]?.slug;
      return typeof s === "string" && s.length > 0 ? s : "/";
    } catch {
      return "/";
    }
  }, [schemaText]);

  function armAutoBuildProgressTimers(input: SitePlannerInput) {
    let working = createInstantSkeletonSchema(input);
    applyPipelineGeneratedSchema(working);
    setAssistantBuildPhase("building");
    setAutoBuildProgressLabel("Building structure…");
    const schedule = (
      delayMs: number,
      phase: StreamingBuildPhase,
      label: string,
      uiPhase: AssistantUiBuildPhase,
    ) =>
      window.setTimeout(() => {
        working = applyStreamingBuildPhasePatch(working, phase, input);
        applyPipelineGeneratedSchema(working);
        setAssistantBuildPhase(uiPhase);
        setAutoBuildProgressLabel(label);
      }, delayMs);

    const t1 = schedule(850, "content", "Generating content…", "building");
    const t2 = schedule(1800, "design", "Refining design…", "improving");
    const t3 = schedule(3000, "finalizing", "Finalizing…", "improving");
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      setAutoBuildProgressLabel(null);
      setAssistantBuildPhase("idle");
    };
  }

  function markBuildStage(stage: string, patch?: Partial<BuildDebugInfo>) {
    setBuildDebugInfo((prev) => ({
      ...prev,
      stage,
      ...(patch ?? {}),
    }));
  }

  function assertPreviewSchemaOrThrow(schema: unknown): void {
    const parsed = SiteSchemaDocument.safeParse(schema);
    if (!parsed.success) {
      throw new Error("Schema validation failed for generated preview.");
    }
    const home = parsed.data.pages.find((p) => p.slug === "/") ?? parsed.data.pages[0];
    const blocks = Array.isArray(home?.blocks) ? home.blocks : [];
    if (blocks.length === 0) {
      throw new Error("Generated schema has no home page blocks.");
    }
  }

  function syncStephonNpcMessage(role: AssistantChatRole, content: string) {
    if (role !== "user" && role !== "assistant") return;
    if (!shouldPersistChatMessage({ role, content })) return;
    void fetch("/api/site-builder/assistant/npc-sync", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId: builderSiteId?.trim() || null,
        role,
        content,
        topic: builderSiteId?.trim() || "draft",
      }),
    }).catch(() => undefined);
  }

  function pushChatMessage(role: AssistantChatRole, content: string) {
    const t = content.trim();
    if (!t) return;
    setChatMessages((prev) => {
      if (shouldSkipConsecutiveChatMessage(prev, role, t)) return prev;
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `m-${Date.now()}-${Math.random()}`;
      const next: AssistantChatMessage[] = [...prev, { id, role, content: t, at: Date.now() }];
      return next.length > ASSISTANT_CHAT_MAX ? next.slice(-ASSISTANT_CHAT_MAX) : next;
    });
    syncStephonNpcMessage(role, t);
  }

  function pushClientSitePostBuildNudge() {
    const gateCid = (fullBuildClientGate?.revenueOsClientId ?? "").trim();
    const pick = handoffSiteClientId.trim() || gateCid;
    if (!buildForClient && !pick) return;
    pushChatMessage(
      "assistant",
      "This site is ready for your client. Attach an AI agent to capture leads? Use the post-layout attach card, Advanced → Agency widget, or ask me to sync client portal metadata.",
    );
  }

  const clearAssistantChat = useCallback(() => {
    setChatMessages([]);
    setNlAssistStrip({ kind: "idle" });
    setConversationalIntakeActive(false);
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(chatStorageKey(builderSiteId));
        sessionStorage.removeItem(`site-builder-conversational-intake-v1:${(builderSiteId ?? "draft").trim() || "draft"}`);
      }
    } catch {
      /* ignore */
    }
  }, [builderSiteId]);

  const conversationalIntakeStorageKey = useCallback(
    () => `site-builder-conversational-intake-v1:${(builderSiteId ?? "draft").trim() || "draft"}`,
    [builderSiteId],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem(conversationalIntakeStorageKey());
      if (!raw) return;
      const o = JSON.parse(raw) as {
        active?: boolean;
        answers?: Partial<Record<ConversationalIntakeStepKey, string>>;
        skipped?: ConversationalIntakeStepKey[];
      };
      if (o.active) setConversationalIntakeActive(true);
      if (o.answers && typeof o.answers === "object") setConversationalIntakeAnswers(o.answers);
      if (Array.isArray(o.skipped)) setConversationalIntakeSkipped(o.skipped);
    } catch {
      /* ignore */
    }
  }, [builderSiteId, conversationalIntakeStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        conversationalIntakeStorageKey(),
        JSON.stringify({
          active: conversationalIntakeActive,
          answers: conversationalIntakeAnswers,
          skipped: conversationalIntakeSkipped,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [
    builderSiteId,
    conversationalIntakeStorageKey,
    conversationalIntakeActive,
    conversationalIntakeAnswers,
    conversationalIntakeSkipped,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    chatHydratedFromSessionRef.current = false;
    const key = chatStorageKey(builderSiteId);
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) {
        setChatMessages([]);
        return;
      }
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return;
      }
      const out: AssistantChatMessage[] = [];
      for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        if (o.role !== "user" && o.role !== "assistant") continue;
        const content = String(o.content ?? "");
        if (!content.trim()) continue;
        out.push({
          id: String(o.id ?? `m-${out.length}`),
          role: o.role,
          content: content.slice(0, 12000),
          at: typeof o.at === "number" ? o.at : Date.now(),
        });
      }
      const capped = out.length > ASSISTANT_CHAT_MAX ? out.slice(-ASSISTANT_CHAT_MAX) : out;
      setChatMessages(filterChatMessagesForStorage(capped));
    } catch {
      /* ignore */
    } finally {
      chatHydratedFromSessionRef.current = true;
    }
  }, [builderSiteId]);

  useEffect(() => {
    if (typeof window === "undefined" || !chatHydratedFromSessionRef.current) return;
    try {
      const storable = filterChatMessagesForStorage(chatMessages);
      sessionStorage.setItem(chatStorageKey(builderSiteId), JSON.stringify(storable));
    } catch {
      /* ignore */
    }
  }, [builderSiteId, chatMessages]);

  useEffect(() => {
    if (!chatMessages.length) return;
    try {
      chatEndRef.current?.scrollIntoView({ block: "end" });
    } catch {
      /* ignore */
    }
  }, [chatMessages.length, busy]);

  useEffect(() => {
    setNlAssistStrip((prev) =>
      prev.kind === "applied" || prev.kind === "clarify" || prev.kind === "error" ? { kind: "idle" } : prev,
    );
  }, [userPrompt]);

  const applyRestoredSelection = useCallback(
    (nextSchemaJson: string, priorIds: string[]) => {
      const filtered = filterSectionIdsStillInSchema(nextSchemaJson, priorIds);
      if (refineMultiControlled) {
        onRefineTargetSectionIdsChange!(filtered);
      } else if (refineSingleControlled) {
        onRefineTargetSectionIdChange!(filtered[0] ?? "");
      } else {
        setUncontrolledSectionIds(filtered);
      }
    },
    [refineMultiControlled, refineSingleControlled, onRefineTargetSectionIdsChange, onRefineTargetSectionIdChange],
  );

  function setRefineSectionTargets(next: string[]) {
    const norm = normalizeRefineSectionIds(next, 3);
    if (refineMultiControlled) {
      onRefineTargetSectionIdsChange!(norm);
    } else if (refineSingleControlled) {
      onRefineTargetSectionIdChange!(norm[0] ?? "");
    } else {
      setUncontrolledSectionIds(norm);
    }
  }

  function setRefineSectionTargetSingle(next: string) {
    setRefineSectionTargets(next.trim() ? [next.trim()] : []);
  }

  function removeRefineTarget(id: string) {
    setRefineSectionTargets(effectiveSectionIds.filter((x) => x !== id));
  }

  const heroMediaFileInputRef = useRef<HTMLInputElement>(null);
  const sessionEditContextRef = useRef<SessionEditContext | undefined>(undefined);
  const [brandBrainUiTick, setBrandBrainUiTick] = useState(0);
  const brandBrainShownKeysRef = useRef<Set<string>>(new Set());
  const [agencyUiTick, setAgencyUiTick] = useState(0);
  const agencyShownKeysRef = useRef<Set<string>>(new Set());
  const [importRestructureUiTick, setImportRestructureUiTick] = useState(0);
  const [handoffPreviewOpen, setHandoffPreviewOpen] = useState(false);
  const importRestructureShownKeysRef = useRef<Set<string>>(new Set());
  const importAuditFingerprintRef = useRef<string>("");
  const [refinementAnswers, setRefinementAnswers] = useState<SiteBuilderRefinementAnswers>({
    heroBackgroundType: undefined,
    heroBackgroundValue: "",
    heroBackgroundBehavior: "scroll",
    heroBackgroundFallbackColor: "#0f172a",
    heroBackgroundSource: "url",
    mediaPreference: "generated",
    colorScheme: "dark_default",
    motionFeel: "animated",
    deploymentTarget: "static",
    routingMode: "single_page",
    assetStrategy: "local_bundle",
  });

  const [payPalForm, setPayPalForm] = useState(emptyPayPalFormState);

  useEffect(() => {
    setPipelineInputUnchangedWarning(false);
  }, [
    businessName,
    primaryOffer,
    audience,
    userPrompt,
    industry,
    market,
    intakeConversionGoal,
    intakeBrandTone,
    intakeDesignPreference,
    inspirationCompetitorUrls,
    intakeTrustAndProof,
    siteType,
    designDirection,
    styleIntensity,
    web3VisualMode,
    layoutVariantIndex,
    exploreVariantSeed,
    variantCount,
  ]);

  useEffect(() => {
    try {
      const doc = JSON.parse(schemaText) as { metadata?: { paymentIntegration?: unknown } };
      const p = doc?.metadata?.paymentIntegration;
      const v = PaymentIntegrationSchema.safeParse(p);
      if (v.success) {
        const pi = v.data;
        setPayPalForm({
          enabled: true,
          mode: pi.mode,
          intent: pi.intent,
          placement: pi.placement,
          pageSlug: pi.pageSlug ?? "",
          paymentLink: pi.paypal?.paymentLink ?? "",
          buttonHtml: pi.paypal?.buttonHtml ?? "",
          clientId: pi.paypal?.clientId ?? "",
          environment: pi.paypal?.environment === "live" ? "live" : "sandbox",
          currency: pi.paypal?.currency ?? "USD",
        });
      } else {
        setPayPalForm(emptyPayPalFormState());
      }
    } catch {
      setPayPalForm(emptyPayPalFormState());
    }
  }, [schemaText]);

  function trackDeploymentChoice(patch: Partial<Pick<SiteBuilderRefinementAnswers, "deploymentTarget" | "routingMode" | "assetStrategy">>) {
    const deployment_target = (patch.deploymentTarget ?? refinementAnswers.deploymentTarget ?? "static") as string;
    const routing_mode = (patch.routingMode ?? refinementAnswers.routingMode ?? "single_page") as string;
    const asset_strategy = (patch.assetStrategy ?? refinementAnswers.assetStrategy ?? "local_bundle") as string;
    trackSiteBuilderEvent("site_builder_deployment_target_selected", {
      workflow_stage: workflowStage,
      deployment_target,
      routing_mode,
      asset_strategy,
    });
  }

  function buildRefinementPayload(): SiteBuilderRefinementAnswers | undefined {
    const r = refinementAnswers;
    const out: SiteBuilderRefinementAnswers = {
      deploymentTarget: r.deploymentTarget ?? "static",
      routingMode: r.routingMode ?? "single_page",
      assetStrategy: r.assetStrategy ?? "local_bundle",
    };
    if (r.heroBackgroundType === "color" && r.heroBackgroundValue?.trim()) {
      out.heroBackgroundType = "color";
      out.heroBackgroundValue = r.heroBackgroundValue.trim();
      out.heroBackgroundBehavior = r.heroBackgroundBehavior;
      if (r.heroBackgroundFallbackColor?.trim()) out.heroBackgroundFallbackColor = r.heroBackgroundFallbackColor.trim();
    } else if (r.heroBackgroundType === "image" || r.heroBackgroundType === "video") {
      const v = r.heroBackgroundValue?.trim();
      const aid = r.heroBackgroundAssetId?.trim();
      if (v || aid) {
        out.heroBackgroundType = r.heroBackgroundType;
        if (v) out.heroBackgroundValue = v;
        if (aid) out.heroBackgroundAssetId = aid;
        if (r.heroBackgroundSource) out.heroBackgroundSource = r.heroBackgroundSource;
        out.heroBackgroundBehavior = r.heroBackgroundBehavior;
        if (r.heroBackgroundFallbackColor?.trim()) out.heroBackgroundFallbackColor = r.heroBackgroundFallbackColor.trim();
      }
    }
    if (r.mediaPreference) out.mediaPreference = r.mediaPreference;
    if (r.colorScheme) out.colorScheme = r.colorScheme;
    if (r.motionFeel) out.motionFeel = r.motionFeel;
    return Object.keys(out).length ? out : undefined;
  }

  function extractSiteBuilderAssetsFromSchemaText(): Record<string, SiteBuilderAssetRecord> | undefined {
    try {
      const doc = JSON.parse(schemaText) as { metadata?: { siteBuilderAssets?: Record<string, SiteBuilderAssetRecord> } };
      const a = doc?.metadata?.siteBuilderAssets;
      if (a && typeof a === "object" && Object.keys(a).length) return a;
    } catch {
      /* ignore */
    }
    return undefined;
  }

  function computeMergedNormalizedSchema(incomingJson: string, mergeBaseJson: string): string {
    try {
      const next = JSON.parse(incomingJson) as { metadata?: { siteBuilderAssets?: Record<string, SiteBuilderAssetRecord> } };
      const prev = JSON.parse(mergeBaseJson) as { metadata?: { siteBuilderAssets?: Record<string, SiteBuilderAssetRecord> } };
      const prevAssets = prev?.metadata?.siteBuilderAssets;
      if (prevAssets && typeof prevAssets === "object") {
        next.metadata = next.metadata ?? {};
        next.metadata.siteBuilderAssets = { ...prevAssets, ...(next.metadata.siteBuilderAssets ?? {}) };
      }
      return normalizeSchemaJsonStringForTargeting(JSON.stringify(next, null, 2));
    } catch {
      return normalizeSchemaJsonStringForTargeting(incomingJson);
    }
  }

  function applySchemaMergingSiteAssets(schemaJson: string, mergeBase?: string) {
    const base = mergeBase ?? schemaText;
    onApplySchema(computeMergedNormalizedSchema(schemaJson, base));
  }

  function mergeUploadedAssetIntoSchema(asset: SiteBuilderAssetRecord) {
    const doc = JSON.parse(schemaText) as {
      metadata?: { siteBuilderAssets?: Record<string, SiteBuilderAssetRecord> };
      pages?: Array<{ blocks?: Array<{ type?: string; content?: Record<string, unknown> }> }>;
    };
    doc.metadata = doc.metadata ?? {};
    doc.metadata.siteBuilderAssets = { ...(doc.metadata.siteBuilderAssets ?? {}), [asset.assetId]: asset };
    const page = doc.pages?.[0];
    const hero = page?.blocks?.find((b) => b.type === "hero");
    const hbType = refinementAnswers.heroBackgroundType;
    if (hero && (hbType === "image" || hbType === "video")) {
      const c = (hero.content = hero.content ?? {}) as Record<string, unknown>;
      const vis = { ...((c.visual as Record<string, unknown>) ?? {}) };
      vis.background = {
        type: hbType,
        value: asset.publicUrl,
        assetId: asset.assetId,
        behavior: refinementAnswers.heroBackgroundBehavior ?? "scroll",
        fallbackColor: refinementAnswers.heroBackgroundFallbackColor?.trim() || "#0f172a",
        mimeType: asset.mimeType,
      };
      c.visual = vis;
    }
    onApplySchema(JSON.stringify(doc, null, 2));
  }

  function mergeAssetIntoMetadataOnly(asset: SiteBuilderAssetRecord) {
    try {
      const doc = JSON.parse(schemaText) as {
        metadata?: { siteBuilderAssets?: Record<string, SiteBuilderAssetRecord> };
      };
      doc.metadata = doc.metadata ?? {};
      doc.metadata.siteBuilderAssets = { ...(doc.metadata.siteBuilderAssets ?? {}), [asset.assetId]: asset };
      onApplySchema(normalizeSchemaJsonStringForTargeting(JSON.stringify(doc, null, 2)));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not attach asset");
    }
  }

  async function uploadComposerImageAndStage(file: File) {
    if (!file.type.startsWith("image/")) {
      onError("Drop an image file (PNG, JPG, WebP, …).");
      return;
    }
    onError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/site-builder/assets", { method: "POST", body: form, credentials: "include" });
    const data = (await res.json().catch(() => ({}))) as { asset?: SiteBuilderAssetRecord; error?: string };
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    if (!data.asset) throw new Error("Invalid upload response");
    mergeAssetIntoMetadataOnly(data.asset);
    setComposerImageAttachments((prev) => [
      ...prev,
      {
        assetId: data.asset!.assetId,
        publicUrl: data.asset!.publicUrl ?? "",
        mimeType: data.asset!.mimeType,
        name: file.name,
      },
    ]);
    onNotice(
      `Attached “${file.name}”. Say where to use it (hero background, banner, card, gallery, logo), then press Enter.`,
    );
    trackSiteBuilderEvent("site_builder_composer_image_attached", { workflow_stage: workflowStage });
  }

  function removeHeroUploadedAsset() {
    const id = refinementAnswers.heroBackgroundAssetId;
    if (!id) return;
    trackSiteBuilderEvent("site_builder_asset_removed", {
      workflow_stage: workflowStage,
      deployment_target: refinementAnswers.deploymentTarget ?? "static",
      asset_strategy: refinementAnswers.assetStrategy ?? "local_bundle",
      asset_kind: refinementAnswers.heroBackgroundType === "video" ? "video" : "image",
    });
    try {
      const doc = JSON.parse(schemaText) as {
        metadata?: { siteBuilderAssets?: Record<string, unknown> };
        pages?: Array<{ blocks?: Array<{ type?: string; content?: Record<string, unknown> }> }>;
      };
      if (doc.metadata?.siteBuilderAssets?.[id]) delete doc.metadata.siteBuilderAssets[id];
      const hero = doc.pages?.[0]?.blocks?.find((b) => b.type === "hero");
      if (hero?.content) {
        const c = hero.content as Record<string, unknown>;
        const vis = { ...((c.visual as Record<string, unknown>) ?? {}) };
        const bg = vis.background as Record<string, unknown> | undefined;
        if (bg?.assetId === id) delete vis.background;
        c.visual = vis;
      }
      setRefinementAnswers((s) => ({
        ...s,
        heroBackgroundAssetId: undefined,
        heroBackgroundSource: "url",
        heroBackgroundValue: "",
      }));
      onApplySchema(JSON.stringify(doc, null, 2));
      onNotice("Removed uploaded background file.");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not remove asset");
    }
  }

  async function uploadHeroBackgroundFile(file: File | null) {
    if (!file) return;
    const t = refinementAnswers.heroBackgroundType;
    if (t !== "image" && t !== "video") {
      onError("Choose image or video for the hero background first.");
      return;
    }
    if (t === "image" && !file.type.startsWith("image/")) {
      onError("Use an image file for an image background.");
      return;
    }
    if (t === "video" && file.type !== "video/mp4") {
      onError("Use an MP4 file for a video background.");
      return;
    }
    onError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/site-builder/assets", { method: "POST", body: form, credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { asset?: SiteBuilderAssetRecord; error?: string };
      if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
      if (!data.asset) throw new Error("Invalid upload response");
      const asset = data.asset;
      trackSiteBuilderEvent("site_builder_asset_uploaded", {
        workflow_stage: workflowStage,
        deployment_target: refinementAnswers.deploymentTarget ?? "static",
        asset_strategy: refinementAnswers.assetStrategy ?? "local_bundle",
        asset_kind: asset.kind,
      });
      mergeUploadedAssetIntoSchema(asset);
      setRefinementAnswers((s) => ({
        ...s,
        heroBackgroundSource: "upload",
        heroBackgroundAssetId: asset.assetId,
        heroBackgroundValue: asset.publicUrl,
      }));
      onNotice("File saved—preview updated. Use “Bundle locally” in export to include it in the ZIP.");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      if (heroMediaFileInputRef.current) heroMediaFileInputRef.current.value = "";
    }
  }

  const sectionOptions = useMemo(() => {
    try {
      const doc = JSON.parse(schemaText) as {
        pages?: Array<{
          slug?: string;
          blocks?: Array<{ type?: string; content?: { aiSectionId?: string } }>;
        }>;
      };
      const out: { id: string; label: string }[] = [];
      for (const p of doc.pages || []) {
        const slug = String(p.slug ?? "/").trim() || "/";
        for (const b of p.blocks || []) {
          const id = String(b?.content?.aiSectionId || "").trim();
          if (!id) continue;
          const friendly = sectionTypeToFriendlyLabel(String(b?.type || ""));
          const shortId = id.length > 14 ? `${id.slice(0, 12)}…` : id;
          out.push({
            id,
            label: slug === "/" ? `${friendly} · ${shortId}` : `${slug} · ${friendly}`,
          });
        }
      }
      return out;
    } catch {
      return [];
    }
  }, [schemaText]);

  const sectionPlanList = useMemo(() => {
    const plan = planner as { sectionPlan?: Array<{ id?: string; registryKey?: string; headline?: string; purpose?: string }> } | null;
    return Array.isArray(plan?.sectionPlan) ? plan!.sectionPlan! : [];
  }, [planner]);

  function getIntakeFields(): SiteBuilderIntakeFields {
    return {
      businessName,
      primaryOffer,
      audience,
      industry,
      market,
      additionalNotes: userPrompt,
      conversionGoal: intakeConversionGoal,
      brandTone: intakeBrandTone,
      designPreference: intakeDesignPreference,
      inspirationWebsites: inspirationCompetitorUrls,
      trustAndProof: intakeTrustAndProof,
    };
  }

  function applyConversationalAnswerToForm(key: ConversationalIntakeStepKey, raw: string) {
    const v = raw.trim();
    switch (key) {
      case "businessName":
        setBusinessName(v);
        break;
      case "industry":
        setIndustry(v);
        break;
      case "primaryOffer":
        setPrimaryOffer(v);
        break;
      case "audience":
        setAudience(v);
        break;
      case "conversionGoal":
        setIntakeConversionGoal(v);
        break;
      case "brandTone":
        setIntakeBrandTone(v);
        break;
      case "designPreference":
        setIntakeDesignPreference(v);
        break;
      case "inspirationWebsites":
        setInspirationCompetitorUrls(v);
        break;
      case "trustAndProof":
        setIntakeTrustAndProof(v);
        break;
      default:
        break;
    }
  }

  function startConversationalIntake() {
    onError(null);
    setConversationalIntakeActive(true);
    setConversationalIntakeAnswers({});
    setConversationalIntakeSkipped([]);
    const first = getNextConversationalIntakeStep({}, []);
    if (first) {
      pushChatMessage(
        "assistant",
        `${first.prompt} (${first.completedBefore + 1}/${first.total}) — type "skip" to skip a question or "exit" to stop.`,
      );
    }
  }

  function hasMeaningfulPipelineBrief(): boolean {
    const i = getIntakeFields();
    return Boolean(
      i.businessName.trim() ||
        i.primaryOffer.trim() ||
        i.audience.trim() ||
        i.industry.trim() ||
        i.market.trim() ||
        i.additionalNotes.trim() ||
        i.conversionGoal.trim() ||
        i.brandTone.trim() ||
        i.designPreference.trim() ||
        i.inspirationWebsites.trim() ||
        i.trustAndProof.trim(),
    );
  }

  /** Single source for plan/full/regen: structured intake + design controls → `SitePlannerInput`. */
  function baseInput(): SitePlannerInput {
    const fromIntake = intakeToSitePlannerInput(getIntakeFields(), {
      siteType,
      designDirection,
      styleIntensity,
      web3VisualMode,
      layoutVariantIndex,
      widgetKey: importWidgetKey.trim() || undefined,
      widgetPlacement: importWidgetPlacement,
    });
    const extra = inspirationCompetitorUrls
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 5);
    return {
      ...fromIntake,
      inspirationUrl: inspirationUrl.trim() || undefined,
      competitorUrls: extra.length > 0 ? extra : undefined,
      inspirationIndustryOnly: inspirationIndustryOnly || undefined,
      inspirationBrief: inspirationBrief ?? undefined,
    };
  }

  function applyPipelineGeneratedSchema(schema: unknown) {
    applySchemaMergingSiteAssets(JSON.stringify(schema, null, 2));
  }

  function confirmVariantSelection(index: number) {
    const session = variantPickSession;
    if (!session) return;
    const schema = index === 0 ? session.primary : session.alternates[index - 1]?.schema;
    if (!schema) return;
    const runId = intelligenceRunId;
    const totalVariants = 1 + session.alternates.length;
    applyPipelineGeneratedSchema(schema);
    setVariantPickSession(null);
    setIntelligenceRunId(null);
    setSchemaAlternates([]);
    setSelectedVariantIndex(index);
    postIntelligenceVariantSelection(runId, index, totalVariants);
    try {
      const sid = builderSiteId?.trim();
      if (sid) sessionStorage.setItem(`site-builder-selected-variant:${sid}`, String(index));
    } catch {
      /* ignore */
    }
    emitBrandBrainAnalyticsForSchema(schema, workflowStage);
    emitAgencyLaunchAnalyticsForSchema(schema, workflowStage);
    const letter = String.fromCharCode(65 + index);
    onNotice(`Layout ${letter} is now in the preview—open Refine to edit sections and copy.`);
    onAiEditCompleted?.({
      changedSectionIds: [],
      headline: `Layout ${letter} applied`,
      scope: "full",
    });
    onVariantSelectionComplete?.({ selectedIndex: index, schemaHasWidget: schemaHasWidgetIntegration(schema) });
    try {
      const s = String(
        (schema as { metadata?: { seoAssistantSummary?: string } })?.metadata?.seoAssistantSummary ?? "",
      ).trim();
      if (s) pushChatMessage("assistant", s);
    } catch {
      /* ignore */
    }
  }

  function regenPartialInputFromBase() {
    const p = baseInput();
    return {
      userPrompt: p.userPrompt,
      industry: p.industry,
      market: p.market,
      businessName: p.businessName,
      primaryOffer: p.primaryOffer,
      audience: p.audience,
      siteType: p.siteType,
      designDirection: p.designDirection,
      styleIntensity: p.styleIntensity,
      web3VisualMode: p.web3VisualMode,
      inspirationUrl: p.inspirationUrl,
      competitorUrls: p.competitorUrls,
      inspirationIndustryOnly: p.inspirationIndustryOnly,
      inspirationBrief: p.inspirationBrief,
      statedConversionGoal: p.statedConversionGoal,
      statedBrandTone: p.statedBrandTone,
      statedDesignPreference: p.statedDesignPreference,
      statedTrustAndProof: p.statedTrustAndProof,
    };
  }

  async function runInspirationAnalysis() {
    setInspirationAnalyzeError(null);
    if (inspirationIndustryOnly) {
      if (!industry.trim()) {
        setInspirationAnalyzeError('Set "Industry" above, or add an https URL and turn off industry-only mode.');
        return;
      }
    } else {
      const primary = inspirationUrl.trim();
      const more = inspirationCompetitorUrls
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (!primary && more.length === 0) {
        setInspirationAnalyzeError("Add at least one https URL, or enable industry-only and set your industry.");
        return;
      }
    }
    setInspirationAnalyzeBusy(true);
    try {
      const more = inspirationCompetitorUrls
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const data = await jsonFetch<{ inspirationBrief: InspirationBrief }>("/api/site-builder/inspiration/analyze", {
        method: "POST",
        timeoutMs: 25_000,
        body: JSON.stringify({
          url: inspirationUrl.trim() || undefined,
          urls: more.length > 0 ? more : undefined,
          industry: industry.trim() || undefined,
          industryOnly: inspirationIndustryOnly,
        }),
      });
      setInspirationBrief(data.inspirationBrief);
    } catch (e) {
      setInspirationAnalyzeError(e instanceof Error ? e.message : "Inspiration analysis failed.");
    } finally {
      setInspirationAnalyzeBusy(false);
    }
  }

  function inputAnalyticsProps(): SiteBuilderAnalyticsProps {
    return {
      workflow_stage: workflowStage,
      site_type: siteType,
      design_direction: designDirection,
      style_intensity: styleIntensity,
      web3_visual_mode: web3VisualMode,
    };
  }

  /** Fire-and-forget — does not throw; never blocks `confirmVariantSelection` or schema application. */
  function postIntelligenceVariantSelection(runId: string | null, selectedIndex: number, totalVariantCount: number) {
    const id = runId?.trim() || null;
    if (!id) return;
    let payload: ReturnType<typeof computeVariantSelectionIndices>;
    try {
      payload = computeVariantSelectionIndices(selectedIndex, totalVariantCount);
    } catch {
      trackSiteBuilderEvent("site_builder_variant_selection_record_failed", { ...inputAnalyticsProps(), reason: "invalid_indices" });
      return;
    }
    void (async () => {
      try {
        const res = await fetch("/api/site-builder/ai/intelligence/variant-selection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId: id,
            selectedIndex: payload.selectedIndex,
            rejectedIndices: payload.rejectedIndices,
          }),
        });
        if (res.ok) {
          trackSiteBuilderEvent("site_builder_variant_selection_recorded", {
            ...inputAnalyticsProps(),
            selected_index: payload.selectedIndex,
            rejected_count: payload.rejectedIndices.length,
          });
        } else {
          trackSiteBuilderEvent("site_builder_variant_selection_record_failed", {
            ...inputAnalyticsProps(),
            http_status: res.status,
          });
        }
      } catch {
        trackSiteBuilderEvent("site_builder_variant_selection_record_failed", { ...inputAnalyticsProps(), reason: "network" });
      }
    })();
  }

  /** Passed to AI pipeline requests so per-site LLM settings apply. */
  function pipelineSitePayload(): Record<string, string> {
    const o: Record<string, string> = {};
    if (builderSiteId?.trim()) o.siteId = builderSiteId.trim();
    return o;
  }

  async function runAssistantProposedBuilderActions(
    actions: BuilderAction[],
    source: "ai_panel" | "manual" = "ai_panel",
    options?: { assistantReplyPrefix?: string; pulseFromActions?: boolean; schemaJson?: string },
  ): Promise<{
    schemaChanged: boolean;
    hadHttpError: boolean;
    partialFailures: boolean;
    summary: string;
    appliedSchema?: unknown;
  }> {
    onError(null);
    const schemaSrc = options?.schemaJson ?? schemaText;
    let doc: unknown;
    try {
      doc = JSON.parse(schemaSrc);
    } catch {
      onError("Current schema is not valid JSON — fix the page JSON first.");
      return { schemaChanged: false, hadHttpError: false, partialFailures: true, summary: "invalid schema JSON", appliedSchema: undefined };
    }
    if (!Array.isArray(actions) || !actions.length) {
      onError("No builder actions to apply.");
      return { schemaChanged: false, hadHttpError: false, partialFailures: true, summary: "no actions", appliedSchema: undefined };
    }
    const hashBefore = hashSiteSchema(doc);
    const res = await fetch("/api/site-builder/builder-actions", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        schemaJson: doc,
        actions,
        siteId: builderSiteId?.trim() || undefined,
        versionId: builderVersionId?.trim() || undefined,
        source,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      schema?: unknown;
      results?: Array<{ action?: string; ok?: boolean; message?: string; details?: unknown }>;
      error?: string;
    };
    if (!res.ok) {
      const bad = (data.results ?? []).filter((r) => !r.ok);
      const firstBad = bad[0];
      const msg =
        (typeof data.error === "string" && data.error.trim()) ||
        (firstBad ? `${firstBad.action || "action"}: ${firstBad.message || "failed"}` : "") ||
        `Builder actions failed (${res.status})`;
      console.error("[site-builder] builder-actions request failed", {
        httpStatus: res.status,
        actionTypes: actions.map((a) => a.action),
        message: msg,
        results: data.results,
      });
      onError(msg);
      return { schemaChanged: false, hadHttpError: true, partialFailures: true, summary: msg, appliedSchema: undefined };
    }
    if (data.schema) {
      applyPipelineGeneratedSchema(data.schema);
    }
    const hashAfter = data.schema !== undefined && data.schema !== null ? hashSiteSchema(data.schema) : hashBefore;
    const schemaChanged = hashAfter !== hashBefore;
    const bad = (data.results ?? []).filter((r) => !r.ok);
    const hint = bad.length
      ? `Some actions failed: ${bad.map((b) => `${b.action}: ${b.message || "error"}`).join("; ")}`
      : "Builder actions applied.";
    if (bad.length) {
      console.error("[site-builder] builder-actions partial failure", {
        actionTypes: actions.map((a) => a.action),
        results: data.results,
      });
    }
    const prefix = options?.assistantReplyPrefix?.trim();
    onNotice([prefix, hint].filter(Boolean).join(" — "));
    if (options?.pulseFromActions && !bad.length && schemaChanged) {
      const touched = builderActionTouchSectionIds(actions);
      const scope = touched.length > 0 ? ("section" as const) : ("full" as const);
      onAiEditCompleted?.({
        changedSectionIds: touched,
        headline: prefix || hint,
        scope,
      });
    }
    return {
      schemaChanged,
      hadHttpError: false,
      partialFailures: bad.length > 0,
      summary: hint,
      appliedSchema: data.schema,
    };
  }

  /**
   * NL edits for unsaved preview (no `builderSiteId`): deterministic map → `/api/site-builder/draft-apply` (no execute-intent, no DB audit rows).
   */
  async function tryDraftNlEdit(instr: string, doc: unknown): Promise<boolean> {
    const parsed = SiteSchemaDocument.safeParse(doc);
    if (!parsed.success) {
      lastExecuteIntentChatReplyRef.current = "I couldn’t apply that until the page JSON is valid. Fix the schema, then try again.";
      setNlAssistStrip({ kind: "error", message: "Could not apply — fix invalid schema JSON first." });
      onError("Current schema is not valid JSON — fix the page JSON first.");
      return true;
    }

    const behaviorDraft = analyzeAssistantPrompt(instr, {
      lastSectionIds: normalizeRefineSectionIds(effectiveSectionIds, 3),
      lastPageSlug: primaryEditorPageSlug(),
    });
    if (!behaviorDraft.canAct && behaviorDraft.clarificationQuestion) {
      lastExecuteIntentChatReplyRef.current = behaviorDraft.clarificationQuestion;
      setNlAssistStrip({ kind: "clarify", message: behaviorDraft.clarificationQuestion });
      onNotice(behaviorDraft.clarificationQuestion);
      return true;
    }

    const mapped = mapExecuteIntentMessage({
      message: instr,
      schema: parsed.data,
      editContext: {
        lastSectionIds: normalizeRefineSectionIds(effectiveSectionIds, 3),
        lastPageSlug: primaryEditorPageSlug(),
      },
    });

    const actionsAfterAttachTheme = tryAttachToThemeOnlyDraft(mapped.actions);
    const { safe, dropped } = filterDraftSafeBuilderActions(actionsAfterAttachTheme);

    if (mapped.meta.needsClarification && safe.length === 0) {
      const q =
        mapped.meta.clarificationQuestion?.trim() ||
        mapped.assistantReply?.trim() ||
        "What should change on this draft?";
      lastExecuteIntentChatReplyRef.current = q;
      setNlAssistStrip({ kind: "clarify", message: q });
      onNotice(q);
      return true;
    }

    if (safe.length === 0) {
      const msg =
        dropped.length > 0
          ? `That step needs a saved project (blocked: ${dropped.join(", ")}). Save the site first, or try theme, background, or adding a section.`
          : "Not sure how to apply that on an unsaved draft — try a theme/background change or name the section (hero, FAQ, pricing).";
      lastExecuteIntentChatReplyRef.current = msg;
      setNlAssistStrip({ kind: "clarify", message: msg });
      onNotice(msg);
      return true;
    }

    setNlAssistStrip({ kind: "applying" });
    try {
      const res = await fetch("/api/site-builder/draft-apply", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schemaJson: doc, actions: safe }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        schema?: unknown;
        error?: string;
        results?: Array<{ ok?: boolean }>;
      };

      if (!res.ok || !data.ok || !data.schema) {
        const msg = data.error || `Could not apply draft edit (${res.status}).`;
        lastExecuteIntentChatReplyRef.current = msg;
        setNlAssistStrip({ kind: "error", message: msg });
        onError(msg);
        return true;
      }

      const parsedAfter = SiteSchemaDocument.safeParse(data.schema);
      const followDraft =
        parsedAfter.success
          ? buildPostEditFollowup({
              actions: safe,
              schema: parsedAfter.data,
              lastPageSlug: primaryEditorPageSlug(),
              lastSectionIds: normalizeRefineSectionIds(effectiveSectionIds, 3),
            })
          : null;
      const line =
        [mapped.assistantReply?.trim() || "Applied to your draft preview.", followDraft].filter(Boolean).join(" ") ||
        "Applied to your draft preview.";
      lastExecuteIntentChatReplyRef.current = line;
      applySchemaMergingSiteAssets(JSON.stringify(data.schema, null, 2));
      persistDraftSchemaToSession(JSON.stringify(data.schema, null, 2));
      persistDraftContextToSession({
        updatedAt: new Date().toISOString(),
        lastAssistantReply: line,
        lastUserMessage: instr,
      });
      setNlAssistStrip({ kind: "applied", message: line });
      onAiEditCompleted?.({ changedSectionIds: [], headline: "Draft edit", scope: "full" });
      trackSiteBuilderEvent("site_builder_draft_apply", {
        ...inputAnalyticsProps(),
        action_count: safe.length,
      });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not apply draft edit";
      lastExecuteIntentChatReplyRef.current = msg;
      setNlAssistStrip({ kind: "error", message: msg });
      onError(msg);
      return true;
    }
  }

  /**
   * Natural-language → execute-intent → client builder-actions.
   * Returns true when the request was handled (applied, clarification, error, or hash refresh) and the caller should skip legacy pipelines.
   */
  async function tryExecuteIntentNlEdit(instr: string, opts?: { schemaJson?: string }): Promise<boolean> {
    lastExecuteIntentChatReplyRef.current = null;
    const siteId = builderSiteId?.trim();
    const schemaSrc = opts?.schemaJson ?? schemaText;

    let doc: unknown;
    try {
      doc = JSON.parse(schemaSrc);
    } catch {
      lastExecuteIntentChatReplyRef.current = "I couldn’t apply that until the page JSON is valid. Fix the schema, then try again.";
      setNlAssistStrip({
        kind: "error",
        message: "Could not apply — fix invalid schema JSON first.",
      });
      onError("Current schema is not valid JSON — fix the page JSON first.");
      return true;
    }

    if (!siteId && isSiteBuilderDraftMode(schemaSrc, builderSiteId)) {
      return tryDraftNlEdit(instr, doc);
    }

    if (!siteId) return false;

    const hash = hashSiteSchema(doc);
    setNlAssistStrip({ kind: "applying" });
    try {
      const res = await fetch("/api/site-builder/assistant/execute-intent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: instr,
          siteId,
          versionId: builderVersionId?.trim() || undefined,
          schemaSnapshotHash: hash,
          sessionId: executeIntentSessionId,
          editContext: {
            lastSectionIds: normalizeRefineSectionIds(effectiveSectionIds, 3),
            lastPageSlug: primaryEditorPageSlug(),
          },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        actions?: BuilderAction[];
        assistantReply?: string;
        meta?: { intent?: string; needsClarification?: boolean; clarificationQuestion?: string };
      };

      if (res.status === 409) {
        lastExecuteIntentChatReplyRef.current =
          "The site changed on the server. I refreshed the saved version—try your edit again.";
        onNotice("Site changed. Refreshing schema before applying edits.");
        setNlAssistStrip({
          kind: "error",
          message: "Site changed. Refreshing saved version — try your edit again.",
        });
        try {
          await onExecuteIntentSchemaConflict?.();
        } catch (e) {
          onError(e instanceof Error ? e.message : "Could not refresh schema");
        }
        return true;
      }

      if (!res.ok) {
        const msg = data.error || `Could not apply (${res.status}).`;
        lastExecuteIntentChatReplyRef.current = msg;
        setNlAssistStrip({ kind: "error", message: msg });
        onError(msg);
        trackSiteBuilderEvent("site_builder_execute_intent_failed", {
          ...inputAnalyticsProps(),
          reason: `${res.status}`,
        });
        return true;
      }

      const actions = Array.isArray(data.actions) ? data.actions : [];
      const meta = data.meta;

      if (actions.length > 0) {
        const applyResult = await runAssistantProposedBuilderActions(actions, "ai_panel", {
          assistantReplyPrefix: data.assistantReply?.trim(),
          pulseFromActions: true,
          schemaJson: schemaSrc,
        });
        if (applyResult.hadHttpError) {
          const msg = applyResult.summary || "Builder actions could not be applied.";
          lastExecuteIntentChatReplyRef.current = msg;
          setNlAssistStrip({ kind: "error", message: msg });
          trackSiteBuilderEvent("site_builder_execute_intent_failed", {
            ...inputAnalyticsProps(),
            reason: "builder_actions_http",
          });
          return true;
        }
        if (!applyResult.schemaChanged) {
          const msg =
            "That did not change the live layout—try rephrasing, pick a section on the canvas, or name a block (hero, pricing, FAQ).";
          lastExecuteIntentChatReplyRef.current = msg;
          setNlAssistStrip({ kind: "clarify", message: msg });
          onNotice(msg);
          trackSiteBuilderEvent("site_builder_execute_intent_no_op", {
            ...inputAnalyticsProps(),
            intent: typeof meta?.intent === "string" ? meta.intent : "unknown",
          });
          return true;
        }
        const parsedApplied = applyResult.appliedSchema ? SiteSchemaDocument.safeParse(applyResult.appliedSchema) : null;
        const followSaved =
          parsedApplied?.success === true
            ? buildPostEditFollowup({
                actions,
                schema: parsedApplied.data,
                lastPageSlug: primaryEditorPageSlug(),
                lastSectionIds: normalizeRefineSectionIds(effectiveSectionIds, 3),
              })
            : null;
        const lineBase = data.assistantReply?.trim() || "Applied your edit to the page.";
        const line = [lineBase, followSaved].filter(Boolean).join(" ");
        lastExecuteIntentChatReplyRef.current = line;
        setNlAssistStrip({
          kind: "applied",
          message: line,
        });
        trackSiteBuilderEvent("site_builder_execute_intent_applied", {
          ...inputAnalyticsProps(),
          action_count: actions.length,
          intent: typeof meta?.intent === "string" ? meta.intent : "unknown",
        });
        return true;
      }

      if (meta?.needsClarification) {
        const q = meta.clarificationQuestion?.trim() || data.assistantReply?.trim() || "Which part should change?";
        lastExecuteIntentChatReplyRef.current = q;
        setNlAssistStrip({ kind: "clarify", message: q });
        onNotice(q);
        return true;
      }

      if (data.assistantReply?.trim()) {
        const reply = data.assistantReply.trim();
        lastExecuteIntentChatReplyRef.current = reply;
        setNlAssistStrip({ kind: "clarify", message: reply });
        onNotice(reply);
        return true;
      }

      setNlAssistStrip({ kind: "idle" });
      return false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not apply edit";
      lastExecuteIntentChatReplyRef.current = msg;
      setNlAssistStrip({ kind: "error", message: msg });
      onError(msg);
      trackSiteBuilderEvent("site_builder_execute_intent_failed", {
        ...inputAnalyticsProps(),
        reason: msg.slice(0, 200),
      });
      return true;
    }
  }

  async function runBuilderActionsFromJson() {
    await withBusy(async () => {
      onError(null);
      let actions: unknown;
      try {
        const wrap = JSON.parse(builderActionsDraft) as { actions?: unknown };
        actions = wrap.actions;
      } catch {
        onError("Builder actions JSON must be valid JSON, with an actions array.");
        return;
      }
      if (!Array.isArray(actions)) {
        onError('Expected { "actions": [ ... ] }');
        return;
      }
      await runAssistantProposedBuilderActions(actions as BuilderAction[], "manual");
    });
  }

  async function parseAndApplyBuilderActionsFromCommand() {
    const actions = tryExtractBuilderActionsFromMessage(userPrompt);
    if (!actions) {
      onError('Paste JSON with an { "actions": [ ... ] } array (or a JSON array) from the assistant into the command bar, then try again.');
      return;
    }
    await withBusy(async () => {
      await runAssistantProposedBuilderActions(actions, "ai_panel");
    });
  }

  async function runSiteImport() {
    const url = importUrl.trim();
    if (!url) {
      onError("Enter a client site URL to import.");
      return;
    }
    let source_domain = "";
    try {
      source_domain = new URL(url).hostname;
    } catch {
      onError("That URL doesn’t look valid.");
      return;
    }
    const widget_attached = Boolean(importWidgetKey.trim());
    trackSiteBuilderEvent("site_builder_site_import_started", {
      source_domain,
      route_count: 0,
      widget_attached,
      workflow_stage: workflowStage,
    });
    await withBusy(async () => {
      onError(null);
      setBlueprintImportDetail(null);
      setBlueprintImportPhase("fetching");
      try {
        const res = await fetch("/api/site-builder/import", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            widgetKey: importWidgetKey.trim() || undefined,
            widgetPlacement: importWidgetPlacement,
            ...pipelineSitePayload(),
            ...(builderVersionId?.trim() ? { versionId: builderVersionId.trim() } : {}),
          }),
        });
        setBlueprintImportPhase("parsing");
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          code?: string;
          message?: string;
          schema?: unknown;
          notes?: string[];
          routeCount?: number;
          homeBlockCount?: number;
          partial?: boolean;
          emptyStructureFallback?: boolean;
          reconstructionPath?: string;
          importStage?: string;
        };
        if (!res.ok || !data.ok || !data.schema) {
          const msg = data.message || `Import failed (${res.status})`;
          setBlueprintImportPhase("failed");
          setBlueprintImportDetail(msg);
          trackSiteBuilderEvent("site_builder_site_import_failed", {
            source_domain,
            route_count: 0,
            widget_attached,
            workflow_stage: workflowStage,
            failure_code: typeof data.code === "string" ? data.code : "unknown",
          });
          throw new Error(msg);
        }
        setBlueprintImportPhase("mapping");
        applySchemaMergingSiteAssets(JSON.stringify(data.schema, null, 2));
        if (process.env.NODE_ENV === "development") {
          try {
            const doc = data.schema as {
              pages?: { blocks?: unknown[] }[];
              metadata?: {
                siteImport?: { reconstruction?: { path?: string }; emptyStructureFallback?: boolean };
              };
            };
            const bc = doc.pages?.[0]?.blocks?.length ?? 0;
            if (bc === 0) console.warn("[site-builder-import] Invariant broken: home page has zero blocks.");
            if (doc.metadata?.siteImport?.emptyStructureFallback) {
              console.warn("[site-builder-import] Server used empty-structure invariant repair — check source HTML quality.");
            }
            console.info("[site-builder-import] reconstruction:", doc.metadata?.siteImport?.reconstruction, {
              reconstructionPath: data.reconstructionPath,
              homeBlockCount: data.homeBlockCount,
            });
          } catch {
            /* ignore */
          }
        }
        emitBrandBrainAnalyticsForSchema(data.schema, workflowStage);
        emitAgencyLaunchAnalyticsForSchema(data.schema, workflowStage);
        const route_count = typeof data.routeCount === "number" ? data.routeCount : 0;
        trackSiteBuilderEvent("site_builder_import_blueprint_converted", {
          source_domain,
          route_count,
          widget_attached: Boolean(
            (data.schema as { metadata?: { widgetIntegration?: { widgetKey?: string } } })?.metadata?.widgetIntegration
              ?.widgetKey,
          ),
          workflow_stage: workflowStage,
        });
        trackSiteBuilderEvent("site_builder_site_import_completed", {
          source_domain,
          route_count,
          widget_attached: Boolean(
            (data.schema as { metadata?: { widgetIntegration?: { widgetKey?: string } } })?.metadata?.widgetIntegration
              ?.widgetKey,
          ),
          workflow_stage: workflowStage,
        });
        if (
          (data.schema as { metadata?: { widgetIntegration?: { widgetKey?: string } } })?.metadata?.widgetIntegration
            ?.widgetKey
        ) {
          trackSiteBuilderEvent("site_builder_widget_attached", {
            source_domain,
            route_count,
            widget_attached: true,
            workflow_stage: workflowStage,
          });
        }
        const noteExtra =
          Array.isArray(data.notes) && data.notes.length
            ? `\n\nNotes: ${data.notes.slice(0, 5).join(" · ")}`
            : "";
        const blocksHint =
          typeof data.homeBlockCount === "number"
            ? ` ${data.homeBlockCount} section(s) on the home route in preview.`
            : "";
        const partial =
          Boolean(data.partial) ||
          data.importStage === "partial-import" ||
          Boolean(data.emptyStructureFallback);
        setBlueprintImportPhase(partial ? "partial-import" : "preview-ready");
        setBlueprintImportDetail(
          partial
            ? "Partial import (SPA / limited HTML or weak extraction). The page is still usable—tighten copy, CTAs, and media next. Remote images may hotlink until you upload for export."
            : "Ready for redesign — preview matches your reconstructed blueprint.",
        );
        onNotice(
          `Imported public site structure into a redesign blueprint (not a pixel-perfect replica).${blocksHint} You can edit everything in Refine.${partial ? " Some areas may need manual cleanup—see the import note below the URL field." : ""}${noteExtra}`,
        );
        onImportBlueprintReady?.();
      } catch (e) {
        setBlueprintImportPhase((p) => (p === "failed" ? p : "failed"));
        onError(e instanceof Error ? e.message : "Import failed");
      }
    });
  }

  async function runPlan() {
    if (!hasMeaningfulPipelineBrief()) {
      onError("Add a goal in the command bar or fill at least one of business, offer, audience, industry, or market.");
      return;
    }
    await withBusy(async () => {
      onError(null);
      const input = baseInput();
      const h = hashPipelineInputPayload(input);
      if (lastPipelineInputHashRef.current === h) {
        setPipelineInputUnchangedWarning(true);
        onNotice("Input unchanged since your last run — the plan may look the same. Adjust the brief, layout profile (0–7), or a new layout seed below.");
      } else {
        setPipelineInputUnchangedWarning(false);
      }
      await runSiteBuilderTrackedAction({
        successEvent: "site_builder_plan_only_completed",
        failureEvent: "site_builder_plan_only_failed",
        baseProps: inputAnalyticsProps(),
        action: async () => {
          const data = await jsonFetch<{ planner: PlannerOut; llmEnriched: boolean }>("/api/site-builder/ai/pipeline", {
            method: "POST",
            body: JSON.stringify({ step: "plan", input, ...pipelineSitePayload() }),
          });
          setPlanner(data.planner);
          setLlmEnriched(data.llmEnriched);
          setEvaluation(null);
          onNotice(buildSiteBuilderEditExplanation({ command: buildNarrativeFromIntake(getIntakeFields()).trim() || userPrompt.trim(), scope: "plan" }));
          lastPipelineInputHashRef.current = h;
          setPipelineInputUnchangedWarning(false);
          return data;
        },
        mapSuccessProps: (data) => ({ llm_enriched: data.llmEnriched }),
      });
    });
  }

  async function runFullBuild(opts?: { source?: "panel" | "sticky_bar" }): Promise<FullBuildRunResult> {
    const v = validateIntakeForFullBuild(getIntakeFields(), fullBuildClientGate);
    if (!v.ok) {
      onError(v.message);
      const q = nextMissingIntakeQuestion(getIntakeFields());
      if (q) pushChatMessage("assistant", q.prompt);
      return { ok: false, variantPickPending: false, errorMessage: v.message };
    }
    const source = opts?.source ?? "panel";
    trackSiteBuilderEvent("site_builder_full_build_started", { ...inputAnalyticsProps(), source });
    let ok = false;
    let variantPickPending = false;
    let previewContentChanged = false;
    let pipelineError: string | undefined;
    let seoAssistantSummary: string | undefined;
    await withBusy(async () => {
      let disarmProgress = () => {};
      try {
        setShowBuildRetry(false);
        markBuildStage("client_submit", {
          apiDurationMs: null,
          schemaApplied: false,
          variantPickerOpened: false,
        });
        onError(null);
        setVariantPickSession(null);
        setIntelligenceRunId(null);
        setContentIntelligenceMeta(null);
        setPlannerLlmFallbackDetail(null);
        setInspirationPatternsUsedLast(false);
        setSelectedVariantIndex(null);
        const input = baseInput();
        disarmProgress = armAutoBuildProgressTimers(input);
        const h = hashPipelineInputPayload(input);
        if (lastPipelineInputHashRef.current === h) {
          setPipelineInputUnchangedWarning(true);
          onNotice(
            "Input unchanged since your last run — the generated page may look the same. Change the brief, layout profile, variant count, or layout seed.",
          );
        } else {
          setPipelineInputUnchangedWarning(false);
        }
        await runSiteBuilderTrackedAction({
          successEvent: "site_builder_full_build_completed",
          failureEvent: "site_builder_full_build_failed",
          baseProps: { ...inputAnalyticsProps(), source },
          action: async () => {
            let priorHash: string | null = null;
            try {
              priorHash = hashSiteSchema(JSON.parse(schemaText));
            } catch {
              priorHash = null;
            }
            const n = Math.min(3, Math.max(1, variantCount));
            const reqStarted = Date.now();
            markBuildStage("api_request_started");
            const data = await jsonFetch<{
              planner: PlannerOut;
              llmEnriched: boolean;
              llmModel?: string;
              llmProvider?: string;
              llmFallbackWarning?: string;
              schema: unknown;
              evaluation: EvaluationOut;
              schemaAlternates?: Array<{ seed: string; schema: unknown; generationMeta?: SiteBuilderPipelineGenerationMeta }>;
              variantSeeds?: string[];
              intelligenceRunId?: string;
              generationMeta?: SiteBuilderPipelineGenerationMeta;
            }>("/api/site-builder/ai/pipeline", {
              method: "POST",
              timeoutMs: 60_000,
              body: JSON.stringify({
                step: "full",
                input,
                variantCount: n,
                variantSeed: exploreVariantSeed?.trim() || undefined,
                ...pipelineSitePayload(),
              }),
            });
            markBuildStage("response_received", { apiDurationMs: Date.now() - reqStarted });
            setPlanner(data.planner);
            setLlmEnriched(data.llmEnriched);
            setEvaluation(data.evaluation);
            {
              const model = data.llmModel ?? data.generationMeta?.llmModel;
              const prov = data.generationMeta?.llmProvider;
              if (data.llmEnriched) {
                setPlannerLlmStatusLine(
                  model
                    ? `AI model: ${model}${prov && prov !== "none" ? ` · ${prov}` : ""}`
                    : "AI model: response applied (structured plan).",
                );
                setPlannerLlmFallbackDetail(null);
              } else {
                setPlannerLlmStatusLine(null);
                setPlannerLlmFallbackDetail({
                  reason: data.generationMeta?.fallbackReason,
                  model: model ?? undefined,
                  provider: prov ?? undefined,
                });
              }
            }
            setDeterministicFallbackNotice(
              data.llmFallbackWarning
                ? data.llmFallbackWarning
                : data.generationMeta?.plannerPath === "deterministic_fallback"
                  ? "This build used the deterministic fallback. Results may be safer but less distinctive."
                  : null,
            );
            setContentIntelligenceMeta(data.generationMeta?.contentIntelligence ?? null);
            setBuildCritiqueMeta(
              data.generationMeta?.critiqueScore != null || data.generationMeta?.autoRepaired != null
                ? {
                    critiqueScore: data.generationMeta?.critiqueScore ?? 0,
                    critiqueIssues: data.generationMeta?.critiqueIssues,
                    autoRepaired: Boolean(data.generationMeta?.autoRepaired),
                  }
                : null,
            );
            setInspirationPatternsUsedLast(Boolean(data.generationMeta?.inspirationPatternsUsed));
            setIntelligenceRunId(typeof data.intelligenceRunId === "string" && data.intelligenceRunId ? data.intelligenceRunId : null);
            const alternates = data.schemaAlternates ?? [];
            if (alternates.length > 0) {
              variantPickPending = true;
              previewContentChanged = false;
              setVariantPickSession({ primary: data.schema, alternates, primaryGenerationMeta: data.generationMeta });
              setSchemaAlternates(alternates);
              markBuildStage("variants_ready", { variantPickerOpened: true });
              onNotice(
                `Suggestions at ${data.evaluation.score}/100. Choose a layout (${alternates.length + 1} options) in the dialog to load the preview.`,
              );
              try {
                seoAssistantSummary =
                  String(
                    (data.schema as { metadata?: { seoAssistantSummary?: string } })?.metadata?.seoAssistantSummary ?? "",
                  ).trim() || undefined;
              } catch {
                seoAssistantSummary = undefined;
              }
            } else {
              variantPickPending = false;
              setVariantPickSession(null);
              setSchemaAlternates([]);
              assertPreviewSchemaOrThrow(data.schema);
              applyPipelineGeneratedSchema(data.schema);
              markBuildStage("schema_applied", { schemaApplied: true });
              previewContentChanged = priorHash === null ? true : hashSiteSchema(data.schema) !== priorHash;
              emitBrandBrainAnalyticsForSchema(data.schema, workflowStage);
              emitAgencyLaunchAnalyticsForSchema(data.schema, workflowStage);
              const expl = buildSiteBuilderEditExplanation({
                command: buildNarrativeFromIntake(getIntakeFields()).trim() || userPrompt.trim(),
                scope: "full_page",
              });
              const fullHeadline = `${expl} Suggestions at ${data.evaluation.score}/100.`;
              onNotice(fullHeadline);
              onAiEditCompleted?.({ changedSectionIds: [], headline: fullHeadline, scope: "full" });
              onVariantSelectionComplete?.({
                selectedIndex: 0,
                schemaHasWidget: schemaHasWidgetIntegration(data.schema),
              });
              try {
                seoAssistantSummary =
                  String(
                    (data.schema as { metadata?: { seoAssistantSummary?: string } })?.metadata?.seoAssistantSummary ?? "",
                  ).trim() || undefined;
              } catch {
                seoAssistantSummary = undefined;
              }
            }
            lastPipelineInputHashRef.current = h;
            setPipelineInputUnchangedWarning(false);
            return data;
          },
          mapSuccessProps: (data) => {
            let styleMode: string | undefined;
            try {
              const m = (data.schema as { metadata?: { theme?: { styleMode?: string } } })?.metadata?.theme?.styleMode;
              if (typeof m === "string") styleMode = m;
            } catch {
              /* ignore */
            }
            return {
              evaluation_score: data.evaluation.score,
              llm_enriched: data.llmEnriched,
              ...(styleMode ? { style_mode: styleMode } : {}),
            };
          },
        });
        ok = true;
      } catch (e) {
        ok = false;
        variantPickPending = false;
        previewContentChanged = false;
        pipelineError = e instanceof Error ? e.message : "Operation failed";
        if (pipelineError.toLowerCase().includes("timed out")) {
          setShowBuildRetry(true);
          onError("Build timed out before preview was generated. Try again or switch to template fallback.");
          markBuildStage("client_timeout");
        } else {
          markBuildStage("failed");
        }
        throw e;
      } finally {
        disarmProgress();
      }
    });
    return {
      ok,
      variantPickPending: ok ? variantPickPending : false,
      previewContentChanged: ok && !variantPickPending ? previewContentChanged : undefined,
      errorMessage: ok ? undefined : pipelineError,
      seoAssistantSummary: ok ? seoAssistantSummary : undefined,
    };
  }

  async function runFullBuildWithRefinement(opts?: { source?: "panel" | "sticky_bar" }): Promise<FullBuildRunResult> {
    const v = validateIntakeForFullBuild(getIntakeFields(), fullBuildClientGate);
    if (!v.ok) {
      onError(v.message);
      const q = nextMissingIntakeQuestion(getIntakeFields());
      if (q) pushChatMessage("assistant", q.prompt);
      return { ok: false, variantPickPending: false, errorMessage: v.message };
    }
    const source = opts?.source ?? "panel";
    if (!planner) {
      return await runFullBuild({ source });
    }
    const input = baseInput();
    const h = hashPipelineInputPayload(input);
    trackSiteBuilderEvent("site_builder_full_build_started", { ...inputAnalyticsProps(), source, guided_refinement: true });
    let ok = false;
    let variantPickPending = false;
    let previewContentChanged = false;
    let pipelineError: string | undefined;
    let seoAssistantSummary: string | undefined;
    await withBusy(async () => {
      const disarmProgress = armAutoBuildProgressTimers(input);
      try {
        setShowBuildRetry(false);
        markBuildStage("client_submit", {
          apiDurationMs: null,
          schemaApplied: false,
          variantPickerOpened: false,
        });
        onError(null);
        setVariantPickSession(null);
        setIntelligenceRunId(null);
        setContentIntelligenceMeta(null);
        setPlannerLlmFallbackDetail(null);
        setInspirationPatternsUsedLast(false);
        setSelectedVariantIndex(null);
        if (lastPipelineInputHashRef.current === h) {
          setPipelineInputUnchangedWarning(true);
          onNotice("Input unchanged since your last run — output may be identical. Adjust the brief, layout profile, or seed, then build again.");
        } else {
          setPipelineInputUnchangedWarning(false);
        }
        await runSiteBuilderTrackedAction({
          successEvent: "site_builder_full_build_completed",
          failureEvent: "site_builder_full_build_failed",
          baseProps: { ...inputAnalyticsProps(), source, guided_refinement: true },
          action: async () => {
            let priorHash: string | null = null;
            try {
              priorHash = hashSiteSchema(JSON.parse(schemaText));
            } catch {
              priorHash = null;
            }
            const siteAssets = extractSiteBuilderAssetsFromSchemaText();
            const n = Math.min(3, Math.max(1, variantCount));
            const reqStarted = Date.now();
            markBuildStage("api_request_started");
            const data = await jsonFetch<{
              planner: PlannerOut;
              llmEnriched: boolean;
              llmModel?: string;
              llmProvider?: string;
              llmFallbackWarning?: string;
              schema: unknown;
              evaluation: EvaluationOut;
              schemaAlternates?: Array<{ seed: string; schema: unknown; generationMeta?: SiteBuilderPipelineGenerationMeta }>;
              intelligenceRunId?: string;
              generationMeta?: SiteBuilderPipelineGenerationMeta;
            }>("/api/site-builder/ai/pipeline", {
              method: "POST",
              timeoutMs: 60_000,
              body: JSON.stringify({
                step: "full",
                input,
                planner,
                refinement: buildRefinementPayload(),
                variantCount: n,
                variantSeed: exploreVariantSeed?.trim() || undefined,
                ...(siteAssets ? { siteBuilderAssets: siteAssets } : {}),
                ...pipelineSitePayload(),
              }),
            });
            markBuildStage("response_received", { apiDurationMs: Date.now() - reqStarted });
            setPlanner(data.planner);
            setLlmEnriched(data.llmEnriched);
            setEvaluation(data.evaluation);
            {
              const model = data.llmModel ?? data.generationMeta?.llmModel;
              const prov = data.generationMeta?.llmProvider;
              if (data.llmEnriched) {
                setPlannerLlmStatusLine(
                  model
                    ? `AI model: ${model}${prov && prov !== "none" ? ` · ${prov}` : ""}`
                    : "AI model: response applied (structured plan).",
                );
                setPlannerLlmFallbackDetail(null);
              } else {
                setPlannerLlmStatusLine(null);
                setPlannerLlmFallbackDetail({
                  reason: data.generationMeta?.fallbackReason,
                  model: model ?? undefined,
                  provider: prov ?? undefined,
                });
              }
            }
            setDeterministicFallbackNotice(
              data.llmFallbackWarning
                ? data.llmFallbackWarning
                : data.generationMeta?.plannerPath === "deterministic_fallback"
                  ? "This build used the deterministic fallback. Results may be safer but less distinctive."
                  : null,
            );
            setContentIntelligenceMeta(data.generationMeta?.contentIntelligence ?? null);
            setBuildCritiqueMeta(
              data.generationMeta?.critiqueScore != null || data.generationMeta?.autoRepaired != null
                ? {
                    critiqueScore: data.generationMeta?.critiqueScore ?? 0,
                    critiqueIssues: data.generationMeta?.critiqueIssues,
                    autoRepaired: Boolean(data.generationMeta?.autoRepaired),
                  }
                : null,
            );
            setInspirationPatternsUsedLast(Boolean(data.generationMeta?.inspirationPatternsUsed));
            setIntelligenceRunId(typeof data.intelligenceRunId === "string" && data.intelligenceRunId ? data.intelligenceRunId : null);
            const alternates = data.schemaAlternates ?? [];
            if (alternates.length > 0) {
              variantPickPending = true;
              previewContentChanged = false;
              setVariantPickSession({ primary: data.schema, alternates, primaryGenerationMeta: data.generationMeta });
              setSchemaAlternates(alternates);
              markBuildStage("variants_ready", { variantPickerOpened: true });
              onNotice(
                `Guided choices applied. Suggestions at ${data.evaluation.score}/100. Choose a layout (${alternates.length + 1} options) in the dialog.`,
              );
              try {
                seoAssistantSummary =
                  String(
                    (data.schema as { metadata?: { seoAssistantSummary?: string } })?.metadata?.seoAssistantSummary ?? "",
                  ).trim() || undefined;
              } catch {
                seoAssistantSummary = undefined;
              }
            } else {
              variantPickPending = false;
              setVariantPickSession(null);
              setSchemaAlternates([]);
              assertPreviewSchemaOrThrow(data.schema);
              applyPipelineGeneratedSchema(data.schema);
              markBuildStage("schema_applied", { schemaApplied: true });
              previewContentChanged = priorHash === null ? true : hashSiteSchema(data.schema) !== priorHash;
              emitBrandBrainAnalyticsForSchema(data.schema, workflowStage);
              emitAgencyLaunchAnalyticsForSchema(data.schema, workflowStage);
              const expl = buildSiteBuilderEditExplanation({
                command: buildNarrativeFromIntake(getIntakeFields()).trim() || userPrompt.trim(),
                scope: "full_page",
              });
              const fullHeadline = `${expl} Guided choices applied. Suggestions at ${data.evaluation.score}/100.`;
              onNotice(fullHeadline);
              onAiEditCompleted?.({ changedSectionIds: [], headline: fullHeadline, scope: "full" });
              onVariantSelectionComplete?.({
                selectedIndex: 0,
                schemaHasWidget: schemaHasWidgetIntegration(data.schema),
              });
              try {
                seoAssistantSummary =
                  String(
                    (data.schema as { metadata?: { seoAssistantSummary?: string } })?.metadata?.seoAssistantSummary ?? "",
                  ).trim() || undefined;
              } catch {
                seoAssistantSummary = undefined;
              }
            }
            lastPipelineInputHashRef.current = h;
            setPipelineInputUnchangedWarning(false);
            return data;
          },
          mapSuccessProps: (data) => {
            let styleMode: string | undefined;
            try {
              const m = (data.schema as { metadata?: { theme?: { styleMode?: string } } })?.metadata?.theme?.styleMode;
              if (typeof m === "string") styleMode = m;
            } catch {
              /* ignore */
            }
            return {
              evaluation_score: data.evaluation.score,
              llm_enriched: data.llmEnriched,
              ...(styleMode ? { style_mode: styleMode } : {}),
            };
          },
        });
        ok = true;
      } catch (e) {
        ok = false;
        variantPickPending = false;
        previewContentChanged = false;
        pipelineError = e instanceof Error ? e.message : "Operation failed";
        if (pipelineError.toLowerCase().includes("timed out")) {
          setShowBuildRetry(true);
          onError("Build timed out before preview was generated. Try again or switch to template fallback.");
          markBuildStage("client_timeout");
        } else {
          markBuildStage("failed");
        }
        throw e;
      } finally {
        disarmProgress();
      }
    });
    return {
      ok,
      variantPickPending: ok ? variantPickPending : false,
      previewContentChanged: ok && !variantPickPending ? previewContentChanged : undefined,
      errorMessage: ok ? undefined : pipelineError,
      seoAssistantSummary: ok ? seoAssistantSummary : undefined,
    };
  }

  function savePayPalIntegration() {
    onError(null);
    try {
      const doc = JSON.parse(schemaText) as { metadata?: Record<string, unknown> };
      const prevMeta = doc.metadata;
      doc.metadata =
        prevMeta && typeof prevMeta === "object" && !Array.isArray(prevMeta) ? prevMeta : {};
      const meta = doc.metadata as Record<string, unknown>;
      if (!payPalForm.enabled) {
        delete meta.paymentIntegration;
        onApplySchema(JSON.stringify(doc, null, 2));
        onNotice("PayPal payment surface removed.");
        return;
      }
      const paypal: Record<string, string> = {};
      if (payPalForm.mode === "payment_link") {
        const sanitized = sanitizePaypalPaymentUrl(payPalForm.paymentLink.trim());
        if (!sanitized) {
          onError("Use a valid HTTPS PayPal link (paypal.com or paypal.me).");
          return;
        }
        paypal.paymentLink = sanitized;
      } else if (payPalForm.mode === "buy_button") {
        const raw = payPalForm.buttonHtml.trim();
        if (!raw) {
          onError("Paste the PayPal button or embed HTML from your PayPal Business account.");
          return;
        }
        paypal.buttonHtml = sanitizePaypalButtonHtml(raw);
      } else {
        paypal.environment = payPalForm.environment;
        paypal.currency = (payPalForm.currency || "USD").trim().slice(0, 8) || "USD";
        const cid = payPalForm.clientId.trim();
        if (cid) paypal.clientId = cid.slice(0, 200);
      }
      const pageSlugRaw = payPalForm.pageSlug.trim();
      const pageSlug =
        payPalForm.placement === "page_body_end" && pageSlugRaw
          ? pageSlugRaw.startsWith("/")
            ? pageSlugRaw.replace(/\/+$/, "") || "/"
            : `/${pageSlugRaw.replace(/\/+$/, "")}`
          : undefined;
      const payload: Record<string, unknown> = {
        provider: "paypal",
        mode: payPalForm.mode,
        intent: payPalForm.intent,
        placement: payPalForm.placement,
        ...(pageSlug ? { pageSlug } : {}),
        paypal: Object.keys(paypal).length ? paypal : undefined,
      };
      const parsedPi = PaymentIntegrationSchema.safeParse(payload);
      if (!parsedPi.success) {
        onError("Could not validate PayPal settings.");
        return;
      }
      meta.paymentIntegration = parsedPi.data;
      onApplySchema(JSON.stringify(doc, null, 2));
      const br = meta.builderRefinement as { deploymentTarget?: string } | undefined;
      const deployment_target = typeof br?.deploymentTarget === "string" ? br.deploymentTarget : "static";
      trackSiteBuilderEvent("site_builder_payment_integration_configured", {
        workflow_stage: workflowStage,
        deployment_target,
        provider: "paypal",
        mode: parsedPi.data.mode,
        intent: parsedPi.data.intent,
        placement: parsedPi.data.placement,
      });
      onNotice("PayPal payment surface saved.");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not save PayPal settings.");
    }
  }

  async function downloadProjectZip() {
    onError(null);
    try {
      const parsed = JSON.parse(schemaText) as { metadata?: Record<string, unknown> };
      /** So ZIP matches current Review choices even if the user last generated with different refinement. */
      const refinement = buildRefinementPayload();
      if (refinement) {
        parsed.metadata = parsed.metadata ?? {};
        const prev = parsed.metadata.builderRefinement;
        const prevObj =
          prev && typeof prev === "object" && !Array.isArray(prev) ? (prev as Record<string, unknown>) : {};
        parsed.metadata.builderRefinement = { ...prevObj, ...refinement };
      }
      const res = await fetch("/api/site-builder/export", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schemaJson: parsed }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const br = (parsed as { metadata?: { builderRefinement?: { deploymentTarget?: string } } })?.metadata?.builderRefinement;
      const dt = typeof br?.deploymentTarget === "string" ? br.deploymentTarget : "static";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `site-project-${dt.replace(/[^a-z0-9_-]/gi, "-")}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      onNotice(
        dt === "static"
          ? "Download started—ZIP uses the static layout (index.html, styles.css, scripts.js, assets/)."
          : "Download started—ZIP matches your deployment choice from Review."
      );
      const brf = (parsed as { metadata?: { builderRefinement?: { assetStrategy?: string } } })?.metadata?.builderRefinement;
      const strat = brf?.assetStrategy === "remote_urls" ? "remote_urls" : "local_bundle";
      const assetCount = Object.keys(
        (parsed as { metadata?: { siteBuilderAssets?: Record<string, unknown> } })?.metadata?.siteBuilderAssets ?? {},
      ).length;
      if (assetCount > 0 && strat === "local_bundle") {
        trackSiteBuilderEvent("site_builder_export_bundled_assets", {
          workflow_stage: workflowStage,
          deployment_target: dt,
          asset_strategy: strat,
          asset_kind: "mixed",
        });
      }
      trackSiteBuilderEvent("site_builder_project_export_downloaded", {
        ...inputAnalyticsProps(),
        deployment_target: dt,
        asset_strategy: strat,
      });
      const payMeta = (parsed as { metadata?: { paymentIntegration?: PaymentIntegration } })?.metadata?.paymentIntegration;
      if (payMeta?.provider === "paypal") {
        trackSiteBuilderEvent("site_builder_payment_export_included", {
          workflow_stage: workflowStage,
          deployment_target: dt,
          provider: "paypal",
          mode: payMeta.mode,
          intent: payMeta.intent,
          placement: payMeta.placement,
        });
      }
      const siteImport = (parsed as { metadata?: { siteImport?: { sourceUrl?: string } } })?.metadata?.siteImport;
      if (siteImport && typeof siteImport.sourceUrl === "string") {
        let source_domain = "";
        try {
          source_domain = new URL(siteImport.sourceUrl).hostname;
        } catch {
          source_domain = "";
        }
        trackSiteBuilderEvent("site_builder_imported_site_exported", {
          ...inputAnalyticsProps(),
          deployment_target: dt,
          source_domain,
          route_count: Array.isArray((parsed as { pages?: unknown[] })?.pages) ? (parsed as { pages: unknown[] }).pages.length : 0,
          widget_attached: Boolean(
            (parsed as { metadata?: { widgetIntegration?: { widgetKey?: string } } })?.metadata?.widgetIntegration
              ?.widgetKey,
          ),
        });
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Export failed");
    }
  }

  const downloadClientDeliverablesPack = useCallback(() => {
    void withBusy(async () => {
      onError(null);
      try {
        const raw = JSON.parse(schemaText);
        const parsed = SiteSchemaDocument.safeParse(raw);
        if (!parsed.success || !parsed.data.metadata?.importedSiteAudit) {
          onNotice("Deliverables aren’t available until an imported-site review is present.");
          return;
        }
        const doc = parsed.data;
        const br = doc.metadata?.builderRefinement as { deploymentTarget?: string } | undefined;
        const deployment_target = typeof br?.deploymentTarget === "string" ? br.deploymentTarget : "static";
        const route_count = doc.pages?.length ?? 0;
        const widget_attached = Boolean(doc.metadata?.widgetIntegration?.widgetKey);
        const res = await fetch("/api/site-builder/deliverables", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schemaJson: doc }),
        });
        const data = (await res.json().catch(() => ({}))) as { deliverables?: unknown; error?: string };
        if (!res.ok) {
          throw new Error(data.error || `Deliverables failed (${res.status})`);
        }
        if (!data.deliverables) {
          throw new Error("Invalid deliverables response");
        }
        trackSiteBuilderEvent("site_builder_deliverables_pack_generated", {
          workflow_stage: workflowStage,
          deployment_target,
          widget_attached,
          route_count,
          imported_site: Boolean(doc.metadata?.siteImport),
        });
        trackSiteBuilderEvent("site_builder_client_handoff_generated", {
          workflow_stage: workflowStage,
          deployment_target,
          widget_attached,
          route_count,
          imported_site: Boolean(doc.metadata?.siteImport),
        });
        const bundled = deliverablesToBundledFiles(data.deliverables as DeliverablesDocument, doc);
        const slug =
          String(doc.metadata?.title ?? "site")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 40) || "site";
        const stamp = new Date().toISOString().slice(0, 10);
        const downloadText = (filename: string, content: string, mime: string) => {
          const blob = new Blob([content], { type: mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        };
        for (const f of bundled) {
          const mime = f.path.endsWith(".json")
            ? "application/json"
            : f.path.endsWith(".html")
              ? "text/html;charset=utf-8"
              : f.path.endsWith(".md")
                ? "text/markdown;charset=utf-8"
                : "text/plain";
          downloadText(`deliverables-${slug}-${stamp}-${f.path.replace(/\//g, "-")}`, f.content, mime);
        }
        trackSiteBuilderEvent("site_builder_deliverables_asset_downloaded", {
          workflow_stage: workflowStage,
          deployment_target,
          widget_attached,
          route_count,
          imported_site: Boolean(doc.metadata?.siteImport),
        });
        trackSiteBuilderEvent("site_builder_client_handoff_downloaded", {
          workflow_stage: workflowStage,
          deployment_target,
          widget_attached,
          route_count,
          imported_site: Boolean(doc.metadata?.siteImport),
        });
        onNotice("Deliverables download started (client handoff, summary, structured JSON, checklist).");
      } catch (e) {
        onError(e instanceof Error ? e.message : "Could not build deliverables pack.");
      }
    });
  }, [onError, onNotice, schemaText, workflowStage, withBusy]);

  const downloadProposalPackage = useCallback(() => {
    void withBusy(async () => {
      onError(null);
      try {
        const raw = JSON.parse(schemaText);
        const parsed = SiteSchemaDocument.safeParse(raw);
        if (!parsed.success || !parsed.data.metadata?.importedSiteAudit) {
          onNotice("Proposal materials aren’t available until an imported-site review is present.");
          return;
        }
        const doc = parsed.data;
        const br = doc.metadata?.builderRefinement as { deploymentTarget?: string } | undefined;
        const deployment_target = typeof br?.deploymentTarget === "string" ? br.deploymentTarget : "static";
        const route_count = doc.pages?.length ?? 0;
        const widget_attached = Boolean(doc.metadata?.widgetIntegration?.widgetKey);
        const res = await fetch("/api/site-builder/deliverables", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schemaJson: doc }),
        });
        const data = (await res.json().catch(() => ({}))) as { deliverables?: unknown; error?: string };
        if (!res.ok) {
          throw new Error(data.error || `Deliverables failed (${res.status})`);
        }
        if (!data.deliverables) {
          throw new Error("Invalid deliverables response");
        }
        trackSiteBuilderEvent("site_builder_proposal_generated", {
          workflow_stage: workflowStage,
          deployment_target,
          widget_attached,
          route_count,
          imported_site: Boolean(doc.metadata?.siteImport),
        });
        const bundled = deliverablesToBundledFiles(data.deliverables as DeliverablesDocument, doc).filter((f) =>
          f.path.startsWith("proposal-"),
        );
        const slug =
          String(doc.metadata?.title ?? "site")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 40) || "site";
        const stamp = new Date().toISOString().slice(0, 10);
        const downloadText = (filename: string, content: string, mime: string) => {
          const blob = new Blob([content], { type: mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        };
        for (const f of bundled) {
          const mime = f.path.endsWith(".md") ? "text/markdown;charset=utf-8" : "text/plain";
          downloadText(`proposal-${slug}-${stamp}-${f.path.replace(/\//g, "-")}`, f.content, mime);
        }
        trackSiteBuilderEvent("site_builder_proposal_downloaded", {
          workflow_stage: workflowStage,
          deployment_target,
          widget_attached,
          route_count,
          imported_site: Boolean(doc.metadata?.siteImport),
        });
        onNotice("Proposal download started (scope, pricing outline, close email).");
      } catch (e) {
        onError(e instanceof Error ? e.message : "Could not build proposal package.");
      }
    });
  }, [onError, onNotice, schemaText, workflowStage, withBusy]);

  const patchConsultantProposalPosture = useCallback(
    (
      patch: Partial<{
        selectedTier: "essential" | "standard" | "partner";
        scopePosture: "starter" | "core" | "expanded";
      }>,
    ) => {
      try {
        const raw = JSON.parse(schemaText);
        const parsed = SiteSchemaDocument.safeParse(raw);
        if (!parsed.success || !parsed.data.metadata) return;
        const meta = parsed.data.metadata;
        const prev = meta.consultantProposalPosture ?? {};
        const merged = { ...prev, ...patch };
        const nextDoc = {
          ...parsed.data,
          metadata: {
            ...meta,
            consultantProposalPosture: merged,
          },
        };
        applySchemaMergingSiteAssets(JSON.stringify(SiteSchemaDocument.parse(nextDoc), null, 2));
        const br = meta.builderRefinement as { deploymentTarget?: string } | undefined;
        const deployment_target = typeof br?.deploymentTarget === "string" ? br.deploymentTarget : "static";
        trackSiteBuilderEvent("site_builder_proposal_tier_selected", {
          workflow_stage: workflowStage,
          deployment_target,
          widget_attached: Boolean(meta.widgetIntegration?.widgetKey),
          route_count: parsed.data.pages?.length ?? 0,
          imported_site: Boolean(meta.siteImport),
          selected_tier: merged.selectedTier ?? "standard",
          scope_posture: merged.scopePosture ?? "core",
        });
      } catch {
        /* ignore */
      }
    },
    [applySchemaMergingSiteAssets, schemaText, workflowStage],
  );

  const downloadClosePackage = useCallback(() => {
    void withBusy(async () => {
      onError(null);
      try {
        const raw = JSON.parse(schemaText);
        const parsed = SiteSchemaDocument.safeParse(raw);
        if (!parsed.success || !parsed.data.metadata?.importedSiteAudit) {
          onNotice("Close package isn’t available until an imported-site review is present.");
          return;
        }
        const doc = parsed.data;
        const br = doc.metadata?.builderRefinement as { deploymentTarget?: string } | undefined;
        const deployment_target = typeof br?.deploymentTarget === "string" ? br.deploymentTarget : "static";
        const route_count = doc.pages?.length ?? 0;
        const widget_attached = Boolean(doc.metadata?.widgetIntegration?.widgetKey);
        const res = await fetch("/api/site-builder/deliverables", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schemaJson: doc }),
        });
        const data = (await res.json().catch(() => ({}))) as { deliverables?: unknown; error?: string };
        if (!res.ok) {
          throw new Error(data.error || `Deliverables failed (${res.status})`);
        }
        if (!data.deliverables) {
          throw new Error("Invalid deliverables response");
        }
        trackSiteBuilderEvent("site_builder_close_package_generated", {
          workflow_stage: workflowStage,
          deployment_target,
          widget_attached,
          route_count,
          imported_site: Boolean(doc.metadata?.siteImport),
          selected_tier: doc.metadata?.consultantProposalPosture?.selectedTier ?? "standard",
        });
        trackSiteBuilderEvent("site_builder_onboarding_packet_generated", {
          workflow_stage: workflowStage,
          deployment_target,
          widget_attached,
          route_count,
          imported_site: Boolean(doc.metadata?.siteImport),
          selected_tier: doc.metadata?.consultantProposalPosture?.selectedTier ?? "standard",
        });
        const closeNames = new Set([
          "approval-summary.md",
          "onboarding-checklist.md",
          "kickoff-packet.md",
          "proposal-close-email.md",
        ]);
        const bundled = deliverablesToBundledFiles(data.deliverables as DeliverablesDocument, doc).filter((f) =>
          closeNames.has(f.path),
        );
        const slug =
          String(doc.metadata?.title ?? "site")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 40) || "site";
        const stamp = new Date().toISOString().slice(0, 10);
        const downloadText = (filename: string, content: string, mime: string) => {
          const blob = new Blob([content], { type: mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        };
        for (const f of bundled) {
          const mime = f.path.endsWith(".md") ? "text/markdown;charset=utf-8" : "text/plain";
          downloadText(`close-${slug}-${stamp}-${f.path.replace(/\//g, "-")}`, f.content, mime);
        }
        trackSiteBuilderEvent("site_builder_close_package_downloaded", {
          workflow_stage: workflowStage,
          deployment_target,
          widget_attached,
          route_count,
          imported_site: Boolean(doc.metadata?.siteImport),
          selected_tier: doc.metadata?.consultantProposalPosture?.selectedTier ?? "standard",
        });
        onNotice("Close package download started (approval, onboarding, kickoff, close email).");
      } catch (e) {
        onError(e instanceof Error ? e.message : "Could not build close package.");
      }
    });
  }, [onError, onNotice, schemaText, workflowStage, withBusy]);

  async function runEvaluateOnly() {
    await withBusy(async () => {
      onError(null);
      const parsed = JSON.parse(schemaText);
      const data = await jsonFetch<{ evaluation: EvaluationOut }>("/api/site-builder/ai/pipeline", {
        method: "POST",
        body: JSON.stringify({ step: "evaluate", schemaJson: parsed, ...pipelineSitePayload() }),
      });
      setEvaluation(data.evaluation);
      onNotice(`Quality check: ${data.evaluation.score}/100`);
    });
  }

  async function executeRegenerateSectionPipeline(
    instrRaw: string,
    explicitId: string,
    opts?: { schemaSource?: string; suppressUserFeedback?: boolean },
  ): Promise<{ mergedSchema: string; evaluation: EvaluationOut }> {
    const id = explicitId.trim();
    if (!id) {
      onError("Choose a section to update.");
      throw new Error("No section");
    }
    const schemaSrc = opts?.schemaSource ?? schemaText;
    const suppressUserFeedback = opts?.suppressUserFeedback ?? false;
    const instr = instrRaw.trim();
    const intents = classifyEditIntents(instr || "refresh");
    const editScope = applySessionBiasToScope(resolveEditScope(intents, instr), intents, sessionEditContextRef.current);
    const style_mode = readStyleModeFromSchemaJson(schemaSrc);
    trackSiteBuilderEvent("site_builder_section_edit_requested", {
      section_id: id,
      edit_intent: primaryIntent(intents),
      edit_scope: editScope,
      workflow_stage: workflowStage,
      ...(style_mode ? { style_mode } : {}),
    });
    const wrapped = await runSiteBuilderTrackedAction<{
      data: {
        schema: unknown;
        evaluation: EvaluationOut;
        editMeta: SectionEditMeta;
        sessionEditContext: SessionEditContext;
        pageIndex: number;
      };
      mergedSchema: string;
    }>({
      successEvent: "site_builder_section_regenerate_completed",
      failureEvent: "site_builder_section_regenerate_failed",
      baseProps: { ...inputAnalyticsProps(), section_id: id },
      action: async () => {
        const parsed = JSON.parse(schemaSrc);
        const data = await jsonFetch<{
          schema: unknown;
          evaluation: EvaluationOut;
          editMeta: SectionEditMeta;
          sessionEditContext: SessionEditContext;
          pageIndex: number;
        }>("/api/site-builder/ai/pipeline", {
          method: "POST",
          body: JSON.stringify({
            step: "regenerate_section",
            schemaJson: parsed,
            sectionId: id,
            instruction: instr || undefined,
            input: regenPartialInputFromBase(),
            sessionEditContext: sessionEditContextRef.current,
            ...pipelineSitePayload(),
          }),
        });
        sessionEditContextRef.current = data.sessionEditContext;
        setSessionEditContextSnapshot(data.sessionEditContext);
        setEvaluation(data.evaluation);
        const nextRaw = JSON.stringify(data.schema, null, 2);
        const mergedSchema = computeMergedNormalizedSchema(nextRaw, schemaSrc);
        onApplySchema(mergedSchema);
        applyRestoredSelection(mergedSchema, [id]);
        const lab = friendlyLabelsForSectionIds(mergedSchema, [id])[0];
        const expl = buildSiteBuilderEditExplanation({
          command: instr,
          scope: "section",
          friendlyLabels: lab ? [lab] : [],
          editMeta: data.editMeta,
        });
        const friendly = `${expl} Suggestions at ${data.evaluation.score}/100.`;
        if (!suppressUserFeedback) {
          onNotice(friendly);
          onAiEditCompleted?.({
            changedSectionIds: data.editMeta.primaryIntent === "design_token_update" ? [] : [id],
            headline: friendly,
            scope: "section",
          });
        }

        const sm = readStyleModeFromSchemaJson(mergedSchema);
        const mode = sm ?? style_mode;
        const analyticsBase = {
          section_id: id,
          edit_intent: data.editMeta.primaryIntent,
          edit_scope: data.editMeta.scope,
          workflow_stage: workflowStage,
          ...(mode ? { style_mode: mode } : {}),
        };
        trackSiteBuilderEvent("site_builder_section_edit_completed", analyticsBase);
        trackSiteBuilderEvent("site_builder_section_edit_scope_applied", analyticsBase);
        if (data.editMeta.registrySwapped) {
          trackSiteBuilderEvent("site_builder_section_swap_applied", analyticsBase);
        }
        if (data.editMeta.designTokenKinds?.length) {
          const token_type = data.editMeta.designTokenKinds.join("|").slice(0, 120);
          trackSiteBuilderEvent("site_builder_token_updated", {
            token_type,
            scope: "site",
            workflow_stage: workflowStage,
            ...(mode ? { style_mode: mode } : {}),
          });
          trackSiteBuilderEvent("site_builder_token_propagated", {
            token_type,
            scope: "site",
            workflow_stage: workflowStage,
            section_count: 1,
          });
        }
        if (data.editMeta.brandGovernanceApplied) {
          trackSiteBuilderEvent("site_builder_brand_governance_applied", {
            scope: "site",
            workflow_stage: workflowStage,
            ...(mode ? { style_mode: mode } : {}),
          });
        }

        emitBrandBrainAnalyticsForSchema(data.schema, workflowStage);
        emitAgencyLaunchAnalyticsForSchema(data.schema, workflowStage);

        return { data, mergedSchema };
      },
      mapSuccessProps: (r) => ({ evaluation_score: r.data.evaluation.score }),
    });
    return { mergedSchema: wrapped.mergedSchema, evaluation: wrapped.data.evaluation };
  }

  async function executeRegenerateBatchPipeline(
    instrRaw: string,
    explicitIds: string[],
    opts?: { schemaSource?: string; suppressUserFeedback?: boolean },
  ): Promise<{ mergedSchema: string; evaluation: EvaluationOut }> {
    const ids = normalizeRefineSectionIds(explicitIds, 3);
    if (ids.length === 0) {
      onError("Choose a section to update.");
      throw new Error("No section");
    }
    if (ids.length === 1) {
      return executeRegenerateSectionPipeline(instrRaw, ids[0]!, opts);
    }
    const schemaSrc = opts?.schemaSource ?? schemaText;
    const suppressUserFeedback = opts?.suppressUserFeedback ?? false;
    const instr = instrRaw.trim();
    const batchIntents = classifyBatchEditIntents(instr || "refresh", ids.length);
    const singleIntents = classifyEditIntents(instr || "refresh");
    const editScope = applySessionBiasToScope(
      resolveBatchEditScope(batchIntents, singleIntents, instr),
      singleIntents,
      sessionEditContextRef.current,
    );
    const style_mode = readStyleModeFromSchemaJson(schemaSrc);
    trackSiteBuilderEvent("site_builder_batch_section_edit_submitted", {
      section_count: ids.length,
      section_ids_compact: compactSectionIdPrefixes(ids),
      edit_scope: editScope,
      batch_intent: primaryBatchIntent(batchIntents),
      workflow_stage: workflowStage,
      ...(style_mode ? { style_mode } : {}),
    });
    const wrapped = await runSiteBuilderTrackedAction<{
      data: {
        schema: unknown;
        evaluation: EvaluationOut;
        batchEditMeta: BatchRegenerateMeta;
        sessionEditContext: SessionEditContext;
      };
      mergedSchema: string;
    }>({
      successEvent: "site_builder_batch_section_edit_completed",
      failureEvent: "site_builder_section_regenerate_failed",
      baseProps: {
        ...inputAnalyticsProps(),
        section_count: ids.length,
        section_ids_compact: compactSectionIdPrefixes(ids),
      },
      action: async () => {
        const parsed = JSON.parse(schemaSrc);
        const data = await jsonFetch<{
          schema: unknown;
          evaluation: EvaluationOut;
          batchEditMeta: BatchRegenerateMeta;
          sessionEditContext: SessionEditContext;
        }>("/api/site-builder/ai/pipeline", {
          method: "POST",
          body: JSON.stringify({
            step: "regenerate_sections_batch",
            schemaJson: parsed,
            sectionIds: ids,
            instruction: instr || undefined,
            input: regenPartialInputFromBase(),
            sessionEditContext: sessionEditContextRef.current,
            ...pipelineSitePayload(),
          }),
        });
        sessionEditContextRef.current = data.sessionEditContext;
        setSessionEditContextSnapshot(data.sessionEditContext);
        setEvaluation(data.evaluation);
        const nextRaw = JSON.stringify(data.schema, null, 2);
        const mergedSchema = computeMergedNormalizedSchema(nextRaw, schemaSrc);
        onApplySchema(mergedSchema);
        applyRestoredSelection(mergedSchema, ids);
        const labs = friendlyLabelsForSectionIds(mergedSchema, ids);
        const expl = buildSiteBuilderEditExplanation({
          command: instr,
          scope: "multi_section",
          friendlyLabels: labs,
          sectionCount: ids.length,
        });
        const head = `${expl} Suggestions at ${data.evaluation.score}/100.`;
        if (!suppressUserFeedback) {
          onNotice(head);
          onAiEditCompleted?.({ changedSectionIds: ids, headline: head, scope: "section" });
        }

        const sm = readStyleModeFromSchemaJson(mergedSchema);
        const mode = sm ?? style_mode;
        if (data.batchEditMeta.layoutRestructureApplied) {
          trackSiteBuilderEvent("site_builder_layout_restructure_applied", {
            section_count: ids.length,
            section_ids_compact: compactSectionIdPrefixes(ids),
            workflow_stage: workflowStage,
            restructure_kind: data.batchEditMeta.layoutRestructureKind ?? "heuristic",
            ...(mode ? { style_mode: mode } : {}),
          });
        }
        const batchTokenOnly =
          data.batchEditMeta.singleEditMetaSummaries.length > 0 &&
          data.batchEditMeta.singleEditMetaSummaries.every((s) => s.primaryIntent === "design_token_update");
        if (batchTokenOnly) {
          trackSiteBuilderEvent("site_builder_token_updated", {
            token_type: "batch",
            scope: "site",
            workflow_stage: workflowStage,
            section_count: ids.length,
            ...(mode ? { style_mode: mode } : {}),
          });
          trackSiteBuilderEvent("site_builder_token_propagated", {
            token_type: "batch",
            scope: "site",
            workflow_stage: workflowStage,
            section_count: ids.length,
          });
          trackSiteBuilderEvent("site_builder_brand_governance_applied", {
            scope: "site",
            workflow_stage: workflowStage,
            ...(mode ? { style_mode: mode } : {}),
          });
        }

        emitBrandBrainAnalyticsForSchema(data.schema, workflowStage);
        emitAgencyLaunchAnalyticsForSchema(data.schema, workflowStage);

        return { data, mergedSchema };
      },
      mapSuccessProps: (r) => ({
        evaluation_score: r.data.evaluation.score,
        edit_scope: r.data.batchEditMeta.scope,
        batch_intent: primaryBatchIntent(r.data.batchEditMeta.batchIntents),
      }),
    });
    return { mergedSchema: wrapped.mergedSchema, evaluation: wrapped.data.evaluation };
  }

  /** Returns whether merged schema differed from the starting snapshot (preview would change). */
  async function executeLightPageRefinementPipeline(
    instrRaw: string,
    opts?: { schemaJson?: string },
  ): Promise<boolean> {
    const instr = instrRaw.trim();
    const schemaBase = opts?.schemaJson ?? schemaText;
    const allIds = listRefinableSectionIdsOnPage(schemaBase);
    if (allIds.length === 0) {
      onError("Nothing to refine yet—generate a page first.");
      throw new Error("No refinable sections");
    }
    let startHash: string;
    try {
      startHash = hashSiteSchema(JSON.parse(schemaBase));
    } catch {
      onError("Current schema is not valid JSON — fix the page JSON first.");
      throw new Error("Invalid schema JSON");
    }
    const chunks = chunkSectionIdsForBatch(allIds);
    let working = schemaBase;
    let lastEval: EvaluationOut | null = null;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const isLast = i === chunks.length - 1;
      const r =
        chunk.length === 1
          ? await executeRegenerateSectionPipeline(instr, chunk[0]!, {
              schemaSource: working,
              suppressUserFeedback: !isLast,
            })
          : await executeRegenerateBatchPipeline(instr, chunk, {
              schemaSource: working,
              suppressUserFeedback: !isLast,
            });
      working = r.mergedSchema;
      lastEval = r.evaluation;
    }
    let endHash: string;
    try {
      endHash = hashSiteSchema(JSON.parse(working));
    } catch {
      endHash = startHash;
    }
    const contentChanged = endHash !== startHash;
    const expl = buildSiteBuilderEditExplanation({
      command: instr,
      scope: "light_page",
      sectionCount: allIds.length,
    });
    const scoreLine = lastEval ? ` Suggestions at ${lastEval.score}/100.` : "";
    const headline = `${expl}${scoreLine}`;
    onNotice(headline.trim());
    if (contentChanged) {
      onAiEditCompleted?.({ changedSectionIds: allIds, headline, scope: "light_page" });
    } else {
      onNotice(
        "The light-page pass finished, but the merged layout matched your current preview—try a clearer change or a section-level edit.",
      );
    }
    return contentChanged;
  }

  /**
   * One omnibar submit: plan, full build, section regen, light page refinement, or publish hint—by stage + scope.
   */
  async function submitOmnibarCommand() {
    let instr = userPrompt.trim();
    let schemaForOmnibar = schemaText;
    if (conversationalIntakeActive) {
      if (!instr) {
        onError('Type an answer, "skip" to move on, or "exit" to stop guided intake.');
        return;
      }
      if (/^(exit|cancel)$/i.test(instr)) {
        pushChatMessage("user", instr);
        setConversationalIntakeActive(false);
        setUserPrompt("");
        pushChatMessage("assistant", "Exited guided intake. Your answers are kept in the form when you used them.");
        return;
      }
      pushChatMessage("user", instr);
      const pending = getNextConversationalIntakeStep(conversationalIntakeAnswers, conversationalIntakeSkipped);
      if (!pending) {
        setConversationalIntakeActive(false);
        setUserPrompt("");
        return;
      }
      const isSkip = /^skip$/i.test(instr);
      const newSkipped = isSkip ? [...conversationalIntakeSkipped, pending.key] : [...conversationalIntakeSkipped];
      const newAnswers = isSkip
        ? { ...conversationalIntakeAnswers }
        : { ...conversationalIntakeAnswers, [pending.key]: instr.trim() };
      if (!isSkip) {
        applyConversationalAnswerToForm(pending.key, instr);
      }
      setConversationalIntakeAnswers(newAnswers);
      setConversationalIntakeSkipped(newSkipped);
      const nextStep = getNextConversationalIntakeStep(newAnswers, newSkipped);
      if (!nextStep) {
        setConversationalIntakeActive(false);
        pushChatMessage(
          "assistant",
          "Intake complete — your answers are in the brief. Press Enter to run a full build or continue in Manual Tools.",
        );
      } else {
        pushChatMessage("assistant", `${nextStep.prompt} (${nextStep.completedBefore + 1}/${nextStep.total})`);
      }
      setUserPrompt("");
      return;
    }
    if (composerImageAttachments.length > 0) {
      const placement = parseImagePlacementFromPrompt(instr);
      if (!placement && shouldAskImagePlacement(instr, composerImageAttachments.length)) {
        if (instr.length > 0) pushChatMessage("user", instr);
        pushChatMessage("assistant", ASSISTANT_IMAGE_PLACEMENT_PROMPT);
        setUserPrompt("");
        return;
      }
      if (placement) {
        const last = composerImageAttachments[composerImageAttachments.length - 1]!;
        const next = applyAssistantImagePlacement(schemaForOmnibar, placement, {
          assetId: last.assetId,
          publicUrl: last.publicUrl,
          mimeType: last.mimeType,
        });
        onApplySchema(next);
        schemaForOmnibar = next;
        setComposerImageAttachments([]);
        const remainder = stripImagePlacementPhrasesFromPrompt(instr, placement).trim();
        if (instr.trim().length > 0) pushChatMessage("user", instr);
        if (remainder.length > 0) {
          pushChatMessage(
            "assistant",
            `Applied your image to **${placement.replace(/_/g, " ")}** — continuing with your other instructions in the same request.`,
          );
          instr = remainder;
        } else {
          pushChatMessage(
            "assistant",
            `Applied your image to **${placement.replace(/_/g, " ")}** in the live schema.`,
          );
          setUserPrompt("");
          return;
        }
      }
    }
    if (instr && isShowCodeRequest(instr)) {
      pushChatMessage("user", instr);
      onOpenCodeDrawerRequest?.();
      pushChatMessage("assistant", "Opened Files / Code so you can inspect the schema and generated artifacts.");
      setUserPrompt("");
      return;
    }
    const jsonActs = instr ? tryExtractBuilderActionsFromMessage(instr) : null;
    if (jsonActs && (workflowStage === "refine" || workflowStage === "review")) {
      pushChatMessage("user", instr);
      let captured: Awaited<ReturnType<typeof runAssistantProposedBuilderActions>> | null = null;
      await withBusy(async () => {
        onError(null);
        const r = await runAssistantProposedBuilderActions(jsonActs, "manual", {
          pulseFromActions: true,
          schemaJson: schemaForOmnibar,
        });
        captured = r;
        if (r.schemaChanged && !r.hadHttpError) {
          setNlAssistStrip({ kind: "applied", message: "Applied builder actions from JSON in the command bar." });
        } else if (!r.hadHttpError && !r.schemaChanged) {
          setNlAssistStrip({
            kind: "clarify",
            message: "Those actions did not change the layout (output matched the current schema).",
          });
        }
      });
      const applyOutcome = captured!;
      if (applyOutcome.hadHttpError) {
        pushChatMessage("error", applyOutcome.summary || "Builder actions did not apply. See the error above.");
      } else if (applyOutcome.schemaChanged) {
        pushChatMessage("assistant", "Applied the builder actions from your message.");
      } else {
        pushChatMessage("assistant", "Those builder actions did not change the preview—check the notice above or adjust the JSON.");
      }
      setUserPrompt("");
      return;
    }
    const refinableN = listRefinableSectionIdsOnPage(schemaForOmnibar).length;
    const route = resolveOmnibarSubmitRoute({
      stage: workflowStage,
      selectedSectionCount: effectiveSectionIds.length,
      hasPlanner: Boolean(planner),
      refinableHomeSectionCount: refinableN,
    });
    if (route === "publish_skip") {
      onNotice("Publishing: use the bar below or Advanced when you’re ready to ship.");
      return;
    }
    if ((route === "describe_plan" || route === "review_plan_first") && !hasMeaningfulPipelineBrief()) {
      onError("Add a goal in the command bar or fill at least one of business, offer, audience, industry, or market.");
      return;
    }
    if (route === "describe_plan" || route === "review_plan_first") {
      const typed = instr.trim().length > 0;
      if (typed) {
        pushChatMessage("user", instr);
        const r = await runFullBuildWithRefinement({ source: "panel" });
        if (r.ok) {
          if (r.previewContentChanged === false) {
            pushChatMessage(
              "assistant",
              "Build finished, but the preview already matched your current layout—change the brief or seed and try again.",
            );
          } else {
            pushChatMessage("assistant", CHAT_FULL_BUILD_SUCCESS);
            if (r.seoAssistantSummary) pushChatMessage("assistant", r.seoAssistantSummary);
            pushClientSitePostBuildNudge();
          }
        } else {
          const detail = r.errorMessage?.trim();
          pushChatMessage("error", detail ? `Build didn’t finish: ${detail}` : "Build didn’t finish. See the error above.");
        }
        setUserPrompt("");
        return;
      }
      if (instr) pushChatMessage("user", instr);
      await runPlan();
      pushChatMessage("assistant", "Plan is ready in Manual Tools. Add a prompt and press Enter to build the full site.");
      setUserPrompt("");
      return;
    }
    if (route === "review_full_build") {
      if (instr) {
        pushChatMessage("user", instr);
        let handled = false;
        await withBusy(async () => {
          handled = await tryExecuteIntentNlEdit(instr, { schemaJson: schemaForOmnibar });
        });
        if (handled) {
          if (lastExecuteIntentChatReplyRef.current) {
            pushChatMessage("assistant", lastExecuteIntentChatReplyRef.current);
          }
          setUserPrompt("");
          return;
        }
      }
      const r = await runFullBuildWithRefinement({ source: "panel" });
      if (r.ok) {
        if (r.previewContentChanged === false) {
          pushChatMessage(
            "assistant",
            "First draft matched your current preview—try adjusting the brief or seed, then run Generate again.",
          );
        } else {
          pushChatMessage("assistant", CHAT_FULL_BUILD_SUCCESS);
          if (r.seoAssistantSummary) pushChatMessage("assistant", r.seoAssistantSummary);
          pushClientSitePostBuildNudge();
        }
      } else {
        const detail = r.errorMessage?.trim();
        pushChatMessage("error", detail ? `Build didn’t finish: ${detail}` : "Build didn’t finish. See the error above.");
      }
      if (instr) setUserPrompt("");
      return;
    }
    if (route === "refine_sections") {
      await runRegenerateSection({ instruction: instr, schemaJson: schemaForOmnibar });
      return;
    }
    if (route === "refine_light_page") {
      if (!instr) {
        onError("Say what you want to change on the page.");
        return;
      }
      pushChatMessage("user", instr);
      await withBusy(async () => {
        onError(null);
        onSectionRegenerationVisualMask?.(true);
        try {
          if (await tryExecuteIntentNlEdit(instr, { schemaJson: schemaForOmnibar })) {
            if (lastExecuteIntentChatReplyRef.current) {
              pushChatMessage("assistant", lastExecuteIntentChatReplyRef.current);
            }
            return;
          }
          const lightChanged = await executeLightPageRefinementPipeline(instr, { schemaJson: schemaForOmnibar });
          if (lightChanged) {
            pushChatMessage("assistant", "Applied your edit across the page layout.");
          } else {
            pushChatMessage(
              "assistant",
              "The page-wide pass did not change the preview—see the notices above or try a section-level edit.",
            );
          }
        } finally {
          onSectionRegenerationVisualMask?.(false);
        }
      });
      setUserPrompt("");
      return;
    }
    if (route === "refine_heavy_page") {
      if (instr) {
        pushChatMessage("user", instr);
        let handled = false;
        await withBusy(async () => {
          handled = await tryExecuteIntentNlEdit(instr, { schemaJson: schemaForOmnibar });
        });
        if (handled) {
          if (lastExecuteIntentChatReplyRef.current) {
            pushChatMessage("assistant", lastExecuteIntentChatReplyRef.current);
          }
          setUserPrompt("");
          return;
        }
      }
      const r = planner
        ? await runFullBuildWithRefinement({ source: "panel" })
        : await runFullBuild({ source: "panel" });
      if (r.ok) {
        if (r.previewContentChanged === false) {
          pushChatMessage(
            "assistant",
            "Regeneration matched your current preview—tweak the brief or layout controls and try again.",
          );
        } else {
          pushChatMessage("assistant", CHAT_FULL_BUILD_SUCCESS);
          if (r.seoAssistantSummary) pushChatMessage("assistant", r.seoAssistantSummary);
          pushClientSitePostBuildNudge();
        }
      } else if (hasMeaningfulPipelineBrief() || instr) {
        const detail = r.errorMessage?.trim();
        pushChatMessage("error", detail ? `Build didn’t finish: ${detail}` : "Build didn’t finish. See the error above.");
      }
      if (instr) setUserPrompt("");
    }
  }

  async function runRegenerateSection(opts?: { instruction?: string; schemaJson?: string }) {
    const ids = normalizeRefineSectionIds(effectiveSectionIds, 3);
    if (ids.length === 0) {
      onError("Choose a section to update.");
      return;
    }
    const inst = (opts?.instruction ?? userPrompt).trim();
    const schemaPass = opts?.schemaJson ?? schemaText;
    if (inst) pushChatMessage("user", inst);
    await withBusy(async () => {
      onError(null);
      onSectionRegenerationVisualMask?.(true);
      try {
        if (inst) {
          const handled = await tryExecuteIntentNlEdit(inst, { schemaJson: schemaPass });
          if (handled) {
            if (lastExecuteIntentChatReplyRef.current) {
              pushChatMessage("assistant", lastExecuteIntentChatReplyRef.current);
            }
            return;
          }
        }
        if (ids.length === 1) {
          await executeRegenerateSectionPipeline(inst, ids[0]!, { schemaSource: schemaPass });
        } else {
          await executeRegenerateBatchPipeline(inst, ids, { schemaSource: schemaPass });
        }
        if (inst) {
          pushChatMessage("assistant", "Regenerated the selected section(s) from your instruction.");
        }
      } finally {
        onSectionRegenerationVisualMask?.(false);
      }
    });
    if (inst) setUserPrompt("");
  }

  async function runRefineSectionRegenerate(
    instruction: string,
    opts?: { sectionId?: string; sectionIds?: string[]; source?: "panel" | "canvas" },
  ): Promise<void> {
    const fromOpts = normalizeRefineSectionIds(
      opts?.sectionIds?.length ? opts.sectionIds : opts?.sectionId ? [opts.sectionId] : sectionIdsRef.current,
      3,
    );
    if (fromOpts.length === 0) {
      onError("Choose a section to update.");
      throw new Error("No section");
    }
    setUserPrompt(instruction);
    const busyWrap = withBusyRethrowing ?? withBusy;
    await busyWrap(async () => {
      onError(null);
      onSectionRegenerationVisualMask?.(true);
      try {
        if (fromOpts.length === 1) {
          await executeRegenerateSectionPipeline(instruction, fromOpts[0]!);
        } else {
          await executeRegenerateBatchPipeline(instruction, fromOpts);
        }
      } finally {
        onSectionRegenerationVisualMask?.(false);
      }
    });
  }

  useImperativeHandle(
    ref,
    () => ({
      runFullBuild: (opts?: { source?: "panel" | "sticky_bar" }) => runFullBuild(opts),
      runFullBuildWithRefinement: (opts?: { source?: "panel" | "sticky_bar" }) => runFullBuildWithRefinement(opts),
      runPlan: () => runPlan(),
      submitOmnibarCommand: () => submitOmnibarCommand(),
      runRefineSectionRegenerate: (instruction: string, opts?: { sectionId?: string; sectionIds?: string[]; source?: "panel" | "canvas" }) =>
        runRefineSectionRegenerate(instruction, opts),
      prefillUserPrompt: (text: string) => {
        setUserPrompt(text);
      },
      clearComposerImageAttachments: () => setComposerImageAttachments([]),
      notifyClientLifecycle: (phase: SiteBuilderClientLifecyclePhase) => {
        if (phase === "post_agent_attach") {
          pushChatMessage(
            "assistant",
            "Your client's AI assistant is connected. Would you like to invite the client to their portal? Send the invite from Client Hub → Client portal (email only sends after you confirm there).",
          );
          return;
        }
        if (phase === "post_publish_deploy") {
          pushChatMessage(
            "assistant",
            "Your client portal handoff is ready in the hosted app. Send an invite when you are ready from Revenue OS → Client Hub.",
          );
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable enough for operator triggers
    [
      schemaText,
      userPrompt,
      siteType,
      designDirection,
      styleIntensity,
      web3VisualMode,
      workflowStage,
      planner,
      refinementAnswers,
      withBusyRethrowing,
      onSectionRegenerationVisualMask,
      onAiEditCompleted,
    ]
  );

  const shell =
    "rounded-2xl border border-white/[0.07] bg-slate-900/35 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-md";
  const field =
    "rounded-xl border border-white/[0.06] bg-slate-950/50 text-slate-100 placeholder:text-slate-600 focus:border-indigo-400/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30";
  const label = "text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";

  function applyInspirationExample(ex: (typeof INSPIRATION_EXAMPLES)[number], fromChip?: boolean) {
    setUserPrompt(ex.prompt);
    setSiteType(ex.siteType);
    setDesignDirection(ex.designDirection);
    setStyleIntensity(ex.styleIntensity);
    setWeb3VisualMode(ex.web3VisualMode);
    if (fromChip) {
      trackSiteBuilderEvent("site_builder_inspiration_chip_clicked", {
        ...inputAnalyticsProps(),
        example_id: ex.id,
      });
    }
  }

  function applyOutputProofFeel(id: OutputProofFeelId) {
    const ex = INSPIRATION_EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    trackSiteBuilderEvent("site_builder_proof_snapshot_clicked", {
      ...inputAnalyticsProps(),
      feel_id: id,
      example_id: ex.id,
    });
    applyInspirationExample(ex);
  }

  const showDescribe = workflowStage === "describe";
  const showReview = workflowStage === "review";
  const showRefine = workflowStage === "refine";
  const showPublish = workflowStage === "publish";
  const assistantStatusLabel = useMemo(
    () =>
      deriveAssistantStatusLabel({
        nlApplying: nlAssistStrip.kind === "applying",
        busy,
        buildPhase: assistantBuildPhase,
        showRefine,
      }),
    [nlAssistStrip.kind, busy, assistantBuildPhase, showRefine],
  );

  const refinableHomeCount = useMemo(() => listRefinableSectionIdsOnPage(schemaText).length, [schemaText]);
  const draftModeActive = useMemo(
    () => isSiteBuilderDraftMode(schemaText, builderSiteId),
    [schemaText, builderSiteId],
  );
  useEffect(() => {
    if (typeof window === "undefined" || !draftModeActive) return;
    const id = window.setTimeout(() => {
      persistDraftSchemaToSession(schemaText);
    }, 600);
    return () => window.clearTimeout(id);
  }, [schemaText, draftModeActive]);
  const omnibarRoute = useMemo(
    () =>
      resolveOmnibarSubmitRoute({
        stage: workflowStage,
        selectedSectionCount: effectiveSectionIds.length,
        hasPlanner: Boolean(planner),
        refinableHomeSectionCount: refinableHomeCount,
      }),
    [workflowStage, effectiveSectionIds.length, planner, refinableHomeCount],
  );

  function omnibarPrimaryActionLabel(): string {
    const sel = effectiveSectionIds.length;
    switch (omnibarRoute) {
      case "publish_skip":
        return "Publishing shortcuts";
      case "describe_plan":
        return "Build site";
      case "review_plan_first":
        return "Build site";
      case "review_full_build":
        return "Build site";
      case "refine_sections":
        return sel > 1 ? "Send to sections" : "Send to section";
      case "refine_light_page":
        return "Send";
      case "refine_heavy_page":
        return "Send";
      default:
        return "Apply";
    }
  }

  const brandBrainProactiveSlice = useMemo(() => {
    try {
      const doc = JSON.parse(schemaText) as {
        metadata?: { brandBrain?: { improvementQueue?: BrandBrainQueueItem[]; evaluatedAt?: string } };
      };
      const bb = doc.metadata?.brandBrain;
      const q = bb?.improvementQueue;
      if (!Array.isArray(q) || !bb?.evaluatedAt) return { evaluatedAt: "", items: [] as BrandBrainQueueItem[] };
      const dismissed = new Set(sessionEditContextRef.current?.brandBrainSession?.dismissedSuggestionCodes ?? []);
      return { evaluatedAt: bb.evaluatedAt, items: pickProactiveSuggestionLabels(q, dismissed, 3) };
    } catch {
      return { evaluatedAt: "", items: [] as BrandBrainQueueItem[] };
    }
  }, [schemaText, brandBrainUiTick]);

  useEffect(() => {
    if (!showRefine || !brandBrainProactiveSlice.evaluatedAt) return;
    const style_mode = readStyleModeFromSchemaJson(schemaText);
    for (const item of brandBrainProactiveSlice.items) {
      const key = `${brandBrainProactiveSlice.evaluatedAt}:${item.code}`;
      if (brandBrainShownKeysRef.current.has(key)) continue;
      brandBrainShownKeysRef.current.add(key);
      trackSiteBuilderEvent("site_builder_brand_brain_suggestion_shown", {
        finding_code: item.code,
        severity: item.severity,
        scope: item.scope,
        workflow_stage: workflowStage,
        ...(style_mode ? { style_mode } : {}),
      });
    }
  }, [showRefine, brandBrainProactiveSlice, workflowStage, schemaText]);

  const dismissBrandBrainItem = useCallback(
    (item: BrandBrainQueueItem) => {
      sessionEditContextRef.current = mergeBrandBrainDismiss(sessionEditContextRef.current, item.code);
      const style_mode = readStyleModeFromSchemaJson(schemaText);
      trackSiteBuilderEvent("site_builder_brand_brain_suggestion_dismissed", {
        finding_code: item.code,
        severity: item.severity,
        scope: item.scope,
        workflow_stage: workflowStage,
        ...(style_mode ? { style_mode } : {}),
      });
      setBrandBrainUiTick((t) => t + 1);
    },
    [schemaText, workflowStage],
  );

  const applyBrandBrainItem = useCallback(
    (item: BrandBrainQueueItem) => {
      if (item.fixability !== "safe_auto") return;
      try {
        const parsed = JSON.parse(schemaText) as SiteSchemaDocumentType;
        const sm = styleModeFromSiteDocument(parsed);
        const touched = applyBrandBrainFixByCode(parsed, item.code);
        if (touched) {
          applyTroothertzVisualPostProcessToDocument(parsed, sm);
        }
        applyBrandBrainAfterTroothertz(parsed, parsed, "suggest_only");
        applySchemaMergingSiteAssets(JSON.stringify(parsed, null, 2));
        sessionEditContextRef.current = mergeBrandBrainAccept(sessionEditContextRef.current, item);
        const style_mode = readStyleModeFromSchemaJson(schemaText);
        const base = {
          finding_code: item.code,
          severity: item.severity,
          scope: item.scope,
          workflow_stage: workflowStage,
          ...(style_mode ? { style_mode } : {}),
        };
        if (touched) {
          trackSiteBuilderEvent("site_builder_brand_brain_fix_applied", base);
        }
        trackSiteBuilderEvent("site_builder_brand_brain_suggestion_accepted", base);
        emitBrandBrainAnalyticsForSchema(parsed, workflowStage);
        emitAgencyLaunchAnalyticsForSchema(parsed, workflowStage);
        setBrandBrainUiTick((t) => t + 1);
        setAgencyUiTick((t) => t + 1);
        onNotice(touched ? "Applied a light brand-consistency pass." : "Noted — that steer is already in good shape.");
      } catch {
        onError("Could not apply suggestion.");
      }
    },
    [schemaText, workflowStage, onNotice, onError],
  );

  const agencyLaunchSlice = useMemo(() => {
    try {
      const doc = JSON.parse(schemaText) as {
        metadata?: {
          agencyLaunch?: {
            evaluatedAt?: string;
            readiness?: string;
            launchQueue?: AgencyTask[];
            deliverableSuggestions?: Array<{ id: string; label: string }>;
          };
        };
      };
      const al = doc.metadata?.agencyLaunch;
      if (!al?.evaluatedAt || !Array.isArray(al.launchQueue)) {
        return { evaluatedAt: "", readiness: "needs_attention", actions: [] as AgencyTask[], deliverableLine: "" };
      }
      const dismissed = new Set(sessionEditContextRef.current?.agencySession?.dismissedTaskIds ?? []);
      const accepted = new Set(sessionEditContextRef.current?.agencySession?.acceptedTaskIds ?? []);
      const actions = pickAgencyLaunchActions(al.launchQueue, dismissed, accepted, 3);
      const d0 = al.deliverableSuggestions?.[0];
      return {
        evaluatedAt: al.evaluatedAt,
        readiness: al.readiness ?? "needs_attention",
        actions,
        deliverableLine: d0?.label ?? "",
      };
    } catch {
      return { evaluatedAt: "", readiness: "needs_attention", actions: [] as AgencyTask[], deliverableLine: "" };
    }
  }, [schemaText, agencyUiTick]);

  useEffect(() => {
    if (!(showRefine || showPublish) || !agencyLaunchSlice.evaluatedAt) return;
    const style_mode = readStyleModeFromSchemaJson(schemaText);
    for (const task of agencyLaunchSlice.actions) {
      const key = `${agencyLaunchSlice.evaluatedAt}:${task.id}`;
      if (agencyShownKeysRef.current.has(key)) continue;
      agencyShownKeysRef.current.add(key);
      trackSiteBuilderEvent("site_builder_launch_queue_item_shown", {
        item_type: task.type,
        code: task.id,
        scope: task.scope,
        priority: task.priority,
        workflow_stage: workflowStage,
        ...(style_mode ? { style_mode } : {}),
      });
    }
  }, [showRefine, showPublish, agencyLaunchSlice, workflowStage, schemaText]);

  const dismissAgencyItem = useCallback(
    (task: AgencyTask) => {
      sessionEditContextRef.current = mergeAgencyDismiss(sessionEditContextRef.current, task.id);
      const style_mode = readStyleModeFromSchemaJson(schemaText);
      trackSiteBuilderEvent("site_builder_launch_queue_item_dismissed", {
        item_type: task.type,
        code: task.id,
        scope: task.scope,
        priority: task.priority,
        workflow_stage: workflowStage,
        ...(style_mode ? { style_mode } : {}),
      });
      setAgencyUiTick((t) => t + 1);
    },
    [schemaText, workflowStage],
  );

  const applyAgencyItem = useCallback(
    (task: AgencyTask) => {
      try {
        const style_mode = readStyleModeFromSchemaJson(schemaText);
        const base = {
          item_type: task.type,
          code: task.id,
          scope: task.scope,
          priority: task.priority,
          workflow_stage: workflowStage,
          ...(style_mode ? { style_mode } : {}),
        };
        if (task.linkedBrandBrainCode) {
          const parsed = JSON.parse(schemaText) as SiteSchemaDocumentType;
          const sm = styleModeFromSiteDocument(parsed);
          const touched = applyBrandBrainFixByCode(parsed, task.linkedBrandBrainCode);
          if (touched) {
            applyTroothertzVisualPostProcessToDocument(parsed, sm);
          }
          applyBrandBrainAfterTroothertz(parsed, parsed, "suggest_only");
          applySchemaMergingSiteAssets(JSON.stringify(parsed, null, 2));
          emitBrandBrainAnalyticsForSchema(parsed, workflowStage);
          emitAgencyLaunchAnalyticsForSchema(parsed, workflowStage);
          onNotice(touched ? "Applied a launch-aligned brand pass." : "Brand steer already matches — launch queue updated.");
        } else {
          if (task.refineInstructionHint?.trim()) {
            setUserPrompt(task.refineInstructionHint.trim());
            onNotice("Instruction set in Refine—pick a section and rebuild when ready.");
          } else {
            onNotice(task.label);
          }
        }
        sessionEditContextRef.current = mergeAgencyAccept(sessionEditContextRef.current, task);
        trackSiteBuilderEvent("site_builder_launch_queue_item_accepted", base);
        setAgencyUiTick((t) => t + 1);
      } catch {
        onError("Could not apply launch action.");
      }
    },
    [schemaText, workflowStage, onNotice, onError],
  );

  const importRestructureSlice = useMemo(() => {
    try {
      const doc = JSON.parse(schemaText) as SiteSchemaDocumentType;
      if (!doc.metadata?.siteImport) return { evaluatedAt: "", items: [] as ImportRestructureQueueItem[], summary: "" };
      const items = pickImportRestructureSuggestionsForUi(doc, 4);
      const evaluatedAt = doc.metadata.importedSiteAudit?.evaluatedAt ?? "";
      const summary = doc.metadata.importedSiteAudit?.summary ?? "";
      return { evaluatedAt, items, summary };
    } catch {
      return { evaluatedAt: "", items: [] as ImportRestructureQueueItem[], summary: "" };
    }
  }, [schemaText, importRestructureUiTick]);

  const deliverablesEligible = useMemo(() => {
    try {
      const raw = JSON.parse(schemaText);
      const parsed = SiteSchemaDocument.safeParse(raw);
      return Boolean(parsed.success && parsed.data.metadata?.importedSiteAudit);
    } catch {
      return false;
    }
  }, [schemaText, importRestructureUiTick]);

  const consultantProposalPosture = useMemo(() => {
    try {
      const raw = JSON.parse(schemaText);
      const parsed = SiteSchemaDocument.safeParse(raw);
      return parsed.success ? parsed.data.metadata?.consultantProposalPosture : undefined;
    } catch {
      return undefined;
    }
  }, [schemaText, importRestructureUiTick]);

  const clientHandoffPreviewText = useMemo(() => {
    if (!handoffPreviewOpen || !deliverablesEligible) return "";
    try {
      const raw = JSON.parse(schemaText);
      const parsed = SiteSchemaDocument.safeParse(raw);
      if (!parsed.success || !parsed.data.metadata?.importedSiteAudit) return "";
      const pack = assembleDeliverablesFromSchema(parsed.data);
      const md = renderClientHandoffMarkdown(pack, buildClientHandoffContext(parsed.data));
      return md.length > 1600 ? `${md.slice(0, 1600).trim()}\n\n…` : md;
    } catch {
      return "";
    }
  }, [handoffPreviewOpen, deliverablesEligible, schemaText, importRestructureUiTick]);

  useEffect(() => {
    if (!showRefine) return;
    const timer = window.setTimeout(() => {
      try {
        const doc = JSON.parse(schemaText) as SiteSchemaDocumentType;
        if (!doc.metadata?.siteImport) return;
        const { doc: merged, changed } = syncImportRestructureIntoDocument(doc, { siteTypeHint: siteType });
        const fp = merged.metadata?.importedSiteAudit?.evaluatedAt ?? "";
        if (fp && fp !== importAuditFingerprintRef.current) {
          importAuditFingerprintRef.current = fp;
          let source_domain = "";
          try {
            const u = merged.metadata?.siteImport?.sourceUrl;
            if (typeof u === "string") source_domain = new URL(u).hostname;
          } catch {
            /* ignore */
          }
          trackSiteBuilderEvent("site_builder_import_audit_evaluated", {
            workflow_stage: workflowStage,
            site_type: siteType,
            opportunity_count: merged.metadata?.importedSiteAudit?.opportunities?.length ?? 0,
            modernization_profile: String(merged.metadata?.importedSiteAudit?.modernizationProfile ?? ""),
            ...(source_domain ? { source_domain } : {}),
            widget_attached: Boolean(merged.metadata?.widgetIntegration?.widgetKey),
          });
        }
        if (changed) {
          applySchemaMergingSiteAssets(JSON.stringify(merged, null, 2));
          setImportRestructureUiTick((x) => x + 1);
        }
      } catch {
        /* ignore */
      }
    }, 420);
    return () => window.clearTimeout(timer);
  }, [showRefine, schemaText, siteType, workflowStage]);

  useEffect(() => {
    if (!showRefine || !importRestructureSlice.evaluatedAt) return;
    const style_mode = readStyleModeFromSchemaJson(schemaText);
    let auditOpps: Array<{ code: string; severity: string }> | undefined;
    try {
      auditOpps = (
        JSON.parse(schemaText) as {
          metadata?: { importedSiteAudit?: { opportunities?: Array<{ code: string; severity: string }> } };
        }
      ).metadata?.importedSiteAudit?.opportunities;
    } catch {
      auditOpps = undefined;
    }
    for (const item of importRestructureSlice.items) {
      const key = `${importRestructureSlice.evaluatedAt}:${item.opportunityCode}`;
      if (importRestructureShownKeysRef.current.has(key)) continue;
      importRestructureShownKeysRef.current.add(key);
      let source_domain = "";
      try {
        const doc = JSON.parse(schemaText) as { metadata?: { siteImport?: { sourceUrl?: string } } };
        const u = doc.metadata?.siteImport?.sourceUrl;
        if (typeof u === "string") source_domain = new URL(u).hostname;
      } catch {
        /* ignore */
      }
      const severity = auditOpps?.find((o) => o.code === item.opportunityCode)?.severity ?? "info";
      trackSiteBuilderEvent("site_builder_import_opportunity_shown", {
        opportunity_code: item.opportunityCode,
        severity,
        priority: item.priority,
        scope: item.scope,
        workflow_stage: workflowStage,
        widget_attached: Boolean(
          (JSON.parse(schemaText) as { metadata?: { widgetIntegration?: { widgetKey?: string } } }).metadata?.widgetIntegration
            ?.widgetKey,
        ),
        ...(style_mode ? { style_mode } : {}),
        ...(source_domain ? { source_domain } : {}),
      });
    }
  }, [showRefine, importRestructureSlice, workflowStage, schemaText]);

  const dismissImportRestructureItem = useCallback(
    (item: ImportRestructureQueueItem) => {
      try {
        const doc = JSON.parse(schemaText) as SiteSchemaDocumentType;
        markImportRestructureQueueStatus(doc, item.opportunityCode, "dismissed");
        applySchemaMergingSiteAssets(JSON.stringify(SiteSchemaDocument.parse(doc), null, 2));
        setImportRestructureUiTick((t) => t + 1);
        let source_domain = "";
        try {
          const u = doc.metadata?.siteImport?.sourceUrl;
          if (typeof u === "string") source_domain = new URL(u).hostname;
        } catch {
          /* ignore */
        }
        trackSiteBuilderEvent("site_builder_import_opportunity_dismissed", {
          opportunity_code: item.opportunityCode,
          priority: item.priority,
          scope: item.scope,
          workflow_stage: workflowStage,
          ...(source_domain ? { source_domain } : {}),
          widget_attached: Boolean(doc.metadata?.widgetIntegration?.widgetKey),
        });
      } catch {
        onError("Could not dismiss suggestion.");
      }
    },
    [schemaText, workflowStage, onError],
  );

  const applyImportRestructureItem = useCallback(
    (item: ImportRestructureQueueItem) => {
      try {
        const doc = JSON.parse(schemaText) as SiteSchemaDocumentType;
        const { doc: next, applied, kind } = applyImportRestructureOpportunity(doc, item.opportunityCode);
        applySchemaMergingSiteAssets(JSON.stringify(next, null, 2));
        setImportRestructureUiTick((t) => t + 1);
        let source_domain = "";
        try {
          const u = next.metadata?.siteImport?.sourceUrl;
          if (typeof u === "string") source_domain = new URL(u).hostname;
        } catch {
          /* ignore */
        }
        trackSiteBuilderEvent("site_builder_import_opportunity_accepted", {
          opportunity_code: item.opportunityCode,
          priority: item.priority,
          scope: item.scope,
          restructure_kind: kind,
          workflow_stage: workflowStage,
          ...(source_domain ? { source_domain } : {}),
          widget_attached: Boolean(next.metadata?.widgetIntegration?.widgetKey),
          applied,
        });
        if (applied) {
          trackSiteBuilderEvent("site_builder_import_restructure_applied", {
            opportunity_code: item.opportunityCode,
            priority: item.priority,
            scope: item.scope,
            restructure_kind: kind,
            workflow_stage: workflowStage,
            ...(source_domain ? { source_domain } : {}),
            widget_attached: Boolean(next.metadata?.widgetIntegration?.widgetKey),
          });
        }
        onNotice(applied ? "Applied a guided restructuring pass." : "Nothing automatic matched—adjust in Refine or pick another suggestion.");
      } catch {
        onError("Could not apply restructuring.");
      }
    },
    [schemaText, workflowStage, onNotice, onError],
  );

  const importRestructureStrip =
    showRefine && importRestructureSlice.items.length > 0 ? (
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/10 p-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-indigo-200/90">
          <LayoutTemplate className="h-3.5 w-3.5 text-indigo-300/90" aria-hidden />
          Import redesign
        </div>
        {importRestructureSlice.summary ? (
          <p className="mt-1.5 text-xs leading-snug text-slate-400/95">
            {importRestructureSlice.summary.length > 320
              ? `${importRestructureSlice.summary.slice(0, 320)}…`
              : importRestructureSlice.summary}
          </p>
        ) : null}
        <ul className="mt-2 space-y-2">
          {importRestructureSlice.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-white/[0.06] bg-slate-950/35 px-2.5 py-2"
            >
              <p className="min-w-0 flex-1 text-sm leading-snug text-slate-200/95">
                {item.consultantLine ?? item.recommendation}
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => applyImportRestructureItem(item)}
                  className="rounded-full border border-indigo-400/35 bg-indigo-500/15 px-2.5 py-1 text-[11px] font-semibold text-indigo-100/95 transition-colors hover:border-indigo-300/45 hover:bg-indigo-500/20 disabled:pointer-events-none disabled:opacity-40"
                >
                  Apply
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => dismissImportRestructureItem(item)}
                  className="rounded-full px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300 disabled:opacity-40"
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const agencyLaunchStrip =
    agencyLaunchSlice.evaluatedAt && (showRefine || showPublish) ? (
      <div
        className={`mt-4 rounded-xl border p-3 ${
          agencyLaunchSlice.readiness === "launch_ready"
            ? "border-emerald-500/25 bg-emerald-950/12"
            : agencyLaunchSlice.readiness === "needs_attention"
              ? "border-amber-500/25 bg-amber-950/12"
              : "border-rose-500/20 bg-rose-950/12"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-200/90">
            <ClipboardList className="h-3.5 w-3.5 text-sky-300/90" aria-hidden />
            Launch readiness
          </div>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              agencyLaunchSlice.readiness === "launch_ready"
                ? "border-emerald-400/35 text-emerald-100/95"
                : agencyLaunchSlice.readiness === "needs_attention"
                  ? "border-amber-400/35 text-amber-100/95"
                  : "border-rose-400/35 text-rose-100/90"
            }`}
          >
            {agencyLaunchSlice.readiness === "launch_ready"
              ? "Launch-ready"
              : agencyLaunchSlice.readiness === "needs_attention"
                ? "Needs attention"
                : "Draft"}
          </span>
        </div>
        {agencyLaunchSlice.deliverableLine ? (
          <p className="mt-2 text-xs leading-snug text-slate-400/95">{agencyLaunchSlice.deliverableLine}</p>
        ) : null}
        {agencyLaunchSlice.actions.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {agencyLaunchSlice.actions.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-white/[0.06] bg-slate-950/35 px-2.5 py-2"
              >
                <p className="min-w-0 flex-1 text-sm leading-snug text-slate-200/95">{task.label}</p>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => applyAgencyItem(task)}
                    className="rounded-full border border-sky-400/35 bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-100/95 transition-colors hover:border-sky-300/45 hover:bg-sky-500/20 disabled:pointer-events-none disabled:opacity-40"
                  >
                    {task.linkedBrandBrainCode ? "Apply" : task.refineInstructionHint ? "Use in Refine" : "Next"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => dismissAgencyItem(task)}
                    className="rounded-full px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300 disabled:opacity-40"
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-500">No queued actions right now—your session choices are in sync.</p>
        )}
      </div>
    ) : null;

  const proposalTierSelected = consultantProposalPosture?.selectedTier ?? "standard";
  const proposalScopePostureSelected = consultantProposalPosture?.scopePosture ?? "core";

  const deliverablesPackStrip =
    deliverablesEligible && (showRefine || showPublish) ? (
      <div className="rounded-xl border border-white/[0.08] bg-slate-950/35 p-3.5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-300/95">
          <FileText className="h-3.5 w-3.5 text-slate-400/90" aria-hidden />
          Client deliverables
        </div>
        <p className="mt-1.5 text-xs leading-snug text-slate-500">
          Handoff, proposals, approval/onboarding/kickoff artifacts, structured JSON, and summary—built from your imported-site review.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void downloadClientDeliverablesPack()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-500/35 bg-slate-900/50 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:border-slate-400/45 hover:bg-slate-800/60 disabled:pointer-events-none disabled:opacity-40"
          >
            <FileText className="h-4 w-4 text-slate-300/90" aria-hidden />
            Download deliverables pack
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void downloadProposalPackage()}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-100 transition-colors hover:border-indigo-400/45 hover:bg-indigo-500/15 disabled:pointer-events-none disabled:opacity-40"
          >
            <FileText className="h-4 w-4 text-indigo-200/90" aria-hidden />
            Proposal package
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void downloadClosePackage()}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400/45 hover:bg-emerald-500/15 disabled:pointer-events-none disabled:opacity-40"
          >
            <FileText className="h-4 w-4 text-emerald-200/90" aria-hidden />
            Close package
          </button>
        </div>
        <p className="mt-3 text-[11px] font-medium text-slate-500">Proposal posture (artifacts &amp; close copy)</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(["essential", "standard", "partner"] as const).map((t) => (
            <button
              key={t}
              type="button"
              disabled={busy}
              onClick={() => patchConsultantProposalPosture({ selectedTier: t })}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-40 ${
                proposalTierSelected === t
                  ? "border border-emerald-400/45 bg-emerald-500/15 text-emerald-100"
                  : "border border-white/[0.08] bg-slate-950/50 text-slate-400 hover:border-white/[0.12] hover:text-slate-200"
              }`}
            >
              {t === "essential" ? "Essential" : t === "standard" ? "Standard" : "Partner"}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(["starter", "core", "expanded"] as const).map((p) => (
            <button
              key={p}
              type="button"
              disabled={busy}
              onClick={() => patchConsultantProposalPosture({ scopePosture: p })}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-40 ${
                proposalScopePostureSelected === p
                  ? "border border-sky-400/40 bg-sky-500/10 text-sky-100"
                  : "border border-white/[0.06] bg-slate-950/40 text-slate-500 hover:border-white/[0.1] hover:text-slate-300"
              }`}
            >
              {p === "starter" ? "Starter" : p === "core" ? "Core" : "Expanded"}
            </button>
          ))}
        </div>
        <details
          className="mt-3 rounded-lg border border-white/[0.06] bg-slate-950/50"
          onToggle={(e) => {
            const open = (e.target as HTMLDetailsElement).open;
            setHandoffPreviewOpen(open);
            if (!open) return;
            try {
              const raw = JSON.parse(schemaText);
              const parsed = SiteSchemaDocument.safeParse(raw);
              if (!parsed.success || !parsed.data.metadata?.importedSiteAudit) return;
              const d = parsed.data;
              const br = d.metadata?.builderRefinement as { deploymentTarget?: string } | undefined;
              const deployment_target = typeof br?.deploymentTarget === "string" ? br.deploymentTarget : "static";
              trackSiteBuilderEvent("site_builder_client_handoff_previewed", {
                workflow_stage: workflowStage,
                deployment_target,
                widget_attached: Boolean(d.metadata?.widgetIntegration?.widgetKey),
                route_count: d.pages?.length ?? 0,
                imported_site: Boolean(d.metadata?.siteImport),
              });
            } catch {
              /* ignore */
            }
          }}
        >
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:text-slate-200">
            Preview handoff excerpt
          </summary>
          {handoffPreviewOpen ? (
            clientHandoffPreviewText ? (
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words border-t border-white/[0.05] px-3 py-2.5 text-[11px] leading-relaxed text-slate-400">
                {clientHandoffPreviewText}
              </pre>
            ) : (
              <p className="border-t border-white/[0.05] px-3 py-2 text-[11px] text-slate-500">Preview unavailable for the current schema state.</p>
            )
          ) : null}
        </details>
      </div>
    ) : null;

  return (
    <motion.section layout className={`${shell} @container mb-4`} transition={{ duration: 0.25 }}>
      <div className="flex w-full min-w-0 flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-slate-500">{STEPHON_DISPLAY_NAME}</p>
            {chatMessages.length > 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => clearAssistantChat()}
                title="Clear conversation (does not remove site intelligence or generation history)"
                className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-slate-400 transition-colors hover:border-slate-500/40 hover:text-slate-200 disabled:opacity-40"
              >
                <Trash2 className="h-3 w-3" aria-hidden />
                Clear chat
              </button>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-300/90" aria-hidden />
              <span className="text-lg font-semibold tracking-tight text-slate-100">Build with Stephon</span>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                assistantStatusLabel === "Applying edit"
                  ? "bg-sky-500/20 text-sky-100"
                  : assistantStatusLabel === "Building" || assistantStatusLabel === "Working"
                    ? "bg-amber-500/20 text-amber-100"
                    : assistantStatusLabel === "Critiquing" || assistantStatusLabel === "Improving"
                      ? "bg-fuchsia-500/20 text-fuchsia-100"
                      : assistantStatusLabel === "Editing"
                        ? "bg-violet-500/20 text-violet-100"
                        : "bg-emerald-500/15 text-emerald-100/90"
              }`}
            >
              {assistantStatusLabel}
            </span>
            {llmEnriched !== null && (showDescribe || showReview) ? (
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-slate-400">
                {llmEnriched ? "Plan · refined" : "Plan · balanced"}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className="mt-3 max-h-56 min-h-[5.5rem] space-y-2 overflow-y-auto pr-0.5"
        role="log"
        aria-relevant="additions"
        aria-label="Assistant conversation"
      >
        {conversationalIntakeActive && showDescribe ? (
          <p
            className="mb-2 rounded-lg border border-cyan-500/20 bg-cyan-950/40 px-3 py-2 text-[11px] leading-relaxed text-cyan-100/90"
            role="status"
          >
            Guided intake:{" "}
            {conversationalIntakeProgress(conversationalIntakeAnswers, conversationalIntakeSkipped).completed} of{" "}
            {conversationalIntakeProgress(conversationalIntakeAnswers, conversationalIntakeSkipped).total} questions
            complete — reply in the box below.
          </p>
        ) : null}
        {chatMessages.length === 0 && showDescribe ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <div
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/20"
                aria-hidden
              >
                <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
              </div>
              <p
                className="min-w-0 max-w-[min(100%,32rem)] rounded-2xl border border-white/[0.06] bg-slate-950/55 px-3.5 py-2 text-sm leading-relaxed text-slate-200"
                role="status"
              >
                {FIRST_RUN_WELCOME_TEXT}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pl-0 sm:pl-9" aria-label="Example prompts">
              {WELCOME_EXAMPLE_CHIPS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setUserPrompt(c.prompt);
                    requestAnimationFrame(() => composerInputRef.current?.focus());
                  }}
                  className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-medium text-indigo-100/90 transition-colors hover:border-indigo-300/50 hover:bg-indigo-500/20 disabled:pointer-events-none disabled:opacity-40"
                >
                  {c.label}
                </button>
              ))}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  startConversationalIntake();
                  requestAnimationFrame(() => composerInputRef.current?.focus());
                }}
                className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-medium text-cyan-100/90 transition-colors hover:border-cyan-300/50 hover:bg-cyan-500/20 disabled:pointer-events-none disabled:opacity-40"
              >
                Guided intake (step by step)
              </button>
            </div>
          </div>
        ) : chatMessages.length === 0 ? (
          <p className="rounded-xl border border-white/[0.05] bg-slate-950/35 px-3 py-2.5 text-sm leading-relaxed text-slate-500">
            {showReview
              ? "Press Enter to build from your brief, or use Manual Tools if you only want a plan and outline first."
              : showRefine
                ? "Ask in plain language, or use a quick suggestion. With a saved project, we try the smart editor (execute-intent) first, then the section pipeline as needed. Shift-click sections in the preview to target up to three."
                : "Publishing and go-live settings stay in Advanced and the step bar below."}
          </p>
        ) : null}
        {chatMessages.map((m) => {
          const isUser = m.role === "user";
          const isErr = m.role === "error";
          const isStatus = m.role === "status";
          const isDebug = m.role === "debug";
          return (
            <div
              key={m.id}
              className={`flex items-start gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  isUser ? "bg-slate-600/50" : isErr ? "bg-red-500/20" : "bg-indigo-500/20"
                }`}
                aria-hidden
              >
                {isUser ? (
                  <User className="h-3.5 w-3.5 text-slate-200" />
                ) : isErr ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-200" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
                )}
              </div>
              <p
                className={`min-w-0 max-w-[min(100%,32rem)] rounded-2xl px-3.5 py-2 leading-relaxed ${
                  isUser
                    ? "bg-slate-800/85 text-sm text-slate-100"
                    : isErr
                      ? "border border-red-500/35 bg-red-950/35 text-sm text-red-100/95"
                      : isStatus
                        ? "border border-white/[0.05] bg-slate-950/30 text-xs text-slate-400"
                        : isDebug
                          ? "border border-white/[0.04] bg-slate-950/40 font-mono text-[10px] text-slate-500"
                          : "border border-white/[0.06] bg-slate-950/55 text-sm text-slate-200"
                }`}
              >
                {m.content}
              </p>
            </div>
          );
        })}
        <div ref={chatEndRef} className="h-0 w-full shrink-0" aria-hidden />
      </div>
      {typeof onBuildForClientChange === "function" && (showDescribe || showReview) ? (
        <div className="mt-3 flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-slate-950/50 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={buildForClient}
              disabled={busy}
              onChange={(e) => onBuildForClientChange(e.target.checked)}
              className="rounded border-slate-600 bg-slate-950 text-violet-500 focus:ring-violet-500/40"
            />
            <span>
              Build for Revenue OS client{" "}
              <span className="font-normal text-slate-500">(required to run full generation)</span>
            </span>
          </label>
          {buildForClient ? (
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md sm:items-stretch">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
                <span className="shrink-0 text-[11px] text-slate-500">Hub client</span>
                <select
                  className="w-full min-w-[200px] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 sm:w-auto"
                  value={hubClientPick}
                  onChange={(e) => onHubClientPickChange?.(e.target.value)}
                  disabled={busy || (hubClients.length === 0 && !onCreateHubClient)}
                >
                  <option value="">{hasSelectedProject ? "Select client…" : "Select client (applied on create)…"}</option>
                  {hubClients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {onCreateHubClient ? (
                <div className="flex flex-col gap-1.5 rounded-lg border border-white/[0.06] bg-slate-900/45 p-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    New Revenue OS client
                  </span>
                  <div className="flex flex-wrap items-stretch gap-1.5 sm:flex-nowrap">
                    <input
                      type="text"
                      value={newHubClientDraft}
                      onChange={(e) => setNewHubClientDraft(e.target.value)}
                      placeholder="Company or contact name"
                      disabled={busy || hubClientCreateBusy}
                      className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-600"
                    />
                    <button
                      type="button"
                      disabled={busy || hubClientCreateBusy || !newHubClientDraft.trim()}
                      onClick={() =>
                        void (async () => {
                          try {
                            await onCreateHubClient(newHubClientDraft);
                            setNewHubClientDraft("");
                          } catch {
                            /* parent onError */
                          }
                        })()
                      }
                      className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {hubClientCreateBusy ? "Creating…" : "Create & select"}
                    </button>
                  </div>
                  <p className="text-[10px] leading-relaxed text-slate-500">
                    Creates the same{" "}
                    <a className="text-cyan-400/90 hover:underline" href="/ai-revenue-os/clients">
                      Client Hub
                    </a>{" "}
                    record used in onboarding and contacts, then selects it for full generation.
                  </p>
                </div>
              ) : null}
              {!hubClients.length ? (
                <span className="text-[11px] text-amber-200/80">
                  {onCreateHubClient
                    ? "No clients yet — create one above or in Revenue OS."
                    : "No hub clients — add one in Revenue OS first."}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {plannerLlmStatusLine ? (
        <div
          className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-2.5 text-xs leading-relaxed text-emerald-100/90"
          role="status"
        >
          {plannerLlmStatusLine}
        </div>
      ) : null}
      {llmEnriched === false && plannerLlmFallbackDetail ? (
        <div
          className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2.5 text-xs leading-relaxed text-amber-100/90"
          role="status"
        >
          <span className="font-semibold text-amber-50/95">Fallback mode (no structured LLM plan).</span> The build used
          the template planner.{" "}
          {plannerLlmFallbackDetail.reason ? (
            <span className="text-amber-200/90">Reason: {plannerLlmFallbackDetail.reason}. </span>
          ) : null}
          {plannerLlmFallbackDetail.model ? (
            <span className="text-amber-200/90">Model line: {plannerLlmFallbackDetail.model}. </span>
          ) : null}
          Set <code className="text-amber-200/90">OPENAI_API_KEY</code> or <code className="text-amber-200/90">NPC_LLM_*</code>{" "}
          on the server, or open Site → AI and choose platform or BYOK. If the site has AI set to off, turn it on to allow
          the model.
        </div>
      ) : null}
      {pipelineInputUnchangedWarning ? (
        <div className="mt-2 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.07] px-3 py-2 text-[11px] leading-relaxed text-cyan-100/90">
          Same pipeline input as last run — the plan or page may be identical. Change the brief, layout profile (0–7), or
          generate a new layout seed, then run again.
        </div>
      ) : null}
      {draftModeActive ? (
        <div
          className="mt-2 rounded-lg border border-slate-500/35 bg-slate-950/55 px-3 py-2 text-[11px] leading-relaxed text-slate-300"
          role="status"
        >
          <span className="font-semibold text-slate-100">Editing unsaved draft.</span> Save to enable deployment and
          server-backed agent actions. Theme, section, and copy edits apply here only until you create a site project.
        </div>
      ) : null}

      <div
        className={`mt-5 rounded-xl border border-indigo-500/20 bg-gradient-to-b from-indigo-500/[0.08] to-slate-950/40 p-4 shadow-[inset_0_1px_0_0_rgba(129,140,248,0.12)] ${
          composerDropActive ? "ring-2 ring-indigo-400/40 ring-offset-2 ring-offset-slate-950" : ""
        }`}
        aria-label="Command"
        onDragEnter={(e) => {
          e.preventDefault();
          setComposerDropActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          try {
            e.dataTransfer.dropEffect = "copy";
          } catch {
            /* ignore */
          }
        }}
        onDragLeave={() => setComposerDropActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setComposerDropActive(false);
          const list = e.dataTransfer?.files;
          if (!list?.length) return;
          void (async () => {
            try {
              for (const f of Array.from(list)) {
                if (f.type.startsWith("image/")) {
                  await uploadComposerImageAndStage(f);
                }
              }
            } catch (err) {
              onError(err instanceof Error ? err.message : "Image upload failed");
            }
          })();
        }}
      >
        <label className={`${label} text-indigo-200/90`}>Message</label>
        <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
          Drag and drop images here to attach; then describe placement (hero background, banner, logo, …) and press Enter.
        </p>
        {composerImageAttachments.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {composerImageAttachments.map((a) => (
              <div
                key={a.assetId}
                className="relative h-14 w-14 overflow-hidden rounded-lg border border-white/10 bg-slate-900"
                title={a.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.publicUrl} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={() => setComposerImageAttachments([])}
              className="rounded-full border border-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:border-red-400/50 hover:text-red-200 disabled:opacity-40"
            >
              Clear images
            </button>
          </div>
        ) : null}
        {builderSurface && onCapabilityAction ? (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Assistant capabilities">
            {(
              [
                ["build_site", "Build site"],
                ["import_url", "Import URL"],
                ["change_style", "Change style"],
                ["add_image", "Add image"],
                ["ai_widget", "AI widget"],
                ["share_preview", "Share preview"],
                ["open_engines", "Engines"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                disabled={busy}
                onClick={() => onCapabilityAction(id)}
                className="rounded-full border border-white/[0.1] bg-slate-950/60 px-2.5 py-1 text-[10px] font-medium text-slate-200 hover:border-indigo-400/35 hover:bg-indigo-500/10 disabled:pointer-events-none disabled:opacity-40"
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <p className="mt-1.5 text-[11px] font-semibold text-slate-300">
          {effectiveSectionIds.length > 0 ? "Target: selected section(s) in the preview" : "Target: full page"}
        </p>
        {showRefine ? (
          <div className="mt-2.5 flex flex-wrap gap-2" aria-label="Quick edit suggestions">
            {REFINE_QUICK_SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                type="button"
                disabled={busy}
                onClick={() => {
                  flushSync(() => {
                    setUserPrompt(s.text);
                  });
                  void submitOmnibarCommand();
                }}
                className="rounded-full border border-violet-500/25 bg-violet-500/[0.1] px-3 py-1.5 text-[11px] font-medium text-violet-100/95 transition-colors hover:border-violet-400/40 hover:bg-violet-500/20 disabled:pointer-events-none disabled:opacity-40"
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : null}
        <textarea
          ref={composerInputRef}
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          rows={workflowStage === "describe" ? 4 : 3}
          disabled={busy}
          className={`mt-2 min-h-[3.25rem] w-full resize-y px-3 py-2.5 text-sm leading-relaxed ${field}`}
          placeholder={
            showDescribe
              ? "e.g. A bold landing page for a boutique consulting firm…"
              : showRefine || showReview
                ? effectiveSectionIds.length > 0
                  ? "What should change? Hero, colors, pricing… (your preview selection is targeted first)"
                  : "What should change? Hero, colors, pricing, tone…"
                : "Describe a change, goal, or tone…"
          }
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.shiftKey) return;
            if (showDescribe || showReview || showRefine) {
              e.preventDefault();
              void submitOmnibarCommand();
              return;
            }
            if (!e.metaKey && !e.ctrlKey) return;
            e.preventDefault();
            void submitOmnibarCommand();
          }}
        />
        {autoBuildProgressLabel ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-2 rounded-lg border border-indigo-500/25 bg-indigo-500/[0.08] px-3 py-2 text-xs font-medium leading-relaxed text-indigo-100/95"
          >
            {autoBuildProgressLabel}
          </div>
        ) : null}
        {builderSurface ? (
          <details className="mt-2 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-300">
            <summary className="cursor-pointer select-none font-medium text-slate-200">Build debug</summary>
            <div className="mt-2 text-slate-300">
              stage={buildDebugInfo.stage}
              {" · "}api={buildDebugInfo.apiDurationMs == null ? "n/a" : `${buildDebugInfo.apiDurationMs}ms`}
              {" · "}schemaApplied={buildDebugInfo.schemaApplied ? "yes" : "no"}
              {" · "}variantPicker={buildDebugInfo.variantPickerOpened ? "open" : "closed"}
            </div>
          </details>
        ) : (
          <div className="mt-2 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-300">
            <span className="font-semibold text-slate-200">Build debug:</span>{" "}
            stage={buildDebugInfo.stage}
            {" · "}api={buildDebugInfo.apiDurationMs == null ? "n/a" : `${buildDebugInfo.apiDurationMs}ms`}
            {" · "}schemaApplied={buildDebugInfo.schemaApplied ? "yes" : "no"}
            {" · "}variantPicker={buildDebugInfo.variantPickerOpened ? "open" : "closed"}
          </div>
        )}
        {showBuildRetry ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void runFullBuildWithRefinement({ source: "panel" })}
            className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/20 disabled:opacity-50"
          >
            Retry build
          </button>
        ) : null}
        {deterministicFallbackNotice ? (
          <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
            {deterministicFallbackNotice}
          </div>
        ) : null}
        {contentIntelligenceMeta ? (
          <div
            className="mt-2 rounded-lg border border-cyan-500/25 bg-cyan-950/25 px-3 py-2 text-xs leading-relaxed text-cyan-100/90"
            role="status"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span>
                <span className="font-semibold text-cyan-50/95">Content score</span>{" "}
                <span className="tabular-nums">{contentIntelligenceMeta.contentScore}/100</span>
              </span>
              {contentIntelligenceMeta.repaired ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-100">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  Copy repaired for clarity
                </span>
              ) : null}
            </div>
            {contentIntelligenceMeta.genericContentWarning ? (
              <p className="mt-1.5 text-[11px] text-amber-200/95">
                Copy may still read generic—tighten the brief or add industry details in Refine.
              </p>
            ) : null}
            {inspirationPatternsUsedLast ? (
              <p className="mt-1.5 text-[11px] text-cyan-200/80">Inspiration patterns applied to layout and copy (not a site clone).</p>
            ) : null}
          </div>
        ) : null}
        {buildCritiqueMeta ? (
          <div
            className="mt-2 rounded-lg border border-violet-500/25 bg-violet-950/25 px-3 py-2 text-xs leading-relaxed text-violet-100/90"
            role="status"
          >
            {buildCritiqueMeta.autoRepaired ? (
              <span className="font-semibold text-violet-50/95">Copy/design repaired for clarity</span>
            ) : (buildCritiqueMeta.critiqueScore ?? 0) >= 62 ? (
              <span className="font-semibold text-violet-50/95">AI critique passed</span>
            ) : (
              <span>
                Layout critique {buildCritiqueMeta.critiqueScore}/100
                {buildCritiqueMeta.critiqueIssues?.length
                  ? ` — ${buildCritiqueMeta.critiqueIssues.slice(0, 3).join(", ")}`
                  : ""}
              </span>
            )}
          </div>
        ) : null}
        {nlAssistStrip.kind !== "idle" ? (
          <div
            role="status"
            className={`mt-2 rounded-lg border px-3 py-2 text-xs leading-relaxed ${
              nlAssistStrip.kind === "applying"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                : nlAssistStrip.kind === "applied"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                  : nlAssistStrip.kind === "clarify"
                    ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-100"
                    : "border-red-500/30 bg-red-500/10 text-red-100"
            }`}
          >
            {nlAssistStrip.kind === "applying" ? "Applying edit…" : null}
            {nlAssistStrip.kind === "applied" ? `Applied edit — ${nlAssistStrip.message}` : null}
            {nlAssistStrip.kind === "clarify" ? `Needs clarification — ${nlAssistStrip.message}` : null}
            {nlAssistStrip.kind === "error" ? `Could not apply — ${nlAssistStrip.message}` : null}
          </div>
        ) : null}
        <p className="mt-1 text-[10px] text-slate-600">
          {showDescribe || showReview
            ? "Press Enter to build. Shift+Enter for a new line."
            : showRefine
              ? "Press Enter to send. Shift+Enter for a new line. ⌘/Ctrl+Enter also sends."
              : "⌘/Ctrl+Enter to send in this step."}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submitOmnibarCommand()}
          aria-label={omnibarPrimaryActionLabel()}
          className="mt-3 w-full rounded-full border border-indigo-400/35 bg-indigo-500/15 px-4 py-2.5 text-sm font-semibold text-indigo-50 transition-colors hover:border-indigo-300/50 hover:bg-indigo-500/25 disabled:pointer-events-none disabled:opacity-40 sm:w-auto"
        >
          {omnibarPrimaryActionLabel()}
        </button>
      </div>

      <details className="mt-5 rounded-xl border border-white/[0.05] bg-slate-950/40 p-4">
        <summary className="cursor-pointer select-none text-sm font-medium text-slate-300 hover:text-slate-200 outline-none">
          ⚙️ Manual Tools & AI Options
        </summary>
        <div className="mt-4 border-t border-white/[0.05] pt-4">
          {(showDescribe || showReview) && (
            <p className="mb-3 text-xs leading-relaxed text-slate-500">
              Enter in Describe/Review runs the full build path. Plan-only tools are available below in Manual Tools.
            </p>
          )}
          {workflowStage === "describe" && (
            <>
              <p className="mb-3 text-xs leading-relaxed text-slate-500">
                For <span className="text-slate-300">full site generation</span>, either write a detailed goal in the command
                bar (about a sentence) <span className="text-slate-400">or</span> fill business, offer, and audience below.
                Optional industry and market sharpen the brief.
              </p>
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={label}>Business or brand</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    disabled={busy}
                    className={`mt-1.5 w-full px-3 py-2 text-sm ${field}`}
                    placeholder="Acme Co / Studio North…"
                  />
                </div>
                <div>
                  <label className={label}>Primary offer</label>
                  <input
                    type="text"
                    value={primaryOffer}
                    onChange={(e) => setPrimaryOffer(e.target.value)}
                    disabled={busy}
                    className={`mt-1.5 w-full px-3 py-2 text-sm ${field}`}
                    placeholder="What you sell or provide…"
                  />
                </div>
                <div>
                  <label className={label}>Target audience</label>
                  <input
                    type="text"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    disabled={busy}
                    className={`mt-1.5 w-full px-3 py-2 text-sm ${field}`}
                    placeholder="Who you serve…"
                  />
                </div>
              </div>
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={label}>Industry (e.g., Local Plumber)</label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    disabled={busy}
                    className={`mt-1.5 w-full px-3 py-2 text-sm ${field}`}
                    placeholder="Industry to research..."
                  />
                </div>
                <div>
                  <label className={label}>Target Market</label>
                  <input
                    type="text"
                    value={market}
                    onChange={(e) => setMarket(e.target.value)}
                    disabled={busy}
                    className={`mt-1.5 w-full px-3 py-2 text-sm ${field}`}
                    placeholder="Market or geography..."
                  />
                </div>
              </div>
              <div className="mb-4 rounded-xl border border-white/[0.06] bg-slate-950/50 p-4">
                <p className="text-xs font-medium text-slate-300">Inspiration (optional)</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Do you have a website or competitor URL to learn from? We extract layout, tone, and CTA <span className="text-slate-400">patterns</span> only—never
                  a verbatim copy. For industry defaults without a URL, use industry-only.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className={label}>Inspiration or competitor URL (https)</label>
                    <input
                      type="url"
                      value={inspirationUrl}
                      onChange={(e) => setInspirationUrl(e.target.value)}
                      disabled={busy || inspirationAnalyzeBusy}
                      className={`mt-1.5 w-full px-3 py-2 text-sm ${field}`}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={label}>More URLs (optional, comma or newline)</label>
                    <textarea
                      value={inspirationCompetitorUrls}
                      onChange={(e) => setInspirationCompetitorUrls(e.target.value)}
                      disabled={busy || inspirationAnalyzeBusy}
                      rows={2}
                      className={`mt-1.5 w-full px-3 py-2 text-sm ${field}`}
                      placeholder="https://a.com, https://b.com"
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={inspirationIndustryOnly}
                      onChange={(e) => setInspirationIndustryOnly(e.target.checked)}
                      disabled={busy || inspirationAnalyzeBusy}
                    />
                    Industry-only (use my Industry field above, no URL fetch)
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || inspirationAnalyzeBusy}
                    onClick={() => void runInspirationAnalysis()}
                    className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/20 disabled:opacity-40"
                  >
                    {inspirationAnalyzeBusy ? "Analyzing…" : "Analyze inspiration"}
                  </button>
                  {inspirationBrief ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setInspirationBrief(null);
                        setInspirationAnalyzeError(null);
                      }}
                      className="text-xs text-slate-500 underline decoration-slate-600 hover:text-slate-300"
                    >
                      Clear brief
                    </button>
                  ) : null}
                </div>
                {inspirationAnalyzeError ? (
                  <p className="mt-2 text-xs text-amber-200/95">{inspirationAnalyzeError}</p>
                ) : null}
                {inspirationBrief ? (
                  <div
                    className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-3 py-2 text-[11px] text-cyan-100/90"
                    role="status"
                  >
                    <p className="font-semibold text-cyan-50/95">Inspiration analyzed</p>
                    <p className="mt-1 text-slate-300/90">
                      <span className="text-slate-500">Tone:</span> {inspirationBrief.tone}
                    </p>
                    <p className="mt-1 text-slate-300/90">
                      <span className="text-slate-500">Color direction:</span> {inspirationBrief.colorDirection}
                    </p>
                    <p className="mt-1 text-slate-300/90">
                      <span className="text-slate-500">CTA style:</span> {inspirationBrief.ctaPatterns[0] ?? "—"}
                    </p>
                    <p className="mt-1 text-slate-300/90">
                      <span className="text-slate-500">Layout / sections:</span> {inspirationBrief.layoutPatterns.slice(0, 2).join(" · ") || "—"}
                    </p>
                    <p className="mt-2 text-[10px] text-slate-500">Patterns only — not a clone. {inspirationBrief.doNotCopyNotice ? "We never store full page text." : null}</p>
                  </div>
                ) : null}
              </div>
              <div className="mb-4">
                <label className={label}>Including an AI Chatbot? (Provide Widget Key)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={importWidgetKey}
                    onChange={(e) => setImportWidgetKey(e.target.value)}
                    disabled={busy}
                    className={`mt-1.5 flex-1 px-3 py-2 text-sm ${field}`}
                    placeholder="Paste widget key to wire automatically..."
                  />
                  <select
                    value={importWidgetPlacement}
                    onChange={(e) => setImportWidgetPlacement(e.target.value as typeof importWidgetPlacement)}
                    disabled={busy}
                    className={`mt-1.5 px-3 py-2 text-sm ${field}`}
                  >
                    <option value="body_end">Site-wide (end of body)</option>
                    <option value="head_script">Head (script)</option>
                    <option value="page_body_end">Per-page (home first)</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {(showDescribe || showReview || showRefine) && (
            <>
              <p className="mb-3 text-xs font-medium text-slate-500">Layout &amp; multi-variant generation</p>
              <div className="mb-4 grid gap-3 sm:grid-cols-2 @min-[36rem]:grid-cols-4">
                <div>
                  <label className={label} title="Deterministic section order diversity">
                    Layout profile (0–7)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={7}
                    value={layoutVariantIndex}
                    onChange={(e) => setLayoutVariantIndex(Math.max(0, Math.min(7, Number(e.target.value) || 0)))}
                    disabled={busy}
                    className={`mt-1.5 w-full px-3 py-2 text-sm ${field}`}
                  />
                </div>
                <div>
                  <label className={label} title="Multiple schema passes with different block seeds">
                    Build variants
                  </label>
                  <select
                    value={String(variantCount)}
                    onChange={(e) => setVariantCount(Math.min(3, Math.max(1, Number(e.target.value) || 1)))}
                    disabled={busy}
                    className={`mt-1.5 w-full px-3 py-2 text-sm ${field}`}
                  >
                    <option value="1">1 (single)</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                  {selectedVariantIndex !== null && !variantPickSession ? (
                    <p className="mt-1.5 text-[10px] text-slate-600">
                      Last chosen layout: <span className="font-medium text-slate-400">{String.fromCharCode(65 + selectedVariantIndex)}</span>
                    </p>
                  ) : null}
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1.5 @min-[36rem]:col-span-2 @min-[36rem]:flex-row @min-[36rem]:items-end @min-[36rem]:gap-2">
                  <div className="min-w-0 flex-1">
                    <label className={label}>Layout seed (optional)</label>
                    <input
                      type="text"
                      readOnly
                      value={exploreVariantSeed ?? "— not set; server picks a new seed per build —"}
                      className={`mt-1.5 w-full cursor-default px-3 py-2 text-sm ${field} opacity-90`}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setExploreVariantSeed(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `seed-${Date.now()}`)}
                    className="h-10 shrink-0 rounded-full border border-white/[0.1] px-3 text-xs font-semibold text-slate-200 hover:border-indigo-400/35 hover:bg-indigo-500/10 disabled:opacity-40"
                  >
                    New seed
                  </button>
                </div>
              </div>
              {schemaAlternates.length > 0 && !variantPickSession ? (
                <div className="mb-4 rounded-lg border border-white/[0.06] bg-slate-950/40 p-3">
                  <p className={label}>Alternate layouts</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Quick swap from the last generation (same as the layout dialog). Use when you already applied one layout and want another.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {schemaAlternates.map((a, j) => (
                      <button
                        key={a.seed}
                        type="button"
                        disabled={busy}
                        onClick={() => applyPipelineGeneratedSchema(a.schema)}
                        className="rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 hover:border-indigo-300/45 disabled:opacity-40"
                      >
                        Use variant {j + 2}{" "}
                        <span className="font-mono text-[10px] text-slate-500">({a.seed.slice(0, 8)}…)</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}

      {showDescribe ? (
        <>
          <div className="mt-5 grid min-w-0 grid-cols-1 gap-5 @min-[36rem]:grid-cols-2">
            <div className="grid min-w-0 gap-2">
              <p className="text-xs leading-relaxed text-slate-500">
                Landing pages, offers, services, product stories, local presence, and web3-forward sites—your command bar above carries the brief.
              </p>
              <div className="mt-2">
                <p className="text-[11px] font-medium text-slate-500">Example starting points</p>
                <ul className="mt-1.5 flex list-none flex-wrap gap-2 p-0">
                  {INSPIRATION_EXAMPLES.map((ex) => (
                    <li key={ex.id}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => applyInspirationExample(ex, true)}
                        aria-label={`${ex.label}. ${ex.fitCue}`}
                        className="flex max-w-[11.5rem] flex-col gap-0.5 rounded-xl border border-white/[0.07] bg-slate-950/50 px-2.5 py-1.5 text-left transition-colors hover:border-indigo-400/25 hover:bg-indigo-500/[0.07] hover:[&>span:first-child]:text-slate-100 hover:[&>span:last-child]:text-slate-500 disabled:pointer-events-none disabled:opacity-40"
                      >
                        <span className="text-[11px] font-medium leading-tight text-slate-300">{ex.label}</span>
                        <span className="text-[10px] font-normal leading-snug text-slate-600">{ex.fitCue}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[11px] leading-snug text-slate-600">Tap to fill the brief and align site type and style hints—you can edit anything.</p>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Nothing goes live without your say-so. You can refine everything after the first draft.
              </p>
            </div>
            <div className={`grid min-w-0 gap-4 rounded-xl border border-white/[0.05] bg-slate-950/30 p-4`}>
              <div className="grid gap-1.5">
                <label className={label}>Site type</label>
                <select
                  value={siteType}
                  onChange={(e) => setSiteType(e.target.value as typeof siteType)}
                  className={`px-3 py-2.5 text-sm ${field}`}
                >
                  <option value="auto">Auto-detect</option>
                  <option value="landing">Landing</option>
                  <option value="portfolio">Portfolio</option>
                  <option value="saas">SaaS</option>
                  <option value="web3_product">Web3 product</option>
                  <option value="community">Community</option>
                  <option value="ecommerce_light">E‑commerce (light)</option>
                  <option value="local_business">Local business</option>
                  <option value="trust_operator">Trust / operator</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <label className={label}>Design direction</label>
                <select
                  value={designDirection}
                  onChange={(e) => setDesignDirection(e.target.value as typeof designDirection)}
                  className={`px-3 py-2.5 text-sm ${field}`}
                >
                  <option value="minimal">Minimal</option>
                  <option value="bold">Bold</option>
                  <option value="luxe">Luxe</option>
                  <option value="cyber">Cyber</option>
                  <option value="operator">Operator</option>
                </select>
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-xs font-medium text-slate-400">
                  <span>Style intensity</span>
                  <span className="tabular-nums text-slate-300">{styleIntensity}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={styleIntensity}
                  onChange={(e) => setStyleIntensity(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/[0.05] bg-slate-950/40 px-3 py-2.5 text-sm leading-snug text-slate-300">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500/40"
                  checked={web3VisualMode}
                  onChange={(e) => setWeb3VisualMode(e.target.checked)}
                />
                <span>
                  <span className="font-medium text-slate-200">Web3 visual style</span>
                  <span className="mt-0.5 block text-xs font-normal text-slate-500">Richer gradients and a sharper futuristic look when it fits your brand.</span>
                </span>
              </label>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-white/[0.06] bg-slate-950/25 px-4 py-3">
            <p className={label}>Import public site structure (redesign blueprint)</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Paste a <span className="text-slate-400">public</span> page URL—we fetch HTML on the server, extract readable structure (headings,
              copy, links, images where possible), and map it into this builder&apos;s schema. This is a{" "}
              <span className="text-slate-400">best-effort replica for redesign</span>, not cloning: script-driven layouts, private pages, bot
              blocks, and some assets may be missing or approximated. Optional: attach an AI Agency widget key so exports include the embed.
            </p>
            <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
              <label className="grid min-w-0 flex-1 gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Site URL</span>
                <input
                  type="url"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://client-example.com"
                  disabled={busy}
                  className={`px-3 py-2 text-sm ${field}`}
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runSiteImport()}
                className="shrink-0 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-400/55 hover:bg-cyan-500/15 disabled:pointer-events-none disabled:opacity-40"
              >
                Import blueprint
              </button>
            </div>
            {blueprintImportPhase !== "idle" ? (
              <p
                className={`mt-2 text-[11px] leading-relaxed ${
                  blueprintImportPhase === "failed"
                    ? "text-red-300/90"
                    : blueprintImportPhase === "partial-import"
                      ? "text-amber-200/85"
                      : "text-slate-400"
                }`}
                aria-live="polite"
              >
                {blueprintImportPhase === "fetching"
                  ? "Importing site…"
                  : blueprintImportPhase === "parsing"
                    ? "Reconstructing layout…"
                    : blueprintImportPhase === "mapping"
                      ? "Building preview…"
                      : blueprintImportPhase === "preview-ready"
                        ? blueprintImportDetail || "Ready for redesign."
                        : blueprintImportPhase === "partial-import"
                          ? blueprintImportDetail ||
                            "Partial import (SPA / limited HTML) — ready for redesign."
                          : blueprintImportDetail || "Import could not complete."}
              </p>
            ) : null}
            <details className="mt-3 text-xs text-slate-500">
              <summary className="cursor-pointer select-none text-slate-400 hover:text-slate-300">Optional AI widget (Agency key)</summary>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-[10px] uppercase text-slate-500">Widget key</span>
                  <input
                    type="text"
                    value={importWidgetKey}
                    onChange={(e) => setImportWidgetKey(e.target.value)}
                    placeholder="From AI Agency → Embed"
                    disabled={busy}
                    className={`px-3 py-2 text-sm ${field}`}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-[10px] uppercase text-slate-500">Placement</span>
                  <select
                    value={importWidgetPlacement}
                    onChange={(e) => setImportWidgetPlacement(e.target.value as typeof importWidgetPlacement)}
                    disabled={busy}
                    className={`px-3 py-2 text-sm ${field}`}
                  >
                    <option value="body_end">Site-wide (end of body)</option>
                    <option value="head_script">Head (script)</option>
                    <option value="page_body_end">Per-page (home first)</option>
                  </select>
                </label>
              </div>
            </details>
            <details className="mt-3 text-xs text-slate-500">
              <summary className="cursor-pointer select-none text-slate-400 hover:text-slate-300">
                Run builder actions (validated JSON)
              </summary>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                Executes the site-builder tool layer (same as <span className="text-slate-400">POST /api/site-builder/builder-actions</span>).
                With a site selected in the builder shell, per-site AI provider settings and action logs apply.
              </p>
              <textarea
                value={builderActionsDraft}
                onChange={(e) => setBuilderActionsDraft(e.target.value)}
                rows={6}
                disabled={busy}
                className={`mt-2 w-full px-3 py-2 font-mono text-[11px] leading-relaxed ${field}`}
                spellCheck={false}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runBuilderActionsFromJson()}
                  className="rounded-full border border-white/[0.12] bg-slate-900/60 px-3 py-1.5 text-[11px] font-semibold text-slate-200 hover:border-indigo-400/35 hover:bg-indigo-500/10 disabled:pointer-events-none disabled:opacity-40"
                >
                  Apply actions
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void parseAndApplyBuilderActionsFromCommand()}
                  className="rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-semibold text-indigo-100 hover:border-indigo-300/40 disabled:pointer-events-none disabled:opacity-40"
                  title='If the assistant returned JSON with an "actions" array, parse it from the command bar'
                >
                  Parse actions from command bar
                </button>
              </div>
            </details>
          </div>

          {!builderSurface ? (
            <div className="mt-4 border-t border-white/[0.06] pt-4" aria-label="Output range from one builder">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-500">Same system, different feel</p>
              <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-slate-500">
                Curated mini-frames echo real hero and section patterns. Your live preview matches what you generate—same Signature pipeline, one
                builder.
              </p>
              <DescribeOutputProofStrip disabled={busy} onPickFeel={applyOutputProofFeel} />
              <p className="mt-2 text-[11px] leading-snug text-slate-600">
                Tap a snapshot or chip—one builder, same preview pipeline.
              </p>
            </div>
          ) : (
            <details className="mt-4 border-t border-white/[0.06] pt-4">
              <summary className="cursor-pointer text-xs font-medium text-slate-500">Mini-frame snapshots (advanced)</summary>
              <div className="mt-2">
                <DescribeOutputProofStrip disabled={busy} onPickFeel={applyOutputProofFeel} />
              </div>
            </details>
          )}

          <details className="mt-5 border-t border-white/[0.06] pt-4" open={false}>
            <summary className="cursor-pointer select-none text-sm font-medium text-slate-400 transition-colors hover:text-slate-200">
              Plan &amp; outline (optional manual pipeline)
            </summary>
            <div className="mt-3 space-y-3 pl-0.5">
              <p className="text-[11px] leading-relaxed text-slate-500">
                Use these when you want a plan in the left rail before a full build. The default is still: type a prompt
                in the field above and press <span className="text-slate-400">Enter</span> to build automatically.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runPlan()}
                  aria-label="Generate a plan only, without building the site yet"
                  className="inline-flex items-center gap-2 rounded-full border border-indigo-400/35 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-100 transition-colors hover:border-indigo-300/50 hover:bg-indigo-500/15 disabled:pointer-events-none disabled:opacity-40"
                >
                  <ClipboardList className="h-4 w-4" aria-hidden />
                  Plan only
                </button>
                {!suppressPrimaryGenerate ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void (async () => {
                        await runPlan();
                        onPlanReadyGoReview?.();
                      })()
                    }
                    aria-label="Plan only, then go to the outline step in the workflow to tune before generating"
                    className="inline-flex items-center gap-2 rounded-full border border-violet-500/35 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-300/50 hover:bg-violet-500/20 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <Wand2 className="h-4 w-4" aria-hidden />
                    Plan → outline step
                  </button>
                ) : (
                  <p className="self-center text-sm text-slate-500">Use the bottom bar to build, or run Plan only here.</p>
                )}
              </div>
            </div>
          </details>
        </>
      ) : null}

      {showReview && planner ? (
        <div className="mt-5 rounded-xl border border-white/[0.06] bg-slate-950/35 p-4">
          <div className={label}>Your page outline</div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">Built from your description—you can still change any part in Refine.</p>
          <ul className="mt-3 space-y-0 text-sm text-slate-300">
            {sectionPlanList.map((row, i) => (
              <li key={row.id || i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-white/[0.05] py-2.5 last:border-0">
                <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-100">
                  {row.headline || row.purpose || row.id || "Section"}
                </span>
                {row.registryKey ? (
                  <span className="shrink-0 font-mono text-[11px] text-slate-500/50">ID: {row.registryKey}</span>
                ) : null}
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-xl border border-white/[0.06] bg-slate-950/35 p-4">
            <div className={label}>Quick choices</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Optional answers—defaults work. They apply when you generate the site from the bar below.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <label className={label}>Hero background</label>
                <div className="flex flex-wrap gap-2">
                  {(["color", "image", "video"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setRefinementAnswers((s) => ({
                          ...s,
                          heroBackgroundType: t,
                          ...(t === "color"
                            ? { heroBackgroundAssetId: undefined, heroBackgroundSource: "url" as const }
                            : {}),
                        }))
                      }
                      className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                        refinementAnswers.heroBackgroundType === t
                          ? "border border-indigo-400/50 bg-indigo-500/20 text-indigo-100"
                          : "border border-white/[0.08] bg-slate-950/50 text-slate-400 hover:border-white/[0.14]"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {refinementAnswers.heroBackgroundType === "image" || refinementAnswers.heroBackgroundType === "video" ? (
                <div className="grid gap-1.5 sm:col-span-2">
                  <label className={label}>Background source</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setRefinementAnswers((s) => ({
                          ...s,
                          heroBackgroundSource: "url",
                          heroBackgroundAssetId: undefined,
                          heroBackgroundValue: s.heroBackgroundSource === "upload" ? "" : s.heroBackgroundValue,
                        }))
                      }
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        refinementAnswers.heroBackgroundSource !== "upload"
                          ? "border border-indigo-400/50 bg-indigo-500/20 text-indigo-100"
                          : "border border-white/[0.08] bg-slate-950/50 text-slate-400 hover:border-white/[0.14]"
                      }`}
                    >
                      From URL
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setRefinementAnswers((s) => ({ ...s, heroBackgroundSource: "upload" }))}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        refinementAnswers.heroBackgroundSource === "upload"
                          ? "border border-indigo-400/50 bg-indigo-500/20 text-indigo-100"
                          : "border border-white/[0.08] bg-slate-950/50 text-slate-400 hover:border-white/[0.14]"
                      }`}
                    >
                      Upload file
                    </button>
                    <input
                      ref={heroMediaFileInputRef}
                      type="file"
                      accept={refinementAnswers.heroBackgroundType === "video" ? "video/mp4" : "image/*"}
                      className="hidden"
                      disabled={busy}
                      onChange={(e) => void uploadHeroBackgroundFile(e.target.files?.[0] ?? null)}
                    />
                    {refinementAnswers.heroBackgroundSource === "upload" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => heroMediaFileInputRef.current?.click()}
                        className="rounded-full border border-white/[0.1] bg-slate-950/60 px-3 py-1 text-xs font-medium text-slate-200 hover:border-white/[0.18]"
                      >
                        Choose file…
                      </button>
                    ) : null}
                    {refinementAnswers.heroBackgroundAssetId ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removeHeroUploadedAsset()}
                        className="rounded-full border border-rose-500/25 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-100/90 hover:border-rose-400/40"
                      >
                        Remove upload
                      </button>
                    ) : null}
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600">
                    Uploads stay private to your account. Export with <span className="text-slate-500">Bundle locally</span> to copy
                    files into the ZIP.
                  </p>
                </div>
              ) : null}
              <div className="grid gap-1.5 sm:col-span-2">
                <label className={label}>
                  {refinementAnswers.heroBackgroundType === "color"
                    ? "Color value"
                    : refinementAnswers.heroBackgroundType === "image" || refinementAnswers.heroBackgroundType === "video"
                      ? refinementAnswers.heroBackgroundSource === "upload"
                        ? "URL (optional — set automatically after upload)"
                        : "Image or video URL"
                      : "Color / image / video URL"}
                </label>
                <input
                  type="text"
                  disabled={
                    busy ||
                    ((refinementAnswers.heroBackgroundType === "image" || refinementAnswers.heroBackgroundType === "video") &&
                      refinementAnswers.heroBackgroundSource === "upload")
                  }
                  value={refinementAnswers.heroBackgroundValue ?? ""}
                  onChange={(e) =>
                    setRefinementAnswers((s) => ({
                      ...s,
                      heroBackgroundValue: e.target.value,
                      heroBackgroundAssetId: undefined,
                      heroBackgroundSource: "url",
                    }))
                  }
                  placeholder="#0f172a or https://…"
                  className={`px-3 py-2 text-sm ${field}`}
                />
              </div>
              <div className="grid gap-1.5">
                <label className={label}>Background behavior</label>
                <select
                  disabled={busy}
                  value={refinementAnswers.heroBackgroundBehavior ?? "scroll"}
                  onChange={(e) =>
                    setRefinementAnswers((s) => ({
                      ...s,
                      heroBackgroundBehavior: e.target.value as SiteBuilderRefinementAnswers["heroBackgroundBehavior"],
                    }))
                  }
                  className={`px-3 py-2 text-sm ${field}`}
                >
                  <option value="scroll">Scroll with page</option>
                  <option value="fixed">Fixed (full-viewport feel)</option>
                  <option value="parallax">Parallax-style (fixed attachment)</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <label className={label}>Fallback (images)</label>
                <input
                  type="text"
                  disabled={busy}
                  value={refinementAnswers.heroBackgroundFallbackColor ?? ""}
                  onChange={(e) => setRefinementAnswers((s) => ({ ...s, heroBackgroundFallbackColor: e.target.value }))}
                  placeholder="#0f172a"
                  className={`px-3 py-2 text-sm ${field}`}
                />
              </div>
              <div className="grid gap-1.5">
                <label className={label}>Media preference</label>
                <select
                  disabled={busy}
                  value={refinementAnswers.mediaPreference ?? "generated"}
                  onChange={(e) =>
                    setRefinementAnswers((s) => ({
                      ...s,
                      mediaPreference: e.target.value as SiteBuilderRefinementAnswers["mediaPreference"],
                    }))
                  }
                  className={`px-3 py-2 text-sm ${field}`}
                >
                  <option value="generated">Use generated layout visuals</option>
                  <option value="upload_or_url">I’ll use my own URLs / uploads</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <label className={label}>Color scheme</label>
                <select
                  disabled={busy}
                  value={refinementAnswers.colorScheme ?? "dark_default"}
                  onChange={(e) =>
                    setRefinementAnswers((s) => ({
                      ...s,
                      colorScheme: e.target.value as SiteBuilderRefinementAnswers["colorScheme"],
                    }))
                  }
                  className={`px-3 py-2 text-sm ${field}`}
                >
                  <option value="dark_default">Dark (default)</option>
                  <option value="dark">Dark (cool slate)</option>
                  <option value="light">Light</option>
                  <option value="custom">Custom (keep planner tokens)</option>
                </select>
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <label className={label}>Motion</label>
                <select
                  disabled={busy}
                  value={refinementAnswers.motionFeel ?? "animated"}
                  onChange={(e) =>
                    setRefinementAnswers((s) => ({
                      ...s,
                      motionFeel: e.target.value as SiteBuilderRefinementAnswers["motionFeel"],
                    }))
                  }
                  className={`px-3 py-2 text-sm ${field}`}
                >
                  <option value="animated">Animated hero background (when available)</option>
                  <option value="reduced">More static (less motion)</option>
                </select>
              </div>

              <div className="grid gap-2 sm:col-span-2">
                <label className={label}>Where should I prepare this project to be deployed?</label>
                <p className="text-xs leading-relaxed text-slate-500">
                  I’ll use this to prepare the right folder structure and export format.
                </p>
                <div className="flex flex-wrap gap-2">
                  {DEPLOYMENT_TARGET_OPTIONS.map(({ value, label: lbl }) => (
                    <button
                      key={value}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        trackDeploymentChoice({ deploymentTarget: value });
                        setRefinementAnswers((s) => ({ ...s, deploymentTarget: value }));
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        refinementAnswers.deploymentTarget === value
                          ? "border border-indigo-400/50 bg-indigo-500/20 text-indigo-100"
                          : "border border-white/[0.08] bg-slate-950/50 text-slate-400 hover:border-white/[0.14]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-1.5">
                <label className={label}>Site shape</label>
                <div className="flex flex-wrap gap-2">
                  {(["single_page", "multi_page"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        trackDeploymentChoice({ routingMode: mode });
                        setRefinementAnswers((s) => ({ ...s, routingMode: mode }));
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        (refinementAnswers.routingMode ?? "single_page") === mode
                          ? "border border-indigo-400/50 bg-indigo-500/20 text-indigo-100"
                          : "border border-white/[0.08] bg-slate-950/50 text-slate-400 hover:border-white/[0.14]"
                      }`}
                    >
                      {mode === "single_page" ? "Single page" : "Multi-page"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-1.5">
                <label className={label}>Assets in export</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    { value: "local_bundle" as const, label: "Bundle locally" },
                    { value: "remote_urls" as const, label: "Keep remote URLs" },
                  ] as const).map(({ value, label: lbl }) => (
                    <button
                      key={value}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        trackDeploymentChoice({ assetStrategy: value });
                        setRefinementAnswers((s) => ({ ...s, assetStrategy: value }));
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        (refinementAnswers.assetStrategy ?? "local_bundle") === value
                          ? "border border-indigo-400/50 bg-indigo-500/20 text-indigo-100"
                          : "border border-white/[0.08] bg-slate-950/50 text-slate-400 hover:border-white/[0.14]"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <details className="mt-3 rounded-lg border border-white/[0.05] bg-slate-950/50 p-2">
            <summary className="cursor-pointer text-xs font-medium text-slate-500">Full plan details</summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-slate-950/80 p-2 text-[11px] leading-relaxed text-slate-400">
              {JSON.stringify(planner, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}

      {showReview && !planner ? (
        <p className="mt-5 rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2.5 text-sm leading-relaxed text-amber-100/90">
          No plan yet — use Manual Tools if you want to inspect planner output before building.
        </p>
      ) : null}

      {showRefine ? (
        <div className="mt-5 space-y-5 border-t border-white/[0.06] pt-5">
          {agencyLaunchStrip}
          {importRestructureStrip}
          {deliverablesPackStrip}
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/30 p-4">
            <div className="text-sm font-semibold text-slate-100">Download project</div>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              ZIP layout follows your outline deployment choice (default: static{" "}
              <span className="font-mono text-xs text-slate-400">index.html</span>,{" "}
              <span className="font-mono text-xs text-slate-400">styles.css</span>,{" "}
              <span className="font-mono text-xs text-slate-400">scripts.js</span>, <span className="font-mono text-xs text-slate-400">assets/</span>
              ).
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void downloadProjectZip()}
              aria-label="Download site as ZIP"
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-400/50 hover:bg-cyan-500/15 disabled:pointer-events-none disabled:opacity-40"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download ZIP
            </button>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/25 p-4">
            <div className="text-sm font-semibold text-slate-100">PayPal Business</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Attach a hosted payment link or buy-button snippet to the export preview and ZIP. Checkout SDK mode reserves a safe placeholder for a future client-side integration.
            </p>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                className="rounded border-slate-600 bg-slate-950"
                disabled={busy}
                checked={payPalForm.enabled}
                onChange={(e) => setPayPalForm((s) => ({ ...s, enabled: e.target.checked }))}
              />
              Enable PayPal surface on this site
            </label>
            {payPalForm.enabled ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <span className={label}>Mode</span>
                  <select
                    disabled={busy}
                    value={payPalForm.mode}
                    onChange={(e) =>
                      setPayPalForm((s) => ({ ...s, mode: e.target.value as PaymentIntegration["mode"] }))
                    }
                    className={`px-3 py-2 text-sm ${field}`}
                  >
                    <option value="payment_link">Payment link</option>
                    <option value="buy_button">Buy button / embed HTML</option>
                    <option value="checkout_sdk">Checkout (SDK) — placeholder</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <span className={label}>Intent</span>
                  <select
                    disabled={busy}
                    value={payPalForm.intent}
                    onChange={(e) =>
                      setPayPalForm((s) => ({ ...s, intent: e.target.value as PaymentIntegration["intent"] }))
                    }
                    className={`px-3 py-2 text-sm ${field}`}
                  >
                    <option value="full_payment">Full payment</option>
                    <option value="deposit">Deposit</option>
                    <option value="consultation">Consultation</option>
                    <option value="invoice">Invoice</option>
                  </select>
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <span className={label}>Placement</span>
                  <select
                    disabled={busy}
                    value={payPalForm.placement}
                    onChange={(e) =>
                      setPayPalForm((s) => ({ ...s, placement: e.target.value as PaymentIntegration["placement"] }))
                    }
                    className={`px-3 py-2 text-sm ${field}`}
                  >
                    <option value="cta_section">End of main column (with CTA flow)</option>
                    <option value="page_body_end">Specific page only</option>
                    <option value="global_footer">After main (footer band)</option>
                  </select>
                </div>
                {payPalForm.placement === "page_body_end" ? (
                  <div className="grid gap-1.5 sm:col-span-2">
                    <span className={label}>Page path</span>
                    <input
                      type="text"
                      disabled={busy}
                      value={payPalForm.pageSlug}
                      onChange={(e) => setPayPalForm((s) => ({ ...s, pageSlug: e.target.value }))}
                      placeholder="/ or /offer"
                      className={`px-3 py-2 text-sm ${field}`}
                    />
                  </div>
                ) : null}
                {payPalForm.mode === "payment_link" ? (
                  <div className="grid gap-1.5 sm:col-span-2">
                    <span className={label}>Payment link (HTTPS)</span>
                    <input
                      type="url"
                      disabled={busy}
                      value={payPalForm.paymentLink}
                      onChange={(e) => setPayPalForm((s) => ({ ...s, paymentLink: e.target.value }))}
                      placeholder="https://www.paypal.com/… or https://paypal.me/…"
                      className={`px-3 py-2 text-sm ${field}`}
                    />
                  </div>
                ) : null}
                {payPalForm.mode === "buy_button" ? (
                  <div className="grid gap-1.5 sm:col-span-2">
                    <span className={label}>Button / embed HTML</span>
                    <textarea
                      disabled={busy}
                      value={payPalForm.buttonHtml}
                      onChange={(e) => setPayPalForm((s) => ({ ...s, buttonHtml: e.target.value }))}
                      rows={4}
                      placeholder="Paste PayPal button code from your Business account"
                      className={`min-h-[96px] resize-y px-3 py-2 font-mono text-xs ${field}`}
                    />
                  </div>
                ) : null}
                {payPalForm.mode === "checkout_sdk" ? (
                  <>
                    <div className="grid gap-1.5">
                      <span className={label}>Environment</span>
                      <select
                        disabled={busy}
                        value={payPalForm.environment}
                        onChange={(e) =>
                          setPayPalForm((s) => ({
                            ...s,
                            environment: e.target.value === "live" ? "live" : "sandbox",
                          }))
                        }
                        className={`px-3 py-2 text-sm ${field}`}
                      >
                        <option value="sandbox">Sandbox</option>
                        <option value="live">Live</option>
                      </select>
                    </div>
                    <div className="grid gap-1.5">
                      <span className={label}>Currency</span>
                      <input
                        type="text"
                        disabled={busy}
                        value={payPalForm.currency}
                        onChange={(e) => setPayPalForm((s) => ({ ...s, currency: e.target.value }))}
                        placeholder="USD"
                        className={`px-3 py-2 text-sm ${field}`}
                      />
                    </div>
                    <div className="grid gap-1.5 sm:col-span-2">
                      <span className={label}>Client ID (optional)</span>
                      <input
                        type="text"
                        disabled={busy}
                        value={payPalForm.clientId}
                        onChange={(e) => setPayPalForm((s) => ({ ...s, clientId: e.target.value }))}
                        placeholder="For future SDK wiring — not executed in export yet"
                        className={`px-3 py-2 text-sm ${field}`}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => savePayPalIntegration()}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-slate-950/60 px-4 py-2 text-xs font-semibold text-slate-100 transition-colors hover:border-indigo-400/35 hover:bg-indigo-500/10 disabled:pointer-events-none disabled:opacity-40"
            >
              Save payment settings
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runEvaluateOnly()}
              aria-label="Get optional suggestions for your current page"
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:border-indigo-400/35 hover:bg-indigo-500/10 disabled:pointer-events-none disabled:opacity-40"
            >
              <ShieldCheck className="h-4 w-4 text-indigo-300/90" aria-hidden />
              Get suggestions
            </button>
          </div>
          {!evaluation ? (
            <p className="mt-2 text-sm text-slate-500">Optional: get suggestions when you want them—your page is already usable.</p>
          ) : null}
          {brandBrainProactiveSlice.items.length > 0 ? (
            <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-950/10 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-violet-200/85">Creative steer</div>
              <ul className="mt-2 space-y-2">
                {brandBrainProactiveSlice.items.map((item) => (
                  <li
                    key={item.code}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-white/[0.06] bg-slate-950/35 px-2.5 py-2"
                  >
                    <p className="min-w-0 flex-1 text-sm leading-snug text-slate-200/95">{item.label}</p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {item.fixability === "safe_auto" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => applyBrandBrainItem(item)}
                          className="rounded-full border border-violet-400/35 bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-100/95 transition-colors hover:border-violet-300/45 hover:bg-violet-500/20 disabled:pointer-events-none disabled:opacity-40"
                        >
                          Apply
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => dismissBrandBrainItem(item)}
                        className="rounded-full px-2 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300 disabled:opacity-40"
                      >
                        Dismiss
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="rounded-xl border border-white/[0.05] bg-slate-950/30 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <RefreshCw className="h-4 w-4 text-teal-400/90" aria-hidden />
              Target sections
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              {effectiveSectionIds.length > 1
                ? "Up to three sections — apply from the command bar above."
                : effectiveSectionIds.length === 1
                  ? "One section selected — apply from the command bar above, or pick another block in the preview."
                  : "Nothing selected — the command bar applies a light page-wide pass when the layout already exists, or a full rebuild when the page is empty."}
            </p>
            {effectiveSectionIds.length > 1 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {effectiveSectionIds.map((id) => (
                  <span
                    key={id}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-teal-500/20 bg-teal-500/[0.07] pl-2.5 pr-1 py-0.5 text-[11px] font-medium text-teal-100/95"
                  >
                    <span className="max-w-[11rem] truncate font-mono text-[10px]">{id}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removeRefineTarget(id)}
                      aria-label={`Remove ${id} from selection`}
                      className="rounded-full px-1.5 py-0.5 text-xs text-teal-200/80 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-3 grid gap-3">
              {sessionEditContextSnapshot?.lastSectionId ? (
                <p className="text-[11px] text-slate-500">
                  Last regen target:{" "}
                  <span className="font-mono text-slate-400">{sessionEditContextSnapshot.lastSectionId}</span>
                </p>
              ) : null}
              <div className="grid max-w-xl gap-1.5">
                <label className={label}>Section</label>
                <select
                  value={sectionId}
                  onChange={(e) => setRefineSectionTargetSingle(e.target.value)}
                  className={`w-full px-3 py-2.5 text-sm ${field}`}
                >
                  <option value="">Select…</option>
                  {sectionOptions.map((opt) => (
                    <option key={`${opt.id}-${opt.label}`} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {effectiveSectionIds.length > 0 && effectiveSectionIds.length < 3 ? (
                  <div className="grid gap-1.5 pt-1">
                    <label className={`${label} normal-case tracking-normal`}>Add to selection</label>
                    <select
                      key={effectiveSectionIds.join("|")}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        setRefineSectionTargets([...effectiveSectionIds, v]);
                      }}
                      className={`w-full px-3 py-2 text-sm ${field}`}
                    >
                      <option value="">Optional — second or third section…</option>
                      {sectionOptions
                        .filter((o) => !effectiveSectionIds.includes(o.id))
                        .map((opt) => (
                          <option key={`add-${opt.id}-${opt.label}`} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : null}
                <button
                  type="button"
                  disabled={busy || !sectionId}
                  onClick={() => void runRegenerateSection()}
                  className="mt-2 inline-flex w-full max-w-sm items-center justify-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-4 py-2 text-sm font-semibold text-teal-100 transition-colors hover:border-teal-400/45 hover:bg-teal-500/15 disabled:pointer-events-none disabled:opacity-40"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Redesign selected section(s)
                </button>
                <p className="text-[10px] text-slate-600">Uses the command bar text as the instruction. Selection comes from the preview (shift-click) or the list above.</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
        </div>
      </details>

      {showPublish ? (
        <div className="mt-5 space-y-4 text-sm leading-relaxed text-slate-400">
          {agencyLaunchStrip}
          {deliverablesPackStrip}
          <p>
            When you’re ready, open <span className="font-medium text-indigo-200/95">Advanced</span> for deploy, domain, and mint. Ship this version now or
            iterate—you can publish again whenever you want.
          </p>
          <div className="rounded-xl border border-white/[0.06] bg-slate-950/30 p-4">
            <div className="text-sm font-semibold text-slate-100">Download project</div>
            <p className="mt-1 text-xs text-slate-500">Same static bundle as export—use on any host.</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void downloadProjectZip()}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-400/50 hover:bg-cyan-500/15 disabled:pointer-events-none disabled:opacity-40"
            >
              <Download className="h-4 w-4" aria-hidden />
              Download ZIP
            </button>
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {evaluation && (showRefine || showPublish || showDescribe) ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-4 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.12)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-emerald-100/95">Suggestions</div>
                <div className="mt-0.5 text-xs text-emerald-200/70">Ideas to consider—you choose what to change.</div>
              </div>
              <div className="text-sm tabular-nums text-emerald-200/90">
                {evaluation.score}/100 · {evaluation.passed ? "On track" : "Room to polish"}
              </div>
            </div>
            {contentIntelligenceMeta ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-2 text-xs text-cyan-100/85">
                <span>
                  <span className="font-medium text-cyan-200/90">Content</span>{" "}
                  <span className="tabular-nums">{contentIntelligenceMeta.contentScore}/100</span>
                </span>
                {contentIntelligenceMeta.repaired ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100/95">
                    <Sparkles className="h-3 w-3" aria-hidden />
                    Repaired
                  </span>
                ) : null}
                {contentIntelligenceMeta.genericContentWarning ? (
                  <span className="text-amber-200/90">Generic copy risk</span>
                ) : null}
              </div>
            ) : null}
            {buildCritiqueMeta ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-2 text-xs text-violet-100/85">
                {buildCritiqueMeta.autoRepaired ? (
                  <span className="font-medium text-violet-200/90">Copy/design repaired for clarity</span>
                ) : (buildCritiqueMeta.critiqueScore ?? 0) >= 62 ? (
                  <span className="font-medium text-violet-200/90">AI critique passed</span>
                ) : (
                  <span>
                    <span className="font-medium text-violet-200/90">Layout critique</span>{" "}
                    <span className="tabular-nums">{buildCritiqueMeta.critiqueScore}/100</span>
                    {buildCritiqueMeta.critiqueIssues?.length
                      ? ` · ${buildCritiqueMeta.critiqueIssues.slice(0, 3).join(", ")}`
                      : ""}
                  </span>
                )}
              </div>
            ) : null}
            <ul className="mt-3 max-h-40 space-y-1.5 overflow-auto text-sm leading-snug">
              {evaluation.findings.map((f, i) => (
                <li key={i} className={f.severity === "error" ? "text-red-300/95" : f.severity === "warn" ? "text-amber-100/90" : "text-slate-400"}>
                  {f.category ? <span className="text-slate-500">{f.category}: </span> : null}
                  {f.message}
                  {f.blockIndex != null ? (
                    <span className="text-[11px] font-normal opacity-50"> · ID {f.blockIndex + 1}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            {showPublish ? (
              <details className="mt-3 rounded-lg border border-white/[0.06] bg-slate-950/50 p-2">
                <summary className="cursor-pointer text-xs font-medium text-slate-500">Full suggestion log</summary>
                <pre className="mt-2 max-h-32 overflow-auto rounded-md bg-slate-950/80 p-2 text-[10px] text-slate-500">{JSON.stringify(evaluation, null, 2)}</pre>
              </details>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {showDescribe && planner ? (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 rounded-xl border border-white/[0.06] bg-slate-950/40 p-4"
          >
            <div className={label}>Latest plan snapshot</div>
            <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-slate-950/80 p-2 text-[11px] leading-relaxed text-slate-400">
              {JSON.stringify(planner, null, 2)}
            </pre>
          </motion.div>
        </AnimatePresence>
      ) : null}

      {variantPickSession ? (
        <SiteBuilderVariantPicker
          open
          primarySchema={variantPickSession.primary}
          alternates={variantPickSession.alternates}
          primaryGenerationMeta={variantPickSession.primaryGenerationMeta}
          busy={busy}
          onSelectLayout={confirmVariantSelection}
        />
      ) : null}
    </motion.section>
  );
});
