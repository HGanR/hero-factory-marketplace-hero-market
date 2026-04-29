/**
 * Notes engine — builds campaign-ready notes from dashboard context.
 * Populates the Paste Notes field so Generate Campaign has structured context
 * without requiring manual input.
 */

export type AnalysisContext = {
  kpis: {
    currentMonthlyRevenueModel: number;
    targetMonthlyRevenue: number;
    revenueGap: number;
    impliedOrdersNeeded: number;
  };
  levers: {
    traffic: { current: number; target: number; delta: number };
    conversionRatePct: { current: number; target: number; delta: number };
    avgOrderValue: { current: number; target: number; delta: number };
    cac: { current: number; target: number; delta: number };
  };
  plan: {
    offerEngineering?: string[];
    funnel?: string[];
    sales?: string[];
    capitalAllocation?: string[];
    optimization?: string[];
  };
};

export type TrendsContext = {
  industry?: string;
  targetAudience?: string;
  items?: Array<{
    platform?: string;
    title?: string;
    summary?: string;
    whyTrending?: string;
    tags?: string[];
  }>;
  campaignAngles?: string[];
  contentBlueprints?: Array<{
    platform?: string;
    format?: string;
    hook?: string;
    cta?: string;
    notes?: string;
  }>;
};

export type FormContext = {
  industry?: string;
  targetAudience?: string;
  market?: string;
  businessName?: string;
  currentMonthlyRevenue?: number;
  targetMonthlyRevenue?: number;
  avgOrderValue?: number;
  monthlyTraffic?: number;
  conversionRatePct?: number;
  cac?: number;
  ltv?: number;
};

export type NotesEngineContext = {
  industry: string;
  targetAudience: string;
  form?: FormContext;
  analysis?: AnalysisContext;
  trends?: TrendsContext;
};

/**
 * Builds structured notes from dashboard context for the Paste Notes → Generate Campaign flow.
 */
export function buildNotesFromContext(ctx: NotesEngineContext): string {
  const parts: string[] = [];
  const { industry, targetAudience, form, analysis, trends } = ctx;

  parts.push("INDUSTRY & AUDIENCE");
  parts.push(`Industry: ${industry || "Consulting"}`);
  parts.push(`Target audience: ${targetAudience || "general audience"}`);
  if (form?.market) parts.push(`Market: ${form.market}`);
  if (form?.businessName) parts.push(`Business: ${form.businessName}`);
  parts.push("");

  if (analysis) {
    parts.push("KEY METRICS (from Run Analysis)");
    const fmt = (n: number) =>
      n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    parts.push(`Current monthly revenue model: ${fmt(analysis.kpis.currentMonthlyRevenueModel)}`);
    parts.push(`Target: ${fmt(analysis.kpis.targetMonthlyRevenue)} | Gap: ${fmt(analysis.kpis.revenueGap)}`);
    parts.push(`Implied orders needed: ${analysis.kpis.impliedOrdersNeeded.toLocaleString()}`);
    parts.push("");
    parts.push("Levers — Traffic, Conversion (%), AOV, CAC:");
    parts.push(
      `Traffic: ${analysis.levers.traffic.current} → ${analysis.levers.traffic.target} (Δ ${analysis.levers.traffic.delta})`
    );
    parts.push(
      `Conversion: ${analysis.levers.conversionRatePct.current}% → ${analysis.levers.conversionRatePct.target}% (Δ ${analysis.levers.conversionRatePct.delta})`
    );
    parts.push(
      `AOV: ${fmt(analysis.levers.avgOrderValue.current)} → ${fmt(analysis.levers.avgOrderValue.target)}`
    );
    parts.push(
      `CAC: ${fmt(analysis.levers.cac.current)} → ${fmt(analysis.levers.cac.target)}`
    );
    parts.push("");

    if (analysis.plan) {
      parts.push("PLAN HIGHLIGHTS");
      const sections = [
        ["Offer engineering", analysis.plan.offerEngineering],
        ["Funnel", analysis.plan.funnel],
        ["Sales", analysis.plan.sales],
        ["Capital allocation", analysis.plan.capitalAllocation],
        ["Optimization", analysis.plan.optimization],
      ] as const;
      for (const [label, bullets] of sections) {
        if (bullets?.length) {
          parts.push(`${label}:`);
          bullets.slice(0, 3).forEach((b) => parts.push(`- ${b}`));
          parts.push("");
        }
      }
    }
  }

  const trendsBlock =
    trends?.items?.length || trends?.campaignAngles?.length || trends?.contentBlueprints?.length
      ? buildTrendsPatternsBlockForAnalysis(trends)
      : "";
  if (trendsBlock) parts.push(trendsBlock);

  const notes = parts.join("\n").trim();
  return notes;
}

/**
 * Trends-only block for appending to `/api/revenue-os/analyze` notes (dashboard Trends Library + shared formatting).
 */
export function buildTrendsPatternsBlockForAnalysis(trends: TrendsContext): string {
  if (!trends?.items?.length && !trends?.campaignAngles?.length && !trends?.contentBlueprints?.length) {
    return "";
  }
  const parts: string[] = [];
  parts.push("TRENDING CONTENT PATTERNS (from Identify Trending Content)");
  if (trends.items?.length) {
    parts.push("Top performing formats:");
    trends.items.slice(0, 6).forEach((item, i) => {
      const title = item.title || "Untitled";
      const summary = item.summary || item.whyTrending || "";
      parts.push(`${i + 1}. [${item.platform || "?"}] ${title}`);
      if (summary) parts.push(`   ${summary.slice(0, 120)}${summary.length > 120 ? "…" : ""}`);
    });
    parts.push("");
  }
  if (trends.campaignAngles?.length) {
    parts.push("Campaign angles:");
    trends.campaignAngles.slice(0, 6).forEach((a) => parts.push(`- ${a}`));
    parts.push("");
  }
  if (trends.contentBlueprints?.length) {
    parts.push("Content blueprints:");
    trends.contentBlueprints.slice(0, 4).forEach((bp) => {
      parts.push(
        `- ${bp.platform || "?"}: ${bp.format || ""} | Hook: ${bp.hook || ""} | CTA: ${bp.cta || ""}`
      );
    });
  }
  return parts.join("\n").trim();
}
