import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { DeadNavLink } from "@/components/for-realtors/DeadNavLink";

export const metadata = {
  title: "Stylist schedule — Studio North demo | TroothHurtz",
  description:
    "Example of what a stylist sees in the admin calendar when appointments are booked — illustrative preview only.",
};

const pageBg: CSSProperties = {
  background: "#0c1222",
};

export default function SalonDemoStylistCalendarPage() {
  return (
    <div className="min-h-screen text-slate-100" style={pageBg}>
      <div className="bg-gradient-to-r from-[#7C3AED] to-[#2563EB] px-4 py-2 text-center text-xs font-medium text-white/95 sm:text-left">
        <span>(555) 000-0000</span>
        <span className="mx-3 hidden sm:inline">·</span>
        <span className="text-white/85">Bookings &amp; guest care</span>
      </div>

      <header className="border-b border-slate-800/80 bg-[#0a0f1a]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link
            href="/for-salon-professionals/demo"
            className="flex items-baseline gap-2 text-white transition hover:text-violet-200"
          >
            <span className="font-serif text-2xl font-semibold tracking-tight md:text-3xl">Studio</span>
            <span className="text-sm font-bold uppercase tracking-[0.25em] text-slate-400">North</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-6 text-sm">
            <DeadNavLink>Home</DeadNavLink>
            <DeadNavLink>Services</DeadNavLink>
            <DeadNavLink>About</DeadNavLink>
            <span className="font-medium text-white">Book</span>
          </nav>
          <Link href="/for-salon-professionals/demo" className="text-xs font-medium text-blue-400 hover:text-blue-300">
            ← Demo site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-violet-300/90">Stylist view</p>
        <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">Your schedule — example admin calendar</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400 md:text-base">
          When guests book through your AI-assisted flow, confirmed appointments can appear in a calendar like this one
          so stylists and managers see the day at a glance. This screen is an illustrative preview — not your live data.
        </p>

        <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0e14] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="border-b border-white/10 bg-slate-950/80 px-4 py-3 text-center sm:text-left">
            <p className="text-xs font-medium text-slate-400">
              Reference layout: weekly view, sidebar summary, and color-coded blocks — similar to what a production admin
              can offer after onboarding.
            </p>
          </div>
          <div className="relative w-full bg-[#06090e]">
            <Image
              src="/for-salon-professionals/stylist-calendar-reference.png"
              alt="Example stylist admin calendar with weekly grid and sidebar"
              width={1024}
              height={664}
              className="h-auto w-full object-top"
              priority
              sizes="(max-width: 1200px) 100vw, 1152px"
            />
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-[13px] leading-relaxed text-slate-500">
          In a full build, this view connects to your real scheduling rules, services, and team. Colors and labels can
          map to service types (e.g. color, cut, treatment) so the chair stays organized without extra DMs.
        </p>
      </main>
    </div>
  );
}
