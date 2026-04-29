import { Check } from "lucide-react";

function AssistantMock() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-[#12100e] to-[#080706] shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Assistant preview</p>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-200/90">
          Demo
        </span>
      </div>
      <div className="space-y-2.5 p-4 text-[13px] leading-relaxed">
        <div className="flex justify-end">
          <div className="max-w-[90%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-3">
            <p className="text-[10px] text-slate-500">Visitor</p>
            <p className="mt-1">What time do you close Saturday? Do you take walk-ins?</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-amber-500/25 bg-amber-950/25 px-4 py-3 text-slate-100">
            <p className="text-[10px] font-semibold uppercase text-amber-300/90">Assistant</p>
            <p className="mt-2">
              Saturday we&apos;re open 9–6. Walk-ins welcome when there&apos;s chair time — I can check the next opening or
              hold a slot for you.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-2.5">
            <p className="text-[10px] text-slate-500">Visitor</p>
            <p className="mt-1 text-slate-100">Where do I park?</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[95%] rounded-2xl rounded-tl-md border border-white/10 bg-[#0a0908] px-4 py-3 text-slate-200">
            <p className="text-[10px] font-semibold uppercase text-slate-500">Assistant</p>
            <p className="mt-2">
              Street parking on Oak plus a lot behind the building — entrance off the alley. Want directions sent to your
              phone?
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BarbershopWebsiteAssistantPreview() {
  const bullets = [
    "Answers FAQs about services, hours, and policies",
    "Shows hours and directions without a phone call",
    "Explains cuts, beard work, and add-ons clearly",
    "Captures leads and routes booking requests",
    "Your shop sounds composed — even when you’re mid-fade",
  ];

  return (
    <section className="border-t border-slate-800/80 bg-[#0c0a08] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-amber-200/75 md:text-left">
          Website + AI Assistant
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold leading-tight text-white md:text-left md:text-3xl">
          Give clients a polished digital front door.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-slate-300 md:mx-0 md:text-left md:text-lg">
          A modern site with chat, intake, and lead capture — so your next client never waits on a text back.
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
              <span className="font-semibold text-slate-400">Production note.</span> Hours, parking, and services sync
              from your live configuration — the assistant stays accurate as you update the shop.
            </p>
          </div>
          <div>
            <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-wider text-slate-500 lg:text-left">
              View-only assistant example
            </p>
            <AssistantMock />
          </div>
        </div>
      </div>
    </section>
  );
}
