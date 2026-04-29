import type { SitePlannerInput, SitePlannerOutput, SiteIntent } from "@/lib/site-builder/ai/schemas";
import { SitePlannerOutputSchema } from "@/lib/site-builder/ai/schemas";
import { composeHomeSectionPlan, composeSitemap } from "@/lib/site-builder/ai/section-composition";
import { resolveStyleMode, type StyleMode } from "@/lib/site-builder/ai/visual-tokens";
import { buildSiteBuilderAssistantContractAppendix } from "@/lib/site-builder/ai/assistant-builder-context";
import {
  getResolvedGlobalLlmModel,
  invokeNpcLlm,
  isGlobalManagedLlmConfigured,
  type LlmMessage,
} from "@/lib/npc/llm";
import type { SiteBuilderLlmSource } from "@/lib/site-builder/ai/providers/types";

export type RunSitePlannerOptions = {
  /**
   * - Omitted: legacy — use global `NPC_LLM_ENDPOINT` + `invokeNpcLlm` when endpoint is set.
   * - `null`: skip LLM (deterministic output only).
   * - function: BYOK/managed invoker from site-builder provider resolution.
   */
  invokeLlm?: ((messages: LlmMessage[]) => Promise<string | null>) | null;
  /**
   * When the site is set to `llmMode: "off"`, do not fall back to global `OPENAI_API_KEY` / `NPC_LLM_*`.
   */
  forceDeterministic?: boolean;
  /**
   * Per-site selection from `resolveSiteBuilderLlmInvokeForSite` (for response metadata and logging).
   */
  llmSource?: SiteBuilderLlmSource;
  /**
   * Structural “pattern memory” from prior high-scoring / published generations (no CRM text).
   * When set, appended to the planner user message for the managed LLM path; deterministic path ignores it.
   */
  intelligencePatternHints?: string;
};
import { extractJsonFromLlmText, extractJsonFromLlmTextLenient } from "@/lib/revenue-os/extractLlmJson";

const INTENT_KEYWORDS: Array<{ match: RegExp; intent: SiteIntent }> = [
  { match: /\b(dao|defi|nft|token|wallet|on-?chain|smart contract|web3)\b/i, intent: "web3_product" },
  { match: /\b(trust|family office|fiduciary|operator)\b/i, intent: "trust_operator" },
  { match: /\b(saas|b2b|software|platform|api)\b/i, intent: "saas" },
  { match: /\b(portfolio|creator|designer|photographer)\b/i, intent: "portfolio" },
  { match: /\b(community|members|discord|collective)\b/i, intent: "community" },
  { match: /\b(shop|store|checkout|sku|cart)\b/i, intent: "ecommerce_light" },
  { match: /\b(salon|barber|restaurant|local|clinic|studio)\b/i, intent: "local_business" },
];

function classifyIntent(prompt: string, siteType: SitePlannerInput["siteType"]): SiteIntent {
  if (siteType !== "auto") return siteType;
  const p = prompt.toLowerCase();
  for (const row of INTENT_KEYWORDS) {
    if (row.match.test(p)) return row.intent;
  }
  return "landing";
}

function normalizeBrief(prompt: string): string {
  const t = prompt.trim().replace(/\s+/g, " ");
  return t.slice(0, 2000);
}

function proposeDesignTokens(
  input: SitePlannerInput,
  intent: SiteIntent
): SitePlannerOutput["designTokens"] {
  const dir = input.designDirection || (input.web3VisualMode ? "cyber" : "operator");
  const intensity = input.styleIntensity;
  const styleMode = resolveStyleMode({ designDirection: input.designDirection, web3VisualMode: input.web3VisualMode, intent });
  if (dir === "minimal") {
    return {
      styleMode,
      backgroundMode: "simple_gradients",
      gradientStart: "#0f172a",
      gradientEnd: "#1e293b",
      motionIntensity: Math.round(intensity * 0.3),
    };
  }
  if (dir === "cyber" || input.web3VisualMode) {
    return {
      styleMode,
      accent: "#22d3ee",
      surface: "#0f172a",
      backgroundMode: "abstract_gradients",
      gradientStart: "#312e81",
      gradientEnd: "#4c1d95",
      motionIntensity: Math.round(intensity * 0.85),
    };
  }
  if (dir === "luxe") {
    return {
      styleMode,
      accent: "#fcd34d",
      surface: "#0c0a09",
      backgroundMode: "custom_gradient",
      gradientStart: "#1c1917",
      gradientEnd: "#44403c",
      motionIntensity: Math.round(intensity * 0.5),
    };
  }
  if (intent === "web3_product") {
    return {
      styleMode,
      backgroundMode: "abstract_gradients",
      gradientStart: "#0f172a",
      gradientEnd: "#581c87",
      motionIntensity: Math.round(intensity * 0.7),
    };
  }
  return {
    styleMode,
    backgroundMode: "simple_gradients",
    gradientStart: "#0f172a",
    gradientEnd: "#1e293b",
    motionIntensity: Math.round(intensity * 0.55),
  };
}

