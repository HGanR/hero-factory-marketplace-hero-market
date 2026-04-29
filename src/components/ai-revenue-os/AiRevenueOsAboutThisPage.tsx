"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { SystemArchitectureModules } from "@/components/roadmap/SystemArchitectureModules";
import { AiRevenueOsRoadmapSection } from "@/components/roadmap/AiRevenueOsRoadmapSection";

const ACCENT = "#00D1FF";

const btn3dGold =
  "relative px-7 py-4 rounded-xl font-semibold transition-all duration-200 active:translate-y-[2px] active:shadow-none text-black border border-cyan-600 shadow-[0_4px_0_#06b6d4,0_6px_12px_rgba(0,0,0,0.4)] hover:shadow-[0_5px_0_#06b6d4,0_8px_16px_rgba(0,0,0,0.5)] hover:-translate-y-0.5";

/**
 * Reference sections formerly in collapsible steps 3 and 6–15 on /ai-revenue-os,
 * grouped under “About this page” so the main stack follows the execution pipeline only.
 */
export function AiRevenueOsAboutThisPage() {
  return (
    <div className="max-w-4xl space-y-14">
      <section id="what-this-system-does" className="scroll-mt-24">
        <h3 className="text-lg font-semibold text-cyan-300">What this system actually does</h3>
        <p className="text-sm text-slate-500 mt-1">
          AI Revenue OS™ is a coordinated engine — not a grab bag of disconnected tools.
        </p>
        <ul className="mt-6 space-y-3 text-gray-300 text-sm leading-relaxed list-none">
          {[
            "Identifies profitable opportunities (demand you can monetize)",
            "Builds revenue-generating offers (structure, transformation, economics)",
            "Creates content that attracts buyers (hooks, angles, platform fit)",
            "Automates execution workflows (content → leads → campaigns with fewer gaps)",
            "Aligns revenue with financial leverage (scaling capacity and capital logic)",
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span className="text-cyan-500 shrink-0">▸</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="why-most-people-fail" className="scroll-mt-24 pt-10 border-t border-cyan-500/20">
        <h3 className="text-lg font-semibold text-cyan-300">Why most people fail</h3>
        <p className="text-sm text-slate-500 mt-1">
          The failure mode is almost never &quot;not enough ideas.&quot; It&apos;s missing execution systems.
        </p>
        <div className="mt-6 rounded-2xl border border-amber-500/35 bg-slate-800/40 p-6">
          <p className="text-gray-200 text-sm leading-relaxed">
            Without repeatable workflows — capture, classification, content, deployment, and feedback — even strong
            positioning decays. This OS is built so intelligence turns into <span className="text-cyan-400 font-medium">consistent action</span>, not one-off output.
          </p>
        </div>
      </section>

      <section id="economic-systems" className="scroll-mt-24 pt-10 border-t border-cyan-500/20">
        <h3 className="text-lg font-semibold text-cyan-300">Structured economic systems</h3>
        <p className="text-sm text-slate-500 mt-1">If your business has measurable structure, it can be optimized.</p>
        <div className="mt-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { title: "Measurable traffic", desc: "Visitors, leads, or pipeline volume you can track." },
              { title: "A defined offer", desc: "Clear value proposition with pricing." },
              { title: "Trackable acquisition cost", desc: "CAC per channel or segment." },
              { title: "Observable conversion behavior", desc: "Close rates, funnel drop-off, AOV." },
            ].map((item) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-slate-800/50 border border-cyan-500/50 rounded-2xl p-6"
              >
                <div className="font-semibold text-cyan-400">{item.title}</div>
                <div className="text-gray-400 text-sm mt-2">{item.desc}</div>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-gray-400 mt-8 text-lg">It can be optimized.</p>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 pt-10 border-t border-cyan-500/20">
        <h3 className="text-lg font-semibold text-cyan-300">How it works</h3>
        <p className="text-sm text-slate-500 mt-1">Six steps from mapping variables to tracked performance.</p>
        <div className="mt-6 max-w-4xl mx-auto space-y-6">
          {HOW_IT_WORKS_STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="flex gap-6 items-start bg-slate-800/50 border border-cyan-500/50 rounded-2xl p-6"
            >
              <div
                className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-black"
                style={{
                  background: "linear-gradient(180deg, #7DF9FF 0%, #00D1FF 100%)",
                  boxShadow: "0 3px 0 #06b6d4",
                }}
              >
                {step.num}
              </div>
              <div>
                <h4 className="text-lg font-semibold text-cyan-400">{step.title}</h4>
                <p className="text-gray-300 mt-2 text-sm leading-relaxed">{step.body}</p>
                {step.cta && step.ctaLabel && (
                  <Link href={step.cta} className="inline-block mt-3 text-sm text-cyan-400 hover:underline font-medium">
                    {step.ctaLabel} →
                  </Link>
                )}
              </div>
            </motion.div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link href="/revenue-os/dashboard">
            <button
              className={btn3dGold}
              style={{
                background: "linear-gradient(180deg, #7DF9FF 0%, #00D1FF 50%, #06b6d4 100%)",
              }}
            >
              Open Dashboard — Run Full Analysis
            </button>
          </Link>
        </div>
      </section>

      <section id="data-governed" className="scroll-mt-24 pt-10 border-t border-cyan-500/20">
        <h3 className="text-lg font-semibold text-cyan-300">Data-Governed Capital Acceleration System™</h3>
        <p className="text-sm text-slate-500 mt-1">Governance, not generic advice — benchmarked, simulated, and tracked.</p>
        <div className="mt-6 rounded-2xl border-2 border-cyan-500 bg-slate-800/50 p-8 md:p-12 text-center">
          <div className="text-sm text-gray-500 uppercase tracking-wider">Strategic Differentiator</div>
          <h4 className="text-2xl md:text-3xl font-bold mt-4" style={{ color: ACCENT }}>
            Data-Governed Capital Acceleration System™
          </h4>
          <p className="text-gray-400 mt-6 max-w-2xl mx-auto text-lg">This is not marketing advice. It is capital governance infrastructure.</p>
          <p className="text-gray-500 mt-4">Benchmarked, simulated, risk-banded, and tracked over time.</p>
        </div>
      </section>

      <section id="roadmap-phases" className="scroll-mt-24 pt-10 border-t border-cyan-500/20">
        <h3 className="text-lg font-semibold text-cyan-300">AI Revenue OS™ — Data-Governed Growth Engine</h3>
        <p className="text-sm text-slate-500 mt-1">
          The difference between &quot;advice&quot; and an operating system is governance: benchmarks, scenarios, risk bands, and
          performance memory.
        </p>
        <div className="mt-6">
          <AiRevenueOsRoadmapSection embedded />
        </div>
      </section>

      <section id="transformation" className="scroll-mt-24 pt-10 border-t border-cyan-500/20">
        <h3 className="text-lg font-semibold text-cyan-300">From guesswork to governance</h3>
        <p className="text-sm text-slate-500 mt-1">Transformation story — before vs after.</p>
        <div className="mt-6 grid md:grid-cols-2 gap-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="bg-slate-800/50 border border-white/10 rounded-2xl p-8"
          >
            <div className="text-sm text-gray-500 uppercase tracking-wider mb-4">Before</div>
            <div className="text-red-400/90 font-semibold mb-2">Chaotic metrics</div>
            <ul className="text-gray-300 space-y-2">
              <li>• Random pricing</li>
              <li>• Inconsistent close rates</li>
              <li>• Unclear CAC thresholds</li>
              <li>• Manual funnel builds</li>
            </ul>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="bg-slate-800/50 border border-cyan-500 rounded-2xl p-8"
          >
            <div className="text-sm text-gray-500 uppercase tracking-wider mb-4">After</div>
            <div className="font-semibold mb-2 text-cyan-400">Structured dashboard</div>
            <ul className="text-gray-300 space-y-2">
              <li>• Modeled revenue delta</li>
              <li>• Defined lever targets</li>
              <li>• Capital governance rules</li>
              <li>• Weekly optimization cycle</li>
            </ul>
          </motion.div>
        </div>
      </section>

      <section id="problem" className="scroll-mt-24 pt-10 border-t border-cyan-500/20">
        <h3 className="text-lg font-semibold text-cyan-300">Why founders plateau</h3>
        <p className="text-sm text-slate-500 mt-1">Revenue stalls from missing structure — not missing effort.</p>
        <div className="mt-6 grid md:grid-cols-2 gap-6">
          {[
            "Guess at pricing (no elasticity model).",
            "Imitate competitors (no gap strategy).",
            "Misallocate capital (no CAC/LTV governance).",
            "Scale manually (no automation layer).",
            "Optimize too late (no iteration engine).",
            "No compounding loop (no system memory).",
          ].map((x) => (
            <div key={x} className="bg-slate-800/50 border border-cyan-500/40 rounded-2xl p-6">
              <div className="text-gray-200">{x}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="architecture" className="scroll-mt-24 pt-10 border-t border-cyan-500/20">
        <h3 className="text-lg font-semibold text-cyan-300">System architecture (technical reference)</h3>
        <p className="text-sm text-slate-500 mt-1">Module map for APIs, tables, and charts — expand only if you need the detail.</p>
        <div className="mt-6">
          <SystemArchitectureModules omitSectionId />
        </div>
      </section>

      <section id="protocol" className="scroll-mt-24 pt-10 border-t border-cyan-500/20">
        <h3 className="text-lg font-semibold text-cyan-300">Step-by-step protocol</h3>
        <p className="text-sm text-slate-500 mt-1">Follow in order with the Road Map / dashboard.</p>
        <div className="mt-6 max-w-4xl mx-auto space-y-6">
          {PROTOCOL_STEPS.map((step, i) => (
            <motion.div
              key={step.num}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="flex gap-6 items-start bg-slate-800/50 border border-cyan-500/50 rounded-2xl p-6"
            >
              <div
                className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-black"
                style={{
                  background: "linear-gradient(180deg, #7DF9FF 0%, #00D1FF 100%)",
                  boxShadow: "0 3px 0 #06b6d4",
                }}
              >
                {step.num}
              </div>
              <div>
                <h4 className="text-lg font-semibold text-cyan-400">{step.title}</h4>
                <p className="text-gray-300 mt-2 text-sm leading-relaxed">{step.body}</p>
                {step.cta && step.ctaLabel && (
                  <Link href={step.cta} className="inline-block mt-3 text-sm text-cyan-400 hover:underline font-medium">
                    {step.ctaLabel} →
                  </Link>
                )}
              </div>
            </motion.div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Link href="/revenue-os/dashboard">
            <button
              className={btn3dGold}
              style={{
                background: "linear-gradient(180deg, #7DF9FF 0%, #00D1FF 50%, #06b6d4 100%)",
              }}
            >
              Start Protocol — Open Dashboard
            </button>
          </Link>
        </div>
      </section>

      <section id="math" className="scroll-mt-24 pt-10 border-t border-cyan-500/20">
        <h3 className="text-lg font-semibold text-cyan-300">Structured revenue math</h3>
        <p className="text-sm text-slate-500 mt-1">Model, lever order, and $1M delta example.</p>
        <div className="mt-6 grid md:grid-cols-2 gap-10">
          <div className="bg-slate-800/50 border border-cyan-500/40 rounded-2xl p-8">
            <div className="text-gray-300 text-lg font-semibold">Revenue Model</div>
            <div className="mt-4 text-gray-400">Revenue = Traffic × Conversion × AOV</div>
            <div className="mt-6 text-gray-300 text-sm space-y-2">
              <div>1) Increase conversion rate (fastest lift)</div>
              <div>2) Raise AOV (offer ladder + upsells)</div>
              <div>3) Scale traffic (only after unit economics hold)</div>
              <div>4) Reduce CAC (capital governance)</div>
            </div>
          </div>
          <div className="bg-slate-800/50 border border-cyan-500 rounded-2xl p-8">
            <div className="text-gray-300 text-lg font-semibold">$1M Delta Example</div>
            <div className="mt-4 text-gray-400 text-sm space-y-2">
              <div>Average ticket: $5,000</div>
              <div>Additional sales: 200</div>
              <div>Close-rate improvement: +9%</div>
              <div>CAC improvement: -18%</div>
            </div>
            <div className="mt-8 text-4xl md:text-5xl font-bold text-cyan-400">+$1,000,000</div>
            <div className="mt-2 text-gray-400 text-sm">Structured execution, not guesswork.</div>
          </div>
        </div>
      </section>

      <section id="who" className="scroll-mt-24 pt-10 border-t border-cyan-500/20">
        <h3 className="text-lg font-semibold text-cyan-300">Who it&apos;s for</h3>
        <p className="text-sm text-slate-500 mt-1">Operators who want compounding execution, not one-off tips.</p>
        <div className="mt-6 grid md:grid-cols-3 gap-6">
          {[
            "Capital Architects",
            "Family Office Builders",
            "High-Ticket Service Operators",
            "Consulting Firms",
            "Web3 Infrastructure Founders",
            "Strategic Advisors",
          ].map((x) => (
            <div key={x} className="bg-slate-800/50 border border-cyan-500/40 rounded-2xl p-6">
              <div className="text-gray-200 font-semibold">{x}</div>
              <div className="text-gray-400 text-sm mt-2">Designed for operators who want an execution system with compounding optimization.</div>
            </div>
          ))}
        </div>
      </section>

      <section id="access" className="scroll-mt-24 pt-10 border-t border-cyan-500/20">
        <h3 className="text-lg font-semibold text-cyan-300">Access model</h3>
        <p className="text-sm text-slate-500 mt-1">Founding cohort, enterprise, and future architect integration.</p>
        <div className="mt-6 grid md:grid-cols-3 gap-6">
          {[
            {
              title: "Founding Operators",
              sub: "Limited to 50",
              body: "Early access + priority roadmap input + direct iteration cycles.",
            },
            {
              title: "Enterprise Deployment",
              sub: "Teams + integrations",
              body: "Operator teams, pipelines, and governance dashboards with role-based access.",
            },
            {
              title: "Architect Integration",
              sub: "Credential + registry",
              body: "Credential verification, renewals, and registry visibility (future phase).",
            },
          ].map((x) => (
            <div key={x.title} className="bg-slate-800/50 border border-cyan-500/50 rounded-2xl p-8">
              <div className="text-cyan-400 font-semibold">{x.title}</div>
              <div className="text-gray-400 text-sm mt-2">{x.sub}</div>
              <div className="text-gray-300 mt-5">{x.body}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const HOW_IT_WORKS_STEPS = [
  { num: 1, title: "Map your revenue variables", body: "Input traffic, conversion rate, and AOV. The equation engine computes modeled revenue in real time.", cta: "#industry-intelligence", ctaLabel: "Try the engine above" },
  { num: 2, title: "Compare to industry benchmarks", body: "See how your conversion and CAC stack up against cited industry medians (HubSpot, McKinsey, etc.).", cta: "#industry-intelligence", ctaLabel: "View benchmarks" },
  { num: 3, title: "Identify highest-leverage variable", body: "The system identifies which lever (traffic, conversion, AOV, CAC) requires the smallest adjustment for maximum impact.", cta: "/revenue-os/dashboard", ctaLabel: "Open Dashboard" },
  { num: 4, title: "Simulate impact", body: "Adjust variables in the Revenue Equation Engine. See delta, implied orders, and compounding annual impact.", cta: "#industry-intelligence", ctaLabel: "Simulate" },
  { num: 5, title: "Deploy structured execution", body: "Follow lever-specific plans: Offer Engineering, Funnel Deployment, Sales Execution, Capital Allocation, Optimization Loop.", cta: "/revenue-os/dashboard", ctaLabel: "Run Analysis" },
  { num: 6, title: "Track performance monthly", body: "Re-run the analysis weekly. Save snapshots. The OS remembers what worked.", cta: "/revenue-os/dashboard", ctaLabel: "Dashboard" },
];

const PROTOCOL_STEPS = [
  {
    num: 1,
    title: "Input Your Current Numbers",
    body: "Open the Revenue OS Dashboard and enter your real business metrics: current monthly revenue, target revenue, traffic, conversion rate, AOV, CAC, and LTV. Use your best available data—accuracy here drives better recommendations.",
    cta: "/revenue-os/dashboard",
    ctaLabel: "Open Dashboard",
  },
  {
    num: 2,
    title: "Run the Analysis",
    body: "Click Run Analysis. The AI models your revenue equation, computes the delta to your target, and identifies which lever requires the smallest relative adjustment for maximum impact.",
    cta: "/revenue-os/dashboard",
    ctaLabel: "Run Analysis",
  },
  {
    num: 3,
    title: "Focus on the Recommended Lever",
    body: "Check the Primary Focus Lever card. Start with that lever first—it gives you the highest ROI on effort. Traffic, Conversion, AOV, or CAC: the system tells you which to optimize.",
  },
  {
    num: 4,
    title: "Execute the Plan",
    body: "Review the lever-specific plans: Offer Engineering, Funnel Deployment, Sales Execution, Capital Allocation, and Optimization Loop. Pick 1–2 high-impact actions and implement them this week.",
  },
  {
    num: 5,
    title: "Re-run Weekly",
    body: "Update your dashboard inputs as your numbers change. Re-run the analysis weekly. Track your progress toward the target. The compounding loop improves over time as your data improves.",
  },
];
