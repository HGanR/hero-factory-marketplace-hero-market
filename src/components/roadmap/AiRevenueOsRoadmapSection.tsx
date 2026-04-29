"use client";

import Link from "next/link";

const ACCENT = "#00D1FF";

const PHASES = [
  {
    id: "phase-i",
    title: "Phase I (LIVE): Revenue Intelligence",
    badge: "LIVE",
    apis: ["POST /api/revenue-os/analyze"],
    tables: ["revenue_profiles", "revenue_os_runs"],
    charts: ["KPIs (Modeled Revenue, Gap, Orders Needed)", "Lever Targets", "Primary Focus Lever"],
    bullets: [
      "Revenue modeling (Traffic × Conversion × AOV)",
      "Revenue gap + implied orders needed",
      "Lever delta (traffic / conversion / AOV / CAC)",
      "Capital governance thresholds",
    ],
  },
  {
    id: "phase-ii",
    title: "Phase II: Benchmark Intelligence (Cited)",
    badge: "LIVE",
    apis: ["GET /api/revenue-os/benchmarks?industry="],
    tables: ["industry_benchmarks"],
    charts: ["Benchmark Comparison Panel (cited)"],
    bullets: [
      "Compare KPIs vs validated benchmarks by industry",
      "Citations inline: source + year + link for every benchmark",
      "Benchmarks only displayed when citation_url + year stored",
    ],
    note: "Benchmarks are only displayed when sourced & stored with citation_url + year.",
  },
  {
    id: "phase-iii",
    title: "Phase III: Scenario Simulation Engine",
    badge: "LIVE",
    apis: ["(part of analyze)", "Lever impact simulation"],
    tables: [],
    charts: ["Revenue Projection Chart", "Lever Impact Chart", "CAC Risk Gauge"],
    bullets: [
      "Simulate +1% conversion, +15% AOV, +25% traffic, -18% CAC",
      "Projected revenue curve (current vs optimized)",
      "CAC vs AOV risk bands: Safe / Caution / Risk",
    ],
  },
  {
    id: "phase-iv",
    title: "Phase IV: Performance Memory & Experiment Tracking",
    badge: "LIVE",
    apis: [
      "POST /api/revenue-os/snapshot",
      "GET /api/revenue-os/snapshots",
      "POST /api/revenue-os/experiments",
      "PATCH /api/revenue-os/experiments/[id]",
    ],
    tables: ["revenue_os_monthly_snapshots", "revenue_os_experiments"],
    charts: ["Snapshot History", "CAC trend line", "Active Experiments", "Growth trajectory", "Offer reconstruction trigger"],
    bullets: [
      "Monthly KPI snapshots (MoM trend tracking)",
      "Growth trajectory vs industry median band",
      "Experiment objects + win/loss results",
      "Offer reconstruction trigger when KPIs stall",
    ],
  },
];

function PhaseBadge({ badge }: { badge: string }) {
  const isLive = badge === "LIVE";
  return (
    <span
      className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
      style={{
        backgroundColor: isLive ? "#22c55e" : "#6b7280",
        color: "white",
      }}
    >
      {badge}
    </span>
  );
}

type AiRevenueOsRoadmapSectionProps = {
  /** When true, omit outer section id (parent accordion owns `#roadmap-phases`). */
  embedded?: boolean;
};

export function AiRevenueOsRoadmapSection({ embedded = false }: AiRevenueOsRoadmapSectionProps) {
  const outerClass = embedded ? "bg-black text-white py-0" : "bg-black text-white py-20";
  return (
    <section id={embedded ? undefined : "roadmap-phases"} className={outerClass}>
      <div className="max-w-6xl mx-auto px-6">
        {!embedded ? (
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <h2 className="text-3xl md:text-5xl font-bold">
                <span style={{ color: ACCENT }}>AI Revenue OS™</span>{" "}
                — Data-Governed Growth Engine
              </h2>
              <p className="text-gray-400 mt-3 max-w-3xl">
                The difference between &quot;advice&quot; and an operating system is
                governance: benchmarks, scenarios, risk bands, and performance memory.
              </p>
            </div>

            <div className="rounded-2xl border border-[#D4AF37]/50 bg-slate-800/50 p-4">
              <div className="text-xs text-gray-400 mb-2">Quick Links</div>
              <div className="flex flex-col gap-2 text-sm">
                <a className="text-cyan-400 hover:underline" href="#phase-i">Phase I (LIVE)</a>
                <a className="text-cyan-400 hover:underline" href="#phase-ii">Phase II (LIVE)</a>
                <a className="text-cyan-400 hover:underline" href="#phase-iii">Phase III (LIVE)</a>
                <a className="text-cyan-400 hover:underline" href="#phase-iv">Phase IV</a>
                <a className="text-cyan-400 hover:underline" href="#architecture">System Architecture</a>
                <Link className="text-cyan-300 hover:underline" href="/ai-revenue-os">
                  Open AI Revenue OS →
                </Link>
                <Link className="text-cyan-400 hover:underline" href="/revenue-os/dashboard">
                  Revenue OS Dashboard →
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm pb-2 border-b border-[#D4AF37]/30">
            <span className="text-gray-500 text-xs uppercase tracking-wide mr-2">Jump:</span>
            <a className="text-cyan-400 hover:underline" href="#phase-i">Phase I</a>
            <a className="text-cyan-400 hover:underline" href="#phase-ii">Phase II</a>
            <a className="text-cyan-400 hover:underline" href="#phase-iii">Phase III</a>
            <a className="text-cyan-400 hover:underline" href="#phase-iv">Phase IV</a>
            <a className="text-cyan-400 hover:underline" href="#architecture">Architecture</a>
            <Link className="text-cyan-400 hover:underline" href="/revenue-os/dashboard">
              Dashboard →
            </Link>
          </div>
        )}

        <div className={`grid md:grid-cols-2 gap-6 ${embedded ? "mt-6" : "mt-12"}`}>
          {PHASES.map((p) => (
            <PhaseCard key={p.id} phase={p} />
          ))}
        </div>

        {!embedded ? (
          <div className="mt-10 rounded-2xl border border-[#D4AF37] bg-slate-800/50 p-6">
            <div className="text-sm text-gray-300">
              Strategic Differentiator
            </div>
            <div className="text-2xl font-bold mt-2" style={{ color: ACCENT }}>
              Data-Governed Capital Acceleration System™
            </div>
            <div className="text-gray-400 mt-2">
              Not generic suggestions—benchmarked, simulated, risk-banded, and tracked over time.
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PhaseCard({ phase }: { phase: (typeof PHASES)[0] }) {
  return (
    <div id={phase.id} className="rounded-2xl border border-[#D4AF37]/60 bg-slate-800/50 p-6">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="text-lg font-semibold" style={{ color: ACCENT }}>{phase.title}</div>
        <PhaseBadge badge={phase.badge} />
      </div>
      <div className="text-xs text-gray-500 space-y-1 mt-3">
        <div><strong>APIs:</strong> {phase.apis.join(", ")}</div>
        {phase.tables.length > 0 && (
          <div><strong>Tables:</strong> {phase.tables.join(", ")}</div>
        )}
        <div><strong>Charts:</strong> {phase.charts.join("; ")}</div>
      </div>
      <ul className="mt-4 list-disc pl-5 space-y-2 text-gray-300">
        {phase.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      {phase.note && <div className="mt-4 text-xs text-gray-500">{phase.note}</div>}
    </div>
  );
}
