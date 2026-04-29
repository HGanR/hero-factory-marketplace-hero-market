import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { MaaniaRealtorChat } from "@/components/for-realtors/MaaniaRealtorChat";
import { AiRevenueOSDemoBridge } from "@/components/shared/AiRevenueOSDemoBridge";
import { AiRevenueOSHighlight } from "@/components/shared/AiRevenueOSHighlight";
import {
  ArrowLeft,
  Bot,
  Building2,
  Check,
  ChevronRight,
  Layers,
  Link2,
  Sparkles,
  Zap,
} from "lucide-react";

export const metadata = {
  title: "For real estate agents | TroothHurtz",
  description:
    "Turn every listing into a smart client experience — branded site, 24/7 assistant, live demo link.",
};

/** Locked background (fintech depth, realtor-clean) */
const pageBg: CSSProperties = {
  background: `
    radial-gradient(circle at 15% 20%, rgba(37,99,235,0.20), transparent 30%),
    radial-gradient(circle at 85% 18%, rgba(124,58,237,0.16), transparent 28%),
    radial-gradient(circle at 50% 85%, rgba(249,115,22,0.14), transparent 34%),
    linear-gradient(180deg, #0B1120 0%, #030712 55%, #020617 100%)
  `,
};

/** Card: rgba(255,255,255,0.04), blur 14px, border, shadow, radius 24px */
const primaryBtnStyle: CSSProperties = {
  background: "linear-gradient(135deg, #2563EB, #7C3AED)",
  color: "#fff",
};

const accentBandStyle: CSSProperties = {
  background: "linear-gradient(135deg, #F97316, #FB923C)",
};

function GlassCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`rounded-[24px] border border-white/[0.08] bg-[rgba(255,255,255,0.04)] shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-[14px] ${className}`}
    >
      {children}
    </div>
  );
}

function PrimaryLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      style={primaryBtnStyle}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-[0_8px_30px_rgba(37,99,235,0.35)] transition hover:opacity-95 ${className}`}
    >
      {children}
    </Link>
  );
}

export default function ForRealtorsPage() {
  return (
    <div className="min-h-screen text-[#F8FAFC]">
      <div className="fixed inset-0 -z-10" style={pageBg} />

      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#030712]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link
            href="/ret"
            className="inline-flex items-center gap-2 text-sm text-[#94A3B8] transition hover:text-[#CBD5E1]"
          >
            <ArrowLeft className="h-4 w-4" />
            RET workspace
          </Link>
          <nav className="order-last flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[#CBD5E1] sm:text-sm md:order-none md:w-auto md:justify-end md:gap-6">
            <a href="#how-it-works" className="transition hover:text-white">
              How It Works
            </a>
            <a href="#why-it-works" className="transition hover:text-white">
              Why It Works
            </a>
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#packages" className="transition hover:text-white">
              Packages
            </a>
            <Link href="/for-realtors/demo" className="transition hover:text-white">
              Live Demo
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/for-realtors/demo"
              className="rounded-lg border border-white/[0.14] px-3 py-1.5 text-sm font-medium text-[#F8FAFC] transition hover:border-[rgba(59,130,246,0.35)]"
            >
              See Demo
            </Link>
            <Link
              href="/app/agents"
              style={primaryBtnStyle}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold shadow-lg shadow-blue-500/20 transition hover:opacity-95"
            >
              Start Now
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-10 md:px-6 md:pt-14">
        {/* Hero */}
        <section className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-14 lg:py-8">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#94A3B8]">Real estate</span>
              <Sparkles className="h-4 w-4 text-[#7C3AED]" />
            </div>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-[#F8FAFC] md:text-5xl">
              Turn Every Listing Into a Smart Client Experience
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-[#CBD5E1]">
              Build your site, attach a 24/7 assistant, and share a live link that answers questions and helps move
              deals forward.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <PrimaryLink href="/for-realtors/demo">
                See Live Demo
                <ChevronRight className="h-4 w-4" />
              </PrimaryLink>
              <Link
                href="/site-builder"
                className="inline-flex items-center justify-center rounded-xl border border-white/[0.14] bg-transparent px-6 py-3 text-sm font-semibold text-[#F8FAFC] transition hover:border-[rgba(59,130,246,0.35)]"
              >
                Start Your Realtor Site
              </Link>
            </div>
            <p className="mt-6 text-sm text-[#94A3B8]">
              Built for solo agents, teams, and modern brokerages.
            </p>
            <Link
              href="/ret"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#10B981] transition hover:text-emerald-300"
            >
              Explore RET workflow
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Hero — stacked proof cards */}
          <div className="relative flex min-h-[300px] flex-col justify-center lg:min-h-[360px]">
            <div className="absolute inset-0 rounded-full bg-[#2563EB]/10 blur-3xl" />
            <div className="relative mx-auto w-full max-w-md space-y-4">
              <GlassCard className="p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                  AI answered a client question
                </p>
                <p className="mt-3 text-sm leading-snug text-[#CBD5E1]">
                  “Yes, this property qualifies for investment use.”
                </p>
              </GlassCard>
              <GlassCard className="p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                  Live property preview
                </p>
                <p className="mt-3 text-sm text-[#CBD5E1]">Listing media and details — ready for your showing.</p>
              </GlassCard>
              <GlassCard className="flex items-start gap-3 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(59,130,246,0.18)] bg-[#111827]/80">
                  <Link2 className="h-5 w-5 text-[#7C3AED]" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Demo link shared</p>
                  <p className="mt-1 text-sm text-[#CBD5E1]">One URL. They explore while you&apos;re on appointments.</p>
                </div>
              </GlassCard>
            </div>
          </div>
        </section>

        <AiRevenueOSHighlight variant="realtor" demoHref="#demo" placement="opening" />

        {/* How it works */}
        <section id="how-it-works" className="mt-24 scroll-mt-28">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">How It Works</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[#94A3B8]">Four steps from build to launch.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Build Your Site",
                body: "Create a polished, branded real estate presence.",
                icon: Layers,
              },
              {
                title: "Attach Your Assistant",
                body: "Add an automated client assistant that answers common questions.",
                icon: Bot,
              },
              {
                title: "Share a Live Link",
                body: "Send a real experience to buyers, sellers, or prospects.",
                icon: Zap,
              },
              {
                title: "Go Live When Ready",
                body: "Turn on hosting and your domain when it’s time to launch.",
                icon: Building2,
              },
            ].map(({ title, body, icon: Icon }) => (
              <GlassCard key={title} className="p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(59,130,246,0.18)] bg-[#111827]/90">
                  <Icon className="h-5 w-5 text-[#7C3AED]" />
                </div>
                <h3 className="font-semibold text-[#F8FAFC]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#CBD5E1]">{body}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Why agents love it */}
        <section id="why-it-works" className="mt-24 scroll-mt-28">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">Why Agents Love It</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Respond Faster Without Burnout",
                body: "Let the assistant handle repeat questions so you can focus on closings and relationships.",
              },
              {
                title: "Stand Out in Listing Appointments",
                body: "Show a live experience — not a PDF — so sellers remember you.",
              },
              {
                title: "Stay Connected After the Sale",
                body: "Keep the conversation going with a branded, always-on touchpoint.",
              },
            ].map(({ title, body }) => (
              <GlassCard key={title} className="p-8">
                <h3 className="text-lg font-semibold text-[#F8FAFC]">{title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-[#CBD5E1]">{body}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Product stack */}
        <section id="features" className="mt-24 scroll-mt-28">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">More Than a Website</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[#94A3B8]">Your ecosystem, tied together.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "Smart Site Builder",
                body: "Launch a clean, branded agent presence fast.",
              },
              {
                title: "Automated Client Assistant",
                body: "Answer questions in your voice and business context.",
              },
              {
                title: "RET Intake Workspace",
                body: "Guide property owners and clients through structured onboarding.",
              },
              {
                title: "Property Twin Experience",
                body: "Show upgrades, visualize possibilities, and create stronger buyer engagement.",
              },
            ].map(({ title, body }) => (
              <GlassCard key={title} className="flex gap-4 p-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#10B981]/15 text-[#10B981]">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#F8FAFC]">{title}</h3>
                  <p className="mt-1 text-sm text-[#CBD5E1]">{body}</p>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>

        <AiRevenueOSHighlight variant="realtor" demoHref="#demo" placement="closing" />

        {/* Demo / emotional sell */}
        <section id="demo" className="mt-24 scroll-mt-28">
          <GlassCard className="relative overflow-hidden border-[rgba(124,58,237,0.18)] bg-[#111827]/90 px-6 py-12 text-center md:px-12">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#7C3AED]/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#2563EB]/10 blur-3xl" />
            <h2 className="relative text-2xl font-bold text-[#F8FAFC] md:text-3xl">Send One Link. Let It Work For You.</h2>
            <p className="relative mx-auto mt-4 max-w-2xl text-[#CBD5E1]">
              Instead of sending a static page, send an experience that informs and engages.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-4">
              <PrimaryLink href="/for-realtors/demo">Share a Demo</PrimaryLink>
              <Link
                href="/consultations"
                className="inline-flex items-center justify-center rounded-xl border border-white/[0.14] px-6 py-3 text-sm font-semibold text-[#F8FAFC] transition hover:border-[rgba(59,130,246,0.35)]"
              >
                Book Walkthrough
              </Link>
            </div>
          </GlassCard>
        </section>

        {/* Packages */}
        <section id="packages" className="mt-24 scroll-mt-28">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">Choose Your Starting Point</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                name: "Starter Agent",
                desc: "For agents who want a branded site and live demo link.",
              },
              {
                name: "Growth Agent",
                desc: "Site + assistant + lead-ready automation.",
                highlight: true,
              },
              {
                name: "Brokerage",
                desc: "Multi-agent rollout with centralized branding and support.",
              },
            ].map(({ name, desc, highlight }) => (
              <GlassCard
                key={name}
                className={`p-6 ${highlight ? "border-[rgba(59,130,246,0.35)] ring-1 ring-[rgba(59,130,246,0.2)]" : ""}`}
              >
                {highlight ? (
                  <span className="mb-3 inline-block rounded-full bg-[#2563EB]/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
                    Popular
                  </span>
                ) : (
                  <span className="mb-3 block h-6" />
                )}
                <h3 className="text-lg font-semibold text-[#F8FAFC]">{name}</h3>
                <p className="mt-2 text-sm text-[#CBD5E1]">{desc}</p>
                <Link
                  href="/app/agents"
                  className="mt-6 inline-flex w-full items-center justify-center rounded-xl border border-white/[0.14] py-2.5 text-sm font-medium text-[#F8FAFC] transition hover:border-[rgba(59,130,246,0.35)]"
                >
                  Get started
                </Link>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Final CTA — orange band */}
        <AiRevenueOSDemoBridge />

        <section className="mt-12 md:mt-16">
          <div
            style={accentBandStyle}
            className="rounded-[24px] border border-white/10 p-8 text-center shadow-[0_20px_50px_rgba(249,115,22,0.25)] md:p-12"
          >
            <h2 className="text-2xl font-bold text-white md:text-3xl">Your Next Listing Should Work Harder Than a Flyer</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/95 md:text-base">
              Show clients something memorable, modern, and built to convert.
            </p>
            <Link
              href="/site-builder"
              className="mt-8 inline-flex items-center justify-center rounded-xl bg-black px-8 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-900"
            >
              Start Your Realtor Site
            </Link>
          </div>
        </section>
      </main>

      <MaaniaRealtorChat pageSource="for-realtors" />
    </div>
  );
}
