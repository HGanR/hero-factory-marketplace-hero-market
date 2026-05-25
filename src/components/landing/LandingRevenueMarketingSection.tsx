"use client";

import Link from "next/link";
import { landingCtaMetadata, LANDING_HOME_SITE_EVENTS } from "@/lib/analytics/landing-site-event-metadata";
import { trackSiteEvent } from "@/lib/analytics/site-analytics-client";

const cardSurface =
  "rounded-xl border border-white/10 bg-black/35 p-4 shadow-[0_4px_24px_rgba(0,0,0,0.35)] backdrop-blur-sm";

/**
 * Marketing block between navbar and auth card — client instrumentation for CTA analytics.
 */
export function LandingRevenueMarketingSection() {
  return (
    <section
      className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-10 pt-12 pb-8 md:pt-14 md:pb-10"
      aria-label="Revenue system overview"
    >
      <div className="max-w-3xl space-y-4 md:space-y-5">
        <h2 className="text-balance text-3xl font-semibold tracking-tight text-white [text-shadow:0_2px_20px_rgba(0,0,0,0.55)] sm:text-4xl md:text-5xl lg:text-6xl">
          We Install a Revenue System Into Your Business
        </h2>
        <p className="text-base leading-relaxed text-white/80 md:text-lg lg:text-xl [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]">
          AI marketing. Automation. Client acquisition.
          <br />
          All running for you — not by you.
        </p>
        <a
          href="#hero-auth"
          className="mt-2 inline-flex px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-medium shadow-lg shadow-black/30 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
          onClick={() =>
            void trackSiteEvent({
              path: "/",
              eventType: "button_click",
              metadata: {
                ...landingCtaMetadata({
                  eventName: LANDING_HOME_SITE_EVENTS.REVENUE_SECTION_CTA,
                  source: "revenue_marketing_section",
                  route: "/",
                  label: "Get your system installed",
                  targetHref: "#hero-auth",
                }),
              },
            })
          }
        >
          Get Your System Installed
        </a>
      </div>

      <div className="mt-10 grid max-w-5xl grid-cols-1 gap-8 md:mt-12 md:grid-cols-2 md:gap-10">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.5)] sm:text-xl">
            Most businesses are:
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/75 sm:text-base">
            <li>• Posting content with no strategy</li>
            <li>• Chasing leads manually</li>
            <li>• Running without a system</li>
          </ul>
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.5)] sm:text-xl">
            Result:
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/75 sm:text-base">
            <li>• Inconsistent income</li>
            <li>• Burnout</li>
            <li>• No scalability</li>
          </ul>
        </div>
      </div>

      <div className="mt-12 max-w-6xl md:mt-14">
        <h3 className="text-xl font-semibold text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.5)] sm:text-2xl md:text-3xl">
          THE AI REVENUE SYSTEM
        </h3>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-6 lg:grid-cols-4 lg:gap-5">
          <div className={cardSurface}>
            <p className="font-medium text-white">Traffic Engine</p>
            <p className="mt-1 text-sm text-white/70">Content + campaigns</p>
          </div>
          <div className={cardSurface}>
            <p className="font-medium text-white">Conversion Engine</p>
            <p className="mt-1 text-sm text-white/70">Funnels</p>
          </div>
          <div className={cardSurface}>
            <p className="font-medium text-white">Automation Engine</p>
            <p className="mt-1 text-sm text-white/70">AI agents</p>
          </div>
          <div className={cardSurface}>
            <p className="font-medium text-white">Revenue Engine</p>
            <p className="mt-1 text-sm text-white/70">Offers + monetization</p>
          </div>
        </div>
      </div>

      <div className="mt-12 max-w-5xl md:mt-14">
        <h3 className="text-xl font-semibold text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.5)] sm:text-2xl">
          What We Install
        </h3>
        <div className="mt-5 grid grid-cols-1 gap-4 text-sm leading-relaxed text-white/80 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-3 sm:text-base">
          <p className="min-w-0">
            <strong className="font-semibold text-white">Automated marketing engine</strong> — replaces
            manual outreach
          </p>
          <p className="min-w-0">
            <strong className="font-semibold text-white">Business automation</strong> — eliminates
            repetitive work
          </p>
          <p className="min-w-0">
            <strong className="font-semibold text-white">Digital business presence</strong> — modern 3D /
            web positioning
          </p>
          <p className="min-w-0">
            <strong className="font-semibold text-white">Financial stability system</strong> — supports
            long-term growth
          </p>
        </div>
      </div>

      <div className="mt-12 max-w-3xl md:mt-14">
        <h3 className="text-xl font-semibold text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.5)] sm:text-2xl">
          What You Get
        </h3>
        <ul className="mt-4 space-y-2 text-sm text-white/75 sm:text-base">
          <li>• Full system installation</li>
          <li>• AI marketing setup</li>
          <li>• Automation + lead handling</li>
          <li>• Campaign launch</li>
        </ul>
        <div className="mt-6 space-y-4 text-white/85">
          <p className="text-base font-medium leading-relaxed text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.45)] sm:text-lg">
            Start with a contribution you can afford — you name your price and we build a custom package that fits your
            budget.
          </p>
          <p className="text-base leading-relaxed text-white/90 sm:text-lg">
            We help you make <span className="font-semibold text-cyan-200">$100k–$1 million</span> and you can pay as
            little as <span className="font-semibold text-cyan-200">1% of that per year</span>.
          </p>
          <p className="text-sm leading-relaxed text-white/60 sm:text-base">
            This price is paid through the revenue we help you make.
          </p>
        </div>
      </div>

      <div className="mt-12 max-w-4xl space-y-1.5 text-sm text-white/70 md:mt-14 sm:text-base">
        <p>Built for operators.</p>
        <p>Designed to replace multiple tools.</p>
        <p>Systemized for scale.</p>
      </div>

      <div className="mt-12 max-w-6xl md:mt-14">
        <div className={`${cardSurface} relative overflow-hidden md:flex md:items-center md:justify-between md:gap-8`}>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-300/90">AI Agency</p>
            <h3 className="mt-2 text-xl font-semibold text-white [text-shadow:0_1px_14px_rgba(0,0,0,0.5)] sm:text-2xl">
              Custom AI agents + website + admin + analytics
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
              Close more sales, filter unwanted conversations, and get your time back — a virtual assistant trained for
              your business.
            </p>
          </div>
          <div className="mt-5 shrink-0 md:mt-0">
            <Link
              href="/ai-agent-services"
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/30 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 md:w-auto"
              onClick={() =>
                void trackSiteEvent({
                  path: "/",
                  eventType: "button_click",
                  metadata: {
                    ...landingCtaMetadata({
                      eventName: LANDING_HOME_SITE_EVENTS.REVENUE_SECTION_CTA,
                      source: "revenue_marketing_section",
                      route: "/",
                      label: "Explore AI agent services",
                      targetHref: "/ai-agent-services",
                    }),
                  },
                })
              }
            >
              Explore AI Agent Services
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-8 md:mt-10">
        <Link
          href="/consultations"
          className="inline-flex px-8 py-4 rounded-xl bg-purple-600 text-white font-semibold shadow-lg shadow-black/25 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
          onClick={() =>
            void trackSiteEvent({
              path: "/",
              eventType: "conversion_intent",
              metadata: {
                ...landingCtaMetadata({
                  eventName: LANDING_HOME_SITE_EVENTS.REVENUE_SECTION_CTA,
                  source: "revenue_marketing_section",
                  route: "/",
                  label: "Book a strategy call",
                  targetHref: "/consultations",
                }),
              },
            })
          }
        >
          Book a Strategy Call
        </Link>
      </div>
    </section>
  );
}
