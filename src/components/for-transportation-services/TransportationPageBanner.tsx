import Link from "next/link";
import { Car, ChevronRight, HelpCircle, Plane } from "lucide-react";

export function TransportationPageBanner() {
  return (
    <section className="border-b border-amber-900/30 bg-gradient-to-br from-[#0c0a08] via-[#0f0d0a] to-[#080706] px-4 py-12 md:py-16">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-amber-200/80">Transportation Demo</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
            Your site should book rides — not just list a phone number.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-300 md:text-lg">
            Trip intake, availability questions, policy clarity, and a premium first impression — built for operators who
            run on precision and discretion.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/consultations"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600/90 to-amber-700 px-6 py-3 text-sm font-semibold text-black shadow-[0_8px_30px_rgba(217,119,6,0.2)] transition hover:opacity-95"
            >
              Book setup
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/for-transportation-services"
              className="inline-flex items-center justify-center rounded-xl border border-white/12 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-amber-500/30 hover:bg-white/10"
            >
              Overview
            </Link>
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-2xl border border-amber-500/15 bg-[#12100e]/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
          aria-hidden
        >
          <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-xs text-slate-400">
            <Plane className="h-4 w-4 text-amber-400/90" />
            <span className="font-medium text-slate-300">Reserve · Metropolitan Car</span>
            <span className="ml-auto rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
              Preview
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {[
              { label: "Airport transfer quote", icon: Plane },
              { label: "Executive pickup (hourly)", icon: Car },
              { label: "Wedding / event block", icon: Car },
              { label: "Ask about wait time & cancellation", icon: HelpCircle },
            ].map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0a0908] px-4 py-3 text-sm text-slate-200 transition hover:border-amber-500/20"
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-amber-500/80" />
                  {label}
                </span>
                <ChevronRight className="h-4 w-4 text-amber-600/60" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
