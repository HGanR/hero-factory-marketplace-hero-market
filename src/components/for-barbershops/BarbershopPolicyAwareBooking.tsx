import { Check } from "lucide-react";

function PolicyMock() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#12100e] to-[#080706] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
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
            <p className="text-[10px] text-slate-500">Client</p>
            <p className="mt-1">If I&apos;m running late is my spot still held?</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-amber-500/25 bg-amber-950/30 px-4 py-3 text-slate-100">
            <p className="text-[10px] font-semibold uppercase text-amber-300/90">Assistant</p>
            <p className="mt-2">
              We hold your chair for a short grace window after the start time — after that we may need to reschedule to
              keep the lineup moving. Your confirmation shows the exact policy for this shop.
            </p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-white/10 bg-[#0a0908] px-4 py-3 text-slate-200">
            <p className="text-[10px] font-semibold uppercase text-slate-500">Assistant</p>
            <p className="mt-2">
              Cancellations inside 24 hours may incur a fee if your booking included a deposit — I can show the summary
              from your shop&apos;s rules before you confirm.
            </p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-slate-600/40 bg-slate-900/70 px-4 py-3 text-slate-200">
            <p className="text-[10px] font-semibold uppercase text-slate-500">Assistant</p>
            <p className="mt-2">Want a text reminder the day before?</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BarbershopPolicyAwareBooking() {
  const bullets = [
    "SMS and email reminders before the appointment",
    "Cancellation window and fee messaging in plain language",
    "Reschedule prompts when plans change",
    "Deposit-ready flows when your shop requires them",
    "Fewer no-shows without sounding hostile",
  ];

  return (
    <section className="border-t border-slate-800/80 bg-[#0a0908] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-slate-400 md:text-left">
          No-Show Reduction
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold leading-tight text-white md:text-left md:text-3xl">
          Confirm appointments before the chair sits empty.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-slate-300 md:mx-0 md:text-left md:text-lg">
          Automated reminders and policy-aware messaging keep clients accountable — without your team playing phone tag.
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
              <span className="font-semibold text-slate-400">Production note.</span> Connect your real SMS/email provider
              and policy text in production — this demo illustrates the client experience.
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
