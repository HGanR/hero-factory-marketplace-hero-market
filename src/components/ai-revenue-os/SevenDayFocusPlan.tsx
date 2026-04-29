"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const GOLD = "#D4AF37";

type Lever = "conversion" | "aov" | "traffic";

const LEVER_ACTIONS: Record<Lever, string[]> = {
  conversion: [
    "Tighten headline–one clear outcome, one audience.",
    "Single above-fold CTA with urgency.",
    "Clarify offer: what, how much, what they get.",
    "Add proof stack: testimonials, logos, results.",
    "Address top objection in copy or FAQ.",
  ],
  aov: [
    "Bundle 2–3 offers into a higher-ticket package.",
    "Add one-click upsell at checkout.",
    "Define pricing ladder: Core / Premium / Ascension.",
    "Reframe guarantee (risk reversal) around value.",
    "Test one premium anchor this week.",
  ],
  traffic: [
    "Pick one channel to double down on this week.",
    "List 5 partners or affiliates who can refer.",
    "Turn on or refine retargeting (past visitors).",
    "Launch one lead magnet and capture email.",
    "Audit top traffic source and fix one leak.",
  ],
};

export function SevenDayFocusPlan({ lever }: { lever: Lever }) {
  const bullets = LEVER_ACTIONS[lever] ?? LEVER_ACTIONS.conversion;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.05 }}
      className="mt-6 rounded-2xl border border-[#D4AF37]/50 bg-black/50 p-6"
    >
      <div className="text-sm font-semibold mb-4" style={{ color: GOLD }}>
        Next 7 Days
      </div>
      <ul className="space-y-2 text-gray-300 text-sm">
        {bullets.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-[#D4AF37] flex-shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/revenue-os/dashboard"
        className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-black text-sm transition-all hover:opacity-90"
        style={{
          background: "linear-gradient(180deg, #F5C518 0%, #D4AF37 100%)",
          boxShadow: "0 3px 0 #B8860B",
        }}
      >
        Run Full Analysis →
      </Link>
    </motion.div>
  );
}
