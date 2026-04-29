import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Calendar,
  Car,
  ChevronRight,
  Clock,
  MessageSquare,
  Plane,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransportPolicyBookingPreview } from "@/components/for-transportation-services/TransportPolicyBookingPreview";
import { TransportPremiumExperiencePreview } from "@/components/for-transportation-services/TransportPremiumExperiencePreview";
import { TransportSchedulingPreview } from "@/components/for-transportation-services/TransportSchedulingPreview";
import { TransportTripMatchingPreview } from "@/components/for-transportation-services/TransportTripMatchingPreview";
import { AiRevenueOSDemoBridge } from "@/components/shared/AiRevenueOSDemoBridge";
import { AiRevenueOSHighlight } from "@/components/shared/AiRevenueOSHighlight";

export const metadata = {
  title: "For transportation services | TroothHurtz",
  description:
    "AI-powered booking and intake for limo, chauffeur, black car, airport transfer, event, and shuttle operators.",
};

const pageBg: CSSProperties = {
  background: `
    radial-gradient(circle at 10% 15%, rgba(217,119,6,0.08), transparent 35%),
    radial-gradient(circle at 90% 10%, rgba(120,113,108,0.1), transparent 30%),
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
  encodeURIComponent("Transportation services demo") +
  "&body=" +
  encodeURIComponent("See the TroothHurtz transportation demo — booking intake built for premium operators.\n");

export default function ForTransportationServicesPage() {
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
              Value
            </a>
            <a href="#built" className="transition hover:text-white">
              Who it&apos;s for
            </a>
            <a href="#trips" className="transition hover:text-white">
              Trip types
            </a>
            <a href="#ai" className="transition hover:text-white">
              How AI helps
            </a>
            <Link href="/for-transportation-services/demo" className="transition hover:text-white">
              Live Demo
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/for-transportation-services/demo"
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
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#a8a29e]">Transportation Services</span>
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-[#F8FAFC] md:text-5xl">
                Turn your website into a 24/7 booking and intake desk — without losing the premium feel.
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-[#CBD5E1]">
                Capture stronger ride inquiries, answer policy and timing questions, and present a composed experience
                that matches how you run your fleet — from airport transfers to hourly chauffeur blocks.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <PrimaryLink href="/for-transportation-services/demo">
                  View live demo
                  <ChevronRight className="h-4 w-4" />
                </PrimaryLink>
                <Button
                  variant="outline"
                  asChild
                  className="h-auto rounded-xl border-white/[0.14] bg-transparent px-6 py-3 text-sm font-semibold text-[#F8FAFC] hover:border-amber-500/35 hover:bg-transparent"
                >
                  <a href={shareMailto}>Share with your team</a>
                </Button>
              </div>
              <p className="mt-6 text-sm text-[#94A3B8]">
                Built for operators who sell trust, punctuality, and discretion — not just a rate card.
              </p>
            </div>

            <div className="relative flex min-h-[280px] flex-col justify-center">
              <div className="absolute inset-0 rounded-full bg-amber-500/5 blur-3xl" />
              <div className="relative mx-auto w-full max-w-md space-y-4">
                <GlassCard className="p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-[#0a0908]">
                    <Plane className="h-5 w-5 text-amber-500" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Airport · curbside</p>
                  <p className="mt-2 text-sm text-[#CBD5E1]">
                    “Flight lands 6:40 — two passengers, Terminal C. Need a sedan with room for skis.”
                  </p>
                </GlassCard>
                <GlassCard className="p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Executive hourly</p>
                  <p className="mt-2 text-sm text-[#CBD5E1]">
                    “Board meeting downtown, then dinner — about 5 hours, need quiet cabin and Wi‑Fi.”
                  </p>
                </GlassCard>
                <GlassCard className="flex items-start gap-3 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-[#0a0908]">
                    <Shield className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Policy clarity</p>
                    <p className="mt-1 text-sm text-[#CBD5E1]">
                      Wait times, cancellations, and meet-and-greet — explained before the trip is confirmed.
                    </p>
                  </div>
                </GlassCard>
              </div>
            </div>
          </div>
        </section>

        <AiRevenueOSHighlight variant="transport" demoHref="#proof" placement="opening" />

        <section id="value" className="mt-20 scroll-mt-28">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">Why operators adopt this</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[#94A3B8]">
            Better inquiries, fewer missed calls, clearer policies — without sounding like a call center.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Capture more qualified ride requests",
                body: "Structured intake for airports, hourly, events, and shuttles — before your phone rings off the hook.",
                icon: Car,
              },
              {
                title: "Reduce repetitive back-and-forth",
                body: "Answer timing, vehicle class, and policy questions in a tone that matches your brand.",
                icon: MessageSquare,
              },
              {
                title: "Present a premium experience online",
                body: "Your site feels as composed as your fleet — not like a generic form bolted on the homepage.",
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

        <section id="built" className="mt-20 scroll-mt-28">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">Built for transportation businesses</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[#94A3B8]">
            Whether you run two vehicles or a coordinated fleet, the same intake discipline applies.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Limo & executive sedan operators",
              "Chauffeur and black car services",
              "Airport transfer specialists",
              "Event and wedding transportation",
              "Corporate shuttle programs",
              "Regional and intercity shuttles",
            ].map((line) => (
              <GlassCard key={line} className="px-4 py-3 text-sm text-[#CBD5E1]">
                {line}
              </GlassCard>
            ))}
          </div>
        </section>

        <section id="trips" className="mt-20 scroll-mt-28">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">Common trip types</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[#94A3B8]">
            The assistant adapts questions to how the trip actually works — not one-size-fits-all.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Airport & FBO",
                body: "Terminals, flight buffers, luggage, meet-and-greet vs curbside.",
                icon: Plane,
              },
              {
                title: "Executive hourly",
                body: "Road shows, multi-stop days, wait rules, and vehicle class.",
                icon: Clock,
              },
              {
                title: "Weddings & events",
                body: "Staging times, group size, route complexity, and coordinator contact.",
                icon: Calendar,
              },
              {
                title: "Shuttle & recurring",
                body: "Routes, headcount, accessibility needs, and schedule windows.",
                icon: Users,
              },
            ].map(({ title, body, icon: Icon }) => (
              <GlassCard key={title} className="p-5">
                <Icon className="h-6 w-6 text-amber-500/90" />
                <h3 className="mt-3 font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-[#CBD5E1]">{body}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        <section id="ai" className="mt-20 scroll-mt-28">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">How the AI helps</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[#94A3B8]">
            A booking and intake assistant — not a gimmick chatbot.
          </p>
          <div className="mx-auto mt-10 max-w-3xl space-y-4">
            {[
              {
                title: "Trip-aware questions",
                body: "Asks what matters for that service type — stops, party size, luggage, timing buffers.",
                icon: Car,
              },
              {
                title: "Dispatch-ready summaries",
                body: "Converts vague messages into fields your team can act on.",
                icon: Bot,
              },
              {
                title: "Policy and expectation setting",
                body: "Surfaces wait times, cancellation windows, and billing notes from your configured rules.",
                icon: Shield,
              },
            ].map(({ title, body, icon: Icon }) => (
              <GlassCard key={title} className="flex gap-4 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-[#0a0908]">
                  <Icon className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{title}</h3>
                  <p className="mt-1 text-sm text-[#CBD5E1]">{body}</p>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>

        <div id="proof" className="scroll-mt-28">
          <TransportTripMatchingPreview />
          <TransportSchedulingPreview />
          <TransportPolicyBookingPreview />
          <TransportPremiumExperiencePreview />
        </div>

        <AiRevenueOSHighlight variant="transport" demoHref="#proof" placement="closing" />

        <AiRevenueOSDemoBridge />

        <section className="mt-12 md:mt-16">
          <div
            style={accentBandStyle}
            className="rounded-[24px] border border-white/10 p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.35)] md:p-12"
          >
            <h2 className="text-2xl font-bold text-white md:text-3xl">Guests book the operator who answers with clarity.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300 md:text-base">
              Make your first impression match the ride they&apos;ll remember.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/for-transportation-services/demo"
                className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-8 py-3 text-sm font-semibold text-black shadow-lg transition hover:bg-amber-500"
              >
                Open demo
              </Link>
              <Link
                href="/consultations"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-8 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
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
