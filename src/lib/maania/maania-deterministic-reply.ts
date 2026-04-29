import type { WidgetMessageContext } from "@/lib/widget/context-prompt";

/**
 * MAANIA — server-side replies aligned with `lib/maania` client intake (buyer steps, RET snapshot).
 * When `context.retSnapshot.maaniaMode` is true, the widget route uses this instead of an LLM so
 * the product does not depend on third-party chat APIs for MAANIA’s guided flow.
 */
export function tryMaaniaDeterministicReply(pageContext: unknown, _userMessage: string): string | null {
  if (!pageContext || typeof pageContext !== "object" || Array.isArray(pageContext)) return null;

  const ctx = pageContext as WidgetMessageContext;
  const snap = ctx.retSnapshot;
  if (!snap || typeof snap !== "object" || Array.isArray(snap)) return null;

  if (snap.maaniaMode !== true) return null;

  const path = snap.maaniaIntakePath as string | undefined;

  if (path === "buy") {
    const meta = snap.buyerIntakeProgressMeta as
      | { percent?: number; answeredCount?: number; totalCount?: number }
      | undefined;
    const suggested = snap.suggestedNextBuyerQuestion as string | null | undefined;

    if (typeof suggested === "string" && suggested.trim()) {
      return `Thanks — that helps. ${suggested.trim()}`;
    }

    const pct = meta?.percent ?? 0;
    const ac = meta?.answeredCount ?? 0;
    const tc = meta?.totalCount ?? 0;
    if (pct >= 99 || (tc > 0 && ac >= tc)) {
      return (
        "**Great — your buyer profile looks complete.** When you're ready, use **Open tailored demo page** or **Open in Site Builder** below. " +
        "If you want to adjust anything, say what to change."
      );
    }

    return (
      "Thanks — I'm still lining up your buyer profile. Share a bit more about financing, budget, or target areas, and we'll tighten the demo."
    );
  }

  if (path === "sell") {
    const propertyLabel = typeof snap.propertyLabel === "string" ? snap.propertyLabel.trim() : "";
    const notesPreview = typeof snap.intakeNotesPreview === "string" ? snap.intakeNotesPreview.trim() : "";
    const ownerContactPresent = snap.ownerContactPresent === true;

    if (!propertyLabel) {
      return "Great — let's build your listing and transfer intel. **What's the property or deal label** you want on this preview (e.g. address or short name)?";
    }
    if (!notesPreview || notesPreview.length < 12) {
      return "Thanks. **Add a few listing details** — beds/baths, neighborhood, price band, or seller goals — or use the **RET intake fields** panel above.";
    }
    if (!ownerContactPresent) {
      return "Got it. **Who should the agent contact** (or say “skip” if you prefer not to share yet)?";
    }

    return (
      "**Nice — we have enough to shape a sell-side demo.** Open **Preview demo direction** or **Open in Site Builder** below when you're ready. Say if you want anything rewritten."
    );
  }

  if (path === "unknown") {
    return (
      "I'm here to help either way. **Selling** focuses on transfer, listing, and risk flags; **buying** runs a short qualification so we can match properties and strategy. " +
      "Which fits you better — or describe your situation in one sentence?"
    );
  }

  return (
    "I'm here for intake and demo prep — not legal or tax advice. Pick **Selling** or **Purchasing** above, or describe what you're trying to do."
  );
}
