import { Check } from "lucide-react";

function BookingMock() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#12100e] to-[#080706] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Booking preview</p>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-200/90">
          Demo
        </span>
      </div>
      <div className="space-y-2.5 p-4 text-[13px] leading-relaxed">
        <div className="flex justify-end">
          <div className="max-w-[90%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-3 text-slate-100">
            <p className="text-[10px] text-slate-500">Client</p>
            <p className="mt-1">I need a haircut and beard trim this Friday after 4.</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-amber-500/25 bg-amber-950/25 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase text-amber-300/90">Assistant</p>
            <p className="mt-2 text-slate-200/95">
              I can help you book. Do you want a skin fade, taper, or scissor cut — and a full beard lineup or just a
              trim?
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-2.5">
            <p className="text-[10px] text-slate-500">Client</p>
            <p className="mt-1">Mid fade, beard lineup. Prefer Marcus if he&apos;s open.</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-emerald-500/25 bg-emerald-950/20 px-4 py-3 text-slate-200">
            <p className="text-[10px] font-semibold uppercase text-emerald-300/85">Assistant</p>
            <p className="mt-2">
              Marcus has 4:30 and 5:15 Friday. I&apos;ll add a hot towel add-on if you want — you&apos;ll confirm
              before we lock it in.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BarbershopBookingPreview() {
  const bullets = [
    "Haircut type, beard service, and add-ons captured in one flow",
    "Preferred barber or next-available routing",
    "Time slots that match your real chair calendar",
    "Fewer DMs and “what time you got?” texts",
    "Cleaner handoff to your front desk or booking system",
  ];

  return (
    <section className="border-t border-slate-800/80 bg-[#0c0a08] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-amber-200/75 md:text-left">
          Smart Booking Intake
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold leading-tight text-white md:text-left md:text-3xl">
          Let clients book without back-and-forth.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-slate-300 md:mx-0 md:text-left md:text-lg">
          The assistant walks guests through service selection, barber preference, timing, and add-ons — like your best
          receptionist, online.
        </p>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/[0.08] bg-[rgba(255,255,255,0.03)] p-6 backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">What gets captured</p>
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
              <span className="font-semibold text-slate-400">Production note.</span> Services, barbers, and pricing come
              from your configured menu — this preview shows the conversation layer only.
            </p>
          </div>
          <div>
            <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500 lg:text-left">
              View-only conversation
            </p>
            <BookingMock />
          </div>
        </div>
      </div>
    </section>
  );
}
