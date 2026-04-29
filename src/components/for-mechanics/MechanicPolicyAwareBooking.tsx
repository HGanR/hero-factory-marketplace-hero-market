import { Check } from "lucide-react";

function PolicyMock() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-slate-500/25 bg-gradient-to-b from-[#0f1419] to-[#070b10] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Policy preview</p>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-200/90">
          Demo
        </span>
      </div>
      <div className="space-y-2.5 p-4 text-[13px] leading-relaxed">
        <div className="flex justify-end">
          <div className="max-w-[90%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-3">
            <p className="text-[10px] text-slate-500">Customer</p>
            <p className="mt-1">Is there a fee just to diagnose the check engine light?</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-slate-500/30 bg-slate-900/80 px-4 py-3 text-slate-100">
            <p className="text-[10px] font-semibold uppercase text-slate-400">Assistant</p>
            <p className="mt-2">
              Many shops apply a diagnostic fee that can be credited toward approved repairs — your confirmation shows
              the amount and how it applies for this visit.
            </p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-white/10 bg-[#0a0e12] px-4 py-3 text-slate-200">
            <p className="text-[10px] font-semibold uppercase text-slate-500">Assistant</p>
            <p className="mt-2">
              For insurance-related body work, bring your claim number and adjuster contact if you have them — drop-off
              is curbside; keys in the lockbox if after hours.
            </p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-slate-600/40 bg-slate-900/70 px-4 py-3 text-slate-200">
            <p className="text-[10px] font-semibold uppercase text-slate-500">Assistant</p>
            <p className="mt-2">Cancellations inside 24 hours may forfeit the diagnostic slot — want the exact policy text?</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MechanicPolicyAwareBooking() {
  const bullets = [
    "Diagnostic fee clarity before work begins",
    "Drop-off and after-hours expectations",
    "Insurance documentation prompts when applicable",
    "Less confusion at arrival and fewer disputes",
    "Cancellation rules that match how you operate",
  ];

  return (
    <section className="border-t border-slate-800/80 bg-[#070b10] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-slate-400 md:text-left">
          Policy-Aware Booking
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold leading-tight text-white md:text-left md:text-3xl">
          Set expectations before the customer shows up.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-slate-300 md:mx-0 md:text-left md:text-lg">
          Prep instructions, diagnostic fees, insurance requirements, drop-off guidance, and cancellation rules — baked
          into intake and booking.
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
              <span className="font-semibold text-slate-400">Production note.</span> Policies are configured per shop.
              This is operational guidance, not legal advice.
            </p>
          </div>
          <div>
            <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500 lg:text-left">
              View-only policy example
            </p>
            <PolicyMock />
          </div>
        </div>
      </div>
    </section>
  );
}
