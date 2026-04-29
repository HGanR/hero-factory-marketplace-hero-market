"use client";

import { motion } from "framer-motion";

const ACCENT = "#00D1FF";

const SYSTEMS: { title: string; bullets: [string, string] }[] = [
  {
    title: "Opportunity Engine",
    bullets: [
      "Finds real problems people are actively searching for",
      "Maps demand → monetization potential",
    ],
  },
  {
    title: "Offer Engine",
    bullets: [
      "Converts problems into structured, sellable offers",
      "Defines transformation + pricing logic",
    ],
  },
  {
    title: "Traffic Engine",
    bullets: [
      "Generates short-form + long-form content",
      "Hooks, angles, platform strategy",
    ],
  },
  {
    title: "Execution Engine",
    bullets: [
      "Automates workflows (content → leads → campaigns)",
      "Removes inconsistency and manual gaps",
    ],
  },
  {
    title: "Capital Engine",
    bullets: [
      "Aligns revenue with financial leverage systems",
      "Credit, entity structuring, scaling capacity",
    ],
  },
];

export function SystemModelOverview() {
  return (
    <section
      id="five-system-revenue-engine"
      className="scroll-mt-24 border-t border-cyan-500/25 pt-10 pb-4"
      aria-labelledby="five-system-heading"
    >
      <div className="max-w-6xl mx-auto px-6">
        <h2 id="five-system-heading" className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          Five-system revenue engine
        </h2>
        <p className="mt-2 text-lg text-slate-300 max-w-3xl">
          AI Revenue OS coordinates five engines — not isolated tools — so execution compounds instead of stalling.
        </p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {SYSTEMS.map((sys, i) => (
            <motion.article
              key={sys.title}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              whileHover={{ y: -3, transition: { duration: 0.18 } }}
              className="rounded-xl border border-cyan-500/35 bg-slate-900/60 p-4 shadow-sm hover:border-cyan-400/50 hover:bg-slate-900/80"
            >
              <h3 className="text-sm font-semibold leading-snug" style={{ color: ACCENT }}>
                {sys.title}
              </h3>
              <ul className="mt-3 space-y-2 text-xs text-slate-400 leading-relaxed">
                <li>• {sys.bullets[0]}</li>
                <li>• {sys.bullets[1]}</li>
              </ul>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
