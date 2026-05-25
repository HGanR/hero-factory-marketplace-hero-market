"use client";

import Link from "next/link";
import { useCallback } from "react";
import { motion } from "framer-motion";

const ACCENT = "#00D1FF";
const ACCENT_SOFT = "#7DF9FF";
const VIOLET = "#a78bfa";

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
};

function GlowOrb({ className }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute rounded-full blur-3xl opacity-40 ${className ?? ""}`}
      style={{
        background: `radial-gradient(circle, ${ACCENT} 0%, ${VIOLET} 45%, transparent 70%)`,
      }}
      aria-hidden
    />
  );
}

function PlaceholderPayButton({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title="Payment link coming soon"
      className={`inline-flex items-center justify-center font-semibold transition-transform active:scale-[0.98] ${className}`}
    >
      {children}
    </button>
  );
}

function SectionShell({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </section>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-xl backdrop-blur-md ${className}`}
      style={{ boxShadow: `0 0 0 1px rgba(0,209,255,0.06), 0 20px 50px -20px rgba(0,0,0,0.5)` }}
    >
      {children}
    </div>
  );
}

function HeroMockVisual() {
  const platforms = ["Instagram", "TikTok", "Facebook", "Twitch", "Custom RTMP"];
  return (
    <div className="relative mt-10 lg:mt-0">
      <div
        className="relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-slate-900/90 via-slate-950 to-black p-4 sm:p-6"
        style={{ boxShadow: `0 0 80px -20px ${ACCENT}55` }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(0,209,255,0.06)_50%,transparent_60%)] pointer-events-none animate-pulse" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-cyan-300/90">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden />
              Live — TroothHurts Meets™
            </div>
            <div className="aspect-video max-h-[200px] rounded-xl border border-white/10 bg-black/60 flex items-center justify-center">
              <div className="text-center px-4">
                <p className="text-sm text-slate-400">Meeting room + broadcast canvas</p>
                <p className="mt-1 text-lg font-semibold text-white">Private session</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {platforms.map((p) => (
                <span
                  key={p}
                  className="rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3 py-1 text-xs font-medium text-cyan-100/90"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
          <div className="shrink-0 sm:max-w-[200px]">
            <div
              className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-center backdrop-blur-sm"
              style={{ boxShadow: `0 0 24px ${ACCENT}22` }}
            >
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-500/10">
                <svg className="h-6 w-6 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-200">NFT Verified Access</p>
              <p className="mt-1 text-[10px] leading-snug text-emerald-100/70">Wallet checked before entry</p>
            </div>
          </div>
        </div>
        <svg className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 text-cyan-500/20" preserveAspectRatio="none" aria-hidden>
          <path d="M0,8 Q120,0 240,6 T480,4 T720,7 T960,3 L960,16 L0,16 Z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

export function TroothhurtsMeetsLanding() {
  const scrollToHow = useCallback(() => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#030712] text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <GlowOrb className="-left-32 top-20 h-96 w-96" />
        <GlowOrb className="right-0 top-1/3 h-[28rem] w-[28rem] opacity-25" />
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `linear-gradient(rgba(0,209,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,209,255,0.05) 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      <header className="relative z-10 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-sm font-semibold tracking-tight text-white/90 hover:text-cyan-200">
            TROOTHHURTZ
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <button type="button" onClick={scrollToHow} className="text-slate-400 hover:text-cyan-200">
              How it works
            </button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <SectionShell className="relative z-10 pb-8 pt-12 sm:pt-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <motion.div {...fadeUp}>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/30 px-3 py-1 text-xs font-medium text-cyan-200/90">
              Zoom + OBS + Web3 access control + revenue system
            </p>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Host Private Meetings.{" "}
              <span style={{ color: ACCENT_SOFT }}>Broadcast Everywhere.</span>{" "}
              <span className="text-white">Control Who Gets In.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              TroothHurts Meets™ gives creators, entrepreneurs, coaches, agencies, and Web3 communities a private
              meeting room, live broadcast studio, and NFT-gated access system in one platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PlaceholderPayButton className="rounded-xl bg-gradient-to-b from-cyan-300 to-cyan-600 px-6 py-3.5 text-slate-950 shadow-[0_4px_0_#0e7490] hover:brightness-110">
                Unlock Meets Access
              </PlaceholderPayButton>
              <button
                type="button"
                onClick={scrollToHow}
                className="rounded-xl border border-cyan-500/50 bg-white/5 px-6 py-3.5 font-semibold text-cyan-100 hover:bg-cyan-950/40"
              >
                See How It Works
              </button>
            </div>
            <div className="mt-10 flex flex-wrap gap-2">
              {["Private Meetings", "Multi-Platform Broadcasts", "NFT-Gated Access", "Live Show Controls"].map((t) => (
                <span
                  key={t}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300"
                >
                  {t}
                </span>
              ))}
            </div>
          </motion.div>
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.08 }}>
            <HeroMockVisual />
          </motion.div>
        </div>
      </SectionShell>

      {/* Problem */}
      <SectionShell className="relative z-10 border-t border-white/5 bg-black/20">
        <motion.div {...fadeUp}>
          <h2 className="text-2xl font-bold sm:text-3xl md:text-center">Regular Meeting Links Are Too Easy to Share.</h2>
          <p className="mx-auto mt-4 max-w-3xl text-center text-slate-400 leading-relaxed">
            Most video platforms were built for convenience, not controlled access. If someone gets the link, they can
            often pass it around. For paid events, private communities, investor calls, coaching sessions, Web3 holder
            meetings, and exclusive broadcasts, that creates a major problem.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Shared links leak private content",
              "Creators need better access control",
              "Hosts rely on too many disconnected tools",
              "Going live requires complicated software",
              "Paid communities need verified entry",
            ].map((text) => (
              <GlassCard key={text}>
                <p className="text-sm font-medium text-slate-200">{text}</p>
              </GlassCard>
            ))}
          </div>
        </motion.div>
      </SectionShell>

      {/* Solution */}
      <SectionShell id="how-it-works" className="relative z-10">
        <motion.div {...fadeUp}>
          <h2 className="text-2xl font-bold sm:text-3xl">Meetings, Broadcasting, and Access Control — In One System.</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {[
              {
                title: "Private Meeting Rooms",
                body: "Host client calls, group sessions, community meetings, and premium live events from a dedicated meeting room.",
                icon: "users",
              },
              {
                title: "Live Broadcast Studio",
                body: "Turn a meeting into a live broadcast with scenes, overlays, countdowns, and professional show controls.",
                icon: "monitor",
              },
              {
                title: "Multi-Platform Streaming",
                body: "Broadcast to TikTok, Instagram, Facebook, Twitch, Pump.fun, and custom RTMP destinations from one control surface.",
                icon: "broadcast",
              },
              {
                title: "NFT-Gated Access",
                body: "Restrict entry using NFT/token ownership so only verified holders can access premium rooms or exclusive streams.",
                icon: "lock",
              },
            ].map((f) => (
              <GlassCard key={f.title} className="group hover:border-cyan-500/25 transition-colors">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                  {f.icon === "users" && (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  )}
                  {f.icon === "monitor" && (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  )}
                  {f.icon === "broadcast" && (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                  {f.icon === "lock" && (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
              </GlassCard>
            ))}
          </div>
        </motion.div>
      </SectionShell>

      {/* NFT section */}
      <SectionShell className="relative z-10 border-t border-white/5">
        <motion.div {...fadeUp} className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Stop Selling Access That Anyone Can Forward.</h2>
            <p className="mt-4 text-slate-400 leading-relaxed">
              With NFT-gated access, your audience does not just need a link — they need verification. This helps protect
              paid content, private events, member-only communities, and Web3 experiences.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-slate-300">
              {[
                "Verify wallet ownership before entry",
                "Gate rooms by NFT collection or token access",
                "Reduce unauthorized link sharing",
                "Build premium holder-only broadcasts",
                "Create exclusive digital experiences",
              ].map((b) => (
                <li key={b} className="flex gap-3">
                  <span className="mt-0.5 text-cyan-400" aria-hidden>
                    ✓
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <PlaceholderPayButton className="rounded-xl border border-violet-400/50 bg-violet-950/40 px-6 py-3 text-violet-100 hover:bg-violet-900/50">
                Create a Verified Access Experience
              </PlaceholderPayButton>
            </div>
          </div>
          <GlassCard className="relative overflow-hidden">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="relative flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-violet-400/40 bg-gradient-to-br from-violet-600/30 to-cyan-600/20">
                <svg className="h-10 w-10 text-violet-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-violet-200">Token-gated rooms</p>
              <p className="mt-2 max-w-xs text-xs text-slate-500">Unauthorized viewers cannot simply share links past your gate.</p>
            </div>
          </GlassCard>
        </motion.div>
      </SectionShell>

      {/* Broadcast features */}
      <SectionShell className="relative z-10">
        <motion.div {...fadeUp}>
          <h2 className="text-2xl font-bold sm:text-3xl">Go Live Like a Full Production Studio.</h2>
          <GlassCard className="mt-10">
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                "Start and stop live broadcasts from the meeting room",
                "Save streaming destinations",
                "Use scenes like Intro, Program, BRB, Outro, and Holding",
                "Display lower thirds, tickers, and CTA banners",
                "Run countdown timers",
                "Schedule scene and overlay changes",
                "Use auto-directing to highlight speakers or screen share",
                "Review broadcast analytics and timeline history",
              ].map((line) => (
                <li key={line} className="flex gap-2 text-sm text-slate-300">
                  <span className="text-cyan-400 shrink-0">▸</span>
                  {line}
                </li>
              ))}
            </ul>
          </GlassCard>
        </motion.div>
      </SectionShell>

      {/* Who it's for */}
      <SectionShell className="relative z-10 border-t border-white/5 bg-black/15">
        <motion.div {...fadeUp}>
          <h2 className="text-2xl font-bold sm:text-3xl md:text-center">Built for People Who Turn Attention Into Revenue.</h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {[
              "Coaches & Consultants",
              "Content Creators",
              "Course Sellers",
              "Web3 Communities",
              "Agencies",
              "Entrepreneurs",
              "Event Hosts",
              "Private Membership Groups",
            ].map((label) => (
              <span
                key={label}
                className="rounded-full border border-cyan-500/20 bg-gradient-to-r from-cyan-950/40 to-slate-900/60 px-4 py-2 text-sm font-medium text-cyan-50/90"
              >
                {label}
              </span>
            ))}
          </div>
        </motion.div>
      </SectionShell>

      {/* Use cases */}
      <SectionShell className="relative z-10">
        <motion.div {...fadeUp}>
          <h2 className="text-2xl font-bold sm:text-3xl">Use Meets™ to Power Premium Live Experiences.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "Paid webinars",
              "NFT holder-only calls",
              "Private mastermind rooms",
              "Client onboarding sessions",
              "Investor briefings",
              "Online workshops",
              "Product launches",
              "Multi-platform live shows",
            ].map((u) => (
              <GlassCard key={u} className="py-4">
                <p className="text-sm font-medium text-slate-200">{u}</p>
              </GlassCard>
            ))}
          </div>
        </motion.div>
      </SectionShell>

      {/* Monetization */}
      <SectionShell className="relative z-10">
        <motion.div {...fadeUp} className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 via-slate-900/50 to-violet-950/20 p-8 sm:p-12">
          <h2 className="text-2xl font-bold sm:text-3xl">Turn Your Live Room Into a Revenue Channel.</h2>
          <p className="mt-4 max-w-3xl text-slate-300 leading-relaxed">
            Charge for access, gate premium rooms, host exclusive broadcasts, and create digital experiences people cannot
            enter unless they are verified. TroothHurts Meets™ is not just a meeting page — it is a monetized broadcast
            access system.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm text-slate-200">
            {[
              "Sell access to private sessions",
              "Create member-only events",
              "Host exclusive live broadcasts",
              "Offer premium community rooms",
              "Pair NFT access with paid memberships",
            ].map((b) => (
              <li key={b} className="flex gap-2">
                <span className="text-cyan-300">◆</span>
                {b}
              </li>
            ))}
          </ul>
        </motion.div>
      </SectionShell>

      {/* Comparison */}
      <SectionShell className="relative z-10 border-t border-white/5">
        <motion.div {...fadeUp}>
          <h2 className="text-2xl font-bold sm:text-3xl md:text-center">More Than a Meeting Link.</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <GlassCard>
              <h3 className="text-lg font-semibold text-slate-300">Traditional Meeting Tools</h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-500">
                {["Basic video calls", "Link sharing risk", "Separate streaming tools", "No Web3 access layer", "Limited monetization structure"].map(
                  (x) => (
                    <li key={x}>— {x}</li>
                  )
                )}
              </ul>
            </GlassCard>
            <GlassCard className="border-cyan-500/30 bg-cyan-950/10">
              <h3 className="text-lg font-semibold text-cyan-100">TroothHurts Meets™</h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-300">
                {[
                  "Private meeting room",
                  "Multi-platform broadcasting",
                  "NFT/token-gated access",
                  "Live scene and overlay controls",
                  "Event scheduling and launch readiness",
                  "Analytics and timeline reporting",
                ].map((x) => (
                  <li key={x} className="flex gap-2">
                    <span className="text-cyan-400">✓</span>
                    {x}
                  </li>
                ))}
              </ul>
            </GlassCard>
          </div>
        </motion.div>
      </SectionShell>

      {/* Pricing placeholder */}
      <SectionShell id="pricing" className="relative z-10">
        <motion.div {...fadeUp} className="mx-auto max-w-lg text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Unlock Access to TroothHurts Meets™.</h2>
          <p className="mt-4 text-slate-400">
            Get access to host private meetings, broadcast live, and protect premium content with verified access controls.
          </p>
          <GlassCard className="mt-10 text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400/90">Plan</p>
            <h3 className="mt-1 text-xl font-bold text-white">Meets Broadcast Access</h3>
            <ul className="mt-6 space-y-2 text-sm text-slate-300">
              {[
                "Private meeting room access",
                "Broadcast control panel",
                "NFT-gated entry support",
                "Multi-platform streaming setup",
                "Live show scenes and overlays",
                "Event scheduling and readiness tools",
              ].map((x) => (
                <li key={x} className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  {x}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-col gap-3">
              <PlaceholderPayButton className="w-full rounded-xl bg-gradient-to-b from-cyan-300 to-cyan-600 py-3.5 text-slate-950 shadow-[0_4px_0_#0e7490]">
                Unlock Meets Access
              </PlaceholderPayButton>
              <p className="text-center text-xs text-slate-500">Payment link coming soon.</p>
            </div>
          </GlassCard>
        </motion.div>
      </SectionShell>

      {/* FAQ */}
      <SectionShell className="relative z-10 border-t border-white/5 bg-black/20">
        <motion.div {...fadeUp}>
          <h2 className="text-2xl font-bold sm:text-3xl md:text-center">FAQ</h2>
          <div className="mx-auto mt-10 max-w-3xl space-y-4">
            {[
              {
                q: "Do I need OBS or Streamlabs?",
                a: "No. Meets™ is designed to let you host and broadcast from inside the platform.",
              },
              {
                q: "Can I stream to TikTok, Instagram, Facebook, and Twitch?",
                a: "Yes, supported destinations can be configured through streaming credentials or provider-supported connection flows where available.",
              },
              {
                q: "What does NFT-gated access mean?",
                a: "It means users must verify wallet/token ownership before entering protected rooms or experiences.",
              },
              {
                q: "Can I use this for paid events?",
                a: "Yes. You can connect your own payment flow and use Meets™ as the access and broadcast layer.",
              },
              {
                q: "Can someone still share my link?",
                a: "They can share a link, but gated access helps prevent unauthorized entry when verification is required.",
              },
            ].map((item) => (
              <GlassCard key={item.q} className="py-5">
                <p className="font-semibold text-cyan-100/95">{item.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.a}</p>
              </GlassCard>
            ))}
          </div>
        </motion.div>
      </SectionShell>

      {/* Final CTA */}
      <SectionShell className="relative z-10 pb-24">
        <motion.div
          {...fadeUp}
          className="rounded-3xl border border-cyan-500/25 bg-gradient-to-b from-slate-900/80 to-black p-10 text-center"
          style={{ boxShadow: `0 0 60px -10px ${ACCENT}33` }}
        >
          <h2 className="text-2xl font-bold sm:text-3xl">Your Meeting Room Should Do More Than Host Calls.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-400">
            Host, broadcast, gate, monetize, and control your live experience from one platform.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <PlaceholderPayButton className="rounded-xl bg-gradient-to-b from-cyan-300 to-cyan-600 px-8 py-3.5 text-slate-950 shadow-[0_4px_0_#0e7490]">
              Unlock Meets Access
            </PlaceholderPayButton>
          </div>
        </motion.div>
      </SectionShell>

      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} TroothHurts Meets™. All rights reserved.
      </footer>
    </div>
  );
}
