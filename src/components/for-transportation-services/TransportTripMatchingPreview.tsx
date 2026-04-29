import { Check } from "lucide-react";

function TripMatchingMock() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#12100e] to-[#080706] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Intake preview</p>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-200/90">
          Demo
        </span>
      </div>
      <div className="space-y-2.5 p-4 text-[13px] leading-relaxed text-slate-100">
        <div className="flex justify-end">
          <div className="max-w-[90%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-3">
            <p className="text-[10px] text-slate-500">Guest</p>
            <p className="mt-1">I need a car from the airport to downtown next Friday evening.</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-amber-500/25 bg-amber-950/30 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase text-amber-300/90">Assistant</p>
            <p className="mt-2 text-slate-200/95">
              Are you looking for a sedan, SUV, or executive van — and roughly how many passengers with luggage?
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-2.5">
            <p className="text-[10px] text-slate-500">Guest</p>
            <p className="mt-1">Two people, two bags. Sedan is fine.</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-amber-500/20 bg-[#0a0908] px-4 py-3 text-slate-200">
            <p className="text-[10px] font-semibold uppercase text-amber-300/70">Assistant</p>
            <p className="mt-2">
              For airport arrivals we typically confirm flight number and terminal when you book — that helps your driver
              stage correctly. Would you like curbside pickup or meet-and-greet inside?
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TransportTripMatchingPreview() {
  const bullets = [
    "Separates airport, hourly, point-to-point, and event blocks",
    "Captures party size, luggage, and vehicle class before dispatch sees the lead",
    "Surfaces add-ons (meet-and-greet, child seat, extra stops) when your menu supports them",
    "Reduces “wrong vehicle” surprises that cost time and trust",
    "Hands your team a cleaner trip sheet on first contact",
  ];

  return (
    <section className="border-t border-slate-800/80 bg-[#0c0a08] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-amber-200/75 md:text-left">
          Service-Aware Trip Matching
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold leading-tight text-white md:text-left md:text-3xl">
          Match the trip to the right vehicle and service level.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-slate-300 md:mx-0 md:text-left md:text-lg">
          Guests describe outcomes (“airport Friday”) — your assistant turns that into structured trip intent your
          dispatch can trust.
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
              <span className="font-semibold text-slate-400">Production note.</span> Fleet categories, service areas, and
              pricing rules are configured per operator. Final availability and quotes are confirmed by dispatch.
            </p>
          </div>
          <div>
            <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500 lg:text-left">
              View-only intake example
            </p>
            <TripMatchingMock />
          </div>
        </div>
      </div>
    </section>
  );
}
