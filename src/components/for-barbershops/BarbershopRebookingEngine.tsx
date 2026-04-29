import { Check } from "lucide-react";

function RebookingMock() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#12100e] to-[#080706] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Follow-up preview</p>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-200/90">
          Demo
        </span>
      </div>
      <div className="space-y-2.5 p-4 text-[13px] leading-relaxed">
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-amber-500/25 bg-amber-950/25 px-4 py-3 text-slate-100">
            <p className="text-[10px] font-semibold uppercase text-amber-300/90">Assistant</p>
            <p className="mt-2">Thanks for coming in today — want me to book your next cut in about three weeks?</p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-2.5">
            <p className="text-[10px] text-slate-500">Client</p>
            <p className="mt-1 text-slate-100">Yeah, same barber if possible.</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-white/10 bg-[#0a0908] px-4 py-3 text-slate-200">
            <p className="text-[10px] font-semibold uppercase text-slate-500">Assistant</p>
            <p className="mt-2">
              Locked a tentative slot — you&apos;ll get a reminder two days before. If you loved the visit, a quick
              Google review helps the shop more than you know.
            </p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-emerald-500/20 bg-emerald-950/15 px-4 py-3 text-slate-200">
            <p className="text-[10px] font-semibold uppercase text-emerald-300/80">Assistant</p>
            <p className="mt-2">
              Members get priority booking and 10% off add-ons this month — want the details?
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BarbershopRebookingEngine() {
  const bullets = [
    "“Time for your next cut” reminders on a realistic cadence",
    "Recurring visit suggestions based on service type",
    "Post-visit follow-ups for reviews and feedback",
    "Loyalty and membership offers without manual blasts",
    "Repeat clients booked before they drift to another shop",
  ];

  return (
    <section className="border-t border-slate-800/80 bg-[#0c0a08] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-amber-200/75 md:text-left">
          Rebooking Engine
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold leading-tight text-white md:text-left md:text-3xl">
          Turn one cut into a repeat client.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-slate-300 md:mx-0 md:text-left md:text-lg">
          Automated follow-up keeps your chair full — reviews, rebooks, and memberships without chasing DMs.
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
              <span className="font-semibold text-slate-400">Production note.</span> Cadence and offers follow rules you
              set — no spam, just timely nudges.
            </p>
          </div>
          <div>
            <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500 lg:text-left">
              View-only follow-up example
            </p>
            <RebookingMock />
          </div>
        </div>
      </div>
    </section>
  );
}
