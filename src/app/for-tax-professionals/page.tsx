import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calculator,
  ChevronRight,
  ClipboardList,
  FileCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaxAIAssistantPreview } from "@/components/for-tax-professionals/TaxAIAssistantPreview";
import { TaxLeenaChat } from "@/components/for-tax-professionals/TaxLeenaChat";
import { TaxPolicyAwareBooking } from "@/components/for-tax-professionals/TaxPolicyAwareBooking";
import { TaxSchedulingPreview } from "@/components/for-tax-professionals/TaxSchedulingPreview";
import { TaxServiceMatching } from "@/components/for-tax-professionals/TaxServiceMatching";
import { AiRevenueOSDemoBridge } from "@/components/shared/AiRevenueOSDemoBridge";
import { AiRevenueOSHighlight } from "@/components/shared/AiRevenueOSHighlight";

export const metadata = {
  title: "For tax professionals | TroothHurtz",
  description:
    "AI-powered tax professional websites — service clarity, guided intake, document workflow, and 24/7 assistant support.",
};

const pageBg: CSSProperties = {
  background: `
    radial-gradient(circle at 10% 15%, rgba(245,158,11,0.07), transparent 35%),
    radial-gradient(circle at 90% 12%, rgba(59,130,246,0.06), transparent 30%),
    linear-gradient(180deg, #070b14 0%, #05080f 55%, #030508 100%)
  `,
};

const primaryBtnStyle: CSSProperties = {
  background: "linear-gradient(135deg, #d97706, #b45309)",
  color: "#fff",
};

