import Link from "next/link";
import { ChevronRight, Scissors } from "lucide-react";

/**
 * Top-of-demo hero for the barbershop live preview page.
 */
export function BarbershopDemoHero() {
  return (
    <section className="border-b border-slate-800/80 bg-gradient-to-br from-[#1c1917] via-[#0c0a08] to-[#080706] px-4 py-12 md:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-950/20">
            <Scissors className="h-5 w-5 text-amber-400" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-amber-200/80">Live preview</p>
        </div>
        <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
          Your shop assistant that works even when you&apos;re cutting hair.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300 md:text-lg">
          Scroll through booking, policy, follow-up, and promo flows — then open the assistant to ask anything a client
          would. This is a static preview; production connects to your calendar, SMS, and brand rules.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/consultations"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-3 text-sm font-semibold text-black shadow-[0_8px_30px_rgba(217,119,6,0.25)] transition hover:opacity-95"
          >
            Get My Barbershop Page
            <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href="/for-barbershops"
            className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-amber-500/35 hover:bg-white/10"
          >
            Barbershop overview
          </Link>
        </div>
      </div>
    </section>
  );
}
