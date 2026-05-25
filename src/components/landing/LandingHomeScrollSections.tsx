"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  useSpring,
} from "framer-motion";
import { landingCtaMetadata, LANDING_HOME_SITE_EVENTS } from "@/lib/analytics/landing-site-event-metadata";
import { trackSiteEvent } from "@/lib/analytics/site-analytics-client";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.05 * i + 0.04,
      duration: 0.88,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  }),
};

const PLATFORM_CARDS = [
  {
    title: "Unified execution layer",
    what: "AI-assisted marketing, campaigns, and business tooling share one workspace—not scattered tabs.",
    outcome: "Ship faster with fewer handoffs and clearer ownership.",
  },
  {
    title: "Token-aware access",
    what: "Membership, releases, and premium flows can be gated with verifiable access rules.",
    outcome: "Monetize and protect experiences without bolting on a separate stack.",
  },
  {
    title: "Composable automation",
    what: "Repeatable workflows connect marketing, operations, and delivery as you grow.",
    outcome: "Scale process without re-platforming every six months.",
  },
] as const;

const TIMELINE = [
  { phase: "Define", detail: "Align offer, audience, and measurable targets." },
  { phase: "Blueprint", detail: "Map journeys, creative, and instrumentation before spend." },
  { phase: "Ship", detail: "Launch campaigns with controls you can read in real time." },
  { phase: "Refine", detail: "Tune creative, spend, and funnel from live signals." },
  { phase: "Extend", detail: "Reuse the same spine across channels and programs." },
] as const;

const STORY_STEPS = [
  { title: "Core business", sub: "Baseline" },
  { title: "GTM & AI marketing", sub: "Demand" },
  { title: "Performance", sub: "Growth" },
  { title: "Automation", sub: "Systems" },
  { title: "Expansion", sub: "Reach" },
] as const;

