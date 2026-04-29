import Link from "next/link";
import { ChevronRight, Globe } from "lucide-react";

/**
 * Top-of-demo banner for the insurance broker experience.
 */
export function InsuranceBrokerPageBanner() {
  return (
    <section className="border-b border-cyan-950/40 bg-gradient-to-br from-[#07111a] via-[#08131d] to-[#050a0f] px-4 py-12 md:py-16">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-cyan-300/90">Insurance Broker Demo</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
            Your brokerage site should do more than sit there. It should help close business.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-300 md:text-lg">
            Quote intake, common-question handling, renewal routing, and follow-up support built into a broker-ready
            experience that works around the clock.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/consultations"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(6,182,212,0.25)] transition hover:opacity-95"
            >
              Book setup
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/for-insurance-brokers"
              className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-500/35 hover:bg-white/10"
            >
              Broker overview
            </Link>
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#0a1520]/90 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
          aria-hidden
        >
          <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-xs text-slate-400">
            <Globe className="h-4 w-4 text-cyan-400/90" />
            <span className="font-medium text-slate-300">yourbrokerage.com</span>
            <span className="ml-auto rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">
              Preview
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {["Get a quote", "Renew my policy", "Ask a coverage question", "Upload documents"].map((label) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-slate-950/60 px-4 py-3 text-sm text-slate-200 transition hover:border-cyan-500/25"
              >
                <span>{label}</span>
                <ChevronRight className="h-4 w-4 text-cyan-500/70" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
