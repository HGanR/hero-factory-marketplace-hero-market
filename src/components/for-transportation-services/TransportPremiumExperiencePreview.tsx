import { Check } from "lucide-react";

function PremiumMock() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#12100e] to-[#080706] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Confirmation tone</p>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-200/90">
          Demo
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div className="rounded-xl border border-amber-500/15 bg-[#0a0908] px-4 py-3 text-[13px] leading-relaxed text-slate-200">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/80">Itinerary summary</p>
          <p className="mt-2 text-slate-100">
            <strong className="text-white">Friday 6:40 PM</strong> · Airport arrival · Sedan · Curbside pickup at Terminal
            B · Estimated downtown arrival 7:25 PM
          </p>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-amber-500/20 bg-amber-950/20 px-4 py-3 text-[13px] text-slate-100">
            <p className="text-[10px] font-semibold uppercase text-amber-300/90">Assistant</p>
            <p className="mt-2">
              Your driver will text when on location. If you need a quiet cabin or a preferred temperature, note it here
              — we&apos;ll pass it to dispatch.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-center text-[11px] text-slate-500">
          View-only · branding, signatures, and SMS content are configured per operator
        </div>
      </div>
    </div>
  );
}

export function TransportPremiumExperiencePreview() {
  const bullets = [
    "Reads like a private car line — calm, specific, and on-brand",
    "Reinforces timing, meeting points, and special requests",
    "Gives guests confidence between booking and pickup",
    "Reduces “did you get my note?” anxiety on high-stakes trips",
    "Supports white-glove operators who compete on experience, not price alone",
  ];

  return (
    <section className="border-t border-slate-800/80 bg-[#0a0908] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-slate-400 md:text-left">
          Premium Client Experience
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold leading-tight text-white md:text-left md:text-3xl">
          Every touchpoint feels like a private car line — not a form.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-slate-300 md:mx-0 md:text-left md:text-lg">
          From first click to itinerary recap, the experience should feel as composed as your fleet.
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
              <span className="font-semibold text-slate-400">Production note.</span> Copy, languages, and notification
              channels are tailored in onboarding — this is a tone and structure preview only.
            </p>
          </div>
          <div>
            <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500 lg:text-left">
              View-only experience example
            </p>
            <PremiumMock />
          </div>
        </div>
      </div>
    </section>
  );
}
