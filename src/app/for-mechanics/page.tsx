import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Car,
  ChevronRight,
  ClipboardList,
  Gauge,
  Phone,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MechanicEstimateIntakePreview } from "@/components/for-mechanics/MechanicEstimateIntakePreview";
import { MechanicLeenaChat } from "@/components/for-mechanics/MechanicLeenaChat";
import { MechanicPolicyAwareBooking } from "@/components/for-mechanics/MechanicPolicyAwareBooking";
import { MechanicRepairStatusFollowUp } from "@/components/for-mechanics/MechanicRepairStatusFollowUp";
import { MechanicServiceMatching } from "@/components/for-mechanics/MechanicServiceMatching";
import { AiRevenueOSDemoBridge } from "@/components/shared/AiRevenueOSDemoBridge";
import { AiRevenueOSHighlight } from "@/components/shared/AiRevenueOSHighlight";

export const metadata = {
  title: "For mechanics & autobody specialists | TroothHurtz",
  description:
    "Help your shop book more work, reduce missed calls, automate estimate intake and follow-up, and communicate repair status with an AI-powered website and assistant.",
};

const pageBg: CSSProperties = {
  background: `
    radial-gradient(circle at 12% 20%, rgba(71,85,105,0.12), transparent 36%),
    radial-gradient(circle at 88% 8%, rgba(148,163,184,0.08), transparent 30%),
    linear-gradient(180deg, #0a0e14 0%, #070b10 55%, #050608 100%)
  `,
};

const primaryBtnStyle: CSSProperties = {
  background: "linear-gradient(135deg, #64748b, #475569)",
  color: "#fff",
};

