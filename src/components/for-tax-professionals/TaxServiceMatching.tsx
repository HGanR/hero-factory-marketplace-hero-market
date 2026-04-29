import { Check } from "lucide-react";

function ServiceClarityMock() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#0c1018] to-[#070b14] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Conversation preview</p>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-200/90">
          Demo
        </span>
      </div>
      <div className="space-y-2.5 p-4 text-[13px] leading-relaxed text-slate-100">
        <div className="flex justify-end">
          <div className="max-w-[90%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-3">
            <p className="text-[10px] text-slate-500">Visitor</p>
            <p className="mt-1">Do you offer both personal and business returns?</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-amber-500/25 bg-amber-950/25 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase text-amber-300/90">Assistant</p>
            <p className="mt-2 text-slate-200/95">
              Yes — we prepare individual returns and small-business filings. I can outline what each service includes and
              what documents typically apply.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-2.5">
            <p className="text-[10px] text-slate-500">Visitor</p>
            <p className="mt-1">I&apos;m self-employed — I need bookkeeping help too.</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-amber-500/20 bg-[#0a1018] px-4 py-3 text-slate-200">
            <p className="text-[10px] font-semibold uppercase text-amber-300/70">Assistant</p>
            <p className="mt-2">
              We offer bookkeeping support and year-end coordination. Here&apos;s a short summary of what that covers
              before you book — no advice, just clarity on scope.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TaxServiceMatching() {
  const bullets = [
    "Personal & business tax services clearly explained",
    "Reduce confusion and back-and-forth",
    "Set expectations upfront",
    "Position yourself as organized and professional",
    "Improve conversion from visitor to client",
  ];

  return (
    <section className="border-t border-slate-800/80 bg-[#070b14] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-amber-200/75 md:text-left">
          Service Clarity
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold leading-tight text-white md:text-left md:text-3xl">
          Help clients understand exactly what you offer before they reach out.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-slate-300 md:mx-0 md:text-left md:text-lg">
          Tax Service Clarity — structured explanations that mirror how you actually work, not a generic FAQ wall.
        </p>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/[0.08] bg-[rgba(255,255,255,0.03)] p-6 backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Why it matters</p>
              <ul className="mt-4 space-y-3">
                {bullets.map((line) => (
                  <li key={line} className="flex gap-3 text-sm leading-snug text-slate-200">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[13px] leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-400">Production note.</span> This is informational only and not
              tax advice.
            </p>
          </div>
          <div>
            <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500 lg:text-left">
              View-only mock conversation
            </p>
            <ServiceClarityMock />
          </div>
        </div>
      </div>
    </section>
  );
}
