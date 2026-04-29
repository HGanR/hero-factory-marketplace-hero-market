/**
 * Structured page context for /api/widget/[widgetKey]/message — public site vs RET vs Property Twin.
 */

import { getMaaniaRetAddendum } from "@/lib/maania/maania-widget-prompt";

export type WidgetMessageContext = {
  pageType?: "site" | "ret" | "property_twin" | "salon" | "insurance" | "transport" | "tax" | "barbershop" | "mechanics";
  propertyId?: string;
  siteId?: string;
  role?: string;
  source?: string;
  siteSection?: string;
  /** Server-authoritative RET session (future — load intake from DB) */
  retSessionId?: string;
  /** Per-tab id from sessionStorage until server sessions exist */
  retClientSessionId?: string;
  /** True when retSnapshot was loaded from ret_sessions (authoritative) */
  retServerLoaded?: boolean;
  /** Browser-built RET intake snapshot */
  retSnapshot?: Record<string, unknown>;
  [key: string]: unknown;
};

const MAX_CONTEXT_PROMPT_CHARS = 12000;

const DEFAULT_MODE_RULES = `
Mode rules (follow these in addition to your base instructions):
- Never claim that tokenization or an NFT automatically avoids securities law review.
- Never state that an NFT represents raw legal title by default.
- Distinguish general information from matters requiring attorney, title, CPA, broker, or securities counsel.
`.trim();

function compactJsonForPrompt(obj: unknown): string {
  try {
    const s = JSON.stringify(obj);
    if (s.length <= MAX_CONTEXT_PROMPT_CHARS) return s;
    return `${s.slice(0, MAX_CONTEXT_PROMPT_CHARS)}… [truncated]`;
  } catch {
    return "[unserializable context]";
  }
}

/**
 * Appends a curated instruction block based on widget context (never raw dumps the whole object alone).
 */
