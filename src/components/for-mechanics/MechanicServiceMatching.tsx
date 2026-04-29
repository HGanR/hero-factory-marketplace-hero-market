import { Check } from "lucide-react";

function ServiceMatchingMock() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-slate-500/25 bg-gradient-to-b from-[#0f1419] to-[#070b10] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Intake preview</p>
        <span className="rounded-full border border-slate-500/40 bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-300">
          Demo
        </span>
      </div>
      <div className="space-y-2.5 p-4 text-[13px] leading-relaxed">
        <div className="flex justify-end">
          <div className="max-w-[90%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-3 text-slate-100">
            <p className="text-[10px] text-slate-500">Customer</p>
            <p className="mt-1">My car pulls to the left and the brakes squeal — also have a dent on the rear quarter.</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-slate-500/30 bg-slate-900/80 px-4 py-3 text-slate-100">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Assistant</p>
            <p className="mt-2">
              I can route this two ways: mechanical diagnostics and brake inspection, or autobody for the dent. Which
              should we prioritize first — safety/steering, or the body work estimate?
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-2.5">
            <p className="text-[10px] text-slate-500">Customer</p>
            <p className="mt-1">Brakes first — body can wait.</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-amber-500/20 bg-amber-950/15 px-4 py-3 text-slate-200">
            <p className="text-[10px] font-semibold uppercase text-amber-300/80">Assistant</p>
            <p className="mt-2">
              Got it. I&apos;ll start an intake for diagnostics + brakes and note the body damage for a separate estimate
              when you&apos;re ready.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MechanicServiceMatching() {
  const bullets = [
    "Reduces confusion between mechanical and collision requests",
    "Gets customers to the right next step",
    "Filters repair vs. autobody before your team picks up",
    "Improves inquiry quality for the front desk",
  ];

  return (
    <section className="border-t border-slate-800/80 bg-[#070b10] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-slate-400 md:text-left">
          Service Matching
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold leading-tight text-white md:text-left md:text-3xl">
          Help customers get to the right service faster.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-slate-300 md:mx-0 md:text-left md:text-lg">
          The assistant can guide users to diagnostics, brake work, collision estimates, dent repair, paint correction, or
          general maintenance — so the bay gets the right job.
        </p>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/[0.08] bg-[rgba(255,255,255,0.03)] p-6 backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Why it matters</p>
              <ul className="mt-4 space-y-3">
                {bullets.map((line) => (
                  <li key={line} className="flex gap-3 text-sm leading-snug text-slate-200">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-600/30 text-slate-300">
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[13px] leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-400">Production note.</span> Service menus and routing rules are
              configured per shop.
            </p>
          </div>
          <div>
            <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500 lg:text-left">
              View-only conversation
            </p>
            <ServiceMatchingMock />
          </div>
        </div>
      </div>
    </section>
  );
}
