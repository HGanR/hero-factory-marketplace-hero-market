import type { CSSProperties } from "react";
import Link from "next/link";
import { DeadNavLink } from "@/components/for-realtors/DeadNavLink";
import { BarbershopBookingPreview } from "@/components/for-barbershops/BarbershopBookingPreview";
import { BarbershopDemoHero } from "@/components/for-barbershops/BarbershopDemoHero";
import { BarbershopLeenaChat } from "@/components/for-barbershops/BarbershopLeenaChat";
import { BarbershopPolicyAwareBooking } from "@/components/for-barbershops/BarbershopPolicyAwareBooking";
import { BarbershopPromoEngine } from "@/components/for-barbershops/BarbershopPromoEngine";
import { BarbershopRebookingEngine } from "@/components/for-barbershops/BarbershopRebookingEngine";

export const metadata = {
  title: "Barbershop demo | TroothHurtz",
  description:
    "Live preview: booking intake, policy messaging, rebooking, promos, and AI shop assistant for barbershops.",
};

const pageBg: CSSProperties = {
  background: "#080706",
};

export default function ForBarbershopsDemoPage() {
  return (
    <div className="min-h-screen text-slate-100" style={pageBg}>
      <div className="bg-gradient-to-r from-amber-800/90 via-stone-900 to-[#080706] px-4 py-2 text-center text-xs font-medium text-white/95 sm:text-left">
        <span>(555) 000-0000</span>
        <span className="mx-3 hidden sm:inline">·</span>
        <span className="text-white/85">Walk-ins welcome · Book online</span>
      </div>

      <header className="border-b border-slate-800/80 bg-[#080706]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link
            href="/for-barbershops"
            className="flex items-baseline gap-2 text-white transition hover:text-amber-200"
          >
            <span className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Iron &amp; Oak</span>
            <span className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Barbershop</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-6 text-sm">
            <DeadNavLink>Home</DeadNavLink>
            <DeadNavLink>Services</DeadNavLink>
            <DeadNavLink>Barbers</DeadNavLink>
            <DeadNavLink>Book</DeadNavLink>
          </nav>
          <Link href="/for-barbershops" className="text-xs font-medium text-amber-400 hover:text-amber-300">
            ← Barbershop overview
          </Link>
        </div>
      </header>

      <BarbershopDemoHero />

      <BarbershopBookingPreview />
      <BarbershopPolicyAwareBooking />
      <BarbershopRebookingEngine />
      <BarbershopPromoEngine />

      <section className="border-t border-slate-800/80 bg-gradient-to-b from-[#0c0a08] to-[#080706] px-4 py-16 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-white md:text-3xl">Ready to stop losing bookings to silence?</h2>
          <p className="mt-4 text-slate-400">
            Pair this experience with your real calendar and policies — we help you launch without rebuilding your brand
            from scratch.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/consultations"
              className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-8 py-3 text-sm font-semibold text-black shadow-lg transition hover:bg-amber-500"
            >
              Get My Barbershop Page
            </Link>
            <Link
              href="/for-barbershops"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-8 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Back to overview
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800 bg-[#050403] px-4 py-12">
        <p className="mx-auto max-w-2xl text-center text-sm text-slate-400">
          Full booking, SMS, and marketing automation live in your production workspace. This page is a static preview —
          your team maps barbers, services, and compliance during onboarding.
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

      <BarbershopLeenaChat />
    </div>
  );
}
