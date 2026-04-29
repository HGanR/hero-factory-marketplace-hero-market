import type { CSSProperties } from "react";
import Link from "next/link";
import { BuyerDemoSiteSchemaSections } from "@/components/for-realtors/BuyerDemoSiteSchemaSections";
import { MaaniaDemoHeroShell } from "@/components/for-realtors/MaaniaDemoHeroShell";
import { MaaniaDemoPageBanner } from "@/components/for-realtors/MaaniaDemoPageBanner";
import { DeadNavLink } from "@/components/for-realtors/DeadNavLink";
import { MaaniaRealtorChat } from "@/components/for-realtors/MaaniaRealtorChat";

export const metadata = {
  title: "E-Z Realty — Demo | TroothHurtz",
  description: "Demo realtor landing page with MAANIA for intake and listing copy ideas.",
};

const pageBg: CSSProperties = {
  background: "#0c1222",
};

export default function ForRealtorsDemoPage() {
  return (
    <div className="min-h-screen text-slate-100" style={pageBg}>
      {/* Utility strip */}
      <div className="bg-[#2563EB] px-4 py-2 text-center text-xs font-medium text-white/95 sm:text-left">
        <span>(555) 000-0000</span>
        <span className="mx-3 hidden sm:inline">·</span>
        <span className="text-white/85">Sales &amp; Management</span>
      </div>

      {/* Nav */}
      <header className="border-b border-slate-800/80 bg-[#0a0f1a]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-baseline gap-1">
            <span className="font-serif text-2xl font-semibold tracking-tight text-white md:text-3xl">E-Z</span>
            <span className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">Realty</span>
          </div>
          <nav className="flex flex-wrap items-center gap-6 text-sm">
            <DeadNavLink>Home</DeadNavLink>
            <DeadNavLink>About</DeadNavLink>
            <DeadNavLink>Listings</DeadNavLink>
            <DeadNavLink>Contact</DeadNavLink>
          </nav>
          <Link href="/for-realtors" className="text-xs font-medium text-blue-400 hover:text-blue-300">
            ← Platform overview
          </Link>
        </div>
      </header>

      {/* Hero — local house image + readable overlay */}
      <section className="relative min-h-[78vh] w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/for-realtors/demo-hero.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/75"
          aria-hidden
        />
        <div className="relative z-10 mx-auto flex min-h-[78vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
          <MaaniaDemoHeroShell
            fallback={
              <>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.4em] text-blue-200/90">
                  Sales &amp; Management
                </p>
                <h1 className="font-serif text-5xl font-semibold text-white drop-shadow-md md:text-6xl">E-Z Realty</h1>
                <p className="mt-8 max-w-xl text-2xl font-bold uppercase leading-snug tracking-wide text-white drop-shadow md:text-3xl">
                  Sell or Find Your Dream Home
                </p>
                <p className="mt-6 max-w-md rounded-lg border border-white/15 bg-black/35 px-4 py-3 text-sm text-slate-200 backdrop-blur-sm">
                  <span className="font-semibold text-white">This is a Demo Page</span>
                  <span className="block mt-2 text-slate-300/95">
                    Use <strong className="text-white">MAANIA</strong> — our demo chatbot in the lower right — for intake
                    questions and listing copy ideas. We&apos;ll bring the full experience to life next.
                  </span>
                </p>
              </>
            }
          />
        </div>
      </section>

      {/* Light content band — static copy + MAANIA Site Builder block preview when session has schema */}
      <section className="border-t border-slate-800 bg-[#0f172a] px-4 py-12">
        <MaaniaDemoPageBanner />
        <p className="mx-auto mb-8 max-w-2xl text-center text-[13px] text-slate-500">
          This preview updates as MAANIA collects more detail.
        </p>
        <BuyerDemoSiteSchemaSections />
        <div className="mx-auto mt-10 max-w-2xl">
          <div className="relative overflow-hidden rounded-2xl border border-blue-400/35 bg-gradient-to-br from-blue-600/25 via-slate-900/95 to-violet-700/20 p-6 text-center shadow-[0_0_48px_rgba(37,99,235,0.2),inset_0_1px_0_rgba(255,255,255,0.06)] md:p-8">
            <div className="pointer-events-none absolute -left-20 top-0 h-44 w-44 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="pointer-events-none absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />
            <p className="relative text-[11px] font-bold uppercase tracking-[0.35em] text-cyan-200/95">You&apos;re looking at the future of the first showing</p>
            <h3 className="relative mt-3 bg-gradient-to-r from-white via-blue-100 to-cyan-100 bg-clip-text text-xl font-extrabold tracking-tight text-transparent md:text-2xl">
              One link. One assistant. A listing that sells itself before you open the door.
            </h3>
            <p className="relative mt-4 text-sm leading-relaxed text-slate-200/95 md:text-base">
              <span className="font-semibold text-white">MAANIA</span> in the corner isn&apos;t decoration — she&apos;s
              capturing intake, sharpening your pitch, and feeding what you see on this page as you go. When
              you&apos;re ready to run the full deal flow, step into the{" "}
              <Link
                href="/ret"
                className="font-semibold text-cyan-300 underline decoration-cyan-400/50 underline-offset-2 transition hover:text-white"
              >
                RET workspace
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <MaaniaRealtorChat pageSource="realtor-demo" />
    </div>
  );
}
