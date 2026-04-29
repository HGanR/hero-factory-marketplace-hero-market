import type { CSSProperties } from "react";
import Link from "next/link";
import { DeadNavLink } from "@/components/for-realtors/DeadNavLink";
import { TaxLeenaChat } from "@/components/for-tax-professionals/TaxLeenaChat";
import { TaxPolicyAwareBooking } from "@/components/for-tax-professionals/TaxPolicyAwareBooking";
import { TaxSchedulingPreview } from "@/components/for-tax-professionals/TaxSchedulingPreview";
import { TaxServiceMatching } from "@/components/for-tax-professionals/TaxServiceMatching";

export const metadata = {
  title: "Tax professional demo | TroothHurtz",
  description: "Service matching, intake, and workflow guidance — tax professional demo experience.",
};

const pageBg: CSSProperties = {
  background: "#070b14",
};

export default function ForTaxProfessionalsDemoPage() {
  return (
    <div className="min-h-screen text-slate-100" style={pageBg}>
      <div className="bg-gradient-to-r from-amber-700/90 via-stone-800 to-[#070b14] px-4 py-2 text-center text-xs font-medium text-white/95 sm:text-left">
        <span>(800) 000-0000</span>
        <span className="mx-3 hidden sm:inline">·</span>
        <span className="text-white/85">Tax prep &amp; advisory · By appointment</span>
      </div>

      <header className="border-b border-slate-800/80 bg-[#070b14]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link
            href="/for-tax-professionals"
            className="flex items-baseline gap-2 text-white transition hover:text-amber-200"
          >
            <span className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Summit</span>
            <span className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Tax Group</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-6 text-sm">
            <DeadNavLink>Home</DeadNavLink>
            <DeadNavLink>Individuals</DeadNavLink>
            <DeadNavLink>Business</DeadNavLink>
            <DeadNavLink>Contact</DeadNavLink>
          </nav>
          <Link href="/for-tax-professionals" className="text-xs font-medium text-amber-400 hover:text-amber-300">
            ← Tax overview
          </Link>
        </div>
      </header>

      <TaxServiceMatching />
      <TaxSchedulingPreview />
      <TaxPolicyAwareBooking />

      <section className="border-t border-slate-800 bg-[#05080f] px-4 py-12">
        <p className="mx-auto max-w-2xl text-center text-sm text-slate-400">
          Full intake, CRM routing, and tax software workflows live in your production workspace. This page is a static
          preview — your team maps services, jurisdictions, and document rules during onboarding.
        </p>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[13px] text-slate-500">
          The floating assistant uses{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-200">
            NEXT_PUBLIC_TAX_DEMO_WIDGET_KEY
          </code>{" "}
          (separate from other vertical widget keys). Set it after you create the tax professional agent in AI Agency and
          generate its widget key.
        </p>
      </section>

      <TaxLeenaChat />
    </div>
  );
}
