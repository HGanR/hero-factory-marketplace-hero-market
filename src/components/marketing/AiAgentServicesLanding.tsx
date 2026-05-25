"use client";

import Link from "next/link";
import {
  Bot,
  Globe,
  LayoutDashboard,
  BarChart3,
  Brain,
  Sparkles,
  UserPlus,
  Filter,
  HeadphonesIcon,
  Send,
  GraduationCap,
  Clock,
  Target,
  PhoneOff,
  Smile,
  Coffee,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

const ELECTRIC = "#00D1FF";

const glass =
  "rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-xl backdrop-blur-md";

const LEAD_PATH = "/consultations";

export function AiAgentServicesLanding() {
  const scrollToId = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.12]"
        style={{
          backgroundImage: `linear-gradient(rgba(0,209,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,209,255,0.04) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(124,58,237,0.35), transparent 55%), radial-gradient(ellipse 60% 50% at 100% 30%, rgba(0,209,255,0.2), transparent 50%), radial-gradient(ellipse 50% 40% at 0% 60%, rgba(59,130,246,0.15), transparent 45%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pb-28 sm:pt-16 lg:px-8">
          <Link
            href="/"
            className="inline-flex text-sm font-medium text-slate-400 transition hover:text-cyan-300"
          >
            ← Back to Hero Market
          </Link>
          <div className="mx-auto mt-10 max-w-4xl text-center">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-200/90">
              <Bot className="h-3.5 w-3.5" aria-hidden />
              AI Agent Services
            </p>
            <h1 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[3.25rem] lg:leading-[1.12]">
              Your Business Needs More Than a Website.{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">
                It Needs a Virtual Assistant That Works.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-400 sm:text-xl">
              We build custom AI agents for small businesses, entrepreneurs, and startups — complete with a website,
              admin panel, analytics, knowledge upgrades, skills, and optional Telegram bot connection.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={LEAD_PATH}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-cyan-300 to-cyan-600 px-8 py-4 text-base font-bold text-slate-950 shadow-[0_4px_0_#0e7490] transition hover:brightness-110 sm:w-auto"
              >
                Build My AI Agent
                <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
              <button
                type="button"
                onClick={() => scrollToId("included")}
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-base font-semibold text-white transition hover:border-cyan-500/40 hover:bg-cyan-950/30 sm:w-auto"
              >
                See What&apos;s Included
              </button>
            </div>
            <p className="mt-8 text-sm font-medium text-slate-500">
              Close more sales · Filter noise · Save time · Change how you work
            </p>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className={`${glass} border-amber-500/15 bg-amber-950/10`}>
          <h2 className="text-2xl font-bold text-white sm:text-3xl">You&apos;re Losing Hours — And Deals — Every Week.</h2>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-400 sm:text-lg">
            Most owners burn time on repeat questions, weak leads that never convert, messages that slip through the
            cracks, and after-hours pings that steal focus from family and deep work. Your website sits there — but
            nothing is qualifying visitors, filtering noise, or moving serious buyers forward while you sleep.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              "Answering the same questions over and over",
              "Chasing tire-kickers instead of real opportunities",
              "Missing conversations when you step away",
              "No consistent front desk for your digital business",
            ].map((line) => (
              <li key={line} className="flex gap-2 text-sm text-slate-300 sm:text-base">
                <span className="text-amber-400" aria-hidden>
                  ▸
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* What's included */}
      <section id="included" className="relative scroll-mt-24 border-t border-white/5 bg-black/20 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl md:text-4xl">
            Everything Included In Your Custom Build
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-slate-400">
            Not a chat widget bolted onto a template — a trained digital teammate with your site, controls, and data in
            one stack.
          </p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Custom AI Virtual Assistant", body: "Business-specific training so answers sound like you.", icon: Bot },
              { title: "Website Build", body: "Modern presence designed to convert and support your agent.", icon: Globe },
              { title: "Admin Panel", body: "Manage content, settings, and workflows without dev tickets.", icon: LayoutDashboard },
              { title: "Analytics Dashboard", body: "See conversations, leads, and what’s working.", icon: BarChart3 },
              { title: "Knowledge Upgrades", body: "Virtual assistant knowledge upgrades as you grow.", icon: Brain },
              { title: "Skill Upgrades", body: "Expand what your agent can do over time.", icon: Sparkles },
              { title: "Lead Capture", body: "Turn chats into qualified leads — not dead ends.", icon: UserPlus },
              { title: "Conversation Filtering", body: "Cut spam and low-intent noise before it reaches you.", icon: Filter },
              { title: "Telegram Bot Connection", body: "Optional bridge so your audience meets you where they are.", icon: Send },
              { title: "Sales Flow Support", body: "Guidance and structure so chats support closing.", icon: HeadphonesIcon },
            ].map(({ title, body, icon: Icon }) => (
              <div key={title} className={glass}>
                <div
                  className="mb-4 inline-flex rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-3"
                  style={{ color: ELECTRIC }}
                >
                  <Icon className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
              </div>
            ))}
          </div>
          <div className={`${glass} mx-auto mt-10 max-w-2xl border-violet-500/20 bg-violet-950/15 text-center`}>
            <GraduationCap className="mx-auto h-10 w-10 text-violet-300" aria-hidden />
            <p className="mt-3 font-semibold text-white">Business-specific training</p>
            <p className="mt-1 text-sm text-slate-400">Your offers, FAQs, tone, and guardrails — baked in from day one.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">How It Works</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { step: "1", title: "We learn your business", desc: "Offers, audience, objections, and how you win deals." },
            { step: "2", title: "We build your website + agent", desc: "Digital front desk with admin and analytics wired in." },
            { step: "3", title: "We train the assistant", desc: "Knowledge, skills, filtering rules, and sales-support flows." },
            { step: "4", title: "You launch", desc: "Start capturing better conversations 24/7 — with optional Telegram." },
          ].map((s) => (
            <div key={s.step} className={`${glass} relative overflow-hidden`}>
              <span className="text-5xl font-black tabular-nums text-white/[0.06]">{s.step}</span>
              <h3 className="-mt-8 text-lg font-semibold text-cyan-100">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="relative border-t border-white/5 bg-gradient-to-b from-slate-900/50 to-transparent py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">Why Operators Switch To An AI Agent</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { t: "Respond 24/7", d: "Never leave a serious prospect hanging.", icon: Clock },
              { t: "Qualify serious prospects", d: "Spend energy only on conversations that matter.", icon: Target },
              { t: "Reduce wasted calls", d: "Filter noise before it hits your calendar.", icon: PhoneOff },
              { t: "Improve customer experience", d: "Instant, consistent answers — professional every time.", icon: Smile },
              { t: "Free up owner time", d: "Get hours back for strategy and delivery.", icon: Coffee },
              { t: "Professional digital front desk", d: "One system: site + assistant + admin + analytics.", icon: ShieldCheck },
            ].map(({ t, d, icon: Icon }) => (
              <div key={t} className={`${glass} flex gap-4`}>
                <Icon className="h-8 w-8 shrink-0 text-cyan-400" aria-hidden />
                <div>
                  <h3 className="font-semibold text-white">{t}</h3>
                  <p className="mt-1 text-sm text-slate-400">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lifestyle */}
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div
          className={`${glass} border-cyan-500/25 bg-gradient-to-br from-cyan-950/30 via-slate-900/40 to-violet-950/20 p-8 sm:p-12 text-center`}
          style={{ boxShadow: `0 0 60px -15px ${ELECTRIC}44` }}
        >
          <h2 className="text-2xl font-bold text-white sm:text-3xl md:text-4xl">More Business Should Not Mean Less Life.</h2>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-slate-300">
            Let your AI agent handle repetitive conversations so you can spend more time building, resting, and being with
            your family — while your digital front desk keeps working.
          </p>
          <Link
            href={LEAD_PATH}
            className="mt-8 inline-flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-8 py-3.5 font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
          >
            Talk To Us About Your Build
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative px-4 pb-24 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-black/50 p-10 text-center backdrop-blur-md">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Ready To Put An AI Agent To Work For Your Business?</h2>
          <p className="mt-4 text-slate-400">Website + AI Agent + Admin Panel included.</p>
          <Link
            href={LEAD_PATH}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-violet-400 to-violet-700 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-violet-950/50 transition hover:brightness-110 sm:w-auto"
          >
            Build My AI Agent Now
            <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} Hero Market · AI Agent Services
      </footer>
    </div>
  );
}