const accentBandStyle: CSSProperties = {
  background: "linear-gradient(135deg, #1e293b, #0f172a)",
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
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-[0_8px_30px_rgba(71,85,105,0.28)] transition hover:opacity-95 ${className}`}
    >
      {children}
    </Link>
  );
}

const shareMailto =
  "mailto:?subject=" +
  encodeURIComponent("Auto Specialist — mechanics demo") +
  "&body=" +
  encodeURIComponent("See the TroothHurtz mechanics & autobody experience — intake, booking, and status updates.\n");

export default function ForMechanicsPage() {
  return (
    <div className="min-h-screen text-[#F8FAFC]">
      <div className="fixed inset-0 -z-10" style={pageBg} />

      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#070b10]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[#94A3B8] transition hover:text-[#CBD5E1]"
          >
            <ArrowLeft className="h-4 w-4" />
            Hero Market
          </Link>
          <nav className="order-last flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[#CBD5E1] sm:text-sm md:order-none md:w-auto md:justify-end md:gap-6">
            <a href="#what-helps" className="transition hover:text-white">
              Value
            </a>
            <a href="#ai" className="transition hover:text-white">
              Capabilities
            </a>
            <a href="#ideal" className="transition hover:text-white">
              Who it&apos;s for
            </a>
            <Link href="/for-mechanics/demo" className="transition hover:text-white">
              Live Demo
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/for-mechanics/demo"
              className="rounded-lg border border-white/[0.14] px-3 py-1.5 text-sm font-medium text-[#F8FAFC] transition hover:border-slate-500/40"
            >
              See Demo
            </Link>
            <Link
              href="/consultations"
              style={primaryBtnStyle}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold shadow-lg shadow-slate-900/40 transition hover:opacity-95"
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
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#94a3b8]">
                  Built for Mechanics &amp; Autobody Specialists
                </span>
                <Wrench className="h-4 w-4 text-slate-400" />
              </div>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-[#F8FAFC] md:text-5xl">
                Turn your shop into a 24/7 booking, quote, and customer follow-up machine.
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-[#CBD5E1]">
                From repair requests and estimate intake to appointment scheduling and status updates, give your business
                a system that works even when you&apos;re under the hood.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <PrimaryLink href="/for-mechanics/demo">
                  Book My Demo
                  <ChevronRight className="h-4 w-4" />
                </PrimaryLink>
                <Button
                  variant="outline"
                  asChild
                  className="h-auto rounded-xl border-white/[0.14] bg-transparent px-6 py-3 text-sm font-semibold text-[#F8FAFC] hover:border-slate-500/40 hover:bg-transparent"
                >
                  <a href="#proof">See How It Works</a>
                </Button>
              </div>
              <div className="mt-4">
                <Button variant="ghost" asChild className="h-auto px-0 text-sm text-[#94A3B8] hover:text-[#CBD5E1]">
                  <a href={shareMailto}>Share with your team</a>
                </Button>
              </div>
            </div>

            <div className="relative flex min-h-[280px] flex-col justify-center lg:min-h-[340px]">
              <div className="absolute inset-0 rounded-full bg-slate-500/5 blur-3xl" />
              <div className="relative mx-auto w-full max-w-md space-y-4">
                <GlassCard className="p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-500/25 bg-slate-900/80">
                    <ClipboardList className="h-5 w-5 text-slate-300" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Estimate intake</p>
                  <p className="mt-2 text-sm text-[#CBD5E1]">
                    “2019 SUV — grinding noise under load, photos of bumper damage, need a slot this week.”
                  </p>
                </GlassCard>
                <GlassCard className="p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Status updates</p>
                  <p className="mt-2 text-sm text-[#CBD5E1]">
                    “Estimate approved — parts ordered; we&apos;ll text when the bay is ready for pickup.”
                  </p>
                </GlassCard>
                <GlassCard className="flex items-start gap-3 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-500/25 bg-slate-900/80">
                    <Gauge className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Fewer missed calls</p>
                    <p className="mt-1 text-sm text-[#CBD5E1]">
                      AI + structured intake capture leads when your phone is tied up on the shop floor.
                    </p>
                  </div>
                </GlassCard>
              </div>
            </div>
          </div>
        </section>

        <AiRevenueOSHighlight variant="auto" demoHref="#proof" placement="opening" />

        <section id="what-helps" className="mt-20 scroll-mt-28">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">
            Your shop should not lose money because calls were missed.
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-center text-[#94A3B8]">
            Most repair shops lose leads through missed calls, slow estimate responses, unclear follow-up, and manual
            scheduling. This system helps organize the front end of your business so you can focus on the work.
          </p>
          <div className="mx-auto mt-10 max-w-3xl space-y-3">
            {[
              "Capture service requests automatically",
              "Pre-qualify repair and autobody leads",
              "Book appointments without back-and-forth",
              "Send estimate and repair-status updates",
              "Follow up on abandoned quotes and missed opportunities",
            ].map((line) => (
              <GlassCard key={line} className="flex items-center gap-3 px-5 py-3 text-sm text-[#CBD5E1]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-600/30 text-slate-300">
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
                {line}
              </GlassCard>
            ))}
          </div>
        </section>

        <section id="ai" className="mt-20 scroll-mt-28">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">
            Built for the way repair shops actually operate
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[#94A3B8]">
            From intake to pickup — structured support for the front of the house.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <GlassCard className="p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-500/25 bg-slate-900/80">
                <ClipboardList className="h-5 w-5 text-slate-300" />
              </div>
              <h3 className="font-semibold text-white">Estimate Intake</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#CBD5E1]">
                Customers submit vehicle type, issue, accident or body damage, photos, preferred time, and insurance notes
                — before your writers chase details.
              </p>
            </GlassCard>
            <GlassCard className="p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-500/25 bg-slate-900/80">
                <Calendar className="h-5 w-5 text-slate-300" />
              </div>
              <h3 className="font-semibold text-white">Booking Assistant</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#CBD5E1]">
                Oil changes, diagnostics, brakes, collision consults, paint and body estimates, and follow-up
                appointments — guided by how your shop runs.
              </p>
            </GlassCard>
            <GlassCard className="p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-500/25 bg-slate-900/80">
                <Phone className="h-5 w-5 text-slate-300" />
              </div>
              <h3 className="font-semibold text-white">Repair Status Communication</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#CBD5E1]">
                Intake confirmation, estimate ready, parts delays, completion, and pickup reminders — consistent and
                on-brand.
              </p>
            </GlassCard>
            <GlassCard className="p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-500/25 bg-slate-900/80">
                <Car className="h-5 w-5 text-slate-300" />
              </div>
              <h3 className="font-semibold text-white">Lead Follow-Up</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#CBD5E1]">
                Reconnect with quotes that never booked, maintenance due, past clients, and fleet or commercial leads.
              </p>
            </GlassCard>
            <GlassCard className="p-6 md:col-span-2 lg:col-span-2">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-500/25 bg-slate-900/80">
                <Building2 className="h-5 w-5 text-slate-300" />
              </div>
              <h3 className="font-semibold text-white">Shop Visibility</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#CBD5E1]">
                Clear services, before/after examples, reviews, hours, quote forms, and financing or contact options —
                your website as a real business tool, not a brochure.
              </p>
            </GlassCard>
          </div>
        </section>

        <section className="mt-20">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">
            Faster response times. Better customer trust. More booked jobs.
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-center text-[#94A3B8]">
            When people need a mechanic or autobody specialist, they usually want help now. A system that responds quickly
            and clearly can increase bookings and reduce lost jobs.
          </p>
          <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-2">
            {[
              "Fewer missed opportunities",
              "Better customer communication",
              "More organized intake",
              "Less front-desk pressure",
              "Stronger professional image",
              "More repeat business",
            ].map((line) => (
              <GlassCard key={line} className="px-4 py-3 text-sm text-[#CBD5E1]">
                {line}
              </GlassCard>
            ))}
          </div>
        </section>

        <section id="ideal" className="mt-20 scroll-mt-28">
          <h2 className="text-center text-2xl font-bold text-[#F8FAFC] md:text-3xl">
            Made for independent shops and growing service businesses
          </h2>
          <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Auto repair shops",
              "Mobile mechanics",
              "Collision repair specialists",
              "Paint and body shops",
              "Tire and brake shops",
              "Diagnostic technicians",
              "Fleet service providers",
              "Specialty automotive businesses",
            ].map((line) => (
              <GlassCard key={line} className="px-4 py-3 text-center text-sm text-[#CBD5E1]">
                {line}
              </GlassCard>
            ))}
          </div>
        </section>

        <div id="proof" className="scroll-mt-28">
          <MechanicServiceMatching />
          <MechanicEstimateIntakePreview />
          <MechanicPolicyAwareBooking />
          <MechanicRepairStatusFollowUp />
        </div>

        <AiRevenueOSHighlight variant="auto" demoHref="#proof" placement="closing" />

        <AiRevenueOSDemoBridge />

        <section className="mt-12 md:mt-16">
          <div
            style={accentBandStyle}
            className="rounded-[24px] border border-white/10 p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.35)] md:p-12"
          >
            <h2 className="text-2xl font-bold text-white md:text-3xl">
              Let your website help run the front end of your shop.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300 md:text-base">
              We help mechanics and autobody specialists turn their websites into a working business system with
              AI-powered intake, follow-up, and booking support.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/consultations"
                className="inline-flex items-center justify-center rounded-xl bg-slate-400 px-8 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:bg-slate-300"
              >
                Get Started
              </Link>
              <Link
                href="/for-mechanics/demo"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-8 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10"
              >
                View Live Demo
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-16 border-t border-slate-800 bg-[#050608] px-4 py-12">
          <p className="mx-auto max-w-2xl text-center text-sm text-slate-400">
            Full SMS, shop management, and POS integrations live in your production workspace. This experience is a static
            preview — your team maps services, bays, and policies during onboarding.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] text-slate-500">
            The floating assistant uses{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">
              NEXT_PUBLIC_MECHANICS_DEMO_WIDGET_KEY
            </code>{" "}
            (separate from other vertical widget keys). Set it after you create the mechanics agent in AI Agency and
            generate its widget key.
          </p>
        </section>
      </main>

      <MechanicLeenaChat />
    </div>
  );
}
