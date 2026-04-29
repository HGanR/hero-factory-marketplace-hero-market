import { Check } from "lucide-react";

function PromoMock() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#12100e] to-[#080706] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Campaign preview</p>
        <span className="rounded-full border border-slate-500/40 bg-slate-800/80 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-300">
          Demo
        </span>
      </div>
      <div className="space-y-3 p-4 text-[12px] leading-relaxed text-slate-200">
        <div className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Shop owner</p>
          <p className="mt-1 text-slate-100">Need to fill slow Tuesdays</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase text-amber-300/90">Promo idea</p>
          <p className="mt-1">Tuesday lineup special — $5 off any cut booked before noon.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-white/[0.06] bg-[#0a0908] px-3 py-2">
            <p className="text-[10px] font-semibold text-slate-500">SMS</p>
            <p className="mt-1 text-[11px] text-slate-300">
              Open chairs Tues AM — book before 12 &amp; save. Reply STOP to opt out.
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-[#0a0908] px-3 py-2">
            <p className="text-[10px] font-semibold text-slate-500">Instagram</p>
            <p className="mt-1 text-[11px] text-slate-300">
              Slow Tuesday? Not here. Mid-week lineup — link in bio. #barbershop
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-[#0a0908] px-3 py-2">
          <p className="text-[10px] font-semibold text-slate-500">Email</p>
          <p className="mt-1 text-[11px] text-slate-300">
            Subject: Tuesday morning openings at [Shop]. Book your fade before noon and take five off your service.
          </p>
        </div>
      </div>
    </div>
  );
}

export function BarbershopPromoEngine() {
  const bullets = [
    "Hot towel shave, beard detailing, kids cuts, house calls — surfaced at the right time",
    "Membership and package upsells without hard selling",
    "Seasonal promos aligned to slow days you choose",
    "Channel-ready copy for SMS, social, and email",
    "Less time writing captions, more time behind the chair",
  ];

  return (
    <section className="border-t border-slate-800/80 bg-[#0a0908] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-amber-200/75 md:text-left">
          Promotion + Upsell
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold leading-tight text-white md:text-left md:text-3xl">
          Promote premium services without chasing people manually.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-slate-300 md:mx-0 md:text-left md:text-lg">
          Campaign launcher — turn a plain-English goal into promo ideas and ready-to-send copy across channels.
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
              <span className="font-semibold text-slate-400">Production note.</span> Final sends go through your
              connected tools; approvals and compliance stay in your control.
            </p>
          </div>
          <div>
            <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500 lg:text-left">
              View-only campaign example
            </p>
            <PromoMock />
          </div>
        </div>
      </div>
    </section>
  );
}
