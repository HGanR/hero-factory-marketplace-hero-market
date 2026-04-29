import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  Calendar,
  ChevronRight,
  MessageSquare,
  Repeat,
  Scissors,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarbershopBookingPreview } from "@/components/for-barbershops/BarbershopBookingPreview";
import { BarbershopLeenaChat } from "@/components/for-barbershops/BarbershopLeenaChat";
import { BarbershopPolicyAwareBooking } from "@/components/for-barbershops/BarbershopPolicyAwareBooking";
import { BarbershopPromoEngine } from "@/components/for-barbershops/BarbershopPromoEngine";
import { BarbershopRebookingEngine } from "@/components/for-barbershops/BarbershopRebookingEngine";
import { BarbershopWebsiteAssistantPreview } from "@/components/for-barbershops/BarbershopWebsiteAssistantPreview";
import { AiRevenueOSDemoBridge } from "@/components/shared/AiRevenueOSDemoBridge";
import { AiRevenueOSHighlight } from "@/components/shared/AiRevenueOSHighlight";

export const metadata = {
  title: "AI Websites & Booking Systems for Barbershops",
  description:
    "Help your barbershop book more clients, reduce no-shows, automate follow-up, and grow repeat business with an AI-powered website and assistant.",
};

const pageBg: CSSProperties = {
  background: `
    radial-gradient(circle at 12% 18%, rgba(217,119,6,0.08), transparent 34%),
    radial-gradient(circle at 88% 10%, rgba(120,113,108,0.1), transparent 28%),
    linear-gradient(180deg, #0c0a08 0%, #080706 55%, #050403 100%)
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
  encodeURIComponent("Barbershop demo — TroothHurtz") +
  "&body=" +
  encodeURIComponent(
    "See the barbershop booking and assistant experience — online booking, reminders, rebooks, and promos.\n"
  );

export default function ForBarbershopsPage() {
  return (
    <div className="min-h-screen text-[#F8FAFC]">
      <div className="fixed inset-0 -z-10" style={pageBg} />

      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#080706]/90 backdrop-blur-md">
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
              Benefits
            </a>
            <a href="#proof" className="transition hover:text-white">
              Capabilities
            </a>
            <Link href="/for-barbershops/demo" className="transition hover:text-white">
              Live Demo
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/for-barbershops/demo"
              className="rounded-lg border border-white/[0.14] px-3 py-1.5 text-sm font-medium text-[#F8FAFC] transition hover:border-amber-500/35"
            >
              See Demo
            </Link>
            <Link
              href="/consultations"
              style={primaryBtnStyle}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold shadow-lg shadow-amber-900/30 transition hover:opacity-95"
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
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#a8a29e]">AI for Barbershops</span>
                <Scissors className="h-4 w-4 text-amber-500" />
              </div>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-[#F8FAFC] md:text-5xl">
                Turn your barbershop into a booking, follow-up, and revenue machine.
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-[#CBD5E1]">
                From first-time visitors to loyal repeat clients, automate the customer journey with AI-powered booking,
                reminders, follow-up, promotions, and branded online presence.
              </p>
              <p className="mt-4 text-base leading-relaxed text-[#94A3B8]">
                Your barbershop should not rely on missed calls, DMs, and manual follow-up. Create a branded online
                experience that books appointments, answers client questions, sends reminders, and helps increase repeat
                business.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <PrimaryLink href="/consultations">
                  Get My Barbershop Page
                  <ChevronRight className="h-4 w-4" />
                </PrimaryLink>
                <Button
                  variant="outline"
                  asChild
                  className="h-auto rounded-xl border-white/[0.14] bg-transparent px-6 py-3 text-sm font-semibold text-[#F8FAFC] hover:border-amber-500/35 hover:bg-transparent"
                >
                  <Link href="/for-barbershops/demo">View Demo</Link>
                </Button>
              </div>
              <div className="mt-4">
                <Button variant="ghost" asChild className="h-auto px-0 text-sm text-[#94A3B8] hover:text-[#CBD5E1]">
                  <a href={shareMailto}>Share with your team</a>
                </Button>
              </div>
            </div>

            <div className="relative flex min-h-[280px] flex-col justify-center lg:min-h-[340px]">
              <div className="absolute inset-0 rounded-full bg-amber-500/5 blur-3xl" />
              <div className="relative mx-auto w-full max-w-md space-y-4">
                <GlassCard className="p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-[#0a0908]">
                    <Calendar className="h-5 w-5 text-amber-500" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Online booking</p>
                  <p className="mt-2 text-sm text-[#CBD5E1]">
                    “Fade + beard lineup Friday after 4 — hold Marcus if he’s free.”
                  </p>
                </GlassCard>
                <GlassCard className="p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">No-show defense</p>
                  <p className="mt-2 text-sm text-[#CBD5E1]">
                    Reminders and policy copy that protect your chair without sounding rude.
                  </p>
                </GlassCard>
                <GlassCard className="flex items-start gap-3 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-[#0a0908]">
                    <Repeat className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Repeat revenue</p>
                    <p className="mt-1 text-sm text-[#CBD5E1]">
                      Rebook nudges, reviews, and upsells — tuned to how your shop actually runs.
                    </p>
                  </div>
                </GlassCard>
              </div>
            </div>
          </div>
        </section>

        <AiRevenueOSHighlight variant="barber" demoHref="#proof" placement="opening" />

        <section id="value" className="mt-20 scroll-mt-28">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">
            Built for busy shops that can’t answer every DM
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[#94A3B8]">
            Spend less time chasing appointments and more time behind the chair.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Book cuts, trims, and grooming online",
                body: "Let clients book cuts, beard trims, lineups, and grooming services without the back-and-forth.",
                icon: Calendar,
              },
              {
                title: "Cut no-shows with reminders",
                body: "Reduce no-shows with automated reminders and confirmations.",
                icon: Bell,
              },
              {
                title: "Follow up for rebooks & reviews",
                body: "Follow up after appointments for rebooking and reviews.",
                icon: MessageSquare,
              },
              {
                title: "Promote specials automatically",
                body: "Promote specials, memberships, and premium services on a schedule you control.",
                icon: TrendingUp,
              },
              {
                title: "Modern site + chat + intake",
                body: "Give your shop a modern site with chat, intake, and lead capture built in.",
                icon: Sparkles,
              },
            ].map(({ title, body, icon: Icon }) => (
              <GlassCard key={title} className="p-6">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-[#0a0908]/90">
                  <Icon className="h-5 w-5 text-amber-500" />
                </div>
                <h3 className="font-semibold text-[#F8FAFC]">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#CBD5E1]">{body}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        <div id="proof" className="scroll-mt-28">
          <BarbershopBookingPreview />
          <BarbershopPolicyAwareBooking />
          <BarbershopRebookingEngine />
          <BarbershopPromoEngine />
          <BarbershopWebsiteAssistantPreview />
        </div>

        <AiRevenueOSHighlight variant="barber" demoHref="#proof" placement="closing" />

        <AiRevenueOSDemoBridge />

        <section className="mt-12 md:mt-16">
          <div
            style={accentBandStyle}
            className="rounded-[24px] border border-white/10 p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.35)] md:p-12"
          >
            <h2 className="text-2xl font-bold text-white md:text-3xl">
              Give your barbershop a smarter way to book and grow.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300 md:text-base">
              Your next client should be able to book, ask questions, and rebook without waiting on a text back.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/consultations"
                className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-8 py-3 text-sm font-semibold text-black shadow-lg transition hover:bg-amber-500"
              >
                Get My Barbershop Page
              </Link>
              <Link
                href="/for-barbershops/demo"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-8 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
              >
                View Demo
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-16 border-t border-slate-800 bg-[#050403] px-4 py-12">
          <p className="mx-auto max-w-2xl text-center text-sm text-slate-400">
            Full calendar, SMS, payments, and POS integrations live in your production workspace. This experience is a
            static preview — your team maps services, barbers, and policies during onboarding.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] text-slate-500">
            The floating assistant uses{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">
              NEXT_PUBLIC_BARBERSHOP_DEMO_WIDGET_KEY
            </code>{" "}
            (separate from other vertical widget keys). Set it after you create the barbershop agent in AI Agency and
            generate its widget key.
          </p>
        </section>
      </main>

      <BarbershopLeenaChat />
    </div>
  );
}
