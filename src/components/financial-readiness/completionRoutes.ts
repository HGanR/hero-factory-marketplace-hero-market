/** Post-completion handoffs — align with platform areas for revenue, monitoring, and recovery. */

export const COMPLETION_HANDOFFS = {
  foundation: {
    headline: "Foundation complete — move into business & revenue readiness",
    links: [
      { href: "/ai-revenue-os", label: "AI Revenue OS & revenue readiness" },
      { href: "/grant-writing", label: "Business credit & funding prep" },
    ],
  },
  optimization: {
    headline: "Optimization track complete — stay on top of monitoring & funding",
    links: [
      { href: "/platform/events", label: "Platform monitoring & activity" },
      { href: "/grant-writing", label: "Funding readiness" },
    ],
  },
  resolution: {
    headline: "Resolution milestones logged — stabilize with foundation & books",
    links: [
      { href: "/financial-readiness/foundation", label: "Recovery plan → Credit Foundation" },
      { href: "/accounting", label: "Accounting & cash recovery" },
    ],
  },
} as const;
