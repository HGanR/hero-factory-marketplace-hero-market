import Link from "next/link";
import { Settings2 } from "lucide-react";

export type AiRevenueOSHighlightVariant =
  | "realtor"
  | "insurance"
  | "transport"
  | "salon"
  | "barber"
  | "auto"
  | "tax";

export interface AiRevenueOSHighlightProps {
  /** Anchor (e.g. `#proof`, `#demo`) or path to live demo */
  demoHref?: string;
  variant?: AiRevenueOSHighlightVariant;
  /** Opening = authority framing; closing = demo-forward copy + niche CTA label */
  placement?: "opening" | "closing";
}

/** Authority / system framing — first placement */
const OPENING_SUBHEADLINES: Record<AiRevenueOSHighlightVariant | "default", string> = {
  default:
    "This isn't just a website — it's a system designed to generate, optimize, and scale revenue.",
  realtor:
    "Turn listings into predictable revenue with a system that optimizes every deal.",
  insurance:
    "Grow premium and retention with intake, benchmarks, and follow-up — governed like a real book of business.",
  transport:
    "Keep lanes full and unit economics clear with the same revenue engine that powers the platform.",
  salon:
    "Fill chairs, increase bookings, and maximize client value automatically.",
  barber:
    "Fill chairs and sell premium grooming without living in your DMs — with structured growth behind the brand.",
  auto:
    "Drive consistent service demand and higher ticket jobs with structured growth.",
  tax:
    "Convert seasonal clients into year-round revenue with intelligent systems.",
};

/** Action-oriented — second placement, primes the demo click */
const CLOSING_SUBHEADLINES: Record<AiRevenueOSHighlightVariant | "default", string> = {
  default:
    "See how this works for your business in the live demo — every workflow ties back to revenue levers you control.",
  realtor:
    "Step through the realtor demo: listing interest, follow-up, and motion toward signed clients — not just a static page.",
  insurance:
    "Open the broker demo and watch quote-to-client clarity replace slow back-and-forth.",
  transport:
    "See rides and recurring relationships in motion in the demo — built for demand you can measure.",
  salon:
    "Open the booking demo and see how empty slots and repeat visits get systematic support.",
  barber:
    "See the barbershop flow in the demo — rebooks, tickets, and chair time aligned with how you actually run the shop.",
  auto:
    "Walk the shop demo: higher-value jobs, cleaner intake, and follow-through your front desk can sustain.",
  tax:
    "See the tax demo turn seasonal traffic into ongoing engagement — with fewer drop-offs between peaks.",
};

const OUTCOMES: Record<AiRevenueOSHighlightVariant | "default", string> = {
  default: "Revenue you can repeat, measure, and compound.",
  realtor: "Convert more listing leads into signed clients",
  insurance: "Increase quote-to-client conversion",
  transport: "Book more rides and recurring clients",
  salon: "Fill empty slots and increase repeat bookings",
  barber: "Improve rebooking and average ticket",
  auto: "Drive higher-value service jobs",
  tax: "Turn seasonal clients into recurring revenue",
};

const OPENING_CTA = "See It In Action";

const CLOSING_CTA_LABELS: Record<AiRevenueOSHighlightVariant | "default", string> = {
  default: "See the Live Demo",
  realtor: "See the Realtor Demo",
  insurance: "See the Broker Demo",
  transport: "See the Transportation Demo",
  salon: "See the Booking Demo",
  barber: "See the Barbershop Demo",
  auto: "See the Shop Demo",
  tax: "See the Tax Demo",
};

const BULLETS = [
  "Identify your highest revenue growth lever (Traffic, Conversion, AOV)",
  "Generate campaigns, offers, and content automatically",
  "Benchmark performance against real market data",
  "Continuously optimize and improve results over time",
];

function subheadFor(
  placement: "opening" | "closing",
  variant?: AiRevenueOSHighlightVariant,
) {
  const map =
    placement === "opening" ? OPENING_SUBHEADLINES : CLOSING_SUBHEADLINES;
  if (variant && map[variant]) return map[variant];
  return map.default;
}

function outcomeFor(variant?: AiRevenueOSHighlightVariant) {
  if (variant && OUTCOMES[variant]) return OUTCOMES[variant];
  return OUTCOMES.default;
}

function primaryCtaLabel(
  placement: "opening" | "closing",
  variant?: AiRevenueOSHighlightVariant,
) {
  if (placement === "opening") return OPENING_CTA;
  if (variant && CLOSING_CTA_LABELS[variant]) return CLOSING_CTA_LABELS[variant];
  return CLOSING_CTA_LABELS.default;
}

export function AiRevenueOSHighlight({
  demoHref = "#proof",
  variant,
  placement = "opening",
}: AiRevenueOSHighlightProps) {
  const sub = subheadFor(placement, variant);
  const outcome = outcomeFor(variant);
  const primaryLabel = primaryCtaLabel(placement, variant);

  const wrapperClasses =
    placement === "opening"
      ? "mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10"
      : "mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8";

  return (
    <div className={wrapperClasses} data-ai-revenue-os-highlight={placement}>
      <div
        className="group relative overflow-hidden rounded-2xl border border-transparent bg-[#050810] p-1 shadow-[0_0_0_1px_rgba(6,182,212,0.35),0_25px_80px_-20px_rgba(59,130,246,0.45),0_0_60px_-15px_rgba(124,58,237,0.35)] transition-transform duration-300 hover:scale-[1.01] md:hover:scale-[1.015]"
        style={{
          background:
            "linear-gradient(135deg, rgba(6,182,212,0.5) 0%, rgba(59,130,246,0.45) 40%, rgba(124,58,237,0.4) 100%)",
        }}
      >
        <div
          className={
            placement === "opening"
              ? "relative overflow-hidden rounded-[14px] bg-[#070b14] px-6 py-12 md:px-12 md:py-14"
              : "relative overflow-hidden rounded-[14px] bg-[#070b14] px-6 py-10 md:px-10 md:py-12"
          }
          style={{
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl animate-pulse"
            style={{ animationDuration: "4s" }}
          />
          <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-violet-600/15 blur-3xl" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-3xl" />

          <div className="relative mx-auto max-w-4xl text-center">
            <div className="mb-2 flex justify-center">
              <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.35em] text-cyan-300/90">
                <Settings2 className="h-4 w-4 text-cyan-400" aria-hidden />
                POWERED BY INTELLIGENCE
              </span>
            </div>

            <h2 className="mt-3 text-2xl font-bold tracking-tight text-white md:text-3xl lg:text-4xl">
              AI Revenue Operating System™
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-[15px] font-medium leading-snug text-cyan-100/90 md:text-base">
              {outcome}
            </p>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg">
              {sub}
            </p>

            <ul className="mx-auto mt-8 max-w-xl space-y-3 text-left text-sm text-slate-300 md:text-[15px]">
              {BULLETS.map((line) => (
                <li key={line} className="flex gap-3">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500"
                    aria-hidden
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap">
              <Link
                href={demoHref}
                className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 sm:w-auto"
                aria-label={`${primaryLabel}: jump to demo section`}
              >
                {primaryLabel}
              </Link>
              <Link
                href="/ai-revenue-os"
                className="inline-flex min-h-[48px] items-center justify-center text-sm font-semibold text-cyan-300 underline-offset-4 transition hover:text-cyan-200 hover:underline"
              >
                Learn More About the System
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
