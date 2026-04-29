"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Parallax depth layers behind the existing canvas particle system (z-[1]).
 * CSS transforms only; one rAF-coalesced mouse update; respects prefers-reduced-motion.
 */
export function LandingParallaxDepth() {
  const reduced = useReducedMotion();
  const [scrollY, setScrollY] = useState(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);
  const scrollRaf = useRef<number | null>(null);
  const pendingMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onScroll = () => {
      if (scrollRaf.current != null) return;
      scrollRaf.current = requestAnimationFrame(() => {
        scrollRaf.current = null;
        setScrollY(window.scrollY);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollRaf.current != null) cancelAnimationFrame(scrollRaf.current);
    };
  }, []);

  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsCompact(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (reduced) return;
    const onMove = (e: MouseEvent) => {
      pendingMouse.current = {
        x: e.clientX / Math.max(window.innerWidth, 1) - 0.5,
        y: e.clientY / Math.max(window.innerHeight, 1) - 0.5,
      };
      if (raf.current != null) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        const p = pendingMouse.current;
        setMouse({ x: p.x, y: p.y });
      });
    };
    document.documentElement.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      document.documentElement.removeEventListener("mousemove", onMove);
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [reduced]);

  const parallaxScale = isCompact ? 0.55 : 1;
  const mx = reduced ? 0 : mouse.x * (isCompact ? 7 : 12);
  const my = reduced ? 0 : mouse.y * (isCompact ? 5 : 9);
  const s = reduced ? 0 : scrollY * parallaxScale;

  const tSlow = `translate3d(${mx * 0.35}px, ${s * -0.11 + my * 0.15}px, 0)`;
  const tMid = `translate3d(${mx * -0.28}px, ${s * -0.07 + my * -0.12}px, 0)`;
  const tFast = `translate3d(${mx * 0.18}px, ${s * -0.045 + my * 0.08}px, 0)`;

  const layerDim = isCompact ? 0.68 : 1;

  return (
    <div
      className="landing-parallax-depth-wrap pointer-events-none absolute inset-0 z-[1] overflow-hidden"
      style={{ opacity: layerDim }}
      aria-hidden
    >
      <div
        className="absolute -left-1/4 top-0 h-[85vh] w-[70vw] rounded-full opacity-[0.54] blur-3xl will-change-transform"
        style={{
          transform: tSlow,
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(0, 209, 255, 0.165) 0%, transparent 62%)",
        }}
      />
      <div
        className="absolute -right-1/3 bottom-0 h-[70vh] w-[65vw] rounded-full opacity-[0.42] blur-3xl will-change-transform"
        style={{
          transform: tMid,
          background:
            "radial-gradient(ellipse at 50% 60%, rgba(139, 92, 246, 0.205) 0%, transparent 65%)",
        }}
      />

      <div
        className="absolute left-[8%] top-[18%] h-24 w-24 rotate-12 rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.035] shadow-[0_0_28px_rgba(0,209,255,0.07)] will-change-transform"
        style={{
          transform: `${tMid} rotate(${12 + (reduced ? 0 : mouse.x * (isCompact ? 2.5 : 3.5))}deg)`,
        }}
      />
      <div
        className="absolute right-[12%] top-[42%] h-16 w-16 -rotate-6 rounded-full border border-fuchsia-400/[0.07] bg-fuchsia-500/[0.035] will-change-transform"
        style={{ transform: tFast }}
      />
      <div
        className="absolute bottom-[22%] left-[22%] h-3 w-40 rounded-full bg-gradient-to-r from-transparent via-cyan-400/18 to-transparent blur-sm will-change-transform"
        style={{ transform: tSlow }}
      />

      <div
        className="absolute inset-0 opacity-[0.26] will-change-transform"
        style={{
          transform: tFast,
          backgroundImage: `repeating-linear-gradient(
            105deg,
            transparent 0px,
            transparent 14px,
            rgba(0, 209, 255, 0.045) 14px,
            rgba(0, 209, 255, 0.045) 16px
          )`,
          maskImage: "linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 18%, black 82%, transparent)",
          filter: "blur(1.2px)",
        }}
      />
    </div>
  );
}