function SectionShell({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="landing-story-section relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20"
    >
      <div className="mb-8 text-center sm:mb-11">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
          {eyebrow}
        </p>
        <h2 className="text-balance text-2xl font-bold leading-tight text-white sm:text-3xl">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export function LandingHomeScrollSections() {
  const reduced = useReducedMotion();
  const storyRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress: storyProgress } = useScroll({
    target: storyRef,
    offset: ["start end", "end start"],
  });

  const { scrollYProgress: timelineProgress } = useScroll({
    target: timelineRef,
    offset: ["start 75%", "end 25%"],
  });

  const smoothStory = useSpring(storyProgress, {
    stiffness: 72,
    damping: 32,
    mass: 0.48,
  });

  const trackX = useTransform(smoothStory, [0, 1], reduced ? [0, 0] : ["8%", "-42%"]);

  const lineScale = useTransform(timelineProgress, [0, 1], [0, 1]);

  return (
    <div className="relative z-10 mt-2 border-t border-white/10 bg-gradient-to-b from-transparent via-slate-950/35 to-slate-950/90 pt-14 sm:pt-24">
      {/* What this platform does */}
      <SectionShell
        id="platform-value"
        eyebrow="Overview"
        title="Run AI marketing, infrastructure, and access in one place"
      >
        <div className="grid gap-6 sm:grid-cols-3">
          {PLATFORM_CARDS.map((c, i) => (
            <motion.article
              key={c.title}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
              className="landing-polish-card group rounded-2xl border border-cyan-400/12 bg-black/35 p-6 shadow-[0_0_0_1px_rgba(0,209,255,0.05)] backdrop-blur-md transition-[transform,box-shadow,border-color] duration-500 ease-out will-change-transform hover:z-[1] hover:scale-[1.008] hover:border-cyan-400/28 hover:shadow-[0_10px_40px_rgba(0,209,255,0.08)]"
            >
              <h3 className="mb-3 text-lg font-semibold leading-snug text-cyan-100">{c.title}</h3>
              <p className="text-sm leading-relaxed text-slate-300">{c.what}</p>
              <p className="mt-3 border-t border-white/5 pt-3 text-xs font-medium leading-relaxed text-slate-500">
                {c.outcome}
              </p>
            </motion.article>
          ))}
        </div>
      </SectionShell>

      {/* Timeline */}
      <SectionShell
        id="execution-path"
        eyebrow="Workflow"
        title="From defined offer to live revenue—without losing the thread"
      >
        <div ref={timelineRef} className="relative">
          <div className="mb-10 overflow-x-auto pb-2">
            <div className="relative min-w-[720px] px-2 sm:min-w-0">
              <div
                className="absolute left-0 right-0 top-[22px] h-px bg-white/10"
                aria-hidden
              />
              <motion.div
                className="absolute left-0 top-[22px] h-px origin-left bg-gradient-to-r from-cyan-400/90 via-sky-400/80 to-fuchsia-400/80 shadow-[0_0_8px_rgba(0,209,255,0.28)] will-change-transform"
                style={{ scaleX: lineScale }}
              />
              <div className="relative flex justify-between gap-3">
                {TIMELINE.map((step, i) => (
                  <motion.div
                    key={step.phase}
                    custom={i}
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: "-40px" }}
                    className="flex max-w-[11rem] flex-1 flex-col items-center text-center"
                  >
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-cyan-400/28 bg-slate-950/80 text-xs font-bold text-cyan-200/95 shadow-[0_0_14px_rgba(0,209,255,0.14)]">
                      {i + 1}
                    </div>
                    <p className="text-sm font-semibold text-white">{step.phase}</p>
                    <p className="mt-1.5 text-xs leading-snug text-slate-500">{step.detail}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SectionShell>

      {/* Why different */}
      <SectionShell
        id="why-different"
        eyebrow="Proof"
        title="Built for operators—not another reporting toy"
      >
        <div className="mx-auto max-w-xl space-y-4 text-center sm:max-w-2xl sm:space-y-5">
          {[
            "Most stacks **stop at visibility**—this one is wired for shipping, measuring, and iterating in production.",
            "**AI marketing and automation** sit on shared business context, not orphaned point tools.",
            "**Financial readiness** stays attached to workflows—so decisions match how money actually moves.",
            "**Token-aware access** is native: membership and premium surfaces inherit the same rules.",
          ].map((line, i) => (
            <motion.p
              key={i}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              className="text-[15px] leading-relaxed text-slate-300 sm:text-base"
            >
              {line.split("**").map((chunk, j) =>
                j % 2 === 1 ? (
                  <span
                    key={j}
                    className="font-semibold text-cyan-100/95 [text-shadow:0_0_18px_rgba(0,209,255,0.18)]"
                  >
                    {chunk}
                  </span>
                ) : (
                  chunk
                )
              )}
            </motion.p>
          ))}
        </div>
      </SectionShell>

      {/* Horizontal story strip */}
      <section
        ref={storyRef}
        className="relative min-h-[28rem] mx-auto max-w-6xl px-4 py-24 sm:px-6"
        aria-labelledby="story-strip-heading"
      >
        <div className="mb-10 text-center">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
            Trajectory
          </p>
          <h2
            id="story-strip-heading"
            className="text-balance text-2xl font-bold leading-tight text-white sm:text-3xl"
          >
            Stabilize the business, then compound demand and systems
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-500">
            Scroll moves the strip—baseline → go-to-market → growth → automation → expansion.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 py-10 backdrop-blur-md">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950 via-transparent to-slate-950 opacity-90" />
          <motion.div
            className="relative flex w-[140%] gap-4 px-4 sm:w-full sm:gap-6"
            style={{ x: trackX }}
          >
            {STORY_STEPS.map((s) => (
              <div
                key={s.title}
                className="landing-polish-card min-w-[10.5rem] flex-1 rounded-xl border border-cyan-400/14 bg-slate-950/60 p-5 text-center shadow-[0_0_20px_rgba(0,209,255,0.05)] transition-[transform,box-shadow,border-color] duration-500 ease-out hover:-translate-y-0.5 hover:border-cyan-400/28 hover:shadow-[0_12px_40px_rgba(0,209,255,0.09)]"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {s.sub}
                </p>
                <p className="mt-2 text-lg font-bold text-cyan-50">{s.title}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <div className="mx-auto max-w-lg px-4 pb-16 pt-6 text-center sm:px-6 sm:pb-20">
        <p className="text-sm leading-relaxed text-slate-500">
          Use <span className="text-slate-400">Register</span> or <span className="text-slate-400">Login</span>{" "}
          above to enter the workspace.{" "}
          <span className="font-medium text-slate-400">DEMOS</span> maps industry paths;{" "}
          <span className="font-medium text-slate-400">Welcome</span> holds community, Revenue OS, and
          consultations—entry stays in the header; nothing here competes with it.
        </p>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
          <a
            href="/mission-statement"
            className="text-cyan-300/90 underline-offset-4 hover:text-cyan-200 hover:underline"
            onClick={() =>
              void trackSiteEvent({
                path: "/",
                eventType: "button_click",
                metadata: {
                  ...landingCtaMetadata({
                    eventName: LANDING_HOME_SITE_EVENTS.SCROLL_MISSION_LINK,
                    source: "landing_scroll_sections",
                    route: "/",
                    label: "Mission",
                    targetHref: "/mission-statement",
                  }),
                },
              })
            }
          >
            Mission
          </a>
          <span className="text-slate-600">·</span>
          <a
            href="/mission-path"
            className="text-cyan-300/90 underline-offset-4 hover:text-cyan-200 hover:underline"
            onClick={() =>
              void trackSiteEvent({
                path: "/",
                eventType: "button_click",
                metadata: {
                  ...landingCtaMetadata({
                    eventName: LANDING_HOME_SITE_EVENTS.SCROLL_VISION_LINK,
                    source: "landing_scroll_sections",
                    route: "/",
                    label: "Vision path",
                    targetHref: "/mission-path",
                  }),
                },
              })
            }
          >
            Vision path
          </a>
          <span className="text-slate-600">·</span>
          <a
            href="/worlds"
            className="text-cyan-300/90 underline-offset-4 hover:text-cyan-200 hover:underline"
            onClick={() =>
              void trackSiteEvent({
                path: "/",
                eventType: "button_click",
                metadata: {
                  ...landingCtaMetadata({
                    eventName: LANDING_HOME_SITE_EVENTS.SCROLL_WORLDS_LINK,
                    source: "landing_scroll_sections",
                    route: "/",
                    label: "Worlds",
                    targetHref: "/worlds",
                  }),
                },
              })
            }
          >
            Worlds
          </a>
        </p>
      </div>
    </div>
  );
}