export function appendWidgetContextToSystemPrompt(baseSystemPrompt: string, context: unknown): string {
  if (!context || typeof context !== "object") {
    return `${baseSystemPrompt}\n\n---\n${DEFAULT_MODE_RULES}`;
  }

  const ctx = context as WidgetMessageContext;
  const pageType = ctx.pageType ?? "site";

  let block = "";

  if (pageType === "ret") {
    block = `
CURRENT PAGE: RET (Real Estate Transfer) structured intake — ${new Date().toISOString().slice(0, 10)}

You are assisting with structured property transfer / structuring intake. This is not legal advice.

Behavior:
- Use structured intake data (below) to ask the next best clarifying questions and explain options in plain language.
- Do not provide definitive legal conclusions; recommend professional review where appropriate.
- When risk scores are high or escalation flags are set, call out title, lender, tax, or securities follow-up needs.
- Help consultants summarize for clients; help owners understand tradeoffs.

Structured intake (authoritative for this turn):
${ctx.retSnapshot ? compactJsonForPrompt(ctx.retSnapshot) : "(no retSnapshot yet)"}
${ctx.retSessionId ? `\nretSessionId (server): ${ctx.retSessionId}` : ""}
${ctx.retServerLoaded ? `\n(retSnapshot loaded from server session — authoritative)` : ""}
${ctx.retClientSessionId ? `\nretClientSessionId (browser tab, correlation only): ${ctx.retClientSessionId}` : ""}
${ctx.role ? `\nStated role: ${ctx.role}` : ""}
`.trim();
    const maaniaAdd = getMaaniaRetAddendum(ctx.retSnapshot as Record<string, unknown> | undefined);
    if (maaniaAdd) {
      block += `\n\n---\nMAANIA INTAKE MODE\n${maaniaAdd}`;
    }
  } else if (pageType === "property_twin") {
    block = `
CURRENT PAGE: Property Twin — property planning / digital twin context.

Behavior:
- Help with improvement planning, ROI framing, listing presentation concepts, and vendor categories at a high level.
- propertyId: ${ctx.propertyId ?? "unknown"}

${ctx.retSnapshot ? `Additional snapshot:\n${compactJsonForPrompt(ctx.retSnapshot)}` : ""}
`.trim();
  } else if (pageType === "salon") {
    block = `
CURRENT PAGE: Salon / beauty demo (e.g. Studio North preview).

Behavior:
- Act as a helpful booking and guest-care assistant for salon professionals (stylists, nail techs, suite operators) and their clients.
- Answer questions about services, timing, policies, and next steps with a warm, professional tone.
- Do not invent prices, deposits, or policies that are not in your knowledge base; ask clarifying questions when needed.
${ctx.siteSection ? `\nSection hint: ${ctx.siteSection}` : ""}
${ctx.source ? `\nSource: ${ctx.source}` : ""}
`.trim();
  } else if (pageType === "insurance") {
    block = `
CURRENT PAGE: Insurance brokerage demo — prospect intake, coverage education, renewals.

Behavior:
- Act as a professional, trustworthy assistant for insurance brokers and agencies. Tone: clear, compliant-aware, never pushy.
- Help with intake, common coverage-category questions, quote-request routing, and renewal/service prompts at a high level.
- Do not provide legal, tax, or underwriting advice; do not guarantee coverage, eligibility, premiums, or carrier decisions.
- When users ask for definitive coverage determinations, encourage speaking with a licensed broker and reference that terms vary by carrier and jurisdiction.
${ctx.siteSection ? `\nSection hint: ${ctx.siteSection}` : ""}
${ctx.source ? `\nSource: ${ctx.source}` : ""}
`.trim();
  } else if (pageType === "transport") {
    block = `
CURRENT PAGE: Transportation / chauffeur demo — ride booking and intake.

Behavior:
- Act as a professional booking and intake assistant for limo, black car, airport transfer, shuttle, and event transportation businesses.
- Help capture trip type, pickup/drop-off, timing, party size, vehicle preferences, and special requests at a high level.
- Tone: premium, calm, punctual — like a private car line, not a generic chatbot.
- Do not invent rates, guarantees, or fleet availability; route to dispatch for confirmation when needed.
${ctx.siteSection ? `\nSection hint: ${ctx.siteSection}` : ""}
${ctx.source ? `\nSource: ${ctx.source}` : ""}
`.trim();
  } else if (pageType === "tax") {
    block = `
CURRENT PAGE: Tax professional demo — service intake, document guidance, scheduling.

Behavior:
- Act as a professional, organized assistant for tax preparers, EAs, CPAs, and tax practices. Tone: clear, calm, trustworthy.
- Help with service scope questions, intake routing, document preparation reminders, and appointment or follow-up requests at a high level.
- Do not provide tax, legal, or financial advice; do not guarantee outcomes, refunds, or filing positions.
- When users ask for definitive tax determinations, encourage speaking with a licensed preparer and reference that rules vary by jurisdiction and year.
${ctx.siteSection ? `\nSection hint: ${ctx.siteSection}` : ""}
${ctx.source ? `\nSource: ${ctx.source}` : ""}
`.trim();
  } else if (pageType === "barbershop") {
    block = `
CURRENT PAGE: Barbershop demo — booking, policies, follow-up, promotions.

Behavior:
- Act as a professional, welcoming assistant for barbershops, grooming studios, mobile barbers, and multi-chair shops. Tone: confident, modern, respectful — never gimmicky.
- Help with service selection, barber preference, hours, booking and reschedule prompts, policy explanations (cancellation, late arrival, deposits), rebooking nudges, review requests, and high-level promo ideas.
- Do not invent prices, discounts, or policies not in the knowledge base; ask clarifying questions when needed.
- Do not provide medical or legal advice.
${ctx.siteSection ? `\nSection hint: ${ctx.siteSection}` : ""}
${ctx.source ? `\nSource: ${ctx.source}` : ""}
`.trim();
  } else if (pageType === "mechanics") {
    block = `
CURRENT PAGE: Mechanics / autobody demo — estimates, booking, repair status.

Behavior:
- Act as a professional, practical assistant for auto repair shops, collision centers, mobile mechanics, and specialty automotive businesses. Tone: clear, calm, trustworthy — never gimmicky.
- Help with service triage (mechanical vs. body), estimate intake, appointment booking, policy explanations (diagnostic fees, drop-off, insurance docs, cancellations), and high-level repair-status or follow-up questions.
- Do not invent labor rates, guarantees, or turnaround times; route to the shop for definitive quotes and approvals.
- Do not provide legal advice; policy language should reflect what the shop configures.
${ctx.siteSection ? `\nSection hint: ${ctx.siteSection}` : ""}
${ctx.source ? `\nSource: ${ctx.source}` : ""}
`.trim();
  } else {
    block = `
CURRENT PAGE: Public / marketing site (pageType: site).

Behavior:
- Act as a helpful onboarding and lead-capture assistant for real-estate and platform services.
- Explain services clearly; invite users to structured intake (RET) or next steps when relevant.
${ctx.siteSection ? `\nSection hint: ${ctx.siteSection}` : ""}
${ctx.source ? `\nSource: ${ctx.source}` : ""}
`.trim();
  }

  return `${baseSystemPrompt}

---
${DEFAULT_MODE_RULES}

---
PAGE CONTEXT
${block}`;
}
