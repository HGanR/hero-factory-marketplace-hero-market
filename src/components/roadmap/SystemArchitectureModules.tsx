"use client";

/**
 * Revenue OS System Architecture cards (AI Revenue OS landing).
 *
 * **Module badge (`ModuleSpec.status`)** follows the **stricter product-promotion bar** in
 * `docs/revenue-os-module-promotion-checklist.md` (persistence depth, execution, governance,
 * downstream reuse)—not “baseline API exists.”
 *
 * - **LIVE** — Checklist criteria for this module are substantially met for product use (remaining
 *   gaps are minor or explicitly out of scope in the doc).
 * - **PARTIAL** — Core APIs/tables exist, but checklist blockers remain (e.g. missing data paths,
 *   mock-only execution, or missing UX for reuse).
 * - **NEXT** — Not implemented.
 *
 * **Endpoint row** `LIVE` still means the route handler is implemented (technical), independent of
 * the module badge.
 */

import { motion } from "framer-motion";

const ACCENT = "#00D1FF";

type Endpoint = {
  method: string;
  path: string;
  status: "LIVE" | "NEXT";
  input?: string;
  output?: string;
};

type ModuleSpec = {
  id: number;
  title: string;
  whatItDoes: string;
  status: "LIVE" | "PARTIAL" | "NEXT";
  endpoints: Endpoint[];
  tables: { name: string; exists: boolean }[];
  charts: string[];
  citationRule?: string;
};

