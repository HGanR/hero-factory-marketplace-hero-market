import type { CSSProperties } from "react";
import Link from "next/link";
import { DeadNavLink } from "@/components/for-realtors/DeadNavLink";
import { TransportationPageBanner } from "@/components/for-transportation-services/TransportationPageBanner";
import { TransportLeenaChat } from "@/components/for-transportation-services/TransportLeenaChat";
import { TransportPolicyBookingPreview } from "@/components/for-transportation-services/TransportPolicyBookingPreview";
import { TransportPremiumExperiencePreview } from "@/components/for-transportation-services/TransportPremiumExperiencePreview";
import { TransportSchedulingPreview } from "@/components/for-transportation-services/TransportSchedulingPreview";
import { TransportTripMatchingPreview } from "@/components/for-transportation-services/TransportTripMatchingPreview";

export const metadata = {
  title: "Transportation services demo | TroothHurtz",
  description: "Trip matching, scheduling, policies, and premium client experience — transportation demo.",
};

const pageBg: CSSProperties = {
  background: "#080706",
};

export default function ForTransportationServicesDemoPage() {
  return (
    <div className="min-h-screen text-slate-100" style={pageBg}>
      <div className="bg-gradient-to-r from-amber-600/90 via-stone-800 to-stone-950 px-4 py-2 text-center text-xs font-medium text-white/95 sm:text-left">
        <span>(555) 000-0000</span>
        <span className="mx-3 hidden sm:inline">·</span>
        <span className="text-white/85">24/7 dispatch · Licensed &amp; insured</span>
      </div>

      <header className="border-b border-slate-800/80 bg-[#080706]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link
            href="/for-transportation-services"
            className="flex items-baseline gap-2 text-white transition hover:text-amber-200"
          >
            <span className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Metropolitan</span>
            <span className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Car</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-6 text-sm">
            <DeadNavLink>Home</DeadNavLink>
            <DeadNavLink>Services</DeadNavLink>
            <DeadNavLink>Corporate</DeadNavLink>
            <DeadNavLink>Contact</DeadNavLink>
          </nav>
          <Link href="/for-transportation-services" className="text-xs font-medium text-amber-400 hover:text-amber-300">
            ← Transportation overview
          </Link>
        </div>
      </header>

      <TransportationPageBanner />

      <TransportTripMatchingPreview />
      <TransportSchedulingPreview />
      <TransportPolicyBookingPreview />
      <TransportPremiumExperiencePreview />

      <section className="border-t border-slate-800 bg-[#0c0a08] px-4 py-12">
        <p className="mx-auto max-w-2xl text-center text-sm text-slate-400">
          Full dispatch, fleet, and payment workflows live in your production workspace. This page is a static preview
          — your team maps service areas, tariffs, and compliance during onboarding.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] text-slate-500">
          The floating assistant uses{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">NEXT_PUBLIC_TRANSPORT_DEMO_WIDGET_KEY</code>{" "}
          (separate from other vertical widget keys). Set it after you create the transportation agent in AI Agency and
          generate its widget key.
        </p>
      </section>

      <TransportLeenaChat />
    </div>
  );
}
