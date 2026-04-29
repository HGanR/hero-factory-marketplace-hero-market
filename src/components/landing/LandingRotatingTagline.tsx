"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const TAGLINES = [
  "AI marketing, campaigns, automation—one coordinated layer",
  "Operational infrastructure you run—not a patchwork of tools",
  "Financial readiness tied to live workflows—not static reports",
  "Token-gated access for premium digital products",
];

export function LandingRotatingTagline() {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const t = window.setInterval(() => {
      setI((v) => (v + 1) % TAGLINES.length);
    }, 4800);
    return () => window.clearInterval(t);
  }, [reduced]);

  if (reduced) {
    return (
      <p className="mb-0.5 min-h-[1rem] text-center text-[10px] font-normal tracking-wide text-slate-500">
        {TAGLINES[0]}
      </p>
    );
  }

  return (
    <div className="mb-0.5 min-h-[1rem] text-center">
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={TAGLINES[i]}
          className="text-[10px] font-normal tracking-wide text-slate-500"
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          {TAGLINES[i]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
