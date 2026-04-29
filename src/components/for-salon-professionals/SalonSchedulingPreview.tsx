import { Check } from "lucide-react";

/**
 * View-only “Smart Scheduling Preview” for the public salon demo — not a functional admin surface.
 */

function SchedulingMockPanel() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-b from-[#0c1018] to-[#06080d] shadow-[0_24px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.04)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Admin · Schedule</p>
          <p className="text-sm font-semibold text-white">Studio North</p>
        </div>
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-200/95">
          Preview
        </span>
      </div>

      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:gap-0">
        {/* Left rail — intake summary */}
        <div className="shrink-0 rounded-xl border border-white/[0.06] bg-slate-950/90 p-4 sm:w-[34%] sm:border-0 sm:border-r sm:border-white/[0.06] sm:rounded-none sm:rounded-l-xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-fuchsia-300/90">Today&apos;s intake</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-white">4</p>
          <p className="mt-1 text-[11px] leading-snug text-slate-400">Requests routed from the AI assistant</p>
          <div className="mt-5 border-t border-white/[0.08] pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Stylist</p>
            <p className="mt-1 text-sm font-medium text-white">Alex Rivera</p>
            <p className="text-[11px] text-slate-500">Lead · color &amp; extensions</p>
          </div>
          <div className="mt-4 space-y-2 rounded-lg border border-white/[0.06] bg-black/30 p-2.5">
            <p className="text-[10px] font-medium text-slate-400">Latest</p>
            <div className="h-2 w-full rounded-full bg-slate-800">
              <div className="h-2 w-[72%] rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500" />
            </div>
            <p className="text-[10px] text-slate-500">Intake → calendar match rate (demo)</p>
          </div>
        </div>

        {/* Week calendar strip */}
        <div className="min-w-0 flex-1 p-2 sm:p-4">
          <p className="mb-3 text-center text-[11px] font-medium text-slate-400 sm:text-left">Week of March 17</p>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {d}
              </div>
            ))}
            {days.map((d, i) => (
              <div
                key={`col-${d}`}
                className="relative min-h-[128px] rounded-lg border border-white/[0.05] bg-slate-900/40 p-1"
              >
                <span className="absolute left-1 top-1 text-[10px] text-slate-600">{17 + i}</span>
                {i === 0 ? (
                  <div className="mt-6 space-y-1">
                    <div className="rounded-md bg-violet-500/25 px-1 py-1.5 text-[9px] leading-tight text-violet-100 ring-1 ring-violet-400/30">
                      <span className="font-semibold text-white">10:00</span>
                      <span className="block text-violet-200/90">Gel refresh</span>
                    </div>
                  </div>
                ) : null}
                {i === 2 ? (
                  <div className="mt-6 space-y-1">
                    <div className="rounded-md bg-pink-500/25 px-1 py-1.5 text-[9px] leading-tight text-pink-100 ring-1 ring-pink-400/30">
                      <span className="font-semibold text-white">2:00</span>
                      <span className="block text-pink-200/90">Full color</span>
                    </div>
                    <div className="rounded-md bg-slate-600/40 px-1 py-1 text-[8px] text-slate-300 ring-1 ring-white/10">
                      4:30 Hold
                    </div>
                  </div>
                ) : null}
                {i === 4 ? (
                  <div className="mt-6 space-y-1">
                    <div className="rounded-md bg-emerald-500/25 px-1 py-1.5 text-[9px] leading-tight text-emerald-100 ring-1 ring-emerald-400/30">
                      <span className="font-semibold text-white">11:30</span>
                      <span className="block text-emerald-200/90">Cut + style</span>
                    </div>
                  </div>
                ) : null}
                {i === 6 ? (
                  <div className="mt-6">
                    <div className="rounded-md bg-cyan-500/20 px-1 py-1.5 text-[9px] leading-tight text-cyan-100 ring-1 ring-cyan-400/25">
                      <span className="font-semibold text-white">9:30</span>
                      <span className="block text-cyan-200/90">Brow + lash</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SalonSchedulingPreview() {
  const bullets = [
    "AI-guided appointment intake from your guest-facing site",
    "Service-aware flow so timing and booking type stay aligned",
    "Requests organized into a calendar workflow your team can scan",
    "Stylists and managers see what’s booked from the admin side in a full build",
    "Less texting back-and-forth — clearer accuracy on services and slots",
  ];

  return (
    <section className="border-t border-slate-800/80 bg-[#0a0e18] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-violet-300/85 md:text-left">
          Smart Scheduling Preview
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold leading-tight tracking-tight text-white md:text-left md:text-3xl md:leading-tight">
          Your assistant can do more than answer questions.{" "}
          <span className="bg-gradient-to-r from-white to-violet-200/95 bg-clip-text text-transparent">
            It can help organize demand.
          </span>
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-base leading-relaxed text-slate-300 md:mx-0 md:text-left md:text-lg">
          When someone asks for an appointment, the assistant gathers service details, identifies the right booking
          type, and routes that into your scheduling workflow — a business tool, not just a chat window. In a live site
          build, your stylist uses the admin calendar; you&apos;re not stuck texting back and forth all day.
        </p>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/[0.08] bg-[rgba(255,255,255,0.03)] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-white">Feature Preview: Smart Scheduling Admin</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                It guides visitors through booking, collects the right appointment details, and supports a cleaner
                scheduling workflow for the stylist or salon manager — so intake, routing, and calendar visibility stay
                connected.
              </p>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">What this can support in a live build</p>
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
              <span className="font-semibold text-slate-400">Demo note.</span> This section shows the scheduling experience
              visually — a public-facing proof of capability, not a live booking engine. In production, your team can
              connect real calendar and scheduling tools; the stylist would manage bookings from their admin panel.
            </p>
          </div>

          <div>
            <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500 lg:text-left">
              View-only preview · not your live calendar
            </p>
            <SchedulingMockPanel />
          </div>
        </div>
      </div>
    </section>
  );
}
