import { Check } from "lucide-react";

function IntakeMock() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#0c1018] to-[#070b14] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Intake preview</p>
        <span className="rounded-full border border-slate-500/40 bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-300">
          Demo
        </span>
      </div>
      <div className="space-y-2.5 p-4 text-[13px] leading-relaxed">
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-slate-100">
            <p className="text-[10px] font-semibold uppercase text-amber-300/90">Assistant</p>
            <p className="mt-2">Are you filing as an individual, or do you need business / partnership support?</p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-2.5">
            <p className="text-[10px] text-slate-500">Client</p>
            <p className="mt-1 text-slate-100">Individual — I also have a side business.</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-emerald-500/25 bg-emerald-950/15 px-4 py-3 text-slate-200">
            <p className="text-[10px] font-semibold uppercase text-emerald-300/85">Assistant</p>
            <p className="mt-2">
              Got it. I&apos;ll capture contact details and a short summary of forms you expect (W-2, 1099s, expenses).
              You can upload documents securely after this step.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-2.5">
            <p className="text-[10px] text-slate-500">Client</p>
            <p className="mt-1 text-slate-100">Prefer a call next week — Tuesday afternoon.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TaxSchedulingPreview() {
  const bullets = [
    "Structured intake for individuals and businesses",
    "Collect contact and service needs",
    "Prepare clients for document submission",
    "Reduce manual onboarding time",
    "Improve workflow efficiency",
  ];

  return (
    <section className="border-t border-slate-800/80 bg-[#0a0f18] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-slate-400 md:text-left">
          Guided Intake
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold leading-tight text-white md:text-left md:text-3xl">
          Collect the right client information before the first call.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-slate-300 md:mx-0 md:text-left md:text-lg">
          Smart Client Intake — questions framed the way preparers think, so your team gets a clean handoff.
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
              <span className="font-semibold text-slate-400">Production note.</span> Scheduling windows and intake fields
              are configured for your practice — this preview shows the guest-facing flow only.
            </p>
          </div>
          <div>
            <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500 lg:text-left">
              View-only intake example
            </p>
            <IntakeMock />
          </div>
        </div>
      </div>
    </section>
  );
}