function brandVoiceFromIntent(intent: SiteIntent, prompt: string): SitePlannerOutput["brandVoice"] {
  const keywords = Array.from(
    new Set(
      prompt
        .toLowerCase()
        .split(/[^a-z0-9+]+/g)
        .filter((w) => w.length > 3)
        .slice(0, 12)
    )
  ).slice(0, 8);
  const tones: Record<SiteIntent, string> = {
    landing: "Direct, conversion-aware",
    portfolio: "Calm, craft-forward",
    saas: "Crisp, capability-led",
    web3_product: "Credible, security-conscious",
    community: "Warm, inclusive",
    ecommerce_light: "Benefit-led, transactional",
    local_business: "Friendly, neighborhood-trusted",
    trust_operator: "Formal, fiduciary-clear",
  };
  return { tone: tones[intent], keywords: keywords.length ? keywords : ["trust", "clarity", "execution"] };
}

function conversionGoalFromIntent(intent: SiteIntent): string {
  const m: Record<SiteIntent, string> = {
    landing: "Capture qualified interest and drive a primary action",
    portfolio: "Book a conversation or commission",
    saas: "Start a trial or book a demo",
    web3_product: "Connect wallet or join allowlist",
    community: "Join the community or subscribe",
    ecommerce_light: "Complete purchase or add-to-cart",
    local_business: "Call, book, or visit",
    trust_operator: "Open a records conversation or schedule governance review",
  };
  return m[intent];
}

export type PlannerResult = {
  output: SitePlannerOutput;
  llmEnriched: boolean;
  /** True when a successful LLM response was parsed to structured output. */
  llmUsed: boolean;
  llmModel?: string;
  /** Where the invoker came from: global env, per-site managed, or BYOK. */
  llmProvider?: "env" | "site_managed" | "site_byok" | "none";
  /** Why the template path was used, when `llmEnriched` is false. */
  fallbackReason?: string;
};

function logPlannerLlm(
  input: SitePlannerInput,
  detail: {
    usedLlm: boolean;
    model: string;
    provider: PlannerResult["llmProvider"];
    explicit: boolean;
    forceDeterministic?: boolean;
    source?: string;
    fallbackReason?: string;
  },
) {
  const brief = (input.userPrompt || "").trim().slice(0, 80);
  console.info(
    "[site-builder-planner]",
    JSON.stringify({
      brief,
      ...detail,
    }),
  );
}

function buildDeterministicPlanner(input: SitePlannerInput): SitePlannerOutput {
  const intent = classifyIntent(input.userPrompt, input.siteType);
  const brief = normalizeBrief(input.userPrompt);
  const titleGuess = brief.split(/[.!?]/)[0]?.trim()?.slice(0, 80) || "Your site";
  const tokens = proposeDesignTokens(input, intent);
  const styleMode: StyleMode =
    tokens.styleMode ??
    resolveStyleMode({
      designDirection: input.designDirection,
      web3VisualMode: input.web3VisualMode,
      intent,
    });
  const lvi = Math.max(0, Math.min(7, input.layoutVariantIndex ?? 0));
  const sectionPlan = composeHomeSectionPlan(
    intent,
    styleMode,
    input.web3VisualMode,
    brief,
    lvi,
    input.layoutFamilyId,
  );
  const sitemap = composeSitemap(titleGuess, intent, brief);
  const out: SitePlannerOutput = {
    version: 1,
    intent,
    normalizedBrief: brief,
    sitemap,
    sectionPlan: sectionPlan.map((s) => ({
      id: s.id,
      registryKey: s.registryKey,
      headline: s.headline,
      purpose: s.purpose,
      rhythmSurface: s.rhythmSurface,
      spacingScale: s.spacingScale,
      sectionRole: s.sectionRole,
    })),
    designTokens: tokens,
    brandVoice: brandVoiceFromIntent(intent, input.userPrompt),
    conversionGoal: conversionGoalFromIntent(intent),
    web3ExtensionHints: {
      walletPersonalizationReady: intent === "web3_product" || input.web3VisualMode,
      tokenGatedSectionsPossible: intent === "web3_product" || input.web3VisualMode,
      manualApprovalRequiredForContractWrites: true,
    },
  };
  return SitePlannerOutputSchema.parse(out);
}

