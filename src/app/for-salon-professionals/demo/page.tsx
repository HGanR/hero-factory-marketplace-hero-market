import type { CSSProperties } from "react";
import Link from "next/link";
import { DeadNavLink } from "@/components/for-realtors/DeadNavLink";
import { SalonLeenaChat } from "@/components/for-salon-professionals/SalonLeenaChat";
import { SalonSchedulingPreview } from "@/components/for-salon-professionals/SalonSchedulingPreview";
import { SalonServiceMatching } from "@/components/for-salon-professionals/SalonServiceMatching";
import { SalonPolicyAwareBooking } from "@/components/for-salon-professionals/SalonPolicyAwareBooking";
import { SalonPricingIntelligence } from "@/components/for-salon-professionals/SalonPricingIntelligence";

export const metadata = {
  title: "Studio North — Demo | TroothHurtz",
  description: "Live demo salon experience — book, browse services, and see the client journey.",
};

const pageBg: CSSProperties = {
  background: "#0c1222",
};

export default function ForSalonProfessionalsDemoPage() {
  return (
    <div className="min-h-screen text-slate-100" style={pageBg}>
      <div className="bg-gradient-to-r from-[#7C3AED] to-[#2563EB] px-4 py-2 text-center text-xs font-medium text-white/95 sm:text-left">
        <span>(555) 000-0000</span>
        <span className="mx-3 hidden sm:inline">·</span>
        <span className="text-white/85">Bookings &amp; guest care</span>
      </div>

      <header className="border-b border-slate-800/80 bg-[#0a0f1a]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-2xl font-semibold tracking-tight text-white md:text-3xl">Studio</span>
            <span className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">North</span>
          </div>
          <nav className="flex flex-wrap items-center gap-6 text-sm">
            <DeadNavLink>Home</DeadNavLink>
            <DeadNavLink>Services</DeadNavLink>
            <DeadNavLink>About</DeadNavLink>
            <Link
              href="/for-salon-professionals/demo/calendar"
              className="font-medium text-white underline decoration-violet-400/50 underline-offset-4 transition hover:text-violet-200"
            >
              Book
            </Link>
          </nav>
          <Link href="/for-salon-professionals" className="text-xs font-medium text-blue-400 hover:text-blue-300">
            ← Salon overview
          </Link>
        </div>
      </header>

      <section className="relative min-h-[72vh] w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/a_digital_portrait_photograph_features_two_women_s.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/78"
          aria-hidden
        />
        <div className="relative z-10 mx-auto flex min-h-[72vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.4em] text-violet-200/90">
            Bookings &amp; guest care
          </p>
          <h1 className="font-serif text-5xl font-semibold text-white drop-shadow-md md:text-6xl">Studio North</h1>
          <p className="mt-8 max-w-xl text-2xl font-bold uppercase leading-snug tracking-wide text-white drop-shadow md:text-3xl">
            Look great. Book easy.
          </p>
          <div className="mt-8 max-w-md rounded-lg border border-white/15 bg-black/40 px-4 py-4 text-left text-sm text-slate-200 backdrop-blur-sm">
            <p className="font-semibold text-white">This is a live demo</p>
            <p className="mt-2 text-slate-300/95">
              Walk through the experience as if you were a guest — then head back to the{" "}
              <Link href="/for-salon-professionals" className="text-blue-400 underline-offset-2 hover:underline">
                salon overview
              </Link>{" "}
              to connect it to your real services, policies, and brand.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/for-salon-professionals"
                className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-100"
              >
                Back to overview
              </Link>
              <Link
                href="/consultations"
                className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Book onboarding
              </Link>
            </div>
          </div>
        </div>
      </section>

      <SalonServiceMatching />

      <SalonPricingIntelligence />

      <SalonSchedulingPreview />

      <SalonPolicyAwareBooking />

      <section className="border-t border-slate-800 bg-[#0f172a] px-4 py-12">
        <p className="mx-auto max-w-2xl text-center text-sm text-slate-400">
          Full assistant + intake + scheduling flows live in your production workspace. This page is a static preview of
          the look and feel — your team will map the same shell to your real menu, pricing, and deposit rules.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] text-slate-500">
          The floating assistant uses{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">NEXT_PUBLIC_SALON_DEMO_WIDGET_KEY</code>{" "}
          (separate from{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">NEXT_PUBLIC_RET_WIDGET_KEY</code>
          ). Set it after you create the salon agent in AI Agency and generate its widget key.
        </p>
      </section>

      <SalonLeenaChat />
    </div>
  );
}