const MODULES: ModuleSpec[] = [
  {
    id: 1,
    title: "Market Intelligence Engine",
    whatItDoes:
      "Industry mapping, competitor analysis, demand gap detection, regulatory scanning. Normalized `v:2` scans persist to `market_scans` with competitors, pricing, demand gaps, regulatory notes, and citations; citation URLs are upserted into `market_sources`. Regulatory/demand gaps remain benchmark-derived (no separate research pipeline).",
    status: "LIVE",
    endpoints: [
      {
        method: "GET",
        path: "/api/revenue-os/benchmarks?industry=",
        status: "LIVE",
        input: "industry (query)",
        output: "benchmarks with citation_url, year",
      },
      {
        method: "POST",
        path: "/api/revenue-os/market/scan",
        status: "LIVE",
        input: "industry, geo, offerType, userId (persist)",
        output: "normalized scan + competitors/pricing only with citation_url",
      },
      {
        method: "GET",
        path: "/api/revenue-os/market/scans?userId=&clientId=",
        status: "LIVE",
        input: "userId, optional clientId, limit",
        output: "recent scans + preview counts",
      },
      {
        method: "GET",
        path: "/api/revenue-os/market/scans/:id?userId=&clientId=",
        status: "LIVE",
        input: "scan id, userId, optional clientId",
        output: "full normalized payload",
      },
    ],
    tables: [
      { name: "industry_benchmarks", exists: true },
      { name: "market_sources", exists: true },
      { name: "market_scans", exists: true },
    ],
    charts: ["Benchmark Comparison Panel (cited)", "Market scan history (dashboard)"],
    citationRule: "All competitor/pricing claims must reference stored citationUrl.",
  },
  {
    id: 2,
    title: "Offer Engineering Core",
    whatItDoes:
      "Build a revenue ladder: pricing bands (Core/Premium/Ascension), upsells, margin focus. Emitted in analyze; offers/generate API + Offer Ladder panel live.",
    status: "LIVE",
    endpoints: [
      {
        method: "POST",
        path: "/api/revenue-os/analyze",
        status: "LIVE",
        input: "profile (revenue, AOV, traffic, conversion, CAC, LTV)",
        output: "offer plan in response (pricing ladder, upsells, margin focus)",
      },
      {
        method: "POST",
        path: "/api/revenue-os/offers/generate",
        status: "LIVE",
        input: "profile, industry",
        output: "offer ladder JSON (Core/Premium/Ascension), pricing bands, guarantee language",
      },
    ],
    tables: [
      { name: "revenue_profiles", exists: true },
      { name: "revenue_os_runs", exists: true },
      { name: "offer_packages", exists: true },
      { name: "offer_versions", exists: true },
    ],
    charts: ["Offer Ladder panel (LIVE)", "Benchmark-tied margin suggestions (cited)"],
  },
  {
    id: 3,
    title: "Deployment Automation Layer",
    whatItDoes:
      "Funnel and sequence artifacts stored as before. Each funnel POST records a deployment run; each sequence execute persists a run (`provider: none`, dry-run/mock until ESP). Dashboard Deployment Center lists runs and triggers dry-run execute — real SendGrid/Twilio remains a future integration.",
    status: "LIVE",
    endpoints: [
      {
        method: "POST",
        path: "/api/revenue-os/deploy/funnel",
        status: "LIVE",
        input: "profileId, funnelSpec",
        output: "funnel stored + deploymentRunId",
      },
      {
        method: "GET",
        path: "/api/revenue-os/deploy/funnel?userId=",
        status: "LIVE",
        input: "workspace",
        output: "funnel artifacts list",
      },
      {
        method: "POST",
        path: "/api/revenue-os/deploy/sequences",
        status: "LIVE",
        input: "profileId, channel (email|sms)",
        output: "sequence templates stored",
      },
      {
        method: "GET",
        path: "/api/revenue-os/deploy/sequences?userId=",
        status: "LIVE",
        input: "workspace",
        output: "sequences list",
      },
      {
        method: "POST",
        path: "/api/revenue-os/deploy/sequences/[id]/execute",
        status: "LIVE",
        input: "userId, dryRun",
        output: "runId + persisted execution (mock/dry-run)",
      },
      {
        method: "GET",
        path: "/api/revenue-os/deploy/runs?userId=",
        status: "LIVE",
        input: "workspace",
        output: "funnel + sequence execution history",
      },
    ],
    tables: [
      { name: "revenue_os_funnels", exists: true },
      { name: "revenue_os_funnel_pages", exists: true },
      { name: "revenue_os_message_sequences", exists: true },
      { name: "revenue_os_sequence_steps", exists: true },
      { name: "revenue_os_funnel_deployment_runs", exists: true },
      { name: "revenue_os_sequence_execution_runs", exists: true },
    ],
    charts: ["Deployment center (runs + dry-run)", "Artifact storage (funnels, sequences)"],
  },
  {
    id: 4,
    title: "Capital Allocation Optimizer",
    whatItDoes:
      "Govern CAC/LTV, spend reallocation, scaling gates. `capital_plans` link `profile_id`, `snapshot_month`, and workspace; `channel_spend_snapshots` stores monthly actuals per channel with optional revenue/ROAS. Plan vs actuals API + dashboard panel; formal budget lock/enforcement remains out of scope.",
    status: "LIVE",
    endpoints: [
      {
        method: "POST",
        path: "/api/revenue-os/analyze",
        status: "LIVE",
        input: "profile",
        output: "CAC/LTV guidance; meta.profileId for downstream links",
      },
      {
        method: "POST",
        path: "/api/revenue-os/capital/plan",
        status: "LIVE",
        input: "adSpend, channelMix, profileId, snapshotMonth, user/client",
        output: "budget allocation, scaling gates, guardrails",
      },
      {
        method: "POST",
        path: "/api/revenue-os/capital/channel-spend",
        status: "LIVE",
        input: "month, rows (channel, spend, optional revenue/ROAS)",
        output: "upserted channel spend actuals",
      },
      {
        method: "GET",
        path: "/api/revenue-os/capital/plan-vs-actuals?userId=&month=",
        status: "LIVE",
        input: "workspace + month",
        output: "recent plans, spend rows, comparison payload",
      },
      {
        method: "GET",
        path: "/api/revenue-os/capital/plans?userId=",
        status: "LIVE",
        input: "workspace",
        output: "recent capital plans",
      },
    ],
    tables: [
      { name: "revenue_os_monthly_snapshots", exists: true },
      { name: "capital_plans", exists: true },
      { name: "channel_spend_snapshots", exists: true },
    ],
    charts: [
      "CAC Risk Band (dashboard)",
      "CAC trend from monthly snapshots",
      "Plan vs actuals panel",
    ],
  },
  {
    id: 5,
    title: "Continuous Optimization Engine",
    whatItDoes:
      "A/B testing cadence, conversion-lift detection, and experiment conclusion (WON/LOST) with variant-level results. Active Experiments on dashboard; automated “offer reconstruction when KPIs stall” is still a promotion gap (manual/API-driven today).",
    status: "LIVE",
    endpoints: [
      {
        method: "POST",
        path: "/api/revenue-os/experiments",
        status: "LIVE",
        input: "userId, name, lever, hypothesis",
        output: "experiment record",
      },
      {
        method: "POST",
        path: "/api/revenue-os/experiments/:id/result",
        status: "LIVE",
        input: "status (WON|LOST), resultSnapshot",
        output: "result recorded",
      },
    ],
    tables: [
      { name: "revenue_os_experiments", exists: true },
      { name: "experiment_variants", exists: true },
      { name: "experiment_results", exists: true },
    ],
    charts: ["Active Experiments list", "Win/loss + variant results (API)", "Manual follow-up for offer changes"],
  },
];

