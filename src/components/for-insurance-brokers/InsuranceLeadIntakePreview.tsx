import { Check } from "lucide-react";

function LeadIntakeMock() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-b from-[#0a1520] to-[#050a10] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Conversation preview</p>
        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-cyan-200/90">
          Demo
        </span>
      </div>
      <div className="space-y-3 p-4 text-[13px] leading-relaxed">
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-cyan-500/25 bg-cyan-950/40 px-4 py-3 text-slate-100">
            <p className="text-[10px] font-semibold uppercase text-cyan-300/90">Assistant</p>
            <p className="mt-2">What kind of coverage are you looking for?</p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-2.5 text-slate-100">
            <p className="text-[10px] text-slate-500">Prospect</p>
            <p className="mt-1">Auto insurance</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-cyan-500/20 bg-slate-900/80 px-4 py-3 text-slate-200">
            <p className="text-[10px] font-semibold uppercase text-cyan-300/70">Assistant</p>
            <p className="mt-2">Is this a new policy or are you shopping rates?</p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-2.5">
            <p className="text-[10px] text-slate-500">Prospect</p>
            <p className="mt-1 text-slate-100">Shopping rates</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-cyan-500/20 bg-slate-900/80 px-4 py-3 text-slate-200">
            <p className="text-[10px] font-semibold uppercase text-cyan-300/70">Assistant</p>
            <p className="mt-2">When would you like coverage to begin?</p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-2.5">
            <p className="text-[10px] text-slate-500">Prospect</p>
            <p className="mt-1 text-slate-100">As soon as possible</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-cyan-500/20 bg-slate-900/80 px-4 py-3 text-slate-200">
            <p className="text-[10px] font-semibold uppercase text-cyan-300/70">Assistant</p>
            <p className="mt-2">Best email and phone number?</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-emerald-500/25 bg-emerald-950/30 px-4 py-3 text-slate-100">
            <p className="text-[10px] font-semibold uppercase text-emerald-300/90">Assistant</p>
            <p className="mt-2">Thanks — a broker can review and follow up.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InsuranceLeadIntakePreview() {
  const bullets = [
    "Collects name, contact, policy type, timeline, and service need",
    "Separates quote requests from support and renewal questions",
    "Gives staff cleaner, more actionable leads",
    "Works after hours, weekends, and during peak call volume",
    "Reduces abandoned interest caused by slow response times",
  ];

  return (
    <section className="border-t border-slate-800/80 bg-[#07111a] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-cyan-300/85 md:text-left">
          Intake That Starts Working Immediately
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold leading-tight text-white md:text-left md:text-3xl">
          Let prospects start the process the second they land on your site.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-slate-300 md:mx-0 md:text-left md:text-lg">
          Structured intake turns curiosity into something your team can act on — without waiting on office hours.
        </p>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/[0.08] bg-[rgba(255,255,255,0.03)] p-6 backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Why it matters</p>
              <ul className="mt-4 space-y-3">
                {bullets.map((line) => (
                  <li key={line} className="flex gap-3 text-sm leading-snug text-slate-200">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[13px] leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-400">Production note.</span> Configured per brokerage and should
              be reviewed for compliance, disclosures, and state-specific requirements.
            </p>
          </div>
          <div>
            <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500 lg:text-left">
              View-only intake example
            </p>
            <LeadIntakeMock />
          </div>
        </div>
      </div>
    </section>
  );
}
