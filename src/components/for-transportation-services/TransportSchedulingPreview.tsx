import { Check } from "lucide-react";

function SchedulingMock() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#12100e] to-[#080706] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Scheduling preview</p>
        <span className="rounded-full border border-slate-500/40 bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-300">
          Demo
        </span>
      </div>
      <div className="space-y-2.5 p-4 text-[13px] leading-relaxed">
        <div className="flex justify-end">
          <div className="max-w-[90%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-3 text-slate-100">
            <p className="text-[10px] text-slate-500">Guest</p>
            <p className="mt-1">I need a black car for 4 hours next Saturday afternoon — corporate road show.</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-amber-500/25 bg-amber-950/25 px-4 py-3 text-slate-100">
            <p className="text-[10px] font-semibold uppercase text-amber-300/90">Assistant</p>
            <p className="mt-2">
              Hourly chauffeur blocks usually start with a pickup window and first stop. What city should we base the
              vehicle in, and do you need a single sedan or an executive van for the group?
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-2.5">
            <p className="text-[10px] text-slate-500">Guest</p>
            <p className="mt-1">Downtown. Sedan. Start around 1pm.</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-emerald-500/25 bg-emerald-950/20 px-4 py-3 text-slate-200">
            <p className="text-[10px] font-semibold uppercase text-emerald-300/85">Assistant</p>
            <p className="mt-2">
              Noted. Dispatch can confirm driver assignment, rolling buffer, and any minimum-hour policy based on your
              fleet rules — you&apos;ll see proposed times before the ride is finalized.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TransportSchedulingPreview() {
  const bullets = [
    "Captures pickup windows, duration, and multi-stop intent clearly",
    "Aligns guest expectations with how you actually schedule drivers",
    "Surfaces minimums, buffers, and return-leg needs when configured",
    "Reduces last-minute “can we move this?” churn in the inbox",
    "Keeps night and weekend inquiries from dying on voicemail",
  ];

  return (
    <section className="border-t border-slate-800/80 bg-[#0a0908] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-slate-400 md:text-left">
          Scheduling &amp; Availability
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold leading-tight text-white md:text-left md:text-3xl">
          Availability that fits how you actually operate.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-slate-300 md:mx-0 md:text-left md:text-lg">
          The assistant frames time, duration, and routing questions the way dispatch thinks — not like a generic form.
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
              <span className="font-semibold text-slate-400">Production note.</span> Live calendars, driver assignments,
              and surge rules connect in your production stack — this preview shows the guest-facing conversation layer
              only.
            </p>
          </div>
          <div>
            <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500 lg:text-left">
              View-only scheduling example
            </p>
            <SchedulingMock />
          </div>
        </div>
      </div>
    </section>
  );
}
