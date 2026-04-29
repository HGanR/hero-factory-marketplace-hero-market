import { Check } from "lucide-react";

/**
 * View-only “Pricing Intelligence” proof for the public salon demo — not a live quoting engine.
 */

function PricingConversationMock() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-rose-200/10 bg-gradient-to-b from-[#100c10] to-[#06080d] shadow-[0_24px_80px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
      aria-hidden
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Guest conversation</p>
          <p className="text-sm font-semibold text-white">Illustrative preview</p>
        </div>
        <span className="rounded-full border border-rose-300/35 bg-rose-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-100/95">
          Demo
        </span>
      </div>

      <div className="space-y-3 p-4 md:p-5">
        <div className="flex justify-end">
          <div className="max-w-[92%] rounded-2xl rounded-tr-md border border-white/10 bg-slate-800/90 px-4 py-3 text-sm leading-relaxed text-slate-100 shadow-inner">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Client</p>
            <p className="mt-1.5">How much is a silk press?</p>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex justify-start">
            <div className="max-w-[92%] rounded-2xl rounded-tl-md border border-[#c9a87c]/35 bg-[#1a1412]/90 px-4 py-3 text-[13px] leading-relaxed text-[#f5e6d3]">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#d4b896]">Assistant</p>
              <p className="mt-2">Silk Press starts at $75.</p>
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[92%] rounded-2xl rounded-tl-md border border-[#c9a87c]/25 bg-slate-900/75 px-4 py-3 text-[13px] leading-relaxed text-slate-200">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#c9a87c]/90">Assistant</p>
              <p className="mt-2">
                Hydration treatments, trims, length, or premium add-ons can affect the final total depending on the
                service menu.
              </p>
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[92%] rounded-2xl rounded-tl-md border border-slate-600/40 bg-slate-900/70 px-4 py-3 text-[13px] leading-relaxed text-slate-200">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Assistant</p>
              <p className="mt-2 text-slate-100">If you&apos;d like, I can help guide you to the best option before you book.</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#c9a87c]/30 bg-gradient-to-br from-[#1f1814]/95 to-slate-950/90 px-4 py-3.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#e8d4b8]">Pricing Preview</p>
          <ul className="mt-3 space-y-2 text-[12px] leading-snug text-[#f0e4d4]">
            <li className="flex gap-2 border-b border-white/5 pb-2">
              <span className="text-[#c9a87c]/80">•</span>
              <span>Base service: Silk Press — from $75</span>
            </li>
            <li className="flex gap-2 border-b border-white/5 pb-2">
              <span className="text-[#c9a87c]/80">•</span>
              <span>Add-on: Hydration Treatment — +$20</span>
            </li>
            <li className="flex gap-2 pt-0.5">
              <span className="text-[#c9a87c]/80">•</span>
              <span>Package option: Silk Press + Trim — from $90</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export function SalonPricingIntelligence() {
  const bullets = [
    "Answers common price questions quickly",
    "Reflects salon-specific service pricing",
    "Can account for add-ons and upgrades",
    "Reduces repetitive inbox traffic",
    "Sets clearer expectations before booking",
  ];

  return (
    <section className="border-t border-slate-800/80 bg-[#0a0a0c] px-4 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.35em] text-[#d4b896] md:text-left">
          Pricing Intelligence
        </p>
        <h2 className="mt-3 text-center text-2xl font-bold leading-tight tracking-tight text-white md:text-left md:text-3xl md:leading-tight">
          Answer pricing questions without sending clients into your DMs.
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-base leading-relaxed text-slate-300 md:mx-0 md:text-left md:text-lg">
          Your assistant can respond to service pricing questions using the menu, add-ons, and booking rules configured
          for each salon. That means clearer expectations for clients and fewer repetitive messages for the stylist or
          salon manager.
        </p>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/[0.08] bg-[rgba(255,255,255,0.03)] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Why it matters</p>
              <ul className="mt-4 space-y-3">
                {bullets.map((line) => (
                  <li key={line} className="flex gap-3 text-sm leading-snug text-slate-200">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#c9a87c]/15 text-[#e8d4b8]">
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[13px] leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-400">Production note.</span> Pricing, service names, package
              options, and upsell logic are configured during salon onboarding. This preview is illustrative and not a
              live quoting engine.
            </p>
          </div>

          <div>
            <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-wider text-[#9a8a78] lg:text-left">
              View-only pricing example
            </p>
            <PricingConversationMock />
          </div>
        </div>
      </div>
    </section>
  );
}