const accentBandStyle: CSSProperties = {
  background: "linear-gradient(135deg, #1c1917, #292524)",
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
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      style={primaryBtnStyle}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-[0_8px_30px_rgba(217,119,6,0.22)] transition hover:opacity-95 ${className}`}
    >
      {children}
    </Link>
  );
}

const shareMailto =
  "mailto:?subject=" +
  encodeURIComponent("Tax professional demo") +
  "&body=" +
  encodeURIComponent(
    "See the TroothHurtz tax professional experience — intake, workflow guidance, and assistant support.\n"
  );

export default function ForTaxProfessionalsPage() {
  return (
    <div className="min-h-screen text-[#F8FAFC]">
      <div className="fixed inset-0 -z-10" style={pageBg} />

      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#070b14]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[#94A3B8] transition hover:text-[#CBD5E1]"
          >
            <ArrowLeft className="h-4 w-4" />
            Hero Market
          </Link>
          <nav className="order-last flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[#CBD5E1] sm:text-sm md:order-none md:w-auto md:justify-end md:gap-6">
            <a href="#proof" className="transition hover:text-white">
              Capabilities
            </a>
            <a href="#workflow" className="transition hover:text-white">
              Workflow
            </a>
            <a href="#trust" className="transition hover:text-white">
              Trust
            </a>
            <Link href="/for-tax-professionals/demo" className="transition hover:text-white">
              Live Demo
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/for-tax-professionals/demo"
              className="rounded-lg border border-white/[0.14] px-3 py-1.5 text-sm font-medium text-[#F8FAFC] transition hover:border-amber-500/35"
            >
              See Demo
            </Link>
            <Link
              href="/consultations"
              style={primaryBtnStyle}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold shadow-lg shadow-amber-900/25 transition hover:opacity-95"
            >
              Start Now
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-10 md:px-6 md:pt-14">
        <section className="lg:py-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-14">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#a8a29e]">
                  AI-Powered Tax Professional Website
                </span>
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-[#F8FAFC] md:text-5xl">
                Turn your tax expertise into a client-ready digital office.
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-[#CBD5E1]">
                From tax preparation and bookkeeping support to client intake, document collection, and follow-up, your
                website works like a professional assistant 24/7.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <PrimaryLink href="/consultations">
                  Get My Tax Professional Site
                  <ChevronRight className="h-4 w-4" />
                </PrimaryLink>
                <Button
                  variant="outline"
                  asChild
                  className="h-auto rounded-xl border-white/[0.14] bg-transparent px-6 py-3 text-sm font-semibold text-[#F8FAFC] hover:border-amber-500/35 hover:bg-transparent"
                >
                  <Link href="/for-tax-professionals/demo">View Demo</Link>
                </Button>
              </div>
              <div className="mt-4">
                <Button
                  variant="ghost"
                  asChild
                  className="h-auto px-0 text-sm text-[#94A3B8] hover:text-[#CBD5E1]"
                >
                  <a href={shareMailto}>Share with your team</a>
                </Button>
              </div>
            </div>

            <div className="relative flex min-h-[280px] flex-col justify-center lg:min-h-[340px]">
              <div className="absolute inset-0 rounded-full bg-amber-500/5 blur-3xl" />
              <div className="relative mx-auto w-full max-w-md space-y-4">
                <GlassCard className="p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-[#0a1018]">
                    <Calculator className="h-5 w-5 text-amber-500" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Service menu</p>
                  <p className="mt-2 text-sm text-[#CBD5E1]">
                    “Individual, small business, and amended returns — what&apos;s included and what you&apos;ll need to
                    bring.”
                  </p>
                </GlassCard>
                <GlassCard className="p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Intake-first</p>
                  <p className="mt-2 text-sm text-[#CBD5E1]">
                    “Structured questions before the first call — so your team sees scope, not guesswork.”
                  </p>
                </GlassCard>
                <GlassCard className="flex items-start gap-3 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-[#0a1018]">
                    <FileCheck className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Clear next steps</p>
                    <p className="mt-1 text-sm text-[#CBD5E1]">
                      Document checklists and timelines — aligned with how your firm actually operates.
                    </p>
                  </div>
                </GlassCard>
              </div>
            </div>
          </div>
        </section>

        <AiRevenueOSHighlight variant="tax" demoHref="#proof" placement="opening" />

        <div id="proof" className="scroll-mt-28">
          <TaxServiceMatching />
          <TaxSchedulingPreview />
          <TaxPolicyAwareBooking />
          <TaxAIAssistantPreview />
        </div>

        <section id="workflow" className="mt-20 scroll-mt-28">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">
            From first visit to first appointment — simplified.
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[#94A3B8]">
            A steady rhythm visitors can follow — without overwhelming your inbox.
          </p>
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { step: 1, title: "Learn about services", body: "Clear menus and scope before anyone picks up the phone.", icon: ClipboardList },
              { step: 2, title: "Start intake", body: "Structured questions capture who they are and what they need.", icon: UserCheck },
              { step: 3, title: "Prepare documents", body: "Checklists and uploads aligned with your process.", icon: FileCheck },
              { step: 4, title: "Book or request follow-up", body: "Scheduling or callback — however your firm operates.", icon: Sparkles },
              { step: 5, title: "Stay on track with reminders", body: "Seasonal prompts and status cues you configure.", icon: Calculator },
            ].map(({ step, title, body, icon: Icon }) => (
              <GlassCard key={step} className="flex gap-4 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-500/25 bg-amber-500/10 text-sm font-bold text-amber-200">
                  {step}
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-amber-500/90" />
                    <h3 className="font-semibold text-white">{title}</h3>
                  </div>
                  <p className="text-sm text-[#CBD5E1]">{body}</p>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>

        <section id="trust" className="mt-20 scroll-mt-28">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">
            Build trust before clients ever speak with you.
          </h2>
          <div className="mx-auto mt-10 max-w-3xl space-y-3">
            {[
              "Professional presentation",
              "Clear services and expectations",
              "Structured intake",
              "Client-friendly communication",
              "Organized digital presence",
            ].map((line) => (
              <GlassCard key={line} className="flex items-center gap-3 px-5 py-3 text-sm text-[#CBD5E1]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
                {line}
              </GlassCard>
            ))}
          </div>
        </section>

        <AiRevenueOSHighlight variant="tax" demoHref="#proof" placement="closing" />

        <AiRevenueOSDemoBridge />

        <section className="mt-12 md:mt-16">
          <div
            style={accentBandStyle}
            className="rounded-[24px] border border-white/10 p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.35)] md:p-12"
          >
            <h2 className="text-2xl font-bold text-white md:text-3xl">
              Launch a tax professional website that works for you.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300 md:text-base">
              Pair polished marketing with intake and workflow — the same patterns serious firms expect online.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/consultations"
                className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-8 py-3 text-sm font-semibold text-black shadow-lg transition hover:bg-amber-500"
              >
                Get My Tax Professional Page
              </Link>
              <Link
                href="/for-tax-professionals/demo"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-8 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
              >
                View Demo
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-16 border-t border-slate-800 bg-[#05080f] px-4 py-12">
          <p className="mx-auto max-w-2xl text-center text-sm text-slate-400">
            Full CRM routing, e-sign, and tax software integrations live in your production workspace. This experience is
            a static preview — your team maps services, jurisdictions, and compliance during onboarding.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] text-slate-500">
            The floating assistant uses{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">
              NEXT_PUBLIC_TAX_DEMO_WIDGET_KEY
            </code>{" "}
            (separate from other vertical widget keys). Set it after you create the tax professional agent in AI Agency
            and generate its widget key.
          </p>
        </section>
      </main>

      <TaxLeenaChat />
    </div>
  );
}
