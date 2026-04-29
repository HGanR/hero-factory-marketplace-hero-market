import type { CSSProperties } from "react";
import Link from "next/link";
import { DeadNavLink } from "@/components/for-realtors/DeadNavLink";
import { InsuranceBrokerPageBanner } from "@/components/for-insurance-brokers/InsuranceBrokerPageBanner";
import { InsuranceCoverageGuidancePreview } from "@/components/for-insurance-brokers/InsuranceCoverageGuidancePreview";
import { InsuranceLeadIntakePreview } from "@/components/for-insurance-brokers/InsuranceLeadIntakePreview";
import { InsuranceLeenaChat } from "@/components/for-insurance-brokers/InsuranceLeenaChat";
import { InsuranceRenewalRetentionPreview } from "@/components/for-insurance-brokers/InsuranceRenewalRetentionPreview";

export const metadata = {
  title: "Insurance broker demo | TroothHurtz",
  description: "Quote intake, coverage guidance, and renewal routing — broker-ready demo experience.",
};

const pageBg: CSSProperties = {
  background: "#050a0f",
};

export default function ForInsuranceBrokersDemoPage() {
  return (
    <div className="min-h-screen text-slate-100" style={pageBg}>
      <div className="bg-gradient-to-r from-[#0e7490] via-[#0369a1] to-[#1d4ed8] px-4 py-2 text-center text-xs font-medium text-white/95 sm:text-left">
        <span>(800) 000-0000</span>
        <span className="mx-3 hidden sm:inline">·</span>
        <span className="text-white/90">Licensed agents · By appointment</span>
      </div>

      <header className="border-b border-slate-800/80 bg-[#050a0f]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link href="/for-insurance-brokers" className="flex items-baseline gap-2 text-white transition hover:text-cyan-200">
            <span className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Harbor</span>
            <span className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Risk Partners</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-6 text-sm">
            <DeadNavLink>Home</DeadNavLink>
            <DeadNavLink>Personal</DeadNavLink>
            <DeadNavLink>Commercial</DeadNavLink>
            <DeadNavLink>Claims</DeadNavLink>
          </nav>
          <Link href="/for-insurance-brokers" className="text-xs font-medium text-cyan-400 hover:text-cyan-300">
            ← Broker overview
          </Link>
        </div>
      </header>

      <InsuranceBrokerPageBanner />

      <InsuranceLeadIntakePreview />
      <InsuranceCoverageGuidancePreview />
      <InsuranceRenewalRetentionPreview />

      <section className="border-t border-slate-800 bg-[#07111a] px-4 py-12">
        <p className="mx-auto max-w-2xl text-center text-sm text-slate-400">
          Full intake, CRM routing, and carrier workflows live in your production workspace. This page is a static preview
          — your team maps disclosures, state rules, and carrier requirements during onboarding.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] text-slate-500">
          The floating assistant uses{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">NEXT_PUBLIC_INSURANCE_DEMO_WIDGET_KEY</code>{" "}
          (separate from other vertical widget keys). Set it after you create the insurance broker agent in AI Agency and
          generate its widget key.
        </p>
      </section>

      <InsuranceLeenaChat />
    </div>
  );
}