const LLM_PLANNER_SYSTEM = `You are a senior product planner for a React/Tailwind site builder.
Return ONLY valid JSON (no markdown) matching this shape:
{
  "version": 1,
  "intent": "landing|portfolio|saas|web3_product|community|ecommerce_light|local_business|trust_operator",
  "normalizedBrief": string,
  "sitemap": [{"slug": string, "title": string, "purpose"?: string}],
  "sectionPlan": [{"id": string, "registryKey": string, "headline"?: string, "purpose"?: string}],
  "designTokens": {
    "accent"?: string,
    "surface"?: string,
    "backgroundMode"?: "simple_gradients"|"abstract_gradients"|"custom_gradient"|"custom_color"|"custom_media"|"white-editorial"|"dark-cinematic"|"holographic-gradient"|"glass-grid"|"luxury-minimal",
    "gradientStart"?: string,
    "gradientEnd"?: string,
    "motionIntensity"?: number,
    "gradientStyle"?: "neon-radial"|"aurora"|"chrome"|"soft-mesh"|"none",
    "buttonStyle"?: "glow"|"glass"|"bold-solid"|"chrome"|"minimal",
    "depthStyle"?: "flat"|"card-depth"|"cinematic-layered"|"floating-panels",
    "motionHint"?: "none"|"subtle-parallax"|"scroll-reveal"|"floating-orbs"
  },
  "brandVoice": {"tone": string, "keywords": string[]},
  "conversionGoal": string,
  "web3ExtensionHints"?: {
    "walletPersonalizationReady": boolean,
    "tokenGatedSectionsPossible": boolean,
    "manualApprovalRequiredForContractWrites": boolean
  }
}
Rules:
- sectionPlan.registryKey MUST be one of: hero_primary, hero_primary_glow, hero_primary_split, hero_primary_grid, hero_primary_neural, hero_primary_depth, hero_primary_signal, hero_primary_holographic, hero_cinematic_split, hero_holographic_depth, hero_white_editorial_bold, paragraph_intro, trust_strip, trust_network_grid, value_props, feature_grid, feature_bento_glass, image_spotlight, stat_band, visual_break_gradient, glow_strip, mid_cta, cta_glow_panel, pricing_cinematic_cards, agent_showcase_orb, social_proof, web3_proof_network, web3_ribbon, faq, footer_standard
- When layoutVariantIndex (0-7) is present in the user JSON, vary section order and non-hero registry choices across indices so the same brief can yield meaningfully different layouts.
- When layoutFamilyId is present, prioritize that structural family over generic defaults.
- Keep sectionPlan length between 8 and 14 items
- sitemap must include slug "/"

${buildSiteBuilderAssistantContractAppendix()}
`;

function plannerProviderForResult(
  llmEnriched: boolean,
  explicit: boolean,
  upgradedFromGlobal: boolean,
  opt?: RunSitePlannerOptions,
): PlannerResult["llmProvider"] {
  if (!llmEnriched) return "none";
  if (upgradedFromGlobal) return "env";
  if (opt?.llmSource === "byok") return "site_byok";
  if (opt?.llmSource === "managed") return "site_managed";
  return "env";
}

