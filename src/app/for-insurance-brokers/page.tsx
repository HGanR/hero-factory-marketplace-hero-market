import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  MessageSquare,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InsuranceCoverageGuidancePreview } from "@/components/for-insurance-brokers/InsuranceCoverageGuidancePreview";
import { InsuranceLeadIntakePreview } from "@/components/for-insurance-brokers/InsuranceLeadIntakePreview";
import { InsuranceRenewalRetentionPreview } from "@/components/for-insurance-brokers/InsuranceRenewalRetentionPreview";
import { AiRevenueOSDemoBridge } from "@/components/shared/AiRevenueOSDemoBridge";
import { AiRevenueOSHighlight } from "@/components/shared/AiRevenueOSHighlight";

export const metadata = {
  title: "For insurance brokers | TroothHurtz",
  description:
    "24/7 insurance intake, coverage Q&A, quote routing, and renewal follow-up — built for brokerages and agencies.",
};

const pageBg: CSSProperties = {
  background: `
    radial-gradient(circle at 12% 18%, rgba(6,182,212,0.12), transparent 32%),
    radial-gradient(circle at 88% 12%, rgba(37,99,235,0.14), transparent 28%),
    radial-gradient(circle at 50% 88%, rgba(16,185,129,0.08), transparent 36%),
    linear-gradient(180deg, #07111a 0%, #050a0f 55%, #030608 100%)
  `,
};

const primaryBtnStyle: CSSProperties = {
  background: "linear-gradient(135deg, #06b6d4, #2563eb)",
  color: "#fff",
};

const accentBandStyle: CSSProperties = {
  background: "linear-gradient(135deg, #0e7490, #2563eb)",
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
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-[0_8px_30px_rgba(6,182,212,0.28)] transition hover:opacity-95 ${className}`}
    >
      {children}
    </Link>
  );
}

const shareMailto =
  "mailto:?subject=" +
  encodeURIComponent("Insurance broker demo") +
  "&body=" +
  encodeURIComponent(
    "Take a look at this insurance broker experience — quote intake, coverage Q&A, and renewal support:\n\n" +
      "(Add your link to /for-insurance-brokers/demo when sharing)\n"
  );

export default function ForInsuranceBrokersPage() {
  return (
    <div className="min-h-screen text-[#F8FAFC]">
      <div className="fixed inset-0 -z-10" style={pageBg} />

      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#050a0f]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[#94A3B8] transition hover:text-[#CBD5E1]"
          >
            <ArrowLeft className="h-4 w-4" />
            Hero Market
          </Link>
          <nav className="order-last flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[#CBD5E1] sm:text-sm md:order-none md:w-auto md:justify-end md:gap-6">
            <a href="#value" className="transition hover:text-white">
              Value
            </a>
            <a href="#proof" className="transition hover:text-white">
              Capabilities
            </a>
            <Link href="/for-insurance-brokers/demo" className="transition hover:text-white">
              Live Demo
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/for-insurance-brokers/demo"
              className="rounded-lg border border-white/[0.14] px-3 py-1.5 text-sm font-medium text-[#F8FAFC] transition hover:border-cyan-500/35"
            >
              See Demo
            </Link>
            <Link
              href="/consultations"
              style={primaryBtnStyle}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold shadow-lg shadow-cyan-500/15 transition hover:opacity-95"
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
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#94A3B8]">For Insurance Brokers</span>
                <Sparkles className="h-4 w-4 text-cyan-400" />
              </div>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-[#F8FAFC] md:text-5xl">
                Turn your website into a 24/7 insurance intake and follow-up system.
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-[#CBD5E1]">
                Capture prospects, answer common coverage questions, route quote requests, and keep renewals from
                slipping through the cracks — without making every client wait on office hours.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <PrimaryLink href="/for-insurance-brokers/demo">
                  View live broker demo
                  <ChevronRight className="h-4 w-4" />
                </PrimaryLink>
                <Button
                  variant="outline"
                  asChild
                  className="h-auto rounded-xl border-white/[0.14] bg-transparent px-6 py-3 text-sm font-semibold text-[#F8FAFC] hover:border-cyan-500/35 hover:bg-transparent"
                >
                  <a href={shareMailto}>Share with your team</a>
                </Button>
              </div>
              <p className="mt-6 text-sm text-[#94A3B8]">
                Built for independent brokers, multi-producer agencies, and growing MGAs.
              </p>
            </div>

            <div className="relative flex min-h-[280px] flex-col justify-center lg:min-h-[340px]">
              <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-3xl" />
              <div className="relative mx-auto w-full max-w-md space-y-4">
                <GlassCard className="p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/25 bg-[#0a1520]">
                    <Shield className="h-5 w-5 text-cyan-400" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Quote-ready intake</p>
                  <p className="mt-2 text-sm text-[#CBD5E1]">
                    “I need auto and renters — can someone call me after 5pm?”
                  </p>
                </GlassCard>
                <GlassCard className="p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Renewal signal</p>
                  <p className="mt-2 text-sm text-[#CBD5E1]">
                    “My homeowners renews next month — I want to review limits before I sign.”
                  </p>
                </GlassCard>
                <GlassCard className="flex items-start gap-3 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-500/25 bg-[#0a1520]">
                    <MessageSquare className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Routed to producers</p>
                    <p className="mt-1 text-sm text-[#CBD5E1]">
                      Cleaner handoffs — fewer “who was this?” moments in the inbox.
                    </p>
                  </div>
                </GlassCard>
              </div>
            </div>
          </div>
        </section>

        <AiRevenueOSHighlight variant="insurance" demoHref="#proof" placement="opening" />

        <section id="value" className="mt-20 scroll-mt-28">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">Why brokerages adopt this</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[#94A3B8]">Three outcomes your producers feel every week.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Capture more quote requests",
                body: "Intake for auto, home, life, commercial, and general inquiries — structured before it hits your CRM.",
                icon: Users,
              },
              {
                title: "Reduce repetitive back-and-forth",
                body: "Answer FAQ-style questions before staff has to step in — especially nights and weekends.",
                icon: MessageSquare,
              },
              {
                title: "Protect renewals and retention",
                body: "Keep follow-ups, reminders, and service requests organized so renewals don’t die in voicemail.",
                icon: CalendarClock,
              },
            ].map(({ title, body, icon: Icon }) => (
              <GlassCard key={title} className="p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/20 bg-[#0a1520]/90">
                  <Icon className="h-5 w-5 text-cyan-400" />
                </div>
                <h3 className="font-semibold text-[#F8FAFC]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#CBD5E1]">{body}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        <div id="proof" className="scroll-mt-28">
          <InsuranceLeadIntakePreview />
          <InsuranceCoverageGuidancePreview />
          <InsuranceRenewalRetentionPreview />
        </div>

        <AiRevenueOSHighlight variant="insurance" demoHref="#proof" placement="closing" />

        <AiRevenueOSDemoBridge />

        <section className="mt-12 md:mt-16">
          <div
            style={accentBandStyle}
            className="rounded-[24px] border border-white/10 p-8 text-center shadow-[0_20px_50px_rgba(14,116,144,0.2)] md:p-12"
          >
            <h2 className="text-2xl font-bold text-white md:text-3xl">Insurance buyers expect fast answers.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/95 md:text-base">
              The broker who responds clearly and quickly wins more business.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/for-insurance-brokers/demo"
                className="inline-flex items-center justify-center rounded-xl bg-black px-8 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-900"
              >
                Open demo
              </Link>
              <Link
                href="/consultations"
                className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-8 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Book setup
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
