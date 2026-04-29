import { Check, Shield } from "lucide-react";

/**
 * View-only “Policy-Aware Booking” proof for the public salon demo — not a live policy engine.
 */

function PolicyConversationMock() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-b from-[#0c1018] to-[#06080d] shadow-[0_24px_80px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Policy-aware flow</p>
          <p className="text-sm font-semibold text-white">Illustrative preview</p>
        </div>
        <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200/95">
          Demo
        </span>
      </div>

      <div className="space-y-3 p-4 md:p-5">
        <div className="flex justify-end">
          <div className="max-w-[92%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-3 text-sm leading-relaxed text-slate-100 shadow-inner">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Client</p>
            <p className="mt-1.5">Can I book for tomorrow?</p>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex justify-start">
            <div className="max-w-[92%] rounded-2xl rounded-tl-md border border-amber-500/30 bg-amber-950/35 px-4 py-3 text-[13px] leading-relaxed text-amber-50/95">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/90">Assistant</p>
              <p className="mt-2">
                Yes. A <strong className="font-semibold text-white">deposit is required</strong> to confirm, and
                appointments canceled within <strong className="font-semibold text-white">24 hours</strong> may forfeit
                the deposit.
              </p>
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[92%] rounded-2xl rounded-tl-md border border-amber-500/25 bg-slate-900/80 px-4 py-3 text-[13px] leading-relaxed text-slate-200">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/70">Assistant</p>
              <p className="mt-2">Please arrive with clean, product-free hair.</p>
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[92%] rounded-2xl rounded-tl-md border border-slate-600/40 bg-slate-900/70 px-4 py-3 text-[13px] leading-relaxed text-slate-200">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Assistant</p>
              <p className="mt-2 text-slate-100">Would you like to continue to available times?</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-200/80">
          <Shield className="h-3.5 w-3.5 shrink-0 text-amber-400/90" />
          Policies shown here are examples — yours are configured per salon in production.
        </div>
      </div>
    </div>
  );
}

export function SalonPolicyAwareBooking() {
  const bullets = [
    "Explains deposit requirements before confirmation",
    "Reinforces cancellation windows in plain language",
    "Shares prep instructions so the service stays on track",
    "Reduces surprise disputes at check-in or checkout",
    "Helps protect your time and chair economics",
  ];

  return (
    <section className="border-t border-slate-800/80 bg-[#070b14] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-amber-300/85 md:text-left">
          Policy-Aware Booking
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold leading-tight tracking-tight text-white md:text-left md:text-3xl md:leading-tight">
          Set expectations before the appointment is ever booked.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-base leading-relaxed text-slate-300 md:mx-0 md:text-left md:text-lg">
          Your assistant can explain deposits, prep instructions, cancellation windows, and late policies as part of the
          booking flow so clients know the rules upfront — not when it&apos;s too late to reschedule gracefully.
        </p>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/[0.08] bg-[rgba(255,255,255,0.03)] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">
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
              <span className="font-semibold text-slate-400">Production note.</span> Deposit rules, grace periods, and
              prep copy are tailored to your salon in a full build — this demo shows how policy can ride alongside
              booking, not replace your legal agreements.
            </p>
          </div>

          <div>
            <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500 lg:text-left">
              Illustrative flow · not legal advice
            </p>
            <PolicyConversationMock />
          </div>
        </div>
      </div>
    </section>
  );
}