function Badge({ status }: { status: "LIVE" | "PARTIAL" | "NEXT" }) {
  const styles: Record<string, { bg: string; text: string }> = {
    LIVE: { bg: "#22c55e", text: "white" },
    PARTIAL: { bg: "#eab308", text: "black" },
    NEXT: { bg: "#6b7280", text: "white" },
  };
  const s = styles[status] ?? styles.NEXT;
  return (
    <span
      className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {status}
    </span>
  );
}

const card =
  "bg-slate-800/40 border border-cyan-500 rounded-2xl p-8 shadow-lg";

type SystemArchitectureModulesProps = {
  /** When true, omit `id` (parent accordion owns `#architecture`). */
  omitSectionId?: boolean;
};

export function SystemArchitectureModules({ omitSectionId = false }: SystemArchitectureModulesProps) {
  return (
    <section id={omitSectionId ? undefined : "architecture"} className={omitSectionId ? "py-4" : "py-24"}>
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-4xl font-bold text-center" style={{ color: ACCENT }}>
          System Architecture
        </h2>
        <p className="text-gray-300 text-center max-w-3xl mx-auto mt-5">
          Five capability modules with explicit system calls. Each maps to APIs, tables, and charts.
        </p>
        <p className="text-gray-500 text-xs text-center max-w-3xl mx-auto mt-3 leading-relaxed">
          <strong className="text-gray-400">Promotion status:</strong> Module badges use the{" "}
          <strong className="text-gray-300">stricter product-promotion checklist</strong> (persistence,
          execution, reuse)—not merely “route exists.” Endpoint tags still mean the API is
          implemented. Details and blockers:{" "}
          <code className="text-cyan-400/90 bg-black/30 px-1.5 py-0.5 rounded">
            docs/revenue-os-module-promotion-checklist.md
          </code>
          .
        </p>

        <div className="grid md:grid-cols-1 lg:grid-cols-2 gap-8 mt-14">
          {MODULES.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className={card}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <span className="text-xs text-gray-500">MODULE {m.id}</span>
                <Badge status={m.status} />
              </div>
              <h3 className="text-xl font-semibold" style={{ color: ACCENT }}>
                {m.title}
              </h3>
              <p className="text-gray-400 mt-3 text-sm leading-relaxed">
                {m.whatItDoes}
              </p>

              {/* Endpoints */}
              <div className="mt-5">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  API Routes
                </div>
                <ul className="space-y-2">
                  {m.endpoints.map((e) => (
                    <li
                      key={e.path}
                      className="text-sm font-mono text-gray-300 flex flex-wrap items-baseline gap-2"
                    >
                      <span
                        className={e.status === "LIVE" ? "text-green-400" : "text-gray-500"}
                      >
                        {e.method} {e.path}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          e.status === "LIVE"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-gray-600/40 text-gray-400"
                        }`}
                      >
                        {e.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tables */}
              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Data Stores
                </div>
                <div className="flex flex-wrap gap-2">
                  {m.tables.map((t) => (
                    <code
                      key={t.name}
                      className={`text-xs px-2 py-1 rounded ${
                        t.exists
                          ? "bg-[#D4AF37]/20 text-cyan-400"
                          : "bg-gray-700/50 text-gray-500"
                      }`}
                    >
                      {t.name}
                      {t.exists ? " ✓" : ""}
                    </code>
                  ))}
                </div>
              </div>

              {/* Charts */}
              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Charts / UI
                </div>
                <ul className="text-sm text-gray-300 space-y-1">
                  {m.charts.map((c) => (
                    <li key={c}>• {c}</li>
                  ))}
                </ul>
              </div>

              {m.citationRule && (
                <div className="mt-4 pt-4 border-t border-cyan-500/30">
                  <div className="text-xs text-cyan-400/90 font-medium">
                    Citations required: {m.citationRule}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-cyan-500/50 bg-slate-800/50 p-6">
          <div className="text-sm font-semibold" style={{ color: ACCENT }}>
            Current State (Truthful)
          </div>
          <ul className="mt-3 text-sm text-gray-400 space-y-1">
            <li>• <strong className="text-gray-300">Module 1</strong> benchmarks + market/scan (normalized v2 + `market_scans` + `market_sources` upserts); GET market/scans history</li>
            <li>• <strong className="text-gray-300">Module 2</strong> analyze + offers/generate with offer_packages / offer_versions versioning</li>
            <li>• <strong className="text-gray-300">Module 3</strong> deploy APIs + execution run tables + GET runs; Deployment Center UI (mock/dry-run)</li>
            <li>• <strong className="text-gray-300">Module 4</strong> capital plans + channel spend actuals; GET plan-vs-actuals + dashboard panel</li>
            <li>• <strong className="text-gray-300">Module 5</strong> experiments + variants + experiment_results; winner lift vs control (manual/API follow-up for offers; automated reconstruction still out of scope)</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
