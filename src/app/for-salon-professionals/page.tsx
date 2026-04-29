import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  CalendarClock,
  Check,
  ChevronRight,
  MessageCircle,
  Scissors,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AiRevenueOSDemoBridge } from "@/components/shared/AiRevenueOSDemoBridge";
import { AiRevenueOSHighlight } from "@/components/shared/AiRevenueOSHighlight";

export const metadata = {
  title: "For salon professionals | TroothHurtz",
  description:
    "Branded site, automated client assistant, and a live link for stylists, nail techs, and suite operators.",
};

const pageBg: CSSProperties = {
  background: `
    radial-gradient(circle at 15% 20%, rgba(37,99,235,0.20), transparent 30%),
    radial-gradient(circle at 85% 18%, rgba(124,58,237,0.16), transparent 28%),
    radial-gradient(circle at 50% 85%, rgba(249,115,22,0.14), transparent 34%),
    linear-gradient(180deg, #0B1120 0%, #030712 55%, #020617 100%)
  `,
};

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
  children: ReactNode;
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

const cardShell =
  "rounded-[24px] border border-white/[0.08] bg-[rgba(255,255,255,0.04)] shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-[14px] border-slate-800/20 text-[#F8FAFC]";

export default function ForSalonProfessionalsPage() {
  return (
    <div className="min-h-screen text-[#F8FAFC]">
      <div className="fixed inset-0 -z-10" style={pageBg} />

      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#030712]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[#94A3B8] transition hover:text-[#CBD5E1]"
          >
            <ArrowLeft className="h-4 w-4" />
            Hero Market
          </Link>
          <nav className="order-last flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[#CBD5E1] sm:text-sm md:order-none md:w-auto md:justify-end md:gap-6">
            <a href="#how-it-works" className="transition hover:text-white">
              How It Works
            </a>
            <a href="#why-it-works" className="transition hover:text-white">
              Day-to-Day Wins
            </a>
            <a href="#features" className="transition hover:text-white">
              What You Get
            </a>
            <Link href="/for-salon-professionals/demo" className="transition hover:text-white">
              Live Demo
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/for-salon-professionals/demo"
              className="rounded-lg border border-white/[0.14] px-3 py-1.5 text-sm font-medium text-[#F8FAFC] transition hover:border-[rgba(59,130,246,0.35)]"
            >
              See Demo
            </Link>
            <Link
              href="/consultations"
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
        <section className="lg:py-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-14">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#94A3B8]">Salon &amp; suite pros</span>
                <Sparkles className="h-4 w-4 text-[#7C3AED]" />
              </div>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-[#F8FAFC] md:text-5xl">
                Your Chair-Side Hustle Deserves a Front Desk That Never Clocks Out
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-[#CBD5E1]">
                Salon owners, stylists, nail techs, and suite operators: stop answering the same DMs between foils. Put a
                branded experience and a 24/7 assistant on one link — so clients get answers while you stay in the zone.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <PrimaryLink href="/for-salon-professionals/demo">
                  See Live Demo
                  <ChevronRight className="h-4 w-4" />
                </PrimaryLink>
                <Button
                  variant="outline"
                  asChild
                  className="h-auto rounded-xl border-white/[0.14] bg-transparent px-6 py-3 text-sm font-semibold text-[#F8FAFC] hover:border-[rgba(59,130,246,0.35)] hover:bg-transparent"
                >
                  <Link href="/consultations">Talk through your setup</Link>
                </Button>
              </div>
              <p className="mt-6 text-sm text-[#94A3B8]">
                Built for solo artists, small teams, and multi-chair suites.
              </p>
              <Link
                href="/site-builder"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#10B981] transition hover:text-emerald-300"
              >
                Explore the site builder
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="relative flex min-h-[300px] items-center justify-center lg:min-h-[360px]">
              <div className="absolute inset-0 rounded-full bg-[#7C3AED]/10 blur-3xl" />
              <div className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-white/[0.08] shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/a_digital_portrait_photograph_features_two_women_s.png"
                  alt="Salon professionals in a modern salon setting"
                  className="aspect-[4/5] w-full object-cover object-center"
                  width={560}
                  height={700}
                />
              </div>
            </div>
          </div>

          <div className="relative mx-auto mt-14 max-w-md space-y-4 lg:mt-16 lg:ml-auto lg:max-w-none lg:grid lg:grid-cols-3 lg:gap-4 lg:space-y-0">
            <div className="absolute inset-0 -z-10 hidden rounded-full bg-[#2563EB]/10 blur-3xl lg:block" />
            <GlassCard className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                AI answered a client question
              </p>
              <p className="mt-3 text-sm leading-snug text-[#CBD5E1]">
                “Do you take same-day bookings for gel removal?”
              </p>
            </GlassCard>
            <GlassCard className="p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                Live services &amp; policies
              </p>
              <p className="mt-3 text-sm text-[#CBD5E1]">Menu, pricing context, and house rules — always on-brand.</p>
            </GlassCard>
            <GlassCard className="flex items-start gap-3 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(59,130,246,0.18)] bg-[#111827]/80">
                <MessageCircle className="h-5 w-5 text-[#7C3AED]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Demo link shared</p>
                <p className="mt-1 text-sm text-[#CBD5E1]">One URL. They explore while you&apos;re behind the chair.</p>
              </div>
            </GlassCard>
          </div>
        </section>

        <AiRevenueOSHighlight variant="salon" demoHref="#demo" placement="opening" />

        {/* How it works */}
        <section id="how-it-works" className="mt-24 scroll-mt-28">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">How It Works</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[#94A3B8]">Four steps from build to a live client link.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: "Build Your Presence",
                body: "Launch a clean, branded page for your suite or salon brand.",
                icon: Scissors,
              },
              {
                title: "Attach Your Assistant",
                body: "Automate answers for booking, pricing, policies, and FAQs.",
                icon: Bot,
              },
              {
                title: "Share One Link",
                body: "Drop it in Instagram, texts, email — clients self-serve first.",
                icon: Zap,
              },
              {
                title: "Go Live When Ready",
                body: "Turn on hosting and your domain when it’s time to scale.",
                icon: CalendarClock,
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

        {/* Day-to-day */}
        <section id="why-it-works" className="mt-24 scroll-mt-28">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">Day-to-Day Business Wins</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[#94A3B8]">
            Real revenue and reputation benefits — not buzzwords.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Fewer interruptions, fewer lost bookings",
                body: "Clients get instant clarity on hours, deposits, and services — so you’re not trading messages in the middle of a color.",
              },
              {
                title: "Stand out in your market",
                body: "Send a live experience instead of a static screenshot or a messy PDF menu. You look like the pro who invested in the client journey.",
              },
              {
                title: "Keep the relationship after they leave",
                body: "Your branded link stays in their texts — a touchpoint for rebooks, referrals, and add-on services.",
              },
            ].map(({ title, body }) => (
              <GlassCard key={title} className="p-8">
                <h3 className="text-lg font-semibold text-[#F8FAFC]">{title}</h3>
                <p className="mt-4 text-sm leading-relaxed text-[#CBD5E1]">{body}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* Features — shadcn Card */}
        <section id="features" className="mt-24 scroll-mt-28">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">More Than a Link in Your Bio</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[#94A3B8]">Your ecosystem, tied together.</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              {
                title: "Smart Site Builder",
                body: "Launch a polished presence for your brand or suite — fast.",
              },
              {
                title: "Automated Client Assistant",
                body: "Answer questions in your voice and business context.",
              },
              {
                title: "Structured intake &amp; reminders",
                body: "Guide new guests through policies, forms, and expectations — before they sit down.",
              },
              {
                title: "Always-on engagement",
                body: "Turn curiosity into booked appointments with a consistent, on-brand experience.",
              },
            ].map(({ title, body }) => (
              <Card key={title} className={cardShell}>
                <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#10B981]/15 text-[#10B981]">
                    <Check className="h-4 w-4" />
                  </div>
                  <div className="space-y-2 text-left">
                    <CardTitle className="text-base font-semibold text-[#F8FAFC]">{title}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed text-[#CBD5E1]">{body}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <AiRevenueOSHighlight variant="salon" demoHref="#demo" placement="closing" />

        {/* Push to demo */}
        <section id="demo" className="mt-24 scroll-mt-28">
          <GlassCard className="relative overflow-hidden border-[rgba(124,58,237,0.18)] bg-[#111827]/90 px-6 py-12 text-center md:px-12">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#7C3AED]/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#2563EB]/10 blur-3xl" />
            <h2 className="relative text-2xl font-bold text-[#F8FAFC] md:text-3xl">Send One Link. Let It Work For You.</h2>
            <p className="relative mx-auto mt-4 max-w-2xl text-[#CBD5E1]">
              See the experience your clients will get — then we’ll map it to your services and policies.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-4">
              <PrimaryLink href="/for-salon-professionals/demo">Open the live demo</PrimaryLink>
              <Link
                href="/consultations"
                className="inline-flex items-center justify-center rounded-xl border border-white/[0.14] px-6 py-3 text-sm font-semibold text-[#F8FAFC] transition hover:border-[rgba(59,130,246,0.35)]"
              >
                Book a walkthrough
              </Link>
            </div>
          </GlassCard>
        </section>

        {/* Final CTA */}
        <AiRevenueOSDemoBridge />

        <section className="mt-12 md:mt-16">
          <div
            style={accentBandStyle}
            className="rounded-[24px] border border-white/10 p-8 text-center shadow-[0_20px_50px_rgba(249,115,22,0.25)] md:p-12"
          >
            <h2 className="text-2xl font-bold text-white md:text-3xl">Your Next Client Should Meet You Before You Meet Them</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/95 md:text-base">
              Give them a modern, memorable first impression — and move them toward booking with confidence.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/for-salon-professionals/demo"
                className="inline-flex items-center justify-center rounded-xl bg-black px-8 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-900"
              >
                See the live demo
              </Link>
              <Link
                href="/consultations"
                className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-8 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Talk onboarding
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
