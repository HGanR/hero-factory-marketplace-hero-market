import { Check, Sparkles } from "lucide-react";

/**
 * View-only “Smart Service Matching” proof for the public salon demo — not a live agent console.
 */

function ConversationMock() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-b from-[#0c1018] to-[#06080d] shadow-[0_24px_80px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Guest conversation</p>
          <p className="text-sm font-semibold text-white">Illustrative preview</p>
        </div>
        <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-fuchsia-200/95">
          Demo
        </span>
      </div>

      <div className="space-y-4 p-4 md:p-5">
        <div className="flex justify-end">
          <div className="max-w-[92%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-3 text-sm leading-relaxed text-slate-100 shadow-inner">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Client</p>
            <p className="mt-1.5">I want something cute for my birthday dinner.</p>
          </div>
        </div>

        <div className="flex justify-start">
          <div className="max-w-[92%] rounded-2xl rounded-tl-md border border-violet-500/35 bg-violet-950/50 px-4 py-3 text-sm leading-relaxed text-slate-100">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-300/90">Assistant</p>
            <ul className="mt-2 list-none space-y-2.5 text-[13px] text-slate-200/95">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                Are you looking for a silk press, install, or braided style?
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                Do you want low-maintenance or a styled finish?
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                Do you want a trim or treatment included?
              </li>
            </ul>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/80 to-slate-950/90 px-4 py-3.5">
          <div className="flex items-center gap-2 text-emerald-300/95">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Recommended service</span>
          </div>
          <p className="mt-2 text-base font-semibold text-white">Silk Press + Hydration + Trim</p>
          <p className="mt-1 text-[11px] leading-snug text-emerald-200/70">
            Matched from your answers — ready to align with timing and booking type.
          </p>
        </div>
      </div>
    </div>
  );
}

export function SalonServiceMatching() {
  const bullets = [
    "Asks simple intake questions in plain language",
    "Identifies likely service fit before the chair",
    "Reduces wrong bookings and awkward corrections",
    "Improves timing accuracy for the day’s schedule",
    "Creates a stronger pre-appointment experience",
  ];

  return (
    <section className="border-t border-slate-800/80 bg-[#060a12] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-fuchsia-300/85 md:text-left">
          Smart Service Matching
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold leading-tight tracking-tight text-white md:text-left md:text-3xl md:leading-tight">
          Help clients choose the right service before they book.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-base leading-relaxed text-slate-300 md:mx-0 md:text-left md:text-lg">
          Your assistant can ask a few focused questions, interpret what the client is actually trying to get done, and
          guide them toward the correct service path. That means fewer mismatched appointments, clearer expectations, and
          a smoother day for the stylist.
        </p>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/[0.08] bg-[rgba(255,255,255,0.03)] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Why it matters</p>
              <ul className="mt-4 space-y-3">
                {bullets.map((line) => (
                  <li key={line} className="flex gap-3 text-sm leading-snug text-slate-200">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-300">
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[13px] leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-400">Production note.</span> In a full site build, service menus,
              add-ons, and business rules are tailored to your salon — this mock shows the experience, not your live
              catalog.
            </p>
          </div>

          <div>
            <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500 lg:text-left">
              Illustrative flow · not a connected agent session
            </p>
            <ConversationMock />
          </div>
        </div>
      </div>
    </section>
  );
}
