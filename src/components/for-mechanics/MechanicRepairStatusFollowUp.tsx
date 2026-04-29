import { Check } from "lucide-react";

function StatusMock() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-slate-500/25 bg-gradient-to-b from-[#0f1419] to-[#070b10] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Status updates</p>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-950/30 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-200/90">
          Demo
        </span>
      </div>
      <div className="space-y-2.5 p-4 text-[12px] leading-relaxed text-slate-200">
        <div className="rounded-xl border border-white/[0.06] bg-slate-950/60 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Intake confirmed</p>
          <p className="mt-1">Your Accord is checked in — diagnostic starts this morning.</p>
        </div>
        <div className="rounded-xl border border-amber-500/15 bg-amber-950/15 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-amber-300/90">Estimate ready</p>
          <p className="mt-1">Review and approve repairs in your portal — we&apos;re holding the bay until 2pm.</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#0a0e12] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-slate-500">Parts update</p>
          <p className="mt-1">Brake pads arrived — completion target end of day tomorrow.</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/15 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-emerald-300/85">Ready for pickup</p>
          <p className="mt-1">Vehicle is washed and at the front — reply when you&apos;re on the way.</p>
        </div>
      </div>
    </div>
  );
}

export function MechanicRepairStatusFollowUp() {
  const bullets = [
    "Intake confirmation, estimate ready, and completion notices",
    "Parts-delay updates without manual calls",
    "Pickup reminders that reduce lot congestion",
    "Fewer inbound “just checking” calls",
    "A more professional, confident customer experience",
  ];

  return (
    <section className="border-t border-slate-800/80 bg-[#0a0e12] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-slate-400 md:text-left">
          Repair Status &amp; Follow-Up
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold leading-tight text-white md:text-left md:text-3xl">
          Keep customers updated without tying up your team.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-slate-300 md:mx-0 md:text-left md:text-lg">
          Automated messaging for repair updates, parts delays, completion alerts, and pickup reminders — consistent
          with what your shop actually does.
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
              <span className="font-semibold text-slate-400">Production note.</span> Connect SMS/email and shop software
              in production — this preview shows messaging flow only.
            </p>
          </div>
          <div>
            <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500 lg:text-left">
              View-only status example
            </p>
            <StatusMock />
          </div>
        </div>
      </div>
    </section>
  );
}
