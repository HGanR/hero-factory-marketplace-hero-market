import Link from "next/link";
import { ChevronRight, Wrench } from "lucide-react";

export function MechanicDemoHero() {
  return (
    <section className="border-b border-slate-800/80 bg-gradient-to-br from-[#0f172a] via-[#0a0e14] to-[#070b10] px-4 py-12 md:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-500/30 bg-slate-900/80">
            <Wrench className="h-5 w-5 text-slate-300" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-slate-400">Live Demo</p>
        </div>
        <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
          See how a mechanic or autobody AI assistant works in real time.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-300 md:text-lg">
          This demo shows how customers can ask about services, request estimates, submit repair details, and get guided
          toward booking — before your team picks up the phone.
        </p>
        <div className="mt-8">
          <a
            href="#demo-proof"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(71,85,105,0.3)] transition hover:opacity-95"
          >
            Try the Demo
            <ChevronRight className="h-4 w-4" />
          </a>
        </div>
        <p className="mt-6 text-sm text-slate-500">
          <Link href="/for-mechanics" className="text-slate-400 underline-offset-4 hover:text-slate-300 hover:underline">
            ← Auto Specialist overview
          </Link>
        </p>
      </div>
    </section>
  );
}
