import type { CSSProperties } from "react";
import Link from "next/link";
import { DeadNavLink } from "@/components/for-realtors/DeadNavLink";
import { MechanicDemoHero } from "@/components/for-mechanics/MechanicDemoHero";
import { MechanicEstimateIntakePreview } from "@/components/for-mechanics/MechanicEstimateIntakePreview";
import { MechanicLeenaChat } from "@/components/for-mechanics/MechanicLeenaChat";
import { MechanicPolicyAwareBooking } from "@/components/for-mechanics/MechanicPolicyAwareBooking";
import { MechanicRepairStatusFollowUp } from "@/components/for-mechanics/MechanicRepairStatusFollowUp";
import { MechanicServiceMatching } from "@/components/for-mechanics/MechanicServiceMatching";

export const metadata = {
  title: "Mechanics & autobody demo | TroothHurtz",
  description:
    "Live preview: service matching, estimate intake, policy-aware booking, and repair status updates for auto shops.",
};

const pageBg: CSSProperties = {
  background: "#070b10",
};

export default function ForMechanicsDemoPage() {
  return (
    <div className="min-h-screen text-slate-100" style={pageBg}>
      <div className="bg-gradient-to-r from-slate-700/90 via-slate-900 to-[#070b10] px-4 py-2 text-center text-xs font-medium text-white/95 sm:text-left">
        <span>(555) 000-0000</span>
        <span className="mx-3 hidden sm:inline">·</span>
        <span className="text-white/85">ASE-certified · Estimates by appointment</span>
      </div>

      <header className="border-b border-slate-800/80 bg-[#070b10]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link
            href="/for-mechanics"
            className="flex items-baseline gap-2 text-white transition hover:text-slate-300"
          >
            <span className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Ironline</span>
            <span className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Auto &amp; Body</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-6 text-sm">
            <DeadNavLink>Home</DeadNavLink>
            <DeadNavLink>Services</DeadNavLink>
            <DeadNavLink>Collision</DeadNavLink>
            <DeadNavLink>Book</DeadNavLink>
          </nav>
          <Link href="/for-mechanics" className="text-xs font-medium text-slate-400 hover:text-slate-300">
            ← Auto Specialist overview
          </Link>
        </div>
      </header>

      <MechanicDemoHero />

      <div id="demo-proof" className="scroll-mt-24">
        <MechanicServiceMatching />
      </div>
      <MechanicEstimateIntakePreview />
      <MechanicPolicyAwareBooking />
      <MechanicRepairStatusFollowUp />

      <section className="border-t border-slate-800/80 bg-gradient-to-b from-[#0a0e12] to-[#070b10] px-4 py-16 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            Built for shops that want to look modern and operate smarter.
          </h2>
          <p className="mt-4 text-slate-400">
            Whether you run a local mechanic shop or an autobody operation, this system helps you capture more work and
            communicate better — without hiring a second front desk.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/consultations"
              className="inline-flex items-center justify-center rounded-xl bg-slate-500 px-8 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-400"
            >
              Build My Shop Demo
            </Link>
            <Link
              href="/for-mechanics"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-8 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Full overview
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-[#050608] px-4 py-12">
        <p className="mx-auto max-w-2xl text-center text-sm text-slate-400">
          Full calendar, estimating, and SMS integrations live in your production workspace. This page is a static
          preview — your team maps labor, parts, and compliance during onboarding.
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

      <MechanicLeenaChat />
    </div>
  );
}