export async function runSitePlanner(
  input: SitePlannerInput,
  options?: RunSitePlannerOptions,
): Promise<PlannerResult> {
  const deterministic = buildDeterministicPlanner(input);
  const model = getResolvedGlobalLlmModel();
  const opt = options;

  const explicit = opt !== undefined && Object.prototype.hasOwnProperty.call(opt, "invokeLlm");
  let invoke: ((messages: LlmMessage[]) => Promise<string | null>) | null;
  let upgradedFromGlobal = false;
  if (explicit) {
    invoke = opt!.invokeLlm ?? null;
    if (invoke === null && !opt!.forceDeterministic && isGlobalManagedLlmConfigured()) {
      invoke = invokeNpcLlm;
      upgradedFromGlobal = true;
    }
  } else {
    invoke = isGlobalManagedLlmConfigured() ? invokeNpcLlm : null;
  }

  if (!invoke) {
    const reason = opt?.forceDeterministic
      ? "llm_mode_off"
      : "no_llm_configured";
    logPlannerLlm(input, {
      usedLlm: false,
      model,
      provider: "none",
      explicit: Boolean(explicit),
      forceDeterministic: opt?.forceDeterministic,
      source: opt?.llmSource,
      fallbackReason: reason,
    });
    return {
      output: deterministic,
      llmEnriched: false,
      llmUsed: false,
      llmModel: model,
      llmProvider: "none",
      fallbackReason: reason,
    };
  }

  let scrubbedContext = "";
  if (input.industry) {
    const scrubMessages: LlmMessage[] = [
      { role: "system", content: "You are an expert market researcher and competitive analyst." },
      { role: "user", content: `Please perform a deep competitive analysis and "scrub the internet" for the following industry: "${input.industry}". ${input.market ? `Target market: "${input.market}".` : ""} Extract the key points that make the best websites in this space successful, identify missing points or common opportunities, and outline the specific needs for this industry's web presence. Return a concise research brief.` }
    ];
    try {
      const scrubResult = await invoke(scrubMessages);
      if (scrubResult) {
        scrubbedContext = `\n\n--- MARKET RESEARCH & INDUSTRY SCRUB ---\n${scrubResult}\n---------------------------------------\n\nUse this research to strictly inform the sectionPlan, sitemap, and conversionGoal.`;
      }
    } catch {
      // ignore scrub failure
    }
  }

  const user = JSON.stringify({
    userPrompt: input.userPrompt,
    industry: input.industry,
    market: input.market,
    businessName: input.businessName,
    primaryOffer: input.primaryOffer,
    audience: input.audience,
    statedConversionGoal: input.statedConversionGoal,
    statedBrandTone: input.statedBrandTone,
    statedDesignPreference: input.statedDesignPreference,
    statedTrustAndProof: input.statedTrustAndProof,
    layoutVariantIndex: input.layoutVariantIndex,
    layoutFamilyId: input.layoutFamilyId,
    variantIntent: input.variantIntent,
    siteType: input.siteType,
    designDirection: input.designDirection,
    styleIntensity: input.styleIntensity,
    web3VisualMode: input.web3VisualMode,
    deterministicDraft: deterministic,
    inspirationBrief: input.inspirationBrief
      ? {
          detectedIndustry: input.inspirationBrief.detectedIndustry,
          tone: input.inspirationBrief.tone,
          colorDirection: input.inspirationBrief.colorDirection,
          layoutPatterns: input.inspirationBrief.layoutPatterns,
          heroPattern: input.inspirationBrief.heroPattern,
          ctaPatterns: input.inspirationBrief.ctaPatterns,
          trustSignals: input.inspirationBrief.trustSignals,
          keywordThemes: input.inspirationBrief.keywordThemes,
          doNotCopyNotice: true,
        }
      : undefined,
  });
  const patternBlock = opt?.intelligencePatternHints?.trim()
    ? `\n\n--- PATTERN MEMORY (structural — prior published/high-scoring sites in this account) ---\n${opt.intelligencePatternHints.trim()}\n`
    : "";
  const messages: LlmMessage[] = [
    { role: "system", content: LLM_PLANNER_SYSTEM },
    {
      role: "user",
      content: `Refine the planner JSON. Preserve deterministicDraft intent unless userPrompt clearly contradicts it.${scrubbedContext}${patternBlock}\n\n${user}`,
    },
  ];

  let legacyInvoke = !explicit;
  let triedGlobalRescue = false;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await invoke(messages);
      if (!raw) {
        if (isGlobalManagedLlmConfigured() && !opt?.forceDeterministic && invoke !== invokeNpcLlm) {
          invoke = invokeNpcLlm;
          upgradedFromGlobal = true;
          console.warn("[site-builder-planner] empty LLM response from primary invoker, retrying with global managed");
          continue;
        }
        const reason = "llm_empty_response";
        logPlannerLlm(input, {
          usedLlm: false,
          model,
          provider: "none",
          explicit: Boolean(explicit),
          forceDeterministic: opt?.forceDeterministic,
          source: opt?.llmSource,
          fallbackReason: reason,
        });
        return {
          output: deterministic,
          llmEnriched: false,
          llmUsed: false,
          llmModel: model,
          llmProvider: "none",
          fallbackReason: reason,
        };
      }
      let parsed = extractJsonFromLlmText(raw);
      let merged = SitePlannerOutputSchema.safeParse(parsed);
      if (!merged.success) {
        const lp = extractJsonFromLlmTextLenient(raw);
        if (lp) merged = SitePlannerOutputSchema.safeParse(lp);
      }
      if (merged.success) {
        const p = plannerProviderForResult(true, Boolean(explicit), upgradedFromGlobal, opt);
        logPlannerLlm(input, {
          usedLlm: true,
          model,
          provider: p,
          explicit: Boolean(explicit),
          forceDeterministic: opt?.forceDeterministic,
          source: opt?.llmSource,
        });
        return {
          output: merged.data,
          llmEnriched: true,
          llmUsed: true,
          llmModel: model,
          llmProvider: p,
        };
      }
      if (attempt === 0) {
        console.warn("[site-builder-planner] plan JSON did not match schema, retrying LLM once");
        continue;
      }
      if (isGlobalManagedLlmConfigured() && !opt?.forceDeterministic && invoke !== invokeNpcLlm) {
        try {
          const rawG = await invokeNpcLlm(messages);
          if (rawG) {
            let parsedG = extractJsonFromLlmText(rawG);
            let mergedG = SitePlannerOutputSchema.safeParse(parsedG);
            if (!mergedG.success) {
              const lpG = extractJsonFromLlmTextLenient(rawG);
              if (lpG) mergedG = SitePlannerOutputSchema.safeParse(lpG);
            }
            if (mergedG.success) {
              upgradedFromGlobal = true;
              const pOk = plannerProviderForResult(true, true, true, { ...opt, llmSource: "managed" });
              logPlannerLlm(input, {
                usedLlm: true,
                model,
                provider: pOk,
                explicit: true,
                forceDeterministic: opt?.forceDeterministic,
                source: "managed",
                fallbackReason: "recovered_after_parse_fail",
              });
              return {
                output: mergedG.data,
                llmEnriched: true,
                llmUsed: true,
                llmModel: model,
                llmProvider: pOk,
              };
            }
          }
        } catch {
          /* fall through to deterministic */
        }
      }
      const reason = "llm_parse_failed";
      const pNone = plannerProviderForResult(false, Boolean(explicit), upgradedFromGlobal, opt);
      logPlannerLlm(input, {
        usedLlm: false,
        model,
        provider: pNone,
        explicit: Boolean(explicit),
        source: opt?.llmSource,
        fallbackReason: reason,
      });
      return {
        output: deterministic,
        llmEnriched: false,
        llmUsed: false,
        llmModel: model,
        llmProvider: pNone,
        fallbackReason: reason,
      };
    } catch (e) {
      if (!legacyInvoke && !triedGlobalRescue && isGlobalManagedLlmConfigured() && !opt?.forceDeterministic) {
        triedGlobalRescue = true;
        invoke = invokeNpcLlm;
        upgradedFromGlobal = true;
        legacyInvoke = true;
        console.warn("[site-builder-planner] primary invoker threw, retrying with global managed", e);
        continue;
      }
      if (!legacyInvoke) throw e;
      const errMsg = e instanceof Error ? e.message.slice(0, 200) : "llm_error";
      logPlannerLlm(input, {
        usedLlm: false,
        model,
        provider: "none",
        explicit: Boolean(explicit),
        source: opt?.llmSource,
        fallbackReason: `llm_error: ${errMsg}`,
      });
      return {
        output: deterministic,
        llmEnriched: false,
        llmUsed: false,
        llmModel: model,
        llmProvider: "none",
        fallbackReason: `llm_error: ${errMsg}`,
      };
    }
  }
  throw new Error("site-builder-planner: exhausted LLM attempts without return");
}
